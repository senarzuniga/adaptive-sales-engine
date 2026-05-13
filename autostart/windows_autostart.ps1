# autostart/windows_autostart.ps1
# =====================================================================
# Configura el inicio automático del ACS en Windows
# mediante el Programador de Tareas (Task Scheduler).
#
# Requisitos: ejecutar como Administrador
#
# Uso:
#   # Instalar autostart:
#   powershell -ExecutionPolicy Bypass -File autostart\windows_autostart.ps1 -Action install
#
#   # Desinstalar autostart:
#   powershell -ExecutionPolicy Bypass -File autostart\windows_autostart.ps1 -Action uninstall
#
#   # Ver estado:
#   powershell -ExecutionPolicy Bypass -File autostart\windows_autostart.ps1 -Action status
# =====================================================================

param(
    [ValidateSet("install","uninstall","status")]
    [string]$Action = "install"
)

$TaskName   = "ACS-AdaptiveSalesEngine"
$RepoRoot   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LaunchScript = Join-Path $RepoRoot "start_ecosystem.ps1"

if (-not (Test-Path $LaunchScript)) {
    Write-Host "[ERROR] No se encontró start_ecosystem.ps1 en: $LaunchScript" -ForegroundColor Red
    exit 1
}

switch ($Action) {
    "install" {
        Write-Host "Instalando tarea programada: $TaskName" -ForegroundColor Cyan

        # Detect Python
        $PythonPath = (Get-Command "python" -ErrorAction SilentlyContinue)?.Source
        if (-not $PythonPath) {
            Write-Host "[ERROR] Python no encontrado en PATH" -ForegroundColor Red
            exit 1
        }

        $Action_obj = New-ScheduledTaskAction `
            -Execute "powershell.exe" `
            -Argument "-WindowStyle Minimized -ExecutionPolicy Bypass -File `"$LaunchScript`" -Detach" `
            -WorkingDirectory $RepoRoot

        # Trigger: at logon + 60s delay
        $Trigger = New-ScheduledTaskTrigger -AtLogOn
        $Trigger.Delay = "PT60S"  # 60 second delay after login

        $Settings = New-ScheduledTaskSettingsSet `
            -ExecutionTimeLimit "PT0S" `
            -MultipleInstances IgnoreNew `
            -StartWhenAvailable

        $Principal = New-ScheduledTaskPrincipal `
            -UserId $env:USERNAME `
            -LogonType Interactive `
            -RunLevel Limited

        try {
            # Remove existing task if present
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

            Register-ScheduledTask `
                -TaskName $TaskName `
                -Action $Action_obj `
                -Trigger $Trigger `
                -Settings $Settings `
                -Principal $Principal `
                -Description "Adaptive Commercial System — inicia automáticamente al iniciar sesión"

            Write-Host ""
            Write-Host "✅ Tarea programada instalada correctamente" -ForegroundColor Green
            Write-Host "   Nombre: $TaskName" -ForegroundColor White
            Write-Host "   El ACS arrancará automáticamente 60s después de iniciar sesión." -ForegroundColor White
            Write-Host ""
            Write-Host "   Para desinstalar:" -ForegroundColor Yellow
            Write-Host "   powershell -ExecutionPolicy Bypass -File autostart\windows_autostart.ps1 -Action uninstall" -ForegroundColor Yellow
        } catch {
            Write-Host "[ERROR] No se pudo registrar la tarea: $_" -ForegroundColor Red
            Write-Host "Asegúrate de ejecutar como Administrador." -ForegroundColor Yellow
            exit 1
        }
    }

    "uninstall" {
        Write-Host "Desinstalando tarea programada: $TaskName" -ForegroundColor Yellow
        try {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
            Write-Host "✅ Tarea $TaskName eliminada." -ForegroundColor Green
        } catch {
            Write-Host "[WARN] La tarea no existía o no se pudo eliminar: $_" -ForegroundColor Yellow
        }
    }

    "status" {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($task) {
            $info = Get-ScheduledTaskInfo -TaskName $TaskName
            Write-Host "Tarea: $TaskName" -ForegroundColor Cyan
            Write-Host "  Estado:           $($task.State)" -ForegroundColor White
            Write-Host "  Última ejecución: $($info.LastRunTime)" -ForegroundColor White
            Write-Host "  Último resultado: $($info.LastTaskResult)" -ForegroundColor White
        } else {
            Write-Host "La tarea '$TaskName' no está instalada." -ForegroundColor Yellow
            Write-Host "Ejecuta con -Action install para instalarla." -ForegroundColor Cyan
        }
    }
}
