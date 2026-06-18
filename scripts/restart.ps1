# Kill old AI-Assisted Data Governance processes and start backend (8000) + React UI (5173).
# Repo: C:\Users\<you>\Documents\data-gov-ai-assistant
#
# Usage:
#   .\scripts\restart.ps1
#   .\scripts\restart.ps1 -DockerUi
#   .\scripts\restart.ps1 -Stop
#   .\scripts\restart.ps1 -Status

param(
    [switch]$DockerUi,
    [switch]$Stop,
    [switch]$Status
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BackendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { 8000 }
$UiPort = if ($env:UI_PORT) { $env:UI_PORT } else { 5173 }
$LogDir = Join-Path $Root ".runtime-logs"
$PidDir = Join-Path $Root ".runtime\pids"
$PidFile = Join-Path $Root ".runtime-pids.txt"
$LegacyPidFile = Join-Path $Root ".demo-pids"
if ((Test-Path $LegacyPidFile) -and -not (Test-Path $PidFile)) {
    Move-Item $LegacyPidFile $PidFile -Force
} elseif (Test-Path $LegacyPidFile) {
    Remove-Item $LegacyPidFile -Force -ErrorAction SilentlyContinue
}
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"

function Stop-PortListener {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $procId = $c.OwningProcess
        if ($procId) {
            Write-Host "  Stopping port $Port (PID $procId)"
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Stop-Services {
    Write-Host "==> Stopping AI-Assisted Data Governance processes..."
    if (Test-Path $PidFile) {
        Get-Content $PidFile | ForEach-Object {
            if ($_ -match '^(\d+)\s+(.+)$') {
                $procId = [int]$Matches[1]
                if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
                    Write-Host "  Stopping $($Matches[2]) (PID $procId)"
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                }
            }
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $PidDir) {
        Get-ChildItem $PidDir -Filter "*.pid" -ErrorAction SilentlyContinue | ForEach-Object {
            $procId = Get-Content $_.FullName -ErrorAction SilentlyContinue
            if ($procId -and (Get-Process -Id $procId -ErrorAction SilentlyContinue)) {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
        }
    }
    Stop-PortListener -Port $BackendPort
    Stop-PortListener -Port $UiPort
    Push-Location $Root
    docker compose -f docker-compose.web-ui.yml down 2>$null
    Pop-Location
    Write-Host "==> Ports $BackendPort and $UiPort should be free."
}

function Show-Status {
    Write-Host "==> Service port status (repo: $Root)"
    foreach ($port in @($BackendPort, $UiPort)) {
        $inUse = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($inUse) { Write-Host "  Port ${port}: IN USE" } else { Write-Host "  Port ${port}: free" }
    }
}

function Start-Services {
    if (-not (Test-Path $VenvPython)) {
        Write-Host "ERROR: Missing $VenvPython"
        Write-Host "  cd $Root; python -m venv .venv; .\.venv\Scripts\Activate.ps1"
        Write-Host "  pip install -r backend\requirements.txt httpx"
        exit 1
    }

    New-Item -ItemType Directory -Force -Path $LogDir, $PidDir | Out-Null
    "" | Set-Content $PidFile

    & $VenvPython -m pip install -q -r (Join-Path $Root "backend\requirements.txt") httpx

    Write-Host "==> Initializing SQLite (if needed)..."
    Push-Location (Join-Path $Root "backend")
    & $VenvPython -c "from db.session import init_db; init_db()"
    Pop-Location

    Write-Host "==> Starting API on http://127.0.0.1:${BackendPort} ..."
    $backendLog = Join-Path $LogDir "backend.log"
    $backendJob = Start-Process -FilePath $VenvPython `
        -ArgumentList "-m", "uvicorn", "main:app", "--reload", "--host", "127.0.0.1", "--port", "$BackendPort" `
        -WorkingDirectory (Join-Path $Root "backend") `
        -RedirectStandardOutput $backendLog `
        -RedirectStandardError $backendLog `
        -PassThru
    "$($backendJob.Id) backend" | Add-Content $PidFile
    $backendJob.Id | Out-File (Join-Path $PidDir "backend.pid")

    Write-Host "==> Waiting for API health..."
    $healthy = $false
    for ($i = 0; $i -lt 40; $i++) {
        try {
            Invoke-WebRequest -Uri "http://127.0.0.1:${BackendPort}/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
            $healthy = $true
            Write-Host "  API is up."
            break
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $healthy) { Write-Host "WARN: API slow to start. Check $backendLog" }

    if ($DockerUi) {
        Write-Host "==> Starting UI in Docker on http://127.0.0.1:${UiPort} ..."
        $uiLog = Join-Path $LogDir "ui.log"
        $dockerJob = Start-Process -FilePath "docker" `
            -ArgumentList "compose", "-f", "docker-compose.web-ui.yml", "up", "--build" `
            -WorkingDirectory $Root `
            -RedirectStandardOutput $uiLog `
            -RedirectStandardError $uiLog `
            -PassThru
        "$($dockerJob.Id) docker-web-ui" | Add-Content $PidFile
    } else {
        $uiDir = Join-Path $Root "web-ui"
        if (-not (Test-Path (Join-Path $uiDir "node_modules"))) {
            Write-Host "==> Installing web-ui dependencies (first run)..."
            Push-Location $uiDir
            npm install
            Pop-Location
        }
        Write-Host "==> Starting UI on http://127.0.0.1:${UiPort} ..."
        $env:VITE_DEV_HOST = "127.0.0.1"
        $env:VITE_DEV_API_PROXY = "http://127.0.0.1:$BackendPort"
        $uiLog = Join-Path $LogDir "ui.log"
        $uiJob = Start-Process -FilePath "cmd.exe" `
            -ArgumentList "/c", "npm run dev" `
            -WorkingDirectory $uiDir `
            -RedirectStandardOutput $uiLog `
            -RedirectStandardError $uiLog `
            -PassThru
        "$($uiJob.Id) web-ui" | Add-Content $PidFile
        $uiJob.Id | Out-File (Join-Path $PidDir "ui.pid")
    }

    Start-Sleep -Seconds 2
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  AI-Assisted Data Governance restarted"
    Write-Host "  Repo:    $Root"
    Write-Host "  UI:      http://127.0.0.1:${UiPort}"
    Write-Host "  API:     http://127.0.0.1:${BackendPort}/api/health"
    Write-Host "  Login:   steward@governance.local / steward"
    Write-Host "  Logs:    $LogDir\"
    Write-Host "  Stop:    .\scripts\restart.ps1 -Stop"
    Write-Host "=========================================="
}

if ($Status) { Show-Status; exit 0 }
if ($Stop) { Stop-Services; exit 0 }

Stop-Services
Start-Services
