import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw, Settings2, Trash2, Wand2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { GovernancePrinciplesGuide } from "./GovernancePrinciplesGuide";
import { Button, Card, PageHeader, Spinner } from "./ui";
import type {
  GovernanceNlUpdateResult,
  GovernancePrinciple,
  GovernancePrinciplesBundle,
  GovernanceRuleTypeCatalogEntry,
} from "../types";

const NL_EXAMPLES = [
  "Require glossary terms on all financial columns",
  "All PII columns must have a data classification assigned",
  "Every column needs a data steward assigned before export",
  "DQ rules must be marked Passed within 30 days of suggestion",
];

export function GovernancePrinciplesPanel({ embedded = false }: { embedded?: boolean }) {
  const { governance, apiKey, usesOfflineData } = useApp();
  const [bundle, setBundle] = useState<GovernancePrinciplesBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showNlPanel, setShowNlPanel] = useState(false);
  const [nlInstruction, setNlInstruction] = useState("");
  const [nlUseLlm, setNlUseLlm] = useState(false);
  const [nlResult, setNlResult] = useState<GovernanceNlUpdateResult | null>(null);
  const [addRuleType, setAddRuleType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!governance.governancePrinciples) {
        setBundle(null);
        return;
      }
      const principlesPayload = await governance.governancePrinciples(apiKey || undefined);
      setBundle(principlesPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load governing principles");
    } finally {
      setLoading(false);
    }
  }, [governance, apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  const catalog = bundle?.rule_type_catalog ?? [];
  const existingTypes = new Set((bundle?.principles ?? []).map((p) => p.rule_type));
  const addableCatalog = catalog.filter((e) => !existingTypes.has(e.rule_type));
  const enabledCount = (bundle?.principles ?? []).filter((p) => p.enabled !== false).length;

  function pillarLabel(ruleType: string): string | undefined {
    return catalog.find((e) => e.rule_type === ruleType)?.maturity_pillar_label ?? undefined;
  }

  async function handleRecompute() {
    if (usesOfflineData || !governance.recomputeGovernanceReadiness) {
      setError("Recompute requires the live backend.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await governance.recomputeGovernanceReadiness(apiKey || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recompute failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePrinciple(principle: GovernancePrinciple) {
    if (usesOfflineData || !governance.updateGovernancePrinciple || !principle.id) return;
    setBusy(true);
    setError("");
    try {
      const result = await governance.updateGovernancePrinciple(
        principle.id,
        { enabled: !principle.enabled },
        apiKey || undefined,
      );
      setBundle(result.principles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleWeightChange(principle: GovernancePrinciple, weight: number) {
    if (usesOfflineData || !governance.updateGovernancePrinciple || !principle.id) return;
    setBusy(true);
    try {
      const result = await governance.updateGovernancePrinciple(
        principle.id,
        { weight },
        apiKey || undefined,
      );
      setBundle(result.principles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Weight update failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePrinciple(id: string) {
    if (usesOfflineData || !governance.deleteGovernancePrinciple) return;
    setBusy(true);
    setError("");
    try {
      const updated = await governance.deleteGovernancePrinciple(id, apiKey || undefined);
      setBundle(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddFromCatalog(entry: GovernanceRuleTypeCatalogEntry) {
    if (usesOfflineData || !governance.createGovernancePrinciple) return;
    setBusy(true);
    setError("");
    try {
      const result = await governance.createGovernancePrinciple(
        {
          name: entry.label,
          description: entry.description,
          rule_type: entry.rule_type,
          enabled: true,
          weight: 15,
          config: entry.default_config,
        },
        apiKey || undefined,
      );
      setBundle(result.principles);
      setAddRuleType("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add principle");
    } finally {
      setBusy(false);
    }
  }

  async function handleNlUpdate(recompute: boolean) {
    if (usesOfflineData || !governance.nlUpdateGovernancePrinciple) {
      setError("Natural language principles require the live backend.");
      return;
    }
    if (!nlInstruction.trim()) {
      setError("Describe a governing principle in plain English");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await governance.nlUpdateGovernancePrinciple(
        {
          instruction: nlInstruction,
          no_llm: !nlUseLlm,
          dry_run: !recompute,
          recompute_after: recompute,
        },
        apiKey || undefined,
      );
      setNlResult(result);
      if (result.principles) setBundle(result.principles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Principle update failed");
    } finally {
      setBusy(false);
    }
  }

  const headerAction = !usesOfflineData ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={load} disabled={busy || loading}>
        <RefreshCw className="h-4 w-4" /> Refresh
      </Button>
      <Button variant="secondary" onClick={handleRecompute} disabled={busy}>
        <RefreshCw className="h-4 w-4" /> Apply & recompute scores
      </Button>
    </div>
  ) : undefined;

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Governing principles"
          description="Define what “ready” means for your catalog. Principles drive Readiness scores and the Local maturity radar."
          action={headerAction}
        />
      )}

      {embedded && !usesOfflineData && (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={load} disabled={busy || loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="secondary" onClick={handleRecompute} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> Apply & recompute scores
          </Button>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-100">
        <p>
          Active principles score tables on the{" "}
          <Link to="/governance/readiness" className="font-medium underline">
            Readiness
          </Link>{" "}
          tab and map to maturity pillars on{" "}
          <Link to="/governance/maturity" className="font-medium underline">
            Maturity
          </Link>
          . After changes, use <strong>Apply & recompute scores</strong> to refresh both views.
        </p>
        {bundle?.thresholds && (
          <p className="mt-2 text-xs opacity-90">
            Readiness thresholds: Ready ≥ {bundle.thresholds.ready}%, In progress ≥{" "}
            {bundle.thresholds.in_progress}%
          </p>
        )}
      </div>

      <GovernancePrinciplesGuide catalog={bundle?.rule_type_catalog} offlineMode={usesOfflineData} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : bundle ? (
        <Card className="mt-6" title="Active principles">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Settings2 className="h-3.5 w-3.5" />
            <span>
              {enabledCount} enabled · {bundle.principles.length} total
            </span>
          </div>

          <div className="space-y-3">
            {bundle.principles.map((principle) => (
              <div
                key={principle.id ?? principle.name}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {principle.name}
                      </span>
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-[10px] text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
                        {principle.rule_type}
                      </span>
                      {pillarLabel(principle.rule_type) && (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                          → {pillarLabel(principle.rule_type)}
                        </span>
                      )}
                      {principle.source === "nl" && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800 dark:bg-violet-950/50">
                          NL
                        </span>
                      )}
                    </div>
                    {principle.description && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {principle.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={principle.enabled !== false}
                        disabled={busy || usesOfflineData}
                        onChange={() => handleTogglePrinciple(principle)}
                      />
                      On
                    </label>
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      Wt
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={principle.weight ?? 25}
                        disabled={busy || usesOfflineData}
                        onChange={(e) => handleWeightChange(principle, Number(e.target.value))}
                        className="w-12 rounded border border-slate-200 px-1 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900"
                      />
                    </label>
                    {principle.source !== "system" && principle.id && !usesOfflineData && (
                      <button
                        type="button"
                        title="Remove principle"
                        disabled={busy}
                        onClick={() => handleDeletePrinciple(principle.id!)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!usesOfflineData && addableCatalog.length > 0 && (
            <div className="mt-6 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-500">Add from catalog</span>
                <select
                  value={addRuleType}
                  onChange={(e) => setAddRuleType(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="">Select scorer type…</option>
                  {addableCatalog.map((entry) => (
                    <option key={entry.rule_type} value={entry.rule_type}>
                      {entry.label} → {entry.maturity_pillar_label ?? "maturity pillar"}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="secondary"
                disabled={!addRuleType || busy}
                onClick={() => {
                  const entry = addableCatalog.find((e) => e.rule_type === addRuleType);
                  if (entry) handleAddFromCatalog(entry);
                }}
              >
                <Plus className="h-4 w-4" /> Add principle
              </Button>
            </div>
          )}

          <div className="mt-6 rounded-lg border border-indigo-100 dark:border-indigo-900">
            <button
              type="button"
              onClick={() => setShowNlPanel((v) => !v)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <Wand2 className="h-4 w-4 text-indigo-500" />
              Add principle in natural language
              <span className="ml-auto text-xs text-indigo-600">{showNlPanel ? "Hide" : "Show"}</span>
            </button>
            {showNlPanel && (
              <div className="space-y-4 border-t border-indigo-100 px-4 py-4 dark:border-indigo-900">
                <p className="text-xs text-slate-500">
                  Plain English works — or use <strong>Name → Pillar</strong> for a custom title, e.g.{" "}
                  <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                    Finance glossary rule -&gt; Metadata &amp; definitions
                  </code>
                  .
                </p>
                <textarea
                  value={nlInstruction}
                  onChange={(e) => setNlInstruction(e.target.value)}
                  rows={3}
                  placeholder="e.g. Require glossary terms on all columns in the finance domain…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                />
                <div className="flex flex-wrap gap-2">
                  {NL_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setNlInstruction(ex)}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={nlUseLlm}
                    onChange={(e) => setNlUseLlm(e.target.checked)}
                  />
                  Use Ollama for richer principle parsing
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => handleNlUpdate(false)}>
                    Preview
                  </Button>
                  <Button disabled={busy} onClick={() => handleNlUpdate(true)}>
                    {busy ? "Working…" : "Apply & recompute"}
                  </Button>
                </div>
                {nlResult && (
                  <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100">
                    {nlResult.summary}
                  </p>
                )}
              </div>
            )}
          </div>

          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        </Card>
      ) : (
        <p className="text-sm text-slate-500">Principles API unavailable in this mode.</p>
      )}
    </div>
  );
}
