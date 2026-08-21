# run-browser-check.ps1 —— 无头浏览器自检
#  1) 由真实 index.html 生成临时 __check.html（追加 tools/check.js）
#  2) chrome --headless --dump-dom 抓回 DOM
#  3) 解析出自检文本 + 两态画面 PNG/JPG，只打印摘要（不污染上下文）
param(
  [string]$Root = "G:\桌面\测试\huice\1",
  [string]$Url  = "http://127.0.0.1:8199",
  [string]$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
)
$ErrorActionPreference = 'Stop'
$html = Get-Content -LiteralPath (Join-Path $Root 'index.html') -Raw -Encoding UTF8
$html = $html.Replace('</body>', '<script type="module" src="./tools/check.js"></script>' + "`n</body>")
$checkPath = Join-Path $Root '__check.html'
Set-Content -LiteralPath $checkPath -Value $html -Encoding UTF8

$dump = Join-Path $env:TEMP 'dsh-optimus-dump.html'
$prof = Join-Path $env:TEMP 'dsh-optimus-prof'
Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue

$cargs = @(
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  "--user-data-dir=$prof", '--window-size=800,500', '--dump-dom', "$Url/__check.html"
)
& $Chrome @cargs 2>$null | Out-File -LiteralPath $dump -Encoding UTF8
$raw = Get-Content -LiteralPath $dump -Raw -Encoding UTF8
Remove-Item -LiteralPath $checkPath -Force -ErrorAction SilentlyContinue

Write-Output ("dump 大小: " + [math]::Round($raw.Length/1024,1) + " KB")
$m = [regex]::Match($raw, '<title>([^<]*)</title>')
if ($m.Success) { Write-Output ("title  : " + $m.Groups[1].Value) }

$m = [regex]::Match($raw, '<pre id="check-result">(?<body>.*?)</pre>', 'Singleline')
if ($m.Success) {
  $txt = $m.Groups['body'].Value
  $txt = [System.Net.WebUtility]::HtmlDecode($txt)
  Write-Output "---------------- 浏览器自检输出 ----------------"
  Write-Output $txt
  Write-Output "-----------------------------------------------"
} else {
  Write-Output "!! 未找到 check-result（main.js 可能在早期就崩了）"
  $e = [regex]::Match($raw, '<pre id="err-msg">(?<b>.*?)</pre>', 'Singleline')
  if ($e.Success -and $e.Groups['b'].Value.Trim()) {
    Write-Output "页面错误："
    Write-Output ([System.Net.WebUtility]::HtmlDecode($e.Groups['b'].Value))
  }
}

foreach ($k in @('robot','vehicle','night')) {
  $s = [regex]::Match($raw, ('<div id="shot-' + $k + '"[^>]*>data:image/(?<fmt>\w+);base64,(?<b64>[A-Za-z0-9+/=]+)</div>'))
  if ($s.Success) {
    $bytes = [Convert]::FromBase64String($s.Groups['b64'].Value)
    $ext = if ($s.Groups['fmt'].Value -eq 'jpeg') { 'jpg' } else { $s.Groups['fmt'].Value }
    $p = Join-Path $Root ("tools\shot-$k.$ext")
    [IO.File]::WriteAllBytes($p, $bytes)
    Write-Output ("画面 " + $k.PadRight(8) + " → " + $p + "  (" + [math]::Round($bytes.Length/1024,1) + " KB)")
  } else {
    Write-Output ("画面 " + $k + " 缺失")
  }
}
