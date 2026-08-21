# =============================================================================
# tools/shots.ps1 - capture headless screenshots of several views and print a
# text preview of each so the render can be checked from the console.
#   pwsh -File tools/shots.ps1
# =============================================================================
param(
  [string]$Root = (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)),
  [int]$W = 1280,
  [int]$H = 800,
  [int]$Cols = 100,
  [int]$Rows = 38
)
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" }
$shots = Join-Path $Root 'shots'
New-Item -ItemType Directory -Force -Path $shots | Out-Null
$tmp = Join-Path $env:TEMP 'tanksim-chrome'

$views = @(
  @{ name = 'driver';     q = 'view=driver&pitch=-0.10' },
  @{ name = 'driver_out'; q = 'view=driver&pitch=0.02&hatch=1' },
  @{ name = 'gunner';     q = 'view=gunner&yaw=-0.5&pitch=-0.05' },
  @{ name = 'loader';     q = 'view=loader&yaw=-1.4&pitch=-0.15' },
  @{ name = 'commander';  q = 'view=commander&yaw=2.9&pitch=-0.1' },
  @{ name = 'sight';      q = 'view=sight&az=0&elev=1.2' },
  @{ name = 'periscope';  q = 'view=periscope' },
  @{ name = 'cupola';     q = 'view=cupola&yaw=0.2' },
  @{ name = 'unbuttoned'; q = 'view=unbuttoned&hatch=1&pitch=-0.15' },
  @{ name = 'chase';      q = 'view=chase' },
  @{ name = 'orbit';      q = 'view=orbit&pitch=0.2' }
)

foreach ($v in $views) {
  $png = Join-Path $shots ($v.name + '.png')
  $url = "file:///" + ($Root -replace '\\', '/') + "/index.html?autostart=1&engine=1&load=1&" + $v.q
  $a = @('--headless=new', '--no-sandbox', '--disable-breakpad', '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files', "--user-data-dir=$tmp", "--window-size=$W,$H",
    '--virtual-time-budget=18000', "--screenshot=$png", $url)
  Start-Process -FilePath $chrome -ArgumentList $a -Wait -NoNewWindow | Out-Null
  if (Test-Path $png) {
    Write-Host ("=" * 100)
    Write-Host ("VIEW: " + $v.name + "   " + $v.q)
    node (Join-Path $Root 'tools\png.js') $png $Cols $Rows
  } else {
    Write-Host ("MISSING screenshot for " + $v.name)
  }
}
