@echo off
setlocal
cd /d "%~dp0"
echo Use only on a trusted private Wi-Fi or VPN.
echo Find the IPv4 address of the correct adapter using ipconfig.
set /p "CARD_DUEL_HOST=Enter this computer's private IPv4 address: "
if not defined CARD_DUEL_HOST (
  echo No address entered.
  pause
  exit /b 1
)
call start-game.cmd
