/* ============================================================
   game.js —— 运行状态、地图流程、房间结算、快捷键、启动
   ============================================================ */
'use strict';

let S = null;

const Game = {

  /* ---------- 屏幕切换 ---------- */
  show(name) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    const scr = $('#screen-' + name);
    if (scr) scr.classList.add('active');
    S && name !== 'title' && name !== 'end'
      ? $('#topbar').classList.remove('hidden')
      : $('#topbar').classList.add('hidden');
    this.screen = name;
  },

  /* ---------- 新游戏 ---------- */
  newRun() {
    RNG = makeRng((Math.random() * 1e9) | 0);
    S = {
      hp: 80, maxHp: 80, gold: 99,
      deck: [], relics: ['burning_blood'],
      potions: [null, null, null], potionSlots: 3,
      map: null, floor: 0, act: 1,
      seenEvents: [], counters: {}, relicFlags: {},
      stats: { kills: 0, maxHit: 0 },
      shop: null, monsterCount: 0, lastEncounter: null,
      unknownCount: 0, bossId: pick(['guardian', 'slime_boss', 'hexaghost'])
    };
    for (let i = 0; i < 5; i++) S.deck.push(makeCard('strike'));
    for (let i = 0; i < 4; i++) S.deck.push(makeCard('defend'));
    S.deck.push(makeCard('bash'));
    S.map = genMap();
    CB = null;
    this.toMap();
    toast('第一章 · 遗迹　BOSS：' + BOSS_NAMES[S.bossId]);
  },

  toMap() {
    CB = null;
    HAND.selected = null; HAND.potionTarget = null;
    hideTargetArrow();
    this.show('map');
    renderTopbar();
    renderMap();
  },

  /* ---------- 进入节点 ---------- */
  async enterNode(node) {
    const m = S.map;
    m.current = node;
    if (!m.visited.includes(node.id)) m.visited.push(node.id);
    S.floor = node.type === 'boss' ? MAP_ROWS + 1 : node.r + 1;
    await relicHook('onFloor');
    renderTopbar();

    switch (node.type) {
      case 'monster': {
        S.monsterCount++;
        const kindPool = S.monsterCount <= 3 ? 'weak' : 'strong';
        const ids = rollEncounter(kindPool, S.lastEncounter);
        S.lastEncounter = ids.join(',');
        this.startFight(ids, 'monster');
        break;
      }
      case 'elite':
        this.startFight(rollEncounter('elite'), 'elite');
        break;
      case 'boss':
        this.startFight([S.bossId], 'boss');
        break;
      case 'rest':
        this.show('rest'); renderRest();
        break;
      case 'shop':
        S.shop = null;
        this.show('shop'); renderShop();
        break;
      case 'treasure':
        this.openChest();
        break;
      case 'event':
        this.rollUnknown();
        break;
    }
  },

  /* 未知房间：多数为事件，也可能是战斗/商店/宝箱 */
  rollUnknown() {
    S.unknownCount++;
    if (hasRelic('tiny_chest') && S.unknownCount % 4 === 0) { this.openChest(); return; }
    const r = rnd();
    if (r < 0.10 && !hasRelic('juzu_bracelet')) {
      const ids = rollEncounter(S.monsterCount <= 3 ? 'weak' : 'strong', S.lastEncounter);
      S.monsterCount++;
      this.startFight(ids, 'monster');
      return;
    }
    if (r < 0.17) { S.shop = null; this.show('shop'); renderShop(); return; }
    if (r < 0.24) { this.openChest(); return; }
    const key = rollEvent();
    S.seenEvents.push(key);
    S.currentEvent = key;
    S.eventState = {};
    this.show('event');
    renderEvent(key, S.eventState);
  },

  refreshEvent() { renderEvent(S.currentEvent, S.eventState); },
  finishEvent() { this.toMap(); },

  /* ---------- 战斗 ---------- */
  startFight(ids, kind, rewardOpts) {
    this.show('combat');
    startCombat(ids, kind, rewardOpts);
  },

  combatVictory(rewardOpts, kind) {
    if (kind === 'boss') { this.victory(); return; }
    const items = [];
    let gold = kind === 'elite' ? ri(25, 35) : ri(10, 20);
    if (hasRelic('golden_idol')) gold = Math.round(gold * 1.25);
    items.push({
      icon: SVG.goldCoin(), text: gold + ' 金币', sub: '战斗奖励',
      take: () => { S.gold += gold; renderTopbar(); }
    });
    if (chance(0.4)) {
      const pid = randomPotion();
      const p = POTIONS[pid];
      items.push({
        icon: SVG.potionIcon(p.color, p.shape), text: p.name, sub: p.desc,
        take: () => gainPotion(pid)
      });
    }
    if (kind === 'elite') {
      const rid = rollRelicId();
      if (rid) items.push({
        icon: relicIconHtml(rid), text: RELICS[rid].name, sub: RELICS[rid].desc,
        take: () => { gainRelic(rid); }
      });
    }
    if (rewardOpts && rewardOpts.relic && !hasRelic(rewardOpts.relic)) {
      const rid = rewardOpts.relic;
      items.push({
        icon: relicIconHtml(rid), text: RELICS[rid].name, sub: RELICS[rid].desc,
        take: () => { gainRelic(rid); }
      });
    }
    items.push({
      icon: SVG.cardStackIcon(), text: '卡牌奖励', sub: '从 3 张牌中选择 1 张',
      take: () => new Promise(res => showCardRewardChoice(() => { renderTopbar(); res(true); }))
    });
    this.pendingRewards = items;
    this.show('reward');
    renderReward(items);
  },

  /* ---------- 宝箱 ---------- */
  openChest() {
    const r = rnd();
    const size = r < 0.5 ? 'small' : (r < 0.83 ? 'medium' : 'large');
    const items = [];
    const rid = rollRelicId(size === 'large' ? 'better' : null);
    if (rid) items.push({
      icon: relicIconHtml(rid), text: RELICS[rid].name, sub: RELICS[rid].desc,
      take: () => { gainRelic(rid); }
    });
    const goldChance = { small: 0.5, medium: 0.35, large: 0.5 }[size];
    if (chance(goldChance)) {
      const g = { small: ri(23, 27), medium: ri(45, 55), large: ri(68, 82) }[size];
      items.push({
        icon: SVG.goldCoin(), text: g + ' 金币', sub: '',
        take: () => { S.gold += g; renderTopbar(); }
      });
    }
    if (size === 'large' && chance(0.6)) {
      const pid = randomPotion(); const p = POTIONS[pid];
      items.push({
        icon: SVG.potionIcon(p.color, p.shape), text: p.name, sub: p.desc,
        take: () => gainPotion(pid)
      });
    }
    this.pendingRewards = items;
    this.show('chest');
    renderChest(size, items);
  },

  /* ---------- 结束 ---------- */
  gameOver() {
    this.show('end');
    renderEnd(false);
  },
  victory() {
    screenFlash();
    this.show('end');
    renderEnd(true);
  },

  beginPotionTargeting(idx) {
    HAND.potionTarget = idx;
    toast('点击一个敌人作为目标（Esc 取消）');
  }
};

/* ============================================================
   通用工具（供事件 / 遗物 / 界面调用）
   ============================================================ */
function healOutOfCombat(n) {
  const before = S.hp;
  S.hp = Math.min(S.maxHp, S.hp + n);
  if (CB && !CB.over) { CB.player.hp = S.hp; renderCombat(); }
  if (S.hp > before) toast('回复 ' + (S.hp - before) + ' 点生命');
  renderTopbar();
}
function damagePlayerOutOfCombat(n) {
  S.hp = Math.max(0, S.hp - n);
  renderTopbar();
  if (S.hp <= 0) { setTimeout(() => Game.gameOver(), 400); return true; }
  return false;
}
function addCardToDeck(id, upgraded) {
  const c = makeCard(id, upgraded || 0);
  if (!c) return null;
  S.deck.push(c);
  relicHook('onCardAdded');
  toast('牌组加入：' + cardName(c));
  return c;
}
function removeCardFromDeck(card) {
  const i = S.deck.indexOf(card);
  if (i >= 0) { S.deck.splice(i, 1); toast('已移除：' + cardName(card)); }
}
function upgradeRandomCards(type, n) {
  const cands = S.deck.filter(c => canUpgradeCard(c) && (!type || CARDS[c.id].type === type));
  shuffle(cands);
  const list = cands.slice(0, n);
  list.forEach(c => upgradeCardInstance(c));
  if (list.length) toast('升级：' + list.map(cardName).join('、'));
}
function gainRelic(id) {
  if (!RELICS[id]) return false;
  if (hasRelic(id)) return false;
  S.relics.push(id);
  const r = RELICS[id];
  if (r.onPickup) r.onPickup();
  toast('获得遗物：' + r.name);
  renderTopbar();
  return true;
}
function rollRelicId(mode) {
  const table = mode === 'better'
    ? [['common', 25], ['uncommon', 45], ['rare', 30]]
    : [['common', 50], ['uncommon', 33], ['rare', 17]];
  for (let t = 0; t < 8; t++) {
    const rarity = weighted(table);
    const pool = relicPool(rarity).filter(id => !hasRelic(id));
    if (pool.length) return pick(pool);
  }
  const all = relicPool('common').concat(relicPool('uncommon'), relicPool('rare'))
    .filter(id => !hasRelic(id));
  return all.length ? pick(all) : null;
}
function gainRandomRelic(rarity) {
  const id = rarity
    ? (relicPool(rarity).filter(x => !hasRelic(x))[0] || rollRelicId())
    : rollRelicId();
  if (!id) { toast('已收集全部遗物'); return false; }
  return gainRelic(id);
}
function gainPotion(id) {
  if (hasRelic('sozu')) { toast('索祖阻止了你获得药水'); return false; }
  const idx = S.potions.findIndex((p, i) => i < S.potionSlots && !p);
  if (idx < 0) { toast('药水栏已满'); return false; }
  S.potions[idx] = id;
  toast('获得药水：' + POTIONS[id].name);
  renderTopbar();
  return true;
}

/* ============================================================
   快捷键
   ============================================================ */
window.addEventListener('keydown', (ev) => {
  const k = ev.key.toLowerCase();
  if (k === 'escape') {
    if (closeTopEscOverlay()) return;
    HAND.selected = null; HAND.potionTarget = null;
    clearHighlight(); layoutHand(); TIP.hide();
    return;
  }
  if (Game.screen === 'combat' && CB && !CB.over) {
    if (k === 'e' && !CB.busy) { endPlayerTurn(); return; }
    if (k === 'd') { showPileView('抽牌堆', CB.drawPile.slice(), { shuffled: true, sub: '顺序已隐藏' }); return; }
    if (k === 'a') { showPileView('弃牌堆', CB.discardPile.slice()); return; }
    if (k === 'x') { showPileView('消耗堆', CB.exhaustPile.slice()); return; }
    if (/^[1-9]$/.test(k) && !CB.busy) {
      const idx = parseInt(k, 10) - 1;
      const card = CB.hand[idx];
      if (card) {
        const d = CARDS[card.id];
        if (!canPlayCard(card)) { toast('无法打出'); return; }
        if (d.target === 'enemy') {
          const t = A.aliveEnemies();
          if (t.length === 1) doPlay(card, t[0]);
          else {
            const node = $$('.card', $('#hand'))[idx];
            HAND.selected = node || null;
            layoutHand();
            toast('点击一个敌人作为目标');
          }
        } else doPlay(card, null);
      }
      return;
    }
  }
  if (k === 'm' && S && Game.screen !== 'combat') { Game.toMap(); }
});

/* ============================================================
   启动
   ============================================================ */
function initGame() {
  if (window.__dshGameInited) return;
  window.__dshGameInited = true;
  fitStage();
  TIP.init();

  $('#btn-end-turn').addEventListener('click', () => {
    if (CB && !CB.over && !CB.busy) endPlayerTurn();
  });
  $('#pile-draw').addEventListener('click', () => {
    if (CB) showPileView('抽牌堆', CB.drawPile.slice(), { shuffled: true, sub: '顺序已隐藏' });
  });
  $('#pile-discard').addEventListener('click', () => {
    if (CB) showPileView('弃牌堆', CB.discardPile.slice());
  });
  $('#pile-exhaust').addEventListener('click', () => {
    if (CB) showPileView('消耗堆', CB.exhaustPile.slice());
  });
  $('#btn-deck').addEventListener('click', () => {
    if (!S) return;
    const cards = CB && !CB.over
      ? CB.drawPile.concat(CB.hand, CB.discardPile, CB.exhaustPile)
      : S.deck.slice();
    showPileView('牌组', cards, { sub: CB && !CB.over ? '战斗中（含所有牌堆）' : '' });
  });
  $('#btn-map-view').addEventListener('click', () => {
    if (!S) return;
    if (Game.screen === 'combat') { toast('战斗中无法查看地图'); return; }
    Game.toMap();
  });
  $('#btn-menu').addEventListener('click', () => {
    const ov = openOverlay();
    ov.appendChild(el('div', 'ov-title', '菜单'));
    const btns = el('div', 'ov-buttons');
    const b1 = el('button', 'btn', '操作说明');
    b1.addEventListener('click', () => { closeOverlay(ov); showHelp(); });
    const b2 = el('button', 'btn', '放弃本局并返回标题');
    b2.addEventListener('click', () => {
      if (confirm('确定放弃当前进度？')) { closeOverlay(ov); S = null; CB = null; Game.show('title'); renderTitle(); }
    });
    const b3 = el('button', 'btn primary', '继续游戏');
    b3.addEventListener('click', () => closeOverlay(ov));
    btns.appendChild(b1); btns.appendChild(b2); btns.appendChild(b3);
    ov.appendChild(btns);
  });

  /* 点击空白处取消选牌 */
  $('#battlefield').addEventListener('click', (ev) => {
    if (ev.target.id === 'battlefield') {
      HAND.selected = null; HAND.potionTarget = null; layoutHand(); clearHighlight();
    }
  });

  Game.show('title');
  renderTitle();
}

document.addEventListener('DOMContentLoaded', initGame);
if (document.readyState !== 'loading') initGame();
