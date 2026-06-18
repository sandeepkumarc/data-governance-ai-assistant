import type { PolicyCitation } from "../types";

export function PolicyCitations({
  citations,
  rationale,
  regulatoryTags,
  compact = false,
}: {
  citations: PolicyCitation[];
  rationale?: string;
  regulatoryTags?: string[];
  compact?: boolean;
}) {
  if (!citations.length && !rationale && !regulatoryTags?.length) {
    return (
      <p className="text-xs text-slate-500">No policy citations recorded for this decision.</p>
    );
  }

  return (
    <div className="space-y-3">
      {regulatoryTags && regulatoryTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {regulatoryTags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-800"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {rationale && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 dark:border-indigo-900/50 dark:bg-indigo-950/30">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Decision rationale
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{rationale}</p>
        </div>
      )}

      {citations.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Policy citations ({citations.length})
          </p>
          <ol className={`mt-2 space-y-2 ${compact ? "" : ""}`}>
            {citations.map((c, i) => (
              <li
                key={`${c.section}-${i}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    [{i + 1}] {c.section}
                  </span>
                  {c.relevance_score != null && (
                    <span className="font-mono text-[10px] text-slate-400">
                      relevance {(c.relevance_score * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                {!compact && c.excerpt && (
                  <blockquote className="mt-1.5 border-l-2 border-indigo-200 pl-2 text-xs leading-relaxed text-slate-600 dark:border-indigo-800 dark:text-slate-400">
                    {c.excerpt}
                  </blockquote>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
