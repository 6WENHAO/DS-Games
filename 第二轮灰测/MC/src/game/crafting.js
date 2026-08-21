/**
 * game/crafting.js
 * ------------------------------------------------------------------
 * Crafting recipes and matching, plus the furnace smelting table.
 *
 * Two recipe kinds, like vanilla:
 *  - **shaped**: a pattern of rows plus a key mapping characters to
 *    items. Matching slides the pattern around the grid so a recipe
 *    drawn in the top-left of a 3x3 grid also works in the middle.
 *  - **shapeless**: an unordered multiset of ingredients.
 *
 * Ingredients may be a single item name or an array of alternatives
 * (used for "any plank", "any log"), which is how vanilla tags work.
 */

import { itemId, getItemByName } from './items.js';
import { DYE_COLOURS } from '../world/blocks.js';

/** Tag-style ingredient groups. */
export const TAGS = {
  planks: ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'],
  logs: ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'],
  stoneCrafting: ['cobblestone', 'stone', 'granite', 'diorite', 'andesite'],
  coals: ['coal', 'charcoal'],
  wool: DYE_COLOURS.map((c) => `${c}_wool`),
};

/** @type {object[]} */
export const recipes = [];

/**
 * Declares a shaped recipe.
 * @param {string[]} pattern rows of up to three characters
 * @param {Record<string, string|string[]>} key
 * @param {string} result
 * @param {number} [count]
 */
function shaped(pattern, key, result, count = 1) {
  const height = pattern.length;
  const width = Math.max(...pattern.map((r) => r.length));
  const grid = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = pattern[y][x] ?? ' ';
      if (ch === ' ') { grid.push(null); continue; }
      const spec = key[ch];
      if (!spec) throw new Error(`recipe for ${result}: pattern key '${ch}' is undefined`);
      const names = Array.isArray(spec) ? spec : [spec];
      grid.push(names.map(itemId).filter((v) => v !== 0));
    }
  }
  recipes.push({ type: 'shaped', width, height, grid, result: itemId(result), count });
}

/**
 * Declares a shapeless recipe.
 * @param {Array<string|string[]>} ingredients
 */
function shapeless(ingredients, result, count = 1) {
  recipes.push({
    type: 'shapeless',
    ingredients: ingredients.map((spec) => {
      const names = Array.isArray(spec) ? spec : [spec];
      return names.map(itemId).filter((v) => v !== 0);
    }),
    result: itemId(result),
    count,
  });
}

/* ------------------------------------------------------------------ */
/* recipe list                                                        */
/* ------------------------------------------------------------------ */

// --- wood processing ---
for (const log of TAGS.logs) {
  const planks = `${log.replace('_log', '')}_planks`;
  if (getItemByName(planks)) shapeless([log], planks, 4);
}
shaped(['P', 'P'], { P: TAGS.planks }, 'stick', 4);

// --- basic blocks ---
shaped(['PP', 'PP'], { P: TAGS.planks }, 'crafting_table');
shaped(['CCC', 'C C', 'CCC'], { C: 'cobblestone' }, 'furnace');
shaped(['PPP', 'PBP', 'PPP'], { P: TAGS.planks, B: 'book' }, 'bookshelf');
shaped(['SS', 'SS'], { S: 'stone' }, 'stone_bricks', 4);
shaped(['BB', 'BB'], { B: 'brick' }, 'bricks');
shaped(['SS', 'SS'], { S: 'sand' }, 'sandstone');
shaped(['SS', 'SS'], { S: 'red_sand' }, 'red_sandstone');
shaped(['QQ', 'QQ'], { Q: 'quartz' }, 'quartz_block');
shaped(['GGG', 'GGG', 'GGG'], { G: 'gold_ingot' }, 'gold_block');
shaped(['III', 'III', 'III'], { I: 'iron_ingot' }, 'iron_block');
shaped(['DDD', 'DDD', 'DDD'], { D: 'diamond' }, 'diamond_block');
shaped(['EEE', 'EEE', 'EEE'], { E: 'emerald' }, 'emerald_block');
shaped(['CCC', 'CCC', 'CCC'], { C: TAGS.coals }, 'coal_block');
shaped(['LLL', 'LLL', 'LLL'], { L: 'lapis_lazuli' }, 'lapis_block');
shaped(['RRR', 'RRR', 'RRR'], { R: 'redstone' }, 'redstone_block');
shaped(['WWW', 'WWW', 'WWW'], { W: 'wheat' }, 'hay_block');
shapeless(['gold_block'], 'gold_ingot', 9);
shapeless(['iron_block'], 'iron_ingot', 9);
shapeless(['diamond_block'], 'diamond', 9);
shapeless(['emerald_block'], 'emerald', 9);
shapeless(['lapis_block'], 'lapis_lazuli', 9);
shapeless(['redstone_block'], 'redstone', 9);
shapeless(['coal_block'], 'coal', 9);
shaped(['SSS', 'SSS', 'SSS'], { S: 'string' }, 'white_wool');
shaped(['TT', 'TT'], { T: 'terracotta' }, 'terracotta', 4);

// --- light & utility ---
shaped(['C', 'S'], { C: TAGS.coals, S: 'stick' }, 'torch', 4);
shaped(['GGG', 'GDG', 'GGG'], { G: 'glass', D: 'redstone' }, 'glowstone');
shaped(['GGG', 'GGG', 'GGG'], { G: 'gunpowder' }, 'tnt');
shaped([' S ', 'SPS', ' S '], { S: 'stick', P: TAGS.planks }, 'ladder', 3);
shaped(['PPP', ' S ', ' S '], { P: TAGS.planks, S: 'stick' }, 'oak_boat');
shapeless(['clay_ball', 'clay_ball', 'clay_ball', 'clay_ball'], 'clay');
shapeless(['snowball', 'snowball', 'snowball', 'snowball'], 'snow_block');
shaped(['WWW'], { W: 'wheat' }, 'bread');
shapeless(['brown_mushroom', 'red_mushroom', 'bowl'], 'mushroom_stew');
shaped(['P P', ' P '], { P: TAGS.planks }, 'bowl', 4);
shaped(['SSS', 'S S'], { S: 'sugar_cane' }, 'paper', 3);
shapeless(['paper', 'paper', 'paper', 'leather'], 'book');
shapeless(['sugar_cane'], 'sugar');
shaped(['II', 'II'], { I: 'iron_ingot' }, 'shears', 1);
shaped(['I', 'F'], { I: 'iron_ingot', F: 'flint' }, 'flint_and_steel');
shaped([' I ', 'I I'], { I: 'iron_ingot' }, 'bucket');
shaped([' S ', 'SRS', ' S '], { S: 'stick', R: 'redstone' }, 'redstone_torch');
shaped(['NNN', 'NGN', 'NNN'], { N: 'gold_nugget', G: 'redstone' }, 'clock');
shapeless(['gold_ingot'], 'gold_nugget', 9);
shapeless(['iron_ingot'], 'iron_nugget', 9);
shaped(['PPP', 'PPP', 'PPP'], { P: TAGS.planks }, 'note_block');
shaped(['PPP', 'PDP', 'PPP'], { P: TAGS.planks, D: 'diamond' }, 'jukebox');
// (iron bars / fences / panes need thin-block models the mesher does not
// implement yet, so they are intentionally absent from the recipe list.)

// --- tools & weapons ---
const TOOL_HEADS = {
  pickaxe: ['MMM', ' S ', ' S '],
  axe: ['MM', 'MS', ' S'],
  shovel: ['M', 'S', 'S'],
  hoe: ['MM', ' S', ' S'],
  sword: ['M', 'M', 'S'],
};
const TOOL_MATERIAL_ITEMS = {
  wooden: TAGS.planks,
  stone: TAGS.stoneCrafting,
  iron: ['iron_ingot'],
  golden: ['gold_ingot'],
  diamond: ['diamond'],
};
for (const [material, ingredient] of Object.entries(TOOL_MATERIAL_ITEMS)) {
  for (const [kind, pattern] of Object.entries(TOOL_HEADS)) {
    const result = `${material}_${kind}`;
    if (getItemByName(result)) shaped(pattern, { M: ingredient, S: 'stick' }, result);
  }
}

// --- armour ---
const ARMOUR_PATTERNS = {
  helmet: ['MMM', 'M M'],
  chestplate: ['M M', 'MMM', 'MMM'],
  leggings: ['MMM', 'M M', 'M M'],
  boots: ['M M', 'M M'],
};
const ARMOUR_MATERIALS = { leather: ['leather'], iron: ['iron_ingot'], diamond: ['diamond'] };
for (const [material, ingredient] of Object.entries(ARMOUR_MATERIALS)) {
  for (const [piece, pattern] of Object.entries(ARMOUR_PATTERNS)) {
    const result = `${material}_${piece}`;
    if (getItemByName(result)) shaped(pattern, { M: ingredient }, result);
  }
}
shaped([' SS', 'S S', ' SS'], { S: 'string' }, 'bow');
shaped(['F', 'S', 'E'], { F: 'flint', S: 'stick', E: 'feather' }, 'arrow', 4);

// --- glass & decoration ---
shaped(['GGG', 'GDG', 'GGG'], { G: 'glass', D: 'white_wool' }, 'white_stained_glass', 8);
shaped(['SS', 'SS'], { S: 'stone_bricks' }, 'chiseled_stone_bricks', 4);

/* ------------------------------------------------------------------ */
/* matching                                                           */
/* ------------------------------------------------------------------ */

/**
 * Bounding box of the non-empty cells in a crafting grid.
 * @param {import('./inventory.js').Inventory} grid
 * @param {number} size grid edge (2 or 3)
 */
function usedBounds(grid, size) {
  let minX = size; let minY = size; let maxX = -1; let maxY = -1;
  let filled = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid.get(y * size + x).isEmpty) continue;
      filled++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY, filled };
}

/** Does a shaped recipe fit at the given offset? */
function shapedMatchesAt(recipe, grid, size, offsetX, offsetY) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const slot = grid.get(y * size + x);
      const rx = x - offsetX;
      const ry = y - offsetY;
      const inside = rx >= 0 && ry >= 0 && rx < recipe.width && ry < recipe.height;
      const want = inside ? recipe.grid[ry * recipe.width + rx] : null;
      if (!want) {
        if (!slot.isEmpty) return false;
      } else {
        if (slot.isEmpty || !want.includes(slot.id)) return false;
      }
    }
  }
  return true;
}

/**
 * Finds the recipe that the grid currently satisfies.
 * @param {import('./inventory.js').Inventory} grid
 * @param {number} size 2 for the player grid, 3 for a crafting table
 * @returns {{recipe: object, result: number, count: number}|null}
 */
export function findRecipe(grid, size) {
  const bounds = usedBounds(grid, size);
  if (bounds.filled === 0) return null;

  for (const recipe of recipes) {
    if (recipe.type === 'shaped') {
      if (recipe.width > size || recipe.height > size) continue;
      const maxOffsetX = size - recipe.width;
      const maxOffsetY = size - recipe.height;
      for (let oy = 0; oy <= maxOffsetY; oy++) {
        for (let ox = 0; ox <= maxOffsetX; ox++) {
          if (shapedMatchesAt(recipe, grid, size, ox, oy)) {
            return { recipe, result: recipe.result, count: recipe.count };
          }
        }
      }
    } else {
      if (recipe.ingredients.length !== bounds.filled) continue;
      // Greedy multiset match: every grid item must consume one ingredient.
      const remaining = recipe.ingredients.map((alts) => alts);
      const used = new Array(remaining.length).fill(false);
      let ok = true;
      for (let i = 0; i < grid.size && ok; i++) {
        const slot = grid.get(i);
        if (slot.isEmpty) continue;
        const index = remaining.findIndex((alts, k) => !used[k] && alts.includes(slot.id));
        if (index < 0) ok = false; else used[index] = true;
      }
      if (ok && used.every(Boolean)) {
        return { recipe, result: recipe.result, count: recipe.count };
      }
    }
  }
  return null;
}

/**
 * Consumes one set of ingredients from the grid after a craft.
 * @param {import('./inventory.js').Inventory} grid
 */
export function consumeIngredients(grid) {
  for (let i = 0; i < grid.size; i++) {
    const slot = grid.get(i);
    if (!slot.isEmpty) grid.consume(i, 1);
  }
}

/* ------------------------------------------------------------------ */
/* smelting                                                           */
/* ------------------------------------------------------------------ */

/** input item name -> { result, count, xp } */
export const SMELTING = new Map();
const smelt = (input, result, count = 1) => {
  const from = itemId(input);
  const to = itemId(result);
  if (from && to) SMELTING.set(from, { result: to, count });
};

smelt('iron_ore', 'iron_ingot');
smelt('gold_ore', 'gold_ingot');
smelt('sand', 'glass');
smelt('red_sand', 'glass');
smelt('cobblestone', 'stone');
smelt('stone', 'smooth_stone');
smelt('clay_ball', 'brick');
smelt('clay', 'terracotta');
smelt('porkchop', 'cooked_porkchop');
smelt('beef', 'cooked_beef');
smelt('chicken', 'cooked_chicken');
smelt('mutton', 'cooked_mutton');
smelt('oak_log', 'charcoal');
smelt('birch_log', 'charcoal');
smelt('spruce_log', 'charcoal');
smelt('nether_quartz_ore', 'quartz');
smelt('wet_sponge', 'sponge');

/** Smelting output for an item, or null. */
export function smeltingResult(itemIdValue) {
  return SMELTING.get(itemIdValue) ?? null;
}

/** Every recipe that produces the given item, for a recipe book UI. */
export function recipesFor(itemIdValue) {
  return recipes.filter((r) => r.result === itemIdValue);
}
