"""Generate sample probe fields and verify knowledge-base retrieval for a section."""

from __future__ import annotations

import re
from typing import Any

from config import KNOWLEDGE_BASE_PATH
from rag_governance import (
    FieldMetadata,
    KnowledgeChunk,
    analyze_field,
    build_tfidf_index,
    read_knowledge_base_cached,
    retrieve_context_tfidf_scored,
)


_COLUMN_TOKEN = re.compile(
    r"\b(?:[a-z]{2,12}_[a-z0-9_]+|mrn|dob|ssn|npi|ndc|uid)\b",
    re.IGNORECASE,
)
_BACKTICK_TOKEN = re.compile(r"`([a-z][a-z0-9_]*)`", re.IGNORECASE)

_TITLE_PROBE_COLUMNS: list[tuple[tuple[str, ...], str]] = [
    (("contact", "email", "mail"), "email_address"),
    (("phone", "mobile", "telephone"), "phone_number"),
    (("financial", "payment", "salary", "compensation"), "payment_amount"),
    (("health", "phi", "hipaa", "clinical", "patient"), "patient_id"),
    (("identifier", "direct"), "customer_id"),
    (("workflow", "status"), "record_status"),
    (("security", "credential", "auth"), "access_token"),
    (("comment", "note", "free text"), "customer_comment"),
]

_SAMPLE_VALUES: list[tuple[tuple[str, ...], list[str]]] = [
    (("email", "mail"), ["alex@example.com", "sam@company.com"]),
    (("phone", "mobile", "tel"), ["555-0101", "555-0102"]),
    (("dob", "birth", "date_of_birth"), ["1988-03-15", "1974-11-02"]),
    (("salary", "amount", "balance", "payment"), ["95000.00", "1250.50"]),
    (("token", "secret", "api_key"), ["tok_abc123", "tok_def456"]),
    (("status", "state", "stage"), ["active", "pending"]),
    (("mrn",), ["MRN-104928", "MRN-220011"]),
    (("patient",), ["PT-8842", "PT-9931"]),
    (("icd", "diagnosis", "dx"), ["E11.9", "I10"]),
    (("member", "subscriber"), ["SUB-440192", "SUB-881002"]),
    (("comment", "note", "feedback"), ["Please call back", "Card declined"]),
]

_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "must",
    "should",
    "when",
    "used",
    "classify",
    "restricted",
    "confidential",
    "internal",
    "section",
    "fields",
    "field",
    "columns",
    "column",
    "data",
    "governance",
    "guidance",
}


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug[:48] or "policy_probe"


def _infer_data_type(column_name: str, samples: list[str]) -> str:
    if samples and all(re.match(r"^\d{4}-\d{2}-\d{2}$", sample) for sample in samples):
        return "date"
    if samples and all(re.match(r"^-?\d+(\.\d+)?$", sample.replace(",", "")) for sample in samples):
        return "decimal" if any("." in sample for sample in samples) else "integer"
    return "string"


def _sample_values_for(column_name: str) -> list[str]:
    lowered = column_name.lower()
    for needles, values in _SAMPLE_VALUES:
        if any(needle in lowered for needle in needles):
            return values
    if lowered.endswith("_id") or lowered == "id":
        return ["ID-1001", "ID-1002"]
    return ["sample_alpha", "sample_beta"]


def _probe_from_title(title: str) -> str | None:
    title_lower = title.lower()
    for keywords, column in _TITLE_PROBE_COLUMNS:
        if any(keyword in title_lower for keyword in keywords):
            return column
    return None


def extract_probe_columns(title: str, text: str) -> list[str]:
    """Pull likely column names from policy text and section title."""
    found: list[str] = []
    seen: set[str] = set()

    def add(token: str) -> None:
        token = token.strip().lower()
        if not token or token in _STOPWORDS or len(token) < 2:
            return
        if token not in seen:
            seen.add(token)
            found.append(token)

    for match in _BACKTICK_TOKEN.finditer(text):
        add(match.group(1))

    for line in text.splitlines():
        if "→" in line or "->" in line:
            left = re.split(r"→|->", line, maxsplit=1)[0]
            for token in re.findall(r"[`'\"]?([a-z][a-z0-9_]+)[`'\"]?", left, flags=re.IGNORECASE):
                add(token)
            continue
        for token in _COLUMN_TOKEN.findall(line):
            add(token)

    title_probe = _probe_from_title(title)
    if title_probe:
        add(title_probe)

    if not found:
        add("policy_probe_field")
    return found[:3]


def build_probe_field(title: str, text: str, column_name: str | None = None) -> FieldMetadata:
    column = column_name or extract_probe_columns(title, text)[0]
    table_slug = _slug(title)
    samples = _sample_values_for(column)
    return FieldMetadata(
        database_name="policy_test_db",
        table_name=f"policy_test_{table_slug}",
        column_name=column,
        data_type=_infer_data_type(column, samples),
        sample_values=samples,
        notes=f"Auto-generated probe for knowledge section: {title}",
    )


def build_sample_csv(field: FieldMetadata) -> str:
    header = field.column_name
    row = "|".join(field.sample_values[:3])
    return f"{header}\n{row}"


def _chunks_for_verification(title: str, text: str) -> list[KnowledgeChunk]:
    """Use on-disk KB plus the draft section body so tests work before/after save."""
    chunks = list(read_knowledge_base_cached(KNOWLEDGE_BASE_PATH))
    chunks = [chunk for chunk in chunks if chunk.title != title]
    if text.strip():
        chunks.append(KnowledgeChunk(title=title, text=f"## {title}\n{text.strip()}"))
    return chunks


def verify_knowledge_section(
    title: str,
    text: str = "",
    *,
    retrieval_mode: str = "tfidf",
    top_k: int = 8,
) -> dict[str, Any]:
    """Run a retrieval + quick-draft probe to confirm a section is retrieved for sample data."""
    title = title.strip()
    if not title:
        raise ValueError("Section title is required")

    probe_columns = extract_probe_columns(title, text)
    probes = [build_probe_field(title, text, column) for column in probe_columns]
    primary = probes[0]

    chunks = _chunks_for_verification(title, text)
    tfidf_index = build_tfidf_index(chunks)
    scored = retrieve_context_tfidf_scored(primary, top_k=top_k, tfidf_index=tfidf_index)
    retrieved_sections = [chunk.title for chunk, _ in scored]
    target_hits = [
        {"section": chunk.title, "relevance_score": round(float(score), 4)}
        for chunk, score in scored
        if chunk.title == title
    ]
    target_rank = next(
        (index + 1 for index, (chunk, _) in enumerate(scored) if chunk.title == title),
        None,
    )

    analysis = analyze_field(
        field=primary,
        chunks=chunks,
        provider="ollama",
        model="gemma4:e2b",
        base_url="http://localhost:11434",
        no_llm=True,
        retrieval_mode=retrieval_mode,
        tfidf_index=tfidf_index,
    )
    cited_sections = [
        str(item.get("section", ""))
        for item in analysis.get("policy_citations", [])
        if isinstance(item, dict)
    ]
    passed = title in cited_sections
    target_score = float(target_hits[0]["relevance_score"]) if target_hits else 0.0

    if passed and target_rank == 1 and target_score >= 0.05:
        confidence = min(98, 85 + int(target_score * 40))
    elif passed and target_rank is not None and target_rank <= 3:
        confidence = min(84, 65 + int(target_score * 30))
    elif passed:
        confidence = min(74, 55 + int(target_score * 20))
    elif title in retrieved_sections:
        confidence = max(25, 40 - (target_rank or top_k) * 3)
    else:
        confidence = 10

    recommendations: list[str] = []
    if not passed:
        recommendations.append(
            "Add explicit column aliases (e.g. cust_nbr → Customer Identifier) using the column names you expect in CSV uploads."
        )
        recommendations.append(
            "Repeat key terms from this section title in the policy body so TF-IDF retrieval can match sample fields."
        )
    if probe_columns == ["policy_probe_field"]:
        recommendations.append(
            "No column-like tokens were detected — include examples such as `cust_nbr` or member_id in the section text."
        )

    return {
        "passed": passed,
        "confidence": confidence,
        "target_section": title,
        "target_rank": target_rank,
        "target_relevance_score": target_score if target_hits else None,
        "retrieved_sections": retrieved_sections,
        "cited_sections": cited_sections,
        "probe_columns": probe_columns,
        "test_case": {
            "database_name": primary.database_name,
            "table_name": primary.table_name,
            "column_name": primary.column_name,
            "data_type": primary.data_type,
            "sample_values": primary.sample_values,
            "notes": primary.notes,
            "sample_csv": build_sample_csv(primary),
            "csv_filename": f"{primary.table_name}.csv",
        },
        "analysis_preview": {
            "glossary_term": analysis.get("glossary_term", ""),
            "definition": analysis.get("definition", ""),
            "data_classification": analysis.get("data_classification", ""),
            "sensitivity": analysis.get("sensitivity", ""),
            "decision_rationale": analysis.get("decision_rationale", ""),
        },
        "recommendations": recommendations,
        "retrieval_mode": retrieval_mode,
    }
