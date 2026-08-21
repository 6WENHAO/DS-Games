@echo off
rem ===========================================================================
rem  Millennium Corridor - local server launcher
rem  NOTE: this file is intentionally pure ASCII.
rem        cmd.exe parses .bat bytes with the OEM codepage, so UTF-8 Chinese
rem        inside a .bat gets chopped up and breaks the parser.
rem        All Chinese output is printed by node (tools/serve.mjs) instead.
rem
rem  Usage:
rem    double-click                  -> port 8123, opens browser
rem    qianxi.bat 9000               -> custom port
rem    qianxi.bat 8123 -n            -> do not open the browser
rem    qianxi.bat 8123 -b            -> rebuild the single-file build first
rem ===========================================================================
chcp 65001 >nul 2>&1
setlocal EnableExtensions
title Millennium Corridor - local server
cd /d "%~dp0"

set "PORT=8123"
set "OPENFLAG=--open"
set "REBUILD=0"

if not "%~1"=="" set "PORT=%~1"
for %%A in (%2 %3) do (
  if /i "%%A"=="-n" set "OPENFLAG="
  if /i "%%A"=="-b" set "REBUILD=1"
)

set "URL=http://127.0.0.1:%PORT%/"

echo.
echo   Millennium Corridor / QIAN XI HUI LANG
echo   ----------------------------------------

rem ------------------------------------------------------------ node present?
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [X] Node.js not found.
  echo.
  echo       The local server needs Node.js, because browsers refuse to
  echo       load ES modules from file:// URLs.
  echo.
  echo       Two options:
  echo         1^) install Node.js:  https://nodejs.org/
  echo         2^) skip it entirely: double-click
  echo            dist\qianxi-huilang.html
  echo            ^(single-file build, everything inlined, works offline^)
  echo.
  pause
  exit /b 1
)

if not exist "tools\serve.mjs" (
  echo.
  echo   [X] tools\serve.mjs not found.
  echo       Put this .bat in the project root, next to index.html.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v 2^>nul') do set "NODEV=%%v"
echo   node %NODEV%   port %PORT%
echo   %CD%

rem ------------------------------------------------------- optional rebuild
if "%REBUILD%"=="1" (
  echo.
  echo   rebuilding single-file build ...
  call node tools\bundle.mjs
  if errorlevel 1 (
    echo.
    echo   [X] build failed, not starting the server.
    echo.
    pause
    exit /b 1
  )
)

rem ------------------------------------------------------------------ launch
node tools\serve.mjs %OPENFLAG%
set "RC=%ERRORLEVEL%"

if "%RC%"=="3" (
  rem server was already running on this port - just open it
  if defined OPENFLAG start "" %URL%
  timeout /t 3 >nul 2>&1
  exit /b 0
)

if not "%RC%"=="0" (
  echo.
  echo   [X] server exited with code %RC%
  echo.
  pause
  exit /b %RC%
)

echo.
pause
endlocal
