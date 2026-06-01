"""Vector embedding store and semantic retrieval helpers."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from config import KNOWLEDGE_BASE_PATH
from db.models import KnowledgeEmbedding
from db.session import knowledge_base_version
from rag_governance import KnowledgeChunk, embed_text_ollama


def get_indexed_chunks(
    session: Session,
    chunks: list[KnowledgeChunk],
    *,
    base_url: str,
    embedding_model: str,
) -> tuple[list[tuple[KnowledgeChunk, list[float]]], dict[str, Any]]:
    """Return knowledge chunks with embeddings, building the index if needed."""
    kb_version = knowledge_base_version()
    indexed: list[tuple[KnowledgeChunk, list[float]]] = []
    created = 0
    errors: list[str] = []

    for chunk in chunks:
        row = (
            session.query(KnowledgeEmbedding)
            .filter_by(
                chunk_title=chunk.title,
                knowledge_base_version=kb_version,
                embedding_model=embedding_model,
            )
            .one_or_none()
        )
        if row is None or not row.embedding:
            try:
                vector = embed_text_ollama(f"{chunk.title}\n{chunk.text}", embedding_model, base_url)
                if row is None:
                    row = KnowledgeEmbedding(
                        chunk_title=chunk.title,
                        chunk_text=chunk.text,
                        knowledge_base_version=kb_version,
                        embedding_model=embedding_model,
                        embedding=vector,
                    )
                    session.add(row)
                    created += 1
                else:
                    row.chunk_text = chunk.text
                    row.embedding = vector
            except Exception as exc:
                errors.append(f"{chunk.title}: {exc}")
                continue
        indexed.append((chunk, list(row.embedding)))

    if created:
        session.flush()

    meta = {
        "knowledge_base_version": kb_version,
        "embedding_model": embedding_model,
        "indexed_chunks": len(indexed),
        "embeddings_created": created,
        "knowledge_base_path": str(KNOWLEDGE_BASE_PATH),
        "errors": errors,
    }
    return indexed, meta
