@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 goto done
echo AI self-play training - 10 hours total
echo Keep the computer awake and this window open. Ctrl+C saves completed games.
node apps/cli/train-ai.ts --hours 10
:done
pause
