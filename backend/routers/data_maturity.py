"""Data maturity routes — Gartner curve radar by data domain."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.session import get_db
from services.governance_principles import recompute_governance_scores
from services.collibra_maturity import get_collibra_maturity, sync_collibra_maturity
from services.data_maturity import get_data_maturity
from services.maturity_config import load_maturity_config, update_maturity_config
from services.maturity_executive_summary import get_maturity_executive_summary

router = APIRouter(tags=["Data Maturity"])


class MaturityConfigPayload(BaseModel):
    domain_labels: dict[str, str] | None = None
    dimension_weights: dict[str, int] | None = None
    axis_principle_map: dict[str, list[str]] | None = None
    collibra_max_assets: int | None = Field(None, ge=100, le=10000)


@router.get("/api/data-maturity")
async def data_maturity(
    domain_id: str | None = Query(None, description="Domain id or 'enterprise'"),
    source: Literal["local", "collibra", "blended"] = Query(
        "local",
        description="Score from local catalog, Collibra snapshot, or blended view",
    ),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Maturity radar and Gartner stage position per data domain."""
    return get_data_maturity(db, domain_id=domain_id, source=source)


@router.get("/api/data-maturity/config")
async def maturity_config(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Domain label overrides and pillar weights."""
    return load_maturity_config(db)


@router.patch("/api/data-maturity/config")
async def patch_maturity_config(
    payload: MaturityConfigPayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update domain labels, pillar weights, or Collibra sync limit."""
    config = update_maturity_config(db, payload.model_dump(exclude_unset=True))
    db.commit()
    return config


@router.post("/api/data-maturity/recompute")
async def recompute_data_maturity(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Recompute readiness from principles (maturity radar updates on next load)."""
    result = recompute_governance_scores(db)
    db.commit()
    return result


@router.post("/api/data-maturity/collibra/sync")
async def sync_collibra(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Fetch all Collibra assets (up to configured limit) and compute maturity by DGC domain."""
    result = sync_collibra_maturity(db)
    db.commit()
    return result


@router.get("/api/data-maturity/executive-summary")
async def maturity_executive_summary(
    domain_id: str | None = Query(None, description="Domain id or omit for enterprise"),
    source: Literal["local", "collibra", "blended"] = Query("local"),
    no_llm: bool = Query(True, description="Use heuristic only; set false to polish with Ollama"),
    model: str = Query("gemma4:e2b"),
    base_url: str = Query("http://localhost:11434"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Natural-language executive brief for the selected domain on the maturity curve."""
    return get_maturity_executive_summary(
        db,
        domain_id=domain_id,
        source=source,
        no_llm=no_llm,
        model=model,
        base_url=base_url,
    )


@router.get("/api/data-maturity/collibra")
async def collibra_maturity_snapshot(
    domain_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Latest cached Collibra maturity snapshot."""
    payload = get_collibra_maturity(db, domain_id=domain_id)
    payload["config"] = load_maturity_config(db)
    return payload
