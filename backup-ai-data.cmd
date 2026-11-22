@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 goto done
echo Back up AI checkpoints without interrupting training.
echo Enter a NEW folder path. Existing data is never overwritten.
set /p "backupPath=New backup folder: "
if not defined backupPath goto done
node apps/cli/backup-ai-data.ts "%backupPath:"=%"
:done
pause
