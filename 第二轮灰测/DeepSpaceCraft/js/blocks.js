/* DEEP SPACE CRAFT · blocks.js —— 方块 / 物品 / 配方注册表（SPEC §4 唯一权威实现） */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});

  /* 面序：0=+X 1=-X 2=+Y(顶) 3=-Y(底) 4=+Z 5=-Z */
  var FACE = { PX: 0, NX: 1, PY: 2, NY: 3, PZ: 4, NZ: 5 };

  /* 材质音 → 用于 dig_/break_/place_/step_ 前缀 */
  var M = {
    stone: 'stone', dirt: 'dirt', grass: 'grass', sand: 'sand', wood: 'wood',
    metal: 'metal', glass: 'glass', crystal: 'crystal', snow: 'snow', water: 'water'
  };

  /* [id, key, tiles, 材质, 硬度, 选项] —— tiles: 字符串(全面) 或 {top,bottom,side} */
  var TABLE = [
    [0, 'air', null, null, 0, { solid: false, opaque: false, sel: false }],
    [1, 'stone', 'stone', M.stone, 1.5, {}],
    [2, 'grass', { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, M.grass, 0.6, {}],
    [3, 'dirt', 'dirt', M.dirt, 0.5, {}],
    [4, 'cobblestone', 'cobblestone', M.stone, 2.0, {}],
    [5, 'sand', 'sand', M.sand, 0.5, {}],
    [6, 'sandstone', { top: 'sandstone_top', side: 'sandstone_side', bottom: 'sandstone_top' }, M.stone, 0.8, {}],
    [7, 'gravel', 'gravel', M.dirt, 0.6, {}],
    [8, 'log', { top: 'log_top', side: 'log_side', bottom: 'log_top' }, M.wood, 2.0, {}],
    [9, 'leaves', 'leaves', M.grass, 0.3, {}],
    [10, 'planks', 'planks', M.wood, 2.0, {}],
    [11, 'water', 'water', M.water, 0, { solid: false, opaque: false, liquid: true, alpha: 0.72, sel: false }],
    [12, 'snow_block', { top: 'snow_top', side: 'snow_side', bottom: 'snow_top' }, M.snow, 0.4, {}],
    [13, 'ice', 'ice', M.snow, 0.5, { opaque: false, alpha: 0.78 }],
    [14, 'bedrock', 'bedrock', M.stone, Infinity, {}],
    [15, 'coal_ore', 'coal_ore', M.stone, 3.0, { drop: 'carbon', dropN: [2, 4] }],
    [16, 'ferrite_ore', 'iron_ore', M.stone, 3.0, { drop: 'ferrite', dropN: [2, 4] }],
    [17, 'gold_ore', 'gold_ore', M.stone, 3.0, { drop: 'gold', dropN: [1, 3] }],
    [18, 'diamond_ore', 'diamond_ore', M.crystal, 3.5, { drop: 'diamond', dropN: [1, 2] }],
    [19, 'copper_ore', 'copper_ore', M.stone, 3.0, { drop: 'copper', dropN: [2, 3] }],
    [20, 'emeril_ore', 'emeril_ore', M.crystal, 3.2, { drop: 'emeril', dropN: [1, 3] }],
    [21, 'chryson', 'chryson_crystal', M.crystal, 2.5, { emissive: 0.5, drop: 'chryson', dropN: [1, 3] }],
    [22, 'indium', 'indium_crystal', M.crystal, 3.0, { emissive: 0.6, drop: 'indium', dropN: [1, 2] }],
    [23, 'alien_grass', { top: 'alien_grass_top', side: 'alien_grass_side', bottom: 'alien_dirt' }, M.grass, 0.6, {}],
    [24, 'alien_dirt', 'alien_dirt', M.dirt, 0.5, {}],
    [25, 'basalt', 'alien_stone', M.stone, 1.8, {}],
    [26, 'alien_log', { top: 'alien_log_top', side: 'alien_log_side', bottom: 'alien_log_top' }, M.wood, 2.0, {}],
    [27, 'alien_leaves', 'alien_leaves', M.grass, 0.3, {}],
    [28, 'fungal_cap', { top: 'fungal_cap_top', side: 'fungal_cap_side', bottom: 'fungal_cap_side' }, M.grass, 0.5, { emissive: 0.25 }],
    [29, 'lumina', 'lumina_block', M.metal, 1.5, { emissive: 1.0 }],
    [30, 'crystal_block', 'crystal_block', M.crystal, 1.2, { opaque: false, alpha: 0.8, emissive: 0.7 }],
    [31, 'glass', 'glass', M.glass, 0.4, { opaque: false, alpha: 0.5 }],
    [32, 'metal_plate', 'metal_plate', M.metal, 2.5, {}],
    [33, 'metal_panel', 'metal_panel', M.metal, 2.5, {}],
    [34, 'tech_grate', 'tech_grate', M.metal, 2.2, {}],
    [35, 'glow_panel', 'glow_panel', M.metal, 2.0, { emissive: 0.9 }],
    [36, 'hull_white', 'hull_white', M.metal, 2.5, {}],
    [37, 'monolith', 'monolith', M.stone, 4.0, { emissive: 0.35 }],
    [38, 'obsidian', 'obsidian', M.stone, 4.0, {}],
    [39, 'magma', 'magma', M.stone, 1.5, { emissive: 1.0, damage: 6 }],
    [40, 'carbon_block', 'carbon_block', M.stone, 1.5, {}],
    [41, 'sodium_block', 'sodium_block', M.crystal, 1.0, { emissive: 0.8, drop: 'sodium', dropN: [2, 4] }],
    [42, 'launch_pad', 'launch_pad', M.metal, 3.0, {}],
    [43, 'frost_stone', 'frost_stone', M.stone, 1.6, {}],
    [44, 'red_sand', 'red_sand', M.sand, 0.5, {}],
    [45, 'toxic_sludge', 'toxic_sludge', M.water, 0, { solid: false, opaque: false, liquid: true, alpha: 0.8, emissive: 0.4, damage: 4, sel: false }],
    [46, 'star_bulb', 'star_bulb', M.grass, 0.3, { emissive: 0.8, drop: 'sodium', dropN: [1, 2] }],
    [47, 'salt_block', 'salt_block', M.sand, 0.6, { drop: 'salt', dropN: [2, 3] }],
    [48, 'ash_block', 'ash_block', M.sand, 0.5, {}],
    [49, 'coral_block', 'coral_block', M.grass, 0.8, { emissive: 0.3 }],
    [50, 'alien_sand', 'alien_sand', M.sand, 0.5, {}]
  ];

  var LIST = [], ID = {}, i, j;
  for (i = 0; i < TABLE.length; i++) {
    var r = TABLE[i], o = r[5] || {};
    var def = {
      id: r[0], key: r[1], tiles: r[2], mat: r[3], hard: r[4],
      solid: o.solid === undefined ? true : o.solid,
      opaque: o.opaque === undefined ? (o.solid === false ? false : true) : o.opaque,
      liquid: !!o.liquid,
      alpha: o.alpha === undefined ? 1 : o.alpha,
      emissive: o.emissive || 0,
      damage: o.damage || 0,
      sel: o.sel === undefined ? true : o.sel,
      drop: o.drop || r[1],
      dropN: o.dropN || [1, 1],
      /* 运行时填充 */
      tileIdx: [0, 0, 0, 0, 0, 0],
      color: [1, 1, 1]
    };
    LIST[def.id] = def;
    ID[def.key] = def.id;
  }
  for (i = 0; i < LIST.length; i++) if (!LIST[i]) LIST[i] = LIST[0];

  /* ------------------------------------------------------------ 物品表 */
  /* type: resource(资源) / block(可放置) / tech(装备与消耗品) */
  var ITEM_TABLE = [
    ['carbon', '碳', 'CARBON', 'carbon_block', 'resource', 12],
    ['carbon_conc', '凝聚碳', 'CONDENSED CARBON', 'obsidian', 'resource', 48],
    ['ferrite', '铁氧尘', 'FERRITE DUST', 'iron_ore', 'resource', 14],
    ['pure_ferrite', '纯铁氧', 'PURE FERRITE', 'metal_plate', 'resource', 52],
    ['sodium', '钠', 'SODIUM', 'sodium_block', 'resource', 22],
    ['oxygen', '氧', 'OXYGEN', 'crystal_block', 'resource', 34],
    ['deuterium', '氘', 'DEUTERIUM', 'ice', 'resource', 88],
    ['gold', '黄金', 'GOLD', 'gold_ore', 'resource', 190],
    ['diamond', '活化钻石', 'ACTIVATED DIAMOND', 'diamond_ore', 'resource', 420],
    ['indium', '铟', 'INDIUM', 'indium_crystal', 'resource', 640],
    ['emeril', '艾米瑞尔', 'EMERIL', 'emeril_ore', 'resource', 310],
    ['chryson', '克莱森', 'CHRYSONITE', 'chryson_crystal', 'resource', 230],
    ['copper', '铜', 'COPPER', 'copper_ore', 'resource', 110],
    ['salt', '氯化物', 'CHLORINE', 'salt_block', 'resource', 42],
    ['ice_shard', '冰晶', 'ICE SHARD', 'ice', 'resource', 18],
    ['warp_cell', '曲速电池', 'WARP CELL', 'glow_panel', 'tech', 1200],
    ['launch_fuel', '起飞推进剂', 'LAUNCH FUEL', 'magma', 'tech', 260],
    ['med_kit', '医疗包', 'MEDKIT', 'lumina_block', 'tech', 180],
    ['o2_canister', '氧气罐', 'OXYGEN CANISTER', 'star_bulb', 'tech', 150]
  ];

  var ITEMS = {};
  for (i = 0; i < ITEM_TABLE.length; i++) {
    var it = ITEM_TABLE[i];
    ITEMS[it[0]] = { key: it[0], zh: it[1], en: it[2], tile: it[3], type: it[4], value: it[5], stack: 9999 };
  }
  /* 所有方块也是物品（可放置），堆叠 999 */
  for (i = 1; i < LIST.length; i++) {
    var b = LIST[i];
    if (ITEMS[b.key]) continue;
    ITEMS[b.key] = { key: b.key, zh: null, en: null, tile: null, type: 'block', value: Math.round(4 + b.hard * 6), stack: 999, block: b.id };
  }

  /* ------------------------------------------------------------ 配方 */
  var REFINER = [
    { id: 'r1', in: [{ k: 'ferrite', n: 2 }], out: { k: 'pure_ferrite', n: 1 }, label: '铁氧提纯' },
    { id: 'r2', in: [{ k: 'carbon', n: 2 }], out: { k: 'carbon_conc', n: 1 }, label: '碳凝聚' },
    { id: 'r3', in: [{ k: 'ice_shard', n: 3 }], out: { k: 'deuterium', n: 1 }, label: '重水分离' },
    { id: 'r4', in: [{ k: 'salt', n: 2 }, { k: 'carbon', n: 1 }], out: { k: 'oxygen', n: 3 }, label: '氧气合成' },
    { id: 'r5', in: [{ k: 'chryson', n: 2 }, { k: 'copper', n: 1 }], out: { k: 'indium', n: 1 }, label: '铟嵌位跃迁' }
  ];
  var CRAFT = [
    { id: 'c1', in: [{ k: 'indium', n: 2 }, { k: 'sodium', n: 2 }], out: { k: 'warp_cell', n: 1 }, label: '曲速电池' },
    { id: 'c2', in: [{ k: 'carbon_conc', n: 2 }, { k: 'sodium', n: 1 }], out: { k: 'launch_fuel', n: 1 }, label: '起飞推进剂' },
    { id: 'c3', in: [{ k: 'carbon_conc', n: 1 }, { k: 'oxygen', n: 2 }], out: { k: 'med_kit', n: 1 }, label: '医疗包' },
    { id: 'c4', in: [{ k: 'oxygen', n: 4 }], out: { k: 'o2_canister', n: 1 }, label: '氧气罐' },
    { id: 'c5', in: [{ k: 'pure_ferrite', n: 2 }], out: { k: 'metal_plate', n: 4 }, label: '金属板' },
    { id: 'c6', in: [{ k: 'pure_ferrite', n: 1 }, { k: 'chryson', n: 1 }], out: { k: 'glow_panel', n: 2 }, label: '发光面板' },
    { id: 'c7', in: [{ k: 'sand', n: 2 }, { k: 'carbon', n: 1 }], out: { k: 'glass', n: 3 }, label: '玻璃' }
  ];

  var Blocks = {
    FACE: FACE,
    LIST: LIST,
    ID: ID,
    ITEMS: ITEMS,
    REFINER: REFINER,
    CRAFT: CRAFT,
    count: LIST.length,

    /* 解析 tile 名 → atlas 索引；atlas 来自 DSC.Textures.build() */
    init: function (atlas) {
      var T = DSC.Textures;
      function idx(name) {
        if (!name) return 0;
        var v = atlas.index[name];
        if (v === undefined) { console.warn('[blocks] 缺少贴图 tile:', name); return 0; }
        return v;
      }
      for (var i = 1; i < LIST.length; i++) {
        var d = LIST[i];
        if (!d.tiles) continue;
        var top, side, bot;
        if (typeof d.tiles === 'string') { top = side = bot = d.tiles; }
        else { side = d.tiles.side || d.tiles.all; top = d.tiles.top || side; bot = d.tiles.bottom || side; }
        d.tileIdx[FACE.PX] = idx(side); d.tileIdx[FACE.NX] = idx(side);
        d.tileIdx[FACE.PZ] = idx(side); d.tileIdx[FACE.NZ] = idx(side);
        d.tileIdx[FACE.PY] = idx(top); d.tileIdx[FACE.NY] = idx(bot);
        d.color = (T && T.avgColor) ? T.avgColor(top) : [0.6, 0.6, 0.6];
      }
      /* 物品图标（方块用顶面 tile） */
      for (var k in ITEMS) {
        var it = ITEMS[k];
        if (!it.tile) {
          var bd = LIST[ID[k]];
          it.tile = bd ? (typeof bd.tiles === 'string' ? bd.tiles : (bd.tiles.top || bd.tiles.side)) : 'stone';
        }
        if (it.zh === null) {
          var nm = (DSC.Lore && DSC.Lore.blockName) ? DSC.Lore.blockName(k) : null;
          it.zh = nm ? nm.zh : k; it.en = nm ? nm.en : k.toUpperCase();
        }
      }
      return Blocks;
    },

    get: function (id) { return LIST[id] || LIST[0]; },
    idOf: function (key) { return ID[key] === undefined ? 0 : ID[key]; },
    keyOf: function (id) { return (LIST[id] || LIST[0]).key; },
    isSolid: function (id) { return LIST[id] ? LIST[id].solid : false; },
    isOpaque: function (id) { return LIST[id] ? LIST[id].opaque : false; },
    isLiquid: function (id) { return LIST[id] ? LIST[id].liquid : false; },
    isAir: function (id) { return !id; },
    emissive: function (id) { return LIST[id] ? LIST[id].emissive : 0; },
    hardness: function (id) { return LIST[id] ? LIST[id].hard : 1; },
    material: function (id) { return LIST[id] ? LIST[id].mat : 'stone'; },
    /* 音效名（break/place 没有水材质版本 → 回退 stone） */
    sfx: function (id, kind) {
      var m = Blocks.material(id);
      if ((kind === 'break' || kind === 'place') && m === 'water') m = 'stone';
      return kind + '_' + m;
    },
    damage: function (id) { return LIST[id] ? LIST[id].damage : 0; },
    tile: function (id, face) { return LIST[id] ? LIST[id].tileIdx[face] : 0; },
    color: function (id) { return LIST[id] ? LIST[id].color : [1, 1, 1]; },
    /* 挖掘掉落 */
    drops: function (id, rng) {
      var d = LIST[id]; if (!d || !d.drop) return null;
      var n = d.dropN[0] + Math.floor((rng ? rng() : Math.random()) * (d.dropN[1] - d.dropN[0] + 1));
      return { k: d.drop, n: Math.max(1, n) };
    },
    /* 名称（中文 + 英文） */
    name: function (id) {
      var key = Blocks.keyOf(id);
      var nm = (DSC.Lore && DSC.Lore.blockName) ? DSC.Lore.blockName(key) : null;
      return nm || { zh: key, en: key.toUpperCase() };
    },
    item: function (key) { return ITEMS[key] || null; },
    itemName: function (key) {
      var it = ITEMS[key];
      if (it && it.zh) return { zh: it.zh, en: it.en };
      var nm = (DSC.Lore && DSC.Lore.blockName) ? DSC.Lore.blockName(key) : null;
      return nm || { zh: key, en: String(key).toUpperCase() };
    },
    /* 该物品能否作为方块放置 */
    placeable: function (key) { return ID[key] !== undefined && ID[key] > 0; }
  };

  DSC.Blocks = Blocks;
})();
