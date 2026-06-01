import { useMemo, useState } from "react";
import { ArrowRight, Database, FileBarChart, Shield, Table2 } from "lucide-react";
import {
  buildLineageTree,
  normalizeLineageGraph,
  relatedNodeIds,
  type ColumnBranch,
  type DatabaseBranch,
  type TableBranch,
} from "../lib/lineageLayout";
import type { LineageGraph, LineageNode } from "../types";

const TYPE_STYLES: Record<
  string,
  { bg: string; border: string; text: string; icon: typeof Database }
> = {
  database: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-400",
    text: "text-blue-900 dark:text-blue-100",
    icon: Database,
  },
  table: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-400",
    text: "text-emerald-900 dark:text-emerald-100",
    icon: Table2,
  },
  column: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-400",
    text: "text-orange-900 dark:text-orange-100",
    icon: Shield,
  },
  report: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-400",
    text: "text-violet-900 dark:text-violet-100",
    icon: FileBarChart,
  },
};

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
  onSelect?: (node: LineageNode | null) => void;
}

export function LineageGraphView({ graph, selectedId, onSelect }: LineageGraphViewProps) {
  const normalized = useMemo(() => normalizeLineageGraph(graph), [graph]);
  const tree = useMemo(() => buildLineageTree(normalized), [normalized]);
  const highlight = useMemo(
    () => (selectedId ? relatedNodeIds(normalized, selectedId) : null),
    [normalized, selectedId],
  );

  if (!graph.nodes.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center dark:border-slate-600 dark:bg-slate-900/40">
        <Database className="mx-auto mb-3 h-10 w-10 text-slate-400" />
        <p className="font-medium text-slate-700 dark:text-slate-200">No lineage yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Run <strong>Semantic Mapping</strong> with <strong>Save to database</strong> enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">How to read this</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>
            <strong>Blue box</strong> = source database (where data lives)
          </li>
          <li>
            <strong>Green box</strong> = table inside that database
          </li>
          <li>
            <strong>Orange box</strong> = column/field with governance classification
          </li>
          <li>
            <strong>Purple box</strong> = downstream report or dashboard that uses that column
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Read top to bottom inside each card: <em>database → table → column → report</em>. Click any
          node to highlight its full path.
        </p>
      </div>

      <div className="space-y-5">
        {tree.databases.map((branch) => (
          <DatabasePipeline
            key={branch.node.id}
            branch={branch}
            selectedId={selectedId}
            highlight={highlight}
            onSelect={onSelect}
          />
        ))}
      </div>

      {tree.orphanReports.length > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-950/20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-600">
            Unlinked downstream reports
          </p>
          <div className="flex flex-wrap gap-2">
            {tree.orphanReports.map((n) => (
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
    </div>
  );
}

function DatabasePipeline({
  branch,
  selectedId,
  highlight,
  onSelect,
}: {
  branch: DatabaseBranch;
  selectedId?: string | null;
  highlight: Set<string> | null;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const style = TYPE_STYLES.database;
  const Icon = style.icon;
  const dbDimmed = highlight !== null && !highlight.has(branch.node.id);

  return (
    <div
      className={`overflow-hidden rounded-2xl border-2 shadow-sm transition ${style.border} ${dbDimmed ? "opacity-40" : "opacity-100"}`}
    >
      <button
        type="button"
        onClick={() => onSelect?.(branch.node)}
        className={`flex w-full items-center gap-3 border-b px-5 py-4 text-left ${style.bg} ${selectedId === branch.node.id ? "ring-2 ring-inset ring-indigo-400" : ""}`}
      >
        <Icon className={`h-5 w-5 ${style.text}`} />
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${style.text} opacity-70`}>
            Source database
          </p>
          <p className={`text-lg font-semibold ${style.text}`}>{branch.node.label}</p>
        </div>
      </button>

      <div className="space-y-4 bg-white p-5 dark:bg-slate-950">
        {branch.tables.length === 0 ? (
          <p className="text-sm text-slate-500">No tables linked yet.</p>
        ) : (
          branch.tables.map((table) => (
            <TableSection
              key={table.node.id}
              table={table}
              selectedId={selectedId}
              highlight={highlight}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TableSection({
  table,
  selectedId,
  highlight,
  onSelect,
}: {
  table: TableBranch;
  selectedId?: string | null;
  highlight: Set<string> | null;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const style = TYPE_STYLES.table;
  const Icon = style.icon;
  const dimmed = highlight !== null && !highlight.has(table.node.id);

  return (
    <div className={`overflow-hidden rounded-xl border ${style.border} ${dimmed ? "opacity-40" : ""}`}>
      <button
        type="button"
        onClick={() => onSelect?.(table.node)}
        className={`flex w-full items-center gap-2 border-b px-4 py-3 text-left ${style.bg} ${selectedId === table.node.id ? "ring-2 ring-inset ring-indigo-400" : ""}`}
      >
        <Icon className={`h-4 w-4 ${style.text}`} />
        <span className={`font-semibold ${style.text}`}>{table.node.label}</span>
        <span className="text-xs text-slate-500">({table.columns.length} columns)</span>
      </button>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {table.columns.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">No columns analyzed for this table.</p>
        ) : (
          table.columns.map((col) => (
            <ColumnRow
              key={col.node.id}
              column={col}
              selectedId={selectedId}
              highlight={highlight}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ColumnRow({
  column,
  selectedId,
  highlight,
  onSelect,
}: {
  column: ColumnBranch;
  selectedId?: string | null;
  highlight: Set<string> | null;
  onSelect?: (node: LineageNode | null) => void;
}) {
  const dimmed = highlight !== null && !highlight.has(column.node.id);

  return (
    <div className={`px-4 py-3 ${dimmed ? "opacity-40" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onSelect?.(column.node)}
          className={`rounded-lg border-2 border-orange-300 bg-orange-50 px-3 py-2 text-left transition hover:shadow-sm dark:border-orange-700 dark:bg-orange-950/30 ${selectedId === column.node.id ? "ring-2 ring-indigo-400" : ""}`}
        >
          <p className="font-mono text-sm font-semibold text-orange-900 dark:text-orange-100">
            {column.node.label}
          </p>
          {column.node.details && (
            <p className="mt-0.5 max-w-md text-xs text-slate-500 line-clamp-2">{column.node.details}</p>
          )}
        </button>

        {sensitivityBadge(column.node)}

        {column.reports.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-xs text-slate-500">feeds</span>
            {column.reports.map(({ node, label }) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect?.(node)}
                className={`flex items-center gap-1.5 rounded-lg border-2 border-violet-300 bg-violet-50 px-3 py-2 text-left text-sm font-medium text-violet-900 transition hover:shadow-sm dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-100 ${selectedId === node.id ? "ring-2 ring-indigo-400" : ""} ${highlight !== null && !highlight.has(node.id) ? "opacity-40" : ""}`}
              >
                <FileBarChart className="h-3.5 w-3.5" />
                {node.label}
                {label && <span className="text-[10px] font-normal text-violet-600">· {label}</span>}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs italic text-slate-400">No downstream report linked yet</span>
        )}

        {column.stitches.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-2 dark:border-slate-700">
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
              Policy stitch
            </span>
            {column.stitches.map(({ node, label }) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect?.(node)}
                className={`rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-100 ${selectedId === node.id ? "ring-2 ring-indigo-400" : ""}`}
                title={label || "same entity in another system"}
              >
                ↔ {node.database_name}.{node.table_name}.{node.label}
                {label && <span className="text-indigo-600"> · {label}</span>}
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

export function LineageNodeDetail({ node }: { node: LineageNode | null }) {
  if (!node) {
    return (
      <p className="text-sm text-slate-500">
        Click a database, table, column, or report to see governance details on that path.
      </p>
    );
  }

  const style = TYPE_STYLES[node.type] ?? TYPE_STYLES.column;
  const Icon = style.icon;
  const rows: [string, string][] = [["Type", node.type], ["Label", node.label]];
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

export function LineageGraphViewWithSelection({ graph }: { graph: LineageGraph }) {
  const [selected, setSelected] = useState<LineageNode | null>(null);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <LineageGraphView graph={graph} selectedId={selected?.id} onSelect={setSelected} />
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Selected node</p>
        <LineageNodeDetail node={selected} />
      </div>
    </div>
  );
}
