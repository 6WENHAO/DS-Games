/* ============================================================
   data-cards.js —— 卡牌库（铁甲战士 / 无色 / 状态 / 诅咒）
   desc(card, F)：F.d 伤害数值、F.b 格挡数值、F.n 普通数值
   use(ctx)：ctx = { card, target, F }
   ============================================================ */
'use strict';

/* 取卡牌数值（自动处理升级） */
function V(card, key) {
  const d = CARDS[card.id];
  if (!d) return 0;
  if (card.upgraded) {
    const uk = 'up' + key.charAt(0).toUpperCase() + key.slice(1);
    if (d[uk] !== undefined) return d[uk];
  }
  return d[key];
}

const CARDS = {

  /* ======================= 初始牌 ======================= */
  strike: {
    name: '打击', en: 'Strike', type: 'attack', rarity: 'basic', cost: 1, target: 'enemy',
    art: 'slash', dmg: 6, upDmg: 9, tags: ['strike'],
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害。`,
    use: async (x) => { await A.attack(x.target, V(x.card, 'dmg')); }
  },
  defend: {
    name: '防御', en: 'Defend', type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    art: 'shield', block: 5, upBlock: 8,
    desc: (c, F) => `获得 ${F.b(V(c, 'block'))} 点格挡。`,
    use: async (x) => { A.block(V(x.card, 'block')); }
  },
  bash: {
    name: '痛击', en: 'Bash', type: 'attack', rarity: 'basic', cost: 2, target: 'enemy',
    art: 'hammer', dmg: 8, upDmg: 10, mag: 2, upMag: 3,
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害，给予 ${F.n(V(c, 'mag'))} 层[易伤]。`,
    use: async (x) => {
      await A.attack(x.target, V(x.card, 'dmg'));
      A.power(x.target, 'vulnerable', V(x.card, 'mag'));
    }
  },

  /* ======================= 普通 · 攻击 ======================= */
  anger: {
    name: '愤怒', en: 'Anger', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    art: 'fist', dmg: 6, upDmg: 8,
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害。将此牌的一个复制加入你的弃牌堆。`,
    use: async (x) => {
      await A.attack(x.target, V(x.card, 'dmg'));
      A.addCard('discard', 'anger', { upgraded: x.card.upgraded });
    }
  },
  body_slam: {
    name: '肉搏', en: 'Body Slam', type: 'attack', rarity: 'common', cost: 1, upCost: 0, target: 'enemy',
    art: 'wall', dmg: 0, dynDmg: () => CB.player.block,
    desc: (c, F) => `造成等同于你当前[格挡]值的伤害（${F.d(CB ? CB.player.block : 0)}）。`,
    use: async (x) => { await A.attack(x.target, CB.player.block); }
  },
  clash: {
    name: '冲撞', en: 'Clash', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    art: 'swordCross', dmg: 14, upDmg: 18,
    desc: (c, F) => `只有手牌全部为攻击牌时才能打出。造成 ${F.d(V(c, 'dmg'))} 点伤害。`,
    canPlay: () => CB.hand.every(c => CARDS[c.id].type === 'attack'),
    use: async (x) => { await A.attack(x.target, V(x.card, 'dmg')); }
  },
  cleave: {
    name: '顺劈斩', en: 'Cleave', type: 'attack', rarity: 'common', cost: 1, target: 'all',
    art: 'fan', dmg: 8, upDmg: 11,
    desc: (c, F) => `对所有敌人造成 ${F.d(V(c, 'dmg'))} 点伤害。`,
    use: async (x) => { await A.attackAll(V(x.card, 'dmg')); }
  },
  clothesline: {
    name: '铁拳', en: 'Clothesline', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    art: 'fist', dmg: 12, upDmg: 14, mag: 2, upMag: 3,
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害，给予 ${F.n(V(c, 'mag'))} 层[虚弱]。`,
    use: async (x) => {
      await A.attack(x.target, V(x.card, 'dmg'));
      A.power(x.target, 'weak', V(x.card, 'mag'));
    }
  },
  headbutt: {
    name: '头槌', en: 'Headbutt', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    art: 'skull', dmg: 9, upDmg: 12,
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害。将你弃牌堆中的一张牌置于抽牌堆顶部。`,
    use: async (x) => {
      await A.attack(x.target, V(x.card, 'dmg'));
      if (CB.discardPile.length) {
        const sel = await A.chooseCards({
          cards: CB.discardPile.slice(), count: 1, prompt: '选择一张牌置于抽牌堆顶部', canCancel: false
        });
        if (sel[0]) {
          const i = CB.discardPile.indexOf(sel[0]);
          if (i >= 0) CB.discardPile.splice(i, 1);
          CB.drawPile.push(sel[0]);
        }
      }
    }
  },
  heavy_blade: {
    name: '重刃', en: 'Heavy Blade', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    art: 'sword', dmg: 14, mag: 3, upMag: 5, strMult: 3, upStrMult: 5,
    desc: (c, F) => `造成 ${F.d(14)} 点伤害。[力量]的效果提升至 ${F.n(V(c, 'mag'))} 倍。`,
    use: async (x) => { await A.attack(x.target, 14, { strMult: V(x.card, 'strMult') }); }
  },
  iron_wave: {
    name: '铁斩波', en: 'Iron Wave', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    art: 'wind', dmg: 5, upDmg: 7, block: 5, upBlock: 7,
    desc: (c, F) => `获得 ${F.b(V(c, 'block'))} 点格挡。造成 ${F.d(V(c, 'dmg'))} 点伤害。`,
    use: async (x) => {
      A.block(V(x.card, 'block'));
      await A.attack(x.target, V(x.card, 'dmg'));
    }
  },
  perfected_strike: {
    name: '完美打击', en: 'Perfected Strike', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    art: 'slash', dmg: 6, mag: 2, upMag: 3, tags: ['strike'],
    desc: (c, F) => {
      const n = countStrikes();
      return `造成 ${F.d(6 + n * V(c, 'mag'))} 点伤害。你每有一张带有「打击」的牌，便额外造成 ${F.n(V(c, 'mag'))} 点伤害。`;
    },
    dynDmg: (c) => 6 + countStrikes() * V(c, 'mag'),
    use: async (x) => { await A.attack(x.target, 6 + countStrikes() * V(x.card, 'mag')); }
  },
  pommel_strike: {
    name: '剑柄敲击', en: 'Pommel Strike', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    art: 'sword', dmg: 9, upDmg: 10, mag: 1, upMag: 2, tags: ['strike'],
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害。抽 ${F.n(V(c, 'mag'))} 张牌。`,
    use: async (x) => {
      await A.attack(x.target, V(x.card, 'dmg'));
      await A.draw(V(x.card, 'mag'));
    }
  },
  sword_boomerang: {
    name: '回旋剑', en: 'Sword Boomerang', type: 'attack', rarity: 'common', cost: 1, target: 'random',
    art: 'boomerang', dmg: 3, mag: 3, upMag: 4, hits: 3, upHits: 4,
    desc: (c, F) => `对随机敌人造成 ${F.d(3)} 点伤害 ${F.n(V(c, 'mag'))} 次。`,
    use: async (x) => {
      for (let i = 0; i < V(x.card, 'mag'); i++) {
        if (!A.aliveEnemies().length) break;
        await A.attackRandom(3);
      }
    }
  },
  thunderclap: {
    name: '雷霆一击', en: 'Thunderclap', type: 'attack', rarity: 'common', cost: 1, target: 'all',
    art: 'lightning', dmg: 4, upDmg: 7, mag: 1,
    desc: (c, F) => `对所有敌人造成 ${F.d(V(c, 'dmg'))} 点伤害并给予 ${F.n(1)} 层[易伤]。`,
    use: async (x) => {
      await A.attackAll(V(x.card, 'dmg'));
      A.aliveEnemies().forEach(e => A.power(e, 'vulnerable', 1));
    }
  },
  twin_strike: {
    name: '双重打击', en: 'Twin Strike', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    art: 'doubleSlash', dmg: 5, upDmg: 7, hits: 2, tags: ['strike'],
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害两次。`,
    use: async (x) => {
      await A.attack(x.target, V(x.card, 'dmg'));
      await A.attack(x.target, V(x.card, 'dmg'));
    }
  },
  wild_strike: {
    name: '狂野打击', en: 'Wild Strike', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    art: 'slash', dmg: 12, upDmg: 17, tags: ['strike'],
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害。将一张[伤口]洗入你的抽牌堆。`,
    use: async (x) => {
      await A.attack(x.target, V(x.card, 'dmg'));
      A.addCard('draw', 'wound');
    }
  },

  /* ======================= 普通 · 技能 ======================= */
  armaments: {
    name: '军备', en: 'Armaments', type: 'skill', rarity: 'common', cost: 1, target: 'self',
    art: 'hammer', block: 5,
    desc: (c, F) => c.upgraded
      ? `获得 ${F.b(5)} 点格挡。[升级]你手中的所有牌。`
      : `获得 ${F.b(5)} 点格挡。[升级]你手中的一张牌。`,
    use: async (x) => {
      A.block(5);
      const cands = CB.hand.filter(c => c !== x.card && canUpgradeCard(c));
      if (!cands.length) return;
      if (x.card.upgraded) { cands.forEach(c => upgradeCardInstance(c)); return; }
      const sel = await A.chooseCards({ cards: cands, count: 1, prompt: '选择一张牌升级', canCancel: false });
      if (sel[0]) upgradeCardInstance(sel[0]);
    }
  },
  flex: {
    name: '屈肌', en: 'Flex', type: 'skill', rarity: 'common', cost: 0, target: 'self',
    art: 'muscle', mag: 2, upMag: 4,
    desc: (c, F) => `获得 ${F.n(V(c, 'mag'))} 点[力量]。在本回合结束时失去 ${F.n(V(c, 'mag'))} 点[力量]。`,
    use: async (x) => {
      A.buffSelf('strength', V(x.card, 'mag'));
      A.buffSelf('strengthDown', V(x.card, 'mag'));
    }
  },
  havoc: {
    name: '浩劫', en: 'Havoc', type: 'skill', rarity: 'common', cost: 1, upCost: 0, target: 'self',
    art: 'flame',
    desc: () => `打出你抽牌堆顶部的一张牌，并将其[消耗]。`,
    use: async () => { await A.playTopOfDraw(); }
  },
  shrug_it_off: {
    name: '摆脱', en: 'Shrug It Off', type: 'skill', rarity: 'common', cost: 1, target: 'self',
    art: 'shieldGlow', block: 8, upBlock: 11,
    desc: (c, F) => `获得 ${F.b(V(c, 'block'))} 点格挡。抽 ${F.n(1)} 张牌。`,
    use: async (x) => { A.block(V(x.card, 'block')); await A.draw(1); }
  },
  true_grit: {
    name: '坚毅', en: 'True Grit', type: 'skill', rarity: 'common', cost: 1, target: 'self',
    art: 'shield', block: 7, upBlock: 9,
    desc: (c, F) => c.upgraded
      ? `获得 ${F.b(9)} 点格挡。[消耗]你手中的一张牌。`
      : `获得 ${F.b(7)} 点格挡。[消耗]你手中的一张随机牌。`,
    use: async (x) => {
      A.block(V(x.card, 'block'));
      const cands = CB.hand.filter(c => c !== x.card);
      if (!cands.length) return;
      if (x.card.upgraded) {
        const sel = await A.chooseCards({ cards: cands, count: 1, prompt: '选择一张牌消耗', canCancel: false });
        if (sel[0]) A.exhaust(sel[0]);
      } else A.exhaust(pick(cands));
    }
  },
  warcry: {
    name: '战吼', en: 'Warcry', type: 'skill', rarity: 'common', cost: 0, target: 'self',
    art: 'wind', mag: 1, upMag: 2, exhaust: true,
    desc: (c, F) => `抽 ${F.n(V(c, 'mag'))} 张牌。将你手中的一张牌置于抽牌堆顶部。[消耗]。`,
    use: async (x) => {
      await A.draw(V(x.card, 'mag'));
      const cands = CB.hand.filter(c => c !== x.card);
      if (!cands.length) return;
      const sel = await A.chooseCards({ cards: cands, count: 1, prompt: '选择一张牌置于抽牌堆顶部', canCancel: false });
      if (sel[0]) {
        const i = CB.hand.indexOf(sel[0]);
        if (i >= 0) CB.hand.splice(i, 1);
        CB.drawPile.push(sel[0]);
      }
    }
  },

  /* ======================= 罕见 · 攻击 ======================= */
  blood_for_blood: {
    name: '以血还血', en: 'Blood for Blood', type: 'attack', rarity: 'uncommon', cost: 4, upCost: 3, target: 'enemy',
    art: 'blood', dmg: 18, upDmg: 22,
    desc: (c, F) => `每当你在本场战斗中失去生命，此牌的费用便降低 {1} 点。造成 ${F.d(V(c, 'dmg'))} 点伤害。`,
    dynCost: (c) => Math.max(0, (c.upgraded ? 3 : 4) - (CB ? CB.hpLostTimes : 0)),
    use: async (x) => { await A.attack(x.target, V(x.card, 'dmg')); }
  },
  carnage: {
    name: '大屠杀', en: 'Carnage', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    art: 'blood', dmg: 20, upDmg: 28, ethereal: true,
    desc: (c, F) => `[虚无]。造成 ${F.d(V(c, 'dmg'))} 点伤害。`,
    use: async (x) => { await A.attack(x.target, V(x.card, 'dmg')); }
  },
  dropkick: {
    name: '飞踢', en: 'Dropkick', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    art: 'fist', dmg: 5, upDmg: 8,
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害。若目标拥有[易伤]，获得 {1} 点能量并抽 {1} 张牌。`,
    use: async (x) => {
      const vul = x.target.powers.vulnerable > 0;
      await A.attack(x.target, V(x.card, 'dmg'));
      if (vul) { A.gainEnergy(1); await A.draw(1); }
    }
  },
  hemokinesis: {
    name: '血液动力', en: 'Hemokinesis', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    art: 'blood', dmg: 15, upDmg: 20, mag: 2,
    desc: (c, F) => `失去 {2} 点生命。造成 ${F.d(V(c, 'dmg'))} 点伤害。`,
    use: async (x) => {
      A.loseHp(2, true);
      await A.attack(x.target, V(x.card, 'dmg'));
    }
  },
  pummel: {
    name: '猛击', en: 'Pummel', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    art: 'fist', dmg: 2, mag: 4, upMag: 5, exhaust: true, hits: 4, upHits: 5,
    desc: (c, F) => `造成 ${F.d(2)} 点伤害 ${F.n(V(c, 'mag'))} 次。[消耗]。`,
    use: async (x) => {
      for (let i = 0; i < V(x.card, 'mag'); i++) {
        if (x.target.hp <= 0) break;
        await A.attack(x.target, 2, { quick: true });
      }
    }
  },
  rampage: {
    name: '横冲直撞', en: 'Rampage', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    art: 'slash', dmg: 8, mag: 5, upMag: 8,
    desc: (c, F) => `造成 ${F.d(8 + (c.extraDmg || 0))} 点伤害。本场战斗中，此牌的伤害永久增加 ${F.n(V(c, 'mag'))} 点。`,
    dynDmg: (c) => 8 + (c.extraDmg || 0),
    use: async (x) => {
      await A.attack(x.target, 8 + (x.card.extraDmg || 0));
      x.card.extraDmg = (x.card.extraDmg || 0) + V(x.card, 'mag');
    }
  },
  reckless_charge: {
    name: '鲁莽冲锋', en: 'Reckless Charge', type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy',
    art: 'slash', dmg: 7, upDmg: 10,
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害。将一张[眩晕]洗入你的抽牌堆。`,
    use: async (x) => {
      await A.attack(x.target, V(x.card, 'dmg'));
      A.addCard('draw', 'dazed');
    }
  },
  searing_blow: {
    name: '灼热打击', en: 'Searing Blow', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    art: 'flame', dmg: 12, multiUpgrade: true,
    desc: (c, F) => `造成 ${F.d(searingDmg(c))} 点伤害。可以被无限次[升级]。`,
    dynDmg: (c) => searingDmg(c),
    use: async (x) => { await A.attack(x.target, searingDmg(x.card)); }
  },
  sever_soul: {
    name: '断魂', en: 'Sever Soul', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    art: 'skull', dmg: 16, upDmg: 22,
    desc: (c, F) => `[消耗]你手中所有非攻击牌。造成 ${F.d(V(c, 'dmg'))} 点伤害。`,
    use: async (x) => {
      CB.hand.filter(c => c !== x.card && CARDS[c.id].type !== 'attack').forEach(c => A.exhaust(c));
      await A.attack(x.target, V(x.card, 'dmg'));
    }
  },
  uppercut: {
    name: '上勾拳', en: 'Uppercut', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    art: 'fist', dmg: 13, mag: 1, upMag: 2,
    desc: (c, F) => `造成 ${F.d(13)} 点伤害。给予 ${F.n(V(c, 'mag'))} 层[虚弱]和 ${F.n(V(c, 'mag'))} 层[易伤]。`,
    use: async (x) => {
      await A.attack(x.target, 13);
      A.power(x.target, 'weak', V(x.card, 'mag'));
      A.power(x.target, 'vulnerable', V(x.card, 'mag'));
    }
  },
  whirlwind: {
    name: '旋风斩', en: 'Whirlwind', type: 'attack', rarity: 'uncommon', cost: -1, target: 'all',
    art: 'wind', dmg: 5, upDmg: 8, xCost: true,
    desc: (c, F) => `消耗所有能量。对所有敌人造成 ${F.d(V(c, 'dmg'))} 点伤害 X 次。`,
    use: async (x) => {
      const n = x.xValue || 0;
      for (let i = 0; i < n; i++) {
        if (!A.aliveEnemies().length) break;
        await A.attackAll(V(x.card, 'dmg'), { quick: i > 0 });
      }
    }
  },

  /* ======================= 罕见 · 技能 ======================= */
  battle_trance: {
    name: '战斗恍惚', en: 'Battle Trance', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    art: 'eye', mag: 3, upMag: 4,
    desc: (c, F) => `抽 ${F.n(V(c, 'mag'))} 张牌。本回合你不能再抽牌。`,
    use: async (x) => { await A.draw(V(x.card, 'mag')); A.buffSelf('noDraw', 1); }
  },
  bloodletting: {
    name: '放血', en: 'Bloodletting', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    art: 'blood', mag: 2, upMag: 3,
    desc: (c, F) => `失去 {3} 点生命。获得 ${F.n(V(c, 'mag'))} 点[能量]。`,
    use: async (x) => { A.loseHp(3, true); A.gainEnergy(V(x.card, 'mag')); }
  },
  burning_pact: {
    name: '燃烧契约', en: 'Burning Pact', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'flame', mag: 2, upMag: 3,
    desc: (c, F) => `[消耗]你手中的一张牌。抽 ${F.n(V(c, 'mag'))} 张牌。`,
    use: async (x) => {
      const cands = CB.hand.filter(c => c !== x.card);
      if (cands.length) {
        const sel = await A.chooseCards({ cards: cands, count: 1, prompt: '选择一张牌消耗', canCancel: false });
        if (sel[0]) A.exhaust(sel[0]);
      }
      await A.draw(V(x.card, 'mag'));
    }
  },
  disarm: {
    name: '卸甲', en: 'Disarm', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
    art: 'chain', mag: 2, upMag: 3, exhaust: true,
    desc: (c, F) => `使敌人失去 ${F.n(V(c, 'mag'))} 点[力量]。[消耗]。`,
    use: async (x) => { A.power(x.target, 'strength', -V(x.card, 'mag')); }
  },
  dual_wield: {
    name: '双持', en: 'Dual Wield', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'swordCross', mag: 1, upMag: 2,
    desc: (c, F) => `选择一张攻击牌或能力牌。将 ${F.n(V(c, 'mag'))} 张其复制加入你的手牌。`,
    use: async (x) => {
      const cands = CB.hand.filter(c => c !== x.card && ['attack', 'power'].includes(CARDS[c.id].type));
      if (!cands.length) return;
      const sel = await A.chooseCards({ cards: cands, count: 1, prompt: '选择一张攻击牌或能力牌复制', canCancel: false });
      if (sel[0]) for (let i = 0; i < V(x.card, 'mag'); i++) A.addCard('hand', sel[0].id, { upgraded: sel[0].upgraded });
    }
  },
  entrench: {
    name: '巩固', en: 'Entrench', type: 'skill', rarity: 'uncommon', cost: 2, upCost: 1, target: 'self',
    art: 'wall',
    desc: () => `使你的[格挡]值翻倍。`,
    use: async () => { A.block(CB.player.block, { raw: true }); }
  },
  flame_barrier: {
    name: '烈焰屏障', en: 'Flame Barrier', type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    art: 'flameRing', block: 12, upBlock: 16, mag: 4, upMag: 6,
    desc: (c, F) => `获得 ${F.b(V(c, 'block'))} 点格挡。本回合内，受到攻击时对攻击者造成 ${F.n(V(c, 'mag'))} 点伤害。`,
    use: async (x) => { A.block(V(x.card, 'block')); A.buffSelf('flameBarrier', V(x.card, 'mag')); }
  },
  ghostly_armor: {
    name: '幽灵护甲', en: 'Ghostly Armor', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'shieldGlow', block: 10, upBlock: 13, ethereal: true,
    desc: (c, F) => `[虚无]。获得 ${F.b(V(c, 'block'))} 点格挡。`,
    use: async (x) => { A.block(V(x.card, 'block')); }
  },
  infernal_blade: {
    name: '地狱之刃', en: 'Infernal Blade', type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, target: 'self',
    art: 'flame', exhaust: true,
    desc: () => `将一张随机攻击牌加入你的手牌，其本回合费用为 {0}。[消耗]。`,
    use: async () => {
      const pool = Object.keys(CARDS).filter(k => CARDS[k].type === 'attack' && CARDS[k].rarity && !CARDS[k].noPool);
      const id = pick(pool);
      A.addCard('hand', id, { freeThisTurn: true });
    }
  },
  intimidate: {
    name: '恐吓', en: 'Intimidate', type: 'skill', rarity: 'uncommon', cost: 0, target: 'all',
    art: 'skull', mag: 1, upMag: 2, exhaust: true,
    desc: (c, F) => `给予所有敌人 ${F.n(V(c, 'mag'))} 层[虚弱]。[消耗]。`,
    use: async (x) => { A.aliveEnemies().forEach(e => A.power(e, 'weak', V(x.card, 'mag'))); }
  },
  power_through: {
    name: '强渡', en: 'Power Through', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'shield', block: 15, upBlock: 20,
    desc: (c, F) => `将 {2} 张[伤口]加入你的手牌。获得 ${F.b(V(c, 'block'))} 点格挡。`,
    use: async (x) => {
      A.addCard('hand', 'wound'); A.addCard('hand', 'wound');
      A.block(V(x.card, 'block'));
    }
  },
  rage_card: {
    name: '暴怒', en: 'Rage', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    art: 'muscle', mag: 3, upMag: 5,
    desc: (c, F) => `本回合内，每当你打出一张攻击牌，获得 ${F.n(V(c, 'mag'))} 点格挡。`,
    use: async (x) => { A.buffSelf('rage', V(x.card, 'mag')); }
  },
  second_wind: {
    name: '振作', en: 'Second Wind', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'shieldGlow', mag: 5, upMag: 7,
    desc: (c, F) => `[消耗]你手中所有非攻击牌，每消耗一张便获得 ${F.n(V(c, 'mag'))} 点格挡。`,
    use: async (x) => {
      const cs = CB.hand.filter(c => c !== x.card && CARDS[c.id].type !== 'attack');
      cs.forEach(c => { A.exhaust(c); A.block(V(x.card, 'mag')); });
    }
  },
  seeing_red: {
    name: '见红', en: 'Seeing Red', type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, target: 'self',
    art: 'blood', exhaust: true,
    desc: () => `获得 {2} 点[能量]。[消耗]。`,
    use: async () => { A.gainEnergy(2); }
  },
  sentinel: {
    name: '哨兵', en: 'Sentinel', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'shield', block: 5, upBlock: 8, mag: 2, upMag: 3,
    desc: (c, F) => `获得 ${F.b(V(c, 'block'))} 点格挡。若此牌被[消耗]，获得 ${F.n(V(c, 'mag'))} 点[能量]。`,
    onExhaust: (c) => { A.gainEnergy(V(c, 'mag')); },
    use: async (x) => { A.block(V(x.card, 'block')); }
  },
  shockwave: {
    name: '震荡波', en: 'Shockwave', type: 'skill', rarity: 'uncommon', cost: 2, target: 'all',
    art: 'wind', mag: 3, upMag: 5, exhaust: true,
    desc: (c, F) => `给予所有敌人 ${F.n(V(c, 'mag'))} 层[虚弱]和 ${F.n(V(c, 'mag'))} 层[易伤]。[消耗]。`,
    use: async (x) => {
      A.aliveEnemies().forEach(e => {
        A.power(e, 'weak', V(x.card, 'mag'));
        A.power(e, 'vulnerable', V(x.card, 'mag'));
      });
    }
  },
  spot_weakness: {
    name: '找准弱点', en: 'Spot Weakness', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
    art: 'eye', mag: 3, upMag: 4,
    desc: (c, F) => `若敌人意图攻击，获得 ${F.n(V(c, 'mag'))} 点[力量]。`,
    use: async (x) => {
      if (x.target && x.target.move && String(x.target.move.intent).startsWith('attack'))
        A.buffSelf('strength', V(x.card, 'mag'));
    }
  },

  /* ======================= 罕见 · 能力 ======================= */
  combust: {
    name: '自燃', en: 'Combust', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'flame', mag: 5, upMag: 7,
    desc: (c, F) => `每回合结束时，失去 {1} 点生命，并对所有敌人造成 ${F.n(V(c, 'mag'))} 点伤害。`,
    use: async (x) => { A.buffSelf('combust', V(x.card, 'mag')); }
  },
  dark_embrace: {
    name: '黑暗拥抱', en: 'Dark Embrace', type: 'power', rarity: 'uncommon', cost: 2, upCost: 1, target: 'self',
    art: 'demon',
    desc: () => `每当一张卡牌被[消耗]时，抽 {1} 张牌。`,
    use: async () => { A.buffSelf('darkEmbrace', 1); }
  },
  evolve: {
    name: '进化', en: 'Evolve', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'gear', mag: 1, upMag: 2,
    desc: (c, F) => `每当你抽到一张状态牌时，抽 ${F.n(V(c, 'mag'))} 张牌。`,
    use: async (x) => { A.buffSelf('evolve', V(x.card, 'mag')); }
  },
  feel_no_pain: {
    name: '无痛', en: 'Feel No Pain', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'shieldGlow', mag: 3, upMag: 4,
    desc: (c, F) => `每当一张卡牌被[消耗]时，获得 ${F.n(V(c, 'mag'))} 点格挡。`,
    use: async (x) => { A.buffSelf('feelNoPain', V(x.card, 'mag')); }
  },
  fire_breathing: {
    name: '吐火', en: 'Fire Breathing', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'flame', mag: 6, upMag: 10,
    desc: (c, F) => `每当你抽到一张状态牌或诅咒牌时，对所有敌人造成 ${F.n(V(c, 'mag'))} 点伤害。`,
    use: async (x) => { A.buffSelf('fireBreathing', V(x.card, 'mag')); }
  },
  inflame: {
    name: '燃烧', en: 'Inflame', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'flame', mag: 2, upMag: 3,
    desc: (c, F) => `获得 ${F.n(V(c, 'mag'))} 点[力量]。`,
    use: async (x) => { A.buffSelf('strength', V(x.card, 'mag')); }
  },
  metallicize: {
    name: '金属化', en: 'Metallicize', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'wall', mag: 3, upMag: 4,
    desc: (c, F) => `每回合结束时获得 ${F.n(V(c, 'mag'))} 点格挡。`,
    use: async (x) => { A.buffSelf('metallicize', V(x.card, 'mag')); }
  },
  rupture: {
    name: '破裂', en: 'Rupture', type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    art: 'heart', mag: 1, upMag: 2,
    desc: (c, F) => `每当你因卡牌失去生命时，获得 ${F.n(V(c, 'mag'))} 点[力量]。`,
    use: async (x) => { A.buffSelf('rupture', V(x.card, 'mag')); }
  },

  /* ======================= 稀有 · 攻击 ======================= */
  bludgeon: {
    name: '重击', en: 'Bludgeon', type: 'attack', rarity: 'rare', cost: 3, target: 'enemy',
    art: 'hammer', dmg: 32, upDmg: 42,
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害。`,
    use: async (x) => { await A.attack(x.target, V(x.card, 'dmg')); }
  },
  feed: {
    name: '进食', en: 'Feed', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    art: 'blood', dmg: 10, upDmg: 12, mag: 3, upMag: 4, exhaust: true,
    desc: (c, F) => `造成 ${F.d(V(c, 'dmg'))} 点伤害。若此牌杀死敌人，永久提升 ${F.n(V(c, 'mag'))} 点最大生命。[消耗]。`,
    use: async (x) => {
      const hpBefore = x.target.hp;
      await A.attack(x.target, V(x.card, 'dmg'));
      if (hpBefore > 0 && x.target.hp <= 0 && !x.target.hasSplit) {
        const n = V(x.card, 'mag');
        S.maxHp += n; S.hp += n;
        CB.player.maxHp = S.maxHp; CB.player.hp = S.hp;
        renderCombat();
        toast('最大生命 +' + n);
      }
    }
  },
  fiend_fire: {
    name: '魔鬼之火', en: 'Fiend Fire', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    art: 'flameRing', dmg: 7, upDmg: 10, exhaust: true,
    desc: (c, F) => `[消耗]你手中所有牌。每消耗一张便造成 ${F.d(V(c, 'dmg'))} 点伤害。`,
    use: async (x) => {
      const cs = CB.hand.filter(c => c !== x.card);
      cs.forEach(c => A.exhaust(c));
      for (let i = 0; i < cs.length; i++) {
        if (x.target.hp <= 0) break;
        await A.attack(x.target, V(x.card, 'dmg'), { quick: i > 0 });
      }
    }
  },
  immolate: {
    name: '焚烧', en: 'Immolate', type: 'attack', rarity: 'rare', cost: 2, target: 'all',
    art: 'flameRing', dmg: 21, upDmg: 28,
    desc: (c, F) => `对所有敌人造成 ${F.d(V(c, 'dmg'))} 点伤害。将一张[燃烧]加入你的弃牌堆。`,
    use: async (x) => { await A.attackAll(V(x.card, 'dmg')); A.addCard('discard', 'burn'); }
  },
  reaper: {
    name: '收割', en: 'Reaper', type: 'attack', rarity: 'rare', cost: 2, target: 'all',
    art: 'skull', dmg: 4, upDmg: 5, exhaust: true,
    desc: (c, F) => `对所有敌人造成 ${F.d(V(c, 'dmg'))} 点伤害。回复未被格挡伤害等量的生命。[消耗]。`,
    use: async (x) => {
      const dealt = await A.attackAll(V(x.card, 'dmg'));
      if (dealt > 0) A.heal(dealt);
    }
  },

  /* ======================= 稀有 · 技能 ======================= */
  double_tap: {
    name: '双重叩击', en: 'Double Tap', type: 'skill', rarity: 'rare', cost: 1, target: 'self',
    art: 'star', mag: 1, upMag: 2,
    desc: (c, F) => `本回合内，接下来的 ${F.n(V(c, 'mag'))} 张攻击牌打出两次。`,
    use: async (x) => { A.buffSelf('doubleTap', V(x.card, 'mag')); }
  },
  exhume: {
    name: '挖掘', en: 'Exhume', type: 'skill', rarity: 'rare', cost: 1, upCost: 0, target: 'self',
    art: 'scroll', exhaust: true,
    desc: () => `将你消耗堆中的一张牌加入手牌。[消耗]。`,
    use: async (x) => {
      const cands = CB.exhaustPile.filter(c => c !== x.card);
      if (!cands.length) return;
      const sel = await A.chooseCards({ cards: cands, count: 1, prompt: '从消耗堆中选择一张牌', canCancel: false });
      if (sel[0]) {
        const i = CB.exhaustPile.indexOf(sel[0]);
        if (i >= 0) CB.exhaustPile.splice(i, 1);
        CB.hand.push(sel[0]);
      }
    }
  },
  impervious: {
    name: '铜墙铁壁', en: 'Impervious', type: 'skill', rarity: 'rare', cost: 2, target: 'self',
    art: 'wall', block: 30, upBlock: 40, exhaust: true,
    desc: (c, F) => `获得 ${F.b(V(c, 'block'))} 点格挡。[消耗]。`,
    use: async (x) => { A.block(V(x.card, 'block')); }
  },
  limit_break: {
    name: '突破极限', en: 'Limit Break', type: 'skill', rarity: 'rare', cost: 1, target: 'self',
    art: 'muscle', exhaust: true, upExhaust: false,
    desc: (c) => c.upgraded ? `使你的[力量]翻倍。` : `使你的[力量]翻倍。[消耗]。`,
    use: async () => { A.buffSelf('strength', CB.player.powers.strength || 0); }
  },
  offering: {
    name: '献祭', en: 'Offering', type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    art: 'blood', mag: 3, upMag: 5, exhaust: true,
    desc: (c, F) => `失去 {6} 点生命。获得 {2} 点[能量]。抽 ${F.n(V(c, 'mag'))} 张牌。[消耗]。`,
    use: async (x) => { A.loseHp(6, true); A.gainEnergy(2); await A.draw(V(x.card, 'mag')); }
  },

  /* ======================= 稀有 · 能力 ======================= */
  barricade: {
    name: '壁垒', en: 'Barricade', type: 'power', rarity: 'rare', cost: 3, upCost: 2, target: 'self',
    art: 'wall',
    desc: () => `回合开始时[格挡]不再消失。`,
    use: async () => { A.buffSelf('barricade', 1); }
  },
  berserk: {
    name: '狂战士', en: 'Berserk', type: 'power', rarity: 'rare', cost: 0, target: 'self',
    art: 'demon', mag: 2, upMag: 1,
    desc: (c, F) => `获得 ${F.n(V(c, 'mag'))} 层[易伤]。每回合开始时获得 {1} 点[能量]。`,
    use: async (x) => { A.power(CB.player, 'vulnerable', V(x.card, 'mag')); A.buffSelf('berserk', 1); }
  },
  brutality: {
    name: '残暴', en: 'Brutality', type: 'power', rarity: 'rare', cost: 0, target: 'self',
    art: 'blood',
    desc: (c) => (c.upgraded ? `[固有]。` : '') + `每回合开始时失去 {1} 点生命并抽 {1} 张牌。`,
    innateIfUpgraded: true,
    use: async () => { A.buffSelf('brutality', 1); }
  },
  corruption: {
    name: '腐化', en: 'Corruption', type: 'power', rarity: 'rare', cost: 3, upCost: 2, target: 'self',
    art: 'demon',
    desc: () => `技能牌的费用变为 {0}，但打出后会被[消耗]。`,
    use: async () => { A.buffSelf('corruption', 1); }
  },
  demon_form: {
    name: '恶魔形态', en: 'Demon Form', type: 'power', rarity: 'rare', cost: 3, target: 'self',
    art: 'demon', mag: 2, upMag: 3,
    desc: (c, F) => `每回合开始时获得 ${F.n(V(c, 'mag'))} 点[力量]。`,
    use: async (x) => { A.buffSelf('demonForm', V(x.card, 'mag')); }
  },
  juggernaut: {
    name: '主宰', en: 'Juggernaut', type: 'power', rarity: 'rare', cost: 2, target: 'self',
    art: 'hammer', mag: 5, upMag: 7,
    desc: (c, F) => `每当你获得格挡时，对随机敌人造成 ${F.n(V(c, 'mag'))} 点伤害。`,
    use: async (x) => { A.buffSelf('juggernaut', V(x.card, 'mag')); }
  },

  /* ======================= 状态牌 ======================= */
  wound: {
    name: '伤口', en: 'Wound', type: 'status', rarity: 'special', cost: -2, target: 'none',
    art: 'blood', unplayable: true, noPool: true,
    desc: () => `无法打出。`
  },
  dazed: {
    name: '眩晕', en: 'Dazed', type: 'status', rarity: 'special', cost: -2, target: 'none',
    art: 'orb', unplayable: true, ethereal: true, noPool: true,
    desc: () => `[虚无]。无法打出。`
  },
  burn: {
    name: '燃烧', en: 'Burn', type: 'status', rarity: 'special', cost: -2, target: 'none',
    art: 'flame', unplayable: true, noPool: true, mag: 2, upMag: 4,
    desc: (c, F) => `无法打出。回合结束时受到 ${F.n(V(c, 'mag'))} 点伤害。`
  },
  slimed: {
    name: '黏液', en: 'Slimed', type: 'status', rarity: 'special', cost: 1, target: 'self',
    art: 'orb', exhaust: true, noPool: true,
    desc: () => `[消耗]。`,
    use: async () => { }
  },
  void_card: {
    name: '虚空', en: 'Void', type: 'status', rarity: 'special', cost: -2, target: 'none',
    art: 'orb', unplayable: true, ethereal: true, noPool: true,
    desc: () => `[虚无]。无法打出。当此牌被抽到时，失去 {1} 点能量。`
  },

  /* ======================= 诅咒牌 ======================= */
  regret: {
    name: '悔恨', en: 'Regret', type: 'curse', rarity: 'special', cost: -2, target: 'none',
    art: 'skull', unplayable: true, noPool: true,
    desc: () => `无法打出。回合结束时，每有一张手牌便失去 {1} 点生命。`
  },
  injury: {
    name: '受伤', en: 'Injury', type: 'curse', rarity: 'special', cost: -2, target: 'none',
    art: 'blood', unplayable: true, noPool: true,
    desc: () => `无法打出。`
  },
  clumsy: {
    name: '笨拙', en: 'Clumsy', type: 'curse', rarity: 'special', cost: -2, target: 'none',
    art: 'orb', unplayable: true, ethereal: true, noPool: true,
    desc: () => `[虚无]。无法打出。`
  },
  decay: {
    name: '腐朽', en: 'Decay', type: 'curse', rarity: 'special', cost: -2, target: 'none',
    art: 'skull', unplayable: true, noPool: true,
    desc: () => `无法打出。回合结束时受到 {2} 点伤害。`
  },
  pain: {
    name: '痛苦', en: 'Pain', type: 'curse', rarity: 'special', cost: -2, target: 'none',
    art: 'blood', unplayable: true, noPool: true,
    desc: () => `无法打出。当此牌在你手中时，每打出一张其它牌便失去 {1} 点生命。`
  }
};

/* ---------- 卡牌工具 ---------- */
function searingDmg(c) {
  const n = c.upgraded || 0;
  return 12 + n * (n + 7) / 2;
}
function countStrikes() {
  if (!CB) return 0;
  const all = CB.drawPile.concat(CB.hand, CB.discardPile, CB.exhaustPile);
  return all.filter(c => (CARDS[c.id].tags || []).includes('strike')).length;
}
function makeCard(id, upgraded) {
  const d = CARDS[id];
  if (!d) { console.warn('未知卡牌', id); return null; }
  return { uid: uid(), id: id, upgraded: upgraded || 0 };
}
function canUpgradeCard(c) {
  const d = CARDS[c.id];
  if (!d) return false;
  if (d.type === 'status' || d.type === 'curse') return false;
  if (d.multiUpgrade) return true;
  return !c.upgraded;
}
function upgradeCardInstance(c) {
  const d = CARDS[c.id];
  if (!canUpgradeCard(c)) return false;
  c.upgraded = (c.upgraded || 0) + 1;
  if (!d.multiUpgrade) c.upgraded = 1;
  return true;
}
function cardName(c) {
  const d = CARDS[c.id];
  let n = d.name;
  if (c.upgraded) n += d.multiUpgrade && c.upgraded > 1 ? '+' + c.upgraded : '+';
  return n;
}
function cardTypeName(t) {
  return { attack: '攻击', skill: '技能', power: '能力', status: '状态', curse: '诅咒' }[t] || t;
}
function cardRarityName(r) {
  return { basic: '初始', common: '普通', uncommon: '罕见', rare: '稀有', special: '特殊' }[r] || r;
}
/* 卡牌实际费用 */
function cardCost(c) {
  const d = CARDS[c.id];
  if (d.unplayable) return -2;
  if (c.freeThisTurn) return 0;
  if (d.xCost) return -1;
  if (CB && CB.player.powers.corruption && d.type === 'skill') return 0;
  if (d.dynCost) return d.dynCost(c);
  let base = d.cost;
  if (c.upgraded && d.upCost !== undefined) base = d.upCost;
  if (c.costModifier) base = Math.max(0, base + c.costModifier);
  return base;
}
function cardIsExhaust(c) {
  const d = CARDS[c.id];
  if (c.upgraded && d.upExhaust === false) return false;
  if (CB && CB.player.powers.corruption && d.type === 'skill') return true;
  return !!d.exhaust;
}
function cardIsEthereal(c) { return !!CARDS[c.id].ethereal; }
function cardIsInnate(c) {
  const d = CARDS[c.id];
  if (d.innate) return true;
  if (d.innateIfUpgraded && c.upgraded) return true;
  return false;
}

/* 卡池（按稀有度） */
function cardPool(rarity) {
  return Object.keys(CARDS).filter(k => {
    const d = CARDS[k];
    return d.rarity === rarity && !d.noPool;
  });
}
