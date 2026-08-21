#!/usr/bin/env bash
# start.sh — Linux / macOS 一键启动（自动挑选 Node 或 Python，都没有就提示直接开 index.html）
set -u
cd "$(dirname "$0")"

PORT="${1:-8321}"

echo "dsv4p max stantard imdoing — 启动本地服务器（端口 $PORT）"
echo

if command -v node >/dev/null 2>&1; then
  echo "  → 使用 Node.js ($(node -v))"
  exec node tools/serve.js --port "$PORT" --open
elif command -v python3 >/dev/null 2>&1; then
  echo "  → 使用 Python 3 ($(python3 -V 2>&1))"
  exec python3 tools/serve.py --port "$PORT" --open
elif command -v python >/dev/null 2>&1; then
  echo "  → 使用 Python ($(python -V 2>&1))"
  exec python tools/serve.py --port "$PORT" --open
else
  cat <<'EOF'
  未找到 Node.js 或 Python。

  你仍然可以直接用浏览器打开本目录下的 index.html：
     · 点「打开视频」用文件选择器选本地视频（这种方式在 file:// 下也能正常上纹理）
     · 但「演示片」按钮走的是相对路径，可能被浏览器判为跨源而无法应用滤镜

  想用本地服务器的话，装任意一个即可：Node.js 或 Python 3。
EOF
  exit 1
fi
