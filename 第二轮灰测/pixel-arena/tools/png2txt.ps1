# tools/png2txt.ps1 — 截图 → 调色板索引 ASCII 图（供无视觉环境目检）
# 用法: pwsh -File tools/png2txt.ps1 <png路径> [横向采样步长] [纵向采样步长] [起始x] [起始y] [宽] [高]
param(
  [Parameter(Mandatory=$true)][string]$Path,
  [int]$Sx = 4,
  [int]$Sy = 8,
  [int]$X0 = 0,
  [int]$Y0 = 0,
  [int]$W = 0,
  [int]$H = 0
)
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($Path)
$W = if ($W -gt 0) { $W } else { $bmp.Width }
$H = if ($H -gt 0) { $H } else { $bmp.Height }

# 32 色调色板（与 js/palette.js 一致）
$pal = @('#0d1420','#101820','#1c2c44','#2c4a6e','#46749a','#6ea0c4','#a4c8e0','#e0eef4',
         '#f6f2e0','#ecdca8','#c8b488','#a8845c','#7c5c3c','#543c28','#1e3a24','#2a5c34',
         '#3f8a48','#62b45c','#94d470','#c8e89a','#f4d858','#e8a02c','#e06038','#c83838',
         '#8c2030','#4ab4e8','#2a70b8','#d878c8','#a848b8','#5c2c7c','#f8f8f8','#8a92a4')
$CH = '0123456789ABCDEFGHIJKLMNOPQRSTUV'

function Nearest-Pal([int]$r, [int]$g, [int]$b) {
  $best = 0; $bestD = [int]::MaxValue
  for ($i = 0; $i -lt 32; $i++) {
    $pr = [Convert]::ToInt32($pal[$i].Substring(1,2), 16)
    $pg = [Convert]::ToInt32($pal[$i].Substring(3,2), 16)
    $pb = [Convert]::ToInt32($pal[$i].Substring(5,2), 16)
    $d = ($r-$pr)*($r-$pr) + ($g-$pg)*($g-$pg) + ($b-$pb)*($b-$pb)
    if ($d -lt $bestD) { $bestD = $d; $best = $i }
  }
  return $best
}

$sb = New-Object System.Text.StringBuilder
for ($y = $Y0; $y -lt [Math]::Min($Y0 + $H, $bmp.Height); $y += $Sy) {
  $line = ''
  for ($x = $X0; $x -lt [Math]::Min($X0 + $W, $bmp.Width); $x += $Sx) {
    $c = $bmp.GetPixel($x, $y)
    $line += $CH[Nearest-Pal $c.R $c.G $c.B]
  }
  [void]$sb.AppendLine($line)
}
$bmp.Dispose()
Write-Output $sb.ToString()
