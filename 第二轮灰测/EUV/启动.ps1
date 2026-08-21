<#
  启动.ps1 — EUV 光刻原理 3D 演示动画  PowerShell 启动器
  ================================================================
  与 一键启动.bat 等价，适合从 PowerShell / Windows Terminal 使用，
  并支持参数化调用（便于写入任务计划或自定义快捷方式）。

  用法：
    .\启动.ps1                      # 交互菜单
    .\启动.ps1 -Target player       # 播放器（预览档）
    .\启动.ps1 -Target review       # 播放器（评审档）
    .\启动.ps1 -Target verify       # 工程校验
    .\启动.ps1 -Target qc           # 画质巡检
    .\启动.ps1 -Target capture      # 母版输出
    .\启动.ps1 -Target serve        # 仅启动服务器
    .\启动.ps1 -Port 9000           # 指定端口
    .\启动.ps1 -Stop                # 停止服务器

  若提示"禁止运行脚本"，先执行：
    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#>
[CmdletBinding()]
param(
    [ValidateSet('menu', 'player', 'review', 'master', 'zh', 'en', 'vertical', 'verify', 'qc', 'capture', 'serve')]
    [string]$Target = 'menu',
    [int]$Port = 8777,
    [switch]$Stop,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Write-Head($text) {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor DarkCyan
    Write-Host "   $text" -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor DarkCyan
}
function Write-Step($n, $text) { Write-Host "[$n] $text" -ForegroundColor Gray }
function Write-Ok($text)       { Write-Host "      $text" -ForegroundColor Green }
function Write-Err($text)      { Write-Host "[错误] $text" -ForegroundColor Red }

# ── 端口占用检测 ────────────────────────────────────────────────
function Get-ServerProcess([int]$p) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop |
                Where-Object { $_.LocalAddress -in @('127.0.0.1', '0.0.0.0', '::') } |
                Select-Object -First 1
        if ($conn) { return Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue }
    } catch {
        $line = (netstat -ano | Select-String -Pattern "127\.0\.0\.1:$p\s.*LISTENING" | Select-Object -First 1)
        if ($line) {
            $procId = ($line.ToString() -split '\s+')[-1]
            if ($procId -match '^\d+$') { return Get-Process -Id ([int]$procId) -ErrorAction SilentlyContinue }
        }
    }
    return $null
}

# ── 停止模式 ────────────────────────────────────────────────────
if ($Stop) {
    Write-Head "停止 EUV 演示动画服务器（端口 $Port）"
    $proc = Get-ServerProcess $Port
    if ($proc) {
        Write-Host "发现监听进程 $($proc.ProcessName) (PID=$($proc.Id))，正在结束..." -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force
        Write-Ok '服务器已停止。'
    } else {
        Write-Host "端口 $Port 上没有正在运行的服务器。" -ForegroundColor Gray
    }
    return
}

Write-Head 'EUV 光刻原理 - 三维演示动画   PowerShell 启动器'

# ── 1. 查找 Python 3 ───────────────────────────────────────────
Write-Step '1/4' '查找 Python 3 ...'
$py = $null
foreach ($cand in @('python', 'python3', 'py')) {
    $cmd = Get-Command $cand -ErrorAction SilentlyContinue
    if ($cmd) { $py = if ($cand -eq 'py') { 'py -3' } else { $cmd.Source }; break }
}
if (-not $py) {
    foreach ($p in @(
        'E:\Conda\python.exe', 'D:\Conda\python.exe', 'C:\Conda\python.exe',
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
        "$env:ProgramFiles\Python312\python.exe",
        "$env:ProgramFiles\Python311\python.exe"
    )) { if (Test-Path $p) { $py = $p; break } }
}
if (-not $py) {
    Write-Err '未找到 Python 3。本项目只需标准库，无需第三方包。'
    Write-Host '      请从 https://www.python.org/downloads/ 安装 Python 3.8+，' -ForegroundColor Yellow
    Write-Host '      安装时勾选 "Add Python to PATH"，然后重新运行。' -ForegroundColor Yellow
    return
}
$pyver = & (($py -split ' ')[0]) -c "import sys;print('%d.%d'%sys.version_info[:2])" 2>$null
Write-Ok "Python $pyver  ($py)"

# ── 2. 工程完整性 ───────────────────────────────────────────────
Write-Step '2/4' '校验工程文件 ...'
$need = @('serve.py', 'index.html', 'src\main.js', 'src\params.js', 'src\layout.js',
          'src\script.js', 'vendor\three\build\three.module.js')
$missing = $need | Where-Object { -not (Test-Path (Join-Path $root $_)) }
if ($missing) {
    Write-Err "工程文件缺失: $($missing -join ', ')"
    Write-Host '      请确认本脚本位于 EUV 工程根目录下。' -ForegroundColor Yellow
    return
}
Write-Ok '工程文件完整'

# ── 3. 选择入口 ─────────────────────────────────────────────────
$routes = [ordered]@{
    player   = @{ path = 'index.html';                 desc = '播放器 - 预览档（流畅交互）' }
    review   = @{ path = 'index.html?q=review';        desc = '播放器 - 评审档（画质更高）' }
    master   = @{ path = 'index.html?q=master';        desc = '播放器 - 母版档（需独立显卡）' }
    zh       = @{ path = 'index.html?lang=zh';         desc = '播放器 - 中文字幕' }
    en       = @{ path = 'index.html?lang=en';         desc = '播放器 - 英文字幕' }
    vertical = @{ path = 'index.html?aspect=9:16';     desc = '播放器 - 竖版取景 9:16' }
    verify   = @{ path = 'test/verify.html';           desc = '工程校验 - 161 项自动断言' }
    qc       = @{ path = 'tools/qc.html';              desc = '画质巡检 - 全片曝光/闪烁/噪点扫描' }
    capture  = @{ path = 'tools/capture.html';         desc = '母版输出 - 逐帧/字幕/音频/静态资产' }
    serve    = @{ path = '';                           desc = '仅启动服务器（不打开浏览器）' }
}

if ($Target -eq 'menu') {
    Write-Host ''
    Write-Host '  请选择要打开的入口:' -ForegroundColor White
    Write-Host ''
    $i = 1
    $keys = @($routes.Keys)
    foreach ($k in $keys) {
        Write-Host ("    [{0}] {1,-10} {2}" -f $i, $k, $routes[$k].desc) -ForegroundColor Gray
        $i++
    }
    Write-Host ''
    $sel = Read-Host '  输入序号后回车（直接回车 = 1）'
    if ([string]::IsNullOrWhiteSpace($sel)) { $sel = '1' }
    $idx = 0
    if ([int]::TryParse($sel, [ref]$idx) -and $idx -ge 1 -and $idx -le $keys.Count) {
        $Target = $keys[$idx - 1]
    } else {
        $Target = 'player'
    }
}
$route = $routes[$Target].path
$url = "http://127.0.0.1:$Port/$route"

# ── 4. 启动或复用服务器 ─────────────────────────────────────────
$existing = Get-ServerProcess $Port
if ($existing) {
    Write-Step '3/4' "服务器已在端口 $Port 运行（PID=$($existing.Id)），直接复用"
    if (-not $NoBrowser -and $route -ne '') { Start-Process $url; Write-Ok "已打开 $url" }
    Write-Host ''
    Write-Host "  停止服务器: .\启动.ps1 -Stop" -ForegroundColor DarkGray
    return
}
Write-Step '3/4' "端口 $Port 空闲"
Write-Step '4/4' '启动本地服务器 ...'
Write-Host ''
Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
if ($route -ne '') { Write-Host "  浏览器将自动打开: $url" -ForegroundColor Cyan }
Write-Host '  在本窗口按 Ctrl+C 可停止服务器' -ForegroundColor DarkGray
Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
Write-Host ''

if (-not $NoBrowser -and $route -ne '') {
    Start-Job -ScriptBlock { Start-Sleep -Milliseconds 2000; Start-Process $using:url } | Out-Null
}

$exe = ($py -split ' ')[0]
$pre = @($py -split ' ' | Select-Object -Skip 1)
& $exe @pre 'serve.py' "$Port" '--no-open'

Write-Host ''
Write-Host '服务器已停止。' -ForegroundColor Gray
