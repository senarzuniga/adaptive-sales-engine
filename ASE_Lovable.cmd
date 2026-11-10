@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "ASE_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined ASE_NODE set "ASE_NODE=%%N"
if not defined ASE_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "ASE_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined ASE_NODE (
  echo ERROR: Node.js no encontrado. Instala Node.js 20 o superior.
  exit /b 1
)
"%ASE_NODE%" "%~dp0scripts\launch_ase.cjs" %*
exit /b %errorlevel%
