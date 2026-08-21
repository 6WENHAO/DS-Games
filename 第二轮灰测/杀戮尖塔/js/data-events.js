/* ============================================================
   data-events.js —— 未知房间事件
   每个 option：{ label, sub, enabled(), run() }
   run() 结束后若未跳转，调用 Game.finishEvent()
   ============================================================ */
'use strict';

const EVENTS = {
  big_fish: {
    name: '大鱼', art: 'fish',
    body: '你在一条湍急的地下河边停下。三样东西顺流漂来：一根成熟的香蕉、一个诱人的甜甜圈，还有一只被绳子捆着的木箱。',
    options: [
      {
        label: '香蕉', sub: '回复 1/3 最大生命值',
        run: async () => { healOutOfCombat(Math.floor(S.maxHp / 3)); Game.finishEvent(); }
      },
      {
        label: '甜甜圈', sub: '最大生命值 +5',
        run: async () => { S.maxHp += 5; S.hp += 5; toast('最大生命 +5'); Game.finishEvent(); }
      },
      {
        label: '木箱', sub: '获得一个遗物，并获得一张诅咒牌',
        run: async () => {
          gainRandomRelic();
          addCardToDeck(pick(['regret', 'injury', 'clumsy', 'decay', 'pain']));
          Game.finishEvent();
        }
      }
    ]
  },

  the_cleric: {
    name: '牧师', art: 'statue',
    body: '一位身披白袍的旅行牧师从阴影中走出。「愿意的话，我可以为你效劳……当然，需要一点香火钱。」',
    options: [
      {
        label: '治疗（35 金币）', sub: '回复 25% 最大生命值',
        enabled: () => S.gold >= 35,
        run: async () => {
          S.gold -= 35; healOutOfCombat(Math.floor(S.maxHp * 0.25)); Game.finishEvent();
        }
      },
      {
        label: '净化（50 金币）', sub: '移除牌组中的一张卡牌',
        enabled: () => S.gold >= 50 && S.deck.length > 1,
        run: async () => {
          S.gold -= 50;
          const c = await pickCardFromDeck('选择要移除的卡牌');
          if (c) removeCardFromDeck(c);
          Game.finishEvent();
        }
      },
      { label: '离开', sub: '什么也不做', run: async () => { Game.finishEvent(); } }
    ]
  },

  golden_idol: {
    name: '金色偶像', art: 'statue',
    body: '一尊纯金的偶像立在石台上，散发着诱人的光泽。石台上刻着古老的警告文字，但你看不懂。',
    options: [
      {
        label: '拿走偶像', sub: '获得【金色偶像】，但会触发陷阱',
        run: async () => {
          gainRelic('golden_idol');
          const dmg = Math.floor(S.maxHp * 0.25);
          damagePlayerOutOfCombat(dmg);
          toast('巨石滚落！受到 ' + dmg + ' 点伤害');
          Game.finishEvent();
        }
      },
      { label: '离开', sub: '安全离开', run: async () => { Game.finishEvent(); } }
    ]
  },

  living_wall: {
    name: '活墙', art: 'wall',
    body: '走廊尽头的墙壁忽然长出一张巨大的、由砖石构成的面孔。「选一个吧，旅人。」它低声说道。',
    options: [
      {
        label: '遗忘', sub: '移除牌组中的一张卡牌',
        enabled: () => S.deck.length > 1,
        run: async () => {
          const c = await pickCardFromDeck('选择要移除的卡牌');
          if (c) removeCardFromDeck(c);
          Game.finishEvent();
        }
      },
      {
        label: '变化', sub: '将一张卡牌替换为同稀有度的随机卡牌',
        enabled: () => S.deck.length > 1,
        run: async () => {
          const c = await pickCardFromDeck('选择要替换的卡牌');
          if (c) {
            const rarity = CARDS[c.id].rarity === 'basic' ? 'common' : CARDS[c.id].rarity;
            removeCardFromDeck(c);
            const pool = cardPool(rarity === 'special' ? 'common' : rarity);
            addCardToDeck(pick(pool));
          }
          Game.finishEvent();
        }
      },
      {
        label: '成长', sub: '升级牌组中的一张卡牌',
        enabled: () => S.deck.some(canUpgradeCard),
        run: async () => {
          const c = await pickCardFromDeck('选择要升级的卡牌', canUpgradeCard);
          if (c) { upgradeCardInstance(c); toast(cardName(c) + ' 已升级'); }
          Game.finishEvent();
        }
      }
    ]
  },

  scrap_ooze: {
    name: '废料软泥', art: 'orb',
    body: '一团半透明的软泥缓慢蠕动着，里面隐约有金属的闪光——似乎有什么值钱的东西被它吞了。',
    options: [
      {
        label: '探入其中', sub: '受到伤害，有几率获得遗物（几率随尝试次数提升）',
        run: async (ev) => {
          ev.tries = (ev.tries || 0) + 1;
          const dmg = 3 + ev.tries;
          damagePlayerOutOfCombat(dmg);
          const p = 0.25 + 0.1 * (ev.tries - 1);
          if (S.hp <= 0) return;
          if (chance(p)) {
            gainRandomRelic();
            Game.finishEvent();
          } else {
            toast('什么也没摸到……（受到 ' + dmg + ' 点伤害）');
            Game.refreshEvent();
          }
        }
      },
      { label: '离开', run: async () => { Game.finishEvent(); } }
    ]
  },

  shining_light: {
    name: '闪耀之光', art: 'star',
    body: '一道刺眼的光柱从穹顶倾泻而下。踏入光中会带来什么，无人知晓，但你能感到某种力量正在灼烧你的意志。',
    options: [
      {
        label: '踏入光中', sub: '升级 2 张随机卡牌，受到最大生命 20% 的伤害',
        run: async () => {
          upgradeRandomCards(null, 2);
          damagePlayerOutOfCombat(Math.floor(S.maxHp * 0.2));
          Game.finishEvent();
        }
      },
      { label: '离开', run: async () => { Game.finishEvent(); } }
    ]
  },

  mushrooms: {
    name: '蘑菇丛', art: 'flower',
    body: '一片诡异的蘑菇丛横在路上。仔细看去，它们竟长着眼睛，正咕咕地朝你挪动。',
    options: [
      {
        label: '踩碎它们', sub: '战斗：真菌兽 ×3（获胜后获得【圆木】）',
        run: async () => {
          Game.startFight(['fungi_beast', 'fungi_beast', 'fungi_beast'], 'monster', { relic: 'odd_mushroom' });
        }
      },
      {
        label: '吃掉它们', sub: '回复 25% 最大生命值，获得一张【受伤】',
        run: async () => {
          healOutOfCombat(Math.floor(S.maxHp * 0.25));
          addCardToDeck('injury');
          Game.finishEvent();
        }
      }
    ]
  },

  wing_statue: {
    name: '翼之雕像', art: 'statue',
    body: '一尊长着双翼的女性雕像，脚下的祭坛上残留着乾涸的血迹。旁边有几个装着金币的罐子。',
    options: [
      {
        label: '祈祷', sub: '受到 7 点伤害，移除牌组中的一张卡牌',
        enabled: () => S.deck.length > 1,
        run: async () => {
          damagePlayerOutOfCombat(7);
          if (S.hp <= 0) return;
          const c = await pickCardFromDeck('选择要移除的卡牌');
          if (c) removeCardFromDeck(c);
          Game.finishEvent();
        }
      },
      {
        label: '砸开罐子', sub: '获得 70~110 金币',
        run: async () => {
          const g = ri(70, 110); S.gold += g; toast('金币 +' + g); Game.finishEvent();
        }
      },
      { label: '离开', run: async () => { Game.finishEvent(); } }
    ]
  },

  dead_adventurer: {
    name: '死去的冒险者', art: 'skull',
    body: '一名冒险者的尸体倒在墙边，装备散落一地。空气中弥漫着某种巨大生物的气息——它可能还在附近。',
    options: [
      {
        label: '搜寻遗物', sub: '获得战利品，但有几率惊动精英',
        run: async (ev) => {
          ev.tries = (ev.tries || 0) + 1;
          const risk = 0.25 * ev.tries;
          const roll = rnd();
          if (roll < 0.35) { const g = ri(55, 85); S.gold += g; toast('金币 +' + g); }
          else if (roll < 0.7) { gainRandomRelic(); }
          else { const p = randomPotion(); gainPotion(p); }
          if (chance(risk)) {
            toast('一只精英被惊动了！');
            await wait(500);
            Game.startFight(rollEncounter('elite'), 'elite');
            return;
          }
          if (ev.tries >= 3) { Game.finishEvent(); return; }
          Game.refreshEvent();
        }
      },
      { label: '离开', run: async () => { Game.finishEvent(); } }
    ]
  },

  serpent: {
    name: '蛇之低语', art: 'orb',
    body: '一条通体墨黑的巨蛇缠绕在石柱上。「拿走这些金币吧，」它嘶嘶地说，「代价……只是一点点悔恨。」',
    options: [
      {
        label: '接受', sub: '获得 175 金币，牌组加入一张【悔恨】',
        run: async () => {
          S.gold += 175; addCardToDeck('regret'); toast('金币 +175'); Game.finishEvent();
        }
      },
      { label: '拒绝', sub: '什么也不做', run: async () => { Game.finishEvent(); } }
    ]
  },

  bonfire: {
    name: '灵魂篝火', art: 'flame',
    body: '一堆幽绿色的篝火在洞穴中央燃烧。火焰似乎渴望着什么——把卡牌投入其中，它会给予回报。',
    options: [
      {
        label: '献祭一张卡牌', sub: '普通→回复生命；罕见→最大生命+8；稀有→获得遗物；诅咒→移除并回满生命',
        enabled: () => S.deck.length > 1,
        run: async () => {
          const c = await pickCardFromDeck('选择要投入篝火的卡牌');
          if (!c) { Game.refreshEvent(); return; }
          const r = CARDS[c.id].rarity, t = CARDS[c.id].type;
          removeCardFromDeck(c);
          if (t === 'curse' || t === 'status') { S.hp = S.maxHp; toast('生命值已回满！'); }
          else if (r === 'rare') { gainRandomRelic(); }
          else if (r === 'uncommon') { S.maxHp += 8; S.hp += 8; toast('最大生命 +8'); }
          else { healOutOfCombat(Math.floor(S.maxHp * 0.3)); }
          Game.finishEvent();
        }
      },
      { label: '离开', run: async () => { Game.finishEvent(); } }
    ]
  },

  world_of_goo: {
    name: '黏液世界', art: 'orb',
    body: '整条走廊都被黏稠的胶质覆盖，其中包裹着大量的金币。想拿到它们，就得把手伸进去。',
    options: [
      {
        label: '收集金币', sub: '获得 75 金币，牌组加入 5 张【黏液】',
        run: async () => {
          S.gold += 75;
          for (let i = 0; i < 5; i++) addCardToDeck('slimed');
          toast('金币 +75'); Game.finishEvent();
        }
      },
      { label: '离开', run: async () => { Game.finishEvent(); } }
    ]
  }
};

/* 金色偶像 / 圆木 —— 事件专属遗物补充 */
RELICS.golden_idol = {
  name: '金色偶像', en: 'Golden Idol', rarity: 'special', shape: 'statue', color: '#d4af58',
  desc: '战斗获得的金币增加 25%。',
  flavor: '沉重的纯金塑像。'
};
RELICS.odd_mushroom = {
  name: '奇异蘑菇', en: 'Odd Mushroom', rarity: 'special', shape: 'flower', color: '#c85a5a',
  desc: '易伤时受到的伤害减少 25%。',
  flavor: '闻起来像雨后的森林。'
};

function rollEvent() {
  const keys = Object.keys(EVENTS).filter(k => !S.seenEvents.includes(k));
  if (!keys.length) { S.seenEvents = []; return pick(Object.keys(EVENTS)); }
  return pick(keys);
}
