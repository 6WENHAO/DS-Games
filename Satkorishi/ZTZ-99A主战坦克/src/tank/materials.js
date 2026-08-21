/**
 * 材质 / 涂装系统
 *
 * 全部贴图在浏览器端用 Canvas 程序化生成（无外部图片依赖），
 * 因此导出 GLB 时贴图会被内嵌为 PNG，在 Blender / 三维软件里可以直接看到涂装。
 *
 * 涂装方案：5 套现实向 + 1 套科幻蓝白。
 * 复用同一批 material 实例：切换涂装只替换贴图与参数，不重新绑定网格。
 */
import * as THREE from 'three';
import { rng } from '../util/geom.js';

/* ------------------------------------------------------------------ *
 * 涂装方案定义
 * ------------------------------------------------------------------ */
export const SCHEMES = [
  {
    id: 'jungle',
    name: '三色丛林迷彩',
    en: 'Three-tone Woodland',
    note: '陆军合成旅制式涂装，绿/土黄/墨黑三色不规则色块',
    pattern: 'blob',
    base: '#4d5839',
    patches: ['#6d6440', '#2a3023', '#7b7050'],
    blobs: 13,
    blobSize: 0.3,
    roughness: 0.72,
    metalness: 0.24,
    weather: 0.5,
    accent: null,
  },
  {
    id: 'digital',
    name: '数码迷彩',
    en: 'Digital Camouflage',
    note: '07 式数码像素迷彩风格，像素块打散车体轮廓',
    pattern: 'digital',
    base: '#525c43',
    patches: ['#39422f', '#8a8a6e', '#242a1d'],
    cells: 26,
    roughness: 0.74,
    metalness: 0.22,
    weather: 0.45,
    accent: null,
  },
  {
    id: 'desert',
    name: '荒漠迷彩',
    en: 'Desert Camouflage',
    note: '西北戈壁地区演训涂装，沙黄底配棕/灰斑块',
    pattern: 'blob',
    base: '#ad9569',
    patches: ['#8a7146', '#6c6351', '#c8b389'],
    blobs: 11,
    blobSize: 0.34,
    roughness: 0.78,
    metalness: 0.2,
    weather: 0.72,
    accent: null,
  },
  {
    id: 'winter',
    name: '冬季白迷彩',
    en: 'Winter Camouflage',
    note: '寒区加挂白色水洗涂层，露出底漆绿灰',
    pattern: 'blob',
    base: '#dde1dd',
    patches: ['#98a098', '#6c766d'],
    blobs: 9,
    blobSize: 0.26,
    roughness: 0.68,
    metalness: 0.22,
    weather: 0.6,
    accent: null,
  },
  {
    id: 'parade',
    name: '阅兵制式绿',
    en: 'Parade Green',
    note: '阅兵/展示状态单色军绿，漆面平整、几乎无风化',
    pattern: 'solid',
    base: '#3f4a34',
    patches: ['#48533b'],
    roughness: 0.52,
    metalness: 0.3,
    weather: 0.08,
    accent: null,
  },
  {
    id: 'scifi',
    name: '科幻蓝白（虚构）',
    en: 'Sci-Fi Blue/White',
    note: '虚构未来涂装：白色装甲板 + 钴蓝分区 + 青色能量线（发光）',
    pattern: 'panel',
    base: '#eaf0f7',
    patches: ['#1b6fd4', '#0d2a52', '#a9c6e8'],
    roughness: 0.3,
    metalness: 0.38,
    weather: 0.05,
    accent: '#3fe4ff',
    accentIntensity: 1.6,
    fictional: true,
  },
];

export const DEFAULT_SCHEME = 'jungle';

/* ------------------------------------------------------------------ *
 * 程序化噪声 / 贴图工厂
 * ------------------------------------------------------------------ */
function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/** 可平铺值噪声场 */
function noiseField(size, seed) {
  const rnd = rng(seed);
  const N = 64;
  const g = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) g[i] = rnd();
  const at = (x, y) => g[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  const smooth = (fx, fy) => {
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  };
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 0.5;
      let f = 4;
      for (let o = 0; o < 5; o++) {
        v += smooth((x / size) * f, (y / size) * f) * amp;
        f *= 2;
        amp *= 0.5;
      }
      out[y * size + x] = v;
    }
  }
  return out;
}

/** 高度场 → 法线贴图（Sobel） */
function normalTextureFromNoise(size = 256, seed = 7, strength = 1.4) {
  const h = noiseField(size, seed);
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => h[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength * 6;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength * 6;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 高度场 → 粗糙度贴图（漆面不均匀 / 磨损） */
function roughnessTextureFromNoise(size = 256, seed = 11, lo = 0.45, hi = 0.95) {
  const h = noiseField(size, seed);
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(1, (h[i] - 0.25) / 0.5));
    const g = (lo + (hi - lo) * v) * 255;
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 有机色块（迷彩斑），带 3x3 重绘实现无缝平铺 */
function drawBlob(ctx, cx, cy, r, size, rnd) {
  const pts = [];
  const n = 9 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.55 + rnd() * 0.85);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr * (0.6 + rnd() * 0.6)]);
  }
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      ctx.beginPath();
      const bx = cx + ox * size;
      const by = cy + oy * size;
      ctx.moveTo(bx + pts[0][0], by + pts[0][1]);
      for (let i = 0; i < pts.length; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % pts.length];
        const mx = (p0[0] + p1[0]) / 2;
        const my = (p0[1] + p1[1]) / 2;
        ctx.quadraticCurveTo(bx + p0[0], by + p0[1], bx + mx, by + my);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** 主涂装贴图 */
function camoTexture(scheme, size = 1024, weather = null) {
  const w = weather === null ? scheme.weather : weather;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rnd = rng(1337);
  ctx.fillStyle = scheme.base;
  ctx.fillRect(0, 0, size, size);

  if (scheme.pattern === 'blob') {
    const count = scheme.blobs || 12;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = scheme.patches[i % scheme.patches.length];
      drawBlob(ctx, rnd() * size, rnd() * size, size * (scheme.blobSize || 0.3) * (0.6 + rnd() * 0.8), size, rnd);
    }
    // 边缘噪点，模拟喷涂过渡
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = scheme.patches[Math.floor(rnd() * scheme.patches.length)];
      ctx.globalAlpha = 0.25 + rnd() * 0.4;
      const s = 2 + rnd() * 9;
      ctx.fillRect(rnd() * size, rnd() * size, s, s);
    }
    ctx.globalAlpha = 1;
  } else if (scheme.pattern === 'digital') {
    const n = scheme.cells || 24;
    const cell = size / n;
    const f = noiseField(n, 99);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = f[y * n + x];
        const idx = v < 0.42 ? -1 : v < 0.56 ? 0 : v < 0.7 ? 1 : 2;
        if (idx >= 0) {
          ctx.fillStyle = scheme.patches[idx % scheme.patches.length];
          ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
        }
        // 半尺寸子像素，制造数码碎边
        if (rnd() < 0.3) {
          ctx.fillStyle = scheme.patches[Math.floor(rnd() * scheme.patches.length)];
          ctx.fillRect(x * cell + (rnd() < 0.5 ? 0 : cell / 2), y * cell + (rnd() < 0.5 ? 0 : cell / 2), cell / 2, cell / 2);
        }
      }
    }
  } else if (scheme.pattern === 'panel') {
    // 科幻：白底 + 蓝色分区板 + 板缝
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i % 3 === 0 ? scheme.patches[0] : i % 3 === 1 ? scheme.patches[2] : scheme.patches[1];
      ctx.globalAlpha = i % 3 === 1 ? 0.5 : 0.92;
      const w0 = size * (0.1 + rnd() * 0.35);
      const h0 = size * (0.05 + rnd() * 0.16);
      const x0 = rnd() * size;
      const y0 = rnd() * size;
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) roundRect(ctx, x0 + ox * size, y0 + oy * size, w0, h0, size * 0.012, true);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(20,40,70,0.45)';
    ctx.lineWidth = Math.max(1, size / 380);
    for (let i = 0; i < 16; i++) {
      const y = (i / 16) * size + rnd() * 8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const x = (i / 10) * size + rnd() * 8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
  } else {
    // solid：单色 + 轻微色差
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = scheme.patches[0];
      ctx.globalAlpha = 0.05 + rnd() * 0.1;
      drawBlob(ctx, rnd() * size, rnd() * size, size * 0.14, size, rnd);
    }
    ctx.globalAlpha = 1;
  }

  // 板缝与铆接线（所有涂装通用，让平面不空）
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = Math.max(1, size / 512);
  for (let i = 0; i < 6; i++) {
    const y = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rnd() - 0.5) * 10);
    ctx.stroke();
  }

  // 风化：油污流痕 + 掉漆点 + 扬尘
  if (w > 0.01) {
    for (let i = 0; i < 260 * w; i++) {
      ctx.globalAlpha = 0.04 + rnd() * 0.1 * w;
      ctx.fillStyle = rnd() < 0.55 ? '#2b241a' : '#0d0f0c';
      const x = rnd() * size;
      const y = rnd() * size;
      const h = 20 + rnd() * 150 * w;
      ctx.fillRect(x, y, 1 + rnd() * 4, h);
    }
    for (let i = 0; i < 500 * w; i++) {
      ctx.globalAlpha = 0.12 + rnd() * 0.35;
      ctx.fillStyle = rnd() < 0.5 ? '#6a6152' : '#3a3226';
      ctx.beginPath();
      ctx.arc(rnd() * size, rnd() * size, 1 + rnd() * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // 尘土色调整体覆盖
    ctx.globalAlpha = 0.1 * w;
    ctx.fillStyle = '#b8a583';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1;
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 科幻方案的自发光能量线贴图 */
function accentTexture(scheme, size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  if (!scheme.accent) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const rnd = rng(4242);
  ctx.strokeStyle = scheme.accent;
  ctx.shadowColor = scheme.accent;
  ctx.shadowBlur = size * 0.02;
  for (let i = 0; i < 7; i++) {
    ctx.lineWidth = size * (0.004 + rnd() * 0.006);
    const y = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    let x = 0;
    let yy = y;
    while (x < size) {
      const dx = size * (0.08 + rnd() * 0.18);
      x += dx;
      if (rnd() < 0.35) {
        yy += (rnd() - 0.5) * size * 0.1;
        ctx.lineTo(x, yy);
      } else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = scheme.accent;
    const s = size * (0.006 + rnd() * 0.014);
    ctx.fillRect(rnd() * size, rnd() * size, s * 3, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  else ctx.stroke();
}

/** 八一军徽贴花（透明底） */
export function emblemTexture(size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.44;
  ctx.fillStyle = '#c8161d';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? R : R * 0.42;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,120,0.9)';
  ctx.lineWidth = size * 0.012;
  ctx.stroke();
  ctx.fillStyle = '#f2d24b';
  ctx.font = `bold ${size * 0.3}px "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('八一', cx, cy + size * 0.02);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 战术编号贴花 */
export function numberTexture(text = '99A-021', size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#e8e6dd';
  ctx.font = `bold ${size * 0.2}px "Consolas", "Microsoft YaHei", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.02;
  ctx.fillText(text, size / 2, size / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 栅网（尾栏筐 / 进气网）alpha 贴图 */
function gridAlphaTexture(size = 128, cells = 10) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = size / cells / 4;
  for (let i = 0; i <= cells; i++) {
    const p = (i / cells) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 地面贴图：碾压土/砾石 + 车辙 */
export function groundTexture(size = 1024) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rnd = rng(20260821);
  ctx.fillStyle = '#6b6250';
  ctx.fillRect(0, 0, size, size);
  const f = noiseField(size, 3);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const v = (f[i] - 0.5) * 90;
    img.data[i * 4] = Math.max(0, Math.min(255, 107 + v));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, 98 + v));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, 80 + v * 0.8));
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 4200; i++) {
    ctx.globalAlpha = 0.1 + rnd() * 0.4;
    ctx.fillStyle = rnd() < 0.5 ? '#8b8270' : '#4a4438';
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, 1 + rnd() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(28, 28);
  return t;
}

/** 烟雾粒子贴图（软边噪声团） */
export function smokeTexture(size = 128) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const f = noiseField(size, 77);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const d = Math.hypot(dx, dy);
      const fall = Math.max(0, 1 - d);
      const a = Math.pow(fall, 1.6) * (0.55 + f[i] * 0.9);
      img.data[i * 4] = 235;
      img.data[i * 4 + 1] = 232;
      img.data[i * 4 + 2] = 226;
      img.data[i * 4 + 3] = Math.max(0, Math.min(255, a * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 炮口焰贴图（高亮星芒） */
export function flashTexture(size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const cx = size / 2;
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  g.addColorStop(0, 'rgba(255,255,245,1)');
  g.addColorStop(0.12, 'rgba(255,240,190,0.98)');
  g.addColorStop(0.3, 'rgba(255,180,80,0.72)');
  g.addColorStop(0.6, 'rgba(220,110,35,0.26)');
  g.addColorStop(1, 'rgba(120,50,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // 星芒
  ctx.globalCompositeOperation = 'lighter';
  const rnd = rng(5);
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const len = cx * (0.4 + rnd() * 0.6);
    ctx.strokeStyle = `rgba(255,${190 + rnd() * 60 | 0},120,${0.15 + rnd() * 0.3})`;
    ctx.lineWidth = 1 + rnd() * 4;
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.lineTo(cx + Math.cos(a) * len, cx + Math.sin(a) * len);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ *
 * 材质库
 * ------------------------------------------------------------------ */
export class MaterialLibrary {
  constructor() {
    this.schemeId = DEFAULT_SCHEME;
    this.weather = null; // null = 用方案默认值
    this.detailNormal = normalTextureFromNoise(256, 7, 1.1);
    this.paintRough = roughnessTextureFromNoise(256, 11, 0.5, 0.95);
    this.metalRough = roughnessTextureFromNoise(256, 23, 0.25, 0.7);
    this.gridAlpha = gridAlphaTexture();
    this.camo = null;
    this.accent = null;
    this.textures = [this.detailNormal, this.paintRough, this.metalRough, this.gridAlpha];
    this.m = this.#createMaterials();
    this.applyScheme(DEFAULT_SCHEME);
  }

  #createMaterials() {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const m = {
      // 车体/炮塔主装甲（受涂装控制）
      armor: std({ name: 'armor_paint', roughness: 0.72, metalness: 0.24 }),
      armorDark: std({ name: 'armor_paint_dark', roughness: 0.76, metalness: 0.26 }),
      era: std({ name: 'era_block', roughness: 0.8, metalness: 0.22 }),
      skirt: std({ name: 'side_skirt', roughness: 0.85, metalness: 0.1 }),
      // 金属件
      steel: std({ name: 'steel', color: 0x9aa0a6, roughness: 0.42, metalness: 0.95 }),
      steelDark: std({ name: 'steel_dark', color: 0x4d5257, roughness: 0.5, metalness: 0.9 }),
      gunSteel: std({ name: 'gun_steel', color: 0x53585c, roughness: 0.46, metalness: 0.88 }),
      blackMetal: std({ name: 'black_metal', color: 0x1c1f22, roughness: 0.44, metalness: 0.85 }),
      exhaust: std({ name: 'exhaust_burnt', color: 0x4a3a30, roughness: 0.72, metalness: 0.7 }),
      brass: std({ name: 'brass', color: 0xc79a3e, roughness: 0.32, metalness: 1 }),
      copper: std({ name: 'copper', color: 0xb06a3b, roughness: 0.4, metalness: 1 }),
      alu: std({ name: 'aluminium', color: 0xb9bcc0, roughness: 0.36, metalness: 0.95 }),
      // 橡胶/织物
      rubber: std({ name: 'rubber', color: 0x1a1a1c, roughness: 0.92, metalness: 0.05 }),
      track: std({ name: 'track_steel', color: 0x54524e, roughness: 0.55, metalness: 0.9 }),
      trackPad: std({ name: 'track_pad', color: 0x232322, roughness: 0.95, metalness: 0.04 }),
      tarp: std({ name: 'tarp_canvas', color: 0x5c5b46, roughness: 0.95, metalness: 0.02 }),
      net: std({
        name: 'basket_net',
        color: 0x35383a,
        roughness: 0.7,
        metalness: 0.6,
        transparent: true,
        alphaTest: 0.35,
        side: THREE.DoubleSide,
      }),
      // 光学
      glass: new THREE.MeshPhysicalMaterial({
        name: 'optic_glass',
        color: 0x0a1418,
        roughness: 0.06,
        metalness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 2.2,
      }),
      optic: new THREE.MeshPhysicalMaterial({
        name: 'optic_lens',
        color: 0x0d2a24,
        roughness: 0.05,
        metalness: 0.2,
        clearcoat: 1,
        emissive: 0x0a3a30,
        emissiveIntensity: 0.35,
        envMapIntensity: 2.6,
      }),
      lamp: std({ name: 'lamp_glass', color: 0xdfe6ea, roughness: 0.12, metalness: 0.2, emissive: 0x223033, emissiveIntensity: 0.4 }),
      lampIR: std({ name: 'lamp_ir', color: 0x5c1010, roughness: 0.2, metalness: 0.3, emissive: 0x330404, emissiveIntensity: 0.5 }),
      // 内部
      interior: std({ name: 'interior_paint', color: 0xd9d6c8, roughness: 0.78, metalness: 0.08 }),
      interiorMetal: std({ name: 'interior_metal', color: 0x7d8288, roughness: 0.5, metalness: 0.8 }),
      engineBlock: std({ name: 'engine_block', color: 0x3c4348, roughness: 0.6, metalness: 0.85 }),
      engineHot: std({ name: 'engine_manifold', color: 0x6b4a35, roughness: 0.65, metalness: 0.8 }),
      ammoShell: std({ name: 'ammo_projectile', color: 0x4a4f45, roughness: 0.42, metalness: 0.8 }),
      ammoCharge: std({ name: 'ammo_charge', color: 0xa8813f, roughness: 0.55, metalness: 0.5 }),
      // 乘员
      uniform: std({ name: 'crew_uniform', color: 0x4a5240, roughness: 0.9, metalness: 0.02 }),
      skin: std({ name: 'crew_skin', color: 0xc08a63, roughness: 0.75, metalness: 0 }),
      helmet: std({ name: 'crew_helmet', color: 0x2f3630, roughness: 0.6, metalness: 0.2 }),
      // 贴花
      emblem: new THREE.MeshStandardMaterial({
        name: 'decal_emblem',
        map: emblemTexture(),
        transparent: true,
        alphaTest: 0.35,
        roughness: 0.7,
        metalness: 0.1,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      number: new THREE.MeshStandardMaterial({
        name: 'decal_number',
        map: numberTexture(),
        transparent: true,
        alphaTest: 0.3,
        roughness: 0.7,
        metalness: 0.1,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      // 发光（科幻）
      accentGlow: std({ name: 'accent_glow', color: 0x0a1a24, emissive: 0x3fe4ff, emissiveIntensity: 0, roughness: 0.3, metalness: 0.5 }),
    };
    // 通用细节法线
    for (const key of ['armor', 'armorDark', 'era', 'skirt', 'steel', 'steelDark', 'gunSteel', 'blackMetal', 'interior', 'engineBlock']) {
      m[key].normalMap = this.detailNormal;
      m[key].normalScale = new THREE.Vector2(0.35, 0.35);
    }
    m.net.alphaMap = this.gridAlpha;
    m.net.alphaMap.repeat.set(6, 3);
    for (const key of ['steel', 'steelDark', 'gunSteel', 'track']) m[key].roughnessMap = this.metalRough;
    return m;
  }

  get scheme() {
    return SCHEMES.find((s) => s.id === this.schemeId) || SCHEMES[0];
  }

  /** 切换涂装（原地修改材质，不需要重新绑定网格） */
  applyScheme(id, weather = null) {
    const scheme = SCHEMES.find((s) => s.id === id);
    if (!scheme) return;
    this.schemeId = id;
    this.weather = weather;
    if (this.camo) this.camo.dispose();
    if (this.accent) this.accent.dispose();
    this.camo = camoTexture(scheme, 1024, weather);
    this.accent = accentTexture(scheme, 512);
    if (this.anisotropy) {
      this.camo.anisotropy = this.anisotropy;
      this.accent.anisotropy = this.anisotropy;
    }
    const m = this.m;
    const painted = [m.armor, m.armorDark, m.era, m.skirt];
    for (const mat of painted) {
      mat.map = this.camo;
      mat.roughnessMap = this.paintRough;
      mat.roughness = scheme.roughness;
      mat.metalness = scheme.metalness;
      mat.needsUpdate = true;
    }
    m.armor.color.set(0xffffff);
    m.armorDark.color.set(0xc8c8c8);
    m.era.color.set(0xdedede);
    m.skirt.color.set(0xb4b4b4);
    m.skirt.roughness = Math.min(0.95, scheme.roughness + 0.12);

    // 发光配件
    const glowOn = !!scheme.accent;
    m.accentGlow.emissiveIntensity = glowOn ? scheme.accentIntensity || 1.4 : 0;
    if (glowOn) m.accentGlow.emissive.set(scheme.accent);
    for (const mat of painted) {
      mat.emissiveMap = glowOn ? this.accent : null;
      mat.emissive.set(glowOn ? 0xffffff : 0x000000);
      mat.emissiveIntensity = glowOn ? scheme.accentIntensity || 1.4 : 0;
      mat.needsUpdate = true;
    }
    // 科幻方案下的金属件也变亮一些
    const sci = scheme.id === 'scifi';
    m.steel.color.set(sci ? 0xd6dde4 : 0x9aa0a6);
    m.gunSteel.color.set(sci ? 0x7f8b96 : 0x53585c);
    m.rubber.color.set(sci ? 0x22252b : 0x1a1a1c);
    m.track.color.set(sci ? 0x8b949c : 0x54524e);
    m.uniform.color.set(sci ? 0x2a3240 : 0x4a5240);
    m.helmet.color.set(sci ? 0x1e242c : 0x2f3630);
    // 冬季涂装：履带与裙板挂雪泥
    if (scheme.id === 'winter') {
      m.track.color.set(0x8d8f8c);
      m.trackPad.color.set(0x4a4c49);
    } else {
      m.trackPad.color.set(0x232322);
    }
    return scheme;
  }

  setAnisotropy(n) {
    this.anisotropy = n;
    for (const t of [...this.textures, this.camo, this.accent].filter(Boolean)) t.anisotropy = n;
  }

  /** 给所有材质设置环境贴图强度 */
  setEnvIntensity(v) {
    for (const mat of Object.values(this.m)) {
      if ('envMapIntensity' in mat) mat.envMapIntensity = mat.name === 'optic_glass' || mat.name === 'optic_lens' ? v * 2 : v;
    }
  }

  dispose() {
    for (const t of [...this.textures, this.camo, this.accent].filter(Boolean)) t.dispose();
    for (const mat of Object.values(this.m)) mat.dispose();
  }
}
