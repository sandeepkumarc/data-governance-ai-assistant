"""Natural-language governance principle authoring via local LLM or heuristics."""

from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from rag_governance import call_ollama, parse_json_response
from services.audit import record_audit
from services.governance_principles import (
    RULE_TYPE_CATALOG,
    load_principles,
    load_principles_bundle,
    recompute_governance_scores,
    upsert_principle,
)


def _catalog_entry(rule_type: str) -> dict[str, Any]:
    for entry in RULE_TYPE_CATALOG:
        if entry["rule_type"] == rule_type:
            return entry
    return RULE_TYPE_CATALOG[0]


def _custom_name_from_instruction(instruction: str) -> str | None:
    """Use explicit titles like 'Test Principle to test' instead of a catalog label."""
    text = instruction.strip()
    arrow = re.match(r"^(.+?)\s*(?:->|→)\s*(.+)$", text)
    if arrow:
        name = arrow.group(1).strip().strip("'\"")
        if name:
            return name
    patterns = (
        r"^(?:add|create)\s+(?:a\s+)?(?:principle\s+)?(?:called\s+)?['\"]?(.+?)['\"]?\s*(?:to test|for testing)?\.?$",
        r"^(.+?)\s+to test\.?$",
        r"^test principle\s*(?:named|:)?\s*(.+)$",
    )
    for pattern in patterns:
        match = re.match(pattern, text, re.I)
        if match:
            name = match.group(1).strip().strip("'\"")
            if name:
                return name
    return None


def _resolve_pillar_hint(hint: str) -> str | None:
    """Map user pillar text to a maturity axis key."""
    from services.maturity_config import MATURITY_PILLAR_LABELS

    normalized = re.sub(r"\s+", " ", hint.strip().lower()).replace("&", "and")
    slug = normalized.replace(" ", "_").replace("-", "_")

    if slug in MATURITY_PILLAR_LABELS:
        return slug
    if normalized in MATURITY_PILLAR_LABELS:
        return normalized

    for axis, label in MATURITY_PILLAR_LABELS.items():
        label_norm = label.lower().replace("&", "and")
        if normalized == label_norm or normalized in label_norm or label_norm in normalized:
            return axis

    aliases = {
        "metadata": "metadata_definitions",
        "definitions": "metadata_definitions",
        "governance": "governance_stewardship",
        "stewardship": "governance_stewardship",
        "quality": "data_quality",
        "dq": "data_quality",
        "data quality": "data_quality",
        "lineage": "lineage_traceability",
        "traceability": "lineage_traceability",
        "security": "security_classification",
        "classification": "security_classification",
        "operational": "operational_readiness",
        "readiness": "operational_readiness",
    }
    if normalized in aliases:
        return aliases[normalized]

    # Partial token match (e.g. "metadata pillar")
    for token, axis in aliases.items():
        if token in normalized:
            return axis

    return None


def _parse_arrow_instruction(instruction: str) -> tuple[str | None, str | None]:
    """Parse 'Principle name -> Metadata & definitions' into name + rule_type."""
    from services.maturity_config import AXIS_DEFAULT_RULE_TYPE

    match = re.match(r"^(.+?)\s*(?:->|→)\s*(.+)$", instruction.strip())
    if not match:
        return None, None
    name = match.group(1).strip().strip("'\"")
    axis = _resolve_pillar_hint(match.group(2).strip())
    if not name or not axis:
        return name or None, None
    rule_type = AXIS_DEFAULT_RULE_TYPE.get(axis, "approved_definitions")
    return name, rule_type


def _heuristic_principle(instruction: str) -> dict[str, Any]:
    text = instruction.strip().lower()
    custom_name = _custom_name_from_instruction(instruction)

    arrow_name, arrow_rule_type = _parse_arrow_instruction(instruction)
    if arrow_name and arrow_rule_type:
        entry = _catalog_entry(arrow_rule_type)
        return {
            "name": arrow_name,
            "description": instruction.strip(),
            "rule_type": arrow_rule_type,
            "enabled": True,
            "weight": 25,
            "config": entry["default_config"],
        }

    if any(token in text for token in ["glossary", "business term", "term linked"]):
        entry = _catalog_entry("glossary_linked")
        return {
            "name": "Glossary terms linked",
            "description": instruction.strip(),
            "rule_type": "glossary_linked",
            "enabled": True,
            "weight": 15,
            "config": entry["default_config"],
        }

    if any(token in text for token in ["steward", "owner", "ownership", "assigned"]):
        entry = _catalog_entry("ownership_assigned")
        return {
            "name": "Ownership assigned",
            "description": instruction.strip(),
            "rule_type": "ownership_assigned",
            "enabled": True,
            "weight": 15,
            "config": entry["default_config"],
        }

    if any(token in text for token in ["pii", "confidential", "classification", "classified", "sensitive"]):
        entry = _catalog_entry("classification_coverage")
        return {
            "name": "Sensitive data classified",
            "description": instruction.strip(),
            "rule_type": "classification_coverage",
            "enabled": True,
            "weight": 20,
            "config": entry["default_config"],
        }

    if any(token in text for token in ["policy", "citation", "cite", "knowledge base"]):
        entry = _catalog_entry("policy_citations")
        return {
            "name": "Policy citations present",
            "description": instruction.strip(),
            "rule_type": "policy_citations",
            "enabled": True,
            "weight": 10,
            "config": entry["default_config"],
        }

    if any(token in text for token in ["dq", "quality rule", "data quality", "passed"]):
        entry = _catalog_entry("dq_rule_stewardship")
        return {
            "name": "DQ rules stewarded",
            "description": instruction.strip(),
            "rule_type": "dq_rule_stewardship",
            "enabled": True,
            "weight": 25,
            "config": entry["default_config"],
        }

    if any(token in text for token in ["recent", "fresh", "updated", "activity"]):
        entry = _catalog_entry("recent_activity")
        config = dict(entry["default_config"])
        if "30" in text or "month" in text:
            config["window_days"] = 30
        elif "14" in text or "two week" in text:
            config["window_days"] = 14
        return {
            "name": "Recent steward activity",
            "description": instruction.strip(),
            "rule_type": "recent_activity",
            "enabled": True,
            "weight": 20,
            "config": config,
        }

    if any(token in text for token in ["approve", "approval", "steward review"]):
        entry = _catalog_entry("steward_approvals")
        return {
            "name": custom_name or "Steward approvals",
            "description": instruction.strip(),
            "rule_type": "steward_approvals",
            "enabled": True,
            "weight": 25,
            "config": entry["default_config"],
        }

    entry = _catalog_entry("approved_definitions")
    return {
        "name": custom_name or "Approved definitions",
        "description": instruction.strip(),
        "rule_type": "approved_definitions",
        "enabled": True,
        "weight": 25,
        "config": entry["default_config"],
    }


def _build_nl_prompt(instruction: str, principles: list[dict[str, Any]]) -> str:
    catalog = "\n".join(
        f"- {e['rule_type']}: {e['label']} — {e['description']}"
        for e in RULE_TYPE_CATALOG
    )
    existing = "\n".join(
        f"- {p.get('name')} ({p.get('rule_type')}, weight={p.get('weight')}): {p.get('description', '')}"
        for p in principles
    )
    return f"""You are a data governance readiness architect. Convert the user's natural language instruction into ONE governing principle for readiness scoring.

Rule type catalog:
{catalog}

Existing principles:
{existing or "None yet."}

User instruction:
{instruction.strip()}

Return ONLY valid JSON:
{{
  "summary": "One sentence describing the principle",
  "principle": {{
    "name": "short principle title",
    "description": "what this principle measures",
    "enabled": true,
    "weight": 25,
    "rule_type": "approved_definitions|steward_approvals|dq_rule_stewardship|recent_activity|classification_coverage|glossary_linked|ownership_assigned|policy_citations",
    "config": {{}}
  }}
}}

Weights should sum sensibly with other principles (typical range 10-30 per principle).
Use config.window_days for recent_activity, config.status_weights for dq_rule_stewardship, config.sensitivity_keywords for classification_coverage.
"""


def propose_governance_principle(
    instruction: str,
    session: Session,
    *,
    provider: str = "ollama",
    model: str = "gemma4:e2b",
    base_url: str = "http://localhost:11434",
    no_llm: bool = False,
) -> tuple[str, dict[str, Any]]:
    instruction = instruction.strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="Instruction is required")

    if no_llm:
        principle = _heuristic_principle(instruction)
        from services.maturity_config import maturity_pillar_for_rule_type

        pillar = maturity_pillar_for_rule_type(principle["rule_type"]).get("maturity_pillar_label")
        summary = (
            f"Created principle \"{principle['name']}\""
            + (f" on pillar {pillar}" if pillar else "")
        )
        return summary, principle

    if provider != "ollama":
        raise HTTPException(status_code=400, detail="Governance NL principles currently support provider=ollama")

    prompt = _build_nl_prompt(instruction, load_principles(session))
    try:
        response = call_ollama(prompt, model=model, base_url=base_url)
        payload = parse_json_response(response)
        summary = str(payload.get("summary", "")).strip() or "Proposed governing principle."
        raw = payload.get("principle")
        if not isinstance(raw, dict):
            raise ValueError("LLM response missing principle object")
        rule_type = str(raw.get("rule_type", "approved_definitions"))
        entry = _catalog_entry(rule_type)
        config = raw.get("config") if isinstance(raw.get("config"), dict) else entry["default_config"]
        principle = {
            "name": str(raw.get("name", entry["label"])),
            "description": str(raw.get("description", instruction)),
            "enabled": bool(raw.get("enabled", True)),
            "weight": int(raw.get("weight", 25)),
            "rule_type": rule_type,
            "config": config,
        }
        return summary, principle
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate governance principle: {exc}",
        ) from exc


def apply_natural_language_governance_principle(
    session: Session,
    instruction: str,
    *,
    provider: str = "ollama",
    model: str = "gemma4:e2b",
    base_url: str = "http://localhost:11434",
    no_llm: bool = False,
    dry_run: bool = False,
    recompute_after: bool = True,
) -> dict[str, Any]:
    summary, principle = propose_governance_principle(
        instruction,
        session,
        provider=provider,
        model=model,
        base_url=base_url,
        no_llm=no_llm,
    )

    saved = principle
    recompute_result: dict[str, Any] | None = None

    if not dry_run:
        saved = upsert_principle(session, principle, source="nl", nl_instruction=instruction)
        if recompute_after:
            recompute_result = recompute_governance_scores(session)
        record_audit(
            session,
            action="nl_update_governance_principle",
            entity_type="governance_principle",
            entity_id=saved.get("id"),
            details={
                "instruction": instruction,
                "summary": summary,
                "principle": saved,
                "recompute_result": recompute_result,
            },
        )
        session.commit()

    return {
        "summary": summary,
        "dry_run": dry_run,
        "applied": not dry_run,
        "principle": saved,
        "principles": load_principles_bundle(session),
        "recompute_result": recompute_result,
    }
