import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CloudDownload, Layers, RefreshCw, TrendingUp } from "lucide-react";
import { useApp } from "../context/AppContext";
import { AdminSection } from "../components/AdminSection";
import { MaturityExecutiveSummary } from "../components/MaturityExecutiveSummary";
import { MaturityRadarChart, type RadarSeries } from "../components/MaturityRadarChart";
import { Badge, Button, Card, EmptyState, MetricCard, PageHeader, Spinner } from "../components/ui";
import type { DataMaturityPayload, DataMaturityDomain, MaturityConfig } from "../types";

type MaturitySource = "local" | "collibra" | "blended";

const STAGE_COLORS: Record<number, string> = {
  1: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  2: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  3: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  4: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  5: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
};

function MaturityCurveStrip({
  stages,
  currentLevel,
}: {
  stages: DataMaturityPayload["stages"];
  currentLevel: number;
}) {
  return (
    <div className="relative pt-2">
      <div className="flex items-end justify-between gap-1">
        {stages.map((stage) => {
          const rounded = Math.round(currentLevel);
          const active = rounded === stage.level;
          const passed = currentLevel >= stage.level;
          return (
            <div key={stage.key} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={`flex h-16 w-full items-end justify-center rounded-t-lg border transition ${
                  active
                    ? "border-indigo-400 bg-gradient-to-t from-indigo-500/30 to-indigo-400/10 ring-2 ring-indigo-400/50"
                    : passed
                      ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30"
                      : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                }`}
                style={{ height: `${28 + stage.level * 14}px` }}
              >
                <span
                  className={`mb-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-indigo-600 text-white" : STAGE_COLORS[stage.level]
                  }`}
                >
                  L{stage.level}
                </span>
              </div>
              <p
                className={`text-center text-[10px] font-semibold leading-tight ${
                  active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                }`}
              >
                {stage.label}
              </p>
            </div>
          );
        })}
      </div>
      <svg
        className="pointer-events-none absolute inset-x-0 top-8 h-20 w-full text-indigo-400/40"
        preserveAspectRatio="none"
        viewBox="0 0 100 40"
      >
        <path
          d="M 0 38 Q 25 36, 50 22 T 100 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      </svg>
    </div>
  );
}

function DomainCard({
  domain,
  selected,
  onSelect,
}: {
  domain: DataMaturityDomain;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border px-3 py-2 text-left transition ${
        selected
          ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300 dark:border-indigo-600 dark:bg-indigo-950/40"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/40"
      }`}
    >
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{domain.domain_label}</p>
      <p className="text-xs text-slate-500">
        Level {domain.overall_level} · {domain.stage.label}
      </p>
    </button>
  );
}

export function DataMaturityPage({ embedded = false }: { embedded?: boolean }) {
  const { governance, apiKey, usesOfflineData } = useApp();
  const [payload, setPayload] = useState<DataMaturityPayload | null>(null);
  const [domainId, setDomainId] = useState("enterprise");
  const [source, setSource] = useState<MaturitySource>("local");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [configDraft, setConfigDraft] = useState<MaturityConfig | null>(null);
  const [labelKey, setLabelKey] = useState("");
  const [labelValue, setLabelValue] = useState("");

  const load = useCallback(
    async (selected = domainId, src: MaturitySource = source) => {
      setLoading(true);
      setError("");
      try {
        if (!governance.dataMaturity) {
          setPayload(null);
          return;
        }
        const data = await governance.dataMaturity(
          selected === "enterprise" ? undefined : selected,
          src,
          apiKey || undefined,
        );
        setPayload(data);
        setDomainId(data.selected_domain_id);
        if (data.config) setConfigDraft(data.config);
        else if (governance.maturityConfig) {
          setConfigDraft(await governance.maturityConfig(apiKey || undefined));
        }
        if (data.error && src === "collibra") setError(data.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load maturity data");
      } finally {
        setLoading(false);
      }
    },
    [governance, apiKey, domainId, source],
  );

  useEffect(() => {
    load(domainId, source);
  }, [governance, apiKey, source]);

  async function handleRecompute() {
    if (usesOfflineData || !governance.recomputeGovernanceReadiness) {
      await load(domainId, source);
      return;
    }
    setSyncing(true);
    setError("");
    try {
      await governance.recomputeGovernanceReadiness(apiKey || undefined);
      await load(domainId, source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recompute failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncCollibra() {
    if (!governance.syncCollibraMaturity || usesOfflineData) return;
    setSyncing(true);
    setError("");
    try {
      await governance.syncCollibraMaturity(apiKey || undefined);
      setSource("collibra");
      await load(domainId, "collibra");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Collibra sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function saveConfig() {
    if (!configDraft || !governance.updateMaturityConfig || usesOfflineData) return;
    setSyncing(true);
    try {
      await governance.updateMaturityConfig(configDraft, apiKey || undefined);
      await load(domainId, source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Config save failed");
    } finally {
      setSyncing(false);
    }
  }

  const selected = payload?.selected;
  const enterprise = payload?.enterprise;
  const collibraAvailable = payload?.collibra_available ?? usesOfflineData;

  const radarSeries = useMemo(() => {
    if (!selected) return [];
    const levels = selected.dimensions.map((d) => d.level);
    const series: RadarSeries[] = [
      {
        id: selected.domain_id,
        label: selected.domain_label,
        levels,
        color: "#6366f1",
      },
    ];
    if (
      enterprise &&
      selected.domain_id !== "enterprise" &&
      enterprise.dimensions.length === levels.length
    ) {
      series.push({
        id: "enterprise",
        label: "Enterprise avg",
        levels: enterprise.dimensions.map((d) => d.level),
        color: "#94a3b8",
        dashed: true,
      });
    }
    return series;
  }, [selected, enterprise]);

  const axisLabels = selected?.dimensions.map((d) => d.label) ?? [];
  const statColumns = selected?.stats.columns ?? selected?.stats.collibra_assets ?? 0;
  const statTables = selected?.stats.tables ?? selected?.stats.domains ?? 0;

  const sourceTabs: { id: MaturitySource; label: string }[] = [
    { id: "local", label: "Local catalog" },
    { id: "collibra", label: "Collibra assets" },
    { id: "blended", label: "Blended" },
  ];

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Data Maturity"
          description="Gartner Data & Analytics maturity curve — spider view by data domain. Score locally, from all Collibra DGC assets, or blended."
          action={
            <Button variant="secondary" onClick={() => load(domainId, source)} disabled={loading || syncing}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          }
        />
      )}

      {embedded && (
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" onClick={() => load(domainId, source)} disabled={loading || syncing}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {sourceTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={tab.id !== "local" && !collibraAvailable && !usesOfflineData}
            onClick={() => {
              setSource(tab.id);
              load(domainId, tab.id);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              source === tab.id
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {payload?.collibra_meta?.synced_at && source !== "local" && (
        <p className="mb-4 text-xs text-slate-500">
          Collibra snapshot: {payload.collibra_meta.asset_count ?? 0} assets ·{" "}
          {payload.collibra_meta.domain_count ?? 0} domains · synced{" "}
          {payload.collibra_meta.synced_at.slice(0, 16).replace("T", " ")}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !payload || !selected || (source === "collibra" && payload.ok === false && !payload.domains.length) ? (
        <EmptyState
          title={source === "collibra" ? "No Collibra maturity snapshot" : "No maturity data yet"}
          description={
            source === "collibra"
              ? "Connect Collibra (COLLIBRA_ENABLED) and click Sync Collibra to score all DGC assets by domain."
              : "Analyze and persist field definitions across domains to populate the maturity radar."
          }
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <MetricCard
              label="Selected domain"
              value={selected.domain_label}
              sub={`Level ${selected.overall_level} · ${selected.stage.label}`}
              icon={<Layers className="h-5 w-5" />}
              accent="indigo"
            />
            <MetricCard
              label="Overall score"
              value={`${selected.overall_score}%`}
              sub="Capability average (0–100)"
              icon={<TrendingUp className="h-5 w-5" />}
              accent="violet"
            />
            <MetricCard
              label={source === "collibra" ? "Collibra assets" : "Catalog scope"}
              value={statColumns}
              sub={
                source === "collibra"
                  ? `${statTables} Collibra domain(s)`
                  : `${statTables} table(s) in domain`
              }
              accent="emerald"
            />
            <MetricCard
              label="Data domains"
              value={payload.domains.length}
              sub="Distinct database / domain scope"
              accent="amber"
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <DomainCard
              domain={payload.enterprise}
              selected={domainId === "enterprise"}
              onSelect={() => {
                setDomainId("enterprise");
                load("enterprise", source);
              }}
            />
            {payload.domains.map((d) => (
              <DomainCard
                key={d.domain_id}
                domain={d}
                selected={domainId === d.domain_id}
                onSelect={() => {
                  setDomainId(d.domain_id);
                  load(d.domain_id, source);
                }}
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Maturity radar (spider web)">
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Six Gartner-aligned capability pillars scored 1–5. Solid fill = selected domain;
                dashed outline = enterprise average when comparing a single domain.
              </p>
              <MaturityRadarChart axisLabels={axisLabels} series={radarSeries} />
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500/70" />
                  {selected.domain_label}
                </span>
                {selected.domain_id !== "enterprise" && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-slate-400" />
                    Enterprise average
                  </span>
                )}
              </div>
            </Card>

            <Card title="Gartner maturity curve position">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    Level {selected.overall_level}
                  </p>
                  <Badge label={selected.stage.label} />
                </div>
                <p className="max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {selected.stage.description}
                </p>
              </div>
              <MaturityCurveStrip stages={payload.stages} currentLevel={selected.overall_level} />
              <ol className="mt-6 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {payload.stages.map((stage) => (
                  <li
                    key={stage.key}
                    className={`rounded-lg px-3 py-2 text-xs ${
                      selected.stage.level === stage.level
                        ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100"
                        : "text-slate-500"
                    }`}
                  >
                    <span className="font-semibold">
                      {stage.level}. {stage.label}
                    </span>
                    {" — "}
                    {stage.description}
                  </li>
                ))}
              </ol>
              <MaturityExecutiveSummary
                domainId={domainId}
                source={source}
                selected={selected}
              />
            </Card>
          </div>

          <Card className="mt-6" title="Capability breakdown">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {selected.dimensions.map((dim) => (
                <div
                  key={dim.key}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {dim.label}
                    </p>
                    <span className="shrink-0 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      L{dim.level}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${dim.score}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {dim.detail}
                  </p>
                  {dim.principle_scores && dim.principle_scores.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-700">
                      {dim.principle_scores.map((p) => (
                        <li key={p.id} className="flex justify-between text-[10px] text-slate-500">
                          <span>{p.name}</span>
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            {p.score}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {payload.domains.length > 1 && (
            <Card className="mt-6" title="Compare domains">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-800">
                      <th className="pb-2 pr-4 font-medium">Domain</th>
                      <th className="pb-2 pr-4 font-medium">Level</th>
                      <th className="pb-2 pr-4 font-medium">Stage</th>
                      <th className="pb-2 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[payload.enterprise, ...payload.domains.filter((d) => d.domain_id !== "enterprise")].map(
                      (d) => (
                        <tr
                          key={d.domain_id}
                          className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                        >
                          <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200">
                            {d.domain_label}
                          </td>
                          <td className="py-2.5 pr-4">{d.overall_level}</td>
                          <td className="py-2.5 pr-4">
                            <Badge label={d.stage.label} />
                          </td>
                          <td className="py-2.5">{d.overall_score}%</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <AdminSection
            title="Administration — maturity configuration"
            description="Principles, Collibra sync, pillar weights, and domain labels."
            open={showAdmin}
            onOpenChange={setShowAdmin}
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-100">
                <p>
                  <strong>Local catalog</strong> radar axes use governing principles from the{" "}
                  <Link to="/governance/principles" className="font-medium underline">
                    Principles tab
                  </Link>
                  . Collibra and Blended tabs use Collibra asset signals (principles apply only where
                  local fields are linked to Collibra assets).
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {!usesOfflineData && (
                  <Button variant="secondary" onClick={handleRecompute} disabled={syncing || loading}>
                    <RefreshCw className="h-4 w-4" /> Recompute from principles
                  </Button>
                )}
                {collibraAvailable && !usesOfflineData && (
                  <Button variant="secondary" onClick={handleSyncCollibra} disabled={syncing || loading}>
                    <CloudDownload className="h-4 w-4" /> Sync Collibra assets
                  </Button>
                )}
              </div>
            </div>

            {configDraft && payload && (
              <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                    Principle → radar axis map
                  </p>
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {(payload.dimension_catalog ?? []).map((dim) => {
                      const ids =
                        payload.axis_principle_map?.[dim.key] ??
                        configDraft.axis_principle_map?.[dim.key] ??
                        [];
                      const names = ids.map(
                        (id) =>
                          payload.governing_principles?.find((p) => p.id === id)?.name ?? id,
                      );
                      return (
                        <div
                          key={dim.key}
                          className="rounded border border-slate-100 px-2 py-1.5 dark:border-slate-700"
                        >
                          <span className="font-medium">{dim.label}</span>
                          <span className="text-slate-400"> ← </span>
                          {names.length > 0 ? names.join(", ") : "catalog signals (lineage)"}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Axis weights</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {payload.dimension_catalog.map((dim) => (
                      <label key={dim.key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">{dim.label}</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={configDraft.dimension_weights[dim.key] ?? 15}
                          disabled={usesOfflineData}
                          onChange={(e) =>
                            setConfigDraft({
                              ...configDraft,
                              dimension_weights: {
                                ...configDraft.dimension_weights,
                                [dim.key]: Number(e.target.value),
                              },
                            })
                          }
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Domain labels</p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {Object.entries(configDraft.domain_labels).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-full border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-700"
                      >
                        {k} → {v}
                      </span>
                    ))}
                  </div>
                  {!usesOfflineData && (
                    <div className="flex flex-wrap items-end gap-2">
                      <input
                        placeholder="domain_id e.g. customer_db"
                        value={labelKey}
                        onChange={(e) => setLabelKey(e.target.value)}
                        className="rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                      />
                      <input
                        placeholder="Display label"
                        value={labelValue}
                        onChange={(e) => setLabelValue(e.target.value)}
                        className="rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                      />
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (!labelKey.trim()) return;
                          setConfigDraft({
                            ...configDraft,
                            domain_labels: {
                              ...configDraft.domain_labels,
                              [labelKey.trim()]: labelValue.trim() || labelKey.trim(),
                            },
                          });
                          setLabelKey("");
                          setLabelValue("");
                        }}
                      >
                        Add label
                      </Button>
                    </div>
                  )}
                </div>
                <label className="block text-sm text-slate-600 dark:text-slate-300">
                  Collibra max assets per sync
                  <input
                    type="number"
                    min={100}
                    max={10000}
                    value={configDraft.collibra_max_assets}
                    disabled={usesOfflineData}
                    onChange={(e) =>
                      setConfigDraft({
                        ...configDraft,
                        collibra_max_assets: Number(e.target.value),
                      })
                    }
                    className="ml-2 w-24 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
                  />
                </label>
                {!usesOfflineData && (
                  <Button onClick={saveConfig} disabled={syncing}>
                    Save configuration
                  </Button>
                )}
              </div>
            )}
          </AdminSection>
        </>
      )}
    </div>
  );
}
