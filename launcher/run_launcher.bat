@echo off
:: run_launcher.bat — double-click this file to open the App Launcher
:: Requirements: Python 3.8+ must be on PATH (python.exe accessible)

title App Launcher
cd /d %~dp0

:: Check Python is available
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] python.exe not found on PATH.
    echo Please install Python 3.8+ and ensure it is in your PATH.
    pause
    exit /b 1
)

:: Launch the GUI (pythonw hides the console window on Windows)
pythonw launcher.py %*
if errorlevel 1 (
    echo.
    echo [ERROR] Launcher exited with an error. Re-running with visible console...
    python launcher.py %*
    pause
)
