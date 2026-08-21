#!/usr/bin/env bash
# 黑块探测：逐帧读回像素做分块/连通域分析，输出 ASCII 亮度图。
#   ./test/blackbox.sh                 全图层
#   ./test/blackbox.sh "off=part"      关闭粒子（二分定位）
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROF="$(mktemp -d /tmp/cr-bb-XXXX)"
Q="${1:-}"
URL="file://$DIR/index.html?blackbox=1${Q:+&$Q}"
OUT="$(timeout 600 chromium --headless=new --no-sandbox --disable-gpu \
  --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader \
  --user-data-dir="$PROF" --window-size=960,540 \
  --virtual-time-budget=400000 --dump-dom "$URL" 2>"$PROF/err.log")"
rm -rf "$PROF"
python3 - "$OUT" <<'PY'
import sys, re, html
m = re.search(r'<pre id="selftest"[^>]*>(.*?)</pre>', sys.argv[1], re.S)
print(html.unescape(m.group(1)) if m else "!! 无输出 !!")
PY
