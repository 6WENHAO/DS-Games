/* =====================================================================
   微体素地图 · 总体布局
   把 mod 世界（±6500 方块）压缩为 1280×1280 的悬浮微缩沙盘：
   - 站点方位保留原作罗盘关系，但吸附到「中轴对称院落」构图上
   - 站点内部按体素尺度重新配比（1 体素 ≈ 2 方块的观感，层高 4 体素）
   - 主轴 = X=640 的南北中轴；十字主轴 + 四对角 + 外环 = 全图动线
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX;

  var CXp = 640, CZp = 640, G = VX.GROUND;

  var LAY = VX.LAY = {
    cx: CXp, cz: CZp, ground: G,
    islandR: 592,                        // 沙盘岛体半径
    plinthTop: 4,                        // 底座顶（岛体最薄处）

    /* ---- 主体：第13号种植园（三进院落，体量最大） ---- */
    p13: {
      cx: 640, cz: 596, r: 268,
      domeR: 250, domeApex: 132,
      coreR: 100,                        // 城区围墙半径
      wallY: 26,
      /* 局部坐标（相对 p13 中心），北为 -Z */
      tower: [0, 0],                     // APE 长老会塔
      landmarks: [[-36, -36], [36, -36], [-36, 36], [36, 36]],
      fountain: [0, 54],
      northGate: [0, -100], southGate: [0, 100],
      westGate: [-100, 0], eastGate: [100, 0],
      forestGate: [0, -128],             // 森林门户牌坊
      lake: [-46, -196, 34],
      lake2: [30, -150, 12],
      giantTree: [26, -166],
      forest: [-244, -262, 248, -132],   // 北带密林 lx0,lz0,lx1,lz1
      westCompound: [-246, -74, -112, 78],
      eastCompound: [112, -74, 246, 78],
      lab: [-206, -30], selection: [-142, -34], admin: [-206, 40], staff: [-146, 44],
      school: [186, -34], teaching: [140, 34], commerce: [212, 40],
      manor: [172, -104], birdcage: [176, -140],
      conference: [-56, 118], archive: [56, 118],
      command: [-134, 168], training: [134, 168],
      hangar: [0, 208], sortieGate: [0, 252],
      industry: [172, 190], farm: [-172, 190],
      drills: [[232, 18], [232, 74], [232, 140], [232, 205], [232, 252], [232, 320]]
    },

    /* ---- 西厢：废弃城市（第7种植园废墟，建筑密集） ---- */
    ruins: { cx: 196, cz: 596, hw: 116, hh: 124,
      park: [186, 636], church: [166, 682], mall: [232, 660],
      highway: [[112, 540], [286, 566]], apartments: [162, 540] },

    /* ---- 东厢：Cosmos 宇宙都市 ---- */
    cosmos: { cx: 1084, cz: 596, r: 116, rings: [34, 60, 86, 110],
      council: [1084, 596], spire: [1084, 574], port: [1128, 660], reactor: [1040, 660] },

    /* ---- 西南角楼：干涸海床 ---- */
    seabed: { cx: 304, cz: 1002, hw: 104, hh: 82,
      ship: [302, 984], lagoon: [252, 1042], lighthouse: [230, 1010], house: [370, 962] },

    /* ---- 东南角楼：大裂缝（视觉核心） ---- */
    crevasse: { cx: 976, cz: 1002, rx: 116, rz: 84,
      mesaY: 68, floorY: 5,
      rim: [976, 916], star: [976, 1010], throne: [1044, 1010] },

    /* ---- 北角楼 ---- */
    p7ruin: { cx: 296, cz: 224 },
    p26: { cx: 984, cz: 224, r: 58 },

    /* ---- 中侧小站（对称） ---- */
    bonesGiant: [152, 470],
    pumpStation: [1128, 470],
    watchWest: [152, 762],
    watchEastOut: [1128, 762],
    watchNW: [498, 176],
    watchNE: [782, 176],

    /* ---- 轴线端点 ---- */
    memory: { cx: 640, cz: 122, y: 176, hw: 52, hh: 42 },
    sortieField: { cx: 640, cz: 976, hw: 62, hh: 46 },

    /* ---- 道路 ---- */
    axisW: 15, crossW: 13, ringR: 470, ringW: 10, spokeW: 9,
    railY: 76
  };

  /** 局部 → 世界（P13） */
  LAY.p13.at = function (lx, lz) { return [LAY.p13.cx + lx, LAY.p13.cz + lz]; };

  /** 全图关键视角（供 UI 预设） */
  LAY.views = [
    { id: 'all', name: '全景鸟瞰', target: [640, 22, 612], dist: 1400, yaw: -1.5708, pitch: -0.76 },
    { id: 'axis', name: '中轴透视', target: [640, 28, 660], dist: 1180, yaw: -1.5708, pitch: -0.34 },
    { id: 'p13', name: '13号种植园', target: [640, 34, 600], dist: 620, yaw: -1.5708, pitch: -0.48 },
    { id: 'p13core', name: '种植园·城区核心', target: [640, 44, 600], dist: 300, yaw: -1.24, pitch: -0.36 },
    { id: 'p13hangar', name: '种植园·机库出击区', target: [640, 32, 812], dist: 250, yaw: -1.92, pitch: -0.28 },
    { id: 'p13forest', name: '种植园·森林后院', target: [624, 30, 424], dist: 300, yaw: -1.16, pitch: -0.32 },
    { id: 'ruins', name: '废弃城市', target: [196, 30, 600], dist: 380, yaw: -1.02, pitch: -0.34 },
    { id: 'ruinsst', name: '废弃城市·街道', target: [200, 28, 616], dist: 130, yaw: -1.60, pitch: -0.13 },
    { id: 'crevasse', name: '大裂缝', target: [976, 46, 1000], dist: 400, yaw: -1.88, pitch: -0.38 },
    { id: 'crevin', name: '大裂缝·谷底星实体', target: [976, 24, 1004], dist: 128, yaw: -1.48, pitch: -0.46 },
    { id: 'cosmos', name: 'Cosmos 宇宙都市', target: [1084, 50, 600], dist: 380, yaw: -2.16, pitch: -0.34 },
    { id: 'seabed', name: '干涸海床', target: [300, 24, 996], dist: 330, yaw: -1.22, pitch: -0.24 },
    { id: 'bones', name: '叫龙残骸·巨兽', target: [152, 30, 470], dist: 180, yaw: -0.82, pitch: -0.22 },
    { id: 'memory', name: '回忆之境（浮空）', target: [640, 176, 124], dist: 165, yaw: -1.22, pitch: -0.24 },
    { id: 'p26', name: '第26种植园', target: [984, 36, 224], dist: 230, yaw: -1.38, pitch: -0.34 }
  ];
})(window);
