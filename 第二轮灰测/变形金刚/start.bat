@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   OPTIMUS RIG - three.js Transformer Demo
echo   http://127.0.0.1:8199/
echo   (Keep this window open; Ctrl+C to stop)
echo ============================================
start "" http://127.0.0.1:8199/
where python >nul 2>nul && (
  python -m http.server 8199 --bind 127.0.0.1
  goto :eof
)
where node >nul 2>nul && (
  npx --yes serve -l 8199 .
  goto :eof
)
echo No python / node found. Please serve this folder over HTTP manually.
pause
