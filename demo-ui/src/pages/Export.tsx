import { useState } from "react";
import { Download } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Card, PageHeader, Spinner } from "../components/ui";

export function ExportPage() {
  const { governance, apiKey } = useApp();
  const [filter, setFilter] = useState("approved");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div>
      <PageHeader
        title="Catalog Export"
        description="Export steward-approved field definitions in Collibra-compatible CSV format for your data catalog."
      />

      <Card className="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500">
              Approval filter
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="approved">Approved only</option>
              <option value="pending_review">Pending review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <Button onClick={generate} disabled={loading}>
            {loading ? <Spinner className="h-4 w-4" /> : "Generate export"}
          </Button>
        </div>
      </Card>

      {preview && (
        <Card className="mt-6" title="Preview">
          <div className="mb-3 flex justify-end">
            <Button variant="secondary" onClick={download}>
              <Download className="h-4 w-4" /> Download CSV
            </Button>
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-300">
            {preview.slice(0, 4000)}
            {preview.length > 4000 && "\n…"}
          </pre>
        </Card>
      )}
    </div>
  );
}
