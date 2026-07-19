"use strict";
// ============================================================
//  方块星野 BlockWilds - 核心常量与注册契约
//  Minecraft 画风 × Outer Wilds 玩法 | 全程序化资源，无外部素材
// ============================================================
window.G = window.G || {};

G.CONF = {
  LOOP_SECONDS: 22 * 60,        // 超新星时间循环时长（可在设置中调整）
  CHUNK: 16,                    // 分块边长
  NEAR_RADIUS: 84,              // 近景真实体素网格化半径（方块）
  GRAVITY: 15.5,                // 星球表面重力加速度基准
  PLAYER_HEIGHT: 1.72,
  PLAYER_EYE: 1.58,
  PLAYER_RADIUS: 0.36,
  WALK_SPEED: 4.4,
  RUN_SPEED: 6.8,
  JUMP_SPEED: 7.6,
  JETPACK_ACC: 22,
  O2_MAX: 100, FUEL_MAX: 100, HP_MAX: 20,
  REACH: 5.2,
  TILE: 16,
  ATLAS_COLS: 8,
};

// ---------------- 贴图图集：瓦片名清单（textures.js 必须全部实现） ----------------
G.TILE_NAMES = [
  "grass_top","grass_side","dirt","stone","cobble","stone_brick","bedrock","sand",
  "sandstone_top","sandstone_side","red_sand","gravel","log_side","log_top","planks","leaves",
  "fir_leaves","glass","water","ice","snow","coal_ore","iron_ore","copper_ore",
  "torch","tallgrass","crafting_top","crafting_side","basalt","obsidian","ash","nomai_brick",
  "nomai_carved","nomai_text","nomai_metal","nomai_lamp","gravity_crystal","quantum_stone","ghost_matter","bramble",
  "bramble_thorn","vine_glow","lava","launch_pad","metal","lamp","campfire","chest"
];

// ---------------- 方块注册 ----------------
// tiles: [top, side, bottom] 或 单一; render: cube|cross|slab|liquid
// mat: 音效材质; emit: 自发光强度0-1; hard: 挖掘秒数(徒手); solid: 碰撞
G.BLOCK_DEFS = [
  { id:0,  key:"air",           name:"空气", solid:false, render:null },
  { id:1,  key:"grass",         name:"草方块", tiles:["grass_top","grass_side","dirt"], mat:"grass", hard:0.7, drops:"dirt" },
  { id:2,  key:"dirt",          name:"泥土", tiles:"dirt", mat:"grass", hard:0.6 },
  { id:3,  key:"stone",         name:"石头", tiles:"stone", mat:"stone", hard:1.8, drops:"cobble" },
  { id:4,  key:"cobble",        name:"圆石", tiles:"cobble", mat:"stone", hard:2.0 },
  { id:5,  key:"log",           name:"松木原木", tiles:["log_top","log_side","log_top"], mat:"wood", hard:1.5 },
  { id:6,  key:"leaves",        name:"松树叶", tiles:"leaves", mat:"grass", hard:0.3, alpha:true },
  { id:7,  key:"planks",        name:"木板", tiles:"planks", mat:"wood", hard:1.4 },
  { id:8,  key:"sand",          name:"沙子", tiles:"sand", mat:"sand", hard:0.6 },
  { id:9,  key:"sandstone",     name:"砂岩", tiles:["sandstone_top","sandstone_side","sandstone_top"], mat:"stone", hard:1.6 },
  { id:10, key:"red_sand",      name:"余烬沙", tiles:"red_sand", mat:"sand", hard:0.6 },
  { id:11, key:"gravel",        name:"沙砾", tiles:"gravel", mat:"sand", hard:0.7 },
  { id:12, key:"water",         name:"水", tiles:"water", mat:"water", render:"liquid", solid:false, alpha:true, hard:-1 },
  { id:13, key:"ice",           name:"冰", tiles:"ice", mat:"glass", hard:0.9, alpha:true },
  { id:14, key:"snow",          name:"雪块", tiles:"snow", mat:"snow", hard:0.5 },
  { id:15, key:"glass",         name:"玻璃", tiles:"glass", mat:"glass", hard:0.5, alpha:true, drops:null },
  { id:16, key:"coal_ore",      name:"煤矿石", tiles:"coal_ore", mat:"stone", hard:2.6, drops:"item:coal" },
  { id:17, key:"iron_ore",      name:"铁矿石", tiles:"iron_ore", mat:"stone", hard:3.2 },
  { id:18, key:"copper_ore",    name:"铜矿石", tiles:"copper_ore", mat:"stone", hard:3.0 },
  { id:19, key:"bedrock",       name:"基岩", tiles:"bedrock", mat:"stone", hard:-1 },
  { id:20, key:"torch",         name:"火把", tiles:"torch", render:"cross", solid:false, mat:"wood", hard:0.1, emit:0.9, light:12 },
  { id:21, key:"tallgrass",     name:"草", tiles:"tallgrass", render:"cross", solid:false, mat:"grass", hard:0.1, drops:null },
  { id:22, key:"crafting",      name:"工作台", tiles:["crafting_top","crafting_side","planks"], mat:"wood", hard:1.4, use:"craft" },
  { id:23, key:"basalt",        name:"玄武岩", tiles:"basalt", mat:"stone", hard:2.2 },
  { id:24, key:"obsidian",      name:"黑曜石", tiles:"obsidian", mat:"stone", hard:6.0 },
  { id:25, key:"ash",           name:"灰烬块", tiles:"ash", mat:"sand", hard:0.6 },
  { id:26, key:"nomai_brick",   name:"挪麦石砖", tiles:"nomai_brick", mat:"stone", hard:3.5 },
  { id:27, key:"nomai_carved",  name:"挪麦刻纹石砖", tiles:"nomai_carved", mat:"stone", hard:3.5, emit:0.25 },
  { id:28, key:"nomai_text",    name:"挪麦文字", tiles:"nomai_text", mat:"stone", hard:-1, emit:0.55, use:"nomai_text" },
  { id:29, key:"nomai_metal",   name:"挪麦合金", tiles:"nomai_metal", mat:"metal", hard:4.5 },
  { id:30, key:"nomai_lamp",    name:"挪麦灯", tiles:"nomai_lamp", mat:"crystal", hard:1.2, emit:1.0, light:14 },
  { id:31, key:"gravity_crystal",name:"重力晶体块", tiles:"gravity_crystal", mat:"crystal", hard:2.5, emit:0.8, light:10, alpha:true },
  { id:32, key:"quantum_stone", name:"量子石", tiles:"quantum_stone", mat:"crystal", hard:3.0, emit:0.3 },
  { id:33, key:"ghost_matter",  name:"幽灵物质", tiles:"ghost_matter", mat:"crystal", hard:-1, alpha:true, emit:0.35, damage:6, solid:false },
  { id:34, key:"bramble",       name:"黑棘木", tiles:"bramble", mat:"wood", hard:2.4 },
  { id:35, key:"bramble_thorn", name:"棘刺", tiles:"bramble_thorn", render:"cross", solid:false, mat:"grass", hard:0.2, damage:3 },
  { id:36, key:"vine_glow",     name:"发光藤", tiles:"vine_glow", render:"cross", solid:false, mat:"grass", hard:0.1, emit:0.8, light:11 },
  { id:37, key:"fir_leaves",    name:"雪松叶", tiles:"fir_leaves", mat:"grass", hard:0.3, alpha:true },
  { id:38, key:"lava",          name:"熔岩", tiles:"lava", render:"liquid", solid:false, alpha:false, mat:"stone", hard:-1, emit:1.0, light:15, damage:8 },
  { id:39, key:"launch_pad",    name:"发射平台", tiles:"launch_pad", mat:"metal", hard:3.0 },
  { id:40, key:"metal",         name:"金属板", tiles:"metal", mat:"metal", hard:3.0 },
  { id:41, key:"lamp",          name:"暖灯", tiles:"lamp", mat:"glass", hard:0.8, emit:1.0, light:13 },
  { id:42, key:"campfire",      name:"营火", tiles:"campfire", render:"slab", slabH:0.4, solid:false, mat:"wood", hard:0.8, emit:0.9, light:13, use:"campfire" },
  { id:43, key:"chest",         name:"补给箱", tiles:["log_top","chest","log_top"], mat:"wood", hard:1.6, use:"chest" },
  { id:44, key:"sandflow",      name:"流沙柱", tiles:"sand", mat:"sand", hard:-1, solid:false, alpha:true },
];

// ---------------- 非方块物品（icons.js 必须为每个绘制16x像素图标） ----------------
// rar: 0白 1黄 2青 3紫
G.ITEM_DEFS = [
  { key:"translator",   name:"挪麦翻译机", rar:2, desc:"对准挪麦文字破译远古信息|Nomai科技·青绿辉光", tool:true },
  { key:"signalscope",  name:"信号镜",     rar:2, desc:"侦测太阳系中的各频段信号|右键切换频段·滚轮变焦", tool:true },
  { key:"scout",        name:"小侦察兵发射器", rar:2, desc:"发射侦察探测器照亮远处|可标记幽灵物质", tool:true },
  { key:"marshmallow",  name:"棉花糖", rar:0, desc:"在营火上烤着吃|恢复生命", food:6, stack:16 },
  { key:"marshmallow_roasted", name:"烤棉花糖", rar:1, desc:"金黄酥脆，旅行者的慰藉|恢复大量生命", food:12, stack:16 },
  { key:"marshmallow_burnt",   name:"焦棉花糖", rar:0, desc:"烤过头了……|其实也能吃", food:2, stack:16 },
  { key:"stick",        name:"木棍", rar:0, desc:"基础合成材料", stack:64 },
  { key:"coal",         name:"煤炭", rar:0, desc:"燃料与冶炼材料", stack:64 },
  { key:"iron_ingot",   name:"铁锭", rar:0, desc:"冶炼自铁矿石", stack:64 },
  { key:"copper_ingot", name:"铜锭", rar:0, desc:"冶炼自铜矿石", stack:64 },
  { key:"oxygen_tank",  name:"备用氧气罐", rar:1, desc:"右键立即补充50%氧气|太空探索必备", stack:8, use:"oxygen" },
  { key:"fuel_tank",    name:"备用燃料罐", rar:1, desc:"右键立即补充50%喷气燃料|橙色渐变=燃料家族", stack:8, use:"fuel" },
  { key:"repair_kit",   name:"维修工具", rar:1, desc:"修复受损的飞船部件", stack:4 },
  { key:"lantern",      name:"提灯", rar:1, desc:"手持照明|温暖的火光", tool:true },
  { key:"nomai_scroll", name:"挪麦卷轴", rar:3, desc:"记录着挪麦人的记忆|可在飞船日志中回看", stack:16 },
  { key:"warp_core",    name:"先进跃迁核心", rar:3, desc:"灰烬双星计划的心脏|似乎能安放进飞船……", stack:1 },
];

// ---------------- 音效名清单（sfx.js 必须全部实现） ----------------
G.SFX_NAMES = {
  oneshot: [
    "dig_stone","dig_wood","dig_sand","dig_grass","dig_glass","dig_metal","dig_crystal","dig_snow","dig_water",
    "place_stone","place_wood","place_sand","place_grass","place_glass","place_metal","place_crystal","place_snow",
    "step_stone","step_wood","step_sand","step_grass","step_snow","step_metal",
    "ui_click","ui_open","ui_close","drag_pick","drag_put","pickup","drop","craft","eat","hurt","death",
    "translate_note","translate_done","signal_found","scout_launch","scout_beep","scout_recall",
    "ship_door","landing_thud","splash","geyser_burst","quantum_shift","loop_reset","log_update","discovery",
    "alarm_oxygen","alarm_fuel","marshmallow_catch_fire","statue_activate"
  ],
  loops: [
    "campfire","wind","space_drone","jetpack","ship_thrust","tornado","blackhole","heartbeat",
    "ghost_crackle","gravity_hum","signal_static","geyser","sand_flow","anglerfish"
  ]
};

// 全局快捷引用（blocks.js 填充）
G.BLOCKS = {}; G.BLOCK_BY_KEY = {}; G.ITEMS = {};
