#!/usr/bin/env pwsh
# =============================================================================
#  Reel Maker - One-Shot Project Launcher
#  Run this script to start ALL project services at once.
#
#  Usage:
#    .\start.ps1                  # Normal start (dev mode)
#    .\start.ps1 -NoBrowser       # Don't auto-open browser
#    .\start.ps1 -NoChatterbox    # Skip Chatterbox TTS server
#    .\start.ps1 -Mode prod       # Use production build instead of dev
#    .\start.ps1 -SkipBuild       # Don't rebuild before starting (prod mode only)
# =============================================================================

param(
    [switch]$NoBrowser     = $false,
    [switch]$NoChatterbox  = $false,
    [switch]$SkipBuild     = $false,
    [ValidateSet("dev","prod")]
    [string]$Mode          = "dev"
)

# =============================================================================
#  CONFIGURATION BLOCK
#  Edit values here to plug in new services without touching anything else.
# =============================================================================

$CONFIG = @{

    # ── Core Ports ───────────────────────────
    BackendPort       = 3001          # Express API server
    FrontendPort      = 3005          # Vite dev server
    ChatterboxPort    = 8002          # Chatterbox 500M TTS (Python FastAPI)

    # ── Python Environment ────────────────────
    PythonCmd         = "python"      # Change to "python3" or full venv path if needed
    PythonEnvActivate = ""            # e.g. ".\venv\Scripts\Activate.ps1" or leave empty

    # ── Paths ─────────────────────────────────
    WorkspaceDir      = ".\workspace"
    LogDir            = ".\logs"

    # ── Browser ───────────────────────────────
    BrowserUrl        = "http://localhost:3005"
    BrowserOpenDelay  = 5             # seconds to wait before opening browser

    # ── Build ─────────────────────────────────
    BuildCmd          = "npm run build"
    DevBackendCmd     = "npm run dev:backend"
    DevFrontendCmd    = "npm run dev:frontend"

    # ==========================================================================
    #  PLUG & PLAY EXTRA SERVICES
    #  Add any future external service here. It will be auto-started, health
    #  checked, and shown in the status table alongside the core services.
    #
    #  Each entry is a hashtable with:
    #    Name     = "Human-readable service name"
    #    Enabled  = $true or $false          (toggle without deleting the entry)
    #    Port     = <port number>            (0 = skip port health check)
    #    Cmd      = "full command to run"    (runs via cmd /c)
    #    WaitSec  = <seconds to wait for port> (default 20)
    # ==========================================================================
    ExtraServices = @(

        # ── Wan2GP AI Video Generator (disabled until integrated) ──────────────
        # @{
        #   Name    = "Wan2GP Video Gen"
        #   Enabled = $false
        #   Port    = 7860
        #   Cmd     = "python scripts\wan2gp_server.py --port 7860"
        #   WaitSec = 30
        # },

        # ── Local Whisper API Server ───────────────────────────────────────────
        # @{
        #   Name    = "Whisper Local API"
        #   Enabled = $false
        #   Port    = 8003
        #   Cmd     = "python scripts\whisper_server.py --port 8003"
        #   WaitSec = 20
        # },

        # ── MuAPI Background Music Server ─────────────────────────────────────
        # @{
        #   Name    = "MuAPI Music Server"
        #   Enabled = $false
        #   Port    = 8004
        #   Cmd     = "python scripts\muapi_server.py --port 8004"
        #   WaitSec = 15
        # }
    )
}

# =============================================================================
#  HELPER FUNCTIONS
# =============================================================================

function Write-Banner {
    Write-Host ""
    Write-Host "  =====================================================================" -ForegroundColor Cyan
    Write-Host "   REEL MAKER  -  AI Reel Factory  -  One-Shot Launcher" -ForegroundColor Cyan
    Write-Host "  =====================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Log-Info  { param($msg) Write-Host "  [INFO]  $msg" -ForegroundColor White }
function Log-OK    { param($msg) Write-Host "  [ OK ]  $msg" -ForegroundColor Green }
function Log-Warn  { param($msg) Write-Host "  [WARN]  $msg" -ForegroundColor Yellow }
function Log-Error { param($msg) Write-Host "  [ERR ]  $msg" -ForegroundColor Red }
function Log-Step  { param($msg) Write-Host "`n  ── $msg ─────────────────────────────" -ForegroundColor Magenta }

function Free-Port {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
             Where-Object { $_.OwningProcess -gt 0 }
    if ($conns) {
        $pids = ($conns | Select-Object -ExpandProperty OwningProcess -Unique)
        foreach ($p in $pids) {
            try {
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                Log-Warn "Freed port $Port (killed PID $p)"
            } catch {}
        }
        Start-Sleep -Milliseconds 600
    }
}

function Wait-Port {
    param([int]$Port, [int]$TimeoutSec = 30, [string]$Label = "service")
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", $Port)
            $tcp.Close()
            Log-OK "$Label is up on :$Port"
            return $true
        } catch {}
        Start-Sleep -Seconds 1
        $elapsed++
    }
    Log-Warn "$Label did not respond on :$Port within ${TimeoutSec}s"
    return $false
}

function Ensure-Dir {
    param([string]$Dir)
    if (-not (Test-Path $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    }
}

function Is-PortOpen {
    param([int]$Port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $Port)
        $tcp.Close()
        return $true
    } catch { return $false }
}

# =============================================================================
#  MAIN LAUNCH SEQUENCE
# =============================================================================

Write-Banner

# Navigate to project root (where this script lives)
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot -or $ProjectRoot -eq "") {
    $ProjectRoot = (Get-Location).Path
}
Set-Location $ProjectRoot
Log-Info "Project root: $ProjectRoot"

Ensure-Dir $CONFIG.LogDir
Ensure-Dir $CONFIG.WorkspaceDir

# ─────────────────────────────────────────────
Log-Step "PREFLIGHT CHECKS"
# ─────────────────────────────────────────────

# Node / npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Log-Error "npm not found! Install Node.js from https://nodejs.org and try again."
    exit 1
}
$nodeVer = (node --version 2>&1)
$npmVer  = (npm --version 2>&1)
Log-OK "Node.js $nodeVer  /  npm $npmVer"

# ffmpeg
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Log-Warn "ffmpeg not found in PATH. Video rendering may fail!"
} else {
    Log-OK "FFmpeg available"
}

# Python
$hasPython = $false
if (Get-Command $CONFIG.PythonCmd -ErrorAction SilentlyContinue) {
    $pyVer = (& $CONFIG.PythonCmd --version 2>&1)
    Log-OK "Python: $pyVer"
    $hasPython = $true
} else {
    Log-Warn "Python ('$($CONFIG.PythonCmd)') not found — Chatterbox TTS will be skipped."
    $NoChatterbox = $true
}

# .env check
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Log-Warn ".env not found — copied from .env.example. Edit .env with your real API keys!"
    } else {
        Log-Error ".env missing and no .env.example to copy. Please create .env."
        exit 1
    }
} else {
    Log-OK ".env found"
}

# ─────────────────────────────────────────────
Log-Step "FREEING PORTS"
# ─────────────────────────────────────────────

Free-Port $CONFIG.BackendPort
Free-Port $CONFIG.FrontendPort
if (-not $NoChatterbox) { Free-Port $CONFIG.ChatterboxPort }
foreach ($svc in $CONFIG.ExtraServices) {
    if ($svc.Enabled -and $svc.Port -gt 0) { Free-Port $svc.Port }
}
Log-OK "Port cleanup done"

# ─────────────────────────────────────────────
Log-Step "NPM INSTALL CHECK"
# ─────────────────────────────────────────────

if (-not (Test-Path "node_modules")) {
    Log-Info "node_modules not found — running npm install (this may take a minute)..."
    npm install
    if ($LASTEXITCODE -ne 0) { Log-Error "npm install failed!"; exit 1 }
    Log-OK "npm install complete"
} else {
    Log-OK "node_modules present — skipping install"
}

# ─────────────────────────────────────────────
Log-Step "BUILD"
# ─────────────────────────────────────────────

if ($Mode -eq "prod" -and -not $SkipBuild) {
    Log-Info "Production mode — building TypeScript + Vite..."
    Invoke-Expression $CONFIG.BuildCmd
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Build failed! Fix TypeScript errors above and retry."
        exit 1
    }
    Log-OK "Build complete"
} elseif ($Mode -eq "dev") {
    Log-OK "Dev mode — tsx hot-reload active, skipping production build"
} else {
    Log-Warn "Skipping build (-SkipBuild flag)"
}

# ─────────────────────────────────────────────
Log-Step "STARTING SERVICES"
# ─────────────────────────────────────────────

$logBackend    = Join-Path $CONFIG.LogDir "backend.log"
$logFrontend   = Join-Path $CONFIG.LogDir "frontend.log"
$logChatterbox = Join-Path $CONFIG.LogDir "chatterbox.log"

# Activate Python venv if configured
if ($CONFIG.PythonEnvActivate -ne "" -and (Test-Path $CONFIG.PythonEnvActivate)) {
    Log-Info "Activating Python virtual environment: $($CONFIG.PythonEnvActivate)"
    & $CONFIG.PythonEnvActivate
}

# ── 1. Backend (Express API) ──────────────────
Log-Info "Starting backend Express API on :$($CONFIG.BackendPort)..."
Start-Process -NoNewWindow -FilePath "cmd" `
    -ArgumentList "/c $($CONFIG.DevBackendCmd) > `"$logBackend`" 2>&1"

$backendOk = Wait-Port -Port $CONFIG.BackendPort -TimeoutSec 20 -Label "Backend API"

# ── 2. Frontend (Vite Dev or Static Serve) ────
Log-Info "Starting frontend on :$($CONFIG.FrontendPort)..."
if ($Mode -eq "dev") {
    Start-Process -NoNewWindow -FilePath "cmd" `
        -ArgumentList "/c $($CONFIG.DevFrontendCmd) > `"$logFrontend`" 2>&1"
} else {
    Start-Process -NoNewWindow -FilePath "cmd" `
        -ArgumentList "/c npx serve dist --listen $($CONFIG.FrontendPort) > `"$logFrontend`" 2>&1"
}
$frontendOk = Wait-Port -Port $CONFIG.FrontendPort -TimeoutSec 30 -Label "Frontend"

# ── 3. Chatterbox TTS Server (Python FastAPI) ─
$chatterboxOk = $false
if (-not $NoChatterbox) {
    Log-Info "Starting Chatterbox 500M TTS on :$($CONFIG.ChatterboxPort)..."
    $cbCmd = "$($CONFIG.PythonCmd) scripts\chatterbox_server.py --port $($CONFIG.ChatterboxPort)"
    Start-Process -NoNewWindow -FilePath "cmd" `
        -ArgumentList "/c $cbCmd > `"$logChatterbox`" 2>&1"
    # HTTP is up fast; model loads in background thread (takes ~10-30s on first run)
    $chatterboxOk = Wait-Port -Port $CONFIG.ChatterboxPort -TimeoutSec 15 -Label "Chatterbox TTS"
    if (-not $chatterboxOk) {
        Log-Warn "Chatterbox server started but model still loading — check logs\chatterbox.log"
    }
} else {
    Log-Warn "Chatterbox TTS skipped"
}

# ── 4. Plug & Play Extra Services ────────────
foreach ($svc in $CONFIG.ExtraServices) {
    if (-not $svc.Enabled) {
        Log-Info "[$($svc.Name)] is disabled in config — skipping"
        continue
    }
    $svcLog     = Join-Path $CONFIG.LogDir ("$($svc.Name -replace '[^a-zA-Z0-9]','_').log")
    $svcWait    = if ($svc.WaitSec) { $svc.WaitSec } else { 20 }
    Log-Info "Starting [$($svc.Name)] ..."
    Start-Process -NoNewWindow -FilePath "cmd" `
        -ArgumentList "/c $($svc.Cmd) > `"$svcLog`" 2>&1"
    if ($svc.Port -gt 0) {
        Wait-Port -Port $svc.Port -TimeoutSec $svcWait -Label $svc.Name | Out-Null
    }
}

# ─────────────────────────────────────────────
Log-Step "LAUNCH SUMMARY"
# ─────────────────────────────────────────────

Write-Host ""
Write-Host "  +--------------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |                   REEL MAKER  -  SERVICE STATUS                   |" -ForegroundColor Cyan
Write-Host "  +--------------------------+-----------------------------------------+" -ForegroundColor Cyan

$rows = @(
    @{ Name="Backend API";    Ok=$backendOk;    Detail="http://localhost:$($CONFIG.BackendPort)  -> logs\backend.log" },
    @{ Name="Frontend UI";    Ok=$frontendOk;   Detail="http://localhost:$($CONFIG.FrontendPort)  -> logs\frontend.log" },
    @{ Name="Chatterbox TTS"; Ok=$chatterboxOk; Detail="http://localhost:$($CONFIG.ChatterboxPort)  -> logs\chatterbox.log" }
)
foreach ($svc in $CONFIG.ExtraServices) {
    if ($svc.Enabled) {
        $rows += @{ Name=$svc.Name; Ok=(Is-PortOpen -Port $svc.Port); Detail="http://localhost:$($svc.Port)" }
    }
}
foreach ($row in $rows) {
    $icon  = if ($row.Ok) { "OK  " } else { "WARN" }
    $color = if ($row.Ok) { "Green" } else { "Yellow" }
    Write-Host "  |  [$icon]  $(($row.Name).PadRight(20))| $($row.Detail)" -ForegroundColor $color
}
Write-Host "  +--------------------------+-----------------------------------------+" -ForegroundColor Cyan
Write-Host ""

if (-not $NoBrowser -and $frontendOk) {
    Log-Info "Opening browser in $($CONFIG.BrowserOpenDelay)s..."
    Start-Sleep -Seconds $CONFIG.BrowserOpenDelay
    Start-Process $CONFIG.BrowserUrl
}

Write-Host "  Logs are in: .\logs\" -ForegroundColor Cyan
Write-Host "  All services are running in background windows." -ForegroundColor Cyan
Write-Host "  Close this window or press Ctrl+C to exit the launcher." -ForegroundColor DarkGray
Write-Host ""
