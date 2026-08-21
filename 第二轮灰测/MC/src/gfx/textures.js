/**
 * gfx/textures.js
 * ------------------------------------------------------------------
 * Loads every image asset and turns block textures into a single
 * GL_TEXTURE_2D_ARRAY.
 *
 * Why an array texture instead of a classic atlas?
 *  - no bleeding between neighbouring tiles, so mipmapping and
 *    anisotropic filtering are safe;
 *  - UVs can run outside [0,1] and simply repeat, which is exactly what
 *    greedy-merged quads need;
 *  - animated textures become "consecutive layers" and the shader can
 *    pick a frame by adding an offset.
 *
 * The loader also
 *  - pre-composites the per-biome grass side overlay into its own layer
 *    per biome (correct tinted grass edges with no extra geometry);
 *  - bleeds opaque colour into fully transparent pixels so mipmaps of
 *    cutout textures do not develop dark halos;
 *  - packs the block-breaking crack stages into one strip texture.
 */

import { collectTextureNames, blocks } from '../world/blocks.js';
import { BIOMES } from '../world/biomes.js';

/** Every block texture is a 16x16 tile (animated ones are a vertical strip). */
export const TILE = 16;
/** Mip levels for the block array: 16 -> 8 -> 4 -> 2 (2x2 is small enough). */
export const MIP_LEVELS = 4;

/** Animated textures and how fast they run (seconds per frame). */
const ANIMATIONS = {
  water_still: { group: 1, secondsPerFrame: 0.10 },
  water_flow: { group: 1, secondsPerFrame: 0.10 },
  lava_still: { group: 2, secondsPerFrame: 0.18 },
  lava_flow: { group: 2, secondsPerFrame: 0.18 },
};

/** Non-block images the renderer and GUI need. */
const FLAT_TEXTURES = {
  widgets: 'gui/widgets.png',
  icons: 'gui/icons.png',
  bars: 'gui/bars.png',
  dirt_background: 'gui/options_background.png',
  inventory: 'gui/inventory.png',
  crafting_table_gui: 'gui/crafting_table.png',
  chest_gui: 'gui/generic_54.png',
  furnace_gui: 'gui/furnace.png',
  font: 'font/ascii.png',
  sun: 'environment/sun.png',
  moon: 'environment/moon_phases.png',
  clouds: 'environment/clouds.png',
  rain: 'environment/rain.png',
  snow: 'environment/snow.png',
  particles: 'particle/particles.png',
  underwater: 'misc/underwater.png',
  pumpkinblur: 'misc/pumpkinblur.png',
};

const ENTITY_TEXTURES = ['steve', 'alex', 'pig', 'cow', 'sheep', 'chicken', 'zombie', 'creeper', 'skeleton'];

const DESTROY_STAGES = 10;

/**
 * Default asset root, resolved from this module's own URL so the game
 * works no matter which directory the HTML page lives in.
 */
export const DEFAULT_TEXTURE_BASE = new URL('../../assets/textures/', import.meta.url).href;

/* ------------------------------------------------------------------ */
/* image loading                                                      */
/* ------------------------------------------------------------------ */

/**
 * Loads an image as an ImageBitmap (falling back to HTMLImageElement).
 * Returns null instead of throwing so one missing texture cannot stop
 * the whole game from starting.
 */
export async function loadImage(url) {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (typeof createImageBitmap === 'function') {
      return await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    }
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    return img;
  } catch (err) {
    console.warn(`[textures] failed to load ${url}: ${err.message}`);
    return null;
  }
}

/** Runs `worker` over `items` with bounded concurrency. */
async function mapPool(items, worker, concurrency = 24) {
  const queue = [...items.entries()];
  const out = new Array(items.length);
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const [i, item] = queue.shift();
      out[i] = await worker(item, i);
    }
  });
  await Promise.all(runners);
  return out;
}

/* ------------------------------------------------------------------ */
/* canvas helpers                                                     */
/* ------------------------------------------------------------------ */

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
 * Copies opaque colour into fully transparent pixels so that mip
 * reduction of a cutout texture blends toward the right hue instead of
 * toward black. Operates in place on a tile-sized RGBA buffer.
 */
function bleedAlpha(data, width, height, offset) {
  const at = (x, y) => offset + (y * width + x) * 4;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = at(x, y);
        if (data[i + 3] !== 0) continue;
        let r = 0; let g = 0; let b = 0; let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx; const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const j = at(nx, ny);
            if (data[j + 3] === 0) continue;
            r += data[j]; g += data[j + 1]; b += data[j + 2]; n++;
          }
        }
        if (n) { data[i] = r / n; data[i + 1] = g / n; data[i + 2] = b / n; }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* texture set                                                        */
/* ------------------------------------------------------------------ */

/**
 * Owns every GPU texture the renderer uses.
 */
export class TextureSet {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {{basePath?: string, anisotropy?: number, caps?: object}} [opts]
   */
  constructor(gl, opts = {}) {
    this.gl = gl;
    this.basePath = opts.basePath ?? DEFAULT_TEXTURE_BASE;
    this.caps = opts.caps ?? null;
    this.anisotropy = opts.anisotropy ?? 4;

    /** name -> base layer index in the block array */
    this.layers = new Map();
    /** name -> {group, frames} for animated textures */
    this.animations = new Map();
    /** biome id -> layer index of the composited grass side */
    this.grassSideLayers = new Int16Array(BIOMES.length).fill(-1);
    this.snowSideLayer = -1;
    /** WebGLTexture for the block array */
    this.blockArray = null;
    this.layerCount = 0;
    /** name -> {texture, width, height} */
    this.flat = new Map();
    /** raw ImageBitmaps kept for the CPU-side icon atlas builder */
    this.blockImages = new Map();
    this.itemImages = new Map();
    this.rawFlat = new Map();
    this.destroyStrip = null;
    /** 1x1 white texture for solid-colour GUI quads */
    this.white = null;
  }

  /** Full asset URL for a texture path fragment. */
  url(p) { return this.basePath + p; }

  /**
   * Loads everything. Resolves once all GPU textures exist.
   * @param {(fraction: number, label: string) => void} [onProgress]
   */
  async load(onProgress = () => {}) {
    const blockNames = [...collectTextureNames()].sort();
    for (let i = 0; i < DESTROY_STAGES; i++) blockNames.push(`destroy_stage_${i}`);

    onProgress(0.02, 'loading block textures');
    const blockImgs = await mapPool(blockNames, (name) => this.loadImage(`blocks/${name}.png`));
    onProgress(0.45, 'loading interface textures');

    const flatEntries = Object.entries(FLAT_TEXTURES);
    const flatImgs = await mapPool(flatEntries.map(([, p]) => p), (p) => this.loadImage(p));
    const entityImgs = await mapPool(ENTITY_TEXTURES, (n) => this.loadImage(`entity/${n}.png`));
    onProgress(0.70, 'building texture array');

    // Keep the raw bitmaps around: the inventory icon atlas needs them.
    blockNames.forEach((n, i) => { if (blockImgs[i]) this.blockImages.set(n, blockImgs[i]); });
    flatEntries.forEach(([key], i) => { if (flatImgs[i]) this.rawFlat.set(key, flatImgs[i]); });

    this.#buildBlockArray(blockNames, blockImgs);
    onProgress(0.85, 'uploading interface textures');

    flatEntries.forEach(([key], i) => {
      if (flatImgs[i]) this.flat.set(key, this.#upload2D(flatImgs[i], { mipmap: false }));
    });
    ENTITY_TEXTURES.forEach((name, i) => {
      if (entityImgs[i]) this.flat.set(`entity_${name}`, this.#upload2D(entityImgs[i], { mipmap: false }));
    });
    this.#buildDestroyStrip(blockNames, blockImgs);
    this.#buildWhite();
    this.#resolveBlockFaceLayers();
    onProgress(1, 'textures ready');
    return this;
  }

  async loadImage(rel) {
    return loadImage(this.url(rel));
  }

  /* -------------------------------------------------------------- */
  /* block array                                                     */
  /* -------------------------------------------------------------- */

  /**
   * Lays out every block texture (plus animation frames and per-biome
   * grass sides) into one array texture.
   */
  #buildBlockArray(names, images) {
    const gl = this.gl;

    // --- plan the layout -----------------------------------------
    /** @type {{name: string, image: any, frame: number}[]} */
    const slots = [];
    names.forEach((name, i) => {
      const img = images[i];
      if (!img) return;
      const frames = img.width === TILE && img.height > TILE && img.height % TILE === 0
        ? img.height / TILE
        : 1;
      const anim = ANIMATIONS[name];
      const used = anim ? Math.min(frames, 32) : 1;
      this.layers.set(name, slots.length);
      if (anim) this.animations.set(name, { group: anim.group, frames: used, secondsPerFrame: anim.secondsPerFrame });
      for (let f = 0; f < used; f++) slots.push({ name, image: img, frame: f });
    });

    // Per-biome grass sides: base dirt-and-grass side plus the overlay
    // multiplied by that biome's grass colour.
    const sideImg = this.blockImages.get('grass_block_side');
    const overlayImg = this.blockImages.get('grass_block_side_overlay');
    const snowSideImg = this.blockImages.get('grass_block_snow');
    if (sideImg && overlayImg) {
      for (const b of BIOMES) {
        this.grassSideLayers[b.id] = slots.length;
        slots.push({ name: `__grass_side_${b.id}`, image: sideImg, frame: 0, overlay: overlayImg, tint: b.grass });
      }
    }
    if (snowSideImg) {
      this.snowSideLayer = slots.length;
      slots.push({ name: '__grass_side_snow', image: snowSideImg, frame: 0 });
    }

    const layerCount = slots.length;
    this.layerCount = layerCount;
    if (layerCount === 0) {
      throw new Error(
        `no block textures could be loaded from ${this.basePath}. `
        + 'Run "node tools/fetch-assets.mjs" to download them.',
      );
    }
    const maxLayers = this.caps?.maxArrayLayers ?? gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
    if (layerCount > maxLayers) {
      console.error(`[textures] need ${layerCount} array layers but the GPU allows ${maxLayers}`);
    }

    // --- rasterise into one tall canvas --------------------------
    const canvas = makeCanvas(TILE, TILE * layerCount);
    const ctx = context2d(canvas);
    for (let i = 0; i < layerCount; i++) {
      const slot = slots[i];
      const dy = i * TILE;
      ctx.drawImage(slot.image, 0, slot.frame * TILE, TILE, TILE, 0, dy, TILE, TILE);
      if (slot.overlay) {
        // Tint the overlay by drawing it, then multiplying with the colour.
        const tmp = makeCanvas(TILE, TILE);
        const tctx = context2d(tmp);
        tctx.drawImage(slot.overlay, 0, 0);
        tctx.globalCompositeOperation = 'multiply';
        const [r, g, b] = slot.tint;
        tctx.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
        tctx.fillRect(0, 0, TILE, TILE);
        tctx.globalCompositeOperation = 'destination-in';
        tctx.drawImage(slot.overlay, 0, 0);
        ctx.drawImage(tmp, 0, dy);
      }
    }

    const pixels = ctx.getImageData(0, 0, TILE, TILE * layerCount);
    const data = new Uint8Array(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength);
    for (let i = 0; i < layerCount; i++) bleedAlpha(data, TILE, TILE, i * TILE * TILE * 4);

    // --- upload ---------------------------------------------------
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, MIP_LEVELS, gl.RGBA8, TILE, TILE, layerCount);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage3D(
      gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0,
      TILE, TILE, layerCount, gl.RGBA, gl.UNSIGNED_BYTE, data,
    );
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const aniso = this.caps?.aniso;
    if (aniso) {
      gl.texParameterf(
        gl.TEXTURE_2D_ARRAY, aniso.ext.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(this.anisotropy, aniso.max),
      );
    }
    this.blockArray = tex;
  }

  /** Crack overlay stages stacked into a single vertical strip texture. */
  #buildDestroyStrip(names, images) {
    const canvas = makeCanvas(TILE, TILE * DESTROY_STAGES);
    const ctx = context2d(canvas);
    let found = 0;
    for (let i = 0; i < DESTROY_STAGES; i++) {
      const idx = names.indexOf(`destroy_stage_${i}`);
      const img = idx >= 0 ? images[idx] : null;
      if (img) { ctx.drawImage(img, 0, 0, TILE, TILE, 0, i * TILE, TILE, TILE); found++; }
    }
    if (!found) return;
    this.destroyStrip = this.#upload2D(canvas, { mipmap: false });
    this.destroyStages = DESTROY_STAGES;
  }

  #buildWhite() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.white = { texture: tex, width: 1, height: 1 };
  }

  /** Uploads a plain 2D texture with pixel-art filtering. */
  #upload2D(image, { mipmap = false, wrap } = {}) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    const w = image.width; const h = image.height;
    const pot = (w & (w - 1)) === 0 && (h & (h - 1)) === 0;
    if (mipmap && pot) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const mode = wrap ?? gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, mode);
    return { texture: tex, width: w, height: h };
  }

  /** Writes resolved layer indices onto every block definition. */
  #resolveBlockFaceLayers() {
    let missing = 0;
    for (const b of blocks) {
      for (let f = 0; f < 6; f++) {
        const layer = this.layers.get(b.faces[f]);
        if (layer === undefined) {
          if (!b.isAir) missing++;
          b.faceLayers[f] = 0;
        } else {
          b.faceLayers[f] = layer;
        }
      }
      if (b.sideVariant === 'grass') {
        b.variantLayers = this.grassSideLayers;
        b.snowVariantLayer = this.snowSideLayer;
      }
      const anim = this.animations.get(b.faces[2]);
      b.animGroup = anim ? anim.group : 0;
    }
    if (missing) console.warn(`[textures] ${missing} block faces had no texture and fell back to layer 0`);
  }

  /* -------------------------------------------------------------- */
  /* queries                                                        */
  /* -------------------------------------------------------------- */

  /** Base layer for a texture name, or -1. */
  layerOf(name) {
    const l = this.layers.get(name);
    return l === undefined ? -1 : l;
  }

  /** Named 2D texture record `{texture, width, height}`. */
  get(name) {
    return this.flat.get(name) ?? this.white;
  }

  /**
   * Current animation frame offsets for the shader's `uAnimFrames`
   * uniform (index 0 is always 0 so static textures add nothing).
   */
  animFrames(time, out = new Float32Array(4)) {
    out[0] = 0;
    for (const [, anim] of this.animations) {
      out[anim.group] = Math.floor(time / anim.secondsPerFrame) % anim.frames;
    }
    return out;
  }

  dispose() {
    const gl = this.gl;
    if (this.blockArray) gl.deleteTexture(this.blockArray);
    for (const rec of this.flat.values()) gl.deleteTexture(rec.texture);
    if (this.white) gl.deleteTexture(this.white.texture);
    if (this.destroyStrip) gl.deleteTexture(this.destroyStrip.texture);
    this.flat.clear();
    this.layers.clear();
  }
}
