// ==== 交互：拖拽出牌 / 攻击瞄准 / 英雄技能 / 悬停预览 ====
import { cardDOM, el } from './cardview.js';
import { sound } from '../audio/sound.js';
import { getCard } from '../data/cards.js';

export class Interactions {
  constructor(game, renderer, fx, animator, hooks) {
    this.game = game;
    this.renderer = renderer;
    this.fx = fx;
    this.animator = animator;
    this.hooks = hooks; // { afterAction(), onEndTurn() }
    this.mode = 'idle';
    this.drag = null;
    this.preview = null;
    this.bind();
  }

  get locked() {
    return this.animator.busy || this.game.over || this.game.turn !== 'p1';
  }

  bind() {
    const R = this.renderer;

    document.addEventListener('mousedown', e => this.onMouseDown(e));
    document.addEventListener('mousemove', e => this.onMouseMove(e));
    document.addEventListener('mouseup', e => this.onMouseUp(e));
    document.addEventListener('contextmenu', e => {
      if (this.mode !== 'idle') { e.preventDefault(); this.cancel(); }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.cancel();
    });

    R.endTurnBtn.addEventListener('click', () => {
      if (this.locked) return;
      sound.play('click', 0.6);
      this.cancel();
      this.hooks.onEndTurn();
    });

    R.powerEls.p1.addEventListener('click', () => {
      if (this.locked || this.mode !== 'idle') return;
      const req = this.game.powerRequirements('p1');
      if (!req.usable) { this.deny(req.reason); return; }
      if (req.needsTarget) {
        this.mode = 'powerTarget';
        this.targets = req.targets;
        R.markTargets(req.targets);
        const c = R.centerOf(R.powerEls.p1);
        this.fx.showArrow(c, c);
      } else {
        this.commit(this.game.useHeroPower('p1', null));
      }
    });

    // 悬停预览（战场随从）
    document.addEventListener('mouseover', e => {
      const m = e.target.closest?.('.minion');
      if (m && m.dataset.cardId && this.mode === 'idle') this.showPreview(m);
      else if (!m) this.hidePreview();
    });
  }

  // ---------- 预览 ----------
  showPreview(minionNode) {
    this.hidePreview();
    const rect = minionNode.getBoundingClientRect();
    const card = cardDOM(minionNode.dataset.cardId);
    card.classList.add('card-preview');
    const onLeft = rect.left > innerWidth / 2;
    card.style.left = (onLeft ? rect.left - 210 : rect.right + 80) + 'px';
    card.style.top = Math.max(100, Math.min(innerHeight - 300, rect.top - 60)) + 'px';
    document.getElementById('overlay-root').appendChild(card);
    this.preview = card;
  }

  hidePreview() {
    if (this.preview) { this.preview.remove(); this.preview = null; }
  }

  // ---------- 主要事件 ----------
  onMouseDown(e) {
    if (e.button === 2) return;

    // 瞄准模式中的点击 → 选定目标
    if (this.mode === 'powerTarget' || this.mode === 'battlecryTarget') {
      const id = this.entityAt(e);
      if (id != null && this.targets.includes(id)) {
        if (this.mode === 'powerTarget') {
          this.exitTargeting();
          this.commit(this.game.useHeroPower('p1', id));
        } else {
          const { handIndex, boardPos } = this.pending;
          this.exitTargeting();
          this.commit(this.game.playCard('p1', handIndex, boardPos, id));
        }
      } else {
        this.cancel();
      }
      return;
    }

    if (this.locked) return;

    // 手牌拖拽
    const handCard = e.target.closest?.('.hand-card');
    if (handCard) {
      const idx = parseInt(handCard.dataset.handIndex, 10);
      const req = this.game.playRequirements('p1', idx);
      if (!req.playable) { this.deny(req.reason); return; }
      this.hidePreview();
      const cardId = this.game.players.p1.hand[idx];
      const card = getCard(cardId);
      this.mode = 'dragCard';
      this.drag = { idx, cardId, card, req, ghost: null, slot: null };
      handCard.classList.add('dragging');
      this.drag.handNode = handCard;
      const ghost = cardDOM(cardId);
      ghost.classList.add('drag-ghost');
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';
      document.getElementById('overlay-root').appendChild(ghost);
      this.drag.ghost = ghost;
      if (card.type === 'spell' && req.needsTarget) {
        this.renderer.markTargets(req.targets);
      }
      e.preventDefault();
      return;
    }

    // 攻击拖拽（己方随从 / 英雄）
    const attackerId = this.entityAt(e);
    if (attackerId != null) {
      const ent = this.game.getEntity(attackerId);
      if (ent && ent.side === 'p1') {
        const info = this.game.attackInfo(attackerId);
        if (info.can) {
          this.mode = 'attackDrag';
          this.targets = info.targets;
          this.attackerId = attackerId;
          this.renderer.markTargets(info.targets);
          this.fx.showArrow(this.renderer.entityCenter(attackerId), { x: e.clientX, y: e.clientY });
          this.hidePreview();
          e.preventDefault();
        }
      }
    }
  }

  onMouseMove(e) {
    const pos = { x: e.clientX, y: e.clientY };
    if (this.mode === 'attackDrag' || this.mode === 'powerTarget' || this.mode === 'battlecryTarget') {
      this.fx.moveArrow(pos);
      return;
    }
    if (this.mode !== 'dragCard' || !this.drag) return;

    const { ghost, card, req } = this.drag;
    ghost.style.left = pos.x + 'px';
    ghost.style.top = pos.y + 'px';

    if (card.type === 'spell' && req.needsTarget) {
      // 拖到目标上：箭头样式改为直接高亮，不需要额外处理
      return;
    }
    if (card.type === 'minion') {
      const overBoard = this.isOverPlayerRow(e);
      ghost.classList.toggle('shrink', overBoard);
      this.updateDropSlot(overBoard ? e.clientX : null);
    }
  }

  onMouseUp(e) {
    if (this.mode === 'attackDrag') {
      const id = this.entityAt(e);
      this.fx.hideArrow();
      this.renderer.clearTargets();
      const attackerId = this.attackerId;
      this.mode = 'idle';
      if (id != null && this.targets.includes(id)) {
        this.commit(this.game.attack(attackerId, id));
      }
      return;
    }

    if (this.mode !== 'dragCard' || !this.drag) return;
    const { idx, card, req } = this.drag;

    if (card.type === 'spell') {
      const overTable = this.isOverBattlefield(e) || this.isOverPlayerRow(e);
      if (req.needsTarget) {
        const id = this.entityAt(e);
        this.endDrag();
        if (id != null && req.targets.includes(id)) {
          this.commit(this.game.playCard('p1', idx, null, id));
        }
      } else {
        this.endDrag();
        if (overTable) this.commit(this.game.playCard('p1', idx, null, null));
      }
      return;
    }

    // 随从
    if (this.isOverPlayerRow(e)) {
      const boardPos = this.slotIndex(e.clientX);
      if (req.needsTarget) {
        // 进入战吼目标选择
        const dropPoint = { x: e.clientX, y: e.clientY };
        this.endDrag(true);
        this.mode = 'battlecryTarget';
        this.targets = req.targets;
        this.pending = { handIndex: idx, boardPos };
        this.renderer.markTargets(req.targets);
        this.fx.showArrow(dropPoint, dropPoint);
        return;
      }
      this.endDrag();
      this.commit(this.game.playCard('p1', idx, boardPos, null));
    } else {
      this.endDrag();
    }
  }

  // ---------- 辅助 ----------
  entityAt(e) {
    const node = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.minion, .hero');
    if (!node) return null;
    const id = parseInt(node.dataset.entityId, 10);
    return Number.isNaN(id) ? null : id;
  }

  isOverPlayerRow(e) {
    const r = this.renderer.rowPlayer.getBoundingClientRect();
    return e.clientX >= r.left - 30 && e.clientX <= r.right + 30 &&
           e.clientY >= r.top - 24 && e.clientY <= r.bottom + 24;
  }

  isOverBattlefield(e) {
    const r = this.renderer.battlefield.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right &&
           e.clientY >= r.top - 40 && e.clientY <= r.bottom + 40;
  }

  slotIndex(mouseX) {
    const row = this.renderer.rowPlayer;
    const minions = [...row.querySelectorAll('.minion')];
    let idx = minions.length;
    for (let i = 0; i < minions.length; i++) {
      const r = minions[i].getBoundingClientRect();
      if (mouseX < r.left + r.width / 2) { idx = i; break; }
    }
    return idx;
  }

  updateDropSlot(mouseX) {
    const row = this.renderer.rowPlayer;
    row.querySelectorAll('.drop-slot').forEach(n => n.remove());
    if (mouseX == null) return;
    const idx = this.slotIndex(mouseX);
    const slot = el('div', 'drop-slot');
    const minions = [...row.querySelectorAll('.minion')];
    row.insertBefore(slot, minions[idx] || null);
  }

  endDrag(keepNothing) {
    if (!this.drag) return;
    this.drag.ghost?.remove();
    this.drag.handNode?.classList.remove('dragging');
    this.renderer.rowPlayer.querySelectorAll('.drop-slot').forEach(n => n.remove());
    if (!keepNothing) this.renderer.clearTargets();
    this.drag = null;
    this.mode = 'idle';
  }

  exitTargeting() {
    this.fx.hideArrow();
    this.renderer.clearTargets();
    this.mode = 'idle';
    this.targets = null;
    this.pending = null;
  }

  cancel() {
    if (this.mode === 'dragCard') this.endDrag();
    if (this.mode === 'attackDrag' || this.mode === 'powerTarget' || this.mode === 'battlecryTarget') {
      this.exitTargeting();
    }
    this.renderer.syncHand();
    this.renderer.highlightActionables();
  }

  deny(reason) {
    sound.play('error', 0.5);
    this.animator.toast(reason || '不能这样做');
  }

  async commit(result) {
    if (!result.ok) { this.deny(result.reason); this.renderer.syncHand(); return; }
    this.renderer.clearHighlights();
    await this.animator.play(result.events);
    this.hooks.afterAction();
  }
}
