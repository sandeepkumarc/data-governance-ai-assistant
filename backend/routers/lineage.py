"""Data lineage routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db.session import get_db
from models.schemas import LineageNlUpdatePayload
from services.lineage import get_lineage
from services.lineage_nl import apply_natural_language_lineage_policy
from services.lineage_policies import apply_lineage_policies, load_policies

router = APIRouter(tags=["Lineage"])


@router.get("/api/lineage")
async def lineage(
    database_name: str | None = Query(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve lineage nodes and edges synced from persisted field definitions."""
    return get_lineage(db, database_name=database_name)


@router.get("/api/lineage/policies")
async def lineage_policies(db: Session = Depends(get_db)) -> dict[str, Any]:
    """List active lineage stitching policies."""
    return {"policies": load_policies(db)}


@router.post("/api/lineage/policies/apply")
async def apply_lineage_policies_route(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Re-run all enabled lineage policies against the current graph."""
    result = apply_lineage_policies(db)
    db.commit()
    return result


@router.post("/api/lineage/policies/nl-update")
async def natural_language_lineage_policy(
    payload: LineageNlUpdatePayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Create or update a lineage policy from natural language and optionally apply it."""
    return apply_natural_language_lineage_policy(
        db,
        payload.instruction,
        provider=payload.provider,
        model=payload.model,
        base_url=payload.base_url,
        no_llm=payload.no_llm,
        dry_run=payload.dry_run,
        apply_after=payload.apply_after,
    )
