# create_desktop_shortcut.ps1
# =====================================================================
# Crea un acceso directo en el escritorio de Windows
# para lanzar el ecosistema ACS con un solo clic.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File create_desktop_shortcut.ps1
# =====================================================================

$ErrorActionPreference = "Stop"

$RepoRoot     = Split-Path -Parent $MyInvocation.MyCommand.Path
$LaunchScript = Join-Path $RepoRoot "start_ecosystem.ps1"
$DesktopPath  = [System.Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "🚀 ACS Sales Engine.lnk"

if (-not (Test-Path $LaunchScript)) {
    Write-Host "[ERROR] No se encontró start_ecosystem.ps1 en: $LaunchScript" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Creando acceso directo en el escritorio..." -ForegroundColor Cyan
Write-Host "  Destino: $ShortcutPath"

$WShell   = New-Object -ComObject WScript.Shell
$Shortcut = $WShell.CreateShortcut($ShortcutPath)

$Shortcut.TargetPath       = "powershell.exe"
$Shortcut.Arguments        = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LaunchScript`""
$Shortcut.WorkingDirectory = $RepoRoot
$Shortcut.Description      = "Adaptive Commercial System — ACS Sales Engine"
$Shortcut.WindowStyle      = 7  # Minimized

# Use PowerShell icon as fallback
$Shortcut.IconLocation = "powershell.exe,0"

$Shortcut.Save()

Write-Host ""
Write-Host "✅ Acceso directo creado: $ShortcutPath" -ForegroundColor Green
Write-Host "   Doble clic para iniciar el ecosistema ACS." -ForegroundColor White
Write-Host ""

# Also create in Start Menu
$StartMenuPath = [System.IO.Path]::Combine(
    [System.Environment]::GetFolderPath("StartMenu"),
    "Programs",
    "ACS Sales Engine.lnk"
)
try {
    $Shortcut2 = $WShell.CreateShortcut($StartMenuPath)
    $Shortcut2.TargetPath       = "powershell.exe"
    $Shortcut2.Arguments        = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LaunchScript`""
    $Shortcut2.WorkingDirectory = $RepoRoot
    $Shortcut2.Description      = "Adaptive Commercial System"
    $Shortcut2.WindowStyle      = 7
    $Shortcut2.IconLocation     = "powershell.exe,0"
    $Shortcut2.Save()
    Write-Host "✅ Acceso directo también creado en Menú Inicio." -ForegroundColor Green
} catch {
    Write-Host "[WARN] No se pudo crear acceso en Menú Inicio: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Para activar el inicio automático al encender el PC:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File autostart\windows_autostart.ps1 -Action install" -ForegroundColor Yellow
Write-Host ""
