@echo off
setlocal
cd /d "%~dp0"
call check-node.cmd
if errorlevel 1 goto failed
if not defined ANDROID_SDK_ROOT if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
if not defined JAVA_HOME if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
node apps\cli\build-android.mjs --check
if errorlevel 1 goto failed
if "%~1"=="" goto usage
if "%~2"=="" goto usage
node apps\cli\build-android.mjs --build --keystore "%~1" --alias "%~2"
if errorlevel 1 goto failed
echo APK created in dist\android. Keep the same signing key for updates.
exit /b 0
:usage
echo Usage: build-android-apk.cmd path-to-existing-keystore alias
echo See docs\ANDROID-APK.md. Do not share the private key or password.
:failed
pause
exit /b 1
