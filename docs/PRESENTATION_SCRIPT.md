# AI-Assisted Data Governance — Presentation Script (15 minutes)

Use with `./scripts/start.sh` (Mac) or `.\scripts\start.ps1` (Windows).  
In the app, open **Platform tour** from the sidebar for step-by-step prompts.

**Login:** `steward@governance.local` / `govassist`  
**Backup:** **Work offline** on login if backend fails.

---

## Before you start (2 min)

1. Run the start script — browser opens to http://127.0.0.1:5173
2. Sign in (or offline mode)
3. Confirm sidebar shows **Backend connected** (green) or use offline mode
4. Open **Platform tour** — keep it visible as your checklist

---

## Minute 0–2 — Problem & vision

**Say:**

> "Data teams spend weeks defining thousands of columns. Definitions are inconsistent, lineage is manual, and cloud LLMs are often off-limits for sensitive metadata."

**Show:** Dashboard → metrics and **Platform tour** step 1.

---

## Minute 2–5 — Enrich metadata (Semantic Mapping)

**Do:**

1. Go to **Analyze columns** (Semantic Mapping)
2. Click **Use sample data** (no file hunt)
3. Leave **Save for lineage** checked
4. Click **Generate definitions**

**Say:**

> "We upload a CSV export from any catalog. AI-Assisted Data Governance retrieves our governance policies locally, masks sample values, and drafts glossary terms, classifications, and actions — for steward review, not auto-publish."

**Show:** One column detail — definition, classification, retrieved policy sections.

---

## Minute 5–7 — Steward approval

**Do:**

1. Open **Steward Review**
2. Approve one field (e.g. `email_address`)

**Say:**

> "Every AI draft goes through human approval. Nothing lands in the catalog without a steward."

---

## Minute 7–9 — Lineage & policies

**Do:**

1. Open **Lineage**
2. Point at nested card: database → table → column → report
3. (Optional) Show **Lineage policy** panel — "stitch columns with matching names across databases"

**Say:**

> "One analysis pass builds lineage. Natural language policies stitch matching columns across systems — no separate ETL for the graph."

---

## Minute 9–11 — Quality & trust

**Do:**

1. **Data Quality** — auto-suggested rules from classifications
2. **Trust Scores** — table-level scores from approval + completeness

**Say:**

> "Downstream modules activate from the same metadata — quality rules and trust scores without a separate project phase."

---

## Minute 10–12 — Knowledge & export

**Do:**

1. **Knowledge Base** — show one policy section (or NL policy update preview)
2. **Export** — download Collibra-style CSV

**Say:**

> "Policies live in our knowledge base and power retrieval. Approved definitions export to the catalog tool you already use."

---

## Minute 12–15 — Close & ask

**Say:**

> "Everything runs locally — policies, embeddings, LLM optional. Pilot proposal: one domain, two stewards, 90 days, measure approval throughput and lineage coverage."

**Show:** **Audit Log** — traceability of analyze / approve / policy changes.

---

## Q&A shortcuts

| Question | Answer |
|----------|--------|
| Cloud LLM? | Optional Ollama on laptop; RAG-only works without LLM |
| Collibra? | CSV export today; API integration on roadmap |
| Wrong definitions? | Steward reject + edit policies in Knowledge Base |
| Backend unavailable? | **Work offline** — same UI, embedded data |

---

## Windows + Docker for Node

```powershell
.\scripts\start.ps1 -DockerUi
```

Backend runs in Python; UI runs in Docker — no native Node install.
