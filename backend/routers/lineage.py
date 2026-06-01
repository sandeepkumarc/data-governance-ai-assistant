"""Data lineage routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db.session import get_db
from services.lineage import get_lineage

router = APIRouter(tags=["Lineage"])


@router.get("/api/lineage")
async def lineage(
    database_name: str | None = Query(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve lineage nodes and edges synced from persisted field definitions."""
    return get_lineage(db, database_name=database_name)
