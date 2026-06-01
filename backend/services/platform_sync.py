"""Sync lineage, quality rules, trust scores, and stewardship from field definitions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from db.models import FieldDefinition, LineageEdge, LineageNode, QualityRule, StewardAssignment, TrustScore


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

    haystack = " ".join(
        [
            definition.column_name,
            definition.data_classification,
            definition.sensitivity,
            definition.definition,
        ]
    ).lower()

    if any(token in haystack for token in ["confidential", "restricted", "personal", "pii", "email", "contact"]):
        _upsert_lineage_edge(session, column_id, "report_audit", "PII scan target")
    if any(token in haystack for token in ["financial", "payment", "salary", "revenue", "amount"]):
        _upsert_lineage_edge(session, column_id, "report_sales", "revenue links")


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
                    threshold=candidate["threshold"],
                    status="Suggested",
                    source="auto_suggested",
                )
            )
        else:
            existing.field_definition_id = definition.id
            existing.rule_type = candidate["rule_type"]
            existing.description = candidate["description"]
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


def recompute_trust_score(session: Session, database_name: str, table_name: str) -> TrustScore:
    definitions = (
        session.query(FieldDefinition)
        .filter_by(database_name=database_name, table_name=table_name)
        .all()
    )
    rules = (
        session.query(QualityRule)
        .filter_by(database_name=database_name, table_name=table_name)
        .all()
    )
    steward = (
        session.query(StewardAssignment)
        .filter_by(database_name=database_name, table_name=table_name)
        .order_by(StewardAssignment.updated_at.desc())
        .first()
    )

    completeness = _score_completeness(definitions)
    accuracy = _score_accuracy(rules)
    freshness = _score_freshness(definitions)
    schema_consistency = _score_schema_consistency(definitions)
    overall = round((completeness + accuracy + freshness + schema_consistency) / 4, 1)

    if overall >= 90:
        status = "Healthy"
    elif overall >= 75:
        status = "Warning"
    else:
        status = "Critical"

    row = (
        session.query(TrustScore)
        .filter_by(database_name=database_name, table_name=table_name)
        .one_or_none()
    )
    if row is None:
        row = TrustScore(database_name=database_name, table_name=table_name)
        session.add(row)

    row.overall_score = overall
    row.breakdown = {
        "completeness": completeness,
        "accuracy": accuracy,
        "freshness": freshness,
        "schema_consistency": schema_consistency,
    }
    row.status = status
    row.steward_assigned = steward.data_steward if steward else ""
    row.last_profiled = datetime.now(timezone.utc)
    session.flush()
    return row


def _quality_rule_candidates(definition: FieldDefinition) -> list[dict[str, str]]:
    column = definition.column_name.lower()
    classification = definition.data_classification.lower()
    rules: list[dict[str, str]] = []

    if "email" in column:
        rules.append(
            {
                "rule_name": "Valid Email Schema Format",
                "rule_type": "Validity",
                "description": "Verifies that values match a valid email address pattern.",
                "threshold": "99.9%",
            }
        )
    if column.endswith("_id") or column.endswith("id"):
        rules.append(
            {
                "rule_name": "Primary Key Uniqueness",
                "rule_type": "Uniqueness",
                "description": "Validates zero duplicate identifier values across active table rows.",
                "threshold": "100%",
            }
        )
    if classification in {"confidential", "restricted"} or any(
        token in column for token in ["comment", "note", "ssn", "password", "token"]
    ):
        rules.append(
            {
                "rule_name": "PII Compliance Adherence",
                "rule_type": "Compliance Check",
                "description": "Flags rows where sensitive values appear without approved masking controls.",
                "threshold": "100%",
            }
        )
    if any(token in column for token in ["salary", "amount", "balance", "payment", "income"]):
        rules.append(
            {
                "rule_name": "Value Boundary Constraint",
                "rule_type": "Accuracy",
                "description": "Verifies numeric financial values are within approved business boundaries.",
                "threshold": "100%",
            }
        )
    if any(token in column for token in ["status", "state", "stage"]):
        rules.append(
            {
                "rule_name": "Allowed Workflow Values",
                "rule_type": "Validity",
                "description": "Ensures workflow status values match approved enumerations.",
                "threshold": "100%",
            }
        )
    if not rules:
        rules.append(
            {
                "rule_name": "Required Field Completeness",
                "rule_type": "Completeness",
                "description": "Checks that the column is populated for active records above the approved threshold.",
                "threshold": "95%",
            }
        )
    return rules


def _score_completeness(definitions: list[FieldDefinition]) -> int:
    if not definitions:
        return 0
    filled = sum(1 for item in definitions if item.definition.strip())
    return round(100 * filled / len(definitions))


def _score_accuracy(rules: list[QualityRule]) -> int:
    if not rules:
        return 70
    passed = sum(1 for rule in rules if rule.status in {"Passed", "Suggested"})
    warning = sum(1 for rule in rules if rule.status == "Warning")
    score = (passed * 100 + warning * 70) / len(rules)
    return round(score)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _score_freshness(definitions: list[FieldDefinition]) -> int:
    if not definitions:
        return 0
    now = datetime.now(timezone.utc)
    recent = 0
    for item in definitions:
        updated = item.updated_at or item.created_at
        if updated and (now - _ensure_utc(updated)).days <= 7:
            recent += 1
    return round(100 * recent / len(definitions))


def _score_schema_consistency(definitions: list[FieldDefinition]) -> int:
    if not definitions:
        return 0
    approved = sum(1 for item in definitions if item.approval_status == "approved")
    pending = sum(1 for item in definitions if item.approval_status == "pending_review")
    score = (approved * 100 + pending * 60) / len(definitions)
    return round(score)


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
