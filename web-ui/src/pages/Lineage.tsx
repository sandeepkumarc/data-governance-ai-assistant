import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useApp } from "../context/AppContext";
import { AdminSection } from "../components/AdminSection";
import { LineageGraphViewWithSelection } from "../components/LineageGraph";
import { LineagePoliciesPanel } from "../components/LineagePoliciesPanel";
import { Button, Card, MetricCard, PageHeader, Spinner } from "../components/ui";
import { normalizeLineageGraph } from "../lib/lineageLayout";
import { countSensitiveColumns, type LineageColumnScope } from "../lib/lineageGraphView";
import type { LineageGraph } from "../types";

export function LineagePage() {
  const { governance, apiKey } = useApp();
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [databaseFilter, setDatabaseFilter] = useState("");
  const [search, setSearch] = useState("");
  const [columnScope, setColumnScope] = useState<LineageColumnScope>("all");
  const [showAdmin, setShowAdmin] = useState(false);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await governance.lineage(databaseFilter || undefined, apiKey || undefined);
      setGraph(normalizeLineageGraph(raw));
    } finally {
      setLoading(false);
    }
  }, [governance, apiKey, databaseFilter]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const databases = useMemo(
    () => [...new Set(nodes.filter((n) => n.type === "database").map((n) => n.label))].sort(),
    [nodes],
  );
  const reportCount = nodes.filter((n) => n.type === "report").length;
  const sensitiveColumnCount = countSensitiveColumns(graph ?? { nodes: [], edges: [] });
  const totalColumnCount = nodes.filter((n) => n.type === "column").length;
  const policyEdgeCount = edges.filter((e) => {
    const label = (e.label ?? "").toLowerCase();
    return (
      label.includes("same ") ||
      label.includes("pii") ||
      label.includes("revenue") ||
      label.includes("compliance") ||
      label.includes("glossary") ||
      label.includes("risk")
    );
  }).length;

  return (
    <div>
      <PageHeader
        title="Data Lineage"
        description="Follow data from source systems to downstream reports. Analyze blast radius before schema or classification changes."
        action={
          <Button variant="secondary" onClick={() => void loadGraph()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <MetricCard label="Assets traced" value={nodes.length} accent="indigo" />
        <MetricCard label="Connections" value={edges.length} accent="violet" />
        <MetricCard label="Policy-stitched" value={policyEdgeCount} accent="amber" />
        <MetricCard label="Downstream reports" value={reportCount} accent="emerald" />
      </div>

      <Card title="Explore & analyze">
        <div className="mb-5 flex flex-wrap items-end gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <label className="min-w-[200px] flex-1 text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Search assets</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Table, column, report…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          {databases.length > 0 && (
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">Database</span>
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                value={databaseFilter}
                onChange={(e) => setDatabaseFilter(e.target.value)}
              >
                <option value="">All databases</option>
                {databases.map((db) => (
                  <option key={db} value={db}>
                    {db}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Columns</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setColumnScope("all")}
                className={`rounded-md px-3 py-1.5 text-xs transition ${
                  columnScope === "all"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                All ({totalColumnCount})
              </button>
              <button
                type="button"
                onClick={() => setColumnScope("sensitive")}
                title="Confidential, Restricted, PII, or High/Medium sensitivity"
                className={`rounded-md px-3 py-1.5 text-xs transition ${
                  columnScope === "sensitive"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                Sensitive ({sensitiveColumnCount})
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Flow: <span className="text-blue-600">database</span> →{" "}
            <span className="text-emerald-600">table</span> →{" "}
            <span className="text-orange-600">column</span> →{" "}
            <span className="text-violet-600">report</span>
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : graph ? (
          <LineageGraphViewWithSelection
            graph={graph}
            search={search}
            columnScope={columnScope}
          />
        ) : null}
      </Card>

      <AdminSection
        title="Stitching policies"
        description="Industry-standard and custom rules that connect assets across systems. Toggle, delete, or add policies — then apply to refresh the graph."
        open={showAdmin}
        onOpenChange={setShowAdmin}
      >
        <LineagePoliciesPanel onPoliciesChange={() => void loadGraph()} />
      </AdminSection>
    </div>
  );
}
