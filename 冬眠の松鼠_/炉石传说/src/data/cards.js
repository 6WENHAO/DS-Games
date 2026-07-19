// ==== 卡牌数据库：全部为声明式定义 ====
// type: minion | spell    keywords: taunt | charge | divineShield
// battlecry / deathrattle / effect 由 core/effects.js 解释执行

const DB = {
  // ---------- 衍生物 / 特殊 ----------
  coin: {
    id: 'coin', name: '幸运币', type: 'spell', cost: 0, rarity: 'free',
    icon: 'coin', tint: '#c9a227', cls: 'neutral', token: true,
    text: '在本回合中，获得一个法力水晶。',
    effect: { type: 'gainMana', amount: 1, target: 'none' },
  },
  sheep: {
    id: 'sheep', name: '绵羊', type: 'minion', cost: 1, atk: 1, hp: 1,
    rarity: 'free', icon: 'polymorph', tint: '#9ccc65', cls: 'neutral', token: true, text: '',
  },
  damaged_golem: {
    id: 'damaged_golem', name: '损坏的魔像', type: 'minion', cost: 1, atk: 2, hp: 1,
    rarity: 'free', icon: 'harvest_golem', tint: '#8d6e63', cls: 'neutral', token: true, text: '',
  },

  // ---------- 中立随从 ----------
  wisp: { id: 'wisp', name: '幽灵小精灵', type: 'minion', cost: 0, atk: 1, hp: 1, rarity: 'common', icon: 'wisp', tint: '#80deea', cls: 'neutral', text: '' },
  murloc: { id: 'murloc', name: '鱼人袭击者', type: 'minion', cost: 1, atk: 2, hp: 1, rarity: 'common', icon: 'murloc', tint: '#26a69a', cls: 'neutral', text: '' },
  boar: {
    id: 'boar', name: '石牙野猪', type: 'minion', cost: 1, atk: 1, hp: 1, rarity: 'common',
    icon: 'boar', tint: '#a1887f', cls: 'neutral', keywords: ['charge'], text: '冲锋',
  },
  argent_squire: {
    id: 'argent_squire', name: '银色侍从', type: 'minion', cost: 1, atk: 1, hp: 1, rarity: 'common',
    icon: 'argent_squire', tint: '#e0e0e0', cls: 'neutral', keywords: ['divineShield'], text: '圣盾',
  },
  leper_gnome: {
    id: 'leper_gnome', name: '麻风侏儒', type: 'minion', cost: 1, atk: 2, hp: 1, rarity: 'common',
    icon: 'leper_gnome', tint: '#7cb342', cls: 'neutral',
    text: '亡语：对敌方英雄造成2点伤害。',
    deathrattle: { type: 'damageRandom', amount: 2, times: 1, heroOnly: true },
  },
  croc: { id: 'croc', name: '淡水鳄', type: 'minion', cost: 2, atk: 2, hp: 3, rarity: 'common', icon: 'croc', tint: '#558b2f', cls: 'neutral', text: '' },
  raptor: { id: 'raptor', name: '血沼迅猛龙', type: 'minion', cost: 2, atk: 3, hp: 2, rarity: 'common', icon: 'raptor', tint: '#e53935', cls: 'neutral', text: '' },
  loot_hoarder: {
    id: 'loot_hoarder', name: '战利品贮藏者', type: 'minion', cost: 2, atk: 2, hp: 1, rarity: 'common',
    icon: 'loot_hoarder', tint: '#ffb300', cls: 'neutral',
    text: '亡语：抽一张牌。',
    deathrattle: { type: 'draw', count: 1 },
  },
  tinker: {
    id: 'tinker', name: '工程师学徒', type: 'minion', cost: 2, atk: 1, hp: 1, rarity: 'common',
    icon: 'tinker', tint: '#ff8f00', cls: 'neutral',
    text: '战吼：抽一张牌。',
    battlecry: { type: 'draw', count: 1 },
  },
  frostwolf: {
    id: 'frostwolf', name: '霜狼步兵', type: 'minion', cost: 2, atk: 2, hp: 2, rarity: 'common',
    icon: 'frostwolf', tint: '#90a4ae', cls: 'neutral', keywords: ['taunt'], text: '嘲讽',
  },
  grizzly: {
    id: 'grizzly', name: '铁鬃灰熊', type: 'minion', cost: 3, atk: 3, hp: 3, rarity: 'common',
    icon: 'grizzly', tint: '#6d4c41', cls: 'neutral', keywords: ['taunt'], text: '嘲讽',
  },
  silverback: {
    id: 'silverback', name: '银背族长', type: 'minion', cost: 3, atk: 1, hp: 4, rarity: 'common',
    icon: 'silverback', tint: '#78909c', cls: 'neutral', keywords: ['taunt'], text: '嘲讽',
  },
  harvest_golem: {
    id: 'harvest_golem', name: '收割机器人', type: 'minion', cost: 3, atk: 2, hp: 3, rarity: 'rare',
    icon: 'harvest_golem', tint: '#bcaaa4', cls: 'neutral',
    text: '亡语：召唤一个2/1的损坏的魔像。',
    deathrattle: { type: 'summon', tokenId: 'damaged_golem', count: 1 },
  },
  spider_tank: { id: 'spider_tank', name: '蜘蛛坦克', type: 'minion', cost: 3, atk: 3, hp: 4, rarity: 'common', icon: 'spider_tank', tint: '#5c6bc0', cls: 'neutral', text: '' },
  yeti: { id: 'yeti', name: '冷风雪人', type: 'minion', cost: 4, atk: 4, hp: 5, rarity: 'common', icon: 'yeti', tint: '#4fc3f7', cls: 'neutral', text: '' },
  senjin: {
    id: 'senjin', name: '森金持盾卫士', type: 'minion', cost: 4, atk: 3, hp: 5, rarity: 'common',
    icon: 'senjin', tint: '#26c6da', cls: 'neutral', keywords: ['taunt'], text: '嘲讽',
  },
  stormwind_knight: {
    id: 'stormwind_knight', name: '暴风城骑士', type: 'minion', cost: 4, atk: 2, hp: 5, rarity: 'common',
    icon: 'stormwind_knight', tint: '#42a5f5', cls: 'neutral', keywords: ['charge'], text: '冲锋',
  },
  bodyguard: {
    id: 'bodyguard', name: '藏宝海湾保镖', type: 'minion', cost: 5, atk: 5, hp: 4, rarity: 'common',
    icon: 'bodyguard', tint: '#8d6e63', cls: 'neutral', keywords: ['taunt'], text: '嘲讽',
  },
  ogre: { id: 'ogre', name: '石拳食人魔', type: 'minion', cost: 6, atk: 6, hp: 7, rarity: 'common', icon: 'ogre', tint: '#7e57c2', cls: 'neutral', text: '' },
  war_golem: { id: 'war_golem', name: '作战魔像', type: 'minion', cost: 7, atk: 7, hp: 7, rarity: 'common', icon: 'war_golem', tint: '#78909c', cls: 'neutral', text: '' },
  dragon: {
    id: 'dragon', name: '深红巨龙', type: 'minion', cost: 8, atk: 8, hp: 8, rarity: 'epic',
    icon: 'dragon', tint: '#d32f2f', cls: 'neutral', text: '',
  },

  // ---------- 法师 ----------
  arcane_missiles: {
    id: 'arcane_missiles', name: '奥术飞弹', type: 'spell', cost: 1, rarity: 'common',
    icon: 'arcane_missiles', tint: '#7e57c2', cls: 'mage',
    text: '造成3点伤害，随机分配给敌方角色。',
    effect: { type: 'damageRandom', amount: 1, times: 3, target: 'none' },
  },
  frostbolt: {
    id: 'frostbolt', name: '寒冰箭', type: 'spell', cost: 2, rarity: 'common',
    icon: 'frostbolt', tint: '#29b6f6', cls: 'mage',
    text: '造成3点伤害。',
    effect: { type: 'damage', amount: 3, target: 'any' },
  },
  arcane_intellect: {
    id: 'arcane_intellect', name: '奥术智慧', type: 'spell', cost: 3, rarity: 'common',
    icon: 'arcane_intellect', tint: '#ab47bc', cls: 'mage',
    text: '抽两张牌。',
    effect: { type: 'draw', count: 2, target: 'none' },
  },
  fireball: {
    id: 'fireball', name: '火球术', type: 'spell', cost: 4, rarity: 'common',
    icon: 'fireball', tint: '#f4511e', cls: 'mage',
    text: '造成6点伤害。',
    effect: { type: 'damage', amount: 6, target: 'any' },
  },
  polymorph: {
    id: 'polymorph', name: '变形术', type: 'spell', cost: 4, rarity: 'common',
    icon: 'polymorph', tint: '#9ccc65', cls: 'mage',
    text: '使一个随从变形成为1/1的绵羊。',
    effect: { type: 'transform', tokenId: 'sheep', target: 'minion' },
  },
  water_elemental: {
    id: 'water_elemental', name: '水元素', type: 'minion', cost: 4, atk: 3, hp: 6, rarity: 'rare',
    icon: 'water_elemental', tint: '#0288d1', cls: 'mage', text: '',
  },
  flame_lord: {
    id: 'flame_lord', name: '炎魔领主', type: 'minion', cost: 6, atk: 6, hp: 6, rarity: 'epic',
    icon: 'flame_lord', tint: '#ff7043', cls: 'mage',
    text: '战吼：对所有敌方角色造成1点伤害。',
    battlecry: { type: 'aoe', amount: 1, side: 'enemy', includeHeroes: true, target: 'none' },
  },
  flamestrike: {
    id: 'flamestrike', name: '烈焰风暴', type: 'spell', cost: 7, rarity: 'rare',
    icon: 'flamestrike', tint: '#ff5722', cls: 'mage',
    text: '对所有敌方随从造成4点伤害。',
    effect: { type: 'aoe', amount: 4, side: 'enemy', target: 'none' },
  },

  // ---------- 战士 ----------
  whirlwind: {
    id: 'whirlwind', name: '旋风斩', type: 'spell', cost: 1, rarity: 'common',
    icon: 'whirlwind', tint: '#bdbdbd', cls: 'warrior',
    text: '对所有随从造成1点伤害。',
    effect: { type: 'aoe', amount: 1, side: 'all', target: 'none' },
  },
  execute: {
    id: 'execute', name: '斩杀', type: 'spell', cost: 2, rarity: 'common',
    icon: 'execute', tint: '#b71c1c', cls: 'warrior',
    text: '消灭一个受伤的敌方随从。',
    effect: { type: 'destroy', target: 'enemy_minion', condition: 'damaged' },
  },
  heroic_strike: {
    id: 'heroic_strike', name: '英勇打击', type: 'spell', cost: 2, rarity: 'common',
    icon: 'heroic_strike', tint: '#fbc02d', cls: 'warrior',
    text: '在本回合中，使你的英雄获得+4攻击力。',
    effect: { type: 'heroAttack', amount: 4, target: 'none' },
  },
  shield_block: {
    id: 'shield_block', name: '盾牌格挡', type: 'spell', cost: 3, rarity: 'common',
    icon: 'shield_block', tint: '#5c6bc0', cls: 'warrior',
    text: '获得5点护甲值，抽一张牌。',
    effect: { type: 'multi', target: 'none', effects: [ { type: 'armor', amount: 5 }, { type: 'draw', count: 1 } ] },
  },
  korkron: {
    id: 'korkron', name: '库卡隆精英卫士', type: 'minion', cost: 4, atk: 4, hp: 3, rarity: 'common',
    icon: 'korkron', tint: '#ef6c00', cls: 'warrior', keywords: ['charge'], text: '冲锋',
  },
};

export const HEROES = {
  mage: {
    id: 'mage', name: '大法师 艾琳娜', icon: 'hero_mage', tint: '#5e35b1',
    power: {
      name: '火焰冲击', icon: 'hp_fireblast', cost: 2,
      text: '造成1点伤害。',
      effect: { type: 'damage', amount: 1, target: 'any' },
    },
  },
  warrior: {
    id: 'warrior', name: '战争领主 布洛克', icon: 'hero_warrior', tint: '#bf360c',
    power: {
      name: '全副武装', icon: 'hp_armorup', cost: 2,
      text: '获得2点护甲值。',
      effect: { type: 'armor', amount: 2, target: 'none' },
    },
  },
};

export const DECKS = {
  mage: [
    'arcane_missiles', 'arcane_missiles', 'frostbolt', 'frostbolt',
    'arcane_intellect', 'arcane_intellect', 'fireball', 'fireball',
    'polymorph', 'polymorph', 'water_elemental', 'water_elemental',
    'flamestrike', 'flamestrike', 'flame_lord',
    'murloc', 'murloc', 'loot_hoarder', 'loot_hoarder',
    'tinker', 'tinker', 'grizzly', 'grizzly',
    'yeti', 'yeti', 'senjin', 'senjin',
    'ogre', 'ogre', 'dragon',
  ],
  warrior: [
    'whirlwind', 'whirlwind', 'execute', 'execute',
    'heroic_strike', 'heroic_strike', 'shield_block', 'shield_block',
    'korkron', 'korkron',
    'boar', 'boar', 'argent_squire', 'argent_squire',
    'leper_gnome', 'leper_gnome', 'raptor', 'raptor',
    'frostwolf', 'frostwolf', 'harvest_golem', 'harvest_golem',
    'spider_tank', 'spider_tank', 'stormwind_knight', 'stormwind_knight',
    'bodyguard', 'bodyguard', 'war_golem', 'dragon',
  ],
};

export function getCard(id) {
  const c = DB[id];
  if (!c) throw new Error(`未知卡牌: ${id}`);
  return c;
}

export const ALL_CARDS = DB;
