@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 可移动烟支缺陷检测系统 网页仿真 ...
node serve.mjs %1
if errorlevel 1 (
  echo.
  echo 未找到 node，尝试使用 Python...
  start "" http://127.0.0.1:8791/index.html
  python -m http.server 8791 --bind 127.0.0.1
)
pause
