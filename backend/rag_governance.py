#!/usr/bin/env python3
"""Local RAG starter for data-governance field purpose suggestions."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


TOKEN_RE = re.compile(r"[a-zA-Z0-9_@.\-]+")
EMAIL_RE = re.compile(r"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$", re.IGNORECASE)
DIGIT_RE = re.compile(r"\d")
PHONE_RE = re.compile(r"^\+?[\d\s().-]{7,}$")
SSN_RE = re.compile(r"^\d{3}-?\d{2}-?\d{4}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TOKENISH_RE = re.compile(r"^(tok|key|sec|sk|pk|sess|auth|bearer|api)[A-Z0-9_\-:.]*$", re.IGNORECASE)


@dataclass(frozen=True)
class FieldMetadata:
    database_name: str
    table_name: str
    column_name: str
    data_type: str
    sample_values: list[str]
    notes: str = ""


@dataclass(frozen=True)
class KnowledgeChunk:
    title: str
    text: str


@dataclass(frozen=True)
class MaskedValue:
    value: str
    reason: str


def tokenize(text: str) -> list[str]:
    tokens = []
    for raw in TOKEN_RE.findall(text.lower()):
        tokens.extend(part for part in re.split(r"[_\-.@]+", raw) if part)
        tokens.append(raw)
    return tokens


def read_metadata(path: Path) -> list[FieldMetadata]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        required = {"database_name", "table_name", "column_name", "data_type", "sample_values"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Metadata file is missing columns: {', '.join(sorted(missing))}")

        fields = []
        for row in reader:
            sample_values = [
                value.strip()
                for value in (row.get("sample_values") or "").split("|")
                if value.strip()
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


def mask_sample_value(value: str) -> MaskedValue:
    stripped = value.strip()
    lower = stripped.lower()
    digits = DIGIT_RE.findall(stripped)

    if not stripped:
        return MaskedValue(stripped, "empty")
    if EMAIL_RE.match(stripped):
        domain = stripped.split("@", 1)[1]
        return MaskedValue(f"***@{domain}", "email")
    if SSN_RE.match(stripped):
        return MaskedValue("***-**-" + stripped[-4:], "ssn")
    if DATE_RE.match(stripped):
        return MaskedValue("YYYY-MM-DD", "date")
    if TOKENISH_RE.match(stripped):
        prefix = re.split(r"[_\-:.]", stripped, maxsplit=1)[0]
        return MaskedValue(f"{prefix}_***", "token_or_secret")
    if len(digits) >= 13 and len(digits) <= 19:
        return MaskedValue("**** **** **** " + "".join(digits[-4:]), "payment_card_or_account")
    if PHONE_RE.match(stripped) and len(digits) >= 7:
        return MaskedValue("***-***-" + "".join(digits[-4:]), "phone")
    if lower in {"true", "false", "yes", "no", "null", "none"}:
        return MaskedValue(stripped, "not_masked")
    if len(digits) >= 4 and len(digits) == len(stripped.replace(".", "").replace(",", "").replace("-", "")):
        return MaskedValue("[NUMERIC_VALUE]", "numeric_value")
    return MaskedValue(stripped, "not_masked")


def mask_field_samples(field: FieldMetadata) -> tuple[FieldMetadata, dict[str, object]]:
    # Use stable field identifiers for masking decisions. Notes may contain broad
    # dataset-level context, which can otherwise make every column look like text.
    field_hint = " ".join([field.database_name, field.table_name, field.column_name]).lower()

    if has_any(field_hint, ["comment", "note", "description", "message", "feedback", "details"]):
        masked_values = [MaskedValue("[FREE_TEXT_VALUE]", "free_text_field") for _ in field.sample_values]
    elif has_any(field_hint, ["token", "password", "secret", "session", "api_key", "auth_code"]):
        masked_values = [MaskedValue("[TOKEN_OR_SECRET_VALUE]", "token_or_secret_field") for _ in field.sample_values]
    elif has_any(field_hint, ["ssn", "social_security", "passport", "driver_license", "tax_id"]):
        masked_values = [MaskedValue("[REGULATED_IDENTIFIER]", "regulated_identifier_field") for _ in field.sample_values]
    elif has_any(field_hint, ["date_of_birth", "birth_date", "dob"]):
        masked_values = [MaskedValue("YYYY-MM-DD", "birth_date_field") for _ in field.sample_values]
    elif has_any(field_hint, ["salary", "income", "amount", "balance", "payment", "bank", "card"]):
        masked_values = [MaskedValue("[FINANCIAL_VALUE]", "financial_field") for _ in field.sample_values]
    elif has_any(field_hint, ["email", "phone", "mobile"]):
        masked_values = [MaskedValue("[CONTACT_VALUE]", "contact_field") for _ in field.sample_values]
    elif re.search(r"(^|[_\s-])(id|identifier)$", field.column_name.lower()) or has_any(
        field_hint,
        ["customer_id", "employee_id", "user_id", "account_id", "member_id", "patient_id"],
    ):
        masked_values = [MaskedValue("[IDENTIFIER_VALUE]", "identifier_field") for _ in field.sample_values]
    elif has_any(field_hint, ["name", "address"]):
        masked_values = [MaskedValue("[PERSONAL_TEXT_VALUE]", "personal_text_field") for _ in field.sample_values]
    else:
        masked_values = [mask_sample_value(value) for value in field.sample_values]
    masked_field = FieldMetadata(
        database_name=field.database_name,
        table_name=field.table_name,
        column_name=field.column_name,
        data_type=field.data_type,
        sample_values=[item.value for item in masked_values],
        notes=field.notes,
    )
    reasons = sorted({item.reason for item in masked_values if item.reason not in {"empty", "not_masked"}})
    return masked_field, {
        "sample_values_masked": bool(reasons),
        "masking_reasons": reasons,
    }


def read_knowledge_base(path: Path) -> list[KnowledgeChunk]:
    text = path.read_text(encoding="utf-8")
    chunks: list[KnowledgeChunk] = []
    current_title = "General Governance"
    current_lines: list[str] = []

    for line in text.splitlines():
        if line.startswith("## "):
            if current_lines:
                chunks.append(KnowledgeChunk(current_title, "\n".join(current_lines).strip()))
            current_title = line.removeprefix("## ").strip()
            current_lines = [line]
        elif line.startswith("# "):
            continue
        else:
            current_lines.append(line)

    if current_lines:
        chunks.append(KnowledgeChunk(current_title, "\n".join(current_lines).strip()))

    return [chunk for chunk in chunks if chunk.text]


def field_document(field: FieldMetadata) -> str:
    samples = ", ".join(field.sample_values[:8])
    name_tokens = " ".join(tokenize(f"{field.table_name} {field.column_name}"))
    return "\n".join(
        [
            f"Database: {field.database_name}",
            f"Table: {field.table_name}",
            f"Column: {field.column_name}",
            f"Name tokens: {name_tokens}",
            f"Data type: {field.data_type}",
            f"Sample values: {samples}",
            f"Notes: {field.notes}",
        ]
    )


def retrieve_context_tfidf(field: FieldMetadata, chunks: list[KnowledgeChunk], top_k: int = 3) -> list[KnowledgeChunk]:
    query_tokens = tokenize(field_document(field))
    query_counts = count_terms(query_tokens)
    chunk_tokens = [tokenize(chunk.text) for chunk in chunks]
    chunk_counts = [count_terms(tokens) for tokens in chunk_tokens]
    doc_freq = document_frequency(chunk_counts)
    total_docs = len(chunks)

    scored = []
    for chunk, counts in zip(chunks, chunk_counts):
        score = cosine_tfidf(query_counts, counts, doc_freq, total_docs)
        scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for score, chunk in scored[:top_k] if score > 0]


def retrieve_context(field: FieldMetadata, chunks: list[KnowledgeChunk], top_k: int = 3) -> list[KnowledgeChunk]:
    return retrieve_context_tfidf(field, chunks, top_k=top_k)


def embed_text_ollama(text: str, model: str, base_url: str) -> list[float]:
    payload = {"model": model, "prompt": text}
    data = post_json(f"{base_url.rstrip('/')}/api/embeddings", payload)
    embedding = data.get("embedding")
    if not isinstance(embedding, list) or not embedding:
        raise ValueError("Ollama embeddings response did not include a vector")
    return [float(value) for value in embedding]


def cosine_similarity_vectors(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def retrieve_context_vector(
    field: FieldMetadata,
    indexed_chunks: list[tuple[KnowledgeChunk, list[float]]],
    *,
    top_k: int = 3,
    embedding_model: str,
    base_url: str,
) -> list[KnowledgeChunk]:
    query_vector = embed_text_ollama(field_document(field), embedding_model, base_url)
    scored: list[tuple[float, KnowledgeChunk]] = []
    for chunk, vector in indexed_chunks:
        score = cosine_similarity_vectors(query_vector, vector)
        scored.append((score, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for score, chunk in scored[:top_k] if score > 0]


def count_terms(tokens: Iterable[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for token in tokens:
        counts[token] = counts.get(token, 0) + 1
    return counts


def document_frequency(documents: list[dict[str, int]]) -> dict[str, int]:
    freq: dict[str, int] = {}
    for document in documents:
        for token in document:
            freq[token] = freq.get(token, 0) + 1
    return freq


def cosine_tfidf(
    left: dict[str, int],
    right: dict[str, int],
    doc_freq: dict[str, int],
    total_docs: int,
) -> float:
    common_tokens = set(left) | set(right)
    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0

    for token in common_tokens:
        idf = math.log((1 + total_docs) / (1 + doc_freq.get(token, 0))) + 1
        left_weight = left.get(token, 0) * idf
        right_weight = right.get(token, 0) * idf
        dot += left_weight * right_weight
        left_norm += left_weight * left_weight
        right_norm += right_weight * right_weight

    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (math.sqrt(left_norm) * math.sqrt(right_norm))


def heuristic_recommendation(field: FieldMetadata, context: list[KnowledgeChunk]) -> dict[str, object]:
    haystack = " ".join(
        [
            field.database_name,
            field.table_name,
            field.column_name,
            field.data_type,
            field.notes,
            " ".join(field.sample_values),
        ]
    ).lower()

    classification = "Internal"
    sensitivity = "Low"
    definition = (
        f"{field.column_name} is a field in {field.database_name}.{field.table_name} "
        "that stores a business attribute used by the owning application or reporting process."
    )
    likely_purpose = "Business attribute used by the owning application or reporting process."
    
    table_desc = f"Contains records and attributes for {field.table_name}."
    glossary_term = field.column_name.replace("_", " ").title()
    glossary_term_desc = f"Business term representing the {glossary_term} details."
    logical_attr_name = field.column_name.lower()
    logical_attr_desc = f"Logical representation of the {field.column_name} column."

    if has_any(haystack, ["password", "secret", "token", "api_key", "session"]):
        classification = "Restricted"
        sensitivity = "High"
        definition = (
            f"{field.column_name} stores a security-related value, such as a token, secret, "
            "session identifier, or credential-supporting attribute."
        )
        likely_purpose = "Authentication, authorization, or secure system operation."
        glossary_term = "Security Secret Token"
        glossary_term_desc = "A secure identifier, key, or token used for authentication and security purposes."
        logical_attr_name = "security_credential_token"
        logical_attr_desc = "Logical attribute representing authentication credentials or session tokens."
    elif re.search(r"(^|[_\s-])(id|identifier)$", field.column_name.lower()) or has_any(
        haystack,
        ["customer_id", "employee_id", "user_id", "account_id", "member_id", "patient_id"],
    ):
        classification = "Confidential"
        sensitivity = "Medium"
        definition = (
            f"{field.column_name} is an identifier for records or entities in "
            f"{field.database_name}.{field.table_name}."
        )
        likely_purpose = "Unique identifier used to link records, entities, transactions, or profiles."
        glossary_term = "Entity Identifier"
        glossary_term_desc = "A unique identifier used to distinguish individual entity records."
        logical_attr_name = "entity_identifier_id"
        logical_attr_desc = "Logical data attribute uniquely identifying an entity record."
    elif has_any(haystack, ["ssn", "social", "passport", "driver_license", "tax_id"]):
        classification = "Restricted"
        sensitivity = "High"
        definition = (
            f"{field.column_name} stores a regulated direct identifier used to identify or verify "
            "a person or account."
        )
        likely_purpose = "Direct identification for compliance, verification, or regulated processing."
        glossary_term = "National Identifier"
        glossary_term_desc = "A government-issued unique identifier used for official validation and compliance."
        logical_attr_name = "national_identity_number"
        logical_attr_desc = "Logical attribute containing sensitive government identification details."
    elif has_any(haystack, ["comment", "note", "description", "message", "feedback"]):
        classification = "Confidential"
        sensitivity = "Medium"
        definition = (
            f"{field.column_name} stores free-form text captured for operational context, notes, "
            "or user-provided details."
        )
        likely_purpose = "Free-text operational context that may contain personal or confidential information."
        glossary_term = "Operational Comment Notes"
        glossary_term_desc = "Free-form text containing descriptions, user feedback, or notes."
        logical_attr_name = "comment_description_text"
        logical_attr_desc = "Logical attribute holding free-form textual comments and annotations."
    elif has_any(haystack, ["email", "phone", "address", "dob", "birth", "name"]):
        classification = "Confidential"
        sensitivity = "Medium"
        definition = (
            f"{field.column_name} stores personal profile or contact information associated with "
            f"records in {field.database_name}.{field.table_name}."
        )
        likely_purpose = "Personal/customer profile, contact, identification, or communication use."
        glossary_term = "Personally Identifiable Information"
        glossary_term_desc = "Information that can be used on its own or with other info to identify a single person."
        logical_attr_name = "personal_contact_attribute"
        logical_attr_desc = "Logical attribute containing personal identification or contact details."
    elif has_any(haystack, ["salary", "payment", "card", "bank", "amount", "balance", "income"]):
        classification = "Confidential"
        sensitivity = "High"
        definition = (
            f"{field.column_name} stores financial, payment, billing, compensation, or transaction-related data."
        )
        likely_purpose = "Financial, payment, billing, compensation, or transaction processing."
        glossary_term = "Financial Monetary Value"
        glossary_term_desc = "Numeric value representing a monetary amount, charge, compensation, or balance."
        logical_attr_name = "financial_amount_value"
        logical_attr_desc = "Logical attribute capturing monetary transactions or balances."
    elif has_any(haystack, ["status", "state", "stage", "created_at", "updated_at"]):
        definition = (
            f"{field.column_name} describes the current state, lifecycle timing, or workflow progress "
            f"of records in {field.database_name}.{field.table_name}."
        )
        likely_purpose = "Operational workflow tracking, process state, or audit timing."
        glossary_term = "Workflow Lifecycle Attribute"
        glossary_term_desc = "Data indicating the status, audit timestamp, or phase of a process."
        logical_attr_name = "process_status_timestamp"
        logical_attr_desc = "Logical attribute indicating a state transition or timing event."

    return {
        "database_name": field.database_name,
        "table_name": field.table_name,
        "column_name": field.column_name,
        "table_description": table_desc,
        "glossary_term": glossary_term,
        "glossary_term_description": glossary_term_desc,
        "logical_data_attribute_name": logical_attr_name,
        "logical_data_attribute_description": logical_attr_desc,
        "definition": definition,
        "likely_purpose": likely_purpose,
        "data_classification": classification,
        "sensitivity": sensitivity,
        "governance_actions": [
            "Assign data owner and steward.",
            "Document approved business uses.",
            "Define retention and access rules.",
            "Track lineage to downstream reports and applications.",
        ],
        "retrieved_context": [chunk.title for chunk in context],
        "source": "retrieval_heuristic",
    }


def has_any(text: str, needles: list[str]) -> bool:
    return any(needle in text for needle in needles)


def build_prompt(field: FieldMetadata, context: list[KnowledgeChunk]) -> str:
    context_text = "\n\n".join(f"### {chunk.title}\n{chunk.text}" for chunk in context)
    return f"""You are a data governance analyst.

Use the field metadata, sample values, and retrieved governance context to infer what the field is for.
Return only valid JSON with these keys:
- database_name
- table_name
- column_name
- table_description
- glossary_term
- glossary_term_description
- logical_data_attribute_name
- logical_data_attribute_description
- definition
- likely_purpose
- data_classification
- sensitivity
- governance_actions
- reasoning

The table_description should be a brief description of the table based on its name and column context.
The glossary_term should be a possible business glossary term for this attribute (e.g. Customer Email, Payment Token, Employee Salary).
The glossary_term_description should be a business definition for that glossary term.
The logical_data_attribute_name should be a logical name for this database attribute (e.g. customer_email_address, payment_token_value, employee_base_salary).
The logical_data_attribute_description should be a description for this logical data attribute.
The definition should be one clear business-glossary sentence explaining what the field means.
The likely_purpose should explain how the field is probably used.

Field metadata:
{field_document(field)}

Retrieved governance context:
{context_text}
"""


def call_ollama(prompt: str, model: str, base_url: str) -> str:
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1},
    }
    data = post_json(f"{base_url.rstrip('/')}/api/generate", payload)
    return str(data.get("response", "")).strip()


def call_openai_compatible(prompt: str, model: str, base_url: str) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
    }
    data = post_json(f"{base_url.rstrip('/')}/chat/completions", payload)
    return data["choices"][0]["message"]["content"].strip()


def post_json(url: str, payload: dict[str, object]) -> dict[str, object]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_json_response(text: str) -> dict[str, object]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def analyze_field(
    field: FieldMetadata,
    chunks: list[KnowledgeChunk],
    provider: str,
    model: str,
    base_url: str,
    no_llm: bool,
    *,
    retrieval_mode: str = "tfidf",
    embedding_model: str = "nomic-embed-text",
    indexed_chunks: list[tuple[KnowledgeChunk, list[float]]] | None = None,
) -> dict[str, object]:
    mode_used = retrieval_mode
    context: list[KnowledgeChunk]
    if retrieval_mode == "vector" and indexed_chunks:
        try:
            context = retrieve_context_vector(
                field,
                indexed_chunks,
                embedding_model=embedding_model,
                base_url=base_url,
            )
        except Exception:
            mode_used = "tfidf"
            context = retrieve_context_tfidf(field, chunks)
    else:
        context = retrieve_context_tfidf(field, chunks)

    fallback = heuristic_recommendation(field, context)
    fallback["retrieval_mode"] = mode_used

    if no_llm:
        return fallback

    prompt = build_prompt(field, context)
    try:
        if provider == "ollama":
            response = call_ollama(prompt, model=model, base_url=base_url)
        elif provider == "openai-compatible":
            response = call_openai_compatible(prompt, model=model, base_url=base_url)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

        result = parse_json_response(response)
        result["retrieved_context"] = [chunk.title for chunk in context]
        result["source"] = f"{provider}:{model}"
        result["retrieval_mode"] = mode_used
        return result
    except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError, ValueError) as exc:
        fallback["llm_error"] = str(exc)
        return fallback


def main() -> int:
    parser = argparse.ArgumentParser(description="Suggest field purpose and governance controls with local RAG.")
    parser.add_argument("--metadata", type=Path, required=True, help="CSV file containing field metadata.")
    parser.add_argument("--knowledge-base", type=Path, default=Path("governance_knowledge.md"))
    parser.add_argument("--provider", choices=["ollama", "openai-compatible"], default="ollama")
    parser.add_argument("--model", default="gemma4")
    parser.add_argument("--base-url", default="http://localhost:11434")
    parser.add_argument("--no-llm", action="store_true", help="Use retrieval and heuristics only.")
    parser.add_argument("--mask-samples", action="store_true", help="Mask detected sensitive sample values before retrieval and prompting.")
    args = parser.parse_args()

    if args.provider == "openai-compatible" and args.base_url == "http://localhost:11434":
        args.base_url = "http://localhost:8080/v1"

    fields = read_metadata(args.metadata)
    chunks = read_knowledge_base(args.knowledge_base)

    for field in fields:
        masking_report: dict[str, object] = {}
        if args.mask_samples:
            field, masking_report = mask_field_samples(field)
        result = analyze_field(
            field=field,
            chunks=chunks,
            provider=args.provider,
            model=args.model,
            base_url=args.base_url,
            no_llm=args.no_llm,
        )
        if masking_report:
            result.update(masking_report)
        print(json.dumps(result, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    sys.exit(main())
