// ==== 渲染层：构建战场布局，同步游戏状态到 DOM ====
import { el, cardDOM, minionDOM, updateMinionDOM, heroDOM, updateHeroDOM, heroPowerDOM, cardBackDOM } from './cardview.js';

const FRAMES = 'assets/frames';
const ICONS = 'assets/cards/raw';

export class Renderer {
  constructor(game) {
    this.game = game;
    this.nodes = new Map();      // entityId -> DOM
    this.handNodes = [];         // 玩家手牌 DOM（顺序对应 hand 数组）
    this.applyHandScale();
    window.addEventListener('resize', () => this.applyHandScale());
    this.buildLayout();
  }

  applyHandScale() {
    const s = Math.min(1, innerHeight / 950);
    document.documentElement.style.setProperty('--hand-scale', s.toFixed(3));
  }

  buildLayout() {
    const root = document.getElementById('board-root');
    root.innerHTML = '';

    el('div', 'board-bg', root);
    this.table = el('div', 'play-table', root);

    this.battlefield = el('div', 'battlefield', this.table);
    this.rowEnemy = el('div', 'board-row enemy', this.battlefield);
    this.rowPlayer = el('div', 'board-row player', this.battlefield);

    // 英雄区
    this.heroZoneEnemy = el('div', 'hero-zone enemy', this.table);
    this.heroZonePlayer = el('div', 'hero-zone player', this.table);

    const gp2 = this.game.players.p2;
    const gp1 = this.game.players.p1;

    this.heroEls = {
      p2: heroDOM(gp2.hero, gp2.hero.power),
      p1: heroDOM(gp1.hero, gp1.hero.power),
    };
    this.powerEls = {
      p2: heroPowerDOM(gp2.hero.power),
      p1: heroPowerDOM(gp1.hero.power),
    };
    this.heroZoneEnemy.append(this.heroEls.p2, this.powerEls.p2);
    this.heroZonePlayer.append(this.heroEls.p1, this.powerEls.p1);
    this.nodes.set(gp2.hero.id, this.heroEls.p2);
    this.nodes.set(gp1.hero.id, this.heroEls.p1);

    // 对手手牌（卡背扇形）
    this.enemyHand = el('div', 'enemy-hand', this.table);

    // 侧边：牌库 + 法力
    this.sideEnemy = el('div', 'side-panel enemy', this.table);
    this.sidePlayer = el('div', 'side-panel player', this.table);

    this.deckEls = { p2: this.buildDeckPile(this.sideEnemy), p1: null };
    this.manaEls = { p2: this.buildManaBar(this.sideEnemy, true), p1: null };
    this.manaEls.p1 = this.buildManaBar(this.sidePlayer, false);
    this.deckEls.p1 = this.buildDeckPile(this.sidePlayer);

    // 结束回合按钮
    this.endTurnBtn = el('button', 'end-turn-btn', this.table);
    this.endTurnBtn.textContent = '结束回合';

    // 玩家手牌
    this.handZone = el('div', 'hand-zone', this.table);

    this.updateAll();
  }

  buildDeckPile(parent) {
    const pile = el('div', 'deck-pile', parent);
    const img = el('img', null, pile);
    img.src = `${ICONS}/deck.svg`;
    const count = el('div', 'count', pile);
    count.textContent = '30';
    return pile;
  }

  buildManaBar(parent, isEnemy) {
    const bar = el('div', `mana-bar ${isEnemy ? 'enemy-mana' : ''}`, parent);
    const text = el('div', 'mana-text', bar);
    const crystals = el('div', 'crystals', bar);
    for (let i = 0; i < 10; i++) {
      const c = el('div', 'crystal empty', crystals);
      const img = el('img', null, c);
      img.src = `${FRAMES}/gem_mana.svg`;
    }
    return bar;
  }

  // ---------- 同步 ----------
  updateAll() {
    for (const side of ['p1', 'p2']) {
      this.syncBoard(side);
      this.syncHero(side);
      this.syncMana(side);
      this.syncDeck(side);
    }
    this.syncHand();
    this.syncEnemyHand();
  }

  syncBoard(side) {
    const row = side === 'p1' ? this.rowPlayer : this.rowEnemy;
    const board = this.game.players[side].board;
    const wanted = board.map(m => {
      let node = this.nodes.get(m.id);
      if (!node) {
        node = minionDOM(this.game.snap(m));
        this.nodes.set(m.id, node);
      } else {
        updateMinionDOM(node, this.game.snap(m));
      }
      return node;
    });
    // 移除多余节点
    for (const child of [...row.children]) {
      if (!wanted.includes(child) && !child.classList.contains('drop-slot')) child.remove();
    }
    // 依序放置
    wanted.forEach((node, i) => {
      if (row.children[i] !== node) row.insertBefore(node, row.children[i] || null);
    });
  }

  syncHero(side) {
    updateHeroDOM(this.heroEls[side], this.game.players[side].hero);
  }

  syncMana(side) {
    const p = this.game.players[side];
    const bar = this.manaEls[side];
    bar.querySelector('.mana-text').textContent = `${p.mana}/${p.maxMana}`;
    const crystals = bar.querySelectorAll('.crystal');
    crystals.forEach((c, i) => {
      c.style.display = i < p.maxMana ? '' : 'none';
      c.classList.toggle('empty', i >= p.mana);
    });
  }

  syncDeck(side) {
    this.deckEls[side].querySelector('.count').textContent = this.game.players[side].deck.length;
  }

  syncHand() {
    const hand = this.game.players.p1.hand;
    this.handZone.innerHTML = '';
    this.handNodes = [];
    const n = hand.length;
    hand.forEach((cardId, i) => {
      const wrap = el('div', 'hand-card', this.handZone);
      wrap.dataset.handIndex = i;
      const card = cardDOM(cardId);
      wrap.appendChild(card);
      const mid = (n - 1) / 2;
      const off = i - mid;
      const rot = off * (n > 6 ? 4.5 : 6);
      const lift = Math.abs(off) * Math.abs(off) * (n > 6 ? 3.2 : 4.5);
      wrap.style.transform = `rotate(${rot}deg) translateY(${lift}px)`;
      wrap.style.zIndex = 10 + i;
      this.handNodes.push(wrap);
    });
  }

  syncEnemyHand() {
    const n = this.game.players.p2.hand.length;
    this.enemyHand.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const cb = cardBackDOM();
      const mid = (n - 1) / 2;
      const off = i - mid;
      cb.style.transform = `rotate(${off * -5}deg) translateY(${Math.abs(off) * Math.abs(off) * 2.5}px)`;
      this.enemyHand.appendChild(cb);
    }
  }

  // ---------- 高亮辅助 ----------
  clearHighlights() {
    document.querySelectorAll('.targetable').forEach(n => n.classList.remove('targetable'));
    document.querySelectorAll('.can-attack').forEach(n => n.classList.remove('can-attack'));
    document.querySelectorAll('.card.playable').forEach(n => n.classList.remove('playable'));
    this.powerEls.p1.classList.remove('usable-glow');
  }

  highlightActionables() {
    this.clearHighlights();
    if (this.game.over || this.game.turn !== 'p1') return;
    // 可出的牌
    this.handNodes.forEach((wrap, i) => {
      const req = this.game.playRequirements('p1', i);
      if (req.playable) wrap.querySelector('.card').classList.add('playable');
    });
    // 可攻击的随从与英雄
    const p = this.game.players.p1;
    for (const m of [...p.board, p.hero]) {
      const info = this.game.attackInfo(m.id);
      if (info.can) this.nodes.get(m.id)?.classList.add('can-attack');
    }
    // 英雄技能
    if (this.game.powerRequirements('p1').usable) {
      this.powerEls.p1.classList.add('usable-glow');
      this.powerEls.p1.classList.remove('used', 'unusable');
    } else {
      this.powerEls.p1.classList.add(this.game.players.p1.hero.powerUsed ? 'used' : 'unusable');
    }
  }

  markTargets(targetIds) {
    for (const id of targetIds) this.nodes.get(id)?.classList.add('targetable');
  }

  clearTargets() {
    document.querySelectorAll('.targetable').forEach(n => n.classList.remove('targetable'));
  }

  centerOf(node) {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  entityCenter(id) {
    const node = this.nodes.get(id);
    return node ? this.centerOf(node) : { x: innerWidth / 2, y: innerHeight / 2 };
  }
}
