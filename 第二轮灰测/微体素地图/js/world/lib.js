/* =====================================================================
   微体素地图 · 建筑构件库（赛博朋克化的「凌城范式」）
   立面四要素：竖梃 / 腰线 / 窗带 / 檐口环
   屋顶第五立面：花园 / 设备 / 天线 / 直升机坪（hash 四选一，屋顶不留空）
   裙房三件套：橱窗带 / 雨棚灯槽 / 角柱
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, m = VX.m;
  var LIB = VX.LIB = {};
  var ST = 4;                                   // 层高模数（体素）
  LIB.ST = ST;

  /* ------------------------- 基础工具 ------------------------- */

  /** 矩形环（周长一圈） */
  LIB.perim = function (w, x0, z0, x1, z1, y, mat) {
    w.fill(x0, y, z0, x1, y, z0, mat);
    w.fill(x0, y, z1, x1, y, z1, mat);
    w.fill(x0, y, z0, x0, y, z1, mat);
    w.fill(x1, y, z0, x1, y, z1, mat);
  };

  /** 外扩一圈的环（雨棚 / 檐口） */
  LIB.eave = function (w, x0, z0, x1, z1, y, out, mat) {
    for (var o = 1; o <= out; o++) LIB.perim(w, x0 - o, z0 - o, x1 + o, z1 + o, y, mat);
    LIB.perim(w, x0, z0, x1, z1, y, mat);
  };

  /** 周长上按步长点缀（灯珠/铆钉） */
  LIB.perimDots = function (w, x0, z0, x1, z1, y, step, mat, phase) {
    var i;
    phase = phase || 0;
    for (i = x0; i <= x1; i++) {
      if ((i + phase) % step === 0) { w.set(i, y, z0, mat); w.set(i, y, z1, mat); }
    }
    for (i = z0; i <= z1; i++) {
      if ((i + phase) % step === 0) { w.set(x0, y, i, mat); w.set(x1, y, i, mat); }
    }
  };

  /* ------------------------- 立面处理 ------------------------- */
  /**
   * 给已填实的体块加立面。
   * opt: { body, win, mullion, belt, trim, storyH, mulEvery, beltEvery,
   *        neon, neonEvery, glassRatio, dark }
   */
  LIB.facade = function (w, x0, z0, x1, z1, y0, y1, opt) {
    opt = opt || {};
    var body = opt.body != null ? opt.body : m('whitePanel');
    var win = opt.win != null ? opt.win : m('windowCool');
    var mull = opt.mullion != null ? opt.mullion : m('concrete');
    var belt = opt.belt != null ? opt.belt : m('whitePanel2');
    var storyH = opt.storyH || ST;
    var mulEvery = opt.mulEvery || 3;
    var beltEvery = opt.beltEvery || 4;
    var neon = opt.neon, neonEvery = opt.neonEvery || 0;
    var skipBase = opt.skipBase || 0;
    var s = 0, y;

    for (y = y0 + skipBase; y <= y1; y++) {
      var ly = (y - y0 - skipBase);
      var inStory = ly % storyH;
      s = Math.floor(ly / storyH);
      var isBelt = (inStory === 0) && (s % beltEvery === 0) && s > 0;
      if (isBelt) { LIB.perim(w, x0, z0, x1, z1, y, belt); continue; }
      if (inStory === 0) { LIB.perim(w, x0, z0, x1, z1, y, body); continue; }
      if (inStory >= storyH - 1) { LIB.perim(w, x0, z0, x1, z1, y, body); continue; }
      // 窗带 + 竖梃
      var i;
      for (i = x0; i <= x1; i++) {
        var mx = ((i - x0) % mulEvery === 0) || i === x0 || i === x1;
        w.set(i, y, z0, mx ? mull : win);
        w.set(i, y, z1, mx ? mull : win);
      }
      for (i = z0; i <= z1; i++) {
        var mz = ((i - z0) % mulEvery === 0) || i === z0 || i === z1;
        w.set(x0, y, i, mz ? mull : win);
        w.set(x1, y, i, mz ? mull : win);
      }
      // 霓虹腰带
      if (neon != null && neonEvery && inStory === 1 && (s % neonEvery === 0)) {
        LIB.perim(w, x0, z0, x1, z1, y, neon);
      }
    }
    // 角柱
    if (opt.cornerMat != null) w.corners(x0, y0, z0, x1, y1, z1, opt.cornerMat, opt.cornerW || 1);
  };

  /* ------------------------- 第五立面（屋顶） ------------------------- */
  LIB.roofScape = function (w, x0, z0, x1, z1, y, kind, seed) {
    var rnd = M.rng(seed || 7);
    var cx = ((x0 + x1) / 2) | 0, cz = ((z0 + z1) / 2) | 0;
    var wx = x1 - x0, wz = z1 - z0;
    // 女儿墙 + 灯带
    LIB.perim(w, x0, z0, x1, z1, y + 1, m('concrete'));
    LIB.perim(w, x0, z0, x1, z1, y + 2, m('steelDark'));
    LIB.perimDots(w, x0, z0, x1, z1, y + 2, 5, m('neonCyan'));
    if (wx < 4 || wz < 4) { w.fill(x0, y, z0, x1, y, z1, m('concreteDark')); return; }
    var ix0 = x0 + 1, iz0 = z0 + 1, ix1 = x1 - 1, iz1 = z1 - 1;

    if (kind === 0) {           /* 屋顶花园 */
      w.fill(ix0, y, iz0, ix1, y, iz1, m('grass'));
      LIB.perim(w, ix0, iz0, ix1, iz1, y + 1, m('hedge'));
      var n = Math.max(1, ((wx * wz) / 40) | 0);
      for (var i = 0; i < n; i++) {
        var tx = ix0 + 1 + ((rnd() * (wx - 3)) | 0), tz = iz0 + 1 + ((rnd() * (wz - 3)) | 0);
        LIB.tree(w, tx, tz, y + 1, 4 + ((rnd() * 3) | 0), rnd() < 0.3 ? 'neon' : 'broad');
      }
      w.fill(cx - 1, y + 1, cz - 1, cx + 1, y + 1, cz + 1, m('paveWarm'));
      w.set(cx, y + 2, cz, m('lampWarm'));
    } else if (kind === 1) {    /* 设备层 */
      w.fill(ix0, y, iz0, ix1, y, iz1, m('concreteDark'));
      var boxes = 2 + ((rnd() * 3) | 0);
      for (var b = 0; b < boxes; b++) {
        var bw = 2 + ((rnd() * 3) | 0), bd = 2 + ((rnd() * 3) | 0);
        var bx = ix0 + ((rnd() * Math.max(1, wx - bw - 1)) | 0);
        var bz = iz0 + ((rnd() * Math.max(1, wz - bd - 1)) | 0);
        var bh = 2 + ((rnd() * 3) | 0);
        w.fill(bx, y + 1, bz, bx + bw, y + bh, bz + bd, m('steelDark'));
        LIB.perim(w, bx, bz, bx + bw, bz + bd, y + bh, m('grate'));
        if (rnd() < 0.6) w.set(bx, y + bh + 1, bz, m('neonAmber'));
      }
      // 排气管
      for (var p = 0; p < 3; p++) {
        var px = ix0 + ((rnd() * wx) | 0), pz = iz0 + ((rnd() * wz) | 0);
        w.fill(px, y + 1, pz, px, y + 3 + ((rnd() * 3) | 0), pz, m('rustMetal'));
      }
      w.set(ix1, y + 4, iz1, m('neonRed'));
    } else if (kind === 2) {    /* 天线阵 */
      w.fill(ix0, y, iz0, ix1, y, iz1, m('concreteDark'));
      LIB.antennaMast(w, cx, cz, y + 1, 10 + ((rnd() * 12) | 0));
      var dn = 2 + ((rnd() * 3) | 0);
      for (var d = 0; d < dn; d++) {
        var dx = ix0 + ((rnd() * wx) | 0), dz = iz0 + ((rnd() * wz) | 0);
        w.fill(dx, y + 1, dz, dx, y + 2, dz, m('steel'));
        w.disc(dx, dz, 1.6, y + 3, m('whitePanel'));
        w.set(dx, y + 4, dz, m('neonCyan'));
      }
    } else {                    /* 直升机坪 / 停机平台 */
      w.fill(ix0, y, iz0, ix1, y, iz1, m('asphalt'));
      var r = Math.min(wx, wz) / 2 - 1;
      w.disc(cx, cz, r, y, m('paveDark'));
      w.disc(cx, cz, r, y, m('roadLineWarm'), r - 1.2);
      w.text('H', cx - 2, y + 3, cz, 'z', m('roadLine'));
      LIB.perimDots(w, ix0, iz0, ix1, iz1, y + 1, 3, m('neonAmber'), 1);
    }
  };

  /* ------------------------- 塔楼 / 裙房 ------------------------- */
  /** opt: { body, win, neon, roof, mulEvery, sign, signMat, crown } */
  LIB.tower = function (w, x0, z0, x1, z1, y0, height, opt) {
    opt = opt || {};
    var body = opt.body != null ? opt.body : m('whitePanel');
    var y1 = y0 + height;
    w.fill(x0, y0, z0, x1, y1, z1, body);
    LIB.facade(w, x0, z0, x1, z1, y0, y1 - 1, opt);
    // 檐口环
    LIB.eave(w, x0, z0, x1, z1, y1, 1, opt.trim != null ? opt.trim : m('concrete'));
    w.fill(x0, y1 + 1, z0, x1, y1 + 1, z1, opt.roofDeck != null ? opt.roofDeck : m('concreteDark'));
    var kind = opt.roof != null ? opt.roof : (((M.hash3(x0, z0, height) * 4) | 0) % 4);
    LIB.roofScape(w, x0, z0, x1, z1, y1 + 1, kind, x0 * 31 + z0);
    // 竖向霓虹（转角边条）
    if (opt.edgeNeon != null) {
      var eh = y0 + 3;
      w.fill(x0, eh, z0 - 1, x0, y1 - 2, z0 - 1, opt.edgeNeon);
      w.fill(x1, eh, z0 - 1, x1, y1 - 2, z0 - 1, opt.edgeNeon);
      w.fill(x0 - 1, eh, z0, x0 - 1, y1 - 2, z0, opt.edgeNeon);
      w.fill(x1 + 1, eh, z1, x1 + 1, y1 - 2, z1, opt.edgeNeon);
    }
    return y1;
  };

  /** 退台塔：segs = [[inset, stories], ...] 自下而上逐段收进 */
  LIB.setbackTower = function (w, cx, cz, half, y0, segs, opt) {
    opt = opt || {};
    var y = y0;
    for (var i = 0; i < segs.length; i++) {
      var h = half - segs[i][0], st = segs[i][1] * ST;
      var o = { body: opt.body, win: opt.win, mullion: opt.mullion, belt: opt.belt,
        neon: opt.neon, neonEvery: opt.neonEvery, mulEvery: opt.mulEvery };
      w.fill(cx - h, y, cz - h, cx + h, y + st, cz + h, o.body != null ? o.body : m('whitePanel'));
      LIB.facade(w, cx - h, cz - h, cx + h, cz + h, y, y + st - 1, o);
      LIB.eave(w, cx - h, cz - h, cx + h, cz + h, y + st, 1, opt.trim != null ? opt.trim : m('concrete'));
      if (i < segs.length - 1) {
        // 退台平台绿化
        w.fill(cx - h, y + st + 1, cz - h, cx + h, y + st + 1, cz + h, m('paveDark'));
        LIB.perimDots(w, cx - h, cz - h, cx + h, cz + h, y + st + 1, 4, m('neonCyan'));
        var nh = half - segs[i + 1][0];
        if (nh + 2 <= h) {
          w.fill(cx - h + 1, y + st + 1, cz - h + 1, cx - nh - 1, y + st + 1, cz + h - 1, m('grass'));
          w.fill(cx + nh + 1, y + st + 1, cz - h + 1, cx + h - 1, y + st + 1, cz + h - 1, m('grass'));
        }
      }
      y += st + 1;
    }
    LIB.roofScape(w, cx - (half - segs[segs.length - 1][0]), cz - (half - segs[segs.length - 1][0]),
      cx + (half - segs[segs.length - 1][0]), cz + (half - segs[segs.length - 1][0]), y,
      opt.roof != null ? opt.roof : 2, cx * 7 + cz);
    return y;
  };

  /** 裙房：橱窗带 + 雨棚灯槽 + 角柱 */
  LIB.podium = function (w, x0, z0, x1, z1, y0, stories, opt) {
    opt = opt || {};
    var body = opt.body != null ? opt.body : m('concrete');
    var glass = opt.glass != null ? opt.glass : m('glassCyan');
    var h = stories * ST;
    var y1 = y0 + h;
    w.fill(x0, y0, z0, x1, y1, z1, body);
    // 地面层橱窗带
    var gy0 = y0 + 1, gy1 = y0 + ST - 1;
    for (var y = gy0; y <= gy1; y++) {
      for (var i = x0 + 1; i < x1; i++) {
        var mx = (i - x0) % 4 === 0;
        w.set(i, y, z0, mx ? body : glass);
        w.set(i, y, z1, mx ? body : glass);
      }
      for (var k = z0 + 1; k < z1; k++) {
        var mz = (k - z0) % 4 === 0;
        w.set(x0, y, k, mz ? body : glass);
        w.set(x1, y, k, mz ? body : glass);
      }
    }
    // 二层以上窗带
    if (stories > 1) LIB.facade(w, x0, z0, x1, z1, y0 + ST, y1 - 1,
      { body: body, win: opt.win != null ? opt.win : m('windowWarm'), mullion: body,
        belt: opt.trim != null ? opt.trim : m('whitePanel2'), mulEvery: 4, beltEvery: 2 });
    // 雨棚 + 灯槽
    var cy = y0 + ST;
    LIB.eave(w, x0, z0, x1, z1, cy, 2, opt.canopy != null ? opt.canopy : m('steelDark'));
    LIB.perim(w, x0 - 2, z0 - 2, x1 + 2, z1 + 2, cy - 1, opt.strip != null ? opt.strip : m('lampWarm'));
    // 彩色旗帜 / 招牌带（打破整片白，增加街道气息）
    if (opt.banner !== false) {
      var bset = [m('mechaRed'), m('mechaBlue'), m('mechaGreen'), m('copperPatina'),
        m('goldTrim'), m('neonPink'), m('mechaPink')];
      var bm = bset[Math.abs((x0 * 31 + z0 * 17) % bset.length)];
      var bi;
      for (bi = x0 + 2; bi <= x1 - 2; bi += 5) {
        w.fill(bi, cy - 4, z0 - 3, bi, cy - 2, z0 - 3, bm);
        w.fill(bi, cy - 4, z1 + 3, bi, cy - 2, z1 + 3, bm);
      }
      for (bi = z0 + 2; bi <= z1 - 2; bi += 5) {
        w.fill(x0 - 3, cy - 4, bi, x0 - 3, cy - 2, bi, bm);
        w.fill(x1 + 3, cy - 4, bi, x1 + 3, cy - 2, bi, bm);
      }
    }
    // 角柱
    w.corners(x0 - 1, y0, z0 - 1, x1 + 1, cy - 1, z1 + 1, opt.pillar != null ? opt.pillar : m('concreteDark'), 1);
    // 屋顶
    w.fill(x0, y1 + 1, z0, x1, y1 + 1, z1, m('concreteDark'));
    LIB.roofScape(w, x0, z0, x1, z1, y1 + 1, opt.roof != null ? opt.roof : 1, x0 * 13 + z1);
    return y1;
  };

  /** 沿街街区：裙房贴街成墙 + 塔楼后退 */
  LIB.streetBlock = function (w, x0, z0, x1, z1, y0, seed, opt) {
    opt = opt || {};
    var rnd = M.rng(seed);
    // 主体色系轮换：冷白 / 暖混凝土 / 铜绿 / 灰蓝，避免整城一片白
    var bodySet = [m('whitePanel2'), m('concrete'), m('concreteWarm'), m('whitePanel'),
      m('concreteDark'), m('steelDark'), m('brickWhite')];
    var trimSet = [m('copperPatina'), m('goldTrim'), m('tileRoof'), m('steel'), m('rustMetal')];
    var glassSet = [m('glassCyan'), m('glassClear'), m('glassDark'), m('glassGreen'), m('glassGold')];
    var body = opt.body != null ? opt.body : bodySet[(rnd() * bodySet.length) | 0];
    var trim = trimSet[(rnd() * trimSet.length) | 0];
    var pod = LIB.podium(w, x0, z0, x1, z1, y0, 2, {
      body: body, glass: glassSet[(rnd() * glassSet.length) | 0],
      trim: trim, canopy: trim, roof: 1
    });
    // 塔楼后退
    var iw = Math.min(x1 - x0, z1 - z0);
    if (iw >= 8) {
      var inset = 2 + ((rnd() * 2) | 0);
      var tx0 = x0 + inset, tz0 = z0 + inset, tx1 = x1 - inset, tz1 = z1 - inset;
      var stories = (opt.minStory || 6) + ((rnd() * ((opt.maxStory || 15) - (opt.minStory || 6))) | 0);
      var neonPick = [m('neonCyan'), m('neonMagenta'), m('neonAmber'), m('neonBlue'),
        m('neonGreen'), m('neonViolet'), m('neonPink')];
      var tBody = bodySet[(rnd() * bodySet.length) | 0];
      LIB.tower(w, tx0, tz0, tx1, tz1, pod + 2, stories * ST, {
        body: tBody,
        win: rnd() < 0.45 ? m('windowGold') : (rnd() < 0.6 ? m('windowCool') : m('windowWarm')),
        mullion: rnd() < 0.5 ? m('concrete') : m('concreteDark'), belt: trim,
        neon: neonPick[(rnd() * neonPick.length) | 0], neonEvery: 3 + ((rnd() * 3) | 0),
        mulEvery: 3, roof: (rnd() * 4) | 0,
        edgeNeon: rnd() < 0.30 ? neonPick[(rnd() * neonPick.length) | 0] : null
      });
      // 侧墙巨幅全息广告
      if (rnd() < 0.55) {
        var side = (rnd() * 4) | 0;
        var hm = [m('holoScreen'), m('holoPink'), m('holoGreen')][(rnd() * 3) | 0];
        var bh = 6 + ((rnd() * 8) | 0);
        if (side === 0) LIB.holoBoard(w, tx0 + 1, pod + 8, tz0 - 1, 'z', Math.min(tx1 - tx0 - 1, 9), bh, hm, -1);
        else if (side === 1) LIB.holoBoard(w, tx0 + 1, pod + 8, tz1 + 1, 'z', Math.min(tx1 - tx0 - 1, 9), bh, hm, 1);
        else if (side === 2) LIB.holoBoard(w, tx0 - 1, pod + 8, tz0 + 1, 'x', Math.min(tz1 - tz0 - 1, 9), bh, hm, -1);
        else LIB.holoBoard(w, tx1 + 1, pod + 8, tz0 + 1, 'x', Math.min(tz1 - tz0 - 1, 9), bh, hm, 1);
      }
    } else {
      LIB.roofScape(w, x0, z0, x1, z1, pod + 1, 1, seed);
    }
    return pod;
  };

  /* ------------------------- 招牌 / 广告 ------------------------- */
  /** 霓虹字招牌（带背板与灯槽） */
  LIB.neonSign = function (w, x, y, z, axis, text, mat, opt) {
    opt = opt || {};
    var sc = opt.scale || 1, back = opt.back != null ? opt.back : m('darkMetal');
    var wid = w.textWidth(text, sc, 1);
    var hgt = 7 * sc;
    var d = opt.dir || 1;
    if (axis === 'z') {
      w.fill(x - 1, y - hgt, z, x + wid, y + 1, z, back);
      w.text(text, x, y, z + d, 'z', mat, { scale: sc });
      w.fill(x - 1, y + 1, z + d, x + wid, y + 1, z + d, opt.strip != null ? opt.strip : mat);
    } else {
      w.fill(x, y - hgt, z - 1, x, y + 1, z + wid, back);
      w.text(text, x + d, y, z, 'x', mat, { scale: sc });
      w.fill(x + d, y + 1, z - 1, x + d, y + 1, z + wid, opt.strip != null ? opt.strip : mat);
    }
  };

  /** 全息广告牌：面板 + 边框 + 支架 */
  LIB.holoBoard = function (w, x, y, z, axis, ww, hh, mat, dir) {
    dir = dir || 1;
    var fr = m('steelDark');
    if (axis === 'z') {
      w.fill(x, y, z, x + ww, y + hh, z, mat);
      LIB.perim(w, x - 1, z, x + ww + 1, z, y, fr);
      w.fill(x - 1, y - 1, z, x + ww + 1, y - 1, z, fr);
      w.fill(x - 1, y + hh + 1, z, x + ww + 1, y + hh + 1, z, fr);
      w.fill(x - 1, y - 1, z, x - 1, y + hh + 1, z, fr);
      w.fill(x + ww + 1, y - 1, z, x + ww + 1, y + hh + 1, z, fr);
      w.set(x - 1, y + hh + 2, z, m('neonRed'));
    } else {
      w.fill(x, y, z, x, y + hh, z + ww, mat);
      w.fill(x, y - 1, z - 1, x, y - 1, z + ww + 1, fr);
      w.fill(x, y + hh + 1, z - 1, x, y + hh + 1, z + ww + 1, fr);
      w.fill(x, y - 1, z - 1, x, y + hh + 1, z - 1, fr);
      w.fill(x, y - 1, z + ww + 1, x, y + hh + 1, z + ww + 1, fr);
      w.set(x, y + hh + 2, z - 1, m('neonRed'));
    }
  };

  /* ------------------------- 附属构件 ------------------------- */
  LIB.antennaMast = function (w, x, z, y, h) {
    w.fill(x, y, z, x, y + h, z, m('steelDark'));
    for (var i = 3; i < h; i += 4) {
      w.fill(x - 1, y + i, z, x + 1, y + i, z, m('girder'));
      w.fill(x, y + i, z - 1, x, y + i, z + 1, m('girder'));
    }
    w.set(x, y + h, z, m('neonRed'));
    w.set(x, y + h - 1, z, m('darkMetal'));
    // 拉索
    w.line3(x, y + h - 3, z, x + 3, y, z + 3, m('wire'));
    w.line3(x, y + h - 3, z, x - 3, y, z - 3, m('wire'));
  };

  /** 外挂管线（含托架） */
  LIB.pipes = function (w, pts, y, mat, opt) {
    opt = opt || {};
    var br = opt.bracket != null ? opt.bracket : m('rustMetal');
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      w.line3(a[0], y, a[1], b[0], y, b[1], mat);
      w.line3(a[0], y + 1, a[1], b[0], y + 1, b[1], mat);
      var n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      for (var k = 0; k <= n; k += 6) {
        var t = n ? k / n : 0;
        var px = Math.round(a[0] + (b[0] - a[0]) * t), pz = Math.round(a[1] + (b[1] - a[1]) * t);
        w.set(px, y - 1, pz, br);
      }
    }
  };

  /** 蒸汽/排气口（带光） */
  LIB.vent = function (w, x, z, y, h, seed) {
    w.fill(x, y, z, x, y + h, z, m('rustMetal'));
    w.set(x, y + h + 1, z, m('steelDark'));
    if ((seed | 0) % 3 === 0) w.set(x, y + h + 2, z, m('neonAmber'));
  };

  LIB.acUnits = function (w, x0, z0, x1, z1, y, seed) {
    var rnd = M.rng(seed);
    var n = 2 + ((rnd() * 4) | 0);
    for (var i = 0; i < n; i++) {
      var x = x0 + ((rnd() * Math.max(1, x1 - x0 - 1)) | 0);
      var z = z0 + ((rnd() * Math.max(1, z1 - z0 - 1)) | 0);
      w.fill(x, y, z, x + 1, y + 1, z + 1, m('steelDark'));
      w.set(x, y + 2, z, m('grate'));
    }
  };

  /* ------------------------- 街道设施 ------------------------- */
  LIB.streetLamp = function (w, x, z, y, kind) {
    var h = kind === 'tall' ? 9 : 6;
    w.fill(x, y, z, x, y + h, z, m('steelDark'));
    if (kind === 'double') {
      w.fill(x - 2, y + h, z, x + 2, y + h, z, m('steelDark'));
      w.set(x - 2, y + h - 1, z, m('lampCool'));
      w.set(x + 2, y + h - 1, z, m('lampCool'));
    } else if (kind === 'neon') {
      w.set(x, y + h + 1, z, m('neonCyan'));
      w.fill(x - 1, y + h, z, x + 1, y + h, z, m('neonCyan'));
    } else {
      w.set(x, y + h + 1, z, m('lampWarm'));
    }
    w.set(x, y + 1, z, m('darkMetal'));
  };

  LIB.bench = function (w, x, z, y, dir) {
    if (dir === 'x') { w.fill(x, y + 1, z, x + 2, y + 1, z, m('wood')); w.set(x, y, z, m('steelDark')); w.set(x + 2, y, z, m('steelDark')); }
    else { w.fill(x, y + 1, z, x, y + 1, z + 2, m('wood')); w.set(x, y, z, m('steelDark')); w.set(x, y, z + 2, m('steelDark')); }
  };

  LIB.planter = function (w, x, z, y, r, seed) {
    w.disc(x, z, r, y + 1, m('paveWarm'));
    w.disc(x, z, r - 0.9, y + 1, m('dirt'));
    var rnd = M.rng(seed || 3);
    for (var i = 0; i < 4; i++) {
      var a = rnd() * 6.283, d = rnd() * (r - 1);
      w.set(Math.round(x + Math.cos(a) * d), y + 2, Math.round(z + Math.sin(a) * d),
        rnd() < 0.5 ? m('flowerPink') : m('flowerWhite'));
    }
  };

  /** 树（多种） */
  LIB.tree = function (w, x, z, y, h, kind) {
    var i, r;
    kind = kind || 'broad';
    if (kind === 'pine') {
      w.fill(x, y, z, x, y + h, z, m('trunk'));
      for (i = 0; i <= h - 2; i++) {
        r = Math.max(0.6, (h - 2 - i) * 0.46 + 0.7);
        if (i % 2 === 0) w.disc(x, z, r, y + 2 + i, m('leavesDark'));
      }
      w.set(x, y + h + 1, z, m('leavesDark'));
    } else if (kind === 'birch') {
      w.fill(x, y, z, x, y + h, z, m('trunkBirch'));
      w.sphere(x, y + h + 1, z, Math.max(2, h * 0.42), m('leavesLight'), { yScale: 0.8 });
    } else if (kind === 'cherry') {
      w.fill(x, y, z, x, y + h, z, m('trunk'));
      w.sphere(x, y + h + 1, z, Math.max(2, h * 0.5), m('cherry'), { yScale: 0.72 });
      w.set(x + 1, y + h, z, m('cherryDeep'));
      w.set(x - 1, y + h + 1, z + 1, m('cherryDeep'));
    } else if (kind === 'neon') {
      w.fill(x, y, z, x, y + h, z, m('trunk'));
      w.sphere(x, y + h + 1, z, Math.max(2, h * 0.44), m('leavesCyan'), { yScale: 0.85 });
      w.set(x, y + h + 2, z, m('leavesGlow'));
      w.set(x + 1, y + h, z, m('leavesGlow'));
    } else if (kind === 'dead') {
      w.fill(x, y, z, x, y + h, z, m('deadWood'));
      w.line3(x, y + h - 1, z, x + 2, y + h + 1, z + 1, m('deadWood'));
      w.line3(x, y + h - 2, z, x - 2, y + h, z - 1, m('deadWood'));
    } else if (kind === 'palm') {
      for (i = 0; i <= h; i++) w.set(x + ((i / 4) | 0), y + i, z, m('trunk'));
      var bx = x + ((h / 4) | 0);
      for (i = 0; i < 6; i++) {
        var a = i * 1.047;
        w.line3(bx, y + h, z, Math.round(bx + Math.cos(a) * 3), y + h - 1, Math.round(z + Math.sin(a) * 3), m('leaves'));
      }
    } else if (kind === 'giant') {
      /* 槲寄生巨树 */
      var tr = Math.max(3, (h * 0.13) | 0);
      w.cyl(x, z, tr, y, y + h, m('trunkGiant'));
      for (i = 0; i < 10; i++) {
        var ang = i * 0.628, dd = tr + 3 + (i % 3);
        w.line3(x, y + 1, z, Math.round(x + Math.cos(ang) * dd), y, Math.round(z + Math.sin(ang) * dd), m('trunkGiant'), 1);
      }
      var layers = 4;
      for (i = 0; i < layers; i++) {
        var ly = y + h - i * 5, lr = 9 + i * 3.2;
        w.sphere(x, ly, z, lr, m('leavesDark'), { yScale: 0.36, thick: 3 });
      }
      w.sphere(x, y + h + 3, z, 7, m('leavesCyan'), { yScale: 0.5, thick: 2 });
      w.disc(x, z, tr + 5, y + 1, m('flowerWhite'), tr + 3);
      w.fill(x, y + h + 4, z, x, y + h + 7, z, m('coreBlue'));
    } else {
      w.fill(x, y, z, x, y + h, z, m('trunk'));
      w.sphere(x, y + h + 1, z, Math.max(2, h * 0.46), m('leaves'), { yScale: 0.82 });
      w.set(x, y + h + 2 + (h > 5 ? 1 : 0), z, m('leavesLight'));
    }
  };

  /** 沿路装饰：路灯 + 行道树 + 霓虹缘石 */
  LIB.roadDeco = function (w, pts, halfW, y, opt) {
    opt = opt || {};
    var lampEvery = opt.lampEvery || 14, treeEvery = opt.treeEvery || 0;
    var lampKind = opt.lamp || 'neon', treeKind = opt.tree || 'broad';
    var neonCurb = opt.curbNeon;
    var acc = 0;
    for (var s = 0; s < pts.length - 1; s++) {
      var a = pts[s], b = pts[s + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var n = Math.max(Math.abs(dx), Math.abs(dz)) || 1;
      var ux = dx / n, uz = dz / n;
      var px = -uz, pz = ux;                       // 法向
      for (var i = 0; i <= n; i++, acc++) {
        var cx = Math.round(a[0] + dx * (i / n)), cz = Math.round(a[1] + dz * (i / n));
        function yAt(px, pz) {
          if (y != null) return y;
          var h = w.tH(px, pz);
          return h < 0 ? VX.GROUND : h + 1;
        }
        if (acc % lampEvery === 0) {
          var l1x = Math.round(cx + px * (halfW + 1)), l1z = Math.round(cz + pz * (halfW + 1));
          var l2x = Math.round(cx - px * (halfW + 1)), l2z = Math.round(cz - pz * (halfW + 1));
          LIB.streetLamp(w, l1x, l1z, yAt(l1x, l1z), lampKind);
          LIB.streetLamp(w, l2x, l2z, yAt(l2x, l2z), lampKind);
        }
        if (treeEvery && acc % treeEvery === Math.floor(treeEvery / 2)) {
          var t1x = Math.round(cx + px * (halfW + 2)), t1z = Math.round(cz + pz * (halfW + 2));
          var t2x = Math.round(cx - px * (halfW + 2)), t2z = Math.round(cz - pz * (halfW + 2));
          LIB.tree(w, t1x, t1z, yAt(t1x, t1z), 5 + (acc % 3), treeKind);
          LIB.tree(w, t2x, t2z, yAt(t2x, t2z), 5 + ((acc + 1) % 3), treeKind);
        }
        if (neonCurb != null && acc % 3 === 0) {
          var c1x = Math.round(cx + px * halfW), c1z = Math.round(cz + pz * halfW);
          var c2x = Math.round(cx - px * halfW), c2z = Math.round(cz - pz * halfW);
          w.set(c1x, yAt(c1x, c1z), c1z, neonCurb);
          w.set(c2x, yAt(c2x, c2z), c2z, neonCurb);
        }
      }
    }
  };

  /** 斑马线（在地形上刷条纹） */
  LIB.crosswalk = function (w, x0, z0, x1, z1, dir) {
    var mat = m('roadLine');
    if (dir === 'x') {
      for (var x = x0; x <= x1; x += 2) w.tPaint(x, z0, x, z1, mat);
    } else {
      for (var z = z0; z <= z1; z += 2) w.tPaint(x0, z, x1, z, mat);
    }
  };

  /** 广场：铺装 + 缘石 + 灯柱 + 长椅 + 花坛 */
  LIB.plaza = function (w, x0, z0, x1, z1, y, opt) {
    opt = opt || {};
    var pv = opt.pave != null ? opt.pave : m('whiteTile');
    var alt = opt.alt != null ? opt.alt : m('paveDark');
    for (var z = z0; z <= z1; z++)
      for (var x = x0; x <= x1; x++) {
        var chk = (((x / 6) | 0) + ((z / 6) | 0)) % 2;
        w.tPaint(x, z, x, z, chk ? pv : alt);
      }
    LIB.perim(w, x0, z0, x1, z1, y, opt.curb != null ? opt.curb : m('curb'));
    var step = opt.lampEvery || 10;
    for (var i = x0 + 3; i < x1; i += step) {
      LIB.streetLamp(w, i, z0 + 2, y, 'neon');
      LIB.streetLamp(w, i, z1 - 2, y, 'neon');
    }
    if (opt.benches !== false) {
      for (var k = z0 + 4; k < z1 - 2; k += 9) { LIB.bench(w, x0 + 2, k, y, 'z'); LIB.bench(w, x1 - 2, k, y, 'z'); }
    }
    if (opt.planters !== false) {
      LIB.planter(w, x0 + 5, z0 + 5, y, 2.4, x0 + z0);
      LIB.planter(w, x1 - 5, z1 - 5, y, 2.4, x1 + z1);
    }
  };

  /** 牌坊门户 */
  LIB.gateArch = function (w, x, z, y, span, h, text, opt) {
    opt = opt || {};
    var axis = opt.axis || 'z';                 // 'z': 跨 X 方向
    var post = opt.post != null ? opt.post : m('whitePanel');
    var beamM = opt.beam != null ? opt.beam : m('goldTrim');
    var neon = opt.neon != null ? opt.neon : m('neonCyan');
    var hs = span >> 1;
    if (axis === 'z') {
      w.fill(x - hs, y, z - 1, x - hs + 1, y + h, z + 1, post);
      w.fill(x + hs - 1, y, z - 1, x + hs, y + h, z + 1, post);
      w.fill(x - hs, y + h, z - 1, x + hs, y + h + 1, z + 1, beamM);
      w.fill(x - hs, y + h + 2, z, x + hs, y + h + 2, z, neon);
      if (text) w.text(text, x - Math.floor(w.textWidth(text, 1, 1) / 2), y + h - 2, z - 2, 'z', neon);
      w.fill(x - hs, y + 1, z - 2, x - hs + 1, y + 1, z - 2, neon);
      w.fill(x + hs - 1, y + 1, z - 2, x + hs, y + 1, z - 2, neon);
    } else {
      w.fill(x - 1, y, z - hs, x + 1, y + h, z - hs + 1, post);
      w.fill(x - 1, y, z + hs - 1, x + 1, y + h, z + hs, post);
      w.fill(x - 1, y + h, z - hs, x + 1, y + h + 1, z + hs, beamM);
      w.fill(x, y + h + 2, z - hs, x, y + h + 2, z + hs, neon);
      if (text) w.text(text, x - 2, y + h - 2, z - Math.floor(w.textWidth(text, 1, 1) / 2), 'x', neon);
    }
  };

  /** 围界墙（含门柱与开口） */
  LIB.fenceWall = function (w, pts, y, h, mat, opt) {
    opt = opt || {};
    var postEvery = opt.postEvery || 10, postM = opt.post != null ? opt.post : m('concreteDark');
    var cap = opt.cap != null ? opt.cap : m('steelDark');
    var neon = opt.neon;
    var acc = 0;
    for (var s = 0; s < pts.length - 1; s++) {
      var a = pts[s], b = pts[s + 1];
      var n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) || 1;
      for (var i = 0; i < n; i++, acc++) {
        var t = i / n;
        var x = Math.round(a[0] + (b[0] - a[0]) * t), z = Math.round(a[1] + (b[1] - a[1]) * t);
        var skip = false;
        if (opt.gaps) for (var g = 0; g < opt.gaps.length; g++) {
          var gp = opt.gaps[g];
          if (Math.abs(x - gp[0]) <= gp[2] && Math.abs(z - gp[1]) <= gp[2]) skip = true;
        }
        if (skip) continue;
        w.fill(x, y, z, x, y + h - 1, z, mat);
        w.set(x, y + h, z, cap);
        if (acc % postEvery === 0) { w.fill(x, y, z, x, y + h + 1, z, postM); if (neon != null) w.set(x, y + h + 2, z, neon); }
        else if (neon != null && acc % 3 === 0) w.set(x, y + h, z, neon);
      }
    }
  };

  /** 空中连廊 */
  LIB.skybridge = function (w, x0, z0, x1, z1, y, wd, opt) {
    opt = opt || {};
    var deck = opt.deck != null ? opt.deck : m('concrete');
    var glass = opt.glass != null ? opt.glass : m('glassCyan');
    var truss = opt.truss != null ? opt.truss : m('girder');
    var horiz = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    var hw = wd >> 1;
    if (horiz) {
      var xa = Math.min(x0, x1), xb = Math.max(x0, x1);
      w.fill(xa, y, z0 - hw, xb, y, z0 + hw, deck);
      w.fill(xa, y + 1, z0 - hw, xb, y + 3, z0 - hw, glass);
      w.fill(xa, y + 1, z0 + hw, xb, y + 3, z0 + hw, glass);
      w.fill(xa, y + 4, z0 - hw, xb, y + 4, z0 + hw, deck);
      for (var x = xa; x <= xb; x += 5) { w.fill(x, y, z0 - hw, x, y + 4, z0 - hw, truss); w.fill(x, y, z0 + hw, x, y + 4, z0 + hw, truss); }
      for (var xl = xa + 2; xl <= xb; xl += 6) w.set(xl, y + 4, z0, m('lampCool'));
    } else {
      var za = Math.min(z0, z1), zb = Math.max(z0, z1);
      w.fill(x0 - hw, y, za, x0 + hw, y, zb, deck);
      w.fill(x0 - hw, y + 1, za, x0 - hw, y + 3, zb, glass);
      w.fill(x0 + hw, y + 1, za, x0 + hw, y + 3, zb, glass);
      w.fill(x0 - hw, y + 4, za, x0 + hw, y + 4, zb, deck);
      for (var z = za; z <= zb; z += 5) { w.fill(x0 - hw, y, z, x0 - hw, y + 4, z, truss); w.fill(x0 + hw, y, z, x0 + hw, y + 4, z, truss); }
      for (var zl = za + 2; zl <= zb; zl += 6) w.set(x0, y + 4, zl, m('lampCool'));
    }
  };

  /** 高架桥（桥墩 + 桥面 + 轨道） */
  LIB.viaduct = function (w, pts, y, wd, opt) {
    opt = opt || {};
    var deck = opt.deck != null ? opt.deck : m('concrete');
    var pier = opt.pier != null ? opt.pier : m('concreteDark');
    var rail = opt.rail != null ? opt.rail : m('steel');
    var glow = opt.glow != null ? opt.glow : m('neonCyan');
    var hw = wd >> 1, acc = 0;
    for (var s = 0; s < pts.length - 1; s++) {
      var a = pts[s], b = pts[s + 1];
      var n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) || 1;
      var ux = (b[0] - a[0]) / n, uz = (b[1] - a[1]) / n;
      var px = -uz, pz = ux;
      for (var i = 0; i <= n; i++, acc++) {
        var cx = Math.round(a[0] + ux * i), cz = Math.round(a[1] + uz * i);
        for (var o = -hw; o <= hw; o++) {
          var x = Math.round(cx + px * o), z = Math.round(cz + pz * o);
          w.set(x, y, z, deck);
          if (o === -hw || o === hw) { w.set(x, y + 1, z, rail); if (acc % 4 === 0) w.set(x, y + 2, z, glow); }
        }
        if (acc % 16 === 0) {
          var gy = w.tH(cx, cz);
          if (gy >= 0) {
            w.fill(cx - 1, gy + 1, cz - 1, cx + 1, y - 1, cz + 1, pier);
            w.fill(cx - 2, y - 1, cz - 2, cx + 2, y - 1, cz + 2, pier);
          }
        }
      }
    }
  };

  /** 探照灯（含光柱） */
  LIB.searchlight = function (w, x, z, y, h, dir, mat) {
    mat = mat || m('beamCyan');
    w.fill(x, y, z, x, y + h, z, m('steelDark'));
    w.fill(x - 1, y + h, z - 1, x + 1, y + h + 1, z + 1, m('darkMetal'));
    w.set(x, y + h + 2, z, m('lampCool'));
    var d = dir || [0.3, 1, 0.2];
    var len = 34;
    for (var i = 3; i < len; i++) {
      var t = i / len, r = 0.6 + t * 3.2;
      var px = x + d[0] * i, py = y + h + 2 + d[1] * i, pz = z + d[2] * i;
      w.sphere(Math.round(px), Math.round(py), Math.round(pz), r, mat, { thick: 1 });
    }
  };

  /** 竖直光柱（震撼用） */
  LIB.lightPillar = function (w, x, z, y0, y1, r, mat) {
    for (var y = y0; y <= y1; y++) {
      var t = (y - y0) / Math.max(1, y1 - y0);
      w.disc(x, z, r * (1 - t * 0.35), y, mat, Math.max(0, r * (1 - t * 0.35) - 1.3));
    }
  };

  /* ------------------------- 废墟 / 残骸 ------------------------- */
  /** 废墟楼：下段实心（省面数）+ 上段塌空露楼板 + 塌角 + 露筋 + 藤蔓 */
  LIB.ruinBuilding = function (w, x0, z0, x1, z1, y0, stories, seed, opt) {
    opt = opt || {};
    var rnd = M.rng(seed);
    var body = opt.body != null ? opt.body : (rnd() < 0.36 ? m('concreteMossy') : (rnd() < 0.5 ? m('concrete') : m('brickRuin')));
    var h = stories * ST;
    var y1 = y0 + h;
    var solidTop = y0 + Math.round(h * (0.52 + rnd() * 0.24));   // 实心段顶
    var x, y, z;
    // 下段实心（只出外表面）
    w.fill(x0, y0, z0, x1, solidTop, z1, body);
    // 上段：外墙 + 露出的楼板
    for (y = solidTop + 1; y <= y1; y++) {
      var t = (y - solidTop) / Math.max(1, y1 - solidTop);
      var erode = 0.10 + t * t * 0.62;
      for (z = z0; z <= z1; z++)
        for (x = x0; x <= x1; x++) {
          var edge = (x === x0 || x === x1 || z === z0 || z === z1);
          var isSlab = (y - y0) % ST === 0;
          if (!edge && !isSlab) continue;
          var n = M.fbm(x * 0.24, (z + y * 3.7) * 0.24, 2, seed & 0xffff);
          if (n < erode) continue;
          w.set(x, y, z, edge ? body : m('concreteDark'));
        }
    }
    // 立面破窗带（只在实心段刷材质，不增面）
    for (y = y0 + 2; y < solidTop; y += ST) {
      for (x = x0 + 1; x < x1; x++) {
        if ((x + (seed & 3)) % 3 === 0) continue;
        var wm = M.hash3(x, y, z0) < 0.42 ? m('scorch') : m('glassBroken');
        w.set(x, y, z0, wm);
        w.set(x, y, z1, M.hash3(x, y, z1) < 0.42 ? m('scorch') : m('glassBroken'));
      }
      for (z = z0 + 1; z < z1; z++) {
        if ((z + (seed & 3)) % 3 === 0) continue;
        w.set(x0, y, z, M.hash3(x0, y, z) < 0.42 ? m('scorch') : m('glassBroken'));
        w.set(x1, y, z, M.hash3(x1, y, z) < 0.42 ? m('scorch') : m('glassBroken'));
      }
    }
    // 塌角
    if (rnd() < 0.62) {
      var cxs = rnd() < 0.5 ? x0 : Math.max(x0, x1 - 3), czs = rnd() < 0.5 ? z0 : Math.max(z0, z1 - 3);
      var ch = solidTop - 1 - ((rnd() * (solidTop - y0) * 0.6) | 0);
      w.fill(cxs, ch, czs, cxs + 3, y1, czs + 3, 0);
      LIB.rubblePile(w, cxs + 1, czs + 1, y0, 2.2 + rnd() * 1.6, seed + 17);
    }
    // 露筋
    for (var r = 0; r < 4; r++) {
      var rx = x0 + ((rnd() * (x1 - x0)) | 0), rz = z0 + ((rnd() * (z1 - z0)) | 0);
      w.fill(rx, y1 - 1, rz, rx, y1 + 1 + ((rnd() * 3) | 0), rz, m('wire'));
    }
    // 藤蔓 / 苔痕
    for (var v = 0; v < 6; v++) {
      var vx = x0 + ((rnd() * (x1 - x0)) | 0);
      var vz = rnd() < 0.5 ? z0 : z1;
      var vy = y0 + ((rnd() * h * 0.6) | 0);
      w.fill(vx, vy, vz, vx, Math.min(y1, vy + 2 + ((rnd() * 4) | 0)), vz, m('moss'));
    }
    // 残存霓虹招牌
    if (rnd() < 0.52) {
      var sy = y0 + 5 + ((rnd() * Math.max(1, solidTop - y0 - 6)) | 0);
      var txt = ['NEO', 'APE', '13', 'BAR', 'CAFE', 'SUB', 'X-7', 'HOTEL', 'RAMEN', 'CLUB'][(rnd() * 10) | 0];
      var mm2 = rnd() < 0.5 ? m('neonFlickRed') : m('neonFlick');
      if (rnd() < 0.5) LIB.neonSign(w, x0 + 1, sy, z0 - 1, 'z', txt, mm2, { dir: -1 });
      else LIB.neonSign(w, x0 - 1, sy, z0 + 1, 'x', txt, mm2, { dir: -1 });
    }
    // 楼脚埋沙
    if (opt.buried !== false) {
      var bh = 1 + ((rnd() * 2) | 0);
      LIB.perim(w, x0 - 1, z0 - 1, x1 + 1, z1 + 1, y0, m('sand'));
      if (bh > 1) LIB.perim(w, x0 - 1, z0 - 1, x1 + 1, z1 + 1, y0 + 1, m('sandDark'));
    }
    LIB.rubblePile(w, x0 - 2 + ((rnd() * (x1 - x0 + 4)) | 0), z0 - 2, y0, 1.6 + rnd() * 1.8, seed + 91);
    return y1;
  };

  LIB.rubblePile = function (w, x, z, y, r, seed) {
    var rnd = M.rng(seed || 11);
    var n = Math.max(3, (r * r * 2.2) | 0);
    for (var i = 0; i < n; i++) {
      var a = rnd() * 6.283, d = rnd() * r;
      var px = Math.round(x + Math.cos(a) * d), pz = Math.round(z + Math.sin(a) * d);
      var hh = Math.max(0, Math.round((1 - d / Math.max(0.6, r)) * r * 1.1));
      w.fill(px, y, pz, px, y + hh, pz, rnd() < 0.35 ? m('rubbleDark') : m('rubble'));
    }
  };

  /** 废弃车辆 */
  LIB.vehicle = function (w, x, z, y, dir, seed) {
    var rnd = M.rng(seed || 5);
    var col = [m('rustMetal'), m('rustDeep'), m('tarp'), m('mechaGrey')][(rnd() * 4) | 0];
    if (dir === 'x') {
      w.fill(x, y, z, x + 4, y + 1, z + 1, col);
      w.fill(x + 1, y + 2, z, x + 3, y + 2, z + 1, rnd() < 0.5 ? m('glassBroken') : col);
      w.set(x, y, z, m('darkMetal')); w.set(x + 4, y, z + 1, m('darkMetal'));
    } else {
      w.fill(x, y, z, x + 1, y + 1, z + 4, col);
      w.fill(x, y + 2, z + 1, x + 1, y + 2, z + 3, rnd() < 0.5 ? m('glassBroken') : col);
      w.set(x, y, z, m('darkMetal')); w.set(x + 1, y, z + 4, m('darkMetal'));
    }
    if (rnd() < 0.3) w.set(x, y + 3, z, m('neonFlickRed'));
  };

  /** 集装箱 */
  LIB.container = function (w, x, z, y, dir, mat) {
    if (dir === 'x') { w.fill(x, y, z, x + 7, y + 3, z + 2, mat); LIB.perim(w, x, z, x + 7, z + 2, y + 3, m('steelDark')); }
    else { w.fill(x, y, z, x + 2, y + 3, z + 7, mat); LIB.perim(w, x, z, x + 2, z + 7, y + 3, m('steelDark')); }
  };

  /** 通用残骸（坠机 / 废弃机体 / 舰段） */
  LIB.wreck = function (w, x, z, y, len, dir, seed, opt) {
    opt = opt || {};
    var rnd = M.rng(seed || 17);
    var hull = opt.hull != null ? opt.hull : m('rustMetal');
    var dark = opt.dark != null ? opt.dark : m('rustDeep');
    var rad = opt.rad || Math.max(2, (len * 0.16) | 0);
    var ux = dir === 'x' ? 1 : 0, uz = dir === 'x' ? 0 : 1;
    var tilt = opt.tilt != null ? opt.tilt : 0.12;
    for (var i = 0; i < len; i++) {
      var t = i / len;
      var r = rad * (0.45 + Math.sin(Math.PI * (0.15 + t * 0.85)) * 0.85);
      var cx = Math.round(x + ux * i), cz = Math.round(z + uz * i);
      var cy = Math.round(y + r * 0.5 + i * tilt);
      if (M.fbm(i * 0.3, seed * 0.01, 2, seed & 255) < 0.28) continue;      // 断裂段
      w.sphere(cx, cy, cz, r, i % 7 === 0 ? dark : hull, { yScale: 0.86, thick: opt.thick || 0 });
      if (i % 9 === 0) {                                                    // 露骨/框架
        if (dir === 'x') w.fill(cx, cy - r | 0, cz - r - 1, cx, cy + r | 0, cz + r + 1, m('girder'));
        else w.fill(cx - r - 1, cy - r | 0, cz, cx + r + 1, cy + r | 0, cz, m('girder'));
      }
      if (rnd() < 0.10) w.set(cx, cy + Math.round(r), cz, rnd() < 0.5 ? m('neonFlickRed') : m('ember'));
    }
    // 拖痕与瓦砾
    for (var k = 0; k < len / 3; k++) {
      var sx = Math.round(x + ux * (rnd() * len) + (rnd() - 0.5) * rad * 3);
      var sz = Math.round(z + uz * (rnd() * len) + (rnd() - 0.5) * rad * 3);
      w.fill(sx, y, sz, sx, y + ((rnd() * 2) | 0), sz, rnd() < 0.5 ? m('rubbleDark') : dark);
    }
  };

  /** 叫龙骨架（脊椎 + 肋骨 + 头骨） */
  LIB.bones = function (w, x, z, y, len, dir, seed, opt) {
    opt = opt || {};
    var rnd = M.rng(seed || 23);
    var bone = opt.bone != null ? opt.bone : m('boneWhite');
    var old = opt.old != null ? opt.old : m('boneOld');
    var ux = dir === 'x' ? 1 : 0, uz = dir === 'x' ? 0 : 1;
    var px = -uz, pz = ux;
    var segs = Math.max(6, (len / 3) | 0);
    var spineY = [];
    for (var i = 0; i <= segs; i++) {
      var t = i / segs;
      var cx = Math.round(x + ux * len * t), cz = Math.round(z + uz * len * t);
      var arch = Math.sin(t * Math.PI) * (opt.arch != null ? opt.arch : len * 0.16);
      var cy = Math.round(y + 2 + arch);
      spineY.push([cx, cy, cz]);
      w.sphere(cx, cy, cz, 1.6, i % 2 ? bone : old, { yScale: 1.1 });
      // 肋骨
      if (i > 1 && i < segs - 1 && i % 2 === 0) {
        var rl = (opt.rib != null ? opt.rib : len * 0.22) * (0.5 + Math.sin(t * Math.PI) * 0.7);
        for (var sgn = -1; sgn <= 1; sgn += 2) {
          for (var k = 1; k <= rl; k++) {
            var kt = k / rl;
            var bx = Math.round(cx + px * sgn * k * 0.92);
            var bz = Math.round(cz + pz * sgn * k * 0.92);
            var by = Math.round(cy - kt * kt * rl * 0.85);
            if (by <= y - 1) break;
            w.set(bx, by, bz, bone);
          }
        }
      }
      // 支撑腿骨
      if (i % 5 === 2) {
        w.line3(cx, cy - 1, cz + 2, cx + 2, y, cz + 5, old);
        w.line3(cx, cy - 1, cz - 2, cx - 2, y, cz - 5, old);
      }
    }
    // 头骨
    var head = spineY[segs];
    var hx = head[0] + ux * 5, hz = head[2] + uz * 5, hy = head[1] - 1;
    w.sphere(hx, hy, hz, 4.2, bone, { yScale: 0.82 });
    w.fill(hx - 1, hy - 1, hz - 1, hx + 1, hy - 1, hz + 1, 0);
    w.set(Math.round(hx + ux * 3 + px * 1.5), hy + 1, Math.round(hz + uz * 3 + pz * 1.5), m('coreRed'));
    w.set(Math.round(hx + ux * 3 - px * 1.5), hy + 1, Math.round(hz + uz * 3 - pz * 1.5), m('coreRed'));
    // 外露机械件
    for (var mm = 0; mm < 5; mm++) {
      var si = 2 + ((rnd() * (segs - 4)) | 0);
      var sp = spineY[si];
      w.fill(sp[0] - 1, sp[1] + 1, sp[2] - 1, sp[0] + 1, sp[1] + 2, sp[2] + 1, m('bioMechDark'));
      w.set(sp[0], sp[1] + 3, sp[2], m('veinRed'));
    }
    return spineY;
  };

  /** FRANXX 机体（立姿，装饰用） */
  LIB.mecha = function (w, x, z, y, h, opt) {
    opt = opt || {};
    var main = opt.main != null ? opt.main : m('mechaWhite');
    var acc = opt.accent != null ? opt.accent : m('mechaRed');
    var dark = m('mechaDark');
    var s = h / 20;
    var legH = Math.round(h * 0.42), bodyH = Math.round(h * 0.34);
    var lw = Math.max(1, Math.round(1.6 * s));
    // 腿
    w.fill(x - lw - 1, y, z - lw, x - 1, y + legH, z + lw, dark);
    w.fill(x + 1, y, z - lw, x + lw + 1, y + legH, z + lw, dark);
    w.fill(x - lw - 1, y, z - lw, x - 1, y + 1, z + lw + 1, main);
    w.fill(x + 1, y, z - lw, x + lw + 1, y + 1, z + lw + 1, main);
    // 躯干
    var bw = Math.max(2, Math.round(3 * s));
    w.fill(x - bw, y + legH, z - lw - 1, x + bw, y + legH + bodyH, z + lw + 1, main);
    w.fill(x - bw, y + legH + Math.round(bodyH * 0.5), z - lw - 2, x + bw, y + legH + Math.round(bodyH * 0.6), z - lw - 2, acc);
    w.set(x, y + legH + Math.round(bodyH * 0.55), z - lw - 2, m('coreBlue'));
    // 肩 + 臂
    w.fill(x - bw - 2, y + legH + bodyH - 2, z - lw, x - bw, y + legH + bodyH, z + lw, acc);
    w.fill(x + bw, y + legH + bodyH - 2, z - lw, x + bw + 2, y + legH + bodyH, z + lw, acc);
    w.fill(x - bw - 2, y + legH + 2, z - 1, x - bw - 1, y + legH + bodyH - 3, z + 1, dark);
    w.fill(x + bw + 1, y + legH + 2, z - 1, x + bw + 2, y + legH + bodyH - 3, z + 1, dark);
    // 头
    var hy = y + legH + bodyH + 1;
    w.fill(x - 1, hy, z - 1, x + 1, hy + 2, z + 1, main);
    w.fill(x - 1, hy + 1, z - 2, x + 1, hy + 1, z - 2, m('windowCool'));
    w.set(x, hy + 3, z, acc);
  };

  /** 钻塔 */
  LIB.drillTower = function (w, x, z, y, h) {
    w.fill(x - 3, y, z - 3, x + 3, y + 1, z + 3, m('concreteDark'));
    for (var i = 0; i <= h; i++) {
      var t = i / h, r = 3 - t * 1.8;
      w.set(Math.round(x - r), y + i, Math.round(z - r), m('girder'));
      w.set(Math.round(x + r), y + i, Math.round(z - r), m('girder'));
      w.set(Math.round(x - r), y + i, Math.round(z + r), m('girder'));
      w.set(Math.round(x + r), y + i, Math.round(z + r), m('girder'));
      if (i % 4 === 0) LIB.perim(w, Math.round(x - r), Math.round(z - r), Math.round(x + r), Math.round(z + r), y + i, m('steelDark'));
      if (i % 8 === 4) LIB.perim(w, Math.round(x - r), Math.round(z - r), Math.round(x + r), Math.round(z + r), y + i, m('hazard'));
    }
    w.fill(x, y + h, z, x, y + h + 3, z, m('steel'));
    w.set(x, y + h + 4, z, m('neonRed'));
    w.fill(x - 1, y + 2, z - 4, x + 1, y + 4, z - 4, m('holoScreen'));
  };

  /** 储罐 */
  LIB.tank = function (w, x, z, y, r, h, opt) {
    opt = opt || {};
    w.cyl(x, z, r, y, y + h, opt.body != null ? opt.body : m('steel'));
    w.disc(x, z, r, y + h + 1, opt.top != null ? opt.top : m('steelDark'));
    for (var i = 0; i < 3; i++) w.disc(x, z, r + 0.4, y + 3 + i * Math.max(2, (h / 3) | 0), m('hazard'), r - 0.7);
    w.fill(x, y + h + 2, z, x, y + h + 4, z, m('rustMetal'));
    w.set(x, y + h + 5, z, m('neonAmber'));
    // 爬梯
    w.fill(x + r, y, z, x + r, y + h, z, m('girder'));
  };

  /** 烟囱（带排气光） */
  LIB.stack = function (w, x, z, y, r, h) {
    w.cyl(x, z, r, y, y + h, m('concreteWarm'), { thick: 1 });
    for (var i = 6; i < h; i += 7) w.disc(x, z, r + 0.4, y + i, m('hazard'), r - 0.6);
    w.disc(x, z, r, y + h, m('darkMetal'), r - 1.2);
    w.disc(x, z, r - 1, y + h + 1, m('ember'));
    w.set(x + r, y + h - 1, z, m('neonRed'));
  };

  /* ------------------------- 组合：庭院 ------------------------- */
  /** 院落：围墙 + 门 + 内铺装 + 中心景 */
  LIB.courtyard = function (w, x0, z0, x1, z1, y, opt) {
    opt = opt || {};
    var wallM = opt.wall != null ? opt.wall : m('whitePanel2');
    var gate = opt.gateSide || 'z0';
    var gaps = [];
    var mx = ((x0 + x1) / 2) | 0, mz = ((z0 + z1) / 2) | 0;
    if (gate.indexOf('z0') >= 0) gaps.push([mx, z0, 4]);
    if (gate.indexOf('z1') >= 0) gaps.push([mx, z1, 4]);
    if (gate.indexOf('x0') >= 0) gaps.push([x0, mz, 4]);
    if (gate.indexOf('x1') >= 0) gaps.push([x1, mz, 4]);
    LIB.fenceWall(w, [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]], y, opt.h || 4, wallM,
      { gaps: gaps, neon: opt.neon != null ? opt.neon : m('neonCyan'), postEvery: opt.postEvery || 9 });
    if (opt.pave !== false) {
      for (var z = z0 + 1; z < z1; z++) for (var x = x0 + 1; x < x1; x++) {
        var chk = (((x / 5) | 0) + ((z / 5) | 0)) % 2;
        w.tPaint(x, z, x, z, chk ? (opt.pave1 != null ? opt.pave1 : m('pave')) : (opt.pave2 != null ? opt.pave2 : m('paveWarm')));
      }
    }
    return { mx: mx, mz: mz, gaps: gaps };
  };

  /* ------------------------- 喷泉 ------------------------- */
  LIB.fountain = function (w, x, z, y, r) {
    w.tPaintDisc(x, z, r + 4, m('whiteTile'));
    w.disc(x, z, r, y, m('marble'), r - 1.2);
    w.tDisc(x, z, r - 1.5, y - 2, m('paveDark'));
    w.tWaterDisc(x, z, r - 1.5, y - 1, m('waterNeon'));
    w.cyl(x, z, 1.6, y, y + 3, m('marble'));
    w.disc(x, z, 3.2, y + 4, m('marble'), 1.4);
    w.cyl(x, z, 1, y + 4, y + 7, m('marble'));
    w.set(x, y + 8, z, m('lampCool'));
    for (var i = 0; i < 8; i++) {
      var a = i * 0.785;
      var lx = Math.round(x + Math.cos(a) * (r + 2.5)), lz = Math.round(z + Math.sin(a) * (r + 2.5));
      LIB.streetLamp(w, lx, lz, y, 'neon');
    }
  };
})(window);
