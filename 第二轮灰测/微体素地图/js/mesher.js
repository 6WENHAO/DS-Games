/* =====================================================================
   微体素地图 · 网格化与光照烘焙
   1) 光照体积：所有发光材质聚合为光源，splat 进 3D 纹理 → 霓虹溢光免费获得
   2) 体素网格：面剔除 + 顶点 AO + 逐面日照可见度（DDA 光线步进，瓦片跳跃加速）
   3) 地形网格：列高图贪心合并（顶面 + 侧壁 + 底座），色彩/AO/日照走 2D 贴图
   所有重活以生成器实现，主线程分时执行并汇报进度
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, MATLIST = VX.MATLIST;
  var SX = VX.SX, SY = VX.SY, SZ = VX.SZ, CS = VX.CS, CX = VX.CX, CY = VX.CY, CZ = VX.CZ;
  var SEC = 128, SCX = Math.ceil(SX / SEC), SCZ = Math.ceil(SZ / SEC);
  var PLINTH = 0;

  VX.SEC = SEC; VX.SCX = SCX; VX.SCZ = SCZ;

  /* ------------------------- 可增长顶点缓冲 ------------------------- */
  function MeshBuf(stride) {
    this.stride = stride; this.cap = 2048; this.n = 0;
    this.buf = new ArrayBuffer(this.cap * stride);
    this.u8 = new Uint8Array(this.buf); this.u16 = new Uint16Array(this.buf);
  }
  MeshBuf.prototype.ensure = function (k) {
    if (this.n + k <= this.cap) return;
    while (this.n + k > this.cap) this.cap *= 2;
    var nb = new ArrayBuffer(this.cap * this.stride);
    new Uint8Array(nb).set(this.u8);
    this.buf = nb; this.u8 = new Uint8Array(nb); this.u16 = new Uint16Array(nb);
  };
  MeshBuf.prototype.trim = function () {
    return new Uint8Array(this.buf, 0, this.n * this.stride);
  };

  /* ------------------------- 面几何表 ------------------------- */
  // dir: 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z
  var NRM = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  var VERT = [
    [[1,0,1],[1,0,0],[1,1,0],[1,1,1]],   // +X
    [[0,0,0],[0,0,1],[0,1,1],[0,1,0]],   // -X
    [[0,1,1],[1,1,1],[1,1,0],[0,1,0]],   // +Y
    [[0,0,0],[1,0,0],[1,0,1],[0,0,1]],   // -Y
    [[0,0,1],[1,0,1],[1,1,1],[0,1,1]],   // +Z
    [[1,0,0],[0,0,0],[0,1,0],[1,1,0]]    // -Z
  ];
  // 每个方向的两个切向轴（非法线轴）
  var TAN = [[1,2],[1,2],[0,2],[0,2],[0,1],[0,1]];

  /* =====================================================================
     1. 光照体积烘焙
     ===================================================================== */
  VX.bakeLightVolume = function* (w, report) {
    var VOL = VX.VOL, VW = VX.VW, VH = VX.VH, VD = VX.VD;
    var cells = VW * VH * VD;
    var acc = new Float32Array(cells * 3);
    var lights = w.lights;
    var i, L, n = lights.length;
    for (i = 0; i < n; i++) {
      L = lights[i];
      var rad = L.rad * 1.35;
      var cr = rad / VOL;
      var cx0 = Math.max(0, Math.floor((L.x - rad) / VOL)), cx1 = Math.min(VW - 1, Math.ceil((L.x + rad) / VOL));
      var cy0 = Math.max(0, Math.floor((L.y - rad) / VOL)), cy1 = Math.min(VH - 1, Math.ceil((L.y + rad) / VOL));
      var cz0 = Math.max(0, Math.floor((L.z - rad) / VOL)), cz1 = Math.min(VD - 1, Math.ceil((L.z + rad) / VOL));
      var lr = L.r / 255, lg = L.g / 255, lb = L.b / 255, lw = L.w;
      for (var cz = cz0; cz <= cz1; cz++) {
        var wz = cz * VOL + VOL * 0.5;
        for (var cy = cy0; cy <= cy1; cy++) {
          var wy = cy * VOL + VOL * 0.5;
          var rowBase = ((cy * VD + cz) * VW) * 3;
          for (var cxx = cx0; cxx <= cx1; cxx++) {
            var wx = cxx * VOL + VOL * 0.5;
            var d = Math.sqrt((wx - L.x) * (wx - L.x) + (wy - L.y) * (wy - L.y) + (wz - L.z) * (wz - L.z));
            if (d > rad) continue;
            var t = 1 - d / rad;
            var f = t * t * lw;
            var o = rowBase + cxx * 3;
            acc[o] += lr * f; acc[o + 1] += lg * f; acc[o + 2] += lb * f;
          }
        }
      }
      if ((i & 1023) === 0) { report && report(i / n); yield; }
    }
    // 归一 → RGBA8（着色器再乘回 SCALE）
    var SCALE = 1.05;
    var data = new Uint8Array(cells * 4);
    for (i = 0; i < cells; i++) {
      var r = acc[i * 3] / SCALE, g = acc[i * 3 + 1] / SCALE, b = acc[i * 3 + 2] / SCALE;
      var mx = Math.max(r, g, b);
      if (mx > 1) { r /= mx; g /= mx; b /= mx; }      // 保色相，亮度存 A
      data[i * 4] = Math.min(255, r * 255) | 0;
      data[i * 4 + 1] = Math.min(255, g * 255) | 0;
      data[i * 4 + 2] = Math.min(255, b * 255) | 0;
      data[i * 4 + 3] = Math.min(255, (mx > 1 ? mx : 1) * 96) | 0;
    }
    return { data: data, w: VW, h: VH, d: VD, scale: SCALE };
  };

  /* =====================================================================
     2. 日照可见度（DDA + 瓦片跳跃）
     ===================================================================== */
  function makeSunTracer(w, sd) {
    var H = w.H, tm = w.tileMax, TW = w.TW;
    var maxY = 0;
    for (var i = 0; i < tm.length; i++) if (tm[i] > maxY) maxY = tm[i];
    maxY += 2;
    var sx = sd[0], sy = sd[1], sz = sd[2];
    var MAXLEN = 220;                                 // 阴影射线长度上限
    return function (px, py, pz) {
      if (sy <= 0.02) return 0;
      var x = px, y = py, z = pz, travel = 0;
      while (travel < MAXLEN) {
        if (y > maxY) return 1;
        var ix = x | 0, iz = z | 0;
        if (ix < 0 || iz < 0 || ix >= SX || iz >= SZ) return 1;
        var t = tm[(iz >> 3) * TW + (ix >> 3)];
        if (y > t + 1) {                              // 本瓦片上方无遮挡 → 大步跳
          x += sx * 7; y += sy * 7; z += sz * 7; travel += 7; continue;
        }
        var iy = y | 0;
        if (iy >= 0 && iy < SY) {
          var h = H[iz * SX + ix];
          if (h >= 0 && iy <= h) return 0;
          var c = w.chunks.get(((iy >> 5) * CZ + (iz >> 5)) * CX + (ix >> 5));
          if (c) {
            var mm = c[((iy & 31) << 10) | ((iz & 31) << 5) | (ix & 31)];
            if (mm !== 0 && MATLIST[mm].alpha > 0.9 && !MATLIST[mm].glow) return 0;
          }
        }
        x += sx; y += sy; z += sz; travel += 1;
      }
      return 1;
    };
  }
  VX.makeSunTracer = makeSunTracer;

  /* =====================================================================
     3. 体素网格化
     ===================================================================== */
  VX.meshVoxels = function* (w, sd, report) {
    var H = w.H, chunks = w.chunks;
    var sun = makeSunTracer(w, sd);
    // 每个扇区 × 3 通道
    var bufs = [], s;
    for (s = 0; s < SCX * SCZ * 3; s++) bufs.push(null);
    var STRIDE = 16;

    // 单条目区块缓存（相邻查询命中率极高）
    var _ck = -1, _cc = null;
    function chunkAt(cx, cy, cz) {
      var key = (cy * CZ + cz) * CX + cx;
      if (key === _ck) return _cc;
      _ck = key; _cc = chunks.get(key) || null;
      return _cc;
    }

    function blocks(x, y, z) {
      if (x < 0 || z < 0 || x >= SX || y < 0 || z >= SZ) return true;
      if (y >= SY) return false;
      var h = H[z * SX + x];
      if (h >= 0 && y <= h) return true;
      var c = chunkAt(x >> 5, y >> 5, z >> 5);
      if (!c) return false;
      var m = c[((y & 31) << 10) | ((z & 31) << 5) | (x & 31)];
      if (m === 0) return false;
      var r = MATLIST[m];
      return r.alpha > 0.9 && !r.glow;
    }
    function anySolid(x, y, z) {
      if (x < 0 || z < 0 || x >= SX || y < 0 || z >= SZ || y >= SY) return false;
      var h = H[z * SX + x];
      if (h >= 0 && y <= h) return true;
      var c = chunkAt(x >> 5, y >> 5, z >> 5);
      return !!c && c[((y & 31) << 10) | ((z & 31) << 5) | (x & 31)] !== 0;
    }

    var keys = Array.from(chunks.keys());
    var total = keys.length, faces = 0;
    // 背向太阳的面无需追踪（直接 sun=0），省一半光线
    var NDL = [];
    for (var dd = 0; dd < 6; dd++) NDL.push(NRM[dd][0] * sd[0] + NRM[dd][1] * sd[1] + NRM[dd][2] * sd[2]);

    for (var ki = 0; ki < total; ki++) {
      var key = keys[ki];
      var chunk = chunks.get(key);
      var ccx = key % CX, rest = (key - ccx) / CX, ccz = rest % CZ, ccy = (rest - ccz) / CZ;
      var bx = ccx * CS, by = ccy * CS, bz = ccz * CS;

      for (var ly = 0; ly < CS; ly++) {
        var wy = by + ly;
        if (wy >= SY) break;
        for (var lz = 0; lz < CS; lz++) {
          var wz = bz + lz;
          if (wz >= SZ) break;
          var rowIdx = (ly << 10) | (lz << 5);
          for (var lx = 0; lx < CS; lx++) {
            var mid = chunk[rowIdx | lx];
            if (mid === 0) continue;
            var wx = bx + lx;
            if (wx >= SX) break;
            var rec = MATLIST[mid];
            // 被地形埋住的体素整体跳过
            var hh = H[wz * SX + wx];
            if (hh >= 0 && wy < hh) continue;

            var secIdx = ((wz / SEC) | 0) * SCX + ((wx / SEC) | 0);
            var pass = rec.pass;
            var bi = secIdx * 3 + pass;
            var mb = bufs[bi];
            if (!mb) { mb = bufs[bi] = new MeshBuf(STRIDE); }

            for (var d = 0; d < 6; d++) {
              var nx = NRM[d][0], ny = NRM[d][1], nz = NRM[d][2];
              var ax = wx + nx, ay = wy + ny, az = wz + nz;
              if (pass === 0) { if (blocks(ax, ay, az)) continue; }
              else {
                // 半透明/发光：邻居同材质则不出面；邻居不透明则不出面
                if (blocks(ax, ay, az)) continue;
                var nm = w.get(ax, ay, az);
                if (nm === mid) continue;
              }
              // 逐面日照（背光面直接为 0）
              var sunB;
              if (NDL[d] <= 0.001) sunB = 0;
              else sunB = (sun(wx + 0.5 + nx * 0.62, wy + 0.5 + ny * 0.62, wz + 0.5 + nz * 0.62) * 255) | 0;
              var t0 = TAN[d][0], t1 = TAN[d][1];
              mb.ensure(4);
              var vbase = mb.n, u16 = mb.u16, u8 = mb.u8;
              var flk = rec.flk ? (1 + ((M.hash3(wx * 7, wy * 13, wz * 5) * 254) | 0)) : 0;
              var VD4 = VERT[d];
              for (var vi = 0; vi < 4; vi++) {
                var P = VD4[vi];
                var vx = wx + P[0], vy = wy + P[1], vz = wz + P[2];
                // AO：+N 层的两个边邻与角邻（标量偏移，避免每顶点分配数组）
                var s0x = 0, s0y = 0, s0z = 0, s1x = 0, s1y = 0, s1z = 0;
                if (t0 === 0) s0x = P[0] === 1 ? 1 : -1;
                else if (t0 === 1) s0y = P[1] === 1 ? 1 : -1;
                else s0z = P[2] === 1 ? 1 : -1;
                if (t1 === 0) s1x = P[0] === 1 ? 1 : -1;
                else if (t1 === 1) s1y = P[1] === 1 ? 1 : -1;
                else s1z = P[2] === 1 ? 1 : -1;
                var s1 = anySolid(ax + s0x, ay + s0y, az + s0z) ? 1 : 0;
                var s2 = anySolid(ax + s1x, ay + s1y, az + s1z) ? 1 : 0;
                var sc = (s1 && s2) ? 1 : (anySolid(ax + s0x + s1x, ay + s0y + s1y, az + s0z + s1z) ? 1 : 0);
                var ao = 255 - (s1 + s2 + sc) * 52;
                var vo = (vbase + vi) * 8;
                u16[vo] = vx * 2; u16[vo + 1] = vy * 2; u16[vo + 2] = vz * 2;
                var bo = (vbase + vi) * STRIDE;
                u8[bo + 6] = d;
                u8[bo + 7] = ao;
                u8[bo + 8] = sunB;
                u8[bo + 9] = Math.min(255, rec.emis * 170) | 0;
                u8[bo + 10] = flk;
                u8[bo + 11] = (rec.alpha * 255) | 0;
                u8[bo + 12] = rec.rgb[0]; u8[bo + 13] = rec.rgb[1]; u8[bo + 14] = rec.rgb[2];
                u8[bo + 15] = rec.flk;
              }
              mb.n += 4; faces++;
            }
          }
        }
      }
      if ((ki & 15) === 0) { report && report(ki / total, faces); yield; }
    }

    // 打包
    var out = [];
    for (s = 0; s < SCX * SCZ; s++) {
      for (var p = 0; p < 3; p++) {
        var b = bufs[s * 3 + p];
        if (!b || !b.n) continue;
        var sxi = s % SCX, szi = (s - sxi) / SCX;
        out.push({ data: b.trim(), quads: b.n / 4, pass: p, stride: STRIDE,
          x0: sxi * SEC, z0: szi * SEC, x1: (sxi + 1) * SEC, z1: (szi + 1) * SEC });
      }
    }
    return { meshes: out, faces: faces };
  };

  /* =====================================================================
     4. 地形网格化（贪心合并）+ 贴图烘焙
     ===================================================================== */
  VX.meshTerrain = function* (w, sd, report) {
    var H = w.H, Mt = w.Mt, Mu = w.Mu;
    var sun = makeSunTracer(w, sd);
    var STRIDE = 12;
    var bufs = new Array(SCX * SCZ);

    function buf(x, z) {
      var i = ((z / SEC) | 0) * SCX + ((x / SEC) | 0);
      var b = bufs[i];
      if (!b) b = bufs[i] = new MeshBuf(STRIDE);
      return b;
    }
    function push(b, x, y, z, u, v, d, kind) {
      var vo = b.n * 6, bo = b.n * STRIDE;
      b.u16[vo] = (x * 2) | 0; b.u16[vo + 1] = (y * 2) | 0; b.u16[vo + 2] = (z * 2) | 0;
      b.u16[vo + 3] = (u * 2) | 0; b.u16[vo + 4] = (v * 2) | 0;
      b.u8[bo + 10] = d; b.u8[bo + 11] = kind;
      b.n++;
    }

    /* --- 顶面：贪心合并等高区域（限制在扇区内） --- */
    var visited = new Uint8Array(SX * SZ);
    var quads = 0, x, z, i;
    for (z = 0; z < SZ; z++) {
      var zSecEnd = Math.min(SZ, (((z / SEC) | 0) + 1) * SEC);
      for (x = 0; x < SX; x++) {
        i = z * SX + x;
        if (visited[i] || H[i] < 0) continue;
        var h = H[i];
        var xSecEnd = Math.min(SX, (((x / SEC) | 0) + 1) * SEC);
        var wq = 1;
        while (x + wq < xSecEnd && !visited[i + wq] && H[i + wq] === h) wq++;
        var dq = 1;
        outer: while (z + dq < zSecEnd) {
          var ri = (z + dq) * SX + x;
          for (var k = 0; k < wq; k++) if (visited[ri + k] || H[ri + k] !== h) break outer;
          dq++;
        }
        for (var zz = 0; zz < dq; zz++) {
          var rr = (z + zz) * SX + x;
          for (var xx = 0; xx < wq; xx++) visited[rr + xx] = 1;
        }
        var y = h + 1, b = buf(x, z);
        b.ensure(4);
        push(b, x, y, z + dq, x, z + dq, 2, 0);
        push(b, x + wq, y, z + dq, x + wq, z + dq, 2, 0);
        push(b, x + wq, y, z, x + wq, z, 2, 0);
        push(b, x, y, z, x, z, 2, 0);
        quads++;
      }
      if ((z & 63) === 0) { report && report(z / SZ * 0.34); yield; }
    }

    /* --- 侧壁：沿 ±X / ±Z 四向，按 (h, base) 相同合并 --- */
    // ±X 方向：沿 Z 合并
    var dirs = [
      { d: 0, dx: 1, dz: 0 }, { d: 1, dx: -1, dz: 0 },
      { d: 4, dx: 0, dz: 1 }, { d: 5, dx: 0, dz: -1 }
    ];
    for (var di = 0; di < 4; di++) {
      var D = dirs[di], along = D.dx ? 'z' : 'x';
      var vis2 = new Uint8Array(SX * SZ);
      for (z = 0; z < SZ; z++) {
        for (x = 0; x < SX; x++) {
          i = z * SX + x;
          if (vis2[i] || H[i] < 0) continue;
          var hh = H[i];
          var nxp = x + D.dx, nzp = z + D.dz;
          var hn = (nxp < 0 || nzp < 0 || nxp >= SX || nzp >= SZ) ? -1 : H[nzp * SX + nxp];
          if (hn >= hh) continue;
          var base = hn < 0 ? PLINTH : hn + 1;
          var kind = hn < 0 ? 2 : 1;
          // 沿垂直方向合并
          var run = 1;
          if (along === 'z') {
            var zEnd = Math.min(SZ, (((z / SEC) | 0) + 1) * SEC);
            while (z + run < zEnd) {
              var j = (z + run) * SX + x;
              if (vis2[j] || H[j] !== hh) break;
              var nj = (z + run + D.dz) * SX + (x + D.dx);
              var hnj = (x + D.dx < 0 || x + D.dx >= SX || z + run + D.dz < 0 || z + run + D.dz >= SZ) ? -1 : H[nj];
              var bj = hnj < 0 ? PLINTH : hnj + 1;
              if (bj !== base || (hnj < 0 ? 2 : 1) !== kind) break;
              run++;
            }
            for (k = 0; k < run; k++) vis2[(z + k) * SX + x] = 1;
          } else {
            var xEnd2 = Math.min(SX, (((x / SEC) | 0) + 1) * SEC);
            while (x + run < xEnd2) {
              var j2 = z * SX + (x + run);
              if (vis2[j2] || H[j2] !== hh) break;
              var nx2 = x + run + D.dx, nz2 = z + D.dz;
              var hn2 = (nx2 < 0 || nx2 >= SX || nz2 < 0 || nz2 >= SZ) ? -1 : H[nz2 * SX + nx2];
              var b2 = hn2 < 0 ? PLINTH : hn2 + 1;
              if (b2 !== base || (hn2 < 0 ? 2 : 1) !== kind) break;
              run++;
            }
            for (k = 0; k < run; k++) vis2[z * SX + (x + k)] = 1;
          }

          var y0 = base, y1 = hh + 1;
          var bb = buf(x, z); bb.ensure(4);
          if (D.d === 0) {          // +X 面，位于 x+1 平面，沿 z 延伸 run
            push(bb, x + 1, y0, z + run, x + 0.5, z + 0.5 + run - 0.0, 0, kind);
            push(bb, x + 1, y0, z, x + 0.5, z + 0.5, 0, kind);
            push(bb, x + 1, y1, z, x + 0.5, z + 0.5, 0, kind);
            push(bb, x + 1, y1, z + run, x + 0.5, z + 0.5 + run, 0, kind);
          } else if (D.d === 1) {   // -X 面
            push(bb, x, y0, z, x + 0.5, z + 0.5, 1, kind);
            push(bb, x, y0, z + run, x + 0.5, z + 0.5 + run, 1, kind);
            push(bb, x, y1, z + run, x + 0.5, z + 0.5 + run, 1, kind);
            push(bb, x, y1, z, x + 0.5, z + 0.5, 1, kind);
          } else if (D.d === 4) {   // +Z 面，位于 z+1，沿 x 延伸
            push(bb, x, y0, z + 1, x + 0.5, z + 0.5, 4, kind);
            push(bb, x + run, y0, z + 1, x + 0.5 + run, z + 0.5, 4, kind);
            push(bb, x + run, y1, z + 1, x + 0.5 + run, z + 0.5, 4, kind);
            push(bb, x, y1, z + 1, x + 0.5, z + 0.5, 4, kind);
          } else {                  // -Z 面
            push(bb, x + run, y0, z, x + 0.5 + run, z + 0.5, 5, kind);
            push(bb, x, y0, z, x + 0.5, z + 0.5, 5, kind);
            push(bb, x, y1, z, x + 0.5, z + 0.5, 5, kind);
            push(bb, x + run, y1, z, x + 0.5 + run, z + 0.5, 5, kind);
          }
          quads++;
        }
        if ((z & 127) === 0) { report && report(0.34 + (di * SZ + z) / (4 * SZ) * 0.16); yield; }
      }
    }

    /* --- 底面：岛体底座 --- */
    var vis3 = new Uint8Array(SX * SZ);
    for (z = 0; z < SZ; z++) {
      for (x = 0; x < SX; x++) {
        i = z * SX + x;
        if (vis3[i] || H[i] < 0) continue;
        var xe = Math.min(SX, (((x / SEC) | 0) + 1) * SEC), ze = Math.min(SZ, (((z / SEC) | 0) + 1) * SEC);
        var wq2 = 1;
        while (x + wq2 < xe && !vis3[i + wq2] && H[i + wq2] >= 0) wq2++;
        var dq2 = 1;
        outer2: while (z + dq2 < ze) {
          var r2 = (z + dq2) * SX + x;
          for (k = 0; k < wq2; k++) if (vis3[r2 + k] || H[r2 + k] < 0) break outer2;
          dq2++;
        }
        for (zz = 0; zz < dq2; zz++) { var r3 = (z + zz) * SX + x; for (xx = 0; xx < wq2; xx++) vis3[r3 + xx] = 1; }
        var b3 = buf(x, z); b3.ensure(4);
        push(b3, x, PLINTH, z, x, z, 3, 2);
        push(b3, x + wq2, PLINTH, z, x + wq2, z, 3, 2);
        push(b3, x + wq2, PLINTH, z + dq2, x + wq2, z + dq2, 3, 2);
        push(b3, x, PLINTH, z + dq2, x, z + dq2, 3, 2);
        quads++;
      }
    }
    report && report(0.52);
    yield;

    /* --- 贴图：albedo + AO(A) 全分辨率；日照半分辨率（线性过滤，柔和） --- */
    var alb = new Uint8Array(SX * SZ * 4);
    var SW = SX >> 1, SH = SZ >> 1;
    var sunTex = new Uint8Array(SW * SH);
    for (z = 0; z < SZ; z++) {
      for (x = 0; x < SX; x++) {
        i = z * SX + x;
        var h2 = H[i];
        if (h2 < 0) continue;
        var rec = MATLIST[Mt[i] || 1];
        var vr = M.hash3(x, z, 917) * 0.20 - 0.085 + (M.hash3(x >> 3, z >> 3, 41) - 0.5) * 0.14;
        var cr = rec.rgb[0] * (1 + vr), cg = rec.rgb[1] * (1 + vr), cb = rec.rgb[2] * (1 + vr);
        // 曲率 AO：3×3 邻域高差（直读数组，避免函数调用开销）
        var occ = 0;
        if (x > 0 && x < SX - 1 && z > 0 && z < SZ - 1) {
          var hA = H[i - 1], hB = H[i + 1], hC = H[i - SX], hD = H[i + SX];
          var hE = H[i - SX - 1], hF = H[i - SX + 1], hG = H[i + SX - 1], hI = H[i + SX + 1];
          if (hA > h2) occ += hA - h2 < 3 ? hA - h2 : 3;
          if (hB > h2) occ += hB - h2 < 3 ? hB - h2 : 3;
          if (hC > h2) occ += hC - h2 < 3 ? hC - h2 : 3;
          if (hD > h2) occ += hD - h2 < 3 ? hD - h2 : 3;
          if (hE > h2) occ += 1; if (hF > h2) occ += 1;
          if (hG > h2) occ += 1; if (hI > h2) occ += 1;
        }
        // 建筑贴地接触阴影
        var cm = w.colMax[i];
        if (cm > h2) occ += Math.min(12, (cm - h2) * 0.7);
        var ao = 1 - Math.min(0.62, occ * 0.042);
        alb[i * 4] = Math.min(255, cr) | 0;
        alb[i * 4 + 1] = Math.min(255, cg) | 0;
        alb[i * 4 + 2] = Math.min(255, cb) | 0;
        alb[i * 4 + 3] = (ao * 255) | 0;
      }
      if ((z & 63) === 0) { report && report(0.52 + z / SZ * 0.24); yield; }
    }
    for (z = 0; z < SH; z++) {
      for (x = 0; x < SW; x++) {
        var fx = x << 1, fz = z << 1;
        var hh2 = H[fz * SX + fx];
        if (hh2 < 0) { hh2 = H[Math.min(SZ - 1, fz + 1) * SX + Math.min(SX - 1, fx + 1)]; }
        if (hh2 < 0) { sunTex[z * SW + x] = 255; continue; }
        sunTex[z * SW + x] = (sun(fx + 1.0, hh2 + 1.05, fz + 1.0) * 255) | 0;
      }
      if ((z & 31) === 0) { report && report(0.76 + z / SH * 0.24); yield; }
    }

    var out = [];
    for (i = 0; i < SCX * SCZ; i++) {
      var bq = bufs[i];
      if (!bq || !bq.n) continue;
      var sxi = i % SCX, szi = (i - sxi) / SCX;
      out.push({ data: bq.trim(), quads: bq.n / 4, stride: STRIDE,
        x0: sxi * SEC, z0: szi * SEC, x1: (sxi + 1) * SEC, z1: (szi + 1) * SEC });
    }
    return { meshes: out, quads: quads, albedo: alb, sun: sunTex, sunW: SW, sunH: SH };
  };

  /* =====================================================================
     5. 水面网格
     ===================================================================== */
  VX.meshWater = function (w) {
    var Wl = w.W, H = w.H, STRIDE = 12;
    var b = new MeshBuf(STRIDE), quads = 0;
    function push(x, y, z, u, v, d) {
      var vo = b.n * 6, bo = b.n * STRIDE;
      b.u16[vo] = (x * 2) | 0; b.u16[vo + 1] = (y * 2) | 0; b.u16[vo + 2] = (z * 2) | 0;
      b.u16[vo + 3] = (u * 2) | 0; b.u16[vo + 4] = (v * 2) | 0;
      b.u8[bo + 10] = d; b.u8[bo + 11] = 0;
      b.n++;
    }
    var visited = new Uint8Array(SX * SZ), x, z, i, k;
    for (z = 0; z < SZ; z++) for (x = 0; x < SX; x++) {
      i = z * SX + x;
      if (visited[i] || !Wl[i]) continue;
      var lv = Wl[i], wq = 1;
      while (x + wq < SX && !visited[i + wq] && Wl[i + wq] === lv) wq++;
      var dq = 1;
      outer: while (z + dq < SZ) {
        var ri = (z + dq) * SX + x;
        for (k = 0; k < wq; k++) if (visited[ri + k] || Wl[ri + k] !== lv) break outer;
        dq++;
      }
      for (var zz = 0; zz < dq; zz++) { var rr = (z + zz) * SX + x; for (var xx = 0; xx < wq; xx++) visited[rr + xx] = 1; }
      b.ensure(4);
      var y = lv + 0.85;
      push(x, y, z + dq, x, z + dq, 2);
      push(x + wq, y, z + dq, x + wq, z + dq, 2);
      push(x + wq, y, z, x + wq, z, 2);
      push(x, y, z, x, z, 2);
      quads++;
    }
    // 边缘侧面（水位高于邻列地形时补壁，避免看穿）
    for (z = 0; z < SZ; z++) for (x = 0; x < SX; x++) {
      i = z * SX + x;
      var lv2 = Wl[i];
      if (!lv2) continue;
      var nb = [[1, 0, 0], [-1, 0, 1], [0, 1, 4], [0, -1, 5]];
      for (k = 0; k < 4; k++) {
        var nx = x + nb[k][0], nz = z + nb[k][1];
        var ok = nx >= 0 && nz >= 0 && nx < SX && nz < SZ;
        var ni = ok ? nz * SX + nx : -1;
        var nlv = ok ? Wl[ni] : 0;
        if (nlv >= lv2) continue;
        var floorY = ok && H[ni] >= 0 ? H[ni] + 1 : PLINTH;
        if (nlv) floorY = nlv + 1;
        if (floorY > lv2) continue;
        b.ensure(4);
        var yt = lv2 + 0.85, d = nb[k][2];
        if (d === 0) { push(x + 1, floorY, z + 1, x + .5, z + .5, 0); push(x + 1, floorY, z, x + .5, z + .5, 0); push(x + 1, yt, z, x + .5, z + .5, 0); push(x + 1, yt, z + 1, x + .5, z + .5, 0); }
        else if (d === 1) { push(x, floorY, z, x + .5, z + .5, 1); push(x, floorY, z + 1, x + .5, z + .5, 1); push(x, yt, z + 1, x + .5, z + .5, 1); push(x, yt, z, x + .5, z + .5, 1); }
        else if (d === 4) { push(x, floorY, z + 1, x + .5, z + .5, 4); push(x + 1, floorY, z + 1, x + .5, z + .5, 4); push(x + 1, yt, z + 1, x + .5, z + .5, 4); push(x, yt, z + 1, x + .5, z + .5, 4); }
        else { push(x + 1, floorY, z, x + .5, z + .5, 5); push(x, floorY, z, x + .5, z + .5, 5); push(x, yt, z, x + .5, z + .5, 5); push(x + 1, yt, z, x + .5, z + .5, 5); }
        quads++;
      }
    }
    if (!b.n) return null;
    return { data: b.trim(), quads: quads, stride: STRIDE };
  };
})(window);
