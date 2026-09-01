@echo off
setlocal

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
set "PORT=8501"
set "APP_URL=http://127.0.0.1:%PORT%"
set "PYTHON_EXE="

for %%P in (
    "%LocalAppData%\Programs\Python\Python312\python.exe"
    "%LocalAppData%\Programs\Python\Python313\python.exe"
    "C:\Python312\python.exe"
    "C:\Python313\python.exe"
) do (
    if exist %%~P (
        set "PYTHON_EXE=%%~P"
        goto :python_found
    )
)

where py >nul 2>nul
if not errorlevel 1 (
    set "PYTHON_EXE=py"
    goto :python_found
)

echo [ERROR] No se encontro una instalacion valida de Python.
echo Instala Python 3.12+ o ajusta launcher\run_streamlit_ase.bat.
pause
exit /b 1

:python_found
echo.
echo ================================================
echo   ADAPTIVE SALES ENGINE - STREAMLIT LAUNCHER
echo ================================================
echo Repo: %REPO_ROOT%
echo URL : %APP_URL%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port=%PORT%; $ready=$false; try { $ready=(Test-NetConnection 127.0.0.1 -Port $port -WarningAction SilentlyContinue).TcpTestSucceeded } catch {}; if ($ready) { Start-Process 'http://127.0.0.1:%PORT%'; exit 0 } else { exit 1 }"
if not errorlevel 1 (
    echo [OK] La aplicacion ya estaba activa. Abriendo navegador...
    exit /b 0
)

echo [INFO] Iniciando Streamlit...
start "Adaptive Sales Engine" cmd /c ""%PYTHON_EXE%" -m streamlit run "%REPO_ROOT%\streamlit_app.py" --server.headless true --server.port %PORT%" 

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url='http://127.0.0.1:%PORT%'; $started=$false; for ($i=0; $i -lt 90; $i++) { Start-Sleep -Seconds 1; try { $response=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5; if ($response.StatusCode -eq 200) { $started=$true; break } } catch {} }; if (-not $started) { exit 1 }"
if errorlevel 1 (
    echo [ERROR] La aplicacion no respondio en el puerto %PORT%.
    pause
    exit /b 1
)

echo [OK] Adaptive Sales Engine disponible en %APP_URL%
start "" "%APP_URL%"
exit /b 0

