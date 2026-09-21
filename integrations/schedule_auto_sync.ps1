# Schedule EmailContextAssistant Auto-Sync for Adaptive Sales Engine
# This script sets up Windows Task Scheduler to run the auto-sync watcher
# Run as Administrator

$taskName = "EmailContextAssistant-AutoSync"
$scriptPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "email_context_auto_sync.py"
$pythonPath = (Get-Command python).Source
$logPath = "C:\Users\isena\Documents\GitHub\adaptive-sales-engine\data\sync_log_emailcontext.txt"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "EmailContextAssistant Auto-Sync Task Scheduler Setup" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Task Name: $taskName" -ForegroundColor Yellow
Write-Host "Script: $scriptPath" -ForegroundColor Yellow
Write-Host "Python: $pythonPath" -ForegroundColor Yellow
Write-Host "Log File: $logPath" -ForegroundColor Yellow
Write-Host ""

# Check if running as administrator
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)

if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Red
    exit 1
}

# Remove existing task if present
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Found existing task. Removing..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Existing task removed." -ForegroundColor Green
    Write-Host ""
}

# Create task action
$action = New-ScheduledTaskAction `
    -Execute $pythonPath `
    -Argument $scriptPath `
    -WorkingDirectory (Split-Path -Parent $scriptPath)

# Create task trigger - run at 6 AM every day
$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At 6:00AM

# Create task settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Create principal (run with user account)
$principal = New-ScheduledTaskPrincipal `
    -UserID "NT AUTHORITY\SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

# Register the task
try {
    $task = Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Force
    
    Write-Host "Task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Scheduled to run: Daily at 6:00 AM" -ForegroundColor Cyan
    Write-Host "Status: $($task.State)" -ForegroundColor Cyan
    Write-Host ""
    
    # Run immediately to test
    Write-Host "Running task immediately to test..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 3
    
    # Check result
    $lastRunTime = (Get-ScheduledTaskInfo -TaskName $taskName).LastRunTime
    Write-Host "Last run time: $lastRunTime" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To view logs:" -ForegroundColor Cyan
    Write-Host "  Get-Content '$logPath' -Tail 50" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To manually run the task:" -ForegroundColor Cyan
    Write-Host "  Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To disable the task:" -ForegroundColor Cyan
    Write-Host "  Disable-ScheduledTask -TaskName '$taskName'" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host "ERROR: Failed to create task" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
