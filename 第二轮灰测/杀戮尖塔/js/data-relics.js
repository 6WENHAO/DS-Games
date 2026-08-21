/* ============================================================
   data-relics.js —— 遗物
   钩子：atCombatStart / atTurnStart / atTurnEnd / onCardPlay /
        onAttack / onBlockGain / atCombatEnd / onRest / onPickup
   ============================================================ */
'use strict';

const RELICS = {
  /* ---------- 起始遗物 ---------- */
  burning_blood: {
    name: '燃烧之血', en: 'Burning Blood', rarity: 'starter', shape: 'heartR', color: '#c0392b',
    desc: '每场战斗结束时，回复 6 点生命。',
    flavor: '你的血液在燃烧。',
    atCombatEnd: () => { healOutOfCombat(6); }
  },
  black_blood: {
    name: '漆黑之血', en: 'Black Blood', rarity: 'boss', shape: 'heartR', color: '#4a2060',
    desc: '每场战斗结束时，回复 12 点生命。（替代燃烧之血）',
    flavor: '恶魔的血液在你体内奔涌。',
    atCombatEnd: () => { healOutOfCombat(12); }
  },

  /* ---------- 普通 ---------- */
  akabeko: {
    name: '赤备', en: 'Akabeko', rarity: 'common', shape: 'statue', color: '#c0392b',
    desc: '每场战斗中你的第一次攻击额外造成 8 点伤害。',
    flavor: '朴素的木牛，据说能带来武运。',
    atCombatStart: () => { CB.player.powers.vigor = (CB.player.powers.vigor || 0) + 8; }
  },
  anchor: {
    name: '锚', en: 'Anchor', rarity: 'common', shape: 'anchor', color: '#8fa8b4',
    desc: '战斗开始时，获得 10 点格挡。',
    flavor: '沉重、可靠。',
    atCombatStart: () => { A.block(10, { raw: true }); }
  },
  bag_of_marbles: {
    name: '弹珠袋', en: 'Bag of Marbles', rarity: 'common', shape: 'bag', color: '#7a9ac0',
    desc: '战斗开始时，给予所有敌人 1 层易伤。',
    flavor: '一袋来自童年的玻璃弹珠。',
    atCombatStart: () => { CB.enemies.forEach(e => A.power(e, 'vulnerable', 1)); }
  },
  bag_of_preparation: {
    name: '准备之袋', en: 'Bag of Preparation', rarity: 'common', shape: 'bag', color: '#c9a44a',
    desc: '战斗开始时，多抽 2 张牌。',
    flavor: '有备无患。',
    startDraw: 2
  },
  blood_vial: {
    name: '血瓶', en: 'Blood Vial', rarity: 'common', shape: 'flask', color: '#b02a1a',
    desc: '战斗开始时，回复 2 点生命。',
    flavor: '一小瓶温热的血液。',
    atCombatStart: () => { A.heal(2); }
  },
  bronze_scales: {
    name: '青铜鳞片', en: 'Bronze Scales', rarity: 'common', shape: 'gem', color: '#b98a54',
    desc: '战斗开始时，获得 3 层尖刺。',
    flavor: '摸起来像蛇皮。',
    atCombatStart: () => { A.buffSelf('thorns', 3); }
  },
  centennial_puzzle: {
    name: '百年积木', en: 'Centennial Puzzle', rarity: 'common', shape: 'gem', color: '#8a5ac0',
    desc: '每场战斗中第一次受到生命伤害时，抽 3 张牌。',
    flavor: '至今无人解开。',
    onHpLoss: async () => {
      if (CB.relicFlags.centennial) return;
      CB.relicFlags.centennial = true;
      flashRelic('centennial_puzzle');
      await A.draw(3);
    }
  },
  ceramic_fish: {
    name: '陶瓷鱼', en: 'Ceramic Fish', rarity: 'common', shape: 'fish', color: '#e0a040',
    desc: '每当你将一张卡牌加入牌组时，获得 9 金币。',
    flavor: '摇一摇，里面有硬币的声音。',
    onCardAdded: () => { S.gold += 9; flashRelic('ceramic_fish'); toast('金币 +9'); }
  },
  happy_flower: {
    name: '快乐之花', en: 'Happy Flower', rarity: 'common', shape: 'flower', color: '#e0d040',
    desc: '每 3 回合获得 1 点能量。',
    flavor: '它一直在笑。',
    atTurnStart: () => {
      S.counters.happy_flower = (S.counters.happy_flower || 0) + 1;
      if (S.counters.happy_flower >= 3) {
        S.counters.happy_flower = 0;
        A.gainEnergy(1); flashRelic('happy_flower');
      }
    }
  },
  juzu_bracelet: {
    name: '念珠', en: 'Juzu Bracelet', rarity: 'common', shape: 'ring', color: '#8a6438',
    desc: '在未知房间中不再遭遇普通战斗。',
    flavor: '据说能驱散邪祟。'
  },
  lantern: {
    name: '提灯', en: 'Lantern', rarity: 'common', shape: 'lantern', color: '#c9a44a',
    desc: '战斗的第一回合获得 1 点能量。',
    flavor: '照亮前路。',
    atTurnStart: (t) => { if (t === 1) { A.gainEnergy(1); flashRelic('lantern'); } }
  },
  maw_bank: {
    name: '存钱罐', en: 'Maw Bank', rarity: 'common', shape: 'chest', color: '#8a6438',
    desc: '每当你爬升一层，获得 12 金币。在商店消费后失效。',
    flavor: '钱进得去，出不来。',
    onFloor: () => {
      if (S.relicFlags.mawBankDead) return;
      S.gold += 12; flashRelic('maw_bank');
    }
  },
  meat_on_the_bone: {
    name: '带肉的骨头', en: 'Meat on the Bone', rarity: 'common', shape: 'bone', color: '#b02a1a',
    desc: '战斗结束时，若生命值低于 50%，回复 12 点生命。',
    flavor: '有点臭，但很顶饿。',
    atCombatEnd: () => { if (S.hp <= S.maxHp / 2) healOutOfCombat(12); }
  },
  nunchaku: {
    name: '双截棍', en: 'Nunchaku', rarity: 'common', shape: 'nunchaku', color: '#6a4a28',
    desc: '每打出 10 张攻击牌，获得 1 点能量。',
    flavor: '嘿！哈！',
    onCardPlay: (c) => {
      if (CARDS[c.id].type !== 'attack') return;
      S.counters.nunchaku = (S.counters.nunchaku || 0) + 1;
      if (S.counters.nunchaku >= 10) { S.counters.nunchaku = 0; A.gainEnergy(1); flashRelic('nunchaku'); }
    }
  },
  oddly_smooth_stone: {
    name: '奇滑之石', en: 'Oddly Smooth Stone', rarity: 'common', shape: 'stone', color: '#a8b4c0',
    desc: '战斗开始时，获得 1 层敏捷。',
    flavor: '光滑得不像天然之物。',
    atCombatStart: () => { A.buffSelf('dexterity', 1); }
  },
  orichalcum: {
    name: '山铜', en: 'Orichalcum', rarity: 'common', shape: 'stone', color: '#4ac0a0',
    desc: '回合结束时，若你没有格挡，获得 6 点格挡。',
    flavor: '传说中的金属。',
    atTurnEnd: () => { if (CB.player.block <= 0) { A.block(6, { raw: true }); flashRelic('orichalcum'); } }
  },
  pen_nib: {
    name: '笔尖', en: 'Pen Nib', rarity: 'common', shape: 'feather', color: '#e8dcc0',
    desc: '每打出 10 张攻击牌，下一张攻击牌造成双倍伤害。',
    flavor: '笔锋比刀锋更锐利。',
    onCardPlay: (c) => {
      if (CARDS[c.id].type !== 'attack') return;
      if (CB.player.powers.pen_nib_p) return;
      S.counters.pen_nib = (S.counters.pen_nib || 0) + 1;
      if (S.counters.pen_nib >= 10) {
        S.counters.pen_nib = 0;
        CB.player.powers.pen_nib_p = 1; flashRelic('pen_nib');
      }
    }
  },
  potion_belt: {
    name: '药水腰带', en: 'Potion Belt', rarity: 'common', shape: 'bag', color: '#8a5ac0',
    desc: '获得时，药水栏位 +2。',
    flavor: '装备齐全。',
    onPickup: () => { S.potionSlots += 2; S.potions.push(null, null); }
  },
  preserved_insect: {
    name: '干尸虫', en: 'Preserved Insect', rarity: 'common', shape: 'egg', color: '#8ab84a',
    desc: '精英战斗中，敌人的初始生命值降低 25%。',
    flavor: '琥珀中的甲虫。'
  },
  regal_pillow: {
    name: '豪华枕头', en: 'Regal Pillow', rarity: 'common', shape: 'pillow', color: '#8a5ac0',
    desc: '在休息处休息时，额外回复 15 点生命。',
    flavor: '睡个好觉。'
  },
  smiling_mask: {
    name: '微笑面具', en: 'Smiling Mask', rarity: 'common', shape: 'mask', color: '#e0c080',
    desc: '商店的移除卡牌服务固定为 50 金币。',
    flavor: '商人永远在笑。'
  },
  strawberry: {
    name: '草莓', en: 'Strawberry', rarity: 'common', shape: 'heartR', color: '#e0405a',
    desc: '获得时，最大生命 +7。',
    flavor: '新鲜多汁。',
    onPickup: () => { S.maxHp += 7; S.hp += 7; }
  },
  pear: {
    name: '梨', en: 'Pear', rarity: 'common', shape: 'egg', color: '#b8d040',
    desc: '获得时，最大生命 +10。',
    flavor: '一颗完美的梨。',
    onPickup: () => { S.maxHp += 10; S.hp += 10; }
  },
  mango: {
    name: '芒果', en: 'Mango', rarity: 'common', shape: 'egg', color: '#e0a020',
    desc: '获得时，最大生命 +14。',
    flavor: '香甜的芒果。',
    onPickup: () => { S.maxHp += 14; S.hp += 14; }
  },
  tiny_chest: {
    name: '小宝箱', en: 'Tiny Chest', rarity: 'common', shape: 'chest', color: '#a87a48',
    desc: '每 4 个未知房间中必定有 1 个是宝箱。',
    flavor: '装不了太多东西。'
  },
  vajra: {
    name: '金刚杵', en: 'Vajra', rarity: 'common', shape: 'blade', color: '#d4af58',
    desc: '战斗开始时，获得 1 层力量。',
    flavor: '雷电之杵。',
    atCombatStart: () => { A.buffSelf('strength', 1); }
  },
  war_paint: {
    name: '战争涂装', en: 'War Paint', rarity: 'common', shape: 'flask', color: '#c05a34',
    desc: '获得时，升级 2 张随机技能牌。',
    flavor: '让敌人恐惧的颜色。',
    onPickup: () => { upgradeRandomCards('skill', 2); }
  },
  whetstone: {
    name: '磨刀石', en: 'Whetstone', rarity: 'common', shape: 'stone', color: '#8a949e',
    desc: '获得时，升级 2 张随机攻击牌。',
    flavor: '磨快你的剑。',
    onPickup: () => { upgradeRandomCards('attack', 2); }
  },

  /* ---------- 罕见 ---------- */
  blue_candle: {
    name: '蓝烛', en: 'Blue Candle', rarity: 'uncommon', shape: 'lantern', color: '#4a86d0',
    desc: '诅咒牌可以被打出，打出时失去 1 点生命并消耗该牌。',
    flavor: '幽蓝的火焰。'
  },
  dream_catcher: {
    name: '捕梦网', en: 'Dream Catcher', rarity: 'uncommon', shape: 'ring', color: '#8a7ac0',
    desc: '在休息处休息时，获得一次卡牌奖励。',
    flavor: '梦境带来启示。'
  },
  horn_cleat: {
    name: '角形系索栓', en: 'Horn Cleat', rarity: 'uncommon', shape: 'anchor', color: '#8a949e',
    desc: '每场战斗的第 2 回合，获得 14 点格挡。',
    flavor: '牢牢系住。',
    atTurnStart: (t) => { if (t === 2) { A.block(14, { raw: true }); flashRelic('horn_cleat'); } }
  },
  kunai: {
    name: '苦无', en: 'Kunai', rarity: 'uncommon', shape: 'knife', color: '#5a616b',
    desc: '每回合第 3 次打出攻击牌时，获得 1 层敏捷。',
    flavor: '忍者的工具。',
    onCardPlay: (c) => {
      if (CARDS[c.id].type !== 'attack') return;
      CB.counters.kunai = (CB.counters.kunai || 0) + 1;
      if (CB.counters.kunai % 3 === 0) { A.buffSelf('dexterity', 1); flashRelic('kunai'); }
    }
  },
  letter_opener: {
    name: '开信刀', en: 'Letter Opener', rarity: 'uncommon', shape: 'knife', color: '#c9a44a',
    desc: '每回合第 3 次打出技能牌时，对所有敌人造成 5 点伤害。',
    flavor: '拆信也能杀人。',
    onCardPlay: async (c) => {
      if (CARDS[c.id].type !== 'skill') return;
      CB.counters.letter = (CB.counters.letter || 0) + 1;
      if (CB.counters.letter % 3 === 0) { flashRelic('letter_opener'); await A.attackAll(5, { quick: true, noStr: true }); }
    }
  },
  ornamental_fan: {
    name: '装饰扇', en: 'Ornamental Fan', rarity: 'uncommon', shape: 'fan', color: '#c05a70',
    desc: '每回合第 3 次打出攻击牌时，获得 4 点格挡。',
    flavor: '优雅而致命。',
    onCardPlay: (c) => {
      if (CARDS[c.id].type !== 'attack') return;
      CB.counters.fan = (CB.counters.fan || 0) + 1;
      if (CB.counters.fan % 3 === 0) { A.block(4, { raw: true }); flashRelic('ornamental_fan'); }
    }
  },
  paper_phrog: {
    name: '纸蛙', en: 'Paper Phrog', rarity: 'uncommon', shape: 'statue', color: '#4ac06a',
    desc: '易伤使敌人受到的伤害提升至 75%。',
    flavor: '折出来的青蛙。'
  },
  pantograph: {
    name: '缩放尺', en: 'Pantograph', rarity: 'uncommon', shape: 'gear', color: '#c8c0b0',
    desc: 'BOSS 战开始时，回复 25 点生命。',
    flavor: '精密的绘图工具。',
    atCombatStart: () => { if (CB.kind === 'boss') A.heal(25); }
  },
  shuriken: {
    name: '手里剑', en: 'Shuriken', rarity: 'uncommon', shape: 'star', color: '#8fa8b4',
    desc: '每回合第 3 次打出攻击牌时，获得 1 层力量。',
    flavor: '锋利的星。',
    onCardPlay: (c) => {
      if (CARDS[c.id].type !== 'attack') return;
      CB.counters.shuriken = (CB.counters.shuriken || 0) + 1;
      if (CB.counters.shuriken % 3 === 0) { A.buffSelf('strength', 1); flashRelic('shuriken'); }
    }
  },
  sundial: {
    name: '日晷', en: 'Sundial', rarity: 'uncommon', shape: 'dial', color: '#c9a44a',
    desc: '每洗牌 3 次，获得 2 点能量。',
    flavor: '时间的刻度。',
    onShuffle: () => {
      S.counters.sundial = (S.counters.sundial || 0) + 1;
      if (S.counters.sundial >= 3) { S.counters.sundial = 0; A.gainEnergy(2); flashRelic('sundial'); }
    }
  },
  the_courier: {
    name: '信使', en: 'The Courier', rarity: 'uncommon', shape: 'bag', color: '#8a6438',
    desc: '商店的商品会不断补货，且所有价格降低 20%。',
    flavor: '风雨无阻。'
  },

  /* ---------- 稀有 ---------- */
  ice_cream: {
    name: '冰淇淋', en: 'Ice Cream', rarity: 'rare', shape: 'cup', color: '#e8d0b0',
    desc: '能量在回合结束时保留。',
    flavor: '甜品永不过期。'
  },
  bird_faced_urn: {
    name: '鸟面罐', en: 'Bird-Faced Urn', rarity: 'rare', shape: 'statue', color: '#8a7a58',
    desc: '每当你打出一张能力牌，回复 2 点生命。',
    flavor: '罐中似有低语。',
    onCardPlay: (c) => { if (CARDS[c.id].type === 'power') { A.heal(2); flashRelic('bird_faced_urn'); } }
  },
  captains_wheel: {
    name: '船长之轮', en: "Captain's Wheel", rarity: 'rare', shape: 'dial', color: '#8a6438',
    desc: '每场战斗第 3 回合，获得 18 点格挡。',
    flavor: '把稳航向。',
    atTurnStart: (t) => { if (t === 3) { A.block(18, { raw: true }); flashRelic('captains_wheel'); } }
  },
  dead_branch: {
    name: '枯枝', en: 'Dead Branch', rarity: 'rare', shape: 'feather', color: '#8a6438',
    desc: '每当一张卡牌被消耗时，将一张随机卡牌加入你的手牌。',
    flavor: '枯木亦可逢春。',
    onExhaust: () => {
      const pool = cardPool('common').concat(cardPool('uncommon'));
      A.addCard('hand', pick(pool)); flashRelic('dead_branch');
    }
  },
  torii: {
    name: '鸟居', en: 'Torii', rarity: 'rare', shape: 'statue', color: '#c0392b',
    desc: '每当你受到 5 点或更少的攻击伤害时，将其降至 1 点。',
    flavor: '神域之门。'
  },

  /* ---------- BOSS 遗物 ---------- */
  philosophers_stone: {
    name: '贤者之石', en: "Philosopher's Stone", rarity: 'boss', shape: 'stone', color: '#c090ff',
    desc: '获得 1 点额外能量。战斗开始时，所有敌人获得 1 层力量。',
    flavor: '炼金术的终极。',
    energy: 1,
    atCombatStart: () => { CB.enemies.forEach(e => { e.powers.strength = (e.powers.strength || 0) + 1; }); }
  },
  runic_pyramid: {
    name: '符文金字塔', en: 'Runic Pyramid', rarity: 'boss', shape: 'pyramid', color: '#c9a44a',
    desc: '回合结束时，不再弃掉手牌。',
    flavor: '符文闪烁着微光。'
  },
  fusion_hammer: {
    name: '融合锤', en: 'Fusion Hammer', rarity: 'boss', shape: 'hammer', color: '#c05a34',
    desc: '获得 1 点额外能量。无法在休息处打铁。',
    flavor: '锤子本身已被熔铸。',
    energy: 1
  },
  coffee_dripper: {
    name: '咖啡滴滤器', en: 'Coffee Dripper', rarity: 'boss', shape: 'coffee', color: '#6a4a28',
    desc: '获得 1 点额外能量。无法在休息处休息。',
    flavor: '一滴，一滴。',
    energy: 1
  },
  sozu: {
    name: '添水', en: 'Sozu', rarity: 'boss', shape: 'cup', color: '#8fa8b4',
    desc: '获得 1 点额外能量。无法获得药水。',
    flavor: '水满则倾。',
    energy: 1
  },
  mark_of_pain: {
    name: '苦痛印记', en: 'Mark of Pain', rarity: 'boss', shape: 'gem', color: '#c0392b',
    desc: '获得 1 点额外能量。战斗开始时，将 2 张伤口置入你的抽牌堆。',
    flavor: '痛苦带来力量。',
    energy: 1,
    atCombatStart: () => { A.addCard('draw', 'wound'); A.addCard('draw', 'wound'); }
  },
  busted_crown: {
    name: '破损王冠', en: 'Busted Crown', rarity: 'boss', shape: 'crown', color: '#d4af58',
    desc: '获得 1 点额外能量。卡牌奖励减少 2 个选项。',
    flavor: '曾属于某位国王。',
    energy: 1
  }
};

/* 遗物工具 */
function hasRelic(id) { return S && S.relics.indexOf(id) >= 0; }
function relicIconHtml(id) {
  const r = RELICS[id];
  if (!r) return '';
  return SVG.relicIcon(r.shape, r.color);
}
function flashRelic(id) {
  const n = document.querySelector('.relic-slot[data-relic="' + id + '"]');
  if (n) { n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); }
}
function relicPool(rarity) {
  return Object.keys(RELICS).filter(k => RELICS[k].rarity === rarity && !RELICS[k].alias && k !== 'burning_blood' && k !== 'black_blood');
}
/* 触发所有遗物的某个钩子 */
async function relicHook(hook, arg) {
  if (!S) return;
  for (const id of S.relics.slice()) {
    const r = RELICS[id];
    if (r && typeof r[hook] === 'function') {
      try { await r[hook](arg); } catch (e) { console.error('遗物钩子出错', id, hook, e); }
    }
  }
}
function relicEnergyBonus() {
  if (!S) return 0;
  let n = 0;
  S.relics.forEach(id => { const r = RELICS[id]; if (r && r.energy) n += r.energy; });
  return n;
}
function relicStartDraw() {
  let n = 0;
  S.relics.forEach(id => { const r = RELICS[id]; if (r && r.startDraw) n += r.startDraw; });
  return n;
}
