import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useApp } from "../context/AppContext";
import { LineageGraphView } from "../components/LineageGraph";
import { Button, Card, MetricCard, PageHeader, Spinner } from "../components/ui";
import type { LineageGraph } from "../types";

export function LineagePage() {
  const { governance, apiKey } = useApp();
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setGraph(await governance.lineage(undefined, apiKey || undefined));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [apiKey]);

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];

  return (
    <div>
      <PageHeader
        title="Data Lineage"
        description="End-to-end visibility from databases and tables to columns and downstream reports — synced from analyzed definitions."
        action={
          <Button variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Nodes" value={nodes.length} accent="indigo" />
        <MetricCard label="Connections" value={edges.length} accent="violet" />
        <MetricCard
          label="Databases"
          value={new Set(nodes.map((n) => n.database_name).filter(Boolean)).size}
          accent="emerald"
        />
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8" />
          </div>
        ) : graph ? (
          <LineageGraphView graph={graph} />
        ) : null}
      </Card>
    </div>
  );
}
