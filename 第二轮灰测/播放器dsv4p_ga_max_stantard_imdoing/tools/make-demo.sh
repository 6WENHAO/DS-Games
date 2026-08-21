#!/usr/bin/env bash
# tools/make-demo.sh — 生成随包演示视频与自测样片（需要 ffmpeg，仅开发时使用；播放器本身不依赖 ffmpeg）
#
# 用法：  bash tools/make-demo.sh            # 生成 media/ 下的演示片
#         bash tools/make-demo.sh --tests    # 额外生成 tests/fixtures 下的样片（用于校验 MP4 索引器）
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
MEDIA="$ROOT/media"
FIX="$ROOT/tests/fixtures"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
[ -f "$FONT" ] || FONT="$(fc-match -f '%{file}' mono 2>/dev/null || true)"

mkdir -p "$MEDIA"

label() { # 帧号 + SMPTE 时间码 + 秒，烧进画面，方便肉眼验证「帧级定位」
  local rate="$1"
  echo "drawtext=fontfile='${FONT}':text='FRAME %{frame_num}':x=14:y=12:fontsize=26:fontcolor=white:box=1:boxcolor=0x101018@0.72:boxborderw=8,\
drawtext=fontfile='${FONT}':timecode='00\\:00\\:00\\:00':r=${rate}:x=14:y=48:fontsize=22:fontcolor=0x7ef7ff:box=1:boxcolor=0x101018@0.72:boxborderw=8,\
drawtext=fontfile='${FONT}':text='%{pts\\:hms}':x=14:y=80:fontsize=20:fontcolor=0xffd479:box=1:boxcolor=0x101018@0.72:boxborderw=8"
}

echo "==> media/demo-motion-30fps.mp4 (640x360 @30fps, 8s, 烧入帧号/时间码)"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=640x360:rate=30:duration=8" \
  -f lavfi -i "sine=frequency=330:duration=8:sample_rate=44100" \
  -vf "$(label 30)" \
  -c:v libx264 -preset veryslow -crf 27 -pix_fmt yuv420p -profile:v high -g 30 \
  -c:a aac -b:a 48k -movflags +faststart -shortest \
  "$MEDIA/demo-motion-30fps.mp4"

echo "==> media/demo-pixelfriendly-24fps.mp4 (硬边几何图形，最适合像素/调色板滤镜)"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=0x101820:size=480x270:rate=24:duration=6" \
  -f lavfi -i "testsrc2=size=480x270:rate=24:duration=6" \
  -filter_complex "[1:v]hue=s=1.6,eq=contrast=1.25[t];[0:v][t]overlay=0:0,\
drawbox=x='if(gte(t,0),80+120*sin(t*1.7),0)':y=150:w=60:h=60:color=0xff5f5f@1:t=fill,\
drawbox=x='if(gte(t,0),300-100*cos(t*1.1),0)':y=60:w=44:h=44:color=0x5fffa8@1:t=fill,\
$(label 24)" \
  -c:v libx264 -preset veryslow -crf 26 -pix_fmt yuv420p -g 24 -an -movflags +faststart \
  "$MEDIA/demo-pixelfriendly-24fps.mp4"

ls -la "$MEDIA"

if [ "${1:-}" = "--tests" ]; then
  mkdir -p "$FIX"
  echo "==> tests/fixtures: cfr30 / cfr23.976 / fragmented / vfr"
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=128x72:rate=30:duration=2" \
    -c:v libx264 -preset ultrafast -crf 34 -pix_fmt yuv420p -g 15 -an "$FIX/cfr30.mp4"
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=128x72:rate=24000/1001:duration=2" \
    -c:v libx264 -preset ultrafast -crf 34 -pix_fmt yuv420p -g 12 -an "$FIX/cfr23976.mp4"
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=128x72:rate=30:duration=2" \
    -c:v libx264 -preset ultrafast -crf 34 -pix_fmt yuv420p -g 15 -an \
    -movflags frag_keyframe+empty_moov+default_base_moof "$FIX/fragmented.mp4"
  # VFR：把 30fps 与 12fps 两段直接拼接（-c copy），stts 会出现不同间隔
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=128x72:rate=30:duration=1" \
    -c:v libx264 -preset ultrafast -crf 34 -pix_fmt yuv420p -g 15 -an -bsf:v h264_mp4toannexb -f mpegts "$FIX/_a.ts"
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=128x72:rate=12:duration=1" \
    -c:v libx264 -preset ultrafast -crf 34 -pix_fmt yuv420p -g 6 -an -bsf:v h264_mp4toannexb -f mpegts "$FIX/_b.ts"
  ffmpeg -hide_banner -loglevel error -y -i "concat:$FIX/_a.ts|$FIX/_b.ts" -c copy -fflags +genpts "$FIX/vfr.mp4"
  rm -f "$FIX/_a.ts" "$FIX/_b.ts"
  ls -la "$FIX"
fi
echo "完成。"
