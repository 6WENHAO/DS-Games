#!/usr/bin/env bash
# 无头渲染自检：chromium + SwiftShader 跑真 WebGL2，把 #selftest 文本抓出来。
# 纯文本断言 —— 不使用任何视觉模型。
#   ./test/headless.sh                       默认场景（长崎 21 kt 空爆）
#   ./test/headless.sh "W=15000&hob=2"       指定当量/爆高
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROF="$(mktemp -d /tmp/cr-nuke3d-XXXX)"
EXTRA="${1:-}"
URL="file://$DIR/index.html?selftest=1${EXTRA:+&$EXTRA}"
OUT="$(timeout 600 chromium --headless=new --no-sandbox --disable-gpu \
  --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader \
  --user-data-dir="$PROF" --window-size=1280,720 \
  --virtual-time-budget=420000 --dump-dom "$URL" 2>"$PROF/err.log")"
rm -rf "$PROF"
python3 - "$OUT" <<'PY'
import sys, re, html
dom = sys.argv[1]
m = re.search(r'<pre id="selftest"[^>]*>(.*?)</pre>', dom, re.S)
if not m:
    print("!! 未找到 #selftest 节点（页面可能未执行到自检）")
    e = re.search(r'<div id="err"[^>]*>(.*?)</div>', dom, re.S)
    if e: print(html.unescape(re.sub('<[^>]+>', '', e.group(1))))
    sys.exit(2)
txt = html.unescape(m.group(1))
print(txt)
sys.exit(0 if txt.startswith('SELFTEST:OK') else 1)
PY
