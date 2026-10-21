@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js para iniciar la plataforma.
  pause
  exit /b 1
)
start "" http://127.0.0.1:4173
node server.mjs
pause
