# GovernAI — Windows Demo Installation Guide

Step-by-step setup for presenting the executive demo on a **Windows 10/11** laptop.

**Time required:** 45–60 minutes (first time)  
**Fallback:** Use **Offline demo** in the UI if install issues occur on demo day (no backend needed).

---

## Recommended: Node.js via Docker (no native Node install)

If your company provides **Node.js through Docker** (Docker Desktop on Windows), you do **not** need to install Node.js on the laptop.

| What | How |
|------|-----|
| **UI (React)** | Docker container — `demo-ui` |
| **Backend (Python)** | Native venv **or** Docker (see below) |
| **Ollama (optional)** | Native on Windows host |

### Option A — UI in Docker + backend native (best with Ollama on Windows)

**Prerequisites:** Docker Desktop, Python 3.11+, Git

**Terminal 1 — Backend (native Python)**

```powershell
cd $HOME\Documents\data-gov-ai-assistant
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
cd backend
python -c "from db.session import init_db; init_db()"
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Demo UI (Docker = Node.js)**

```powershell
cd $HOME\Documents\data-gov-ai-assistant
docker compose -f docker-compose.demo-ui.yml up --build
```

Open **http://localhost:5173** — login `demo@govern.ai` / `demo`

The UI container proxies `/api` to `host.docker.internal:8000` (your native backend).

### Option B — Full stack in Docker (no Python/Node on Windows)

**Prerequisites:** Docker Desktop, Git

```powershell
cd $HOME\Documents\data-gov-ai-assistant
docker compose -f docker-compose.demo.yml up --build
```

- UI: http://localhost:5173  
- Backend health: http://localhost:8000/api/health  

> **Ollama note:** With full Docker, Ollama on the Windows host is reached at `http://host.docker.internal:11434` if you add that env to the backend service later. For demo day, **Option A** is simpler when Ollama runs natively.

### Docker quick commands

```powershell
# Stop containers
docker compose -f docker-compose.demo-ui.yml down

# Rebuild after code pull
docker compose -f docker-compose.demo-ui.yml up --build

# View UI logs
docker compose -f docker-compose.demo-ui.yml logs -f demo-ui
```

---

## Alternative: native Node.js (if Docker is not used for UI)

| Software | Version | Download |
|----------|---------|----------|
| Git | Latest | https://git-scm.com/download/win |
| Python | 3.11 or 3.12 (64-bit) | https://www.python.org/downloads/ — check **"Add Python to PATH"** |
| Node.js LTS | 20.x or 22.x | https://nodejs.org/ |
| Ollama (optional) | Latest | https://ollama.com/download/windows |
| Docker Desktop (optional) | Latest | https://www.docker.com/products/docker-desktop/ |

---

## Step 1 — Clone the repository

Open **PowerShell** or **Windows Terminal**:

```powershell
cd $HOME\Documents
git clone https://github.com/sandeepkumarc/data-governance-rag-assistant.git data-gov-ai-assistant
cd data-gov-ai-assistant
```

---

## Step 2 — Python virtual environment

```powershell
cd $HOME\Documents\data-gov-ai-assistant

# Create venv
python -m venv .venv

# Activate (PowerShell)
.\.venv\Scripts\Activate.ps1
```

If activation is blocked:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\.venv\Scripts\Activate.ps1
```

Install backend dependencies:

```powershell
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
pip install -r requirements-streamlit.txt
```

Verify:

```powershell
python -c "import sqlalchemy, fastapi; print('Python OK')"
```

---

## Step 3 — Initialize the database

```powershell
cd backend
python -c "from db.session import init_db; init_db()"
cd ..
```

This creates `backend\data\governance.db` (local only, not committed to git).

---

## Step 4 — Install Ollama (optional but recommended)

1. Download and install from https://ollama.com/download/windows
2. Open a **new** terminal after install
3. Pull models:

```powershell
ollama pull gemma4:e2b
ollama pull nomic-embed-text
ollama list
```

4. Verify API:

```powershell
curl http://localhost:11434/api/tags
```

Ollama runs as a Windows service after install. Keep it running during the demo.

**Skip Ollama if:** You will use **Offline demo** or **RAG-only mode** (`no_llm: true`).

---

## Step 5 — Start the backend (Terminal 1)

```powershell
cd $HOME\Documents\data-gov-ai-assistant
.\.venv\Scripts\Activate.ps1
cd backend
python -m uvicorn main:app --reload --port 8000
```

Leave this window open. Verify:

- Browser: http://localhost:8000/api/health  
- Expected: `{"status":"ok","app":"data-governance-backend"}`

---

## Step 6 — Start the demo UI (Terminal 2)

**If using Docker for Node.js** (recommended on Windows):

```powershell
cd $HOME\Documents\data-gov-ai-assistant
docker compose -f docker-compose.demo-ui.yml up --build
```

**If using native Node.js:**

Open a **second** terminal:

```powershell
cd $HOME\Documents\data-gov-ai-assistant\demo-ui
npm install
npm run dev
```

Open browser: **http://localhost:5173**

---

## Step 7 — Login & demo mode

| Option | Steps |
|--------|-------|
| **Full live demo** | Sign in: `demo@govern.ai` / `demo` (backend must be running) |
| **Offline demo (safest)** | Click **Launch offline demo** on login — works without backend/Ollama |

---

## Step 8 — Pre-demo smoke test (5 min)

With backend running:

```powershell
curl http://localhost:8000/api/health
curl http://localhost:8000/api/knowledge-base/sections
```

In the UI:

1. Dashboard loads with metrics
2. Semantic Mapping → upload `backend\sample_metadata.csv` → Generate
3. Knowledge Base → NL update preview works
4. Steward Review → approve one item
5. Export → download CSV

---

## Executive demo day checklist

Print this section:

- [ ] Laptop charged, power adapter packed
- [ ] Git repo up to date (`git pull`)
- [ ] Terminal 1: backend running (`uvicorn` on :8000)
- [ ] Terminal 2: demo UI running (Docker `docker-compose.demo-ui.yml` **or** `npm run dev` on :5173)
- [ ] Ollama app running (if using LLM/vector)
- [ ] Browser bookmark: http://localhost:5173
- [ ] Backup: know how to click **Launch offline demo**
- [ ] Sample file ready: `backend\sample_metadata.csv`
- [ ] Deck open: `docs\EXECUTIVE_DEMO_DECK.md`

---

## Troubleshooting (Windows)

### `python` not found
Reinstall Python with **"Add to PATH"** checked, or use `py -3.12` instead of `python`.

### Port 8000 already in use
```powershell
netstat -ano | findstr :8000
taskkill /PID <pid> /F
```

### `ModuleNotFoundError: sqlalchemy`
Ensure venv is activated (prompt shows `(.venv)`):
```powershell
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

### `npm` not found
Use **Docker for the UI** instead (no native Node required):
```powershell
docker compose -f docker-compose.demo-ui.yml up --build
```
Or install Node.js LTS and restart terminal.

### Docker Desktop not running
Start **Docker Desktop** from the Start menu, wait until it shows "Running", then retry `docker compose`.

### UI loads but API calls fail (Docker UI + native backend)
Ensure backend is on port 8000 and use `docker-compose.demo-ui.yml` (proxies to `host.docker.internal:8000`).

### Backend returns 500 on analyze with persist
Re-run database init:
```powershell
cd backend
python -c "from db.session import init_db; init_db()"
```

### Ollama models not listed
```powershell
ollama serve
# In another window:
ollama pull nomic-embed-text
```

### Corporate proxy / firewall
- Allow localhost ports **5173**, **8000**, **11434**
- If npm install fails: `npm config set registry https://registry.npmjs.org/`

### PowerShell curl shows errors
Use real curl or browser for API tests. JSON pipe:
```powershell
curl.exe http://localhost:8000/api/health
```

---

## Production build (optional — serve UI without dev server)

**With Docker:**

```powershell
cd demo-ui
docker build -t governai-demo-ui .
docker run --rm -p 4173:4173 governai-demo-ui npm run build && npm run preview -- --host 0.0.0.0 --port 4173
```

**With native Node:**

```powershell
cd demo-ui
npm run build
npm run preview
```

Preview serves on http://localhost:4173 — still needs backend on :8000.

---

## Environment variables (Windows)

Set in PowerShell session before starting backend:

```powershell
$env:GOVERNANCE_API_KEY = "your-key-here"   # optional
$env:DATABASE_URL = "sqlite:///./data/governance.db"  # default; avoid postgres unless configured
```

---

## Uninstall / cleanup

```powershell
# Remove venv
Remove-Item -Recurse -Force .venv

# Remove node modules
Remove-Item -Recurse -Force demo-ui\node_modules

# Remove local DB
Remove-Item backend\data\governance.db
```

---

## Related docs

- Executive deck: `docs\EXECUTIVE_DEMO_DECK.md`
- Project continuity: `docs\PROJECT_HANDOFF.md`
- Demo UI details: `demo-ui\README.md`
