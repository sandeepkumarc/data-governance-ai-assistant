"""Pydantic request and response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class FieldMetadataInput(BaseModel):
    database_name: str
    table_name: str
    column_name: str
    data_type: str
    sample_values: list[str]
    notes: str = ""


class AnalyzePayload(BaseModel):
    fields: list[FieldMetadataInput]
    provider: str = "ollama"
    model: str = "gemma4:e2b"
    base_url: str = "http://localhost:11434"
    no_llm: bool = True
    mask_samples: bool = True
    dataset_context: str = ""
    persist: bool = True
    retrieval_mode: Literal["tfidf", "vector"] = "tfidf"
    embedding_model: str = "nomic-embed-text"


class ApprovalPayload(BaseModel):
    approval_status: Literal["approved", "rejected", "pending_review", "draft"]
    steward_comment: str = ""
    approved_by: str = ""


class StewardAssignmentInput(BaseModel):
    database_name: str
    table_name: str
    column_name: str
    business_owner: str = ""
    business_owner_email: str = ""
    data_steward: str = ""
    data_steward_email: str = ""
    lifecycle_status: str = "Draft"
    notes: str = ""
    field_definition_id: str | None = None


class KnowledgeSectionInput(BaseModel):
    title: str
    text: str = ""


class KnowledgeSectionUpdate(BaseModel):
    original_title: str
    title: str | None = None
    text: str | None = None


class KnowledgeNlUpdatePayload(BaseModel):
    instruction: str
    target_section: str | None = None
    provider: str = "ollama"
    model: str = "gemma4:e2b"
    base_url: str = "http://localhost:11434"
    no_llm: bool = False
    dry_run: bool = False
