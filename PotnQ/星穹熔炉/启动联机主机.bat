@echo off
cd /d "%~dp0"
echo Starting STARFORGE LAN server...
powershell -NoProfile -ExecutionPolicy Bypass -File server.ps1
pause
