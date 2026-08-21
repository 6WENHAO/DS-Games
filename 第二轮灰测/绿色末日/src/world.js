/* =========================================================================
 * GREENFALL · world.js —— 区块存储 / 光照 / 网格化 / 方块操作 / 容器
 * ======================================================================= */
(function (GF) {
  'use strict';

  const U = GF.util;
  const CH = GF.CHUNK, H = GF.HEIGHT, SEA = GF.SEA;
  const idx = (x, y, z) => x + z * CH + y * CH * CH;

  /* ------------------------------------------------------- 面定义 */
  // ua/va = 面内两个轴的索引（0=X,1=Y,2=Z）
  const FACES = [
    { n: [0, 1, 0], tex: 'top', shade: 1.00, ua: 0, va: 2, v: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
    { n: [0, -1, 0], tex: 'bottom', shade: 0.52, ua: 0, va: 2, v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, -1], tex: 'side', shade: 0.80, ua: 0, va: 1, v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
    { n: [0, 0, 1], tex: 'side', shade: 0.80, ua: 0, va: 1, v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
    { n: [-1, 0, 0], tex: 'side', shade: 0.66, ua: 2, va: 1, v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { n: [1, 0, 0], tex: 'side', shade: 0.66, ua: 2, va: 1, v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  ];
  // 十字草木：两片交叉的面（双面渲染）
  const CROSS = [
    [[0.146, 0, 0.146], [0.146, 1, 0.146], [0.854, 1, 0.854], [0.854, 0, 0.854]],
    [[0.854, 0, 0.146], [0.854, 1, 0.146], [0.146, 1, 0.854], [0.146, 0, 0.854]],
  ];

  /* ============================================================ Chunk */
  class Chunk {
    constructor(cx, cz) {
      this.cx = cx; this.cz = cz;
      this.blocks = null;
      this.heightMap = null;
      this.biomeMap = null;
      this.sky = null;          // Uint8Array 天空光 0..15
      this.blockLight = null;   // Uint8Array 方块光 0..15
      this.ready = false;
      this.litDirty = true;
      this.meshDirty = true;
      this.mesh = null;         // 由 render.js 填充 GPU 资源
      this.geom = null;         // CPU 端几何
      this.lightSources = [];
      this.entitiesSpawned = false;
    }
    get(x, y, z) { return (y < 0 || y >= H) ? 0 : this.blocks[idx(x, y, z)]; }
    set(x, y, z, id) { this.blocks[idx(x, y, z)] = id; }
  }

  /* ============================================================ World */
  class World {
    constructor(seed) {
      this.seed = seed | 0;
      this.gen = new GF.WorldGen(this.seed);
      this.chunks = new Map();
      this.queue = [];                 // 待生成 [cx,cz,priority]
      this.deltas = new Map();         // chunkKey -> Map(localIdx -> blockId) 玩家改动
      this.containers = new Map();     // posKey -> {table, guarantee, items, opened}
      this.explored = new Set();       // 已探索区块（地图用）
      this.mapTiles = new Map();       // chunkKey -> {b:生物群系id, h:平均高度}
      this.time = 0.30;                // 0..1 一天中的时刻（0.30 ≈ 清晨 7:12）
      this.day = 1;
      this.weather = { kind: 'clear', t: 0, next: 120, rain: 0, wind: 0.3, fog: 0 };
      this.stats = { generated: 0, meshed: 0 };
      this.genBudgetMs = 9;
      this.tickAccum = 0;
    }

    /* ------------------------------------------------------ 区块存取 */
    key(cx, cz) { return cx + ',' + cz; }
    getChunk(cx, cz) { return this.chunks.get(this.key(cx, cz)) || null; }

    ensureChunk(cx, cz, prio) {
      const k = this.key(cx, cz);
      let c = this.chunks.get(k);
      if (c) return c;
      c = new Chunk(cx, cz);
      this.chunks.set(k, c);
      this.queue.push({ cx, cz, prio: prio || 0 });
      return c;
    }

    /** 立即生成（用于出生点） */
    generateNow(cx, cz) {
      const k = this.key(cx, cz);
      let c = this.chunks.get(k);
      if (!c) { c = new Chunk(cx, cz); this.chunks.set(k, c); }
      if (c.ready) return c;
      this._fill(c);
      return c;
    }

    _fill(c) {
      const data = this.gen.generateChunk(c.cx, c.cz);
      c.blocks = data.blocks;
      c.heightMap = data.heightMap;
      c.biomeMap = data.biomeMap;
      // 注册结构里的容器
      for (const ct of data.meta.containers) {
        const pk = U.posKey(ct.x, ct.y, ct.z);
        if (!this.containers.has(pk)) {
          this.containers.set(pk, { table: ct.table, guarantee: ct.guarantee, items: null, opened: false });
        }
      }
      // 应用玩家改动
      const d = this.deltas.get(this.key(c.cx, c.cz));
      if (d) for (const [li, id] of d) c.blocks[li] = id;
      c.ready = true;
      c.litDirty = true;
      c.meshDirty = true;
      this.stats.generated++;
      this.explored.add(this.key(c.cx, c.cz));
      // 地图缩略信息（区块中心生物群系 + 平均高度）
      {
        let hs = 0;
        for (let i = 0; i < CH * CH; i += 7) hs += c.heightMap[i];
        this.mapTiles.set(this.key(c.cx, c.cz), {
          b: c.biomeMap[8 + 8 * CH], h: Math.round(hs / Math.ceil(CH * CH / 7)),
        });
      }
      this._collectLights(c);
      // 邻居需要重新网格化（边界面）
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = this.getChunk(c.cx + dx, c.cz + dz);
        if (n && n.ready) { n.meshDirty = true; n.litDirty = true; }
      }
      return c;
    }

    /** 每帧处理生成队列（带时间预算） */
    pump(px, pz, budgetMs) {
      if (!this.queue.length) return 0;
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const budget = budgetMs == null ? this.genBudgetMs : budgetMs;
      const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH);
      this.queue.sort((a, b) =>
        (Math.abs(a.cx - pcx) + Math.abs(a.cz - pcz)) - (Math.abs(b.cx - pcx) + Math.abs(b.cz - pcz)));
      let n = 0;
      while (this.queue.length) {
        const q = this.queue.shift();
        const c = this.getChunk(q.cx, q.cz);
        if (!c || c.ready) continue;
        this._fill(c);
        n++;
        if ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 > budget) break;
      }
      return n;
    }

    /** 卸载远处区块（保留玩家改动） */
    unloadFar(px, pz, maxDist) {
      const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH);
      const kill = [];
      for (const [k, c] of this.chunks) {
        if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > maxDist) kill.push(k);
      }
      for (const k of kill) {
        const c = this.chunks.get(k);
        if (c && c.mesh && this.onDisposeMesh) this.onDisposeMesh(c);
        this.chunks.delete(k);
      }
      return kill.length;
    }

    /* ------------------------------------------------------- 方块访问 */
    getBlock(wx, wy, wz) {
      if (wy < 0 || wy >= H) return 0;
      const cx = Math.floor(wx / CH), cz = Math.floor(wz / CH);
      const c = this.chunks.get(cx + ',' + cz);
      if (!c || !c.ready) return -1;                 // -1 = 未加载
      return c.blocks[idx(wx - cx * CH, wy, wz - cz * CH)];
    }
    getBlockSafe(wx, wy, wz) { const b = this.getBlock(wx, wy, wz); return b < 0 ? 0 : b; }
    blockAt(wx, wy, wz) { const id = this.getBlock(wx, wy, wz); return GF.Blocks.list[id < 0 ? 0 : id]; }

    isSolid(wx, wy, wz) {
      const id = this.getBlock(wx, wy, wz);
      if (id < 0) return true;                        // 未加载视为实心，防止掉出世界
      return GF.Blocks.list[id].solid;
    }
    isOpaque(wx, wy, wz) {
      const id = this.getBlock(wx, wy, wz);
      if (id < 0) return true;
      return GF.Blocks.list[id].opaque;
    }
    isLiquid(wx, wy, wz) {
      const id = this.getBlock(wx, wy, wz);
      return id > 0 && GF.Blocks.list[id].liquid;
    }

    setBlock(wx, wy, wz, id, opts) {
      if (wy < 1 || wy >= H) return false;
      const cx = Math.floor(wx / CH), cz = Math.floor(wz / CH);
      const c = this.chunks.get(cx + ',' + cz);
      if (!c || !c.ready) return false;
      const lx = wx - cx * CH, lz = wz - cz * CH;
      const li = idx(lx, wy, lz);
      const old = c.blocks[li];
      if (old === id) return true;
      c.blocks[li] = id;
      // 记录增量存档
      if (!(opts && opts.noSave)) {
        const kk = this.key(cx, cz);
        let d = this.deltas.get(kk);
        if (!d) { d = new Map(); this.deltas.set(kk, d); }
        d.set(li, id);
      }
      // 高度图
      if (GF.Blocks.list[id].opaque && wy > c.heightMap[lx + lz * CH]) c.heightMap[lx + lz * CH] = wy;
      else if (!GF.Blocks.list[id].opaque && wy === c.heightMap[lx + lz * CH]) {
        let top = 0;
        for (let y = H - 1; y >= 0; y--) { const b2 = c.blocks[idx(lx, y, lz)]; if (b2 && GF.Blocks.list[b2].opaque) { top = y; break; } }
        c.heightMap[lx + lz * CH] = top;
      }
      c.meshDirty = true; c.litDirty = true;
      this._collectLights(c);
      // 边界：邻块也要重画
      if (lx <= 0) this._touch(cx - 1, cz);
      if (lx >= CH - 1) this._touch(cx + 1, cz);
      if (lz <= 0) this._touch(cx, cz - 1);
      if (lz >= CH - 1) this._touch(cx, cz + 1);
      if (GF.Blocks.list[old].light > 0 || GF.Blocks.list[id].light > 0) {
        this._touch(cx - 1, cz); this._touch(cx + 1, cz); this._touch(cx, cz - 1); this._touch(cx, cz + 1);
      }
      GF.bus.emit('block:set', { x: wx, y: wy, z: wz, id, old });
      return true;
    }
    _touch(cx, cz) { const n = this.getChunk(cx, cz); if (n && n.ready) { n.meshDirty = true; n.litDirty = true; } }

    _collectLights(c) {
      const arr = [];
      const B = GF.Blocks.list;
      for (let y = 0; y < H; y++) for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
        const id = c.blocks[idx(x, y, z)];
        if (id && B[id].light > 0) arr.push([x, y, z, B[id].light]);
      }
      c.lightSources = arr;
    }

    /* ---------------------------------------------------------- 光照 */
    computeLight(c) {
      if (!c.ready) return;
      const N = CH * H * CH;
      if (!c.sky) { c.sky = new Uint8Array(N); c.blockLight = new Uint8Array(N); }
      else { c.sky.fill(0); c.blockLight.fill(0); }
      const B = GF.Blocks.list;
      const blocks = c.blocks, sky = c.sky, bl = c.blockLight;

      /* --- 天空光：自上而下 --- */
      const q = [];
      for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
        let l = 15;
        for (let y = H - 1; y >= 0; y--) {
          const id = blocks[idx(x, y, z)];
          const b = B[id];
          if (id !== 0) {
            if (b.opaque) l = 0;
            else if (b.liquid) l = Math.max(0, l - 2);
            else if (b.cls === 'alpha') l = Math.max(0, l - 1);
          }
          sky[idx(x, y, z)] = l;
          if (l > 1 && l < 15) q.push(idx(x, y, z));
          else if (l === 15) q.push(idx(x, y, z));
          if (l === 0) {
            // 下面全黑，直接跳过剩余（除非有透明缝隙 -> 由 BFS 补）
            for (let y2 = y - 1; y2 >= 0; y2--) sky[idx(x, y2, z)] = 0;
            break;
          }
        }
      }
      this._flood(c, sky, q, true);

      /* --- 方块光：BFS --- */
      const q2 = [];
      for (const [x, y, z, lv] of c.lightSources) { const i = idx(x, y, z); bl[i] = lv; q2.push(i); }
      // 从邻块边界渗入
      for (const [dx, dz, ax] of [[-1, 0, 'x0'], [1, 0, 'x1'], [0, -1, 'z0'], [0, 1, 'z1']]) {
        const n = this.getChunk(c.cx + dx, c.cz + dz);
        if (!n || !n.blockLight) continue;
        for (let y = 0; y < H; y++) for (let t = 0; t < CH; t++) {
          let sx, sz, nx, nz;
          if (dx === -1) { sx = 0; sz = t; nx = CH - 1; nz = t; }
          else if (dx === 1) { sx = CH - 1; sz = t; nx = 0; nz = t; }
          else if (dz === -1) { sx = t; sz = 0; nx = t; nz = CH - 1; }
          else { sx = t; sz = CH - 1; nx = t; nz = 0; }
          const lv = n.blockLight[idx(nx, y, nz)] - 1;
          const i = idx(sx, y, sz);
          if (lv > bl[i] && !B[blocks[i]].opaque) { bl[i] = lv; q2.push(i); }
          const sv = n.sky[idx(nx, y, nz)] - 1;
          if (sv > sky[i] && !B[blocks[i]].opaque) { sky[i] = sv; q.push(i); }
        }
      }
      this._flood(c, bl, q2, false);
      if (q.length) this._flood(c, sky, q, true);
      c.litDirty = false;
    }

    _flood(c, arr, queue, isSky) {
      const B = GF.Blocks.list, blocks = c.blocks;
      let head = 0;
      while (head < queue.length) {
        const i = queue[head++];
        const l = arr[i];
        if (l <= 1) continue;
        const y = Math.floor(i / (CH * CH));
        const rem = i - y * CH * CH;
        const z = Math.floor(rem / CH), x = rem - z * CH;
        for (let f = 0; f < 6; f++) {
          const nx = x + FACES[f].n[0], ny = y + FACES[f].n[1], nz = z + FACES[f].n[2];
          if (nx < 0 || nx >= CH || nz < 0 || nz >= CH || ny < 0 || ny >= H) continue;
          const ni = idx(nx, ny, nz);
          const nb = B[blocks[ni]];
          if (nb.opaque) continue;
          let nl = l - 1;
          if (nb.liquid) nl -= 1;
          if (isSky && FACES[f].n[1] === -1 && !nb.opaque && blocks[ni] === 0) nl = l;  // 天空光竖直不衰减
          if (nl > arr[ni]) { arr[ni] = nl; queue.push(ni); }
        }
      }
    }

    /* ------------------------------------------------------- 网格化 */
    buildMesh(c) {
      if (!c.ready) return null;
      if (c.litDirty) this.computeLight(c);
      const B = GF.Blocks.list;
      const atlasUV = GF.Atlas.uvOf;
      const ox = c.cx * CH, oz = c.cz * CH;

      const buf = {
        opaque: { pos: [], uv: [], lig: [] },
        alpha: { pos: [], uv: [], lig: [] },
        water: { pos: [], uv: [], lig: [] },
      };

      const lightAt = (wx, wy, wz) => {
        const lx = wx - ox, lz = wz - oz;
        if (lx >= 0 && lx < CH && lz >= 0 && lz < CH && wy >= 0 && wy < H) {
          const i = idx(lx, wy, lz);
          return [c.sky[i], c.blockLight[i]];
        }
        const ncx = Math.floor(wx / CH), ncz = Math.floor(wz / CH);
        const n = this.chunks.get(ncx + ',' + ncz);
        if (!n || !n.sky || wy < 0 || wy >= H) return [12, 0];
        const i = idx(wx - ncx * CH, wy, wz - ncz * CH);
        return [n.sky[i], n.blockLight[i]];
      };

      const occl = (wx, wy, wz) => {
        const id = this.getBlock(wx, wy, wz);
        if (id <= 0) return 0;
        return B[id].opaque ? 1 : 0;
      };

      for (let y = 0; y < H; y++) {
        for (let z = 0; z < CH; z++) {
          for (let x = 0; x < CH; x++) {
            const id = c.blocks[idx(x, y, z)];
            if (id === 0) continue;
            const b = B[id];
            const wx = ox + x, wz = oz + z;

            /* --- 十字植物（alpha 通道关闭了背面剔除，因此只需一份缠绕） --- */
            if (b.render === 'cross') {
              const uv = atlasUV(b.tex.all || b.tex.side || b.tex.top);
              const [sk, blv] = lightAt(wx, y, wz);
              const t = buf.alpha;
              for (const quad of CROSS) {
                for (const vi of [0, 1, 2, 0, 2, 3]) {
                  const v = quad[vi];
                  t.pos.push(wx + v[0], y + v[1], wz + v[2]);
                  const uu = (vi === 0 || vi === 1) ? 0 : 1;
                  const vv = (vi === 1 || vi === 2) ? 0 : 1;
                  t.uv.push(uv[0] + uu * uv[2], uv[1] + vv * uv[3]);
                  t.lig.push(232, sk * 17, blv * 17, 255);
                }
              }
              continue;
            }

            /* --- 立方体 6 面 --- */
            const target = b.cls === 'water' ? buf.water : (b.cls === 'alpha' ? buf.alpha : buf.opaque);
            for (let f = 0; f < 6; f++) {
              const F = FACES[f];
              const nx = wx + F.n[0], ny = y + F.n[1], nz = wz + F.n[2];
              const nid = this.getBlock(nx, ny, nz);
              if (nid < 0) continue;                     // 邻块未加载：先不画
              const nb = B[nid];
              if (nid !== 0) {
                if (nb.opaque) continue;
                if (b.cls === 'water' && nb.cls === 'water') continue;
                if (b.cls === 'alpha' && nid === id && b.render !== 'cross') continue;
              }
              const texName = b.tex[F.tex] || b.tex.all || b.tex.side || b.tex.top;
              const uv = atlasUV(texName);
              const quad = F.v;
              const vLight = [], vAO = [];
              for (let vi = 0; vi < 4; vi++) {
                const o = quad[vi];
                const du = (o[F.ua] === 1) ? 1 : -1;
                const dv = (o[F.va] === 1) ? 1 : -1;
                const s1 = [0, 0, 0], s2 = [0, 0, 0], cc = [0, 0, 0];
                s1[F.ua] = du; s2[F.va] = dv;
                cc[F.ua] = du; cc[F.va] = dv;
                const bx = nx, by = ny, bz = nz;
                const a1 = occl(bx + s1[0], by + s1[1], bz + s1[2]);
                const a2 = occl(bx + s2[0], by + s2[1], bz + s2[2]);
                const ac = occl(bx + cc[0], by + cc[1], bz + cc[2]);
                let ao = (a1 && a2) ? 0 : 3 - (a1 + a2 + ac);
                vAO.push(0.55 + 0.15 * ao);
                // 光照取该面外侧体素与三个侧向体素的平均，边缘更柔和
                const L0 = lightAt(bx, by, bz);
                const L1 = lightAt(bx + s1[0], by + s1[1], bz + s1[2]);
                const L2 = lightAt(bx + s2[0], by + s2[1], bz + s2[2]);
                const Lc = lightAt(bx + cc[0], by + cc[1], bz + cc[2]);
                vLight.push([(L0[0] + L1[0] + L2[0] + Lc[0]) / 4, (L0[1] + L1[1] + L2[1] + Lc[1]) / 4]);
              }
              // 反转四边形以避免 AO 三角化产生的接缝
              const flip = (vAO[0] + vAO[2]) < (vAO[1] + vAO[3]);
              const order = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
              const uvs = [[0, 1], [0, 0], [1, 0], [1, 1]];
              for (const vi of order) {
                const o = quad[vi];
                target.pos.push(wx + o[0], y + o[1], wz + o[2]);
                target.uv.push(uv[0] + uvs[vi][0] * uv[2], uv[1] + uvs[vi][1] * uv[3]);
                const shade = Math.min(255, Math.round(F.shade * vAO[vi] * 255));
                target.lig.push(shade, Math.min(255, Math.round(vLight[vi][0] * 17)), Math.min(255, Math.round(vLight[vi][1] * 17)), 255);
              }
            }
          }
        }
      }

      const pack = (t) => t.pos.length ? {
        pos: new Float32Array(t.pos), uv: new Float32Array(t.uv),
        lig: new Uint8Array(t.lig), count: t.pos.length / 3,
      } : null;

      c.geom = { opaque: pack(buf.opaque), alpha: pack(buf.alpha), water: pack(buf.water) };
      c.meshDirty = false;
      this.stats.meshed++;
      return c.geom;
    }

    /* ------------------------------------------------------- 射线检测 */
    /** 返回 {x,y,z,id,nx,ny,nz,dist} 或 null */
    raycast(ox, oy, oz, dx, dy, dz, maxDist, opts) {
      const wantLiquid = opts && opts.liquid;
      const wantAny = opts && opts.any;
      let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
      const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
      const tDX = Math.abs(1 / (dx || 1e-9)), tDY = Math.abs(1 / (dy || 1e-9)), tDZ = Math.abs(1 / (dz || 1e-9));
      let tMX = ((dx > 0 ? (x + 1 - ox) : (ox - x)) || 1e-9) * tDX;
      let tMY = ((dy > 0 ? (y + 1 - oy) : (oy - y)) || 1e-9) * tDY;
      let tMZ = ((dz > 0 ? (z + 1 - oz) : (oz - z)) || 1e-9) * tDZ;
      let nx = 0, ny = 0, nz = 0, t = 0;
      for (let i = 0; i < 512 && t <= maxDist; i++) {
        const id = this.getBlock(x, y, z);
        if (id > 0) {
          const b = GF.Blocks.list[id];
          const hitOk = wantAny || (b.liquid ? wantLiquid : (b.solid || b.render === 'cross' || b.loot || b.station || b.door));
          if (hitOk) return { x, y, z, id, nx, ny, nz, dist: t, block: b };
        }
        if (tMX < tMY && tMX < tMZ) { x += stepX; t = tMX; tMX += tDX; nx = -stepX; ny = 0; nz = 0; }
        else if (tMY < tMZ) { y += stepY; t = tMY; tMY += tDY; nx = 0; ny = -stepY; nz = 0; }
        else { z += stepZ; t = tMZ; tMZ += tDZ; nx = 0; ny = 0; nz = -stepZ; }
      }
      return null;
    }

    /* ---------------------------------------------------------- 容器 */
    containerAt(wx, wy, wz) {
      const pk = U.posKey(wx, wy, wz);
      let c = this.containers.get(pk);
      const id = this.getBlock(wx, wy, wz);
      if (id <= 0) return null;
      const b = GF.Blocks.list[id];
      if (!b.loot) return null;
      if (!c) {
        c = { table: b.loot === 'PLAYER' ? null : b.loot, guarantee: null, items: null, opened: false };
        this.containers.set(pk, c);
      }
      if (!c.items) {
        c.items = [];
        if (c.table) {
          const rnd = U.rngAt(wx * 31 + wy, wz * 17 + wy, this.seed ^ 0x10ca1);
          for (const it of GF.Loot.roll(c.table, rnd)) c.items.push({ item: it.item, n: it.n, dur: null });
          if (c.guarantee) for (const g of c.guarantee) c.items.push({ item: g, n: 1, dur: null });
        }
        // 补足耐久
        for (const s of c.items) {
          const md = GF.Items.maxDur(s.item);
          if (md > 0) s.dur = Math.round(md * (0.35 + 0.6 * U.hash2(wx + s.item.length, wz, 7)));
        }
        c.slots = Math.max(30, c.items.length);
      }
      return c;
    }

    /* ------------------------------------------------ 随机刻（作物等） */
    randomTick(dt, px, py, pz, speedMul) {
      this.tickAccum += dt;
      if (this.tickAccum < 1.0) return;
      this.tickAccum = 0;
      const B = GF.Blocks;
      const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH);
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const c = this.getChunk(pcx + dx, pcz + dz);
        if (!c || !c.ready) continue;
        for (let k = 0; k < 6; k++) {
          const x = (Math.random() * CH) | 0, z = (Math.random() * CH) | 0;
          const y = 1 + ((Math.random() * (H - 2)) | 0);
          const id = c.blocks[idx(x, y, z)];
          if (!id) continue;
          const b = B.list[id];
          if (!b.grow) continue;
          const wx = c.cx * CH + x, wz = c.cz * CH + z;
          if (b.grow === 'grass') continue;
          if (b.grow === 'tree_oak' || b.grow === 'tree_pine') {
            if (Math.random() < 0.02 * (speedMul || 1)) {
              const rnd = U.mulberry32((wx * 7919 + wz) | 0);
              const setSafe = (sx, sy, sz, sid) => { this.setBlock(wx + (sx - x), sy, wz + (sz - z), sid); };
              this.gen._tree(b.grow === 'tree_oak' ? 'oak' : 'pine', x, y, z, rnd, setSafe, B.ID, {});
            }
            continue;
          }
          // 作物：需要耕地/育苗箱 + 光
          const belowId = c.blocks[idx(x, y - 1, z)];
          const below = B.list[belowId];
          const fertile = below && (below.key === 'farmland' || below.key === 'farmland_wet' || below.key === 'planter' || below.key === 'rich_soil');
          if (!fertile) continue;
          const light = Math.max(c.sky ? c.sky[idx(x, y, z)] : 12, c.blockLight ? c.blockLight[idx(x, y, z)] : 0);
          if (light < 7) continue;
          const wet = below.key === 'farmland_wet' ? 1.7 : 1;
          if (Math.random() < 0.06 * wet * (speedMul || 1)) {
            const stage = parseInt(b.key.slice(-1), 10);
            this.setBlock(wx, y, wz, B.ID[b.grow + '_' + (stage + 1)]);
          }
        }
      }
    }

    /* -------------------------------------------- 时间 / 天气推进 */
    advanceTime(dt, dayLengthSec) {
      const before = this.time;
      this.time += dt / (dayLengthSec || 1200);
      if (this.time >= 1) { this.time -= 1; this.day++; GF.bus.emit('day:new', this.day); }
      if (before < 0.25 && this.time >= 0.25) GF.bus.emit('time:dawn');
      if (before < 0.78 && this.time >= 0.78) GF.bus.emit('time:dusk');

      const w = this.weather;
      w.t += dt;
      if (w.t > w.next) {
        w.t = 0;
        const r = Math.random();
        w.kind = r < 0.44 ? 'clear' : r < 0.64 ? 'overcast' : r < 0.82 ? 'fog' : r < 0.95 ? 'rain' : 'storm';
        w.next = 90 + Math.random() * 260;
        GF.bus.emit('weather', w.kind);
      }
      const targetRain = w.kind === 'rain' ? 0.6 : w.kind === 'storm' ? 1 : 0;
      const targetFog = w.kind === 'fog' ? 1 : w.kind === 'storm' ? 0.5 : w.kind === 'overcast' ? 0.2 : 0;
      w.rain += (targetRain - w.rain) * Math.min(1, dt * 0.15);
      w.fog += (targetFog - w.fog) * Math.min(1, dt * 0.12);
      w.wind = 0.25 + w.rain * 0.6;
    }

    /** 太阳强度 0..1（用于着色器与体温） */
    sunLevel() {
      const t = this.time;
      // 0.25 日出, 0.5 正午, 0.78 日落
      let s;
      if (t < 0.20 || t > 0.84) s = 0.03;
      else if (t < 0.28) s = U.smoothstep((t - 0.20) / 0.08);
      else if (t > 0.76) s = 1 - U.smoothstep((t - 0.76) / 0.08);
      else s = 1;
      s = Math.max(0.03, s);
      const w = this.weather;
      return s * (1 - w.rain * 0.45 - (w.kind === 'overcast' ? 0.2 : 0) - w.fog * 0.15);
    }
    isNight() { return this.time < 0.22 || this.time > 0.82; }

    /* ------------------------------------------------------ 存档数据 */
    serialize() {
      const d = [];
      for (const [k, m] of this.deltas) {
        const arr = [];
        for (const [li, id] of m) arr.push(li, id);
        d.push([k, arr]);
      }
      const cont = [];
      for (const [k, c] of this.containers) {
        if (!c.items && !c.opened) continue;                 // 未开过的不必存
        cont.push([k, c.opened ? 1 : 0, c.items || []]);
      }
      return {
        seed: this.seed, time: this.time, day: this.day,
        weather: this.weather, deltas: d, containers: cont,
        explored: Array.from(this.explored),
        mapTiles: Array.from(this.mapTiles).map(([k, v]) => [k, v.b, v.h]),
      };
    }
    deserialize(s) {
      if (!s) return;
      this.time = s.time != null ? s.time : this.time;
      this.day = s.day || 1;
      if (s.weather) this.weather = s.weather;
      this.deltas = new Map();
      for (const [k, arr] of (s.deltas || [])) {
        const m = new Map();
        for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]);
        this.deltas.set(k, m);
      }
      this.containers = new Map();
      for (const [k, opened, items] of (s.containers || [])) {
        this.containers.set(k, { table: null, guarantee: null, items, opened: !!opened });
      }
      this.explored = new Set(s.explored || []);
      this.mapTiles = new Map();
      for (const [k, b, h] of (s.mapTiles || [])) this.mapTiles.set(k, { b, h });
    }
  }

  GF.Chunk = Chunk;
  GF.World = World;
  GF.FACES = FACES;
})(globalThis.GF = globalThis.GF || {});
