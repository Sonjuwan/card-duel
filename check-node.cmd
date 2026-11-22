@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 goto missing
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing
for /f "tokens=1 delims=." %%V in ('node --version') do set "NODE_MAJOR=%%V"
if not "%NODE_MAJOR%"=="v24" (
  echo Card Duel requires Node.js 24.x. Your installed version:
  node --version
  echo Download Node.js 24 from https://nodejs.org/ and reopen this window.
  exit /b 1
)
exit /b 0
:missing
echo Please install Node.js 24 from https://nodejs.org/ first.
echo Then reopen this window.
exit /b 1
