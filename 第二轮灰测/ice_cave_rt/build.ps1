# ---------------------------------------------------------------------------
#  Local build/run helper for THIS machine (no global Rust install required).
#
#  * uses the workspace-local toolchain in ..\.toolchain
#  * injects the x86-hosted / x64-targeting MSVC linker + Windows SDK libs
#    directly (cmd.exe's 8191-char limit makes vcvars*.bat unusable from the
#    harness shell, so the three variables rustc actually needs are set here)
#
#  Examples:
#     .\build.ps1 build --release
#     .\build.ps1 run --release -- --preset hero --out out\hero.png
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

$root      = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$toolchain = Join-Path (Split-Path -Parent $root) '.toolchain'
$msvc      = 'C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133'
$sdkLib    = 'C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0'

$env:RUSTUP_HOME = Join-Path $toolchain 'rustup'
$env:CARGO_HOME  = Join-Path $toolchain 'cargo'
$env:PATH = (@(
    (Join-Path $env:CARGO_HOME 'bin'),
    (Join-Path $msvc 'bin\HostX86\x64'),
    (Join-Path $msvc 'bin\HostX86\x86'),
    "$env:SystemRoot\system32",
    "$env:SystemRoot"
) -join ';')
$env:LIB = (@(
    (Join-Path $msvc 'lib\x64'),
    (Join-Path $sdkLib 'ucrt\x64'),
    (Join-Path $sdkLib 'um\x64')
) -join ';')
# HostX86 link.exe needs its own directory for mspdbcore.dll etc. (already on PATH)

& (Join-Path $env:CARGO_HOME 'bin\cargo.exe') @args
exit $LASTEXITCODE
