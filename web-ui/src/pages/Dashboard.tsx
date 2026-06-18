import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { MaturityDashboardCard } from "../components/MaturityDashboardCard";
import { Badge, MetricCard, PageHeader, Card, Button } from "../components/ui";
import type { AuditEntry, DataMaturityPayload, FieldDefinition, TrustScore } from "../types";

export function DashboardPage() {
  const { governance, usesOfflineData, kbCount } = useApp();
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [trust, setTrust] = useState<TrustScore[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [maturity, setMaturity] = useState<DataMaturityPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      governance.definitions(),
      governance.trustScores(),
      governance.auditLog({ limit: 5 }),
      governance.dataMaturity ? governance.dataMaturity(undefined, "local") : Promise.resolve(null),
    ])
      .then(([d, t, a, m]) => {
        setDefinitions(d);
        setTrust(t);
        setAudit(a);
        setMaturity(m);
      })
      .finally(() => setLoading(false));
  }, [governance, usesOfflineData]);

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
        action={
          <Link to="/platform-tour">
            <Button>
              Platform tour <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
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
          label="Avg Readiness"
          value={loading ? "—" : `${avgTrust}%`}
          sub={`${trust.length} tables · steward workflow`}
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
        <Card className="lg:col-span-2" title="Typical workflow">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>
              <Link to="/analyze" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                Analyze columns
              </Link>{" "}
              from CSV metadata
            </li>
            <li>
              <Link to="/review/definitions" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                Review
              </Link>{" "}
              definitions and DQ rules
            </li>
            <li>
              <Link to="/lineage" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                Lineage
              </Link>{" "}
              and{" "}
              <Link to="/governance/readiness" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                governance health
              </Link>
            </li>
            <li>
              <Link to="/export" className="font-medium text-indigo-600 underline dark:text-indigo-400">
                Export
              </Link>{" "}
              approved catalog to Collibra CSV
            </li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/platform-tour">
              <Button>
                Platform tour <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/analyze">
              <Button variant="secondary">
                Analyze columns <ArrowRight className="h-4 w-4" />
              </Button>
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
        <Card title="Governance readiness overview" className="mb-8">
          <div className="mb-3 flex justify-end">
            <Link to="/governance/readiness" className="text-xs font-medium text-indigo-600 underline dark:text-indigo-400">
              Open governance health →
            </Link>
          </div>
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
                        t.overall_score >= 75
                          ? "bg-emerald-500"
                          : t.overall_score >= 40
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

      <MaturityDashboardCard payload={maturity} />
    </div>
  );
}
