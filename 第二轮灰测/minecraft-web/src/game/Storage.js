/* =====================================================================
 * Storage — 存档（localStorage）
 *  只保存种子 + 玩家改动的方块差异 + 玩家状态，体积极小
 * ===================================================================== */
import { STORAGE } from '../core/Constants.js';

export function listWorlds() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE.WORLD_PREFIX)) continue;
      try {
        const raw = JSON.parse(localStorage.getItem(key));
        out.push({
          key,
          id: key.slice(STORAGE.WORLD_PREFIX.length),
          name: raw.name || '未命名',
          seed: raw.seed,
          type: raw.type || 'default',
          savedAt: raw.savedAt || 0,
          edits: (raw.edits || []).length,
        });
      } catch (e) { /* 跳过损坏的存档 */ }
    }
  } catch (e) { /* localStorage 不可用 */ }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function worldKey(id) {
  return STORAGE.WORLD_PREFIX + id;
}

export function saveWorld(id, payload) {
  try {
    payload.savedAt = Date.now();
    const json = JSON.stringify(payload);
    localStorage.setItem(worldKey(id), json);
    localStorage.setItem(STORAGE.LAST_WORLD, id);
    return { ok: true, bytes: json.length };
  } catch (e) {
    console.warn('[Storage] 保存失败', e);
    return { ok: false, error: e.message };
  }
}

export function loadWorld(id) {
  try {
    const raw = localStorage.getItem(worldKey(id));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[Storage] 读取失败', e);
    return null;
  }
}

export function deleteWorld(id) {
  try { localStorage.removeItem(worldKey(id)); return true; }
  catch (e) { return false; }
}

export function lastWorldId() {
  try { return localStorage.getItem(STORAGE.LAST_WORLD); }
  catch (e) { return null; }
}

export function makeWorldId(name) {
  const base = String(name || 'world').replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 24);
  return base + '_' + Date.now().toString(36);
}

/** 存档体积估算（KB） */
export function storageUsage() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      bytes += (k.length + (localStorage.getItem(k) || '').length) * 2;
    }
  } catch (e) { /* ignore */ }
  return bytes / 1024;
}
