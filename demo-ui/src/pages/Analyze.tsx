import { useRef, useState } from "react";
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
import type { FieldDefinition } from "../types";

const DEFAULT_CONTEXT =
  "Enterprise customer metadata export. Goal: draft governance definitions, classifications, sensitivity ratings, and recommended stewardship actions for steward review.";

export function AnalyzePage() {
  const { governance, apiKey, kbCount } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [mode, setMode] = useState<"rag" | "llm">("rag");
  const [retrieval, setRetrieval] = useState<"tfidf" | "vector">("tfidf");
  const [maskSamples, setMaskSamples] = useState(true);
  const [persist, setPersist] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<FieldDefinition[]>([]);
  const [selected, setSelected] = useState<FieldDefinition | null>(null);

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
        apiKey: apiKey || undefined,
      });
      setResults(data);
      if (data.length) setSelected(data[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Semantic Mapping"
        description="Upload field metadata CSV and generate AI-assisted glossary definitions, classifications, and governance recommendations."
        action={
          <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            <Zap className="h-3.5 w-3.5" />
            {kbCount} policy sections indexed
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card title="1 · Upload metadata">
            <div
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/30"
            >
              <Upload className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                {file ? file.name : "Drop CSV or click to browse"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                database_name, table_name, column_name, data_type, sample_values, notes
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </Card>

          <Card title="2 · Run settings">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Generation mode</label>
                <div className="mt-1.5 flex gap-2">
                  {(["rag", "llm"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        mode === m
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {m === "rag" ? "RAG only (fast)" : "RAG + LLM"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Retrieval</label>
                <div className="mt-1.5 flex gap-2">
                  {(["tfidf", "vector"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRetrieval(r)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        retrieval === r
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {r === "tfidf" ? "TF-IDF" : "Vector (semantic)"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={maskSamples}
                  onChange={(e) => setMaskSamples(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                Mask sensitive sample values
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={persist}
                  onChange={(e) => setPersist(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                Save to database (enables lineage & trust)
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Dataset context..."
              />
              <Button
                onClick={runAnalysis}
                disabled={!file || loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Spinner className="h-4 w-4" /> Analyzing…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Generate definitions
                  </>
                )}
              </Button>
              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {results.length === 0 && !loading ? (
            <EmptyState
              title="Ready to analyze"
              description="Upload backend/sample_metadata.csv to see semantic mapping in action. Results appear here with glossary terms, classifications, and governance actions."
            />
          ) : loading ? (
            <Card>
              <div className="flex flex-col items-center py-20">
                <Spinner className="h-8 w-8" />
                <p className="mt-4 text-sm text-slate-500">
                  Retrieving policy context{retrieval === "vector" ? " via embeddings" : ""}…
                </p>
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
                            ? "bg-indigo-50 ring-1 ring-indigo-200"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <p className="font-medium text-slate-800">
                          {r.table_name}.{r.column_name}
                        </p>
                        <div className="mt-1 flex gap-1">
                          <Badge label={r.data_classification || "—"} />
                          <Badge label={r.approval_status || "draft"} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>

              {selected && (
                <Card className="lg:col-span-3" title="Definition detail">
                  <div className="space-y-4">
                    <div>
                      <p className="font-mono text-xs text-slate-400">
                        {selected.database_name}.{selected.table_name}.{selected.column_name}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">
                        {selected.glossary_term}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {selected.glossary_term_description}
                      </p>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Business definition
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">
                        {selected.definition}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge label={selected.data_classification} />
                      <Badge label={`Sensitivity: ${selected.sensitivity}`} />
                      <Badge label={selected.retrieval_mode ?? "tfidf"} />
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Retrieved policy context
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(selected.retrieved_context ?? []).map((c) => (
                          <span
                            key={c}
                            className="rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Governance actions
                      </p>
                      <ul className="mt-2 space-y-1">
                        {(selected.governance_actions ?? []).map((a) => (
                          <li
                            key={a}
                            className="flex items-start gap-2 text-sm text-slate-600"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                            {a}
                          </li>
                        ))}
                      </ul>
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
