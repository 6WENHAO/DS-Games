import { ITEMS, RECIPES, BUILDINGS } from '../systems/items.js';

// UI 层：HUD/菜单/物品栏/合成/建筑手册
export class UI {
  constructor(doc) {
    this.d = doc;

    // 屏幕引用
    this.titleScreen = doc.getElementById('title-screen');
    this.deathScreen = doc.getElementById('death-screen');
    this.pauseScreen = doc.getElementById('pause-screen');
    this.hud = doc.getElementById('hud');
    this.inventoryScreen = doc.getElementById('inventory-screen');
    this.craftingScreen = doc.getElementById('crafting-screen');
    this.bookScreen = doc.getElementById('book-screen');

    this.loadStatus = doc.getElementById('load-status');

    // HUD 组件
    this.crosshair = doc.getElementById('crosshair');
    this.interactPrompt = doc.getElementById('interact-prompt');
    this.notifyArea = doc.getElementById('notify-area');
    this.hotbar = doc.getElementById('hotbar');
    this.clockText = doc.getElementById('clock-text');
    this.damageVignette = doc.getElementById('damage-vignette');

    // 状态条
    this.bars = {
      health: doc.getElementById('bar-health'),
      stamina: doc.getElementById('bar-stamina'),
      hunger: doc.getElementById('bar-hunger'),
      thirst: doc.getElementById('bar-thirst'),
      energy: doc.getElementById('bar-energy'),
    };

    this._notifyQueue = [];
    this._notifyTimer = 0;
  }

  // ---- 通知 ----
  notify(msg) {
    const el = this.d.createElement('div');
    el.className = 'notify';
    el.textContent = msg;
    el.addEventListener('animationend', () => el.remove());
    this.notifyArea.appendChild(el);
  }

  // ---- 时钟 ----
  setClock(text) { this.clockText.textContent = text; }

  // ---- 状态条 ----
  updateBars(survival) {
    this.bars.health.style.width = `${survival.health}%`;
    this.bars.stamina.style.width = `${survival.stamina.value}%`;
    this.bars.hunger.style.width = `${survival.hunger}%`;
    this.bars.thirst.style.width = `${survival.thirst}%`;
    this.bars.energy.style.width = `${survival.energy}%`;
  }

  // ---- 交互提示 ----
  showPrompt(text) {
    this.interactPrompt.textContent = text;
    this.interactPrompt.classList.remove('hidden');
  }
  hidePrompt() { this.interactPrompt.classList.add('hidden'); }

  // ---- 伤害视觉效果 ----
  damageFlash() {
    this.damageVignette.style.opacity = '0.7';
    setTimeout(() => { this.damageVignette.style.opacity = '0'; }, 300);
  }

  // ---- 快捷栏 ----
  renderHotbar(hotbarItems, equipped, onEquip) {
    this.hotbar.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const id = hotbarItems[i];
      const slot = this.d.createElement('div');
      slot.className = 'hotslot' + (id === equipped ? ' active' : '');
      const key = this.d.createElement('div');
      key.className = 'key';
      key.textContent = String(i + 1);
      slot.appendChild(key);
      if (id) {
        const def = ITEMS[id];
        const img = this.d.createElement('img');
        img.src = `assets/icons/${def.icon}`;
        img.title = def.name;
        slot.appendChild(img);
        const count = this.d.createElement('div');
        count.className = 'count';
        count.textContent = 'x' + String(this._inv?.count?.(id) ?? 0);
        slot.appendChild(count);
        slot.addEventListener('click', () => onEquip(id));
      }
      this.hotbar.appendChild(slot);
    }
    this._hotbarItems = hotbarItems;
    this._onEquip = onEquip;
  }

  refreshHotbarCounts(inventory) {
    if (!this._hotbarItems) return;
    this.renderHotbar(this._hotbarItems, inventory.equipped, this._onEquip);
    this._inv = inventory;
  }

  // ---- 物品栏 ----
  renderInventory(inventory, onEquip, onUse) {
    this._inv = inventory;
    const grid = this.d.getElementById('inventory-grid');
    grid.innerHTML = '';
    for (const [id, def] of Object.entries(ITEMS)) {
      const count = inventory.count(id);
      if (count <= 0 && !def.equip) continue;
      const slot = this.d.createElement('div');
      slot.className = 'inv-slot' + (inventory.equipped === id ? ' equipped' : '');
      const img = this.d.createElement('img');
      img.src = `assets/icons/${def.icon}`;
      slot.appendChild(img);
      if (count > 0) {
        const cnt = this.d.createElement('div');
        cnt.className = 'count';
        cnt.textContent = String(count);
        slot.appendChild(cnt);
      }
      const name = this.d.createElement('div');
      name.className = 'name';
      name.textContent = def.name;
      slot.appendChild(name);
      slot.addEventListener('click', () => {
        if (def.equip) onEquip(id);
        else if (def.use && def.use !== 'none') onUse(id);
      });
      grid.appendChild(slot);
    }
  }

  // ---- 合成 ----
  renderCrafting(inventory, onCraft) {
    const list = this.d.getElementById('crafting-list');
    list.innerHTML = '';
    for (const r of RECIPES) {
      const div = this.d.createElement('div');
      div.className = 'recipe' + (inventory.has(r.cost) ? '' : ' locked');
      const img = this.d.createElement('img');
      img.src = `assets/icons/${r.icon}`;
      const nameDiv = this.d.createElement('div');
      nameDiv.className = 'r-name';
      const b = this.d.createElement('b');
      b.textContent = ITEMS[r.out].name;
      nameDiv.appendChild(b);
      const span = this.d.createElement('span');
      span.textContent = ITEMS[r.out].desc;
      nameDiv.appendChild(span);
      const costDiv = this.d.createElement('div');
      costDiv.className = 'r-cost';
      costDiv.textContent = Object.entries(r.cost).map(([id, n]) => `${ITEMS[id].name} ×${n}`).join(' / ');
      div.append(img, nameDiv, costDiv);
      if (inventory.has(r.cost)) {
        div.addEventListener('click', () => onCraft(r));
      }
      list.appendChild(div);
    }
  }

  // ---- 建筑手册 ----
  renderBuildings(inventory, onSelect) {
    const list = this.d.getElementById('building-list');
    list.innerHTML = '';
    for (const b of BUILDINGS) {
      const div = this.d.createElement('div');
      div.className = 'blueprint' + (inventory.has(b.cost) ? '' : ' locked');
      const img = this.d.createElement('img');
      img.src = `assets/icons/${b.icon}`;
      const nameDiv = this.d.createElement('div');
      nameDiv.className = 'r-name';
      const bb = this.d.createElement('b');
      bb.textContent = b.name;
      nameDiv.appendChild(bb);
      const span = this.d.createElement('span');
      span.textContent = b.desc;
      nameDiv.appendChild(span);
      const costDiv = this.d.createElement('div');
      costDiv.className = 'r-cost';
      costDiv.textContent = Object.entries(b.cost).map(([id, n]) => `${ITEMS[id].name} ×${n}`).join(' / ');
      div.append(img, nameDiv, costDiv);
      if (inventory.has(b.cost)) {
        div.addEventListener('click', () => onSelect(b));
      }
      list.appendChild(div);
    }
  }

  // ---- 界面切换 ----
  isAnyOpen() {
    return !this.inventoryScreen.classList.contains('hidden')
      || !this.craftingScreen.classList.contains('hidden')
      || !this.bookScreen.classList.contains('hidden')
      || !this.pauseScreen.classList.contains('hidden')
      || !this.titleScreen.classList.contains('hidden')
      || !this.deathScreen.classList.contains('hidden');
  }

  hideAllPanels() {
    [this.inventoryScreen, this.craftingScreen, this.bookScreen, this.pauseScreen].forEach((el) => {
      el.classList.add('hidden');
    });
  }

  showDeath(cause) {
    this.deathScreen.classList.remove('hidden');
    this.d.getElementById('death-cause').textContent = cause;
  }

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
  }

  hideTitle() {
    this.titleScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }
}
