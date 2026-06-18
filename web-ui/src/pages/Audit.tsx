import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { Card, EmptyState, PageHeader, Spinner } from "../components/ui";
import type { AuditEntry } from "../types";

export function AuditPage() {
  const { governance, apiKey } = useApp();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    governance
      .auditLog({ action: action || undefined, limit: 50, apiKey: apiKey || undefined })
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [governance, action, apiKey]);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Immutable record of analysis runs, uploads, and steward approval decisions."
      />

      <div className="mb-4">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All actions</option>
          <option value="analyze_metadata">Analyze metadata</option>
          <option value="upload_metadata">Upload metadata</option>
          <option value="approve_definition">Approve definition</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState title="No audit entries" description="Activity will appear here after analysis or approvals." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Timestamp</th>
                  <th className="pb-3 pr-4">Action</th>
                  <th className="pb-3 pr-4">Entity</th>
                  <th className="pb-3 pr-4">Fields</th>
                  <th className="pb-3">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50">
                    <td className="py-3 pr-4 whitespace-nowrap text-xs text-slate-500">
                      {e.created_at?.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-800">
                      {e.action.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{e.entity_type}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      {e.fields_processed || "—"}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {e.no_llm ? "RAG only" : `${e.model}`}
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
