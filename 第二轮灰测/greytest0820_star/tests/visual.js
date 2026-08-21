/* ==========================================================================
 * tests/visual.js — renders frames with the software rasteriser from
 * render_png.js and asserts *statistical* properties of the pixels, so the
 * look of the game can be verified without a browser or human eye:
 *
 *   - frames are not blank / not a flat colour
 *   - exterior views: sky above, ground below, tank pixels in the centre
 *   - interior views: compartment fills the frame, is lit, and is not black
 *   - sight view: masked corners, bright aperture, reticle ink in the centre
 *   - thermal channel actually changes the palette
 * ==========================================================================*/
'use strict';
const fs = require('fs');
const path = require('path');

const W = 900, H = 560;
require('./smoke_stub.js');
const { Ctx2D, writePNG } = require('./raster.js');

const view = globalThis.document.getElementById('view');
const ctx = new Ctx2D(W, H);
view.getContext = () => ctx;
view.width = W; view.height = H;
view.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H });
globalThis.innerWidth = W;
globalThis.innerHeight = H;

const JS = p => require(path.join(__dirname, '..', 'js', p));
JS('math3d.js'); JS('i18n.js'); JS('mesh.js'); JS('renderer.js'); JS('tanks.js');
JS('interiors.js'); JS('sim.js'); JS('world.js'); JS('audio.js'); JS('tutorial.js'); JS('ui.js'); JS('main.js');

const game = globalThis.game;
const raf = globalThis.__raf;
const M = globalThis.M;

let errors = 0, checks = 0;
const ok = s => { checks++; console.log('  ✓ ' + s); };
const bad = (s, d) => { errors++; console.log('  ✗ ' + s + (d ? '   [' + d + ']' : '')); };

function step(n, dt) {
  for (let i = 0; i < n; i++) {
    const fn = raf.shift();
    if (!fn) throw new Error('no frame scheduled');
    fn(game.last + (dt || 16));
  }
}

const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });

function grab(name) {
  ctx.buf.fill(0);
  ctx.m = [1, 0, 0, 1, 0, 0];
  ctx.stack.length = 0;
  step(1, 16);
  if (name) writePNG(path.join(outDir, name + '.png'), W, H, ctx.buf);
  return analyse(ctx.buf);
}

function analyse(buf) {
  const px = (x, y) => {
    const i = ((y | 0) * W + (x | 0)) * 3;
    return [buf[i], buf[i + 1], buf[i + 2]];
  };
  const region = (x0, y0, x1, y1) => {
    let r = 0, g = 0, b = 0, n = 0, dark = 0, lum = 0;
    for (let y = y0 | 0; y < y1; y += 2) {
      for (let x = x0 | 0; x < x1; x += 2) {
        const c = px(x, y);
        r += c[0]; g += c[1]; b += c[2];
        const L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
        lum += L;
        if (L < 14) dark++;
        n++;
      }
    }
    return { r: r / n, g: g / n, b: b / n, lum: lum / n, dark: dark / n, n };
  };
  const all = region(0, 0, W, H);
  const colors = new Set();
  let edges = 0;
  for (let y = 2; y < H - 2; y += 3) {
    for (let x = 2; x < W - 2; x += 3) {
      const c = px(x, y);
      colors.add(((c[0] >> 3) << 10) | ((c[1] >> 3) << 5) | (c[2] >> 3));
      const d = px(x + 3, y);
      if (Math.abs(c[0] - d[0]) + Math.abs(c[1] - d[1]) + Math.abs(c[2] - d[2]) > 26) edges++;
    }
  }
  return {
    all, colors: colors.size, edges,
    top: region(0, 0, W, H * 0.16),
    bottom: region(0, H * 0.8, W, H),
    centre: region(W * 0.42, H * 0.42, W * 0.58, H * 0.58),
    corner: region(0, 0, W * 0.08, H * 0.10),
    px
  };
}

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ------------------------------------------------------------------ run */
console.log('\n=== visual analysis (offline rasteriser) ===\n');
game.resize();
step(2);

/* --- garage / exterior look --- */
{
  const a = grab('v01_garage');
  if (a.all.lum < 24) bad('garage frame too dark', 'lum=' + a.all.lum.toFixed(1));
  else if (a.colors < 60) bad('garage frame lacks colour variety', 'colors=' + a.colors);
  else if (a.top.lum <= a.bottom.lum) bad('sky is not brighter than the ground',
    'top=' + a.top.lum.toFixed(1) + ' bottom=' + a.bottom.lum.toFixed(1));
  else ok('garage: lum ' + a.all.lum.toFixed(0) + ', ' + a.colors + ' colours, ' +
    a.edges + ' edges, sky ' + a.top.lum.toFixed(0) + ' > ground ' + a.bottom.lum.toFixed(0));
}

/* --- deploy a Sherman and check every view --- */
game.selectTank('sherman');
game.deploy();
const t = game.player;
t.sys.master = true; t.sys.fuelCock = true; t.sys.lights.interior = true;
t.pressStarter();
step(60, 40);
t.setGear(2); t.toggleBrake();

for (const st of ['driver', 'gunner', 'loader', 'commander']) {
  game.setStation(st);
  game.setView('interior');
  step(2, 16);
  const a = grab('v_int_' + st);
  const notes = 'lum=' + a.all.lum.toFixed(0) + ' dark=' + (a.all.dark * 100).toFixed(0) +
    '% colours=' + a.colors + ' edges=' + a.edges;
  if (a.all.dark > 0.55) bad(st + ' interior is mostly empty blackness', notes);
  else if (a.all.lum < 16) bad(st + ' interior is too dark to work in', notes);
  else if (a.colors < 40) bad(st + ' interior looks flat', notes);
  else if (a.edges < 120) bad(st + ' interior has almost no structure', notes);
  else ok(st + ' compartment: ' + notes);
}

/* --- interior lighting responds to the lamp switch --- */
{
  game.setStation('driver'); game.setView('interior'); step(2, 16);
  t.sys.lights.interior = false;
  const off = grab(null);
  t.sys.lights.interior = true;
  const on = grab(null);
  if (on.all.lum <= off.all.lum + 2) {
    bad('compartment lamp does not brighten the interior',
      'off=' + off.all.lum.toFixed(1) + ' on=' + on.all.lum.toFixed(1));
  } else ok('compartment lamp: ' + off.all.lum.toFixed(0) + ' -> ' + on.all.lum.toFixed(0) + ' lum');
}

/* --- the gunner's sight: mask, aperture, reticle --- */
{
  game.setStation('gunner');
  t.sys.breechOpen = true;
  t.loadRound();
  step(200, 40);
  t.sys.safety = false;
  t.sys.turretYaw = 0; t.sys.gunPitch = M.rad(0.6);
  game.setView('sight');
  step(2, 16);
  const a = grab('v_sight_day');
  const cornerDark = a.corner.lum < 18;
  const apertureBright = a.centre.lum > 40;
  if (!cornerDark) bad('sight aperture mask missing', 'corner lum=' + a.corner.lum.toFixed(1));
  else if (!apertureBright) bad('sight picture too dark', 'centre lum=' + a.centre.lum.toFixed(1));
  else ok('day sight: mask ' + a.corner.lum.toFixed(0) + ' / picture ' + a.centre.lum.toFixed(0) +
    ' / ' + a.colors + ' colours');

  // reticle ink: a dark cross should exist right at the centre row/column
  let inkRow = 0;
  for (let x = W * 0.42; x < W * 0.58; x++) {
    const c = a.px(x, H / 2);
    if (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] < a.centre.lum * 0.6) inkRow++;
  }
  if (inkRow < 8) bad('no reticle drawn across the sight centre', 'ink px=' + inkRow);
  else ok('reticle ink present (' + inkRow + ' px across the centre)');

  // thermal channel must repaint the scene
  if (t.spec.optics.thermal) {
    t.sys.sight.mode = 'thermal';
    const th = grab('v_sight_thermal');
    if (dist3([th.centre.r, th.centre.g, th.centre.b], [a.centre.r, a.centre.g, a.centre.b]) < 12) {
      bad('thermal channel looks identical to daylight');
    } else ok('thermal channel repaints the picture');
    t.sys.sight.mode = 'day';
  }
}

/* --- exterior: is the tank actually in front of the camera? --- */
{
  game.setView('exterior');
  step(2, 16);
  const a = grab('v_exterior');
  const p = game.r.project(M.add(t.pos, [0, 1.6, 0]));
  const centred = p.on && Math.abs(p.x - W / 2) < W * 0.2 && Math.abs(p.y - H / 2) < H * 0.3;
  if (!centred) bad('orbit camera is not looking at the tank', 'projected ' + p.x.toFixed(0) + ',' + p.y.toFixed(0));
  else ok('orbit camera frames the tank at ' + p.x.toFixed(0) + ',' + p.y.toFixed(0) +
    ' (screen centre ' + (W / 2) + ',' + (H / 2) + ')');
  const hull = t.spec.colors.hull;
  const c = [a.centre.r, a.centre.g, a.centre.b];
  const sky = [a.top.r, a.top.g, a.top.b];
  if (dist3(c, hull) > dist3(c, sky)) {
    bad('centre of the exterior view does not look like the tank',
      'centre=' + c.map(v => v.toFixed(0)) + ' hull=' + hull.map(v => v | 0));
  } else ok('tank body dominates the centre of frame (centre ' + c.map(v => v | 0).join(',') + ')');
  if (a.top.lum <= a.bottom.lum) bad('exterior sky/ground contrast wrong');
  else ok('exterior: sky ' + a.top.lum.toFixed(0) + ' over ground ' + a.bottom.lum.toFixed(0) +
    ', ' + a.colors + ' colours, ' + a.edges + ' edges');
}

/* --- hatches, muzzle blast and periscope --- */
{
  const before = grab(null);
  t.toggleHatch('commander'); t.toggleHatch('driver'); t.toggleHatch('loader');
  step(50, 40);
  const after = grab('v_hatches_open');
  if (near(before.all.lum, after.all.lum, 0.05) && before.edges === after.edges) {
    bad('opening every hatch changed nothing on screen');
  } else ok('hatches animate (edges ' + before.edges + ' -> ' + after.edges + ')');

  const quiet = grab(null);
  t.sys.loaded = 'AP'; t.sys.safety = false;
  t.fire();
  step(1, 16);
  const blast = grab('v_firing');
  if (blast.all.lum <= quiet.all.lum) {
    bad('firing does not brighten the frame', quiet.all.lum.toFixed(2) + ' -> ' + blast.all.lum.toFixed(2));
  } else ok('muzzle blast lights the scene (' + quiet.all.lum.toFixed(1) + ' -> ' + blast.all.lum.toFixed(1) + ')');

  game.setStation('commander');
  game.setView('periscope');
  step(2, 16);
  const a = grab('v_periscope');
  if (a.corner.lum > 20) bad('periscope mask missing', 'corner=' + a.corner.lum.toFixed(1));
  else if (a.centre.lum < 30) bad('periscope picture too dark', 'centre=' + a.centre.lum.toFixed(1));
  else ok('periscope: slot mask ' + a.corner.lum.toFixed(0) + ' / picture ' + a.centre.lum.toFixed(0));
}

/* --- the other four tanks, interior + exterior --- */
for (const id of ['t34', 'tiger', 't72', 'abrams']) {
  game.returnToGarage();
  game.selectTank(id);
  game.deploy();
  const p = game.player;
  p.sys.master = true; p.sys.fuelCock = true; p.sys.lights.interior = true;
  p.pressStarter(); step(60, 40);
  const gunnerStation = p.spec.stations.includes('gunner') ? 'gunner' : p.spec.stations[0];
  game.setStation(gunnerStation);
  game.setView('interior'); step(2, 16);
  const inA = grab('v_' + id + '_gunner');
  game.setView('exterior'); step(2, 16);
  const exA = grab('v_' + id + '_exterior');
  const problems = [];
  if (inA.all.dark > 0.55) problems.push('interior mostly black (' + (inA.all.dark * 100).toFixed(0) + '%)');
  if (inA.edges < 120) problems.push('interior featureless (' + inA.edges + ' edges)');
  if (exA.top.lum <= exA.bottom.lum) problems.push('exterior sky/ground inverted');
  const c = [exA.centre.r, exA.centre.g, exA.centre.b];
  if (dist3(c, p.spec.colors.hull) > dist3(c, [exA.top.r, exA.top.g, exA.top.b])) {
    problems.push('tank not centred in the exterior view');
  }
  if (problems.length) bad(id + ': ' + problems.join('; '));
  else ok(id.padEnd(7) + ' interior lum ' + inA.all.lum.toFixed(0) + '/edges ' + inA.edges +
    ' · exterior ' + exA.colors + ' colours/edges ' + exA.edges);
}

/* --- are the controls really drawn where the player will click? --- */
{
  const EMPTY = { verts: [], faces: [], c: [0, 0, 0], r: 0.001, min: [0, 0, 0], max: [0, 0, 0] };
  const Int = globalThis.Interiors;
  const realGet = Int.getWidget, realShell = Int.SHELL_MESH;
  const stub = { base: EMPTY, moving: null, pivot: [0, 0, 0], axis: 'x', range: [0, 0], slide: null, needle: 0 };

  for (const id of ['sherman', 't72']) {
    game.returnToGarage();
    game.selectTank(id);
    game.deploy();
    const p = game.player;
    p.sys.master = true; p.sys.fuelCock = true; p.sys.lights.interior = true;
    p.pressStarter(); step(40, 40);
    for (const st of p.spec.stations) {
      game.setStation(st);
      game.setView('interior');
      step(2, 16);
      const withW = grab(null);
      const bufA = ctx.buf.slice();
      // only judge controls that actually land inside the frame at the default view
      const spots = game.projected.filter(q => q.active &&
        q.x >= 4 && q.x < W - 4 && q.y >= 4 && q.y < H - 4);
      Int.getWidget = () => stub;
      Int.SHELL_MESH = EMPTY;
      const withoutW = grab(null);
      const bufB = ctx.buf.slice();
      Int.getWidget = realGet;
      Int.SHELL_MESH = realShell;
      let drawn = 0;
      for (const q of spots) {
        let diff = 0;
        for (let dy = -7; dy <= 7; dy += 2) {
          for (let dx = -7; dx <= 7; dx += 2) {
            const x = Math.round(q.x + dx), y = Math.round(q.y + dy);
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const i = (y * W + x) * 3;
            if (Math.abs(bufA[i] - bufB[i]) + Math.abs(bufA[i + 1] - bufB[i + 1]) +
              Math.abs(bufA[i + 2] - bufB[i + 2]) > 12) diff++;
          }
        }
        if (diff >= 4) drawn++;
      }
      const ratio = spots.length ? drawn / spots.length : 0;
      if (spots.length < 3) bad(id + '/' + st + ': only ' + spots.length + ' controls projected');
      else if (ratio < 0.7) bad(id + '/' + st + ': only ' + drawn + '/' + spots.length +
        ' controls are visibly drawn (rest hidden behind geometry)');
      else ok(id + '/' + st + ': ' + drawn + '/' + spots.length + ' controls drawn where they can be clicked' +
        (withW.all.lum > withoutW.all.lum - 99 ? '' : ''));
    }
  }
}

/* --- the tutorial must visibly point at the control it is asking for --- */
{
  const TUT = globalThis.Tutorial;
  game.returnToGarage();
  game.selectTank('sherman');
  game.deploy();
  const p = game.player;
  p.sys.lights.interior = true;
  game.setStation('driver');
  game.setView('interior');
  step(2, 16);
  grab(null);
  const bufA = ctx.buf.slice();

  // jump the tutorial to the master switch step and find that hotspot on screen
  TUT.start(game);
  let guard = 0;
  while (TUT.active && TUT.current().id !== 'master' && guard++ < 20) TUT.next(game);
  step(2, 16);
  const spot = game.projected.find(q => q.hs.id === 'master');
  grab('v_tutorial_highlight');
  const bufB = ctx.buf.slice();
  if (!spot) {
    bad('tutorial: the master switch never projected');
  } else {
    let diff = 0;
    const R = Math.max(14, spot.r * 1.6);
    for (let dy = -R; dy <= R; dy += 2) {
      for (let dx = -R; dx <= R; dx += 2) {
        const x = Math.round(spot.x + dx), y = Math.round(spot.y + dy);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 3;
        if (Math.abs(bufA[i] - bufB[i]) + Math.abs(bufA[i + 1] - bufB[i + 1]) +
          Math.abs(bufA[i + 2] - bufB[i + 2]) > 20) diff++;
      }
    }
    if (diff < 6) bad('tutorial highlight is not visible on the wanted control', 'changed px=' + diff);
    else ok('tutorial pulses a ring on the wanted control (' + diff + ' px changed)');
  }

  // look away: an edge arrow should appear instead of the ring
  game.look.yaw = 2.0;
  game.look.pitch = 0.5;
  step(2, 16);
  grab('v_tutorial_arrow');
  const withArrow = ctx.buf.slice();
  const onScreen = game.projected.some(q => q.hs.id === 'master' &&
    q.x > 8 && q.x < W - 8 && q.y > 8 && q.y < H - 8);
  if (onScreen) {
    ok('the wanted control is still in view after turning away — no arrow needed');
  } else {
    TUT.stop(game);
    step(2, 16);
    grab(null);
    const without = ctx.buf.slice();
    let d = 0;
    for (let i = 0; i < withArrow.length; i += 3) {
      if (Math.abs(withArrow[i] - without[i]) + Math.abs(withArrow[i + 1] - without[i + 1]) > 24) d++;
    }
    if (d < 20) bad('no off-screen arrow drawn for the tutorial target', 'changed px=' + d);
    else ok('off-screen tutorial target draws a direction arrow (' + d + ' px)');
  }
  game.look.yaw = 0; game.look.pitch = 0;
  if (TUT.active) TUT.stop(game);
}

/* --- Chinese must reach the canvas overlays too --- */
{
  const L = globalThis.L;
  game.setView('sight');
  step(2, 16);
  ctx.texts = 0;
  grab(null);
  const enTexts = ctx.texts;
  L.set('zh');
  ctx.texts = 0;
  grab('v_sight_zh');
  const zhTexts = ctx.texts;
  L.set('en');
  if (enTexts < 4 || zhTexts < 4) bad('sight overlay stopped drawing its data block', 'en=' + enTexts + ' zh=' + zhTexts);
  else ok('sight data block still drawn in both languages (' + enTexts + ' / ' + zhTexts + ' strings)');
}

console.log('\n=== ' + checks + ' visual checks passed, ' + errors + ' problem(s) ===');
console.log('PNGs for eyeballing: tests/out/\n');
process.exit(errors ? 1 : 0);
