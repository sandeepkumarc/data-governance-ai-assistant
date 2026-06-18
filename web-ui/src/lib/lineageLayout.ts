import type { LineageEdge, LineageGraph, LineageNode } from "../types";

export interface ReportLink {
  node: LineageNode;
  label: string;
}

export interface ColumnLink {
  node: LineageNode;
  label: string;
}

export interface ColumnBranch {
  node: LineageNode;
  reports: ReportLink[];
  stitches: ColumnLink[];
}

export interface TableBranch {
  node: LineageNode;
  columns: ColumnBranch[];
}

export interface DatabaseBranch {
  node: LineageNode;
  tables: TableBranch[];
}

export interface LineageTree {
  databases: DatabaseBranch[];
  orphanReports: LineageNode[];
}

export function normalizeEdge(edge: LineageEdge & { source?: string; target?: string }): LineageEdge {
  return {
    id: edge.id ?? `${edge.source_id ?? edge.source}-${edge.target_id ?? edge.target}`,
    source_id: edge.source_id ?? edge.source ?? "",
    target_id: edge.target_id ?? edge.target ?? "",
    label: edge.label ?? "",
  };
}

export function normalizeLineageGraph(graph: LineageGraph): LineageGraph {
  return {
    ...graph,
    edges: graph.edges.map((e) => normalizeEdge(e as LineageEdge & { source?: string; target?: string })),
  };
}

export function buildLineageTree(graph: LineageGraph): LineageTree {
  const { nodes } = graph;
  const edges = graph.edges.map((e) =>
    normalizeEdge(e as LineageEdge & { source?: string; target?: string }),
  );

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, { node: LineageNode; label: string }[]>();
  const usedNodeIds = new Set<string>();
  const branches: DatabaseBranch[] = [];

  for (const edge of edges) {
    const child = nodeMap.get(edge.target_id);
    if (!child) continue;
    const bucket = children.get(edge.source_id) ?? [];
    bucket.push({ node: child, label: edge.label });
    children.set(edge.source_id, bucket);
  }

  for (const dbNode of nodes.filter((n) => n.type === "database")) {
    usedNodeIds.add(dbNode.id);
    const tables: TableBranch[] = [];

    for (const { node: tableNode } of (children.get(dbNode.id) ?? []).filter((l) => l.node.type === "table")) {
      usedNodeIds.add(tableNode.id);
      const columns: ColumnBranch[] = [];

      for (const { node: colNode } of (children.get(tableNode.id) ?? []).filter((l) => l.node.type === "column")) {
        usedNodeIds.add(colNode.id);
        const reports = (children.get(colNode.id) ?? [])
          .filter((l) => l.node.type === "report")
          .map((l) => {
            usedNodeIds.add(l.node.id);
            return { node: l.node, label: l.label };
          });
        const stitches = (children.get(colNode.id) ?? [])
          .filter((l) => l.node.type === "column")
          .map((l) => ({ node: l.node, label: l.label }));
        columns.push({ node: colNode, reports, stitches });
      }

      if (!columns.length) {
        for (const col of nodes.filter(
          (n) =>
            n.type === "column" &&
            n.database_name === dbNode.label &&
            n.table_name === tableNode.label,
        )) {
          if (usedNodeIds.has(col.id)) continue;
          usedNodeIds.add(col.id);
          const reports = (children.get(col.id) ?? [])
            .filter((l) => l.node.type === "report")
            .map((l) => {
              usedNodeIds.add(l.node.id);
              return { node: l.node, label: l.label };
            });
          const stitches = (children.get(col.id) ?? [])
            .filter((l) => l.node.type === "column")
            .map((l) => ({ node: l.node, label: l.label }));
          columns.push({ node: col, reports, stitches });
        }
      }

      tables.push({ node: tableNode, columns });
    }

    if (!tables.length) {
      for (const table of nodes.filter((n) => n.type === "table" && n.database_name === dbNode.label)) {
        if (usedNodeIds.has(table.id)) continue;
        usedNodeIds.add(table.id);
        const columns = nodes
          .filter(
            (n) =>
              n.type === "column" &&
              n.database_name === dbNode.label &&
              n.table_name === table.label,
          )
          .map((col) => {
            usedNodeIds.add(col.id);
            const reports = (children.get(col.id) ?? [])
              .filter((l) => l.node.type === "report")
              .map((l) => {
                usedNodeIds.add(l.node.id);
                return { node: l.node, label: l.label };
              });
            const stitches = (children.get(col.id) ?? [])
              .filter((l) => l.node.type === "column")
              .map((l) => ({ node: l.node, label: l.label }));
            return { node: col, reports, stitches };
          });
        tables.push({ node: table, columns });
      }
    }

    branches.push({ node: dbNode, tables });
  }

  const orphanReports = nodes.filter((n) => n.type === "report" && !usedNodeIds.has(n.id));
  return { databases: branches, orphanReports };
}

export function relatedNodeIds(graph: LineageGraph, nodeId: string): Set<string> {
  const edges = graph.edges.map((e) =>
    normalizeEdge(e as LineageEdge & { source?: string; target?: string }),
  );
  const related = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (related.has(edge.source_id) && !related.has(edge.target_id)) {
        related.add(edge.target_id);
        changed = true;
      }
      if (related.has(edge.target_id) && !related.has(edge.source_id)) {
        related.add(edge.source_id);
        changed = true;
      }
    }
  }
  return related;
}
