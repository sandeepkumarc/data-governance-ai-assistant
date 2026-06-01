import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../components/ui";
import type { TrustScore } from "../types";

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium text-slate-700">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function TrustPage() {
  const { governance, apiKey } = useApp();
  const [scores, setScores] = useState<TrustScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    governance.trustScores(undefined, apiKey || undefined).then(setScores).finally(() => setLoading(false));
  }, [governance, apiKey]);

  return (
    <div>
      <PageHeader
        title="Trust Scores"
        description="Composite trust metrics based on definition completeness, quality rule status, freshness, and steward approvals."
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : scores.length === 0 ? (
        <EmptyState
          title="No trust scores computed"
          description="Persist field definitions through Semantic Mapping to compute table-level trust scores."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scores.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {s.database_name}.{s.table_name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Steward: {s.steward_assigned || "Unassigned"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-slate-900">{s.overall_score}%</p>
                  <Badge label={s.status} />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <ScoreBar label="Completeness" value={s.breakdown.completeness} />
                <ScoreBar label="Accuracy" value={s.breakdown.accuracy} />
                <ScoreBar label="Freshness" value={s.breakdown.freshness} />
                <ScoreBar label="Schema consistency" value={s.breakdown.schema_consistency} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
