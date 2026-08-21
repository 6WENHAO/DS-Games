/* ===================================================================
   mapgen.js — 地图数据结构 + 程序化地形生成

   设计要点：
   1. 为了公平，地图采用 **180° 旋转对称**：写入 (x,y) 时同步写入
      (w-1-x, h-1-y)。两名玩家的地形、矿量、障碍完全镜像。
   2. 地形分类（terrain 数组）：
        0 grass 草地（可通行、可建造）
        1 dirt  沙土（可通行、可建造）
        2 rock  岩石（不可通行、不可建造）
        3 water 水面（不可通行、不可建造）
        4 shore 浅滩（可通行、可建造，视觉过渡）
   3. 矿脉单独存在 ore 数组里（叠加在地形之上），采空后可从 oreSeed
      标记的"矿心"缓慢再生 —— 这样长局不会因为矿枯竭而僵死。
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const U = R.U, T = R.TILE;

  const GRASS = 0, DIRT = 1, ROCK = 2, WATER = 3, SHORE = 4;
  R.TERRAIN = { GRASS, DIRT, ROCK, WATER, SHORE };
  R.TERRAIN_NAME = ['草地', '沙土', '岩石', '水面', '浅滩'];

  /** 地形是否允许地面单位通过 */
  const PASSABLE = [true, true, false, false, true];
  /** 地形是否允许建造 */
  const BUILDABLE = [true, true, false, false, true];

  R.GameMap = class GameMap {
    constructor(w, h) {
      this.w = w; this.h = h;
      const n = w * h;
      this.terrain = new Uint8Array(n);
      this.variant = new Uint8Array(n);
      this.ore = new Float32Array(n);
      this.oreSeed = new Uint8Array(n);   // 1 = 矿心，可再生
      /** 建筑占用：存 entity.id，0 表示空 */
      this.occupied = new Int32Array(n);
      /** 静态阻挡（地形），寻路时与 occupied 一起看 */
      this.solid = new Uint8Array(n);
      this.starts = [];      // [{cx,cy}] 出生点（建造厂中心格）
      this.oreFields = [];   // [{cx,cy,r}] 供 AI 与采矿车寻矿
      this.seed = 1;
    }

    idx(cx, cy) { return cy * this.w + cx; }
    inBounds(cx, cy) { return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h; }

    terrainAt(cx, cy) {
      if (!this.inBounds(cx, cy)) return ROCK;
      return this.terrain[cy * this.w + cx];
    }

    /** 地面单位能否走这一格（地形 + 建筑占用） */
    passable(cx, cy) {
      if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return false;
      const i = cy * this.w + cx;
      return this.solid[i] === 0 && this.occupied[i] === 0;
    }
    /** 只看地形（忽略建筑），给建造预览用 */
    terrainPassable(cx, cy) {
      if (!this.inBounds(cx, cy)) return false;
      return this.solid[cy * this.w + cx] === 0;
    }
    /** 能否在此格放建筑（地形允许且无人占用） */
    canBuildAt(cx, cy) {
      if (!this.inBounds(cx, cy)) return false;
      const i = cy * this.w + cx;
      return BUILDABLE[this.terrain[i]] && this.occupied[i] === 0;
    }

    /** 世界坐标 → 格 */
    cellOf(x, y) { return { cx: Math.floor(x / T), cy: Math.floor(y / T) }; }
    /** 格 → 格中心世界坐标 */
    centerOf(cx, cy) { return { x: (cx + 0.5) * T, y: (cy + 0.5) * T }; }

    get pxW() { return this.w * T; }
    get pxH() { return this.h * T; }

    /** 标记/清除建筑占用 */
    setOccupied(cx, cy, w, h, id) {
      for (let y = cy; y < cy + h; y++) {
        for (let x = cx; x < cx + w; x++) {
          if (this.inBounds(x, y)) this.occupied[y * this.w + x] = id;
        }
      }
    }

    /** 采矿：从这一格取走最多 amount，返回实际取到的量 */
    mine(cx, cy, amount) {
      if (!this.inBounds(cx, cy)) return 0;
      const i = cy * this.w + cx;
      const got = Math.min(this.ore[i], amount);
      this.ore[i] -= got;
      if (this.ore[i] < 0.01) this.ore[i] = 0;
      return got;
    }
    oreAt(cx, cy) {
      if (!this.inBounds(cx, cy)) return 0;
      return this.ore[cy * this.w + cx];
    }
    /** 渲染用的矿脉档位 0(无) / 1..4 */
    oreLevel(cx, cy) {
      const v = this.oreAt(cx, cy);
      if (v <= 0.5) return 0;
      const max = R.RULES.oreMax;
      return U.clamp(Math.ceil(v / (max / 4)), 1, 4);
    }

    /** 矿脉再生：矿心周围缓慢长回来 */
    regrow(dt) {
      const rate = R.RULES.oreRegen * dt;
      if (rate <= 0) return;
      const max = R.RULES.oreMax;
      const seeds = this._seedList || (this._seedList = this._collectSeeds());
      for (let k = 0; k < seeds.length; k++) {
        const i = seeds[k];
        if (this.ore[i] < max) {
          this.ore[i] = Math.min(max, this.ore[i] + rate);
        } else {
          // 矿心满了就向邻格扩散
          const cx = i % this.w, cy = (i / this.w) | 0;
          for (let d = 0; d < 4; d++) {
            const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
            const ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (!this.inBounds(nx, ny)) continue;
            const j = ny * this.w + nx;
            if (this.occupied[j] !== 0 || !BUILDABLE[this.terrain[j]]) continue;
            if (this.ore[j] < max * 0.75) { this.ore[j] += rate * 0.6; break; }
          }
        }
      }
    }
    _collectSeeds() {
      const out = [];
      for (let i = 0; i < this.oreSeed.length; i++) if (this.oreSeed[i]) out.push(i);
      return out;
    }

    /**
     * 找离 (cx,cy) 最近的含矿格。
     * @param {number} maxR  搜索半径（格）
     * @param {function} [skip]  可选过滤器 skip(cx,cy) 返回 true 则跳过
     *        （采矿车用它避开同伴已经占住的矿格）
     */
    nearestOre(cx, cy, maxR, skip) {
      maxR = maxR || 40;
      let best = null, bestD = Infinity;
      // 先看脚下这格
      if (this.inBounds(cx, cy)) {
        const i0 = cy * this.w + cx;
        if (this.ore[i0] > 0.5 && this.occupied[i0] === 0 && !(skip && skip(cx, cy))) {
          return { cx, cy };
        }
      }
      for (let r = 1; r <= maxR; r++) {
        // 只扫环，找到就可以提前退出（外环不可能更近）
        let found = false;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = cx + dx, y = cy + dy;
            if (!this.inBounds(x, y)) continue;
            const i = y * this.w + x;
            if (this.ore[i] <= 0.5 || this.occupied[i] !== 0) continue;
            if (skip && skip(x, y)) continue;
            found = true;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = { cx: x, cy: y }; }
          }
        }
        if (found && best) return best;
      }
      return best;
    }

    /** 找一块空地放单位（螺旋外扩），返回世界坐标 */
    findFreeSpot(cx, cy, maxR) {
      maxR = maxR || 12;
      if (this.passable(cx, cy)) return this.centerOf(cx, cy);
      for (let r = 1; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = cx + dx, y = cy + dy;
            if (this.passable(x, y)) return this.centerOf(x, y);
          }
        }
      }
      return this.centerOf(cx, cy);
    }

    /** 建筑占地是否整体可放置 */
    footprintOk(cx, cy, w, h) {
      for (let y = cy; y < cy + h; y++) {
        for (let x = cx; x < cx + w; x++) {
          if (!this.canBuildAt(x, y)) return false;
        }
      }
      return true;
    }

    /** 重算 solid（地形改变后调用） */
    refreshSolid() {
      for (let i = 0; i < this.terrain.length; i++) {
        this.solid[i] = PASSABLE[this.terrain[i]] ? 0 : 1;
      }
    }
  };

  /* ==================================================================
     地形生成
     ================================================================== */
  R.MAP_SIZES = {
    small: { w: 76, h: 76, name: '小型 · 遭遇战' },
    medium: { w: 96, h: 96, name: '中型 · 标准' },
    large: { w: 124, h: 124, name: '大型 · 持久战' },
  };

  /**
   * @param {string} sizeKey small|medium|large
   * @param {number} seed
   * @returns {GameMap}
   */
  R.generateMap = function (sizeKey, seed) {
    const cfg = R.MAP_SIZES[sizeKey] || R.MAP_SIZES.medium;
    const w = cfg.w, h = cfg.h;
    const map = new R.GameMap(w, h);
    map.seed = seed = (seed >>> 0) || 12345;
    const rnd = R.rng(seed);
    const nBase = R.makeNoise(seed);
    const nRock = R.makeNoise(seed ^ 0x9e3779b9);
    const nWater = R.makeNoise(seed ^ 0x51ed270b);

    /* --- 出生点：对角，留出足够的建造空间 --- */
    const inset = Math.round(w * 0.14) + 4;
    const jitter = Math.round(w * 0.05);
    const sx = inset + rnd.int(-jitter, jitter);
    const sy = inset + rnd.int(-jitter, jitter);
    const startA = { cx: U.clamp(sx, 6, w - 7), cy: U.clamp(sy, 6, h - 7) };
    const startB = { cx: w - 1 - startA.cx, cy: h - 1 - startA.cy };
    map.starts = [startA, startB];

    /** 对称写入 */
    const mirror = (x, y) => ({ x: w - 1 - x, y: h - 1 - y });
    const setT = (x, y, t) => {
      if (!map.inBounds(x, y)) return;
      map.terrain[y * w + x] = t;
      const m = mirror(x, y);
      map.terrain[m.y * w + m.x] = t;
    };

    /** 距离最近出生点的格距 */
    const distStart = (x, y) => {
      let d = Infinity;
      for (const s of map.starts) d = Math.min(d, U.dist(x, y, s.cx, s.cy));
      return d;
    };
    /** 出生地保护半径：这里面不允许长石头/水 */
    const SAFE = 11;

    /* --- 1. 基底：草地 / 沙土 混合 --- */
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = nBase(x * 0.055, y * 0.055, 4, 2, 0.5);
        setT(x, y, v > 0.55 ? DIRT : GRASS);
      }
    }

    /* --- 2. 水体：低洼处成湖，避开出生地与地图正中通路 --- */
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = nWater(x * 0.042 + 11.3, y * 0.042 + 4.7, 4, 2.1, 0.52);
        // 越靠近边缘越容易有水，让中间战场保持开阔
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y) / (w * 0.5);
        const thr = 0.30 + edge * 0.10;
        if (v < thr && distStart(x, y) > SAFE + 3) setT(x, y, WATER);
      }
    }

    /* --- 3. 岩石：成簇的高地障碍，构成天然掩体与隘口 --- */
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (map.terrain[y * w + x] === WATER) continue;
        const v = nRock(x * 0.075 + 3.1, y * 0.075 + 9.4, 3, 2.3, 0.55);
        if (v > 0.685 && distStart(x, y) > SAFE) setT(x, y, ROCK);
      }
    }

    /* --- 4. 浅滩：水陆交界 --- */
    const shoreList = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = map.terrain[y * w + x];
        if (t === WATER || t === ROCK) continue;
        let near = false;
        for (let d = 0; d < 4 && !near; d++) {
          const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
          const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
          if (map.inBounds(nx, ny) && map.terrain[ny * w + nx] === WATER) near = true;
        }
        if (near) shoreList.push(y * w + x);
      }
    }
    for (const i of shoreList) map.terrain[i] = SHORE;

    /* --- 5. 出生地整平：保证一片干净的建造区 --- */
    for (const s of map.starts) {
      for (let dy = -7; dy <= 7; dy++) {
        for (let dx = -7; dx <= 7; dx++) {
          const x = s.cx + dx, y = s.cy + dy;
          if (!map.inBounds(x, y)) continue;
          if (U.len(dx, dy) > 7.5) continue;
          const t = map.terrain[y * w + x];
          if (t === ROCK || t === WATER || t === SHORE) map.terrain[y * w + x] = DIRT;
        }
      }
    }

    map.refreshSolid();

    /* --- 6. 连通性：确保两个出生点之间走得通，否则凿路 --- */
    R._carveConnectivity(map);

    /* --- 7. 矿脉 --- */
    R._placeOre(map, rnd);

    /* --- 8. 花色 --- */
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        map.variant[y * w + x] = (Math.floor(nBase(x * 0.9, y * 0.9, 1, 2, 0.5) * 97) + x * 7 + y * 13) & 7;
      }
    }

    map.refreshSolid();
    return map;
  };

  /* ---------------- 连通性修复：BFS + 直线凿通 ---------------- */
  R._carveConnectivity = function (map) {
    const w = map.w, h = map.h;
    const a = map.starts[0], b = map.starts[1];
    const seen = new Uint8Array(w * h);
    const q = [a.cy * w + a.cx];
    seen[q[0]] = 1;
    let head = 0;
    while (head < q.length) {
      const i = q[head++];
      const cx = i % w, cy = (i / w) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (seen[j] || map.solid[j]) continue;
        seen[j] = 1; q.push(j);
      }
    }
    if (seen[b.cy * w + b.cx]) return true;   // 已连通

    // 未连通：沿 A→B 直线凿一条 3 格宽的通路
    let x = a.cx, y = a.cy;
    const steps = Math.max(Math.abs(b.cx - a.cx), Math.abs(b.cy - a.cy)) * 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      x = Math.round(U.lerp(a.cx, b.cx, t));
      y = Math.round(U.lerp(a.cy, b.cy, t));
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (!map.inBounds(nx, ny)) continue;
          const i = ny * w + nx;
          if (map.terrain[i] === ROCK || map.terrain[i] === WATER || map.terrain[i] === SHORE) {
            map.terrain[i] = DIRT;
          }
        }
      }
    }
    map.refreshSolid();
    return false;
  };

  /* ---------------- 矿脉布置 ---------------- */
  R._placeOre = function (map, rnd) {
    const w = map.w, h = map.h;
    const max = R.RULES.oreMax;
    const mirror = (x, y) => ({ x: w - 1 - x, y: h - 1 - y });

    /** 以 (cx,cy) 为心画一块矿田（同时镜像） */
    function blob(cx, cy, radius, richness) {
      const n = R.makeNoise((cx * 7349 + cy * 911) >>> 0);
      const cells = [];
      // 注意：循环变量必须是整数。用浮点 dx/dy 会让 cx+dx 变成非整数，
      // 于是 map.ore[非整数下标] 的写入会被 TypedArray 静默丢弃 —— 全图没矿。
      const RI = Math.ceil(radius) + 1;
      for (let dy = -RI; dy <= RI; dy++) {
        for (let dx = -RI; dx <= RI; dx++) {
          const d = U.len(dx, dy);
          if (d > radius + 1) continue;
          const wobble = n((dx + 40) * 0.28, (dy + 40) * 0.28, 2, 2, 0.5);
          if (d > radius * (0.62 + wobble * 0.58)) continue;
          const x = cx + dx, y = cy + dy;
          if (!map.inBounds(x, y)) continue;
          const i = y * w + x;
          if (map.terrain[i] === ROCK || map.terrain[i] === WATER || map.terrain[i] === SHORE) continue;
          const falloff = U.clamp01(1 - d / (radius + 1));
          const amount = max * richness * (0.45 + 0.55 * falloff) * (0.75 + wobble * 0.5);
          cells.push({ i, x, y, amount: Math.min(max, amount), core: d < radius * 0.45 });
        }
      }
      for (const c of cells) {
        map.ore[c.i] = Math.max(map.ore[c.i], c.amount);
        if (c.core && rnd.bool(0.55)) map.oreSeed[c.i] = 1;
        const m = mirror(c.x, c.y);
        if (map.inBounds(m.x, m.y)) {
          const j = m.y * w + m.x;
          if (map.terrain[j] !== ROCK && map.terrain[j] !== WATER && map.terrain[j] !== SHORE) {
            map.ore[j] = Math.max(map.ore[j], c.amount);
            if (c.core && map.oreSeed[c.i]) map.oreSeed[j] = 1;
          }
        }
      }
      map.oreFields.push({ cx, cy, r: radius });
      const mc = mirror(cx, cy);
      map.oreFields.push({ cx: mc.x, cy: mc.y, r: radius });
      return cells.length;
    }

    /**
     * 在 (ax,ay) 周围按给定距离找一个能容纳矿田的方位。
     * 出生点附近可能有水/岩石，所以要试多个角度，
     * 取第一个能写下足够矿格的方位 —— 否则会出现"开局附近没矿"的死局。
     */
    function blobNear(ax, ay, dist, radius, richness, angle0, minCells) {
      let bestN = 0, bestArgs = null;
      for (let k = 0; k < 12; k++) {
        const ang = angle0 + k * (U.TAU / 12);
        const cx = U.clamp(Math.round(ax + Math.cos(ang) * dist), 3, w - 4);
        const cy = U.clamp(Math.round(ay + Math.sin(ang) * dist), 3, h - 4);
        // 先数一遍能落多少格（不写入）
        let n = 0;
        const RI = Math.ceil(radius) + 1;
        for (let dy = -RI; dy <= RI; dy++) {
          for (let dx = -RI; dx <= RI; dx++) {
            const d = U.len(dx, dy);
            if (d > radius * 0.9) continue;
            const x = cx + dx, y = cy + dy;
            if (!map.inBounds(x, y)) continue;
            const t = map.terrain[y * w + x];
            if (t === ROCK || t === WATER || t === SHORE) continue;
            n++;
          }
        }
        if (n > bestN) { bestN = n; bestArgs = { cx, cy }; }
        if (n >= (minCells || 20)) { return blob(cx, cy, radius, richness); }
      }
      if (bestArgs) return blob(bestArgs.cx, bestArgs.cy, radius, richness);
      return 0;
    }

    /* 1. 每个出生点附近保证 2 块近矿（主矿 + 副矿） */
    const a = map.starts[0];
    const ang0 = rnd.range(0, U.TAU);
    blobNear(a.cx, a.cy, 8, 4.4, 1.0, ang0, 26);
    blobNear(a.cx, a.cy, 13, 3.6, 0.9, ang0 + rnd.range(1.7, 2.5), 18);

    /* 2. 中立矿田：地图中部若干块，越靠中间越肥（争夺点） */
    const midCount = Math.round((w * h) / 1500) + 2;
    for (let k = 0; k < midCount; k++) {
      const t = (k + 1) / (midCount + 1);
      // 沿对角线附近撒点，并加随机偏移
      const bx = U.lerp(a.cx, w - 1 - a.cx, t) + rnd.range(-w * 0.18, w * 0.18);
      const by = U.lerp(a.cy, h - 1 - a.cy, t) + rnd.range(-h * 0.18, h * 0.18);
      const cx = U.clamp(Math.round(bx), 4, w - 5);
      const cy = U.clamp(Math.round(by), 4, h - 5);
      // 别贴着出生点
      let tooClose = false;
      for (const s of map.starts) if (U.dist(cx, cy, s.cx, s.cy) < 13) tooClose = true;
      if (tooClose) continue;
      blob(cx, cy, rnd.range(3.2, 5.4), rnd.range(0.85, 1.15));
    }

    /* 3. 出生点正下方不要有矿，免得建造厂压在矿上 */
    for (const s of map.starts) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = s.cx + dx, y = s.cy + dy;
          if (map.inBounds(x, y)) { map.ore[y * w + x] = 0; map.oreSeed[y * w + x] = 0; }
        }
      }
    }
    map._seedList = null;
  };

})();
