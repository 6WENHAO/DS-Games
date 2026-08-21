/* ===================================================================
   pathfind.js — 网格 A* + 视线平滑 + 分帧预算队列

   为什么这么设计：
   1. RTS 里几十个单位同时点右键，如果每个都同帧跑完整 A*，会瞬间卡死。
      所以所有寻路走 R.PathQueue，每帧只消耗固定的"节点预算"，
      算不完就留到下一帧（单位在此期间先朝目标直走，观感上无缝）。
   2. A* 产出的格子路径是锯齿状的，直接走会贴墙拐直角。
      用 losClear() 做视线裁剪，把路径压成少量拐点，走起来才顺。
   3. 单位之间的碰撞**不进 A***（否则每帧都要重算）。
      单位互相推挤由 entity.js 里的局部避让处理，A* 只管静态地形与建筑。
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const U = R.U, T = R.TILE;

  const STRAIGHT = 10, DIAG = 14;

  /* ================== 复用的工作缓冲（避免每次分配） ================== */
  const W = {
    w: 0, h: 0, n: 0,
    g: null, from: null, stamp: null, closed: null,
    gen: 0, heap: null,
  };

  function ensure(map) {
    const n = map.w * map.h;
    if (W.n !== n) {
      W.n = n; W.w = map.w; W.h = map.h;
      W.g = new Float32Array(n);
      W.from = new Int32Array(n);
      W.stamp = new Int32Array(n);
      W.closed = new Uint8Array(n);
      W.gen = 0;
    }
    W.w = map.w; W.h = map.h;
    if (!W.heap) W.heap = new R.Heap();
    W.gen++;
    W.heap.clear();
  }

  /** 八方向偏移 */
  const DX = [1, 1, 0, -1, -1, -1, 0, 1];
  const DY = [0, 1, 1, 1, 0, -1, -1, -1];

  /* ======================= 视线检测 =======================
     从世界坐标 (x0,y0) 到 (x1,y1) 之间是否没有阻挡格。
     用"超覆盖"网格步进：只要经过的任一格阻挡就返回 false。
     ======================================================= */
  function losClear(map, x0, y0, x1, y1) {
    let cx = Math.floor(x0 / T), cy = Math.floor(y0 / T);
    const ex = Math.floor(x1 / T), ey = Math.floor(y1 / T);
    if (!map.passable(cx, cy)) return false;
    const dx = x1 - x0, dy = y1 - y0;
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const invX = dx !== 0 ? 1 / Math.abs(dx) : Infinity;
    const invY = dy !== 0 ? 1 / Math.abs(dy) : Infinity;
    // 到下一条格线的参数距离
    let tMaxX = dx !== 0
      ? ((dx > 0 ? (cx + 1) * T - x0 : x0 - cx * T) * invX)
      : Infinity;
    let tMaxY = dy !== 0
      ? ((dy > 0 ? (cy + 1) * T - y0 : y0 - cy * T) * invY)
      : Infinity;
    const tDeltaX = dx !== 0 ? T * invX : Infinity;
    const tDeltaY = dy !== 0 ? T * invY : Infinity;
    let guard = 0;
    while ((cx !== ex || cy !== ey) && guard++ < 4096) {
      if (tMaxX < tMaxY) { cx += stepX; tMaxX += tDeltaX; }
      else { cy += stepY; tMaxY += tDeltaY; }
      if (!map.passable(cx, cy)) return false;
    }
    return true;
  }
  R.losClear = losClear;

  /**
   * 对角移动是否允许。
   * 这里**要求两侧都可通行**，而不是只要一侧 —— 原因有两个：
   *   1. 单位有体积（canStand 检查身体四角），只放过一侧会让单位
   *      斜着挤过两块岩石的夹缝，然后卡死在里面；
   *   2. losClear 的网格步进必然会经过其中一侧的格子，
   *      只放过一侧会导致"平滑后的路径视线不通"，路径直接失效。
   */
  function diagOk(map, cx, cy, nx, ny) {
    return map.passable(nx, cy) && map.passable(cx, ny);
  }

  /* ======================= 核心 A* =======================
     返回格坐标数组 [{cx,cy}...]（含终点，不含起点），或 null。
     opts: { maxNodes, tolerance }
       tolerance —— 允许停在距目标 tolerance 格内（攻击建筑时用）
     ======================================================= */
  function astar(map, scx, scy, tcx, tcy, opts) {
    opts = opts || {};
    const maxNodes = opts.maxNodes || 7000;
    const tol = opts.tolerance || 0;
    const w = map.w, h = map.h;

    if (scx === tcx && scy === tcy) return [];
    ensure(map);
    const gen = W.gen, g = W.g, from = W.from, stamp = W.stamp, closed = W.closed;
    const heap = W.heap;

    const hcost = (x, y) => {
      const dx = Math.abs(x - tcx), dy = Math.abs(y - tcy);
      return STRAIGHT * (dx + dy) + (DIAG - 2 * STRAIGHT) * Math.min(dx, dy);
    };

    const start = scy * w + scx;
    stamp[start] = gen; g[start] = 0; from[start] = -1; closed[start] = 0;
    heap.push(start, hcost(scx, scy));

    let expanded = 0;
    let bestNode = start, bestH = hcost(scx, scy);

    while (heap.size > 0) {
      const cur = heap.pop();
      if (closed[cur] === 1 && stamp[cur] === gen) continue;
      closed[cur] = 1; stamp[cur] = gen;
      const cx = cur % w, cy = (cur / w) | 0;

      const dxT = Math.abs(cx - tcx), dyT = Math.abs(cy - tcy);
      if ((cx === tcx && cy === tcy) || (tol > 0 && Math.max(dxT, dyT) <= tol)) {
        return rebuild(from, cur, w, gen, stamp);
      }
      const hh = hcost(cx, cy);
      if (hh < bestH) { bestH = hh; bestNode = cur; }

      if (++expanded > maxNodes) break;

      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!map.passable(nx, ny)) continue;
        const diag = (d & 1) === 1;
        if (diag && !diagOk(map, cx, cy, nx, ny)) continue;
        const nb = ny * w + nx;
        if (stamp[nb] === gen && closed[nb] === 1) continue;
        const step = diag ? DIAG : STRAIGHT;
        const ng = g[cur] + step;
        if (stamp[nb] !== gen || ng < g[nb]) {
          if (stamp[nb] !== gen) { stamp[nb] = gen; closed[nb] = 0; }
          g[nb] = ng; from[nb] = cur;
          heap.push(nb, ng + hcost(nx, ny));
        }
      }
    }

    // 没走到终点：退回"最接近目标"的节点，让单位至少朝那边挪
    if (bestNode !== start) return rebuild(from, bestNode, w, gen, stamp);
    return null;
  }

  function rebuild(from, node, w, gen, stamp) {
    const out = [];
    let guard = 0;
    while (node !== -1 && guard++ < 100000) {
      out.push({ cx: node % w, cy: (node / w) | 0 });
      node = from[node];
    }
    out.pop();          // 去掉起点
    out.reverse();
    return out;
  }

  /* ======================= 路径平滑 =======================
     把格路径压成尽量少的世界坐标拐点。
     贪心：从当前锚点尽量往后找"视线可达"的最远点。
     ======================================================= */
  function smooth(map, cells, sx, sy) {
    const pts = [];
    if (!cells || cells.length === 0) return pts;
    let ax = sx, ay = sy;
    let i = 0;
    let guard = 0;
    while (i < cells.length && guard++ < 4096) {
      let best = i;
      // 从最远往回找第一个可达的
      for (let j = cells.length - 1; j > i; j--) {
        const c = cells[j];
        const wx = (c.cx + 0.5) * T, wy = (c.cy + 0.5) * T;
        if (losClear(map, ax, ay, wx, wy)) { best = j; break; }
      }
      const c = cells[best];
      const wx = (c.cx + 0.5) * T, wy = (c.cy + 0.5) * T;
      pts.push({ x: wx, y: wy });
      ax = wx; ay = wy;
      if (best === i) i++; else i = best + 1;
    }
    return pts;
  }

  /** 找离目标最近的可通行格（目标被占时用） */
  function nearestPassable(map, tcx, tcy, maxR) {
    if (map.passable(tcx, tcy)) return { cx: tcx, cy: tcy };
    maxR = maxR || 10;
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tcx + dx, y = tcy + dy;
          if (map.passable(x, y)) return { cx: x, cy: y };
        }
      }
    }
    return null;
  }

  R.Path = {
    astar, smooth, losClear, nearestPassable,

    /**
     * 一站式：世界坐标 → 世界坐标拐点数组（不含起点）。
     * 返回 [] 表示"已在目标处"，null 表示完全无路。
     */
    find(map, sx, sy, tx, ty, opts) {
      opts = opts || {};
      const scx = Math.floor(sx / T), scy = Math.floor(sy / T);
      let tcx = Math.floor(tx / T), tcy = Math.floor(ty / T);
      if (!map.passable(tcx, tcy) && !opts.tolerance) {
        const np = nearestPassable(map, tcx, tcy, opts.searchR || 8);
        if (!np) return null;
        tcx = np.cx; tcy = np.cy;
      }
      const cells = astar(map, scx, scy, tcx, tcy, opts);
      if (!cells) return null;
      if (cells.length === 0) return [];
      const pts = smooth(map, cells, sx, sy);
      // 终点用精确点（除非那格不可走）
      if (pts.length && opts.exact !== false) {
        const last = pts[pts.length - 1];
        if (Math.floor(tx / T) === Math.floor(last.x / T) &&
            Math.floor(ty / T) === Math.floor(last.y / T)) {
          last.x = tx; last.y = ty;
        }
      }
      return pts;
    },
  };

  /* ==================================================================
     分帧预算队列
     单位调用 queue.push(unit, tx, ty, opts)；同一单位重复请求会覆盖旧的。
     每帧 process() 用节点预算限流。
     ================================================================== */
  R.PathQueue = class PathQueue {
    constructor(map) {
      this.map = map;
      this.list = [];               // [{unit, tx, ty, opts}]
      this.pending = new Map();     // unit.id → 请求对象
      this.budget = 14000;          // 每帧可展开的 A* 节点总数
      this.stats = { requests: 0, done: 0, fails: 0, nodes: 0 };
    }
    /** 立即清空（换地图时） */
    clear() { this.list.length = 0; this.pending.clear(); }

    push(unit, tx, ty, opts) {
      const old = this.pending.get(unit.id);
      if (old) { old.tx = tx; old.ty = ty; old.opts = opts || old.opts; return; }
      const req = { unit, tx, ty, opts: opts || {}, };
      this.pending.set(unit.id, req);
      this.list.push(req);
      this.stats.requests++;
      unit.pathPending = true;
    }
    cancel(unit) {
      const req = this.pending.get(unit.id);
      if (req) { req.dead = true; this.pending.delete(unit.id); unit.pathPending = false; }
    }
    get size() { return this.list.length; }

    process() {
      let spent = 0;
      let guard = 0;
      while (this.list.length && spent < this.budget && guard++ < 400) {
        const req = this.list.shift();
        if (req.dead) continue;
        this.pending.delete(req.unit.id);
        const u = req.unit;
        u.pathPending = false;
        if (u.dead) continue;
        const cap = Math.min(7000, Math.max(900, this.budget - spent));
        const opts = req.opts;
        const pts = R.Path.find(this.map, u.x, u.y, req.tx, req.ty, {
          maxNodes: cap,
          tolerance: opts.tolerance || 0,
          searchR: opts.searchR || 8,
        });
        // 粗略计入消耗：拐点数无法反映搜索量，按上限的一部分估
        spent += Math.min(cap, 380 + (pts ? pts.length * 60 : cap));
        if (pts && pts.length) {
          u.setPath(pts);
          this.stats.done++;
        } else if (pts && pts.length === 0) {
          u.setPath([]);
          this.stats.done++;
        } else {
          u.onPathFail();
          this.stats.fails++;
        }
      }
      this.stats.nodes = spent;
    }
  };

})();
