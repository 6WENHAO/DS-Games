/* =====================================================================
   微体素地图 · 荒野站点与散落残骸
   叫龙残骸·巨兽 / 岩浆泵站 / 前哨站 KZ-9 / 三座警戒哨塔（中轴对称）
   第26种植园 / 第7种植园遗址（倾覆巨物） / 回忆之境浮空岛 / 出击区战场
   高架轨道桥（东西两条对称线）/ 全图散落残骸 45+
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, m = VX.m, LAY = VX.LAY, LIB = VX.LIB;

  VX.buildWilds = function (w) {
    function gy(x, z) { var h = w.tH(x, z); return h < 0 ? LAY.ground : h + 1; }
    var i, k, x, z, y, a;

    /* =================================================================
       1. 叫龙残骸 · 巨兽（散落残骸的主角）
       ================================================================= */
    (function () {
      var px = LAY.bonesGiant[0], pz = LAY.bonesGiant[1];
      var y0 = gy(px, pz);
      VX._flatRect(px - 36, pz - 30, px + 36, pz + 30, y0 - 1, 16, m('sandDark'), m('sand'));
      y0 = gy(px, pz);
      // 主骨架：长 70，沿 Z 走向
      var spine = LIB.bones(w, px, pz - 34, y0, 68, 'z', 0xD1A6, { arch: 13, rib: 15 });
      // 加强：更多肋骨对（共 13 对）与外露机械件
      for (i = 2; i < spine.length - 1; i++) {
        var sp = spine[i];
        if (i % 2 !== 0) continue;
        var t = i / spine.length;
        var rl = 9 + Math.sin(t * Math.PI) * 8;
        for (var sgn = -1; sgn <= 1; sgn += 2) {
          for (k = 1; k <= rl; k++) {
            var kt = k / rl;
            var bxx = Math.round(sp[0] + sgn * k * 0.98);
            var byy = Math.round(sp[1] - kt * kt * rl * 0.92);
            if (byy <= y0 - 2) break;
            w.set(bxx, byy, sp[2], k % 5 === 0 ? m('boneOld') : m('boneWhite'));
          }
        }
        if (i % 6 === 0) {
          w.fill(sp[0] - 2, sp[1] + 1, sp[2] - 2, sp[0] + 2, sp[1] + 3, sp[2] + 2, m('bioMechDark'));
          w.fill(sp[0] - 1, sp[1] + 4, sp[2] - 1, sp[0] + 1, sp[1] + 4, sp[2] + 1, m('bioMech'));
          w.set(sp[0], sp[1] + 5, sp[2], m('veinRed'));
        }
      }
      // 断裂肋骨插进地里
      var brnd = M.rng(0x5B01);
      for (i = 0; i < 7; i++) {
        var ba = brnd() * 6.283, bd = 14 + brnd() * 16;
        var ex = Math.round(px + Math.cos(ba) * bd), ez = Math.round(pz + Math.sin(ba) * bd);
        w.line3(ex, gy(ex, ez) - 1, ez, ex + Math.round(Math.cos(ba) * 5), gy(ex, ez) + 9 + ((brnd() * 6) | 0), ez + Math.round(Math.sin(ba) * 4), m('boneWhite'), 1);
      }
      // 余烬与风蚀沙丘
      for (i = 0; i < 9; i++) {
        var ea = i * 0.698;
        var exx = Math.round(px + Math.cos(ea) * (10 + i)), ezz = Math.round(pz + Math.sin(ea) * (8 + i));
        w.set(exx, gy(exx, ezz), ezz, i % 3 === 0 ? m('magmaCore') : m('ember'));
      }
      w.scatter(px - 34, pz - 30, px + 34, pz + 30, 12, 0x5B77, function (sx, sz, rn) {
        w.tCrater(sx, sz, 7 + rn() * 7, 1 + ((rn() * 2) | 0), 6, m('dune'));
      });
      // 采样管线缠绕骨骼 + 悬挂脚手架 + 扫描光幕
      LIB.pipes(w, [[px - 8, pz - 24], [px - 8, pz + 4], [px + 6, pz + 4], [px + 6, pz + 26]], y0 + 7, m('rustMetal'));
      for (i = 0; i < 5; i++) {
        var fz = pz - 22 + i * 11;
        w.fill(px - 14, y0, fz, px - 14, y0 + 13, fz, m('girder'));
        w.fill(px + 14, y0, fz, px + 14, y0 + 13, fz, m('girder'));
        w.fill(px - 14, y0 + 13, fz, px + 14, y0 + 13, fz, m('girder'));
        w.fill(px - 13, y0 + 12, fz, px - 9, y0 + 12, fz, m('grate'));
        w.fill(px + 9, y0 + 12, fz, px + 13, y0 + 12, fz, m('grate'));
        if (i % 2 === 0) w.set(px - 14, y0 + 14, fz, m('neonAmber'));
      }
      LIB.holoBoard(w, px - 12, y0 + 4, pz - 30, 'z', 10, 8, m('holoGreen'), -1);
      LIB.holoBoard(w, px + 16, y0 + 3, pz + 8, 'x', 8, 7, m('holoScreen'), 1);
      // 考察营地
      var cxa = px + 24, cza = pz - 14;
      LIB.fenceWall(w, [[cxa - 9, cza - 8], [cxa + 9, cza - 8], [cxa + 9, cza + 10], [cxa - 9, cza + 10], [cxa - 9, cza - 8]],
        gy(cxa, cza), 3, m('grate'), { postEvery: 5, neon: m('neonAmber'), gaps: [[cxa - 9, cza + 2, 3]] });
      w.tPaint(cxa - 8, cza - 7, cxa + 8, cza + 9, m('gravel'));
      for (i = 0; i < 3; i++) {
        var tx = cxa - 6 + i * 6, tz = cza - 4;
        w.fill(tx - 2, gy(tx, tz), tz - 2, tx + 2, gy(tx, tz) + 3, tz + 2, m('tarp'));
        w.fill(tx - 3, gy(tx, tz) + 4, tz - 3, tx + 3, gy(tx, tz) + 4, tz + 3, m('woodDark'));
        w.set(tx, gy(tx, tz) + 5, tz, m('lampWarm'));
      }
      LIB.container(w, cxa - 7, cza + 5, gy(cxa - 7, cza + 5), 'x', m('mechaBlue'));
      LIB.container(w, cxa + 1, cza + 5, gy(cxa + 1, cza + 5), 'x', m('rustMetal'));
      LIB.searchlight(w, cxa + 8, cza - 6, gy(cxa + 8, cza - 6), 12, [-0.62, 0.5, 0.3], m('beamCyan'));
      LIB.searchlight(w, px - 26, pz + 20, gy(px - 26, pz + 20), 12, [0.6, 0.5, -0.3], m('beamCyan'));
      w.addLabel('叫龙残骸 · 巨兽', px, y0 + 30, pz, 'site', '68 格巨型骨架 · 考察营地');
    })();

    /* =================================================================
       2. 岩浆泵站 MP-4
       ================================================================= */
    (function () {
      var px = LAY.pumpStation[0], pz = LAY.pumpStation[1];
      var y = gy(px, pz);
      VX._flatRect(px - 28, pz - 26, px + 28, pz + 26, y - 1, 12, m('asphaltWorn'), m('concreteDark'));
      y = gy(px, pz);
      // 主泵房
      w.fill(px - 18, y, pz - 12, px - 2, y + 13, pz + 4, m('steelDark'));
      LIB.facade(w, px - 18, pz - 12, px - 2, pz + 4, y, y + 13,
        { body: m('steelDark'), win: m('windowDim'), mullion: m('girder'), belt: m('hazard'), mulEvery: 4, beltEvery: 3 });
      for (i = 0; i < 3; i++) w.fill(px - 17 + i * 6, y + 14, pz - 12, px - 15 + i * 6, y + 16, pz + 4, m('rustMetal'));
      LIB.roofScape(w, px - 18, pz - 12, px - 2, pz + 4, y + 17, 1, 0x4B4);
      // 储罐 ×4
      LIB.tank(w, px + 8, pz - 14, y, 5.4, 11, {});
      LIB.tank(w, px + 20, pz - 12, y, 4.4, 9, {});
      LIB.tank(w, px + 16, pz + 2, y, 4.8, 10, {});
      LIB.tank(w, px + 4, pz + 6, y, 3.6, 8, {});
      // 烟囱 ×2
      LIB.stack(w, px - 20, pz + 12, y, 3, 28);
      LIB.stack(w, px - 10, pz + 14, y, 2.4, 22);
      // 岩浆池
      w.tCrater(px + 2, pz + 20, 12, -4, 5, m('scorch'));
      var ly = gy(px + 2, pz + 20);
      w.disc(px + 2, pz + 20, 10, ly, m('magma'));
      w.disc(px + 2, pz + 20, 7, ly, m('lava'));
      w.disc(px + 2, pz + 20, 11.4, ly, m('hazardDark'), 10);
      for (i = 0; i < 8; i++) {
        a = i * 0.785;
        var vx = Math.round(px + 2 + Math.cos(a) * 12), vz = Math.round(pz + 20 + Math.sin(a) * 12);
        w.fill(vx, gy(vx, vz), vz, vx, gy(vx, vz) + 1, vz, m('hazard'));
        if (i % 2 === 0) for (k = 0; k < 6; k++) w.disc(vx, vz, 0.8 + k * 0.2, gy(vx, vz) + 2 + k, m('beamWarm'), 0);
      }
      // 管廊网
      LIB.pipes(w, [[px - 2, pz - 6], [px + 8, pz - 6], [px + 8, pz - 14]], y + 5, m('rustMetal'));
      LIB.pipes(w, [[px - 2, pz], [px + 16, pz], [px + 16, pz + 2]], y + 7, m('steelDark'));
      LIB.pipes(w, [[px - 10, pz + 4], [px - 10, pz + 16], [px + 2, pz + 16]], y + 4, m('rustDeep'));
      // 输送带
      w.ramp(px - 2, pz + 8, px + 12, pz + 16, y + 2, y + 8, 3, m('grate'));
      // 控制塔
      w.fill(px + 22, y, pz + 14, px + 26, y + 16, pz + 18, m('concrete'));
      w.fill(px + 21, y + 17, pz + 13, px + 27, y + 21, pz + 19, m('whitePanel2'));
      w.fill(px + 21, y + 19, pz + 12, px + 27, y + 20, pz + 12, m('glassCyan'));
      LIB.holoBoard(w, px + 20, y + 8, pz + 13, 'x', 6, 6, m('holoScreen'), -1);
      w.set(px + 24, y + 22, pz + 16, m('neonRed'));
      LIB.neonSign(w, px - 16, y + 17, pz - 13, 'z', 'MP-4', m('neonAmber'), { dir: -1 });
      w.addLabel('岩浆泵站 MP-4', px, y + 32, pz, 'site', '真相伏笔 · 岩浆抽取');
    })();

    /* =================================================================
       3. 前哨站 KZ-9
       ================================================================= */
    (function () {
      var px = LAY.watchEastOut[0], pz = LAY.watchEastOut[1];
      var y = gy(px, pz);
      VX._flatRect(px - 26, pz - 24, px + 26, pz + 24, y - 1, 12, m('gravel'), m('concreteDark'));
      y = gy(px, pz);
      LIB.fenceWall(w, [[px - 22, pz - 20], [px + 22, pz - 20], [px + 22, pz + 20], [px - 22, pz + 20], [px - 22, pz - 20]],
        y, 4, m('concreteDark'), { postEvery: 7, neon: m('neonAmber'), cap: m('hazard'),
          gaps: [[px - 22, pz, 4], [px, pz + 20, 4]] });
      LIB.gateArch(w, px - 22, pz, y, 12, 8, 'KZ-9', { axis: 'x', post: m('concreteDark'), beam: m('hazard'), neon: m('neonAmber') });
      w.tPaint(px - 21, pz - 3, px + 21, pz + 3, m('asphaltWorn'));
      // 双层营房 ×2
      for (i = 0; i < 2; i++) {
        var bx = px - 14 + i * 20, bz = pz - 13;
        LIB.podium(w, bx - 6, bz - 5, bx + 6, bz + 5, y, 2,
          { body: m('concrete'), glass: m('glassClear'), win: m('windowWarm'), roof: 1 });
      }
      // 瞭望塔
      w.fill(px + 16, y, pz + 12, px + 20, y + 18, pz + 16, m('girder'));
      w.fill(px + 15, y + 19, pz + 11, px + 21, y + 23, pz + 17, m('concrete'));
      LIB.perim(w, px + 15, pz + 11, px + 21, pz + 17, y + 21, m('glassCyan'));
      w.fill(px + 15, y + 24, pz + 11, px + 21, y + 24, pz + 17, m('steelDark'));
      w.set(px + 18, y + 25, pz + 14, m('neonRed'));
      LIB.searchlight(w, px + 18, pz + 14, y + 24, 2, [-0.6, 0.45, -0.6], m('beamCyan'));
      // 停机坪
      w.disc(px - 10, pz + 12, 7, y, m('asphalt'));
      w.disc(px - 10, pz + 12, 6, y, m('paveDark'));
      w.disc(px - 10, pz + 12, 6, y, m('roadLineWarm'), 4.8);
      w.text('H', px - 12, y + 3, pz + 12, 'z', m('roadLine'));
      for (i = 0; i < 8; i++) {
        a = i * 0.785;
        w.set(Math.round(px - 10 + Math.cos(a) * 8), y, Math.round(pz + 12 + Math.sin(a) * 8), m('neonAmber'));
      }
      // 补给堆场（集装箱阵）
      for (i = 0; i < 6; i++) {
        LIB.container(w, px + 2 + (i % 3) * 4, pz - 6 + ((i / 3) | 0) * 9, y, 'z',
          [m('mechaGreen'), m('rustMetal'), m('mechaBlue')][i % 3]);
      }
      // 沙袋掩体
      for (i = 0; i < 12; i++) {
        var sx = px - 20 + i * 3;
        w.fill(sx, y, pz - 22, sx + 1, y + 1, pz - 21, m('sandDark'));
        if (i % 3 === 0) w.set(sx, y + 2, pz - 22, m('hazard'));
      }
      LIB.vehicle(w, px - 4, pz + 2, y, 'x', 0x991);
      LIB.wreck(w, px + 10, pz + 22, y, 10, 'x', 0x992, { rad: 2.4, tilt: 0.06 });
      w.addLabel('前哨站 KZ-9', px, y + 30, pz, 'site', '莫霍级伏击');
    })();

    /* =================================================================
       4. 三座警戒哨塔（NW/NE 严格对称）
       ================================================================= */
    function watchtower(px, pz, h, seed, name) {
      var y = gy(px, pz);
      VX._flatRect(px - 12, pz - 12, px + 12, pz + 12, y - 1, 8, m('gravel'), m('concreteDark'));
      y = gy(px, pz);
      // 底座
      w.fill(px - 6, y, pz - 6, px + 6, y + 3, pz + 6, m('concreteDark'));
      LIB.perim(w, px - 6, pz - 6, px + 6, pz + 6, y + 4, m('hazard'));
      // 桁架塔身
      for (i = 0; i <= h; i++) {
        var rr = 4 - (i / h) * 1.6;
        var rx = Math.round(rr);
        w.set(px - rx, y + 4 + i, pz - rx, m('girder'));
        w.set(px + rx, y + 4 + i, pz - rx, m('girder'));
        w.set(px - rx, y + 4 + i, pz + rx, m('girder'));
        w.set(px + rx, y + 4 + i, pz + rx, m('girder'));
        if (i % 5 === 0) LIB.perim(w, px - rx, pz - rx, px + rx, pz + rx, y + 4 + i, m('steelDark'));
        if (i % 10 === 5) LIB.perim(w, px - rx, pz - rx, px + rx, pz + rx, y + 4 + i, m('hazard'));
      }
      // 中段设备平台
      var my = y + 4 + Math.round(h * 0.55);
      w.fill(px - 5, my, pz - 5, px + 5, my, pz + 5, m('grate'));
      LIB.perim(w, px - 5, pz - 5, px + 5, pz + 5, my + 1, m('steelDark'));
      w.fill(px + 3, my + 1, pz + 3, px + 4, my + 3, pz + 4, m('darkMetal'));
      w.set(px + 3, my + 4, pz + 3, m('neonAmber'));
      // 顶部观察舱
      var ty = y + 5 + h;
      w.fill(px - 5, ty, pz - 5, px + 5, ty + 1, pz + 5, m('concrete'));
      w.fill(px - 5, ty + 2, pz - 5, px + 5, ty + 4, pz + 5, m('whitePanel2'));
      LIB.perim(w, px - 5, pz - 5, px + 5, pz + 5, ty + 3, m('glassCyan'));
      w.fill(px - 5, ty + 5, pz - 5, px + 5, ty + 5, pz + 5, m('steelDark'));
      LIB.perimDots(w, px - 5, pz - 5, px + 5, pz + 5, ty + 6, 3, m('neonRed'), seed & 1);
      // 雷达碟
      w.fill(px, ty + 6, pz, px, ty + 9, pz, m('steel'));
      w.disc(px, pz, 3, ty + 10, m('whitePanel'));
      w.disc(px, pz, 1.4, ty + 11, m('steelDark'));
      w.set(px, ty + 12, pz, m('neonRed'));
      // 拉索
      w.line3(px, ty, pz, px + 9, y + 1, pz + 9, m('wire'));
      w.line3(px, ty, pz, px - 9, y + 1, pz - 9, m('wire'));
      w.line3(px, ty - 6, pz, px + 9, y + 1, pz - 9, m('wire'));
      w.line3(px, ty - 6, pz, px - 9, y + 1, pz + 9, m('wire'));
      LIB.searchlight(w, px + 6, pz, ty, 1, [0.75, 0.35, 0.2], m('beamCyan'));
      w.addLabel(name, px, ty + 16, pz, 'site', '警戒哨塔');
    }
    watchtower(LAY.watchWest[0], LAY.watchWest[1], 30, 0x11, '警戒哨塔 · 西');
    watchtower(LAY.watchNW[0], LAY.watchNW[1], 26, 0x12, '警戒哨塔 · 北西');
    watchtower(LAY.watchNE[0], LAY.watchNE[1], 26, 0x13, '警戒哨塔 · 北东');

    /* =================================================================
       5. 第26种植园（小型种植园）
       ================================================================= */
    (function () {
      var P = LAY.p26, px = P.cx, pz = P.cz, R = P.r;
      var y = gy(px, pz);
      w.tPaintDisc(px, pz, R, m('pave'), 0, m('concrete'));
      w.tPaintDisc(px, pz, R - 16, m('whiteTile'), 0, m('marble'));
      // 环形围墙
      var pts = [];
      for (k = 0; k <= 48; k++) { a = k * Math.PI / 24; pts.push([Math.round(px + Math.cos(a) * R), Math.round(pz + Math.sin(a) * R)]); }
      LIB.fenceWall(w, pts, y, 6, m('whitePanel2'),
        { postEvery: 7, neon: m('neonCyan'), cap: m('steelDark'),
          gaps: [[px, pz - R, 6], [px, pz + R, 6], [px - R, pz, 6], [px + R, pz, 6]] });
      // 十字街
      w.tRoad([[px, pz - R], [px, pz + R]], 8, m('asphalt'), { curb: m('curb') });
      w.tRoad([[px - R, pz], [px + R, pz]], 8, m('asphalt'), { curb: m('curb') });
      // 穹顶骨架（只做经纬骨架）
      var dr = R - 6, apex = 44;
      for (var mi = 0; mi < 16; mi++) {
        var ma = mi * Math.PI / 8;
        for (var t = 0; t <= 30; t++) {
          var ang = (t / 30) * Math.PI / 2;
          w.set(Math.round(px + Math.cos(ma) * dr * Math.cos(ang)), Math.round(y + apex * Math.sin(ang)),
            Math.round(pz + Math.sin(ma) * dr * Math.cos(ang)), mi % 4 === 0 ? m('steel') : m('steelDark'));
        }
      }
      for (i = 1; i <= 3; i++) {
        var ra = (i / 4) * Math.PI / 2;
        var rr2 = dr * Math.cos(ra), y2 = Math.round(y + apex * Math.sin(ra));
        w.ring(px, pz, rr2 - 0.6, rr2 + 0.6, y2, y2, i % 2 ? m('steelDark') : m('neonCyan'));
      }
      w.fill(px, y + apex, pz, px, y + apex + 4, pz, m('steel'));
      w.set(px, y + apex + 5, pz, m('neonWhite'));
      // 地标塔
      w.fill(px - 5, y, pz - 5, px + 5, y + 40, pz + 5, m('whitePanel'));
      LIB.facade(w, px - 5, pz - 5, px + 5, pz + 5, y, y + 40,
        { body: m('whitePanel'), win: m('windowGold'), mullion: m('concrete'), belt: m('goldTrim'),
          mulEvery: 3, beltEvery: 3, neon: m('neonCyan'), neonEvery: 3 });
      LIB.roofScape(w, px - 5, pz - 5, px + 5, pz + 5, y + 41, 2, 0x26A);
      // 16 栋小楼（四象限对称）
      var idx = 0;
      for (var q = 0; q < 4; q++) {
        for (k = 0; k < 4; k++) {
          var qa = q * Math.PI / 2 + Math.PI / 4 + (k % 2 ? 0.36 : -0.36);
          var qr = 22 + ((k / 2) | 0) * 16;
          var bxx = Math.round(px + Math.cos(qa) * qr), bzz = Math.round(pz + Math.sin(qa) * qr);
          var hf = 4 + (k % 2);
          LIB.streetBlock(w, bxx - hf, bzz - hf, bxx + hf, bzz + hf, gy(bxx, bzz),
            0x2600 + idx * 61, { minStory: 3, maxStory: 7 });
          idx++;
        }
      }
      // 8 栋外环小屋 + 4 座水塔（补密度）
      for (k = 0; k < 8; k++) {
        var oa = k * Math.PI / 4 + 0.39;
        var oxx = Math.round(px + Math.cos(oa) * 46), ozz = Math.round(pz + Math.sin(oa) * 46);
        LIB.podium(w, oxx - 4, ozz - 4, oxx + 4, ozz + 4, gy(oxx, ozz), 1 + (k % 2),
          { body: k % 2 ? m('whitePanel2') : m('concreteWarm'), glass: m('glassCyan'),
            win: m('windowWarm'), trim: m('copperPatina'), roof: k % 4 });
      }
      for (k = 0; k < 4; k++) {
        var wa = k * Math.PI / 2 + Math.PI / 4;
        var wxx = Math.round(px + Math.cos(wa) * 34), wzz = Math.round(pz + Math.sin(wa) * 34);
        var wy2 = gy(wxx, wzz);
        w.fill(wxx - 2, wy2, wzz - 2, wxx + 2, wy2 + 10, wzz + 2, m('girder'));
        w.cyl(wxx, wzz, 4, wy2 + 11, wy2 + 16, m('steel'));
        w.disc(wxx, wzz, 4.4, wy2 + 17, m('steelDark'));
        w.set(wxx, wy2 + 18, wzz, m('neonAmber'));
        LIB.pipes(w, [[wxx, wzz + 4], [wxx, wzz + 12]], wy2 + 11, m('rustMetal'));
      }
      // 中央塔前小广场
      LIB.plaza(w, px - 12, pz + 8, px + 12, pz + 20, gy(px, pz + 14),
        { pave: m('whiteTile'), alt: m('paveDark'), lampEvery: 7 });
      // 农田条带
      for (i = -3; i <= 3; i++) {
        w.tPaint(px - 14, pz + R - 20 + i * 2, px + 14, pz + R - 20 + i * 2, i % 2 ? m('crop') : m('cropRow'));
      }
      // 移动底盘：履带 + 支撑腿
      for (k = 0; k < 6; k++) {
        a = k * Math.PI / 3 + 0.3;
        var lx = Math.round(px + Math.cos(a) * (R + 4)), lz = Math.round(pz + Math.sin(a) * (R + 4));
        var lgy2 = gy(lx, lz);
        w.fill(lx - 3, lgy2, lz - 3, lx + 3, lgy2 + 3, lz + 3, m('darkMetal'));
        w.fill(lx - 4, lgy2, lz - 4, lx + 4, lgy2 + 1, lz + 4, m('girder'));
        w.set(lx, lgy2 + 4, lz, m('neonAmber'));
      }
      w.ring(px, pz, R + 1, R + 3, y - 1, y + 2, m('darkMetal2'));
      w.addLabel('第26种植园', px, y + apex + 12, pz, 'site', '满的试验 · 姊妹种植园');
    })();

    /* =================================================================
       6. 第7种植园遗址（倾覆的巨物）
       ================================================================= */
    (function () {
      var px = LAY.p7ruin.cx, pz = LAY.p7ruin.cz;
      var y = gy(px, pz);
      VX._flatRect(px - 46, pz - 40, px + 46, pz + 40, y - 1, 16, m('sandDark'), m('sand'));
      y = gy(px, pz);
      w.tPaintDisc(px, pz, 42, m('scorch'), 0, m('sandDark'));
      w.tPaintDisc(px, pz, 30, m('ash'), 0, m('scorch'));
      // 破碎的底盘环（半圈残留）
      for (k = 0; k < 40; k++) {
        a = -0.5 + k * 0.062;
        if (M.hash3(k, 7, 3) < 0.28) continue;
        var rx = Math.round(px + Math.cos(a) * 40), rz = Math.round(pz + Math.sin(a) * 40);
        w.fill(rx, gy(rx, rz), rz, rx, gy(rx, rz) + 4 + ((M.hash3(k, 1, 2) * 5) | 0), rz, m('rustMetal'));
        if (k % 6 === 0) w.set(rx, gy(rx, rz) + 10, rz, m('neonFlickRed'));
      }
      // 半个断裂穹顶骨架斜插进地面
      for (var mi = 0; mi < 14; mi++) {
        var ma = -0.9 + mi * 0.20;
        for (var t = 0; t <= 26; t++) {
          var ang = (t / 26) * Math.PI / 2;
          // 整体绕 X 轴倾覆 ~55°
          var lx = Math.cos(ma) * 34 * Math.cos(ang);
          var lz = Math.sin(ma) * 34 * Math.cos(ang);
          var ly = 34 * Math.sin(ang);
          var ry = ly * 0.55 - lz * 0.82;
          var rz2 = ly * 0.82 + lz * 0.55;
          if (ry < 0) continue;
          if (M.hash3(mi, t, 5) < 0.14) continue;
          w.set(Math.round(px + lx), Math.round(y + ry), Math.round(pz + rz2 - 6),
            mi % 4 === 0 ? m('steel') : m('steelDark'));
        }
      }
      // 倒塌的中央塔（横躺）
      LIB.wreck(w, px - 34, pz + 16, y, 46, 'x', 0x7C01,
        { hull: m('whitePanel2'), dark: m('concreteDark'), rad: 7, tilt: 0.02 });
      for (i = 0; i < 5; i++) {
        var wx2 = px - 30 + i * 10;
        w.fill(wx2, y + 1, pz + 10, wx2, y + 9, pz + 10, m('girder'));
        w.fill(wx2, y + 1, pz + 22, wx2, y + 9, pz + 22, m('girder'));
        w.set(wx2, y + 10, pz + 16, m('windowDim'));
      }
      // 散落建筑碎块
      w.scatter(px - 42, pz - 36, px + 42, pz + 36, 60, 0x7C99, function (sx, sz, rn) {
        if (Math.hypot(sx - px, sz - pz) > 42) return;
        var sy = gy(sx, sz);
        var hh = 1 + ((rn() * 5) | 0);
        w.fill(sx, sy, sz, sx + ((rn() * 3) | 0), sy + hh, sz + ((rn() * 3) | 0),
          rn() < 0.4 ? m('whitePanel2') : (rn() < 0.5 ? m('concreteDark') : m('rubble')));
        if (rn() < 0.10) w.set(sx, sy + hh + 1, sz, m('neonFlick'));
      });
      // 几具残骸与弹坑
      LIB.bones(w, px + 16, pz - 26, y, 20, 'z', 0x7CB1, { arch: 4, rib: 5 });
      w.tCrater(px + 24, pz + 10, 9, -3, 4, m('scorch'));
      w.tCrater(px - 18, pz - 20, 7, -2, 3, m('scorch'));
      LIB.searchlight(w, px + 36, pz - 34, gy(px + 36, pz - 34), 14, [-0.6, 0.5, 0.6], m('beamRed'));
      w.addLabel('第7种植园遗址', px, y + 36, pz, 'site', '倾覆的巨物 · 穹顶断裂');
    })();

    /* =================================================================
       7. 回忆之境（浮空岛，轴线北端景）
       ================================================================= */
    (function () {
      var Mm = LAY.memory, px = Mm.cx, pz = Mm.cz, IY = Mm.y;
      var hw = Mm.hw, hh = Mm.hh;
      // 倒锥形岛体
      for (var d = 0; d < 26; d++) {
        var rr = 1 - d / 26;
        var rx = Math.round(hw * Math.pow(rr, 0.55)), rz = Math.round(hh * Math.pow(rr, 0.55));
        if (rx < 1 || rz < 1) break;
        for (z = -rz; z <= rz; z++)
          for (x = -rx; x <= rx; x++) {
            if ((x * x) / (rx * rx) + (z * z) / (rz * rz) > 1) continue;
            var nn = M.fbm((px + x) * 0.07, (pz + z) * 0.07, 2, 0x3E1);
            if (d > 4 && nn < 0.30) continue;
            var mm = d === 0 ? m('grass') : (d < 3 ? m('dirt') : (nn > 0.55 ? m('stone') : m('stoneDark')));
            w.set(px + x, IY - d, pz + z, mm);
          }
      }
      // 岛面草地与小径
      for (z = -hh + 4; z <= hh - 4; z++)
        for (x = -hw + 4; x <= hw - 4; x++) {
          if ((x * x) / ((hw - 3) * (hw - 3)) + (z * z) / ((hh - 3) * (hh - 3)) > 1) continue;
          var n2 = M.fbm((px + x) * 0.12, (pz + z) * 0.12, 2, 0x3E2);
          w.set(px + x, IY, pz + z, n2 > 0.52 ? m('grass') : m('grassDark'));
        }
      for (i = -30; i <= 30; i++) w.fill(px + i, IY, pz + Math.round(Math.sin(i * 0.12) * 8), px + i, IY, pz + Math.round(Math.sin(i * 0.12) * 8) + 1, m('paveWarm'));
      // 幼年实验楼
      var lx2 = px - 22, lz2 = pz - 8;
      w.fill(lx2 - 8, IY + 1, lz2 - 6, lx2 + 8, IY + 9, lz2 + 6, m('whitePanel'));
      LIB.facade(w, lx2 - 8, lz2 - 6, lx2 + 8, lz2 + 6, IY + 1, IY + 9,
        { body: m('whitePanel'), win: m('windowWarm'), mullion: m('whitePanel2'), belt: m('goldTrim'),
          mulEvery: 3, beltEvery: 2 });
      LIB.roofScape(w, lx2 - 8, lz2 - 6, lx2 + 8, lz2 + 6, IY + 10, 0, 0x3E3);
      w.fill(lx2 - 2, IY + 1, lz2 + 7, lx2 + 2, IY + 4, lz2 + 7, m('windowGold'));
      LIB.neonSign(w, lx2 - 6, IY + 12, lz2 - 7, 'z', 'LAB-0', m('neonCyan'), { dir: -1 });
      // 小森林
      var frnd = M.rng(0x3E77);
      for (i = 0; i < 46; i++) {
        var tx = px + 2 + ((frnd() * (hw - 8)) | 0), tz = pz - hh + 6 + ((frnd() * (hh * 1.6)) | 0);
        if ((Math.pow(tx - px, 2)) / Math.pow(hw - 6, 2) + (Math.pow(tz - pz, 2)) / Math.pow(hh - 6, 2) > 0.9) continue;
        if (w.get(tx, IY + 1, tz)) continue;
        LIB.tree(w, tx, tz, IY + 1, 4 + ((frnd() * 4) | 0), frnd() < 0.42 ? 'cherry' : 'birch');
      }
      // 小池
      w.fill(px + 14, IY, pz + 14, px + 22, IY, pz + 20, m('waterNeon'));
      LIB.perim(w, px + 13, pz + 13, px + 23, pz + 21, IY, m('stoneLight'));
      LIB.bench(w, px + 12, pz + 16, IY + 1, 'z');
      // 钟塔（轴线端景的竖向要素）
      var ctx2 = px + 26, ctz = pz - 18;
      w.fill(ctx2 - 3, IY + 1, ctz - 3, ctx2 + 3, IY + 20, ctz + 3, m('brickWhite'));
      LIB.facade(w, ctx2 - 3, ctz - 3, ctx2 + 3, ctz + 3, IY + 1, IY + 20,
        { body: m('brickWhite'), win: m('windowWarm'), mullion: m('woodWhite'), belt: m('copperRoof'),
          mulEvery: 2, beltEvery: 3 });
      w.fill(ctx2 - 4, IY + 21, ctz - 4, ctx2 + 4, IY + 21, ctz + 4, m('copperRoof'));
      w.cone(ctx2, ctz, IY + 22, IY + 28, 4, 0.8, m('copperPatina'));
      w.set(ctx2, IY + 29, ctz, m('goldTrim'));
      w.disc(ctx2, ctz - 4, 2.2, IY + 16, m('windowGold'));
      w.disc(ctx2, ctz + 4, 2.2, IY + 16, m('windowGold'));
      // 石圈与小拱桥
      for (i = 0; i < 10; i++) {
        var sa2 = i * 0.628;
        var scx = Math.round(px - 18 + Math.cos(sa2) * 8), scz = Math.round(pz + 14 + Math.sin(sa2) * 8);
        w.fill(scx, IY + 1, scz, scx, IY + 2 + (i % 2), scz, m('stoneLight'));
      }
      for (i = -4; i <= 4; i++) {
        var byy2 = IY + 1 + Math.round(2.2 - Math.abs(i) * 0.45);
        w.fill(px + 6 + i, byy2, pz + 22, px + 6 + i, byy2, pz + 26, m('woodWhite'));
        if (Math.abs(i) === 4) w.fill(px + 6 + i, byy2 + 1, pz + 22, px + 6 + i, byy2 + 2, pz + 26, m('wood'));
      }
      // 更密的林与花
      for (i = 0; i < 34; i++) {
        var fx2 = px - hw + 6 + ((frnd() * (hw * 1.7)) | 0);
        var fz2 = pz - hh + 5 + ((frnd() * (hh * 1.8)) | 0);
        if ((Math.pow(fx2 - px, 2)) / Math.pow(hw - 5, 2) + (Math.pow(fz2 - pz, 2)) / Math.pow(hh - 5, 2) > 0.92) continue;
        if (w.get(fx2, IY + 1, fz2)) continue;
        if (frnd() < 0.30) w.set(fx2, IY + 1, fz2, frnd() < 0.5 ? m('flowerPink') : m('flowerWhite'));
        else LIB.tree(w, fx2, fz2, IY + 1, 3 + ((frnd() * 4) | 0), frnd() < 0.5 ? 'cherry' : 'neon');
      }
      // 岛缘围栏灯
      for (i = 0; i < 24; i++) {
        var ea2 = i * 0.262;
        var ex2 = Math.round(px + Math.cos(ea2) * (hw - 3)), ez2 = Math.round(pz + Math.sin(ea2) * (hh - 3));
        if (!w.get(ex2, IY, ez2)) continue;
        w.fill(ex2, IY + 1, ez2, ex2, IY + 2, ez2, m('woodWhite'));
        if (i % 4 === 0) w.set(ex2, IY + 3, ez2, m('lampWarm'));
      }
      // 岛底垂落光带与悬浮碎块
      LIB.lightPillar(w, px, pz, IY - 26, IY - 5, 2.2, m('beamViolet'));
      var crnd = M.rng(0x3E88);
      for (i = 0; i < 14; i++) {
        var ca = crnd() * 6.283, cd = 20 + crnd() * 40;
        var cx2 = Math.round(px + Math.cos(ca) * cd), cz2 = Math.round(pz + Math.sin(ca) * cd);
        var cy2 = IY - 8 - ((crnd() * 26) | 0);
        w.sphere(cx2, cy2, cz2, 1.6 + crnd() * 3, crnd() < 0.5 ? m('stoneDark') : m('stone'), { yScale: 0.7 });
        if (crnd() < 0.4) w.set(cx2, cy2 + 2, cz2, m('leavesGlow'));
      }
      // 指向地面广场的光柱
      LIB.lightPillar(w, px, pz, LAY.ground + 2, IY - 30, 1.5, m('beamViolet'));
      w.addLabel('回忆之境', px, IY + 22, pz, 'site', '浮空岛 · 幼年实验楼与森林');
    })();

    /* =================================================================
       8. 出击区战场（轴线南端）
       ================================================================= */
    (function () {
      var F = LAY.sortieField, px = F.cx, pz = F.cz;
      var y = gy(px, pz);
      // 弹坑群
      w.scatter(px - F.hw, pz - F.hh, px + F.hw, pz + F.hh, 26, 0x50F1, function (sx, sz, rn) {
        w.tCrater(sx, sz, 4 + rn() * 7, -2 - ((rn() * 3) | 0), 3, m('scorch'));
      });
      w.tSmooth(px - F.hw, pz - F.hh, px + F.hw, pz + F.hh, 1);
      y = gy(px, pz);
      // 叫龙残骸 ×4
      LIB.bones(w, px - 44, pz - 18, gy(px - 44, pz - 18), 26, 'x', 0x5F01, { arch: 5, rib: 7 });
      LIB.bones(w, px + 20, pz + 14, gy(px + 20, pz + 14), 22, 'z', 0x5F02, { arch: 4, rib: 6 });
      LIB.bones(w, px + 40, pz - 22, gy(px + 40, pz - 22), 18, 'x', 0x5F03, { arch: 3, rib: 5 });
      LIB.wreck(w, px - 20, pz + 20, gy(px - 20, pz + 20), 20, 'x', 0x5F04,
        { hull: m('fleshDark'), dark: m('fleshDeep'), rad: 4, tilt: 0.05 });
      // 坠毁的 FRANXX（半埋 + 断臂）
      var mx = px + 4, mz = pz - 6;
      LIB.mecha(w, mx, gy(mx, mz), mz, 22, { main: m('mechaWhite'), accent: m('mechaRed') });
      w.fill(mx - 3, gy(mx, mz), mz - 3, mx + 3, gy(mx, mz) + 1, mz + 3, m('sandDark'));
      LIB.wreck(w, mx + 12, mz + 8, gy(mx + 12, mz + 8), 9, 'x', 0x5F05,
        { hull: m('mechaWhite'), dark: m('mechaDark'), rad: 2.2, tilt: 0 });
      w.set(mx, gy(mx, mz) + 14, mz, m('coreBlue'));
      // 掩体 / 警示带 / 探照灯
      for (i = 0; i < 14; i++) {
        var hx = px - F.hw + 6 + i * 8;
        w.fill(hx, y, pz - F.hh + 4, hx + 3, y + 1, pz - F.hh + 5, m('sandDark'));
        if (i % 2 === 0) w.set(hx, y + 2, pz - F.hh + 4, m('hazard'));
      }
      for (i = 0; i < 18; i++) {
        var tx2 = px - F.hw + i * 7;
        w.fill(tx2, y, pz + F.hh - 2, tx2, y + 2, pz + F.hh - 2, m('hazardDark'));
        w.set(tx2, y + 3, pz + F.hh - 2, i % 2 ? m('neonRed') : m('neonAmber'));
      }
      // 警示墙
      w.fill(px - 16, y, pz - F.hh - 4, px + 16, y + 5, pz - F.hh - 3, m('hazard'));
      for (i = -16; i <= 16; i += 4) w.fill(px + i, y, pz - F.hh - 5, px + i + 1, y + 5, pz - F.hh - 5, m('hazardDark'));
      w.text('DANGER', px - 22, y + 4, pz - F.hh - 6, 'z', m('neonRed'));
      LIB.searchlight(w, px - F.hw - 4, pz, y, 16, [0.7, 0.5, 0.1], m('beamRed'));
      LIB.searchlight(w, px + F.hw + 4, pz, y, 16, [-0.7, 0.5, -0.1], m('beamRed'));
      w.addLabel('出击区战场', px, y + 26, pz, 'site', '首战场 · 巨型康拉德战');
    })();

    /* =================================================================
       9. 高架轨道桥（东西两条对称线 + 4 座站台）
       ================================================================= */
    (function () {
      var RY = LAY.railY;
      var east = [[1204, 596], [1128, 470], [1128, 762], [1050, 900], [1000, 930]];
      var west = [[76, 596], [152, 470], [152, 762], [230, 900], [280, 930]];
      LIB.viaduct(w, east, RY, 5, {});
      LIB.viaduct(w, west, RY, 5, {});
      // 站台
      var stations = [[1128, 470, 'MP-4'], [1128, 762, 'KZ-9'], [152, 470, 'BONES'], [152, 762, 'WATCH']];
      for (i = 0; i < stations.length; i++) {
        var sx = stations[i][0], sz = stations[i][1], nm = stations[i][2];
        // 月台
        w.fill(sx - 7, RY - 1, sz - 5, sx + 7, RY - 1, sz + 5, m('concrete'));
        w.fill(sx - 7, RY, sz - 5, sx - 4, RY, sz + 5, m('whiteTile'));
        w.fill(sx + 4, RY, sz - 5, sx + 7, RY, sz + 5, m('whiteTile'));
        // 候车棚
        w.fill(sx - 7, RY + 5, sz - 5, sx + 7, RY + 5, sz + 5, m('steelDark'));
        for (k = -5; k <= 5; k += 5) {
          w.fill(sx - 7, RY + 1, sz + k, sx - 7, RY + 4, sz + k, m('girder'));
          w.fill(sx + 7, RY + 1, sz + k, sx + 7, RY + 4, sz + k, m('girder'));
        }
        w.fill(sx - 7, RY + 3, sz - 5, sx - 7, RY + 4, sz + 5, m('glassCyan'));
        w.fill(sx + 7, RY + 3, sz - 5, sx + 7, RY + 4, sz + 5, m('glassCyan'));
        for (k = -4; k <= 4; k += 4) w.set(sx + k, RY + 4, sz, m('lampCool'));
        // 站牌
        LIB.holoBoard(w, sx - 5, RY + 6, sz - 6, 'z', 10, 4, m('holoScreen'), -1);
        w.text(nm, sx - 5, RY + 11, sz - 6, 'z', m('neonCyan'));
        // 竖井电梯（落到地面）
        var gyy = gy(sx + 9, sz);
        w.fill(sx + 8, gyy, sz - 2, sx + 10, RY - 1, sz + 2, m('glassCyan'));
        w.frame(sx + 8, gyy, sz - 2, sx + 10, RY - 1, sz + 2, m('steel'));
        w.set(sx + 9, RY, sz, m('lampCool'));
        w.addLabel('轨道站 · ' + nm, sx, RY + 15, sz, 'minor');
      }
      w.addLabel('高架轨道桥', 1128, RY + 12, 616, 'minor', '卫星区通勤线');
    })();

    /* =================================================================
       10. 全图散落残骸（48 处，避开站点与道路）
       ================================================================= */
    (function () {
      var CXp = LAY.cx, CZp = LAY.cz;
      var zones = [
        [LAY.p13.cx, LAY.p13.cz, LAY.p13.r + 16],
        [LAY.ruins.cx, LAY.ruins.cz, 140],
        [LAY.cosmos.cx, LAY.cosmos.cz, 132],
        [LAY.seabed.cx, LAY.seabed.cz, 120],
        [LAY.crevasse.cx, LAY.crevasse.cz, 180],
        [LAY.p26.cx, LAY.p26.cz, 76],
        [LAY.p7ruin.cx, LAY.p7ruin.cz, 60],
        [LAY.bonesGiant[0], LAY.bonesGiant[1], 46],
        [LAY.pumpStation[0], LAY.pumpStation[1], 40],
        [LAY.watchWest[0], LAY.watchWest[1], 32],
        [LAY.watchEastOut[0], LAY.watchEastOut[1], 40],
        [LAY.watchNW[0], LAY.watchNW[1], 26],
        [LAY.watchNE[0], LAY.watchNE[1], 26],
        [LAY.sortieField.cx, LAY.sortieField.cz, 86]
      ];
      var roadMats = [m('asphalt'), m('asphaltWorn'), m('asphaltCrack'), m('roadLine'),
        m('roadNeon'), m('roadNeonPink'), m('whiteTile'), m('marble'), m('pave'),
        m('paveDark'), m('paveWarm'), m('curb'), m('roadLineWarm')];
      function ok(px, pz) {
        if (w.tH(px, pz) < 0) return false;
        if (Math.hypot(px - CXp, pz - CZp) > LAY.islandR - 40) return false;
        for (var q = 0; q < zones.length; q++)
          if (Math.hypot(px - zones[q][0], pz - zones[q][1]) < zones[q][2]) return false;
        var mm = w.tM(px, pz);
        for (q = 0; q < roadMats.length; q++) if (mm === roadMats[q]) return false;
        if (w.get(px, gy(px, pz), pz)) return false;
        return true;
      }
      var made = 0;
      w.scatter(80, 80, 1200, 1200, 1400, 0x5CA7, function (px, pz, rn) {
        if (made >= 48 || !ok(px, pz)) return;
        var py = gy(px, pz), r = rn(), dir = rn() < 0.5 ? 'x' : 'z';
        if (r < 0.18) {                                   // 坠毁机体
          LIB.wreck(w, px, pz, py, 8 + ((rn() * 8) | 0), dir, 0x5000 + made * 71,
            { hull: m('mechaGrey'), dark: m('mechaDark'), rad: 2.6, tilt: 0.06 });
          w.set(px, py + 4, pz, m('coreBlue'));
        } else if (r < 0.36) {                            // 断裂骨片
          LIB.bones(w, px, pz, py, 10 + ((rn() * 8) | 0), dir, 0x5100 + made * 53,
            { arch: 2, rib: 4, bone: m('boneOld') });
        } else if (r < 0.50) {                            // 废弃车辆群
          LIB.vehicle(w, px, pz, py, dir, 0x5200 + made);
          if (rn() < 0.5) LIB.vehicle(w, px + 5, pz + 3, py, dir, 0x5300 + made);
        } else if (r < 0.62) {                            // 翻倒集装箱
          LIB.container(w, px, pz, py, dir, rn() < 0.5 ? m('rustMetal') : m('tarp'));
          if (rn() < 0.4) LIB.container(w, px + 1, pz + 4, py + 4, dir, m('rustDeep'));
        } else if (r < 0.72) {                            // 锈蚀管段
          LIB.pipes(w, [[px, pz], [px + 10 + ((rn() * 10) | 0), pz + ((rn() * 6) | 0)]], py + 1, m('rustDeep'));
        } else if (r < 0.82) {                            // 倒塌电线杆
          w.line3(px, py, pz, px + 7, py + 3, pz + 2, m('woodDark'));
          w.line3(px + 7, py + 3, pz + 2, px + 9, py + 1, pz + 4, m('wire'));
          w.set(px + 7, py + 4, pz + 2, m('neonFlickRed'));
        } else if (r < 0.92) {                            // 废弃哨点
          w.fill(px - 2, py, pz - 2, px + 2, py + 4, pz + 2, m('concreteMossy'));
          w.fill(px - 1, py + 2, pz - 3, px + 1, py + 3, pz - 3, m('glassBroken'));
          w.fill(px - 2, py + 5, pz - 2, px + 2, py + 5, pz + 2, m('rustMetal'));
          w.set(px, py + 6, pz, m('neonFlick'));
          LIB.rubblePile(w, px + 4, pz + 4, py, 2.2, made);
        } else {                                          // 干枯巨树 + 弹坑
          LIB.tree(w, px, pz, py, 10 + ((rn() * 6) | 0), 'dead');
          w.tCrater(px + 6, pz + 5, 5, -2, 3, m('scorch'));
        }
        made++;
        if (made % 12 === 0) w.addLabel('荒野残骸群', px, py + 10, pz, 'minor');
      });
      console.log('[荒野] 散落残骸 ' + made + ' 处');
    })();

    return w;
  };
})(window);
