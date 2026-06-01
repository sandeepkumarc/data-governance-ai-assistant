"""Audit log routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db.session import get_db
from services.audit import list_audit_logs

router = APIRouter(tags=["Audit"])


@router.get("/api/audit-log")
async def audit_log(
    action: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List audit entries for analysis runs and steward approvals."""
    return list_audit_logs(db, action=action, limit=limit)
