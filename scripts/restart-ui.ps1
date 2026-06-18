# Kill old Vite/UI processes and start AI-Assisted Data Governance web-ui on 127.0.0.1:5173.
#
# Usage:
#   .\scripts\restart-ui.ps1
#   .\scripts\restart-ui.ps1 -DockerUi
#   .\scripts\restart-ui.ps1 -Stop
#   .\scripts\restart-ui.ps1 -Status

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
$UiPidFile = Join-Path $PidDir "ui.pid"

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

function Stop-Ui {
    Write-Host "==> Stopping AI-Assisted Data Governance UI..."
    if (Test-Path $UiPidFile) {
        $procId = Get-Content $UiPidFile -ErrorAction SilentlyContinue
        if ($procId -and (Get-Process -Id $procId -ErrorAction SilentlyContinue)) {
            Write-Host "  Stopping UI PID $procId"
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $UiPidFile -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $PidFile) {
        $keep = @()
        Get-Content $PidFile | ForEach-Object {
            if ($_ -match '^(\d+)\s+(.+)$') {
                $procId = [int]$Matches[1]
                $name = $Matches[2]
                if ($name -in @("web-ui", "docker-web-ui")) {
                    if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
                        Write-Host "  Stopping $name (PID $procId)"
                        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                    }
                } else {
                    $keep += $_
                }
            }
        }
        $keep | Set-Content $PidFile
    }
    Stop-PortListener -Port $UiPort
    Push-Location $Root
    docker compose -f docker-compose.web-ui.yml down 2>$null
    Pop-Location
    Write-Host "==> Port $UiPort should be free."
}

function Show-Status {
    Write-Host "==> UI status (repo: $Root)"
    $inUse = Get-NetTCPConnection -LocalPort $UiPort -State Listen -ErrorAction SilentlyContinue
    if ($inUse) { Write-Host "  Port ${UiPort}: IN USE" } else { Write-Host "  Port ${UiPort}: free" }
    if (Test-Path $UiPidFile) { Write-Host "  ui.pid: $(Get-Content $UiPidFile)" }
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:${BackendPort}/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
        Write-Host "  Backend: up on port $BackendPort"
    } catch {
        Write-Host "  Backend: not reachable on port $BackendPort"
    }
}

function Ensure-RuntimeDirs {
    New-Item -ItemType Directory -Force -Path $LogDir, $PidDir | Out-Null
}

function Start-Ui {
    Ensure-RuntimeDirs
    $uiLog = Join-Path $LogDir "ui.log"

    if ($DockerUi) {
        Write-Host "==> Starting UI in Docker on http://127.0.0.1:${UiPort} ..."
        $dockerJob = Start-Process -FilePath "docker" `
            -ArgumentList "compose", "-f", "docker-compose.web-ui.yml", "up", "--build" `
            -WorkingDirectory $Root `
            -RedirectStandardOutput $uiLog `
            -RedirectStandardError $uiLog `
            -PassThru
        $dockerJob.Id | Out-File $UiPidFile
        if (-not (Test-Path $PidFile)) { "" | Set-Content $PidFile }
        "$($dockerJob.Id) docker-web-ui" | Add-Content $PidFile
    } else {
        $uiDir = Join-Path $Root "web-ui"
        if (-not (Test-Path (Join-Path $uiDir "node_modules"))) {
            Write-Host "==> Installing web-ui dependencies (first run)..."
            Push-Location $uiDir
            npm install
            Pop-Location
        }
        Write-Host "==> Starting Vite on http://127.0.0.1:${UiPort} ..."
        Write-Host "    API proxy -> http://127.0.0.1:$BackendPort"
        $env:VITE_DEV_HOST = "127.0.0.1"
        $env:VITE_DEV_API_PROXY = "http://127.0.0.1:$BackendPort"
        $uiJob = Start-Process -FilePath "cmd.exe" `
            -ArgumentList "/c", "npm run dev" `
            -WorkingDirectory $uiDir `
            -RedirectStandardOutput $uiLog `
            -RedirectStandardError $uiLog `
            -PassThru
        $uiJob.Id | Out-File $UiPidFile
        if (-not (Test-Path $PidFile)) { "" | Set-Content $PidFile }
        "$($uiJob.Id) web-ui" | Add-Content $PidFile
    }

    Start-Sleep -Seconds 2
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  AI-Assisted Data Governance UI restarted"
    Write-Host "  URL:     http://127.0.0.1:${UiPort}"
    Write-Host "  Logs:    $uiLog"
    Write-Host "  Stop:    .\scripts\restart-ui.ps1 -Stop"
    Write-Host "=========================================="
}

if ($Status) { Show-Status; exit 0 }
if ($Stop) { Stop-Ui; exit 0 }

Stop-Ui
Start-Ui
