# abrir_interfaz_manana.ps1
# ================================================================
# Lanzador rapido para abrir la interfaz local cada manana.
# - Si el servidor ya esta activo en el puerto 8080, solo abre navegador.
# - Si no esta activo, inicia "npm run dev" y espera disponibilidad.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\abrir_interfaz_manana.ps1
#   o doble clic en .\abrir_interfaz_manana.cmd
# ================================================================

param(
    [int]$Port = 8080,
    [int]$TimeoutSeconds = 75
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Url = "http://localhost:$Port/"

Set-Location $RepoRoot

function Test-PortOpen {
    param([int]$TestPort)

    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", $TestPort, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(800, $false)
        if (-not $ok) {
            $client.Close()
            return $false
        }
        $client.EndConnect($iar)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

Write-Host "" 
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  ADAPTIVE SALES ENGINE - Lanzador de Manana" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Directorio: $RepoRoot"
Write-Host "  URL: $Url"
Write-Host ""

if (Test-PortOpen -TestPort $Port) {
    Write-Host "[OK] La interfaz ya estaba activa. Abriendo navegador..." -ForegroundColor Green
    Start-Process $Url
    exit 0
}

# Resolver npm (npm.cmd en Windows)
$npmCmd = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue)
if (-not $npmCmd) {
    $npmCmd = (Get-Command "npm" -ErrorAction SilentlyContinue)
}

if (-not $npmCmd) {
    Write-Host "[ERROR] npm no esta disponible en PATH." -ForegroundColor Red
    Write-Host "        Instala Node.js 20+ o abre una terminal con npm habilitado." -ForegroundColor Yellow
    exit 1
}

Write-Host "[INFO] Iniciando servidor (npm run dev)..." -ForegroundColor Yellow
Start-Process -FilePath $npmCmd.Source -ArgumentList "run dev" -WorkingDirectory $RepoRoot | Out-Null

$started = $false
for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
    Start-Sleep -Seconds 1
    if (Test-PortOpen -TestPort $Port) {
        $started = $true
        break
    }
}

if (-not $started) {
    Write-Host "[ERROR] El servidor no respondio en $TimeoutSeconds segundos (puerto $Port)." -ForegroundColor Red
    Write-Host "        Revisa la terminal donde se ejecuto npm run dev." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Interfaz lista. Abriendo navegador..." -ForegroundColor Green
Start-Process $Url

Write-Host ""
Write-Host "Listo. Puedes ejecutar este archivo cada manana para abrir la interfaz rapidamente." -ForegroundColor Cyan
Write-Host ""
