@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title EUV 光刻原理 3D 演示动画 - 一键启动

cd /d "%~dp0"

set "PORT=8777"
set "PYEXE="
set "TARGET="

echo ============================================================
echo    EUV 光刻原理 - 三维演示动画   一键启动
echo    How EUV Lithography Works  -  One Click Launcher
echo ============================================================
echo.

REM ─────────────────────────────────────────────────────────────
REM  1. 查找 Python 3（依次尝试 PATH / py 启动器 / 常见安装路径）
REM ─────────────────────────────────────────────────────────────
for /f "delims=" %%P in ('where python 2^>nul') do (
    if not defined PYEXE set "PYEXE=%%P"
)
if not defined PYEXE (
    where py >nul 2>nul && set "PYEXE=py -3"
)
if not defined PYEXE (
    for %%D in (
        "E:\Conda\python.exe"
        "D:\Conda\python.exe"
        "C:\Conda\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python39\python.exe"
        "%ProgramFiles%\Python312\python.exe"
        "%ProgramFiles%\Python311\python.exe"
        "C:\Python312\python.exe"
        "C:\Python311\python.exe"
    ) do (
        if not defined PYEXE if exist %%D set "PYEXE=%%~D"
    )
)

if not defined PYEXE (
    echo [错误] 未找到 Python 3。
    echo.
    echo 本项目只需 Python 3 标准库，无需安装任何第三方包。
    echo 请从 https://www.python.org/downloads/ 安装 Python 3.8 以上版本，
    echo 安装时勾选 "Add Python to PATH"，然后重新运行本脚本。
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%V in ('%PYEXE% -c "import sys;print('%%d.%%d'%%sys.version_info[:2])" 2^>nul') do set "PYVER=%%V"
if not defined PYVER (
    echo [错误] 找到了 Python 但无法运行: %PYEXE%
    pause
    exit /b 1
)
echo [1/4] Python %PYVER%  ^(%PYEXE%^)

REM ─────────────────────────────────────────────────────────────
REM  2. 校验工程文件完整性
REM ─────────────────────────────────────────────────────────────
set "MISSING="
for %%F in (serve.py index.html src\main.js src\params.js src\layout.js src\script.js vendor\three\build\three.module.js) do (
    if not exist "%%F" set "MISSING=!MISSING! %%F"
)
if defined MISSING (
    echo [错误] 工程文件缺失:!MISSING!
    echo        请确认本脚本位于 EUV 工程根目录下。
    pause
    exit /b 1
)
echo [2/4] 工程文件完整

REM ─────────────────────────────────────────────────────────────
REM  3. 端口检查：若服务器已在运行，直接打开浏览器
REM ─────────────────────────────────────────────────────────────
set "RUNNING="
for /f "tokens=*" %%L in ('netstat -ano ^| findstr /R /C:"127.0.0.1:%PORT% .*LISTENING"') do set "RUNNING=1"
if defined RUNNING (
    echo [3/4] 检测到服务器已在 %PORT% 端口运行，直接打开浏览器
    call :PICK
    start "" "http://127.0.0.1:%PORT%/!TARGET!"
    echo.
    echo 已打开: http://127.0.0.1:%PORT%/!TARGET!
    echo 如需停止服务器，请运行 停止服务.bat
    echo.
    timeout /t 3 >nul
    exit /b 0
)
echo [3/4] 端口 %PORT% 空闲

REM ─────────────────────────────────────────────────────────────
REM  4. 选择入口并启动
REM ─────────────────────────────────────────────────────────────
call :PICK

echo [4/4] 启动本地服务器...
echo.
echo ------------------------------------------------------------
echo   浏览器将自动打开: http://127.0.0.1:%PORT%/!TARGET!
echo   在本窗口按 Ctrl+C 可停止服务器
echo ------------------------------------------------------------
echo.

REM 延时 2 秒后打开浏览器（让服务器先起来），服务器本身在前台运行以便看日志
start "" cmd /c "timeout /t 2 >nul & start "" "http://127.0.0.1:%PORT%/!TARGET!""
%PYEXE% serve.py %PORT% --no-open

echo.
echo 服务器已停止。
pause
exit /b 0

REM ═════════════════════════════════════════════════════════════
REM  入口选择菜单（10 秒无操作默认打开播放器）
REM ═════════════════════════════════════════════════════════════
:PICK
if not "%~1"=="" goto :PICK_ARG
if not "%EUV_TARGET%"=="" (
    set "TARGET=%EUV_TARGET%"
    goto :eof
)
echo.
echo   请选择要打开的入口:
echo.
echo     [1] 播放器 - 预览档          流畅交互，日常观看
echo     [2] 播放器 - 评审档          画质更高，客户评审用
echo     [3] 播放器 - 中文字幕
echo     [4] 播放器 - 英文字幕
echo     [5] 播放器 - 竖版取景 9:16   社媒竖版预览
echo     [6] 工程校验                 161 项自动断言
echo     [7] 画质巡检                 全片曝光/闪烁/噪点扫描
echo     [8] 母版输出                 逐帧捕获/字幕/音频/静态资产
echo     [9] 仅启动服务器             不打开浏览器
echo.
set "CH="
set /p "CH=  输入序号后回车（直接回车 = 1，10 秒后自动选 1）: "
if not defined CH set "CH=1"

if "%CH%"=="1" set "TARGET=index.html"
if "%CH%"=="2" set "TARGET=index.html?q=review"
if "%CH%"=="3" set "TARGET=index.html?lang=zh"
if "%CH%"=="4" set "TARGET=index.html?lang=en"
if "%CH%"=="5" set "TARGET=index.html?aspect=9:16"
if "%CH%"=="6" set "TARGET=test/verify.html"
if "%CH%"=="7" set "TARGET=tools/qc.html"
if "%CH%"=="8" set "TARGET=tools/capture.html"
if "%CH%"=="9" set "TARGET="
if not defined TARGET if not "%CH%"=="9" set "TARGET=index.html"
goto :eof

:PICK_ARG
if /i "%~1"=="player"  set "TARGET=index.html"
if /i "%~1"=="review"  set "TARGET=index.html?q=review"
if /i "%~1"=="master"  set "TARGET=index.html?q=master"
if /i "%~1"=="zh"      set "TARGET=index.html?lang=zh"
if /i "%~1"=="en"      set "TARGET=index.html?lang=en"
if /i "%~1"=="v"       set "TARGET=index.html?aspect=9:16"
if /i "%~1"=="verify"  set "TARGET=test/verify.html"
if /i "%~1"=="qc"      set "TARGET=tools/qc.html"
if /i "%~1"=="capture" set "TARGET=tools/capture.html"
if /i "%~1"=="serve"   set "TARGET="
if not defined TARGET set "TARGET=index.html"
goto :eof
