import { Navigate, useLocation } from "react-router-dom";
import { ClipboardCheck, Shield } from "lucide-react";
import { PageTabs } from "../components/PageTabs";
import { PageHeader } from "../components/ui";
import { QualityPage } from "./Quality";
import { StewardPage } from "./Steward";

const TABS = [
  { id: "definitions", label: "Definitions", to: "/review/definitions", icon: ClipboardCheck },
  { id: "quality", label: "DQ rules", to: "/review/quality", icon: Shield },
] as const;

export function ReviewPage() {
  const { pathname } = useLocation();
  const tab = pathname.endsWith("/quality") ? "quality" : "definitions";

  return (
    <div>
      <PageHeader
        title="Review"
        description="Steward sign-off on AI-generated definitions and data quality rules before they count toward readiness and export."
      />
      <PageTabs tabs={[...TABS]} activeId={tab} />
      {tab === "quality" ? <QualityPage embedded /> : <StewardPage embedded />}
    </div>
  );
}

export function ReviewRedirect() {
  return <Navigate to="/review/definitions" replace />;
}
