# ===================================================================
# tools/shots.ps1 - headless screenshots + ASCII analysis
#
# NOTE: pure ASCII on purpose. Windows PowerShell 5.1 decodes .ps1 with
# the system ANSI codepage unless a UTF-8 BOM is present, and our editing
# tools do not preserve the BOM -> non-ASCII here breaks parsing.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tools/shots.ps1          # all
#   powershell -ExecutionPolicy Bypass -File tools/shots.ps1 battle   # one
# ===================================================================
$ErrorActionPreference = 'Continue'
$root  = Split-Path -Parent $PSScriptRoot
$shots = Join-Path $root 'shots'
$prof  = Join-Path $env:TEMP 'st_edge_shots'

$edge = $null
foreach ($p in @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)) { if (Test-Path $p) { $edge = $p; break } }
if (-not $edge) { Write-Host "ERROR: Edge/Chrome not found"; exit 1 }
if (!(Test-Path $shots)) { New-Item -ItemType Directory $shots | Out-Null }

$uri = ([System.Uri]((Join-Path $root 'index.html'))).AbsoluteUri
Write-Host "browser = $edge"
Write-Host "page    = $uri"

$cases = @(
  @{ name = 'title';  q = '';                                                            w = 1600; h = 900 },
  @{ name = 'help';   q = '#screen=help';                                                w = 1600; h = 900 },
  @{ name = 'tech';   q = '#screen=tech';                                                w = 1600; h = 1000 },
  @{ name = 'start';  q = '?dev=1&seed=20240601&debug=1';                                w = 1600; h = 900 },
  @{ name = 'base';   q = '?dev=1&seed=20240601&auto=1&fast=170&debug=1';                w = 1600; h = 900 },
  @{ name = 'place';  q = '?dev=1&seed=20240601&auto=1&fast=170&place=refinery';          w = 1600; h = 900 },
  @{ name = 'battle'; q = '?dev=1&seed=20240601&auto=1&fast=150&spawn=1&debug=1';         w = 1600; h = 900 },
  @{ name = 'select'; q = '?dev=1&seed=20240601&auto=1&fast=170&sel=1&tab=veh';           w = 1600; h = 900 },
  @{ name = 'ion';    q = '?dev=1&seed=20240601&auto=1&fast=170&ion=aim';                 w = 1600; h = 900 },
  @{ name = 'fogoff'; q = '?dev=1&seed=20240601&auto=1&fast=260&fog=0&zoom=0.62';         w = 1600; h = 900 },
  @{ name = 'late';   q = '?dev=1&seed=7&auto=1&fast=420&diff=hard&debug=1&zoom=0.8';     w = 1600; h = 900 },
  @{ name = 'steel';  q = '?dev=1&seed=99&faction=steel&auto=1&fast=200&tab=inf';         w = 1600; h = 900 }
)

$only = $args[0]

foreach ($c in $cases) {
  if ($only -and $c.name -ne $only) { continue }
  $out = Join-Path $shots ("$($c.name).png")
  if (Test-Path $out) { Remove-Item $out -Force }

  $argList = @(
    '--headless=new', '--disable-gpu',
    '--allow-file-access-from-files', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-features=Translate,MediaRouter',
    '--autoplay-policy=no-user-gesture-required',
    "--user-data-dir=$prof",
    "--window-size=$($c.w),$($c.h)",
    '--virtual-time-budget=12000',
    "--screenshot=$out",
    ($uri + $c.q)
  )
  & $edge @argList 2>$null | Out-Null

  if (Test-Path $out) {
    $sz = [math]::Round((Get-Item $out).Length / 1024)
    Write-Host ""
    Write-Host ("#" * 20 + " $($c.name)  ${sz}KB  $($c.q) " + "#" * 20)
    node (Join-Path $root 'tools\pngstat.js') $out 108
  } else {
    Write-Host "FAILED: $($c.name)"
  }
}
