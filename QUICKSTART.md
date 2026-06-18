# AI-Assisted Data Governance — Quick Start

## One command

### Mac / Linux

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

### Windows (PowerShell)

```powershell
.\scripts\start.ps1
```

### Windows — Node.js via Docker (no native Node)

```powershell
.\scripts\start.ps1 -DockerUi
```

### Stop services

```bash
./scripts/start.sh --stop
```

```powershell
.\scripts\start.ps1 -Stop
```

### Restart for testing (kills ports 8000 + 5173, then starts fresh)

Use this when old `uvicorn` / `vite` processes are still running:

```bash
cd ~/Documents/data-gov-ai-assistant
chmod +x scripts/restart.sh
./scripts/restart.sh
```

```powershell
cd $HOME\Documents\data-gov-ai-assistant
.\scripts\restart.ps1
```

```bash
./scripts/restart.sh --stop     # kill only
./scripts/restart.sh --status   # check ports
tail -f .runtime-logs/backend.log .runtime-logs/ui.log
```

Windows Docker UI: `.\scripts\restart.ps1 -DockerUi`

### UI only (Vite on 5173 — leaves backend alone)

```bash
./scripts/restart-ui.sh
./scripts/restart-ui.sh --stop
./scripts/restart-ui.sh --docker-web-ui
```

```powershell
.\scripts\restart-ui.ps1
.\scripts\restart-ui.ps1 -Stop
.\scripts\restart-ui.ps1 -DockerUi
```

---

## Browser

- **URL:** http://127.0.0.1:5173
- **Login:** `steward@governance.local` / `govassist`
- **In-app tour:** Sidebar → **Platform tour**
- **Presenter script (private):** [docs/PRESENTATION_SCRIPT.md](docs/PRESENTATION_SCRIPT.md)

---

## Offline fallback

On the login page → **Work offline** (no backend or Ollama required).

---

## More detail

- [docs/WINDOWS_INSTALL.md](docs/WINDOWS_INSTALL.md)
- [docs/EXECUTIVE_OVERVIEW.md](docs/EXECUTIVE_OVERVIEW.md)
- [docs/KNOWLEDGE_BASE_GUIDE.md](docs/KNOWLEDGE_BASE_GUIDE.md) — add policy content for better citations
