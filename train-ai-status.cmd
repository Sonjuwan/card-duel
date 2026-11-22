@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 goto done
node apps/cli/train-ai.ts --status
:done
pause
