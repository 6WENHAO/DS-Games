"use strict";
const DATA = {};

DATA.AU = 1.496e11;
DATA.DT = ["em","th","ki","ex"];
DATA.DT_CN = { em:"电磁", th:"热能", ki:"动能", ex:"爆炸" };
DATA.ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
DATA.SP_RATE = 45;
DATA.LVL_SP = [0, 250, 1414, 8000, 45255, 256000];

DATA.RACES = {
  amarr:   { cn:"艾玛帝国",   en:"Amarr Empire",    color:"#c8a45a", rookie:"impairor",
    desc:"新伊甸最庞大的神权帝国，信奉至高圣典。舰船以厚重装甲与激光武器著称。" },
  caldari: { cn:"加达里合众国", en:"Caldari State",  color:"#5a8ac8", rookie:"ibis",
    desc:"由巨型企业统治的国度，务实高效。舰船以强大护盾、导弹与磁轨炮见长。" },
  gallente:{ cn:"盖伦特联邦",  en:"Gallente Federation", color:"#5ac87e", rookie:"velator",
    desc:"崇尚自由与民主的联邦。舰船擅长近距离爆能炮与无人机作战。" },
  minmatar:{ cn:"米玛塔尔共和国", en:"Minmatar Republic", color:"#c86a5a", rookie:"reaper",
    desc:"从奴役中挣脱的部族联合。舰船速度极快，射弹武器不耗电容。" },
};

const RES_SHIELD = [0, .20, .40, .50];
const RES_ARMOR  = [.50, .45, .25, .10];
const RES_HULL   = [0, 0, 0, 0];

function ship(o){
  return Object.assign({
    cat:"ship", resShield:RES_SHIELD, resArmor:RES_ARMOR, resHull:RES_HULL,
    warp:5, maxTargets:4, bonuses:[], req:[], oreHold:0, miningMult:1,
  }, o);
}

DATA.SHIPS = {
  capsule: ship({ en:"Capsule", cn:"太空舱", race:"caldari", cls:"capsule", clsCN:"太空舱",
    shield:60, shieldRt:600, armor:60, hull:80, cap:120, capRt:60, speed:280, inertia:.06, mass:32000,
    sig:25, scanRes:750, tgtRange:20000, slots:{hi:0,mid:0,low:0}, cpu:0, pg:0, cargo:8, size:"S", price:0,
    desc:"液体填充的驾驶舱，克隆飞行员的最后庇护所。" }),

  impairor: ship({ en:"Impairor", cn:"因帕勒级", race:"amarr", cls:"rookie", clsCN:"新手船",
    shield:300, shieldRt:300, armor:400, hull:350, cap:250, capRt:125, speed:300, inertia:2.9, mass:1148000,
    sig:47, scanRes:560, tgtRange:30000, maxTargets:2, slots:{hi:2,mid:2,low:2}, cpu:130, pg:45, cargo:120,
    size:"S", price:2500, desc:"艾玛帝国的新手船，帝国的恩赐。" }),
  ibis: ship({ en:"Ibis", cn:"朱鹭级", race:"caldari", cls:"rookie", clsCN:"新手船",
    shield:400, shieldRt:300, armor:300, hull:350, cap:250, capRt:125, speed:295, inertia:2.9, mass:1163000,
    sig:47, scanRes:560, tgtRange:32000, maxTargets:2, slots:{hi:2,mid:2,low:2}, cpu:135, pg:42, cargo:120,
    size:"S", price:2500, desc:"加达里合众国的新手船。" }),
  velator: ship({ en:"Velator", cn:"维拉托级", race:"gallente", cls:"rookie", clsCN:"新手船",
    shield:350, shieldRt:300, armor:350, hull:400, cap:250, capRt:125, speed:305, inertia:2.9, mass:1148000,
    sig:47, scanRes:560, tgtRange:30000, maxTargets:2, slots:{hi:2,mid:2,low:2}, cpu:132, pg:44, cargo:120,
    size:"S", price:2500, desc:"盖伦特联邦的新手船。" }),
  reaper: ship({ en:"Reaper", cn:"收割者级", race:"minmatar", cls:"rookie", clsCN:"新手船",
    shield:350, shieldRt:300, armor:330, hull:350, cap:245, capRt:125, speed:320, inertia:2.8, mass:1126000,
    sig:46, scanRes:560, tgtRange:29000, maxTargets:2, slots:{hi:2,mid:2,low:2}, cpu:130, pg:42, cargo:120,
    size:"S", price:2500, desc:"米玛塔尔共和国的新手船。" }),

  punisher: ship({ en:"Punisher", cn:"惩罚者级", race:"amarr", cls:"frig", clsCN:"护卫舰",
    shield:400, shieldRt:625, armor:650, hull:500, cap:400, capRt:190, speed:295, inertia:3.1, mass:1163000,
    sig:37, scanRes:620, tgtRange:33000, slots:{hi:4,mid:2,low:4}, cpu:130, pg:62, cargo:135,
    size:"S", price:380000, req:[["frig",1]], bonuses:[{skill:"frig",wg:"laser",per:.05}],
    desc:"艾玛护卫舰。每级护卫舰指挥技能提高 5% 激光炮伤害。装甲厚重，堪称飞行堡垒。" }),
  executioner: ship({ en:"Executioner", cn:"行刑者级", race:"amarr", cls:"frig", clsCN:"护卫舰",
    shield:350, shieldRt:625, armor:450, hull:400, cap:370, capRt:175, speed:405, inertia:3.0, mass:1090000,
    sig:32, scanRes:660, tgtRange:30000, slots:{hi:3,mid:3,low:3}, cpu:125, pg:48, cargo:130,
    size:"S", price:340000, req:[["frig",1]], bonuses:[{skill:"frig",wg:"laser",per:.05}],
    desc:"艾玛快速拦截护卫舰。每级护卫舰指挥技能提高 5% 激光炮伤害。" }),
  merlin: ship({ en:"Merlin", cn:"灰鹰级", race:"caldari", cls:"frig", clsCN:"护卫舰",
    shield:600, shieldRt:625, armor:400, hull:450, cap:360, capRt:175, speed:310, inertia:3.1, mass:1183000,
    sig:39, scanRes:650, tgtRange:36000, slots:{hi:3,mid:4,low:2}, cpu:180, pg:45, cargo:150,
    size:"S", price:390000, req:[["frig",1]], bonuses:[{skill:"frig",wg:"hybrid",per:.05}],
    desc:"加达里护盾护卫舰。每级护卫舰指挥技能提高 5% 混合炮伤害。" }),
  kestrel: ship({ en:"Kestrel", cn:"茶隼级", race:"caldari", cls:"frig", clsCN:"护卫舰",
    shield:600, shieldRt:625, armor:350, hull:400, cap:340, capRt:175, speed:325, inertia:3.0, mass:1113000,
    sig:37, scanRes:640, tgtRange:40000, slots:{hi:4,mid:4,low:2}, cpu:175, pg:42, cargo:160,
    size:"S", price:380000, req:[["frig",1]], bonuses:[{skill:"frig",wg:"missile",per:.05}],
    desc:"加达里导弹护卫舰。每级护卫舰指挥技能提高 5% 导弹伤害。" }),
  incursus: ship({ en:"Incursus", cn:"英丘沙斯级", race:"gallente", cls:"frig", clsCN:"护卫舰",
    shield:400, shieldRt:625, armor:550, hull:500, cap:370, capRt:180, speed:345, inertia:3.1, mass:1128000,
    sig:38, scanRes:640, tgtRange:31000, slots:{hi:3,mid:3,low:4}, cpu:140, pg:50, cargo:150,
    size:"S", price:390000, req:[["frig",1]], bonuses:[{skill:"frig",wg:"hybrid",per:.05},{skill:"frig",wg:"repair",per:.05}],
    desc:"盖伦特近战护卫舰。每级护卫舰指挥技能提高 5% 混合炮伤害与装甲维修量。" }),
  tristan: ship({ en:"Tristan", cn:"特里斯坦级", race:"gallente", cls:"frig", clsCN:"护卫舰",
    shield:450, shieldRt:625, armor:450, hull:500, cap:360, capRt:180, speed:335, inertia:3.05, mass:1090000,
    sig:39, scanRes:645, tgtRange:33000, slots:{hi:3,mid:3,low:3}, cpu:150, pg:46, cargo:145,
    size:"S", price:380000, req:[["frig",1]], bonuses:[{skill:"frig",wg:"hybrid",per:.05}],
    desc:"盖伦特多用途护卫舰。每级护卫舰指挥技能提高 5% 混合炮伤害。" }),
  rifter: ship({ en:"Rifter", cn:"裂谷级", race:"minmatar", cls:"frig", clsCN:"护卫舰",
    shield:450, shieldRt:625, armor:450, hull:400, cap:340, capRt:170, speed:365, inertia:3.0, mass:1067000,
    sig:35, scanRes:660, tgtRange:30000, slots:{hi:4,mid:3,low:3}, cpu:135, pg:44, cargo:140,
    size:"S", price:390000, req:[["frig",1]], bonuses:[{skill:"frig",wg:"proj",per:.05}],
    desc:"米玛塔尔传奇护卫舰，速度与火力兼备。每级护卫舰指挥技能提高 5% 射弹炮伤害。" }),
  breacher: ship({ en:"Breacher", cn:"破坏者级", race:"minmatar", cls:"frig", clsCN:"护卫舰",
    shield:550, shieldRt:625, armor:400, hull:400, cap:330, capRt:170, speed:355, inertia:3.0, mass:1075000,
    sig:36, scanRes:650, tgtRange:35000, slots:{hi:3,mid:4,low:3}, cpu:160, pg:40, cargo:150,
    size:"S", price:380000, req:[["frig",1]], bonuses:[{skill:"frig",wg:"missile",per:.05}],
    desc:"米玛塔尔导弹护卫舰。每级护卫舰指挥技能提高 5% 导弹伤害。" }),
  venture: ship({ en:"Venture", cn:"冒险级", race:"caldari", cls:"frig", clsCN:"采矿护卫舰",
    shield:450, shieldRt:625, armor:300, hull:550, cap:330, capRt:170, speed:335, inertia:3.05, mass:1200000,
    sig:40, scanRes:600, tgtRange:30000, slots:{hi:3,mid:3,low:1}, cpu:240, pg:45, cargo:50, oreHold:5000,
    size:"S", price:750000, req:[["frig",1],["mining",1]], miningMult:2,
    bonuses:[{skill:"frig",wg:"mining",per:.05}],
    desc:"ORE 设计的采矿护卫舰，采矿产量 +100%，配备 5,000 m³ 矿石舱。每级护卫舰指挥技能提高 5% 采矿产量。" }),

  coercer: ship({ en:"Coercer", cn:"强制者级", race:"amarr", cls:"dessie", clsCN:"驱逐舰",
    shield:700, shieldRt:750, armor:1200, hull:1100, cap:650, capRt:280, speed:255, inertia:3.4, mass:1800000,
    sig:69, scanRes:500, tgtRange:45000, maxTargets:5, slots:{hi:8,mid:2,low:3}, cpu:180, pg:105, cargo:390,
    size:"S", price:1600000, req:[["dessie",1]], bonuses:[{skill:"dessie",wg:"laser",per:.05}],
    desc:"艾玛驱逐舰，八门激光炮的移动炮台。每级驱逐舰指挥技能提高 5% 激光炮伤害。" }),
  cormorant: ship({ en:"Cormorant", cn:"鸬鹚级", race:"caldari", cls:"dessie", clsCN:"驱逐舰",
    shield:1100, shieldRt:750, armor:700, hull:900, cap:600, capRt:280, speed:250, inertia:3.5, mass:1900000,
    sig:72, scanRes:510, tgtRange:55000, maxTargets:5, slots:{hi:7,mid:4,low:2}, cpu:240, pg:75, cargo:450,
    size:"S", price:1600000, req:[["dessie",1]], bonuses:[{skill:"dessie",wg:"hybrid",per:.05}],
    desc:"加达里驱逐舰，远程磁轨平台。每级驱逐舰指挥技能提高 5% 混合炮伤害。" }),
  catalyst: ship({ en:"Catalyst", cn:"催化剂级", race:"gallente", cls:"dessie", clsCN:"驱逐舰",
    shield:800, shieldRt:750, armor:1000, hull:1100, cap:600, capRt:280, speed:265, inertia:3.4, mass:1750000,
    sig:70, scanRes:520, tgtRange:42000, maxTargets:5, slots:{hi:8,mid:2,low:3}, cpu:210, pg:82, cargo:400,
    size:"S", price:1600000, req:[["dessie",1]], bonuses:[{skill:"dessie",wg:"hybrid",per:.05}],
    desc:"盖伦特驱逐舰，爆能炮绞肉机。每级驱逐舰指挥技能提高 5% 混合炮伤害。" }),
  thrasher: ship({ en:"Thrasher", cn:"长尾鲨级", race:"minmatar", cls:"dessie", clsCN:"驱逐舰",
    shield:1000, shieldRt:750, armor:800, hull:900, cap:580, capRt:275, speed:280, inertia:3.3, mass:1700000,
    sig:68, scanRes:530, tgtRange:44000, maxTargets:5, slots:{hi:7,mid:3,low:3}, cpu:200, pg:78, cargo:420,
    size:"S", price:1600000, req:[["dessie",1]], bonuses:[{skill:"dessie",wg:"proj",per:.05}],
    desc:"米玛塔尔驱逐舰，火力密度惊人。每级驱逐舰指挥技能提高 5% 射弹炮伤害。" }),

  omen: ship({ en:"Omen", cn:"预兆级", race:"amarr", cls:"cruiser", clsCN:"巡洋舰",
    shield:1500, shieldRt:1000, armor:2100, hull:1900, cap:1350, capRt:320, speed:230, inertia:.52, mass:11010000,
    sig:125, scanRes:300, tgtRange:55000, maxTargets:6, slots:{hi:5,mid:3,low:6}, cpu:310, pg:900, cargo:420,
    size:"M", price:9800000, req:[["cruiser",1]], bonuses:[{skill:"cruiser",wg:"laser",per:.05}],
    desc:"艾玛巡洋舰。每级巡洋舰指挥技能提高 5% 激光炮伤害。", warp:3 }),
  caracal: ship({ en:"Caracal", cn:"卡拉卡尔级", race:"caldari", cls:"cruiser", clsCN:"巡洋舰",
    shield:2400, shieldRt:1000, armor:1300, hull:1700, cap:1250, capRt:330, speed:210, inertia:.55, mass:11290000,
    sig:135, scanRes:290, tgtRange:65000, maxTargets:6, slots:{hi:5,mid:5,low:4}, cpu:380, pg:700, cargo:450,
    size:"M", price:9800000, req:[["cruiser",1]], bonuses:[{skill:"cruiser",wg:"missile",per:.05}],
    desc:"加达里导弹巡洋舰。每级巡洋舰指挥技能提高 5% 导弹伤害。", warp:3 }),
  thorax: ship({ en:"Thorax", cn:"索拉克斯级", race:"gallente", cls:"cruiser", clsCN:"巡洋舰",
    shield:1700, shieldRt:1000, armor:1900, hull:2100, cap:1300, capRt:320, speed:240, inertia:.5, mass:10890000,
    sig:130, scanRes:295, tgtRange:52000, maxTargets:6, slots:{hi:5,mid:4,low:5}, cpu:330, pg:820, cargo:440,
    size:"M", price:9800000, req:[["cruiser",1]], bonuses:[{skill:"cruiser",wg:"hybrid",per:.05}],
    desc:"盖伦特近战巡洋舰。每级巡洋舰指挥技能提高 5% 混合炮伤害。", warp:3 }),
  rupture: ship({ en:"Rupture", cn:"破裂级", race:"minmatar", cls:"cruiser", clsCN:"巡洋舰",
    shield:1900, shieldRt:1000, armor:1900, hull:1800, cap:1200, capRt:310, speed:235, inertia:.52, mass:10970000,
    sig:125, scanRes:300, tgtRange:54000, maxTargets:6, slots:{hi:5,mid:4,low:5}, cpu:320, pg:800, cargo:450,
    size:"M", price:9800000, req:[["cruiser",1]], bonuses:[{skill:"cruiser",wg:"proj",per:.05}],
    desc:"米玛塔尔巡洋舰，久经战阵的老兵。每级巡洋舰指挥技能提高 5% 射弹炮伤害。", warp:3 }),

  prophecy: ship({ en:"Prophecy", cn:"预言级", race:"amarr", cls:"bc", clsCN:"战列巡洋舰",
    shield:3600, shieldRt:1250, armor:4800, hull:4500, cap:2900, capRt:480, speed:165, inertia:.7, mass:13450000,
    sig:265, scanRes:200, tgtRange:60000, maxTargets:7, slots:{hi:7,mid:4,low:6}, cpu:390, pg:1150, cargo:550,
    size:"M", price:46000000, req:[["bc",1]], bonuses:[{skill:"bc",wg:"laser",per:.05}],
    desc:"艾玛战列巡洋舰，装甲巨兽。每级战列巡洋舰指挥技能提高 5% 激光炮伤害。", warp:2.7 }),
  drake: ship({ en:"Drake", cn:"幼龙级", race:"caldari", cls:"bc", clsCN:"战列巡洋舰",
    shield:5500, shieldRt:1250, armor:3100, hull:4000, cap:2750, capRt:500, speed:160, inertia:.7, mass:13500000,
    sig:295, scanRes:195, tgtRange:70000, maxTargets:7, slots:{hi:7,mid:6,low:4}, cpu:450, pg:850, cargo:600,
    size:"M", price:47000000, req:[["bc",1]], bonuses:[{skill:"bc",wg:"missile",per:.05}],
    desc:"加达里战列巡洋舰，以无与伦比的护盾闻名。每级战列巡洋舰指挥技能提高 5% 导弹伤害。", warp:2.7 }),
  myrmidon: ship({ en:"Myrmidon", cn:"蛮妖级", race:"gallente", cls:"bc", clsCN:"战列巡洋舰",
    shield:3900, shieldRt:1250, armor:4400, hull:4600, cap:2850, capRt:490, speed:170, inertia:.69, mass:13300000,
    sig:270, scanRes:205, tgtRange:58000, maxTargets:7, slots:{hi:6,mid:5,low:6}, cpu:400, pg:1050, cargo:580,
    size:"M", price:46000000, req:[["bc",1]], bonuses:[{skill:"bc",wg:"hybrid",per:.05},{skill:"bc",wg:"repair",per:.05}],
    desc:"盖伦特战列巡洋舰。每级战列巡洋舰指挥技能提高 5% 混合炮伤害与装甲维修量。", warp:2.7 }),
  hurricane: ship({ en:"Hurricane", cn:"飓风级", race:"minmatar", cls:"bc", clsCN:"战列巡洋舰",
    shield:4400, shieldRt:1250, armor:4100, hull:4200, cap:2700, capRt:470, speed:185, inertia:.66, mass:13200000,
    sig:250, scanRes:210, tgtRange:62000, maxTargets:7, slots:{hi:7,mid:4,low:6}, cpu:400, pg:1100, cargo:600,
    size:"M", price:47000000, req:[["bc",1]], bonuses:[{skill:"bc",wg:"proj",per:.05}],
    desc:"米玛塔尔战列巡洋舰，风暴之锤。每级战列巡洋舰指挥技能提高 5% 射弹炮伤害。", warp:2.7 }),

  apocalypse: ship({ en:"Apocalypse", cn:"启示录级", race:"amarr", cls:"bs", clsCN:"战列舰",
    shield:6800, shieldRt:1800, armor:8200, hull:7800, cap:5700, capRt:950, speed:115, inertia:.12, mass:97100000,
    sig:400, scanRes:120, tgtRange:80000, maxTargets:7, slots:{hi:8,mid:4,low:7}, cpu:580, pg:11500, cargo:650,
    size:"L", price:195000000, req:[["bs",1]], bonuses:[{skill:"bs",wg:"laser",per:.05}],
    desc:"艾玛战列舰，黄金舰队的荣耀。每级战列舰指挥技能提高 5% 激光炮伤害。", warp:2 }),
  raven: ship({ en:"Raven", cn:"乌鸦级", race:"caldari", cls:"bs", clsCN:"战列舰",
    shield:8500, shieldRt:1800, armor:6100, hull:7000, cap:5350, capRt:1000, speed:113, inertia:.13, mass:99300000,
    sig:440, scanRes:115, tgtRange:90000, maxTargets:7, slots:{hi:7,mid:7,low:5}, cpu:700, pg:9000, cargo:680,
    size:"L", price:198000000, req:[["bs",1]], bonuses:[{skill:"bs",wg:"missile",per:.05}],
    desc:"加达里导弹战列舰，巡航导弹的代名词。每级战列舰指挥技能提高 5% 导弹伤害。", warp:2 }),
  megathron: ship({ en:"Megathron", cn:"万王宝座级", race:"gallente", cls:"bs", clsCN:"战列舰",
    shield:7200, shieldRt:1800, armor:7700, hull:7900, cap:5500, capRt:960, speed:125, inertia:.12, mass:98400000,
    sig:400, scanRes:120, tgtRange:75000, maxTargets:7, slots:{hi:7,mid:4,low:7}, cpu:620, pg:10500, cargo:665,
    size:"L", price:197000000, req:[["bs",1]], bonuses:[{skill:"bs",wg:"hybrid",per:.05}],
    desc:"盖伦特战列舰，联邦海军的旗帜。每级战列舰指挥技能提高 5% 混合炮伤害。", warp:2 }),
  tempest: ship({ en:"Tempest", cn:"暴风级", race:"minmatar", cls:"bs", clsCN:"战列舰",
    shield:7700, shieldRt:1800, armor:6900, hull:7100, cap:5200, capRt:930, speed:130, inertia:.115, mass:96700000,
    sig:390, scanRes:125, tgtRange:78000, maxTargets:7, slots:{hi:7,mid:5,low:6}, cpu:600, pg:10200, cargo:660,
    size:"L", price:196000000, req:[["bs",1]], bonuses:[{skill:"bs",wg:"proj",per:.05}],
    desc:"米玛塔尔战列舰，自由的暴风。每级战列舰指挥技能提高 5% 射弹炮伤害。", warp:2 }),

  badger: ship({ en:"Badger", cn:"獾级", race:"caldari", cls:"indy", clsCN:"工业舰",
    shield:900, shieldRt:1000, armor:600, hull:1600, cap:600, capRt:300, speed:120, inertia:1.0, mass:11800000,
    sig:200, scanRes:180, tgtRange:35000, maxTargets:3, slots:{hi:2,mid:4,low:3}, cpu:200, pg:80, cargo:3900,
    size:"S", price:1400000, req:[["industrial",1]], bonuses:[{skill:"industrial",wg:"cargo",per:.05}],
    desc:"加达里工业舰。每级工业船指挥技能提高 5% 货柜容量。", warp:4.5 }),
};

function mod(o){ return Object.assign({ cat:"module", vol:5, cap:0, cpu:1, pg:1, req:[] }, o); }

DATA.MODULES = {
  civ_gun: mod({ cn:"民用加特林射弹炮", slot:"hi", type:"turret", wg:"proj", size:"S", sigRes:40,
    dmg:{ki:3,ex:2}, cycle:2, optimal:1200, falloff:4000, tracking:.45, cap:0, cpu:1, pg:1, price:1000 }),
  civ_miner: mod({ cn:"民用采矿器", slot:"hi", type:"miner", size:"S", yield:25, cycle:60, optimal:10000,
    cap:1, cpu:1, pg:1, price:1000 }),
  spulse: mod({ cn:"小型脉冲激光炮 I", slot:"hi", type:"turret", wg:"laser", size:"S", sigRes:40,
    dmg:{em:6,th:3}, cycle:3, optimal:4500, falloff:1500, tracking:.34, cap:2.5, cpu:6, pg:5, price:25000 }),
  sbeam: mod({ cn:"小型集束激光炮 I", slot:"hi", type:"turret", wg:"laser", size:"S", sigRes:40,
    dmg:{em:8,th:4}, cycle:4.5, optimal:10000, falloff:2500, tracking:.12, cap:4, cpu:9, pg:7, price:30000 }),
  sblaster: mod({ cn:"轻型离子爆能炮 I", slot:"hi", type:"turret", wg:"hybrid", size:"S", sigRes:40,
    dmg:{th:7,ki:5}, cycle:2.5, optimal:1400, falloff:2500, tracking:.4, cap:1.5, cpu:8, pg:4, price:25000 }),
  srail: mod({ cn:"125毫米磁轨炮 I", slot:"hi", type:"turret", wg:"hybrid", size:"S", sigRes:40,
    dmg:{ki:6,th:4}, cycle:4, optimal:13000, falloff:5000, tracking:.1, cap:2, cpu:12, pg:5, price:30000 }),
  sac: mod({ cn:"125毫米加特林自动加农炮 I", slot:"hi", type:"turret", wg:"proj", size:"S", sigRes:40,
    dmg:{ex:5,ki:4}, cycle:2.5, optimal:1100, falloff:6000, tracking:.43, cap:0, cpu:5, pg:3, price:25000 }),
  sarty: mod({ cn:"250毫米轻型火炮 I", slot:"hi", type:"turret", wg:"proj", size:"S", sigRes:40,
    dmg:{ex:10,ki:5}, cycle:6, optimal:11000, falloff:7000, tracking:.07, cap:0, cpu:10, pg:6, price:30000 }),
  srocket: mod({ cn:"火箭发射器 I", slot:"hi", type:"launcher", wg:"missile", size:"S",
    dmg:{ki:14}, cycle:4, range:9000, exr:30, mvel:2200, cpu:6, pg:2, price:20000 }),
  slml: mod({ cn:"轻型导弹发射器 I", slot:"hi", type:"launcher", wg:"missile", size:"S",
    dmg:{ki:16}, cycle:6.5, range:28000, exr:45, mvel:3800, cpu:8, pg:3, price:30000 }),

  mpulse: mod({ cn:"中型脉冲激光炮 I", slot:"hi", type:"turret", wg:"laser", size:"M", sigRes:125,
    dmg:{em:16,th:8}, cycle:4, optimal:9000, falloff:3500, tracking:.11, cap:6, cpu:18, pg:80, price:550000, req:[["gunnery",2]] }),
  mbeam: mod({ cn:"中型集束激光炮 I", slot:"hi", type:"turret", wg:"laser", size:"M", sigRes:125,
    dmg:{em:22,th:11}, cycle:6, optimal:20000, falloff:6000, tracking:.045, cap:9, cpu:24, pg:100, price:600000, req:[["gunnery",2]] }),
  mblaster: mod({ cn:"重型电子爆能炮 I", slot:"hi", type:"turret", wg:"hybrid", size:"M", sigRes:125,
    dmg:{th:19,ki:14}, cycle:3.5, optimal:3000, falloff:6000, tracking:.13, cap:4, cpu:20, pg:70, price:550000, req:[["gunnery",2]] }),
  mrail: mod({ cn:"双管150毫米磁轨炮 I", slot:"hi", type:"turret", wg:"hybrid", size:"M", sigRes:125,
    dmg:{ki:16,th:11}, cycle:5, optimal:26000, falloff:10000, tracking:.035, cap:5, cpu:26, pg:90, price:600000, req:[["gunnery",2]] }),
  mac: mod({ cn:"220毫米自动加农炮 I", slot:"hi", type:"turret", wg:"proj", size:"M", sigRes:125,
    dmg:{ex:14,ki:10}, cycle:3.5, optimal:2400, falloff:12000, tracking:.15, cap:0, cpu:15, pg:55, price:550000, req:[["gunnery",2]] }),
  marty: mod({ cn:"720毫米榴弹炮 I", slot:"hi", type:"turret", wg:"proj", size:"M", sigRes:125,
    dmg:{ex:27,ki:13}, cycle:8.5, optimal:22000, falloff:14000, tracking:.023, cap:0, cpu:22, pg:110, price:600000, req:[["gunnery",2]] }),
  mhml: mod({ cn:"重型导弹发射器 I", slot:"hi", type:"launcher", wg:"missile", size:"M",
    dmg:{ki:42}, cycle:8.5, range:45000, exr:135, mvel:3000, cpu:30, pg:12, price:600000, req:[["missiles",2]] }),

  lpulse: mod({ cn:"巨型脉冲激光炮 I", slot:"hi", type:"turret", wg:"laser", size:"L", sigRes:400,
    dmg:{em:48,th:24}, cycle:5.5, optimal:18000, falloff:6000, tracking:.036, cap:18, cpu:55, pg:1300, price:4500000, req:[["gunnery",4]] }),
  lblaster: mod({ cn:"大型中子爆能加农炮 I", slot:"hi", type:"turret", wg:"hybrid", size:"L", sigRes:400,
    dmg:{th:55,ki:40}, cycle:5, optimal:6000, falloff:12000, tracking:.042, cap:12, cpu:60, pg:1200, price:4500000, req:[["gunnery",4]] }),
  lrail: mod({ cn:"425毫米磁轨炮 I", slot:"hi", type:"turret", wg:"hybrid", size:"L", sigRes:400,
    dmg:{ki:48,th:32}, cycle:7, optimal:50000, falloff:20000, tracking:.011, cap:15, cpu:70, pg:1250, price:4800000, req:[["gunnery",4]] }),
  lac: mod({ cn:"800毫米连射加农炮 I", slot:"hi", type:"turret", wg:"proj", size:"L", sigRes:400,
    dmg:{ex:42,ki:30}, cycle:5.5, optimal:5000, falloff:24000, tracking:.05, cap:0, cpu:45, pg:1050, price:4500000, req:[["gunnery",4]] }),
  lcruise: mod({ cn:"巡航导弹发射器 I", slot:"hi", type:"launcher", wg:"missile", size:"L",
    dmg:{ki:130}, cycle:14, range:90000, exr:330, mvel:4200, cpu:75, pg:90, price:4800000, req:[["missiles",4]] }),

  miner1: mod({ cn:"采矿器 I", slot:"hi", type:"miner", size:"S", yield:40, cycle:60, optimal:12000,
    cap:5, cpu:12, pg:2, price:30000 }),
  miner2: mod({ cn:"采矿器 II", slot:"hi", type:"miner", size:"S", yield:60, cycle:60, optimal:12000,
    cap:9, cpu:20, pg:2, price:400000, req:[["mining",4]] }),

  ab1: mod({ cn:"1MN 加力燃烧室 I", slot:"mid", type:"prop", speedMult:2.1, drain:.6, cpu:15, pg:12, price:30000 }),
  ab10: mod({ cn:"10MN 加力燃烧室 I", slot:"mid", type:"prop", speedMult:2.1, drain:3, cpu:25, pg:160, price:550000, req:[["navigation",2]] }),
  ab100: mod({ cn:"100MN 加力燃烧室 I", slot:"mid", type:"prop", speedMult:2.1, drain:12, cpu:45, pg:1500, price:4200000, req:[["navigation",3]] }),
  mwd5: mod({ cn:"5MN 微型跃迁推进器 I", slot:"mid", type:"prop", speedMult:6, sigMult:5, drain:2.5, cpu:28, pg:18, price:300000, req:[["navigation",2]] }),
  mwd50: mod({ cn:"50MN 微型跃迁推进器 I", slot:"mid", type:"prop", speedMult:6, sigMult:5, drain:12, cpu:45, pg:220, price:1500000, req:[["navigation",3]] }),
  ssb: mod({ cn:"小型护盾回充增量器 I", slot:"mid", type:"shieldBoost", boost:14, cycle:3, cap:12, cpu:18, pg:4, price:30000 }),
  msb: mod({ cn:"中型护盾回充增量器 I", slot:"mid", type:"shieldBoost", boost:42, cycle:4, cap:32, cpu:35, pg:25, price:550000, req:[["shieldOp",2]] }),
  lsb: mod({ cn:"大型护盾回充增量器 I", slot:"mid", type:"shieldBoost", boost:130, cycle:5, cap:100, cpu:60, pg:220, price:4200000, req:[["shieldOp",3]] }),
  sse: mod({ cn:"小型护盾扩展装置 I", slot:"mid", type:"passive", shieldAdd:250, sigAdd:6, cpu:20, pg:8, price:25000 }),
  mse: mod({ cn:"中型护盾扩展装置 I", slot:"mid", type:"passive", shieldAdd:900, sigAdd:12, cpu:35, pg:30, price:550000, req:[["shieldMgmt",1]] }),
  lse: mod({ cn:"大型护盾扩展装置 I", slot:"mid", type:"passive", shieldAdd:2600, sigAdd:25, cpu:55, pg:150, price:4200000, req:[["shieldMgmt",2]] }),
  web: mod({ cn:"停滞缠绕光束 I", slot:"mid", type:"web", webMult:.5, optimal:10000, cycle:5, cap:5, cpu:30, pg:1, price:120000 }),
  caprech: mod({ cn:"电容回充器 I", slot:"mid", type:"passive", capRtMult:.85, cpu:20, pg:1, price:60000 }),
  sebo: mod({ cn:"感应增效器 I", slot:"mid", type:"passive", scanResMult:1.25, tgtRangeMult:1.25, cpu:25, pg:1, price:80000 }),

  saar: mod({ cn:"小型装甲维修器 I", slot:"low", type:"armorRep", rep:30, cycle:4.5, cap:10, cpu:5, pg:6, price:30000 }),
  maar: mod({ cn:"中型装甲维修器 I", slot:"low", type:"armorRep", rep:90, cycle:6, cap:32, cpu:15, pg:60, price:550000, req:[["repair",2]] }),
  laar: mod({ cn:"大型装甲维修器 I", slot:"low", type:"armorRep", rep:280, cycle:7.5, cap:110, cpu:30, pg:550, price:4200000, req:[["repair",3]] }),
  dcu: mod({ cn:"损伤控制 I", slot:"low", type:"passive", dcBonus:{sh:.10,ar:.15,hu:.50}, cpu:20, pg:1, price:120000 }),
  gyro: mod({ cn:"陀螺稳定器 I", slot:"low", type:"passive", dmgMult:{proj:1.1}, cpu:12, pg:1, price:200000 }),
  heatsink: mod({ cn:"热能散逸槽 I", slot:"low", type:"passive", dmgMult:{laser:1.1}, cpu:12, pg:1, price:200000 }),
  magstab: mod({ cn:"磁场稳定器 I", slot:"low", type:"passive", dmgMult:{hybrid:1.1}, cpu:12, pg:1, price:200000 }),
  bcs: mod({ cn:"弹道控制系统 I", slot:"low", type:"passive", dmgMult:{missile:1.1}, cpu:16, pg:1, price:250000 }),
  cargo1: mod({ cn:"扩容货柜舱 I", slot:"low", type:"passive", cargoMult:1.2, cpu:2, pg:1, price:25000 }),
  mlu: mod({ cn:"采矿器强化装置 I", slot:"low", type:"passive", miningMult:1.08, cpu:30, pg:1, price:220000, req:[["mining",3]] }),
  nano: mod({ cn:"纳米纤维内部结构 I", slot:"low", type:"passive", speedMult:1.08, inertiaMult:.9, cpu:3, pg:1, price:120000 }),
  rcu: mod({ cn:"反应堆控制装置 I", slot:"low", type:"passive", pgMult:1.1, cpu:20, pg:1, price:180000 }),
  cop: mod({ cn:"协处理器 I", slot:"low", type:"passive", cpuMult:1.1, cpu:1, pg:1, price:180000 }),
};

DATA.MINERALS = {
  trit: { cn:"三钛合金", price:5, vol:.01 },
  pye:  { cn:"类晶体胶矿", price:10, vol:.01 },
  mex:  { cn:"类银超金属", price:60, vol:.01 },
  iso:  { cn:"同位聚合体", price:120, vol:.01 },
  noc:  { cn:"超噬矿", price:800, vol:.01 },
  zyd:  { cn:"晶状石英核岩", price:1000, vol:.01 },
  mega: { cn:"超新星诺克石", price:3500, vol:.01 },
};

DATA.ORES = {
  veldspar:  { cn:"凡晶石", vol:.1, price:12, minerals:{trit:4}, band:"hi" },
  scordite:  { cn:"灼烧岩", vol:.15, price:22, minerals:{trit:3,pye:2}, band:"hi" },
  plagioclase:{ cn:"斜长岩", vol:.35, price:60, minerals:{trit:2,pye:4,mex:1}, band:"hi" },
  pyroxeres: { cn:"干焦岩", vol:.3, price:55, minerals:{trit:4,pye:1,mex:1}, band:"hi" },
  omber:     { cn:"奥贝尔石", vol:.6, price:95, minerals:{trit:2,pye:1,iso:1}, band:"hi" },
  kernite:   { cn:"水硼砂", vol:1.2, price:260, minerals:{mex:2,iso:2}, band:"hi" },
  jaspet:    { cn:"杰斯贝矿", vol:2, price:420, minerals:{mex:3,noc:.3}, band:"low" },
  hemorphite:{ cn:"血赤矿", vol:3, price:650, minerals:{trit:2,iso:2,noc:.5}, band:"low" },
  hedbergite:{ cn:"赫德伯石", vol:3, price:720, minerals:{pye:2,iso:2,noc:.6}, band:"low" },
  spodumain: { cn:"灰伯岩", vol:16, price:1900, minerals:{trit:30,pye:8,mex:2,iso:1}, band:"null" },
  crokite:   { cn:"克洛岩", vol:16, price:2100, minerals:{trit:20,noc:2,zyd:.8}, band:"null" },
  bistot:    { cn:"双多特", vol:16, price:1800, minerals:{pye:24,zyd:2}, band:"null" },
  arkonor:   { cn:"艾克诺岩", vol:16, price:3100, minerals:{trit:50,mex:5,mega:1}, band:"null" },
};

DATA.COMMODITIES = {
  scraps: { cn:"金属碎片", price:9000, vol:1 },
  guristasTag: { cn:"古斯塔斯铜牌徽章", price:28000, vol:.1 },
  serpentisTag: { cn:"天蛇铜牌徽章", price:32000, vol:.1 },
  parcel: { cn:"加密快递包裹", price:0, vol:0, noTrade:true },
};

DATA.SKILLS = {
  gunnery:     { cn:"炮术", rank:1, book:20000, desc:"每级提高 2% 炮塔伤害。" },
  missiles:    { cn:"导弹操控", rank:1, book:20000, desc:"每级提高 2% 导弹伤害。" },
  mining:      { cn:"采矿学", rank:1, book:20000, desc:"每级提高 5% 采矿器产量。" },
  astrogeology:{ cn:"天体地质学", rank:3, book:450000, desc:"每级提高 5% 采矿器产量。", req:[["mining",3]] },
  navigation:  { cn:"导航学", rank:1, book:20000, desc:"每级提高 5% 飞船最大速度。" },
  evasive:     { cn:"规避机动", rank:2, book:45000, desc:"每级降低 5% 飞船惯性。" },
  shieldOp:    { cn:"护盾操作", rank:1, book:20000, desc:"每级降低 5% 护盾回充时间。" },
  shieldMgmt:  { cn:"护盾管理", rank:3, book:220000, desc:"每级提高 5% 护盾容量。", req:[["shieldOp",3]] },
  hullUpg:     { cn:"舰体升级", rank:2, book:45000, desc:"每级提高 5% 装甲值。" },
  mechanics:   { cn:"机械学", rank:1, book:20000, desc:"每级提高 5% 结构值。" },
  repair:      { cn:"维修系统", rank:1, book:45000, desc:"每级提高 5% 维修器维修量。" },
  capMgmt:     { cn:"电容管理", rank:3, book:220000, desc:"每级提高 5% 电容容量。" },
  capOp:       { cn:"电容系统操作", rank:1, book:20000, desc:"每级降低 5% 电容回充时间。" },
  targeting:   { cn:"多目标锁定", rank:1, book:45000, desc:"每级增加 1 个可锁定目标。" },
  sigAnalysis: { cn:"信号分析", rank:1, book:45000, desc:"每级提高 5% 扫描分辨率（锁定更快）。" },
  longRange:   { cn:"远程锁定", rank:2, book:45000, desc:"每级提高 5% 最大锁定距离。" },
  cpuMgmt:     { cn:"CPU 管理", rank:1, book:20000, desc:"每级提高 5% 飞船 CPU 输出。" },
  pgMgmt:      { cn:"能量栅格管理", rank:1, book:20000, desc:"每级提高 5% 飞船能量栅格输出。" },
  spaceship:   { cn:"飞船操控", rank:1, book:20000, desc:"每级降低 2% 飞船惯性。" },
  frig:        { cn:"护卫舰指挥", rank:2, book:45000, desc:"驾驶护卫舰所需技能，并提供船体加成。", req:[["spaceship",1]] },
  dessie:      { cn:"驱逐舰指挥", rank:2, book:220000, desc:"驾驶驱逐舰所需技能。", req:[["frig",3]] },
  cruiser:     { cn:"巡洋舰指挥", rank:4, book:1300000, desc:"驾驶巡洋舰所需技能。", req:[["dessie",3]] },
  bc:          { cn:"战列巡洋舰指挥", rank:6, book:4500000, desc:"驾驶战列巡洋舰所需技能。", req:[["cruiser",3]] },
  bs:          { cn:"战列舰指挥", rank:8, book:13000000, desc:"驾驶战列舰所需技能。", req:[["bc",3]] },
  industrial:  { cn:"工业船指挥", rank:4, book:900000, desc:"驾驶工业舰所需技能。", req:[["spaceship",2]] },
  reprocessing:{ cn:"再处理", rank:1, book:45000, desc:"每级提高 3% 矿石精炼产出（基础 50%）。" },
  trade:       { cn:"贸易学", rank:1, book:20000, desc:"每级降低 0.5% 市场交易税（基础 5%）。" },
  weaponUpg:   { cn:"武器升级", rank:2, book:45000, desc:"每级降低 5% 武器 CPU 需求。" },
};

DATA.START_SKILLS = { spaceship:2, frig:2, gunnery:2, missiles:1, mining:2, navigation:1, shieldOp:1, mechanics:1, targeting:1, cpuMgmt:1, pgMgmt:1 };

function npc(o){ return Object.assign({ sigRes:40, aggro:45000, lockDelay:4 }, o); }
DATA.NPCS = {
  g_f1: npc({ cn:"古斯塔斯窃贼", faction:"guristas", cls:"护卫舰", bounty:12500, sig:38, speed:380, orbit:6500,
    shield:350, armor:300, hull:300, dmg:{ki:14,th:8}, cycle:4, optimal:6000, falloff:4000, tracking:.25 }),
  g_f2: npc({ cn:"古斯塔斯掠夺者", faction:"guristas", cls:"护卫舰", bounty:25000, sig:42, speed:420, orbit:7500,
    shield:500, armor:400, hull:400, dmg:{ki:20,th:10}, cycle:4, optimal:7000, falloff:5000, tracking:.22 }),
  g_d1: npc({ cn:"古斯塔斯毁灭者", faction:"guristas", cls:"驱逐舰", bounty:60000, sig:70, speed:300, orbit:9000,
    shield:900, armor:700, hull:700, dmg:{ki:35,th:18}, cycle:5, optimal:9000, falloff:6000, tracking:.12 }),
  g_c1: npc({ cn:"古斯塔斯煽动者", faction:"guristas", cls:"巡洋舰", bounty:150000, sig:135, speed:240, orbit:12000,
    shield:2200, armor:1600, hull:1600, dmg:{ki:70,th:35}, cycle:6, optimal:12000, falloff:8000, tracking:.05, sigRes:125, aggro:55000 }),
  g_bs: npc({ cn:"古斯塔斯灭绝者", faction:"guristas", cls:"战列舰", bounty:950000, sig:430, speed:130, orbit:18000,
    shield:7000, armor:5500, hull:5500, dmg:{ki:320,th:160}, cycle:9, optimal:25000, falloff:15000, tracking:.009, sigRes:400, aggro:70000 }),
  s_f1: npc({ cn:"天蛇小队斥候", faction:"serpentis", cls:"护卫舰", bounty:12500, sig:38, speed:390, orbit:5500,
    shield:300, armor:350, hull:300, dmg:{th:14,ki:8}, cycle:4, optimal:5000, falloff:4500, tracking:.26 }),
  s_f2: npc({ cn:"天蛇守卫", faction:"serpentis", cls:"护卫舰", bounty:26000, sig:42, speed:430, orbit:6000,
    shield:400, armor:500, hull:400, dmg:{th:20,ki:11}, cycle:4, optimal:6000, falloff:5000, tracking:.23 }),
  s_d1: npc({ cn:"天蛇队长", faction:"serpentis", cls:"驱逐舰", bounty:62000, sig:70, speed:310, orbit:8000,
    shield:750, armor:900, hull:700, dmg:{th:36,ki:19}, cycle:5, optimal:8000, falloff:7000, tracking:.12 }),
  s_c1: npc({ cn:"天蛇上尉", faction:"serpentis", cls:"巡洋舰", bounty:155000, sig:135, speed:250, orbit:10000,
    shield:1800, armor:2000, hull:1600, dmg:{th:72,ki:38}, cycle:6, optimal:11000, falloff:9000, tracking:.05, sigRes:125, aggro:55000 }),
  s_bs: npc({ cn:"天蛇海军上将", faction:"serpentis", cls:"战列舰", bounty:1050000, sig:430, speed:135, orbit:15000,
    shield:6000, armor:6800, hull:5800, dmg:{th:330,ki:170}, cycle:9, optimal:22000, falloff:16000, tracking:.009, sigRes:400, aggro:70000 }),
};
DATA.FACTION_CN = { guristas:"古斯塔斯海盗", serpentis:"天蛇集团" };
DATA.FACTION_TAG = { guristas:"guristasTag", serpentis:"serpentisTag" };
DATA.LOOT_SMALL = ["sac","sblaster","spulse","srocket","ssb","sse","web","ab1","saar","gyro","magstab","heatsink","bcs","nano"];
DATA.LOOT_MED = ["mac","mblaster","mpulse","mhml","msb","mse","maar","mwd5","dcu","caprech","sebo","mlu"];

function sys(o){ return Object.assign({ planets:5, belts:3, stations:[], npc:"guristas" }, o); }
DATA.SYSTEMS = {
  jita: sys({ cn:"吉他", en:"Jita", sec:0.9, region:"伏尔戈", mx:50, my:40, planets:8, belts:3,
    gates:["perimeter","maurasi","newcaldari","niyabainen","urlen"],
    stations:[{ name:"吉他 IV - 卫星 4 - 加达里海军组装厂", agent:"agent_jita" }],
    info:"新伊甸最大的贸易枢纽，永远拥挤的星系。" }),
  perimeter: sys({ cn:"佩里米特", en:"Perimeter", sec:1.0, region:"伏尔戈", mx:62, my:33, planets:6, belts:2,
    gates:["jita","maurasi"], stations:[{ name:"佩里米特 II - 卫星 1 - 加达里商业部仓库" }] }),
  maurasi: sys({ cn:"毛拉西", en:"Maurasi", sec:0.9, region:"伏尔戈", mx:40, my:29, planets:7, belts:3,
    gates:["jita","perimeter"], stations:[{ name:"毛拉西 III - 月卫 2 - 湖门重工制造厂", agent:"agent_maurasi" }] }),
  urlen: sys({ cn:"乌尔伦", en:"Urlen", sec:0.9, region:"伏尔戈", mx:60, my:48, planets:5, belts:3,
    gates:["jita","ikuchi"], stations:[{ name:"乌尔伦 V - 月卫 3 - 顶尖股份有限公司仓库" }] }),
  newcaldari: sys({ cn:"新加达里", en:"New Caldari", sec:1.0, region:"城塞", mx:36, my:50, planets:4, belts:2,
    gates:["jita","niyabainen"], stations:[{ name:"新加达里主星 I - 加达里行政中心", agent:"agent_newcaldari" }] }),
  niyabainen: sys({ cn:"尼亚贝宁", en:"Niyabainen", sec:1.0, region:"城塞", mx:43, my:59, planets:6, belts:2,
    gates:["jita","newcaldari","nourvukaiken"], stations:[{ name:"尼亚贝宁 IV - 月卫 1 - 加达里海军测试设施" }] }),
  ikuchi: sys({ cn:"依库琪", en:"Ikuchi", sec:0.8, region:"城塞", mx:66, my:58, planets:5, belts:3,
    gates:["urlen","nourvukaiken"], stations:[] }),
  nourvukaiken: sys({ cn:"诺福凯肯", en:"Nourvukaiken", sec:0.8, region:"黑渊", mx:52, my:68, planets:7, belts:4,
    gates:["niyabainen","ikuchi","tama"], stations:[{ name:"诺福凯肯 II - 月卫 7 - 和平与商业部办事处", agent:"agent_nourvu" }] }),
  tama: sys({ cn:"塔玛", en:"Tama", sec:0.3, region:"黑渊", mx:46, my:80, planets:6, belts:5,
    gates:["nourvukaiken","kedama","sujarento"],
    stations:[{ name:"塔玛 V - 月卫 1 - 和平与商业部试验工厂", agent:"agent_tama" }],
    info:"臭名昭著的低安死亡星系，海盗天堂。" }),
  kedama: sys({ cn:"科达玛", en:"Kedama", sec:0.4, region:"黑渊", mx:33, my:87, planets:5, belts:5,
    gates:["tama"], stations:[] }),
  sujarento: sys({ cn:"苏加伦托", en:"Sujarento", sec:0.3, region:"黑渊", mx:59, my:88, planets:6, belts:4,
    gates:["tama","pf346"], stations:[] }),
  pf346: sys({ cn:"PF-346", en:"PF-346", sec:0.0, region:"辛迪加", mx:52, my:99, planets:7, belts:6,
    gates:["sujarento"], stations:[], npc:"serpentis",
    info:"零安空域。没有法律，没有 CONCORD，只有财富与死亡。" }),
};

DATA.AGENTS = {
  agent_jita: { cn:"凯拉·织原", corp:"加达里海军", div:"安全部", level:1, types:["kill","kill","courier"] },
  agent_maurasi: { cn:"添田信人", corp:"湖门重工", div:"物流部", level:1, types:["courier","courier","mining"] },
  agent_newcaldari: { cn:"温野遥", corp:"加达里商业部", div:"采矿部", level:1, types:["mining","mining","courier"] },
  agent_nourvu: { cn:"荒木大和", corp:"和平与商业部", div:"综合事务", level:2, types:["kill","mining","courier"] },
  agent_tama: { cn:"佐仓玲", corp:"和平与商业部", div:"安全部", level:3, types:["kill","kill","courier"] },
};

DATA.PLANET_TYPES = [
  { cn:"温和行星", color:"#4a7c59" }, { cn:"贫瘠行星", color:"#8a7a62" },
  { cn:"气态行星", color:"#b08d57" }, { cn:"冰体行星", color:"#9ab7c9" },
  { cn:"熔岩行星", color:"#9c5040" }, { cn:"海洋行星", color:"#3e6b96" },
  { cn:"风暴行星", color:"#7d6f9e" },
];

DATA.NAMES = ["星风漫游者","KirinYato","矿工老王","Deadspace9","Yuki_Onna","跃迁疲劳","CaldariFan","蓝色多瑙河",
"矿石买家Bob","GateCamper42","薛定谔的舰长","ISK_Doctor","Nova尘埃","低安勿入","Rifter爱好者","吉他倒爷",
"PLEX大亨","虫洞观光团","新伊甸浪人","克隆体N号","静音潜行者","反矿联盟","联邦快递员","阿玛尔之光",
"部族之魂","炮台人生","蠕虫洞里的猫","散装钛合金","泡面舰长","Kusion二世","跳桥观察员","第四帝国remnant"];

DATA.JITA_SPAM = [
"收各类矿石压缩矿，全吉他最高价，M我",
"卖 幼龙级 满配 只要 8000 万，首单半价！",
"ISK 翻倍！首单小额验证信誉！100% 返还！",
"出 古斯塔斯徽章 x50 打包价私聊",
"新人军团招募，福利齐全，免税率 0%，来人就送护卫舰",
"低价出售各类舰船蓝图拷贝，吉他 4-4 面交",
"送 15 天欧米茄，点我头像领取",
"大量长期收金属碎片，高于市场价 10%",
"帮清 0.0 死亡空间，专业代练，诚信第一",
"出售角色：5000万 SP 泰坦号，私聊详谈"];

DATA.SMACK = ["gf","来打我啊","这系统有主了，矿佬缴税","o7","刚看到一队古斯塔斯往4号带去了","有人组队刷异常吗","本地怎么这么多人","小心星门有埋伏"];

/* 全局战斗节奏平衡：提高武器伤害、适度增强 NPC 火力并微降其血量，使交战时长接近 EVE 手感 */
for (const m of Object.values(DATA.MODULES)){
  if ((m.type === "turret" || m.type === "launcher") && m.dmg)
    for (const k in m.dmg) m.dmg[k] = Math.round(m.dmg[k] * 3.5 * 10) / 10;
  if (m.type === "shieldBoost") m.boost = Math.round(m.boost * 2);
  if (m.type === "armorRep") m.rep = Math.round(m.rep * 2);
}
for (const n of Object.values(DATA.NPCS)){
  for (const k in n.dmg) n.dmg[k] = Math.round(n.dmg[k] * 2 * 10) / 10;
  n.shield = Math.round(n.shield * .85);
  n.armor = Math.round(n.armor * .85);
  n.hull = Math.round(n.hull * .85);
}

DATA.item = function(id){
  if (DATA.MODULES[id]) return Object.assign({id, cat:"module"}, DATA.MODULES[id]);
  if (DATA.ORES[id]) return Object.assign({id, cat:"ore"}, DATA.ORES[id]);
  if (DATA.MINERALS[id]) return Object.assign({id, cat:"mineral"}, DATA.MINERALS[id]);
  if (DATA.COMMODITIES[id]) return Object.assign({id, cat:"commodity"}, DATA.COMMODITIES[id]);
  if (id.startsWith("book_")){
    const sk = DATA.SKILLS[id.slice(5)];
    if (sk) return { id, cat:"book", cn:"技能书：" + sk.cn, price:sk.book, vol:.1, skill:id.slice(5) };
  }
  if (DATA.SHIPS[id]) return Object.assign({id, cat:"ship", vol:0}, DATA.SHIPS[id]);
  return { id, cat:"unknown", cn:id, price:0, vol:0 };
};

window.DATA = DATA;
