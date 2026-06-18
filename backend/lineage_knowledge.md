# Lineage stitching knowledge base

AI-Assisted Data Governance uses this policy catalog (stored in `lineage_policies` and `lineage_policies.default.json`) to **stitch** upstream and downstream assets after semantic mapping.

## How stitching works

1. **Structural links** — Every saved field definition creates `database → table → column` containment edges.
2. **Policy links** — Enabled policies match columns/tables and add cross-system or report edges.
3. **Re-apply** — Run **Apply policies** on the Lineage page after new definitions or policy changes.

## Policy rule types

### structural
Built automatically from analyzed metadata. No extra edges from this policy row.

### match_full_name
Stitch columns when `column_name` or `label` matches across databases.
Use for: shared keys (`customer_id`, `patient_id`) that represent the same concept in multiple systems.

### match_logical_attribute
Stitch columns that share the same **logical data attribute name** from semantic mapping.
Use for: canonical names that differ at the physical layer (`cust_id` ↔ `customer_id`).

### match_table_name
Stitch tables with the same name across databases.
Use for: replicated subject areas (`patients`, `orders`) in staging vs production.

### keyword_to_report
Link columns to a downstream **report** node when governance keywords appear in name, definition, or classification.
Default reports:
- `report_audit` — GDPR Compliance Ledger (PII / compliance)
- `report_sales` — Sales & Revenue Dashboard (financial metrics)

## Impact analysis

When you select any node in the Lineage graph:
- **Upstream** — sources that feed this asset (database/table/column parents and stitched sources)
- **Downstream** — blast radius: tables, columns, reports, and cross-db stitches affected by a change
- **High sensitivity downstream** — count of Confidential/Restricted/high-sensitivity assets in the blast radius

## Adding policies

Use natural language on the Lineage page, for example:
- "Stitch columns when full names match across databases"
- "Route all HIPAA and patient columns to the compliance ledger"
- "Link tables with the same name between clinical_ehr and analytics_warehouse"

Policies are audited and can be previewed before apply.
