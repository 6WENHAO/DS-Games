/* =============================================================
   箱庭小镇 · js/world/fx.js
   TOWN.FX — atmosphere & particles.

   Chimney smoke, steam, fountain jets, waterfalls, splash ripples,
   fireflies, petals, autumn leaves, dust motes, sea spray, a fat
   factory plume, distant bird specks, fake lamp-light pools and
   window spill.

   ------------------------------------------------------------------
   CALL CONVENTION — ABSOLUTE WORLD COORDINATES
   ------------------------------------------------------------------
   Every factory returns a THREE.Group that is LEFT AT THE ORIGIN
   (position 0,0,0, no rotation, no scale).  The particles inside it
   live at ABSOLUTE WORLD positions taken from `opts.position` /
   `opts.center`.  So the layout code must NOT move the returned
   group — it just adds it to the scene:

       scene.add(TOWN.FX.smoke({ position:[12.5, 9.8, -4.0], seed:7 }));
       //                        ^ world coords of the chimney pot

   (Reason: emitters are usually spawned from a world-space anchor
   that was computed after a building was rotated/placed, and the
   shared per-kind ticker writes world positions straight into the
   attribute buffers.)

   ------------------------------------------------------------------
   IMPLEMENTATION NOTES
   ------------------------------------------------------------------
   * ONE shared ticker per particle KIND (never per emitter):
       fx-smoke  fx-water  fx-fireflies  fx-fall  fx-motes
       fx-ring   fx-glow   fx-birds
     Each walks a module-scope array of registered emitters.
   * ONE shared PointsMaterial per kind.  Per-particle ALPHA and TINT
     ride a 4-component `color` attribute (three's USE_COLOR_ALPHA:
     `diffuseColor *= vColor`), per-particle SIZE rides an `aSize`
     attribute injected with a 1-line `onBeforeCompile` patch of
     `gl_PointSize = size;`.  No custom ShaderMaterial is needed, so
     fog / tone mapping / colour management stay stock-correct:
     additive kinds set `toneMapped:false, fog:false` (fog on an
     additive sprite would ADD fog colour); the normal-blended smoke
     keeps `fog:true, toneMapped:true` so plumes sink into the haze.
   * Geometry is allocated ONCE.  The tickers only write into
     `attribute.array` and set `needsUpdate = true`.  Nothing is
     rebuilt per frame, and the per-frame loops allocate nothing
     (module-scope scratch Vector3/Color only).
   * Puff / droplet / spray motion is ANALYTIC in a wrapped age
     (pos = f(age)), so particles recycle exactly and can never
     integrate their way to NaN or infinity.
   * TOWN.FX.setQuality(0..1) scales every emitter by shrinking
     geometry drawRange (and the update loop) — never by rebuilding.
   ============================================================= */
(function (global) {
  'use strict';

  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U;
  const P = TOWN.Palette;
  const Tex = TOWN.Tex;
  const Stage = TOWN.Stage;

  const FX = TOWN.FX = {};

  /* ------------------------------------------------------------
     module-scope scratch (zero allocation in per-frame loops)
     ------------------------------------------------------------ */
  const _wind = new T.Vector3();
  const _cA = new T.Color();
  const _cB = new T.Color();
  let ENV = TOWN.Env;

  const TAU = Math.PI * 2;
  const GRAV = 9.2;                 // stylised gravity (m/s²)

  /* ------------------------------------------------------------
     tiny helpers
     ------------------------------------------------------------ */
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  /** read component i of [x,y,z] | THREE.Vector3 | undefined */
  function co(a, i, d) {
    if (!a) return d;
    if (typeof a.length === 'number') return num(a[i], d);
    return num(a[i === 0 ? 'x' : (i === 1 ? 'y' : 'z')], d);
  }

  function finish(g, kind, w, d, h) {
    g.userData.footprint = { w: w, d: d };
    g.userData.height = h;
    g.userData.kind = kind;
    TOWN.markDynamic(g);
    return g;
  }

  /* ------------------------------------------------------------
     wind — TOWN.Dynamics if that module is loaded, else slow drift.
     Computed ONCE per frame (frame-stamped) and shared by all kinds.
     ------------------------------------------------------------ */
  let windStamp = -1e9;
  let dynBad = false;

  function windAt(t) {
    if (t === windStamp) return _wind;
    windStamp = t;
    let got = false;
    const D = TOWN.Dynamics;
    // windDir may be a FUNCTION windDir(t) or a plain vector PROPERTY, and it
    // may be a Vector3 (x,y,z), a Vector2 / {x,y} (== x,z), [x,z] / [x,y,z],
    // or a heading in radians.  windStrength may be a function or a number.
    if (!dynBad && D && D.windDir !== undefined && D.windDir !== null) {
      try {
        const d = (typeof D.windDir === 'function') ? D.windDir(t) : D.windDir;
        let s = 1;
        if (typeof D.windStrength === 'function') s = D.windStrength(t);
        else if (typeof D.windStrength === 'number') s = D.windStrength;
        if (!isFinite(s)) s = 1;
        if (typeof d === 'number' && isFinite(d)) {           // heading, radians
          _wind.set(Math.cos(d), 0, Math.sin(d)); got = true;
        } else if (d && typeof d.length === 'number' && d.length >= 2) {
          _wind.set(num(d[0], 0), 0, num(d[d.length > 2 ? 2 : 1], 0)); got = true;
        } else if (d && d.isVector2) {                        // (x, y) == (x, z)
          _wind.set(d.x, 0, d.y); got = true;
        } else if (d && typeof d.x === 'number') {
          if (typeof d.z === 'number') _wind.set(d.x, num(d.y, 0) * 0.25, d.z);
          else _wind.set(d.x, 0, num(d.y, 0));                // {x,y} == (x, z)
          got = true;
        }
        if (got) {
          _wind.multiplyScalar(s);
          if (!isFinite(_wind.x) || !isFinite(_wind.y) || !isFinite(_wind.z)) got = false;
          else if (_wind.length() > 2.6) _wind.setLength(2.6);   // keep drift bounded
        }
      } catch (err) { dynBad = true; got = false; }
    }
    if (!got) {
      // gentle fixed breeze, slowly veering
      _wind.set(0.30 + 0.13 * Math.sin(t * 0.13),
        0,
        0.17 + 0.11 * Math.sin(t * 0.087 + 1.7));
    }
    return _wind;
  }
  FX.windAt = windAt;   // handy for probing / other authors

  /* ------------------------------------------------------------
     textures (all cached inside TOWN.Tex)
     ------------------------------------------------------------ */
  /** soft-but-present puff: a wide alpha plateau, then a smooth rim */
  function texPuff() {
    return Tex.canvas('fxPuff', 128, 128, function (g, w, h) {
      const c = w * 0.5;
      const grd = g.createRadialGradient(c, c, 0, c, c, c);
      grd.addColorStop(0.00, 'rgba(255,255,255,1)');
      grd.addColorStop(0.30, 'rgba(255,255,255,0.92)');
      grd.addColorStop(0.55, 'rgba(255,255,255,0.58)');
      grd.addColorStop(0.80, 'rgba(255,255,255,0.19)');
      grd.addColorStop(1.00, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    });
  }
  function texDrop() { return Tex.radialGlow('fxDrop', 0.40); }   // water droplet
  function texSpark() { return Tex.radialGlow('fxSpark', 0.16); } // firefly / mote

  function texPetal() {
    return Tex.canvas('fxPetal', 64, 64, function (g, w, h) {
      const c = w * 0.5;
      const grd = g.createRadialGradient(c, c, 0, c, c, w * 0.5);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.55, 'rgba(255,255,255,0.96)');
      grd.addColorStop(0.86, 'rgba(255,255,255,0.5)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.save();
      g.translate(c, c); g.rotate(-0.55); g.scale(1, 0.8);
      g.fillStyle = grd;
      g.beginPath(); g.arc(0, 0, w * 0.5, 0, TAU); g.fill();
      g.restore();
    });
  }

  function texLeaf() {
    return Tex.canvas('fxLeaf', 64, 64, function (g, w, h) {
      const c = w * 0.5;
      const grd = g.createRadialGradient(c, c, 0, c, c, w * 0.52);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.68, 'rgba(255,255,255,0.94)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.save();
      g.translate(c, c); g.rotate(0.62);
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(-w * 0.48, 0);
      g.quadraticCurveTo(0, -w * 0.62, w * 0.48, 0);
      g.quadraticCurveTo(0, w * 0.62, -w * 0.48, 0);
      g.fill();
      g.restore();
    });
  }

  /* ------------------------------------------------------------
     shared point materials (one per kind, created lazily)
     ------------------------------------------------------------ */
  function patchPointSize(shader) {
    shader.vertexShader = 'attribute float aSize;\n' + shader.vertexShader
      .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
  }
  function fxCacheKey() { return 'fxPoints'; }

  function pointsMat(name, map, additive, attn) {
    const m = new T.PointsMaterial({
      size: 1,                       // real size rides the aSize attribute (metres)
      map: map,
      color: 0xffffff,
      vertexColors: true,            // itemSize 4 -> USE_COLOR_ALPHA (rgb tint + alpha)
      transparent: true,
      depthWrite: false,
      sizeAttenuation: attn !== false,
      blending: additive ? T.AdditiveBlending : T.NormalBlending,
      fog: !additive,                // additive + fog would ADD fog colour
      toneMapped: !additive,         // keep additive sprites from blowing out (ACES)
      alphaTest: 0,
    });
    m.name = name;
    m.onBeforeCompile = patchPointSize;
    m.customProgramCacheKey = fxCacheKey;
    return m;
  }

  let _mSoft = null, _mDrop = null, _mFire = null, _mMote = null,
    _mPetal = null, _mLeaf = null, _mSpeck = null;

  function matSoft() { if (!_mSoft) _mSoft = pointsMat('fx_soft', texPuff(), false); return _mSoft; }
  function matDrop() { if (!_mDrop) _mDrop = pointsMat('fx_drop', texDrop(), true); return _mDrop; }
  function matFire() { if (!_mFire) _mFire = pointsMat('fx_firefly', texSpark(), true); return _mFire; }
  function matMote() { if (!_mMote) _mMote = pointsMat('fx_mote', texSpark(), true); return _mMote; }
  function matPetal() { if (!_mPetal) _mPetal = pointsMat('fx_petal', texPetal(), false); return _mPetal; }
  function matLeaf() { if (!_mLeaf) _mLeaf = pointsMat('fx_leaf', texLeaf(), false); return _mLeaf; }
  function matSpeck() {
    if (!_mSpeck) { _mSpeck = pointsMat('fx_speck', texPuff(), false, false); _mSpeck.fog = false; }
    return _mSpeck;
  }

  /* ------------------------------------------------------------
     registries + one ticker per kind
     ------------------------------------------------------------ */
  const clouds = [];        // every point cloud, for setQuality
  const smokes = [];        // smoke / steam / plume / waterfall-mist
  const waters = [];        // fountain jets / waterfalls / sea spray
  const fireflyFields = [];
  const fallers = [];       // petals / leaves
  const moteFields = [];
  const ringSlots = [];     // 6 shared additive ripple materials
  const ringMeshes = [];    // { mesh, slot, r0 }
  const glowMats = [];      // lamp pools / window spill (opacity <- lampF)
  const birdFlocks = [];

  let quality = 1;
  const tickers = {};
  function ensureTicker(name, fn, always) {
    if (tickers[name]) return;
    tickers[name] = TOWN.Ticker.add(fn, name, always ? { always: true } : undefined);
  }

  /* ------------------------------------------------------------
     point cloud allocation (once, never rebuilt)
     ------------------------------------------------------------ */
  function makeCloud(n, mat, cx, cy, cz, bRadius, keepMin) {
    n = Math.max(1, n | 0);
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 4);
    const siz = new Float32Array(n);
    const aPos = new T.BufferAttribute(pos, 3);
    const aCol = new T.BufferAttribute(col, 4);
    const aSiz = new T.BufferAttribute(siz, 1);
    geo.setAttribute('position', aPos);
    geo.setAttribute('color', aCol);
    geo.setAttribute('aSize', aSiz);
    // manual bounding sphere: positions are absolute + moving, so an
    // auto-computed sphere (from frame 0) would cull incorrectly.
    geo.boundingSphere = new T.Sphere(new T.Vector3(cx, cy, cz), Math.max(0.75, bRadius));
    const pts = new T.Points(geo, mat);
    pts.frustumCulled = true;
    pts.userData.dynamic = true;
    const c = {
      geo: geo, pts: pts, pos: pos, col: col, siz: siz,
      aPos: aPos, aCol: aCol, aSiz: aSiz,
      full: n, active: n, min: Math.min(keepMin || 2, n),
    };
    applyQuality(c);
    clouds.push(c);
    return c;
  }

  function applyQuality(c) {
    const n = U.clamp(Math.round(c.full * quality), c.min, c.full);
    c.active = n;
    c.geo.setDrawRange(0, n);
  }

  function flush(c) {
    c.aPos.needsUpdate = true;
    c.aCol.needsUpdate = true;
    c.aSiz.needsUpdate = true;
  }

  /**
   * setQuality(q) — q in 0..1 scales every emitter's live particle
   * count by shrinking drawRange (and the update loop) on the EXISTING
   * geometry.  Nothing is reallocated; call it as often as you like.
   */
  FX.setQuality = function (q) {
    quality = U.clamp(num(q, 1), 0, 1);
    for (let i = 0; i < clouds.length; i++) applyQuality(clouds[i]);
    return quality;
  };

  /** stats() — live particle accounting (used for the budget check) */
  FX.stats = function () {
    let full = 0, active = 0;
    for (let i = 0; i < clouds.length; i++) { full += clouds[i].full; active += clouds[i].active; }
    return {
      quality: quality, clouds: clouds.length,
      particles: full, activeParticles: active,
      emitters: {
        smoke: smokes.length, water: waters.length, fireflies: fireflyFields.length,
        fall: fallers.length, motes: moteFields.length, birds: birdFlocks.length,
        rings: ringMeshes.length, glow: glowMats.length,
      },
      tickers: Object.keys(tickers),
    };
  };

  /* =============================================================
     1 · PUFFS — smoke / steam / plume / waterfall mist
     ============================================================= */
  const SMOKE_PRESET = {
    smoke: { rate: 6, size: 0.5, spread: 0.25, rise: 1.1, life: 4, dens: 0.85, turb: 0.16, alpha: 0.8, warm: 1, color: 0xe6eaec, cap: 40 },
    steam: { rate: 9, size: 0.4, spread: 0.12, rise: 2.05, life: 1.7, dens: 1.0, turb: 0.1, alpha: 0.58, warm: 0.5, color: 0xf2f8fa, cap: 24 },
    plume: { rate: 5, size: 1.15, spread: 0.5, rise: 0.95, life: 7, dens: 0.98, turb: 0.3, alpha: 0.62, warm: 0.85, color: 0xc6cbd0, cap: 40 },
    mist: { rate: 9, size: 0.85, spread: 0.6, rise: 0.62, life: 2.7, dens: 1.0, turb: 0.18, alpha: 0.46, warm: 0.35, color: 0xf3fbfc, cap: 30 },
  };

  function makePuffs(o, pre, kind, forced) {
    o = o || {};
    const seed = num(o.seed, 1);
    const r = U.rng(seed);
    const x = co(o.position, 0, 0), y = co(o.position, 1, 0), z = co(o.position, 2, 0);
    const rate = Math.max(0.5, num(o.rate, pre.rate));
    const life = Math.max(0.3, num(o.life, pre.life));
    const size = Math.max(0.02, num(o.size, pre.size));
    const spread = Math.max(0, num(o.spread, pre.spread));
    const rise = num(o.rise, pre.rise);
    const n = forced ? forced : U.clamp(Math.round(rate * life * pre.dens), 6, pre.cap);

    const top = rise * life * 1.16;
    const bR = spread * 2 + size * 3.4 + top + 2.6 * life * 0.6;
    const cloud = makeCloud(n, matSoft(), x, y + top * 0.5, z, bR, 3);

    const e = {
      cloud: cloud, x: x, y: y, z: z, life: life, size: size, spread: spread,
      rise: rise, turb: pre.turb, alpha: num(o.alpha, pre.alpha), warm: pre.warm,
      base: new T.Color(num(o.color, pre.color)),
      age: new Float32Array(n), ph: new Float32Array(n),
      jx: new Float32Array(n), jy: new Float32Array(n), jz: new Float32Array(n),
      sz: new Float32Array(n), br: new Float32Array(n),
    };
    for (let i = 0; i < n; i++) {
      e.age[i] = ((i + r() * 0.8) / n) * life;      // pre-staggered: instant stream
      e.ph[i] = r() * TAU;
      e.jx[i] = r.bell(); e.jy[i] = r.bell(); e.jz[i] = r.bell();
      e.sz[i] = 0.72 + r() * 0.66;
      e.br[i] = 0.72 + r() * 0.55;
    }
    updatePuffs(e, 0, 0, cloud.full);
    flush(cloud);
    smokes.push(e);
    ensureTicker('fx-smoke', tickSmoke);

    const g = TOWN.group(kind);
    g.add(cloud.pts);
    e.group = g;
    return { g: g, e: e, top: top, n: n };
  }

  function updatePuffs(e, dt, t, count) {
    const p = e.cloud.pos, c = e.cloud.col, s = e.cloud.siz;
    const life = e.life, spread = e.spread, size = e.size, rise = e.rise, turb = e.turb;
    const w = windAt(t);
    const wx = w.x, wz = w.z, wy = w.y * 0.2;

    // grey-white by day, warm & back-lit at golden hour
    _cA.copy(e.base);
    _cB.copy(ENV.sunColor);
    const warmth = U.saturate(ENV.duskF) * 0.6 * e.warm;
    _cA.lerp(_cB, warmth);
    const shade = U.lerp(0.42, 1, U.saturate(ENV.dayF * 0.85 + ENV.duskF * 0.5 + 0.16));
    const cr = _cA.r * shade, cg = _cA.g * shade, cb = _cA.b * shade;
    const alpha = e.alpha;

    for (let i = 0; i < count; i++) {
      let a = e.age[i] + dt;
      if (a >= life) a -= life * Math.floor(a / life);        // exact recycle
      e.age[i] = a;
      const u = a / life;
      const ph = e.ph[i];
      const tb = turb * (0.22 + u);
      const lever = a * (0.34 + 0.66 * u);
      const i3 = i * 3, i4 = i * 4;
      p[i3] = e.x + e.jx[i] * spread * (0.3 + 0.9 * u) + wx * lever + Math.sin(ph + a * 1.7) * tb;
      p[i3 + 1] = e.y + rise * a * (0.72 + 0.42 * u) + e.jy[i] * spread * 0.3
        + Math.sin(ph * 2.1 + a * 1.1) * tb * 0.35 + wy * lever;
      p[i3 + 2] = e.z + e.jz[i] * spread * (0.3 + 0.9 * u) + wz * lever + Math.cos(ph * 1.3 + a * 1.45) * tb;
      s[i] = size * e.sz[i] * (0.45 + 2.05 * u);
      const fade = (u < 0.18 ? u * 5.5 : 1) * (1 - u) * (1 - u * 0.32);
      const br = e.br[i];
      c[i4] = cr * br; c[i4 + 1] = cg * br; c[i4 + 2] = cb * br;
      c[i4 + 3] = fade * alpha * br;
    }
  }

  function tickSmoke(dt, t, env) {
    ENV = env || ENV;
    if (ENV.reduced) return;
    for (let i = 0; i < smokes.length; i++) {
      const e = smokes[i];
      if (e.group && e.group.visible === false) continue;
      updatePuffs(e, dt, t, e.cloud.active);
      flush(e.cloud);
    }
  }

  /**
   * smoke({position:[x,y,z], seed, rate=6, size=0.5, color, spread=0.25,
   *        rise=1.1, life=4})
   * Chimney smoke: soft round puffs born at the pot, expanding and
   * fading as they rise, drifting with the wind, slightly turbulent.
   * position = ABSOLUTE world position of the chimney pot mouth.
   * ~20 particles (rate*life*0.85, hard cap 40).
   */
  FX.smoke = function (o) {
    const m = makePuffs(o, SMOKE_PRESET.smoke, 'smoke');
    return finish(m.g, 'smoke', m.e.spread * 2 + 2, m.e.spread * 2 + 2, m.e.y + m.top);
  };

  /**
   * steam({position, seed})  — thinner, faster, shorter-lived puffs for
   * vents, kettles, manholes.  ~16 particles.  Absolute world coords.
   */
  FX.steam = function (o) {
    const m = makePuffs(o, SMOKE_PRESET.steam, 'steam');
    return finish(m.g, 'steam', m.e.spread * 2 + 1, m.e.spread * 2 + 1, m.e.y + m.top);
  };

  /**
   * smokePlume({position, seed}) — bigger, slower, heavier plume for the
   * steam-tram or a factory chimney.  ~34 particles.  Absolute coords.
   */
  FX.smokePlume = function (o) {
    const m = makePuffs(o, SMOKE_PRESET.plume, 'smokePlume');
    return finish(m.g, 'smokePlume', m.e.spread * 2 + 4, m.e.spread * 2 + 4, m.e.y + m.top);
  };

  /* =============================================================
     2 · RIPPLE RINGS  (splash / basin ripples)
     Shared pool of 6 additive materials: the loop phase lives on the
     MATERIAL (opacity) and each ring mesh only scales, so 30 splashes
     cost 6 materials instead of 90.
     ============================================================= */
  let _ringGeo = null;
  function ringGeo() {
    if (_ringGeo) return _ringGeo;
    const g = new T.RingGeometry(0.66, 1.0, 24, 2);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const rr = Math.sqrt(x * x + y * y);
      const u = U.saturate((rr - 0.66) / 0.34);
      const a = Math.sin(u * Math.PI);            // soft inner + outer edge
      col[i * 4] = 1; col[i * 4 + 1] = 1; col[i * 4 + 2] = 1;
      col[i * 4 + 3] = 0.08 + a * a * 0.92;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 4));
    _ringGeo = g;
    return g;
  }

  function ringPool() {
    if (ringSlots.length) return ringSlots;
    for (let i = 0; i < 6; i++) {
      const mat = new T.MeshBasicMaterial({
        color: P.foam,
        transparent: true,
        vertexColors: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.DoubleSide,
        fog: false,
        toneMapped: false,
        opacity: 0,
      });
      mat.name = 'fx_ripple' + i;
      ringSlots.push({ mat: mat, period: 1.9 + i * 0.27, off: i * 0.137, s: 0.3, a: 0 });
    }
    ensureTicker('fx-ring', tickRing);
    return ringSlots;
  }

  let ringPick = 0;
  function addRing(g, x, y, z, r0, slotIdx) {
    const pool = ringPool();
    const slot = pool[((slotIdx % 6) + 6) % 6];
    const m = new T.Mesh(ringGeo(), slot.mat);
    m.position.set(x, y, z);
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(r0 * slot.s);
    m.renderOrder = 3;
    m.castShadow = false; m.receiveShadow = false;
    m.userData.dynamic = true;
    g.add(m);
    ringMeshes.push({ mesh: m, slot: slot, r0: r0 });
    return m;
  }

  function tickRing(dt, t, env) {
    ENV = env || ENV;
    for (let i = 0; i < ringSlots.length; i++) {
      const s = ringSlots[i];
      const ph = U.mod(t / s.period + s.off, 1);
      s.s = 0.22 + 0.78 * ph;
      s.a = (1 - ph) * Math.min(1, ph * 7) * 0.55;
      s.mat.opacity = s.a;
      s.mat.visible = s.a > 0.004;
    }
    for (let i = 0; i < ringMeshes.length; i++) {
      const e = ringMeshes[i];
      e.mesh.scale.setScalar(e.r0 * e.slot.s);
    }
  }

  /**
   * splash({position:[x,y,z], r=1, seed})
   * Expanding ripple rings (3 thin additive RingGeometry discs lying
   * flat) that scale out and fade on a slow loop.  For the waterwheel,
   * moored boats, stream mouths.  position = ABSOLUTE world point on
   * the water surface (the rings sit 0.02 above it).
   */
  FX.splash = function (o) {
    o = o || {};
    const x = co(o.position, 0, 0), y = co(o.position, 1, 0), z = co(o.position, 2, 0);
    const r = Math.max(0.15, num(o.r, 1));
    const g = TOWN.group('splash');
    const base = num(o.seed, ringPick++) | 0;
    addRing(g, x, y + 0.02, z, r * 0.58, base);
    addRing(g, x, y + 0.021, z, r * 0.85, base + 2);
    addRing(g, x, y + 0.022, z, r * 1.1, base + 4);
    return finish(g, 'splash', r * 2.2, r * 2.2, y + 0.03);
  };

  /* =============================================================
     3 · WATER — fountain jets, waterfalls, sea spray
     ============================================================= */
  function makeWaterCloud(n, cx, cy, cz, bR, keep) {
    return makeCloud(n, matDrop(), cx, cy, cz, bR, keep || 4);
  }

  /**
   * fountainJet({position:[x,y,z], height=2.2, radius=0.25, count=90, seed})
   * Droplets launched up and outward on ballistic arcs that fall back
   * into the basin, plus a thin spray fraction and two subtle rippling
   * rings on the basin surface.
   * position = ABSOLUTE world position of the nozzle.
   */
  FX.fountainJet = function (o) {
    o = o || {};
    const r = U.rng(num(o.seed, 1));
    const x = co(o.position, 0, 0), y = co(o.position, 1, 0), z = co(o.position, 2, 0);
    const height = Math.max(0.3, num(o.height, 2.2));
    const rad = Math.max(0.02, num(o.radius, 0.25));
    const n = U.clamp(Math.round(num(o.count, 90)), 8, 160);

    const cloud = makeWaterCloud(n, x, y + height * 0.55, z, height * 1.4 + rad * 4 + 1.2);
    const e = {
      kind: 'jet', cloud: cloud, x: x, y: y, z: z,
      age: new Float32Array(n), life: new Float32Array(n), vy: new Float32Array(n),
      vr: new Float32Array(n), az: new Float32Array(n), ph: new Float32Array(n),
      sz: new Float32Array(n), br: new Float32Array(n),
      tint: new T.Color(0xdff2ff),
    };
    for (let i = 0; i < n; i++) {
      const spray = r.chance(0.28);
      const hv = height * (spray ? r.range(0.25, 0.6) : r.range(0.78, 1.06));
      const vy = Math.sqrt(2 * GRAV * hv);
      const up = vy / GRAV;
      e.vy[i] = vy;
      e.life[i] = up * 2 * r.range(0.92, 1.1);
      e.vr[i] = (rad / Math.max(0.12, up)) * (spray ? r.range(1.4, 3.0) : r.range(0.45, 1.35));
      e.az[i] = r() * TAU;
      e.ph[i] = r() * TAU;
      e.sz[i] = spray ? r.range(0.12, 0.22) : r.range(0.18, 0.34);
      e.br[i] = spray ? r.range(0.4, 0.7) : r.range(0.7, 1.05);
      e.age[i] = r() * e.life[i];
    }
    updateJet(e, 0, 0, cloud.full);
    flush(cloud);
    waters.push(e);
    ensureTicker('fx-water', tickWater);

    const g = TOWN.group('fountainJet');
    g.add(cloud.pts);
    e.group = g;
    const bR = Math.max(0.7, rad * 3.2);
    addRing(g, x, y + 0.02, z, bR * 0.7, ringPick++);
    addRing(g, x, y + 0.021, z, bR, ringPick++ + 3);
    return finish(g, 'fountainJet', bR * 2.2, bR * 2.2, y + height * 1.05);
  };

  function updateJet(e, dt, t, count) {
    const p = e.cloud.pos, c = e.cloud.col, s = e.cloud.siz;
    const sun = U.saturate(ENV.dayF);
    _cA.copy(e.tint);
    _cB.copy(ENV.sunColor);
    _cA.lerp(_cB, 0.25 * sun);
    const shade = U.lerp(0.4, 1, U.saturate(ENV.dayF * 0.8 + ENV.duskF * 0.6 + 0.2));
    const cr = _cA.r * shade, cg = _cA.g * shade, cb = _cA.b * shade;

    for (let i = 0; i < count; i++) {
      const life = e.life[i];
      let a = e.age[i] + dt;
      if (a >= life) {
        a -= life * Math.floor(a / life);
        e.az[i] += 2.39996323;                 // golden-angle: fresh arc each cycle
        if (e.az[i] > 1e4) e.az[i] = U.mod(e.az[i], TAU);
      }
      e.age[i] = a;
      const u = a / life;
      const az = e.az[i], vr = e.vr[i];
      const i3 = i * 3, i4 = i * 4;
      const rr = vr * a;
      p[i3] = e.x + Math.cos(az) * rr;
      p[i3 + 1] = Math.max(e.y - 0.02, e.y + e.vy[i] * a - 0.5 * GRAV * a * a);
      p[i3 + 2] = e.z + Math.sin(az) * rr;
      s[i] = e.sz[i] * (1.05 - 0.25 * u);
      const spark = 1 + 0.4 * sun * Math.max(0, Math.sin(a * 24 + e.ph[i]));
      const al = Math.min(1, a * 12) * (1 - u * u * 0.85) * e.br[i] * 0.72;
      c[i4] = cr * spark; c[i4 + 1] = cg * spark; c[i4 + 2] = cb * spark;
      c[i4 + 3] = al;
    }
  }

  /**
   * waterfall({position:[x,y,z], height=4, width=1.6, count=140, seed})
   * A falling sheet of droplets, rising mist at the base and two soft
   * additive haze sprites.  position = ABSOLUTE world position of the
   * LIP (top centre); the water lands at y - height.
   */
  FX.waterfall = function (o) {
    o = o || {};
    const r = U.rng(num(o.seed, 1));
    const x = co(o.position, 0, 0), y = co(o.position, 1, 0), z = co(o.position, 2, 0);
    const height = Math.max(0.5, num(o.height, 4));
    const width = Math.max(0.2, num(o.width, 1.6));
    const n = U.clamp(Math.round(num(o.count, 140)), 12, 240);

    const cloud = makeWaterCloud(n, x, y - height * 0.5, z + 0.25, height * 0.8 + width + 1.2);
    const e = {
      kind: 'fall', cloud: cloud, x: x, y: y, z: z, height: height, width: width,
      age: new Float32Array(n), life: new Float32Array(n), v0: new Float32Array(n),
      ax: new Float32Array(n), az: new Float32Array(n), fw: new Float32Array(n),
      ph: new Float32Array(n), sz: new Float32Array(n), br: new Float32Array(n),
      tint: new T.Color(0xe6f6ff), haze: [],
    };
    for (let i = 0; i < n; i++) {
      const v0 = r.range(0.5, 2.1);
      e.v0[i] = v0;
      e.life[i] = (-v0 + Math.sqrt(v0 * v0 + 2 * GRAV * height)) / GRAV;
      e.ax[i] = r.bell() * width * 0.5;
      e.az[i] = r.bell() * 0.13;
      e.fw[i] = r.range(0.1, 0.42);        // how far the sheet leans forward (+Z)
      e.ph[i] = r() * TAU;
      e.sz[i] = r.range(0.2, 0.38);
      e.br[i] = r.range(0.55, 1.05);
      e.age[i] = r() * e.life[i];
    }
    updateFall(e, 0, 0, cloud.full);
    flush(cloud);
    waters.push(e);
    ensureTicker('fx-water', tickWater);

    const g = TOWN.group('waterfall');
    g.add(cloud.pts);
    e.group = g;

    // rising mist at the foot (reuses the puff integrator + fx-smoke ticker)
    const mist = makePuffs({
      position: [x, y - height + 0.05, z + 0.3], seed: num(o.seed, 1) * 7 + 3,
      size: 0.55 + width * 0.22, spread: width * 0.55, rise: 0.6, life: 2.6, rate: 9,
    }, SMOKE_PRESET.mist, 'mist', U.clamp(Math.round(18 + width * 4), 12, 30));
    g.add(mist.g);

    // two soft additive haze sprites (day & night)
    for (let k = 0; k < 2; k++) {
      const s = TOWN.halo(0xe9f7ff, (width + 0.9) * (k ? 1.5 : 1.05),
        { always: true, max: k ? 0.13 : 0.2, hardness: 0.05 });
      s.position.set(x, y - height + (k ? 0.9 : 0.3), z + 0.35);
      s.userData.dynamic = true;
      e.haze.push(s);
      g.add(s);
    }
    // foam ripples where it lands
    addRing(g, x, y - height + 0.03, z + 0.35, width * 0.8, ringPick++);
    addRing(g, x, y - height + 0.031, z + 0.35, width * 1.15, ringPick++ + 3);

    return finish(g, 'waterfall', width * 2.4, width * 2.4, y + 0.2);
  };

  function updateFall(e, dt, t, count) {
    const p = e.cloud.pos, c = e.cloud.col, s = e.cloud.siz;
    const w = windAt(t);
    const sun = U.saturate(ENV.dayF);
    _cA.copy(e.tint);
    _cB.copy(ENV.sunColor);
    _cA.lerp(_cB, 0.2 * sun);
    const shade = U.lerp(0.42, 1, U.saturate(ENV.dayF * 0.8 + ENV.duskF * 0.6 + 0.2));
    const cr = _cA.r * shade, cg = _cA.g * shade, cb = _cA.b * shade;
    const yBase = e.y - e.height;

    for (let i = 0; i < count; i++) {
      const life = e.life[i];
      let a = e.age[i] + dt;
      if (a >= life) a -= life * Math.floor(a / life);
      e.age[i] = a;
      const u = a / life;
      const i3 = i * 3, i4 = i * 4;
      const drop = e.v0[i] * a + 0.5 * GRAV * a * a;
      p[i3] = e.x + e.ax[i] + Math.sin(e.ph[i] + a * 5.5) * 0.05 + w.x * a * 0.12;
      p[i3 + 1] = Math.max(yBase, e.y - drop);
      p[i3 + 2] = e.z + e.az[i] + e.fw[i] * u * 0.7 + w.z * a * 0.1;
      s[i] = e.sz[i] * (0.75 + 0.5 * u);
      const spark = 1 + 0.28 * sun * Math.max(0, Math.sin(a * 19 + e.ph[i]));
      const al = Math.min(1, a * 9) * (1 - u * 0.45) * e.br[i] * 0.7;
      c[i4] = cr * spark; c[i4 + 1] = cg * spark; c[i4 + 2] = cb * spark;
      c[i4 + 3] = al;
    }
    // gentle breathing of the haze sprites
    for (let k = 0; k < e.haze.length; k++) {
      const m = e.haze[k].material;
      m.opacity = (k ? 0.13 : 0.2) * (0.78 + 0.22 * Math.sin(t * 0.55 + k * 2.1));
    }
  }

  /**
   * seaSpray({position:[x,y,z], dir=[0,0,1], seed})
   * Small bursts of white spray where waves meet the rocks, firing on a
   * slow irregular rhythm.  position = ABSOLUTE world impact point,
   * dir = horizontal outward direction (array or Vector3).
   */
  FX.seaSpray = function (o) {
    o = o || {};
    const r = U.rng(num(o.seed, 1));
    const x = co(o.position, 0, 0), y = co(o.position, 1, 0), z = co(o.position, 2, 0);
    let dx = co(o.dir, 0, 0), dz = co(o.dir, 2, 1);
    const dl = Math.sqrt(dx * dx + dz * dz);
    if (dl < 1e-4) { dx = 0; dz = 1; } else { dx /= dl; dz /= dl; }
    const n = U.clamp(Math.round(num(o.count, 26)), 6, 60);

    const cloud = makeWaterCloud(n, x + dx * 0.8, y + 0.9, z + dz * 0.8, 3.6);
    const e = {
      kind: 'spray', cloud: cloud, x: x, y: y, z: z, dx: dx, dz: dz, r: r,
      t0: -0.25, next: 1.15,
      off: new Float32Array(n), life: new Float32Array(n), vy: new Float32Array(n),
      vh: new Float32Array(n), sp: new Float32Array(n), ph: new Float32Array(n),
      sz: new Float32Array(n), br: new Float32Array(n),
      tint: new T.Color(P.foam),
    };
    for (let i = 0; i < n; i++) {
      const vy = r.range(2.1, 4.1);
      e.vy[i] = vy;
      e.life[i] = (2 * vy / GRAV) * r.range(0.75, 1);
      e.off[i] = r.range(0, 0.32);
      e.vh[i] = r.range(0.7, 2.4);
      e.sp[i] = r.bell() * 0.6;                 // lateral fan
      e.ph[i] = r() * TAU;
      e.sz[i] = r.range(0.16, 0.32);
      e.br[i] = r.range(0.6, 1.05);
    }
    updateSpray(e, 0, 0, cloud.full);
    flush(cloud);
    waters.push(e);
    ensureTicker('fx-water', tickWater);

    const g = TOWN.group('seaSpray');
    g.add(cloud.pts);
    e.group = g;
    return finish(g, 'seaSpray', 3.2, 3.2, y + 1.1);
  };

  function updateSpray(e, dt, t, count) {
    const p = e.cloud.pos, c = e.cloud.col, s = e.cloud.siz;
    if (t >= e.next) {                                    // irregular rhythm
      e.t0 = t;
      e.next = t + e.r.range(1.1, 3.4);
    }
    _cA.copy(e.tint);
    const shade = U.lerp(0.45, 1, U.saturate(ENV.dayF * 0.85 + ENV.duskF * 0.5 + 0.18));
    const cr = _cA.r * shade, cg = _cA.g * shade, cb = _cA.b * shade;
    const dx = e.dx, dz = e.dz;
    const px = -dz, pz = dx;                              // perpendicular

    for (let i = 0; i < count; i++) {
      const a = (t - e.t0) - e.off[i];
      const life = e.life[i];
      const i3 = i * 3, i4 = i * 4;
      if (a <= 0 || a >= life) {                           // parked (finite!) & invisible
        p[i3] = e.x; p[i3 + 1] = e.y; p[i3 + 2] = e.z;
        s[i] = e.sz[i]; c[i4] = cr; c[i4 + 1] = cg; c[i4 + 2] = cb; c[i4 + 3] = 0;
        continue;
      }
      const u = a / life;
      const h = e.vh[i] * a;
      p[i3] = e.x + (dx + px * e.sp[i]) * h;
      p[i3 + 1] = Math.max(e.y - 0.05, e.y + e.vy[i] * a - 0.5 * GRAV * a * a);
      p[i3 + 2] = e.z + (dz + pz * e.sp[i]) * h;
      s[i] = e.sz[i] * (1.15 - 0.35 * u);
      c[i4] = cr; c[i4 + 1] = cg; c[i4 + 2] = cb;
      c[i4 + 3] = Math.min(1, a * 14) * (1 - u) * (1 - u * 0.4) * e.br[i] * 0.9;
    }
  }

  function tickWater(dt, t, env) {
    ENV = env || ENV;
    if (ENV.reduced) return;
    for (let i = 0; i < waters.length; i++) {
      const e = waters[i];
      if (e.group && e.group.visible === false) continue;
      if (e.kind === 'jet') updateJet(e, dt, t, e.cloud.active);
      else if (e.kind === 'fall') updateFall(e, dt, t, e.cloud.active);
      else updateSpray(e, dt, t, e.cloud.active);
      flush(e.cloud);
    }
  }

  /* =============================================================
     4 · FIREFLIES  (night only)
     ============================================================= */
  /**
   * fireflies({center:[x,y,z], radius=8, height=2.5, count=45, seed})
   * Warm-green glowing points wandering on smooth curl-ish paths, each
   * blinking on its own phase, sinking and rising.  Pushed to
   * TOWN.Stage.nightOnly so the app hides them by day.
   * center = ABSOLUTE world centre of the field, on the ground.
   */
  FX.fireflies = function (o) {
    o = o || {};
    const r = U.rng(num(o.seed, 1));
    const cx = co(o.center, 0, 0), cy = co(o.center, 1, 0), cz = co(o.center, 2, 0);
    const rad = Math.max(0.5, num(o.radius, 8));
    const hh = Math.max(0.4, num(o.height, 2.5));
    const n = U.clamp(Math.round(num(o.count, 45)), 4, 90);

    const cloud = makeCloud(n, matFire(), cx, cy + hh * 0.5, cz, rad + hh + 1, 4);
    const e = {
      cloud: cloud, cx: cx, cy: cy, cz: cz, rad: rad, hh: hh,
      ph: new Float32Array(n), spd: new Float32Array(n), rate: new Float32Array(n),
      sz: new Float32Array(n), hue: new Float32Array(n),
      tint: new T.Color(0xbfff7a), warm: new T.Color(0xffdc7a),
    };
    const p = cloud.pos, c = cloud.col, s = cloud.siz;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, rr = Math.sqrt(r()) * rad;
      const i3 = i * 3, i4 = i * 4;
      p[i3] = cx + Math.cos(a) * rr;
      p[i3 + 1] = cy + 0.15 + r() * hh;
      p[i3 + 2] = cz + Math.sin(a) * rr;
      e.ph[i] = r() * TAU;
      e.spd[i] = r.range(0.3, 0.75);
      e.rate[i] = r.range(1.1, 2.6);
      e.sz[i] = r.range(0.42, 0.7);
      e.hue[i] = r();
      s[i] = e.sz[i];
      c[i4] = 0; c[i4 + 1] = 0; c[i4 + 2] = 0; c[i4 + 3] = 0;
    }
    updateFireflies(e, 0, 0, cloud.full);
    flush(cloud);
    fireflyFields.push(e);
    ensureTicker('fx-fireflies', tickFireflies);

    const g = TOWN.group('fireflies');
    g.add(cloud.pts);
    e.group = g;
    Stage.nightOnly.push(g);
    return finish(g, 'fireflies', rad * 2, rad * 2, cy + hh + 0.4);
  };

  function updateFireflies(e, dt, t, count) {
    const p = e.cloud.pos, c = e.cloud.col, s = e.cloud.siz;
    const rad = e.rad, rad2 = rad * rad, hh = e.hh;
    const yLo = e.cy + 0.12, yHi = e.cy + hh;
    // warm green, a touch warmer when the lamps are on
    _cA.copy(e.tint).lerp(e.warm, 0.25 + 0.2 * U.saturate(ENV.lampF));
    const cr = _cA.r, cg = _cA.g, cb = _cA.b;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3, i4 = i * 4;
      let lx = p[i3] - e.cx, ly = p[i3 + 1] - e.cy, lz = p[i3 + 2] - e.cz;
      const ph = e.ph[i], sp = e.spd[i] * dt;
      // cheap curl-ish flow field
      const vx = Math.sin(ly * 0.9 + t * 0.45 + ph) * 0.9 + Math.cos(lz * 0.55 - t * 0.31 + ph * 1.7) * 0.55;
      const vz = Math.cos(lx * 0.8 - t * 0.38 + ph * 1.3) * 0.9 + Math.sin(ly * 0.7 + t * 0.27) * 0.55;
      const vy = Math.sin(t * 0.55 + ph * 2.1) * 0.6 + Math.cos(t * 0.23 + ph) * 0.28;
      lx += vx * sp; ly += vy * sp * 0.7; lz += vz * sp;
      const d2 = lx * lx + lz * lz;
      if (d2 > rad2) { const k = rad / Math.sqrt(d2); lx *= k * 0.995; lz *= k * 0.995; }
      let yy = e.cy + ly;
      if (yy < yLo) yy = yLo; else if (yy > yHi) yy = yHi;
      p[i3] = e.cx + lx; p[i3 + 1] = yy; p[i3 + 2] = e.cz + lz;
      // blink: own phase, sharp-ish envelope
      let b = Math.sin(t * e.rate[i] + ph * 3.1);
      b = b > 0 ? b * b * b : 0;
      const glow = 0.18 + 0.82 * b;
      s[i] = e.sz[i] * (0.55 + 0.6 * glow);
      const hv = e.hue[i];
      c[i4] = cr * glow * (0.85 + 0.3 * hv);
      c[i4 + 1] = cg * glow;
      c[i4 + 2] = cb * glow * (0.7 + 0.5 * (1 - hv));
      c[i4 + 3] = glow * 0.95;
    }
  }

  function tickFireflies(dt, t, env) {
    ENV = env || ENV;
    if (ENV.reduced) return;
    for (let i = 0; i < fireflyFields.length; i++) {
      const e = fireflyFields[i];
      if (e.group && e.group.visible === false) continue;
      updateFireflies(e, dt, t, e.cloud.active);
      flush(e.cloud);
    }
  }

  /* =============================================================
     5 · FALLERS — petals & autumn leaves
     ============================================================= */
  function makeFallers(o, cfg, kind, mat) {
    o = o || {};
    const r = U.rng(num(o.seed, 1));
    const cx = co(o.center, 0, 0), cy = co(o.center, 1, 0), cz = co(o.center, 2, 0);
    const rad = Math.max(0.4, num(o.radius, cfg.radius));
    const hh = Math.max(0.6, num(o.height, cfg.height));
    const n = U.clamp(Math.round(num(o.count, cfg.count)), 4, 120);

    const cols = [];
    if (o.colors && typeof o.colors.length === 'number' && o.colors.length) {
      for (let i = 0; i < o.colors.length; i++) cols.push(new T.Color(o.colors[i]));
    } else if (o.color !== undefined) {
      cols.push(new T.Color(o.color));
    } else {
      for (let i = 0; i < cfg.colors.length; i++) cols.push(new T.Color(cfg.colors[i]));
    }

    const cloud = makeCloud(n, mat, cx, cy + hh * 0.5, cz, rad + hh * 0.6 + 3, 4);
    const e = {
      cloud: cloud, cx: cx, cy: cy, cz: cz, rad: rad, hh: hh, cfg: cfg,
      ang: new Float32Array(n), rr: new Float32Array(n), yy: new Float32Array(n),
      spin: new Float32Array(n), srate: new Float32Array(n), fall: new Float32Array(n),
      swirl: new Float32Array(n), dx: new Float32Array(n), dz: new Float32Array(n),
      sz: new Float32Array(n), cr: new Float32Array(n), cg: new Float32Array(n), cb: new Float32Array(n),
    };
    for (let i = 0; i < n; i++) {
      const col = cols[Math.floor(r() * cols.length * 0.99999)];
      e.ang[i] = r() * TAU;
      e.rr[i] = Math.sqrt(r()) * rad;
      e.yy[i] = cy + r() * hh;
      e.spin[i] = r() * TAU;
      e.srate[i] = r.range(cfg.spin[0], cfg.spin[1]);
      e.fall[i] = r.range(cfg.fall[0], cfg.fall[1]);
      e.swirl[i] = r.range(cfg.swirl[0], cfg.swirl[1]) * r.sign();
      e.sz[i] = r.range(cfg.size[0], cfg.size[1]);
      e.cr[i] = col.r; e.cg[i] = col.g; e.cb[i] = col.b;
    }
    updateFallers(e, 0, 0, cloud.full);
    flush(cloud);
    fallers.push(e);
    ensureTicker('fx-fall', tickFall);

    const g = TOWN.group(kind);
    g.add(cloud.pts);
    e.group = g;
    return { g: g, e: e };
  }

  function updateFallers(e, dt, t, count) {
    const p = e.cloud.pos, c = e.cloud.col, s = e.cloud.siz, cfg = e.cfg;
    const w = windAt(t);
    const wx = w.x * cfg.drift, wz = w.z * cfg.drift;
    const shade = U.lerp(0.34, 1, U.saturate(ENV.dayF * 0.9 + ENV.duskF * 0.45 + 0.14));
    const top = e.cy + e.hh;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3, i4 = i * 4;
      let y = e.yy[i] - e.fall[i] * dt;
      let ang = e.ang[i] + e.swirl[i] * dt;
      let sp = e.spin[i] + e.srate[i] * dt;
      let dx = e.dx[i] + wx * dt, dz = e.dz[i] + wz * dt;
      if (y <= e.cy) {                                   // respawn at the top
        y = top; dx = 0; dz = 0;
      }
      if (ang > TAU) ang -= TAU; else if (ang < 0) ang += TAU;
      if (sp > TAU) sp -= TAU;
      e.yy[i] = y; e.ang[i] = ang; e.spin[i] = sp; e.dx[i] = dx; e.dz[i] = dz;

      const fl = Math.sin(sp) * cfg.flutter;
      p[i3] = e.cx + Math.cos(ang) * e.rr[i] + dx + fl;
      p[i3 + 1] = y + Math.sin(sp * 1.7) * cfg.bob;
      p[i3 + 2] = e.cz + Math.sin(ang) * e.rr[i] + dz + Math.cos(sp * 1.3) * cfg.flutter * 0.7;

      const tumble = 0.45 + 0.55 * Math.abs(Math.sin(sp));   // edge-on -> thin & dim
      s[i] = e.sz[i] * (0.6 + 0.55 * tumble);
      const u = U.saturate((y - e.cy) / e.hh);
      const fade = Math.min(1, (1 - u) * 6.5) * U.smoothstep(0, 0.18, u);
      const a = fade * tumble * cfg.alpha;
      const sh = shade * (0.75 + 0.35 * tumble);
      c[i4] = e.cr[i] * sh; c[i4 + 1] = e.cg[i] * sh; c[i4 + 2] = e.cb[i] * sh;
      c[i4 + 3] = a;
    }
  }

  function tickFall(dt, t, env) {
    ENV = env || ENV;
    if (ENV.reduced) return;
    for (let i = 0; i < fallers.length; i++) {
      const e = fallers[i];
      if (e.group && e.group.visible === false) continue;
      updateFallers(e, dt, t, e.cloud.active);
      flush(e.cloud);
    }
  }

  const PETAL_CFG = {
    radius: 6, height: 7, count: 60, size: [0.34, 0.56], fall: [0.35, 0.62],
    spin: [1.1, 2.4], swirl: [0.12, 0.4], flutter: 0.16, bob: 0.05,
    drift: 0.55, alpha: 0.92, colors: [P.leafPink, 0xfad3e0, P.flowerWhite, 0xf7c2d4],
  };
  const LEAF_CFG = {
    radius: 7, height: 6.5, count: 40, size: [0.4, 0.62], fall: [0.75, 1.35],
    spin: [2.2, 4.4], swirl: [0.2, 0.6], flutter: 0.34, bob: 0.11,
    drift: 0.75, alpha: 0.95, colors: [P.leafAutumn, P.leafRust, P.roofTerracotta, 0xe0a94a, P.leafOlive],
  };

  /**
   * petals({center:[x,y,z], radius=6, height=7, count=60, seed, color})
   * Cherry-blossom petals spiralling down, tumbling, drifting with the
   * wind, fading out near the ground and respawning at the top.
   * center = ABSOLUTE world position of the ground point under the tree.
   */
  FX.petals = function (o) {
    const m = makeFallers(o, PETAL_CFG, 'petals', matPetal());
    return finish(m.g, 'petals', m.e.rad * 2, m.e.rad * 2, m.e.cy + m.e.hh);
  };

  /**
   * leaves({center, radius=7, height=6.5, count=40, seed, colors})
   * Autumn leaves: heavier and faster than petals, with a real flutter.
   * center = ABSOLUTE world position of the ground point under the tree.
   */
  FX.leaves = function (o) {
    const m = makeFallers(o, LEAF_CFG, 'leaves', matLeaf());
    return finish(m.g, 'leaves', m.e.rad * 2, m.e.rad * 2, m.e.cy + m.e.hh);
  };

  /* =============================================================
     6 · DUST MOTES  (day only, loveliest at golden hour)
     ============================================================= */
  /**
   * dustMotes({center:[x,y,z], radius=10, height=6, count=50, seed})
   * Tiny bright motes drifting in the air; opacity scales with
   * TOWN.Env.duskF*0.6 + dayF*0.4 so they bloom at golden hour.
   * Pushed to TOWN.Stage.dayOnly.  center = ABSOLUTE world coords.
   */
  FX.dustMotes = function (o) {
    o = o || {};
    const r = U.rng(num(o.seed, 1));
    const cx = co(o.center, 0, 0), cy = co(o.center, 1, 0), cz = co(o.center, 2, 0);
    const rad = Math.max(0.5, num(o.radius, 10));
    const hh = Math.max(0.5, num(o.height, 6));
    const n = U.clamp(Math.round(num(o.count, 50)), 4, 100);

    const cloud = makeCloud(n, matMote(), cx, cy + hh * 0.5, cz, rad + hh + 1, 4);
    const e = {
      cloud: cloud, cx: cx, cy: cy, cz: cz, rad: rad, hh: hh,
      ph: new Float32Array(n), spd: new Float32Array(n), tw: new Float32Array(n),
      sz: new Float32Array(n), br: new Float32Array(n),
      tint: new T.Color(0xfff2d8),
    };
    const p = cloud.pos;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, rr = Math.sqrt(r()) * rad;
      const i3 = i * 3;
      p[i3] = cx + Math.cos(a) * rr;
      p[i3 + 1] = cy + 0.15 + r() * hh;
      p[i3 + 2] = cz + Math.sin(a) * rr;
      e.ph[i] = r() * TAU;
      e.spd[i] = r.range(0.1, 0.34);
      e.tw[i] = r.range(0.7, 2.3);
      e.sz[i] = r.range(0.11, 0.24);
      e.br[i] = r.range(0.55, 1.05);
    }
    updateMotes(e, 0, 0, cloud.full);
    flush(cloud);
    moteFields.push(e);
    ensureTicker('fx-motes', tickMotes);

    const g = TOWN.group('dustMotes');
    g.add(cloud.pts);
    e.group = g;
    Stage.dayOnly.push(g);
    return finish(g, 'dustMotes', rad * 2, rad * 2, cy + hh);
  };

  function updateMotes(e, dt, t, count) {
    const p = e.cloud.pos, c = e.cloud.col, s = e.cloud.siz;
    const rad = e.rad, rad2 = rad * rad;
    const yLo = e.cy + 0.1, yHi = e.cy + e.hh;
    const w = windAt(t);
    const vis = U.saturate(ENV.duskF * 0.6 + ENV.dayF * 0.4);
    _cA.copy(e.tint).lerp(ENV.sunColor, 0.45 * U.saturate(ENV.duskF));
    const cr = _cA.r, cg = _cA.g, cb = _cA.b;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3, i4 = i * 4;
      let lx = p[i3] - e.cx, ly = p[i3 + 1] - e.cy, lz = p[i3 + 2] - e.cz;
      const ph = e.ph[i], sp = e.spd[i] * dt;
      lx += (Math.sin(ly * 0.6 + t * 0.21 + ph) + w.x * 0.35) * sp;
      ly += (Math.sin(t * 0.33 + ph * 1.9) * 0.7) * sp;
      lz += (Math.cos(lx * 0.5 - t * 0.18 + ph * 1.4) + w.z * 0.35) * sp;
      const d2 = lx * lx + lz * lz;
      if (d2 > rad2) { const k = rad / Math.sqrt(d2); lx *= k * 0.99; lz *= k * 0.99; }
      let yy = e.cy + ly;
      if (yy < yLo) yy = yLo; else if (yy > yHi) yy = yHi;
      p[i3] = e.cx + lx; p[i3 + 1] = yy; p[i3 + 2] = e.cz + lz;
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * e.tw[i] + ph));
      s[i] = e.sz[i] * (0.7 + 0.5 * tw);
      const a = vis * tw * e.br[i] * 0.78;
      c[i4] = cr; c[i4 + 1] = cg; c[i4 + 2] = cb; c[i4 + 3] = a;
    }
  }

  function tickMotes(dt, t, env) {
    ENV = env || ENV;
    if (ENV.reduced) return;
    for (let i = 0; i < moteFields.length; i++) {
      const e = moteFields[i];
      if (e.group && e.group.visible === false) continue;
      updateMotes(e, dt, t, e.cloud.active);
      flush(e.cloud);
    }
  }

  /* =============================================================
     7 · BIRD SPECKS  (very distant birds, no geometry)
     ============================================================= */
  /**
   * birdSpecks({center:[x,y,z], radius=26, count=14, seed})
   * Tiny dark specks wheeling high in the sky — cheap Points with
   * sizeAttenuation OFF so they stay a couple of pixels wide.
   * center = ABSOLUTE world centre of the circling flock (use a high y).
   */
  FX.birdSpecks = function (o) {
    o = o || {};
    const r = U.rng(num(o.seed, 1));
    const cx = co(o.center, 0, 0), cy = co(o.center, 1, 24), cz = co(o.center, 2, 0);
    const rad = Math.max(2, num(o.radius, 26));
    const n = U.clamp(Math.round(num(o.count, 14)), 2, 40);

    const cloud = makeCloud(n, matSpeck(), cx, cy, cz, rad * 1.3 + 4, 2);
    const e = {
      cloud: cloud, cx: cx, cy: cy, cz: cz,
      ang: new Float32Array(n), rr: new Float32Array(n), av: new Float32Array(n),
      yy: new Float32Array(n), ph: new Float32Array(n), sz: new Float32Array(n),
      tint: new T.Color(0x2f3540),
    };
    for (let i = 0; i < n; i++) {
      e.ang[i] = r() * TAU;
      e.rr[i] = rad * r.range(0.35, 1);
      e.av[i] = r.range(0.05, 0.16) * r.sign();
      e.yy[i] = r.bell() * 3.2;
      e.ph[i] = r() * TAU;
      e.sz[i] = r.range(1.7, 3.1);          // pixels
    }
    updateBirds(e, 0, 0, cloud.full);
    flush(cloud);
    birdFlocks.push(e);
    ensureTicker('fx-birds', tickBirds);

    const g = TOWN.group('birdSpecks');
    g.add(cloud.pts);
    e.group = g;
    return finish(g, 'birdSpecks', rad * 2, rad * 2, cy + 3.5);
  };

  function updateBirds(e, dt, t, count) {
    const p = e.cloud.pos, c = e.cloud.col, s = e.cloud.siz;
    const shade = U.lerp(0.25, 1, U.saturate(ENV.dayF * 0.9 + ENV.duskF * 0.4 + 0.1));
    const cr = e.tint.r, cg = e.tint.g, cb = e.tint.b;
    const vis = U.saturate(0.15 + ENV.dayF * 0.85);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3, i4 = i * 4;
      let a = e.ang[i] + e.av[i] * dt;
      if (a > TAU) a -= TAU; else if (a < 0) a += TAU;
      e.ang[i] = a;
      const rr = e.rr[i];
      p[i3] = e.cx + Math.cos(a) * rr;
      p[i3 + 1] = e.cy + e.yy[i] + Math.sin(t * 0.6 + e.ph[i]) * 0.5;
      p[i3 + 2] = e.cz + Math.sin(a) * rr * 0.72;
      s[i] = e.sz[i] * (0.85 + 0.3 * Math.abs(Math.sin(t * 5.5 + e.ph[i])));  // wingbeat
      c[i4] = cr * shade; c[i4 + 1] = cg * shade; c[i4 + 2] = cb * shade;
      c[i4 + 3] = vis * 0.8;
    }
  }

  function tickBirds(dt, t, env) {
    ENV = env || ENV;
    if (ENV.reduced) return;
    for (let i = 0; i < birdFlocks.length; i++) {
      const e = birdFlocks[i];
      if (e.group && e.group.visible === false) continue;
      updateBirds(e, dt, t, e.cloud.active);
      flush(e.cloud);
    }
  }

  /* =============================================================
     8 · FAKE LIGHT POOLING — lamp pools & window spill
     Opacity follows TOWN.Env.lampF on ONE shared material per colour,
     so 30 lamp pools cost 1 material and no per-emitter state.
     ============================================================= */
  const glowMatCache = new Map();
  function glowMat(kind, color, max, on) {
    const key = kind + '|' + color + '|' + max;
    if (glowMatCache.has(key)) return glowMatCache.get(key);
    const m = new T.MeshBasicMaterial({
      color: color,
      map: Tex.radialGlow('fxPool', 0.02),
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side: T.DoubleSide,
      fog: false,
      toneMapped: false,
      opacity: 0,
    });
    m.name = 'fx_' + kind;
    m.visible = false;
    glowMatCache.set(key, m);
    glowMats.push({ mat: m, max: max, on: on, ph: glowMats.length * 2.7 });
    ensureTicker('fx-glow', tickGlow, true);
    return m;
  }

  function tickGlow(dt, t, env) {
    ENV = env || ENV;
    const lampF = ENV.lampF;
    for (let i = 0; i < glowMats.length; i++) {
      const e = glowMats[i];
      let v = 0;
      if (lampF > e.on) v = U.smoothstep(e.on, Math.min(1, e.on + 0.25), lampF) * e.max;
      e.mat.opacity = v;
      e.mat.visible = v > 0.004;
    }
  }

  let _discGeo = null;
  function discGeo() {
    if (!_discGeo) _discGeo = new T.CircleGeometry(1, 26);
    return _discGeo;
  }
  let _quadGeo = null;
  function quadGeo() {
    if (!_quadGeo) _quadGeo = new T.PlaneGeometry(1, 1);
    return _quadGeo;
  }

  /**
   * lampPool({position:[x,y,z], color=P.lampWarm, radius=2.4})
   * A soft additive disc lying flat on the ground under a street lamp
   * (radial-gradient texture, depthWrite:false, y + 0.02), whose opacity
   * follows TOWN.Env.lampF.  Cheap fake light pooling.
   * Pushed to TOWN.Stage.nightOnly.  position = ABSOLUTE ground point.
   */
  FX.lampPool = function (o) {
    o = o || {};
    const x = co(o.position, 0, 0), y = co(o.position, 1, 0), z = co(o.position, 2, 0);
    const rad = Math.max(0.2, num(o.radius, 2.4));
    const color = num(o.color, P.lampWarm);
    const mat = glowMat('pool', color, num(o.max, 0.5), num(o.on, 0.06));
    const m = new T.Mesh(discGeo(), mat);
    m.position.set(x, y + 0.02, z);
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(rad);
    m.renderOrder = 2;
    m.castShadow = false; m.receiveShadow = false;
    const g = TOWN.group('lampPool');
    g.add(m);
    Stage.nightOnly.push(g);
    return finish(g, 'lampPool', rad * 2, rad * 2, y + 0.03);
  };

  /**
   * windowSpill({position:[x,y,z], dir=[0,0,1], color=P.windowWarm, size=1.6})
   * A soft additive quad on the ground in front of a lit window, cast
   * along `dir`; opacity follows TOWN.Env.lampF.
   * Pushed to TOWN.Stage.nightOnly.  position = ABSOLUTE world point at
   * the foot of the wall, dir = outward horizontal direction.
   */
  FX.windowSpill = function (o) {
    o = o || {};
    const x = co(o.position, 0, 0), y = co(o.position, 1, 0), z = co(o.position, 2, 0);
    let dx = co(o.dir, 0, 0), dz = co(o.dir, 2, 1);
    const dl = Math.sqrt(dx * dx + dz * dz);
    if (dl < 1e-4) { dx = 0; dz = 1; } else { dx /= dl; dz /= dl; }
    const size = Math.max(0.2, num(o.size, 1.6));
    const color = num(o.color, P.windowWarm);
    const mat = glowMat('spill', color, num(o.max, 0.42), num(o.on, 0.1));

    const g = TOWN.group('windowSpill');
    const pivot = TOWN.group('spillPivot');
    pivot.rotation.y = Math.atan2(dx, dz);
    const m = new T.Mesh(quadGeo(), mat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(size * 1.15, size * 1.9, 1);
    m.position.set(0, 0, size * 0.72);
    m.renderOrder = 2;
    m.castShadow = false; m.receiveShadow = false;
    pivot.add(m);
    pivot.position.set(x, y + 0.02, z);
    g.add(pivot);
    Stage.nightOnly.push(g);
    return finish(g, 'windowSpill', size * 2, size * 2, y + 0.03);
  };

  /* =============================================================
     9 · demo — one of each along +X, for integration testing
     ============================================================= */
  /**
   * demo() — one of every effect in a row along X (8 m apart), all at
   * absolute world coordinates.  Add it straight to the scene.
   */
  FX.demo = function () {
    const g = TOWN.group('fxDemo');
    let x = -52;
    const step = 8;
    g.add(FX.smoke({ position: [x, 6, 0], seed: 11 })); x += step;
    g.add(FX.steam({ position: [x, 1.2, 0], seed: 12 })); x += step;
    g.add(FX.smokePlume({ position: [x, 8, 0], seed: 13 })); x += step;
    g.add(FX.fountainJet({ position: [x, 1, 0], seed: 14 })); x += step;
    g.add(FX.waterfall({ position: [x, 5, 0], height: 4, width: 1.6, seed: 15 })); x += step;
    g.add(FX.splash({ position: [x, 0, 0], r: 1.2, seed: 16 })); x += step;
    g.add(FX.fireflies({ center: [x, 0, 0], radius: 3, height: 2.5, seed: 17 })); x += step;
    g.add(FX.petals({ center: [x, 0, 0], radius: 3, height: 6, seed: 18 })); x += step;
    g.add(FX.leaves({ center: [x, 0, 0], radius: 3, height: 6, seed: 19 })); x += step;
    g.add(FX.dustMotes({ center: [x, 0, 0], radius: 3, height: 5, seed: 20 })); x += step;
    g.add(FX.seaSpray({ position: [x, 0.2, 0], dir: [0, 0, 1], seed: 21 })); x += step;
    g.add(FX.birdSpecks({ center: [x, 22, 0], radius: 8, seed: 22 })); x += step;
    g.add(FX.lampPool({ position: [x, 0, 0], radius: 2.4 })); x += step;
    g.add(FX.windowSpill({ position: [x, 0, 0], dir: [0, 0, 1], size: 1.6 }));
    return finish(g, 'fxDemo', 112, 12, 22);
  };

  console.log('[TOWN] fx ready · atmosphere & particles');
})(window);

/* ---- probe results ----  (./tools/probe.sh, headless Chromium/WebGL, three r152)
   Every run below reported  errors: []  ok: true  nan: 0.

   EXPORTS (18 keys) — 15 factories + setQuality + stats + windAt helper:
     smoke steam smokePlume  splash fountainJet waterfall seaSpray
     fireflies petals leaves dustMotes birdSpecks  lampPool windowSpill
     demo  setQuality stats windAt

   PER-FACTORY (defaults, measured pointCount / meshes / triangles)
     factory        pts  clouds mesh tris  sprites  size[x,y,z]            minY
     smoke           20    1     0     0     0     1.24 x 4.75 x 1.21     6.088
     steam           15    1     0     0     0     0.42 x 3.58 x 0.57     2.028
     smokePlume      34    1     0     0     0     2.46 x 7.61 x 1.99     9.040
     fountainJet     90    1     2   192     0     2.56 x 2.28 x 1.44     0.980
     waterfall      164    2     2   192     2     3.75 x 5.00 x 1.40    -0.012
                (140 droplets + 24 mist puffs, 2 haze sprites, 2 ripples)
     seaSpray        26    1     0     0     0     (burst-dependent)      0.300
     fireflies       45    1     0     0     0    13.75 x 2.30 x 14.70    1.198
     petals          60    1     0     0     0    10.68 x 6.88 x 11.73    5.048
     leaves          40    1     0     0     0    13.64 x 6.07 x 10.13    5.110
     dustMotes       50    1     0     0     0    15.49 x 5.81 x 18.83    3.189
     birdSpecks      14    1     0     0     0    36.66 x 2.97 x 18.37   22.964
     splash           0    0     3   288     0     0.66 x 0.00 x 0.66     0.020
     lampPool         0    0     1    26     0     4.80 x 0.00 x 4.77     0.040
     windowSpill      0    0     1     2     0     1.84 x 0.00 x 3.04     0.020
     demo()         558   12     9   700     2   104.99 x 23.68 x 7.38   -0.012
   userData is set on every group, e.g. waterfall ->
     {footprint:{w:3.84,d:3.84}, height:5.2, kind:'waterfall', dynamic:true}
   Seeds differ (smoke seeds 1..5 first-particle x: .071 .055 .018 -.008 -.057).

   BUDGET — realistic layout call set
     12*smoke + 4*waterfall + 6*fireflies + 2*fountainJet + petals + leaves
     + dustMotes  =  240 + 656 + 270 + 180 + 60 + 40 + 50 = 1496 particles
     (31 clouds)   <= 1500 (CONTRACT) and <= 2000 (brief).
     Adding every remaining emitter the town needs (30 lampPool, 8 splash,
     3 seaSpray, smokePlume, steam, birdSpecks) -> 1637 particles,
     66 meshes / 4236 tris / 8 sprites / 22 distinct materials / nan 0.

   setQuality(q) — drawRange only, geometry never rebuilt
     q:      1.00   0.75   0.50   0.25   0.00
     active: 1637   1233    822    412    128   (floor of 2-4 per cloud)
     position/color/aSize buffers keep their full length (verified: the
     attribute counts are unchanged, only geometry.drawRange.count moves,
     e.g. a smoke cloud 20 -> 10 at q=0.5).

   ANIMATION / NaN PROOF (smoke + fountainJet + waterfall + fireflies +
   petals + dustMotes in one scene, Env.lampF=1, Env.dayF=1)
      120 ticks: {moved:true, particles:429, nan:0, disabled:[]}
     3000 ticks: {moved:true, particles:429, nan:0, disabled:[],
                  maxAbsCoord:11.88}   <- recycles, never drifts away
     Also verified: deterministic for a given seed (identical buffers for two
     seed-42 emitters, at birth and after 60 ticks); Env.reduced=true freezes
     the particle tickers; with dynamics OFF only 'fx-glow' (always:true)
     runs and lamp-pool opacity still tracks lampF (0 -> 0.5).

   RENDER PROOF (ACES tone mapping + THREE.Fog + WebGL2, 20 frames of demo())
     6 programs compiled, 0 console errors -> the onBeforeCompile aSize patch
     and the 4-component vertex-colour alpha path are valid under the GLSL3
     upgrade.  Per-emitter framebuffer diff at a 45 m diorama camera
     (changedPx / maxDelta / blown-white px):
       smoke 120/40/0   steam 62/37/0    smokePlume 754/55/0
       fountainJet 321/228/1             waterfall 1622/200/0
       splash 351/197/0                  petals 148/31/0 (235/140 at 16 m)
       leaves 76/39/0   dustMotes 77/34/0  fireflies 174/158/0
       birdSpecks 65/138/0 (when inside the frustum)
       seaSpray 81/423/0 while a burst is in flight (28 % duty cycle)
       lampPool 2794/173/0               windowSpill 750/149/0
     i.e. every effect is genuinely visible and nothing blows out under ACES.

   WIND INTEROP — TOWN.Dynamics is read defensively, once per frame, shared by
   every kind.  Verified accepted forms: windDir as a PROPERTY (Vector3 /
   Vector2 / {x,y} == x,z / [x,z] / [x,y,z]) or as a FUNCTION windDir(t)
   returning any of those or a heading in radians; windStrength as number or
   function.  Magnitude is clamped to 2.6 m/s, and a NaN or throwing Dynamics
   falls back to the built-in breeze — measured disabled:[] in every case.
   With no Dynamics module loaded (today) the fallback breeze is used.

   TICKERS (8 total, independent of emitter count)
     fx-smoke  fx-water  fx-fireflies  fx-fall  fx-motes  fx-ring
     fx-glow (always:true)  fx-birds
   MATERIALS: 7 shared PointsMaterials + 6 pooled ripple materials
     + 1 per lamp/spill colour + 2 halo sprite materials per waterfall.
   ---- end probe results ---- */
