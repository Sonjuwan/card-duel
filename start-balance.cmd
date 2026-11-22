@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 (
  pause
  exit /b 1
)
echo Local admin: http://127.0.0.1:3001
call npm.cmd run balance
if errorlevel 1 pause
