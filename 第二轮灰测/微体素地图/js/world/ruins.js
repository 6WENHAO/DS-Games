/* =====================================================================
   微体素地图 · 废弃城市（第7种植园废墟）
   风格：沙化废墟 + 建筑密集 + 残存霓虹故障闪断
   场地：中心 (196,596)，可用 x[80,312] × z[472,720]
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, m = VX.m, LAY = VX.LAY, LIB = VX.LIB;

  VX.buildRuins = function (w) {
    var R = LAY.ruins, CX = R.cx, CZ = R.cz;
    var X0 = CX - R.hw, X1 = CX + R.hw, Z0 = CZ - R.hh, Z1 = CZ + R.hh;
    function gy(x, z) { var h = w.tH(x, z); return h < 0 ? LAY.ground - 1 : h + 1; }
    var i, j, k, x, z, y;

    /* ---------------- 1. 街网（贴格骨架） ---------------- */
    var RX = [96, 130, 164, 196, 228, 262, 296];      // 南北向街道
    var RZ = [486, 520, 554, 596, 632, 664, 704];     // 东西向街道
    var asf = m('asphaltWorn'), crk = m('asphaltCrack');
    // 主十字（宽）
    w.tRoad([[CX, Z0 - 6], [CX, Z1 + 6]], 11, asf, { curb: m('rubble'), name: '废城中央大街' });
    w.tRoad([[X0 - 6, CZ], [X1 + 6, CZ]], 11, asf, { curb: m('rubble'), name: '废城横街' });
    for (i = 0; i < RX.length; i++) {
      if (RX[i] === CX) continue;
      w.tRoad([[RX[i], Z0 - 2], [RX[i], Z1 + 2]], 7, i % 2 ? crk : asf, { curb: m('rubble') });
    }
    for (i = 0; i < RZ.length; i++) {
      if (RZ[i] === CZ) continue;
      w.tRoad([[X0 - 2, RZ[i]], [X1 + 2, RZ[i]]], 7, i % 2 ? crk : asf, { curb: m('rubble') });
    }
    // 巷道（每街区中缝）
    for (i = 0; i < RX.length - 1; i++) {
      var mx = ((RX[i] + RX[i + 1]) / 2) | 0;
      w.tRoad([[mx, Z0], [mx, Z1]], 4, crk, {});
    }
    // 对外接驳：北接支路、东接东西横轴
    w.tRoad([[CX, Z0 - 6], [CX, 300]], 8, asf, { curb: m('rubble'), name: '废城北入' });
    w.tRoad([[X1 + 4, CZ], [340, CZ]], 8, asf, { curb: m('rubble'), name: '废城东入' });

    /* ---------------- 2. 沙化与积水 ---------------- */
    w.setGuard(true);
    w.scatter(X0 - 8, Z0 - 8, X1 + 8, Z1 + 8, 520, 0x5A0D, function (px, pz, rnd) {
      var r = 3 + rnd() * 8;
      var mm = rnd() < 0.55 ? m('sand') : m('sandDark');
      w.tPaintDisc(px, pz, r, mm, 0, m('sand'));
    });
    w.setGuard(false);
    // 风蚀沙丘（缓丘）
    w.setGuard(true);
    w.scatter(X0, Z0, X1, Z1, 16, 0x51D0, function (px, pz, rnd) {
      w.tCrater(px, pz, 10 + rnd() * 12, 1 + ((rnd() * 3) | 0), 8, m('dune'));
    });
    w.setGuard(false);
    // 街面积水（映霓虹）
    var puddles = [[164, 566], [228, 610], [196, 662], [130, 634], [262, 540], [186, 512], [246, 690]];
    for (i = 0; i < puddles.length; i++) {
      var px = puddles[i][0], pz = puddles[i][1];
      w.tCrater(px, pz, 6, -1, 3);
      w.tWaterDisc(px, pz, 4.5, gy(px, pz) - 1, m('water'));
      w.tPaintDisc(px, pz, 7, m('roadNeon'), 5.6);
    }

    /* ---------------- 3. 密集街区（约 84 栋废墟楼） ---------------- */
    var rnd = M.rng(0x7EE7);
    var built = 0, skip = [];
    // 地标占位（这些街区不放普通楼）
    skip.push([R.park[0], R.park[1], 30]);
    skip.push([R.church[0], R.church[1], 20]);
    skip.push([R.mall[0], R.mall[1], 24]);
    skip.push([R.apartments[0], R.apartments[1], 26]);

    function blocked(bx, bz) {
      for (var q = 0; q < skip.length; q++)
        if (Math.hypot(bx - skip[q][0], bz - skip[q][1]) < skip[q][2]) return true;
      return false;
    }

    for (i = 0; i < RX.length - 1; i++) {
      for (j = 0; j < RZ.length - 1; j++) {
        var bx0 = RX[i] + 5, bx1 = RX[i + 1] - 5;
        var bz0 = RZ[j] + 5, bz1 = RZ[j + 1] - 5;
        var bcx = ((bx0 + bx1) / 2) | 0, bcz = ((bz0 + bz1) / 2) | 0;
        if (blocked(bcx, bcz)) continue;
        // 巷道把街区一分为二
        var half = ((bx0 + bx1) / 2) | 0;
        var lots = [[bx0, bz0, half - 3, bz1], [half + 3, bz0, bx1, bz1]];
        for (k = 0; k < 2; k++) {
          var L = lots[k];
          var lw = L[2] - L[0], ld = L[3] - L[1];
          if (lw < 7 || ld < 8) continue;
          // 一块地上放 1~2 栋
          var split = ld > 22 && rnd() < 0.72;
          var subs = split ? [[L[1], L[1] + ((ld / 2) | 0) - 2], [L[1] + ((ld / 2) | 0) + 2, L[3]]]
                           : [[L[1], L[3]]];
          for (var s = 0; s < subs.length; s++) {
            var sz0 = subs[s][0], sz1 = subs[s][1];
            if (sz1 - sz0 < 7) continue;
            var inset = rnd() < 0.4 ? 1 : 0;
            var ax0 = L[0] + inset, ax1 = L[2] - inset;
            var dCen = Math.hypot(bcx - CX, bcz - CZ) / Math.max(R.hw, R.hh);
            var stories = Math.max(2, Math.round((11 - dCen * 7) * (0.55 + rnd() * 0.85)));
            stories = Math.min(14, stories);
            y = gy(((ax0 + ax1) / 2) | 0, ((sz0 + sz1) / 2) | 0);
            LIB.ruinBuilding(w, ax0, sz0, ax1, sz1, y, stories, 0x1000 + built * 137, {});
            built++;
          }
        }
      }
    }

    /* ---------------- 4. 地标 A：中央公园 ---------------- */
    (function () {
      var px = R.park[0], pz = R.park[1];
      VX._grassPatch(px, pz, 26, 0x9A11, true);
      w.tPaintDisc(px, pz, 27, m('grassDry'), 24, m('dirt'));
      y = gy(px, pz);
      // 干涸水池
      w.tCrater(px, pz, 9, -3, 3, m('paveDark'));
      w.disc(px, pz, 9, gy(px, pz), m('rubble'), 7.6);
      w.cyl(px, pz, 1.4, gy(px, pz) - 2, gy(px, pz) + 2, m('concreteMossy'));
      w.set(px, gy(px, pz) + 3, pz, m('rubbleDark'));
      // 倒塌雕像
      w.fill(px + 13, y, pz - 4, px + 15, y + 2, pz - 2, m('concreteMossy'));
      w.line3(px + 16, y + 1, pz - 3, px + 22, y, pz - 1, m('concreteMossy'), 1);
      // 枯树与野化草
      var prnd = M.rng(0x2E4);
      for (i = 0; i < 22; i++) {
        var a = prnd() * 6.283, d = 6 + prnd() * 19;
        var tx = Math.round(px + Math.cos(a) * d), tz = Math.round(pz + Math.sin(a) * d);
        if (Math.hypot(tx - px, tz - pz) < 10) continue;
        LIB.tree(w, tx, tz, gy(tx, tz), 5 + ((prnd() * 6) | 0), prnd() < 0.68 ? 'dead' : 'broad');
      }
      for (i = 0; i < 8; i++) {
        var ba = i * 0.785;
        LIB.bench(w, Math.round(px + Math.cos(ba) * 12), Math.round(pz + Math.sin(ba) * 12), gy(px, pz), i % 2 ? 'x' : 'z');
      }
      // 倒伏路灯 + 一盏还亮着
      for (i = 0; i < 6; i++) {
        var la = i * 1.047 + 0.3;
        var lx = Math.round(px + Math.cos(la) * 20), lz = Math.round(pz + Math.sin(la) * 20);
        if (i === 2) { LIB.streetLamp(w, lx, lz, gy(lx, lz), 'neon'); }
        else { w.line3(lx, gy(lx, lz), lz, lx + 4, gy(lx, lz), lz + 2, m('steelDark')); }
      }
      w.addLabel('中央公园', px, gy(px, pz) + 14, pz, 'poi', '野化草地 · 干涸水池');
    })();

    /* ---------------- 5. 地标 B：老教堂 ---------------- */
    (function () {
      var px = R.church[0], pz = R.church[1];
      y = gy(px, pz);
      VX._flatRect(px - 14, pz - 18, px + 14, pz + 18, y - 1, 8, m('brickPave'), m('brickRuin'));
      y = gy(px, pz);
      // 中殿（拱形山墙）
      w.fill(px - 9, y, pz - 15, px + 9, y + 14, pz + 10, m('brickWhite'));
      for (i = 0; i <= 9; i++)
        w.fill(px - 9 + i, y + 15 + i, pz - 15, px + 9 - i, y + 15 + i, pz + 10, m('tileRoof'));
      // 屋顶塌陷：挖两个洞
      w.fill(px - 5, y + 12, pz - 6, px + 3, y + 26, pz + 2, 0);
      w.fill(px - 8, y + 16, pz + 4, px - 2, y + 26, pz + 9, 0);
      LIB.rubblePile(w, px - 2, pz - 2, y, 5, 0x3131);
      // 彩窗残片
      for (i = 0; i < 5; i++) {
        var wz = pz - 12 + i * 5;
        w.fill(px - 9, y + 4, wz, px - 9, y + 9, wz + 1, i % 2 ? m('glassRed') : m('glassGold'));
        w.fill(px + 9, y + 4, wz, px + 9, y + 9, wz + 1, i % 3 ? m('glassCyan') : m('glassRed'));
      }
      // 玫瑰窗（南立面）
      w.disc(px, pz - 15, 4, y + 10, m('glassRed'));
      w.disc(px, pz - 15, 2, y + 10, 0);
      // 钟塔 + 断裂尖塔
      w.fill(px - 5, y, pz + 11, px + 5, y + 26, pz + 20, m('brickWhite'));
      LIB.facade(w, px - 5, pz + 11, px + 5, pz + 20, y, y + 26,
        { body: m('brickWhite'), win: m('windowDim'), mullion: m('concreteMossy'), belt: m('tileRoof'), mulEvery: 3, beltEvery: 3 });
      w.fill(px - 4, y + 27, pz + 12, px + 4, y + 31, pz + 19, m('darkMetal2'));
      w.fill(px - 2, y + 27, pz + 12, px + 2, y + 30, pz + 12, m('boneOld'));
      // 尖塔断口（斜切）
      for (i = 0; i < 12; i++)
        w.fill(px - 3 + ((i / 4) | 0), y + 32 + i, pz + 13 + ((i / 5) | 0), px + 3 - ((i / 4) | 0), y + 32 + i, pz + 18 - ((i / 5) | 0), m('brickWhite'));
      w.fill(px - 1, y + 44, pz + 14, px + 1, y + 44, pz + 17, 0);
      // 断落的塔尖躺在地上
      LIB.wreck(w, px + 12, pz + 24, y, 14, 'x', 0x717, { hull: m('brickWhite'), dark: m('tileRoof'), rad: 3, tilt: 0 });
      // 十字与残灯
      w.fill(px, y + 45, pz + 15, px, y + 49, pz + 15, m('boneOld'));
      w.fill(px - 2, y + 47, pz + 15, px + 2, y + 47, pz + 15, m('boneOld'));
      LIB.neonSign(w, px - 8, y + 6, pz - 16, 'z', 'AMEN', m('neonFlickRed'), { dir: -1 });
      w.addLabel('老教堂', px, y + 54, pz, 'poi', '尖塔断裂 · 彩窗残片');
    })();

    /* ---------------- 6. 地标 C：大商场 ---------------- */
    (function () {
      var px = R.mall[0], pz = R.mall[1];
      y = gy(px, pz);
      var mx0 = px - 20, mx1 = px + 20, mz0 = pz - 16, mz1 = pz + 16;
      VX._flatRect(mx0 - 4, mz0 - 4, mx1 + 4, mz1 + 4, y - 1, 8, m('paveDark'), m('concreteDark'));
      y = gy(px, pz);
      // 外壳（可见内部中庭）
      w.shell(mx0, y, mz0, mx1, y + 16, mz1, m('concrete'), m('paveDark'), m('concreteDark'));
      LIB.facade(w, mx0, mz0, mx1, mz1, y, y + 15,
        { body: m('concrete'), win: m('glassBroken'), mullion: m('concreteDark'), belt: m('rustMetal'),
          mulEvery: 4, beltEvery: 2 });
      // 屋顶大跨塌陷洞
      w.fill(px - 11, y + 16, pz - 9, px + 8, y + 16, pz + 7, 0);
      // 外露桁架
      for (i = -10; i <= 8; i += 4) {
        w.fill(px + i, y + 16, pz - 10, px + i, y + 16, pz + 8, m('girder'));
        w.fill(px + i - 1, y + 18, pz - 10, px + i + 1, y + 18, pz + 8, m('girder'));
      }
      for (i = -9; i <= 7; i += 8) w.fill(px - 11, y + 17, pz + i, px + 8, y + 17, pz + i, m('steelDark'));
      // 中庭：两层环廊 + 自动扶梯 + 干涸喷泉
      for (k = 1; k <= 2; k++) {
        var fy = y + k * 6;
        LIB.perim(w, mx0 + 3, mz0 + 3, mx1 - 3, mz1 - 3, fy, m('concreteDark'));
        LIB.perim(w, mx0 + 5, mz0 + 5, mx1 - 5, mz1 - 5, fy, m('paveDark'));
        LIB.perim(w, mx0 + 3, mz0 + 3, mx1 - 3, mz1 - 3, fy + 1, m('rubble'));
      }
      w.ramp(px + 6, pz - 6, px + 14, pz + 2, y + 1, y + 6, 4, m('grate'));
      w.ramp(px - 14, pz + 4, px - 6, pz - 4, y + 7, y + 12, 4, m('grate'));
      w.disc(px - 4, pz - 2, 4, y, m('rubble'), 2.6);
      LIB.rubblePile(w, px - 4, pz - 2, y, 3.2, 0x4141);
      LIB.rubblePile(w, px + 2, pz + 3, y, 4.4, 0x4142);
      // 残存巨型霓虹招牌（歪斜）
      LIB.holoBoard(w, mx0 + 4, y + 19, mz0 - 1, 'z', 22, 9, m('holoPink'), -1);
      LIB.neonSign(w, mx0 + 6, y + 32, mz0 - 2, 'z', 'MALL-7', m('neonFlick'), { scale: 2, dir: -1 });
      w.fill(mx0 + 4, y + 30, mz0 - 2, mx1 - 6, y + 30, mz0 - 2, m('darkMetal'));
      // 门前废车与购物车
      for (i = 0; i < 5; i++) LIB.vehicle(w, mx0 + 3 + i * 8, mz0 - 8, y, 'x', 0x600 + i);
      w.addLabel('大商场', px, y + 38, pz, 'poi', '屋顶塌陷 · 外露桁架 · 残存霓虹');
    })();

    /* ---------------- 7. 地标 D：断裂高架 ---------------- */
    (function () {
      var a = R.highway[0], b = R.highway[1];
      var n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      var baseY = gy(a[0], a[1]);
      var deckY = baseY + 14;
      // 13 段：1=存在 0=断落
      var SEG = [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 1];
      var segLen = n / SEG.length;
      for (i = 0; i < SEG.length; i++) {
        var t0 = i / SEG.length, t1 = (i + 1) / SEG.length;
        var sx0 = Math.round(a[0] + (b[0] - a[0]) * t0), sz0 = Math.round(a[1] + (b[1] - a[1]) * t0);
        var sx1 = Math.round(a[0] + (b[0] - a[0]) * t1), sz1 = Math.round(a[1] + (b[1] - a[1]) * t1);
        // 桥墩
        var pgy = gy(sx0, sz0);
        w.fill(sx0 - 2, pgy, sz0 - 2, sx0 + 2, deckY - 1, sz0 + 2, m('concreteMossy'));
        w.fill(sx0 - 3, pgy, sz0 - 3, sx0 + 3, pgy + 1, sz0 + 3, m('concreteDark'));
        w.fill(sx0 - 3, deckY - 2, sz0 - 3, sx0 + 3, deckY - 1, sz0 + 3, m('concrete'));
        if (!SEG[i]) {
          // 断落：桥面碎块滑落地面
          LIB.rubblePile(w, ((sx0 + sx1) / 2) | 0, ((sz0 + sz1) / 2) | 0, pgy, 5.5, 0x8800 + i);
          w.fill(sx0 + 2, pgy + 1, sz0 - 3, sx1 - 2, pgy + 2, sz0 + 3, m('rubbleDark'));
          for (k = 0; k < 5; k++) {
            var cx2 = sx0 + 3 + ((k * segLen) / 5) | 0;
            w.fill(cx2, pgy + 2, sz0 - 2 + k, cx2 + 2, pgy + 3, sz0 - 1 + k, m('concreteDark'));
          }
          // 断头垂落电缆
          w.line3(sx0, deckY, sz0, sx0 + 3, pgy + 2, sz0 + 2, m('wire'));
          w.line3(sx1, deckY, sz1, sx1 - 3, pgy + 2, sz1 - 2, m('wire'));
          continue;
        }
        // 桥面
        w.beam(sx0, sz0, sx1, sz1, deckY, deckY, 9, m('asphaltWorn'));
        w.beam(sx0, sz0, sx1, sz1, deckY + 1, deckY + 1, 9, 0);
        // 护栏 + 中央分隔
        for (k = 0; k <= Math.round(segLen); k++) {
          var tt = k / Math.max(1, Math.round(segLen));
          var lx = Math.round(sx0 + (sx1 - sx0) * tt), lz = Math.round(sz0 + (sz1 - sz0) * tt);
          w.set(lx, deckY + 1, lz - 4, m('concreteMossy'));
          w.set(lx, deckY + 1, lz + 4, m('concreteMossy'));
          if (k % 4 === 0) { w.set(lx, deckY + 2, lz - 4, m('wire')); w.set(lx, deckY + 2, lz + 4, m('wire')); }
          if (k % 3 === 0) w.set(lx, deckY + 1, lz, m('roadLine'));
          if (k % 9 === 0) LIB.streetLamp(w, lx, lz + 4, deckY + 1, k % 18 === 0 ? 'neon' : 'plain');
        }
        // 桥面废车
        if (i % 2 === 0) LIB.vehicle(w, sx0 + 6, sz0 - 2, deckY + 1, 'x', 0x910 + i);
        if (i % 3 === 0) LIB.vehicle(w, sx0 + 12, sz0 + 2, deckY + 1, 'x', 0x920 + i);
      }
      w.addLabel('断裂高架', ((a[0] + b[0]) / 2) | 0, deckY + 10, ((a[1] + b[1]) / 2) | 0, 'poi', '中段整段断落');
    })();

    /* ---------------- 8. 地标 E：北部公寓区 ---------------- */
    (function () {
      var px = R.apartments[0], pz = R.apartments[1];
      var arnd = M.rng(0x4A17);
      for (i = 0; i < 5; i++) {
        var ax = px - 22 + i * 11;
        var az = pz - 12 + (i % 2) * 6;
        y = gy(ax, az);
        var st = 8 + ((arnd() * 8) | 0);
        LIB.ruinBuilding(w, ax - 4, az - 9, ax + 4, az + 9, y, st, 0xA100 + i * 71,
          { body: i % 2 ? m('concrete') : m('concreteMossy') });
        // 阳台外挂：空调机 / 晾衣杆
        for (k = 1; k < st; k++) {
          var by2 = y + k * LIB.ST + 1;
          if (arnd() < 0.42) {
            w.fill(ax + 5, by2, az - 6 + ((arnd() * 12) | 0), ax + 5, by2 + 1, az - 5 + ((arnd() * 12) | 0), m('steelDark'));
          }
          if (arnd() < 0.30) {
            var wz2 = az - 7 + ((arnd() * 14) | 0);
            w.fill(ax - 5, by2 + 1, wz2, ax - 5, by2 + 1, wz2 + 2, m('wire'));
            w.set(ax - 5, by2, wz2 + 1, m('tarp'));
          }
        }
        // 整层缺失
        if (arnd() < 0.6) {
          var miss = y + (2 + ((arnd() * (st - 3)) | 0)) * LIB.ST;
          w.fill(ax - 4, miss, az - 9, ax + 4, miss + 2, az + 9, 0);
          w.fill(ax - 4, miss, az - 9, ax + 4, miss, az + 9, m('concreteDark'));
        }
      }
      w.addLabel('北部公寓区', px, gy(px, pz) + 42, pz, 'poi', '板式住宅 · 整层缺失');
    })();

    /* ---------------- 9. 散落物与赛博朋克点缀 ---------------- */
    var roadish = [m('asphalt'), m('asphaltWorn'), m('asphaltCrack')];
    function onRoad(px, pz) {
      var mm = w.tM(px, pz);
      for (var q = 0; q < roadish.length; q++) if (mm === roadish[q]) return true;
      return false;
    }
    // 废车 28 辆（沿街）
    var cars = 0;
    w.scatter(X0, Z0, X1, Z1, 400, 0x0CA5, function (px, pz, rn) {
      if (cars >= 28 || !onRoad(px, pz)) return;
      if (w.get(px, gy(px, pz), pz)) return;
      LIB.vehicle(w, px, pz, gy(px, pz), rn() < 0.5 ? 'x' : 'z', 0xC00 + cars * 13);
      cars++;
    });
    // 电线杆 + 垂落电缆
    for (i = 0; i < RZ.length; i++) {
      for (x = X0 + 8; x < X1; x += 26) {
        var pz2 = RZ[i] + 5;
        if (w.tH(x, pz2) < 0) continue;
        var py = gy(x, pz2);
        w.fill(x, py, pz2, x, py + 9, pz2, m('woodDark'));
        w.fill(x - 2, py + 8, pz2, x + 2, py + 8, pz2, m('woodDark'));
        if (x + 26 < X1) {
          var sag = M.hash3(x, i, 3) < 0.4;
          if (sag) w.line3(x, py + 8, pz2, x + 8, py + 2, pz2 + 2, m('wire'));
          else { w.line3(x, py + 8, pz2, x + 26, py + 8, pz2, m('wire')); w.line3(x, py + 7, pz2 + 1, x + 26, py + 7, pz2 + 1, m('wire')); }
        }
        if (M.hash3(x, pz2, 7) < 0.2) w.set(x, py + 10, pz2, m('neonFlickRed'));
      }
    }
    // 路牌 / 路障 / 集装箱 / 垃圾
    w.scatter(X0, Z0, X1, Z1, 190, 0x51A0, function (px, pz, rn) {
      if (!onRoad(px, pz) || w.get(px, gy(px, pz), pz)) return;
      var py = gy(px, pz), r = rn();
      if (r < 0.22) {                       // 路牌
        w.fill(px, py, pz, px, py + 4, pz, m('steelDark'));
        w.fill(px - 1, py + 5, pz, px + 1, py + 5, pz, m('signFaded'));
      } else if (r < 0.44) {                // 路障
        w.fill(px, py, pz, px + 1, py + 1, pz, m('hazard'));
        w.set(px, py + 2, pz, m('neonAmber'));
      } else if (r < 0.60) {                // 集装箱/货柜倾倒
        LIB.container(w, px, pz, py, rn() < 0.5 ? 'x' : 'z',
          rn() < 0.5 ? m('rustMetal') : m('tarp'));
      } else if (r < 0.80) {                // 瓦砾
        LIB.rubblePile(w, px, pz, py, 1.4 + rn() * 2.2, (px * 31 + pz) | 0);
      } else {                              // 垃圾堆
        w.set(px, py, pz, m('rubbleDark'));
        w.set(px + 1, py, pz, m('tarp'));
      }
    });
    // 涂鸦墙（像素字）
    var graf = [['NEO', m('neonMagenta')], ['13', m('neonCyan')], ['X-7', m('signFaded')],
                ['APE', m('neonFlickRed')], ['FREE', m('neonGreen')], ['NO', m('signFaded')]];
    for (i = 0; i < graf.length; i++) {
      var gx = RX[(i % (RX.length - 1)) + 1] - 6, gz = RZ[i % (RZ.length - 1)] + 9;
      var gyy = gy(gx, gz);
      if (w.get(gx, gyy + 3, gz)) w.text(graf[i][0], gx, gyy + 8, gz, 'z', graf[i][1]);
    }
    // 爆裂管线 + 蒸汽
    LIB.pipes(w, [[X0 + 10, CZ + 22], [CX - 20, CZ + 22], [CX - 20, CZ + 48]], gy(CX - 20, CZ + 22) + 1, m('rustMetal'));
    LIB.pipes(w, [[X1 - 12, CZ - 30], [CX + 14, CZ - 30]], gy(CX + 14, CZ - 30) + 1, m('rustDeep'));
    for (i = 0; i < 9; i++) {
      var vx = X0 + 20 + i * 24, vz = CZ - 40 + (i % 3) * 40;
      if (w.tH(vx, vz) < 0) continue;
      LIB.vent(w, vx, vz, gy(vx, vz), 3 + (i % 4), i);
      for (k = 0; k < 7; k++) w.disc(vx, vz, 0.9 + k * 0.22, gy(vx, vz) + 5 + k, m('beamWarm'), 0);
    }
    // 警示灯阵（东入口检疫线）
    for (i = 0; i < 9; i++) {
      var hx = X1 + 2, hz = CZ - 8 + i * 2;
      w.fill(hx, gy(hx, hz), hz, hx, gy(hx, hz) + 2, hz, m('hazardDark'));
      w.set(hx, gy(hx, hz) + 3, hz, i % 2 ? m('neonRed') : m('neonAmber'));
    }
    // 高处探照灯（还在扫的两盏）
    LIB.searchlight(w, CX - 30, CZ - 60, gy(CX - 30, CZ - 60), 22, [0.55, 0.5, 0.65], m('beamCyan'));
    LIB.searchlight(w, CX + 40, CZ + 52, gy(CX + 40, CZ + 52), 26, [-0.5, 0.55, -0.6], m('beamRed'));

    w.addLabel('废弃城市', CX, LAY.ground + 62, CZ - R.hh - 14, 'site', '第7种植园废墟 · ' + built + ' 栋废墟楼');
    console.log('[废弃城市] 楼栋 ' + built + ' · 废车 ' + cars);
    return w;
  };
})(window);
