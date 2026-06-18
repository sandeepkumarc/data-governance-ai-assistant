"""Governance knowledge base — read, write, and section CRUD."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config import KNOWLEDGE_BASE_PATH
from db.models import KnowledgeEmbedding
from rag_governance import KnowledgeChunk, read_knowledge_base, read_knowledge_base_cached
from services.audit import record_audit

KB_HEADING = "# Data Governance Field Classification Knowledge Base"


def chunk_body(chunk: KnowledgeChunk) -> str:
    lines = chunk.text.splitlines()
    if lines and lines[0].startswith("## "):
        return "\n".join(lines[1:]).strip()
    return chunk.text.strip()


def load_sections(path: Path = KNOWLEDGE_BASE_PATH) -> list[dict[str, str]]:
    chunks = read_knowledge_base_cached(path)
    return [{"title": chunk.title, "text": chunk_body(chunk)} for chunk in chunks]


def get_section(title: str, path: Path = KNOWLEDGE_BASE_PATH) -> dict[str, str]:
    for section in load_sections(path):
        if section["title"] == title:
            return section
    raise HTTPException(status_code=404, detail=f"Knowledge section not found: {title}")


def write_sections(sections: list[dict[str, str]], path: Path = KNOWLEDGE_BASE_PATH) -> None:
    lines = [KB_HEADING, ""]
    for section in sections:
        title = section["title"].strip()
        text = section.get("text", "").strip()
        if not title:
            continue
        lines.append(f"## {title}")
        lines.append("")
        if text:
            lines.append(text)
        lines.append("")
    path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def create_section(
    session: Session,
    *,
    title: str,
    text: str = "",
) -> dict[str, str]:
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Section title is required")

    sections = load_sections()
    if any(s["title"].lower() == title.lower() for s in sections):
        raise HTTPException(status_code=409, detail=f"Section already exists: {title}")

    section = {"title": title, "text": text.strip()}
    sections.append(section)
    write_sections(sections)
    _drop_embeddings_for_title(session, title)
    record_audit(
        session,
        action="create_knowledge_section",
        entity_type="knowledge_section",
        entity_id=title,
        details={"title": title},
    )
    session.commit()
    return section


def update_section(
    session: Session,
    *,
    original_title: str,
    title: str | None = None,
    text: str | None = None,
) -> dict[str, str]:
    sections = load_sections()
    index = next((i for i, s in enumerate(sections) if s["title"] == original_title), None)
    if index is None:
        raise HTTPException(status_code=404, detail=f"Knowledge section not found: {original_title}")

    new_title = (title or original_title).strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="Section title is required")

    if new_title != original_title and any(
        s["title"].lower() == new_title.lower() for i, s in enumerate(sections) if i != index
    ):
        raise HTTPException(status_code=409, detail=f"Section already exists: {new_title}")

    updated = {
        "title": new_title,
        "text": text if text is not None else sections[index]["text"],
    }
    sections[index] = updated
    write_sections(sections)
    if original_title != new_title:
        _drop_embeddings_for_title(session, original_title)
    _drop_embeddings_for_title(session, new_title)
    record_audit(
        session,
        action="update_knowledge_section",
        entity_type="knowledge_section",
        entity_id=new_title,
        details={"original_title": original_title, "title": new_title},
    )
    session.commit()
    return updated


def delete_section(session: Session, *, title: str) -> dict[str, str]:
    sections = load_sections()
    removed = next((s for s in sections if s["title"] == title), None)
    if removed is None:
        raise HTTPException(status_code=404, detail=f"Knowledge section not found: {title}")

    write_sections([s for s in sections if s["title"] != title])
    _drop_embeddings_for_title(session, title)
    record_audit(
        session,
        action="delete_knowledge_section",
        entity_type="knowledge_section",
        entity_id=title,
        details={"title": title},
    )
    session.commit()
    return removed


def _drop_embeddings_for_title(session: Session, title: str) -> None:
    session.query(KnowledgeEmbedding).filter(KnowledgeEmbedding.chunk_title == title).delete()
