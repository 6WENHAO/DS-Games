// LocalStorage save slot.
const KEY = 'no_blocks_sky_save_v1';

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, ts: Date.now(), data }));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj?.data || null;
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function saveInfo() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return { ts: obj.ts, seed: obj.data?.seed, units: obj.data?.units };
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
