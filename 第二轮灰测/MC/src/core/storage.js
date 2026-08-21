/**
 * core/storage.js
 * ------------------------------------------------------------------
 * Persistence: worlds go to IndexedDB (chunks can be megabytes), while
 * settings go to localStorage (small, synchronous, survives everything).
 *
 * Only chunks the player actually modified are stored; everything else is
 * regenerated from the seed, which keeps a save small.
 *
 * Every method degrades gracefully: private-browsing modes and disabled
 * storage make saving a no-op rather than a crash.
 */

const DB_NAME = 'webcraft';
const DB_VERSION = 1;
const STORE_META = 'meta';
const STORE_CHUNKS = 'chunks';
const SETTINGS_KEY = 'webcraft.settings.v1';

/** Opens (and if needed upgrades) the database. */function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) db.createObjectStore(STORE_CHUNKS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

/** Promise wrapper around an IDBRequest. */
function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class WorldStorage {
  constructor(slot = 'world1') {
    this.slot = slot;
    this.db = null;
    this.available = true;
    this.lastError = null;
  }

  async open() {
    if (this.db) return this.db;
    try {
      this.db = await openDatabase();
      return this.db;
    } catch (err) {
      this.available = false;
      this.lastError = err;
      console.warn(`[storage] persistence disabled: ${err.message}`);
      return null;
    }
  }

  #key(cx, cz) { return `${this.slot}:${cx},${cz}`; }

  /** True when a save exists for this slot. */
  async hasSave() {
    const db = await this.open();
    if (!db) return false;
    try {
      const tx = db.transaction(STORE_META, 'readonly');
      const value = await requestToPromise(tx.objectStore(STORE_META).get(this.slot));
      return !!value;
    } catch { return false; }
  }

  /**
   * Writes the world header plus every modified chunk.
   * @param {object} meta {seed, worldType, player, day, spawnPoint, rules}
   * @param {Array<object>} chunkRecords output of Chunk#serialise
   */
  async save(meta, chunkRecords) {
    const db = await this.open();
    if (!db) return false;
    try {
      const tx = db.transaction([STORE_META, STORE_CHUNKS], 'readwrite');
      const metaStore = tx.objectStore(STORE_META);
      const chunkStore = tx.objectStore(STORE_CHUNKS);
      metaStore.put({ ...meta, savedAt: Date.now(), version: 1 }, this.slot);
      for (const record of chunkRecords) {
        chunkStore.put(record, this.#key(record.cx, record.cz));
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
      });
      return true;
    } catch (err) {
      this.lastError = err;
      console.warn(`[storage] save failed: ${err.message}`);
      return false;
    }
  }

  /** Reads the world header, or null. */
  async loadMeta() {
    const db = await this.open();
    if (!db) return null;
    try {
      const tx = db.transaction(STORE_META, 'readonly');
      return (await requestToPromise(tx.objectStore(STORE_META).get(this.slot))) ?? null;
    } catch { return null; }
  }

  /** Reads every stored chunk for this slot. */
  async loadChunks() {
    const db = await this.open();
    if (!db) return [];
    try {
      const tx = db.transaction(STORE_CHUNKS, 'readonly');
      const store = tx.objectStore(STORE_CHUNKS);
      const prefix = `${this.slot}:`;
      const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
      const records = await requestToPromise(store.getAll(range));
      return records ?? [];
    } catch (err) {
      console.warn(`[storage] chunk load failed: ${err.message}`);
      return [];
    }
  }

  /** Deletes the save in this slot. */
  async deleteSave() {
    const db = await this.open();
    if (!db) return false;
    try {
      const tx = db.transaction([STORE_META, STORE_CHUNKS], 'readwrite');
      tx.objectStore(STORE_META).delete(this.slot);
      const prefix = `${this.slot}:`;
      tx.objectStore(STORE_CHUNKS).delete(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
      await new Promise((resolve) => { tx.oncomplete = resolve; tx.onerror = resolve; });
      return true;
    } catch { return false; }
  }

  /** Approximate save size, for the debug overlay. */
  async estimateSize() {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
    try {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage, quota };
    } catch { return null; }
  }
}

/* ------------------------------------------------------------------ */
/* settings                                                          */
/* ------------------------------------------------------------------ */

/** Defaults for every persisted setting. */
export const DEFAULT_SETTINGS = {
  renderDistance: 8,
  fov: 70,
  sensitivity: 0.0022,
  invertY: false,
  brightness: 0.08,
  guiScale: 0,
  resolutionScale: 1,
  masterVolume: 0.7,
  clouds: true,
  stars: true,
  viewBobbing: true,
  showFps: false,
  smoothLighting: true,
  /** Locale tag; empty means auto-detect from the browser. */
  language: '',
};

/** Reads settings from localStorage, merged over the defaults. */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const out = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key in parsed && typeof parsed[key] === typeof DEFAULT_SETTINGS[key]) {
        out[key] = parsed[key];
      }
    }
    return out;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Writes settings, ignoring quota or privacy-mode failures. */
export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

