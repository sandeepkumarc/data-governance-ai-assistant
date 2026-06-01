# GovernAI — Executive Demo Deck

**Audience:** CDO, VP Data, CIO, enterprise architects, data governance leaders  
**Duration:** 15–20 minutes (+ 5 min Q&A)  
**Presenter:** Data governance / platform team  
**Live demo:** GovernAI UI at `http://localhost:5173` (offline mode works without backend)

---

## Slide 1 — Title

**GovernAI: AI-Assisted Data Governance**

*Accelerate metadata enrichment, classification, and stewardship — locally and under your control.*

- Prototype / pilot-ready platform
- Built for stewards; designed for executive visibility
- No cloud LLM required for demo (local Ollama optional)

**Speaker note:** Frame this as a **decision-support accelerator**, not auto-publishing to production catalogs.

---

## Slide 2 — The problem executives feel

| Pain | Business impact |
|------|-----------------|
| Thousands of undocumented columns | Slow analytics, audit findings, mistrust in reports |
| Inconsistent definitions (`cust_id` vs `customer_id`) | Broken lineage, duplicate KPIs |
| Manual stewardship backlog | Months to onboard new datasets |
| PII/financial fields under-classified | Regulatory and reputational risk |

**Quote to use:** *"We have the data. We don't have agreed meaning, ownership, or trust."*

---

## Slide 3 — What GovernAI does (one sentence)

Upload field metadata → AI retrieves **your policies** → drafts **glossary definitions, classifications, and controls** → stewards **review and approve** → export to catalog tools.

```text
Metadata CSV  →  Policy knowledge (RAG)  →  Draft governance  →  Human approval  →  Catalog export
```

---

## Slide 4 — Architecture (keep it simple)

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  GovernAI UI    │────▶│  FastAPI backend │────▶│  governance.db      │
│  (React demo)   │     │  + RAG engine    │     │  (definitions,      │
└─────────────────┘     └────────┬─────────┘     │   lineage, audit)   │
                                 │               └─────────────────────┘
                                 ▼
                        ┌──────────────────┐
                        │ Ollama (local)   │  optional: LLM + embeddings
                        │ gemma4 + nomic   │
                        └──────────────────┘
                                 │
                                 ▼
                        governance_knowledge.md  ← your policies & aliases
```

**Key message:** Policies stay **yours**. Inference can stay **on-prem**.

---

## Slide 5 — Differentiators for leadership

1. **Policy-grounded** — answers come from your knowledge base, not generic ChatGPT
2. **Steward-in-the-loop** — every definition goes to review/approval workflow
3. **Semantic matching** — understands `cust_id` ≈ `customer_id`, `dob` ≈ `date_of_birth` (vector RAG)
4. **Natural language policy updates** — stewards edit governance rules in plain English
5. **Downstream automation** — lineage, quality rules, trust scores, Collibra export
6. **Full audit trail** — who analyzed, approved, and exported what

---

## Slide 6 — Live demo flow (15 min script)

| Min | Screen | What to say |
|-----|--------|-------------|
| 0–2 | Login → Dashboard | "Command center for definitions pending review and trust scores" |
| 2–5 | Semantic Mapping | Upload sample CSV, enable **Vector**, generate definitions |
| 5–7 | Knowledge Base | Show alias policy; **NL update**: "Add cust_nbr as customer identifier alias" |
| 7–9 | Steward Review | Approve one field — human gate before production |
| 9–11 | Lineage + Quality + Trust | "One upload drives graph, DQ rules, and trust metrics" |
| 11–13 | Export | Collibra-compatible CSV — fits existing catalog investments |
| 13–15 | Audit Log | "Regulators and internal audit ask for this" |

**Fallback:** If live backend fails → **Launch offline demo** on login (embedded data).

---

## Slide 7 — Demo data story (narrative)

Use **`backend/sample_metadata.csv`** — customer profile + payments:

- `email_address` → Confidential / PII
- `customer_id` → Restricted identifier
- `payment_token` → Restricted financial surrogate
- `salary` → HR/financial sensitivity

**Talk track:** *"In 30 seconds we got a first-pass glossary term, classification, and recommended controls — a steward still approves."*

---

## Slide 8 — Security & compliance talking points

| Topic | Position |
|-------|----------|
| Data residency | Metadata + samples processed locally; no required cloud LLM |
| PII in samples | Masked before retrieval/LLM (`[CONTACT_VALUE]`, etc.) |
| Human approval | Definitions default to `pending_review` |
| Audit | All analyze / approve / NL policy changes logged |
| API access | Optional `GOVERNANCE_API_KEY` header |

**Honest caveat:** Prototype — not yet enterprise IAM, SSO, or production HA.

---

## Slide 9 — ROI framing (directional)

**Before:** Steward documents 1 field ≈ 15–30 min manually  
**After:** Platform drafts 25 fields in minutes; steward reviews batch  

**Value levers:**
- Faster onboarding of new sources (M&A, lakehouse migrations)
- Consistent classifications across domains
- Reduced audit remediation cost
- Higher catalog adoption (trust scores make gaps visible)

*Use your org's steward hourly cost × fields backlogged for a custom ROI slide.*

---

## Slide 10 — Integration path

| Today (prototype) | Next (production) |
|-------------------|-------------------|
| Collibra CSV export | Collibra / Alation API push |
| SQLite metadata store | PostgreSQL / enterprise DB |
| Local Ollama | GPU cluster or approved enterprise LLM |
| File-based knowledge | Git-backed policy + approval workflow |

---

## Slide 11 — What we are asking leadership for

1. **Sponsor** — executive owner for a 90-day pilot
2. **Stewards** — 2–3 domain stewards for weekly feedback
3. **Policy content** — export existing standards into knowledge base
4. **One pilot dataset** — real metadata CSV (masked samples OK)
5. **Success criteria** — e.g. 500 fields reviewed, 80% steward acceptance rate

---

## Slide 12 — Recommended pilot timeline

```text
Week 1–2   Install, load policies, train stewards
Week 3–4   Pilot dataset (500–2000 columns)
Week 5–6   Review accuracy, tune knowledge + aliases
Week 7–8   Export to catalog, measure trust score uplift
Week 9–12  Production roadmap decision
```

---

## Slide 13 — Risks & mitigations

| Risk | Mitigation |
|------|------------|
| LLM hallucination | RAG + steward approval; RAG-only mode available |
| Wrong classification | Retrieved policy context shown; steward rejects |
| Abbreviated column names | Alias knowledge section + vector retrieval |
| IT install friction | Offline demo mode; Windows install guide in repo |

---

## Slide 14 — Q&A prep

**"Is this replacing Collibra?"**  
No — it **feeds** the catalog with draft definitions stewards approve.

**"Can we use Azure OpenAI?"**  
Architecture supports provider swap; current demo uses local Ollama.

**"How accurate is it?"**  
Pilot measures steward accept/edit/reject rates — target 70%+ accept with minor edits.

**"What does IT need to install?"**  
Python, Node, optional Ollama — see `docs/WINDOWS_DEMO_INSTALL.md`.

---

## Slide 15 — Close

**GovernAI turns governance policy into scalable metadata enrichment — with humans in control.**

**Next step:** Approve a 90-day steward pilot on one business domain.

**Contact / repo:** [Your team name] · `docs/PROJECT_HANDOFF.md` for technical continuity

---

## Appendix — Login & URLs

| Item | Value |
|------|-------|
| Demo UI | http://localhost:5173 |
| API / Swagger | http://localhost:8000/docs |
| Login | `demo@govern.ai` / `demo` |
| Offline demo | "Launch offline demo" button (no install needed) |
| Smoke tests | `./test_platform.sh` (Mac/Linux) |
