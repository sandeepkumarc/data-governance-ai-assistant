"""Scope and grounding checks for the governance assistant."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from db.models import FieldDefinition, QualityRule, TrustScore

GOVERNANCE_TOPIC_TERMS = {
    "governance",
    "readiness",
    "trust",
    "score",
    "quality",
    "dq",
    "rule",
    "lineage",
    "steward",
    "approve",
    "approval",
    "definition",
    "catalog",
    "collibra",
    "export",
    "classification",
    "pii",
    "policy",
    "knowledge",
    "analyze",
    "semantic",
    "mapping",
    "ownership",
    "mask",
    "glossary",
    "column",
    "table",
    "database",
    "metadata",
    "suggested",
    "pending",
    "platform",
    "govern",
    "govassist",
    "quick draft",
    "no llm",
    "ollama",
    "rag",
    "tfidf",
    "vector",
    "offline",
    "offline_mode",
    "purpose",
    "feature",
    "help desk",
    "assistant",
    "persist",
    "draft",
    "llm",
}

OUT_OF_SCOPE_TERMS = {
    "weather",
    "stock price",
    "bitcoin",
    "recipe",
    "python code",
    "write code",
    "kubernetes",
    "terraform",
    "joke",
    "poem",
    "sports",
    "movie",
    "celebrity",
    "medical advice",
    "legal advice",
    "salary of ceo",
    "hire engineer",
}

HEDGE_PHRASES = (
    "i don't know",
    "i do not know",
    "not sure",
    "cannot find",
    "can't find",
    "no information",
    "not in the context",
    "not in context",
    "not present in",
    "unable to determine",
    "outside my",
    "beyond the",
    "insufficient context",
    "not enough context",
    "cannot confirm",
    "can't confirm",
    "may not be",
    "might not be",
    "i'm not certain",
    "i am not certain",
)

ENTITY_RE = re.compile(r"\b([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)(?:\.([a-z][a-z0-9_]*))?\b", re.I)


def is_governance_topic(question: str) -> bool:
    from services.governance_product_guide import is_product_ui_question

    q = question.lower()
    if any(term in q for term in OUT_OF_SCOPE_TERMS):
        return False
    if is_product_ui_question(question):
        return True
    return any(term in q for term in GOVERNANCE_TOPIC_TERMS)


def catalog_has_data(session: Session) -> bool:
    if session.query(FieldDefinition.id).limit(1).first():
        return True
    if session.query(QualityRule.id).limit(1).first():
        return True
    if session.query(TrustScore.id).limit(1).first():
        return True
    return False


def _known_assets(session: Session) -> set[str]:
    assets: set[str] = set()
    for row in session.query(
        FieldDefinition.database_name,
        FieldDefinition.table_name,
        FieldDefinition.column_name,
    ).all():
        assets.add(f"{row.database_name}.{row.table_name}".lower())
        assets.add(
            f"{row.database_name}.{row.table_name}.{row.column_name}".lower()
        )
        assets.add(row.database_name.lower())
        assets.add(row.table_name.lower())
    for row in session.query(TrustScore.database_name, TrustScore.table_name).all():
        assets.add(f"{row.database_name}.{row.table_name}".lower())
    return assets


def question_references_unknown_assets(question: str, session: Session) -> bool:
    """True when the user names db.table assets not in the saved catalog."""
    if not catalog_has_data(session):
        return False
    known = _known_assets(session)
    for match in ENTITY_RE.finditer(question):
        db, table, col = match.group(1), match.group(2), match.group(3)
        refs = {f"{db}.{table}".lower()}
        if col:
            refs.add(f"{db}.{table}.{col}".lower())
        if refs.isdisjoint(known):
            return True
    return False


def assess_confidence(
    question: str,
    session: Session,
    *,
    answer: str,
    llm_confidence: str | None = None,
    from_product_guide: bool = False,
) -> tuple[str, bool, str]:
    """
    Returns (confidence, offer_help_desk, guardrail_note).
    confidence: high | low | unknown
    """
    if from_product_guide:
        return "high", False, ""

    if not is_governance_topic(question):
        return (
            "unknown",
            True,
            "This question is outside AI-Assisted Data Governance's data governance scope.",
        )

    if question_references_unknown_assets(question, session):
        return (
            "unknown",
            True,
            "Your question references tables or columns that are not in the saved catalog.",
        )

    if not catalog_has_data(session) and any(
        token in question.lower()
        for token in ("customer_db", "finance_db", "hr_db", "my table", "our table", "this table")
    ):
        return (
            "unknown",
            True,
            "No catalog data is saved yet — analyze and persist metadata before asking about specific assets.",
        )

    answer_lower = answer.lower()
    if any(phrase in answer_lower for phrase in HEDGE_PHRASES):
        return (
            "low",
            True,
            "The assistant could not ground this answer in your catalog with high confidence.",
        )

    if llm_confidence in {"unknown", "low"}:
        return (
            llm_confidence,
            True,
            "The model reported limited grounding in your governance context.",
        )

    if llm_confidence == "high":
        return "high", False, ""

    # Heuristic answers without explicit LLM confidence are medium-trust
    return "high", False, ""
