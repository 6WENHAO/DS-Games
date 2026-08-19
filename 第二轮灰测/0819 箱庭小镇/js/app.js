/* =============================================================
   app.js — bootstrap, render loop, day/night clock and the UI.
   ============================================================= */
(function (global) {
  'use strict';
  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U, Geo = TOWN.Geo;

  const App = TOWN.App = {
    // simulated clock
    hours: 8.4,
    auto: true,
    speed: 0.55,          // simulated hours per real second
    dynamics: true,
    quality: 'high',
    shadows: true,
    fogOn: true,
    paused: false,
  };

  let renderer, scene, camera, orbit, clock;
  let stats = { fps: 0, frames: 0, acc: 0, drawCalls: 0, tris: 0 };
  const el = (id) => document.getElementById(id);

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */
  function boot() {
    const canvas = el('scene');
    const loading = el('loading');
    const setProgress = (p, label) => {
      const bar = el('loadbar');
      if (bar) bar.style.width = (p * 100).toFixed(0) + '%';
      const t = el('loadtext');
      if (t && label) t.textContent = label;
    };

    /* ---- renderer ---- */
    renderer = new T.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
    });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setSize(canvas.clientWidth || global.innerWidth, canvas.clientHeight || global.innerHeight, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.useLegacyLights = true;      // the sky module's intensities assume this
    renderer.info.autoReset = false;
    TOWN.Stage.renderer = renderer;

    /* ---- scene + camera ---- */
    scene = new T.Scene();
    TOWN.Stage.scene = scene;
    camera = new T.PerspectiveCamera(36, 1, 0.4, 4000);
    camera.position.set(88, 56, 96);
    TOWN.Stage.camera = camera;

    orbit = new TOWN.Orbit(camera, canvas, {
      target: new T.Vector3(0, 5.5, 0), minDist: 26, maxDist: 235,
      minPolar: 0.13, maxPolar: 1.45, damping: 0.14,
    });
    orbit.setFromCamera();
    TOWN.Stage.orbit = orbit;

    /* ---- build the world, yielding to the browser so the bar moves ---- */
    const steps = [
      ['天空与光照', () => TOWN.Sky.build({ scene: scene, renderer: renderer, islandRadius: 62 })],
      ['塑造岛屿地形', () => TOWN.Island.build(scene)],
      ['铺设街道与桥梁', () => TOWN.Roads.build(scene)],
      ['建造小镇', () => TOWN.Layout.build(scene, { merge: true })],
      ['整理与优化', () => finalise()],
    ];
    let i = 0;
    function step() {
      if (i >= steps.length) {
        setProgress(1, '完成');
        loading.classList.add('done');
        setTimeout(() => { loading.style.display = 'none'; }, 620);
        start();
        return;
      }
      const [label, fn] = steps[i];
      setProgress(i / steps.length, label);
      try { fn(); }
      catch (e) { console.error('[boot] ' + label + ' failed', e); }
      i++;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------
     Post-build tidy: orientation repair, shadow flags, stats
     ------------------------------------------------------------ */
  function finalise() {
    // scene-wide safety net for inverted solids
    const rep = Geo.repairOrientation(scene);
    if (rep.fixed) console.log('[TOWN] scene orientation repaired: ' + rep.fixed + '/' + rep.checked);

    // the sky dome and distant scenery must never cast or receive
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material && (o.material.isShaderMaterial || o.name === 'sea' || o.name === 'seaFar')) {
        o.castShadow = false;
      }
    });

    // Shadow-pass thinning: a 30 cm prop casts a shadow nobody can see, yet
    // it costs a full draw call in the depth pass and eats into the shadow
    // map's depth precision. Only masses above a threshold cast.
    const sph = new T.Sphere();
    let noCast = 0;
    scene.traverse((o) => {
      if (!o.isMesh || !o.castShadow) return;
      const g = o.geometry;
      if (!g || !g.attributes.position) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (!g.boundingSphere) return;
      sph.copy(g.boundingSphere);
      const sc = o.getWorldScale(new T.Vector3());
      const r = sph.radius * Math.max(sc.x, sc.y, sc.z);
      if (r < 0.62 || o.isSprite) { o.castShadow = false; noCast++; }
    });
    TOWN.App.shadowThinned = noCast;

    // count what we ended up with
    let tris = 0, meshes = 0;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry;
      if (!g || !g.attributes.position) return;
      const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      tris += n * (o.isInstancedMesh ? o.count : 1);
    });
    stats.tris = Math.round(tris);
    stats.meshes = meshes;
    TOWN.App.sceneStats = { tris: stats.tris, meshes };
    console.log('[TOWN] scene: ' + meshes + ' meshes, ' + stats.tris.toLocaleString() + ' triangles');

    applyQuality(App.quality);
    TOWN.Sky.setHours(App.hours);
  }

  /* ------------------------------------------------------------
     Quality / toggles
     ------------------------------------------------------------ */
  function applyQuality(q) {
    App.quality = q;
    const sun = TOWN.Stage.sunLight;
    if (q === 'low') {
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
      if (TOWN.FX && TOWN.FX.setQuality) TOWN.FX.setQuality(0.35);
    } else if (q === 'mid') {
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.35));
      renderer.shadowMap.enabled = App.shadows;
      if (sun && sun.shadow) { sun.shadow.mapSize.set(1024, 1024); disposeShadow(sun); }
      if (TOWN.FX && TOWN.FX.setQuality) TOWN.FX.setQuality(0.7);
    } else {
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = App.shadows;
      if (sun && sun.shadow) { sun.shadow.mapSize.set(2048, 2048); disposeShadow(sun); }
      if (TOWN.FX && TOWN.FX.setQuality) TOWN.FX.setQuality(1);
    }
    onResize();
  }
  function disposeShadow(light) {
    if (light.shadow && light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
  }

  /* ------------------------------------------------------------
     Resize
     ------------------------------------------------------------ */
  function onResize() {
    const canvas = el('scene');
    const w = canvas.clientWidth || global.innerWidth;
    const h = canvas.clientHeight || global.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------
     Loop
     ------------------------------------------------------------ */
  function start() {
    clock = new T.Clock();
    bindUI();
    onResize();
    global.addEventListener('resize', onResize);
    renderer.setAnimationLoop(frame);
    App.ready = true;
  }

  function frame() {
    const dtRaw = clock.getDelta();
    const dt = Math.min(dtRaw, 0.06);
    const t = clock.elapsedTime;

    if (App.auto && !App.paused) {
      App.hours = U.mod(App.hours + App.speed * dt, 24);
      syncTimeUI();
    }

    TOWN.Env.dt = dt;
    TOWN.Env.elapsed = t;
    TOWN.Env.reduced = !App.dynamics;

    TOWN.Sky.setHours(App.hours);
    orbit.update(dt);
    TOWN.Ticker.update(dt, t, App.dynamics && !App.paused);

    renderer.info.reset();
    renderer.render(scene, camera);
    stats.drawCalls = renderer.info.render.calls;

    // fps readout
    stats.acc += dtRaw; stats.frames++;
    if (stats.acc >= 0.5) {
      stats.fps = stats.frames / stats.acc;
      stats.frames = 0; stats.acc = 0;
      const f = el('fps');
      if (f) f.textContent = stats.fps.toFixed(0) + ' fps · ' + stats.drawCalls + ' draws · ' +
        (stats.tris / 1000).toFixed(0) + 'k tris';
    }
  }

  /* ------------------------------------------------------------
     UI
     ------------------------------------------------------------ */
  const PRESET_VIEWS = {
    overview: { r: 132, theta: 0.85, phi: 0.90, t: [0, 5.5, 0] },
    harbour: { r: 62, theta: 0.34, phi: 1.10, t: [16, 3, 26] },
    square: { r: 46, theta: 1.30, phi: 1.05, t: [4, 5.5, -6] },
    terrace: { r: 62, theta: 2.35, phi: 1.02, t: [-30, 8, -2] },
    hill: { r: 58, theta: 2.05, phi: 0.86, t: [-34, 14, -17] },
    fair: { r: 52, theta: -0.55, phi: 1.05, t: [36, 4, -6] },
    lighthouse: { r: 46, theta: -0.25, phi: 1.12, t: [44, 6, 27] },
    windmill: { r: 48, theta: 3.05, phi: 0.95, t: [13, 11, -39] },
  };

  function timeLabel(h) {
    const hh = Math.floor(U.mod(h, 24));
    const mm = Math.floor((h - Math.floor(h)) * 60);
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    let name = '深夜';
    if (h >= 4.6 && h < 6.4) name = '黎明';
    else if (h >= 6.4 && h < 10) name = '清晨';
    else if (h >= 10 && h < 14.5) name = '正午';
    else if (h >= 14.5 && h < 17) name = '午后';
    else if (h >= 17 && h < 18.7) name = '黄金时刻';
    else if (h >= 18.7 && h < 19.8) name = '日落';
    else if (h >= 19.8 && h < 21.5) name = '暮色';
    else if (h >= 21.5 || h < 4.6) name = '夜晚';
    return pad(hh) + ':' + pad(mm) + '　' + name;
  }

  function syncTimeUI() {
    const s = el('time');
    if (s && document.activeElement !== s) s.value = App.hours.toFixed(2);
    const lab = el('timelabel');
    if (lab) lab.textContent = timeLabel(App.hours);
  }

  function bindUI() {
    // time slider
    const time = el('time');
    if (time) {
      time.addEventListener('input', () => {
        App.hours = parseFloat(time.value);
        App.auto = false;
        const b = el('btn-auto');
        if (b) b.classList.remove('on');
        syncTimeUI();
      });
    }
    // presets for time of day
    document.querySelectorAll('[data-hour]').forEach((b) => {
      b.addEventListener('click', () => {
        App.hours = parseFloat(b.dataset.hour);
        App.auto = false;
        const a = el('btn-auto');
        if (a) a.classList.remove('on');
        syncTimeUI();
      });
    });
    // camera presets
    document.querySelectorAll('[data-view]').forEach((b) => {
      b.addEventListener('click', () => {
        const v = PRESET_VIEWS[b.dataset.view];
        if (!v) return;
        orbit.set(v.r, v.theta, v.phi, new T.Vector3(v.t[0], v.t[1], v.t[2]), 1500);
        document.querySelectorAll('[data-view]').forEach((o) => o.classList.remove('on'));
        b.classList.add('on');
      });
    });

    const toggle = (id, get, set) => {
      const b = el(id);
      if (!b) return;
      if (get()) b.classList.add('on');
      b.addEventListener('click', () => {
        set(!get());
        b.classList.toggle('on', get());
      });
    };
    toggle('btn-auto', () => App.auto, (v) => { App.auto = v; });
    toggle('btn-dyn', () => App.dynamics, (v) => { App.dynamics = v; TOWN.Env.reduced = !v; });
    toggle('btn-spin', () => orbit.autoRotate, (v) => { orbit.autoRotate = v; });
    toggle('btn-shadow', () => App.shadows, (v) => {
      App.shadows = v;
      renderer.shadowMap.enabled = v && App.quality !== 'low';
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    });
    toggle('btn-fog', () => App.fogOn, (v) => {
      App.fogOn = v;
      if (v) { if (TOWN.Sky.savedFog) scene.fog = TOWN.Sky.savedFog; }
      else { TOWN.Sky.savedFog = scene.fog; scene.fog = null; }
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    });

    // speed
    const sp = el('speed');
    if (sp) sp.addEventListener('input', () => {
      App.speed = parseFloat(sp.value);
      const l = el('speedlabel');
      if (l) l.textContent = App.speed.toFixed(2) + '×';
    });

    // quality
    document.querySelectorAll('[data-quality]').forEach((b) => {
      b.addEventListener('click', () => {
        applyQuality(b.dataset.quality);
        document.querySelectorAll('[data-quality]').forEach((o) => o.classList.remove('on'));
        b.classList.add('on');
      });
    });

    // screenshot
    const shot = el('btn-shot');
    if (shot) shot.addEventListener('click', () => {
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diorama-town-' + timeLabel(App.hours).slice(0, 5).replace(':', '') + '.png';
      a.click();
    });

    // panel collapse
    const collapse = el('btn-collapse');
    if (collapse) collapse.addEventListener('click', () => {
      document.body.classList.toggle('panel-hidden');
      collapse.textContent = document.body.classList.contains('panel-hidden') ? '‹' : '›';
    });

    // keyboard
    global.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      switch (e.key) {
        case ' ': App.paused = !App.paused; e.preventDefault(); break;
        case 'a': case 'A': App.auto = !App.auto; el('btn-auto').classList.toggle('on', App.auto); break;
        case 'r': case 'R': orbit.autoRotate = !orbit.autoRotate; el('btn-spin').classList.toggle('on', orbit.autoRotate); break;
        case 'd': case 'D': App.dynamics = !App.dynamics; el('btn-dyn').classList.toggle('on', App.dynamics); break;
        case 'h': case 'H': document.body.classList.toggle('panel-hidden'); break;
        case '1': setHour(6.4); break;
        case '2': setHour(12.5); break;
        case '3': setHour(17.8); break;
        case '4': setHour(18.9); break;
        case '5': setHour(22.0); break;
        case 'ArrowLeft': setHour(App.hours - 0.25); break;
        case 'ArrowRight': setHour(App.hours + 0.25); break;
      }
    });
    function setHour(h) {
      App.hours = U.mod(h, 24);
      App.auto = false;
      el('btn-auto').classList.remove('on');
      syncTimeUI();
    }

    syncTimeUI();
    const l = el('speedlabel');
    if (l) l.textContent = App.speed.toFixed(2) + '×';
    document.querySelector('[data-quality="high"]').classList.add('on');
    document.querySelector('[data-view="overview"]').classList.add('on');
  }

  /* ------------------------------------------------------------
     public helpers used by the verification harness
     ------------------------------------------------------------ */
  App.setHours = function (h) { App.hours = U.mod(h, 24); App.auto = false; TOWN.Sky.setHours(App.hours); syncTimeUI(); };
  App.setView = function (name, ms) {
    const v = PRESET_VIEWS[name];
    if (!v) return false;
    orbit.set(v.r, v.theta, v.phi, new T.Vector3(v.t[0], v.t[1], v.t[2]), ms === undefined ? 0 : ms);
    return true;
  };
  App.renderNow = function () { orbit.update(0.016); renderer.render(scene, camera); };
  /**
   * grab() — render into an offscreen target and read it back.
   * Reading the multisampled default framebuffer gives unreliable values on
   * some drivers, so the measurement path uses its own single-sample target.
   */
  let grabRT = null;
  App.grab = function () {
    const cw = renderer.domElement.width, ch = renderer.domElement.height;
    const w = Math.min(1280, cw), h = Math.round(w * ch / Math.max(1, cw));
    if (!grabRT || grabRT.width !== w || grabRT.height !== h) {
      if (grabRT) grabRT.dispose();
      grabRT = new T.WebGLRenderTarget(w, h, {
        type: T.UnsignedByteType, colorSpace: T.SRGBColorSpace,
        minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true,
      });
    }
    orbit.update(0.016);
    const prevRT = renderer.getRenderTarget();
    renderer.setRenderTarget(grabRT);
    renderer.render(scene, camera);
    const px = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(grabRT, 0, 0, w, h, px);
    renderer.setRenderTarget(prevRT);
    renderer.render(scene, camera);
    let sum = 0, sr = 0, sg = 0, sb = 0, n = 0, bright = 0, brightTop = 0;
    const uniq = new Set();
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += L; sr += r; sg += g; sb += b; n++;
        uniq.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
        if (L > 205) { bright++; if (y > h * 0.62) brightTop++; }   // readPixels is bottom-up
      }
    }
    return {
      w: w, h: h, samples: n,
      meanLum: +(sum / n).toFixed(2),
      meanR: +(sr / n).toFixed(2), meanG: +(sg / n).toFixed(2), meanB: +(sb / n).toFixed(2),
      warmth: +((sr - sb) / n).toFixed(2),
      colors: uniq.size,
      brightFrac: +(bright / n).toFixed(5),
      brightSkyFrac: +(brightTop / n).toFixed(5),
      drawCalls: stats.drawCalls, tris: stats.tris,
    };
  };
  App.stats = () => ({ fps: stats.fps, drawCalls: stats.drawCalls, tris: stats.tris, meshes: stats.meshes });

  /* ------------------------------------------------------------ */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
