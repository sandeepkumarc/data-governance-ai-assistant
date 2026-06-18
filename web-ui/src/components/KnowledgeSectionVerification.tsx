import { CheckCircle2, ClipboardCopy, FlaskConical, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button } from "./ui";
import type { KnowledgeSectionVerification } from "../types";

export function KnowledgeSectionVerificationPanel({
  verification,
  onRerun,
  rerunning,
}: {
  verification: KnowledgeSectionVerification;
  onRerun?: () => void;
  rerunning?: boolean;
}) {
  const { test_case: testCase, analysis_preview: preview } = verification;

  async function copyCsv() {
    await navigator.clipboard.writeText(testCase.sample_csv);
  }

  return (
    <div
      className={`rounded-lg border p-4 ${
        verification.passed
          ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
          : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {verification.passed ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 text-amber-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Retrieval test {verification.passed ? "passed" : "needs tuning"}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Confidence {verification.confidence}% · probe column{" "}
              <code className="rounded bg-white/70 px-1 dark:bg-slate-900">{testCase.column_name}</code>
              {verification.target_rank != null && (
                <> · section rank #{verification.target_rank}</>
              )}
            </p>
          </div>
        </div>
        {onRerun && (
          <Button variant="secondary" type="button" onClick={onRerun} disabled={rerunning}>
            <FlaskConical className="h-4 w-4" />
            Re-run test
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200/80 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Sample test CSV</p>
          <p className="mt-1 text-xs text-slate-500">
            Upload to <strong>Analyze columns</strong> to confirm end-to-end behavior.
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-950 px-2 py-2 font-mono text-[11px] text-emerald-200">
            {testCase.sample_csv}
          </pre>
          <p className="mt-2 text-[11px] text-slate-500">
            Save as <code>{testCase.csv_filename}</code> (table export format)
          </p>
          <Button variant="ghost" type="button" onClick={() => void copyCsv()} className="mt-2 !px-2 !py-1 text-xs">
            <ClipboardCopy className="h-3.5 w-3.5" /> Copy CSV
          </Button>
        </div>

        <div className="rounded-md border border-slate-200/80 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Quick draft preview</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
            {preview.glossary_term || "—"}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{preview.definition}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge label={preview.data_classification || "—"} />
            <Badge label={`Sensitivity: ${preview.sensitivity || "—"}`} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{preview.decision_rationale}</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase text-slate-400">Policy sections cited</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {verification.cited_sections.length ? (
            verification.cited_sections.map((section) => (
              <Badge
                key={section}
                label={section}
                className={
                  section === verification.target_section
                    ? "!bg-indigo-100 !text-indigo-800 ring-indigo-200"
                    : ""
                }
              />
            ))
          ) : (
            <span className="text-xs text-slate-500">No citations returned</span>
          )}
        </div>
      </div>

      {verification.recommendations.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-400">
          {verification.recommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-slate-500">
        <Link to="/analyze" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Open Analyze columns
        </Link>{" "}
        and upload the sample CSV to validate in the full UI.
      </p>
    </div>
  );
}
