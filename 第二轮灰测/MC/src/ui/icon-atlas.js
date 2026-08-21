/**
 * ui/icon-atlas.js
 * ------------------------------------------------------------------
 * Builds one texture holding an icon for every item.
 *
 * Vanilla draws block items as small isometric cubes and everything else
 * as a flat sprite. Doing that at runtime per frame would need a second
 * 3D pass, so instead the icons are rendered once into a 2D atlas with
 * canvas transforms: three sheared blits (top, left, right) reproduce the
 * isometric cube, each pre-multiplied by the same face shading the
 * terrain shader uses.
 *
 * Result: the whole inventory draws in a single batched draw call.
 */

import { items } from '../game/items.js';
import { blocks, getBlock } from '../world/blocks.js';
import { MODEL, TINT } from '../world/constants.js';
import { PLAINS } from '../world/biomes.js';

/** Pixels per icon cell in the atlas. */
export const ICON_CELL = 32;
/** Face brightness, matching FACE_SHADE in the terrain shader. */
const SHADE_TOP = 1.0;
const SHADE_LEFT = 0.8;
const SHADE_RIGHT = 0.62;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function context2d(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/**
 * Renders one 16x16 tile pre-multiplied by a brightness and an optional
 * biome tint. Results are cached because a cube reuses the same tile.
 */
class TileShader {
  constructor() {
    this.cache = new Map();
    this.canvas = makeCanvas(16, 16);
    this.ctx = context2d(this.canvas);
  }

  /**
   * @param {ImageBitmap|HTMLImageElement} image source texture
   * @param {number} brightness 0..1
   * @param {number[]|null} tint normalised rgb multiplier
   * @param {string} key cache key
   */
  shade(image, brightness, tint, key) {
    const cached = this.cache.get(key);
    if (cached) return cached;
    const out = makeCanvas(16, 16);
    const ctx = context2d(out);
    ctx.clearRect(0, 0, 16, 16);
    // Animated textures are vertical strips; always take the first frame.
    ctx.drawImage(image, 0, 0, 16, 16, 0, 0, 16, 16);
    const r = Math.round(255 * brightness * (tint ? tint[0] : 1));
    const g = Math.round(255 * brightness * (tint ? tint[1] : 1));
    const b = Math.round(255 * brightness * (tint ? tint[2] : 1));
    if (r !== 255 || g !== 255 || b !== 255) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, 0, 16, 16);
      // Restore the alpha channel that `multiply` flattened.
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(image, 0, 0, 16, 16, 0, 0, 16, 16);
      ctx.globalCompositeOperation = 'source-over';
    }
    this.cache.set(key, out);
    return out;
  }
}

/**
 * Draws an isometric cube for a block into `ctx` at cell (cx, cy).
 *
 * Geometry: a 2:1 isometric cube. With half-width `hw` the top rhombus is
 * 2hw wide and hw tall, and the side faces are hw tall, so the whole cube
 * occupies 2hw x 2hw.
 */
function drawIsoCube(ctx, x, y, size, topTile, leftTile, rightTile) {
  const hw = size / 2;
  const cx = x + hw;
  const topY = y + hw / 2;      // y of the rhombus' left/right vertices
  const sideH = hw;
  const s = 1 / 16;

  // --- top face -------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, topY - hw / 2);
  ctx.lineTo(cx + hw, topY);
  ctx.lineTo(cx, topY + hw / 2);
  ctx.lineTo(cx - hw, topY);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(hw * s, (hw / 2) * s, -hw * s, (hw / 2) * s, cx, topY - hw / 2);
  ctx.drawImage(topTile, 0, 0);
  ctx.restore();

  // --- left face ------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - hw, topY);
  ctx.lineTo(cx, topY + hw / 2);
  ctx.lineTo(cx, topY + hw / 2 + sideH);
  ctx.lineTo(cx - hw, topY + sideH);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(hw * s, (hw / 2) * s, 0, sideH * s, cx - hw, topY);
  ctx.drawImage(leftTile, 0, 0);
  ctx.restore();

  // --- right face -----------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, topY + hw / 2);
  ctx.lineTo(cx + hw, topY);
  ctx.lineTo(cx + hw, topY + sideH);
  ctx.lineTo(cx, topY + hw / 2 + sideH);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(hw * s, -(hw / 2) * s, 0, sideH * s, cx, topY + hw / 2);
  ctx.drawImage(rightTile, 0, 0);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * The finished atlas: a GPU texture plus per-item UV rectangles.
 */
export class IconAtlas {
  constructor(gl) {
    this.gl = gl;
    /** itemId -> [u0, v0, u1, v1] */
    this.uv = new Map();
    this.texture = null;
    this.width = 0;
    this.height = 0;
    this.missing = [];
  }

  /** A `{texture, width, height}` record for the sprite batch. */
  get record() {
    return { texture: this.texture, width: this.width, height: this.height };
  }

  /** UV rect for an item id, or null. */
  uvFor(itemId) {
    return this.uv.get(itemId) ?? null;
  }

  /**
   * Builds the atlas.
   * @param {import('../gfx/textures.js').TextureSet} textures loaded texture set
   * @param {(rel: string) => Promise<any>} loadItemImage loader for item PNGs
   */
  async build(textures, loadItemImage) {
    const real = items.filter(Boolean);
    const cols = Math.ceil(Math.sqrt(real.length));
    const rows = Math.ceil(real.length / cols);
    const width = cols * ICON_CELL;
    const height = rows * ICON_CELL;

    const canvas = makeCanvas(width, height);
    const ctx = context2d(canvas);
    ctx.clearRect(0, 0, width, height);
    const shader = new TileShader();

    // Load every plain-item sprite in parallel.
    const plain = real.filter((it) => it.texture);
    const loaded = await Promise.all(plain.map((it) => loadItemImage(`items/${it.texture}.png`)));
    const itemImages = new Map();
    plain.forEach((it, i) => { if (loaded[i]) itemImages.set(it.id, loaded[i]); });

    real.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * ICON_CELL;
      const y = row * ICON_CELL;
      this.uv.set(item.id, [x / width, y / height, (x + ICON_CELL) / width, (y + ICON_CELL) / height]);

      if (item.placesBlock) {
        this.#drawBlockIcon(ctx, shader, textures, item, x, y);
      } else {
        const img = itemImages.get(item.id);
        if (img) {
          ctx.drawImage(img, 0, 0, img.width, Math.min(img.height, img.width), x + 4, y + 4, 24, 24);
        } else {
          this.missing.push(item.name);
          // Placeholder so a missing sprite is obvious but harmless.
          ctx.fillStyle = '#b040b0';
          ctx.fillRect(x + 8, y + 8, 16, 16);
        }
      }
    });

    this.#upload(canvas, width, height);
    if (this.missing.length) {
      console.warn(`[icons] ${this.missing.length} item textures missing: ${this.missing.slice(0, 8).join(', ')}`);
    }
    return this;
  }

  /** Renders one block item, choosing a cube or a flat sprite. */
  #drawBlockIcon(ctx, shader, textures, item, x, y) {
    const block = getBlock(item.placesBlock);
    const topName = block.faces[2];
    const sideName = block.faces[5];
    const rightName = block.faces[0];
    const topImg = textures.blockImages.get(topName);
    const sideImg = textures.blockImages.get(sideName);
    const rightImg = textures.blockImages.get(rightName);
    if (!topImg || !sideImg) { this.missing.push(block.name); return; }

    // Biome tint uses the plains palette so grass and leaves look right.
    const tintKind = block.tint;
    const tint = tintKind === TINT.GRASS ? PLAINS.grass
      : tintKind === TINT.FOLIAGE ? PLAINS.foliage
        : tintKind === TINT.WATER ? PLAINS.water : null;
    const tintKey = tint ? tint.map((v) => v.toFixed(2)).join(',') : 'none';

    // Plants, torches and liquids read better as flat sprites, exactly
    // like the vanilla item models do.
    if (block.model === MODEL.CROSS || block.model === MODEL.TORCH || block.model === MODEL.LIQUID) {
      const tile = shader.shade(topImg, 1, tint, `${topName}|1|${tintKey}`);
      ctx.drawImage(tile, x + 4, y + 4, 24, 24);
      return;
    }

    const top = shader.shade(topImg, SHADE_TOP, tint, `${topName}|t|${tintKey}`);
    const left = shader.shade(sideImg, SHADE_LEFT, null, `${sideName}|l|none`);
    const right = shader.shade(rightImg ?? sideImg, SHADE_RIGHT, null, `${rightName}|r|none`);
    drawIsoCube(ctx, x + 3, y + 3, ICON_CELL - 6, top, left, right);
  }

  #upload(canvas, width, height) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texture = tex;
    this.width = width;
    this.height = height;
  }

  dispose() {
    if (this.texture) this.gl.deleteTexture(this.texture);
    this.uv.clear();
  }
}

export { blocks };
