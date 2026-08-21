# ===================================================================
# tools/browsercheck.ps1 - run scenarios in a real browser and dump the
# in-page self-check report (<pre id="report">, produced by
# js/main.js writeReport) to shots/reports/*.html
#
# Then assert with:  node tools/browsercheck.js
#
# NOTE: this file is intentionally pure ASCII. Windows PowerShell 5.1
# decodes .ps1 files using the system ANSI codepage unless a UTF-8 BOM
# is present, and our editing tools do not preserve the BOM, so any
# non-ASCII character here would randomly break parsing.
#
# Usage: powershell -ExecutionPolicy Bypass -File tools/browsercheck.ps1 [name]
# ===================================================================
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'shots\reports'
$prof = Join-Path $env:TEMP 'st_edge_check'

$edge = $null
foreach ($p in @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)) { if (Test-Path $p) { $edge = $p; break } }
if (-not $edge) { Write-Host "ERROR: Edge/Chrome not found"; exit 1 }
if (!(Test-Path $out)) { New-Item -ItemType Directory $out | Out-Null }

$uri = ([System.Uri]((Join-Path $root 'index.html'))).AbsoluteUri
Write-Host "browser = $edge"

$cases = @(
  @{ name = 'fresh';  q = '?dev=1&seed=20240601&report=30' },
  @{ name = 'nofog';  q = '?dev=1&seed=20240601&fog=0&report=30' },
  @{ name = 'mid';    q = '?dev=1&seed=20240601&auto=1&fast=170&report=30&bench=40' },
  @{ name = 'battle'; q = '?dev=1&seed=20240601&auto=1&fast=150&spawn=1&report=40&bench=40' },
  @{ name = 'late';   q = '?dev=1&seed=7&auto=1&fast=420&diff=hard&fog=0&report=40&zoom=0.75&bench=40' },
  @{ name = 'steel';  q = '?dev=1&seed=99&faction=steel&auto=1&fast=200&tab=inf&report=30' },
  @{ name = 'place';  q = '?dev=1&seed=20240601&auto=1&fast=170&place=refinery&report=30' },
  @{ name = 'ion';    q = '?dev=1&seed=20240601&auto=1&fast=170&ion=aim&report=30' },
  @{ name = 'sel';    q = '?dev=1&seed=20240601&auto=1&fast=170&sel=1&tab=veh&report=30' },
  @{ name = 'small';  q = '?dev=1&seed=555&size=small&auto=1&fast=120&report=30' },
  @{ name = 'large';  q = '?dev=1&seed=777&size=large&auto=1&fast=300&report=30&zoom=0.6&bench=40' },
  @{ name = 'zoomin'; q = '?dev=1&seed=20240601&auto=1&fast=170&zoom=1.9&report=30' },
  @{ name = 'audio';  q = '?dev=1&seed=20240601&auto=1&fast=170&audioinit=1&report=30'; audio = $true }
)

$only = $args[0]
foreach ($c in $cases) {
  if ($only -and $c.name -ne $only) { continue }
  $f = Join-Path $out ("$($c.name).html")
  $argList = @(
    '--headless=new', '--disable-gpu',
    '--allow-file-access-from-files', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-features=Translate,MediaRouter',
    "--user-data-dir=$prof",
    '--window-size=1600,900',
    '--virtual-time-budget=14000',
    '--dump-dom',
    ($uri + $c.q)
  )
  # audio scenario needs an AudioContext without a real user gesture
  if ($c.audio) { $argList = @('--autoplay-policy=no-user-gesture-required') + $argList }
  & $edge @argList 2>$null | Out-File -Encoding utf8 $f
  $sz = if (Test-Path $f) { (Get-Item $f).Length } else { 0 }
  $hasReport = if ((Test-Path $f) -and (Select-String -Path $f -Pattern 'id="report"' -Quiet)) { 'report:yes' } else { 'report:NO' }
  Write-Host ("{0,-8} {1,8}b  {2,-11} {3}" -f $c.name, $sz, $hasReport, $c.q)
}
Write-Host ""
Write-Host "now run: node tools/browsercheck.js"
