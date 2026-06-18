import { useEffect, useRef, useState } from "react";
import { Play, Upload, Zap } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from "../components/ui";
import { PolicyCitations } from "../components/PolicyCitations";
import {
  clearAnalyzeDraft,
  fieldKey,
  loadAnalyzeDraft,
  saveAnalyzeDraft,
} from "../lib/analyzeDraft";
import { describeCsvSource, inferDatasetContext } from "../lib/metadataCsv";
import { PRODUCT_NAME } from "../lib/product";
import type { FieldDefinition } from "../types";

const SAMPLE_CSV = {
  path: "/clinical_ehr_patients.csv",
  name: "clinical_ehr_patients.csv",
} as const;

export function AnalyzePage() {
  const { governance, apiKey, kbCount } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [mode, setMode] = useState<"rag" | "llm">("rag");
  const [retrieval, setRetrieval] = useState<"tfidf" | "vector">("tfidf");
  const [maskSamples, setMaskSamples] = useState(true);
  const [persist, setPersist] = useState(true);
  const [useCollibra, setUseCollibra] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<FieldDefinition[]>([]);
  const [selected, setSelected] = useState<FieldDefinition | null>(null);
  const [sourceHint, setSourceHint] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    const draft = loadAnalyzeDraft();
    if (!draft) return;

    setFile(new File([draft.fileText], draft.fileName, { type: "text/csv" }));
    setSourceHint(draft.sourceHint);
    setContext(draft.context);
    setMode(draft.mode);
    setRetrieval(draft.retrieval);
    setMaskSamples(draft.maskSamples);
    setPersist(draft.persist);
    setUseCollibra(draft.useCollibra);
    setResults(draft.results);
    if (draft.results.length) {
      const match = draft.selectedKey
        ? draft.results.find((r) => fieldKey(r) === draft.selectedKey)
        : draft.results[0];
      setSelected(match ?? draft.results[0]);
    }
    setDraftRestored(true);
  }, []);

  useEffect(() => {
    if (!file) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const text = await file.text();
        saveAnalyzeDraft({
          fileName: file.name,
          fileText: text,
          sourceHint,
          context,
          mode,
          retrieval,
          maskSamples,
          persist,
          useCollibra,
          results,
          selectedKey: selected ? fieldKey(selected) : null,
        });
      })();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    file,
    sourceHint,
    context,
    mode,
    retrieval,
    maskSamples,
    persist,
    useCollibra,
    results,
    selected,
  ]);

  async function applyCsvFile(nextFile: File) {
    setError("");
    setFile(nextFile);
    try {
      const text = await nextFile.text();
      setContext(inferDatasetContext(text));
      setSourceHint(describeCsvSource(text, nextFile.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read CSV");
      setSourceHint("");
    }
  }

  async function loadSample() {
    setError("");
    try {
      const res = await fetch(SAMPLE_CSV.path);
      if (!res.ok) throw new Error("Sample file not found");
      const text = await res.text();
      await applyCsvFile(new File([text], SAMPLE_CSV.name, { type: "text/csv" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sample");
    }
  }

  async function runAnalysis() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResults([]);
    setSelected(null);
    try {
      const data = await governance.uploadCsv(file, {
        dataset_context: context,
        mask_samples: maskSamples,
        no_llm: mode === "rag",
        persist,
        retrieval_mode: retrieval,
        use_collibra: useCollibra,
        apiKey: apiKey || undefined,
      });
      setResults(data);
      if (data.length) setSelected(data[0]);
      setDraftRestored(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Analyze columns"
        description={`Upload a table export (header row + a few sample records) or a column catalog CSV. ${PRODUCT_NAME} infers column metadata and drafts definitions with policy citations.`}
        action={
          <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            <Zap className="h-3.5 w-3.5" />
            {kbCount} policies
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="space-y-5">
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                1. Upload table export
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/30 dark:border-slate-600 dark:bg-slate-800/30"
              >
                <Upload className="mx-auto h-7 w-7 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {file ? file.name : "Choose CSV or drop here"}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const next = e.target.files?.[0];
                    if (next) void applyCsvFile(next);
                    else setFile(null);
                  }}
                />
              </div>
              <Button
                variant="secondary"
                type="button"
                onClick={() => void loadSample()}
                className="mt-3 w-full"
              >
                Or load sample table export
              </Button>
              {draftRestored && (
                <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Restored your previous work on this page.
                  <button
                    type="button"
                    onClick={() => {
                      clearAnalyzeDraft();
                      setDraftRestored(false);
                    }}
                    className="ml-2 font-medium text-indigo-600 underline dark:text-indigo-400"
                  >
                    Clear
                  </button>
                </p>
              )}
              {sourceHint && (
                <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                  {sourceHint}
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Preferred format: one table with a header row and a few sample records (e.g.{" "}
                <code className="text-[11px]">clinical_ehr_patients.csv</code>). Database and table
                names are inferred from the filename. Column-catalog CSVs still work for bulk metadata.
              </p>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                2. Processing options
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={maskSamples}
                    onChange={(e) => setMaskSamples(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  Mask sample values before analysis
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={persist}
                    onChange={(e) => setPersist(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  Save results to catalog
                </label>
              </div>
            </section>

            <details className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/30">
              <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">
                3. Advanced options (optional)
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Dataset context</label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    placeholder="Auto-detected from CSV when left blank"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Draft mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as "rag" | "llm")}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  >
                    <option value="rag">Quick draft — local policies only (recommended)</option>
                    <option value="llm">Full AI draft — needs Ollama</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Policy search</label>
                  <select
                    value={retrieval}
                    onChange={(e) => setRetrieval(e.target.value as "tfidf" | "vector")}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  >
                    <option value="tfidf">Standard (fast)</option>
                    <option value="vector">Semantic (slow, needs Ollama)</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={useCollibra}
                    onChange={(e) => setUseCollibra(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  Use Collibra glossary (read existing terms, propose link or create)
                </label>
              </div>
            </details>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                4. Generate
              </p>
              <Button onClick={runAnalysis} disabled={!file || loading} className="w-full">
                {loading ? (
                  <>
                    <Spinner className="h-4 w-4" /> Working…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Generate definitions
                  </>
                )}
              </Button>
              {error && (
                <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {error}
                </p>
              )}
            </section>
          </div>
        </Card>

        <div className="lg:col-span-3">
          {results.length === 0 && !loading ? (
            <EmptyState
              title="No results yet"
              description="Upload a table export with sample rows or load the demo patients table, then click Generate definitions."
            />
          ) : loading ? (
            <Card>
              <div className="flex flex-col items-center py-20">
                <Spinner className="h-8 w-8" />
                <p className="mt-4 text-sm text-slate-500">Matching columns to local policies…</p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-2" title={`Results (${results.length})`}>
                <ul className="max-h-[520px] space-y-1 overflow-y-auto">
                  {results.map((r) => (
                    <li key={r.id ?? `${r.column_name}`}>
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          selected?.column_name === r.column_name &&
                          selected?.table_name === r.table_name
                            ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/40"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {r.table_name}.{r.column_name}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge label={r.data_classification || "—"} />
                          {(r.policy_citations?.length ?? 0) > 0 && (
                            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                              {r.policy_citations!.length} citations
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>

              {selected && (
                <Card className="lg:col-span-3" title="Column detail">
                  <div className="space-y-4">
                    <div>
                      <p className="font-mono text-xs text-slate-400">
                        {selected.database_name}.{selected.table_name}.{selected.column_name}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">
                        Table description
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">
                        {selected.table_name}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {selected.table_description?.trim() ||
                          "No table description was suggested for this field."}
                      </p>
                    </div>

                    <div className="space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">
                          Glossary term
                        </p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {selected.glossary_term || "—"}
                        </p>
                        {selected.glossary_term_description && (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                            {selected.glossary_term_description}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">
                          Logical data attribute
                        </p>
                        <p className="font-mono text-sm text-slate-800 dark:text-slate-200">
                          {selected.logical_data_attribute_name || "—"}
                        </p>
                        {selected.logical_data_attribute_description && (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                            {selected.logical_data_attribute_description}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">
                          Column definition
                        </p>
                        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                          {selected.definition}
                        </p>
                        {selected.likely_purpose && (
                          <p className="mt-1 text-xs text-slate-500">
                            Purpose: {selected.likely_purpose}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge label={selected.data_classification} />
                      <Badge label={`Sensitivity: ${selected.sensitivity}`} />
                    </div>

                    {(selected.collibra_matches?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900 dark:bg-violet-950/20">
                        <p className="text-[10px] font-semibold uppercase text-violet-700 dark:text-violet-300">
                          Collibra glossary matches
                        </p>
                        <ul className="mt-2 space-y-2 text-xs">
                          {selected.collibra_matches!.map((m, i) => (
                            <li key={i} className="text-slate-700 dark:text-slate-300">
                              <span className="font-medium">{m.name}</span>
                              {m.collibra_asset_id && (
                                <span className="font-mono text-slate-400"> · {m.collibra_asset_id.slice(0, 8)}…</span>
                              )}
                              <span className="text-slate-500"> — {m.suggested_action}</span>
                              {m.definition_excerpt && (
                                <p className="mt-0.5 text-slate-500">{m.definition_excerpt}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                        {selected.collibra_recommended_action && (
                          <p className="mt-2 text-xs font-medium text-violet-800 dark:text-violet-200">
                            Recommended: {selected.collibra_recommended_action}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Policy citations (local knowledge base)
                      </p>
                      <div className="mt-2">
                        <PolicyCitations
                          citations={selected.policy_citations ?? []}
                          rationale={selected.decision_rationale}
                          regulatoryTags={selected.regulatory_tags}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
