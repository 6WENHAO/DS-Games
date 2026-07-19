// ==== 游戏状态机 ====
import { rng } from './rng.js';
import { createPlayer, createMinion } from './player.js';
import { runEffect, validTargets, effectNeedsTarget } from './effects.js';
import { resolveAttack, canAttack, validAttackTargets } from './combat.js';
import { getCard } from '../data/cards.js';

const MAX_BOARD = 7;
const MAX_HAND = 10;
const MAX_MANA = 10;

export class Game {
  constructor(p1Setup, p2Setup) {
    this.players = {
      p1: createPlayer('p1', p1Setup.hero, rng.shuffle(p1Setup.deck.slice())),
      p2: createPlayer('p2', p2Setup.hero, rng.shuffle(p2Setup.deck.slice())),
    };
    this.turn = 'p1';
    this.turnNumber = 0;
    this.over = false;
    this.winner = null;
  }

  // ---------- 工具 ----------
  enemyOf(side) { return side === 'p1' ? 'p2' : 'p1'; }
  cardById(id) { return getCard(id); }

  getEntity(id) {
    for (const s of ['p1', 'p2']) {
      const p = this.players[s];
      if (p.hero.id === id) return p.hero;
      const m = p.board.find(x => x.id === id);
      if (m) return m;
    }
    return null;
  }

  snap(e) {
    return {
      id: e.id, kind: e.kind, side: e.side, cardId: e.cardId || null,
      name: e.name, icon: e.icon, tint: e.tint,
      atk: e.kind === 'hero' ? e.atk + e.tempAtk : e.atk,
      hp: e.hp, maxHp: e.maxHp, armor: e.armor || 0,
      taunt: !!e.taunt, charge: !!e.charge, divineShield: !!e.divineShield,
      sleeping: !!e.sleeping,
    };
  }

  // ---------- 开局 ----------
  start() {
    const events = [];
    events.push({ t: 'gameStart' });
    for (let i = 0; i < 3; i++) this.draw(this.players.p1, events);
    for (let i = 0; i < 4; i++) this.draw(this.players.p2, events);
    // 后手获得幸运币
    this.players.p2.hand.push('coin');
    events.push({ t: 'draw', side: 'p2', cardId: 'coin', handSize: this.players.p2.hand.length, coin: true });
    this.startTurn(events);
    return events;
  }

  // ---------- 抽牌 / 疲劳 ----------
  draw(player, events) {
    if (player.deck.length === 0) {
      player.fatigue++;
      events.push({ t: 'fatigue', side: player.side, amount: player.fatigue });
      this.dealDamage(player.hero, player.fatigue, events, { fatigue: true });
      this.processDeaths(events);
      return;
    }
    const cardId = player.deck.pop();
    if (player.hand.length >= MAX_HAND) {
      events.push({ t: 'burn', side: player.side, cardId, deckSize: player.deck.length });
      return;
    }
    player.hand.push(cardId);
    events.push({ t: 'draw', side: player.side, cardId, handSize: player.hand.length, deckSize: player.deck.length });
  }

  // ---------- 回合 ----------
  startTurn(events) {
    this.turnNumber++;
    const p = this.players[this.turn];
    p.maxMana = Math.min(MAX_MANA, p.maxMana + 1);
    p.mana = p.maxMana;
    p.hero.powerUsed = false;
    p.hero.attacksThisTurn = 0;
    for (const m of p.board) { m.sleeping = false; m.attacksThisTurn = 0; }
    events.push({ t: 'turnStart', side: this.turn, turnNumber: this.turnNumber, mana: p.mana, maxMana: p.maxMana });
    if (this.turnNumber > 1) this.draw(p, events);
  }

  endTurn() {
    const events = [];
    if (this.over) return events;
    const p = this.players[this.turn];
    p.hero.tempAtk = 0;
    events.push({ t: 'turnEnd', side: this.turn });
    this.turn = this.enemyOf(this.turn);
    this.startTurn(events);
    return events;
  }

  // ---------- 出牌 ----------
  playRequirements(side, handIndex) {
    const p = this.players[side];
    const cardId = p.hand[handIndex];
    if (!cardId) return { playable: false, reason: '没有这张牌' };
    const card = getCard(cardId);
    if (this.turn !== side) return { playable: false, reason: '不是你的回合' };
    if (card.cost > p.mana) return { playable: false, reason: '法力值不足' };
    if (card.type === 'minion' && p.board.length >= MAX_BOARD) {
      return { playable: false, reason: '战场已满' };
    }
    const eff = card.type === 'spell' ? card.effect : card.battlecry;
    let needsTarget = false, targets = [];
    if (eff && effectNeedsTarget(eff)) {
      targets = validTargets(this, side, eff).map(e => e.id);
      if (targets.length > 0) needsTarget = true;
      else if (card.type === 'spell' && eff.requiresTarget !== false) {
        return { playable: false, reason: '没有合适的目标' };
      }
    }
    return { playable: true, needsTarget, targets };
  }

  playCard(side, handIndex, boardPos, targetId) {
    const events = [];
    const req = this.playRequirements(side, handIndex);
    if (!req.playable) return { ok: false, reason: req.reason, events };
    if (req.needsTarget && (targetId == null || !req.targets.includes(targetId))) {
      return { ok: false, reason: '需要选择目标', events };
    }
    const p = this.players[side];
    const cardId = p.hand[handIndex];
    const card = getCard(cardId);
    const target = targetId != null ? this.getEntity(targetId) : null;

    p.mana -= card.cost;
    p.hand.splice(handIndex, 1);
    events.push({
      t: 'playCard', side, cardId, handIndex,
      mana: p.mana, maxMana: p.maxMana, type: card.type,
    });

    if (card.type === 'minion') {
      const m = createMinion(side, card);
      if (m.charge) m.sleeping = false;
      const pos = Math.max(0, Math.min(boardPos ?? p.board.length, p.board.length));
      p.board.splice(pos, 0, m);
      events.push({ t: 'summon', side, entity: this.snap(m), index: pos });
      if (card.battlecry) runEffect(this, side, card.battlecry, target, events);
    } else if (card.type === 'spell') {
      events.push({ t: 'spellCast', side, cardId, targetId: targetId ?? null });
      runEffect(this, side, card.effect, target, events);
    }
    this.processDeaths(events);
    return { ok: true, events };
  }

  // ---------- 英雄技能 ----------
  powerRequirements(side) {
    const p = this.players[side];
    const power = p.hero.power;
    if (this.turn !== side) return { usable: false, reason: '不是你的回合' };
    if (p.hero.powerUsed) return { usable: false, reason: '本回合已使用过' };
    if (p.mana < power.cost) return { usable: false, reason: '法力值不足' };
    let needsTarget = false, targets = [];
    if (effectNeedsTarget(power.effect)) {
      targets = validTargets(this, side, power.effect).map(e => e.id);
      needsTarget = targets.length > 0;
      if (!targets.length) return { usable: false, reason: '没有目标' };
    }
    return { usable: true, needsTarget, targets };
  }

  useHeroPower(side, targetId) {
    const events = [];
    const req = this.powerRequirements(side);
    if (!req.usable) return { ok: false, reason: req.reason, events };
    if (req.needsTarget && (targetId == null || !req.targets.includes(targetId))) {
      return { ok: false, reason: '需要选择目标', events };
    }
    const p = this.players[side];
    const power = p.hero.power;
    p.mana -= power.cost;
    p.hero.powerUsed = true;
    events.push({ t: 'heroPower', side, mana: p.mana, powerName: power.name });
    runEffect(this, side, power.effect, targetId != null ? this.getEntity(targetId) : null, events);
    this.processDeaths(events);
    return { ok: true, events };
  }

  // ---------- 攻击 ----------
  attack(attackerId, targetId) {
    const events = [];
    const attacker = this.getEntity(attackerId);
    const target = this.getEntity(targetId);
    if (!attacker || !target) return { ok: false, reason: '目标不存在', events };
    const r = resolveAttack(this, attacker, target, events);
    return { ...r, events };
  }

  attackInfo(attackerId) {
    const attacker = this.getEntity(attackerId);
    if (!attacker) return { can: false, reason: '不存在' };
    const chk = canAttack(this, attacker);
    if (!chk.ok) return { can: false, reason: chk.reason };
    return { can: true, targets: validAttackTargets(this, attacker).map(e => e.id) };
  }

  // ---------- 伤害 / 死亡 ----------
  dealDamage(entity, amount, events, ctx) {
    if (this.over || !entity || amount <= 0) return;
    if (entity.kind === 'minion' && entity.hp <= 0) return;
    if (entity.kind === 'minion' && entity.divineShield) {
      entity.divineShield = false;
      events.push({ t: 'shieldPop', id: entity.id });
      return;
    }
    let dealt = amount;
    if (entity.kind === 'hero' && entity.armor > 0) {
      const absorbed = Math.min(entity.armor, dealt);
      entity.armor -= absorbed;
      dealt -= absorbed;
      events.push({ t: 'armorHit', id: entity.id, absorbed, armor: entity.armor });
      if (dealt <= 0) return;
    }
    entity.hp -= dealt;
    events.push({
      t: 'damage', id: entity.id, amount: dealt, hp: entity.hp,
      spell: !!ctx.spell, fatigue: !!ctx.fatigue,
    });
  }

  summonToken(side, tokenId, events) {
    const p = this.players[side];
    if (p.board.length >= MAX_BOARD) return;
    const card = getCard(tokenId);
    const m = createMinion(side, card);
    p.board.push(m);
    events.push({ t: 'summon', side, entity: this.snap(m), index: p.board.length - 1, token: true });
  }

  processDeaths(events) {
    if (this.over) return;
    let changed = true;
    while (changed) {
      changed = false;
      for (const s of ['p1', 'p2']) {
        const p = this.players[s];
        for (const m of p.board.slice()) {
          if (m.hp <= 0) {
            p.board.splice(p.board.indexOf(m), 1);
            events.push({ t: 'death', id: m.id, side: s });
            if (m.deathrattle) {
              events.push({ t: 'deathrattle', id: m.id, name: m.name });
              runEffect(this, s, m.deathrattle, null, events);
            }
            changed = true;
          }
        }
      }
    }
    const h1 = this.players.p1.hero, h2 = this.players.p2.hero;
    if ((h1.hp <= 0 || h2.hp <= 0) && !this.over) {
      this.over = true;
      this.winner = h1.hp <= 0 && h2.hp <= 0 ? null : (h1.hp <= 0 ? 'p2' : 'p1');
      events.push({ t: 'gameOver', winner: this.winner });
    }
  }
}
