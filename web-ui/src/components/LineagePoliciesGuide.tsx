import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, GitBranch, Layers, Sparkles, Wand2 } from "lucide-react";
import { Card } from "./ui";

export function LineagePoliciesGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="mb-6 border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            How lineage stitching works (policies behind the graph)
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
            Lineage has two layers: <strong>structural links</strong> (database → table → column from saved
            analyze) and <strong>policy links</strong> (cross-database stitches and column → report routes).
            Policies are <strong>100% local</strong> — stored in SQLite{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs dark:bg-slate-900">lineage_policies</code>,
            seeded from{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs dark:bg-slate-900">
              backend/lineage_policies.default.json
            </code>
            .
          </p>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Layers className="h-3.5 w-3.5" /> Pipeline (what runs when)
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              <li>
                <strong>Analyze + Save to database</strong> — creates field definitions and structural lineage
                nodes/edges.
              </li>
              <li>
                <strong>Policy engine</strong> — runs enabled policies against columns/tables and adds stitched
                edges (same name, logical attribute, keywords → report).
              </li>
              <li>
                <strong>Apply policies</strong> (header button) — re-runs all enabled policies after new data or
                policy changes.
              </li>
            </ol>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3.5 w-3.5" /> Policy rule types
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <code className="text-xs">structural</code> — automatic containment; no extra policy edges.
              </li>
              <li>
                <code className="text-xs">match_full_name</code> — link columns with the same name across databases
                (e.g. <code className="text-xs">customer_id</code>).
              </li>
              <li>
                <code className="text-xs">match_logical_attribute</code> — link columns sharing the same{" "}
                <strong>logical data attribute</strong> from semantic mapping.
              </li>
              <li>
                <code className="text-xs">match_glossary_term</code> — link columns sharing the same{" "}
                <strong>business glossary term</strong> (DAMA / ISO 11179 alignment).
              </li>
              <li>
                <code className="text-xs">match_table_name</code> — link tables with the same name across systems.
              </li>
              <li>
                <code className="text-xs">keyword_to_report</code> — route columns to a report node when name,
                classification, or definition matches keywords (PII → compliance ledger, financial → revenue dashboard).
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Industry standards (pre-loaded policy pack)
            </p>
            <p className="mb-2 text-sm leading-relaxed">
              Click <strong>Load industry policy pack</strong> to add catalog policies you have not installed yet.
              Each maps to common metadata / lineage practices:
            </p>
            <ul className="space-y-1.5 text-sm">
              <li>
                <strong>OpenLineage / DAMA physical</strong> — structural database → table → column (always on).
              </li>
              <li>
                <strong>MDM / entity resolution</strong> — stitch columns with the same name across systems.
              </li>
              <li>
                <strong>Semantic layer (Collibra, Informatica)</strong> — logical attribute and glossary term matching.
              </li>
              <li>
                <strong>GDPR / HIPAA / SOX / BCBS 239</strong> — route sensitive or regulatory columns to compliance
                or risk reports.
              </li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Enable only the policies that match your industry, then <strong>Apply enabled policies</strong>. Disable
              or delete policies you do not need — deleted policies do not remove existing stitched edges until you
              re-analyze or manually clean the graph.
            </p>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Wand2 className="h-3.5 w-3.5" /> Manage policies in the UI
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              <li>
                Expand <strong>Stitching policies</strong> at the bottom of this page.
              </li>
              <li>
                Toggle <strong>On/Off</strong> per policy, or delete custom/optional catalog policies (structural
                baseline cannot be removed).
              </li>
              <li>
                <strong>Apply enabled policies</strong> — re-stitch the graph after changes.
              </li>
              <li>
                <strong>Natural language</strong> — add custom rules; preview then apply.
              </li>
            </ol>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Wand2 className="h-3.5 w-3.5" /> API
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              <li>
                <code className="text-xs">GET /api/lineage/policies</code> — list all policies.
              </li>
              <li>
                <code className="text-xs">PATCH /api/lineage/policies{"{id}"}</code> — enable/disable.
              </li>
              <li>
                <code className="text-xs">DELETE /api/lineage/policies{"{id}"}</code> — remove (except structural).
              </li>
              <li>
                <code className="text-xs">POST /api/lineage/policies/sync-catalog</code> — add missing industry pack.
              </li>
              <li>
                <code className="text-xs">POST /api/lineage/policies/apply</code> — run enabled policies.
              </li>
              <li>
                <code className="text-xs">POST /api/lineage/policies/nl-update</code> — natural language add.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-3 dark:border-violet-900/50 dark:bg-slate-900/50">
            <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">
              Example NL instructions
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              <li>Stitch columns when full names match across databases</li>
              <li>Route all HIPAA and patient columns to the compliance ledger</li>
              <li>Link columns that share the same logical attribute name</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <p>
              Verify: open <strong>Path</strong> view, select a column, check{" "}
              <strong>Cross-system stitches</strong> and dashed amber policy edges. Reference doc:{" "}
              <code className="rounded bg-white px-1 dark:bg-slate-900">docs/LINEAGE_POLICIES_GUIDE.md</code> and{" "}
              <code className="rounded bg-white px-1 dark:bg-slate-900">backend/lineage_knowledge.md</code>.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
