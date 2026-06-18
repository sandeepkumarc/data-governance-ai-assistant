"""Sync lineage, quality rules, trust scores, and stewardship from field definitions."""

from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Session

from db.models import FieldDefinition, LineageEdge, LineageNode, QualityRule, StewardAssignment


def slug_database(database_name: str) -> str:
    return f"db:{database_name}"


def slug_table(database_name: str, table_name: str) -> str:
    return f"tbl:{database_name}:{table_name}"


def slug_column(database_name: str, table_name: str, column_name: str) -> str:
    return f"col:{database_name}:{table_name}:{column_name}"


def sync_from_field_definitions(session: Session, definitions: Iterable[FieldDefinition]) -> None:
    """Update downstream governance modules after semantic mapping results are saved."""
    definitions = list(definitions)
    if not definitions:
        return

    affected_tables: set[tuple[str, str]] = set()
    for definition in definitions:
        sync_lineage_for_definition(session, definition)
        suggest_quality_rules(session, definition)
        link_stewardship(session, definition)
        affected_tables.add((definition.database_name, definition.table_name))

    for database_name, table_name in affected_tables:
        recompute_trust_score(session, database_name, table_name)

    from services.lineage_policies import apply_lineage_policies

    apply_lineage_policies(session)


def sync_lineage_for_definition(session: Session, definition: FieldDefinition) -> None:
    db_id = slug_database(definition.database_name)
    table_id = slug_table(definition.database_name, definition.table_name)
    column_id = slug_column(definition.database_name, definition.table_name, definition.column_name)

    _upsert_lineage_node(
        session,
        node_id=db_id,
        label=definition.database_name,
        node_type="database",
        details=f"Database containing {definition.table_name} and related assets.",
        database_name=definition.database_name,
    )
    _upsert_lineage_node(
        session,
        node_id=table_id,
        label=definition.table_name,
        node_type="table",
        details=definition.table_description or f"Table {definition.table_name}.",
        database_name=definition.database_name,
        table_name=definition.table_name,
    )
    _upsert_lineage_node(
        session,
        node_id=column_id,
        label=definition.column_name,
        node_type="column",
        details=definition.definition or definition.likely_purpose,
        database_name=definition.database_name,
        table_name=definition.table_name,
        column_name=definition.column_name,
        field_definition_id=definition.id,
        classification=definition.data_classification,
        sensitivity=definition.sensitivity,
    )

    _upsert_lineage_edge(session, db_id, table_id)
    _upsert_lineage_edge(session, table_id, column_id)


def suggest_quality_rules(session: Session, definition: FieldDefinition) -> None:
    candidates = _quality_rule_candidates(definition)
    for candidate in candidates:
        existing = (
            session.query(QualityRule)
            .filter_by(
                database_name=definition.database_name,
                table_name=definition.table_name,
                column_name=definition.column_name,
                rule_name=candidate["rule_name"],
            )
            .one_or_none()
        )
        if existing is None:
            for pending in session.new:
                if (
                    isinstance(pending, QualityRule)
                    and pending.database_name == definition.database_name
                    and pending.table_name == definition.table_name
                    and pending.column_name == definition.column_name
                    and pending.rule_name == candidate["rule_name"]
                ):
                    existing = pending
                    break
        if existing is None:
            session.add(
                QualityRule(
                    database_name=definition.database_name,
                    table_name=definition.table_name,
                    column_name=definition.column_name,
                    field_definition_id=definition.id,
                    rule_name=candidate["rule_name"],
                    rule_type=candidate["rule_type"],
                    description=candidate["description"],
                    reasoning=candidate["reasoning"],
                    threshold=candidate["threshold"],
                    status="Suggested",
                    source="auto_suggested",
                )
            )
        else:
            existing.field_definition_id = definition.id
            existing.rule_type = candidate["rule_type"]
            existing.description = candidate["description"]
            existing.reasoning = candidate["reasoning"]
            existing.threshold = candidate["threshold"]


def link_stewardship(session: Session, definition: FieldDefinition) -> None:
    assignment = (
        session.query(StewardAssignment)
        .filter_by(
            database_name=definition.database_name,
            table_name=definition.table_name,
            column_name=definition.column_name,
        )
        .one_or_none()
    )
    if assignment is None:
        return
    assignment.field_definition_id = definition.id


def recompute_trust_score(session: Session, database_name: str, table_name: str):
    """Recompute table readiness from governing principles (delegates to governance_principles)."""
    from services.governance_principles import recompute_trust_score as _recompute

    return _recompute(session, database_name, table_name)


def _quality_rule_candidates(definition: FieldDefinition) -> list[dict[str, str]]:
    column = definition.column_name.lower()
    classification = definition.data_classification.lower() or "unspecified"
    glossary = (definition.glossary_term or "").strip()
    logical = (definition.logical_data_attribute_name or "").strip()
    rules: list[dict[str, str]] = []

    context_bits = [
        f"Column `{definition.column_name}` on `{definition.database_name}.{definition.table_name}`",
    ]
    if classification and classification != "unspecified":
        context_bits.append(f"classification **{definition.data_classification}**")
    if glossary:
        context_bits.append(f"glossary term “{glossary}”")
    if logical:
        context_bits.append(f"logical attribute “{logical}”")
    field_context = "; ".join(context_bits) + "."

    if "email" in column:
        rules.append(
            {
                "rule_name": "Valid Email Schema Format",
                "rule_type": "Validity",
                "description": "Verifies that values match a valid email address pattern.",
                "threshold": "99.9%",
                "reasoning": (
                    f"{field_context} The column name indicates an email/contact field, "
                    "so a validity rule with a 99.9% pass target is recommended before publishing to the catalog."
                ),
            }
        )
    if column.endswith("_id") or column.endswith("id"):
        rules.append(
            {
                "rule_name": "Primary Key Uniqueness",
                "rule_type": "Uniqueness",
                "description": "Validates zero duplicate identifier values across active table rows.",
                "threshold": "100%",
                "reasoning": (
                    f"{field_context} The column name follows an identifier pattern (`_id` / `id`), "
                    "so uniqueness at 100% is suggested to protect downstream joins and master data."
                ),
            }
        )
    if classification in {"confidential", "restricted"} or any(
        token in column for token in ["comment", "note", "ssn", "password", "token"]
    ):
        triggers = []
        if classification in {"confidential", "restricted"}:
            triggers.append(f"classification is {definition.data_classification}")
        matched = [t for t in ["comment", "note", "ssn", "password", "token"] if t in column]
        if matched:
            triggers.append(f"column name contains sensitive tokens: {', '.join(matched)}")
        trigger_text = " and ".join(triggers)
        rules.append(
            {
                "rule_name": "PII Compliance Adherence",
                "rule_type": "Compliance Check",
                "description": "Flags rows where sensitive values appear without approved masking controls.",
                "threshold": "100%",
                "reasoning": (
                    f"{field_context} Suggested because {trigger_text}. "
                    "Implement masking and compliance checks in your enterprise DQ/catalog tools."
                ),
            }
        )
    if any(token in column for token in ["salary", "amount", "balance", "payment", "income"]):
        matched = [t for t in ["salary", "amount", "balance", "payment", "income"] if t in column]
        rules.append(
            {
                "rule_name": "Value Boundary Constraint",
                "rule_type": "Accuracy",
                "description": "Verifies numeric financial values are within approved business boundaries.",
                "threshold": "100%",
                "reasoning": (
                    f"{field_context} Financial/numeric tokens detected ({', '.join(matched)}). "
                    "Boundary and sign/range checks help prevent reporting and revenue errors."
                ),
            }
        )
    if any(token in column for token in ["status", "state", "stage"]):
        matched = [t for t in ["status", "state", "stage"] if t in column]
        rules.append(
            {
                "rule_name": "Allowed Workflow Values",
                "rule_type": "Validity",
                "description": "Ensures workflow status values match approved enumerations.",
                "threshold": "100%",
                "reasoning": (
                    f"{field_context} Workflow-related naming ({', '.join(matched)}) implies a closed set of values; "
                    "enumeration validation avoids invalid lifecycle states in analytics."
                ),
            }
        )
    if not rules:
        rules.append(
            {
                "rule_name": "Required Field Completeness",
                "rule_type": "Completeness",
                "description": "Checks that the column is populated for active records above the approved threshold.",
                "threshold": "95%",
                "reasoning": (
                    f"{field_context} No specialized pattern matched; default completeness at 95% "
                    "ensures the field is documented and populated for core operational use."
                ),
            }
        )
    return rules


def _upsert_lineage_node(session: Session, node_id: str, **values: object) -> LineageNode:
    row = session.get(LineageNode, node_id)
    if row is None:
        for pending in session.new:
            if isinstance(pending, LineageNode) and pending.id == node_id:
                row = pending
                break
    if row is None:
        row = session.query(LineageNode).filter_by(id=node_id).one_or_none()
    if row is None:
        row = LineageNode(id=node_id, **values)
        session.add(row)
    else:
        for key, value in values.items():
            setattr(row, key, value)
    return row


def _upsert_lineage_edge(session: Session, source_id: str, target_id: str, label: str = "") -> None:
    for pending in session.new:
        if (
            isinstance(pending, LineageEdge)
            and pending.source_id == source_id
            and pending.target_id == target_id
            and pending.label == label
        ):
            return

    existing = (
        session.query(LineageEdge)
        .filter_by(source_id=source_id, target_id=target_id, label=label)
        .one_or_none()
    )
    if existing is None:
        session.add(LineageEdge(source_id=source_id, target_id=target_id, label=label))
