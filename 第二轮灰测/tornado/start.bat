@echo off
chcp 65001 >nul
title TORNADO - 写实龙卷风三场景演示
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 Node.js。ES Module 需要通过 http 加载，请先安装 Node 18+：
  echo        https://nodejs.org/
  echo.
  pause
  exit /b 1
)

set PORT=8181
echo [1/2] 启动本地静态服务器 http://127.0.0.1:%PORT%/
start "tornado-server" /min cmd /c "node serve.mjs %PORT%"

echo [2/2] 等待服务器就绪并打开浏览器…
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/index.html"

echo.
echo 已启动。关闭这个窗口不会停止服务器；
echo 需要停止请关闭标题为 tornado-server 的那个窗口，或在此按任意键结束全部。
echo.
pause >nul
taskkill /FI "WINDOWTITLE eq tornado-server*" /T /F >nul 2>nul
exit /b 0
