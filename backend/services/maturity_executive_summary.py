"""Natural-language executive summaries for domain maturity on the Gartner curve."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from rag_governance import call_ollama
from services.data_maturity import GARTNER_STAGES, get_data_maturity


def _next_stage_label(current_level: float) -> str:
    clamped = max(1.0, min(5.0, current_level))
    next_level = min(5, int(clamped) + 1)
    return GARTNER_STAGES[next_level - 1]["label"]


def _format_pillar(dim: dict[str, Any]) -> str:
    return f"{dim['label']} (Level {dim['level']}, {dim['score']}%)"


def build_heuristic_executive_summary(
    selected: dict[str, Any],
    enterprise: dict[str, Any],
    *,
    source: str = "local",
) -> str:
    """Plain-English executive brief from maturity scores — no LLM required."""
    dims = list(selected.get("dimensions") or [])
    if not dims:
        return (
            f"{selected.get('domain_label', 'This domain')} has no maturity assessment yet. "
            "Analyze and persist metadata, configure governing principles, then refresh."
        )

    sorted_dims = sorted(dims, key=lambda d: (d.get("level", 0), d.get("score", 0)))
    weakest = sorted_dims[:2]
    strongest = list(reversed(sorted_dims[-2:]))

    source_note = {
        "local": "local catalog and governing principles",
        "collibra": "Collibra DGC asset signals",
        "blended": "blended local catalog and Collibra assets",
    }.get(source, "configured maturity inputs")

    label = str(selected.get("domain_label", selected.get("domain_id", "Domain")))
    level = selected.get("overall_level", 1)
    score = selected.get("overall_score", 0)
    stage = selected.get("stage") or {}
    stage_label = stage.get("label", "Unaware")
    next_stage = _next_stage_label(float(level))

    parts = [
        f"{label} sits at Gartner maturity Level {level} ({stage_label}), "
        f"with an overall capability score of {score}% based on {source_note}.",
        f"Strongest pillars: {_format_pillar(strongest[0])}"
        + (f" and {_format_pillar(strongest[1])}" if len(strongest) > 1 else "")
        + ".",
        f"Primary gaps: {_format_pillar(weakest[0])}"
        + (f" and {_format_pillar(weakest[1])}" if len(weakest) > 1 else "")
        + ".",
    ]

    if selected.get("domain_id") != "enterprise" and enterprise:
        ent_level = enterprise.get("overall_level", level)
        ent_score = enterprise.get("overall_score", score)
        delta = float(level) - float(ent_level)
        if abs(delta) < 0.15:
            compare = "in line with"
        elif delta > 0:
            compare = "ahead of"
        else:
            compare = "behind"
        parts.append(
            f"Compared with the enterprise average (Level {ent_level}, {ent_score}%), "
            f"this domain is {compare} the portfolio."
        )

    focus = weakest[0].get("label", "weakest capability")
    parts.append(
        f"Executive recommendation: prioritize {focus} and related steward workflows "
        f"to progress toward {next_stage} maturity."
    )

    return " ".join(parts)


def _llm_executive_summary(
    heuristic: str,
    selected: dict[str, Any],
    *,
    model: str,
    base_url: str,
) -> str:
    dims = selected.get("dimensions") or []
    pillar_lines = "\n".join(
        f"- {d.get('label')}: level {d.get('level')}, score {d.get('score')}% — {d.get('detail', '')[:120]}"
        for d in dims
    )
    prompt = f"""You are a chief data officer advisor. Rewrite the maturity assessment below as a concise executive summary (3–5 sentences, plain English, no markdown headings).

Domain: {selected.get('domain_label')}
Stage: {selected.get('stage', {}).get('label')} (level {selected.get('overall_level')})
Overall score: {selected.get('overall_score')}%

Pillar scores:
{pillar_lines}

Draft to refine:
{heuristic}

Write for a business audience. Mention strongest and weakest areas and one clear next step."""

    response = call_ollama(prompt, model=model, base_url=base_url)
    text = response.strip()
    return text if text else heuristic


def get_maturity_executive_summary(
    session: Session,
    *,
    domain_id: str | None = None,
    source: str = "local",
    no_llm: bool = True,
    model: str = "gemma4:e2b",
    base_url: str = "http://localhost:11434",
) -> dict[str, Any]:
    payload = get_data_maturity(session, domain_id=domain_id, source=source)
    selected = payload["selected"]
    enterprise = payload.get("enterprise") or {}
    dims = list(selected.get("dimensions") or [])
    sorted_dims = sorted(dims, key=lambda d: (d.get("level", 0), d.get("score", 0)))

    heuristic = build_heuristic_executive_summary(selected, enterprise, source=source)
    summary = heuristic
    used_llm = False

    if not no_llm:
        try:
            summary = _llm_executive_summary(heuristic, selected, model=model, base_url=base_url)
            used_llm = True
        except Exception:
            summary = heuristic

    return {
        "domain_id": selected.get("domain_id"),
        "domain_label": selected.get("domain_label"),
        "source": source,
        "summary": summary,
        "heuristic_summary": heuristic,
        "used_llm": used_llm,
        "strongest": [
            {"key": d["key"], "label": d["label"], "level": d["level"], "score": d["score"]}
            for d in reversed(sorted_dims[-2:])
        ],
        "weakest": [
            {"key": d["key"], "label": d["label"], "level": d["level"], "score": d["score"]}
            for d in sorted_dims[:2]
        ],
        "stage": selected.get("stage"),
        "overall_level": selected.get("overall_level"),
        "overall_score": selected.get("overall_score"),
    }
