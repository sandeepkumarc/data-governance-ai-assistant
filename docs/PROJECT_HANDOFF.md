# AI-Assisted Data Governance — Project Handoff & Continuation Memory

> **Purpose:** Single source of truth for humans and AI assistants. Read this file first when resuming work or planning next steps.

**Last updated:** June 2026  
**Canonical repo:** `/Users/sandeepchintakunta/Documents/data-gov-ai-assistant` (AI-Assisted Data Governance)  
**Do not develop in:** `codex-python` (deprecated mirror — all changes belong here)  
**Status:** Production-ready governance platform

---

## 1. What this project is

**AI-Assisted Data Governance** is a local-first **data governance assistant** that:

- Ingests CSV field metadata (database, table, column, type, samples, notes)
- Retrieves relevant sections from **`backend/governance_knowledge.md`** (RAG)
- Masks sensitive sample values before processing
- Drafts glossary terms, classifications, sensitivity, governance actions
- Persists definitions, lineage, quality rules, trust scores, audit log
- Supports steward approval workflow and Collibra CSV export
- Lineage stitching knowledge base: `backend/lineage_knowledge.md` + `lineage_policies` DB table (seeded from `lineage_policies.default.json`)

**Not in scope yet:** Production SSO, automated DQ execution, enterprise vector DB (Pinecone/pgvector).

---

## 2. Architecture (current)

```text
web-ui (React, :5173)  →  FastAPI backend (:8000)  →  SQLite governance.db
                              ↓
                         rag_governance.py
                              ↓
                    governance_knowledge.md
                              ↓
                    Ollama (:11434) — optional
                      • gemma4:e2b (LLM)
                      • nomic-embed-text (embeddings)
```

**Legacy UI:** `streamlit_rag_app.py` still works via `governance_api_client.py`.

---

## 3. Key directories & files

| Path | Role |
|------|------|
| `backend/main.py` | FastAPI app entry |
| `backend/rag_governance.py` | RAG engine, TF-IDF + vector retrieval, Ollama calls |
| `backend/governance_knowledge.md` | **Live policy knowledge base** |
| `backend/services/knowledge.py` | KB section CRUD (markdown read/write) |
| `backend/services/knowledge_nl.py` | Natural language policy updates via LLM |
| `backend/services/semantic_mapping.py` | Analyze/upload pipeline |
| `backend/services/vector_store.py` | Embedding cache in `knowledge_embeddings` table |
| `backend/data/governance.db` | SQLite (gitignored) — init via `init_db()` |
| `web-ui/` | **AI-Assisted Data Governance web frontend (AI-Assisted Data Governance)** |
| `web-ui/src/data/sampleData.ts` | AI-Assisted Data Governance (offline) embedded data |
| `governance_api_client.py` | Python HTTP client for Streamlit |
| `streamlit_rag_app.py` | Streamlit UI (8 tabs) |
| `test_platform.sh` | End-to-end smoke tests (30 checks) |
| `docs/EXECUTIVE_OVERVIEW.md` | Executive presentation |
| `docs/WINDOWS_INSTALL.md` | Windows setup guide |

---

## 4. Completed features (by phase)

### Phase 1 — Backend refactor
- Routers + services split from monolithic `main.py`

### Phase 2 — Persistence
- SQLite default, PostgreSQL via `DATABASE_URL`
- Definitions, audit, ownership APIs

### Phase 3 — Streamlit → FastAPI client
- Streamlit uses HTTP client, not direct `rag_governance` import

### Phase 4 — Live modules
- Lineage graph, auto quality rules, trust scores, platform_sync

### Phase 5 — Production-oriented features
- Vector embeddings (`retrieval_mode: vector`)
- Collibra CSV/JSON export
- Optional API key auth (`GOVERNANCE_API_KEY`)

### Phase 6 — AI-Assisted Data Governance web UI (`web-ui/`)
- AI-Assisted Data Governance branded React SPA, 10 screens
- Login splash, dark mode, offline mode
- Knowledge Base CRUD UI

### Phase 7 — Knowledge management
- API: GET/POST/PUT/DELETE `/api/knowledge-base/sections`
- **Column Aliases And Abbreviations** section in KB
- **NL policy update:** `POST /api/knowledge-base/nl-update`

---

## 5. API endpoints (quick reference)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Health check |
| `POST /api/analyze-metadata` | JSON field analysis |
| `POST /api/upload-metadata` | CSV upload |
| `GET/POST/PUT/DELETE /api/knowledge-base/sections` | KB CRUD |
| `POST /api/knowledge-base/nl-update` | Natural language policy edit |
| `GET /api/definitions` | List definitions |
| `PATCH /api/definitions/{id}/approve` | Steward approval |
| `GET /api/lineage` | Lineage graph |
| `GET /api/quality-rules` | DQ rules |
| `GET /api/trust-scores` | Trust metrics |
| `GET /api/export/collibra` | Catalog export |
| `GET /api/audit-log` | Audit trail |

Swagger: http://localhost:8000/docs

---

## 6. Deployment modes

| Mode | When to use | Requirements |
|------|-------------|--------------|
| **Full live** | Best live presentation | Backend + UI + Ollama |
| **Live without LLM** | Fast, reliable | Backend + UI, `no_llm: true` |
| **AI-Assisted Data Governance (offline)** | No install / backup | UI only → "Work offline" |
| **Vector semantic** | Abbreviation matching | + `nomic-embed-text`, `retrieval_mode: vector` |

**Default sign-in:** `steward@governance.local` / `govassist`

---

## 7. Known issues & gotchas

1. **Empty `governance.db`** → run `python -c "from db.session import init_db; init_db()"` from `backend/`
2. **`ModuleNotFoundError: sqlalchemy`** → use `.venv` Python 3.13: `pip install -r backend/requirements.txt`
3. **`DATABASE_URL=postgresql://...`** without Postgres running → unset env var for SQLite
4. **Port 8000 in use** → kill old uvicorn or change port
5. **Vector mode needs DB session** — backend must be running with persistence
6. **NL policy update** needs Ollama for rich edits; `no_llm: true` only appends text heuristically
7. **Root `rag_governance.py`** vs **`backend/rag_governance.py`** — backend is canonical for API; root is CLI legacy

---

## 8. How to run (Mac/Linux quick)

```bash
# Terminal 1 — Backend
cd backend && source ../.venv/bin/activate
python -c "from db.session import init_db; init_db()"
uvicorn main:app --reload --port 8000

# Terminal 2 — Web UI
cd web-ui && npm install && npm run dev

# Optional — Ollama
ollama pull gemma4:e2b && ollama pull nomic-embed-text
```

Windows: see **`docs/WINDOWS_INSTALL.md`**

Tests: `./test_platform.sh`

---

## 9. Presentation script (short)

1. Login → Dashboard (KPIs)
2. Semantic Mapping — upload `backend/clinical_ehr_patients.csv` (table export), vector mode, generate
3. Knowledge Base — NL update: *"Add cust_nbr as customer identifier alias"*
4. Steward Review — approve one definition
5. Lineage → Quality → Trust
6. Export Collibra CSV
7. Audit Log

Full deck: **`docs/EXECUTIVE_OVERVIEW.md`**

---

## 10. Recommended next steps (prioritized)

### For pilot (next 2–4 weeks)
- [ ] Load **real company policies** into knowledge base (replace sample content)
- [ ] Run pilot on **one domain CSV** (500+ columns, masked samples)
- [ ] Measure steward accept/reject/edit rates
- [ ] Add company logo / branding to web-ui login
- [ ] PostgreSQL for shared team environment

### For production roadmap
- [ ] SSO / Azure AD login (replace default login)
- [ ] Collibra REST API push (not just CSV)
- [ ] pgvector or enterprise vector store at scale
- [ ] Automated tests in CI (GitHub Actions)
- [ ] Docker Compose (backend + UI + optional Ollama)
- [ ] Email/Slack notifications on `pending_review`
- [ ] Bulk steward approve in UI

### Technical debt
- [ ] Sync root `rag_governance.py` with `backend/rag_governance.py` or remove root copy
- [ ] Convert `test_platform.sh` to pytest for CI
- [ ] Add Knowledge NL update to Streamlit UI

---

## 11. Git upload checklist

Before pushing to company Git:

```bash
# Verify .gitignore excludes secrets & artifacts
cat .gitignore   # .env, *.db, .venv, node_modules should be listed

# Do NOT commit
# - backend/data/governance.db
# - .env files with API keys
# - web-ui/node_modules/
# - .venv/ or venv/

# Safe to commit
git add backend/ web-ui/src web-ui/public web-ui/package.json web-ui/package-lock.json
git add web-ui/vite.config.ts web-ui/tsconfig.json web-ui/index.html web-ui/README.md
git add docs/ test_platform.sh governance_api_client.py streamlit_rag_app.py
git add README.md WALKTHROUGH.md

git status   # review
git commit -m "Add AI-Assisted Data Governance governance platform with docs and Windows install guide"
git push origin <branch>
```

**Add to `.gitignore` if missing:** `web-ui/node_modules/`, `web-ui/dist/`

---

## 12. Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | SQLite in `backend/data/` | DB connection |
| `GOVERNANCE_API_KEY` | empty | Optional API auth |
| `GOVERNANCE_EMBEDDING_MODEL` | `nomic-embed-text` | Vector embeddings |
| `GOVERNANCE_RETRIEVAL_MODE` | `tfidf` | Default retrieval |
| `GOVERNANCE_API_URL` | — | Streamlit/client override |
| `VITE_API_URL` | — | Web UI build-time API URL |

---

## 13. For AI assistants resuming this work

When the user asks **"what's next?"** or **"continue where we left off"**:

1. Read this file
2. Check `git status` and whether backend/UI are running
3. Refer to **Section 10** for prioritized backlog
4. Executive presentation materials are in **`docs/EXECUTIVE_OVERVIEW.md`**
5. Windows setup is in **`docs/WINDOWS_INSTALL.md`**
6. Do not commit unless explicitly asked
7. Prefer `web-ui` for live presentations, Streamlit for steward dev testing

**Conversation context (June 2026):** Built full platform through Phase 7; fixed SQLite/venv/Ollama issues; added test_platform.sh; user preparing **executive presentation at current company**.

---

## 14. Contact placeholders (fill in before exec meeting)

| Role | Name | Email |
|------|------|-------|
| Executive sponsor | __________ | __________ |
| Data steward lead | __________ | __________ |
| Platform / IT contact | __________ | __________ |
| Pilot domain | __________ | __________ |
