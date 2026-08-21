@echo off
rem ============================================================
rem  StrainLab 打包脚本：生成可发给同事的分发包（zip）
rem  双击运行 → 在上级目录生成 StrainLab-菌株监测平台-分发包.zip
rem ============================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY set "PY=py"
"%PY%" package.py
if errorlevel 1 (
  echo [X] 打包失败：请确认已安装 Python。
  pause
  exit /b 1
)
echo.
echo [OK] 分发包已生成：StrainLab-菌株监测平台-分发包.zip（在上一级目录）
echo 发给同事：解压后双击「启动StrainLab.bat」即可。
pause