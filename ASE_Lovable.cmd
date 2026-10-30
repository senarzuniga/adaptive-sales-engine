@echo off
setlocal EnableExtensions
set "REPO_ROOT=%~dp0"
set "VITE=%REPO_ROOT%node_modules\vite\bin\vite.js"
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node.exe"

if not exist "%VITE%" (
  echo No se encontro Vite en "%VITE%".
  echo Instala las dependencias del proyecto y vuelve a ejecutar este lanzador.
  exit /b 1
)

rem Ignore unrelated HTTP servers such as python http.server directory listings.
rem First reuse an ASE Vite response on the default port range.
for /L %%P in (8080,1,8090) do (
  call :CheckAsePort %%P
  if not errorlevel 1 (
    call :OpenChrome %%P
    exit /b 0
  )
)

rem Start this repository's own Vite directly, without depending on npm PATH,
rem PowerShell Start-Process, or shell quoting in a detached npm subprocess.
set "ASE_LOG=%TEMP%\adaptive-sales-engine-vite.log"
start "ASE Lovable Vite" /D "%REPO_ROOT%" "%NODE%" "%VITE%" --host 127.0.0.1 --port 8080 --strictPort >>"%ASE_LOG%" 2>&1

rem Wait up to 30 seconds; open a browser only after the actual app is ready.
for /L %%I in (1,1,30) do (
  for /L %%P in (8080,1,8090) do (
    call :CheckAsePort %%P
    if not errorlevel 1 (
      call :OpenChrome %%P
      exit /b 0
    )
  )
  timeout /t 1 /nobreak >nul
)

echo No se pudo iniciar ASE Lovable. No se ha abierto una pagina de listado de archivos.
echo Registro de Vite: "%ASE_LOG%"
if exist "%ASE_LOG%" type "%ASE_LOG%"
exit /b 1

:CheckAsePort
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%~1/' -TimeoutSec 2; if ($r.StatusCode -eq 200 -and $r.Content -match '/@vite/client' -and $r.Content -match 'id=.root.') { exit 0 } } catch {}; exit 1" >nul 2>&1
exit /b %errorlevel%

:OpenChrome
set "ASE_URL=http://127.0.0.1:%~1/"
where chrome.exe >nul 2>&1
if not errorlevel 1 (
  start "" chrome.exe "%ASE_URL%"
  exit /b 0
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ASE_URL%"
  exit /b 0
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%ASE_URL%"
  exit /b 0
)
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
  start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" "%ASE_URL%"
  exit /b 0
)
echo ASE Lovable esta disponible en %ASE_URL%, pero no se encontro Chrome.
exit /b 1
