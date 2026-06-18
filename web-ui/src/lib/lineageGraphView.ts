import type { LineageGraph, LineageNode } from "../types";
import { buildLineageTree, type LineageTree, type TableBranch } from "./lineageLayout";

export const LARGE_GRAPH_NODE_THRESHOLD = 30;
export const DEFAULT_COLUMN_PREVIEW = 6;

export type LineageDisplayMode = "auto" | "overview" | "focused" | "full";
export type LineageColumnScope = "all" | "sensitive";

/** Confidential, Restricted, PII, or High/Medium sensitivity. */
export function isSensitiveLineageNode(node: LineageNode): boolean {
  const classification = (node.classification ?? "").toLowerCase();
  return (
    node.sensitivity === "High" ||
    node.sensitivity === "Medium" ||
    classification === "restricted" ||
    classification === "confidential" ||
    classification === "pii"
  );
}

export function filterTreeByColumnScope(
  tree: LineageTree,
  scope: LineageColumnScope,
): LineageTree {
  if (scope === "all") return tree;

  const databases = tree.databases
    .map((db) => {
      const tables = db.tables
        .map((table) => ({
          ...table,
          columns: table.columns.filter((col) => isSensitiveLineageNode(col.node)),
        }))
        .filter((table) => table.columns.length > 0);
      return { ...db, tables };
    })
    .filter((db) => db.tables.length > 0);

  return { databases, orphanReports: [] };
}

export function graphFromLineageTree(
  original: LineageGraph,
  tree: LineageTree,
): LineageGraph {
  const keepIds = new Set<string>();
  for (const db of tree.databases) {
    keepIds.add(db.node.id);
    for (const table of db.tables) {
      keepIds.add(table.node.id);
      for (const col of table.columns) {
        keepIds.add(col.node.id);
        for (const report of col.reports) keepIds.add(report.node.id);
        for (const stitch of col.stitches) keepIds.add(stitch.node.id);
      }
    }
  }
  for (const report of tree.orphanReports) keepIds.add(report.id);

  return {
    ...original,
    nodes: original.nodes.filter((n) => keepIds.has(n.id)),
    edges: original.edges.filter(
      (e) => keepIds.has(e.source_id) && keepIds.has(e.target_id),
    ),
  };
}

export function applyColumnScopeToGraph(
  graph: LineageGraph,
  scope: LineageColumnScope,
): LineageGraph {
  if (scope === "all") return graph;
  const tree = buildLineageTree(graph);
  const filtered = filterTreeByColumnScope(tree, scope);
  return graphFromLineageTree(graph, filtered);
}

export function countSensitiveColumns(graph: LineageGraph): number {
  return graph.nodes.filter((n) => n.type === "column" && isSensitiveLineageNode(n)).length;
}

export function isLargeGraph(graph: LineageGraph): boolean {
  return graph.nodes.length >= LARGE_GRAPH_NODE_THRESHOLD;
}

export function resolveDisplayMode(
  mode: LineageDisplayMode,
  graph: LineageGraph,
  hasSelection: boolean,
): "overview" | "focused" | "full" {
  if (mode === "full") return "full";
  if (mode === "overview") return "overview";
  if (mode === "focused") return hasSelection ? "focused" : "overview";
  return isLargeGraph(graph) ? "overview" : "full";
}

export function filterTreeByAllowedIds(tree: LineageTree, allowed: Set<string> | null): LineageTree {
  if (!allowed) return tree;

  const databases = tree.databases
    .map((db) => {
      const tables = db.tables
        .map((table) => {
          const columns = table.columns
            .map((col) => ({
              ...col,
              reports: col.reports.filter((r) => allowed.has(r.node.id)),
              stitches: col.stitches.filter((s) => allowed.has(s.node.id)),
            }))
            .filter(
              (col) =>
                allowed.has(col.node.id) ||
                col.reports.length > 0 ||
                col.stitches.length > 0,
            );
          return { ...table, columns };
        })
        .filter((table) => allowed.has(table.node.id) || table.columns.length > 0);
      return { ...db, tables };
    })
    .filter((db) => allowed.has(db.node.id) || db.tables.length > 0);

  return {
    databases,
    orphanReports: tree.orphanReports.filter((n) => allowed.has(n.id)),
  };
}

export function filterTreeBySearch(tree: LineageTree, searchMatchIds: Set<string>): LineageTree {
  if (!searchMatchIds.size) return tree;

  const databases = tree.databases
    .map((db) => {
      const tables = db.tables
        .map((table) => {
          const columns = table.columns.filter(
            (col) =>
              searchMatchIds.has(col.node.id) ||
              col.reports.some((r) => searchMatchIds.has(r.node.id)) ||
              col.stitches.some((s) => searchMatchIds.has(s.node.id)),
          );
          return { ...table, columns };
        })
        .filter(
          (table) =>
            searchMatchIds.has(table.node.id) ||
            table.columns.length > 0,
        );
      return { ...db, tables };
    })
    .filter((db) => searchMatchIds.has(db.node.id) || db.tables.length > 0);

  return {
    databases,
    orphanReports: tree.orphanReports.filter((n) => searchMatchIds.has(n.id)),
  };
}

export interface LineageOverviewStats {
  databases: number;
  tables: number;
  columns: number;
  reports: number;
}

export function summarizeTree(tree: LineageTree): LineageOverviewStats {
  let tables = 0;
  let columns = 0;
  let reports = 0;

  for (const db of tree.databases) {
    for (const table of db.tables) {
      tables += 1;
      columns += table.columns.length;
      for (const col of table.columns) {
        reports += col.reports.length;
      }
    }
  }
  reports += tree.orphanReports.length;

  return {
    databases: tree.databases.length,
    tables,
    columns,
    reports,
  };
}

export interface TableOverviewRow {
  branch: TableBranch;
  databaseLabel: string;
  reportCount: number;
}

export function flattenTablesForMap(tree: LineageTree): TableOverviewRow[] {
  const rows: TableOverviewRow[] = [];
  for (const db of tree.databases) {
    for (const table of db.tables) {
      const reportCount = table.columns.reduce((sum, col) => sum + col.reports.length, 0);
      rows.push({
        branch: table,
        databaseLabel: db.node.label,
        reportCount,
      });
    }
  }
  return rows;
}

export function findNodeInTree(tree: LineageTree, nodeId: string): LineageNode | null {
  for (const db of tree.databases) {
    if (db.node.id === nodeId) return db.node;
    for (const table of db.tables) {
      if (table.node.id === nodeId) return table.node;
      for (const col of table.columns) {
        if (col.node.id === nodeId) return col.node;
        for (const r of col.reports) {
          if (r.node.id === nodeId) return r.node;
        }
      }
    }
  }
  return tree.orphanReports.find((n) => n.id === nodeId) ?? null;
}
