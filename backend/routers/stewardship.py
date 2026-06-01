"""Ownership and stewardship routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.models import StewardAssignment
from db.session import get_db
from models.schemas import StewardAssignmentInput
from services.stewardship import assignment_to_dict, get_ownership

router = APIRouter(tags=["Stewardship"])


@router.get("/api/ownership")
async def ownership(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Retrieve database columns business ownership and steward assignments."""
    return get_ownership(db)


@router.post("/api/ownership")
async def create_ownership(
    payload: StewardAssignmentInput,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Create or update a steward assignment for a column."""
    row = (
        db.query(StewardAssignment)
        .filter_by(
            database_name=payload.database_name,
            table_name=payload.table_name,
            column_name=payload.column_name,
        )
        .one_or_none()
    )
    if row is None:
        row = StewardAssignment(
            database_name=payload.database_name,
            table_name=payload.table_name,
            column_name=payload.column_name,
        )
        db.add(row)

    row.business_owner = payload.business_owner
    row.business_owner_email = payload.business_owner_email
    row.data_steward = payload.data_steward
    row.data_steward_email = payload.data_steward_email
    row.lifecycle_status = payload.lifecycle_status
    row.notes = payload.notes
    row.field_definition_id = payload.field_definition_id
    db.commit()
    db.refresh(row)
    return assignment_to_dict(row)
