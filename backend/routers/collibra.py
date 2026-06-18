"""Collibra glossary read / push routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.session import get_db
from services.collibra_integration import (
    collibra_status,
    push_all_approved_pending,
    push_definition_to_collibra,
    search_glossary_matches,
)

router = APIRouter(tags=["Collibra"])


class GlossaryMatchPayload(BaseModel):
    database_name: str = ""
    table_name: str = ""
    column_name: str = ""
    glossary_term: str = ""
    definition: str = ""
    notes: str = ""
    limit: int = Field(default=5, ge=1, le=20)


@router.get("/api/collibra/status")
async def get_collibra_status() -> dict[str, Any]:
    return collibra_status()


@router.post("/api/collibra/glossary/match")
async def glossary_match(payload: GlossaryMatchPayload) -> dict[str, Any]:
    matches = search_glossary_matches(
        database_name=payload.database_name,
        table_name=payload.table_name,
        column_name=payload.column_name,
        glossary_term=payload.glossary_term,
        definition=payload.definition,
        notes=payload.notes,
        limit=payload.limit,
    )
    return {"matches": matches, "count": len(matches)}


@router.post("/api/collibra/push/{definition_id}")
async def push_one(definition_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    return push_definition_to_collibra(db, definition_id)


@router.post("/api/collibra/push-approved")
async def push_approved(db: Session = Depends(get_db)) -> dict[str, Any]:
    return push_all_approved_pending(db)
