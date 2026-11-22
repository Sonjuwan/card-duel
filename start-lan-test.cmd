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
    pause
    exit /b 1
  )
)
call npm.cmd run build
if errorlevel 1 (
  pause
  exit /b 1
)
call node apps/cli/lan-test.ts --list
echo Test only on trusted Wi-Fi. Do not use a real email/password or forward ports.
set /p "TEST_HOST=Enter this computer's private IPv4 address: "
if not defined TEST_HOST exit /b 1
call node apps/cli/lan-test.ts --host "%TEST_HOST%"
if errorlevel 1 pause
