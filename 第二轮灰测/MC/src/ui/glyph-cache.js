/**
 * ui/glyph-cache.js
 * ------------------------------------------------------------------
 * Runtime glyph atlas for characters the classic bitmap font cannot draw.
 *
 * `assets/textures/font/ascii.png` only contains 256 glyphs, so anything
 * beyond Latin-1 - Chinese, Japanese, Korean, Cyrillic, Greek, emoji-ish
 * symbols - would otherwise advance the cursor but draw nothing, leaving
 * invisible gaps in chat. Vanilla solves this with a bundled unicode font
 * sheet; here the browser's own fonts are used instead: each missing code
 * point is rasterised once into a cell of a texture atlas and cached.
 *
 * Design notes
 *  - one 512x512 RGBA texture holds 32x32 = 1024 cells of 16x16 px, which
 *    is far more than a chat session needs;
 *  - only the newly written 16x16 cell is uploaded (`texSubImage2D`), so
 *    adding a glyph costs ~1 KB of bus traffic rather than a full
 *    re-upload;
 *  - glyphs are rasterised white so the sprite batch's per-vertex colour
 *    tints them, exactly like the bitmap font;
 *  - advances are reported in *font pixels* (the same units the bitmap
 *    font uses) so mixed-script lines lay out on one consistent grid.
 */

/** Atlas dimensions. */
const ATLAS_SIZE = 512;
/** Cell size in atlas pixels. Glyphs are rasterised at 2x the display size. */
const CELL = 16;
const COLS = ATLAS_SIZE / CELL;
const CAPACITY = COLS * COLS;

/** Display height of one line of text, matching BitmapFont#lineHeight - 1. */
const DISPLAY_SIZE = 8;

/**
 * Font stack biased toward CJK coverage, then a generic fallback. The
 * browser picks the first family that has the glyph.
 */
const FONT_STACK = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", '
  + '"Noto Sans CJK SC", "Source Han Sans SC", "Malgun Gothic", "Meiryo", '
  + '"Segoe UI", system-ui, sans-serif';

/** Unicode ranges that are rendered full-width (square, double advance). */
const FULL_WIDTH_RANGES = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff],
  [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf],
  [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe6f],
  [0xff00, 0xff60], [0xffe0, 0xffe6],
  [0x20000, 0x2fa1f],
];

/** True for characters that occupy a full-width cell (CJK and friends). */
export function isFullWidth(codePoint) {
  for (const [lo, hi] of FULL_WIDTH_RANGES) {
    if (codePoint >= lo && codePoint <= hi) return true;
  }
  return false;
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export class DynamicGlyphCache {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {{fontStack?: string}} [opts]
   */
  constructor(gl, opts = {}) {
    this.gl = gl;
    this.fontStack = opts.fontStack ?? FONT_STACK;
    /** codePoint -> {u0, v0, u1, v1, advance, drawWidth} */
    this.glyphs = new Map();
    this.next = 0;
    this.full = false;
    this.available = true;
    this.texture = null;

    try {
      this.canvas = makeCanvas(ATLAS_SIZE, ATLAS_SIZE);
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true, alpha: true });
      if (!this.ctx) throw new Error('no 2d context');
      this.ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
      // Rasterise at 2x the display size, then let the GPU downscale.
      this.ctx.font = `${CELL - 2}px ${this.fontStack}`;
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.fillStyle = '#ffffff';
      this.#createTexture();
    } catch (err) {
      this.available = false;
      console.warn(`[glyphs] dynamic font cache unavailable: ${err.message}`);
    }
  }

  #createTexture() {
    const gl = this.gl;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ATLAS_SIZE, ATLAS_SIZE, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null);
    // LINEAR: these glyphs are downscaled from 14 px, so smoothing reads
    // far better than the nearest-neighbour used for the pixel-art sheet.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** A `{texture, width, height}` record for the sprite batch. */
  get record() {
    return { texture: this.texture, width: ATLAS_SIZE, height: ATLAS_SIZE };
  }

  /**
   * Advance width in font pixels for a code point, without rasterising.
   * Used by `measure` so layout never pays for glyph creation it does not
   * need.
   */
  advanceFor(codePoint) {
    const cached = this.glyphs.get(codePoint);
    if (cached) return cached.advance;
    if (isFullWidth(codePoint)) return DISPLAY_SIZE;
    if (!this.available) return 6;
    // Measure without drawing; cheap and does not consume a cell.
    try {
      const w = this.ctx.measureText(String.fromCodePoint(codePoint)).width;
      return Math.max(3, Math.min(DISPLAY_SIZE, Math.round(w / 2) + 1));
    } catch {
      return 6;
    }
  }

  /**
   * Returns the atlas entry for a code point, rasterising it on first use.
   * @returns {{u0:number,v0:number,u1:number,v1:number,advance:number,drawWidth:number}|null}
   */
  glyphFor(codePoint) {
    const cached = this.glyphs.get(codePoint);
    if (cached) return cached;
    if (!this.available) return null;
    if (this.next >= CAPACITY) {
      if (!this.full) {
        this.full = true;
        console.warn('[glyphs] dynamic font cache is full; further glyphs will not render');
      }
      return null;
    }

    const index = this.next++;
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const px = col * CELL;
    const py = row * CELL;
    const char = String.fromCodePoint(codePoint);

    const ctx = this.ctx;
    ctx.clearRect(px, py, CELL, CELL);
    // Baseline sits near the bottom of the cell, leaving room for descenders.
    ctx.fillText(char, px + 1, py + CELL - 3);

    const fullWidth = isFullWidth(codePoint);
    const measured = ctx.measureText(char).width;
    const inkWidth = Math.max(2, Math.min(CELL, Math.ceil(measured) + 1));
    const advance = fullWidth
      ? DISPLAY_SIZE
      : Math.max(3, Math.min(DISPLAY_SIZE, Math.round(measured / 2) + 1));

    const entry = {
      u0: px / ATLAS_SIZE,
      v0: py / ATLAS_SIZE,
      u1: (px + (fullWidth ? CELL : inkWidth)) / ATLAS_SIZE,
      v1: (py + CELL) / ATLAS_SIZE,
      advance,
      // Draw the glyph at its natural proportion so CJK stays square.
      drawWidth: fullWidth ? DISPLAY_SIZE : Math.max(2, Math.round(inkWidth / 2)),
    };
    this.glyphs.set(codePoint, entry);
    this.#uploadCell(px, py);
    return entry;
  }

  /** Uploads just the one 16x16 cell that changed. */
  #uploadCell(px, py) {
    const gl = this.gl;
    try {
      const data = this.ctx.getImageData(px, py, CELL, CELL);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, px, py, CELL, CELL,
        gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.data.buffer));
    } catch (err) {
      this.available = false;
      console.warn(`[glyphs] cell upload failed: ${err.message}`);
    }
  }

  /** Height a dynamic glyph is drawn at, in font pixels. */
  get displayHeight() { return DISPLAY_SIZE; }

  get size() { return this.glyphs.size; }

  dispose() {
    if (this.texture) this.gl.deleteTexture(this.texture);
    this.glyphs.clear();
  }
}
