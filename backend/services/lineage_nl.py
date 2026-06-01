"""Natural-language lineage policy authoring via local LLM or heuristics."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from rag_governance import call_ollama, parse_json_response
from services.audit import record_audit
from services.lineage_policies import apply_lineage_policies, load_policies, upsert_policy


def _heuristic_policy(instruction: str) -> dict[str, Any]:
    text = instruction.strip().lower()

    if any(token in text for token in ["full name", "matching name", "same name", "exact name", "column name"]):
        return {
            "name": "Stitch columns by matching full name",
            "description": instruction.strip(),
            "rule_type": "match_full_name",
            "enabled": True,
            "config": {
                "node_types": ["column"],
                "match_on": ["column_name", "label"],
                "cross_database": True,
                "edge_label": "same full name",
            },
        }

    if any(token in text for token in ["logical attribute", "logical name", "logical data"]):
        return {
            "name": "Stitch by logical attribute name",
            "description": instruction.strip(),
            "rule_type": "match_logical_attribute",
            "enabled": True,
            "config": {
                "cross_database": True,
                "edge_label": "same logical attribute",
            },
        }

    if "table" in text and any(token in text for token in ["match", "same", "stitch", "link"]):
        return {
            "name": "Stitch tables by matching name",
            "description": instruction.strip(),
            "rule_type": "match_table_name",
            "enabled": True,
            "config": {
                "cross_database": True,
                "edge_label": "same table name",
            },
        }

    if any(token in text for token in ["pii", "confidential", "gdpr", "audit", "compliance"]):
        return {
            "name": "PII routing policy",
            "description": instruction.strip(),
            "rule_type": "keyword_to_report",
            "enabled": True,
            "config": {
                "keywords": ["confidential", "restricted", "personal", "pii", "email", "contact"],
                "report_id": "report_audit",
                "edge_label": "PII scan target",
            },
        }

    return {
        "name": "Custom lineage policy",
        "description": instruction.strip(),
        "rule_type": "match_full_name",
        "enabled": True,
        "config": {
            "node_types": ["column"],
            "match_on": ["column_name", "label"],
            "cross_database": True,
            "edge_label": "policy match",
        },
    }


def _build_nl_prompt(instruction: str, policies: list[dict[str, Any]]) -> str:
    catalog = "\n".join(
        f"- {p.get('name')} ({p.get('rule_type')}): {p.get('description', '')}"
        for p in policies
    )
    return f"""You are a data lineage policy author. Convert the user's natural language instruction into ONE lineage stitching policy.

Existing policies:
{catalog or "None yet."}

User instruction:
{instruction.strip()}

Return ONLY valid JSON:
{{
  "summary": "One sentence describing the policy",
  "policy": {{
    "name": "short policy title",
    "description": "what this policy does",
    "enabled": true,
    "rule_type": "match_full_name|match_logical_attribute|match_table_name|keyword_to_report",
    "config": {{}}
  }}
}}

Rule types:
- match_full_name: stitch columns when names match. config: match_on (array), cross_database (bool), edge_label
- match_logical_attribute: stitch columns with same logical_data_attribute_name. config: cross_database, edge_label
- match_table_name: stitch tables with same name across databases. config: cross_database, edge_label
- keyword_to_report: link columns to a report when keywords appear. config: keywords (array), report_id, edge_label

Use report_id values: report_audit (GDPR Compliance Ledger) or report_sales (Sales & Revenue Dashboard).
"""


def propose_lineage_policy(
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
        policy = _heuristic_policy(instruction)
        summary = f"Created heuristic policy: {policy['name']}"
        return summary, policy

    if provider != "ollama":
        raise HTTPException(status_code=400, detail="Lineage NL policies currently support provider=ollama")

    prompt = _build_nl_prompt(instruction, load_policies(session))
    try:
        response = call_ollama(prompt, model=model, base_url=base_url)
        payload = parse_json_response(response)
        summary = str(payload.get("summary", "")).strip() or "Proposed lineage policy."
        policy_raw = payload.get("policy")
        if not isinstance(policy_raw, dict):
            raise ValueError("LLM response missing policy object")
        policy = {
            "name": str(policy_raw.get("name", "Custom lineage policy")),
            "description": str(policy_raw.get("description", instruction)),
            "enabled": bool(policy_raw.get("enabled", True)),
            "rule_type": str(policy_raw.get("rule_type", "match_full_name")),
            "config": policy_raw.get("config") if isinstance(policy_raw.get("config"), dict) else {},
        }
        return summary, policy
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate lineage policy: {exc}",
        ) from exc


def apply_natural_language_lineage_policy(
    session: Session,
    instruction: str,
    *,
    provider: str = "ollama",
    model: str = "gemma4:e2b",
    base_url: str = "http://localhost:11434",
    no_llm: bool = False,
    dry_run: bool = False,
    apply_after: bool = True,
) -> dict[str, Any]:
    summary, policy = propose_lineage_policy(
        instruction,
        session,
        provider=provider,
        model=model,
        base_url=base_url,
        no_llm=no_llm,
    )

    saved_policy = policy
    apply_result: dict[str, Any] | None = None

    if not dry_run:
        saved_policy = upsert_policy(
            session,
            policy,
            source="nl",
            nl_instruction=instruction,
        )
        if apply_after:
            apply_result = apply_lineage_policies(session)
        record_audit(
            session,
            action="nl_update_lineage_policy",
            entity_type="lineage_policy",
            entity_id=saved_policy.get("id"),
            details={
                "instruction": instruction,
                "summary": summary,
                "policy": saved_policy,
                "apply_result": apply_result,
            },
        )
        session.commit()

    return {
        "summary": summary,
        "dry_run": dry_run,
        "applied": not dry_run,
        "policy": saved_policy,
        "policies": load_policies(session),
        "apply_result": apply_result,
    }
