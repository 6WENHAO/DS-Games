/**
 * ui/screens.js
 * ------------------------------------------------------------------
 * The in-canvas screen stack: title, pause, inventory, crafting table,
 * settings and the death screen.
 *
 * Every screen is drawn with the same sprite batch as the HUD and uses
 * the vanilla container textures, so the interface matches the game's
 * look. Screens handle their own hit testing in GUI-pixel space.
 *
 * A screen implements:
 *   draw(ctx)                        - render
 *   mouseDown(x, y, button, ctx)      - returns true when consumed
 *   mouseUp(x, y, button, ctx)
 *   wheel(delta, ctx)
 *   key(code, ctx)                    - returns true when consumed
 *   get pausesGame()                  - freeze the world?
 *   get grabsCursor()                 - show a cursor?
 */

import { findRecipe, consumeIngredients } from '../game/crafting.js';
import { SLOT, HOTBAR_SIZE, MAIN_SIZE, ItemStack } from '../game/inventory.js';
import { creativeItems, getItem, CATEGORY } from '../game/items.js';
import {
  t, worldTypeName, modeName, categoryName, entryName, getLocale, LOCALE_NAMES,
} from './i18n.js';

/** Vanilla container window sizes, in GUI pixels. */
const INVENTORY_SIZE = { w: 176, h: 166 };
const CRAFTING_SIZE = { w: 176, h: 166 };

/** Base class with the shared slot-grid helpers. */
class Screen {
  constructor(game) {
    this.game = game;
    this.hovered = -1;
  }

  get pausesGame() { return false; }
  get grabsCursor() { return true; }
  get darkens() { return true; }

  draw() {}
  mouseDown() { return false; }
  mouseUp() { return false; }
  wheel() { return false; }
  key() { return false; }
  update() {}

  /** Centres a window of the given size and returns its top-left corner. */
  windowOrigin(batch, size) {
    return {
      x: Math.floor((batch.width - size.w) / 2),
      y: Math.floor((batch.height - size.h) / 2),
    };
  }

  /** Draws a translucent dark backdrop over the world. */
  drawBackdrop(batch) {
    batch.rect(0, 0, batch.width, batch.height, 0x000000, 0.55);
  }

  /**
   * Draws a nine-slice-free vanilla-style panel: the dirt background
   * tiled, used by the title and settings screens.
   */
  drawDirtBackground(batch, textures) {
    const dirt = textures.get('dirt_background');
    batch.setTexture(dirt);
    const tile = 32;
    for (let y = 0; y < batch.height; y += tile) {
      for (let x = 0; x < batch.width; x += tile) {
        batch.quad(x, y, tile, tile, 0, 0, tile / dirt.width, tile / dirt.height, 0x404040, 1);
      }
    }
  }

  /** A vanilla-looking button; returns true when the point is inside. */
  drawButton(hud, x, y, w, h, label, { hover = false, disabled = false } = {}) {
    const batch = hud.batch;
    const base = disabled ? 0x2b2b2b : hover ? 0x6f6f6f : 0x545454;
    batch.rect(x, y, w, h, 0x000000, 1);
    batch.rect(x + 1, y + 1, w - 2, h - 2, base, 1);
    batch.rect(x + 1, y + 1, w - 2, 1, 0xffffff, 0.25);
    batch.rect(x + 1, y + h - 2, w - 2, 1, 0x000000, 0.35);
    hud.drawText(label, x + Math.floor(w / 2), y + Math.floor((h - 8) / 2), {
      align: 'center',
      color: disabled ? 0x9a9a9a : 0xffffff,
    });
    return { x, y, w, h };
  }

  /** Point-in-rect test in GUI pixels. */
  static inside(px, py, r) {
    return px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h;
  }
}

/* ================================================================== */
/* container screens                                                  */
/* ================================================================== */

/**
 * Shared behaviour for slot-based screens: hover detection, click-to-move
 * stacks (left click takes/places all, right click splits/places one) and
 * shift-click transfer between the hotbar and the main inventory.
 */
class ContainerScreen extends Screen {
  constructor(game) {
    super(game);
    /** @type {{x:number,y:number,inv:object,index:number}[]} */
    this.slotRects = [];
  }

  get pausesGame() { return false; }

  /** Registers a 16x16 slot at a GUI position. */
  addSlot(x, y, inv, index) {
    this.slotRects.push({ x, y, w: 16, h: 16, inv, index });
  }

  /** Slot under the cursor, or null. */
  slotAt(px, py) {
    for (const s of this.slotRects) {
      if (px >= s.x && py >= s.y && px < s.x + s.w && py < s.y + s.h) return s;
    }
    return null;
  }

  /** Draws every registered slot's contents plus the hover highlight. */
  drawSlots(hud, px, py) {
    const batch = hud.batch;
    for (const s of this.slotRects) {
      hud.drawItem(s.inv.get(s.index), s.x, s.y);
    }
    const hover = this.slotAt(px, py);
    if (hover) batch.rect(hover.x, hover.y, 16, 16, 0xffffff, 0.32);
    return hover;
  }

  /** Draws the cursor stack and the hovered item's tooltip. */
  drawCursor(hud, px, py, hovered) {
    const cursor = this.game.player.inventory.cursor;
    if (!cursor.isEmpty) {
      hud.drawItem(cursor, px - 8, py - 8);
      return;
    }
    if (!hovered) return;
    const stack = hovered.inv.get(hovered.index);
    if (stack.isEmpty) return;
    const def = stack.def;
    if (!def) return;
    const label = entryName(def.name, def.displayName);
    const width = hud.measure(label) + 8;
    const tx = Math.min(px + 10, hud.batch.width - width - 2);
    const ty = Math.max(2, py - 14);
    hud.batch.rect(tx, ty, width, 14, 0x100010, 0.94);
    hud.batch.outline(tx, ty, width, 14, 0x2d0a63, 0.9);
    hud.drawText(label, tx + 4, ty + 3, { color: 0xffffff });
  }

  /**
   * Vanilla slot interaction.
   * @param {number} button 0 = left, 2 = right
   */
  handleSlotClick(slot, button, shift) {
    const inv = this.game.player.inventory;
    const cursor = inv.cursor;
    const stack = slot.inv.get(slot.index);

    // Result slots only give, never take.
    if (slot.readOnly) {
      if (stack.isEmpty) return;
      if (cursor.isEmpty) { cursor.copyFrom(stack); this.onTakeResult?.(stack.count); }
      else if (cursor.matches(stack) && cursor.count + stack.count <= cursor.maxStack) {
        cursor.count += stack.count;
        this.onTakeResult?.(stack.count);
      }
      return;
    }

    if (shift) { this.quickMove(slot); return; }

    if (cursor.isEmpty) {
      if (stack.isEmpty) return;
      if (button === 2) {
        // Right click picks up half, rounded up.
        const half = Math.ceil(stack.count / 2);
        cursor.set(stack.id, half, stack.damage);
        stack.count -= half;
        if (stack.count <= 0) stack.clear();
      } else {
        cursor.copyFrom(stack);
        stack.clear();
      }
      slot.inv.version++;
      return;
    }

    if (stack.isEmpty) {
      if (button === 2) {
        // Right click places a single item.
        stack.set(cursor.id, 1, cursor.damage);
        cursor.count--;
        if (cursor.count <= 0) cursor.clear();
      } else {
        stack.copyFrom(cursor);
        cursor.clear();
      }
      slot.inv.version++;
      return;
    }

    if (cursor.matches(stack)) {
      const room = stack.maxStack - stack.count;
      if (room > 0) {
        const move = button === 2 ? Math.min(1, cursor.count) : Math.min(room, cursor.count);
        stack.count += move;
        cursor.count -= move;
        if (cursor.count <= 0) cursor.clear();
      }
    } else {
      // Different items: swap.
      const tmp = stack.copy();
      stack.copyFrom(cursor);
      cursor.copyFrom(tmp);
    }
    slot.inv.version++;
  }

  /** Shift-click: move a stack between the hotbar and the main inventory. */
  quickMove(slot) {
    const inv = this.game.player.inventory;
    const stack = slot.inv.get(slot.index);
    if (stack.isEmpty) return;
    if (slot.inv !== inv) {
      // From a container (or the crafting grid) into the player inventory.
      const left = inv.addItem(stack.id, stack.count);
      if (left === 0) stack.clear(); else stack.count = left;
      slot.inv.version++;
      return;
    }
    const inHotbar = slot.index < HOTBAR_SIZE;
    const range = inHotbar
      ? { start: SLOT.MAIN_START, end: SLOT.MAIN_START + MAIN_SIZE }
      : { start: 0, end: HOTBAR_SIZE };
    const left = inv.add(stack.id, stack.count, range);
    if (left === 0) stack.clear(); else stack.count = left;
    inv.version++;
  }
}

/**
 * The survival inventory: armour, 2x2 crafting and the 36 storage slots.
 */
export class InventoryScreen extends ContainerScreen {
  constructor(game) {
    super(game);
    this.rebuild();
  }

  rebuild() {
    const inv = this.game.player.inventory;
    this.slotRects.length = 0;
    const batch = this.game.renderer.gui;
    const { x, y } = this.windowOrigin(batch, INVENTORY_SIZE);
    this.origin = { x, y };

    // main inventory (3 rows)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        this.addSlot(x + 8 + col * 18, y + 84 + row * 18, inv, SLOT.MAIN_START + row * 9 + col);
      }
    }
    // hotbar
    for (let col = 0; col < 9; col++) {
      this.addSlot(x + 8 + col * 18, y + 142, inv, col);
    }
    // armour
    for (let i = 0; i < 4; i++) {
      this.addSlot(x + 8, y + 8 + i * 18, inv, SLOT.ARMOUR_START + (3 - i));
    }
    // 2x2 crafting grid
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        this.addSlot(x + 98 + col * 18, y + 18 + row * 18, inv.craftGrid, row * 2 + col);
      }
    }
    // craft result
    this.resultSlot = { x: x + 154, y: y + 28, w: 16, h: 16, inv: { get: () => inv.craftResult, version: 0 }, index: 0, readOnly: true };
    this.slotRects.push(this.resultSlot);
    this.onTakeResult = () => {
      consumeIngredients(inv.craftGrid);
      this.updateCraftResult();
    };
    this.updateCraftResult();
  }

  /** Recomputes the 2x2 crafting output. */
  updateCraftResult() {
    const inv = this.game.player.inventory;
    const match = findRecipe(inv.craftGrid, 2);
    if (match) inv.craftResult.set(match.result, match.count);
    else inv.craftResult.clear();
  }

  draw(ctx) {
    const { hud, cursorX: px, cursorY: py } = ctx;
    const batch = hud.batch;
    this.rebuildIfResized(batch);
    this.drawBackdrop(batch);

    const gui = this.game.renderer.textures.get('inventory');
    batch.sprite(gui, this.origin.x, this.origin.y, INVENTORY_SIZE.w, INVENTORY_SIZE.h,
      0, 0, INVENTORY_SIZE.w, INVENTORY_SIZE.h);

    hud.drawText(t('gui.crafting'), this.origin.x + 97, this.origin.y + 6, { color: 0x404040, shadow: false });
    hud.drawText(t('gui.inventory'), this.origin.x + 8, this.origin.y + 73, { color: 0x404040, shadow: false });

    this.updateCraftResult();
    const hovered = this.drawSlots(hud, px, py);
    this.drawCursor(hud, px, py, hovered);
  }

  rebuildIfResized(batch) {
    const expected = this.windowOrigin(batch, INVENTORY_SIZE);
    if (!this.origin || this.origin.x !== expected.x || this.origin.y !== expected.y) this.rebuild();
  }

  mouseDown(px, py, button, ctx) {
    const slot = this.slotAt(px, py);
    if (slot) {
      this.handleSlotClick(slot, button, ctx.shift);
      this.updateCraftResult();
      return true;
    }
    // Clicking outside the window throws the cursor stack into the world.
    const cursor = this.game.player.inventory.cursor;
    if (!cursor.isEmpty) {
      this.game.dropStack(cursor.copy());
      cursor.clear();
    }
    return true;
  }

  key(code) {
    if (code === 'KeyE' || code === 'Escape') { this.game.closeScreen(); return true; }
    return false;
  }
}

/** The 3x3 crafting table. */
export class CraftingScreen extends ContainerScreen {
  constructor(game) {
    super(game);
    this.grid = game.craftingTableGrid;
    this.result = new ItemStack();
    this.rebuild();
  }

  rebuild() {
    const inv = this.game.player.inventory;
    this.slotRects.length = 0;
    const batch = this.game.renderer.gui;
    const { x, y } = this.windowOrigin(batch, CRAFTING_SIZE);
    this.origin = { x, y };

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        this.addSlot(x + 30 + col * 18, y + 17 + row * 18, this.grid, row * 3 + col);
      }
    }
    this.resultSlot = {
      x: x + 124, y: y + 35, w: 16, h: 16,
      inv: { get: () => this.result, version: 0 }, index: 0, readOnly: true,
    };
    this.slotRects.push(this.resultSlot);
    this.onTakeResult = () => { consumeIngredients(this.grid); this.updateResult(); };

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        this.addSlot(x + 8 + col * 18, y + 84 + row * 18, inv, SLOT.MAIN_START + row * 9 + col);
      }
    }
    for (let col = 0; col < 9; col++) {
      this.addSlot(x + 8 + col * 18, y + 142, inv, col);
    }
    this.updateResult();
  }

  updateResult() {
    const match = findRecipe(this.grid, 3);
    if (match) this.result.set(match.result, match.count);
    else this.result.clear();
  }

  draw(ctx) {
    const { hud, cursorX: px, cursorY: py } = ctx;
    const batch = hud.batch;
    const expected = this.windowOrigin(batch, CRAFTING_SIZE);
    if (this.origin.x !== expected.x || this.origin.y !== expected.y) this.rebuild();
    this.drawBackdrop(batch);

    const gui = this.game.renderer.textures.get('crafting_table_gui');
    batch.sprite(gui, this.origin.x, this.origin.y, CRAFTING_SIZE.w, CRAFTING_SIZE.h,
      0, 0, CRAFTING_SIZE.w, CRAFTING_SIZE.h);
    hud.drawText(t('gui.crafting'), this.origin.x + 28, this.origin.y + 6, { color: 0x404040, shadow: false });
    hud.drawText(t('gui.inventory'), this.origin.x + 8, this.origin.y + 73, { color: 0x404040, shadow: false });

    this.updateResult();
    const hovered = this.drawSlots(hud, px, py);
    this.drawCursor(hud, px, py, hovered);
  }

  mouseDown(px, py, button, ctx) {
    const slot = this.slotAt(px, py);
    if (slot) { this.handleSlotClick(slot, button, ctx.shift); this.updateResult(); return true; }
    const cursor = this.game.player.inventory.cursor;
    if (!cursor.isEmpty) { this.game.dropStack(cursor.copy()); cursor.clear(); }
    return true;
  }

  /** Returning the grid contents to the player when the screen closes. */
  onClose() {
    const inv = this.game.player.inventory;
    for (let i = 0; i < this.grid.size; i++) {
      const s = this.grid.get(i);
      if (s.isEmpty) continue;
      const left = inv.addItem(s.id, s.count);
      if (left > 0) this.game.dropStack(new ItemStack(s.id, left, s.damage));
      s.clear();
    }
  }

  key(code) {
    if (code === 'KeyE' || code === 'Escape') { this.game.closeScreen(); return true; }
    return false;
  }
}

/** Creative item picker with category tabs and a scrollable grid. */
export class CreativeScreen extends ContainerScreen {
  constructor(game) {
    super(game);
    this.all = creativeItems();
    this.category = null;
    this.scroll = 0;
    this.rows = 6;
    this.cols = 9;
    this.filtered = this.all;
    this.search = '';
    this.rebuild();
  }

  get categories() {
    return [null, CATEGORY.BUILDING, CATEGORY.DECORATION, CATEGORY.REDSTONE,
      CATEGORY.TRANSPORT, CATEGORY.TOOLS, CATEGORY.COMBAT, CATEGORY.FOOD, CATEGORY.MATERIALS];
  }

  applyFilter() {
    const term = this.search.trim().toLowerCase();
    this.filtered = this.all.filter((id) => {
      const item = getItem(id);
      if (!item) return false;
      if (this.category && item.category !== this.category) return false;
      if (term && !item.displayName.toLowerCase().includes(term)) return false;
      return true;
    });
    this.scroll = 0;
  }

  rebuild() {
    const batch = this.game.renderer.gui;
    const w = this.cols * 18 + 16;
    /*
     * Height budget: title + tabs + item grid + a gap + the player's three
     * inventory rows + the hotbar + a hint line. Vanilla shows the player's
     * slots here too; without them a picked-up item has nowhere to go,
     * which made the creative screen impossible to actually use.
     *
     * The palette shrinks rather than overflowing on a short window, so the
     * player's slots are always reachable.
     */
    const fixed = 40 + 10 + 4 * 18 + 34;
    const available = batch.height - 8 - fixed;
    this.rows = Math.max(2, Math.min(6, Math.floor(available / 18)));
    const h = this.rows * 18 + fixed;
    this.size = { w, h };
    this.origin = this.windowOrigin(batch, this.size);
    this.applyFilter();
  }

  /** Y of the first player-inventory row, relative to the window. */
  get playerRowsY() { return 40 + this.rows * 18 + 10; }

  /** Recomputes the layout if the window moved or the size no longer fits. */
  ensureLayout(batch) {
    const expected = this.windowOrigin(batch, this.size);
    const fits = this.size.h <= batch.height - 8;
    if (!fits || this.origin.x !== expected.x || this.origin.y !== expected.y) this.rebuild();
  }

  draw(ctx) {
    const { hud, cursorX: px, cursorY: py } = ctx;
    const batch = hud.batch;
    this.ensureLayout(batch);
    this.drawBackdrop(batch);

    const { x, y } = this.origin;
    const { w, h } = this.size;
    batch.rect(x - 1, y - 1, w + 2, h + 2, 0x000000, 0.85);
    batch.rect(x, y, w, h, 0xc6c6c6, 1);
    batch.rect(x, y, w, 1, 0xffffff, 0.7);
    hud.drawText(this.category ? t('gui.creativeCategory', { category: categoryName(this.category) }) : t('gui.creative'),
      x + 8, y + 6, { color: 0x404040, shadow: false });

    // --- category tabs -----------------------------------------
    this.tabRects = [];
    const tabs = this.categories;
    const tabW = Math.floor((w - 8) / tabs.length);
    tabs.forEach((cat, i) => {
      const tx = x + 4 + i * tabW;
      const ty = y + 16;
      const active = cat === this.category;
      batch.rect(tx, ty, tabW - 2, 14, active ? 0x8b8b8b : 0x555555, 1);
      // Chinese category names are short enough to show whole; English is
      // abbreviated to fit the narrow tab.
      const full = cat ? categoryName(cat) : t('gui.all');
      const label = /[^\u0000-\u00ff]/.test(full) ? full.slice(0, 2) : full.slice(0, 3);
      hud.drawText(label, tx + Math.floor((tabW - 2) / 2), ty + 3, { align: 'center', color: 0xffffff });
      this.tabRects.push({ x: tx, y: ty, w: tabW - 2, h: 14, cat });
    });

    // --- item source grid --------------------------------------
    // Source slots are a palette, not storage: clicking one copies the item
    // onto the cursor, so they are tracked separately from player slots.
    this.sourceRects = [];
    const gridY = y + 40;
    const start = this.scroll * this.cols;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const sx = x + 8 + col * 18;
        const sy = gridY + row * 18;
        batch.rect(sx - 1, sy - 1, 18, 18, 0x8b8b8b, 1);
        const index = start + row * this.cols + col;
        const itemId = this.filtered[index];
        if (itemId === undefined) continue;
        hud.drawItem(new ItemStack(itemId, 1), sx, sy);
        this.sourceRects.push({ x: sx, y: sy, w: 16, h: 16, itemId });
      }
    }

    // --- scrollbar ---------------------------------------------
    const totalRows = Math.ceil(this.filtered.length / this.cols);
    const maxScroll = Math.max(0, totalRows - this.rows);
    const trackX = x + w - 12;
    const trackH = this.rows * 18 - 2;
    batch.rect(trackX, gridY, 8, trackH, 0x555555, 1);
    if (maxScroll > 0) {
      const knobH = Math.max(10, trackH / totalRows * this.rows);
      const knobY = gridY + (trackH - knobH) * (this.scroll / maxScroll);
      batch.rect(trackX, knobY, 8, knobH, 0xdddddd, 1);
    }

    // --- the player's own slots --------------------------------
    const inv = this.game.player.inventory;
    this.slotRects.length = 0;
    const rowsY = y + this.playerRowsY;
    hud.drawText(t('gui.inventory'), x + 8, rowsY - 11, { color: 0x404040, shadow: false });
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        const sx = x + 8 + col * 18;
        const sy = rowsY + row * 18;
        batch.rect(sx - 1, sy - 1, 18, 18, 0x8b8b8b, 1);
        this.addSlot(sx, sy, inv, SLOT.MAIN_START + row * 9 + col);
      }
    }
    // Hotbar, set slightly apart the way vanilla separates it.
    const hotbarY = rowsY + 3 * 18 + 4;
    for (let col = 0; col < 9; col++) {
      const sx = x + 8 + col * 18;
      batch.rect(sx - 1, hotbarY - 1, 18, 18, 0x8b8b8b, 1);
      this.addSlot(sx, hotbarY, inv, col);
    }
    for (const s of this.slotRects) hud.drawItem(s.inv.get(s.index), s.x, s.y);

    hud.drawText(t('gui.creativeHint'), x + 8, y + h - 12, { color: 0x404040, shadow: false });

    // --- hover highlight + tooltip + cursor stack --------------
    let hoveredId = null;
    let hoverRect = null;
    for (const s of this.sourceRects) {
      if (px >= s.x && py >= s.y && px < s.x + s.w && py < s.y + s.h) {
        hoveredId = s.itemId; hoverRect = s;
      }
    }
    for (const s of this.slotRects) {
      if (px >= s.x && py >= s.y && px < s.x + s.w && py < s.y + s.h) {
        const stack = s.inv.get(s.index);
        hoverRect = s;
        hoveredId = stack.isEmpty ? null : stack.id;
      }
    }
    if (hoverRect) batch.rect(hoverRect.x, hoverRect.y, 16, 16, 0xffffff, 0.35);
    if (hoveredId) {
      const def = getItem(hoveredId);
      if (def) {
        const label = entryName(def.name, def.displayName);
        const tw = hud.measure(label) + 8;
        const tx = Math.min(px + 10, batch.width - tw - 2);
        batch.rect(tx, Math.max(2, py - 14), tw, 14, 0x100010, 0.94);
        hud.drawText(label, tx + 4, Math.max(5, py - 11), { color: 0xffffff });
      }
    }
    const cursor = inv.cursor;
    if (!cursor.isEmpty) hud.drawItem(cursor, px - 8, py - 8);
  }

  mouseDown(px, py, button, ctx) {
    for (const tab of this.tabRects ?? []) {
      if (Screen.inside(px, py, tab)) { this.category = tab.cat; this.applyFilter(); return true; }
    }

    // A player slot behaves exactly as in the survival inventory.
    const slot = this.slotAt(px, py);
    if (slot) {
      this.handleSlotClick(slot, button, ctx?.shift ?? false);
      return true;
    }

    // A palette slot fills the cursor from thin air, or tops it up.
    for (const s of this.sourceRects ?? []) {
      if (px < s.x || py < s.y || px >= s.x + s.w || py >= s.y + s.h) continue;
      const cursor = this.game.player.inventory.cursor;
      const def = getItem(s.itemId);
      const max = def?.stackSize ?? 64;
      const count = button === 2 ? 1 : max;
      if (!cursor.isEmpty && cursor.id === s.itemId) {
        cursor.count = Math.min(max, cursor.count + count);
      } else {
        cursor.set(s.itemId, count);
      }
      return true;
    }

    // Clicking empty space discards the cursor stack, as in vanilla's
    // creative inventory where items come from nowhere and go nowhere.
    this.game.player.inventory.cursor.clear();
    return true;
  }

  wheel(delta) {
    const totalRows = Math.ceil(this.filtered.length / this.cols);
    const maxScroll = Math.max(0, totalRows - this.rows);
    this.scroll = Math.max(0, Math.min(maxScroll, this.scroll + Math.sign(delta)));
    return true;
  }

  key(code) {
    if (code === 'KeyE' || code === 'Escape') { this.game.closeScreen(); return true; }
    return false;
  }
}

/* ================================================================== */
/* menu screens                                                       */
/* ================================================================== */

/** Pause menu. */
export class PauseScreen extends Screen {
  get pausesGame() { return true; }

  draw(ctx) {
    const { hud, cursorX: px, cursorY: py } = ctx;
    const batch = hud.batch;
    this.drawBackdrop(batch);
    const cx = Math.floor(batch.width / 2);
    hud.drawText(t('pause.title'), cx, Math.floor(batch.height * 0.22), { align: 'center', scale: 2 });

    const bw = 200;
    const bx = cx - bw / 2;
    let by = Math.floor(batch.height * 0.34);
    this.buttons = [];
    const add = (label, action) => {
      const hover = px >= bx && py >= by && px < bx + bw && py < by + 20;
      this.drawButton(hud, bx, by, bw, 20, label, { hover });
      this.buttons.push({ x: bx, y: by, w: bw, h: 20, action });
      by += 24;
    };
    add(t('pause.resume'), 'resume');
    add(t('pause.settings'), 'settings');
    add(t('pause.save'), 'save');
    add(t('pause.mode', { mode: modeName(this.game.player.mode) }), 'mode');
    add(t('pause.quit'), 'quit');
  }

  mouseDown(px, py) {
    for (const b of this.buttons ?? []) {
      if (!Screen.inside(px, py, b)) continue;
      this.game.handleMenuAction(b.action);
      return true;
    }
    return true;
  }

  key(code) {
    if (code === 'Escape') { this.game.closeScreen(); return true; }
    return false;
  }
}

/** Settings screen with sliders and toggles. */
export class SettingsScreen extends Screen {
  get pausesGame() { return true; }

  constructor(game) {
    super(game);
    this.dragging = null;
  }

  /** The settings this screen exposes, with their ranges. */
  get rows() {
    const s = this.game.settings;
    return [
      { key: 'renderDistance', label: t('settings.renderDistance'), min: 2, max: 16, step: 1, value: s.renderDistance, format: (v) => t('settings.chunks', { n: v }) },
      { key: 'fov', label: t('settings.fov'), min: 50, max: 110, step: 1, value: s.fov, format: (v) => `${v}` },
      { key: 'sensitivity', label: t('settings.sensitivity'), min: 10, max: 200, step: 1, value: Math.round(s.sensitivity * 45454), format: (v) => `${v}%` },
      { key: 'brightness', label: t('settings.brightness'), min: 0, max: 40, step: 1, value: Math.round(s.brightness * 200), format: (v) => `${v}%` },
      { key: 'guiScale', label: t('settings.guiScale'), min: 0, max: 4, step: 1, value: s.guiScale, format: (v) => (v === 0 ? t('settings.guiAuto') : String(v)) },
      { key: 'masterVolume', label: t('settings.volume'), min: 0, max: 100, step: 1, value: Math.round(s.masterVolume * 100), format: (v) => `${v}%` },
      { key: 'language', label: t('settings.language'), cycle: true, value: LOCALE_NAMES[getLocale()] },
      { key: 'clouds', label: t('settings.clouds'), toggle: true, value: s.clouds },
      { key: 'viewBobbing', label: t('settings.viewBobbing'), toggle: true, value: s.viewBobbing },
      { key: 'showFps', label: t('settings.showFps'), toggle: true, value: s.showFps },
    ];
  }

  draw(ctx) {
    const { hud, cursorX: px, cursorY: py } = ctx;
    const batch = hud.batch;
    this.drawBackdrop(batch);
    const cx = Math.floor(batch.width / 2);
    hud.drawText(t('settings.title'), cx, 16, { align: 'center', scale: 2 });

    const rows = this.rows;
    const bw = 210;
    const bx = cx - bw / 2;
    let by = 44;
    this.controls = [];
    for (const row of rows) {
      const hover = px >= bx && py >= by && px < bx + bw && py < by + 18;
      if (row.toggle) {
        const state = row.value ? t('settings.on') : t('settings.off');
        this.drawButton(hud, bx, by, bw, 18, `${row.label}: ${state}`, { hover });
        this.controls.push({ x: bx, y: by, w: bw, h: 18, row, kind: 'toggle' });
      } else if (row.cycle) {
        // A button that steps through a fixed list, used for the language.
        this.drawButton(hud, bx, by, bw, 18, `${row.label}: ${row.value}`, { hover });
        this.controls.push({ x: bx, y: by, w: bw, h: 18, row, kind: 'cycle' });
      } else {
        // slider. `fraction` rather than `t` so the translation function
        // imported at the top of this module is not shadowed.
        batch.rect(bx, by, bw, 18, 0x000000, 1);
        batch.rect(bx + 1, by + 1, bw - 2, 16, 0x3a3a3a, 1);
        const fraction = (row.value - row.min) / (row.max - row.min);
        const knobX = bx + 2 + Math.round(fraction * (bw - 12));
        batch.rect(knobX, by + 1, 8, 16, hover ? 0x9a9a9a : 0x767676, 1);
        hud.drawText(`${row.label}: ${row.format(row.value)}`, bx + Math.floor(bw / 2), by + 5,
          { align: 'center', color: 0xffffff });
        this.controls.push({ x: bx, y: by, w: bw, h: 18, row, kind: 'slider' });
      }
      by += 21;
    }

    by += 6;
    const hoverDone = px >= bx && py >= by && px < bx + bw && py < by + 20;
    this.drawButton(hud, bx, by, bw, 20, t('settings.done'), { hover: hoverDone });
    this.doneButton = { x: bx, y: by, w: bw, h: 20 };
  }

  #applySlider(control, px) {
    const row = control.row;
    const fraction = Math.max(0, Math.min(1, (px - control.x - 4) / (control.w - 12)));
    const raw = row.min + fraction * (row.max - row.min);
    const value = Math.round(raw / row.step) * row.step;
    this.game.applySetting(row.key, value, true);
  }

  mouseDown(px, py) {
    if (this.doneButton && Screen.inside(px, py, this.doneButton)) {
      this.game.openScreen(new PauseScreen(this.game));
      return true;
    }
    for (const c of this.controls ?? []) {
      if (!Screen.inside(px, py, c)) continue;
      if (c.kind === 'toggle') this.game.applySetting(c.row.key, !c.row.value);
      else if (c.kind === 'cycle') this.game.applySetting(c.row.key, 'next');
      else { this.dragging = c; this.#applySlider(c, px); }
      return true;
    }
    return true;
  }

  mouseUp() { this.dragging = null; return true; }

  update(ctx) {
    if (this.dragging) this.#applySlider(this.dragging, ctx.cursorX);
  }

  key(code) {
    if (code === 'Escape') { this.game.openScreen(new PauseScreen(this.game)); return true; }
    return false;
  }
}

/** Death screen with a respawn button. */
export class DeathScreen extends Screen {
  get pausesGame() { return true; }

  draw(ctx) {
    const { hud, cursorX: px, cursorY: py } = ctx;
    const batch = hud.batch;
    batch.rect(0, 0, batch.width, batch.height, 0x8b0000, 0.45);
    const cx = Math.floor(batch.width / 2);
    hud.drawText(t('death.title'), cx, Math.floor(batch.height * 0.26), { align: 'center', scale: 2, color: 0xffffff });
    hud.drawText(t('death.score', { score: this.game.player.xpLevel * 7 }), cx, Math.floor(batch.height * 0.26) + 24,
      { align: 'center', color: 0xffffff });

    const bw = 200;
    const bx = cx - bw / 2;
    const by = Math.floor(batch.height * 0.45);
    const hover = px >= bx && py >= by && px < bx + bw && py < by + 20;
    this.drawButton(hud, bx, by, bw, 20, t('death.respawn'), { hover });
    this.respawnButton = { x: bx, y: by, w: bw, h: 20 };
  }

  mouseDown(px, py) {
    if (this.respawnButton && Screen.inside(px, py, this.respawnButton)) {
      this.game.respawn();
      return true;
    }
    return true;
  }

  key(code) {
    if (code === 'Enter' || code === 'Space') { this.game.respawn(); return true; }
    return false;
  }
}

/** Title screen shown before a world loads. */
export class TitleScreen extends Screen {
  get pausesGame() { return true; }
  get darkens() { return false; }

  constructor(game) {
    super(game);
    this.seedText = '';
    this.editingSeed = false;
    this.worldType = 'default';
  }

  draw(ctx) {
    const { hud, cursorX: px, cursorY: py } = ctx;
    const batch = hud.batch;
    this.drawDirtBackground(batch, this.game.renderer.textures);
    const cx = Math.floor(batch.width / 2);

    hud.drawText('WebCraft', cx, Math.floor(batch.height * 0.14), { align: 'center', scale: 3 });
    hud.drawText(t('title.subtitle'), cx, Math.floor(batch.height * 0.14) + 32,
      { align: 'center', color: 0xa0a0a0 });

    const bw = 200;
    const bx = cx - bw / 2;
    let by = Math.floor(batch.height * 0.36);
    this.buttons = [];
    const add = (label, action) => {
      const hover = px >= bx && py >= by && px < bx + bw && py < by + 20;
      this.drawButton(hud, bx, by, bw, 20, label, { hover });
      this.buttons.push({ x: bx, y: by, w: bw, h: 20, action });
      by += 24;
    };
    add(t('title.newWorld'), 'new');
    add(this.game.hasSave ? t('title.continue') : t('title.noSave'),
      this.game.hasSave ? 'load' : 'none');
    add(t('title.worldType', { type: worldTypeName(this.worldType) }), 'worldtype');
    add(t('title.seed', { seed: this.seedText || t('title.seedRandom') }), 'seed');
    add(t('title.settings'), 'settings');

    hud.drawText(t('title.hint'),
      cx, batch.height - 20, { align: 'center', color: 0xc0c0c0 });
  }

  mouseDown(px, py) {
    for (const b of this.buttons ?? []) {
      if (!Screen.inside(px, py, b)) continue;
      if (b.action === 'worldtype') {
        const types = ['default', 'amplified', 'flat', 'islands'];
        this.worldType = types[(types.indexOf(this.worldType) + 1) % types.length];
      } else if (b.action === 'seed') {
        this.editingSeed = true;
        this.game.controls.startTextCapture(this.seedText);
      } else if (b.action === 'new') {
        this.game.startWorld({ seed: this.seedText, worldType: this.worldType });
      } else if (b.action === 'load') {
        this.game.loadWorld();
      } else if (b.action === 'settings') {
        this.game.openScreen(new SettingsScreen(this.game));
      }
      return true;
    }
    return true;
  }

  key(code) {
    if (this.editingSeed && (code === 'Enter' || code === 'Escape')) {
      this.seedText = this.game.controls.endTextCapture();
      this.editingSeed = false;
      return true;
    }
    return false;
  }

  update() {
    if (this.editingSeed) this.seedText = this.game.controls.textBuffer;
  }
}

export { Screen, ContainerScreen };
