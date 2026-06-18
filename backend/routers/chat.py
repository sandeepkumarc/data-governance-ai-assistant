"""Governance assistant chat routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.session import get_db
from services.audit import record_audit
from services.governance_chat import answer_governance_question, build_governance_context
from services.help_desk import list_help_desk_questions, submit_help_desk_question, update_help_desk_status

router = APIRouter(tags=["Assistant"])


class ChatTurn(BaseModel):
    role: str = "user"
    content: str = ""


class AssistantChatPayload(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list)
    provider: str = "ollama"
    model: str = "gemma4:e2b"
    base_url: str = "http://localhost:11434"
    no_llm: bool = False


@router.post("/api/assistant/chat")
async def assistant_chat(
    payload: AssistantChatPayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Answer a natural-language question using governance catalog context."""
    result = answer_governance_question(
        db,
        payload.message,
        history=[turn.model_dump() for turn in payload.history],
        provider=payload.provider,
        model=payload.model,
        base_url=payload.base_url,
        no_llm=payload.no_llm,
    )
    record_audit(
        db,
        action="assistant_chat",
        entity_type="assistant",
        details={
            "question": payload.message[:500],
            "mode": result.get("mode"),
            "confidence": result.get("confidence"),
            "offer_help_desk": result.get("offer_help_desk"),
            "sources": result.get("sources", []),
        },
    )
    db.commit()
    return result


class HelpDeskPayload(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    user_email: str = ""
    user_name: str = ""
    page_context: str = "assistant"
    assistant_confidence: str = "unknown"
    assistant_preview: str = ""


@router.post("/api/help-desk/questions")
async def create_help_desk_question(
    payload: HelpDeskPayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Submit a question to the governance help desk when the assistant cannot answer safely."""
    snapshot = build_governance_context(db, payload.question)[:4000]
    row = submit_help_desk_question(
        db,
        question=payload.question,
        user_email=payload.user_email,
        user_name=payload.user_name,
        page_context=payload.page_context,
        assistant_confidence=payload.assistant_confidence,
        assistant_preview=payload.assistant_preview,
        catalog_snapshot=snapshot,
    )
    record_audit(
        db,
        action="help_desk_submit",
        entity_type="help_desk",
        entity_id=row["id"],
        details={"question": payload.question[:500], "user_email": payload.user_email},
    )
    db.commit()
    return {
        **row,
        "message": "Your question was submitted to the governance help desk. An expert will follow up.",
    }


@router.get("/api/help-desk/questions")
async def get_help_desk_questions(
    status: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List help desk tickets for stewards and governance experts."""
    return list_help_desk_questions(db, status=status, limit=min(limit, 200))


class HelpDeskStatusPayload(BaseModel):
    status: str = Field(..., pattern="^(open|answered|closed)$")


@router.patch("/api/help-desk/questions/{ticket_id}/status")
async def patch_help_desk_status(
    ticket_id: str,
    payload: HelpDeskStatusPayload,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Update ticket status (open | answered | closed)."""
    from fastapi import HTTPException

    try:
        row = update_help_desk_status(db, ticket_id, status=payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    record_audit(
        db,
        action="help_desk_status_update",
        entity_type="help_desk",
        entity_id=ticket_id,
        details={"status": payload.status},
    )
    db.commit()
    return row
