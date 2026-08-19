// Block registry. Minecraft-style voxels with No Man's Sky resource semantics.
// Textures are procedurally generated (see atlas.js) and tinted per-planet palette.

export const RT = { CUBE: 0, CROSS: 1, LIQUID: 2 };

// tile names must exist in atlas.js TILES
function def(o) {
  return Object.assign({
    name: '?', cn: '?', rt: RT.CUBE, solid: true, opaque: true,
    tiles: null, top: null, bottom: null, side: null,
    tint: 'none', hardness: 1, emissive: 0, sway: 0, sound: 'stone',
    drop: null, dropCount: [1, 1], buildable: true, resource: null,
    scan: null, hasAlpha: false, collide: true, item: true,
  }, o);
}

export const BLOCKS = [
  /* 0 */ def({ name: 'Air', cn: '空气', solid: false, opaque: false, buildable: false, item: false }),
  /* 1 */ def({ name: 'Bedrock', cn: '基岩', side: 'bedrock', hardness: -1, buildable: false, sound: 'stone', item: false }),
  /* 2 */ def({ name: 'Stone', cn: '石头', side: 'stone', tint: 'stone', hardness: 1.5, sound: 'stone', drop: 'COBBLE' }),
  /* 3 */ def({ name: 'Dirt', cn: '泥土', side: 'dirt', tint: 'dirt', hardness: 0.5, sound: 'dirt', drop: 'DIRT' }),
  /* 4 */ def({ name: 'Grass Block', cn: '草方块', top: 'grass_top', side: 'grass_side', bottom: 'dirt', tint: 'grass', tintTop: 'grass', hardness: 0.6, sound: 'grass', drop: 'DIRT' }),
  /* 5 */ def({ name: 'Sand', cn: '沙子', side: 'sand', tint: 'sand', hardness: 0.5, sound: 'sand', drop: 'SAND' }),
  /* 6 */ def({ name: 'Gravel', cn: '砂砾', side: 'gravel', tint: 'stone', hardness: 0.6, sound: 'gravel', drop: 'GRAVEL' }),
  /* 7 */ def({ name: 'Water', cn: '水', rt: RT.LIQUID, solid: false, opaque: false, collide: false, side: 'water', tint: 'water', hardness: -1, sound: 'water', buildable: false, item: false }),
  /* 8 */ def({ name: 'Log', cn: '原木', top: 'log_top', side: 'log_side', tint: 'wood', hardness: 2, sound: 'wood', drop: 'LOG', resource: 'CARBON', dropCount: [6, 10] }),
  /* 9 */ def({ name: 'Leaves', cn: '树叶', side: 'leaves', tint: 'leaf', hardness: 0.2, sound: 'grass', hasAlpha: true, opaque: false, drop: 'LEAVES', resource: 'CARBON', dropCount: [1, 2] }),
  /* 10 */ def({ name: 'Planks', cn: '木板', side: 'planks', tint: 'wood', hardness: 2, sound: 'wood', drop: 'PLANKS' }),
  /* 11 */ def({ name: 'Cobblestone', cn: '圆石', side: 'cobble', tint: 'stone', hardness: 2, sound: 'stone', drop: 'COBBLE' }),
  /* 12 */ def({ name: 'Ferrite Deposit', cn: '铁质矿床', side: 'ore_ferrite', hardness: 2.4, sound: 'stone', resource: 'FERRITE_DUST', dropCount: [14, 22], scan: 'MINERAL' }),
  /* 13 */ def({ name: 'Copper Deposit', cn: '铜矿床', side: 'ore_copper', hardness: 2.6, sound: 'stone', resource: 'COPPER', dropCount: [10, 16], scan: 'MINERAL' }),
  /* 14 */ def({ name: 'Carbon Bush', cn: '含碳灌木', rt: RT.CROSS, solid: false, opaque: false, collide: false, side: 'bush', tint: 'leaf', hardness: 0.15, sound: 'plant', hasAlpha: true, sway: 1, resource: 'CARBON', dropCount: [8, 14], scan: 'FLORA' }),
  /* 15 */ def({ name: 'Oxygen Flora', cn: '含氧植物', rt: RT.CROSS, solid: false, opaque: false, collide: false, side: 'plant_red', hardness: 0.15, sound: 'plant', hasAlpha: true, sway: 1, emissive: 0.25, resource: 'OXYGEN', dropCount: [22, 34], scan: 'FLORA' }),
  /* 16 */ def({ name: 'Sodium Flora', cn: '含钠植物', rt: RT.CROSS, solid: false, opaque: false, collide: false, side: 'plant_yellow', hardness: 0.15, sound: 'plant', hasAlpha: true, sway: 1, emissive: 0.3, resource: 'SODIUM', dropCount: [18, 28], scan: 'FLORA' }),
  /* 17 */ def({ name: 'Di-hydrogen Crystal', cn: '氢晶体', side: 'crystal_blue', hardness: 1.2, sound: 'crystal', emissive: 0.85, resource: 'DIHYDROGEN', dropCount: [26, 40], scan: 'MINERAL' }),
  /* 18 */ def({ name: 'Paraffinium Growth', cn: '石蜡岩', side: 'rock_paraffinium', hardness: 1.8, sound: 'stone', emissive: 0.2, resource: 'PARAFFINIUM', dropCount: [12, 20], scan: 'MINERAL' }),
  /* 19 */ def({ name: 'Ice', cn: '冰', side: 'ice', hardness: 0.5, sound: 'glass', hasAlpha: true, opaque: false, drop: 'ICE' }),
  /* 20 */ def({ name: 'Snow', cn: '雪块', side: 'snow', hardness: 0.3, sound: 'snow', drop: 'SNOW' }),
  /* 21 */ def({ name: 'Glass', cn: '玻璃', side: 'glass', hardness: 0.3, sound: 'glass', hasAlpha: true, opaque: false, drop: 'GLASS' }),
  /* 22 */ def({ name: 'Lumen Block', cn: '发光方块', side: 'lumen', hardness: 0.3, sound: 'glass', emissive: 1, drop: 'LUMEN' }),
  /* 23 */ def({ name: 'Metal Panel', cn: '金属墙板', side: 'metal_panel', hardness: 3, sound: 'metal', drop: 'METAL_PANEL' }),
  /* 24 */ def({ name: 'Metal Floor', cn: '金属地板', side: 'metal_floor', hardness: 3, sound: 'metal', drop: 'METAL_FLOOR' }),
  /* 25 */ def({ name: 'Alien Rock', cn: '异星岩', side: 'alien_rock', tint: 'rock', hardness: 1.7, sound: 'stone', resource: 'FERRITE_DUST', dropCount: [8, 14] }),
  /* 26 */ def({ name: 'Fungal Stem', cn: '菌柄', top: 'mush_stem_top', side: 'mush_stem', tint: 'wood', hardness: 0.8, sound: 'plant', resource: 'CARBON', dropCount: [5, 9] }),
  /* 27 */ def({ name: 'Fungal Cap', cn: '菌盖', side: 'mush_cap', tint: 'leaf', hardness: 0.4, sound: 'plant', emissive: 0.35, resource: 'CARBON', dropCount: [3, 6], scan: 'FLORA' }),
  /* 28 */ def({ name: 'Basalt', cn: '玄武岩', side: 'basalt', hardness: 2.5, sound: 'stone', drop: 'BASALT' }),
  /* 29 */ def({ name: 'Gold Deposit', cn: '黄金矿床', side: 'ore_gold', hardness: 3, sound: 'stone', resource: 'GOLD', dropCount: [8, 14], scan: 'MINERAL' }),
  /* 30 */ def({ name: 'Salt Crystal', cn: '盐晶', side: 'salt', hardness: 1, sound: 'crystal', emissive: 0.3, resource: 'CHLORINE', dropCount: [14, 22], scan: 'MINERAL' }),
  /* 31 */ def({ name: 'Cobalt Cluster', cn: '钴簇', side: 'cobalt', hardness: 1.4, sound: 'crystal', emissive: 0.5, resource: 'COBALT', dropCount: [18, 28], scan: 'MINERAL' }),
  /* 32 */ def({ name: 'Stone Bricks', cn: '石砖', side: 'brick', tint: 'stone', hardness: 2.2, sound: 'stone', drop: 'BRICK' }),
  /* 33 */ def({ name: 'Alien Grass', cn: '异星草', rt: RT.CROSS, solid: false, opaque: false, collide: false, side: 'tuft', tint: 'grass', hardness: 0.1, sound: 'grass', hasAlpha: true, sway: 1, resource: 'CARBON', dropCount: [2, 5] }),
  /* 34 */ def({ name: 'Storage Crate', cn: '储物箱', top: 'crate_top', side: 'crate_side', hardness: 2, sound: 'wood', drop: 'CRATE', special: 'crate' }),
  /* 35 */ def({ name: 'Portable Refiner', cn: '便携精炼器', top: 'refiner_top', side: 'refiner_side', hardness: 2, sound: 'metal', emissive: 0.4, drop: 'REFINER', special: 'refiner' }),
  /* 36 */ def({ name: 'Base Computer', cn: '基地计算机', top: 'computer_top', side: 'computer', hardness: 2, sound: 'metal', emissive: 0.6, drop: 'BASE_COMPUTER', special: 'computer' }),
  /* 37 */ def({ name: 'Save Beacon', cn: '信号灯塔', side: 'beacon', hardness: 1.5, sound: 'metal', emissive: 0.9, drop: 'BEACON', special: 'beacon' }),
  /* 38 */ def({ name: 'Construction Table', cn: '构筑台', top: 'table_top', side: 'table_side', tint: 'wood', hardness: 2.2, sound: 'wood', drop: 'TABLE', special: 'table' }),
  /* 39 */ def({ name: 'Cactus Flesh', cn: '仙人掌', side: 'cactus', hardness: 0.4, sound: 'plant', resource: 'CARBON', dropCount: [6, 10], scan: 'FLORA' }),
  /* 40 */ def({ name: 'Hardened Sand', cn: '硬化沙岩', side: 'sandstone', tint: 'sand', hardness: 0.8, sound: 'sand', drop: 'SANDSTONE' }),
  /* 41 */ def({ name: 'Frost Crystal', cn: '霜晶', side: 'crystal_frost', hardness: 1.1, sound: 'crystal', emissive: 0.7, resource: 'DIHYDROGEN', dropCount: [22, 32], scan: 'MINERAL' }),
  /* 42 */ def({ name: 'Glowing Moss', cn: '荧光苔', rt: RT.CROSS, solid: false, opaque: false, collide: false, side: 'moss', hardness: 0.1, sound: 'plant', hasAlpha: true, sway: 1, emissive: 0.8, resource: 'CARBON', dropCount: [2, 4] }),
];

export const ID = {};
export const BID = {
  AIR: 0, BEDROCK: 1, STONE: 2, DIRT: 3, GRASS: 4, SAND: 5, GRAVEL: 6, WATER: 7,
  LOG: 8, LEAVES: 9, PLANKS: 10, COBBLE: 11, FERRITE: 12, COPPER: 13, BUSH: 14,
  OXY: 15, SODIUM: 16, CRYSTAL: 17, PARAFFIN: 18, ICE: 19, SNOW: 20, GLASS: 21,
  LUMEN: 22, METAL_PANEL: 23, METAL_FLOOR: 24, ALIEN_ROCK: 25, MUSH_STEM: 26,
  MUSH_CAP: 27, BASALT: 28, GOLD: 29, SALT: 30, COBALT: 31, BRICK: 32, TUFT: 33,
  CRATE: 34, REFINER: 35, COMPUTER: 36, BEACON: 37, TABLE: 38, CACTUS: 39,
  SANDSTONE: 40, FROST_CRYSTAL: 41, MOSS: 42,
};
for (const k in BID) ID[k] = BID[k];

export function blockDef(id) { return BLOCKS[id] || BLOCKS[0]; }
export function isSolid(id) { return BLOCKS[id] ? BLOCKS[id].solid : false; }
export function isOpaque(id) { return BLOCKS[id] ? BLOCKS[id].opaque : false; }
export function isCollide(id) { const b = BLOCKS[id]; return b ? b.solid && b.collide : false; }
export function isLiquid(id) { return id === BID.WATER; }
export function renderType(id) { const b = BLOCKS[id]; return b ? b.rt : RT.CUBE; }

// blocks that are "placeable" in the build menu, grouped
export const BUILD_GROUPS = [
  { name: '地形 TERRAIN', ids: [BID.DIRT, BID.GRASS, BID.SAND, BID.SANDSTONE, BID.STONE, BID.COBBLE, BID.BRICK, BID.GRAVEL, BID.BASALT, BID.SNOW, BID.ICE] },
  { name: '木材 TIMBER', ids: [BID.LOG, BID.PLANKS, BID.LEAVES] },
  { name: '科技 TECH', ids: [BID.METAL_PANEL, BID.METAL_FLOOR, BID.GLASS, BID.LUMEN] },
  { name: '设备 DEVICES', ids: [BID.TABLE, BID.REFINER, BID.CRATE, BID.BEACON, BID.COMPUTER] },
];
