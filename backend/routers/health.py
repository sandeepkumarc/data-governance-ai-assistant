"""Health check routes."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint to verify backend status."""
    return {"status": "ok", "app": "data-governance-backend"}
