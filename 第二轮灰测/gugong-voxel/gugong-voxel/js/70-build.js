/* =====================================================================
 * 紫禁城 体素模型 — 总装 (Build)
 * ---------------------------------------------------------------------
 * 纯数据装配：不依赖 THREE，浏览器与 Node 皆可运行。
 * 返回 { world, field, voxels, tiles, report }
 * ===================================================================== */
(function (G) {
  'use strict';

  function buildForbiddenCity(opts) {
    opts = opts || {};
    var P = G.Plan, B = G.GGPalette.BLOCK;
    var log = opts.log || function () {};
    var t0 = Date.now();

    var v = new G.VoxelWorld({ xmin: -700, xmax: 700, zmin: -800, zmax: 800 });
    var field = new G.TileField(4);

    /* ---- 1. 地面铺装与护城河 ---- */
    log('铺装海墁青砖与御路…');
    G.City.paving(v, field);
    log('开挖护城河（筒子河）…');
    G.City.moat(v, field);

    /* ---- 2. 城墙（避开四门城台与角楼墩台） ---- */
    log('砌筑城墙、雁翅垛口与马道…');
    var skips = [
      { x0: P.WUMEN.main.x0 - 1, x1: P.WUMEN.main.x1 + 1, z0: P.WUMEN.main.z0 - 1, z1: P.WUMEN.main.z1 + 1 },
      { x0: P.SHENWUMEN.x0 - 1, x1: P.SHENWUMEN.x1 + 1, z0: P.SHENWUMEN.z0 - 1, z1: P.SHENWUMEN.z1 + 1 },
      { x0: P.DONGHUAMEN.x0 - 1, x1: P.DONGHUAMEN.x1 + 1, z0: P.DONGHUAMEN.z0 - 1, z1: P.DONGHUAMEN.z1 + 1 },
      { x0: P.XIHUAMEN.x0 - 1, x1: P.XIHUAMEN.x1 + 1, z0: P.XIHUAMEN.z0 - 1, z1: P.XIHUAMEN.z1 + 1 }
    ];
    G.City.cityWall(v, skips, P.CORNERS.map(function (c) {
      return { x0: c.cx - 12, x1: c.cx + 12, z0: c.cz - 12, z1: c.cz + 12 };
    }));

    /* ---- 3. 四座角楼 ---- */
    log('起造四座角楼（三重檐十字脊，七十二脊）…');
    var cn = ['西南角楼', '东南角楼', '西北角楼', '东北角楼'];
    P.CORNERS.forEach(function (c, i) { G.City.cornerTower(v, c.cx, c.cz, cn[i]); });

    /* ---- 4. 四门 ---- */
    log('营建午门（凹字形五凤楼）…');
    G.City.wumen(v);
    log('营建神武门、东华门、西华门…');
    G.City.northAndSideGates(v);

    /* ---- 5. 内金水河与五桥 ---- */
    log('导内金水河、架内金水桥五座…');
    G.City.jinshuiRiver(v, field);

    /* ---- 6. 街巷宫墙 ---- */
    log('围合宫墙与东西长街…');
    G.City.alleys(v);

    /* ---- 7. 外朝 ---- */
    log('垒砌三台（工字形三层台基 232×130×8.13）…');
    var santaiTop = G.Outer.santai(v);
    log('营建三大殿：太和殿 / 中和殿 / 保和殿…');
    G.Outer.threeHalls(v, santaiTop);
    log('营建太和门、昭德门、贞度门、协和门、熙和门与朝房…');
    G.Outer.taihemenArea(v);
    log('营建体仁阁、弘义阁与广场东西庑房…');
    G.Outer.outerSquare(v);
    log('营建文华殿、文渊阁、武英殿与南三所…');
    G.Outer.eastWestCourts(v);

    /* ---- 8. 内廷 ---- */
    log('营建乾清门、景运门、隆宗门…');
    G.Inner.qianqingmen(v);
    log('营建后三宫：乾清宫 / 交泰殿 / 坤宁宫…');
    G.Inner.houSanGong(v);
    log('营建东西六宫等十六座宫院…');
    G.Inner.sixPalaces(v);
    log('营建宁寿宫区（皇极殿 / 畅音阁 / 九龙壁）…');
    G.Inner.ningshou(v);
    log('营建慈宁宫区（慈宁宫 / 寿康宫 / 英华殿）…');
    G.Inner.cining(v);
    log('营建御花园（钦安殿重檐盝顶 / 万春亭 / 千秋亭 / 堆秀山）…');
    G.Inner.yuhuayuan(v, field);

    var tBuild = Date.now() - t0;

    /* ---- 9. 编译：清理孤立块 + 遮挡剔除 + AO ---- */
    log('清理孤立方块、遮挡剔除与环境光遮蔽烘焙…');
    var t1 = Date.now();
    var cleaned = v.removeIsolated();
    var voxels = v.compile(true);
    var tiles = field.compile();
    var tCompile = Date.now() - t1;

    var report = voxels.report;
    report.铺装 = field.audit();
    report.用时 = { 生成毫秒: tBuild, 编译毫秒: tCompile };
    report.建筑清单 = v.tagCount;
    report.建筑定位 = v.tagInfo;
    report.建筑冲突 = v.tagConflict;
    report.清理孤立块 = cleaned;

    return { world: v, field: field, voxels: voxels, tiles: tiles, report: report };
  }

  G.BuildCity = buildForbiddenCity;
})(typeof window !== 'undefined' ? window : globalThis);
