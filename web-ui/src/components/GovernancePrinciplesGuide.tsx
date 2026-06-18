import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Hexagon,
  ListChecks,
  Plus,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Card } from "./ui";
import type { GovernanceRuleTypeCatalogEntry } from "../types";

const DEFAULT_CATALOG: GovernanceRuleTypeCatalogEntry[] = [
  {
    rule_type: "approved_definitions",
    label: "Approved definitions",
    description: "Share of columns with steward-approved definitions.",
    default_config: {},
    maturity_pillar_label: "Metadata & definitions",
  },
  {
    rule_type: "glossary_linked",
    label: "Glossary terms linked",
    description: "Columns linked to business glossary terms.",
    default_config: {},
    maturity_pillar_label: "Metadata & definitions",
  },
  {
    rule_type: "steward_approvals",
    label: "Steward approvals",
    description: "Columns with approval_status = approved.",
    default_config: {},
    maturity_pillar_label: "Governance & stewardship",
  },
  {
    rule_type: "ownership_assigned",
    label: "Ownership assigned",
    description: "Columns with a data steward assigned.",
    default_config: {},
    maturity_pillar_label: "Governance & stewardship",
  },
  {
    rule_type: "dq_rule_stewardship",
    label: "DQ rule stewardship",
    description: "Data quality rules reviewed by stewards.",
    default_config: {},
    maturity_pillar_label: "Data quality",
  },
  {
    rule_type: "classification_coverage",
    label: "Sensitive data classified",
    description: "Sensitive columns have a classification label.",
    default_config: {},
    maturity_pillar_label: "Security & classification",
  },
  {
    rule_type: "policy_citations",
    label: "Policy citations present",
    description: "Definitions cite knowledge-base policy sections.",
    default_config: {},
    maturity_pillar_label: "Security & classification",
  },
  {
    rule_type: "recent_activity",
    label: "Recent steward activity",
    description: "Approved definitions updated within a time window.",
    default_config: {},
    maturity_pillar_label: "Operational readiness",
  },
];

interface GovernancePrinciplesGuideProps {
  catalog?: GovernanceRuleTypeCatalogEntry[];
  offlineMode?: boolean;
  defaultOpen?: boolean;
}

export function GovernancePrinciplesGuide({
  catalog = DEFAULT_CATALOG,
  offlineMode = false,
  defaultOpen = false,
}: GovernancePrinciplesGuideProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            How to add governing principles (no special syntax required)
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="space-y-5 border-t border-slate-200 px-5 py-4 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
          <p className="leading-relaxed">
            <strong>Governing principles</strong> define what “ready” means for your tables. Each principle
            scores catalog data (approvals, stewards, classifications, etc.) and feeds one spoke on the{" "}
            <Link to="/governance/maturity" className="font-medium text-indigo-600 underline dark:text-indigo-400">
              Data Maturity
            </Link>{" "}
            radar. Principles are stored locally in SQLite{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs dark:bg-slate-900">
              governance_principles
            </code>
            .
          </p>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Plus className="h-3.5 w-3.5" /> Easiest: add from the catalog (recommended)
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                On the <strong>Active principles</strong> card below, open <strong>Add from catalog</strong>.
              </li>
              <li>
                Pick a scorer — the dropdown shows which <strong>maturity pillar</strong> it maps to, e.g.{" "}
                <em>Glossary terms linked → Metadata &amp; definitions</em>.
              </li>
              <li>
                Click <strong>Add principle</strong>. Toggle <strong>On</strong> and adjust <strong>Wt</strong>{" "}
                (weight) if needed.
              </li>
              <li>
                Click <strong>Apply &amp; recompute scores</strong> at the top of this page.
              </li>
              <li>
                Open the{" "}
                <Link to="/governance/maturity" className="text-indigo-600 underline dark:text-indigo-400">
                  Maturity
                </Link>{" "}
                tab, choose <strong>Local catalog</strong>, and click <strong>Refresh</strong> to see the pillar
                update.
              </li>
            </ol>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Wand2 className="h-3.5 w-3.5" /> Or describe it in plain English
            </p>
            <p className="mb-2 text-sm">
              Expand <strong>Add principle in natural language</strong>, type what you want in everyday
              language, then <strong>Preview</strong> or <strong>Apply &amp; recompute</strong>. Keywords pick
              the scorer automatically:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>
                <strong>glossary / business term</strong> → Metadata &amp; definitions
              </li>
              <li>
                <strong>PII / classification / sensitive</strong> → Security &amp; classification
              </li>
              <li>
                <strong>steward / owner / assigned</strong> → Governance &amp; stewardship
              </li>
              <li>
                <strong>data quality / DQ / passed</strong> → Data quality
              </li>
              <li>
                <strong>recent / updated / activity</strong> → Operational readiness
              </li>
            </ul>
            <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900/50 dark:bg-slate-900/50">
              <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">Example phrases</p>
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                <li>Require glossary terms on all financial columns</li>
                <li>All PII columns must have a data classification assigned</li>
                <li>Every column needs a data steward assigned before export</li>
              </ul>
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3.5 w-3.5" /> Optional: custom name + pillar
            </p>
            <p className="text-sm">
              To set both a display name and pillar explicitly, use an arrow (no other syntax needed):
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-900">
              Finance glossary coverage -&gt; Metadata &amp; definitions{"\n"}
              PII masking rule -&gt; Security &amp; classification{"\n"}
              Weekly steward review -&gt; Operational readiness
            </pre>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Hexagon className="h-3.5 w-3.5" /> Scorer type → maturity pillar (auto-assigned)
            </p>
            <p className="mb-2 text-xs text-slate-500">
              You do not pick the pillar separately when using the catalog — the scorer type sets it. Lineage
              &amp; traceability uses catalog lineage signals today (no principle scorer yet).
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 dark:border-slate-800">
                    <th className="px-3 py-2 font-semibold">Catalog scorer</th>
                    <th className="px-3 py-2 font-semibold">Maturity pillar</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((entry) => (
                    <tr
                      key={entry.rule_type}
                      className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                    >
                      <td className="px-3 py-2">{entry.label}</td>
                      <td className="px-3 py-2 font-medium text-indigo-700 dark:text-indigo-300">
                        {entry.maturity_pillar_label ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ListChecks className="h-3.5 w-3.5" /> After you add a principle
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>
                <strong>Recompute scores</strong> on this page — updates table readiness cards above.
              </li>
              <li>
                <strong>Data Maturity → Local catalog → Refresh</strong> — updates the radar (principles do
                not apply to Collibra-only view).
              </li>
              <li>
                Each enabled principle appears as a bar on table cards and under the matching pillar in{" "}
                <strong>Capability breakdown</strong>.
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <p>
              {offlineMode ? (
                <>Demo mode uses sample principles — connect the live backend to persist changes.</>
              ) : (
                <>
                  Full reference in repo:{" "}
                  <code className="rounded bg-white px-1 dark:bg-slate-900">
                    docs/GOVERNANCE_PRINCIPLES_GUIDE.md
                  </code>
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
