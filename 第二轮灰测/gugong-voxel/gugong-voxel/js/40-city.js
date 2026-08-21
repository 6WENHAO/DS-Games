/* =====================================================================
 * 紫禁城 体素模型 — 城垣篇 (City)
 * ---------------------------------------------------------------------
 * 内容：城墙（红墙身 / 外侧雁翅垛口墙 / 内侧宇墙 / 马道）、护城河（筒子河，
 *       南面绕午门前广场向南折出）、四座角楼（三重檐十字脊）、
 *       午门、神武门、东华门、西华门、内金水河与内金水桥、
 *       街巷宫墙、广场海墁铺装与御路。
 * ===================================================================== */
(function (G) {
  'use strict';
  var B = G.GGPalette.BLOCK, A = G.Arch, C = G.Comp, P = G.Plan;
  var GY = P.GY;

  /* ================= 城墙 ================= */
  /** skips：四门城台（墙身与墙顶都让开）；tops：角楼墩台（仅墙顶让开，墙身照旧连续） */
  function cityWall(v, skips, tops) {
    v.tag('城墙');
    var W = P.WALL, h = W.h, t = W.thick;
    tops = tops || [];
    function skipped(x, z) {
      for (var i = 0; i < skips.length; i++) {
        var s = skips[i];
        if (x >= s.x0 - 1 && x <= s.x1 + 1 && z >= s.z0 - 1 && z <= s.z1 + 1) return true;
      }
      return false;
    }
    function skippedTop(x, z) {
      if (skipped(x, z)) return true;
      for (var i = 0; i < tops.length; i++) {
        var s = tops[i];
        if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return true;
      }
      return false;
    }
    var i, x, z, y;
    for (i = 0; i < h; i++) {
      var ins = Math.round(i * 2 / (h - 1));           // 外皮收分 0→2
      y = GY + i;
      // 南 / 北
      for (x = W.x0 + ins; x <= W.x1 - ins; x++) {
        for (z = W.z0 + ins; z <= W.z0 + t - 1; z++)
          if (!skipped(x, z)) v.set(x, y, z, ((x + z + i) % 9 === 0) ? B.WALL_CITY_D : B.WALL_CITY);
        for (z = W.z1 - t + 1; z <= W.z1 - ins; z++)
          if (!skipped(x, z)) v.set(x, y, z, ((x + z + i) % 9 === 0) ? B.WALL_CITY_D : B.WALL_CITY);
      }
      // 西 / 东
      for (z = W.z0 + ins; z <= W.z1 - ins; z++) {
        for (x = W.x0 + ins; x <= W.x0 + t - 1; x++)
          if (!skipped(x, z)) v.set(x, y, z, ((x + z + i) % 9 === 0) ? B.WALL_CITY_D : B.WALL_CITY);
        for (x = W.x1 - t + 1; x <= W.x1 - ins; x++)
          if (!skipped(x, z)) v.set(x, y, z, ((x + z + i) % 9 === 0) ? B.WALL_CITY_D : B.WALL_CITY);
      }
    }

    // 墙顶海墁 + 垛口墙（外）+ 宇墙（内）
    var ty = GY + h, insT = 2;
    function topRun(ax, az, dir, len, outSide) {
      // dir: 'x' 沿东西；垛口按绝对坐标取模，保证东西镜像严格对称
      for (var k = 0; k < len; k++) {
        var xx = dir === 'x' ? ax + k : ax, zz = dir === 'x' ? az : az + k;
        if (skippedTop(xx, zz)) continue;
        var mod = (dir === 'x' ? Math.abs(xx) : Math.abs(zz)) % 5;
        // 外侧雁翅形垛口墙：4 米垛身 + 1 米垛口，垛身中部留射孔
        for (var q = 0; q < W.parapetOut; q++) {
          if (mod === 4 && q >= 1) continue;
          if (mod === 2 && q === 1) continue;             // 射孔
          v.set(xx, ty + 1 + q, zz, B.WALL_CITY);
        }
        v.set(xx, ty + 1 + W.parapetOut, zz, B.BRICK);    // 压顶
      }
    }
    // 海墁
    for (x = W.x0 + insT; x <= W.x1 - insT; x++) {
      for (z = W.z0 + insT; z <= W.z0 + t - 1; z++) if (!skippedTop(x, z)) v.set(x, ty, z, B.PAVE);
      for (z = W.z1 - t + 1; z <= W.z1 - insT; z++) if (!skippedTop(x, z)) v.set(x, ty, z, B.PAVE);
    }
    for (z = W.z0 + insT; z <= W.z1 - insT; z++) {
      for (x = W.x0 + insT; x <= W.x0 + t - 1; x++) if (!skippedTop(x, z)) v.set(x, ty, z, B.PAVE);
      for (x = W.x1 - t + 1; x <= W.x1 - insT; x++) if (!skippedTop(x, z)) v.set(x, ty, z, B.PAVE);
    }
    // 外侧垛口墙
    topRun(W.x0 + insT, W.z0 + insT, 'x', W.x1 - W.x0 - 2 * insT + 1, -1);
    topRun(W.x0 + insT, W.z1 - insT, 'x', W.x1 - W.x0 - 2 * insT + 1, +1);
    topRun(W.x0 + insT, W.z0 + insT, 'z', W.z1 - W.z0 - 2 * insT + 1, -1);
    topRun(W.x1 - insT, W.z0 + insT, 'z', W.z1 - W.z0 - 2 * insT + 1, +1);
    // 内侧宇墙（无垛口）
    function yuQiang(ax, az, dir, len) {
      for (var k = 0; k < len; k++) {
        var xx = dir === 'x' ? ax + k : ax, zz = dir === 'x' ? az : az + k;
        if (skippedTop(xx, zz)) continue;
        for (var q = 0; q < W.parapetIn; q++) v.set(xx, ty + 1 + q, zz, B.WALL_CITY);
        v.set(xx, ty + 1 + W.parapetIn, zz, B.BRICK);
      }
    }
    yuQiang(W.x0 + t - 1, W.z0 + t - 1, 'x', W.x1 - W.x0 - 2 * (t - 1) + 1);
    yuQiang(W.x0 + t - 1, W.z1 - t + 1, 'x', W.x1 - W.x0 - 2 * (t - 1) + 1);
    yuQiang(W.x0 + t - 1, W.z0 + t - 1, 'z', W.z1 - W.z0 - 2 * (t - 1) + 1);
    yuQiang(W.x1 - t + 1, W.z0 + t - 1, 'z', W.z1 - W.z0 - 2 * (t - 1) + 1);

    // 马道（登城坡道，设于城墙内侧，集中在四门与角楼附近）
    v.tag('马道');
    var mados = [
      { x: -70, z: W.z0 + t, dir: 'n' }, { x: 70, z: W.z0 + t, dir: 'n' },
      { x: -46, z: W.z1 - t, dir: 's' }, { x: 46, z: W.z1 - t, dir: 's' },
      { x: W.x0 + t, z: -240, dir: 'e' }, { x: W.x1 - t, z: -240, dir: 'w' },
      { x: W.x0 + t, z: 300, dir: 'e' }, { x: W.x1 - t, z: 300, dir: 'w' }
    ];
    mados.forEach(function (m) {
      var len = h * 3, k, yy;
      for (k = 0; k < len; k++) {
        yy = GY + Math.max(0, Math.round(h * (1 - k / len)));
        for (var w = -4; w <= 4; w++) {
          if (m.dir === 'n') for (var q = 0; q <= yy - GY; q++) v.set(m.x + w, GY + q, m.z + k, q === yy - GY ? B.BRICK : B.WALL_CITY_D);
          if (m.dir === 's') for (var q2 = 0; q2 <= yy - GY; q2++) v.set(m.x + w, GY + q2, m.z - k, q2 === yy - GY ? B.BRICK : B.WALL_CITY_D);
          if (m.dir === 'e') for (var q3 = 0; q3 <= yy - GY; q3++) v.set(m.x + k, GY + q3, m.z + w, q3 === yy - GY ? B.BRICK : B.WALL_CITY_D);
          if (m.dir === 'w') for (var q4 = 0; q4 <= yy - GY; q4++) v.set(m.x - k, GY + q4, m.z + w, q4 === yy - GY ? B.BRICK : B.WALL_CITY_D);
        }
      }
    });
  }

  /* ================= 角楼（三重檐十字脊，九梁十八柱七十二脊） ================= */
  function crossBody(v, cx, cz, L, S, y0, y1, wallMat) {
    // 十字（曲尺）平面：两个互相垂直的矩形之并
    var x, z, y;
    for (y = y0; y <= y1; y++) {
      for (x = cx - L; x <= cx + L; x++)
        for (z = cz - S; z <= cz + S; z++) {
          var onEdge = (x === cx - L || x === cx + L || z === cz - S || z === cz + S);
          if (onEdge) v.set(x, y, z, wallMat);
        }
      for (x = cx - S; x <= cx + S; x++)
        for (z = cz - L; z <= cz + L; z++) {
          var onEdge2 = (x === cx - S || x === cx + S || z === cz - L || z === cz + L);
          if (onEdge2) v.set(x, y, z, wallMat);
        }
    }
    // 十字内角处的凹角柱（九梁十八柱之柱列）
    var pts = [[S, S], [-S, S], [S, -S], [-S, -S]];
    for (var i = 0; i < 4; i++) v.column(cx + pts[i][0], cz + pts[i][1], y0, y1, B.COL_R);
    // 檐柱
    for (x = cx - L; x <= cx + L; x += Math.max(2, Math.round(L))) {
      v.column(x, cz - S, y0, y1, B.COL_R); v.column(x, cz + S, y0, y1, B.COL_R);
    }
    for (z = cz - L; z <= cz + L; z += Math.max(2, Math.round(L))) {
      v.column(cx - S, z, y0, y1, B.COL_R); v.column(cx + S, z, y0, y1, B.COL_R);
    }
  }

  function cornerTower(v, cx, cz, tag) {
    v.tag(tag);
    var base = GY + P.WALL.h;                       // 墩台顶（城墙顶）
    // 台明
    v.plate(cx - 11, cz - 11, cx + 11, cz + 11, base, B.PAVE);
    A.podium(v, { x0: cx - 10, x1: cx + 10, z0: cz - 10, z1: cz + 10, y0: base, h: 1,
                  body: B.STONE, cap: B.STONE, dark: B.STONE });
    var y = base + 2;

    // 下层殿身（十字平面 19×19）
    crossBody(v, cx, cz, 9, 4, y, y + 3, B.WALL_R);
    A.facade(v, { x0: cx - 9, x1: cx + 9, z0: cz - 4, z1: cz + 4, y: y, h: 4, bays: 3,
                  front: 'both', dougong: false });
    // 下层腰檐
    var sk1 = A.eaveSkirt(v, { x0: cx - 12, x1: cx + 12, z0: cz - 12, z1: cz + 12,
                               y: y + 4, layers: 2, run: 4 });
    // 中层殿身
    var y2 = sk1.top + 1;
    crossBody(v, cx, cz, 7, 3, y2, y2 + 1, B.WALL_R);
    var sk2 = A.eaveSkirt(v, { x0: cx - 9, x1: cx + 9, z0: cz - 9, z1: cz + 9,
                               y: y2 + 2, layers: 2, run: 3 });
    // 上层殿身
    var y3 = sk2.top + 1;
    crossBody(v, cx, cz, 5, 2, y3, y3, B.WALL_R);
    // 顶层十字脊（两条正脊十字相交，四面山花，铜镀金宝顶）
    A.roofCross(v, { x0: cx - 8, x1: cx + 8, z0: cz - 8, z1: cz + 8, y: y3 + 1, armHalf: 3, slope: 1.0 });
  }

  /* ================= 午门 ================= */
  function wumen(v) {
    var M = P.WUMEN, h = M.h;
    v.tag('午门·城台');
    // 主城台（含明三门洞：中门 + 左右门；两掖门开在雁翅楼内侧）
    C.gateTerrace(v, {
      name: '午门·城台', x0: M.main.x0, x1: M.main.x1, z0: M.main.z0, z1: M.main.z1, h: h,
      gates: [{ axis: 'z', at: 0, w: 7, h: 10 }, { axis: 'z', at: -20, w: 5, h: 8 },
              { axis: 'z', at: 20, w: 5, h: 8 }]
    });
    // 两翼（雁翅）
    C.gateTerrace(v, { name: '午门·东雁翅', x0: M.main.x1 - M.wingW + 1, x1: M.main.x1,
      z0: M.wingZ0, z1: M.wingZ1, h: h,
      gates: [{ axis: 'x', at: -520, w: 5, h: 8 }] });
    C.gateTerrace(v, { name: '午门·西雁翅', x0: M.main.x0, x1: M.main.x0 + M.wingW - 1,
      z0: M.wingZ0, z1: M.wingZ1, h: h,
      gates: [{ axis: 'x', at: -520, w: 5, h: 8 }] });

    var top = GY + h;
    // 正楼：面阔 9 间 60.05 m，重檐庐殿顶
    C.hall(v, { name: '午门·正楼', cx: 0, cz: P.AXIS.wumenTower, w: M.tower.w, d: M.tower.d,
      ground: top, podium: 1, wallH: 7, bays: 9, front: 'both', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, roof: 'hip', roofLayers: 6,
      overhang: 4, beasts: 9, rail: true, chishou: true });

    // 四座阙亭：重檐四角攒尖顶，铜镀金宝顶
    var qx = [M.main.x0 + 11, M.main.x1 - 11];
    var qz = [M.wingZ1 - 6, M.wingZ0 + 6];
    for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) {
      C.hall(v, { name: '午门·阙亭', cx: qx[a], cz: qz[b], w: M.que, d: M.que,
        ground: top, podium: 1, wallH: 6, bays: 3, front: 'all',
        double: true, skirtLayers: 2, upperH: 5, roof: 'pyramid', overhang: 2, rail: true });
    }
    // 雁翅楼明廊（连接正楼与阙亭）
    for (var s = 0; s < 2; s++) {
      var xx = s === 0 ? M.main.x0 + 11 : M.main.x1 - 11;
      C.corridor(v, { name: '午门·雁翅楼', x0: xx - 5, x1: xx + 5,
        z0: M.wingZ0 + 14, z1: M.wingZ1 - 14, ground: top, h: 7, axis: 'z', open: 'w' });
    }
    // 正楼两侧登城马道（东西对称）
    v.tag('午门·登城道');
    [-30, 30].forEach(function (mx) {
      for (var k = 0; k <= h; k++) {
        var zz = M.main.z1 - 2 - (h - k) * 2;
        for (var w = -5; w <= 5; w++)
          for (var q = 0; q <= k; q++)
            v.set(mx + w, GY + q, zz, q === k ? B.BRICK : B.WALL_CITY_D);
      }
    });

    // 中门实榻大门门扇（内退于券洞中段），门钉九路八十一颗低于体素分辨率，此处表现门扇与铺首
    C.gateDoor(v, { name: '午门·中门门扇', axis: 'z', at: 0, plane: M.main.z0 + 12,
                    w: 7, h: 10 });
  }

  /* ================= 神武门 / 东华门 / 西华门 ================= */
  function northAndSideGates(v) {
    // 神武门（北）：城台三券门 + 重檐庐殿顶城楼
    var S = P.SHENWUMEN;
    C.gateTerrace(v, { name: '神武门·城台', x0: S.x0, x1: S.x1, z0: S.z0, z1: S.z1, h: S.h,
      gates: [{ axis: 'z', at: 0, w: 7, h: 9 }, { axis: 'z', at: -16, w: 5, h: 8 },
              { axis: 'z', at: 16, w: 5, h: 8 }] });
    C.hall(v, { name: '神武门·城楼', cx: 0, cz: P.AXIS.shenwumen, w: S.tower.w, d: S.tower.d,
      ground: GY + S.h, podium: 1, wallH: 5, bays: 5, front: 'both', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, roof: 'hip', roofLayers: 3, overhang: 3,
      ridgeH: 1, beasts: 7, rail: true });

    // 东华门 / 西华门：城台三券门 + 重檐庐殿顶门楼
    function build(g, nm) {
      C.gateTerrace(v, { name: nm + '·城台', x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1, h: g.h,
        gates: [{ axis: 'x', at: -200, w: 7, h: 9 }, { axis: 'x', at: -212, w: 5, h: 8 },
                { axis: 'x', at: -188, w: 5, h: 8 }] });
      C.hall(v, { name: nm + '·门楼', cx: Math.round((g.x0 + g.x1) / 2), cz: -200,
        w: g.tower.d, d: g.tower.w, ground: GY + g.h, podium: 1, wallH: 5, bays: 3,
        front: 'all', veranda: true, double: true, skirtLayers: 2, upperH: 5,
        roof: 'hip', roofLayers: 3, ridgeH: 1, overhang: 3, beasts: 7, rail: true });
    }
    build(P.DONGHUAMEN, '东华门');
    build(P.XIHUAMEN, '西华门');

    // 各门中门门扇
    C.gateDoor(v, { name: '神武门·中门门扇', axis: 'z', at: 0, plane: S.z0 + 14, w: 7, h: 9 });
    C.gateDoor(v, { name: '东华门·中门门扇', axis: 'x', at: -200,
                    plane: P.DONGHUAMEN.x0 + 14, w: 7, h: 9 });
    C.gateDoor(v, { name: '西华门·中门门扇', axis: 'x', at: -200,
                    plane: P.XIHUAMEN.x1 - 14, w: 7, h: 9 });
  }

  /* ================= 内金水河与内金水桥 ================= */
  function jinshuiRiver(v, field) {
    var J = P.JINSHUI, hw = J.width >> 1;
    function zc(x) {
      if (Math.abs(x) <= J.halfW) {
        var t = x / J.halfW;
        return Math.round(J.zBase - J.sag * (1 - t * t));
      }
      return J.zBase;
    }
    v.tag('内金水河');
    // 河道：先清铺装，再落水面与汉白玉河帮
    for (var x = -334; x <= 334; x++) {
      var z = zc(x);
      field.erase(x, z - hw - 1, x, z + hw);
      for (var d = -hw; d <= hw - 1; d++) {
        v.set(x, GY - 1, z + d, B.STONE);                 // 河底
      }
      // 两岸汉白玉栏板望柱
      for (var k = 0; k < 2; k++) {
        v.set(x, GY, z - hw - 1, B.MARBLE); v.set(x, GY, z + hw, B.MARBLE);
      }
      var post = (x % 4 === 0);
      for (var q = 1; q <= (post ? 3 : 2); q++) {
        v.set(x, GY + q, z - hw - 1, B.RAIL); v.set(x, GY + q, z + hw, B.RAIL);
      }
    }
    // 水面（低于地面 0.9 m）
    for (var x2 = -334; x2 <= 334; x2 += 2) {
      var z2 = zc(x2);
      field.fill(x2 - 1, z2 - hw, x2, z2 + hw - 1, B.WATER, 0.15);
    }
    // 西筒子 / 东筒子 河段
    [P.RIVER_W, P.RIVER_E].forEach(function (r) {
      var rh = r.w >> 1;
      field.erase(r.x - rh - 1, r.z0, r.x + rh, r.z1);
      field.fill(r.x - rh, r.z0, r.x + rh - 1, r.z1, B.WATER, 0.15);
      for (var z = r.z0; z <= r.z1; z++) {
        v.set(r.x - rh - 1, GY, z, B.MARBLE); v.set(r.x + rh, GY, z, B.MARBLE);
        var post = (z % 4 === 0);
        for (var q = 1; q <= (post ? 3 : 2); q++) {
          v.set(r.x - rh - 1, GY + q, z, B.RAIL); v.set(r.x + rh, GY + q, z, B.RAIL);
        }
        v.set(r.x, GY - 1, z, B.STONE);
      }
    });

    // 内金水桥：五座，随河道弧形排列（中为御路桥，次王公桥，外品级桥）
    v.tag('内金水桥');
    P.JINSHUI_BRIDGES.forEach(function (bg) {
      var z = zc(bg.x);
      C.bridge(v, { name: '内金水桥', cx: bg.x, z0: z - hw - 3, z1: z + hw + 2,
                    w: bg.w, y: GY, rise: 2 });
    });
    // 东筒子 / 西筒子 上的过河石桥
    C.bridge(v, { name: '断虹桥', cx: P.RIVER_W.x, z0: -60, z1: -48, w: 9, y: GY, rise: 2 });
    C.bridge(v, { name: '东华门石桥', cx: P.RIVER_E.x, z0: -208, z1: -196, w: 9, y: GY, rise: 2 });
  }

  /* ================= 护城河（筒子河） ================= */
  function moat(v, field) {
    var W = P.WALL, M = P.MOAT;
    var i0x = W.x0 - M.gap, i1x = W.x1 + M.gap;          // 河内岸
    var i0z = W.z0 - M.gap, i1z = W.z1 + M.gap;
    var o0x = i0x - M.w, o1x = i1x + M.w;
    var o0z = i0z - M.w, o1z = i1z + M.w;
    var wy = -1.2;                                        // 水面标高
    // 四面河身（南面在午门前广场处向南折出）
    field.fill(o0x, i1z, o1x, o1z, B.WATER, wy);          // 北
    field.fill(o0x, o0z, o0x + M.w, o1z, B.WATER, wy);    // 西
    field.fill(o1x - M.w, o0z, o1x, o1z, B.WATER, wy);    // 东
    field.fill(o0x, o0z, -93, i0z, B.WATER, wy);          // 南（西段）
    field.fill(93, o0z, o1x, i0z, B.WATER, wy);           // 南（东段）
    var jogZ0 = P.WUMEN.wingZ0 - 36, jogZ1 = jogZ0 + M.w;
    field.fill(-144, jogZ0, -93, i0z, B.WATER, wy);       // 折出西连接
    field.fill(93, jogZ0, 144, i0z, B.WATER, wy);         // 折出东连接
    field.fill(-144, jogZ0, 144, jogZ1, B.WATER, wy);     // 折出南段

    // 河帮（条石驳岸）
    v.tag('护城河驳岸');
    function bankRectX(x0, x1, z) { for (var x = x0; x <= x1; x++) { v.set(x, GY - 1, z, B.STONE); v.set(x, GY, z, B.STONE); } }
    function bankRectZ(z0, z1, x) { for (var z = z0; z <= z1; z++) { v.set(x, GY - 1, z, B.STONE); v.set(x, GY, z, B.STONE); } }
    bankRectX(o0x, o1x, i1z); bankRectX(o0x, o1x, o1z);
    bankRectZ(o0z, o1z, i0x); bankRectZ(o0z, o1z, o0x);
    bankRectZ(o0z, o1z, i1x); bankRectZ(o0z, o1z, o1x);
    bankRectX(o0x, -93, i0z); bankRectX(93, o1x, i0z);
    bankRectX(-144, 144, jogZ0); bankRectX(-144, 144, jogZ1);

    // 午门前引桥（跨折出段）
    C.bridge(v, { name: '午门前石桥', cx: 0, z0: jogZ0 - 3, z1: jogZ1 + 3, w: 15, y: GY, rise: 3 });
  }

  /* ================= 铺装：海墁青砖 + 御路 ================= */
  /** 分区一次铺到位，不做叠压，避免产生无意义的"材质冲突" */
  function paving(v, field) {
    var W = P.WALL, M = P.MOAT;
    var mx0 = W.x0 - M.gap - M.w - M.bank, mx1 = W.x1 + M.gap + M.w + M.bank;
    var mz0 = W.z0 - M.gap - M.w - M.bank - 60, mz1 = W.z1 + M.gap + M.w + M.bank;

    // ① 城外：河外岸以外的素土与草地（一次判定，不叠压）
    field.fill(mx0 - 40, mz0 - 40, mx1 + 40, mz1 + 40, B.SOIL, 0.6, function (x, z) {
      if (x > W.x0 - M.gap - M.w - 2 && x < W.x1 + M.gap + M.w + 2 &&
          z > W.z0 - M.gap - M.w - 2 && z < W.z1 + M.gap + M.w + 2) return null;  // 让给护城河带
      var h = (((x * 7 + z * 13) % 97) + 97) % 97;
      return h < 46 ? B.GRASS : B.SOIL;
    });
    // ② 城墙与护城河之间的夯土马路（河道随后自行覆盖水面）
    field.fill(W.x0 - M.gap - M.w - M.bank, W.z0 - M.gap - M.w - M.bank,
               W.x1 + M.gap + M.w + M.bank, W.z1 + M.gap + M.w + M.bank, B.SOIL, 0.6);
    // ③ 城内海墁青砖（大条砖，双色交替）
    field.fill(W.x0 + 6, W.z0 + 6, W.x1 - 6, W.z1 - 6, null, 1.0, function (x, z) {
      var hsh = (((x * 73856093) ^ (z * 19349663)) >>> 0) % 100;
      return hsh < 42 ? B.PAVE_2 : B.PAVE;
    });
    // ④ 中轴御路（自午门至神武门）与两广场横向甬路
    field.fill(-6, W.z0, 5, W.z1, B.PAVE_W, 1.05);
    field.fill(P.SQ_TAIHEMEN.x0, -372, P.SQ_TAIHEMEN.x1, -365, B.PAVE_W, 1.05);
    field.fill(-100, 116, 99, 123, B.PAVE_W, 1.05);
    // 三大殿广场按明制不植树：以防藏身、免火患，并以空旷衬托礼制尺度
  }

  /* ================= 街巷宫墙（东西一长街、二长街、筒子） ================= */
  function alleys(v) {
    v.tag('街巷宫墙');
    var A1 = P.ALLEY;
    function pairZ(x0, x1, z0, z1) {
      A.palaceWallZ(v, z0, z1, x0, GY, 6, 2, B.TILE_Y);
      A.palaceWallZ(v, z0, z1, x1 - 1, GY, 6, 2, B.TILE_Y);
    }
    pairZ(A1.dong1.x0, A1.dong1.x1, 140, 400);
    pairZ(A1.xi1.x0, A1.xi1.x1, 140, 400);
    pairZ(A1.dong2.x0, A1.dong2.x1, 140, 400);
    pairZ(A1.xi2.x0, A1.xi2.x1, 140, 400);
    // 东筒子 / 西筒子 夹道（内廷段：南起乾清门横街一带，北至御花园东西）
    // 不可南延至文华殿 / 武英殿院内，否则会穿过文渊阁、敬思殿
    A.palaceWallZ(v, 60, 420, 196, GY, 7, 2, B.TILE_Y);
    A.palaceWallZ(v, 60, 420, -197, GY, 7, 2, B.TILE_Y);
    // 后三宫院墙
    var H = P.HOUSANGONG;
    A.palaceWallZ(v, H.z0, H.z1, H.x0, GY, 7, 3, B.TILE_Y);
    A.palaceWallZ(v, H.z0, H.z1, H.x1 - 2, GY, 7, 3, B.TILE_Y);
    A.palaceWallX(v, H.x0, -14, H.z1 - 2, GY, 7, 3, B.TILE_Y);
    A.palaceWallX(v, 14, H.x1, H.z1 - 2, GY, 7, 3, B.TILE_Y);
    // 外朝广场东西宫墙（含中左门/中右门、后左门/后右门）
    A.palaceWallZ(v, -304, -174, 100, GY, 7, 3, B.TILE_Y);
    A.palaceWallZ(v, -304, -174, -102, GY, 7, 3, B.TILE_Y);
    A.palaceWallZ(v, -438, -306, 100, GY, 7, 3, B.TILE_Y);
    A.palaceWallZ(v, -438, -306, -102, GY, 7, 3, B.TILE_Y);
  }

  G.City = { cityWall: cityWall, cornerTower: cornerTower, wumen: wumen,
             northAndSideGates: northAndSideGates, jinshuiRiver: jinshuiRiver,
             moat: moat, paving: paving, alleys: alleys };
})(typeof window !== 'undefined' ? window : globalThis);
