import type { LineageGraph, LineageNode } from "../types";
import { normalizeLineageGraph } from "./lineageLayout";
import { highlightForMode, type LineageViewMode } from "./lineageImpact";

const STAGE_ORDER = ["database", "table", "column", "report"] as const;
export type PathStageType = (typeof STAGE_ORDER)[number];

export interface PathStage {
  type: PathStageType;
  label: string;
  nodes: LineageNode[];
}

export interface PathDiagramModel {
  stages: PathStage[];
  crossLinks: { label: string; source: LineageNode; target: LineageNode }[];
  selected: LineageNode;
  viewMode: LineageViewMode;
  highlightedCount: number;
}

/** Primary lineage chain for the selected asset — grouped by stage. */
export function buildPathDiagram(
  graph: LineageGraph,
  nodeId: string,
  viewMode: LineageViewMode = "full",
): PathDiagramModel | null {
  const normalized = normalizeLineageGraph(graph);
  const map = nodeMap(normalized);
  const selected = map.get(nodeId);
  if (!selected) return null;

  const related = highlightForMode(normalized, nodeId, viewMode);
  const relatedNodes = normalized.nodes.filter((n) => related.has(n.id));

  const stages: PathStage[] = STAGE_ORDER.map((type) => ({
    type,
    label: stageLabel(type),
    nodes: relatedNodes
      .filter((n) => n.type === type)
      .sort((a, b) => {
        const db = (a.database_name ?? "").localeCompare(b.database_name ?? "");
        if (db !== 0) return db;
        const tbl = (a.table_name ?? "").localeCompare(b.table_name ?? "");
        if (tbl !== 0) return tbl;
        return a.label.localeCompare(b.label);
      }),
  })).filter((s) => s.nodes.length > 0);

  const crossLinks: PathDiagramModel["crossLinks"] = [];
  for (const edge of normalized.edges) {
    if (!related.has(edge.source_id) || !related.has(edge.target_id)) continue;
    const src = map.get(edge.source_id);
    const tgt = map.get(edge.target_id);
    if (!src || !tgt) continue;
    if (src.type === "column" && tgt.type === "column") {
      crossLinks.push({ label: edge.label || "stitched", source: src, target: tgt });
    }
  }

  return { stages, crossLinks, selected, viewMode, highlightedCount: related.size };
}

function nodeMap(graph: LineageGraph) {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}

function stageLabel(type: PathStageType): string {
  switch (type) {
    case "database":
      return "Source system";
    case "table":
      return "Table";
    case "column":
      return "Field";
    case "report":
      return "Downstream report";
  }
}

export interface AssetTreeGroup {
  database: LineageNode;
  tables: {
    table: LineageNode;
    columns: LineageNode[];
    reports: LineageNode[];
  }[];
}

/** Build a navigable tree for the asset picker. */
export function buildAssetTree(graph: LineageGraph): AssetTreeGroup[] {
  const normalized = normalizeLineageGraph(graph);
  const { nodes, edges } = normalized;

  const children = new Map<string, string[]>();
  for (const e of edges) {
    const bucket = children.get(e.source_id) ?? [];
    bucket.push(e.target_id);
    children.set(e.source_id, bucket);
  }

  const map = nodeMap(normalized);
  const groups: AssetTreeGroup[] = [];

  for (const db of nodes.filter((n) => n.type === "database").sort((a, b) => a.label.localeCompare(b.label))) {
    const tables: AssetTreeGroup["tables"] = [];

    const tableIds = (children.get(db.id) ?? [])
      .map((id) => map.get(id))
      .filter((n): n is LineageNode => n?.type === "table");

    for (const table of tableIds.sort((a, b) => a.label.localeCompare(b.label))) {
      const colIds = (children.get(table.id) ?? [])
        .map((id) => map.get(id))
        .filter((n): n is LineageNode => n?.type === "column");

      const columns = colIds.sort((a, b) => a.label.localeCompare(b.label));

      const reportSet = new Map<string, LineageNode>();
      for (const col of columns) {
        for (const rid of children.get(col.id) ?? []) {
          const r = map.get(rid);
          if (r?.type === "report") reportSet.set(r.id, r);
        }
      }

      tables.push({
        table,
        columns,
        reports: [...reportSet.values()].sort((a, b) => a.label.localeCompare(b.label)),
      });
    }

    if (!tables.length) {
      for (const table of nodes.filter((n) => n.type === "table" && n.database_name === db.label)) {
        const columns = nodes
          .filter(
            (n) =>
              n.type === "column" &&
              n.database_name === db.label &&
              n.table_name === table.label,
          )
          .sort((a, b) => a.label.localeCompare(b.label));
        tables.push({ table, columns, reports: [] });
      }
    }

    groups.push({ database: db, tables });
  }

  return groups;
}

export function filterAssetTree(
  tree: AssetTreeGroup[],
  query: string,
): AssetTreeGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree;

  return tree
    .map((g) => {
      const dbMatch = g.database.label.toLowerCase().includes(q);
      const tables = g.tables
        .map((t) => {
          const tableMatch = t.table.label.toLowerCase().includes(q) || dbMatch;
          const columns = t.columns.filter(
            (c) =>
              tableMatch ||
              c.label.toLowerCase().includes(q) ||
              (c.classification ?? "").toLowerCase().includes(q),
          );
          const reports = t.reports.filter(
            (r) => tableMatch || r.label.toLowerCase().includes(q),
          );
          if (tableMatch || columns.length || reports.length) {
            return { ...t, columns: tableMatch ? t.columns : columns, reports: tableMatch ? t.reports : reports };
          }
          return null;
        })
        .filter((t): t is AssetTreeGroup["tables"][0] => t !== null);

      if (dbMatch || tables.length) return { ...g, tables };
      return null;
    })
    .filter((g): g is AssetTreeGroup => g !== null);
}

export const STAGE_STYLES: Record<
  PathStageType,
  { border: string; bg: string; badge: string; dot: string }
> = {
  database: {
    border: "border-blue-300 dark:border-blue-700",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  table: {
    border: "border-emerald-300 dark:border-emerald-700",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  column: {
    border: "border-orange-300 dark:border-orange-700",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200",
    dot: "bg-orange-500",
  },
  report: {
    border: "border-violet-300 dark:border-violet-700",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200",
    dot: "bg-violet-500",
  },
};
