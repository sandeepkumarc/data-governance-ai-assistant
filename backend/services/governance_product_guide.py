"""Built-in AI-Assisted Data Governance product help — answers about the app itself (not warehouse data)."""

from __future__ import annotations

import re

# Authoritative in-app feature documentation (does not require catalog data).
PLATFORM_GUIDE = """
## Analyze columns page
- **Quick draft (no LLM)** / RAG-only / no_llm: Uses the governance knowledge base + TF-IDF or vector retrieval + rule-based heuristics to draft field definitions and classifications. Does NOT call Ollama. Fast, works offline, ideal for fast analysis and air-gapped environments. API flag: no_llm=true, retrieval_mode tfidf or vector.
- **Full AI draft (Ollama)**: Same RAG context, then a local LLM (default gemma4:e2b) writes richer glossary text and definitions. Requires Ollama running. API flag: no_llm=false.
- **Standard search (tfidf)**: Token similarity retrieval against knowledge base sections.
- **Semantic search (vector)**: Embedding-based retrieval via Ollama embeddings.
- **Mask sensitive sample values**: Masks emails, SSNs, tokens, etc. in CSV sample_values before retrieval and prompting.
- **Save for lineage & trust scores** / persist: Writes definitions to the database and triggers lineage nodes, suggested DQ rules, and governance readiness scores.

## Other pages
- **Steward Review**: Approve/reject definitions (pending_review → approved). Drives readiness scores and export.
- **Governance Readiness**: Weighted score per table against configurable **governing principles** (SQLite `governance_principles`, seed `governance_principles.default.json`). Add/weight/enable principles on the page; NL authoring supported. NOT warehouse data profiling.
- **Data Maturity**: Gartner D&A maturity curve with spider/radar chart by data domain (`/data-maturity`). Sources: **local catalog**, **Collibra DGC assets** (sync all assets via REST), or **blended**. Configurable domain labels and pillar weights. Dashboard widget shows enterprise radar.
- **Data Quality**: Suggested DQ rule specs for external tools; statuses are steward labels only.
- **Lineage**: Database → table → column → report graph from saved metadata + NL policies.
- **Knowledge Base**: Policy sections used by RAG during analyze.
- **Ask assistant** (chat): Answers from saved catalog + this product guide; escalates to help desk when not grounded.
- **Offline mode**: Browser-only sample data, no backend required.
- **Platform tour**: Guided walkthrough of capabilities.
"""

_PRODUCT_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(
            r"quick\s*draft|no\s*llm|rag\s*only|rag-only|without\s*llm|no\s*ollama",
            re.I,
        ),
        "quick_draft",
    ),
    (
        re.compile(
            r"full\s*ai\s*draft|with\s*ollama|ollama\s*draft|use\s*llm|full\s*ai",
            re.I,
        ),
        "full_ai_draft",
    ),
    (
        re.compile(r"standard\s*search|tfidf|token\s*search", re.I),
        "tfidf_retrieval",
    ),
    (
        re.compile(r"semantic\s*search|vector\s*retrieval|vector\s*search", re.I),
        "vector_retrieval",
    ),
    (
        re.compile(r"mask\s*sample|masking\s*sample|sensitive\s*sample", re.I),
        "mask_samples",
    ),
    (
        re.compile(
            r"save\s*for\s*lineage|persist|save\s*to\s*database|trust\s*scores?\s*after",
            re.I,
        ),
        "persist",
    ),
    (
        re.compile(r"offline\\s*mode|offline\\s*workspace", re.I),
        "offline_mode",
    ),
    (
        re.compile(r"help\s*desk|escalat", re.I),
        "help_desk",
    ),
    (
        re.compile(r"ask\s*assistant|governance\s*assistant|this\s*chat", re.I),
        "assistant_chat",
    ),
]

_ANSWERS: dict[str, str] = {
    "quick_draft": (
        "Quick draft (no LLM) on the Analyze columns page runs RAG-only: it retrieves "
        "matching sections from your governance knowledge base and uses built-in heuristics "
        "to draft definitions, classifications, and governance actions — without calling Ollama. "
        "It is faster, works when Ollama is offline, and is ideal for fast analysis. Choose Full AI draft "
        "when you want a local LLM to write richer prose on top of the same retrieved policies."
    ),
    "full_ai_draft": (
        "Full AI draft (Ollama) uses the same knowledge-base retrieval as Quick draft, then sends "
        "field metadata and policy context to your local Ollama model (e.g. gemma4:e2b) for richer "
        "glossary and definition text. Requires Ollama running at the URL configured in the backend."
    ),
    "tfidf_retrieval": (
        "Standard search (TF-IDF) matches column names and notes to knowledge base sections using "
        "token similarity. It is the default, fast, and does not need embedding models."
    ),
    "vector_retrieval": (
        "Semantic search (vector) embeds the field context and knowledge chunks with Ollama "
        "embeddings for similarity matching. Useful when column names are messy or abbreviations "
        "differ from policy wording."
    ),
    "mask_samples": (
        "Mask sensitive sample values replaces emails, SSN-like patterns, tokens, and similar "
        "values in your CSV before retrieval and any LLM prompt — so sample data is not sent in clear text."
    ),
    "persist": (
        "Save for lineage & trust scores (persist) stores analyzed definitions in the database, "
        "builds lineage nodes, suggests DQ rules, and computes governance readiness scores. "
        "Turn this on when you want downstream pages populated, not just a one-off preview."
    ),
    "offline_mode": (
        "Offline mode uses built-in sample data in the browser when the API is unavailable. "
        "Use it for presentations; connect the backend for real persistence and catalog-aware answers."
    ),
    "help_desk": (
        "The governance help desk captures questions the assistant cannot answer safely from your "
        "catalog. Users submit from Ask assistant; experts review tickets on the Help Desk page "
        "(sidebar → Help Desk, route /help-desk). Tickets are stored in the database; audit action: help_desk_submit."
    ),
    "assistant_chat": (
        "Ask assistant is a catalog-grounded chat on every page after login. It uses your saved "
        "definitions, DQ rules, readiness scores, and knowledge base — plus built-in product help "
        "for AI-Assisted Data Governance features. It will not guess about warehouse data or unknown tables."
    ),
}


def is_product_ui_question(question: str) -> bool:
    q = question.lower()
    if any(
        token in q
        for token in (
            "quick draft",
            "no llm",
            "full ai draft",
            "ollama",
            "analyze column",
            "generation mode",
            "retrieval",
            "mask sample",
            "offline mode",
            "platform tour",
            "help desk",
            "ask assistant",
            "what is the purpose",
            "what does",
            "how do i",
            "how to use",
            "feature",
            "button",
            "checkbox",
            "govassist",
            "this app",
            "this tool",
            "this page",
        )
    ):
        return True
    return any(pattern.search(question) for pattern, _ in _PRODUCT_PATTERNS)


def try_answer_product_question(question: str) -> tuple[str, str] | None:
    """Return (answer, source_label) for known product/UI questions."""
    for pattern, key in _PRODUCT_PATTERNS:
        if pattern.search(question):
            return _ANSWERS[key], "AI-Assisted Data Governance product guide"
    q = question.lower()
    if is_product_ui_question(question) and any(
        w in q for w in ("purpose", "what is", "what does", "explain", "mean", "do")
    ):
        if "analyze" in q or "draft" in q or "llm" in q or "column" in q:
            return _ANSWERS["quick_draft"], "AI-Assisted Data Governance product guide"
    return None
