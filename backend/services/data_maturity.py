"""Data maturity assessment by domain — Gartner D&A maturity curve alignment."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from db.models import FieldDefinition, LineageEdge, LineageNode, QualityRule, StewardAssignment, TrustScore
from services.governance_principles import compute_domain_principle_scores, load_principles
from services.maturity_config import (
    domain_label,
    load_maturity_config,
    resolve_effective_axis_map,
    weighted_overall,
)

# Gartner Data & Analytics maturity stages (curve progression)
GARTNER_STAGES: list[dict[str, str]] = [
    {
        "level": 1,
        "key": "unaware",
        "label": "Unaware",
        "description": "Ad hoc data practices; limited awareness of data as an asset.",
    },
    {
        "level": 2,
        "key": "reactive",
        "label": "Reactive",
        "description": "Issue-driven fixes; inconsistent stewardship and quality controls.",
    },
    {
        "level": 3,
        "key": "proactive",
        "label": "Proactive",
        "description": "Intentional capabilities; emerging governance and metadata discipline.",
    },
    {
        "level": 4,
        "key": "managed",
        "label": "Managed",
        "description": "Measured, governed processes with steward accountability.",
    },
    {
        "level": 5,
        "key": "strategic",
        "label": "Strategic",
        "description": "Data treated as a strategic asset; trusted for enterprise decisions.",
    },
]

MATURITY_DIMENSIONS: list[dict[str, str]] = [
    {
        "key": "governance_stewardship",
        "label": "Governance & stewardship",
        "description": "Steward approvals, ownership assignments, and accountable roles.",
    },
    {
        "key": "metadata_definitions",
        "label": "Metadata & definitions",
        "description": "Approved business definitions and glossary linkage.",
    },
    {
        "key": "data_quality",
        "label": "Data quality",
        "description": "Steward-validated DQ rule specifications.",
    },
    {
        "key": "lineage_traceability",
        "label": "Lineage & traceability",
        "description": "Documented flows from source columns to downstream use.",
    },
    {
        "key": "security_classification",
        "label": "Security & classification",
        "description": "Sensitivity labels and policy citations on governed fields.",
    },
    {
        "key": "operational_readiness",
        "label": "Operational readiness",
        "description": "Composite governance readiness posture for the domain.",
    },
]

DEFAULT_DOMAIN_LABELS: dict[str, str] = {
    "customer_db": "Customer",
    "finance_db": "Finance",
    "hr_db": "Human Resources",
    "clinical_ehr": "Clinical EHR",
    "behavioral_health": "Behavioral Health",
    "claims_payer": "Claims & Payer",
}


def _pct(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        return 0
    return round(100 * numerator / denominator)


def _score_to_level(score: int) -> float:
    """Map 0–100 capability score to Gartner level 1.0–5.0."""
    return round(1 + (score / 100) * 4, 1)


def _level_to_stage(level: float) -> dict[str, Any]:
    clamped = max(1.0, min(5.0, level))
    index = min(int(clamped) - 1, len(GARTNER_STAGES) - 1)
    stage = GARTNER_STAGES[index]
    return {**stage, "computed_level": clamped}


def _score_governance(
    definitions: list[FieldDefinition],
    stewards: list[StewardAssignment],
) -> tuple[int, str]:
    if not definitions:
        return 0, "No catalogued columns in this domain."
    approved = sum(1 for d in definitions if d.approval_status == "approved")
    steward_map = {
        f"{s.database_name}|{s.table_name}|{s.column_name}": s for s in stewards
    }
    owned = sum(
        1
        for d in definitions
        if steward_map.get(f"{d.database_name}|{d.table_name}|{d.column_name}", None)
        and steward_map[f"{d.database_name}|{d.table_name}|{d.column_name}"].data_steward.strip()
    )
    approval_score = _pct(approved, len(definitions))
    ownership_score = _pct(owned, len(definitions))
    score = round((approval_score + ownership_score) / 2)
    return (
        score,
        f"{approved}/{len(definitions)} steward-approved; {owned}/{len(definitions)} with assigned data steward.",
    )


def _score_metadata(definitions: list[FieldDefinition]) -> tuple[int, str]:
    if not definitions:
        return 0, "No catalogued columns in this domain."
    defined = sum(
        1
        for d in definitions
        if d.approval_status == "approved" and d.definition.strip()
    )
    glossary = sum(1 for d in definitions if d.glossary_term.strip())
    def_score = _pct(defined, len(definitions))
    gloss_score = _pct(glossary, len(definitions))
    score = round((def_score + gloss_score) / 2)
    return (
        score,
        f"{defined}/{len(definitions)} with approved definitions; {glossary}/{len(definitions)} glossary-linked.",
    )


def _score_quality(rules: list[QualityRule]) -> tuple[int, str]:
    if not rules:
        return 0, "No DQ rules suggested for this domain yet."
    weights = {"Passed": 100, "Warning": 70, "Failed": 0, "Suggested": 25}
    total = sum(weights.get(r.status, 0) for r in rules)
    score = round(total / len(rules))
    passed = sum(1 for r in rules if r.status == "Passed")
    return score, f"{passed}/{len(rules)} DQ rules marked Passed ({score}% stewardship score)."


def _score_lineage(
    session: Session,
    database_name: str,
    definitions: list[FieldDefinition],
) -> tuple[int, str]:
    if not definitions:
        return 0, "No catalogued columns to trace."
    nodes = (
        session.query(LineageNode)
        .filter_by(database_name=database_name)
        .filter(LineageNode.node_type == "column")
        .count()
    )
    tables = len({d.table_name for d in definitions})
    column_coverage = _pct(nodes, len(definitions))
    edges = session.query(LineageEdge).count()
    has_policy_edges = edges > tables * 2
    score = column_coverage
    if has_policy_edges:
        score = min(100, score + 15)
    return (
        score,
        f"{nodes}/{len(definitions)} columns in lineage graph"
        + ("; cross-system policy stitches detected." if has_policy_edges else "."),
    )


def _score_security(definitions: list[FieldDefinition]) -> tuple[int, str]:
    if not definitions:
        return 0, "No catalogued columns in this domain."
    classified = sum(1 for d in definitions if d.data_classification.strip())
    cited = sum(1 for d in definitions if d.policy_citations)
    class_score = _pct(classified, len(definitions))
    cite_score = _pct(cited, len(definitions))
    score = round((class_score * 0.6) + (cite_score * 0.4))
    return (
        score,
        f"{classified}/{len(definitions)} classified; {cited}/{len(definitions)} with policy citations.",
    )


def _score_operational(trust_rows: list[TrustScore]) -> tuple[int, str]:
    if not trust_rows:
        return 0, "No readiness scores computed for tables in this domain."
    avg = round(sum(r.overall_score for r in trust_rows) / len(trust_rows))
    ready = sum(1 for r in trust_rows if r.status == "Ready")
    return (
        avg,
        f"Average governance readiness {avg}% across {len(trust_rows)} table(s); {ready} at Ready status.",
    )


def _aggregate_principle_scores(
    domains: list[dict[str, Any]],
    axis_key: str,
) -> list[dict[str, Any]]:
    """Average per-principle scores across domains for enterprise breakdown."""
    by_pid: dict[str, dict[str, Any]] = {}
    for dom in domains:
        dim = next((d for d in dom["dimensions"] if d["key"] == axis_key), None)
        if not dim:
            continue
        for p in dim.get("principle_scores") or []:
            pid = str(p.get("id", ""))
            if not pid:
                continue
            if pid not in by_pid:
                by_pid[pid] = {
                    "id": pid,
                    "name": p.get("name", pid),
                    "rule_type": p.get("rule_type", ""),
                    "weight": p.get("weight", 25),
                    "scores": [],
                }
            by_pid[pid]["scores"].append(int(p.get("score", 0)))

    aggregated: list[dict[str, Any]] = []
    for entry in sorted(by_pid.values(), key=lambda item: str(item.get("name", ""))):
        scores = entry.pop("scores")
        avg = round(sum(scores) / len(scores)) if scores else 0
        aggregated.append(
            {
                **entry,
                "score": avg,
                "detail": f"Enterprise average across {len(scores)} domain(s).",
            }
        )
    return aggregated


def _compute_domain_maturity(
    session: Session,
    database_name: str,
    config: dict[str, Any],
    *,
    definitions: list[FieldDefinition] | None = None,
    rules: list[QualityRule] | None = None,
    stewards: list[StewardAssignment] | None = None,
    trust_rows: list[TrustScore] | None = None,
) -> dict[str, Any]:
    definitions = definitions or (
        session.query(FieldDefinition).filter_by(database_name=database_name).all()
    )
    rules = rules or (
        session.query(QualityRule).filter_by(database_name=database_name).all()
    )
    stewards = stewards or (
        session.query(StewardAssignment).filter_by(database_name=database_name).all()
    )
    trust_rows = trust_rows or (
        session.query(TrustScore).filter_by(database_name=database_name).all()
    )

    principles = [p for p in load_principles(session) if p.get("enabled", True)]
    principle_scores = compute_domain_principle_scores(
        session,
        database_name,
        definitions=definitions,
        rules=rules,
        stewards=stewards,
    )
    axis_map = resolve_effective_axis_map(config, principles)

    legacy_scorers = {
        "governance_stewardship": lambda: _score_governance(definitions, stewards),
        "metadata_definitions": lambda: _score_metadata(definitions),
        "data_quality": lambda: _score_quality(rules),
        "lineage_traceability": lambda: _score_lineage(session, database_name, definitions),
        "security_classification": lambda: _score_security(definitions),
        "operational_readiness": lambda: _score_operational(trust_rows),
    }

    weights = config.get("dimension_weights") or {}
    dimensions: list[dict[str, Any]] = []
    for dim in MATURITY_DIMENSIONS:
        key = dim["key"]
        mapped_ids = axis_map.get(key, [])
        mapped = [principle_scores[pid] for pid in mapped_ids if pid in principle_scores]

        if mapped:
            total_w = sum(p["weight"] for p in mapped)
            score = round(sum(p["score"] * p["weight"] for p in mapped) / total_w) if total_w else 0
            names = ", ".join(p["name"] for p in mapped)
            detail = (
                f"From governing principles: {names}. "
                + "; ".join(f"{p['name']} {p['score']}%" for p in mapped)
            )
            principle_breakdown = mapped
        else:
            score, detail = legacy_scorers[key]()
            principle_breakdown = []
            detail = f"{detail} (no principles mapped — using catalog signals.)"

        level = _score_to_level(score)
        dimensions.append(
            {
                **dim,
                "score": score,
                "level": level,
                "weight": weights.get(key, round(100 / len(MATURITY_DIMENSIONS))),
                "detail": detail,
                "principle_scores": principle_breakdown,
                "principle_ids": mapped_ids,
            }
        )

    overall_level, overall_score = weighted_overall(dimensions, weights)
    stage = _level_to_stage(overall_level)
    labels = {**DEFAULT_DOMAIN_LABELS, **(config.get("domain_labels") or {})}

    return {
        "domain_id": database_name,
        "domain_label": labels.get(database_name) or domain_label(config, database_name),
        "overall_level": overall_level,
        "overall_score": overall_score,
        "stage": stage,
        "dimensions": dimensions,
        "stats": {
            "columns": len(definitions),
            "tables": len({d.table_name for d in definitions}),
            "dq_rules": len(rules),
            "trust_tables": len(trust_rows),
            "source": "local",
        },
    }


def get_data_maturity(
    session: Session,
    *,
    domain_id: str | None = None,
    source: str = "local",
) -> dict[str, Any]:
    """Return maturity radar data for one domain or the full portfolio."""
    from services.collibra_integration import _is_configured
    from services.collibra_maturity import blend_maturity, get_collibra_maturity

    config = load_maturity_config(session)
    weights = config.get("dimension_weights") or {}

    if source == "collibra":
        payload = get_collibra_maturity(session, domain_id=domain_id)
        payload["config"] = config
        return payload

    database_names = [
        row[0]
        for row in session.query(FieldDefinition.database_name).distinct().order_by(FieldDefinition.database_name)
    ]

    domains = [_compute_domain_maturity(session, db, config) for db in database_names]

    if not domains and domain_id and domain_id != "enterprise":
        domains = [_compute_domain_maturity(session, domain_id, config)]

    enterprise_dimensions: list[dict[str, Any]] = []
    axis_map = resolve_effective_axis_map(config, load_principles(session))
    if domains:
        for dim in MATURITY_DIMENSIONS:
            key = dim["key"]
            scores = [d for dom in domains for d in dom["dimensions"] if d["key"] == key]
            avg_score = round(sum(s["score"] for s in scores) / len(scores)) if scores else 0
            avg_level = round(sum(s["level"] for s in scores) / len(scores), 1) if scores else 1.0
            principle_breakdown = _aggregate_principle_scores(domains, key)
            names = ", ".join(p["name"] for p in principle_breakdown)
            detail = (
                f"Enterprise average across {len(domains)} local data domain(s)."
                + (f" Principles: {names}." if names else "")
            )
            enterprise_dimensions.append(
                {
                    **dim,
                    "score": avg_score,
                    "level": avg_level,
                    "weight": weights.get(key, round(100 / len(MATURITY_DIMENSIONS))),
                    "detail": detail,
                    "principle_scores": principle_breakdown,
                    "principle_ids": axis_map.get(key, []),
                }
            )
        ent_level, ent_score = weighted_overall(enterprise_dimensions, weights)
    else:
        ent_level, ent_score = 1.0, 0
        enterprise_dimensions = [
            {**dim, "score": 0, "level": 1.0, "detail": "Analyze and persist metadata to begin maturity assessment."}
            for dim in MATURITY_DIMENSIONS
        ]

    enterprise = {
        "domain_id": "enterprise",
        "domain_label": "Enterprise",
        "overall_level": ent_level,
        "overall_score": ent_score,
        "stage": _level_to_stage(ent_level),
        "dimensions": enterprise_dimensions,
        "stats": {
            "domains": len(domains),
            "columns": sum(d["stats"]["columns"] for d in domains),
            "tables": sum(d["stats"]["tables"] for d in domains),
            "source": "local",
        },
    }

    selected = enterprise
    if domain_id:
        match = next((d for d in domains if d["domain_id"] == domain_id), None)
        if match:
            selected = match
        elif domain_id != "enterprise":
            selected = _compute_domain_maturity(session, domain_id, config)

    local_payload = {
        "framework": "gartner_data_analytics_maturity",
        "source": "local",
        "stages": GARTNER_STAGES,
        "dimension_catalog": MATURITY_DIMENSIONS,
        "config": config,
        "principles_drive_maturity": True,
        "governing_principles": load_principles(session),
        "axis_principle_map": resolve_effective_axis_map(config, load_principles(session)),
        "collibra_available": _is_configured(),
        "selected_domain_id": selected["domain_id"],
        "selected": selected,
        "enterprise": enterprise,
        "domains": domains,
    }

    if source == "blended" and _is_configured():
        collibra_payload = get_collibra_maturity(session, domain_id=domain_id)
        if collibra_payload.get("domains"):
            return blend_maturity(local_payload, collibra_payload)

    return local_payload
