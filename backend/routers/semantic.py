"""Semantic mapping routes — field definition and classification via RAG."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from config import DEFAULT_EMBEDDING_MODEL
from db.session import get_db
from models.schemas import AnalyzePayload
from rag_governance import FieldMetadata
from services.definitions import save_analysis_results
from services.semantic_mapping import (
    infer_dataset_context,
    parse_upload_csv,
    process_fields_through_rag,
)

router = APIRouter(tags=["Semantic Mapping"])


def _maybe_persist(
    db: Session,
    results: list[dict[str, Any]],
    *,
    persist: bool,
    action: str,
    provider: str,
    model: str,
    no_llm: bool,
    mask_samples: bool,
    dataset_context: str,
    run_meta: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    if not persist:
        return results
    return save_analysis_results(
        db,
        results,
        action=action,
        provider=provider,
        model=model,
        no_llm=no_llm,
        mask_samples=mask_samples,
        dataset_context=dataset_context,
        run_meta=run_meta,
    )


@router.post("/api/analyze-metadata")
async def analyze_metadata(
    payload: AnalyzePayload,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Analyze a JSON list of data fields and return governance classifications and glossary definitions."""
    fields = [
        FieldMetadata(
            database_name=f.database_name,
            table_name=f.table_name,
            column_name=f.column_name,
            data_type=f.data_type,
            sample_values=f.sample_values,
            notes=f.notes,
        )
        for f in payload.fields
    ]
    results, run_meta = process_fields_through_rag(
        fields=fields,
        dataset_context=payload.dataset_context,
        mask_samples=payload.mask_samples,
        no_llm=payload.no_llm,
        provider=payload.provider,
        model=payload.model,
        base_url=payload.base_url,
        retrieval_mode=payload.retrieval_mode,
        embedding_model=payload.embedding_model,
        session=db,
        use_collibra=payload.use_collibra,
    )
    return _maybe_persist(
        db,
        results,
        persist=payload.persist,
        action="analyze_metadata",
        provider=payload.provider,
        model=payload.model,
        no_llm=payload.no_llm,
        mask_samples=payload.mask_samples,
        dataset_context=payload.dataset_context,
        run_meta=run_meta,
    )


@router.post("/api/upload-metadata")
async def upload_metadata(
    file: UploadFile = File(...),
    database_name: str = Form(""),
    table_name: str = Form(""),
    dataset_context: str = Form(""),
    mask_samples: bool = Form(True),
    no_llm: bool = Form(True),
    provider: str = Form("ollama"),
    model: str = Form("gemma4:e2b"),
    base_url: str = Form("http://localhost:11434"),
    persist: bool = Form(True),
    retrieval_mode: str = Form("tfidf"),
    embedding_model: str = Form(DEFAULT_EMBEDDING_MODEL),
    use_collibra: bool = Form(False),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Accept table exports or column-catalog CSV files and return governance drafts."""
    contents = await file.read()
    csv_text = contents.decode("utf-8")
    if not dataset_context.strip():
        dataset_context = infer_dataset_context(csv_text)
    fields = parse_upload_csv(
        csv_text,
        filename=file.filename or "",
        database_name=database_name,
        table_name=table_name,
    )
    results, run_meta = process_fields_through_rag(
        fields=fields,
        dataset_context=dataset_context,
        mask_samples=mask_samples,
        no_llm=no_llm,
        provider=provider,
        model=model,
        base_url=base_url,
        retrieval_mode=retrieval_mode,
        embedding_model=embedding_model,
        session=db,
        use_collibra=use_collibra,
    )
    return _maybe_persist(
        db,
        results,
        persist=persist,
        action="upload_metadata",
        provider=provider,
        model=model,
        no_llm=no_llm,
        mask_samples=mask_samples,
        dataset_context=dataset_context,
        run_meta=run_meta,
    )
