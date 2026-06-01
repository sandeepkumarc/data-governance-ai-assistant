import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from "../components/ui";
import type { FieldDefinition } from "../types";

export function StewardPage() {
  const { governance, apiKey } = useApp();
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [filter, setFilter] = useState("pending_review");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FieldDefinition | null>(null);
  const [comment, setComment] = useState("");
  const [approver, setApprover] = useState("Alex Rivera");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await governance.definitions({
        approval_status: filter || undefined,
        apiKey: apiKey || undefined,
      });
      setDefinitions(data);
      setSelected(data[0] ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filter, apiKey]);

  async function decide(status: "approved" | "rejected") {
    if (!selected?.id) return;
    setSubmitting(true);
    try {
      await governance.approve(
        selected.id,
        {
          approval_status: status,
          steward_comment: comment,
          approved_by: approver,
        },
        apiKey || undefined,
      );
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Steward Review"
        description="Review AI-generated definitions, approve or reject, and maintain an auditable stewardship workflow."
      />

      <div className="mb-4 flex gap-2">
        {["pending_review", "approved", "rejected", ""].map((f) => (
          <button
            key={f || "all"}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f ? f.replace(/_/g, " ") : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : definitions.length === 0 ? (
        <EmptyState
          title="No definitions to review"
          description="Run Semantic Mapping with 'Save to database' enabled, then return here to approve definitions."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2" title="Queue">
            <ul className="max-h-[560px] space-y-1 overflow-y-auto">
              {definitions.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(d)}
                    className={`w-full rounded-lg px-3 py-3 text-left transition ${
                      selected?.id === d.id
                        ? "bg-indigo-50 ring-1 ring-indigo-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-800">
                      {d.table_name}.{d.column_name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {d.glossary_term}
                    </p>
                    <div className="mt-1.5">
                      <Badge label={d.approval_status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {selected && (
            <Card className="lg:col-span-3" title="Review panel">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{selected.glossary_term}</h3>
                    <p className="text-sm text-slate-500">
                      {selected.database_name}.{selected.table_name}.{selected.column_name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge label={selected.data_classification} />
                    <Badge label={selected.sensitivity} />
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-slate-700">
                  {selected.definition}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-400">Logical attribute</p>
                    <p className="text-sm font-medium text-slate-800">
                      {selected.logical_data_attribute_name}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-400">Source</p>
                    <p className="text-sm font-medium text-slate-800">
                      {selected.source || "retrieval_heuristic"}
                    </p>
                  </div>
                </div>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Steward comment..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <input
                  value={approver}
                  onChange={(e) => setApprover(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Approved by"
                />

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => decide("approved")}
                    disabled={submitting}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => decide("rejected")}
                    disabled={submitting}
                    className="flex-1"
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
