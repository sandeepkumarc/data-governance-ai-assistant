# Agent instructions — AI-Assisted Data Governance

**Canonical repository:** `/Users/sandeepchintakunta/Documents/data-gov-ai-assistant`

Do **not** add or maintain project code in `codex-python`. All AI-Assisted Data Governance work happens in this repo.

When working here, **read first:**

1. [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md) — architecture, completed features, known issues, next steps
2. [`docs/EXECUTIVE_OVERVIEW.md`](docs/EXECUTIVE_OVERVIEW.md) — if the task involves executive overview or stakeholder walkthroughs
3. [`docs/WINDOWS_INSTALL.md`](docs/WINDOWS_INSTALL.md) — if the task involves Windows setup

## Project summary

Local-first **data governance platform** (AI-Assisted Data Governance): FastAPI backend + React web UI + RAG over `backend/governance_knowledge.md` + optional Ollama LLM/embeddings.

## Key commands

```bash
# From repo root
./scripts/restart.sh          # API :8000 + UI :5173

# Or manually:
cd backend && source ../.venv/bin/activate
unset DATABASE_URL                 # use SQLite unless Postgres is intentional
python -c "from db.session import init_db; init_db()"
uvicorn main:app --reload --port 8000

cd web-ui && npm install && npm run dev   # http://127.0.0.1:5173
```

## Knowledge bases

| Purpose | Location |
|---------|----------|
| Semantic mapping / classifications | `backend/governance_knowledge.md` |
| Lineage stitching (docs) | `backend/lineage_knowledge.md` |
| Lineage stitching (rules) | SQLite `lineage_policies` table (seed: `lineage_policies.default.json`) — see `docs/LINEAGE_POLICIES_GUIDE.md` |

## Do not commit unless asked

- `backend/data/*.db`, `.env`, `.venv/`, `web-ui/node_modules/`, secrets
