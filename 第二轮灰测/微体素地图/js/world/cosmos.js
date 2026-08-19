/* =====================================================================
   微体素地图 · Cosmos 宇宙都市（大人们的超级都市）
   风格：冷白 + 金窗 + 青紫霓虹，四环八射的威权几何
   场地：中心 (1084,596)，半径 116
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, m = VX.m, LAY = VX.LAY, LIB = VX.LIB;

  VX.buildCosmos = function (w) {
    var C = LAY.cosmos, CX = C.cx, CZ = C.cz, R = C.r;
    function gy(x, z) { var h = w.tH(x, z); return h < 0 ? LAY.ground : h + 1; }
    var BY = gy(CX, CZ);
    var i, k, a, x, z, y;

    /* ---------------- 1. 场地铺装：四环 + 八射 ---------------- */
    w.tPaintDisc(CX, CZ, R + 4, m('salt'), 0, m('stoneLight'));
    w.tPaintDisc(CX, CZ, R - 4, m('whiteTile'), 0, m('marble'));
    for (i = 0; i < C.rings.length; i++) {
      w.tPaintDisc(CX, CZ, C.rings[i] + 3, m('marble'), C.rings[i] - 3, m('stoneLight'));
      w.tPaintDisc(CX, CZ, C.rings[i] + 3.6, m('curb'), C.rings[i] + 3);
    }
    for (k = 0; k < 8; k++) {
      a = k * Math.PI / 4;
      w.tRoad([[Math.round(CX + Math.cos(a) * 16), Math.round(CZ + Math.sin(a) * 16)],
               [Math.round(CX + Math.cos(a) * (R + 6)), Math.round(CZ + Math.sin(a) * (R + 6))]],
        7, m('marble'), { curb: m('curb'), name: 'Cosmos 放射大道' });
    }
    // 环路霓虹缘石
    for (i = 0; i < C.rings.length; i++) {
      var rr = C.rings[i];
      for (k = 0; k < 96; k++) {
        a = k * Math.PI / 48;
        x = Math.round(CX + Math.cos(a) * (rr + 3)); z = Math.round(CZ + Math.sin(a) * (rr + 3));
        if (k % 3 === 0) w.set(x, gy(x, z), z, i % 2 ? m('neonBlue') : m('neonCyan'));
      }
    }

    /* ---------------- 2. 城墙与八城门 ---------------- */
    var wallPts = [];
    for (k = 0; k <= 96; k++) {
      a = k * Math.PI / 48;
      wallPts.push([Math.round(CX + Math.cos(a) * (R + 6)), Math.round(CZ + Math.sin(a) * (R + 6))]);
    }
    var gaps = [];
    for (k = 0; k < 8; k++) {
      a = k * Math.PI / 4;
      gaps.push([Math.round(CX + Math.cos(a) * (R + 6)), Math.round(CZ + Math.sin(a) * (R + 6)), 8]);
    }
    LIB.fenceWall(w, wallPts, BY, 9, m('whitePanel2'),
      { postEvery: 7, post: m('quartzPillar'), cap: m('goldTrim'), neon: m('neonCyan'), gaps: gaps });
    // 八座门 + 炮塔
    for (k = 0; k < 8; k++) {
      a = k * Math.PI / 4;
      x = Math.round(CX + Math.cos(a) * (R + 6)); z = Math.round(CZ + Math.sin(a) * (R + 6));
      y = gy(x, z);
      var ax = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'x' : 'z';
      LIB.gateArch(w, x, z, y, 20, 12, k === 4 ? 'COSMOS' : '',
        { axis: ax, post: m('quartzPillar'), beam: m('goldTrim'), neon: m('neonCyan') });
      // 炮塔（门旁）
      var ta = a + 0.22;
      var tx = Math.round(CX + Math.cos(ta) * (R + 8)), tz = Math.round(CZ + Math.sin(ta) * (R + 8));
      w.cyl(tx, tz, 3.4, gy(tx, tz), gy(tx, tz) + 10, m('whitePanel'));
      w.disc(tx, tz, 4, gy(tx, tz) + 11, m('steelDark'));
      w.fill(tx, gy(tx, tz) + 12, tz, tx + Math.round(Math.cos(ta) * 5), gy(tx, tz) + 12, tz + Math.round(Math.sin(ta) * 5), m('darkMetal'));
      w.set(tx, gy(tx, tz) + 13, tz, m('neonRed'));
    }
    // 西侧主门前广场（朝向 13 号种植园）
    var wgx = CX - R - 6;
    LIB.plaza(w, wgx - 14, CZ - 16, wgx - 2, CZ + 16, gy(wgx - 8, CZ),
      { pave: m('marble'), alt: m('whiteTile'), planters: false });
    w.addLabel('Cosmos 西城门', wgx, gy(wgx, CZ) + 16, CZ, 'poi', '朝向第13号种植园');

    /* ---------------- 3. 四环建筑带（46 栋，越内越高） ---------------- */
    (function () {
      var bands = [
        { r0: 98, r1: 112, cnt: 16, min: 6, max: 10, half: 6 },
        { r0: 70, r1: 82, cnt: 14, min: 10, max: 16, half: 6 },
        { r0: 44, r1: 54, cnt: 10, min: 16, max: 23, half: 5 },
        { r0: 22, r1: 32, cnt: 6, min: 22, max: 30, half: 4 }
      ];
      var built = 0, rnd = M.rng(0xC05);
      for (var b = 0; b < bands.length; b++) {
        var B = bands[b];
        for (k = 0; k < B.cnt; k++) {
          a = (k / B.cnt) * Math.PI * 2 + (b * 0.19) + Math.PI / B.cnt;
          // 避开八射大道
          var da = ((a % (Math.PI / 4)) / (Math.PI / 4));
          if (da < 0.20 || da > 0.80) continue;
          var rr = (B.r0 + B.r1) / 2;
          x = Math.round(CX + Math.cos(a) * rr); z = Math.round(CZ + Math.sin(a) * rr);
          y = gy(x, z);
          var st = B.min + ((rnd() * (B.max - B.min)) | 0);
          var hf = B.half;
          var neonPick = [m('neonCyan'), m('neonBlue'), m('neonViolet'), m('neonWhite')];
          if (rnd() < 0.34) {
            LIB.setbackTower(w, x, z, hf + 1, y, [[0, Math.ceil(st * 0.45)], [2, Math.ceil(st * 0.33)], [4, Math.ceil(st * 0.24)]],
              { body: rnd() < 0.5 ? m('whitePanel') : m('marble'), win: m('windowGold'),
                mullion: m('quartzPillar'), belt: m('goldTrim'),
                neon: neonPick[(rnd() * 4) | 0], neonEvery: 3, roof: (rnd() * 4) | 0 });
          } else {
            LIB.podium(w, x - hf - 2, z - hf - 2, x + hf + 2, z + hf + 2, y, 2,
              { body: m('whitePanel2'), glass: m('glassGold'), win: m('windowGold'),
                trim: m('goldTrim'), roof: 1 });
            LIB.tower(w, x - hf, z - hf, x + hf, z + hf, y + 2 * LIB.ST + 2, st * LIB.ST,
              { body: rnd() < 0.6 ? m('whitePanel') : m('quartzPillar'), win: m('windowGold'),
                mullion: m('marble'), belt: m('goldTrim'), mulEvery: 3,
                neon: neonPick[(rnd() * 4) | 0], neonEvery: 3 + ((rnd() * 3) | 0),
                roof: (rnd() * 4) | 0, edgeNeon: rnd() < 0.4 ? m('neonViolet') : null });
          }
          // 沿街全息广告
          if (rnd() < 0.45) {
            LIB.holoBoard(w, x - hf + 1, y + 10, z - hf - 3, 'z', Math.min(2 * hf - 1, 9), 6 + ((rnd() * 6) | 0),
              rnd() < 0.5 ? m('holoScreen') : m('holoGreen'), -1);
          }
          built++;
        }
      }
      // 四座宣传塔（大屏 + 光柱），置于对角线上
      for (k = 0; k < 4; k++) {
        a = k * Math.PI / 2 + Math.PI / 4;
        x = Math.round(CX + Math.cos(a) * 90); z = Math.round(CZ + Math.sin(a) * 90);
        y = gy(x, z);
        w.fill(x - 3, y, z - 3, x + 3, y + 34, z + 3, m('whitePanel'));
        LIB.facade(w, x - 3, z - 3, x + 3, z + 3, y, y + 33,
          { body: m('whitePanel'), win: m('windowCool'), mullion: m('quartzPillar'), belt: m('goldTrim'), mulEvery: 2 });
        LIB.holoBoard(w, x - 3, y + 16, z - 4, 'z', 7, 14, m('holoScreen'), -1);
        LIB.holoBoard(w, x + 4, y + 16, z - 3, 'x', 7, 14, m('holoPink'), 1);
        w.fill(x, y + 35, z, x, y + 42, z, m('steel'));
        w.set(x, y + 43, z, m('neonWhite'));
        LIB.lightPillar(w, x, z, y + 44, y + 66, 1.6, m('beamCyan'));
        built++;
      }
      console.log('[Cosmos] 环城楼群 ' + built + ' 栋');
    })();

    /* ---------------- 4. 中央尖塔 ---------------- */
    (function () {
      var sx = C.spire[0], sz = C.spire[1];
      var y = gy(sx, sz);
      // 基座
      LIB.podium(w, sx - 14, sz - 14, sx + 14, sz + 14, y, 2,
        { body: m('marble'), glass: m('glassGold'), win: m('windowGold'), trim: m('goldTrim'),
          canopy: m('goldTrim'), strip: m('lampWarm'), pillar: m('quartzPillar'), roof: 3 });
      y += 2 * LIB.ST + 2;
      // 22 档收分（总高约到 y=170）
      var half = 11, seg = 0;
      while (y < BY + 122 && half >= 2) {
        var segH = 7;
        w.fill(sx - half, y, sz - half, sx + half, y + segH, sz + half, m('whitePanel'));
        LIB.facade(w, sx - half, sz - half, sx + half, sz + half, y, y + segH - 1,
          { body: m('whitePanel'), win: m('windowGold'), mullion: m('quartzPillar'),
            belt: m('goldTrim'), mulEvery: 3, beltEvery: 2, storyH: 4 });
        LIB.eave(w, sx - half, sz - half, sx + half, sz + half, y + segH, 1, m('goldTrim'));
        // 四条竖向霓虹槽（通到顶）
        w.fill(sx, y, sz - half - 1, sx, y + segH, sz - half - 1, m('neonViolet'));
        w.fill(sx, y, sz + half + 1, sx, y + segH, sz + half + 1, m('neonViolet'));
        w.fill(sx - half - 1, y, sz, sx - half - 1, y + segH, sz, m('neonCyan'));
        w.fill(sx + half + 1, y, sz, sx + half + 1, y + segH, sz, m('neonCyan'));
        y += segH + 1;
        if (seg % 2 === 1 && half > 2) half -= 1;
        seg++;
      }
      // 冠部：晶体 + 星核 + 探照灯
      w.cone(sx, sz, y, y + 14, 4.6, 1.2, m('quartzPillar'));
      w.fill(sx, y + 14, sz, sx, y + 22, sz, m('goldTrim'));
      w.sphere(sx, y + 24, sz, 3.2, m('starCore'));
      LIB.lightPillar(w, sx, sz, y + 27, y + 58, 2.6, m('beamViolet'));
      LIB.searchlight(w, sx - 8, sz, y - 10, 3, [-0.6, 0.5, 0.3], m('beamCyan'));
      LIB.searchlight(w, sx + 8, sz, y - 10, 3, [0.6, 0.5, -0.3], m('beamCyan'));
      w.addLabel('中央尖塔', sx, y + 30, sz, 'poi', 'Cosmos 最高构筑 · 长老会巨像');
    })();

    /* ---------------- 5. 评议会大厅（穹顶 + 七把爸爸座椅） ---------------- */
    (function () {
      var px = C.council[0], pz = C.council[1] + 22;
      var y = gy(px, pz);
      var hx0 = px - 22, hx1 = px + 22, hz0 = pz - 15, hz1 = pz + 15;
      VX._flatRect(hx0 - 6, hz0 - 6, hx1 + 6, hz1 + 6, y - 1, 8, m('marble'), m('stoneLight'));
      y = gy(px, pz);
      // 低矮巨构（内部可见）
      w.shell(hx0, y, hz0, hx1, y + 13, hz1, m('marble'), m('whiteTile'), m('marble'));
      LIB.facade(w, hx0, hz0, hx1, hz1, y, y + 12,
        { body: m('marble'), win: m('windowGold'), mullion: m('quartzPillar'), belt: m('goldTrim'),
          mulEvery: 4, beltEvery: 3 });
      // 柱廊（南立面）
      for (k = 0; k < 9; k++) {
        var cx2 = hx0 + 3 + k * 5;
        w.fill(cx2, y, hz0 - 4, cx2, y + 12, hz0 - 4, m('quartzPillar'));
        w.set(cx2, y + 13, hz0 - 4, m('goldTrim'));
        w.set(cx2, y + 11, hz0 - 5, m('lampWarm'));
      }
      w.fill(hx0, y + 14, hz0 - 5, hx1, y + 15, hz0 - 4, m('goldTrim'));
      // 大穹顶
      w.dome(px, pz, y + 13, 15, m('steelDark'),
        { yScale: 0.86, thick: 1, rib: m('goldTrim'), ribEvery: 15, glass: m('glassGold') });
      w.fill(px, y + 27, pz, px, y + 32, pz, m('goldTrim'));
      w.set(px, y + 33, pz, m('neonWhite'));
      // 屋顶开洞让内部可见
      w.fill(px - 8, y + 13, pz - 6, px + 8, y + 13, pz + 6, 0);
      // 内部：红毯 + 中央讲台 + 七把座椅
      w.fill(hx0 + 1, y, hz0 + 1, hx1 - 1, y, hz1 - 1, m('whiteTile'));
      w.fill(px - 2, y + 1, hz0 + 1, px + 2, y + 1, hz1 - 1, m('redCarpet'));
      w.cyl(px, pz, 3.4, y + 1, y + 2, m('marble'));
      w.cyl(px, pz, 1.6, y + 3, y + 4, m('goldTrim'));
      w.set(px, y + 5, pz, m('holoScreen'));
      for (k = 0; k < 7; k++) {
        a = -Math.PI * 0.5 + (k - 3) * 0.36;
        var chx = Math.round(px + Math.sin(a + Math.PI / 2) * 11);
        var chz = Math.round(pz - Math.cos(a + Math.PI / 2) * 11 + 2);
        w.fill(chx - 1, y + 1, chz - 1, chx + 1, y + 2, chz + 1, m('darkMetal'));
        w.fill(chx - 1, y + 3, chz - 1, chx + 1, y + 6, chz - 1, m('obsidian'));
        w.set(chx, y + 5, chz, m('windowGold'));
        w.set(chx, y + 7, chz - 1, m('goldTrim'));
      }
      w.addLabel('评议会大厅', px, y + 38, pz, 'poi', '七位「爸爸」的席位');
    })();

    /* ---------------- 6. 宇宙港 ---------------- */
    (function () {
      var px = C.port[0], pz = C.port[1];
      var y = gy(px, pz);
      VX._flatRect(px - 26, pz - 20, px + 26, pz + 20, y - 1, 10, m('paveDark'), m('concreteDark'));
      y = gy(px, pz);
      // 三个发射坪
      var pads = [[px - 17, pz - 8, 8, 30], [px + 2, pz - 10, 9, 38], [px + 18, pz + 6, 7, 24]];
      for (k = 0; k < 3; k++) {
        var qx = pads[k][0], qz = pads[k][1], pr = pads[k][2], rh = pads[k][3];
        // 排焰坑
        w.disc(qx, qz, pr, y, m('hazardDark'));
        w.disc(qx, qz, pr - 1.4, y, m('scorch'));
        w.disc(qx, qz, pr, y, m('hazard'), pr - 0.9);
        // 火箭
        w.cyl(qx, qz, 2.6, y + 1, y + rh - 8, m('whitePanel'));
        for (i = 3; i < rh - 10; i += 6) w.ring(qx, qz, 2.4, 3.2, y + i, y + i, m('mechaRed'));
        w.cone(qx, qz, y + rh - 8, y + rh, 2.6, 0.6, m('whitePanel'));
        w.set(qx, y + rh + 1, qz, m('neonRed'));
        // 尾焰喷口
        w.disc(qx, qz, 2.2, y + 1, m('darkMetal'));
        w.set(qx, y, qz, m('ember'));
        // 塔架桁架
        var tgx = qx + pr - 1;
        for (i = 0; i <= rh - 6; i++) {
          if (i % 4 === 0) w.fill(tgx - 2, y + i, qz - 2, tgx, y + i, qz + 2, m('girder'));
          w.set(tgx, y + i, qz - 2, m('steelDark'));
          w.set(tgx, y + i, qz + 2, m('steelDark'));
        }
        w.fill(tgx - 3, y + rh - 12, qz - 1, qx + 2, y + rh - 12, qz + 1, m('grate'));
        w.set(tgx, y + rh - 5, qz, m('neonAmber'));
      }
      // 航站楼
      w.fill(px - 24, y, pz + 12, px - 4, y + 10, pz + 18, m('whitePanel2'));
      LIB.facade(w, px - 24, pz + 12, px - 4, pz + 18, y, y + 10,
        { body: m('whitePanel2'), win: m('windowCool'), mullion: m('steel'), belt: m('goldTrim'), mulEvery: 3 });
      LIB.roofScape(w, px - 24, pz + 12, px - 4, pz + 18, y + 11, 1, 0x707);
      LIB.neonSign(w, px - 22, y + 14, pz + 11, 'z', 'SPACEPORT', m('neonCyan'), { dir: -1 });
      // 管廊与储罐
      LIB.pipes(w, [[px - 24, pz + 10], [px + 20, pz + 10], [px + 20, pz - 4]], y + 3, m('steel'));
      LIB.tank(w, px + 22, pz - 14, y, 4.4, 9, {});
      LIB.tank(w, px + 12, pz - 18, y, 3.6, 8, {});
      LIB.searchlight(w, px - 26, pz - 16, y, 10, [0.6, 0.55, 0.4], m('beamWarm'));
      LIB.searchlight(w, px + 26, pz + 16, y, 10, [-0.6, 0.55, -0.4], m('beamWarm'));
      w.addLabel('宇宙港', px, y + 44, pz, 'poi', '天燕合体 · VIRM 决战出发地');
    })();

    /* ---------------- 7. 岩浆反应堆 ---------------- */
    (function () {
      var px = C.reactor[0], pz = C.reactor[1] + 8;
      var y = gy(px, pz);
      VX._flatRect(px - 20, pz - 16, px + 20, pz + 16, y - 1, 8, m('paveDark'), m('concreteDark'));
      y = gy(px, pz);
      // 半球穹顶（局部开口露出岩浆核）
      w.dome(px, pz, y, 13, m('concrete'), { yScale: 0.78, thick: 2 });
      w.fill(px - 4, y + 6, pz - 13, px + 4, y + 11, pz - 8, 0);
      w.cyl(px, pz, 5, y, y + 8, m('darkMetal'), { thick: 1 });
      w.cyl(px, pz, 3.6, y, y + 7, m('magmaCore'));
      w.disc(px, pz, 4.6, y + 9, m('lava'));
      // 冷却塔
      w.cyl(px - 16, pz + 10, 5, y, y + 14, m('concreteWarm'), { thick: 1 });
      w.disc(px - 16, pz + 10, 4, y + 15, m('ember'));
      // 四根烟囱
      LIB.stack(w, px + 15, pz - 10, y, 2.6, 26);
      LIB.stack(w, px + 15, pz + 10, y, 2.6, 22);
      LIB.stack(w, px - 15, pz - 10, y, 2.2, 20);
      LIB.stack(w, px + 4, pz + 14, y, 2.2, 18);
      // 分支导管（穹顶 → 各处）
      LIB.pipes(w, [[px - 13, pz], [px - 22, pz], [px - 22, pz + 14]], y + 4, m('rustMetal'));
      LIB.pipes(w, [[px + 13, pz - 2], [px + 22, pz - 2]], y + 5, m('steelDark'));
      LIB.pipes(w, [[px, pz + 13], [px, pz + 20]], y + 3, m('rustDeep'));
      for (k = 0; k < 5; k++) w.set(px - 20 + k * 2, y + 6, pz + 14, m('magma'));
      // 控制楼
      w.fill(px - 20, y, pz - 15, px - 10, y + 8, pz - 9, m('concrete'));
      LIB.facade(w, px - 20, pz - 15, px - 10, pz - 9, y, y + 8,
        { body: m('concrete'), win: m('windowCool'), mullion: m('steelDark'), belt: m('hazard'), mulEvery: 3 });
      LIB.roofScape(w, px - 20, pz - 15, px - 10, pz - 9, y + 9, 2, 0x808);
      LIB.holoBoard(w, px - 9, y + 4, pz - 14, 'x', 6, 5, m('holoGreen'), 1);
      w.addLabel('岩浆反应堆', px, y + 30, pz, 'poi', '真相伏笔 · 岩浆能源');
    })();

    w.addLabel('Cosmos 宇宙都市', CX, BY + 150, CZ - R - 20, 'site', '大人们的超级都市 · 四环八射');
    return w;
  };
})(window);
