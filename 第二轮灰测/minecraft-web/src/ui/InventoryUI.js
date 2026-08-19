/* =====================================================================
 * InventoryUI — 物品栏 / 创造模式目录 / 3×3 合成 / 配方书 / 熔炼
 * ===================================================================== */
import { fillSlot, makeIcon, displayName, iconUrl } from './ItemIcons.js';
import { HOTBAR_SIZE, TOTAL_SIZE } from '../game/Inventory.js';
import { creativeItemsByGroup, getItem, itemMaxStack } from '../data/items.js';
import { CREATIVE_GROUPS, blockByName } from '../data/blocks.js';
import { RECIPES, SMELTING, matchRecipe, canCraft, recipeIngredients } from '../data/recipes.js';
import { bus, EV } from '../core/EventBus.js';

const FUELS = ['coal', 'charcoal', 'oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks',
  'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'stick', 'coal_block'];

export class InventoryUI {
  constructor(game) {
    this.game = game;
    this.screen = document.getElementById('screen-inventory');
    this.tabsEl = document.getElementById('inv-tabs');
    this.catalogEl = document.getElementById('inv-catalog');
    this.titleEl = document.getElementById('inv-title');
    this.craftEl = document.getElementById('craft-grid');
    this.craftOutEl = document.getElementById('craft-out');
    this.craftHintEl = document.getElementById('craft-hint');
    this.recipeEl = document.getElementById('recipe-list');
    this.mainEl = document.getElementById('inv-main');
    this.hotEl = document.getElementById('inv-hot');
    this.ghostEl = document.getElementById('drag-ghost');
    this.tooltipEl = document.getElementById('item-tooltip');

    this.open = false;
    this.mode = 'creative';
    this.group = 'building';
    this.craftSlots = [];
    this.mainSlots = [];
    this.hotSlots = [];
    this._built = false;

    this._onMove = (e) => this._moveGhost(e);
    window.addEventListener('mousemove', this._onMove);
    bus.on(EV.INVENTORY_CHANGED, () => { if (this.open) this.refresh(); });
  }

  /* ---------------- 构建 DOM ---------------- */
  _build() {
    if (this._built) return;
    this._built = true;

    // 合成网格
    this.craftEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const el = this._makeSlot('craft', i);
      this.craftEl.appendChild(el);
      this.craftSlots.push(el);
    }
    // 输出槽
    this.craftOutEl.innerHTML = '';
    this.outSlot = document.createElement('div');
    this.outSlot.className = 'slot';
    this.outSlot.addEventListener('click', (e) => this._clickOutput(e.shiftKey));
    this.outSlot.addEventListener('mouseenter', () => this._showTooltip(this.game.inventory.craftOutput));
    this.outSlot.addEventListener('mouseleave', () => this._hideTooltip());
    this.craftOutEl.appendChild(this.outSlot);

    // 主背包 + 快捷栏
    this.mainEl.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < TOTAL_SIZE; i++) {
      const el = this._makeSlot('inv', i);
      this.mainEl.appendChild(el);
      this.mainSlots.push(el);
    }
    this.hotEl.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = this._makeSlot('inv', i);
      this.hotEl.appendChild(el);
      this.hotSlots.push(el);
    }
  }

  _makeSlot(list, index) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.dataset.list = list;
    el.dataset.index = index;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const inv = this.game.inventory;
      if (e.button === 0) inv.clickSlot(list, index, e.shiftKey);
      else if (e.button === 2) inv.rightClickSlot(list, index);
      this.refresh();
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('mouseenter', () => {
      const arr = list === 'craft' ? this.game.inventory.craft : this.game.inventory.slots;
      this._showTooltip(arr[index]);
    });
    el.addEventListener('mouseleave', () => this._hideTooltip());
    return el;
  }

  /* ---------------- 打开 / 关闭 ---------------- */
  show(mode = null) {
    this._build();
    if (mode === 'craft') this.mode = this.game.player.isCreative ? 'creative' : 'recipes';
    else if (mode === 'smelt') this.mode = 'smelt';
    else this.mode = this.game.player.isCreative ? 'creative' : 'recipes';
    this.open = true;
    this.screen.classList.remove('hidden');
    this._buildTabs();
    this.refresh();
  }

  hide() {
    this.open = false;
    this.screen.classList.add('hidden');
    this._hideTooltip();
    // 归还光标物品与合成网格
    const inv = this.game.inventory;
    if (inv.cursor) {
      const left = inv.add(inv.cursor.item, inv.cursor.count);
      if (left > 0) this._dropToWorld(inv.cursor.item, left);
      inv.cursor = null;
    }
    for (let i = 0; i < 9; i++) {
      const s = inv.craft[i];
      if (!s) continue;
      const left = inv.add(s.item, s.count);
      if (left > 0) this._dropToWorld(s.item, left);
      inv.craft[i] = null;
    }
    this.ghostEl.style.display = 'none';
  }

  _dropToWorld(item, count) {
    const p = this.game.player;
    this.game.entities.dropItem(p.position[0], p.position[1] + 1, p.position[2], item, count);
  }

  toggle() { this.open ? this.hide() : this.show(); }

  /* ---------------- 标签 ---------------- */
  _buildTabs() {
    this.tabsEl.innerHTML = '';
    const creative = this.game.player.isCreative;
    const tabs = [];
    if (creative) {
      for (const g of CREATIVE_GROUPS) tabs.push({ key: 'group:' + g.key, label: g.label });
    }
    tabs.push({ key: 'recipes', label: '配方书' });
    tabs.push({ key: 'smelt', label: '熔炼' });

    for (const t of tabs) {
      const el = document.createElement('div');
      el.className = 'inv-tab';
      el.textContent = t.label;
      const active = (t.key === 'group:' + this.group && this.mode === 'creative') ||
        (t.key === this.mode);
      if (active) el.classList.add('active');
      el.addEventListener('click', () => {
        if (t.key.startsWith('group:')) {
          this.mode = 'creative';
          this.group = t.key.slice(6);
        } else {
          this.mode = t.key;
        }
        this._buildTabs();
        this.refresh();
      });
      this.tabsEl.appendChild(el);
    }
  }

  /* ---------------- 刷新 ---------------- */
  refresh() {
    if (!this.open) return;
    const inv = this.game.inventory;

    // 合成结果
    const grid = inv.craft.map(s => s ? s.item : null);
    const match = matchRecipe(grid);
    inv.craftOutput = match ? { item: match.out, count: match.count } : null;
    this._matched = match;

    for (let i = 0; i < 9; i++) fillSlot(this.craftSlots[i], inv.craft[i]);
    fillSlot(this.outSlot, inv.craftOutput);
    this.craftHintEl.textContent = match
      ? `可合成: ${displayName(match.out)} × ${match.count}（点击取出，Shift 全部合成）`
      : '把材料按配方摆进 3×3 网格，或在右侧配方书里一键合成';

    for (let i = 0; i < this.mainSlots.length; i++) fillSlot(this.mainSlots[i], inv.get(i + HOTBAR_SIZE));
    for (let i = 0; i < this.hotSlots.length; i++) {
      fillSlot(this.hotSlots[i], inv.get(i));
      this.hotSlots[i].classList.toggle('selected', i === inv.selected);
    }

    // 左侧目录
    if (this.mode === 'creative') this._renderCreative();
    else if (this.mode === 'recipes') this._renderRecipes();
    else this._renderSmelting();

    // 配方书（右侧小格）
    this._renderRecipeBook();

    // 光标幽灵
    const cur = inv.cursor;
    if (cur) {
      this.ghostEl.style.display = 'block';
      this.ghostEl.innerHTML = '';
      this.ghostEl.appendChild(makeIcon(cur.item));
      if (cur.count > 1) {
        const c = document.createElement('span');
        c.className = 'item-count';
        c.textContent = cur.count;
        this.ghostEl.appendChild(c);
      }
    } else {
      this.ghostEl.style.display = 'none';
    }
  }

  _renderCreative() {
    const g = CREATIVE_GROUPS.find(x => x.key === this.group);
    this.titleEl.textContent = '创造模式物品栏 · ' + (g ? g.label : this.group);
    const groups = creativeItemsByGroup();
    const names = groups.get(this.group) || [];
    this.catalogEl.innerHTML = '';
    for (const name of names) {
      const el = document.createElement('div');
      el.className = 'slot';
      const item = getItem(name);
      fillSlot(el, { item: name, count: 1 });
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const inv = this.game.inventory;
        const n = e.button === 2 ? 1 : itemMaxStack(name);
        if (inv.cursor && inv.cursor.item === name) {
          inv.cursor.count = Math.min(itemMaxStack(name), inv.cursor.count + n);
        } else {
          inv.cursor = { item: name, count: n, dura: item?.durability || 0 };
        }
        this.refresh();
      });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('mouseenter', () => this._showTooltip({ item: name, count: 1 }));
      el.addEventListener('mouseleave', () => this._hideTooltip());
      this.catalogEl.appendChild(el);
    }
  }

  _renderRecipes() {
    this.titleEl.textContent = '配方书 · 点击即可合成（材料取自背包）';
    const have = this.game.inventory.tally();
    this.catalogEl.innerHTML = '';
    const sorted = RECIPES.slice().sort((a, b) => {
      const ca = canCraft(a, have) ? 0 : 1;
      const cb = canCraft(b, have) ? 0 : 1;
      return ca - cb;
    });
    for (const r of sorted) {
      const el = document.createElement('div');
      el.className = 'slot';
      const ok = canCraft(r, have);
      el.style.opacity = ok ? '1' : '0.42';
      fillSlot(el, { item: r.out, count: r.count });
      el.addEventListener('click', (e) => {
        this._craftFromRecipe(r, e.shiftKey ? 64 : 1);
      });
      el.addEventListener('mouseenter', () => this._showRecipeTooltip(r, ok));
      el.addEventListener('mouseleave', () => this._hideTooltip());
      this.catalogEl.appendChild(el);
    }
  }

  _renderSmelting() {
    this.titleEl.textContent = '熔炼 · 需要燃料（煤炭/木板/原木）';
    const have = this.game.inventory.tally();
    this.catalogEl.innerHTML = '';
    for (const [input, output] of SMELTING) {
      const el = document.createElement('div');
      el.className = 'slot';
      const hasInput = (have.get(input) || 0) > 0;
      const fuel = FUELS.find(f => (have.get(f) || 0) > 0);
      const ok = hasInput && !!fuel;
      el.style.opacity = ok ? '1' : '0.42';
      fillSlot(el, { item: output, count: 1 });
      el.addEventListener('click', () => {
        if (!ok) { this.game.chat.print(`熔炼 ${displayName(output)} 需要 ${displayName(input)} 与燃料`, 'err'); return; }
        const inv = this.game.inventory;
        inv.remove(input, 1);
        // 每份燃料可炼 4 个（简化）
        this._fuelProgress = (this._fuelProgress || 0) + 1;
        if (this._fuelProgress % 4 === 1) inv.remove(fuel, 1);
        inv.add(output, 1);
        bus.emit(EV.SOUND, 'dig', { material: 'stone', volume: 0.3 });
        this.refresh();
      });
      el.addEventListener('mouseenter', () => {
        this._tooltipHTML(`<div class="tt-name">${displayName(output)}</div>
          <div class="tt-sub">原料: ${displayName(input)} ×1</div>
          <div class="tt-sub">燃料: 煤炭 / 木板 / 原木</div>`);
      });
      el.addEventListener('mouseleave', () => this._hideTooltip());
      this.catalogEl.appendChild(el);
    }
  }

  _renderRecipeBook() {
    const have = this.game.inventory.tally();
    const avail = RECIPES.filter(r => canCraft(r, have)).slice(0, 40);
    this.recipeEl.innerHTML = '';
    for (const r of avail) {
      const btn = document.createElement('div');
      btn.className = 'recipe-btn can';
      const url = iconUrl(r.out);
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        btn.appendChild(img);
      }
      btn.title = displayName(r.out);
      btn.addEventListener('click', (e) => this._craftFromRecipe(r, e.shiftKey ? 64 : 1));
      btn.addEventListener('mouseenter', () => this._showRecipeTooltip(r, true));
      btn.addEventListener('mouseleave', () => this._hideTooltip());
      this.recipeEl.appendChild(btn);
    }
    if (avail.length === 0) {
      const d = document.createElement('div');
      d.style.fontSize = '10px';
      d.style.color = '#5f5f5f';
      d.textContent = '暂无可合成的配方，先去采集资源吧';
      this.recipeEl.appendChild(d);
    }
  }

  /** 一键合成（从背包扣材料） */
  _craftFromRecipe(recipe, times = 1) {
    const inv = this.game.inventory;
    let made = 0;
    for (let t = 0; t < times; t++) {
      const have = inv.tally();
      if (!canCraft(recipe, have)) break;
      const need = recipeIngredients(recipe);
      for (const [item, n] of need) inv.remove(item, n);
      const left = inv.add(recipe.out, recipe.count);
      if (left > 0) this._dropToWorld(recipe.out, left);
      made++;
    }
    if (made > 0) {
      bus.emit(EV.SOUND, 'place', { material: 'wood', volume: 0.35 });
      this.game.hud.toast(`合成 ${displayName(recipe.out)} × ${recipe.count * made}`);
    } else {
      this.game.chat.print('材料不足: ' + [...recipeIngredients(recipe)]
        .map(([i, n]) => `${displayName(i)}×${n}`).join(', '), 'err');
    }
    this.refresh();
  }

  /** 点击输出槽：取出合成结果 */
  _clickOutput(shift) {
    const inv = this.game.inventory;
    const match = this._matched;
    if (!match) return;
    let loops = shift ? 64 : 1;
    let made = 0;
    while (loops-- > 0) {
      const grid = inv.craft.map(s => s ? s.item : null);
      const m = matchRecipe(grid);
      if (!m) break;
      const left = inv.add(m.out, m.count);
      if (left > 0) { this._dropToWorld(m.out, left); }
      // 消耗材料
      for (let i = 0; i < 9; i++) {
        const s = inv.craft[i];
        if (!s) continue;
        s.count--;
        if (s.count <= 0) inv.craft[i] = null;
      }
      made++;
    }
    if (made) bus.emit(EV.SOUND, 'place', { material: 'wood', volume: 0.3 });
    this.refresh();
  }

  /* ---------------- 提示框 ---------------- */
  _showTooltip(stack) {
    if (!stack) { this._hideTooltip(); return; }
    const item = getItem(stack.item);
    const block = blockByName(stack.item);
    let html = `<div class="tt-name">${displayName(stack.item)}</div>`;
    html += `<div class="tt-sub">${stack.item}</div>`;
    if (item) {
      if (item.kind === 'tool') {
        html += `<div class="tt-tag">工具: ${item.tool} · 等级 ${item.level} · 速度 ${item.speed}</div>`;
        if (item.durability) html += `<div class="tt-sub">耐久 ${stack.dura ?? item.durability} / ${item.durability}</div>`;
        html += `<div class="tt-sub">攻击力 ${item.damage}</div>`;
      } else if (item.kind === 'food') {
        html += `<div class="tt-tag">食物: 回复 ${item.nutrition / 2} 格饥饿</div>`;
      }
    }
    if (block) {
      html += `<div class="tt-sub">硬度 ${block.hardness} · ${block.tool !== 'none' ? '适用: ' + block.tool : '徒手可挖'}</div>`;
      if (block.emission > 0) html += `<div class="tt-tag">发光 ${block.emission}</div>`;
    }
    this._tooltipHTML(html);
  }

  _showRecipeTooltip(recipe, ok) {
    const need = [...recipeIngredients(recipe)]
      .map(([i, n]) => `${displayName(i)} ×${n}`).join('<br>');
    this._tooltipHTML(
      `<div class="tt-name">${displayName(recipe.out)} × ${recipe.count}</div>
       <div class="tt-sub">需要:</div><div class="tt-sub">${need}</div>
       <div class="tt-tag">${ok ? '点击合成（Shift 批量）' : '材料不足'}</div>`);
  }

  _tooltipHTML(html) {
    this.tooltipEl.innerHTML = html;
    this.tooltipEl.style.display = 'block';
  }

  _hideTooltip() { this.tooltipEl.style.display = 'none'; }

  _moveGhost(e) {
    if (!this.open) return;
    this.ghostEl.style.left = (e.clientX - 16) + 'px';
    this.ghostEl.style.top = (e.clientY - 16) + 'px';
    if (this.tooltipEl.style.display === 'block') {
      const w = this.tooltipEl.offsetWidth, h = this.tooltipEl.offsetHeight;
      let x = e.clientX + 14, y = e.clientY + 10;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - 12;
      if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
      this.tooltipEl.style.left = x + 'px';
      this.tooltipEl.style.top = y + 'px';
    }
  }
}
