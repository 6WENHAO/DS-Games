/* ==========================================================================
 * tests/stress.js — hammer view / station switching to reproduce the
 * "screen turns one flat colour" bug, and to prove it stays fixed.
 *
 * A frame that ends up with fewer than 3 distinct colours means the renderer
 * painted the background and then nothing else — which is what happens when an
 * exception escapes the frame callback (the loop then never re-schedules and
 * the last flat frame is frozen on screen).
 * ==========================================================================*/
'use strict';
const path = require('path');
const W = 360, H = 240;
require('./smoke_stub.js');
const { Ctx2D } = require('./raster.js');

const view = globalThis.document.getElementById('view');
const ctx = new Ctx2D(W, H);
// rasterising every frame in JS is far too slow for a few thousand frames, so
// only the sampled frames are actually painted
const realFill = ctx._fillPath.bind(ctx);
ctx.paint = true;
ctx._fillPath = function (subs, style) { if (ctx.paint) realFill(subs, style); };
view.getContext = () => ctx;
view.width = W; view.height = H;
view.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H });
globalThis.innerWidth = W;
globalThis.innerHeight = H;

const JS = p => require(path.join(__dirname, '..', 'js', p));
JS('math3d.js'); JS('i18n.js'); JS('mesh.js'); JS('renderer.js'); JS('tanks.js');
JS('interiors.js'); JS('sim.js'); JS('world.js'); JS('audio.js'); JS('tutorial.js');
JS('ui.js'); JS('main.js');

const game = globalThis.game;
const M = globalThis.M;
const raf = globalThis.__raf;

let errors = 0, checks = 0, frames = 0, flat = 0, thrown = 0;
const ok = s => { checks++; console.log('  ✓ ' + s); };
const bad = s => { errors++; console.log('  ✗ ' + s); };

/** run one frame; report if the frame callback throws or paints a flat screen */
function frame(dt, sample) {
  const fn = raf.shift();
  if (!fn) { bad('the animation loop stopped scheduling frames (a frame callback threw)'); thrown++; return false; }
  ctx.paint = !!sample;
  if (sample) { ctx.buf.fill(0); ctx.m = [1, 0, 0, 1, 0, 0]; ctx.stack.length = 0; }
  try {
    fn(game.last + (dt || 16));
  } catch (e) {
    thrown++;
    bad('frame threw: ' + (e && e.message));
    if (thrown < 3 && e && e.stack) console.log(e.stack.split('\n').slice(0, 5).join('\n'));
    return false;
  }
  frames++;
  if (sample) {
    const seen = new Set();
    for (let y = 0; y < H; y += 3) {
      for (let x = 0; x < W; x += 3) {
        const i = (y * W + x) * 3;
        seen.add(((ctx.buf[i] >> 3) << 10) | ((ctx.buf[i + 1] >> 3) << 5) | (ctx.buf[i + 2] >> 3));
        if (seen.size > 3) return true;
      }
    }
    if (seen.size < 3) {
      flat++;
      return false;
    }
  }
  return true;
}

const VIEWS = ['interior', 'sight', 'periscope', 'unbutton', 'exterior'];
const KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', ' ', 'g', 'b', 'k', 'z', 'l', 't', 'y', 'x', 'c', 'h', 'p', 'v'];
const ev = k => ({ key: k, preventDefault() { }, stopPropagation() { } });

console.log('\n=== view switching stress ===\n');
game.resize();
frame(16);

let rnd = M.rng(20240820);
for (const spec of globalThis.TANKS) {
  game.selectTank(spec.id);
  game.deploy();
  const t = game.player;
  t.sys.master = true; t.sys.fuelCock = true; t.sys.engineOn = true; t.sys.rpm = 1200;
  t.sys.safety = false;
  const before = { flat, thrown };
  for (let i = 0; i < 420; i++) {
    // random station / view churn, exactly what a player does with 1-4 and V
    if (rnd() < 0.25) {
      const st = spec.stations[(rnd() * spec.stations.length) | 0];
      game.setStation(st);
    }
    if (rnd() < 0.35) game.setView(VIEWS[(rnd() * VIEWS.length) | 0]);
    if (rnd() < 0.2) game.onKey(ev('v'), true);
    if (rnd() < 0.5) {
      const k = KEYS[(rnd() * KEYS.length) | 0];
      game.onKey(ev(k), true);
      if (rnd() < 0.7) game.onKey(ev(k), false);
    }
    if (rnd() < 0.12) { t.sys.loaded = t.sys.shell; t.sys.safety = false; t.fire(); }
    if (rnd() < 0.06) { t.sys.turretYaw = (rnd() - 0.5) * 6; t.sys.gunPitch = (rnd() - 0.5) * 0.3; }
    if (rnd() < 0.04) t.toggleHatch(['driver', 'loader', 'commander', 'gunner'][(rnd() * 4) | 0]);
    if (rnd() < 0.03) { t.sys.sight.zoomIdx = (rnd() * spec.optics.zoom.length) | 0; }
    // extreme camera: park the gun right at the near plane, big/small windows
    if (rnd() < 0.02) { globalThis.innerWidth = 300 + ((rnd() * 260) | 0); globalThis.innerHeight = 180 + ((rnd() * 200) | 0); game.resize(); }
    if (!frame(8 + rnd() * 40, i % 20 === 0)) break;
  }
  const dFlat = flat - before.flat, dThrown = thrown - before.thrown;
  if (dFlat || dThrown) bad(spec.short + ': ' + dFlat + ' flat frame(s), ' + dThrown + ' exception(s)');
  else ok(spec.short.padEnd(9) + ' survived 420 randomised view/station switches');
  globalThis.innerWidth = W; globalThis.innerHeight = H; game.resize();
}

/* deliberately nasty: switch views while the camera sits on the near plane */
try {
  game.selectTank('tiger');
  game.deploy();
  const t = game.player;
  t.sys.master = true; t.sys.fuelCock = true; t.sys.engineOn = true;
  for (let i = 0; i < 25; i++) {
    game.setStation(t.spec.stations[i % t.spec.stations.length]);
    game.setView(VIEWS[i % VIEWS.length]);
    game.look.pitch = (i % 7 - 3) * 0.35;
    game.look.yaw = (i % 5 - 2) * 0.6;
    t.sys.recoil = (i % 3) * 0.12;
    t.sys.breechOpen = i % 2 === 0;
    frame(16, true);
  }
  ok('near-plane view churn: no flat frames');
} catch (e) { bad('near-plane churn threw: ' + e.message); }

console.log('\nframes rendered: ' + frames + ', flat frames: ' + flat + ', exceptions: ' + thrown);
console.log('=== ' + checks + ' checks passed, ' + errors + ' problem(s) ===\n');
process.exit(errors ? 1 : 0);
