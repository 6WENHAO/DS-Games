// Tiny inventory: collectibles, mora, quest items. Read by the UI backpack panel.
export const ITEM_DEFS = {
  mora: { name: '摩拉', rarity: 1, kind: 'currency', icon: 'coin' },
  cecilia: { name: '塞西莉亚花', rarity: 3, kind: 'material', icon: 'flower' },
  windwheel: { name: '风车菊', rarity: 2, kind: 'material', icon: 'flower' },
  smallLamp: { name: '小灯草', rarity: 3, kind: 'material', icon: 'flower' },
  dandelion: { name: '蒲公英籽', rarity: 2, kind: 'material', icon: 'flower' },
  berry: { name: '树莓', rarity: 1, kind: 'food', icon: 'food' },
  sunsettia: { name: '日落果', rarity: 1, kind: 'food', icon: 'food' },
  mushroom: { name: '蘑菇', rarity: 1, kind: 'food', icon: 'food' },
  ironChunk: { name: '铁块', rarity: 1, kind: 'ore', icon: 'ore' },
  crystalChunk: { name: '水晶块', rarity: 3, kind: 'ore', icon: 'ore' },
  slimeCondensate: { name: '史莱姆凝液', rarity: 1, kind: 'drop', icon: 'drop' },
  mask: { name: '破损的面具', rarity: 1, kind: 'drop', icon: 'drop' },
  arrowhead: { name: '牢固的箭簇', rarity: 1, kind: 'drop', icon: 'drop' },
  scroll: { name: '古老的手记', rarity: 4, kind: 'quest', icon: 'book' },
  anemoSigil: { name: '风之印', rarity: 4, kind: 'quest', icon: 'sigil' },
  primogem: { name: '原石', rarity: 5, kind: 'currency', icon: 'gem' },
  expBook: { name: '大英雄的经验', rarity: 4, kind: 'exp', icon: 'book' },
};

export class Inventory {
  constructor(ctx) { this.ctx = ctx; this.items = new Map(); this.add('mora', 500, true); }
  count(id) { return this.items.get(id) ?? 0; }
  add(id, n = 1, silent = false) {
    const def = ITEM_DEFS[id] ?? { name: id, rarity: 1 };
    this.items.set(id, (this.items.get(id) ?? 0) + n);
    if (!silent) {
      this.ctx.ui?.toast?.(`${def.name} ×${n}`, { icon: def.icon, rarity: def.rarity });
      this.ctx.audio?.sfx?.('ui_confirm', { vol: 0.5 });
      this.ctx.events.emit('inventory:add', { id, n, def });
    }
    return this.items.get(id);
  }
  remove(id, n = 1) {
    const c = this.items.get(id) ?? 0;
    if (c < n) return false;
    this.items.set(id, c - n);
    return true;
  }
  list() {
    return [...this.items.entries()].filter(([, n]) => n > 0)
      .map(([id, n]) => ({ id, n, ...(ITEM_DEFS[id] ?? { name: id, rarity: 1 }) }))
      .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
  }
}
