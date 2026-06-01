"""Visual lineage helpers — interactive graph HTML and Mermaid diagrams."""

from __future__ import annotations

import re
import tempfile
from pathlib import Path
from typing import Any


NODE_STYLES: dict[str, dict[str, str]] = {
    "database": {"color": "#dbeafe", "border": "#2563eb", "shape": "box"},
    "table": {"color": "#dcfce7", "border": "#16a34a", "shape": "box"},
    "column": {"color": "#ffedd5", "border": "#ea580c", "shape": "ellipse"},
    "report": {"color": "#f3e8ff", "border": "#9333ea", "shape": "diamond"},
}


def _node_display_label(node: dict[str, Any]) -> str:
    label = node.get("label", node.get("id", ""))
    node_type = node.get("type", "")
    if node_type == "column":
        parts = [label]
        if node.get("classification"):
            parts.append(f"({node['classification']})")
        return "\n".join(parts)
    if node_type == "database":
        return f"DB: {label}"
    if node_type == "table":
        return f"Table: {label}"
    if node_type == "report":
        return f"Report: {label}"
    return label


def _node_tooltip(node: dict[str, Any]) -> str:
    lines = [
        f"Type: {node.get('type', '')}",
        f"Details: {node.get('details', '')}",
    ]
    if node.get("classification"):
        lines.append(f"Classification: {node['classification']}")
    if node.get("sensitivity"):
        lines.append(f"Sensitivity: {node['sensitivity']}")
    if node.get("field_definition_id"):
        lines.append(f"Definition ID: {node['field_definition_id']}")
    return "\n".join(line for line in lines if line.split(": ", 1)[-1])


def build_pyvis_html(graph: dict[str, Any], *, height: str = "680px") -> str:
    """Build an interactive top-down lineage graph as HTML."""
    from pyvis.network import Network

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    net = Network(
        height=height,
        width="100%",
        directed=True,
        bgcolor="#ffffff",
        font_color="#1f2937",
    )
    net.set_options(
        """
        {
          "layout": {
            "hierarchical": {
              "enabled": true,
              "direction": "UD",
              "sortMethod": "directed",
              "levelSeparation": 140,
              "nodeSpacing": 180
            }
          },
          "physics": {
            "enabled": true,
            "hierarchicalRepulsion": {
              "nodeDistance": 180
            }
          },
          "interaction": {
            "hover": true,
            "tooltipDelay": 120,
            "navigationButtons": true,
            "keyboard": true
          },
          "edges": {
            "arrows": {
              "to": {
                "enabled": true,
                "scaleFactor": 0.7
              }
            },
            "color": {
              "color": "#94a3b8"
            },
            "font": {
              "size": 12,
              "align": "middle"
            },
            "smooth": {
              "type": "cubicBezier"
            }
          }
        }
        """
    )

    for node in nodes:
        node_type = node.get("type", "column")
        style = NODE_STYLES.get(node_type, NODE_STYLES["column"])
        net.add_node(
            node["id"],
            label=_node_display_label(node),
            title=_node_tooltip(node),
            color={"background": style["color"], "border": style["border"], "highlight": style["border"]},
            shape=style["shape"],
            size=28 if node_type == "column" else 34,
        )

    for edge in edges:
        net.add_edge(
            edge["source"],
            edge["target"],
            title=edge.get("label", ""),
            label=edge.get("label", ""),
        )

    with tempfile.TemporaryDirectory() as tmpdir:
        path = str(Path(tmpdir) / "lineage_graph.html")
        net.write_html(path)
        return Path(path).read_text(encoding="utf-8")


def _safe_mermaid_id(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", value)
    if cleaned and cleaned[0].isdigit():
        cleaned = f"n_{cleaned}"
    return cleaned or "node"


def build_mermaid(graph: dict[str, Any]) -> str:
    """Build a Mermaid flowchart for documentation or quick sharing."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    if not nodes:
        return "flowchart TD\n    empty[No lineage data yet]"

    id_map = {node["id"]: _safe_mermaid_id(node["id"]) for node in nodes}
    lines = ["flowchart TD"]

    class_styles = {
        "database": ":::database",
        "table": ":::table",
        "column": ":::column",
        "report": ":::report",
    }

    for node in nodes:
        mid = id_map[node["id"]]
        label = _node_display_label(node).replace('"', "'").replace("\n", "<br/>")
        suffix = class_styles.get(node.get("type", ""), "")
        lines.append(f'    {mid}["{label}"]{suffix}')

    for edge in edges:
        source = id_map.get(edge["source"])
        target = id_map.get(edge["target"])
        if not source or not target:
            continue
        if edge.get("label"):
            safe_label = edge["label"].replace('"', "'")
            lines.append(f'    {source} -->|"{safe_label}"| {target}')
        else:
            lines.append(f"    {source} --> {target}")

    lines.extend(
        [
            "",
            "    classDef database fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e3a8a",
            "    classDef table fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d",
            "    classDef column fill:#ffedd5,stroke:#ea580c,stroke-width:2px,color:#7c2d12",
            "    classDef report fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#581c87",
        ]
    )
    return "\n".join(lines)


def legend_markdown() -> str:
    return (
        "| Color | Node type | Meaning |\n"
        "|-------|-----------|---------|\n"
        "| Blue | Database | Source system or database |\n"
        "| Green | Table | Business table or entity |\n"
        "| Orange | Column | Field with classification |\n"
        "| Purple | Report | Downstream dashboard or audit use |"
    )
