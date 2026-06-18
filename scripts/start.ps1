# AI-Assisted Data Governance — one-command local start (Windows PowerShell)
# Usage:
#   .\scripts\start.ps1                 # Python backend + native Node UI
#   .\scripts\start.ps1 -DockerUi       # Python backend + UI in Docker (no native Node)
#   .\scripts\start.ps1 -Stop           # Stop runtime processes

param(
    [switch]$DockerUi,
    [switch]$Stop
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PidFile = Join-Path $Root ".runtime-pids.txt"
$BackendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { "8000" }
$UiPort = if ($env:UI_PORT) { $env:UI_PORT } else { "5173" }

function Stop-Services {
    $restartScript = Join-Path $Root "scripts\restart.ps1"
    if (Test-Path $restartScript) {
        & $restartScript -Stop
        return
    }
    if (Test-Path $PidFile) {
        Get-Content $PidFile | ForEach-Object {
            if ($_ -match '^(\d+)\s+(.+)$') {
                $procId = [int]$Matches[1]
                $name = $Matches[2]
                $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
                if ($p) {
                    Write-Host "Stopping $name (pid $procId)"
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                }
            }
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
    Push-Location $Root
    docker compose -f docker-compose.web-ui.yml down 2>$null
    Pop-Location
    Write-Host "Services stopped."
}

if ($Stop) {
    Stop-Services
    exit 0
}

Stop-Services
"" | Set-Content $PidFile

Set-Location $Root

if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment..."
    python -m venv .venv
}
& .\.venv\Scripts\Activate.ps1
python -m pip install -q -r backend\requirements.txt httpx

Write-Host "Initializing database..."
Push-Location backend
python -c "from db.session import init_db; init_db()"
Pop-Location

Write-Host "Starting backend on http://127.0.0.1:$BackendPort ..."
$backendJob = Start-Process -FilePath "python" `
    -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", $BackendPort, "--reload" `
    -WorkingDirectory (Join-Path $Root "backend") `
    -PassThru -WindowStyle Normal
"$($backendJob.Id) backend" | Add-Content $PidFile
Start-Sleep -Seconds 3

try {
    Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/api/health" -UseBasicParsing | Out-Null
    Write-Host "Backend OK"
} catch {
    Write-Host "Warning: backend health check failed — use AI-Assisted Data Governance (offline) if needed"
}

if ($DockerUi) {
    Write-Host "Starting UI in Docker on http://127.0.0.1:$UiPort ..."
    $dockerJob = Start-Process -FilePath "docker" `
        -ArgumentList "compose", "-f", "docker-compose.web-ui.yml", "up", "--build" `
        -WorkingDirectory $Root `
        -PassThru -WindowStyle Normal
    "$($dockerJob.Id) docker-web-ui" | Add-Content $PidFile
} else {
    if (-not (Test-Path "web-ui\node_modules")) {
        Write-Host "Installing UI dependencies..."
        Push-Location web-ui
        npm install
        Pop-Location
    }
    Write-Host "Starting UI on http://127.0.0.1:$UiPort ..."
    $env:VITE_DEV_HOST = "127.0.0.1"
    $env:VITE_DEV_API_PROXY = "http://127.0.0.1:$BackendPort"
    $uiJob = Start-Process -FilePath "npm" `
        -ArgumentList "run", "dev" `
        -WorkingDirectory (Join-Path $Root "web-ui") `
        -PassThru -WindowStyle Normal
    "$($uiJob.Id) web-ui" | Add-Content $PidFile
}

Start-Sleep -Seconds 4

Write-Host ""
Write-Host "=============================================="
Write-Host "  AI-Assisted Data Governance is running"
Write-Host "  UI:      http://127.0.0.1:$UiPort"
Write-Host "  API:     http://127.0.0.1:$BackendPort/api/health"
Write-Host "  Login:   steward@governance.local / steward"
Write-Host "  Tour:    Sidebar -> Platform tour"
Write-Host "  Stop:    .\scripts\start.ps1 -Stop"
Write-Host "=============================================="
Write-Host ""

Start-Process "http://127.0.0.1:$UiPort"
