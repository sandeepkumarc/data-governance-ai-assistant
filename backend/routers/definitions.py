"""Field definition routes — list, retrieve, and steward approval."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db.session import get_db
from models.schemas import ApprovalPayload
from services.definitions import get_definition, list_definitions, update_approval

router = APIRouter(tags=["Definitions"])


@router.get("/api/definitions")
async def definitions(
    database_name: str | None = Query(None),
    table_name: str | None = Query(None),
    approval_status: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List persisted field definitions with optional filters."""
    return list_definitions(
        db,
        database_name=database_name,
        table_name=table_name,
        approval_status=approval_status,
    )


@router.get("/api/definitions/{definition_id}")
async def definition_by_id(
    definition_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve a single persisted field definition."""
    return get_definition(db, definition_id)


@router.patch("/api/definitions/{definition_id}/approve")
async def approve_definition(
    definition_id: str,
    payload: ApprovalPayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update steward approval status and comments for a field definition."""
    return update_approval(
        db,
        definition_id,
        approval_status=payload.approval_status,
        steward_comment=payload.steward_comment,
        approved_by=payload.approved_by,
    )
