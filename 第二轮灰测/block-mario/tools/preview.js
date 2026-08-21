/* =========================================================
   tools/preview.js — 渲染素材表与真实游戏画面为 PNG
   并输出数值体检 + ASCII 缩略图（无图形环境也能验收画面）
   运行: node tools/preview.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { install, load, ALL, Raster, writePNG, ROOT } = require('./env.js');
install();
const G = load(ALL);
const PX = G.PX;

const OUT = path.join(ROOT, 'preview');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const RAMP = ' .:-=+*x#%@';
function report(name, cv, cols) {
  const w = cv.width, h = cv.height, d = cv.data;
  cols = cols || 92;
  const rows = Math.max(1, Math.round(cols * h / w / 2.1));
  const uniq = new Set();
  let sum = 0, n = 0;
  const lines = [];
  for (let r0 = 0; r0 < rows; r0++) {
    let s = '';
    for (let c = 0; c < cols; c++) {
      let br = 0, cnt = 0;
      const x0 = Math.floor(c * w / cols), x1 = Math.min(w, Math.ceil((c + 1) * w / cols));
      const y0 = Math.floor(r0 * h / rows), y1 = Math.min(h, Math.ceil((r0 + 1) * h / rows));
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        const i = (y * w + x) * 4;
        br += (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * (d[i + 3] / 255);
        cnt++;
      }
      br = cnt ? br / cnt : 0;
      s += RAMP[Math.min(RAMP.length - 1, Math.floor(br / 255 * RAMP.length))];
    }
    lines.push(s);
  }
  for (let i = 0; i < w * h; i += 4 * 11) {
    const p = i * 4;
    if (d[p + 3] < 8) continue;
    uniq.add((d[p] >> 3) << 10 | (d[p + 1] >> 3) << 5 | (d[p + 2] >> 3));
    sum += d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11; n++;
  }
  console.log(`  颜色数≈${uniq.size}  平均亮度 ${(n ? sum / n : 0).toFixed(0)}`);
  lines.forEach(l => console.log('  |' + l + '|'));
  if (uniq.size < 24) console.log('  ⚠ 颜色偏少，可能有渲染问题');
}

/* ---------- 1. 素材总表 ---------- */
function sheet() {
  const S = 3, pad = 8;
  const W = 1180, H = 900;
  const cv = new Raster(W, H), x = cv.getContext();
  x.fillStyle = '#1b1e24'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#232730';
  for (let j = 0; j < H / 16; j++) for (let i = 0; i < W / 16; i++) if ((i + j) % 2) x.fillRect(i * 16, j * 16, 16, 16);

  let cy = pad;
  // 玩家全部姿态与帧
  PX.playerPoses.forEach(pose => {
    let cx = pad;
    for (let f = 0; f < PX.poseFrames(pose); f++) {
      const img = PX.player(pose, f);
      x.drawImage(img, cx, cy, img.width * S, img.height * S);
      cx += img.width * S + 6;
    }
    cy += 0;
    if (pose === 'run') cy += 0;
    cy = cy; // 同一行排列
    if (cx > W - 200) cy += 130;
    else cy += 130;
  });
  // 怪物
  cy = pad + 130 * PX.playerPoses.length;
  let cx2 = pad;
  PX.mobNames.forEach(m => {
    for (let f = 0; f < PX.mobFrames(m); f++) {
      const img = PX.mob(m, f);
      x.drawImage(img, cx2, cy, img.width * 2.4, img.height * 2.4);
      cx2 += img.width * 2.4 + 6;
    }
    cx2 += 14;
  });
  const bytes = writePNG(path.join(OUT, 'sheet-chars.png'), cv);
  console.log(`\n✔ preview/sheet-chars.png ${W}x${H} ${(bytes / 1024).toFixed(0)}KB  (每行一种姿态: ${PX.playerPoses.join('/')}；末行怪物)`);
}

/* ---------- 2. 方块与道具表 ---------- */
function sheetTiles() {
  const S = 4;
  const names = PX.tileNames;
  const cols = 10;
  const W = cols * (16 * S + 8) + 8, H = Math.ceil(names.length / cols) * (16 * S + 8) + 8 + 120;
  const cv = new Raster(W, H), x = cv.getContext();
  x.fillStyle = '#1b1e24'; x.fillRect(0, 0, W, H);
  names.forEach((n, i) => {
    const px = 8 + (i % cols) * (16 * S + 8), py = 8 + Math.floor(i / cols) * (16 * S + 8);
    // 用 mask=2（下方有方块，顶部暴露）展示，最能体现自动拼接效果
    x.drawImage(PX.tile(n, 2, 0), px, py, 16 * S, 16 * S);
  });
  let py2 = 8 + Math.ceil(names.length / cols) * (16 * S + 8) + 10;
  let px2 = 8;
  PX.itemNames.forEach(n => {
    for (let f = 0; f < PX.itemFrames(n); f++) {
      const img = PX.item(n, f);
      x.drawImage(img, px2, py2, img.width * S, img.height * S);
      px2 += img.width * S + 6;
    }
    px2 += 10;
  });
  const bytes = writePNG(path.join(OUT, 'sheet-tiles.png'), cv);
  console.log(`✔ preview/sheet-tiles.png ${W}x${H} ${(bytes / 1024).toFixed(0)}KB`);
  console.log('  方块顺序: ' + names.join(' '));
  console.log('  道具顺序: ' + PX.itemNames.join(' '));
}

/* ---------- 3. 真实游戏画面 ---------- */
function scene(idx, seconds, label) {
  const cv = new Raster(1280, 720);
  G.Game.headlessInit(cv);
  G.Game.startLevel(idx);
  const S = G.S, p = S.player;
  const DT = 1 / 60;
  let jumpCd = 0;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    p.hearts = p.maxHearts;
    const I = G.Input;
    I.keys = { KeyD: true, ShiftLeft: true };
    const tx = Math.floor((p.x + p.w + 3) / 16), ty = Math.floor((p.y + p.h - 2) / 16);
    const footY = Math.floor((p.y + p.h + 2) / 16);
    let wall = G.solidAt(tx, ty) || G.solidAt(tx, ty - 1);
    let gap = !G.solidAt(tx, footY) && !G.oneWayAt(tx, footY);
    let hz = false;
    for (let k = 0; k <= 3; k++) { const d = G.tileDefAt(tx + k, footY); if (d && d.hazard) hz = true; }
    jumpCd -= DT;
    if (p.onGround && jumpCd <= 0 && (wall || gap || hz)) { I.jumpBuffer = 0.13; I.keys.Space = true; jumpCd = 0.25; }
    else if (!p.onGround && p.vy < 0 && (wall || gap || hz)) I.keys.Space = true;
    G.Game.tick(DT);
    G.Input.endFrame(DT);
    if (S.mode === 'clear' || S.mode === 'dead') break;
  }
  G.Game.render();
  const bytes = writePNG(path.join(OUT, label + '.png'), cv);
  console.log(`\n✔ preview/${label}.png 1280x720 ${(bytes / 1024).toFixed(0)}KB  [${S.level.name} x=${Math.round(p.x / 16)}格 怪物${S.mobs.length} 道具${S.items.length} 粒子${S.parts.length}]`);
  report(label, cv, 92);
}

sheet();
sheetTiles();
scene(0, 3.2, 'scene-1-plains');
scene(1, 3.0, 'scene-2-cave');
scene(2, 3.4, 'scene-3-nether');
scene(3, 2.6, 'scene-4-end');
console.log('\n完成：preview/ 下已生成 6 张 PNG。');
