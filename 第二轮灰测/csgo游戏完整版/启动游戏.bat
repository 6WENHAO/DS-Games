@echo off
chcp 65001 >nul
title CS:GO Web - 网页版反恐精英
cd /d "%~dp0"
echo.
echo   正在启动 CS:GO Web ...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo   [错误] 没有找到 Node.js，请先安装: https://nodejs.org/
  echo.
  pause
  exit /b 1
)
start "" http://127.0.0.1:8123/
node tools/serve.mjs 8123
pause
