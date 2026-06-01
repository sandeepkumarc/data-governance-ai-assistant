"""Data quality rules routes."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.session import get_db
from services.quality import get_quality_rules, update_quality_rule_status

router = APIRouter(tags=["Data Quality"])


class QualityRuleStatusPayload(BaseModel):
    status: Literal["Suggested", "Passed", "Warning", "Failed"]
    failure_count: int | None = None


@router.get("/api/quality-rules")
async def quality_rules(
    database_name: str | None = Query(None),
    table_name: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve validation rules auto-suggested from semantic mapping results."""
    return get_quality_rules(
        db,
        database_name=database_name,
        table_name=table_name,
        status=status,
    )


@router.patch("/api/quality-rules/{rule_id}/status")
async def update_rule_status(
    rule_id: str,
    payload: QualityRuleStatusPayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update a quality rule evaluation status and recompute table trust scores."""
    return update_quality_rule_status(
        db,
        rule_id,
        status=payload.status,
        failure_count=payload.failure_count,
    )
