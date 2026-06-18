import { Navigate, useLocation } from "react-router-dom";
import { Activity, Hexagon, Scale } from "lucide-react";
import { PageTabs } from "../components/PageTabs";
import { PageHeader } from "../components/ui";
import { DataMaturityPage } from "./DataMaturity";
import { GovernancePrinciplesPage } from "./GovernancePrinciplesPage";
import { TrustPage } from "./Trust";

const TABS = [
  { id: "readiness", label: "Readiness", to: "/governance/readiness", icon: Activity },
  { id: "principles", label: "Principles", to: "/governance/principles", icon: Scale },
  { id: "maturity", label: "Maturity", to: "/governance/maturity", icon: Hexagon },
] as const;

export function GovernanceHealthPage() {
  const { pathname } = useLocation();
  const tab = pathname.endsWith("/maturity")
    ? "maturity"
    : pathname.endsWith("/principles")
      ? "principles"
      : "readiness";

  return (
    <div>
      <PageHeader
        title="Governance health"
        description="Table readiness scores, governing principles, and domain maturity — principles drive Readiness and Local maturity."
      />
      <PageTabs tabs={[...TABS]} activeId={tab} />
      {tab === "maturity" ? (
        <DataMaturityPage embedded />
      ) : tab === "principles" ? (
        <GovernancePrinciplesPage embedded />
      ) : (
        <TrustPage embedded />
      )}
    </div>
  );
}

export function GovernanceHealthRedirect() {
  return <Navigate to="/governance/readiness" replace />;
}
