@echo off
rem ---------------------------------------------------------------------------
rem  Fallback launcher: serve the folder over http://127.0.0.1 and open the page.
rem  Use this if a browser/enterprise policy blocks WebGPU on file:// URLs.
rem  Close this window to stop the server.
rem ---------------------------------------------------------------------------
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist "ice_cave.html" (
  where python >nul 2>nul && python tools\build_html.py
)

set PORT=8765
echo Serving %~dp0 on http://127.0.0.1:%PORT%/
echo Opening http://127.0.0.1:%PORT%/ice_cave.html ...
start "" "http://127.0.0.1:%PORT%/ice_cave.html"
python -m http.server %PORT% --bind 127.0.0.1
endlocal
