"""Configurable domain labels, maturity axis weights, and principle-to-axis mapping."""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any

from sqlalchemy.orm import Session

from config import BACKEND_DIR
from db.models import MaturityConfig

DEFAULT_DIMENSION_KEYS = [
    "governance_stewardship",
    "metadata_definitions",
    "data_quality",
    "lineage_traceability",
    "security_classification",
    "operational_readiness",
]

DEFAULT_WEIGHTS = {key: round(100 / len(DEFAULT_DIMENSION_KEYS)) for key in DEFAULT_DIMENSION_KEYS}

# Default Gartner radar axis ← governing principle id (seed; new principles auto-assign by rule_type)
DEFAULT_AXIS_PRINCIPLE_MAP: dict[str, list[str]] = {
    "governance_stewardship": ["steward-approvals", "ownership-assigned"],
    "metadata_definitions": ["approved-definitions", "glossary-linked"],
    "data_quality": ["dq-rules-stewarded"],
    "lineage_traceability": [],
    "security_classification": ["classification-coverage", "policy-citations"],
    "operational_readiness": ["recent-activity"],
}

RULE_TYPE_DEFAULT_AXIS: dict[str, str] = {
    "approved_definitions": "metadata_definitions",
    "steward_approvals": "governance_stewardship",
    "dq_rule_stewardship": "data_quality",
    "recent_activity": "operational_readiness",
    "classification_coverage": "security_classification",
    "glossary_linked": "metadata_definitions",
    "ownership_assigned": "governance_stewardship",
    "policy_citations": "security_classification",
}

MATURITY_PILLAR_LABELS: dict[str, str] = {
    "governance_stewardship": "Governance & stewardship",
    "metadata_definitions": "Metadata & definitions",
    "data_quality": "Data quality",
    "lineage_traceability": "Lineage & traceability",
    "security_classification": "Security & classification",
    "operational_readiness": "Operational readiness",
}

# Default scorer when the user specifies a maturity pillar explicitly (e.g. "My rule -> Metadata")
AXIS_DEFAULT_RULE_TYPE: dict[str, str] = {
    "governance_stewardship": "steward_approvals",
    "metadata_definitions": "approved_definitions",
    "data_quality": "dq_rule_stewardship",
    "lineage_traceability": "approved_definitions",
    "security_classification": "classification_coverage",
    "operational_readiness": "recent_activity",
}


def maturity_pillar_for_rule_type(rule_type: str) -> dict[str, str | None]:
    """Map a governing-principle scorer type to its Gartner maturity radar pillar."""
    axis = RULE_TYPE_DEFAULT_AXIS.get(rule_type)
    if not axis:
        return {"maturity_axis": None, "maturity_pillar_label": None}
    return {
        "maturity_axis": axis,
        "maturity_pillar_label": MATURITY_PILLAR_LABELS.get(
            axis, axis.replace("_", " ").title()
        ),
    }


def _default_template() -> dict[str, Any]:
    path = BACKEND_DIR / "maturity_config.default.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "domain_labels": {},
        "dimension_weights": DEFAULT_WEIGHTS,
        "axis_principle_map": deepcopy(DEFAULT_AXIS_PRINCIPLE_MAP),
        "collibra_max_assets": 3000,
    }


def _normalize_axis_map(raw: dict[str, Any] | None) -> dict[str, list[str]]:
    base = deepcopy(DEFAULT_AXIS_PRINCIPLE_MAP)
    if not raw:
        return base
    for axis in DEFAULT_DIMENSION_KEYS:
        ids = raw.get(axis)
        if isinstance(ids, list):
            base[axis] = [str(i) for i in ids]
    return base


def load_maturity_config(session: Session) -> dict[str, Any]:
    row = session.get(MaturityConfig, "default")
    if row is None:
        template = _default_template()
        return {
            "domain_labels": template.get("domain_labels", {}),
            "dimension_weights": {**DEFAULT_WEIGHTS, **(template.get("dimension_weights") or {})},
            "axis_principle_map": _normalize_axis_map(template.get("axis_principle_map")),
            "collibra_max_assets": int(template.get("collibra_max_assets", 3000)),
        }
    weights = row.dimension_weights if isinstance(row.dimension_weights, dict) else {}
    axis_map = _normalize_axis_map(row.axis_principle_map if isinstance(row.axis_principle_map, dict) else None)
    return {
        "domain_labels": row.domain_labels if isinstance(row.domain_labels, dict) else {},
        "dimension_weights": {**DEFAULT_WEIGHTS, **weights},
        "axis_principle_map": axis_map,
        "collibra_max_assets": row.collibra_max_assets or 3000,
    }


def ensure_maturity_config(session: Session) -> None:
    row = session.get(MaturityConfig, "default")
    if row is None:
        template = _default_template()
        session.add(
            MaturityConfig(
                id="default",
                domain_labels=template.get("domain_labels", {}),
                dimension_weights=template.get("dimension_weights", DEFAULT_WEIGHTS),
                axis_principle_map=_normalize_axis_map(template.get("axis_principle_map")),
                collibra_max_assets=int(template.get("collibra_max_assets", 3000)),
            )
        )
        session.flush()
        return
    if not row.axis_principle_map:
        template = _default_template()
        row.axis_principle_map = _normalize_axis_map(template.get("axis_principle_map"))
        session.flush()


def update_maturity_config(session: Session, updates: dict[str, Any]) -> dict[str, Any]:
    ensure_maturity_config(session)
    row = session.get(MaturityConfig, "default")
    assert row is not None

    if "domain_labels" in updates and isinstance(updates["domain_labels"], dict):
        row.domain_labels = updates["domain_labels"]
    if "dimension_weights" in updates and isinstance(updates["dimension_weights"], dict):
        merged = {**DEFAULT_WEIGHTS, **row.dimension_weights, **updates["dimension_weights"]}
        row.dimension_weights = {k: max(1, int(v)) for k, v in merged.items() if k in DEFAULT_WEIGHTS}
    if "axis_principle_map" in updates and isinstance(updates["axis_principle_map"], dict):
        row.axis_principle_map = _normalize_axis_map(updates["axis_principle_map"])
    if "collibra_max_assets" in updates:
        row.collibra_max_assets = max(100, min(10000, int(updates["collibra_max_assets"])))
    session.flush()
    return load_maturity_config(session)


def resolve_effective_axis_map(
    config: dict[str, Any],
    principles: list[dict[str, Any]],
) -> dict[str, list[str]]:
    """Merge configured axis map with auto-assignment for enabled principles by rule_type."""
    valid_ids = {str(p.get("id", "")) for p in principles if p.get("id")}
    effective = _normalize_axis_map(config.get("axis_principle_map"))
    for axis in DEFAULT_DIMENSION_KEYS:
        effective[axis] = [pid for pid in effective.get(axis, []) if pid in valid_ids]
    assigned: set[str] = {pid for ids in effective.values() for pid in ids}

    for principle in principles:
        if not principle.get("enabled", True):
            continue
        pid = str(principle.get("id", ""))
        if not pid or pid in assigned:
            continue
        axis = RULE_TYPE_DEFAULT_AXIS.get(str(principle.get("rule_type", "")))
        if axis and pid not in effective[axis]:
            effective[axis].append(pid)
            assigned.add(pid)

    return effective


def assign_principle_to_axis(
    session: Session,
    principle_id: str,
    rule_type: str,
) -> None:
    """Register a new governing principle on the appropriate maturity radar axis."""
    ensure_maturity_config(session)
    row = session.get(MaturityConfig, "default")
    assert row is not None
    axis_map = _normalize_axis_map(row.axis_principle_map if isinstance(row.axis_principle_map, dict) else None)
    already = {pid for ids in axis_map.values() for pid in ids}
    if principle_id in already:
        return
    axis = RULE_TYPE_DEFAULT_AXIS.get(rule_type, "operational_readiness")
    axis_map.setdefault(axis, [])
    if principle_id not in axis_map[axis]:
        axis_map[axis].append(principle_id)
    row.axis_principle_map = axis_map
    session.flush()


def domain_label(config: dict[str, Any], domain_id: str) -> str:
    labels = config.get("domain_labels") or {}
    if domain_id in labels:
        return str(labels[domain_id])
    if domain_id.startswith("collibra:"):
        return domain_id.removeprefix("collibra:").replace("_", " ")
    return domain_id.replace("_", " ").title()


def weighted_overall(dimensions: list[dict[str, Any]], weights: dict[str, int]) -> tuple[float, int]:
    total_weight = 0
    weighted_score = 0
    weighted_level = 0.0
    for dim in dimensions:
        key = dim["key"]
        w = max(1, int(weights.get(key, round(100 / max(len(dimensions), 1)))))
        total_weight += w
        weighted_score += dim["score"] * w
        weighted_level += dim["level"] * w
    if total_weight == 0:
        return 1.0, 0
    return round(weighted_level / total_weight, 1), round(weighted_score / total_weight)
