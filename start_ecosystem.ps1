# start_ecosystem.ps1
# =====================================================================
# ACS Ecosystem Launcher — Windows PowerShell
# Inicia todos los servicios del Adaptive Commercial System:
#   • Streamlit App (puerto 8501)
#   • Ingestion Monitor (puerto 8502)
#   • Next.js Frontend (puerto 8080) — opcional si existe package.json
#
# Uso:
#   .\start_ecosystem.ps1
#   .\start_ecosystem.ps1 -Mode streamlit     # Solo Streamlit
#   .\start_ecosystem.ps1 -Mode all           # Todos los servicios
#   .\start_ecosystem.ps1 -Detach             # En background (no espera)
# =====================================================================

param(
    [ValidateSet("all","streamlit","nextjs","monitor")]
    [string]$Mode = "all",
    [switch]$Detach
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  ADAPTIVE COMMERCIAL SYSTEM — Ecosystem Launcher"       -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Directorio: $RepoRoot"
Write-Host "  Modo: $Mode"
Write-Host "  Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# ── Detect Python ────────────────────────────────────────────────
$PythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($LASTEXITCODE -eq 0) { $PythonCmd = $cmd; break }
    } catch {}
}
if (-not $PythonCmd) {
    Write-Host "[ERROR] Python no encontrado en PATH." -ForegroundColor Red
    Write-Host "        Instala Python 3.8+ desde https://python.org" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host "[OK] Python: $PythonCmd ($((& $PythonCmd --version 2>&1)))" -ForegroundColor Green

# ── Load .env ────────────────────────────────────────────────────
$EnvFile = Join-Path $RepoRoot ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^([^#=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
        }
    }
    Write-Host "[OK] .env cargado" -ForegroundColor Green
} else {
    Write-Host "[WARN] .env no encontrado — modo demo" -ForegroundColor Yellow
}

# ── Quick verification ───────────────────────────────────────────
Write-Host ""
Write-Host "[INFO] Verificando sistema..." -ForegroundColor Cyan
& $PythonCmd scripts/verify_acs.py --json 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Verificación ACS pasada" -ForegroundColor Green
} else {
    Write-Host "[WARN] Algunos componentes ACS no están al 100% — continuando..." -ForegroundColor Yellow
}

# ── Helper: start a process in a new window ──────────────────────
function Start-Service {
    param([string]$Name, [string]$Command, [string]$Args, [string]$WorkDir, [string]$Color)
    Write-Host ""
    Write-Host "▶  Iniciando $Name..." -ForegroundColor $Color
    if ($Detach) {
        Start-Process -FilePath $Command -ArgumentList $Args `
            -WorkingDirectory $WorkDir -WindowStyle Minimized
    } else {
        Start-Process -FilePath $Command -ArgumentList $Args `
            -WorkingDirectory $WorkDir -NoNewWindow -PassThru | Out-Null
    }
    Write-Host "   [OK] $Name arrancado" -ForegroundColor Green
}

# ── Start services ───────────────────────────────────────────────
$Procs = @()

if ($Mode -in @("all", "streamlit")) {
    Write-Host ""
    Write-Host "▶  Streamlit App → http://localhost:8501" -ForegroundColor Magenta
    $Procs += Start-Process -FilePath $PythonCmd `
        -ArgumentList "-m streamlit run streamlit_app.py --server.port 8501 --server.headless true" `
        -WorkingDirectory $RepoRoot -PassThru
    Start-Sleep -Seconds 2
}

if ($Mode -in @("all", "monitor")) {
    Write-Host ""
    Write-Host "▶  Ingestion Monitor → http://localhost:8502" -ForegroundColor Blue
    $Procs += Start-Process -FilePath $PythonCmd `
        -ArgumentList "-m streamlit run launcher/ingestion_monitor.py --server.port 8502 --server.headless true" `
        -WorkingDirectory $RepoRoot -PassThru
}

if ($Mode -in @("all", "nextjs")) {
    $PkgJson = Join-Path $RepoRoot "package.json"
    if (Test-Path $PkgJson) {
        Write-Host ""
        Write-Host "▶  Next.js/Vite Frontend → http://localhost:8080" -ForegroundColor Yellow
        $NpmCmd = if (Get-Command "npm" -ErrorAction SilentlyContinue) { "npm" } else { $null }
        if ($NpmCmd) {
            $Procs += Start-Process -FilePath $NpmCmd `
                -ArgumentList "run dev" -WorkingDirectory $RepoRoot -PassThru
        } else {
            Write-Host "   [SKIP] npm no encontrado — omitiendo Next.js" -ForegroundColor Yellow
        }
    }
}

# ── Open browser ─────────────────────────────────────────────────
Write-Host ""
Write-Host "  Esperando 4s para que los servicios arranquen..." -ForegroundColor Cyan
Start-Sleep -Seconds 4

Write-Host ""
Write-Host "  Abriendo Streamlit App en el navegador..." -ForegroundColor Cyan
Start-Process "http://localhost:8501"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  ✅ ECOSISTEMA ACS INICIADO"                             -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Streamlit App:      http://localhost:8501" -ForegroundColor White
Write-Host "  Ingestion Monitor:  http://localhost:8502" -ForegroundColor White
Write-Host "  Orchestrator Panel: dashboard/orchestrator_panel.html" -ForegroundColor White
Write-Host "  Offers Panel:       dashboard/offers_panel.html"        -ForegroundColor White
Write-Host ""
Write-Host "  Para detener: Ctrl+C o cierra las ventanas de terminal" -ForegroundColor Yellow
Write-Host ""

if (-not $Detach) {
    Write-Host "  Presiona Ctrl+C para detener todos los servicios..." -ForegroundColor Cyan
    try { Wait-Process -Id ($Procs | Where-Object { $_ } | Select-Object -ExpandProperty Id) }
    catch { Write-Host "" }
}
