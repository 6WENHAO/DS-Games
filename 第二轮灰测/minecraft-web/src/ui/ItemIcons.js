/* =====================================================================
 * ItemIcons — 物品图标（由贴图图集在 canvas 上合成，缓存为 dataURL）
 * ===================================================================== */
import { getItem } from '../data/items.js';
import { blockByName } from '../data/blocks.js';

let atlas = null;
const cache = new Map();

export function initIcons(a) { atlas = a; cache.clear(); }

export function iconUrl(itemName) {
  if (!itemName) return null;
  if (cache.has(itemName)) return cache.get(itemName);
  if (!atlas) return null;
  const item = getItem(itemName);
  const block = blockByName(itemName);
  const url = atlas.itemIcon(item, block);
  cache.set(itemName, url);
  return url;
}

export function displayName(itemName) {
  const item = getItem(itemName);
  if (item) return item.display;
  const b = blockByName(itemName);
  return b ? b.display : itemName;
}

/** 创建一个 <img> 图标元素 */
export function makeIcon(itemName, cls = 'item-icon') {
  const img = document.createElement('img');
  img.className = cls;
  img.draggable = false;
  const url = iconUrl(itemName);
  if (url) img.src = url;
  img.alt = displayName(itemName);
  return img;
}

/** 渲染一个物品槽的内容（复用 DOM） */
export function fillSlot(el, stack) {
  el.innerHTML = '';
  if (!stack) return;
  const img = makeIcon(stack.item);
  el.appendChild(img);
  if (stack.count > 1) {
    const c = document.createElement('span');
    c.className = 'item-count';
    c.textContent = stack.count;
    el.appendChild(c);
  }
  const item = getItem(stack.item);
  if (item && item.durability && stack.dura > 0 && stack.dura < item.durability) {
    const bar = document.createElement('div');
    bar.className = 'item-dura';
    const inner = document.createElement('i');
    const ratio = stack.dura / item.durability;
    inner.style.width = Math.round(ratio * 100) + '%';
    inner.style.background = ratio > 0.5 ? '#3cdd3c' : ratio > 0.25 ? '#ddd93c' : '#dd3c3c';
    bar.appendChild(inner);
    el.appendChild(bar);
  }
}
