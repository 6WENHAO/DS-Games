/* =====================================================================
 * 紫禁城 体素模型 — 地面铺装 / 水面 场 (TileField)
 * ---------------------------------------------------------------------
 * 广场"海墁青砖"、御路石、水面这类大面积水平铺装如果用 1 m 体素，
 * 单是内城就有 72 万格。此处改用 4 m 见方的大石板（仍是方块，符合
 * 故宫广场以大条砖/大石板铺砌的实际做法），实例数降到 4 万级。
 * 与 VoxelWorld 同样保证唯一键、优先级仲裁、冲突记账。
 * ===================================================================== */
(function (G) {
  'use strict';

  function TileField(pitch) {
    this.pitch = pitch || 4;
    this.cells = new Map();               // key -> (mat<<12 | (top+2048))
    this.prio = G.GGPalette.LIST.map(function (s) { return s.prio; });
    this.stats = { writes: 0, placed: 0, sameRepeat: 0, conflictWin: 0, conflictKeep: 0 };
  }

  TileField.prototype.g2k = function (gx, gz) { return (gx + 4096) * 8192 + (gz + 4096); };

  TileField.prototype.setCell = function (gx, gz, mat, top) {
    var st = this.stats; st.writes++;
    var k = (gx + 4096) * 8192 + (gz + 4096);
    var cur = this.cells.get(k);
    var packed = mat * 4096 + (Math.round(top * 4) + 2048);
    if (cur === undefined) { this.cells.set(k, packed); st.placed++; return true; }
    var curMat = Math.floor(cur / 4096);
    if (curMat === mat) { st.sameRepeat++; return false; }
    if (this.prio[mat] >= this.prio[curMat]) { this.cells.set(k, packed); st.conflictWin++; }
    else st.conflictKeep++;
    return false;
  };

  /** 世界坐标矩形填充（含端点，单位米） */
  TileField.prototype.fill = function (x0, z0, x1, z1, mat, top, pick) {
    var p = this.pitch, t;
    if (x0 > x1) { t = x0; x0 = x1; x1 = t; }
    if (z0 > z1) { t = z0; z0 = z1; z1 = t; }
    var gx0 = Math.floor(x0 / p), gx1 = Math.floor(x1 / p);
    var gz0 = Math.floor(z0 / p), gz1 = Math.floor(z1 / p);
    for (var gx = gx0; gx <= gx1; gx++)
      for (var gz = gz0; gz <= gz1; gz++) {
        var m = pick ? pick(gx * p, gz * p, gx, gz) : mat;
        if (m === null || m === undefined) continue;
        this.setCell(gx, gz, m, top);
      }
    return this;
  };

  /** 沿一条中心线铺带状（河道用），f(z)->x 中心 */
  TileField.prototype.fillCurve = function (z0, z1, halfW, fx, mat, top) {
    var p = this.pitch;
    for (var z = z0; z <= z1; z += p) {
      var cx = fx(z);
      this.fill(cx - halfW, z, cx + halfW, z + p - 1, mat, top);
    }
    return this;
  };

  TileField.prototype.erase = function (x0, z0, x1, z1) {
    var p = this.pitch, t;
    if (x0 > x1) { t = x0; x0 = x1; x1 = t; }
    if (z0 > z1) { t = z0; z0 = z1; z1 = t; }
    for (var gx = Math.floor(x0 / p); gx <= Math.floor(x1 / p); gx++)
      for (var gz = Math.floor(z0 / p); gz <= Math.floor(z1 / p); gz++)
        this.cells.delete((gx + 4096) * 8192 + (gz + 4096));
    return this;
  };

  TileField.prototype.compile = function () {
    var n = this.cells.size, p = this.pitch;
    var xs = new Float32Array(n), zs = new Float32Array(n), ys = new Float32Array(n);
    var ids = new Uint8Array(n), i = 0;
    var it = this.cells.entries(), e;
    while (!(e = it.next()).done) {
      var k = e.value[0], val = e.value[1];
      var gz = (k % 8192) - 4096;
      var gx = ((k - (gz + 4096)) / 8192) - 4096;
      ids[i] = Math.floor(val / 4096);
      ys[i] = ((val % 4096) - 2048) / 4;
      xs[i] = gx * p + p / 2;
      zs[i] = gz * p + p / 2;
      i++;
    }
    return { count: n, xs: xs, ys: ys, zs: zs, ids: ids, pitch: p };
  };

  TileField.prototype.audit = function () {
    var st = this.stats;
    return {
      铺装写入: st.writes, 铺装块: st.placed, 同材重写: st.sameRepeat,
      材质冲突: st.conflictWin + st.conflictKeep, 重叠: 0
    };
  };

  G.TileField = TileField;
})(typeof window !== 'undefined' ? window : globalThis);
