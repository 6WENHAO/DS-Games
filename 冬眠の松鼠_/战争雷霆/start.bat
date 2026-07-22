@echo off
chcp 65001 >nul
title 钢铁雷霆 STEEL THUNDER - 本地服务器
echo ================================================
echo   钢铁雷霆 STEEL THUNDER  正在启动本地服务器...
echo   浏览器将自动打开 http://localhost:8137
echo   关闭本窗口即可停止游戏服务器
echo ================================================
start "" "http://localhost:8137/"
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8137
) else (
  where node >nul 2>nul
  if %errorlevel%==0 (
    npx --yes serve -l 8137 .
  ) else (
    echo 未找到 Python 或 Node.js，请安装其中之一后重试。
    pause
  )
)
