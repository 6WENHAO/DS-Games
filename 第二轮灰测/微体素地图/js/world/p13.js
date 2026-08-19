/* =====================================================================
   微体素地图 · 第13号种植园（全图主体，三进院落，中轴对称）
   后院＝森林区 / 中院＝城区核心 / 前院＝南部作战区
   西厢＝行政保密区（科研）  东厢＝文教生活区（学校·庄园·鸟笼）
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, m = VX.m, LAY = VX.LAY, LIB = VX.LIB;
  var ST = LIB.ST;

  VX.buildP13 = function (w) {
    var P = LAY.p13, CX = P.cx, CZ = P.cz;
    function at(lx, lz) { return [CX + lx, CZ + lz]; }
    function gy(x, z) { var h = w.tH(x, z); return h < 0 ? LAY.ground : h + 1; }
    function lgy(lx, lz) { return gy(CX + lx, CZ + lz); }
    var BY = gy(CX, CZ);                       // 城区基准地面

    /* =================================================================
       1. 底盘外壳 · 穹顶骨架 · 钻塔
       ================================================================= */
    // 外壳环墙（移动式种植园的船体缘）
    var hullY = BY - 1;
    w.ring(CX, CZ, P.r - 5, P.r, hullY, hullY + 11, m('whitePanel2'));
    w.ring(CX, CZ, P.r - 5, P.r, hullY + 11, hullY + 12, m('darkMetal'));
    w.ring(CX, CZ, P.r - 4, P.r - 3, hullY + 9, hullY + 9, m('hazard'));
    w.ring(CX, CZ, P.r - 5, P.r - 5, hullY + 12, hullY + 12, m('neonCyan'));
    // 四轴服务口（让主路穿过外壳）
    var openW = 11;
    w.fill(CX - openW, hullY, CZ - P.r - 2, CX + openW, hullY + 12, CZ - P.r + 6, 0);
    w.fill(CX - openW, hullY, CZ + P.r - 6, CX + openW, hullY + 12, CZ + P.r + 2, 0);
    w.fill(CX - P.r - 2, hullY, CZ - openW, CX - P.r + 6, hullY + 12, CZ + openW, 0);
    w.fill(CX + P.r - 6, hullY, CZ - openW, CX + P.r + 2, hullY + 12, CZ + openW, 0);
    // 八条外挂支撑腿 + 履带段
    var li;
    for (li = 0; li < 8; li++) {
      var la = li * Math.PI / 4 + Math.PI / 8;
      var lx = Math.round(CX + Math.cos(la) * (P.r + 5)), lz = Math.round(CZ + Math.sin(la) * (P.r + 5));
      var lgY = gy(lx, lz);
      w.fill(lx - 4, lgY, lz - 4, lx + 4, lgY + 5, lz + 4, m('darkMetal'));
      w.fill(lx - 5, lgY, lz - 5, lx + 5, lgY + 1, lz + 5, m('girder'));
      w.fill(lx - 3, lgY + 5, lz - 3, lx + 3, hullY + 6, lz + 3, m('steelDark'));
      LIB.perim(w, lx - 4, lz - 4, lx + 4, lz + 4, lgY + 2, m('hazard'));
      w.set(lx, lgY + 6, lz, m('neonAmber'));
      w.addLabel('底盘支撑腿', lx, lgY + 8, lz, 'minor');
    }
    // 穹顶骨架（只做经线与纬线环，便于看清内部）
    var apex = BY + P.domeApex, dr = P.domeR, mi, py;
    for (mi = 0; mi < 24; mi++) {
      var ma = mi * Math.PI / 12;
      for (var t = 0; t <= 44; t++) {
        var ang = (t / 44) * Math.PI / 2;
        var rr = dr * Math.cos(ang), yy = BY + P.domeApex * Math.sin(ang);
        w.set(Math.round(CX + Math.cos(ma) * rr), Math.round(yy), Math.round(CZ + Math.sin(ma) * rr),
          mi % 6 === 0 ? m('steel') : m('steelDark'));
      }
    }
    for (var ri = 1; ri <= 5; ri++) {
      var ra = (ri / 6) * Math.PI / 2;
      var rr2 = dr * Math.cos(ra), y2 = Math.round(BY + P.domeApex * Math.sin(ra));
      w.ring(CX, CZ, rr2 - 0.7, rr2 + 0.7, y2, y2, ri % 2 ? m('steelDark') : m('glassDome'));
      if (ri === 2 || ri === 4) w.ring(CX, CZ, rr2 - 0.7, rr2 + 0.7, y2 + 1, y2 + 1, m('neonCyan'));
    }
    w.cyl(CX, CZ, 4, apex - 2, apex + 4, m('steel'));
    w.set(CX, apex + 5, CZ, m('neonWhite'));
    LIB.lightPillar(w, CX, CZ, apex + 6, apex + 26, 2.2, m('beamCyan'));
    // 钻塔阵（底盘边缘）
    for (var d = 0; d < P.drills.length; d++) {
      var da = P.drills[d][1] * Math.PI / 180, dR = P.drills[d][0];
      var dx = Math.round(CX + Math.cos(da) * dR), dz = Math.round(CZ + Math.sin(da) * dR);
      LIB.drillTower(w, dx, dz, gy(dx, dz), 22 + (d % 3) * 4);
    }
    w.addLabel('第13号种植园', CX, apex + 30, CZ, 'site', '移动式穹顶都市 · 全图主体');

    /* =================================================================
       2. 城区核心（中院）：围墙 / 三环八射 / 长老会塔 / 四地标 / 十八街区
       ================================================================= */
    var CR = P.coreR;
    // 场地铺装（先铺地，建筑再压上去 → 自然衔接）
    w.tPaintDisc(CX, CZ, CR + 6, m('pave'), 0, m('concrete'));
    w.tPaintDisc(CX, CZ, 46, m('whiteTile'), 0, m('marble'));
    // 中央广场花纹：金线放射 + 环形嵌带 + 红毯十字（打破纯白）
    var pai;
    for (pai = 0; pai < 16; pai++) {
      var pa = pai * Math.PI / 8;
      for (var pr = 20; pr < 46; pr++) {
        var ppx = Math.round(CX + Math.cos(pa) * pr), ppz = Math.round(CZ + Math.sin(pa) * pr);
        w.tPaint(ppx, ppz, ppx, ppz, pai % 2 ? m('goldTrim') : m('paveDark'));
      }
    }
    w.tPaintDisc(CX, CZ, 33, m('goldTrim'), 31.6);
    w.tPaintDisc(CX, CZ, 41, m('marble'), 39.6);
    w.tPaint(CX - 2, CZ - 46, CX + 2, CZ - 20, m('redCarpet'));
    w.tPaint(CX - 2, CZ + 20, CX + 2, CZ + 46, m('redCarpet'));
    w.tPaint(CX - 46, CZ - 2, CX - 20, CZ + 2, m('redCarpet'));
    w.tPaint(CX + 20, CZ - 2, CX + 46, CZ + 2, m('redCarpet'));
    var ringR = [46, 72, 94];
    for (ri = 0; ri < 3; ri++) w.tPaintDisc(CX, CZ, ringR[ri] + 2.5, m('asphalt'), ringR[ri] - 2.5);
    for (mi = 0; mi < 8; mi++) {
      var ra2 = mi * Math.PI / 4;
      w.tRoad([[Math.round(CX + Math.cos(ra2) * 20), Math.round(CZ + Math.sin(ra2) * 20)],
               [Math.round(CX + Math.cos(ra2) * (CR + 12)), Math.round(CZ + Math.sin(ra2) * (CR + 12))]],
        7, m('asphalt'), { curb: m('curb') });
    }
    // 围墙 + 四门
    var wallPts = [];
    for (mi = 0; mi <= 64; mi++) {
      var wa = mi * Math.PI / 32;
      wallPts.push([Math.round(CX + Math.cos(wa) * CR), Math.round(CZ + Math.sin(wa) * CR)]);
    }
    LIB.fenceWall(w, wallPts, BY, 7, m('whitePanel2'),
      { postEvery: 8, neon: m('neonCyan'), cap: m('steelDark'),
        gaps: [[CX, CZ - CR, 9], [CX, CZ + CR, 9], [CX - CR, CZ, 9], [CX + CR, CZ, 9]] });
    var gates = [[0, -CR, '北门'], [0, CR, '南门'], [-CR, 0, '西门'], [CR, 0, '东门']];
    for (var gi = 0; gi < 4; gi++) {
      var gp = at(gates[gi][0], gates[gi][1]);
      var ax = Math.abs(gates[gi][0]) > Math.abs(gates[gi][1]) ? 'x' : 'z';
      LIB.gateArch(w, gp[0], gp[1], gy(gp[0], gp[1]), 22, 11, gi === 0 ? 'N' : gi === 1 ? 'S' : gi === 2 ? 'W' : 'E',
        { axis: ax, post: m('whitePanel'), beam: m('goldTrim'), neon: m('neonCyan') });
      w.addLabel('城区' + gates[gi][2], gp[0], gy(gp[0], gp[1]) + 14, gp[1], 'minor');
    }

    /* --- APE 长老会塔（全图第一地标） --- */
    (function () {
      var tx = CX, tz = CZ, y0 = BY;
      // 基座三层
      LIB.podium(w, tx - 17, tz - 17, tx + 17, tz + 17, y0, 3,
        { body: m('marble'), glass: m('glassGold'), win: m('windowGold'), trim: m('goldTrim'),
          canopy: m('goldTrim'), strip: m('lampWarm'), pillar: m('quartzPillar'), roof: 3 });
      var y = y0 + 3 * ST + 2;
      // 塔身三段收分
      var segs = [[13, 40], [10, 28], [7, 20]];
      for (var s = 0; s < segs.length; s++) {
        var hf = segs[s][0], hh = segs[s][1];
        w.fill(tx - hf, y, tz - hf, tx + hf, y + hh, tz + hf, m('whitePanel'));
        LIB.facade(w, tx - hf, tz - hf, tx + hf, tz + hf, y, y + hh - 1,
          { body: m('whitePanel'), win: m('windowGold'), mullion: m('quartzPillar'),
            belt: m('goldTrim'), mulEvery: 3, beltEvery: 3, neon: m('neonCyan'), neonEvery: 4 });
        LIB.eave(w, tx - hf, tz - hf, tx + hf, tz + hf, y + hh, 1, m('goldTrim'));
        // 四面竖向霓虹槽
        w.fill(tx, y + 2, tz - hf - 1, tx, y + hh - 2, tz - hf - 1, m('neonCyan'));
        w.fill(tx, y + 2, tz + hf + 1, tx, y + hh - 2, tz + hf + 1, m('neonCyan'));
        w.fill(tx - hf - 1, y + 2, tz, tx - hf - 1, y + hh - 2, tz, m('neonCyan'));
        w.fill(tx + hf + 1, y + 2, tz, tx + hf + 1, y + hh - 2, tz, m('neonCyan'));
        y += hh + 1;
      }
      // 冠顶
      w.cone(tx, tz, y, y + 12, 7, 1.2, m('quartzPillar'));
      w.fill(tx, y + 12, tz, tx, y + 18, tz, m('goldTrim'));
      w.set(tx, y + 19, tz, m('starCore'));
      LIB.lightPillar(w, tx, tz, y + 20, y + 46, 1.6, m('beamWarm'));
      // 前庭红毯（001 现身处）
      w.tPaint(tx - 3, tz - 22, tx + 3, tz - 13, m('redCarpet'));
      w.addLabel('APE 长老会塔', tx, y + 22, tz, 'poi', '城区中轴核心 · 001 现身前庭');
    })();

    /* --- 四地标塔（严格对称布置） --- */
    (function () {
      var L = P.landmarks, i, p, y;
      // 西北：圆角塔
      p = at(L[0][0], L[0][1]); y = gy(p[0], p[1]);
      w.cyl(p[0], p[1], 10, y, y + 52, m('whitePanel'));
      for (i = 2; i < 50; i += 4) w.ring(p[0], p[1], 9.4, 10.6, y + i, y + i + 1, m('windowCool'));
      for (i = 8; i < 50; i += 12) w.ring(p[0], p[1], 10.2, 11.2, y + i, y + i, m('neonBlue'));
      w.disc(p[0], p[1], 11, y + 53, m('concreteDark'));
      LIB.roofScape(w, p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8, y + 53, 2, 41);
      w.addLabel('圆角塔', p[0], y + 60, p[1], 'minor');
      // 东北：双塔连体
      p = at(L[1][0], L[1][1]); y = gy(p[0], p[1]);
      LIB.tower(w, p[0] - 11, p[1] - 10, p[0] - 2, p[1] - 1, y, 60,
        { body: m('whitePanel'), win: m('windowGold'), mullion: m('concrete'), belt: m('whitePanel2'),
          neon: m('neonMagenta'), neonEvery: 4, roof: 1 });
      LIB.tower(w, p[0] + 2, p[1] + 1, p[0] + 11, p[1] + 10, y, 66,
        { body: m('whitePanel'), win: m('windowGold'), mullion: m('concrete'), belt: m('whitePanel2'),
          neon: m('neonMagenta'), neonEvery: 4, roof: 2 });
      LIB.skybridge(w, p[0] - 6, p[1] - 5, p[0] + 6, p[1] + 5, y + 40, 5, {});
      LIB.skybridge(w, p[0] - 6, p[1] - 5, p[0] + 6, p[1] + 5, y + 52, 5, {});
      w.addLabel('双塔连体', p[0], y + 72, p[1], 'minor');
      // 西南：退台塔
      p = at(L[2][0], L[2][1]); y = gy(p[0], p[1]);
      LIB.setbackTower(w, p[0], p[1], 12, y, [[0, 4], [3, 4], [6, 4]],
        { body: m('whitePanel2'), win: m('windowCool'), mullion: m('concrete'), belt: m('goldTrim'),
          neon: m('neonCyan'), neonEvery: 3, roof: 0 });
      w.addLabel('退台塔', p[0], y + 60, p[1], 'minor');
      // 东南：细高灯塔
      p = at(L[3][0], L[3][1]); y = gy(p[0], p[1]);
      LIB.tower(w, p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5, y, 76,
        { body: m('whitePanel'), win: m('windowCool'), mullion: m('quartzPillar'), belt: m('goldTrim'),
          neon: m('neonViolet'), neonEvery: 3, roof: 2, edgeNeon: m('neonViolet') });
      w.fill(p[0] - 2, y + 78, p[1] - 2, p[0] + 2, y + 84, p[1] + 2, m('glassCyan'));
      w.set(p[0], y + 85, p[1], m('neonWhite'));
      LIB.searchlight(w, p[0], p[1], y + 86, 2, [0.7, 0.45, 0.4], m('beamCyan'));
      w.addLabel('细高灯塔', p[0], y + 92, p[1], 'minor');
    })();

    /* --- 喷泉广场（序章出生点） --- */
    (function () {
      var p = at(P.fountain[0], P.fountain[1]);
      LIB.plaza(w, p[0] - 18, p[1] - 13, p[0] + 18, p[1] + 13, gy(p[0], p[1]),
        { pave: m('whiteTile'), alt: m('marble'), lampEvery: 9 });
      LIB.fountain(w, p[0], p[1], gy(p[0], p[1]), 8);
      LIB.holoBoard(w, p[0] - 10, gy(p[0], p[1]) + 8, p[1] - 13, 'z', 12, 8, m('holoScreen'), -1);
      w.addLabel('喷泉广场', p[0], gy(p[0], p[1]) + 12, p[1], 'poi', '序章出生点 · 与 02 初遇');
    })();

    /* --- 十八街区（凌城式：裙房贴街成墙 + 后退塔楼） --- */
    (function () {
      var idx = 0, band, k;
      var bands = [{ r: 59, half: 8, min: 5, max: 10 }, { r: 84, half: 10, min: 7, max: 14 }];
      for (band = 0; band < 2; band++) {
        var B = bands[band];
        for (k = 0; k < 8; k++) {
          var a = k * Math.PI / 4 + Math.PI / 8;
          var bx = Math.round(CX + Math.cos(a) * B.r), bz = Math.round(CZ + Math.sin(a) * B.r);
          LIB.streetBlock(w, bx - B.half, bz - B.half, bx + B.half, bz + B.half,
            gy(bx, bz), 0x13A0 + idx * 37, { minStory: B.min, maxStory: B.max });
          idx++;
        }
      }
      // 中轴两侧两个市政街区（大人住宅区门面）
      var cvA = at(-24, 30), cvB = at(24, 30);
      LIB.streetBlock(w, cvA[0] - 10, cvA[1] - 7, cvA[0] + 10, cvA[1] + 7, gy(cvA[0], cvA[1]), 0x991, { minStory: 6, maxStory: 9 });
      LIB.streetBlock(w, cvB[0] - 10, cvB[1] - 7, cvB[0] + 10, cvB[1] + 7, gy(cvB[0], cvB[1]), 0x992, { minStory: 6, maxStory: 9 });
      var res = at(0, 34);
      w.addLabel('大人住宅区', res[0], BY + 40, res[1], 'poi', '永恒之城 · 帕特纳监控区');
    })();

    /* --- M 连廊层 + 空中走廊 A/B/C/S --- */
    (function () {
      var my = BY + 30, k;
      w.ring(CX, CZ, 70, 74, my, my, m('concrete'));
      w.ring(CX, CZ, 70, 74, my + 4, my + 4, m('concrete'));
      w.ring(CX, CZ, 70, 70, my + 1, my + 3, m('glassCyan'));
      w.ring(CX, CZ, 74, 74, my + 1, my + 3, m('glassCyan'));
      for (k = 0; k < 16; k++) {
        var a = k * Math.PI / 8;
        var ox = Math.round(CX + Math.cos(a) * 72), oz = Math.round(CZ + Math.sin(a) * 72);
        w.fill(ox - 1, my - 1, oz - 1, ox + 1, my - 1, oz + 1, m('girder'));
        w.fill(ox, gy(ox, oz), oz, ox, my - 2, oz, m('concreteDark'));
        if (k % 2 === 0) w.set(ox, my + 5, oz, m('lampCool'));
      }
      // 放射连廊：连廊层 → 核心
      for (k = 0; k < 4; k++) {
        var aa = k * Math.PI / 2 + Math.PI / 4;
        var x0 = Math.round(CX + Math.cos(aa) * 68), z0 = Math.round(CZ + Math.sin(aa) * 68);
        var x1 = Math.round(CX + Math.cos(aa) * 26), z1 = Math.round(CZ + Math.sin(aa) * 26);
        LIB.skybridge(w, x0, z0, x1, z1, my, 5, {});
      }
      // 空中走廊 A/B/C/S：核心 ↔ 四地标
      var names = ['A', 'B', 'C', 'S'];
      for (k = 0; k < 4; k++) {
        var L = P.landmarks[k], lp = at(L[0], L[1]);
        LIB.skybridge(w, CX + (L[0] > 0 ? 14 : -14), CZ + (L[1] > 0 ? 8 : -8), lp[0], lp[1], BY + 44, 5,
          { glass: m('glassGold') });
        w.text(names[k], lp[0], BY + 52, lp[1] - 1, 'z', m('neonWhite'));
      }
      w.addLabel('M 连廊层', CX + 72, my + 8, CZ, 'minor', '环廊 y+30 · 空中走廊 A/B/C/S');
    })();

    /* =================================================================
       3. 中轴大道与门户（南北仪式轴）
       ================================================================= */
    (function () {
      // 南侧市民大道
      w.tPaint(CX - 8, CZ + CR + 4, CX + 8, CZ + 168, m('asphalt'), m('concreteDark'));
      w.tPaint(CX - 2, CZ + CR + 4, CX + 2, CZ + 168, m('grass'), m('dirt'));
      var z;
      for (z = CZ + CR + 10; z < CZ + 166; z += 12) {
        LIB.tree(w, CX, z, gy(CX, z), 6, 'neon');
        w.set(CX - 9, gy(CX - 9, z), z, m('roadNeon'));
        w.set(CX + 9, gy(CX + 9, z), z, m('roadNeon'));
      }
      for (z = CZ + CR + 16; z < CZ + 160; z += 26) LIB.crosswalk(w, CX - 8, z, CX + 8, z + 4, 'x');
      // 北绿带
      w.tPaint(CX - 7, CZ - 168, CX + 7, CZ - CR - 4, m('paveWarm'), m('concrete'));
      for (z = CZ - 164; z < CZ - CR - 6; z += 11) {
        LIB.tree(w, CX - 9, z, gy(CX - 9, z), 7, 'birch');
        LIB.tree(w, CX + 9, z, gy(CX + 9, z), 7, 'birch');
        if (z % 22 === 0) { LIB.streetLamp(w, CX - 6, z, gy(CX - 6, z), 'warm'); LIB.streetLamp(w, CX + 6, z, gy(CX + 6, z), 'warm'); }
      }
      // 森林区门户牌坊
      var fg = at(P.forestGate[0], P.forestGate[1]);
      LIB.gateArch(w, fg[0], fg[1], gy(fg[0], fg[1]), 26, 13, 'FOREST',
        { axis: 'z', post: m('woodWhite'), beam: m('copperRoof'), neon: m('neonGreen') });
      w.addLabel('森林区门户', fg[0], gy(fg[0], fg[1]) + 17, fg[1], 'poi', '城市区↔森林区 牌坊');
    })();

    /* =================================================================
       4. 西厢：行政保密区（围界 + 实验楼 + 选拔基地 + APE 行政 + 职工住宅）
       ================================================================= */
    (function () {
      var C = P.westCompound;
      var x0 = CX + C[0], z0 = CZ + C[1], x1 = CX + C[2], z1 = CZ + C[3];
      VX._flatRect(x0 - 4, z0 - 4, x1 + 4, z1 + 4, BY - 1, 12, m('pave'), m('concrete'));
      var yb = gy((x0 + x1) / 2 | 0, (z0 + z1) / 2 | 0);
      LIB.courtyard(w, x0, z0, x1, z1, yb,
        { wall: m('whitePanel2'), h: 6, gateSide: 'x1z0z1', neon: m('neonRed'),
          pave1: m('pave'), pave2: m('paveDark'), postEvery: 10 });
      // 横幅大门（东侧主入口）
      var mz = ((z0 + z1) / 2) | 0;
      LIB.gateArch(w, x1, mz, yb, 18, 10, 'APE', { axis: 'x', post: m('concreteDark'), beam: m('darkMetal'), neon: m('neonRed') });

      // 实验楼（5 层 + 屋顶设备 + 逃脱隧道口）
      var p = at(P.lab[0], P.lab[1]), y = gy(p[0], p[1]);
      LIB.podium(w, p[0] - 15, p[1] - 11, p[0] + 15, p[1] + 11, y, 2,
        { body: m('whitePanel'), glass: m('glassCyan'), win: m('windowCool'), trim: m('concrete'), roof: 1 });
      LIB.tower(w, p[0] - 12, p[1] - 8, p[0] + 12, p[1] + 8, y + 2 * ST + 2, 24,
        { body: m('whitePanel'), win: m('windowCool'), mullion: m('concrete'), belt: m('whitePanel2'),
          neon: m('neonRed'), neonEvery: 2, roof: 1, mulEvery: 3 });
      LIB.neonSign(w, p[0] - 8, y + 11, p[1] - 12, 'z', 'LAB-13', m('neonRed'), { dir: -1 });
      LIB.pipes(w, [[p[0] - 16, p[1] + 12], [p[0] + 16, p[1] + 12], [p[0] + 16, p[1] - 12]], y + 9, m('rustMetal'));
      LIB.vent(w, p[0] + 14, p[1] + 13, y, 6, 3);
      LIB.vent(w, p[0] - 14, p[1] + 13, y, 5, 4);
      w.addLabel('实验楼', p[0], y + 34, p[1], 'poi', '博士真相 · 02 入梦');
      // 逃脱隧道（西北暗口）
      var ep = at(P.lab[0] - 40, P.lab[1] - 6);
      w.fill(ep[0] - 2, gy(ep[0], ep[1]) - 1, ep[1] - 2, ep[0] + 2, gy(ep[0], ep[1]), ep[1] + 2, m('darkMetal'));
      w.set(ep[0], gy(ep[0], ep[1]) + 1, ep[1], m('neonAmber'));
      w.tPaint(ep[0] - 1, ep[1], p[0] - 16, ep[1] + 1, m('paveDark'));
      w.addLabel('逃脱通道口', ep[0], gy(ep[0], ep[1]) + 4, ep[1], 'minor');

      // 选拔基地（正门红毯 + 结果宣告室）
      p = at(P.selection[0], P.selection[1]); y = gy(p[0], p[1]);
      LIB.podium(w, p[0] - 13, p[1] - 10, p[0] + 13, p[1] + 10, y, 2,
        { body: m('whitePanel2'), glass: m('glassClear'), win: m('windowGold'), roof: 0 });
      w.fill(p[0] - 8, y + 2 * ST + 2, p[1] - 6, p[0] + 8, y + 2 * ST + 14, p[1] + 6, m('whitePanel'));
      LIB.facade(w, p[0] - 8, p[1] - 6, p[0] + 8, p[1] + 6, y + 2 * ST + 2, y + 2 * ST + 13,
        { body: m('whitePanel'), win: m('windowGold'), mullion: m('quartzPillar'), belt: m('goldTrim'), mulEvery: 3 });
      LIB.roofScape(w, p[0] - 8, p[1] - 6, p[0] + 8, p[1] + 6, y + 2 * ST + 15, 3, 77);
      w.tPaint(p[0] - 2, p[1] - 20, p[0] + 2, p[1] - 11, m('redCarpet'));
      LIB.gateArch(w, p[0], p[1] - 13, y, 12, 8, '13', { axis: 'z', neon: m('neonPink') });
      w.addLabel('选拔基地', p[0], y + 24, p[1], 'poi', '模拟驾驶 · 花园参观');

      // APE 行政区（双楼 + 行政广场）
      p = at(P.admin[0], P.admin[1]); y = gy(p[0], p[1]);
      LIB.tower(w, p[0] - 14, p[1] - 8, p[0] - 2, p[1] + 8, y, 30,
        { body: m('concrete'), win: m('windowGold'), mullion: m('concreteDark'), belt: m('goldTrim'), neon: m('neonRed'), neonEvery: 3, roof: 2 });
      LIB.tower(w, p[0] + 2, p[1] - 8, p[0] + 14, p[1] + 8, y, 26,
        { body: m('concrete'), win: m('windowGold'), mullion: m('concreteDark'), belt: m('goldTrim'), neon: m('neonRed'), neonEvery: 3, roof: 1 });
      LIB.skybridge(w, p[0] - 4, p[1], p[0] + 4, p[1], y + 20, 5, { glass: m('glassRed') });
      LIB.plaza(w, p[0] - 16, p[1] + 10, p[0] + 16, p[1] + 22, y, { pave: m('paveDark'), alt: m('pave'), benches: false });
      LIB.holoBoard(w, p[0] - 6, y + 6, p[1] + 10, 'z', 12, 7, m('holoPink'), 1);
      w.addLabel('APE 行政区', p[0], y + 36, p[1], 'poi', '02 被带走 · 特派官');

      // 职工住宅群（六单元排布）
      p = at(P.staff[0], P.staff[1]);
      for (var u = 0; u < 6; u++) {
        var ux = p[0] + (u % 3) * 15 - 15, uz = p[1] + ((u / 3) | 0) * 17;
        var uy = gy(ux, uz);
        LIB.podium(w, ux - 5, uz - 6, ux + 5, uz + 6, uy, 3,
          { body: u % 2 ? m('whitePanel2') : m('concrete'), glass: m('glassClear'),
            win: m('windowWarm'), roof: u % 2 });
        LIB.acUnits(w, ux - 4, uz - 5, ux + 4, uz + 5, uy + 13, 100 + u);
        w.tPaint(ux - 7, uz + 7, ux + 7, uz + 9, m('paveWarm'));
        LIB.tree(w, ux + 7, uz + 8, uy, 5, 'broad');
      }
      w.addLabel('职工住宅群', p[0], gy(p[0], p[1]) + 18, p[1] + 8, 'minor');
    })();

    /* =================================================================
       5. 东厢：文教·生活区（学校 / 培训中心 / 商业 / 庄园 / 鸟笼花园）
       ================================================================= */
    (function () {
      var C = P.eastCompound;
      var x0 = CX + C[0], z0 = CZ + C[1], x1 = CX + C[2], z1 = CZ + C[3];
      VX._flatRect(x0 - 4, z0 - 4, x1 + 4, z1 + 4, BY - 1, 12, m('pave'), m('concrete'));
      var yb = gy((x0 + x1) / 2 | 0, (z0 + z1) / 2 | 0);
      LIB.courtyard(w, x0, z0, x1, z1, yb,
        { wall: m('whitePanel2'), h: 5, gateSide: 'x0z0z1', neon: m('neonGreen'),
          pave1: m('pave'), pave2: m('paveWarm'), postEvery: 10 });
      var mz = ((z0 + z1) / 2) | 0;
      LIB.gateArch(w, x0, mz, yb, 18, 10, 'SCHOOL', { axis: 'x', post: m('whitePanel'), beam: m('copperRoof'), neon: m('neonGreen') });

      // 驾驶员学校（主楼 + 操场 + 看台）
      var p = at(P.school[0], P.school[1]), y = gy(p[0], p[1]);
      LIB.podium(w, p[0] - 16, p[1] - 9, p[0] + 16, p[1] + 9, y, 3,
        { body: m('whitePanel'), glass: m('glassClear'), win: m('windowWarm'), trim: m('copperRoof'), roof: 0 });
      w.fill(p[0] - 4, y + 3 * ST + 2, p[1] - 4, p[0] + 4, y + 3 * ST + 12, p[1] + 4, m('brickWhite'));
      w.cone(p[0], p[1], y + 3 * ST + 13, y + 3 * ST + 20, 5, 1, m('copperRoof'));
      w.set(p[0], y + 3 * ST + 21, p[1], m('goldTrim'));
      LIB.neonSign(w, p[0] - 10, y + 15, p[1] - 10, 'z', 'SCHOOL', m('neonGreen'), { dir: -1 });
      VX._grassPatch(p[0] + 2, p[1] + 26, 18, 0x5C40);
      w.tPaintDisc(p[0] + 2, p[1] + 26, 15, m('grassDark'), 12);
      LIB.perim(w, p[0] - 12, p[1] + 14, p[0] + 16, p[1] + 38, y, m('curb'));
      for (var b = 0; b < 4; b++) w.fill(p[0] + 17, y + b, p[1] + 16, p[0] + 20 - b, y + b, p[1] + 36, m('paveDark'));
      w.addLabel('驾驶员学校', p[0], y + 34, p[1], 'poi', '文教园区');

      // 培训中心（教学楼）
      p = at(P.teaching[0], P.teaching[1]); y = gy(p[0], p[1]);
      LIB.tower(w, p[0] - 12, p[1] - 8, p[0] + 12, p[1] + 8, y, 28,
        { body: m('whitePanel2'), win: m('windowCool'), mullion: m('concrete'), belt: m('whitePanel'),
          neon: m('neonCyan'), neonEvery: 3, roof: 0, mulEvery: 4 });
      LIB.plaza(w, p[0] - 14, p[1] + 10, p[0] + 14, p[1] + 20, y, { pave: m('whiteTile'), alt: m('paveWarm') });
      LIB.gateArch(w, p[0] + 24, p[1] + 4, y, 14, 9, 'EDU', { axis: 'x', neon: m('neonCyan') });
      w.addLabel('培训中心', p[0], y + 34, p[1], 'poi');

      // 商业区（四个小街区 + 霓虹街）
      p = at(P.commerce[0], P.commerce[1]);
      for (var k = 0; k < 4; k++) {
        var sx = p[0] + (k % 2) * 20 - 10, sz = p[1] + ((k / 2) | 0) * 20 - 10;
        LIB.streetBlock(w, sx - 7, sz - 7, sx + 7, sz + 7, gy(sx, sz), 0x2200 + k * 51, { minStory: 4, maxStory: 8 });
      }
      w.tPaint(p[0] - 2, p[1] - 22, p[0] + 2, p[1] + 22, m('asphaltWorn'));
      for (var z = p[1] - 20; z <= p[1] + 20; z += 6) {
        w.set(p[0] - 3, gy(p[0] - 3, z), z, m('roadNeonPink'));
        w.set(p[0] + 3, gy(p[0] + 3, z), z, m('roadNeon'));
      }
      w.addLabel('商业区', p[0], gy(p[0], p[1]) + 26, p[1], 'minor');

      // 驾驶员庄园（孩子们的家 · 樱花庭院）
      p = at(P.manor[0], P.manor[1]); y = gy(p[0], p[1]);
      VX._flatRect(p[0] - 22, p[1] - 18, p[0] + 22, p[1] + 18, y - 1, 10, m('paveWarm'), m('concrete'));
      VX._grassPatch(p[0], p[1] + 14, 16, 0x8A11);
      // 主楼（三层 + 铜坡顶）
      w.fill(p[0] - 17, y, p[1] - 10, p[0] + 17, y + 11, p[1] + 6, m('brickWhite'));
      LIB.facade(w, p[0] - 17, p[1] - 10, p[0] + 17, p[1] + 6, y, y + 11,
        { body: m('brickWhite'), win: m('windowWarm'), mullion: m('woodWhite'), belt: m('copperRoof'),
          mulEvery: 4, beltEvery: 2, storyH: 4 });
      for (var r = 0; r <= 4; r++)
        w.fill(p[0] - 17 + r, y + 12 + r, p[1] - 10 + r, p[0] + 17 - r, y + 12 + r, p[1] + 6 - r, m('copperRoof'));
      // 两翼
      w.fill(p[0] - 20, y, p[1] - 6, p[0] - 15, y + 7, p[1] + 10, m('brickWhite'));
      w.fill(p[0] + 15, y, p[1] - 6, p[0] + 20, y + 7, p[1] + 10, m('brickWhite'));
      w.fill(p[0] - 20, y + 8, p[1] - 6, p[0] - 15, y + 8, p[1] + 10, m('copperRoof'));
      w.fill(p[0] + 15, y + 8, p[1] - 6, p[0] + 20, y + 8, p[1] + 10, m('copperRoof'));
      // 门廊 + 台阶
      w.fill(p[0] - 5, y, p[1] + 7, p[0] + 5, y + 6, p[1] + 9, m('woodWhite'));
      w.fill(p[0] - 5, y + 7, p[1] + 6, p[0] + 5, y + 7, p[1] + 10, m('copperRoof'));
      w.fill(p[0] - 2, y, p[1] + 10, p[0] + 2, y + 3, p[1] + 10, m('windowGold'));
      w.tPaint(p[0] - 3, p[1] + 11, p[0] + 3, p[1] + 20, m('brickPave'));
      // 樱花庭院
      LIB.tree(w, p[0] + 9, p[1] + 16, y, 8, 'cherry');
      LIB.tree(w, p[0] - 9, p[1] + 17, y, 7, 'cherry');
      LIB.tree(w, p[0] + 1, p[1] + 22, y, 9, 'cherry');
      LIB.bench(w, p[0] + 5, p[1] + 20, y, 'x');
      LIB.bench(w, p[0] - 7, p[1] + 20, y, 'x');
      LIB.planter(w, p[0], p[1] + 14, y, 3, 0x71);
      LIB.streetLamp(w, p[0] - 12, p[1] + 13, y, 'warm');
      LIB.streetLamp(w, p[0] + 12, p[1] + 13, y, 'warm');
      LIB.fenceWall(w, [[p[0] - 21, p[1] + 24], [p[0] + 21, p[1] + 24]], y, 2, m('woodWhite'), { postEvery: 6 });
      w.addLabel('驾驶员庄园', p[0], y + 20, p[1], 'poi', '13 小队的家 · 樱花树下');

      // 鸟笼花园（穹顶花园 · 婚礼场地）
      p = at(P.birdcage[0], P.birdcage[1]); y = gy(p[0], p[1]);
      VX._flatRect(p[0] - 19, p[1] - 19, p[0] + 19, p[1] + 19, y - 1, 8, m('paveWarm'), m('concrete'));
      VX._grassPatch(p[0], p[1], 16, 0x2C33);
      // 笼架：24 条经线 + 三道纬环（镂空可见内部）
      for (var c = 0; c < 24; c++) {
        var ca = c * Math.PI / 12;
        for (var t2 = 0; t2 <= 20; t2++) {
          var an = (t2 / 20) * Math.PI / 2;
          w.set(Math.round(p[0] + Math.cos(ca) * 16 * Math.cos(an)), Math.round(y + 18 * Math.sin(an)),
            Math.round(p[1] + Math.sin(ca) * 16 * Math.cos(an)), c % 4 === 0 ? m('goldTrim') : m('steelDark'));
        }
      }
      w.ring(p[0], p[1], 15.4, 16.6, y, y + 1, m('goldTrim'));
      w.ring(p[0], p[1], 13.0, 13.9, y + 10, y + 10, m('neonPink'));
      w.ring(p[0], p[1], 8.0, 8.9, y + 15, y + 15, m('neonPink'));
      w.fill(p[0], y + 18, p[1], p[0], y + 21, p[1], m('goldTrim'));
      w.set(p[0], y + 22, p[1], m('neonWhite'));
      // 内部：花坛环 + 婚礼拱门 + 小池
      w.tPaintDisc(p[0], p[1], 15, m('grass'), 0, m('dirt'));
      var fi;
      for (fi = 0; fi < 12; fi++) {
        var fa = fi * Math.PI / 6;
        LIB.planter(w, Math.round(p[0] + Math.cos(fa) * 11), Math.round(p[1] + Math.sin(fa) * 11), y, 2.0, fi * 13);
      }
      w.tCrater(p[0], p[1] - 6, 4, -2, 2);
      w.tWaterDisc(p[0], p[1] - 6, 3, y - 1, m('waterNeon'));
      LIB.gateArch(w, p[0], p[1] + 5, y, 9, 6, '', { axis: 'z', post: m('woodWhite'), beam: m('flowerPink'), neon: m('neonPink') });
      w.tPaint(p[0] - 1, p[1] + 6, p[0] + 1, p[1] + 15, m('whiteTile'));
      for (fi = 0; fi < 3; fi++) { LIB.bench(w, p[0] - 4, p[1] + 7 + fi * 3, y, 'x'); LIB.bench(w, p[0] + 2, p[1] + 7 + fi * 3, y, 'x'); }
      LIB.tree(w, p[0] - 8, p[1] + 1, y, 6, 'cherry');
      LIB.tree(w, p[0] + 8, p[1] + 1, y, 6, 'cherry');
      w.addLabel('鸟笼花园', p[0], y + 26, p[1], 'poi', '心与满 · 花园婚礼');
    })();

    /* =================================================================
       6. 前院：南部作战区（会议中心 / 档案馆 / 指挥 / 训练 / 机库 / 出击门）
       ================================================================= */
    (function () {
      var p, y, k;
      // 会议中心（西）与档案馆（东）—— 关于中轴对称
      var pair = [[P.conference, '会议中心', m('neonBlue'), 'CONF'], [P.archive, 'APE 档案馆', m('neonViolet'), 'ARCH']];
      for (k = 0; k < 2; k++) {
        p = at(pair[k][0][0], pair[k][0][1]); y = gy(p[0], p[1]);
        VX._flatRect(p[0] - 18, p[1] - 14, p[0] + 18, p[1] + 14, y - 1, 8, m('whiteTile'), m('marble'));
        LIB.podium(w, p[0] - 15, p[1] - 11, p[0] + 15, p[1] + 11, y, 2,
          { body: m('whitePanel'), glass: m('glassCyan'), win: m('windowCool'), trim: m('goldTrim'), roof: 1 });
        w.dome(p[0], p[1], y + 2 * ST + 2, 11, m('steelDark'),
          { yScale: 0.8, thick: 1, rib: m('goldTrim'), ribEvery: 30, glass: m('glassGold') });
        w.set(p[0], y + 2 * ST + 12, p[1], m('neonWhite'));
        LIB.neonSign(w, p[0] - 9, y + 11, p[1] - 12, 'z', pair[k][3], pair[k][2], { dir: -1 });
        LIB.plaza(w, p[0] - 16, p[1] + 13, p[0] + 16, p[1] + 22, y, { pave: m('whiteTile'), alt: m('paveDark') });
        w.addLabel(pair[k][1], p[0], y + 22, p[1], 'poi');
      }

      // 指挥中心（西）：大体量 + 天台（交心之夜）
      p = at(P.command[0], P.command[1]); y = gy(p[0], p[1]);
      VX._flatRect(p[0] - 26, p[1] - 22, p[0] + 26, p[1] + 22, y - 1, 10, m('paveDark'), m('concreteDark'));
      w.fill(p[0] - 22, y, p[1] - 18, p[0] + 22, y + 12, p[1] + 18, m('concrete'));
      LIB.facade(w, p[0] - 22, p[1] - 18, p[0] + 22, p[1] + 18, y, y + 12,
        { body: m('concrete'), win: m('windowCool'), mullion: m('concreteDark'), belt: m('steelDark'),
          mulEvery: 3, beltEvery: 2, neon: m('neonBlue'), neonEvery: 2 });
      LIB.eave(w, p[0] - 22, p[1] - 18, p[0] + 22, p[1] + 18, y + 13, 2, m('steelDark'));
      w.fill(p[0] - 14, y + 14, p[1] - 11, p[0] + 14, y + 30, p[1] + 11, m('whitePanel'));
      LIB.facade(w, p[0] - 14, p[1] - 11, p[0] + 14, p[1] + 11, y + 14, y + 30,
        { body: m('whitePanel'), win: m('windowGold'), mullion: m('concrete'), belt: m('goldTrim'), mulEvery: 3 });
      // 玻璃电梯核心
      w.fill(p[0] + 15, y, p[1] - 3, p[0] + 18, y + 33, p[1] + 3, m('glassCyan'));
      w.frame(p[0] + 15, y, p[1] - 3, p[0] + 18, y + 33, p[1] + 3, m('steel'));
      // 天台
      w.fill(p[0] - 14, y + 31, p[1] - 11, p[0] + 14, y + 31, p[1] + 11, m('paveDark'));
      LIB.perim(w, p[0] - 14, p[1] - 11, p[0] + 14, p[1] + 11, y + 32, m('steelDark'));
      LIB.perimDots(w, p[0] - 14, p[1] - 11, p[0] + 14, p[1] + 11, y + 33, 4, m('neonCyan'));
      LIB.bench(w, p[0] - 3, p[1] + 6, y + 31, 'x');
      LIB.bench(w, p[0] + 3, p[1] + 6, y + 31, 'x');
      LIB.antennaMast(w, p[0] - 10, p[1] - 7, y + 32, 16);
      LIB.antennaMast(w, p[0] + 10, p[1] - 7, y + 32, 13);
      w.disc(p[0], p[1] - 4, 4, y + 32, m('roadLineWarm'));
      LIB.searchlight(w, p[0] - 18, p[1] + 16, y + 14, 4, [-0.5, 0.7, 0.3], m('beamCyan'));
      LIB.holoBoard(w, p[0] - 10, y + 16, p[1] - 19, 'z', 18, 9, m('holoScreen'), -1);
      w.addLabel('指挥中心', p[0], y + 38, p[1], 'poi', '娜娜简报 · 天台交心之夜');

      // 训练中心（东，对称）
      p = at(P.training[0], P.training[1]); y = gy(p[0], p[1]);
      VX._flatRect(p[0] - 22, p[1] - 20, p[0] + 22, p[1] + 20, y - 1, 10, m('paveDark'), m('concreteDark'));
      w.fill(p[0] - 18, y, p[1] - 14, p[0] + 18, y + 16, p[1] + 14, m('concrete'));
      LIB.facade(w, p[0] - 18, p[1] - 14, p[0] + 18, p[1] + 14, y, y + 16,
        { body: m('concrete'), win: m('windowCool'), mullion: m('steelDark'), belt: m('hazard'),
          mulEvery: 4, beltEvery: 3, neon: m('neonAmber'), neonEvery: 2 });
      // 模拟舱阵（半开放）
      for (k = 0; k < 5; k++) {
        var sx = p[0] - 12 + k * 6;
        w.fill(sx - 2, y + 17, p[1] - 4, sx + 2, y + 22, p[1] + 4, m('steelDark'));
        w.fill(sx - 1, y + 19, p[1] - 5, sx + 1, y + 21, p[1] - 5, m('glassCyan'));
        w.set(sx, y + 23, p[1], m('neonAmber'));
      }
      LIB.roofScape(w, p[0] - 18, p[1] - 14, p[0] + 18, p[1] + 14, y + 17, 3, 613);
      LIB.neonSign(w, p[0] - 9, y + 14, p[1] - 15, 'z', 'TRAIN', m('neonAmber'), { dir: -1 });
      w.addLabel('训练中心', p[0], y + 26, p[1], 'poi', '五郎受伤');

      // 机库综合体（可见内部 · FRANXX 停机位）
      p = at(P.hangar[0], P.hangar[1]); y = gy(p[0], p[1]);
      var hx0 = p[0] - 38, hx1 = p[0] + 38, hz0 = p[1] - 24, hz1 = p[1] + 24;
      VX._flatRect(hx0 - 12, hz0 - 14, hx1 + 12, hz1 + 30, y - 1, 12, m('asphalt'), m('concreteDark'));
      // 外壳（空心，南面开大门）
      w.shell(hx0, y, hz0, hx1, y + 30, hz1, m('whitePanel2'), m('grate'), m('steelDark'));
      LIB.facade(w, hx0, hz0, hx1, hz1, y, y + 29,
        { body: m('whitePanel2'), win: m('windowCool'), mullion: m('steelDark'), belt: m('hazard'),
          mulEvery: 5, beltEvery: 4, neon: m('neonCyan'), neonEvery: 3, skipBase: 6 });
      // 屋顶桁架
      for (k = hx0 + 3; k <= hx1 - 3; k += 6) {
        w.fill(k, y + 30, hz0, k, y + 33, hz1, m('girder'));
        w.fill(k - 1, y + 33, hz0 + 2, k + 1, y + 33, hz1 - 2, m('steelDark'));
      }
      w.fill(hx0, y + 34, hz0, hx1, y + 34, hz1, m('steelDark'));
      LIB.perimDots(w, hx0, hz0, hx1, hz1, y + 35, 5, m('neonCyan'));
      // 出击大门（南面洞口 + 警示条）
      w.fill(p[0] - 15, y, hz1 - 1, p[0] + 15, y + 21, hz1 + 1, 0);
      for (k = 0; k <= 21; k += 3) w.fill(p[0] - 16, y + k, hz1, p[0] + 16, y + k, hz1, m('hazard'));
      w.fill(p[0] - 17, y, hz1, p[0] - 16, y + 22, hz1, m('hazardDark'));
      w.fill(p[0] + 16, y, hz1, p[0] + 17, y + 22, hz1, m('hazardDark'));
      w.fill(p[0] - 17, y + 23, hz1 + 1, p[0] + 17, y + 23, hz1 + 1, m('neonRed'));
      w.text('SORTIE', p[0] - 20, y + 28, hz1 + 1, 'z', m('neonRed'));
      // 内部：五个停机位 + FRANXX 机体
      var mechCols = [
        [m('mechaPink'), m('mechaRed')], [m('mechaBlue'), m('mechaWhite')],
        [m('mechaGrey'), m('mechaGreen')], [m('mechaWhite'), m('mechaGreen')],
        [m('mechaRed'), m('mechaDark')]];
      var mechNames = ['鹤望兰', '得利卡特', '银莲花', '结缘花', '蔷薇'];
      for (k = 0; k < 5; k++) {
        var bx = hx0 + 8 + k * 15;
        w.fill(bx - 5, y, hz0 + 4, bx + 5, y, hz0 + 20, m('grate'));
        LIB.perim(w, bx - 6, hz0 + 3, bx + 6, hz0 + 21, y, m('hazard'));
        w.fill(bx - 6, y + 1, hz0 + 2, bx - 6, y + 12, hz0 + 2, m('girder'));
        w.fill(bx + 6, y + 1, hz0 + 2, bx + 6, y + 12, hz0 + 2, m('girder'));
        w.fill(bx - 6, y + 12, hz0 + 2, bx + 6, y + 12, hz0 + 2, m('steelDark'));
        w.set(bx, y + 13, hz0 + 2, m('lampCool'));
        LIB.mecha(w, bx, y + 1, hz0 + 12, 20, { main: mechCols[k][0], accent: mechCols[k][1] });
        w.text('' + (k + 1), bx - 2, y + 5, hz0 + 3, 'z', m('roadLineWarm'));
      }
      // 高空登机廊 + 观察控制室
      LIB.skybridge(w, hx0 + 4, p[1] + 14, hx1 - 4, p[1] + 14, y + 16, 5, { glass: m('glassGold') });
      w.fill(p[0] - 8, y + 35, hz1 - 12, p[0] + 8, y + 41, hz1 - 4, m('whitePanel'));
      w.fill(p[0] - 8, y + 37, hz1 - 13, p[0] + 8, y + 39, hz1 - 13, m('glassCyan'));
      LIB.roofScape(w, p[0] - 8, hz1 - 12, p[0] + 8, hz1 - 4, y + 42, 2, 909);
      // 前广场 + 跑道
      LIB.plaza(w, p[0] - 30, hz1 + 4, p[0] + 30, hz1 + 14, y, { pave: m('whiteTile'), alt: m('paveDark'), planters: false });
      w.tPaint(p[0] - 12, hz1 + 14, p[0] + 12, hz1 + 60, m('asphalt'), m('concreteDark'));
      for (k = hz1 + 16; k < hz1 + 58; k += 6) w.tPaint(p[0] - 1, k, p[0] + 1, k + 2, m('roadLineWarm'));
      for (k = hz1 + 8; k < hz1 + 58; k += 10) {
        LIB.streetLamp(w, p[0] - 14, k, gy(p[0] - 14, k), 'tall');
        LIB.streetLamp(w, p[0] + 14, k, gy(p[0] + 14, k), 'tall');
      }
      w.addLabel('机库综合体', p[0], y + 46, p[1], 'poi', '5 个 FRANXX 停机位 · 出击门');

      // 出击门（底盘出口）
      p = at(P.sortieGate[0], P.sortieGate[1]); y = gy(p[0], p[1]);
      w.fill(p[0] - 18, y, p[1] - 2, p[0] + 18, y + 24, p[1] + 2, m('darkMetal'));
      w.fill(p[0] - 14, y, p[1] - 3, p[0] + 14, y + 18, p[1] + 3, 0);
      for (k = 0; k <= 18; k += 3) w.fill(p[0] - 14, y + k, p[1] - 2, p[0] + 14, y + k, p[1] - 2, m('hazard'));
      w.fill(p[0] - 18, y + 25, p[1] - 2, p[0] + 18, y + 25, p[1] + 2, m('neonRed'));
      LIB.searchlight(w, p[0] - 20, p[1], y, 12, [-0.3, 0.9, 0.3], m('beamRed'));
      LIB.searchlight(w, p[0] + 20, p[1], y, 12, [0.3, 0.9, 0.3], m('beamRed'));
      w.addLabel('出击门', p[0], y + 30, p[1], 'poi');

      // 工业区（东南）
      p = at(P.industry[0], P.industry[1]); y = gy(p[0], p[1]);
      VX._flatRect(p[0] - 26, p[1] - 22, p[0] + 26, p[1] + 22, y - 1, 10, m('asphaltWorn'), m('concreteDark'));
      w.fill(p[0] - 22, y, p[1] - 14, p[0] - 2, y + 14, p[1] + 6, m('steelDark'));
      LIB.facade(w, p[0] - 22, p[1] - 14, p[0] - 2, p[1] + 6, y, y + 14,
        { body: m('steelDark'), win: m('windowDim'), mullion: m('girder'), belt: m('hazard'), mulEvery: 4, beltEvery: 3 });
      for (k = 0; k < 4; k++) w.fill(p[0] - 22 + k * 6, y + 15, p[1] - 14, p[0] - 19 + k * 6, y + 17, p[1] + 6, m('rustMetal'));
      LIB.stack(w, p[0] - 18, p[1] + 12, y, 3, 30);
      LIB.stack(w, p[0] - 8, p[1] + 12, y, 2.4, 24);
      LIB.tank(w, p[0] + 8, p[1] - 8, y, 6, 12, {});
      LIB.tank(w, p[0] + 20, p[1] - 8, y, 5, 10, {});
      LIB.tank(w, p[0] + 14, p[1] + 6, y, 4.4, 9, {});
      LIB.pipes(w, [[p[0] - 2, p[1] - 6], [p[0] + 8, p[1] - 6], [p[0] + 8, p[1] + 2], [p[0] + 20, p[1] + 2]], y + 6, m('rustMetal'));
      LIB.pipes(w, [[p[0] - 2, p[1] + 2], [p[0] + 14, p[1] + 2]], y + 9, m('steelDark'));
      for (k = 0; k < 6; k++) LIB.container(w, p[0] - 20 + (k % 3) * 9, p[1] + 16, y, 'x',
        [m('mechaRed'), m('mechaBlue'), m('mechaGreen'), m('rustMetal')][k % 4]);
      LIB.vent(w, p[0] + 2, p[1] + 14, y, 8, 1);
      LIB.holoBoard(w, p[0] - 20, y + 18, p[1] - 15, 'z', 12, 7, m('holoGreen'), -1);
      w.addLabel('工业区', p[0], y + 34, p[1], 'poi');

      // 农田（西南，与工业区对称）
      p = at(P.farm[0], P.farm[1]); y = gy(p[0], p[1]);
      VX._flatRect(p[0] - 24, p[1] - 20, p[0] + 24, p[1] + 20, y - 1, 10, m('dirt'), m('dirtDark'));
      for (k = -20; k <= 20; k += 3) {
        w.tPaint(p[0] - 22, p[1] + k, p[0] + 22, p[1] + k, m('crop'));
        w.tPaint(p[0] - 22, p[1] + k + 1, p[0] + 22, p[1] + k + 1, m('cropRow'));
      }
      w.tPaint(p[0] - 1, p[1] - 20, p[0] + 1, p[1] + 20, m('paveWarm'));
      // 温室 ×3
      for (k = 0; k < 3; k++) {
        var gx = p[0] - 14 + k * 14, gz = p[1] - 24;
        w.fill(gx - 5, y, gz - 4, gx + 5, y + 4, gz + 4, m('glassGreen'));
        w.frame(gx - 5, y, gz - 4, gx + 5, y + 4, gz + 4, m('steel'));
        w.fill(gx - 5, y + 5, gz - 4, gx + 5, y + 5, gz + 4, m('glassClear'));
        w.set(gx, y + 6, gz, m('lampWarm'));
      }
      LIB.tank(w, p[0] + 20, p[1] + 18, y, 3.4, 7, {});
      w.addLabel('农田与温室', p[0], y + 12, p[1], 'minor');
    })();

    /* =================================================================
       7. 后院：森林区（密林 / 森林湖 / 槲寄生巨树 / 自然小径）
       ================================================================= */
    (function () {
      var F = P.forest;
      var fx0 = CX + F[0], fz0 = CZ + F[1], fx1 = CX + F[2], fz1 = CZ + F[3];
      // 草地基底（保护既有铺装，避免覆盖中轴林荫道）
      w.setGuard(true);
      var gx, gz;
      for (gz = fz0; gz <= fz1; gz += 12) for (gx = fx0; gx <= fx1; gx += 12)
        VX._grassPatch(gx, gz, 13, 0x4000 + gx * 7 + gz);
      // 森林湖
      var lk = at(P.lake[0], P.lake[1]);
      w.tCrater(lk[0], lk[1], P.lake[2], -6, 8, m('sand'));
      w.tWaterDisc(lk[0], lk[1], P.lake[2] - 3, gy(lk[0], lk[1]) + 2, m('water'));
      w.tPaintDisc(lk[0], lk[1], P.lake[2] + 3, m('sand'), P.lake[2] - 2, m('sandDark'));
      w.addLabel('森林湖', lk[0], gy(lk[0], lk[1]) + 6, lk[1], 'poi', '相遇之地');
      var lk2 = at(P.lake2[0], P.lake2[1]);
      w.tCrater(lk2[0], lk2[1], P.lake2[2], -4, 4);
      w.tWaterDisc(lk2[0], lk2[1], P.lake2[2] - 2, gy(lk2[0], lk2[1]) + 1, m('waterNeon'));
      // 槲寄生巨树
      var gt = at(P.giantTree[0], P.giantTree[1]);
      LIB.tree(w, gt[0], gt[1], gy(gt[0], gt[1]), 46, 'giant');
      w.tPaintDisc(gt[0], gt[1], 18, m('grassNeon'), 0, m('dirt'));
      w.tPaintDisc(gt[0], gt[1], 22, m('grassDark'), 18);
      for (var fi = 0; fi < 10; fi++) {
        var fa = fi * 0.628;
        w.set(Math.round(gt[0] + Math.cos(fa) * 16), gy(gt[0], gt[1]), Math.round(gt[1] + Math.sin(fa) * 16), m('flowerWhite'));
      }
      w.addLabel('槲寄生巨树', gt[0], gy(gt[0], gt[1]) + 56, gt[1], 'poi', '森林禁入区');
      // 密林散布（避开水面与道路）
      var roadMats = [m('asphalt'), m('asphaltWorn'), m('roadLine'), m('roadNeon'), m('roadNeonPink'),
        m('whiteTile'), m('pave'), m('paveDark'), m('paveWarm'), m('marble'), m('curb'), m('water'),
        m('waterNeon'), m('brickPave'), m('redCarpet')];
      function freeAt(x, z) {
        if (w.tH(x, z) < 0 || w.W[z * VX.SX + x]) return false;
        var mm = w.tM(x, z);
        for (var q = 0; q < roadMats.length; q++) if (mm === roadMats[q]) return false;
        return w.get(x, gy(x, z), z) === 0;
      }
      var kinds = ['pine', 'pine', 'broad', 'birch', 'pine', 'neon'];
      var mnr = at(P.manor[0], P.manor[1]), bcg = at(P.birdcage[0], P.birdcage[1]);
      function excluded(x, z) {
        if (Math.hypot(x - lk[0], z - lk[1]) < P.lake[2] + 5) return true;
        if (Math.hypot(x - gt[0], z - gt[1]) < 20) return true;
        if (Math.hypot(x - mnr[0], z - mnr[1]) < 30) return true;
        if (Math.hypot(x - bcg[0], z - bcg[1]) < 22) return true;
        if (Math.abs(x - CX) < 12 && z > CZ - 172) return true;
        return false;
      }
      w.scatter(fx0, fz0, fx1, fz1, 1250, 0x1F0E57, function (x, z, rnd) {
        if (Math.hypot(x - CX, z - CZ) > P.domeR - 8) return;
        if (excluded(x, z)) return;
        if (!freeAt(x, z)) return;
        var n = M.fbm(x * 0.035, z * 0.035, 2, 0x91);
        if (n < 0.34) return;
        var kk = kinds[(rnd() * kinds.length) | 0];
        LIB.tree(w, x, z, gy(x, z), 5 + ((rnd() * 6) | 0), kk);
      });
      // 灌木与花
      w.scatter(fx0, fz0, fx1, fz1, 900, 0x51B, function (x, z, rnd) {
        if (Math.hypot(x - CX, z - CZ) > P.domeR - 8) return;
        if (excluded(x, z)) return;
        if (!freeAt(x, z)) return;
        w.set(x, gy(x, z), z, rnd() < 0.6 ? m('shrub') : (rnd() < 0.5 ? m('flowerRed') : m('flowerWhite')));
      });
      // 自然小径：选拔基地 → 森林湖
      var sp = at(P.selection[0], P.selection[1] - 14);
      w.tRoad([[sp[0], sp[1]], [sp[0] + 10, sp[1] - 40], [lk[0] - 22, lk[1] + 24], [lk[0] - 6, lk[1] + P.lake[2] - 1]],
        4, m('paveWarm'), { name: 'R14 选拔→湖' });
      LIB.gateArch(w, sp[0] + 4, sp[1] - 16, gy(sp[0] + 4, sp[1] - 16), 8, 6, '', { axis: 'z', post: m('wood'), beam: m('woodDark'), neon: m('neonGreen') });
      // 逃脱小径
      var esc = at(P.lab[0] - 40, P.lab[1] - 8);
      w.tRoad([[esc[0], esc[1]], [esc[0] + 6, esc[1] - 46], [esc[0] + 44, esc[1] - 86]],
        3, m('gravel'), { name: '逃脱小径' });
      LIB.gateArch(w, esc[0] + 3, esc[1] - 24, gy(esc[0] + 3, esc[1] - 24), 8, 6, '', { axis: 'z', post: m('wood'), beam: m('woodDark'), neon: m('neonAmber') });
      // 湖畔栈道与灯
      for (var q2 = 0; q2 < 10; q2++) {
        var qa = q2 * 0.628;
        var qx = Math.round(lk[0] + Math.cos(qa) * (P.lake[2] + 4)), qz = Math.round(lk[1] + Math.sin(qa) * (P.lake[2] + 4));
        LIB.streetLamp(w, qx, qz, gy(qx, qz), 'neon');
      }
      w.fill(lk[0] - 2, gy(lk[0], lk[1] + P.lake[2]) , lk[1] + P.lake[2] - 6, lk[0] + 2, gy(lk[0], lk[1] + P.lake[2]), lk[1] + P.lake[2] + 2, m('wood'));
      w.setGuard(false);
    })();

    /* --- 视角锚点 --- */
    return w;
  };
})(window);
