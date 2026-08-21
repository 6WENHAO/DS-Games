@echo off
REM Serves the project on http://127.0.0.1:8123 and opens it in the browser.
REM Node.js 18 or newer is the only requirement.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install Node 18 or newer, or serve this folder with any static file server
  echo and open index.html from that server.
  pause
  exit /b 1
)

start "" http://127.0.0.1:8123/
node tools\serve.mjs 8123
endlocal
