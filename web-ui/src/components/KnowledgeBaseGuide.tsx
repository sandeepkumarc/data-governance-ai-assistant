import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, FileText, Globe, Sparkles } from "lucide-react";
import { Card } from "./ui";

export function KnowledgeBaseGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="mb-6 border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            How to add knowledge (better citations &amp; assistant help)
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
            Policy content is <strong>100% local</strong> — stored in{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs dark:bg-slate-900">
              backend/governance_knowledge.md
            </code>
            . Nothing is loaded from the internet. More accurate sections mean better{" "}
            <strong>classifications</strong>, <strong>citations on Analyze</strong>, and{" "}
            <strong>Ask assistant</strong> answers.
          </p>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3.5 w-3.5" /> Four ways to contribute
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              <li>
                <strong>This page</strong> — New section / edit / Save (live backend writes the file).
              </li>
              <li>
                <strong>Natural language panel below</strong> — describe changes; preview, then apply.
              </li>
              <li>
                <strong>Edit the markdown file</strong> in Git — one <code className="text-xs">## Title</code> per
                policy topic.
              </li>
              <li>
                <strong>API</strong> — <code className="text-xs">POST /api/knowledge-base/sections</code> for
                automation.
              </li>
            </ol>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <FileText className="h-3.5 w-3.5" /> Write sections retrieval can find
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Use <strong>specific titles</strong> (e.g. HIPAA PHI Identifiers, not “Policies”).</li>
              <li>Include <strong>column names &amp; abbreviations</strong> (mrn, icd10, member_id, ndc).</li>
              <li>Add a <strong>Governance guidance:</strong> bullet list (classify, mask, steward, retention).</li>
              <li>Prefer <strong>several short sections</strong> over one very long section.</li>
              <li>Have compliance review text before production — this is guidance, not legal advice.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900/50 dark:bg-slate-900/50">
            <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">Mini template</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
{`## Your Policy Topic

Column patterns: foo_id, bar_code, ...

Governance guidance:
- Classify as Restricted / Confidential
- Assign business owner and data steward
- Mask in non-production; document retention`}
            </pre>
          </div>

          <div className="flex flex-wrap items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <p>
              After saving: re-run <strong>Analyze columns</strong> (Standard search is fastest) and open a result
              to verify <strong>Policy citations</strong>. Full guide in repo:{" "}
              <code className="rounded bg-white px-1 dark:bg-slate-900">docs/KNOWLEDGE_BASE_GUIDE.md</code>
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
