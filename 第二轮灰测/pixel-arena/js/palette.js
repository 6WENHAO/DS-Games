// ============================================================
// palette.js — 统一 32 色调色板 + Ordered Bayer 4x4 抖动工具
// 全部渲染（背景/精灵/UI）只允许使用这 32 种颜色。
// 调色板为原创设计，观感参考 GBA 宝可梦宝石版战斗场景。
// ============================================================
'use strict';

const PAL = [
  '#0d1420', // 0  虚空深蓝黑（透明区不上色/黑场）
  '#101820', // 1  描边近黑
  '#1c2c44', // 2  深海军蓝
  '#2c4a6e', // 3  海军蓝
  '#46749a', // 4  钢蓝
  '#6ea0c4', // 5  天空
  '#a4c8e0', // 6  亮天蓝
  '#e0eef4', // 7  淡天蓝
  '#f6f2e0', // 8  奶油白
  '#ecdca8', // 9  浅沙
  '#c8b488', // 10 沙色
  '#a8845c', // 11 土色
  '#7c5c3c', // 12 深土
  '#543c28', // 13 深褐
  '#1e3a24', // 14 深草绿
  '#2a5c34', // 15 暗草绿
  '#3f8a48', // 16 草绿
  '#62b45c', // 17 亮草绿
  '#94d470', // 18 浅草绿
  '#c8e89a', // 19 草黄绿
  '#f4d858', // 20 黄
  '#e8a02c', // 21 琥珀
  '#e06038', // 22 橙
  '#c83838', // 23 红
  '#8c2030', // 24 深红
  '#4ab4e8', // 25 水蓝
  '#2a70b8', // 26 深水蓝
  '#d878c8', // 27 粉
  '#a848b8', // 28 紫
  '#5c2c7c', // 29 深紫
  '#f8f8f8', // 30 白
  '#8a92a4', // 31 灰
];

// 4x4 Bayer 矩阵（0-15，除以 16 得阈值）
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function bayer4(x, y) {
  return BAYER4[((y & 3) << 2) | (x & 3)] / 16;
}

// level: 0(全透明) .. 16(全实心)，像素 (x,y) 是否应点亮
function ditherOn(x, y, level) {
  return level > 0 && bayer4(x, y) < level / 16;
}

// ---- 抖动填充（对齐画布原点，保证多次调用图案一致）----
const PAT_CACHE = new Map();

function ditherPattern(colorIdx, level) {
  const key = colorIdx * 32 + level;
  if (PAT_CACHE.has(key)) return PAT_CACHE.get(key);
  const c = document.createElement('canvas');
  c.width = 4; c.height = 4;
  const g = c.getContext('2d');
  g.fillStyle = PAL[colorIdx];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (BAYER4[y * 4 + x] < level) g.fillRect(x, y, 1, 1);
    }
  }
  const pat = g.createPattern(c, 'repeat');
  PAT_CACHE.set(key, pat);
  return pat;
}

function fillDither(ctx, x, y, w, h, colorIdx, level) {
  w = Math.round(w); h = Math.round(h);
  if (level <= 0 || w <= 0 || h <= 0) return;
  if (level >= 16) {
    ctx.fillStyle = PAL[colorIdx];
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
    return;
  }
  ctx.fillStyle = ditherPattern(colorIdx, level);
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

// ---- 基础像素绘制 ----
function px(ctx, x, y, colorIdx) {
  ctx.fillStyle = PAL[colorIdx];
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function rect(ctx, x, y, w, h, colorIdx) {
  ctx.fillStyle = PAL[colorIdx];
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function hline(ctx, x, y, w, colorIdx) {
  ctx.fillStyle = PAL[colorIdx];
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
}

function vline(ctx, x, y, h, colorIdx) {
  ctx.fillStyle = PAL[colorIdx];
  ctx.fillRect(Math.round(x), Math.round(y), 1, Math.round(h));
}

// 实心圆（中点画圆，逐像素）
function circle(ctx, cx, cy, r, colorIdx) {
  const x0 = Math.round(cx), y0 = Math.round(cy);
  ctx.fillStyle = PAL[colorIdx];
  let y = r;
  for (let dx = 0; dx <= y; dx++) {
    // 保持圆形：dy 由勾股递减
    let dy = y;
    while (dx * dx + dy * dy > r * r && dy >= 0) dy--;
    y = dy;
    ctx.fillRect(x0 - dx, y0 - dy, dx * 2 + 1, 1);
    if (dy !== 0) ctx.fillRect(x0 - dx, y0 + dy, dx * 2 + 1, 1);
  }
}

// 实心椭圆（逐行扫描；dy 必须整数迭代，防止分数坐标抗锯齿）
function ellipse(ctx, cx, cy, rx, ry, colorIdx) {
  ctx.fillStyle = PAL[colorIdx];
  const cx0 = Math.round(cx), cy0 = Math.round(cy);
  const rx2 = rx * rx, ry2 = ry * ry;
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ry2)));
    ctx.fillRect(cx0 - half, cy0 + dy, half * 2 + 1, 1);
  }
}

// 椭圆描边（先用 outer 色填大椭圆，再以 inner 色填内缩椭圆）
function ellipseRing(ctx, cx, cy, rx, ry, outerIdx, innerIdx, width) {
  ellipse(ctx, cx, cy, rx, ry, outerIdx);
  const irx = Math.max(1, rx - width), iry = Math.max(1, ry - width);
  ellipse(ctx, cx, cy, irx, iry, innerIdx);
}

// 二次贝塞尔点
function bezier2(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

// 像素直线（Bresenham）
function line(ctx, x1, y1, x2, y2, colorIdx) {
  let x = Math.round(x1), y = Math.round(y1);
  const ex = Math.round(x2), ey = Math.round(y2);
  const dx = Math.abs(ex - x), dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = PAL[colorIdx];
  for (let i = 0; i < 10000; i++) {
    ctx.fillRect(x, y, 1, 1);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// 抖动椭圆（用于脚下阴影等半透明效果，纯调色板色）
function ditherEllipse(ctx, cx, cy, rx, ry, colorIdx, level) {
  const cx0 = Math.round(cx), cy0 = Math.round(cy);
  const rx2 = rx * rx, ry2 = ry * ry;
  ctx.fillStyle = PAL[colorIdx];
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ry2)));
    for (let dx = -half; dx <= half; dx++) {
      if (ditherOn(cx0 + dx, cy0 + dy, level)) ctx.fillRect(cx0 + dx, cy0 + dy, 1, 1);
    }
  }
}

// 供自检使用：判断一个 RGB 像素是否属于调色板
const PAL_RGB = (function () {
  const set = new Set();
  for (const h of PAL) {
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    set.add((r << 16) | (g << 8) | b);
  }
  return set;
})();

function isPaletteColor(r, g, b) {
  return PAL_RGB.has(((r & 255) << 16) | ((g & 255) << 8) | (b & 255));
}

// 最近调色板索引（调试用）
function nearestPaletteIndex(r, g, b) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < 32; i++) {
    const h = PAL[i];
    const pr = parseInt(h.slice(1, 3), 16);
    const pg = parseInt(h.slice(3, 5), 16);
    const pb = parseInt(h.slice(5, 7), 16);
    const d = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// 帧率量化：把时间量化到指定 fps 的步进（8/12fps 动画节奏用）
function quantStep(t, fps) {
  return Math.floor(t / (1000 / fps));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PAL, BAYER4, bayer4, ditherOn, fillDither, px, rect, hline, vline, circle, ellipse, ellipseRing, ditherEllipse, bezier2, line, isPaletteColor, nearestPaletteIndex, quantStep, ditherPattern };
}
