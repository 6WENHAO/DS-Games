/**
 * game/inventory.js
 * ------------------------------------------------------------------
 * Item stacks and the player's inventory model.
 *
 * Slot layout matches vanilla so the GUI textures line up:
 *   0..8    hotbar
 *   9..35   main inventory (three rows of nine)
 *   36..39  armour (boots, leggings, chestplate, helmet)
 *   40      offhand
 *
 * The crafting grid lives in its own small Inventory so the same code
 * serves the 2x2 player grid and the 3x3 crafting table.
 */

import { getItem, ITEM_FOR_BLOCK } from './items.js';

export const HOTBAR_SIZE = 9;
export const MAIN_ROWS = 3;
export const MAIN_SIZE = HOTBAR_SIZE * MAIN_ROWS;
export const ARMOUR_SLOTS = 4;
export const PLAYER_SLOTS = HOTBAR_SIZE + MAIN_SIZE + ARMOUR_SLOTS + 1;

export const SLOT = {
  HOTBAR_START: 0,
  MAIN_START: HOTBAR_SIZE,
  ARMOUR_START: HOTBAR_SIZE + MAIN_SIZE,
  OFFHAND: HOTBAR_SIZE + MAIN_SIZE + ARMOUR_SLOTS,
};

/** One inventory slot: an item id, a count and optional damage. */
export class ItemStack {
  constructor(id = 0, count = 0, damage = 0) {
    this.id = id;
    this.count = count;
    this.damage = damage;
  }

  get isEmpty() { return this.id === 0 || this.count <= 0; }
  get def() { return getItem(this.id); }
  get maxStack() { return this.def?.stackSize ?? 64; }
  get maxDurability() { return this.def?.durability ?? 0; }

  /** Remaining durability fraction, or 1 when the item cannot break. */
  get durabilityFraction() {
    const max = this.maxDurability;
    if (!max) return 1;
    return Math.max(0, 1 - this.damage / max);
  }

  set(id, count = 1, damage = 0) {
    this.id = id; this.count = count; this.damage = damage;
    return this;
  }

  clear() { return this.set(0, 0, 0); }

  copy() { return new ItemStack(this.id, this.count, this.damage); }

  copyFrom(other) { return this.set(other.id, other.count, other.damage); }

  /** True when two stacks can merge (same item, same damage). */
  matches(other) {
    return !this.isEmpty && !other.isEmpty && this.id === other.id && this.damage === other.damage;
  }

  /**
   * Applies tool wear.
   * @returns {boolean} true when the item broke
   */
  damageBy(amount) {
    if (!this.maxDurability) return false;
    this.damage += amount;
    if (this.damage >= this.maxDurability) { this.clear(); return true; }
    return false;
  }

  toJSON() {
    return this.isEmpty ? null : { id: this.id, count: this.count, damage: this.damage };
  }

  static fromJSON(json) {
    if (!json) return new ItemStack();
    return new ItemStack(json.id, json.count, json.damage ?? 0);
  }
}

/** A fixed-size array of stacks with the usual insert/merge helpers. */
export class Inventory {
  constructor(size) {
    /** @type {ItemStack[]} */
    this.slots = Array.from({ length: size }, () => new ItemStack());
    /** Bumped whenever contents change, so the UI can avoid rework. */
    this.version = 0;
  }

  get size() { return this.slots.length; }

  get(index) { return this.slots[index]; }

  set(index, stack) {
    this.slots[index].copyFrom(stack);
    this.version++;
    return this;
  }

  clear() {
    for (const s of this.slots) s.clear();
    this.version++;
  }

  isEmpty() {
    return this.slots.every((s) => s.isEmpty);
  }

  /** Total count of an item across all slots. */
  count(itemId) {
    let n = 0;
    for (const s of this.slots) if (s.id === itemId) n += s.count;
    return n;
  }

  /**
   * Adds items, merging into existing stacks first (vanilla behaviour).
   * @param {number} itemIdValue
   * @param {number} count
   * @param {{start?: number, end?: number}} [range]
   * @returns {number} how many items could NOT be added
   */
  add(itemIdValue, count, range = {}) {
    if (!itemIdValue || count <= 0) return count;
    const start = range.start ?? 0;
    const end = range.end ?? this.size;
    const max = getItem(itemIdValue)?.stackSize ?? 64;
    let left = count;

    // pass 1: top up existing stacks
    for (let i = start; i < end && left > 0; i++) {
      const s = this.slots[i];
      if (s.id !== itemIdValue || s.count >= max) continue;
      const room = max - s.count;
      const move = Math.min(room, left);
      s.count += move;
      left -= move;
    }
    // pass 2: fill empty slots
    for (let i = start; i < end && left > 0; i++) {
      const s = this.slots[i];
      if (!s.isEmpty) continue;
      const move = Math.min(max, left);
      s.set(itemIdValue, move);
      left -= move;
    }
    if (left !== count) this.version++;
    return left;
  }

  /**
   * Removes up to `count` of an item.
   * @returns {number} how many were actually removed
   */
  remove(itemIdValue, count) {
    let left = count;
    for (let i = this.size - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s.id !== itemIdValue) continue;
      const take = Math.min(s.count, left);
      s.count -= take;
      left -= take;
      if (s.count <= 0) s.clear();
    }
    if (left !== count) this.version++;
    return count - left;
  }

  /** Decrements one slot by one item, clearing it when empty. */
  consume(index, amount = 1) {
    const s = this.slots[index];
    if (s.isEmpty) return false;
    s.count -= amount;
    if (s.count <= 0) s.clear();
    this.version++;
    return true;
  }

  /** First slot index holding the item, or -1. */
  find(itemIdValue) {
    return this.slots.findIndex((s) => s.id === itemIdValue && s.count > 0);
  }

  /** First empty slot index, or -1. */
  firstEmpty(start = 0, end = this.size) {
    for (let i = start; i < end; i++) if (this.slots[i].isEmpty) return i;
    return -1;
  }

  swap(a, b) {
    const tmp = this.slots[a].copy();
    this.slots[a].copyFrom(this.slots[b]);
    this.slots[b].copyFrom(tmp);
    this.version++;
  }

  toJSON() {
    return this.slots.map((s) => s.toJSON());
  }

  fromJSON(json) {
    if (!Array.isArray(json)) return this;
    for (let i = 0; i < this.size; i++) {
      this.slots[i].copyFrom(ItemStack.fromJSON(json[i]));
    }
    this.version++;
    return this;
  }
}

/**
 * The player's inventory: hotbar + main + armour + offhand, plus the
 * selected hotbar index and the stack currently held by the cursor.
 */
export class PlayerInventory extends Inventory {
  constructor() {
    super(PLAYER_SLOTS);
    this.selected = 0;
    /** Stack picked up by the mouse in an open container screen. */
    this.cursor = new ItemStack();
    /** 2x2 personal crafting grid. */
    this.craftGrid = new Inventory(4);
    this.craftResult = new ItemStack();
  }

  /** The stack in the player's main hand. */
  get held() { return this.slots[this.selected]; }

  selectSlot(index) {
    this.selected = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
  }

  /** Scrolls the hotbar selection. */
  scrollSelection(delta) {
    this.selectSlot(this.selected + Math.sign(delta));
  }

  /**
   * Adds items, preferring the hotbar then the main inventory - matching
   * how vanilla fills the inventory on pickup.
   */
  addItem(itemIdValue, count = 1) {
    let left = this.add(itemIdValue, count, { start: SLOT.HOTBAR_START, end: SLOT.HOTBAR_START + HOTBAR_SIZE });
    if (left > 0) left = this.add(itemIdValue, left, { start: SLOT.MAIN_START, end: SLOT.MAIN_START + MAIN_SIZE });
    return left;
  }

  /** Convenience: give the item form of a block. */
  addBlock(blockId, count = 1) {
    const item = ITEM_FOR_BLOCK[blockId];
    return item ? this.addItem(item, count) : count;
  }

  /**
   * Middle-click pick block: puts the matching item in hand, taking it
   * from the inventory if present, or spawning it in creative mode.
   */
  pickBlock(blockId, creative) {
    const item = ITEM_FOR_BLOCK[blockId];
    if (!item) return false;
    const existing = this.slots.findIndex((s, i) => i < HOTBAR_SIZE + MAIN_SIZE && s.id === item);
    if (existing >= 0) {
      if (existing < HOTBAR_SIZE) { this.selected = existing; return true; }
      this.swap(existing, this.selected);
      return true;
    }
    if (!creative) return false;
    this.slots[this.selected].set(item, 1);
    this.version++;
    return true;
  }

  /** Total armour points, used by the damage calculation and the HUD. */
  armourPoints() {
    let total = 0;
    for (let i = 0; i < ARMOUR_SLOTS; i++) {
      const s = this.slots[SLOT.ARMOUR_START + i];
      if (!s.isEmpty) total += s.def?.armour ?? 0;
    }
    return total;
  }

  /** Drops everything (on death). */
  dropAll() {
    const dropped = [];
    for (const s of this.slots) {
      if (!s.isEmpty) dropped.push(s.copy());
      s.clear();
    }
    for (const s of this.craftGrid.slots) {
      if (!s.isEmpty) dropped.push(s.copy());
      s.clear();
    }
    if (!this.cursor.isEmpty) { dropped.push(this.cursor.copy()); this.cursor.clear(); }
    this.version++;
    return dropped;
  }

  toJSON() {
    return {
      slots: super.toJSON(),
      selected: this.selected,
      craftGrid: this.craftGrid.toJSON(),
    };
  }

  fromJSON(json) {
    if (!json) return this;
    super.fromJSON(json.slots);
    this.selected = json.selected ?? 0;
    this.craftGrid.fromJSON(json.craftGrid);
    return this;
  }
}
