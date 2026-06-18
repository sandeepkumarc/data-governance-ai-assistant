import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Scale } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from "../components/ui";
import type { GovernancePrinciplesBundle, TrustScore } from "../types";

const DEFAULT_NOTE =
  "Scores reflect your governing principles and steward workflow in this assistant — not statistical data quality or warehouse profiling.";

const LEGACY_LABELS: Record<string, string> = {
  completeness: "Approved definitions",
  accuracy: "DQ rules stewarded",
  freshness: "Recent steward activity",
  schema_consistency: "Steward approvals",
};

function scoreValue(score: TrustScore, principleId: string): number {
  if (score.scores?.[principleId] != null) return score.scores[principleId];
  const raw = score.breakdown[principleId];
  return typeof raw === "number" ? raw : 0;
}

function scoreReason(score: TrustScore, principleId: string): string | undefined {
  const fromTop = score.reasoning?.[principleId];
  if (fromTop) return fromTop;
  const nested = score.breakdown.reasoning;
  if (nested && typeof nested === "object" && principleId in nested) {
    return (nested as Record<string, string>)[principleId];
  }
  return undefined;
}

function ScoreBar({ label, value, weight }: { label: string; value: number; weight?: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          {label}
          {weight != null && (
            <span className="ml-1 text-slate-400">({weight}% weight)</span>
          )}
        </span>
        <span className="font-medium text-slate-700 dark:text-slate-300">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function TrustPage({ embedded = false }: { embedded?: boolean }) {
  const { governance, apiKey, usesOfflineData } = useApp();
  const [scores, setScores] = useState<TrustScore[]>([]);
  const [bundle, setBundle] = useState<GovernancePrinciplesBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [scoreRows, principlesPayload] = await Promise.all([
        governance.trustScores(undefined, apiKey || undefined),
        governance.governancePrinciples
          ? governance.governancePrinciples(apiKey || undefined)
          : Promise.resolve(null),
      ]);
      setScores(scoreRows);
      if (principlesPayload) setBundle(principlesPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load readiness data");
    } finally {
      setLoading(false);
    }
  }, [governance, apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  const note = bundle?.readiness_note ?? scores[0]?.readiness_note ?? DEFAULT_NOTE;

  const activePrinciples = useMemo(
    () => (bundle?.principles ?? []).filter((p) => p.enabled !== false),
    [bundle],
  );

  async function handleRecompute() {
    if (usesOfflineData || !governance.recomputeGovernanceReadiness) {
      setError("Recompute requires the live backend.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await governance.recomputeGovernanceReadiness(apiKey || undefined);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recompute failed");
    } finally {
      setBusy(false);
    }
  }

  function labelsFor(score: TrustScore): Record<string, string> {
    return { ...LEGACY_LABELS, ...score.dimension_labels };
  }

  function principleIdsFor(score: TrustScore): string[] {
    if (activePrinciples.length > 0) {
      return activePrinciples.map((p) => p.id!).filter(Boolean);
    }
    return Object.keys(labelsFor(score)).filter((k) => k !== "reasoning");
  }

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Governance Readiness"
          description="Table-level readiness scored against your governing principles — steward workflow, not live data profiling."
          action={
            !usesOfflineData ? (
              <Button variant="secondary" onClick={handleRecompute} disabled={busy}>
                <RefreshCw className="h-4 w-4" /> Recompute scores
              </Button>
            ) : undefined
          }
        />
      )}

      {embedded && !usesOfflineData && (
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" onClick={handleRecompute} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> Recompute scores
          </Button>
        </div>
      )}

      <div className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200 ${embedded ? "mb-4" : "mb-6"}`}>
        <div className="flex items-start gap-2">
          <Scale className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{note}</p>
            <p className="mt-2 text-xs opacity-90">
              Table scores below reflect your active principles. Manage principles on the{" "}
              <Link to="/governance/principles" className="font-semibold underline">
                Principles
              </Link>{" "}
              tab ({activePrinciples.length} enabled).
            </p>
          </div>
        </div>
        {bundle?.thresholds && (
          <p className="mt-2 text-xs opacity-80">
            Status thresholds: Ready ≥ {bundle.thresholds.ready}%, In progress ≥{" "}
            {bundle.thresholds.in_progress}%
          </p>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : scores.length === 0 ? (
        <EmptyState
          title="No readiness scores yet"
          description="Analyze and persist field definitions, configure governing principles on the Principles tab, then have stewards approve them."
          action={
            <Link
              to="/governance/principles"
              className="text-sm font-medium text-indigo-600 underline dark:text-indigo-400"
            >
              Go to Principles
            </Link>
          }
        />
      ) : (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {scores.map((s) => {
            const labels = labelsFor(s);
            const summary =
              s.reasoning?.summary ??
              (typeof s.breakdown.reasoning === "object"
                ? (s.breakdown.reasoning as { summary?: string }).summary
                : undefined) ??
              note;
            const ids = principleIdsFor(s);

            return (
              <Card key={s.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {s.database_name}.{s.table_name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Steward: {s.steward_assigned || "Unassigned"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {s.overall_score}%
                    </p>
                    <Badge label={s.status} />
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {summary}
                </p>

                <div className="mt-5 space-y-4">
                  {ids.map((pid) => {
                    const principle = activePrinciples.find((p) => p.id === pid);
                    return (
                      <div key={pid}>
                        <ScoreBar
                          label={labels[pid] ?? pid}
                          value={scoreValue(s, pid)}
                          weight={principle?.weight}
                        />
                        {scoreReason(s, pid) && (
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {scoreReason(s, pid)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
