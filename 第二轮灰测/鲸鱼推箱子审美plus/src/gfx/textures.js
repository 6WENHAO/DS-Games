/**
 * Authored pixel-art texture set, written texel by texel as byte data.
 *
 * Nothing here is a stand-in: each atlas is a designed sprite sheet with an
 * explicit palette, ordered dithering between palette entries, and — for the
 * blade atlas — a per-row silhouette profile stored in the alpha channel that
 * the grass fragment shader turns into a quantised, crisp-edged blade outline.
 */
import * as THREE from 'three';
import { GRASS } from '../core/config.js';

/* 4x4 ordered dither matrix, normalised to (0,1). */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

const bayer = (x, y) => BAYER4[y & 3][x & 3];

/** Pick a palette entry for ramp position t, dithering between neighbours. */
function ditherRamp(palette, t, x, y) {
  const s = Math.max(0, Math.min(1, t)) * (palette.length - 1);
  const i = Math.floor(s);
  const f = s - i;
  const idx = Math.min(palette.length - 1, i + (bayer(x, y) < f ? 1 : 0));
  return palette[idx];
}

function makeTexture(data, w, h, { srgb = true, repeat = false, filter = THREE.NearestFilter } = {}) {
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.magFilter = filter;
  tex.minFilter = filter;
  tex.generateMipmaps = false;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ *
 * Blade / flower atlas
 * ------------------------------------------------------------------ */

/** Palettes run base -> tip. Six sprites: four grasses, two blossoms. */
const BLADE_SPRITES = [
  {
    name: 'fresh',
    ramp: [[27, 55, 26], [40, 82, 33], [61, 112, 40], [93, 152, 55], [136, 189, 76]],
    profile: (t) => 1.0 - 0.82 * Math.pow(t, 1.25),
    tip: [188, 216, 122],
  },
  {
    name: 'cool',
    ramp: [[22, 51, 34], [32, 75, 47], [48, 104, 61], [74, 137, 78], [110, 170, 100]],
    profile: (t) => 1.0 - 0.86 * Math.pow(t, 1.1),
    tip: [160, 200, 132],
  },
  {
    name: 'olive',
    ramp: [[38, 52, 22], [58, 78, 28], [86, 108, 36], [120, 143, 51], [160, 176, 74]],
    profile: (t) => 1.0 - 0.75 * Math.pow(t, 1.5),
    tip: [200, 205, 108],
  },
  {
    name: 'dry',
    ramp: [[52, 50, 26], [82, 74, 34], [118, 104, 46], [156, 140, 62], [190, 176, 92]],
    profile: (t) => 1.0 - 0.9 * Math.pow(t, 0.95),
    tip: [214, 202, 128],
  },
  {
    name: 'daisy',
    ramp: [[30, 62, 30], [44, 88, 38], [62, 112, 46], [232, 236, 224], [252, 250, 238]],
    // narrow stem, then a blossom head across the top rows
    profile: (t) => (t < 0.62 ? 0.3 - 0.08 * t : 0.55 + 0.45 * Math.sin((t - 0.62) * 6.2)),
    tip: [246, 214, 96],
    blossomFrom: 0.62,
    blossomCore: [244, 198, 74],
  },
  {
    name: 'poppy',
    ramp: [[32, 58, 28], [46, 84, 34], [64, 106, 42], [186, 62, 46], [226, 96, 62]],
    profile: (t) => (t < 0.66 ? 0.26 - 0.06 * t : 0.5 + 0.5 * Math.sin((t - 0.66) * 5.6)),
    tip: [244, 138, 88],
    blossomFrom: 0.66,
    blossomCore: [88, 34, 40],
  },
];

export const BLADE_VARIANT_INDEX = {
  grass: [0, 1, 2, 3],
  flower: [4, 5],
};

/**
 * RGB = dithered colour bands. A = half-width silhouette profile for that row.
 * Size: (spriteW * variants) x spriteH.
 */
export function createBladeAtlas() {
  const sw = GRASS.spriteW;
  const sh = GRASS.spriteH;
  const variants = BLADE_SPRITES.length;
  const w = sw * variants;
  const data = new Uint8Array(w * sh * 4);

  for (let v = 0; v < variants; v += 1) {
    const sprite = BLADE_SPRITES[v];
    for (let y = 0; y < sh; y += 1) {
      const t = sh > 1 ? y / (sh - 1) : 0;
      const halfWidth = Math.max(0.1, Math.min(1, sprite.profile(t)));
      const inBlossom = sprite.blossomFrom !== undefined && t >= sprite.blossomFrom;

      for (let x = 0; x < sw; x += 1) {
        // Cylindrical shading across the blade: edges read a shade darker.
        const cx = (x + 0.5) / sw - 0.5;
        const edge = 1.0 - Math.pow(Math.abs(cx) * 2.0, 2.2) * 0.42;
        let ramp = t * 0.94 + 0.06;
        ramp *= edge;

        let rgb = ditherRamp(sprite.ramp, ramp, x, y);

        if (t > 0.9 && !inBlossom) rgb = sprite.tip;
        if (inBlossom) {
          const bt = (t - sprite.blossomFrom) / (1 - sprite.blossomFrom);
          const centre = Math.abs(cx) < 0.14 && bt > 0.18 && bt < 0.78;
          rgb = centre ? sprite.blossomCore : ditherRamp(sprite.ramp.slice(3), bt * 0.9 + 0.1, x, y);
        }

        const i = ((y * w) + (v * sw) + x) * 4;
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = Math.round(halfWidth * 255);
      }
    }
  }
  return makeTexture(data, w, sh, { srgb: true });
}

/* ------------------------------------------------------------------ *
 * Tiling ground detail masks
 * ------------------------------------------------------------------ */

/** Seamless value noise on a wrapping lattice. */
function periodicNoise(x, y, period, seed) {
  const wrap = (v) => ((v % period) + period) % period;
  const h = (ix, iy) => {
    let n = Math.imul(wrap(ix), 374761393) ^ Math.imul(wrap(iy), 668265263) ^ Math.imul(seed, 362437);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  };
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy);
  const b = h(ix + 1, iy);
  const c = h(ix, iy + 1);
  const d = h(ix + 1, iy + 1);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

function periodicFbm(x, y, period, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * periodicNoise(x * freq, y * freq, period * freq, seed + o * 977);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/**
 * One texture, four masks, sampled in world space by the ground shader:
 *   R fine turf grain, G broad patchiness, B gravel speckle, A clover tufts.
 */
export function createGroundDetail(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const period = 8;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * period;
      const v = (y / size) * period;

      const fine = periodicFbm(u * 4, v * 4, period * 4, 1301, 3);
      const broad = periodicFbm(u, v, period, 5507, 4);

      // Sparse speckles, snapped to the texel grid so they read as pixels.
      const specA = periodicNoise(u * 12, v * 12, period * 12, 7717);
      const specB = periodicNoise(u * 9 + 3.5, v * 9 - 2.5, period * 9, 3313);

      const gravel = specA > 0.82 ? Math.min(1, (specA - 0.82) / 0.14) : 0;
      const clover = specB > 0.86 ? Math.min(1, (specB - 0.86) / 0.12) : 0;

      const i = (y * size + x) * 4;
      data[i] = Math.round(Math.max(0, Math.min(1, fine)) * 255);
      data[i + 1] = Math.round(Math.max(0, Math.min(1, broad)) * 255);
      data[i + 2] = Math.round(gravel * 255);
      data[i + 3] = Math.round(clover * 255);
    }
  }
  return makeTexture(data, size, size, { srgb: false, repeat: true });
}

/* ------------------------------------------------------------------ *
 * Crate atlas: frame 0 loose crate, frame 1 crate seated on its mark
 * ------------------------------------------------------------------ */

const CRATE_WOOD = [[86, 57, 30], [112, 76, 40], [140, 98, 52], [168, 122, 68], [196, 150, 92]];
const CRATE_WOOD_LIT = [[104, 72, 38], [134, 96, 50], [166, 122, 66], [196, 150, 88], [222, 182, 118]];
const CRATE_IRON = [[62, 56, 52], [88, 82, 76], [116, 110, 102]];

export function createCrateAtlas(cell = 16) {
  const frames = 2;
  const w = cell * frames;
  const h = cell;
  const data = new Uint8Array(w * h * 4);

  for (let f = 0; f < frames; f += 1) {
    const wood = f === 0 ? CRATE_WOOD : CRATE_WOOD_LIT;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        const plankRow = Math.floor(y / 4);
        const withinPlank = y % 4;
        const grain = periodicNoise(x * 0.7 + plankRow * 5.3, y * 1.9, 32, 991 + f * 31);

        let rgb = ditherRamp(wood, 0.3 + grain * 0.55, x, y);
        if (withinPlank === 0) rgb = ditherRamp(wood, 0.06 + grain * 0.16, x, y); // plank seam
        if (withinPlank === 3) rgb = ditherRamp(wood, 0.62 + grain * 0.3, x, y);  // lit edge

        // Iron banding on the frame border and two rivet columns.
        const border = x === 0 || x === cell - 1 || y === 0 || y === h - 1;
        const bandRow = y === 3 || y === h - 4;
        const rivet = (x === 2 || x === cell - 3) && bandRow;
        if (border) rgb = ditherRamp(CRATE_IRON, 0.25 + grain * 0.3, x, y);
        if (bandRow && !border) rgb = ditherRamp(CRATE_IRON, 0.45 + grain * 0.35, x, y);
        if (rivet) rgb = [188, 182, 170];

        // Frame 1 carries a carved chevron mark, so a settled crate reads
        // differently from a loose one without changing its silhouette.
        if (f === 1) {
          const cx = x - (cell - 1) / 2;
          const cy = y - (h - 1) / 2;
          const chev = Math.abs(Math.abs(cx) - Math.abs(cy)) < 0.9 && Math.abs(cx) < 4.5 && Math.abs(cy) < 4.5;
          if (chev) rgb = [242, 214, 140];
        }

        const i = ((y * w) + (f * cell) + x) * 4;
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
      }
    }
  }
  return makeTexture(data, w, h, { srgb: true });
}

/* ------------------------------------------------------------------ *
 * Goal decal: a carved chalk ring laid flat on the mown plot
 * ------------------------------------------------------------------ */

export function createGoalDecal(size = 32) {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  const chalk = [[214, 206, 176], [236, 230, 200], [250, 246, 224]];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.sqrt(dx * dx + dy * dy) / (size * 0.5);
      const ang = Math.atan2(dy, dx);
      const wobble = 0.035 * Math.sin(ang * 7.0) + 0.02 * Math.sin(ang * 3.0 + 1.1);

      const ringOuter = 0.86 + wobble;
      const ringInner = 0.66 + wobble;
      const crossArm = (Math.abs(dx) < 1.6 && Math.abs(dy) < size * 0.22)
        || (Math.abs(dy) < 1.6 && Math.abs(dx) < size * 0.22);

      let a = 0;
      let rgb = chalk[1];
      if (r < ringOuter && r > ringInner) {
        a = 1;
        rgb = ditherRamp(chalk, 0.25 + (r - ringInner) / Math.max(1e-3, ringOuter - ringInner), x, y);
      } else if (crossArm) {
        a = 1;
        rgb = chalk[0];
      }
      // Break the ring into dashes for a hand-marked feel.
      if (a > 0 && !crossArm) {
        const dash = Math.floor((ang + Math.PI) / (Math.PI / 9)) % 2;
        if (dash === 1) a = 0;
      }

      const i = (y * size + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = a > 0 ? 255 : 0;
    }
  }
  return makeTexture(data, size, size, { srgb: true });
}

/* ------------------------------------------------------------------ *
 * Lazy singletons
 * ------------------------------------------------------------------ */

let _blade = null;
let _detail = null;
let _crate = null;
let _goal = null;

export const textures = {
  get blade() {
    if (!_blade) _blade = createBladeAtlas();
    return _blade;
  },
  get detail() {
    if (!_detail) _detail = createGroundDetail(128);
    return _detail;
  },
  get crate() {
    if (!_crate) _crate = createCrateAtlas(16);
    return _crate;
  },
  get goal() {
    if (!_goal) _goal = createGoalDecal(32);
    return _goal;
  },
  variantCount: BLADE_SPRITES.length,
};
