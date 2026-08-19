/* =====================================================================
 * HUD — 快捷栏、生命/饥饿/氧气/经验、准星、提示气泡
 * ===================================================================== */
import { fillSlot, displayName } from './ItemIcons.js';
import { HOTBAR_SIZE } from '../game/Inventory.js';
import { bus, EV } from '../core/EventBus.js';
import { GAMEMODE } from '../core/Constants.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.hotbarEl = document.getElementById('hotbar');
    this.healthEl = document.getElementById('health-bar');
    this.foodEl = document.getElementById('food-bar');
    this.airEl = document.getElementById('air-bar');
    this.armorEl = document.getElementById('armor-bar');
    this.xpFill = document.getElementById('xp-fill');
    this.xpLevel = document.getElementById('xp-level');
    this.tooltip = document.getElementById('hotbar-tooltip');
    this.toastArea = document.getElementById('toast-area');
    this.slots = [];

    this._buildHotbar();
    this._last = { health: -1, food: -1, air: -1, xp: -1, level: -1, sel: -1, mode: '' };
    this._tooltipTimer = 0;

    bus.on(EV.INVENTORY_CHANGED, () => this.refreshHotbar());
    bus.on(EV.HOTBAR_CHANGED, () => { this.refreshHotbar(); this.showItemName(); });
    bus.on(EV.TOAST, (text) => this.toast(text));
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  _buildHotbar() {
    this.hotbarEl.innerHTML = '';
    this.slots = [];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.index = i;
      this.hotbarEl.appendChild(el);
      this.slots.push(el);
    }
  }

  refreshHotbar() {
    const inv = this.game.inventory;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = this.slots[i];
      fillSlot(el, inv.get(i));
      el.classList.toggle('selected', i === inv.selected);
    }
  }

  showItemName() {
    const stack = this.game.inventory.selectedStack;
    if (!stack) { this.tooltip.style.opacity = '0'; return; }
    this.tooltip.textContent = displayName(stack.item);
    this.tooltip.style.opacity = '1';
    this._tooltipTimer = 1.8;
  }

  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toastArea.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .4s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 420);
    }, 1400);
    while (this.toastArea.children.length > 4) this.toastArea.firstChild.remove();
  }

  update(dt) {
    const p = this.game.player;

    if (this._tooltipTimer > 0) {
      this._tooltipTimer -= dt;
      if (this._tooltipTimer <= 0) this.tooltip.style.opacity = '0';
    }

    const survival = p.gamemode === GAMEMODE.SURVIVAL;
    if (this._last.mode !== p.gamemode) {
      this._last.mode = p.gamemode;
      const disp = survival ? 'flex' : 'none';
      this.healthEl.style.display = disp;
      this.foodEl.style.display = disp;
      this.armorEl.style.display = 'none';
      this._last.health = -1; this._last.food = -1; this._last.air = -1;
      document.getElementById('xp-bar').style.display = survival ? 'block' : 'none';
    }
    if (!survival) { this.airEl.style.display = 'none'; return; }

    // 生命
    const hp = Math.ceil(p.health);
    if (hp !== this._last.health) {
      this._last.health = hp;
      this._renderHearts(hp, p.maxHealth);
    }
    // 饥饿
    const food = Math.ceil(p.food);
    if (food !== this._last.food) {
      this._last.food = food;
      this._renderIcons(this.foodEl, Math.ceil(food / 2), 10, 'hunger');
    }
    // 氧气
    const bubbles = p.air < p.maxAir ? Math.ceil((p.air / p.maxAir) * 10) : 0;
    if (bubbles !== this._last.air) {
      this._last.air = bubbles;
      this.airEl.style.display = bubbles > 0 ? 'flex' : 'none';
      this._renderIcons(this.airEl, bubbles, 10, 'bubble');
    }
    // 经验
    const ratio = p.xp / p.xpNeeded;
    if (Math.abs(ratio - this._last.xp) > 0.01 || p.xpLevel !== this._last.level) {
      this._last.xp = ratio; this._last.level = p.xpLevel;
      this.xpFill.style.width = Math.min(100, ratio * 100) + '%';
      this.xpLevel.textContent = p.xpLevel > 0 ? String(p.xpLevel) : '';
    }
  }

  _renderHearts(hp, maxHp) {
    const el = this.healthEl;
    el.innerHTML = '';
    const total = Math.ceil(maxHp / 2);
    for (let i = 0; i < total; i++) {
      const wrap = document.createElement('div');
      wrap.className = 'icon';
      wrap.style.background = 'none';
      const bg = document.createElement('div');
      bg.className = 'heart-shape heart-bg';
      bg.style.position = 'absolute';
      wrap.style.position = 'relative';
      wrap.appendChild(bg);
      const value = hp - i * 2;
      if (value >= 2) {
        const full = document.createElement('div');
        full.className = 'heart-shape heart-full';
        full.style.position = 'absolute';
        wrap.appendChild(full);
      } else if (value === 1) {
        const half = document.createElement('div');
        half.className = 'heart-shape heart-half';
        half.style.position = 'absolute';
        wrap.appendChild(half);
      }
      el.appendChild(wrap);
    }
  }

  _renderIcons(el, filled, total, cls) {
    el.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const d = document.createElement('div');
      d.className = cls + (i < filled ? '' : ' empty');
      if (cls === 'bubble' && i >= filled) d.classList.add('pop');
      el.appendChild(d);
    }
  }
}
