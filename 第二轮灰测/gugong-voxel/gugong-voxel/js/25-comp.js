/* =====================================================================
 * 紫禁城 体素模型 — 组合构件（殿宇 / 门 / 庑房 / 标准宫院 / 城门楼 / 桥）
 * ---------------------------------------------------------------------
 * 依赖：GGPalette、VoxelWorld、Arch
 * 约定：地面铺装占 y=0，第一层可放置方块的标高 GY = 1。
 *       面阔 w 沿 X（东西），进深 d 沿 Z（南北）。
 * ===================================================================== */
(function (G) {
  'use strict';
  var B = G.GGPalette.BLOCK, A = G.Arch;
  var GY = 1;

  /** 一律取奇数跨度并以 (cx,cz) 为正中，使 x→-x 的镜像严格成立（中轴对称的保证） */
  function rect(cx, cz, w, d) {
    var hw = Math.floor((w - 1) / 2), hd = Math.floor((d - 1) / 2);
    cx = Math.round(cx); cz = Math.round(cz);
    return { x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd };
  }

  /* ===================== 通用殿宇 ===================== */
  /**
   * s = {
   *  name, cx, cz, w, d, ground,
   *  podium, xushi, rail, chishou,
   *  wallH,                    下层（或单层）墙身高，含额枋斗拱
   *  roof: 'hip'|'gablehip'|'pyramid'|'lu'|'gable'|'cross',
   *  double, skirtLayers, upperH, upperInset,
   *  roofLayers, overhang, bays, front, veranda,
   *  tile, beasts, ridgeH,
   *  steps: {side:'s'|'n'|'e'|'w', w, way}[]  踏跺
   *  yuetai: {w,d,rail,steps}                月台（丹陛）
   * }
   */
  function hall(v, s) {
    v.tag(s.name || '殿');
    var g = s.ground === undefined ? GY : s.ground;
    var r = rect(s.cx, s.cz, s.w, s.d);
    var podH = s.podium === undefined ? 2 : s.podium;
    var oh = s.overhang === undefined ? 3 : s.overhang;
    var tile = s.tile === undefined ? B.TILE_Y : s.tile;
    var i;

    /* --- 月台（在殿前南侧的宽台） --- */
    if (s.yuetai) {
      var yt = s.yuetai;
      var ytD = yt.d || 24, ytW = yt.w || (s.w + 20);
      var ytZ1 = r.z0 - 1, ytZ0 = ytZ1 - ytD + 1;
      var ytHW = Math.floor((ytW - 1) / 2);
      var ytx0 = Math.round(s.cx) - ytHW, ytx1 = Math.round(s.cx) + ytHW;
      A.podium(v, { x0: ytx0, x1: ytx1, z0: ytZ0, z1: ytZ1, y0: g, h: podH,
                    xushi: s.xushi, chishou: yt.chishou ? 6 : 0 });
      if (yt.rail !== false) {
        A.balustrade(v, { x0: ytx0, x1: ytx1, z0: ytZ0, z1: ytZ1, y: g + podH,
          gaps: [{ side: 'zmin', from: Math.round(s.cx) - ((yt.stepW || 20) >> 1),
                   to: Math.round(s.cx) + ((yt.stepW || 20) >> 1) }] });
      }
      A.stepsNS(v, { x0: Math.round(s.cx) - ((yt.stepW || 20) >> 1),
                     x1: Math.round(s.cx) + ((yt.stepW || 20) >> 1),
                     z: ytZ0 - 1, dir: -1, yTop: g + podH, yBot: g - 1,
                     depth: (podH + 1) * 2, way: yt.way || 0 });
      s._yuetai = { x0: ytx0, x1: ytx1, z0: ytZ0, z1: ytZ1, y: g + podH };
    }

    /* --- 台基 --- */
    var top = A.podium(v, { x0: r.x0 - 2, x1: r.x1 + 2, z0: r.z0 - 2, z1: r.z1 + 2,
                            y0: g, h: podH, xushi: s.xushi, chishou: s.chishou ? 6 : 0 });
    if (s.rail) {
      var gaps = [];
      (s.steps || []).forEach(function (st) {
        var hw = (st.w || 12) >> 1;
        if (st.side === 's') gaps.push({ side: 'zmin', from: Math.round(s.cx) - hw, to: Math.round(s.cx) + hw });
        if (st.side === 'n') gaps.push({ side: 'zmax', from: Math.round(s.cx) - hw, to: Math.round(s.cx) + hw });
        if (st.side === 'w') gaps.push({ side: 'xmin', from: Math.round(s.cz) - hw, to: Math.round(s.cz) + hw });
        if (st.side === 'e') gaps.push({ side: 'xmax', from: Math.round(s.cz) - hw, to: Math.round(s.cz) + hw });
      });
      A.balustrade(v, { x0: r.x0 - 2, x1: r.x1 + 2, z0: r.z0 - 2, z1: r.z1 + 2, y: top, gaps: gaps });
    }
    (s.steps || []).forEach(function (st) {
      var hw = (st.w || 12) >> 1;
      if (st.side === 's') A.stepsNS(v, { x0: Math.round(s.cx) - hw, x1: Math.round(s.cx) + hw,
        z: r.z0 - 3, dir: -1, yTop: top, yBot: g - 1, depth: (podH + 1) * 2, way: st.way || 0 });
      if (st.side === 'n') A.stepsNS(v, { x0: Math.round(s.cx) - hw, x1: Math.round(s.cx) + hw,
        z: r.z1 + 3, dir: +1, yTop: top, yBot: g - 1, depth: (podH + 1) * 2, way: st.way || 0 });
      if (st.side === 'w') A.stepsEW(v, { z0: Math.round(s.cz) - hw, z1: Math.round(s.cz) + hw,
        x: r.x0 - 3, dir: -1, yTop: top, yBot: g - 1, depth: (podH + 1) * 2 });
      if (st.side === 'e') A.stepsEW(v, { z0: Math.round(s.cz) - hw, z1: Math.round(s.cz) + hw,
        x: r.x1 + 3, dir: +1, yTop: top, yBot: g - 1, depth: (podH + 1) * 2 });
    });

    /* --- 殿身 --- */
    var wy = top + 1;
    var wallH = s.wallH === undefined ? 9 : s.wallH;
    A.facade(v, { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y: wy, h: wallH,
                  bays: s.bays || 5, front: s.front || 's', veranda: s.veranda,
                  wall: s.wall, col: s.col, door: s.door, dougong: s.dougong });
    var eaveY = wy + wallH;

    /* --- 重檐：下檐（腰檐）+ 上层殿身 --- */
    var upR = r, roofBaseY = eaveY;
    if (s.double) {
      // 先算出上层殿身范围，交给腰檐把屋面铺到墙脚，二者才真正相接
      var ui = s.upperInset === undefined ? Math.max(2, oh - 1) : s.upperInset;
      upR = { x0: r.x0 + ui, x1: r.x1 - ui, z0: r.z0 + ui, z1: r.z1 - ui };
      var sk = A.eaveSkirt(v, { x0: r.x0 - oh, x1: r.x1 + oh, z0: r.z0 - oh, z1: r.z1 + oh,
        y: eaveY, layers: s.skirtLayers || 3, run: (s.skirtLayers || 3) + oh, tile: tile,
        inner: upR });
      // 上层殿身至少要留出「墙身 2 + 额枋 2 + 斗拱 1」，否则上檐会直接压在腰檐上，
      // 失去重檐建筑上下两层各自成立的立面层次。
      var uh = Math.max(5, s.upperH === undefined ? 5 : s.upperH);
      A.facade(v, { x0: upR.x0, x1: upR.x1, z0: upR.z0, z1: upR.z1, y: sk.top + 1, h: uh,
        bays: Math.max(3, (s.bays || 5) - 2), front: s.front || 's',
        wall: s.wall, col: s.col, door: s.door });
      roofBaseY = sk.top + 1 + uh;
    }

    /* --- 上檐屋面 --- */
    var ro = { x0: upR.x0 - oh, x1: upR.x1 + oh, z0: upR.z0 - oh, z1: upR.z1 + oh,
               y: roofBaseY, tile: tile, beasts: s.beasts || 0, ridgeH: s.ridgeH,
               layers: s.roofLayers, slope: s.slope, gamma: s.gamma };
    var res;
    switch (s.roof) {
      case 'gablehip': res = A.roofGableHip(v, ro); break;
      case 'pyramid':  res = A.roofPyramid(v, ro); break;
      case 'lu':       res = A.roofLu(v, ro); break;
      case 'gable':    res = A.roofGable(v, ro); break;
      case 'cross':    res = A.roofCross(v, ro); break;
      default:         res = A.roofHip(v, ro); break;
    }
    return { top: res.top, podiumTop: top, eaveY: eaveY, rect: r, res: res };
  }

  /* ===================== 庑房 / 朝房 / 连廊 ===================== */
  /** 沿 X 或 Z 的长排房。o:{x0,x1,z0,z1,ground,h,tile,axis,bays,open} */
  function corridor(v, o) {
    v.tag(o.name || '庑房');
    var g = o.ground === undefined ? GY : o.ground;
    var h = o.h || 5;
    var axis = o.axis || ((o.x1 - o.x0) >= (o.z1 - o.z0) ? 'x' : 'z');
    var tile = o.tile === undefined ? B.TILE_Y : o.tile;
    // 台明
    A.podium(v, { x0: o.x0 - 1, x1: o.x1 + 1, z0: o.z0 - 1, z1: o.z1 + 1, y0: g, h: 1,
                  body: B.STONE, cap: B.STONE, dark: B.STONE });
    var wy = g + 2;
    var bays = o.bays || Math.max(2, Math.round((axis === 'x' ? (o.x1 - o.x0) : (o.z1 - o.z0)) / 4));
    A.facade(v, { x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1, y: wy, h: h,
                  bays: bays, front: o.open || (axis === 'x' ? 's' : 'w'), dougong: false });
    var rr = A.roofGable(v, { x0: o.x0 - 2, x1: o.x1 + 2, z0: o.z0 - 2, z1: o.z1 + 2,
      y: wy + h, axis: axis, tile: tile, slope: o.slope || 0.8 });
    return { top: rr.top };
  }

  /* ===================== 随墙门 / 琉璃门 ===================== */
  function wallGate(v, o) {
    v.tag(o.name || '随墙门');
    var g = o.ground === undefined ? GY : o.ground;
    var w = o.w || 6, h = o.h || 8, t = o.thick || 2;
    var cx = o.cx, cz = o.cz;
    var pal = A.palOf({ tile: o.tile === undefined ? B.TILE_Y : o.tile });
    var hw = (w - 1) >> 1, x, y, d;
    if (o.axis === 'x') {                         // 门开在沿 X 的墙上
      for (x = cx - hw - 3; x <= cx + hw + 3; x++)
        for (d = 0; d < t; d++)
          for (y = g; y < g + h; y++) {
            var inDoor = Math.abs(x - cx) <= hw && (y - g) < h - 2;
            v.set(x, y, cz + d, inDoor ? (y - g < 1 ? B.STONE : B.DOOR_R) : B.WALL_R);
            if (inDoor && y - g >= 1) v.erase(x, y, cz + d);
          }
      for (x = cx - hw - 3; x <= cx + hw + 3; x++) {
        for (d = 0; d < t + 2; d++) v.set(x, g + h, cz + d - 1, pal.tile);
        v.set(x, g + h + 1, cz + ((t - 1) >> 1), pal.ridge);
      }
      for (x = cx - hw; x <= cx + hw; x++) for (d = 0; d < t; d++) v.set(x, g + h - 1, cz + d, B.WALL_R);
      // 门框 + 门钉
      for (y = g + 1; y < g + h - 2; y++) {
        v.set(cx - hw, y, cz, B.DOOR_R); v.set(cx + hw, y, cz, B.DOOR_R);
      }
    } else {
      for (var z = cz - hw - 3; z <= cz + hw + 3; z++)
        for (d = 0; d < t; d++)
          for (y = g; y < g + h; y++) {
            var inD = Math.abs(z - cz) <= hw && (y - g) < h - 2;
            v.set(cx + d, y, z, inD ? (y - g < 1 ? B.STONE : B.DOOR_R) : B.WALL_R);
            if (inD && y - g >= 1) v.erase(cx + d, y, z);
          }
      for (var z2 = cz - hw - 3; z2 <= cz + hw + 3; z2++) {
        for (d = 0; d < t + 2; d++) v.set(cx + d - 1, g + h, z2, pal.tile);
        v.set(cx + ((t - 1) >> 1), g + h + 1, z2, pal.ridge);
      }
      for (var z3 = cz - hw; z3 <= cz + hw; z3++) for (d = 0; d < t; d++) v.set(cx + d, g + h - 1, z3, B.WALL_R);
    }
  }

  /* ===================== 城台（带券门）+ 城楼 ===================== */
  /**
   * o:{x0,x1,z0,z1, ground, h, gates:[{axis:'z', at:cx, w, h}], mado:bool}
   * 券门用挖除实现，再补砌洞壁，保证不会出现悬空砖。
   */
  function gateTerrace(v, o) {
    v.tag(o.name || '城台');
    var g = o.ground === undefined ? GY : o.ground, h = o.h || 12;
    var x, y, z, i;
    // 墩台主体（外壳 + 收分）
    for (i = 0; i < h; i++) {
      var ins = Math.floor(i / Math.max(4, Math.ceil(h / 2)));
      var ax0 = o.x0 + ins, ax1 = o.x1 - ins, az0 = o.z0 + ins, az1 = o.z1 - ins;
      var band = 3;
      for (x = ax0; x <= ax1; x++) {
        var xe = (x - ax0 < band) || (ax1 - x < band);
        for (z = az0; z <= az1; z++)
          if (xe || (z - az0 < band) || (az1 - z < band))
            v.set(x, g + i, z, ((x + z + i) % 7 === 0) ? B.WALL_CITY_D : B.WALL_CITY);
      }
    }
    // 台顶海墁
    var topY = g + h;
    for (x = o.x0 + 1; x <= o.x1 - 1; x++) for (z = o.z0 + 1; z <= o.z1 - 1; z++) v.set(x, topY, z, B.PAVE);
    // 券门
    (o.gates || []).forEach(function (gt) {
      var gw = gt.w || 6, gh = gt.h || 9, hw = (gw - 1) >> 1;
      if (gt.axis === 'z') {                     // 南北穿行
        for (x = gt.at - hw; x <= gt.at + hw; x++) {
          var arch = Math.round(Math.sqrt(Math.max(0, hw * hw - (x - gt.at) * (x - gt.at))));
          for (y = g; y <= g + gh - hw + arch; y++)
            for (z = o.z0 - 1; z <= o.z1 + 1; z++) v.erase(x, y, z);
        }
        // 洞壁与拱腹
        for (z = o.z0; z <= o.z1; z++) {
          for (y = g; y <= g + gh; y++) { v.set(gt.at - hw - 1, y, z, B.BRICK); v.set(gt.at + hw + 1, y, z, B.BRICK); }
          for (x = gt.at - hw - 1; x <= gt.at + hw + 1; x++) {
            var a2 = Math.round(Math.sqrt(Math.max(0, (hw + 1) * (hw + 1) - (x - gt.at) * (x - gt.at))));
            v.set(x, g + gh - hw + a2, z, B.BRICK);
          }
          for (x = gt.at - hw; x <= gt.at + hw; x++) v.set(x, g - 1, z, B.STONE);
        }
        // 门额与门钉（东华门门钉八路七十二颗为紫禁城唯一）
        for (x = gt.at - hw; x <= gt.at + hw; x++) v.set(x, g + gh - hw, o.z0, B.GILT);
      } else {                                   // 东西穿行
        for (z = gt.at - hw; z <= gt.at + hw; z++) {
          var arch2 = Math.round(Math.sqrt(Math.max(0, hw * hw - (z - gt.at) * (z - gt.at))));
          for (y = g; y <= g + gh - hw + arch2; y++)
            for (x = o.x0 - 1; x <= o.x1 + 1; x++) v.erase(x, y, z);
        }
        for (x = o.x0; x <= o.x1; x++) {
          for (y = g; y <= g + gh; y++) { v.set(x, y, gt.at - hw - 1, B.BRICK); v.set(x, y, gt.at + hw + 1, B.BRICK); }
          for (z = gt.at - hw - 1; z <= gt.at + hw + 1; z++) {
            var a3 = Math.round(Math.sqrt(Math.max(0, (hw + 1) * (hw + 1) - (z - gt.at) * (z - gt.at))));
            v.set(x, g + gh - hw + a3, z, B.BRICK);
          }
          for (z = gt.at - hw; z <= gt.at + hw; z++) v.set(x, g - 1, z, B.STONE);
        }
      }
    });
    return topY;
  }

  /* ===================== 桥（内金水桥 / 断虹桥） ===================== */
  /** o:{cx, z0, z1, w, y, rise, rail} 沿 Z 跨越河道 */
  function bridge(v, o) {
    v.tag(o.name || '石桥');
    var hw = (o.w - 1) >> 1, y = o.y === undefined ? GY : o.y;
    var span = o.z1 - o.z0;
    for (var z = o.z0; z <= o.z1; z++) {
      var t = (z - o.z0) / Math.max(1, span);
      var lift = Math.round((o.rise || 2) * Math.sin(Math.PI * t));
      for (var x = o.cx - hw; x <= o.cx + hw; x++) {
        v.set(x, y + lift, z, (x === o.cx - hw || x === o.cx + hw) ? B.MARBLE_D : B.MARBLE);
        for (var k = 1; k <= lift; k++) v.set(x, y + lift - k, z, B.MARBLE_D);
      }
      if (o.rail !== false) {
        for (var h = 1; h <= 2; h++) {
          v.set(o.cx - hw - 1, y + lift + h, z, B.RAIL);
          v.set(o.cx + hw + 1, y + lift + h, z, B.RAIL);
        }
        if (((z - o.z0) % 3) === 0) {
          v.set(o.cx - hw - 1, y + lift + 3, z, B.MARBLE_D);
          v.set(o.cx + hw + 1, y + lift + 3, z, B.MARBLE_D);
        }
      }
    }
  }

  /* ===================== 城门门扇（内退于券洞之中） ===================== */
  /**
   * 券门内的实榻大门门扇，带铺首衔环。
   * 注：真实门钉为"纵横各九路八十一颗"（东华门独为八路七十二颗），
   *     单颗直径约 10 cm，低于 1 m 体素的分辨率，此处只表现门扇与铺首。
   * o:{ axis:'z'|'x', at 门洞中心, plane 门扇所在平面坐标, w, h, ground }
   */
  function gateDoor(v, o) {
    v.tag(o.name || '城门门扇');
    var g = o.ground === undefined ? GY : o.ground;
    var hw = (o.w - 1) >> 1, i, y, top, arch;
    if (o.axis === 'z') {
      for (i = o.at - hw; i <= o.at + hw; i++) {
        arch = Math.round(Math.sqrt(Math.max(0, hw * hw - (i - o.at) * (i - o.at))));
        top = g + o.h - hw + arch;
        for (y = g; y <= top; y++) { v.erase(i, y, o.plane); v.set(i, y, o.plane, B.DOOR_R); }
      }
      // 铺首衔环（左右门扇各一）
      var my = g + Math.max(2, Math.round(o.h * 0.45));
      v.erase(o.at - 1, my, o.plane); v.set(o.at - 1, my, o.plane, B.GILT);
      v.erase(o.at + 1, my, o.plane); v.set(o.at + 1, my, o.plane, B.GILT);
      // 门缝
      for (y = g; y <= g + o.h - hw; y++) { v.erase(o.at, y, o.plane); v.set(o.at, y, o.plane, B.WOOD_D); }
    } else {
      for (i = o.at - hw; i <= o.at + hw; i++) {
        arch = Math.round(Math.sqrt(Math.max(0, hw * hw - (i - o.at) * (i - o.at))));
        top = g + o.h - hw + arch;
        for (y = g; y <= top; y++) { v.erase(o.plane, y, i); v.set(o.plane, y, i, B.DOOR_R); }
      }
      var my2 = g + Math.max(2, Math.round(o.h * 0.45));
      v.erase(o.plane, my2, o.at - 1); v.set(o.plane, my2, o.at - 1, B.GILT);
      v.erase(o.plane, my2, o.at + 1); v.set(o.plane, my2, o.at + 1, B.GILT);
      for (y = g; y <= g + o.h - hw; y++) { v.erase(o.plane, y, o.at); v.set(o.plane, y, o.at, B.WOOD_D); }
    }
  }

  /* ===================== 烟囱（坤宁宫独有：满族口袋房灶间烟道穿出屋面） ===================== */
  /** 先挖后砌，保证砖体压过屋面而非被瓦覆盖 */
  function chimney(v, x0, z0, x1, z1, y0, y1) {
    v.tag('坤宁宫·烟囱');
    var x, z, y;
    for (y = y0; y <= y1; y++)
      for (x = x0; x <= x1; x++)
        for (z = z0; z <= z1; z++) { v.erase(x, y, z); v.set(x, y, z, B.BRICK); }
    // 烟囱帽
    for (x = x0 - 1; x <= x1 + 1; x++)
      for (z = z0 - 1; z <= z1 + 1; z++) { v.erase(x, y1 + 1, z); v.set(x, y1 + 1, z, B.BRICK_D); }
    for (x = x0; x <= x1; x++)
      for (z = z0; z <= z1; z++) { v.erase(x, y1 + 2, z); v.set(x, y1 + 2, z, B.BRICK); }
  }

  /* ===================== 标准宫院（二进四合院） ===================== */
  /**
   * 东西六宫等采用高度标准化的二进院落形制：
   *   宫门(3间歇山) — 前院(正殿5间 + 东西配殿3间) — 后殿(5间) + 东西配殿
   * o:{name, x0,x1,z0,z1, tile, ground}
   */
  function courtyard(v, o) {
    var g = o.ground === undefined ? GY : o.ground;
    var tile = o.tile === undefined ? B.TILE_Y : o.tile;
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1;
    var cx = Math.round((x0 + x1) / 2);
    var W = x1 - x0 + 1, D = z1 - z0 + 1;
    v.tag(o.name || '宫院');

    // 院墙（四面），南面留宫门
    A.palaceWallZ(v, z0, z1, x0, g, 6, 2, tile);
    A.palaceWallZ(v, z0, z1, x1 - 1, g, 6, 2, tile);
    A.palaceWallX(v, x0, cx - 6, z1 - 1, g, 6, 2, tile);
    A.palaceWallX(v, cx + 6, x1, z1 - 1, g, 6, 2, tile);
    A.palaceWallX(v, x0, cx - 8, z0, g, 6, 2, tile);
    A.palaceWallX(v, cx + 8, x1, z0, g, 6, 2, tile);

    // 宫门（面阔3间，单檐歇山）
    hall(v, { name: o.name + '·宫门', cx: cx, cz: z0 + 4, w: 13, d: 8, ground: g,
      podium: 1, wallH: 6, bays: 3, front: 'both', roof: 'gablehip', tile: tile,
      overhang: 2, roofLayers: 3, steps: [{ side: 's', w: 8, way: 3 }] });

    var midZ = Math.round(z0 + D * 0.52);
    // 正殿（面阔5间）；skipMain 时由调用方另置高等级正殿（如奉先殿、养心殿）
    if (!o.skipMain) {
      hall(v, { name: o.name + '·正殿', cx: cx, cz: midZ, w: Math.min(26, W - 16), d: 13,
        ground: g, podium: 2, wallH: 8, bays: 5, front: 's', roof: 'gablehip', tile: tile,
        overhang: 3, roofLayers: 4, beasts: 5, rail: false,
        steps: [{ side: 's', w: 10, way: 3 }] });
    }
    // 前院东西配殿（面阔3间）
    var py = Math.round(z0 + D * 0.28);
    hall(v, { name: o.name + '·东配殿', cx: x0 + 9, cz: py, w: 9, d: 16, ground: g,
      podium: 1, wallH: 6, bays: 3, front: 'n', roof: 'gable', tile: tile, overhang: 2,
      slope: 0.8 });
    hall(v, { name: o.name + '·西配殿', cx: x1 - 9, cz: py, w: 9, d: 16, ground: g,
      podium: 1, wallH: 6, bays: 3, front: 'n', roof: 'gable', tile: tile, overhang: 2,
      slope: 0.8 });
    // 后殿
    var backZ = Math.round(z0 + D * 0.85);
    hall(v, { name: o.name + '·后殿', cx: cx, cz: backZ, w: Math.min(24, W - 18), d: 11,
      ground: g, podium: 1, wallH: 7, bays: 5, front: 's', roof: 'gable', tile: tile,
      overhang: 2, slope: 0.8, steps: [{ side: 's', w: 8 }] });
    // 后院东西耳房
    var by = Math.round(z0 + D * 0.7);
    hall(v, { name: o.name + '·东耳房', cx: x0 + 8, cz: by, w: 8, d: 11, ground: g,
      podium: 1, wallH: 5, bays: 3, front: 'n', roof: 'gable', tile: tile, overhang: 1, slope: 0.8 });
    hall(v, { name: o.name + '·西耳房', cx: x1 - 8, cz: by, w: 8, d: 11, ground: g,
      podium: 1, wallH: 5, bays: 3, front: 'n', roof: 'gable', tile: tile, overhang: 1, slope: 0.8 });
  }

  G.Comp = { GY: GY, rect: rect, hall: hall, corridor: corridor, wallGate: wallGate,
             gateTerrace: gateTerrace, bridge: bridge, courtyard: courtyard,
             gateDoor: gateDoor, chimney: chimney };
})(typeof window !== 'undefined' ? window : globalThis);
