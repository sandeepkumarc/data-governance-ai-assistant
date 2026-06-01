import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Wand2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { LineageGraphViewWithSelection } from "../components/LineageGraph";
import { Button, Card, MetricCard, PageHeader, Spinner } from "../components/ui";
import { normalizeLineageGraph } from "../lib/lineageLayout";
import type { LineageGraph, LineageNlUpdateResult, LineagePolicy } from "../types";

const NL_EXAMPLES = [
  "Lineage policy: automatically stitch source and target when column full names match across databases",
  "Link columns that share the same logical attribute name from semantic mapping",
  "Route all PII and confidential columns to the GDPR compliance ledger report",
];

export function LineagePage() {
  const { governance, apiKey } = useApp();
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [policies, setPolicies] = useState<LineagePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [databaseFilter, setDatabaseFilter] = useState("");
  const [showNlPanel, setShowNlPanel] = useState(true);
  const [nlInstruction, setNlInstruction] = useState("");
  const [nlUseLlm, setNlUseLlm] = useState(false);
  const [nlLoading, setNlLoading] = useState(false);
  const [nlResult, setNlResult] = useState<LineageNlUpdateResult | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const raw = await governance.lineage(databaseFilter || undefined, apiKey || undefined);
      setGraph(normalizeLineageGraph(raw));
      if (governance.lineagePolicies) {
        const policyPayload = await governance.lineagePolicies(apiKey || undefined);
        setPolicies(policyPayload.policies);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [apiKey, databaseFilter]);

  async function handleNlUpdate(apply: boolean) {
    if (!nlInstruction.trim()) {
      setError("Enter a lineage policy in plain English");
      return;
    }
    setNlLoading(true);
    setError("");
    try {
      const result = await governance.nlUpdateLineagePolicy(
        {
          instruction: nlInstruction,
          no_llm: !nlUseLlm,
          dry_run: !apply,
          apply_after: apply,
        },
        apiKey || undefined,
      );
      setNlResult(result);
      if (result.applied) {
        if (result.policies) setPolicies(result.policies);
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lineage policy update failed");
    } finally {
      setNlLoading(false);
    }
  }

  async function handleReapplyPolicies() {
    setNlLoading(true);
    setError("");
    try {
      await governance.applyLineagePolicies?.(apiKey || undefined);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply policies");
    } finally {
      setNlLoading(false);
    }
  }

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const databases = useMemo(
    () => [...new Set(nodes.filter((n) => n.type === "database").map((n) => n.label))].sort(),
    [nodes],
  );

  return (
    <div>
      <PageHeader
        title="Data Lineage"
        description="Shows where data lives and how it flows. Policies can intelligently stitch matching columns across systems."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleReapplyPolicies} disabled={nlLoading}>
              Apply policies
            </Button>
            <Button variant="secondary" onClick={load}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        }
      />

      <Card className="mb-6 border-indigo-200/60">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800">Lineage policy (natural language)</h3>
          </div>
          <button type="button" onClick={() => setShowNlPanel((v) => !v)} className="text-xs text-indigo-600">
            {showNlPanel ? "Hide" : "Show"}
          </button>
        </div>
        {showNlPanel && (
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-600">
              Describe how GovernAI should stitch lineage — e.g. match columns by full name, logical
              attribute, or route PII to compliance reports. Preview first, then apply.
            </p>
            <textarea
              value={nlInstruction}
              onChange={(e) => setNlInstruction(e.target.value)}
              rows={3}
              placeholder="Lineage policy: automatically stitch source/target based on matching full names across databases..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {NL_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setNlInstruction(ex)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  {ex.slice(0, 52)}…
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={nlUseLlm} onChange={(e) => setNlUseLlm(e.target.checked)} />
              Use Ollama for richer policy parsing
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={nlLoading} onClick={() => handleNlUpdate(false)}>
                Preview policy
              </Button>
              <Button disabled={nlLoading} onClick={() => handleNlUpdate(true)}>
                {nlLoading ? "Working…" : "Apply policy & stitch"}
              </Button>
            </div>
            {nlResult && (
              <div className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                <p className="font-medium">{nlResult.summary}</p>
                {nlResult.policy && (
                  <p className="mt-1 text-xs opacity-80">
                    Rule: {nlResult.policy.rule_type} — {nlResult.policy.name}
                  </p>
                )}
                {nlResult.apply_result && (
                  <p className="mt-1 text-xs opacity-80">
                    Stitched {nlResult.apply_result.edges_added} new connection(s)
                  </p>
                )}
              </div>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </Card>

      {policies.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {policies.filter((p) => p.enabled !== false).map((p) => (
            <span
              key={p.id ?? p.name}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
            >
              {p.name}
            </span>
          ))}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Assets traced" value={nodes.length} accent="indigo" />
        <MetricCard label="Connections" value={edges.length} accent="violet" />
        <MetricCard label="Databases" value={databases.length} accent="emerald" />
      </div>

      {databases.length > 1 && (
        <div className="mb-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">Focus on one database</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
        </div>
      )}

      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : graph ? (
          <LineageGraphViewWithSelection graph={graph} />
        ) : null}
      </Card>
    </div>
  );
}
