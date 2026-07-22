#!/bin/bash
# 新增游戏脚本
# 不带参数: 自动扫描新游戏，获取封面和B站空间
# 带参数:   ./add-game.sh <作者目录> <游戏目录>
set -e

COVERS_DIR="covers"
INDEX_FILE="index.html"

# 通过 BV 号获取 B站空间链接
get_bilibili_space() {
  local BV="$1"
  local UID=$(curl -s "https://api.bilibili.com/x/web-interface/view?bvid=$BV" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('data',{}).get('owner',{}); print(f\"{u.get('mid','')}|{u.get('name','')}\")" 2>/dev/null)
  echo "$UID"
}

add_game() {
  local AUTHOR_DIR="$1"
  local GAME_DIR="$2"
  local FULL_PATH="$AUTHOR_DIR/$GAME_DIR"

  echo "=== $AUTHOR_DIR / $GAME_DIR ==="

  local ENTRY=""
  if [ -f "$FULL_PATH/index.html" ]; then
    ENTRY="index.html"
  elif [ -f "$FULL_PATH/game.html" ]; then
    ENTRY="game.html"
  else
    ENTRY=$(ls "$FULL_PATH"/*.html 2>/dev/null | head -1 | xargs -0 basename 2>/dev/null || true)
    [ -z "$ENTRY" ] && ENTRY=$(find "$FULL_PATH" -maxdepth 1 -name "*.html" -print0 2>/dev/null | xargs -0 -n1 basename | head -1)
  fi

  if [ -z "$ENTRY" ]; then
    echo "  ⚠ 未找到 HTML 入口文件，跳过"
    return
  fi
  echo "  入口: $ENTRY"

  local VIDEO_URL=""
  local VIDEO_FILE="$FULL_PATH/视频链接.txt"
  if [ -f "$VIDEO_FILE" ]; then
    VIDEO_URL=$(cat "$VIDEO_FILE" | tr -d '\n\r' | xargs)
  fi
  [ -n "$VIDEO_URL" ] && echo "  视频: $VIDEO_URL" || echo "  视频: (无)"

  local BV=""
  local COVER_FILE=""
  if [ -n "$VIDEO_URL" ]; then
    BV=$(echo "$VIDEO_URL" | grep -oE 'BV[a-zA-Z0-9]+' | head -1)
  fi

  if [ -n "$BV" ]; then
    COVER_FILE="$COVERS_DIR/${BV}.jpg"
    if [ -f "$COVER_FILE" ]; then
      echo "  封面: 已存在 $COVER_FILE"
    else
      local PIC_URL=$(curl -s "https://api.bilibili.com/x/web-interface/view?bvid=$BV" \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('pic',''))" 2>/dev/null)
      if [ -n "$PIC_URL" ]; then
        curl -sL -o "$COVER_FILE" "$PIC_URL"
        echo "  封面: 已下载 $COVER_FILE"
        # 超过 300K 则压缩
        local SIZE=$(wc -c < "$COVER_FILE" | tr -d ' ')
        if [ "$SIZE" -gt 307200 ]; then
          python3 -c "
from PIL import Image
img = Image.open('$COVER_FILE')
if img.mode in ('RGBA','P'): img = img.convert('RGB')
w, h = img.size
if w > 1200 or h > 1200: img.thumbnail((1200,1200))
img.save('$COVER_FILE', 'JPEG', quality=75, optimize=True)
" 2>/dev/null
          local SIZE2=$(wc -c < "$COVER_FILE" | tr -d ' ')
          echo "  封面: 已压缩 $(echo $SIZE | awk '{printf \"%.0f\",$1/1024}')K → $(echo $SIZE2 | awk '{printf \"%.0f\",$1/1024}')K"
        fi
      fi
    fi
  fi

  local THUMB_PART=""
  [ -n "$COVER_FILE" ] && [ -f "$COVER_FILE" ] && THUMB_PART=", thumb: \"$COVER_FILE\""

  local VIDEO_PART=""
  [ -n "$VIDEO_URL" ] && VIDEO_PART=", videoUrl: \"$VIDEO_URL\""

  local GAME_URL="./$AUTHOR_DIR/$GAME_DIR/$ENTRY"
  local TAG="Game"

  local NEW_ENTRY="      { title: \"$GAME_DIR\", author: \"$AUTHOR_DIR\", tag: \"$TAG\", gameUrl: \"$GAME_URL\"$VIDEO_PART$THUMB_PART },"

  echo ""
  echo "  $NEW_ENTRY"
  echo ""

  echo "$NEW_ENTRY" >> /tmp/new_games.txt

  # 记录作者、BV，用于获取B站空间
  if [ -n "$BV" ]; then
    echo "$AUTHOR_DIR|$BV" >> /tmp/new_authors_bv.txt
  else
    echo "$AUTHOR_DIR|" >> /tmp/new_authors_bv.txt
  fi
}

# ====== 主流程 ======
cd "$(dirname "$0")"

rm -f /tmp/new_games.txt /tmp/new_authors_bv.txt
touch /tmp/new_games.txt /tmp/new_authors_bv.txt

if [ -n "$1" ] && [ -n "$2" ]; then
  # 手动模式
  add_game "$1" "$2"
else
  # 自动扫描模式
  echo "=== 扫描新游戏 ==="
  echo ""

  for AUTHOR_DIR in */; do
    AUTHOR=$(basename "$AUTHOR_DIR")
    [ "$AUTHOR" = "covers" ] && continue
    [ "$AUTHOR" = ".git" ] && continue
    [ ! -d "$AUTHOR_DIR" ] && continue

    for GAME_DIR in "$AUTHOR_DIR"*/; do
      [ ! -d "$GAME_DIR" ] && continue
      GAME=$(basename "$GAME_DIR")
      if grep -q "$AUTHOR/$GAME" "$INDEX_FILE" 2>/dev/null; then
        continue
      fi
      add_game "$AUTHOR" "$GAME"
    done
  done

  # UPLUZ 平铺文件检查
  if [ -d "UPLUZ" ]; then
    for HTML_FILE in UPLUZ/*.html; do
      [ ! -f "$HTML_FILE" ] && continue
      if grep -q "$HTML_FILE" "$INDEX_FILE" 2>/dev/null; then continue; fi
      echo "⚠ UPLUZ 平铺文件: $HTML_FILE (请手动处理)"
    done
  fi
fi

# ====== 自动写入 index.html ======
if [ -s /tmp/new_games.txt ]; then
  echo ""
  echo "=== 写入 index.html ==="
  
  python3 << 'PYEOF'
import os

with open("index.html", "r") as f:
    lines = f.readlines()

# 收集新游戏条目
new_games = []
if os.path.exists("/tmp/new_games.txt"):
    with open("/tmp/new_games.txt") as f:
        for l in f:
            l = l.rstrip()
            if l and l not in new_games:
                new_games.append(l)

# 去重：已存在的跳过
for entry in new_games:
    if any(entry in line for line in lines):
        new_games.remove(entry)

# 新作者收集
new_authors = {}
if os.path.exists("/tmp/new_authors_bv.txt"):
    with open("/tmp/new_authors_bv.txt") as f:
        for l in f:
            parts = l.strip().split("|")
            author = parts[0]
            uid = parts[1] if len(parts) > 1 else ""
            name = parts[2] if len(parts) > 2 else ""
            if author not in new_authors:
                new_authors[author] = (uid, name)

inserted_games = 0
inserted_authors = 0
new_lines = []

for line in lines:
    # 在 ]; 之前插入新游戏（games 数组之后，authorLinks 之前）
    if line.strip() == "];" and inserted_games < len(new_games) and '"authorLinks"' not in ''.join(new_lines[-5:]):
        # 确保上一行有逗号
        if new_lines and not new_lines[-1].rstrip().endswith(','):
            new_lines[-1] = new_lines[-1].rstrip() + ',\n'
        for entry in new_games:
            if entry not in '\n'.join(new_lines):
                new_lines.append(entry + '\n')
                inserted_games += 1
                print(f"  + {entry.split('title: \"')[1].split('\"')[0] if 'title: \"' in entry else entry}")
    
    new_lines.append(line)

# 重新加载以便插入作者
lines2 = new_lines
new_lines2 = []
for line in lines2:
    if line.strip() == "};" and inserted_authors < len(new_authors) and "authorLinks" in '\n'.join(new_lines2[-10:]):
        for author, (uid, name) in new_authors.items():
            if f'"{author}":' not in ''.join(new_lines2):
                if uid and uid != "None":
                    entry = f'      "{author}": "https://space.bilibili.com/{uid}",  # {name}\n'
                else:
                    entry = f'      "{author}": "https://space.bilibili.com/<请手动查找>",\n'
                new_lines2.append(entry)
                inserted_authors += 1
                print(f"  + authorLink: {author}")
    new_lines2.append(line)

with open("index.html", "w") as f:
    f.writelines(new_lines2)

print(f"\nDone. {inserted_games} games, {inserted_authors} authors added.")
PYEOF

else
  echo "没有发现新游戏。"
fi
