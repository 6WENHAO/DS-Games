// Planet terrain generation: heightfield + caves + ores + flora structures.
// Runs in a worker and on the main thread (no DOM access).

import { Noise, smoothstep, clamp, lerp } from '../core/noise.js';
import { hash32, hashFloat, mulberry32 } from '../core/rng.js';
import { BID } from './blocks.js';

export const CH = 16;          // chunk width/depth
export const CH_H = 128;       // world height
export const PAD = 1;
export const GW = CH + PAD * 2; // padded width (18)
export const STRUCT_RANGE = 5;  // how far structure roots can reach into a chunk

export const innerIdx = (x, y, z) => x + CH * (z + CH * y);
export const padIdx = (x, y, z) => (x + PAD) + GW * ((z + PAD) + GW * y);

export class PlanetGen {
  constructor(planet) {
    this.planet = planet;
    const s = planet.seed >>> 0;
    this.nCont = new Noise(s);
    this.nHill = new Noise(s + 101);
    this.nRidge = new Noise(s + 202);
    this.nDetail = new Noise(s + 303);
    this.nRegion = new Noise(s + 404);
    this.nCaveA = new Noise(s + 505);
    this.nCaveB = new Noise(s + 606);
    this.nCavern = new Noise(s + 707);
    this.nOre = new Noise(s + 808);
    this.nWarp = new Noise(s + 909);
    this.t = planet.terrain;
    this.biome = planet.biome;
    this.seed = s;
    this._hCache = new Map();
  }

  regionAt(wx, wz) {
    return this.nRegion.fbm2(wx * 0.0035, wz * 0.0035, 3) * 0.5 + 0.5; // 0..1
  }

  heightAt(wx, wz) {
    const t = this.t;
    const wxx = wx + this.nWarp.noise2(wx * 0.004, wz * 0.004) * 22;
    const wzz = wz + this.nWarp.noise2(wx * 0.004 + 5.1, wz * 0.004 - 3.3) * 22;
    const cont = this.nCont.fbm2(wxx * 0.0022, wzz * 0.0022, 3);
    const hills = this.nHill.fbm2(wxx * 0.013, wzz * 0.013, 4);
    const ridge = this.nRidge.ridged2(wxx * 0.0042, wzz * 0.0042, 4);
    const detail = this.nDetail.fbm2(wxx * 0.05, wzz * 0.05, 2);
    const mask = smoothstep(0.15, 0.85, cont * 0.5 + 0.5 + ridge * 0.25);
    let h = t.base + cont * t.amp + hills * t.hill + Math.pow(ridge, 2.2) * t.mountain * mask + detail * 2.2;
    if (this.biome === 'desert') {
      // mesa terracing
      const step = 5;
      const q = Math.round(h / step) * step;
      h = lerp(h, q, 0.35 * smoothstep(0.3, 0.8, ridge));
    }
    if (this.biome === 'barren') {
      // craters
      const c = this.nDetail.fbm2(wxx * 0.008 + 11, wzz * 0.008 - 7, 2);
      if (c > 0.42) h -= (c - 0.42) * 60;
    }
    return h;
  }

  heightInt(wx, wz) {
    const key = wx * 100000 + wz;
    let v = this._hCache.get(key);
    if (v === undefined) {
      v = Math.max(3, Math.min(CH_H - 12, Math.floor(this.heightAt(wx, wz))));
      if (this._hCache.size > 200000) this._hCache.clear();
      this._hCache.set(key, v);
    }
    return v;
  }

  isCave(wx, y, wz, h) {
    if (y < 2 || y > h - 3) return false;
    const t = this.t;
    const s = 0.028;
    const a = this.nCaveA.noise3(wx * s, y * s * 1.7, wz * s);
    const b = this.nCaveB.noise3(wx * s, y * s * 1.7, wz * s);
    const w = 0.055 * t.caves;
    if (Math.abs(a) < w && Math.abs(b) < w) return true;
    // big caverns deeper down
    if (y < 40) {
      const cav = this.nCavern.fbm3(wx * 0.016, y * 0.03, wz * 0.016, 3);
      if (cav > 0.52 - (40 - y) * 0.004) return true;
    }
    return false;
  }

  oreAt(wx, y, wz) {
    const n = this.nOre;
    if (y < 52 && n.noise3(wx * 0.06 + 3, y * 0.06, wz * 0.06) > 0.72) return BID.COPPER;
    if (y < 30 && n.noise3(wx * 0.075 - 9, y * 0.075 + 4, wz * 0.075) > 0.8) return BID.GOLD;
    if (n.noise3(wx * 0.055 + 21, y * 0.055 - 2, wz * 0.055) > 0.66) return BID.FERRITE;
    return 0;
  }

  surfaceFor(h, region, slope, wx, wz) {
    const t = this.t, B = BID;
    const sea = t.sea;
    const wet = h <= sea + 1;
    switch (this.biome) {
      case 'lush':
        if (wet) return [B.SAND, B.SAND, B.STONE];
        if (slope > 3.2) return [B.STONE, B.STONE, B.STONE];
        return [B.GRASS, B.DIRT, B.STONE];
      case 'desert':
        if (wet) return [B.SAND, B.SANDSTONE, B.STONE];
        if (slope > 3.6) return [B.SANDSTONE, B.SANDSTONE, B.STONE];
        return region > 0.55 ? [B.SAND, B.SANDSTONE, B.STONE] : [B.SANDSTONE, B.SANDSTONE, B.STONE];
      case 'frozen':
        if (wet) return [B.ICE, B.SAND, B.STONE];
        if (slope > 3.4) return [B.STONE, B.STONE, B.STONE];
        return [B.SNOW, B.DIRT, B.STONE];
      case 'toxic':
        if (wet) return [B.GRAVEL, B.DIRT, B.STONE];
        if (slope > 3.4) return [B.ALIEN_ROCK, B.ALIEN_ROCK, B.STONE];
        return [B.GRASS, B.DIRT, B.STONE];
      case 'radioactive':
        if (wet) return [B.GRAVEL, B.DIRT, B.STONE];
        if (slope > 3.2) return [B.ALIEN_ROCK, B.STONE, B.STONE];
        return region > 0.5 ? [B.GRASS, B.DIRT, B.STONE] : [B.GRAVEL, B.DIRT, B.STONE];
      case 'volcanic':
        if (slope > 3) return [B.BASALT, B.BASALT, B.STONE];
        return region > 0.5 ? [B.BASALT, B.STONE, B.STONE] : [B.GRAVEL, B.BASALT, B.STONE];
      case 'exotic':
        if (wet) return [B.SAND, B.ALIEN_ROCK, B.STONE];
        if (slope > 3.4) return [B.ALIEN_ROCK, B.ALIEN_ROCK, B.STONE];
        return [B.GRASS, B.DIRT, B.ALIEN_ROCK];
      default: // barren
        if (slope > 3) return [B.STONE, B.STONE, B.STONE];
        return region > 0.5 ? [B.GRAVEL, B.DIRT, B.STONE] : [B.DIRT, B.STONE, B.STONE];
    }
  }

  /** Generate padded voxel volume for a chunk. */
  genChunk(cx, cz) {
    const t = this.t, B = BID;
    const pad = new Uint8Array(GW * GW * CH_H);
    const heights = new Int16Array(CH * CH);
    const spawns = [];
    const baseX = cx * CH, baseZ = cz * CH;

    // --- terrain columns (padded) ---
    for (let z = -PAD; z < CH + PAD; z++) {
      for (let x = -PAD; x < CH + PAD; x++) {
        const wx = baseX + x, wz = baseZ + z;
        const h = this.heightInt(wx, wz);
        const region = this.regionAt(wx, wz);
        const hL = this.heightInt(wx - 1, wz), hR = this.heightInt(wx + 1, wz);
        const hD = this.heightInt(wx, wz - 1), hU = this.heightInt(wx, wz + 1);
        const slope = Math.max(Math.abs(h - hL), Math.abs(h - hR), Math.abs(h - hD), Math.abs(h - hU));
        const [sTop, sMid, sDeep] = this.surfaceFor(h, region, slope, wx, wz);
        if (x >= 0 && x < CH && z >= 0 && z < CH) heights[x + z * CH] = h;

        for (let y = 0; y <= Math.max(h, t.sea); y++) {
          let id = 0;
          if (y <= h) {
            if (y === 0) id = B.BEDROCK;
            else if (y < 3 && hashFloat(wx, y, wz, this.seed) < 0.55) id = B.BEDROCK;
            else if (y === h) id = sTop;
            else if (y > h - 4) id = sMid;
            else id = sDeep === B.STONE ? B.STONE : sDeep;
            if (id === B.STONE || id === B.ALIEN_ROCK) {
              const ore = this.oreAt(wx, y, wz);
              if (ore) id = ore;
            }
            if (this.isCave(wx, y, wz, h)) id = 0;
          } else if (t.water && y <= t.sea) {
            id = B.WATER;
          }
          if (id) pad[padIdx(x, y, z)] = id;
        }

        // cave decoration (cobalt / salt / moss) — sample a few spots per column
        for (let y = 6; y < Math.min(h - 4, 60); y++) {
          if (pad[padIdx(x, y, z)] !== 0) continue;
          const below = pad[padIdx(x, y - 1, z)];
          if (below === 0 || below === B.WATER) continue;
          const r = hashFloat(wx, y * 31, wz, this.seed + 77);
          if (r < 0.012) pad[padIdx(x, y, z)] = B.COBALT;
          else if (r < 0.02) pad[padIdx(x, y, z)] = B.SALT;
          else if (r < 0.05) pad[padIdx(x, y, z)] = B.MOSS;
        }
      }
    }

    // --- structures (trees / boulders / crystals / plants) ---
    for (let z = -STRUCT_RANGE; z < CH + STRUCT_RANGE; z++) {
      for (let x = -STRUCT_RANGE; x < CH + STRUCT_RANGE; x++) {
        const wx = baseX + x, wz = baseZ + z;
        const h = this.heightInt(wx, wz);
        if (h <= t.sea && t.water) continue;
        const region = this.regionAt(wx, wz);
        const r1 = hashFloat(wx, 1, wz, this.seed + 11);
        const surf = pad[padIdx(clamp(x, -PAD, CH + PAD - 1), h, clamp(z, -PAD, CH + PAD - 1))];

        // trees
        const treeDens = t.treeDensity * (0.35 + region * 1.5);
        if (r1 < treeDens && (surf === B.GRASS || surf === B.DIRT || surf === B.SAND || surf === B.SNOW || surf === B.SANDSTONE || surf === 0)) {
          const rng = mulberry32(hash32(wx, 7, wz, this.seed));
          const kind = t.trees[(hash32(wx, 3, wz, this.seed + 5) % t.trees.length)];
          this.buildTree(pad, x, h + 1, z, kind, rng);
          continue;
        }
        // boulders (ferrite / rock) — the classic NMS scatter
        const r2 = hashFloat(wx, 2, wz, this.seed + 22);
        if (r2 < t.boulders) {
          const rng = mulberry32(hash32(wx, 9, wz, this.seed + 3));
          const rad = 1 + Math.floor(rng() * 2.2);
          const type = rng() < 0.55 ? B.FERRITE : B.ALIEN_ROCK;
          this.sphere(pad, x, h + rad - 1, z, rad, type, rng);
          continue;
        }
        // crystals (di-hydrogen / frost)
        const r3 = hashFloat(wx, 4, wz, this.seed + 33);
        if (r3 < t.crystals) {
          const rng = mulberry32(hash32(wx, 13, wz, this.seed + 8));
          const cid = this.biome === 'frozen' ? B.FROST_CRYSTAL : B.CRYSTAL;
          const hgt = 2 + Math.floor(rng() * 3);
          for (let k = 0; k < hgt; k++) {
            this.put(pad, x, h + 1 + k, z, cid);
            if (k === 0 && rng() < 0.6) {
              this.put(pad, x + (rng() < 0.5 ? 1 : -1), h + 1, z, cid);
              this.put(pad, x, h + 1, z + (rng() < 0.5 ? 1 : -1), cid);
            }
          }
          continue;
        }
        // paraffinium rock formation
        const r3b = hashFloat(wx, 8, wz, this.seed + 63);
        if (r3b < t.crystals * 0.6) {
          const rng = mulberry32(hash32(wx, 17, wz, this.seed + 12));
          this.sphere(pad, x, h + 1, z, 1 + Math.floor(rng() * 1.6), B.PARAFFIN, rng);
          continue;
        }
        // resource flora + tufts
        const r4 = hashFloat(wx, 5, wz, this.seed + 44);
        if (surf === B.GRASS || surf === B.DIRT || surf === B.SNOW || surf === B.SAND) {
          if (r4 < 0.016) this.put(pad, x, h + 1, z, B.OXY);
          else if (r4 < 0.03) this.put(pad, x, h + 1, z, B.SODIUM);
          else if (r4 < 0.048) this.put(pad, x, h + 1, z, B.BUSH);
          else if (r4 < 0.048 + t.tufts) this.put(pad, x, h + 1, z, B.TUFT);
        }
      }
    }

    // --- entity spawn hints (inner chunk only) ---
    if (this.planet.fauna) {
      const r = hashFloat(cx, 31, cz, this.seed + 991);
      if (r < 0.5) {
        const rng = mulberry32(hash32(cx, 41, cz, this.seed));
        const n = 1 + Math.floor(rng() * 2);
        for (let i = 0; i < n; i++) {
          const lx = Math.floor(rng() * CH), lz = Math.floor(rng() * CH);
          const hy = heights[lx + lz * CH];
          if (hy > t.sea || !t.water) spawns.push({ kind: 'fauna', x: baseX + lx + 0.5, y: hy + 2, z: baseZ + lz + 0.5, seed: (rng() * 1e9) | 0 });
        }
      }
    }

    // extract inner voxels
    const voxels = new Uint8Array(CH * CH * CH_H);
    for (let y = 0; y < CH_H; y++) {
      for (let z = 0; z < CH; z++) {
        const src = padIdx(0, y, z);
        const dst = innerIdx(0, y, z);
        voxels.set(pad.subarray(src, src + CH), dst);
      }
    }
    return { voxels, pad, heights, spawns };
  }

  put(pad, x, y, z, id, overwrite = false) {
    if (x < -PAD || z < -PAD || x >= CH + PAD || z >= CH + PAD || y < 0 || y >= CH_H) return;
    const i = padIdx(x, y, z);
    if (!overwrite && pad[i] !== 0 && pad[i] !== BID.WATER) return;
    pad[i] = id;
  }

  sphere(pad, cx, cy, cz, rad, id, rng) {
    for (let y = -rad; y <= rad; y++) {
      for (let z = -rad; z <= rad; z++) {
        for (let x = -rad; x <= rad; x++) {
          const d = Math.hypot(x, y * 1.15, z);
          if (d <= rad + (rng() - 0.5) * 0.7) this.put(pad, cx + x, cy + y, cz + z, id, true);
        }
      }
    }
  }

  buildTree(pad, x, y, z, kind, rng) {
    const B = BID;
    if (kind === 'oak') {
      const h = 4 + Math.floor(rng() * 3);
      for (let k = 0; k < h; k++) this.put(pad, x, y + k, z, B.LOG, true);
      const top = y + h;
      const r = 2;
      for (let dy = -2; dy <= 1; dy++) {
        const rr = dy === 1 ? 1 : dy === -2 ? r : r;
        for (let dz = -rr; dz <= rr; dz++) {
          for (let dx = -rr; dx <= rr; dx++) {
            if (Math.abs(dx) === rr && Math.abs(dz) === rr && rng() < 0.7) continue;
            if (dx === 0 && dz === 0 && dy < 1) continue;
            this.put(pad, x + dx, top + dy, z + dz, B.LEAVES);
          }
        }
      }
      this.put(pad, x, top, z, B.LEAVES);
    } else if (kind === 'pine') {
      const h = 6 + Math.floor(rng() * 4);
      for (let k = 0; k < h; k++) this.put(pad, x, y + k, z, B.LOG, true);
      for (let k = 2; k < h + 2; k++) {
        const rr = Math.max(0, Math.round((h - k) * 0.45));
        for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
          if (Math.hypot(dx, dz) > rr + 0.3) continue;
          this.put(pad, x + dx, y + k, z + dz, B.LEAVES);
        }
      }
      this.put(pad, x, y + h + 1, z, B.LEAVES);
    } else if (kind === 'tall') {
      // NMS-style tall alien palm
      const h = 7 + Math.floor(rng() * 6);
      let lx = x, lz = z;
      for (let k = 0; k < h; k++) {
        if (k > 2 && rng() < 0.25) { lx += rng() < 0.5 ? 1 : -1; }
        if (k > 2 && rng() < 0.25) { lz += rng() < 0.5 ? 1 : -1; }
        this.put(pad, lx, y + k, lz, B.LOG, true);
      }
      const top = y + h;
      for (let a = 0; a < 7; a++) {
        const ang = (a / 7) * Math.PI * 2 + rng();
        const len = 3 + Math.floor(rng() * 3);
        for (let k = 1; k <= len; k++) {
          const px = Math.round(lx + Math.cos(ang) * k);
          const pz = Math.round(lz + Math.sin(ang) * k);
          const py = top + Math.round(1 - k * 0.55);
          this.put(pad, px, py, pz, B.LEAVES);
          if (rng() < 0.5) this.put(pad, px, py - 1, pz, B.LEAVES);
        }
      }
      this.put(pad, lx, top + 1, lz, B.LEAVES);
    } else if (kind === 'mushroom') {
      const h = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < h; k++) this.put(pad, x, y + k, z, B.MUSH_STEM, true);
      const top = y + h;
      const rad = 2 + Math.floor(rng() * 2);
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        const d = Math.hypot(dx, dz);
        if (d > rad + 0.4) continue;
        this.put(pad, x + dx, top, z + dz, B.MUSH_CAP);
        if (d > rad - 1) this.put(pad, x + dx, top - 1, z + dz, B.MUSH_CAP);
      }
      this.put(pad, x, top + 1, z, B.MUSH_CAP);
    } else if (kind === 'spiral') {
      // exotic: spiralling crystal tree
      const h = 8 + Math.floor(rng() * 7);
      for (let k = 0; k < h; k++) {
        const ang = k * 0.6;
        const rad = 1 + Math.sin(k * 0.3) * 1.4;
        const px = Math.round(x + Math.cos(ang) * rad);
        const pz = Math.round(z + Math.sin(ang) * rad);
        this.put(pad, px, y + k, pz, B.MUSH_STEM, true);
        if (k % 3 === 0) {
          this.put(pad, px + 1, y + k, pz, B.MUSH_CAP);
          this.put(pad, px, y + k, pz + 1, B.MUSH_CAP);
        }
      }
      this.put(pad, x, y + h, z, B.CRYSTAL);
    } else if (kind === 'cactus') {
      const h = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < h; k++) this.put(pad, x, y + k, z, B.CACTUS, true);
      if (rng() < 0.5) { this.put(pad, x + 1, y + h - 1, z, B.CACTUS, true); this.put(pad, x + 1, y + h, z, B.CACTUS, true); }
      if (rng() < 0.5) { this.put(pad, x - 1, y + h - 2, z, B.CACTUS, true); this.put(pad, x - 1, y + h - 1, z, B.CACTUS, true); }
    } else { // dead
      const h = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < h; k++) this.put(pad, x, y + k, z, B.LOG, true);
      for (let a = 0; a < 4; a++) {
        if (rng() < 0.5) continue;
        const dx = a === 0 ? 1 : a === 1 ? -1 : 0;
        const dz = a === 2 ? 1 : a === 3 ? -1 : 0;
        this.put(pad, x + dx, y + h - 1, z + dz, B.LOG, true);
        if (rng() < 0.5) this.put(pad, x + dx * 2, y + h, z + dz * 2, B.LOG, true);
      }
    }
  }

  /** Safe spawn position on the surface near (x,z). */
  findSpawn(wx = 0, wz = 0) {
    for (let r = 0; r < 400; r += 3) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const x = Math.round(wx + Math.cos(ang) * r);
        const z = Math.round(wz + Math.sin(ang) * r);
        const h = this.heightInt(x, z);
        if (h > this.t.sea + 2 && h < CH_H - 20) return { x: x + 0.5, y: h + 2.2, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: this.t.base + 6, z: 0.5 };
  }
}
