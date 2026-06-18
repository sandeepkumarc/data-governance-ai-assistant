"""Collibra-wide data maturity — score all DGC assets by domain."""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from db.models import CollibraMaturitySnapshot, FieldDefinition, QualityRule, TrustScore
from services.collibra_integration import _extract_definition, _is_configured, _rest_get
from services.data_maturity import (
    GARTNER_STAGES,
    MATURITY_DIMENSIONS,
    _level_to_stage,
    _score_to_level,
)
from services.maturity_config import domain_label, load_maturity_config, weighted_overall

logger = logging.getLogger(__name__)

PUBLISHED_STATUSES = {"published", "approved", "certified", "active", "validated"}
CANDIDATE_STATUSES = {"candidate", "review", "under review", "draft"}


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_") or "unknown"


def _domain_key_from_asset(asset: dict[str, Any]) -> tuple[str, str]:
    domain = asset.get("domain") if isinstance(asset.get("domain"), dict) else {}
    name = str(domain.get("name") or domain.get("displayName") or "Uncategorized")
    domain_id = f"collibra:{_slug(name)}"
    return domain_id, name


def _fetch_paginated(path: str, *, params: dict[str, Any] | None = None, max_items: int = 3000) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    offset = 0
    page_size = min(500, max_items)
    base_params = dict(params or {})

    while len(items) < max_items:
        data = _rest_get(
            path,
            params={**base_params, "limit": page_size, "offset": offset},
        )
        results = data.get("results", data) if isinstance(data, dict) else data
        if not isinstance(results, list) or not results:
            break
        for item in results:
            if isinstance(item, dict):
                items.append(item)
                if len(items) >= max_items:
                    break
        if len(results) < page_size:
            break
        offset += page_size
    return items


def _fetch_responsibility_map(max_items: int = 10000) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    try:
        rows = _fetch_paginated("/rest/2.0/responsibilities", max_items=max_items)
    except Exception as exc:
        logger.warning("Collibra responsibilities fetch failed: %s", exc)
        return counts
    for row in rows:
        resource = row.get("resource") if isinstance(row.get("resource"), dict) else {}
        asset_id = str(resource.get("id", ""))
        if asset_id:
            counts[asset_id] += 1
    return counts


def _fetch_relation_counts(asset_ids: set[str], max_items: int = 15000) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    try:
        rows = _fetch_paginated("/rest/2.0/relations", max_items=max_items)
    except Exception as exc:
        logger.warning("Collibra relations fetch failed: %s", exc)
        return counts
    for row in rows:
        for key in ("source", "target"):
            node = row.get(key) if isinstance(row.get(key), dict) else {}
            aid = str(node.get("id", ""))
            if aid in asset_ids:
                counts[aid] += 1
    return counts


def _local_catalog_maps(session: Session) -> tuple[dict[str, FieldDefinition], dict[str, list[QualityRule]], dict[str, TrustScore]]:
    by_collibra: dict[str, FieldDefinition] = {}
    for row in session.query(FieldDefinition).filter(FieldDefinition.collibra_asset_id != "").all():
        by_collibra[row.collibra_asset_id] = row

    rules_by_field: dict[str, list[QualityRule]] = defaultdict(list)
    for rule in session.query(QualityRule).all():
        if rule.field_definition_id:
            rules_by_field[rule.field_definition_id].append(rule)

    trust_by_table: dict[str, TrustScore] = {}
    for ts in session.query(TrustScore).all():
        trust_by_table[f"{ts.database_name}|{ts.table_name}"] = ts

    return by_collibra, rules_by_field, trust_by_table


def _asset_status_score(status: dict[str, Any] | None) -> tuple[int, str]:
    if not status or not isinstance(status, dict):
        return 25, "No lifecycle status in Collibra."
    name = str(status.get("name") or status.get("displayName") or "").lower()
    if any(s in name for s in PUBLISHED_STATUSES):
        return 100, f"Collibra status “{status.get('name', name)}” indicates governed publication."
    if any(s in name for s in CANDIDATE_STATUSES):
        return 50, f"Collibra status “{status.get('name', name)}” is in review."
    return 30, f"Collibra status “{status.get('name', name) or 'unknown'}”."


def _score_collibra_asset(
    asset: dict[str, Any],
    *,
    responsibility_count: int,
    relation_count: int,
    local: FieldDefinition | None,
    local_rules: list[QualityRule],
    local_trust: TrustScore | None,
) -> dict[str, int]:
    asset_id = str(asset.get("id", ""))
    definition = _extract_definition(asset.get("attributes") if isinstance(asset.get("attributes"), dict) else {})
    has_definition = bool(definition.strip())

    gov = 100 if responsibility_count > 0 else (60 if local and local.approval_status == "approved" else 15)
    meta = 100 if has_definition else (70 if local and local.definition.strip() else 20)
    if local and local.glossary_term.strip():
        meta = min(100, meta + 10)

    if local_rules:
        weights = {"Passed": 100, "Warning": 70, "Failed": 0, "Suggested": 25}
        dq = round(sum(weights.get(r.status, 0) for r in local_rules) / len(local_rules))
    else:
        dq = 25 if has_definition else 0

    lineage = min(100, relation_count * 25) if relation_count else (40 if local else 10)
    classified = 0
    attrs = asset.get("attributes") if isinstance(asset.get("attributes"), dict) else {}
    for key in attrs:
        if "classif" in key.lower() or "sensitiv" in key.lower() or "security" in key.lower():
            classified = 80
            break
    if local and local.data_classification.strip():
        classified = max(classified, 90)
    security = classified or (30 if has_definition else 10)

    if local_trust:
        ops = round(local_trust.overall_score)
    else:
        ops, _ = _asset_status_score(asset.get("status") if isinstance(asset.get("status"), dict) else None)

    if local and local.collibra_sync_status == "pushed":
        gov = min(100, gov + 10)

    return {
        "governance_stewardship": gov,
        "metadata_definitions": meta,
        "data_quality": dq,
        "lineage_traceability": lineage,
        "security_classification": security,
        "operational_readiness": ops,
    }


def _aggregate_domain(
    domain_id: str,
    domain_name: str,
    asset_scores: list[dict[str, int]],
    config: dict[str, Any],
) -> dict[str, Any]:
    weights = config.get("dimension_weights") or {}
    dimensions: list[dict[str, Any]] = []
    for dim in MATURITY_DIMENSIONS:
        key = dim["key"]
        if not asset_scores:
            score = 0
            detail = "No Collibra assets in this domain."
        else:
            score = round(sum(a[key] for a in asset_scores) / len(asset_scores))
            detail = f"Average across {len(asset_scores)} Collibra asset(s) in “{domain_name}”."
        dimensions.append({**dim, "score": score, "level": _score_to_level(score), "detail": detail})

    overall_level, overall_score = weighted_overall(dimensions, weights)
    return {
        "domain_id": domain_id,
        "domain_label": domain_label(config, domain_id) if domain_id in (config.get("domain_labels") or {}) else domain_name,
        "overall_level": overall_level,
        "overall_score": overall_score,
        "stage": _level_to_stage(overall_level),
        "dimensions": dimensions,
        "stats": {"collibra_assets": len(asset_scores), "source": "collibra"},
    }


def _build_collibra_payload(domains: list[dict[str, Any]], config: dict[str, Any], asset_count: int) -> dict[str, Any]:
    weights = config.get("dimension_weights") or {}
    enterprise_dimensions: list[dict[str, Any]] = []
    for dim in MATURITY_DIMENSIONS:
        key = dim["key"]
        scores = [d for dom in domains for d in dom["dimensions"] if d["key"] == key]
        avg_score = round(sum(s["score"] for s in scores) / len(scores)) if scores else 0
        avg_level = round(sum(s["level"] for s in scores) / len(scores), 1) if scores else 1.0
        enterprise_dimensions.append(
            {
                **dim,
                "score": avg_score,
                "level": avg_level,
                "detail": f"Enterprise average across {len(domains)} Collibra domain(s), {asset_count} assets.",
            }
        )
    ent_level, ent_score = weighted_overall(enterprise_dimensions, weights)
    enterprise = {
        "domain_id": "enterprise",
        "domain_label": "Enterprise (Collibra)",
        "overall_level": ent_level,
        "overall_score": ent_score,
        "stage": _level_to_stage(ent_level),
        "dimensions": enterprise_dimensions,
        "stats": {"collibra_assets": asset_count, "domains": len(domains), "source": "collibra"},
    }
    return {
        "framework": "gartner_data_analytics_maturity",
        "source": "collibra",
        "stages": GARTNER_STAGES,
        "dimension_catalog": MATURITY_DIMENSIONS,
        "config": config,
        "selected_domain_id": "enterprise",
        "selected": enterprise,
        "enterprise": enterprise,
        "domains": domains,
        "collibra_meta": {"asset_count": asset_count, "domain_count": len(domains)},
    }


def sync_collibra_maturity(session: Session, *, max_assets: int | None = None) -> dict[str, Any]:
    """Pull Collibra assets and compute maturity by Collibra domain."""
    if not _is_configured():
        return {"ok": False, "error": "Collibra is not configured. Set COLLIBRA_ENABLED and API credentials."}

    config = load_maturity_config(session)
    limit = max_assets or int(config.get("collibra_max_assets", 3000))

    assets = _fetch_paginated("/rest/2.0/assets", max_items=limit)
    asset_ids = {str(a.get("id", "")) for a in assets if a.get("id")}
    resp_map = _fetch_responsibility_map()
    rel_map = _fetch_relation_counts(asset_ids)
    local_by_collibra, rules_by_field, trust_by_table = _local_catalog_maps(session)

    by_domain: dict[str, list[dict[str, int]]] = defaultdict(list)
    domain_names: dict[str, str] = {}

    for asset in assets:
        asset_id = str(asset.get("id", ""))
        if not asset_id:
            continue
        domain_id, domain_name = _domain_key_from_asset(asset)
        domain_names[domain_id] = domain_name
        local = local_by_collibra.get(asset_id)
        local_rules = rules_by_field.get(local.id, []) if local else []
        local_trust = (
            trust_by_table.get(f"{local.database_name}|{local.table_name}") if local else None
        )
        scores = _score_collibra_asset(
            asset,
            responsibility_count=resp_map.get(asset_id, 0),
            relation_count=rel_map.get(asset_id, 0),
            local=local,
            local_rules=local_rules,
            local_trust=local_trust,
        )
        by_domain[domain_id].append(scores)

    domains = [
        _aggregate_domain(did, domain_names[did], scores, config)
        for did, scores in sorted(by_domain.items(), key=lambda x: domain_names[x[0]])
    ]
    payload = _build_collibra_payload(domains, config, len(assets))
    payload["ok"] = True
    payload["synced_at"] = datetime.now(timezone.utc).isoformat()

    row = session.get(CollibraMaturitySnapshot, "latest")
    if row is None:
        row = CollibraMaturitySnapshot(id="latest")
        session.add(row)
    row.asset_count = len(assets)
    row.domain_count = len(domains)
    row.payload = payload
    row.synced_at = datetime.now(timezone.utc)
    session.flush()
    return payload


def get_collibra_maturity(session: Session, *, domain_id: str | None = None) -> dict[str, Any]:
    row = session.get(CollibraMaturitySnapshot, "latest")
    if row is None or not row.payload:
        return {
            "ok": False,
            "source": "collibra",
            "error": "No Collibra maturity snapshot yet. Run Sync from Collibra on the Data Maturity page.",
            "framework": "gartner_data_analytics_maturity",
            "stages": GARTNER_STAGES,
            "dimension_catalog": MATURITY_DIMENSIONS,
            "domains": [],
            "config": load_maturity_config(session),
        }
    payload = dict(row.payload)
    payload["synced_at"] = row.synced_at.isoformat() if row.synced_at else None
    payload["collibra_meta"] = {
        "asset_count": row.asset_count,
        "domain_count": row.domain_count,
        "synced_at": payload.get("synced_at"),
    }
    if domain_id and domain_id != "enterprise":
        match = next((d for d in payload.get("domains", []) if d["domain_id"] == domain_id), None)
        if match:
            payload["selected"] = match
            payload["selected_domain_id"] = domain_id
    return payload


def blend_maturity(local: dict[str, Any], collibra: dict[str, Any]) -> dict[str, Any]:
    """Merge local catalog domains with Collibra domains (Collibra domains prefixed)."""
    if not collibra.get("domains"):
        local["source"] = "local"
        return local
    if not local.get("domains"):
        collibra["source"] = "collibra"
        return collibra

    domains = local["domains"] + collibra["domains"]
    config = local.get("config") or collibra.get("config") or {}
    weights = config.get("dimension_weights") or {}

    enterprise_dimensions: list[dict[str, Any]] = []
    for dim in MATURITY_DIMENSIONS:
        key = dim["key"]
        parts = [d for dom in domains for d in dom["dimensions"] if d["key"] == key]
        avg_score = round(sum(p["score"] for p in parts) / len(parts)) if parts else 0
        avg_level = round(sum(p["level"] for p in parts) / len(parts), 1) if parts else 1.0
        enterprise_dimensions.append(
            {
                **dim,
                "score": avg_score,
                "level": avg_level,
                "detail": f"Blended average: {len(local['domains'])} local + {len(collibra['domains'])} Collibra domain(s).",
            }
        )
    ent_level, ent_score = weighted_overall(enterprise_dimensions, weights)
    enterprise = {
        "domain_id": "enterprise",
        "domain_label": "Enterprise (blended)",
        "overall_level": ent_level,
        "overall_score": ent_score,
        "stage": _level_to_stage(ent_level),
        "dimensions": enterprise_dimensions,
        "stats": {
            "local_domains": len(local["domains"]),
            "collibra_domains": len(collibra["domains"]),
            "collibra_assets": collibra.get("collibra_meta", {}).get("asset_count", 0),
        },
    }
    selected = enterprise
    sel_id = local.get("selected_domain_id") or "enterprise"
    if sel_id != "enterprise":
        selected = next((d for d in domains if d["domain_id"] == sel_id), enterprise)

    return {
        **local,
        "source": "blended",
        "selected_domain_id": selected["domain_id"],
        "selected": selected,
        "enterprise": enterprise,
        "domains": domains,
        "collibra_meta": collibra.get("collibra_meta"),
        "local_domains": local["domains"],
        "collibra_domains": collibra["domains"],
    }
