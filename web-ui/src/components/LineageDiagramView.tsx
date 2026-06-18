import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Database,
  FileBarChart,
  GitBranch,
  Search,
  Shield,
  Table2,
} from "lucide-react";
import {
  buildAssetTree,
  buildPathDiagram,
  filterAssetTree,
  STAGE_STYLES,
  type PathStageType,
} from "../lib/lineagePathDiagram";
import type { LineageGraph, LineageNode } from "../types";
import type { LineageViewMode } from "../lib/lineageImpact";

interface LineageDiagramViewProps {
  graph: LineageGraph;
  selectedId?: string | null;
  viewMode?: LineageViewMode;
  highlight?: Set<string> | null;
  search?: string;
  onSelect?: (node: LineageNode | null) => void;
}

export function LineageDiagramView({
  graph,
  selectedId,
  viewMode = "full",
  highlight = null,
  search = "",
  onSelect,
}: LineageDiagramViewProps) {
  const [pickerSearch, setPickerSearch] = useState(search);
  const [expandedDb, setExpandedDb] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  useEffect(() => {
    setPickerSearch(search);
  }, [search]);

  const tree = useMemo(() => buildAssetTree(graph), [graph]);
  const filteredTree = useMemo(
    () => filterAssetTree(tree, pickerSearch || search),
    [tree, pickerSearch, search],
  );

  const pathModel = useMemo(
    () => (selectedId ? buildPathDiagram(graph, selectedId, viewMode) : null),
    [graph, selectedId, viewMode],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
      <AssetPicker
        tree={filteredTree}
        selectedId={selectedId}
        highlight={highlight}
        search={pickerSearch}
        onSearchChange={setPickerSearch}
        expandedDb={expandedDb}
        expandedTable={expandedTable}
        onToggleDb={(id) => setExpandedDb((v) => (v === id ? null : id))}
        onToggleTable={(id) => setExpandedTable((v) => (v === id ? null : id))}
        onSelect={(node) => {
          onSelect?.(node);
          if (node.type === "database") setExpandedDb(node.id);
          if (node.type === "table") setExpandedTable(node.id);
        }}
      />

      <div className="min-w-0">
        {!pathModel ? (
          <PathEmptyState graph={graph} onSelect={onSelect} />
        ) : (
          <PathFlowDiagram
            key={viewMode}
            model={pathModel}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  );
}

function AssetPicker({
  tree,
  selectedId,
  highlight,
  search,
  onSearchChange,
  expandedDb,
  expandedTable,
  onToggleDb,
  onToggleTable,
  onSelect,
}: {
  tree: ReturnType<typeof buildAssetTree>;
  selectedId?: string | null;
  highlight?: Set<string> | null;
  search: string;
  onSearchChange: (v: string) => void;
  expandedDb: string | null;
  expandedTable: string | null;
  onToggleDb: (id: string) => void;
  onToggleTable: (id: string) => void;
  onSelect: (node: LineageNode) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-3 py-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          1 · Pick an asset
        </p>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tables, fields…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
          />
        </div>
      </div>

      <ul className="max-h-[min(60vh,520px)] space-y-1 overflow-y-auto p-2">
        {tree.length === 0 && (
          <li className="px-2 py-6 text-center text-xs text-slate-500">No matching assets</li>
        )}
        {tree.map(({ database, tables }) => {
          const dbOpen = expandedDb === database.id || Boolean(search);
          return (
            <li key={database.id}>
              <PickerRow
                node={database}
                icon={Database}
                selected={selectedId === database.id}
                dimmed={Boolean(highlight && !highlight.has(database.id))}
                open={dbOpen}
                onToggle={() => onToggleDb(database.id)}
                onSelect={() => onSelect(database)}
                hasChildren={tables.length > 0}
              />
              {dbOpen &&
                tables.map(({ table, columns, reports }) => {
                  const tblOpen = expandedTable === table.id || Boolean(search);
                  return (
                    <div key={table.id} className="ml-3 border-l border-slate-200 pl-1 dark:border-slate-700">
                      <PickerRow
                        node={table}
                        icon={Table2}
                        selected={selectedId === table.id}
                        dimmed={Boolean(highlight && !highlight.has(table.id))}
                        open={tblOpen}
                        onToggle={() => onToggleTable(table.id)}
                        onSelect={() => onSelect(table)}
                        hasChildren={columns.length + reports.length > 0}
                        sub={`${columns.length} fields`}
                      />
                      {tblOpen && (
                        <div className="ml-3 space-y-0.5 border-l border-slate-100 pl-1 dark:border-slate-800">
                          {columns.map((col) => (
                            <PickerRow
                              key={col.id}
                              node={col}
                              icon={Shield}
                              selected={selectedId === col.id}
                              dimmed={Boolean(highlight && !highlight.has(col.id))}
                              onSelect={() => onSelect(col)}
                              sub={col.classification}
                              compact
                            />
                          ))}
                          {reports.map((r) => (
                            <PickerRow
                              key={r.id}
                              node={r}
                              icon={FileBarChart}
                              selected={selectedId === r.id}
                              dimmed={Boolean(highlight && !highlight.has(r.id))}
                              onSelect={() => onSelect(r)}
                              compact
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PickerRow({
  node,
  icon: Icon,
  selected,
  dimmed,
  open,
  onToggle,
  onSelect,
  hasChildren,
  sub,
  compact,
}: {
  node: LineageNode;
  icon: typeof Database;
  selected: boolean;
  dimmed?: boolean;
  open?: boolean;
  onToggle?: () => void;
  onSelect: () => void;
  hasChildren?: boolean;
  sub?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {hasChildren && onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      ) : (
        <span className="w-4" />
      )}
      <button
        type="button"
        onClick={onSelect}
        className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition ${
          selected
            ? "bg-indigo-50 ring-1 ring-indigo-300 dark:bg-indigo-950/50 dark:ring-indigo-700"
            : dimmed
              ? "opacity-35 hover:opacity-60"
              : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
        } ${compact ? "py-0.5" : ""}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className={`truncate ${compact ? "text-[11px]" : "text-xs"} font-medium text-slate-800 dark:text-slate-200`}>
          {node.label}
        </span>
        {sub && (
          <span className="ml-auto shrink-0 text-[10px] text-slate-400">{sub}</span>
        )}
      </button>
    </div>
  );
}

function PathEmptyState({
  graph,
  onSelect,
}: {
  graph: LineageGraph;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const suggestions = useMemo(() => {
    const reports = graph.nodes.filter((n) => n.type === "report").slice(0, 3);
    const sensitive = graph.nodes
      .filter((n) => n.type === "column" && (n.classification === "Restricted" || n.sensitivity === "High"))
      .slice(0, 3);
    return [...reports, ...sensitive].slice(0, 4);
  }, [graph]);

  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-600 dark:bg-slate-900/40">
      <GitBranch className="mb-3 h-10 w-10 text-indigo-400" />
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Select an asset to trace its path
      </p>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
        Choose a database, table, field, or report from the list on the left. The diagram will show
        how data flows from source to downstream reports.
      </p>
      {suggestions.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {suggestions.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect?.(n)}
              className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
            >
              {n.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PathFlowDiagram({
  model,
  selectedId,
  onSelect,
}: {
  model: NonNullable<ReturnType<typeof buildPathDiagram>>;
  selectedId?: string | null;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const modeLabel =
    model.viewMode === "downstream"
      ? "Blast radius"
      : model.viewMode === "upstream"
        ? "Upstream sources"
        : "Full path";

  const modeTone =
    model.viewMode === "downstream"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      : model.viewMode === "upstream"
        ? "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
        : "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100";

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border px-4 py-3 ${modeTone}`}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          2 · Lineage path · {modeLabel}
        </p>
        <p className="mt-1 text-sm">
          Tracing <strong>{model.selected.label}</strong>
          <span className="ml-1 opacity-70">({model.selected.type})</span>
        </p>
        <p className="mt-1 text-xs opacity-80">
          Showing <strong>{model.highlightedCount}</strong> asset
          {model.highlightedCount === 1 ? "" : "s"} — change highlight mode on the right panel
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
        {model.stages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No assets in this direction for the selected highlight mode.
          </p>
        ) : (
          <div className="flex min-w-max items-start gap-2">
            {model.stages.map((stage, stageIdx) => (
              <div key={stage.type} className="flex items-start gap-2">
                {stageIdx > 0 && (
                  <div className="flex shrink-0 flex-col items-center justify-center self-center px-1">
                    <ArrowRight className="h-5 w-5 text-indigo-400 lineage-path-arrow" />
                  </div>
                )}
                <StageColumn
                  stage={stage}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {model.crossLinks.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Cross-system stitches
          </p>
          <ul className="space-y-2">
            {model.crossLinks.map((link) => (
              <li
                key={`${link.source.id}-${link.target.id}`}
                className="flex flex-wrap items-center gap-2 text-xs text-amber-900 dark:text-amber-100"
              >
                <button
                  type="button"
                  onClick={() => onSelect?.(link.source)}
                  className="rounded-md bg-white px-2 py-1 font-mono ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-800"
                >
                  {link.source.database_name}.{link.source.table_name}.{link.source.label}
                </button>
                <ArrowRight className="h-3.5 w-3.5 text-amber-500" />
                <button
                  type="button"
                  onClick={() => onSelect?.(link.target)}
                  className="rounded-md bg-white px-2 py-1 font-mono ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-800"
                >
                  {link.target.database_name}.{link.target.table_name}.{link.target.label}
                </button>
                {link.label && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] dark:bg-amber-900/50">
                    {link.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StageColumn({
  stage,
  selectedId,
  onSelect,
}: {
  stage: { type: PathStageType; label: string; nodes: LineageNode[] };
  selectedId?: string | null;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const style = STAGE_STYLES[stage.type];

  return (
    <div className="w-[min(100vw,220px)] shrink-0 sm:w-[200px]">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stage.label}</p>
      </div>
      <div className="space-y-2">
        {stage.nodes.map((node, i) => {
          const selected = selectedId === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect?.(node)}
              className={`lineage-path-card block w-full rounded-xl border-2 p-3 text-left transition ${style.border} ${style.bg} ${
                selected ? "ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-slate-950" : "hover:shadow-md"
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${style.badge}`}>
                {node.type}
              </span>
              <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
                {node.label}
              </p>
              {node.database_name && node.type !== "database" && (
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                  {node.database_name}
                  {node.table_name ? `.${node.table_name}` : ""}
                </p>
              )}
              {(node.classification || node.sensitivity) && (
                <p className="mt-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                  {node.classification || node.sensitivity}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
