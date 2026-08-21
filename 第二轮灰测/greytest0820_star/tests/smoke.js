/* ==========================================================================
 * tests/smoke.js — headless verification.
 *
 * Stubs just enough DOM/canvas for the real game code to boot in node, then:
 *   - builds every tank model + interior
 *   - deploys each tank and renders frames in every view and crew station
 *   - operates EVERY interior hotspot (act / act2 / text / val)
 *   - drives, loads, fires and resolves hits against range targets
 * Any thrown error is reported with its hotspot / view context.
 *
 * run:  node tests/smoke.js
 * ==========================================================================*/
'use strict';
const path = require('path');
require('./smoke_stub.js');       // minimal DOM + canvas so the game can boot

const raf = globalThis.__raf;

/* ------------------------------------------------------- load the game */
const JS = p => require(path.join(__dirname, '..', 'js', p));
JS('math3d.js'); JS('i18n.js'); JS('mesh.js'); JS('renderer.js'); JS('tanks.js');
JS('interiors.js'); JS('sim.js'); JS('world.js'); JS('audio.js'); JS('tutorial.js'); JS('ui.js');
JS('main.js');

const game = globalThis.game;
const M = globalThis.M;
const L = globalThis.L;
const TUT = globalThis.Tutorial;
L.set('en');                      // the assertions below read English strings
let errors = 0, checks = 0;
const fail = (what, e) => {
  errors++;
  console.error('  ✗ ' + what + '  ->  ' + (e && e.message ? e.message : e));
  if (errors < 4 && e && e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));
};
const ok = (what) => { checks++; console.log('  ✓ ' + what); };

function step(n, dt) {
  for (let i = 0; i < n; i++) {
    const fn = raf.shift();
    if (!fn) throw new Error('no animation frame scheduled');
    fn(game.last + (dt || 16));
  }
}

console.log('\n=== armour smoke test ===\n');

/* 1. boot + garage */
try {
  if (!game) throw new Error('game did not boot');
  step(3);
  ok('boot + garage frames render');
} catch (e) { fail('boot', e); }

/* 2. models + interiors for every tank */
for (const spec of globalThis.TANKS) {
  try {
    const m = globalThis.getTankModel(spec);
    const it = globalThis.Interiors.get(spec);
    const faces = m.hull.faces.length + m.turret.faces.length + m.gun.faces.length;
    const ifaces = it.hull.faces.length + it.turret.faces.length;
    let hs = 0;
    for (const k in it.stations) hs += it.stations[k].hotspots.length;
    if (!m.hull.faces.length || !m.turret.faces.length) throw new Error('empty mesh');
    if (!Object.keys(it.stations).length) throw new Error('no stations');
    if (spec.stations.length !== Object.keys(it.stations).length) throw new Error('station list mismatch');
    ok(spec.short.padEnd(9) + ' model ' + String(faces).padStart(5) + ' faces · interior ' +
      String(ifaces).padStart(4) + ' faces · ' + hs + ' controls · ' +
      Object.keys(it.stations).join('/'));
  } catch (e) { fail(spec.id + ' build', e); }
}

/* 3. per tank: deploy, all stations, all views, every control */
const VIEWS = ['interior', 'sight', 'periscope', 'unbutton', 'exterior'];
for (const spec of globalThis.TANKS) {
  console.log('\n--- ' + spec.name + ' ---');
  try {
    game.selectTank(spec.id);
    game.deploy();
    const t = game.player;
    t.sys.master = true; t.sys.fuelCock = true;
    t.pressStarter();
    step(40, 40);                          // let the engine catch and settle
    if (!t.sys.engineOn) throw new Error('engine failed to start');
    ok('engine start (' + Math.round(t.sys.rpm) + ' rpm)');

    // drive it
    game.keys['w'] = true; game.keys['d'] = true;
    t.setGear(2); t.toggleBrake();
    step(60, 20);
    game.keys['w'] = false; game.keys['d'] = false;
    if (!(Math.abs(t.speed) > 0.5)) throw new Error('tank did not move (speed ' + t.speed.toFixed(2) + ')');
    ok('drives: ' + t.speedKmh().toFixed(1) + ' km/h, heading ' + M.deg(t.yaw).toFixed(0) + '°');

    // views x stations
    let maxFaces = 0;
    for (const st of spec.stations) {
      game.setStation(st);
      for (const v of VIEWS) {
        game.setView(v);
        step(2, 16);
        maxFaces = Math.max(maxFaces, game.r.stats.faces);
      }
    }
    ok('all ' + spec.stations.length + ' stations × ' + VIEWS.length +
      ' views render (peak ' + maxFaces + ' faces/frame)');

    // each crew station must actually SEE and REACH its own controls
    const seen = [];
    for (const st of spec.stations) {
      game.setStation(st);
      game.setView('interior');
      step(2, 16);
      const eye = t.stationEye(st);
      let vis = 0, reach = 0, onScreen = 0;
      for (const p of game.projected) {
        if (!p.active) continue;
        vis++;
        const d = M.dist(eye, p.world);
        if (d <= 2.3) reach++;
        if (p.x > -40 && p.x < game.r.w + 40 && p.y > -40 && p.y < game.r.h + 40) onScreen++;
      }
      // the station's eye should sit inside its own compartment shell
      const box = t.interior.stations[st].parent === 'turret' ? t.interior.turret : t.interior.hull;
      const e = t.interior.stations[st].eye;
      const inside = e[0] > box.min[0] - 0.1 && e[0] < box.max[0] + 0.1 &&
        e[1] > box.min[1] - 0.1 && e[1] < box.max[1] + 0.1 &&
        e[2] > box.min[2] - 0.1 && e[2] < box.max[2] + 0.1;
      if (!inside) fail(spec.id + '/' + st, new Error('eye point is outside the compartment shell'));
      if (reach < 3) fail(spec.id + '/' + st, new Error('only ' + reach + ' controls within arm\'s reach'));
      if (onScreen < 3) fail(spec.id + '/' + st, new Error('only ' + onScreen + ' controls in the default field of view'));
      seen.push(st + ': ' + onScreen + ' seen/' + reach + ' in reach');
    }
    ok('crew ergonomics — ' + seen.join(', '));

    // end to end interaction: aim the cursor at a control and click it
    {
      game.setStation(spec.stations[0]);
      game.setView('interior');
      step(2, 16);
      const spot = game.projected.find(q => q.hs.id === 'master');
      if (!spot) fail(spec.id + ' click path', new Error('master switch never projected'));
      else {
        game.mouse.x = spot.x; game.mouse.y = spot.y;
        step(1, 16);                       // update() picks from the last projection
        if (!game.mouse.hot || game.mouse.hot.hs.id !== 'master') {
          fail(spec.id + ' click path', new Error('cursor over the master switch picked ' +
            (game.mouse.hot ? game.mouse.hot.hs.id : 'nothing')));
        } else {
          const before = t.sys.master;
          game.click(1);
          if (t.sys.master === before) fail(spec.id + ' click path', new Error('click did not throw the switch'));
          else ok('click path: cursor → hotspot → master switch ' + (t.sys.master ? 'ON' : 'OFF'));
          t.sys.master = true;
        }
      }
    }

    // every hotspot: read + operate
    let n = 0;
    for (const sid in t.interior.stations) {
      const station = t.interior.stations[sid];
      game.setStation(sid);
      for (const hs of station.hotspots) {
        n++;
        const where = spec.id + '/' + sid + '/' + hs.id;
        try { if (hs.text) hs.text(t, game); } catch (e) { fail(where + ' .text()', e); }
        try { if (hs.val) { const v = hs.val(t); if (typeof v !== 'number' || !isFinite(v)) throw new Error('val() = ' + v); } }
        catch (e) { fail(where + ' .val()', e); }
        try { if (hs.act) hs.act(t, game); } catch (e) { fail(where + ' .act()', e); }
        try { if (hs.act2) hs.act2(t, game); } catch (e) { fail(where + ' .act2()', e); }
        if (!hs.label) fail(where, new Error('missing label'));
      }
    }
    ok(n + ' controls operated');

    // gunnery: put the vehicle back in a sane state after all that switch flipping
    game.setStation(spec.stations.includes('gunner') ? 'gunner' : spec.stations[0]);
    game.setView('sight');
    t.sys.master = true; t.sys.fuelCock = true; t.sys.engineOn = true;
    t.sys.turretPower = true; t.sys.traverseMode = 'power';
    t.selectShell(Object.keys(spec.shells)[0]);
    t.sys.safety = false;
    t.sys.loaded = null; t.sys.loadT = 0; t.sys.breechOpen = true;
    const msg = t.loadRound();
    step(Math.ceil(spec.gun.reload / 0.04) + 6, 40);
    if (!t.sys.loaded) throw new Error('loading failed: ' + msg + ' (loadT ' + t.sys.loadT + ')');
    ok('loaded ' + t.sys.loaded + ' in ' + spec.gun.reload + ' s' +
      (spec.autoloader ? ' (autoloader)' : ' (loader)'));

    const before = t.sys.shots;
    t.fire();
    if (t.sys.shots !== before + 1) throw new Error('shot counter did not advance');
    if (!game.world.shells.list.length) throw new Error('no projectile spawned');
    ok('fired: ' + game.world.shells.list.length + ' projectile(s) in flight');

    // aim a shell straight at the nearest target and confirm the hit path
    const tgt = game.world.targets[0];
    tgt.hp = 1; tgt.dead = false;
    const from = M.add(tgt.pos, [0, 1.2, -40]);
    game.world.shells.spawn({
      pos: from, vel: [0, 0, 900], shell: { pen: 900, dmg: 900, name: 'test' },
      type: 'APFSDS', owner: t
    });
    const kills = t.sys.kills;
    step(30, 20);
    if (!tgt.dead) throw new Error('direct shot did not kill the target');
    ok('hit resolution + kill scoring (' + t.sys.kills + ' kill' + (t.sys.kills === 1 ? '' : 's') + ')');

    // a few hundred frames of everything at once
    game.setView('exterior');
    game.keys['w'] = true; game.keys['e'] = true;
    step(120, 16);
    game.keys['w'] = false; game.keys['e'] = false;
    ok('sustained run: turret at ' + M.deg(t.sys.turretYaw).toFixed(0) + '°, ' +
      game.world.fx.list.length + ' particles alive');
  } catch (e) { fail(spec.id + ' mission', e); }
}

/* 4. keyboard sweep: every documented binding must be handled cleanly */
console.log('\n--- keyboard ---');
try {
  game.selectTank('abrams');
  game.deploy();
  const t = game.player;
  t.sys.master = true; t.sys.fuelCock = true; t.sys.engineOn = true;
  const keys = ['v', '1', '2', '3', '4', 'm', 'n', 'i', 'p', 'Shift', 'Control', 'b', 'g', 'k',
    'z', 'l', 'y', 't', 'x', 'c', 'h', 'o', '[', ']', ' ', 'w', 'a', 's', 'd', 'q', 'e', 'r', 'f',
    'W', '?', 'F1', 'Escape', 'Tab', 'ArrowUp', 'F9', '§'];
  const ev = k => ({ key: k, preventDefault() { }, stopPropagation() { } });
  for (const k of keys) {
    game.onKey(ev(k), true);
    game.onKey(ev(k), false);
    if (game.mode !== 'play') { game.mode = 'play'; }   // Tab / Escape open the garage
    step(1, 16);
  }
  ok(keys.length + ' key bindings exercised, all views survived');
  if (!game.player) throw new Error('player lost during the key sweep');
} catch (e) { fail('keyboard', e); }

/* 5. edge cases */
console.log('\n--- edge cases ---');
try {
  const t = game.player;
  t.sys.engineOn = false;
  t.sys.master = false;
  const r1 = t.pressStarter();
  if (!/master/i.test(r1)) throw new Error('starter allowed without master power: ' + r1);
  t.sys.master = true; t.sys.fuelCock = false;
  const r2 = t.pressStarter();
  if (!/fuel/i.test(r2)) throw new Error('starter allowed with the fuel cock shut: ' + r2);
  t.sys.fuelCock = true;
  t.sys.loaded = null; t.sys.safety = true;
  const r3 = t.fire();
  if (!/empty|load/i.test(r3)) throw new Error('empty gun fired: ' + r3);
  t.sys.loaded = 'AP';
  const r4 = t.fire();
  if (!/safe/i.test(r4)) throw new Error('fired with the circuit safe: ' + r4);
  ok('interlocks hold (no power / no fuel / empty gun / safety)');

  for (const k in t.sys.ammo) t.sys.ammo[k] = 0;
  t.sys.loaded = null; t.sys.breechOpen = true;
  t.sys.loadT = 0; t.sys.pendingShell = null;
  const r5 = t.loadRound();
  if (!/out of/i.test(r5)) throw new Error('loaded from an empty rack: ' + r5);
  ok('empty racks refuse to load');

  t.pos[0] = 5000; t.pos[2] = -5000;
  step(4, 16);
  if (Math.abs(t.pos[0]) > game.world.bound || Math.abs(t.pos[2]) > game.world.bound) {
    throw new Error('position not clamped to the map');
  }
  ok('map bounds clamp');

  game.resize();
  globalThis.innerWidth = 420; globalThis.innerHeight = 300;
  game.resize();
  step(3, 16);
  ok('resize to 420x300 keeps rendering');
} catch (e) { fail('edge cases', e); }

/* 6. bilingual coverage: every player-visible literal needs a translation */
console.log('\n--- i18n ---');
try {
  const zh = L.dict('zh');
  const cjk = /[\u4e00-\u9fff]/;
  const missing = [];
  for (const spec of globalThis.TANKS) {
    const it = globalThis.Interiors.get(spec);
    if (!zh[spec.cls]) missing.push('class:' + spec.cls);
    if (!zh[spec.nation]) missing.push('nation:' + spec.nation);
    if (!zh[spec.desc]) missing.push('desc:' + spec.id);
    for (const n of spec.notes) if (!zh[n]) missing.push('note:' + n);
    for (const sid in it.stations) {
      const st = it.stations[sid];
      if (!zh[st.name]) missing.push('station:' + st.name);
      if (st.role && !zh[st.role]) missing.push('role:' + st.role);
      for (const hs of st.hotspots) {
        if (!zh[hs.label]) missing.push(spec.id + '/' + hs.label);
        if (hs.hint && !zh[hs.hint]) missing.push(spec.id + '/hint:' + hs.hint);
      }
    }
  }
  if (missing.length) {
    fail('translation coverage', new Error(missing.length + ' untranslated: ' + missing.slice(0, 8).join(' | ')));
  } else {
    ok('every control label, crew role, class, description and note has a Chinese translation');
  }

  // switching language must change what the player reads, everywhere
  L.set('zh');
  const t = game.player;
  const zhLabel = L.s('Master Battery Switch');
  const zhMsg = t.toggleMaster();
  const zhStatus = globalThis.Interiors.Ctrl ? null : null;
  const zhHatch = t.toggleHatch('driver');
  const zhLoad = t.loadRound();
  const bad2 = [];
  if (!cjk.test(zhLabel)) bad2.push('label');
  if (!cjk.test(zhMsg)) bad2.push('sim message');
  if (!cjk.test(zhHatch)) bad2.push('hatch message');
  if (zhLoad && !cjk.test(zhLoad)) bad2.push('load message');
  if (!cjk.test(L.s('DRIVETRAIN'))) bad2.push('HUD title');
  if (!cjk.test(L.shell('APFSDS'))) bad2.push('shell name');
  // hotspot status text must localise too
  let statusZh = null;
  for (const sid in t.interior.stations) {
    for (const hs of t.interior.stations[sid].hotspots) {
      if (hs.id === 'starter' && hs.text) statusZh = hs.text(t, game);
    }
  }
  if (statusZh && !cjk.test(statusZh)) bad2.push('control status');
  if (bad2.length) fail('language switch', new Error('still English: ' + bad2.join(', ')));
  else ok('switching to 中文 localises labels, statuses, HUD titles and log messages');

  // the HUD must survive a language switch mid-mission
  globalThis.UI.applyLang();
  game.setStation(t.spec.stations[0]);
  game.setView('interior');
  step(3, 16);
  globalThis.UI.update(game);
  ok('HUD + garage repaint in 中文 without error');
  L.set('en');
  globalThis.UI.applyLang();
  step(2, 16);
  if (!/Master battery/i.test(t.toggleMaster())) throw new Error('switching back to English failed');
  ok('switching back to English works');
} catch (e) { fail('i18n', e); }

/* 7. the tutorial has to be completable by doing what it asks */
console.log('\n--- tutorial ---');
try {
  game.selectTank('sherman');
  game.deploy();
  const t = game.player;
  TUT.start(game);
  if (!TUT.active || TUT.idx !== 0) throw new Error('tutorial did not start');
  // every highlighted control must exist in this tank
  const ids = new Set();
  for (const sid in t.interior.stations) {
    for (const hs of t.interior.stations[sid].hotspots) ids.add(hs.id);
  }
  const ghosts = [];
  for (const s of TUT.steps) {
    for (const h of (s.highlight || [])) if (!ids.has(h)) ghosts.push(s.id + '->' + h);
  }
  // 'autoloader' only exists on autoloading tanks, 'ram' only on the others
  const allowed = new Set(['load->autoloader', 'range->lrf']);
  const realGhosts = ghosts.filter(g => !allowed.has(g));
  if (realGhosts.length) fail('tutorial highlights', new Error(realGhosts.join(', ')));
  else ok(TUT.steps.length + ' steps, every highlighted control exists in the vehicle');

  // now actually play through it
  const doStep = {
    look: () => { game.look.yaw = 0.4; },
    stations: () => game.setStation('gunner'),
    'back-to-driver': () => game.setStation('driver'),
    master: () => { t.sys.master = true; },
    fuel: () => { t.sys.fuelCock = true; },
    start: () => { t.pressStarter(); step(60, 40); },
    brake: () => { t.sys.parkBrake = false; },
    gear: () => t.setGear(2),
    drive: () => { game.keys['w'] = true; step(300, 30); game.keys['w'] = false; },
    gunner: () => game.setStation('gunner'),
    breech: () => { t.sys.breechOpen = true; },
    load: () => { t.loadRound(); step(Math.ceil(t.spec.gun.reload / 0.04) + 8, 40); },
    arm: () => { t.sys.safety = false; },
    sight: () => game.setView('sight'),
    range: () => t.adjustRange(200),
    fire: () => { t.sys.loaded = t.sys.shell; t.sys.safety = false; t.fire(); },
    hit: () => { t.sys.hits++; },
    commander: () => { game.setStation('commander'); t.sys.hatches.commander = 1; game.setView('unbutton'); }
  };
  let guard = 0;
  const visited = [];
  while (TUT.active && !TUT.current().final && guard++ < 40) {
    const s = TUT.current();
    visited.push(s.id);
    const act = doStep[s.id];
    if (!act) throw new Error('no test action for tutorial step "' + s.id + '"');
    act();
    step(3, 30);
    if (TUT.current() === s) throw new Error('step "' + s.id + '" did not accept the action');
  }
  if (!TUT.current() || !TUT.current().final) throw new Error('tutorial never reached the final step');
  ok('played through ' + visited.length + ' steps: ' + visited.slice(0, 6).join(' → ') + ' → …');
  // the panel text must exist in both languages
  L.set('zh');
  const zhTitle = TUT.title(), zhText = TUT.text(game);
  L.set('en');
  const enTitle = TUT.title();
  if (!/[\u4e00-\u9fff]/.test(zhTitle) || !/[\u4e00-\u9fff]/.test(zhText)) {
    throw new Error('tutorial text is not translated');
  }
  if (zhTitle === enTitle) throw new Error('tutorial title did not change with the language');
  ok('tutorial panel is bilingual (' + enTitle + ' / ' + zhTitle + ')');
  TUT.next(game);
  if (TUT.active) throw new Error('finishing the last step should close the tutorial');
  ok('finishing the last step closes the tutorial');

  // the step list adapts to the vehicle
  game.returnToGarage();
  game.selectTank('t72');
  game.deploy();
  TUT.start(game);
  const t72ids = TUT.steps.map(s => s.id);
  if (t72ids.indexOf('breech') >= 0) throw new Error('autoloader tank still asks to open the breech');
  TUT.idx = t72ids.indexOf('load');
  if (!/autoloader|装弹机/i.test(TUT.text(game))) throw new Error('autoloader tank uses the manual loading text');
  TUT.idx = t72ids.indexOf('range');
  if (!/lase|测距/i.test(TUT.text(game))) throw new Error('LRF tank does not mention lasing');
  TUT.stop(game);
  game.returnToGarage();
  game.selectTank('tiger');
  game.deploy();
  TUT.start(game);
  TUT.idx = TUT.steps.map(s => s.id).indexOf('range');
  if (!/drum|鼓轮/i.test(TUT.text(game))) throw new Error('a tank without an LRF should teach the range drum');
  TUT.stop(game);
  ok('steps adapt per vehicle: autoloader skips the breech, no-LRF tanks teach the range drum');
} catch (e) { fail('tutorial', e); }

console.log('\n=== ' + checks + ' checks passed, ' + errors + ' error(s) ===\n');
process.exit(errors ? 1 : 0);
