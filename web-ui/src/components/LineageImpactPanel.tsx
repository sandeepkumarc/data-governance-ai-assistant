import { AlertTriangle, ArrowDownRight, ArrowUpRight, FileBarChart, Link2 } from "lucide-react";
import type { LineageImpact, LineageViewMode } from "../lib/lineageImpact";
import type { LineageNode } from "../types";

interface LineageImpactPanelProps {
  impact: LineageImpact | null;
  viewMode: LineageViewMode;
  onViewModeChange: (mode: LineageViewMode) => void;
  onSelectNode?: (node: LineageNode) => void;
}

const MODES: { id: LineageViewMode; label: string; hint: string }[] = [
  { id: "full", label: "Full path", hint: "Upstream + downstream" },
  { id: "upstream", label: "Upstream", hint: "Sources feeding this asset" },
  { id: "downstream", label: "Blast radius", hint: "Downstream impact only" },
];

export function LineageImpactPanel({
  impact,
  viewMode,
  onViewModeChange,
  onSelectNode,
}: LineageImpactPanelProps) {
  if (!impact) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-600">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Impact &amp; blast radius
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Step 1: click an asset in the graph. Step 2: choose a highlight mode below.
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          {MODES.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-slate-700"
            >
              <span className="font-semibold">{m.label}</span>
              <span className="mt-0.5 block text-[10px]">{m.hint}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { node, upstream, downstream } = impact;
  const pathParts = [node.database_name, node.table_name, node.column_name].filter(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Selected asset
        </p>
        <p className="mt-1 text-sm font-semibold capitalize text-slate-900 dark:text-white">
          {node.type}: {node.label}
        </p>
        {pathParts.length > 0 && (
          <p className="font-mono text-[11px] text-slate-500">{pathParts.join(".")}</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
          Step 2 · Highlight mode
        </p>
        <div className="flex flex-col gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onViewModeChange(m.id)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                viewMode === m.id
                  ? m.id === "downstream"
                    ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                    : "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              <span className="font-semibold">{m.label}</span>
              <span className="mt-0.5 block text-[10px] opacity-70">{m.hint}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {viewMode === "full" &&
            `Highlighting ${upstream.count + downstream.count + 1} connected assets in the graph`}
          {viewMode === "upstream" &&
            `Highlighting ${upstream.count + 1} upstream source${upstream.count === 0 ? "" : "s"} only`}
          {viewMode === "downstream" &&
            `Highlighting ${downstream.count + 1} downstream asset${downstream.count === 0 ? "" : "s"} only`}
        </p>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
          Step 3 · Impact summary
        </p>
        <p className="mt-1 text-sm leading-relaxed text-indigo-950 dark:text-indigo-100">
          {impact.summary}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          icon={ArrowUpRight}
          label="Upstream"
          value={upstream.count}
          sub={`${upstream.by_type.database ?? 0} db · ${upstream.by_type.table ?? 0} tbl · ${upstream.by_type.column ?? 0} col`}
        />
        <Metric
          icon={ArrowDownRight}
          label="Downstream"
          value={downstream.count}
          sub={`${downstream.by_type.report ?? 0} reports`}
        />
      </div>

      {downstream.high_sensitivity > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>{downstream.high_sensitivity}</strong> sensitive downstream field(s) in blast
            radius — review before schema or classification changes.
          </span>
        </div>
      )}

      {downstream.reports.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase text-slate-400">
            <FileBarChart className="h-3 w-3" /> Affected reports
          </p>
          <ul className="space-y-1">
            {downstream.reports.map((report) => (
              <li key={report} className="rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
                {report}
              </li>
            ))}
          </ul>
        </div>
      )}

      {impact.policy_edges.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase text-slate-400">
            <Link2 className="h-3 w-3" /> Policy-stitched links ({impact.policy_edges.length})
          </p>
          <ul className="max-h-28 space-y-1 overflow-y-auto text-[11px] text-slate-600 dark:text-slate-300">
            {impact.policy_edges.slice(0, 8).map((e) => (
              <li key={e.id} className="rounded border border-slate-100 px-2 py-1 dark:border-slate-800">
                {e.label || "policy link"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase text-slate-400">Audit notes</p>
        <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          {impact.audit_notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      </div>

      {(viewMode === "full"
        ? [...upstream.nodes, node, ...downstream.nodes]
        : viewMode === "downstream"
          ? downstream.nodes
          : upstream.nodes
      ).length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase text-slate-400">
            {viewMode === "downstream"
              ? "Downstream assets"
              : viewMode === "upstream"
                ? "Upstream sources"
                : "Connected assets"}
          </p>
          <ul className="max-h-36 space-y-1 overflow-y-auto">
            {(viewMode === "full"
              ? [...upstream.nodes, ...downstream.nodes]
              : viewMode === "downstream"
                ? downstream.nodes
                : upstream.nodes
            )
              .slice(0, 12)
              .map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onSelectNode?.(n)}
                    className="w-full rounded-md px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium">{n.label}</span>
                    <span className="ml-1 text-slate-400">({n.type})</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof ArrowUpRight;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-slate-500">{sub}</p>
    </div>
  );
}
