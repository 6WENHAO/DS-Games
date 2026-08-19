// ============================================================
// data.js — 游戏静态数据：18 属性克制表 / 招式 / 6 只原创精灵 / 对手队伍 / 道具
// 精灵为原创设计（非任天堂角色），规则参照宝可梦第三世代（GBA 宝石版）。
// ============================================================
'use strict';

// 18 属性
const TYPES = ['一般', '火', '水', '草', '电', '冰', '格斗', '毒', '地面', '飞行', '超能', '虫', '岩', '幽灵', '龙', '恶', '钢', '妖精'];

// 属性徽章配色（背景 / 前景 调色板索引）
const TYPE_COLOR = {
  '一般': [8, 1], '火': [23, 30], '水': [26, 30], '草': [16, 30], '电': [20, 1],
  '冰': [5, 1], '格斗': [22, 30], '毒': [28, 30], '地面': [11, 30], '飞行': [6, 1],
  '超能': [27, 24], '虫': [18, 1], '岩': [12, 30], '幽灵': [29, 30], '龙': [24, 30],
  '恶': [2, 30], '钢': [31, 1], '妖精': [27, 1],
};

// 克制表：攻击属性 -> { 防御属性: 倍率 }，缺省 1
const CHART = {
  '一般': { '岩': 0.5, '钢': 0.5, '幽灵': 0 },
  '火': { '草': 2, '冰': 2, '虫': 2, '钢': 2, '火': 0.5, '水': 0.5, '岩': 0.5, '龙': 0.5 },
  '水': { '火': 2, '地面': 2, '岩': 2, '水': 0.5, '草': 0.5, '龙': 0.5 },
  '草': { '水': 2, '地面': 2, '岩': 2, '火': 0.5, '草': 0.5, '毒': 0.5, '飞行': 0.5, '虫': 0.5, '龙': 0.5, '钢': 0.5 },
  '电': { '水': 2, '飞行': 2, '地面': 0, '草': 0.5, '电': 0.5, '龙': 0.5 },
  '冰': { '草': 2, '地面': 2, '飞行': 2, '龙': 2, '火': 0.5, '水': 0.5, '冰': 0.5, '钢': 0.5 },
  '格斗': { '一般': 2, '冰': 2, '岩': 2, '恶': 2, '钢': 2, '毒': 0.5, '飞行': 0.5, '超能': 0.5, '虫': 0.5, '幽灵': 0, '妖精': 0.5 },
  '毒': { '草': 2, '妖精': 2, '毒': 0.5, '地面': 0.5, '岩': 0.5, '幽灵': 0.5, '钢': 0 },
  '地面': { '火': 2, '电': 2, '毒': 2, '岩': 2, '钢': 2, '草': 0.5, '虫': 0.5, '飞行': 0 },
  '飞行': { '草': 2, '格斗': 2, '虫': 2, '电': 0.5, '岩': 0.5, '钢': 0.5 },
  '超能': { '格斗': 2, '毒': 2, '超能': 0.5, '钢': 0.5, '恶': 0 },
  '虫': { '草': 2, '超能': 2, '恶': 2, '火': 0.5, '格斗': 0.5, '毒': 0.5, '飞行': 0.5, '幽灵': 0.5, '钢': 0.5, '妖精': 0.5 },
  '岩': { '火': 2, '冰': 2, '飞行': 2, '虫': 2, '格斗': 0.5, '地面': 0.5, '钢': 0.5 },
  '幽灵': { '幽灵': 2, '超能': 2, '一般': 0, '恶': 0.5 },
  '龙': { '龙': 2, '钢': 0.5, '妖精': 0 },
  '恶': { '幽灵': 2, '超能': 2, '格斗': 0.5, '恶': 0.5, '妖精': 0.5 },
  '钢': { '冰': 2, '岩': 2, '妖精': 2, '火': 0.5, '水': 0.5, '电': 0.5, '钢': 0.5 },
  '妖精': { '格斗': 2, '龙': 2, '恶': 2, '火': 0.5, '毒': 0.5, '钢': 0.5 },
};

// 招式表
// cat: phys 物理 / spec 特殊 / status 变化
// fx 字段：burn/para/freeze/sleep/toxic/conf 概率；stat:[{stat,stages,chance}]
// statDown 同 stat 但作用于目标；flinch 畏缩概率；drain 回复比例；crit 会心+1
// weather/terrain 指定天气/场地；perfect 必中
const MOVES = {
  tackle: { name: '撞击', type: '一般', cat: 'phys', power: 40, acc: 100, pp: 35, priority: 0, fx: {} },
  quickattack: { name: '电光一闪', type: '一般', cat: 'phys', power: 40, acc: 100, pp: 30, priority: 1, fx: {} },
  ember: { name: '火花', type: '火', cat: 'spec', power: 40, acc: 100, pp: 25, priority: 0, fx: { burn: 10 } },
  firepunch: { name: '火焰拳', type: '火', cat: 'phys', power: 75, acc: 100, pp: 15, priority: 0, fx: { burn: 10 } },
  flamethrower: { name: '喷射火焰', type: '火', cat: 'spec', power: 90, acc: 100, pp: 15, priority: 0, fx: { burn: 10 } },
  sunnyday: { name: '大晴天', type: '火', cat: 'status', power: 0, acc: 101, pp: 5, priority: 0, fx: { weather: '大晴天' } },
  watergun: { name: '水枪', type: '水', cat: 'spec', power: 40, acc: 100, pp: 25, priority: 0, fx: {} },
  icebeam: { name: '冰冻光束', type: '冰', cat: 'spec', power: 90, acc: 100, pp: 10, priority: 0, fx: { freeze: 10 } },
  surf: { name: '冲浪', type: '水', cat: 'spec', power: 90, acc: 100, pp: 15, priority: 0, fx: {} },
  raindance: { name: '求雨', type: '水', cat: 'status', power: 0, acc: 101, pp: 5, priority: 0, fx: { weather: '雨天' } },
  razorleaf: { name: '飞叶快刀', type: '草', cat: 'phys', power: 55, acc: 95, pp: 25, priority: 0, fx: { crit: 1 } },
  energyball: { name: '能量球', type: '草', cat: 'spec', power: 90, acc: 100, pp: 10, priority: 0, fx: { statDown: [{ stat: 'spd', stages: 1, chance: 10 }] } },
  leechseed: { name: '寄生种子', type: '草', cat: 'status', power: 0, acc: 90, pp: 10, priority: 0, fx: { seed: true } },
  toxic: { name: '剧毒', type: '毒', cat: 'status', power: 0, acc: 90, pp: 10, priority: 0, fx: { toxic: true } },
  thundershock: { name: '电击', type: '电', cat: 'spec', power: 40, acc: 100, pp: 30, priority: 0, fx: { para: 10 } },
  thunderbolt: { name: '十万伏特', type: '电', cat: 'spec', power: 90, acc: 100, pp: 15, priority: 0, fx: { para: 10 } },
  thunderwave: { name: '电磁波', type: '电', cat: 'status', power: 0, acc: 90, pp: 20, priority: 0, fx: { para: true } },
  eterrain: { name: '电气场地', type: '电', cat: 'status', power: 0, acc: 101, pp: 10, priority: 0, fx: { terrain: '电气场地' } },
  psychic: { name: '精神强念', type: '超能', cat: 'spec', power: 90, acc: 100, pp: 10, priority: 0, fx: { statDown: [{ stat: 'spd', stages: 1, chance: 10 }] } },
  shadowball: { name: '暗影球', type: '幽灵', cat: 'spec', power: 80, acc: 100, pp: 15, priority: 0, fx: { statDown: [{ stat: 'spd', stages: 1, chance: 20 }] } },
  hypnosis: { name: '催眠术', type: '超能', cat: 'status', power: 0, acc: 60, pp: 20, priority: 0, fx: { sleep: true } },
  calmind: { name: '冥想', type: '超能', cat: 'status', power: 0, acc: 101, pp: 20, priority: 0, fx: { stat: [{ stat: 'spa', stages: 1, chance: 100 }, { stat: 'spd', stages: 1, chance: 100 }] } },
  rockslide: { name: '岩崩', type: '岩', cat: 'phys', power: 75, acc: 90, pp: 10, priority: 0, fx: { flinch: 30 } },
  earthquake: { name: '地震', type: '地面', cat: 'phys', power: 100, acc: 100, pp: 10, priority: 0, fx: {} },
  swordsdance: { name: '剑舞', type: '一般', cat: 'status', power: 0, acc: 101, pp: 20, priority: 0, fx: { stat: [{ stat: 'atk', stages: 2, chance: 100 }] } },
  sandstorm: { name: '沙暴', type: '岩', cat: 'status', power: 0, acc: 101, pp: 10, priority: 0, fx: { weather: '沙暴' } },
  struggle: { name: '挣扎', type: '一般', cat: 'phys', power: 50, acc: 101, pp: 1, priority: 0, fx: { recoil: 0.25 } },
};

// 6 只可选原创精灵
const SPECIES = {
  firefox: {
    name: '焰尾狐', types: ['火'],
    base: { hp: 75, atk: 85, def: 70, spa: 95, spd: 68, spe: 97 },
    desc: '尾巴燃烧着永不熄灭的火焰，动作敏捷的火狐狸。',
    moves: ['ember', 'firepunch', 'flamethrower', 'sunnyday'],
  },
  sproutaur: {
    name: '青芽兽', types: ['草'],
    base: { hp: 88, atk: 62, def: 78, spa: 88, spd: 92, spe: 60 },
    desc: '背上萌芽的小恐龙，沐浴阳光就能恢复精神。',
    moves: ['razorleaf', 'energyball', 'leechseed', 'toxic'],
  },
  waveturtle: {
    name: '浪壳龟', types: ['水'],
    base: { hp: 95, atk: 72, def: 102, spa: 78, spd: 85, spe: 52 },
    desc: '背着浪花纹甲壳的水龟，喜欢在瀑布下修行。',
    moves: ['watergun', 'icebeam', 'surf', 'raindance'],
  },
  voltmouse: {
    name: '电光鼠', types: ['电'],
    base: { hp: 72, atk: 68, def: 58, spa: 82, spd: 66, spe: 108 },
    desc: '脸颊带电的迅捷小鼠，能跑出电光般的速度。',
    moves: ['thundershock', 'thunderbolt', 'thunderwave', 'eterrain'],
  },
  psykitty: {
    name: '幻念猫', types: ['超能'],
    base: { hp: 78, atk: 55, def: 66, spa: 102, spd: 98, spe: 88 },
    desc: '额头的宝石会发光的猫咪，能用念力移物。',
    moves: ['psychic', 'shadowball', 'hypnosis', 'calmind'],
  },
  rockrhino: {
    name: '岩甲犀', types: ['地面', '岩'],
    base: { hp: 100, atk: 112, def: 118, spa: 48, spd: 58, spe: 46 },
    desc: '披着岩石铠甲的重型犀牛，冲刺时地动山摇。',
    moves: ['rockslide', 'earthquake', 'swordsdance', 'sandstorm'],
  },
};

// 对手（训练家 小蓝）固定三只
const RIVAL_TEAM = ['sproutaur', 'voltmouse', 'firefox'];
const RIVAL_NAME = '小蓝';
const RIVAL_LEVELS = [46, 47, 48];

// 背包道具（简化）
const ITEMS = {
  potion: { name: '伤药', heal: 20, count: 2, desc: '回复 20 点 HP' },
  superpotion: { name: '高级伤药', heal: 60, count: 1, desc: '回复 60 点 HP' },
  fullheal: { name: '万能药', cure: true, count: 2, desc: '治愈所有异常状态' },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TYPES, TYPE_COLOR, CHART, MOVES, SPECIES, RIVAL_TEAM, RIVAL_NAME, RIVAL_LEVELS, ITEMS };
}
