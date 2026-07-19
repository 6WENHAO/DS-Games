/* ============================================================
   STARFORGE - data.js
   方块 / 物品 / 配方 / 科技树 / 任务 / 星球生态 定义
   ============================================================ */
'use strict';

// ================= 方块 =================
// hard: 挖掘时间(秒)  drops: [{item,n,chance}]  cross: 十字植物面片
// machine: 属于工厂机器（视觉由 factory.js 接管，方块网格中隐形但有碰撞）
const BLOCKS = {
  air:      { id: 0, name: '空气', solid: false },
  grass:    { id: 1, name: '草方块', hard: 0.75, tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, drops: [{ item: 'dirt', n: 1 }] },
  dirt:     { id: 2, name: '泥土', hard: 0.7, tiles: { all: 'dirt' }, drops: [{ item: 'dirt', n: 1 }] },
  stone:    { id: 3, name: '岩石', hard: 1.6, tiles: { all: 'stone' }, drops: [{ item: 'stone', n: 1 }] },
  sand:     { id: 4, name: '沙', hard: 0.6, tiles: { all: 'sand' }, drops: [{ item: 'sand', n: 1 }] },
  log:      { id: 5, name: '碳质木干', hard: 1.1, tiles: { top: 'log_top', side: 'log_side', bottom: 'log_top' }, drops: [{ item: 'carbon', n: 3 }] },
  leaves:   { id: 6, name: '叶簇', hard: 0.3, tiles: { all: 'leaves' }, transparent: true, fancy: true, drops: [{ item: 'carbon', n: 1 }, { item: 'oxygen', n: 1, chance: 0.35 }] },
  coal_ore: { id: 7, name: '煤矿脉', hard: 2.2, tiles: { all: 'coal_ore' }, ore: true, drops: [{ item: 'coal', n: 1 }, { item: 'coal', n: 1, chance: 0.3 }] },
  iron_ore: { id: 8, name: '铁矿脉', hard: 2.6, tiles: { all: 'iron_ore' }, ore: true, drops: [{ item: 'iron_ore', n: 1 }] },
  copper_ore:{ id: 9, name: '铜矿脉', hard: 2.6, tiles: { all: 'copper_ore' }, ore: true, drops: [{ item: 'copper_ore', n: 1 }] },
  titanium_ore:{ id: 10, name: '钛矿脉', hard: 3.6, tiles: { all: 'titanium_ore' }, ore: true, drops: [{ item: 'titanium_ore', n: 1 }] },
  uranium_ore:{ id: 11, name: '铀矿脉', hard: 4.2, tiles: { all: 'uranium_ore' }, ore: true, drops: [{ item: 'uranium', n: 1 }] },
  gold_ore: { id: 12, name: '金矿脉', hard: 3.0, tiles: { all: 'gold_ore' }, ore: true, drops: [{ item: 'gold_ore', n: 1 }] },
  sodium_plant:{ id: 13, name: '钠素花', hard: 0.05, tiles: { all: 'sodium_plant' }, cross: true, solid: false, drops: [{ item: 'sodium', n: 2 }] },
  oxygen_plant:{ id: 14, name: '氧素花', hard: 0.05, tiles: { all: 'oxygen_plant' }, cross: true, solid: false, drops: [{ item: 'oxygen', n: 2 }] },
  fern:     { id: 15, name: '碳蕨', hard: 0.05, tiles: { all: 'carbon_fern' }, cross: true, solid: false, drops: [{ item: 'carbon', n: 1 }] },
  water:    { id: 16, name: '水', solid: false, tiles: { all: 'water' }, transparent: true, liquid: true },
  planks:   { id: 17, name: '碳板', hard: 0.9, tiles: { all: 'planks' }, drops: [{ item: 'planks_b', n: 1 }] },
  glass:    { id: 18, name: '玻璃', hard: 0.4, tiles: { all: 'glass' }, transparent: true, drops: [{ item: 'glass_b', n: 1 }] },
  lamp:     { id: 19, name: '光源方块', hard: 0.5, tiles: { all: 'lamp_on' }, glow: true, drops: [{ item: 'lamp_b', n: 1 }] },
  ice:      { id: 20, name: '永冻冰', hard: 1.2, tiles: { all: 'ice' }, drops: [{ item: 'stone', n: 1 }] },
  snow:     { id: 21, name: '雪被层', hard: 0.7, tiles: { top: 'snow_top', side: 'snow_side', bottom: 'dirt' }, drops: [{ item: 'dirt', n: 1 }] },
  basalt:   { id: 22, name: '玄武岩', hard: 2.0, tiles: { all: 'basalt' }, drops: [{ item: 'stone', n: 1 }, { item: 'coal', n: 1, chance: 0.15 }] },
  alien:    { id: 23, name: '荧紫菌毯', hard: 0.75, tiles: { top: 'alien_top', side: 'alien_side', bottom: 'dirt' }, drops: [{ item: 'dirt', n: 1 }, { item: 'sodium', n: 1, chance: 0.2 }] },
  barrier:  { id: 24, name: '致密基岩', hard: Infinity, tiles: { all: 'barrier' } },
  // ------ 机器 ------
  furnace:  { id: 30, name: '熔炉', hard: 1.2, machine: 'furnace', tiles: { all: 'stone', front: 'furnace_front' }, drops: [{ item: 'furnace_b', n: 1 }] },
  miner:    { id: 31, name: '自动采矿机', hard: 1.2, machine: 'miner', tiles: { all: 'metal', top: 'miner_top' }, drops: [{ item: 'miner_b', n: 1 }] },
  belt:     { id: 32, name: '传送带', hard: 0.5, machine: 'belt', lowbox: true, tiles: { all: 'belt' }, drops: [{ item: 'belt_b', n: 1 }] },
  assembler:{ id: 33, name: '装配机', hard: 1.4, machine: 'assembler', tiles: { all: 'metal', top: 'assembler_top' }, drops: [{ item: 'assembler_b', n: 1 }] },
  solar:    { id: 34, name: '太阳能板', hard: 0.8, machine: 'solar', lowbox: true, tiles: { all: 'solar_top' }, drops: [{ item: 'solar_b', n: 1 }] },
  refinery: { id: 35, name: '精炼厂', hard: 1.6, machine: 'refinery', tiles: { all: 'refinery_side' }, drops: [{ item: 'refinery_b', n: 1 }] },
  chest:    { id: 36, name: '储物箱', hard: 0.9, machine: 'chest', tiles: { all: 'chest_side', top: 'storage_top' }, drops: [{ item: 'chest_b', n: 1 }] },
  reactor:  { id: 37, name: '核子反应堆', hard: 2.4, machine: 'reactor', tiles: { all: 'reactor_side' }, drops: [{ item: 'reactor_b', n: 1 }] },
  launchpad:{ id: 38, name: '发射平台', hard: 2.0, machine: 'launchpad', lowbox: true, tiles: { all: 'launchpad_top' }, drops: [{ item: 'launchpad_b', n: 1 }] },
  wind:     { id: 39, name: '风力涡轮机', hard: 1.0, machine: 'wind', tiles: { all: 'metal' }, drops: [{ item: 'wind_b', n: 1 }] },
  burner:   { id: 40, name: '火力发电机', hard: 1.2, machine: 'burner', tiles: { all: 'metal_dark', front: 'furnace_front' }, drops: [{ item: 'burner_b', n: 1 }] },
  // ---- 新星球方块 ----
  crystal:  { id: 41, name: '氚晶簇', hard: 1.8, tiles: { all: 'crystal' }, glow: true, drops: [{ item: 'tritium', n: 2 }, { item: 'tritium', n: 2, chance: 0.5 }] },
  mush_stem:{ id: 42, name: '巨菌柄', hard: 0.8, tiles: { all: 'mush_stem' }, drops: [{ item: 'carbon', n: 2 }] },
  mush_cap: { id: 43, name: '巨菌盖', hard: 0.5, tiles: { all: 'mush_cap' }, drops: [{ item: 'carbon', n: 1 }, { item: 'oxygen', n: 1, chance: 0.4 }, { item: 'sodium', n: 1, chance: 0.2 }] },
  ash:      { id: 44, name: '灰烬土', hard: 0.8, tiles: { all: 'ash' }, drops: [{ item: 'dirt', n: 1 }, { item: 'coal', n: 1, chance: 0.12 }] },
  amber:    { id: 45, name: '金珀岩', hard: 1.4, tiles: { all: 'amber' }, glow: true, drops: [{ item: 'carbon', n: 2 }, { item: 'gold_ore', n: 1, chance: 0.08 }] },
  rust:     { id: 46, name: '锈蚀铁壤', hard: 1.0, tiles: { all: 'rust' }, drops: [{ item: 'dirt', n: 1 }, { item: 'iron_ore', n: 1, chance: 0.25 }] },
  salt:     { id: 47, name: '盐晶块', hard: 0.7, tiles: { all: 'salt' }, drops: [{ item: 'sodium', n: 1 }, { item: 'sodium', n: 1, chance: 0.4 }] },
  obsidian: { id: 48, name: '黑曜岩', hard: 2.6, tiles: { all: 'obsidian' }, drops: [{ item: 'stone', n: 1 }, { item: 'titanium_ore', n: 1, chance: 0.1 }] },
  redmoss:  { id: 49, name: '红藓被', hard: 0.75, tiles: { top: 'redmoss_top', side: 'redmoss_side', bottom: 'dirt' }, drops: [{ item: 'dirt', n: 1 }, { item: 'carbon', n: 1, chance: 0.25 }] },
  hive:     { id: 50, name: '蜂窝晶壁', hard: 1.1, tiles: { all: 'hive' }, drops: [{ item: 'dirt', n: 1 }, { item: 'carbon', n: 1, chance: 0.35 }] },
  murk:     { id: 51, name: '荧沼菌毯', hard: 0.75, tiles: { top: 'murk_top', side: 'murk_side', bottom: 'dirt' }, drops: [{ item: 'dirt', n: 1 }, { item: 'oxygen', n: 1, chance: 0.15 }] },
  glow_shroom:{ id: 52, name: '荧光蕈', hard: 0.05, tiles: { all: 'glow_shroom' }, cross: true, solid: false, glow: true, drops: [{ item: 'oxygen', n: 2 }, { item: 'sodium', n: 1, chance: 0.5 }] },
  beacon:   { id: 53, name: '标记方块', hard: 0.8, machine: 'beacon', tiles: { all: 'metal_dark', top: 'lamp_on' }, drops: [{ item: 'beacon_b', n: 1 }] },
  lumberbot:{ id: 54, name: '伐木机器人', hard: 1.0, machine: 'lumberbot', tiles: { all: 'vent', top: 'metal_dark' }, drops: [{ item: 'lumberbot_b', n: 1 }] },
  collector:{ id: 55, name: '收集点', hard: 0.9, machine: 'collector', tiles: { all: 'chest_side', top: 'storage_top' }, drops: [{ item: 'collector_b', n: 1 }] },
};
const BLOCK_BY_ID = {};
for (const k in BLOCKS){ BLOCKS[k].key = k; BLOCK_BY_ID[BLOCKS[k].id] = BLOCKS[k]; if (BLOCKS[k].solid === undefined) BLOCKS[k].solid = true; }

// ================= 物品 =================
// cat: res资源 mat材料 blk方块 mach机器 tool特殊
const ITEMS = {
  // 元素资源
  carbon:   { name: '碳', cat: 'res', iconFn: 'carbon', stack: 250, desc: '一切有机物的基础，也是基础燃料。', price: 4 },
  oxygen:   { name: '氧气', cat: 'res', iconFn: 'oxygen', stack: 250, desc: '为生命维持系统充能。', price: 6 },
  sodium:   { name: '钠', cat: 'res', iconFn: 'sodium', stack: 250, desc: '为危险防护装置充能。', price: 8 },
  dirt:     { name: '泥土', cat: 'blk', iconBlock: 'dirt', block: 'dirt', stack: 250, desc: '朴实无华的土。', price: 1 },
  stone:    { name: '岩石', cat: 'blk', iconBlock: 'stone', block: 'stone', stack: 250, desc: '基础建材，可烧炼加工。', price: 2 },
  sand:     { name: '沙', cat: 'blk', iconBlock: 'sand', block: 'sand', stack: 250, desc: '可烧制成玻璃。', price: 2 },
  coal:     { name: '煤', cat: 'res', iconFn: 'coal', stack: 250, desc: '高能燃料，熔炉的最爱。', price: 10 },
  iron_ore: { name: '铁矿石', cat: 'res', iconFn: 'iron_ore', stack: 250, desc: '需熔炼成铁锭。', price: 8 },
  copper_ore:{ name: '铜矿石', cat: 'res', iconFn: 'copper_ore', stack: 250, desc: '需熔炼成铜锭。', price: 8 },
  titanium_ore:{ name: '钛矿石', cat: 'res', iconFn: 'titanium_ore', stack: 250, desc: '稀有轻金属矿。', price: 24 },
  gold_ore: { name: '金矿石', cat: 'res', iconFn: 'gold_ore', stack: 250, desc: '闪闪发光，星站高价收购。', price: 40 },
  uranium:  { name: '铀-235', cat: 'res', iconFn: 'uranium', stack: 100, desc: '微微发热…核反应堆燃料。', price: 60 },
  tritium:  { name: '氚', cat: 'res', iconFn: 'tritium', stack: 500, desc: '脉冲引擎燃料，击碎小行星获取。', price: 12 },
  // 加工材料
  iron:     { name: '铁锭', cat: 'mat', iconFn: 'iron', stack: 250, desc: '工业的骨架。', price: 18 },
  copper:   { name: '铜锭', cat: 'mat', iconFn: 'copper', stack: 250, desc: '导电材料。', price: 18 },
  titanium: { name: '钛锭', cat: 'mat', iconFn: 'titanium', stack: 250, desc: '航天级合金。', price: 55 },
  gold:     { name: '金锭', cat: 'mat', iconFn: 'gold', stack: 250, desc: '贵金属，硬通货。', price: 90 },
  gear:     { name: '齿轮', cat: 'mat', iconFn: 'gear', stack: 250, desc: '机械传动核心。', price: 42 },
  wire:     { name: '铜线圈', cat: 'mat', iconFn: 'wire', stack: 250, desc: '缠绕的铜线。', price: 24 },
  circuit:  { name: '电路板', cat: 'mat', iconFn: 'circuit', stack: 200, desc: '所有智能机器的大脑。', price: 110 },
  plate:    { name: '装甲板', cat: 'mat', iconFn: 'plate', stack: 200, desc: '飞船与机器的外壳。', price: 60 },
  data:     { name: '研究数据', cat: 'mat', iconFn: 'data', stack: 500, desc: '科技矩阵的解锁密钥。', price: 150 },
  fuel:     { name: '发射燃料', cat: 'mat', iconFn: 'fuel', stack: 20, desc: '让飞船挣脱引力的怒吼。', price: 320 },
  antimatter:{ name: '反物质', cat: 'mat', iconFn: 'antimatter', stack: 10, desc: '被磁场囚禁的湮灭之光——曲率引擎的心脏。', price: 45000 },
  warpcell: { name: '曲率电池', cat: 'mat', iconFn: 'warp', stack: 10, desc: '跨星系跃迁的船票。第一章的终点，自由的起点。', price: 240000 },
  // 可放置方块物品
  planks_b: { name: '碳板块', cat: 'blk', iconBlock: 'planks', block: 'planks', stack: 250, desc: '压缩碳建材。', price: 6 },
  glass_b:  { name: '玻璃', cat: 'blk', iconBlock: 'glass', block: 'glass', stack: 250, desc: '透明建材。', price: 12 },
  lamp_b:   { name: '光源方块', cat: 'blk', iconBlock: 'lamp', block: 'lamp', stack: 100, desc: '照亮黑夜。', price: 30 },
  // 机器物品
  furnace_b:  { name: '熔炉', cat: 'mach', iconBlock: 'furnace', block: 'furnace', stack: 50, desc: '烧炼矿石。燃料：碳/煤。', price: 80 },
  miner_b:    { name: '自动采矿机', cat: 'mach', iconBlock: 'miner', block: 'miner', stack: 50, desc: '放置在矿脉上自动开采。需电力。', price: 500 },
  belt_b:     { name: '传送带', cat: 'mach', iconBlock: 'belt', block: 'belt', stack: 200, desc: '运输物品。朝放置者视线方向传送。', price: 60 },
  assembler_b:{ name: '装配机', cat: 'mach', iconBlock: 'assembler', block: 'assembler', stack: 50, desc: '自动合成部件。需电力。', price: 700 },
  solar_b:    { name: '太阳能板', cat: 'mach', iconBlock: 'solar', block: 'solar', stack: 100, desc: '白天发电 10kW。', price: 350 },
  refinery_b: { name: '精炼厂', cat: 'mach', iconBlock: 'refinery', block: 'refinery', stack: 50, desc: '精炼高级化合物。需电力。', price: 900 },
  chest_b:    { name: '储物箱', cat: 'mach', iconBlock: 'chest', block: 'chest', stack: 50, desc: '24 格储存空间。', price: 90 },
  reactor_b:  { name: '核子反应堆', cat: 'mach', iconBlock: 'reactor', block: 'reactor', stack: 20, desc: '全天候发电 100kW，消耗铀。', price: 4000 },
  launchpad_b:{ name: '发射平台', cat: 'mach', iconBlock: 'launchpad', block: 'launchpad', stack: 10, desc: '飞船停泊于此免耗燃料起飞。', price: 1500 },
  wind_b:     { name: '风力涡轮机', cat: 'mach', iconBlock: 'wind', block: 'wind', stack: 50, desc: '全天候发电 4~14kW，海拔越高风越大。', price: 420 },
  burner_b:   { name: '火力发电机', cat: 'mach', iconBlock: 'burner', block: 'burner', stack: 50, desc: '烧煤/碳发电 25kW，工业的第一缕黑烟。', price: 260 },
  beacon_b:   { name: '标记方块', cat: 'mach', iconBlock: 'beacon', block: 'beacon', stack: 20, desc: '放置后在屏幕上显示定位标记，按 E 设置名称与全星系显示。永不迷路。', price: 120 },
  lumberbot_b:{ name: '伐木机器人', cat: 'mach', iconBlock: 'lumberbot', block: 'lumberbot', stack: 10, desc: '放置充电桩后悬浮机器人自动巡林伐木，采集碳装满后自动送往附近的收集点。', price: 320 },
  collector_b:{ name: '收集点', cat: 'mach', iconBlock: 'collector', block: 'collector', stack: 20, desc: '伐木机器人的卸货站（12格），库存自动输出到面前的传送带/机器，可直通装配机。', price: 110 },
};
for (const k in ITEMS){ ITEMS[k].id = k; if (!ITEMS[k].stack) ITEMS[k].stack = 250; }

// ================= 配方 =================
// where: hand(便携合成) / furnace / assembler / refinery ; time 秒
const RECIPES = [
  // --- 熔炉 ---
  { id: 'iron',    out: { iron: 1 },    in: { iron_ore: 1 },  where: 'furnace', time: 2.4 },
  { id: 'copper',  out: { copper: 1 },  in: { copper_ore: 1 },where: 'furnace', time: 2.4 },
  { id: 'titanium',out: { titanium: 1 },in: { titanium_ore: 1 }, where: 'furnace', time: 3.6 },
  { id: 'gold',    out: { gold: 1 },    in: { gold_ore: 1 },  where: 'furnace', time: 3.0 },
  { id: 'glass_b', out: { glass_b: 1 }, in: { sand: 2 },      where: 'furnace', time: 2.0 },
  { id: 'stone_smelt', out: { stone: 1 }, in: { dirt: 4 },    where: 'furnace', time: 2.0, hidden: true },
  // --- 便携/装配 通用 ---
  { id: 'gear',    out: { gear: 1 },    in: { iron: 2 },              where: 'both', time: 1.6 },
  { id: 'wire',    out: { wire: 2 },    in: { copper: 1 },            where: 'both', time: 1.2 },
  { id: 'circuit', out: { circuit: 1 }, in: { wire: 3, iron: 1 },     where: 'both', time: 3.2 },
  { id: 'plate',   out: { plate: 1 },   in: { iron: 3, carbon: 2 },   where: 'both', time: 2.8 },
  { id: 'data',    out: { data: 1 },    in: { circuit: 1, carbon: 5 },where: 'both', time: 4.0 },
  { id: 'planks_b',out: { planks_b: 4 },in: { carbon: 4 },            where: 'both', time: 1.0 },
  { id: 'lamp_b',  out: { lamp_b: 2 },  in: { glass_b: 2, wire: 1 },  where: 'both', time: 1.5 },
  // --- 机器制造（便携+装配）---
  { id: 'furnace_b',  out: { furnace_b: 1 },  in: { stone: 12 },                              where: 'both', time: 2.0 },
  { id: 'beacon_b',   out: { beacon_b: 1 },   in: { iron: 4, glass_b: 2, wire: 2 },           where: 'both', time: 2.0 },
  { id: 'burner_b',   out: { burner_b: 1 },   in: { iron: 8, gear: 4, stone: 6 },             where: 'both', time: 4.0, tech: 'automation' },
  { id: 'wind_b',     out: { wind_b: 1 },     in: { iron: 6, gear: 4, circuit: 1 },           where: 'both', time: 4.0, tech: 'power' },
  { id: 'chest_b',    out: { chest_b: 1 },    in: { planks_b: 6, iron: 2 },                   where: 'both', time: 2.0, tech: 'logistics' },
  { id: 'collector_b',out: { collector_b: 1 },in: { planks_b: 4, iron: 4 },                   where: 'both', time: 2.0, tech: 'logistics' },
  { id: 'lumberbot_b',out: { lumberbot_b: 1 },in: { iron: 6, gear: 2, wire: 2 },              where: 'both', time: 3.0, tech: 'automation' },
  { id: 'miner_b',    out: { miner_b: 1 },    in: { iron: 10, gear: 4, circuit: 1 },          where: 'both', time: 5.0, tech: 'automation' },
  { id: 'belt_b',     out: { belt_b: 2 },     in: { iron: 2, gear: 1 },                       where: 'both', time: 1.4, tech: 'automation' },
  { id: 'solar_b',    out: { solar_b: 1 },    in: { iron: 5, glass_b: 3, circuit: 1 },        where: 'both', time: 4.0, tech: 'power' },
  { id: 'assembler_b',out: { assembler_b: 1 },in: { iron: 12, gear: 6, circuit: 3 },          where: 'both', time: 6.0, tech: 'assembly' },
  { id: 'refinery_b', out: { refinery_b: 1 }, in: { iron: 10, copper: 6, circuit: 2, stone: 8 }, where: 'both', time: 6.0, tech: 'refining' },
  { id: 'reactor_b',  out: { reactor_b: 1 },  in: { titanium: 12, circuit: 8, plate: 4, uranium: 4 }, where: 'both', time: 12.0, tech: 'nuclear' },
  { id: 'launchpad_b',out: { launchpad_b: 1 },in: { titanium: 8, plate: 6, circuit: 4 },      where: 'both', time: 8.0, tech: 'spaceport' },
  // --- 精炼厂 / 便携 ---
  { id: 'fuel',    out: { fuel: 1 },     in: { carbon: 25, oxygen: 10 },   where: 'both', time: 8.0 },
  { id: 'fuel2',   out: { fuel: 2 },     in: { coal: 15, oxygen: 12 },     where: 'refinery', time: 9.0, tech: 'refining' },
  { id: 'carbon_x',out: { carbon: 3 },   in: { coal: 1 },                  where: 'refinery', time: 1.5 },
  { id: 'oxy_x',   out: { oxygen: 2 },   in: { sodium: 1, carbon: 1 },     where: 'refinery', time: 2.0 },
  // --- 曲率科技链（极难/高价值材料）---
  { id: 'antimatter', out: { antimatter: 1 }, in: { uranium: 20, tritium: 100, circuit: 10, gold: 5 }, where: 'refinery', time: 30.0, tech: 'nuclear' },
  { id: 'warpcell',out: { warpcell: 1 }, in: { antimatter: 3, gold: 20, titanium: 30, data: 20 }, where: 'refinery', time: 60.0, tech: 'warp' },
  // 便携曲速电池（应急合成，代价更高）
  { id: 'warp_hand',out: { warpcell: 1 }, in: { antimatter: 4, gold: 25, titanium: 40, data: 25, fuel: 5 }, where: 'both', time: 90.0, tech: 'warp' },
];
const RECIPE_BY_ID = {}; RECIPES.forEach(r => RECIPE_BY_ID[r.id] = r);

// 熔炉燃料价值（秒）
const FUEL_VALUE = { carbon: 4, coal: 16, planks_b: 3 };

// ================= 科技树 =================
// cost: {item:n}  time: 研究秒数  pos: 树中坐标
const TECH = {
  survival:  { name: '生存本能', icon: 'carbon', cost: {}, time: 0, pos: [60, 380], desc: '基础采集与合成。', unlocked: true, req: [] },
  scan1:     { name: '扫描增幅 I', icon: 'data', cost: { data: 4 }, time: 10, pos: [230, 200], req: ['survival'], desc: '矿物扫描范围 24→48 格（按 C 扫描）。' },
  scan2:     { name: '扫描增幅 II', icon: 'circuit', cost: { data: 15, circuit: 4 }, time: 20, pos: [400, 120], req: ['scan1'], desc: '矿物扫描范围 48→80 格。' },
  metallurgy:{ name: '冶金学', icon: 'furnace_b', cost: { data: 2 }, time: 8, pos: [230, 380], req: ['survival'], desc: '解锁熔炉高效冶炼。' },
  automation:{ name: '自动化', icon: 'miner_b', cost: { data: 5 }, time: 15, pos: [400, 260], req: ['metallurgy'], desc: '解锁自动采矿机、传送带与火力发电机。' },
  logistics: { name: '物流学', icon: 'chest_b', cost: { data: 4 }, time: 12, pos: [400, 500], req: ['metallurgy'], desc: '解锁储物箱与物品分流。' },
  power:     { name: '清洁能源', icon: 'solar_b', cost: { data: 8 }, time: 20, pos: [570, 260], req: ['automation'], desc: '解锁太阳能板与风力涡轮机。' },
  assembly:  { name: '装配流水线', icon: 'assembler_b', cost: { data: 12 }, time: 25, pos: [570, 440], req: ['automation', 'logistics'], desc: '解锁装配机，自动制造部件。' },
  refining:  { name: '化学精炼', icon: 'refinery_b', cost: { data: 15 }, time: 30, pos: [740, 340], req: ['power', 'assembly'], desc: '解锁精炼厂：高效燃料与化合物。' },
  spaceport: { name: '航天工程', icon: 'launchpad_b', cost: { data: 20, titanium: 10 }, time: 35, pos: [910, 260], req: ['refining'], desc: '解锁发射平台与飞船舱位扩容。' },
  nuclear:   { name: '核裂变', icon: 'reactor_b', cost: { data: 30, uranium: 5 }, time: 45, pos: [910, 440], req: ['refining'], desc: '解锁核子反应堆，能源自由！' },
  trade_ai:  { name: '贸易协议', icon: 'gold', cost: { data: 18, gold: 3 }, time: 25, pos: [1080, 340], req: ['spaceport'], desc: '空间站交易价格优惠 15%。' },
  warp:      { name: '曲率理论', icon: 'warpcell', cost: { data: 60, tritium: 50 }, time: 60, pos: [1250, 340], req: ['trade_ai', 'nuclear'], desc: '解锁曲率电池——通往群星的船票。' },
};
for (const k in TECH) TECH[k].id = k;

// ================= 星球生态 =================
const BIOMES = {
  lush:   { name: '翠绿星球', grass: 'grass', dirt: 'dirt', deep: 'stone', sky: [0.48, 0.72, 0.95], fog: [0.7, 0.85, 1.0], haz: null, hazName: '宜居', trees: 0.012, flowers: 0.02, oreMul: 1.0, tint: 0x7cc44f },
  desert: { name: '灼热荒漠', grass: 'sand', dirt: 'sand', deep: 'stone', sky: [0.95, 0.75, 0.5], fog: [0.98, 0.85, 0.65], haz: 'heat', hazName: '☀ 极端高温', hazRate: 1.6, trees: 0.001, flowers: 0.008, oreMul: 1.3, tint: 0xe0d29a },
  frozen: { name: '冰封世界', grass: 'snow', dirt: 'dirt', deep: 'ice', sky: [0.7, 0.8, 0.95], fog: [0.85, 0.9, 1.0], haz: 'cold', hazName: '❄ 酷寒', hazRate: 1.4, trees: 0.004, flowers: 0.006, oreMul: 1.2, tint: 0xf2f6fa },
  volcanic:{ name: '熔火之地', grass: 'basalt', dirt: 'basalt', deep: 'basalt', sky: [0.5, 0.28, 0.2], fog: [0.6, 0.4, 0.3], haz: 'heat', hazName: '🌋 炽热大气', hazRate: 2.2, trees: 0.0, flowers: 0.004, oreMul: 2.0, tint: 0x3a3a42, dry: true },
  alien:  { name: '异星菌境', grass: 'alien', dirt: 'dirt', deep: 'stone', sky: [0.45, 0.3, 0.6], fog: [0.6, 0.45, 0.75], haz: 'toxic', hazName: '☣ 剧毒孢子', hazRate: 1.8, trees: 0.008, flowers: 0.03, oreMul: 1.5, tint: 0x9a5fd0 },
  // ---- 新星球类型 ----
  ocean:  { name: '蔚蓝海球', grass: 'grass', dirt: 'sand', deep: 'stone', sky: [0.35, 0.62, 0.88], fog: [0.6, 0.8, 0.95], haz: null, hazName: '宜居', trees: 0.007, flowers: 0.014, oreMul: 0.9, tint: 0x3e8ed6, seaLift: 7 },
  crystal:{ name: '晶簇冻土', grass: 'snow', dirt: 'dirt', deep: 'ice', sky: [0.55, 0.75, 0.85], fog: [0.75, 0.9, 0.95], haz: 'cold', hazName: '❄ 晶界酷寒', hazRate: 1.7, trees: 0, flowers: 0.004, oreMul: 1.4, tint: 0x7fe8e0, crystals: 0.02 },
  fungal: { name: '巨菌之森', grass: 'alien', dirt: 'dirt', deep: 'stone', sky: [0.5, 0.38, 0.55], fog: [0.68, 0.55, 0.72], haz: 'toxic', hazName: '☣ 菌孢瘴气', hazRate: 1.3, trees: 0.010, flowers: 0.02, oreMul: 1.2, tint: 0xc06fd8, mushroom: true },
  ashen:  { name: '灰烬荒原', grass: 'ash', dirt: 'ash', deep: 'basalt', sky: [0.45, 0.42, 0.4], fog: [0.6, 0.58, 0.55], haz: 'rad', hazName: '☢ 辐射尘暴', hazRate: 2.0, trees: 0, flowers: 0.003, oreMul: 1.8, tint: 0x8a8a8a },
  // ---- 更多星球类型 ----
  amber:  { name: '金珀沙海', grass: 'amber', dirt: 'sand', deep: 'stone', sky: [0.92, 0.72, 0.42], fog: [0.98, 0.85, 0.6], haz: 'heat', hazName: '☀ 灼金热浪', hazRate: 1.2, trees: 0.001, flowers: 0.006, oreMul: 1.1, tint: 0xe0a63a,
    desc: '远古树脂凝成的琥珀荒漠，岩层中封存着黄金与史前碳。' },
  ferrous:{ name: '磁暴铁原', grass: 'rust', dirt: 'rust', deep: 'basalt', sky: [0.55, 0.4, 0.32], fog: [0.7, 0.55, 0.45], haz: 'storm', hazName: '⚡ 磁暴侵蚀', hazRate: 1.5, trees: 0, flowers: 0.004, oreMul: 1.6, tint: 0xa86a4a,
    desc: '整颗星球是一块生锈的陨铁，磁暴撕扯着每一件金属装备。' },
  murk:   { name: '荧光沼泽', grass: 'murk', dirt: 'dirt', deep: 'stone', sky: [0.16, 0.3, 0.28], fog: [0.25, 0.42, 0.38], haz: 'toxic', hazName: '☣ 沼气瘴雾', hazRate: 1.1, trees: 0.004, flowers: 0.035, oreMul: 1.0, tint: 0x2e8a72, seaLift: 4, mushroom: true,
    flora: ['glow_shroom', 'glow_shroom', 'oxygen_plant'],
    desc: '永暮的湿地被荧光蕈照亮，是氧气与钠的天然温室。' },
  salt:   { name: '盐晶滩', grass: 'salt', dirt: 'salt', deep: 'stone', sky: [0.8, 0.85, 0.9], fog: [0.92, 0.95, 0.98], haz: null, hazName: '宜居', trees: 0, flowers: 0.008, oreMul: 1.0, tint: 0xe8ecf0,
    flora: ['sodium_plant', 'sodium_plant', 'fern'],
    desc: '一望无际的白色盐原，脚下每一块地面都是钠矿。' },
  obsidian:{ name: '黑曜熔壁', grass: 'obsidian', dirt: 'obsidian', deep: 'basalt', sky: [0.28, 0.22, 0.35], fog: [0.4, 0.32, 0.48], haz: 'heat', hazName: '☀ 曜岩余温', hazRate: 1.9, trees: 0, flowers: 0.002, oreMul: 1.7, tint: 0x2a2a35, dry: true,
    desc: '冷却的熔岩玻璃覆盖全球，坚硬、锋利、闪着幽紫的光。' },
  redmoss:{ name: '红藓高原', grass: 'redmoss', dirt: 'dirt', deep: 'stone', sky: [0.75, 0.5, 0.42], fog: [0.88, 0.68, 0.58], haz: 'cold', hazName: '❄ 稀薄冷风', hazRate: 1.1, trees: 0.003, flowers: 0.012, oreMul: 1.15, tint: 0xc25a48,
    desc: '猩红苔藓吞没了古老山脉，像一颗永远处于黄昏的星球。' },
  hive:   { name: '蜂窝穹丘', grass: 'hive', dirt: 'hive', deep: 'stone', sky: [0.85, 0.6, 0.3], fog: [0.95, 0.75, 0.45], haz: 'toxic', hazName: '☣ 信息素迷雾', hazRate: 1.5, trees: 0, flowers: 0.01, oreMul: 1.3, tint: 0xd8862a,
    desc: '不知是谁筑起了覆盖星球的六角巢穴——而它们还在里面。' },
};

// 生物类型（按星球生态）
const CREATURE_TYPES = {
  crab:    { w: 0.55, h: 0.4, d: 0.7, headW: 0.2, speed: 0.7, jump: false },
  strider: { w: 0.35, h: 1.1, d: 0.35, headW: 0.22, speed: 1.8, jump: true },
  blob:    { w: 0.7, h: 0.5, d: 0.7, headW: 0.0, speed: 0.35, jump: false },
  drone:   { w: 0.3, h: 0.3, d: 0.6, headW: 0.15, speed: 2.4, jump: true, fly: true },
};
// 每个生态一种特色生物（所有星球都有生物）
BIOMES.lush.animal    = { body: 0x8a9e56, legs: 0x5e7038, eye: 0x2a2a2a, count: 10, name: '草原跳羚', type: 'strider' };
BIOMES.desert.animal  = { body: 0xd8b878, legs: 0xa8895a, eye: 0x442200, count: 7, name: '沙壳甲虫', type: 'crab' };
BIOMES.frozen.animal  = { body: 0xdce8f0, legs: 0xb8c8d4, eye: 0x3399ff, count: 6, name: '霜绒兽', type: 'blob' };
BIOMES.volcanic.animal= { body: 0x5a4038, legs: 0xc94f1e, eye: 0xff6600, count: 5, name: '熔壳蟹', type: 'crab' };
BIOMES.alien.animal   = { body: 0x9a6fd8, legs: 0x7c4fba, eye: 0xffd14d, count: 8, name: '孢子爬行者', type: 'strider' };
BIOMES.ocean.animal   = { body: 0x4da6c8, legs: 0x2e7893, eye: 0xffffff, count: 8, name: '碧波滑行兽', type: 'blob' };
BIOMES.crystal.animal = { body: 0xaef0ea, legs: 0x5ec8c0, eye: 0x0a4f6e, count: 5, name: '晶背蟹', type: 'crab' };
BIOMES.fungal.animal  = { body: 0xd8a8e8, legs: 0x9a5fd0, eye: 0xff5a4e, count: 9, name: '菌帽跳虫', type: 'strider' };
BIOMES.ashen.animal   = { body: 0x6e6a66, legs: 0x3a3a3a, eye: 0x7dff56, count: 4, name: '灰烬潜行者', type: 'crab' };
BIOMES.amber.animal   = { body: 0xe8c060, legs: 0xa87828, eye: 0x5e3808, count: 6, name: '珀壳掘虫', type: 'crab' };
BIOMES.ferrous.animal = { body: 0x8a5a3a, legs: 0x4a4a52, eye: 0x35e0e8, count: 5, name: '磁尘甲兽', type: 'crab' };
BIOMES.murk.animal    = { body: 0x2e8a72, legs: 0x1a5244, eye: 0x4ee8b8, count: 9, name: '沼灯浮蜓', type: 'blob' };
BIOMES.salt.animal    = { body: 0xf0f2f4, legs: 0xc2c9ce, eye: 0x222222, count: 7, name: '盐羽鹬', type: 'strider' };
BIOMES.obsidian.animal= { body: 0x2a2a35, legs: 0x6a5a9a, eye: 0xff6600, count: 4, name: '曜甲蟹', type: 'crab' };
BIOMES.redmoss.animal = { body: 0xc25a48, legs: 0x8a3a2c, eye: 0xffe8a0, count: 8, name: '藓原掠行者', type: 'strider' };
BIOMES.hive.animal    = { body: 0xd8862a, legs: 0x8a5210, eye: 0x1a1a1a, count: 10, name: '蜂窝守卫', type: 'strider' };

// ================= 商品交易表 =================
const TRADE_GOODS = ['carbon','oxygen','sodium','coal','iron_ore','copper_ore','titanium_ore','gold_ore','uranium','tritium','iron','copper','titanium','gold','gear','wire','circuit','plate','data','fuel','glass_b','antimatter','warpcell'];
const STATION_BLUEPRINTS = [
  { tech: 'logistics', price: 800,  name: '蓝图：物流学' },
  { tech: 'power',     price: 1500, name: '蓝图：光伏能源' },
  { tech: 'refining',  price: 3000, name: '蓝图：化学精炼' },
  { tech: 'nuclear',   price: 8000, name: '蓝图：核裂变' },
];

// ================= 任务线 =================
// type: collect(拥有n个) / craft / place / tech / event
const QUESTS = [
  { id: 'q_wake', title: '苏醒', desc: '检查坠毁的飞船（靠近并按 E）', type: 'event', flag: 'checkedShip',
    dialog: '警报……船体完整性 34%。发射推进器损毁。旅行者，你需要资源来修复它。' },
  { id: 'q_carbon', title: '生命之碳', desc: '采集碳 ×15（挖掘树木与蕨类）', type: 'collect', item: 'carbon', n: 15,
    dialog: '激光采矿器已校准。瞄准植物长按左键。' },
  { id: 'q_sodium', title: '防护充能', desc: '采集钠 ×8（黄色花朵）', type: 'collect', item: 'sodium', n: 8,
    dialog: '环境防护正在耗尽，钠素花能为它充能。' },
  { id: 'q_stone', title: '开采岩层', desc: '采集岩石 ×12', type: 'collect', item: 'stone', n: 12 },
  { id: 'q_furnace', title: '第一座熔炉', desc: '合成并放置一座熔炉', type: 'place', block: 'furnace',
    dialog: '按 Tab 打开合成面板。熔炉是文明的第一束火光。' },
  { id: 'q_iron', title: '钢铁意志', desc: '熔炼铁锭 ×10（熔炉需要碳/煤作燃料）', type: 'collect', item: 'iron', n: 10 },
  { id: 'q_repair', title: '修复推进器', desc: '带着铁锭×10、碳×20 检查飞船', type: 'event', flag: 'shipRepaired',
    dialog: '推进器修复完毕！但燃料罐是空的……' },
  { id: 'q_tech', title: '科研起步', desc: '合成研究数据 ×2 并研究「冶金学」(按 T)', type: 'tech', tech: 'metallurgy' },
  { id: 'q_auto', title: '自动化黎明', desc: '研究「自动化」，放置自动采矿机于矿脉上', type: 'place', block: 'miner',
    dialog: '让机器为你工作。采矿机需要电力——先研究光伏能源，或用它旁边的手摇模式（效率减半）。' },
  { id: 'q_belt', title: '流水线', desc: '放置传送带 ×6，把矿石送进熔炉', type: 'place', block: 'belt', n: 6 },
  { id: 'q_power', title: '电力时代', desc: '研究「光伏能源」并放置 2 块太阳能板', type: 'place', block: 'solar', n: 2 },
  { id: 'q_refinery', title: '化学工厂', desc: '研究「化学精炼」并放置精炼厂', type: 'place', block: 'refinery' },
  { id: 'q_fuel', title: '飞向天空的燃料', desc: '合成发射燃料 ×2（Tab便携合成：碳×25+氧×10，精炼厂更高效）', type: 'collect', item: 'fuel', n: 2,
    dialog: '发射燃料配方已同步：碳×25 + 氧气×10。可在背包合成面板直接合成，或交给精炼厂批量生产。' },
  { id: 'q_launch', title: '起飞！', desc: '为飞船加注燃料并起飞（对飞船按 E，机上再按 E 可随处降落）', type: 'event', flag: 'launched',
    dialog: '所有系统就绪。点火倒计时……祝好运，旅行者。' },
  { id: 'q_station', title: '轨道灯塔', desc: '持续拉升冲出大气层，飞向空间站停靠（靠近按 E）', type: 'event', flag: 'docked',
    dialog: '侦测到空间站信号。拉起机头爬升，冲出大气层就能看到它。' },
  { id: 'q_trade', title: '第一桶金', desc: '在空间站完成一次交易', type: 'event', flag: 'traded' },
  { id: 'q_explore', title: '新世界', desc: '降落在另一颗星球上', type: 'event', flag: 'newPlanet',
    dialog: '每颗星球都有独特的生态与矿藏。熔火之地矿产翻倍……但小心高温。' },
  { id: 'q_nuclear', title: '原子之心', desc: '研究「核裂变」并建造核子反应堆', type: 'place', block: 'reactor' },
  { id: 'q_antimatter', title: '囚禁湮灭之光', desc: '精炼反物质 ×3（铀×20+氚×100+电路×10+金锭×5 each）', type: 'collect', item: 'antimatter', n: 3,
    dialog: '反物质——宇宙中最昂贵的物质。深挖铀矿、粉碎小行星采氚，或者用星币在空间站堆出来。' },
  { id: 'q_warp', title: '群星的船票', desc: '获得一枚曲率电池（精炼合成 或 空间站 ₪240000 购买）', type: 'collect', item: 'warpcell', n: 1,
    dialog: '曲率电池充能完毕。打开星系地图（太空中按 M），选一颗你喜欢的恒星。' },
  { id: 'q_leave', title: '第一章 · 飞出初始星系', desc: '在星系地图（M）中选择目标星系，执行曲速跃迁', type: 'event', flag: 'warpedOut',
    dialog: '跃迁成功——起源星系在身后化为一粒尘埃。第一章完结，而宇宙没有边界。旅行者，继续前进吧。' },
];

// 星系里的星球（固定布局，每档案随机种子着色）
// 初始星系（固定布局）
const DEFAULT_PLANETS = [
  { id: 0, biome: 'lush',    name: '始源星',   pos: [0, 0, 0],       radius: 150 },
  { id: 1, biome: 'desert',  name: '赤沙',     pos: [1800, 120, -900], radius: 130 },
  { id: 2, biome: 'frozen',  name: '霜白',     pos: [-1500, -200, -1700], radius: 140 },
  { id: 3, biome: 'volcanic',name: '熔核',     pos: [900, -100, 2300],  radius: 120 },
  { id: 4, biome: 'alien',   name: '紫瘴',     pos: [-2400, 250, 1100], radius: 145 },
];
const DEFAULT_STATION = [700, 200, -500];
let SYSTEM_PLANETS = DEFAULT_PLANETS.map(p => ({ ...p, pos: [...p.pos] }));
let STATION_POS = [...DEFAULT_STATION];
const HOME_GALAXY_SEED = 7777;

function resetGalaxy(){
  SYSTEM_PLANETS = DEFAULT_PLANETS.map(p => ({ ...p, pos: [...p.pos] }));
  STATION_POS = [...DEFAULT_STATION];
}

// 生成一个随机星系的星球布局（seed 决定内容，纯函数不产生副作用）
const GALAXY_PREFIX = ['天琴','杜鹃','狐尾','鲸落','银帆','烛龙','雾马','环蛇','曙光','霜港','孤灯','奔雷','碎星','拾荒','眠沙','赤弦','夜莺','枯苇','潮汐','洄游'];
const GALAXY_SUFFIX = ['-α','-β','-γ','-δ','-Ω','-Ⅲ','-Ⅶ','-Ⅸ','-Ⅻ','-Prime','-Minor','-Deep'];
function galaxyName(seed){
  if (seed === HOME_GALAXY_SEED) return '起源星系';
  const rnd = mulberry32(seed ^ 0x6A09E667);
  return GALAXY_PREFIX[(rnd() * GALAXY_PREFIX.length) | 0] + GALAXY_SUFFIX[(rnd() * GALAXY_SUFFIX.length) | 0];
}
function generateGalaxy(seed){
  const rnd = mulberry32(seed);
  const biomePool = ['lush','desert','frozen','volcanic','alien','ocean','crystal','fungal','ashen','amber','ferrous','murk','salt','obsidian','redmoss','hive'];
  const names = [
    '翠风','赤岭','霜穹','灰烬','荒星','渊蓝','绿溪','灼岩','冰环','晶尘',
    '紫涌','绯沙','苍脊','黯潮','辉冠','裂星','流火','雾原','雪锋','熔渊',
    '澜礁','菌歌','空悬','曜壁','沉塔','洄湾','铁穗','昙丘','烬柱','虹隙',
  ];
  const used = new Set();
  const planets = [];
  const count = 4 + ((rnd() * 4) | 0);       // 4~7 颗
  for (let i = 0; i < count; i++){
    let n;
    do { n = names[(rnd() * names.length) | 0]; } while (used.has(n));
    used.add(n);
    const b = biomePool[(rnd() * biomePool.length) | 0];
    const ang = i / count * Math.PI * 2 + rnd() * 0.8, dist = 800 + rnd() * 2400, el = (rnd() - 0.5) * 700;
    planets.push({
      id: i,
      biome: b,
      name: n,
      pos: [Math.cos(ang) * dist, el, Math.sin(ang) * dist],
      radius: 105 + rnd() * 70,
    });
  }
  // 保证至少一颗富碳星球（可获取燃料材料）
  if (!planets.some(p => ['lush','ocean','fungal','alien'].includes(p.biome))){
    planets[0].biome = ['lush','ocean','fungal'][(rnd() * 3) | 0];
  }
  // 空间站
  const stat = [1200 * (rnd() - 0.5), 300 + rnd() * 400, 1200 * (rnd() - 0.5)];
  // 市场波动
  const market = {};
  for (const g of TRADE_GOODS) market[g] = 0.75 + rnd() * 0.5;
  return { planets, station: stat, market, seed, name: galaxyName(seed) };
}

// 当前星系的备份（存档用）
function setGalaxy(gal){
  SYSTEM_PLANETS = gal.planets;
  STATION_POS = gal.station;
}
