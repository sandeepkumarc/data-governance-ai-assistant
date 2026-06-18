import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, RotateCcw, ShieldAlert, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from "../components/ui";
import type { QualityRule } from "../types";

const RULE_STATUSES = ["Suggested", "Passed", "Warning", "Failed"] as const;

interface QualityPageProps {
  embedded?: boolean;
}

export function QualityPage({ embedded = false }: QualityPageProps) {
  const { governance, apiKey, refreshStatus } = useApp();
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await governance.qualityRules({ apiKey: apiKey || undefined });
      setRules(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [governance, apiKey]);

  async function setRuleStatus(rule: QualityRule, status: (typeof RULE_STATUSES)[number]) {
    if (!governance.updateRuleStatus) return;
    setUpdatingId(rule.id);
    try {
      const updated = await governance.updateRuleStatus(rule.id, status, undefined, apiKey || undefined);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
      await refreshStatus();
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = statusFilter ? rules.filter((r) => r.status === statusFilter) : rules;
  const suggestedCount = rules.filter((r) => r.status === "Suggested").length;

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Data Quality Rules"
          description="Review AI-suggested validation rules. Mark rules Passed after steward sign-off — this updates Governance Readiness scores."
        />
      )}

      {!embedded && (
      <div className="mb-4 space-y-3">
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100">
          <p className="font-medium">Where approval happens</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed opacity-90">
            <li>
              <strong>Field definitions</strong> (glossary, classification) →{" "}
              <Link to="/review/definitions" className="font-semibold underline">
                Definitions tab
              </Link>
            </li>
            <li>
              <strong>DQ rules</strong> (validity, uniqueness, PII checks) → approve on this page using{" "}
              <strong>Accept rule</strong> below
            </li>
            <li>
              Readiness <strong>accuracy</strong> score rises when rules move from Suggested → Passed — see{" "}
              <Link to="/governance/readiness" className="font-semibold underline">
                Governance health
              </Link>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
          Rules are suggestions for your external DQ platform (Collibra, Great Expectations, etc.). Status here
          tracks steward review — not live warehouse profiling.
        </div>
      </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="">All ({rules.length})</option>
            {RULE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s} ({rules.filter((r) => r.status === s).length})
              </option>
            ))}
          </select>
        </label>
        {suggestedCount > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {suggestedCount} rule{suggestedCount === 1 ? "" : "s"} awaiting steward review
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rules.length === 0 ? "No quality rules yet" : "No rules match this filter"}
          description={
            rules.length === 0
              ? "Analyze columns with Save to database enabled to auto-generate suggested rules."
              : "Clear the status filter to see all rules."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const expanded = expandedId === r.id;
            const ruleType = r.rule_type || (r as { type?: string }).type || "—";
            const busy = updatingId === r.id;

            return (
              <Card key={r.id}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-slate-500">
                        {r.database_name}.{r.table_name}.{r.column_name}
                      </p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{r.rule_name}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {ruleType}
                      </span>
                      <span className="text-xs text-slate-500">Target: {r.threshold}</span>
                      <Badge label={r.status} />
                    </div>
                  </div>
                  {r.reasoning && !expanded && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">Why suggested: </span>
                      {r.reasoning}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    {expanded ? "Click header to collapse" : "Click to review and approve"}
                  </p>
                </button>

                {expanded && (
                  <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        What to implement
                      </p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{r.description}</p>
                    </div>
                    <div className="rounded-lg bg-indigo-50 px-4 py-3 dark:bg-indigo-950/40">
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                        Why this was suggested
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-indigo-900 dark:text-indigo-100">
                        {r.reasoning || "Re-run analyze with persistence to generate reasoning for this rule."}
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Steward decision
                      </p>
                      <p className="mb-3 text-xs text-slate-500">
                        Accept after you agree the rule should be implemented in your DQ tooling. This updates the
                        table&apos;s readiness accuracy score.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={busy || r.status === "Passed"}
                          onClick={() => void setRuleStatus(r, "Passed")}
                        >
                          {busy ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                          Accept rule
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy || r.status === "Warning"}
                          onClick={() => void setRuleStatus(r, "Warning")}
                        >
                          <ShieldAlert className="h-4 w-4" /> Needs attention
                        </Button>
                        <Button
                          variant="danger"
                          disabled={busy || r.status === "Failed"}
                          onClick={() => void setRuleStatus(r, "Failed")}
                        >
                          <X className="h-4 w-4" /> Reject
                        </Button>
                        {r.status !== "Suggested" && (
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void setRuleStatus(r, "Suggested")}
                          >
                            <RotateCcw className="h-4 w-4" /> Reset to suggested
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500">
                      Source: {r.source}
                      {r.failure_count > 0 && ` · ${r.failure_count} failure(s) recorded`}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
