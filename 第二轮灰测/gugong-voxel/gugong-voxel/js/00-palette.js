/* =====================================================================
 * 紫禁城 体素模型 — 材质调色板 (Palette)
 * ---------------------------------------------------------------------
 * 纯数据模块：不依赖 THREE，可在浏览器与 Node 中同时加载。
 * 每种方块 = { id, key, name, color, kind, prio, rough }
 *   kind : 'lambert' 砖石木土 | 'phong' 琉璃/鎏金/水面（带高光）
 *   prio : 放置优先级。同一格被不同材质写入时，高优先级胜出，
 *          并计入"已仲裁冲突"，从而保证不会出现错误覆盖。
 * 取色依据：故宫官式建筑"红墙黄瓦、青绿彩画、汉白玉台基"配色。
 * ===================================================================== */
(function (G) {
  'use strict';

  var SPEC = [
    // ---- 屋面：黄琉璃瓦（三大殿、后三宫等主要殿宇） ----
    ['TILE_Y',      '黄琉璃瓦',      0xd9a326, 'phong',   70, 0.35],
    ['TILE_Y_D',    '黄琉璃瓦垄暗',  0xba8619, 'phong',   70, 0.40],
    ['TILE_Y_L',    '黄琉璃瓦垄亮',  0xecbb45, 'phong',   70, 0.30],
    // ---- 屋面：绿琉璃瓦（皇子居所、部分门庑、花园建筑） ----
    ['TILE_G',      '绿琉璃瓦',      0x3c7340, 'phong',   70, 0.35],
    ['TILE_G_D',    '绿琉璃瓦暗',    0x2f5c33, 'phong',   70, 0.40],
    // ---- 屋面：黑琉璃瓦绿剪边（文渊阁，取"黑主水"以克火） ----
    ['TILE_K',      '黑琉璃瓦',      0x2a2b31, 'phong',   70, 0.35],
    // ---- 屋面：灰筒瓦（值房、库房、随墙小房） ----
    ['TILE_ASH',    '灰筒瓦',        0x6a6a6d, 'lambert', 70, 0.70],
    // ---- 屋脊与脊饰 ----
    ['RIDGE',       '正脊垂脊',      0xf0c85a, 'phong',   80, 0.28],
    ['RIDGE_G',     '绿琉璃脊',      0x4b8a4a, 'phong',   80, 0.30],
    ['BEAST',       '脊兽走兽',      0xffd870, 'phong',   88, 0.22],
    ['FINIAL',      '鎏金宝顶',      0xffcf4d, 'phong',   90, 0.15],

    // ---- 墙体 ----
    ['WALL_R',      '宫墙红',        0x9c3b2c, 'lambert', 60, 0.85],
    ['WALL_R_D',    '宫墙红阴',      0x833024, 'lambert', 60, 0.85],
    ['WALL_CITY',   '城墙红',        0x8b4335, 'lambert', 58, 0.90],
    ['WALL_CITY_D', '城墙红阴',      0x77382c, 'lambert', 58, 0.90],
    ['BRICK',       '城砖灰',        0x8b8681, 'lambert', 56, 0.88],
    ['BRICK_D',     '城砖灰阴',      0x777270, 'lambert', 56, 0.88],

    // ---- 木构：柱、门、窗、额枋、斗拱 ----
    ['COL_R',       '朱红檐柱',      0xa8402a, 'lambert', 64, 0.75],
    ['DOOR_R',      '隔扇门朱红',    0x7d2a21, 'lambert', 62, 0.78],
    ['LATTICE',     '菱花隔扇金',    0xc79a3c, 'phong',   66, 0.45],
    ['BEAM_B',      '额枋青',        0x2c5f7d, 'lambert', 66, 0.72],
    ['BEAM_G',      '额枋绿',        0x2b6b52, 'lambert', 66, 0.72],
    ['DOUGONG',     '斗拱',          0xcfd8da, 'lambert', 68, 0.70],
    ['WOOD_D',      '椽飞望板',      0x5d3f2c, 'lambert', 65, 0.80],
    ['GILT',        '鎏金饰件',      0xd8ab3a, 'phong',   86, 0.20],

    // ---- 石作：汉白玉台基、栏杆、御路 ----
    ['MARBLE',      '汉白玉',        0xe4e0d3, 'lambert', 50, 0.65],
    ['MARBLE_D',    '汉白玉阴',      0xcbc6b6, 'lambert', 50, 0.65],
    ['RAIL',        '望柱栏板',      0xefebdf, 'lambert', 74, 0.60],
    ['STONE',       '青白石',        0xa9a69d, 'lambert', 52, 0.72],

    // ---- 地面铺装（TileField 使用，同表共用颜色） ----
    ['PAVE',        '海墁青砖',      0x968f86, 'lambert', 20, 0.90],
    ['PAVE_2',      '海墁青砖二',    0x8b8479, 'lambert', 20, 0.90],
    ['PAVE_W',      '御路石',        0xd3cec0, 'lambert', 22, 0.75],
    ['SOIL',        '素土夯实',      0x6e6355, 'lambert', 12, 0.95],
    ['GRASS',       '草皮',          0x5a6b3c, 'lambert', 12, 0.95],

    // ---- 水体 ----
    ['WATER',       '水面',          0x2f5e6b, 'phong',   15, 0.12],

    // ---- 植物（御花园、慈宁宫花园；三大殿广场按制不植树） ----
    ['LEAF_D',      '松柏深',        0x2f5227, 'lambert', 40, 0.90],
    ['LEAF',        '松柏',          0x3d6b33, 'lambert', 40, 0.90],
    ['LEAF_L',      '松柏亮',        0x4d7d3c, 'lambert', 40, 0.90],
    ['TRUNK',       '树干',          0x584231, 'lambert', 42, 0.90],
    ['ROCK',        '太湖石叠山',    0x83817a, 'lambert', 44, 0.92],

    // ---- 陈设：铜器、石兽 ----
    ['BRONZE',      '铜鼎铜龟鹤',    0x6d5a30, 'phong',   84, 0.35],
    ['LION',        '铜狮',          0x5f5330, 'phong',   84, 0.35]
  ];

  var BLOCK = {};   // key -> id
  var LIST  = [];   // id  -> spec object

  for (var i = 0; i < SPEC.length; i++) {
    var s = SPEC[i];
    var o = { id: i, key: s[0], name: s[1], color: s[2], kind: s[3], prio: s[4], rough: s[5] };
    LIST.push(o);
    BLOCK[s[0]] = i;
  }

  /* 材质分组：同 kind 且颜色一致的块共用一个 InstancedMesh 材质。
     这里每个 id 一份材质，配合空间分桶后 draw call 仍在数百量级。 */
  G.GGPalette = {
    BLOCK: BLOCK,
    LIST: LIST,
    count: LIST.length,
    spec: function (id) { return LIST[id]; },
    idOf: function (key) {
      var id = BLOCK[key];
      if (id === undefined) throw new Error('未知方块类型: ' + key);
      return id;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
