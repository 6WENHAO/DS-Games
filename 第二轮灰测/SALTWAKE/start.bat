@echo off
setlocal
cd /d "%~dp0"

REM Node prints UTF-8; switch the console to it so paths render correctly.
chcp 65001 >nul

REM Serves this folder and opens the browser once the port is listening.
REM The server does the opening itself, so the browser can never arrive first.
REM Requires Node.js 18 or newer. Press Ctrl+C in this window to stop.

where node >nul 2>nul
if errorlevel 1 goto nonode

set "PORT=8130"
echo SALTWAKE
echo Serving http://127.0.0.1:%PORT%/
echo.
node tools\serve.mjs %PORT% --open

echo.
echo The server has stopped.
pause
exit /b 0

:nonode
echo Node.js was not found on PATH.
echo Install Node 18 or newer, then run this file again.
echo Alternatively serve this folder with any static server and open index.html.
echo.
pause
exit /b 1
