@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 (
  pause
  exit /b 1
)
if not exist "dist\solo-app\index.html" (
  echo Offline installation package not found. Extract the complete release or build it with npm run build:solo-app.
  pause
  exit /b 1
)
echo RUNEHALL solo app runs at http://127.0.0.1:4179/
echo Use the same browser profile and exact address to keep progress across updates.
node apps\cli\serve-solo-app.mjs
if errorlevel 1 pause
