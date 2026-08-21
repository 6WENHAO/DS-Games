import * as THREE from 'three';
import { Rng } from '../core/rng';
import { BLOCK, BLOCKS, BUILDING_COLORS, CITY_HALF, blockMin } from './layout';
import { K_LEAF, K_PROP, K_ROOF, K_SLAB, K_WALL, K_WINDOW, VoxelBuilder, VoxelField } from './voxels';

export interface BuildingDef {
  id: number;
  cx: number;
  cz: number;
  w: number;
  d: number;
  levels: number;
  landmark: boolean;
  ids: number[];
  levelTotal: number[];
}

export interface CityData {
  builder: VoxelBuilder;
  buildings: BuildingDef[];
  parks: Array<{ x: number; z: number; r: number }>;
  fountain: { x: number; z: number } | null;
}

const WINDOW_COLORS = [0xdff6ff, 0xc9edff, 0xa8dcff];
const ROOF_COLORS = [0xe4ecf2, 0xd6c9b6, 0xcfd8dd, 0xf0dfc4];
const SLAB_COLOR = 0xf4ead9;
const TRUNK_COLOR = 0x9a6b43;
const LEAF_COLORS = [0x7fd48a, 0x66c47b, 0x9ade9b, 0x55b96e];
const FLOWERS = [0xff7f9c, 0xffd166, 0xff9f6b, 0xc79bff, 0xfff1a8];

/** One procedural tower: hollow shell + window pattern + slabs + roof kit. */
function addBuilding(
  b: VoxelBuilder,
  def: BuildingDef,
  rng: Rng,
  wallHex: number,
  style: number,
): void {
  const { cx, cz, w, d, levels, id } = def;
  const x0 = cx - w / 2 + 0.5;
  const z0 = cz - d / 2 + 0.5;
  const winHex = rng.pick(WINDOW_COLORS);
  const accentHex = rng.pick(BUILDING_COLORS);
  const roofHex = rng.pick(ROOF_COLORS);
  const glassTower = style === 3;
  const levelTotal: number[] = new Array(levels + 3).fill(0);

  // taper for landmarks: shrink the footprint at setback levels
  const setback = def.landmark && w > 7 ? Math.max(6, Math.floor(levels * 0.45)) : -1;

  const push = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    hex: number,
    level: number,
    kind: number,
    shade = 1,
  ): void => {
    def.ids.push(b.add(x, y, z, sx, sy, sz, hex, id, level, kind, shade));
    levelTotal[level]++;
  };

  let curW = w;
  let curD = d;
  for (let L = 0; L < levels; L++) {
    if (setback > 0 && L === setback) {
      curW = Math.max(3, curW - 2);
      curD = Math.max(3, curD - 2);
    }
    if (setback > 0 && L === setback * 2) {
      curW = Math.max(3, curW - 2);
      curD = Math.max(3, curD - 2);
    }
    const ox = cx - curW / 2 + 0.5;
    const oz = cz - curD / 2 + 0.5;
    const y = L + 0.5;
    const band = style === 1 && L > 0 && L % 4 === 0;
    for (let i = 0; i < curW; i++) {
      for (let j = 0; j < curD; j++) {
        const edge = i === 0 || j === 0 || i === curW - 1 || j === curD - 1;
        if (!edge) continue;
        const corner = (i === 0 || i === curW - 1) && (j === 0 || j === curD - 1);
        let hex = wallHex;
        let kind = K_WALL;
        let shade = corner ? 0.9 : 1;
        if (band) {
          hex = accentHex;
        } else if (style === 2 && !corner && (i + j) % 3 === 0) {
          hex = accentHex;
          shade = 0.96;
        }
        const canWindow = !corner && L > 0;
        const winRow = glassTower ? L % 1 === 0 : L % 2 === 1;
        if (canWindow && winRow && (glassTower || (i + j) % 2 === 0)) {
          hex = winHex;
          kind = K_WINDOW;
          shade = 1;
        }
        if (L === 0 && !corner && ((i === (curW >> 1) && j === 0) || (j === (curD >> 1) && i === 0))) {
          hex = 0x6b5a4e; // doorway
          shade = 1;
        }
        push(ox + i, y, oz + j, 1, 1, 1, hex, L, kind, shade);
      }
    }
    // interior floor slab every 3 levels -> visible guts once a wall is gone
    if (L % 3 === 2 && curW > 3 && curD > 3) {
      for (let i = 1; i < curW - 1; i++) {
        for (let j = 1; j < curD - 1; j++) {
          push(ox + i, y - 0.42, oz + j, 1, 0.16, 1, SLAB_COLOR, L, K_SLAB, 1);
        }
      }
    }
    // balcony / cornice band every 4 levels for extra silhouette detail
    if (!glassTower && L > 0 && L % 4 === 0 && curW > 4 && curD > 4) {
      for (let i = 0; i < curW; i++) {
        for (let j = 0; j < curD; j++) {
          const edge = i === 0 || j === 0 || i === curW - 1 || j === curD - 1;
          if (!edge) continue;
          push(ox + i, y - 0.46, oz + j, 1.28, 0.2, 1.28, accentHex, L, K_PROP, 1.04);
        }
      }
    }
  }

  // ---- roof deck + parapet + rooftop kit
  const ry = levels + 0.5;
  const rox = cx - curW / 2 + 0.5;
  const roz = cz - curD / 2 + 0.5;
  const rl = Math.min(levels, 254);
  for (let i = 0; i < curW; i++) {
    for (let j = 0; j < curD; j++) {
      const edge = i === 0 || j === 0 || i === curW - 1 || j === curD - 1;
      push(rox + i, ry, roz + j, 1, 1, 1, roofHex, rl, K_ROOF, edge ? 0.95 : 1);
    }
  }
  for (let i = 0; i < curW; i++) {
    for (let j = 0; j < curD; j++) {
      const edge = i === 0 || j === 0 || i === curW - 1 || j === curD - 1;
      if (!edge) continue;
      push(rox + i, ry + 0.85, roz + j, 1, 0.7, 1, accentHex, rl, K_ROOF, 0.92);
    }
  }
  const kit = rng.int(1, 3);
  for (let k = 0; k < kit; k++) {
    const kx = rox + rng.int(1, Math.max(1, curW - 2));
    const kz = roz + rng.int(1, Math.max(1, curD - 2));
    const t = rng.next();
    if (t < 0.4 && curW > 4) {
      // water tank
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++)
          push(kx + i - 0.5, ry + 1.6, kz + j - 0.5, 1, 2, 1, 0xbfc9d1, rl, K_PROP, 1);
      push(kx, ry + 3.1, kz, 2.2, 0.4, 2.2, 0x8f9aa3, rl, K_PROP, 1);
    } else if (t < 0.75) {
      // ac unit
      push(kx, ry + 1.1, kz, 1.6, 0.9, 1.6, 0xd8dee3, rl, K_PROP, 1);
    } else {
      // antenna
      const h = rng.range(3, 7);
      push(kx, ry + h / 2 + 0.5, kz, 0.22, h, 0.22, 0xe86a5a, rl, K_PROP, 1);
      push(kx, ry + h + 0.6, kz, 0.5, 0.5, 0.5, 0xffe066, rl, K_PROP, 1);
    }
  }
  void x0;
  void z0;
  def.levelTotal = levelTotal;
}

function addTree(b: VoxelBuilder, rng: Rng, x: number, z: number, scale = 1): void {
  const th = Math.round(rng.range(2, 4) * scale);
  const leafHex = rng.pick(LEAF_COLORS);
  for (let i = 0; i < th; i++)
    b.add(x, i + 0.5, z, 0.6, 1, 0.6, TRUNK_COLOR, -1, 0, K_PROP, 1);
  const r = scale > 0.9 ? 1 : 1;
  for (let i = -r; i <= r; i++) {
    for (let j = -r; j <= r; j++) {
      for (let k = 0; k < 3; k++) {
        const corner = Math.abs(i) === r && Math.abs(j) === r;
        if (corner && (k === 0 || k === 2)) continue;
        b.add(x + i, th + k + 0.5, z + j, 1, 1, 1, leafHex, -1, 0, K_LEAF, k === 2 ? 1.08 : 0.94);
      }
    }
  }
  b.add(x, th + 3.2, z, 1, 1, 1, leafHex, -1, 0, K_LEAF, 1.1);
}

function addLamp(b: VoxelBuilder, x: number, z: number): void {
  b.add(x, 2, z, 0.22, 4, 0.22, 0x8d99a6, -1, 0, K_PROP, 1);
  b.add(x, 4.2, z, 0.7, 0.45, 0.7, 0xfff2b0, -1, 0, K_PROP, 1.2);
}

function addBench(b: VoxelBuilder, x: number, z: number, horiz: boolean): void {
  const sx = horiz ? 2.4 : 0.7;
  const sz = horiz ? 0.7 : 2.4;
  b.add(x, 0.55, z, sx, 0.22, sz, 0xc98f52, -1, 0, K_PROP, 1);
  b.add(x, 0.25, z, sx * 0.8, 0.3, sz * 0.8, 0x9a9a9a, -1, 0, K_PROP, 1);
}

function addCarcass(b: VoxelBuilder, rng: Rng, x: number, z: number): void {
  // little kiosk / newsstand for street detail
  const hex = rng.pick(BUILDING_COLORS);
  b.add(x, 1, z, 2.2, 2, 2.2, hex, -1, 0, K_PROP, 1);
  b.add(x, 2.2, z, 2.8, 0.35, 2.8, 0xf5f0e6, -1, 0, K_PROP, 1);
}

/** Build the whole miniature city into a staging buffer. */
export function generateCity(seed = 20240617): CityData {
  const rng = new Rng(seed);
  const b = new VoxelBuilder();
  const buildings: BuildingDef[] = [];
  const parks: Array<{ x: number; z: number; r: number }> = [];
  let fountain: { x: number; z: number } | null = null;

  const mid = (BLOCKS - 1) / 2;
  const parkBlocks = new Set<string>([`1,4`, `4,1`, `0,2`]);
  const plazaBlocks = new Set<string>([`2,2`]);

  for (let bi = 0; bi < BLOCKS; bi++) {
    for (let bj = 0; bj < BLOCKS; bj++) {
      const key = `${bi},${bj}`;
      const bx = blockMin(bi);
      const bz = blockMin(bj);
      const ccx = bx + BLOCK / 2;
      const ccz = bz + BLOCK / 2;
      const distC = Math.max(Math.abs(bi - mid), Math.abs(bj - mid)) / mid;

      if (parkBlocks.has(key)) {
        parks.push({ x: ccx, z: ccz, r: BLOCK / 2 });
        const n = rng.int(7, 10);
        for (let t = 0; t < n; t++) {
          const tx = Math.round(bx + rng.range(2, BLOCK - 2));
          const tz = Math.round(bz + rng.range(2, BLOCK - 2));
          addTree(b, rng, tx, tz, rng.range(0.85, 1.15));
        }
        for (let f = 0; f < 16; f++) {
          const fx = Math.round(bx + rng.range(1, BLOCK - 1));
          const fz = Math.round(bz + rng.range(1, BLOCK - 1));
          b.add(fx, 0.35, fz, 1, 0.7, 1, rng.pick(FLOWERS), -1, 0, K_PROP, 1.1);
        }
        addBench(b, ccx - 3, ccz, true);
        addBench(b, ccx + 3, ccz, true);
        continue;
      }

      if (plazaBlocks.has(key)) {
        // central plaza with a fountain
        fountain = { x: ccx, z: ccz };
        const R = 4;
        for (let a = 0; a < 40; a++) {
          const ang = (a / 40) * Math.PI * 2;
          const fx = Math.round(ccx + Math.cos(ang) * R);
          const fz = Math.round(ccz + Math.sin(ang) * R);
          b.add(fx, 0.5, fz, 1, 1, 1, 0xe9e2d3, -1, 0, K_PROP, 1);
        }
        for (let i = -R + 1; i <= R - 1; i++)
          for (let j = -R + 1; j <= R - 1; j++) {
            if (i * i + j * j > (R - 1) * (R - 1)) continue;
            b.add(ccx + i, 0.32, ccz + j, 1, 0.28, 1, 0x7ed3ff, -1, 0, K_PROP, 1.15);
          }
        b.add(ccx, 1.6, ccz, 1.4, 3, 1.4, 0xf2ece0, -1, 0, K_PROP, 1);
        b.add(ccx, 3.4, ccz, 2.6, 0.5, 2.6, 0xf2ece0, -1, 0, K_PROP, 1);
        for (let t = 0; t < 4; t++) {
          const ang = (t / 4) * Math.PI * 2 + 0.4;
          addTree(b, rng, Math.round(ccx + Math.cos(ang) * 6), Math.round(ccz + Math.sin(ang) * 6), 1);
        }
        addLamp(b, ccx - 6, ccz - 6);
        addLamp(b, ccx + 6, ccz + 6);
        continue;
      }

      // ---- lots
      const landmarkBlock = distC < 0.5 && rng.bool(0.75);
      const roll = rng.next();
      type Lot = { x: number; z: number; w: number; d: number };
      let lots: Lot[];
      if (landmarkBlock) {
        lots = [{ x: ccx, z: ccz, w: 9, d: 9 }];
      } else if (roll < 0.34) {
        lots = [
          { x: bx + 4, z: bz + 4, w: 6, d: 6 },
          { x: bx + 10, z: bz + 4, w: 6, d: 6 },
          { x: bx + 4, z: bz + 10, w: 6, d: 6 },
          { x: bx + 10, z: bz + 10, w: 6, d: 6 },
        ];
      } else if (roll < 0.56) {
        lots = [
          { x: bx + 4, z: ccz, w: 6, d: 12 },
          { x: bx + 10, z: ccz, w: 6, d: 12 },
        ];
      } else if (roll < 0.74) {
        lots = [
          { x: ccx, z: bz + 4, w: 12, d: 6 },
          { x: ccx, z: bz + 10, w: 12, d: 6 },
        ];
      } else if (roll < 0.9) {
        lots = [
          { x: ccx, z: bz + 4, w: 12, d: 6 },
          { x: bx + 4, z: bz + 10, w: 6, d: 6 },
          { x: bx + 10, z: bz + 10, w: 6, d: 6 },
        ];
      } else {
        lots = [{ x: ccx, z: ccz, w: 11, d: 11 }];
      }
      // drop a lot occasionally so the grid never looks stamped
      if (lots.length > 2 && rng.bool(0.08)) lots.splice(rng.int(0, lots.length - 1), 1);

      for (const lot of lots) {
        const landmark = landmarkBlock || (distC < 0.55 && rng.bool(0.18));
        let levels: number;
        if (landmark) levels = rng.int(26, 44);
        else levels = Math.max(3, Math.round(6 + (1 - distC) * 13 + rng.range(-1, 7)));
        const def: BuildingDef = {
          id: buildings.length,
          cx: lot.x,
          cz: lot.z,
          w: lot.w,
          d: lot.d,
          levels,
          landmark,
          ids: [],
          levelTotal: [],
        };
        const style = landmark ? (rng.bool(0.5) ? 3 : 1) : rng.int(0, 2);
        addBuilding(b, def, rng, rng.pick(BUILDING_COLORS), style);
        buildings.push(def);
      }

      // street furniture on the block edges
      if (rng.bool(0.5)) addCarcass(b, rng, bx + rng.int(2, BLOCK - 2), bz - 1.6);
      if (rng.bool(0.45)) addTree(b, rng, bx + rng.int(2, BLOCK - 2), bz + BLOCK + 1.6, 0.85);
    }
  }

  // ---- street lamps along every road intersection ring
  for (let i = 0; i <= BLOCKS; i++) {
    for (let j = 0; j <= BLOCKS; j++) {
      const x = -CITY_HALF + i * (BLOCK + 6) + 1.2;
      const z = -CITY_HALF + j * (BLOCK + 6) + 1.2;
      if (Math.abs(x) > CITY_HALF - 1 || Math.abs(z) > CITY_HALF - 1) continue;
      addLamp(b, x, z);
    }
  }

  // ---- suburb ring: a few small houses outside the grid so edges feel alive
  for (let k = 0; k < 26; k++) {
    const side = k % 4;
    const t = rng.range(-CITY_HALF + 6, CITY_HALF - 6);
    const off = CITY_HALF + rng.range(6, 22);
    const x = side === 0 ? t : side === 1 ? off : side === 2 ? t : -off;
    const z = side === 0 ? -off : side === 1 ? t : side === 2 ? off : t;
    const def: BuildingDef = {
      id: buildings.length,
      cx: Math.round(x),
      cz: Math.round(z),
      w: rng.int(4, 6),
      d: rng.int(4, 6),
      levels: rng.int(2, 4),
      landmark: false,
      ids: [],
      levelTotal: [],
    };
    addBuilding(b, def, rng, rng.pick(BUILDING_COLORS), 0);
    buildings.push(def);
    if (rng.bool(0.7)) addTree(b, rng, def.cx + rng.int(-5, 5), def.cz + rng.int(-5, 5), 0.9);
  }

  return { builder: b, buildings, parks, fountain };
}

// ---------------------------------------------------------------- runtime
export interface RigidSink {
  spawnGroup(
    ids: number[],
    mode: 'topple' | 'fall',
    pivot: THREE.Vector3,
    axis: THREE.Vector3,
    spin: number,
  ): void;
}

interface BuildingState extends BuildingDef {
  idArr: Int32Array;
  total: number;
  alive: number;
  levelAlive: Int32Array;
  levelTotalArr: Int32Array;
  destroyed: boolean;
  gone: boolean;
  hitX: number;
  hitZ: number;
  cool: number;
}

/**
 * Structural bookkeeping: tracks how hollow each building is and decides when a
 * chunk should break off, a floor stack should drop, or the whole thing topples.
 */
export class City {
  readonly states: BuildingState[] = [];
  private dirty: number[] = [];
  private dirtySet = new Set<number>();
  collapses = 0;

  constructor(
    private readonly field: VoxelField,
    defs: BuildingDef[],
  ) {
    for (const d of defs) {
      const lt = new Int32Array(d.levels + 3);
      for (let i = 0; i < d.levelTotal.length && i < lt.length; i++) lt[i] = d.levelTotal[i];
      this.states.push({
        ...d,
        idArr: new Int32Array(d.ids),
        total: d.ids.length,
        alive: d.ids.length,
        levelAlive: lt.slice(),
        levelTotalArr: lt,
        destroyed: false,
        gone: false,
        hitX: 0,
        hitZ: 0,
        cool: 0,
      });
    }
  }

  reset(): void {
    for (const s of this.states) {
      s.alive = s.total;
      s.levelAlive.set(s.levelTotalArr);
      s.destroyed = false;
      s.gone = false;
      s.hitX = 0;
      s.hitZ = 0;
      s.cool = 0;
    }
    this.dirty.length = 0;
    this.dirtySet.clear();
    this.collapses = 0;
  }

  /** Must be called for every voxel that leaves the field. */
  notifyKilled(id: number): void {
    const bid = this.field.building[id];
    if (bid < 0) return;
    const s = this.states[bid];
    if (!s) return;
    s.alive--;
    const lv = this.field.level[id];
    if (lv < s.levelAlive.length) s.levelAlive[lv]--;
    if (!this.dirtySet.has(bid)) {
      this.dirtySet.add(bid);
      this.dirty.push(bid);
    }
  }

  /** Record the direction an impulse came from so toppling looks motivated. */
  pushDirection(id: number, dx: number, dz: number): void {
    const bid = this.field.building[id];
    if (bid < 0) return;
    const s = this.states[bid];
    if (!s) return;
    s.hitX += dx;
    s.hitZ += dz;
  }

  damageOf(bid: number): number {
    const s = this.states[bid];
    if (!s) return 0;
    return 1 - s.alive / Math.max(1, s.total);
  }

  /** Nudge every building toward failure (earthquake). */
  weakenAll(): BuildingState[] {
    return this.states;
  }

  aliveVoxelsOf(s: BuildingState, minLevel: number, cap: number, out: number[]): void {
    out.length = 0;
    const ids = s.idArr;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (this.field.alive[id] === 0) continue;
      if (this.field.level[id] < minLevel) continue;
      out.push(id);
      if (out.length >= cap) return;
    }
  }

  /** Random still-standing voxel of a building, biased to the lower floors. */
  randomAliveVoxel(bid: number, maxLevel = 255): number {
    const s = this.states[bid];
    if (!s || s.gone || s.alive === 0) return -1;
    const ids = s.idArr;
    for (let k = 0; k < 26; k++) {
      const id = ids[(Math.random() * ids.length) | 0];
      if (this.field.alive[id] === 0) continue;
      if (this.field.level[id] > maxLevel) continue;
      return id;
    }
    return -1;
  }

  /** Structural evaluation for the buildings touched since the last frame. */
  evaluate(sink: RigidSink, dt: number, aggressive: number): void {
    for (const s of this.states) if (s.cool > 0) s.cool -= dt;
    if (this.dirty.length === 0) return;
    const budget = Math.min(this.dirty.length, 12);
    for (let k = 0; k < budget; k++) {
      const bid = this.dirty.shift();
      if (bid === undefined) break;
      this.dirtySet.delete(bid);
      const s = this.states[bid];
      if (!s || s.gone || s.cool > 0) continue;
      if (s.alive === 0) {
        s.gone = true;
        continue;
      }
      const dmg = 1 - s.alive / s.total;
      // 1) find the lowest structurally failed level
      let failLevel = -1;
      for (let L = 0; L < s.levels; L++) {
        const t = s.levelTotalArr[L];
        if (t < 4) continue;
        if (s.levelAlive[L] / t < 0.42) {
          failLevel = L;
          break;
        }
      }
      // A hollowed-out base means the whole thing goes over; damage high up
      // only sheds the floors above the break.
      const topple =
        (failLevel >= 0 && failLevel <= 2) ||
        dmg > 0.34 - 0.1 * aggressive ||
        (s.landmark && dmg > 0.26);
      if (topple) {
        this.topple(s, sink);
        continue;
      }
      if (failLevel >= 3) {
        const above: number[] = [];
        this.aliveVoxelsOf(s, failLevel + 1, 1400, above);
        if (above.length > 8) {
          const pivot = new THREE.Vector3(s.cx, failLevel + 1, s.cz);
          sink.spawnGroup(above, 'fall', pivot, new THREE.Vector3(0, 1, 0), 0.5);
          s.cool = 0.6;
          this.collapses++;
        }
      }
    }
  }

  private topple(s: BuildingState, sink: RigidSink): void {
    const all: number[] = [];
    this.aliveVoxelsOf(s, 0, 2400, all);
    if (all.length < 4) {
      s.gone = true;
      return;
    }
    let dx = s.hitX;
    let dz = s.hitZ;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) {
      const a = (s.id * 2.399963) % (Math.PI * 2);
      dx = Math.cos(a);
      dz = Math.sin(a);
    } else {
      dx /= len;
      dz /= len;
    }
    // hinge along the base edge perpendicular to the fall direction
    const half = Math.max(s.w, s.d) * 0.5;
    const pivot = new THREE.Vector3(s.cx - dx * half * 0.85, 0.1, s.cz - dz * half * 0.85);
    const axis = new THREE.Vector3(-dz, 0, dx).normalize();
    sink.spawnGroup(all, 'topple', pivot, axis, 1);
    s.gone = true;
    this.collapses++;
  }
}
