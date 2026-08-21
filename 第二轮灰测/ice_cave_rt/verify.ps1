# ---------------------------------------------------------------------------
#  One-shot acceptance check for the polar ice cave renderer.
#
#  Runs, end to end:
#    1. the phase-function math self test (numerical integration)
#    2. a Vulkan device probe
#    3. a low-resolution render with every AOV + the refraction-chain probe
#    4. the terminal image inspector on the beauty frame and the AOVs
#    5. the single-file WebGPU build: regenerate, static checks, and (with
#       -Web) a real head-less browser run + screenshot
#
#    .\verify.ps1              (about 1 minute on an integrated GPU)
#    .\verify.ps1 -Spp 64      (slower, cleaner)
#    .\verify.ps1 -Web         (also drive Edge/Chrome head-lessly, +40 s)
# ---------------------------------------------------------------------------
param([int]$Spp = 24, [int]$Width = 384, [int]$Height = 216, [switch]$Web)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$exe = Join-Path $root 'target\release\ice_cave_rt.exe'
if (-not (Test-Path $exe)) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'build.ps1') build --release
}
$out = Join-Path $root 'out\verify'
New-Item -ItemType Directory -Force -Path $out | Out-Null

Write-Host "`n=========== 1. phase function / diffraction math ===========" -ForegroundColor Cyan
python (Join-Path $root 'tools\check_math.py')

Write-Host "`n=========== 2. Vulkan devices ===========" -ForegroundColor Cyan
& $exe --list-gpus

Write-Host "`n=========== 3. render + AOV + refraction probe ===========" -ForegroundColor Cyan
& $exe --width $Width --height $Height --spp $Spp --preset hero `
       --out (Join-Path $out 'check.png') --hdr --aov `
       --probe "$([int]($Width*0.47)),$([int]($Height*0.55))" --print-params

Write-Host "`n=========== 4. beauty frame ===========" -ForegroundColor Cyan
python (Join-Path $root 'tools\imgview.py') (Join-Path $out 'check.png') --cols 104 --rows 26 `
    --region 0.42,0.15,0.62,0.45 mouth --region 0.0,0.4,0.15,0.95 near-wall `
    --region 0.75,0.3,1.0,0.9 deep-wall

Write-Host "`n=========== 5. volumetric in-scatter AOV (light columns) ===========" -ForegroundColor Cyan
python (Join-Path $root 'tools\imgview.py') (Join-Path $out 'check_aov_volumetric.pfm') --cols 104 --rows 22

Write-Host "`n=========== 6. subsurface AOV (ice block interiors) ===========" -ForegroundColor Cyan
python (Join-Path $root 'tools\imgview.py') (Join-Path $out 'check_aov_subsurface.pfm') --cols 104 --rows 22

Write-Host "`n=========== 7. single-file WebGPU build ===========" -ForegroundColor Cyan
python (Join-Path $root 'tools\build_html.py')
python (Join-Path $root 'tools\check_html.py')

if ($Web) {
    Write-Host "`n=========== 8. head-less browser run ===========" -ForegroundColor Cyan
    node (Join-Path $root 'tools\webgpu_smoketest.mjs') --seconds 30
    python (Join-Path $root 'tools\imgview.py') (Join-Path $root 'out\web_shot.png') --cols 104 --rows 22
}

Write-Host "`nAll verification artifacts are in $out" -ForegroundColor Green
