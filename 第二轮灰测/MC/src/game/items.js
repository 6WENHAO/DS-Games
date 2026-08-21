/**
 * game/items.js
 * ------------------------------------------------------------------
 * The item registry: everything that can sit in an inventory slot.
 *
 * Two kinds of item exist:
 *  - **block items**, generated automatically from the block registry so
 *    every placeable block has a matching item;
 *  - **plain items** (tools, food, materials) declared here.
 *
 * Tool tiers and mining speeds follow vanilla, which is what makes
 * "stone pickaxe on stone" feel correct.
 */

import { blocks, TOOL, TIER } from '../world/blocks.js';

/** Item categories, used to group the creative inventory. */
export const CATEGORY = {
  BUILDING: 'building',
  DECORATION: 'decoration',
  REDSTONE: 'redstone',
  TRANSPORT: 'transport',
  FOOD: 'food',
  TOOLS: 'tools',
  COMBAT: 'combat',
  MATERIALS: 'materials',
};

/**
 * Tool material speeds: the multiplier applied to mining speed when the
 * tool matches the block's required tool class.
 */
export const TOOL_MATERIALS = {
  wooden: { speed: 2, tier: TIER.WOOD, durability: 59, damage: 1 },
  stone: { speed: 4, tier: TIER.STONE, durability: 131, damage: 2 },
  iron: { speed: 6, tier: TIER.IRON, durability: 250, damage: 3 },
  golden: { speed: 12, tier: TIER.WOOD, durability: 32, damage: 1 },
  diamond: { speed: 8, tier: TIER.DIAMOND, durability: 1561, damage: 4 },
};

/** @type {object[]} index === item id */
export const items = [];
export const itemsByName = new Map();

let nextId = 1;   // 0 is reserved for "empty"

/**
 * Registers one item.
 * @param {string} name
 * @param {object} options
 */
function defineItem(name, options = {}) {
  const item = {
    id: nextId++,
    name,
    displayName: options.displayName
      ?? name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    /** Texture name inside assets/textures/items/ (null for block items). */
    texture: options.texture ?? name,
    /** Block id this item places, or 0. */
    placesBlock: options.placesBlock ?? 0,
    stackSize: options.stackSize ?? 64,
    category: options.category ?? CATEGORY.MATERIALS,
    /** Tool behaviour. */
    tool: options.tool ?? null,
    toolMaterial: options.toolMaterial ?? null,
    speed: options.speed ?? 1,
    tier: options.tier ?? TIER.HAND,
    durability: options.durability ?? 0,
    attackDamage: options.attackDamage ?? 1,
    /** Food behaviour. */
    food: options.food ?? 0,
    saturation: options.saturation ?? 0,
    /** Smelting fuel value in ticks. */
    fuel: options.fuel ?? 0,
    /** Armour. */
    armour: options.armour ?? 0,
    armourSlot: options.armourSlot ?? null,
  };
  items[item.id] = item;
  itemsByName.set(name, item);
  return item;
}

/* ------------------------------------------------------------------ */
/* block items                                                        */
/* ------------------------------------------------------------------ */

/** Rough category assignment for auto-generated block items. */
function categoriseBlock(block) {
  const n = block.name;
  if (/wool|concrete|glass|terracotta|carpet|banner/.test(n)) return CATEGORY.DECORATION;
  if (/flower|tulip|poppy|dandelion|orchid|allium|bluet|daisy|cornflower|lily|grass|fern|bush|mushroom|sapling|cane|leaves|cactus|melon|pumpkin/.test(n)) return CATEGORY.DECORATION;
  if (/torch|lantern|glowstone|lamp|sea_lantern/.test(n)) return CATEGORY.DECORATION;
  if (/redstone|note_block|jukebox|tnt/.test(n)) return CATEGORY.REDSTONE;
  if (/ore|ingot|block$/.test(n)) return CATEGORY.BUILDING;
  return CATEGORY.BUILDING;
}

/** Every non-hidden block gets an item that places it. */
for (const block of blocks) {
  if (block.isAir || block.hidden) continue;
  defineItem(block.name, {
    displayName: block.displayName,
    texture: null,
    placesBlock: block.id,
    stackSize: block.stackSize,
    category: categoriseBlock(block),
    fuel: block.fuel,
  });
}

/* ------------------------------------------------------------------ */
/* tools                                                              */
/* ------------------------------------------------------------------ */

const TOOL_KINDS = [
  { suffix: 'pickaxe', tool: TOOL.PICKAXE },
  { suffix: 'axe', tool: TOOL.AXE },
  { suffix: 'shovel', tool: TOOL.SHOVEL },
  { suffix: 'hoe', tool: TOOL.HOE },
  { suffix: 'sword', tool: TOOL.SWORD },
];

for (const [material, spec] of Object.entries(TOOL_MATERIALS)) {
  for (const kind of TOOL_KINDS) {
    const isSword = kind.suffix === 'sword';
    defineItem(`${material}_${kind.suffix}`, {
      stackSize: 1,
      category: isSword ? CATEGORY.COMBAT : CATEGORY.TOOLS,
      tool: kind.tool,
      toolMaterial: material,
      speed: isSword ? 1.5 : spec.speed,
      tier: spec.tier,
      durability: spec.durability,
      attackDamage: isSword ? spec.damage + 3 : spec.damage + 1,
      fuel: material === 'wooden' ? 200 : 0,
    });
  }
}

defineItem('shears', { stackSize: 1, category: CATEGORY.TOOLS, tool: TOOL.SHEARS, speed: 5, durability: 238 });
defineItem('flint_and_steel', { stackSize: 1, category: CATEGORY.TOOLS, durability: 64 });
defineItem('bucket', { stackSize: 16, category: CATEGORY.TOOLS });
defineItem('water_bucket', { stackSize: 1, category: CATEGORY.TOOLS });
defineItem('lava_bucket', { stackSize: 1, category: CATEGORY.TOOLS, fuel: 20000 });
defineItem('clock', { stackSize: 1, category: CATEGORY.TOOLS });
defineItem('bow', { stackSize: 1, category: CATEGORY.COMBAT, durability: 384, attackDamage: 1 });
defineItem('arrow', { category: CATEGORY.COMBAT });

/* ------------------------------------------------------------------ */
/* armour                                                             */
/* ------------------------------------------------------------------ */

const ARMOUR_SETS = {
  leather: { helmet: 1, chestplate: 3, leggings: 2, boots: 1, durability: 55 },
  iron: { helmet: 2, chestplate: 6, leggings: 5, boots: 2, durability: 165 },
  diamond: { helmet: 3, chestplate: 8, leggings: 6, boots: 3, durability: 363 },
};
for (const [material, spec] of Object.entries(ARMOUR_SETS)) {
  for (const piece of ['helmet', 'chestplate', 'leggings', 'boots']) {
    defineItem(`${material}_${piece}`, {
      stackSize: 1,
      category: CATEGORY.COMBAT,
      armour: spec[piece],
      armourSlot: piece,
      durability: spec.durability,
    });
  }
}

/* ------------------------------------------------------------------ */
/* food                                                               */
/* ------------------------------------------------------------------ */

defineItem('apple', { category: CATEGORY.FOOD, food: 4, saturation: 2.4 });
defineItem('bread', { category: CATEGORY.FOOD, food: 5, saturation: 6 });
defineItem('porkchop', { category: CATEGORY.FOOD, food: 3, saturation: 1.8 });
defineItem('cooked_porkchop', { category: CATEGORY.FOOD, food: 8, saturation: 12.8 });
defineItem('beef', { category: CATEGORY.FOOD, food: 3, saturation: 1.8 });
defineItem('cooked_beef', { category: CATEGORY.FOOD, food: 8, saturation: 12.8 });
defineItem('chicken', { category: CATEGORY.FOOD, food: 2, saturation: 1.2 });
defineItem('cooked_chicken', { category: CATEGORY.FOOD, food: 6, saturation: 7.2 });
defineItem('mutton', { category: CATEGORY.FOOD, food: 2, saturation: 1.2 });
defineItem('cooked_mutton', { category: CATEGORY.FOOD, food: 6, saturation: 9.6 });
defineItem('mushroom_stew', { stackSize: 1, category: CATEGORY.FOOD, food: 6, saturation: 7.2 });
defineItem('rotten_flesh', { category: CATEGORY.FOOD, food: 4, saturation: 0.8 });
defineItem('melon_slice', { category: CATEGORY.FOOD, food: 2, saturation: 1.2, texture: 'apple' });

/* ------------------------------------------------------------------ */
/* materials                                                          */
/* ------------------------------------------------------------------ */

defineItem('stick', { fuel: 100 });
defineItem('bowl', { fuel: 200 });
defineItem('coal', { fuel: 1600 });
defineItem('charcoal', { fuel: 1600 });
defineItem('iron_ingot', {});
defineItem('gold_ingot', {});
defineItem('iron_nugget', {});
defineItem('gold_nugget', {});
defineItem('diamond', {});
defineItem('emerald', {});
defineItem('lapis_lazuli', {});
defineItem('redstone', {});
defineItem('quartz', {});
defineItem('flint', {});
defineItem('clay_ball', {});
defineItem('brick', {});
defineItem('gunpowder', {});
defineItem('feather', {});
defineItem('leather', {});
defineItem('string', {});
defineItem('bone', {});
defineItem('egg', { stackSize: 16 });
defineItem('slime_ball', {});
defineItem('sugar', {});
defineItem('paper', {});
defineItem('book', {});
defineItem('wheat', {});
defineItem('wheat_seeds', {});
defineItem('snowball', { stackSize: 16, texture: 'egg' });
defineItem('ender_pearl', { stackSize: 16 });
defineItem('blaze_rod', {});
defineItem('painting', { category: CATEGORY.DECORATION });
defineItem('oak_boat', { stackSize: 1, category: CATEGORY.TRANSPORT, fuel: 1200 });

/* ------------------------------------------------------------------ */
/* lookup helpers                                                     */
/* ------------------------------------------------------------------ */

export function getItem(id) {
  return items[id] ?? null;
}

export function getItemByName(name) {
  return itemsByName.get(name) ?? null;
}

export function itemId(name) {
  return itemsByName.get(name)?.id ?? 0;
}

/** Item that places a given block id, if any. */
export const ITEM_FOR_BLOCK = new Uint16Array(blocks.length);
for (const item of items) {
  if (item?.placesBlock) ITEM_FOR_BLOCK[item.placesBlock] = item.id;
}

/**
 * Mining speed multiplier for using `itemIdValue` on `block`, and whether
 * the block will actually drop anything.
 *
 * Vanilla rules: the right tool class multiplies speed; a tool of too low
 * a tier (or bare hands) still breaks the block but drops nothing.
 */
export function toolEffect(itemIdValue, block) {
  const item = items[itemIdValue];
  const needsTool = block.requiresTool === true;
  if (!item || !item.tool) {
    // Bare hands (or a non-tool item): only blocks that do not require a
    // tool drop anything.
    return { speed: 1, canHarvest: !needsTool };
  }
  const matches = item.tool === block.tool;
  // Swords are quick through plants and cobwebs; shears through leaves and wool.
  const speed = matches ? item.speed : (item.tool === TOOL.SWORD ? 1.5 : 1);
  const canHarvest = !needsTool || (matches && item.tier >= block.tier);
  return { speed, canHarvest };
}

/** Ordered creative-inventory listing, grouped by category. */
export function creativeItems() {
  const order = [
    CATEGORY.BUILDING, CATEGORY.DECORATION, CATEGORY.REDSTONE, CATEGORY.TRANSPORT,
    CATEGORY.TOOLS, CATEGORY.COMBAT, CATEGORY.FOOD, CATEGORY.MATERIALS,
  ];
  const out = [];
  for (const category of order) {
    for (const item of items) {
      if (item && item.category === category) out.push(item.id);
    }
  }
  return out;
}
