@echo off
title 行者·白骨岭 - 本地服务器
echo ============================================
echo   行者 · 白骨岭  ^|  网页版西游动作RPG
echo ============================================
echo.
echo 正在启动本地服务器 http://localhost:8093 ...
echo 按 Ctrl+C 可停止服务器。
echo.
start "" "http://localhost:8093"
python -m http.server 8093 2>nul
if errorlevel 1 (
  echo Python 未安装，尝试使用 Node.js ...
  npx --yes http-server -p 8093 -c-1 .
)
