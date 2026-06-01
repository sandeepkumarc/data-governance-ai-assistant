import { useEffect, useState } from "react";
import { Mail, User } from "lucide-react";
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
        title="Ownership & Stewardship"
        description="Business owners and data stewards assigned to each field asset across the catalog."
      />

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
                <Badge label={r.lifecycle_status} />
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-3">
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
