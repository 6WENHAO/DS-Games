// Exosuit inventory: NMS-style slot grid with stack limits.
import { ITEMS } from '../data/items.js';

export class Inventory {
  constructor(size = 24, label = '外骨骼 EXOSUIT') {
    this.size = size;
    this.label = label;
    this.slots = new Array(size).fill(null); // { key, count }
    this.onChange = null;
  }

  _touch() { if (this.onChange) this.onChange(); }

  stackLimit(key) { const d = ITEMS[key]; return d ? (d.type === 'block' ? 999 : 9999) : 999; }

  count(key) {
    if (this.creative) return 9999;
    let n = 0;
    for (const s of this.slots) if (s && s.key === key) n += s.count;
    return n;
  }

  /** real amount held, ignoring creative mode */
  realCount(key) {
    let n = 0;
    for (const s of this.slots) if (s && s.key === key) n += s.count;
    return n;
  }

  has(key, n = 1) { return this.count(key) >= n; }

  hasAll(list) { return list.every(([k, n]) => this.count(k) >= n); }

  freeSlots() { return this.slots.filter((s) => !s).length; }

  /** returns amount actually added */
  add(key, count = 1) {
    if (!ITEMS[key]) return 0;
    const lim = this.stackLimit(key);
    let left = count;
    for (let i = 0; i < this.size && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.key === key && s.count < lim) {
        const put = Math.min(lim - s.count, left);
        s.count += put; left -= put;
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const put = Math.min(lim, left);
        this.slots[i] = { key, count: put };
        left -= put;
      }
    }
    if (left !== count) this._touch();
    return count - left;
  }

  remove(key, count = 1) {
    if (this.creative) return true;   // creative mode never consumes
    if (this.count(key) < count) return false;
    let left = count;
    for (let i = this.size - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.key === key) {
        const take = Math.min(s.count, left);
        s.count -= take; left -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this._touch();
    return true;
  }

  removeAll(list) {
    if (!this.hasAll(list)) return false;
    for (const [k, n] of list) this.remove(k, n);
    return true;
  }

  moveSlot(a, b) {
    const t = this.slots[a]; this.slots[a] = this.slots[b]; this.slots[b] = t;
    this._touch();
  }

  clearSlot(i) { this.slots[i] = null; this._touch(); }

  isFull() { return this.slots.every((s) => s !== null); }

  totalValue() {
    let v = 0;
    for (const s of this.slots) if (s) v += (ITEMS[s.key]?.value || 0) * s.count;
    return v;
  }

  serialize() { return { size: this.size, slots: this.slots.map((s) => (s ? [s.key, s.count] : null)) }; }
  load(data) {
    if (!data) return;
    this.size = data.size || this.size;
    this.slots = new Array(this.size).fill(null);
    (data.slots || []).forEach((s, i) => { if (s && i < this.size) this.slots[i] = { key: s[0], count: s[1] }; });
    this._touch();
  }
}
