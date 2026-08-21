/* =====================================================================
 * 紫禁城 体素模型 — ASCII 平面/体量校验图
 *   node --max-old-space-size=6144 tools/ascii.js
 * 把体素俯视投影降采样成字符图，用于直接核对总平面与体量分布。
 * 字符横向 7 m / 纵向 13 m 取样，以补偿等宽字体约 1:2 的字格比例。
 * 上北下南、左西右东。
 * ===================================================================== */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
for (const f of ['00-palette', '10-voxel', '15-field', '20-arch', '25-comp',
                 '30-plan', '40-city', '50-outer', '60-inner', '70-build'])
  require(path.join(ROOT, 'js', f + '.js'));
const G = globalThis, B = G.GGPalette.BLOCK, LIST = G.GGPalette.LIST;

const res = G.BuildCity({ log: () => {} });
const vox = res.voxels, tiles = res.tiles;

/* ---- 材质 → 字符 ---- */
const CH = {};
function mapc(keys, ch) { keys.forEach(k => { CH[B[k]] = ch; }); }
mapc(['TILE_Y', 'TILE_Y_D', 'TILE_Y_L', 'RIDGE', 'BEAST', 'FINIAL', 'GILT'], '#');
mapc(['TILE_G', 'TILE_G_D', 'RIDGE_G'], 'G');
mapc(['TILE_K'], 'K');
mapc(['TILE_ASH'], 'a');
mapc(['WALL_R', 'WALL_R_D', 'COL_R', 'DOOR_R', 'LATTICE', 'BEAM_B', 'BEAM_G', 'DOUGONG', 'WOOD_D'], 'H');
mapc(['WALL_CITY', 'WALL_CITY_D'], 'W');
mapc(['BRICK', 'BRICK_D'], 'b');
mapc(['MARBLE', 'MARBLE_D', 'RAIL', 'STONE'], '=');
mapc(['PAVE', 'PAVE_2', 'PAVE_W'], '.');
mapc(['SOIL', 'GRASS'], ',');
mapc(['WATER'], '~');
mapc(['LEAF', 'LEAF_D', 'LEAF_L', 'TRUNK'], 'T');
mapc(['ROCK'], '^');
mapc(['BRONZE', 'LION'], 'o');

const X0 = -455, X1 = 455, Z0 = -640, Z1 = 570;
const SX = 7, SZ = 13;
const NC = Math.floor((X1 - X0) / SX) + 1, NR = Math.floor((Z1 - Z0) / SZ) + 1;

/* 取每个格子内最高的体素 */
const topId = new Int16Array(NC * NR).fill(-1);
const topY = new Int16Array(NC * NR).fill(-1);
for (let i = 0; i < vox.count; i++) {
  const x = vox.xs[i], z = vox.zs[i], y = vox.ys[i];
  if (x < X0 || x > X1 || z < Z0 || z > Z1) continue;
  const c = Math.floor((x - X0) / SX), r = Math.floor((z - Z0) / SZ);
  const k = r * NC + c;
  if (y > topY[k]) { topY[k] = y; topId[k] = vox.ids[i]; }
}
/* 空处填铺装/水面 */
for (let i = 0; i < tiles.count; i++) {
  const x = tiles.xs[i], z = tiles.zs[i];
  if (x < X0 || x > X1 || z < Z0 || z > Z1) continue;
  const c = Math.floor((x - X0) / SX), r = Math.floor((z - Z0) / SZ);
  const k = r * NC + c;
  if (topY[k] < 0) { topId[k] = tiles.ids[i]; topY[k] = 0; }
}

function ruler() {
  let a = '     ', b2 = '     ';
  for (let c = 0; c < NC; c++) {
    const wx = X0 + c * SX;
    if (wx % 140 === 0 || (wx > -4 && wx < 4 && c % 2 === 0)) { a += '|'; }
    else a += ' ';
  }
  return a;
}

/* ---- 图一：材质平面 ---- */
console.log('===== 图一 · 材质俯视平面（上北下南，1 字符 ≈ 7×13 m）=====');
console.log('  # 黄琉璃瓦顶   G 绿琉璃瓦顶   K 黑琉璃瓦顶   H 红墙木构   W 城墙');
console.log('  = 汉白玉石作   b 城砖   . 海墁铺装   ~ 水面   T 树木   ^ 叠石   o 铜石陈设   , 城外素土');
console.log(ruler());
const marks = {};
marks[Math.round((-480 - Z0) / SZ)] = '南墙';
marks[Math.round((-460 - Z0) / SZ)] = '午门';
marks[Math.round((-380 - Z0) / SZ)] = '金水桥';
marks[Math.round((-312 - Z0) / SZ)] = '太和门';
marks[Math.round((-174 - Z0) / SZ)] = '三台南';
marks[Math.round((-90 - Z0) / SZ)] = '太和殿';
marks[Math.round((-38 - Z0) / SZ)] = '中和殿';
marks[Math.round((8 - Z0) / SZ)] = '保和殿';
marks[Math.round((127 - Z0) / SZ)] = '乾清门';
marks[Math.round((200 - Z0) / SZ)] = '乾清宫';
marks[Math.round((270 - Z0) / SZ)] = '坤宁宫';
marks[Math.round((381 - Z0) / SZ)] = '钦安殿';
marks[Math.round((460 - Z0) / SZ)] = '神武门';
marks[Math.round((480 - Z0) / SZ)] = '北墙';
for (let r = NR - 1; r >= 0; r--) {
  let line = '';
  for (let c = 0; c < NC; c++) {
    const k = r * NC + c;
    line += topId[k] < 0 ? ' ' : (CH[topId[k]] || '?');
  }
  const zz = Z0 + r * SZ;
  const tag = marks[r] ? ' ← ' + marks[r] : '';
  console.log(String(zz).padStart(5) + line + tag);
}
console.log(ruler());
console.log('  x = ' + X0 + ' … ' + X1 + '（每 140 m 一竖标，中间竖标为中轴 x=0）\n');

/* ---- 图二：体量高度 ---- */
console.log('===== 图二 · 体量高度（顶面标高，米）=====');
console.log("  ' ' 空   . 1-3   - 4-8   + 9-14   * 15-22   # 23-31   @ 32+");
function hch(y) {
  if (y < 0) return ' ';
  if (y <= 3) return '.';
  if (y <= 8) return '-';
  if (y <= 14) return '+';
  if (y <= 22) return '*';
  if (y <= 31) return '#';
  return '@';
}
for (let r = NR - 1; r >= 0; r--) {
  let line = '';
  for (let c = 0; c < NC; c++) line += hch(topY[r * NC + c]);
  const tag = marks[r] ? ' ← ' + marks[r] : '';
  console.log(String(Z0 + r * SZ).padStart(5) + line + tag);
}
console.log('');

/* ---- 中轴纵剖高度曲线 ---- */
console.log('===== 图三 · 中轴线（x≈0）纵向最高点 =====');
const world = res.world;
let out = [];
for (let z = -560; z <= 500; z += 5) {
  let hi = -1;
  for (let x = -3; x <= 3; x++)
    for (let y = 60; y >= 0; y--) if (world.has(x, y, z)) { if (y > hi) hi = y; break; }
  out.push([z, hi]);
}
for (const [z, h] of out) {
  console.log(String(z).padStart(5) + ' ' + String(h < 0 ? 0 : h).padStart(3) + ' ' +
              '█'.repeat(Math.max(0, h < 0 ? 0 : h)));
}
