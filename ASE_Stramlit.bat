@echo off
setlocal
set "REPO_ROOT=%~dp0"
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

echo Python no esta disponible en PATH.
exit /b 1

:python_found
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready=$false; try { $ready=(Test-NetConnection 127.0.0.1 -Port %PORT% -WarningAction SilentlyContinue).TcpTestSucceeded } catch {}; if ($ready) { Start-Process '%APP_URL%'; exit 0 } else { exit 1 }"
if not errorlevel 1 exit /b 0

start "ASE Streamlit" cmd /c "\"%PYTHON_EXE%\" -m streamlit run \"%REPO_ROOT%streamlit_app.py\" --server.headless true --server.port %PORT%"
for /l %%I in (1,1,90) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$r=$false; try { $r=(Invoke-WebRequest -UseBasicParsing '%APP_URL%' -TimeoutSec 5).StatusCode -eq 200 } catch {}; if ($r) { exit 0 } else { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        start "" "%APP_URL%"
        exit /b 0
    )
    timeout /t 1 /nobreak >nul
)

echo ASE Streamlit no respondio a tiempo.
exit /b 1
