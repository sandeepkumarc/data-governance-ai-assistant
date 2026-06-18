import { useCallback, useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from "../components/ui";
import type { HelpDeskTicket } from "../types";

export function HelpDeskPage() {
  const { governance, apiKey, usesOfflineData } = useApp();
  const [tickets, setTickets] = useState<HelpDeskTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    governance
      .listHelpDesk({ status: statusFilter || undefined, apiKey: apiKey || undefined })
      .then(setTickets)
      .finally(() => setLoading(false));
  }, [governance, statusFilter, apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function markStatus(id: string, status: string) {
    setUpdating(id);
    try {
      await governance.updateHelpDeskStatus(id, status, apiKey || undefined);
      load();
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Governance Help Desk"
        description="Questions the assistant could not answer safely from the catalog. Experts review and respond outside the app (email, Collibra, etc.)."
      />

      {usesOfflineData && (
        <p className="mb-4 text-xs text-amber-700 dark:text-amber-300">
          Offline mode — tickets are stored in browser localStorage. Connect the backend for a shared team queue in SQLite.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="answered">Answered</option>
          <option value="closed">Closed</option>
        </select>
        <Button variant="secondary" onClick={load}>
          Refresh
        </Button>
        <p className="text-xs text-slate-500">
          New tickets are created from <strong>Ask assistant</strong> when the user submits to help desk.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No help desk tickets"
          description="When the assistant cannot answer safely, users can escalate from the Ask assistant chat panel."
        />
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <Card key={t.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={t.status} />
                    <span className="text-xs text-slate-400">
                      {t.created_at?.slice(0, 16).replace("T", " ")}
                    </span>
                    {t.assistant_confidence && (
                      <span className="text-xs text-slate-500">
                        Assistant confidence: {t.assistant_confidence}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                    {t.user_name || "User"}
                    {t.user_email ? (
                      <span className="font-normal text-slate-500"> · {t.user_email}</span>
                    ) : null}
                  </p>
                </div>
                {t.status === "open" && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={updating === t.id}
                      onClick={() => markStatus(t.id, "answered")}
                    >
                      Mark answered
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={updating === t.id}
                      onClick={() => markStatus(t.id, "closed")}
                    >
                      Close
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {t.question}
              </p>
              {t.assistant_preview && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Assistant said: </span>
                  {t.assistant_preview}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
