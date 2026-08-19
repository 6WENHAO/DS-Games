/* =====================================================================
   微体素地图 · 地形与全局动线
   悬浮沙盘岛体 → 站点场地平整 → 地貌铺装/草地 → 中轴对称路网
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, m = VX.m, LAY = VX.LAY, LIB = VX.LIB;

  VX.buildTerrain = function (w) {
    var CXp = LAY.cx, CZp = LAY.cz, G = LAY.ground, R = LAY.islandR;
    var SX = VX.SX, SZ = VX.SZ;
    var x, z, i, d;

    /* ---------- 1+2. 岛体（带噪声边缘）与地貌分区，单遍完成 ---------- */
    // 低频噪声先做成场，再双线性采样（整图噪声开销降一个数量级）
    var F_wobA = M.makeField(SX, SZ, { freq: 0.012, oct: 2, seed: 0x51, step: 4 });
    var F_wobB = M.makeField(SX, SZ, { freq: 0.05, oct: 1, seed: 0x77, step: 2 });
    var F_h    = M.makeField(SX, SZ, { freq: 0.0075, oct: 3, seed: 0x1234, step: 4 });
    var F_n1   = M.makeField(SX, SZ, { freq: 0.0098, oct: 3, seed: 0x2222, step: 4 });
    var F_n2   = M.makeField(SX, SZ, { freq: 0.0175, oct: 2, seed: 0x4444, step: 3, ox: 40, oz: -17 });
    var F_n3   = M.makeField(SX, SZ, { freq: 0.038, oct: 2, seed: 0x6666, step: 2 });
    var F_rdg  = M.makeField(SX, SZ, { freq: 0.0088, oct: 3, seed: 0x3333, step: 4, ridge: true });
    var mSalt = m('salt'), mStoneL = m('stoneLight'), mStoneD = m('stoneDark');
    var mMesa = m('mesaRock'), mMesaB = m('mesaBand'), mMesaP = m('mesaPale');
    var mSand = m('sand'), mSandD = m('sandDark'), mDune = m('dune');
    var mGravel = m('gravel'), mMud = m('crackedMud'), mAsh = m('ash'), mDirt = m('dirtDark');
    var H = w.H, Mt = w.Mt, Mu = w.Mu;
    var R2 = (R + 62) * (R + 62);
    for (z = 0; z < SZ; z++) {
      var dzq = z - CZp, dz2 = dzq * dzq;
      for (x = 0; x < SX; x++) {
        var dxq = x - CXp;
        var dd2 = dxq * dxq + dz2;
        if (dd2 > R2) continue;                         // 快速外接剔除
        d = Math.sqrt(dd2);
        var wob = (M.field(F_wobA, x, z) - 0.5) * 46 + (M.field(F_wobB, x, z) - 0.5) * 14;
        if (d > R + wob) continue;
        i = z * SX + x;
        var h = G + Math.round((M.field(F_h, x, z) - 0.5) * 10);
        // 地貌分区（三层噪声叠加，斑块更碎、层次更多）
        var n1 = M.field(F_n1, x, z);
        var n2 = M.field(F_n2, x, z);
        var n3 = M.field(F_n3, x, z);
        var mm, side = mStoneD;
        if (n2 > 0.640) { mm = n3 > 0.55 ? mSalt : mStoneL; side = mStoneL; }
        else if (n1 > 0.605) {
          mm = n3 > 0.58 ? mMesaP : mMesa; side = mMesaB;
          h += Math.floor(M.field(F_rdg, x, z) * 26 / 4) * 4;
        } else if (n1 < 0.352) { mm = n3 > 0.56 ? mDune : mSand; side = mSandD; }
        else if (n2 < 0.375) { mm = n3 > 0.52 ? mAsh : mDirt; side = mStoneD; }
        else if (n1 > 0.492 && n1 < 0.536) { mm = mGravel; side = mStoneD; }
        else { mm = n3 > 0.60 ? mGravel : mMud; }
        // 边缘向下收（沙盘倒角）
        var edge = (R + wob) - d;
        if (edge < 26) h -= Math.round((1 - M.smooth(edge / 26)) * 15);
        H[i] = h > 3 ? h : 3;
        Mt[i] = mm; Mu[i] = side;
      }
    }

    /* ---------- 3. 站点场地平整 ---------- */
    function flat(cx, cz, rr, y, edge, mat, side) {
      for (var zz = Math.floor(cz - rr - edge); zz <= Math.ceil(cz + rr + edge); zz++)
        for (var xx = Math.floor(cx - rr - edge); xx <= Math.ceil(cx + rr + edge); xx++) {
          if (xx < 0 || zz < 0 || xx >= SX || zz >= SZ) continue;
          var ii = zz * SX + xx;
          if (w.H[ii] < 0) continue;
          var dd = Math.hypot(xx - cx, zz - cz);
          if (dd > rr + edge) continue;
          var t = dd < rr ? 1 : 1 - (dd - rr) / edge;
          t = M.smooth(M.clamp(t, 0, 1));
          w.H[ii] = Math.round(w.H[ii] + (y - w.H[ii]) * t);
          if (mat != null && t > 0.55) { w.Mt[ii] = mat; if (side != null) w.Mu[ii] = side; }
        }
    }
    function flatRect(x0, z0, x1, z1, y, edge, mat, side) {
      for (var zz = z0 - edge; zz <= z1 + edge; zz++)
        for (var xx = x0 - edge; xx <= x1 + edge; xx++) {
          if (xx < 0 || zz < 0 || xx >= SX || zz >= SZ) continue;
          var ii = zz * SX + xx;
          if (w.H[ii] < 0) continue;
          var ex = Math.max(0, Math.max(x0 - xx, xx - x1));
          var ez = Math.max(0, Math.max(z0 - zz, zz - z1));
          var dd = Math.hypot(ex, ez);
          if (dd > edge) continue;
          var t = M.smooth(M.clamp(1 - dd / edge, 0, 1));
          w.H[ii] = Math.round(w.H[ii] + (y - w.H[ii]) * t);
          if (mat != null && t > 0.55) { w.Mt[ii] = mat; if (side != null) w.Mu[ii] = side; }
        }
    }
    VX._flat = flat; VX._flatRect = flatRect;

    // 第13号种植园底盘（略高一级，像移动式底座）
    flat(LAY.p13.cx, LAY.p13.cz, LAY.p13.r, G + 2, 30, m('gravel'), m('concreteDark'));
    flat(LAY.p13.cx, LAY.p13.cz, LAY.p13.r - 26, G + 3, 18, m('gravel'), m('concreteDark'));
    // 废弃城市：沙化平地
    flatRect(LAY.ruins.cx - LAY.ruins.hw, LAY.ruins.cz - LAY.ruins.hh,
             LAY.ruins.cx + LAY.ruins.hw, LAY.ruins.cz + LAY.ruins.hh, G - 1, 26, m('sandDark'), m('sand'));
    // Cosmos：白盐台地
    flat(LAY.cosmos.cx, LAY.cosmos.cz, LAY.cosmos.r + 8, G + 4, 26, m('salt'), m('stoneLight'));
    // 干涸海床：下沉盆地
    flatRect(LAY.seabed.cx - LAY.seabed.hw, LAY.seabed.cz - LAY.seabed.hh,
             LAY.seabed.cx + LAY.seabed.hw, LAY.seabed.cz + LAY.seabed.hh, G - 9, 30, m('salt'), m('crackedMud'));
    // 第26种植园
    flat(LAY.p26.cx, LAY.p26.cz, LAY.p26.r + 6, G + 3, 20, m('gravel'), m('concreteDark'));
    // 第7种植园遗址
    flat(LAY.p7ruin.cx, LAY.p7ruin.cz, 54, G, 18, m('sandDark'), m('sand'));
    // 大裂缝：先抬成高台，谷体由 crevasse.js 挖出
    flat(LAY.crevasse.cx, LAY.crevasse.cz, Math.max(LAY.crevasse.rx, LAY.crevasse.rz) + 56,
         LAY.crevasse.mesaY, 46, m('mesaRock'), m('mesaBand'));
    // 出击区战场
    flatRect(LAY.sortieField.cx - LAY.sortieField.hw, LAY.sortieField.cz - LAY.sortieField.hh,
             LAY.sortieField.cx + LAY.sortieField.hw, LAY.sortieField.cz + LAY.sortieField.hh,
             G, 20, m('crackedMud'), m('dirtDark'));
    // 小站台地
    var pads = [LAY.bonesGiant, LAY.pumpStation, LAY.watchWest, LAY.watchEastOut, LAY.watchNW, LAY.watchNE];
    for (i = 0; i < pads.length; i++) flat(pads[i][0], pads[i][1], 26, G, 14, m('gravel'), m('concreteDark'));

    w.tSmooth(0, 0, SX - 1, SZ - 1, 1);

    /* ---------- 3.5 高度台阶化（体素观感 + 大幅提升地形网格合并率） ---------- */
    for (i = 0; i < SX * SZ; i++) {
      if (w.H[i] < 0) continue;
      w.H[i] = Math.round(w.H[i] / 3) * 3;
    }

    /* ---------- 4. 草地 / 绿化斑块（自然衔接） ---------- */
    function grassPatch(cx, cz, r, seed, dark) {
      var rnd = M.rng(seed);
      for (var zz = Math.floor(cz - r); zz <= Math.ceil(cz + r); zz++)
        for (var xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
          if (xx < 0 || zz < 0 || xx >= SX || zz >= SZ) continue;
          var ii = zz * SX + xx;
          if (w.H[ii] < 0 || w.guarded(ii)) continue;
          var dd = Math.hypot(xx - cx, zz - cz) / r;
          var n = M.fbm(xx * 0.09, zz * 0.09, 2, seed & 0xffff);
          if (dd + (n - 0.5) * 0.55 > 1) continue;
          w.Mt[ii] = (n > 0.56) ? (dark ? m('grassDark') : m('grass')) : (dark ? m('grass') : m('grassDry'));
          w.Mu[ii] = m('dirt');
        }
      return rnd;
    }
    VX._grassPatch = grassPatch;

    /* ---------- 5. 中轴对称路网 ---------- */
    var road = m('asphalt'), curb = m('curb');
    // 南北中轴大道
    w.tRoad([[CXp, 150], [CXp, 1020]], LAY.axisW, road, { curb: curb, name: '中轴大道' });
    // 东西横轴
    w.tRoad([[96, LAY.p13.cz], [1188, LAY.p13.cz]], LAY.crossW, road, { curb: curb, name: '东西横轴' });
    // 外环（正八边形）
    var ringPts = [];
    for (i = 0; i <= 8; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 4;
      ringPts.push([Math.round(CXp + Math.cos(a) * LAY.ringR), Math.round(CZp + Math.sin(a) * LAY.ringR)]);
    }
    w.tRoad(ringPts, LAY.ringW, road, { curb: curb, name: '外环路' });
    // 四对角放射（连四角楼）
    var diag = [
      [[CXp - 150, CZp - 150], [LAY.p7ruin.cx, LAY.p7ruin.cz]],
      [[CXp + 150, CZp - 150], [LAY.p26.cx, LAY.p26.cz]],
      [[CXp - 150, CZp + 150], [LAY.seabed.cx + 40, LAY.seabed.cz - 40]],
      [[CXp + 150, CZp + 150], [LAY.crevasse.cx - 44, LAY.crevasse.cz - 100]]
    ];
    for (i = 0; i < 4; i++) w.tRoad(diag[i], LAY.spokeW, road, { curb: curb, name: '对角放射' + i });
    // 支路：小站接环路
    var spurs = [
      [[LAY.bonesGiant[0], LAY.bonesGiant[1]], [232, 470]],
      [[LAY.pumpStation[0], LAY.pumpStation[1]], [1048, 470]],
      [[LAY.watchWest[0], LAY.watchWest[1]], [232, 762]],
      [[LAY.watchEastOut[0], LAY.watchEastOut[1]], [1048, 762]],
      [[LAY.watchNW[0], LAY.watchNW[1]], [498, 258]],
      [[LAY.watchNE[0], LAY.watchNE[1]], [782, 258]],
      [[LAY.ruins.cx, LAY.ruins.cz - LAY.ruins.hh], [LAY.ruins.cx, 300]],
      [[LAY.cosmos.cx, LAY.cosmos.cz - LAY.cosmos.r], [LAY.cosmos.cx, 300]]
    ];
    for (i = 0; i < spurs.length; i++) w.tRoad(spurs[i], 7, road, { curb: curb });

    /* ---------- 6. 中轴仪式空间（南北门前广场） ---------- */
    // 北端：森林门户前广场
    LIB.plaza(w, CXp - 30, 172, CXp + 30, 214, w.tH(CXp, 190) + 1, { pave: m('whiteTile'), alt: m('paveDark') });
    // 南端：出击区前广场
    LIB.plaza(w, CXp - 34, 900, CXp + 34, 944, w.tH(CXp, 920) + 1, { pave: m('paveDark'), alt: m('asphaltWorn'), planters: false });
    // 十字交汇处铺装
    LIB.crosswalk(w, CXp - 24, CZp - 7, CXp - 12, CZp + 7, 'x');
    LIB.crosswalk(w, CXp + 12, CZp - 7, CXp + 24, CZp + 7, 'x');

    /* ---------- 7. 路灯与行道树（沿主轴，中轴对称） ---------- */
    var gy = function (px, pz) { var h = w.tH(px, pz); return h < 0 ? G : h + 1; };
    for (z = 190; z <= 1000; z += 22) {
      var y = gy(CXp, z);
      LIB.streetLamp(w, CXp - 10, z, y, 'neon');
      LIB.streetLamp(w, CXp + 10, z, y, 'neon');
      if (z % 44 === 0) {
        LIB.tree(w, CXp - 13, z, y, 6, 'neon');
        LIB.tree(w, CXp + 13, z, y, 6, 'neon');
      }
      // 中轴发光分隔带
      w.tPaint(CXp - 1, z, CXp + 1, z + 8, m('roadNeon'));
    }
    for (x = 120; x <= 1170; x += 26) {
      var y2 = gy(x, CZp);
      if (Math.abs(x - CXp) < 30) continue;
      LIB.streetLamp(w, x, CZp - 9, y2, 'double');
      LIB.streetLamp(w, x, CZp + 9, y2, 'double');
      w.tPaint(x, CZp - 1, x + 9, CZp + 1, m('roadLineWarm'));
    }
    // 外环霓虹缘石
    LIB.roadDeco(w, ringPts, 5, null, { lampEvery: 30, lamp: 'tall', curbNeon: m('roadNeonPink') });

    /* ---------- 8. 荒原表面细节（碎石 / 枯灌 / 裂缝，让空地不空） ---------- */
    var roadMats = [m('asphalt'), m('asphaltWorn'), m('asphaltCrack'), m('roadLine'),
      m('roadNeon'), m('roadNeonPink'), m('roadLineWarm'), m('whiteTile'), m('marble'),
      m('pave'), m('paveDark'), m('paveWarm'), m('curb'), m('brickPave'), m('redCarpet')];
    var siteZones = [
      [LAY.p13.cx, LAY.p13.cz, LAY.p13.r - 6],
      [LAY.ruins.cx, LAY.ruins.cz, 132],
      [LAY.cosmos.cx, LAY.cosmos.cz, 126],
      [LAY.seabed.cx, LAY.seabed.cz, 112],
      [LAY.crevasse.cx, LAY.crevasse.cz, 186],
      [LAY.p26.cx, LAY.p26.cz, 66],
      [LAY.p7ruin.cx, LAY.p7ruin.cz, 52]
    ];
    function openGround(px, pz) {
      var ii = pz * SX + px;
      if (px < 0 || pz < 0 || px >= SX || pz >= SZ || w.H[ii] < 0) return false;
      var mm2 = w.Mt[ii];
      for (var q = 0; q < roadMats.length; q++) if (mm2 === roadMats[q]) return false;
      for (q = 0; q < siteZones.length; q++)
        if (Math.hypot(px - siteZones[q][0], pz - siteZones[q][1]) < siteZones[q][2]) return false;
      return true;
    }
    w.setGuard(true);
    w.scatter(60, 60, 1220, 1220, 6400, 0x11FA, function (px, pz, rnd) {
      if (!openGround(px, pz)) return;
      var py = w.H[pz * SX + px] + 1, r = rnd();
      if (r < 0.34) {                                  // 碎石
        w.fill(px, py, pz, px + (rnd() < 0.4 ? 1 : 0), py, pz + (rnd() < 0.4 ? 1 : 0), m('gravel'));
      } else if (r < 0.52) {                           // 岩块
        w.fill(px, py, pz, px + 1, py + ((rnd() * 2) | 0), pz + 1, rnd() < 0.5 ? m('stone') : m('stoneDark'));
      } else if (r < 0.70) {                           // 枯灌木
        w.set(px, py, pz, m('deadWood'));
      } else if (r < 0.82) {                           // 干草
        w.set(px, py, pz, m('grassDry'));
      } else if (r < 0.92) {                           // 裂纹（只改材质）
        var len = 3 + ((rnd() * 8) | 0);
        for (var k = 0; k < len; k++) {
          var qx = px + ((k * (rnd() < 0.5 ? 1 : 0)) | 0) + ((rnd() * 2) | 0) - 1;
          var qz = pz + k;
          if (openGround(qx, qz)) w.tPaint(qx, qz, qx, qz, m('asphaltCrack'));
        }
      } else {                                         // 锈渣 / 灰烬斑
        w.tPaintDisc(px, pz, 1.6 + rnd() * 2.4, rnd() < 0.5 ? m('ash') : m('rustDeep'));
      }
    });
    // 稀疏枯树带（为空旷区提供竖向要素）
    w.scatter(60, 60, 1220, 1220, 900, 0x22FB, function (px, pz, rnd) {
      if (!openGround(px, pz)) return;
      if (M.field(F_n3, px, pz) < 0.54) return;
      LIB.tree(w, px, pz, w.H[pz * SX + px] + 1, 4 + ((rnd() * 6) | 0), 'dead');
    });
    w.setGuard(false);

    return w;
  };
})(window);
