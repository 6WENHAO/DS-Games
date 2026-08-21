/**
 * audio/sound.js
 * ------------------------------------------------------------------
 * Web Audio sound manager for the game. It loads a manifest that maps
 * logical sound names ("dig_stone") to lists of audio files, lazily decodes
 * each logical sound on first use, caches the AudioBuffers and de-duplicates
 * concurrent loads. Every voice is routed through:
 *
 *   source ->[playbackRate] StereoPannerNode -> voiceGain -> categoryGain
 *          -> masterGain -> destination
 *
 * The module degrades gracefully: a missing AudioContext, a 404ing manifest
 * or a failed decode each log a single concise warning, after which the
 * manager behaves as a silent no-op. The game must never crash because audio
 * is unavailable.
 */

/** Mixer categories wired to the master bus. */
const CATEGORIES = ['blocks', 'players', 'ambient', 'ui'];

/**
 * Substitutes for block sound groups that have no recording of their own.
 *
 * The shipped sound set covers grass, stone, wood, sand, gravel and snow
 * footsteps, and grass/stone/wood/sand/gravel/glass/wool digs. The gaps are
 * mapped onto the closest material rather than all defaulting to stone,
 * because a wool floor that clacks like rock is immediately noticeable:
 *
 *   step_glass -> stone   (vanilla also treats glass as a hard "stone" step)
 *   step_wool  -> grass   (soft and muffled, the nearest soft step we have)
 *   dig_snow   -> grass   (crumbly, matching vanilla's soft snow break)
 */
const GROUP_SUBSTITUTES = {
  step_: { glass: 'stone', wool: 'grass', plant: 'grass', cloth: 'grass', metal: 'stone' },
  dig_: { snow: 'grass', plant: 'grass', cloth: 'wool', metal: 'stone' },
};

/** Clamps a value into [lo, hi]. */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Picks the mixer category a logical sound belongs to. 'ambient' is wired up
 * but currently unused by the shipped sounds; it exists for future ambience.
 * @param {string} name logical sound name.
 * @returns {'blocks'|'players'|'ambient'|'ui'}
 */
function categoryFor(name) {
  if (name === 'click') return 'ui';
  if (name === 'hurt' || name === 'swim' || name === 'splash' || name === 'pop') return 'players';
  return 'blocks';
}

export class SoundManager {
  /**
   * @param {{basePath?: string, master?: number, maxVoices?: number,
   *          sameSoundLimit?: number, sameSoundWindowMs?: number}} [opts]
   */
  constructor(opts = {}) {
    /** @type {string} Base URL directory that holds the sounds + manifest. */
    this.basePath = opts.basePath ?? 'assets/sounds/';
    /** @type {number} Master volume, 0..1. */
    this.masterVolume = clamp(opts.master ?? 1, 0, 1);
    /** @type {number} Maximum simultaneous voices before new ones are dropped. */
    this.maxVoices = opts.maxVoices ?? 32;
    /** @type {number} Max starts of the same logical sound within the window. */
    this.sameSoundLimit = opts.sameSoundLimit ?? 4;
    /** @type {number} Window (ms) for the same-sound start limiter. */
    this.sameSoundWindowMs = opts.sameSoundWindowMs ?? 40;

    /** @type {AudioContext|null} Created lazily in unlock()/preload(). */
    this._ctx = null;
    /** @type {GainNode|null} */
    this._master = null;
    /** @type {Record<string, GainNode>} One gain per category. */
    this._categories = Object.create(null);
    /** @type {boolean} True once the context is running. */
    this._ready = false;
    /** @type {boolean} Set when audio is permanently unavailable. */
    this._disabled = false;

    /** @type {Map<string, string[]>} logical name -> file names. */
    this._sounds = new Map();
    /** @type {Map<string, AudioBuffer[]>} decoded buffers per logical name. */
    this._buffers = new Map();
    /** @type {Map<string, Promise<AudioBuffer[]|null>>} in-flight decodes. */
    this._loads = new Map();
    /** @type {Set<string>} logical names that failed to decode (no retry). */
    this._failed = new Set();
    /** @type {Set<AudioBufferSourceNode>} live voices, for voice limiting. */
    this._active = new Set();
    /** @type {Map<string, number[]>} recent start timestamps per name. */
    this._recent = new Map();
    /** @type {Record<string, boolean>} one-shot warning de-dup. */
    this._warned = Object.create(null);

    /** @type {{x:number, y:number, z:number, yaw:number}} Listener state for playAt(). */
    this._listener = { x: 0, y: 0, z: 0, yaw: 0 };
    /** @type {Promise<void>|null} */
    this._initPromise = null;

    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) {
      this._disabled = true;
      this._warnOnce('context', 'AudioContext is not available; sound is disabled.');
    }
  }

  /**
   * Fetches the manifest and records the logical-name -> file list. Does not
   * decode anything. Safe to call more than once (the fetch is shared).
   * @returns {Promise<void>}
   */
  init() {
    if (!this._initPromise) this._initPromise = this._doInit();
    return this._initPromise;
  }

  /** @returns {Promise<void>} */
  async _doInit() {
    if (this._disabled) return;
    const url = `${this.basePath}manifest.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sounds = data && data.sounds ? data.sounds : {};
      for (const [name, files] of Object.entries(sounds)) {
        if (Array.isArray(files) && files.length) this._sounds.set(name, files.slice());
      }
    } catch (err) {
      this._warnOnce('manifest', `Sound manifest failed to load (${url}); sounds are disabled.`);
    }
  }

  /**
   * Must be called from a real user-gesture handler (click/keydown) to satisfy
   * the browser autoplay policy. Creates the AudioContext if needed and resumes
   * it. Idempotent.
   * @returns {Promise<void>}
   */
  async unlock() {
    if (this._disabled) return;
    if (!this._ctx) this._createContext();
    if (!this._ctx) return;
    if (this._ctx.state === 'suspended') {
      try {
        await this._ctx.resume();
      } catch (err) {
        this._warnOnce('resume', `AudioContext could not be resumed: ${err && err.message ? err.message : err}`);
      }
    }
    this._ready = this._ctx.state === 'running';
  }

  /**
   * Creates the context plus the master and per-category gains. Does not resume.
   * @returns {AudioContext|null}
   */
  _createContext() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) {
      this._disabled = true;
      this._warnOnce('context', 'AudioContext is not available; sound is disabled.');
      return null;
    }
    try {
      const ctx = new AC();
      this._ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.masterVolume;
      master.connect(ctx.destination);
      this._master = master;
      for (const cat of CATEGORIES) {
        const g = ctx.createGain();
        g.gain.value = 1;
        g.connect(master);
        this._categories[cat] = g;
      }
      return ctx;
    } catch (err) {
      this._disabled = true;
      this._warnOnce('context', `AudioContext could not be created: ${err && err.message ? err.message : err}`);
      return null;
    }
  }

  /** @returns {boolean} True once unlock() succeeded and the context is running. */
  get ready() {
    return this._ready && !!this._ctx && this._ctx.state === 'running';
  }

  /**
   * Plays a logical sound, picking a random variation.
   * @param {string} name logical name, e.g. 'dig_stone'.
   * @param {{volume?: number, pitch?: number, pan?: number, category?: string}} [opts]
   *        volume 0..1, pitch playbackRate multiplier, pan -1..1. `category`
   *        overrides the automatic category choice (see categoryFor).
   * @returns {boolean} false when the sound is unknown/not loaded/audio locked.
   */
  play(name, opts = {}) {
    const buffers = this._resolveBuffers(name);
    if (!buffers) return false;
    return this._start(
      buffers[(Math.random() * buffers.length) | 0],
      {
        volume: opts.volume ?? 1,
        pitch: opts.pitch ?? 1,
        pan: opts.pan ?? 0,
        category: opts.category ?? categoryFor(name),
      },
      name,
    );
  }

  /**
   * Plays a sound positioned in the world relative to the listener; attenuates
   * with distance (linear rolloff to zero at `maxDistance`, default 24) and pans
   * based on the listener's facing.
   * @param {string} name
   * @param {number} x @param {number} y @param {number} z
   * @param {{volume?: number, pitch?: number, maxDistance?: number, category?: string}} [opts]
   * @returns {boolean} false when unknown/not loaded/locked or fully attenuated.
   */
  playAt(name, x, y, z, opts = {}) {
    const buffers = this._resolveBuffers(name);
    if (!buffers) return false;

    const dx = x - this._listener.x;
    const dy = y - this._listener.y;
    const dz = z - this._listener.z;
    const dist = Math.hypot(dx, dy, dz);
    const maxDistance = opts.maxDistance ?? 24;
    if (dist >= maxDistance) return false;

    const volume = (opts.volume ?? 1) * (1 - dist / maxDistance);
    const pan = this._computePan(dx, dz);
    return this._start(
      buffers[(Math.random() * buffers.length) | 0],
      { volume, pitch: opts.pitch ?? 1, pan, category: opts.category ?? categoryFor(name) },
      name,
    );
  }

  /**
   * Updates the listener position/orientation used by playAt().
   * @param {number} x @param {number} y @param {number} z
   * @param {number} yaw in radians.
   */
  setListener(x, y, z, yaw) {
    this._listener.x = x;
    this._listener.y = y;
    this._listener.z = z;
    this._listener.yaw = yaw;
  }

  /**
   * @param {number} dx relative X (source - listener).
   * @param {number} dz relative Z (source - listener).
   * @returns {number} pan in -1..1.
   */
  _computePan(dx, dz) {
    const hDist = Math.hypot(dx, dz);
    if (hDist < 1e-6) return 0;
    // Forward is (-sin yaw, -cos yaw) in the XZ plane; the sine of the angle
    // between forward and the source direction gives the -1..1 pan.
    const yaw = this._listener.yaw;
    const pan = (Math.cos(yaw) * dx - Math.sin(yaw) * dz) / hDist;
    return clamp(pan, -1, 1);
  }

  /** @param {number} v Master gain 0..1. */
  setMasterVolume(v) {
    this.masterVolume = clamp(v, 0, 1);
    const ctx = this._ctx;
    if (ctx && this._master) {
      this._master.gain.setTargetAtTime(this.masterVolume, ctx.currentTime, 0.02);
    }
  }

  /** @returns {number} */
  getMasterVolume() {
    return this.masterVolume;
  }

  /**
   * @param {'blocks'|'players'|'ambient'|'ui'} category
   * @param {number} v per-category gain 0..1.
   */
  setCategoryVolume(category, v) {
    const ctx = this._ctx;
    const gain = this._categories[category];
    if (ctx && gain) gain.gain.setTargetAtTime(clamp(v, 0, 1), ctx.currentTime, 0.02);
  }

  /**
   * Footstep helper: 'grass' -> 'step_grass'. Groups without their own
   * recording fall back through GROUP_SUBSTITUTES. Pitch is randomised
   * 0.9-1.1 like vanilla.
   * @param {string} soundGroup e.g. 'grass', 'stone', 'sand'.
   * @param {number} x @param {number} y @param {number} z
   * @returns {boolean}
   */
  playStep(soundGroup, x, y, z) {
    return this.playAt(this._groupName('step_', soundGroup), x, y, z, {
      pitch: 0.9 + Math.random() * 0.2,
    });
  }

  /**
   * Dig/break helper: 'grass' -> 'dig_grass'. Groups without their own
   * recording fall back through GROUP_SUBSTITUTES. Pitch is randomised
   * 0.85-1.05 like vanilla.
   * @param {string} soundGroup
   * @param {number} x @param {number} y @param {number} z
   * @returns {boolean}
   */
  playDig(soundGroup, x, y, z) {
    return this.playAt(this._groupName('dig_', soundGroup), x, y, z, {
      pitch: 0.85 + Math.random() * 0.2,
    });
  }

  /**
   * Place helper. Vanilla reuses the dig sound for placing at a lower pitch,
   * so this plays 'dig_<group>' at ~0.7-0.9, falling back to 'place_generic'
   * when the group has no dig sound.
   * @param {string} soundGroup
   * @param {number} x @param {number} y @param {number} z
   * @returns {boolean}
   */
  playPlace(soundGroup, x, y, z) {
    const dig = this._groupName('dig_', soundGroup);
    const name = this._sounds.has(dig) ? dig : 'place_generic';
    return this.playAt(name, x, y, z, {
      pitch: 0.7 + Math.random() * 0.2,
    });
  }

  /**
   * Resolves 'prefix + group' against the manifest.
   *
   * Order: the group's own sound, then its material substitute (see
   * GROUP_SUBSTITUTES), then 'prefix + stone' as the last resort.
   * @param {'step_'|'dig_'} prefix
   * @param {string} group
   * @returns {string}
   */
  _groupName(prefix, group) {
    const g = String(group || 'stone').toLowerCase();
    const direct = prefix + g;
    if (this._sounds.has(direct)) return direct;

    const substitute = GROUP_SUBSTITUTES[prefix]?.[g];
    if (substitute) {
      const name = prefix + substitute;
      if (this._sounds.has(name)) return name;
    }
    return `${prefix}stone`;
  }

  /**
   * Optionally decode a set of logical sounds ahead of time.
   * @param {string[]} names
   * @returns {Promise<void>}
   */
  async preload(names) {
    if (this._disabled) return;
    if (!this._ctx) this._createContext();
    if (!this._ctx) return;
    await Promise.all(names.map((n) => this._ensureLoaded(n)));
  }

  /** Frees decoded buffers and closes the context. */
  dispose() {
    for (const src of this._active) {
      try { src.onended = null; src.stop(); } catch { /* ignore */ }
    }
    this._active.clear();
    this._recent.clear();
    this._buffers.clear();
    this._loads.clear();
    this._failed.clear();
    if (this._ctx) {
      const ctx = this._ctx;
      this._ctx = null;
      this._master = null;
      this._categories = Object.create(null);
      this._ready = false;
      try { ctx.close(); } catch { /* ignore */ }
    }
  }

  /**
   * Returns cached buffers for a sound, or kicks off a lazy load and returns
   * null. Never blocks play().
   * @param {string} name
   * @returns {AudioBuffer[]|null}
   */
  _resolveBuffers(name) {
    if (this._disabled || !this._ready) return null;
    if (!this._sounds.has(name)) return null;
    const cached = this._buffers.get(name);
    if (cached && cached.length) return cached;
    this._ensureLoaded(name).catch(() => {});
    return null;
  }

  /**
   * Starts one voice through the graph and returns success.
   * @param {AudioBuffer} buffer
   * @param {{volume:number, pitch:number, pan:number, category:string}} o
   * @param {string} name logical name (for the same-sound limiter).
   * @returns {boolean}
   */
  _start(buffer, { volume = 1, pitch = 1, pan = 0, category = 'blocks' }, name) {
    const ctx = this._ctx;
    if (this._active.size >= this.maxVoices) return false;
    if (!this._allowStart(name)) return false;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;
    source.playbackRate.value = pitch;

    let node = source;
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      node.connect(panner);
      node = panner;
    } else if (pan !== 0) {
      this._warnOnce('panner', 'StereoPannerNode unavailable; panning is ignored.');
    }

    const gain = ctx.createGain();
    gain.gain.value = clamp(volume, 0, 1);
    node.connect(gain);

    const catGain = this._categories[category] || this._categories.blocks;
    gain.connect(catGain);

    this._active.add(source);
    const release = () => {
      this._active.delete(source);
      try { source.disconnect(); gain.disconnect(); } catch { /* already disconnected */ }
    };
    source.onended = release;
    try {
      source.start();
    } catch (err) {
      release();
      return false;
    }
    return true;
  }

  /**
   * Same-sound burst limiter: allows at most `sameSoundLimit` starts of one
   * logical sound within `sameSoundWindowMs`, preventing machine-gun artefacts
   * when many blocks break at once.
   * @param {string} name
   * @returns {boolean}
   */
  _allowStart(name) {
    const now = performance.now();
    let bucket = this._recent.get(name);
    if (!bucket) { bucket = []; this._recent.set(name, bucket); }
    let head = 0;
    while (head < bucket.length && now - bucket[head] > this.sameSoundWindowMs) head++;
    if (head > 0) bucket.splice(0, head);
    if (bucket.length >= this.sameSoundLimit) return false;
    bucket.push(now);
    return true;
  }

  /**
   * Decodes a logical sound, de-duplicating concurrent requests.
   * @param {string} name
   * @returns {Promise<AudioBuffer[]|null>}
   */
  async _ensureLoaded(name) {
    const cached = this._buffers.get(name);
    if (cached && cached.length) return cached;
    if (this._failed.has(name)) return null;
    const existing = this._loads.get(name);
    if (existing) return existing;

    const p = this._decodeName(name);
    this._loads.set(name, p);
    try {
      return await p;
    } finally {
      this._loads.delete(name);
    }
  }

  /**
   * @param {string} name
   * @returns {Promise<AudioBuffer[]|null>}
   */
  async _decodeName(name) {
    const files = this._sounds.get(name);
    if (!files || !files.length) { this._failed.add(name); return null; }
    const results = await Promise.all(files.map((f) => this._decodeOne(f)));
    const buffers = results.filter(Boolean);
    if (!buffers.length) {
      this._failed.add(name);
      this._warnOnce(`decode:${name}`, `Sound "${name}" could not be loaded or decoded.`);
      return null;
    }
    this._buffers.set(name, buffers);
    return buffers;
  }

  /**
   * Fetches and decodes a single file; returns null on any failure.
   * @param {string} filename
   * @returns {Promise<AudioBuffer|null>}
   */
  async _decodeOne(filename) {
    const ctx = this._ctx;
    const url = this.basePath + filename;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch (err) {
      return null;
    }
  }

  /** @param {string} key @param {string} message */
  _warnOnce(key, message) {
    if (this._warned[key]) return;
    this._warned[key] = true;
    console.warn(`[sound] ${message}`);
  }
}

/** Ready-to-use singleton the rest of the game imports. */
export const sound = new SoundManager();
