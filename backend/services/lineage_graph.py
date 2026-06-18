"""Directed graph traversal for lineage impact, blast radius, and auditing."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from services.lineage import get_lineage, lineage_edge_to_dict, lineage_node_to_dict


def _edge_adjacency(edges: list[dict[str, Any]]) -> tuple[dict[str, list[tuple[str, str]]], dict[str, list[tuple[str, str]]]]:
    downstream: dict[str, list[tuple[str, str]]] = defaultdict(list)
    upstream: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for edge in edges:
        source = edge["source_id"]
        target = edge["target_id"]
        label = edge.get("label") or ""
        downstream[source].append((target, label))
        upstream[target].append((source, label))
    return downstream, upstream


def directional_traverse(
    start_id: str,
    adjacency: dict[str, list[tuple[str, str]]],
    *,
    depth: int = 50,
) -> set[str]:
    visited = {start_id}
    frontier = [start_id]
    for _ in range(depth):
        next_frontier: list[str] = []
        for node_id in frontier:
            for neighbor, _ in adjacency.get(node_id, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    next_frontier.append(neighbor)
        if not next_frontier:
            break
        frontier = next_frontier
    return visited


def _count_by_type(node_map: dict[str, dict[str, Any]], node_ids: set[str]) -> dict[str, int]:
    counts = {"database": 0, "table": 0, "column": 0, "report": 0, "other": 0}
    for node_id in node_ids:
        node_type = node_map.get(node_id, {}).get("type", "other")
        counts[node_type if node_type in counts else "other"] += 1
    return counts


def _is_high_sensitivity(node: dict[str, Any]) -> bool:
    return node.get("sensitivity") in {"High", "Medium"} or node.get("classification") in {
        "Restricted",
        "Confidential",
    }


def _is_policy_edge(label: str) -> bool:
    lowered = label.lower()
    markers = (
        "same full name",
        "same logical attribute",
        "same table name",
        "policy match",
        "pii scan",
        "revenue links",
        "policy link",
    )
    return any(marker in lowered for marker in markers)


def compute_impact(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    node_id: str,
    *,
    depth: int = 50,
) -> dict[str, Any] | None:
    node_map = {node["id"]: node for node in nodes}
    if node_id not in node_map:
        return None

    downstream_map, upstream_map = _edge_adjacency(edges)
    downstream_ids = directional_traverse(node_id, downstream_map, depth=depth) - {node_id}
    upstream_ids = directional_traverse(node_id, upstream_map, depth=depth) - {node_id}

    downstream_nodes = [node_map[nid] for nid in downstream_ids if nid in node_map]
    upstream_nodes = [node_map[nid] for nid in upstream_ids if nid in node_map]

    reports = [n["label"] for n in downstream_nodes if n.get("type") == "report"]
    high_sensitivity = sum(1 for n in downstream_nodes if _is_high_sensitivity(n))

    related_ids = {node_id} | downstream_ids | upstream_ids
    connecting_edges = [
        edge
        for edge in edges
        if edge["source_id"] in related_ids and edge["target_id"] in related_ids
    ]
    policy_edges = [edge for edge in connecting_edges if _is_policy_edge(edge.get("label") or "")]

    selected = node_map[node_id]
    label = selected.get("label", node_id)
    downstream_count = len(downstream_ids)

    if selected.get("type") == "report":
        summary = (
            f"Report '{label}' is fed by {len(upstream_ids)} upstream asset(s) "
            f"across {len({n.get('database_name') for n in upstream_nodes if n.get('database_name')})} database(s)."
        )
    elif downstream_count == 0:
        summary = f"'{label}' has no downstream dependencies in the current graph."
    else:
        summary = (
            f"Changing '{label}' may affect {downstream_count} downstream asset(s), "
            f"including {len(reports)} report(s) and {high_sensitivity} sensitive field(s)."
        )

    return {
        "node_id": node_id,
        "node": selected,
        "summary": summary,
        "upstream": {
            "count": len(upstream_ids),
            "by_type": _count_by_type(node_map, upstream_ids),
            "node_ids": sorted(upstream_ids),
            "nodes": upstream_nodes,
        },
        "downstream": {
            "count": downstream_count,
            "by_type": _count_by_type(node_map, downstream_ids),
            "high_sensitivity": high_sensitivity,
            "reports": reports,
            "node_ids": sorted(downstream_ids),
            "nodes": downstream_nodes,
        },
        "connecting_edges": connecting_edges,
        "policy_edges": policy_edges,
        "audit_notes": [
            "Structural edges represent containment (database → table → column).",
            "Policy edges are inferred from the lineage stitching knowledge base.",
            "Use downstream blast radius before deprecating columns or changing classifications.",
        ],
    }


def get_impact_from_session(
    session: Session,
    node_id: str,
    *,
    database_name: str | None = None,
    depth: int = 50,
) -> dict[str, Any] | None:
    graph = get_lineage(session, database_name=database_name)
    return compute_impact(graph["nodes"], graph["edges"], node_id, depth=depth)


def get_directional_subgraph(
    session: Session,
    node_id: str,
    *,
    direction: str = "both",
    database_name: str | None = None,
    depth: int = 50,
) -> dict[str, Any]:
    graph = get_lineage(session, database_name=database_name)
    nodes = graph["nodes"]
    edges = graph["edges"]
    node_map = {node["id"]: node for node in nodes}
    if node_id not in node_map:
        return {"node_ids": [], "edges": []}

    downstream_map, upstream_map = _edge_adjacency(edges)
    included = {node_id}
    if direction in {"downstream", "both"}:
        included |= directional_traverse(node_id, downstream_map, depth=depth)
    if direction in {"upstream", "both"}:
        included |= directional_traverse(node_id, upstream_map, depth=depth)

    sub_edges = [
        edge for edge in edges if edge["source_id"] in included and edge["target_id"] in included
    ]
    sub_nodes = [node_map[nid] for nid in included if nid in node_map]
    return {"node_ids": sorted(included), "nodes": sub_nodes, "edges": sub_edges}
