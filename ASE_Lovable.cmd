@echo off
setlocal
set "REPO_ROOT=%~dp0"
set "PORT=8080"

for %%P in (8080 8081 8082) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:%%P -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 (
    start "" chrome "http://localhost:%%P/"
    exit /b 0
  )
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm no esta disponible en PATH.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'npm.cmd' -WorkingDirectory '%REPO_ROOT%' -ArgumentList 'run dev -- --host 0.0.0.0 --port %PORT%'"
start "" chrome "http://localhost:%PORT%/"
exit /b 0
