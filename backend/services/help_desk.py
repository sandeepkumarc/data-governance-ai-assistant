"""Governance help desk — steward questions the assistant could not answer safely."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from db.models import HelpDeskQuestion


def submit_help_desk_question(
    session: Session,
    *,
    question: str,
    user_email: str = "",
    user_name: str = "",
    page_context: str = "",
    assistant_confidence: str = "unknown",
    assistant_preview: str = "",
    catalog_snapshot: str = "",
) -> dict[str, Any]:
    question = question.strip()
    if not question:
        raise ValueError("Question is required")

    row = HelpDeskQuestion(
        question=question,
        user_email=user_email.strip(),
        user_name=user_name.strip(),
        page_context=page_context.strip() or "assistant",
        assistant_confidence=assistant_confidence or "unknown",
        assistant_preview=(assistant_preview or "")[:2000],
        catalog_snapshot=(catalog_snapshot or "")[:4000],
        status="open",
    )
    session.add(row)
    session.flush()
    return help_desk_to_dict(row)


def list_help_desk_questions(
    session: Session,
    *,
    status: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    query = session.query(HelpDeskQuestion).order_by(HelpDeskQuestion.created_at.desc())
    if status:
        query = query.filter(HelpDeskQuestion.status == status)
    return [help_desk_to_dict(row) for row in query.limit(limit).all()]


def help_desk_to_dict(row: HelpDeskQuestion) -> dict[str, Any]:
    return {
        "id": row.id,
        "question": row.question,
        "user_email": row.user_email,
        "user_name": row.user_name,
        "page_context": row.page_context,
        "assistant_confidence": row.assistant_confidence,
        "assistant_preview": row.assistant_preview,
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }


def update_help_desk_status(session: Session, ticket_id: str, *, status: str) -> dict[str, Any]:
    allowed = {"open", "answered", "closed"}
    if status not in allowed:
        raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
    row = session.get(HelpDeskQuestion, ticket_id)
    if row is None:
        raise ValueError("Help desk ticket not found")
    row.status = status
    session.flush()
    return help_desk_to_dict(row)
