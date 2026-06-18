import { useCallback, useEffect, useState } from "react";
import { BookOpen, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { LineagePoliciesGuide } from "./LineagePoliciesGuide";
import { Button, Card } from "./ui";
import type { LineageNlUpdateResult, LineagePolicy } from "../types";

const NL_EXAMPLES = [
  "Stitch columns when full names match across databases",
  "Link columns that share the same logical attribute name",
  "Route all PII and confidential columns to the GDPR compliance ledger",
];

const PROTECTED_IDS = new Set(["default-db-table-column"]);

function policyMeta(policy: LineagePolicy): { standard?: string; useCase?: string } {
  const config = policy.config ?? {};
  return {
    standard: typeof config.standard === "string" ? config.standard : undefined,
    useCase: typeof config.use_case === "string" ? config.use_case : undefined,
  };
}

interface LineagePoliciesPanelProps {
  onPoliciesChange?: () => void;
}

export function LineagePoliciesPanel({ onPoliciesChange }: LineagePoliciesPanelProps) {
  const { governance, apiKey, usesOfflineData } = useApp();
  const [policies, setPolicies] = useState<LineagePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showNlPanel, setShowNlPanel] = useState(false);
  const [nlInstruction, setNlInstruction] = useState("");
  const [nlUseLlm, setNlUseLlm] = useState(false);
  const [nlResult, setNlResult] = useState<LineageNlUpdateResult | null>(null);
  const [syncMessage, setSyncMessage] = useState("");

  const load = useCallback(async () => {
    if (!governance.lineagePolicies) return;
    setLoading(true);
    setError("");
    try {
      const payload = await governance.lineagePolicies(apiKey || undefined);
      setPolicies(payload.policies);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, [governance, apiKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle(policy: LineagePolicy) {
    if (!policy.id || !governance.updateLineagePolicy || usesOfflineData) return;
    setBusy(true);
    setError("");
    try {
      const result = await governance.updateLineagePolicy(
        policy.id,
        { enabled: !policy.enabled },
        apiKey || undefined,
      );
      setPolicies(result.policies);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(policy: LineagePolicy) {
    if (!policy.id || !governance.deleteLineagePolicy || usesOfflineData) return;
    if (PROTECTED_IDS.has(policy.id)) return;
    if (!window.confirm(`Delete policy "${policy.name}"? Existing stitched edges remain until you re-run apply.`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await governance.deleteLineagePolicy(policy.id, apiKey || undefined);
      setPolicies(result.policies);
      onPoliciesChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    if (!governance.applyLineagePolicies || usesOfflineData) return;
    setBusy(true);
    setError("");
    try {
      await governance.applyLineagePolicies(apiKey || undefined);
      onPoliciesChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncCatalog() {
    if (!governance.syncLineagePolicyCatalog || usesOfflineData) return;
    setBusy(true);
    setError("");
    setSyncMessage("");
    try {
      const result = await governance.syncLineagePolicyCatalog(apiKey || undefined);
      setPolicies(result.policies);
      setSyncMessage(
        result.count > 0
          ? `Added ${result.count} industry policy(ies): ${result.added.join(", ")}`
          : "Catalog is up to date — no new policies to add.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleNlUpdate(apply: boolean) {
    if (!governance.nlUpdateLineagePolicy || usesOfflineData) {
      setError("Natural language policies require the live backend.");
      return;
    }
    if (!nlInstruction.trim()) {
      setError("Enter a lineage stitching rule in plain English");
      return;
    }
    setBusy(true);
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
      if (result.policies) setPolicies(result.policies);
      if (result.applied) onPoliciesChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Policy update failed");
    } finally {
      setBusy(false);
    }
  }

  const enabledCount = policies.filter((p) => p.enabled !== false).length;

  return (
    <div className="space-y-4">
      <LineagePoliciesGuide />

      <div className="flex flex-wrap gap-2">
        {!usesOfflineData && (
          <>
            <Button variant="secondary" onClick={() => void load()} disabled={busy || loading}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="secondary" onClick={() => void handleSyncCatalog()} disabled={busy}>
              <BookOpen className="h-4 w-4" /> Load industry policy pack
            </Button>
            <Button variant="secondary" onClick={() => void handleApply()} disabled={busy}>
              <RefreshCw className="h-4 w-4" /> Apply enabled policies
            </Button>
          </>
        )}
      </div>

      {syncMessage && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {syncMessage}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading policies…</p>
      ) : (
        <Card title="Lineage stitching policies">
          <p className="mb-4 text-xs text-slate-500">
            {enabledCount} enabled · {policies.length} total. Toggle policies on/off, then click{" "}
            <strong>Apply enabled policies</strong> to update the graph.
          </p>

          <div className="space-y-3">
            {policies.map((policy) => {
              const meta = policyMeta(policy);
              const protectedPolicy = policy.id ? PROTECTED_IDS.has(policy.id) : false;
              return (
                <div
                  key={policy.id ?? policy.name}
                  className={`rounded-lg border px-3 py-3 ${
                    policy.enabled !== false
                      ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40"
                      : "border-dashed border-slate-200 bg-slate-50/80 opacity-75 dark:border-slate-700 dark:bg-slate-900/20"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {policy.name}
                        </span>
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-mono text-[10px] text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                          {policy.rule_type}
                        </span>
                        {meta.standard && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                            {meta.standard}
                          </span>
                        )}
                        {policy.source === "nl" && (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-800 dark:bg-indigo-950/50">
                            NL
                          </span>
                        )}
                        {protectedPolicy && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800">
                            Required
                          </span>
                        )}
                      </div>
                      {policy.description && (
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {policy.description}
                        </p>
                      )}
                      {meta.useCase && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          <strong>Use case:</strong> {meta.useCase}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={policy.enabled !== false}
                          disabled={busy || usesOfflineData || protectedPolicy}
                          onChange={() => void handleToggle(policy)}
                        />
                        {policy.enabled !== false ? "On" : "Off"}
                      </label>
                      {!protectedPolicy && !usesOfflineData && policy.id && (
                        <button
                          type="button"
                          title="Delete policy"
                          disabled={busy}
                          onClick={() => void handleDelete(policy)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="rounded-lg border border-indigo-100 dark:border-indigo-900">
        <button
          type="button"
          onClick={() => setShowNlPanel((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <Wand2 className="h-4 w-4 text-indigo-500" />
          Add policy in natural language
          <span className="ml-auto text-xs text-indigo-600">{showNlPanel ? "Hide" : "Show"}</span>
        </button>
        {showNlPanel && (
          <div className="space-y-4 border-t border-indigo-100 px-4 py-4 dark:border-indigo-900">
            <textarea
              value={nlInstruction}
              onChange={(e) => setNlInstruction(e.target.value)}
              rows={3}
              placeholder="e.g. Route all patient and HIPAA columns to the compliance ledger…"
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
              Use Ollama for richer policy parsing
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => void handleNlUpdate(false)}>
                Preview
              </Button>
              <Button disabled={busy} onClick={() => void handleNlUpdate(true)}>
                {busy ? "Working…" : "Apply & stitch"}
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

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
