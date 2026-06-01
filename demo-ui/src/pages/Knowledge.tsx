import { useEffect, useState } from "react";
import { BookMarked, Plus, Save, Search, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from "../components/ui";
import type { KbNlUpdateResult, KbSection } from "../types";

const NL_EXAMPLES = [
  "Add cust_nbr and acct_id as aliases for customer identifier in the aliases section",
  "All salary and compensation fields must be classified Restricted with HR-only access",
  "Create a GDPR section requiring consent tracking for marketing email fields",
];

export function KnowledgePage() {
  const { governance, apiKey, isDemoData, refreshStatus } = useApp();
  const [sections, setSections] = useState<KbSection[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isNew, setIsNew] = useState(false);

  const [nlInstruction, setNlInstruction] = useState("");
  const [nlTarget, setNlTarget] = useState("");
  const [nlUseLlm, setNlUseLlm] = useState(true);
  const [nlLoading, setNlLoading] = useState(false);
  const [nlResult, setNlResult] = useState<KbNlUpdateResult | null>(null);
  const [showNlPanel, setShowNlPanel] = useState(true);

  async function loadSections(preferTitle?: string | null) {
    setLoading(true);
    setError("");
    try {
      const data = await governance.kbSections(apiKey || undefined);
      setSections(data);
      const pick =
        (preferTitle && data.find((s) => s.title === preferTitle)) ||
        (selectedTitle && data.find((s) => s.title === selectedTitle)) ||
        data[0];
      if (pick && !isNew) {
        selectSection(pick);
      } else if (!data.length) {
        setSelectedTitle(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load knowledge base");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSections();
  }, [governance, isDemoData]);

  function selectSection(section: KbSection) {
    setSelectedTitle(section.title);
    setEditTitle(section.title);
    setEditText(section.text ?? "");
    setIsNew(false);
    setError("");
  }

  function startNewSection() {
    setSelectedTitle(null);
    setEditTitle("");
    setEditText("");
    setIsNew(true);
    setError("");
  }

  async function handleSave() {
    const title = editTitle.trim();
    if (!title) {
      setError("Section title is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isNew) {
        const created = await governance.createKbSection(
          { title, text: editText },
          apiKey || undefined,
        );
        setIsNew(false);
        await loadSections(created.title);
      } else if (selectedTitle) {
        const updated = await governance.updateKbSection(
          {
            original_title: selectedTitle,
            title: title !== selectedTitle ? title : undefined,
            text: editText,
          },
          apiKey || undefined,
        );
        await loadSections(updated.title);
      }
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleNlUpdate(apply: boolean) {
    if (!nlInstruction.trim()) {
      setError("Enter a natural language instruction");
      return;
    }
    setNlLoading(true);
    setError("");
    try {
      const result = await governance.nlUpdateKb(
        {
          instruction: nlInstruction,
          target_section: nlTarget || undefined,
          no_llm: !nlUseLlm,
          dry_run: !apply,
        },
        apiKey || undefined,
      );
      setNlResult(result);
      if (result.applied && result.sections) {
        setSections(result.sections);
        const firstChange = result.changes[0];
        if (firstChange?.title) {
          const updated = result.sections.find((s) => s.title === firstChange.title);
          if (updated) selectSection(updated);
        }
        await refreshStatus();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Natural language update failed");
    } finally {
      setNlLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedTitle || isNew) return;
    if (!confirm(`Delete section "${selectedTitle}"? This cannot be undone.`)) return;
    setSaving(true);
    setError("");
    try {
      await governance.deleteKbSection(selectedTitle, apiKey || undefined);
      setSelectedTitle(null);
      setIsNew(false);
      await loadSections();
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const filtered = sections.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      (s.text ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Manage governance policy sections used by RAG retrieval during semantic mapping. Changes take effect on the next analysis run."
        action={
          <Button onClick={startNewSection}>
            <Plus className="h-4 w-4" /> New section
          </Button>
        }
      />

      {isDemoData && (
        <p className="mb-4 text-xs text-amber-700 dark:text-amber-300">
          Offline mode — edits are stored in browser memory only. Connect the backend to persist to{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">governance_knowledge.md</code>.
        </p>
      )}

      <Card className="mb-6 border-indigo-200/60 dark:border-indigo-800/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Update with natural language
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowNlPanel((v) => !v)}
            className="text-xs text-indigo-600 dark:text-indigo-400"
          >
            {showNlPanel ? "Hide" : "Show"}
          </button>
        </div>
        {showNlPanel && (
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Describe policy changes in plain English. The assistant will draft updates to the
              right knowledge sections — preview first, then apply.
            </p>
            <textarea
              value={nlInstruction}
              onChange={(e) => setNlInstruction(e.target.value)}
              rows={3}
              placeholder="e.g. Add cust_nbr as an alias for customer_id and classify it as Restricted..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
            <div className="flex flex-wrap gap-2">
              {NL_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setNlInstruction(ex)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  {ex.slice(0, 48)}…
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Target section (optional)
                </label>
                <select
                  value={nlTarget}
                  onChange={(e) => setNlTarget(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="">Auto-select best section</option>
                  {sections.map((s) => (
                    <option key={s.title} value={s.title}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end gap-2 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={nlUseLlm}
                    onChange={(e) => setNlUseLlm(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  Use local LLM (gemma4:e2b)
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                disabled={nlLoading || !nlInstruction.trim()}
                onClick={() => handleNlUpdate(false)}
              >
                {nlLoading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                Preview changes
              </Button>
              <Button
                disabled={nlLoading || !nlInstruction.trim()}
                onClick={() => handleNlUpdate(true)}
              >
                {nlLoading ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                Apply to knowledge base
              </Button>
            </div>
            {nlResult && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {nlResult.summary}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {nlResult.applied ? "Applied" : "Preview only"} · {nlResult.changes.length}{" "}
                  change(s)
                </p>
                <ul className="mt-3 space-y-2">
                  {nlResult.changes.map((c, i) => (
                    <li
                      key={`${c.title}-${i}`}
                      className="rounded-md border border-slate-200 bg-white p-3 text-xs dark:border-slate-600 dark:bg-slate-800"
                    >
                      <div className="mb-1 flex gap-2">
                        <Badge label={c.action} />
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {c.title}
                        </span>
                      </div>
                      {c.text && (
                        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {c.text.slice(0, 600)}
                          {c.text.length > 600 ? "…" : ""}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {loading && sections.length === 0 ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2" title={`Sections (${sections.length})`}>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sections..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <ul className="max-h-[520px] space-y-1 overflow-y-auto">
              {filtered.map((s) => (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => selectSection(s)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      selectedTitle === s.title && !isNew
                        ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BookMarked className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">{s.title}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {(s.text ?? "").slice(0, 100)}
                    </p>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="py-6 text-center text-sm text-slate-500">No matching sections</li>
              )}
            </ul>
          </Card>

          <div className="lg:col-span-3">
            {isNew || selectedTitle ? (
              <Card title={isNew ? "New section" : "Edit section"}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Section title</label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="e.g. Contact Information"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Used as the ## heading in the knowledge base and for RAG retrieval matching
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Policy content</label>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={16}
                      placeholder="Describe column patterns, classification rules, and governance guidance..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm leading-relaxed focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                      <span>Markdown-style plain text supported</span>
                      <span>{editText.length} characters</span>
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                      {isNew ? "Create section" : "Save changes"}
                    </Button>
                    {!isNew && selectedTitle && (
                      <Button variant="danger" onClick={handleDelete} disabled={saving}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    )}
                    {isNew && sections[0] && (
                      <Button variant="secondary" onClick={() => selectSection(sections[0])}>
                        Cancel
                      </Button>
                    )}
                  </div>

                  {!isNew && selectedTitle && (
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
                      <p className="text-xs font-medium text-slate-500">Retrieval hint</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        Fields matching keywords in this section will retrieve it during semantic mapping.
                      </p>
                      <div className="mt-2">
                        <Badge label="RAG context" />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <EmptyState
                title="Select or create a section"
                description="Knowledge sections power RAG retrieval — choose one from the list or create a new policy section."
                action={
                  <Button onClick={startNewSection}>
                    <Plus className="h-4 w-4" /> New section
                  </Button>
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
