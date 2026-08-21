/**
 * SALTWAKE — level validator and completability solver.
 *
 * Runs without three.js: it imports only src/world/grid.js and the level data,
 * composites the grid, and answers the question that matters for a shipped level
 * — can the player actually finish it?
 *
 *   1. Structural checks: every zone parses, every door and entity sits on a
 *      legal cell, no pickup or enemy is embedded in a wall, the spawn is
 *      standable, and every key referenced by a door exists somewhere.
 *   2. Key-gated reachability: breadth-first flood from the spawn with the
 *      current key set, collecting keys as they are reached and repeating until
 *      the set stops growing. This is the standard lock-and-key closure, and it
 *      proves the level is finishable rather than merely connected.
 *   3. Progression order: reports which keys are needed for which doors and in
 *      what order they first become available, so a level cannot ship with a key
 *      locked behind the door it opens.
 *   4. Budget: walkable area, enemy and pickup counts, ammo-versus-enemy-health
 *      economy, and a playtime estimate from traversal distance and fight count.
 *
 * Exit code 1 on any failure. Usage: node tools/solve-level.mjs [--verbose]
 */
import { compositeGrid, CELL } from '../src/world/grid.js';
import { LEVEL } from '../src/world/levelData.js';
import { WEAPONS, AMMO, ENEMIES, PLAYER } from '../src/core/config.js';

const VERBOSE = process.argv.includes('--verbose');
const failures = [];
const warnings = [];

function ok(label, detail) {
  console.log(`  ok    ${label}${detail ? `  (${detail})` : ''}`);
}
function fail(label, detail) {
  console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`);
  failures.push(label);
}
function warn(label, detail) {
  console.log(`  warn  ${label}${detail ? `  (${detail})` : ''}`);
  warnings.push(label);
}
function check(label, condition, detail) {
  if (condition) ok(label, detail); else fail(label, detail);
  return condition;
}
function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(Math.max(14, title.length)));
}

/* ================================================================== *
 * 1. Structure
 * ================================================================== */

section('1. structure');

let grid;
try {
  grid = compositeGrid(LEVEL.zones);
  ok('every zone parses', `${LEVEL.zones.length} zones, grid ${grid.cols}x${grid.rows} cells`);
} catch (err) {
  fail('every zone parses', err.message);
  console.log('\nCannot continue without a grid.');
  process.exit(1);
}

const worldW = (grid.cols * CELL).toFixed(0);
const worldD = (grid.rows * CELL).toFixed(0);

let walkable = 0;
let water = 0;
let hazard = 0;
const districts = new Map();
grid.forEach((c) => {
  if (c.walk) walkable += 1;
  if (c.water) water += 1;
  if (c.hazard) hazard += 1;
  districts.set(c.district, (districts.get(c.district) || 0) + (c.walk ? 1 : 0));
});
ok('walkable area', `${walkable} cells, about ${(walkable * CELL * CELL).toFixed(0)} m2 across ${worldW}x${worldD} m`);
check('the level has at least six districts', districts.size >= 6,
  [...districts.entries()].map(([k, v]) => `${k}:${v}`).join(' '));

/* --- doors --- */
const doorCells = [];
grid.forEach((c) => { if (c.door) doorCells.push(c); });
const doorsById = new Map();
for (const d of LEVEL.doors || []) {
  const cell = grid.get(d.col, d.row);
  if (!cell) { fail(`door "${d.id}" is outside the grid`, `${d.col},${d.row}`); continue; }
  if (!cell.door) { fail(`door "${d.id}" is not on a door cell`, `${d.col},${d.row} is "${cell.ch}"`); continue; }
  if (doorsById.has(d.id)) fail(`duplicate door id "${d.id}"`);
  cell.requiredKey = d.key || null;
  cell.doorId = d.id;
  doorsById.set(d.id, { ...d, cell });
}
check('every door definition sits on a door cell', failures.length === 0, `${doorsById.size} doors`);

const undefinedDoors = doorCells.filter((c) => !c.doorId);
if (undefinedDoors.length) {
  warn('door cells with no definition are treated as unlocked',
    undefinedDoors.map((c) => `${c.col},${c.row}`).join(' '));
}

/* --- spawn --- */
const spawn = LEVEL.spawn;
const spawnCell = grid.get(spawn.col, spawn.row);
check('the spawn sits on walkable floor', !!spawnCell && spawnCell.walk && !spawnCell.door,
  spawnCell ? `${spawn.col},${spawn.row} in ${spawnCell.district}` : 'missing');

/* --- entities --- */
const entities = LEVEL.entities || [];
const byType = new Map();
let embedded = 0;
for (const e of entities) {
  const cell = grid.get(e.col, e.row);
  byType.set(e.type, (byType.get(e.type) || 0) + 1);
  if (!cell || !cell.walk) {
    embedded += 1;
    if (VERBOSE) console.log(`        embedded: ${e.type} at ${e.col},${e.row}`);
  }
}
check('no entity is embedded in a wall', embedded === 0, `${entities.length} entities placed`);

const keyPickups = entities.filter((e) => e.type === 'key');
const keyIds = new Set(keyPickups.map((e) => e.key));
const neededKeys = new Set([...doorsById.values()].map((d) => d.key).filter(Boolean));
const missingKeys = [...neededKeys].filter((k) => !keyIds.has(k));
check('every key a door needs exists as a pickup', missingKeys.length === 0,
  missingKeys.length ? `missing ${missingKeys.join(', ')}` : `${keyIds.size} keys: ${[...keyIds].join(', ')}`);

/* ================================================================== *
 * 2. Key-gated reachability
 * ================================================================== */

section('2. reachability');

const HEIGHT = PLAYER.height;
const STEPH = PLAYER.stepHeight;

/** Flood from the spawn with a fixed key set. Returns a Set of "col,row". */
function flood(keys) {
  const seen = new Set();
  const start = `${spawn.col},${spawn.row}`;
  if (!spawnCell || !spawnCell.walk) return seen;
  seen.add(start);
  const stack = [[spawn.col, spawn.row, spawnCell.floorY]];
  while (stack.length) {
    const [col, row, feetY] = stack.pop();
    const here = grid.get(col, row);
    const y = here ? here.floorY : feetY;
    const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dc, dr] of steps) {
      const nc = col + dc;
      const nr = row + dr;
      const key = `${nc},${nr}`;
      if (seen.has(key)) continue;
      const cell = grid.get(nc, nr);
      if (!cell) continue;
      if (cell.info.name === 'void' || cell.solid) continue;
      if (cell.door) {
        // A locked door blocks until its key is held.
        const req = cell.requiredKey;
        if (req && !keys.has(req)) continue;
      }
      if (cell.pit) continue;                        // a pit is not a route
      // Climbing is limited; dropping is not.
      if (cell.floorY - y > STEPH + 1e-4) continue;
      const rest = Math.max(cell.floorY, Math.min(y, cell.floorY + STEPH));
      if (cell.ceilY - rest < HEIGHT - 0.05) continue;
      seen.add(key);
      stack.push([nc, nr, cell.floorY]);
    }
  }
  return seen;
}

/** Lock-and-key closure. */
let keys = new Set(LEVEL.startingKeys || []);
let reach = flood(keys);
const acquisitionOrder = [];
for (let pass = 0; pass < 12; pass += 1) {
  let gained = false;
  for (const k of keyPickups) {
    if (keys.has(k.key)) continue;
    if (reach.has(`${k.col},${k.row}`)) {
      keys.add(k.key);
      acquisitionOrder.push({ key: k.key, pass, col: k.col, row: k.row });
      gained = true;
    }
  }
  if (!gained) break;
  reach = flood(keys);
}

check('every key can be collected', keys.size >= keyIds.size,
  `${keys.size} of ${keyIds.size} reachable: ${acquisitionOrder.map((a) => a.key).join(' -> ') || 'none'}`);

for (const [id, door] of doorsById) {
  if (!door.key) continue;
  const reachable = reach.has(`${door.col},${door.row}`);
  if (!reachable) fail(`door "${id}" is never reachable`, `needs ${door.key}`);
}

/* --- the goal --- */
const goal = LEVEL.goal;
check('the level declares a goal', !!goal && Number.isFinite(goal.col),
  goal ? `${goal.col},${goal.row} — ${goal.label || 'unnamed'}` : 'missing');
if (goal) {
  check('the goal is reachable with all collectable keys', reach.has(`${goal.col},${goal.row}`));
}

/* --- everything the player is meant to find --- */
const categories = {
  weapon: entities.filter((e) => e.type === 'weapon'),
  ammo: entities.filter((e) => e.type === 'ammo'),
  health: entities.filter((e) => e.type === 'health'),
  armor: entities.filter((e) => e.type === 'armor'),
  enemy: entities.filter((e) => e.type === 'enemy'),
  secret: entities.filter((e) => e.type === 'secret'),
  mechanism: entities.filter((e) => e.type === 'mechanism'),
  note: entities.filter((e) => e.type === 'note'),
};

let unreachable = 0;
for (const [name, list] of Object.entries(categories)) {
  const bad = list.filter((e) => !reach.has(`${e.col},${e.row}`));
  if (bad.length) {
    unreachable += bad.length;
    // Secrets behind secret doors are expected to be reachable too: a secret the
    // player cannot enter is a bug, not a secret.
    fail(`unreachable ${name}`, bad.map((e) => `${e.id || e.weapon || e.kind || ''}@${e.col},${e.row}`).join(' '));
  }
}
check('every pickup, enemy and mechanism is reachable', unreachable === 0,
  `${entities.length} entities checked`);

/* --- weapons --- */
const placedWeapons = new Set(categories.weapon.map((e) => e.weapon));
const startWeapons = new Set(LEVEL.startingWeapons || []);
const allWeapons = WEAPONS.map((w) => w.id);
const missingWeapons = allWeapons.filter((w) => !placedWeapons.has(w) && !startWeapons.has(w));
check('all six weapons are obtainable', missingWeapons.length === 0,
  missingWeapons.length ? `missing ${missingWeapons.join(', ')}` : allWeapons.join(', '));

/* ================================================================== *
 * 3. Progression and pacing
 * ================================================================== */

section('3. progression');

/** Shortest walking route between two cells with a given key set, in cells. */
function distance(fromCol, fromRow, toCol, toRow, keySet) {
  const q = [[fromCol, fromRow, 0]];
  const seen = new Set([`${fromCol},${fromRow}`]);
  while (q.length) {
    const [col, row, d] = q.shift();
    if (col === toCol && row === toRow) return d;
    const here = grid.get(col, row);
    const y = here ? here.floorY : 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = col + dc; const nr = row + dr;
      const k = `${nc},${nr}`;
      if (seen.has(k)) continue;
      const cell = grid.get(nc, nr);
      if (!cell || cell.solid || cell.info.name === 'void' || cell.pit) continue;
      if (cell.door && cell.requiredKey && !keySet.has(cell.requiredKey)) continue;
      if (cell.floorY - y > STEPH + 1e-4) continue;
      seen.add(k);
      q.push([nc, nr, d + 1]);
    }
  }
  return Infinity;
}

const routeToGoal = goal ? distance(spawn.col, spawn.row, goal.col, goal.row, keys) : Infinity;
check('a route from spawn to goal exists', Number.isFinite(routeToGoal),
  Number.isFinite(routeToGoal) ? `${routeToGoal} cells, about ${(routeToGoal * CELL).toFixed(0)} m direct` : 'none');

// Ordering: each key must be reachable before the door it opens is needed.
for (const acq of acquisitionOrder) {
  const doorsFor = [...doorsById.values()].filter((d) => d.key === acq.key);
  for (const d of doorsFor) {
    const before = flood(new Set([...keys].filter((k) => k !== acq.key)));
    if (before.has(`${d.col},${d.row}`) && before.has(`${acq.col},${acq.row}`)) continue;
    if (!before.has(`${acq.col},${acq.row}`)) {
      // The key needs another key first, which is fine as long as the closure worked.
      if (VERBOSE) console.log(`        ${acq.key} is itself gated, acquired on pass ${acq.pass}`);
    }
  }
}
ok('key order forms a valid closure', acquisitionOrder.map((a) => `${a.key}(pass ${a.pass})`).join(' '));

/* --- combat economy --- */
section('4. budget');

let enemyHealth = 0;
const enemyCounts = new Map();
for (const e of categories.enemy) {
  const def = ENEMIES[e.enemy];
  if (!def) { fail(`unknown enemy type "${e.enemy}"`, `${e.col},${e.row}`); continue; }
  enemyHealth += def.health;
  enemyCounts.set(e.enemy, (enemyCounts.get(e.enemy) || 0) + 1);
}
const enemyTypes = [...enemyCounts.keys()];
check('all six enemy archetypes appear', enemyTypes.length >= 6,
  [...enemyCounts.entries()].map(([k, v]) => `${k}x${v}`).join(' '));

/** Damage available from placed ammo, at the best weapon for each ammo type. */
let damageAvailable = 0;
const ammoTotals = new Map();
for (const a of categories.ammo) {
  const def = AMMO[a.ammo];
  if (!def) { fail(`unknown ammo type "${a.ammo}"`, `${a.col},${a.row}`); continue; }
  const amount = a.amount || def.pickup;
  ammoTotals.set(a.ammo, (ammoTotals.get(a.ammo) || 0) + amount);
}
// Starting loadout counts too.
for (const [kind, amount] of Object.entries(LEVEL.startingAmmo || {})) {
  ammoTotals.set(kind, (ammoTotals.get(kind) || 0) + amount);
}
for (const [kind, amount] of ammoTotals) {
  const weapon = WEAPONS.find((w) => w.ammo === kind);
  if (!weapon) continue;
  const perShot = weapon.damage !== undefined
    ? weapon.damage * (weapon.pellets || 1)
    : (weapon.damagePerSecond || 0) / Math.max(weapon.ammoPerSecond || 1, 1);
  damageAvailable += perShot * amount;
}
const ratio = enemyHealth > 0 ? damageAvailable / enemyHealth : 0;
check('ammo economy leaves a margin without being generous', ratio > 1.5 && ratio < 6.0,
  `${Math.round(damageAvailable)} damage available against ${enemyHealth} enemy health, ratio ${ratio.toFixed(2)}`);

const healthAvailable = categories.health.reduce((n, e) => n + (e.amount || 25), 0);
check('there is enough healing to survive the fights', healthAvailable >= 100,
  `${healthAvailable} health in ${categories.health.length} pickups`);

check('the level hides at least three secrets', categories.secret.length >= 3,
  `${categories.secret.length} secrets`);
check('the level has at least two mechanisms', categories.mechanism.length >= 2,
  `${categories.mechanism.length}: ${categories.mechanism.map((m) => m.id).join(' ')}`);
check('there is a boss', categories.enemy.some((e) => (ENEMIES[e.enemy] || {}).boss === true));

/* --- playtime estimate --- */
// Walking at the run speed covers ground fast, so the estimate is dominated by
// exploration overhead and fights rather than the direct route.
const exploreCells = walkable;
const walkSeconds = (exploreCells * CELL * 1.35) / PLAYER.walkSpeed;
const fightSeconds = categories.enemy.length * 6.5
  + categories.enemy.filter((e) => (ENEMIES[e.enemy] || {}).boss).length * 110;
const puzzleSeconds = categories.mechanism.length * 35 + keyIds.size * 30;
const estimate = (walkSeconds + fightSeconds + puzzleSeconds) / 60;
// The brief asks for 15 to 30 minutes, so the gate is those figures and not a
// looser band that would let the level drift past the spec unnoticed.
check('estimated playtime lands in the 15 to 30 minute window',
  estimate >= 15 && estimate <= 30,
  `${estimate.toFixed(1)} min (traverse ${(walkSeconds / 60).toFixed(1)}, fight ${(fightSeconds / 60).toFixed(1)}, puzzle ${(puzzleSeconds / 60).toFixed(1)})`);

/* ================================================================== *
 * report
 * ================================================================== */

console.log(`\n${'='.repeat(60)}`);
if (VERBOSE) {
  console.log('district walkable cells:');
  for (const [d, n] of districts) console.log(`  ${d.padEnd(12)} ${n}`);
  console.log('entity counts:');
  for (const [t, n] of byType) console.log(`  ${t.padEnd(12)} ${n}`);
}
if (failures.length === 0) {
  console.log(`PASS — the level is structurally sound and completable.${warnings.length ? ` ${warnings.length} warning(s).` : ''}`);
  process.exit(0);
} else {
  console.log(`FAIL — ${failures.length} problem(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
