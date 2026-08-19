/* DEEP SPACE CRAFT · world.js —— 体素世界：区块流式生成 / 平滑光照 / 贪心面网格 / 射线选取
   坐标：Y 上，区块 16×96×16；索引 idx = x + 16*(z + 16*y) */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var N = DSC.Noise, B = DSC.Blocks, U = DSC.Util;

  var CX = 16, CZ = 16, H = 96, CXZ = CX * CZ, CVOL = CX * CZ * H;

  /* 顶点：8 字节 —— x,y,z(u8) tile(u8) shade(u8,normalized) light(u8: sky<<4|blk) corner(u8) face(u8) */
  var VSTRIDE = 8;
  var AO_SHADE = [0.46, 0.66, 0.84, 1.0];        /* 环境光遮蔽 4 档 */
  var FACE_SHADE = [0.72, 0.72, 1.0, 0.5, 0.86, 0.86]; /* +X -X +Y -Y +Z -Z（MC 手感） */

  /* 面定义：法线 + 4 个角的顶点偏移（CCW，从外部看） */
  var FACES = [
    { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },   /* +X */
    { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },  /* -X */
    { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },   /* +Y */
    { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },  /* -Y */
    { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },   /* +Z */
    { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] }   /* -Z */
  ];
  /* 每个面每个角的 3 个 AO 采样偏移（side1, side2, corner），相对于「面前那格」 */
  var AO_OFF = [
    /* +X */[[[0, -1, 0], [0, 0, 1], [0, -1, 1]], [[0, -1, 0], [0, 0, -1], [0, -1, -1]], [[0, 1, 0], [0, 0, -1], [0, 1, -1]], [[0, 1, 0], [0, 0, 1], [0, 1, 1]]],
    /* -X */[[[0, -1, 0], [0, 0, -1], [0, -1, -1]], [[0, -1, 0], [0, 0, 1], [0, -1, 1]], [[0, 1, 0], [0, 0, 1], [0, 1, 1]], [[0, 1, 0], [0, 0, -1], [0, 1, -1]]],
    /* +Y */[[[-1, 0, 0], [0, 0, 1], [-1, 0, 1]], [[1, 0, 0], [0, 0, 1], [1, 0, 1]], [[1, 0, 0], [0, 0, -1], [1, 0, -1]], [[-1, 0, 0], [0, 0, -1], [-1, 0, -1]]],
    /* -Y */[[[-1, 0, 0], [0, 0, -1], [-1, 0, -1]], [[1, 0, 0], [0, 0, -1], [1, 0, -1]], [[1, 0, 0], [0, 0, 1], [1, 0, 1]], [[-1, 0, 0], [0, 0, 1], [-1, 0, 1]]],
    /* +Z */[[[-1, 0, 0], [0, -1, 0], [-1, -1, 0]], [[1, 0, 0], [0, -1, 0], [1, -1, 0]], [[1, 0, 0], [0, 1, 0], [1, 1, 0]], [[-1, 0, 0], [0, 1, 0], [-1, 1, 0]]],
    /* -Z */[[[1, 0, 0], [0, -1, 0], [1, -1, 0]], [[-1, 0, 0], [0, -1, 0], [-1, -1, 0]], [[-1, 0, 0], [0, 1, 0], [-1, 1, 0]], [[1, 0, 0], [0, 1, 0], [1, 1, 0]]]
  ];

  var World = {
    CX: CX, CZ: CZ, H: H,
    planet: null, chunks: null, seed: 0,
    genQueue: [], meshQueue: [], edits: null,
    stats: { chunks: 0, quads: 0, gen: 0, mesh: 0 },
    renderDist: 8,
    _scratch: null, _scratchW: null, _idxBuf: null, _idxQuads: 0,

    /* ------------------------------------------------------------ 初始化 */
    init: function (planet, edits) {
      World.planet = planet;
      World.chunks = {};
      World.seed = planet.seed >>> 0;
      World.edits = edits || {};
      World.genQueue = [];
      World.meshQueue = [];
      World.stats.chunks = 0;
      N.setSeed(World.seed);
      return World;
    },
    dispose: function () {
      var gl = DSC.GL.gl;
      for (var k in World.chunks) {
        var ch = World.chunks[k];
        if (ch.mesh) World._freeMesh(ch);
      }
      World.chunks = {};
      World.genQueue = []; World.meshQueue = [];
    },

    key: function (cx, cz) { return cx + ',' + cz; },

    /* ------------------------------------------------------------ 地形函数 */
    heightAt: function (wx, wz) {
      var t = World.planet.terrain;
      var cont = N.fbm2(wx * 0.0042, wz * 0.0042, 5);            /* 大陆 */
      var hills = N.fbm2(wx * 0.021 * t.rough, wz * 0.021 * t.rough, 4);
      var mo = N.ridged2(wx * 0.0068, wz * 0.0068, 4);
      mo = Math.pow(mo, 2.1) * t.mount;
      var h = t.seaLevel + cont * t.amp * 1.05 + hills * t.amp * 0.42 + mo * t.amp * 1.9;
      /* 平原化处理：靠近海平面时压平（形成滩涂） */
      var flat = U.smoothstep(0, 6, Math.abs(h - t.seaLevel));
      h = t.seaLevel + (h - t.seaLevel) * (0.45 + 0.55 * flat);
      return Math.max(2, Math.min(H - 6, Math.round(h)));
    },

    caveAt: function (wx, wy, wz, h) {
      var t = World.planet.terrain;
      if (t.cave <= 0) return false;
      if (wy < 2) return false;
      /* 两套 3D 噪声相交 → 隧道（比单噪声更像 MC 的洞穴系统） */
      var a = N.perlin3(wx * 0.028, wy * 0.052, wz * 0.028);
      var b = N.perlin3(wx * 0.028 + 41.7, wy * 0.052 + 17.3, wz * 0.028 - 9.1);
      var thr = 0.052 * t.cave * (1 + 0.5 * U.smoothstep(h - 4, h - 26, wy));
      if (Math.abs(a) < thr && Math.abs(b) < thr) return true;
      /* 大空腔 */
      var c = N.fbm3(wx * 0.013, wy * 0.02, wz * 0.013, 3);
      if (wy < h - 10 && c > 0.52 / t.cave) return true;
      return false;
    },

    oreAt: function (wx, wy, wz, depth) {
      var t = World.planet.terrain, r = N.rand3(wx, wy, wz), P = World.planet;
      var rich = t.ore;
      /* 矿脉团块噪声，避免单格散点 */
      var vein = N.fbm3(wx * 0.09, wy * 0.09, wz * 0.09, 2) * 0.5 + 0.5;
      if (vein < 0.52) return 0;
      var s = (vein - 0.52) * 2.1 * rich;
      if (wy < 16 && r < 0.020 * s) return B.ID.diamond_ore;
      if (wy < 26 && r < 0.030 * s) return B.ID.gold_ore;
      if (wy < 34 && r < 0.045 * s) return B.ID.emeril_ore;
      if (r < 0.070 * s) return B.ID.copper_ore;
      if (r < 0.130 * s) return B.ID.ferrite_ore;
      if (r < 0.200 * s) return B.ID.coal_ore;
      return 0;
    },

    /* ------------------------------------------------------------ 区块生成 */
    getChunk: function (cx, cz) { return World.chunks[World.key(cx, cz)] || null; },

    ensureChunk: function (cx, cz) {
      var k = World.key(cx, cz), ch = World.chunks[k];
      if (ch) return ch;
      ch = {
        cx: cx, cz: cz, key: k,
        blocks: null, sky: null, blk: null, hmap: null, lights: null,
        state: 0,           /* 0=空 1=已生成 2=已上光 3=已建网格 */
        mesh: null, waterMesh: null, dirty: false, lastUse: 0
      };
      World.chunks[k] = ch;
      World.stats.chunks++;
      return ch;
    },

    generate: function (ch) {
      if (ch.state >= 1) return ch;
      var P = World.planet, t = P.terrain, bk = P.blocks;
      var blocks = ch.blocks = new Uint8Array(CVOL);
      var hmap = ch.hmap = new Int16Array(CXZ);
      ch.lights = [];
      var ID = B.ID;
      var sSurf = ID[bk.surface], sSub = ID[bk.sub], sDeep = ID[bk.deep], sBeach = ID[bk.beach];
      var sea = t.seaLevel;
      var isLava = P.biome === 'volcanic';
      var seaBlock = isLava ? ID.magma : (P.biome === 'toxic' ? ID.toxic_sludge : ID.water);
      var ox = ch.cx * CX, oz = ch.cz * CZ;
      var x, y, z, i;

      for (z = 0; z < CZ; z++) {
        for (x = 0; x < CX; x++) {
          var wx = ox + x, wz = oz + z;
          var h = World.heightAt(wx, wz);
          hmap[x + z * CX] = h;
          var beach = h <= sea + 2 && h >= sea - 3;
          for (y = 0; y <= Math.max(h, sea); y++) {
            var id = 0;
            if (y === 0) id = ID.bedrock;
            else if (y <= h) {
              var depth = h - y;
              if (World.caveAt(wx, y, wz, h)) {
                id = 0;
                /* 洞穴底部偶发岩浆/发光晶体 */
                if (y < 12 && N.rand3(wx, y, wz) < 0.06) id = ID.magma;
                else if (y < 40 && N.rand3(wx + 7, y, wz + 3) < 0.012) id = ID[bk.crystal] || ID.chryson;
              } else if (depth === 0) {
                id = (h < sea - 1) ? (beach ? sBeach : sSub) : (beach ? sBeach : sSurf);
              } else if (depth < 4) {
                id = beach && depth < 3 ? sBeach : sSub;
              } else {
                id = sDeep;
                var ore = World.oreAt(wx, y, wz, depth);
                if (ore) id = ore;
              }
            } else if (y <= sea) {
              id = seaBlock;
            }
            if (id) {
              blocks[x + CX * (z + CZ * y)] = id;
              if (B.emissive(id) > 0) ch.lights.push([x, y, z, id]);
            }
          }
        }
      }
      ch.state = 1;
      World.applyFeatures(ch);
      /* 应用玩家改动（存档 diff） */
      var e = World.edits[ch.key];
      if (e) {
        for (i = 0; i < e.length; i += 2) {
          var pi = e[i], pid = e[i + 1];
          blocks[pi] = pid;
          if (B.emissive(pid) > 0) ch.lights.push([pi % CX, Math.floor(pi / (CX * CZ)), Math.floor(pi / CX) % CZ, pid]);
        }
      }
      World.stats.gen++;
      return ch;
    },

    /* 特征：树 / 晶簇 / 方碑 / 雪盖 / 发光植物（扫描邻域 ±6 以跨区块生长） */
    applyFeatures: function (ch) {
      var P = World.planet, t = P.terrain, bk = P.blocks, ID = B.ID;
      var ox = ch.cx * CX, oz = ch.cz * CZ, M = 6;
      var sea = t.seaLevel;
      for (var lz = -M; lz < CZ + M; lz++) {
        for (var lx = -M; lx < CX + M; lx++) {
          var wx = ox + lx, wz = oz + lz;
          var r = N.rand2(wx, wz);
          var h = null;

          /* 树 / 蘑菇 / 珊瑚 */
          if (r < 0.022 * t.tree) {
            h = World.heightAt(wx, wz);
            if (h > sea && h < H - 20) World._tree(ch, lx, h + 1, lz, wx, wz);
          }
          /* 晶簇（NMS 味发光晶体） */
          else if (r > 0.985 - 0.012 * t.crystal) {
            h = World.heightAt(wx, wz);
            if (h > sea - 2) World._crystal(ch, lx, h + 1, lz, wx, wz);
          }
          /* 发光植物点缀 */
          else if (r > 0.955 && r < 0.962) {
            h = World.heightAt(wx, wz);
            if (h > sea) World._set(ch, lx, h + 1, lz, ID[bk.extra] || ID.star_bulb);
          }
          /* 方碑（极稀有，每 ~4000 格一处） */
          else if (N.rand2(wx * 3 + 11, wz * 3 - 7) > 0.99975) {
            h = World.heightAt(wx, wz);
            if (h > sea + 1) World._monolith(ch, lx, h + 1, lz, wx, wz);
          }
        }
      }
      /* 雪/灰覆盖层：高海拔或冰原 */
      if (P.biome === 'frozen' || P.biome === 'volcanic') {
        var cover = P.biome === 'frozen' ? ID.snow_block : ID.ash_block;
        for (var z2 = 0; z2 < CZ; z2++) for (var x2 = 0; x2 < CX; x2++) {
          var hh = ch.hmap[x2 + z2 * CX];
          if (hh > sea && N.rand2(ox + x2 + 51, oz + z2 - 23) > 0.25) World._set(ch, x2, hh + 1, z2, cover);
        }
      }
    },

    _set: function (ch, lx, y, lz, id) {
      if (lx < 0 || lz < 0 || lx >= CX || lz >= CZ || y < 0 || y >= H || !id) return;
      var i = lx + CX * (lz + CZ * y);
      if (ch.blocks[i] && !B.isLiquid(ch.blocks[i])) return;
      ch.blocks[i] = id;
      if (B.emissive(id) > 0) ch.lights.push([lx, y, lz, id]);
    },
    _setForce: function (ch, lx, y, lz, id) {
      if (lx < 0 || lz < 0 || lx >= CX || lz >= CZ || y < 0 || y >= H) return;
      ch.blocks[lx + CX * (lz + CZ * y)] = id;
      if (B.emissive(id) > 0) ch.lights.push([lx, y, lz, id]);
    },

    _tree: function (ch, lx, y, lz, wx, wz) {
      var P = World.planet, bk = P.blocks, ID = B.ID;
      var rng = U.makeRng(N.ihash(wx, wz, 3));
      var trunk = ID[bk.tree] || ID.log, leaf = ID[bk.leaf] || ID.leaves;
      var alien = P.biome !== 'lush' && P.biome !== 'ocean';
      var hgt = alien ? 6 + Math.floor(rng() * 8) : 4 + Math.floor(rng() * 4);
      var i, dx, dy, dz;
      for (i = 0; i < hgt; i++) World._setForce(ch, lx, y + i, lz, trunk);
      if (P.biome === 'toxic' || P.biome === 'radioactive') {
        /* 蘑菇状伞盖 */
        var rad = 2 + Math.floor(rng() * 2);
        for (dz = -rad; dz <= rad; dz++) for (dx = -rad; dx <= rad; dx++) {
          if (dx * dx + dz * dz > rad * rad + 1) continue;
          World._set(ch, lx + dx, y + hgt, lz + dz, leaf);
          if (Math.abs(dx) + Math.abs(dz) < rad) World._set(ch, lx + dx, y + hgt - 1, lz + dz, leaf);
        }
      } else if (P.biome === 'ocean') {
        for (dz = -1; dz <= 1; dz++) for (dx = -1; dx <= 1; dx++) World._set(ch, lx + dx, y + hgt - 1 + (dx === 0 && dz === 0 ? 1 : 0), lz + dz, leaf);
      } else {
        /* 经典 MC 冠层：3 层，逐层收窄 */
        var top = y + hgt;
        for (dy = -2; dy <= 1; dy++) {
          var rr = dy <= -1 ? 2 : 1;
          for (dz = -rr; dz <= rr; dz++) for (dx = -rr; dx <= rr; dx++) {
            if (rr === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && rng() < 0.7) continue;
            if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
            World._set(ch, lx + dx, top + dy, lz + dz, leaf);
          }
        }
      }
    },

    _crystal: function (ch, lx, y, lz, wx, wz) {
      var P = World.planet, ID = B.ID;
      var rng = U.makeRng(N.ihash(wx, wz, 9));
      var id = ID[P.blocks.crystal] || ID.chryson;
      var n = 2 + Math.floor(rng() * 4);
      for (var c = 0; c < n; c++) {
        var dx = Math.floor(rng() * 5) - 2, dz = Math.floor(rng() * 5) - 2;
        var hh = 2 + Math.floor(rng() * 5);
        for (var i = 0; i < hh; i++) World._setForce(ch, lx + dx, y + i, lz + dz, id);
      }
    },

    _monolith: function (ch, lx, y, lz, wx, wz) {
      var ID = B.ID;
      var rng = U.makeRng(N.ihash(wx, wz, 27));
      var hh = 7 + Math.floor(rng() * 5);
      for (var i = 0; i < hh; i++) {
        World._setForce(ch, lx, y + i, lz, ID.monolith);
        World._setForce(ch, lx + 1, y + i, lz, ID.monolith);
      }
      /* 基座 */
      for (var dz = -2; dz <= 2; dz++) for (var dx = -2; dx <= 3; dx++) World._setForce(ch, lx + dx, y - 1, lz + dz, ID.obsidian);
      World._setForce(ch, lx, y + hh, lz, ID.glow_panel);
      World._setForce(ch, lx + 1, y + hh, lz, ID.glow_panel);
      /* 记录为兴趣点 */
      if (!World.poi) World.poi = [];
      if (World.poi.length < 64) World.poi.push({ x: wx, y: y, z: wz, kind: 'monolith' });
    },

    /* ------------------------------------------------------------ 光照 */
    computeLight: function (ch) {
      if (ch.state >= 2) return;
      var blocks = ch.blocks;
      var sky = ch.sky = new Uint8Array(CVOL);
      var blk = ch.blk = new Uint8Array(CVOL);
      var x, y, z, i, id;
      /* 天光：自上而下衰减（不做水平传播，换取速度；洞穴自然变暗） */
      for (z = 0; z < CZ; z++) for (x = 0; x < CX; x++) {
        var l = 15;
        for (y = H - 1; y >= 0; y--) {
          i = x + CX * (z + CZ * y);
          id = blocks[i];
          if (id) {
            if (B.isOpaque(id)) l = l > 4 ? l - 5 : 0;
            else l = l > 1 ? l - 2 : 0;
          }
          sky[i] = l;
        }
      }
      /* 方块光：从 9 个区块的光源做 BFS（半径 ≤ 14） */
      var sources = [];
      for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
        var nb = World.getChunk(ch.cx + dx, ch.cz + dz);
        if (!nb || !nb.lights) continue;
        for (i = 0; i < nb.lights.length; i++) {
          var L = nb.lights[i];
          var gx = L[0] + dx * CX, gz = L[2] + dz * CZ;
          if (gx < -14 || gx > CX + 14 || gz < -14 || gz > CZ + 14) continue;
          sources.push([gx, L[1], gz, Math.max(3, Math.round(B.emissive(L[3]) * 14))]);
        }
      }
      if (sources.length) {
        /* 用带边界的局部体积做 BFS，边界外用 world 查询（未生成则视为实心） */
        var R = 15, W = CX + R * 2;
        var lb = World._lbuf;
        if (!lb || lb.length < W * H * W) lb = World._lbuf = new Uint8Array(W * H * W);
        else lb.fill(0);
        var qi = 0, q = World._lq || (World._lq = new Int32Array(1 << 18));
        var qn = 0;
        function LI(px, py, pz) { return (px + R) + W * ((pz + R) + W * py); }
        function opaqueAt(px, py, pz) {
          if (py < 0 || py >= H) return true;
          var id2 = World.blockAtLocal(ch, px, py, pz);
          return B.isOpaque(id2);
        }
        for (i = 0; i < sources.length; i++) {
          var S = sources[i];
          if (S[1] < 0 || S[1] >= H) continue;
          var li = LI(S[0], S[1], S[2]);
          if (li < 0 || li >= lb.length) continue;
          if (lb[li] < S[3]) { lb[li] = S[3]; if (qn < q.length - 4) { q[qn++] = S[0]; q[qn++] = S[1]; q[qn++] = S[2]; } }
        }
        var NBR = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        while (qi < qn) {
          var px = q[qi++], py = q[qi++], pz = q[qi++];
          var lvl = lb[LI(px, py, pz)];
          if (lvl <= 1) continue;
          for (var f = 0; f < 6; f++) {
            var nx = px + NBR[f][0], ny = py + NBR[f][1], nz = pz + NBR[f][2];
            if (ny < 0 || ny >= H || nx < -R || nx >= CX + R || nz < -R || nz >= CZ + R) continue;
            var ni = LI(nx, ny, nz);
            var nl = lvl - 1;
            if (lb[ni] >= nl) continue;
            if (opaqueAt(nx, ny, nz)) { if (lb[ni] < nl) lb[ni] = nl > 1 ? nl - 1 : 0; continue; }
            lb[ni] = nl;
            if (qn < q.length - 4) { q[qn++] = nx; q[qn++] = ny; q[qn++] = nz; }
            else break;
          }
        }
        for (z = 0; z < CZ; z++) for (x = 0; x < CX; x++) for (y = 0; y < H; y++) {
          var v = lb[LI(x, y, z)];
          if (v) blk[x + CX * (z + CZ * y)] = v;
        }
      }
      /* 自发光方块本体也要亮 */
      for (i = 0; i < ch.lights.length; i++) {
        var Lg = ch.lights[i];
        if (Lg[1] < 0 || Lg[1] >= H) continue;
        var ii = Lg[0] + CX * (Lg[2] + CZ * Lg[1]);
        blk[ii] = Math.max(blk[ii], Math.round(B.emissive(Lg[3]) * 15));
      }
      ch.state = 2;
    },

    /* 区块局部坐标取块（越界走世界查询） */
    blockAtLocal: function (ch, lx, y, lz) {
      if (y < 0 || y >= H) return 0;
      if (lx >= 0 && lx < CX && lz >= 0 && lz < CZ) return ch.blocks[lx + CX * (lz + CZ * y)];
      return World.blockAt(ch.cx * CX + lx, y, ch.cz * CZ + lz);
    },
    lightAtLocal: function (ch, lx, y, lz, which) {
      if (y < 0) return which ? 0 : 0;
      if (y >= H) return which ? 0 : 15;
      if (lx >= 0 && lx < CX && lz >= 0 && lz < CZ) {
        var i = lx + CX * (lz + CZ * y);
        return which ? ch.blk[i] : ch.sky[i];
      }
      var nb = World.getChunk(ch.cx + Math.floor(lx / CX), ch.cz + Math.floor(lz / CZ));
      if (!nb || nb.state < 2) return which ? 0 : (y > (ch.hmap ? ch.hmap[0] : 40) ? 15 : 4);
      var mx = U.mod(lx, CX), mz = U.mod(lz, CZ), j = mx + CX * (mz + CZ * y);
      return which ? nb.blk[j] : nb.sky[j];
    },

    /* ------------------------------------------------------------ 网格构建 */
    _ensureScratch: function () {
      if (!World._scratch) World._scratch = new Uint8Array(1 << 21);   /* 2MB ≈ 262k 顶点 */
      if (!World._scratchW) World._scratchW = new Uint8Array(1 << 19);
    },
    _ensureIndex: function (quads) {
      var gl = DSC.GL.gl;
      if (World._idxQuads >= quads && World._idxBuf) return World._idxBuf;
      var n = Math.max(quads, 8192);
      var arr = new Uint32Array(n * 6);
      for (var i = 0, v = 0; i < n; i++, v += 4) {
        arr[i * 6] = v; arr[i * 6 + 1] = v + 1; arr[i * 6 + 2] = v + 2;
        arr[i * 6 + 3] = v; arr[i * 6 + 4] = v + 2; arr[i * 6 + 5] = v + 3;
      }
      if (World._idxBuf) gl.deleteBuffer(World._idxBuf);
      World._idxBuf = DSC.GL.buffer(arr, gl.ELEMENT_ARRAY_BUFFER);
      World._idxQuads = n;
      return World._idxBuf;
    },

    buildMesh: function (ch) {
      var gl = DSC.GL.gl;
      World._ensureScratch();
      if (ch.state < 1) World.generate(ch);
      if (ch.state < 2) World.computeLight(ch);
      var buf = World._scratch, bw = World._scratchW;
      var p = 0, pw = 0;
      var blocks = ch.blocks;
      var x, y, z, f, c;

      for (y = 0; y < H; y++) {
        for (z = 0; z < CZ; z++) {
          for (x = 0; x < CX; x++) {
            var id = blocks[x + CX * (z + CZ * y)];
            if (!id) continue;
            var def = B.LIST[id];
            var isLiq = def.liquid, transparent = !def.opaque;
            for (f = 0; f < 6; f++) {
              var F = FACES[f];
              var nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
              var nid = World.blockAtLocal(ch, nx, ny, nz);
              if (nid === id) continue;                        /* 同种相邻不画（水/玻璃连成片） */
              var ndef = B.LIST[nid];
              if (nid && ndef.opaque) continue;                /* 被不透明块挡住 */
              if (nid && !def.opaque && ndef.liquid && isLiq) continue;
              if (nid && def.opaque === false && ndef.opaque === false && !isLiq && !ndef.liquid && nid !== id) {
                /* 两个不同的半透明块相邻：仍然画（例如冰贴玻璃） */
              }
              var tile = def.tileIdx[f];
              var fs = FACE_SHADE[f];
              var target = transparent ? bw : buf;
              var ptr = transparent ? pw : p;
              if (ptr + 32 > target.length) continue;
              for (c = 0; c < 4; c++) {
                var vo = F.v[c];
                var ao = AO_OFF[f][c];
                var s1 = World._occ(ch, nx + ao[0][0], ny + ao[0][1], nz + ao[0][2]);
                var s2 = World._occ(ch, nx + ao[1][0], ny + ao[1][1], nz + ao[1][2]);
                var co = World._occ(ch, nx + ao[2][0], ny + ao[2][1], nz + ao[2][2]);
                var aoLvl = (s1 && s2) ? 0 : (3 - s1 - s2 - co);
                var shade = fs * AO_SHADE[aoLvl < 0 ? 0 : aoLvl];
                /* 平滑光照：面前一格 + 三个角格的平均 */
                var skyS = World.lightAtLocal(ch, nx, ny, nz, 0), blkS = World.lightAtLocal(ch, nx, ny, nz, 1), cnt = 1;
                for (var q = 0; q < 3; q++) {
                  var ax = nx + ao[q][0], ay = ny + ao[q][1], az = nz + ao[q][2];
                  if (B.isOpaque(World.blockAtLocal(ch, ax, ay, az))) continue;
                  skyS += World.lightAtLocal(ch, ax, ay, az, 0);
                  blkS += World.lightAtLocal(ch, ax, ay, az, 1);
                  cnt++;
                }
                var skyV = Math.round(skyS / cnt), blkV = Math.round(blkS / cnt);
                target[ptr] = x + vo[0];
                target[ptr + 1] = y + vo[1];
                target[ptr + 2] = z + vo[2];
                target[ptr + 3] = tile;
                target[ptr + 4] = Math.max(0, Math.min(255, Math.round(shade * 255)));
                target[ptr + 5] = ((skyV & 15) << 4) | (blkV & 15);
                target[ptr + 6] = c;
                target[ptr + 7] = f;
                ptr += VSTRIDE;
              }
              if (transparent) pw = ptr; else p = ptr;
            }
          }
        }
      }

      var quads = Math.max(p, pw) / (VSTRIDE * 4);
      World._ensureIndex(Math.ceil(quads) + 64);
      World._freeMesh(ch);
      ch.mesh = World._mkMesh(buf, p);
      ch.waterMesh = World._mkMesh(bw, pw);
      ch.state = 3; ch.dirty = false;
      World.stats.mesh++;
      World.stats.quads = (p + pw) / (VSTRIDE * 4);
      return ch;
    },

    _occ: function (ch, x, y, z) {
      var id = World.blockAtLocal(ch, x, y, z);
      return (id && B.isOpaque(id)) ? 1 : 0;
    },

    _mkMesh: function (src, bytes) {
      if (!bytes) return null;
      var gl = DSC.GL.gl;
      var data = src.subarray(0, bytes);
      var vb = DSC.GL.buffer(data);
      var A = [
        { buffer: vb, loc: 0, size: 3, type: gl.UNSIGNED_BYTE, stride: VSTRIDE, offset: 0 },
        { buffer: vb, loc: 1, size: 1, type: gl.UNSIGNED_BYTE, stride: VSTRIDE, offset: 3 },
        { buffer: vb, loc: 2, size: 1, type: gl.UNSIGNED_BYTE, normalized: true, stride: VSTRIDE, offset: 4 },
        { buffer: vb, loc: 3, size: 1, type: gl.UNSIGNED_BYTE, stride: VSTRIDE, offset: 5 },
        { buffer: vb, loc: 4, size: 1, type: gl.UNSIGNED_BYTE, stride: VSTRIDE, offset: 6 },
        { buffer: vb, loc: 5, size: 1, type: gl.UNSIGNED_BYTE, stride: VSTRIDE, offset: 7 }
      ];
      var vao = DSC.GL.vao(A, World._idxBuf);
      var verts = bytes / VSTRIDE;
      return { vao: vao, vb: vb, indexCount: (verts / 4) * 6, indexType: gl.UNSIGNED_INT };
    },

    _freeMesh: function (ch) {
      var gl = DSC.GL.gl;
      if (ch.mesh) { gl.deleteVertexArray(ch.mesh.vao); gl.deleteBuffer(ch.mesh.vb); ch.mesh = null; }
      if (ch.waterMesh) { gl.deleteVertexArray(ch.waterMesh.vao); gl.deleteBuffer(ch.waterMesh.vb); ch.waterMesh = null; }
    },

    /* ------------------------------------------------------------ 访问 */
    blockAt: function (wx, wy, wz) {
      if (wy < 0 || wy >= H) return 0;
      var cx = wx >> 4, cz = wz >> 4;
      var ch = World.chunks[cx + ',' + cz];
      if (!ch || ch.state < 1) return 0;
      return ch.blocks[(wx & 15) + CX * ((wz & 15) + CZ * wy)];
    },
    solidAt: function (wx, wy, wz) {
      var id = World.blockAt(wx | 0, wy | 0, wz | 0);
      return id ? B.LIST[id].solid : false;
    },
    liquidAt: function (wx, wy, wz) {
      var id = World.blockAt(Math.floor(wx), Math.floor(wy), Math.floor(wz));
      return id ? B.LIST[id].liquid : false;
    },

    setBlock: function (wx, wy, wz, id, opts) {
      if (wy < 1 || wy >= H) return false;
      var cx = wx >> 4, cz = wz >> 4;
      var ch = World.chunks[cx + ',' + cz];
      if (!ch || ch.state < 1) return false;
      var lx = wx & 15, lz = wz & 15;
      var i = lx + CX * (lz + CZ * wy);
      var old = ch.blocks[i];
      if (old === id) return false;
      ch.blocks[i] = id;
      if (B.emissive(id) > 0) ch.lights.push([lx, wy, lz, id]);
      else if (B.emissive(old) > 0) {
        for (var k = ch.lights.length - 1; k >= 0; k--) {
          var L = ch.lights[k];
          if (L[0] === lx && L[1] === wy && L[2] === lz) ch.lights.splice(k, 1);
        }
      }
      /* 记录存档 diff */
      if (!opts || opts.record !== false) {
        var e = World.edits[ch.key] || (World.edits[ch.key] = []);
        e.push(i, id);
        if (e.length > 8192) e.splice(0, 2048);
      }
      /* 标记重建：本区块 + 触边邻块 */
      World._markDirty(ch);
      if (lx === 0) World._markNeighbor(cx - 1, cz);
      if (lx === 15) World._markNeighbor(cx + 1, cz);
      if (lz === 0) World._markNeighbor(cx, cz - 1);
      if (lz === 15) World._markNeighbor(cx, cz + 1);
      if (B.emissive(id) > 0 || B.emissive(old) > 0) {
        for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) World._markNeighbor(cx + dx, cz + dz);
      }
      return true;
    },
    _markDirty: function (ch) {
      ch.state = Math.min(ch.state, 1); ch.dirty = true;
      if (World.meshQueue.indexOf(ch) < 0) World.meshQueue.unshift(ch);
    },
    _markNeighbor: function (cx, cz) {
      var nb = World.chunks[cx + ',' + cz];
      if (nb && nb.state >= 1) World._markDirty(nb);
    },

    /* 地表高度（已生成区块用真实数据，否则用地形函数） */
    surfaceY: function (wx, wz) {
      var ch = World.chunks[(wx >> 4) + ',' + (wz >> 4)];
      if (ch && ch.state >= 1) {
        for (var y = H - 1; y > 0; y--) {
          var id = ch.blocks[(wx & 15) + CX * ((wz & 15) + CZ * y)];
          if (id && B.LIST[id].solid) return y + 1;
        }
        return 1;
      }
      return World.heightAt(wx, wz) + 1;
    },

    /* ------------------------------------------------------------ 射线选取（DDA） */
    raycast: function (o, d, maxD) {
      maxD = maxD || 6;
      var x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
      var sx = d[0] > 0 ? 1 : -1, sy = d[1] > 0 ? 1 : -1, sz = d[2] > 0 ? 1 : -1;
      var dx = Math.abs(d[0]) < 1e-9 ? 1e9 : Math.abs(1 / d[0]);
      var dy = Math.abs(d[1]) < 1e-9 ? 1e9 : Math.abs(1 / d[1]);
      var dz = Math.abs(d[2]) < 1e-9 ? 1e9 : Math.abs(1 / d[2]);
      var tx = ((d[0] > 0 ? (x + 1 - o[0]) : (o[0] - x)) || 1e-9) * dx;
      var ty = ((d[1] > 0 ? (y + 1 - o[1]) : (o[1] - y)) || 1e-9) * dy;
      var tz = ((d[2] > 0 ? (z + 1 - o[2]) : (o[2] - z)) || 1e-9) * dz;
      var face = -1, t = 0, guard = 0;
      while (t <= maxD && guard++ < 512) {
        var id = World.blockAt(x, y, z);
        if (id && B.LIST[id].sel) {
          var n = [0, 0, 0];
          if (face === 0) n[0] = -sx; else if (face === 1) n[1] = -sy; else if (face === 2) n[2] = -sz;
          return { hit: true, x: x, y: y, z: z, id: id, normal: n, dist: t, face: face };
        }
        if (tx < ty && tx < tz) { x += sx; t = tx; tx += dx; face = 0; }
        else if (ty < tz) { y += sy; t = ty; ty += dy; face = 1; }
        else { z += sz; t = tz; tz += dz; face = 2; }
      }
      return { hit: false };
    },

    /* AABB 与方块碰撞：返回是否重叠 */
    boxSolid: function (minx, miny, minz, maxx, maxy, maxz) {
      var x0 = Math.floor(minx), x1 = Math.floor(maxx);
      var y0 = Math.floor(miny), y1 = Math.floor(maxy);
      var z0 = Math.floor(minz), z1 = Math.floor(maxz);
      for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++) for (var x = x0; x <= x1; x++) {
        if (World.solidAt(x, y, z)) return true;
      }
      return false;
    },

    /* ------------------------------------------------------------ 流式更新 */
    update: function (camX, camZ, dist, budgetMs) {
      dist = dist || World.renderDist;
      var t0 = performance.now();
      var ccx = Math.floor(camX / CX), ccz = Math.floor(camZ / CZ);
      var i, ch;
      /* 收集需要的区块（螺旋由近到远） */
      var need = World._ring(ccx, ccz, dist);
      for (i = 0; i < need.length; i++) {
        ch = World.ensureChunk(need[i][0], need[i][1]);
        ch.lastUse = World._frame;
        if (ch.state < 3 && World.meshQueue.indexOf(ch) < 0) World.meshQueue.push(ch);
      }
      /* 处理队列（预算内） */
      var done = 0;
      while (World.meshQueue.length && performance.now() - t0 < (budgetMs || 7)) {
        ch = World.meshQueue.shift();
        if (!ch) break;
        var d2 = Math.max(Math.abs(ch.cx - ccx), Math.abs(ch.cz - ccz));
        if (d2 > dist + 2) continue;
        /* 建网格前保证 8 邻居已生成（面剔除与光照需要） */
        for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
          var nb = World.ensureChunk(ch.cx + dx, ch.cz + dz);
          if (nb.state < 1) World.generate(nb);
        }
        if (ch.state < 2) World.computeLight(ch);
        World.buildMesh(ch);
        done++;
        if (done > 6) break;
      }
      /* 卸载远处区块 */
      if ((World._frame & 63) === 0) {
        for (var k in World.chunks) {
          var c2 = World.chunks[k];
          if (Math.max(Math.abs(c2.cx - ccx), Math.abs(c2.cz - ccz)) > dist + 4) {
            World._freeMesh(c2);
            delete World.chunks[k];
            World.stats.chunks--;
          }
        }
      }
      World._frame++;
      return done;
    },
    _frame: 0,
    _ringCache: null,
    _ring: function (ccx, ccz, dist) {
      if (World._ringCache && World._ringCache.d === dist && World._ringCache.x === ccx && World._ringCache.z === ccz)
        return World._ringCache.list;
      var list = [];
      for (var r = 0; r <= dist; r++) {
        for (var dx = -r; dx <= r; dx++) for (var dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          list.push([ccx + dx, ccz + dz]);
        }
      }
      World._ringCache = { d: dist, x: ccx, z: ccz, list: list };
      return list;
    },

    /* 预生成某点周围（着陆用），同步执行，返回耗时 */
    preload: function (wx, wz, r) {
      var t0 = performance.now();
      var ccx = Math.floor(wx / CX), ccz = Math.floor(wz / CZ);
      var i, list = World._ring(ccx, ccz, r);
      for (i = 0; i < list.length; i++) {
        var ch = World.ensureChunk(list[i][0], list[i][1]);
        if (ch.state < 1) World.generate(ch);
      }
      for (i = 0; i < list.length; i++) {
        var c = World.getChunk(list[i][0], list[i][1]);
        if (c && c.state < 3) { World.computeLight(c); World.buildMesh(c); }
      }
      return performance.now() - t0;
    },

    /* 找一个平坦的降落点（附近 8 格内高度差最小） */
    findLandingSpot: function (wx, wz) {
      var best = null, bestScore = 1e9;
      for (var dz = -24; dz <= 24; dz += 8) for (var dx = -24; dx <= 24; dx += 8) {
        var x = Math.round(wx + dx), z = Math.round(wz + dz);
        var h0 = World.heightAt(x, z);
        if (h0 <= World.planet.terrain.seaLevel + 1) continue;
        var vary = 0;
        for (var k = 0; k < 4; k++) {
          var ax = x + (k === 0 ? 4 : k === 1 ? -4 : 0), az = z + (k === 2 ? 4 : k === 3 ? -4 : 0);
          vary += Math.abs(World.heightAt(ax, az) - h0);
        }
        var score = vary + Math.abs(dx) * 0.02 + Math.abs(dz) * 0.02;
        if (score < bestScore) { bestScore = score; best = [x, h0 + 1, z]; }
      }
      if (!best) {
        var h = World.heightAt(Math.round(wx), Math.round(wz));
        best = [Math.round(wx), Math.max(World.planet.terrain.seaLevel + 2, h + 1), Math.round(wz)];
      }
      return best;
    }
  };

  DSC.World = World;
})();
