"""Trust scores routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db.session import get_db
from services.trust import get_trust_scores

router = APIRouter(tags=["Trust Scores"])


@router.get("/api/trust-scores")
async def trust_scores(
    database_name: str | None = Query(None),
    table_name: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve table-level trust metrics computed from definitions and quality rules."""
    return get_trust_scores(db, database_name=database_name, table_name=table_name)
