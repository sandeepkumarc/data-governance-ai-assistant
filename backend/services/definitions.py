"""Field definition persistence and steward approval workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models import FieldDefinition
from services.audit import record_audit
from services.platform_sync import recompute_trust_score, sync_from_field_definitions


def save_analysis_results(
    session: Session,
    results: list[dict[str, Any]],
    *,
    action: str,
    provider: str,
    model: str,
    no_llm: bool,
    mask_samples: bool,
    dataset_context: str = "",
    run_meta: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Upsert field definitions from analysis results and write an audit entry."""
    saved: list[dict[str, Any]] = []
    saved_rows: list[FieldDefinition] = []

    for result in results:
        row = (
            session.query(FieldDefinition)
            .filter_by(
                database_name=result["database_name"],
                table_name=result["table_name"],
                column_name=result["column_name"],
            )
            .one_or_none()
        )

        if row is None:
            row = FieldDefinition(
                database_name=result["database_name"],
                table_name=result["table_name"],
                column_name=result["column_name"],
            )
            session.add(row)

        _apply_result_to_row(row, result)
        session.flush()
        saved_rows.append(row)
        saved_row = definition_to_dict(row)
        saved_row["retrieval_mode"] = str(result.get("retrieval_mode", "tfidf"))
        saved.append(saved_row)

    sync_from_field_definitions(session, saved_rows)

    record_audit(
        session,
        action=action,
        entity_type="field_definition",
        provider=provider,
        model=model,
        no_llm=no_llm,
        mask_samples=mask_samples,
        fields_processed=len(results),
        details={
            "dataset_context": dataset_context,
            "definition_ids": [item["id"] for item in saved],
            "run_meta": run_meta or {},
        },
    )
    session.commit()
    return saved


def list_definitions(
    session: Session,
    *,
    database_name: str | None = None,
    table_name: str | None = None,
    approval_status: str | None = None,
) -> list[dict[str, Any]]:
    query = session.query(FieldDefinition).order_by(
        FieldDefinition.database_name,
        FieldDefinition.table_name,
        FieldDefinition.column_name,
    )
    if database_name:
        query = query.filter(FieldDefinition.database_name == database_name)
    if table_name:
        query = query.filter(FieldDefinition.table_name == table_name)
    if approval_status:
        query = query.filter(FieldDefinition.approval_status == approval_status)
    return [definition_to_dict(row) for row in query.all()]


def get_definition(session: Session, definition_id: str) -> dict[str, Any]:
    row = session.get(FieldDefinition, definition_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Definition not found: {definition_id}")
    return definition_to_dict(row)


def update_approval(
    session: Session,
    definition_id: str,
    *,
    approval_status: str,
    steward_comment: str = "",
    approved_by: str = "",
) -> dict[str, Any]:
    row = session.get(FieldDefinition, definition_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Definition not found: {definition_id}")

    row.approval_status = approval_status
    row.steward_comment = steward_comment
    row.approved_by = approved_by
    row.approved_at = datetime.now(timezone.utc) if approval_status in {"approved", "rejected"} else None
    session.flush()

    record_audit(
        session,
        action="approve_definition",
        entity_type="field_definition",
        entity_id=definition_id,
        details={
            "approval_status": approval_status,
            "steward_comment": steward_comment,
            "approved_by": approved_by,
            "field": f"{row.database_name}.{row.table_name}.{row.column_name}",
        },
    )
    recompute_trust_score(session, row.database_name, row.table_name)
    session.commit()
    result = definition_to_dict(row)
    if approval_status == "approved":
        from services.collibra_integration import maybe_auto_push_on_approve

        maybe_auto_push_on_approve(session, definition_id)
        session.refresh(row)
        result = definition_to_dict(row)
    return result


def _apply_result_to_row(row: FieldDefinition, result: dict[str, Any]) -> None:
    row.table_description = str(result.get("table_description", ""))
    row.glossary_term = str(result.get("glossary_term", ""))
    row.glossary_term_description = str(result.get("glossary_term_description", ""))
    row.logical_data_attribute_name = str(result.get("logical_data_attribute_name", ""))
    row.logical_data_attribute_description = str(result.get("logical_data_attribute_description", ""))
    row.definition = str(result.get("definition", ""))
    row.likely_purpose = str(result.get("likely_purpose", ""))
    row.data_classification = str(result.get("data_classification", ""))
    row.sensitivity = str(result.get("sensitivity", ""))
    row.governance_actions = _as_list(result.get("governance_actions"))
    row.retrieved_context = _as_list(result.get("retrieved_context"))
    row.policy_citations = _as_list(result.get("policy_citations"))
    row.decision_rationale = str(result.get("decision_rationale", ""))
    row.regulatory_tags = _as_list(result.get("regulatory_tags"))
    row.collibra_asset_id = str(result.get("collibra_asset_id", row.collibra_asset_id or ""))
    row.collibra_sync_status = str(result.get("collibra_sync_status", row.collibra_sync_status or ""))
    row.collibra_matches = _as_list(result.get("collibra_matches"))
    row.collibra_recommended_action = str(
        result.get("collibra_recommended_action", row.collibra_recommended_action or "")
    )
    row.sample_values_masked = bool(result.get("sample_values_masked", False))
    row.masking_reasons = _as_list(result.get("masking_reasons"))
    row.source = str(result.get("source", ""))
    row.llm_error = str(result.get("llm_error", ""))
    row.approval_status = "pending_review"


def _as_list(value: object) -> list:
    return value if isinstance(value, list) else []


def definition_to_dict(row: FieldDefinition) -> dict[str, Any]:
    return {
        "id": row.id,
        "database_name": row.database_name,
        "table_name": row.table_name,
        "column_name": row.column_name,
        "table_description": row.table_description,
        "glossary_term": row.glossary_term,
        "glossary_term_description": row.glossary_term_description,
        "logical_data_attribute_name": row.logical_data_attribute_name,
        "logical_data_attribute_description": row.logical_data_attribute_description,
        "definition": row.definition,
        "likely_purpose": row.likely_purpose,
        "data_classification": row.data_classification,
        "sensitivity": row.sensitivity,
        "governance_actions": row.governance_actions or [],
        "retrieved_context": row.retrieved_context or [],
        "policy_citations": row.policy_citations or [],
        "decision_rationale": row.decision_rationale or "",
        "regulatory_tags": row.regulatory_tags or [],
        "collibra_asset_id": row.collibra_asset_id or "",
        "collibra_sync_status": row.collibra_sync_status or "",
        "collibra_matches": row.collibra_matches or [],
        "collibra_recommended_action": row.collibra_recommended_action or "",
        "sample_values_masked": row.sample_values_masked,
        "masking_reasons": row.masking_reasons or [],
        "source": row.source,
        "llm_error": row.llm_error,
        "approval_status": row.approval_status,
        "steward_comment": row.steward_comment,
        "approved_by": row.approved_by,
        "approved_at": row.approved_at.isoformat() if row.approved_at else "",
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }
