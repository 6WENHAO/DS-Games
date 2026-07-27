import * as THREE from 'three';
import { World } from './world.js';
import { BloomWake } from './wake.js';
import { Terrain } from './terrain.js';
import { Grass } from './grass.js';
import { Sky, LongOne, Motes } from './sky.js';
import { ChimeStones, CallRing } from './response.js';
import { Input, Player, FollowCamera } from './player.js';
import { Avatar } from './avatar.js';
import { Audio } from './audio.js';
import { makeSkyUniforms } from './shading.js';
import { createPost } from './post.js';
import { Perf } from './perf.js';
import { makeBench } from './bench.js';

// ---------------------------------------------------------------------------
// CLOUDROAD — week 1-3 technical risk slice.
// Grass + terrain streaming + controller + glide + the bloom-wake splat.
// Ship-or-redesign gate: 60 fps at target budgets, before any art is made.
// ---------------------------------------------------------------------------

const canvas = document.getElementById('view');
// dev harness (?dev=1): skips the gate, keeps the loop alive while the tab is
// backgrounded, and preserves the drawing buffer so the slice can be driven
// and captured headlessly
const DEV = new URLSearchParams(location.search).has('dev');

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, powerPreference: 'high-performance', stencil: false,
  preserveDrawingBuffer: DEV,
});
// composer.render() runs several internal renderer.render() calls; let it
// accumulate so the HUD reports the whole frame, not just the last pass
renderer.info.autoReset = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;   // we do our own illustrated grade
renderer.setClearColor(0xe9f2f5, 1);

// --- quality tier: a renderer-string heuristic, corrected later by the
// --- live 3-second benchmark that drives dynamic resolution
function detectQuality() {
  const gl = renderer.getContext();
  let name = '';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
  const mobile = /iphone|ipad|android/i.test(navigator.userAgent);
  const weak = /intel|uhd|iris|mali|adreno|powervr|swiftshader/i.test(name);
  // pixel ratio is capped at 1.25, not 1.75: measured on an M1, the extra
  // 2 megapixels cost ~3 ms and buy almost nothing once bloom, the paper grain
  // and SMAA have softened the image. Resolution is the cheapest thing to give
  // back, so we start already having given it back.
  if (mobile) return { name: 'low', grass: 0.35, motes: 900, aa: 0, pr: 1.0, chimes: 90 };
  if (weak) return { name: 'medium', grass: 0.65, motes: 1800, aa: 1, pr: 1.0, chimes: 120 };
  return { name: 'high', grass: 1.0, motes: 2600, aa: 1, pr: Math.min(devicePixelRatio, 1.25), chimes: 150 };
}
const quality = detectQuality();
// overrides for measuring the tier matrix: ?aa=0|1|2 &pr=1.25 &grass=0.5
{
  const q = new URLSearchParams(location.search);
  if (q.has('aa')) quality.aa = +q.get('aa');
  if (q.has('pr')) quality.pr = +q.get('pr');
  if (q.has('grass')) quality.grass = +q.get('grass');
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.35, 5200);

const sky = makeSkyUniforms();
const world = new World();
const wake = new BloomWake(renderer);
const terrain = new Terrain(world, wake, sky);
const grass = new Grass(world, wake, sky, quality.grass);
const skyBox = new Sky(sky);
const longOne = new LongOne(sky);
const motes = new Motes(sky, quality.motes);
const audio = new Audio();
const chimes = new ChimeStones(world, sky, audio, quality.chimes);
const callRing = new CallRing(sky, world);
callRing.material.uniforms.uHeight.value = world.texture;
const avatar = new Avatar(sky);

scene.add(skyBox.group, terrain.group, grass.group, chimes.mesh,
  callRing.mesh, avatar.group, longOne.mesh, motes.points);

const input = new Input(canvas);
const player = new Player(world, input);
const follow = new FollowCamera(camera, input);

const { composer, grade } = createPost(renderer, scene, camera, quality);
const perf = new Perf(renderer, composer, quality.pr);

// --- the Call: one button, and it is the whole interaction system ----------
let callPulse = 0;
player.onCall = (pos) => {
  callRing.fire(pos);
  chimes.onCall(pos, 26);
  audio.call();
  callPulse = 1;
};

// ---------------------------------------------------------------------------
const frustum = new THREE.Frustum();
const projScreen = new THREE.Matrix4();
let lastWakeX = 0, lastWakeZ = 0;

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  perf.applyScale();
}
addEventListener('resize', resize);

// --- shader pre-warm: WebGL compiles lazily on first draw, and a 200 ms stall
// --- the first time the player sees something new is worse than 3 s on the
// --- title screen. Non-negotiable.
function prewarm() {
  const rt = new THREE.WebGLRenderTarget(4, 4);
  renderer.setRenderTarget(rt);
  camera.position.set(0, world.heightAt(0, 0) + 6, 12);
  camera.lookAt(0, world.heightAt(0, 0), 0);
  projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreen);
  terrain.update(player.pos, frustum);
  grass.update(player.pos, frustum);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  rt.dispose();
}

let running = false;
let last = performance.now();
const FIXED = 1 / 60;
let acc = 0;

function schedule() {
  if (DEV && document.hidden) setTimeout(() => loop(performance.now()), 16);
  else requestAnimationFrame(loop);
}

function step(dt) {
  player.update(dt);
  follow.update(dt, player, world);
  avatar.update(dt, player);
  chimes.update(dt);
  callRing.update(dt);
  longOne.update(dt, camera.position);
}

function loop(now) {
  schedule();
  if (!running) return;

  const dtMs = Math.min(now - last, 66);
  last = now;
  const dt = dtMs / 1000;

  // fixed-step sim, decoupled from render
  acc += dt;
  let guard = 0;
  while (acc >= FIXED && guard++ < 4) { step(FIXED); acc -= FIXED; }

  sky.uTime.value += dt;
  sky.uPlayer.value.copy(player.pos);
  sky.uWindGust.value = 0.62 + 0.38 * Math.sin(sky.uTime.value * 0.17);

  // --- bloom wake ---------------------------------------------------------
  wake.update(dt);
  wake.recentre(player.pos.x, player.pos.z);
  const moved = Math.hypot(player.pos.x - lastWakeX, player.pos.z - lastWakeZ);
  if (player.grounded && moved > 0.30) {
    // stamp along the path so fast movement never leaves gaps
    const steps = Math.min(6, Math.ceil(moved / 0.35));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      wake.splat(
        lastWakeX + (player.pos.x - lastWakeX) * t,
        lastWakeZ + (player.pos.z - lastWakeZ) * t,
        1.7, 0.24, 0);
    }
    lastWakeX = player.pos.x; lastWakeZ = player.pos.z;
  } else if (!player.grounded) {
    lastWakeX = player.pos.x; lastWakeZ = player.pos.z;
  }
  if (callPulse > 0) {
    // the Call blooms a field: a wave that opens outward over ~0.9 s
    const age = Math.min(player.callAge, 0.95);
    wake.splat(player.pos.x, player.pos.z, 3.0 + age * 13.0, 0.30 * (1 - age), 1);
    if (player.callAge > 0.95) callPulse = 0;
  }

  // --- streaming + culling ------------------------------------------------
  camera.updateMatrixWorld();
  projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreen);
  terrain.update(player.pos, frustum);
  grass.update(player.pos, frustum);
  skyBox.update(camera.position);
  motes.update(camera.position, renderer.getPixelRatio());
  audio.setWind(Math.min(1, player.moveSpeed / 14 + (player.gliding ? 0.4 : 0)));
  grade.uniforms.get('uTime').value = sky.uTime.value;

  renderer.info.reset();
  composer.render(dt);

  perf.frame(dtMs, {
    blades: grass.bladeCount,
    grassChunks: grass.drawCount,
    terrainChunks: terrain.visibleCount,
    heap: performance.memory
      ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB'
      : 'n/a',
  });
}

// --- title gate: one click satisfies the autoplay policy and hides the
// --- pre-warm compile stall behind a still frame
const gate = document.getElementById('gate');
const gateNote = document.getElementById('gate-note');
gateNote.textContent = `${quality.name} tier · warming shaders…`;

resize();
requestAnimationFrame(() => {
  prewarm();
  gateNote.textContent = `${quality.name} tier · click anywhere`;
  gate.classList.add('ready');
});

function begin(withAudio) {
  if (withAudio) audio.start();
  gate.classList.add('gone');
  setTimeout(() => gate.remove(), 1200);
  running = true;
  last = performance.now();
}

gate.addEventListener('click', () => {
  if (!gate.classList.contains('ready')) return;
  begin(true);
  canvas.requestPointerLock?.();
});

if (DEV) {
  const ctx = {
    player, input, camera, grass, terrain, perf, world, wake, chimes, begin,
    renderer, scene, composer, sky, quality,
  };
  ctx.bench = makeBench(ctx);
  window.__cloudroad = ctx;
  setTimeout(() => begin(false), 60);
}

schedule();
