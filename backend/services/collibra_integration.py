"""Collibra integration — read glossary context and push approved definitions.

Uses Collibra REST API (same operations as the open-source chip MCP server).
Optional MCP stdio bridge can be added via COLLIBRA_MCP_CHIP_PATH in a later release.
"""

from __future__ import annotations

import base64
import logging
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from config import (
    COLLIBRA_API_PASSWORD,
    COLLIBRA_API_URL,
    COLLIBRA_API_USERNAME,
    COLLIBRA_AUTO_PUSH_ON_APPROVE,
    COLLIBRA_BUSINESS_TERM_TYPE_NAME,
    COLLIBRA_ENABLED,
    COLLIBRA_GLOSSARY_DOMAIN_NAME,
)
from db.models import FieldDefinition
from services.audit import record_audit
from services.definitions import definition_to_dict

logger = logging.getLogger(__name__)


def collibra_status() -> dict[str, Any]:
    configured = _is_configured()
    return {
        "enabled": COLLIBRA_ENABLED,
        "configured": configured,
        "mode": "rest" if configured else "disabled",
        "api_url": COLLIBRA_API_URL if configured else "",
        "glossary_domain": COLLIBRA_GLOSSARY_DOMAIN_NAME,
        "business_term_type": COLLIBRA_BUSINESS_TERM_TYPE_NAME,
        "auto_push_on_approve": COLLIBRA_AUTO_PUSH_ON_APPROVE,
        "mcp_note": "AI-Assisted Data Governance uses Collibra REST; configure chip MCP separately for Cursor/agents.",
    }


def _is_configured() -> bool:
    return bool(
        COLLIBRA_ENABLED
        and COLLIBRA_API_URL
        and COLLIBRA_API_USERNAME
        and COLLIBRA_API_PASSWORD
    )


def _auth_header() -> dict[str, str]:
    token = base64.b64encode(
        f"{COLLIBRA_API_USERNAME}:{COLLIBRA_API_PASSWORD}".encode()
    ).decode()
    return {"Authorization": f"Basic {token}", "Accept": "application/json"}


def _rest_get(path: str, *, params: dict[str, Any] | None = None) -> Any:
    url = f"{COLLIBRA_API_URL.rstrip('/')}{path}"
    with httpx.Client(timeout=60.0, verify=True) as client:
        response = client.get(url, headers=_auth_header(), params=params or {})
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Collibra API error {response.status_code}: {response.text[:500]}",
        )
    return response.json()


def _rest_post(path: str, payload: dict[str, Any]) -> Any:
    url = f"{COLLIBRA_API_URL.rstrip('/')}{path}"
    with httpx.Client(timeout=60.0, verify=True) as client:
        response = client.post(url, headers={**_auth_header(), "Content-Type": "application/json"}, json=payload)
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Collibra API error {response.status_code}: {response.text[:500]}",
        )
    return response.json()


def _rest_patch(path: str, payload: dict[str, Any]) -> Any:
    url = f"{COLLIBRA_API_URL.rstrip('/')}{path}"
    with httpx.Client(timeout=60.0, verify=True) as client:
        response = client.patch(url, headers={**_auth_header(), "Content-Type": "application/json"}, json=payload)
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Collibra API error {response.status_code}: {response.text[:500]}",
        )
    return response.json()


def _extract_definition(attrs: dict[str, Any] | None) -> str:
    if not attrs:
        return ""
    for key in ("Definition", "definition", "Description"):
        val = attrs.get(key)
        if isinstance(val, list) and val and isinstance(val[0], dict):
            return str(val[0].get("value", ""))
        if isinstance(val, str):
            return val
    return ""


def search_glossary_matches(
    *,
    database_name: str,
    table_name: str,
    column_name: str,
    glossary_term: str = "",
    definition: str = "",
    notes: str = "",
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Search Collibra for business terms related to column context."""
    if not _is_configured():
        return []

    queries = []
    if glossary_term:
        queries.append(glossary_term)
    queries.append(column_name.replace("_", " "))
    queries.append(f"{table_name} {column_name}")
    if notes:
        queries.append(notes[:80])

    seen: set[str] = set()
    matches: list[dict[str, Any]] = []

    for q in queries:
        q = q.strip()
        if not q or q.lower() in seen:
            continue
        seen.add(q.lower())
        try:
            data = _rest_get(
                "/rest/2.0/assets",
                params={
                    "name": q,
                    "nameMatchMode": "ANYWHERE",
                    "limit": limit,
                },
            )
        except HTTPException:
            logger.warning("Collibra search failed for query=%s", q)
            continue

        results = data.get("results", data) if isinstance(data, dict) else data
        if not isinstance(results, list):
            continue

        for item in results:
            if not isinstance(item, dict):
                continue
            asset_id = str(item.get("id", ""))
            if not asset_id or asset_id in {m["collibra_asset_id"] for m in matches}:
                continue
            name = str(item.get("name") or item.get("displayName") or "")
            type_name = ""
            if isinstance(item.get("type"), dict):
                type_name = str(item["type"].get("name", ""))
            if COLLIBRA_BUSINESS_TERM_TYPE_NAME.lower() not in type_name.lower() and type_name:
                continue
            defn = _extract_definition(item.get("attributes"))
            matches.append(
                {
                    "collibra_asset_id": asset_id,
                    "name": name,
                    "display_name": str(item.get("displayName", name)),
                    "type": type_name or COLLIBRA_BUSINESS_TERM_TYPE_NAME,
                    "definition_excerpt": (defn or "")[:400],
                    "suggested_action": "link",
                    "match_query": q,
                }
            )
            if len(matches) >= limit:
                return matches

    if not matches and glossary_term:
        matches.append(
            {
                "collibra_asset_id": "",
                "name": glossary_term,
                "display_name": glossary_term,
                "type": COLLIBRA_BUSINESS_TERM_TYPE_NAME,
                "definition_excerpt": (definition or "")[:400],
                "suggested_action": "create_new",
                "match_query": "proposed",
            }
        )
    return matches


def enrich_result_with_collibra(result: dict[str, Any]) -> dict[str, Any]:
    """Attach Collibra glossary matches and optional alignment to an analyze result."""
    if not _is_configured():
        result["collibra_matches"] = []
        return result

    matches = search_glossary_matches(
        database_name=str(result.get("database_name", "")),
        table_name=str(result.get("table_name", "")),
        column_name=str(result.get("column_name", "")),
        glossary_term=str(result.get("glossary_term", "")),
        definition=str(result.get("definition", "")),
    )
    result["collibra_matches"] = matches

    linkable = [m for m in matches if m.get("suggested_action") == "link" and m.get("collibra_asset_id")]
    if linkable:
        best = linkable[0]
        result["collibra_recommended_action"] = "link"
        result["collibra_asset_id"] = best["collibra_asset_id"]
        if best.get("definition_excerpt") and not result.get("glossary_term_description"):
            result["glossary_term_description"] = best["definition_excerpt"]
    elif matches and matches[0].get("suggested_action") == "create_new":
        result["collibra_recommended_action"] = "create_new"
    return result


def _resolve_domain_id() -> str:
    data = _rest_get(
        "/rest/2.0/domains",
        params={"name": COLLIBRA_GLOSSARY_DOMAIN_NAME, "nameMatchMode": "EXACT", "limit": 1},
    )
    results = data.get("results", [])
    if results:
        return str(results[0]["id"])
    raise HTTPException(
        status_code=502,
        detail=f"Collibra domain not found: {COLLIBRA_GLOSSARY_DOMAIN_NAME}",
    )


def _resolve_asset_type_id() -> str:
    data = _rest_get(
        "/rest/2.0/assetTypes",
        params={"name": COLLIBRA_BUSINESS_TERM_TYPE_NAME, "limit": 20},
    )
    results = data.get("results", [])
    for item in results:
        if str(item.get("name", "")).lower() == COLLIBRA_BUSINESS_TERM_TYPE_NAME.lower():
            return str(item["id"])
    if results:
        return str(results[0]["id"])
    raise HTTPException(
        status_code=502,
        detail=f"Collibra asset type not found: {COLLIBRA_BUSINESS_TERM_TYPE_NAME}",
    )


def push_definition_to_collibra(session: Session, definition_id: str) -> dict[str, Any]:
    """Create or update a Collibra business term from an approved field definition."""
    if not _is_configured():
        raise HTTPException(status_code=400, detail="Collibra integration is not configured")

    row = session.get(FieldDefinition, definition_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Definition not found")
    if row.approval_status != "approved":
        raise HTTPException(status_code=400, detail="Only approved definitions can be pushed to Collibra")

    term_name = (row.glossary_term or row.column_name).strip()
    definition_text = (row.definition or row.glossary_term_description or "").strip()
    logical_name = row.logical_data_attribute_name or row.column_name

    action = "updated"
    asset_id = (row.collibra_asset_id or "").strip()

    if asset_id:
        payload = {
            "attributes": {
                "Definition": [{"value": definition_text}],
            },
            "displayName": term_name,
        }
        _rest_patch(f"/rest/2.0/assets/{quote(asset_id, safe='')}", payload)
    else:
        domain_id = _resolve_domain_id()
        type_id = _resolve_asset_type_id()
        payload = {
            "name": term_name,
            "displayName": term_name,
            "domain": {"id": domain_id},
            "type": {"id": type_id},
            "attributes": {
                "Definition": [{"value": definition_text}],
                "Note": [
                    {
                        "value": (
                            f"Source: {row.database_name}.{row.table_name}.{row.column_name}. "
                            f"Logical attribute: {logical_name}. "
                            f"Pushed from AI-Assisted Data Governance."
                        )
                    }
                ],
            },
        }
        created = _rest_post("/rest/2.0/assets", payload)
        asset_id = str(created.get("id", ""))
        action = "created"

    row.collibra_asset_id = asset_id
    row.collibra_sync_status = "pushed"
    session.flush()

    record_audit(
        session,
        action="collibra_push",
        entity_type="field_definition",
        entity_id=definition_id,
        details={
            "collibra_asset_id": asset_id,
            "action": action,
            "term_name": term_name,
        },
    )
    session.commit()
    out = definition_to_dict(row)
    out["collibra_push"] = {"status": "ok", "action": action, "collibra_asset_id": asset_id}
    return out


def push_all_approved_pending(session: Session) -> dict[str, Any]:
    rows = (
        session.query(FieldDefinition)
        .filter(FieldDefinition.approval_status == "approved")
        .filter(FieldDefinition.collibra_sync_status != "pushed")
        .all()
    )
    results: list[dict[str, Any]] = []
    errors: list[str] = []
    for row in rows:
        try:
            results.append(push_definition_to_collibra(session, row.id))
        except HTTPException as exc:
            errors.append(f"{row.column_name}: {exc.detail}")
        except Exception as exc:
            errors.append(f"{row.column_name}: {exc}")
    return {"pushed": len(results), "errors": errors, "items": results}


def maybe_auto_push_on_approve(session: Session, definition_id: str) -> None:
    if COLLIBRA_AUTO_PUSH_ON_APPROVE and _is_configured():
        try:
            push_definition_to_collibra(session, definition_id)
        except Exception as exc:
            logger.warning("Collibra auto-push failed for %s: %s", definition_id, exc)
