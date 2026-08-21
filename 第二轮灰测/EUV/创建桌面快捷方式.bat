@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title EUV 演示动画 - 创建桌面快捷方式

cd /d "%~dp0"
set "ROOT=%CD%"

echo ============================================================
echo    为 EUV 演示动画创建桌面快捷方式
echo ============================================================
echo.

if not exist "%ROOT%\一键启动.bat" (
    echo [错误] 未找到 一键启动.bat，请确认本脚本位于 EUV 工程根目录下。
    pause
    exit /b 1
)

REM 生成图标（用工程内的封面缩略图转 ico；若无则使用系统默认图标）
set "ICON="
if exist "%ROOT%\assets\brand\euv.ico" set "ICON=%ROOT%\assets\brand\euv.ico"

echo 正在创建快捷方式...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$desk = $ws.SpecialFolders('Desktop');" ^
  "$items = @(" ^
  "  @{ n='EUV 演示动画';       a='player';  d='打开播放器（预览档）' }," ^
  "  @{ n='EUV 演示动画-评审';  a='review';  d='打开播放器（评审档，画质更高）' }," ^
  "  @{ n='EUV 工程校验';       a='verify';  d='运行 161 项自动断言' }," ^
  "  @{ n='EUV 画质巡检';       a='qc';      d='全片曝光/闪烁/噪点扫描' }," ^
  "  @{ n='EUV 母版输出';       a='capture'; d='逐帧捕获/字幕/音频/静态资产' }" ^
  ");" ^
  "foreach ($it in $items) {" ^
  "  $lnk = $ws.CreateShortcut((Join-Path $desk ($it.n + '.lnk')));" ^
  "  $lnk.TargetPath = '%ROOT%\一键启动.bat';" ^
  "  $lnk.Arguments = $it.a;" ^
  "  $lnk.WorkingDirectory = '%ROOT%';" ^
  "  $lnk.Description = $it.d;" ^
  "  $lnk.WindowStyle = 1;" ^
  "  if ('%ICON%' -ne '') { $lnk.IconLocation = '%ICON%' } else { $lnk.IconLocation = 'shell32.dll,137' }" ^
  "  $lnk.Save();" ^
  "  Write-Host ('  已创建: ' + $it.n + '.lnk   -> ' + $it.d) -ForegroundColor Green;" ^
  "}"

if errorlevel 1 (
    echo.
    echo [错误] 创建失败。请尝试右键"以管理员身份运行"。
    pause
    exit /b 1
)

echo.
echo ------------------------------------------------------------
echo   已在桌面创建 5 个快捷方式，双击即可使用。
echo   如需删除，直接删除桌面上对应的 .lnk 文件即可。
echo ------------------------------------------------------------
echo.
pause
exit /b 0
