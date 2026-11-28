@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 goto done
echo RUNEHALL - continuous offline AI training
echo 1. Quiet (recommended for unattended laptop training)
echo 2. Balanced
echo 3. Maximum (monitor laptop temperature first)
choice /c 123 /n /t 15 /d 1 /m "Select power mode (defaults to 1 after 15 seconds): "
set "TRAIN_CHOICE=%errorlevel%"
set "TRAIN_MODE=quiet"
if "%TRAIN_CHOICE%"=="2" set "TRAIN_MODE=balanced"
if "%TRAIN_CHOICE%"=="3" set "TRAIN_MODE=maximum"
node apps/cli/ai-training-supervisor.ts start --power %TRAIN_MODE%
:check
if "%errorlevel%"=="0" goto done
if "%errorlevel%"=="2" goto done
echo Supervisor exited unexpectedly. Retry in 30 seconds.
echo STOP-AI-TRAINING.cmd can cancel the retry.
timeout /t 30 /nobreak >nul
node apps/cli/ai-training-supervisor.ts resume --power %TRAIN_MODE%
goto check
:done
echo Result: ai-training-session\AI-TRAINING-RESULT.json
pause
