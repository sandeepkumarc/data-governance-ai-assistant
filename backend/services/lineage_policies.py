"""Lineage policy storage and rule engine for intelligent graph stitching."""

from __future__ import annotations

import json
import re
import uuid
from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from config import BACKEND_DIR, LINEAGE_POLICIES_PATH
from db.models import FieldDefinition, LineageNode, LineagePolicy
from services.platform_sync import _upsert_lineage_edge


def _normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def policy_to_dict(row: LineagePolicy) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "rule_type": row.rule_type,
        "enabled": row.enabled,
        "config": row.config or {},
        "source": row.source,
        "nl_instruction": row.nl_instruction,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def load_policies(session: Session) -> list[dict[str, Any]]:
    rows = session.query(LineagePolicy).order_by(LineagePolicy.name).all()
    return [policy_to_dict(row) for row in rows]


def _default_policy_templates() -> list[dict[str, Any]]:
    template = BACKEND_DIR / "lineage_policies.default.json"
    if template.exists():
        return json.loads(template.read_text(encoding="utf-8")).get("policies", [])
    return []


def _import_json_policies_if_present() -> list[dict[str, Any]]:
    if LINEAGE_POLICIES_PATH.exists():
        return json.loads(LINEAGE_POLICIES_PATH.read_text(encoding="utf-8")).get("policies", [])
    return []


def _persist_policy_row(
    session: Session,
    policy: dict[str, Any],
    *,
    source: str = "system",
    nl_instruction: str = "",
) -> LineagePolicy:
    policy = deepcopy(policy)
    policy_id = policy.get("id") or f"pol-{uuid.uuid4().hex[:8]}"
    row = session.get(LineagePolicy, policy_id)
    if row is None:
        row = session.query(LineagePolicy).filter_by(name=policy.get("name", "")).one_or_none()
    if row is None:
        row = LineagePolicy(id=policy_id)
        session.add(row)

    row.id = policy_id
    row.name = str(policy.get("name", "Untitled policy"))
    row.description = str(policy.get("description", ""))
    row.rule_type = str(policy.get("rule_type", "match_full_name"))
    row.enabled = bool(policy.get("enabled", True))
    row.config = policy.get("config") if isinstance(policy.get("config"), dict) else {}
    if source != "system" or not row.source:
        row.source = source
    if nl_instruction:
        row.nl_instruction = nl_instruction
    session.flush()
    return row


def upsert_policy(
    session: Session,
    policy: dict[str, Any],
    *,
    source: str = "nl",
    nl_instruction: str = "",
) -> dict[str, Any]:
    row = _persist_policy_row(
        session,
        policy,
        source=source,
        nl_instruction=nl_instruction,
    )
    session.flush()
    return policy_to_dict(row)


def ensure_default_policies(session: Session) -> None:
    """Seed default policies into the database when empty; migrate legacy JSON once."""
    if session.scalar(select(LineagePolicy.id).limit(1)) is not None:
        return

    legacy = _import_json_policies_if_present()
    templates = legacy or _default_policy_templates()
    for policy in templates:
        _persist_policy_row(session, policy, source="system")
    session.flush()


def _definition_map(session: Session) -> dict[str, Any]:
    rows = session.query(FieldDefinition).all()
    by_id = {row.id: row for row in rows}
    by_location: dict[str, FieldDefinition] = {}
    for row in rows:
        by_location[f"{row.database_name}|{row.table_name}|{row.column_name}"] = row
    return {"by_id": by_id, "by_location": by_location}


def _column_definition(
    node: LineageNode,
    definitions: dict[str, Any],
) -> FieldDefinition | None:
    if node.field_definition_id and node.field_definition_id in definitions["by_id"]:
        return definitions["by_id"][node.field_definition_id]
    key = f"{node.database_name}|{node.table_name}|{node.column_name or node.label}"
    return definitions["by_location"].get(key)


def _match_values_for_node(
    node: LineageNode,
    definitions: dict[str, Any],
    match_on: list[str],
) -> set[str]:
    values: set[str] = set()
    definition = _column_definition(node, definitions) if node.node_type == "column" else None

    for field in match_on:
        raw = ""
        if field in {"column_name", "label"}:
            raw = node.column_name or node.label
        elif field == "table_name":
            raw = node.table_name or node.label
        elif field == "database_name":
            raw = node.database_name or node.label
        elif field == "logical_data_attribute_name" and definition:
            raw = definition.logical_data_attribute_name
        elif field == "glossary_term" and definition:
            raw = definition.glossary_term
        elif field == "full_name":
            raw = f"{node.database_name}.{node.table_name}.{node.column_name or node.label}"

        normalized = _normalize_key(raw)
        if normalized and len(normalized) >= 2:
            values.add(normalized)
    return values


def _apply_match_groups(
    session: Session,
    nodes: list[LineageNode],
    *,
    edge_label: str,
    cross_database: bool,
    match_on: list[str],
    definitions: dict[str, Any],
) -> list[dict[str, str]]:
    groups: dict[str, list[LineageNode]] = {}
    for node in nodes:
        for key in _match_values_for_node(node, definitions, match_on):
            groups.setdefault(key, []).append(node)

    added: list[dict[str, str]] = []
    for key, group in groups.items():
        if len(group) < 2:
            continue
        group = sorted(group, key=lambda n: (n.database_name, n.table_name, n.label, n.id))
        anchor = group[0]
        for target in group[1:]:
            if not cross_database and anchor.database_name == target.database_name:
                continue
            if anchor.id == target.id:
                continue
            _upsert_lineage_edge(session, anchor.id, target.id, edge_label)
            added.append(
                {
                    "source_id": anchor.id,
                    "target_id": target.id,
                    "label": edge_label,
                    "match_key": key,
                }
            )
    return added


def _apply_keyword_to_report(
    session: Session,
    nodes: list[LineageNode],
    definitions: dict[str, Any],
    config: dict[str, Any],
) -> list[dict[str, str]]:
    keywords = [str(k).lower() for k in config.get("keywords", [])]
    report_id = str(config.get("report_id", ""))
    edge_label = str(config.get("edge_label", "policy link"))
    if not keywords or not report_id:
        return []

    if session.get(LineageNode, report_id) is None:
        return []

    added: list[dict[str, str]] = []
    for node in nodes:
        if node.node_type != "column":
            continue
        definition = _column_definition(node, definitions)
        haystack = " ".join(
            filter(
                None,
                [
                    node.label,
                    node.details,
                    node.classification,
                    node.sensitivity,
                    definition.logical_data_attribute_name if definition else "",
                    definition.definition if definition else "",
                    definition.glossary_term if definition else "",
                ],
            )
        ).lower()
        if any(keyword in haystack for keyword in keywords):
            _upsert_lineage_edge(session, node.id, report_id, edge_label)
            added.append({"source_id": node.id, "target_id": report_id, "label": edge_label})
    return added


def apply_lineage_policies(session: Session) -> dict[str, Any]:
    """Run all enabled lineage policies against the current graph and definitions."""
    policies = [p for p in load_policies(session) if p.get("enabled", True)]
    nodes = session.query(LineageNode).all()
    definitions = _definition_map(session)

    columns = [n for n in nodes if n.node_type == "column"]
    tables = [n for n in nodes if n.node_type == "table"]

    results: list[dict[str, Any]] = []
    total_edges = 0

    for policy in policies:
        rule_type = policy.get("rule_type", "")
        config = policy.get("config", {}) or {}
        edges_added: list[dict[str, str]] = []

        if rule_type == "structural":
            pass
        elif rule_type == "match_full_name":
            edges_added = _apply_match_groups(
                session,
                columns,
                edge_label=str(config.get("edge_label", "same full name")),
                cross_database=bool(config.get("cross_database", True)),
                match_on=list(config.get("match_on", ["column_name", "label"])),
                definitions=definitions,
            )
        elif rule_type == "match_logical_attribute":
            enriched = [
                node
                for node in columns
                if (d := _column_definition(node, definitions))
                and d.logical_data_attribute_name.strip()
            ]
            edges_added = _apply_match_groups(
                session,
                enriched,
                edge_label=str(config.get("edge_label", "same logical attribute")),
                cross_database=bool(config.get("cross_database", True)),
                match_on=["logical_data_attribute_name"],
                definitions=definitions,
            )
        elif rule_type == "match_table_name":
            edges_added = _apply_match_groups(
                session,
                tables,
                edge_label=str(config.get("edge_label", "same table name")),
                cross_database=bool(config.get("cross_database", True)),
                match_on=["table_name", "label"],
                definitions=definitions,
            )
        elif rule_type == "keyword_to_report":
            edges_added = _apply_keyword_to_report(session, columns, definitions, config)
        else:
            results.append(
                {
                    "policy_id": policy.get("id"),
                    "name": policy.get("name"),
                    "rule_type": rule_type,
                    "skipped": True,
                    "reason": "unknown rule type",
                }
            )
            continue

        total_edges += len(edges_added)
        results.append(
            {
                "policy_id": policy.get("id"),
                "name": policy.get("name"),
                "rule_type": rule_type,
                "edges_added": len(edges_added),
                "samples": edges_added[:5],
            }
        )

    return {
        "policies_run": len(policies),
        "edges_added": total_edges,
        "results": results,
    }
