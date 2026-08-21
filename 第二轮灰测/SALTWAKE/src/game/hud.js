/**
 * SALTWAKE — HUD renderer.
 *
 * Layout (internal 320x200, 16:10):
 *   - Bottom strip (y 168..200): water-stained torn paper, pinned.
 *   - Left: brass pressure gauge (health) at (54,174) r24, with a numeral
 *     inside the face, a sweeping needle, and a hairline glass crack.
 *   - Left-mid: riveted brass armor plate at (92,176) 30x18 with a numeral
 *     and a wear bar.
 *   - Centre: paper ammo label (124..268 x 166..200): ammo kind, large
 *     loaded / reserve numerals, cartridge pips, and a count caption.
 *   - Centre-top: six numbered brass weapon tabs (y 155..165).
 *   - Right: brass sanity dial at (293,174) r24 with an engraved scale,
 *     drifting needle, corrupted numbers, and a static hairline.
 *   - Top-left: objective line (y 4) and key icons (y 16).
 *   - Centre: pixel crosshair (160,100).
 *   - Overlays: directional damage vignette, pickup flash, secret flash,
 *     title card, ending screen.
 *
 * Drawing order per frame (in _render):
 *   1. clearRect         2. paper strip         3. ammo label
 *   4. weapon tabs       5. key icons           6. armor plate
 *   7. health gauge      8. sanity dial         9. objective
 *   10. subtitle         11. crosshair          12. damage vignette
 *   13. pickup flash     14. secret flash       15. title card
 *   16. ending screen
 *
 * All artwork is drawn as pixels: the digits and labels use a hand-authored
 * 5x7 bitmap font baked into offscreen atlases at construction, and every
 * texture (paper, bezel, plate, scrap, dither mask, key icons) is generated
 * once from a seeded PRNG. The hot path (update) allocates nothing.
 */

'use strict';

/* ------------------------------------------------------------------ *
 * Constants and static pixel data
 * ------------------------------------------------------------------ */

const W = 320;
const H = 200;

const FONT_W = 5;
const FONT_H = 7;
const GLYPH_CELL = 6; // 5px glyph + 1px advance gap

const ALIGN_LEFT = 0;
const ALIGN_CENTER = 1;
const ALIGN_RIGHT = 2;

const R_GAUGE = 24;
const DEG = Math.PI / 180;

const PAL = {
  tealDark: '#0f1e1c',
  teal: '#1b2f2a',
  brown: '#4a4136',
  brownLt: '#6b5c48',
  amber: '#c98b2e',
  amberLt: '#e8b45a',
  redDk: '#7a1f14',
  red: '#b8341c',
  paper: '#d8cdb0',
  paperLt: '#efe6cc',
  ink: '#1f1a12',
};

const ATLAS_COLORS = {
  bone: '#efe6cc',
  amber: '#e8b45a',
  ink: '#1f1a12',
  red: '#b8341c',
  dim: '#6b5c48',
};

/** Hand-authored 5x7 bitmap font. '1' = set pixel, '0' = clear. */
const FONT = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '10001', '11001', '10101', '10011', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  "'": ['00100', '00100', '00000', '00000', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
};

/** 8x8 key/sigil icons. A=amber, B=bone, D=teal dark, R=red, K=ink. */
const KEY_BRASS = [
  '..AAAA..',
  '.AB..BA.',
  '.A....A.',
  '.A....A.',
  '..AAAA..',
  '....A...',
  '...AA...',
  '...A.A..',
];
const KEY_BONE = [
  '..BBBB..',
  '.BBBBBB.',
  '.BBBBBB.',
  '..BBBB..',
  '..BBBB..',
  '..BBBB..',
  '.BBBBBB.',
  '.BBBBBB.',
];
const KEY_DROWNED = [
  '.A..A.A.',
  '.D..D.D.',
  '..A.A.A.',
  '..AAAA..',
  '...DD...',
  '...AA...',
  '..A..A..',
  '.A....A.',
];

const KEY_COLORS = { A: PAL.amber, B: PAL.paperLt, D: PAL.tealDark, R: PAL.red, K: PAL.ink };

/** 11 tick angles along the 240 degree sweep (0 = up, clockwise positive). */
const TICK_ANGLES = (function () {
  const a = [];
  for (let i = 0; i <= 10; i++) a.push((-120 + i * 24) * DEG);
  return a;
})();

/** 6 engraved scale labels for the sanity dial. */
const SCALE_LABELS = ['0', '20', '40', '60', '80', '100'];
const SCALE_ANGLES = (function () {
  const a = [];
  for (let i = 0; i < 6; i++) a.push((-120 + i * 48) * DEG);
  return a;
})();

const SLOT_NUMS = ['1', '2', '3', '4', '5', '6'];

/** Map a 0..1 value onto the gauge sweep, in radians (0 = up, + = clockwise). */
function angleFor(v) {
  return (-120 + 240 * v) * DEG;
}

/** Small deterministic 32-bit PRNG (mulberry32). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * Hud
 * ------------------------------------------------------------------ */

export class Hud {
  /**
   * Builds the HUD and mounts its canvas into `root`.
   * If a 2D context cannot be created, the instance stays in no-op mode:
   * every public method returns without doing anything.
   * @param {HTMLElement} root element to append the HUD canvas to
   */
  constructor(root) {
    this.ok = false;
    this.canvas = null;
    this.ctx = null;

    if (typeof document === 'undefined' || !root) return;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.className = 'saltwake-hud';
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) {
      this.canvas = canvas;
      return;
    }

    this.canvas = canvas;
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    if (root.appendChild) root.appendChild(canvas);
    this.ok = true;

    this._buildCaches();
    this._initState();
  }

  /**
   * @param {number} current health points
   * @param {number} max     health capacity
   */
  setHealth(current, max) {
    if (!this.ok) return;
    const mx = this._pos(max, 100);
    this.healthMax = mx < 1 ? 1 : mx;
    this.health = this._clampInt(current, 0, this.healthMax);
    this.healthStr = '' + this.health;
  }

  /**
   * @param {number} current armor points
   * @param {number} max     armor capacity
   */
  setArmor(current, max) {
    if (!this.ok) return;
    const mx = this._pos(max, 100);
    this.armorMax = mx < 1 ? 1 : mx;
    this.armor = this._clampInt(current, 0, this.armorMax);
    this.armorStr = '' + this.armor;
  }

  /**
   * Sets the current weapon's ammo readout.
   * @param {string} kind     ammo name, e.g. 'brass' | 'shell' | 'harpoon' | 'oil' | 'ichor' | 'bone'
   * @param {number} loaded   rounds in the weapon
   * @param {number} reserve  rounds carried
   * @param {number} capacity weapon capacity (unused for drawing; kept for callers)
   */
  setAmmo(kind, loaded, reserve, capacity) {
    if (!this.ok) return;
    this.ammoKind = typeof kind === 'string' && kind ? kind : 'shell';
    this.ammoKindLabel = this.ammoKind.toUpperCase();
    this.ammoLoaded = this._clampInt(loaded, 0, 9999);
    this.ammoReserve = this._clampInt(reserve, 0, 9999);
    this.ammoCapacity = this._clampInt(capacity, 0, 9999);
    this.ammoLoadedStr = '' + this.ammoLoaded;
    this.ammoReserveStr = '' + this.ammoReserve;
    this.ammoCaption = 'LOADED ' + this.ammoLoaded + ', RESERVE ' + this.ammoReserve;
  }

  /**
   * @param {number} value01 sanity from 0 (gone) to 1 (sound)
   */
  setSanity(value01) {
    if (!this.ok) return;
    const nv = this._clamp01(value01);
    const before = angleFor(this.sanity);
    this.sanity = nv;
    const after = angleFor(nv);
    // Dropping sanity kicks the needle past its target; it settles next.
    if (after < before - 0.05) this.sanityOvershoot = (after - before) * 0.5;
  }

  /**
   * @param {boolean[]} owned       per-slot ownership (index 0..5)
   * @param {number}    activeIndex currently selected slot
   * @param {string[]}  names       per-slot weapon names (stored, not drawn)
   */
  setWeapons(owned, activeIndex, names) {
    if (!this.ok) return;
    this.weaponsOwned = Array.isArray(owned) ? owned.slice() : [];
    this.weaponActive = this._clampInt(activeIndex, 0, 5);
    this.weaponNames = Array.isArray(names) ? names.slice() : [];
  }

  /**
   * @param {string[]} keys collected key ids, e.g. 'brass' | 'bone' | 'drowned'
   */
  setKeys(keys) {
    if (!this.ok) return;
    this.keys = Array.isArray(keys) ? keys.slice() : [];
  }

  /**
   * Flashes a directional damage vignette.
   * @param {number} dir    radians relative to view forward
   * @param {number} amount 0..1 flash strength
   */
  flashDamage(dir, amount) {
    if (!this.ok) return;
    this.damageDir = isFinite(+dir) ? +dir : 0;
    this.damageAmount = this._clamp01(amount);
    this.damageT = this.damageDur;
  }

  /**
   * @param {string} kind pickup name, shown briefly in amber
   */
  flashPickup(kind) {
    if (!this.ok) return;
    this.pickupLabel = (typeof kind === 'string' ? kind : '').toUpperCase();
    this.pickupT = 0.8;
  }

  /**
   * @param {number}  spread01 crosshair spread from 0 (tight) to 1 (wide)
   * @param {boolean} hostile  true turns the crosshair amber
   */
  setCrosshair(spread01, hostile) {
    if (!this.ok) return;
    this.crosshairSpread = this._clamp01(spread01);
    this.crosshairHostile = !!hostile;
  }

  /**
   * Bottom-of-screen narrative line on a torn paper scrap.
   * @param {string} text    line to show
   * @param {number} seconds display time (default 3)
   */
  showSubtitle(text, seconds) {
    if (!this.ok) return;
    this.subtitleText = (typeof text === 'string' ? text : '').toUpperCase();
    this.subtitleDur = this._pos(seconds, 3);
    if (this.subtitleDur <= 0) this.subtitleDur = 3;
    this.subtitleT = this.subtitleText.length ? this.subtitleDur : 0;
  }

  /**
   * @param {string} text persistent top-left objective line
   */
  setObjective(text) {
    if (!this.ok) return;
    this.objective = (typeof text === 'string' ? text : '').toUpperCase();
    if (this.objective.length > 44) this.objective = this.objective.slice(0, 44);
  }

  /**
   * Big stepped chapter-opening card.
   * @param {string} title    large amber line
   * @param {string} subtitle small bone line below it
   * @param {number} seconds  display time (default 5)
   */
  showTitleCard(title, subtitle, seconds) {
    if (!this.ok) return;
    this.titleStr = (typeof title === 'string' ? title : '').toUpperCase();
    this.titleSub = (typeof subtitle === 'string' ? subtitle : '').toUpperCase();
    const sec = this._pos(seconds, 5);
    this.titleT = this.titleStr.length ? (sec > 0 ? sec : 5) : 0;
  }

  /** Flashes a short amber SECRET notice. */
  showSecret() {
    if (!this.ok) return;
    this.secretT = 1.5;
  }

  /**
   * Persistent ending screen, one line per entry, shown until replaced.
   * @param {string[]} lines narrative lines
   */
  showEnding(lines) {
    if (!this.ok) return;
    if (!Array.isArray(lines) || lines.length === 0) {
      this.endingActive = false;
      this.endingLines = [];
      return;
    }
    this.endingLines = lines.map(function (l) {
      return (typeof l === 'string' ? l : '').toUpperCase();
    });
    this.endingActive = true;
  }

  /**
   * @param {number} value01 0..1, driven by sanity: warps text, jitters
   *                          gauges, corrupts glyphs
   */
  setDistortion(value01) {
    if (!this.ok) return;
    this.distortion = this._clamp01(value01);
  }

  /**
   * @param {boolean} v false hides all HUD drawing (canvas cleared)
   */
  setVisible(v) {
    if (!this.ok) return;
    this.visible = !!v;
  }

  /**
   * Advances time and redraws. Allocation-free: cached strings, prebuilt
   * textures, and precomputed noise tables only.
   * @param {number} dt seconds elapsed
   */
  update(dt) {
    if (!this.ok) return;
    let d = +dt;
    if (!isFinite(d) || d < 0) d = 0;
    if (d > 0.25) d = 0.25;
    this.time += d;
    this.tick = Math.floor(this.time * 12); // 12 fps animation step
    if (this.damageT > 0) this.damageT -= d;
    if (this.pickupT > 0) this.pickupT -= d;
    if (this.secretT > 0) this.secretT -= d;
    if (this.subtitleT > 0) this.subtitleT -= d;
    if (this.titleT > 0) this.titleT -= d;
    this._render();
  }

  /**
   * The HUD canvas keeps a fixed 320x200 backing store; CSS scales it.
   * Nothing to recompute here.
   */
  resize() {}

  /** Removes the canvas and releases cached textures. */
  dispose() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.ok = false;
    this.canvas = null;
    this.ctx = null;
    this.atlases = null;
    this.paper = null;
    this.bezel = null;
    this.plate = null;
    this.scrapAmmo = null;
    this.scrapSub = null;
    this.dither = null;
    this.keyIcons = null;
    this.noise01 = null;
    this.jit = null;
  }

  /* ------------------------------------------------------------------ *
   * Construction helpers (run once)
   * ------------------------------------------------------------------ */

  _mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  _buildCaches() {
    const chars = Object.keys(FONT);
    this.chars = chars;

    this.atlases = {};
    for (const key in ATLAS_COLORS) {
      this.atlases[key] = this._buildFontAtlas(ATLAS_COLORS[key], chars);
    }

    this.glyphCode = new Int16Array(128).fill(-1);
    const pool = [];
    for (let i = 0; i < chars.length; i++) {
      const cc = chars[i].charCodeAt(0);
      if (cc < 128) this.glyphCode[cc] = i;
      if ((cc >= 48 && cc <= 57) || (cc >= 65 && cc <= 90)) pool.push(i);
    }
    this.corruptPool = pool;

    this.paper = this._buildPaper();
    this.bezel = this._buildBezel(R_GAUGE);
    this.plate = this._buildPlate();
    this.scrapAmmo = this._buildScrap(144, 32, 0x4a00);
    this.scrapSub = this._buildScrap(260, 12, 0x5b05);
    this.dither = this._buildDither(64, 40);
    this.keyIcons = {
      brass: this._buildKey(KEY_BRASS),
      bone: this._buildKey(KEY_BONE),
      drowned: this._buildKey(KEY_DROWNED),
    };

    this.noise01 = new Float32Array(256);
    this.jit = new Int8Array(256);
    const rng = mulberry32(0xac1dac1d);
    for (let i = 0; i < 256; i++) {
      this.noise01[i] = rng();
      this.jit[i] = ((rng() * 3) | 0) - 1;
    }

    this.crack = this._buildCrack();
  }

  _initState() {
    this.time = 0;
    this.tick = 0;
    this.visible = true;

    this.health = 100;
    this.healthMax = 100;
    this.healthStr = '100';

    this.armor = 0;
    this.armorMax = 100;
    this.armorStr = '0';

    this.ammoKind = 'shell';
    this.ammoKindLabel = 'SHELL';
    this.ammoLoaded = 0;
    this.ammoReserve = 0;
    this.ammoCapacity = 6;
    this.ammoLoadedStr = '0';
    this.ammoReserveStr = '0';
    this.ammoCaption = 'LOADED 0, RESERVE 0';

    this.sanity = 1;
    this.sanityNeedle = angleFor(1);
    this.sanityOvershoot = 0;
    this._lastSanTick = -1;

    this.weaponsOwned = [true, false, false, false, false, false];
    this.weaponActive = 0;
    this.weaponNames = [];

    this.keys = [];

    this.damageT = 0;
    this.damageDur = 0.6;
    this.damageAmount = 0;
    this.damageDir = 0;

    this.pickupT = 0;
    this.pickupLabel = '';

    this.crosshairSpread = 0;
    this.crosshairHostile = false;

    this.subtitleText = '';
    this.subtitleT = 0;
    this.subtitleDur = 3;

    this.objective = '';

    this.titleT = 0;
    this.titleStr = '';
    this.titleSub = '';

    this.secretT = 0;

    this.endingActive = false;
    this.endingLines = [];

    this.distortion = 0;
  }

  _buildFontAtlas(color, chars) {
    const w = chars.length * GLYPH_CELL;
    const cv = this._mk(w, FONT_H);
    const g = cv.getContext('2d');
    g.fillStyle = color;
    for (let i = 0; i < chars.length; i++) {
      const rows = FONT[chars[i]];
      for (let y = 0; y < FONT_H; y++) {
        const row = rows[y];
        for (let x = 0; x < FONT_W; x++) {
          if (row.charCodeAt(x) === 49) g.fillRect(i * GLYPH_CELL + x, y, 1, 1);
        }
      }
    }
    return cv;
  }

  _buildPaper() {
    const cv = this._mk(320, 32);
    const g = cv.getContext('2d');
    const rng = mulberry32(0x5a175a17);

    const cps = new Float32Array(41);
    for (let i = 0; i <= 40; i++) cps[i] = rng() * 9;

    const torn = function (x) {
      const f = (x / 320) * 40;
      const i = f | 0;
      const t = f - i;
      const a = cps[i];
      const b = cps[i < 40 ? i + 1 : 40];
      const s = t * t * (3 - 2 * t);
      return 1.5 + a + (b - a) * s;
    };

    const blotches = [
      { x: 44, y: 16, r: 15, p: 0.4, c: '#41504a' },
      { x: 150, y: 8, r: 12, p: 0.35, c: '#4f4a3a' },
      { x: 210, y: 22, r: 14, p: 0.3, c: '#5c5340' },
      { x: 270, y: 10, r: 10, p: 0.5, c: '#6a5a3a' },
      { x: 90, y: 26, r: 9, p: 0.3, c: '#3c3a30' },
    ];

    for (let x = 0; x < 320; x++) {
      const top = Math.round(torn(x));
      for (let y = top; y < 32; y++) {
        let col;
        const n = rng();
        if (n < 0.5) col = PAL.paper;
        else if (n < 0.72) col = PAL.paperLt;
        else if (n < 0.86) col = '#c9bd9f';
        else col = '#a99b7e';
        for (let b = 0; b < blotches.length; b++) {
          const bl = blotches[b];
          const dx = x - bl.x;
          const dy = y - bl.y;
          if (dx * dx + dy * dy < bl.r * bl.r && rng() < bl.p) col = bl.c;
        }
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = PAL.brown;
      g.fillRect(x, top, 1, 1);
      if (top > 0) {
        g.fillStyle = PAL.paperLt;
        g.fillRect(x, top + 1, 1, 1);
      }
    }

    this._pin(g, 6, 22);
    this._pin(g, 314, 22);
    this._pin(g, 160, 27);
    return cv;
  }

  _pin(g, x, y) {
    g.fillStyle = '#3a2f22';
    g.fillRect(x, y, 2, 2);
    g.fillStyle = PAL.amberLt;
    g.fillRect(x, y, 1, 1);
  }

  _buildBezel(R) {
    const s = (R + 3) * 2;
    const c = R + 3;
    const cv = this._mk(s, s);
    const g = cv.getContext('2d');
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = x - c + 0.5;
        const dy = y - c + 0.5;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= R - 2.5 && d <= R + 0.5) {
          const hatch = (x + y + Math.floor(Math.atan2(dy, dx) * 8)) & 1;
          let col;
          if (d > R - 1) col = hatch ? '#8f6d33' : '#b5853c';
          else if (d > R - 2) col = PAL.amber;
          else col = hatch ? PAL.brown : PAL.brownLt;
          if (dx < 0 && dy < 0) col = PAL.amberLt;
          g.fillStyle = col;
          g.fillRect(x, y, 1, 1);
        } else if (d > R + 0.5 && d <= R + 2.5) {
          g.fillStyle = PAL.tealDark;
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      const rx = Math.round(c + Math.cos(a) * (R - 1)) - 1;
      const ry = Math.round(c + Math.sin(a) * (R - 1)) - 1;
      g.fillStyle = PAL.amber;
      g.fillRect(rx, ry, 2, 2);
      g.fillStyle = PAL.amberLt;
      g.fillRect(rx, ry, 1, 1);
    }
    return cv;
  }

  _buildPlate() {
    const cv = this._mk(30, 18);
    const g = cv.getContext('2d');
    g.fillStyle = PAL.amber;
    g.fillRect(0, 0, 30, 18);
    g.fillStyle = PAL.tealDark;
    g.fillRect(1, 1, 28, 16);
    g.fillStyle = PAL.amberLt;
    g.fillRect(0, 0, 30, 1);
    g.fillRect(0, 0, 1, 18);
    g.fillStyle = PAL.amber;
    g.fillRect(0, 0, 2, 2);
    g.fillRect(27, 0, 2, 2);
    g.fillRect(0, 15, 2, 2);
    g.fillRect(27, 15, 2, 2);
    g.fillStyle = PAL.amberLt;
    g.fillRect(0, 0, 1, 1);
    g.fillRect(27, 0, 1, 1);
    g.fillRect(0, 15, 1, 1);
    g.fillRect(27, 15, 1, 1);
    return cv;
  }

  _buildScrap(w, h, seed) {
    const cv = this._mk(w, h);
    const g = cv.getContext('2d');
    const rng = mulberry32(seed);
    g.fillStyle = PAL.paperLt;
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      if (rng() < 0.5) g.clearRect(x, 0, 1, 1);
    }
    g.fillStyle = '#8a7a5c';
    g.fillRect(0, h - 1, w, 1);
    g.fillRect(w - 1, 0, 1, h);
    const specks = Math.floor((w * h) / 90);
    for (let i = 0; i < specks; i++) {
      const x = (rng() * w) | 0;
      const y = (rng() * h) | 0;
      g.fillStyle = rng() < 0.5 ? '#c8bc9d' : '#9a8c6c';
      g.fillRect(x, y, 1, 1);
    }
    return cv;
  }

  _buildDither(w, h) {
    const cv = this._mk(w, h);
    const g = cv.getContext('2d');
    const rng = mulberry32(0xd17a0000);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = ((x + 0.5) / w) * 2 - 1;
        const ny = ((y + 0.5) / h) * 2 - 1;
        const d = Math.sqrt(nx * nx + ny * ny);
        const dens = d < 0.5 ? 0 : (d - 0.5) / 0.7;
        if (rng() < Math.min(1, dens)) {
          g.fillStyle = PAL.redDk;
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    return cv;
  }

  _buildKey(bits) {
    const cv = this._mk(8, 8);
    const g = cv.getContext('2d');
    for (let y = 0; y < 8; y++) {
      const row = bits[y];
      for (let x = 0; x < 8; x++) {
        const col = KEY_COLORS[row.charAt(x)];
        if (col) {
          g.fillStyle = col;
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    return cv;
  }

  _buildCrack() {
    const rng = mulberry32(0xc0ffee00);
    const pts = [[8, -10]];
    let px = 8;
    let py = -10;
    for (let i = 0; i < 9; i++) {
      px += rng() * 6 - 3;
      py += rng() * 5 + 0.5;
      pts.push([Math.round(px), Math.round(py)]);
    }
    return pts;
  }

  /* ------------------------------------------------------------------ *
   * Render pass (hot path — no allocation)
   * ------------------------------------------------------------------ */

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    if (!this.visible) return;

    this._drawPaper(ctx);
    this._drawAmmo(ctx);
    this._drawWeapons(ctx);
    this._drawKeys(ctx);
    this._drawArmor(ctx);
    this._drawHealth(ctx);
    this._drawSanity(ctx);
    this._drawObjective(ctx);
    this._drawSubtitle(ctx);
    this._drawCrosshair(ctx);
    this._drawDamage(ctx);
    this._drawPickup(ctx);
    this._drawSecret(ctx);
    this._drawTitle(ctx);
    this._drawEnding(ctx);
  }

  _drawPaper(ctx) {
    ctx.drawImage(this.paper, 0, H - 32);
  }

  _drawAmmo(ctx) {
    ctx.drawImage(this.scrapAmmo, 124, 166);
    this._drawText(ctx, this.ammoKindLabel, 196, 167, 1, 'amber', ALIGN_CENTER, this.distortion * 0.3);
    this._drawText(ctx, this.ammoLoadedStr, 193, 174, 2, 'ink', ALIGN_RIGHT, this.distortion * 0.2);
    this._drawText(ctx, '/', 196, 176, 1, 'ink', ALIGN_CENTER, 0);
    this._drawText(ctx, this.ammoReserveStr, 199, 174, 2, 'ink', ALIGN_LEFT, this.distortion * 0.2);
    if (this.ammoLoaded > 0 && this.ammoLoaded <= 8) {
      const n = this.ammoLoaded;
      let x = 196 - ((n * 4 - 1) >> 1);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = PAL.amberLt;
        ctx.fillRect(x, 189, 3, 3);
        ctx.fillStyle = PAL.brown;
        ctx.fillRect(x, 191, 3, 1);
        x += 4;
      }
    }
    this._drawText(ctx, this.ammoCaption, 196, 192, 1, 'dim', ALIGN_CENTER, 0);
  }

  _drawWeapons(ctx) {
    for (let i = 0; i < 6; i++) {
      const owned = !!this.weaponsOwned[i];
      const active = i === this.weaponActive;
      const x = 132 + i * 23;
      const y = active ? 155 : 156;
      if (owned) {
        ctx.fillStyle = active ? PAL.amberLt : PAL.amber;
        ctx.fillRect(x, y, 20, 9);
        ctx.fillStyle = PAL.paperLt;
        ctx.fillRect(x, y, 20, 1);
        ctx.fillStyle = PAL.brown;
        ctx.fillRect(x, y + 8, 20, 1);
        this._drawText(ctx, SLOT_NUMS[i], x + 8, y + 1, 1, 'ink', ALIGN_LEFT, 0);
      } else {
        ctx.fillStyle = PAL.teal;
        ctx.fillRect(x, y, 20, 9);
        ctx.fillStyle = '#12302a';
        ctx.fillRect(x, y, 20, 1);
        this._drawText(ctx, SLOT_NUMS[i], x + 8, y + 1, 1, 'dim', ALIGN_LEFT, 0);
      }
    }
  }

  _drawKeys(ctx) {
    for (let i = 0; i < this.keys.length; i++) {
      const icon = this.keyIcons[this.keys[i]];
      if (icon) ctx.drawImage(icon, 4 + i * 10, 16);
    }
  }

  _drawArmor(ctx) {
    const px = 92 + this._jit(6);
    const py = 176 + this._jit(7);
    ctx.drawImage(this.plate, px, py);
    this._drawText(ctx, this.armorStr, px + 15, py + 2, 1, 'amber', ALIGN_CENTER, 0);
    let frac = this.armorMax > 0 ? this.armor / this.armorMax : 0;
    if (frac < 0) frac = 0;
    if (frac > 1) frac = 1;
    ctx.fillStyle = '#12302a';
    ctx.fillRect(px + 3, py + 12, 24, 3);
    const filled = Math.round(frac * 24);
    if (filled > 0) {
      ctx.fillStyle = PAL.amber;
      ctx.fillRect(px + 3, py + 12, filled, 3);
    }
  }

  _drawHealth(ctx) {
    const R = R_GAUGE;
    let cx = 54 + this._jit(0);
    let cy = 174 + this._jit(1);
    let h = this.healthMax > 0 ? this.health / this.healthMax : 0;
    if (h < 0) h = 0;
    if (h > 1) h = 1;
    if (h < 0.3) {
      cx += this._jit(2);
      cy += this._jit(3);
    }
    ctx.drawImage(this.bezel, cx - R - 3, cy - R - 3);
    this._disc(ctx, cx, cy, R - 4, PAL.teal);
    this._ring(ctx, cx, cy, R - 5, '#2a443c', 1);

    ctx.strokeStyle = PAL.redDk;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 7, angleFor(0) - Math.PI / 2, angleFor(0.28) - Math.PI / 2, false);
    ctx.stroke();

    this._ticks(ctx, cx, cy, R - 5, R - 8, PAL.amberLt);

    let a = angleFor(h);
    if (h < 0.3) a += (this.noise01[(this.tick * 7) & 255] - 0.5) * 0.1;
    this._needle(ctx, cx, cy, a, R - 8, PAL.amberLt);
    this._disc(ctx, cx, cy, 2, PAL.amber);
    this._drawText(ctx, this.healthStr, cx, cy + 4, 1, 'amber', ALIGN_CENTER, 0);

    if (h < 0.5) this._drawCrack(ctx, cx, cy);
  }

  _drawSanity(ctx) {
    const R = R_GAUGE;
    const cx = 293 + this._jit(4);
    const cy = 174 + this._jit(5);
    const s = this.sanity;

    ctx.drawImage(this.bezel, cx - R - 3, cy - R - 3);
    this._disc(ctx, cx, cy, R - 4, PAL.tealDark);
    this._ring(ctx, cx, cy, R - 5, '#2a443c', 1);
    this._ticks(ctx, cx, cy, R - 5, R - 8, '#4c675c');

    this._needle(ctx, cx, cy, this._sanityNeedleAngle(), R - 8, PAL.red);
    this._disc(ctx, cx, cy, 2, PAL.amberLt);

    const corrupt = this._clamp01(0.45 * (1 - s) + 0.5 * this.distortion);
    for (let i = 0; i < 6; i++) {
      const ang = SCALE_ANGLES[i];
      const nx = Math.round(cx + Math.sin(ang) * (R - 10));
      const ny = Math.round(cy - Math.cos(ang) * (R - 10));
      this._drawText(ctx, SCALE_LABELS[i], nx, ny, 1, 'bone', ALIGN_CENTER, corrupt);
    }

    if (s < 0.95) this._drawStatic(ctx, cx, cy, R, 1 - s);
  }

  _sanityNeedleAngle() {
    const target = angleFor(this.sanity);
    if (this._lastSanTick !== this.tick) {
      this._lastSanTick = this.tick;
      let n = this.sanityNeedle;
      const step = 0.12;
      if (this.sanityOvershoot !== 0) {
        const desired = target + this.sanityOvershoot;
        if (desired - n > step) n += step;
        else if (n - desired > step) n -= step;
        else n = desired;
        this.sanityOvershoot *= 0.7;
        if (this.sanityOvershoot > -0.01 && this.sanityOvershoot < 0.01) this.sanityOvershoot = 0;
      } else {
        if (target - n > step) n += step;
        else if (n - target > step) n -= step;
        else n = target;
      }
      this.sanityNeedle = n;
    }
    let n = this.sanityNeedle;
    const low = 1 - this.sanity;
    n += Math.sin(this.tick * 0.4) * 0.03 * low;
    n += (this.noise01[(this.tick * 11) & 255] - 0.5) * 0.05 * low;
    return n;
  }

  _drawStatic(ctx, cx, cy, R, intensity) {
    const y = cy + Math.round((this.noise01[(this.tick * 5) & 255] - 0.5) * (R - 7) * 2);
    ctx.globalAlpha = 0.2 + intensity * 0.6;
    for (let i = 0; i < 14; i++) {
      const x = cx + Math.round((this.noise01[(this.tick * 13 + i * 7) & 255] - 0.5) * (R - 6) * 2);
      ctx.fillStyle = (i & 1) ? PAL.amberLt : PAL.paperLt;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  _drawObjective(ctx) {
    if (!this.objective) return;
    const wpx = this._textW(this.objective, 1) + 4;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = PAL.tealDark;
    ctx.fillRect(2, 2, wpx, 9);
    ctx.globalAlpha = 1;
    this._drawText(ctx, this.objective, 4, 4, 1, 'amber', ALIGN_LEFT, 0);
  }

  _drawSubtitle(ctx) {
    if (this.subtitleT <= 0 || !this.subtitleText) return;
    const frac = this.subtitleT / this.subtitleDur;
    let a = Math.floor(frac * 4) / 4;
    if (a < 0.2) a = 0.2;
    ctx.globalAlpha = a;
    ctx.drawImage(this.scrapSub, 30, 140);
    this._drawText(ctx, this.subtitleText, 160, 143, 1, 'ink', ALIGN_CENTER, 0);
    ctx.globalAlpha = 1;
  }

  _drawCrosshair(ctx) {
    const s = this.crosshairSpread;
    const gap = 2 + Math.round(s * 4);
    const len = 4 + Math.round(s * 5);
    ctx.fillStyle = this.crosshairHostile ? PAL.amber : PAL.paperLt;
    ctx.fillRect(160 - len, 100, len - gap, 1);
    ctx.fillRect(160 + gap, 100, len - gap, 1);
    ctx.fillRect(160, 100 - len, 1, len - gap);
    ctx.fillRect(160, 100 + gap, 1, len - gap);
  }

  _drawDamage(ctx) {
    if (this.damageT <= 0) return;
    const frac = this.damageT / this.damageDur;
    const a = this._clamp01(frac) * this.damageAmount;
    if (a <= 0.01) return;
    const shift = 120 * a;
    const ox = Math.round(-Math.cos(this.damageDir) * shift);
    const oy = Math.round(-Math.sin(this.damageDir) * shift);
    ctx.globalAlpha = a;
    ctx.drawImage(this.dither, ox, oy, W, H);
    ctx.globalAlpha = a * 0.4;
    ctx.fillStyle = PAL.red;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  _drawPickup(ctx) {
    if (this.pickupT <= 0 || !this.pickupLabel) return;
    const frac = this.pickupT / 0.8;
    let a = Math.floor(frac * 4) / 4;
    if (a < 0.2) a = 0.2;
    const wpx = this._textW(this.pickupLabel, 1) + 4;
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = PAL.tealDark;
    ctx.fillRect(160 - (wpx >> 1), 114, wpx, 9);
    ctx.globalAlpha = a;
    this._drawText(ctx, this.pickupLabel, 160, 116, 1, 'amber', ALIGN_CENTER, 0);
    ctx.globalAlpha = 1;
  }

  _drawSecret(ctx) {
    if (this.secretT <= 0) return;
    const frac = this.secretT / 1.5;
    let a = Math.floor(frac * 4) / 4;
    if (a < 0.2) a = 0.2;
    ctx.globalAlpha = a;
    this._drawText(ctx, 'SECRET', 160, 96, 2, 'amber', ALIGN_CENTER, 0);
    ctx.globalAlpha = 1;
  }

  _drawTitle(ctx) {
    if (this.titleT <= 0) return;
    ctx.fillStyle = PAL.tealDark;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    this._drawText(ctx, this.titleStr, 160, 84, 3, 'amber', ALIGN_CENTER, 0);
    if (this.titleSub) this._drawText(ctx, this.titleSub, 160, 108, 1, 'bone', ALIGN_CENTER, 0);
  }

  _drawEnding(ctx) {
    if (!this.endingActive) return;
    ctx.fillStyle = '#0a1412';
    ctx.fillRect(0, 0, W, H);
    let y = 62;
    for (let i = 0; i < this.endingLines.length; i++) {
      this._drawText(ctx, this.endingLines[i], 160, y, 1, 'bone', ALIGN_CENTER, 0);
      y += 10;
    }
  }

  /* ------------------------------------------------------------------ *
   * Small drawing primitives
   * ------------------------------------------------------------------ */

  _drawText(ctx, text, x, y, scale, colorKey, align, corrupt) {
    const atlas = this.atlases[colorKey];
    const code = this.glyphCode;
    const adv = GLYPH_CELL * scale;
    const gw = FONT_W * scale;
    const gh = FONT_H * scale;
    const len = text.length;
    const wpx = len * adv - scale;
    let px;
    if (align === ALIGN_RIGHT) px = x - wpx;
    else if (align === ALIGN_CENTER) px = x - (wpx >> 1);
    else px = x;

    const pool = this.corruptPool;
    const poolLen = pool.length;
    const tick = this.tick;
    const noise = this.noise01;

    for (let i = 0; i < len; i++) {
      const c = text.charCodeAt(i);
      let idx = c < 128 ? code[c] : -1;
      if (corrupt > 0 && idx >= 0) {
        if (noise[(tick * 5 + i) & 255] < corrupt) {
          idx = pool[(tick * 13 + i * 7) % poolLen];
        }
      }
      if (idx >= 0) ctx.drawImage(atlas, idx * GLYPH_CELL, 0, FONT_W, FONT_H, px, y, gw, gh);
      px += adv;
    }
  }

  _textW(text, scale) {
    return text.length * GLYPH_CELL * scale - scale;
  }

  _disc(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  _ring(ctx, x, y, r, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  _ticks(ctx, cx, cy, r0, r1, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < TICK_ANGLES.length; i++) {
      const a = TICK_ANGLES[i];
      ctx.moveTo(Math.round(cx + Math.sin(a) * r0), Math.round(cy - Math.cos(a) * r0));
      ctx.lineTo(Math.round(cx + Math.sin(a) * r1), Math.round(cy - Math.cos(a) * r1));
    }
    ctx.stroke();
  }

  _needle(ctx, cx, cy, a, len, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(Math.round(cx + Math.sin(a) * len), Math.round(cy - Math.cos(a) * len));
    ctx.stroke();
  }

  _drawCrack(ctx, cx, cy) {
    ctx.strokeStyle = PAL.paperLt;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = 0; i < this.crack.length; i++) {
      const p = this.crack[i];
      const x = cx + p[0];
      const y = cy + p[1];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ *
   * Value guards
   * ------------------------------------------------------------------ */

  _clamp01(v) {
    let n = +v;
    if (!isFinite(n)) n = 0;
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  _clampInt(v, lo, hi) {
    let n = Math.round(+v);
    if (!isFinite(n)) n = 0;
    if (n < lo) n = lo;
    if (n > hi) n = hi;
    return n;
  }

  _pos(v, def) {
    let n = +v;
    if (!isFinite(n)) n = def;
    return n < 0 ? 0 : n;
  }

  _jit(i) {
    if (this.distortion < 0.05) return 0;
    return this.jit[(this.tick + i) & 255];
  }
}
