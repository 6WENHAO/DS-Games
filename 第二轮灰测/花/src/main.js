// Petal Drift — bootstrap and frame loop.

import * as THREE from 'three';
import { WORLD, QUALITY, GRASS_BUDGET } from './config.js';
import { makeNoiseTexture, terrainHeight } from './noise.js';
import { U } from './uniforms.js';
import { Terrain } from './terrain.js';
import { Grass } from './grass.js';
import { Flowers } from './flowers.js';
import { Petals } from './petals.js';
import { Rain, Motes } from './particles.js';
import { Sky } from './sky.js';
import { CloudShadow } from './cloudshadow.js';
import { LifeMap } from './lifemap.js';
import { Weather, PRESETS } from './weather.js';
import { PostFX } from './postfx.js';
import { FollowCam } from './camera.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { blit, fsMaterial } from './fsq.js';

const diag = window.__diag || (window.__diag = { errors: [], shaderErrors: [], notes: [] });

function installShaderDiagnostics(renderer) {
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, glVertex, glFragment) => {
    const parts = [];
    const plog = gl.getProgramInfoLog(program);
    if (plog) parts.push('program: ' + plog.trim());
    for (const [name, sh] of [['vertex', glVertex], ['fragment', glFragment]]) {
      const log = gl.getShaderInfoLog(sh);
      if (!log || !log.trim()) continue;
      parts.push(`${name}: ${log.trim()}`);
      const src = (gl.getShaderSource(sh) || '').split('\n');
      const seen = new Set();
      for (const m of log.matchAll(/(?:\d+):(\d+)/g)) {
        const line = Number(m[1]);
        if (!line || seen.has(line)) continue;
        seen.add(line);
        for (let i = Math.max(1, line - 2); i <= Math.min(src.length, line + 2); i++) {
          parts.push(`  ${i === line ? '>' : ' '} ${i}| ${src[i - 1]}`);
        }
      }
    }
    const msg = parts.join('\n');
    diag.shaderErrors.push(msg);
    window.__showErr?.('[glsl]\n' + msg);
  };
}

export async function boot() {
  const host = document.getElementById('app');

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  if (!renderer.capabilities.isWebGL2) {
    throw new Error('需要 WebGL2 支持 / WebGL2 is required');
  }
  installShaderDiagnostics(renderer);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.NoToneMapping;      // graded by our own final pass
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.sortObjects = true;
  host.appendChild(renderer.domElement);

  try {
    const dbg = renderer.getContext().getExtension('WEBGL_debug_renderer_info');
    if (dbg) diag.gpu = renderer.getContext().getParameter(dbg.UNMASKED_RENDERER_WEBGL);
  } catch (e) { /* ignore */ }

  // ---------------------------------------------------------------- settings
  const settings = UI.load();
  const params = new URLSearchParams(location.search);
  const selftest = params.has('selftest');
  if (selftest) {
    settings.quality = 'low';
    settings.resScale = 0.5;
    settings.adaptive = false;
    settings.grain = 0.5;
  }
  if (params.has('q') && QUALITY[params.get('q')]) {
    settings.quality = params.get('q');
    const qq = QUALITY[settings.quality];
    settings.resScale = qq.resScale;
    settings.grassDensity = qq.grass;
    settings.cloudSteps = qq.cloudSteps;
  }
  if (params.has('res')) settings.resScale = Math.max(0.25, Math.min(2, Number(params.get('res')) || 1));
  if (params.has('grass')) settings.grassDensity = Math.max(0.05, Math.min(2, Number(params.get('grass')) || 1));
  if (params.has('steps')) settings.cloudSteps = Math.max(8, Math.min(96, Number(params.get('steps')) || 32));
  const startWeather = params.get('w') && PRESETS.some((p) => p.key === params.get('w')) ? params.get('w') : 'dawn';
  const q0 = QUALITY[settings.quality] || QUALITY.high;

  U.uNoiseTex.value = makeNoiseTexture(20240521);

  // ---------------------------------------------------------------- systems
  const scene = new THREE.Scene();
  const terrain = new Terrain(selftest ? 160 : q0.terrainGrid, WORLD.terrainRadius);
  const grass = new Grass(settings.grassDensity ?? q0.grass);
  const flowers = new Flowers(q0.flowers);
  const petals = new Petals(320);
  const rain = new Rain(q0.rain);
  const motes = new Motes(q0.motes, 130);

  scene.add(terrain.mesh, grass.group, flowers.mesh, petals.mesh, rain.mesh, motes.points);

  const sky = new Sky(Math.round(settings.cloudSteps ?? q0.cloudSteps), q0.cloudLightSteps, q0.cloudScale);
  const cloudShadow = new CloudShadow(selftest ? 256 : 1024, 1900);
  const lifeMap = new LifeMap(renderer, selftest ? 512 : WORLD.lifeRes, WORLD.lifeSize);
  const weather = new Weather(startWeather);
  const postfx = new PostFX(renderer, q0);
  const cam = new FollowCam(window.innerWidth / Math.max(1, window.innerHeight));
  const input = new Input(renderer.domElement);

  petals.setCount(settings.petals);
  weather.auto = !!settings.autoWeather;
  weather.windScale = settings.wind;
  cam.free = !!settings.freeCam;

  // ---------------------------------------------------------------------- UI
  const ui = new UI(settings, {
    onWeather: (key) => { weather.goTo(key, 6); weather.timer = 0; },
    onQuality: (key) => applyQuality(key),
    onClear: () => { flowers.clear(); lifeMap.clear(renderer); },
    onSetting: (key, v) => {
      if (key === 'grassDensity') grass.setDensity(v);
      if (key === 'petals') petals.setCount(v);
      if (key === 'cloudSteps') sky.setSteps(Math.round(v), sky.lsteps);
      if (key === 'autoWeather') weather.auto = !!v;
      if (key === 'wind') weather.windScale = v;
      if (key === 'freeCam') cam.free = !!v;
      if (key === 'resScale') resize(true);
    },
  });
  ui.setWeatherActive(weather.to.key);

  function applyQuality(key) {
    const q = QUALITY[key] || QUALITY.high;
    settings.resScale = q.resScale;
    settings.grassDensity = q.grass;
    settings.cloudSteps = q.cloudSteps;
    terrain.setGrid(q.terrainGrid);
    grass.setDensity(q.grass);
    sky.setSteps(q.cloudSteps, q.cloudLightSteps, q.cloudScale);
    postfx.setQuality(q);
    dyn.scale = 1;
    resize(true);
  }

  // ------------------------------------------------------------------ resize
  let vw = 0, vh = 0;
  const dyn = { scale: 1, avg: 16, samples: 0 };

  function resize(force) {
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    const scale = Math.min(2, Math.max(0.4, (settings.resScale || 1) * dyn.scale));
    if (!force && w === vw && h === vh && Math.abs(renderer.getPixelRatio() - scale) < 1e-3) return;
    vw = w; vh = h;
    renderer.setPixelRatio(scale);
    renderer.setSize(w, h, false);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    postfx.setSize(size.x, size.y);
    sky.setSize(size.x, size.y);
    cam.setAspect(w / h);
  }
  window.addEventListener('resize', () => resize(false));
  resize(true);

  // -------------------------------------------------------------- interaction
  let interacted = false;
  input.onKey = (k) => {
    interacted = true;
    const idx = '1234567'.indexOf(k);
    if (idx >= 0 && idx < PRESETS.length) {
      weather.goTo(PRESETS[idx].key, 5);
      weather.auto = false;
      settings.autoWeather = false;
      ui.syncToggles();
      ui.setWeatherActive(PRESETS[idx].key);
      ui.save();
      return;
    }
    if (k === 'h') ui.togglePanel();
    if (k === 'c') { settings.cinematicBars = !settings.cinematicBars; ui.applyBars(); ui.syncToggles(); ui.save(); }
    if (k === 'f') { settings.freeCam = !settings.freeCam; cam.free = settings.freeCam; ui.syncToggles(); ui.save(); }
    if (k === 'r') { flowers.clear(); lifeMap.clear(renderer); }
    if (k === 'n') { weather.next(); ui.setWeatherActive(weather.to.key); }
    if (k === 'p') paused = !paused;
  };
  renderer.domElement.addEventListener('pointerdown', () => { interacted = true; });

  // ------------------------------------------------------------- frame state
  const windVec = new THREE.Vector2();
  const moveDir = new THREE.Vector3();
  const camFwd = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  let time = 12.0;
  let camLocked = false;
  let plantAcc = 0;
  let paused = false;
  let frames = 0;
  let fpsTimer = 0, fpsCount = 0, fps = 60;
  let last = performance.now();

  document.addEventListener('visibilitychange', () => { last = performance.now(); });

  function plantTrail(dt) {
    const g = petals.guide;
    const spread = settings.spread;
    const hue = (0.5 + 0.5 * Math.sin(time * 0.043)) * 0.85 + Math.random() * 0.15;

    // paint the life field along the swarm's path (and a little around it)
    const move = Math.min(1, petals.speed / 7);
    lifeMap.splat(g.x, g.z, spread * 1.9, 0.030 * (0.55 + 0.45 * move), 0.020, hue);
    for (let i = 0; i < 3; i++) {
      const it = petals.items[(Math.random() * petals.count) | 0];
      lifeMap.splat(it.pos.x, it.pos.z, spread * 1.15, 0.016, 0.013, hue);
    }

    // grow flowers
    plantAcc += dt * (16 + 30 * move);
    let tries = 0;
    while (plantAcc >= 1 && tries < 40) {
      plantAcc -= 1; tries++;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread * 1.5;
      const x = g.x + Math.cos(a) * r;
      const z = g.z + Math.sin(a) * r;
      flowers.plant(x, z, time, Math.min(0.999, Math.max(0, hue + (Math.random() - 0.5) * 0.35)));
    }
  }

  function step(dt) {
    // fps tracking + adaptive resolution
    fpsCount++; fpsTimer += dt;
    if (fpsTimer >= 0.5) { fps = fpsCount / fpsTimer; fpsCount = 0; fpsTimer = 0; }
    dyn.avg = dyn.avg * 0.9 + dt * 1000 * 0.1;
    if (settings.adaptive) {
      dyn.samples++;
      if (dyn.samples > 90) {
        dyn.samples = 0;
        const before = dyn.scale;
        if (dyn.avg > 27 && dyn.scale > 0.62) dyn.scale = Math.max(0.62, dyn.scale - 0.08);
        else if (dyn.avg < 13.5 && dyn.scale < 1) dyn.scale = Math.min(1, dyn.scale + 0.05);
        if (before !== dyn.scale) resize(true);
      }
    }

    time += dt;
    U.uTime.value = time;

    input.update(dt);
    weather.update(dt, time);

    windVec.set(U.uWindDir.value.x, U.uWindDir.value.y)
      .multiplyScalar(1.2 + U.uWindStrength.value * 5.5);

    // steering in camera space
    const ax = input.axes();
    cam.camera.getWorldDirection(camFwd);
    camFwd.y = 0;
    if (camFwd.lengthSq() < 1e-5) camFwd.set(0, 0, -1);
    camFwd.normalize();
    camRight.set(camFwd.z, 0, -camFwd.x);
    moveDir.set(0, 0, 0)
      .addScaledVector(camFwd, ax.y)
      .addScaledVector(camRight, ax.x);
    if (moveDir.lengthSq() > 1) moveDir.normalize();
    petals.steer(moveDir, input.boost, input.lift);
    petals.update(dt, time, windVec);
    plantTrail(dt);
    flowers.flush();

    if (!camLocked) cam.update(dt, input, petals, windVec);
    const camera = cam.camera;

    U.uCamPos.value.copy(camera.position);
    U.uCamXZ.value.set(camera.position.x, camera.position.z);
    camera.getWorldDirection(tmp);
    U.uCamFwd.value.copy(tmp);

    terrain.update(camera.position);
    cloudShadow.update(renderer, camera.position);
    lifeMap.update(renderer, petals.guide.x, petals.guide.z);
    rain.update();
    motes.update(renderer.getPixelRatio(), weather.num.motes * (1 - 0.6 * weather.num.rain));

    const skyTex = sky.render(renderer, camera);

    const rt = postfx.beginScene(camera);
    renderer.setRenderTarget(rt);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    const wn = weather.num;
    postfx.render(skyTex, camera, {
      fog: settings.fog,
      godray: settings.godrays ? (0.32 + 0.45 * wn.sunGlow * 0.35) : 0,
      focus: cam.focus,
      aperture: cam.aperture * settings.dof,
      maxCoC: 16 * Math.min(1.6, settings.resScale * dyn.scale + 0.3),
      exposure: wn.exposure * settings.exposure,
      bloom: 0.5 * wn.bloom * settings.bloom,
      bloomThreshold: 0.85,
      saturation: wn.sat * settings.saturation,
      contrast: 1.05,
      vignette: 0.5,
      grain: settings.grain,
      ca: 1.0,
      lift: wn.lift,
    });

    frames++;
    diag.frames = frames;
    if (frames === 3) {
      diag.ok = diag.shaderErrors.length === 0 && diag.errors.length === 0;
      ui.bootDone();
    }

    ui.update(dt, interacted);
    ui.setWeather(weather.name, weather.sub);
    ui.setFlowers(flowers.total);
    if (frames % 15 === 0) {
      ui.setStats(
        `${fps.toFixed(0)} fps · ${(dyn.avg).toFixed(1)} ms<br>` +
        `草叶 ${(grass.count / 1000).toFixed(0)}k · 花 ${flowers.total}<br>` +
        `绘制 ${renderer.info.render.calls} · 三角 ${(renderer.info.render.triangles / 1000).toFixed(0)}k<br>` +
        `渲染倍率 ${(renderer.getPixelRatio()).toFixed(2)} · 云步进 ${sky.steps}<br>` +
        `风 ${U.uWindStrength.value.toFixed(2)} · 花瓣 ${petals.count}`,
      );
    }
  }

  let auto = true;
  let rafId = 0;

  function loop() {
    rafId = requestAnimationFrame(loop);
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 1 / 60;
    if (paused) return;
    step(Math.min(dt, 1 / 15));
  }

  // debug: paint an offscreen target straight onto the canvas and hand back a PNG
  const debugCopy = fsMaterial(`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform float uScale;
    void main(){
      vec4 c = texture2D(uTex, vUv) * uScale;
      gl_FragColor = vec4(pow(clamp(c.rgb, 0.0, 1.0), vec3(0.4545)), 1.0);
    }`, { uTex: { value: null }, uScale: { value: 1 } });

  // expose for debugging / headless checks
  window.__game = {
    renderer, scene, cam, petals, grass, flowers, weather, sky, postfx, lifeMap, cloudShadow, terrain, rain, motes, input, ui, settings,
    THREE, U, terrainHeight,
    snapshot() {
      return {
        frames, fps, ms: dyn.avg, flowers: flowers.total, grass: grass.count,
        calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
        weather: weather.to.key, blend: weather.blend,
        camera: cam.camera.position.toArray().map((v) => +v.toFixed(2)),
        guide: petals.guide.toArray().map((v) => +v.toFixed(2)),
        pixelRatio: renderer.getPixelRatio(),
      };
    },
    setWeather(key) { weather.goTo(key, 0.001); weather.auto = false; },
    lockCamera(v) { camLocked = !!v; },
    debugRT(which = 'shadow', scale = 1) {
      const tex = which === 'shadow' ? cloudShadow.rt.texture
        : which === 'sky' ? sky.rt.texture
        : which === 'life' ? lifeMap.a.texture
        : which === 'scene' ? postfx.sceneRT.texture
        : which === 'bloom' ? postfx.bloomRTs[0].texture
        : which === 'comp' ? postfx.compRT.texture
        : which === 'dof' ? postfx.dofRT.texture
        : null;
      if (!tex) return 'unknown target: ' + which;
      debugCopy.uniforms.uTex.value = tex;
      debugCopy.uniforms.uScale.value = scale;
      blit(renderer, debugCopy, null, true);
      return renderer.domElement.toDataURL('image/png');
    },
    debugInfo() {
      return {
        shadowRT: [cloudShadow.rt.width, cloudShadow.rt.height],
        shadowCenter: U.uShadowCenter.value.toArray(),
        shadowSize: U.uShadowSize.value,
        shadowTexBound: U.uShadowMap.value === cloudShadow.rt.texture,
        cloudShadow: U.uCloudShadow.value,
        cloudAbsorb: U.uCloudAbsorb.value,
        cloudThresh: U.uCloudThresh.value,
        sunDir: U.uSunDir.value.toArray().map((v) => +v.toFixed(3)),
        renderCalls: renderer.info.render.calls,
      };
    },
    freezeWeather(v) { weather.frozen = !!v; },
    // deterministic stepping (headless verification: rAF is throttled without a compositor)
    setAuto(v) {
      auto = !!v;
      if (auto) { last = performance.now(); loop(); }
      else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    },
    // render one frame and hand back the canvas as a PNG data URL (same task, so the
    // drawing buffer is still intact even without preserveDrawingBuffer)
    capture(dt = 1 / 60) {
      step(Math.min(0.05, dt));
      return renderer.domElement.toDataURL('image/png');
    },
    // benchmark with a genuine GPU sync each frame (WebGL is otherwise async)
    bench(frames = 20, warm = 6) {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      const sync = () => {
        renderer.setRenderTarget(null);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      };
      for (let i = 0; i < warm; i++) { step(1 / 60); }
      sync();
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) { step(1 / 60); sync(); }
      return +((performance.now() - t0) / frames).toFixed(2);
    },
    tick(dt = 1 / 60, n = 1) {
      for (let i = 0; i < n; i++) step(Math.min(0.05, Math.max(0.001, dt)));
      return frames;
    },
  };

  // settle the camera behind the swarm so the very first frame is already composed
  {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    cam.smoothTarget.copy(petals.centroid);
    cam.lookAt.copy(petals.centroid);
    cam.pos.set(
      petals.centroid.x + Math.cos(cam.yaw) * cp * cam.dist,
      petals.centroid.y + sp * cam.dist,
      petals.centroid.z + Math.sin(cam.yaw) * cp * cam.dist,
    );
    cam.camera.position.copy(cam.pos);
    cam.camera.lookAt(cam.lookAt);
    cam.camera.updateMatrixWorld();
    U.uCamPos.value.copy(cam.pos);
    U.uCamXZ.value.set(cam.pos.x, cam.pos.z);
  }

  diag.notes.push('systems ready');
  if (!params.has('manual')) loop();
  else auto = false;
  return window.__game;
}
