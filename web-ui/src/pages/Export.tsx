import { useEffect, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Card, PageHeader, Spinner } from "../components/ui";
import type { CollibraStatus } from "../types";

export function ExportPage() {
  const { governance, apiKey } = useApp();
  const [filter, setFilter] = useState("approved");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [collibra, setCollibra] = useState<CollibraStatus | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState("");

  useEffect(() => {
    governance.collibraStatus(apiKey || undefined).then(setCollibra).catch(() => setCollibra(null));
  }, [governance, apiKey]);

  async function generate() {
    setLoading(true);
    try {
      const csv = (await governance.exportCollibra({
        approval_status: filter || undefined,
        format: "csv",
        apiKey: apiKey || undefined,
      })) as string;
      setPreview(csv);
    } finally {
      setLoading(false);
    }
  }

  function download() {
    const blob = new Blob([preview], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "collibra_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function pushToCollibra() {
    setPushing(true);
    setPushResult("");
    try {
      const res = await governance.collibraPushApproved(apiKey || undefined);
      setPushResult(
        res.errors?.length
          ? `Pushed ${res.pushed}. Errors: ${res.errors.join("; ")}`
          : `Pushed ${res.pushed} approved term(s) to Collibra.`,
      );
    } catch (e) {
      setPushResult(e instanceof Error ? e.message : "Push failed");
    } finally {
      setPushing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Catalog export"
        description="Download CSV for manual import, or push approved glossary terms to Collibra when connected."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">CSV export</h3>
          <div className="space-y-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">All statuses</option>
              <option value="approved">Approved only</option>
              <option value="pending_review">Pending review</option>
            </select>
            <Button onClick={generate} disabled={loading}>
              {loading ? <Spinner className="h-4 w-4" /> : "Generate CSV"}
            </Button>
            {preview && (
              <Button variant="secondary" onClick={download}>
                <Download className="h-4 w-4" /> Download
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <Upload className="h-4 w-4" /> Collibra push
          </h3>
          {collibra?.configured ? (
            <div className="space-y-3 text-sm">
              <p className="text-slate-600 dark:text-slate-400">
                Connected ({collibra.mode}) — domain: <strong>{collibra.glossary_domain}</strong>
              </p>
              <p className="text-xs text-slate-500">
                Push creates or updates <strong>Business Term</strong> assets for approved rows. See{" "}
                <code className="text-[11px]">docs/COLLIBRA_MCP_INTEGRATION.md</code>.
              </p>
              <Button onClick={pushToCollibra} disabled={pushing}>
                {pushing ? <Spinner className="h-4 w-4" /> : "Push approved to Collibra"}
              </Button>
              {pushResult && (
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {pushResult}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Set <code className="text-xs">COLLIBRA_ENABLED=true</code> and API credentials on the
              backend, or use CSV export. Chip MCP uses the same Collibra APIs — see integration guide.
            </p>
          )}
        </Card>
      </div>

      {preview && (
        <Card className="mt-6" title="CSV preview">
          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-300">
            {preview.slice(0, 4000)}
            {preview.length > 4000 && "\n…"}
          </pre>
        </Card>
      )}
    </div>
  );
}
