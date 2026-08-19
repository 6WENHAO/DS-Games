/* =====================================================================
   微体素地图 · 体素世界容器 + 建造 API
   - 稀疏分块存储（32³ Uint8 材质 id）
   - 地形以列高图 + 表面材质图 + 水位图独立存放（便于贪心网格化与光照贴图）
   - 发光材质自动聚合为光源，参与体积光照烘焙
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, MATLIST = VX.MATLIST;

  /* --------------------------- 世界尺寸 --------------------------- */
  var SX = 1280, SY = 224, SZ = 1280, CS = 32;
  var CX = Math.ceil(SX / CS), CY = Math.ceil(SY / CS), CZ = Math.ceil(SZ / CS);
  var VOL = 5;                                  // 光照体素格边长
  var VW = Math.ceil(SX / VOL), VH = Math.ceil(SY / VOL), VD = Math.ceil(SZ / VOL);

  VX.SX = SX; VX.SY = SY; VX.SZ = SZ; VX.CS = CS;
  VX.CX = CX; VX.CY = CY; VX.CZ = CZ;
  VX.VOL = VOL; VX.VW = VW; VX.VH = VH; VX.VD = VD;
  VX.CENTER = [SX / 2, SZ / 2];
  VX.GROUND = 26;                               // 标准地面高度

  /* --------------------------- 位图字体 --------------------------- */
  var FONTHEX = {
    '0': '0E11131519110E', '1': '040C040404040E', '2': '0E11010204081F',
    '3': '1F02040201110E', '4': '02060A121F0202', '5': '1F101E0101110E',
    '6': '0608101E11110E', '7': '1F010204080808', '8': '0E11110E11110E',
    '9': '0E11110F01020C',
    'A': '0E11111F111111', 'B': '1E11111E11111E', 'C': '0E11101010110E',
    'D': '1E11111111111E', 'E': '1F10101E10101F', 'F': '1F10101E101010',
    'G': '0E11101711110F', 'H': '1111111F111111', 'I': '0E04040404040E',
    'J': '0702020202120C', 'K': '11121418141211', 'L': '1010101010101F',
    'M': '111B1515111111', 'N': '11191513111111', 'O': '0E1111111111 0E',
    'P': '1E11111E101010', 'Q': '0E11111115120D', 'R': '1E11111E141211',
    'S': '0F10100E01011E', 'T': '1F04040404 0404', 'U': '1111111111110E',
    'V': '1111111111 0A04', 'W': '11111115151B11', 'X': '11110A040A1111',
    'Y': '11110A04040404', 'Z': '1F0102040810 1F',
    '-': '0000000E000000', '.': '00000000000C0C', ':': '000C0C000C0C00',
    '/': '01020204080810', '#': '0A0A1F0A1F0A0A', '+': '00040 41F040400',
    '!': '040404040400 04', '*': '000A041F040A00', '>': '080402010204 08',
    '<': '02040810080402', ' ': '00000000000000', '=': '00001F001F0000',
    '(': '020408080804 02', ')': '08040202020408'
  };
  var FONT = {};
  (function () {
    for (var k in FONTHEX) {
      var h = FONTHEX[k].replace(/\s/g, ''), rows = [];
      if (h.length !== 14) throw new Error('字模长度错误 "' + k + '": ' + h.length);
      for (var i = 0; i < 7; i++) rows.push(parseInt(h.substr(i * 2, 2), 16) || 0);
      FONT[k] = rows;
    }
  })();
  VX.FONT = FONT;

  /* --------------------------- 世界对象 --------------------------- */
  function World() {
    this.chunks = new Map();                    // key -> Uint8Array(CS^3)
    this.H = new Int16Array(SX * SZ);           // 地形列顶高（-1 = 虚空）
    this.Mt = new Uint8Array(SX * SZ);          // 地形表面材质
    this.Mu = new Uint8Array(SX * SZ);          // 地形侧壁材质（缺省同表面）
    this.W = new Int16Array(SX * SZ);           // 水面高度（0 = 无水）
    this.Wm = new Uint8Array(SX * SZ);          // 水体材质
    this.colMax = new Int16Array(SX * SZ);      // 体素列最高点（阴影加速）
    this.tileMax = null;                        // 粗粒度最高点（8×8）
    this.H.fill(-1);
    this.lightAcc = new Map();                  // 光源聚合
    this.lights = [];
    this.labels = [];
    this.views = [];
    this.roads = [];                            // 记录道路中心线（用于体检输出）
    this.stats = { voxels: 0, emissive: 0 };
    this.rand = M.rng(0x5EED13);
  }

  var Wp = World.prototype;

  Wp.inb = function (x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < SX && y < SY && z < SZ;
  };

  Wp.chunk = function (cx, cy, cz, make) {
    var key = (cy * CZ + cz) * CX + cx;
    if (key === this._ck) return this._cc;
    var c = this.chunks.get(key);
    if (!c && make) { c = new Uint8Array(CS * CS * CS); this.chunks.set(key, c); }
    if (c) { this._ck = key; this._cc = c; }
    return c;
  };

  Wp.set = function (x, y, z, m) {
    x = x | 0; y = y | 0; z = z | 0;
    if (x < 0 || y < 0 || z < 0 || x >= SX || y >= SY || z >= SZ) return;
    var c = this.chunk(x >> 5, y >> 5, z >> 5, true);
    var idx = ((y & 31) << 10) | ((z & 31) << 5) | (x & 31);
    var prev = c[idx];
    if (prev === m) return;
    c[idx] = m;
    if (prev === 0 && m !== 0) this.stats.voxels++;
    else if (prev !== 0 && m === 0) this.stats.voxels--;
    var ci = z * SX + x;
    if (m !== 0 && y > this.colMax[ci]) this.colMax[ci] = y;
    var rec = MATLIST[m];
    if (rec && rec.emis > 0) this._light(x, y, z, rec);
  };

  Wp.get = function (x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= SX || y >= SY || z >= SZ) return 0;
    var key = ((y >> 5) * CZ + (z >> 5)) * CX + (x >> 5);
    var c = key === this._gk ? this._gc : this.chunks.get(key);
    if (!c) return 0;
    this._gk = key; this._gc = c;
    return c[((y & 31) << 10) | ((z & 31) << 5) | (x & 31)];
  };

  /** 只在空气处写入 */
  Wp.setIf = function (x, y, z, m) { if (!this.get(x, y, z)) this.set(x, y, z, m); };

  /** 综合固体判定（体素 or 地形柱体） */
  Wp.solid = function (x, y, z) {
    if (x < 0 || z < 0 || x >= SX || z >= SZ || y < 0) return false;
    if (y >= SY) return false;
    var h = this.H[z * SX + x];
    if (h >= 0 && y <= h) return true;
    return this.get(x, y, z) !== 0;
  };

  Wp._light = function (x, y, z, rec) {
    this.stats.emissive++;
    // 8 体素栅格聚合：把成片霓虹归并成可控数量的光源
    var key = ((y >> 3) * 256 + (z >> 3)) * 256 + (x >> 3);
    var e = this.lightAcc.get(key);
    if (e) {
      e.w += rec.emis;
      e.r += rec.lit[0] * rec.emis; e.g += rec.lit[1] * rec.emis; e.b += rec.lit[2] * rec.emis;
      if (rec.rad > e.rad) e.rad = rec.rad;
    } else {
      this.lightAcc.set(key, {
        x: (x & ~7) + 4, y: (y & ~7) + 4, z: (z & ~7) + 4,
        w: rec.emis, rad: rec.rad || 10,
        r: rec.lit[0] * rec.emis, g: rec.lit[1] * rec.emis, b: rec.lit[2] * rec.emis
      });
    }
  };

  Wp.addLight = function (x, y, z, rgb, rad, inten) {
    inten = inten == null ? 1 : inten;
    this.lights.push({ x: x, y: y, z: z, rad: rad || 12,
      r: rgb[0] * inten, g: rgb[1] * inten, b: rgb[2] * inten, w: inten });
  };

  Wp.finalizeLights = function () {
    var it = this.lightAcc.values(), n;
    while (!(n = it.next()).done) {
      var e = n.value;
      var w = Math.min(e.w, 4);
      var inv = 1 / Math.max(1e-4, e.w);
      this.lights.push({ x: e.x, y: e.y, z: e.z, rad: e.rad,
        r: e.r * inv, g: e.g * inv, b: e.b * inv, w: Math.pow(w, 0.50) });
    }
    this.lightAcc.clear();
    return this.lights.length;
  };

  Wp.addLabel = function (text, x, y, z, kind, sub) {
    this.labels.push({ text: text, x: x, y: y, z: z, kind: kind || 'poi', sub: sub || '' });
  };

  Wp.addView = function (id, name, target, dist, yaw, pitch) {
    this.views.push({ id: id, name: name, target: target, dist: dist,
      yaw: yaw, pitch: pitch == null ? -0.5 : pitch });
  };

  /* =====================================================================
     基础体块
     ===================================================================== */

  Wp.fill = function (x0, y0, z0, x1, y1, z1, m) {
    var t;
    if (x0 > x1) { t = x0; x0 = x1; x1 = t; }
    if (y0 > y1) { t = y0; y0 = y1; y1 = t; }
    if (z0 > z1) { t = z0; z0 = z1; z1 = t; }
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); z0 = Math.max(0, z0 | 0);
    x1 = Math.min(SX - 1, x1 | 0); y1 = Math.min(SY - 1, y1 | 0); z1 = Math.min(SZ - 1, z1 | 0);
    if (x0 > x1 || y0 > y1 || z0 > z1) return;
    var rec = MATLIST[m], emissive = m !== 0 && rec && rec.emis > 0;
    var colMax = this.colMax, H = this.H;
    for (var y = y0; y <= y1; y++) {
      var cy = y >> 5, yl = (y & 31) << 10;
      for (var z = z0; z <= z1; z++) {
        var cz = z >> 5, zl = (z & 31) << 5, rowC = z * SX;
        var x = x0;
        while (x <= x1) {
          var cxi = x >> 5;
          var xe = Math.min(x1, (cxi << 5) + 31);
          var c = this.chunk(cxi, cy, cz, true);
          for (var xx = x; xx <= xe; xx++) {
            var idx = yl | zl | (xx & 31);
            var prev = c[idx];
            if (prev !== m) {
              c[idx] = m;
              if (prev === 0 && m !== 0) this.stats.voxels++;
              else if (prev !== 0 && m === 0) this.stats.voxels--;
            }
            if (m !== 0 && y > colMax[rowC + xx]) colMax[rowC + xx] = y;
            if (emissive) this._light(xx, y, z, rec);
          }
          x = xe + 1;
        }
      }
    }
  };
  Wp.box = Wp.fill;

  /** 只填空气（保护已有结构） */
  Wp.fillAir = function (x0, y0, z0, x1, y1, z1, m) {
    for (var y = y0; y <= y1; y++)
      for (var z = z0; z <= z1; z++)
        for (var x = x0; x <= x1; x++) if (!this.get(x, y, z)) this.set(x, y, z, m);
  };

  /** 空心盒：外壳材质 wall，内部清空（含地板/屋顶可选材质） */
  Wp.shell = function (x0, y0, z0, x1, y1, z1, wall, floorM, roofM) {
    this.fill(x0, y0, z0, x1, y1, z1, wall);
    if (x1 - x0 >= 2 && y1 - y0 >= 2 && z1 - z0 >= 2)
      this.fill(x0 + 1, y0 + 1, z0 + 1, x1 - 1, y1 - 1, z1 - 1, 0);
    if (floorM != null) this.fill(x0 + 1, y0, z0 + 1, x1 - 1, y0, z1 - 1, floorM);
    if (roofM != null) this.fill(x0, y1, z0, x1, y1, z1, roofM);
  };

  /** 四面墙（无顶无底） */
  Wp.walls = function (x0, y0, z0, x1, y1, z1, m) {
    this.fill(x0, y0, z0, x1, y1, z0, m);
    this.fill(x0, y0, z1, x1, y1, z1, m);
    this.fill(x0, y0, z0, x0, y1, z1, m);
    this.fill(x1, y0, z0, x1, y1, z1, m);
  };

  /** 12 条棱（金属骨架） */
  Wp.frame = function (x0, y0, z0, x1, y1, z1, m) {
    var ys = [y0, y1], zs = [z0, z1], xs = [x0, x1], i, j;
    for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
      this.fill(x0, ys[i], zs[j], x1, ys[i], zs[j], m);
      this.fill(xs[j], ys[i], z0, xs[j], ys[i], z1, m);
      this.fill(xs[i], y0, zs[j], xs[i], y1, zs[j], m);
    }
  };

  /** 四角柱 */
  Wp.corners = function (x0, y0, z0, x1, y1, z1, m, w) {
    w = (w || 1) - 1;
    this.fill(x0, y0, z0, x0 + w, y1, z0 + w, m);
    this.fill(x1 - w, y0, z0, x1, y1, z0 + w, m);
    this.fill(x0, y0, z1 - w, x0 + w, y1, z1, m);
    this.fill(x1 - w, y0, z1 - w, x1, y1, z1, m);
  };

  Wp.plate = function (x0, z0, x1, z1, y, m) { this.fill(x0, y, z0, x1, y, z1, m); };

  Wp.pillar = function (x, z, y0, y1, m) { this.fill(x, y0, z, x, y1, z, m); };

  Wp.cyl = function (cx, cz, r, y0, y1, m, opt) {
    opt = opt || {};
    var thick = opt.thick || 0;
    var r2 = r * r, ri2 = thick ? (r - thick) * (r - thick) : -1;
    var x, z, d;
    for (z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
        if (d <= r2 && d >= ri2) this.fill(x, y0, z, x, y1, z, m);
      }
  };

  Wp.disc = function (cx, cz, r, y, m, inner) {
    var r2 = r * r, ri2 = inner ? inner * inner : -1, x, z, d;
    for (z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
        if (d <= r2 && d >= ri2) this.set(x, y, z, m);
      }
  };

  Wp.ring = function (cx, cz, r0, r1, y0, y1, m) {
    var a2 = r1 * r1, b2 = r0 * r0, x, z, d;
    for (z = Math.floor(cz - r1); z <= Math.ceil(cz + r1); z++)
      for (x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++) {
        d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
        if (d <= a2 && d >= b2) this.fill(x, y0, z, x, y1, z, m);
      }
  };

  Wp.sphere = function (cx, cy, cz, r, m, opt) {
    opt = opt || {};
    var ys = opt.yScale || 1, thick = opt.thick || 0;
    var r2 = r * r, ri = r - thick, ri2 = thick ? ri * ri : -1;
    var y0 = opt.half ? cy : Math.floor(cy - r * ys);
    for (var y = y0; y <= Math.ceil(cy + r * ys); y++)
      for (var z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          var dy = (y - cy) / ys;
          var d = (x - cx) * (x - cx) + dy * dy + (z - cz) * (z - cz);
          if (d <= r2 && d >= ri2) this.set(x, y, z, m);
        }
  };

  /** 半球穹顶：skin 蒙皮，rib 骨架环（every 度），glass 玻璃填充 */
  Wp.dome = function (cx, cz, baseY, r, skin, opt) {
    opt = opt || {};
    var ys = opt.yScale || 1, ribM = opt.rib, ribEvery = opt.ribEvery || 0;
    var glass = opt.glass, thick = opt.thick || 1;
    var r2 = r * r, ri = r - thick, ri2 = ri * ri;
    for (var y = baseY; y <= Math.ceil(baseY + r * ys); y++) {
      var dy = (y - baseY) / ys;
      var rad2 = r2 - dy * dy;
      if (rad2 < 0) continue;
      var rad = Math.sqrt(rad2);
      var radi2 = ri2 - dy * dy;
      var radi = radi2 > 0 ? Math.sqrt(radi2) : -1;
      for (var z = Math.floor(cz - rad) - 1; z <= Math.ceil(cz + rad) + 1; z++)
        for (var x = Math.floor(cx - rad) - 1; x <= Math.ceil(cx + rad) + 1; x++) {
          var d = Math.sqrt((x - cx) * (x - cx) + (z - cz) * (z - cz));
          if (d > rad || (radi > 0 && d < radi)) continue;
          var mm = skin;
          if (glass != null) {
            var ang = Math.atan2(z - cz, x - cx) * 180 / Math.PI;
            var isRib = ribEvery && (Math.abs(((ang + 720) % ribEvery) - ribEvery / 2) > ribEvery / 2 - 1.1);
            var isBand = (y - baseY) % 14 === 0;
            mm = (isRib || isBand) && ribM != null ? ribM : glass;
          }
          this.set(x, y, z, mm);
        }
    }
  };

  Wp.cone = function (cx, cz, y0, y1, r0, r1, m, hollow) {
    var n = y1 - y0;
    for (var y = y0; y <= y1; y++) {
      var t = n ? (y - y0) / n : 0;
      var r = r0 + (r1 - r0) * t;
      this.disc(cx, cz, r, y, m, hollow ? Math.max(0, r - 1.4) : 0);
    }
  };

  /** 三维直线（可带半径） */
  Wp.line3 = function (x0, y0, z0, x1, y1, z1, m, rad) {
    var dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    var n = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) || 1;
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = Math.round(x0 + dx * t), y = Math.round(y0 + dy * t), z = Math.round(z0 + dz * t);
      if (!rad) this.set(x, y, z, m);
      else this.sphere(x, y, z, rad, m);
    }
  };

  /** 水平粗线（道路/带状铺装，写入体素而非地形） */
  Wp.beam = function (x0, z0, x1, z1, y0, y1, w, m) {
    var dx = x1 - x0, dz = z1 - z0;
    var n = Math.max(Math.abs(dx), Math.abs(dz)) || 1;
    var h = Math.floor(w / 2);
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = Math.round(x0 + dx * t), z = Math.round(z0 + dz * t);
      this.fill(x - h, y0, z - h, x - h + w - 1, y1, z - h + w - 1, m);
    }
  };

  /** 楼梯/坡道 */
  Wp.ramp = function (x0, z0, x1, z1, y0, y1, w, m) {
    var dx = x1 - x0, dz = z1 - z0, n = Math.max(Math.abs(dx), Math.abs(dz)) || 1;
    var h = Math.floor(w / 2);
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = Math.round(x0 + dx * t), z = Math.round(z0 + dz * t);
      var y = Math.round(y0 + (y1 - y0) * t);
      this.fill(x - h, y0 - 1, z - h, x - h + w - 1, y, z - h + w - 1, m);
    }
  };

  /* --------------------------- 像素文字 --------------------------- */
  /**
   * 在竖直面上写字。
   * axis 'z': 文字沿 +X 排布，法线朝 ±Z（由 flip 决定）；
   * axis 'x': 文字沿 +Z 排布，法线朝 ±X。
   */
  Wp.text = function (str, x, y, z, axis, m, opt) {
    opt = opt || {};
    var sc = opt.scale || 1, gap = opt.gap == null ? 1 : opt.gap, dirSign = opt.back ? -1 : 1;
    str = String(str).toUpperCase();
    var cur = 0;
    for (var i = 0; i < str.length; i++) {
      var g = FONT[str[i]] || FONT[' '];
      for (var r = 0; r < 7; r++) {
        var bits = g[r];
        for (var c = 0; c < 5; c++) {
          if (!(bits & (1 << (4 - c)))) continue;
          for (var sy = 0; sy < sc; sy++) for (var sxx = 0; sxx < sc; sxx++) {
            var oy = y - (r * sc + sy);
            var off = (cur + c) * sc + sxx;
            if (axis === 'x') this.set(x, oy, z + off * dirSign, m);
            else this.set(x + off * dirSign, oy, z, m);
          }
        }
      }
      cur += 5 + gap;
    }
    return cur * sc;
  };

  Wp.textWidth = function (str, sc, gap) {
    sc = sc || 1; gap = gap == null ? 1 : gap;
    return String(str).length * (5 + gap) * sc;
  };

  /* =====================================================================
     地形（列高图）
     ===================================================================== */

  Wp.tSet = function (x, z, h, m, side) {
    if (x < 0 || z < 0 || x >= SX || z >= SZ) return;
    var i = z * SX + x;
    this.H[i] = h;
    if (m != null) this.Mt[i] = m;
    this.Mu[i] = side != null ? side : (m != null ? m : this.Mu[i]);
  };

  Wp.tH = function (x, z) {
    if (x < 0 || z < 0 || x >= SX || z >= SZ) return -1;
    return this.H[z * SX + x];
  };

  Wp.tM = function (x, z) {
    if (x < 0 || z < 0 || x >= SX || z >= SZ) return 0;
    return this.Mt[z * SX + x];
  };

  /**
   * 道路保护开关：开启后所有"只改材质"的装饰性涂刷（tPaint / tPaintDisc /
   * grassPatch 等）都不会覆盖既有铺装，保证路网动线连续。
   */
  var ROADSET = null;
  Wp.guarded = function (i) {
    if (!this._guard) return false;
    if (!ROADSET) {
      ROADSET = new Set();
      var names = ['asphalt', 'asphaltWorn', 'asphaltCrack', 'roadLine', 'roadNeon',
        'roadNeonPink', 'roadLineWarm', 'whiteTile', 'marble', 'pave', 'paveDark',
        'paveWarm', 'curb', 'brickPave', 'redCarpet', 'grate', 'goldTrim', 'hazard', 'rubble'];
      for (var k = 0; k < names.length; k++) ROADSET.add(VX.m(names[k]));
    }
    return ROADSET.has(this.Mt[i]);
  };
  Wp.setGuard = function (on) { this._guard = !!on; };

  /** 矩形地面 */
  Wp.tRect = function (x0, z0, x1, z1, h, m, side) {
    for (var z = Math.max(0, z0); z <= Math.min(SZ - 1, z1); z++)
      for (var x = Math.max(0, x0); x <= Math.min(SX - 1, x1); x++) this.tSet(x, z, h, m, side);
  };

  /** 只改材质不改高度 */
  Wp.tPaint = function (x0, z0, x1, z1, m, side) {
    for (var z = Math.max(0, z0); z <= Math.min(SZ - 1, z1); z++)
      for (var x = Math.max(0, x0); x <= Math.min(SX - 1, x1); x++) {
        var i = z * SX + x;
        if (this.H[i] < 0 || this.guarded(i)) continue;
        this.Mt[i] = m;
        if (side != null) this.Mu[i] = side;
      }
  };

  Wp.tDisc = function (cx, cz, r, h, m, side) {
    var r2 = r * r;
    for (var z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) <= r2) this.tSet(x, z, h, m, side);
  };

  Wp.tPaintDisc = function (cx, cz, r, m, inner, side) {
    var r2 = r * r, ri2 = inner ? inner * inner : -1;
    for (var z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        var d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
        if (d <= r2 && d >= ri2) {
          var i = z * SX + x;
          if (x < 0 || z < 0 || x >= SX || z >= SZ || this.H[i] < 0 || this.guarded(i)) continue;
          this.Mt[i] = m;
          if (side != null) this.Mu[i] = side;
        }
      }
  };

  /** 折线道路（地形铺装 + 可选中心虚线） */
  Wp.tRoad = function (pts, w, m, opt) {
    opt = opt || {};
    var self = this, h = Math.floor(w / 2);
    this.roads.push({ pts: pts.slice(), w: w, name: opt.name || '' });
    for (var s = 0; s < pts.length - 1; s++) {
      var a = pts[s], b = pts[s + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var n = Math.max(Math.abs(dx), Math.abs(dz)) || 1;
      for (var i = 0; i <= n; i++) {
        var t = i / n, cxp = Math.round(a[0] + dx * t), czp = Math.round(a[1] + dz * t);
        for (var oz = -h; oz <= w - 1 - h; oz++)
          for (var ox = -h; ox <= w - 1 - h; ox++) {
            var x = cxp + ox, z = czp + oz;
            if (x < 0 || z < 0 || x >= SX || z >= SZ) continue;
            var ii = z * SX + x;
            if (self.H[ii] < 0) continue;
            var edge = (ox === -h || ox === w - 1 - h || oz === -h || oz === w - 1 - h);
            self.Mt[ii] = (edge && opt.curb != null) ? opt.curb : m;
            if (opt.lift) self.H[ii] = opt.lift;
          }
      }
    }
  };

  Wp.tWater = function (x0, z0, x1, z1, level, m) {
    m = m || VX.m('water');
    for (var z = Math.max(0, z0); z <= Math.min(SZ - 1, z1); z++)
      for (var x = Math.max(0, x0); x <= Math.min(SX - 1, x1); x++) {
        var i = z * SX + x;
        if (this.H[i] >= 0 && this.H[i] < level) { this.W[i] = level; this.Wm[i] = m; }
      }
  };

  Wp.tWaterDisc = function (cx, cz, r, level, m) {
    m = m || VX.m('water');
    var r2 = r * r;
    for (var z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) > r2) continue;
        if (x < 0 || z < 0 || x >= SX || z >= SZ) continue;
        var i = z * SX + x;
        if (this.H[i] >= 0 && this.H[i] < level) { this.W[i] = level; this.Wm[i] = m; }
      }
  };

  /** 圆形凹地/凸地：平滑过渡 */
  Wp.tCrater = function (cx, cz, r, depth, edge, m) {
    for (var z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || z < 0 || x >= SX || z >= SZ) continue;
        var i = z * SX + x;
        if (this.H[i] < 0) continue;
        var d = Math.hypot(x - cx, z - cz);
        if (d > r) continue;
        var t = d < r - edge ? 1 : (1 - (d - (r - edge)) / edge);
        t = M.smooth(M.clamp(t, 0, 1));
        this.H[i] = Math.round(this.H[i] + depth * t);
        if (m != null && t > 0.5 && !this.guarded(i)) this.Mt[i] = m;
      }
  };

  /** 平滑高度（多次盒式模糊，只作用于非虚空列） */
  Wp.tSmooth = function (x0, z0, x1, z1, iter) {
    var tmp = new Int16Array((x1 - x0 + 1) * (z1 - z0 + 1));
    for (var it = 0; it < (iter || 1); it++) {
      var k = 0, x, z;
      for (z = z0; z <= z1; z++) for (x = x0; x <= x1; x++, k++) {
        var sum = 0, cnt = 0;
        for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
          var h = this.tH(x + dx, z + dz);
          if (h >= 0) { sum += h; cnt++; }
        }
        tmp[k] = cnt ? Math.round(sum / cnt) : -1;
      }
      k = 0;
      for (z = z0; z <= z1; z++) for (x = x0; x <= x1; x++, k++) {
        if (x < 0 || z < 0 || x >= SX || z >= SZ) continue;
        var i = z * SX + x;
        if (this.H[i] >= 0 && tmp[k] >= 0) this.H[i] = tmp[k];
      }
    }
  };

  /** 散布回调（确定性） */
  Wp.scatter = function (x0, z0, x1, z1, count, seed, cb) {
    var rnd = M.rng(seed);
    for (var i = 0; i < count; i++) {
      var x = Math.round(x0 + rnd() * (x1 - x0));
      var z = Math.round(z0 + rnd() * (z1 - z0));
      cb.call(this, x, z, rnd, i);
    }
  };

  Wp.buildTileMax = function () {
    var TW = Math.ceil(SX / 8), TD = Math.ceil(SZ / 8);
    var tm = new Int16Array(TW * TD);
    for (var z = 0; z < SZ; z++) {
      var tz = (z >> 3) * TW;
      for (var x = 0; x < SX; x++) {
        var i = z * SX + x;
        var v = Math.max(this.colMax[i], this.H[i]);
        var t = tz + (x >> 3);
        if (v > tm[t]) tm[t] = v;
      }
    }
    this.tileMax = tm; this.TW = TW; this.TD = TD;
    return tm;
  };

  VX.World = World;
})(window);
