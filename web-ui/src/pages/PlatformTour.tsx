import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  GitBranch,
  LayoutDashboard,
  ScanSearch,
  Shield,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Card, PageHeader } from "../components/ui";

const TOUR_STEPS = [
  {
    id: 1,
    title: "Governance overview",
    outcome: "See field definitions, pending reviews, and trust at a glance.",
    icon: LayoutDashboard,
    link: { to: "/", label: "Dashboard" },
    presenterNote:
      "Open with the problem: inconsistent metadata and slow stewardship. This dashboard is the control center.",
  },
  {
    id: 2,
    title: "Enrich column metadata",
    outcome: "Upload a table export with sample rows and generate policy-aligned definitions in minutes.",
    icon: ScanSearch,
    link: { to: "/analyze", label: "Analyze columns" },
    presenterNote:
      "Load the demo patients table export (header + 4 rows). Keep save-to-catalog on. Show MRN or diagnosis classification and policy citations.",
  },
  {
    id: 3,
    title: "Steward approval",
    outcome: "Review AI drafts and approve what is ready for the enterprise catalog.",
    icon: ClipboardCheck,
    link: { to: "/review/definitions", label: "Review" },
    presenterNote: "Approve one field. Emphasize human-in-the-loop — nothing auto-publishes.",
  },
  {
    id: 4,
    title: "End-to-end lineage",
    outcome: "Follow data from databases and tables through columns to downstream reports.",
    icon: GitBranch,
    link: { to: "/lineage", label: "Lineage" },
    presenterNote: "Click a column. Optional: mention NL policies that link matching names across systems.",
  },
  {
    id: 5,
    title: "Quality and trust",
    outcome: "Quality rules and trust scores update from the same governance pass.",
    icon: Shield,
    link: { to: "/review/quality", label: "DQ rules" },
    presenterNote: "Briefly show trust scores tab in sidebar after quality.",
  },
  {
    id: 6,
    title: "Export to catalog",
    outcome: "Download steward-approved definitions for Collibra or similar tools.",
    icon: Download,
    link: { to: "/export", label: "Export" },
    presenterNote: "Close with pilot scope. Audit log if they ask about compliance.",
  },
];

export function PlatformTourPage() {
  const { connected, usesOfflineData } = useApp();
  const [showPresenterNotes, setShowPresenterNotes] = useState(false);

  const statusLabel = usesOfflineData
    ? "Offline workspace"
    : connected
      ? "Platform ready"
      : "Limited mode";

  const statusDetail = usesOfflineData
    ? "Showing representative governance data for this walkthrough."
    : connected
      ? "Connected to your local governance services."
      : "Some live features are unavailable until services are started.";

  return (
    <div>
      <PageHeader
        title="Platform tour"
        description="A quick path through AI-Assisted Data Governance — from metadata enrichment to catalog export."
        action={
          <button
            type="button"
            onClick={() => setShowPresenterNotes((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {showPresenterNotes ? (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Hide presenter notes
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" /> Presenter notes
              </>
            )}
          </button>
        }
      />

      <div className="mb-8 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
        <span
          className={`h-2.5 w-2.5 rounded-full ${usesOfflineData ? "bg-amber-400" : connected ? "bg-emerald-500" : "bg-slate-300"}`}
        />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{statusLabel}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{statusDetail}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TOUR_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.id}>
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-500/20">
                  {step.id}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {step.outcome}
                  </p>
                  {showPresenterNotes && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                      <span className="font-semibold">Presenter: </span>
                      {step.presenterNote}
                    </p>
                  )}
                  <Link to={step.link.to} className="mt-4 inline-block">
                    <Button variant="secondary" className="!text-xs">
                      Open {step.link.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8" title="Also explore">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            to="/knowledge"
            className="flex items-center gap-2 text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <BookMarked className="h-4 w-4" />
            Policy knowledge base
          </Link>
          <Link
            to="/audit"
            className="flex items-center gap-2 text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <CheckCircle2 className="h-4 w-4" />
            Audit trail
          </Link>
        </div>
      </Card>

      {showPresenterNotes && (
        <p className="mt-4 text-center text-xs text-slate-400">
          Full script: docs/PRESENTATION_SCRIPT.md (not shown to your audience)
        </p>
      )}
    </div>
  );
}
