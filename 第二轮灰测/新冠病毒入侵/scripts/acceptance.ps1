# 一键验收：构建 → 启动本地服务器 → 无头浏览器逐步截图 + 页面内自检 → 像素分析
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\acceptance.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\acceptance.ps1 -Port 4190 -Quality medium -SkipBuild
#
# 产物：
#   shots/step01..step08.png   八个步骤的关键帧截图
#   shots/selftest.json        页面内自检结果（科学不变量 + 渲染预算）
#   控制台输出                  逐图像素分析（关键配色占比、亮度）
#
# 注意：本文件以 UTF-8 BOM 保存，否则 Windows PowerShell 5.1 会把中文读成乱码。

param(
  [int]$Port = 4182,
  [ValidateSet('low', 'medium', 'high')][string]$Quality = 'high',
  [switch]$SkipBuild,
  [int]$Width = 1600,
  [int]$Height = 1000
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) { throw '未找到 Chrome / Edge，无法执行无头截图验收' }
Write-Host "浏览器：$chrome"

if (-not $SkipBuild) {
  Write-Host '→ 类型检查与构建…'
  & npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { throw '类型检查未通过' }
  & npx vite build
  if ($LASTEXITCODE -ne 0) { throw '构建失败' }
}

New-Item -ItemType Directory -Force -Path shots | Out-Null
Remove-Item shots\*.png -ErrorAction SilentlyContinue
Remove-Item shots\selftest.json, shots\reports.jsonl -ErrorAction SilentlyContinue

Write-Host "→ 启动验收服务器 :$Port"
$server = Start-Process -FilePath 'node' -ArgumentList "scripts/verify-server.mjs $Port dist" -PassThru -WindowStyle Hidden

# 浏览器会把无关警告写进 stderr，这里不能让它们中断流程
$common = @(
  '--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-sync', '--mute-audio', '--log-level=3', '--disable-logging'
)

try {
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 400
    try {
      Invoke-WebRequest "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 3 | Out-Null
      $ready = $true
      break
    }
    catch {}
  }
  if (-not $ready) { throw "验收服务器未能在 :$Port 启动" }

  # 每步取一个有代表性的时刻定格
  $moments = @(
    @{ step = 1; t = 0.55 }, @{ step = 2; t = 0.70 }, @{ step = 3; t = 0.80 }, @{ step = 4; t = 0.90 },
    @{ step = 5; t = 0.55 }, @{ step = 6; t = 0.85 }, @{ step = 7; t = 0.97 }, @{ step = 8; t = 0.85 }
  )
  foreach ($m in $moments) {
    $name = 'step{0:d2}' -f $m.step
    $url = "http://127.0.0.1:$Port/?step=$($m.step)&t=$($m.t)&paused=1&rotate=0&quality=$Quality&perf=1"
    Write-Host "→ 截图 $name (t=$($m.t))"
    & $chrome $common "--window-size=$Width,$Height" '--virtual-time-budget=25000' "--screenshot=$root\shots\$name.png" $url 2>&1 | Out-Null
  }

  Write-Host '→ 页面内自检'
  & $chrome $common '--window-size=1400,900' '--virtual-time-budget=45000' "--screenshot=$root\shots\selftest.png" "http://127.0.0.1:$Port/?selftest=1&quality=$Quality&paused=1" 2>&1 | Out-Null
  Start-Sleep -Seconds 2
}
finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}

Write-Host ''
$exit = 0
if (Test-Path shots\selftest.json) {
  $j = Get-Content shots\selftest.json -Raw -Encoding utf8 | ConvertFrom-Json
  Write-Host "自检结果：$($j.verdict)  $($j.passed)/$($j.total)  画质=$($j.quality)"
  foreach ($r in $j.results) {
    if ($r.pass) { Write-Host "  [PASS] $($r.name) :: $($r.detail)" }
    else { Write-Host "  [FAIL] $($r.name) :: $($r.detail)"; $exit = 1 }
  }
  if ($j.perStepTriangles) { Write-Host "  各步三角形峰值：$($j.perStepTriangles -join ' / ')" }
  if ($j.perStepCalls) { Write-Host "  各步绘制调用峰值：$($j.perStepCalls -join ' / ')" }
  if ($j.verdict -ne 'PASS') { $exit = 1 }
}
else {
  Write-Warning '未取到自检结果（shots/selftest.json 不存在）'
  $exit = 1
}

Write-Host ''
Write-Host '→ 截图像素分析'
& node scripts/analyze-shot.mjs shots

exit $exit
