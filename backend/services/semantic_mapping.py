"""Semantic mapping service — RAG-based field definition and classification."""

from __future__ import annotations

import csv
import io
import re
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from config import DEFAULT_EMBEDDING_MODEL, KNOWLEDGE_BASE_PATH
from rag_governance import (
    FieldMetadata,
    TfidfIndex,
    analyze_field,
    build_tfidf_index,
    mask_field_samples,
    read_knowledge_base_cached,
)
from services.vector_store import get_indexed_chunks

_DEFAULT_DATASET_CONTEXT = (
    "Enterprise metadata export. Draft definitions and classifications for steward review."
)
_HEALTHCARE_DATASET_CONTEXT = (
    "Healthcare EHR and claims metadata. Classify PHI with cited policies from the knowledge base."
)
_HEALTHCARE_SIGNALS = (
    "clinical_ehr",
    "claims_payer",
    "mrn",
    "medical_record",
    "patient",
    "diagnosis",
    "icd",
    "icd10",
    "loinc",
    "ndc",
    "medication",
    "lab_result",
    "encounter",
    "admission",
    "discharge",
    "vital",
    "phi",
    "hipaa",
    "claim",
    "hcpcs",
    "drg",
    "beneficiary",
    "member_id",
    "subscriber",
    "provider_npi",
    "npi",
    "sud",
    "substance",
    "behavioral_health",
)
_HEALTHCARE_SIGNAL_THRESHOLD = 2


def infer_dataset_context(content: str) -> str:
    """Infer dataset context from CSV content when the caller did not supply one."""
    haystack = content.lower()
    hits = sum(1 for signal in _HEALTHCARE_SIGNALS if signal in haystack)
    if hits >= _HEALTHCARE_SIGNAL_THRESHOLD:
        return _HEALTHCARE_DATASET_CONTEXT
    return _DEFAULT_DATASET_CONTEXT


_METADATA_REQUIRED = {
    "database_name",
    "table_name",
    "column_name",
    "data_type",
    "sample_values",
}
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_INTEGER_RE = re.compile(r"^-?\d+$")
_DECIMAL_RE = re.compile(r"^-?\d+(\.\d+)?$")


def is_metadata_catalog_csv(fieldnames: list[str] | None) -> bool:
    names = {(name or "").strip().lower() for name in (fieldnames or [])}
    return _METADATA_REQUIRED.issubset(names)


def infer_table_scope(
    filename: str = "",
    *,
    database_name: str = "",
    table_name: str = "",
) -> tuple[str, str]:
    if database_name.strip() and table_name.strip():
        return database_name.strip(), table_name.strip()

    stem = Path(filename or "").stem.lower().replace("-", "_")
    parts = [part for part in stem.split("_") if part]
    if len(parts) >= 2:
        return "_".join(parts[:-1]), parts[-1]
    if len(parts) == 1:
        return "demo_db", parts[0]
    return "demo_db", "exported_table"


def infer_data_type(samples: list[str]) -> str:
    if not samples:
        return "string"
    if all(_DATE_RE.match(sample) for sample in samples):
        return "date"
    if all(_INTEGER_RE.match(sample) for sample in samples):
        return "integer"
    if all(_DECIMAL_RE.match(sample) for sample in samples):
        return "decimal"
    return "string"


def parse_metadata_csv(content: str) -> list[FieldMetadata]:
    """Parse a column-catalog CSV (one row per field)."""
    reader = csv.DictReader(io.StringIO(content))
    if not is_metadata_catalog_csv(reader.fieldnames):
        raise HTTPException(
            status_code=400,
            detail=(
                "CSV file is missing required columns: "
                + ", ".join(sorted(_METADATA_REQUIRED))
            ),
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


def parse_table_export_csv(
    content: str,
    *,
    filename: str = "",
    database_name: str = "",
    table_name: str = "",
) -> list[FieldMetadata]:
    """Parse a practical table export (header row + sample records)."""
    reader = csv.DictReader(io.StringIO(content))
    columns = [name.strip() for name in (reader.fieldnames or []) if name and name.strip()]
    if not columns:
        raise HTTPException(status_code=400, detail="CSV file has no column headers.")

    db_name, tbl_name = infer_table_scope(
        filename,
        database_name=database_name,
        table_name=table_name,
    )
    rows = list(reader)
    if not rows:
        raise HTTPException(
            status_code=400,
            detail="Table export CSV must include at least one sample data row.",
        )

    fields: list[FieldMetadata] = []
    for column in columns:
        sample_values = [
            (row.get(column) or "").strip()
            for row in rows
            if (row.get(column) or "").strip()
        ]
        fields.append(
            FieldMetadata(
                database_name=db_name,
                table_name=tbl_name,
                column_name=column,
                data_type=infer_data_type(sample_values),
                sample_values=sample_values,
                notes=f"Inferred from {len(sample_values)} sample row(s) in table export.",
            )
        )
    return fields


def parse_upload_csv(
    content: str,
    *,
    filename: str = "",
    database_name: str = "",
    table_name: str = "",
) -> list[FieldMetadata]:
    """Accept either a column-catalog CSV or a table export with sample rows."""
    reader = csv.DictReader(io.StringIO(content))
    if is_metadata_catalog_csv(reader.fieldnames):
        return parse_metadata_csv(content)
    return parse_table_export_csv(
        content,
        filename=filename,
        database_name=database_name,
        table_name=table_name,
    )


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
    use_collibra: bool = False,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Run each field through masking, retrieval, and analysis."""
    try:
        chunks = read_knowledge_base_cached(KNOWLEDGE_BASE_PATH)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read knowledge base document: {exc}") from exc

    tfidf_index: TfidfIndex = build_tfidf_index(chunks)
    query_embed_cache: dict[str, list[float]] = {}

    run_meta: dict[str, Any] = {
        "retrieval_mode": retrieval_mode,
        "embedding_model": embedding_model,
        "knowledge_sections": len(chunks),
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
            tfidf_index=tfidf_index,
            query_embed_cache=query_embed_cache,
        )
        if masking_report:
            result.update(masking_report)

        std = _standardize_result(result)
        if use_collibra:
            from services.collibra_integration import enrich_result_with_collibra

            std = enrich_result_with_collibra(std)
            if std.get("collibra_asset_id") and not std.get("collibra_sync_status"):
                std["collibra_sync_status"] = "matched"
        processed_results.append(std)

    run_meta["use_collibra"] = use_collibra
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
        "policy_citations": result.get("policy_citations", []),
        "decision_rationale": str(result.get("decision_rationale", "")),
        "regulatory_tags": result.get("regulatory_tags", []),
        "retrieval_mode": str(result.get("retrieval_mode", "tfidf")),
        "sample_values_masked": bool(result.get("sample_values_masked", False)),
        "masking_reasons": result.get("masking_reasons", []),
        "source": str(result.get("source", "")),
        "llm_error": str(result.get("llm_error", "")),
        "collibra_asset_id": str(result.get("collibra_asset_id", "")),
        "collibra_sync_status": str(result.get("collibra_sync_status", "")),
        "collibra_matches": result.get("collibra_matches", []),
        "collibra_recommended_action": str(result.get("collibra_recommended_action", "")),
    }
