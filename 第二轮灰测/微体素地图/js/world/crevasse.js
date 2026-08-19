/* =====================================================================
   微体素地图 · 大裂缝（视觉核心：六阶深谷 + 岩浆湖 + 星实体 + 001 王座厅）
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, m = VX.m, LAY = VX.LAY, LIB = VX.LIB;

  VX.buildCrevasse = function (w) {
    var C = LAY.crevasse, CX = C.cx, CZ = C.cz, RX = C.rx, RZ = C.rz;
    var MESA = C.mesaY, FL = C.floorY;
    function gy(x, z) { var h = w.tH(x, z); return h < 0 ? LAY.ground : h + 1; }

    /* ---------------- 1. 六阶深谷开挖 ---------------- */
    var bands = [[0.905, MESA - 2], [0.800, 56], [0.700, 45], [0.590, 34],
                 [0.470, 23], [0.350, 12], [0.000, FL]];
    var wallMats = [[m('mesaRock'), m('mesaBand')], [m('mesaBand'), m('mesaPale')],
                    [m('stoneDark'), m('stone')], [m('stoneDark'), m('mesaBand')],
                    [m('obsidian'), m('stoneDark')], [m('obsidian'), m('darkMetal2')],
                    [m('ash'), m('obsidian')]];
    var x, z, i, k, t, tt, wob;
    for (z = CZ - RZ - 8; z <= CZ + RZ + 8; z++) {
      for (x = CX - RX - 8; x <= CX + RX + 8; x++) {
        if (x < 0 || z < 0 || x >= VX.SX || z >= VX.SZ) continue;
        var ii = z * VX.SX + x;
        if (w.H[ii] < 0) continue;
        var dx = (x - CX) / RX, dz = (z - CZ) / RZ;
        t = Math.sqrt(dx * dx + dz * dz);
        wob = (M.fbm(x * 0.028, z * 0.028, 3, 0xC7EF) - 0.5) * 0.13
            + (M.fbm(x * 0.09, z * 0.09, 2, 0x33A1) - 0.5) * 0.05;
        tt = t + wob;
        if (tt >= 0.985) continue;
        var band = bands.length - 1;
        for (i = 0; i < bands.length; i++) if (tt >= bands[i][0]) { band = i; break; }
        var ny = bands[band][1];
        // 阶面轻微起伏
        ny += Math.round((M.fbm(x * 0.13, z * 0.13, 2, 0x5A + band) - 0.5) * 2.4);
        if (ny >= w.H[ii]) continue;
        w.H[ii] = ny;
        w.Mt[ii] = wallMats[band][0];
        w.Mu[ii] = wallMats[band][1];
      }
    }
    w.tSmooth(CX - RX - 6, CZ - RZ - 6, CX + RX + 6, CZ + RZ + 6, 1);

    /* ---------------- 2. 岩浆湖 + 发光矿脉 + 蒸汽 ---------------- */
    // 谷底岩浆（体素层，发光并自动成为光源）
    for (z = CZ - RZ; z <= CZ + RZ; z++) {
      for (x = CX - RX; x <= CX + RX; x++) {
        if (x < 0 || z < 0 || x >= VX.SX || z >= VX.SZ) continue;
        var i2 = z * VX.SX + x;
        var h = w.H[i2];
        if (h < 0 || h > FL + 9) continue;
        var dxa = (x - CX) / RX, dza = (z - CZ) / RZ;
        var ta = Math.sqrt(dxa * dxa + dza * dza);
        if (ta > 0.50) continue;
        var n = M.fbm(x * 0.055, z * 0.055, 3, 0xB00B) + (0.50 - ta) * 0.55;
        if (Math.hypot(x - CX, z - CZ) < 24) continue;    // 星实体基座留空
        if (n > 0.46) w.set(x, h + 1, z, n > 0.66 ? m('lava') : m('magma'));
        else if (n > 0.36) w.set(x, h + 1, z, m('ember'));
      }
    }
    // 阶地上的熔岩溢流（从上层往下淌）
    for (i = 0; i < 10; i++) {
      var fa = i * 0.628 + 0.25;
      var sx0 = Math.round(CX + Math.cos(fa) * RX * 0.72);
      var sz0 = Math.round(CZ + Math.sin(fa) * RZ * 0.72);
      var ex0 = Math.round(CX + Math.cos(fa) * RX * 0.34);
      var ez0 = Math.round(CZ + Math.sin(fa) * RZ * 0.34);
      var steps = 26;
      for (k = 0; k <= steps; k++) {
        var t2 = k / steps;
        var px2 = Math.round(sx0 + (ex0 - sx0) * t2 + Math.sin(k * 0.7) * 2);
        var pz2 = Math.round(sz0 + (ez0 - sz0) * t2 + Math.cos(k * 0.6) * 2);
        var hh2 = w.tH(px2, pz2);
        if (hh2 < 0) continue;
        w.set(px2, hh2 + 1, pz2, k % 4 === 0 ? m('lava') : m('magma'));
        if (k % 3 === 0) { w.set(px2 + 1, hh2 + 1, pz2, m('ember')); w.set(px2, hh2 + 1, pz2 + 1, m('ember')); }
      }
    }
    // 崖壁发光矿脉
    w.scatter(CX - RX, CZ - RZ, CX + RX, CZ + RZ, 1500, 0x51E9, function (px, pz, rnd) {
      var dxb = (px - CX) / RX, dzb = (pz - CZ) / RZ;
      var tb = Math.sqrt(dxb * dxb + dzb * dzb);
      if (tb > 0.94 || tb < 0.30) return;
      var hh = w.tH(px, pz);
      if (hh < 0) return;
      var len = 2 + ((rnd() * 5) | 0);
      var mm = rnd() < 0.5 ? m('magmaCore') : (rnd() < 0.5 ? m('coreRed') : m('veinRed'));
      for (var k2 = 0; k2 < len; k2++) w.set(px + ((rnd() * 3) | 0) - 1, hh + 1 + k2, pz + ((rnd() * 3) | 0) - 1, mm);
    });
    // 阶地余烬散布（让每层台阶都有微光）
    w.scatter(CX - RX, CZ - RZ, CX + RX, CZ + RZ, 900, 0x7E31, function (px, pz, rnd) {
      var dxc2 = (px - CX) / RX, dzc2 = (pz - CZ) / RZ;
      var tc = Math.sqrt(dxc2 * dxc2 + dzc2 * dzc2);
      if (tc > 0.92 || tc < 0.26) return;
      var hh3 = w.tH(px, pz);
      if (hh3 < 0 || w.get(px, hh3 + 1, pz)) return;
      w.set(px, hh3 + 1, pz, rnd() < 0.4 ? m('ember') : (rnd() < 0.5 ? m('magma') : m('ash')));
    });
    // 蒸汽柱（叠加发光）
    w.scatter(CX - RX + 12, CZ - RZ + 10, CX + RX - 12, CZ + RZ - 10, 26, 0x77AA, function (px, pz, rnd) {
      var dxc = (px - CX) / RX, dzc = (pz - CZ) / RZ;
      if (Math.sqrt(dxc * dxc + dzc * dzc) > 0.8) return;
      var hh = w.tH(px, pz);
      if (hh < 0) return;
      var hgt = 10 + ((rnd() * 22) | 0);
      for (var k = 0; k < hgt; k++) {
        var rr = 1.0 + k * 0.10;
        w.disc(px + Math.round(Math.sin(k * 0.4) * 1.5), pz, rr, hh + 2 + k,
          k > hgt * 0.5 ? m('beamWarm') : m('beamRed'), Math.max(0, rr - 1.1));
      }
    });

    /* ---------------- 3. 星实体（谷底核心） ---------------- */
    (function () {
      var sx = C.star[0], sz = C.star[1];
      var baseY = w.tH(sx, sz);
      if (baseY < 0) baseY = FL;
      baseY += 1;
      // 基座骨刺环
      var k, a;
      for (k = 0; k < 8; k++) {
        a = k * Math.PI / 4;
        var bx = Math.round(sx + Math.cos(a) * 17), bz = Math.round(sz + Math.sin(a) * 17);
        w.line3(bx, baseY, bz, sx + Math.round(Math.cos(a) * 5), baseY + 16, sz + Math.round(Math.sin(a) * 5), m('boneWhite'), 1);
        w.sphere(bx, baseY + 1, bz, 2.6, m('chitin'), { yScale: 0.8 });
      }
      // 8 根须（伸向崖壁）
      for (k = 0; k < 8; k++) {
        a = k * Math.PI / 4 + Math.PI / 8;
        var ex = Math.round(sx + Math.cos(a) * 46), ez = Math.round(sz + Math.sin(a) * 34);
        var ey = w.tH(ex, ez); if (ey < 0) ey = FL;
        w.line3(sx, baseY + 2, sz, ex, ey + 2, ez, m('fleshDeep'), 1);
        w.line3(sx, baseY + 3, sz, Math.round((sx + ex) / 2), baseY + 9, Math.round((sz + ez) / 2), m('veinRed'));
      }
      // 纺锤主体 y+0..+34
      var prof = [[0, 6], [3, 10], [6, 13], [9, 15], [12, 16], [15, 15], [18, 13],
                  [21, 11], [24, 9], [27, 7], [30, 5], [33, 3], [36, 1.4]];
      for (k = 0; k < prof.length - 1; k++) {
        var y0 = baseY + prof[k][0], y1 = baseY + prof[k + 1][0];
        var r0 = prof[k][1], r1 = prof[k + 1][1];
        for (var y = y0; y < y1; y++) {
          var f = (y - y0) / Math.max(1, y1 - y0);
          var rr = r0 + (r1 - r0) * f;
          var mm = (y - baseY) % 6 === 0 ? m('bioMech') : m('starShell');
          w.disc(sx, sz, rr, y, mm, Math.max(0, rr - 2.6));
        }
      }
      // 星核（发光球）
      w.sphere(sx, baseY + 15, sz, 8, m('starCore'), { thick: 3, yScale: 1.0 });
      w.sphere(sx, baseY + 15, sz, 4, m('coreBlue'));
      // 六瓣
      for (k = 0; k < 6; k++) {
        a = k * Math.PI / 3;
        for (var s = 0; s <= 16; s++) {
          var ft = s / 16;
          var rad = 9 + Math.sin(ft * Math.PI) * 11;
          var yy = baseY + 15 + Math.round(ft * 18 - Math.sin(ft * Math.PI) * 4);
          var pxp = Math.round(sx + Math.cos(a) * rad), pzp = Math.round(sz + Math.sin(a) * rad);
          w.sphere(pxp, yy, pzp, 1.8 + (1 - ft) * 1.4, s % 4 === 0 ? m('coreBlue') : m('bioMechDark'), { yScale: 0.7 });
        }
      }
      // 冲天光柱（穿出峡谷，全图可见）
      LIB.lightPillar(w, sx, sz, baseY + 38, MESA + 60, 4.2, m('beamViolet'));
      w.fill(sx, baseY + 36, sz, sx, baseY + 46, sz, m('starCore'));
      w.addLabel('星实体', sx, baseY + 52, sz, 'poi', '大裂缝谷底核心 · 古登堡级决战');
    })();

    /* ---------------- 4. 001 王座厅（东壁凿入） ---------------- */
    (function () {
      var tx = C.throne[0], tz = C.throne[1];
      var y = w.tH(tx, tz); if (y < 0) y = FL; y += 1;
      var hx0 = tx - 14, hx1 = tx + 16, hz0 = tz - 15, hz1 = tz + 15;
      // 先把厅体范围挖空
      w.fill(hx0 - 1, y, hz0 - 1, hx1 + 1, y + 20, hz1 + 1, 0);
      for (var zz = hz0 - 1; zz <= hz1 + 1; zz++)
        for (var xx = hx0 - 1; xx <= hx1 + 1; xx++) {
          if (xx < 0 || zz < 0 || xx >= VX.SX || zz >= VX.SZ) continue;
          var ii = zz * VX.SX + xx;
          if (w.H[ii] > y - 1) { w.H[ii] = y - 1; w.Mt[ii] = m('obsidian'); w.Mu[ii] = m('darkMetal2'); }
        }
      // 厅体
      w.shell(hx0, y - 1, hz0, hx1, y + 16, hz1, m('obsidian'), m('darkMetal'), m('obsidian'));
      w.fill(hx0 + 1, y, hz0 + 1, hx1 - 1, y, hz1 - 1, m('marble'));
      // 柱列
      var c;
      for (c = 0; c < 5; c++) {
        var cxp = hx0 + 4 + c * 6;
        w.fill(cxp, y + 1, hz0 + 3, cxp, y + 15, hz0 + 3, m('quartzPillar'));
        w.fill(cxp, y + 1, hz1 - 3, cxp, y + 15, hz1 - 3, m('quartzPillar'));
        w.set(cxp, y + 15, hz0 + 3, m('goldTrim'));
        w.set(cxp, y + 15, hz1 - 3, m('goldTrim'));
        w.set(cxp, y + 13, hz0 + 2, m('neonViolet'));
        w.set(cxp, y + 13, hz1 - 2, m('neonViolet'));
      }
      // 王座台
      w.fill(tx + 8, y, tz - 5, tx + 14, y + 2, tz + 5, m('darkMetal'));
      w.fill(tx + 10, y + 3, tz - 3, tx + 14, y + 9, tz + 3, m('throneRed'));
      w.fill(tx + 13, y + 3, tz - 3, tx + 14, y + 12, tz + 3, m('obsidian'));
      w.set(tx + 12, y + 10, tz, m('coreRed'));
      w.fill(tx + 9, y + 3, tz - 4, tx + 9, y + 5, tz + 4, m('goldTrim'));
      w.tPaint(tx - 12, tz - 2, tx + 8, tz + 2, m('redCarpet'));
      // 门洞与门楣
      w.fill(hx0, y, tz - 4, hx0, y + 8, tz + 4, 0);
      w.fill(hx0 - 1, y + 9, tz - 6, hx0 - 1, y + 10, tz + 6, m('goldTrim'));
      w.text('001', hx0 - 2, y + 15, tz - 8, 'x', m('neonViolet'), { back: false });
      LIB.lightPillar(w, tx + 12, tz, y + 13, y + 30, 2.0, m('beamViolet'));
      w.addLabel('001 王座厅', tx, y + 24, tz, 'poi', '公主与真相');
    })();

    /* ---------------- 5. 崖壁隧道与休眠叫龙洞窟 ---------------- */
    (function () {
      var k, a;
      for (k = 0; k < 14; k++) {
        a = k * Math.PI / 7 + 0.2;
        var rr = 0.86;
        var px = Math.round(CX + Math.cos(a) * RX * rr), pz = Math.round(CZ + Math.sin(a) * RZ * rr);
        var y = w.tH(px, pz); if (y < 0) continue; y += 1;
        var inx = Math.round(-Math.cos(a) * 7), inz = Math.round(-Math.sin(a) * 7);
        w.fill(px - 2, y, pz - 2, px + 2, y + 5, pz + 2, 0);
        w.fill(px + inx - 2, y, pz + inz - 2, px + inx + 2, y + 5, pz + inz + 2, 0);
        LIB.perim(w, px - 3, pz - 3, px + 3, pz + 3, y + 6, m('darkMetal'));
        w.set(px, y + 7, pz, m('neonAmber'));
        w.set(px + inx, y + 2, pz + inz, m('coreRed'));
      }
      // 3 处休眠叫龙（洞窟内）
      var caves = [[CX - 68, CZ - 34], [CX + 62, CZ - 40], [CX - 40, CZ + 52]];
      for (k = 0; k < 3; k++) {
        var cx2 = caves[k][0], cz2 = caves[k][1];
        var cy = w.tH(cx2, cz2); if (cy < 0) continue; cy += 1;
        LIB.bones(w, cx2 - 10, cz2, cy, 22, 'x', 0x3301 + k * 97, { arch: 5, rib: 6 });
        w.sphere(cx2 + 2, cy + 3, cz2, 4, m('fleshDeep'), { yScale: 0.7 });
        w.set(cx2 + 2, cy + 6, cz2, m('coreRed'));
        LIB.rubblePile(w, cx2 - 14, cz2 + 6, cy, 3.4, 700 + k);
      }
    })();

    /* ---------------- 6. 崖缘设施（观测站 · 栈道 · 吊桥 · 探照灯） ---------------- */
    (function () {
      var k, a, px, pz, y;
      // 警戒柱环（沿崖缘，霓虹护栏）
      for (k = 0; k < 56; k++) {
        a = k * Math.PI / 28;
        px = Math.round(CX + Math.cos(a) * (RX + 5));
        pz = Math.round(CZ + Math.sin(a) * (RZ + 5));
        y = gy(px, pz);
        if (w.tH(px, pz) < MESA - 12) continue;
        w.fill(px, y, pz, px, y + 3, pz, m('steelDark'));
        w.set(px, y + 4, pz, k % 4 === 0 ? m('neonRed') : m('neonAmber'));
        if (k % 4 === 0) LIB.searchlight(w, px, pz, y, 6, [-Math.cos(a) * 0.55, 0.55, -Math.sin(a) * 0.55], m('beamRed'));
      }
      // 北缘观测站（对接对角放射路）
      var sx = C.rim[0], sz = C.rim[1] - 6;
      y = gy(sx, sz);
      VX._flatRect(sx - 26, sz - 16, sx + 26, sz + 14, y - 1, 10, m('paveDark'), m('concreteDark'));
      y = gy(sx, sz);
      LIB.plaza(w, sx - 24, sz - 14, sx + 24, sz + 8, y, { pave: m('paveDark'), alt: m('asphaltWorn'), planters: false });
      w.fill(sx - 16, y, sz - 12, sx - 2, y + 12, sz + 2, m('concrete'));
      LIB.facade(w, sx - 16, sz - 12, sx - 2, sz + 2, y, y + 12,
        { body: m('concrete'), win: m('windowCool'), mullion: m('steelDark'), belt: m('hazard'),
          mulEvery: 3, beltEvery: 2, neon: m('neonAmber'), neonEvery: 2 });
      LIB.roofScape(w, sx - 16, sz - 12, sx - 2, sz + 2, y + 13, 2, 0x99A);
      LIB.holoBoard(w, sx + 2, y + 5, sz - 12, 'z', 14, 8, m('holoGreen'), -1);
      LIB.neonSign(w, sx - 14, y + 16, sz + 3, 'z', 'RIM-1', m('neonAmber'), {});
      // 观景挑台（伸出崖外）
      w.fill(sx - 6, y, sz + 9, sx + 6, y, sz + 26, m('grate'));
      LIB.perim(w, sx - 6, sz + 9, sx + 6, sz + 26, y + 1, m('steelDark'));
      LIB.perimDots(w, sx - 6, sz + 9, sx + 6, sz + 26, y + 2, 3, m('neonCyan'));
      for (k = 0; k < 4; k++) {
        w.fill(sx - 6 + k * 4, y - 1, sz + 26, sx - 6 + k * 4, y - 8, sz + 26, m('girder'));
      }
      w.addLabel('大裂缝边缘观测站', sx, y + 20, sz, 'poi', '崖缘警戒与栈道入口');
      w.addLabel('大裂缝', CX, MESA + 40, CZ - RZ - 30, 'site', '六阶深谷 · 岩浆湖 · 星实体');

      // 横跨吊桥（南北向，跨越整条裂缝）
      var by = MESA + 6;
      var bz0 = CZ - RZ - 10, bz1 = CZ + RZ + 10;
      w.fill(CX - 3, by, bz0, CX + 3, by, bz1, m('wood'));
      for (var zz = bz0; zz <= bz1; zz++) {
        w.set(CX - 4, by + 1, zz, m('wire'));
        w.set(CX + 4, by + 1, zz, m('wire'));
        if ((zz - bz0) % 5 === 0) {
          w.fill(CX - 4, by + 1, zz, CX - 4, by + 4, zz, m('steelDark'));
          w.fill(CX + 4, by + 1, zz, CX + 4, by + 4, zz, m('steelDark'));
          w.set(CX - 4, by + 5, zz, m('neonCyan'));
          w.set(CX + 4, by + 5, zz, m('neonCyan'));
        }
      }
      // 桥塔
      for (k = 0; k < 2; k++) {
        var tz2 = k ? bz1 - 2 : bz0 + 2;
        w.fill(CX - 6, gy(CX - 6, tz2), tz2, CX - 6, by + 18, tz2, m('steel'));
        w.fill(CX + 6, gy(CX + 6, tz2), tz2, CX + 6, by + 18, tz2, m('steel'));
        w.fill(CX - 6, by + 18, tz2, CX + 6, by + 18, tz2, m('steel'));
        w.set(CX, by + 19, tz2, m('neonRed'));
      }
      // 主索
      w.line3(CX - 6, by + 17, bz0 + 2, CX - 6, by + 8, CZ, m('wire'));
      w.line3(CX - 6, by + 8, CZ, CX - 6, by + 17, bz1 - 2, m('wire'));
      w.line3(CX + 6, by + 17, bz0 + 2, CX + 6, by + 8, CZ, m('wire'));
      w.line3(CX + 6, by + 8, CZ, CX + 6, by + 17, bz1 - 2, m('wire'));
      w.addLabel('裂缝吊桥', CX, by + 22, CZ - RZ, 'minor');

      // 下降井 + 螺旋坡道（西缘 → 谷底）
      var wx = CX - RX + 14, wz = CZ;
      var steps = 44;
      for (k = 0; k < steps; k++) {
        var ang = k * 0.42;
        var rr = 15 - k * 0.10;
        var yy = MESA - 2 - Math.round(k * ((MESA - FL - 4) / steps));
        var rx2 = Math.round(wx + Math.cos(ang) * rr), rz2 = Math.round(wz + Math.sin(ang) * rr);
        w.fill(rx2 - 1, yy, rz2 - 1, rx2 + 1, yy, rz2 + 1, m('grate'));
        w.set(rx2, yy + 1, rz2, m('steelDark'));
        if (k % 4 === 0) w.set(rx2, yy + 2, rz2, m('neonAmber'));
      }
      w.addLabel('下降井坡道', wx, MESA + 4, wz, 'minor');

      /* 外环路被裂缝切断处：警示围挡 + 断路牌（动线诚实交代） */
      var cuts = [[996, 916, 'x'], [872, 1013, 'z']];
      for (k = 0; k < 2; k++) {
        var bx2 = cuts[k][0], bz2 = cuts[k][1], axis = cuts[k][2];
        var byy = gy(bx2, bz2);
        var q;
        for (q = -7; q <= 7; q++) {
          var qx = axis === 'x' ? bx2 + q : bx2, qz = axis === 'x' ? bz2 : bz2 + q;
          w.fill(qx, byy, qz, qx, byy + 2, qz, (q + 7) % 4 < 2 ? m('hazard') : m('hazardDark'));
          if (q % 3 === 0) w.set(qx, byy + 3, qz, m('neonAmber'));
        }
        w.fill(bx2 - 1, byy + 4, bz2 - (axis === 'x' ? 2 : 0), bx2 + 1, byy + 4, bz2 + (axis === 'x' ? -2 : 0), m('steelDark'));
        w.text('X', bx2 - 2, byy + 9, bz2 - (axis === 'x' ? 3 : 0), axis === 'x' ? 'z' : 'x', m('neonRed'));
        LIB.searchlight(w, bx2 + (axis === 'x' ? 9 : 0), bz2 + (axis === 'x' ? 0 : 9), byy, 8,
          axis === 'x' ? [-0.6, 0.55, 0.3] : [0.3, 0.55, -0.6], m('beamRed'));
        w.addLabel('外环断路口', bx2, byy + 12, bz2, 'minor', '裂缝切断环路');
      }
    })();

    return w;
  };
})(window);
