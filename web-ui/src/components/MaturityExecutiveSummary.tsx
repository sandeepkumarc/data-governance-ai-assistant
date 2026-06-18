import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Spinner } from "./ui";
import type { DataMaturityDomain, MaturityExecutiveSummary as SummaryPayload } from "../types";

interface MaturityExecutiveSummaryProps {
  domainId: string;
  source: "local" | "collibra" | "blended";
  selected: DataMaturityDomain;
}

export function MaturityExecutiveSummary({
  domainId,
  source,
  selected,
}: MaturityExecutiveSummaryProps) {
  const { governance, apiKey, usesOfflineData } = useApp();
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [useLlm, setUseLlm] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (withLlm = useLlm) => {
      if (!governance.maturityExecutiveSummary) return;
      setLoading(true);
      setError("");
      try {
        const result = await governance.maturityExecutiveSummary(
          domainId === "enterprise" ? undefined : domainId,
          source,
          { no_llm: !withLlm },
          apiKey || undefined,
        );
        setSummary(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate summary");
      } finally {
        setLoading(false);
      }
    },
    [governance, apiKey, domainId, source, useLlm],
  );

  useEffect(() => {
    void load(false);
  }, [domainId, source, selected.overall_level, selected.overall_score]);

  return (
    <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Executive summary
          </p>
          <p className="text-[11px] text-slate-400">
            Natural-language brief for {selected.domain_label}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!usesOfflineData && (
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <input
                type="checkbox"
                checked={useLlm}
                onChange={(e) => setUseLlm(e.target.checked)}
              />
              Ollama polish
            </label>
          )}
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => void load(useLlm)}
            className="!px-2 !py-1 text-xs"
          >
            {loading ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : useLlm ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {loading && !summary ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5" />
        </div>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : summary ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {summary.summary}
          </p>
          {summary.used_llm && (
            <p className="mt-2 text-[10px] text-indigo-600 dark:text-indigo-400">
              Enhanced with local Ollama
            </p>
          )}
          {(summary.strongest.length > 0 || summary.weakest.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
              {summary.strongest.map((p) => (
                <span key={p.key} className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  ↑ {p.label} L{p.level}
                </span>
              ))}
              {summary.weakest.map((p) => (
                <span key={p.key} className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  ↓ {p.label} L{p.level}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
