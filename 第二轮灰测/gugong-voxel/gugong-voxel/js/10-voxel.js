/* =====================================================================
 * 紫禁城 体素模型 — 体素内核 VoxelWorld
 * ---------------------------------------------------------------------
 * 纯数据模块（不依赖 THREE），保证：
 *  1. 唯一键：一个整数坐标最多一个方块，物理上不可能重叠。
 *  2. 优先级仲裁：不同材质写同一格时按 prio 判定，冲突全部记账。
 *  3. 越界/非整数/超高 写入被拒绝并计数，不会静默产生坏方块。
 *  4. 遮挡剔除：六面被包围的方块不进入渲染（省 40%~60% 实例）。
 *  5. 环境光遮蔽：按 26 邻域烘焙 AO，缝隙自然变暗。
 *  6. 空间分桶：按 (材质, 区块) 生成 InstancedMesh，视锥剔除有效。
 *
 * 坐标：+X 东，+Z 北，+Y 上。单位 1 体素 = 1 米。
 * 键编码：xi=x+1024 (0..2047), zi=z+1024 (0..2047), y=0..511
 *         key = xi*2^20 + zi*2^9 + y  ∈ [0, 2^31-1] 恰好铺满 int32。
 * ===================================================================== */
(function (G) {
  'use strict';

  var OFF = 1024, XSPAN = 2048, YSPAN = 512;
  var KX = 1048576 /* 2^20 */, KZ = 512 /* 2^9 */;

  function VoxelWorld(opts) {
    opts = opts || {};
    this.cells = new Map();          // key -> blockId
    this.prio = G.GGPalette.LIST.map(function (s) { return s.prio; });
    this.limits = {
      xmin: opts.xmin !== undefined ? opts.xmin : -1023,
      xmax: opts.xmax !== undefined ? opts.xmax : 1023,
      zmin: opts.zmin !== undefined ? opts.zmin : -1023,
      zmax: opts.zmax !== undefined ? opts.zmax : 1023,
      ymin: 0,
      ymax: 511
    };
    this.stats = {
      writes: 0,        // set() 调用次数
      placed: 0,        // 实际新建方块数
      sameRepeat: 0,    // 同材质重复写（幂等，无害）
      conflictWin: 0,   // 不同材质冲突，新块优先级更高 -> 替换
      conflictKeep: 0,  // 不同材质冲突，原块优先级更高/相等 -> 保留
      rejectBounds: 0,  // 越界
      rejectInt: 0,     // 非整数坐标
      erased: 0         // 主动挖除（券门、门洞等）
    };
    this.conflictSamples = [];
    this._tag = '未命名';
    this.tagCount = {};              // 各建筑标签的方块计数
    this.tagInfo = {};               // 各建筑标签的重心与最高点（供"点击飞抵"）
    this.tagConflict = {};           // 各建筑标签引发的材质冲突数（用于发现穿模）
  }

  VoxelWorld.prototype.tag = function (name) {
    this._tag = name;
    if (this.tagCount[name] === undefined) this.tagCount[name] = 0;
    if (this.tagConflict[name] === undefined) this.tagConflict[name] = 0;
    if (this.tagInfo[name] === undefined)
      this.tagInfo[name] = { n: 0, sx: 0, sy: 0, sz: 0, ymax: 0 };
    return this;
  };

  VoxelWorld.prototype.key = function (x, y, z) {
    return (x + OFF) * KX + (z + OFF) * KZ + y;
  };

  VoxelWorld.prototype.decode = function (key) {
    var y = key % KZ;
    var t = (key - y) / KZ;
    var zi = t % XSPAN;
    var xi = (t - zi) / XSPAN;
    return { x: xi - OFF, y: y, z: zi - OFF };
  };

  /* ---------------- 核心写入 ---------------- */
  VoxelWorld.prototype.set = function (x, y, z, id) {
    var st = this.stats;
    st.writes++;

    // 整数校验（防止 0.5 之类的坏坐标产生视觉错位）
    if (!(x === (x | 0) && y === (y | 0) && z === (z | 0))) {
      x = Math.round(x); y = Math.round(y); z = Math.round(z);
      st.rejectInt++;
    }
    var L = this.limits;
    if (x < L.xmin || x > L.xmax || z < L.zmin || z > L.zmax || y < L.ymin || y > L.ymax) {
      st.rejectBounds++;
      return false;
    }

    var k = (x + OFF) * KX + (z + OFF) * KZ + y;
    var cur = this.cells.get(k);
    if (cur === undefined) {
      this.cells.set(k, id);
      st.placed++;
      this.tagCount[this._tag] = (this.tagCount[this._tag] || 0) + 1;
      var ti = this.tagInfo[this._tag];
      if (!ti) ti = this.tagInfo[this._tag] = { n: 0, sx: 0, sy: 0, sz: 0, ymax: 0 };
      ti.n++; ti.sx += x; ti.sy += y; ti.sz += z;
      if (y > ti.ymax) ti.ymax = y;
      return true;
    }
    if (cur === id) { st.sameRepeat++; return false; }

    // 不同材质抢占同一格 -> 优先级仲裁
    this.tagConflict[this._tag] = (this.tagConflict[this._tag] || 0) + 1;
    if (this.prio[id] > this.prio[cur]) {
      this.cells.set(k, id);
      st.conflictWin++;
      if (this.conflictSamples.length < 24) {
        this.conflictSamples.push({ x: x, y: y, z: z, from: cur, to: id, tag: this._tag, act: '替换' });
      }
    } else {
      st.conflictKeep++;
      if (this.conflictSamples.length < 24) {
        this.conflictSamples.push({ x: x, y: y, z: z, from: cur, to: id, tag: this._tag, act: '保留' });
      }
    }
    return false;
  };

  VoxelWorld.prototype.get = function (x, y, z) {
    return this.cells.get((x + OFF) * KX + (z + OFF) * KZ + y);
  };
  VoxelWorld.prototype.has = function (x, y, z) {
    if (x < -OFF || x >= OFF || z < -OFF || z >= OFF || y < 0 || y >= YSPAN) return false;
    return this.cells.has((x + OFF) * KX + (z + OFF) * KZ + y);
  };
  VoxelWorld.prototype.erase = function (x, y, z) {
    var k = (x + OFF) * KX + (z + OFF) * KZ + y;
    if (this.cells.delete(k)) { this.stats.erased++; return true; }
    return false;
  };

  /* ---------------- 区域写入原语 ---------------- */

  // 实心长方体（坐标含端点）
  VoxelWorld.prototype.solid = function (x0, y0, z0, x1, y1, z1, id) {
    var a, b, t;
    if (x0 > x1) { t = x0; x0 = x1; x1 = t; }
    if (y0 > y1) { t = y0; y0 = y1; y1 = t; }
    if (z0 > z1) { t = z0; z0 = z1; z1 = t; }
    for (var x = x0; x <= x1; x++)
      for (var z = z0; z <= z1; z++)
        for (var y = y0; y <= y1; y++) this.set(x, y, z, id);
    return this;
  };

  // 空心长方体（只写外壳，省实例）；opts.skipTop / skipBottom / t 壳厚
  VoxelWorld.prototype.shell = function (x0, y0, z0, x1, y1, z1, id, opts) {
    opts = opts || {};
    var t = opts.t || 1, tt;
    var x, y, z;
    if (x0 > x1) { tt = x0; x0 = x1; x1 = tt; }
    if (y0 > y1) { tt = y0; y0 = y1; y1 = tt; }
    if (z0 > z1) { tt = z0; z0 = z1; z1 = tt; }
    for (x = x0; x <= x1; x++) {
      for (z = z0; z <= z1; z++) {
        var edge = (x - x0 < t) || (x1 - x < t) || (z - z0 < t) || (z1 - z < t);
        for (y = y0; y <= y1; y++) {
          var cap = (y - y0 < t && !opts.skipBottom) || (y1 - y < t && !opts.skipTop);
          if (edge || cap) this.set(x, y, z, id);
        }
      }
    }
    return this;
  };

  // 水平板（一层）
  VoxelWorld.prototype.plate = function (x0, z0, x1, z1, y, id) {
    var t;
    if (x0 > x1) { t = x0; x0 = x1; x1 = t; }
    if (z0 > z1) { t = z0; z0 = z1; z1 = t; }
    for (var x = x0; x <= x1; x++)
      for (var z = z0; z <= z1; z++) this.set(x, y, z, id);
    return this;
  };

  // 水平"环"：矩形外框向内 band 圈（屋面台阶层用，避免填满内部）
  VoxelWorld.prototype.ring = function (x0, z0, x1, z1, y, band, id) {
    var t;
    if (x0 > x1) { t = x0; x0 = x1; x1 = t; }
    if (z0 > z1) { t = z0; z0 = z1; z1 = t; }
    if (band < 1) band = 1;
    var w = x1 - x0 + 1, d = z1 - z0 + 1;
    if (w <= 2 * band || d <= 2 * band) return this.plate(x0, z0, x1, z1, y, id);
    for (var x = x0; x <= x1; x++) {
      var xEdge = (x - x0 < band) || (x1 - x < band);
      for (var z = z0; z <= z1; z++) {
        if (xEdge || (z - z0 < band) || (z1 - z < band)) this.set(x, y, z, id);
      }
    }
    return this;
  };

  // 竖直矩形墙环（平面为矩形的一圈墙），thick 墙厚，向内加厚
  VoxelWorld.prototype.wallRing = function (x0, z0, x1, z1, y0, y1, thick, id) {
    var t;
    if (x0 > x1) { t = x0; x0 = x1; x1 = t; }
    if (z0 > z1) { t = z0; z0 = z1; z1 = t; }
    if (thick < 1) thick = 1;
    for (var y = y0; y <= y1; y++) this.ring(x0, z0, x1, z1, y, thick, id);
    return this;
  };

  // 竖直柱
  VoxelWorld.prototype.column = function (x, z, y0, y1, id) {
    for (var y = y0; y <= y1; y++) this.set(x, y, z, id);
    return this;
  };

  // 沿 X 的一段墙（含厚度）
  VoxelWorld.prototype.wallX = function (x0, x1, z, y0, y1, thick, id) {
    var t; if (x0 > x1) { t = x0; x0 = x1; x1 = t; }
    for (var x = x0; x <= x1; x++)
      for (var dz = 0; dz < thick; dz++)
        for (var y = y0; y <= y1; y++) this.set(x, y, z + dz, id);
    return this;
  };
  // 沿 Z 的一段墙
  VoxelWorld.prototype.wallZ = function (z0, z1, x, y0, y1, thick, id) {
    var t; if (z0 > z1) { t = z0; z0 = z1; z1 = t; }
    for (var z = z0; z <= z1; z++)
      for (var dx = 0; dx < thick; dx++)
        for (var y = y0; y <= y1; y++) this.set(x + dx, y, z, id);
    return this;
  };

  // 挖除长方体（券门、门洞、街巷开口）
  VoxelWorld.prototype.carve = function (x0, y0, z0, x1, y1, z1) {
    var t;
    if (x0 > x1) { t = x0; x0 = x1; x1 = t; }
    if (y0 > y1) { t = y0; y0 = y1; y1 = t; }
    if (z0 > z1) { t = z0; z0 = z1; z1 = t; }
    for (var x = x0; x <= x1; x++)
      for (var z = z0; z <= z1; z++)
        for (var y = y0; y <= y1; y++) this.erase(x, y, z);
    return this;
  };

  /* ---------------- 清理孤立方块（六面无邻居的浮空块） ---------------- */
  /** 反复扫描直到稳定；返回清理数量。保证成品中不存在悬空孤立方块。 */
  VoxelWorld.prototype.removeIsolated = function () {
    var total = 0, pass = 0, cells = this.cells;
    for (pass = 0; pass < 4; pass++) {
      var doomed = [];
      var it = cells.keys(), e;
      while (!(e = it.next()).done) {
        var k = e.value;
        var y = k % KZ;
        if (cells.has(k + KX) || cells.has(k - KX)) continue;
        if (cells.has(k + KZ) || cells.has(k - KZ)) continue;
        if (y < 511 && cells.has(k + 1)) continue;
        if (y > 0 && cells.has(k - 1)) continue;
        doomed.push(k);
      }
      if (!doomed.length) break;
      for (var i = 0; i < doomed.length; i++) cells.delete(doomed[i]);
      total += doomed.length;
    }
    this.stats.isolatedRemoved = (this.stats.isolatedRemoved || 0) + total;
    return total;
  };

  /* ---------------- 后处理：遮挡剔除 + AO ---------------- */

  /**
   * 生成可见方块列表。
   * 返回 { ids:Int8/Int32Array, xs, ys, zs, ao, visible, hidden }
   */
  VoxelWorld.prototype.compile = function (report) {
    var cells = this.cells;
    var n = cells.size;
    var xs = new Int16Array(n), ys = new Int16Array(n), zs = new Int16Array(n);
    var ids = new Uint8Array(n), ao = new Uint8Array(n);
    var vis = 0, hidden = 0, isolated = 0, unsupported = 0;

    // 26 邻域偏移（用于 AO）
    var it = cells.entries(), e;
    while (!(e = it.next()).done) {
      var k = e.value[0], id = e.value[1];
      var y = k % KZ;
      var tmp = (k - y) / KZ;
      var zi = tmp % XSPAN;
      var xi = (tmp - zi) / XSPAN;
      var x = xi - OFF, z = zi - OFF;

      // 六面遮挡剔除
      var n0 = cells.has(k + KX), n1 = cells.has(k - KX);
      var n2 = cells.has(k + KZ), n3 = cells.has(k - KZ);
      var n4 = (y < 511) && cells.has(k + 1), n5 = (y > 0) && cells.has(k - 1);
      var open = 0;
      if (!n0) open++; if (!n1) open++; if (!n2) open++; if (!n3) open++;
      if (!n4) open++; if (!n5) open++;
      if (open === 0) { hidden++; continue; }
      if (open === 6) isolated++;
      if (!n5 && y > 0) unsupported++;

      // AO：统计 26 邻域被占据数量，越多越暗
      var occ = 0;
      for (var dx = -1; dx <= 1; dx++) {
        var bx = k + dx * KX;
        for (var dz = -1; dz <= 1; dz++) {
          var bz = bx + dz * KZ;
          for (var dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0 && dz === 0) continue;
            var yy = y + dy;
            if (yy < 0 || yy > 511) continue;
            if (cells.has(bz + dy)) occ++;
          }
        }
      }

      xs[vis] = x; ys[vis] = y; zs[vis] = z; ids[vis] = id;
      ao[vis] = occ; // 0..26
      vis++;
    }

    var out = {
      count: vis, xs: xs, ys: ys, zs: zs, ids: ids, ao: ao,
      hidden: hidden, isolated: isolated, unsupported: unsupported, total: n
    };
    if (report) {
      out.report = this.audit(out);
    }
    return out;
  };

  /* ---------------- 校验报告 ---------------- */
  VoxelWorld.prototype.audit = function (compiled) {
    var st = this.stats;
    var errors = [], warns = [];
    if (st.rejectBounds > 0) errors.push('越界写入 ' + st.rejectBounds + ' 次（已拒绝）');
    if (st.rejectInt > 0) errors.push('非整数坐标 ' + st.rejectInt + ' 次（已取整）');
    if (compiled && compiled.isolated > 0) warns.push('孤立方块 ' + compiled.isolated + ' 个（六面无邻居）');
    var conflicts = st.conflictWin + st.conflictKeep;
    return {
      总写入: st.writes,
      实际方块: st.placed,
      可见方块: compiled ? compiled.count : -1,
      内部剔除: compiled ? compiled.hidden : -1,
      同材质重写: st.sameRepeat,
      材质冲突: conflicts,
      冲突已替换: st.conflictWin,
      冲突已保留: st.conflictKeep,
      挖除: st.erased,
      清理孤立块: st.isolatedRemoved || 0,
      越界拒绝: st.rejectBounds,
      非整数: st.rejectInt,
      重叠方块: 0,           // 唯一键结构保证恒为 0
      errors: errors,
      warns: warns,
      ok: errors.length === 0
    };
  };

  /* ---------------- 空间分桶（供渲染层用） ---------------- */
  /**
   * 按 (材质id, 区块) 分组。bucket 默认 72 米。
   * 返回 [{ id, bx, bz, idx:Int32Array }]
   */
  VoxelWorld.groupBuckets = function (compiled, bucket) {
    bucket = bucket || 72;
    var groups = new Map();
    var n = compiled.count, xs = compiled.xs, zs = compiled.zs, ids = compiled.ids;
    for (var i = 0; i < n; i++) {
      var bx = Math.floor(xs[i] / bucket), bz = Math.floor(zs[i] / bucket);
      var gk = ids[i] * 1000000 + (bx + 500) * 1000 + (bz + 500);
      var arr = groups.get(gk);
      if (!arr) { arr = []; groups.set(gk, arr); }
      arr.push(i);
    }
    var out = [];
    groups.forEach(function (arr, gk) {
      var id = Math.floor(gk / 1000000);
      var rest = gk % 1000000;
      out.push({ id: id, bx: Math.floor(rest / 1000) - 500, bz: (rest % 1000) - 500, idx: arr });
    });
    return out;
  };

  G.VoxelWorld = VoxelWorld;
})(typeof window !== 'undefined' ? window : globalThis);
