#!/usr/bin/env bash
# =====================================================================
# encode_all.sh — 母版 / 正片 / 社媒衍生版 封装脚本
# 规格书 §2 交付物
# ---------------------------------------------------------------------
# 前置：
#   1) 已用 tools/capture.html 捕获帧序列到 EUV/out/frames/master/
#        文件名 EUV_master_%06d.png，3840×2160，30 fps
#   2) 已导出音频分轨到 EUV/out/audio/
#        EUV_music_48k24b.wav / EUV_sfx_48k24b.wav / EUV_mix_48k24b.wav
#   3) 已导出字幕到 EUV/out/subtitles/
#   4) 本机具备 ffmpeg（LGPL/GPL，仅作封装工具，不嵌入交付物）
#
# 用法：  cd EUV/delivery/scripts && ./encode_all.sh
# =====================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/out"
FRAMES="$OUT/frames/master"
AUDIO="$OUT/audio"
SUBS="$OUT/subtitles"
DELIV="$OUT/deliverables"
FPS=30
VER="v01"

mkdir -p "$DELIV"/{master,promo,social,subtitles,audio,stills}

need() { command -v "$1" >/dev/null 2>&1 || { echo "缺少依赖: $1"; exit 1; }; }
need ffmpeg
need ffprobe

# ── 0. 帧序列完整性校验（对应验收清单「无未渲染帧」）──────────────
echo "== 0. 校验帧序列完整性 =="
COUNT=$(find "$FRAMES" -name 'EUV_master_*.png' | wc -l | tr -d ' ')
EXPECT=5400
echo "   实测 $COUNT 帧 / 期望 $EXPECT 帧"
if [ "$COUNT" -ne "$EXPECT" ]; then
  echo "   !! 帧数不符，检查捕获是否完成后再继续" >&2
fi
# 帧号连续性
python - "$FRAMES" <<'PY'
import os, re, sys
d = sys.argv[1]
ns = sorted(int(re.search(r'(\d{6})\.png$', f).group(1))
            for f in os.listdir(d) if re.search(r'EUV_master_\d{6}\.png$', f))
if not ns:
    print('   !! 未找到帧文件'); raise SystemExit(1)
gaps = [(a, b) for a, b in zip(ns, ns[1:]) if b != a + 1]
sizes = [os.path.getsize(os.path.join(d, 'EUV_master_%06d.png' % n)) for n in ns]
med = sorted(sizes)[len(sizes)//2]
small = [n for n, s in zip(ns, sizes) if s < med * 0.12]
print('   帧号区间 %d..%d，缺口 %d 处，异常小文件 %d 个（中位 %d B）'
      % (ns[0], ns[-1], len(gaps), len(small), med))
for a, b in gaps[:10]:
    print('     缺口: %d -> %d' % (a, b))
for n in small[:10]:
    print('     异常小: %d' % n)
PY

# ── 1. 母版：ProRes 422 HQ + PCM 24-bit ─────────────────────────────
echo "== 1. 母版 ProRes 422 HQ =="
ffmpeg -y -hide_banner \
  -framerate $FPS -start_number 0 -i "$FRAMES/EUV_master_%06d.png" \
  -i "$AUDIO/EUV_mix_48k24b.wav" \
  -map 0:v -map 1:a \
  -c:v prores_ks -profile:v 3 -vendor apl0 -pix_fmt yuv422p10le \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a pcm_s24le -ar 48000 \
  -shortest \
  "$DELIV/master/EUV_master_ZH-EN_3840x2160_30p_ProRes422HQ_$VER.mov"

# ── 1b. 母版备份：EXR 序列打包（无损，供后续调色/重制）──────────────
echo "== 1b. 母版帧序列清单 =="
( cd "$FRAMES" && ls EUV_master_*.png | head -3; echo "..." ; ls EUV_master_*.png | tail -1 ) \
  > "$DELIV/master/EUV_master_frames_index.txt"
echo "   帧序列保留在 out/frames/master/（PNG 16bit-capable、无损）"

# ── 2. 正片：H.264 与 H.265（外挂 + 烧录两版）────────────────────────
echo "== 2. 正片 H.264 / H.265 =="
MASTER_MOV="$DELIV/master/EUV_master_ZH-EN_3840x2160_30p_ProRes422HQ_$VER.mov"

ffmpeg -y -hide_banner -i "$MASTER_MOV" \
  -c:v libx264 -preset slow -crf 18 -profile:v high -level 5.1 -pix_fmt yuv420p \
  -g 60 -bf 3 -movflags +faststart \
  -c:a aac -b:a 320k -ar 48000 \
  -metadata title="EUV 光刻原理 · How EUV Lithography Works" \
  "$DELIV/promo/EUV_promo_ZH-EN_3840x2160_30p_H264_$VER.mp4"

ffmpeg -y -hide_banner -i "$MASTER_MOV" \
  -c:v libx265 -preset slow -crf 22 -pix_fmt yuv420p10le -tag:v hvc1 \
  -x265-params "keyint=60:bframes=4" -movflags +faststart \
  -c:a aac -b:a 320k -ar 48000 \
  "$DELIV/promo/EUV_promo_ZH-EN_3840x2160_30p_H265_$VER.mp4"

# 1080p 通用分发版
ffmpeg -y -hide_banner -i "$MASTER_MOV" \
  -vf "scale=1920:1080:flags=lanczos" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -g 60 -movflags +faststart \
  -c:a aac -b:a 256k -ar 48000 \
  "$DELIV/promo/EUV_promo_ZH-EN_1920x1080_30p_H264_$VER.mp4"

# 烧录字幕版（中文 / 英文 / 双语）
for L in zh en bi; do
  if [ -f "$SUBS/EUV_$L.ass" ]; then
    ffmpeg -y -hide_banner -i "$MASTER_MOV" \
      -vf "ass=$SUBS/EUV_$L.ass" \
      -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -g 60 -movflags +faststart \
      -c:a aac -b:a 256k -ar 48000 \
      "$DELIV/promo/EUV_promo_burnin-$L\_1920x1080_30p_H264_$VER.mp4"
  fi
done

# ── 3. 社媒衍生版：30s / 60s，横版 + 竖版 ───────────────────────────
# 剪辑区间由 src/script.js 的 CUTS 定义，并由 make_cuts.py 生成 concat 清单
echo "== 3. 社媒衍生版 =="
python "$HERE/make_cuts.py" --root "$ROOT" || { echo "make_cuts.py 失败"; exit 1; }

for CUT in social60 social30; do
  LIST="$OUT/cuts/${CUT}_concat.txt"
  [ -f "$LIST" ] || { echo "   跳过 $CUT（缺 $LIST）"; continue; }
  SEC=$([ "$CUT" = "social60" ] && echo 60 || echo 30)

  # 横版 1920×1080
  ffmpeg -y -hide_banner -f concat -safe 0 -i "$LIST" \
    -vf "scale=1920:1080:flags=lanczos,fps=$FPS" \
    -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -g 60 -movflags +faststart \
    -c:a aac -b:a 256k -ar 48000 \
    "$DELIV/social/EUV_${CUT}_h_ZH-EN_1920x1080_30p_H264_$VER.mp4"

  # 竖版 1080×1920（居中裁切 + 上下留白排版由 HUD 竖版取景负责，此处为安全裁切）
  ffmpeg -y -hide_banner -f concat -safe 0 -i "$LIST" \
    -vf "crop=ih*9/16:ih,scale=1080:1920:flags=lanczos,fps=$FPS" \
    -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -g 60 -movflags +faststart \
    -c:a aac -b:a 256k -ar 48000 \
    "$DELIV/social/EUV_${CUT}_v_ZH-EN_1080x1920_30p_H264_$VER.mp4"
done

# ── 4. 归集字幕 / 音频 / 静态资产 ──────────────────────────────────
echo "== 4. 归集字幕 / 音频 / 静态资产 =="
cp -f "$SUBS"/*.srt "$SUBS"/*.ass "$SUBS"/*.tsv "$DELIV/subtitles/" 2>/dev/null || true
cp -f "$AUDIO"/*.wav "$AUDIO"/*.md "$DELIV/audio/" 2>/dev/null || true
cp -rf "$OUT/stills/." "$DELIV/stills/" 2>/dev/null || true

# ── 5. 响度复核 + 交付校验 ────────────────────────────────────────
echo "== 5. 响度复核（ffmpeg loudnorm）=="
bash "$HERE/measure_loudness.sh" || true

echo "== 6. 交付物清单 =="
find "$DELIV" -type f -printf '%10s  %p\n' 2>/dev/null | sort -k2 || find "$DELIV" -type f | sort
echo
echo "完成。交付目录：$DELIV"
