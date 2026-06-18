"""Knowledge base routes — list and manage governance policy sections."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config import DEFAULT_EMBEDDING_MODEL, KNOWLEDGE_BASE_PATH
from db.session import get_db, knowledge_base_version
from rag_governance import read_knowledge_base_cached
from services.vector_store import get_indexed_chunks
from models.schemas import (
    KnowledgeNlUpdatePayload,
    KnowledgeSectionInput,
    KnowledgeSectionUpdate,
    KnowledgeSectionVerifyPayload,
)
from services.knowledge import (
    create_section,
    delete_section,
    get_section,
    load_sections,
    update_section,
)
from services.knowledge_nl import apply_natural_language_update
from services.knowledge_test_case import verify_knowledge_section

router = APIRouter(tags=["Knowledge Base"])


@router.post("/api/knowledge-base/warm-embeddings")
async def warm_knowledge_embeddings(
    base_url: str = "http://localhost:11434",
    embedding_model: str = DEFAULT_EMBEDDING_MODEL,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Pre-build Ollama embeddings for all policy sections (speeds up Semantic search later)."""
    chunks = read_knowledge_base_cached(KNOWLEDGE_BASE_PATH)
    _, meta = get_indexed_chunks(
        db,
        chunks,
        base_url=base_url,
        embedding_model=embedding_model,
    )
    db.commit()
    return {"status": "ok", **meta}


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


@router.post("/api/knowledge-base/sections/verify")
async def verify_knowledge_section_route(
    payload: KnowledgeSectionVerifyPayload,
) -> dict[str, Any]:
    """Generate a sample probe field and verify the section is retrieved during analysis."""
    try:
        return verify_knowledge_section(
            payload.title,
            payload.text,
            retrieval_mode=payload.retrieval_mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/knowledge-base/sections")
async def add_knowledge_section(
    payload: KnowledgeSectionInput,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Create a new governance knowledge base section."""
    section = create_section(db, title=payload.title, text=payload.text)
    verification = verify_knowledge_section(payload.title, payload.text)
    return {**section, "verification": verification}


@router.put("/api/knowledge-base/sections")
async def edit_knowledge_section(
    payload: KnowledgeSectionUpdate,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update an existing knowledge base section (rename and/or edit body)."""
    updated = update_section(
        db,
        original_title=payload.original_title,
        title=payload.title,
        text=payload.text,
    )
    verification = verify_knowledge_section(updated["title"], updated.get("text", ""))
    return {**updated, "verification": verification}


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
