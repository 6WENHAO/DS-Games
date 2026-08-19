// ---------------------------------------------------------------------------
// 程序化贴图生成（Canvas 2D）
//   - 无任何外部图片素材，所有贴图/精灵都在运行时用 2D 画布画出来
//   - 随机数全部来自可播种 PRNG（mulberry32），seed 由贴图名字哈希得到，
//     因此同一个名字永远得到完全相同的结果（禁止 Math.random）
//   - 除 crate / skybox / radar_grid 外，所有贴图都做了无缝平铺处理
//   - 顶层无副作用：模块加载时不创建任何 canvas
// ---------------------------------------------------------------------------

// ============================ 基础工具 =====================================

/** 字符串 -> 32 位无符号哈希（FNV-1a），用作 PRNG 种子 */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32：小巧的可播种伪随机数生成器，返回 [0,1) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/** rgb / rgba 颜色字符串 */
function rgb(r, g, b) {
  return 'rgb(' + clampByte(r) + ',' + clampByte(g) + ',' + clampByte(b) + ')';
}
function rgba(r, g, b, a) {
  return 'rgba(' + clampByte(r) + ',' + clampByte(g) + ',' + clampByte(b) + ',' + clamp01(a) + ')';
}
/** 颜色数组按系数缩放 */
function scaleCol(c, k) {
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** 新建画布（Node 环境下给出清晰错误） */
function newCanvas(w, h) {
  if (typeof document === 'undefined') {
    throw new Error('textures.js 需要浏览器环境：document 不存在，无法用 Canvas 2D 生成贴图');
  }
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

/**
 * 环绕（可平铺）value noise。
 * n = 噪声网格边长；采样坐标以「网格格数」为单位，超出范围自动取模环绕。
 */
function valueNoise(rnd, n) {
  const g = new Float32Array(n * n);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return {
    n,
    at(x, y) {
      const xf = Math.floor(x);
      const yf = Math.floor(y);
      const tx = smooth(x - xf);
      const ty = smooth(y - yf);
      const x0 = ((xf % n) + n) % n;
      const y0 = ((yf % n) + n) % n;
      const x1 = (x0 + 1) % n;
      const y1 = (y0 + 1) % n;
      const a = g[y0 * n + x0];
      const b = g[y0 * n + x1];
      const c = g[y1 * n + x0];
      const d = g[y1 * n + x1];
      return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
    },
  };
}

/**
 * 分形叠加噪声。
 * 注意：坐标以「网格格数」为单位，要保证无缝必须让整张贴图正好跨越 nz.n 格
 * （即 x = u * nz.n），这样每一倍频的跨度都是 n 的整数倍。
 */
function fbm(nz, x, y, oct = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += amp * nz.at(x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/**
 * 多层环绕 fbm 场：每层使用独立噪声网格，网格边长 = 该层频率，
 * 因此 u=0 与 u=1 采样到同一格 —— 天然无缝，且各层互不重复。
 * at(u, v) 的 u/v 取 [0,1) 的归一化贴图坐标。
 */
function fbmField(rnd, baseFreq = 4, oct = 5) {
  const layers = [];
  let f = Math.max(1, baseFreq | 0);
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    layers.push({ nz: valueNoise(rnd, f), f, amp });
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return {
    at(u, v) {
      let s = 0;
      for (let i = 0; i < layers.length; i++) {
        const l = layers[i];
        s += l.amp * l.nz.at(u * l.f, v * l.f);
      }
      return s / norm;
    },
  };
}

/** 逐像素填充：fn(x, y, out[3]) 写入 0..255 的 RGB */
function fillPixels(ctx, size, fn) {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const out = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x, y, out);
      const i = (y * size + x) * 4;
      d[i] = clampByte(out[0]);
      d[i + 1] = clampByte(out[1]);
      d[i + 2] = clampByte(out[2]);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** fbm 底色：在 base 颜色上叠加无缝低频斑驳 */
function mottle(ctx, size, rnd, base, amount, freq = 4, oct = 5) {
  const field = fbmField(rnd, freq, oct);
  fillPixels(ctx, size, (x, y, out) => {
    const v = (field.at(x / size, y / size) - 0.5) * 2 * amount;
    out[0] = base[0] * (1 + v);
    out[1] = base[1] * (1 + v * 0.95);
    out[2] = base[2] * (1 + v * 0.9);
  });
}

/** 统一的很淡颗粒噪声（所有贴图最后都叠一层） */
function grain(ctx, size, amt, rnd) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amt;
    d[i] = clampByte(d[i] + n);
    d[i + 1] = clampByte(d[i + 1] + n);
    d[i + 2] = clampByte(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
}

/** 平铺安全的矩形填充：越界时在对侧重复画一遍 */
function tileRect(ctx, size, x, y, w, h) {
  for (let ix = -1; ix <= 1; ix++) {
    for (let iy = -1; iy <= 1; iy++) {
      const px = x + ix * size;
      const py = y + iy * size;
      if (px > size || px + w < 0 || py > size || py + h < 0) continue;
      ctx.fillRect(px, py, w, h);
    }
  }
}

/** 平铺安全的自定义绘制：draw(dx, dy) 会在需要的对侧偏移上重复调用 */
function tileDraw(ctx, size, x, y, r, draw) {
  const xs = [0];
  const ys = [0];
  if (x - r < 0) xs.push(size);
  if (x + r > size) xs.push(-size);
  if (y - r < 0) ys.push(size);
  if (y + r > size) ys.push(-size);
  for (const dx of xs) for (const dy of ys) draw(dx, dy);
}

/** 径向渐变填充工具 */
function radial(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  ctx.fillStyle = g;
  return g;
}

/** 线性渐变填充工具 */
function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  ctx.fillStyle = g;
  return g;
}

/** 砖块排布（错缝），返回时画笔状态已恢复 */
function bricks(ctx, size, rows, cols, opts) {
  const rnd = opts.rnd;
  const base = opts.color;
  const bh = size / rows;
  const bw = size / cols;
  const gap = opts.gap === undefined ? Math.max(1.5, size / 128) : opts.gap;
  const jitter = opts.jitter === undefined ? 0.08 : opts.jitter;
  const offset = opts.offset === undefined ? 0.5 : opts.offset;
  ctx.save();
  ctx.fillStyle = opts.mortar || '#8a8578';
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    const shift = offset * bw * (r % 2);
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + shift + gap * 0.5;
      const y = r * bh + gap * 0.5;
      const w = bw - gap;
      const h = bh - gap;
      const k = 1 + (rnd() - 0.5) * 2 * jitter;
      ctx.fillStyle = rgb(base[0] * k, base[1] * k, base[2] * k);
      tileRect(ctx, size, x, y, w, h);
      // 上沿高光 / 下沿阴影，让砖块有厚度
      ctx.fillStyle = rgba(255, 255, 255, 0.07);
      tileRect(ctx, size, x, y, w, Math.max(1, h * 0.12));
      ctx.fillStyle = rgba(0, 0, 0, 0.12);
      tileRect(ctx, size, x, y + h - Math.max(1, h * 0.14), w, Math.max(1, h * 0.14));
    }
  }
  ctx.restore();
}

/** 随机划痕/细线（平铺安全） */
function scratches(ctx, size, count, rnd, opts = {}) {
  const len = opts.len === undefined ? size * 0.3 : opts.len;
  const width = opts.width === undefined ? 1 : opts.width;
  const color = opts.color || 'rgba(255,255,255,0.10)';
  const angle = opts.angle;
  const spread = opts.spread === undefined ? Math.PI * 2 : opts.spread;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const a = angle === undefined ? rnd() * Math.PI * 2 : angle + (rnd() - 0.5) * spread;
    const l = len * (0.25 + rnd() * 1.1);
    ctx.lineWidth = width * (0.5 + rnd());
    ctx.globalAlpha = 0.4 + rnd() * 0.6;
    for (let ix = -1; ix <= 1; ix++) {
      for (let iy = -1; iy <= 1; iy++) {
        ctx.beginPath();
        ctx.moveTo(x + ix * size, y + iy * size);
        ctx.lineTo(x + ix * size + Math.cos(a) * l, y + iy * size + Math.sin(a) * l);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** 平铺安全的柔和斑点（污渍、石子、苔藓等） */
function blobsTileable(ctx, size, count, rnd, opts = {}) {
  const rMin = opts.rMin === undefined ? size * 0.02 : opts.rMin;
  const rMax = opts.rMax === undefined ? size * 0.08 : opts.rMax;
  const col = opts.color || [0, 0, 0];
  const alpha = opts.alpha === undefined ? 0.12 : opts.alpha;
  const hard = !!opts.hard;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = lerp(rMin, rMax, rnd() * rnd());
    const a = alpha * (0.4 + rnd() * 0.8);
    const c = opts.vary ? scaleCol(col, 0.8 + rnd() * 0.4) : col;
    // 注意：形状参数必须在 tileDraw 之外算好，否则对侧重复绘制的副本会不一致 -> 接缝
    const ry = r * (0.6 + rnd() * 0.6);
    const rot = rnd() * Math.PI;
    tileDraw(ctx, size, x, y, r + 2, (dx, dy) => {
      if (hard) {
        ctx.fillStyle = rgba(c[0], c[1], c[2], a);
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      } else {
        radial(ctx, x + dx, y + dy, 0, r, [
          [0, rgba(c[0], c[1], c[2], a)],
          [1, rgba(c[0], c[1], c[2], 0)],
        ]);
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    });
  }
  ctx.restore();
}

/** 在已绘制内容上乘一层环绕噪声（给砖块/石块加斑驳，不破坏几何形状） */
function modulateNoise(ctx, size, rnd, amount, freq = 8, oct = 4) {
  const field = fbmField(rnd, freq, oct);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = 1 + (field.at(x / size, y / size) - 0.5) * 2 * amount;
      const i = (y * size + x) * 4;
      d[i] = clampByte(d[i] * k);
      d[i + 1] = clampByte(d[i + 1] * k);
      d[i + 2] = clampByte(d[i + 2] * k);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** 生成一条随机游走折线（裂纹/木纹用），返回点数组 */
function walkPath(rnd, x, y, steps, step, angle, wander) {
  const pts = [[x, y]];
  let a = angle;
  let cx = x;
  let cy = y;
  for (let i = 0; i < steps; i++) {
    a += (rnd() - 0.5) * wander;
    cx += Math.cos(a) * step;
    cy += Math.sin(a) * step;
    pts.push([cx, cy]);
  }
  return pts;
}

/** 平铺安全地描一条折线：同一路径在 9 个偏移上各画一遍 */
function tileStrokePath(ctx, size, pts, color, width, alpha = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = alpha;
  for (let ix = -1; ix <= 1; ix++) {
    for (let iy = -1; iy <= 1; iy++) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] + ix * size, pts[0][1] + iy * size);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + ix * size, pts[i][1] + iy * size);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 平铺安全地填充一条闭合折线（不规则石块用） */
function tileFillPath(ctx, size, pts, style) {
  ctx.save();
  ctx.fillStyle = style;
  for (let ix = -1; ix <= 1; ix++) {
    for (let iy = -1; iy <= 1; iy++) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] + ix * size, pts[0][1] + iy * size);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + ix * size, pts[i][1] + iy * size);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** 生成一个边线带抖动的“不规则矩形”多边形顶点 */
function irregularRect(rnd, x, y, w, h, jit) {
  const pts = [];
  const push = (px, py) => pts.push([px + (rnd() - 0.5) * jit, py + (rnd() - 0.5) * jit]);
  const nx = 3;
  const ny = 2;
  for (let i = 0; i < nx; i++) push(x + (w * i) / nx, y);
  for (let i = 0; i < ny; i++) push(x + w, y + (h * i) / ny);
  for (let i = nx; i > 0; i--) push(x + (w * i) / nx, y + h);
  for (let i = ny; i > 0; i--) push(x, y + (h * i) / ny);
  return pts;
}

/** 织物纹理：经纬线交替，天然平铺 */
function weave(ctx, size, rnd, opts) {
  const step = opts.step || Math.max(3, Math.round(size / 42));
  const light = opts.light || 'rgba(255,255,255,0.16)';
  const dark = opts.dark || 'rgba(0,0,0,0.16)';
  ctx.save();
  ctx.lineWidth = Math.max(1, step * 0.45);
  for (let i = 0; i * step < size; i++) {
    const p = i * step + step * 0.5;
    // 横线：偶数行亮、奇数行暗，形成交织感
    ctx.strokeStyle = i % 2 === 0 ? light : dark;
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
    ctx.strokeStyle = i % 2 === 0 ? dark : light;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
  }
  ctx.restore();
}

// ============================ 材质表 =======================================

/**
 * 材质定义：
 *   tex   贴图名
 *   tile  每米重复次数（1.0 = 贴图铺满 1m×1m）
 *   spec  高光强度 0..1
 *   gloss 高光指数 2..64
 *   tint  乘色 [r,g,b]
 *   alpha / translucent 仅玻璃类使用
 */
export const MATERIALS = {
  sand: { tex: 'sand', tile: 0.5, spec: 0.05, gloss: 6, tint: [1.0, 1.0, 1.0] },
  sandstone: { tex: 'sandstone', tile: 0.35, spec: 0.09, gloss: 10, tint: [1.0, 0.99, 0.95] },
  sandbrick: { tex: 'sandbrick', tile: 0.5, spec: 0.07, gloss: 8, tint: [1.0, 0.98, 0.94] },
  concrete: { tex: 'concrete', tile: 0.5, spec: 0.08, gloss: 10, tint: [1.0, 1.0, 1.0] },
  concrete_dark: { tex: 'concrete_dark', tile: 0.5, spec: 0.06, gloss: 8, tint: [0.9, 0.9, 0.94] },
  brick: { tex: 'brick', tile: 0.5, spec: 0.1, gloss: 12, tint: [1.0, 0.97, 0.95] },
  plaster: { tex: 'plaster', tile: 0.6, spec: 0.05, gloss: 6, tint: [1.0, 1.0, 0.98] },
  wood: { tex: 'wood', tile: 0.7, spec: 0.18, gloss: 20, tint: [1.0, 0.96, 0.9] },
  crate: { tex: 'crate', tile: 1.0, spec: 0.16, gloss: 16, tint: [1.0, 0.96, 0.9] },
  metal: { tex: 'metal', tile: 0.8, spec: 0.55, gloss: 40, tint: [0.98, 0.99, 1.0] },
  metal_plate: { tex: 'metal_plate', tile: 0.5, spec: 0.5, gloss: 34, tint: [0.97, 0.98, 1.0] },
  tile: { tex: 'tile', tile: 0.8, spec: 0.45, gloss: 48, tint: [1.0, 1.0, 1.0] },
  dirt: { tex: 'dirt', tile: 0.5, spec: 0.03, gloss: 4, tint: [1.0, 0.98, 0.94] },
  gravel: { tex: 'gravel', tile: 0.6, spec: 0.07, gloss: 8, tint: [1.0, 1.0, 1.0] },
  grass: { tex: 'grass', tile: 0.8, spec: 0.05, gloss: 6, tint: [0.98, 1.0, 0.95] },
  roof_tile: { tex: 'roof_tile', tile: 0.6, spec: 0.15, gloss: 14, tint: [1.0, 0.96, 0.94] },
  stone: { tex: 'stone', tile: 0.35, spec: 0.1, gloss: 10, tint: [1.0, 1.0, 1.0] },
  glass: {
    tex: 'glass', tile: 1.0, spec: 0.9, gloss: 64, tint: [0.9, 0.97, 1.0],
    alpha: 0.28, translucent: true,
  },
  rubber: { tex: 'rubber', tile: 1.0, spec: 0.12, gloss: 8, tint: [1.0, 1.0, 1.0] },
  canvas: { tex: 'canvas', tile: 1.0, spec: 0.08, gloss: 8, tint: [1.0, 0.99, 0.94] },
  sandbag: { tex: 'sandbag', tile: 0.5, spec: 0.06, gloss: 6, tint: [1.0, 0.98, 0.92] },
  cloth: { tex: 'cloth', tile: 1.0, spec: 0.1, gloss: 10, tint: [1.0, 1.0, 1.0] },
};

/** makeTexture 支持的全部名字（= MATERIALS 的贴图 + skybox + radar_grid） */
export const TEXTURE_NAMES = [
  'sand', 'sandstone', 'sandbrick', 'concrete', 'concrete_dark', 'brick', 'plaster',
  'wood', 'crate', 'metal', 'metal_plate', 'tile', 'dirt', 'gravel', 'grass',
  'roof_tile', 'stone', 'glass', 'rubber', 'canvas', 'sandbag', 'cloth',
  'skybox', 'radar_grid',
];

/** makeSprite 支持的全部名字 */
export const SPRITE_NAMES = [
  'flash', 'smoke', 'spark', 'blood', 'hole', 'glow', 'ring', 'dust', 'fire',
  'crosshair_dot',
  'bullet_decal_metal', 'bullet_decal_wood', 'bullet_decal_glass', 'bullet_decal_dirt',
];

// 缓存：同 name + size 只生成一次
const texCache = new Map();
const spriteCache = new Map();

// ============================ 贴图实现 =====================================

/** 沙地：细沙颗粒 + 被噪声扭曲的风纹 + 零散小石子 */
function texSand(ctx, size, rnd) {
  const field = fbmField(rnd, 4, 5);
  const warpField = fbmField(rnd, 2, 3);
  const fineNz = valueNoise(rnd, 64);
  fillPixels(ctx, size, (x, y, out) => {
    const u = x / size;
    const v = y / size;
    const low = field.at(u, v);
    // 风纹：整数波数的正弦被低频噪声扭曲，保证左右上下无缝
    const warp = warpField.at(u, v);
    const ripple = Math.sin((v * 7 + warp * 1.4) * Math.PI * 2) * 0.5 + 0.5;
    const fine = fineNz.at(u * 64, v * 64);
    const k = 0.88 + (low - 0.5) * 0.24 + ripple * 0.06 + (fine - 0.5) * 0.07;
    out[0] = 200 * k;
    out[1] = 180 * k;
    out[2] = 138 * k * 0.99;
  });
  // 深色湿沙斑 + 亮色浮沙
  blobsTileable(ctx, size, 26, rnd, {
    color: [150, 130, 95], alpha: 0.1, rMin: size * 0.02, rMax: size * 0.09,
  });
  blobsTileable(ctx, size, 20, rnd, {
    color: [232, 216, 180], alpha: 0.1, rMin: size * 0.02, rMax: size * 0.08,
  });
  // 小石子（硬边小点）
  blobsTileable(ctx, size, 70, rnd, {
    color: [120, 106, 80], alpha: 0.45, hard: true, vary: true,
    rMin: size * 0.004, rMax: size * 0.012,
  });
}

/** 砂岩：大石板 + 水平沉积层 + 边角崩口 */
function texSandstone(ctx, size, rnd) {
  bricks(ctx, size, 3, 2, {
    rnd, color: [203, 184, 144], mortar: '#948468', jitter: 0.06, gap: size * 0.018,
  });
  // 沉积层理：细密的横向色带
  ctx.save();
  for (let i = 0; i < 40; i++) {
    const y = rnd() * size;
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,246,224,0.10)' : 'rgba(120,100,70,0.10)';
    tileRect(ctx, size, 0, y, size, Math.max(1, size * (0.002 + rnd() * 0.008)));
  }
  ctx.restore();
  // 崩口与凹坑
  blobsTileable(ctx, size, 24, rnd, {
    color: [130, 112, 84], alpha: 0.22, hard: true, vary: true,
    rMin: size * 0.008, rMax: size * 0.03,
  });
  modulateNoise(ctx, size, rnd, 0.1, 6, 5);
}

/** 错缝小砂砖：横向 10 排、每排 5 块，缝隙偏亮 */
function texSandbrick(ctx, size, rnd) {
  bricks(ctx, size, 10, 5, {
    rnd, color: [199, 175, 132], mortar: '#b3a488', jitter: 0.11, gap: Math.max(2, size * 0.012),
  });
  // 少数砖块颜色明显偏差（旧砖/替换砖）
  const bh = size / 10;
  const bw = size / 5;
  for (let i = 0; i < 12; i++) {
    const r = Math.floor(rnd() * 10);
    const c = Math.floor(rnd() * 6) - 1;
    const x = c * bw + (r % 2) * bw * 0.5 + 1;
    const y = r * bh + 1;
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,96,66,0.22)' : 'rgba(255,244,214,0.18)';
    tileRect(ctx, size, x, y, bw - 2, bh - 2);
  }
  modulateNoise(ctx, size, rnd, 0.09, 8, 4);
  // 墙面渗出的雨痕
  scratches(ctx, size, 14, rnd, {
    angle: Math.PI / 2, spread: 0.06, len: size * 0.6, width: size * 0.012,
    color: 'rgba(110,94,68,0.10)',
  });
}

/** 混凝土：斑驳灰面 + 模板拼缝 + 细裂纹 + 砂眼 */
function texConcrete(ctx, size, rnd) {
  mottle(ctx, size, rnd, [143, 143, 138], 0.1, 4, 6);
  // 大片污渍
  blobsTileable(ctx, size, 30, rnd, {
    color: [104, 104, 102], alpha: 0.1, rMin: size * 0.03, rMax: size * 0.14,
  });
  blobsTileable(ctx, size, 18, rnd, {
    color: [190, 190, 186], alpha: 0.08, rMin: size * 0.03, rMax: size * 0.12,
  });
  // 浇筑模板拼缝（一横一纵）
  ctx.fillStyle = 'rgba(90,90,88,0.35)';
  tileRect(ctx, size, 0, size * 0.5 - 1, size, 2);
  tileRect(ctx, size, size * 0.34 - 1, 0, 2, size);
  ctx.fillStyle = 'rgba(215,215,210,0.18)';
  tileRect(ctx, size, 0, size * 0.5 + 1, size, 1);
  // 细裂纹
  for (let i = 0; i < 5; i++) {
    const pts = walkPath(rnd, rnd() * size, rnd() * size, 14, size * 0.05, rnd() * 6.28, 0.9);
    tileStrokePath(ctx, size, pts, 'rgba(70,70,68,0.5)', 1, 0.8);
  }
  // 砂眼气孔
  blobsTileable(ctx, size, 120, rnd, {
    color: [86, 86, 84], alpha: 0.35, hard: true, rMin: size * 0.003, rMax: size * 0.009,
  });
}

/** 深色混凝土：更暗、更多水渍与霉斑 */
function texConcreteDark(ctx, size, rnd) {
  mottle(ctx, size, rnd, [104, 104, 102], 0.13, 4, 6);
  // 自上而下的水渍条带
  ctx.save();
  for (let i = 0; i < 22; i++) {
    const x = rnd() * size;
    const w = size * (0.01 + rnd() * 0.05);
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(58,58,58,0.16)' : 'rgba(150,150,148,0.08)';
    tileRect(ctx, size, x, 0, w, size);
  }
  ctx.restore();
  blobsTileable(ctx, size, 34, rnd, {
    color: [56, 58, 56], alpha: 0.16, rMin: size * 0.03, rMax: size * 0.13,
  });
  // 霉斑（偏绿）
  blobsTileable(ctx, size, 16, rnd, {
    color: [72, 84, 62], alpha: 0.14, rMin: size * 0.02, rMax: size * 0.09,
  });
  // 裂纹
  for (let i = 0; i < 6; i++) {
    const pts = walkPath(rnd, rnd() * size, rnd() * size, 16, size * 0.05, rnd() * 6.28, 1.0);
    tileStrokePath(ctx, size, pts, 'rgba(38,38,38,0.55)', 1.2, 0.9);
  }
  blobsTileable(ctx, size, 110, rnd, {
    color: [64, 64, 62], alpha: 0.3, hard: true, rMin: size * 0.003, rMax: size * 0.009,
  });
}

/** 红砖墙：标准错缝砌法 + 砖面磨损 + 灰浆溢出 */
function texBrick(ctx, size, rnd) {
  bricks(ctx, size, 8, 4, {
    rnd, color: [154, 90, 70], mortar: '#9c968a', jitter: 0.13, gap: Math.max(2, size * 0.016),
  });
  const bh = size / 8;
  const bw = size / 4;
  // 个别砖块偏色（烧过火 / 新砖）
  for (let i = 0; i < 14; i++) {
    const r = Math.floor(rnd() * 8);
    const c = Math.floor(rnd() * 5) - 1;
    const x = c * bw + (r % 2) * bw * 0.5 + 1.5;
    const y = r * bh + 1.5;
    const t = rnd();
    ctx.fillStyle = t < 0.4 ? 'rgba(80,44,36,0.3)'
      : t < 0.75 ? 'rgba(196,126,96,0.24)' : 'rgba(120,110,100,0.2)';
    tileRect(ctx, size, x, y, bw - 3, bh - 3);
  }
  // 砖面磨损缺口
  blobsTileable(ctx, size, 40, rnd, {
    color: [112, 66, 52], alpha: 0.26, hard: true, vary: true,
    rMin: size * 0.005, rMax: size * 0.018,
  });
  modulateNoise(ctx, size, rnd, 0.11, 8, 4);
}

/** 灰泥墙：细腻抹面 + 抹刀弧痕 + 剥落露底 */
function texPlaster(ctx, size, rnd) {
  mottle(ctx, size, rnd, [201, 194, 174], 0.07, 4, 6);
  // 抹刀弧痕：一段段圆弧描边
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = size * (0.1 + rnd() * 0.3);
    const a0 = rnd() * 6.28;
    const a1 = a0 + 0.5 + rnd() * 1.2;
    ctx.lineWidth = size * (0.004 + rnd() * 0.012);
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(255,252,240,0.14)' : 'rgba(160,152,134,0.12)';
    for (let ix = -1; ix <= 1; ix++) {
      for (let iy = -1; iy <= 1; iy++) {
        ctx.beginPath();
        ctx.arc(x + ix * size, y + iy * size, r, a0, a1);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  // 剥落处露出灰底
  blobsTileable(ctx, size, 18, rnd, {
    color: [150, 142, 126], alpha: 0.3, hard: true, vary: true,
    rMin: size * 0.008, rMax: size * 0.035,
  });
  blobsTileable(ctx, size, 22, rnd, {
    color: [176, 170, 152], alpha: 0.1, rMin: size * 0.03, rMax: size * 0.12,
  });
}

/** 木板：横向长条木板 + 拉长木纹 + 木节 + 板缝 */
function texWood(ctx, size, rnd) {
  const planks = 4;
  const tone = [];
  const off = [];
  for (let i = 0; i < planks; i++) {
    tone.push(0.88 + rnd() * 0.26);
    off.push(rnd() * 10);
  }
  // 沿 x 方向拉伸的噪声场：横向低频、纵向高频 -> 长条纹
  const grainField = fbmField(rnd, 2, 4);
  const bandNz = valueNoise(rnd, 64);
  fillPixels(ctx, size, (x, y, out) => {
    const u = x / size;
    const v = y / size;
    const p = Math.min(planks - 1, Math.floor(v * planks));
    // 木纹：低频扰动 + 纵向密集年轮
    const g = grainField.at(u, v * 0.25 + p * 0.13);
    const rings = Math.sin((v * 26 + g * 5 + off[p]) * Math.PI) * 0.5 + 0.5;
    const band = bandNz.at(u * 8, v * 64);
    const k = tone[p] * (0.9 + (g - 0.5) * 0.14 + rings * 0.13 + (band - 0.5) * 0.08);
    out[0] = 150 * k;
    out[1] = 108 * k;
    out[2] = 66 * k * 0.98;
  });
  // 板缝（每块木板之间的暗线 + 下侧高光）
  const ph = size / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = 'rgba(52,32,16,0.75)';
    tileRect(ctx, size, 0, i * ph - Math.max(1, size * 0.006), size, Math.max(1.5, size * 0.012));
    ctx.fillStyle = 'rgba(255,226,180,0.1)';
    tileRect(ctx, size, 0, i * ph + Math.max(1, size * 0.008), size, Math.max(1, size * 0.006));
  }
  // 木节
  for (let i = 0; i < 5; i++) {
    const x = rnd() * size;
    const y = (Math.floor(rnd() * planks) + 0.3 + rnd() * 0.4) * ph;
    const r = size * (0.012 + rnd() * 0.022);
    tileDraw(ctx, size, x, y, r * 2.4, (dx, dy) => {
      radial(ctx, x + dx, y + dy, 0, r * 2.2, [
        [0, 'rgba(64,40,18,0.9)'],
        [0.45, 'rgba(96,62,30,0.55)'],
        [1, 'rgba(120,84,44,0)'],
      ]);
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, r * 2.2, r * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // 顺纹划痕
  scratches(ctx, size, 40, rnd, {
    angle: 0, spread: 0.05, len: size * 0.5, width: 1,
    color: 'rgba(70,44,20,0.22)',
  });
}

/** 木箱正面：外框木板 + 中间斜撑 + 钉子（不要求平铺） */
function texCrate(ctx, size, rnd) {
  // 底板：竖向木条
  const grainField = fbmField(rnd, 2, 4);
  const bandNz = valueNoise(rnd, 64);
  fillPixels(ctx, size, (x, y, out) => {
    const u = x / size;
    const v = y / size;
    const g = grainField.at(u * 0.3, v);
    const rings = Math.sin((u * 30 + g * 5) * Math.PI) * 0.5 + 0.5;
    const band = bandNz.at(u * 64, v * 8);
    const k = 0.9 + (g - 0.5) * 0.14 + rings * 0.12 + (band - 0.5) * 0.08;
    out[0] = 158 * k;
    out[1] = 116 * k;
    out[2] = 70 * k;
  });
  const b = size * 0.1; // 边框宽度
  // 斜撑（两条对角木板）
  ctx.save();
  ctx.strokeStyle = 'rgba(120,84,46,0.95)';
  ctx.lineWidth = b * 0.85;
  ctx.beginPath();
  ctx.moveTo(b * 0.6, b * 0.6);
  ctx.lineTo(size - b * 0.6, size - b * 0.6);
  ctx.moveTo(size - b * 0.6, b * 0.6);
  ctx.lineTo(b * 0.6, size - b * 0.6);
  ctx.stroke();
  // 斜撑高光
  ctx.strokeStyle = 'rgba(214,168,110,0.25)';
  ctx.lineWidth = b * 0.18;
  ctx.beginPath();
  ctx.moveTo(b * 0.6, b * 0.6 - b * 0.25);
  ctx.lineTo(size - b * 0.6, size - b * 0.6 - b * 0.25);
  ctx.stroke();
  ctx.restore();
  // 外框四条木板
  ctx.save();
  ctx.fillStyle = 'rgba(140,98,54,0.96)';
  ctx.fillRect(0, 0, size, b);
  ctx.fillRect(0, size - b, size, b);
  ctx.fillRect(0, 0, b, size);
  ctx.fillRect(size - b, 0, b, size);
  // 木板边缘的明暗，突出厚度
  ctx.fillStyle = 'rgba(255,224,176,0.16)';
  ctx.fillRect(0, 0, size, b * 0.16);
  ctx.fillRect(0, size - b, size, b * 0.16);
  ctx.fillStyle = 'rgba(48,28,12,0.5)';
  ctx.fillRect(0, b - b * 0.16, size, b * 0.16);
  ctx.fillRect(0, size - b * 0.16, size, b * 0.16);
  ctx.fillRect(b - b * 0.16, 0, b * 0.16, size);
  ctx.fillRect(size - b * 0.16, 0, b * 0.16, size);
  ctx.restore();
  // 钉子：四角与边框中点
  const nails = [
    [b * 0.5, b * 0.5], [size - b * 0.5, b * 0.5],
    [b * 0.5, size - b * 0.5], [size - b * 0.5, size - b * 0.5],
    [size * 0.5, b * 0.5], [size * 0.5, size - b * 0.5],
    [b * 0.5, size * 0.5], [size - b * 0.5, size * 0.5],
  ];
  const nr = size * 0.016;
  for (const [nx, ny] of nails) {
    radial(ctx, nx - nr * 0.3, ny - nr * 0.3, 0, nr * 1.6, [
      [0, 'rgba(228,228,232,0.95)'],
      [0.55, 'rgba(120,124,128,0.9)'],
      [1, 'rgba(40,40,44,0.5)'],
    ]);
    ctx.beginPath();
    ctx.arc(nx, ny, nr, 0, Math.PI * 2);
    ctx.fill();
  }
  // 磨损与污渍
  blobsTileable(ctx, size, 30, rnd, {
    color: [90, 60, 30], alpha: 0.12, rMin: size * 0.02, rMax: size * 0.08,
  });
  scratches(ctx, size, 30, rnd, {
    len: size * 0.2, width: 1, color: 'rgba(70,44,20,0.25)',
  });
}

/** 金属：横向拉丝 + 长划痕 + 轻微污迹 */
function texMetal(ctx, size, rnd) {
  const brushNz = valueNoise(rnd, 128);
  const blotchField = fbmField(rnd, 4, 4);
  fillPixels(ctx, size, (x, y, out) => {
    const u = x / size;
    const v = y / size;
    // 横向拉丝：x 方向低频、y 方向极高频
    const brush = brushNz.at(u * 8, v * 128);
    const blotch = blotchField.at(u, v);
    const k = 0.94 + (brush - 0.5) * 0.16 + (blotch - 0.5) * 0.1;
    out[0] = 138 * k;
    out[1] = 141 * k;
    out[2] = 146 * k;
  });
  // 亮/暗划痕
  scratches(ctx, size, 90, rnd, {
    angle: 0, spread: 0.04, len: size * 0.8, width: 1, color: 'rgba(255,255,255,0.1)',
  });
  scratches(ctx, size, 40, rnd, {
    angle: 0, spread: 0.06, len: size * 0.5, width: 1, color: 'rgba(60,62,66,0.22)',
  });
  scratches(ctx, size, 14, rnd, {
    len: size * 0.25, width: 1.4, color: 'rgba(240,244,250,0.16)',
  });
  // 锈渍/油污
  blobsTileable(ctx, size, 16, rnd, {
    color: [112, 84, 58], alpha: 0.1, rMin: size * 0.02, rMax: size * 0.1,
  });
}

/** 铆钉花纹钢板：菱形防滑纹 + 四角铆钉 */
function texMetalPlate(ctx, size, rnd) {
  mottle(ctx, size, rnd, [124, 128, 132], 0.07, 4, 4);
  const cells = 4;
  const cs = size / cells;
  // 菱形防滑凸纹（每格两条相反斜纹）
  ctx.save();
  ctx.lineCap = 'butt';
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const ox = cx * cs;
      const oy = cy * cs;
      const dir = (cx + cy) % 2 === 0 ? 1 : -1;
      for (let s = 0; s < 2; s++) {
        const px = ox + cs * (0.22 + s * 0.42);
        const py = oy + cs * 0.2;
        const len = cs * 0.6;
        // 亮面
        ctx.strokeStyle = 'rgba(226,230,236,0.4)';
        ctx.lineWidth = Math.max(2, cs * 0.1);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + dir * len * 0.7, py + len);
        ctx.stroke();
        // 暗面（下移一点做出立体感）
        ctx.strokeStyle = 'rgba(48,52,56,0.45)';
        ctx.lineWidth = Math.max(1.5, cs * 0.06);
        ctx.beginPath();
        ctx.moveTo(px + dir * cs * 0.03, py + cs * 0.06);
        ctx.lineTo(px + dir * (len * 0.7 + cs * 0.03), py + len + cs * 0.06);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  // 铆钉：网格交点
  const rr = size * 0.02;
  for (let iy = 0; iy <= cells; iy++) {
    for (let ix = 0; ix <= cells; ix++) {
      const x = ix * cs;
      const y = iy * cs;
      tileDraw(ctx, size, x, y, rr * 2, (dx, dy) => {
        radial(ctx, x + dx - rr * 0.35, y + dy - rr * 0.35, 0, rr * 1.7, [
          [0, 'rgba(232,236,242,0.95)'],
          [0.5, 'rgba(132,138,144,0.9)'],
          [1, 'rgba(36,38,42,0.55)'],
        ]);
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, rr, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  scratches(ctx, size, 30, rnd, {
    len: size * 0.2, width: 1, color: 'rgba(230,236,244,0.12)',
  });
  blobsTileable(ctx, size, 14, rnd, {
    color: [110, 78, 52], alpha: 0.12, rMin: size * 0.02, rMax: size * 0.08,
  });
}

/** 瓷砖：4×4 方格 + 深色勾缝 + 每块独立高光 */
function texTile(ctx, size, rnd) {
  const cells = 4;
  const cs = size / cells;
  const gap = Math.max(2, size * 0.014);
  ctx.fillStyle = '#77746c';
  ctx.fillRect(0, 0, size, size);
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const x = cx * cs + gap * 0.5;
      const y = cy * cs + gap * 0.5;
      const w = cs - gap;
      const h = cs - gap;
      const k = 1 + (rnd() - 0.5) * 0.1;
      ctx.fillStyle = rgb(198 * k, 200 * k, 196 * k);
      ctx.fillRect(x, y, w, h);
      // 斜向高光条（釉面反光）
      linear(ctx, x, y, x + w, y + h, [
        [0, 'rgba(255,255,255,0.22)'],
        [0.45, 'rgba(255,255,255,0.05)'],
        [0.55, 'rgba(255,255,255,0.14)'],
        [1, 'rgba(180,182,180,0.12)'],
      ]);
      ctx.fillRect(x, y, w, h);
      // 边缘倒角
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, y, w, Math.max(1, h * 0.05));
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(x, y + h - Math.max(1, h * 0.06), w, Math.max(1, h * 0.06));
    }
  }
  // 少量破损与污渍
  blobsTileable(ctx, size, 40, rnd, {
    color: [140, 140, 136], alpha: 0.1, rMin: size * 0.004, rMax: size * 0.02,
  });
  blobsTileable(ctx, size, 10, rnd, {
    color: [120, 116, 104], alpha: 0.08, rMin: size * 0.03, rMax: size * 0.1,
  });
}

/** 泥土：湿暗斑块 + 干裂纹 + 小石子与草屑 */
function texDirt(ctx, size, rnd) {
  mottle(ctx, size, rnd, [116, 92, 64], 0.18, 4, 6);
  // 深浅土块
  blobsTileable(ctx, size, 34, rnd, {
    color: [74, 56, 36], alpha: 0.18, rMin: size * 0.03, rMax: size * 0.14,
  });
  blobsTileable(ctx, size, 24, rnd, {
    color: [162, 134, 96], alpha: 0.14, rMin: size * 0.02, rMax: size * 0.1,
  });
  // 干裂纹（分叉）
  for (let i = 0; i < 9; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const a = rnd() * 6.28;
    tileStrokePath(ctx, size, walkPath(rnd, x, y, 12, size * 0.05, a, 1.1),
      'rgba(52,38,24,0.5)', 1.4, 0.85);
    tileStrokePath(ctx, size, walkPath(rnd, x, y, 7, size * 0.045, a + 2.2, 1.1),
      'rgba(52,38,24,0.4)', 1.1, 0.8);
  }
  // 石子 + 草屑
  blobsTileable(ctx, size, 130, rnd, {
    color: [138, 124, 104], alpha: 0.4, hard: true, vary: true,
    rMin: size * 0.004, rMax: size * 0.014,
  });
  scratches(ctx, size, 30, rnd, {
    len: size * 0.035, width: 1.2, color: 'rgba(120,124,72,0.35)',
  });
}

/** 碎石：密排硬边石粒 + 每颗独立明暗 */
function texGravel(ctx, size, rnd) {
  mottle(ctx, size, rnd, [104, 100, 92], 0.14, 8, 5);
  // 三层大小不同的石子，从大到小铺满
  const layers = [
    { n: 90, rMin: size * 0.022, rMax: size * 0.05 },
    { n: 170, rMin: size * 0.012, rMax: size * 0.026 },
    { n: 260, rMin: size * 0.005, rMax: size * 0.013 },
  ];
  for (const L of layers) {
    for (let i = 0; i < L.n; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = lerp(L.rMin, L.rMax, rnd());
      const rot = rnd() * Math.PI;
      const g = 0.7 + rnd() * 0.6;
      const ry = r * (0.62 + rnd() * 0.5);
      const base = [140 * g, 136 * g, 124 * g];
      tileDraw(ctx, size, x, y, r * 1.6, (dx, dy) => {
        // 石子本体
        ctx.fillStyle = rgb(base[0], base[1], base[2]);
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, ry, rot, 0, Math.PI * 2);
        ctx.fill();
        // 左上高光 / 右下阴影
        ctx.fillStyle = rgba(base[0] * 1.35, base[1] * 1.35, base[2] * 1.3, 0.5);
        ctx.beginPath();
        ctx.ellipse(x + dx - r * 0.25, y + dy - r * 0.28, r * 0.5, r * 0.34, rot, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(24,22,18,0.3)';
        ctx.beginPath();
        ctx.ellipse(x + dx + r * 0.3, y + dy + r * 0.34, r * 0.55, r * 0.34, rot, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  modulateNoise(ctx, size, rnd, 0.1, 4, 4);
}

/** 草地：深浅草簇 + 细密草叶 + 露土 */
function texGrass(ctx, size, rnd) {
  mottle(ctx, size, rnd, [88, 108, 60], 0.2, 4, 5);
  // 草簇色块
  blobsTileable(ctx, size, 40, rnd, {
    color: [62, 84, 42], alpha: 0.2, rMin: size * 0.02, rMax: size * 0.1,
  });
  blobsTileable(ctx, size, 30, rnd, {
    color: [136, 154, 82], alpha: 0.16, rMin: size * 0.02, rMax: size * 0.08,
  });
  // 露出的泥土
  blobsTileable(ctx, size, 14, rnd, {
    color: [120, 96, 62], alpha: 0.18, rMin: size * 0.015, rMax: size * 0.05,
  });
  // 草叶：三种色调，方向偏竖直
  const blade = (count, color, len, w) => {
    scratches(ctx, size, count, rnd, {
      angle: -Math.PI / 2, spread: 1.5, len, width: w, color,
    });
  };
  blade(420, 'rgba(58,76,38,0.5)', size * 0.05, 1.2);
  blade(360, 'rgba(126,150,78,0.45)', size * 0.045, 1.1);
  blade(200, 'rgba(176,190,110,0.35)', size * 0.04, 1);
}

/** 屋顶瓦：横向瓦垄 + 每垄圆弧明暗 + 苔痕 */
function texRoofTile(ctx, size, rnd) {
  const rows = 6;
  const rh = size / rows;
  ctx.fillStyle = '#6b3d2c';
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const k = 0.9 + rnd() * 0.22;
    // 瓦垄本体：上暗下亮的圆柱状渐变
    linear(ctx, 0, y, 0, y + rh, [
      [0, rgba(96 * k, 54 * k, 40 * k, 1)],
      [0.22, rgba(178 * k, 106 * k, 78 * k, 1)],
      [0.55, rgba(148 * k, 88 * k, 64 * k, 1)],
      [0.86, rgba(104 * k, 60 * k, 42 * k, 1)],
      [1, rgba(64 * k, 36 * k, 26 * k, 1)],
    ]);
    tileRect(ctx, size, 0, y, size, rh);
    // 垄脊高光
    ctx.fillStyle = 'rgba(255,214,180,0.16)';
    tileRect(ctx, size, 0, y + rh * 0.2, size, Math.max(1, rh * 0.06));
    // 垄间投影
    ctx.fillStyle = 'rgba(28,14,10,0.45)';
    tileRect(ctx, size, 0, y - Math.max(1, rh * 0.04), size, Math.max(1.5, rh * 0.08));
    // 竖向瓦片接缝
    const seams = 4;
    for (let s = 0; s < seams; s++) {
      const x = ((s + (r % 2) * 0.5) / seams) * size;
      ctx.fillStyle = 'rgba(48,26,18,0.35)';
      tileRect(ctx, size, x, y + rh * 0.12, Math.max(1, size * 0.006), rh * 0.82);
    }
  }
  // 苔藓与褪色
  blobsTileable(ctx, size, 26, rnd, {
    color: [86, 96, 58], alpha: 0.16, rMin: size * 0.015, rMax: size * 0.06,
  });
  modulateNoise(ctx, size, rnd, 0.09, 8, 4);
}

/** 不规则大石块：错落砌石 + 每块独立色调与凿痕 */
function texStone(ctx, size, rnd) {
  // 底：深色砂浆缝
  ctx.fillStyle = '#5c584f';
  ctx.fillRect(0, 0, size, size);
  const rows = 3;
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 2 + (rnd() < 0.5 ? 0 : 1); // 每排 2~3 块，宽窄不一
    const bw = size / cols;
    const shift = rnd() * bw;
    for (let c = -1; c <= cols; c++) {
      const pad = size * 0.014;
      const x = c * bw + shift + pad;
      const y = r * rh + pad;
      const w = bw - pad * 2;
      const h = rh - pad * 2;
      const jit = size * 0.03;
      const pts = irregularRect(rnd, x, y, w, h, jit);
      const g = 0.82 + rnd() * 0.34;
      // 石块本体
      tileFillPath(ctx, size, pts, rgb(140 * g, 137 * g, 128 * g));
      // 上沿受光 / 下沿背光
      const top = irregularRect(rnd, x, y, w, h * 0.22, jit * 0.6);
      tileFillPath(ctx, size, top, 'rgba(255,255,250,0.1)');
      const bot = irregularRect(rnd, x, y + h * 0.78, w, h * 0.22, jit * 0.6);
      tileFillPath(ctx, size, bot, 'rgba(24,22,18,0.18)');
      // 凿痕
      tileStrokePath(ctx, size,
        walkPath(rnd, x + w * 0.2, y + h * 0.5, 6, w * 0.12, rnd() * 6.28, 0.9),
        'rgba(70,66,60,0.35)', 1.2, 0.7);
    }
  }
  // 表面斑驳、坑洞与苔痕
  modulateNoise(ctx, size, rnd, 0.12, 8, 5);
  blobsTileable(ctx, size, 60, rnd, {
    color: [88, 84, 76], alpha: 0.22, hard: true, vary: true,
    rMin: size * 0.004, rMax: size * 0.014,
  });
  blobsTileable(ctx, size, 14, rnd, {
    color: [92, 100, 72], alpha: 0.12, rMin: size * 0.02, rMax: size * 0.07,
  });
}

/** 玻璃：淡蓝底 + 污痕手印 + 斜向高光条 */
function texGlass(ctx, size, rnd) {
  mottle(ctx, size, rnd, [150, 176, 190], 0.05, 4, 4);
  // 斜向高光条（反射天光）
  ctx.save();
  linear(ctx, 0, size, size, 0, [
    [0, 'rgba(255,255,255,0)'],
    [0.34, 'rgba(255,255,255,0.16)'],
    [0.42, 'rgba(255,255,255,0.3)'],
    [0.5, 'rgba(255,255,255,0.1)'],
    [0.72, 'rgba(255,255,255,0.22)'],
    [0.8, 'rgba(255,255,255,0.05)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  // 灰尘污痕（边角更重）
  blobsTileable(ctx, size, 22, rnd, {
    color: [210, 214, 208], alpha: 0.12, rMin: size * 0.03, rMax: size * 0.14,
  });
  blobsTileable(ctx, size, 18, rnd, {
    color: [120, 130, 128], alpha: 0.08, rMin: size * 0.02, rMax: size * 0.1,
  });
  // 擦拭痕迹
  scratches(ctx, size, 22, rnd, {
    angle: Math.PI * 0.25, spread: 0.4, len: size * 0.4, width: size * 0.01,
    color: 'rgba(255,255,255,0.07)',
  });
  // 细小水点
  blobsTileable(ctx, size, 40, rnd, {
    color: [255, 255, 255], alpha: 0.16, hard: true,
    rMin: size * 0.002, rMax: size * 0.006,
  });
}

/** 橡胶：哑光深色 + 细颗粒 + 斜向防滑沟 */
function texRubber(ctx, size, rnd) {
  mottle(ctx, size, rnd, [56, 56, 58], 0.1, 8, 5);
  // 斜向防滑沟槽
  ctx.save();
  const grooves = 8;
  for (let i = 0; i < grooves; i++) {
    const x = (i / grooves) * size;
    ctx.strokeStyle = 'rgba(20,20,22,0.55)';
    ctx.lineWidth = size * 0.022;
    for (let ix = -1; ix <= 1; ix++) {
      ctx.beginPath();
      ctx.moveTo(x + ix * size, 0);
      ctx.lineTo(x + ix * size + size, size);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,120,124,0.1)';
    ctx.lineWidth = size * 0.008;
    for (let ix = -1; ix <= 1; ix++) {
      ctx.beginPath();
      ctx.moveTo(x + ix * size + size * 0.02, 0);
      ctx.lineTo(x + ix * size + size * 1.02, size);
      ctx.stroke();
    }
  }
  ctx.restore();
  // 橡胶颗粒
  blobsTileable(ctx, size, 220, rnd, {
    color: [86, 86, 90], alpha: 0.22, hard: true, vary: true,
    rMin: size * 0.003, rMax: size * 0.01,
  });
  blobsTileable(ctx, size, 60, rnd, {
    color: [16, 16, 18], alpha: 0.25, hard: true,
    rMin: size * 0.003, rMax: size * 0.009,
  });
}

/** 帆布：粗织纹 + 纤维毛刺 + 陈旧污渍 */
function texCanvas(ctx, size, rnd) {
  mottle(ctx, size, rnd, [166, 152, 118], 0.07, 4, 4);
  // 粗经纬织纹
  weave(ctx, size, rnd, {
    step: Math.max(4, Math.round(size / 32)),
    light: 'rgba(255,244,214,0.2)',
    dark: 'rgba(78,66,44,0.2)',
  });
  // 更细的第二层织纹，增加密度感
  weave(ctx, size, rnd, {
    step: Math.max(2, Math.round(size / 96)),
    light: 'rgba(255,255,255,0.05)',
    dark: 'rgba(60,50,34,0.06)',
  });
  // 纤维毛刺
  scratches(ctx, size, 90, rnd, {
    len: size * 0.03, width: 1, color: 'rgba(226,212,178,0.28)',
  });
  // 污渍与磨白
  blobsTileable(ctx, size, 18, rnd, {
    color: [110, 96, 68], alpha: 0.12, rMin: size * 0.03, rMax: size * 0.12,
  });
  blobsTileable(ctx, size, 12, rnd, {
    color: [222, 212, 184], alpha: 0.1, rMin: size * 0.02, rMax: size * 0.09,
  });
}

/** 沙袋堆：交错排列的圆鼓袋子 + 缝线 + 布纹 */
function texSandbag(ctx, size, rnd) {
  ctx.fillStyle = '#57492f';
  ctx.fillRect(0, 0, size, size);
  const rows = 4;
  const cols = 3;
  const bh = size / rows;
  const bw = size / cols;
  for (let r = 0; r < rows; r++) {
    const shift = (r % 2) * bw * 0.5;
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + shift + bw * 0.04;
      const y = r * bh + bh * 0.06;
      const w = bw * 0.92;
      const h = bh * 0.88;
      const g = 0.86 + rnd() * 0.3;
      const cx = x + w * 0.5;
      const cy = y + h * 0.5;
      tileDraw(ctx, size, cx, cy, Math.max(w, h) * 0.6, (dx, dy) => {
        // 袋体：圆角矩形（用椭圆近似鼓起的沙袋）
        radial(ctx, cx + dx - w * 0.12, cy + dy - h * 0.18, h * 0.1, Math.max(w, h) * 0.62, [
          [0, rgb(206 * g, 188 * g, 142 * g)],
          [0.55, rgb(168 * g, 152 * g, 112 * g)],
          [1, rgb(104 * g, 92 * g, 66 * g)],
        ]);
        ctx.beginPath();
        ctx.ellipse(cx + dx, cy + dy, w * 0.5, h * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        // 袋口缝线
        ctx.strokeStyle = 'rgba(88,74,48,0.6)';
        ctx.lineWidth = Math.max(1, size * 0.004);
        ctx.setLineDash([size * 0.012, size * 0.012]);
        ctx.beginPath();
        ctx.moveTo(cx + dx - w * 0.42, cy + dy - h * 0.1);
        ctx.lineTo(cx + dx + w * 0.42, cy + dy - h * 0.1);
        ctx.stroke();
        ctx.setLineDash([]);
        // 袋子轮廓阴影
        ctx.strokeStyle = 'rgba(48,38,22,0.45)';
        ctx.lineWidth = Math.max(1, size * 0.006);
        ctx.beginPath();
        ctx.ellipse(cx + dx, cy + dy, w * 0.5, h * 0.48, 0, 0, Math.PI * 2);
        ctx.stroke();
        // 褶皱
        ctx.strokeStyle = 'rgba(70,58,36,0.22)';
        ctx.lineWidth = Math.max(1, size * 0.004);
        for (let k = 0; k < 3; k++) {
          const a0 = 0.6 + k * 0.7;
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dy + h * 0.1, w * (0.16 + k * 0.12), a0, a0 + 1.1);
          ctx.stroke();
        }
      });
    }
  }
  // 麻布细纹与沙尘
  weave(ctx, size, rnd, {
    step: Math.max(3, Math.round(size / 64)),
    light: 'rgba(255,246,216,0.06)',
    dark: 'rgba(60,48,28,0.07)',
  });
  blobsTileable(ctx, size, 26, rnd, {
    color: [120, 104, 72], alpha: 0.12, rMin: size * 0.02, rMax: size * 0.07,
  });
}

/** 布料：细密织纹 + 柔和褶皱明暗 */
function texCloth(ctx, size, rnd) {
  mottle(ctx, size, rnd, [116, 112, 120], 0.09, 4, 5);
  // 褶皱：低频明暗带（斜向）
  const foldField = fbmField(rnd, 3, 3);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const f = foldField.at(u, v);
      // 4 个周期的斜向褶皱，整数波数保证平铺
      const fold = Math.sin(((u + v) * 4 + f * 1.6) * Math.PI * 2) * 0.5 + 0.5;
      const k = 0.9 + fold * 0.2;
      const i = (y * size + x) * 4;
      d[i] = clampByte(d[i] * k);
      d[i + 1] = clampByte(d[i + 1] * k);
      d[i + 2] = clampByte(d[i + 2] * k);
    }
  }
  ctx.putImageData(img, 0, 0);
  // 细密织纹（两层不同密度）
  weave(ctx, size, rnd, {
    step: Math.max(2, Math.round(size / 64)),
    light: 'rgba(255,255,255,0.1)',
    dark: 'rgba(0,0,0,0.1)',
  });
  weave(ctx, size, rnd, {
    step: Math.max(4, Math.round(size / 16)),
    light: 'rgba(255,255,255,0.04)',
    dark: 'rgba(0,0,0,0.05)',
  });
  // 起球与磨白
  blobsTileable(ctx, size, 40, rnd, {
    color: [176, 172, 180], alpha: 0.1, hard: true,
    rMin: size * 0.002, rMax: size * 0.007,
  });
}

/** 天空盒：竖直渐变 + 层云 + 太阳光晕（不要求平铺） */
function texSkybox(ctx, size, rnd) {
  // 天顶到地平线的渐变
  linear(ctx, 0, 0, 0, size, [
    [0, '#3f6ea8'],
    [0.35, '#6f9ac8'],
    [0.62, '#a9c6db'],
    [0.82, '#d6cfba'],
    [1, '#c9bda2'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 太阳光晕
  const sx = size * 0.7;
  const sy = size * 0.26;
  radial(ctx, sx, sy, 0, size * 0.42, [
    [0, 'rgba(255,250,232,0.95)'],
    [0.12, 'rgba(255,244,206,0.5)'],
    [0.4, 'rgba(255,236,196,0.16)'],
    [1, 'rgba(255,236,196,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 层云：多层柔和噪声云团，越靠地平线越扁平
  const cloudField = fbmField(rnd, 3, 5);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // 竖直方向压缩 -> 云层平铺感
      const n = cloudField.at(u, v * 0.55);
      // 只在中上部出云，且做阈值化让云有形状
      const band = clamp01((0.78 - v) / 0.55) * clamp01((v - 0.02) / 0.12);
      const a = clamp01((n - 0.52) * 3.2) * band;
      if (a <= 0.001) continue;
      const i = (y * size + x) * 4;
      // 云底略暗、云顶偏白
      const shade = 236 - (1 - clamp01(n * 1.2)) * 46;
      d[i] = clampByte(lerp(d[i], shade, a));
      d[i + 1] = clampByte(lerp(d[i + 1], shade, a));
      d[i + 2] = clampByte(lerp(d[i + 2], shade * 0.99, a));
    }
  }
  ctx.putImageData(img, 0, 0);
  // 地平线处的霾
  linear(ctx, 0, size * 0.72, 0, size, [
    [0, 'rgba(226,216,192,0)'],
    [1, 'rgba(226,216,192,0.55)'],
  ]);
  ctx.fillRect(0, size * 0.72, size, size * 0.28);
}

/** 雷达网格：带 alpha 的深色底 + 荧光绿网格（不要求平铺） */
function texRadarGrid(ctx, size, rnd) {
  ctx.clearRect(0, 0, size, size);
  // 半透明深底，中心稍亮
  radial(ctx, size * 0.5, size * 0.5, 0, size * 0.72, [
    [0, 'rgba(16,30,24,0.5)'],
    [1, 'rgba(6,12,10,0.66)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  // 细网格
  const cells = 16;
  const step = size / cells;
  ctx.strokeStyle = 'rgba(96,190,140,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= cells; i++) {
    const p = Math.round(i * step) + 0.5;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
  }
  ctx.stroke();
  // 粗网格（每 4 格一条）
  ctx.strokeStyle = 'rgba(120,220,160,0.3)';
  ctx.lineWidth = Math.max(1, size * 0.006);
  ctx.beginPath();
  for (let i = 0; i <= cells; i += 4) {
    const p = Math.round(i * step) + 0.5;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
  }
  ctx.stroke();
  // 中心十字与圆环
  ctx.strokeStyle = 'rgba(160,240,190,0.4)';
  ctx.lineWidth = Math.max(1, size * 0.008);
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.06);
  ctx.lineTo(size * 0.5, size * 0.94);
  ctx.moveTo(size * 0.06, size * 0.5);
  ctx.lineTo(size * 0.94, size * 0.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(140,230,180,0.22)';
  ctx.lineWidth = Math.max(1, size * 0.005);
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.5, size * 0.14 * i, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 扫描线（横向细纹）
  ctx.fillStyle = 'rgba(140,230,180,0.05)';
  for (let y = 0; y < size; y += 3) ctx.fillRect(0, y, size, 1);
  ctx.restore();
}

// ============================ 精灵实现 =====================================

/** 画一个半径带抖动的不规则闭合斑块（飞溅、坑洞用） */
function splatPath(ctx, cx, cy, r, jag, rnd, n = 18) {
  const rs = [];
  for (let i = 0; i < n; i++) rs.push(r * (1 - jag * rnd()));
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // 相邻半径做一次平滑，避免过于尖锐
    const rr = (rs[i] * 2 + rs[(i + 1) % n] + rs[(i + n - 1) % n]) * 0.25;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 枪口火焰：中心白核 + 星形放射尖刺 */
function sprFlash(ctx, size, rnd) {
  const c = size / 2;
  // 外层暖色柔光
  radial(ctx, c, c, 0, size * 0.46, [
    [0, 'rgba(255,226,150,0.55)'],
    [0.45, 'rgba(255,180,80,0.22)'],
    [1, 'rgba(255,130,30,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 放射尖刺（长短交替）
  const spikes = 11;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + rnd() * 0.16;
    const len = size * (i % 2 === 0 ? 0.3 + rnd() * 0.16 : 0.16 + rnd() * 0.1);
    const w = size * (0.022 + rnd() * 0.035);
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(a);
    linear(ctx, 0, 0, len, 0, [
      [0, 'rgba(255,252,232,0.95)'],
      [0.35, 'rgba(255,214,120,0.6)'],
      [1, 'rgba(255,140,40,0)'],
    ]);
    ctx.beginPath();
    ctx.moveTo(0, -w);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, w);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // 中心炽白核心
  radial(ctx, c, c, 0, size * 0.14, [
    [0, 'rgba(255,255,255,1)'],
    [0.45, 'rgba(255,246,214,0.9)'],
    [1, 'rgba(255,200,110,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

/** 烟团：多层絮状白烟叠加 */
function sprSmoke(ctx, size, rnd) {
  const c = size / 2;
  // 底层大团
  radial(ctx, c, c, 0, size * 0.44, [
    [0, 'rgba(228,228,226,0.5)'],
    [0.55, 'rgba(214,214,212,0.3)'],
    [1, 'rgba(200,200,198,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 絮状小团（沿中心散布，越外越淡）
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = size * 0.3 * Math.sqrt(rnd());
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d;
    const r = size * (0.08 + rnd() * 0.14);
    const t = 1 - d / (size * 0.32);
    const g = 200 + rnd() * 46;
    radial(ctx, x, y, 0, r, [
      [0, rgba(g, g, g * 0.99, 0.3 * t + 0.06)],
      [0.6, rgba(g * 0.9, g * 0.9, g * 0.89, 0.12 * t)],
      [1, rgba(g * 0.8, g * 0.8, g * 0.8, 0)],
    ]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 少量暗部，让烟有体积
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2;
    const d = size * 0.24 * Math.sqrt(rnd());
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d + size * 0.05;
    const r = size * (0.07 + rnd() * 0.1);
    radial(ctx, x, y, 0, r, [
      [0, 'rgba(120,120,122,0.12)'],
      [1, 'rgba(120,120,122,0)'],
    ]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** 火花：白心橙边的小亮点 + 十字光芒 */
function sprSpark(ctx, size, rnd) {
  const c = size / 2;
  // 橙色外晕
  radial(ctx, c, c, 0, size * 0.3, [
    [0, 'rgba(255,190,90,0.55)'],
    [0.5, 'rgba(255,140,40,0.22)'],
    [1, 'rgba(255,110,20,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 十字光芒
  ctx.save();
  ctx.translate(c, c);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    const len = size * (0.22 + rnd() * 0.14);
    linear(ctx, 0, 0, len, 0, [
      [0, 'rgba(255,240,200,0.8)'],
      [1, 'rgba(255,150,50,0)'],
    ]);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.014);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, size * 0.014);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // 白炽核心
  radial(ctx, c, c, 0, size * 0.11, [
    [0, 'rgba(255,255,255,1)'],
    [0.4, 'rgba(255,244,206,0.9)'],
    [1, 'rgba(255,170,60,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

/** 血迹：暗红飞溅主斑 + 放射液滴与拖尾 */
function sprBlood(ctx, size, rnd) {
  const c = size / 2;
  // 外围晕染
  radial(ctx, c, c, 0, size * 0.4, [
    [0, 'rgba(96,8,8,0.4)'],
    [0.6, 'rgba(78,6,6,0.18)'],
    [1, 'rgba(70,4,4,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 主飞溅斑（不规则）
  ctx.fillStyle = 'rgba(112,10,10,0.92)';
  splatPath(ctx, c, c, size * 0.2, 0.5, rnd, 20);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,18,16,0.55)';
  splatPath(ctx, c - size * 0.02, c - size * 0.02, size * 0.13, 0.45, rnd, 16);
  ctx.fill();
  // 放射液滴 + 拖尾
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const d = size * (0.16 + rnd() * 0.24);
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d;
    const r = size * (0.008 + rnd() * 0.032);
    // 拖尾（朝外的细线）
    ctx.strokeStyle = 'rgba(104,8,8,0.5)';
    ctx.lineWidth = r * 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * d * 0.55, c + Math.sin(a) * d * 0.55);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,12,12,0.9)' : 'rgba(88,6,6,0.85)';
    splatPath(ctx, x, y, r, 0.35, rnd, 10);
    ctx.fill();
  }
  // 高光（湿润感）
  radial(ctx, c - size * 0.06, c - size * 0.07, 0, size * 0.06, [
    [0, 'rgba(220,90,80,0.22)'],
    [1, 'rgba(220,90,80,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

/** 弹孔：黑心 + 灰色碎裂环 + 放射细裂纹 */
function sprHole(ctx, size, rnd) {
  const c = size / 2;
  // 外圈灰尘晕
  radial(ctx, c, c, 0, size * 0.42, [
    [0, 'rgba(96,92,88,0.35)'],
    [0.55, 'rgba(86,82,78,0.16)'],
    [1, 'rgba(80,76,72,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 放射细裂纹
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
    const len = size * (0.14 + rnd() * 0.24);
    ctx.strokeStyle = 'rgba(48,46,44,0.55)';
    ctx.lineWidth = Math.max(1, size * (0.004 + rnd() * 0.008));
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * size * 0.05, c + Math.sin(a) * size * 0.05);
    let x = c + Math.cos(a) * len;
    let y = c + Math.sin(a) * len;
    ctx.lineTo(x, y);
    ctx.stroke();
    // 少量分叉
    if (rnd() < 0.4) {
      const a2 = a + (rnd() - 0.5) * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a2) * size * 0.06, y + Math.sin(a2) * size * 0.06);
      ctx.stroke();
    }
  }
  // 碎裂环（灰白破口）
  ctx.fillStyle = 'rgba(166,162,156,0.5)';
  splatPath(ctx, c, c, size * 0.17, 0.42, rnd, 22);
  ctx.fill();
  ctx.fillStyle = 'rgba(112,108,102,0.55)';
  splatPath(ctx, c, c, size * 0.13, 0.35, rnd, 18);
  ctx.fill();
  // 黑色孔心
  ctx.fillStyle = 'rgba(10,9,8,0.95)';
  splatPath(ctx, c, c, size * 0.085, 0.28, rnd, 14);
  ctx.fill();
  radial(ctx, c, c, 0, size * 0.1, [
    [0, 'rgba(0,0,0,0.95)'],
    [0.7, 'rgba(14,12,10,0.7)'],
    [1, 'rgba(20,18,16,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 下沿一点高光，模拟凹陷边缘受光
  radial(ctx, c, c + size * 0.11, 0, size * 0.07, [
    [0, 'rgba(226,222,214,0.2)'],
    [1, 'rgba(226,222,214,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

/** 纯径向柔光 */
function sprGlow(ctx, size, rnd) {
  const c = size / 2;
  radial(ctx, c, c, 0, size * 0.5, [
    [0, 'rgba(255,255,255,0.95)'],
    [0.18, 'rgba(255,255,255,0.6)'],
    [0.42, 'rgba(255,255,255,0.22)'],
    [0.7, 'rgba(255,255,255,0.06)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

/** 细圆环：边缘内外都柔和衰减 */
function sprRing(ctx, size, rnd) {
  const c = size / 2;
  const r = size * 0.38;
  const w = Math.max(1.5, size * 0.03);
  // 用径向渐变做出「环」：只有 r 附近有 alpha
  const inner = (r - w) / (size * 0.5);
  const outer = (r + w) / (size * 0.5);
  const mid = r / (size * 0.5);
  radial(ctx, c, c, 0, size * 0.5, [
    [0, 'rgba(255,255,255,0)'],
    [Math.max(0, inner - 0.06), 'rgba(255,255,255,0)'],
    [inner, 'rgba(255,255,255,0.28)'],
    [mid, 'rgba(255,255,255,0.95)'],
    [outer, 'rgba(255,255,255,0.28)'],
    [Math.min(1, outer + 0.06), 'rgba(255,255,255,0)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

/** 尘云：淡黄灰色蓬松尘团 */
function sprDust(ctx, size, rnd) {
  const c = size / 2;
  radial(ctx, c, c, 0, size * 0.45, [
    [0, 'rgba(198,184,154,0.34)'],
    [0.6, 'rgba(186,172,144,0.16)'],
    [1, 'rgba(180,166,138,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 蓬松团块
  for (let i = 0; i < 20; i++) {
    const a = rnd() * Math.PI * 2;
    const d = size * 0.28 * Math.sqrt(rnd());
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d;
    const r = size * (0.07 + rnd() * 0.13);
    const t = 1 - d / (size * 0.3);
    const g = 190 + rnd() * 40;
    radial(ctx, x, y, 0, r, [
      [0, rgba(g, g * 0.93, g * 0.78, 0.2 * t + 0.04)],
      [1, rgba(g * 0.9, g * 0.84, g * 0.7, 0)],
    ]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 悬浮颗粒
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const d = size * 0.34 * Math.sqrt(rnd());
    const r = size * (0.003 + rnd() * 0.006);
    ctx.fillStyle = rgba(210, 198, 168, 0.18 + rnd() * 0.2);
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 火舌：底部橙红、向上收窄的火焰 */
function sprFire(ctx, size, rnd) {
  const c = size / 2;
  // 整体暖光
  radial(ctx, c, c + size * 0.08, 0, size * 0.42, [
    [0, 'rgba(255,170,60,0.5)'],
    [0.5, 'rgba(230,90,20,0.22)'],
    [1, 'rgba(180,40,10,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 多条火舌：从底部向上的水滴形
  const tongues = 7;
  for (let i = 0; i < tongues; i++) {
    const t = i / (tongues - 1);
    const x = c + (t - 0.5) * size * 0.34 + (rnd() - 0.5) * size * 0.04;
    const bottom = c + size * 0.3 - rnd() * size * 0.04;
    const h = size * (0.3 + rnd() * 0.24);
    const w = size * (0.05 + rnd() * 0.05);
    const top = bottom - h;
    const g = ctx.createLinearGradient(0, bottom, 0, top);
    g.addColorStop(0, 'rgba(255,120,20,0.55)');
    g.addColorStop(0.35, 'rgba(255,180,60,0.7)');
    g.addColorStop(0.75, 'rgba(255,230,150,0.45)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.bezierCurveTo(x + w, top + h * 0.35, x + w * 1.1, bottom - h * 0.1, x, bottom);
    ctx.bezierCurveTo(x - w * 1.1, bottom - h * 0.1, x - w, top + h * 0.35, x, top);
    ctx.closePath();
    ctx.fill();
  }
  // 焰心（白黄）
  radial(ctx, c, c + size * 0.14, 0, size * 0.16, [
    [0, 'rgba(255,250,220,0.9)'],
    [0.5, 'rgba(255,214,120,0.5)'],
    [1, 'rgba(255,160,50,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 飞散的火星
  for (let i = 0; i < 16; i++) {
    const x = c + (rnd() - 0.5) * size * 0.5;
    const y = c - size * (0.05 + rnd() * 0.32);
    const r = size * (0.004 + rnd() * 0.01);
    radial(ctx, x, y, 0, r * 3, [
      [0, 'rgba(255,240,190,0.8)'],
      [1, 'rgba(255,140,40,0)'],
    ]);
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
}

/** 准星圆点：小实心圆点，边缘 1px 柔化 */
function sprCrosshairDot(ctx, size, rnd) {
  const c = size / 2;
  const r = size * 0.14;
  radial(ctx, c, c, 0, r * 1.35, [
    [0, 'rgba(255,255,255,1)'],
    [0.7, 'rgba(255,255,255,1)'],
    [0.86, 'rgba(255,255,255,0.65)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

/** 金属弹痕：亮银凹坑 + 放射刮痕 */
function sprDecalMetal(ctx, size, rnd) {
  const c = size / 2;
  // 冲击晕（金属被擦亮）
  radial(ctx, c, c, 0, size * 0.4, [
    [0, 'rgba(214,220,228,0.4)'],
    [0.5, 'rgba(170,178,186,0.18)'],
    [1, 'rgba(150,158,166,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 放射刮痕（细长亮线）
  for (let i = 0; i < 24; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = size * (0.07 + rnd() * 0.05);
    const r1 = r0 + size * (0.06 + rnd() * 0.24);
    ctx.strokeStyle = rnd() < 0.6 ? 'rgba(238,244,250,0.45)' : 'rgba(96,102,108,0.4)';
    ctx.lineWidth = Math.max(1, size * (0.003 + rnd() * 0.006));
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    ctx.stroke();
  }
  // 翻边（受光的凸起金属唇）
  ctx.strokeStyle = 'rgba(246,250,255,0.55)';
  ctx.lineWidth = Math.max(1.5, size * 0.016);
  splatPath(ctx, c, c, size * 0.13, 0.3, rnd, 18);
  ctx.stroke();
  // 银亮凹坑
  radial(ctx, c - size * 0.02, c - size * 0.02, 0, size * 0.12, [
    [0, 'rgba(250,252,255,0.85)'],
    [0.45, 'rgba(176,182,190,0.75)'],
    [1, 'rgba(96,102,108,0.5)'],
  ]);
  splatPath(ctx, c, c, size * 0.11, 0.26, rnd, 16);
  ctx.fill();
  // 坑底暗心
  radial(ctx, c, c + size * 0.01, 0, size * 0.06, [
    [0, 'rgba(28,30,34,0.8)'],
    [1, 'rgba(48,52,56,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

/** 木质弹痕：褐色孔洞 + 顺纹木屑毛刺 */
function sprDecalWood(ctx, size, rnd) {
  const c = size / 2;
  // 周围颜色变深
  radial(ctx, c, c, 0, size * 0.4, [
    [0, 'rgba(92,60,30,0.4)'],
    [0.55, 'rgba(78,50,24,0.18)'],
    [1, 'rgba(70,44,20,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 木屑：沿水平木纹方向翘起的细刺
  for (let i = 0; i < 26; i++) {
    const a = (rnd() - 0.5) * 0.7 + (rnd() < 0.5 ? 0 : Math.PI);
    const r0 = size * (0.07 + rnd() * 0.04);
    const r1 = r0 + size * (0.05 + rnd() * 0.22);
    const w = Math.max(1, size * (0.004 + rnd() * 0.012));
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(196,150,96,0.55)' : 'rgba(70,42,18,0.6)';
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0 + (rnd() - 0.5) * size * 0.05);
    ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1 + (rnd() - 0.5) * size * 0.07);
    ctx.stroke();
  }
  // 破口（浅色新鲜木质）
  ctx.fillStyle = 'rgba(186,140,86,0.6)';
  splatPath(ctx, c, c, size * 0.15, 0.45, rnd, 20);
  ctx.fill();
  // 孔洞
  ctx.fillStyle = 'rgba(44,28,14,0.94)';
  splatPath(ctx, c, c, size * 0.09, 0.3, rnd, 14);
  ctx.fill();
  radial(ctx, c, c, 0, size * 0.1, [
    [0, 'rgba(20,12,6,0.95)'],
    [0.7, 'rgba(40,24,12,0.6)'],
    [1, 'rgba(52,32,16,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

/** 玻璃弹痕：白色蛛网裂纹 + 同心裂环 */
function sprDecalGlass(ctx, size, rnd) {
  const c = size / 2;
  // 极淡的白色雾面
  radial(ctx, c, c, 0, size * 0.42, [
    [0, 'rgba(255,255,255,0.28)'],
    [0.5, 'rgba(240,248,255,0.12)'],
    [1, 'rgba(230,244,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 辐射主裂纹
  const spokes = 14;
  const angs = [];
  for (let i = 0; i < spokes; i++) angs.push((i / spokes) * Math.PI * 2 + (rnd() - 0.5) * 0.24);
  ctx.lineCap = 'round';
  for (let i = 0; i < spokes; i++) {
    const a = angs[i];
    const len = size * (0.2 + rnd() * 0.24);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, size * (0.004 + rnd() * 0.006));
    // 折线让裂纹更自然
    let px = c + Math.cos(a) * size * 0.04;
    let py = c + Math.sin(a) * size * 0.04;
    ctx.beginPath();
    ctx.moveTo(px, py);
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      const rr = size * 0.04 + (len - size * 0.04) * (s / steps);
      const aa = a + (rnd() - 0.5) * 0.16;
      px = c + Math.cos(aa) * rr;
      py = c + Math.sin(aa) * rr;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // 同心裂环（连接相邻辐射线）
  for (let ring = 1; ring <= 3; ring++) {
    const rr = size * (0.08 + ring * 0.09);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.42 - ring * 0.08).toFixed(2) + ')';
    ctx.lineWidth = Math.max(1, size * 0.0035);
    ctx.beginPath();
    for (let i = 0; i <= spokes; i++) {
      const a = angs[i % spokes] + (i === spokes ? Math.PI * 2 : 0);
      const jr = rr * (0.86 + rnd() * 0.28);
      const x = c + Math.cos(a) * jr;
      const y = c + Math.sin(a) * jr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // 中心粉碎白斑
  radial(ctx, c, c, 0, size * 0.09, [
    [0, 'rgba(255,255,255,0.95)'],
    [0.5, 'rgba(255,255,255,0.6)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 碎屑小点
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = size * (0.06 + rnd() * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + rnd() * 0.5).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, size * (0.002 + rnd() * 0.006), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 土地弹痕：土黄坑洞 + 向外溅出的颗粒 */
function sprDecalDirt(ctx, size, rnd) {
  const c = size / 2;
  // 溅开的浮土
  radial(ctx, c, c, 0, size * 0.42, [
    [0, 'rgba(152,126,84,0.42)'],
    [0.5, 'rgba(134,110,74,0.2)'],
    [1, 'rgba(120,98,64,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  // 抛出的土块（越远越小越淡）
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2;
    const t = Math.sqrt(rnd());
    const d = size * (0.12 + t * 0.3);
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d;
    const r = size * (0.004 + (1 - t) * 0.018 * rnd());
    const g = 0.8 + rnd() * 0.5;
    ctx.fillStyle = rgba(140 * g, 116 * g, 78 * g, 0.35 + (1 - t) * 0.5);
    splatPath(ctx, x, y, r, 0.4, rnd, 8);
    ctx.fill();
  }
  // 坑沿（受光的堆土）
  ctx.fillStyle = 'rgba(176,148,102,0.55)';
  splatPath(ctx, c, c - size * 0.01, size * 0.17, 0.4, rnd, 20);
  ctx.fill();
  // 坑体
  ctx.fillStyle = 'rgba(96,76,48,0.85)';
  splatPath(ctx, c, c, size * 0.12, 0.35, rnd, 18);
  ctx.fill();
  // 坑心阴影
  radial(ctx, c, c, 0, size * 0.1, [
    [0, 'rgba(48,36,20,0.9)'],
    [0.65, 'rgba(66,50,30,0.55)'],
    [1, 'rgba(80,62,38,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
}

// ============================ 对外接口 =====================================

/**
 * 生成（并缓存）一张不透明、可无缝平铺的贴图。
 * radar_grid 带 alpha，crate / skybox / radar_grid 不要求平铺。
 * @param {string} name 贴图名，见 TEXTURE_NAMES
 * @param {number} size 边长像素
 * @returns {HTMLCanvasElement}
 */
export function makeTexture(name, size = 256) {
  const key = name + '@' + size;
  const cached = texCache.get(key);
  if (cached) return cached;
  const cv = newCanvas(size, size);
  const ctx = cv.getContext('2d');
  const rnd = mulberry32(hashStr('tex:' + name));
  const alphaTex = name === 'radar_grid';
  if (!alphaTex) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
  }
  switch (name) {
    case 'sand': texSand(ctx, size, rnd); break;
    case 'sandstone': texSandstone(ctx, size, rnd); break;
    case 'sandbrick': texSandbrick(ctx, size, rnd); break;
    case 'concrete': texConcrete(ctx, size, rnd); break;
    case 'concrete_dark': texConcreteDark(ctx, size, rnd); break;
    case 'brick': texBrick(ctx, size, rnd); break;
    case 'plaster': texPlaster(ctx, size, rnd); break;
    case 'wood': texWood(ctx, size, rnd); break;
    case 'crate': texCrate(ctx, size, rnd); break;
    case 'metal': texMetal(ctx, size, rnd); break;
    case 'metal_plate': texMetalPlate(ctx, size, rnd); break;
    case 'tile': texTile(ctx, size, rnd); break;
    case 'dirt': texDirt(ctx, size, rnd); break;
    case 'gravel': texGravel(ctx, size, rnd); break;
    case 'grass': texGrass(ctx, size, rnd); break;
    case 'roof_tile': texRoofTile(ctx, size, rnd); break;
    case 'stone': texStone(ctx, size, rnd); break;
    case 'glass': texGlass(ctx, size, rnd); break;
    case 'rubber': texRubber(ctx, size, rnd); break;
    case 'canvas': texCanvas(ctx, size, rnd); break;
    case 'sandbag': texSandbag(ctx, size, rnd); break;
    case 'cloth': texCloth(ctx, size, rnd); break;
    case 'skybox': texSkybox(ctx, size, rnd); break;
    case 'radar_grid': texRadarGrid(ctx, size, rnd); break;
    default: throw new Error('makeTexture: 未知贴图名 "' + name + '"');
  }
  // 统一叠一层很淡的颗粒噪声
  if (!alphaTex) grain(ctx, size, 10, rnd);
  texCache.set(key, cv);
  return cv;
}

/**
 * 生成（并缓存）一张 RGBA 精灵：居中、背景全透明、边缘 alpha 平滑衰减到 0。
 * @param {string} name 精灵名，见 SPRITE_NAMES
 * @param {number} size 边长像素
 * @returns {HTMLCanvasElement}
 */
export function makeSprite(name, size = 128) {
  const key = name + '@' + size;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const cv = newCanvas(size, size);
  const ctx = cv.getContext('2d');
  const rnd = mulberry32(hashStr('sprite:' + name));
  ctx.clearRect(0, 0, size, size);
  switch (name) {
    case 'flash': sprFlash(ctx, size, rnd); break;
    case 'smoke': sprSmoke(ctx, size, rnd); break;
    case 'spark': sprSpark(ctx, size, rnd); break;
    case 'blood': sprBlood(ctx, size, rnd); break;
    case 'hole': sprHole(ctx, size, rnd); break;
    case 'glow': sprGlow(ctx, size, rnd); break;
    case 'ring': sprRing(ctx, size, rnd); break;
    case 'dust': sprDust(ctx, size, rnd); break;
    case 'fire': sprFire(ctx, size, rnd); break;
    case 'crosshair_dot': sprCrosshairDot(ctx, size, rnd); break;
    case 'bullet_decal_metal': sprDecalMetal(ctx, size, rnd); break;
    case 'bullet_decal_wood': sprDecalWood(ctx, size, rnd); break;
    case 'bullet_decal_glass': sprDecalGlass(ctx, size, rnd); break;
    case 'bullet_decal_dirt': sprDecalDirt(ctx, size, rnd); break;
    default: throw new Error('makeSprite: 未知精灵名 "' + name + '"');
  }
  // 保证四边完全透明，避免精灵采样时出现硬边
  fadeEdges(ctx, size);
  spriteCache.set(key, cv);
  return cv;
}

/** 让精灵最外圈 alpha 衰减到 0 */
function fadeEdges(ctx, size) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const c = (size - 1) / 2;
  const rMax = size * 0.5;
  const inner = rMax * 0.86;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r <= inner) continue;
      const t = clamp01((rMax - r) / (rMax - inner));
      const i = (y * size + x) * 4;
      d[i + 3] = clampByte(d[i + 3] * smooth(t));
    }
  }
  ctx.putImageData(img, 0, 0);
}
