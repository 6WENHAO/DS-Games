/* =====================================================================
 * 紫禁城 体素模型 — 外朝篇 (Outer Court)
 * ---------------------------------------------------------------------
 * 三台（工字形三层台基，8.13 m）、太和殿（重檐庐殿，走兽 10 只，全国唯一）、
 * 中和殿（单檐四角攒尖）、保和殿（重檐歇山，北出丹陛）、
 * 太和门（重檐歇山，最大铜狮一对）、昭德门 / 贞度门、协和门 / 熙和门、
 * 体仁阁 / 弘义阁（二层楼阁，单檐庐殿）、东西庑房与朝房、
 * 文华殿 / 文渊阁（黑琉璃瓦绿剪边）/ 武英殿、南三所（绿琉璃瓦）。
 * ===================================================================== */
(function (G) {
  'use strict';
  var B = G.GGPalette.BLOCK, A = G.Arch, C = G.Comp, P = G.Plan;
  var GY = P.GY;

  /* 单边栏杆（供工字形三台分段设置）；望柱以段中心计数，保证镜像对称 */
  function railX(v, x0, x1, z, y, gapFrom, gapTo) {
    var c = (x0 + x1) / 2;
    for (var x = x0; x <= x1; x++) {
      if (gapFrom !== undefined && x >= gapFrom && x <= gapTo) continue;
      var post = (Math.round(Math.abs(x - c)) % 3) === 0 || x === x0 || x === x1;
      for (var k = 1; k <= (post ? 3 : 2); k++) v.set(x, y + k, z, B.RAIL);
      if (post) v.set(x, y + 4, z, B.MARBLE_D);
    }
  }
  function railZ(v, z0, z1, x, y, gapFrom, gapTo) {
    var c = (z0 + z1) / 2;
    for (var z = z0; z <= z1; z++) {
      if (gapFrom !== undefined && z >= gapFrom && z <= gapTo) continue;
      var post = (Math.round(Math.abs(z - c)) % 3) === 0 || z === z0 || z === z1;
      for (var k = 1; k <= (post ? 3 : 2); k++) v.set(x, y + k, z, B.RAIL);
      if (post) v.set(x, y + 4, z, B.MARBLE_D);
    }
  }

  /* ================= 三台（工字形，总长 232 × 最宽 130 × 高 8.13） ================= */
  function santai(v) {
    v.tag('三台');
    var S = P.SANTAI, h = S.h, top = GY + h;
    var parts = [S.south, S.waist, S.north];
    var i, k, x, z;

    // 三层叠落：每层向内收 3 m，形成"三台"层次与栏杆平座
    for (i = 0; i < 3; i++) {
      var lo = GY + Math.round(h * i / 3), hi = GY + Math.round(h * (i + 1) / 3) - 1;
      var ins = (2 - i) * 3;
      for (k = 0; k < 3; k++) {
        var p = parts[k];
        var band = 3;
        for (var yy = lo; yy <= hi; yy++) {
          var ax0 = p.x0 - ins, ax1 = p.x1 + ins, az0 = p.z0 - (k === 0 ? ins : 0), az1 = p.z1 + (k === 2 ? ins : 0);
          for (x = ax0; x <= ax1; x++) {
            var xe = (x - ax0 < band) || (ax1 - x < band);
            for (z = az0; z <= az1; z++)
              if (xe || (z - az0 < band) || (az1 - z < band))
                v.set(x, yy, z, ((x + z) % 11 === 0) ? B.MARBLE_D : B.MARBLE);
          }
        }
        // 每层平台台面 + 栏杆
        if (i < 2) {
          var ty = hi + 1;
          for (x = p.x0 - ins; x <= p.x1 + ins; x++)
            for (z = p.z0 - (k === 0 ? ins : 0); z <= p.z1 + (k === 2 ? ins : 0); z++) {
              var innerX = x > p.x0 - ins + 3 && x < p.x1 + ins - 3;
              var innerZ = z > p.z0 - (k === 0 ? ins : 0) + 3 && z < p.z1 + (k === 2 ? ins : 0) - 3;
              if (!(innerX && innerZ)) v.set(x, ty, z, B.MARBLE);
            }
        }
      }
    }
    // 顶层台面
    for (k = 0; k < 3; k++) {
      var q = parts[k];
      for (x = q.x0; x <= q.x1; x++) for (z = q.z0; z <= q.z1; z++) v.set(x, top, z, B.MARBLE);
    }
    // 螭首排水口（雨天"千龙吐水"）；自中心向两侧对称布点
    for (k = 0; k < 3; k++) {
      var r = parts[k], mx = (r.x0 + r.x1) / 2, mz = (r.z0 + r.z1) / 2, q2;
      for (q2 = 0; mx - 4 - q2 * 6 >= r.x0 + 2; q2++) {
        var xa = Math.round(mx - 4 - q2 * 6), xb = Math.round(mx + 4 + q2 * 6);
        v.set(xa, top - 1, r.z0 - 1, B.MARBLE_D); v.set(xa, top - 1, r.z1 + 1, B.MARBLE_D);
        v.set(xb, top - 1, r.z0 - 1, B.MARBLE_D); v.set(xb, top - 1, r.z1 + 1, B.MARBLE_D);
      }
      for (q2 = 0; mz - 4 - q2 * 6 >= r.z0 + 2; q2++) {
        var za = Math.round(mz - 4 - q2 * 6), zb = Math.round(mz + 4 + q2 * 6);
        v.set(r.x0 - 1, top - 1, za, B.MARBLE_D); v.set(r.x1 + 1, top - 1, za, B.MARBLE_D);
        v.set(r.x0 - 1, top - 1, zb, B.MARBLE_D); v.set(r.x1 + 1, top - 1, zb, B.MARBLE_D);
      }
    }

    // 顶层栏杆（沿工字形外轮廓分段，御路处留口）
    railX(v, S.south.x0, S.south.x1, S.south.z0, top, -24, 24);       // 南沿（三出陛开口）
    railZ(v, S.south.z0, S.south.z1, S.south.x0, top, -140, -120);
    railZ(v, S.south.z0, S.south.z1, S.south.x1, top, -140, -120);
    railX(v, S.south.x0, S.waist.x0, S.south.z1, top);                // 工字凹进段
    railX(v, S.waist.x1, S.south.x1, S.south.z1, top);
    railZ(v, S.waist.z0, S.waist.z1, S.waist.x0, top);
    railZ(v, S.waist.z0, S.waist.z1, S.waist.x1, top);
    railX(v, S.north.x0, S.waist.x0, S.north.z0, top);
    railX(v, S.waist.x1, S.north.x1, S.north.z0, top);
    railZ(v, S.north.z0, S.north.z1, S.north.x0, top, -10, 20);
    railZ(v, S.north.z0, S.north.z1, S.north.x1, top, -10, 20);
    railX(v, S.north.x0, S.north.x1, S.north.z1, top, -14, 14);       // 北沿（保和殿后丹陛）

    // 南面三出陛：中御路 + 东西两阶，逐层跌落
    v.tag('三台·三出陛');
    A.stepsNS(v, { x0: -24, x1: 24, z: S.south.z0 - 1, dir: -1, yTop: top, yBot: GY - 1,
                   depth: 30, way: 9 });
    // 北面丹陛（保和殿后，千龙吐水之所）
    A.stepsNS(v, { x0: -14, x1: 14, z: S.north.z1 + 1, dir: +1, yTop: top, yBot: GY - 1,
                   depth: 26, way: 7 });
    // 东西侧阶
    A.stepsEW(v, { z0: -140, z1: -120, x: S.south.x0 - 1, dir: -1, yTop: top, yBot: GY - 1, depth: 26 });
    A.stepsEW(v, { z0: -140, z1: -120, x: S.south.x1 + 1, dir: +1, yTop: top, yBot: GY - 1, depth: 26 });
    A.stepsEW(v, { z0: -10, z1: 20, x: S.north.x0 - 1, dir: -1, yTop: top, yBot: GY - 1, depth: 26 });
    A.stepsEW(v, { z0: -10, z1: 20, x: S.north.x1 + 1, dir: +1, yTop: top, yBot: GY - 1, depth: 26 });
    return top;
  }

  /* ================= 三大殿 ================= */
  function threeHalls(v, santaiTop) {
    var g = santaiTop;
    var H = P.HALLS;

    /* --- 太和殿：11 间 63.96 × 5 间 37.20，通高 35.05，重檐庐殿顶 --- */
    C.hall(v, {
      name: '太和殿', cx: 0, cz: H.taihedian.cz, w: H.taihedian.w, d: H.taihedian.d,
      ground: g, podium: 2, xushi: true, chishou: true, rail: true,
      wallH: 8, bays: 11, front: 's', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, upperInset: 3,
      roof: 'hip', roofLayers: 5, ridgeH: 2, overhang: 4, beasts: 10,
      steps: [{ side: 's', w: 20, way: 7 }],
      yuetai: { w: 92, d: 30, rail: true, stepW: 22, way: 7, chishou: true }
    });

    /* 月台陈设：日晷（东）、嘉量（西）、铜龟铜鹤、鼎式香炉 18 座（象征十八行省） */
    v.tag('太和殿·月台陈设');
    var ytY = g + 3, ytZ = H.taihedian.cz - 19 - 15;   // 立于月台台面之上
    A.sundial(v, 26, ytZ + 6, ytY);          // 日晷（东）
    A.sundial(v, -26, ytZ + 6, ytY);         // 嘉量（西）
    A.craneTurtle(v, 15, ytZ + 14, ytY, false);  // 铜龟（东）
    A.craneTurtle(v, -15, ytZ + 14, ytY, true);  // 铜鹤（西）
    for (var i = 0; i < 9; i++) {
      var xx = 8 + i * 4;
      A.censer(v, xx, ytZ + 1, ytY);
      A.censer(v, -xx, ytZ + 1, ytY);
    }
    // 台基四角铜鼎：三台台面（y=g）与月台台面（y=g+2）标高不同，须分别落位
    [[38, -66], [-38, -66]].forEach(function (p) { A.vat(v, p[0], p[1], g + 1); });
    [[42, -118], [-42, -118]].forEach(function (p) { A.vat(v, p[0], p[1], g + 3); });

    /* --- 中和殿：24.15 见方，单檐四角攒尖顶，铜镀金宝顶 --- */
    C.hall(v, {
      name: '中和殿', cx: 0, cz: H.zhonghedian.cz, w: H.zhonghedian.w, d: H.zhonghedian.d,
      ground: g, podium: 1, rail: true, wallH: 7, bays: 3, front: 'all', veranda: true,
      roof: 'pyramid', roofLayers: 6, overhang: 3, finialH: 2, beasts: 7,
      steps: [{ side: 's', w: 10, way: 4 }, { side: 'n', w: 10, way: 4 },
              { side: 'e', w: 8 }, { side: 'w', w: 8 }]
    });

    /* --- 保和殿：9 间 49.68 × 5 间 24.44，通高 29.50，重檐歇山顶 --- */
    C.hall(v, {
      name: '保和殿', cx: 0, cz: H.baohedian.cz, w: H.baohedian.w, d: H.baohedian.d,
      ground: g, podium: 1, rail: true, chishou: true,
      wallH: 6, bays: 9, front: 'both', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, upperInset: 3,
      roof: 'gablehip', roofLayers: 5, ridgeH: 2, overhang: 4, beasts: 9,
      steps: [{ side: 's', w: 14, way: 5 }, { side: 'n', w: 14, way: 5 }]
    });
  }

  /* ================= 太和门区（含内金水桥前广场） ================= */
  function taihemenArea(v) {
    /* 太和门：9 间约 40 m，重檐歇山顶，通高 23.8，门前铜狮为宫内最大 */
    C.hall(v, {
      name: '太和门', cx: 0, cz: P.AXIS.taihemen, w: 40, d: 25, ground: GY,
      podium: 2, xushi: true, rail: true, wallH: 6, bays: 9, front: 'both', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, roof: 'gablehip', roofLayers: 4,
      ridgeH: 2, overhang: 4, beasts: 9,
      steps: [{ side: 's', w: 14, way: 5 }, { side: 'n', w: 14, way: 5 }],
      yuetai: { w: 56, d: 18, rail: true, stepW: 16, way: 5 }
    });
    v.tag('太和门·铜狮');
    A.lion(v, 22, P.AXIS.taihemen - 22, GY + 3);
    A.lion(v, -22, P.AXIS.taihemen - 22, GY + 3);

    /* 昭德门（东）/ 贞度门（西）：太和门两侧，单檐歇山 */
    C.hall(v, { name: '昭德门', cx: 40, cz: P.AXIS.taihemen, w: 16, d: 14, ground: GY,
      podium: 2, wallH: 7, bays: 3, front: 'both', roof: 'gablehip', roofLayers: 4,
      overhang: 3, steps: [{ side: 's', w: 8 }] });
    C.hall(v, { name: '贞度门', cx: -40, cz: P.AXIS.taihemen, w: 16, d: 14, ground: GY,
      podium: 2, wallH: 7, bays: 3, front: 'both', roof: 'gablehip', roofLayers: 4,
      overhang: 3, steps: [{ side: 's', w: 8 }] });

    /* 协和门（东）/ 熙和门（西）：广场东西，面阔沿南北 */
    C.hall(v, { name: '协和门', cx: 101, cz: -370, w: 12, d: 24, ground: GY,
      podium: 2, wallH: 7, bays: 3, front: 'all', roof: 'gablehip', roofLayers: 4, overhang: 3 });
    C.hall(v, { name: '熙和门', cx: -101, cz: -370, w: 12, d: 24, ground: GY,
      podium: 2, wallH: 7, bays: 3, front: 'all', roof: 'gablehip', roofLayers: 4, overhang: 3 });

    /* 太和门广场东西朝房（銮仪卫值房等，长排通脊） */
    C.corridor(v, { name: '东朝房', x0: 82, x1: 96, z0: -432, z1: -388, ground: GY, h: 6, axis: 'z', open: 'w' });
    C.corridor(v, { name: '东朝房', x0: 82, x1: 96, z0: -352, z1: -312, ground: GY, h: 6, axis: 'z', open: 'w' });
    C.corridor(v, { name: '西朝房', x0: -96, x1: -82, z0: -432, z1: -388, ground: GY, h: 6, axis: 'z', open: 'e' });
    C.corridor(v, { name: '西朝房', x0: -96, x1: -82, z0: -352, z1: -312, ground: GY, h: 6, axis: 'z', open: 'e' });
  }

  /* ================= 太和殿广场东西庑房与四门 ================= */
  function outerSquare(v) {
    // 东西庑房（沿广场宫墙内侧）
    C.corridor(v, { name: '东庑', x0: 84, x1: 97, z0: -300, z1: -244, ground: GY, h: 6, axis: 'z', open: 'w' });
    C.corridor(v, { name: '东庑', x0: 84, x1: 97, z0: -216, z1: -178, ground: GY, h: 6, axis: 'z', open: 'w' });
    C.corridor(v, { name: '西庑', x0: -97, x1: -84, z0: -300, z1: -244, ground: GY, h: 6, axis: 'z', open: 'e' });
    C.corridor(v, { name: '西庑', x0: -97, x1: -84, z0: -216, z1: -178, ground: GY, h: 6, axis: 'z', open: 'e' });

    // 体仁阁（东）/ 弘义阁（西）：二层楼阁，面阔 9 间约 40 m，单檐庐殿顶，须弥座 3.4
    // 注意让开广场东西宫墙（x=100..102），否则楼身会穿墙
    C.hall(v, { name: '体仁阁', cx: 111, cz: P.TIRENGE.cz, w: 16, d: 40, ground: GY,
      podium: 3, xushi: true, rail: true, wallH: 8, bays: 3, front: 'all', veranda: true,
      double: true, skirtLayers: 2, upperH: 6, roof: 'hip', roofLayers: 4, overhang: 3,
      beasts: 7, steps: [{ side: 'w', w: 10 }] });
    C.hall(v, { name: '弘义阁', cx: -111, cz: P.HONGYIGE.cz, w: 16, d: 40, ground: GY,
      podium: 3, xushi: true, rail: true, wallH: 8, bays: 3, front: 'all', veranda: true,
      double: true, skirtLayers: 2, upperH: 6, roof: 'hip', roofLayers: 4, overhang: 3,
      beasts: 7, steps: [{ side: 'e', w: 10 }] });

    // 中左门 / 中右门（三台两侧）、后左门 / 后右门（保和殿后）
    C.wallGate(v, { name: '中左门', cx: 100, cz: -232, axis: 'z', w: 7, h: 8, thick: 3 });
    C.wallGate(v, { name: '中右门', cx: -102, cz: -232, axis: 'z', w: 7, h: 8, thick: 3 });
    C.wallGate(v, { name: '后左门', cx: 100, cz: -196, axis: 'z', w: 7, h: 8, thick: 3 });
    C.wallGate(v, { name: '后右门', cx: -102, cz: -196, axis: 'z', w: 7, h: 8, thick: 3 });
  }

  /* ================= 文华殿 / 文渊阁 / 武英殿 / 南三所 ================= */
  function eastWestCourts(v) {
    /* 文华殿：单檐歇山，明初为皇太子视事之所曾覆绿琉璃瓦，嘉靖改黄瓦 */
    C.hall(v, { name: '文华殿', cx: P.WENHUA.cx, cz: P.WENHUA.cz, w: 26, d: 15, ground: GY,
      podium: 2, rail: true, wallH: 8, bays: 5, front: 's', roof: 'gablehip', roofLayers: 5,
      overhang: 3, beasts: 7, steps: [{ side: 's', w: 10, way: 4 }],
      yuetai: { w: 36, d: 12, rail: true, stepW: 10, way: 4 } });
    C.hall(v, { name: '主敬殿', cx: P.WENHUA.cx, cz: P.WENHUA.cz + 30, w: 22, d: 13, ground: GY,
      podium: 1, wallH: 7, bays: 5, front: 's', roof: 'gablehip', roofLayers: 4, overhang: 2 });
    /* 文渊阁：面阔 6 间（宫内罕见的偶数开间），黑琉璃瓦绿剪边，取"黑主水"以克火护书 */
    C.hall(v, { name: '文渊阁', cx: P.WENYUAN.cx, cz: P.WENYUAN.cz, w: 30, d: 14, ground: GY,
      podium: 2, rail: true, wallH: 7, bays: 6, front: 's', tile: B.TILE_K,
      double: true, skirtLayers: 2, upperH: 6, roof: 'gablehip', roofLayers: 4, overhang: 3,
      steps: [{ side: 's', w: 8 }] });
    // 文华殿院墙
    A.palaceWallZ(v, P.WENHUA.cz - 34, P.WENYUAN.cz + 20, P.WENHUA.cx - 30, GY, 6, 2, B.TILE_Y);
    A.palaceWallZ(v, P.WENHUA.cz - 34, P.WENYUAN.cz + 20, P.WENHUA.cx + 30, GY, 6, 2, B.TILE_Y);
    A.palaceWallX(v, P.WENHUA.cx - 30, P.WENHUA.cx - 8, P.WENHUA.cz - 34, GY, 6, 2, B.TILE_Y);
    A.palaceWallX(v, P.WENHUA.cx + 8, P.WENHUA.cx + 30, P.WENHUA.cz - 34, GY, 6, 2, B.TILE_Y);
    C.wallGate(v, { name: '文华门', cx: P.WENHUA.cx, cz: P.WENHUA.cz - 34, axis: 'x', w: 9, h: 8, thick: 2 });

    /* 武英殿：单檐歇山，清代设武英殿修书处 */
    C.hall(v, { name: '武英殿', cx: P.WUYING.cx, cz: P.WUYING.cz, w: 26, d: 15, ground: GY,
      podium: 2, rail: true, wallH: 8, bays: 5, front: 's', roof: 'gablehip', roofLayers: 5,
      overhang: 3, beasts: 7, steps: [{ side: 's', w: 10, way: 4 }],
      yuetai: { w: 36, d: 12, rail: true, stepW: 10, way: 4 } });
    C.hall(v, { name: '敬思殿', cx: P.WUYING.cx, cz: P.WUYING.cz + 30, w: 22, d: 13, ground: GY,
      podium: 1, wallH: 7, bays: 5, front: 's', roof: 'gablehip', roofLayers: 4, overhang: 2 });
    A.palaceWallZ(v, P.WUYING.cz - 34, P.WUYING.cz + 48, P.WUYING.cx - 30, GY, 6, 2, B.TILE_Y);
    A.palaceWallZ(v, P.WUYING.cz - 34, P.WUYING.cz + 48, P.WUYING.cx + 30, GY, 6, 2, B.TILE_Y);
    A.palaceWallX(v, P.WUYING.cx - 30, P.WUYING.cx - 8, P.WUYING.cz - 34, GY, 6, 2, B.TILE_Y);
    A.palaceWallX(v, P.WUYING.cx + 8, P.WUYING.cx + 30, P.WUYING.cz - 34, GY, 6, 2, B.TILE_Y);
    C.wallGate(v, { name: '武英门', cx: P.WUYING.cx, cz: P.WUYING.cz - 34, axis: 'x', w: 9, h: 8, thick: 2 });

    /* 南三所：皇子居所，按制覆绿琉璃瓦（非黄瓦） */
    var N = P.NANSANSUO;
    for (var i = 0; i < 3; i++) {
      var x0 = N.x0 + i * 38;
      C.courtyard(v, { name: '南三所' + (i + 1), x0: x0, x1: x0 + 34,
                       z0: N.z0, z1: N.z1, tile: B.TILE_G });
    }
  }

  G.Outer = { santai: santai, threeHalls: threeHalls, taihemenArea: taihemenArea,
              outerSquare: outerSquare, eastWestCourts: eastWestCourts };
})(typeof window !== 'undefined' ? window : globalThis);
