/* ===== 数据表：物资 / 武器 / 护甲 / 干员 ===== */
"use strict";

const RARITY = {
  1: { name: "普通", cls: "r1", color: "#8d979e" },
  2: { name: "优良", cls: "r2", color: "#3f9d54" },
  3: { name: "精良", cls: "r3", color: "#3d84c0" },
  4: { name: "稀有", cls: "r4", color: "#9251c9" },
  5: { name: "珍稀", cls: "r5", color: "#d8a930" },
  6: { name: "传说", cls: "r6", color: "#e05340" }
};

const AMMO_TYPES = {
  "9x19":   { name: "9x19mm 手枪弹",    pack: 30, value: 900,  rarity: 1 },
  "45acp":  { name: ".45 ACP 手枪弹",   pack: 30, value: 1200, rarity: 2 },
  "556":    { name: "5.56x45mm 步枪弹", pack: 30, value: 2200, rarity: 2 },
  "762x39": { name: "7.62x39mm 步枪弹", pack: 30, value: 2400, rarity: 2 },
  "762x51": { name: "7.62x51mm 步枪弹", pack: 20, value: 3600, rarity: 3 },
  "12ga":   { name: "12 Gauge 独头弹",  pack: 12, value: 1500, rarity: 2 },
  "338":    { name: ".338 拉普阿弹",    pack: 10, value: 6000, rarity: 4 }
};

/* kind: loot / med / ammo / weapon / armor / helmet / bag / rig */
const ALL_DEFS = [
  { id:"screws",     kind:"loot", name:"螺丝钉",     rarity:1, value:800,    w:1, h:1 },
  { id:"cig",        kind:"loot", name:"香烟",       rarity:1, value:1400,   w:1, h:1 },
  { id:"water",      kind:"loot", name:"矿泉水",     rarity:1, value:1000,   w:1, h:1 },
  { id:"lighter",    kind:"loot", name:"打火机",     rarity:1, value:1200,   w:1, h:1 },
  { id:"duct",       kind:"loot", name:"强力胶带",   rarity:1, value:1600,   w:1, h:1 },
  { id:"gear",       kind:"loot", name:"精密齿轮",   rarity:2, value:3800,   w:1, h:1 },
  { id:"solder",     kind:"loot", name:"电烙铁",     rarity:2, value:4200,   w:1, h:1 },
  { id:"flash",      kind:"loot", name:"军用手电",   rarity:2, value:3600,   w:1, h:1 },
  { id:"vodka",      kind:"loot", name:"伏特加",     rarity:2, value:4800,   w:1, h:1 },
  { id:"toolkit",    kind:"loot", name:"工具套装",   rarity:2, value:5200,   w:2, h:1 },
  { id:"battery",    kind:"loot", name:"军用电池",   rarity:3, value:12000,  w:1, h:1 },
  { id:"radio",      kind:"loot", name:"车载电台",   rarity:3, value:16000,  w:2, h:1 },
  { id:"binocular",  kind:"loot", name:"军用望远镜", rarity:3, value:11000,  w:1, h:1 },
  { id:"gasmask",    kind:"loot", name:"防毒面具",   rarity:3, value:9500,   w:1, h:1 },
  { id:"harddisk",   kind:"loot", name:"加密硬盘",   rarity:3, value:15000,  w:1, h:1 },
  { id:"wine",       kind:"loot", name:"陈年红酒",   rarity:3, value:13000,  w:1, h:2 },
  { id:"intel",      kind:"loot", name:"机密文件",   rarity:4, value:48000,  w:1, h:1 },
  { id:"explosive",  kind:"loot", name:"军用炸药",   rarity:4, value:56000,  w:2, h:1 },
  { id:"nvg",        kind:"loot", name:"夜视仪",     rarity:4, value:62000,  w:2, h:1 },
  { id:"generator",  kind:"loot", name:"便携发电机", rarity:4, value:52000,  w:2, h:2 },
  { id:"medcomp",    kind:"loot", name:"军用医疗组件", rarity:4, value:45000, w:1, h:2 },
  { id:"goldbar",    kind:"loot", name:"金条",       rarity:5, value:160000, w:1, h:1 },
  { id:"watch",      kind:"loot", name:"古董怀表",   rarity:5, value:130000, w:1, h:1 },
  { id:"cipher",     kind:"loot", name:"军用密码机", rarity:6, value:380000, w:2, h:1 },
  { id:"painting",   kind:"loot", name:"失窃名画",   rarity:6, value:350000, w:2, h:2 },
  { id:"mandel",     kind:"loot", name:"曼德尔砖",   rarity:6, value:1080000, w:2, h:1 },
  { id:"heart_afr",  kind:"loot", name:"非洲之心",   rarity:6, value:920000, w:1, h:1 },

  { id:"bandage", kind:"med", name:"绷带",       rarity:1, value:2000,  w:1, h:1, heal:35,  useTime:2.2 },
  { id:"firstaid",kind:"med", name:"急救包",     rarity:3, value:9000,  w:1, h:1, heal:75,  useTime:4.0 },
  { id:"surgery", kind:"med", name:"军用手术包", rarity:4, value:26000, w:2, h:1, heal:999, useTime:7.0 },

  { id:"armor2", kind:"armor", name:"二级防弹背心", rarity:2, value:14000,  w:2, h:2, durability:60,  reduce:0.30 },
  { id:"armor3", kind:"armor", name:"三级战术背心", rarity:3, value:32000,  w:2, h:2, durability:100, reduce:0.42 },
  { id:"armor4", kind:"armor", name:"四级复合护甲", rarity:4, value:70000,  w:2, h:2, durability:140, reduce:0.52 },
  { id:"armor5", kind:"armor", name:"五级精制重甲", rarity:5, value:150000, w:2, h:2, durability:190, reduce:0.60 },
  { id:"armor6", kind:"armor", name:"六级特勤重甲", rarity:6, value:320000, w:2, h:2, durability:250, reduce:0.66 },
  { id:"helm2",  kind:"helmet", name:"二级战术头盔", rarity:2, value:9000,   w:1, h:1, durability:30,  reduce:0.30 },
  { id:"helm3",  kind:"helmet", name:"三级防弹头盔", rarity:3, value:22000,  w:1, h:1, durability:45,  reduce:0.42 },
  { id:"helm4",  kind:"helmet", name:"四级重型头盔", rarity:4, value:52000,  w:1, h:1, durability:65,  reduce:0.52 },
  { id:"helm6",  kind:"helmet", name:"六级特勤面盔", rarity:6, value:210000, w:1, h:1, durability:100, reduce:0.62 },

  { id:"bag1", kind:"bag", name:"侦察小背包", rarity:2, value:12000,  w:2, h:2, cols:4, rows:3 },
  { id:"bag2", kind:"bag", name:"突击背包",   rarity:3, value:30000,  w:2, h:2, cols:5, rows:4 },
  { id:"bag3", kind:"bag", name:"大型登山包", rarity:4, value:68000,  w:2, h:2, cols:6, rows:5 },
  { id:"rig1", kind:"rig", name:"轻型胸挂",   rarity:2, value:9000,   w:2, h:1, cols:4, rows:2 },
  { id:"rig2", kind:"rig", name:"战术胸挂",   rarity:3, value:24000,  w:2, h:1, cols:5, rows:2 },
  { id:"rig3", kind:"rig", name:"重型携行具", rarity:4, value:56000,  w:2, h:1, cols:6, rows:2 }
];
/* ---- 武器 ----
   dmg伤害 rpm射速 mag弹匣 reload换弹秒 spread散布(度)
   recoil后坐 auto全自动 pellets霰弹 range衰减起始(米) vClass视觉模型 */
const WEAPON_DEFS = [
  { id:"g17",    kind:"weapon", name:"G17 手枪",        rarity:1, value:6000,   w:1,h:1, slot:"secondary",
    ammo:"9x19", dmg:22, rpm:420, mag:17, reload:1.7, spread:0.8, recoil:0.9, auto:false, range:28, vClass:"pistol" },
  { id:"deagle", kind:"weapon", name:"沙漠之鹰",        rarity:4, value:52000,  w:1,h:1, slot:"secondary",
    ammo:"45acp", dmg:56, rpm:180, mag:7,  reload:2.1, spread:0.9, recoil:2.6, auto:false, range:34, vClass:"pistol" },
  { id:"smg45",  kind:"weapon", name:"SMG-45 冲锋枪",   rarity:2, value:24000,  w:2,h:1, slot:"primary",
    ammo:"45acp", dmg:26, rpm:640, mag:25, reload:2.2, spread:1.0, recoil:0.8, auto:true, range:32, vClass:"smg" },
  { id:"vector", kind:"weapon", name:"Vector 冲锋枪",   rarity:4, value:78000,  w:2,h:1, slot:"primary",
    ammo:"45acp", dmg:22, rpm:1050, mag:33, reload:2.4, spread:0.9, recoil:0.65, auto:true, range:30, vClass:"smg" },
  { id:"p90",    kind:"weapon", name:"P90 冲锋枪",      rarity:3, value:52000,  w:2,h:1, slot:"primary",
    ammo:"9x19", dmg:21, rpm:880, mag:50, reload:2.9, spread:0.95, recoil:0.7, auto:true, range:36, vClass:"smg" },
  { id:"akm",    kind:"weapon", name:"AKM 突击步枪",    rarity:2, value:36000,  w:3,h:1, slot:"primary",
    ammo:"762x39", dmg:34, rpm:600, mag:30, reload:2.5, spread:0.8, recoil:1.5, auto:true, range:48, vClass:"rifle", vModel:"rifle2" },
  { id:"m4a1",   kind:"weapon", name:"M4A1 突击步枪",   rarity:3, value:58000,  w:3,h:1, slot:"primary",
    ammo:"556", dmg:25, rpm:800, mag:30, reload:2.3, spread:0.6, recoil:1.0, auto:true, range:52, vClass:"rifle" },
  { id:"k416",   kind:"weapon", name:"K416 突击步枪",   rarity:4, value:96000,  w:3,h:1, slot:"primary",
    ammo:"556", dmg:27, rpm:850, mag:30, reload:2.2, spread:0.5, recoil:0.95, auto:true, range:56, vClass:"rifle" },
  { id:"qbz95",  kind:"weapon", name:"QBZ95-1 突击步枪", rarity:3, value:62000, w:3,h:1, slot:"primary",
    ammo:"556", dmg:26, rpm:720, mag:30, reload:2.4, spread:0.55, recoil:1.05, auto:true, range:54, vClass:"rifle" },
  { id:"scarh",  kind:"weapon", name:"SCAR-H 战斗步枪", rarity:4, value:110000, w:3,h:1, slot:"primary",
    ammo:"762x51", dmg:45, rpm:580, mag:20, reload:2.7, spread:0.7, recoil:1.9, auto:true, range:62, vClass:"rifle" },
  { id:"m250",   kind:"weapon", name:"M250 轻机枪",     rarity:5, value:180000, w:4,h:1, slot:"primary",
    ammo:"556", dmg:26, rpm:750, mag:100, reload:5.5, spread:1.1, recoil:1.3, auto:true, range:58, vClass:"lmg" },
  { id:"m870",   kind:"weapon", name:"M870 霰弹枪",     rarity:2, value:30000,  w:3,h:1, slot:"primary",
    ammo:"12ga", dmg:12, rpm:65, mag:5, reload:3.6, spread:3.6, recoil:3.2, auto:false, pellets:8, range:18, vClass:"shotgun" },
  { id:"m700",   kind:"weapon", name:"M700 狙击步枪",   rarity:3, value:70000,  w:4,h:1, slot:"primary",
    ammo:"762x51", dmg:88, rpm:45, mag:5, reload:3.2, spread:0.12, recoil:3.6, auto:false, range:120, vClass:"sniper", zoom:3.2 },
  { id:"awm",    kind:"weapon", name:"AWM 狙击步枪",    rarity:5, value:220000, w:4,h:1, slot:"primary",
    ammo:"338", dmg:135, rpm:38, mag:5, reload:3.6, spread:0.1, recoil:4.2, auto:false, range:150, vClass:"sniper", zoom:4.0 }
];
for (const w of WEAPON_DEFS) ALL_DEFS.push(w);

/* 弹药作为可堆叠物品 */
for (const [aid, a] of Object.entries(AMMO_TYPES)) {
  ALL_DEFS.push({ id:"ammo_"+aid, kind:"ammo", name:a.name+" x"+a.pack, rarity:a.rarity, value:a.value, w:1, h:1, ammo:aid, count:a.pack });
}

const DB = {};
for (const d of ALL_DEFS) DB[d.id] = d;
function DEF(id) { return DB[id]; }
/* ---- 干员（原创技能设定，向原作职业体系致敬） ---- */
const OPERATORS = [
  { id:"dwolf", name:"红狼", en:"D-Wolf", cls:"突击", color:"#e05340",
    desc:"前特种部队爆破手，擅长高速突入与近距离缠斗。",
    ability:{ name:"动力外骨骼冲刺", key:"Q", cd:22, dur:5,
      tip:"5秒内移动速度大幅提升" },
    passive:"疾跑速度 +8%",
    speedMul:1.08 },
  { id:"stinger", name:"蜂医", en:"Stinger", cls:"支援", color:"#3f9d54",
    desc:"战地医疗专家，携带蜂巢注射系统维持队伍续航。",
    ability:{ name:"蜂巢急救激素", key:"Q", cd:28, dur:5,
      tip:"5秒内持续恢复共60点生命" },
    passive:"医疗品使用速度 +25%",
    medMul:0.75 },
  { id:"luna", name:"露娜", en:"Luna", cls:"侦察", color:"#3d84c0",
    desc:"复合弓侦察兵，箭矢搭载传感器，洞悉一切动向。",
    ability:{ name:"侦察箭", key:"Q", cd:26, dur:8,
      tip:"8秒内标记附近敌人（透视轮廓）" },
    passive:"脚步声更轻，敌人听觉感知 -30%",
    noiseMul:0.7 },
  { id:"uluru", name:"乌鲁鲁", en:"Uluru", cls:"工程", color:"#d8a930",
    desc:"纵火专家，随身携带自制燃烧装置，无人敢近身。",
    ability:{ name:"燃烧榴弹", key:"Q", cd:24, dur:0,
      tip:"投掷燃烧弹，造成范围灼烧伤害" },
    passive:"爆炸/灼烧伤害承受 -20%",
    burnResist:0.8 }
];

/* ---- 地图 ---- */
const MAPS = [
  { id:"zerodam", name:"零号大坝", en:"ZERO DAM", unlocked:true,
    desc:"哈夫克水电枢纽，游荡者盘踞。常规行动 / 无战备要求",
    grad:["#20343f","#0d1a22"] },
  { id:"valley", name:"长弓溪谷", en:"LONGBOW VALLEY", unlocked:false,
    desc:"敌情侦察中…（本版本未开放）", grad:["#2b3b26","#141d10"] },
  { id:"brakkesh", name:"巴克什", en:"BRAKKESH", unlocked:false,
    desc:"敌情侦察中…（本版本未开放）", grad:["#4a3b22","#241a0c"] },
  { id:"space", name:"航天基地", en:"SPACE CITY", unlocked:false,
    desc:"敌情侦察中…（本版本未开放）", grad:["#333a4a","#151a24"] }
];

/* ---- 容器战利品表 ---- */
const LOOT_TABLES = {
  crate: { name:"收纳箱", search:2.4, rolls:[2,4], pool:[
    ["screws",22],["cig",18],["water",18],["lighter",14],["duct",14],
    ["gear",10],["solder",9],["flash",9],["vodka",8],["toolkit",6],
    ["battery",5],["binocular",4],["gasmask",4],["harddisk",3],["wine",3],
    ["bandage",8],["ammo_9x19",7],["ammo_556",5],["ammo_762x39",5],
    ["intel",1.2],["goldbar",0.35],["mandel",0.15],["heart_afr",0.1] ] },
  toolbox: { name:"工具箱", search:2.0, rolls:[2,3], pool:[
    ["screws",25],["duct",18],["gear",16],["solder",14],["toolkit",10],
    ["battery",7],["flash",8],["harddisk",4],["generator",1.5],["explosive",1.2] ] },
  medbox: { name:"医疗箱", search:2.0, rolls:[2,3], pool:[
    ["bandage",40],["firstaid",18],["water",12],["gasmask",6],
    ["surgery",5],["medcomp",3] ] },
  ammobox: { name:"弹药箱", search:1.8, rolls:[2,4], pool:[
    ["ammo_9x19",22],["ammo_45acp",18],["ammo_556",20],["ammo_762x39",18],
    ["ammo_762x51",10],["ammo_12ga",10],["ammo_338",3],["explosive",1.5] ] },
  weaponbox: { name:"武器箱", search:3.2, rolls:[1,2], pool:[
    ["smg45",16],["m870",14],["akm",15],["p90",9],["m4a1",10],["qbz95",8],
    ["vector",5],["k416",4],["scarh",3.5],["m700",4],["deagle",5],
    ["m250",1.2],["awm",0.9],["ammo_556",12],["ammo_762x39",10] ] },
  safe: { name:"保险柜", search:4.0, rolls:[1,3], pool:[
    ["goldbar",15],["watch",15],["intel",20],["cipher",11],["painting",8],
    ["harddisk",16],["mandel",5],["heart_afr",4],["explosive",8] ] },
  aircase: { name:"航空箱", search:3.5, rolls:[2,3], pool:[
    ["goldbar",13],["watch",11],["cipher",12],["painting",9],["intel",12],
    ["nvg",9],["explosive",7],["generator",6],["medcomp",6],
    ["armor5",4],["helm4",4],["awm",1.5],["m250",1.5],
    ["mandel",6],["heart_afr",5] ] },
  rare: { name:"高级物资箱", search:3.5, rolls:[2,3], pool:[
    ["intel",17],["nvg",12],["explosive",12],["generator",10],["medcomp",10],
    ["goldbar",8],["watch",7],["cipher",6],["painting",5],
    ["armor4",5],["helm4",4],["armor5",2],["mandel",3.5],["heart_afr",3] ] },
  corpse: { name:"游荡者", search:1.6, rolls:[1,3], pool:[
    ["cig",20],["water",15],["bandage",20],["ammo_9x19",12],["ammo_762x39",12],
    ["ammo_556",10],["vodka",8],["gear",6],["battery",4],["intel",1.5] ] }
};

/* ---- 黑市商店 ---- */
const SHOP_STOCK = {
  "武器": ["g17","smg45","m870","akm","p90","qbz95","m4a1","m700","vector","k416","scarh","deagle","m250","awm"],
  "防具": ["helm2","helm3","helm4","helm6","armor2","armor3","armor4","armor5","armor6"],
  "背包": ["rig1","rig2","rig3","bag1","bag2","bag3"],
  "医疗": ["bandage","firstaid","surgery"],
  "弹药": ["ammo_9x19","ammo_45acp","ammo_556","ammo_762x39","ammo_762x51","ammo_12ga","ammo_338"]
};
function shopPrice(def) { return Math.round(def.value * 1.15 / 100) * 100; }

function fmtCoin(n) { return (n|0).toLocaleString("en-US"); }
function weightedPick(pool) {
  let total = 0;
  for (const p of pool) total += p[1];
  let r = Math.random() * total;
  for (const p of pool) { r -= p[1]; if (r <= 0) return p[0]; }
  return pool[pool.length-1][0];
}
function rollLoot(tableId) {
  const t = LOOT_TABLES[tableId];
  const n = t.rolls[0] + Math.floor(Math.random() * (t.rolls[1] - t.rolls[0] + 1));
  const out = [];
  for (let i = 0; i < n; i++) out.push(weightedPick(t.pool));
  return out;
}
