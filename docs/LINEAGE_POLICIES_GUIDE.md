# Lineage Policies Guide — How Stitching Works Behind the Graph

Lineage in AI-Assisted Data Governance combines **structural links** (from saved semantic mapping) with **policy links** (rules you configure). This guide explains where policies live, how the engine runs, and how to extend them — similar to the governance knowledge base for RAG.

---

## What lineage policies power

| Feature | How policies are used |
|---------|----------------------|
| **Lineage graph** | Adds edges beyond database → table → column (cross-db stitches, column → report) |
| **Path / blast radius** | Policy edges appear in upstream/downstream traversal and impact counts |
| **Cross-system stitches** | Shown when two columns are linked by `match_full_name` or `match_logical_attribute` |
| **Report routing** | `keyword_to_report` connects sensitive/financial columns to report nodes |
| **Natural language authoring** | Plain-English instructions become new policy rows |

Structural containment is always created when you **Analyze columns** with **Save to database**. Policies run on top of that graph.

---

## Where policies live

| Environment | Location |
|-------------|----------|
| **Runtime (active)** | SQLite table `lineage_policies` in `backend/data/governance.db` |
| **First-time seed** | `backend/lineage_policies.default.json` |
| **Legacy import (once)** | `backend/data/lineage_policies.json` if present when DB is empty |
| **Human-readable catalog** | `backend/lineage_knowledge.md` (documentation only; not parsed at runtime) |
| **Offline UI** | Default policy list in browser memory — NL updates require live backend |

Policies are **local**. Nothing is fetched from the internet.

---

## Pipeline: what runs when

```
Analyze CSV + Save to database
        │
        ▼
Field definitions + structural lineage nodes/edges
        │
        ▼
apply_lineage_policies()  ◄── auto on save, or "Apply policies" on Lineage page
        │
        ▼
Policy edges merged into lineage graph (SQLite lineage_nodes / lineage_edges)
```

1. **Semantic mapping with save** — creates `FieldDefinition` rows and `database → table → column` edges.
2. **Policy engine** — iterates enabled policies, matches nodes/definitions, upserts edges.
3. **Re-apply** — use **Apply policies** after bulk imports, policy edits, or NL additions.

---

## Policy rule types

### `structural`
Documents that containment comes from analyze. The engine does not add edges for this row; structure is built in `platform_sync`.

### `match_full_name`
Groups columns by normalized `column_name` / `label`. When two or more match and `cross_database` is true, links anchor → target with edge label (default: `same full name`).

**Use when:** physical names align (`customer_id` in CRM and finance).

### `match_logical_attribute`
Groups columns by **logical data attribute name** from semantic mapping (requires analyzed definitions).

**Use when:** physical names differ but semantic mapping assigned the same logical attribute.

### `match_table_name`
Same as column matching but for **table** nodes (`table_name`, `label`).

**Use when:** replicated subject areas across databases (`patients`, `orders`).

### `keyword_to_report`
Scans column metadata + linked field definition text for keywords; adds edge to a **report** node id.

Default report targets in seed file:
- `report_audit` — GDPR Compliance Ledger
- `report_sales` — Sales & Revenue Dashboard

**Config example:**

```json
{
  "rule_type": "keyword_to_report",
  "config": {
    "keywords": ["hipaa", "patient", "mrn"],
    "report_id": "report_audit",
    "edge_label": "PII scan target"
  }
}
```

---

## Four ways to manage policies

### 1. Lineage page — natural language (recommended)

1. **Data Lineage** → expand **Lineage stitching knowledge base**
2. Enter instruction (or use example chips)
3. **Preview** → review proposed policy JSON
4. **Apply & stitch** → saves policy and re-runs engine

Examples:
- *Stitch columns when full names match across databases*
- *Route all patient and HIPAA columns to the compliance ledger*
- *Link tables with the same name between clinical_ehr and analytics_warehouse*

Optional: enable **Use Ollama** for richer parsing; heuristics work without LLM.

### 2. Apply policies button

Re-runs all **enabled** policies against the current graph and definitions. Use after:
- New analyze/save batch
- Editing policies via API
- Restoring database from backup

### 3. Default seed file

Edit `backend/lineage_policies.default.json` **before** first database initialization (empty `lineage_policies` table). On first `init_db`, templates are copied into SQLite.

To reset in dev: delete `backend/data/governance.db` and re-run `init_db()` (loses all catalog data).

### 4. HTTP API

```bash
# List policies
curl -s http://127.0.0.1:8000/api/lineage/policies

# Re-apply all enabled policies
curl -X POST http://127.0.0.1:8000/api/lineage/policies/apply

# Natural language create/update
curl -X POST http://127.0.0.1:8000/api/lineage/policies/nl-update \
  -H "Content-Type: application/json" \
  -d '{"instruction": "Route all token and password columns to the compliance ledger", "dry_run": true}'
```

Set `"apply_after": true` and `"dry_run": false` to persist and stitch.

---

## Default policies (seed)

| Name | rule_type | Purpose |
|------|-----------|---------|
| Structural hierarchy | structural | Documentation only |
| Stitch columns by matching full name | match_full_name | Cross-db same column name |
| Stitch by logical attribute name | match_logical_attribute | Semantic logical attribute |
| Stitch tables by matching name | match_table_name | Cross-db same table name |
| PII columns to compliance ledger | keyword_to_report | PII/confidential → audit report |
| Financial columns to revenue dashboard | keyword_to_report | Payment/revenue → sales report |

---

## How to verify stitching

1. Run **Analyze** with **Save to database** on a CSV with overlapping column names or PII fields.
2. Open **Data Lineage** → **Apply policies** if needed.
3. Switch to **Path** view; select a column.
4. Confirm:
   - **Cross-system stitches** section for column-to-column policy links
   - Downstream **report** nodes for keyword policies
   - Impact panel **Policy-stitched links** count

Policy edges often use labels like `same full name`, `same logical attribute`, `PII scan target`, `revenue links`.

---

## Relationship to governance knowledge base

| | Governance KB | Lineage policies |
|---|---------------|------------------|
| **Purpose** | RAG / classifications / citations | Graph stitching / impact paths |
| **Storage** | `governance_knowledge.md` | `lineage_policies` table |
| **NL update** | Knowledge Base page | Lineage page |
| **Affects** | Analyze recommendations | Lineage graph edges |

Both are local-first and steward-controlled. Good semantic mapping (logical attributes, classifications) improves **both** retrieval and keyword-based lineage routing.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| No graph at all | Analyze with Save to database |
| Structure but no cross-db links | Enable `match_full_name` / `match_logical_attribute`; click Apply policies |
| No report links | Report node ids must exist; keywords must appear in column name, classification, or definition |
| NL policy not applied | Live backend required; check preview summary and audit log |
| Policies missing after upgrade | DB already seeded — edit via NL or API, not only default JSON |
