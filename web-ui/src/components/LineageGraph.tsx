import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  FileBarChart,
  Focus,
  GitBranch,
  Layers,
  ListTree,
  Maximize2,
  Minimize2,
  Shield,
  Table2,
} from "lucide-react";
import {
  buildLineageTree,
  normalizeLineageGraph,
  type ColumnBranch,
  type DatabaseBranch,
  type TableBranch,
} from "../lib/lineageLayout";
import {
  DEFAULT_COLUMN_PREVIEW,
  applyColumnScopeToGraph,
  filterTreeByAllowedIds,
  filterTreeBySearch,
  flattenTablesForMap,
  isLargeGraph,
  resolveDisplayMode,
  summarizeTree,
  type LineageColumnScope,
  type LineageDisplayMode,
} from "../lib/lineageGraphView";
import type { LineageGraph, LineageNode } from "../types";
import { LineageImpactPanel } from "./LineageImpactPanel";
import { LineageDiagramView } from "./LineageDiagramView";
import {
  computeLineageImpact,
  filterNodesByQuery,
  highlightForMode,
  type LineageViewMode,
} from "../lib/lineageImpact";

const TYPE_STYLES: Record<
  string,
  { bg: string; border: string; text: string; icon: typeof Database }
> = {
  database: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-400", text: "text-blue-900 dark:text-blue-100", icon: Database },
  table: { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-400", text: "text-emerald-900 dark:text-emerald-100", icon: Table2 },
  column: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-400", text: "text-orange-900 dark:text-orange-100", icon: Shield },
  report: { bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-400", text: "text-violet-900 dark:text-violet-100", icon: FileBarChart },
};

const DISPLAY_MODES: { id: LineageDisplayMode; label: string; hint: string; icon: typeof Eye }[] = [
  { id: "auto", label: "Auto", hint: "Compact when graph is large", icon: Layers },
  { id: "overview", label: "Overview", hint: "Tables collapsed — bird's-eye map", icon: Eye },
  { id: "focused", label: "Focused", hint: "Selected path only", icon: Focus },
  { id: "full", label: "Full detail", hint: "Expand every column", icon: Maximize2 },
];

function sensitivityBadge(node: LineageNode) {
  if (!node.sensitivity && !node.classification) return null;
  const tone =
    node.sensitivity === "High" || node.classification === "Restricted"
      ? "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200"
      : node.sensitivity === "Medium" || node.classification === "Confidential"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      {node.classification || node.sensitivity}
    </span>
  );
}

interface LineageGraphViewProps {
  graph: LineageGraph;
  selectedId?: string | null;
  highlight?: Set<string> | null;
  searchMatchIds?: Set<string>;
  displayMode?: LineageDisplayMode;
  onSelect?: (node: LineageNode | null) => void;
  onJumpToTable?: (tableId: string) => void;
  expandedTableIds?: Set<string> | null;
  onToggleTable?: (tableId: string) => void;
}

export function LineageGraphView({
  graph,
  selectedId,
  highlight = null,
  searchMatchIds,
  displayMode = "auto",
  onSelect,
  onJumpToTable,
  expandedTableIds,
  onToggleTable,
}: LineageGraphViewProps) {
  const normalized = useMemo(() => normalizeLineageGraph(graph), [graph]);
  const fullTree = useMemo(() => buildLineageTree(normalized), [normalized]);
  const hasSelection = Boolean(selectedId);
  const resolvedMode = resolveDisplayMode(displayMode, normalized, hasSelection);

  const visibleTree = useMemo(() => {
    let tree = fullTree;
    if (searchMatchIds?.size) {
      tree = filterTreeBySearch(tree, searchMatchIds);
    }
    if (resolvedMode === "focused" && highlight?.size) {
      tree = filterTreeByAllowedIds(tree, highlight);
    }
    return tree;
  }, [fullTree, searchMatchIds, resolvedMode, highlight]);

  const stats = useMemo(() => summarizeTree(fullTree), [fullTree]);
  const visibleStats = useMemo(() => summarizeTree(visibleTree), [visibleTree]);
  const tableMap = useMemo(() => flattenTablesForMap(fullTree), [fullTree]);
  const compact = resolvedMode === "overview" || resolvedMode === "focused";

  function tableExpanded(tableId: string): boolean {
    if (expandedTableIds == null) return !compact;
    return expandedTableIds.has(tableId);
  }

  if (!graph.nodes.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center dark:border-slate-600 dark:bg-slate-900/40">
        <Database className="mx-auto mb-3 h-10 w-10 text-slate-400" />
        <p className="font-medium text-slate-700 dark:text-slate-200">No lineage yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Run <strong>Semantic Mapping</strong> with <strong>Save to database</strong> enabled.
          AI-Assisted Data Governance will auto-build database → table → column → report flows.
        </p>
      </div>
    );
  }

  const filteredHint =
    resolvedMode === "focused" && hasSelection
      ? `Showing ${visibleStats.columns} of ${stats.columns} columns on the selected path`
      : searchMatchIds?.size
        ? `Filtered to ${visibleStats.tables} table(s) matching search`
        : null;

  return (
    <div className="space-y-4">
      <LineageOverviewMap
        stats={stats}
        tables={tableMap}
        selectedId={selectedId}
        searchMatchIds={searchMatchIds}
        onSelectTable={(tableId) => {
          onJumpToTable?.(tableId);
          onToggleTable?.(tableId);
        }}
        onSelect={onSelect}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Flow</span>
          {(["database", "table", "column", "report"] as const).map((type, i) => {
            const style = TYPE_STYLES[type];
            const Icon = style.icon;
            return (
              <span key={type} className="flex items-center gap-1.5">
                {i > 0 && <ArrowRight className="h-3 w-3 text-slate-400" />}
                <Icon className="h-3.5 w-3.5" />
                {type}
              </span>
            );
          })}
        </div>
        {filteredHint && (
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{filteredHint}</p>
        )}
        {!filteredHint && (
          <p className="text-xs text-slate-500">
            {isLargeGraph(normalized)
              ? "Large graph — use Overview or Focused mode · click a table in the map to jump"
              : "Click a node · use Blast radius for downstream impact"}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {visibleTree.databases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-600">
            No assets match the current filter. Clear search or switch to Overview / Full detail.
          </div>
        ) : (
          visibleTree.databases.map((branch) => (
            <DatabasePipeline
              key={branch.node.id}
              branch={branch}
              selectedId={selectedId}
              highlight={highlight}
              searchMatchIds={searchMatchIds}
              compact={compact}
              tableExpanded={tableExpanded}
              onToggleTable={onToggleTable}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {visibleTree.orphanReports.length > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-950/20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-600">
            Unlinked downstream reports ({visibleTree.orphanReports.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleTree.orphanReports.map((n) => (
              <NodePill
                key={n.id}
                node={n}
                selected={selectedId === n.id}
                dimmed={highlight !== null && !highlight.has(n.id)}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      )}

      {normalized.edges.length > 0 && !compact && (
        <details className="rounded-lg border border-slate-200 dark:border-slate-700">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300">
            All connections ({normalized.edges.length})
          </summary>
          <ConnectionList graph={normalized} selectedId={selectedId} onSelect={onSelect} />
        </details>
      )}
    </div>
  );
}

function LineageOverviewMap({
  stats,
  tables,
  selectedId,
  searchMatchIds,
  onSelectTable,
  onSelect,
}: {
  stats: ReturnType<typeof summarizeTree>;
  tables: ReturnType<typeof flattenTablesForMap>;
  selectedId?: string | null;
  searchMatchIds?: Set<string>;
  onSelectTable: (tableId: string) => void;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const byDatabase = useMemo(() => {
    const map = new Map<string, typeof tables>();
    for (const row of tables) {
      const bucket = map.get(row.databaseLabel) ?? [];
      bucket.push(row);
      map.set(row.databaseLabel, bucket);
    }
    return map;
  }, [tables]);

  if (stats.tables <= 3 && stats.columns <= 20) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-slate-700 dark:from-slate-900/80 dark:to-slate-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Bird&apos;s-eye map
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span>{stats.databases} db</span>
          <span>·</span>
          <span>{stats.tables} tables</span>
          <span>·</span>
          <span>{stats.columns} columns</span>
          <span>·</span>
          <span>{stats.reports} reports</span>
        </div>
      </div>
      <div className="space-y-3">
        {[...byDatabase.entries()].map(([dbLabel, dbTables]) => (
          <div key={dbLabel} className="flex flex-wrap items-start gap-2">
            <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
              <Database className="h-3 w-3" />
              {dbLabel}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {dbTables.map(({ branch, reportCount }) => {
                const active = selectedId === branch.node.id;
                const searchHit = searchMatchIds?.has(branch.node.id);
                return (
                  <button
                    key={branch.node.id}
                    type="button"
                    data-table-id={branch.node.id}
                    onClick={() => {
                      onSelect?.(branch.node);
                      onSelectTable(branch.node.id);
                    }}
                    className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                      active
                        ? "border-indigo-400 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-100"
                        : searchHit
                          ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                          : "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:border-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                    }`}
                    title={`${branch.columns.length} columns · ${reportCount} report link(s)`}
                  >
                    <Table2 className="h-3 w-3 shrink-0" />
                    <span className="truncate font-medium">{branch.node.label}</span>
                    <span className="text-[10px] opacity-70">({branch.columns.length})</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DatabasePipeline({
  branch,
  selectedId,
  highlight,
  searchMatchIds,
  compact,
  tableExpanded,
  onToggleTable,
  onSelect,
}: {
  branch: DatabaseBranch;
  selectedId?: string | null;
  highlight: Set<string> | null;
  searchMatchIds?: Set<string>;
  compact: boolean;
  tableExpanded: (tableId: string) => boolean;
  onToggleTable?: (tableId: string) => void;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const style = TYPE_STYLES.database;
  const Icon = style.icon;
  const dbDimmed = highlight !== null && !highlight.has(branch.node.id);
  const [dbExpanded, setDbExpanded] = useState(!compact || branch.tables.length <= 2);
  const tableCount = branch.tables.length;
  const columnCount = branch.tables.reduce((n, t) => n + t.columns.length, 0);

  useEffect(() => {
    if (!compact) setDbExpanded(true);
  }, [compact]);

  return (
    <div
      id={`db-${branch.node.id}`}
      className={`overflow-hidden rounded-2xl border-2 shadow-sm transition ${style.border} ${dbDimmed ? "opacity-40" : "opacity-100"}`}
    >
      <div className={`flex items-stretch border-b ${style.bg}`}>
        <button
          type="button"
          onClick={() => onSelect?.(branch.node)}
          className={`flex min-w-0 flex-1 items-center gap-3 px-5 py-4 text-left ${selectedId === branch.node.id ? "ring-2 ring-inset ring-indigo-400" : ""} ${searchMatchIds?.has(branch.node.id) ? "ring-2 ring-amber-300" : ""}`}
        >
          <Icon className={`h-5 w-5 shrink-0 ${style.text}`} />
          <div className="min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-wide ${style.text} opacity-70`}>
              Source database
            </p>
            <p className={`truncate text-lg font-semibold ${style.text}`}>{branch.node.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tableCount} table{tableCount === 1 ? "" : "s"} · {columnCount} columns
            </p>
          </div>
        </button>
        {compact && tableCount > 1 && (
          <button
            type="button"
            onClick={() => setDbExpanded((v) => !v)}
            className="flex shrink-0 items-center gap-1 border-l border-blue-200/60 px-4 text-xs font-medium text-blue-800 dark:border-blue-800 dark:text-blue-200"
            aria-expanded={dbExpanded}
          >
            {dbExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {dbExpanded ? "Collapse" : "Expand"}
          </button>
        )}
      </div>

      {dbExpanded && (
        <div className="space-y-3 bg-white p-4 dark:bg-slate-950">
          {branch.tables.length === 0 ? (
            <p className="text-sm text-slate-500">No tables linked yet.</p>
          ) : (
            branch.tables.map((table) => (
              <TableSection
                key={table.node.id}
                table={table}
                selectedId={selectedId}
                highlight={highlight}
                searchMatchIds={searchMatchIds}
                compact={compact}
                expanded={tableExpanded(table.node.id)}
                onToggle={() => onToggleTable?.(table.node.id)}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TableSection({
  table,
  selectedId,
  highlight,
  searchMatchIds,
  compact,
  expanded,
  onToggle,
  onSelect,
}: {
  table: TableBranch;
  selectedId?: string | null;
  highlight: Set<string> | null;
  searchMatchIds?: Set<string>;
  compact: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const style = TYPE_STYLES.table;
  const Icon = style.icon;
  const dimmed = highlight !== null && !highlight.has(table.node.id);
  const reportCount = table.columns.reduce((n, c) => n + c.reports.length, 0);
  const sensitiveCount = table.columns.filter(
    (c) =>
      c.node.classification === "Restricted" ||
      c.node.classification === "Confidential" ||
      c.node.sensitivity === "High" ||
      c.node.sensitivity === "Medium",
  ).length;

  return (
    <div
      id={`table-${table.node.id}`}
      data-table-id={table.node.id}
      className={`rounded-xl border ${style.border} ${dimmed ? "opacity-40" : ""} overflow-hidden scroll-mt-24`}
    >
      <div className={`flex items-stretch border-b ${style.bg}`}>
        <button
          type="button"
          onClick={() => {
            onSelect?.(table.node);
            if (compact) onToggle();
          }}
          className={`flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left ${selectedId === table.node.id ? "ring-2 ring-inset ring-indigo-400" : ""} ${searchMatchIds?.has(table.node.id) ? "ring-2 ring-amber-300" : ""}`}
        >
          <Icon className={`h-4 w-4 shrink-0 ${style.text}`} />
          <div className="min-w-0">
            <span className={`font-semibold ${style.text}`}>{table.node.label}</span>
            <p className="text-[11px] text-slate-500">
              {table.columns.length} columns
              {reportCount > 0 && ` · ${reportCount} report link${reportCount === 1 ? "" : "s"}`}
              {sensitiveCount > 0 && ` · ${sensitiveCount} sensitive`}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex shrink-0 items-center gap-1 border-l border-emerald-200/60 px-3 text-xs text-emerald-800 dark:border-emerald-800 dark:text-emerald-200"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {expanded ? "Hide" : "Show"}
        </button>
      </div>

      {expanded && (
        <TableColumns
          table={table}
          selectedId={selectedId}
          highlight={highlight}
          searchMatchIds={searchMatchIds}
          compact={compact}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function TableColumns({
  table,
  selectedId,
  highlight,
  searchMatchIds,
  compact,
  onSelect,
}: {
  table: TableBranch;
  selectedId?: string | null;
  highlight: Set<string> | null;
  searchMatchIds?: Set<string>;
  compact: boolean;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const previewLimit = compact ? DEFAULT_COLUMN_PREVIEW : table.columns.length;
  const [showAll, setShowAll] = useState(!compact || table.columns.length <= previewLimit);
  const visibleColumns = showAll ? table.columns : table.columns.slice(0, previewLimit);
  const hiddenCount = table.columns.length - visibleColumns.length;

  useEffect(() => {
    if (!compact) setShowAll(true);
  }, [compact]);

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {table.columns.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-500">No columns analyzed for this table.</p>
      ) : (
        <>
          {visibleColumns.map((col) => (
            <ColumnRow
              key={col.node.id}
              column={col}
              selectedId={selectedId}
              highlight={highlight}
              searchMatchIds={searchMatchIds}
              onSelect={onSelect}
            />
          ))}
          {hiddenCount > 0 && (
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                Show {hiddenCount} more column{hiddenCount === 1 ? "" : "s"}…
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ColumnRow({
  column,
  selectedId,
  highlight,
  searchMatchIds,
  onSelect,
}: {
  column: ColumnBranch;
  selectedId?: string | null;
  highlight: Set<string> | null;
  searchMatchIds?: Set<string>;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const dimmed = highlight !== null && !highlight.has(column.node.id);

  return (
    <div className={`px-4 py-2.5 ${dimmed ? "opacity-40" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelect?.(column.node)}
          className={`rounded-lg border-2 border-orange-300 bg-orange-50 px-2.5 py-1.5 text-left transition hover:shadow-sm dark:border-orange-700 dark:bg-orange-950/30 ${selectedId === column.node.id ? "ring-2 ring-indigo-400" : ""} ${searchMatchIds?.has(column.node.id) ? "ring-2 ring-amber-300" : ""}`}
        >
          <p className="font-mono text-xs font-semibold text-orange-900 dark:text-orange-100">
            {column.node.label}
          </p>
        </button>

        {sensitivityBadge(column.node)}

        {column.reports.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {column.reports.map(({ node, label }) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect?.(node)}
                className={`inline-flex items-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-900 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-100 ${selectedId === node.id ? "ring-2 ring-indigo-400" : ""} ${highlight !== null && !highlight.has(node.id) ? "opacity-40" : ""}`}
                title={label || node.details}
              >
                <FileBarChart className="h-3 w-3" />
                {node.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NodePill({
  node,
  selected,
  dimmed,
  onSelect,
}: {
  node: LineageNode;
  selected: boolean;
  dimmed: boolean;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const style = TYPE_STYLES[node.type] ?? TYPE_STYLES.column;
  const Icon = style.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(node)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${style.bg} ${style.border} ${style.text} ${selected ? "ring-2 ring-indigo-400" : ""} ${dimmed ? "opacity-40" : ""}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {node.label}
    </button>
  );
}

function ConnectionList({
  graph,
  selectedId,
  onSelect,
}: {
  graph: LineageGraph;
  selectedId?: string | null;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  return (
    <ul className="max-h-64 space-y-1 overflow-y-auto px-4 pb-4 text-sm">
      {graph.edges.map((e) => {
        const src = nodeMap.get(e.source_id);
        const tgt = nodeMap.get(e.target_id);
        const active = selectedId === e.source_id || selectedId === e.target_id;
        return (
          <li
            key={e.id}
            className={`flex flex-wrap items-center gap-2 rounded px-2 py-1 ${active ? "bg-indigo-50 dark:bg-indigo-950/40" : ""}`}
          >
            <button type="button" className="font-medium hover:text-indigo-600" onClick={() => src && onSelect?.(src)}>
              {src?.label ?? e.source_id}
            </button>
            <ArrowRight className="h-3 w-3 text-slate-400" />
            <button type="button" className="font-medium hover:text-indigo-600" onClick={() => tgt && onSelect?.(tgt)}>
              {tgt?.label ?? e.target_id}
            </button>
            {e.label && <span className="text-xs text-indigo-600">({e.label})</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function LineageNodeDetail({ node }: { node: LineageNode | null }) {
  if (!node) {
    return (
      <p className="text-sm text-slate-500">
        Select a database, table, column, or report to inspect governance metadata on its lineage path.
      </p>
    );
  }

  const style = TYPE_STYLES[node.type] ?? TYPE_STYLES.column;
  const Icon = style.icon;
  const rows: [string, string][] = [
    ["Type", node.type],
    ["Label", node.label],
  ];
  if (node.database_name) rows.push(["Database", node.database_name]);
  if (node.table_name) rows.push(["Table", node.table_name]);
  if (node.classification) rows.push(["Classification", node.classification]);
  if (node.sensitivity) rows.push(["Sensitivity", node.sensitivity]);
  if (node.details) rows.push(["Details", node.details]);

  return (
    <div className={`rounded-xl border p-4 ${style.border} ${style.bg}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${style.text}`} />
        <h3 className={`font-semibold ${style.text}`}>{node.label}</h3>
      </div>
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-2">
            <dt className="text-slate-500">{k}</dt>
            <dd className="col-span-2 text-slate-800 dark:text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LineageGraphViewWithSelection({
  graph,
  search = "",
  columnScope = "all",
}: {
  graph: LineageGraph;
  search?: string;
  columnScope?: LineageColumnScope;
}) {
  const [selected, setSelected] = useState<LineageNode | null>(null);
  const [viewMode, setViewMode] = useState<LineageViewMode>("full");
  const [displayMode, setDisplayMode] = useState<LineageDisplayMode>("auto");
  const [canvasView, setCanvasView] = useState<"list" | "diagram">("list");
  const [expandedTables, setExpandedTables] = useState<Set<string> | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);

  const scopedGraph = useMemo(
    () => applyColumnScopeToGraph(graph, columnScope),
    [graph, columnScope],
  );
  const normalized = useMemo(() => normalizeLineageGraph(scopedGraph), [scopedGraph]);

  useEffect(() => {
    if (!selected) return;
    if (!normalized.nodes.some((n) => n.id === selected.id)) {
      setSelected(null);
    }
  }, [normalized, selected]);
  const large = isLargeGraph(normalized);

  const impact = useMemo(
    () => (selected ? computeLineageImpact(normalized, selected.id) : null),
    [normalized, selected],
  );
  const highlight = useMemo(
    () => (selected ? highlightForMode(normalized, selected.id, viewMode) : null),
    [normalized, selected, viewMode],
  );
  const searchMatches = useMemo(() => {
    const matches = filterNodesByQuery(normalized.nodes, search);
    return new Set(matches.map((n) => n.id));
  }, [normalized, search]);

  const resolvedDisplay = resolveDisplayMode(displayMode, normalized, Boolean(selected));
  const listCompact =
    resolvedDisplay === "overview" || resolvedDisplay === "focused";

  const highlightLabel = useMemo(() => {
    if (!selected || !highlight) return null;
    if (viewMode === "downstream") {
      return `Blast radius — ${highlight.size} asset${highlight.size === 1 ? "" : "s"} highlighted`;
    }
    if (viewMode === "upstream") {
      return `Upstream — ${highlight.size} asset${highlight.size === 1 ? "" : "s"} highlighted`;
    }
    return `Full path — ${highlight.size} asset${highlight.size === 1 ? "" : "s"} highlighted`;
  }, [selected, highlight, viewMode]);

  useEffect(() => {
    setExpandedTables(null);
  }, [displayMode]);

  useEffect(() => {
    if (selected && resolvedDisplay === "focused") {
      setExpandedTables((prev) => {
        const next = prev === null ? new Set<string>() : new Set(prev);
        if (selected.type === "table") next.add(selected.id);
        if (selected.table_name) {
          const tableNode = normalized.nodes.find(
            (n) => n.type === "table" && n.label === selected.table_name,
          );
          if (tableNode) next.add(tableNode.id);
        }
        return next;
      });
    }
  }, [selected, resolvedDisplay, normalized.nodes]);

  function toggleTable(tableId: string) {
    setExpandedTables((prev) => {
      if (prev === null) {
        const allIds = normalized.nodes.filter((n) => n.type === "table").map((n) => n.id);
        const next = new Set(listCompact ? [] : allIds);
        if (next.has(tableId)) next.delete(tableId);
        else next.add(tableId);
        return next;
      }
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }

  function jumpToTable(tableId: string) {
    setExpandedTables((prev) => {
      const next = prev === null ? new Set<string>() : new Set(prev);
      next.add(tableId);
      return next;
    });
    window.requestAnimationFrame(() => {
      const el = graphRef.current?.querySelector(`[data-table-id="${tableId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function expandAllTables() {
    const ids = normalized.nodes.filter((n) => n.type === "table").map((n) => n.id);
    setExpandedTables(new Set(ids));
  }

  function collapseAllTables() {
    setExpandedTables(new Set());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">View</p>
          <p className="text-[11px] text-slate-500">
            {canvasView === "diagram"
              ? "Path view — pick an asset on the left, see its flow on the right"
              : large
                ? `${normalized.nodes.length} assets — use List overview or Path view`
                : `${normalized.nodes.length} assets`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-600">
            <button
              type="button"
              onClick={() => setCanvasView("diagram")}
              title="Pick an asset and trace its lineage path"
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
                canvasView === "diagram"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Path
            </button>
            <button
              type="button"
              onClick={() => setCanvasView("list")}
              title="Hierarchical list with expand/collapse"
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
                canvasView === "list"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <ListTree className="h-3.5 w-3.5" />
              List
            </button>
          </div>
          <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
          {canvasView === "list" && (
            <>
              {DISPLAY_MODES.map((m) => {
                const Icon = m.icon;
                const active = displayMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDisplayMode(m.id)}
                    title={m.hint}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      active
                        ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                );
              })}
              <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
              <button
                type="button"
                onClick={expandAllTables}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              >
                <Maximize2 className="h-3 w-3" /> Expand tables
              </button>
              <button
                type="button"
                onClick={collapseAllTables}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              >
                <Minimize2 className="h-3 w-3" /> Collapse
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div ref={graphRef}>
          {search && (
            <p className="mb-3 text-xs text-slate-500">
              {searchMatches.size} search match(es) — graph filtered to matching branches
            </p>
          )}
          {highlightLabel && (
            <p className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
              {highlightLabel}
            </p>
          )}
          {canvasView === "diagram" ? (
            <LineageDiagramView
              graph={normalized}
              selectedId={selected?.id}
              viewMode={viewMode}
              highlight={highlight}
              search={search}
              onSelect={setSelected}
            />
          ) : (
            <LineageGraphView
              graph={normalized}
              selectedId={selected?.id}
              highlight={highlight}
              searchMatchIds={search ? searchMatches : undefined}
              displayMode={displayMode}
              expandedTableIds={expandedTables}
              onToggleTable={toggleTable}
              onJumpToTable={jumpToTable}
              onSelect={setSelected}
            />
          )}
        </div>
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <LineageImpactPanel
            impact={impact}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onSelectNode={setSelected}
          />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Asset metadata
            </p>
            <LineageNodeDetail node={selected} />
          </div>
        </div>
      </div>
    </div>
  );
}
