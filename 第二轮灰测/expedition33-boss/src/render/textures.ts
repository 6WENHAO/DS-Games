/**
 * textures.ts —— 全程序化 canvas 纹理工厂
 *
 * 设计约束：
 *  1. 无任何外部资源文件 / 网络请求，全部由 canvas 2D 现场绘制。
 *  2. 必须能在没有 DOM 的环境（node / vitest node 环境）里被 import 而不崩溃：
 *     所有绘制入口先检查 typeof document，拿不到 canvas 就返回 null，
 *     调用方（models.ts）在 null 时让材质退化为纯色。
 *  3. 所有随机使用内置确定性 PRNG，保证每次启动画面一致（便于回归）。
 *
 * 色调：暖棕雾 / 骨白 / 炭黑 / 血红 / 金色 / 紫色 多色调混合。
 */

import * as THREE from 'three';

/** 主题色板（十六进制字符串，供 canvas 绘制使用） */
export const PALETTE = {
  warmBrown: '#4a3524',
  warmBrownLight: '#6d5138',
  charcoal: '#15120f',
  charcoalSoft: '#241d18',
  boneWhite: '#e6dcc6',
  boneShadow: '#b3a68a',
  bloodRed: '#8e1c1c',
  bloodBright: '#d63a2a',
  gold: '#e8a828',
  goldPale: '#f6d98a',
  violet: '#7a48c8',
  violetDeep: '#3a1f5c',
  ash: '#8a8177',
} as const;

/** 是否具备 DOM canvas 能力 */
export function isDomAvailable(): boolean {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

/** 确定性随机数发生器（mulberry32） */
export function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/** 申请一块画布；无 DOM 或拿不到 2d context 时返回 null */
function surface(w: number, h: number): Surface | null {
  if (!isDomAvailable()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(w));
  canvas.height = Math.max(1, Math.floor(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

/** 画布 → three 纹理（统一设置 wrap / colorSpace / 各向异性） */
function toTexture(canvas: HTMLCanvasElement, srgb: boolean, repeat = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** 安全释放纹理（models.ts 的 dispose 会集中调用） */
export function disposeTexture(tex: THREE.Texture | null | undefined): void {
  if (tex) tex.dispose();
}

/** 通用入口：给一个绘制回调，返回纹理；无 DOM 返回 null */
export function createCanvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts?: { srgb?: boolean; repeat?: number },
): THREE.CanvasTexture | null {
  const s = surface(w, h);
  if (!s) return null;
  draw(s.ctx, s.canvas.width, s.canvas.height);
  return toTexture(s.canvas, opts?.srgb !== false, opts?.repeat ?? 1);
}

/* ------------------------------------------------------------------ *
 * 基础绘制工具
 * ------------------------------------------------------------------ */

/** 值噪声（用于地面斑驳、布料脏迹） */
function valueNoise(rng: () => number, gw: number, gh: number): number[] {
  const grid: number[] = new Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  return grid;
}

function sampleNoise(grid: number[], gw: number, gh: number, u: number, v: number): number {
  const x = u * gw;
  const y = v * gh;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const idx = (ix: number, iy: number): number => grid[((iy % gh) + gh) % gh * gw + (((ix % gw) + gw) % gw)];
  const a = idx(x0, y0);
  const b = idx(x0 + 1, y0);
  const c = idx(x0, y0 + 1);
  const d = idx(x0 + 1, y0 + 1);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

/** 递归分叉裂缝：既用于地面 albedo 的黑缝，也用于发光图的红缝 */
function crackBranch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  len: number,
  width: number,
  depth: number,
  rng: () => number,
): void {
  let cx = x;
  let cy = y;
  let ang = angle;
  const steps = 6 + Math.floor(rng() * 5);
  const segLen = len / steps;
  ctx.lineWidth = Math.max(0.6, width);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  for (let i = 0; i < steps; i++) {
    ang += (rng() - 0.5) * 0.55;
    cx += Math.cos(ang) * segLen;
    cy += Math.sin(ang) * segLen;
    ctx.lineTo(cx, cy);
    // 途中分叉
    if (depth > 0 && rng() < 0.32) {
      const side = rng() < 0.5 ? 1 : -1;
      crackBranch(ctx, cx, cy, ang + side * (0.5 + rng() * 0.7), len * (0.35 + rng() * 0.3), width * 0.55, depth - 1, rng);
      ctx.lineWidth = Math.max(0.6, width);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
    }
  }
  ctx.stroke();
}

/** 一整套裂缝网络（同 seed 可在 albedo / glow 两张图上复现同样走向） */
function drawCrackNetwork(ctx: CanvasRenderingContext2D, size: number, seed: number, strokeStyle: string, widthScale: number, blur: number, blurColor: string): void {
  const rng = makeRng(seed);
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (blur > 0) {
    ctx.shadowBlur = blur;
    ctx.shadowColor = blurColor;
  }
  const cx = size * 0.5;
  const cy = size * 0.5;
  // 从中心放射的主裂缝
  const trunks = 9;
  for (let i = 0; i < trunks; i++) {
    const a = (i / trunks) * Math.PI * 2 + rng() * 0.4;
    const r0 = size * (0.03 + rng() * 0.06);
    crackBranch(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, a, size * (0.24 + rng() * 0.22), 4.2 * widthScale, 3, rng);
  }
  // 边缘游荡的次级裂缝
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2;
    const r = size * (0.2 + rng() * 0.28);
    crackBranch(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, rng() * Math.PI * 2, size * (0.08 + rng() * 0.12), 2.2 * widthScale, 2, rng);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * 地面
 * ------------------------------------------------------------------ */

/** 圆形竞技场地面 albedo：黑岩 + 干涸颜料斑 + 裂缝 */
export function createCrackedGroundTexture(size = 1024, seed = 20331): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(seed);

  // 底色：暖棕 → 炭黑 径向
  const base = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.5);
  base.addColorStop(0, PALETTE.charcoalSoft);
  base.addColorStop(0.55, '#33251a');
  base.addColorStop(1, PALETTE.warmBrown);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // 斑驳噪声（岩石粗糙感）
  const gw = 48;
  const grid = valueNoise(rng, gw, gw);
  const cell = size / 128;
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const n = sampleNoise(grid, gw, gw, x / 128, y / 128);
      const n2 = sampleNoise(grid, gw, gw, (x * 3.1) / 128, (y * 3.1) / 128);
      const v = n * 0.65 + n2 * 0.35;
      ctx.fillStyle = 'rgba(' + Math.floor(20 + v * 46) + ',' + Math.floor(16 + v * 34) + ',' + Math.floor(12 + v * 24) + ',0.55)';
      ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
    }
  }

  // 干涸颜料残迹：金 / 血红 / 紫 / 骨白 多色调薄涂
  const paints = [PALETTE.gold, PALETTE.bloodRed, PALETTE.violet, PALETTE.boneShadow, PALETTE.violetDeep, PALETTE.bloodBright];
  for (let i = 0; i < 42; i++) {
    const px = rng() * size;
    const py = rng() * size;
    const pr = size * (0.015 + rng() * 0.07);
    const col = paints[Math.floor(rng() * paints.length)];
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.06 + rng() * 0.14;
    ctx.fillStyle = g;
    ctx.beginPath();
    // 不规则涂抹（椭圆 + 拖尾）
    ctx.ellipse(px, py, pr, pr * (0.4 + rng() * 0.8), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 笔刷拖痕
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 26; i++) {
    const x0 = rng() * size;
    const y0 = rng() * size;
    const a = rng() * Math.PI * 2;
    const l = size * (0.05 + rng() * 0.18);
    ctx.strokeStyle = rng() < 0.4 ? PALETTE.boneShadow : PALETTE.charcoal;
    ctx.lineWidth = 2 + rng() * 12;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + Math.cos(a) * l * 0.5 + (rng() - 0.5) * 40, y0 + Math.sin(a) * l * 0.5 + (rng() - 0.5) * 40, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 裂缝：先画宽的炭黑缝，再画细的暗红芯
  drawCrackNetwork(ctx, size, seed, 'rgba(8,6,5,0.95)', 1.0, 6, 'rgba(0,0,0,0.9)');
  drawCrackNetwork(ctx, size, seed, 'rgba(150,32,22,0.5)', 0.32, 5, 'rgba(190,50,30,0.55)');

  // 外缘压暗（聚焦舞台中心）
  const vig = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.3, size * 0.5, size * 0.5, size * 0.52);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);

  return toTexture(canvas, true, 1);
}

/** 裂缝自发光图：只有裂缝亮（暗红反光），其余全黑 */
export function createCrackGlowTexture(size = 512, seed = 20331): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  drawCrackNetwork(ctx, size, seed, 'rgba(214,58,42,0.95)', 0.5, 14, 'rgba(255,70,40,0.85)');
  drawCrackNetwork(ctx, size, seed, 'rgba(255,196,120,0.5)', 0.16, 5, 'rgba(255,150,60,0.7)');
  // 中心余烬更亮一点
  const g = ctx.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.28);
  g.addColorStop(0, 'rgba(120,26,18,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas, true, 1);
}

/** 地面粗糙度图（灰度，非颜色数据） */
export function createGroundRoughnessTexture(size = 512, seed = 771): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(seed);
  const gw = 32;
  const grid = valueNoise(rng, gw, gw);
  const n = 96;
  const cell = size / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = sampleNoise(grid, gw, gw, x / n, y / n) * 0.6 + sampleNoise(grid, gw, gw, (x * 4) / n, (y * 4) / n) * 0.4;
      const g = Math.floor(120 + v * 110);
      ctx.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
      ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
    }
  }
  // 裂缝处更光滑（湿润颜料）
  drawCrackNetwork(ctx, size, 20331, 'rgba(40,40,40,0.9)', 0.6, 4, 'rgba(0,0,0,0.5)');
  return toTexture(canvas, false, 1);
}

/* ------------------------------------------------------------------ *
 * 布料 / 面具 / 皮革
 * ------------------------------------------------------------------ */

/** 破损黑白长袍贴图：骨白底 + 炭黑墨染 + 血红/金细节 */
export function createClothTexture(size = 512, seed = 4404, light: string = PALETTE.boneWhite, dark: string = PALETTE.charcoal): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(seed);
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);

  // 织物细纹
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 3) {
    ctx.beginPath();
    ctx.moveTo(0, i + (rng() - 0.5) * 2);
    ctx.lineTo(size, i + (rng() - 0.5) * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 大块墨染（下半身几乎全黑）
  const grad = ctx.createLinearGradient(0, size * 0.25, 0, size);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.45, 'rgba(18,16,14,0.75)');
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 墨滴 / 泼溅
  for (let i = 0; i < 60; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = size * (0.004 + rng() * 0.045);
    ctx.fillStyle = rng() < 0.14 ? PALETTE.bloodRed : dark;
    ctx.globalAlpha = 0.18 + rng() * 0.55;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + rng()), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 金色滚边（上缘）与紫色缝线
  ctx.strokeStyle = PALETTE.gold;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = size * 0.012;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.06);
  for (let x = 0; x <= size; x += size / 16) ctx.lineTo(x, size * 0.06 + Math.sin(x * 0.05) * size * 0.008);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.violet;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = size * 0.004;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.42);
  for (let x = 0; x <= size; x += size / 24) ctx.lineTo(x, size * 0.42 + Math.sin(x * 0.09) * size * 0.02);
  ctx.stroke();
  ctx.globalAlpha = 1;

  return toTexture(canvas, true, 1);
}

/** 墨迹 alpha 图：白=保留，黑=镂空，用于袍角/羽翼布片的破损边缘 */
export function createInkAlphaTexture(size = 512, seed = 9182): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(seed);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // 底边撕裂：越靠下越破
  for (let i = 0; i < 220; i++) {
    const x = rng() * size;
    const y = size - Math.pow(rng(), 1.7) * size * 0.55;
    const r = size * (0.01 + rng() * 0.06);
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.5 + rng() * 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + rng() * 1.4), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 若干贯穿孔洞
  for (let i = 0; i < 16; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = size * (0.01 + rng() * 0.035);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, '#000000');
    g.addColorStop(0.7, '#000000');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas, false, 1);
}

/** Boss 面具：骨白 + 金纹 + 眼缝暗紫 */
export function createMaskTexture(size = 512): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(5150);
  ctx.fillStyle = PALETTE.boneWhite;
  ctx.fillRect(0, 0, size, size);

  // 骨白污渍
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 40; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = size * (0.01 + rng() * 0.06);
    ctx.fillStyle = rng() < 0.5 ? PALETTE.boneShadow : '#cfc3a6';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 眼缝（横向两道，环绕 UV 的中部）
  ctx.fillStyle = '#120c18';
  ctx.fillRect(0, size * 0.4, size, size * 0.085);
  ctx.fillStyle = 'rgba(122,72,200,0.55)';
  ctx.fillRect(0, size * 0.41, size, size * 0.02);

  // 金色裂纹纹路
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = size * 0.006;
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 18; i++) {
    const x = rng() * size;
    ctx.beginPath();
    ctx.moveTo(x, size * (0.05 + rng() * 0.3));
    ctx.lineTo(x + (rng() - 0.5) * size * 0.12, size * (0.55 + rng() * 0.4));
    ctx.stroke();
  }
  // 额心血红点
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = PALETTE.bloodRed;
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.2, size * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  return toTexture(canvas, true, 1);
}

/** 金属/皮革基底（Boss 护甲、角色轻甲） */
export function createMetalTexture(size = 256, seed = 616, tint = '#5a5348'): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(seed);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  // 竖向拉丝
  for (let x = 0; x < size; x++) {
    const v = rng();
    ctx.fillStyle = 'rgba(255,255,255,' + (v * 0.07).toFixed(3) + ')';
    ctx.fillRect(x, 0, 1, size);
    ctx.fillStyle = 'rgba(0,0,0,' + (rng() * 0.09).toFixed(3) + ')';
    ctx.fillRect(x, size * rng(), 1, size * (0.1 + rng() * 0.5));
  }
  // 磕碰
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = 'rgba(20,16,12,0.4)';
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, size * (0.004 + rng() * 0.02), 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas, true, 1);
}

/* ------------------------------------------------------------------ *
 * 精灵 / 光效用小图
 * ------------------------------------------------------------------ */

/** 径向柔光点（粒子、光晕、法器核心） */
export function createRadialGlowTexture(size = 128, softness = 2.2, core = 'rgba(255,255,255,1)'): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = Math.pow(1 - t, softness);
    g.addColorStop(t, i === 0 ? core : 'rgba(255,255,255,' + a.toFixed(3) + ')');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas, false, 1);
}

/** 碎屑颗粒（不规则墨点，比圆点更像颜料屑） */
export function createFleckTexture(size = 64, seed = 3311): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(seed);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = size * (0.2 + rng() * 0.24);
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r * 0.8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // 边缘羽化
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  return toTexture(canvas, false, 1);
}

/** 剑光条纹：沿 v 方向的锐利渐变，中心亮、两端收束 */
export function createStreakTexture(w = 64, h = 256): THREE.CanvasTexture | null {
  const s = surface(w, h);
  if (!s) return null;
  const { ctx, canvas } = s;
  ctx.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    // 沿刃长：根部弱、中段最亮、尖端拉细
    const along = Math.sin(Math.pow(v, 0.75) * Math.PI) * (0.55 + 0.45 * (1 - v));
    for (let x = 0; x < w; x++) {
      const u = (x / (w - 1)) * 2 - 1;
      const across = Math.pow(Math.max(0, 1 - Math.abs(u)), 2.4);
      const a = Math.min(1, along * across * 1.5);
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return toTexture(canvas, false, 1);
}

/** 羽翼布片 alpha：上密下裂的羽状轮廓 */
export function createFeatherTexture(size = 256, seed = 8123): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(seed);
  ctx.clearRect(0, 0, size, size);
  // 主体纺锤形
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.quadraticCurveTo(size * 0.95, size * 0.35, size * 0.55, size);
  ctx.quadraticCurveTo(size * 0.5, size * 0.6, size * 0.45, size);
  ctx.quadraticCurveTo(size * 0.05, size * 0.35, size * 0.5, 0);
  ctx.fill();
  // 撕裂缺口
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 60; i++) {
    const y = Math.pow(rng(), 0.6) * size;
    const side = rng() < 0.5 ? -1 : 1;
    const x = size * 0.5 + side * (size * (0.1 + rng() * 0.42));
    ctx.beginPath();
    ctx.ellipse(x, y, size * (0.01 + rng() * 0.05), size * (0.01 + rng() * 0.03), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  return toTexture(canvas, false, 1);
}

/** 骨白花簇小图（远景装饰面片） */
export function createBoneFlowerTexture(size = 128, seed = 4242): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(seed);
  ctx.clearRect(0, 0, size, size);
  // 数根细茎 + 顶端骨白花瓣
  for (let i = 0; i < 5; i++) {
    const x0 = size * (0.2 + rng() * 0.6);
    const top = size * (0.12 + rng() * 0.3);
    ctx.strokeStyle = 'rgba(90,80,64,0.85)';
    ctx.lineWidth = size * 0.012;
    ctx.beginPath();
    ctx.moveTo(x0, size);
    ctx.quadraticCurveTo(x0 + (rng() - 0.5) * size * 0.2, size * 0.6, x0 + (rng() - 0.5) * size * 0.1, top);
    ctx.stroke();
    const cx = x0 + (rng() - 0.5) * size * 0.1;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + rng();
      ctx.fillStyle = p % 2 === 0 ? 'rgba(230,220,198,0.95)' : 'rgba(179,166,138,0.9)';
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * size * 0.035, top + Math.sin(a) * size * 0.035, size * 0.03, size * 0.016, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(232,168,40,0.8)';
    ctx.beginPath();
    ctx.arc(cx, top, size * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas, true, 1);
}

/** 颜料残片（漂浮/散落的多色调碎片） */
export function createPaintShardTexture(size = 128, seed = 7777): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(seed);
  ctx.clearRect(0, 0, size, size);
  const cols = [PALETTE.gold, PALETTE.bloodBright, PALETTE.violet, PALETTE.boneWhite];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = cols[i];
    ctx.globalAlpha = 0.55 + rng() * 0.4;
    ctx.beginPath();
    const cx = size * (0.25 + rng() * 0.5);
    const cy = size * (0.25 + rng() * 0.5);
    const n = 3 + Math.floor(rng() * 3);
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const r = size * (0.08 + rng() * 0.2);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas, true, 1);
}

/** 通用线性渐变纹理（法阵、光柱、地面装饰环） */
export function createGradientTexture(stops: Array<[number, string]>, size = 128, vertical = true): THREE.CanvasTexture | null {
  const s = surface(vertical ? 4 : size, vertical ? size : 4);
  if (!s) return null;
  const { ctx, canvas } = s;
  const g = vertical ? ctx.createLinearGradient(0, 0, 0, canvas.height) : ctx.createLinearGradient(0, 0, canvas.width, 0);
  for (const st of stops) g.addColorStop(Math.min(1, Math.max(0, st[0])), st[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return toTexture(canvas, true, 1);
}

/** 灰度噪声（溶解/扰动等用得上的通用图） */
export function createNoiseTexture(size = 256, scale = 8, seed = 1337): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  const rng = makeRng(seed);
  const grid = valueNoise(rng, scale, scale);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = sampleNoise(grid, scale, scale, x / size, y / size) * 0.6 + sampleNoise(grid, scale, scale, (x * 4) / size, (y * 4) / size) * 0.4;
      const g = Math.floor(v * 255);
      const i = (y * size + x) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, false, 1);
}

/** 环形冲击波 alpha（完美格挡环 / 元素环） */
export function createRingTexture(size = 256, thickness = 0.16): THREE.CanvasTexture | null {
  const s = surface(size, size);
  if (!s) return null;
  const { ctx, canvas } = s;
  ctx.clearRect(0, 0, size, size);
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = size * (0.5 - thickness * 0.5 + thickness * t * 0.5) * 0.96;
    const a = Math.sin(t * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.16).toFixed(3) + ')';
    ctx.lineWidth = (size * thickness) / steps + 1.5;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  return toTexture(canvas, false, 1);
}
