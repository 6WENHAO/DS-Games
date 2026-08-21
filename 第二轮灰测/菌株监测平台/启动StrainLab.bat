@echo off
rem ============================================================
rem  StrainLab 菌株监测可视化平台 · 一键启动（Windows）
rem  无需安装任何依赖；仅需电脑装有 Python 3.8+
rem  若无 Python，脚本会给出安装指引并自动打开下载页。
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title StrainLab 菌株监测平台 · 启动器
cd /d "%~dp0"

echo.
echo   StrainLab 菌株监测可视化平台
echo   正在检查 Python 运行环境 ...
echo.

rem ---------- 1. 查找 Python ----------
set "PY="
where python >nul 2>nul
if not errorlevel 1 (
    set "PY=python"
    goto :found
)
set "CAND1=%LOCALAPPDATA%\Programs\Python"
for /d %%D in ("%CAND1%\Python312" "%CAND1%\Python311" "%CAND1%\Python310" "%CAND1%\Python39" "%CAND1%\Python38") do (
    if exist "%%D\python.exe" (
        set "PY=%%D\python.exe"
        goto :found
    )
)
set "CAND2=%ProgramFiles%\Python"
for /d %%D in ("%CAND2%\Python312" "%CAND2%\Python311" "%CAND2%\Python310" "%CAND2%\Python39" "%CAND2%\Python38") do (
    if exist "%%D\python.exe" (
        set "PY=%%D\python.exe"
        goto :found
    )
)

echo   [X] 未检测到 Python。
echo.
echo   请先安装 Python（勾选 "Add python.exe to PATH"）：
echo     官方下载：https://www.python.org/downloads/
echo   安装完成后重新双击本文件即可。
echo.
echo   正在打开下载页 ...
start "" "https://www.python.org/downloads/"
pause
exit /b 1

:found
echo   [OK] 使用 Python：!PY!
"%PY%" -c "import sys; sys.exit(0 if sys.version_info>=(3,8) else 1)" 2>nul
if errorlevel 1 (
    echo   [X] Python 版本过低（需要 3.8 及以上）。
    pause
    exit /b 1
)

rem ---------- 2. 端口占用检查 ----------
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
    echo   [!] 端口 8000 已被占用：可能已有一个 StrainLab 在运行。
    echo       直接为你打开浏览器；若想重启，请先关闭旧窗口/旧进程。
    goto :browser
)

rem ---------- 3. 启动服务（独立窗口，带日志） ----------
echo   [OK] 正在启动后端服务（独立窗口，勿关闭）...
start "StrainLab 后端服务（勿关闭此窗口）" cmd /k "chcp 65001>nul && cd /d "%~dp0" && "%PY%" app.py"

rem ---------- 4. 等待就绪后打开浏览器 ----------
echo   [OK] 等待服务就绪 ...
for /l %%i in (1,1,40) do (
    timeout /t 1 /nobreak >nul
    "%PY%" -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:8000/api/status',timeout=1); sys.exit(0)" 2>nul
    if not errorlevel 1 goto :browser
)
echo   [!] 服务启动较慢或失败，请查看“StrainLab 后端服务”窗口中的报错。
pause
exit /b 1

:browser
echo   [OK] 打开浏览器：http://127.0.0.1:8000/
start "" "http://127.0.0.1:8000/"
endlocal
exit /b 0