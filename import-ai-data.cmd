@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 goto done
echo Import trained AI from an older project folder.
echo This does not overwrite existing models or change the old folder.
echo For full checkpoint recovery, stop training in the old folder first.
set /p "oldPath=Drag the old card-duel folder here, then press Enter: "
if not defined oldPath goto done
node apps/cli/import-ai-data.ts "%oldPath:"=%"
:done
pause
