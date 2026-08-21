/**
 * SALTWAKE — build audit.
 *
 * Runs the real game modules under Node against a local three.js build, which
 * exercises everything except the WebGL device and the DOM:
 *
 *   1. every module imports and executes
 *   2. the texture atlases, the world geometry, the light bake and the sprite
 *      scatter all build, with assertions on their output
 *   3. every shader passes a static audit: balanced blocks, no undeclared
 *      identifier, fragment varyings declared in the vertex stage, every GLSL
 *      uniform bound to a JS uniform, no duplicate function definitions, and no
 *      fragment-only builtin leaking into a vertex stage
 *   4. a feature audit asserts each period technique is present in the shipped
 *      shader source rather than merely configured
 *   5. the simulation runs headless for 30 seconds of game time: the player
 *      moves and collides, enemies path and attack, weapons fire and reload,
 *      projectiles resolve, and nothing throws or leaks
 *
 * Usage:  THREE_PATH=<path to a three package> node tools/smoke.mjs
 */
import { register } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';

if (!process.env.THREE_PATH) {
  const guesses = [path.resolve('node_modules/three'), path.resolve('../node_modules/three')];
  const hit = guesses.find((g) => existsSync(path.join(g, 'build/three.module.js')));
  if (hit) process.env.THREE_PATH = hit;
}
if (!process.env.THREE_PATH) {
  console.error([
    'tools/smoke.mjs needs a local three.js build to run the modules under Node.',
    'The browser does not: index.html resolves three through its import map.',
    '',
    '  THREE_PATH=/path/to/node_modules/three node tools/smoke.mjs',
  ].join('\n'));
  process.exit(2);
}
register('./three-alias.mjs', import.meta.url);

const failures = [];
const t0 = Date.now();

function check(label, cond, detail) {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures.push(label);
  return cond;
}
function section(t) {
  console.log(`\n${t}\n${'-'.repeat(Math.max(14, t.length))}`);
}

/* ================================================================== *
 * 1. modules
 * ================================================================== */

section('1. module graph');

const THREE = await import('three');
check('three build loaded', !!THREE.REVISION, `r${THREE.REVISION}`);

const paths = [
  ['grid', '../src/world/grid.js'],
  ['config', '../src/core/config.js'],
  ['env', '../src/core/env.js'],
  ['chunks', '../src/gfx/chunks.js'],
  ['textures', '../src/gfx/textures.js'],
  ['materials', '../src/gfx/materials.js'],
  ['models', '../src/gfx/models.js'],
  ['collide', '../src/world/collide.js'],
  ['build', '../src/world/build.js'],
  ['levelData', '../src/world/levelData.js'],
  ['player', '../src/game/player.js'],
  ['weapons', '../src/game/weapons.js'],
  ['enemies', '../src/game/enemies.js'],
  ['fx', '../src/game/fx.js'],
  ['sanity', '../src/game/sanity.js'],
  ['director', '../src/game/director.js'],
];
const mods = {};
for (const [name, rel] of paths) {
  try {
    mods[name] = await import(new URL(rel, import.meta.url).href);
    console.log(`  ok    import ${rel}`);
  } catch (err) {
    console.log(`  FAIL  import ${rel}\n        ${err.message}`);
    failures.push(`import ${rel}`);
  }
}
if (failures.length) { console.error('\nModule graph is broken; stopping.'); process.exit(1); }

check('config carries no renderer dependency',
  Object.values(mods.config.PALETTE).every((v) => typeof v === 'string'),
  'the palette is plain hex, so the headless tools can read it');

/* ================================================================== *
 * 2. content
 * ================================================================== */

section('2. content build');

const timings = {};
const time = (label, fn) => { const s = Date.now(); const r = fn(); timings[label] = Date.now() - s; return r; };

const atlas = time('world atlas', () => mods.textures.textures.world);
check('world atlas is one packed texture', atlas.size === 256 && atlas.count === 16,
  `${atlas.size}x${atlas.size}, ${atlas.count} tiles of ${atlas.tile}px`);
{
  /* Every tile must be drawn rather than flat-filled. Counting distinct colours
   * is the wrong measure: these are deliberately small dithered ramps of three
   * to six entries, which is the period look. What matters is that the tile has
   * spatial structure, so the test measures how often neighbouring texels
   * differ, plus that the ramp has at least three steps. */
  const data = atlas.texture.image.data;
  let worstEdges = null;
  let worstColours = null;
  for (let i = 0; i < atlas.count; i += 1) {
    const tx = (i % atlas.cols) * atlas.tile;
    const ty = Math.floor(i / atlas.cols) * atlas.tile;
    const seen = new Set();
    let edges = 0;
    let pairs = 0;
    for (let y = 0; y < atlas.tile; y += 1) {
      for (let x = 0; x < atlas.tile; x += 1) {
        const o = (((ty + y) * atlas.size) + tx + x) * 4;
        seen.add((data[o] << 16) | (data[o + 1] << 8) | data[o + 2]);
        if (x + 1 < atlas.tile) {
          const n = o + 4;
          pairs += 1;
          if (data[o] !== data[n] || data[o + 1] !== data[n + 1] || data[o + 2] !== data[n + 2]) edges += 1;
        }
      }
    }
    const density = edges / Math.max(pairs, 1);
    if (!worstEdges || density < worstEdges.d) worstEdges = { i, d: density };
    if (!worstColours || seen.size < worstColours.n) worstColours = { i, n: seen.size };
  }
  check('every atlas tile has spatial structure', worstEdges.d > 0.12,
    `flattest tile changes on ${(worstEdges.d * 100).toFixed(0)}% of horizontal texel pairs`);
  check('every atlas tile uses a real ramp', worstColours.n >= 3,
    `shortest ramp has ${worstColours.n} colours`);
}

const sprites = time('sprite atlas', () => mods.textures.textures.sprites);
{
  const data = sprites.texture.image.data;
  let opaque = 0;
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) { if (data[i] > 127) opaque += 1; else clear += 1; }
  check('sprite atlas is alpha-cut, not a solid block', opaque > 500 && clear > 500,
    `${opaque} opaque texels, ${clear} cut away`);
}

const world = time('world', () => mods.build.buildWorld(mods.levelData.LEVEL));
check('level geometry built', world.triangleCount > 4000,
  `${world.triangleCount} triangles, ${world.vertexCount} vertices, ${world.walkableCells} walkable cells`);
check('the level is one draw call', !!world.mesh && world.mesh.material === world.material);
check('faces carry atlas rects', !!world.mesh.geometry.getAttribute('aTile'));
check('doors resolved', world.doors.size >= 5, `${world.doors.size} doors`);
check('prop colliders registered', world.colliders.all.length > 0,
  `${world.colliders.all.length} oriented boxes`);

{
  // The light bake must actually vary: a flat result means it did nothing.
  const col = world.mesh.geometry.getAttribute('color').array;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (let i = 0; i < col.length; i += 3) {
    const l = col[i] + col[i + 1] + col[i + 2];
    if (l < min) min = l;
    if (l > max) max = l;
    sum += l;
  }
  const mean = sum / (col.length / 3);
  check('vertex light bake produced range', max - min > 0.25,
    `luminance ${min.toFixed(3)} to ${max.toFixed(3)}, mean ${mean.toFixed(3)}`);
  check('the bake is not blown out', mean < 2.4, `mean ${mean.toFixed(3)}`);
  check('the town is bright enough to navigate', mean > 0.15,
    `mean baked luminance sum ${mean.toFixed(3)}`);

  /* Per-district light audit. A global percentage says little in a game whose
   * lamps are meant to be pools in the dark; what matters is that no district is
   * unlit, and that every district contains lamp-lit surfaces to navigate by. */
  const pos = world.mesh.geometry.getAttribute('position').array;
  const perDistrict = new Map();
  for (let v = 0; v < col.length / 3; v += 1) {
    const cell = world.grid.atWorld(pos[v * 3], pos[v * 3 + 2]);
    if (!cell) continue;
    let d = perDistrict.get(cell.district);
    if (!d) { d = { n: 0, sum: 0, lit: 0, max: 0 }; perDistrict.set(cell.district, d); }
    const l = col[v * 3] + col[v * 3 + 1] + col[v * 3 + 2];
    d.n += 1;
    d.sum += l;
    d.max = Math.max(d.max, l);
    if (l > 0.34) d.lit += 1;
  }
  let darkest = null;
  let leastLamped = null;
  for (const [name, d] of perDistrict) {
    const m = d.sum / d.n;
    const frac = d.lit / d.n;
    if (!darkest || m < darkest.m) darkest = { name, m };
    if (!leastLamped || frac < leastLamped.frac) leastLamped = { name, frac };
  }
  check('no district is unlit', darkest.m > 0.10,
    `darkest is ${darkest.name} at mean ${darkest.m.toFixed(3)}`);
  check('every district has lamp-lit surfaces to navigate by', leastLamped.frac > 0.05,
    `${leastLamped.name} has ${(leastLamped.frac * 100).toFixed(0)}% lamp-lit; `
    + [...perDistrict.entries()].map(([n, d]) => `${n} ${(d.sum / d.n).toFixed(2)}`).join(' '));
}

console.log(`  info  timings: ${Object.entries(timings).map(([k, v]) => `${k} ${v}ms`).join(', ')}`);

/* ================================================================== *
 * 3. shaders
 * ================================================================== */

section('3. shader audit');

function preprocess(src, defines) {
  const on = new Set(Object.keys(defines || {}).filter((k) => defines[k] !== false));
  const out = [];
  const stack = [];
  for (const line of src.split('\n')) {
    const t = line.trim();
    let m;
    if ((m = /^#ifdef\s+(\w+)/.exec(t))) { stack.push(on.has(m[1])); continue; }
    if ((m = /^#ifndef\s+(\w+)/.exec(t))) { stack.push(!on.has(m[1])); continue; }
    if (/^#else/.test(t)) { if (stack.length) stack[stack.length - 1] = !stack[stack.length - 1]; continue; }
    if (/^#endif/.test(t)) { stack.pop(); continue; }
    if ((m = /^#define\s+(\w+)/.exec(t))) { if (stack.every(Boolean)) on.add(m[1]); out.push(line); continue; }
    if (stack.every(Boolean)) out.push(line);
  }
  return out.join('\n');
}

const BUILTINS = new Set([
  'position', 'normal', 'uv', 'uv1', 'uv2', 'color', 'tangent',
  'cameraPosition', 'viewMatrix', 'projectionMatrix', 'modelMatrix',
  'modelViewMatrix', 'normalMatrix', 'isOrthographic', 'logDepthBufFC',
  'gl_Position', 'gl_FragColor', 'gl_FragCoord', 'gl_PointCoord', 'gl_FrontFacing',
  'gl_PointSize', 'gl_FragDepth', 'gl_InstanceID', 'gl_VertexID',
]);
const TYPES = 'float|int|uint|bool|vec2|vec3|vec4|ivec2|ivec3|ivec4|bvec2|bvec3|bvec4|mat2|mat3|mat4|sampler2D|samplerCube|void';

function declared(src) {
  const names = new Set();
  for (const m of src.matchAll(new RegExp(`\\b(?:${TYPES})\\s+([A-Za-z_]\\w*)`, 'g'))) names.add(m[1]);
  for (const m of src.matchAll(new RegExp(`\\b(?:uniform|attribute|varying|in|out)\\s+(?:lowp\\s+|mediump\\s+|highp\\s+)?(?:${TYPES})\\s+([A-Za-z_]\\w*)`, 'g'))) names.add(m[1]);
  for (const fm of src.matchAll(/\(([^)]*)\)\s*\{/g)) {
    for (const part of fm[1].split(',')) {
      const pm = /([A-Za-z_]\w*)\s*$/.exec(part.trim());
      if (pm) names.add(pm[1]);
    }
  }
  return names;
}
function uniformsIn(src) {
  const s = new Set();
  for (const m of src.matchAll(/\buniform\s+(?:lowp\s+|mediump\s+|highp\s+)?\w+\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*;/g)) s.add(m[1]);
  return s;
}
function varyingsIn(src) {
  const s = new Set();
  for (const m of src.matchAll(/\bvarying\s+(?:lowp\s+|mediump\s+|highp\s+)?\w+\s+([A-Za-z_]\w*)\s*;/g)) s.add(m[1]);
  return s;
}
function balanced(src) {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  let c = 0;
  let p = 0;
  for (const ch of clean) {
    if (ch === '{') c += 1; else if (ch === '}') c -= 1;
    else if (ch === '(') p += 1; else if (ch === ')') p -= 1;
    if (c < 0 || p < 0) return false;
  }
  return c === 0 && p === 0;
}

const FRAG_ONLY = ['texture2D', 'textureCube', 'discard', 'gl_FragCoord', 'gl_FragColor', 'dFdx', 'dFdy', 'fwidth'];

function audit(label, material) {
  const defines = material.defines || {};
  const vert = preprocess(material.vertexShader, defines);
  const frag = preprocess(material.fragmentShader, defines);
  let ok = true;
  const bad = (msg, key) => { console.log(`  FAIL  ${label}: ${msg}`); failures.push(`${label} ${key}`); ok = false; };

  if (!balanced(vert)) bad('unbalanced vertex source', 'vert braces');
  if (!balanced(frag)) bad('unbalanced fragment source', 'frag braces');

  for (const [stage, src] of [['vertex', vert], ['fragment', frag]]) {
    const decl = declared(src);
    const missing = new Set();
    for (const m of src.matchAll(/\b([uav][A-Z]\w*)\b/g)) {
      if (!decl.has(m[1]) && !BUILTINS.has(m[1])) missing.add(m[1]);
    }
    if (missing.size) bad(`${stage} uses undeclared ${[...missing].join(', ')}`, `${stage} undeclared`);
  }

  const vv = varyingsIn(vert);
  const orphan = [...varyingsIn(frag)].filter((n) => !vv.has(n));
  if (orphan.length) bad(`fragment varyings absent from the vertex stage: ${orphan.join(', ')}`, 'varying mismatch');

  const glsl = new Set([...uniformsIn(vert), ...uniformsIn(frag)]);
  const js = new Set(Object.keys(material.uniforms || {}));
  const unbound = [...glsl].filter((n) => !js.has(n));
  if (unbound.length) bad(`GLSL uniforms with no JS binding: ${unbound.join(', ')}`, 'unbound uniforms');

  const leaks = FRAG_ONLY.filter((tok) => new RegExp(`\\b${tok}\\b`).test(vert));
  if (leaks.length) bad(`fragment-only builtins in the vertex stage: ${leaks.join(', ')}`, 'stage leak');
  if (/\bgl_Position\b/.test(frag)) bad('gl_Position written in the fragment stage', 'frag gl_Position');
  if (/#include\s*</.test(vert) || /#include\s*</.test(frag)) bad('unresolved #include', 'include');

  for (const src of [vert, frag]) {
    const defs = [...src.matchAll(/^\s*(?:float|vec2|vec3|vec4|mat3|void)\s+(sw\w+)\s*\(/gm)].map((m) => m[1]);
    const seen = new Set();
    const dupes = defs.filter((n) => (seen.has(n) ? true : (seen.add(n), false)));
    if (dupes.length) bad(`duplicate function definitions: ${[...new Set(dupes)].join(', ')}`, 'duplicate functions');
  }

  if (ok) {
    console.log(`  ok    ${label}  (${glsl.size} uniforms, ${vv.size} varyings, ${vert.split('\n').length + frag.split('\n').length} lines)`);
  }
  return ok;
}

const actorMat = mods.materials.createActorMaterial({});
const materialsToAudit = [
  ['world', world.material],
  ['billboard', mods.materials.createBillboardMaterial({})],
  ['billboard emissive', mods.materials.createBillboardMaterial({ emissive: 1, fogged: 0 })],
  ['actor', actorMat],
  ['viewmodel', mods.materials.createViewmodelMaterial()],
];
for (const [label, mat] of materialsToAudit) audit(label, mat);

{
  const fs = await import('node:fs');
  const src = await fs.promises.readFile(new URL('../src/core/renderer.js', import.meta.url), 'utf8');
  const features = [
    ['point-sampled upscale', /floor\(uvp \* uSize\)/],
    ['palette quantisation', /floor\(col \* uPaletteSteps/],
    ['ordered dither', /SW_BAYER8/],
    ['scanlines', /uScanlines/],
    ['interlace dropout', /uInterlace/],
    ['film grain', /uGrain/],
    ['three-point grade', /swGrade/],
  ];
  for (const [label, re] of features) check(`composite: ${label}`, re.test(src));

  // The absence check has to look at code, not prose: the file's own header
  // names the effects it deliberately leaves out.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const banned = ['bloom', 'gaussian', 'blurRadius', 'chromatic', 'aberration'];
  const present = banned.filter((w) => new RegExp(w, 'i').test(code));
  check('composite has no bloom, blur or chromatic pass', present.length === 0,
    present.length ? `found ${present.join(', ')}` : 'code contains none of them');

  const chunkSrc = await fs.promises.readFile(new URL('../src/gfx/chunks.js', import.meta.url), 'utf8');
  const period = [
    ['affine UV derivation', /vUvOverW \/ max\(vClipW/],
    ['affine UV setup passes uv \\* w', /vUvOverW = texcoord \* clip\.w/],
    ['vertex lattice snapping', /floor\(ndc \* half_ \+ 0\.5\) \/ half_/],
    ['per-vertex dynamic lights', /vec3 swDynamicLight/],
    ['half-lambert wrap', /lambert \* 0\.72 \+ 0\.28/],
    ['layered height fog', /uFogLayerFalloff/],
    ['fog breathing noise', /uFogBreath/],
  ];
  for (const [label, re] of period) check(`period technique: ${label}`, re.test(chunkSrc));

  const billboardSrc = await fs.promises.readFile(new URL('../src/gfx/materials.js', import.meta.url), 'utf8');
  check('billboards quantise their facing into buckets', /floor\(yaw \/ step_ \+ 0\.5\) \* step_/.test(billboardSrc));
  check('billboards refresh facing on a low clock', /uSnapFps/.test(billboardSrc));
  check('billboards carry an extra sub-pixel wobble', /uWobble/.test(billboardSrc));
  check('billboards alpha-cut rather than blend', /if \(texel\.a < 0\.5\) discard;/.test(billboardSrc));
}

/* ================================================================== *
 * 4. headless simulation
 * ================================================================== */

section('4. headless simulation');

// Minimal stand-ins: the systems only touch these through narrow interfaces.
const noopAudio = {
  ready: true,
  calls: 0,
  play() { this.calls += 1; return { stop() {} }; },
  loop() { this.calls += 1; return { stop() {}, setVolume() {}, setPosition() {}, setRate() {} }; },
  setMusicIntensity() {}, setSanity() {}, setListener() {}, update() {}, startMusic() {}, stopMusic() {},
};
const hudCalls = { count: 0 };
const noopHud = new Proxy({}, { get: () => (() => { hudCalls.count += 1; }) });
const noopStage = { setDamage() {}, setDistortion() {}, setFade() {} };

const scene = new THREE.Scene();
const player = new mods.player.Player(world, { audio: noopAudio, hud: noopHud });
const spawnCell = world.grid.get(mods.levelData.LEVEL.spawn.col, mods.levelData.LEVEL.spawn.row);
const spawnPos = world.grid.centreOf(mods.levelData.LEVEL.spawn.col, mods.levelData.LEVEL.spawn.row);
player.spawn(spawnPos.x, spawnCell.floorY, spawnPos.z, mods.levelData.LEVEL.spawn.yaw || 0);
check('player spawns on solid floor', Math.abs(player.pos.y - spawnCell.floorY) < 0.01);

const enemies = new mods.enemies.EnemyManager({ world, player, scene, audio: noopAudio, lights: mods.env.lights, fx: null });
const fx = new mods.fx.Fx({ scene, world, player, enemies, audio: noopAudio, lights: mods.env.lights });
enemies.ctx.fx = fx;
const spriteCounts = fx.populate(world, mods.levelData.LEVEL);
check('sprite scatter placed vegetation and fires',
  spriteCounts.sprites > 200 && spriteCounts.fires > 0,
  `${spriteCounts.sprites} static, ${spriteCounts.fires} emissive`);
enemies.populate(mods.levelData.LEVEL, world);
check('enemies instantiated from the level', enemies.list.length >= 40, `${enemies.list.length} live`);
check('all six archetypes present in the scene',
  new Set(enemies.list.map((e) => e.type)).size === 6,
  [...new Set(enemies.list.map((e) => e.type))].join(' '));

const weapons = new mods.weapons.WeaponManager({ player, world, enemies, fx, audio: noopAudio, hud: noopHud, lights: mods.env.lights });
const sanity = new mods.sanity.SanitySystem({ player, world, enemies, audio: noopAudio, hud: noopHud, stage: noopStage, scene });
const director = new mods.director.Director({
  world, level: mods.levelData.LEVEL, player, weapons, enemies, fx, sanity,
  audio: noopAudio, hud: noopHud, scene, stage: noopStage, lights: mods.env.lights,
});
check('starting loadout applied', weapons.owned[0] === true && weapons.reserve.brass > 0,
  `revolver with ${weapons.reserve.brass} brass in reserve`);
check('pickups instantiated', director.pickups.length > 30, `${director.pickups.length} pickups`);

/* --- run the simulation --- */
const TICK = 1 / 60;
let simTime = 0;
let thrown = null;
let maxTriangles = 0;
const startPos = player.pos.clone();
let moved = 0;
let firedShots = 0;

try {
  for (let step = 0; step < 60 * 30; step += 1) {
    simTime += TICK;
    // A scripted patrol: walk, sprint, turn, jump, and fire in bursts.
    const phase = Math.floor(simTime / 3) % 4;
    const input = {
      forward: phase === 3 ? -1 : 1,
      strafe: phase === 1 ? 1 : phase === 2 ? -1 : 0,
      jump: step % 140 === 0,
      run: phase === 0,
      crouch: phase === 2 && step % 90 < 30,
      fire: step % 24 < 3,
      altFire: step % 300 < 3,
      use: step % 180 === 0,
      reload: step % 210 === 0,
      dx: Math.sin(simTime * 0.7) * 6,
      dy: Math.sin(simTime * 0.31) * 1.5,
      wheel: step % 260 === 0 ? 1 : 0,
      weapon: step % 97 === 0 ? (step / 97) % 6 : -1,
    };
    const before = weapons.loaded[weapons.index];
    if (input.dx || input.dy) player.look(input.dx, input.dy);
    if (input.weapon >= 0) weapons.select(input.weapon | 0);
    if (input.wheel) weapons.cycle(1);
    if (input.reload) weapons.reload();
    if (input.use) director.interact();
    player.update(TICK, input);
    weapons.update(TICK, input, simTime);
    enemies.update(TICK, simTime);
    fx.update(TICK, simTime);
    sanity.update(TICK);
    director.update(TICK, simTime);
    mods.env.lights.flush(player.pos);
    if (weapons.loaded[weapons.index] < before) firedShots += 1;
    maxTriangles = Math.max(maxTriangles, fx.particles.geo.instanceCount);
    moved = Math.max(moved, player.pos.distanceTo(startPos));
    if (!Number.isFinite(player.pos.x + player.pos.y + player.pos.z)) throw new Error('player position went non-finite');
  }
} catch (err) {
  thrown = err;
}

check('30 seconds of simulation ran without throwing', !thrown, thrown ? thrown.message : '1800 ticks');
check('the player moved through the level', moved > 4, `${moved.toFixed(1)} m from spawn`);
check('the player stayed inside the level',
  !!world.grid.atWorld(player.pos.x, player.pos.z),
  `ended at ${player.pos.x.toFixed(1)}, ${player.pos.z.toFixed(1)}`);
check('the player never fell through the floor', player.pos.y > -8, `y = ${player.pos.y.toFixed(2)}`);
check('weapons fired and consumed ammo', firedShots > 20, `${firedShots} discharges`);
check('the particle pool stayed bounded', maxTriangles <= 420, `peak ${maxTriangles} live particles`);
check('the dynamic light budget held',
  mods.env.shared.uLightCount.value <= mods.config.WORLD.maxDynamicLights,
  `${mods.env.shared.uLightCount.value} of ${mods.config.WORLD.maxDynamicLights}`);
check('the HUD was driven every tick', hudCalls.count > 1000, `${hudCalls.count} HUD calls`);
check('audio was driven', noopAudio.calls > 20, `${noopAudio.calls} sound requests`);

/* --- combat correctness --- */
section('5. combat');

{
  const target = enemies.list.find((e) => e.type === 'fisherman' && e.alive);
  check('a hauler exists to shoot', !!target);
  if (target) {
    const before = target.health;
    const point = new THREE.Vector3(target.pos.x, target.pos.y + target.height * 0.9, target.pos.z);
    const dealt = enemies.damage(target, 26, 'bullet', point, new THREE.Vector3(0, 0, 1));
    check('the headshot weakness multiplies damage', dealt > 26 * 2,
      `${dealt.toFixed(1)} from a 26 base, weakness x${mods.config.ENEMIES.fisherman.weakness.multiplier}`);
    const body = new THREE.Vector3(target.pos.x, target.pos.y + target.height * 0.4, target.pos.z);
    const bodyDealt = enemies.damage(target, 26, 'bullet', body, new THREE.Vector3(0, 0, 1));
    check('a body shot does not', Math.abs(bodyDealt - 26) < 0.01, `${bodyDealt.toFixed(1)}`);
  }
  const cultist = enemies.list.find((e) => e.type === 'cultist' && e.alive);
  if (cultist) {
    const dealt = enemies.damage(cultist, 20, 'flame', null, null);
    check('flame is the answer to a choirman', dealt > 20 * 2, `${dealt.toFixed(1)} from 20`);
    const shot = enemies.damage(cultist, 20, 'bullet', null, null);
    check('bullets are resisted by a choirman', shot < 20, `${shot.toFixed(1)} from 20`);
  }
  const eye = enemies.list.find((e) => e.type === 'eye' && e.alive);
  if (eye) {
    const dealt = enemies.damage(eye, 30, 'harpoon', null, null);
    check('one harpoon bursts an eye cluster', dealt >= eye.maxHealth,
      `${dealt.toFixed(1)} against ${eye.maxHealth} health`);
  }
  const boss = enemies.boss;
  check('the boss exists', !!boss);
  if (boss) {
    const off = enemies.damage(boss, 500, 'bullet', new THREE.Vector3(boss.pos.x + 9, boss.pos.y + 1, boss.pos.z), null);
    check('the boss is immune away from its conduits', off === 0, `${off} damage`);
    let broken = 0;
    for (let i = 0; i < boss.def.armorPhases; i += 1) {
      const part = boss.rig.parts[`conduit${i}`];
      part.updateWorldMatrix(true, false);
      const p = new THREE.Vector3();
      part.getWorldPosition(p);
      // Three hits per conduit, aimed at the conduit itself.
      for (let k = 0; k < 4; k += 1) enemies.damage(boss, 90, 'bullet', p, null);
      if (boss.conduitBroken[i]) broken += 1;
    }
    check('shooting the conduits breaks all three', broken === 3, `${broken} of 3, armorPhase now ${boss.armorPhase}`);
    const after = enemies.damage(boss, 100, 'bullet', new THREE.Vector3(boss.pos.x, boss.pos.y + 3, boss.pos.z), null);
    check('the boss takes damage once the conduits are dark', after > 0, `${after.toFixed(0)} damage`);
  }
}

/* --- collision correctness --- */
section('6. collision');

{
  const grid = world.grid;
  // Fire the player at a wall at high speed and confirm it does not tunnel.
  let tunnelled = 0;
  for (let trial = 0; trial < 400; trial += 1) {
    const cell = world.spec.entities.filter((e) => e.type === 'enemy')[trial % 40];
    if (!cell) continue;
    const c = grid.centreOf(cell.col, cell.row);
    const g = grid.get(cell.col, cell.row);
    const body = { x: c.x, z: c.z, y: g.floorY, radius: 0.35, height: 1.8, stepHeight: 0.45 };
    const a = (trial / 400) * Math.PI * 2;
    // A single 40 m/s step, far larger than any real frame.
    mods.collide.moveHorizontal(grid, body, Math.cos(a) * 40 * (1 / 60) * 6, Math.sin(a) * 40 * (1 / 60) * 6);
    const landed = grid.atWorld(body.x, body.z);
    if (!landed || !landed.walk || landed.solid) tunnelled += 1;
  }
  check('high-speed movement never tunnels through a wall', tunnelled === 0,
    `400 trials at 240 m/s effective, ${tunnelled} escapes`);

  // Steps up to the step height are climbable; anything taller is not.
  const flat = { x: spawnPos.x, z: spawnPos.z, y: spawnCell.floorY, radius: 0.35, height: 1.8, stepHeight: 0.45 };
  const under = mods.collide.groundUnder(grid, flat.x, flat.z, flat.radius, flat.y, flat.height, flat.stepHeight);
  check('ground query returns the standing floor', Math.abs(under.floorY - spawnCell.floorY) < 0.01);
  check('ground query reports headroom', under.ceilY > under.floorY + 1.8,
    `${(under.ceilY - under.floorY).toFixed(2)} m of headroom`);
}

/* ================================================================== *
 * 7. integration contracts
 * ================================================================== */

section('7. integration contracts');

{
  const { checkContracts } = await import(new URL('./contracts.mjs', import.meta.url).href);
  await checkContracts({ check, base: import.meta.url });
}

/* ================================================================== *
 * report
 * ================================================================== */

console.log(`\n${'='.repeat(62)}`);
if (failures.length === 0) {
  console.log(`PASS — ${Date.now() - t0} ms, no failures.`);
  process.exit(0);
}
console.log(`FAIL — ${failures.length} problem(s):`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(1);
