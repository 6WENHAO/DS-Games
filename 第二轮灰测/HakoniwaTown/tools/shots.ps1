# 无头截图脚本：多机位 / 多时刻批量渲染，便于检查画面
# 用法：pwsh -File tools/shots.ps1  [-Only day]
param([string]$Only = "")

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$base = "http://127.0.0.1:8123/index.html"
$dir = Join-Path $PSScriptRoot "shots"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$shots = @(
  @{ name = "day";      q = "?t=10.5&play=0&view=all" },
  @{ name = "dusk";     q = "?t=18.4&play=0&view=all" },
  @{ name = "night";    q = "?t=22.5&play=0&view=all" },
  @{ name = "plaza";    q = "?t=11&play=0&view=plaza&hud=0" },
  @{ name = "harbor";   q = "?t=9&play=0&view=harbor&hud=0" },
  @{ name = "hill";     q = "?t=16&play=0&view=hill&hud=0" },
  @{ name = "station";  q = "?t=13&play=0&view=station&hud=0" },
  @{ name = "fair";     q = "?t=20.4&play=0&view=fair&hud=0" }
)

foreach ($s in $shots) {
  if ($Only -ne "" -and $s.name -ne $Only) { continue }
  $out = Join-Path $dir ("{0}.png" -f $s.name)
  if (Test-Path $out) { Remove-Item $out }
  & $chrome --headless=new --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader `
    --hide-scrollbars --window-size=1400,860 --virtual-time-budget=40000 `
    --screenshot="$out" ($base + $s.q) 2>$null | Out-Null
  if (Test-Path $out) { "OK   $($s.name)  $((Get-Item $out).Length) bytes" } else { "FAIL $($s.name)" }
}
