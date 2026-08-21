// ============================================================================
//  pixels.js —— 零依赖像素绘制内核
//  · 一切材质/精灵都画进裸 RGBA 缓冲（Uint8ClampedArray）
//  · 因此同一套美术代码可以在浏览器（putImageData）和 Node（编码 PNG）里跑
//  · 所有随机都走可复现的 seed，保证预览图 == 游戏内画面
// ============================================================================

/** 解析颜色：'#rgb' / '#rrggbb' / [r,g,b] / [r,g,b,a] → [r,g,b,a] */
export function rgba(c, alpha) {
  let out;
  if (Array.isArray(c)) {
    out = [c[0] | 0, c[1] | 0, c[2] | 0, c.length > 3 ? c[3] : 255];
  } else if (typeof c === 'number') {
    out = [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255];
  } else {
    let s = String(c).trim();
    if (s[0] === '#') s = s.slice(1);
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    out = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  if (alpha !== undefined) out[3] = Math.round(alpha * 255);
  return out;
}

export function mix(a, b, t) {
  const A = rgba(a), B = rgba(b);
  return [
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t,
    A[3] + (B[3] - A[3]) * t,
  ];
}

export function scaleColor(c, k) {
  const A = rgba(c);
  return [A[0] * k, A[1] * k, A[2] * k, A[3]];
}

/** 可复现随机数（xorshift32） */
export function makeRng(seed) {
  let s = (seed | 0) || 0x9e3779b9;
  return function rng() {
    s ^= s << 13; s |= 0;
    s ^= s >>> 17;
    s ^= s << 5; s |= 0;
    return ((s >>> 0) % 0x7fffffff) / 0x7fffffff;
  };
}

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** 平铺（在 period 上取模，所以贴图无缝）值噪声 */
export function valueNoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const w = (t) => t * t * (3 - 2 * t);
  const m = (v) => ((v % period) + period) % period;
  const a = hash2(m(xi), m(yi), seed);
  const b = hash2(m(xi + 1), m(yi), seed);
  const c = hash2(m(xi), m(yi + 1), seed);
  const d = hash2(m(xi + 1), m(yi + 1), seed);
  const u = w(xf), v = w(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x, y, period, seed, octaves = 4) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * f, y * f, period * f, seed + i * 7919) * amp;
    norm += amp;
    amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
//  自带 3×5 微型字模（数字 + 大写字母），Node 与浏览器都能用
// ---------------------------------------------------------------------------
const TINY = {
  '0': '111101101101111', '1': '010010010010010', '2': '111001111100111',
  '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001001001001', '8': '111101111101111',
  '9': '111101111001111', '.': '000000000000010', '-': '000000111000000',
  ':': '000010000010000', '/': '001001010100100', ' ': '000000000000000',
  'A': '111101111101101', 'B': '111101110101111', 'C': '111100100100111',
  'D': '110101101101110', 'E': '111100111100111', 'F': '111100111100100',
  'G': '111100101101111', 'H': '101101111101101', 'I': '111010010010111',
  'J': '001001001101111', 'K': '101101110101101', 'L': '100100100100111',
  'M': '101111111101101', 'N': '110101101101101', 'O': '111101101101111',
  'P': '111101111100100', 'Q': '111101101111001', 'R': '111101110101101',
  'S': '111100111001111', 'T': '111010010010010', 'U': '101101101101111',
  'V': '101101101101010', 'W': '101101111111101', 'X': '101101010101101',
  'Y': '101101010010010', 'Z': '111001010100111',
};

// 浏览器可注入真汉字渲染器（离屏 canvas + fillText）；Node 下回落成抽象字块
let glyphRenderer = null;
export function setGlyphRenderer(fn) { glyphRenderer = fn; }
export function hasGlyphRenderer() { return !!glyphRenderer; }

// ---------------------------------------------------------------------------
//  Pix —— 像素画布
// ---------------------------------------------------------------------------
export class Pix {
  constructor(w, h, data) {
    this.w = w; this.h = h;
    this.data = data || new Uint8ClampedArray(w * h * 4);
  }

  clone() { return new Pix(this.w, this.h, this.data.slice()); }

  idx(x, y) { return (y * this.w + x) * 4; }

  /** 硬写像素（越界忽略） */
  put(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const C = rgba(c), i = this.idx(x, y), d = this.data;
    d[i] = C[0]; d[i + 1] = C[1]; d[i + 2] = C[2]; d[i + 3] = C[3];
    return this;
  }

  /** alpha 混合写像素 */
  blend(x, y, c, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const C = rgba(c);
    const al = a * (C[3] / 255);
    if (al <= 0) return this;
    const i = this.idx(x, y), d = this.data;
    d[i] += (C[0] - d[i]) * al;
    d[i + 1] += (C[1] - d[i + 1]) * al;
    d[i + 2] += (C[2] - d[i + 2]) * al;
    d[i + 3] = Math.max(d[i + 3], C[3] * al);
    return this;
  }

  get(x, y) {
    x = Math.max(0, Math.min(this.w - 1, x | 0));
    y = Math.max(0, Math.min(this.h - 1, y | 0));
    const i = this.idx(x, y), d = this.data;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }

  fill(c) {
    const C = rgba(c), d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = C[0]; d[i + 1] = C[1]; d[i + 2] = C[2]; d[i + 3] = C[3];
    }
    return this;
  }

  clear() { this.data.fill(0); return this; }

  rect(x, y, w, h, c, a = 1) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x | 0) + (w | 0)), y1 = Math.min(this.h, (y | 0) + (h | 0));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.blend(xx, yy, c, a);
    return this;
  }

  frame(x, y, w, h, c, t = 1, a = 1) {
    this.rect(x, y, w, t, c, a);
    this.rect(x, y + h - t, w, t, c, a);
    this.rect(x, y, t, h, c, a);
    this.rect(x + w - t, y, t, h, c, a);
    return this;
  }

  hline(x, y, w, c, a = 1) { return this.rect(x, y, w, 1, c, a); }
  vline(x, y, h, c, a = 1) { return this.rect(x, y, 1, h, c, a); }

  line(x0, y0, x1, y1, c, a = 1) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      this.blend(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  /** 实心椭圆 */
  disc(cx, cy, rx, ry, c, a = 1) {
    ry = ry === undefined ? rx : ry;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.blend(x, y, c, a);
      }
    }
    return this;
  }

  ring(cx, cy, rx, ry, c, a = 1) {
    ry = ry === undefined ? rx : ry;
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) {
      for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d <= 1.12 && d >= 0.68) this.blend(x, y, c, a);
      }
    }
    return this;
  }

  /** 垂直渐变 */
  vgrad(x, y, w, h, c0, c1, a = 1) {
    for (let yy = 0; yy < h; yy++) {
      const t = h <= 1 ? 0 : yy / (h - 1);
      this.rect(x, y + yy, w, 1, mix(c0, c1, t), a);
    }
    return this;
  }

  /** 水平渐变 */
  hgrad(x, y, w, h, c0, c1, a = 1) {
    for (let xx = 0; xx < w; xx++) {
      const t = w <= 1 ? 0 : xx / (w - 1);
      this.rect(x + xx, y, 1, h, mix(c0, c1, t), a);
    }
    return this;
  }

  /** 区域乘光（<1 变暗，>1 变亮） */
  shade(x, y, w, h, k) {
    const x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (let yy = Math.max(0, y); yy < y1; yy++) {
      for (let xx = Math.max(0, x); xx < x1; xx++) {
        const i = this.idx(xx, yy), d = this.data;
        d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
      }
    }
    return this;
  }

  /** 全图颗粒噪点（保留 alpha） */
  grain(amount, seed = 1) {
    const rng = makeRng(seed), d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const n = (rng() - 0.5) * 2 * amount;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    return this;
  }

  /** 颗粒斑点（水磨石、马赛克骨料等） */
  speckle(x, y, w, h, colors, density, seed = 2, size = 1) {
    const rng = makeRng(seed);
    const n = Math.round(w * h * density);
    for (let i = 0; i < n; i++) {
      const px = x + Math.floor(rng() * w), py = y + Math.floor(rng() * h);
      const c = colors[Math.floor(rng() * colors.length)];
      const s = size === 1 ? 1 : 1 + Math.floor(rng() * size);
      this.rect(px, py, s, s, c, 0.55 + rng() * 0.45);
    }
    return this;
  }

  /** 木纹（原木色板材 / 三合板） */
  wood(x, y, w, h, base, dark, seed = 3, horizontal = false, ringiness = 1) {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const u = horizontal ? yy : xx;
        const v = horizontal ? xx : yy;
        const warp = fbm(u * 0.09, v * 0.012, 64, seed, 3) * 6.5 * ringiness;
        const g = Math.sin((u + warp) * 0.85) * 0.5 + 0.5;
        const fine = fbm(u * 0.8, v * 0.18, 64, seed + 31, 2);
        let t = g * 0.55 + fine * 0.45;
        t = Math.pow(t, 1.6);
        this.put(x + xx, y + yy, mix(base, dark, t * 0.85));
      }
    }
    return this;
  }

  /** 大理石纹（千禧年大堂/电视柜贴面） */
  marble(x, y, w, h, base, vein, seed = 4, strength = 1) {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const n = fbm(xx * 0.055, yy * 0.055, 64, seed, 5);
        const s = Math.abs(Math.sin((xx * 0.13 + yy * 0.06 + n * 5.5) * 2.0));
        const t = Math.pow(1 - Math.min(1, s * 1.35), 3) * strength;
        const base2 = mix(base, scaleColor(base, 0.93), fbm(xx * 0.02, yy * 0.02, 64, seed + 5));
        this.put(x + xx, y + yy, mix(base2, vein, t));
      }
    }
    return this;
  }

  /** 瓷砖/马赛克网格 */
  tiles(x, y, w, h, cell, colors, grout, seed = 5, groutW = 1) {
    const rng = makeRng(seed);
    this.rect(x, y, w, h, grout);
    for (let ty = 0; ty < h; ty += cell) {
      for (let tx = 0; tx < w; tx += cell) {
        const c = colors[Math.floor(rng() * colors.length)];
        const k = 0.9 + rng() * 0.2;
        this.rect(x + tx + groutW, y + ty + groutW, cell - groutW, cell - groutW, scaleColor(c, k));
      }
    }
    return this;
  }

  /** 水渍 / 污迹（梦核灵魂） */
  stain(cx, cy, r, c, seed = 6, strength = 0.35) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = (x - cx) / r, dy = (y - cy) / r;
        const d = Math.sqrt(dx * dx + dy * dy);
        const wob = fbm(x * 0.11, y * 0.11, 64, seed, 3) * 0.6 + 0.7;
        const a = Math.max(0, 1 - d / wob);
        if (a > 0) this.blend(x, y, c, Math.pow(a, 1.7) * strength);
      }
    }
    return this;
  }

  /** 3×5 微型字（数字/字母），scale 放大 */
  tiny(x, y, str, c, scale = 1, a = 1) {
    let cx = x;
    for (const ch of String(str).toUpperCase()) {
      const g = TINY[ch];
      if (g) {
        for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) {
          if (g[r * 3 + k] === '1') this.rect(cx + k * scale, y + r * scale, scale, scale, c, a);
        }
      }
      cx += 4 * scale;
    }
    return this;
  }

  tinyWidth(str, scale = 1) { return String(str).length * 4 * scale - scale; }

  /**
   * 汉字/任意文本。浏览器里用真字体渲染；Node 里回落成"字块"剪影，
   * 保证离屏预览与线上构图一致（只是字看不清）。
   */
  text(x, y, str, c, opts = {}) {
    const size = opts.size || 10;
    const bold = opts.bold !== false;
    const vertical = !!opts.vertical;
    const spacing = opts.spacing || 0;
    const font = opts.font;
    if (glyphRenderer) {
      const g = glyphRenderer(String(str), { size, bold, vertical, spacing, font });
      if (g) {
        for (let yy = 0; yy < g.h; yy++) {
          for (let xx = 0; xx < g.w; xx++) {
            const av = g.alpha[yy * g.w + xx] / 255;
            if (av > 0.06) this.blend(x + xx, y + yy, c, av * (opts.alpha ?? 1));
          }
        }
        return this;
      }
    }
    // 回落：每字一个抽象笔画块
    const chars = [...String(str)];
    const rng = makeRng(opts.seed || 77);
    chars.forEach((ch, i) => {
      const bx = vertical ? x : x + i * (size + spacing);
      const by = vertical ? y + i * (size + spacing) : y;
      const strokes = 2 + Math.floor(rng() * 3);
      this.rect(bx + 1, by + 1, size - 2, 1, c, 0.9 * (opts.alpha ?? 1));
      this.rect(bx + 1, by + size - 2, size - 2, 1, c, 0.9 * (opts.alpha ?? 1));
      for (let s = 0; s < strokes; s++) {
        const yy = by + 2 + Math.floor(rng() * (size - 4));
        this.rect(bx + 1, yy, size - 2, 1, c, 0.75 * (opts.alpha ?? 1));
      }
      const vx = bx + 1 + Math.floor(rng() * (size - 3));
      this.rect(vx, by + 1, 1, size - 2, c, 0.8 * (opts.alpha ?? 1));
    });
    return this;
  }

  // -- 自发光遮罩：窗户/玻璃/灯管/电视屏幕不吃雾与黑暗 ------------------
  /** 标记矩形区域自发光强度 v∈[0,1] */
  glow(x, y, w, h, v) {
    if (!this.emit) this.emit = new Uint8Array(this.w * this.h);
    const val = Math.round(Math.max(0, Math.min(1, v)) * 255);
    const x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (let yy = Math.max(0, y); yy < y1; yy++) {
      for (let xx = Math.max(0, x); xx < x1; xx++) {
        const i = yy * this.w + xx;
        if (val > this.emit[i]) this.emit[i] = val;
      }
    }
    return this;
  }

  /** 整图统一自发光 */
  glowAll(v) { return this.glow(0, 0, this.w, this.h, v); }

  emitAt(x, y) {
    if (!this.emit) return 0;
    x = Math.max(0, Math.min(this.w - 1, x | 0));
    y = Math.max(0, Math.min(this.h - 1, y | 0));
    return this.emit[y * this.w + x];
  }

  /** 把另一张 Pix 贴上来（带 alpha） */
  drawPix(src, x, y, alpha = 1) {
    for (let yy = 0; yy < src.h; yy++) {
      for (let xx = 0; xx < src.w; xx++) {
        const i = src.idx(xx, yy), d = src.data;
        const a = d[i + 3] / 255;
        if (a <= 0.003) continue;
        this.blend(x + xx, y + yy, [d[i], d[i + 1], d[i + 2]], a * alpha);
      }
    }
    return this;
  }

  /** 上下/左右镜像的对称绘制辅助（画对称物件用） */
  mirrorX(x0, w) {
    for (let y = 0; y < this.h; y++) {
      for (let k = 0; k < Math.floor(w / 2); k++) {
        const src = this.get(x0 + k, y);
        this.put(x0 + w - 1 - k, y, src);
      }
    }
    return this;
  }
}

/** 便捷构造 */
export function pix(w, h) { return new Pix(w, h); }
