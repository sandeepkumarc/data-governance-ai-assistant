"""Knowledge base routes — list and manage governance policy sections."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db.session import get_db, knowledge_base_version
from models.schemas import KnowledgeNlUpdatePayload, KnowledgeSectionInput, KnowledgeSectionUpdate
from services.knowledge import (
    create_section,
    delete_section,
    get_section,
    load_sections,
    update_section,
)
from services.knowledge_nl import apply_natural_language_update

router = APIRouter(tags=["Knowledge Base"])


@router.get("/api/knowledge-base/sections")
async def knowledge_base_sections() -> list[dict[str, str]]:
    """List governance knowledge base sections with full text."""
    try:
        return load_sections()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read knowledge base: {exc}") from exc


@router.get("/api/knowledge-base/sections/detail")
async def knowledge_section_detail(title: str = Query(...)) -> dict[str, Any]:
    """Get a single knowledge section by title."""
    section = get_section(title)
    return {**section, "version": knowledge_base_version()}


@router.post("/api/knowledge-base/sections")
async def add_knowledge_section(
    payload: KnowledgeSectionInput,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Create a new governance knowledge base section."""
    return create_section(db, title=payload.title, text=payload.text)


@router.put("/api/knowledge-base/sections")
async def edit_knowledge_section(
    payload: KnowledgeSectionUpdate,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Update an existing knowledge base section (rename and/or edit body)."""
    return update_section(
        db,
        original_title=payload.original_title,
        title=payload.title,
        text=payload.text,
    )


@router.delete("/api/knowledge-base/sections")
async def remove_knowledge_section(
    title: str = Query(...),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a knowledge base section."""
    return delete_section(db, title=title)


@router.post("/api/knowledge-base/nl-update")
async def natural_language_knowledge_update(
    payload: KnowledgeNlUpdatePayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Apply a natural language instruction to create or update governance policy sections."""
    return apply_natural_language_update(
        db,
        payload.instruction,
        target_section=payload.target_section,
        provider=payload.provider,
        model=payload.model,
        base_url=payload.base_url,
        no_llm=payload.no_llm,
        dry_run=payload.dry_run,
    )
