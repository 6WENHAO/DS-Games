/* =====================================================================
 * recipes.js — 合成表（3×3 有序 / 无序）与熔炼表
 *  pattern: 最多 3 行字符串，key 映射字符 -> 物品名，'#'/' ' 表示空
 *  shapeless: 物品名数组（顺序无关）
 * ===================================================================== */
import { TIERS } from './item_textures.js';

export const RECIPES = [];

function shaped(out, count, pattern, key) {
  RECIPES.push({ type: 'shaped', out, count, pattern, key });
}
function shapeless(out, count, items) {
  RECIPES.push({ type: 'shapeless', out, count, items });
}

/* ---------------- 木材基础 ---------------- */
const WOODS = ['oak', 'birch', 'spruce', 'jungle'];
for (const w of WOODS) {
  shapeless(`${w}_planks`, 4, [`${w}_log`]);
}
shaped('stick', 4, ['P', 'P'], { P: 'oak_planks' });
shaped('crafting_table', 1, ['PP', 'PP'], { P: 'oak_planks' });
shaped('chest', 1, ['PPP', 'P P', 'PPP'], { P: 'oak_planks' });
shaped('furnace', 1, ['CCC', 'C C', 'CCC'], { C: 'cobblestone' });
shaped('torch', 4, ['C', 'S'], { C: 'coal', S: 'stick' });
shaped('ladder', 3, ['S S', 'SSS', 'S S'], { S: 'stick' });
shaped('bookshelf', 1, ['PPP', 'BBB', 'PPP'], { P: 'oak_planks', B: 'book' });
shaped('jukebox', 1, ['PPP', 'PDP', 'PPP'], { P: 'oak_planks', D: 'diamond' });

/* ---------------- 石制 ---------------- */
shaped('stone_bricks', 4, ['SS', 'SS'], { S: 'stone' });
shaped('bricks', 1, ['BB', 'BB'], { B: 'brick' });
shaped('sandstone', 1, ['SS', 'SS'], { S: 'sand' });
shaped('smooth_stone', 4, ['SS', 'SS'], { S: 'smooth_stone' });
shaped('tnt', 1, ['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: 'sand' });
shaped('glowstone', 1, ['GG', 'GG'], { G: 'gold_ingot' });

/* ---------------- 矿物压缩 / 解压 ---------------- */
const COMPRESS = [
  ['iron_ingot', 'iron_block'], ['gold_ingot', 'gold_block'],
  ['diamond', 'diamond_block'], ['emerald', 'emerald_block'],
  ['lapis_lazuli', 'lapis_block'], ['redstone', 'redstone_block'],
  ['coal', 'coal_block'], ['wheat', 'bricks_hay'],
];
for (const [unit, block] of COMPRESS) {
  shaped(block, 1, ['UUU', 'UUU', 'UUU'], { U: unit });
  shapeless(unit, 9, [block]);
}

/* ---------------- 工具与武器（全材质） ---------------- */
const TOOL_MATERIAL = {
  wooden: 'oak_planks', stone: 'cobblestone', iron: 'iron_ingot',
  golden: 'gold_ingot', diamond: 'diamond', netherite: 'netherite_ingot',
};
for (const tierKey of Object.keys(TIERS)) {
  const M = TOOL_MATERIAL[tierKey];
  if (!M || tierKey === 'netherite') continue;   // 下界合金需锻造台，此处略
  shaped(`${tierKey}_pickaxe`, 1, ['MMM', ' S ', ' S '], { M, S: 'stick' });
  shaped(`${tierKey}_axe`, 1, ['MM', 'MS', ' S'], { M, S: 'stick' });
  shaped(`${tierKey}_shovel`, 1, ['M', 'S', 'S'], { M, S: 'stick' });
  shaped(`${tierKey}_sword`, 1, ['M', 'M', 'S'], { M, S: 'stick' });
  shaped(`${tierKey}_hoe`, 1, ['MM', ' S', ' S'], { M, S: 'stick' });
}
shaped('shears', 1, [' I', 'I '], { I: 'iron_ingot' });
shaped('bucket', 1, ['I I', ' I '], { I: 'iron_ingot' });
shaped('bowl', 1, ['P P', ' P '], { P: 'oak_planks' });

/* ---------------- 杂项 ---------------- */
shaped('bread', 1, ['WWW'], { W: 'wheat' });
shaped('paper', 3, ['SSS'], { S: 'sugar_cane' });
shaped('book', 1, ['PP', 'P '], { P: 'paper' });
shapeless('sugar', 1, ['sugar_cane']);
shaped('white_wool', 1, ['SS', 'SS'], { S: 'string' });
shaped('glass', 1, ['SS', 'SS'], { S: 'sand' });   // 便捷配方（原版需熔炼）
shapeless('flint', 1, ['gravel']);

/** 染色：任意羊毛 + 染料 → 对应颜色（此处用矿物/植物近似替代染料） */
const DYE_SOURCE = {
  red: 'poppy', yellow: 'dandelion', blue: 'lapis_lazuli', light_blue: 'blue_orchid',
  green: 'tall_grass', brown: 'clay_ball', black: 'coal', white: 'bone',
  lime: 'fern', pink: 'poppy', gray: 'flint', light_gray: 'clay_ball',
  cyan: 'blue_orchid', purple: 'lapis_lazuli', magenta: 'poppy', orange: 'brick',
};
for (const [color, src] of Object.entries(DYE_SOURCE)) {
  shapeless(`${color}_wool`, 1, ['white_wool', src]);
  shapeless(`${color}_concrete`, 1, [`${color}_wool`, 'gravel', 'sand']);
}

/* ---------------- 熔炼（燃料 + 原料 → 产物） ---------------- */
export const SMELTING = new Map(Object.entries({
  cobblestone: 'stone',
  sand: 'glass',
  red_sand: 'glass',
  iron_ore: 'iron_ingot',
  gold_ore: 'gold_ingot',
  copper_ore: 'copper_ingot',
  clay_ball: 'brick',
  clay: 'terracotta',
  oak_log: 'charcoal',
  birch_log: 'charcoal',
  spruce_log: 'charcoal',
  jungle_log: 'charcoal',
  porkchop: 'cooked_porkchop',
  beef: 'cooked_beef',
  chicken: 'cooked_chicken',
  mutton: 'cooked_beef',
  stone: 'smooth_stone',
}));

/* ==================================================================== *
 *  匹配算法
 * ==================================================================== */

/**
 * 在 3×3 网格中匹配配方
 * @param {(string|null)[]} grid 长度 9 的物品名数组（null 为空）
 * @returns {{out:string,count:number,recipe:object}|null}
 */
export function matchRecipe(grid) {
  const filled = [];
  for (let i = 0; i < 9; i++) if (grid[i]) filled.push(grid[i]);
  if (filled.length === 0) return null;

  for (const r of RECIPES) {
    if (r.type === 'shapeless') {
      if (matchShapeless(r, filled)) return { out: r.out, count: r.count, recipe: r };
    } else {
      if (matchShaped(r, grid)) return { out: r.out, count: r.count, recipe: r };
    }
  }
  return null;
}

function matchShapeless(r, filled) {
  if (filled.length !== r.items.length) return false;
  const pool = filled.slice();
  for (const need of r.items) {
    const i = pool.indexOf(need);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return pool.length === 0;
}

function matchShaped(r, grid) {
  const rows = r.pattern.length;
  const cols = Math.max(...r.pattern.map(s => s.length));
  for (let oy = 0; oy + rows <= 3; oy++) {
    for (let ox = 0; ox + cols <= 3; ox++) {
      if (testAt(r, grid, ox, oy, rows, cols)) return true;
    }
  }
  return false;
}

function testAt(r, grid, ox, oy, rows, cols) {
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const cell = grid[y * 3 + x];
      const inside = x >= ox && x < ox + cols && y >= oy && y < oy + rows;
      let want = null;
      if (inside) {
        const ch = r.pattern[y - oy][x - ox] ?? ' ';
        want = (ch === ' ' || ch === '#') ? null : (r.key[ch] ?? null);
      }
      if (want === null) { if (cell) return false; }
      else if (cell !== want) return false;
    }
  }
  return true;
}

/** 某配方能否用给定物品清单（name->count）合成 */
export function canCraft(recipe, have) {
  const need = new Map();
  if (recipe.type === 'shapeless') {
    for (const it of recipe.items) need.set(it, (need.get(it) || 0) + 1);
  } else {
    for (const row of recipe.pattern) {
      for (const ch of row) {
        if (ch === ' ' || ch === '#') continue;
        const it = recipe.key[ch];
        if (it) need.set(it, (need.get(it) || 0) + 1);
      }
    }
  }
  for (const [it, n] of need) if ((have.get(it) || 0) < n) return false;
  return need.size > 0;
}

/** 返回配方所需材料清单 */
export function recipeIngredients(recipe) {
  const need = new Map();
  if (recipe.type === 'shapeless') {
    for (const it of recipe.items) need.set(it, (need.get(it) || 0) + 1);
  } else {
    for (const row of recipe.pattern) {
      for (const ch of row) {
        if (ch === ' ' || ch === '#') continue;
        const it = recipe.key[ch];
        if (it) need.set(it, (need.get(it) || 0) + 1);
      }
    }
  }
  return need;
}

/** 把配方摆进 3×3 网格（用于"一键合成"） */
export function recipeToGrid(recipe) {
  const grid = new Array(9).fill(null);
  if (recipe.type === 'shapeless') {
    recipe.items.forEach((it, i) => { grid[i] = it; });
  } else {
    for (let y = 0; y < recipe.pattern.length; y++) {
      const row = recipe.pattern[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ' ' || ch === '#') continue;
        grid[y * 3 + x] = recipe.key[ch] ?? null;
      }
    }
  }
  return grid;
}
