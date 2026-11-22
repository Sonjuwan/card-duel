@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 (
  pause
  exit /b 1
)
if not exist node_modules\.package-lock.json (
  echo Installing dependencies. This may take a few minutes.
  call npm.cmd ci
  if errorlevel 1 (
    echo Install failed. Check the internet connection and Node.js version.
    pause
    exit /b 1
  )
)
echo Open the URL displayed by the server once it is ready.
call npm.cmd run web
if errorlevel 1 pause
