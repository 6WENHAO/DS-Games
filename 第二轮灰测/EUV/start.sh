#!/usr/bin/env bash
# =====================================================================
# start.sh — EUV 光刻原理 3D 演示动画  启动器
#            （Git Bash / WSL / macOS / Linux）
# ---------------------------------------------------------------------
# 用法:
#   ./start.sh              交互菜单
#   ./start.sh player       播放器（预览档）
#   ./start.sh review       播放器（评审档）
#   ./start.sh verify       工程校验
#   ./start.sh qc           画质巡检
#   ./start.sh capture      母版输出
#   ./start.sh serve        仅启动服务器
#   ./start.sh stop         停止服务器
#   PORT=9000 ./start.sh    指定端口
# =====================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
PORT="${PORT:-8777}"
ARG="${1:-menu}"

C_CY=$'\033[36m'; C_GY=$'\033[90m'; C_GR=$'\033[32m'; C_RD=$'\033[31m'; C_YL=$'\033[33m'; C_0=$'\033[0m'

# 注意：shell 函数名不得与系统命令重名。
# 此处原先叫 head()，它会覆盖 /usr/bin/head，使 port_pid 中的 `| head -1`
# 调用到本函数，导致 PID 解析出错 —— 实测踩到过，教训固化为此注释。
banner() { printf '%s\n' "${C_CY}============================================================${C_0}";
           printf '   %s\n' "${C_CY}$1${C_0}";
           printf '%s\n' "${C_CY}============================================================${C_0}"; }
step() { printf '%s\n' "${C_GY}[$1]${C_0} $2"; }
ok()   { printf '      %s\n' "${C_GR}$1${C_0}"; }
err()  { printf '%s\n' "${C_RD}[错误]${C_0} $1"; }

# ── 端口占用 PID ─────────────────────────────────────────────────
port_pid() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ano 2>/dev/null | grep -E "127\.0\.0\.1:$PORT[[:space:]].*LISTENING" | awk '{print $NF}' | head -1
  elif command -v ss >/dev/null 2>&1; then
    ss -lptn "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1
  fi
}

# ── 停止 ─────────────────────────────────────────────────────────
if [ "$ARG" = "stop" ]; then
  banner "停止 EUV 演示动画服务器（端口 $PORT）"
  PID="$(port_pid || true)"
  if [ -n "${PID:-}" ]; then
    printf '发现监听进程 PID=%s，正在结束...\n' "$PID"
    if command -v taskkill >/dev/null 2>&1; then taskkill //PID "$PID" //F >/dev/null 2>&1 || kill -9 "$PID" 2>/dev/null
    else kill -9 "$PID" 2>/dev/null; fi
    ok "服务器已停止。"
  else
    printf '%s\n' "${C_GY}端口 $PORT 上没有正在运行的服务器。${C_0}"
  fi
  exit 0
fi

banner "EUV 光刻原理 - 三维演示动画   启动器"

# ── 1. 查找 Python 3 ────────────────────────────────────────────
step "1/4" "查找 Python 3 ..."
PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1; then
    v="$("$c" -c 'import sys;print(sys.version_info[0])' 2>/dev/null || echo 0)"
    if [ "$v" = "3" ]; then PY="$c"; break; fi
  fi
done
if [ -z "$PY" ]; then
  for p in /e/Conda/python /d/Conda/python /c/Conda/python \
           "/c/Program Files/Python312/python" "/c/Program Files/Python311/python" \
           /usr/bin/python3 /usr/local/bin/python3 /opt/homebrew/bin/python3; do
    [ -x "$p" ] && PY="$p" && break
  done
fi
if [ -z "$PY" ]; then
  err "未找到 Python 3。本项目只需标准库，无需第三方包。"
  printf '      %s\n' "${C_YL}请安装 Python 3.8+ 后重试: https://www.python.org/downloads/${C_0}"
  exit 1
fi
ok "$("$PY" -c 'import sys;print("Python %d.%d"%sys.version_info[:2])')  ($PY)"

# ── 2. 工程完整性 ───────────────────────────────────────────────
step "2/4" "校验工程文件 ..."
MISSING=""
for f in serve.py index.html src/main.js src/params.js src/layout.js src/script.js \
         vendor/three/build/three.module.js; do
  [ -f "$f" ] || MISSING="$MISSING $f"
done
if [ -n "$MISSING" ]; then
  err "工程文件缺失:$MISSING"
  printf '      %s\n' "${C_YL}请确认本脚本位于 EUV 工程根目录下。${C_0}"
  exit 1
fi
ok "工程文件完整"

# ── 3. 选择入口 ─────────────────────────────────────────────────
route_of() {
  case "$1" in
    player)   echo "index.html" ;;
    review)   echo "index.html?q=review" ;;
    master)   echo "index.html?q=master" ;;
    zh)       echo "index.html?lang=zh" ;;
    en)       echo "index.html?lang=en" ;;
    vertical) echo "index.html?aspect=9:16" ;;
    verify)   echo "test/verify.html" ;;
    qc)       echo "tools/qc.html" ;;
    capture)  echo "tools/capture.html" ;;
    serve)    echo "" ;;
    *)        echo "index.html" ;;
  esac
}

if [ "$ARG" = "menu" ]; then
  printf '\n  请选择要打开的入口:\n\n'
  printf '    [1] player     播放器 - 预览档（流畅交互）\n'
  printf '    [2] review     播放器 - 评审档（画质更高）\n'
  printf '    [3] zh         播放器 - 中文字幕\n'
  printf '    [4] en         播放器 - 英文字幕\n'
  printf '    [5] vertical   播放器 - 竖版取景 9:16\n'
  printf '    [6] verify     工程校验 - 161 项自动断言\n'
  printf '    [7] qc         画质巡检 - 全片曝光/闪烁/噪点扫描\n'
  printf '    [8] capture    母版输出 - 逐帧/字幕/音频/静态资产\n'
  printf '    [9] serve      仅启动服务器\n\n'
  read -r -p "  输入序号后回车（直接回车 = 1）: " CH
  case "${CH:-1}" in
    1) ARG=player ;; 2) ARG=review ;; 3) ARG=zh ;; 4) ARG=en ;; 5) ARG=vertical ;;
    6) ARG=verify ;; 7) ARG=qc ;; 8) ARG=capture ;; 9) ARG=serve ;; *) ARG=player ;;
  esac
fi

ROUTE="$(route_of "$ARG")"
URL="http://127.0.0.1:$PORT/$ROUTE"

open_url() {
  [ -z "$ROUTE" ] && return 0
  if command -v cmd >/dev/null 2>&1;        then cmd //c start "" "$URL" >/dev/null 2>&1
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1;     then open "$URL" >/dev/null 2>&1
  else printf '  请手动打开: %s\n' "$URL"; fi
}

# ── 4. 启动或复用 ───────────────────────────────────────────────
PID="$(port_pid || true)"
if [ -n "${PID:-}" ]; then
  step "3/4" "服务器已在端口 $PORT 运行（PID=$PID），直接复用"
  open_url
  [ -n "$ROUTE" ] && ok "已打开 $URL"
  printf '\n  %s\n' "${C_GY}停止服务器: ./start.sh stop${C_0}"
  exit 0
fi
step "3/4" "端口 $PORT 空闲"
step "4/4" "启动本地服务器 ..."
printf '\n%s\n' "${C_GY}------------------------------------------------------------${C_0}"
[ -n "$ROUTE" ] && printf '  浏览器将自动打开: %s\n' "${C_CY}$URL${C_0}"
printf '  %s\n' "${C_GY}按 Ctrl+C 可停止服务器${C_0}"
printf '%s\n\n' "${C_GY}------------------------------------------------------------${C_0}"

( sleep 2; open_url ) &
"$PY" serve.py "$PORT" --no-open

printf '\n%s\n' "${C_GY}服务器已停止。${C_0}"
