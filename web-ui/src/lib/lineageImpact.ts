import type { LineageEdge, LineageGraph, LineageNode } from "../types";

export type LineageViewMode = "full" | "upstream" | "downstream";

export interface LineageImpact {
  node_id: string;
  node: LineageNode;
  summary: string;
  upstream: {
    count: number;
    by_type: Record<string, number>;
    node_ids: string[];
    nodes: LineageNode[];
  };
  downstream: {
    count: number;
    by_type: Record<string, number>;
    high_sensitivity: number;
    reports: string[];
    node_ids: string[];
    nodes: LineageNode[];
  };
  connecting_edges: LineageEdge[];
  policy_edges: LineageEdge[];
  audit_notes: string[];
}

function buildAdjacency(edges: LineageEdge[]) {
  const downstream = new Map<string, string[]>();
  const upstream = new Map<string, string[]>();
  for (const edge of edges) {
    const src = edge.source_id;
    const tgt = edge.target_id;
    if (!downstream.has(src)) downstream.set(src, []);
    if (!upstream.has(tgt)) upstream.set(tgt, []);
    downstream.get(src)!.push(tgt);
    upstream.get(tgt)!.push(src);
  }
  return { downstream, upstream };
}

function directionalTraverse(
  startId: string,
  adjacency: Map<string, string[]>,
  depth = 50,
): Set<string> {
  const visited = new Set<string>([startId]);
  let frontier = [startId];
  for (let d = 0; d < depth && frontier.length; d += 1) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

function countByType(nodes: LineageNode[], ids: Set<string>) {
  const counts: Record<string, number> = {
    database: 0,
    table: 0,
    column: 0,
    report: 0,
    other: 0,
  };
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const id of ids) {
    const type = nodeMap.get(id)?.type ?? "other";
    counts[type in counts ? type : "other"] += 1;
  }
  return counts;
}

function isHighSensitivity(node: LineageNode) {
  return (
    node.sensitivity === "High" ||
    node.sensitivity === "Medium" ||
    node.classification === "Restricted" ||
    node.classification === "Confidential"
  );
}

function isPolicyEdge(label: string) {
  const lowered = label.toLowerCase();
  return (
    lowered.includes("same full name") ||
    lowered.includes("same logical attribute") ||
    lowered.includes("same table name") ||
    lowered.includes("policy") ||
    lowered.includes("pii scan") ||
    lowered.includes("revenue links")
  );
}

export function computeLineageImpact(graph: LineageGraph, nodeId: string): LineageImpact | null {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const selected = nodeMap.get(nodeId);
  if (!selected) return null;

  const { downstream: downAdj, upstream: upAdj } = buildAdjacency(graph.edges);
  const downstreamIds = directionalTraverse(nodeId, downAdj);
  downstreamIds.delete(nodeId);
  const upstreamIds = directionalTraverse(nodeId, upAdj);
  upstreamIds.delete(nodeId);

  const downstreamNodes = [...downstreamIds]
    .map((id) => nodeMap.get(id))
    .filter((n): n is LineageNode => Boolean(n));
  const upstreamNodes = [...upstreamIds]
    .map((id) => nodeMap.get(id))
    .filter((n): n is LineageNode => Boolean(n));

  const reports = downstreamNodes.filter((n) => n.type === "report").map((n) => n.label);
  const highSensitivity = downstreamNodes.filter(isHighSensitivity).length;

  const related = new Set([nodeId, ...downstreamIds, ...upstreamIds]);
  const connecting_edges = graph.edges.filter(
    (e) => related.has(e.source_id) && related.has(e.target_id),
  );
  const policy_edges = connecting_edges.filter((e) => isPolicyEdge(e.label ?? ""));

  let summary: string;
  if (selected.type === "report") {
    summary = `Report '${selected.label}' is fed by ${upstreamIds.size} upstream asset(s).`;
  } else if (downstreamIds.size === 0) {
    summary = `'${selected.label}' has no downstream dependencies in the current graph.`;
  } else {
    summary = `Changing '${selected.label}' may affect ${downstreamIds.size} downstream asset(s), including ${reports.length} report(s) and ${highSensitivity} sensitive field(s).`;
  }

  return {
    node_id: nodeId,
    node: selected,
    summary,
    upstream: {
      count: upstreamIds.size,
      by_type: countByType(graph.nodes, upstreamIds),
      node_ids: [...upstreamIds].sort(),
      nodes: upstreamNodes,
    },
    downstream: {
      count: downstreamIds.size,
      by_type: countByType(graph.nodes, downstreamIds),
      high_sensitivity: highSensitivity,
      reports,
      node_ids: [...downstreamIds].sort(),
      nodes: downstreamNodes,
    },
    connecting_edges,
    policy_edges,
    audit_notes: [
      "Structural edges represent containment (database → table → column).",
      "Policy edges are inferred from the lineage stitching knowledge base.",
      "Review downstream blast radius before deprecating columns or changing classifications.",
    ],
  };
}

export function highlightForMode(
  graph: LineageGraph,
  nodeId: string,
  mode: LineageViewMode,
): Set<string> {
  if (mode === "full") {
    const { downstream, upstream } = buildAdjacency(graph.edges);
    const down = directionalTraverse(nodeId, downstream);
    const up = directionalTraverse(nodeId, upstream);
    return new Set([...down, ...up]);
  }
  const { downstream, upstream } = buildAdjacency(graph.edges);
  if (mode === "downstream") {
    return directionalTraverse(nodeId, downstream);
  }
  return directionalTraverse(nodeId, upstream);
}

export function filterNodesByQuery(nodes: LineageNode[], query: string): LineageNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.filter((n) => {
    const haystack = [
      n.label,
      n.type,
      n.database_name,
      n.table_name,
      n.column_name,
      n.details,
      n.classification,
      n.sensitivity,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
