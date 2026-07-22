/* ============================================================
 * 真·三國無雙 WEB —— 数据定义
 * 武将 / 关卡 / 事件 / 台词
 * ============================================================ */
'use strict';

var DATA = {};

/* ---------------- 可用武将 ---------------- */
DATA.heroes = [
  {
    id: 'zhaoyun', name: '赵云', zi: '子龙',
    title: '常山的白龙',
    weapon: '龙胆', weaponType: 'spear',
    hp: 230, atk: 1.0, def: 1.0, spd: 1.12,
    color: 0x6f8fdd, subColor: 0xe8ecf5, plume: 0xeeeeff,
    desc: '攻守速均衡的万能型武将。枪势如游龙，六段连击行云流水。',
    musouName: '龙胆无双',
    quotes: {
      select: '吾乃常山赵子龙也！',
      start: '全军出击！目标，贼首张角！',
      musou: '看我这一击！',
      kill: '敌将，已被我讨取！',
      k1000: '这就是常山赵子龙的枪！',
      hurt: '唔……不可大意！',
      win: '我军大获全胜！此乃诸位将士之功！',
      horse: '马来！'
    }
  },
  {
    id: 'guanyu', name: '关羽', zi: '云长',
    title: '武圣·美髯公',
    weapon: '青龙偃月刀', weaponType: 'glaive',
    hp: 260, atk: 1.22, def: 1.15, spd: 0.95,
    color: 0x2e7d4f, subColor: 0x1a4030, plume: 0x33aa66,
    desc: '一击威力绝伦的力量型武将。偃月刀横扫千军，范围极广。',
    musouName: '青龙无双',
    quotes: {
      select: '关云长在此！',
      start: '黄巾逆贼，岂容尔等祸乱天下！',
      musou: '青龙偃月，在此一斩！',
      kill: '插标卖首之徒，不足为惧！',
      k1000: '过五关斩六将，亦不过如此！',
      hurt: '嗯……有点意思。',
      win: '此战全胜！兄长，云长幸不辱命！',
      horse: '赤兔，来！'
    }
  },
  {
    id: 'zhangfei', name: '张飞', zi: '翼德',
    title: '万人之敌',
    weapon: '丈八蛇矛', weaponType: 'pike',
    hp: 285, atk: 1.32, def: 1.05, spd: 0.9,
    color: 0x2b2b33, subColor: 0x553322, plume: 0xcc3333,
    desc: '破坏力最强的猛将。蛇矛势大力沉，一喝可退千军。',
    musouName: '猛虎无双',
    quotes: {
      select: '燕人张飞在此！',
      start: '哇呀呀呀！谁敢与我决一死战！',
      musou: '喝啊啊啊——！',
      kill: '哼！不堪一击！',
      k1000: '俺乃万人敌张翼德！',
      hurt: '好胆！竟敢伤俺！',
      win: '哈哈哈哈！痛快！痛快！',
      horse: '马呢！俺的马！'
    }
  }
];

/* ---------------- 武器动作数据 ----------------
 * chain: 普通连击(N1~N6)  charges: 蓄力技(C1~C6)
 * dur:动作时长 hitT:判定时刻 range:距离 arc:角度(度)
 * dmg:倍率 fx:特效 react:受击反应 flinch/launch/knockback/stun/spin
 */
DATA.movesets = {
  spear: {
    trailColor: 0x99ccff,
    chain: [
      { dur: 0.34, hitT: 0.16, range: 3.4, arc: 120, dmg: 1.0, react: 'flinch', swing: 'R' },
      { dur: 0.32, hitT: 0.15, range: 3.4, arc: 120, dmg: 1.0, react: 'flinch', swing: 'L' },
      { dur: 0.34, hitT: 0.16, range: 3.8, arc: 90,  dmg: 1.1, react: 'flinch', swing: 'T' },
      { dur: 0.36, hitT: 0.17, range: 3.5, arc: 150, dmg: 1.1, react: 'flinch', swing: 'R' },
      { dur: 0.36, hitT: 0.17, range: 3.5, arc: 150, dmg: 1.2, react: 'flinch', swing: 'L' },
      { dur: 0.5,  hitT: 0.22, range: 4.0, arc: 170, dmg: 1.6, react: 'knockback', swing: 'F' }
    ],
    charges: {
      1: { dur: 0.6,  hitT: 0.3,  range: 4.5, arc: 360, dmg: 0.8, react: 'stun',      fx: 'shockwave', name: 'C1·惊雷突' },
      2: { dur: 0.5,  hitT: 0.22, range: 3.2, arc: 100, dmg: 1.5, react: 'launch',    fx: 'upslash',   name: 'C2·苍龙升' },
      3: { dur: 0.7,  hitT: 0.18, range: 3.8, arc: 70,  dmg: 0.7, react: 'stun', hits: 3, hitGap: 0.16, fx: 'pierce', name: 'C3·连突刺' },
      4: { dur: 0.75, hitT: 0.3,  range: 4.6, arc: 360, dmg: 2.2, react: 'knockback', fx: 'spin',      name: 'C4·龙卷' },
      5: { dur: 0.6,  hitT: 0.26, range: 4.0, arc: 140, dmg: 1.8, react: 'launch',    fx: 'upslash',   name: 'C5·飞龙斩' },
      6: { dur: 0.8,  hitT: 0.25, range: 6.0, arc: 60,  dmg: 2.6, react: 'knockback', fx: 'dash',      name: 'C6·龙牙突' }
    },
    jumpAtk:    { dur: 0.4, hitT: 0.12, range: 3.2, arc: 180, dmg: 1.0, react: 'flinch' },
    jumpCharge: { dur: 0.6, hitT: 0.3,  range: 4.5, arc: 360, dmg: 1.8, react: 'knockback', fx: 'slam' },
    musou: { dur: 4.5, tick: 0.16, range: 4.6, arc: 360, dmg: 0.75, react: 'knockup', fin: { range: 6.5, dmg: 3.0, react: 'knockback' } },
    mounted: { dur: 0.5, hitT: 0.2, range: 3.6, arc: 150, dmg: 1.4, react: 'knockback' }
  },
  glaive: {
    trailColor: 0x88ffbb,
    chain: [
      { dur: 0.42, hitT: 0.2,  range: 3.8, arc: 150, dmg: 1.15, react: 'flinch', swing: 'R' },
      { dur: 0.4,  hitT: 0.18, range: 3.8, arc: 150, dmg: 1.15, react: 'flinch', swing: 'L' },
      { dur: 0.44, hitT: 0.2,  range: 3.8, arc: 160, dmg: 1.25, react: 'flinch', swing: 'R' },
      { dur: 0.44, hitT: 0.2,  range: 3.8, arc: 160, dmg: 1.25, react: 'flinch', swing: 'L' },
      { dur: 0.46, hitT: 0.21, range: 4.0, arc: 170, dmg: 1.35, react: 'flinch', swing: 'R' },
      { dur: 0.6,  hitT: 0.26, range: 4.4, arc: 200, dmg: 1.9,  react: 'knockback', swing: 'F' }
    ],
    charges: {
      1: { dur: 0.65, hitT: 0.32, range: 4.0, arc: 120, dmg: 1.2, react: 'stun',      fx: 'shockwave', name: 'C1·威风' },
      2: { dur: 0.55, hitT: 0.25, range: 3.4, arc: 120, dmg: 1.7, react: 'launch',    fx: 'upslash',   name: 'C2·升龙斩' },
      3: { dur: 0.75, hitT: 0.2,  range: 4.0, arc: 140, dmg: 0.8, react: 'stun', hits: 3, hitGap: 0.18, fx: 'pierce', name: 'C3·连环斩' },
      4: { dur: 0.85, hitT: 0.34, range: 5.0, arc: 360, dmg: 2.5, react: 'knockback', fx: 'spin',      name: 'C4·青龙旋' },
      5: { dur: 0.65, hitT: 0.28, range: 4.2, arc: 160, dmg: 2.0, react: 'launch',    fx: 'upslash',   name: 'C5·昇天' },
      6: { dur: 0.9,  hitT: 0.3,  range: 5.5, arc: 90,  dmg: 3.0, react: 'knockback', fx: 'dash',      name: 'C6·断空斩' }
    },
    jumpAtk:    { dur: 0.44, hitT: 0.14, range: 3.4, arc: 200, dmg: 1.2, react: 'flinch' },
    jumpCharge: { dur: 0.65, hitT: 0.32, range: 5.0, arc: 360, dmg: 2.0, react: 'knockback', fx: 'slam' },
    musou: { dur: 4.5, tick: 0.2, range: 5.0, arc: 240, dmg: 0.95, react: 'knockup', fin: { range: 7.0, dmg: 3.4, react: 'knockback' } },
    mounted: { dur: 0.55, hitT: 0.22, range: 3.8, arc: 160, dmg: 1.6, react: 'knockback' }
  },
  pike: {
    trailColor: 0xffaa66,
    chain: [
      { dur: 0.44, hitT: 0.2,  range: 3.6, arc: 130, dmg: 1.25, react: 'flinch', swing: 'R' },
      { dur: 0.42, hitT: 0.19, range: 3.6, arc: 130, dmg: 1.25, react: 'flinch', swing: 'L' },
      { dur: 0.46, hitT: 0.21, range: 4.0, arc: 100, dmg: 1.35, react: 'flinch', swing: 'T' },
      { dur: 0.46, hitT: 0.21, range: 3.7, arc: 160, dmg: 1.4,  react: 'flinch', swing: 'R' },
      { dur: 0.48, hitT: 0.22, range: 3.7, arc: 160, dmg: 1.5,  react: 'flinch', swing: 'L' },
      { dur: 0.64, hitT: 0.28, range: 4.4, arc: 190, dmg: 2.1,  react: 'knockback', swing: 'F' }
    ],
    charges: {
      1: { dur: 0.7,  hitT: 0.34, range: 5.5, arc: 360, dmg: 1.0, react: 'stun',      fx: 'shockwave', name: 'C1·大喝' },
      2: { dur: 0.58, hitT: 0.26, range: 3.4, arc: 110, dmg: 1.8, react: 'launch',    fx: 'upslash',   name: 'C2·蛇矛升' },
      3: { dur: 0.78, hitT: 0.2,  range: 4.0, arc: 80,  dmg: 0.9, react: 'stun', hits: 3, hitGap: 0.18, fx: 'pierce', name: 'C3·连牙突' },
      4: { dur: 0.9,  hitT: 0.36, range: 5.2, arc: 360, dmg: 2.8, react: 'knockback', fx: 'spin',      name: 'C4·暴虎旋' },
      5: { dur: 0.68, hitT: 0.3,  range: 4.2, arc: 150, dmg: 2.2, react: 'launch',    fx: 'upslash',   name: 'C5·翔破' },
      6: { dur: 0.95, hitT: 0.32, range: 6.0, arc: 70,  dmg: 3.2, react: 'knockback', fx: 'dash',      name: 'C6·豪突' }
    },
    jumpAtk:    { dur: 0.46, hitT: 0.15, range: 3.4, arc: 190, dmg: 1.3, react: 'flinch' },
    jumpCharge: { dur: 0.7,  hitT: 0.34, range: 5.2, arc: 360, dmg: 2.3, react: 'knockback', fx: 'slam' },
    musou: { dur: 4.5, tick: 0.19, range: 4.8, arc: 360, dmg: 1.0, react: 'knockup', fin: { range: 7.5, dmg: 3.8, react: 'knockback' } },
    mounted: { dur: 0.58, hitT: 0.24, range: 3.8, arc: 160, dmg: 1.7, react: 'knockback' }
  }
};

/* ---------------- 关卡：黄巾之乱 ---------------- */
DATA.stage = {
  name: '黄巾之乱',
  subtitle: '～ 公元184年 · 颍川 ～',
  intro: [
    '东汉末年，朝纲不振，宦官专权，天下民不聊生。',
    '巨鹿人张角，自称「天公将军」，创立太平道，',
    '以「苍天已死，黄天当立；岁在甲子，天下大吉」为号，',
    '率数十万信徒揭竿而起。乱军头裹黄巾，故称「黄巾之乱」。',
    '',
    '朝廷震动，大将军何进急召各路豪杰讨贼。',
    '皇甫嵩、朱儁、卢植各率官军迎击，',
    '涿郡义勇军刘备、关羽、张飞亦在此列——',
    '',
    '乱世的序幕，就此拉开。'
  ],
  size: 560,
  playerStart: { x: 0, z: 205 },
  timeLimit: 60 * 30,
  victory: '讨伐敌总大将张角',
  defeat: '玩家阵亡，或我军总大将何进阵亡',

  bases: [
    { id: 'allyMain',  name: '汉军本阵',   side: 1, x: 0,    z: 238, main: true },
    { id: 'allyE',     name: '东南据点',   side: 1, x: 135,  z: 150 },
    { id: 'allyW',     name: '西南据点',   side: 1, x: -135, z: 150 },
    { id: 'center',    name: '中央据点',   side: 2, x: 0,    z: 25 },
    { id: 'east',      name: '东方据点',   side: 2, x: 185,  z: -15 },
    { id: 'west',      name: '西方据点',   side: 2, x: -185, z: -15 },
    { id: 'ne',        name: '东北据点',   side: 2, x: 120,  z: -150 },
    { id: 'nw',        name: '西北据点',   side: 2, x: -120, z: -150 },
    { id: 'enemyMain', name: '黄巾军本阵', side: 2, x: 0,    z: -238, main: true }
  ],

  officers: [
    /* ---- 黄巾军 ---- */
    { name: '程远志', side: 2, x: -70,  z: 110,  hp: 420, atk: 1.0, behavior: 'advance',
      quote: '官军来了！兄弟们，杀啊！' },
    { name: '邓茂',   side: 2, x: 70,   z: 110,  hp: 380, atk: 0.95, behavior: 'advance',
      quote: '挡我者死！' },
    { name: '波才',   side: 2, x: -150, z: 20,   hp: 480, atk: 1.05, behavior: 'guard',
      quote: '黄天庇佑，官军何足惧哉！' },
    { name: '张曼成', side: 2, x: 150,  z: 20,   hp: 480, atk: 1.05, behavior: 'guard',
      quote: '此地由我张曼成镇守！' },
    { name: '彭脱',   side: 2, x: 0,    z: -40,  hp: 450, atk: 1.0, behavior: 'advance',
      quote: '把官军赶尽杀绝！' },
    { name: '赵弘',   side: 2, x: -120, z: -150, hp: 500, atk: 1.05, behavior: 'guard',
      quote: '想过此关，先问过我手中之刀！' },
    { name: '韩忠',   side: 2, x: 120,  z: -150, hp: 500, atk: 1.05, behavior: 'guard',
      quote: '东北据点固若金汤！' },
    { name: '管亥',   side: 2, x: 0,    z: -120, hp: 650, atk: 1.2, behavior: 'guard', strong: true,
      quote: '我乃管亥！有胆便放马过来！' },
    { name: '张梁',   side: 2, title: '人公将军', x: -85, z: -195, hp: 950, atk: 1.3,
      behavior: 'guard', boss: 'liang', strong: true,
      quote: '人公将军张梁在此！兄长之大业，岂容尔等阻挠！' },
    { name: '张宝',   side: 2, title: '地公将军', x: 85,  z: -195, hp: 950, atk: 1.25,
      behavior: 'guard', boss: 'bao', strong: true, sorcerer: true,
      quote: '地公将军张宝！让尔等见识妖术之威！' },
    { name: '张角',   side: 2, title: '天公将军', x: 0,   z: -238, hp: 1600, atk: 1.5,
      behavior: 'camp', boss: 'jiao', strong: true, sorcerer: true, barrier: true, commander: true,
      quote: '苍天已死，黄天当立！岁在甲子，天下大吉！' },

    /* ---- 汉军 ---- */
    { name: '何进',   side: 1, title: '大将军', x: 0, z: 242, hp: 900, atk: 1.0,
      behavior: 'camp', vital: true, commander: true,
      quote: '诸将听令！镇压黄巾，扬我汉威！' },
    { name: '皇甫嵩', side: 1, x: -60, z: 175, hp: 820, atk: 1.15, behavior: 'advance',
      quote: '贼势虽众，乌合之众耳！' },
    { name: '朱儁',   side: 1, x: 60,  z: 175, hp: 820, atk: 1.15, behavior: 'advance',
      quote: '正面突破，直取贼首！' },
    { name: '卢植',   side: 1, x: 0,   z: 160, hp: 850, atk: 1.1, behavior: 'advance',
      quote: '为了天下苍生，此战必胜！' },
    { name: '刘备',   side: 1, x: -30, z: 190, hp: 780, atk: 1.1, behavior: 'advance',
      quote: '百姓何辜！吾等义军，誓讨黄巾！' }
    /* 关羽/张飞 视玩家选择动态加入 */
  ],

  npcBrothers: {
    guanyu:  { name: '关羽', side: 1, x: -45, z: 196, hp: 850, atk: 1.3, behavior: 'advance', strong: true,
      quote: '逆贼！关某之刀，可不留情！' },
    zhangfei: { name: '张飞', side: 1, x: -15, z: 196, hp: 880, atk: 1.35, behavior: 'advance', strong: true,
      quote: '哇呀呀！让俺老张来会会你们！' },
    zhaoyun: null
  },

  reinforcements: [
    { time: 300, name: '曹操', side: 1, x: 200, z: 120, hp: 900, atk: 1.35, behavior: 'advance', strong: true,
      msg: '骑都尉曹操率援军抵达战场！', quote: '乱世之奸雄？呵……且看孟德之剑！' },
    { time: 460, name: '孙坚', side: 1, x: -200, z: 120, hp: 900, atk: 1.35, behavior: 'advance', strong: true,
      msg: '江东之虎孙坚率援军参战！', quote: '江东健儿，随我冲锋！' }
  ],

  ambush: { time: 170, name: '裴元绍', side: 2, x: -170, z: 205, hp: 420, atk: 1.0, behavior: 'advance',
    msg: '敌军伏兵出现在我军本阵附近！', quote: '嘿嘿……端了官军的老窝！' }
};

/* ---------------- 系统文本 ---------------- */
DATA.text = {
  gameTitle: '真·三國無雙 WEB',
  stageStart: '战斗开始',
  officerDefeated: '敌将，讨取！！',
  allyOfficerLost: name => '我军武将 ' + name + ' 败走了……',
  enemyOfficerLost: name => '敌将 ' + name + '，被讨取了！',
  baseTaken: name => '我军占领了' + name + '！',
  baseLost: name => name + '被敌军夺取了！',
  sorceryStart: '张宝施展妖术！天降雷火——讨伐张宝方可破解！',
  sorceryEnd: '张宝已灭，妖术烟消云散！',
  barrierHint: '张角以妖术结界护身！须先讨伐张梁与张宝！',
  barrierBreak: '妖术结界已破！贼首张角现身了！',
  jiaoAppear: '天公将军张角，亲临战阵！',
  k100: '百人斩达成！',
  k500: '五百人斩！势不可挡！',
  k1000: '千人斩达成！真乃一骑当千！',
  heJinDanger: '总大将何进正遭受攻击！速回本阵救援！',
  playerDanger: '体力告急！寻找肉包子恢复体力！',
  musouFull: '无双槽已满！按 L 发动无双乱舞！',
  victory: '胜 利',
  defeat: '败 北',
  victorySub: '黄巾之乱，就此平定',
  defeatSub: '讨伐军就此溃败……乱世将更加深重',
  ranks: [
    { min: 900, rank: '天下无双', comment: '战场的支配者！你的武勇必将名留青史！' },
    { min: 500, rank: '盖世英豪', comment: '压倒性的武力！敌军闻风丧胆！' },
    { min: 250, rank: '百战骁将', comment: '独当一面的勇将，前途不可限量。' },
    { min: 100, rank: '沙场勇士', comment: '初露锋芒，尚需磨砺。' },
    { min: 0,   rank: '无名小卒', comment: '战场无情，惟有精进武艺方能生存。' }
  ]
};

/* ---------------- 道具 ---------------- */
DATA.items = {
  baozi:    { name: '肉包子',     color: 0xf5e6c8, effect: 'hp', value: 80,  msg: '体力恢复！' },
  bigbaozi: { name: '大肉包子',   color: 0xffe0a0, effect: 'hp', value: 9999, msg: '体力完全恢复！' },
  wine:     { name: '酒',         color: 0xcc4444, effect: 'musou', value: 50, msg: '无双槽上升！' },
  atkup:    { name: '攻击力上升', color: 0xff6633, effect: 'atk', value: 30, msg: '攻击力×2（30秒）' },
  defup:    { name: '防御力上升', color: 0x3399ff, effect: 'def', value: 30, msg: '防御力×2（30秒）' }
};

/* ---------------- 士兵配置 ---------------- */
DATA.mobTypes = {
  sword:   { hp: 42,  atk: 6,  spd: 3.2, range: 1.9, weapon: 'sword' },
  spear:   { hp: 52,  atk: 8,  spd: 3.0, range: 2.6, weapon: 'spear' },
  archer:  { hp: 34,  atk: 7,  spd: 2.6, range: 18,  weapon: 'bow' },
  captain: { hp: 150, atk: 12, spd: 3.4, range: 2.2, weapon: 'sword', captain: true }
};
