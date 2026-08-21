param(
  [string]$Q = "diag=1&planet=thalassa&alt=12&pitch=-35",
  [string]$Out = "shot.png",
  [int]$W = 1280, [int]$H = 720
)
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$root = Split-Path -Parent $PSScriptRoot
$url = "file:///" + ($root -replace '\\','/') + "/index.html?" + $Q
$outPath = Join-Path $PSScriptRoot ("shots\" + $Out)
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot "shots") | Out-Null
$tmp = Join-Path $env:TEMP ("edgeprof_" + [guid]::NewGuid().ToString('N').Substring(0,8))
& $edge --headless=new --disable-gpu-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader `
  --hide-scrollbars --mute-audio --no-first-run --no-default-browser-check `
  --user-data-dir="$tmp" --window-size="$W,$H" --virtual-time-budget=6000 `
  --screenshot="$outPath" "$url" 2>&1 | Out-String | Write-Host
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
if (Test-Path $outPath) { "OK -> $outPath ($((Get-Item $outPath).Length) bytes)" } else { "FAILED: no screenshot" }
