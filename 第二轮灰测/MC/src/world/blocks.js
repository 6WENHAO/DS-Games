/**
 * world/blocks.js
 * ------------------------------------------------------------------
 * The block registry: every block type, its textures, how it renders,
 * how it behaves physically, how long it takes to mine and what it
 * drops. This is the single source of truth for block content and is
 * imported by the mesher, the lighting engine, physics and the UI.
 *
 * Values (hardness, light levels, tool requirements) follow vanilla
 * Minecraft so mining feels right.
 *
 * Block ids are assigned in registration order and stored in a
 * Uint16Array per chunk, so there is plenty of headroom.
 */

import { MODEL, PASS, TINT } from './constants.js';

/* ------------------------------------------------------------------ */
/* tool + sound taxonomy                                              */
/* ------------------------------------------------------------------ */

/** Tool classes; `null` means "any tool / bare hand is fine". */
export const TOOL = {
  NONE: null,
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
  HOE: 'hoe',
  SHEARS: 'shears',
  SWORD: 'sword',
};

/**
 * Harvest tiers, matching vanilla material levels. A block with
 * `tier: 2` needs at least an iron tool to drop anything.
 */
export const TIER = { HAND: 0, WOOD: 0, STONE: 1, IRON: 2, DIAMOND: 3 };

/** Sound groups map onto the sound files in assets/sounds/. */
export const SOUND = {
  GRASS: 'grass',
  STONE: 'stone',
  WOOD: 'wood',
  SAND: 'sand',
  GRAVEL: 'gravel',
  GLASS: 'glass',
  WOOL: 'wool',
  SNOW: 'snow',
};

/* ------------------------------------------------------------------ */
/* registry                                                           */
/* ------------------------------------------------------------------ */

/** @typedef {ReturnType<typeof makeBlock>} BlockDef */

/** Ordered list of block definitions; index === block id. */
export const blocks = [];
/** name -> BlockDef */
export const blocksByName = new Map();

let nextId = 0;

/**
 * Normalises a face texture spec into a 6-entry array ordered
 * [+X, -X, +Y, -Y, +Z, -Z].
 */
function resolveFaces(spec) {
  if (typeof spec === 'string') return [spec, spec, spec, spec, spec, spec];
  if (Array.isArray(spec)) return spec.slice(0, 6);
  const side = spec.side ?? spec.all ?? 'stone';
  const top = spec.top ?? spec.all ?? side;
  const bottom = spec.bottom ?? spec.all ?? top;
  return [
    spec.east ?? spec.front ?? side,
    spec.west ?? side,
    top,
    bottom,
    spec.south ?? side,
    spec.north ?? side,
  ];
}

/** Fills in defaults for a block definition. */
function makeBlock(name, options) {
  const {
    textures = name,
    model = MODEL.CUBE,
    displayName,
    // rendering
    pass = PASS.OPAQUE,
    tint = TINT.NONE,
    // physics / light
    solid = model === MODEL.CUBE,
    collides = solid,
    opaque = model === MODEL.CUBE && pass === PASS.OPAQUE,
    lightLevel = 0,
    lightFilter = opaque ? 15 : 0,
    replaceable = false,
    liquid = false,
    climbable = false,
    gravity = false,
    // gameplay
    hardness = 1,
    tool = TOOL.NONE,
    tier = TIER.HAND,
    /**
     * Whether the matching tool is *required* for the block to drop
     * anything, as opposed to merely being faster.
     *
     * Vanilla only gates pickaxe blocks this way: stone and ores need a
     * pickaxe, while dirt, sand, wood and wool drop happily to bare
     * hands even though a shovel/axe/shears is quicker.
     */
    requiresTool = tool === TOOL.PICKAXE,
    drops,
    dropCount = 1,
    dropChance = 1,
    fuel = 0,
    sound = SOUND.STONE,
    sway = 0,
    // texture variant behaviour
    sideVariant = null,   // 'grass' -> per-biome composited side texture
    flatShade = model === MODEL.CROSS || model === MODEL.TORCH,
    /**
     * Whether a face between two blocks of this same type is culled.
     * Vanilla culls glass-to-glass but keeps leaf-to-leaf faces so
     * canopies stay dense in fancy graphics mode.
     */
    cullSame = true,
    // liquid geometry
    liquidHeight = 0.875,
    // item form
    stackSize = 64,
    hidden = false,
  } = options ?? {};

  const id = nextId++;
  const def = {
    id,
    name,
    displayName: displayName ?? name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    model,
    pass,
    tint,
    faces: resolveFaces(textures),
    /** Filled in by gfx/textures.js once the atlas exists. */
    faceLayers: new Int16Array(6).fill(-1),
    /** Per-biome side layers for grass-like blocks (filled in later). */
    variantLayers: null,
    sideVariant,
    solid,
    collides,
    opaque,
    cullSame,
    /** Animation group id, assigned by gfx/textures.js. */
    animGroup: 0,
    /** Snowy grass side layer, assigned by gfx/textures.js. */
    snowVariantLayer: -1,
    lightLevel,
    lightFilter,
    replaceable,
    liquid,
    climbable,
    gravity,
    hardness,
    tool,
    tier,
    requiresTool,
    drops: drops === undefined ? name : drops,
    dropCount,
    dropChance,
    fuel,
    sound,
    sway,
    flatShade,
    liquidHeight,
    stackSize,
    hidden,
    /** True when the block never contributes geometry. */
    isAir: model === MODEL.AIR,
  };
  blocks.push(def);
  blocksByName.set(name, def);
  return def;
}

/** Shorthand used by the definition table below. */
const def = (name, options) => makeBlock(name, options).id;

/* ------------------------------------------------------------------ */
/* block definitions                                                  */
/* ------------------------------------------------------------------ */

/**
 * Numeric block ids. Registration order defines the values, so keep
 * `AIR` first (id 0) - the chunk arrays are zero-filled.
 */
export const B = {};

B.AIR = def('air', {
  model: MODEL.AIR, textures: 'stone', solid: false, collides: false, opaque: false,
  replaceable: true, hardness: 0, drops: null, hidden: true, displayName: 'Air',
});

/* --- stone family ------------------------------------------------- */
B.STONE = def('stone', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD, drops: 'cobblestone' });
B.GRANITE = def('granite', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.DIORITE = def('diorite', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.ANDESITE = def('andesite', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.POLISHED_GRANITE = def('polished_granite', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.POLISHED_DIORITE = def('polished_diorite', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.POLISHED_ANDESITE = def('polished_andesite', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.COBBLESTONE = def('cobblestone', { hardness: 2, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.MOSSY_COBBLESTONE = def('mossy_cobblestone', { hardness: 2, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.SMOOTH_STONE = def('smooth_stone', { hardness: 2, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.STONE_BRICKS = def('stone_bricks', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.CRACKED_STONE_BRICKS = def('cracked_stone_bricks', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.MOSSY_STONE_BRICKS = def('mossy_stone_bricks', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.CHISELED_STONE_BRICKS = def('chiseled_stone_bricks', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.BEDROCK = def('bedrock', { hardness: -1, drops: null });
B.OBSIDIAN = def('obsidian', { hardness: 50, tool: TOOL.PICKAXE, tier: TIER.DIAMOND });

/* --- soil / surface ---------------------------------------------- */
B.DIRT = def('dirt', { hardness: 0.5, tool: TOOL.SHOVEL, sound: SOUND.GRASS });
B.COARSE_DIRT = def('coarse_dirt', { hardness: 0.5, tool: TOOL.SHOVEL, sound: SOUND.GRASS });
B.GRASS_BLOCK = def('grass_block', {
  textures: { top: 'grass_block_top', side: 'grass_block_side', bottom: 'dirt' },
  tint: TINT.GRASS, sideVariant: 'grass',
  hardness: 0.6, tool: TOOL.SHOVEL, sound: SOUND.GRASS, drops: 'dirt',
});
B.SNOWY_GRASS_BLOCK = def('snowy_grass_block', {
  textures: { top: 'snow', side: 'grass_block_snow', bottom: 'dirt' },
  hardness: 0.6, tool: TOOL.SHOVEL, sound: SOUND.SNOW, drops: 'dirt',
  displayName: 'Snowy Grass Block',
});
B.PODZOL = def('podzol', {
  textures: { top: 'podzol_top', side: 'podzol_side', bottom: 'dirt' },
  hardness: 0.5, tool: TOOL.SHOVEL, sound: SOUND.GRASS, drops: 'dirt',
});
B.MYCELIUM = def('mycelium', {
  textures: { top: 'mycelium_top', side: 'mycelium_side', bottom: 'dirt' },
  hardness: 0.6, tool: TOOL.SHOVEL, sound: SOUND.GRASS, drops: 'dirt',
});
B.FARMLAND = def('farmland', {
  textures: { top: 'farmland', side: 'dirt', bottom: 'dirt' },
  hardness: 0.6, tool: TOOL.SHOVEL, sound: SOUND.GRASS, drops: 'dirt',
});
B.FARMLAND_MOIST = def('farmland_moist', {
  textures: { top: 'farmland_moist', side: 'dirt', bottom: 'dirt' },
  hardness: 0.6, tool: TOOL.SHOVEL, sound: SOUND.GRASS, drops: 'dirt', hidden: true,
});
B.SAND = def('sand', { hardness: 0.5, tool: TOOL.SHOVEL, sound: SOUND.SAND, gravity: true });
B.RED_SAND = def('red_sand', { hardness: 0.5, tool: TOOL.SHOVEL, sound: SOUND.SAND, gravity: true });
B.GRAVEL = def('gravel', { hardness: 0.6, tool: TOOL.SHOVEL, sound: SOUND.GRAVEL, gravity: true });
B.CLAY = def('clay', { hardness: 0.6, tool: TOOL.SHOVEL, sound: SOUND.GRAVEL, drops: 'clay_ball', dropCount: 4 });
B.SANDSTONE = def('sandstone', {
  textures: { top: 'sandstone_top', side: 'sandstone', bottom: 'sandstone_bottom' },
  hardness: 0.8, tool: TOOL.PICKAXE, tier: TIER.WOOD, sound: SOUND.STONE,
});
B.CHISELED_SANDSTONE = def('chiseled_sandstone', {
  textures: { top: 'sandstone_top', side: 'chiseled_sandstone', bottom: 'sandstone_bottom' },
  hardness: 0.8, tool: TOOL.PICKAXE, tier: TIER.WOOD,
});
B.CUT_SANDSTONE = def('cut_sandstone', {
  textures: { top: 'sandstone_top', side: 'cut_sandstone', bottom: 'sandstone_bottom' },
  hardness: 0.8, tool: TOOL.PICKAXE, tier: TIER.WOOD,
});
B.RED_SANDSTONE = def('red_sandstone', {
  textures: { top: 'red_sandstone_top', side: 'red_sandstone', bottom: 'red_sandstone_bottom' },
  hardness: 0.8, tool: TOOL.PICKAXE, tier: TIER.WOOD,
});
B.SNOW_BLOCK = def('snow_block', {
  textures: 'snow', hardness: 0.2, tool: TOOL.SHOVEL, sound: SOUND.SNOW, drops: 'snowball', dropCount: 4,
});
B.ICE = def('ice', {
  textures: 'ice', pass: PASS.TRANSLUCENT, opaque: false, lightFilter: 2,
  hardness: 0.5, tool: TOOL.PICKAXE, sound: SOUND.GLASS, drops: null,
});
B.PACKED_ICE = def('packed_ice', { hardness: 0.5, tool: TOOL.PICKAXE, sound: SOUND.GLASS, drops: null });
B.BLUE_ICE = def('blue_ice', { hardness: 2.8, tool: TOOL.PICKAXE, sound: SOUND.GLASS });

/* --- wood -------------------------------------------------------- */
const logBlock = (name, side, top) => def(name, {
  textures: { side, top, bottom: top },
  hardness: 2, tool: TOOL.AXE, sound: SOUND.WOOD, fuel: 300,
});
B.OAK_LOG = logBlock('oak_log', 'oak_log', 'oak_log_top');
B.BIRCH_LOG = logBlock('birch_log', 'birch_log', 'birch_log_top');
B.SPRUCE_LOG = logBlock('spruce_log', 'spruce_log', 'spruce_log_top');
B.JUNGLE_LOG = logBlock('jungle_log', 'jungle_log', 'jungle_log_top');
B.ACACIA_LOG = logBlock('acacia_log', 'acacia_log', 'acacia_log_top');
B.DARK_OAK_LOG = logBlock('dark_oak_log', 'dark_oak_log', 'dark_oak_log_top');
B.STRIPPED_OAK_LOG = logBlock('stripped_oak_log', 'stripped_oak_log', 'stripped_oak_log_top');

const plankBlock = (name) => def(name, {
  hardness: 2, tool: TOOL.AXE, sound: SOUND.WOOD, fuel: 300,
});
B.OAK_PLANKS = plankBlock('oak_planks');
B.BIRCH_PLANKS = plankBlock('birch_planks');
B.SPRUCE_PLANKS = plankBlock('spruce_planks');
B.JUNGLE_PLANKS = plankBlock('jungle_planks');
B.ACACIA_PLANKS = plankBlock('acacia_planks');
B.DARK_OAK_PLANKS = plankBlock('dark_oak_planks');

const leafBlock = (name, tex) => def(name, {
  textures: tex, pass: PASS.CUTOUT, opaque: false, lightFilter: 1, tint: TINT.FOLIAGE,
  hardness: 0.2, tool: TOOL.SHEARS, sound: SOUND.GRASS, drops: null, sway: 0.35,
  cullSame: false,
});
B.OAK_LEAVES = leafBlock('oak_leaves', 'oak_leaves');
B.BIRCH_LEAVES = leafBlock('birch_leaves', 'birch_leaves');
B.SPRUCE_LEAVES = leafBlock('spruce_leaves', 'spruce_leaves');
B.JUNGLE_LEAVES = leafBlock('jungle_leaves', 'jungle_leaves');
B.ACACIA_LEAVES = leafBlock('acacia_leaves', 'acacia_leaves');
B.DARK_OAK_LEAVES = leafBlock('dark_oak_leaves', 'dark_oak_leaves');

const saplingBlock = (name) => def(name, {
  model: MODEL.CROSS, pass: PASS.CUTOUT, solid: false, collides: false, opaque: false,
  hardness: 0, sound: SOUND.GRASS, sway: 0.5, replaceable: false,
});
B.OAK_SAPLING = saplingBlock('oak_sapling');
B.BIRCH_SAPLING = saplingBlock('birch_sapling');
B.SPRUCE_SAPLING = saplingBlock('spruce_sapling');
B.JUNGLE_SAPLING = saplingBlock('jungle_sapling');
B.ACACIA_SAPLING = saplingBlock('acacia_sapling');
B.DARK_OAK_SAPLING = saplingBlock('dark_oak_sapling');

B.BOOKSHELF = def('bookshelf', {
  textures: { side: 'bookshelf', top: 'oak_planks', bottom: 'oak_planks' },
  hardness: 1.5, tool: TOOL.AXE, sound: SOUND.WOOD, drops: 'book', dropCount: 3, fuel: 300,
});
B.CRAFTING_TABLE = def('crafting_table', {
  textures: {
    top: 'crafting_table_top', bottom: 'oak_planks',
    north: 'crafting_table_front', south: 'crafting_table_front',
    east: 'crafting_table_side', west: 'crafting_table_side',
  },
  hardness: 2.5, tool: TOOL.AXE, sound: SOUND.WOOD, fuel: 300,
});
B.FURNACE = def('furnace', {
  textures: {
    top: 'furnace_top', bottom: 'furnace_top',
    north: 'furnace_front', south: 'furnace_side',
    east: 'furnace_side', west: 'furnace_side',
  },
  hardness: 3.5, tool: TOOL.PICKAXE, tier: TIER.WOOD,
});
B.FURNACE_LIT = def('furnace_lit', {
  textures: {
    top: 'furnace_top', bottom: 'furnace_top',
    north: 'furnace_front_on', south: 'furnace_side',
    east: 'furnace_side', west: 'furnace_side',
  },
  hardness: 3.5, tool: TOOL.PICKAXE, tier: TIER.WOOD, lightLevel: 13, drops: 'furnace', hidden: true,
});
B.NOTE_BLOCK = def('note_block', { hardness: 0.8, tool: TOOL.AXE, sound: SOUND.WOOD, fuel: 300 });
B.JUKEBOX = def('jukebox', {
  textures: { top: 'jukebox_top', side: 'jukebox_side', bottom: 'jukebox_side' },
  hardness: 2, tool: TOOL.AXE, sound: SOUND.WOOD, fuel: 300,
});
B.LADDER = def('ladder', {
  model: MODEL.CROSS, pass: PASS.CUTOUT, solid: false, collides: false, opaque: false,
  climbable: true, hardness: 0.4, tool: TOOL.AXE, sound: SOUND.WOOD,
});

/* --- ores & metal blocks ----------------------------------------- */
const oreBlock = (name, drops, tier, dropCount = 1) => def(name, {
  hardness: 3, tool: TOOL.PICKAXE, tier, drops, dropCount,
});
B.COAL_ORE = oreBlock('coal_ore', 'coal', TIER.WOOD);
B.IRON_ORE = oreBlock('iron_ore', 'iron_ore', TIER.STONE);
B.GOLD_ORE = oreBlock('gold_ore', 'gold_ore', TIER.IRON);
B.DIAMOND_ORE = oreBlock('diamond_ore', 'diamond', TIER.IRON);
B.EMERALD_ORE = oreBlock('emerald_ore', 'emerald', TIER.IRON);
B.LAPIS_ORE = oreBlock('lapis_ore', 'lapis_lazuli', TIER.STONE, 6);
B.REDSTONE_ORE = oreBlock('redstone_ore', 'redstone', TIER.IRON, 5);
B.NETHER_QUARTZ_ORE = oreBlock('nether_quartz_ore', 'quartz', TIER.WOOD);

B.COAL_BLOCK = def('coal_block', { hardness: 5, tool: TOOL.PICKAXE, tier: TIER.WOOD, fuel: 16000 });
B.IRON_BLOCK = def('iron_block', { hardness: 5, tool: TOOL.PICKAXE, tier: TIER.STONE });
B.GOLD_BLOCK = def('gold_block', { hardness: 3, tool: TOOL.PICKAXE, tier: TIER.IRON });
B.DIAMOND_BLOCK = def('diamond_block', { hardness: 5, tool: TOOL.PICKAXE, tier: TIER.IRON });
B.EMERALD_BLOCK = def('emerald_block', { hardness: 5, tool: TOOL.PICKAXE, tier: TIER.IRON });
B.LAPIS_BLOCK = def('lapis_block', { hardness: 3, tool: TOOL.PICKAXE, tier: TIER.STONE });
B.REDSTONE_BLOCK = def('redstone_block', { hardness: 5, tool: TOOL.PICKAXE, tier: TIER.STONE });

/* --- decorative -------------------------------------------------- */
B.BRICKS = def('bricks', { hardness: 2, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.TNT = def('tnt', {
  textures: { top: 'tnt_top', side: 'tnt_side', bottom: 'tnt_bottom' },
  hardness: 0, sound: SOUND.GRASS,
});
B.GLASS = def('glass', {
  pass: PASS.CUTOUT, opaque: false, lightFilter: 0,
  hardness: 0.3, sound: SOUND.GLASS, drops: null,
});
B.WHITE_STAINED_GLASS = def('white_stained_glass', {
  pass: PASS.TRANSLUCENT, opaque: false, lightFilter: 1,
  hardness: 0.3, sound: SOUND.GLASS, drops: null,
});
B.LIGHT_BLUE_STAINED_GLASS = def('light_blue_stained_glass', {
  pass: PASS.TRANSLUCENT, opaque: false, lightFilter: 1,
  hardness: 0.3, sound: SOUND.GLASS, drops: null,
});
B.SPONGE = def('sponge', { hardness: 0.6, sound: SOUND.GRASS });
B.WET_SPONGE = def('wet_sponge', { hardness: 0.6, sound: SOUND.GRASS });
B.GLOWSTONE = def('glowstone', {
  lightLevel: 15, hardness: 0.3, tool: TOOL.PICKAXE, sound: SOUND.GLASS,
});
B.SEA_LANTERN = def('sea_lantern', { lightLevel: 15, hardness: 0.3, sound: SOUND.GLASS });
B.QUARTZ_BLOCK = def('quartz_block', {
  textures: { top: 'quartz_block_top', side: 'quartz_block_side', bottom: 'quartz_block_bottom' },
  hardness: 0.8, tool: TOOL.PICKAXE, tier: TIER.WOOD,
});
B.CHISELED_QUARTZ_BLOCK = def('chiseled_quartz_block', {
  textures: { top: 'quartz_block_top', side: 'chiseled_quartz_block', bottom: 'quartz_block_top' },
  hardness: 0.8, tool: TOOL.PICKAXE, tier: TIER.WOOD,
});
B.PRISMARINE = def('prismarine', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.PRISMARINE_BRICKS = def('prismarine_bricks', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.DARK_PRISMARINE = def('dark_prismarine', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.HAY_BLOCK = def('hay_block', {
  textures: { top: 'hay_block_top', side: 'hay_block_side', bottom: 'hay_block_top' },
  hardness: 0.5, sound: SOUND.GRASS,
});
B.MELON = def('melon', {
  textures: { top: 'melon_top', side: 'melon_side', bottom: 'melon_top' },
  hardness: 1, tool: TOOL.AXE, sound: SOUND.WOOD, drops: 'melon_slice', dropCount: 5,
});
B.PUMPKIN = def('pumpkin', {
  textures: { top: 'pumpkin_top', side: 'pumpkin_side', bottom: 'pumpkin_top' },
  hardness: 1, tool: TOOL.AXE, sound: SOUND.WOOD,
});
B.CARVED_PUMPKIN = def('carved_pumpkin', {
  textures: {
    top: 'pumpkin_top', bottom: 'pumpkin_top', north: 'carved_pumpkin',
    south: 'pumpkin_side', east: 'pumpkin_side', west: 'pumpkin_side',
  },
  hardness: 1, tool: TOOL.AXE, sound: SOUND.WOOD,
});
B.JACK_O_LANTERN = def('jack_o_lantern', {
  textures: {
    top: 'pumpkin_top', bottom: 'pumpkin_top', north: 'jack_o_lantern',
    south: 'pumpkin_side', east: 'pumpkin_side', west: 'pumpkin_side',
  },
  lightLevel: 15, hardness: 1, tool: TOOL.AXE, sound: SOUND.WOOD,
});
B.CACTUS = def('cactus', {
  textures: { top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_bottom' },
  hardness: 0.4, sound: SOUND.WOOL,
});
B.NETHERRACK = def('netherrack', { hardness: 0.4, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.NETHER_BRICKS = def('nether_bricks', { hardness: 2, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.SOUL_SAND = def('soul_sand', { hardness: 0.5, tool: TOOL.SHOVEL, sound: SOUND.SAND });
B.MAGMA = def('magma', { textures: 'magma', lightLevel: 3, hardness: 0.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.END_STONE = def('end_stone', { hardness: 3, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.PURPUR_BLOCK = def('purpur_block', { hardness: 1.5, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.TERRACOTTA = def('terracotta', { hardness: 1.25, tool: TOOL.PICKAXE, tier: TIER.WOOD });
B.SLIME_BLOCK = def('slime_block', {
  pass: PASS.TRANSLUCENT, opaque: false, lightFilter: 1, hardness: 0, sound: SOUND.WOOL,
});
B.HONEYCOMB_BLOCK = def('honeycomb_block', { hardness: 0.6, sound: SOUND.WOOL });

/* --- wool & concrete --------------------------------------------- */
export const DYE_COLOURS = [
  'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black',
];
B.WOOL = {};
for (const c of DYE_COLOURS) {
  B.WOOL[c] = def(`${c}_wool`, { hardness: 0.8, sound: SOUND.WOOL, tool: TOOL.SHEARS });
}
B.CONCRETE = {};
for (const c of DYE_COLOURS) {
  B.CONCRETE[c] = def(`${c}_concrete`, { hardness: 1.8, tool: TOOL.PICKAXE, tier: TIER.WOOD });
}

/* --- plants ------------------------------------------------------ */
const plantBlock = (name, options = {}) => def(name, {
  model: MODEL.CROSS, pass: PASS.CUTOUT, solid: false, collides: false, opaque: false,
  hardness: 0, sound: SOUND.GRASS, sway: 0.6, drops: null, ...options,
});
B.SHORT_GRASS = plantBlock('short_grass', {
  textures: 'grass', tint: TINT.GRASS, replaceable: true,
  drops: 'wheat_seeds', dropChance: 0.25, tool: TOOL.SHEARS,
});
B.FERN = plantBlock('fern', { textures: 'fern', tint: TINT.GRASS, replaceable: true, tool: TOOL.SHEARS });
B.TALL_GRASS = plantBlock('tall_grass', {
  textures: 'tall_grass_bottom', tint: TINT.GRASS, replaceable: true, tool: TOOL.SHEARS,
});
B.DEAD_BUSH = plantBlock('dead_bush', { replaceable: true, drops: 'stick', dropChance: 0.5 });
B.SUGAR_CANE = plantBlock('sugar_cane', { tint: TINT.GRASS, drops: 'sugar_cane', sway: 0.35 });
B.RED_MUSHROOM = plantBlock('red_mushroom', { drops: 'red_mushroom', sway: 0 });
B.BROWN_MUSHROOM = plantBlock('brown_mushroom', { drops: 'brown_mushroom', sway: 0, lightLevel: 1 });
B.FLOWERS = {};
for (const f of ['poppy', 'dandelion', 'blue_orchid', 'allium', 'azure_bluet',
  'oxeye_daisy', 'cornflower', 'lily_of_the_valley',
  'orange_tulip', 'pink_tulip', 'red_tulip', 'white_tulip']) {
  B.FLOWERS[f] = plantBlock(f, { drops: f, sway: 0.45 });
}
B.TORCH = def('torch', {
  model: MODEL.TORCH, pass: PASS.CUTOUT, solid: false, collides: false, opaque: false,
  lightLevel: 14, hardness: 0, sound: SOUND.WOOD,
});
B.REDSTONE_TORCH = def('redstone_torch', {
  model: MODEL.TORCH, pass: PASS.CUTOUT, solid: false, collides: false, opaque: false,
  lightLevel: 7, hardness: 0, sound: SOUND.WOOD,
});
B.LANTERN = def('lantern', {
  model: MODEL.TORCH, pass: PASS.CUTOUT, solid: false, collides: false, opaque: false,
  lightLevel: 15, hardness: 3.5, tool: TOOL.PICKAXE, sound: SOUND.GLASS,
});
B.WHEAT = {};
for (let i = 0; i < 8; i++) {
  B.WHEAT[i] = plantBlock(`wheat_stage${i}`, {
    hidden: i < 7, drops: i === 7 ? 'wheat' : 'wheat_seeds', sway: 0.3,
    displayName: 'Wheat Crop',
  });
}

/* --- fluids ------------------------------------------------------ */
B.WATER = def('water', {
  textures: 'water_still', model: MODEL.LIQUID, pass: PASS.TRANSLUCENT,
  solid: false, collides: false, opaque: false, lightFilter: 1,
  liquid: true, replaceable: true, tint: TINT.WATER,
  hardness: -1, drops: null, hidden: true, displayName: 'Water',
});
B.LAVA = def('lava', {
  textures: 'lava_still', model: MODEL.LIQUID, pass: PASS.OPAQUE,
  solid: false, collides: false, opaque: false, lightFilter: 0,
  liquid: true, replaceable: true, lightLevel: 15,
  hardness: -1, drops: null, hidden: true, displayName: 'Lava',
});

/* ------------------------------------------------------------------ */
/* lookup helpers                                                     */
/* ------------------------------------------------------------------ */

/** Fast id -> definition table (dense array, index === id). */
export const BLOCK_BY_ID = blocks;

/** @returns {BlockDef} */
export function getBlock(id) {
  return blocks[id] ?? blocks[0];
}

/** @returns {BlockDef|undefined} */
export function getBlockByName(name) {
  return blocksByName.get(name);
}

/** Numeric id for a block name, or 0 (air) when unknown. */
export function blockId(name) {
  return blocksByName.get(name)?.id ?? 0;
}

/* ---- flat typed-array views, built once for the hot paths -------- */

const N = blocks.length;

/** True when the block fully blocks sight (used for face culling + light). */
export const IS_OPAQUE = new Uint8Array(N);
/** True when an entity collides with the block. */
export const IS_SOLID = new Uint8Array(N);
export const IS_COLLIDABLE = new Uint8Array(N);
/** Light emitted by the block, 0..15. */
export const LIGHT_EMIT = new Uint8Array(N);
/** Light levels removed when passing through, 0..15. */
export const LIGHT_FILTER = new Uint8Array(N);
/** Render model kind. */
export const MODEL_OF = new Uint8Array(N);
/** Render pass. */
export const PASS_OF = new Uint8Array(N);
/** Tint source. */
export const TINT_OF = new Uint8Array(N);
export const IS_LIQUID = new Uint8Array(N);
export const IS_REPLACEABLE = new Uint8Array(N);
export const IS_AIR = new Uint8Array(N);
/** Foliage sway amplitude, 0..255 (scaled by 255). */
export const SWAY_OF = new Uint8Array(N);
/** Height of the liquid surface in 1/16 units. */
export const LIQUID_HEIGHT = new Uint8Array(N);

for (const b of blocks) {
  IS_OPAQUE[b.id] = b.opaque ? 1 : 0;
  IS_SOLID[b.id] = b.solid ? 1 : 0;
  IS_COLLIDABLE[b.id] = b.collides ? 1 : 0;
  LIGHT_EMIT[b.id] = b.lightLevel;
  LIGHT_FILTER[b.id] = b.lightFilter;
  MODEL_OF[b.id] = b.model;
  PASS_OF[b.id] = b.pass;
  TINT_OF[b.id] = b.tint;
  IS_LIQUID[b.id] = b.liquid ? 1 : 0;
  IS_REPLACEABLE[b.id] = b.replaceable ? 1 : 0;
  IS_AIR[b.id] = b.isAir ? 1 : 0;
  SWAY_OF[b.id] = Math.round(b.sway * 255);
  LIQUID_HEIGHT[b.id] = Math.round(b.liquidHeight * 16);
}

/** Blocks the creative inventory should list, in registration order. */
export const CREATIVE_BLOCKS = blocks.filter((b) => !b.hidden && !b.isAir).map((b) => b.id);

/** Every distinct texture name referenced by any block face. */
export function collectTextureNames() {
  const names = new Set();
  for (const b of blocks) for (const f of b.faces) names.add(f);
  // Extra textures the renderer composites or animates.
  names.add('grass_block_side_overlay');
  names.add('grass_block_snow');
  return names;
}
