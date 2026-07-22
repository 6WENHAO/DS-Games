// ===================== 数据定义 =====================
"use strict";

const STAT_DEFS = {
  maxHp:        { name: "最大生命", icon: "❤️", pct: false },
  hpRegen:      { name: "生命再生", icon: "💚", pct: false },
  lifeSteal:    { name: "生命偷取", icon: "🧛", pct: true },
  damagePct:    { name: "伤害",     icon: "💥", pct: true },
  meleeDamage:  { name: "近战伤害", icon: "🗡️", pct: false },
  rangedDamage: { name: "远程伤害", icon: "🔫", pct: false },
  elementalDamage:{ name: "元素伤害", icon: "🔥", pct: false },
  attackSpeed:  { name: "攻击速度", icon: "⚡", pct: true },
  critChance:   { name: "暴击几率", icon: "🎯", pct: true },
  engineering:  { name: "工程学",   icon: "🔧", pct: false },
  range:        { name: "射程",     icon: "📏", pct: false },
  armor:        { name: "护甲",     icon: "🛡️", pct: false },
  dodge:        { name: "闪避",     icon: "💨", pct: true },
  speed:        { name: "移速",     icon: "👟", pct: true },
  luck:         { name: "幸运",     icon: "🍀", pct: false },
  harvesting:   { name: "收获",     icon: "🌾", pct: false },
  pickupRange:  { name: "拾取范围", icon: "🧲", pct: false },
};

const TIER_NAMES = ["", "普通", "稀有", "史诗", "传说"];
const TIER_COLORS = ["", "#9e9e9e", "#4fa3e3", "#b06ae0", "#e35d5d"];

// ---------------------- 武器 ----------------------
// type: melee / ranged   scaling: 属性加成系数
const WEAPONS = [
  { id:"fist", name:"拳头", emoji:"👊", type:"melee", cls:"格斗",
    scaling:{meleeDamage:1.0}, critC:0.01, critM:1.5,
    tiers:[
      {dmg:4,  cd:0.55, range:110, kb:8,  pierce:1, price:5},
      {dmg:8,  cd:0.51, range:115, kb:8,  pierce:1, price:12},
      {dmg:15, cd:0.48, range:120, kb:10, pierce:2, price:25},
      {dmg:26, cd:0.44, range:130, kb:12, pierce:2, price:52},
    ]},
  { id:"stick", name:"棍棒", emoji:"🏏", type:"melee", cls:"原始",
    scaling:{meleeDamage:1.0}, critC:0.03, critM:1.5,
    tiers:[
      {dmg:6,  cd:0.78, range:160, kb:22, pierce:1, price:6},
      {dmg:12, cd:0.74, range:165, kb:24, pierce:1, price:14},
      {dmg:22, cd:0.70, range:172, kb:26, pierce:2, price:28},
      {dmg:38, cd:0.65, range:180, kb:30, pierce:2, price:56},
    ]},
  { id:"knife", name:"匕首", emoji:"🔪", type:"melee", cls:"精准",
    scaling:{meleeDamage:1.0}, critC:0.30, critM:2.0,
    tiers:[
      {dmg:5,  cd:0.45, range:120, kb:5, pierce:1, price:8},
      {dmg:9,  cd:0.42, range:125, kb:5, pierce:1, price:17},
      {dmg:16, cd:0.39, range:130, kb:6, pierce:1, price:34},
      {dmg:28, cd:0.35, range:138, kb:6, pierce:2, price:68},
    ]},
  { id:"spear", name:"长矛", emoji:"🔱", type:"melee", cls:"精准",
    scaling:{meleeDamage:1.1}, critC:0.05, critM:1.8,
    tiers:[
      {dmg:9,  cd:0.92, range:225, kb:15, pierce:2, price:10},
      {dmg:16, cd:0.88, range:235, kb:16, pierce:2, price:20},
      {dmg:28, cd:0.83, range:245, kb:18, pierce:3, price:40},
      {dmg:48, cd:0.78, range:260, kb:20, pierce:3, price:80},
    ]},
  { id:"axe", name:"巨斧", emoji:"🪓", type:"melee", cls:"重型",
    scaling:{meleeDamage:1.3}, critC:0.03, critM:2.0, sweep:true,
    tiers:[
      {dmg:14, cd:1.25, range:165, kb:25, pierce:99, price:12},
      {dmg:26, cd:1.20, range:172, kb:27, pierce:99, price:25},
      {dmg:45, cd:1.13, range:180, kb:30, pierce:99, price:50},
      {dmg:80, cd:1.05, range:192, kb:34, pierce:99, price:95},
    ]},
  { id:"hammer", name:"战锤", emoji:"🔨", type:"melee", cls:"重型",
    scaling:{meleeDamage:1.6}, critC:0.03, critM:2.0,
    tiers:[
      {dmg:22, cd:1.65, range:150, kb:65,  pierce:3, price:14},
      {dmg:40, cd:1.58, range:156, kb:70,  pierce:3, price:28},
      {dmg:70, cd:1.50, range:164, kb:78,  pierce:4, price:56},
      {dmg:120,cd:1.40, range:175, kb:88,  pierce:4, price:105},
    ]},
  { id:"torch", name:"火炬", emoji:"🕯️", type:"melee", cls:"元素",
    scaling:{elementalDamage:1.0}, critC:0.03, critM:1.5,
    tiers:[
      {dmg:4,  cd:0.80, range:140, kb:8, pierce:2, burn:2,  price:9},
      {dmg:8,  cd:0.76, range:146, kb:8, pierce:2, burn:4,  price:18},
      {dmg:14, cd:0.72, range:152, kb:9, pierce:3, burn:7,  price:36},
      {dmg:24, cd:0.66, range:160, kb:10,pierce:3, burn:12, price:72},
    ]},
  { id:"screwdriver", name:"螺丝刀", emoji:"🪛", type:"melee", cls:"工具",
    scaling:{engineering:1.2}, critC:0.05, critM:1.8,
    tiers:[
      {dmg:5,  cd:0.60, range:120, kb:5, pierce:1, price:7},
      {dmg:10, cd:0.56, range:125, kb:5, pierce:1, price:15},
      {dmg:18, cd:0.52, range:130, kb:6, pierce:2, price:30},
      {dmg:30, cd:0.48, range:138, kb:6, pierce:2, price:60},
    ]},
  { id:"pistol", name:"手枪", emoji:"🔫", type:"ranged", cls:"枪械",
    scaling:{rangedDamage:1.0}, critC:0.05, critM:2.0, projSpeed:750,
    tiers:[
      {dmg:12, cd:1.15, range:400, kb:10, pierce:1, price:9},
      {dmg:20, cd:1.10, range:420, kb:11, pierce:1, price:18},
      {dmg:35, cd:1.04, range:440, kb:12, pierce:2, price:36},
      {dmg:60, cd:0.97, range:470, kb:14, pierce:2, price:70},
    ]},
  { id:"smg", name:"冲锋枪", emoji:"💥", type:"ranged", cls:"枪械",
    scaling:{rangedDamage:0.5}, critC:0.01, critM:1.5, projSpeed:800, spread:0.16,
    tiers:[
      {dmg:3,  cd:0.18, range:320, kb:3, pierce:1, price:10},
      {dmg:5,  cd:0.17, range:335, kb:3, pierce:1, price:20},
      {dmg:8,  cd:0.16, range:350, kb:4, pierce:1, price:40},
      {dmg:14, cd:0.14, range:370, kb:4, pierce:1, price:80},
    ]},
  { id:"shotgun", name:"霰弹枪", emoji:"🧨", type:"ranged", cls:"重型",
    scaling:{rangedDamage:0.35}, critC:0.03, critM:1.8, projSpeed:650, spread:0.55,
    tiers:[
      {dmg:4,  cd:1.45, range:260, kb:15, pierce:1, count:4, price:12},
      {dmg:6,  cd:1.38, range:272, kb:16, pierce:1, count:5, price:24},
      {dmg:10, cd:1.30, range:285, kb:17, pierce:2, count:6, price:48},
      {dmg:16, cd:1.20, range:300, kb:18, pierce:2, count:7, price:90},
    ]},
  { id:"sniper", name:"狙击步枪", emoji:"🎯", type:"ranged", cls:"精准",
    scaling:{rangedDamage:1.5}, critC:0.30, critM:2.5, projSpeed:1200,
    tiers:[
      {dmg:25, cd:2.30, range:700, kb:30, pierce:3, price:14},
      {dmg:45, cd:2.20, range:720, kb:32, pierce:3, price:28},
      {dmg:80, cd:2.08, range:750, kb:35, pierce:4, price:55},
      {dmg:140,cd:1.92, range:790, kb:40, pierce:5, price:105},
    ]},
  { id:"slingshot", name:"弹弓", emoji:"🪃", type:"ranged", cls:"原始",
    scaling:{rangedDamage:0.8}, critC:0.03, critM:1.5, projSpeed:600,
    tiers:[
      {dmg:6,  cd:0.82, range:350, kb:8, pierce:1, price:5},
      {dmg:11, cd:0.78, range:365, kb:8, pierce:1, price:12},
      {dmg:19, cd:0.73, range:380, kb:9, pierce:2, price:24},
      {dmg:32, cd:0.68, range:400, kb:10,pierce:2, price:48},
    ]},
  { id:"laser", name:"激光枪", emoji:"📡", type:"ranged", cls:"元素",
    scaling:{elementalDamage:1.0}, critC:0.03, critM:1.5, projSpeed:950,
    tiers:[
      {dmg:8,  cd:1.05, range:450, kb:5, pierce:99, price:13},
      {dmg:14, cd:1.00, range:465, kb:5, pierce:99, price:26},
      {dmg:24, cd:0.94, range:480, kb:6, pierce:99, price:52},
      {dmg:40, cd:0.87, range:500, kb:6, pierce:99, price:98},
    ]},
  { id:"wand", name:"火焰法杖", emoji:"🪄", type:"ranged", cls:"元素",
    scaling:{elementalDamage:0.8}, critC:0.05, critM:1.6, projSpeed:550,
    tiers:[
      {dmg:6,  cd:0.95, range:380, kb:6, pierce:1, burn:2, price:10},
      {dmg:11, cd:0.90, range:395, kb:6, pierce:1, burn:3, price:20},
      {dmg:19, cd:0.85, range:410, kb:7, pierce:2, burn:5, price:40},
      {dmg:32, cd:0.79, range:430, kb:7, pierce:2, burn:8, price:78},
    ]},
];
const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));

// ---------------------- 道具 ----------------------
const ITEMS = [
  // 一阶
  { id:"bandage",   name:"创可贴",   emoji:"🩹", rarity:1, price:13, stats:{maxHp:3} },
  { id:"coffee",    name:"咖啡",     emoji:"☕", rarity:1, price:14, stats:{attackSpeed:10, maxHp:-2} },
  { id:"shoes",     name:"慢跑鞋",   emoji:"👟", rarity:1, price:14, stats:{speed:5, dodge:3} },
  { id:"clover",    name:"幸运草",   emoji:"🍀", rarity:1, price:13, stats:{luck:10} },
  { id:"sickle",    name:"小镰刀",   emoji:"🌾", rarity:1, price:14, stats:{harvesting:8} },
  { id:"magnet",    name:"磁铁",     emoji:"🧲", rarity:1, price:12, stats:{pickupRange:40} },
  { id:"glove",     name:"拳击手套", emoji:"🥊", rarity:1, price:14, stats:{meleeDamage:2, speed:-2} },
  { id:"scope",     name:"步枪瞄具", emoji:"🔭", rarity:1, price:14, stats:{rangedDamage:2, attackSpeed:-3} },
  { id:"candle",    name:"蜡烛",     emoji:"🕯️", rarity:1, price:13, stats:{elementalDamage:2, luck:-3} },
  { id:"helmet",    name:"头盔",     emoji:"⛑️", rarity:1, price:15, stats:{armor:2, speed:-3} },
  { id:"snail",     name:"蜗牛壳",   emoji:"🐌", rarity:1, price:13, stats:{hpRegen:2, speed:-2} },
  // 二阶
  { id:"protein",   name:"蛋白粉",   emoji:"🥤", rarity:2, price:30, stats:{meleeDamage:4, damagePct:5, harvesting:-4} },
  { id:"ammobox",   name:"弹药箱",   emoji:"📦", rarity:2, price:30, stats:{rangedDamage:4, attackSpeed:5, hpRegen:-1} },
  { id:"energy",    name:"能量饮料", emoji:"🥫", rarity:2, price:28, stats:{attackSpeed:15, maxHp:-3} },
  { id:"spikeshield",name:"尖刺护盾",emoji:"🛡️", rarity:2, price:32, stats:{armor:3, maxHp:3, dodge:-2} },
  { id:"fang",      name:"吸血獠牙", emoji:"🦷", rarity:2, price:34, stats:{lifeSteal:3, maxHp:-2} },
  { id:"medkit",    name:"急救包",   emoji:"💊", rarity:2, price:30, stats:{hpRegen:4, maxHp:3} },
  { id:"binocular", name:"望远镜",   emoji:"🔍", rarity:2, price:28, stats:{range:50, damagePct:-3} },
  { id:"luckycat",  name:"招财猫",   emoji:"🐱", rarity:2, price:32, stats:{luck:25, damagePct:-2} },
  { id:"fertilizer",name:"化肥",     emoji:"🧪", rarity:2, price:30, stats:{harvesting:16, speed:-3} },
  { id:"molotov",   name:"燃烧瓶",   emoji:"🍾", rarity:2, price:32, stats:{elementalDamage:5, maxHp:-2} },
  { id:"dumbbell",  name:"哑铃",     emoji:"🏋️", rarity:2, price:31, stats:{meleeDamage:3, maxHp:4, attackSpeed:-4} },
  // 三阶
  { id:"giantbelt", name:"巨人腰带", emoji:"🎗️", rarity:3, price:55, stats:{maxHp:12, speed:-4} },
  { id:"tacgoggle", name:"战术目镜", emoji:"🥽", rarity:3, price:58, stats:{critChance:10, rangedDamage:3} },
  { id:"berserker", name:"狂战之血", emoji:"🩸", rarity:3, price:60, stats:{damagePct:12, attackSpeed:8, armor:-2} },
  { id:"platearmor",name:"钢板护甲", emoji:"🦺", rarity:3, price:60, stats:{armor:5, maxHp:6, speed:-5, dodge:-3} },
  { id:"medbot",    name:"医疗机器人",emoji:"🤖", rarity:3, price:62, stats:{hpRegen:8, lifeSteal:2, engineering:2} },
  { id:"turbo",     name:"涡轮引擎", emoji:"🌀", rarity:3, price:55, stats:{speed:12, dodge:6, maxHp:-4} },
  { id:"cornucopia",name:"聚宝盆",   emoji:"🏺", rarity:3, price:65, stats:{harvesting:25, luck:15, damagePct:-4} },
  { id:"flamecore", name:"烈焰之心", emoji:"🔥", rarity:3, price:60, stats:{elementalDamage:8, maxHp:-3} },
  // 四阶
  { id:"dragonheart",name:"龙之心",  emoji:"🐉", rarity:4, price:95,  stats:{maxHp:20, hpRegen:5} },
  { id:"doomcore",  name:"毁灭核心", emoji:"☢️", rarity:4, price:105, stats:{damagePct:20, meleeDamage:5, rangedDamage:5, elementalDamage:5, maxHp:-5} },
  { id:"chronos",   name:"时空装置", emoji:"⏳", rarity:4, price:100, stats:{attackSpeed:25, speed:8, dodge:8, armor:-3} },
  { id:"midas",     name:"点金手",   emoji:"🤲", rarity:4, price:98,  stats:{harvesting:35, luck:30} },
  { id:"warbanner", name:"战争旗帜", emoji:"🚩", rarity:4, price:102, stats:{damagePct:10, attackSpeed:10, critChance:8, speed:5} },
];

// ---------------------- 角色 ----------------------
const CHARACTERS = [
  { id:"allround", name:"多面手", emoji:"🥔",
    desc:"均衡全面，属于新手的选择", stats:{maxHp:5, speed:5, harvesting:8, damagePct:5},
    startWeapons:["stick","pistol","knife","slingshot"] },
  { id:"warrior", name:"斗士", emoji:"💪",
    desc:"只能装备近战武器 / 近战伤害+3 / 攻速+10%", stats:{meleeDamage:3, attackSpeed:10, maxHp:5},
    forbid:"ranged", startWeapons:["fist","stick","knife","spear"] },
  { id:"gunner", name:"神枪手", emoji:"🤠",
    desc:"只能装备远程武器 / 远程伤害+3 / 暴击+10%", stats:{rangedDamage:3, critChance:10},
    forbid:"melee", startWeapons:["pistol","smg","slingshot","shotgun"] },
  { id:"farmer", name:"老农", emoji:"👨‍🌾",
    desc:"收获+30 / 幸运+10 / 移速-10% / 伤害-10%", stats:{harvesting:30, luck:10, speed:-10, damagePct:-10},
    startWeapons:["stick","slingshot","fist","screwdriver"] },
  { id:"doctor", name:"医师", emoji:"🧑‍⚕️",
    desc:"生命再生+8 / 生命偷取+5% / 伤害-10%", stats:{hpRegen:8, lifeSteal:5, maxHp:5, damagePct:-10},
    startWeapons:["knife","pistol","stick","wand"] },
  { id:"lucky", name:"幸运儿", emoji:"🎰",
    desc:"幸运+100 / 最大生命-3 / 伤害-5%", stats:{luck:100, maxHp:-3, damagePct:-5},
    startWeapons:["knife","slingshot","pistol","torch"] },
  { id:"giant", name:"巨人", emoji:"🗿",
    desc:"生命+20 / 护甲+3 / 伤害+10% / 移速-15% / 闪避-10%", stats:{maxHp:20, armor:3, damagePct:10, speed:-15, dodge:-10},
    startWeapons:["hammer","axe","stick","shotgun"] },
  { id:"mage", name:"法师", emoji:"🧙",
    desc:"元素伤害+5 / 射程+30 / 最大生命-3", stats:{elementalDamage:5, range:30, maxHp:-3},
    startWeapons:["wand","laser","torch","slingshot"] },
  { id:"lunatic", name:"疯子", emoji:"🤪",
    desc:"只能装备近战武器 / 攻速+25% / 最大生命-5", stats:{attackSpeed:25, meleeDamage:2, maxHp:-5},
    forbid:"ranged", startWeapons:["knife","fist","axe","torch"] },
  { id:"engineer", name:"工程师", emoji:"👷",
    desc:"工程学+5 / 收获+5 / 护甲+1", stats:{engineering:5, harvesting:5, armor:1},
    startWeapons:["screwdriver","smg","pistol","stick"] },
];

// ---------------------- 升级选项池 ----------------------
const UPGRADES = [
  { stat:"maxHp",        v:3 },
  { stat:"hpRegen",      v:2 },
  { stat:"lifeSteal",    v:1 },
  { stat:"damagePct",    v:5 },
  { stat:"meleeDamage",  v:1 },
  { stat:"rangedDamage", v:1 },
  { stat:"elementalDamage", v:1 },
  { stat:"attackSpeed",  v:5 },
  { stat:"critChance",   v:3 },
  { stat:"engineering",  v:1 },
  { stat:"range",        v:15 },
  { stat:"armor",        v:1 },
  { stat:"dodge",        v:3 },
  { stat:"speed",        v:3 },
  { stat:"luck",         v:5 },
  { stat:"harvesting",   v:4 },
];

// ---------------------- 敌人 ----------------------
const ENEMY_TYPES = {
  chaser:  { name:"小崽子", hp:3,  speed:100, dmg:1, r:12, value:1, color:"#7ec46a", ai:"chase" },
  fast:    { name:"疾行蛛", hp:2,  speed:195, dmg:1, r:10, value:1, color:"#c4b45a", ai:"chase" },
  tank:    { name:"胖墩",   hp:22, speed:52,  dmg:3, r:21, value:3, color:"#5a8fc4", ai:"chase" },
  shooter: { name:"吐籽者", hp:7,  speed:78,  dmg:1, r:13, value:2, color:"#c46ab4", ai:"shooter",
             shootCd:2.4, projDmg:2, projSpeed:260, keepDist:330 },
  charger: { name:"冲撞者", hp:12, speed:80,  dmg:2, r:15, value:2, color:"#c4735a", ai:"charger" },
  spawner: { name:"孵化母体", hp:32, speed:38, dmg:2, r:24, value:6, color:"#8a6ac4", ai:"spawner",
             spawnCd:4.0, spawnType:"chaser" },
  boss1:   { name:"精英屠夫", hp:380, speed:92, dmg:5, r:34, value:45, color:"#d44a4a", ai:"boss",
             shootCd:3.2, projDmg:3, projSpeed:300, ring:12, boss:true },
  boss2:   { name:"深渊魔薯", hp:950, speed:98, dmg:8, r:42, value:120, color:"#7a2ad4", ai:"boss",
             shootCd:2.4, projDmg:4, projSpeed:330, ring:18, boss:true },
};

// 每波允许出现的敌人权重
function waveEnemyPool(w) {
  const pool = [["chaser", 10]];
  if (w >= 3)  pool.push(["fast", 4 + w * 0.3]);
  if (w >= 5)  pool.push(["shooter", 3 + w * 0.25]);
  if (w >= 7)  pool.push(["tank", 2.5 + w * 0.2]);
  if (w >= 8)  pool.push(["charger", 3]);
  if (w >= 11) pool.push(["spawner", 1.5]);
  return pool;
}

function waveDuration(w) {
  if (w === 20) return 90;
  if (w === 10) return 60;
  return Math.min(60, 20 + (w - 1) * 5);
}

function waveSpawnInterval(w) { return Math.max(0.4, 1.7 - w * 0.068); }
function waveGroupSize(w) { return 1 + Math.floor(w / 4); }
function enemyHpMul(w) { return 1 + (w - 1) * 0.22 + (w - 1) * (w - 1) * 0.013; }
function enemyDmgMul(w) { return 1 + (w - 1) * 0.09; }

function xpNeeded(level) { return (level + 3) * (level + 3); }

// 商店价格随波次上涨
function scaledPrice(base, wave) { return Math.max(1, Math.round(base * (1 + 0.09 * (wave - 1)))); }

// 稀有度抽取（受波次与幸运影响）
function rollRarity(wave, luck) {
  const lf = 1 + luck / 100;
  const c4 = Math.min(25, Math.max(0, (wave - 7) * 2.2)) * lf;
  const c3 = Math.min(35, Math.max(0, (wave - 3) * 3.5)) * lf;
  const c2 = Math.min(55, Math.max(0, (wave - 1) * 6.5)) * lf;
  const r = Math.random() * 100;
  if (r < c4) return 4;
  if (r < c4 + c3) return 3;
  if (r < c4 + c3 + c2) return 2;
  return 1;
}

// 升级选项档次抽取
function rollUpgradeTier(luck) {
  const lf = 1 + luck / 100;
  const r = Math.random() * 100;
  if (r < 5 * lf) return 4;
  if (r < 15 * lf) return 3;
  if (r < 40 * lf) return 2;
  return 1;
}
