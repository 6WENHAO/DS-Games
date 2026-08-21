/* =====================================================================
 * 紫禁城 体素模型 — 内廷篇 (Inner Court)
 * ---------------------------------------------------------------------
 * 乾清门（鎏金铜狮 + 八字影壁）、景运门 / 隆宗门、
 * 后三宫：乾清宫（重檐庐殿）、交泰殿（四角攒尖·铜镀金宝顶）、坤宁宫（重檐庐殿）、
 * 东西六宫及养心殿、奉先殿等十六座标准二进宫院、
 * 外东路宁寿宫区（皇极殿 / 宁寿宫 / 畅音阁 / 九龙壁 / 乾隆花园）、
 * 外西路慈宁宫区（慈宁宫 / 寿康宫 / 英华殿 / 花园）、
 * 御花园（钦安殿重檐盝顶——紫禁城唯一；万春亭 / 千秋亭 / 浮碧亭 / 澄瑞亭 / 堆秀山御景亭）、
 * 坤宁门、顺贞门。
 * ===================================================================== */
(function (G) {
  'use strict';
  var B = G.GGPalette.BLOCK, A = G.Arch, C = G.Comp, P = G.Plan;
  var GY = P.GY;

  /* ================= 乾清门横街 ================= */
  function qianqingmen(v) {
    /* 乾清门：面阔 5 间，单檐歇山，须弥座，门前一对鎏金铜狮，两侧八字琉璃影壁 */
    C.hall(v, { name: '乾清门', cx: 0, cz: P.AXIS.qianqingmen, w: 24, d: 13, ground: GY,
      podium: 3, xushi: true, rail: true, wallH: 8, bays: 5, front: 'both',
      roof: 'gablehip', roofLayers: 5, overhang: 3, beasts: 7,
      steps: [{ side: 's', w: 10, way: 4 }, { side: 'n', w: 10 }],
      yuetai: { w: 40, d: 14, rail: true, stepW: 12, way: 4 } });
    v.tag('乾清门·铜狮与影壁');
    A.lion(v, 16, P.AXIS.qianqingmen - 18, GY + 3);
    A.lion(v, -16, P.AXIS.qianqingmen - 18, GY + 3);
    // 八字影壁（琉璃照壁，向外斜出）
    for (var k = 0; k < 16; k++) {
      var xx = 22 + k, zz = P.AXIS.qianqingmen - 8 - k;
      for (var y = GY; y < GY + 6; y++) {
        var mm = (y === GY ? B.STONE : ((k + y) % 4 === 0 ? B.TILE_G : B.WALL_R));
        v.set(xx, y, zz, mm); v.set(-xx, y, zz, mm);
      }
      v.set(xx, GY + 6, zz, B.TILE_Y); v.set(-xx, GY + 6, zz, B.TILE_Y);
      v.set(xx, GY + 7, zz, B.RIDGE); v.set(-xx, GY + 7, zz, B.RIDGE);
    }

    /* 景运门（东）/ 隆宗门（西）：横街两端，单檐歇山 */
    C.hall(v, { name: '景运门', cx: 97, cz: P.AXIS.qianqingmen, w: 12, d: 20, ground: GY,
      podium: 2, wallH: 7, bays: 3, front: 'all', roof: 'gablehip', roofLayers: 4, overhang: 3 });
    C.hall(v, { name: '隆宗门', cx: -97, cz: P.AXIS.qianqingmen, w: 12, d: 20, ground: GY,
      podium: 2, wallH: 7, bays: 3, front: 'all', roof: 'gablehip', roofLayers: 4, overhang: 3 });
  }

  /* ================= 后三宫 ================= */
  function houSanGong(v) {
    /* 乾清宫：9 间约 45 × 5 间约 28，重檐庐殿顶，帝居正宫 */
    C.hall(v, { name: '乾清宫', cx: 0, cz: P.AXIS.qianqinggong, w: 50, d: 28, ground: GY,
      podium: 3, xushi: true, chishou: true, rail: true,
      wallH: 6, bays: 9, front: 'both', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, upperInset: 3,
      roof: 'hip', roofLayers: 3, ridgeH: 2, overhang: 4, beasts: 9,
      steps: [{ side: 's', w: 16, way: 6 }, { side: 'n', w: 14, way: 5 }],
      yuetai: { w: 62, d: 22, rail: true, stepW: 18, way: 6, chishou: true } });
    // 月台陈设：铜龟铜鹤、日晷嘉量、江山社稷金殿
    v.tag('乾清宫·月台陈设');
    var yz = P.AXIS.qianqinggong - 15 - 12, yy = GY + 4;   // 立于月台台面之上
    A.sundial(v, 20, yz + 5, yy); A.sundial(v, -20, yz + 5, yy);
    A.craneTurtle(v, 12, yz + 12, yy, false); A.craneTurtle(v, -12, yz + 12, yy, true);
    A.censer(v, 26, yz + 1, yy); A.censer(v, -26, yz + 1, yy);
    // 江山社稷金殿（月台东西两侧的小型鎏金亭），底座须坐在月台台面上
    [7, -7].forEach(function (bx) {
      v.solid(bx - 1, yy, yz + 3, bx + 1, yy + 2, yz + 5, B.GILT);
      A.finial(v, bx, yz + 4, yy + 3, 2, 1);
    });

    /* 交泰殿：3 间见方，单檐四角攒尖顶，铜镀金宝顶（藏二十五方宝玺） */
    C.hall(v, { name: '交泰殿', cx: 0, cz: P.AXIS.jiaotaidian, w: 14, d: 14, ground: GY,
      podium: 2, rail: true, wallH: 5, bays: 3, front: 'all', veranda: true,
      roof: 'pyramid', roofLayers: 4, overhang: 3, finialH: 2,
      steps: [{ side: 's', w: 8, way: 3 }, { side: 'n', w: 8 }] });

    /* 坤宁宫：9 间连廊约 45 × 3 间约 22，重檐庐殿顶。
       满族"口袋房"制：明间门不居中而偏东，东四间为萨满祭神之所，
       灶间烟道自屋面穿出——是紫禁城主要殿座中唯一带烟囱者。 */
    C.hall(v, { name: '坤宁宫', cx: 0, cz: P.AXIS.kunninggong, w: 45, d: 22, ground: GY,
      podium: 2, xushi: true, rail: true, wallH: 7, bays: 9, front: 'both', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, upperInset: 3,
      roof: 'hip', roofLayers: 3, ridgeH: 2, overhang: 4, beasts: 7,
      steps: [{ side: 's', w: 14, way: 5 }, { side: 'n', w: 12 }],
      yuetai: { w: 56, d: 14, rail: true, stepW: 14, way: 5 } });

    /* 口袋房：把南立面西半的隔扇改砌实墙，只在明间以东留门 */
    v.tag('坤宁宫·口袋房门位');
    (function () {
      var kz = P.AXIS.kunninggong, hd = Math.floor((22 - 1) / 2);
      var zFace = kz - hd + 1;                       // 周围廊内退一格的墙面
      for (var x = -22; x <= 22; x++) {
        if (x >= 2 && x <= 8) continue;              // 保留偏东的明间门
        for (var y = GY + 3; y <= GY + 8; y++) {
          var id = v.get(x, y, zFace);
          if (id === B.DOOR_R || id === B.LATTICE) { v.erase(x, y, zFace); v.set(x, y, zFace, B.WALL_R); }
        }
      }
    })();
    /* 烟囱：先挖后砌，砖体高出正脊约 4 m */
    C.chimney(v, 16, P.AXIS.kunninggong + 2, 17, P.AXIS.kunninggong + 3, GY, GY + 25);

    /* 坤宁门：后三宫北门 */
    C.hall(v, { name: '坤宁门', cx: 0, cz: P.AXIS.kunningmen, w: 15, d: 8, ground: GY,
      podium: 2, wallH: 6, bays: 3, front: 'both', roof: 'gablehip', roofLayers: 3,
      overhang: 2, steps: [{ side: 's', w: 7 }, { side: 'n', w: 7 }] });

    /* 后三宫东西庑房：端凝殿 / 懋勤殿 / 上书房 / 南书房 / 御茶膳房 */
    var H = P.HOUSANGONG;
    [[H.x0 + 6, 'e'], [H.x1 - 18, 'w']].forEach(function (c) {
      var x0 = c[0];
      C.corridor(v, { name: '后三宫庑房', x0: x0, x1: x0 + 12, z0: 168, z1: 224,
                      ground: GY, h: 6, axis: 'z', open: c[1] === 'e' ? 'e' : 'w' });
      C.corridor(v, { name: '后三宫庑房', x0: x0, x1: x0 + 12, z0: 248, z1: 300,
                      ground: GY, h: 6, axis: 'z', open: c[1] === 'e' ? 'e' : 'w' });
    });
  }

  /* ================= 东西六宫及内廷跨院 ================= */
  function sixPalaces(v) {
    function place(list) {
      list.forEach(function (c) {
        var col = P.INNER_COL[c.col], row = P.INNER_ROW[c.row];
        C.courtyard(v, { name: c.name, x0: col.x0, x1: col.x1, z0: row.z0, z1: row.z1,
                         tile: c.tile === 'G' ? B.TILE_G : B.TILE_Y,
                         skipMain: (c.name === '奉先殿' || c.name === '养心殿') });
      });
    }
    place(P.EAST_COURTS);
    place(P.WEST_COURTS);

    /* 奉先殿正殿加大为重檐庐殿（皇家祖庙，形制高于一般宫院） */
    var col = P.INNER_COL.eIn, row = P.INNER_ROW[0];
    C.hall(v, { name: '奉先殿', cx: Math.round((col.x0 + col.x1) / 2), cz: row.z0 + 34,
      w: 34, d: 18, ground: GY, podium: 3, xushi: true, rail: true,
      wallH: 5, bays: 7, front: 's', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, roof: 'hip', roofLayers: 3,
      overhang: 3, beasts: 7, steps: [{ side: 's', w: 12, way: 4 }] });

    /* 养心殿：单檐歇山，明间前出卷棚抱厦（清帝寝兴听政之所） */
    var wcol = P.INNER_COL.wIn, wrow = P.INNER_ROW[0];
    var wcx = Math.round((wcol.x0 + wcol.x1) / 2);
    C.hall(v, { name: '养心殿', cx: wcx, cz: wrow.z0 + 34, w: 28, d: 15, ground: GY,
      podium: 2, rail: true, wallH: 8, bays: 5, front: 's', roof: 'gablehip',
      roofLayers: 4, overhang: 3, beasts: 5, steps: [{ side: 's', w: 10, way: 3 }] });
    // 抱厦（卷棚顶小前廊）
    C.hall(v, { name: '养心殿·抱厦', cx: wcx, cz: wrow.z0 + 22, w: 11, d: 7, ground: GY,
      podium: 1, wallH: 6, bays: 3, front: 's', roof: 'gable', overhang: 2, slope: 0.6 });

    /* 储秀宫阶前铜龙、铜鹿各一对（慈禧五旬万寿时所置） */
    v.tag('储秀宫·铜龙铜鹿');
    (function () {
      var col = P.INNER_COL.wIn, row = P.INNER_ROW[3];
      var cx2 = Math.round((col.x0 + col.x1) / 2);
      var cz2 = Math.round(row.z0 + (row.z1 - row.z0) * 0.52) - 10;
      [[-9, 'dragon'], [9, 'deer']].forEach(function (p) {
        A.craneTurtle(v, cx2 + p[0], cz2, GY, p[1] === 'deer');
        A.craneTurtle(v, cx2 + p[0] * 2, cz2, GY, p[1] !== 'deer');
      });
    })();
  }

  /* ================= 外东路：宁寿宫区 ================= */
  function ningshou(v) {
    var N = P.NINGSHOU, cx = Math.round((N.x0 + N.x1) / 2);
    v.tag('宁寿宫区·院墙');
    A.palaceWallZ(v, N.z0, N.z1, N.x0, GY, 7, 3, B.TILE_Y);
    A.palaceWallZ(v, N.z0, N.z1, N.x1 - 2, GY, 7, 3, B.TILE_Y);
    A.palaceWallX(v, N.x0, cx - 10, N.z0, GY, 7, 3, B.TILE_Y);
    A.palaceWallX(v, cx + 10, N.x1, N.z0, GY, 7, 3, B.TILE_Y);
    A.palaceWallX(v, N.x0, N.x1, N.z1 - 2, GY, 7, 3, B.TILE_Y);

    /* 九龙壁：琉璃照壁，宫内三大琉璃影壁之一 */
    v.tag('九龙壁');
    for (var x = cx - 15; x <= cx + 15; x++) {
      for (var y = GY; y < GY + 5; y++) {
        var m = (y === GY) ? B.MARBLE_D
          : (((x * 3 + y * 5) % 7 === 0) ? B.TILE_G : (((x + y) % 3 === 0) ? B.BEAM_B : B.TILE_Y));
        v.set(x, y, N.z0 - 12, m); v.set(x, y, N.z0 - 11, m);
      }
      v.set(x, GY + 5, N.z0 - 13, B.TILE_Y); v.set(x, GY + 5, N.z0 - 12, B.TILE_Y);
      v.set(x, GY + 5, N.z0 - 11, B.TILE_Y); v.set(x, GY + 5, N.z0 - 10, B.TILE_Y);
      v.set(x, GY + 6, N.z0 - 12, B.RIDGE);
    }
    /* 皇极门（琉璃门）*/
    C.wallGate(v, { name: '皇极门', cx: cx, cz: N.z0, axis: 'x', w: 9, h: 9, thick: 3 });
    /* 皇极殿：重檐庐殿顶 */
    C.hall(v, { name: '皇极殿', cx: cx, cz: N.z0 + 40, w: 38, d: 20, ground: GY,
      podium: 3, xushi: true, rail: true, wallH: 6, bays: 9, front: 's', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, roof: 'hip', roofLayers: 4, overhang: 4,
      beasts: 7, steps: [{ side: 's', w: 12, way: 5 }],
      yuetai: { w: 50, d: 16, rail: true, stepW: 14, way: 5 } });
    /* 宁寿宫：单檐歇山 */
    C.hall(v, { name: '宁寿宫', cx: cx, cz: N.z0 + 88, w: 32, d: 16, ground: GY,
      podium: 2, rail: true, wallH: 8, bays: 7, front: 's', roof: 'gablehip',
      roofLayers: 5, overhang: 3, beasts: 5, steps: [{ side: 's', w: 10, way: 4 }] });
    /* 养性殿 */
    C.hall(v, { name: '养性殿', cx: cx - 4, cz: N.z0 + 128, w: 24, d: 14, ground: GY,
      podium: 2, wallH: 7, bays: 5, front: 's', roof: 'gablehip', roofLayers: 4, overhang: 3 });
    /* 畅音阁：三层大戏楼（宫内最大戏台） */
    C.hall(v, { name: '畅音阁', cx: N.x1 - 24, cz: N.z0 + 172, w: 22, d: 22, ground: GY,
      podium: 2, rail: true, wallH: 7, bays: 3, front: 'all',
      double: true, skirtLayers: 2, upperH: 7, roof: 'gablehip', roofLayers: 5,
      overhang: 3, beasts: 5 });
    /* 阅是楼（观戏之所） */
    C.hall(v, { name: '阅是楼', cx: N.x0 + 26, cz: N.z0 + 172, w: 24, d: 14, ground: GY,
      podium: 2, wallH: 7, bays: 5, front: 'e', double: true, skirtLayers: 2, upperH: 5,
      roof: 'gablehip', roofLayers: 4, overhang: 3 });
    /* 乾隆花园（宁寿宫花园）：叠石与轩榭 */
    v.tag('乾隆花园');
    A.rockery(v, N.x0 + 24, N.z1 - 40, GY, 8, 6, 9, 4711);
    C.hall(v, { name: '古华轩', cx: N.x0 + 52, cz: N.z1 - 56, w: 14, d: 10, ground: GY,
      podium: 1, wallH: 6, bays: 3, front: 's', roof: 'gable', overhang: 2, slope: 0.7 });
    C.hall(v, { name: '符望阁', cx: cx + 12, cz: N.z1 - 24, w: 18, d: 18, ground: GY,
      podium: 2, wallH: 7, bays: 3, front: 'all', double: true, skirtLayers: 2, upperH: 5,
      roof: 'pyramid', roofLayers: 5, overhang: 3 });
    for (var t = 0; t < 14; t++) {
      A.tree(v, N.x0 + 14 + (t * 13) % 96, N.z1 - 10 - (t * 21) % 60, GY, 7 + (t % 4), 900 + t,
             t % 2 ? 'cypress' : 'pine');
    }
  }

  /* ================= 外西路：慈宁宫区 ================= */
  function cining(v) {
    var N = P.CINING, cx = Math.round((N.x0 + N.x1) / 2);
    v.tag('慈宁宫区·院墙');
    A.palaceWallZ(v, N.z0, N.z1, N.x0, GY, 7, 3, B.TILE_Y);
    A.palaceWallZ(v, N.z0, N.z1, N.x1 - 2, GY, 7, 3, B.TILE_Y);
    A.palaceWallX(v, N.x0, cx - 10, N.z0, GY, 7, 3, B.TILE_Y);
    A.palaceWallX(v, cx + 10, N.x1, N.z0, GY, 7, 3, B.TILE_Y);
    A.palaceWallX(v, N.x0, N.x1, N.z1 - 2, GY, 7, 3, B.TILE_Y);
    C.wallGate(v, { name: '慈宁门', cx: cx, cz: N.z0, axis: 'x', w: 9, h: 9, thick: 3 });
    /* 慈宁宫：重檐歇山顶（太后居所） */
    C.hall(v, { name: '慈宁宫', cx: cx, cz: N.z0 + 46, w: 36, d: 20, ground: GY,
      podium: 3, xushi: true, rail: true, wallH: 6, bays: 7, front: 's', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, roof: 'gablehip', roofLayers: 4,
      overhang: 4, beasts: 7, steps: [{ side: 's', w: 12, way: 5 }],
      yuetai: { w: 48, d: 16, rail: true, stepW: 14, way: 5 } });
    /* 大佛堂 */
    C.hall(v, { name: '大佛堂', cx: cx, cz: N.z0 + 92, w: 28, d: 15, ground: GY,
      podium: 2, wallH: 8, bays: 5, front: 's', roof: 'gablehip', roofLayers: 4, overhang: 3 });
    /* 寿康宫 */
    C.courtyard(v, { name: '寿康宫', x0: N.x0 + 6, x1: N.x0 + 46, z0: N.z0 + 120, z1: N.z1 - 12 });
    /* 英华殿：重檐庐殿 */
    C.hall(v, { name: '英华殿', cx: N.x1 - 26, cz: N.z1 - 44, w: 24, d: 14, ground: GY,
      podium: 2, rail: true, wallH: 5, bays: 5, front: 's', double: true, skirtLayers: 2,
      upperH: 5, roof: 'hip', roofLayers: 3, overhang: 3, beasts: 5,
      steps: [{ side: 's', w: 8 }] });
    /* 慈宁宫花园 */
    v.tag('慈宁宫花园');
    A.rockery(v, cx + 20, N.z0 + 132, GY, 7, 5, 7, 8123);
    for (var t = 0; t < 12; t++) {
      A.tree(v, cx + 4 + (t * 11) % 60, N.z0 + 120 + (t * 17) % 50, GY, 7 + (t % 3), 1500 + t,
             t % 3 ? 'cypress' : 'pine');
    }
  }

  /* ================= 御花园 ================= */
  function yuhuayuan(v, field) {
    var Y = P.YUHUAYUAN, ax = P.AXIS;
    v.tag('御花园·园墙');
    A.palaceWallZ(v, Y.z0, Y.z1, Y.x0, GY, 6, 2, B.TILE_Y);
    A.palaceWallZ(v, Y.z0, Y.z1, Y.x1 - 1, GY, 6, 2, B.TILE_Y);
    A.palaceWallX(v, Y.x0, -10, Y.z0, GY, 6, 2, B.TILE_Y);
    A.palaceWallX(v, 10, Y.x1, Y.z0, GY, 6, 2, B.TILE_Y);
    A.palaceWallX(v, Y.x0, -10, Y.z1 - 1, GY, 6, 2, B.TILE_Y);
    A.palaceWallX(v, 10, Y.x1, Y.z1 - 1, GY, 6, 2, B.TILE_Y);

    /* 钦安殿：重檐盝顶——紫禁城内唯一盝顶建筑，供奉真武大帝 */
    C.hall(v, { name: '钦安殿', cx: 0, cz: ax.qinandian, w: 22, d: 13, ground: GY,
      podium: 2, xushi: true, rail: true, wallH: 4, bays: 5, front: 's', veranda: true,
      double: true, skirtLayers: 2, upperH: 5, roof: 'lu', roofLayers: 3, overhang: 3,
      steps: [{ side: 's', w: 9, way: 3 }],
      yuetai: { w: 30, d: 12, rail: true, stepW: 10, way: 3 } });
    /* 天一门（钦安殿前琉璃门） */
    C.wallGate(v, { name: '天一门', cx: 0, cz: ax.qinandian - 22, axis: 'x', w: 8, h: 8, thick: 2 });

    /* 万春亭（东）/ 千秋亭（西）：重檐攒尖，上圆下方 */
    [[42, '万春亭'], [-42, '千秋亭']].forEach(function (p) {
      C.hall(v, { name: p[1], cx: p[0], cz: ax.qinandian + 8, w: 15, d: 15, ground: GY,
        podium: 2, rail: true, wallH: 4, bays: 3, front: 'all', veranda: true,
        double: true, skirtLayers: 2, upperH: 5, roof: 'pyramid', roofLayers: 3,
        overhang: 3, finialH: 2,
        steps: [{ side: 's', w: 6 }] });
    });

    /* 浮碧亭（东）/ 澄瑞亭（西）：跨池而建，蓝绿剪边琉璃 */
    [[56, '浮碧亭'], [-56, '澄瑞亭']].forEach(function (p) {
      field.fill(p[0] - 9, ax.shunzhenmen - 8, p[0] + 9, ax.shunzhenmen + 4, B.WATER, 0.3);
      C.hall(v, { name: p[1], cx: p[0], cz: ax.shunzhenmen - 2, w: 11, d: 11, ground: GY + 1,
        podium: 1, rail: true, wallH: 6, bays: 3, front: 'all', veranda: true,
        roof: 'pyramid', roofLayers: 4, overhang: 2, tile: B.TILE_G, finialH: 2 });
    });

    /* 堆秀山 + 御景亭（园中最高处） */
    v.tag('堆秀山');
    A.rockery(v, 52, Y.z1 - 12, GY, 10, 8, 12, 20250);
    C.hall(v, { name: '御景亭', cx: 52, cz: Y.z1 - 12, w: 9, d: 9, ground: GY + 12,
      podium: 1, wallH: 5, bays: 3, front: 'all', roof: 'pyramid', roofLayers: 3,
      overhang: 2, finialH: 2 });
    /* 延晖阁（西北）/ 位育斋 */
    C.hall(v, { name: '延晖阁', cx: -52, cz: Y.z1 - 14, w: 20, d: 12, ground: GY,
      podium: 2, wallH: 7, bays: 5, front: 's', double: true, skirtLayers: 2, upperH: 5,
      roof: 'gablehip', roofLayers: 4, overhang: 3 });
    /* 绛雪轩（东南）/ 养性斋（西南） */
    C.hall(v, { name: '绛雪轩', cx: 56, cz: Y.z0 + 12, w: 16, d: 10, ground: GY,
      podium: 1, wallH: 6, bays: 5, front: 'w', roof: 'gable', overhang: 2, slope: 0.7 });
    C.hall(v, { name: '养性斋', cx: -56, cz: Y.z0 + 12, w: 16, d: 10, ground: GY,
      podium: 1, wallH: 6, bays: 5, front: 'e', roof: 'gable', overhang: 2, slope: 0.7 });

    /* 御花园古树：与三大殿广场"不植树"形成鲜明对照 */
    v.tag('御花园·古柏');
    var seeds = 0;
    for (var i = 0; i < 46; i++) {
      var rr = A.rnd(3300 + i);
      var x = Math.round(Y.x0 + 8 + rr() * (Y.x1 - Y.x0 - 16));
      var z = Math.round(Y.z0 + 6 + rr() * (Y.z1 - Y.z0 - 12));
      if (Math.abs(x) < 14 && Math.abs(z - ax.qinandian) < 26) continue;   // 让开钦安殿院
      if (Math.abs(Math.abs(x) - 42) < 10 && Math.abs(z - (ax.qinandian + 8)) < 12) continue;
      if (Math.abs(x - 52) < 12 && Math.abs(z - (Y.z1 - 12)) < 14) continue;
      A.tree(v, x, z, GY, 8 + Math.floor(rr() * 5), 3300 + i, i % 3 ? 'cypress' : 'pine');
      seeds++;
    }
    /* 顺贞门：御花园北门，开在园北墙的预留缺口上 */
    C.hall(v, { name: '顺贞门', cx: 0, cz: Y.z1 - 1, w: 17, d: 7, ground: GY,
      podium: 2, wallH: 6, bays: 3, front: 'both', roof: 'gablehip', roofLayers: 3,
      overhang: 2, steps: [{ side: 's', w: 7 }, { side: 'n', w: 7 }] });
    return seeds;
  }

  G.Inner = { qianqingmen: qianqingmen, houSanGong: houSanGong, sixPalaces: sixPalaces,
              ningshou: ningshou, cining: cining, yuhuayuan: yuhuayuan };
})(typeof window !== 'undefined' ? window : globalThis);
