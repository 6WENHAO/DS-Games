/* =============================================================================
   tools/smoke.js - headless integration test.
   Stubs just enough of the browser (canvas 2D, WebGL 1, DOM, timers) to build
   the whole simulator and step it for a few hundred frames, so that runtime
   errors are caught without opening a browser.

   Usage:  node tools/smoke.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['math.js', 'gl.js', 'geom.js', 'tex.js', 'audio.js', 'assets.js',
  'world.js', 'fx.js', 'tank.js', 'cockpit.js', 'sim.js'];

/* --------------------------------------------------------------- 2D stub --- */
function make2d(canvas) {
  const grad = { addColorStop() { } };
  const store = {
    canvas, globalAlpha: 1, lineWidth: 1, font: '10px sans-serif',
    textAlign: 'start', textBaseline: 'alphabetic', fillStyle: '#000',
    strokeStyle: '#000', shadowBlur: 0, shadowColor: '#000', lineCap: 'butt',
    lineJoin: 'miter', miterLimit: 10, globalCompositeOperation: 'source-over',
    filter: 'none', imageSmoothingEnabled: true
  };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient' ||
        k === 'createConicGradient' || k === 'createPattern') return () => grad;
      if (k === 'measureText') return (s) => ({ width: (s ? String(s).length : 0) * 6, actualBoundingBoxAscent: 8 });
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (k === 'putImageData') return () => { };
      if (k === 'isPointInPath') return () => false;
      return () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

/* ------------------------------------------------------------ WebGL stub --- */
let constCounter = 0x1000;
function makeGL(canvas) {
  const store = {
    canvas,
    drawingBufferWidth: canvas.width, drawingBufferHeight: canvas.height,
    calls: { draws: 0, buffers: 0, textures: 0, programs: 0 }
  };
  const handler = {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string' && /^[A-Z][A-Z0-9_]*$/.test(k)) {
        t[k] = constCounter++;
        return t[k];
      }
      switch (k) {
        case 'createShader': case 'createProgram': case 'createTexture':
        case 'createFramebuffer': case 'createRenderbuffer':
          return () => ({ id: ++t.calls.programs });
        case 'createBuffer': return () => ({ id: ++t.calls.buffers });
        case 'getShaderParameter': case 'getProgramParameter': return () => true;
        case 'getShaderInfoLog': case 'getProgramInfoLog': return () => '';
        case 'getAttribLocation': return (p, n) => ({ a_pos: 0, a_nrm: 1, a_uv: 2, a_col: 3 }[n] !== undefined ? { a_pos: 0, a_nrm: 1, a_uv: 2, a_col: 3 }[n] : 0);
        case 'getUniformLocation': return () => ({});
        case 'getExtension': return (n) => (n === 'OES_element_index_uint' ? {} : null);
        case 'getParameter': return () => 4096;
        case 'drawElements': case 'drawArrays': return () => { t.calls.draws++; };
        case 'bufferData': return (target, data) => {
          if (data && data.length === undefined && typeof data !== 'number') throw new Error('bufferData got a non-array');
          return undefined;
        };
        case 'texImage2D': return () => { t.calls.textures++; };
        case 'uniform3fv': case 'uniform1fv': case 'uniform4fv': case 'uniform2fv':
          return (loc, v) => {
            if (!v || v.length === undefined) throw new Error('uniform array expected an array, got ' + v);
            for (let i = 0; i < v.length; i++) {
              if (typeof v[i] !== 'number' || !isFinite(v[i])) {
                throw new Error('uniform array element ' + i + ' is not finite: ' + v[i]);
              }
            }
          };
        case 'uniformMatrix4fv': return (loc, tr, m) => {
          if (!m || m.length !== 16) throw new Error('uniformMatrix4fv expected 16 floats, got ' + (m && m.length));
          for (let i = 0; i < 16; i++) if (!isFinite(m[i])) throw new Error('matrix element ' + i + ' is not finite');
        };
        case 'uniformMatrix3fv': return (loc, tr, m) => {
          if (!m || m.length !== 9) throw new Error('uniformMatrix3fv expected 9 floats');
          for (let i = 0; i < 9; i++) if (!isFinite(m[i])) throw new Error('normal matrix element ' + i + ' is not finite');
        };
        case 'uniform1f': case 'uniform1i': return (loc, v) => {
          if (typeof v !== 'number' || !isFinite(v)) throw new Error('uniform1f got ' + v);
        };
        case 'uniform2f': case 'uniform3f': case 'uniform4f': return function () {
          for (let i = 1; i < arguments.length; i++) {
            if (typeof arguments[i] !== 'number' || !isFinite(arguments[i])) {
              throw new Error('uniformNf argument ' + i + ' is ' + arguments[i]);
            }
          }
        };
        default: return () => undefined;
      }
    },
    set(t, k, v) { t[k] = v; return true; }
  };
  return new Proxy(store, handler);
}

/* --------------------------------------------------------------- DOM stub --- */
function makeCanvas(w, h) {
  const c = {
    width: w || 300, height: h || 150, clientWidth: w || 300, clientHeight: h || 150,
    style: {}, tagName: 'CANVAS',
    getContext(kind) {
      if (kind === '2d') { this._2d = this._2d || make2d(this); return this._2d; }
      this._gl = this._gl || makeGL(this);
      return this._gl;
    },
    toDataURL() { return 'data:,'; },
    addEventListener() { }, removeEventListener() { },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; },
    appendChild() { }
  };
  return c;
}

function install(sandbox) {
  const win = sandbox;
  win.window = win;
  win.self = win;
  win.devicePixelRatio = 1;
  win.performance = { now: () => Date.now() };
  win.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
  win.console = console;
  win.setTimeout = setTimeout;
  win.clearTimeout = clearTimeout;
  win.document = {
    readyState: 'complete',
    createElement(tag) {
      if (String(tag).toLowerCase() === 'canvas') return makeCanvas(256, 256);
      return { style: {}, appendChild() { }, addEventListener() { } };
    },
    getElementById() { return null; },
    addEventListener() { },
    documentElement: { style: {} },
    body: { appendChild() { }, addEventListener() { } }
  };
  win.AudioContext = undefined;
  win.webkitAudioContext = undefined;
  return win;
}

/* ------------------------------------------------------------------ run --- */
const sandbox = install({});
const context = vm.createContext(sandbox);
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  try {
    vm.runInContext(src, context, { filename: 'js/' + f });
  } catch (e) {
    console.error('LOAD FAILED in js/' + f + ':\n', e);
    process.exit(1);
  }
}

const TS = sandbox.TS;
function step(label, fn) {
  const t0 = Date.now();
  try {
    const r = fn();
    console.log('  ok  ' + label.padEnd(30) + ' ' + (Date.now() - t0) + ' ms');
    return r;
  } catch (e) {
    console.error('FAILED ' + label + '\n', e && e.stack ? e.stack : e);
    process.exit(1);
  }
}

console.log('modules loaded:', Object.keys(TS).join(', '));

const canvas = makeCanvas(1280, 720);
const R = step('renderer', () => new TS.Renderer(canvas));
const A = step('assets', () => new TS.Assets(R));
const world = step('world.build', () => { const w = new TS.World(R, A); w.build(); return w; });
const tank = step('tank.build', () => { const t = new TS.Tank(R, A); t.build(); return t; });
const fx = step('fx', () => new TS.FX(R, A));
const sim = step('sim', () => new TS.Sim(world, tank, fx, TS.Audio));
const cockpit = step('cockpit.build', () => { const c = new TS.Cockpit(R, A, sim); c.build(); return c; });

console.log('  controls: ' + cockpit.controls.length + ', dyn parts: ' + cockpit.dyn.length +
  ', static meshes: ' + cockpit.static.length);
const missing = [];
for (const id of ['master', 'fuelPump', 'magneto', 'starter', 'parkBrake', 'gear', 'steerL', 'steerR',
  'breechLever', 'fire', 'traverse', 'elevWheel', 'shell0', 'shell7', 'radio', 'periscopeDrv',
  'sight', 'periscopeCmd', 'hatchDrv', 'hatchCmd', 'extinguisher', 'caseBag', 'coax', 'bowMg', 'smoke']) {
  if (!cockpit.byId[id]) missing.push(id);
}
if (missing.length) { console.error('FAILED missing controls: ' + missing.join(', ')); process.exit(1); }
console.log('  ok  all expected controls present');

/* exercise every control: read(), then act/down/up/drag */
step('control read/act', () => {
  const S = sim.state;
  for (const c of cockpit.controls) {
    if (c.read) c.read(S);
    if (c.act) c.act(S);
    if (c.down) c.down(S);
    if (c.up) c.up(S);
    if (c.drag) c.drag(S, 12, -9);
  }
});

/* full start-up procedure + gunnery, then many frames of driving */
step('start-up + drive + fire', () => {
  const S = sim.state;
  /* the control sweep above left the switches in an arbitrary state, so set
     the electrical system explicitly, then use the real start sequence */
  S.master = false; S.fuelPump = false; S.magneto = false;
  sim.toggle('master'); sim.toggle('fuelPump'); sim.toggle('magneto');
  if (!(S.master && S.fuelPump && S.magneto)) throw new Error('switches did not latch on');
  S.engine.running = false;
  sim.starterDown();
  for (let i = 0; i < 200; i++) sim.update(1 / 60, {});
  if (!S.engine.running) throw new Error('engine failed to start after cranking');
  sim.starterUp();
  if (S.parkBrake) sim.toggle('parkBrake');
  sim.setGear(2);
  const input = { throttle: true, steerL: false, steerR: false };
  for (let i = 0; i < 600; i++) {
    if (i === 200) input.steerL = true;
    if (i === 320) { input.steerL = false; input.steerR = true; }
    if (i === 420) input.steerR = false;
    sim.update(1 / 60, input);
    world.update(1 / 60);
    fx.update(1 / 60, world);
  }
  if (!isFinite(S.pos[0] + S.pos[1] + S.pos[2])) throw new Error('tank position went non-finite');
  if (Math.abs(S.speed) < 0.5) throw new Error('tank never moved (speed ' + S.speed + ')');
  /* gunnery cycle (restore a full rack: the control sweep raided it) */
  S.rack = ['AP', 'AP', 'AP', 'HE', 'HE', 'AP', 'HE', 'AP'];
  S.rackLift = [0, 0, 0, 0, 0, 0, 0, 0];
  S.rackReload = 0; sim.pendingLoad = -1;
  S.gun.loaded = null; S.gun.spent = false; S.gun.breechTarget = 0;
  for (let i = 0; i < 30; i++) sim.update(1 / 60, {});
  S.turret.yaw = 0; sim.setElevation(0.02);
  sim.toggleBreech();
  for (let i = 0; i < 30; i++) sim.update(1 / 60, {});
  sim.loadFromRack(0);
  for (let i = 0; i < 80; i++) sim.update(1 / 60, {});
  if (S.gun.loaded !== 'AP') throw new Error('loading failed, chamber = ' + S.gun.loaded);
  sim.toggleBreech();
  for (let i = 0; i < 30; i++) sim.update(1 / 60, {});
  sim.fireMain();
  if (S.shots !== 1) throw new Error('fireMain did not fire');
  for (let i = 0; i < 400; i++) { sim.update(1 / 60, {}); fx.update(1 / 60, world); }
  if (sim.projectiles.length) throw new Error('projectile never resolved');
  sim.mgDown('coax');
  for (let i = 0; i < 120; i++) sim.update(1 / 60, {});
  sim.mgUp();
  sim.fireSmoke();
  for (let i = 0; i < 200; i++) { sim.update(1 / 60, {}); fx.update(1 / 60, world); }
});

/* render the whole scene in every camera mode */
step('render all views', () => {
  const S = sim.state;
  const M4 = TS.M4, MU = TS.MU;
  const views = ['interior', 'periscope', 'sight', 'cupola', 'unbuttoned', 'chase', 'orbit'];
  const stations = ['driver', 'gunner', 'loader', 'commander'];
  for (const v of views) {
    for (const st of stations) {
      S.view = v; S.station = st;
      const hullMat = sim.hullMatrix();
      const turretMat = sim.turretMatrix();
      const proj = M4.perspective(MU.rad(65), 16 / 9, 0.05, 2400);
      const eye = M4.transformPoint(hullMat, [0, 1.5, 1.2]);
      const view = M4.lookAt(eye, M4.transformPoint(hullMat, [0, 1.5, 8]), [0, 1, 0]);
      const vp = M4.multiply(proj, view);
      R.beginFrame();
      R.setCamera(vp, eye);
      R.setLights(fx.lights([]));
      R.clear([0.5, 0.5, 0.5]);
      world.draw(R, eye);
      tank.draw(R, {
        hullMat, turretYaw: S.turret.yaw, gunPitch: S.gun.pitch, recoil: S.gun.recoil,
        trackL: S.trackL, trackR: S.trackR, driverHatch: S.hatchDrv, cmdHatch: S.hatchCmd,
        lights: true, interiorView: v === 'interior', time: S.time
      });
      fx.draw(R, [1, 0, 0], [0, 1, 0], eye);
      R.flush();
      R.clearDepth();
      R.setCamera(vp, eye);
      cockpit.draw(R, hullMat, turretMat, S);
      R.flush();
    }
  }
});

/* picking: fire rays from each station eye in a fan and make sure it is stable
   and that a decent number of controls can actually be hit */
step('picking', () => {
  const S = sim.state, M4 = TS.M4, V3 = TS.V3, D = TS.TankDef;
  const hullMat = sim.hullMatrix(), turretMat = sim.turretMatrix();
  const found = {};
  for (const name of Object.keys(D.stations)) {
    const st = D.stations[name];
    const base = st.space === 'turret' ? turretMat : hullMat;
    const eye = M4.transformPoint(base, st.eye);
    for (let yaw = -Math.PI; yaw < Math.PI; yaw += 0.035) {
      for (let pitch = -1.1; pitch < 0.9; pitch += 0.035) {
        const dir = V3.normalize(M4.transformDir(base,
          [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]));
        const hit = cockpit.pick(eye, dir, hullMat, turretMat);
        if (hit && hit.t < 2.4) found[hit.ctl.id] = (found[hit.ctl.id] || 0) + 1;
      }
    }
  }
  const hitIds = Object.keys(found);
  console.log('      pickable from a crew eye point: ' + hitIds.length + ' / ' + cockpit.controls.length);
  const never = cockpit.controls.filter(c => !found[c.id]).map(c => c.id);
  if (never.length) console.log('      never hit: ' + never.join(', '));
  if (hitIds.length < cockpit.controls.length * 0.75) {
    throw new Error('too few controls reachable by the mouse picker');
  }
});

/* geometry sanity: no NaN in any uploaded mesh */
step('numeric sanity', () => {
  const S = sim.state;
  for (const k of ['pos', 'turret', 'gun']) {
    const v = S[k];
    const nums = Array.isArray(v) ? v : Object.keys(v).map(x => v[x]);
    for (const n of nums) if (typeof n === 'number' && !isFinite(n)) throw new Error('non-finite in state.' + k);
  }
  if (!isFinite(S.engine.rpm + S.engine.temp + S.fuel)) throw new Error('non-finite engine state');
});

console.log('\nGL stub totals: draws=' + canvas.getContext('webgl').calls.draws +
  ' buffers=' + canvas.getContext('webgl').calls.buffers +
  ' textures=' + canvas.getContext('webgl').calls.textures);
console.log('score=' + sim.state.score + ' kills=' + sim.state.kills +
  ' shots=' + sim.state.shots + ' messages=' + sim.state.messages.length);
console.log('\nALL SMOKE TESTS PASSED');
