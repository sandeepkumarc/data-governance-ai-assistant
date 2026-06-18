import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Info, Mail, User } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../components/ui";
import type { StewardAssignment } from "../types";

export function OwnershipPage() {
  const { governance, apiKey } = useApp();
  const [records, setRecords] = useState<StewardAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    governance.ownership(apiKey || undefined).then(setRecords).finally(() => setLoading(false));
  }, [governance, apiKey]);

  return (
    <div>
      <PageHeader
        title="People & ownership"
        description="Who is accountable for each column (business owner and data steward). This page is read-only in this workspace — it does not approve AI definitions."
      />

      <div className="mb-6 flex gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
        <p>
          <span className="font-medium">Not the same as Steward Review.</span> Badges here (
          <span className="font-mono text-xs">Approved</span>, <span className="font-mono text-xs">Reviewed</span>
          ) describe the <span className="font-medium">assignment record</span>, not whether an AI-written definition was accepted.
          To approve glossary text, go to{" "}
          <Link to="/review/definitions" className="font-medium text-indigo-600 underline dark:text-indigo-400">
            Review
          </Link>
          .
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState title="No ownership records" description="Seed data loads on first backend startup." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {records.map((r) => (
            <Card key={r.id}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-slate-400">
                    {r.database_name}
                  </p>
                  <h3 className="font-semibold text-slate-900">
                    {r.table_name}.{r.column_name}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Assignment</p>
                  <Badge label={r.lifecycle_status} />
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Business owner</p>
                    <p className="text-sm font-medium text-slate-800">
                      {r.business_owner}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 text-indigo-400" />
                  <div>
                    <p className="text-xs text-slate-400">Data steward</p>
                    <p className="text-sm font-medium text-slate-800">
                      {r.data_steward}
                    </p>
                    {r.data_steward_email && (
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Mail className="h-3 w-3" />
                        {r.data_steward_email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {r.notes && (
                <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                  {r.notes}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
