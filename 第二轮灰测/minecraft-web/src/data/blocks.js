/* =====================================================================
 * blocks.js — 方块注册表
 * 每个方块的物理/光照/挖掘/贴图属性集中在此定义。
 * 注册顺序即 ID 顺序（存档兼容依赖此顺序，新增方块请追加到末尾）。
 * ===================================================================== */
import { LAYER, SHAPE, TOOL, MATERIAL } from '../core/Constants.js';
import { DYE_COLORS } from './textures.js';

/** 全部方块，按 ID 索引 */
export const BLOCKS = [];
/** 名称 -> 方块 */
export const BLOCK_BY_NAME = new Map();

let nextId = 0;

/**
 * 注册一个方块
 * tex 可以是:
 *   'stone'                                  六面相同
 *   { all }                                  同上
 *   { top, bottom, side }                    经典三段
 *   { top, bottom, side, front }             front 用于 -Z 面
 *   { px, nx, py, ny, pz, nz }               精确六面
 */
function def(name, display, tex, opts = {}) {
  const id = nextId++;
  const tiles = resolveTiles(tex);
  const b = {
    id, name, display, tiles,
    layers: new Int32Array(6),      // 由 TextureAtlas 填充
    shape: opts.shape ?? SHAPE.CUBE,
    layer: opts.layer ?? LAYER.OPAQUE,
    solid: opts.solid ?? true,             // 是否阻挡移动
    opaque: opts.opaque ?? (opts.layer ?? LAYER.OPAQUE) === LAYER.OPAQUE,  // 是否完全遮光/剔除邻面
    fullCube: opts.fullCube ?? ((opts.shape ?? SHAPE.CUBE) === SHAPE.CUBE),
    opacity: opts.opacity ?? null,         // 光照衰减（null=自动）
    emission: opts.emission ?? 0,          // 自发光 0..15
    hardness: opts.hardness ?? 1,          // 挖掘硬度（秒·系数）
    tool: opts.tool ?? TOOL.NONE,          // 高效工具
    requiresTool: opts.requiresTool ?? false,
    material: opts.material ?? MATERIAL.STONE,
    liquid: opts.liquid ?? false,
    climbable: opts.climbable ?? false,
    replaceable: opts.replaceable ?? false, // 可被放置覆盖（草、水）
    cullSame: opts.cullSame ?? true,        // 相邻同种方块是否剔除接触面
    drops: opts.drops ?? name,              // 掉落物名（null 表示无掉落）
    dropCount: opts.dropCount ?? 1,
    tint: opts.tint ?? null,
    gravity: opts.gravity ?? false,         // 沙砾下落
    flammable: opts.flammable ?? false,
    slipperiness: opts.slipperiness ?? 0,
    walkSound: opts.walkSound ?? opts.material ?? MATERIAL.STONE,
    hidden: opts.hidden ?? false,           // 不出现在创造物品栏
    group: opts.group ?? 'building',        // 创造物品栏分类
    height: opts.height ?? 1,               // 碰撞/渲染高度（液体 0.9）
  };
  if (b.opacity === null) b.opacity = b.opaque ? 15 : 0;
  BLOCKS[id] = b;
  BLOCK_BY_NAME.set(name, b);
  return b;
}

function resolveTiles(tex) {
  if (typeof tex === 'string') return [tex, tex, tex, tex, tex, tex];
  if (!tex) return ['stone', 'stone', 'stone', 'stone', 'stone', 'stone'];
  if (tex.all) return [tex.all, tex.all, tex.all, tex.all, tex.all, tex.all];
  const side = tex.side ?? tex.all ?? 'stone';
  const top = tex.top ?? side;
  const bottom = tex.bottom ?? top;
  const out = [
    tex.px ?? side, tex.nx ?? side,
    tex.py ?? top, tex.ny ?? bottom,
    tex.pz ?? side, tex.nz ?? tex.front ?? side,
  ];
  return out;
}

/* ==================================================================== *
 *  0 — 空气
 * ==================================================================== */
def('air', '空气', null, {
  shape: SHAPE.CUBE, layer: LAYER.OPAQUE, solid: false, opaque: false, fullCube: false,
  replaceable: true, drops: null, hidden: true, hardness: 0,
});

/* ==================================================================== *
 *  石头族
 * ==================================================================== */
def('stone', '石头', 'stone', { hardness: 1.5, tool: TOOL.PICKAXE, requiresTool: true, drops: 'cobblestone', material: MATERIAL.STONE });
def('granite', '花岗岩', 'granite', { hardness: 1.5, tool: TOOL.PICKAXE, requiresTool: true });
def('diorite', '闪长岩', 'diorite', { hardness: 1.5, tool: TOOL.PICKAXE, requiresTool: true });
def('andesite', '安山岩', 'andesite', { hardness: 1.5, tool: TOOL.PICKAXE, requiresTool: true });
def('cobblestone', '圆石', 'cobblestone', { hardness: 2, tool: TOOL.PICKAXE, requiresTool: true });
def('mossy_cobblestone', '苔石', 'mossy_cobblestone', { hardness: 2, tool: TOOL.PICKAXE, requiresTool: true });
def('stone_bricks', '石砖', 'stone_bricks', { hardness: 1.5, tool: TOOL.PICKAXE, requiresTool: true });
def('smooth_stone', '平滑石头', 'smooth_stone', { hardness: 2, tool: TOOL.PICKAXE, requiresTool: true });
def('bricks', '红砖块', 'bricks', { hardness: 2, tool: TOOL.PICKAXE, requiresTool: true });
def('bedrock', '基岩', 'bedrock', { hardness: -1, drops: null, tool: TOOL.NONE });
def('obsidian', '黑曜石', 'obsidian', { hardness: 25, tool: TOOL.PICKAXE, requiresTool: true });
def('netherrack', '下界岩', 'netherrack', { hardness: 0.4, tool: TOOL.PICKAXE, requiresTool: true });
def('glowstone', '荧石', 'glowstone', { hardness: 0.3, emission: 15, group: 'light' });
def('terracotta', '陶瓦', 'terracotta', { hardness: 1.25, tool: TOOL.PICKAXE, requiresTool: true });
def('clay', '黏土', 'clay', { hardness: 0.6, tool: TOOL.SHOVEL, material: MATERIAL.DIRT, drops: 'clay_ball', dropCount: 4 });

/* ==================================================================== *
 *  土壤族
 * ==================================================================== */
def('grass_block', '草方块', { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
  { hardness: 0.6, tool: TOOL.SHOVEL, material: MATERIAL.GRASS, drops: 'dirt', group: 'nature' });
def('dirt', '泥土', 'dirt', { hardness: 0.5, tool: TOOL.SHOVEL, material: MATERIAL.DIRT, group: 'nature' });
def('coarse_dirt', '砂土', 'coarse_dirt', { hardness: 0.5, tool: TOOL.SHOVEL, material: MATERIAL.DIRT, group: 'nature' });
def('podzol', '灰化土', { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' },
  { hardness: 0.5, tool: TOOL.SHOVEL, material: MATERIAL.DIRT, group: 'nature' });
def('mycelium', '菌丝体', { top: 'mycelium', bottom: 'dirt', side: 'podzol_side' },
  { hardness: 0.6, tool: TOOL.SHOVEL, material: MATERIAL.DIRT, drops: 'dirt', group: 'nature' });
def('grass_block_snowy', '积雪草方块', { top: 'snow', bottom: 'dirt', side: 'grass_side' },
  { hardness: 0.6, tool: TOOL.SHOVEL, material: MATERIAL.GRASS, drops: 'dirt', group: 'nature' });
def('farmland', '耕地', { top: 'farmland', bottom: 'dirt', side: 'dirt' },
  { hardness: 0.6, tool: TOOL.SHOVEL, material: MATERIAL.DIRT, drops: 'dirt', group: 'nature' });
def('sand', '沙子', 'sand', { hardness: 0.5, tool: TOOL.SHOVEL, material: MATERIAL.SAND, gravity: true, group: 'nature' });
def('red_sand', '红沙', 'red_sand', { hardness: 0.5, tool: TOOL.SHOVEL, material: MATERIAL.SAND, gravity: true, group: 'nature' });
def('sandstone', '砂岩', { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone_side' },
  { hardness: 0.8, tool: TOOL.PICKAXE, requiresTool: true });
def('gravel', '沙砾', 'gravel', { hardness: 0.6, tool: TOOL.SHOVEL, material: MATERIAL.GRAVEL, gravity: true, group: 'nature' });
def('snow_block', '雪块', 'snow', { hardness: 0.2, tool: TOOL.SHOVEL, material: MATERIAL.SNOW, group: 'nature' });

/* ==================================================================== *
 *  木族
 * ==================================================================== */
const WOODS = [
  ['oak', '橡木', 'oak_log', 'oak_log_top', 'oak_planks', 'oak_leaves'],
  ['birch', '白桦', 'birch_log', 'birch_log_top', 'birch_planks', 'birch_leaves'],
  ['spruce', '云杉', 'spruce_log', 'spruce_log_top', 'spruce_planks', 'spruce_leaves'],
  ['jungle', '丛林', 'jungle_log', 'oak_log_top', 'jungle_planks', 'jungle_leaves'],
];
for (const [key, cn, logSide, logTop, planks, leaves] of WOODS) {
  def(`${key}_log`, `${cn}原木`, { top: logTop, bottom: logTop, side: logSide },
    { hardness: 2, tool: TOOL.AXE, material: MATERIAL.WOOD, flammable: true, group: 'nature' });
  def(`${key}_planks`, `${cn}木板`, planks,
    { hardness: 2, tool: TOOL.AXE, material: MATERIAL.WOOD, flammable: true });
  def(`${key}_leaves`, `${cn}树叶`, leaves, {
    hardness: 0.2, tool: TOOL.SHEARS, layer: LAYER.CUTOUT, opaque: false, opacity: 1,
    material: MATERIAL.PLANT, cullSame: false, flammable: true, group: 'nature',
    drops: `${key}_sapling`, dropCount: 1,
  });
  def(`${key}_sapling`, `${cn}树苗`, 'sapling_oak', {
    shape: SHAPE.CROSS, layer: LAYER.CUTOUT, solid: false, opaque: false, fullCube: false,
    hardness: 0, material: MATERIAL.PLANT, group: 'nature',
  });
}

/* ==================================================================== *
 *  矿石与矿物块
 * ==================================================================== */
def('coal_ore', '煤矿石', 'coal_ore', { hardness: 3, tool: TOOL.PICKAXE, requiresTool: true, drops: 'coal', group: 'ore' });
def('iron_ore', '铁矿石', 'iron_ore', { hardness: 3, tool: TOOL.PICKAXE, requiresTool: true, group: 'ore' });
def('copper_ore', '铜矿石', 'copper_ore', { hardness: 3, tool: TOOL.PICKAXE, requiresTool: true, group: 'ore' });
def('gold_ore', '金矿石', 'gold_ore', { hardness: 3, tool: TOOL.PICKAXE, requiresTool: true, group: 'ore' });
def('diamond_ore', '钻石矿石', 'diamond_ore', { hardness: 3, tool: TOOL.PICKAXE, requiresTool: true, drops: 'diamond', group: 'ore' });
def('emerald_ore', '绿宝石矿石', 'emerald_ore', { hardness: 3, tool: TOOL.PICKAXE, requiresTool: true, drops: 'emerald', group: 'ore' });
def('lapis_ore', '青金石矿石', 'lapis_ore', { hardness: 3, tool: TOOL.PICKAXE, requiresTool: true, drops: 'lapis_lazuli', dropCount: 6, group: 'ore' });
def('redstone_ore', '红石矿石', 'redstone_ore', { hardness: 3, tool: TOOL.PICKAXE, requiresTool: true, drops: 'redstone', dropCount: 4, group: 'ore' });
def('iron_block', '铁块', 'iron_block', { hardness: 5, tool: TOOL.PICKAXE, requiresTool: true, material: MATERIAL.METAL, group: 'ore' });
def('gold_block', '金块', 'gold_block', { hardness: 3, tool: TOOL.PICKAXE, requiresTool: true, material: MATERIAL.METAL, group: 'ore' });
def('diamond_block', '钻石块', 'diamond_block', { hardness: 5, tool: TOOL.PICKAXE, requiresTool: true, material: MATERIAL.METAL, group: 'ore' });
def('emerald_block', '绿宝石块', 'emerald_block', { hardness: 5, tool: TOOL.PICKAXE, requiresTool: true, material: MATERIAL.METAL, group: 'ore' });
def('lapis_block', '青金石块', 'lapis_block', { hardness: 3, tool: TOOL.PICKAXE, requiresTool: true, group: 'ore' });
def('redstone_block', '红石块', 'redstone_block', { hardness: 5, tool: TOOL.PICKAXE, requiresTool: true, group: 'ore' });
def('coal_block', '煤炭块', 'coal_block', { hardness: 5, tool: TOOL.PICKAXE, requiresTool: true, group: 'ore' });

/* ==================================================================== *
 *  液体
 * ==================================================================== */
def('water', '水', 'water_still', {
  shape: SHAPE.LIQUID, layer: LAYER.TRANSLUCENT, solid: false, opaque: false, fullCube: false,
  opacity: 2, liquid: true, replaceable: true, hardness: -1, drops: null,
  material: MATERIAL.LIQUID, height: 0.88, group: 'misc',
});
def('lava', '岩浆', 'lava_still', {
  shape: SHAPE.LIQUID, layer: LAYER.TRANSLUCENT, solid: false, opaque: false, fullCube: false,
  opacity: 0, emission: 15, liquid: true, replaceable: true, hardness: -1, drops: null,
  material: MATERIAL.LIQUID, height: 0.88, group: 'misc',
});
def('ice', '冰', 'ice', {
  layer: LAYER.TRANSLUCENT, opaque: false, opacity: 1, hardness: 0.5,
  tool: TOOL.PICKAXE, slipperiness: 0.98, drops: null, material: MATERIAL.GLASS, group: 'nature',
});
def('packed_ice', '浮冰', 'packed_ice', { hardness: 0.5, tool: TOOL.PICKAXE, slipperiness: 0.98, group: 'nature' });

/* ==================================================================== *
 *  玻璃与装饰
 * ==================================================================== */
def('glass', '玻璃', 'glass', {
  layer: LAYER.CUTOUT, opaque: false, opacity: 0, hardness: 0.3,
  material: MATERIAL.GLASS, drops: null,
});
def('tinted_glass', '染色玻璃', 'glass_tinted', {
  layer: LAYER.TRANSLUCENT, opaque: false, opacity: 3, hardness: 0.3, material: MATERIAL.GLASS,
});
def('bookshelf', '书架', { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' },
  { hardness: 1.5, tool: TOOL.AXE, material: MATERIAL.WOOD, flammable: true, drops: 'book', dropCount: 3 });
def('crafting_table', '工作台', {
  top: 'crafting_table_top', bottom: 'oak_planks',
  px: 'crafting_table_side', nx: 'crafting_table_side',
  pz: 'crafting_table_side', nz: 'crafting_table_front',
}, { hardness: 2.5, tool: TOOL.AXE, material: MATERIAL.WOOD, flammable: true, group: 'redstone' });
def('furnace', '熔炉', {
  top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front',
}, { hardness: 3.5, tool: TOOL.PICKAXE, requiresTool: true, group: 'redstone' });
def('furnace_lit', '燃烧的熔炉', {
  top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front_lit',
}, { hardness: 3.5, tool: TOOL.PICKAXE, requiresTool: true, emission: 13, drops: 'furnace', hidden: true });
def('chest', '箱子', {
  top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front',
}, { hardness: 2.5, tool: TOOL.AXE, material: MATERIAL.WOOD, flammable: true, group: 'redstone' });
def('jukebox', '唱片机', { top: 'jukebox_top', bottom: 'jukebox_side', side: 'jukebox_side' },
  { hardness: 2, tool: TOOL.AXE, material: MATERIAL.WOOD, group: 'redstone' });
def('tnt', 'TNT', { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' },
  { hardness: 0, group: 'redstone' });
def('bricks_hay', '干草捆', { top: 'hay_top', bottom: 'hay_top', side: 'hay_side' },
  { hardness: 0.5, material: MATERIAL.PLANT, group: 'nature' });
def('sponge', '海绵', 'sponge', { hardness: 0.6, material: MATERIAL.WOOL, group: 'misc' });
def('torch', '火把', 'torch', {
  shape: SHAPE.TORCH, layer: LAYER.CUTOUT, solid: false, opaque: false, fullCube: false,
  emission: 14, hardness: 0, material: MATERIAL.WOOD, group: 'light',
});
def('ladder', '梯子', 'ladder', {
  shape: SHAPE.PANE, layer: LAYER.CUTOUT, solid: false, opaque: false, fullCube: false,
  climbable: true, hardness: 0.4, material: MATERIAL.WOOD, group: 'redstone',
});
def('cactus', '仙人掌', { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, {
  shape: SHAPE.CACTUS, layer: LAYER.CUTOUT, opaque: false, opacity: 15,
  hardness: 0.4, material: MATERIAL.PLANT, group: 'nature',
});
def('pumpkin', '南瓜', { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side' },
  { hardness: 1, tool: TOOL.AXE, material: MATERIAL.PLANT, group: 'nature' });
def('carved_pumpkin', '雕刻南瓜', {
  top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face',
}, { hardness: 1, tool: TOOL.AXE, material: MATERIAL.PLANT, group: 'nature' });
def('jack_o_lantern', '南瓜灯', {
  top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face',
}, { hardness: 1, tool: TOOL.AXE, emission: 15, material: MATERIAL.PLANT, group: 'light' });
def('melon', '西瓜', { top: 'melon_top', bottom: 'melon_top', side: 'melon_side' },
  { hardness: 1, tool: TOOL.AXE, material: MATERIAL.PLANT, group: 'nature' });

/* ==================================================================== *
 *  植物（十字渲染）
 * ==================================================================== */
const CROSS = {
  shape: SHAPE.CROSS, layer: LAYER.CUTOUT, solid: false, opaque: false, fullCube: false,
  hardness: 0, material: MATERIAL.PLANT, replaceable: true, group: 'nature', cullSame: false,
};
def('tall_grass', '草', 'tall_grass', { ...CROSS, drops: null });
def('fern', '蕨', 'fern', { ...CROSS, drops: null });
def('dead_bush', '枯萎的灌木', 'dead_bush', { ...CROSS, drops: 'stick' });
def('dandelion', '蒲公英', 'flower_dandelion', CROSS);
def('poppy', '玫瑰', 'flower_poppy', CROSS);
def('blue_orchid', '兰花', 'flower_blue', CROSS);
def('red_mushroom', '红色蘑菇', 'mushroom_red', CROSS);
def('brown_mushroom', '棕色蘑菇', 'mushroom_brown', { ...CROSS, emission: 1 });
def('sugar_cane', '甘蔗', 'sugar_cane', CROSS);
def('wheat_crop', '小麦', 'wheat', { ...CROSS, drops: 'wheat', hidden: true });
def('vine', '藤蔓', 'vine', {
  shape: SHAPE.PANE, layer: LAYER.CUTOUT, solid: false, opaque: false, fullCube: false,
  hardness: 0.2, material: MATERIAL.PLANT, climbable: true, group: 'nature', cullSame: false,
});
def('lily_pad', '睡莲', 'lily_pad', {
  shape: SHAPE.FARMLAND, layer: LAYER.CUTOUT, solid: false, opaque: false, fullCube: false,
  hardness: 0, material: MATERIAL.PLANT, group: 'nature', height: 0.06,
});

/* ==================================================================== *
 *  羊毛 / 混凝土 16 色
 * ==================================================================== */
const DYE_CN = {
  white: '白色', orange: '橙色', magenta: '品红色', light_blue: '淡蓝色', yellow: '黄色',
  lime: '黄绿色', pink: '粉红色', gray: '灰色', light_gray: '淡灰色', cyan: '青色',
  purple: '紫色', blue: '蓝色', brown: '棕色', green: '绿色', red: '红色', black: '黑色',
};
for (const key of Object.keys(DYE_COLORS)) {
  def(`${key}_wool`, `${DYE_CN[key]}羊毛`, `wool_${key}`,
    { hardness: 0.8, tool: TOOL.SHEARS, material: MATERIAL.WOOL, flammable: true, group: 'color' });
}
for (const key of Object.keys(DYE_COLORS)) {
  def(`${key}_concrete`, `${DYE_CN[key]}混凝土`, `concrete_${key}`,
    { hardness: 1.8, tool: TOOL.PICKAXE, requiresTool: true, group: 'color' });
}

/* ==================================================================== *
 *  便捷常量与工具函数
 * ==================================================================== */
export const ID = {};
for (const b of BLOCKS) ID[b.name.toUpperCase()] = b.id;

export const AIR = ID.AIR;
export const BLOCK_COUNT = BLOCKS.length;

export function getBlock(id) { return BLOCKS[id] || BLOCKS[0]; }
export function blockByName(name) { return BLOCK_BY_NAME.get(name) || null; }
export function idByName(name) { const b = BLOCK_BY_NAME.get(name); return b ? b.id : -1; }

/** 预计算的快速查询表（热路径使用，避免属性查找） */
export const IS_OPAQUE = new Uint8Array(BLOCK_COUNT);
export const IS_SOLID = new Uint8Array(BLOCK_COUNT);
export const IS_LIQUID = new Uint8Array(BLOCK_COUNT);
export const IS_FULL_CUBE = new Uint8Array(BLOCK_COUNT);
export const IS_REPLACEABLE = new Uint8Array(BLOCK_COUNT);
export const OPACITY = new Uint8Array(BLOCK_COUNT);
export const EMISSION = new Uint8Array(BLOCK_COUNT);
export const RENDER_LAYER = new Uint8Array(BLOCK_COUNT);
export const SHAPE_OF = new Uint8Array(BLOCK_COUNT);
export const CULL_SAME = new Uint8Array(BLOCK_COUNT);
export const HEIGHT_OF = new Float32Array(BLOCK_COUNT);
export const SLIPPERINESS = new Float32Array(BLOCK_COUNT);

for (const b of BLOCKS) {
  IS_OPAQUE[b.id] = b.opaque ? 1 : 0;
  IS_SOLID[b.id] = b.solid ? 1 : 0;
  IS_LIQUID[b.id] = b.liquid ? 1 : 0;
  IS_FULL_CUBE[b.id] = b.fullCube ? 1 : 0;
  IS_REPLACEABLE[b.id] = b.replaceable ? 1 : 0;
  OPACITY[b.id] = b.opacity;
  EMISSION[b.id] = b.emission;
  RENDER_LAYER[b.id] = b.layer;
  SHAPE_OF[b.id] = b.shape;
  CULL_SAME[b.id] = b.cullSame ? 1 : 0;
  HEIGHT_OF[b.id] = b.height;
  SLIPPERINESS[b.id] = b.slipperiness;
}

/** 创造模式物品栏分组顺序 */
export const CREATIVE_GROUPS = [
  { key: 'building', label: '建筑方块' },
  { key: 'nature', label: '自然' },
  { key: 'ore', label: '矿物' },
  { key: 'color', label: '色彩' },
  { key: 'redstone', label: '功能' },
  { key: 'light', label: '光源' },
  { key: 'tool', label: '工具与武器' },
  { key: 'food', label: '食物' },
  { key: 'misc', label: '杂项' },
];
