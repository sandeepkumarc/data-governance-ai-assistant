"""Governance readiness principles routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.session import get_db
from models.schemas import GovernanceNlUpdatePayload, GovernancePrinciplePayload
from services.governance_principles import (
    delete_principle,
    load_principles_bundle,
    recompute_governance_scores,
    update_principle,
    update_readiness_config,
    upsert_principle,
)
from services.governance_principles_nl import apply_natural_language_governance_principle

router = APIRouter(tags=["Governance Readiness"])


class GovernanceConfigPayload(BaseModel):
    readiness_note: str | None = None
    thresholds: dict[str, int] | None = None


class GovernancePrincipleUpdatePayload(BaseModel):
    name: str | None = None
    description: str | None = None
    enabled: bool | None = None
    weight: int | None = Field(None, ge=1, le=100)
    config: dict[str, Any] | None = None


@router.get("/api/governance/principles")
async def governance_principles(db: Session = Depends(get_db)) -> dict[str, Any]:
    """List governing principles, readiness config, and scorer catalog."""
    return load_principles_bundle(db)


@router.post("/api/governance/principles")
async def create_governance_principle(
    payload: GovernancePrinciplePayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Add a governing principle from the scorer catalog."""
    saved = upsert_principle(db, payload.model_dump(), source="manual")
    db.commit()
    return {"principle": saved, "principles": load_principles_bundle(db)}


@router.patch("/api/governance/principles/{principle_id}")
async def patch_governance_principle(
    principle_id: str,
    payload: GovernancePrincipleUpdatePayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update weight, enabled state, or config for a principle."""
    try:
        saved = update_principle(db, principle_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    return {"principle": saved, "principles": load_principles_bundle(db)}


@router.delete("/api/governance/principles/{principle_id}")
async def remove_governance_principle(
    principle_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Remove a custom governing principle."""
    if not delete_principle(db, principle_id):
        raise HTTPException(status_code=404, detail=f"Principle not found: {principle_id}")
    db.commit()
    return load_principles_bundle(db)


@router.patch("/api/governance/readiness-config")
async def patch_readiness_config(
    payload: GovernanceConfigPayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update readiness note and status thresholds."""
    config = update_readiness_config(
        db,
        readiness_note=payload.readiness_note,
        thresholds=payload.thresholds,
    )
    db.commit()
    return {**load_principles_bundle(db), **config}


@router.post("/api/governance/principles/recompute")
async def recompute_governance_readiness(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Recompute readiness + refresh maturity inputs from current governing principles."""
    result = recompute_governance_scores(db)
    db.commit()
    return result


@router.post("/api/governance/principles/nl-update")
async def natural_language_governance_principle(
    payload: GovernanceNlUpdatePayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Create or update a governing principle from natural language."""
    return apply_natural_language_governance_principle(
        db,
        payload.instruction,
        provider=payload.provider,
        model=payload.model,
        base_url=payload.base_url,
        no_llm=payload.no_llm,
        dry_run=payload.dry_run,
        recompute_after=payload.recompute_after,
    )
