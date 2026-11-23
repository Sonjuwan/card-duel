@echo off
setlocal
cd /d "%~dp0"
node scripts\build-local-playable.mjs
if errorlevel 1 (
  echo.
  echo Build did not finish. Old playable files are preserved.
  pause
  exit /b 1
)
echo.
echo Build verified. Check playable-release folder.
pause
