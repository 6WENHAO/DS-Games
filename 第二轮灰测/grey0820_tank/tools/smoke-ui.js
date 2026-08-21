/* =============================================================================
   tools/smoke-ui.js - headless test of main.js: the staged boot, the camera
   for every view, the input routing (keyboard + mouse picking + dragging) and
   the HUD update. Element ids are taken from index.html, so a typo in either
   file fails this test.

   Usage:  node tools/smoke-ui.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeCanvas } = require('./stub');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['math.js', 'gl.js', 'geom.js', 'tex.js', 'audio.js', 'assets.js',
  'world.js', 'fx.js', 'tank.js', 'cockpit.js', 'sim.js', 'main.js'];

/* ---- ids declared in index.html ---------------------------------------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ids = new Set();
html.replace(/id="([^"]+)"/g, (m, g) => { ids.add(g); return m; });
console.log('index.html declares ' + ids.size + ' ids');

/* ---- fake DOM ---------------------------------------------------------- */
const unknownIds = new Set();
const listeners = { window: {}, canvas: {}, document: {} };
function fakeEl(id) {
  const e = {
    id, style: {}, className: '', textContent: '', innerHTML: '', value: '',
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (listeners.window[id + ':' + t] = listeners.window[id + ':' + t] || []).push(fn); },
    removeEventListener() { },
    querySelector() { return fakeEl(id + '>child'); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
    focus() { }, blur() { }, click() { }
  };
  return e;
}
const elCache = {};
const glCanvas = makeCanvas(1280, 720);
glCanvas.id = 'gl';
glCanvas.addEventListener = function (t, fn) { (listeners.canvas[t] = listeners.canvas[t] || []).push(fn); };

let clock = 0;
const rafQueue = [];
const timerQueue = [];

const sandbox = {};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.console = console;
sandbox.devicePixelRatio = 1;
sandbox.performance = { now: () => clock };
sandbox.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
sandbox.cancelAnimationFrame = () => { };
sandbox.setTimeout = (fn, ms) => { timerQueue.push({ fn, at: clock + (ms || 0) }); return timerQueue.length; };
sandbox.clearTimeout = () => { };
sandbox.addEventListener = (t, fn) => { (listeners.window[t] = listeners.window[t] || []).push(fn); };
sandbox.AudioContext = undefined;
sandbox.webkitAudioContext = undefined;
sandbox.document = {
  readyState: 'complete',
  pointerLockElement: null,
  createElement(tag) {
    if (String(tag).toLowerCase() === 'canvas') return makeCanvas(256, 256);
    return fakeEl('created');
  },
  getElementById(id) {
    if (id === 'gl') return glCanvas;
    if (!ids.has(id)) { unknownIds.add(id); return null; }
    if (!elCache[id]) elCache[id] = fakeEl(id);
    return elCache[id];
  },
  addEventListener(t, fn) { (listeners.document[t] = listeners.document[t] || []).push(fn); },
  exitPointerLock() { },
  documentElement: { style: {} },
  body: { appendChild() { }, addEventListener() { } }
};

const ctx = vm.createContext(sandbox);
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  try { vm.runInContext(src, ctx, { filename: 'js/' + f }); }
  catch (e) { console.error('LOAD FAILED js/' + f + '\n', e); process.exit(1); }
}

/* ---- drive the fake clock --------------------------------------------- */
function pump(ms, stepMs) {
  stepMs = stepMs || 16;
  const end = clock + ms;
  let guard = 0;
  while (clock < end && guard++ < 20000) {
    clock += stepMs;
    /* timers first */
    for (let i = 0; i < timerQueue.length; i++) {
      if (timerQueue[i].at <= clock) {
        const t = timerQueue.splice(i, 1)[0];
        i--;
        t.fn();
      }
    }
    const frames = rafQueue.splice(0, rafQueue.length);
    for (const fn of frames) fn(clock);
  }
}
function fire(bucket, type, ev) {
  const list = listeners[bucket][type] || [];
  for (const fn of list) fn(ev || {});
}
function key(k, up) {
  const ev = { key: k, preventDefault() { }, stopPropagation() { } };
  fire('window', up ? 'keyup' : 'keydown', ev);
}
/* a complete press: main.js suppresses auto-repeat, so a keyup is required
   before the same key does anything again */
function tap(k) { key(k); key(k, true); }
function mouse(type, opts) {
  const ev = Object.assign({
    button: 0, clientX: 640, clientY: 360, movementX: 0, movementY: 0,
    preventDefault() { }, stopPropagation() { }, deltaY: 0
  }, opts || {});
  if (type === 'mousedown' || type === 'wheel') fire('canvas', type, ev);
  else fire('window', type, ev);
}

let failed = false;
function check(label, fn) {
  try { fn(); console.log('  ok  ' + label); }
  catch (e) { failed = true; console.error('FAILED ' + label + '\n', e && e.stack ? e.stack : e); }
}

/* ---- boot ------------------------------------------------------------- */
pump(3000);
const App = sandbox.TS.App;
check('boot completed', () => {
  if (!App || !App.ready) throw new Error('App never became ready (loader text: ' +
    (elCache.loadText && elCache.loadText.textContent) + ')');
  if (!App.world || !App.tank || !App.cockpit || !App.sim) throw new Error('missing subsystems');
});
check('no unknown element ids', () => {
  if (unknownIds.size) throw new Error('main.js asked for ids missing from index.html: ' +
    [...unknownIds].join(', '));
});
check('checklist rendered', () => {
  const c = elCache['checklist'];
  if (!c || !/START-UP/.test(c.innerHTML)) throw new Error('checklist not built');
});

/* ---- begin + a few seconds of frames ---------------------------------- */
tap('Enter');
pump(500);
check('started', () => { if (!App.started) throw new Error('begin() did not run'); });

const S = App.sim.state;
check('keyboard start-up sequence', () => {
  if (!S.master) tap('M');
  if (!S.fuelPump) tap('F');
  if (!S.magneto) tap('I');
  key('G');
  pump(2500);
  key('G', true);
  if (!S.engine.running) throw new Error('engine did not start from the keyboard');
  if (S.parkBrake) tap('P');
  tap('!');           /* shift+1 -> first gear */
  if (S.gear !== 1) throw new Error('gear select failed, gear = ' + S.gear);
});

check('driving with W and A', () => {
  App.keys['W'] = true;
  pump(2500);
  App.keys['A'] = true;
  pump(1200);
  App.keys['A'] = false;
  App.keys['W'] = false;
  if (!(Math.abs(S.speed) > 0.5)) throw new Error('did not accelerate (speed=' + S.speed + ')');
  if (!isFinite(S.pos[0] + S.pos[2])) throw new Error('position went non-finite');
});

check('every view renders', () => {
  const views = ['1', '2', '3', '4', '5', '6', '7', '8'];
  for (const v of views) {
    tap(v);
    pump(300);
    if (!App.camInfo) throw new Error('no camera info in view ' + v);
    for (let i = 0; i < 16; i++) {
      if (!isFinite(App.camInfo.vp[i])) throw new Error('non-finite view-projection in view ' + v);
    }
  }
});

check('gunnery from the keyboard', () => {
  tap('3');                     /* gunner sight */
  pump(200);
  App.keys['ArrowLeft'] = true; pump(500); App.keys['ArrowLeft'] = false;
  App.keys['ArrowUp'] = true; pump(300); App.keys['ArrowUp'] = false;
  tap('Z'); pump(400);          /* auto-load: opens the breech */
  tap('Z'); pump(1200);         /* auto-load: lifts a round in */
  tap('Z'); pump(400);          /* auto-load: closes the breech */
  if (!S.gun.loaded) throw new Error('auto-load did not chamber a round');
  tap(' ');
  if (S.shots !== 1) throw new Error('space did not fire');
  pump(3000);
});

check('mouse look and control picking', () => {
  tap('1');                     /* back inside, driver */
  pump(200);
  /* hover sweep across the screen: must never throw and should find controls */
  let hits = 0;
  for (let x = 200; x < 1100; x += 40) {
    for (let y = 120; y < 640; y += 40) {
      mouse('mousemove', { clientX: x, clientY: y });
      if (App.hover) hits++;
    }
  }
  console.log('      hover hits over a screen sweep: ' + hits);
  /* right-drag look */
  mouse('mousedown', { button: 2, clientX: 640, clientY: 360 });
  for (let i = 0; i < 20; i++) mouse('mousemove', { clientX: 640 + i * 6, clientY: 360 + i * 2 });
  mouse('mouseup', { button: 2 });
  pump(200);
  if (!isFinite(App.yaw) || !isFinite(App.pitch)) throw new Error('look angles went non-finite');
});

check('clicking a control through the picker', () => {
  /* aim the free-look camera at the instrument panel, then click the centre */
  tap('1'); pump(100);
  App.yaw = 0; App.pitch = -0.15;
  pump(100);
  const before = JSON.stringify([S.master, S.fuelPump, S.gear, S.throttle]);
  let clicked = 0;
  for (let x = 480; x < 820; x += 20) {
    for (let y = 260; y < 560; y += 20) {
      mouse('mousemove', { clientX: x, clientY: y });
      if (App.hover) {
        mouse('mousedown', { button: 0, clientX: x, clientY: y });
        mouse('mouseup', { button: 0 });
        clicked++;
      }
    }
  }
  console.log('      controls clicked from the driver seat: ' + clicked);
  if (clicked === 0) throw new Error('no control could be clicked from the driver seat');
  pump(500);
});

check('wheel zoom + hud stays finite', () => {
  tap('3'); pump(100);
  mouse('wheel', { deltaY: -1 }); mouse('wheel', { deltaY: -1 }); mouse('wheel', { deltaY: 1 });
  pump(300);
  if (!isFinite(App.fov)) throw new Error('fov went non-finite');
  const hud = elCache['hudSpeed'];
  if (!hud || hud.textContent === '') throw new Error('HUD not updating');
});

check('long run stability', () => {
  tap('7');                     /* chase cam */
  App.keys['W'] = true;
  pump(6000);
  App.keys['W'] = false;
  pump(1000);
  if (!isFinite(S.pos[0] + S.pos[1] + S.pos[2] + S.hullYaw + S.pitch + S.roll)) {
    throw new Error('hull state went non-finite after a long run');
  }
  if (!isFinite(S.engine.rpm + S.engine.temp + S.fuel)) throw new Error('engine state went non-finite');
});

console.log('\nfinal: fps=' + App.fps + ' draws=' + App.R.stats.draws +
  ' particles=' + App.fx.count() + ' score=' + S.score + ' kills=' + S.kills +
  ' shots=' + S.shots + ' fuel=' + S.fuel.toFixed(3) + ' temp=' + S.engine.temp.toFixed(1));
console.log(failed ? '\nUI SMOKE TESTS FAILED' : '\nALL UI SMOKE TESTS PASSED');
process.exit(failed ? 1 : 0);
