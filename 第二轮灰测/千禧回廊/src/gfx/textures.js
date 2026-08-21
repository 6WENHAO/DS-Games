// ============================================================================
//  textures.js —— 程序化生成全部材质（64×64），零素材
//  分三类：walls（竖直面）/ floors（地面）/ ceils（顶面）
//  y=0 在上（靠天花板），y=63 在下（靠地面）
// ============================================================================

import { pix, mix, scaleColor, makeRng, fbm } from './pixels.js';
import { P } from './palette.js';

export const TS = 64; // texture size

const makers = new Map();
const cache = new Map();

function def(name, fn) { makers.set(name, fn); }

export function tex(name) {
  if (cache.has(name)) return cache.get(name);
  const fn = makers.get(name);
  if (!fn) {
    // 缺失材质：紫黑格，方便一眼看出来
    const p = pix(TS, TS).tiles(0, 0, TS, TS, 8, ['#ff00ff', '#202020'], '#000', 1, 0);
    cache.set(name, p);
    return p;
  }
  const p = fn(pix(TS, TS)) || pix(TS, TS);
  cache.set(name, p);
  return p;
}

export function clearTextureCache() { cache.clear(); }
export function textureNames() { return [...makers.keys()]; }

// ---------------------------------------------------------------------------
//  公共小工具
// ---------------------------------------------------------------------------

/** 涂料墙的细腻滚花质感 */
function paintTexture(p, x, y, w, h, base, seed, strength = 0.055) {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const n = fbm((x + xx) * 0.35, (y + yy) * 0.35, TS, seed, 3);
      const n2 = fbm((x + xx) * 0.06, (y + yy) * 0.06, TS, seed + 13, 2);
      const k = 1 + (n - 0.5) * strength * 2 + (n2 - 0.5) * 0.09;
      p.put(x + xx, y + yy, scaleColor(base, k));
    }
  }
}

/** 顶光渐变：靠近天花板略亮，靠地面略暗（假的但极大提升立体感） */
function topLight(p, amount = 0.14) {
  for (let y = 0; y < p.h; y++) {
    const t = y / (p.h - 1);
    const k = 1 + amount * (0.55 - t) * 2;
    p.shade(0, y, p.w, 1, k);
  }
  return p;
}

/** 靠地面的踢脚阴影 */
function floorContact(p, h = 6, strength = 0.42) {
  for (let i = 0; i < h; i++) {
    const a = (1 - i / h) * strength;
    p.rect(0, p.h - 1 - i, p.w, 1, '#000', a);
  }
  return p;
}

/** 岁月：随机划痕、磕碰、灰污 */
function aging(p, seed, level = 1) {
  const rng = makeRng(seed);
  for (let i = 0; i < 5 * level; i++) {
    const x = rng() * TS, y = rng() * TS;
    p.stain(x, y, 4 + rng() * 11, '#4a3a22', seed + i, 0.13 + rng() * 0.16);
  }
  for (let i = 0; i < 7 * level; i++) {
    const x = Math.floor(rng() * TS), y = Math.floor(rng() * TS);
    const len = 2 + Math.floor(rng() * 9);
    const vert = rng() > 0.5;
    p.line(x, y, vert ? x : x + len, vert ? y + len : y, rng() > 0.5 ? '#efe6d2' : '#3a2e1c', 0.16 + rng() * 0.2);
  }
  p.grain(4.5 * level, seed + 99);
  return p;
}

/** 小广告贴纸（开锁 / 通下水道 / 收旧家电），楼道之魂 */
function smallAd(p, x, y, w, h, kind, seed) {
  const rng = makeRng(seed);
  const paper = ['#e8e2cd', '#dfd2b4', '#e5cfc0'][Math.floor(rng() * 3)];
  p.rect(x, y, w, h, paper, 0.92);
  p.frame(x, y, w, h, scaleColor(paper, 0.72), 1, 0.6);
  const ink = ['#b0231c', '#20304a', '#2a2a24'][Math.floor(rng() * 3)];
  const txt = kind || ['开锁', '通下水道', '收旧家电', '疏通管道'][Math.floor(rng() * 4)];
  p.text(x + 1, y + 1, txt, ink, { size: Math.min(h - 4, 8), bold: true, seed });
  // 电话号码
  p.tiny(x + 1, y + h - 6, ['1390138', '8265432', '6712345'][Math.floor(rng() * 3)], ink, 1, 0.85);
  // 撕角
  p.rect(x + w - 3, y, 3, 3, [0, 0, 0, 0]);
  return p;
}

// ===========================================================================
//  一 · 楼道（单元公共部位）
// ===========================================================================

function stairWallBase(p, seed, dado = P.dadoGreen) {
  // 上：米黄涂料
  paintTexture(p, 0, 0, TS, 41, P.wallCream, seed);
  // 上部再压一层竖向渐变（越高越亮，像楼道窗光从上打下来）
  for (let y = 0; y < 41; y++) p.shade(0, y, TS, 1, 1 + (0.5 - y / 41) * 0.16);
  // 墙裙上沿白线
  p.rect(0, 39, TS, 1, P.dadoLine, 0.9);
  p.rect(0, 40, TS, 2, scaleColor(P.dadoLine, 0.8), 0.5);
  // 下：墨绿墙裙（油漆，带反光）
  paintTexture(p, 0, 42, TS, TS - 42, dado, seed + 7, 0.04);
  for (let y = 42; y < TS; y++) {
    const t = (y - 42) / (TS - 42);
    p.shade(0, y, TS, 1, 1 + (0.35 - t) * 0.22);
  }
  // 油漆刷痕
  const rng = makeRng(seed + 3);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rng() * TS);
    p.vline(x, 42, TS - 42, rng() > 0.5 ? '#ffffff' : '#000000', 0.05 + rng() * 0.05);
  }
  return p;
}

def('stair_wall', (p) => {
  stairWallBase(p, 101);
  aging(p, 211, 1);
  floorContact(p);
  return p;
});

def('stair_wall_ad', (p) => {
  stairWallBase(p, 137);
  smallAd(p, 8, 12, 20, 14, '开锁', 41);
  smallAd(p, 36, 22, 22, 13, '通下水道', 42);
  smallAd(p, 14, 44, 18, 11, '收旧家电', 43);
  aging(p, 231, 1.2);
  floorContact(p);
  return p;
});

def('stair_wall_chalk', (p) => {
  stairWallBase(p, 149);
  // 粉笔涂鸦 + 划痕
  const rng = makeRng(51);
  p.text(10, 16, '李伟到此', '#f2ecd8', { size: 9, bold: false, alpha: 0.5, seed: 5 });
  for (let i = 0; i < 22; i++) {
    const x = 6 + rng() * 52, y = 26 + rng() * 12;
    p.line(x, y, x + rng() * 8 - 4, y + rng() * 6 - 3, '#f2ecd8', 0.18);
  }
  aging(p, 241, 1.4);
  floorContact(p);
  return p;
});

def('stair_window', (p) => {
  stairWallBase(p, 163);
  // 窗洞（水泥窗套）
  p.rect(5, 6, 54, 34, '#b8ab8e');
  p.frame(5, 6, 54, 34, '#8f8570', 1, 0.8);
  p.rect(7, 8, 50, 30, '#6f6a58');
  // 玻璃：黄昏天光
  p.vgrad(8, 9, 48, 28, P.skyMid, P.skyLow);
  // 远处楼影
  p.rect(8, 26, 12, 11, '#8a6a58', 0.55);
  p.rect(24, 22, 9, 15, '#7b6152', 0.5);
  p.rect(40, 28, 14, 9, '#8a6a58', 0.45);
  // 铁窗框（十字 + 分格）
  p.rect(31, 9, 2, 28, '#6a6558');
  p.rect(8, 22, 48, 2, '#6a6558');
  p.frame(8, 9, 48, 28, '#6a6558', 1);
  // 防盗铁栅
  for (let x = 12; x < 56; x += 7) p.vline(x, 9, 28, '#55503f', 0.55);
  // 玻璃脏 + 反光
  p.stain(20, 16, 9, '#cdbb9a', 71, 0.2);
  p.line(10, 34, 24, 11, '#fff3d8', 0.16);
  p.glow(8, 9, 48, 28, 0.92);
  aging(p, 251, 0.7);
  floorContact(p);
  return p;
});

def('meter_box', (p) => {
  stairWallBase(p, 173);
  // 电表箱铁皮门
  p.vgrad(9, 10, 46, 30, scaleColor(P.meterGrey, 1.1), scaleColor(P.meterGrey, 0.85));
  p.frame(9, 10, 46, 30, '#6c6e66', 1);
  p.rect(9, 40, 46, 2, '#000', 0.28);
  // 观察窗 + 电表读数
  p.rect(15, 16, 20, 12, '#2b2b26');
  p.rect(16, 17, 18, 10, '#d8d2bd');
  p.tiny(17, 20, '04517', '#2b2b26', 1);
  p.rect(16, 17, 18, 4, '#fff', 0.18);
  // 警示标
  p.rect(39, 16, 12, 12, '#e0c33a');
  p.line(45, 18, 42, 23, '#2b2b26'); p.line(42, 23, 47, 23, '#2b2b26'); p.line(47, 23, 44, 27, '#2b2b26');
  // 锁扣 + 铰链
  p.rect(50, 23, 4, 5, '#5d5f57'); p.disc(52, 25, 1.2, 1.2, '#33352f');
  p.rect(9, 14, 2, 4, '#5d5f57'); p.rect(9, 32, 2, 4, '#5d5f57');
  p.text(16, 31, '电表', '#3a3c36', { size: 8, seed: 9 });
  aging(p, 261, 0.8);
  floorContact(p);
  return p;
});

def('door_security', (p) => {
  // 门套（水泥抹灰）
  paintTexture(p, 0, 0, TS, TS, '#b9ac90', 181);
  p.rect(0, 0, TS, 3, '#8d8270');
  // 门扇：枣红防盗门
  p.vgrad(5, 3, 54, 61, '#a4553c', '#7d3a27');
  p.frame(5, 3, 54, 61, P.redwoodDark, 2);
  // 压花线条（内凹方框）
  p.frame(11, 10, 42, 22, P.redwoodDark, 1, 0.75);
  p.frame(12, 11, 40, 20, '#c07452', 1, 0.45);
  p.frame(11, 38, 42, 20, P.redwoodDark, 1, 0.75);
  p.frame(12, 39, 40, 18, '#c07452', 1, 0.45);
  // 门镜（猫眼）
  p.disc(32, 34, 2.6, 2.6, '#3a2018');
  p.disc(32, 34, 1.5, 1.5, '#c9b48a');
  p.disc(31.4, 33.4, 0.7, 0.7, '#f2e6c8');
  // 门牌 302
  p.rect(37, 5, 16, 8, '#dcd6c0');
  p.frame(37, 5, 16, 8, '#8a8472', 1);
  p.tiny(39, 7, '302', '#22201c', 1);
  // 把手
  p.rect(50, 33, 5, 3, '#c8b070');
  p.rect(52, 30, 3, 10, '#a8904f');
  // 贴过春联/福字的残胶
  p.rect(28, 14, 9, 9, '#b8342a', 0.28);
  p.stain(32, 18, 6, '#c8b48a', 191, 0.22);
  aging(p, 271, 0.9);
  floorContact(p, 5, 0.5);
  return p;
});

def('door_security_open', (p) => {
  // 打开的防盗门：门洞里透出家里的暖光
  paintTexture(p, 0, 0, TS, TS, '#b9ac90', 181);
  p.rect(0, 0, TS, 3, '#8d8270');
  p.vgrad(8, 4, 48, 60, '#c99a5c', '#8a6236');
  p.glow(8, 4, 48, 60, 0.5);
  p.rect(6, 3, 3, 61, P.redwoodDark);
  p.rect(55, 3, 4, 61, scaleColor(P.redwood, 0.9));
  aging(p, 272, 0.6);
  return p;
});

// ===========================================================================
//  二 · 家（中式梦核 · 黄柜子 + 原木色板材 + 暖色调）
// ===========================================================================

function homeWallBase(p, seed) {
  paintTexture(p, 0, 0, TS, TS, P.homeWall, seed, 0.04);
  topLight(p, 0.12);
  // 木踢脚线
  p.wood(0, 57, TS, 7, P.woodBase, P.woodDark, seed + 5, true, 0.7);
  p.rect(0, 56, TS, 1, scaleColor(P.woodLight, 1.05), 0.8);
  p.rect(0, 57, TS, 1, '#000', 0.18);
  floorContact(p, 4, 0.28);
  return p;
}

def('home_wall', (p) => {
  homeWallBase(p, 301);
  p.stain(48, 14, 12, '#c9a878', 311, 0.16);
  p.grain(3, 321);
  return p;
});

def('home_wall_calendar', (p) => {
  homeWallBase(p, 303);
  // 挂历：上红头 + 大字年份 + 下方风景画 + 日期块
  const x = 18, y = 6, w = 28, h = 40;
  p.rect(x + 1, y + 2, w, h, '#000', 0.2);           // 影
  p.rect(x, y, w, h, '#f0e7d2');
  p.frame(x, y, w, h, '#b9ad92', 1);
  p.rect(x, y, w, 9, P.bannerRed);
  p.tiny(x + 5, y + 2, '2000', P.bannerGold, 1);
  // 风景画（山水 + 暖天）
  p.vgrad(x + 2, y + 11, w - 4, 15, '#f3cf94', '#e2a86a');
  p.disc(x + 8, y + 15, 2.4, 2.4, '#fff0c8');
  for (let i = 0; i < 3; i++) {
    const bx = x + 3 + i * 8;
    p.line(bx, y + 25, bx + 4, y + 18, '#7d6a7e', 0.8);
    p.line(bx + 4, y + 18, bx + 9, y + 25, '#7d6a7e', 0.8);
  }
  p.rect(x + 2, y + 24, w - 4, 2, '#6d5a6e', 0.7);
  // 日期块
  p.rect(x + 2, y + 28, w - 4, 10, '#fdf8ea');
  p.tiny(x + 4, y + 30, '01-01', '#b0231c', 1);
  p.tiny(x + 4, y + 34, '2000', '#4a4438', 1);
  // 挂钉
  p.disc(x + w / 2, y - 2, 1.2, 1.2, '#8a8272');
  p.grain(3, 331);
  return p;
});

def('home_wall_picture', (p) => {
  homeWallBase(p, 305);
  // 中堂画 / 十字绣（牡丹）+ 红木框
  const x = 10, y = 8, w = 44, h = 32;
  p.rect(x + 2, y + 3, w, h, '#000', 0.22);
  p.rect(x, y, w, h, P.redwood);
  p.frame(x, y, w, h, P.redwoodDark, 2);
  p.rect(x + 3, y + 3, w - 6, h - 6, '#efe4c8');
  // 牡丹：几团粉红 + 绿叶
  const rng = makeRng(341);
  for (let i = 0; i < 5; i++) {
    const cx = x + 8 + rng() * (w - 16), cy = y + 10 + rng() * (h - 20);
    p.disc(cx, cy, 3.4, 2.8, '#d9718a', 0.9);
    p.disc(cx - 1, cy - 1, 1.8, 1.5, '#f0aabb', 0.9);
    p.disc(cx + 3, cy + 2, 2.2, 1.6, '#4e7a4a', 0.75);
  }
  p.text(x + 5, y + h - 12, '富贵', '#a8231c', { size: 8, seed: 11 });
  p.grain(3, 351);
  return p;
});

def('cabinet_yellow', (p) => {
  // 千禧年家装标配：一整面黄色柜门 + 银色长拉手
  p.wood(0, 0, TS, TS, P.cabYellow, P.cabYellowDark, 401, false, 0.5);
  // 3 列 × 2 排柜门
  const doors = [
    [1, 1, 20, 29], [22, 1, 20, 29], [43, 1, 20, 29],
    [1, 32, 20, 30], [22, 32, 20, 30], [43, 32, 20, 30],
  ];
  for (const [x, y, w, h] of doors) {
    p.wood(x, y, w, h, P.cabYellow, P.cabYellowDark, 401 + x * 7 + y, false, 0.45);
    // 门板高光（漆面反射）
    p.vgrad(x, y, w, Math.floor(h * 0.4), P.cabYellowLit, P.cabYellow, 0.28);
    p.frame(x, y, w, h, P.cabYellowDark, 1, 0.55);
    p.rect(x, y, w, 1, '#f7dc9c', 0.4);
    p.rect(x, y + h - 1, w, 1, '#7d5518', 0.5);
    // 门缝阴影
    p.rect(x + w, y, 1, h, '#5c3d0f', 0.65);
    // 银色长拉手
    const hy = y + Math.floor(h * (y < 20 ? 0.82 : 0.1));
    p.rect(x + 4, hy, w - 8, 2, '#cfd4d6');
    p.rect(x + 4, hy + 2, w - 8, 1, '#7c8285', 0.8);
    p.rect(x + 4, hy - 1, w - 8, 1, '#f0f4f5', 0.55);
  }
  p.rect(0, 30, TS, 2, '#5c3d0f', 0.6);
  p.rect(0, 62, TS, 2, '#4a300c', 0.7);
  topLight(p, 0.1);
  aging(p, 411, 0.5);
  return p;
});

def('cabinet_glass', (p) => {
  // 玻璃门酒柜/书柜：黄木框 + 玻璃 + 里面的杯子和奖状
  p.wood(0, 0, TS, TS, P.cabYellow, P.cabYellowDark, 421, false, 0.5);
  for (const [x, y] of [[3, 3], [33, 3], [3, 33], [33, 33]]) {
    const w = 28, h = 28;
    // 柜内暗背景
    p.vgrad(x, y, w, h, '#6b5636', '#443421');
    // 隔板
    p.rect(x, y + 14, w, 2, P.woodDark);
    // 玻璃杯 / 热水瓶 / 奖状
    p.rect(x + 4, y + 6, 4, 8, '#cfe0dd', 0.8);
    p.rect(x + 10, y + 5, 5, 9, '#e4d4a8', 0.85);
    p.rect(x + 18, y + 4, 7, 10, '#c0392b', 0.75);
    p.rect(x + 4, y + 18, 18, 9, '#e8dcb8', 0.85);
    p.tiny(x + 6, y + 21, '2000', '#a8231c', 1, 0.8);
    // 玻璃反光
    p.line(x + 2, y + h - 3, x + w - 4, y + 2, '#dfeef0', 0.22);
    p.line(x + 8, y + h - 3, x + w - 1, y + 6, '#dfeef0', 0.12);
    p.frame(x, y, w, h, '#8a6a2a', 1);
    p.frame(x - 1, y - 1, w + 2, h + 2, P.cabYellowLit, 1, 0.5);
    p.glow(x, y, w, h, 0.18);
  }
  aging(p, 431, 0.4);
  return p;
});

def('wood_panel', (p) => {
  // 原木色板材护墙板（下）+ 暖白墙（上）
  paintTexture(p, 0, 0, TS, 26, P.homeWall2, 441, 0.035);
  p.wood(0, 28, TS, 36, P.woodBase, P.woodDark, 443, false, 0.8);
  // 竖向压条
  for (let x = 0; x < TS; x += 16) {
    p.vline(x, 28, 36, P.woodDark, 0.45);
    p.vline(x + 1, 28, 36, P.woodLight, 0.3);
  }
  // 上沿压顶线
  p.wood(0, 25, TS, 4, P.woodLight, P.woodBase, 447, true, 0.5);
  p.rect(0, 25, TS, 1, '#fff', 0.28);
  p.rect(0, 29, TS, 1, '#000', 0.22);
  topLight(p, 0.1);
  floorContact(p, 5, 0.3);
  aging(p, 451, 0.5);
  return p;
});

def('kitchen_tile', (p) => {
  p.tiles(0, 0, TS, TS, 8, [P.tileWhite, '#e4e0d4', '#eeeae0'], P.tileGrout, 461, 1);
  // 腰线花砖
  p.rect(0, 26, TS, 8, P.tileFlower);
  for (let x = 0; x < TS; x += 8) {
    p.rect(x + 1, 27, 6, 6, scaleColor(P.tileFlower, 1.15));
    p.disc(x + 4, 30, 2, 2, '#e6dfc6', 0.9);
    p.disc(x + 4, 30, 1, 1, '#c06a4a', 0.9);
  }
  p.rect(0, 26, TS, 1, '#fff', 0.35);
  p.rect(0, 33, TS, 1, '#000', 0.2);
  // 瓷砖高光
  for (let y = 0; y < TS; y += 8) for (let x = 0; x < TS; x += 8) {
    p.rect(x + 1, y + 1, 6, 1, '#fff', 0.16);
  }
  // 油烟渍
  p.stain(14, 44, 13, '#9a7a44', 471, 0.24);
  p.stain(46, 12, 10, '#8a6a3a', 473, 0.18);
  topLight(p, 0.1);
  floorContact(p, 4, 0.25);
  return p;
});

def('door_glass_frost', (p) => {
  // 磨砂/冰花玻璃推拉门（客厅与阳台之间）——梦核感极强
  p.wood(0, 0, TS, TS, P.woodBase, P.woodDark, 481, false, 0.6);
  for (const [x, y, w, h] of [[4, 4, 24, 56], [36, 4, 24, 56]]) {
    p.vgrad(x, y, w, h, '#dbe2da', '#b9c4bd');
    // 冰花纹（放射性针状）
    const rng = makeRng(491 + x);
    for (let i = 0; i < 70; i++) {
      const cx = x + rng() * w, cy = y + rng() * h;
      const len = 2 + rng() * 6, ang = rng() * Math.PI * 2;
      p.line(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len,
        rng() > 0.5 ? '#f2f7f2' : '#93a29b', 0.3);
    }
    // 门后透出的暖光（阳台夕阳）
    p.rect(x, y, w, h, '#e7b878', 0.2);
    p.frame(x, y, w, h, P.woodDark, 1);
    p.frame(x - 1, y - 1, w + 2, h + 2, P.woodLight, 1, 0.6);
    p.glow(x, y, w, h, 0.45);
  }
  p.rect(30, 0, 4, TS, P.woodDark, 0.9);
  p.rect(31, 0, 1, TS, P.woodLight, 0.4);
  p.rect(30, 28, 4, 8, '#c8b070'); // 拉手
  aging(p, 501, 0.4);
  return p;
});

def('door_wood', (p) => {
  // 家里的木门：原木色门扇 + 上部磨砂玻璃格 + 铜把手
  paintTexture(p, 0, 0, TS, TS, P.homeWall, 505, 0.035);
  p.wood(3, 1, 58, 63, P.woodBase, P.woodDark, 507, false, 0.8);
  p.frame(3, 1, 58, 63, P.woodDark, 2);
  p.rect(2, 0, 60, 2, P.woodLight, 0.6);
  // 上部玻璃格（磨砂）
  for (const [gx, gy] of [[10, 8], [34, 8]]) {
    p.rect(gx, gy, 20, 18, '#cfd8d2');
    p.vgrad(gx, gy, 20, 18, '#dfe6df', '#b4bfb8');
    p.rect(gx, gy, 20, 18, '#e0b878', 0.16);
    p.line(gx + 1, gy + 16, gx + 18, gy + 2, '#f2f7f2', 0.22);
    p.frame(gx, gy, 20, 18, P.woodDark, 1);
    p.glow(gx, gy, 20, 18, 0.3);
  }
  // 下部门芯板
  p.frame(10, 32, 44, 26, P.woodDark, 1, 0.8);
  p.frame(11, 33, 42, 24, P.woodLight, 1, 0.35);
  // 铜把手
  p.disc(53, 40, 2.6, 2.6, '#c8b070');
  p.disc(52.4, 39.4, 1.1, 1.1, '#f0e0a8');
  p.rect(52, 43, 3, 5, '#a8904f');
  aging(p, 509, 0.4);
  floorContact(p, 4, 0.3);
  return p;
});

def('mirror_wall', (p) => {
  // 镜子：映出一个「没有你」的房间
  homeWallBase(p, 511);
  const x = 8, y = 6, w = 48, h = 44;
  p.rect(x + 2, y + 3, w, h, '#000', 0.25);
  p.wood(x - 2, y - 2, w + 4, h + 4, P.cabYellow, P.cabYellowDark, 513, false, 0.4);
  p.frame(x - 2, y - 2, w + 4, h + 4, P.cabYellowDark, 1);
  // 镜中：暖白墙 + 木地板 + 一扇远门 + 一盏灯，唯独没有人
  p.vgrad(x, y, w, 30, '#e6d6b4', '#d6c39c');
  p.vgrad(x, y + 30, w, 14, '#a97d4a', '#8a6034');
  p.rect(x + 18, y + 8, 12, 24, '#8a5a3a');       // 远处的门
  p.rect(x + 19, y + 9, 10, 22, '#6f4530');
  p.disc(x + 27, y + 20, 0.9, 0.9, '#d8c07a');
  p.disc(x + 8, y + 4, 3, 2, '#ffe9bb', 0.85);     // 吊灯
  p.line(x + 8, y, x + 8, y + 3, '#8a8270', 0.8);
  p.rect(x + 36, y + 22, 9, 10, P.cabYellow, 0.8); // 镜中的黄柜子
  // 镜面脏污 + 反光条
  p.line(x + 3, y + h - 4, x + w - 6, y + 3, '#ffffff', 0.13);
  p.stain(x + 30, y + 34, 9, '#cfc8b0', 521, 0.18);
  p.rect(x, y, w, h, '#b9c6cc', 0.1);
  p.glow(x, y, w, h, 0.3);
  return p;
});

// ===========================================================================
//  三 · 千禧年公共建筑（后现代 + 中华复兴式）
// ===========================================================================

function glassPane(p, x, y, w, h, base, lit, seed, emissive = 0.7) {
  // 单块幕墙玻璃：天空反射渐变 + 斜向高光 + 边缘暗角
  p.vgrad(x, y, w, h, lit, base);
  const rng = makeRng(seed);
  // 反射的天空带
  p.rect(x, y + Math.floor(h * 0.45), w, Math.max(1, Math.floor(h * 0.14)), P.skyHaze, 0.3);
  // 斜高光
  for (let i = 0; i < h; i++) {
    const xx = x + Math.floor((i / h) * w * 0.9);
    p.line(xx, y + h - i, xx + Math.floor(w * 0.25), y + h - i, '#ffffff', 0.07);
  }
  // 室内隐约的东西
  if (rng() > 0.55) p.rect(x + 2, y + h - 5, w - 4, 3, '#2a2a22', 0.3);
  p.frame(x, y, w, h, scaleColor(base, 0.62), 1, 0.85);
  p.glow(x, y, w, h, emissive);
  return p;
}

def('glass_curtain', (p) => {
  // 蓝绿色玻璃幕墙 —— 千禧年地标的招牌
  p.fill(P.mullion);
  p.vgrad(0, 0, TS, TS, scaleColor(P.mullion, 1.1), scaleColor(P.mullion, 0.8));
  const cols = 3, rows = 4;
  const pw = Math.floor(TS / cols), ph = Math.floor(TS / rows);
  const tints = [P.glassTeal, P.glassTeal, P.glassGreen, P.glassTeal, P.glassBlue, P.glassTeal];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = tints[(r * cols + c) % tints.length];
      glassPane(p, c * pw + 2, r * ph + 2, pw - 4, ph - 4, t,
        mix(t, P.glassTealLit, 0.55), 601 + r * 31 + c * 7, 0.72);
    }
  }
  // 铝框高光
  for (let c = 1; c < cols; c++) p.vline(c * pw, 0, TS, '#e2e8ea', 0.3);
  for (let r = 1; r < rows; r++) p.hline(0, r * ph, TS, '#e2e8ea', 0.22);
  p.grain(2.5, 611);
  return p;
});

def('glass_curtain_lit', (p) => {
  // 有几格亮着灯的幕墙（夜/黄昏）
  p.vgrad(0, 0, TS, TS, scaleColor(P.mullion, 0.95), scaleColor(P.mullion, 0.7));
  const cols = 3, rows = 4;
  const pw = Math.floor(TS / cols), ph = Math.floor(TS / rows);
  const rng = makeRng(621);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = rng() > 0.62;
      const t = on ? '#c99a4a' : P.glassGreen;
      glassPane(p, c * pw + 2, r * ph + 2, pw - 4, ph - 4, t,
        on ? '#ffe0a0' : mix(t, P.glassTealLit, 0.4), 631 + r * 13 + c * 5, on ? 1 : 0.5);
    }
  }
  p.grain(2.5, 641);
  return p;
});

def('marble_wall', (p) => {
  p.marble(0, 0, TS, TS, P.marbleBase, P.marbleVein, 651, 0.9);
  // 石材分缝 + 金属压条
  p.hline(0, 20, TS, '#b6a888', 0.7);
  p.hline(0, 21, TS, '#fff', 0.3);
  p.hline(0, 44, TS, '#b6a888', 0.7);
  p.hline(0, 45, TS, '#fff', 0.3);
  for (let x = 0; x < TS; x += 32) {
    p.vline(x, 0, TS, '#b6a888', 0.5);
    p.vline(x + 1, 0, TS, '#fff', 0.2);
  }
  // 不锈钢腰线
  p.rect(0, 30, TS, 3, P.steel);
  p.rect(0, 30, TS, 1, '#eef3f5', 0.8);
  p.rect(0, 32, TS, 1, P.steelDark, 0.8);
  // 深色石材踢脚
  p.marble(0, 58, TS, 6, P.marbleDark, '#6b5b44', 661, 0.8);
  topLight(p, 0.16);
  floorContact(p, 5, 0.3);
  p.grain(2.5, 671);
  return p;
});

def('banner_wall', (p) => {
  p.marble(0, 0, TS, TS, P.marbleBase, P.marbleVein, 681, 0.8);
  p.hline(0, 46, TS, '#b6a888', 0.6);
  // 红底金字横幅
  p.rect(0, 8, TS, 26, '#000', 0.18);
  p.vgrad(1, 9, TS - 2, 24, scaleColor(P.bannerRed, 1.15), scaleColor(P.bannerRed, 0.8));
  p.frame(1, 9, TS - 2, 24, '#7d1611', 1);
  p.rect(1, 10, TS - 2, 1, '#e0665c', 0.4);
  p.text(4, 14, '热烈庆祝新千年', P.bannerGold, { size: 14, bold: true, seed: 21 });
  // 横幅褶皱
  const rng = makeRng(691);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * TS);
    p.vline(x, 9, 24, rng() > 0.5 ? '#000' : '#fff', 0.09);
  }
  p.marble(0, 58, TS, 6, P.marbleDark, '#6b5b44', 693, 0.8);
  topLight(p, 0.14);
  floorContact(p, 5, 0.3);
  return p;
});

def('dougong', (p) => {
  // 中华复兴式母题：朱红梁枋 + 层叠斗拱 + 青灰檐口
  p.vgrad(0, 0, TS, TS, '#5a463a', '#43332a');
  // 檐口瓦（顶部）
  p.vgrad(0, 0, TS, 12, scaleColor(P.roofTile, 1.2), P.roofTile);
  for (let x = 0; x < TS; x += 8) {
    p.disc(x + 4, 10, 3.2, 2.6, scaleColor(P.roofTile, 1.35));
    p.disc(x + 4, 10, 1.6, 1.3, scaleColor(P.roofTile, 0.75));
  }
  p.rect(0, 11, TS, 2, '#20282c');
  // 檐下垫板
  p.rect(0, 13, TS, 4, P.roofTileWarm);
  p.rect(0, 13, TS, 1, '#8f6a52', 0.7);
  // 斗拱：三层交错方块
  const layers = [
    { y: 18, w: 10, gap: 16, c: P.dougongRed },
    { y: 26, w: 14, gap: 16, c: scaleColor(P.dougongRed, 1.12) },
    { y: 34, w: 18, gap: 16, c: scaleColor(P.dougongRed, 0.9) },
  ];
  for (const L of layers) {
    for (let x = 0; x < TS + 16; x += L.gap) {
      const bx = x - Math.floor(L.w / 2) + 8;
      p.rect(bx, L.y, L.w, 7, L.c);
      p.rect(bx, L.y, L.w, 1, P.dougongGold, 0.55);
      p.rect(bx, L.y + 6, L.w, 1, '#4a1c14', 0.8);
      p.rect(bx, L.y, 1, 7, '#4a1c14', 0.5);
      p.rect(bx + L.w - 1, L.y, 1, 7, '#4a1c14', 0.5);
    }
    // 层间阴影
    p.rect(0, L.y + 7, TS, 1, '#000', 0.4);
  }
  // 额枋（大红梁）+ 金线
  p.vgrad(0, 42, TS, 12, scaleColor(P.dougongRed, 1.1), scaleColor(P.dougongRed, 0.75));
  p.hline(0, 43, TS, P.dougongGold, 0.75);
  p.hline(0, 52, TS, P.dougongGold, 0.5);
  // 旋子彩画的抽象：金色圆环
  for (let x = 6; x < TS; x += 16) {
    p.ring(x, 48, 4, 3.4, P.dougongGold, 0.6);
    p.disc(x, 48, 1.4, 1.2, P.dougongGold, 0.45);
  }
  // 柱头
  p.vgrad(0, 54, TS, 10, '#7d2f22', '#5a2018');
  for (let x = 0; x < TS; x += 32) p.rect(x + 12, 54, 8, 10, '#93382a');
  aging(p, 701, 0.6);
  return p;
});

def('elevator', (p) => {
  // 不锈钢电梯门（拉丝）
  p.vgrad(0, 0, TS, TS, scaleColor(P.steel, 1.05), scaleColor(P.steel, 0.78));
  const rng = makeRng(711);
  for (let x = 0; x < TS; x++) {
    const k = 0.94 + rng() * 0.12;
    p.shade(x, 0, 1, TS, k);
  }
  // 门套
  p.frame(0, 0, TS, TS, P.steelDark, 3, 0.9);
  p.rect(3, 3, TS - 6, 1, '#e6eef0', 0.5);
  // 中缝
  p.rect(31, 3, 2, TS - 6, '#4e565a');
  p.rect(30, 3, 1, TS - 6, '#e6eef0', 0.35);
  // 楼层显示
  p.rect(22, 6, 20, 9, '#1a1e20');
  p.frame(22, 6, 20, 9, '#4e565a', 1);
  p.tiny(26, 8, '1F', '#e0703a', 1);
  p.glow(23, 7, 18, 7, 0.85);
  // 呼梯按钮盘（在门套右侧）
  p.rect(57, 28, 6, 12, '#8f9498');
  p.disc(60, 32, 1.8, 1.8, '#d8d2c0');
  p.disc(60, 36, 1.8, 1.8, '#e0a03a');
  p.glow(58, 34, 4, 4, 0.5);
  // 反射的暖光
  p.rect(0, 40, TS, 10, '#e0b070', 0.09);
  p.grain(3, 721);
  floorContact(p, 4, 0.3);
  return p;
});

def('mosaic_ext', (p) => {
  // 小区外立面马赛克（千禧年小区标配）
  p.tiles(0, 0, TS, TS, 4, ['#dfc9a4', '#e6d3ad', '#d3b892', '#e9dcc0'], '#a8977a', 731, 1);
  // 分格缝（每 32px 一条深缝）
  for (let y = 0; y < TS; y += 32) p.rect(0, y, TS, 2, '#8d7f66', 0.75);
  for (let x = 0; x < TS; x += 32) p.rect(x, 0, 2, TS, '#8d7f66', 0.6);
  // 雨痕（从上往下的深色条）
  const rng = makeRng(741);
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(rng() * TS), w = 1 + Math.floor(rng() * 3);
    p.rect(x, 0, w, TS, '#6f6350', 0.06 + rng() * 0.1);
  }
  p.stain(50, 52, 14, '#5d6a4a', 751, 0.2); // 青苔
  topLight(p, 0.1);
  return p;
});

def('concrete', (p) => {
  paintTexture(p, 0, 0, TS, TS, '#a29a8a', 761, 0.09);
  // 模板拼缝 + 对拉螺栓孔
  p.rect(0, 31, TS, 1, '#7d7668', 0.7);
  p.rect(31, 0, 1, TS, '#7d7668', 0.5);
  for (const [x, y] of [[16, 16], [48, 16], [16, 48], [48, 48]]) {
    p.disc(x, y, 2, 2, '#7a7365', 0.8);
    p.disc(x, y, 1.1, 1.1, '#5f594d', 0.9);
  }
  // 锈迹 + 裂缝
  p.stain(52, 10, 11, '#8a5a30', 771, 0.3);
  p.line(8, 0, 14, 30, '#6a6356', 0.4);
  p.line(14, 30, 11, 63, '#6a6356', 0.32);
  topLight(p, 0.12);
  floorContact(p, 5, 0.3);
  return p;
});

def('tower_wall', (p) => {
  // 尖塔内壁：米黄大理石 + 竖长窄窗
  p.marble(0, 0, TS, TS, '#ddcfb2', '#a89376', 781, 0.7);
  for (let x = 0; x < TS; x += 32) p.vline(x, 0, TS, '#b0a184', 0.5);
  // 窄窗
  const x = 24, y = 8, w = 14, h = 40;
  p.rect(x - 2, y - 2, w + 4, h + 4, '#8e7f66');
  p.vgrad(x, y, w, h, P.skyLow, P.skyMid);
  p.rect(x, y + h / 2, w, 1, '#8e7f66', 0.7);
  p.vline(x + w / 2, y, h, '#8e7f66', 0.6);
  p.frame(x, y, w, h, '#6f6350', 1);
  p.glow(x, y, w, h, 1);
  topLight(p, 0.16);
  floorContact(p, 5, 0.32);
  return p;
});

def('roof_parapet', (p) => {
  // 天台女儿墙（内侧）：水泥 + 马赛克压顶
  paintTexture(p, 0, 0, TS, TS, '#b0a48c', 791, 0.07);
  p.tiles(0, 0, TS, 8, 4, ['#c9b394', '#d6c3a2'], '#8d7f66', 793, 1);
  p.rect(0, 8, TS, 1, '#000', 0.25);
  p.stain(20, 30, 15, '#7a6a4a', 795, 0.22);
  p.stain(50, 48, 12, '#5d6a4a', 797, 0.2);
  // 涂料剥落
  const rng = makeRng(799);
  for (let i = 0; i < 10; i++) {
    const cx = rng() * TS, cy = 12 + rng() * 50;
    p.disc(cx, cy, 1 + rng() * 3.5, 1 + rng() * 3, '#8d8270', 0.5);
  }
  topLight(p, 0.1);
  floorContact(p, 5, 0.28);
  return p;
});

def('tv_static_wall', (p) => {
  // 梦核：一整面墙嵌着老电视，全在放雪花
  p.vgrad(0, 0, TS, TS, '#2e2a24', '#1c1a16');
  for (const [x, y] of [[2, 2], [33, 2], [2, 33], [33, 33]]) {
    p.rect(x, y, 29, 29, '#d8d2c0');
    p.frame(x, y, 29, 29, '#8a8474', 1);
    p.rect(x + 3, y + 3, 23, 19, '#12140f');
    const rng = makeRng(801 + x * 31 + y);
    for (let yy = 0; yy < 19; yy++) for (let xx = 0; xx < 23; xx++) {
      const v = rng();
      p.put(x + 3 + xx, y + 3 + yy, [v * 190 + 30, v * 195 + 32, v * 175 + 28]);
    }
    p.rect(x + 3, y + 3, 23, 19, P.crtGlow, 0.14);
    p.glow(x + 3, y + 3, 23, 19, 0.8);
    p.disc(x + 24, y + 25, 1.6, 1.6, '#8a8474');
  }
  return p;
});

// ===========================================================================
//  四 · 地面
// ===========================================================================

def('f_terrazzo', (p) => {
  p.fill(P.terrazzoBase);
  paintTexture(p, 0, 0, TS, TS, P.terrazzoBase, 901, 0.06);
  p.speckle(0, 0, TS, TS, P.terrazzoChip, 0.38, 903, 2);
  // 铜条分格（每 32）
  for (let x = 0; x < TS; x += 32) {
    p.vline(x, 0, TS, '#b8a468', 0.8);
    p.vline(x + 1, 0, TS, '#6f6550', 0.5);
  }
  for (let y = 0; y < TS; y += 32) {
    p.hline(0, y, TS, '#b8a468', 0.8);
    p.hline(0, y + 1, TS, '#6f6550', 0.5);
  }
  p.stain(44, 20, 14, '#5d5a48', 907, 0.2);
  p.grain(4, 909);
  return p;
});

def('f_mosaic', (p) => {
  p.tiles(0, 0, TS, TS, 4, ['#c2a982', '#d3bc95', '#a98d68', '#dcc9a4'], '#8a7a5f', 911, 1);
  for (let y = 0; y < TS; y += 20) p.hline(0, y, TS, '#7d6f56', 0.5);
  p.stain(16, 40, 16, '#6a5c44', 913, 0.18);
  p.grain(4, 915);
  return p;
});

def('f_wood', (p) => {
  // 木地板：横向长条
  for (let y = 0; y < TS; y += 12) {
    const off = (y / 12) % 2 === 0 ? 0 : 20;
    p.wood(0, y, TS, 12, P.floorWood, P.floorWoodDark, 921 + y, true, 0.9);
    p.rect(0, y, TS, 1, '#000', 0.3);
    p.rect(0, y + 1, TS, 1, '#e0b884', 0.16);
    for (let x = off; x < TS; x += 40) p.vline(x, y, 12, '#000', 0.28);
  }
  // 打蜡反光
  p.vgrad(0, 0, TS, TS, '#fff0cc', '#000000', 0.055);
  p.grain(3.5, 931);
  return p;
});

def('f_marble', (p) => {
  // 大堂大理石拼花：米黄大板 + 黑色小菱形拼角
  p.marble(0, 0, TS, TS, P.marbleBase, P.marbleVein, 941, 0.75);
  for (let x = 0; x < TS; x += 32) {
    p.vline(x, 0, TS, '#c1b193', 0.75);
    p.vline(x + 1, 0, TS, '#fff', 0.22);
  }
  for (let y = 0; y < TS; y += 32) {
    p.hline(0, y, TS, '#c1b193', 0.75);
    p.hline(0, y + 1, TS, '#fff', 0.22);
  }
  // 交点菱形
  for (let y = 0; y < TS; y += 32) for (let x = 0; x < TS; x += 32) {
    for (let d = -3; d <= 3; d++) {
      const w = 3 - Math.abs(d);
      p.rect(x - w, y + d, w * 2 + 1, 1, '#3a3a34', 0.85);
    }
  }
  p.vgrad(0, 0, TS, TS, '#ffffff', '#000000', 0.05);
  p.grain(2.5, 951);
  return p;
});

def('f_tile', (p) => {
  p.tiles(0, 0, TS, TS, 16, ['#d9cfb6', '#e2d9c0', '#cfc4a8'], '#a89b80', 961, 1);
  p.speckle(0, 0, TS, TS, ['#b8ab90', '#efe6cd'], 0.22, 963, 1);
  p.stain(30, 34, 15, '#8a7a58', 965, 0.2);
  p.grain(3.5, 967);
  return p;
});

def('f_roof', (p) => {
  // 天台：水泥 + 沥青防水 + 裂缝 + 青苔
  paintTexture(p, 0, 0, TS, TS, '#9c9382', 971, 0.09);
  const rng = makeRng(973);
  for (let i = 0; i < 4; i++) {
    const y = Math.floor(rng() * TS);
    p.rect(0, y, TS, 3 + Math.floor(rng() * 5), '#5f594d', 0.5);
  }
  for (let i = 0; i < 5; i++) {
    let x = rng() * TS, y = rng() * TS;
    for (let s = 0; s < 14; s++) {
      const nx = x + (rng() - 0.5) * 8, ny = y + (rng() - 0.5) * 8;
      p.line(x, y, nx, ny, '#6a6356', 0.42);
      x = nx; y = ny;
    }
  }
  p.stain(48, 16, 13, '#5d6a4a', 975, 0.3);
  p.stain(12, 50, 11, '#5d6a4a', 977, 0.22);
  p.grain(5, 979);
  return p;
});

def('f_carpet', (p) => {
  // 大堂红地毯
  p.fill('#8e2a22');
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const n = fbm(x * 0.9, y * 0.9, TS, 981, 2);
    const k = 0.86 + n * 0.3;
    p.put(x, y, scaleColor('#8e2a22', k));
  }
  // 金色回纹边
  p.frame(2, 2, TS - 4, TS - 4, '#c9a24a', 1, 0.55);
  p.frame(5, 5, TS - 10, TS - 10, '#c9a24a', 1, 0.3);
  p.grain(5, 983);
  return p;
});

// ===========================================================================
//  五 · 天花
// ===========================================================================

def('c_plain', (p) => {
  paintTexture(p, 0, 0, TS, TS, '#ddd3bd', 991, 0.045);
  p.stain(20, 22, 17, '#a89068', 993, 0.3);   // 漏水渍（梦核）
  p.stain(24, 26, 9, '#8a7048', 995, 0.22);
  p.stain(52, 50, 11, '#a89068', 997, 0.18);
  p.line(0, 40, 63, 46, '#b8ac94', 0.35);      // 裂缝
  p.shade(0, 0, TS, TS, 0.9);
  p.grain(3.5, 999);
  return p;
});

def('c_home', (p) => {
  // 暖白吊顶（无灯）—— 灯只放在指定的那一格，不然每平米一盏灯
  paintTexture(p, 0, 0, TS, TS, '#f0e6d0', 1001, 0.03);
  p.stain(52, 12, 10, '#c9b48a', 1003, 0.16);
  p.stain(14, 44, 12, '#cbb68c', 1004, 0.12);
  p.shade(0, 0, TS, TS, 0.96);
  p.grain(2.2, 1005);
  return p;
});

def('c_home_lamp', (p) => {
  paintTexture(p, 0, 0, TS, TS, '#f0e6d0', 1001, 0.03);
  // 石膏线圈 + 中央吸顶灯
  p.ring(32, 32, 26, 26, '#e2d4b6', 0.55);
  p.ring(32, 32, 24, 24, '#fdf6e6', 0.35);
  p.disc(32, 32, 13, 13, '#e8dcc0', 0.9);
  p.disc(32, 32, 11, 11, '#fff2cf');
  p.disc(32, 32, 7.5, 7.5, '#fffaea');
  p.ring(32, 32, 13, 13, '#c9b48a', 0.7);
  p.glow(19, 19, 26, 26, 1);
  p.grain(2.2, 1006);
  return p;
});

def('c_grid', (p) => {
  // 矿棉板吊顶（无灯管）
  p.tiles(0, 0, TS, TS, 32, ['#dcd8cc', '#d4d0c2'], '#a8a494', 1011, 1);
  p.speckle(0, 0, TS, TS, ['#c6c2b4', '#eae6da'], 0.3, 1013, 1);
  p.shade(0, 0, TS, TS, 0.9);
  return p;
});

def('c_grid_lamp', (p) => {
  // 日光灯盘（公共建筑，成排布置才对）
  p.tiles(0, 0, TS, TS, 32, ['#dcd8cc', '#d4d0c2'], '#a8a494', 1011, 1);
  p.speckle(0, 0, TS, TS, ['#c6c2b4', '#eae6da'], 0.3, 1013, 1);
  p.rect(8, 26, 48, 4, '#f2f8f0');
  p.rect(8, 26, 48, 1, '#ffffff');
  p.rect(8, 30, 48, 1, '#b8c4b8', 0.8);
  p.rect(8, 34, 48, 4, '#f2f8f0');
  p.rect(8, 34, 48, 1, '#ffffff');
  p.rect(8, 38, 48, 1, '#b8c4b8', 0.8);
  p.frame(5, 23, 54, 18, '#b0aca0', 1, 0.7);
  p.glow(8, 26, 48, 4, 1);
  p.glow(8, 34, 48, 4, 1);
  p.glow(5, 23, 54, 18, 0.35);
  p.shade(0, 0, TS, TS, 0.95);
  return p;
});

def('c_grid_dark', (p) => {
  // 灯坏了的吊顶（梦核：一格一格灭）
  p.tiles(0, 0, TS, TS, 32, ['#b8b4a8', '#aeaa9c'], '#8a8678', 1021, 1);
  p.rect(8, 26, 48, 4, '#8a9088');
  p.rect(8, 34, 48, 4, '#8a9088');
  p.frame(5, 23, 54, 18, '#8a8678', 1, 0.7);
  p.stain(30, 12, 14, '#7a6a4a', 1023, 0.3);
  p.shade(0, 0, TS, TS, 0.62);
  return p;
});

def('c_stair', (p) => {
  // 楼道顶（无灯）：白灰、水渍、裂缝
  paintTexture(p, 0, 0, TS, TS, '#cfc4ac', 1031, 0.05);
  p.stain(18, 20, 18, '#9a8058', 1033, 0.32);
  p.stain(46, 48, 13, '#a08860', 1034, 0.2);
  p.line(0, 20, 63, 26, '#a89c84', 0.4);
  p.shade(0, 0, TS, TS, 0.8);
  p.grain(4, 1035);
  return p;
});

def('c_stair_lamp', (p) => {
  // 声控灯：一只裸灯泡 + 白瓷灯座
  paintTexture(p, 0, 0, TS, TS, '#cfc4ac', 1031, 0.05);
  p.stain(18, 20, 18, '#9a8058', 1033, 0.3);
  p.line(0, 20, 63, 26, '#a89c84', 0.4);
  p.disc(32, 32, 9, 9, '#c9bfa4', 0.6);
  p.disc(32, 32, 6, 6, '#fff0c4');
  p.disc(32, 31, 3.4, 3.4, '#fffbe8');
  p.ring(32, 32, 7, 7, '#9a8f74', 0.85);
  p.glow(24, 24, 17, 17, 1);
  p.shade(0, 0, TS, TS, 0.86);
  p.grain(3.5, 1036);
  return p;
});

def('c_stair_off', (p) => {
  paintTexture(p, 0, 0, TS, TS, '#8f8878', 1041, 0.05);
  p.stain(18, 20, 18, '#5d4f38', 1043, 0.4);
  p.disc(32, 32, 4.5, 4.5, '#6f6858');
  p.ring(32, 32, 5.4, 5.4, '#4f4a3e', 0.8);
  p.shade(0, 0, TS, TS, 0.5);
  return p;
});

def('c_glass', (p) => {
  // 玻璃采光顶：钢架 + 天光
  p.vgrad(0, 0, TS, TS, P.skyLow, P.skyHaze);
  for (let x = 0; x < TS; x += 16) p.rect(x, 0, 2, TS, '#8f9498', 0.9);
  for (let y = 0; y < TS; y += 16) p.rect(0, y, TS, 2, '#8f9498', 0.9);
  for (let x = 0; x < TS; x += 16) p.rect(x, 0, 1, TS, '#e2e8ea', 0.35);
  // 灰尘 / 落叶
  p.stain(20, 40, 10, '#a08a5a', 1051, 0.25);
  p.stain(48, 14, 8, '#a08a5a', 1053, 0.2);
  p.glowAll(0.95);
  return p;
});

def('c_sky', (p) => {
  // 露天（天台）—— 实际渲染走 sky 渐变，这里只作兜底
  p.vgrad(0, 0, TS, TS, P.skyTop, P.skyLow);
  p.glowAll(1);
  return p;
});
