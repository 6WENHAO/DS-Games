/**
 * SALTWAKE — hand-authored low-resolution textures.
 *
 * Everything is written texel by texel into byte arrays: no image files, no
 * canvas filters, no procedural-noise-as-texture shortcuts standing in for art.
 * Each tile is designed the way a 1997 artist would have drawn a 64x64 wall —
 * a four or five colour ramp, hard dithered transitions, hand-placed damage and
 * one or two accent details so the tile reads at a glance.
 *
 * World surfaces share one 256x256 atlas of sixteen 64x64 tiles, which is what
 * lets the entire level draw in a single call. Tiling across a large wall is done
 * in the shader with fract() against a per-face tile rect, with a half-texel
 * inset so neighbouring tiles never bleed.
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Painting helpers
 * ------------------------------------------------------------------ */

/** Deterministic PRNG: the atlas is identical on every load. */
function rng(seed) {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13; s |= 0;
    s ^= s >>> 17;
    s ^= s << 5; s |= 0;
    return (s >>> 0) / 4294967296;
  };
}

const BAYER = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));
const bayer = (x, y) => BAYER[y & 3][x & 3];

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** Pick from a ramp with ordered dithering between the two nearest entries. */
function ramp(colors, t, x, y) {
  const s = Math.max(0, Math.min(1, t)) * (colors.length - 1);
  const i = Math.floor(s);
  const f = s - i;
  return colors[Math.min(colors.length - 1, i + (bayer(x, y) < f ? 1 : 0))];
}

function shade(color, k) {
  return [
    Math.max(0, Math.min(255, Math.round(color[0] * k))),
    Math.max(0, Math.min(255, Math.round(color[1] * k))),
    Math.max(0, Math.min(255, Math.round(color[2] * k))),
  ];
}

/** Tileable value noise on a wrapping lattice. */
function makeNoise(period, seed) {
  const r = rng(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i += 1) grid[i] = r();
  const at = (x, y) => grid[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  return (x, y) => {
    const ix = Math.floor(x); const iy = Math.floor(y);
    const fx = x - ix; const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = at(ix, iy); const b = at(ix + 1, iy);
    const cc = at(ix, iy + 1); const d = at(ix + 1, iy + 1);
    return (a + (b - a) * ux) + ((cc + (d - cc) * ux) - (a + (b - a) * ux)) * uy;
  };
}

/* ------------------------------------------------------------------ *
 * World atlas tiles. Each painter fills one 64x64 tile.
 * ------------------------------------------------------------------ */

const TILE = 64;

/** Horizontal planking with gaps, nail heads and water staining up from below. */
function paintPlanks(px, palette, seed) {
  const r = rng(seed);
  const n = makeNoise(16, seed + 3);
  const cols = palette.map(hex);
  const plankH = 9;
  const offsets = [];
  for (let i = 0; i < 8; i += 1) offsets.push(r());
  return (x, y) => {
    const row = Math.floor(y / plankH);
    const withinRow = y - row * plankH;
    const grain = n(x * 0.22 + row * 4.1, y * 0.9) * 0.55 + n(x * 0.9, y * 0.3) * 0.45;
    let t = 0.30 + grain * 0.5 + offsets[row % 8] * 0.16;
    // Wet rot climbing from the bottom of the tile.
    const wet = Math.max(0, 1 - y / 46);
    t -= wet * 0.30;
    if (withinRow === 0) t -= 0.42;                    // the gap between boards
    if (withinRow === plankH - 1) t += 0.14;           // lit top edge
    let c = ramp(cols, t, x, y);
    // Nails at plank ends.
    const nailCol = (x % 27 === 4 || x % 27 === 23);
    if (nailCol && withinRow === 4) c = shade(cols[cols.length - 1], 1.25);
    // Knot holes.
    if (n(x * 0.5 + 11, y * 0.5 + 3) > 0.88) c = shade(cols[0], 0.55);
    px(x, y, c);
  };
}

/** Running-bond brick with blown mortar and salt bloom. */
function paintBrick(px, palette, seed, mortarHex) {
  const r = rng(seed);
  const n = makeNoise(16, seed + 7);
  const cols = palette.map(hex);
  const mortar = hex(mortarHex);
  const bw = 16;
  const bh = 8;
  const jitter = [];
  for (let i = 0; i < 64; i += 1) jitter.push(r());
  return (x, y) => {
    const row = Math.floor(y / bh);
    const shift = (row % 2) * (bw / 2);
    const bx = Math.floor((x + shift) / bw);
    const inX = (x + shift) - bx * bw;
    const inY = y - row * bh;
    const id = (row * 7 + bx * 13) & 63;

    if (inX === 0 || inY === 0) {
      // Mortar, eaten away in places.
      const gone = n(x * 0.7, y * 0.7) > 0.72;
      px(x, y, gone ? shade(cols[0], 0.6) : shade(mortar, 0.8 + n(x, y) * 0.4));
      return;
    }
    let t = 0.30 + jitter[id] * 0.42 + n(x * 0.35, y * 0.55) * 0.24;
    // Salt bloom near the mortar lines.
    const nearMortar = Math.min(inX, inY, bw - inX, bh - inY);
    if (nearMortar <= 1 && n(x * 1.3 + 5, y * 1.3) > 0.6) t += 0.34;
    // A few cracked bricks.
    if (jitter[(id + 9) & 63] > 0.93 && inY === Math.floor(bh / 2)) t -= 0.3;
    px(x, y, ramp(cols, t, x, y));
  };
}

/** Sea-worn blocks under a crust of barnacles and weed. */
function paintBarnacle(px, seed) {
  const n = makeNoise(16, seed);
  const n2 = makeNoise(32, seed + 21);
  const stone = ['#22302e', '#33423d', '#465650', '#5d6d63', '#77857a'].map(hex);
  const shell = ['#8d8a76', '#b3ae94', '#d3ccae'].map(hex);
  const weed = ['#1b2a1c', '#263a20', '#35502b'].map(hex);
  return (x, y) => {
    const block = Math.floor(x / 21) * 3 + Math.floor(y / 21) * 7;
    const inX = x % 21;
    const inY = y % 21;
    if (inX === 0 || inY === 0) { px(x, y, shade(stone[0], 0.7)); return; }
    let t = 0.28 + n(x * 0.3, y * 0.3) * 0.5 + ((block % 5) / 5) * 0.18;
    let c = ramp(stone, t, x, y);
    // Barnacle clusters: small rings.
    const b = n2(x * 0.9, y * 0.9);
    if (b > 0.78) {
      const ring = ((x * 3 + y * 5) % 7) < 4;
      c = ramp(shell, ring ? 0.85 : 0.35, x, y);
    }
    // Weed hanging from the top of each block.
    if (inY < 6 && n(x * 1.6, y * 0.6 + 9) > 0.62 - inY * 0.05) c = ramp(weed, n(x, y), x, y);
    px(x, y, c);
  };
}

/** Riveted iron plate, rust blooming from the seams. */
function paintIron(px, seed) {
  const n = makeNoise(16, seed);
  const iron = ['#1d2427', '#2c3539', '#3e484c', '#525d60', '#6b7679'].map(hex);
  const rust = ['#3a2013', '#5b2f16', '#7d451f', '#9c5f2c'].map(hex);
  return (x, y) => {
    const px32 = Math.floor(x / 32);
    const py32 = Math.floor(y / 32);
    const inX = x % 32;
    const inY = y % 32;
    const seam = inX === 0 || inY === 0 || inX === 31 || inY === 31;
    let t = 0.42 + n(x * 0.25, y * 0.25) * 0.30;
    let c = ramp(iron, t, x, y);
    if (seam) c = ramp(iron, 0.15, x, y);
    // Rivets inset from each corner.
    const rv = (inX === 4 || inX === 27) && (inY === 4 || inY === 27);
    if (rv) c = ramp(iron, 0.95, x, y);
    // Rust creeping out of the seams and around the rivets.
    const rustAmount = n(x * 0.5 + py32 * 3, y * 0.5 + px32 * 5);
    const nearSeam = Math.min(inX, inY, 31 - inX, 31 - inY) < 5;
    if (rustAmount > (nearSeam ? 0.48 : 0.76)) c = ramp(rust, rustAmount, x, y);
    px(x, y, c);
  };
}

/** Glazed sewer tile, half of it lost to slime. */
function paintSewerTile(px, seed) {
  const n = makeNoise(16, seed);
  const tile = ['#22302f', '#33443f', '#46564d', '#5b6a5c'].map(hex);
  const slime = ['#17251a', '#22361f', '#31491f', '#415a24'].map(hex);
  return (x, y) => {
    const inX = x % 8;
    const inY = y % 8;
    const grout = inX === 0 || inY === 0;
    let t = 0.4 + n(x * 0.4, y * 0.4) * 0.3;
    let c = grout ? ramp(tile, 0.12, x, y) : ramp(tile, t, x, y);
    if (!grout && (inX === 1 || inY === 1)) c = ramp(tile, t + 0.25, x, y);   // glaze highlight
    // Slime sheeting down from the top.
    const s = n(x * 0.6, y * 0.25 + 3) + (1 - y / 64) * 0.45;
    if (s > 0.78) c = ramp(slime, n(x * 1.1, y * 1.1), x, y);
    px(x, y, c);
  };
}

/** Cyclopean ruin: enormous dressed blocks with carved channels. */
function paintRuin(px, seed) {
  const n = makeNoise(16, seed);
  const stone = ['#232526', '#34383a', '#474c4c', '#5c6260', '#767b74'].map(hex);
  return (x, y) => {
    const inX = x % 32;
    const inY = y % 64;
    const joint = inX < 2 || inY < 2;
    let t = 0.30 + n(x * 0.18, y * 0.18) * 0.42;
    let c = joint ? ramp(stone, 0.10, x, y) : ramp(stone, t, x, y);
    // Carved channel running the height of each block, a hand's width in.
    if (!joint && (inX === 8 || inX === 9 || inX === 22 || inX === 23)) c = ramp(stone, t - 0.32, x, y);
    // Angular glyph strokes, sparse, never repeating within a block.
    const gx = Math.floor(inX / 4);
    const gy = Math.floor(inY / 6);
    if (!joint && n(gx * 3.3 + 0.5, gy * 5.1 + 0.5) > 0.83) {
      const stroke = ((inX + inY) % 5) < 2;
      if (stroke) c = ramp(stone, t + 0.34, x, y);
    }
    px(x, y, c);
  };
}

/** The other-dimensional surface: a wall that is not masonry. */
function paintFlesh(px, seed) {
  const n = makeNoise(16, seed);
  const n2 = makeNoise(32, seed + 5);
  const cols = ['#1a0f12', '#2b171a', '#3f2124', '#572c2c', '#6f3b34', '#8a5040'].map(hex);
  return (x, y) => {
    // Concentric welts, offset so they never form a clean ring.
    const cx = x - 32 + Math.sin(y * 0.12) * 6;
    const cy = y - 32 + Math.cos(x * 0.1) * 5;
    const rad = Math.sqrt(cx * cx + cy * cy);
    const welt = Math.sin(rad * 0.55 + n(x * 0.2, y * 0.2) * 3.0);
    let t = 0.35 + welt * 0.22 + n2(x * 0.35, y * 0.35) * 0.3;
    let c = ramp(cols, t, x, y);
    // Pores.
    if (n2(x * 1.4 + 7, y * 1.4) > 0.87) c = shade(cols[0], 0.7);
    // Wet highlights on the crest of each welt.
    if (welt > 0.82) c = shade(cols[cols.length - 1], 1.12);
    px(x, y, c);
  };
}

/** Choir tapestry: sailcloth stitched with a repeated sigil. */
function paintTapestry(px, seed) {
  const n = makeNoise(16, seed);
  const cloth = ['#1c1a16', '#2b2620', '#3b342a', '#4b4133'].map(hex);
  const thread = ['#5c4a1e', '#8a6c26', '#b08a32'].map(hex);
  return (x, y) => {
    const weave = ((x + y) % 2) * 0.12 + ((x % 4 < 2) ? 0.06 : 0);
    let t = 0.35 + n(x * 0.3, y * 0.3) * 0.3 + weave;
    let c = ramp(cloth, t, x, y);
    // The sigil: an eye-slit inside a broken circle, stitched every 32 px.
    const sx = (x % 32) - 16;
    const sy = (y % 32) - 16;
    const rad = Math.sqrt(sx * sx + sy * sy);
    const ang = Math.atan2(sy, sx);
    const brokenCircle = rad > 9.5 && rad < 11.5 && Math.abs(Math.sin(ang * 3.0)) > 0.35;
    const slit = Math.abs(sy) < 1.5 && Math.abs(sx) < 7 && rad > 2.0;
    const pupil = rad < 2.0;
    if (brokenCircle || slit || pupil) c = ramp(thread, pupil ? 0.1 : 0.8, x, y);
    // Frayed vertical tears.
    if (n(x * 2.2, y * 0.2 + 13) > 0.90) c = shade(cloth[0], 0.5);
    px(x, y, c);
  };
}

/** Wet cobbles, standing water in the joints. */
function paintCobbles(px, seed) {
  const n = makeNoise(16, seed);
  const stone = ['#1d2422', '#2c3531', '#3d4741', '#4f5a51', '#636d60'].map(hex);
  const water = ['#16241f', '#1d3129', '#274036'].map(hex);
  return (x, y) => {
    // Offset rows of rounded stones.
    const row = Math.floor(y / 8);
    const shift = (row % 2) * 4;
    const cxi = Math.floor((x + shift) / 8);
    const lx = (x + shift) - cxi * 8 - 3.5;
    const ly = y - row * 8 - 3.5;
    const rad = Math.sqrt(lx * lx + ly * ly * 1.15);
    const id = (row * 11 + cxi * 5) & 31;
    if (rad > 3.6) {
      // Joint: holds water.
      const w = n(x * 0.6, y * 0.6);
      px(x, y, ramp(water, w, x, y));
      return;
    }
    let t = 0.28 + (id / 31) * 0.34 + n(x * 0.5, y * 0.5) * 0.24;
    // Domed lighting on each stone.
    t += (1 - rad / 3.6) * 0.24;
    px(x, y, ramp(stone, t, x, y));
  };
}

/** Sewer floor: a channel of moving sludge between wet ledges. */
function paintSludge(px, seed) {
  const n = makeNoise(16, seed);
  const ledge = ['#1e2622', '#2c352e', '#3b453a'].map(hex);
  const sludge = ['#1a1d10', '#282c14', '#3a3d18', '#4d4c1d'].map(hex);
  return (x, y) => {
    const inChannel = x > 14 && x < 50;
    if (!inChannel) {
      const t = 0.3 + n(x * 0.5, y * 0.5) * 0.4;
      px(x, y, ramp(ledge, t, x, y));
      return;
    }
    // Streaks that run along the channel.
    const streak = n(x * 0.9, y * 0.16) * 0.7 + n(x * 0.3, y * 0.05) * 0.3;
    let c = ramp(sludge, streak, x, y);
    // Scum bubbles.
    if (n(x * 1.7 + 3, y * 1.7) > 0.9) c = shade(sludge[sludge.length - 1], 1.15);
    px(x, y, c);
  };
}

/** Ritual mosaic: a circle of glyphs around a drain. */
function paintMosaic(px, seed) {
  const n = makeNoise(16, seed);
  const base = ['#1a1a1d', '#282a2c', '#383a39', '#494a45'].map(hex);
  const gold = ['#4a3712', '#77571d', '#a67c2a', '#cf9f3f'].map(hex);
  const blood = ['#2a0b08', '#4a1410', '#6d2016'].map(hex);
  return (x, y) => {
    const cx = x - 32;
    const cy = y - 32;
    const rad = Math.sqrt(cx * cx + cy * cy);
    const ang = Math.atan2(cy, cx);
    let c = ramp(base, 0.3 + n(x * 0.4, y * 0.4) * 0.4, x, y);
    // Tessera grid.
    if (x % 4 === 0 || y % 4 === 0) c = shade(c, 0.78);
    // Two concentric inscribed rings.
    if ((rad > 25 && rad < 27) || (rad > 17 && rad < 18.5)) c = ramp(gold, 0.7, x, y);
    // Radial glyph ticks between the rings.
    if (rad > 18.5 && rad < 25 && Math.abs(Math.sin(ang * 8.0)) > 0.93) c = ramp(gold, 0.9, x, y);
    // The drain at the centre, and what has run into it.
    if (rad < 5) c = shade(base[0], 0.4);
    if (rad >= 5 && rad < 8 && n(x * 1.2, y * 1.2) > 0.4) c = ramp(blood, n(x, y), x, y);
    px(x, y, c);
  };
}

/** Tidal silt with shell fragments and drag marks. */
function paintSilt(px, seed) {
  const n = makeNoise(16, seed);
  const silt = ['#20241f', '#2e3227', '#3d412f', '#4d5039', '#5e6044'].map(hex);
  const shell = ['#8b8672', '#b6b096'].map(hex);
  return (x, y) => {
    // Ripples left by the outgoing tide.
    const ripple = Math.sin(y * 0.5 + n(x * 0.2, y * 0.1) * 4.0) * 0.16;
    let t = 0.35 + n(x * 0.35, y * 0.35) * 0.36 + ripple;
    let c = ramp(silt, t, x, y);
    if (n(x * 1.9 + 5, y * 1.9) > 0.93) c = ramp(shell, n(x, y), x, y);
    px(x, y, c);
  };
}

/** Ceiling: sagging beams with boards between. */
function paintBeams(px, seed) {
  const n = makeNoise(16, seed);
  const wood = ['#151310', '#221d17', '#302720', '#3e332a'].map(hex);
  return (x, y) => {
    const beam = (x % 21) < 6;
    let t = 0.3 + n(x * 0.4, y * 0.3) * 0.35;
    if (beam) t -= 0.2;
    let c = ramp(wood, t, x, y);
    if (beam && (x % 21) === 0) c = shade(wood[0], 0.6);
    if (!beam && y % 8 === 0) c = shade(c, 0.7);
    px(x, y, c);
  };
}

/** Ceiling: dripping vault stone. */
function paintVault(px, seed) {
  const n = makeNoise(16, seed);
  const stone = ['#161a1a', '#232827', '#313634', '#3f4441'].map(hex);
  return (x, y) => {
    const inX = x % 16;
    const inY = y % 16;
    const joint = inX === 0 || inY === 0;
    let t = 0.3 + n(x * 0.3, y * 0.3) * 0.4;
    let c = joint ? ramp(stone, 0.1, x, y) : ramp(stone, t, x, y);
    // Damp patches that will be dripping.
    if (n(x * 0.25 + 9, y * 0.25) > 0.7) c = shade(c, 0.72);
    px(x, y, c);
  };
}

/** Brass door: plate, hinges, a keyway and an engraved band. */
function paintBrassDoor(px, seed) {
  const n = makeNoise(16, seed);
  const brass = ['#2c2110', '#4a381a', '#6d5325', '#957233', '#c39a4a'].map(hex);
  return (x, y) => {
    const border = x < 4 || x > 59 || y < 4 || y > 59;
    let t = 0.4 + n(x * 0.3, y * 0.3) * 0.28;
    let c = ramp(brass, border ? 0.72 : t, x, y);
    // Vertical stiles.
    if (x === 20 || x === 43) c = ramp(brass, 0.2, x, y);
    // Engraved band across the middle.
    if (y > 28 && y < 36) {
      const engrave = Math.abs(Math.sin(x * 0.6)) > 0.5;
      c = ramp(brass, engrave ? 0.85 : 0.3, x, y);
    }
    // Hinges on the left, keyway on the right.
    if (x < 8 && ((y > 10 && y < 18) || (y > 46 && y < 54))) c = ramp(brass, 0.15, x, y);
    const kx = x - 50;
    const ky = y - 46;
    if (kx * kx + ky * ky < 9) c = shade(brass[0], 0.5);
    // Verdigris in the low corners.
    if (n(x * 0.5, y * 0.5 + 11) > 0.84 && y > 40) c = [42, 74, 60];
    px(x, y, c);
  };
}

/** Bone door: lashed ribs over a dark gap, with a socket for the bone key. */
function paintBoneDoor(px, seed) {
  const n = makeNoise(16, seed);
  const bone = ['#3a3628', '#5b5540', '#7d7458', '#a39875', '#c8bc95'].map(hex);
  const dark = hex('#0d0f0c');
  return (x, y) => {
    // Ribs: vertical tapering shafts with dark gaps between.
    const period = 11;
    const inX = x % period;
    const centre = Math.abs(inX - 5) / 5;
    const taper = 0.55 + 0.45 * Math.sin((y / 63) * Math.PI);
    let c;
    if (centre < taper) {
      const t = 0.35 + (1 - centre / Math.max(taper, 0.001)) * 0.42 + n(x * 0.5, y * 0.5) * 0.18;
      c = ramp(bone, t, x, y);
    } else {
      c = dark;
    }
    // Lashings across the ribs at three heights.
    if (y % 22 < 3) {
      const lash = ramp(['#241c12', '#3a2c1a', '#4f3c22'].map(hex), n(x, y), x, y);
      c = lash;
    }
    // The socket the bone key turns in.
    const kx = x - 32;
    const ky = y - 32;
    const rad = Math.sqrt(kx * kx + ky * ky);
    if (rad < 7) c = rad < 3.5 ? dark : ramp(bone, 0.9, x, y);
    px(x, y, c);
  };
}

const WORLD_TILES = [
  { name: 'dockPlanks', paint: (px) => paintPlanks(px, ['#171310', '#241c15', '#33261b', '#453320', '#5a4429'], 101) },
  { name: 'wetBrick', paint: (px) => paintBrick(px, ['#241611', '#33201a', '#452c22', '#573a2c'], 211, '#3d3a33') },
  { name: 'barnacle', paint: (px) => paintBarnacle(px, 307) },
  { name: 'iron', paint: (px) => paintIron(px, 401) },
  { name: 'sewerTile', paint: (px) => paintSewerTile(px, 503) },
  { name: 'ruin', paint: (px) => paintRuin(px, 601) },
  { name: 'flesh', paint: (px) => paintFlesh(px, 701) },
  { name: 'tapestry', paint: (px) => paintTapestry(px, 809) },
  { name: 'cobbles', paint: (px) => paintCobbles(px, 907) },
  { name: 'sludge', paint: (px) => paintSludge(px, 1009) },
  { name: 'mosaic', paint: (px) => paintMosaic(px, 1103) },
  { name: 'silt', paint: (px) => paintSilt(px, 1201) },
  { name: 'beams', paint: (px) => paintBeams(px, 1301) },
  { name: 'vault', paint: (px) => paintVault(px, 1409) },
  { name: 'brassDoor', paint: (px) => paintBrassDoor(px, 1501) },
  { name: 'boneDoor', paint: (px) => paintBoneDoor(px, 1601) },
];

/** Tile name -> atlas index, exported for the level data to reference by name. */
export const TILES = {};
WORLD_TILES.forEach((t, i) => { TILES[t.name] = i; });

const ATLAS_COLS = 4;
const ATLAS_SIZE = TILE * ATLAS_COLS;

/**
 * The packed world atlas.
 * @returns {{texture: THREE.Texture, rects: Float32Array, cols: number, tile: number}}
 *   rects holds [offsetU, offsetV, scaleU, scaleV] per tile, half-texel inset.
 */
export function createWorldAtlas() {
  const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  const rects = new Float32Array(WORLD_TILES.length * 4);
  const inset = 0.5 / ATLAS_SIZE;

  WORLD_TILES.forEach((tile, index) => {
    const tx = (index % ATLAS_COLS) * TILE;
    const ty = Math.floor(index / ATLAS_COLS) * TILE;
    const put = (x, y, rgb) => {
      const i = (((ty + y) * ATLAS_SIZE) + (tx + x)) * 4;
      data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
    };
    const painter = tile.paint(put);
    for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) painter(x, y);

    rects[index * 4] = tx / ATLAS_SIZE + inset;
    rects[index * 4 + 1] = ty / ATLAS_SIZE + inset;
    rects[index * 4 + 2] = TILE / ATLAS_SIZE - inset * 2;
    rects[index * 4 + 3] = TILE / ATLAS_SIZE - inset * 2;
  });

  const texture = new THREE.DataTexture(data, ATLAS_SIZE, ATLAS_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return { texture, rects, cols: ATLAS_COLS, tile: TILE, size: ATLAS_SIZE, count: WORLD_TILES.length };
}

/* ------------------------------------------------------------------ *
 * Billboard sprite atlas: alpha-cut vegetation, fire, smoke, props
 * ------------------------------------------------------------------ */

const SPRITE = 32;

/** Vertical reeds with a bend, alpha-cut. */
function spriteReeds(seed) {
  const r = rng(seed);
  const stalks = [];
  for (let i = 0; i < 7; i += 1) {
    stalks.push({ x: 3 + r() * 26, bend: (r() - 0.5) * 7, h: 18 + r() * 13, w: r() > 0.6 ? 2 : 1 });
  }
  const greens = ['#1b2a18', '#263a1e', '#35502a', '#496a34', '#5f8340'].map(hex);
  return (x, y) => {
    // y = 0 is the base of the sprite.
    for (const s of stalks) {
      const t = y / s.h;
      if (t > 1) continue;
      const sx = s.x + s.bend * t * t;
      if (Math.abs(x - sx) <= s.w * (1 - t * 0.55)) {
        return [...ramp(greens, 0.25 + t * 0.6 + (x < sx ? 0.12 : -0.08), x, y), 255];
      }
    }
    return [0, 0, 0, 0];
  };
}

/** Dead brittle weeds, splayed. */
function spriteWeeds(seed) {
  const r = rng(seed);
  const arms = [];
  for (let i = 0; i < 9; i += 1) {
    const a = (r() - 0.5) * 1.5;
    arms.push({ a, h: 10 + r() * 14 });
  }
  const dry = ['#2b2418', '#3d3320', '#544527', '#6d5a30'].map(hex);
  return (x, y) => {
    for (const s of arms) {
      const t = y / s.h;
      if (t > 1) continue;
      const sx = 16 + Math.sin(s.a) * s.h * t * 0.9;
      if (Math.abs(x - sx) <= 1) return [...ramp(dry, 0.3 + t * 0.55, x, y), 255];
    }
    return [0, 0, 0, 0];
  };
}

/** Torn seagrass tuft, wide and low. */
function spriteSeagrass(seed) {
  const r = rng(seed);
  const blades = [];
  for (let i = 0; i < 11; i += 1) blades.push({ x: 2 + r() * 28, bend: (r() - 0.5) * 12, h: 8 + r() * 11 });
  const cols = ['#16241a', '#20351e', '#2d4a22', '#3c5f28'].map(hex);
  return (x, y) => {
    for (const s of blades) {
      const t = y / s.h;
      if (t > 1) continue;
      const sx = s.x + s.bend * t * t;
      if (Math.abs(x - sx) <= 1) return [...ramp(cols, 0.2 + t * 0.6, x, y), 255];
    }
    return [0, 0, 0, 0];
  };
}

/** Flame: a hot core with a ragged, alpha-cut edge. */
function spriteFlame(seed) {
  const n = makeNoise(16, seed);
  const cols = ['#5c1a06', '#9c3a08', '#c96a12', '#e8a02a', '#f7d268', '#fdf0c0'].map(hex);
  return (x, y) => {
    const t = y / 30;
    if (t > 1) return [0, 0, 0, 0];
    // The flame narrows and wavers as it rises.
    const wobble = (n(y * 0.28, 3.5) - 0.5) * 9 * t;
    const halfW = (11 - t * 9.0) * (0.7 + n(y * 0.2, 8.0) * 0.5);
    const dx = Math.abs(x - (16 + wobble));
    if (dx > halfW) return [0, 0, 0, 0];
    // Hot at the base and the centre, cooler at the tips.
    const heat = (1 - t * 0.75) * (1 - (dx / Math.max(halfW, 0.001)) * 0.55);
    return [...ramp(cols, heat, x, y), 255];
  };
}

/** Smoke puff: soft round mass, dithered alpha edge. */
function spriteSmoke(seed) {
  const n = makeNoise(16, seed);
  const cols = ['#15181a', '#23282a', '#333a3b', '#454b4a'].map(hex);
  return (x, y) => {
    const cx = x - 16;
    const cy = y - 16;
    const rad = Math.sqrt(cx * cx + cy * cy) / 15;
    const lumps = n(x * 0.18, y * 0.18) * 0.45;
    const edge = rad - lumps;
    if (edge > 1) return [0, 0, 0, 0];
    // Dithered alpha rather than a soft gradient: era-correct cutout.
    const a = 1 - edge;
    if (bayer(x, y) > a * 1.15) return [0, 0, 0, 0];
    return [...ramp(cols, 0.75 - rad * 0.6, x, y), 255];
  };
}

/** Hanging fishing net, a lattice with weights. */
function spriteNet(seed) {
  const r = rng(seed);
  const sag = [];
  for (let i = 0; i < 32; i += 1) sag.push(r() * 2);
  const cols = ['#2a2418', '#3c3323', '#51452d'].map(hex);
  return (x, y) => {
    const yy = y + sag[x] | 0;
    const knot = (x % 4 === 0) || (yy % 4 === 0);
    if (!knot) return [0, 0, 0, 0];
    if (y > 27) return [0, 0, 0, 0];
    const isKnotPoint = (x % 4 === 0) && (yy % 4 === 0);
    return [...ramp(cols, isKnotPoint ? 0.85 : 0.4, x, y), 255];
  };
}

/** A figure standing in the fog, deliberately unresolvable. */
function spriteFigure(seed) {
  const n = makeNoise(16, seed);
  const cols = ['#0d1213', '#161d1e', '#202829'].map(hex);
  return (x, y) => {
    const t = y / 31;
    // Shoulders, then a head; no features at all.
    const bodyW = t < 0.72 ? 5 + Math.sin(t * 3.0) * 2.2 : 2.6;
    const dx = Math.abs(x - 16);
    if (dx > bodyW) return [0, 0, 0, 0];
    if (t > 0.9) return [0, 0, 0, 0];
    // Edge dissolves into the fog.
    const a = 1 - (dx / Math.max(bodyW, 0.001)) * 0.35;
    if (bayer(x, y) > a) return [0, 0, 0, 0];
    return [...ramp(cols, 0.3 + n(x * 0.4, y * 0.4) * 0.5, x, y), 255];
  };
}

/** Ritual candle with a lit wick. */
function spriteCandle(seed) {
  const wax = ['#3a3527', '#575039', '#78704f', '#9a9066'].map(hex);
  const fire = ['#c96a12', '#e8a02a', '#fdf0c0'].map(hex);
  return (x, y) => {
    const dx = Math.abs(x - 16);
    if (y < 20) {
      if (dx > 3) return [0, 0, 0, 0];
      // Wax runs down one side.
      const run = (x === 13 && y < 14) ? 0.2 : 0;
      return [...ramp(wax, 0.4 + (3 - dx) * 0.18 - run, x, y), 255];
    }
    if (y < 22) return dx <= 0 ? [...hex('#1a1710'), 255] : [0, 0, 0, 0];
    const t = (y - 22) / 8;
    if (t > 1 || dx > 2 - t * 1.5) return [0, 0, 0, 0];
    return [...ramp(fire, 1 - t, x, y), 255];
  };
}

const SPRITES = [
  { name: 'reeds', paint: spriteReeds(11) },
  { name: 'weeds', paint: spriteWeeds(23) },
  { name: 'seagrass', paint: spriteSeagrass(37) },
  { name: 'flame', paint: spriteFlame(51) },
  { name: 'smoke', paint: spriteSmoke(67) },
  { name: 'net', paint: spriteNet(83) },
  { name: 'figure', paint: spriteFigure(97) },
  { name: 'candle', paint: spriteCandle(113) },
];

export const SPRITE_IDS = {};
SPRITES.forEach((s, i) => { SPRITE_IDS[s.name] = i; });

const SPRITE_COLS = 4;
const SPRITE_ATLAS = SPRITE * SPRITE_COLS;   // 128 x 64

/**
 * Billboard sprite atlas. Sprites are authored with y = 0 at the base so a
 * billboard can be pinned to the ground and scaled without shifting.
 */
export function createSpriteAtlas() {
  const rows = Math.ceil(SPRITES.length / SPRITE_COLS);
  const height = SPRITE * rows;
  const data = new Uint8Array(SPRITE_ATLAS * height * 4);
  const rects = new Float32Array(SPRITES.length * 4);
  const insetU = 0.5 / SPRITE_ATLAS;
  const insetV = 0.5 / height;

  SPRITES.forEach((sprite, index) => {
    const tx = (index % SPRITE_COLS) * SPRITE;
    const ty = Math.floor(index / SPRITE_COLS) * SPRITE;
    for (let y = 0; y < SPRITE; y += 1) {
      for (let x = 0; x < SPRITE; x += 1) {
        const rgba = sprite.paint(x, y) || [0, 0, 0, 0];
        // Flip vertically into the atlas so v = 0 is the sprite's base.
        const i = (((ty + (SPRITE - 1 - y)) * SPRITE_ATLAS) + (tx + x)) * 4;
        data[i] = rgba[0]; data[i + 1] = rgba[1]; data[i + 2] = rgba[2]; data[i + 3] = rgba[3];
      }
    }
    rects[index * 4] = tx / SPRITE_ATLAS + insetU;
    rects[index * 4 + 1] = ty / height + insetV;
    rects[index * 4 + 2] = SPRITE / SPRITE_ATLAS - insetU * 2;
    rects[index * 4 + 3] = SPRITE / height - insetV * 2;
  });

  const texture = new THREE.DataTexture(data, SPRITE_ATLAS, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, rects, count: SPRITES.length, size: SPRITE, atlasWidth: SPRITE_ATLAS, atlasHeight: height };
}

/* ------------------------------------------------------------------ *
 * Lazy singletons
 * ------------------------------------------------------------------ */

let _world = null;
let _sprites = null;

export const textures = {
  get world() {
    if (!_world) _world = createWorldAtlas();
    return _world;
  },
  get sprites() {
    if (!_sprites) _sprites = createSpriteAtlas();
    return _sprites;
  },
};
