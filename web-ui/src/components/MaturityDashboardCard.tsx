import { Link } from "react-router-dom";
import { ArrowRight, Hexagon } from "lucide-react";
import { MaturityRadarChart } from "./MaturityRadarChart";
import { Badge, Button, Card } from "./ui";
import type { DataMaturityPayload } from "../types";

export function MaturityDashboardCard({ payload }: { payload: DataMaturityPayload | null }) {
  if (!payload?.enterprise) {
    return (
      <Card title="Data maturity">
        <p className="text-sm text-slate-500">
          Analyze metadata and open Data Maturity to view the Gartner radar by domain.
        </p>
        <Link to="/governance/maturity" className="mt-4 inline-block">
          <Button variant="secondary">
            Open Data Maturity <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </Card>
    );
  }

  const ent = payload.enterprise;
  const levels = ent.dimensions.map((d) => d.level);
  const labels = ent.dimensions.map((d) => d.label);

  return (
    <Card title="Data maturity">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="w-full max-w-[200px] shrink-0 sm:mx-auto">
          <MaturityRadarChart axisLabels={labels} series={[{ id: "ent", label: "Enterprise", levels }]} size={200} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Hexagon className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Enterprise · Level {ent.overall_level}
            </span>
            <Badge label={ent.stage.label} />
          </div>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {ent.stage.description}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {payload.domains.length} domain(s) · {payload.source ?? "local"} view
            {payload.collibra_meta?.asset_count
              ? ` · ${payload.collibra_meta.asset_count} Collibra assets`
              : ""}
          </p>
          <Link to="/governance/maturity" className="mt-4 inline-block">
            <Button variant="secondary">
              Full maturity view <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
