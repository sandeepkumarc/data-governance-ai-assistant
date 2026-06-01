"""Semantic mapping service — RAG-based field definition and classification."""

from __future__ import annotations

import csv
import io
from typing import Any

from fastapi import HTTPException

from config import DEFAULT_EMBEDDING_MODEL, KNOWLEDGE_BASE_PATH
from rag_governance import (
    FieldMetadata,
    analyze_field,
    mask_field_samples,
    read_knowledge_base,
)
from services.vector_store import get_indexed_chunks


def parse_metadata_csv(content: str) -> list[FieldMetadata]:
    """Parse uploaded CSV content into field metadata records."""
    reader = csv.DictReader(io.StringIO(content))

    required = {"database_name", "table_name", "column_name", "data_type", "sample_values"}
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV file is missing required columns: {', '.join(sorted(missing))}",
        )

    fields: list[FieldMetadata] = []
    for row in reader:
        sample_values = [
            val.strip()
            for val in (row.get("sample_values") or "").split("|")
            if val.strip()
        ]
        fields.append(
            FieldMetadata(
                database_name=(row.get("database_name") or "").strip(),
                table_name=(row.get("table_name") or "").strip(),
                column_name=(row.get("column_name") or "").strip(),
                data_type=(row.get("data_type") or "").strip(),
                sample_values=sample_values,
                notes=(row.get("notes") or "").strip(),
            )
        )
    return fields


def process_fields_through_rag(
    fields: list[FieldMetadata],
    dataset_context: str,
    mask_samples: bool,
    no_llm: bool,
    provider: str,
    model: str,
    base_url: str,
    *,
    retrieval_mode: str = "tfidf",
    embedding_model: str = DEFAULT_EMBEDDING_MODEL,
    session=None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Run each field through masking, retrieval, and analysis."""
    try:
        chunks = read_knowledge_base(KNOWLEDGE_BASE_PATH)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read knowledge base document: {exc}") from exc

    run_meta: dict[str, Any] = {
        "retrieval_mode": retrieval_mode,
        "embedding_model": embedding_model,
    }
    indexed_chunks = None
    if retrieval_mode == "vector":
        if session is None:
            raise HTTPException(status_code=500, detail="Database session required for vector retrieval")
        indexed_chunks, index_meta = get_indexed_chunks(
            session,
            chunks,
            base_url=base_url,
            embedding_model=embedding_model,
        )
        run_meta.update(index_meta)
        if not indexed_chunks:
            run_meta["retrieval_fallback"] = "tfidf"
            retrieval_mode = "tfidf"

    processed_results: list[dict[str, Any]] = []
    for field in fields:
        if dataset_context.strip():
            notes_combined = f"{field.notes} | Dataset context: {dataset_context.strip()}".strip(" |")
            field = FieldMetadata(
                database_name=field.database_name,
                table_name=field.table_name,
                column_name=field.column_name,
                data_type=field.data_type,
                sample_values=field.sample_values,
                notes=notes_combined,
            )

        masking_report: dict[str, object] = {}
        if mask_samples:
            field, masking_report = mask_field_samples(field)

        result = analyze_field(
            field=field,
            chunks=chunks,
            provider=provider,
            model=model,
            base_url=base_url,
            no_llm=no_llm,
            retrieval_mode=retrieval_mode,
            embedding_model=embedding_model,
            indexed_chunks=indexed_chunks,
        )
        if masking_report:
            result.update(masking_report)

        processed_results.append(_standardize_result(result))

    return processed_results, run_meta


def _standardize_result(result: dict[str, object]) -> dict[str, Any]:
    return {
        "database_name": str(result.get("database_name", "")),
        "table_name": str(result.get("table_name", "")),
        "column_name": str(result.get("column_name", "")),
        "table_description": str(result.get("table_description", "")),
        "glossary_term": str(result.get("glossary_term", "")),
        "glossary_term_description": str(result.get("glossary_term_description", "")),
        "logical_data_attribute_name": str(result.get("logical_data_attribute_name", "")),
        "logical_data_attribute_description": str(result.get("logical_data_attribute_description", "")),
        "definition": str(result.get("definition", "")),
        "likely_purpose": str(result.get("likely_purpose", "")),
        "data_classification": str(result.get("data_classification", "")),
        "sensitivity": str(result.get("sensitivity", "")),
        "governance_actions": result.get("governance_actions", []),
        "retrieved_context": result.get("retrieved_context", []),
        "retrieval_mode": str(result.get("retrieval_mode", "tfidf")),
        "sample_values_masked": bool(result.get("sample_values_masked", False)),
        "masking_reasons": result.get("masking_reasons", []),
        "source": str(result.get("source", "")),
        "llm_error": str(result.get("llm_error", "")),
    }
