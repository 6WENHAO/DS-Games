/* =====================================================================
   微体素地图 · 干涸海床（末世寂寥 · 搁浅巨轮 · 最后的潟湖）
   场地：中心 (320,990)，x[216,424] × z[908,1072]，盆底 y≈17
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, m = VX.m, LAY = VX.LAY, LIB = VX.LIB;

  VX.buildSeabed = function (w) {
    var S = LAY.seabed, CX = S.cx, CZ = S.cz;
    var X0 = CX - S.hw, X1 = CX + S.hw, Z0 = CZ - S.hh, Z1 = CZ + S.hh;
    function gy(x, z) { var h = w.tH(x, z); return h < 0 ? LAY.ground - 9 : h + 1; }
    var i, k, x, z, y;

    /* ---------------- 1. 海床地貌 ---------------- */
    // 盐壳裂纹斑块
    w.setGuard(true);
    w.scatter(X0 - 6, Z0 - 6, X1 + 6, Z1 + 6, 420, 0x5EA1, function (px, pz, rn) {
      var r = 3 + rn() * 9;
      w.tPaintDisc(px, pz, r, rn() < 0.5 ? m('salt') : m('crackedMud'), 0, m('stoneLight'));
    });
    w.setGuard(false);
    // 海沟（长条凹槽，东西向蜿蜒）
    for (i = 0; i < 46; i++) {
      var tx = X0 + 6 + i * 4;
      var tz = CZ + 30 + Math.round(Math.sin(i * 0.34) * 16);
      w.tCrater(tx, tz, 7 + (i % 3), -4, 4, m('stoneDark'));
    }
    w.tSmooth(X0, CZ + 10, X1, Z1, 1);
    // 礁体与珊瑚骸
    w.scatter(X0, Z0, X1, Z1, 320, 0x0C0A, function (px, pz, rn) {
      if (w.tH(px, pz) < 0) return;
      var py = gy(px, pz), h = 1 + ((rn() * 4) | 0);
      var mm = rn() < 0.5 ? m('boneOld') : (rn() < 0.5 ? m('boneWhite') : m('stoneLight'));
      w.fill(px, py, pz, px + ((rn() * 2) | 0), py + h, pz + ((rn() * 2) | 0), mm);
      if (rn() < 0.16) w.set(px, py + h + 1, pz, m('flowerWhite'));
    });
    // 漂流枯木
    w.scatter(X0, Z0, X1, Z1, 260, 0x0D0F, function (px, pz, rn) {
      if (w.tH(px, pz) < 0) return;
      var py = gy(px, pz);
      var len = 2 + ((rn() * 5) | 0);
      if (rn() < 0.5) w.fill(px, py, pz, px + len, py, pz, m('deadWood'));
      else w.fill(px, py, pz, px, py, pz + len, m('deadWood'));
      if (rn() < 0.25) w.set(px, py + 1, pz, m('deadWood'));
    });
    // 鲸骨 / 巨兽骨（3 具）
    LIB.bones(w, 356, 1044, gy(356, 1044), 34, 'x', 0xB0A1, { arch: 6, rib: 8 });
    LIB.bones(w, 232, 940, gy(232, 940), 26, 'z', 0xB0A2, { arch: 4, rib: 6 });
    LIB.bones(w, 404, 1006, gy(404, 1006), 22, 'x', 0xB0A3, { arch: 3, rib: 5, bone: m('boneOld') });
    w.addLabel('鲸骨群', 356, gy(356, 1044) + 14, 1044, 'minor');

    /* ---------------- 2. 搁浅巨轮（全场焦点） ---------------- */
    (function () {
      var bx = S.ship[0] - 60, bz = S.ship[1];
      var L = 122, HW = 12, DECK = 14;
      var keel = gy(bx, bz);
      var hull = m('rustMetal'), hullD = m('rustDeep'), hullK = m('darkMetal2');
      function prof(t) {                       // 船体半宽比例
        if (t < 0.14) return 0.22 + t / 0.14 * 0.62;
        if (t > 0.90) return 0.86 - (t - 0.90) / 0.10 * 0.42;
        return 1.0 - Math.abs(t - 0.52) * 0.16;
      }
      for (i = 0; i < L; i++) {
        var t = i / L;
        var hw = Math.max(1, Math.round(prof(t) * HW));
        var pitch = Math.round((0.42 - t) * 7);          // 船首抬起
        var by = keel + pitch;
        var xx = bx + i;
        for (var dz = -hw; dz <= hw; dz++) {
          var zz = bz + dz;
          var roll = Math.round(dz * 0.30);              // 右舷横倾
          var curve = Math.round((Math.abs(dz) / hw) * (Math.abs(dz) / hw) * 4);
          var y0 = by + curve, y1 = by + DECK + roll;
          var mm = hull;
          if (dz === -hw || dz === hw) mm = (i % 11 < 4) ? hullD : hull;
          if (y0 <= keel + 1) mm = hullK;
          w.fill(xx, y0, zz, xx, y1, zz, mm);
          // 锈蚀分层：水线带
          if ((dz === -hw || dz === hw)) {
            w.set(xx, by + 3, zz, hullD);
            w.set(xx, by + 4, zz, hullD);
            if (i % 7 === 0) w.set(xx, by + DECK + roll - 1, zz, m('hazard'));
          }
        }
        // 甲板板缝
        if (i % 6 === 0) for (var d2 = -hw + 1; d2 < hw; d2++)
          w.set(xx, by + DECK + Math.round(d2 * 0.30), bz + d2, m('steelDark'));
      }
      // 右舷大破孔（露出内部框架与舱室）
      var hx = bx + 62, hz = bz + 12;
      for (i = -14; i <= 14; i++) {
        for (var j = -6; j <= 6; j++) {
          if ((i * i) / 196 + (j * j) / 36 > 1) continue;
          for (var dzz = 0; dzz <= 9; dzz++) {
            w.set(hx + i, keel + 6 + j, hz - dzz, 0);
          }
        }
      }
      // 内部框架与舱室
      for (i = -12; i <= 12; i += 4) {
        w.fill(hx + i, keel + 1, hz - 9, hx + i, keel + 13, hz, m('girder'));
      }
      for (i = -10; i <= 10; i += 10) {
        w.fill(hx + i - 3, keel + 5, hz - 8, hx + i + 3, keel + 5, hz - 1, m('grate'));
        w.set(hx + i, keel + 7, hz - 5, m('windowDim'));
      }
      w.set(hx - 6, keel + 9, hz - 4, m('neonFlick'));
      w.set(hx + 8, keel + 6, hz - 6, m('neonFlickRed'));
      LIB.rubblePile(w, hx, hz + 4, keel, 5, 0x5111);
      // 舰桥上层建筑（三层，靠船尾）
      var sx = bx + 94, sz = bz;
      var sBase = keel + Math.round((0.42 - 0.77) * 7) + DECK;
      for (k = 0; k < 3; k++) {
        var hwk = 9 - k * 2, ly = sBase + 1 + k * 5;
        w.fill(sx - 8 + k, ly, sz - hwk, sx + 8 - k, ly + 4, sz + hwk, m('whitePanel2'));
        LIB.perim(w, sx - 8 + k, sz - hwk, sx + 8 - k, sz + hwk, ly + 2, m('glassBroken'));
        for (i = sx - 7 + k; i < sx + 8 - k; i += 3) {
          w.set(i, ly + 2, sz - hwk, m('windowDim'));
          w.set(i, ly + 2, sz + hwk, m('windowDim'));
        }
        LIB.perim(w, sx - 8 + k, sz - hwk, sx + 8 - k, sz + hwk, ly + 5, m('steelDark'));
      }
      var topY = sBase + 16;
      w.fill(sx - 3, topY, sz - 3, sx + 3, topY + 3, sz + 3, m('whitePanel'));
      w.fill(sx - 3, topY + 1, sz - 4, sx + 3, topY + 2, sz - 4, m('glassCyan'));
      w.set(sx, topY + 4, sz, m('neonFlickRed'));
      // 桅杆 + 雷达
      w.fill(sx, topY + 4, sz, sx, topY + 14, sz, m('steelDark'));
      w.fill(sx - 3, topY + 10, sz, sx + 3, topY + 10, sz, m('girder'));
      w.disc(sx, sz, 2.2, topY + 12, m('whitePanel'));
      w.set(sx, topY + 15, sz, m('neonRed'));
      w.line3(sx, topY + 12, sz, sx - 10, sBase + 2, sz + 6, m('wire'));
      w.line3(sx, topY + 12, sz, sx - 10, sBase + 2, sz - 6, m('wire'));
      // 两根烟囱
      for (k = 0; k < 2; k++) {
        var fx = bx + 82 + k * 8;
        var fb = keel + Math.round((0.42 - (82 + k * 8) / L) * 7) + DECK + 1;
        w.cyl(fx, bz, 3, fb, fb + 11, m('rustDeep'));
        w.disc(fx, bz, 3.4, fb + 12, m('darkMetal'));
        w.ring(fx, bz, 2.6, 3.6, fb + 7, fb + 7, m('hazard'));
        w.disc(fx, bz, 2, fb + 13, m('ash'));
      }
      // 甲板集装箱与吊臂
      for (k = 0; k < 7; k++) {
        var cxk = bx + 18 + k * 8, czk = bz - 6 + (k % 3) * 6;
        var cby = keel + Math.round((0.42 - (18 + k * 8) / L) * 7) + DECK + Math.round((czk - bz) * 0.30) + 1;
        LIB.container(w, cxk, czk, cby, 'x',
          [m('mechaRed'), m('mechaBlue'), m('rustMetal'), m('mechaGreen'), m('tarp')][k % 5]);
      }
      var crx = bx + 52, cry = keel + Math.round((0.42 - 52 / L) * 7) + DECK + 1;
      w.fill(crx, cry, bz - 8, crx, cry + 16, bz - 8, m('girder'));
      w.fill(crx, cry + 16, bz - 8, crx, cry + 16, bz + 8, m('girder'));
      w.line3(crx, cry + 16, bz + 8, crx, cry + 4, bz + 12, m('wire'));
      w.set(crx, cry + 3, bz + 12, m('darkMetal'));
      w.set(crx, cry + 17, bz - 8, m('neonAmber'));
      // 船首锚链与搁浅泥沙
      var pw = bx - 2;
      w.line3(pw, keel + 9, bz - 6, pw - 8, keel, bz - 10, m('wire'));
      w.line3(pw, keel + 9, bz + 6, pw - 8, keel, bz + 10, m('wire'));
      w.tPaintDisc(bx + 6, bz, 26, m('crackedMud'), 0, m('sandDark'));
      for (k = 0; k < 24; k++) {
        var aa = k * 0.262;
        var rx = Math.round(bx + 6 + Math.cos(aa) * (20 + (k % 5)));
        var rz = Math.round(bz + Math.sin(aa) * (16 + (k % 4)));
        LIB.rubblePile(w, rx, rz, gy(rx, rz), 1.6 + (k % 3) * 0.7, 0x900 + k);
      }
      // 船名
      w.text('S-13', bx + 6, keel + 11, bz - 13, 'z', m('signFaded'));
      w.addLabel('搁浅巨轮', bx + 60, keel + 34, bz, 'poi', '122 格船体 · 右舷破孔');
    })();

    /* ---------------- 3. 最后的潟湖 ---------------- */
    (function () {
      var px = S.lagoon[0], pz = S.lagoon[1];
      w.tCrater(px, pz, 30, -7, 12, m('sand'));
      w.tSmooth(px - 34, pz - 34, px + 34, pz + 34, 1);
      var lvl = gy(px, pz) + 3;
      w.tWaterDisc(px, pz, 25, lvl, m('water'));
      w.tPaintDisc(px, pz, 31, m('salt'), 25, m('sandDark'));
      w.tPaintDisc(px, pz, 35, m('sand'), 31);
      // 礁石与沉船残片
      for (i = 0; i < 9; i++) {
        var a = i * 0.698;
        var rx = Math.round(px + Math.cos(a) * (10 + (i % 4) * 4));
        var rz = Math.round(pz + Math.sin(a) * (9 + (i % 3) * 4));
        w.fill(rx, gy(rx, rz), rz, rx + (i % 2), gy(rx, rz) + 2 + (i % 3), rz + (i % 2), m('stoneDark'));
      }
      LIB.wreck(w, px + 16, pz - 20, gy(px + 16, pz - 20), 16, 'x', 0x77E1, { rad: 3, tilt: 0.08 });
      // 岸边：棕榈 / 篝火 / 帐篷 / 长椅（海边休假）
      for (i = 0; i < 10; i++) {
        var ta = i * 0.628 + 0.3;
        var tx = Math.round(px + Math.cos(ta) * 33), tz = Math.round(pz + Math.sin(ta) * 33);
        LIB.tree(w, tx, tz, gy(tx, tz), 6 + (i % 3), 'palm');
      }
      var cxf = px + 20, czf = pz + 24, cy = gy(cxf, czf);
      w.disc(cxf, czf, 3, cy, m('stoneDark'), 1.6);
      w.fill(cxf - 1, cy, czf - 1, cxf + 1, cy, czf + 1, m('ember'));
      w.set(cxf, cy + 1, czf, m('magmaCore'));
      for (i = 0; i < 4; i++) {
        var ba = i * 1.57 + 0.7;
        LIB.bench(w, Math.round(cxf + Math.cos(ba) * 5), Math.round(czf + Math.sin(ba) * 5), cy, i % 2 ? 'x' : 'z');
      }
      w.fill(cxf + 8, cy, czf - 4, cxf + 12, cy + 3, czf, m('tarp'));
      w.fill(cxf + 8, cy + 4, czf - 4, cxf + 12, cy + 4, czf, m('woodDark'));
      w.fill(cxf - 12, cy, czf + 2, cxf - 8, cy + 3, czf + 6, m('tarp'));
      LIB.streetLamp(w, px + 30, pz + 6, gy(px + 30, pz + 6), 'warm');
      LIB.streetLamp(w, px - 30, pz - 6, gy(px - 30, pz - 6), 'warm');
      w.addLabel('最后的潟湖', px, gy(px, pz) + 12, pz, 'poi', '海边休假 · 篝火告白');
    })();

    /* ---------------- 4. 白塔灯塔 ---------------- */
    (function () {
      var px = S.lighthouse[0], pz = S.lighthouse[1];
      var y = gy(px, pz);
      VX._flatRect(px - 12, pz - 12, px + 12, pz + 12, y - 1, 8, m('stoneLight'), m('stone'));
      y = gy(px, pz);
      // 基座
      w.cyl(px, pz, 8, y, y + 4, m('stone'));
      w.ring(px, pz, 7.4, 8.6, y + 5, y + 5, m('whitePanel'));
      // 塔身：白红环带，逐段收分
      var h = 46, r0 = 5.4;
      for (i = 0; i <= h; i++) {
        var rr = r0 - (i / h) * 2.2;
        var band = ((i / 7) | 0) % 2;
        w.disc(px, pz, rr, y + 5 + i, band ? m('neonRed') : m('whitePanel'), Math.max(0, rr - 1.4));
      }
      // 外挂旋梯
      for (i = 0; i < 46; i++) {
        var sa = i * 0.42;
        var srr = r0 - (i / h) * 2.2 + 1.3;
        w.set(Math.round(px + Math.cos(sa) * srr), y + 5 + i, Math.round(pz + Math.sin(sa) * srr), m('girder'));
      }
      // 灯室
      var ly = y + 5 + h;
      w.cyl(px, pz, 4.4, ly, ly + 1, m('steelDark'));
      w.cyl(px, pz, 4, ly + 1, ly + 4, m('glassCyan'), { thick: 1 });
      w.cyl(px, pz, 2, ly + 1, ly + 4, m('lampWarm'));
      w.disc(px, pz, 5, ly + 5, m('darkMetal'));
      w.cone(px, pz, ly + 6, ly + 10, 4, 0.8, m('mechaRed'));
      w.set(px, ly + 11, pz, m('neonWhite'));
      LIB.perimDots(w, px - 4, pz - 4, px + 4, pz + 4, ly + 5, 2, m('neonAmber'));
      // 旋转探照灯（朝潟湖）
      LIB.searchlight(w, px, pz, ly + 1, 1, [-0.55, 0.20, 0.80], m('beamWarm'));
      LIB.searchlight(w, px, pz, ly + 1, 1, [0.80, 0.16, -0.50], m('beamWarm'));
      w.addLabel('白塔灯塔', px, ly + 16, pz, 'poi', '02 看海之处');
    })();

    /* ---------------- 5. 育儿书老宅 ---------------- */
    (function () {
      var px = S.house[0], pz = S.house[1];
      var y = gy(px, pz);
      VX._flatRect(px - 16, pz - 14, px + 16, pz + 14, y - 1, 8, m('dirt'), m('dirtDark'));
      VX._grassPatch(px, pz + 4, 14, 0x1E0);
      y = gy(px, pz);
      // 双层木石老宅
      w.fill(px - 8, y, pz - 7, px + 8, y + 4, pz + 5, m('stoneLight'));
      w.fill(px - 8, y + 5, pz - 7, px + 8, y + 8, pz + 5, m('woodDark'));
      LIB.facade(w, px - 8, pz - 7, px + 8, pz + 5, y, y + 8,
        { body: m('woodDark'), win: m('windowWarm'), mullion: m('wood'), belt: m('woodWhite'),
          mulEvery: 4, beltEvery: 2, storyH: 4 });
      for (i = 0; i <= 6; i++)
        w.fill(px - 8 + i, y + 9 + i, pz - 7, px + 8 - i, y + 9 + i, pz + 5, m('tileRoof'));
      // 门廊
      w.fill(px - 3, y, pz + 6, px + 3, y + 4, pz + 7, m('wood'));
      w.fill(px - 4, y + 5, pz + 5, px + 4, y + 5, pz + 8, m('tileRoof'));
      w.fill(px - 1, y, pz + 8, px + 1, y + 3, pz + 8, m('windowGold'));
      w.tPaint(px - 2, pz + 9, px + 2, pz + 16, m('brickPave'));
      // 院墙 + 枯井 + 枯树
      LIB.fenceWall(w, [[px - 14, pz - 10], [px + 14, pz - 10], [px + 14, pz + 12], [px - 14, pz + 12], [px - 14, pz - 10]],
        y, 2, m('stoneDark'), { postEvery: 8, gaps: [[px, pz + 12, 3]] });
      w.cyl(px + 9, pz + 9, 2.4, y, y + 2, m('stoneDark'), { thick: 1 });
      w.disc(px + 9, pz + 9, 1.4, y, m('darkMetal'));
      w.fill(px + 9, y + 3, pz + 7, px + 9, y + 5, pz + 7, m('wood'));
      w.fill(px + 9, y + 5, pz + 7, px + 9, y + 5, pz + 11, m('wood'));
      LIB.tree(w, px - 11, pz + 8, y, 8, 'dead');
      LIB.tree(w, px + 12, pz - 6, y, 6, 'dead');
      LIB.streetLamp(w, px - 4, pz + 12, y, 'warm');
      w.addLabel('育儿书老宅', px, y + 18, pz, 'poi', '婴儿画册');
    })();

    /* ---------------- 6. 废弃栈桥与搁浅小船 ---------------- */
    (function () {
      // 栈桥：从潟湖东岸伸向海床（部分整段塌落）
      var bx0 = S.lagoon[0] + 34, bz = S.lagoon[1] - 2;
      var SEGOK = [1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1];
      for (i = 0; i < SEGOK.length; i++) {
        var sx = bx0 + i * 7;
        var sy = gy(sx, bz);
        // 木桩
        w.fill(sx, sy, bz - 3, sx, sy + 4, bz - 3, m('woodDark'));
        w.fill(sx, sy, bz + 3, sx, sy + 4, bz + 3, m('woodDark'));
        if (!SEGOK[i]) {
          w.fill(sx + 2, sy, bz - 2, sx + 5, sy, bz + 2, m('deadWood'));
          continue;
        }
        w.fill(sx, sy + 5, bz - 3, sx + 6, sy + 5, bz + 3, m('wood'));
        w.set(sx, sy + 6, bz - 3, m('woodDark'));
        w.set(sx, sy + 6, bz + 3, m('woodDark'));
        if (i % 4 === 0) LIB.streetLamp(w, sx, bz + 3, sy + 5, 'warm');
      }
      w.addLabel('废弃栈桥', bx0 + 30, gy(bx0 + 30, bz) + 10, bz, 'minor');
      // 搁浅小船 6 艘
      var boats = [[248, 936], [292, 918], [370, 1058], [222, 1050], [412, 934], [336, 1064]];
      for (i = 0; i < boats.length; i++) {
        LIB.wreck(w, boats[i][0], boats[i][1], gy(boats[i][0], boats[i][1]),
          9 + (i % 4) * 3, i % 2 ? 'x' : 'z', 0xB0 + i * 37,
          { hull: i % 2 ? m('woodDark') : m('rustMetal'), dark: m('rustDeep'), rad: 2.6, tilt: 0.10 });
      }
    })();

    w.addLabel('干涸海床', CX, LAY.ground + 40, Z0 - 12, 'site', '最后的海 · 搁浅巨轮与潟湖');
    return w;
  };
})(window);
