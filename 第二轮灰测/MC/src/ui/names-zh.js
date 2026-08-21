/**
 * ui/names-zh.js
 * ------------------------------------------------------------------
 * Simplified Chinese display names for every block and item.
 *
 * Keys are the registry's canonical English names, which never change:
 * commands, recipes and save files all continue to use them, so switching
 * language cannot break `/give oak_planks` or invalidate a world.
 *
 * Names follow the official Chinese Minecraft translation where one
 * exists, so they read the way players expect.
 */

/** Colour prefixes shared by wool and concrete. */
const COLOURS = {
  white: '白色', orange: '橙色', magenta: '品红色', light_blue: '淡蓝色',
  yellow: '黄色', lime: '黄绿色', pink: '粉红色', gray: '灰色',
  light_gray: '淡灰色', cyan: '青色', purple: '紫色', blue: '蓝色',
  brown: '棕色', green: '绿色', red: '红色', black: '黑色',
};

/** Wood species, shared by logs, planks, leaves and saplings. */
const WOODS = {
  oak: '橡木', birch: '白桦', spruce: '云杉', jungle: '丛林',
  acacia: '金合欢', dark_oak: '深色橡木',
};

/** Tool and armour materials. */
const MATERIALS = {
  wooden: '木', stone: '石', iron: '铁', golden: '金', diamond: '钻石',
  leather: '皮革',
};

const TOOLS = { pickaxe: '镐', axe: '斧', shovel: '锹', hoe: '锄', sword: '剑' };
const ARMOUR = { helmet: '头盔', chestplate: '胸甲', leggings: '护腿', boots: '靴子' };

/** @type {Record<string, string>} */
export const NAMES_ZH = {
  /* ---- stone family ---- */
  stone: '石头',
  granite: '花岗岩',
  diorite: '闪长岩',
  andesite: '安山岩',
  polished_granite: '磨制花岗岩',
  polished_diorite: '磨制闪长岩',
  polished_andesite: '磨制安山岩',
  cobblestone: '圆石',
  mossy_cobblestone: '苔石',
  smooth_stone: '平滑石头',
  stone_bricks: '石砖',
  cracked_stone_bricks: '裂纹石砖',
  mossy_stone_bricks: '苔石砖',
  chiseled_stone_bricks: '錾制石砖',
  bedrock: '基岩',
  obsidian: '黑曜石',

  /* ---- soil and surface ---- */
  dirt: '泥土',
  coarse_dirt: '砂土',
  grass_block: '草方块',
  snowy_grass_block: '积雪的草方块',
  podzol: '灰化土',
  mycelium: '菌丝体',
  farmland: '耕地',
  farmland_moist: '湿润的耕地',
  sand: '沙子',
  red_sand: '红沙',
  gravel: '沙砾',
  clay: '黏土块',
  sandstone: '砂岩',
  chiseled_sandstone: '錾制砂岩',
  cut_sandstone: '切制砂岩',
  red_sandstone: '红砂岩',
  snow_block: '雪块',
  ice: '冰',
  packed_ice: '浮冰',
  blue_ice: '蓝冰',

  /* ---- wood ---- */
  stripped_oak_log: '去皮橡木',
  bookshelf: '书架',
  crafting_table: '工作台',
  furnace: '熔炉',
  furnace_lit: '熔炉',
  note_block: '音符盒',
  jukebox: '唱片机',
  ladder: '梯子',

  /* ---- ores and mineral blocks ---- */
  coal_ore: '煤矿石',
  iron_ore: '铁矿石',
  gold_ore: '金矿石',
  diamond_ore: '钻石矿石',
  emerald_ore: '绿宝石矿石',
  lapis_ore: '青金石矿石',
  redstone_ore: '红石矿石',
  nether_quartz_ore: '下界石英矿石',
  coal_block: '煤炭块',
  iron_block: '铁块',
  gold_block: '金块',
  diamond_block: '钻石块',
  emerald_block: '绿宝石块',
  lapis_block: '青金石块',
  redstone_block: '红石块',

  /* ---- decoration ---- */
  bricks: '砖块',
  tnt: 'TNT',
  glass: '玻璃',
  white_stained_glass: '白色染色玻璃',
  light_blue_stained_glass: '淡蓝色染色玻璃',
  sponge: '海绵',
  wet_sponge: '湿海绵',
  glowstone: '荧石',
  sea_lantern: '海晶灯',
  quartz_block: '石英块',
  chiseled_quartz_block: '錾制石英块',
  prismarine: '海晶石',
  prismarine_bricks: '海晶石砖',
  dark_prismarine: '暗海晶石',
  hay_block: '干草捆',
  melon: '西瓜',
  pumpkin: '南瓜',
  carved_pumpkin: '雕刻南瓜',
  jack_o_lantern: '南瓜灯',
  cactus: '仙人掌',
  netherrack: '下界岩',
  nether_bricks: '下界砖块',
  soul_sand: '灵魂沙',
  magma: '岩浆块',
  end_stone: '末地石',
  purpur_block: '紫珀块',
  terracotta: '陶瓦',
  slime_block: '黏液块',
  honeycomb_block: '蜜脾块',

  /* ---- plants ---- */
  short_grass: '草',
  fern: '蕨',
  tall_grass: '高草丛',
  dead_bush: '枯萎的灌木',
  sugar_cane: '甘蔗',
  red_mushroom: '红色蘑菇',
  brown_mushroom: '棕色蘑菇',
  poppy: '虞美人',
  dandelion: '蒲公英',
  blue_orchid: '兰花',
  allium: '绒球葱',
  azure_bluet: '蓝花美耳草',
  oxeye_daisy: '滨菊',
  cornflower: '矢车菊',
  lily_of_the_valley: '铃兰',
  orange_tulip: '橙色郁金香',
  pink_tulip: '粉红色郁金香',
  red_tulip: '红色郁金香',
  white_tulip: '白色郁金香',
  torch: '火把',
  redstone_torch: '红石火把',
  lantern: '灯笼',

  /* ---- fluids ---- */
  water: '水',
  lava: '岩浆',

  /* ---- tools and utility ---- */
  shears: '剪刀',
  flint_and_steel: '打火石',
  bucket: '桶',
  water_bucket: '水桶',
  lava_bucket: '岩浆桶',
  clock: '钟',
  bow: '弓',
  arrow: '箭',

  /* ---- food ---- */
  apple: '苹果',
  bread: '面包',
  porkchop: '生猪排',
  cooked_porkchop: '熟猪排',
  beef: '生牛肉',
  cooked_beef: '牛排',
  chicken: '生鸡肉',
  cooked_chicken: '熟鸡肉',
  mutton: '生羊肉',
  cooked_mutton: '熟羊肉',
  mushroom_stew: '蘑菇煲',
  rotten_flesh: '腐肉',
  melon_slice: '西瓜片',

  /* ---- materials ---- */
  stick: '木棍',
  bowl: '碗',
  coal: '煤炭',
  charcoal: '木炭',
  iron_ingot: '铁锭',
  gold_ingot: '金锭',
  iron_nugget: '铁粒',
  gold_nugget: '金粒',
  diamond: '钻石',
  emerald: '绿宝石',
  lapis_lazuli: '青金石',
  redstone: '红石',
  quartz: '下界石英',
  flint: '燧石',
  clay_ball: '黏土球',
  brick: '红砖',
  gunpowder: '火药',
  feather: '羽毛',
  leather: '皮革',
  string: '线',
  bone: '骨头',
  egg: '鸡蛋',
  slime_ball: '黏液球',
  sugar: '糖',
  paper: '纸',
  book: '书',
  wheat: '小麦',
  wheat_seeds: '小麦种子',
  snowball: '雪球',
  ender_pearl: '末影珍珠',
  blaze_rod: '烈焰棒',
  painting: '画',
  oak_boat: '橡木船',
};

/* ------------------------------------------------------------------ */
/* generated families                                                 */
/* ------------------------------------------------------------------ */

// Wool and concrete: 16 colours each.
for (const [key, colour] of Object.entries(COLOURS)) {
  NAMES_ZH[`${key}_wool`] = `${colour}羊毛`;
  NAMES_ZH[`${key}_concrete`] = `${colour}混凝土`;
}

// Logs, planks, leaves and saplings for each wood species.
for (const [key, wood] of Object.entries(WOODS)) {
  NAMES_ZH[`${key}_log`] = `${wood}原木`;
  NAMES_ZH[`${key}_planks`] = `${wood}木板`;
  NAMES_ZH[`${key}_leaves`] = `${wood}树叶`;
  NAMES_ZH[`${key}_sapling`] = `${wood}树苗`;
}

// Tools and armour for each material.
for (const [key, material] of Object.entries(MATERIALS)) {
  for (const [tool, name] of Object.entries(TOOLS)) {
    NAMES_ZH[`${key}_${tool}`] = `${material}${name}`;
  }
  for (const [piece, name] of Object.entries(ARMOUR)) {
    NAMES_ZH[`${key}_${piece}`] = `${material}${name}`;
  }
}

// Wheat growth stages all read as one crop.
for (let i = 0; i < 8; i++) NAMES_ZH[`wheat_stage${i}`] = '小麦';

/** Mob names, used by /summon feedback. */
export const MOB_NAMES_ZH = {
  pig: '猪', cow: '牛', sheep: '羊', chicken: '鸡',
  zombie: '僵尸', creeper: '苦力怕', skeleton: '骷髅',
};

/** Biome display names. */
export const BIOME_NAMES_ZH = {
  deep_ocean: '深海', ocean: '海洋', frozen_ocean: '冻洋', river: '河流',
  beach: '沙滩', stony_shore: '石岸', plains: '平原',
  sunflower_plains: '向日葵平原', forest: '森林', birch_forest: '白桦森林',
  dark_forest: '黑森林', swamp: '沼泽', taiga: '针叶林',
  snowy_taiga: '积雪针叶林', snowy_plains: '雪原',
  windswept_hills: '风袭丘陵', snowy_slopes: '积雪山坡',
  jagged_peaks: '尖峭山峰', desert: '沙漠', savanna: '热带草原',
  badlands: '恶地', jungle: '丛林',
};

/** Weather names for /weather feedback. */
export const WEATHER_NAMES_ZH = { clear: '晴朗', rain: '下雨', snow: '下雪' };
