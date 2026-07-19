import { ITEMS } from './items.js';
import { Audio } from '../core/audio.js';

// 背包：物品堆叠、装备、使用回调由 game 层注入
export class Inventory {
  constructor() {
    this.slots = new Map(); // itemId -> count
    this.equipped = null;   // itemId
    this.onChange = null;
  }

  _changed() { if (this.onChange) this.onChange(); }

  count(id) { return this.slots.get(id) || 0; }

  add(id, n = 1) {
    const def = ITEMS[id];
    if (!def) return 0;
    const cur = this.count(id);
    const max = def.stack || 1;
    const added = Math.min(n, max - cur);
    if (added <= 0) return 0;
    this.slots.set(id, cur + added);
    this._changed();
    return added;
  }

  remove(id, n = 1) {
    const cur = this.count(id);
    if (cur < n) return false;
    if (cur - n <= 0) {
      this.slots.delete(id);
      if (this.equipped === id) this.equipped = null;
    } else {
      this.slots.set(id, cur - n);
    }
    this._changed();
    return true;
  }

  has(cost) {
    for (const [id, n] of Object.entries(cost)) {
      if (this.count(id) < n) return false;
    }
    return true;
  }

  pay(cost) {
    if (!this.has(cost)) return false;
    for (const [id, n] of Object.entries(cost)) this.remove(id, n);
    return true;
  }

  equip(id) {
    if (!ITEMS[id]?.equip) return false;
    if (this.count(id) <= 0) return false;
    this.equipped = this.equipped === id ? null : id;
    Audio.play('draw_knife', { volume: 0.7 });
    this._changed();
    return true;
  }

  get equippedDef() {
    return this.equipped ? ITEMS[this.equipped] : null;
  }

  // 快捷栏：装备品优先 + 可使用品
  hotbarItems() {
    const list = [];
    for (const [id] of this.slots) {
      const def = ITEMS[id];
      if (def.equip || (def.use && def.use !== 'none')) list.push(id);
      if (list.length >= 5) break;
    }
    return list;
  }

  serialize() {
    return { slots: Object.fromEntries(this.slots), equipped: this.equipped };
  }

  deserialize(data) {
    this.slots = new Map(Object.entries(data.slots || {}));
    this.equipped = data.equipped || null;
    this._changed();
  }
}
