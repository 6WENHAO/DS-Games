// ---------------------------------------------------------------------------
// 世界：把地图数据（轴对齐 brush + props）编译成
//   1) 碰撞体列表 + XZ 均匀网格加速结构
//   2) 按材质分组的静态渲染批次（自动剔除被完全遮挡的面）
// 并提供射线检测、盒体重叠、地面高度、区域查询等服务。
// ---------------------------------------------------------------------------

import { MeshBuilder, GPUMesh } from '../render/mesh.js';
import { MATERIALS } from '../render/textures.js';
import { v3, rayAABB, pointInAABB, pointInAABBxz, clamp } from '../core/math.js';

const EPS = 1e-4;

// 材质 -> 脚步声 / 弹孔贴花 / 命中音
const MAT_SURFACE = {
  sand: ['step_dirt', 'bullet_decal_dirt', 'hit_dirt'],
  sandstone: ['step_concrete', 'hole', 'hit_concrete'],
  sandbrick: ['step_concrete', 'hole', 'hit_concrete'],
  concrete: ['step_concrete', 'hole', 'hit_concrete'],
  concrete_dark: ['step_concrete', 'hole', 'hit_concrete'],
  brick: ['step_concrete', 'hole', 'hit_concrete'],
  plaster: ['step_concrete', 'hole', 'hit_concrete'],
  stone: ['step_concrete', 'hole', 'hit_concrete'],
  tile: ['step_concrete', 'hole', 'hit_concrete'],
  wood: ['step_wood', 'bullet_decal_wood', 'hit_wood'],
  crate: ['step_wood', 'bullet_decal_wood', 'hit_wood'],
  metal: ['step_metal', 'bullet_decal_metal', 'hit_metal'],
  metal_plate: ['step_metal', 'bullet_decal_metal', 'hit_metal'],
  roof_tile: ['step_concrete', 'hole', 'hit_concrete'],
  dirt: ['step_dirt', 'bullet_decal_dirt', 'hit_dirt'],
  gravel: ['step_gravel', 'bullet_decal_dirt', 'hit_dirt'],
  grass: ['step_grass', 'bullet_decal_dirt', 'hit_dirt'],
  glass: ['step_concrete', 'bullet_decal_glass', 'hit_glass'],
  rubber: ['step_concrete', 'hole', 'hit_wood'],
  canvas: ['step_dirt', 'bullet_decal_wood', 'hit_wood'],
  sandbag: ['step_dirt', 'bullet_decal_dirt', 'hit_dirt'],
  cloth: ['step_dirt', 'bullet_decal_dirt', 'hit_dirt'],
};

// props 类型默认材质
const PROP_MAT = {
  crate: 'crate', barrel: 'metal', box: 'concrete', sandbag: 'sandbag',
  table: 'wood', desk: 'wood', plant: 'stone', locker: 'metal',
  sofa: 'cloth', pillar: 'concrete',
};

export function surfaceInfo(mat) {
  const s = MAT_SURFACE[mat] || MAT_SURFACE.concrete;
  return { step: s[0], decal: s[1], impact: s[2] };
}

export class World {
  constructor(gl, map) {
    this.gl = gl;
    this.map = map;
    this.solids = [];        // { min, max, mat, climb }
    this.batches = [];
    this.cellSize = 5;
    this.grid = null;
    this._stamp = null;
    this._stampVal = 1;
    this.bounds = { min: map.bounds.min.slice(), max: map.bounds.max.slice() };
    this.build();
  }

  build() {
    const map = this.map;
    const solids = this.solids;
    const drawList = [];   // { min,max,mat,tile,localUV,nodraw,shape }

    for (const b of map.brushes) {
      const min = [Math.min(b.min[0], b.max[0]), Math.min(b.min[1], b.max[1]), Math.min(b.min[2], b.max[2])];
      const max = [Math.max(b.min[0], b.max[0]), Math.max(b.min[1], b.max[1]), Math.max(b.min[2], b.max[2])];
      if (max[0] - min[0] < EPS || max[1] - min[1] < EPS || max[2] - min[2] < EPS) continue;
      const mat = MATERIALS[b.mat] ? b.mat : 'concrete';
      const item = { min, max, mat, tile: b.tile, nodraw: b.nodraw || null, localUV: false, shape: 'box' };
      drawList.push(item);
      if (!b.noclip) solids.push({ min, max, mat, climb: !!b.climb });
    }

    for (const p of map.props || []) {
      const s = p.size || [1, 1, 1];
      const pos = p.pos;
      const min = [pos[0] - s[0] / 2, pos[1], pos[2] - s[2] / 2];
      const max = [pos[0] + s[0] / 2, pos[1] + s[1], pos[2] + s[2] / 2];
      const mat = MATERIALS[p.mat] ? p.mat : (PROP_MAT[p.type] || 'crate');
      const localUV = mat === 'crate' || p.type === 'crate' || p.type === 'box' || p.type === 'locker';
      drawList.push({ min, max, mat, tile: p.tile, nodraw: null, localUV, shape: p.type === 'barrel' ? 'cylinder' : 'box' });
      if (!p.noclip) solids.push({ min, max, mat, climb: false });
    }

    this._buildGrid();
    this._buildBatches(drawList);
    this._buildLookups();
  }

  // ------------------------- 加速结构 ---------------------------------------

  _buildGrid() {
    const cs = this.cellSize;
    const bmin = this.bounds.min, bmax = this.bounds.max;
    const nx = Math.max(1, Math.ceil((bmax[0] - bmin[0]) / cs) + 2);
    const nz = Math.max(1, Math.ceil((bmax[2] - bmin[2]) / cs) + 2);
    const cells = new Array(nx * nz);
    for (let i = 0; i < cells.length; i++) cells[i] = null;
    const ox = bmin[0] - cs, oz = bmin[2] - cs;
    const g = { nx, nz, cs, ox, oz, cells };
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      const x0 = clamp(Math.floor((s.min[0] - ox) / cs), 0, nx - 1);
      const x1 = clamp(Math.floor((s.max[0] - ox) / cs), 0, nx - 1);
      const z0 = clamp(Math.floor((s.min[2] - oz) / cs), 0, nz - 1);
      const z1 = clamp(Math.floor((s.max[2] - oz) / cs), 0, nz - 1);
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const k = z * nx + x;
          if (!cells[k]) cells[k] = [];
          cells[k].push(i);
        }
      }
    }
    this.grid = g;
    this._stamp = new Int32Array(this.solids.length);
    this._stampVal = 1;
  }

  _cellIndex(x, z) {
    const g = this.grid;
    const cx = Math.floor((x - g.ox) / g.cs);
    const cz = Math.floor((z - g.oz) / g.cs);
    if (cx < 0 || cz < 0 || cx >= g.nx || cz >= g.nz) return -1;
    return cz * g.nx + cx;
  }

  // ------------------------- 渲染批次 ---------------------------------------

  /** 判断某个面是否被其它 brush 完全覆盖（用于剔除内部面） */
  _faceCovered(item, axis, positive, all) {
    const min = item.min, max = item.max;
    const plane = positive ? max[axis] : min[axis];
    // 该面在另两个轴上的范围
    const a1 = (axis + 1) % 3, a2 = (axis + 2) % 3;
    const probeMin = [min[0], min[1], min[2]];
    const probeMax = [max[0], max[1], max[2]];
    if (positive) { probeMin[axis] = plane + 0.002; probeMax[axis] = plane + 0.05; }
    else { probeMin[axis] = plane - 0.05; probeMax[axis] = plane - 0.002; }
    for (const o of all) {
      if (o === item) continue;
      if (o.shape !== 'box') continue;
      const om = o.min, oM = o.max;
      // 邻接面必须贴合
      if (positive) { if (Math.abs(om[axis] - plane) > 0.01) continue; }
      else { if (Math.abs(oM[axis] - plane) > 0.01) continue; }
      if (om[a1] <= min[a1] + 0.005 && oM[a1] >= max[a1] - 0.005 &&
          om[a2] <= min[a2] + 0.005 && oM[a2] >= max[a2] - 0.005) {
        return true;
      }
    }
    return false;
  }

  _buildBatches(drawList) {
    // 为覆盖检测建一个粗网格（XZ），避免 O(n^2)
    const cs = 8;
    const buckets = new Map();
    const key = (x, z) => x + ',' + z;
    for (const it of drawList) {
      const x0 = Math.floor(it.min[0] / cs), x1 = Math.floor(it.max[0] / cs);
      const z0 = Math.floor(it.min[2] / cs), z1 = Math.floor(it.max[2] / cs);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const k = key(x, z);
        let arr = buckets.get(k);
        if (!arr) { arr = []; buckets.set(k, arr); }
        arr.push(it);
      }
    }
    const neighbors = (it) => {
      const out = new Set();
      const x0 = Math.floor((it.min[0] - 0.2) / cs), x1 = Math.floor((it.max[0] + 0.2) / cs);
      const z0 = Math.floor((it.min[2] - 0.2) / cs), z1 = Math.floor((it.max[2] + 0.2) / cs);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const arr = buckets.get(key(x, z));
        if (arr) for (const o of arr) out.add(o);
      }
      return out;
    };

    const byMat = new Map();
    const AXIS_FACE = [['-x', '+x'], ['-y', '+y'], ['-z', '+z']];
    let culled = 0, total = 0;
    for (const it of drawList) {
      let mb = byMat.get(it.mat);
      if (!mb) { mb = new MeshBuilder(); byMat.set(it.mat, mb); }
      const matDef = MATERIALS[it.mat] || { tile: 1 };
      const tile = it.tile !== undefined && it.tile !== null ? it.tile : (matDef.tile || 1);
      if (it.shape === 'cylinder') {
        const r = Math.min(it.max[0] - it.min[0], it.max[2] - it.min[2]) * 0.5;
        mb.cylinder((it.min[0] + it.max[0]) / 2, it.min[1], (it.min[2] + it.max[2]) / 2, r, it.max[1], 14, true);
        continue;
      }
      const nodraw = new Set(it.nodraw || []);
      const nb = neighbors(it);
      for (let axis = 0; axis < 3; axis++) {
        for (let s = 0; s < 2; s++) {
          const face = AXIS_FACE[axis][s];
          total++;
          if (nodraw.has(face)) { culled++; continue; }
          if (this._faceCovered(it, axis, s === 1, nb)) { nodraw.add(face); culled++; }
        }
      }
      mb.box(it.min, it.max, tile, [...nodraw], it.localUV);
    }
    this.batches = [];
    for (const [mat, mb] of byMat) {
      if (mb.empty) continue;
      // gl 为 null 时只做几何统计（Node 端地图校验用）
      this.batches.push({ mat, mesh: this.gl ? new GPUMesh(this.gl, mb) : { count: mb.idx.length, draw() {} } });
    }
    this.stats = { brushes: drawList.length, faces: total, culledFaces: culled, batches: this.batches.length };
  }

  // ------------------------- 区域查询 ---------------------------------------

  _buildLookups() {
    const m = this.map;
    this.bombsites = (m.bombsites || []).map((s) => ({
      name: s.name, min: s.min, max: s.max,
      center: [(s.min[0] + s.max[0]) / 2, s.min[1] + 0.1, (s.min[2] + s.max[2]) / 2],
    }));
    this.areas = m.areas || [];
    this.buyzones = m.buyzones || {};
  }

  areaName(p) {
    for (const a of this.areas) {
      if (pointInAABB(p, a.min, a.max)) return a.name;
    }
    // 退化：只比 XZ
    for (const a of this.areas) {
      if (pointInAABBxz(p, a.min, a.max)) return a.name;
    }
    return '';
  }

  bombsiteAt(p) {
    for (const s of this.bombsites) {
      if (p[0] >= s.min[0] && p[0] <= s.max[0] && p[2] >= s.min[2] && p[2] <= s.max[2] &&
          p[1] >= s.min[1] - 0.5 && p[1] <= s.max[1] + 1.5) return s;
    }
    return null;
  }

  inBuyzone(p, team) {
    const z = this.buyzones[team];
    if (!z) return false;
    return p[0] >= z.min[0] && p[0] <= z.max[0] && p[2] >= z.min[2] && p[2] <= z.max[2] &&
           p[1] >= z.min[1] - 1 && p[1] <= z.max[1] + 1;
  }

  // ------------------------- 碰撞查询 ---------------------------------------

  /** 返回与 AABB 重叠的实体列表（写入 out 并返回其长度） */
  overlaps(min, max, out) {
    out.length = 0;
    const g = this.grid, cs = g.cs;
    const x0 = clamp(Math.floor((min[0] - g.ox) / cs), 0, g.nx - 1);
    const x1 = clamp(Math.floor((max[0] - g.ox) / cs), 0, g.nx - 1);
    const z0 = clamp(Math.floor((min[2] - g.oz) / cs), 0, g.nz - 1);
    const z1 = clamp(Math.floor((max[2] - g.oz) / cs), 0, g.nz - 1);
    const stamp = this._stamp, sv = this._stampVal++;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const cell = g.cells[z * g.nx + x];
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const id = cell[i];
          if (stamp[id] === sv) continue;
          stamp[id] = sv;
          const s = this.solids[id];
          if (min[0] < s.max[0] && max[0] > s.min[0] &&
              min[1] < s.max[1] && max[1] > s.min[1] &&
              min[2] < s.max[2] && max[2] > s.min[2]) {
            out.push(s);
          }
        }
      }
    }
    return out.length;
  }

  /** 点是否在实体内部 */
  isSolid(p) {
    const g = this.grid;
    const k = this._cellIndex(p[0], p[2]);
    if (k < 0) return true;   // 出界视为实心
    const cell = g.cells[k];
    if (!cell) return false;
    for (const id of cell) {
      const s = this.solids[id];
      if (p[0] >= s.min[0] && p[0] <= s.max[0] && p[1] >= s.min[1] && p[1] <= s.max[1] &&
          p[2] >= s.min[2] && p[2] <= s.max[2]) return true;
    }
    return false;
  }

  /**
   * 射线检测（对实体 AABB）。
   * @returns null 或 { t, point:[x,y,z], normal:[x,y,z], mat, solid }
   */
  traceRay(o, d, maxT = 1000) {
    const g = this.grid, cs = g.cs;
    const stamp = this._stamp, sv = this._stampVal++;
    let best = null, bestT = maxT;

    // 2D DDA 遍历 XZ 网格
    let cx = Math.floor((o[0] - g.ox) / cs);
    let cz = Math.floor((o[2] - g.oz) / cs);
    const stepX = d[0] > 0 ? 1 : -1;
    const stepZ = d[2] > 0 ? 1 : -1;
    const invdx = Math.abs(d[0]) > 1e-9 ? 1 / Math.abs(d[0]) : Infinity;
    const invdz = Math.abs(d[2]) > 1e-9 ? 1 / Math.abs(d[2]) : Infinity;
    const nextBX = g.ox + (cx + (stepX > 0 ? 1 : 0)) * cs;
    const nextBZ = g.oz + (cz + (stepZ > 0 ? 1 : 0)) * cs;
    let tMaxX = invdx === Infinity ? Infinity : Math.abs(nextBX - o[0]) * invdx;
    let tMaxZ = invdz === Infinity ? Infinity : Math.abs(nextBZ - o[2]) * invdz;
    const tDeltaX = invdx === Infinity ? Infinity : cs * invdx;
    const tDeltaZ = invdz === Infinity ? Infinity : cs * invdz;
    let guard = 0;

    while (guard++ < 4096) {
      if (cx >= 0 && cz >= 0 && cx < g.nx && cz < g.nz) {
        const cell = g.cells[cz * g.nx + cx];
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const id = cell[i];
            if (stamp[id] === sv) continue;
            stamp[id] = sv;
            const s = this.solids[id];
            const h = rayAABB(o, d, s.min, s.max, bestT);
            if (h && h.t < bestT && h.t >= 0) {
              bestT = h.t;
              best = { t: h.t, normal: h.normal, mat: s.mat, solid: s };
            }
          }
        }
      }
      const tCell = Math.min(tMaxX, tMaxZ);
      if (best && bestT <= tCell) break;
      if (tCell > maxT) break;
      if (tMaxX < tMaxZ) { cx += stepX; tMaxX += tDeltaX; }
      else { cz += stepZ; tMaxZ += tDeltaZ; }
      if (tMaxX === Infinity && tMaxZ === Infinity) break;
    }
    if (!best) return null;
    best.point = [o[0] + d[0] * best.t, o[1] + d[1] * best.t, o[2] + d[2] * best.t];
    return best;
  }

  /** 两点之间是否通畅（视线检测） */
  visible(a, b, pad = 0) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return true;
    const d = [dx / len, dy / len, dz / len];
    const h = this.traceRay(a, d, len - pad);
    return !h;
  }

  /**
   * 求 (x,z) 处从 fromY 向下的地面高度（参数顺序即 x,y,z）。找不到返回 -Infinity。
   */
  groundHeight(x, fromY, z) {
    const h = this.traceRay([x, fromY, z], [0, -1, 0], 200);
    return h ? h.point[1] : -Infinity;
  }
}
