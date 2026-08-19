/* =====================================================================
 * TexturePainter — 16×16 像素画绘制工具
 * 所有方块贴图都在运行时由代码生成（无需任何图片资源）
 * ===================================================================== */
import { Rng, hashSeed } from '../math/Random.js';
import { clamp } from '../math/MathUtils.js';

export const TILE = 16;

/** 解析颜色：'#rgb' / '#rrggbb' / '#rrggbbaa' / [r,g,b,a] */
export function C(c) {
  if (Array.isArray(c)) return [c[0] | 0, c[1] | 0, c[2] | 0, c.length > 3 ? c[3] | 0 : 255];
  let h = String(c).replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

/** 颜色按系数变亮/变暗 */
export function shade(c, f) {
  const k = C(c);
  return [clamp(Math.round(k[0] * f), 0, 255), clamp(Math.round(k[1] * f), 0, 255), clamp(Math.round(k[2] * f), 0, 255), k[3]];
}

/** 两色混合 */
export function mixc(a, b, t) {
  const x = C(a), y = C(b);
  return [
    Math.round(x[0] + (y[0] - x[0]) * t),
    Math.round(x[1] + (y[1] - x[1]) * t),
    Math.round(x[2] + (y[2] - x[2]) * t),
    Math.round(x[3] + (y[3] - x[3]) * t),
  ];
}

export class Tile {
  constructor(size = TILE, seedName = 'tile') {
    this.size = size;
    this.data = new Uint8Array(size * size * 4);
    this.rng = new Rng(hashSeed(seedName) ^ 0x9e3779b9);
  }

  idx(x, y) { return ((y * this.size) + x) * 4; }

  inside(x, y) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }

  set(x, y, color) {
    if (!this.inside(x, y)) return this;
    const c = C(color), i = this.idx(x, y);
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = c[3];
    return this;
  }

  get(x, y) {
    const i = this.idx(clamp(x, 0, this.size - 1), clamp(y, 0, this.size - 1));
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  /** alpha 混合写入 */
  blend(x, y, color, alpha = 1) {
    if (!this.inside(x, y)) return this;
    const c = C(color), i = this.idx(x, y);
    const a = alpha * (c[3] / 255);
    this.data[i] = Math.round(this.data[i] * (1 - a) + c[0] * a);
    this.data[i + 1] = Math.round(this.data[i + 1] * (1 - a) + c[1] * a);
    this.data[i + 2] = Math.round(this.data[i + 2] * (1 - a) + c[2] * a);
    this.data[i + 3] = Math.max(this.data[i + 3], Math.round(255 * a));
    return this;
  }

  fill(color) {
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) this.set(x, y, color);
    return this;
  }

  clear() { this.data.fill(0); return this; }

  rect(x, y, w, h, color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color);
    return this;
  }

  outline(x, y, w, h, color) {
    for (let i = x; i < x + w; i++) { this.set(i, y, color); this.set(i, y + h - 1, color); }
    for (let j = y; j < y + h; j++) { this.set(x, j, color); this.set(x + w - 1, j, color); }
    return this;
  }

  hline(y, x0, x1, color) { for (let x = x0; x <= x1; x++) this.set(x, y, color); return this; }
  vline(x, y0, y1, color) { for (let y = y0; y <= y1; y++) this.set(x, y, color); return this; }

  border(color, width = 1) {
    for (let w = 0; w < width; w++) this.outline(w, w, this.size - w * 2, this.size - w * 2, color);
    return this;
  }

  /** 每像素随机亮度扰动，制造 MC 标志性的颗粒感 */
  grain(amount = 0.12, mono = true) {
    const r = this.rng;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const i = this.idx(x, y);
        if (this.data[i + 3] === 0) continue;
        if (mono) {
          const f = 1 + (r.float() * 2 - 1) * amount;
          this.data[i] = clamp(Math.round(this.data[i] * f), 0, 255);
          this.data[i + 1] = clamp(Math.round(this.data[i + 1] * f), 0, 255);
          this.data[i + 2] = clamp(Math.round(this.data[i + 2] * f), 0, 255);
        } else {
          for (let k = 0; k < 3; k++) {
            const f = 1 + (r.float() * 2 - 1) * amount;
            this.data[i + k] = clamp(Math.round(this.data[i + k] * f), 0, 255);
          }
        }
      }
    }
    return this;
  }

  /** 随机撒点 */
  speckle(color, prob = 0.15) {
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      if (this.rng.float() < prob) this.set(x, y, color);
    }
    return this;
  }

  /** 从调色板随机取色填充整块（基础噪点纹理） */
  noiseFill(palette, weights = null) {
    const pal = palette.map(C);
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      const c = weights ? this._weighted(pal, weights) : pal[(this.rng.float() * pal.length) | 0];
      this.set(x, y, c);
    }
    return this;
  }

  _weighted(pal, weights) {
    let total = 0; for (const w of weights) total += w;
    let r = this.rng.float() * total;
    for (let i = 0; i < pal.length; i++) { r -= weights[i]; if (r <= 0) return pal[i]; }
    return pal[pal.length - 1];
  }

  /** 随机圆斑（矿石、苔藓） */
  blobs(count, radius, color, jitter = 0.35) {
    for (let n = 0; n < count; n++) {
      const cx = this.rng.range(1, this.size - 1);
      const cy = this.rng.range(1, this.size - 1);
      const rad = radius * this.rng.range(0.7, 1.3);
      for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) {
        for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d <= rad * (1 + (this.rng.float() * 2 - 1) * jitter)) {
            this.set(x, y, Array.isArray(color) || typeof color === 'string' ? color : color(x, y));
          }
        }
      }
    }
    return this;
  }

  /** 垂直条纹（木头纤维） */
  vstripes(colors, minW = 1, maxW = 3) {
    let x = 0;
    while (x < this.size) {
      const w = this.rng.int(minW, maxW);
      const c = colors[(this.rng.float() * colors.length) | 0];
      this.rect(x, 0, w, this.size, c);
      x += w;
    }
    return this;
  }

  /** 水平木板：n 块，缝隙用暗色 */
  planks(n, base, dark, light) {
    const h = this.size / n;
    for (let k = 0; k < n; k++) {
      const y0 = Math.round(k * h);
      const y1 = Math.round((k + 1) * h) - 1;
      for (let y = y0; y <= y1; y++) {
        for (let x = 0; x < this.size; x++) {
          let c = base;
          if (this.rng.float() < 0.14) c = dark;
          else if (this.rng.float() < 0.14) c = light;
          this.set(x, y, c);
        }
      }
      // 缝隙
      this.hline(y1, 0, this.size - 1, dark);
      // 木纹
      const knots = this.rng.int(1, 3);
      for (let q = 0; q < knots; q++) {
        const kx = this.rng.int(1, this.size - 2);
        this.set(kx, this.rng.int(y0, Math.max(y0, y1 - 1)), dark);
      }
      // 板缝竖线（错开）
      const sx = this.rng.int(2, this.size - 3);
      for (let y = y0; y <= y1; y++) this.set(sx, y, dark);
    }
    return this;
  }

  /** 砖块图案 */
  bricks(rows, brick, mortar) {
    this.fill(mortar);
    const h = this.size / rows;
    for (let r = 0; r < rows; r++) {
      const y0 = Math.round(r * h);
      const bh = Math.round(h) - 1;
      const offset = (r % 2) ? Math.round(this.size / 4) : 0;
      for (let bx = -this.size; bx < this.size * 2; bx += this.size / 2) {
        const x0 = Math.round(bx + offset);
        for (let y = y0; y < y0 + bh; y++) {
          for (let x = x0; x < x0 + Math.round(this.size / 2) - 1; x++) {
            if (this.inside(x, y)) {
              const f = 1 + (this.rng.float() * 2 - 1) * 0.08;
              this.set(x, y, shade(brick, f));
            }
          }
        }
      }
    }
    return this;
  }

  /** 卵石：随机大小的圆润石块 + 暗色缝 */
  cobble(baseDark, stones) {
    this.fill(baseDark);
    const cells = [
      [0, 0, 7, 6], [8, 0, 8, 5], [0, 7, 5, 5], [6, 6, 5, 5], [12, 6, 4, 6],
      [0, 13, 8, 3], [9, 12, 7, 4], [12, 0, 4, 5], [6, 12, 3, 4],
    ];
    for (const [x, y, w, h] of cells) {
      const base = stones[(this.rng.float() * stones.length) | 0];
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) {
          if (i === x || j === y || i === x + w - 1 || j === y + h - 1) {
            if (this.rng.float() < 0.55) continue;   // 边缘不规则
          }
          const f = 1 + (this.rng.float() * 2 - 1) * 0.14;
          this.set(i, j, shade(base, f));
        }
      }
      // 高光
      this.hline(y, x + 1, x + w - 2, shade(base, 1.22));
      this.vline(x, y + 1, y + h - 2, shade(base, 1.12));
    }
    return this;
  }

  /** 顶部覆盖层（草方块侧面的草皮） */
  overlayTop(depth, color, ragged = 3) {
    for (let x = 0; x < this.size; x++) {
      const d = depth + this.rng.int(0, ragged);
      for (let y = 0; y < d; y++) {
        const f = 1 + (this.rng.float() * 2 - 1) * 0.14;
        this.set(x, y, shade(color, f));
      }
    }
    return this;
  }

  /** 整体上浅下深的柔和渐变 */
  gradientV(top, bottom) {
    for (let y = 0; y < this.size; y++) {
      const c = mixc(top, bottom, y / (this.size - 1));
      for (let x = 0; x < this.size; x++) this.set(x, y, c);
    }
    return this;
  }

  /** 挖空（用于树叶 / 玻璃 / 铁栏杆） */
  punch(prob, seedShift = 0) {
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      if (this.rng.float() < prob) {
        const i = this.idx(x, y);
        this.data[i + 3] = 0;
      }
    }
    return this;
  }

  /** 3D 立体边框（按钮 / 箱子 / 熔炉） */
  bevel(light = 1.35, dark = 0.62) {
    const s = this.size;
    for (let x = 0; x < s; x++) {
      const t = this.get(x, 0); this.set(x, 0, shade(t, light));
      const b = this.get(x, s - 1); this.set(x, s - 1, shade(b, dark));
    }
    for (let y = 0; y < s; y++) {
      const l = this.get(0, y); this.set(0, y, shade(l, light * 0.95));
      const r = this.get(s - 1, y); this.set(s - 1, y, shade(r, dark * 1.05));
    }
    return this;
  }

  /** 十字草叶（植物贴图） */
  plant(stemColor, leafColor, height = 13, spread = 4) {
    this.clear();
    const cx = this.size / 2;
    const base = this.size - 1;
    for (let n = 0; n < 5; n++) {
      const bx = Math.round(cx + this.rng.range(-spread, spread));
      const h = Math.round(height * this.rng.range(0.55, 1));
      let x = bx;
      for (let k = 0; k < h; k++) {
        const y = base - k;
        if (k > h * 0.4 && this.rng.float() < 0.4) x += this.rng.bool() ? 1 : -1;
        this.set(x, y, k > h * 0.65 ? leafColor : stemColor);
        if (k > h * 0.5 && this.rng.float() < 0.5) this.set(x + (this.rng.bool() ? 1 : -1), y, leafColor);
      }
    }
    return this;
  }

  /** 从另一 Tile 复制（可带色调） */
  copyFrom(other, tint = null, amount = 1) {
    this.data.set(other.data);
    if (tint) this.tint(tint, amount);
    return this;
  }

  /** 整体着色（用于草地/树叶的生物群系染色） */
  tint(color, amount = 1) {
    const t = C(color);
    for (let i = 0; i < this.data.length; i += 4) {
      if (this.data[i + 3] === 0) continue;
      const lum = (this.data[i] * 0.299 + this.data[i + 1] * 0.587 + this.data[i + 2] * 0.114) / 255;
      for (let k = 0; k < 3; k++) {
        const tinted = t[k] * lum;
        this.data[i + k] = clamp(Math.round(this.data[i + k] * (1 - amount) + tinted * amount), 0, 255);
      }
    }
    return this;
  }

  /** 水平滚动（生成动画帧） */
  scrollV(dy) {
    const out = new Uint8Array(this.data.length);
    for (let y = 0; y < this.size; y++) {
      const src = ((y + dy) % this.size + this.size) % this.size;
      out.set(this.data.subarray(src * this.size * 4, (src + 1) * this.size * 4), y * this.size * 4);
    }
    this.data = out;
    return this;
  }

  clone() {
    const t = new Tile(this.size, 'clone');
    t.data.set(this.data);
    t.rng = this.rng;
    return t;
  }

  /** 返回可直接上传 GL 的 Uint8Array（RGBA） */
  toRGBA() { return this.data; }

  /** 转 ImageData（用于 2D canvas 图标） */
  toImageData(ctx) {
    const img = ctx.createImageData(this.size, this.size);
    img.data.set(this.data);
    return img;
  }
}
