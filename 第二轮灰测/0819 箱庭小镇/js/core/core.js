/* =============================================================
   箱庭小镇 · Diorama Town
   core.js — namespace, math, noise, palette, materials, textures,
             ticker, environment state, night-light registry
   Classic script (no ES modules) so the page runs from file://
   ============================================================= */
(function (global) {
  'use strict';

  const T = global.THREE;
  const TOWN = global.TOWN = global.TOWN || {};

  TOWN.VERSION = '1.0';

  /* ------------------------------------------------------------
     U — math / random utilities
     ------------------------------------------------------------ */
  const U = TOWN.U = {
    PI: Math.PI,
    TAU: Math.PI * 2,
    DEG: Math.PI / 180,

    clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
    saturate(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); },
    lerp(a, b, t) { return a + (b - a) * t; },
    invLerp(a, b, v) { return (v - a) / (b - a); },
    smoothstep(e0, e1, x) {
      const t = U.saturate((x - e0) / (e1 - e0));
      return t * t * (3 - 2 * t);
    },
    smootherstep(e0, e1, x) {
      const t = U.saturate((x - e0) / (e1 - e0));
      return t * t * t * (t * (t * 6 - 15) + 10);
    },
    // frame-rate independent exponential approach
    damp(cur, target, lambda, dt) { return U.lerp(cur, target, 1 - Math.exp(-lambda * dt)); },
    mod(a, n) { return ((a % n) + n) % n; },
    // shortest signed difference between two angles
    angleDelta(a, b) { return U.mod(b - a + Math.PI, U.TAU) - Math.PI; },

    /**
     * deterministic PRNG (mulberry32).
     * The seed is avalanched first: mulberry32 seeded with 1,2,3... emits
     * strongly correlated first outputs, which made every factory called
     * with sequential seeds produce near-identical results.
     */
    rng(seed) {
      let a = (seed | 0) || 0x9e3779b9;
      a = Math.imul(a ^ (a >>> 16), 0x21f0aaad);
      a = Math.imul(a ^ (a >>> 15), 0x735a2d97);
      a = (a ^ (a >>> 15)) | 0;
      const f = function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      f.range = (lo, hi) => lo + (hi - lo) * f();
      f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f() * 0.9999999);
      f.pick = (arr) => arr[Math.floor(f() * arr.length * 0.9999999)];
      /** pick with weights: pickW([[v,w],[v,w]]) */
      f.pickW = (pairs) => {
        let total = 0;
        for (const p of pairs) total += p[1];
        let r = f() * total;
        for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
        return pairs[pairs.length - 1][0];
      };
      f.chance = (p) => f() < p;
      f.sign = () => (f() < 0.5 ? -1 : 1);
      /** gaussian-ish, centred 0, range about [-1,1] */
      f.bell = () => (f() + f() + f()) / 1.5 - 1;
      f.shuffle = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(f() * (i + 1));
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      };
      return f;
    },

    /** stable hash -> [0,1) */
    hash(x, y) {
      let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return h - Math.floor(h);
    },
  };

  /* ------------------------------------------------------------
     Noise — seeded value noise + fbm (used for terrain & scatter)
     ------------------------------------------------------------ */
  function makeNoise(seed) {
    const P = new Uint8Array(512);
    const r = U.rng(seed);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    r.shuffle(perm);
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];

    const grad = [];
    for (let i = 0; i < 256; i++) {
      const a = (i / 256) * U.TAU + r() * 0.02;
      grad.push([Math.cos(a), Math.sin(a)]);
    }
    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const u = fade(xf), v = fade(yf);
      function dot(gi, dx, dy) { const g = grad[gi & 255]; return g[0] * dx + g[1] * dy; }
      const aa = P[P[X] + Y], ba = P[P[X + 1] + Y];
      const ab = P[P[X] + Y + 1], bb = P[P[X + 1] + Y + 1];
      const x1 = U.lerp(dot(aa, xf, yf), dot(ba, xf - 1, yf), u);
      const x2 = U.lerp(dot(ab, xf, yf - 1), dot(bb, xf - 1, yf - 1), u);
      return U.lerp(x1, x2, v) * 1.35;               // ~[-1,1]
    }
    function fbm(x, y, oct, lac, gain) {
      oct = oct || 4; lac = lac || 2.03; gain = gain || 0.5;
      let a = 1, f = 1, s = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        s += a * n2(x * f, y * f);
        norm += a; a *= gain; f *= lac;
      }
      return s / norm;
    }
    function ridged(x, y, oct) {
      oct = oct || 4;
      let a = 1, f = 1, s = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        s += a * (1 - Math.abs(n2(x * f, y * f)));
        norm += a; a *= 0.5; f *= 2.07;
      }
      return s / norm;
    }
    return { n2, fbm, ridged };
  }
  TOWN.makeNoise = makeNoise;
  TOWN.noise = makeNoise(20250819);

  /* ------------------------------------------------------------
     Palette — the whole town's colour language.
     Warm, slightly desaturated storybook tones; roofs read strongly
     against green so the silhouette stays legible from far away.
     ------------------------------------------------------------ */
  const P = TOWN.Palette = {
    // terrain
    grass: 0x7fae4e, grassDark: 0x5d8c3c, grassDry: 0x9cb85a,
    soil: 0x8a6a4a, soilDark: 0x6d5138, rock: 0x9a9793, rockDark: 0x6f6d6b,
    sand: 0xe4d3a8, sandWet: 0xc9b489,
    stone: 0xbdb6a6, stoneDark: 0x938c7e, stoneWarm: 0xcdbfa3,
    cobble: 0xa8a29a, asphalt: 0x5a5a5f, asphaltLight: 0x6d6d72,
    concrete: 0xb6b2ab,

    // water
    water: 0x2f7f93, waterDeep: 0x1c5468, waterShallow: 0x67b9bd, foam: 0xeaf7f7,

    // walls (facades)
    wallCream: 0xf1e2c6, wallIvory: 0xf6efe0, wallSand: 0xe7cfa4,
    wallPeach: 0xf0cdae, wallRose: 0xecc0bb, wallMint: 0xcfe0cd,
    wallSky: 0xc7d9e4, wallLilac: 0xd8cfe2, wallOchre: 0xdcb87d,
    wallBrick: 0xb9705c, wallBrickDark: 0x99584a, wallTerra: 0xc98a68,
    wallGrey: 0xd6d2ca, wallOlive: 0xbcc09a,

    // roofs
    roofRust: 0xb85c42, roofRed: 0xc0503c, roofTerracotta: 0xd07a4e,
    roofBlue: 0x4b6b8a, roofSlate: 0x565e6b, roofTeal: 0x3f7d78,
    roofGreen: 0x59795a, roofBrown: 0x7d5a44, roofPlum: 0x7a4f5e,
    roofCharcoal: 0x3f4450, roofCopper: 0x53948a,

    // materials
    wood: 0xa8794f, woodDark: 0x6f4b32, woodLight: 0xc59c6d, woodGrey: 0x8d8478,
    timber: 0x5d4433,
    metal: 0x8d949c, metalDark: 0x4e545c, iron: 0x3c4046,
    brass: 0xc9a24a, copper: 0x76a89b, gold: 0xd8b45a,
    white: 0xf7f4ee, offWhite: 0xe8e3d8, black: 0x23262b,
    glass: 0x9fc4d8, glassDark: 0x3d5a6a,

    // vegetation
    leafSpring: 0x74a94a, leafDeep: 0x4d7c3c, leafLime: 0x93c159,
    leafOlive: 0x6b8e4e, leafPine: 0x2f5d43, leafPineDark: 0x244c37,
    leafAutumn: 0xd98b3c, leafRust: 0xc06a35, leafPink: 0xf0b8c8,
    leafPurple: 0x9a7bb0, bark: 0x6a4f3c, barkLight: 0x8a6b52,
    hedge: 0x557f42,

    // accents
    flowerRed: 0xd9534f, flowerYellow: 0xf0c04a, flowerWhite: 0xf5f1e6,
    flowerPink: 0xe98fb0, flowerBlue: 0x6f8fd0, flowerOrange: 0xe8873f,
    awningRed: 0xc4544c, awningGreen: 0x4f8a63, awningBlue: 0x4a7096,
    awningYellow: 0xdcae4e, awningCream: 0xeee0c4,
    fabricWhite: 0xf2ece0, fabricRed: 0xc85a52,

    // light emissives
    lampWarm: 0xffd9a0, lampCool: 0xcfe4ff, windowWarm: 0xffcf8a,
    windowCool: 0xbfe0ff, neonPink: 0xff6fa8, neonCyan: 0x62e8ff,
    fire: 0xff8a3d, headlight: 0xfff6dd, taillight: 0xff4d3d,
  };

  /* ------------------------------------------------------------
     Tex — tiny procedural canvas textures (cached)
     ------------------------------------------------------------ */
  const texCache = new Map();
  const Tex = TOWN.Tex = {
    /** canvas(key, w, h, draw) -> THREE.CanvasTexture  (cached by key) */
    canvas(key, w, h, draw, opts) {
      if (texCache.has(key)) return texCache.get(key);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      draw(g, w, h);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = 4;
      if (opts && opts.repeat) {
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.repeat.set(opts.repeat[0], opts.repeat[1]);
      }
      if (opts && opts.wrap) t.wrapS = t.wrapT = T.RepeatWrapping;
      texCache.set(key, t);
      return t;
    },
    clearCache() { texCache.clear(); },
  };

  /* ------------------------------------------------------------
     Mat — shared material registry.
     Sharing materials is what keeps draw calls low after merging,
     so ALL modules must fetch materials from here.
     ------------------------------------------------------------ */
  const matCache = new Map();
  const nightMats = [];    // materials whose emissive follows the day/night cycle

  function keyOf(base, color, over) {
    return base + '|' + color + (over ? '|' + JSON.stringify(over) : '');
  }

  const Mat = TOWN.Mat = {
    /** all materials created, for global tweaks */
    all: matCache,

    /**
     * std(colorHex, params?) — cached MeshStandardMaterial.
     * params: {rough, metal, flat, side, transparent, opacity, map, emissive, emissiveIntensity, vertexColors, name}
     */
    std(color, params) {
      params = params || {};
      const k = keyOf('std', color, params);
      if (matCache.has(k)) return matCache.get(k);
      const m = new T.MeshStandardMaterial({
        color: color,
        roughness: params.rough !== undefined ? params.rough : 0.72,
        metalness: params.metal !== undefined ? params.metal : 0.04,
        flatShading: !!params.flat,
        side: params.side || T.FrontSide,
        transparent: !!params.transparent,
        opacity: params.opacity !== undefined ? params.opacity : 1,
        map: params.map || null,
        vertexColors: !!params.vertexColors,
        emissive: new T.Color(params.emissive !== undefined ? params.emissive : 0x000000),
        emissiveIntensity: params.emissiveIntensity !== undefined ? params.emissiveIntensity : 1,
        depthWrite: params.depthWrite !== undefined ? params.depthWrite : true,
        alphaTest: params.alphaTest || 0,
      });
      m.name = params.name || ('std_' + color.toString(16));
      matCache.set(k, m);
      return m;
    },

    /** basic(colorHex, params?) — unlit material (glow cores, sky bits) */
    basic(color, params) {
      params = params || {};
      const k = keyOf('basic', color, params);
      if (matCache.has(k)) return matCache.get(k);
      const m = new T.MeshBasicMaterial({
        color: color,
        transparent: !!params.transparent,
        opacity: params.opacity !== undefined ? params.opacity : 1,
        side: params.side || T.FrontSide,
        blending: params.additive ? T.AdditiveBlending : T.NormalBlending,
        depthWrite: params.depthWrite !== undefined ? params.depthWrite : !params.transparent,
        map: params.map || null,
        toneMapped: params.toneMapped !== undefined ? params.toneMapped : true,
      });
      matCache.set(k, m);
      return m;
    },

    /**
     * window(group, opts?) — glazing that lights up after dusk.
     * `group` (0..7) staggers when that window switches on, and some
     * groups stay dark all night so facades never light up uniformly.
     */
    window(group, opts) {
      opts = opts || {};
      const g = ((group | 0) % 8 + 8) % 8;
      const warm = opts.cool ? P.windowCool : P.windowWarm;
      const k = 'win|' + g + '|' + (opts.cool ? 'c' : 'w') + '|' + (opts.tint || 0);
      if (matCache.has(k)) return matCache.get(k);
      const m = new T.MeshStandardMaterial({
        color: opts.tint || P.glassDark,
        roughness: 0.18,
        metalness: 0.1,
        emissive: new T.Color(warm),
        emissiveIntensity: 0,
      });
      m.name = 'window_' + g;
      // threshold / max glow per group: a couple of groups are "vacant"
      const profile = [
        { on: 0.10, max: 1.35, flick: 0.00 },
        { on: 0.28, max: 1.15, flick: 0.00 },
        { on: 0.45, max: 1.50, flick: 0.05 },
        { on: 0.62, max: 0.95, flick: 0.00 },
        { on: 0.16, max: 1.25, flick: 0.12 },  // flickering (TV / candle)
        { on: 0.80, max: 0.70, flick: 0.00 },
        { on: 9.99, max: 0.00, flick: 0.00 },  // never lit
        { on: 0.36, max: 1.60, flick: 0.00 },
      ][g];
      nightMats.push({ mat: m, profile, seed: U.hash(g * 7.3, 11.7) * 100 });
      matCache.set(k, m);
      return m;
    },

    /** lamp(colorHex) — street lamp / lantern globe; glows at night only */
    lamp(color, opts) {
      opts = opts || {};
      color = color || P.lampWarm;
      const k = 'lamp|' + color + '|' + (opts.max || 2.4);
      if (matCache.has(k)) return matCache.get(k);
      const m = new T.MeshStandardMaterial({
        color: 0xfff3dd, roughness: 0.35, metalness: 0,
        emissive: new T.Color(color), emissiveIntensity: 0,
      });
      m.name = 'lamp';
      nightMats.push({ mat: m, profile: { on: 0.05, max: opts.max || 2.4, flick: opts.flick || 0 }, seed: 3.7 });
      matCache.set(k, m);
      return m;
    },

    /** neon(colorHex) — sign that glows at night, strongly */
    neon(color) {
      const k = 'neon|' + color;
      if (matCache.has(k)) return matCache.get(k);
      const m = new T.MeshStandardMaterial({
        color: color, roughness: 0.4, metalness: 0,
        emissive: new T.Color(color), emissiveIntensity: 0.05,
      });
      nightMats.push({ mat: m, profile: { on: 0.12, max: 2.2, flick: 0.06 }, seed: U.hash(color, 3) * 50 });
      matCache.set(k, m);
      return m;
    },

    /** alwaysOn(colorHex, intensity) — emissive that never changes */
    glow(color, intensity) {
      const k = 'glow|' + color + '|' + intensity;
      if (matCache.has(k)) return matCache.get(k);
      const m = new T.MeshStandardMaterial({
        color: color, emissive: new T.Color(color),
        emissiveIntensity: intensity === undefined ? 1 : intensity,
        roughness: 0.5, metalness: 0,
      });
      matCache.set(k, m);
      return m;
    },

    /** register any material to follow the night cycle */
    registerNight(mat, profile, seed) {
      nightMats.push({ mat, profile: profile || { on: 0.2, max: 1.2, flick: 0 }, seed: seed || 0 });
      return mat;
    },

    /** advance all night materials — called by the sky/daynight module */
    updateNight(lampF, time) {
      for (let i = 0; i < nightMats.length; i++) {
        const e = nightMats[i], pr = e.profile;
        if (lampF <= pr.on) { e.mat.emissiveIntensity = 0; continue; }
        let v = U.smoothstep(pr.on, Math.min(1, pr.on + 0.22), lampF) * pr.max;
        if (pr.flick > 0) {
          const s = Math.sin(time * 8.3 + e.seed) * Math.sin(time * 3.1 + e.seed * 1.7);
          v *= 1 + pr.flick * s;
        }
        e.mat.emissiveIntensity = v;
      }
    },
    nightMats,
  };

  /* ------------------------------------------------------------
     Env — global environment state, written by the sky module,
     read by everything else.
     ------------------------------------------------------------ */
  TOWN.Env = {
    hours: 9.0,          // 0..24 simulated clock
    dayF: 1,             // 0 = deep night, 1 = full day
    duskF: 0,            // 1 near sunrise/sunset
    nightF: 0,           // 1 - dayF
    lampF: 0,            // 0 = lamps off, 1 = fully on
    sunUp: true,
    sunDir: new T.Vector3(0.5, 0.8, 0.3).normalize(),
    moonDir: new T.Vector3(-0.5, -0.8, -0.3).normalize(),
    sunColor: new T.Color(0xffffff),
    fogColor: new T.Color(0xbcd8e8),
    horizonColor: new T.Color(0xbcd8e8),
    zenithColor: new T.Color(0x4f8fd0),
    elapsed: 0,          // real seconds since start
    dt: 0,
    quality: 'high',
    reduced: false,      // true when the user turns dynamics off
  };

  /* ------------------------------------------------------------
     Ticker — per-frame updaters
     ------------------------------------------------------------ */
  const tickers = [];
  TOWN.Ticker = {
    list: tickers,
    /** add(fn, name?, opts?) — fn(dt, elapsed, Env). opts.dynamic marks it pausable. */
    add(fn, name, opts) {
      const e = { fn, name: name || 'tick' + tickers.length, dynamic: !(opts && opts.always), enabled: true };
      tickers.push(e);
      return e;
    },
    update(dt, elapsed, allowDynamic) {
      const env = TOWN.Env;
      for (let i = 0; i < tickers.length; i++) {
        const e = tickers[i];
        if (!e.enabled) continue;
        if (e.dynamic && !allowDynamic) continue;
        try { e.fn(dt, elapsed, env); }
        catch (err) {
          e.enabled = false;
          console.error('[ticker:' + e.name + '] disabled after error:', err);
        }
      }
    },
    clear() { tickers.length = 0; },
  };

  /* ------------------------------------------------------------
     Stage — shared references + a few registries the app fills in
     ------------------------------------------------------------ */
  TOWN.Stage = {
    scene: null, camera: null, renderer: null,
    sunLight: null, moonLight: null, hemi: null,
    groups: {},          // named scene groups
    /** point lights the app may cull by distance at night */
    nightLights: [],
    /** objects only visible at night (stars, fireflies, beams) */
    nightOnly: [],
    /** objects only visible during day */
    dayOnly: [],
    add(obj, groupName) {
      const g = TOWN.Stage.groups[groupName || 'world'];
      (g || TOWN.Stage.scene).add(obj);
      return obj;
    },
  };

  /* ------------------------------------------------------------
     Small shared helpers used across modules
     ------------------------------------------------------------ */
  TOWN.mesh = function (geo, mat, x, y, z) {
    const m = new T.Mesh(geo, mat);
    if (x !== undefined) m.position.set(x, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /** mark a subtree as dynamic so the static merger leaves it alone */
  TOWN.markDynamic = function (obj) {
    obj.traverse((o) => { o.userData.dynamic = true; });
    return obj;
  };

  /** group(name?) */
  TOWN.group = function (name) {
    const g = new T.Group();
    if (name) g.name = name;
    return g;
  };

  /* ------------------------------------------------------------
     Halos — additive sprite glows for lamps, windows, headlights.
     Far cheaper than real lights and they read beautifully at night.
     ------------------------------------------------------------ */
  const halos = [];

  Tex.radialGlow = function (key, hardness, tint) {
    return Tex.canvas(key || 'glow', 128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      const hd = hardness === undefined ? 0.18 : hardness;
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(hd, 'rgba(255,255,255,0.72)');
      grd.addColorStop(hd + 0.22, 'rgba(255,255,255,0.24)');
      grd.addColorStop(0.62, 'rgba(255,255,255,0.06)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    });
  };

  /**
   * halo(colorHex, size, opts) -> THREE.Sprite
   * opts: {max (peak opacity), on (lampF threshold), always (ignore cycle),
   *        hardness, flick}
   * Automatically fades in with the night unless opts.always.
   */
  TOWN.halo = function (color, size, opts) {
    opts = opts || {};
    const mat = new T.SpriteMaterial({
      map: Tex.radialGlow('glow' + (opts.hardness || 'd'), opts.hardness),
      color: color === undefined ? P.lampWarm : color,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      opacity: opts.always ? (opts.max || 0.8) : 0,
      toneMapped: false,
    });
    const s = new T.Sprite(mat);
    s.scale.setScalar(size || 1.6);
    s.userData.dynamic = true;
    if (!opts.always) {
      halos.push({
        s, mat,
        max: opts.max === undefined ? 0.85 : opts.max,
        on: opts.on === undefined ? 0.08 : opts.on,
        flick: opts.flick || 0,
        seed: U.hash(halos.length * 3.3, 7.1) * 60,
      });
      s.visible = false;
    }
    return s;
  };

  TOWN.updateHalos = function (lampF, time) {
    for (let i = 0; i < halos.length; i++) {
      const h = halos[i];
      if (lampF <= h.on) { if (h.s.visible) h.s.visible = false; continue; }
      let v = U.smoothstep(h.on, Math.min(1, h.on + 0.25), lampF) * h.max;
      if (h.flick > 0) v *= 1 + h.flick * Math.sin(time * 7.7 + h.seed) * Math.sin(time * 2.9 + h.seed);
      h.s.visible = v > 0.01;
      h.mat.opacity = v;
    }
  };
  TOWN.halos = halos;

  console.log('[TOWN] core ready · three r' + T.REVISION);
})(window);
