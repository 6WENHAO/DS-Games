# ---------------------------------------------------------------------------
#  Render every showcase frame of the polar ice cave.
#
#    .\render_all.ps1            production  (hero 960x540/160spp, rest 640x360/96)
#    .\render_all.ps1 -Quick     fast preview (all 400x225/32spp)
#    .\render_all.ps1 -Anim      also render the ice-crystal animation sequence
# ---------------------------------------------------------------------------
param(
    [switch]$Quick,
    [switch]$Anim
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$exe = Join-Path $root 'target\release\ice_cave_rt.exe'
if (-not (Test-Path $exe)) {
    Write-Host 'building...' -ForegroundColor Cyan
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'build.ps1') build --release
}

$out = Join-Path $root 'out'
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Render($name, $w, $h, $spp, $extra) {
    if ($Quick) { $w = 400; $h = 225; $spp = 32 }
    Write-Host "=== $name  ${w}x${h} @ ${spp}spp ===" -ForegroundColor Cyan
    $a = @('--preset', $name, '--width', $w, '--height', $h, '--spp', $spp,
           '--out', (Join-Path $out "$name.png")) + $extra
    & $exe @a
}

# hero: light columns + blown exterior + backlit blocks, with AOVs and a probe
Render 'hero'    960 540 160 @('--hdr', '--aov', '--probe', '470,300', '--print-params')
# shafts: the collimated columns seen against the dark ceiling
Render 'shafts'  640 360 80  @('--hdr', '--aov')
# block: subsurface scattering close-up (LED-filament look)
Render 'block'   640 360 80  @('--hdr', '--aov')
# glory: antisolar diffraction rings in the mist (boosted diffraction lobes)
Render 'glory'   640 360 80  @('--hdr', '--glory', '0.20', '--corona', '0.10', '--halo', '0.12',
                              '--xsize', '48', '--fog', '0.60', '--fog-height', '0.7')
# section: outside-in cross section of the cave mouth
Render 'section' 640 360 80  @('--hdr', '--aov')

if ($Anim) {
    Write-Host '=== crystal animation (10 frames) ===' -ForegroundColor Cyan
    & $exe --preset shafts --width 384 --height 216 --spp 32 --frames 10 --fps 10 `
           --out (Join-Path $out 'anim\crystal.png')
    Write-Host 'encode with:  ffmpeg -framerate 10 -i out/anim/crystal_%04d.png -pix_fmt yuv420p out/crystal.mp4'
}

Write-Host "`ndone. outputs in $out" -ForegroundColor Green
