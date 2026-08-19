/* =====================================================================
   微体素地图 · 材质调色板
   与 mod 源码 com.franxx.world.gen.Palette 一一对应，并按赛博朋克风格加强：
   - albedo：基础色（0-255）
   - emis  ：自发光强度 0..1（>0 会自动登记为光源参与烘焙）
   - lit   ：光源色（缺省用 albedo），rad = 影响半径（体素）
   - alpha ：<1 走半透明通道；glow=true 走叠加通道
   - flk   ：闪烁模式（0 稳定，1 缓呼吸，2 快抖，3 故障闪断）
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX;

  var defs = [
    /* 0 号保留为空气 */
    ['air',            [0,0,0]],

    /* ------------------------- 自然地形 ------------------------- */
    ['grass',          [ 82,128, 58]],
    ['grassDry',       [126,132, 70]],
    ['grassDark',      [ 62,102, 50]],
    ['grassNeon',      [ 96,168,110], {emis:0.06}],
    ['dirt',           [104, 78, 54]],
    ['dirtDark',       [ 76, 56, 40]],
    ['sand',           [182,166,124]],
    ['sandDark',       [178,158,116]],
    ['dune',           [190,176,138]],
    ['gravel',         [126,122,118]],
    ['stone',          [124,124,128]],
    ['stoneDark',      [ 82, 82, 90]],
    ['stoneLight',     [140,140,144]],
    ['mesaRock',       [158, 88, 58]],
    ['mesaBand',       [136, 74, 52]],
    ['mesaPale',       [186,132, 96]],
    ['salt',           [206,204,196]],
    ['crackedMud',     [150,102, 78]],
    ['bedrock',        [ 46, 46, 52]],
    ['plinth',         [ 34, 36, 44]],
    ['plinthEdge',     [ 52, 56, 68]],
    ['moss',           [ 74,100, 62]],
    ['snow',           [214,219,228]],
    ['ice',            [168,206,228], {alpha:0.72}],
    ['ash',            [ 92, 88, 88]],

    /* ------------------------- 铺装/道路 ------------------------- */
    ['asphalt',        [ 54, 56, 64]],
    ['asphaltWorn',    [ 70, 70, 76]],
    ['asphaltCrack',   [ 44, 44, 50]],
    ['roadLine',       [216,220,228], {emis:0.10}],
    ['roadLineWarm',   [226,198,120], {emis:0.12}],
    ['roadNeon',       [ 60,214,232], {emis:0.55, rad:9}],
    ['roadNeonPink',   [236, 78,168], {emis:0.55, rad:9}],
    ['pave',           [142,143,148]],
    ['paveDark',       [102,104,112]],
    ['paveWarm',       [156,148,132]],
    ['whiteTile',      [184,185,180]],
    ['marble',         [206,206,198]],
    ['brickPave',      [150, 96, 78]],
    ['grate',          [ 92, 96,104]],
    ['hazard',         [214,168, 38]],
    ['hazardDark',     [ 40, 40, 44]],
    ['redCarpet',      [154, 32, 40]],
    ['curb',           [168,169,165]],

    /* ------------------------- 建筑主材 ------------------------- */
    ['whitePanel',     [196,201,208]],
    ['whitePanel2',    [170,175,184]],
    ['concrete',       [134,138,146]],
    ['concreteDark',   [ 88, 92,100]],
    ['concreteWarm',   [152,144,132]],
    ['concreteMossy',  [116,126,106]],
    ['steel',          [158,162,172]],
    ['steelDark',      [122,128,138]],
    ['girder',         [ 96,102,112]],
    ['darkMetal',      [ 44, 46, 56]],
    ['darkMetal2',     [ 62, 64, 76]],
    ['rustMetal',      [136, 82, 54]],
    ['rustDeep',       [104, 58, 40]],
    ['copperRoof',     [ 92,150,132]],
    ['copperPatina',   [ 76,132,118]],
    ['goldTrim',       [216,178, 86], {emis:0.10}],
    ['tileRoof',       [142, 72, 58]],
    ['woodWhite',      [190,180,156]],
    ['wood',           [150,112, 72]],
    ['woodDark',       [ 96, 70, 46]],
    ['brickWhite',     [200,196,184]],
    ['quartzPillar',   [204,202,192]],
    ['obsidian',       [ 32, 26, 46]],

    /* ------------------------- 玻璃 / 幕墙 ------------------------- */
    ['glassClear',     [172,208,220], {alpha:0.34}],
    ['glassCyan',      [ 78,178,206], {alpha:0.40, emis:0.06}],
    ['glassDark',      [ 46, 62, 80], {alpha:0.56}],
    ['glassGreen',     [ 96,180,140], {alpha:0.40}],
    ['glassDome',      [150,206,224], {alpha:0.20, emis:0.05}],
    ['glassRed',       [190, 70, 70], {alpha:0.44}],
    ['glassGold',      [216,190,110], {alpha:0.42}],
    ['glassBroken',    [156,180,188], {alpha:0.26}],

    /* ------------------------- 发光 / 霓虹 ------------------------- */
    ['windowGold',     [255,214,140], {emis:0.95, rad:7}],
    ['windowWarm',     [255,196,126], {emis:0.88, rad:7}],
    ['windowCool',     [176,232,255], {emis:0.88, rad:7}],
    ['windowDim',      [120,140,160], {emis:0.16, rad:5}],
    ['lampWarm',       [255,222,168], {emis:1.10, rad:10}],
    ['lampCool',       [186,238,255], {emis:1.10, rad:10}],
    ['neonCyan',       [ 90,246,255], {emis:1.40, rad:12}],
    ['neonMagenta',    [255, 74,196], {emis:1.40, rad:12}],
    ['neonPink',       [255,126,186], {emis:1.30, rad:11}],
    ['neonRed',        [255, 66, 74], {emis:1.35, rad:11, flk:1}],
    ['neonGreen',      [124,255,150], {emis:1.30, rad:11}],
    ['neonAmber',      [255,176, 62], {emis:1.35, rad:11}],
    ['neonBlue',       [ 92,140,255], {emis:1.35, rad:12}],
    ['neonViolet',     [178,110,255], {emis:1.35, rad:12}],
    ['neonWhite',      [236,248,255], {emis:1.42, rad:12}],
    ['neonFlick',      [120,240,255], {emis:1.25, rad:10, flk:3}],
    ['neonFlickRed',   [255, 90, 70], {emis:1.25, rad:12, flk:3}],
    ['holoScreen',     [120,214,255], {emis:0.95, rad:12, alpha:0.62, flk:2}],
    ['holoPink',       [255,140,214], {emis:0.95, rad:12, alpha:0.62, flk:2}],
    ['holoGreen',      [140,255,196], {emis:0.90, rad:11, alpha:0.60, flk:2}],
    ['beamCyan',       [110,226,255], {emis:1.10, rad:8, glow:true, alpha:0.16}],
    ['beamWarm',       [255,206,150], {emis:1.10, rad:8, glow:true, alpha:0.16}],
    ['beamRed',        [255,110, 96], {emis:1.10, rad:8, glow:true, alpha:0.18}],
    ['beamViolet',     [196,140,255], {emis:1.10, rad:8, glow:true, alpha:0.18}],

    /* ------------------------- 能量 / 岩浆 ------------------------- */
    ['magma',          [206, 92, 34], {emis:0.85, rad:13}],
    ['magmaCore',      [255,168, 72], {emis:1.35, rad:18}],
    ['lava',           [246,132, 40], {emis:1.25, rad:16, flk:1}],
    ['ember',          [212, 96, 46], {emis:0.60, rad:9}],
    ['coreBlue',       [130,226,255], {emis:1.30, rad:18}],
    ['coreRed',        [255, 78, 66], {emis:1.30, rad:18}],
    ['starCore',       [230,248,255], {emis:1.60, rad:24}],
    ['starShell',      [110,150,196], {emis:0.30, rad:8}],
    ['throneRed',      [178, 34, 44], {emis:0.55, rad:10}],

    /* ------------------------- 叫龙 / 生物机械 ------------------------- */
    ['fleshDark',      [ 84, 34, 44]],
    ['fleshDeep',      [ 62, 24, 34]],
    ['bioMech',        [166,132,178]],
    ['bioMechDark',    [110, 84,126]],
    ['boneWhite',      [198,192,174]],
    ['boneOld',        [186,178,156]],
    ['veinRed',        [128, 34, 44], {emis:0.22, rad:7}],
    ['chitin',         [ 74, 62, 78]],

    /* ------------------------- 植被 ------------------------- */
    ['trunk',          [ 96, 68, 46]],
    ['trunkBirch',     [214,206,186]],
    ['trunkGiant',     [118, 88, 62]],
    ['leavesDark',     [ 44, 92, 52]],
    ['leaves',         [ 62,124, 62]],
    ['leavesLight',    [ 92,158, 78]],
    ['leavesCyan',     [ 84,166,148], {emis:0.10}],
    ['leavesGlow',     [136,220,180], {emis:0.35, rad:9}],
    ['cherry',         [246,178,204]],
    ['cherryDeep',     [230,142,180]],
    ['flowerRed',      [206, 64, 62]],
    ['flowerPink',     [240,158,192]],
    ['flowerWhite',    [216,216,208]],
    ['shrub',          [ 84,132, 66]],
    ['deadWood',       [128,110, 84]],
    ['hedge',          [ 56,104, 54]],
    ['crop',           [188,178, 82]],
    ['cropRow',        [140,150, 70]],

    /* ------------------------- 水 ------------------------- */
    ['water',          [ 46,116,168], {alpha:0.62}],
    ['waterDeep',      [ 26, 76,132], {alpha:0.74}],
    ['waterNeon',      [ 60,180,210], {alpha:0.58, emis:0.20, rad:8}],

    /* ------------------------- 机体 / FRANXX ------------------------- */
    ['mechaWhite',     [206,209,214]],
    ['mechaRed',       [198, 52, 60]],
    ['mechaBlue',      [ 62, 96,178]],
    ['mechaPink',      [238,142,176]],
    ['mechaGrey',      [156,160,168]],
    ['mechaGreen',     [ 82,150, 88]],
    ['mechaDark',      [ 42, 44, 52]],

    /* ------------------------- 废墟 ------------------------- */
    ['rubble',         [116,112,106]],
    ['rubbleDark',     [ 88, 84, 80]],
    ['brickRuin',      [148,104, 84]],
    ['signFaded',      [166,158,140]],
    ['tarp',           [ 92,110,126]],
    ['scorch',         [ 52, 46, 44]],
    ['wire',           [ 60, 60, 66]]
  ];

  var MAT = {};        // name -> id
  var LIST = [];       // id -> record
  for (var i = 0; i < defs.length; i++) {
    var d = defs[i], o = d[2] || {};
    var rec = {
      id: i, name: d[0], rgb: d[1],
      emis: o.emis || 0,
      alpha: o.alpha != null ? o.alpha : 1,
      glow: !!o.glow,
      flk: o.flk || 0,
      rad: o.rad || 0,
      lit: o.lit || d[1]
    };
    // 通道：0 不透明 / 1 半透明 / 2 叠加发光
    rec.pass = rec.glow ? 2 : (rec.alpha < 0.999 ? 1 : 0);
    MAT[d[0]] = i;
    LIST.push(rec);
  }
  if (LIST.length > 255) throw new Error('材质数量超过 255：' + LIST.length);

  VX.MAT = MAT;
  VX.MATLIST = LIST;
  VX.matCount = LIST.length;

  /** 名字 → id（不存在时抛错，便于早期发现拼写问题） */
  VX.m = function (name) {
    var id = MAT[name];
    if (id === undefined) throw new Error('未知材质: ' + name);
    return id;
  };
})(window);
