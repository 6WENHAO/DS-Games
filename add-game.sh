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
      fi
    fi
  fi

  local THUMB_PART=""
  [ -n "$COVER_FILE" ] && [ -f "$COVER_FILE" ] && THUMB_PART=", thumb: \"$COVER_FILE\""

  local VIDEO_PART=""
  [ -n "$VIDEO_URL" ] && VIDEO_PART=", videoUrl: \"$VIDEO_URL\""

  local GAME_URL="./$AUTHOR_DIR/$GAME_DIR/$ENTRY"
  local TAG="Game"

  local NEW_ENTRY="      { title: \"$GAME_DIR\", author: \"$AUTHOR_DIR\", tag: \"$TAG\", gameUrl: \"$GAME_URL\"$VIDEO_PART$THUMB_PART }"

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

# 输出新游戏条目
if [ -s /tmp/new_games.txt ]; then
  echo ""
  echo "=== 待添加条目 (复制到 index.html 的 games 数组中) ==="
  cat /tmp/new_games.txt
else
  echo "没有发现新游戏。"
fi

# 新作者 B站空间
if [ -s /tmp/new_authors_bv.txt ]; then
  echo ""
  echo "=== 新作者 B站空间 (复制到 index.html 的 authorLinks 中) ==="
  sort -u /tmp/new_authors_bv.txt | while IFS='|' read -r author bv; do
    # 跳过已有的
    if grep -q "\"$author\":" "$INDEX_FILE" 2>/dev/null; then
      continue
    fi
    if [ -n "$bv" ]; then
      result=$(get_bilibili_space "$bv")
      uid=$(echo "$result" | cut -d'|' -f1)
      name=$(echo "$result" | cut -d'|' -f2)
      if [ -n "$uid" ] && [ "$uid" != "None" ]; then
        echo "  \"$author\": \"https://space.bilibili.com/$uid\",  # $name"
      else
        echo "  \"$author\": \"https://space.bilibili.com/<请手动查找>\","
      fi
    else
      echo "  \"$author\": \"https://space.bilibili.com/<请手动查找>\",  # 无视频链接，请手动搜索B站用户"
    fi
  done
fi
