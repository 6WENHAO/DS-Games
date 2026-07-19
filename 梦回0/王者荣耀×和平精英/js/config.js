/* ================================================================
   荣耀精英 — 全局配置：常量 / 地图 / 英雄 / 装备 / 文案
   ================================================================ */
window.HE = {};

HE.CFG = {
  MAP_HALF: 100,               // 地图半宽（-100 ~ 100）
  BLUE_BASE: { x: -84, z: -84 },
  RED_BASE:  { x:  84, z:  84 },
  FOUNTAIN_RADIUS: 14,         // 泉水治疗范围
  FOUNTAIN_HEAL: 0.09,         // 每秒回复最大生命百分比

  START_GOLD: 500,
  PASSIVE_GOLD: 2.2,           // 每秒自然经济
  PASSIVE_XP: 4.5,

  FIRST_WAVE: 30,              // 首波兵线（秒）
  WAVE_INTERVAL: 30,
  CANNON_EVERY: 3,             // 每3波出炮车

  BUFF_SPAWN: 30, BUFF_RESPAWN: 90,
  TYRANT_SPAWN: 120, TYRANT_RESPAWN: 180,
  OVERLORD_SPAWN: 300, OVERLORD_RESPAWN: 240,

  AIRDROP_FIRST: 100,          // 空投（和平精英元素）
  AIRDROP_INTERVAL: 110,

  ZONE_START: 480,             // 信号圈出现时间
  ZONE_SHRINK_TIME: 70,        // 收缩耗时
  ZONE_MIN_R: 46,
  ZONE_DPS: 0.02,              // 圈外每秒损失最大生命2%
  ZONE_HOLD: 45,               // 决赛圈保持时长，随后信号圈消散

  RESPAWN_BASE: 5, RESPAWN_PER_LV: 2.2,
  RECALL_TIME: 3.5,
  FLASH_CD: 90, FLASH_DIST: 12,
  HEAL_CD: 60,

  XP_LEVEL: lv => 110 + lv * 95,
  MAX_LEVEL: 15,

  GOLD_MELEE: 72, GOLD_RANGED: 52, GOLD_CANNON: 130,
  GOLD_HERO_BASE: 200, GOLD_TOWER: 200, GOLD_TOWER_KILLER: 125,
  GOLD_BUFF: 90, GOLD_TYRANT: 160, GOLD_OVERLORD: 200,
};

/* ---------------- 兵线路径（蓝方视角 → 红方） ---------------- */
HE.LANES = {
  top: [ {x:-76,z:-66},{x:-82,z:-28},{x:-82,z:36},{x:-76,z:72},{x:-38,z:80},{x:28,z:82},{x:66,z:76},{x:76,z:76} ],
  mid: [ {x:-68,z:-68},{x:-36,z:-36},{x:0,z:0},{x:36,z:36},{x:68,z:68} ],
  bot: [ {x:-66,z:-76},{x:-28,z:-82},{x:36,z:-82},{x:72,z:-76},{x:80,z:-38},{x:82,z:28},{x:76,z:66},{x:76,z:76} ],
};

/* ---------------- 防御塔布局（蓝方，红方镜像） ---------------- */
HE.TOWERS = [
  { lane:'top', tier:1, x:-82, z:26 },
  { lane:'top', tier:2, x:-80, z:-34 },
  { lane:'mid', tier:1, x:-31, z:-31 },
  { lane:'mid', tier:2, x:-55, z:-55 },
  { lane:'bot', tier:1, x:26, z:-82 },
  { lane:'bot', tier:2, x:-34, z:-80 },
  { lane:'base', tier:3, x:-70, z:-70 },
];

/* ---------------- 野区 ---------------- */
HE.JUNGLE = [
  { id:'blue_blue',  type:'bluebuff', x:-56, z:-12 },
  { id:'blue_red',   type:'redbuff',  x:-12, z:-56 },
  { id:'red_blue',   type:'bluebuff', x: 56, z: 12 },
  { id:'red_red',    type:'redbuff',  x: 12, z: 56 },
  { id:'tyrant',     type:'tyrant',   x: 38, z:-38 },
  { id:'overlord',   type:'overlord', x:-38, z: 38 },
];

/* ================= 英雄（王者定位 × 和平精英武器） ================= */
HE.HEROES = [
  {
    id:'thunder', name:'雷霆', title:'重装先锋', role:'战士/坦克', face:'雷',
    weapon:'S686 战术霰弹枪', gun:'shotgun', difficulty:1,
    color:0x4d5b45, accent:0x8a9a6d, skin:0xc9a97e,
    stats:{ hp:1450, hpG:210, mp:420, mpG:52, atk:160, atkG:12, def:110, defG:19,
            atkSpd:0.75, range:7.5, speed:8.6, regen:14, regenMp:4 },
    skills:[
      { name:'铁壁冲锋', icon:'⭆', cd:8,  mana:50, desc:'向前方猛烈冲锋，撞开敌人并造成伤害与减速' },
      { name:'战术烟幕', icon:'☁', cd:13, mana:65, desc:'投掷烟雾弹，获得护盾，烟雾内敌人被减速' },
      { name:'震爆突袭', icon:'⦿', cd:30, mana:100, desc:'跃向目标区域，落地引发爆炸，眩晕范围内敌人' },
    ],
    build:['vest2','grip','vest3','muzzle','drink','helmet3'],
  },
  {
    id:'wolf', name:'孤狼', title:'枪神', role:'射手', face:'狼',
    weapon:'M416 突击步枪', gun:'rifle', difficulty:2,
    color:0x3d4a56, accent:0x6d8aa0, skin:0xd8b48e,
    stats:{ hp:980, hpG:135, mp:440, mpG:58, atk:175, atkG:14, def:82, defG:13,
            atkSpd:1.05, range:14, speed:9.0, regen:9, regenMp:5 },
    skills:[
      { name:'快速装填', icon:'⟳', cd:10, mana:45, desc:'高速装填弹药，短时间内大幅提升射速' },
      { name:'战术滑铲', icon:'⤳', cd:9,  mana:55, desc:'向移动方向滑铲，下次射击必定暴击' },
      { name:'火力压制', icon:'☄', cd:36, mana:110, desc:'对最近的敌方英雄倾泻一梭子弹雨' },
    ],
    build:['scope','grip','mag','muzzle','scope8x','drink'],
  },
  {
    id:'viper', name:'夜刺', title:'幽影', role:'刺客', face:'刺',
    weapon:'双持 UZI 冲锋枪', gun:'smg', difficulty:3,
    color:0x2e3138, accent:0x9c4dd6, skin:0xcfa987,
    stats:{ hp:1080, hpG:150, mp:430, mpG:55, atk:168, atkG:13, def:90, defG:14,
            atkSpd:1.35, range:8.5, speed:9.6, regen:10, regenMp:5 },
    skills:[
      { name:'影袭', icon:'⚡', cd:9,  mana:60, desc:'瞬身突进至附近的敌方英雄身后并造成伤害' },
      { name:'淬毒弹匣', icon:'☠', cd:12, mana:50, desc:'接下来3次射击附带剧毒，持续伤害并减速' },
      { name:'处决', icon:'✖', cd:32, mana:100, desc:'对目标造成巨额伤害，目标生命低于30%时伤害翻倍' },
    ],
    build:['mag','silencer','muzzle','scope8x','vest2','drink'],
  },
  {
    id:'boom', name:'火药桶', title:'爆破专家', role:'法师', face:'爆',
    weapon:'榴弹发射器', gun:'launcher', difficulty:2,
    color:0x5a4a38, accent:0xe08a3c, skin:0xc9a97e,
    stats:{ hp:960, hpG:130, mp:520, mpG:75, atk:182, atkG:15, def:78, defG:12,
            atkSpd:0.7, range:13, speed:8.6, regen:9, regenMp:7 },
    skills:[
      { name:'破片手雷', icon:'✸', cd:7,  mana:60, desc:'投掷手雷，爆炸对范围内敌人造成高额伤害' },
      { name:'燃烧地带', icon:'♨', cd:14, mana:75, desc:'投掷燃烧瓶，地面燃烧持续灼烧敌人' },
      { name:'迫击炮急袭', icon:'☢', cd:38, mana:130, desc:'呼叫迫击炮群覆盖目标区域，多轮爆炸' },
    ],
    build:['scope','mag','muzzle','helmet2','scope8x','drink'],
  },
  {
    id:'medic', name:'白鸽', title:'战地军医', role:'辅助', face:'医',
    weapon:'Vector 冲锋枪', gun:'smg', difficulty:1,
    color:0x62707a, accent:0x7fd8c8, skin:0xe0bd9a,
    stats:{ hp:1180, hpG:165, mp:500, mpG:70, atk:130, atkG:9, def:95, defG:15,
            atkSpd:0.95, range:10, speed:8.8, regen:12, regenMp:7 },
    skills:[
      { name:'医疗抛投', icon:'✚', cd:9,  mana:70, desc:'向友军投掷医疗包，治疗范围内的队友' },
      { name:'肾上腺素', icon:'➹', cd:14, mana:65, desc:'激励附近队友，提供护盾与移速加成' },
      { name:'紧急救援', icon:'❁', cd:40, mana:120, desc:'呼叫医疗空投，大范围持续治疗并减伤' },
    ],
    build:['vest2','drink','helmet2','vest3','medkit','helmet3'],
  },
];

/* ================= 装备（和平精英风格军需） ================= */
HE.ITEMS = [
  { id:'scope',    name:'红点瞄准镜', icon:'◎', price:500,  desc:'+15 攻击力',            atk:15 },
  { id:'grip',     name:'垂直握把',   icon:'╀', price:600,  desc:'+20% 攻速',             spd:0.20 },
  { id:'mag',      name:'扩容弹匣',   icon:'▤', price:900,  desc:'+25 攻击 +12% 攻速',    atk:25, spd:0.12 },
  { id:'muzzle',   name:'枪口补偿器', icon:'✦', price:1300, desc:'+45 攻击力',            atk:45 },
  { id:'scope8x',  name:'8倍狙击镜',  icon:'◉', price:1900, desc:'+30 攻击 +25% 暴击',    atk:30, crit:0.25 },
  { id:'silencer', name:'战术消音器', icon:'▮', price:1100, desc:'+20 攻击 +10% 攻速',    atk:20, spd:0.10 },
  { id:'vest2',    name:'二级防弹衣', icon:'🦺', price:650,  desc:'+350 生命 +35 防御',   hp:350, def:35 },
  { id:'vest3',    name:'三级防弹衣', icon:'🛡', price:1600, desc:'+850 生命 +70 防御',   hp:850, def:70 },
  { id:'helmet2',  name:'二级头盔',   icon:'🪖', price:550,  desc:'+15% 冷却缩减',        cdr:0.15 },
  { id:'helmet3',  name:'三级头盔',   icon:'⛑', price:1250, desc:'+25% 冷却 +250 生命',  cdr:0.25, hp:250 },
  { id:'drink',    name:'能量饮料',   icon:'🥤', price:450,  desc:'+6% 移速 +8/秒 回复',  ms:0.06, regen:8 },
  { id:'medkit',   name:'医疗箱',     icon:'💊', price:1000, desc:'+400 生命 +18/秒 回复', hp:400, regen:18 },
];

/* ================= 空投奖励（和平精英元素） ================= */
HE.AIRDROP_LOOT = [
  { id:'awm',    name:'AWM 狙击枪',  icon:'🎯', desc:'攻击力+50%', dur:30, tag:'AWM' },
  { id:'suit3',  name:'三级套装',    icon:'🛡', desc:'受伤减免40%', dur:30, tag:'三级套' },
  { id:'meds',   name:'医疗补给',    icon:'💉', desc:'立即恢复全部生命', dur:0,  tag:'补给' },
  { id:'ammo',   name:'高爆弹药',    icon:'💥', desc:'攻速+60%',   dur:30, tag:'弹药' },
];

/* ================= 队伍与机器人 ================= */
HE.BOT_NAMES = {
  blue: ['特种兵·空降王','特种兵·老六','特种兵·压枪怪','特种兵·苟分王'],
  red:  ['敌军·伏地魔','敌军·刚枪王','敌军·跳伞鬼才','敌军·三指大神','敌军·清野快手'],
};
HE.LANE_ASSIGN = { thunder:'top', boom:'mid', wolf:'bot', medic:'bot', viper:'jungle' };

/* ================= 播报台词 ================= */
HE.VOICE = {
  welcome:      '欢迎来到荣耀精英战场',
  deploy:       '全体注意，空降部署开始',
  minions5s:    '敌军还有五秒到达战场，全军出击！',
  firstblood:   '第一滴血！',
  double:       '双杀！', triple: '三杀！', quadra:'四杀！', penta:'五杀！',
  legendary:    '无人能挡！',
  shutdown:     '结束了敌人的连胜！',
  allyDown:     '我方队友被击杀',
  enemyDown:    '击破一名敌人',
  towerDangerA: '我方防御塔正在被攻击',
  towerLostA:   '我方防御塔被摧毁',
  towerLostB:   '敌方防御塔被摧毁，干得漂亮',
  crystalDanger:'警告！我方水晶正在被攻击',
  airdrop:      '空投补给已投放，注意拾取',
  zone:         '信号圈开始收缩，请注意安全区范围',
  zoneEnd:      '信号圈能量耗尽已消散，全军发起总攻！',
  tyrant:       '暴君已被击败',
  overlord:     '主宰已被击败',
  victory:      '大吉大利，今晚吃鸡！',
  defeat:       '很遗憾，战斗失败，下次再战',
  respawn:      '重新部署完成',
  buffRed:      '获得红色符文，攻击附带灼烧',
  buffBlue:     '获得蓝色符文，技能冷却加快',
};

/* ================= 加载提示 ================= */
HE.TIPS = [
  '小提示：摧毁敌方基地水晶即可获得胜利',
  '小提示：击杀野区双 BUFF 可以获得强力增益',
  '小提示：空投补给会随机降落，先到先得！',
  '小提示：信号圈收缩后，圈外会持续掉血，注意转移',
  '小提示：防御塔会优先攻击兵线，跟着兵线推进更安全',
  '小提示：补刀可以获得更多物资经济，用来购买军需装备',
  '小提示：按 B 键回城，泉水中可以快速恢复',
  '小提示：击败暴君与主宰可以为全队带来增益',
  '小提示：闪现（F）可以穿越地形，是保命的最后手段',
  '小提示：鼠标点击地面可自动移动，点击敌人可自动追击攻击',
  '小提示：脚下的金圈是你的攻击范围，敌人进圈即可开火',
];

HE.KILL_BANNERS = { 1:null, 2:'双杀', 3:'三杀', 4:'四杀', 5:'五杀' };
