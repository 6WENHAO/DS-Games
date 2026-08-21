@echo off
rem ---------------------------------------------------------------------------
rem  One-click launch of the WebGPU build (no build step, no server needed).
rem  Just double-click this file.
rem ---------------------------------------------------------------------------
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist "ice_cave.html" (
  echo ice_cave.html not found - generating it from shaders\ice_cave.wgsl ...
  where python >nul 2>nul && python tools\build_html.py
  if not exist "ice_cave.html" (
    echo.
    echo Could not generate ice_cave.html. Install Python, or run:
    echo     python tools\build_html.py
    pause
    exit /b 1
  )
)

echo Opening ice_cave.html in your default browser ...
echo   * needs Chrome / Edge 113+ (WebGPU). Edge is fine on this machine.
echo   * if the page reports "no WebGPU", run serve.cmd instead, or check
echo     edge://gpu  /  chrome://gpu  (hardware acceleration must be on).
start "" "%~dp0ice_cave.html"
endlocal
