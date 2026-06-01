import type { LineageGraph, LineageNode } from "../types";

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  database: { bg: "#dbeafe", border: "#2563eb", text: "#1e40af" },
  table: { bg: "#dcfce7", border: "#16a34a", text: "#166534" },
  column: { bg: "#ffedd5", border: "#ea580c", text: "#9a3412" },
  report: { bg: "#f3e8ff", border: "#9333ea", text: "#6b21a8" },
};

function nodeLabel(node: LineageNode): string {
  const t = node.type;
  if (t === "database") return `DB: ${node.label}`;
  if (t === "table") return node.label;
  if (t === "report") return `📊 ${node.label}`;
  return node.label;
}

export function LineageGraphView({ graph }: { graph: LineageGraph }) {
  const { nodes, edges } = graph;
  if (!nodes.length) {
    return (
      <p className="text-sm text-slate-500">
        No lineage nodes yet. Analyze metadata with persistence enabled.
      </p>
    );
  }

  const byType = {
    database: nodes.filter((n) => n.type === "database"),
    table: nodes.filter((n) => n.type === "table"),
    column: nodes.filter((n) => n.type === "column"),
    report: nodes.filter((n) => n.type === "report"),
  };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        {Object.entries(NODE_COLORS).map(([type, c]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded border"
              style={{ background: c.bg, borderColor: c.border }}
            />
            {type}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="flex min-w-[720px] flex-col items-center gap-0">
          {/* Layer: databases */}
          <div className="flex flex-wrap justify-center gap-4">
            {byType.database.map((n) => (
              <NodeChip key={n.id} node={n} />
            ))}
          </div>
          {byType.database.length > 0 && byType.table.length > 0 && (
            <Connector />
          )}

          {/* Layer: tables */}
          <div className="flex flex-wrap justify-center gap-3">
            {byType.table.map((n) => (
              <NodeChip key={n.id} node={n} />
            ))}
          </div>
          {byType.table.length > 0 && byType.column.length > 0 && (
            <Connector />
          )}

          {/* Layer: columns */}
          <div className="flex flex-wrap justify-center gap-2">
            {byType.column.map((n) => (
              <NodeChip key={n.id} node={n} small />
            ))}
          </div>
          {byType.column.length > 0 && byType.report.length > 0 && (
            <Connector />
          )}

          {/* Layer: reports */}
          <div className="flex flex-wrap justify-center gap-3">
            {byType.report.map((n) => (
              <NodeChip key={n.id} node={n} />
            ))}
          </div>
        </div>
      </div>

      {edges.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Data flows ({edges.length})
          </p>
          <ul className="space-y-1 text-sm text-slate-600">
            {edges.slice(0, 12).map((e) => {
              const src = nodeMap.get(e.source_id);
              const tgt = nodeMap.get(e.target_id);
              return (
                <li key={e.id} className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">
                    {src?.label ?? e.source_id}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="font-medium text-slate-800">
                    {tgt?.label ?? e.target_id}
                  </span>
                  {e.label && (
                    <span className="text-xs text-indigo-600">({e.label})</span>
                  )}
                </li>
              );
            })}
            {edges.length > 12 && (
              <li className="text-xs text-slate-400">
                + {edges.length - 12} more connections
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="h-6 w-px bg-slate-300" />
      <div className="h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-slate-300" />
    </div>
  );
}

function NodeChip({
  node,
  small,
}: {
  node: LineageNode;
  small?: boolean;
}) {
  const colors = NODE_COLORS[node.type] ?? NODE_COLORS.column;
  return (
    <div
      className={`rounded-lg border-2 shadow-sm transition hover:scale-105 hover:shadow-md ${small ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
      style={{
        background: colors.bg,
        borderColor: colors.border,
        color: colors.text,
      }}
      title={node.details}
    >
      <span className="font-medium">{nodeLabel(node)}</span>
      {node.classification && (
        <span className="ml-1.5 text-[10px] opacity-75">
          ({node.classification})
        </span>
      )}
    </div>
  );
}
