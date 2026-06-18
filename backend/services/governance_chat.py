"""Natural-language Q&A over governance catalog state and knowledge base."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models import FieldDefinition, QualityRule, TrustScore
from rag_governance import (
    FieldMetadata,
    call_ollama,
    parse_json_response,
    read_knowledge_base,
    retrieve_context_tfidf,
    tokenize,
)
from config import KNOWLEDGE_BASE_PATH
from services.governance_chat_guardrails import assess_confidence, is_governance_topic
from services.governance_product_guide import PLATFORM_GUIDE, try_answer_product_question
from services.knowledge import load_sections
from services.governance_principles import load_principles, load_readiness_config, normalize_breakdown
from services.trust import READINESS_NOTE

MAX_CONTEXT_CHARS = 12000

GUARDRAIL_DISCLAIMER = (
    "Answers use only your saved governance catalog and knowledge base — "
    "not live warehouse data. If unsure, the assistant will not guess."
)

UNKNOWN_ANSWER_TEMPLATE = (
    "I don't have enough grounded information in your AI-Assisted Data Governance catalog to answer that safely, "
    "and I won't guess. Use Submit to help desk below so a data governance expert can respond."
)


def _truncate(text: str, limit: int = 400) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def build_governance_context(session: Session, question: str) -> str:
    """Assemble a compact snapshot of catalog state for the assistant."""
    definitions = (
        session.query(FieldDefinition)
        .order_by(
            FieldDefinition.database_name,
            FieldDefinition.table_name,
            FieldDefinition.column_name,
        )
        .all()
    )
    rules = (
        session.query(QualityRule)
        .order_by(
            QualityRule.database_name,
            QualityRule.table_name,
            QualityRule.column_name,
        )
        .all()
    )
    trust_rows = (
        session.query(TrustScore)
        .order_by(TrustScore.database_name, TrustScore.table_name)
        .all()
    )

    kb_sections = load_sections()
    question_tokens = set(tokenize(question))
    kb_hits: list[str] = []
    for section in kb_sections:
        hay = f"{section['title']} {section.get('text', '')}".lower()
        if any(token in hay for token in question_tokens if len(token) > 2):
            kb_hits.append(f"### {section['title']}\n{_truncate(section.get('text', ''), 600)}")
    if not kb_hits and kb_sections:
        try:
            chunks = read_knowledge_base(KNOWLEDGE_BASE_PATH)
            pseudo_field = FieldMetadata(
                database_name="",
                table_name="",
                column_name="user_question",
                data_type="text",
                sample_values=[],
                notes=question,
            )
            for chunk in retrieve_context_tfidf(pseudo_field, chunks, top_k=2):
                kb_hits.append(f"### {chunk.title}\n{_truncate(chunk.text, 600)}")
        except Exception:
            kb_hits.append(
                f"### {kb_sections[0]['title']}\n{_truncate(kb_sections[0].get('text', ''), 400)}"
            )

    def_lines: list[str] = []
    for row in definitions[:40]:
        def_lines.append(
            f"- {row.database_name}.{row.table_name}.{row.column_name}: "
            f"classification={row.data_classification or 'n/a'}, "
            f"approval={row.approval_status}, "
            f"glossary={row.glossary_term or 'n/a'}, "
            f"definition={_truncate(row.definition, 120)}"
        )
    if len(definitions) > 40:
        def_lines.append(f"... and {len(definitions) - 40} more field definitions")

    rule_lines: list[str] = []
    for row in rules[:30]:
        rule_lines.append(
            f"- {row.database_name}.{row.table_name}.{row.column_name}: "
            f"{row.rule_name} ({row.rule_type}) status={row.status}, threshold={row.threshold}"
        )
    if len(rules) > 30:
        rule_lines.append(f"... and {len(rules) - 30} more quality rules")

    trust_lines: list[str] = []
    for row in trust_rows:
        scores, _ = normalize_breakdown(row.breakdown or {})
        dim_summary = ", ".join(f"{k}={v}" for k, v in scores.items()) if scores else "n/a"
        trust_lines.append(
            f"- {row.database_name}.{row.table_name}: overall={row.overall_score}%, "
            f"status={row.status}, steward={row.steward_assigned or 'Unassigned'}, "
            f"principles=[{dim_summary}]"
        )

    principles = load_principles(session)
    readiness_config = load_readiness_config(session)
    principle_lines = [
        f"- {p['name']} (weight={p.get('weight', 25)}, enabled={p.get('enabled', True)}, "
        f"type={p.get('rule_type')}): {p.get('description', '')}"
        for p in principles
    ]

    parts = [
        "PLATFORM ROLE:",
        "AI-Assisted Data Governance is a governance assistant. It suggests definitions, DQ rules, and lineage.",
        "It does NOT run SQL, profile data, or execute quality checks.",
        "",
        "PRODUCT GUIDE (use for questions about AI-Assisted Data Governance buttons, modes, and pages):",
        PLATFORM_GUIDE.strip(),
        "",
        readiness_config.get("readiness_note", READINESS_NOTE),
        "",
        f"FIELD DEFINITIONS ({len(definitions)} total):",
        *(def_lines or ["- None saved yet — analyze metadata first."]),
        "",
        f"DATA QUALITY RULES ({len(rules)} total, suggested specs only):",
        *(rule_lines or ["- None suggested yet."]),
        "",
        f"GOVERNANCE READINESS SCORES ({len(trust_rows)} tables):",
        *(trust_lines or ["- None computed yet — persist definitions to generate scores."]),
        "",
        "GOVERNING PRINCIPLES (configurable readiness dimensions):",
        *(principle_lines or ["- Default principles not loaded yet."]),
        "",
        "KNOWLEDGE BASE EXCERPTS:",
        *(kb_hits or ["- No matching policy sections."]),
    ]
    context = "\n".join(parts)
    if len(context) > MAX_CONTEXT_CHARS:
        context = context[: MAX_CONTEXT_CHARS - 20] + "\n... [truncated]"
    return context


def _heuristic_answer(question: str, context: str) -> tuple[str, list[str]]:
    """Offline fallback when LLM is unavailable."""
    q = question.lower()
    sources: list[str] = []

    if any(w in q for w in ["trust", "readiness", "score", "principle"]):
        sources.append("Governance readiness scores")
        return (
            "Governance readiness scores are weighted against your configurable governing principles — "
            "approved definitions, steward-validated DQ rules, glossary links, ownership, and more. "
            "Open Governance Readiness → Governing principles to add, weight, or disable principles. "
            "They measure steward workflow in this assistant, not warehouse profiling.",
            sources,
        )

    if any(w in q for w in ["quality", "dq", "rule"]):
        sources.append("Data quality rules")
        return (
            "Data quality rules here are suggested specifications for your enterprise DQ tools "
            "(Informatica, Great Expectations, Monte Carlo, etc.). "
            "The assistant proposes rules from column names and classifications; stewards review "
            "and set status to Passed/Warning/Failed — nothing runs against live data in this app.",
            sources,
        )

    if any(w in q for w in ["lineage", "upstream", "downstream", "flow"]):
        sources.append("Lineage graph")
        return (
            "Lineage is built from saved field definitions and optional natural-language policies "
            "that stitch columns to reports or related tables. "
            "Open the Lineage page to explore database → table → column → report paths.",
            sources,
        )

    if any(w in q for w in ["approve", "steward", "review", "pending"]):
        sources.append("Steward review workflow")
        return (
            "After Analyze columns, definitions start as pending_review. "
            "Stewards approve or reject on the Steward Review page — that drives readiness scores "
            "and Collibra export eligibility.",
            sources,
        )

    if any(w in q for w in ["pii", "confidential", "restricted", "classification", "mask"]):
        sources.append("Knowledge base policies")
        return (
            "Classification and masking guidance comes from the knowledge base and RAG retrieval "
            "during semantic mapping. Edit policies on the Knowledge Base page or ask in natural "
            "language to update sections.",
            sources,
        )

    if any(w in q for w in ["export", "collibra", "catalog"]):
        sources.append("Catalog export")
        return (
            "Approved definitions can be exported as Collibra-compatible CSV from the Export page. "
            "Filter by approval_status=approved for publication-ready assets.",
            sources,
        )

    product = try_answer_product_question(question)
    if product:
        return product

    sources.append("Platform overview")
    return (
        "I can help with governance readiness, suggested DQ rules, lineage, steward approvals, "
        "knowledge base policies, and catalog export. "
        "This assistant drafts and tracks governance work — it does not measure live data. "
        "Try asking: 'Why is my readiness score low?' or 'What do suggested DQ rules mean?'",
        sources,
    )


def _build_chat_prompt(context: str, question: str, history: list[dict[str, str]]) -> str:
    history_lines: list[str] = []
    for turn in history[-6:]:
        role = turn.get("role", "user")
        content = str(turn.get("content", "")).strip()
        if content:
            history_lines.append(f"{role.upper()}: {content}")

    history_block = "\n".join(history_lines) if history_lines else "(no prior turns)"

    return f"""You are AI-Assisted Data Governance, a data governance assistant with strict anti-hallucination rules.

RULES (violations are not allowed):
- Use ONLY facts from GOVERNANCE CONTEXT below. Never invent table names, scores, stewards, policies, or metrics.
- For questions about AI-Assisted Data Governance UI features (Quick draft, Full AI draft, Analyze columns, etc.), use PRODUCT GUIDE in context — confidence "high".
- If the context does not contain enough information about catalog data or product features, set confidence to "unknown" and refuse to guess.
- Do NOT answer questions about unrelated topics (coding, weather, HR policy outside data governance, etc.).
- DQ rules are suggested specs only — never claim they ran on data.
- Readiness scores reflect steward workflow in the app, not warehouse profiling.

Return ONLY valid JSON (no markdown):
{{
  "confidence": "high|low|unknown",
  "answer": "2-5 sentences, plain language. If unknown, explain what is missing and suggest Analyze columns or Steward Review."
}}

confidence guide:
- high: fully supported by context
- low: partial context, general guidance only
- unknown: cannot answer without guessing

GOVERNANCE CONTEXT:
{context}

CONVERSATION:
{history_block}

USER QUESTION:
{question.strip()}
"""


def _finalize_response(
    session: Session,
    question: str,
    *,
    answer: str,
    sources: list[str],
    mode: str,
    context: str,
    llm_confidence: str | None = None,
    from_product_guide: bool = False,
) -> dict[str, Any]:
    confidence, offer_help_desk, guardrail_note = assess_confidence(
        question,
        session,
        answer=answer,
        llm_confidence=llm_confidence,
        from_product_guide=from_product_guide,
    )

    if confidence == "unknown" and not from_product_guide:
        answer = UNKNOWN_ANSWER_TEMPLATE
        offer_help_desk = True

    return {
        "answer": answer,
        "sources": sources,
        "mode": mode,
        "confidence": confidence,
        "offer_help_desk": offer_help_desk,
        "guardrail_note": guardrail_note or GUARDRAIL_DISCLAIMER,
        "context_preview": _truncate(context, 500),
    }


def answer_governance_question(
    session: Session,
    question: str,
    *,
    history: list[dict[str, str]] | None = None,
    provider: str = "ollama",
    model: str = "gemma4:e2b",
    base_url: str = "http://localhost:11434",
    no_llm: bool = False,
) -> dict[str, Any]:
    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    history = history or []
    context = build_governance_context(session, question)

    product = try_answer_product_question(question)
    if product:
        answer, source = product
        return _finalize_response(
            session,
            question,
            answer=answer,
            sources=[source],
            mode="product_guide",
            context=context,
            llm_confidence="high",
            from_product_guide=True,
        )

    if not is_governance_topic(question):
        return _finalize_response(
            session,
            question,
            answer=UNKNOWN_ANSWER_TEMPLATE,
            sources=["Guardrail: out of scope"],
            mode="guardrail",
            context=context,
            llm_confidence="unknown",
        )

    if no_llm:
        answer, sources = _heuristic_answer(question, context)
        return _finalize_response(
            session,
            question,
            answer=answer,
            sources=sources,
            mode="heuristic",
            context=context,
            llm_confidence="high",
        )

    if provider != "ollama":
        raise HTTPException(status_code=400, detail="Assistant chat currently supports provider=ollama")

    prompt = _build_chat_prompt(context, question, history)
    try:
        raw = call_ollama(prompt, model=model, base_url=base_url).strip()
        if not raw:
            raise ValueError("Empty LLM response")
        try:
            parsed = parse_json_response(raw)
            answer = str(parsed.get("answer", "")).strip()
            llm_confidence = str(parsed.get("confidence", "low")).strip().lower()
            if llm_confidence not in {"high", "low", "unknown"}:
                llm_confidence = "low"
            if not answer:
                raise ValueError("Empty answer in JSON")
        except Exception:
            answer = raw
            llm_confidence = "low"
        return _finalize_response(
            session,
            question,
            answer=answer,
            sources=["Governance catalog snapshot", "Knowledge base"],
            mode="llm",
            context=context,
            llm_confidence=llm_confidence,
        )
    except Exception as exc:
        answer, sources = _heuristic_answer(question, context)
        result = _finalize_response(
            session,
            question,
            answer=f"{answer}\n\n_(LLM unavailable: {exc}. Showing offline guidance.)_",
            sources=sources,
            mode="heuristic_fallback",
            context=context,
            llm_confidence="low",
        )
        return result
