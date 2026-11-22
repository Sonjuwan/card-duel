@echo off
cd /d "%~dp0"
call npm run build:offline
if errorlevel 1 (
  echo Could not build the offline game. Install dependencies with npm install first.
  pause
  exit /b 1
)
start "" "%~dp0solo-offline.html"
echo Offline solo game is ready. Copy solo-offline.html to another device if desired.
pause
