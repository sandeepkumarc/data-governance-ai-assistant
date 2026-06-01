# GovernAI — Product Demo UI

Official demo frontend for the Data Governance platform. A polished React SPA that connects to the existing FastAPI backend.

## Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS 4** — enterprise SaaS styling
- **React Router** — multi-page navigation
- **Lucide icons**

## New in this demo

- **Login splash** — sign in at `/login` (demo@govern.ai / demo) or **Launch offline demo**
- **Dark mode** — toggle in the top bar (moon/sun icon)
- **Offline demo data** — embedded sample definitions, lineage, trust scores, and audit trail when backend is unavailable or offline mode is enabled

## Screens

| Page | Purpose |
|------|---------|
| **Dashboard** | KPIs, trust overview, demo walkthrough entry |
| **Semantic Mapping** | CSV upload, RAG/LLM settings, definition results |
| **Steward Review** | Approve/reject workflow |
| **Lineage** | Visual DB → table → column → report graph |
| **Data Quality** | Auto-suggested rules table |
| **Trust Scores** | Completeness, accuracy, freshness breakdown |
| **Ownership** | Business owners & stewards |
| **Knowledge Base** | Create, edit, delete RAG policy sections |
| **Export** | Collibra CSV download |
| **Audit Log** | Activity trail |

## Quick start (demo)

**Terminal 1 — Backend**
```bash
cd backend
source ../.venv/bin/activate
python3 -c "from db.session import init_db; init_db()"
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Demo UI**
```bash
cd demo-ui
npm install
npm run dev
```

Open **http://localhost:5173** — you'll land on the login screen.

| Mode | How to enter |
|------|----------------|
| **Live backend** | Sign in with `demo@govern.ai` / `demo`, backend running on :8000 |
| **Offline demo** | Click **Launch offline demo** on login, or enable sidebar toggle |

The Vite dev server proxies `/api/*` to `localhost:8000`.

## Demo script (5 minutes)

1. **Dashboard** — show KPIs and platform capabilities
2. **Semantic Mapping** — upload `backend/sample_metadata.csv`, use **Vector** retrieval, click **Generate**
3. Click through result cards — highlight glossary terms, classifications, retrieved policy context
4. **Lineage** — show auto-generated graph
5. **Data Quality** — show auto-suggested rules for email, PII columns
6. **Trust Scores** — show table-level scores
7. **Steward Review** — approve one definition
8. **Export** — download Collibra CSV
9. **Audit Log** — show traceability

## Production build

```bash
npm run build
npm run preview   # serves on :4173
```

Set `VITE_API_URL` if the API is on a different host:

```bash
VITE_API_URL=https://api.example.com npm run build
```

## Optional: Ollama for full demo

```bash
ollama pull gemma4:e2b
ollama pull nomic-embed-text
```

Toggle **RAG + LLM** and **Vector (semantic)** in Semantic Mapping for the full experience.
