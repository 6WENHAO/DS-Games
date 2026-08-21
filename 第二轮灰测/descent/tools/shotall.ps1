param([switch]$Dom)
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$root = Split-Path -Parent $PSScriptRoot
$shots = Join-Path $PSScriptRoot "shots"
New-Item -ItemType Directory -Force -Path $shots | Out-Null

$cases = @(
  @{ n = 'a_thalassa_high'; q = 'diag=1&planet=thalassa&alt=68&pitch=-42&T=2050&v=980&t=9' },
  @{ n = 'b_thalassa_deck'; q = 'diag=1&planet=thalassa&alt=12&pitch=-32&v=70&t=15' },
  @{ n = 'c_thalassa_sea';  q = 'diag=1&planet=thalassa&alt=0.35&pitch=-24&v=45&t=22' },
  @{ n = 'd_thalassa_under';q = 'diag=1&planet=thalassa&alt=0&under=1&depth=26&pitch=35&t=30' },
  @{ n = 'e_ymir_decks';    q = 'diag=1&planet=ymir&alt=70&pitch=-28&v=140&t=18' },
  @{ n = 'f_ashkelon_lava'; q = 'diag=1&planet=ashkelon&alt=2.2&pitch=-40&v=40&t=12' },
  @{ n = 'g_niflheim_ice';  q = 'diag=1&planet=niflheim&alt=5.5&pitch=-30&v=52&t=20' },
  @{ n = 'h_rakhat_dust';   q = 'diag=1&planet=rakhat&alt=7&pitch=-26&v=60&t=14' },
  @{ n = 'i_titanis_haze';  q = 'diag=1&planet=titanis&alt=1.1&pitch=-22&v=8&t=25' },
  @{ n = 'j_menu';          q = 'menu=1' }
)

foreach ($c in $cases) {
  $url = "file:///" + ($root -replace '\\', '/') + "/index.html?" + $c.q
  $png = Join-Path $shots ($c.n + ".png")
  $tmp = Join-Path $env:TEMP ("ep_" + [guid]::NewGuid().ToString('N').Substring(0, 8))
  $args = @(
    '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--disable-sync', '--disable-features=Translate,MediaRouter',
    "--user-data-dir=$tmp", '--window-size=1280,720', '--virtual-time-budget=7000',
    "--screenshot=$png"
  )
  if ($Dom) { $args += '--dump-dom' }
  $out = & $edge @args $url 2>$null | Out-String
  if ($Dom) {
    $domFile = Join-Path $shots ($c.n + ".dom.txt")
    Set-Content -Path $domFile -Value $out -Encoding UTF8
    $diag = [regex]::Match($out, '(?s)<div id="diag"[^>]*>(.*?)</div>')
    if ($diag.Success) { Write-Host ("--- " + $c.n + " diag ---`n" + ($diag.Groups[1].Value -replace '&lt;', '<' -replace '&gt;', '>' -replace '&amp;', '&')) }
    else { Write-Host ("--- " + $c.n + ": no #diag in dom") }
  }
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  if (Test-Path $png) { Write-Host ("[ok] " + $c.n + "  " + [int]((Get-Item $png).Length / 1024) + "KB") }
  else { Write-Host ("[FAIL] " + $c.n) }
}
