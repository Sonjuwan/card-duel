@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 goto done
node apps/cli/ai-training-supervisor.ts stop
echo Wait for the original training window to finish saving.
echo Upload ai-training-session\AI-TRAINING-RESULT.json after it says Training stopped.
:done
pause
