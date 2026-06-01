"""Data quality rules service — auto-suggested and persisted rules."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models import QualityRule
from services.platform_sync import recompute_trust_score


def get_quality_rules(
    session: Session,
    *,
    database_name: str | None = None,
    table_name: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    query = session.query(QualityRule).order_by(
        QualityRule.database_name,
        QualityRule.table_name,
        QualityRule.column_name,
        QualityRule.rule_name,
    )
    if database_name:
        query = query.filter(QualityRule.database_name == database_name)
    if table_name:
        query = query.filter(QualityRule.table_name == table_name)
    if status:
        query = query.filter(QualityRule.status == status)
    return [quality_rule_to_dict(row) for row in query.all()]


def update_quality_rule_status(
    session: Session,
    rule_id: str,
    *,
    status: str,
    failure_count: int | None = None,
) -> dict[str, Any]:
    row = session.get(QualityRule, rule_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Quality rule not found: {rule_id}")

    row.status = status
    if failure_count is not None:
        row.failure_count = failure_count
    row.last_checked = datetime.now(timezone.utc)
    session.flush()
    recompute_trust_score(session, row.database_name, row.table_name)
    session.commit()
    session.refresh(row)
    return quality_rule_to_dict(row)


def quality_rule_to_dict(row: QualityRule) -> dict[str, Any]:
    return {
        "id": row.id,
        "database_name": row.database_name,
        "table_name": row.table_name,
        "column_name": row.column_name,
        "field_definition_id": row.field_definition_id,
        "rule_name": row.rule_name,
        "type": row.rule_type,
        "description": row.description,
        "threshold": row.threshold,
        "status": row.status,
        "failure_count": row.failure_count,
        "source": row.source,
        "last_checked": row.last_checked.isoformat() if row.last_checked else "",
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }
