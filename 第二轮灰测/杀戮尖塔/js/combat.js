/* ============================================================
   combat.js —— 战斗引擎（状态、伤害管线、出牌、回合流程、敌人 AI 执行）
   ============================================================ */
'use strict';

let CB = null;

/* ============================================================
   一、实体构建
   ============================================================ */
function makeEnemy(id, index, kind) {
  const d = ENEMIES[id];
  let maxHp = ri(d.hp[0], d.hp[1]);
  if (d.elite && hasRelic('preserved_insect')) maxHp = Math.max(1, Math.floor(maxHp * 0.75));
  const e = {
    uid: uid(), id: id, def: d, name: d.name, art: d.art, artParam: d.artParam || null,
    w: d.w, h: d.h, hp: maxHp, maxHp: maxHp, block: 0, powers: {},
    history: [], move: null, moveKey: null, slotIndex: index, isPlayer: false, escaped: false
  };
  if (d.init) d.init(e);
  return e;
}

function rollEnemyMove(e) {
  if (e.hp <= 0 || e.escaped) return;
  const key = e.def.ai(e);
  e.moveKey = key;
  e.move = e.def.moves[key];
}

/* ============================================================
   二、战斗开始 / 结束
   ============================================================ */
async function startCombat(enemyIds, kind, rewardOpts) {
  CB = {
    kind: kind || 'monster',
    enemies: enemyIds.map((id, i) => makeEnemy(id, i, kind)),
    player: {
      isPlayer: true, uid: 'p', name: '铁甲战士', hp: S.hp, maxHp: S.maxHp,
      block: 0, powers: {}, escaped: false, dead: false
    },
    hand: [], drawPile: [], discardPile: [], exhaustPile: [],
    energy: 0, energyMax: 3 + relicEnergyBonus(), turn: 0,
    cardsPlayedThisTurn: 0, hpLostTimes: 0, totalHpLost: 0,
    counters: {}, relicFlags: {}, over: false, busy: true,
    rewardOpts: rewardOpts || {}, playerDead: false, victory: false,
    goldReward: 0
  };
  CB.drawPile = S.deck.map(c => ({ uid: uid(), id: c.id, upgraded: c.upgraded || 0 }));

  Game.show('combat');
  EL.entities = {};
  clear($('#player-slot'));
  clear($('#enemy-slots'));
  clear($('#hand'));
  renderCombat();
  renderHand();

  await relicHook('atCombatStart');

  shuffle(CB.drawPile);
  /* 固有牌置于手牌 */
  const innate = CB.drawPile.filter(cardIsInnate);
  innate.forEach(c => {
    CB.drawPile.splice(CB.drawPile.indexOf(c), 1);
    CB.hand.push(c);
  });
  CB.enemies.forEach(rollEnemyMove);
  renderCombat();
  await wait(280);
  showTurnBanner('战斗开始');
  await wait(420);
  await startPlayerTurn(true);
}

function checkCombatEnd() {
  if (!CB || CB.over) return CB && CB.over;
  if (CB.player.hp <= 0) {
    CB.over = true; CB.playerDead = true;
    S.hp = 0;
    setTimeout(() => Game.gameOver(), 700);
    return true;
  }
  if (A.aliveEnemies().length === 0) {
    CB.over = true; CB.victory = true;
    S.hp = CB.player.hp;
    setTimeout(() => finishCombat(), 620);
    return true;
  }
  return false;
}

async function finishCombat() {
  CB.busy = true;
  await relicHook('atCombatEnd');
  S.hp = clamp(S.hp, 0, S.maxHp);
  Game.combatVictory(CB.rewardOpts, CB.kind);
}

/* ============================================================
   三、伤害 / 格挡 / 状态
   ============================================================ */
function calcAttackDamage(src, tgt, base, opts) {
  opts = opts || {};
  let d = base;
  if (!opts.noStr) d += (src.powers.strength || 0) * (opts.strMult || 1);
  if (src.powers.vigor) d += src.powers.vigor;
  if (src.powers.weak) d = Math.floor(d * 0.75);
  if (tgt.powers.vulnerable) {
    let mult = 1.5;
    if (src.isPlayer && hasRelic('paper_phrog')) mult = 1.75;
    if (tgt.isPlayer && hasRelic('odd_mushroom')) mult = 1.25;
    d = Math.floor(d * mult);
  }
  if (src.isPlayer && src.powers.pen_nib_p) d = d * 2;
  return Math.max(0, Math.floor(d));
}

/* 返回实际扣血量 */
function applyDamage(src, tgt, amount, opts) {
  opts = opts || {};
  if (!tgt || tgt.hp <= 0 || tgt.escaped) return 0;
  const type = opts.type || 'attack';
  if (tgt.powers.intangible && type !== 'hpLoss' && amount > 0) amount = Math.min(amount, 1);
  if (type === 'attack' && tgt.isPlayer && hasRelic('torii') && amount > 0 && amount <= 5) amount = 1;

  let remaining = amount;
  if (type !== 'hpLoss') {
    const blocked = Math.min(tgt.block, remaining);
    if (blocked > 0) {
      tgt.block -= blocked; remaining -= blocked;
      floatOn(tgt, String(blocked), 'blk');
    }
  }
  if (remaining > 0) {
    if (tgt.powers.buffer) {
      tgt.powers.buffer--; if (!tgt.powers.buffer) delete tgt.powers.buffer;
      floatOn(tgt, '缓冲!', 'buff');
      return 0;
    }
    tgt.hp = Math.max(0, tgt.hp - remaining);
    floatOn(tgt, String(remaining), 'dmg');
    shakeOn(tgt);
    if (type === 'attack' && tgt.powers.platedArmor) {
      tgt.powers.platedArmor--; if (!tgt.powers.platedArmor) delete tgt.powers.platedArmor;
    }
    if (tgt.isPlayer) {
      S.hp = tgt.hp;
      CB.hpLostTimes++; CB.totalHpLost += remaining;
      if (hasRelic('centennial_puzzle') && !CB.relicFlags.centennial) {
        CB.relicFlags.centennial = true; flashRelic('centennial_puzzle'); A.draw(3);
      }
    } else {
      if (src && src.isPlayer && remaining > S.stats.maxHit) S.stats.maxHit = remaining;
      /* 敌人专属被击反应 */
      if (type === 'attack' && tgt.powers.curlUp) {
        tgt.block += tgt.powers.curlUp;
        delete tgt.powers.curlUp;
        floatOn(tgt, '卷曲!', 'buff');
      }
      if (type === 'attack' && tgt.powers.angry) applyPower(tgt, 'strength', tgt.powers.angry);
      if (tgt.powers.asleep) E.wake(tgt);
      if (tgt.powers.modeShift !== undefined && tgt.powers.modeShift > 0) {
        tgt.powers.modeShift -= remaining;
        if (tgt.powers.modeShift <= 0) {
          delete tgt.powers.modeShift;
          tgt.pendingShift = true;
          rollEnemyMove(tgt);
          floatOn(tgt, '模式切换!', 'buff');
        }
      }
    }
  }
  /* 反伤 */
  if (type === 'attack' && src && src !== tgt) {
    if (tgt.powers.thorns) applyDamage(tgt, src, tgt.powers.thorns, { type: 'thorns' });
    if (tgt.isPlayer && tgt.powers.flameBarrier) applyDamage(tgt, src, tgt.powers.flameBarrier, { type: 'thorns' });
  }
  return remaining;
}

function applyPower(t, id, n) {
  if (!t || t.hp <= 0 || !n) return;
  const isDebuff = powerKind(id) === 'debuff' || n < 0;
  if (isDebuff && t.powers.artifact) {
    t.powers.artifact--;
    if (!t.powers.artifact) delete t.powers.artifact;
    floatOn(t, '神器!', 'buff');
    renderCombat();
    return;
  }
  const cur = t.powers[id] || 0;
  let v = cur + n;
  if (id === 'strength' || id === 'dexterity') {
    if (v === 0) delete t.powers[id]; else t.powers[id] = v;
  } else {
    if (v <= 0) delete t.powers[id]; else t.powers[id] = v;
  }
  floatOn(t, (n > 0 ? '+' : '') + n + ' ' + powerName(id), isDebuff ? 'dmg' : 'buff');
  renderCombat();
}

function checkDeaths() {
  CB.enemies.forEach(e => {
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      if (!e.hasSplit) S.stats.kills++;
      if (e.powers.sporeCloud) applyPower(CB.player, 'vulnerable', e.powers.sporeCloud);
      markDead(e);
    }
  });
}

/* ============================================================
   四、玩家动作 A
   ============================================================ */
const A = {
  aliveEnemies: () => CB ? CB.enemies.filter(e => e.hp > 0 && !e.escaped) : [],
  randomEnemy: () => { const l = A.aliveEnemies(); return l.length ? pick(l) : null; },

  async attack(target, base, opts) {
    opts = opts || {};
    if (!target || target.hp <= 0 || target.escaped) { target = A.randomEnemy(); }
    if (!target) return 0;
    const p = CB.player;
    const dmg = calcAttackDamage(p, target, base, opts);
    lungeAt(p, 'right');
    slashOn(target);
    const dealt = applyDamage(p, target, dmg, { type: 'attack', src: p });
    if (p.powers.vigor) delete p.powers.vigor;
    if (p.powers.pen_nib_p) delete p.powers.pen_nib_p;
    checkDeaths();
    renderCombat();
    await wait(opts.quick ? 90 : 190);
    return dealt;
  },

  async attackAll(base, opts) {
    opts = opts || {};
    const targets = A.aliveEnemies();
    if (!targets.length) return 0;
    const p = CB.player;
    lungeAt(p, 'right');
    let total = 0;
    targets.forEach(t => {
      const dmg = calcAttackDamage(p, t, base, opts);
      slashOn(t);
      total += applyDamage(p, t, dmg, { type: 'attack', src: p });
    });
    if (p.powers.vigor) delete p.powers.vigor;
    if (p.powers.pen_nib_p) delete p.powers.pen_nib_p;
    checkDeaths();
    renderCombat();
    await wait(opts.quick ? 110 : 220);
    return total;
  },

  async attackRandom(base, opts) {
    const t = A.randomEnemy();
    if (!t) return 0;
    return await A.attack(t, base, Object.assign({ quick: true }, opts || {}));
  },

  block(n, opts) {
    opts = opts || {};
    const p = CB.player;
    let v = n;
    if (!opts.raw) {
      v += (p.powers.dexterity || 0);
      if (p.powers.frail) v = Math.floor(v * 0.75);
    }
    v = Math.max(0, v);
    if (!v) return;
    p.block += v;
    floatOn(p, String(v), 'blk');
    if (p.powers.juggernaut) {
      const t = A.randomEnemy();
      if (t) {
        const dmg = calcAttackDamage(p, t, p.powers.juggernaut, { noStr: true });
        applyDamage(p, t, dmg, { type: 'attack', src: p });
        checkDeaths();
      }
    }
    renderCombat();
  },

  power(target, id, n) { applyPower(target, id, n); },
  buffSelf(id, n) { applyPower(CB.player, id, n); },

  draw(n) {
    const p = CB.player;
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      if (p.powers.noDraw) break;
      if (CB.hand.length >= 10) break;
      if (!CB.drawPile.length) {
        if (!CB.discardPile.length) break;
        reshuffleDiscard();
      }
      const c = CB.drawPile.pop();
      CB.hand.push(c);
      drawn++;
      onCardDrawn(c);
    }
    if (drawn) { renderHand(); renderHud(); }
    return drawn;
  },

  gainEnergy(n) { CB.energy += n; pulseEnergy(); renderHud(); },

  loseHp(n, fromCard) {
    applyDamage(null, CB.player, n, { type: 'hpLoss' });
    if (fromCard && CB.player.powers.rupture) applyPower(CB.player, 'strength', CB.player.powers.rupture);
    renderCombat();
  },

  heal(n) {
    const p = CB.player;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    S.hp = p.hp;
    if (p.hp > before) floatOn(p, '+' + (p.hp - before), 'heal');
    renderCombat();
  },

  addCard(where, id, opts) {
    opts = opts || {};
    const c = makeCard(id, opts.upgraded || 0);
    if (!c) return null;
    if (opts.freeThisTurn) c.freeThisTurn = true;
    if (where === 'hand') {
      if (CB.hand.length >= 10) CB.discardPile.push(c);
      else CB.hand.push(c);
    } else if (where === 'discard') CB.discardPile.push(c);
    else if (where === 'draw') { CB.drawPile.push(c); shuffle(CB.drawPile); }
    else if (where === 'drawTop') CB.drawPile.push(c);
    renderHand(); renderHud();
    return c;
  },

  exhaust(card) {
    const i = CB.hand.indexOf(card);
    if (i >= 0) CB.hand.splice(i, 1);
    CB.exhaustPile.push(card);
    const d = CARDS[card.id];
    if (d.onExhaust) d.onExhaust(card);
    const p = CB.player;
    if (p.powers.feelNoPain) A.block(p.powers.feelNoPain, { raw: true });
    if (p.powers.darkEmbrace) A.draw(p.powers.darkEmbrace);
    if (hasRelic('dead_branch')) {
      const pool = cardPool('common').concat(cardPool('uncommon'));
      const c = makeCard(pick(pool), 0);
      if (CB.hand.length < 10) CB.hand.push(c); else CB.discardPile.push(c);
      flashRelic('dead_branch');
    }
    renderHand(); renderHud();
  },

  async chooseCards(opts) { return await showCardChooser(opts); },

  async playTopOfDraw() {
    if (!CB.drawPile.length) {
      if (!CB.discardPile.length) return;
      reshuffleDiscard();
    }
    const c = CB.drawPile.pop();
    if (!c) return;
    CB.hand.push(c);
    renderHand();
    await wait(160);
    const d = CARDS[c.id];
    if (d.unplayable) { A.exhaust(c); return; }
    let target = null;
    if (d.target === 'enemy') target = A.randomEnemy();
    await playCard(c, target, { free: true, forceExhaust: true });
  }
};

function reshuffleDiscard() {
  CB.drawPile = CB.drawPile.concat(shuffle(CB.discardPile));
  CB.discardPile = [];
  relicHook('onShuffle');
  renderHud();
}

function onCardDrawn(c) {
  const d = CARDS[c.id];
  const p = CB.player;
  if (c.id === 'void_card') { CB.energy = Math.max(0, CB.energy - 1); renderHud(); }
  if (d.type === 'status' || d.type === 'curse') {
    if (p.powers.evolve) A.draw(p.powers.evolve);
    if (p.powers.fireBreathing) {
      A.aliveEnemies().forEach(t => {
        const dmg = calcAttackDamage(p, t, p.powers.fireBreathing, { noStr: true });
        applyDamage(p, t, dmg, { type: 'attack', src: p });
      });
      checkDeaths(); renderCombat();
    }
  }
}

/* ============================================================
   五、出牌
   ============================================================ */
function canPlayCard(card) {
  if (!CB || CB.over || CB.busy) return false;
  const d = CARDS[card.id];
  if (d.unplayable) return false;
  if (d.type === 'attack' && CB.player.powers.entangled) return false;
  if (d.canPlay && !d.canPlay()) return false;
  const cost = cardCost(card);
  if (d.xCost) return CB.energy >= 0;
  return CB.energy >= cost;
}

async function playCard(card, target, opts) {
  opts = opts || {};
  if (!opts.free && !canPlayCard(card)) return false;
  const d = CARDS[card.id];
  CB.busy = true;

  let xValue = 0;
  let pay = 0;
  if (!opts.free) {
    if (d.xCost) { xValue = CB.energy; pay = CB.energy; }
    else pay = cardCost(card);
    CB.energy -= pay;
  } else if (d.xCost) xValue = CB.energy;

  const i = CB.hand.indexOf(card);
  if (i >= 0) CB.hand.splice(i, 1);
  CB.cardsPlayedThisTurn++;
  renderHand(); renderHud(); pulseEnergy();

  /* 敌人：激怒（打出技能牌） */
  if (d.type === 'skill') {
    A.aliveEnemies().forEach(e => { if (e.powers.enrage) applyPower(e, 'strength', e.powers.enrage); });
  }
  /* 敌人：锋利硬皮（打出攻击牌） */
  if (d.type === 'attack') {
    A.aliveEnemies().forEach(e => {
      if (e.powers.sharpHide) applyDamage(e, CB.player, e.powers.sharpHide, { type: 'thorns' });
    });
  }

  let times = 1;
  if (d.type === 'attack' && CB.player.powers.doubleTap) {
    times = 2;
    CB.player.powers.doubleTap--;
    if (!CB.player.powers.doubleTap) delete CB.player.powers.doubleTap;
  }

  for (let t = 0; t < times; t++) {
    if (CB.over) break;
    if (t > 0 && d.target === 'enemy' && (!target || target.hp <= 0)) target = A.randomEnemy();
    if (d.use) {
      try { await d.use({ card: card, target: target, xValue: xValue }); }
      catch (e) { console.error('卡牌效果出错', card.id, e); }
    }
  }

  /* 暴怒（Rage） */
  if (d.type === 'attack' && CB.player.powers.rage) A.block(CB.player.powers.rage, { raw: true });
  /* 遗物钩子 */
  await relicHook('onCardPlay', card);
  /* 痛苦诅咒 */
  const pains = CB.hand.filter(c => c.id === 'pain').length;
  if (pains) A.loseHp(pains, false);

  /* 归堆 */
  if (cardIsExhaust(card) || opts.forceExhaust) {
    CB.exhaustPile.push(card);
    const dd = CARDS[card.id];
    if (dd.onExhaust) dd.onExhaust(card);
    const p = CB.player;
    if (p.powers.feelNoPain) A.block(p.powers.feelNoPain, { raw: true });
    if (p.powers.darkEmbrace) A.draw(p.powers.darkEmbrace);
  } else {
    delete card.freeThisTurn;
    CB.discardPile.push(card);
  }

  checkDeaths();
  renderCombat(); renderHand(); renderHud();
  CB.busy = false;
  checkCombatEnd();
  return true;
}

/* ============================================================
   六、回合流程
   ============================================================ */
async function startPlayerTurn(first) {
  if (CB.over) return;
  CB.turn++;
  const p = CB.player;
  if (!p.powers.barricade) p.block = 0;
  if (!hasRelic('ice_cream')) CB.energy = 0;
  CB.energy += CB.energyMax + (p.powers.berserk || 0);
  CB.cardsPlayedThisTurn = 0;
  CB.counters = {};
  delete p.powers.noDraw;
  CB.hand.forEach(c => { delete c.freeThisTurn; });

  /* 中毒 */
  if (p.powers.poison) {
    applyDamage(null, p, p.powers.poison, { type: 'hpLoss' });
    applyPower(p, 'poison', -1);
  }
  /* 回合开始能力 */
  if (p.powers.demonForm) applyPower(p, 'strength', p.powers.demonForm);
  if (p.powers.brutality) { A.loseHp(p.powers.brutality, false); A.draw(p.powers.brutality); }

  await relicHook('atTurnStart', CB.turn);
  renderCombat(); renderHud();

  CB.busy = false;
  const n = 5 + (first ? relicStartDraw() : 0);
  A.draw(n);
  renderHand();

  if (CB.turn > 1 || !first) showTurnBanner('你的回合');
  if (checkCombatEnd()) return;
  updateEndTurnButton();
}

async function endPlayerTurn() {
  if (!CB || CB.over || CB.busy) return;
  CB.busy = true;
  const p = CB.player;
  updateEndTurnButton(true);

  /* 手牌回合结束效果 */
  for (const c of CB.hand.slice()) {
    if (c.id === 'burn') {
      const dmg = V(c, 'mag');
      applyDamage(null, p, dmg, { type: 'hpLoss' });
    } else if (c.id === 'decay') {
      applyDamage(null, p, 2, { type: 'hpLoss' });
    } else if (c.id === 'regret') {
      applyDamage(null, p, CB.hand.length, { type: 'hpLoss' });
    }
  }
  renderCombat();
  if (checkCombatEnd()) return;

  /* 能力：金属化 / 自燃 / 再生 */
  if (p.powers.metallicize) A.block(p.powers.metallicize, { raw: true });
  await relicHook('atTurnEnd');
  if (p.powers.combust) {
    applyDamage(null, p, 1, { type: 'hpLoss' });
    await A.attackAll(p.powers.combust, { noStr: true, quick: true });
  }
  if (p.powers.regen) { A.heal(p.powers.regen); applyPower(p, 'regen', -1); }

  /* 弃牌 / 虚无消耗 */
  const keep = hasRelic('runic_pyramid');
  for (const c of CB.hand.slice()) {
    if (cardIsEthereal(c)) { A.exhaust(c); continue; }
    if (!keep) {
      const i = CB.hand.indexOf(c);
      if (i >= 0) CB.hand.splice(i, 1);
      delete c.freeThisTurn;
      CB.discardPile.push(c);
    }
  }
  /* 回合结束递减 */
  ['vulnerable', 'weak', 'frail', 'entangled', 'intangible'].forEach(k => {
    if (p.powers[k]) applyPower(p, k, -1);
  });
  if (p.powers.strengthDown) { applyPower(p, 'strength', -p.powers.strengthDown); delete p.powers.strengthDown; }
  if (p.powers.dexterityDown) { applyPower(p, 'dexterity', -p.powers.dexterityDown); delete p.powers.dexterityDown; }
  delete p.powers.flameBarrier;
  delete p.powers.rage;
  delete p.powers.doubleTap;

  renderHand(); renderHud(); renderCombat();
  if (checkCombatEnd()) return;

  await wait(220);
  showTurnBanner('敌人回合');
  await wait(360);

  /* ---------- 敌人行动 ---------- */
  for (const e of CB.enemies.slice()) {
    if (CB.over) break;
    if (e.hp <= 0 || e.escaped) continue;
    e.block = 0;
    if (e.powers.poison) {
      applyDamage(null, e, e.powers.poison, { type: 'hpLoss' });
      applyPower(e, 'poison', -1);
      checkDeaths();
      if (e.hp <= 0) { renderCombat(); continue; }
    }
    if (e.powers.platedArmor) e.block += e.powers.platedArmor;
    if (e.powers.metallicize) e.block += e.powers.metallicize;
    renderCombat();
    await enemyAct(e);
    if (checkCombatEnd()) return;
  }

  /* 敌人回合结束 */
  for (const e of CB.enemies) {
    if (e.hp <= 0) continue;
    ['vulnerable', 'weak', 'frail'].forEach(k => { if (e.powers[k]) applyPower(e, k, -1); });
    if (e.powers.ritual) applyPower(e, 'strength', e.powers.ritual);
    rollEnemyMove(e);
  }
  renderCombat();
  if (checkCombatEnd()) return;
  await wait(200);
  await startPlayerTurn(false);
}

async function enemyAct(e) {
  if (!e.move) rollEnemyMove(e);
  const mv = e.move;
  if (!mv) return;
  showEnemyMoveName(e, mv.name);
  lungeAt(e, 'left');
  await wait(230);
  try { await mv.act(e); } catch (err) { console.error('敌人招式出错', e.id, e.moveKey, err); }
  e.history.push(e.moveKey);
  checkDeaths();
  renderCombat(); renderHud(); renderHand();
  await wait(240);
}

/* ============================================================
   七、敌人动作 E
   ============================================================ */
const E = {
  async attack(e, base, opts) {
    const dmg = calcAttackDamage(e, CB.player, base, opts || {});
    slashOn(CB.player);
    const dealt = applyDamage(e, CB.player, dmg, { type: 'attack', src: e });
    renderCombat();
    await wait(120);
    return dealt;
  },
  async attackMulti(e, base, hits) {
    let total = 0;
    for (let i = 0; i < hits; i++) {
      if (CB.player.hp <= 0) break;
      const dmg = calcAttackDamage(e, CB.player, base, {});
      slashOn(CB.player);
      total += applyDamage(e, CB.player, dmg, { type: 'attack', src: e });
      renderCombat();
      await wait(110);
    }
    return total;
  },
  block(t, n) {
    if (!t) return;
    t.block += n;
    floatOn(t, String(n), 'blk');
    renderCombat();
  },
  power(t, id, n) { applyPower(t, id, n); },
  playerPower(id, n) { applyPower(CB.player, id, n); },
  addCard(where, id, n, upgraded) {
    for (let i = 0; i < (n || 1); i++) A.addCard(where, id, { upgraded: upgraded || 0 });
  },
  stealGold(e, n) {
    const amount = Math.min(S.gold, n);
    if (amount <= 0) return;
    S.gold -= amount;
    e.stolen = (e.stolen || 0) + amount;
    floatOn(CB.player, '-' + amount + ' 金币', 'dmg');
    renderTopbar();
  },
  async escape(e) {
    e.escaped = true;
    if (e.stolen) toast('强盗带走了 ' + e.stolen + ' 金币！');
    markDead(e);
    await wait(300);
    renderCombat();
    checkCombatEnd();
  },
  wake(e) {
    if (!e.powers.asleep) return;
    delete e.powers.asleep;
    delete e.powers.metallicize;
    e.artParam = 'awake';
    e.history = [];
    rollEnemyMove(e);
    floatOn(e, '苏醒!', 'dmg');
    renderCombat();
  },
  async split(e) {
    e.hasSplit = true;
    const hp = Math.max(1, e.hp);
    const ids = e.def.splitInto || [];
    e.hp = 0;
    e.dead = true;
    markDead(e);
    await wait(280);
    e.removed = true;
    const idx = CB.enemies.indexOf(e);
    const newOnes = ids.map((id, k) => {
      const n = makeEnemy(id, idx + k);
      n.maxHp = hp; n.hp = hp;
      rollEnemyMove(n);
      return n;
    });
    CB.enemies.splice(idx + 1, 0, ...newOnes);
    renderCombat();
    await wait(220);
  }
};

/* ============================================================
   八、药水使用
   ============================================================ */
async function usePotion(index, target) {
  const id = S.potions[index];
  if (!id) return;
  const p = POTIONS[id];
  if (!p) return;
  if (p.combatOnly && (!CB || CB.over)) { toast('只能在战斗中使用'); return; }
  if (p.target === 'enemy' && CB && !CB.over) {
    if (!target) { Game.beginPotionTargeting(index); return; }
  }
  S.potions[index] = null;
  renderTopbar();
  toast('使用了 ' + p.name);
  await p.use(target);
  if (CB && !CB.over) { renderCombat(); renderHand(); renderHud(); checkDeaths(); checkCombatEnd(); }
  else renderTopbar();
}
