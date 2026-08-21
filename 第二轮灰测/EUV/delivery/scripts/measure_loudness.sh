#!/usr/bin/env bash
# =====================================================================
# measure_loudness.sh — 响度权威复核（ffmpeg loudnorm / EBU R128）
# 规格书 §2 音频：响度 ≈ −14 LUFS，真峰值 ≤ −1 dBTP
# ---------------------------------------------------------------------
# src/audio.js 的 measureLoudness() 给出近似值用于快速自检；
# 本脚本以 ffmpeg 的 loudnorm 与 ebur128 滤镜作为权威测量与归一化。
# 用法: ./measure_loudness.sh [目标LUFS] [真峰值dBTP]
# =====================================================================
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/out"
AUDIO="$OUT/audio"
REPORT="$OUT/reports/loudness_ffmpeg.txt"
TARGET_I="${1:--14}"
TARGET_TP="${2:--1.0}"

command -v ffmpeg >/dev/null 2>&1 || { echo "缺少依赖: ffmpeg"; exit 1; }
mkdir -p "$OUT/reports" "$AUDIO/normalized"

: > "$REPORT"
echo "EUV 音频响度测量报告（ffmpeg EBU R128）" | tee -a "$REPORT"
echo "目标：I = ${TARGET_I} LUFS，TP ≤ ${TARGET_TP} dBTP" | tee -a "$REPORT"
echo "生成时间：$(date -Iseconds)" | tee -a "$REPORT"
echo "-----------------------------------------------------------" | tee -a "$REPORT"

shopt -s nullglob
FILES=("$AUDIO"/*.wav "$OUT/deliverables/master"/*.mov "$OUT/deliverables/promo"/*.mp4)
if [ ${#FILES[@]} -eq 0 ]; then
  echo "未找到待测音频/视频，请先导出音频分轨或封装母版。" | tee -a "$REPORT"
  exit 0
fi

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  echo "" | tee -a "$REPORT"
  echo "### $(basename "$f")" | tee -a "$REPORT"
  # 第一遍：测量
  MEAS=$(ffmpeg -hide_banner -nostats -i "$f" \
          -af "loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=11:print_format=json" \
          -f null - 2>&1 | sed -n '/{/,/}/p')
  if [ -z "$MEAS" ]; then
    echo "  测量失败（该文件可能无音轨）" | tee -a "$REPORT"
    continue
  fi
  echo "$MEAS" | tee -a "$REPORT"

  I=$(echo "$MEAS"  | grep -o '"input_i"[^,]*'  | grep -o '\-\?[0-9.]*$' || echo "")
  TP=$(echo "$MEAS" | grep -o '"input_tp"[^,]*' | grep -o '\-\?[0-9.]*$' || echo "")
  LRA=$(echo "$MEAS" | grep -o '"input_lra"[^,]*' | grep -o '\-\?[0-9.]*$' || echo "")
  echo "  → 积分响度 ${I:-?} LUFS / 真峰值 ${TP:-?} dBTP / LRA ${LRA:-?}" | tee -a "$REPORT"

  # 判定
  if [ -n "$I" ] && [ -n "$TP" ]; then
    python - "$I" "$TP" "$TARGET_I" "$TARGET_TP" <<'PY' | tee -a "$REPORT"
import sys
i, tp, ti, ttp = map(float, sys.argv[1:5])
ok_i = abs(i - ti) <= 1.0
ok_tp = tp <= ttp + 0.05
print('  判定：响度 %s（偏差 %+.2f LU），真峰值 %s' % (
    '通过' if ok_i else '需归一化', i - ti, '通过' if ok_tp else '超限'))
PY
  fi

  # 第二遍：仅对 WAV 分轨输出归一化版本（视频交付由母版统一混音，不在此处改动）
  case "$f" in
    *.wav)
      base=$(basename "$f" .wav)
      ffmpeg -y -hide_banner -loglevel error -i "$f" \
        -af "loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=11:linear=true" \
        -c:a pcm_s24le -ar 48000 "$AUDIO/normalized/${base}_norm.wav" \
        && echo "  已输出归一化版本: audio/normalized/${base}_norm.wav" | tee -a "$REPORT"
      ;;
  esac
done

echo "" | tee -a "$REPORT"
echo "报告已写入: $REPORT"
