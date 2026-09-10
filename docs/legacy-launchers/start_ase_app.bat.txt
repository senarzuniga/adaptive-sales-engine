@echo off
cd /d "%~dp0"
call "C:\Program Files\nodejs\nodevars.bat" >nul 2>&1
where npm >nul 2>&1
if errorlevel 1 (
    echo Node.js and npm are not available on PATH.
    exit /b 1
)
if not exist node_modules (
    echo Installing dependencies...
    npm ci
)
start "" http://localhost:8080
npm run dev -- --host 0.0.0.0 --port 8080
