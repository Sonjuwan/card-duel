@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 goto done
echo AI self-play - 10 hours total, reduced CPU / lower heat target
node apps/cli/train-ai.ts --hours 10 --power quiet
:done
pause
