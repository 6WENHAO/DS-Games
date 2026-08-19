// Items, resources, recipes — No Man's Sky economy with Minecraft block items.
import { BLOCKS, BID } from '../world/blocks.js';

// type: 'resource' | 'product' | 'tech' | 'block' | 'special'
export const ITEMS = {
  FERRITE_DUST: { name: 'Ferrite Dust', cn: '铁质粉尘', type: 'resource', stack: 9999, value: 12, color: '#b98b5a', sym: 'Fe', desc: '最常见的金属尘埃，敲碎岩石即可获得。是所有基础建造的起点。' },
  PURE_FERRITE: { name: 'Pure Ferrite', cn: '纯铁', type: 'resource', stack: 9999, value: 26, color: '#d8d2c8', sym: 'Fe+', desc: '精炼后的铁，结构强度更高，用于制造精密部件。' },
  MAGNETISED_FERRITE: { name: 'Magnetised Ferrite', cn: '磁化铁', type: 'resource', stack: 9999, value: 65, color: '#9fb6d8', sym: 'Fe++', desc: '带有强磁场的铁，高级科技必需品。' },
  CARBON: { name: 'Carbon', cn: '碳', type: 'resource', stack: 9999, value: 12, color: '#5a5a5a', sym: 'C', desc: '有机生命的基础元素。从植物与木材中提取。' },
  CONDENSED_CARBON: { name: 'Condensed Carbon', cn: '浓缩碳', type: 'resource', stack: 9999, value: 24, color: '#2f2f2f', sym: 'C+', desc: '高密度碳晶体，作为燃料的效率是普通碳的两倍。' },
  OXYGEN: { name: 'Oxygen', cn: '氧', type: 'resource', stack: 9999, value: 34, color: '#ff5a5a', sym: 'O2', desc: '维持生命的气体。可从红色植物中收集，用于补充生命维持系统。' },
  SODIUM: { name: 'Sodium', cn: '钠', type: 'resource', stack: 9999, value: 22, color: '#f2c93a', sym: 'Na', desc: '活性金属，为危害防护系统充能。' },
  SODIUM_NITRATE: { name: 'Sodium Nitrate', cn: '硝酸钠', type: 'resource', stack: 9999, value: 48, color: '#ffe07a', sym: 'Na+', desc: '精炼钠，为防护罩提供更持久的能量。' },
  DIHYDROGEN: { name: 'Di-hydrogen', cn: '二氢', type: 'resource', stack: 9999, value: 34, color: '#49c8ff', sym: 'H2', desc: '在地表结晶的高能气体，星际飞行燃料的原料。' },
  DIHYDROGEN_JELLY: { name: 'Di-hydrogen Jelly', cn: '二氢凝胶', type: 'product', stack: 9999, value: 100, color: '#8ae8ff', sym: 'H2*', desc: '稳定化的二氢，可直接注入起飞推进器作为燃料。' },
  COBALT: { name: 'Cobalt', cn: '钴', type: 'resource', stack: 9999, value: 40, color: '#3f6ee0', sym: 'Co', desc: '洞穴中生长的蓝色晶簇，储能能力优异。' },
  IONISED_COBALT: { name: 'Ionised Cobalt', cn: '离子钴', type: 'resource', stack: 9999, value: 80, color: '#7f9fff', sym: 'Co+', desc: '离子化的钴，电池与传送门的核心材料。' },
  PARAFFINIUM: { name: 'Paraffinium', cn: '石蜡', type: 'resource', stack: 9999, value: 46, color: '#ff8a3d', sym: 'Pf', desc: '寄生于岩层的高热元素。' },
  COPPER: { name: 'Copper', cn: '铜', type: 'resource', stack: 9999, value: 55, color: '#d2762e', sym: 'Cu', desc: '导电金属，可精炼为彩色金属。' },
  CHROMATIC_METAL: { name: 'Chromatic Metal', cn: '彩色金属', type: 'resource', stack: 9999, value: 245, color: '#c06aff', sym: 'Cr', desc: '精炼的合金，几乎所有高级科技都需要它。' },
  GOLD: { name: 'Gold', cn: '黄金', type: 'resource', stack: 9999, value: 138, color: '#f2c53d', sym: 'Au', desc: '贵金属，交易价值极高。' },
  CHLORINE: { name: 'Chlorine', cn: '氯', type: 'resource', stack: 9999, value: 68, color: '#c8ffe0', sym: 'Cl', desc: '从盐晶中提取的活性气体。' },
  TRITIUM: { name: 'Tritium', cn: '氚', type: 'resource', stack: 9999, value: 30, color: '#7fffd6', sym: 'H3', desc: '从太空小行星中开采，脉冲引擎的燃料。' },
  METAL_PLATING: { name: 'Metal Plating', cn: '金属板', type: 'product', stack: 9999, value: 200, color: '#8e9aa8', sym: '▤', desc: '基础结构部件。修复飞船与建造基地的通用材料。' },
  CARBON_NANOTUBES: { name: 'Carbon Nanotubes', cn: '碳纳米管', type: 'product', stack: 9999, value: 250, color: '#3a3a3a', sym: '≡', desc: '强韧的碳结构，用于高级建造。' },
  ION_BATTERY: { name: 'Ion Battery', cn: '离子电池', type: 'product', stack: 9999, value: 320, color: '#5affd8', sym: '⚡', desc: '便携能源单元，为随身设备充能。' },
  LIFE_SUPPORT_GEL: { name: 'Life Support Gel', cn: '生命维持凝胶', type: 'product', stack: 9999, value: 200, color: '#a8ffd0', sym: '✚', desc: '高效补充生命维持系统的凝胶。' },
  ANTIMATTER: { name: 'Antimatter', cn: '反物质', type: 'product', stack: 9999, value: 3200, color: '#ff6ad8', sym: '◉', desc: '被约束的反物质，跃迁引擎的能量核心。' },
  ANTIMATTER_HOUSING: { name: 'Antimatter Housing', cn: '反物质容器', type: 'product', stack: 9999, value: 1200, color: '#b0b6bc', sym: '◎', desc: '用于安全容纳反物质的合金外壳。' },
  WARP_CELL: { name: 'Warp Cell', cn: '跃迁元件', type: 'product', stack: 9999, value: 4600, color: '#ffd08a', sym: '✧', desc: '为超光速引擎充能的元件。一次跃迁消耗一枚。' },
  GLASS_PANE: { name: 'Glass', cn: '玻璃', type: 'product', stack: 9999, value: 60, color: '#cde8f0', sym: '▢', desc: '透明建材，由铁与碳烧制。' },
  SALVAGED_DATA: { name: 'Salvaged Data', cn: '回收数据', type: 'product', stack: 9999, value: 800, color: '#2ee6c0', sym: '⛁', desc: '从遗迹中回收的技术数据，可用于解锁蓝图。' },
};

// block items reference their block id
export const BLOCK_ITEMS = {};
for (let id = 1; id < BLOCKS.length; id++) {
  const b = BLOCKS[id];
  if (!b.item) continue;
  const kk = 'BLOCK_' + id;
  BLOCK_ITEMS[kk] = id;
  ITEMS[kk] = {
    name: b.name, cn: b.cn, type: 'block', stack: 999, value: Math.round(6 + b.hardness * 8),
    color: '#8a8f96', sym: '▣', block: id, desc: '可放置的方块。用于建造与地形改造。',
  };
}

export function itemKeyForBlock(id) { return 'BLOCK_' + id; }
export function itemDef(key) { return ITEMS[key] || null; }
export function itemLabel(key) { const d = ITEMS[key]; return d ? d.cn : key; }

/* -------------------------------------------------------------- *
 * Recipes
 * -------------------------------------------------------------- */
// craft: made in the inventory / construction table
export const RECIPES = [
  { id: 'metal_plating', out: 'METAL_PLATING', count: 1, in: [['FERRITE_DUST', 50]], cat: '结构', desc: '飞船维修与基地建造的核心部件。', unlocked: true },
  { id: 'carbon_nanotubes', out: 'CARBON_NANOTUBES', count: 1, in: [['CARBON', 50]], cat: '结构', desc: '把碳压制成高强度纳米管。', unlocked: true },
  { id: 'dihydrogen_jelly', out: 'DIHYDROGEN_JELLY', count: 1, in: [['DIHYDROGEN', 40]], cat: '燃料', desc: '起飞推进器的燃料。', unlocked: true },
  { id: 'life_support_gel', out: 'LIFE_SUPPORT_GEL', count: 1, in: [['OXYGEN', 30], ['CONDENSED_CARBON', 20]], cat: '生存', desc: '一次性补满生命维持。', unlocked: true },
  { id: 'ion_battery', out: 'ION_BATTERY', count: 1, in: [['IONISED_COBALT', 25], ['CONDENSED_CARBON', 20]], cat: '能源', desc: '便携电池。', unlocked: true },
  { id: 'glass', out: 'GLASS_PANE', count: 4, in: [['FERRITE_DUST', 20], ['CARBON', 10]], cat: '建造', desc: '烧制玻璃。', unlocked: true },
  { id: 'antimatter_housing', out: 'ANTIMATTER_HOUSING', count: 1, in: [['METAL_PLATING', 1], ['OXYGEN', 30]], cat: '星际', desc: '容纳反物质的外壳。', unlocked: false },
  { id: 'antimatter', out: 'ANTIMATTER', count: 1, in: [['CONDENSED_CARBON', 25], ['CHROMATIC_METAL', 20]], cat: '星际', desc: '被约束的反物质。', unlocked: false },
  { id: 'warp_cell', out: 'WARP_CELL', count: 1, in: [['ANTIMATTER', 1], ['ANTIMATTER_HOUSING', 1]], cat: '星际', desc: '跃迁引擎的燃料元件。', unlocked: false },
  // buildables
  { id: 'b_table', out: itemKeyForBlock(BID.TABLE), count: 1, in: [['CARBON', 20]], cat: '建造', desc: '解锁更多制作配方的工作台。', unlocked: true },
  { id: 'b_refiner', out: itemKeyForBlock(BID.REFINER), count: 1, in: [['METAL_PLATING', 1], ['CARBON', 30]], cat: '建造', desc: '便携精炼器：把原料提纯。', unlocked: true },
  { id: 'b_beacon', out: itemKeyForBlock(BID.BEACON), count: 1, in: [['FERRITE_DUST', 30], ['CARBON', 20]], cat: '建造', desc: '信号灯塔：标记位置并保存进度。', unlocked: true },
  { id: 'b_computer', out: itemKeyForBlock(BID.COMPUTER), count: 1, in: [['METAL_PLATING', 2], ['CARBON', 40]], cat: '建造', desc: '基地计算机：宣告一片领地为你的基地。', unlocked: true },
  { id: 'b_lumen', out: itemKeyForBlock(BID.LUMEN), count: 4, in: [['DIHYDROGEN', 20], ['FERRITE_DUST', 10]], cat: '建造', desc: '发光方块，照亮基地。', unlocked: true },
  { id: 'b_metal_panel', out: itemKeyForBlock(BID.METAL_PANEL), count: 8, in: [['PURE_FERRITE', 10]], cat: '建造', desc: '金属墙板。', unlocked: true },
  { id: 'b_metal_floor', out: itemKeyForBlock(BID.METAL_FLOOR), count: 8, in: [['PURE_FERRITE', 10]], cat: '建造', desc: '金属地板。', unlocked: true },
  { id: 'b_planks', out: itemKeyForBlock(BID.PLANKS), count: 4, in: [[itemKeyForBlock(BID.LOG), 1]], cat: '建造', desc: '把原木切成木板。', unlocked: true },
  { id: 'b_crate', out: itemKeyForBlock(BID.CRATE), count: 1, in: [[itemKeyForBlock(BID.PLANKS), 8]], cat: '建造', desc: '储物箱。', unlocked: true },
];

// refine: made in the portable refiner (input -> output over time)
export const REFINE = [
  { id: 'r_pure_ferrite', in: [['FERRITE_DUST', 1]], out: 'PURE_FERRITE', count: 1, time: 1.6, name: '铁质提纯' },
  { id: 'r_magnet', in: [['PURE_FERRITE', 2]], out: 'MAGNETISED_FERRITE', count: 1, time: 3.2, name: '磁化处理' },
  { id: 'r_cond_carbon', in: [['CARBON', 2]], out: 'CONDENSED_CARBON', count: 1, time: 1.6, name: '碳压缩' },
  { id: 'r_sodium_nitrate', in: [['SODIUM', 2]], out: 'SODIUM_NITRATE', count: 1, time: 2.2, name: '钠精炼' },
  { id: 'r_ion_cobalt', in: [['COBALT', 2]], out: 'IONISED_COBALT', count: 1, time: 2.2, name: '钴离子化' },
  { id: 'r_chromatic', in: [['COPPER', 2]], out: 'CHROMATIC_METAL', count: 1, time: 2.6, name: '彩色金属冶炼' },
  { id: 'r_chromatic_gold', in: [['GOLD', 2]], out: 'CHROMATIC_METAL', count: 3, time: 3.0, name: '黄金冶炼' },
  { id: 'r_jelly', in: [['DIHYDROGEN', 20]], out: 'DIHYDROGEN_JELLY', count: 1, time: 3.4, name: '二氢凝胶合成' },
  { id: 'r_carbon_from_plant', in: [[itemKeyForBlock(BID.LEAVES), 4]], out: 'CARBON', count: 6, time: 1.4, name: '有机物分解' },
];

export function findRefineFor(key, qty) {
  return REFINE.filter((r) => r.in.some(([k]) => k === key)).sort((a, b) => a.time - b.time);
}

/* ship / tool systems */
export const REPAIRS = {
  MULTITOOL_BEAM: { name: '采矿光束', en: 'Mining Beam', cost: [['FERRITE_DUST', 20]] },
  MULTITOOL_SCANNER: { name: '扫描仪', en: 'Scanner', cost: [['CARBON', 25]] },
  MULTITOOL_VISOR: { name: '分析镜', en: 'Analysis Visor', cost: [['FERRITE_DUST', 30], ['CARBON', 10]] },
  SHIP_LAUNCH: { name: '起飞推进器', en: 'Launch Thruster', cost: [['METAL_PLATING', 1]] },
  SHIP_PULSE: { name: '脉冲引擎', en: 'Pulse Engine', cost: [['METAL_PLATING', 1], ['DIHYDROGEN', 25]] },
  SHIP_HYPER: { name: '超光速引擎', en: 'Hyperdrive', cost: [['METAL_PLATING', 2], ['CHROMATIC_METAL', 10]] },
};
