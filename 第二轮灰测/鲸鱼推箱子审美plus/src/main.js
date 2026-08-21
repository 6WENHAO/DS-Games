/**
 * Application entry point.
 *
 * Builds the world once, then runs two modes inside it:
 *   TITLE — the meadow with a crate tumbling along the road on a loop
 *   PLAY  — the same world, camera eased over to the garden plot
 *
 * Both modes share one scene, one uniform block and one render loop, so the
 * transition between them is a camera move rather than a scene swap.
 */
import * as THREE from 'three';
import { WORLD, CAMERAS, GRASS, RENDER, WIND, TOON, CLOUDS, FOGCFG, SUN, QUALITY_ORDER } from './core/config.js';
import { shared, bladeShared, actors, updateShared, setSunAngles, renderState } from './core/env.js';
import { Stage } from './core/renderer.js';
import { CameraRig } from './core/cameraRig.js';
import { buildEnvironment, createSkyDome } from './gfx/sky.js';
import { createTerrain } from './world/terrain.js';
import { createMeadow, grassMaterial } from './world/grass.js';
import { composeLandscape } from './world/trees.js';
import { createProps } from './world/props.js';
import { PLOT } from './world/plot.js';
import { RollingCrate } from './game/crate.js';
import { PuzzleStage } from './game/play.js';
import { LEVELS } from './game/levels.js';
import { UI } from './ui/ui.js';

const KEY_TO_DIR = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

const app = {
  mode: 'boot',
  clock: null,
  elapsed: 0,
  completed: new Set(),
  fpsAccum: 0,
  fpsFrames: 0,
  fps: 0,
};

const ui = new UI({ onAction: handleAction, onLocale: handleLocaleChange });
const canvas = document.getElementById('stage');
const stage = new Stage(canvas);
const rig = new CameraRig(stage.aspect);
const scene = new THREE.Scene();

let terrain = null;
let meadow = null;
let meadowCount = 0;
let trees = null;
let props = null;
let rollingCrate = null;
let puzzle = null;
let sky = null;
let pointerActor = null;
const pointerTarget = new THREE.Vector3(0, -999, 0);
const raycastPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

/* ------------------------------------------------------------------ boot */

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function boot() {
  ui.setBoot('boot.step.sky', 0.06);
  await nextFrame();

  const params = new URLSearchParams(window.location.search);
  const hdriKey = params.get('hdri');
  const env = await buildEnvironment(hdriKey);
  sky = createSkyDome(env.sky);
  scene.add(sky);
  // The radiance map is consumed directly: the sky dome samples it for the
  // backdrop and buildEnvironment() has already installed the blurred probe
  // into the shared uniform block as every material's ambient term.
  console.info(`[tallgrass] environment: ${env.source}`);

  ui.setBoot('boot.step.ground', 0.2);
  await nextFrame();
  terrain = createTerrain();
  scene.add(terrain.mesh);
  rig.set({ ...CAMERAS.menu, target: CAMERAS.menu.target.clone() });

  ui.setBoot('boot.step.trees', 0.42);
  await nextFrame();
  trees = composeLandscape(terrain, CAMERAS);
  if (trees.mesh) scene.add(trees.mesh);

  ui.setBoot('boot.step.stones', 0.56);
  await nextFrame();
  props = createProps(terrain);
  if (props.mesh) scene.add(props.mesh);
  terrain.applyShade([...trees.shadeCircles, ...props.shadeCircles]);

  ui.setBoot('boot.step.meadow', 0.68);
  await nextFrame();
  buildMeadow();

  ui.setBoot('boot.step.crate', 0.9);
  await nextFrame();
  rollingCrate = new RollingCrate(terrain.road, terrain, { tileSize: PLOT.tile, speed: 3.1 });
  // Loop the crate through the stretch of road the title camera frames, so it
  // is on screen for most of the cycle and wraps round out of sight.
  {
    const target = CAMERAS.menu.target;
    const near = terrain.road.nearest(target.x, target.z);
    const centre = terrain.road.arc[near.index];
    rollingCrate.setWindow(centre - 38, centre + 30);
  }
  scene.add(rollingCrate.root);

  puzzle = new PuzzleStage(scene, terrain, {
    onState: (info) => ui.setHudState(info),
    onSolved: (info) => {
      app.completed.add(LEVELS[info.index].id);
      ui.markCompleted(LEVELS, app.completed);
      setTimeout(() => ui.showSolved(info), 900);
    },
  });
  puzzle.setAspect(stage.aspect);

  pointerActor = actors.register(3.2);
  pointerActor.position.copy(pointerTarget);

  ui.buildLevelList(LEVELS, LEVELS.map((l) => l.par), app.completed);
  buildLab();

  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', () => pointerTarget.set(0, -999, 0));

  onResize();
  ui.finishBoot();
  ui.toTitle();
  app.mode = 'title';
  app.clock = new THREE.Clock();
  renderLoop();
}

function buildMeadow() {
  if (meadow) {
    scene.remove(meadow);
    meadow.geometry.dispose();
    meadow = null;
  }
  const count = GRASS.counts[renderState.quality] || GRASS.counts.medium;
  const focals = [
    { x: CAMERAS.menu.target.x, z: CAMERAS.menu.target.z, inner: 30, outer: 74 },
    { x: PLOT.center.x, z: PLOT.center.z, inner: 26, outer: 66 },
  ];
  const result = createMeadow(terrain, { count, focals, shadeQuery: trees.shadeQuery });
  meadow = result.mesh;
  meadowCount = result.count;
  if (meadow) scene.add(meadow);
  ui.setStats({ blades: meadowCount });
}

/* ------------------------------------------------------------------ modes */

function enterTitle() {
  const from = app.mode;
  app.mode = 'title';
  if (puzzle) {
    puzzle.active = false;
    puzzle.group.visible = false;
  }
  if (rollingCrate) rollingCrate.setActive(true);
  ui.toTitle();
  rig.goTo({ ...CAMERAS.menu, target: CAMERAS.menu.target.clone() }, from === 'play' ? 1.6 : 0.01);
}

function enterPlay(index) {
  const from = app.mode;
  app.mode = 'play';
  if (rollingCrate) rollingCrate.setActive(false);
  puzzle.group.visible = true;
  puzzle.active = true;
  puzzle.setAspect(stage.aspect);
  const framing = puzzle.load(index);
  ui.toGame();
  rig.goTo(framing, from === 'play' ? 0.55 : 1.5);
}

function handleAction(action, el) {
  switch (action) {
    case 'play':
      enterPlay(pickNextLevel());
      break;
    case 'levels':
      ui.openOverlay('levels');
      break;
    case 'lab':
      ui.openOverlay('lab');
      break;
    case 'credits':
      ui.openOverlay('credits');
      break;
    case 'close':
      ui.closeOverlays();
      break;
    case 'pick-level':
      ui.closeOverlays();
      enterPlay(parseInt(el.dataset.index, 10) || 0);
      break;
    case 'undo':
      puzzle.undo();
      break;
    case 'restart':
      puzzle.restart();
      break;
    case 'title':
      enterTitle();
      break;
    case 'next': {
      const last = puzzle.levelIndex >= LEVELS.length - 1;
      ui.closeOverlays();
      if (last) enterTitle();
      else enterPlay(puzzle.levelIndex + 1);
      break;
    }
    case 'replay':
      ui.closeOverlays();
      puzzle.restart();
      break;
    case 'move':
      puzzle.input(el.dataset.dir);
      break;
    default:
      break;
  }
}

function pickNextLevel() {
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (!app.completed.has(LEVELS[i].id)) return i;
  }
  return 0;
}

/* ------------------------------------------------------------------ input */

function onKeyDown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.code === 'Escape') {
    if (ui.overlay) ui.closeOverlays();
    else if (app.mode === 'play') enterTitle();
    event.preventDefault();
    return;
  }
  if (event.code === 'KeyL') { ui.openOverlay('lab'); event.preventDefault(); return; }

  if (app.mode === 'title') {
    if (event.code === 'Enter' || event.code === 'Space') {
      enterPlay(pickNextLevel());
      event.preventDefault();
    }
    return;
  }

  if (ui.overlay === 'solved') {
    if (event.code === 'Enter' || event.code === 'Space') {
      handleAction('next');
      event.preventDefault();
    }
    return;
  }
  if (ui.overlay) return;

  const dir = KEY_TO_DIR[event.code];
  if (dir) {
    puzzle.input(dir);
    event.preventDefault();
    return;
  }
  if (event.code === 'KeyZ' || event.code === 'Backspace') { puzzle.undo(); event.preventDefault(); }
  if (event.code === 'KeyR') { puzzle.restart(); event.preventDefault(); }
}

function onPointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, rig.camera);
  // Intersect the plane through the focus height: close enough for a cursor
  // that parts the grass, and it costs nothing.
  raycastPlane.constant = -(terrain ? terrain.sampleHeight(rig.focus.x, rig.focus.z) : 0);
  const hit = raycaster.ray.intersectPlane(raycastPlane, new THREE.Vector3());
  if (hit) {
    const y = terrain ? terrain.sampleHeight(hit.x, hit.z) : 0;
    pointerTarget.set(hit.x, y, hit.z);
  }
}

function onResize() {
  stage.resize();
  rig.setAspect(stage.aspect);
  if (puzzle) {
    puzzle.setAspect(stage.aspect);
    if (app.mode === 'play' && puzzle.rules) rig.goTo(puzzle.cameraFraming(), 0.35);
  }
}

/**
 * The UI redraws its own panels; this re-emits the puzzle state so the level
 * name, concept and hint come back through in the new language.
 */
function handleLocaleChange() {
  if (puzzle && puzzle.rules) puzzle.emitState();
}

/* ------------------------------------------------------------------ lab */

function buildLab() {
  const pct = (v) => `${Math.round(v * 100)}%`;
  const fixed1 = (v) => v.toFixed(1);
  const fixed2 = (v) => v.toFixed(2);

  ui.buildLab([
    {
      key: 'wind',
      rows: [
        {
          type: 'range', id: 'wind-strength', min: 0, max: 2, step: 0.01,
          value: WIND.strength, format: fixed2, onInput: (v) => { shared.uWindStrength.value = v; },
        },
        {
          type: 'range', id: 'wind-speed', min: 0, max: 4, step: 0.01,
          value: WIND.speed, format: fixed2, onInput: (v) => { shared.uWindSpeed.value = v; },
        },
        {
          type: 'range', id: 'wind-scale', min: 0.01, max: 0.2, step: 0.001,
          value: WIND.scale, format: (v) => v.toFixed(3), onInput: (v) => { shared.uWindScale.value = v; },
        },
        {
          type: 'range', id: 'wind-gust', min: 0, max: 3, step: 0.01,
          value: WIND.gust, format: fixed2, onInput: (v) => { shared.uGustStrength.value = v; },
        },
        {
          type: 'range', id: 'stop-fps', min: 3, max: 60, step: 1,
          value: WIND.stopFps, format: (v) => `${v} fps`, onInput: (v) => { shared.uStopFps.value = v; },
        },
        {
          type: 'toggle', id: 'stop-motion', value: true, onChange: (v) => { shared.uStopMotion.value = v ? 1 : 0; },
        },
      ],
    },
    {
      key: 'blades',
      rows: [
        {
          type: 'range', id: 'curve', min: 0.6, max: 4, step: 0.01,
          value: GRASS.curvePow, format: fixed2, onInput: (v) => { bladeShared.uCurvePow.value = v; },
        },
        {
          type: 'range', id: 'lean', min: 0, max: 1.6, step: 0.01,
          value: GRASS.baseLean, format: fixed2, onInput: (v) => { bladeShared.uBaseLean.value = v; },
        },
        {
          type: 'range', id: 'yaw', min: 0, max: 2, step: 0.01,
          value: GRASS.yawJitter, format: fixed2, onInput: (v) => { bladeShared.uYawJitter.value = v; },
        },
        {
          type: 'range', id: 'push', min: 0, max: 3, step: 0.01,
          value: GRASS.pushStrength, format: fixed2, onInput: (v) => { bladeShared.uPushStrength.value = v; },
        },
        {
          type: 'range', id: 'push-r', min: 0.2, max: 3, step: 0.01,
          value: GRASS.pushRadiusScale, format: fixed2, onInput: (v) => { bladeShared.uPushRadiusScale.value = v; },
        },
        {
          type: 'range', id: 'uvc', min: 0, max: 1, step: 0.01,
          value: GRASS.uvCompensate, format: pct, onInput: (v) => { bladeShared.uUvCompensate.value = v; },
        },
        {
          type: 'segment',
          id: 'quality',
         
          value: renderState.quality,
          options: QUALITY_ORDER.map((q) => ({
            label: `${Math.round(GRASS.counts[q] / 1000)}k`, value: q,
          })),
          onChange: (q) => {
            renderState.quality = q;
            stage.setQuality(q);
            buildMeadow();
          },
        },
      ],
    },
    {
      key: 'light',
      rows: [
        {
          type: 'range', id: 'toon-steps', min: 2, max: 10, step: 1,
          value: TOON.steps, format: (v) => String(v), onInput: (v) => { shared.uToonSteps.value = v; },
        },
        {
          type: 'range', id: 'toon-soft', min: 0.01, max: 0.5, step: 0.005,
          value: TOON.soft, format: fixed2, onInput: (v) => { shared.uToonSoft.value = v; },
        },
        {
          type: 'range', id: 'sun-el', min: 6, max: 78, step: 1,
          value: SUN.elevation, format: (v) => `${v}\u00B0`,
          onInput: (v) => setSunAngles(SUN.azimuth, v),
        },
        {
          type: 'range', id: 'ambient', min: 0, max: 1.6, step: 0.01,
          value: SUN.ambient, format: fixed2, onInput: (v) => { shared.uAmbientStrength.value = v; },
        },
      ],
    },
    {
      key: 'clouds',
      rows: [
        {
          type: 'range', id: 'cloud-cover', min: 0.2, max: 0.9, step: 0.005,
          value: CLOUDS.cover, format: fixed2, onInput: (v) => { shared.uCloudCover.value = v; },
        },
        {
          type: 'range', id: 'cloud-dark', min: 0.15, max: 1, step: 0.01,
          value: CLOUDS.dark, format: fixed2, onInput: (v) => { shared.uCloudDark.value = v; },
        },
        {
          type: 'range', id: 'cloud-speed', min: 0, max: 2, step: 0.01,
          value: CLOUDS.speed, format: fixed2, onInput: (v) => { shared.uCloudSpeed.value = v; },
        },
        {
          type: 'range', id: 'fog', min: 0, max: 0.08, step: 0.0005,
          value: FOGCFG.density, format: (v) => v.toFixed(4), onInput: (v) => { shared.uFogDensity.value = v; },
        },
        {
          type: 'range', id: 'fog-start', min: 0, max: 60, step: 1,
          value: FOGCFG.start, format: (v) => `${v} m`, onInput: (v) => { shared.uFogStart.value = v; },
        },
      ],
    },
    {
      key: 'frame',
      rows: [
        {
          type: 'toggle', id: 'pixel', value: RENDER.pixelArt, onChange: (v) => { stage.setPixelArt(v); },
        },
        {
          type: 'range', id: 'palette', min: 6, max: 96, step: 1,
          value: RENDER.paletteSteps, format: (v) => String(v),
          onInput: (v) => { stage.compositeMaterial.uniforms.uPaletteSteps.value = v; },
        },
        {
          type: 'range', id: 'dither', min: 0, max: 2, step: 0.01,
          value: RENDER.ditherStrength, format: fixed2,
          onInput: (v) => { stage.compositeMaterial.uniforms.uDither.value = v; },
        },
        {
          type: 'range', id: 'exposure', min: 0.4, max: 2.2, step: 0.01,
          value: RENDER.exposure, format: fixed2,
          onInput: (v) => { stage.compositeMaterial.uniforms.uExposure.value = v; },
        },
        {
          type: 'range', id: 'sat', min: 0.4, max: 1.8, step: 0.01,
          value: RENDER.saturation, format: fixed2,
          onInput: (v) => { stage.compositeMaterial.uniforms.uSaturation.value = v; },
        },
        {
          type: 'range', id: 'vig', min: 0, max: 0.8, step: 0.01,
          value: RENDER.vignette, format: fixed2,
          onInput: (v) => { stage.compositeMaterial.uniforms.uVignette.value = v; },
        },
      ],
    },
  ]);
}

/* ------------------------------------------------------------------ loop */

function renderLoop() {
  requestAnimationFrame(renderLoop);
  const dt = Math.min(app.clock.getDelta(), 0.05);
  app.elapsed += dt;

  if (pointerActor) {
    // Ease the cursor actor so the grass parts smoothly instead of snapping.
    pointerActor.position.lerp(pointerTarget, 1 - Math.exp(-dt * 12));
    pointerActor.radius = app.mode === 'play' ? 2.4 : 3.4;
  }

  if (app.mode === 'title' && rollingCrate) {
    rollingCrate.update(dt);
    // The framing drifts a little with the crate: enough to feel alive.
    if (!rig.moving) {
      const drift = CAMERAS.menu.target.clone();
      drift.x += Math.sin(app.elapsed * 0.06) * 2.2;
      drift.z += Math.cos(app.elapsed * 0.048) * 1.6;
      rig.nudgeTarget(drift, 0.5, dt);
    }
  }

  if (puzzle && app.mode === 'play') puzzle.update(dt, rig);

  rig.update(dt);
  updateShared(app.elapsed, rig.camera, rig.focus);
  if (sky) sky.userData.updateCamera(rig.camera);

  stage.render(scene, rig.camera);

  app.fpsAccum += dt;
  app.fpsFrames += 1;
  if (app.fpsAccum >= 0.5) {
    app.fps = app.fpsFrames / app.fpsAccum;
    app.fpsAccum = 0;
    app.fpsFrames = 0;
    if (!ui.el.lab.hidden) {
      const s = stage.stats();
      ui.setStats({
        blades: meadowCount,
        calls: s.calls,
        tris: s.triangles,
        res: `${s.width}\u00D7${s.height}`,
        fps: app.fps,
      });
    }
  }
}

/* ------------------------------------------------------------------ start */

boot().catch((err) => {
  console.error(err);
  ui.setBoot('boot.step.error', 1);
});

// Exposed for inspection from the console.
window.tallgrass = {
  get stage() { return stage; },
  get scene() { return scene; },
  get rig() { return rig; },
  get terrain() { return terrain; },
  get puzzle() { return puzzle; },
  shared,
  bladeShared,
  grassMaterial,
  WORLD,
};
