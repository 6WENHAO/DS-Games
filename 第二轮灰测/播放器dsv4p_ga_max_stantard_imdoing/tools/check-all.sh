#!/usr/bin/env bash
# tools/check-all.sh — 一次跑完所有离线检查（无需浏览器）
set -u
cd "$(dirname "$0")/.."
fail=0

run() {
  echo ""
  echo "=============================================================="
  echo "  $1"
  echo "=============================================================="
  shift
  if "$@"; then
    echo "  ✓ 通过"
  else
    echo "  ✗ 失败"
    fail=1
  fi
}

run "1/5 滤镜与着色器静态检查 (lint-shaders)" node tools/lint-shaders.js
run "2/5 单元测试 (node:test)" node --test tests/timecode.test.js tests/frameclock.test.js tests/mp4index.test.js tests/zip.test.js tests/misc.test.js
run "3/5 启动与渲染冒烟测试 (最小 DOM + WebGL 桩)" node tools/smoke-dom.js
if command -v ffprobe >/dev/null 2>&1; then
  run "4/5 MP4 索引对照 ffprobe" node tools/verify-mp4index.js tests/fixtures/cfr30.mp4 tests/fixtures/cfr23976.mp4 tests/fixtures/fragmented.mp4 tests/fixtures/vfr.mp4 media/demo-motion-30fps.mp4 media/demo-pixelfriendly-24fps.mp4
else
  echo ""
  echo "  4/5 跳过：本机没有 ffprobe（这一步只是开发期与「地面真值」对照，运行播放器不需要它）"
fi
run "5/5 语法检查 (node --check 所有源码)" bash -c 'for f in src/*.js src/*/*.js src/*/*/*.js tools/*.js; do node --check "$f" || exit 1; done'

echo ""
if [ "$fail" = "0" ]; then
  echo "全部检查通过 ✓"
else
  echo "有检查未通过 ✗"
fi
exit $fail
