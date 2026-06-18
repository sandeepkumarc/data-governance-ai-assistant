"""Data lineage routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config import LINEAGE_KNOWLEDGE_PATH
from db.session import get_db
from models.schemas import LineageNlUpdatePayload, LineagePolicyUpdatePayload
from services.lineage import get_lineage
from services.lineage_graph import get_impact_from_session
from services.lineage_nl import apply_natural_language_lineage_policy
from services.lineage_policies import (
    apply_lineage_policies,
    delete_policy,
    load_policies,
    sync_missing_default_policies,
    update_policy,
)

router = APIRouter(tags=["Lineage"])


@router.get("/api/lineage")
async def lineage(
    database_name: str | None = Query(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve lineage nodes and edges synced from persisted field definitions."""
    return get_lineage(db, database_name=database_name)


@router.get("/api/lineage/knowledge")
async def lineage_knowledge() -> dict[str, str]:
    """Human-readable lineage stitching knowledge base."""
    if LINEAGE_KNOWLEDGE_PATH.exists():
        return {"content": LINEAGE_KNOWLEDGE_PATH.read_text(encoding="utf-8")}
    return {"content": ""}


@router.get("/api/lineage/policies")
async def lineage_policies(db: Session = Depends(get_db)) -> dict[str, Any]:
    """List lineage stitching policies (enabled and disabled)."""
    sync_missing_default_policies(db)
    db.commit()
    return {"policies": load_policies(db)}


@router.patch("/api/lineage/policies/{policy_id}")
async def patch_lineage_policy(
    policy_id: str,
    payload: LineagePolicyUpdatePayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Enable/disable or update a lineage policy."""
    try:
        updated = update_policy(db, policy_id, payload.model_dump(exclude_unset=True))
        db.commit()
        return {"policy": updated, "policies": load_policies(db)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/api/lineage/policies/{policy_id}")
async def remove_lineage_policy(
    policy_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Delete a lineage policy (structural baseline cannot be removed)."""
    try:
        delete_policy(db, policy_id)
        db.commit()
        return {"policies": load_policies(db)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/lineage/policies/sync-catalog")
async def sync_lineage_policy_catalog(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Add any missing industry-standard policies from the default catalog."""
    result = sync_missing_default_policies(db)
    db.commit()
    return {**result, "policies": load_policies(db)}


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


@router.get("/api/lineage/impact/{node_id}")
async def lineage_impact(
    node_id: str,
    database_name: str | None = Query(None),
    depth: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Blast radius and upstream/downstream impact summary for a lineage node."""
    impact = get_impact_from_session(db, node_id, database_name=database_name, depth=depth)
    if impact is None:
        raise HTTPException(status_code=404, detail=f"Lineage node not found: {node_id}")
    return impact
