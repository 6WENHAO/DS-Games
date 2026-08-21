/* ============================================================
   data-potions.js —— 药水
   ============================================================ */
'use strict';

const POTIONS = {
  fire_potion: {
    name: '火焰药水', rarity: 'common', color: '#e05a20', shape: 'cone', target: 'enemy', combatOnly: true,
    desc: '对一个敌人造成 20 点伤害。',
    use: async (t) => { await A.attack(t, 20, { noStr: true }); }
  },
  block_potion: {
    name: '格挡药水', rarity: 'common', color: '#5a8ac0', shape: 'round', combatOnly: true,
    desc: '获得 12 点格挡。',
    use: async () => { A.block(12, { raw: true }); }
  },
  strength_potion: {
    name: '力量药水', rarity: 'common', color: '#c03a3a', shape: 'tall', combatOnly: true,
    desc: '获得 2 层力量。',
    use: async () => { A.buffSelf('strength', 2); }
  },
  dexterity_potion: {
    name: '敏捷药水', rarity: 'common', color: '#3ac08a', shape: 'tall', combatOnly: true,
    desc: '获得 2 层敏捷。',
    use: async () => { A.buffSelf('dexterity', 2); }
  },
  energy_potion: {
    name: '能量药水', rarity: 'common', color: '#3fd0c9', shape: 'round', combatOnly: true,
    desc: '获得 2 点能量。',
    use: async () => { A.gainEnergy(2); }
  },
  swift_potion: {
    name: '迅捷药水', rarity: 'common', color: '#c0c040', shape: 'cone', combatOnly: true,
    desc: '抽 3 张牌。',
    use: async () => { await A.draw(3); }
  },
  weak_potion: {
    name: '虚弱药水', rarity: 'common', color: '#8a5ac0', shape: 'cone', target: 'enemy', combatOnly: true,
    desc: '给予一个敌人 3 层虚弱。',
    use: async (t) => { A.power(t, 'weak', 3); }
  },
  fear_potion: {
    name: '恐惧药水', rarity: 'common', color: '#c05a90', shape: 'cone', target: 'enemy', combatOnly: true,
    desc: '给予一个敌人 3 层易伤。',
    use: async (t) => { A.power(t, 'vulnerable', 3); }
  },
  blood_potion: {
    name: '血液药水', rarity: 'common', color: '#a01818', shape: 'round',
    desc: '回复 20% 最大生命值。',
    use: async () => { healOutOfCombat(Math.floor(S.maxHp * 0.2)); }
  },
  explosive_potion: {
    name: '爆炸药水', rarity: 'common', color: '#e08020', shape: 'round', combatOnly: true,
    desc: '对所有敌人造成 10 点伤害。',
    use: async () => { await A.attackAll(10, { noStr: true }); }
  },
  fruit_juice: {
    name: '果汁', rarity: 'rare', color: '#e0a0c0', shape: 'tall',
    desc: '永久提升 5 点最大生命值。',
    use: async () => { S.maxHp += 5; S.hp += 5; if (CB) { CB.player.maxHp = S.maxHp; CB.player.hp = S.hp; } }
  },
  ancient_potion: {
    name: '远古药水', rarity: 'uncommon', color: '#c9a44a', shape: 'round', combatOnly: true,
    desc: '获得 1 层神器。',
    use: async () => { A.buffSelf('artifact', 1); }
  },
  regen_potion: {
    name: '再生药水', rarity: 'uncommon', color: '#4ac06a', shape: 'tall', combatOnly: true,
    desc: '获得 5 层再生。',
    use: async () => { A.buffSelf('regen', 5); }
  },
  essence_of_steel: {
    name: '精钢精华', rarity: 'uncommon', color: '#a8b4c0', shape: 'round', combatOnly: true,
    desc: '获得 4 层镀甲。',
    use: async () => { A.buffSelf('platedArmor', 4); }
  },
  liquid_bronze: {
    name: '液态青铜', rarity: 'uncommon', color: '#b98a54', shape: 'cone', combatOnly: true,
    desc: '获得 3 层尖刺。',
    use: async () => { A.buffSelf('thorns', 3); }
  },
  attack_potion: {
    name: '攻击药水', rarity: 'common', color: '#c05a34', shape: 'cone', combatOnly: true,
    desc: '将 1 张随机攻击牌加入手牌，其本回合费用为 0。',
    use: async () => {
      const pool = Object.keys(CARDS).filter(k => CARDS[k].type === 'attack' && !CARDS[k].noPool);
      A.addCard('hand', pick(pool), { freeThisTurn: true });
    }
  },
  skill_potion: {
    name: '技能药水', rarity: 'common', color: '#4a86b0', shape: 'cone', combatOnly: true,
    desc: '将 1 张随机技能牌加入手牌，其本回合费用为 0。',
    use: async () => {
      const pool = Object.keys(CARDS).filter(k => CARDS[k].type === 'skill' && !CARDS[k].noPool);
      A.addCard('hand', pick(pool), { freeThisTurn: true });
    }
  },
  cultist_potion: {
    name: '邪教徒药水', rarity: 'rare', color: '#8ac04a', shape: 'round', combatOnly: true,
    desc: '获得 1 层仪式（每回合结束获得 1 点力量）。',
    use: async () => { A.buffSelf('ritual', 1); }
  }
};

function potionPool() {
  return Object.keys(POTIONS);
}
function randomPotion() {
  const r = rnd();
  let rarity = 'common';
  if (r > 0.9) rarity = 'rare'; else if (r > 0.65) rarity = 'uncommon';
  const list = Object.keys(POTIONS).filter(k => POTIONS[k].rarity === rarity);
  return list.length ? pick(list) : pick(Object.keys(POTIONS));
}
