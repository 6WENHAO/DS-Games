/* =====================================================================
 * items.js — 物品注册表
 *  · 每个非隐藏方块自动生成同名"方块物品"
 *  · 工具（5 类 × 6 材质）、食物、材料单独定义
 * ===================================================================== */
import { BLOCKS, BLOCK_BY_NAME } from './blocks.js';
import { TIERS } from './item_textures.js';
import { TOOL } from '../core/Constants.js';

/** name -> item */
export const ITEMS = new Map();

function def(item) {
  const it = {
    name: item.name,
    display: item.display,
    kind: item.kind ?? 'material',   // block | tool | food | material
    tex: item.tex ?? null,           // 物品图标贴图名（方块物品为 null，用方块 3D 图标）
    blockName: item.blockName ?? null,
    blockId: item.blockId ?? -1,
    maxStack: item.maxStack ?? 64,
    group: item.group ?? 'misc',
    // 工具
    tool: item.tool ?? TOOL.NONE,
    tier: item.tier ?? null,
    speed: item.speed ?? 1,
    level: item.level ?? 0,
    durability: item.durability ?? 0,
    damage: item.damage ?? 1,
    // 食物
    nutrition: item.nutrition ?? 0,
    saturation: item.saturation ?? 0,
    // 附加
    fuel: item.fuel ?? 0,            // 可作燃料的秒数
    desc: item.desc ?? '',
  };
  ITEMS.set(it.name, it);
  return it;
}

/* ---------------- 方块物品 ---------------- */
for (const b of BLOCKS) {
  if (b.id === 0) continue;
  def({
    name: b.name, display: b.display, kind: 'block',
    blockName: b.name, blockId: b.id, group: b.group, maxStack: 64,
    fuel: b.flammable ? 15 : 0,
  });
}

/* ---------------- 工具与武器 ---------------- */
const TOOL_DEFS = [
  ['pickaxe', '镐', TOOL.PICKAXE, 1.0],
  ['axe', '斧', TOOL.AXE, 1.0],
  ['shovel', '锹', TOOL.SHOVEL, 1.0],
  ['sword', '剑', TOOL.SWORD, 1.5],
  ['hoe', '锄', TOOL.HOE, 1.0],
];
for (const [tierKey, tier] of Object.entries(TIERS)) {
  for (const [kind, cn, toolType, dmgMul] of TOOL_DEFS) {
    def({
      name: `${tierKey}_${kind}`,
      display: `${tier.cn}${cn}`,
      kind: 'tool', tool: toolType, tier: tierKey,
      tex: `item_${tierKey}_${kind}`,
      speed: kind === 'sword' ? 1.5 : tier.speed,
      level: tier.level,
      durability: tier.dur,
      damage: Math.round(tier.dmg * dmgMul),
      maxStack: 1, group: 'tool',
      fuel: tierKey === 'wooden' ? 10 : 0,
      desc: kind === 'sword' ? `攻击力 ${Math.round(tier.dmg * dmgMul)}` : `挖掘等级 ${tier.level}`,
    });
  }
}
def({ name: 'shears', display: '剪刀', kind: 'tool', tool: TOOL.SHEARS, tex: 'item_shears',
  speed: 5, level: 1, durability: 238, damage: 1, maxStack: 1, group: 'tool' });

/* ---------------- 食物 ---------------- */
const FOODS = [
  ['apple', '苹果', 'item_apple', 4, 2.4],
  ['bread', '面包', 'item_bread', 5, 6],
  ['porkchop', '生猪排', 'item_porkchop', 3, 1.8],
  ['cooked_porkchop', '熟猪排', 'item_cooked_porkchop', 8, 12.8],
  ['beef', '生牛肉', 'item_beef', 3, 1.8],
  ['cooked_beef', '牛排', 'item_cooked_beef', 8, 12.8],
  ['chicken', '生鸡肉', 'item_chicken', 2, 1.2],
  ['cooked_chicken', '熟鸡肉', 'item_cooked_chicken', 6, 7.2],
  ['mutton', '生羊肉', 'item_mutton', 2, 1.2],
];
for (const [name, cn, tex, nut, sat] of FOODS) {
  def({ name, display: cn, kind: 'food', tex, nutrition: nut, saturation: sat, group: 'food', maxStack: 64 });
}

/* ---------------- 材料 ---------------- */
const MATERIALS = [
  ['stick', '木棍', 'item_stick', 15],
  ['coal', '煤炭', 'item_coal', 80],
  ['charcoal', '木炭', 'item_charcoal', 80],
  ['iron_ingot', '铁锭', 'item_iron_ingot', 0],
  ['gold_ingot', '金锭', 'item_gold_ingot', 0],
  ['copper_ingot', '铜锭', 'item_copper_ingot', 0],
  ['diamond', '钻石', 'item_diamond', 0],
  ['emerald', '绿宝石', 'item_emerald', 0],
  ['lapis_lazuli', '青金石', 'item_lapis_lazuli', 0],
  ['redstone', '红石', 'item_redstone', 0],
  ['gunpowder', '火药', 'item_gunpowder', 0],
  ['sugar', '糖', 'item_sugar', 0],
  ['wheat', '小麦', 'item_wheat', 0],
  ['seeds', '小麦种子', 'item_seeds', 0],
  ['bone', '骨头', 'item_bone', 0],
  ['paper', '纸', 'item_paper', 0],
  ['book', '书', 'item_book', 0],
  ['clay_ball', '黏土球', 'item_clay_ball', 0],
  ['brick', '红砖', 'item_brick', 0],
  ['flint', '燧石', 'item_flint', 0],
  ['string', '线', 'item_string', 0],
  ['leather', '皮革', 'item_leather', 0],
  ['bucket', '桶', 'item_bucket', 0],
  ['bowl', '碗', 'item_bowl', 0],
  ['egg', '鸡蛋', 'item_egg', 0],
  ['feather', '羽毛', 'item_feather', 0],
  ['slime_ball', '黏液球', 'item_slime_ball', 0],
];
for (const [name, cn, tex, fuel] of MATERIALS) {
  def({ name, display: cn, tex, kind: 'material', group: 'misc', fuel });
}

/* ---------------- 查询 API ---------------- */
export function getItem(name) { return ITEMS.get(name) || null; }
export function itemDisplay(name) { const i = ITEMS.get(name); return i ? i.display : name; }
export function isBlockItem(name) { const i = ITEMS.get(name); return !!i && i.kind === 'block'; }
export function blockIdOfItem(name) {
  const i = ITEMS.get(name);
  if (!i) return -1;
  if (i.blockId >= 0) return i.blockId;
  const b = BLOCK_BY_NAME.get(name);
  return b ? b.id : -1;
}
export function itemMaxStack(name) { const i = ITEMS.get(name); return i ? i.maxStack : 64; }

/** 创造模式物品栏：按分组整理出的物品名列表 */
export function creativeItemsByGroup() {
  const groups = new Map();
  for (const it of ITEMS.values()) {
    if (it.kind === 'block') {
      const b = BLOCK_BY_NAME.get(it.blockName);
      if (b && b.hidden) continue;
    }
    if (!groups.has(it.group)) groups.set(it.group, []);
    groups.get(it.group).push(it.name);
  }
  return groups;
}

export const ITEM_NAMES = [...ITEMS.keys()];
