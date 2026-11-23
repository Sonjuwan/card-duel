@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 goto done
node apps/cli/ai-training-supervisor.ts status
echo Result: ai-training-session\AI-TRAINING-RESULT.json
:done
pause
