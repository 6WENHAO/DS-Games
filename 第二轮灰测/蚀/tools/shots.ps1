# 无头截图批处理：渲染若干视角并输出 ASCII 分析
# 用法： powershell -ExecutionPolicy Bypass -File tools/shots.ps1
$ErrorActionPreference = 'Continue'
$root   = Split-Path -Parent $PSScriptRoot
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$shots  = Join-Path $root 'shots'
$prof   = Join-Path $env:TEMP 'eb_chrome_profile'
if (!(Test-Path $shots)) { New-Item -ItemType Directory $shots | Out-Null }

$uri = ([System.Uri]((Join-Path $root 'index.html'))).AbsoluteUri
Write-Host "ROOT=$root"
Write-Host "URI =$uri"

$cases = @(
  @{ name = 'title'; q = '' },
  @{ name = 'crypt'; q = '?dev=1&depth=1&nohud=1&pose=idle' },
  @{ name = 'swing'; q = '?dev=2&depth=2&nohud=1&pose=swing' },
  @{ name = 'heavy'; q = '?dev=2&depth=9&nohud=1&pose=hv' },
  @{ name = 'gut';   q = '?dev=2&depth=6&nohud=1&pose=idle' },
  @{ name = 'boss';  q = '?dev=1&depth=12&nohud=1&pose=idle' },
  @{ name = 'hud';   q = '?dev=2&depth=3&pose=swing' }
)

$only = $args[0]

foreach ($c in $cases) {
  if ($only -and $c.name -ne $only) { continue }
  $out = Join-Path $shots ("$($c.name).png")
  if (Test-Path $out) { Remove-Item $out -Force }
  $argList = @(
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-features=Translate,MediaRouter',
    "--user-data-dir=$prof",
    '--window-size=1280,720', '--virtual-time-budget=9000',
    "--screenshot=$out",
    "$uri$($c.q)"
  )
  & $chrome @argList 2>$null | Out-Null
  if (Test-Path $out) {
    Write-Host "`n#################### $($c.name)  $($c.q) ####################"
    node (Join-Path $root 'tools\pngstat.js') $out 100
  } else {
    Write-Host "!! 截图失败: $($c.name)"
  }
}
