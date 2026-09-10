@echo off
setlocal
set "REPO_ROOT=%~dp0"
set "PORT=8080"
set "URL=http://localhost:%PORT%/"

for %%P in (8080 8081 8082) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:%%P).StatusCode } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 (
    start "" "http://localhost:%%P/"
    exit /b 0
  )
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm no esta disponible en PATH.
  exit /b 1
)

start "ASE Lovable" cmd /c "cd /d \"%REPO_ROOT%\" && set PATH=C:\Program Files\nodejs;%%PATH%% && npm run dev -- --host 0.0.0.0 --port 8080"
for /l %%I in (1,1,90) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:8080).StatusCode } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 (
    start "" "http://localhost:8080/"
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)

echo ASE Lovable no respondio a tiempo.
exit /b 1
