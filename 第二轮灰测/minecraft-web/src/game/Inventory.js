/* =====================================================================
 * Inventory — 背包（9 快捷栏 + 27 主背包）、合成网格、耐久
 * 槽位数据: { item: string, count: number, dura?: number } 或 null
 * ===================================================================== */
import { getItem, itemMaxStack } from '../data/items.js';
import { bus, EV } from '../core/EventBus.js';

export const HOTBAR_SIZE = 9;
export const MAIN_SIZE = 27;
export const TOTAL_SIZE = HOTBAR_SIZE + MAIN_SIZE;

export class Inventory {
  constructor() {
    /** 0..8 = 快捷栏, 9..35 = 主背包 */
    this.slots = new Array(TOTAL_SIZE).fill(null);
    this.craft = new Array(9).fill(null);
    this.craftOutput = null;
    this.selected = 0;
    this.cursor = null;          // 鼠标拖着的物品
  }

  /* ---------------- 基础 ---------------- */
  get(i) { return this.slots[i] || null; }
  set(i, stack) {
    this.slots[i] = (stack && stack.count > 0) ? stack : null;
    bus.emit(EV.INVENTORY_CHANGED, i);
  }

  get selectedStack() { return this.slots[this.selected]; }
  get selectedItem() { return this.slots[this.selected]?.item ?? null; }

  select(i) {
    const n = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    if (n === this.selected) return;
    this.selected = n;
    bus.emit(EV.HOTBAR_CHANGED, n);
  }

  scroll(delta) {
    this.select(this.selected + (delta > 0 ? 1 : -1));
  }

  /* ---------------- 增删 ---------------- */

  /**
   * 尝试加入物品，返回未能放入的数量
   */
  add(itemName, count = 1) {
    const def = getItem(itemName);
    if (!def) return count;
    const max = def.maxStack;
    let left = count;

    // 1) 先叠加到已有堆（快捷栏优先）
    for (let i = 0; i < TOTAL_SIZE && left > 0; i++) {
      const idx = i < HOTBAR_SIZE ? i : i;
      const s = this.slots[idx];
      if (!s || s.item !== itemName) continue;
      if (s.count >= max) continue;
      const can = Math.min(max - s.count, left);
      s.count += can;
      left -= can;
    }
    // 2) 放进空槽
    for (let i = 0; i < TOTAL_SIZE && left > 0; i++) {
      if (this.slots[i]) continue;
      const put = Math.min(max, left);
      this.slots[i] = { item: itemName, count: put, dura: def.durability || 0 };
      left -= put;
    }
    if (left !== count) bus.emit(EV.INVENTORY_CHANGED, -1);
    return left;
  }

  /** 消耗指定物品若干个，返回是否成功 */
  remove(itemName, count = 1) {
    let need = count;
    for (let i = 0; i < TOTAL_SIZE && need > 0; i++) {
      const s = this.slots[i];
      if (!s || s.item !== itemName) continue;
      const take = Math.min(s.count, need);
      s.count -= take;
      need -= take;
      if (s.count <= 0) this.slots[i] = null;
    }
    if (need < count) bus.emit(EV.INVENTORY_CHANGED, -1);
    return need === 0;
  }

  /** 消耗手上物品 1 个 */
  consumeSelected(n = 1) {
    const s = this.slots[this.selected];
    if (!s) return false;
    s.count -= n;
    if (s.count <= 0) this.slots[this.selected] = null;
    bus.emit(EV.INVENTORY_CHANGED, this.selected);
    return true;
  }

  /** 工具耐久 -1，损坏则移除 */
  damageSelected(amount = 1) {
    const s = this.slots[this.selected];
    if (!s) return;
    const def = getItem(s.item);
    if (!def || !def.durability) return;
    s.dura = (s.dura ?? def.durability) - amount;
    if (s.dura <= 0) {
      this.slots[this.selected] = null;
      bus.emit(EV.SOUND, 'break', { volume: 0.5 });
    }
    bus.emit(EV.INVENTORY_CHANGED, this.selected);
  }

  count(itemName) {
    let n = 0;
    for (const s of this.slots) if (s && s.item === itemName) n += s.count;
    return n;
  }

  /** 物品清单 Map<name, count>（含合成网格） */
  tally(includeCraft = false) {
    const m = new Map();
    for (const s of this.slots) if (s) m.set(s.item, (m.get(s.item) || 0) + s.count);
    if (includeCraft) {
      for (const s of this.craft) if (s) m.set(s.item, (m.get(s.item) || 0) + s.count);
    }
    return m;
  }

  has(itemName, count = 1) { return this.count(itemName) >= count; }

  clear() {
    this.slots.fill(null);
    this.craft.fill(null);
    this.craftOutput = null;
    this.cursor = null;
    bus.emit(EV.INVENTORY_CHANGED, -1);
  }

  /** 找到该物品所在的快捷栏槽（中键取色用） */
  findHotbar(itemName) {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      if (this.slots[i] && this.slots[i].item === itemName) return i;
    }
    return -1;
  }

  /** 中键取色：把物品放到当前槽（创造模式） */
  pickItem(itemName, creative) {
    const existing = this.findHotbar(itemName);
    if (existing >= 0) { this.select(existing); return true; }
    if (!creative) {
      // 生存模式：在背包里找
      for (let i = HOTBAR_SIZE; i < TOTAL_SIZE; i++) {
        if (this.slots[i] && this.slots[i].item === itemName) {
          const tmp = this.slots[this.selected];
          this.slots[this.selected] = this.slots[i];
          this.slots[i] = tmp;
          bus.emit(EV.INVENTORY_CHANGED, -1);
          return true;
        }
      }
      return false;
    }
    const def = getItem(itemName);
    this.slots[this.selected] = { item: itemName, count: 1, dura: def?.durability || 0 };
    bus.emit(EV.INVENTORY_CHANGED, this.selected);
    return true;
  }

  /* ---------------- 鼠标操作（物品栏界面） ---------------- */

  /** 左键点击槽位：拿起 / 放下 / 合并 */
  clickSlot(list, index, shift = false) {
    const arr = this._resolve(list);
    if (!arr) return;
    const slot = arr[index] || null;
    const cur = this.cursor;

    if (shift && slot) {
      // Shift 快速移动：快捷栏 <-> 背包
      this._quickMove(list, index);
      return;
    }

    if (!cur) {
      if (!slot) return;
      this.cursor = slot;
      arr[index] = null;
    } else if (!slot) {
      arr[index] = cur;
      this.cursor = null;
    } else if (slot.item === cur.item) {
      const max = itemMaxStack(slot.item);
      const can = Math.min(max - slot.count, cur.count);
      slot.count += can;
      cur.count -= can;
      if (cur.count <= 0) this.cursor = null;
    } else {
      arr[index] = cur;
      this.cursor = slot;
    }
    bus.emit(EV.INVENTORY_CHANGED, -1);
  }

  /** 右键点击：放下一个 / 拿一半 */
  rightClickSlot(list, index) {
    const arr = this._resolve(list);
    if (!arr) return;
    const slot = arr[index] || null;
    const cur = this.cursor;
    if (cur) {
      if (!slot) {
        arr[index] = { item: cur.item, count: 1, dura: cur.dura };
        cur.count--;
      } else if (slot.item === cur.item && slot.count < itemMaxStack(slot.item)) {
        slot.count++;
        cur.count--;
      }
      if (cur.count <= 0) this.cursor = null;
    } else if (slot) {
      const half = Math.ceil(slot.count / 2);
      this.cursor = { item: slot.item, count: half, dura: slot.dura };
      slot.count -= half;
      if (slot.count <= 0) arr[index] = null;
    }
    bus.emit(EV.INVENTORY_CHANGED, -1);
  }

  _resolve(list) {
    if (list === 'main' || list === 'hotbar' || list === 'inv') return this.slots;
    if (list === 'craft') return this.craft;
    return null;
  }

  _quickMove(list, index) {
    const arr = this._resolve(list);
    const stack = arr[index];
    if (!stack) return;
    if (list === 'craft') {
      const left = this.add(stack.item, stack.count);
      if (left === 0) arr[index] = null; else stack.count = left;
      bus.emit(EV.INVENTORY_CHANGED, -1);
      return;
    }
    // 快捷栏 <-> 主背包
    const from = index;
    const isHotbar = from < HOTBAR_SIZE;
    const start = isHotbar ? HOTBAR_SIZE : 0;
    const end = isHotbar ? TOTAL_SIZE : HOTBAR_SIZE;
    const max = itemMaxStack(stack.item);
    for (let i = start; i < end && stack.count > 0; i++) {
      const s = this.slots[i];
      if (s && s.item === stack.item && s.count < max) {
        const can = Math.min(max - s.count, stack.count);
        s.count += can; stack.count -= can;
      }
    }
    if (stack.count > 0) {
      for (let i = start; i < end; i++) {
        if (!this.slots[i]) { this.slots[i] = stack; this.slots[from] = null; break; }
      }
    }
    if (stack.count <= 0) this.slots[from] = null;
    bus.emit(EV.INVENTORY_CHANGED, -1);
  }

  /** 把光标物品丢弃（返回被丢弃的堆） */
  dropCursor() {
    const c = this.cursor;
    this.cursor = null;
    return c;
  }

  /* ---------------- 存档 ---------------- */
  serialize() {
    return {
      selected: this.selected,
      slots: this.slots.map(s => s ? [s.item, s.count, s.dura || 0] : null),
    };
  }

  deserialize(d) {
    if (!d || !Array.isArray(d.slots)) return;
    this.slots = new Array(TOTAL_SIZE).fill(null);
    d.slots.forEach((s, i) => {
      if (!s || i >= TOTAL_SIZE) return;
      if (!getItem(s[0])) return;
      this.slots[i] = { item: s[0], count: s[1], dura: s[2] || 0 };
    });
    this.selected = Math.min(HOTBAR_SIZE - 1, Math.max(0, d.selected || 0));
    bus.emit(EV.INVENTORY_CHANGED, -1);
  }

  /** 生存模式初始装备 */
  giveStarterKit() {
    this.slots[0] = { item: 'wooden_pickaxe', count: 1, dura: getItem('wooden_pickaxe').durability };
    this.slots[1] = { item: 'wooden_axe', count: 1, dura: getItem('wooden_axe').durability };
    this.slots[2] = { item: 'wooden_shovel', count: 1, dura: getItem('wooden_shovel').durability };
    this.slots[3] = { item: 'wooden_sword', count: 1, dura: getItem('wooden_sword').durability };
    this.slots[4] = { item: 'torch', count: 16, dura: 0 };
    this.slots[5] = { item: 'bread', count: 6, dura: 0 };
    this.slots[6] = { item: 'oak_planks', count: 32, dura: 0 };
    this.slots[7] = { item: 'crafting_table', count: 1, dura: 0 };
    bus.emit(EV.INVENTORY_CHANGED, -1);
  }

  /** 创造模式默认快捷栏 */
  giveCreativeKit() {
    const kit = ['grass_block', 'stone', 'oak_planks', 'oak_log', 'glass', 'torch',
      'white_wool', 'crafting_table', 'diamond_pickaxe'];
    kit.forEach((name, i) => {
      if (!getItem(name)) return;
      const def = getItem(name);
      this.slots[i] = { item: name, count: def.kind === 'block' ? 64 : 1, dura: def.durability || 0 };
    });
    bus.emit(EV.INVENTORY_CHANGED, -1);
  }
}
