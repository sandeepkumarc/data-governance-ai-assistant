import type { DataMaturityDomain, DataMaturityPayload } from "../types";

const STAGE_LABELS = ["Unaware", "Reactive", "Proactive", "Managed", "Strategic"];

function nextStageLabel(level: number): string {
  const clamped = Math.max(1, Math.min(5, level));
  const idx = Math.min(Math.ceil(clamped), 5) - 1;
  return STAGE_LABELS[Math.min(idx + 1, STAGE_LABELS.length - 1)] ?? "Strategic";
}

function formatPillar(dim: DataMaturityDomain["dimensions"][0]): string {
  return `${dim.label} (Level ${dim.level}, ${dim.score}%)`;
}

export function buildMaturityExecutiveSummary(
  selected: DataMaturityDomain,
  enterprise: DataMaturityDomain,
  source: DataMaturityPayload["source"] = "local",
) {
  const dims = [...(selected.dimensions ?? [])];
  if (!dims.length) {
    return {
      domain_id: selected.domain_id,
      domain_label: selected.domain_label,
      source: source ?? "local",
      summary: `${selected.domain_label} has no maturity assessment yet. Analyze metadata and refresh.`,
      heuristic_summary: "",
      used_llm: false,
      strongest: [],
      weakest: [],
      stage: selected.stage,
      overall_level: selected.overall_level,
      overall_score: selected.overall_score,
    };
  }

  const sorted = [...dims].sort((a, b) => a.level - b.level || a.score - b.score);
  const weakest = sorted.slice(0, 2);
  const strongest = sorted.slice(-2).reverse();

  const sourceNote =
    source === "collibra"
      ? "Collibra DGC asset signals"
      : source === "blended"
        ? "blended local catalog and Collibra assets"
        : "local catalog and governing principles";

  const stageLabel = selected.stage?.label ?? "Unaware";
  const parts = [
    `${selected.domain_label} sits at Gartner maturity Level ${selected.overall_level} (${stageLabel}), with an overall capability score of ${selected.overall_score}% based on ${sourceNote}.`,
    `Strongest pillars: ${formatPillar(strongest[0])}${strongest[1] ? ` and ${formatPillar(strongest[1])}` : ""}.`,
    `Primary gaps: ${formatPillar(weakest[0])}${weakest[1] ? ` and ${formatPillar(weakest[1])}` : ""}.`,
  ];

  if (selected.domain_id !== "enterprise" && enterprise) {
    const delta = selected.overall_level - enterprise.overall_level;
    const compare =
      Math.abs(delta) < 0.15 ? "in line with" : delta > 0 ? "ahead of" : "behind";
    parts.push(
      `Compared with the enterprise average (Level ${enterprise.overall_level}, ${enterprise.overall_score}%), this domain is ${compare} the portfolio.`,
    );
  }

  parts.push(
    `Executive recommendation: prioritize ${weakest[0]?.label ?? "governance gaps"} to progress toward ${nextStageLabel(selected.overall_level)} maturity.`,
  );

  const summary = parts.join(" ");

  return {
    domain_id: selected.domain_id,
    domain_label: selected.domain_label,
    source: source ?? "local",
    summary,
    heuristic_summary: summary,
    used_llm: false,
    strongest: strongest.map((d) => ({
      key: d.key,
      label: d.label,
      level: d.level,
      score: d.score,
    })),
    weakest: weakest.map((d) => ({
      key: d.key,
      label: d.label,
      level: d.level,
      score: d.score,
    })),
    stage: selected.stage,
    overall_level: selected.overall_level,
    overall_score: selected.overall_score,
  };
}
