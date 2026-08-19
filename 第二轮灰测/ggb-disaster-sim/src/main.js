import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { SimClock } from './core/Clock.js';
import { CinematicCamera } from './core/CinematicCamera.js';
import { PhysicsWorld } from './core/PhysicsWorld.js';
import { SkySystem } from './world/Sky.js';
import { Ocean } from './world/Ocean.js';
import { Terrain } from './world/Terrain.js';
import { Bridge } from './world/Bridge.js';
import { ParticleManager } from './vfx/ParticleSystem.js';
import { CameraShake } from './vfx/CameraShake.js';
import { DisasterDirector } from './disasters/DisasterDirector.js';
import { Controls } from './ui/Controls.js';
import { TIME_PRESETS, WORLD } from './config.js';

/**
 * main.js — composition root and the master loop.
 *
 * FRAME ORDER IS A DESIGN DECISION, NOT AN ACCIDENT
 * -------------------------------------------------
 *   1 clock        one source of dt for the whole frame
 *   2 director     disasters inject impulses / release chunks
 *   3 physics      fixed-step solve, then push transforms into the batches
 *   4 bridge       cable Verlet + a single texture upload per batch
 *   5 environment  sky → ocean (ocean reads sky state, so sky goes first)
 *   6 particles    advance uTime only
 *   7 shake        consumes REAL dt so the operator never enters slow motion
 *   8 camera       damping + focus glide, then the render-only shake offset
 *   9 postfx state sun projection needs the camera's FINAL matrices
 *  10 render
 *
 * Anything reading camera matrices must come after 8; anything that consumes
 * physics results must come after 3. Swapping 5 and 6 desynchronises the ocean's
 * reflections from the sky by one frame.
 */

const canvas = document.getElementById('viewport');
const statusEl = document.getElementById('boot-status');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

async function boot() {
  setStatus('初始化渲染器 / initialising renderer…');
  const engine = new Engine(canvas);
  const clock = new SimClock();

  setStatus('加载物理引擎 (Rapier3D Wasm)…');
  const physics = await PhysicsWorld.create();

  setStatus('构建场景 / building scene…');
  const sky = new SkySystem(engine.scene);
  const ocean = new Ocean(engine.scene);
  const terrain = new Terrain(engine.scene);

  setStatus('预碎裂金门大桥 / pre-fracturing the bridge…');
  const bridge = new Bridge(engine.scene, physics);

  const particles = new ParticleManager(engine.scene);
  const shake = new CameraShake();
  const cam = new CinematicCamera(engine.camera, engine.domElement);
  cam.attachMarker(engine.scene);

  // ---- physics → VFX wiring -------------------------------------------
  physics.onWaterImpact = (pos, speed) => {
    particles.waterImpact(pos, speed);
    if (speed > 22) shake.addAt(0.22, pos, engine.camera.position, 1200);
  };
  physics.onHardImpact = (pos, speed) => {
    particles.debrisImpact(pos, speed);
    if (speed > 26) shake.addAt(0.14, pos, engine.camera.position, 900);
  };

  const ctx = {
    scene: engine.scene,
    camera: engine.camera,
    bridge, ocean, physics, particles, shake,
    postfx: engine.postfx,
    sky, clock,
  };
  const director = new DisasterDirector(ctx);

  // ---- picking: click to focus, shift-click to strike ------------------
  const pickables = [...bridge.pickables, ocean.mesh, terrain.group];
  cam.enablePicking(engine.domElement, pickables, null);
  engine.domElement.addEventListener('pointerup', (ev) => {
    if (!ev.shiftKey) return;
    const rect = engine.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, engine.camera);
    const hits = ray.intersectObjects(pickables, true);
    if (hits.length) director.strikeAt(hits[0].point, 1.15);
  });

  // ---- snapshots -------------------------------------------------------
  const snapshot = (slot) => {
    // Render, then read the framebuffer synchronously in the same task so the
    // capture is valid without preserveDrawingBuffer.
    engine.render(0, clock.realDt || 1 / 60);
    let url = null;
    try { url = canvas.toDataURL('image/jpeg', 0.82); } catch { url = null; }
    return clock.saveSnapshot(slot, { url, camera: cam.getState() });
  };

  const ui = new Controls({
    director, clock, sky, cam, engine, physics, bridge, ocean,
    onSnapshot: snapshot,
    onRestoreCamera: (state) => cam.setState(state),
  });

  sky.setTimeOfDay(TIME_PRESETS.goldenHour);
  ocean.syncSky(sky);

  const wind = new THREE.Vector3();

  setStatus('');
  if (statusEl) statusEl.remove();

  // ------------------------------------------------------------------ loop
  function frame() {
    const dt = clock.tick();
    const realDt = clock.realDt;

    director.update(dt);
    physics.update(dt);
    bridge.update(dt);

    sky.update(dt);
    ocean.syncSky(sky);
    ocean.update(dt, engine.camera);

    // Storm drives smoke drift and cable flutter.
    wind.set(4 + sky.storm * 34, 0, sky.storm * 12);
    bridge.cables.wind.set(wind.x * 0.06, 0, wind.z * 0.06);
    particles.update(dt, sky.sunDir, wind);

    shake.update(realDt, engine.camera);
    cam.applyShake(shake.offset, shake.roll);
    cam.update(realDt);

    engine.camera.updateMatrixWorld();
    engine.postfx.setFrameState({
      sunDir: sky.sunDir,
      rayTint: sky.rayTint,
      rayStrength: sky.rayStrength,
      motionBlur: shake.motionBlur,
      aberration: shake.aberration,
    });

    engine.render(dt, realDt);
    ui.update(realDt);
    requestAnimationFrame(frame);
  }

  // Expose for console tinkering / automated smoke tests.
  window.GGB = {
    engine, clock, physics, bridge, ocean, sky, terrain,
    particles, shake, cam, director, ui,
    ready: true,
    stats: () => ({ ...engine.stats, ...physics.stats }),
  };

  requestAnimationFrame(frame);
  console.info('[GGB] ready ·',
    `${physics.bodies.length} fracture bodies ·`,
    `${bridge.batches.length} batches ·`,
    `WebGPU available: ${engine.capabilities.webgpu}`);
}

boot().catch((err) => {
  console.error('[GGB] boot failed', err);
  setStatus(`启动失败 / boot failed: ${err && err.message ? err.message : err}`);
  window.GGB = { ready: false, error: String(err && err.stack ? err.stack : err) };
});

export { WORLD };
