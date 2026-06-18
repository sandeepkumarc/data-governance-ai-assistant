# Governing principles guide

How stewards and governance leads add **governing principles** on the **Governance Readiness** page (`/trust`) without memorizing syntax.

## What principles do

- Score each **table** for governance readiness (steward workflow — not warehouse profiling).
- Feed the **Data Maturity** radar (`/data-maturity`, **Local catalog** tab) via automatic pillar mapping.
- Stored in SQLite table `governance_principles`, seeded from `backend/governance_principles.default.json`.

## Recommended: add from catalog

1. Open **Governance Readiness** → expand **Governing principles**.
2. **Add from catalog** — the dropdown shows `Scorer name → Maturity pillar`.
3. Click **Add principle**; enable (**On**) and set **Wt** (weight) if needed.
4. Click **Recompute scores** (page header).
5. Open **Data Maturity** → **Local catalog** → **Refresh**.

No special instructions or syntax required.

## Plain-English natural language

Expand **Add principle in natural language**, describe the rule, then **Preview** or **Apply & recompute**.

| Keywords in your text | Scorer / pillar |
|----------------------|-----------------|
| glossary, business term | Metadata & definitions |
| PII, classification, sensitive | Security & classification |
| steward, owner, assigned | Governance & stewardship |
| data quality, DQ, passed | Data quality |
| recent, updated, activity | Operational readiness |
| approve, approval | Governance & stewardship |

**Examples**

- `Require glossary terms on all financial columns`
- `All PII columns must have a data classification assigned`
- `Every column needs a data steward assigned before export`

Optional: enable **Use Ollama** for richer parsing when Ollama is running locally.

## Optional: custom name and pillar

```
Finance glossary coverage -> Metadata & definitions
PII masking rule -> Security & classification
Weekly steward review -> Operational readiness
```

Left side = principle display name. Right side = maturity pillar (plain label is fine).

## Scorer → pillar reference

| Catalog scorer | Maturity pillar |
|----------------|-----------------|
| Approved definitions | Metadata & definitions |
| Glossary terms linked | Metadata & definitions |
| Steward approvals | Governance & stewardship |
| Ownership assigned | Governance & stewardship |
| DQ rule stewardship | Data quality |
| Sensitive data classified | Security & classification |
| Policy citations present | Security & classification |
| Recent steward activity | Operational readiness |

**Lineage & traceability** on the radar uses lineage graph signals today — there is no lineage principle scorer in the catalog yet.

Pillar assignment is **automatic** from scorer type when you add a principle. To override mappings, use `PATCH /api/data-maturity/config` with `axis_principle_map` (UI editor not available yet).

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Principle not in list | Use **Apply & recompute** (not Preview only); restart backend after upgrades |
| Wrong display name | Use catalog add, or `Name -> Pillar` syntax for NL |
| Not on Data Maturity radar | **Local catalog** tab + **Refresh**; principles ignored on Collibra-only view |
| Radar shape unchanged | New principle may duplicate an existing scorer (same %); improve catalog data or add a different scorer type |

## API (automation)

- `GET /api/governance/principles` — list principles and catalog
- `POST /api/governance/principles` — add from catalog payload
- `POST /api/governance/principles/nl-update` — natural language add
- `POST /api/governance/principles/recompute` — refresh readiness scores
