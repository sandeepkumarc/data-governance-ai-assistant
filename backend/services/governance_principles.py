"""Governance readiness principles — storage, scoring engine, and recompute."""

from __future__ import annotations

import json
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from config import BACKEND_DIR, GOVERNANCE_PRINCIPLES_PATH
from db.models import (
    FieldDefinition,
    GovernancePrinciple,
    GovernanceReadinessConfig,
    QualityRule,
    StewardAssignment,
    TrustScore,
)

DEFAULT_READINESS_NOTE = (
    "Scores reflect your governing principles and steward workflow in this assistant — "
    "not statistical data quality or warehouse profiling."
)

DEFAULT_THRESHOLDS = {"ready": 75, "in_progress": 40}

RULE_TYPE_CATALOG: list[dict[str, Any]] = [
    {
        "rule_type": "approved_definitions",
        "label": "Approved definitions",
        "description": "Share of columns with steward-approved, non-empty definitions.",
        "default_config": {"require_non_empty_definition": True},
    },
    {
        "rule_type": "steward_approvals",
        "label": "Steward approvals",
        "description": "Share of columns with approval_status = approved.",
        "default_config": {},
    },
    {
        "rule_type": "dq_rule_stewardship",
        "label": "DQ rule stewardship",
        "description": "Weighted score from DQ rule statuses (Passed, Warning, etc.).",
        "default_config": {
            "status_weights": {"Passed": 100, "Warning": 70, "Failed": 0, "Suggested": 25}
        },
    },
    {
        "rule_type": "recent_activity",
        "label": "Recent steward activity",
        "description": "Share of approved definitions updated within a time window.",
        "default_config": {"window_days": 7},
    },
    {
        "rule_type": "classification_coverage",
        "label": "Sensitive data classified",
        "description": "Sensitive-looking columns have an assigned classification.",
        "default_config": {
            "sensitivity_keywords": ["pii", "confidential", "restricted", "personal", "hipaa", "gdpr"],
            "required_classifications": ["PII", "Confidential", "Restricted", "Internal"],
        },
    },
    {
        "rule_type": "glossary_linked",
        "label": "Glossary terms linked",
        "description": "Share of columns linked to a business glossary term.",
        "default_config": {},
    },
    {
        "rule_type": "ownership_assigned",
        "label": "Ownership assigned",
        "description": "Share of columns with a data steward assigned.",
        "default_config": {},
    },
    {
        "rule_type": "policy_citations",
        "label": "Policy citations present",
        "description": "Approved definitions cite governing policy sections.",
        "default_config": {},
    },
]


def _default_template() -> dict[str, Any]:
    template = BACKEND_DIR / "governance_principles.default.json"
    if template.exists():
        return json.loads(template.read_text(encoding="utf-8"))
    return {
        "readiness_note": DEFAULT_READINESS_NOTE,
        "thresholds": DEFAULT_THRESHOLDS,
        "principles": [],
    }


def _import_json_if_present() -> dict[str, Any] | None:
    if GOVERNANCE_PRINCIPLES_PATH.exists():
        return json.loads(GOVERNANCE_PRINCIPLES_PATH.read_text(encoding="utf-8"))
    return None


def principle_to_dict(row: GovernancePrinciple) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "rule_type": row.rule_type,
        "enabled": row.enabled,
        "weight": row.weight,
        "config": row.config or {},
        "source": row.source,
        "nl_instruction": row.nl_instruction,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def load_readiness_config(session: Session) -> dict[str, Any]:
    row = session.get(GovernanceReadinessConfig, "default")
    if row is None:
        template = _default_template()
        return {
            "readiness_note": template.get("readiness_note", DEFAULT_READINESS_NOTE),
            "thresholds": template.get("thresholds", DEFAULT_THRESHOLDS),
        }
    thresholds = row.thresholds if isinstance(row.thresholds, dict) else DEFAULT_THRESHOLDS
    return {
        "readiness_note": row.readiness_note or DEFAULT_READINESS_NOTE,
        "thresholds": {**DEFAULT_THRESHOLDS, **thresholds},
    }


def load_principles(session: Session) -> list[dict[str, Any]]:
    rows = session.query(GovernancePrinciple).order_by(GovernancePrinciple.name).all()
    return [principle_to_dict(row) for row in rows]


def load_principles_bundle(session: Session) -> dict[str, Any]:
    from services.maturity_config import load_maturity_config, maturity_pillar_for_rule_type, resolve_effective_axis_map

    config = load_readiness_config(session)
    principles = load_principles(session)
    maturity = load_maturity_config(session)
    return {
        **config,
        "principles": principles,
        "rule_type_catalog": [
            {**entry, **maturity_pillar_for_rule_type(entry["rule_type"])}
            for entry in RULE_TYPE_CATALOG
        ],
        "maturity_axis_map": resolve_effective_axis_map(maturity, principles),
        "maturity_note": "Governing principles drive both table readiness and data maturity radar axes.",
    }


def _persist_config(session: Session, *, readiness_note: str, thresholds: dict[str, Any]) -> None:
    row = session.get(GovernanceReadinessConfig, "default")
    if row is None:
        row = GovernanceReadinessConfig(id="default")
        session.add(row)
    row.readiness_note = readiness_note
    row.thresholds = thresholds
    session.flush()


def _persist_principle_row(
    session: Session,
    principle: dict[str, Any],
    *,
    source: str = "system",
    nl_instruction: str = "",
) -> GovernancePrinciple:
    principle = deepcopy(principle)
    explicit_id = principle.get("id")
    row = session.get(GovernancePrinciple, explicit_id) if explicit_id else None
    if row is None:
        principle_id = explicit_id or f"prin-{uuid.uuid4().hex[:8]}"
        row = GovernancePrinciple(id=principle_id)
        session.add(row)

    row.name = str(principle.get("name", "Untitled principle"))
    row.description = str(principle.get("description", ""))
    row.rule_type = str(principle.get("rule_type", "approved_definitions"))
    row.enabled = bool(principle.get("enabled", True))
    row.weight = int(principle.get("weight", 25))
    row.config = principle.get("config") if isinstance(principle.get("config"), dict) else {}
    if source != "system" or not row.source:
        row.source = source
    if nl_instruction:
        row.nl_instruction = nl_instruction
    session.flush()
    return row


def upsert_principle(
    session: Session,
    principle: dict[str, Any],
    *,
    source: str = "manual",
    nl_instruction: str = "",
) -> dict[str, Any]:
    row = _persist_principle_row(session, principle, source=source, nl_instruction=nl_instruction)
    session.flush()
    saved = principle_to_dict(row)
    from services.maturity_config import assign_principle_to_axis

    assign_principle_to_axis(session, saved["id"], saved["rule_type"])
    return saved


def update_principle(
    session: Session,
    principle_id: str,
    updates: dict[str, Any],
) -> dict[str, Any]:
    row = session.get(GovernancePrinciple, principle_id)
    if row is None:
        raise ValueError(f"Principle not found: {principle_id}")

    if "name" in updates:
        row.name = str(updates["name"])
    if "description" in updates:
        row.description = str(updates["description"])
    if "enabled" in updates:
        row.enabled = bool(updates["enabled"])
    if "weight" in updates:
        row.weight = max(1, int(updates["weight"]))
    if "config" in updates and isinstance(updates["config"], dict):
        row.config = updates["config"]
    session.flush()
    return principle_to_dict(row)


def delete_principle(session: Session, principle_id: str) -> bool:
    row = session.get(GovernancePrinciple, principle_id)
    if row is None:
        return False
    session.delete(row)
    session.flush()
    return True


def update_readiness_config(
    session: Session,
    *,
    readiness_note: str | None = None,
    thresholds: dict[str, Any] | None = None,
) -> dict[str, Any]:
    current = load_readiness_config(session)
    note = readiness_note if readiness_note is not None else current["readiness_note"]
    merged_thresholds = {**current["thresholds"]}
    if thresholds:
        merged_thresholds.update(thresholds)
    _persist_config(session, readiness_note=note, thresholds=merged_thresholds)
    session.flush()
    return load_readiness_config(session)


def ensure_default_principles(session: Session) -> None:
    """Seed principles and config when the database is empty."""
    if session.scalar(select(GovernancePrinciple.id).limit(1)) is not None:
        if session.get(GovernanceReadinessConfig, "default") is None:
            template = _import_json_if_present() or _default_template()
            _persist_config(
                session,
                readiness_note=str(template.get("readiness_note", DEFAULT_READINESS_NOTE)),
                thresholds=template.get("thresholds", DEFAULT_THRESHOLDS),
            )
        return

    imported = _import_json_if_present()
    template = imported or _default_template()
    _persist_config(
        session,
        readiness_note=str(template.get("readiness_note", DEFAULT_READINESS_NOTE)),
        thresholds=template.get("thresholds", DEFAULT_THRESHOLDS),
    )
    for principle in template.get("principles", []):
        _persist_principle_row(session, principle, source="system")
    session.flush()


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _score_approved_definitions(definitions: list[FieldDefinition], config: dict[str, Any]) -> tuple[int, str]:
    if not definitions:
        return 0, "No columns saved yet — analyze and persist metadata first."
    require_text = bool(config.get("require_non_empty_definition", True))
    total = len(definitions)
    if require_text:
        approved = sum(
            1
            for item in definitions
            if item.approval_status == "approved" and item.definition.strip()
        )
        detail = f"{approved}/{total} columns have approved definitions"
    else:
        approved = sum(1 for item in definitions if item.approval_status == "approved")
        detail = f"{approved}/{total} columns are steward-approved"
    score = round(100 * approved / total)
    return score, f"{detail} ({score}%). Draft or pending AI suggestions do not count."


def _score_steward_approvals(definitions: list[FieldDefinition], _config: dict[str, Any]) -> tuple[int, str]:
    if not definitions:
        return 0, "No columns saved yet."
    total = len(definitions)
    approved = sum(1 for item in definitions if item.approval_status == "approved")
    score = round(100 * approved / total)
    return score, f"{approved}/{total} columns steward-approved ({score}%). Pending review earns no credit."


def _score_dq_rule_stewardship(rules: list[QualityRule], config: dict[str, Any]) -> tuple[int, str]:
    if not rules:
        return 0, "No DQ rules suggested yet — persist definitions to generate rule candidates."
    weights = config.get("status_weights") or {
        "Passed": 100,
        "Warning": 70,
        "Failed": 0,
        "Suggested": 25,
    }
    total_weight = sum(weights.get(rule.status, 0) for rule in rules)
    score = round(total_weight / len(rules))
    passed = sum(1 for rule in rules if rule.status == "Passed")
    suggested = sum(1 for rule in rules if rule.status == "Suggested")
    return (
        score,
        f"{len(rules)} DQ rule(s); {passed} Passed, {suggested} still Suggested ({score}%). "
        "Scores rise when stewards validate rules for your external DQ platform.",
    )


def _score_recent_activity(definitions: list[FieldDefinition], config: dict[str, Any]) -> tuple[int, str]:
    window_days = int(config.get("window_days", 7))
    if not definitions:
        return 0, "No columns saved yet."
    approved = [item for item in definitions if item.approval_status == "approved"]
    if not approved:
        return 0, "No approved definitions yet — steward approvals unlock this dimension."
    now = datetime.now(timezone.utc)
    recent = 0
    for item in approved:
        updated = item.updated_at or item.created_at
        if updated and (now - _ensure_utc(updated)).days <= window_days:
            recent += 1
    score = round(100 * recent / len(approved))
    return (
        score,
        f"{score}% of approved definitions updated in the last {window_days} day(s). "
        "Unapproved columns do not affect this principle.",
    )


def _looks_sensitive(defn: FieldDefinition, keywords: list[str]) -> bool:
    haystack = " ".join(
        [
            defn.column_name,
            defn.data_classification,
            defn.sensitivity,
            defn.likely_purpose,
            " ".join(defn.regulatory_tags or []),
        ]
    ).lower()
    return any(kw.lower() in haystack for kw in keywords)


def _score_classification_coverage(definitions: list[FieldDefinition], config: dict[str, Any]) -> tuple[int, str]:
    keywords = config.get("sensitivity_keywords") or ["pii", "confidential", "restricted"]
    required = {c.lower() for c in (config.get("required_classifications") or [])}
    if not definitions:
        return 0, "No columns saved yet."
    sensitive = [d for d in definitions if _looks_sensitive(d, keywords)]
    if not sensitive:
        return 100, "No sensitive-looking columns detected — principle satisfied by default."
    classified = [
        d
        for d in sensitive
        if d.data_classification.strip()
        and (not required or d.data_classification.strip().lower() in required)
    ]
    score = round(100 * len(classified) / len(sensitive))
    return (
        score,
        f"{len(classified)}/{len(sensitive)} sensitive columns have classification assigned ({score}%).",
    )


def _score_glossary_linked(definitions: list[FieldDefinition], _config: dict[str, Any]) -> tuple[int, str]:
    if not definitions:
        return 0, "No columns saved yet."
    linked = sum(1 for item in definitions if item.glossary_term.strip())
    score = round(100 * linked / len(definitions))
    return score, f"{linked}/{len(definitions)} columns linked to glossary terms ({score}%)."


def _score_ownership_assigned(
    definitions: list[FieldDefinition],
    stewards: list[StewardAssignment],
    _config: dict[str, Any],
) -> tuple[int, str]:
    if not definitions:
        return 0, "No columns saved yet."
    steward_map = {
        f"{s.database_name}|{s.table_name}|{s.column_name}": s for s in stewards
    }
    assigned = 0
    for item in definitions:
        key = f"{item.database_name}|{item.table_name}|{item.column_name}"
        steward = steward_map.get(key)
        if steward and steward.data_steward.strip():
            assigned += 1
    score = round(100 * assigned / len(definitions))
    return score, f"{assigned}/{len(definitions)} columns have a data steward assigned ({score}%)."


def _score_policy_citations(definitions: list[FieldDefinition], _config: dict[str, Any]) -> tuple[int, str]:
    if not definitions:
        return 0, "No columns saved yet."
    approved = [item for item in definitions if item.approval_status == "approved"]
    if not approved:
        return 0, "No approved definitions yet — citations are measured on approved columns only."
    cited = sum(1 for item in approved if item.policy_citations)
    score = round(100 * cited / len(approved))
    return (
        score,
        f"{cited}/{len(approved)} approved definitions cite governing policy sections ({score}%).",
    )


def score_principle(
    principle: dict[str, Any],
    definitions: list[FieldDefinition],
    rules: list[QualityRule],
    stewards: list[StewardAssignment],
) -> tuple[int, str]:
    rule_type = principle.get("rule_type", "")
    config = principle.get("config") if isinstance(principle.get("config"), dict) else {}

    if rule_type == "approved_definitions":
        return _score_approved_definitions(definitions, config)
    if rule_type == "steward_approvals":
        return _score_steward_approvals(definitions, config)
    if rule_type == "dq_rule_stewardship":
        return _score_dq_rule_stewardship(rules, config)
    if rule_type == "recent_activity":
        return _score_recent_activity(definitions, config)
    if rule_type == "classification_coverage":
        return _score_classification_coverage(definitions, config)
    if rule_type == "glossary_linked":
        return _score_glossary_linked(definitions, config)
    if rule_type == "ownership_assigned":
        return _score_ownership_assigned(definitions, stewards, config)
    if rule_type == "policy_citations":
        return _score_policy_citations(definitions, config)
    return 0, f"Unknown rule type: {rule_type}"


def compute_table_readiness(
    session: Session,
    database_name: str,
    table_name: str,
) -> dict[str, Any]:
    definitions = (
        session.query(FieldDefinition)
        .filter_by(database_name=database_name, table_name=table_name)
        .all()
    )
    rules = (
        session.query(QualityRule)
        .filter_by(database_name=database_name, table_name=table_name)
        .all()
    )
    stewards = (
        session.query(StewardAssignment)
        .filter_by(database_name=database_name, table_name=table_name)
        .all()
    )
    steward_row = (
        session.query(StewardAssignment)
        .filter_by(database_name=database_name, table_name=table_name)
        .order_by(StewardAssignment.updated_at.desc())
        .first()
    )

    config = load_readiness_config(session)
    principles = [p for p in load_principles(session) if p.get("enabled", True)]
    if not principles:
        principles = load_principles(session)

    scores: dict[str, int] = {}
    reasoning: dict[str, str] = {}
    labels: dict[str, str] = {}
    total_weight = 0
    weighted_sum = 0

    for principle in principles:
        if not principle.get("enabled", True):
            continue
        pid = str(principle["id"])
        weight = max(1, int(principle.get("weight", 25)))
        score, detail = score_principle(principle, definitions, rules, stewards)
        scores[pid] = score
        reasoning[pid] = detail
        labels[pid] = str(principle.get("name", pid))
        total_weight += weight
        weighted_sum += score * weight

    overall = round(weighted_sum / total_weight, 1) if total_weight else 0.0
    thresholds = config.get("thresholds", DEFAULT_THRESHOLDS)
    ready_at = int(thresholds.get("ready", 75))
    progress_at = int(thresholds.get("in_progress", 40))

    if overall >= ready_at:
        status = "Ready"
    elif overall >= progress_at:
        status = "In progress"
    else:
        status = "Needs attention"

    reasoning["summary"] = config.get("readiness_note", DEFAULT_READINESS_NOTE)

    return {
        "overall_score": overall,
        "status": status,
        "breakdown": {"scores": scores, "reasoning": reasoning},
        "dimension_labels": labels,
        "readiness_note": config.get("readiness_note", DEFAULT_READINESS_NOTE),
        "steward_assigned": steward_row.data_steward if steward_row else "",
    }


def recompute_trust_score(session: Session, database_name: str, table_name: str) -> TrustScore:
    result = compute_table_readiness(session, database_name, table_name)

    row = (
        session.query(TrustScore)
        .filter_by(database_name=database_name, table_name=table_name)
        .one_or_none()
    )
    if row is None:
        row = TrustScore(database_name=database_name, table_name=table_name)
        session.add(row)

    row.overall_score = result["overall_score"]
    row.breakdown = result["breakdown"]
    row.status = result["status"]
    row.steward_assigned = result["steward_assigned"]
    row.last_profiled = datetime.now(timezone.utc)
    session.flush()
    return row


def recompute_all_trust_scores(session: Session) -> dict[str, Any]:
    pairs = session.query(FieldDefinition.database_name, FieldDefinition.table_name).distinct().all()
    tables = sorted({(db, tbl) for db, tbl in pairs})
    updated = 0
    for database_name, table_name in tables:
        recompute_trust_score(session, database_name, table_name)
        updated += 1
    return {"tables_recomputed": updated}


def compute_domain_principle_scores(
    session: Session,
    database_name: str,
    *,
    definitions: list[FieldDefinition] | None = None,
    rules: list[QualityRule] | None = None,
    stewards: list[StewardAssignment] | None = None,
) -> dict[str, dict[str, Any]]:
    """Score each enabled governing principle at domain scope (feeds maturity radar axes)."""
    definitions = definitions or (
        session.query(FieldDefinition).filter_by(database_name=database_name).all()
    )
    rules = rules or (
        session.query(QualityRule).filter_by(database_name=database_name).all()
    )
    stewards = stewards or (
        session.query(StewardAssignment).filter_by(database_name=database_name).all()
    )
    principles = [p for p in load_principles(session) if p.get("enabled", True)]
    result: dict[str, dict[str, Any]] = {}
    for principle in principles:
        pid = str(principle["id"])
        score, detail = score_principle(principle, definitions, rules, stewards)
        result[pid] = {
            "id": pid,
            "name": principle.get("name", pid),
            "rule_type": principle.get("rule_type", ""),
            "weight": max(1, int(principle.get("weight", 25))),
            "score": score,
            "detail": detail,
        }
    return result


def recompute_governance_scores(session: Session) -> dict[str, Any]:
    """Recompute table readiness (principles) — maturity radar reflects changes on next load."""
    trust_result = recompute_all_trust_scores(session)
    domains = [
        row[0]
        for row in session.query(FieldDefinition.database_name).distinct().all()
    ]
    return {
        **trust_result,
        "domains_with_maturity": len(domains),
        "maturity_note": "Data maturity radar axes derive from the same governing principles.",
    }


def normalize_breakdown(breakdown: dict[str, Any] | None) -> tuple[dict[str, int], dict[str, str]]:
    """Support legacy flat breakdown keys and new scores/reasoning structure."""
    if not breakdown:
        return {}, {}

    if isinstance(breakdown.get("scores"), dict):
        scores = {k: int(v) for k, v in breakdown["scores"].items()}
        reasoning_raw = breakdown.get("reasoning")
        reasoning = reasoning_raw if isinstance(reasoning_raw, dict) else {}
        return scores, reasoning

    legacy_keys = ("completeness", "accuracy", "freshness", "schema_consistency")
    scores = {}
    for key in legacy_keys:
        if key in breakdown:
            scores[key] = int(breakdown[key])
    reasoning_raw = breakdown.get("reasoning")
    reasoning = reasoning_raw if isinstance(reasoning_raw, dict) else {}
    return scores, reasoning
