/* ==========================================================================
 * tests/render_png.js — offline visual check.
 *
 * Implements a tiny Canvas2D-compatible rasteriser (scanline polygon fill,
 * linear/radial gradients, strokes) plus a PNG writer, so the real renderer
 * can be pointed at a buffer and the result inspected as an image.
 *
 *   node tests/render_png.js            -> writes tests/out/*.png
 * ==========================================================================*/
'use strict';
const fs = require('fs');
const path = require('path');
const { Ctx2D, writePNG } = require('./raster.js');

/* ---------------------------------------------------------------- harness */
const W = 900, H = 560;
require('./smoke_stub.js');
const view = globalThis.document.getElementById('view');
const ctx = new Ctx2D(W, H);
view.getContext = () => ctx;
view.width = W; view.height = H;
view.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H });
globalThis.innerWidth = W;
globalThis.innerHeight = H;
globalThis.devicePixelRatio = 1;

const JS = p => require(path.join(__dirname, '..', 'js', p));
JS('math3d.js'); JS('i18n.js'); JS('mesh.js'); JS('renderer.js'); JS('tanks.js');
JS('interiors.js'); JS('sim.js'); JS('world.js'); JS('audio.js'); JS('tutorial.js'); JS('ui.js'); JS('main.js');

const game = globalThis.game;
const raf = globalThis.__raf;
const M = globalThis.M;
function step(n, dt) {
  for (let i = 0; i < n; i++) {
    const fn = raf.shift();
    if (!fn) throw new Error('no frame');
    fn(game.last + (dt || 16));
  }
}
const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });
function shot(name) {
  ctx.buf.fill(0);
  ctx.m = [1, 0, 0, 1, 0, 0];
  ctx.stack.length = 0;
  step(1, 16);
  const f = path.join(outDir, name + '.png');
  writePNG(f, W, H, ctx.buf);
  console.log('  ' + name.padEnd(26) + ' faces=' + String(game.r.stats.faces).padStart(5) +
    '  labels=' + ctx.texts + '  -> tests/out/' + name + '.png');
  ctx.texts = 0;
}

console.log('\nrendering reference frames…');
game.resize();
step(2);
shot('01_garage_sherman');
game.selectTank('t72');
step(2);
shot('02_garage_t72');

game.selectTank('sherman');
game.deploy();
const t = game.player;
t.sys.master = true; t.sys.fuelCock = true; t.sys.lights.interior = true;
t.pressStarter();
step(50, 40);
t.setGear(2); t.toggleBrake();

game.setStation('driver'); game.setView('interior'); step(2, 16);
shot('03_sherman_driver');
game.setStation('gunner'); game.setView('interior'); step(2, 16);
shot('04_sherman_gunner');
game.setStation('loader'); game.setView('interior'); step(2, 16);
shot('05_sherman_loader');
game.setStation('commander'); game.setView('interior'); step(2, 16);
shot('06_sherman_commander');

game.setStation('gunner');
t.sys.breechOpen = true; t.loadRound();
step(200, 40);
t.sys.safety = false;
t.sys.turretYaw = 0.02;
t.sys.gunPitch = M.rad(1.2);
game.setView('sight'); step(2, 16);
shot('07_sherman_sight');
game.setView('periscope'); step(2, 16);
shot('08_sherman_periscope');
game.setView('unbutton'); step(2, 16);
shot('09_sherman_unbutton');
game.setView('exterior'); step(2, 16);
shot('10_sherman_exterior');
t.toggleHatch('commander'); t.toggleHatch('driver'); t.toggleHatch('loader');
step(40, 40);
shot('11_sherman_hatches_open');
t.fire();
step(2, 16);
shot('12_sherman_firing');

game.returnToGarage();
game.selectTank('t72');
game.deploy();
const t2 = game.player;
t2.sys.master = true; t2.sys.fuelCock = true; t2.sys.lights.interior = true;
t2.pressStarter(); step(50, 40);
game.setStation('gunner'); game.setView('interior'); step(2, 16);
shot('13_t72_gunner');
game.setStation('driver'); game.setView('interior'); step(2, 16);
shot('14_t72_driver');
t2.sys.sight.mode = 'thermal';
t2.sys.turretYaw = 0.4;
game.setStation('gunner'); game.setView('sight'); step(2, 16);
shot('15_t72_thermal_sight');

game.returnToGarage();
game.selectTank('abrams');
game.deploy();
const t3 = game.player;
t3.sys.master = true; t3.sys.fuelCock = true; t3.sys.lights.interior = true;
t3.pressStarter(); step(50, 40);
game.setStation('loader'); game.setView('interior'); step(2, 16);
shot('16_abrams_loader');
game.setStation('commander'); game.setView('interior'); step(2, 16);
shot('17_abrams_commander');
game.setView('exterior'); step(2, 16);
shot('18_abrams_exterior');

game.returnToGarage();
game.selectTank('tiger');
game.deploy();
const t4 = game.player;
t4.sys.master = true; t4.sys.fuelCock = true; t4.sys.lights.interior = true;
t4.pressStarter(); step(50, 40);
game.setStation('gunner'); game.setView('interior'); step(2, 16);
shot('19_tiger_gunner');
game.setView('exterior'); step(2, 16);
shot('20_tiger_exterior');
console.log('done\n');

