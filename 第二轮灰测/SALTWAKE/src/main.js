/**
 * SALTWAKE — entry point.
 *
 * Boots the world, wires the systems together and runs a fixed-step simulation
 * with a decoupled render. The simulation runs at 60 Hz regardless of display
 * rate, because the Quake acceleration model and the stop-motion clocks both
 * assume a stable tick; the render pass then draws whatever the latest state is.
 *
 * Render order per frame:
 *   scene into the low-resolution target -> viewmodel on top with its own near
 *   projection -> composite pass with the whole retro chain -> DOM HUD above.
 */
import * as THREE from 'three';
import { TITLE, SUBTITLE, RENDER, PLAYER, WORLD, FOG } from './core/config.js';
import { shared, lights, updateShared, setRetro } from './core/env.js';
import { Stage } from './core/renderer.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { buildWorld } from './world/build.js';
import { CELL } from './world/grid.js';
import { LEVEL } from './world/levelData.js';
import { Player } from './game/player.js';
import { WeaponManager } from './game/weapons.js';
import { EnemyManager } from './game/enemies.js';
import { Fx } from './game/fx.js';
import { SanitySystem } from './game/sanity.js';
import { Director } from './game/director.js';
import { Hud } from './game/hud.js';

const TICK = 1 / 60;
const MAX_CATCHUP = 5;

const app = {
  running: false,
  time: 0,
  accumulator: 0,
  lastFrame: 0,
  fps: 0,
  fpsAccum: 0,
  fpsFrames: 0,
  // Starts paused: the pause card is up until the player takes the lamp, and the
  // town should not be simulating enemies behind it.
  paused: true,
};

const boot = document.getElementById('boot');
const bootStep = document.getElementById('boot-step');
const bootBar = document.getElementById('boot-bar');
const pauseCard = document.getElementById('pause');
const canvas = document.getElementById('view');
const hudRoot = document.getElementById('hud-root');

function step(text, progress) {
  if (bootStep) bootStep.textContent = text;
  if (bootBar) bootBar.style.width = `${Math.round(progress * 100)}%`;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

let stage;
let scene;
let world;
let player;
let weapons;
let enemies;
let fx;
let sanity;
let director;
let hud;
let audio;
let input;

async function main() {
  step('Reading the tide charts', 0.05);
  await nextFrame();

  stage = new Stage(canvas);
  scene = new THREE.Scene();
  scene.background = null;

  step('Raising the town', 0.15);
  await nextFrame();
  const t0 = performance.now();
  world = buildWorld(LEVEL);
  scene.add(world.mesh);
  const buildMs = performance.now() - t0;
  console.info(`[saltwake] level built: ${world.triangleCount} triangles, `
    + `${world.walkableCells} walkable cells, ${world.lights.length} lights, ${buildMs.toFixed(0)} ms`);

  step('Lighting the lamps', 0.45);
  await nextFrame();

  hud = new Hud(hudRoot);
  audio = new AudioEngine({ masterVolume: 0.85 });

  player = new Player(world, { audio, hud });
  const spawnCell = world.grid.get(LEVEL.spawn.col, LEVEL.spawn.row);
  const spawnPos = world.grid.centreOf(LEVEL.spawn.col, LEVEL.spawn.row);
  player.spawn(spawnPos.x, spawnCell ? spawnCell.floorY : 0, spawnPos.z, LEVEL.spawn.yaw || 0);

  enemies = new EnemyManager({ world, player, scene, audio, lights, fx: null });
  fx = new Fx({ scene, world, player, enemies, audio, lights });
  enemies.ctx.fx = fx;

  step('Filling the fog', 0.65);
  await nextFrame();
  const spriteCounts = fx.populate(world, LEVEL);
  console.info(`[saltwake] sprites: ${spriteCounts.sprites} static, ${spriteCounts.fires} emissive`);

  step('Waking the hauliers', 0.8);
  await nextFrame();
  enemies.populate(LEVEL, world);

  weapons = new WeaponManager({ player, world, enemies, fx, audio, hud, lights });
  sanity = new SanitySystem({ player, world, enemies, audio, hud, stage, scene });
  addRitualZones(sanity, world, LEVEL);

  director = new Director({
    world, level: LEVEL, player, weapons, enemies, fx, sanity, audio, hud, scene, stage, lights,
  });

  input = new Input(canvas);

  /**
   * Taking the lamp. The listener is on the document rather than the canvas
   * because the pause card covers the whole viewport at a higher stacking level,
   * so a click never reaches the canvas underneath it. It is also registered
   * here rather than at module scope, so it cannot fire before `input` exists.
   */
  const takeTheLamp = async (event) => {
    if (!boot.hidden && !boot.classList.contains('is-done')) return;
    if (input.locked) return;
    if (event) event.preventDefault();
    if (audio && !audio.ready) await audio.unlock();
    if (audio && audio.ready) audio.startMusic();
    input.requestLock();
  };
  document.addEventListener('click', takeTheLamp);
  document.addEventListener('keydown', (event) => {
    // Enter and Space also work, for anyone who reaches for the keyboard first.
    if (event.code === 'Enter' || event.code === 'Space') takeTheLamp(event);
  });

  input.onLockChange = (locked) => {
    app.paused = !locked;
    if (pauseCard) pauseCard.hidden = locked;
    if (audio && audio.ready) { if (locked) audio.resume(); else audio.suspend(); }
  };

  window.addEventListener('resize', onResize);
  onResize();

  hud.setHealth(player.health, PLAYER.maxHealth);
  hud.setArmor(player.armor, PLAYER.maxArmor);
  hud.setSanity(1);
  hud.setKeys([]);
  syncHud();
  hud.showTitleCard(TITLE, SUBTITLE, 5);

  step('Ready', 1);
  if (boot) {
    boot.classList.add('is-done');
    setTimeout(() => { boot.hidden = true; }, 400);
  }
  if (pauseCard) pauseCard.hidden = false;

  app.running = true;
  app.lastFrame = performance.now();
  requestAnimationFrame(frame);
}

/**
 * Sanity pressure by place. A level may declare 
itualZones explicitly;
 * otherwise the ritual districts are derived from the grid, so the altar, the
 * ruins and the rift all press on the player simply by being stood in.
 */
const DISTRICT_DRAIN = { altar: 1.6, ruins: 0.9, rift: 2.4 };

function addRitualZones(system, builtWorld, level) {
  if (level.ritualZones && level.ritualZones.length) {
    for (const z of level.ritualZones) {
      system.addRitualZone(z.colMin, z.rowMin, z.colMax, z.rowMax, z.rate);
    }
    return level.ritualZones.length;
  }
  const bounds = new Map();
  builtWorld.grid.forEach((cell, col, row) => {
    const rate = DISTRICT_DRAIN[cell.district];
    if (!rate || !cell.walk) return;
    let b = bounds.get(cell.district);
    if (!b) { b = { colMin: col, colMax: col, rowMin: row, rowMax: row, rate }; bounds.set(cell.district, b); }
    if (col < b.colMin) b.colMin = col;
    if (col > b.colMax) b.colMax = col;
    if (row < b.rowMin) b.rowMin = row;
    if (row > b.rowMax) b.rowMax = row;
  });
  for (const b of bounds.values()) {
    system.addRitualZone(b.colMin, b.rowMin, b.colMax, b.rowMax, b.rate);
  }
  console.info('[saltwake] ritual pressure zones: %s',
    [...bounds.entries()].map(([d, b]) => `${d}(${b.rate})`).join(' '));
  return bounds.size;
}

function onResize() {
  const buf = stage.resize();
  const aspect = stage.aspect;
  player.camera.aspect = aspect;
  player.camera.updateProjectionMatrix();
  weapons.camera.aspect = aspect;
  weapons.camera.updateProjectionMatrix();
  shared.uResolution.value.set(buf.width, buf.height);
  if (hud) hud.resize();
}

/** Everything the HUD needs, pushed once per tick. */
function syncHud() {
  const w = weapons.hudState();
  hud.setHealth(player.health, PLAYER.maxHealth);
  hud.setArmor(player.armor, PLAYER.maxArmor);
  hud.setAmmo(w.kind, w.loaded, w.reserve, w.capacity);
  hud.setWeapons(w.owned, w.index, w.names);
}

function simulate(dt) {
  const raw = input.sample();

  if (raw.dx || raw.dy) player.look(raw.dx, raw.dy);
  if (raw.weapon >= 0) weapons.select(raw.weapon);
  if (raw.wheel) weapons.cycle(raw.wheel > 0 ? 1 : -1);
  if (raw.reload) weapons.reload();
  if (raw.use) director.interact();

  player.update(dt, raw);
  weapons.update(dt, raw, app.time);
  enemies.update(dt, app.time);
  fx.update(dt, app.time);
  sanity.update(dt);
  director.update(dt, app.time);

  /* --- crosshair: amber when something hostile is under it --- */
  const dir = player.aimDirection(_aim);
  const origin = _origin.set(player.pos.x, player.eyePosition, player.pos.z);
  const hit = enemies.raycast(origin, dir, 60);
  const spread = weapons.def.spread ? Math.min(1, weapons.def.spread * 8) : 0.2;
  hud.setCrosshair(spread + weapons.fireVisual * 0.5, !!hit);

  /* --- the world's own lights, with flicker --- */
  submitWorldLights();

  stage.setDamage(player.hurtFlash * 0.7);
  syncHud();

  if (!player.alive && !app.deathHandled) {
    app.deathHandled = true;
    hud.showEnding([
      'The lamp goes out.',
      'The tide finds you before anything else does.',
      'Reload the page to try the night again.',
    ]);
    if (audio) audio.setMusicIntensity(0);
  }
}

/**
 * Lamps, candles and ritual fires are submitted every frame so they can flicker.
 * The budget in env.js keeps only the nearest few, which is how a period engine
 * handled more lights than the hardware could take.
 */
function submitWorldLights() {
  const px = player.pos.x;
  const pz = player.pos.z;
  for (const L of world.lights) {
    if (!L.dynamic && L.flicker <= 0) continue;
    const d2 = (L.x - px) * (L.x - px) + (L.z - pz) * (L.z - pz);
    if (d2 > 900) continue;
    let intensity = L.intensity;
    if (L.flicker > 0) {
      // Stepped flicker on a low clock: it reads as a guttering wick.
      const f = Math.floor(app.time * 11 + L.x * 3.1 + L.z * 1.7);
      const n = Math.sin(f * 12.9898) * 43758.5453;
      intensity *= 1 - L.flicker * (n - Math.floor(n));
    }
    lights.add({ x: L.x, y: L.y, z: L.z }, L.radius, L.color, intensity);
  }
}

const _aim = new THREE.Vector3();
const _origin = new THREE.Vector3();

function frame(now) {
  requestAnimationFrame(frame);
  const wall = (now - app.lastFrame) / 1000;
  app.lastFrame = now;

  if (!app.paused) {
    app.accumulator += Math.min(wall, TICK * MAX_CATCHUP);
    let steps = 0;
    while (app.accumulator >= TICK && steps < MAX_CATCHUP) {
      app.time += TICK;
      simulate(TICK);
      app.accumulator -= TICK;
      steps += 1;
    }
  }

  /* --- render --- */
  updateShared(app.time, player.camera, stage.bufferSize);
  if (audio) {
    const fwd = player.aimDirection(_aim);
    audio.setListener(
      { x: player.pos.x, y: player.eyePosition, z: player.pos.z },
      { x: fwd.x, y: fwd.y, z: fwd.z },
      { x: 0, y: 1, z: 0 },
    );
    audio.update(wall);
  }
  stage.beginFrame(app.time);
  stage.renderInto(scene, player.camera);
  // The viewmodel goes into the same low-resolution target after the world, on a
  // cleared depth buffer, so it can never be clipped by a wall.
  stage.renderInto(weapons.scene, weapons.camera, true);
  stage.present();

  hud.update(wall);

  app.fpsAccum += wall;
  app.fpsFrames += 1;
  if (app.fpsAccum > 0.5) {
    app.fps = app.fpsFrames / app.fpsAccum;
    app.fpsAccum = 0;
    app.fpsFrames = 0;
  }
}

/* ------------------------------------------------------------------ start */

main().catch((err) => {
  console.error(err);
  // Show the actual failure on the page. A boot screen that only says to check
  // the console leaves the player with nothing to report.
  step('The town failed to build.', 1);
  if (boot) {
    boot.hidden = false;
    boot.classList.remove('is-done');
    const note = boot.querySelector('.boot__note');
    if (note) {
      note.textContent = `${err && err.name ? err.name : 'Error'}: ${err && err.message ? err.message : String(err)}`;
      note.style.color = '#7a1f14';
      note.style.fontWeight = '700';
    }
  }
});

/* Exposed for inspection from the console. */
window.saltwake = {
  get world() { return world; },
  get player() { return player; },
  get enemies() { return enemies; },
  get director() { return director; },
  get stage() { return stage; },
  get fps() { return app.fps; },
  shared,
  setRetro,
  /** Toggle the whole retro chain off, to show what it is doing. */
  modern(on = true) {
    setRetro({ affine: on ? 0 : RENDER.affine, jitter: on ? 0 : RENDER.vertexJitter });
    const u = stage.material.uniforms;
    u.uPaletteSteps.value = on ? 255 : RENDER.paletteSteps;
    u.uScanlines.value = on ? 0 : RENDER.scanlines;
    u.uGrain.value = on ? 0 : RENDER.grain;
    u.uDither.value = on ? 0 : RENDER.ditherStrength;
    u.uInterlace.value = on ? 0 : RENDER.interlace;
    stage.setQuality(on ? 'sharp' : RENDER.quality);
  },
};
