# Setup Guide — Clone, Install, and Run

Step-by-step instructions for **macOS** and **Windows** to clone AI-Assisted Data Governance, start the app, and sign in.

**Time:** ~30–45 minutes first time · **15 minutes** after that

---

## What you get

| Service | URL | Purpose |
|---------|-----|---------|
| **Web UI** | http://127.0.0.1:5173 | Main application |
| **API** | http://127.0.0.1:8000/api/health | Backend health check |

**Login (live mode):**

| Email | Password |
|-------|----------|
| `steward@governance.local` | `steward` |

**No login needed:** click **Work offline** on the login page (sample data only, no backend).

---

## Prerequisites

### macOS

| Software | Version | Install |
|----------|---------|---------|
| Git | Latest | Xcode Command Line Tools or [git-scm.com](https://git-scm.com/) |
| Python | 3.11 or 3.12 | [python.org](https://www.python.org/downloads/) or `brew install python@3.12` |
| Node.js | 20.x or 22.x LTS | [nodejs.org](https://nodejs.org/) or `brew install node` |
| Ollama (optional) | Latest | [ollama.com](https://ollama.com/) — for full AI drafts |

### Windows

| Software | Version | Install |
|----------|---------|---------|
| Git | Latest | [git-scm.com/download/win](https://git-scm.com/download/win) — includes **Git Bash** |
| Python | 3.11 or 3.12 (64-bit) | [python.org](https://www.python.org/downloads/) — check **Add Python to PATH** |
| Node.js **or** Docker Desktop | Node 20+ **or** Docker | Node: [nodejs.org](https://nodejs.org/) · Docker: [docker.com](https://www.docker.com/products/docker-desktop/) |
| Ollama (optional) | Latest | [ollama.com/download/windows](https://ollama.com/download/windows) |

> **Windows without Node.js:** use **Docker for the UI** (Option B below). You only need Python + Docker.

---

## Step 1 — Clone the repository

### macOS (Terminal)

```bash
cd ~/Documents
git clone https://github.com/sandeepkumarc/data-governance-ai-assistant.git data-gov-ai-assistant
cd data-gov-ai-assistant
```

### Windows (Git Bash)

```bash
cd ~/Documents
git clone https://github.com/sandeepkumarc/data-governance-ai-assistant.git data-gov-ai-assistant
cd data-gov-ai-assistant
```

### Windows (PowerShell)

```powershell
cd $HOME\Documents
git clone https://github.com/sandeepkumarc/data-governance-ai-assistant.git data-gov-ai-assistant
cd data-gov-ai-assistant
```

---

## Step 2 — Python environment and dependencies

### macOS

```bash
cd ~/Documents/data-gov-ai-assistant

python3 -m venv .venv
source .venv/bin/activate

pip install --upgrade pip
pip install -r backend/requirements.txt
```

Verify:

```bash
python -c "import fastapi, sqlalchemy; print('Python OK')"
```

### Windows (Git Bash)

```bash
cd ~/Documents/data-gov-ai-assistant

python -m venv .venv
source .venv/Scripts/activate

pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Windows (PowerShell)

```powershell
cd $HOME\Documents\data-gov-ai-assistant

python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install --upgrade pip
pip install -r backend/requirements.txt
```

If PowerShell blocks activation:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\.venv\Scripts\Activate.ps1
```

---

## Step 3 — Initialize the database

Run once (creates `backend/data/governance.db` locally — not committed to git):

### macOS / Git Bash

```bash
cd backend
python -c "from db.session import init_db; init_db()"
cd ..
```

### PowerShell

```powershell
cd backend
python -c "from db.session import init_db; init_db()"
cd ..
```

---

## Step 4 — Install web UI dependencies (native Node only)

Skip this step if you use **Docker for the UI** (Windows Option B).

### macOS

```bash
cd ~/Documents/data-gov-ai-assistant/web-ui
npm install
cd ..
```

### Windows (Git Bash) — only if `npm -v` works

```bash
cd ~/Documents/data-gov-ai-assistant/web-ui
npm install
cd ..
```

If `npm: command not found` in Git Bash, either install Node.js and reopen Git Bash, or use **Step 5 Option B (Docker UI)**.

---

## Step 5 — Start the application

### macOS — one command (recommended)

```bash
cd ~/Documents/data-gov-ai-assistant
chmod +x scripts/restart.sh
./scripts/restart.sh
```

Open **http://127.0.0.1:5173**

**Other macOS commands:**

```bash
./scripts/restart.sh --status   # check ports
./scripts/restart.sh --stop     # stop API + UI
tail -f .runtime-logs/backend.log .runtime-logs/ui.log
```

### macOS — manual (two terminals)

**Terminal 1 — API**

```bash
cd ~/Documents/data-gov-ai-assistant
source .venv/bin/activate
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — UI**

```bash
cd ~/Documents/data-gov-ai-assistant/web-ui
npm run dev
```

---

### Windows Option A — PowerShell one command (native Node)

```powershell
cd $HOME\Documents\data-gov-ai-assistant
.\scripts\restart.ps1
```

Open **http://127.0.0.1:5173**

**Other PowerShell commands:**

```powershell
.\scripts\restart.ps1 -Status
.\scripts\restart.ps1 -Stop
.\scripts\restart.ps1 -DockerUi    # UI in Docker (no native Node)
```

---

### Windows Option B — Git Bash + Docker UI (no npm required)

**Tab 1 — API (Git Bash)**

```bash
cd ~/Documents/data-gov-ai-assistant
source .venv/Scripts/activate
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Tab 2 — UI in Docker (Git Bash)**

```bash
cd ~/Documents/data-gov-ai-assistant
docker compose -f docker-compose.web-ui.yml up --build
```

Open **http://127.0.0.1:5173**

> Or from Git Bash, call PowerShell to start everything with Docker UI:
> ```bash
> powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/restart.ps1 -DockerUi
> ```

---

### Windows Option C — Git Bash from PowerShell script

If Node is installed but not visible in Git Bash:

```bash
cd ~/Documents/data-gov-ai-assistant
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/restart.ps1
```

---

## Step 6 — Sign in and verify

1. Open **http://127.0.0.1:5173**
2. Sign in:
   - **Email:** `steward@governance.local`
   - **Password:** `steward`
3. Or click **Work offline** (no backend needed)

**Smoke test (live mode):**

```bash
curl http://127.0.0.1:8000/api/health
```

Expected: `{"status":"ok","app":"AI-Assisted Data Governance"}`

**In the UI:**

1. **Dashboard** loads
2. **Analyze** → upload `backend/sample_metadata.csv` → Generate
3. **Monitor → Lineage** → graph appears after saving definitions
4. **Monitor → Governance health** → Readiness / Principles / Maturity tabs

---

## Step 7 — Optional: Ollama (local AI)

For full LLM drafts and richer NL policy parsing:

```bash
# macOS / Windows — after installing Ollama
ollama pull gemma4:e2b
ollama pull nomic-embed-text
ollama list
```

Verify: `curl http://localhost:11434/api/tags`

Skip Ollama if you use **Work offline** or **Quick draft (no LLM)** modes.

---

## Step 8 — Pull updates later

### macOS / Git Bash

```bash
cd ~/Documents/data-gov-ai-assistant
git pull
source .venv/bin/activate          # macOS
# source .venv/Scripts/activate    # Git Bash on Windows
pip install -r backend/requirements.txt
cd web-ui && npm install && cd ..  # skip if using Docker UI
./scripts/restart.sh               # macOS
# powershell.exe -File scripts/restart.ps1   # Windows
```

---

## Troubleshooting

### “This site can’t be reached” / connection refused

- **UI (5173):** UI is not running — start with `npm run dev`, Docker compose, or `restart.ps1`
- **API (8000):** Backend is not running — start uvicorn or `restart.sh` / `restart.ps1`
- Use **http://127.0.0.1:5173** for the app (not port 8000 alone)

### macOS: `permission denied` on scripts

```bash
chmod +x scripts/*.sh
```

### Windows: `npm` not found in Git Bash

Use **Docker UI** (Step 5 Option B) or install Node.js and reopen Git Bash:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
```

### Windows: port already in use

```bash
netstat -ano | grep :8000
netstat -ano | grep :5173
taskkill //PID <pid> //F
```

### Invalid login

Use exactly: `steward@governance.local` / `steward` (not `govassist`).

### UI loads but API calls fail

Ensure backend is running on port 8000. With Docker UI, backend must be native on the host (Docker proxies to `host.docker.internal:8000`).

### Python / module errors

Activate the venv first, then reinstall:

```bash
pip install -r backend/requirements.txt
cd backend && python -c "from db.session import init_db; init_db()"
```

---

## Quick reference

| Action | macOS | Windows (PowerShell) | Windows (Git Bash + Docker) |
|--------|-------|----------------------|-----------------------------|
| Start all | `./scripts/restart.sh` | `.\scripts\restart.ps1` | API in bash + `docker compose -f docker-compose.web-ui.yml up` |
| Stop | `./scripts/restart.sh --stop` | `.\scripts\restart.ps1 -Stop` | Ctrl+C in both tabs |
| Status | `./scripts/restart.sh --status` | `.\scripts\restart.ps1 -Status` | `curl` health URLs |
| Activate venv | `source .venv/bin/activate` | `.\.venv\Scripts\Activate.ps1` | `source .venv/Scripts/activate` |

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [QUICKSTART.md](../QUICKSTART.md) | Short command cheat sheet |
| [WINDOWS_INSTALL.md](./WINDOWS_INSTALL.md) | Extended Windows / Docker details |
| [PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md) | Architecture and feature map |
| [EXECUTIVE_OVERVIEW.md](./EXECUTIVE_OVERVIEW.md) | Stakeholder walkthrough |
