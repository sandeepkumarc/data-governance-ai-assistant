"""Trust scores service — computed from definitions and quality rule outcomes."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from db.models import TrustScore


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
    return [trust_score_to_dict(row) for row in query.all()]


def trust_score_to_dict(row: TrustScore) -> dict[str, Any]:
    return {
        "id": row.id,
        "database_name": row.database_name,
        "table_name": row.table_name,
        "overall_score": row.overall_score,
        "breakdown": row.breakdown or {},
        "status": row.status,
        "steward_assigned": row.steward_assigned,
        "last_profiled": row.last_profiled.isoformat() if row.last_profiled else "",
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }
