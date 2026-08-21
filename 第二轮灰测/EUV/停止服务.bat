@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title EUV 演示动画 - 停止服务

set "PORT=8777"
if not "%~1"=="" set "PORT=%~1"

echo ============================================================
echo    停止 EUV 演示动画本地服务器（端口 %PORT%）
echo ============================================================
echo.

set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:"127.0.0.1:%PORT% .*LISTENING"') do (
    if not "%%P"=="0" (
        set "FOUND=1"
        echo 发现监听进程 PID=%%P，正在结束...
        taskkill /PID %%P /F >nul 2>nul
        if errorlevel 1 (
            echo   [警告] 结束 PID %%P 失败，可能需要管理员权限
        ) else (
            echo   已结束 PID %%P
        )
    )
)

if not defined FOUND (
    echo 端口 %PORT% 上没有正在运行的服务器。
) else (
    echo.
    echo 服务器已停止。
)

echo.
timeout /t 3 >nul
exit /b 0
