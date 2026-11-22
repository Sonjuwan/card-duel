@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 (
  pause
  exit /b 1
)
if not exist node_modules\.package-lock.json (
  call npm.cmd ci
  if errorlevel 1 (
    echo Install failed.
    pause
    exit /b 1
  )
)
call npm.cmd run typecheck
if errorlevel 1 goto failed
call npm.cmd run audit
if errorlevel 1 goto failed
call npm.cmd test
if errorlevel 1 goto failed
call npm.cmd run test:render
if errorlevel 1 goto failed
call npm.cmd run test:preview
if errorlevel 1 goto failed
echo All checks passed.
pause
exit /b 0
:failed
echo A check failed. Please copy the error message.
pause
exit /b 1
