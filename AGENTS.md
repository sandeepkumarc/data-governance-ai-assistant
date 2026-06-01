# Agent instructions — GovernAI / codex-python

When working in this repository, **read first:**

1. [`docs/PROJECT_HANDOFF.md`](docs/PROJECT_HANDOFF.md) — architecture, completed features, known issues, next steps
2. [`docs/EXECUTIVE_DEMO_DECK.md`](docs/EXECUTIVE_DEMO_DECK.md) — if the task involves demos or executives
3. [`docs/WINDOWS_DEMO_INSTALL.md`](docs/WINDOWS_DEMO_INSTALL.md) — if the task involves Windows setup

## Project summary

Local-first **data governance platform** (GovernAI): FastAPI backend + React demo UI + RAG over `backend/governance_knowledge.md` + optional Ollama LLM/embeddings.

## Key commands

```bash
# Backend
cd backend && source ../.venv/bin/activate
python -c "from db.session import init_db; init_db()"
uvicorn main:app --reload --port 8000

# Demo UI
cd demo-ui && npm install && npm run dev   # http://localhost:5173

# Tests
./test_platform.sh
```

## Do not commit unless asked

- `backend/data/*.db`, `.env`, `.venv/`, `demo-ui/node_modules/`, secrets

## User context (June 2026)

Preparing **executive demo at current company**. Platform is demo-ready with offline mode fallback.
