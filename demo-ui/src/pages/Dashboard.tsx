import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, MetricCard, PageHeader, Card, Button } from "../components/ui";
import type { AuditEntry, FieldDefinition, TrustScore } from "../types";

export function DashboardPage() {
  const { governance, isDemoData, kbCount } = useApp();
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [trust, setTrust] = useState<TrustScore[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      governance.definitions(),
      governance.trustScores(),
      governance.auditLog({ limit: 5 }),
    ])
      .then(([d, t, a]) => {
        setDefinitions(d);
        setTrust(t);
        setAudit(a);
      })
      .finally(() => setLoading(false));
  }, [governance, isDemoData]);

  const pending = definitions.filter((d) => d.approval_status === "pending_review").length;
  const avgTrust =
    trust.length > 0
      ? Math.round(trust.reduce((s, t) => s + t.overall_score, 0) / trust.length)
      : 0;

  return (
    <div>
      <PageHeader
        title="Governance Command Center"
        description="AI-assisted metadata enrichment, steward workflows, and trust monitoring — all running locally on your infrastructure."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Field Definitions"
          value={loading ? "—" : definitions.length}
          sub="Across all databases"
          icon={<FileText className="h-5 w-5" />}
          accent="indigo"
        />
        <MetricCard
          label="Pending Review"
          value={loading ? "—" : pending}
          sub="Awaiting steward approval"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="amber"
        />
        <MetricCard
          label="Avg Trust Score"
          value={loading ? "—" : `${avgTrust}%`}
          sub={`${trust.length} tables profiled`}
          icon={<ShieldCheck className="h-5 w-5" />}
          accent="emerald"
        />
        <MetricCard
          label="Knowledge Base"
          value={kbCount}
          sub="Governance policy sections"
          icon={<Database className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Platform capabilities">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: Sparkles,
                title: "Semantic Mapping",
                desc: "RAG + local LLM drafts glossary terms, classifications, and governance actions from CSV metadata.",
              },
              {
                icon: ShieldCheck,
                title: "Auto Classification",
                desc: "Detects PII, financial, and health data patterns with sample-value masking before processing.",
              },
              {
                icon: Database,
                title: "Vector Retrieval",
                desc: "TF-IDF or Ollama embeddings match fields to policy sections — even with messy column names.",
              },
              {
                icon: FileText,
                title: "Catalog Export",
                desc: "One-click Collibra-compatible CSV export for approved definitions.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <Link to="/analyze">
              <Button>
                Start demo analysis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/knowledge">
              <Button variant="secondary">Manage knowledge base</Button>
            </Link>
            <Link to="/steward">
              <Button variant="secondary">Review definitions</Button>
            </Link>
          </div>
        </Card>

        <Card title="Recent activity">
          {audit.length === 0 ? (
            <p className="text-sm text-slate-500">No audit events yet.</p>
          ) : (
            <ul className="space-y-3">
              {audit.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-2 border-b border-slate-50 pb-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {a.action.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-slate-400">
                      {a.fields_processed > 0
                        ? `${a.fields_processed} fields`
                        : a.entity_type}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {a.created_at?.slice(0, 16).replace("T", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {trust.length > 0 && (
        <Card title="Trust score overview">
          <div className="space-y-4">
            {trust.map((t) => (
              <div key={t.id} className="flex items-center gap-4">
                <div className="w-48 shrink-0">
                  <p className="text-sm font-medium text-slate-800">
                    {t.database_name}.{t.table_name}
                  </p>
                  <Badge label={t.status} />
                </div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        t.overall_score >= 90
                          ? "bg-emerald-500"
                          : t.overall_score >= 75
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${t.overall_score}%` }}
                    />
                  </div>
                </div>
                <span className="w-12 text-right text-sm font-semibold text-slate-700">
                  {t.overall_score}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
