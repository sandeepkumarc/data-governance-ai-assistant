"""Data lineage service — graph stored in the database and synced from field definitions."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from db.models import LineageEdge, LineageNode
from services.lineage_viz import build_mermaid


def get_lineage(session: Session, *, database_name: str | None = None) -> dict[str, Any]:
    node_query = session.query(LineageNode)
    if database_name:
        node_query = node_query.filter(LineageNode.database_name == database_name)

    nodes = node_query.order_by(LineageNode.node_type, LineageNode.label).all()
    node_ids = {node.id for node in nodes}

    edges = session.query(LineageEdge).order_by(LineageEdge.source_id, LineageEdge.target_id).all()
    if database_name:
        edges = [edge for edge in edges if edge.source_id in node_ids and edge.target_id in node_ids]

    payload = {
        "nodes": [lineage_node_to_dict(node) for node in nodes],
        "edges": [lineage_edge_to_dict(edge) for edge in edges],
    }
    payload["mermaid"] = build_mermaid(payload)
    return payload


def lineage_node_to_dict(row: LineageNode) -> dict[str, Any]:
    return {
        "id": row.id,
        "label": row.label,
        "type": row.node_type,
        "details": row.details,
        "database_name": row.database_name,
        "table_name": row.table_name,
        "column_name": row.column_name,
        "field_definition_id": row.field_definition_id,
        "classification": row.classification,
        "sensitivity": row.sensitivity,
    }


def lineage_edge_to_dict(row: LineageEdge) -> dict[str, Any]:
    return {
        "id": row.id,
        "source_id": row.source_id,
        "target_id": row.target_id,
        "label": row.label or "",
        "source": row.source_id,
        "target": row.target_id,
    }
