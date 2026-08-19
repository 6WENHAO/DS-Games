// Procedural 16x16 pixel-art texture atlas, baked per planet palette.
// Every texture is drawn with code: no external assets. Minecraft-flavoured pixel art.

import { mulberry32 } from '../core/rng.js';

export const TILE_PX = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;

export const TILES = [
  'stone', 'cobble', 'brick', 'dirt', 'grass_top', 'grass_side', 'sand', 'sandstone',
  'gravel', 'water', 'log_side', 'log_top', 'planks', 'leaves', 'bush', 'plant_red',
  'plant_yellow', 'tuft', 'moss', 'crystal_blue', 'crystal_frost', 'salt', 'cobalt', 'ore_ferrite',
  'ore_copper', 'ore_gold', 'rock_paraffinium', 'alien_rock', 'ice', 'snow', 'glass', 'lumen',
  'metal_panel', 'metal_floor', 'basalt', 'mush_stem', 'mush_stem_top', 'mush_cap', 'cactus', 'bedrock',
  'crate_side', 'crate_top', 'refiner_side', 'refiner_top', 'computer', 'computer_top', 'beacon', 'table_top',
  'table_side',
];

export const TILE_INDEX = {};
TILES.forEach((t, i) => (TILE_INDEX[t] = i));

/* ---------------- colour helpers ---------------- */
export function hex(h) {
  return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
}
function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
export function shade(c, f) { return [clamp255(c[0] * f), clamp255(c[1] * f), clamp255(c[2] * f)]; }
export function mix(a, b, t) {
  return [clamp255(a[0] + (b[0] - a[0]) * t), clamp255(a[1] + (b[1] - a[1]) * t), clamp255(a[2] + (b[2] - a[2]) * t)];
}
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [clamp255((r + m) * 255), clamp255((g + m) * 255), clamp255((b + m) * 255)];
}

/* ---------------- tile painter ---------------- */
class Tile {
  constructor(rng) {
    this.data = new Uint8ClampedArray(TILE_PX * TILE_PX * 4);
    this.rng = rng;
  }
  set(x, y, c, a = 255) {
    if (x < 0 || y < 0 || x >= TILE_PX || y >= TILE_PX) return;
    const i = (y * TILE_PX + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = a;
  }
  get(x, y) {
    const i = (((y + TILE_PX) % TILE_PX) * TILE_PX + ((x + TILE_PX) % TILE_PX)) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  fill(c, a = 255) { for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) this.set(x, y, c, a); }
  clear() { this.data.fill(0); }
  // per-pixel brightness jitter
  grain(amount, chunk = 1) {
    const r = this.rng;
    for (let y = 0; y < TILE_PX; y += chunk) {
      for (let x = 0; x < TILE_PX; x += chunk) {
        const f = 1 + (r() - 0.5) * 2 * amount;
        for (let dy = 0; dy < chunk; dy++) for (let dx = 0; dx < chunk; dx++) {
          const p = this.get(x + dx, y + dy);
          if (p[3] === 0) continue;
          this.set(x + dx, y + dy, shade(p, f), p[3]);
        }
      }
    }
  }
  specks(n, c, a = 255) {
    const r = this.rng;
    for (let i = 0; i < n; i++) this.set((r() * TILE_PX) | 0, (r() * TILE_PX) | 0, c, a);
  }
  blob(cx, cy, rad, c, jitter = 0.4, a = 255) {
    const r = this.rng;
    for (let y = -rad - 1; y <= rad + 1; y++) {
      for (let x = -rad - 1; x <= rad + 1; x++) {
        const d = Math.hypot(x, y);
        if (d <= rad + (r() - 0.5) * 2 * jitter) this.set(cx + x, cy + y, shade(c, 0.94 + r() * 0.12), a);
      }
    }
  }
  rect(x0, y0, w, h, c, a = 255) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c, a);
  }
  line(x0, y0, x1, y1, c, a = 255) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      this.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c, a);
    }
  }
  // top edge highlight / bottom shadow, the classic MC 3D-ish look
  bevel(light = 1.12, dark = 0.86) {
    for (let x = 0; x < TILE_PX; x++) {
      const t = this.get(x, 0); if (t[3]) this.set(x, 0, shade(t, light), t[3]);
      const b = this.get(x, TILE_PX - 1); if (b[3]) this.set(x, TILE_PX - 1, shade(b, dark), b[3]);
    }
  }
}

/* ---------------- individual textures ---------------- */
const painters = {
  stone(t, P) {
    t.fill(P.stone); t.grain(0.055, 1); t.grain(0.05, 2);
    const r = t.rng;
    for (let i = 0; i < 3; i++) {
      const x = (r() * 16) | 0, y = (r() * 16) | 0;
      t.line(x, y, x + ((r() * 6) | 0) - 3, y + ((r() * 5) | 0) - 2, shade(P.stone, 0.82));
    }
    t.specks(14, shade(P.stone, 1.08));
    t.specks(10, shade(P.stone, 0.88));
  },
  cobble(t, P) {
    const mortar = shade(P.stone, 0.55);
    t.fill(mortar);
    const r = t.rng;
    const stones = [[3, 3, 3], [10, 3, 3], [4, 10, 3], [11, 10, 3], [7, 7, 2], [1, 7, 1], [14, 7, 1], [7, 14, 2], [7, 0, 2]];
    for (const [x, y, rad] of stones) {
      t.blob(x, y, rad, shade(P.stone, 0.95 + r() * 0.25), 0.6);
    }
    t.grain(0.07, 1);
  },
  brick(t, P) {
    t.fill(shade(P.stone, 0.95)); t.grain(0.04);
    const seam = shade(P.stone, 0.62);
    for (let y = 0; y < 16; y += 8) {
      t.rect(0, y, 16, 1, seam);
      const off = y === 0 ? 8 : 0;
      t.rect(off, y, 1, 8, seam);
      t.rect((off + 8) % 16, y, 1, 8, seam);
    }
    t.grain(0.05, 2);
    t.bevel(1.08, 0.9);
  },
  dirt(t, P) {
    t.fill(shade(P.dirt, 1.08)); t.grain(0.055, 1); t.grain(0.06, 2);
    t.specks(16, shade(P.dirt, 0.88));
    t.specks(14, shade(P.dirt, 1.18));
  },
  grass_top(t, P) {
    t.fill(P.grass); t.grain(0.055, 1);
    const r = t.rng;
    for (let i = 0; i < 22; i++) {
      const x = (r() * 16) | 0, y = (r() * 16) | 0;
      t.set(x, y, shade(P.grass, 0.9 + r() * 0.24));
    }
    for (let i = 0; i < 6; i++) t.blob((r() * 16) | 0, (r() * 16) | 0, 1, mix(P.grass, P.grass2, 0.8), 0.5);
    t.grain(0.05, 2);
  },
  grass_side(t, P) {
    // dirt body
    t.fill(shade(P.dirt, 1.08)); t.grain(0.055, 1); t.specks(14, shade(P.dirt, 0.9));
    // grass fringe with irregular bottom edge
    const r = t.rng;
    for (let x = 0; x < 16; x++) {
      const h = 3 + ((r() * 3) | 0);
      for (let y = 0; y < h; y++) {
        const c = y === h - 1 ? shade(P.grass, 0.9) : shade(P.grass, 0.97 + r() * 0.12);
        t.set(x, y, c);
      }
      if (r() < 0.35) t.set(x, h, shade(P.grass, 0.8));
    }
  },
  sand(t, P) { t.fill(P.sand); t.grain(0.05, 1); t.specks(26, shade(P.sand, 0.9)); t.specks(16, shade(P.sand, 1.08)); },
  sandstone(t, P) {
    t.fill(shade(P.sand, 0.94)); t.grain(0.04, 1);
    for (let y = 2; y < 16; y += 5) t.rect(0, y, 16, 1, shade(P.sand, 0.8));
    t.grain(0.04, 2); t.bevel(1.1, 0.9);
  },
  gravel(t, P) {
    t.fill(shade(P.stone, 0.8));
    const r = t.rng;
    for (let i = 0; i < 16; i++) t.blob((r() * 16) | 0, (r() * 16) | 0, 1 + ((r() * 2) | 0), shade(P.stone, 0.78 + r() * 0.45), 0.5);
    t.grain(0.09, 1);
  },
  water(t, P) {
    t.fill(P.water, 205);
    const r = t.rng;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const w = Math.sin((x * 0.9 + y * 0.5)) * 0.05 + (r() - 0.5) * 0.05;
        t.set(x, y, shade(P.water, 1 + w), 200 + ((r() * 20) | 0));
      }
    }
    for (let i = 0; i < 4; i++) {
      const y = (r() * 16) | 0;
      for (let x = 0; x < 16; x++) if (r() < 0.5) t.set(x, y, shade(P.water, 1.2), 215);
    }
  },
  log_side(t, P) {
    t.fill(P.wood); t.grain(0.05, 1);
    const r = t.rng;
    for (let x = 0; x < 16; x++) {
      if (r() < 0.34) {
        const c = shade(P.wood, 0.74 + r() * 0.16);
        for (let y = 0; y < 16; y++) if (r() < 0.9) t.set(x, y, c);
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = (r() * 16) | 0, y = (r() * 12) | 0;
      t.rect(x, y, 1, 2 + ((r() * 3) | 0), shade(P.wood, 0.62));
    }
    t.grain(0.05, 1);
  },
  log_top(t, P) {
    t.fill(shade(P.wood, 1.06));
    const cx = 8, cy = 8;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
      const ring = Math.sin(d * 2.1) * 0.5 + 0.5;
      t.set(x, y, shade(P.wood, 0.86 + ring * 0.3));
    }
    t.blob(cx, cy, 1, shade(P.wood, 0.7), 0.3);
    t.grain(0.04, 1);
  },
  planks(t, P) {
    t.fill(P.wood); t.grain(0.04, 1);
    const seam = shade(P.wood, 0.68);
    for (let y = 3; y < 16; y += 4) t.rect(0, y, 16, 1, seam);
    const r = t.rng;
    for (let band = 0; band < 4; band++) {
      const x = 1 + ((r() * 14) | 0);
      t.rect(x, band * 4, 1, 3, shade(P.wood, 0.86));
    }
    t.grain(0.035, 1);
  },
  leaves(t, P) {
    t.clear();
    const r = t.rng;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const v = r();
        if (v < 0.14) continue; // holes
        const c = v < 0.4 ? shade(P.leaf, 0.78) : v < 0.75 ? P.leaf : shade(P.leaf, 1.14);
        t.set(x, y, c, 255);
      }
    }
    for (let i = 0; i < 5; i++) t.blob((r() * 16) | 0, (r() * 16) | 0, 1, shade(P.leaf, 0.7), 0.4);
  },
  bush(t, P) {
    t.clear();
    const r = t.rng;
    // a cross-plant leafy bush silhouette
    for (let x = 2; x < 14; x++) {
      const top = 5 + Math.round(Math.sin(x * 0.7) * 2);
      for (let y = top; y < 15; y++) {
        if (r() < 0.2) continue;
        const c = y > 12 ? shade(P.leaf, 0.72) : r() < 0.4 ? shade(P.leaf, 1.15) : P.leaf;
        t.set(x, y, c);
      }
    }
    t.rect(7, 11, 2, 5, shade(P.wood, 0.85));
  },
  plant_red(t, P) {
    t.clear();
    const r = t.rng;
    const stem = mix(P.leaf, hex(0x4a6b3a), 0.5);
    t.rect(7, 7, 2, 9, stem);
    const petal = P.floraRed, petal2 = shade(P.floraRed, 1.25), core = mix(P.floraRed, [255, 240, 200], 0.6);
    const pts = [[8, 4, 3], [4, 6, 2], [12, 6, 2], [6, 2, 2], [11, 3, 2]];
    for (const [x, y, rad] of pts) t.blob(x, y, rad, r() < 0.5 ? petal : petal2, 0.5);
    t.blob(8, 4, 1, core, 0.2);
    // small leaves on stem
    t.set(6, 10, stem); t.set(5, 11, stem); t.set(10, 12, stem); t.set(11, 13, stem);
  },
  plant_yellow(t, P) {
    t.clear();
    const stem = mix(P.leaf, hex(0x5c6b34), 0.5);
    for (let y = 4; y < 16; y++) { t.set(7, y, stem); t.set(8, y, shade(stem, 0.88)); }
    const c1 = P.floraYellow, c2 = shade(P.floraYellow, 1.3);
    // spiky pod head
    for (let i = 0; i < 5; i++) {
      const x = 4 + i * 2;
      const h = 2 + (i % 2) * 2;
      for (let y = 2 + h; y < 8; y++) t.set(x, y, i % 2 ? c1 : c2);
      t.set(x, 1 + h, shade(c2, 1.1));
    }
    t.blob(8, 6, 2, c1, 0.4);
  },
  tuft(t, P) {
    t.clear();
    const r = t.rng;
    for (let i = 0; i < 9; i++) {
      const x = 2 + ((r() * 12) | 0);
      const h = 5 + ((r() * 8) | 0);
      const lean = r() < 0.5 ? -1 : 1;
      for (let k = 0; k < h; k++) {
        const y = 15 - k;
        const xx = x + Math.round((k / h) * 2) * lean;
        t.set(xx, y, shade(P.grass, 0.8 + (k / h) * 0.5));
      }
    }
  },
  moss(t, P) {
    t.clear();
    const r = t.rng;
    for (let i = 0; i < 30; i++) {
      const x = (r() * 16) | 0, y = 6 + ((r() * 10) | 0);
      t.set(x, y, mix(P.glow, [200, 255, 220], r() * 0.6));
    }
    for (let x = 0; x < 16; x++) if (r() < 0.6) t.set(x, 15, shade(P.glow, 0.8));
  },
  crystal_blue(t, P) {
    const c = P.crystal, c2 = shade(P.crystal, 1.4), cd = shade(P.crystal, 0.6);
    t.fill(cd);
    // faceted diamond shards
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const f = Math.abs(((x * 3 + y * 5) % 11) - 5) / 5;
        t.set(x, y, mix(cd, c2, f * 0.9));
      }
    }
    t.line(1, 14, 8, 1, c2); t.line(8, 1, 14, 13, mix(c, c2, 0.5));
    t.line(2, 8, 13, 6, shade(c, 1.2));
    t.grain(0.06, 1);
    t.bevel(1.25, 0.8);
  },
  crystal_frost(t, P) {
    const c = mix(P.crystal, [220, 245, 255], 0.55);
    t.fill(shade(c, 0.7));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const f = (Math.sin(x * 0.9) + Math.cos(y * 1.1)) * 0.25 + 0.5;
      t.set(x, y, mix(shade(c, 0.65), shade(c, 1.35), f));
    }
    t.line(3, 15, 9, 0, shade(c, 1.5)); t.line(9, 0, 13, 15, shade(c, 1.2));
    t.grain(0.05, 1);
  },
  salt(t, P) {
    const c = [232, 232, 240];
    t.fill(shade(c, 0.82));
    const r = t.rng;
    for (let i = 0; i < 10; i++) t.blob((r() * 16) | 0, (r() * 16) | 0, 2, shade(c, 0.9 + r() * 0.3), 0.6);
    t.grain(0.07, 1); t.bevel(1.15, 0.85);
  },
  cobalt(t, P) {
    const c = hex(0x3f6ee0);
    t.fill(shade(c, 0.55));
    const r = t.rng;
    for (let i = 0; i < 9; i++) {
      const x = (r() * 16) | 0, y = (r() * 16) | 0;
      t.blob(x, y, 1 + ((r() * 2) | 0), shade(c, 0.9 + r() * 0.7), 0.5);
    }
    t.specks(18, hex(0x9fc4ff));
    t.grain(0.06, 1);
  },
  ore_ferrite(t, P) {
    painters.stone(t, P);
    const c = hex(0xb98b5a), c2 = hex(0xe0b184);
    const r = t.rng;
    const spots = [[4, 4], [11, 5], [6, 11], [12, 12], [8, 8]];
    for (const [x, y] of spots) {
      if (r() < 0.15) continue;
      t.blob(x, y, 2, c, 0.55);
      t.set(x, y - 1, c2); t.set(x + 1, y, c2);
    }
  },
  ore_copper(t, P) {
    painters.stone(t, P);
    const c = hex(0xd2762e), c2 = hex(0xffab5c);
    const spots = [[3, 5], [10, 3], [12, 11], [5, 12], [7, 8]];
    for (const [x, y] of spots) { t.blob(x, y, 2, c, 0.5); t.set(x, y - 1, c2); }
  },
  ore_gold(t, P) {
    painters.stone(t, P);
    const c = hex(0xf2c53d), c2 = hex(0xfff3a8);
    const spots = [[4, 4], [11, 6], [7, 11], [13, 12]];
    for (const [x, y] of spots) { t.blob(x, y, 2, c, 0.5); t.set(x + 1, y - 1, c2); t.set(x, y, c2); }
  },
  rock_paraffinium(t, P) {
    t.fill(shade(P.rock, 0.9)); t.grain(0.06, 1);
    const c = hex(0xff8a3d);
    const r = t.rng;
    for (let i = 0; i < 6; i++) {
      const x = (r() * 16) | 0, y = (r() * 16) | 0;
      t.blob(x, y, 1, c, 0.4);
      t.set(x, y, hex(0xffc98a));
    }
    for (let i = 0; i < 3; i++) t.line((r() * 16) | 0, 0, (r() * 16) | 0, 15, shade(c, 0.8));
  },
  alien_rock(t, P) {
    t.fill(P.rock); t.grain(0.07, 1); t.grain(0.06, 2);
    const r = t.rng;
    for (let i = 0; i < 5; i++) {
      const x = (r() * 16) | 0, y = (r() * 16) | 0;
      t.blob(x, y, 2, shade(P.rock, 0.84 + r() * 0.3), 0.7);
    }
    for (let i = 0; i < 4; i++) t.set((r() * 16) | 0, (r() * 16) | 0, mix(P.rock, P.glow, 0.55));
  },
  ice(t, P) {
    const c = hex(0x9fd4f5);
    t.fill(c, 225);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const f = (Math.sin(x * 0.7 + y * 0.3) + Math.cos(y * 0.9)) * 0.2 + 0.55;
      t.set(x, y, mix(shade(c, 0.85), shade(c, 1.18), f), 220);
    }
    const r = t.rng;
    for (let i = 0; i < 3; i++) t.line((r() * 16) | 0, 0, (r() * 16) | 0, 15, [235, 250, 255], 240);
  },
  snow(t, P) {
    t.fill([242, 246, 252]); t.grain(0.035, 1); t.specks(24, [255, 255, 255]); t.specks(10, [220, 228, 240]);
  },
  glass(t, P) {
    t.clear();
    const c = [205, 232, 240];
    for (let x = 0; x < 16; x++) { t.set(x, 0, c, 190); t.set(x, 15, c, 190); t.set(0, x, c, 190); t.set(15, x, c, 190); }
    for (let x = 1; x < 15; x++) for (let y = 1; y < 15; y++) t.set(x, y, c, 26);
    t.line(2, 12, 6, 3, [255, 255, 255], 120);
    t.line(9, 13, 13, 5, [255, 255, 255], 70);
  },
  lumen(t, P) {
    const c = P.glow;
    t.fill(shade(c, 0.7));
    const r = t.rng;
    for (let i = 0; i < 14; i++) t.blob((r() * 16) | 0, (r() * 16) | 0, 1 + ((r() * 2) | 0), shade(c, 1 + r() * 0.5), 0.5);
    t.grain(0.07, 1);
    t.bevel(1.2, 0.85);
  },
  metal_panel(t, P) {
    const c = hex(0x8e9aa8);
    t.fill(c); t.grain(0.03, 1);
    t.rect(0, 0, 16, 1, shade(c, 1.2)); t.rect(0, 15, 16, 1, shade(c, 0.72));
    t.rect(0, 0, 1, 16, shade(c, 1.1)); t.rect(15, 0, 1, 16, shade(c, 0.8));
    t.rect(3, 3, 10, 10, shade(c, 0.92));
    t.rect(3, 3, 10, 1, shade(c, 0.78)); t.rect(3, 12, 10, 1, shade(c, 1.12));
    for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) t.set(x, y, shade(c, 0.6));
    t.set(12, 7, hex(0x59e3ff)); t.set(11, 7, hex(0x2b7f96));
  },
  metal_floor(t, P) {
    const c = hex(0x7c8794);
    t.fill(c); t.grain(0.035, 1);
    for (let i = 0; i < 16; i += 4) { t.line(i, 0, i + 15, 15, shade(c, 1.14)); t.line(i, 15, i + 15, 0, shade(c, 0.86)); }
    t.rect(0, 0, 16, 1, shade(c, 1.2)); t.rect(0, 15, 16, 1, shade(c, 0.75));
  },
  basalt(t, P) {
    const c = hex(0x3b3a40);
    t.fill(c); t.grain(0.08, 1);
    const r = t.rng;
    for (let i = 0; i < 4; i++) t.line((r() * 16) | 0, 0, (r() * 16) | 0, 15, shade(c, 1.3));
    for (let i = 0; i < 6; i++) t.set((r() * 16) | 0, (r() * 16) | 0, hex(0xff5a1e));
  },
  mush_stem(t, P) {
    const c = mix(P.wood, [225, 215, 200], 0.5);
    t.fill(c); t.grain(0.05, 1);
    const r = t.rng;
    for (let i = 0; i < 5; i++) { const x = (r() * 16) | 0; t.rect(x, 0, 1, 16, shade(c, 0.86)); }
    t.specks(10, shade(c, 1.12));
  },
  mush_stem_top(t, P) {
    const c = mix(P.wood, [235, 225, 210], 0.6);
    t.fill(shade(c, 0.9));
    t.blob(8, 8, 5, c, 0.6); t.blob(8, 8, 2, shade(c, 0.78), 0.4);
    t.grain(0.05, 1);
  },
  mush_cap(t, P) {
    const c = P.floraRed;
    t.fill(c); t.grain(0.05, 1);
    const r = t.rng;
    for (let i = 0; i < 7; i++) t.blob((r() * 16) | 0, (r() * 16) | 0, 1 + ((r() * 2) | 0), mix(c, [255, 250, 235], 0.75), 0.4);
    t.bevel(1.18, 0.85);
  },
  cactus(t, P) {
    const c = mix(P.leaf, hex(0x3f7d3a), 0.6);
    t.fill(c); t.grain(0.05, 1);
    for (let x = 2; x < 16; x += 5) t.rect(x, 0, 1, 16, shade(c, 0.8));
    const r = t.rng;
    for (let i = 0; i < 12; i++) t.set((r() * 16) | 0, (r() * 16) | 0, [240, 240, 220]);
  },
  bedrock(t, P) {
    const c = hex(0x555555);
    t.fill(c);
    const r = t.rng;
    for (let i = 0; i < 22; i++) t.blob((r() * 16) | 0, (r() * 16) | 0, 1 + ((r() * 2) | 0), shade(c, 0.5 + r() * 1.1), 0.6);
    t.grain(0.12, 1);
  },
  crate_side(t, P) {
    const c = mix(P.wood, hex(0x8a6a44), 0.4);
    t.fill(c); t.grain(0.04, 1);
    const band = hex(0x6b7480);
    t.rect(0, 6, 16, 3, band);
    t.rect(0, 6, 16, 1, shade(band, 1.25)); t.rect(0, 8, 16, 1, shade(band, 0.8));
    t.rect(6, 5, 4, 5, shade(band, 0.7));
    t.set(7, 7, hex(0xffd050)); t.set(8, 7, hex(0xffd050));
    t.rect(0, 0, 16, 1, shade(c, 1.15)); t.rect(0, 15, 16, 1, shade(c, 0.8));
  },
  crate_top(t, P) {
    const c = mix(P.wood, hex(0x8a6a44), 0.4);
    t.fill(c); t.grain(0.04, 1);
    t.rect(1, 1, 14, 14, shade(c, 0.92));
    t.rect(1, 1, 14, 1, shade(c, 1.2)); t.rect(1, 14, 14, 1, shade(c, 0.78));
    const band = hex(0x6b7480);
    t.rect(7, 1, 2, 14, band);
  },
  refiner_side(t, P) {
    const c = hex(0x6f7c8a);
    t.fill(c); t.grain(0.035, 1);
    t.rect(0, 0, 16, 1, shade(c, 1.2)); t.rect(0, 15, 16, 1, shade(c, 0.72));
    t.rect(4, 5, 8, 7, hex(0x22262c));
    const glow = hex(0xff9a2e);
    t.rect(5, 9, 6, 2, glow);
    t.rect(5, 8, 6, 1, shade(glow, 1.25));
    t.set(2, 3, hex(0x59e3ff)); t.set(13, 3, hex(0x59e3ff));
    t.rect(3, 13, 10, 1, shade(c, 0.85));
  },
  refiner_top(t, P) {
    const c = hex(0x76838f);
    t.fill(c); t.grain(0.035, 1);
    t.blob(8, 8, 4, hex(0x2b3138), 0.3);
    t.blob(8, 8, 2, hex(0xffb147), 0.3);
    t.blob(8, 8, 1, hex(0xfff0c0), 0.2);
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) t.set(x, y, shade(c, 0.6));
  },
  computer(t, P) {
    const c = hex(0x2f3a46);
    t.fill(c); t.grain(0.03, 1);
    t.rect(2, 2, 12, 9, hex(0x0d1319));
    const g = hex(0x2ee6c0);
    for (let y = 3; y < 10; y += 2) t.rect(3, y, 3 + ((y * 3) % 8), 1, shade(g, 0.9 + (y % 3) * 0.2));
    t.rect(3, 3, 10, 1, shade(g, 1.3));
    t.rect(2, 12, 12, 2, hex(0x3d4a58));
    t.set(4, 13, hex(0xff5a4e)); t.set(6, 13, hex(0xffd050)); t.set(8, 13, g);
    t.rect(0, 0, 16, 1, shade(c, 1.3)); t.rect(0, 15, 16, 1, shade(c, 0.7));
  },
  computer_top(t, P) {
    const c = hex(0x3a4653);
    t.fill(c); t.grain(0.03, 1);
    t.rect(4, 4, 8, 8, hex(0x151c22));
    t.blob(8, 8, 2, hex(0x2ee6c0), 0.3);
    t.blob(8, 8, 1, hex(0xd6fff5), 0.2);
  },
  beacon(t, P) {
    const c = hex(0x4a5560);
    t.fill(c); t.grain(0.03, 1);
    t.rect(6, 0, 4, 16, hex(0x2b333b));
    const g = hex(0xffb02e);
    t.rect(6, 2, 4, 3, g); t.rect(6, 7, 4, 2, shade(g, 0.85)); t.rect(6, 11, 4, 2, shade(g, 0.7));
    t.rect(5, 1, 6, 1, shade(g, 1.4));
    t.rect(0, 14, 16, 2, shade(c, 0.8));
  },
  table_top(t, P) {
    t.fill(P.wood); t.grain(0.04, 1);
    const dark = shade(P.wood, 0.6);
    t.rect(0, 0, 16, 1, dark); t.rect(0, 15, 16, 1, dark); t.rect(0, 0, 1, 16, dark); t.rect(15, 0, 1, 16, dark);
    // 3x3 grid engraved
    for (let i = 1; i <= 2; i++) { t.rect(i * 5, 1, 1, 14, shade(P.wood, 0.72)); t.rect(1, i * 5, 14, 1, shade(P.wood, 0.72)); }
    t.set(3, 3, hex(0xffca4a)); t.set(12, 12, hex(0x59e3ff));
  },
  table_side(t, P) {
    t.fill(P.wood); t.grain(0.04, 1);
    t.rect(0, 0, 16, 4, shade(P.wood, 1.1));
    t.rect(0, 4, 16, 1, shade(P.wood, 0.62));
    for (let x = 1; x < 16; x += 4) t.rect(x, 5, 2, 10, shade(P.wood, 0.86));
    t.rect(0, 15, 16, 1, shade(P.wood, 0.7));
    t.rect(11, 6, 4, 3, hex(0x4b5560));
    t.set(12, 7, hex(0xff9a2e));
  },
};

/* ---------------- atlas assembly ---------------- */
export function buildAtlasCanvas(palette, seed = 12345) {
  const size = ATLAS_COLS * TILE_PX;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = ATLAS_ROWS * TILE_PX;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  TILES.forEach((name, idx) => {
    const rng = mulberry32(seed + idx * 7919);
    const tile = new Tile(rng);
    const painter = painters[name];
    if (painter) painter(tile, palette);
    else { tile.fill([255, 0, 255]); }
    const img = new ImageData(tile.data, TILE_PX, TILE_PX);
    const cx = (idx % ATLAS_COLS) * TILE_PX;
    const cy = Math.floor(idx / ATLAS_COLS) * TILE_PX;
    ctx.putImageData(img, cx, cy);
  });
  return canvas;
}

/** UV rect for a tile index: [u0, v0, u1, v1] (v flipped for three.js) */
export function tileUV(index) {
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  const s = 1 / ATLAS_COLS;
  const sv = 1 / ATLAS_ROWS;
  const u0 = col * s, u1 = u0 + s;
  const v1 = 1 - row * sv, v0 = v1 - sv;
  return [u0, v0, u1, v1];
}

/** Draw an isometric-ish block icon for the UI (Minecraft inventory style). */
export function blockIconDataURL(atlasCanvas, tiles, size = 48) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const T = TILE_PX;
  const px = (idx, sx, sy, w, h, dx, dy, dw, dh, bright) => {
    const col = (idx % ATLAS_COLS) * T, row = Math.floor(idx / ATLAS_COLS) * T;
    g.save();
    g.beginPath(); g.rect(dx, dy, dw, dh); g.clip();
    g.drawImage(atlasCanvas, col + sx, row + sy, w, h, dx, dy, dw, dh);
    if (bright !== 1) {
      g.globalCompositeOperation = bright > 1 ? 'lighter' : 'source-atop';
      g.fillStyle = bright > 1 ? 'rgba(255,255,255,' + (bright - 1) + ')' : 'rgba(0,0,0,' + (1 - bright) + ')';
      g.fillRect(dx, dy, dw, dh);
    }
    g.restore();
  };
  // simple faux-3D: top parallelogram + two side faces, drawn with sheared images
  const s = size;
  const topIdx = tiles.top, sideIdx = tiles.side;
  // top face
  g.save();
  g.translate(s * 0.5, s * 0.16);
  g.transform(1, 0.5, -1, 0.5, 0, 0);
  const tw = s * 0.42;
  const colT = (topIdx % ATLAS_COLS) * T, rowT = Math.floor(topIdx / ATLAS_COLS) * T;
  g.drawImage(atlasCanvas, colT, rowT, T, T, 0, 0, tw, tw);
  g.restore();
  // left face
  g.save();
  g.translate(s * 0.5 - s * 0.42, s * 0.16 + s * 0.21);
  g.transform(1, 0.5, 0, 1, 0, 0);
  const colS = (sideIdx % ATLAS_COLS) * T, rowS = Math.floor(sideIdx / ATLAS_COLS) * T;
  g.drawImage(atlasCanvas, colS, rowS, T, T, 0, 0, s * 0.42, s * 0.52);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(0, 0, s * 0.42, s * 0.8);
  g.restore();
  // right face
  g.save();
  g.translate(s * 0.5, s * 0.16 + s * 0.42);
  g.transform(1, -0.5, 0, 1, 0, 0);
  g.drawImage(atlasCanvas, colS, rowS, T, T, 0, 0, s * 0.42, s * 0.52);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(0, 0, s * 0.42, s * 0.8);
  g.restore();
  return c.toDataURL();
}
