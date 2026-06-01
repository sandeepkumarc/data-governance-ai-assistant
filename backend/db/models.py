"""SQLAlchemy ORM models for governance persistence."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class FieldDefinition(Base):
    __tablename__ = "field_definitions"
    __table_args__ = (
        UniqueConstraint("database_name", "table_name", "column_name", name="uq_field_location"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    database_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    table_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    column_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    table_description: Mapped[str] = mapped_column(Text, default="")
    glossary_term: Mapped[str] = mapped_column(String(255), default="")
    glossary_term_description: Mapped[str] = mapped_column(Text, default="")
    logical_data_attribute_name: Mapped[str] = mapped_column(String(255), default="")
    logical_data_attribute_description: Mapped[str] = mapped_column(Text, default="")
    definition: Mapped[str] = mapped_column(Text, default="")
    likely_purpose: Mapped[str] = mapped_column(Text, default="")
    data_classification: Mapped[str] = mapped_column(String(64), default="")
    sensitivity: Mapped[str] = mapped_column(String(64), default="")
    governance_actions: Mapped[list] = mapped_column(JSON, default=list)
    retrieved_context: Mapped[list] = mapped_column(JSON, default=list)
    sample_values_masked: Mapped[bool] = mapped_column(Boolean, default=False)
    masking_reasons: Mapped[list] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(128), default="")
    llm_error: Mapped[str] = mapped_column(Text, default="")
    approval_status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    steward_comment: Mapped[str] = mapped_column(Text, default="")
    approved_by: Mapped[str] = mapped_column(String(255), default="")
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class StewardAssignment(Base):
    __tablename__ = "steward_assignments"
    __table_args__ = (
        UniqueConstraint("database_name", "table_name", "column_name", name="uq_steward_location"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    database_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    table_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    column_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    business_owner: Mapped[str] = mapped_column(String(255), default="")
    business_owner_email: Mapped[str] = mapped_column(String(255), default="")
    data_steward: Mapped[str] = mapped_column(String(255), default="")
    data_steward_email: Mapped[str] = mapped_column(String(255), default="")
    lifecycle_status: Mapped[str] = mapped_column(String(32), default="Draft", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    field_definition_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), default="")
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(64), default="")
    model: Mapped[str] = mapped_column(String(128), default="")
    no_llm: Mapped[bool] = mapped_column(Boolean, default=True)
    mask_samples: Mapped[bool] = mapped_column(Boolean, default=True)
    knowledge_base_version: Mapped[str] = mapped_column(String(64), default="")
    fields_processed: Mapped[int] = mapped_column(default=0)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class LineageNode(Base):
    __tablename__ = "lineage_nodes"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    node_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    details: Mapped[str] = mapped_column(Text, default="")
    database_name: Mapped[str] = mapped_column(String(255), default="", index=True)
    table_name: Mapped[str] = mapped_column(String(255), default="", index=True)
    column_name: Mapped[str] = mapped_column(String(255), default="", index=True)
    field_definition_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    classification: Mapped[str] = mapped_column(String(64), default="")
    sensitivity: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class LineageEdge(Base):
    __tablename__ = "lineage_edges"
    __table_args__ = (UniqueConstraint("source_id", "target_id", "label", name="uq_lineage_edge"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    source_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    target_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LineagePolicy(Base):
    __tablename__ = "lineage_policies"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    rule_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String(32), default="system")
    nl_instruction: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class QualityRule(Base):
    __tablename__ = "quality_rules"
    __table_args__ = (
        UniqueConstraint("database_name", "table_name", "column_name", "rule_name", name="uq_quality_rule"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    database_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    table_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    column_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    field_definition_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(64), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    threshold: Mapped[str] = mapped_column(String(32), default="100%")
    status: Mapped[str] = mapped_column(String(32), default="Suggested", index=True)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(32), default="auto_suggested")
    last_checked: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class TrustScore(Base):
    __tablename__ = "trust_scores"
    __table_args__ = (UniqueConstraint("database_name", "table_name", name="uq_trust_table"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    database_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    table_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)
    breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="Unknown", index=True)
    steward_assigned: Mapped[str] = mapped_column(String(255), default="")
    last_profiled: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class KnowledgeEmbedding(Base):
    __tablename__ = "knowledge_embeddings"
    __table_args__ = (
        UniqueConstraint("chunk_title", "knowledge_base_version", "embedding_model", name="uq_kb_embedding"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    chunk_title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    chunk_text: Mapped[str] = mapped_column(Text, default="")
    knowledge_base_version: Mapped[str] = mapped_column(String(64), default="", index=True)
    embedding_model: Mapped[str] = mapped_column(String(128), default="", index=True)
    embedding: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
