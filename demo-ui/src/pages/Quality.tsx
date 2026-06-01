import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../components/ui";
import type { QualityRule } from "../types";

export function QualityPage() {
  const { governance, apiKey } = useApp();
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    governance.qualityRules({ apiKey: apiKey || undefined }).then(setRules).finally(() => setLoading(false));
  }, [governance, apiKey]);

  return (
    <div>
      <PageHeader
        title="Data Quality Rules"
        description="Auto-suggested validation rules derived from column patterns, classifications, and semantic mapping results."
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          title="No quality rules yet"
          description="Analyze and persist field definitions to auto-generate data quality rules."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Field</th>
                  <th className="pb-3 pr-4">Rule</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Threshold</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="py-3 pr-4 font-medium text-slate-800">
                      {r.table_name}.{r.column_name}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{r.rule_name}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {r.rule_type}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-500">{r.threshold}</td>
                    <td className="py-3">
                      <Badge label={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
