"""Trust scores service — computed from governing principles and catalog state."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from db.models import TrustScore
from services.governance_principles import (
    DEFAULT_READINESS_NOTE,
    load_principles,
    load_readiness_config,
    normalize_breakdown,
)

# Legacy aliases for chat and docs
READINESS_NOTE = DEFAULT_READINESS_NOTE

LEGACY_DIMENSION_LABELS = {
    "completeness": "Approved definitions",
    "accuracy": "DQ rules stewarded",
    "freshness": "Recent steward activity",
    "schema_consistency": "Steward approvals",
}

DIMENSION_LABELS = LEGACY_DIMENSION_LABELS


def _build_dimension_labels(session: Session) -> dict[str, str]:
    principles = load_principles(session)
    if principles:
        return {p["id"]: p["name"] for p in principles if p.get("enabled", True)}
    return LEGACY_DIMENSION_LABELS


def get_trust_scores(
    session: Session,
    *,
    database_name: str | None = None,
    table_name: str | None = None,
) -> list[dict[str, Any]]:
    query = session.query(TrustScore).order_by(
        TrustScore.database_name,
        TrustScore.table_name,
    )
    if database_name:
        query = query.filter(TrustScore.database_name == database_name)
    if table_name:
        query = query.filter(TrustScore.table_name == table_name)
    config = load_readiness_config(session)
    labels = _build_dimension_labels(session)
    return [
        trust_score_to_dict(row, dimension_labels=labels, readiness_note=config["readiness_note"])
        for row in query.all()
    ]


def trust_score_to_dict(
    row: TrustScore,
    *,
    dimension_labels: dict[str, str] | None = None,
    readiness_note: str | None = None,
) -> dict[str, Any]:
    breakdown = row.breakdown or {}
    scores, reasoning = normalize_breakdown(breakdown)

    # Flatten for API consumers: scores at top level of breakdown + reasoning sibling
    flat_breakdown: dict[str, Any] = {**scores}
    if reasoning:
        flat_breakdown["reasoning"] = reasoning

    return {
        "id": row.id,
        "database_name": row.database_name,
        "table_name": row.table_name,
        "overall_score": row.overall_score,
        "breakdown": flat_breakdown,
        "scores": scores,
        "dimension_labels": dimension_labels or LEGACY_DIMENSION_LABELS,
        "reasoning": reasoning,
        "readiness_note": readiness_note or DEFAULT_READINESS_NOTE,
        "score_type": "governance_readiness",
        "status": row.status,
        "steward_assigned": row.steward_assigned,
        "last_profiled": row.last_profiled.isoformat() if row.last_profiled else "",
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }
