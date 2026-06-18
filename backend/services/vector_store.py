"""Vector embedding store and semantic retrieval helpers."""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from sqlalchemy.orm import Session

from config import KNOWLEDGE_BASE_PATH
from db.models import KnowledgeEmbedding
from db.session import knowledge_base_version
from rag_governance import KnowledgeChunk, embed_text_ollama

EMBED_MAX_CHARS = int(os.getenv("GOVERNANCE_EMBED_MAX_CHARS", "1800"))
EMBED_WORKERS = max(1, min(8, int(os.getenv("GOVERNANCE_EMBED_WORKERS", "4"))))


def _chunk_embed_text(chunk: KnowledgeChunk) -> str:
    return f"{chunk.title}\n{chunk.text}"


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
    pending: list[tuple[KnowledgeChunk, KnowledgeEmbedding | None]] = []

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
        if row is not None and row.embedding:
            indexed.append((chunk, list(row.embedding)))
        else:
            pending.append((chunk, row))

    def _embed_one(item: tuple[KnowledgeChunk, KnowledgeEmbedding | None]) -> tuple[KnowledgeChunk, list[float] | None, str | None]:
        chunk, row = item
        try:
            vector = embed_text_ollama(
                _chunk_embed_text(chunk),
                embedding_model,
                base_url,
                max_chars=EMBED_MAX_CHARS,
            )
            return chunk, vector, None
        except Exception as exc:
            return chunk, None, str(exc)

    if pending:
        with ThreadPoolExecutor(max_workers=EMBED_WORKERS) as pool:
            futures = {pool.submit(_embed_one, item): item for item in pending}
            for future in as_completed(futures):
                chunk, row = futures[future]
                chunk, vector, err = future.result()
                if err or vector is None:
                    errors.append(f"{chunk.title}: {err or 'empty embedding'}")
                    continue
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
                indexed.append((chunk, vector))

    if created:
        session.flush()

    meta = {
        "knowledge_base_version": kb_version,
        "embedding_model": embedding_model,
        "indexed_chunks": len(indexed),
        "embeddings_created": created,
        "embed_workers": EMBED_WORKERS,
        "knowledge_base_path": str(KNOWLEDGE_BASE_PATH),
        "errors": errors,
    }
    return indexed, meta
