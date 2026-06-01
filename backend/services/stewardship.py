"""Stewardship service — business ownership and data steward assignments."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from db.models import StewardAssignment


def get_ownership(session: Session) -> list[dict[str, Any]]:
    rows = (
        session.query(StewardAssignment)
        .order_by(
            StewardAssignment.database_name,
            StewardAssignment.table_name,
            StewardAssignment.column_name,
        )
        .all()
    )
    return [assignment_to_dict(row) for row in rows]


def assignment_to_dict(row: StewardAssignment) -> dict[str, Any]:
    return {
        "id": row.id,
        "database_name": row.database_name,
        "table_name": row.table_name,
        "column_name": row.column_name,
        "business_owner": row.business_owner,
        "business_owner_email": row.business_owner_email,
        "data_steward": row.data_steward,
        "data_steward_email": row.data_steward_email,
        "lifecycle_status": row.lifecycle_status,
        "notes": row.notes,
        "field_definition_id": row.field_definition_id,
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }
