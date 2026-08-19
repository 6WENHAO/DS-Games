/* =====================================================================
 * TextureAtlas — 程序化生成的 TEXTURE_2D_ARRAY 图集
 *   · 每张 16×16 贴图占一层，避免图集边缘渗色，天然支持 mipmap
 *   · 同时提供 2D canvas 图标（物品栏 / 快捷栏用）
 *   · 水与岩浆逐帧动画通过 texSubImage3D 更新
 * ===================================================================== */
import { TEXTURES, ANIMATED } from '../data/textures.js';
import '../data/item_textures.js';               // 注册物品图标（副作用）
import { Tile, TILE } from './TexturePainter.js';
import { BLOCKS } from '../data/blocks.js';
import { Noise } from '../math/Noise.js';
import { SHAPE } from '../core/Constants.js';

export class TextureAtlas {
  constructor(glc) {
    this.glc = glc;
    this.gl = glc.gl;
    this.names = [];
    this.layerOf = new Map();     // 贴图名 -> 层号
    this.tiles = new Map();       // 贴图名 -> Tile（CPU 端保留，用于图标）
    this.animations = [];         // { layer, frames:[Uint8Array], ms, index }
    this.texture = null;
    this.cloudTexture = null;
    this.layerCount = 0;
    this._iconCache = new Map();
    this._shadedCache = new Map();
    this._animTimer = 0;
  }

  /** 生成全部贴图并上传 GPU */
  build() {
    const t0 = performance.now();
    const names = Object.keys(TEXTURES);
    this.names = names;
    this.layerCount = names.length;

    const size = TILE;
    const bytesPerLayer = size * size * 4;
    const buffer = new Uint8Array(bytesPerLayer * this.layerCount);

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const tile = new Tile(size, name);
      try {
        TEXTURES[name](tile);
      } catch (e) {
        console.error(`[Atlas] 贴图 "${name}" 生成失败`, e);
        tile.fill('#ff00ff');
      }
      buffer.set(tile.data, i * bytesPerLayer);
      this.layerOf.set(name, i);
      this.tiles.set(name, tile);
    }

    this._upload(buffer, size);
    this._prepareAnimations(size);
    this._buildCloudTexture();
    this.resolveBlockLayers();

    this.buildMs = performance.now() - t0;
    console.log(`[Atlas] ${this.layerCount} 张 ${size}×${size} 贴图生成完成，耗时 ${this.buildMs.toFixed(1)}ms`);
    return this;
  }

  _upload(buffer, size) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, size, size, this.layerCount,
      0, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    // 最近邻采样 + 最近邻 mipmap：保持 MC 式清晰像素感，同时减少远处闪烁
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    // 注意：不要对 NEAREST 采样的图集开启各向异性过滤。
    // Windows 上 ANGLE/D3D11 的各向异性过滤强制线性采样，会覆盖 NEAREST
    // 导致全部贴图被双线性插值 → 近处方块贴图整体发虚模糊。
    this.texture = tex;
  }

  /** 预生成动画帧（滚动位移） */
  _prepareAnimations(size) {
    for (const [name, cfg] of Object.entries(ANIMATED)) {
      const layer = this.layerOf.get(name);
      if (layer === undefined) continue;
      const base = this.tiles.get(name);
      const frames = [];
      for (let f = 0; f < cfg.frames; f++) {
        const t = base.clone();
        t.scrollV(f * (cfg.scroll ?? 1));
        frames.push(t.data.slice());
      }
      this.animations.push({ layer, frames, ms: cfg.ms, index: 0, timer: 0, size });
    }
  }

  /** 每帧调用，推进液体动画 */
  updateAnimations(dtMs) {
    if (this.animations.length === 0) return;
    const gl = this.gl;
    let bound = false;
    for (const a of this.animations) {
      a.timer += dtMs;
      if (a.timer < a.ms) continue;
      a.timer = 0;
      a.index = (a.index + 1) % a.frames.length;
      if (!bound) { gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture); bound = true; }
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, a.layer,
        a.size, a.size, 1, gl.RGBA, gl.UNSIGNED_BYTE, a.frames[a.index]);
    }
  }

  /** 生成 128×128 的云噪声纹理 */
  _buildCloudTexture() {
    const gl = this.gl;
    const S = 128;
    const noise = new Noise(20240521);
    const data = new Uint8Array(S * S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        // 使用可平铺的坐标（4 次谐波叠加）
        let v = 0, amp = 1, norm = 0, freq = 1;
        for (let o = 0; o < 4; o++) {
          const a = (x / S) * Math.PI * 2 * freq;
          const b = (y / S) * Math.PI * 2 * freq;
          v += amp * noise.simplex3(Math.cos(a) * 1.6 * freq, Math.sin(a) * 1.6 * freq, Math.cos(b) * 1.6 * freq + Math.sin(b) * 0.9);
          norm += amp; amp *= 0.55; freq *= 2;
        }
        v = (v / norm) * 0.5 + 0.5;
        data[y * S + x] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, S, S, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    this.cloudTexture = tex;
  }

  /** 把方块定义中的贴图名解析成层号 */
  resolveBlockLayers() {
    for (const b of BLOCKS) {
      for (let f = 0; f < 6; f++) {
        const name = b.tiles[f];
        const layer = this.layerOf.get(name);
        if (layer === undefined) {
          if (b.id !== 0) console.warn(`[Atlas] 方块 ${b.name} 缺少贴图 "${name}"`);
          b.layers[f] = 0;
        } else {
          b.layers[f] = layer;
        }
      }
    }
  }

  layer(name) {
    const l = this.layerOf.get(name);
    return l === undefined ? 0 : l;
  }

  bind(unit = 0) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
  }

  bindCloud(unit = 1) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.cloudTexture);
    gl.activeTexture(gl.TEXTURE0);
  }

  /* ---------------- 2D 图标（UI 使用） ---------------- */

  /** 取得 16×16 的 canvas（可带亮度系数） */
  tileCanvas(name, factor = 1) {
    const key = name + '|' + factor;
    if (this._shadedCache.has(key)) return this._shadedCache.get(key);
    const tile = this.tiles.get(name);
    const cv = document.createElement('canvas');
    cv.width = cv.height = TILE;
    const ctx = cv.getContext('2d');
    if (tile) {
      const img = ctx.createImageData(TILE, TILE);
      if (factor === 1) {
        img.data.set(tile.data);
      } else {
        for (let i = 0; i < tile.data.length; i += 4) {
          img.data[i] = Math.min(255, tile.data[i] * factor);
          img.data[i + 1] = Math.min(255, tile.data[i + 1] * factor);
          img.data[i + 2] = Math.min(255, tile.data[i + 2] * factor);
          img.data[i + 3] = tile.data[i + 3];
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    this._shadedCache.set(key, cv);
    return cv;
  }

  /**
   * 生成物品图标 dataURL
   * 方块 -> 等轴测立方体；其他 -> 平面贴图
   */
  itemIcon(item, block) {
    const key = item ? item.name : ('block:' + (block ? block.name : '?'));
    if (this._iconCache.has(key)) return this._iconCache.get(key);

    const S = 32;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (block && block.id !== 0 && block.shape === SHAPE.CUBE) {
      this._drawIsoCube(ctx, block);
    } else if (block && block.id !== 0) {
      // 十字植物/液体等：平面贴图放大
      ctx.drawImage(this.tileCanvas(block.tiles[4], 1), 0, 0, S, S);
    } else if (item && item.tex) {
      ctx.drawImage(this.tileCanvas(item.tex, 1), 0, 0, S, S);
    } else {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(4, 4, S - 8, S - 8);
    }

    const url = cv.toDataURL('image/png');
    this._iconCache.set(key, url);
    return url;
  }

  /** 等轴测立方体（2:1 像素风） */
  _drawIsoCube(ctx, block) {
    const top = this.tileCanvas(block.tiles[2], 1.0);
    const left = this.tileCanvas(block.tiles[1], 0.72);
    const right = this.tileCanvas(block.tiles[4], 0.88);

    // 顶面: O=(2,10) U=(14,-8) V=(14,8)
    this._drawFace(ctx, top, 2, 9, 14, -8, 14, 8);
    // 左面: O=(2,10) U=(14,8) V=(0,12)
    this._drawFace(ctx, left, 2, 9, 14, 8, 0, 13);
    // 右面: O=(16,18) U=(14,-8) V=(0,12)
    this._drawFace(ctx, right, 16, 17, 14, -8, 0, 13);
  }

  _drawFace(ctx, img, ox, oy, ux, uy, vx, vy) {
    ctx.save();
    ctx.setTransform(ux / TILE, uy / TILE, vx / TILE, vy / TILE, ox, oy);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  /** 贴图平均色（粒子 / 地图 / 生物着色用） */
  averageColor(name) {
    const tile = this.tiles.get(name);
    if (!tile) return [1, 0, 1];
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < tile.data.length; i += 4) {
      if (tile.data[i + 3] < 32) continue;
      r += tile.data[i]; g += tile.data[i + 1]; b += tile.data[i + 2]; n++;
    }
    if (!n) return [1, 0, 1];
    return [r / n / 255, g / n / 255, b / n / 255];
  }

  destroy() {
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.cloudTexture) gl.deleteTexture(this.cloudTexture);
  }
}
