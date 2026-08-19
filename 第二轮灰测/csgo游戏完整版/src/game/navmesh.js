// ---------------------------------------------------------------------------
// 导航网格：从地图几何体自动生成可行走格点图 + A* 寻路
// 做法：在 XZ 平面按 CELL 米划分，对每个格子求出所有"可站立平台"高度，
//       检查玩家 hull 的净空，再与 8 邻域按台阶高度/落差规则连边。
// 好处：地图作者只需要摆方块，不用手工标 waypoint。
// ---------------------------------------------------------------------------

import { MOVE } from './movement.js';
import { clamp } from '../core/math.js';

const CELL = 0.5;
const HULL_R = 0.29;          // 略小于玩家半径，避免贴墙格点被判死
const STAND_H = MOVE.standHeight;
const CROUCH_H = MOVE.crouchHeight;
const STEP = MOVE.stepHeight;
const MAX_DROP = 2.6;         // 允许的最大下落高度（单向边）

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node, f) {
    const a = this.a;
    a.push({ node, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      const t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        const t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  }
}

export class NavMesh {
  /**
   * @param {World} world
   * @param {object} opts
   *   opts.prune  是否剔除玩家到不了的孤岛（默认 true）
   *   opts.seeds  出生点等"一定可达"的世界坐标数组。用它来判定哪些连通域是
   *               真正的游玩区域——不能简单取"最大连通域"，因为室内地图的
   *               屋顶往往是一整片更大的可站立区域。
   */
  constructor(world, opts = {}) {
    this.world = world;
    this.opts = { prune: opts.prune !== false, seeds: opts.seeds || null };
    this.cell = CELL;
    const b = world.bounds;
    this.ox = b.min[0];
    this.oz = b.min[2];
    this.nx = Math.max(1, Math.ceil((b.max[0] - b.min[0]) / CELL));
    this.nz = Math.max(1, Math.ceil((b.max[2] - b.min[2]) / CELL));
    this.nodes = [];
    this.cellNodes = new Map();
    this._boxes = [];
    this._openStamp = 0;
    this.build();
  }

  key(ix, iz) { return iz * this.nx + ix; }
  cellCenter(ix, iz) { return [this.ox + (ix + 0.5) * CELL, this.oz + (iz + 0.5) * CELL]; }
  ixOf(x) { return Math.floor((x - this.ox) / CELL); }
  izOf(z) { return Math.floor((z - this.oz) / CELL); }

  /**
   * 站在 (x, y, z) 时的可用净空高度（0 = 站不住）。
   *
   * 关键点：顶面在"可自动上台阶高度"以内的实体**不算障碍**——玩家会直接踩上去。
   * 楼梯踏面只有 0.5m 深，而玩家 hull 宽 0.58m，必然与上一级踏面重叠；
   * 如果按普通 AABB 重叠判定，所有楼梯与高台都会被判成不可行走（Bot 只能待在平地）。
   */
  clearance(x, y, z) {
    const w = this.world;
    const min = [x - HULL_R, y + 0.02, z - HULL_R];
    const max = [x + HULL_R, y + STAND_H, z + HULL_R];
    w.overlaps(min, max, this._boxes);
    let ceiling = Infinity;
    for (const s of this._boxes) {
      if (s.max[1] <= y + STEP + 0.02) continue;      // 可踩上去的台阶/矮台
      if (s.min[1] <= y + 0.02) return 0;             // 从脚底就堵住：墙/箱子内部
      if (s.min[1] < ceiling) ceiling = s.min[1];     // 头顶障碍
    }
    const h = ceiling - y;
    if (h >= STAND_H) return STAND_H;
    if (h >= CROUCH_H) return CROUCH_H;
    return 0;
  }

  build() {
    const w = this.world;
    const b = w.bounds;
    const topY = b.max[1] + 1;
    const botY = b.min[1] - 1;
    const colBoxes = [];
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    for (let iz = 0; iz < this.nz; iz++) {
      for (let ix = 0; ix < this.nx; ix++) {
        const [cx, cz] = this.cellCenter(ix, iz);
        // 收集该列内所有实体的顶面作为候选站立面
        const cmin = [cx - HULL_R, botY, cz - HULL_R];
        const cmax = [cx + HULL_R, topY, cz + HULL_R];
        if (!w.overlaps(cmin, cmax, colBoxes)) continue;
        const cands = [];
        for (const s of colBoxes) {
          // 该实体的顶面必须真正覆盖格心，否则站不住
          if (cx < s.min[0] - 0.02 || cx > s.max[0] + 0.02) continue;
          if (cz < s.min[2] - 0.02 || cz > s.max[2] + 0.02) continue;
          cands.push(s.max[1]);
        }
        if (!cands.length) continue;
        cands.sort((a, c) => a - c);
        let prev = -Infinity;
        const list = [];
        for (const y of cands) {
          // 只合并几乎共面的候选面（阈值必须明显小于台阶高度 0.35~0.45）
          if (y - prev < 0.15) { prev = y; continue; }
          prev = y;
          if (y < b.min[1] - 0.5 || y > b.max[1]) continue;
          const cl = this.clearance(cx, y, cz);
          if (!cl) continue;
          const idx = this.nodes.length;
          this.nodes.push({
            i: idx, x: cx, y, z: cz, ix, iz,
            crouch: cl < STAND_H - 0.01,
            links: [], lcost: [],
          });
          list.push(idx);
        }
        if (list.length) this.cellNodes.set(this.key(ix, iz), list);
      }
    }

    // 连边
    const NB = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
    ];
    for (const n of this.nodes) {
      for (const [dx, dz, cost] of NB) {
        const nk = this.key(n.ix + dx, n.iz + dz);
        if (n.ix + dx < 0 || n.ix + dx >= this.nx || n.iz + dz < 0 || n.iz + dz >= this.nz) continue;
        const list = this.cellNodes.get(nk);
        if (!list) continue;
        // 对角线要求两个正交方向也通
        if (dx !== 0 && dz !== 0) {
          if (!this._hasNear(n.ix + dx, n.iz, n.y) || !this._hasNear(n.ix, n.iz + dz, n.y)) continue;
        }
        let best = -1, bestDy = Infinity;
        for (const j of list) {
          const m = this.nodes[j];
          const dy = m.y - n.y;
          if (dy > STEP + 0.02) continue;          // 上不去
          if (dy < -MAX_DROP) continue;            // 掉太深
          if (Math.abs(dy) < bestDy) { bestDy = Math.abs(dy); best = j; }
        }
        if (best < 0) continue;
        const m = this.nodes[best];
        // 中点净空检查，避免穿过薄墙/门框
        const mx = (n.x + m.x) / 2, mz = (n.z + m.z) / 2;
        const my = Math.max(n.y, m.y);
        if (!this.clearance(mx, my, mz)) continue;
        let c = cost * CELL;
        if (m.y - n.y > 0.05) c += 0.6;                 // 上台阶稍贵
        if (m.y - n.y < -0.6) c += (n.y - m.y) * 0.5;   // 跳下有风险
        if (m.crouch) c += 1.2;                         // 需要蹲的地方更慢
        n.links.push(best);
        n.lcost.push(c);
      }
    }

    this._labelRegions();
    this._prune();
    this._labelRegions();
    this._gScore = new Float32Array(this.nodes.length);
    this._fScore = new Float32Array(this.nodes.length);
    this._came = new Int32Array(this.nodes.length);
    this._state = new Uint8Array(this.nodes.length);
    this.buildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  }

  /**
   * 剔除玩家到不了的孤岛节点（墙顶、屋顶、箱子顶等）。
   * 保留的连通域由 opts.seeds（出生点）决定；没给种子时退化为"最大连通域"。
   */
  _prune() {
    if (!this.opts.prune || this.regionCount <= 1) return;
    const keepRegions = new Set();
    if (this.opts.seeds && this.opts.seeds.length) {
      for (const s of this.opts.seeds) {
        const n = this.nearest(s, 10);
        if (n >= 0) keepRegions.add(this.region[n]);
      }
    }
    if (!keepRegions.size) {
      if (this.mainRegion < 0) return;
      keepRegions.add(this.mainRegion);
    }
    let keepCount = 0;
    for (const r of keepRegions) keepCount += this.regionSizes[r];
    if (keepCount < 200) return;   // 保留区异常小，保守起见不剪
    const keep = [];
    const remap = new Int32Array(this.nodes.length).fill(-1);
    for (const n of this.nodes) {
      if (!keepRegions.has(this.region[n.i])) continue;
      remap[n.i] = keep.length;
      keep.push(n);
    }
    this.prunedCount = this.nodes.length - keep.length;
    for (let k = 0; k < keep.length; k++) {
      const n = keep[k];
      n.i = k;
      const links = [], lcost = [];
      for (let j = 0; j < n.links.length; j++) {
        const t = remap[n.links[j]];
        if (t >= 0) { links.push(t); lcost.push(n.lcost[j]); }
      }
      n.links = links; n.lcost = lcost;
    }
    this.nodes = keep;
    this.cellNodes.clear();
    for (const n of this.nodes) {
      const k = this.key(n.ix, n.iz);
      let list = this.cellNodes.get(k);
      if (!list) { list = []; this.cellNodes.set(k, list); }
      list.push(n.i);
    }
  }

  _hasNear(ix, iz, y) {
    const list = this.cellNodes.get(this.key(ix, iz));
    if (!list) return false;
    for (const j of list) if (Math.abs(this.nodes[j].y - y) <= STEP + 0.02) return true;
    return false;
  }

  /** 连通分量标记（用于校验出生点能否到达包点） */
  _labelRegions() {
    const n = this.nodes.length;
    this.region = new Int32Array(n).fill(-1);
    let r = 0;
    const stack = [];
    const sizes = [];
    for (let i = 0; i < n; i++) {
      if (this.region[i] !== -1) continue;
      let count = 0;
      stack.length = 0;
      stack.push(i);
      this.region[i] = r;
      while (stack.length) {
        const cur = stack.pop();
        count++;
        for (const j of this.nodes[cur].links) {
          if (this.region[j] === -1) { this.region[j] = r; stack.push(j); }
        }
      }
      sizes.push(count);
      r++;
    }
    this.regionCount = r;
    this.regionSizes = sizes;
    // 最大连通域视为主区域
    let bi = 0;
    for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[bi]) bi = i;
    this.mainRegion = sizes.length ? bi : -1;
  }

  /** 找离 pos 最近的可行走节点 */
  nearest(pos, maxRadiusCells = 8) {
    const ix0 = this.ixOf(pos[0]), iz0 = this.izOf(pos[2]);
    let best = -1, bestD = Infinity;
    for (let r = 0; r <= maxRadiusCells; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (r > 0 && Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const list = this.cellNodes.get(this.key(ix0 + dx, iz0 + dz));
          if (!list) continue;
          for (const j of list) {
            const n = this.nodes[j];
            const d = (n.x - pos[0]) ** 2 + (n.z - pos[2]) ** 2 + ((n.y - pos[1]) * 2.2) ** 2;
            if (d < bestD) { bestD = d; best = j; }
          }
        }
      }
      if (best >= 0 && r >= 1) break;
    }
    return best;
  }

  /** A*：返回节点索引数组（含起终点），失败返回 null */
  search(startIdx, goalIdx, maxExpand = 20000) {
    if (startIdx < 0 || goalIdx < 0) return null;
    if (startIdx === goalIdx) return [startIdx];
    const nodes = this.nodes;
    const g = this._gScore, f = this._fScore, came = this._came, state = this._state;
    state.fill(0);
    const goal = nodes[goalIdx];
    const h = (n) => Math.hypot(n.x - goal.x, (n.y - goal.y) * 1.6, n.z - goal.z);
    const open = new MinHeap();
    g[startIdx] = 0;
    f[startIdx] = h(nodes[startIdx]);
    came[startIdx] = -1;
    state[startIdx] = 1;
    open.push(startIdx, f[startIdx]);
    let expanded = 0;
    while (open.size) {
      const top = open.pop();
      const cur = top.node;
      if (state[cur] === 2) continue;
      state[cur] = 2;
      if (cur === goalIdx) break;
      if (++expanded > maxExpand) break;
      const n = nodes[cur];
      for (let k = 0; k < n.links.length; k++) {
        const j = n.links[k];
        if (state[j] === 2) continue;
        const ng = g[cur] + n.lcost[k];
        if (state[j] === 1 && ng >= g[j]) continue;
        g[j] = ng;
        came[j] = cur;
        state[j] = 1;
        f[j] = ng + h(nodes[j]);
        open.push(j, f[j]);
      }
    }
    if (state[goalIdx] !== 2) return null;
    const path = [];
    let c = goalIdx;
    let guard = 0;
    while (c !== -1 && guard++ < 100000) { path.push(c); c = came[c]; }
    path.reverse();
    return path;
  }

  /** hull 沿直线是否可走（用于路径平滑） */
  walkClear(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / (CELL * 0.7)));
    let prevY = a[1];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = a[0] + dx * t, z = a[2] + dz * t;
      const y = a[1] + dy * t;
      if (!this.clearance(x, y, z)) return false;
      // 地面连续性：不允许中途出现大坑或台阶
      const gy = this.world.groundHeight(x, y + 0.6, z);
      if (gy === -Infinity) return false;
      if (Math.abs(gy - y) > STEP + 0.25) return false;
      if (Math.abs(gy - prevY) > STEP + 0.25) return false;
      prevY = gy;
    }
    return true;
  }

  /** 寻路并返回世界坐标路点（已平滑） */
  findPath(from, to) {
    const s = this.nearest(from), t = this.nearest(to);
    if (s < 0 || t < 0) return null;
    const idx = this.search(s, t);
    if (!idx) return null;
    const pts = idx.map((i) => [this.nodes[i].x, this.nodes[i].y, this.nodes[i].z]);
    return this.smooth(pts);
  }

  smooth(pts) {
    if (pts.length <= 2) return pts;
    const out = [pts[0]];
    let i = 0;
    let guard = 0;
    while (i < pts.length - 1 && guard++ < 2000) {
      let j = pts.length - 1;
      // 从最远处往回找第一个可直达的点
      for (; j > i + 1; j--) {
        if (Math.abs(pts[j][1] - pts[i][1]) > 0.5) continue;
        if (this.walkClear(pts[i], pts[j])) break;
      }
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  /** 在区域内随机取一个可行走点 */
  randomInArea(min, max, tries = 60) {
    for (let k = 0; k < tries; k++) {
      const x = min[0] + Math.random() * (max[0] - min[0]);
      const z = min[2] + Math.random() * (max[2] - min[2]);
      const idx = this.nearest([x, (min[1] + max[1]) / 2, z], 3);
      if (idx >= 0) {
        const n = this.nodes[idx];
        if (n.x >= min[0] - 1 && n.x <= max[0] + 1 && n.z >= min[2] - 1 && n.z <= max[2] + 1) {
          return [n.x, n.y, n.z];
        }
      }
    }
    return null;
  }

  /** 收集区域内所有节点位置 */
  nodesInArea(min, max) {
    const out = [];
    for (const n of this.nodes) {
      if (n.x >= min[0] && n.x <= max[0] && n.z >= min[2] && n.z <= max[2] &&
          n.y >= min[1] - 1.5 && n.y <= max[1] + 1.5) out.push([n.x, n.y, n.z]);
    }
    return out;
  }

  /** 两点是否在同一连通域 */
  connected(a, b) {
    const i = this.nearest(a), j = this.nearest(b);
    if (i < 0 || j < 0) return false;
    return this.region[i] === this.region[j];
  }

  get stats() {
    return {
      nodes: this.nodes.length, regions: this.regionCount,
      mainRegionSize: this.mainRegion >= 0 ? this.regionSizes[this.mainRegion] : 0,
      buildMs: Math.round(this.buildMs),
      grid: `${this.nx}x${this.nz}`,
    };
  }
}
