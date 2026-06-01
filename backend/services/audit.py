"""Audit logging service."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from db.models import AuditLog
from db.session import knowledge_base_version


def record_audit(
    session: Session,
    *,
    action: str,
    entity_type: str = "",
    entity_id: str | None = None,
    provider: str = "",
    model: str = "",
    no_llm: bool = True,
    mask_samples: bool = True,
    fields_processed: int = 0,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        provider=provider,
        model=model,
        no_llm=no_llm,
        mask_samples=mask_samples,
        knowledge_base_version=knowledge_base_version(),
        fields_processed=fields_processed,
        details=details or {},
    )
    session.add(entry)
    session.flush()
    return entry


def list_audit_logs(
    session: Session,
    *,
    action: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    query = session.query(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        query = query.filter(AuditLog.action == action)
    rows = query.limit(limit).all()
    return [_audit_to_dict(row) for row in rows]


def _audit_to_dict(row: AuditLog) -> dict[str, Any]:
    return {
        "id": row.id,
        "action": row.action,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "provider": row.provider,
        "model": row.model,
        "no_llm": row.no_llm,
        "mask_samples": row.mask_samples,
        "knowledge_base_version": row.knowledge_base_version,
        "fields_processed": row.fields_processed,
        "details": row.details,
        "created_at": row.created_at.isoformat() if row.created_at else "",
    }
