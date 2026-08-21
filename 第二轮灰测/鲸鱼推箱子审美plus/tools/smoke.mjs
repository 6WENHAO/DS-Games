/**
 * Build verification.
 *
 * Runs the real application modules under Node against a local three.js build,
 * which exercises everything except the WebGL device:
 *
 *   1. every module imports and executes
 *   2. the sky radiance map, terrain, trees, props and meadow all build, with
 *      sane counts and timings
 *   3. every shader passes a static check: balanced blocks, no undeclared
 *      u/a/v identifier, fragment varyings declared in the vertex stage, and
 *      every GLSL uniform present in the material's JS uniform block
 *   4. the puzzle rules reach a solved state from the recorded solutions, with
 *      the push counts the level solver reported
 *
 * Usage:  THREE_PATH=<path to a three package> node tools/smoke.mjs
 */
import { register } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ setup */

if (!process.env.THREE_PATH) {
  const guesses = [
    path.resolve('node_modules/three'),
    path.resolve('../node_modules/three'),
  ];
  const hit = guesses.find((g) => existsSync(path.join(g, 'build/three.module.js')));
  if (hit) process.env.THREE_PATH = hit;
}
if (!process.env.THREE_PATH) {
  console.error([
    'tools/smoke.mjs needs a local three.js build to run the modules under Node.',
    'The browser does not: index.html resolves three through its import map.',
    '',
    'Set THREE_PATH to a three package directory, for example:',
    '  THREE_PATH=/path/to/node_modules/three node tools/smoke.mjs',
  ].join('\n'));
  process.exit(2);
}

register('./three-alias.mjs', import.meta.url);

const failures = [];
const notes = [];
const t0 = Date.now();

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${label}${detail ? `  (${detail})` : ''}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`);
    failures.push(label);
  }
  return condition;
}

function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(Math.max(12, title.length)));
}

/* ------------------------------------------------------------------ 1. imports */

section('1. module graph');

const THREE = await import('three');
check('three build loaded', typeof THREE.REVISION === 'string' || typeof THREE.REVISION === 'number', `r${THREE.REVISION}`);

const mods = {};
const modulePaths = [
  ['config', '../src/core/config.js'],
  ['env', '../src/core/env.js'],
  ['cameraRig', '../src/core/cameraRig.js'],
  ['renderer', '../src/core/renderer.js'],
  ['chunks', '../src/gfx/shaderChunks.js'],
  ['textures', '../src/gfx/textures.js'],
  ['sky', '../src/gfx/sky.js'],
  ['grassMaterial', '../src/gfx/grassMaterial.js'],
  ['groundMaterial', '../src/gfx/groundMaterial.js'],
  ['toonMaterial', '../src/gfx/toonMaterial.js'],
  ['noise', '../src/world/noise.js'],
  ['plot', '../src/world/plot.js'],
  ['pathMod', '../src/world/path.js'],
  ['geoBuilder', '../src/world/geoBuilder.js'],
  ['terrain', '../src/world/terrain.js'],
  ['grass', '../src/world/grass.js'],
  ['trees', '../src/world/trees.js'],
  ['props', '../src/world/props.js'],
  ['levels', '../src/game/levels.js'],
  ['sokoban', '../src/game/sokoban.js'],
  ['whale', '../src/game/whale.js'],
  ['crate', '../src/game/crate.js'],
  ['play', '../src/game/play.js'],
];

for (const [name, rel] of modulePaths) {
  try {
    mods[name] = await import(new URL(rel, import.meta.url).href);
    console.log(`  ok    import ${rel}`);
  } catch (err) {
    console.log(`  FAIL  import ${rel}\n        ${err.message}`);
    failures.push(`import ${rel}`);
  }
}
if (failures.length) {
  console.error('\nModule graph is broken; stopping here.');
  process.exit(1);
}

/* ------------------------------------------------------------------ 2. world */

section('2. world build');

const timings = {};
const time = (label, fn) => {
  const s = Date.now();
  const out = fn();
  timings[label] = Date.now() - s;
  return out;
};

const sky = time('sky', () => mods.sky.generateStylizedHdri({ width: 256, height: 128 }));
check('sky radiance map', sky.image.width === 256 && sky.image.data.length === 256 * 128 * 4);
check('sky ships as filterable half float', sky.type === THREE.HalfFloatType);
const skyRadiance = mods.sky.readRadiance(sky);
let maxRadiance = 0;
for (let i = 0; i < skyRadiance.data.length; i += 3) {
  if (skyRadiance.data[i] > maxRadiance) maxRadiance = skyRadiance.data[i];
}
check('sun core exceeds 1.0 (true HDR)', maxRadiance > 10, `peak red = ${maxRadiance.toFixed(1)}`);

const probe = time('probe', () => mods.sky.buildIrradianceProbe(sky, { width: 32, height: 16, passes: 6 }));
const probeRadiance = mods.sky.readRadiance(probe);
let probeSum = 0;
for (let i = 0; i < probeRadiance.data.length; i += 3) probeSum += probeRadiance.data[i];
check('irradiance probe carries light', probeSum > 0, `mean red = ${(probeSum / (32 * 16)).toFixed(3)}`);
check('probe is dimmer than the raw sun (blurred)',
  probeSum / (32 * 16) < maxRadiance, 'probe averages the sky, not the disc');

const blade = time('blade atlas', () => mods.textures.createBladeAtlas());
check('blade atlas size', blade.image.width === mods.config.GRASS.spriteW * mods.textures.textures.variantCount
  && blade.image.height === mods.config.GRASS.spriteH,
  `${blade.image.width}x${blade.image.height}`);
let profileMonotone = true;
{
  const w = blade.image.width;
  const sw = mods.config.GRASS.spriteW;
  const sh = mods.config.GRASS.spriteH;
  // grass variants taper: alpha at the base must exceed alpha at the tip
  for (const v of mods.textures.BLADE_VARIANT_INDEX.grass) {
    const base = blade.image.data[((0 * w) + v * sw) * 4 + 3];
    const tip = blade.image.data[(((sh - 1) * w) + v * sw) * 4 + 3];
    if (!(base > tip + 20)) profileMonotone = false;
  }
}
check('blade silhouette profile tapers', profileMonotone);

const terrain = time('terrain', () => mods.terrain.createTerrain());
check('terrain mesh built', !!terrain.mesh && terrain.mesh.geometry.getAttribute('position').count > 10000,
  `${terrain.mesh.geometry.getAttribute('position').count} verts`);
check('terrain has road/plot masks',
  !!terrain.mesh.geometry.getAttribute('aPath') && !!terrain.mesh.geometry.getAttribute('aLawn'));

{
  // The plot must be genuinely level and the terrain genuinely undulating.
  const { PLOT } = mods.plot;
  let minH = Infinity;
  let maxH = -Infinity;
  for (let u = -PLOT.halfW + 1; u <= PLOT.halfW - 1; u += 2) {
    for (let v = -PLOT.halfD + 1; v <= PLOT.halfD - 1; v += 2) {
      const p = PLOT.toWorld(u, v, new THREE.Vector3());
      const h = terrain.heightAt(p.x, p.z);
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
    }
  }
  check('puzzle plot is level', maxH - minH < 0.02, `spread ${(maxH - minH).toFixed(4)} m`);

  let wMin = Infinity;
  let wMax = -Infinity;
  for (let x = -70; x <= 70; x += 5) {
    for (let z = -70; z <= 70; z += 5) {
      const h = terrain.heightAt(x, z);
      wMin = Math.min(wMin, h);
      wMax = Math.max(wMax, h);
    }
  }
  check('terrain undulates', wMax - wMin > 8, `relief ${(wMax - wMin).toFixed(1)} m`);
}

{
  // The road must stay clear of the plot, or the level would sit on gravel.
  const { PLOT } = mods.plot;
  let closest = Infinity;
  for (const p of terrain.road.points) {
    closest = Math.min(closest, PLOT.edgeDistance(p.x, p.z));
  }
  check('road clears the plot', closest > 1.5, `nearest approach ${closest.toFixed(2)} m outside the kerb`);

  let onRoadCount = 0;
  for (let i = 0; i < terrain.road.points.length; i += 17) {
    const p = terrain.road.points[i];
    if (terrain.pathMaskAt(p.x, p.z) > 0.9) onRoadCount += 1;
  }
  check('road mask follows the spline', onRoadCount > 50, `${onRoadCount} sampled centre points masked`);
}

const trees = time('trees', () => mods.trees.composeLandscape(terrain, mods.config.CAMERAS));
check('trees placed', trees.count > 60, `${trees.count} plants`);
check('tree mesh has sway attributes',
  !!trees.mesh && !!trees.mesh.geometry.getAttribute('aSway') && !!trees.mesh.geometry.getAttribute('aOrigin'));
check('canopy shade query responds', trees.shadeQuery(trees.shadeCircles[0].x, trees.shadeCircles[0].z) > 0.1);

const props = time('props', () => mods.props.createProps(terrain));
check('props built', !!props.mesh && props.mesh.geometry.getAttribute('position').count > 3000,
  `${props.mesh.geometry.getAttribute('position').count} verts`);

terrain.applyShade([...trees.shadeCircles, ...props.shadeCircles]);
{
  const shade = terrain.mesh.geometry.getAttribute('aShade').array;
  let shaded = 0;
  for (let i = 0; i < shade.length; i += 1) if (shade[i] > 0.05) shaded += 1;
  check('contact shade baked into the ground', shaded > 500, `${shaded} vertices darkened`);
}

const budget = mods.config.GRASS.counts.medium;
const meadow = time('meadow', () => mods.grass.createMeadow(terrain, {
  count: budget,
  focals: [
    { x: mods.config.CAMERAS.menu.target.x, z: mods.config.CAMERAS.menu.target.z, inner: 30, outer: 74 },
    { x: mods.plot.PLOT.center.x, z: mods.plot.PLOT.center.z, inner: 26, outer: 66 },
  ],
  shadeQuery: trees.shadeQuery,
}));
check('meadow blade count near budget',
  meadow.count > budget * 0.6 && meadow.count < budget * 1.4,
  `${meadow.count} blades for a ${budget} budget`);
check('meadow is one instanced draw',
  meadow.mesh.geometry.isInstancedBufferGeometry === true
  && meadow.mesh.geometry.instanceCount === meadow.count);
check('blade normals point up', (() => {
  const n = meadow.mesh.geometry.getAttribute('normal');
  for (let i = 0; i < n.count; i += 1) if (n.getY(i) !== 1) return false;
  return true;
})());
{
  // No blade may sit on the packed road surface.
  const base = meadow.mesh.geometry.getAttribute('aBase');
  let onRoad = 0;
  let floating = 0;
  for (let i = 0; i < base.count; i += Math.max(1, Math.floor(base.count / 4000))) {
    const x = base.getX(i);
    const y = base.getY(i);
    const z = base.getZ(i);
    if (terrain.pathMaskAt(x, z) > 0.8) onRoad += 1;
    if (Math.abs(y - terrain.heightAt(x, z)) > 0.55) floating += 1;
  }
  check('grass keeps off the road', onRoad === 0, `${onRoad} blades on the centre line`);
  check('grass roots sit on the ground', floating === 0, `${floating} blades detached`);
}

const hedge = mods.grass.createHedgeField(
  [{ x: mods.plot.PLOT.center.x, z: mods.plot.PLOT.center.z, size: 2 }], terrain, { density: 20 },
);
check('hedge field builds', !!hedge && hedge.geometry.instanceCount === 20);

console.log(`  info  build timings: ${Object.entries(timings).map(([k, v]) => `${k} ${v}ms`).join(', ')}`);

/* ------------------------------------------------------------------ 3. shaders */

section('3. shader static analysis');

/** Minimal #ifdef/#ifndef/#else/#endif/#define resolver. */
function preprocess(source, defines) {
  const defined = new Set(Object.keys(defines || {}).filter((k) => defines[k] !== false));
  const out = [];
  const stack = [];
  const active = () => stack.every((s) => s.taking);
  for (const line of source.split('\n')) {
    const t = line.trim();
    let m;
    if ((m = /^#ifdef\s+(\w+)/.exec(t))) { stack.push({ taking: defined.has(m[1]), seenElse: false }); continue; }
    if ((m = /^#ifndef\s+(\w+)/.exec(t))) { stack.push({ taking: !defined.has(m[1]), seenElse: false }); continue; }
    if (/^#else/.test(t)) { const s = stack[stack.length - 1]; if (s) s.taking = !s.taking; continue; }
    if (/^#endif/.test(t)) { stack.pop(); continue; }
    if ((m = /^#define\s+(\w+)/.exec(t))) { if (active()) defined.add(m[1]); out.push(line); continue; }
    if (active()) out.push(line);
  }
  return out.join('\n');
}

const GL_BUILTINS = new Set([
  'position', 'normal', 'uv', 'uv1', 'uv2', 'color', 'tangent',
  'cameraPosition', 'viewMatrix', 'projectionMatrix', 'modelMatrix',
  'modelViewMatrix', 'normalMatrix', 'isOrthographic', 'logDepthBufFC',
  'gl_Position', 'gl_FragColor', 'gl_FragCoord', 'gl_PointCoord', 'gl_FrontFacing',
  'gl_PointSize', 'gl_FragDepth', 'gl_InstanceID', 'gl_VertexID',
]);

const TYPE_RE = /\b(?:float|int|uint|bool|vec2|vec3|vec4|ivec2|ivec3|ivec4|bvec2|bvec3|bvec4|mat2|mat3|mat4|sampler2D|samplerCube|void)\s+([A-Za-z_]\w*)/g;
const DECL_RE = /\b(?:uniform|attribute|varying|in|out)\s+(?:lowp\s+|mediump\s+|highp\s+)?(?:float|int|uint|bool|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler2D|samplerCube)\s+([A-Za-z_]\w*)/g;
const IDENT_RE = /\b([uav][A-Z]\w*)\b/g;

function declaredNames(src) {
  const names = new Set();
  let m;
  TYPE_RE.lastIndex = 0;
  while ((m = TYPE_RE.exec(src))) names.add(m[1]);
  DECL_RE.lastIndex = 0;
  while ((m = DECL_RE.exec(src))) names.add(m[1]);
  // function parameters
  for (const fm of src.matchAll(/\(([^)]*)\)\s*\{/g)) {
    for (const part of fm[1].split(',')) {
      const pm = /([A-Za-z_]\w*)\s*$/.exec(part.trim());
      if (pm) names.add(pm[1]);
    }
  }
  return names;
}

function uniformDecls(src) {
  const names = new Set();
  const re = /\buniform\s+(?:lowp\s+|mediump\s+|highp\s+)?\w+\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*;/g;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  return names;
}

function varyingDecls(src) {
  const names = new Set();
  const re = /\bvarying\s+(?:lowp\s+|mediump\s+|highp\s+)?\w+\s+([A-Za-z_]\w*)\s*;/g;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  return names;
}

function balanced(src) {
  let curly = 0;
  let paren = 0;
  // strip comments so braces inside them do not count
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const ch of clean) {
    if (ch === '{') curly += 1;
    else if (ch === '}') curly -= 1;
    else if (ch === '(') paren += 1;
    else if (ch === ')') paren -= 1;
    if (curly < 0 || paren < 0) return false;
  }
  return curly === 0 && paren === 0;
}

function analyseMaterial(label, material) {
  const defines = material.defines || {};
  const vert = preprocess(material.vertexShader, defines);
  const frag = preprocess(material.fragmentShader, defines);
  let ok = true;

  if (!balanced(vert)) { console.log(`  FAIL  ${label}: unbalanced vertex source`); failures.push(`${label} vert braces`); ok = false; }
  if (!balanced(frag)) { console.log(`  FAIL  ${label}: unbalanced fragment source`); failures.push(`${label} frag braces`); ok = false; }

  for (const [stage, src] of [['vertex', vert], ['fragment', frag]]) {
    const declared = declaredNames(src);
    const missing = new Set();
    let m;
    IDENT_RE.lastIndex = 0;
    while ((m = IDENT_RE.exec(src))) {
      const name = m[1];
      if (declared.has(name) || GL_BUILTINS.has(name)) continue;
      missing.add(name);
    }
    if (missing.size) {
      console.log(`  FAIL  ${label} ${stage}: undeclared ${[...missing].join(', ')}`);
      failures.push(`${label} ${stage} undeclared`);
      ok = false;
    }
  }

  // Fragment varyings must be declared identically in the vertex stage.
  const vv = varyingDecls(vert);
  const fv = varyingDecls(frag);
  const orphan = [...fv].filter((n) => !vv.has(n));
  if (orphan.length) {
    console.log(`  FAIL  ${label}: fragment varyings absent from the vertex stage: ${orphan.join(', ')}`);
    failures.push(`${label} varying mismatch`);
    ok = false;
  }

  // Every uniform the GLSL declares must exist in the JS uniform block.
  const glslUniforms = new Set([...uniformDecls(vert), ...uniformDecls(frag)]);
  const jsUniforms = new Set(Object.keys(material.uniforms || {}));
  const unbound = [...glslUniforms].filter((n) => !jsUniforms.has(n));
  if (unbound.length) {
    console.log(`  FAIL  ${label}: GLSL uniforms with no JS binding: ${unbound.join(', ')}`);
    failures.push(`${label} unbound uniforms`);
    ok = false;
  }

  if (/#include\s*</.test(vert) || /#include\s*</.test(frag)) {
    console.log(`  FAIL  ${label}: unresolved #include`);
    failures.push(`${label} include`);
    ok = false;
  }

  /* GLSL ES 1.00 stage restrictions. texture2D, discard, gl_FragCoord and the
   * derivative builtins exist only in the fragment stage; a shared chunk that
   * leaks one of them into a vertex shader fails to compile even if the code is
   * never reached. */
  const vertexForbidden = ['texture2D', 'textureCube', 'discard', 'gl_FragCoord', 'gl_FragColor', 'dFdx', 'dFdy', 'fwidth'];
  const leaks = vertexForbidden.filter((token) => new RegExp(`\\b${token}\\b`).test(vert));
  if (leaks.length) {
    console.log(`  FAIL  ${label}: fragment-only builtins in the vertex stage: ${leaks.join(', ')}`);
    failures.push(`${label} stage leak`);
    ok = false;
  }
  if (/\bgl_Position\b/.test(frag)) {
    console.log(`  FAIL  ${label}: gl_Position written in the fragment stage`);
    failures.push(`${label} frag gl_Position`);
    ok = false;
  }

  // A chunk included twice would redefine its functions.
  for (const src of [vert, frag]) {
    const defs = [...src.matchAll(/^\s*(?:float|vec2|vec3|vec4|mat3|void)\s+(dsh\w+)\s*\(/gm)].map((m) => m[1]);
    const seen = new Set();
    const dupes = defs.filter((n) => (seen.has(n) ? true : (seen.add(n), false)));
    if (dupes.length) {
      console.log(`  FAIL  ${label}: duplicate function definitions: ${[...new Set(dupes)].join(', ')}`);
      failures.push(`${label} duplicate functions`);
      ok = false;
    }
  }

  // Declaring `attribute vec3 color;` ourselves collides with three's own
  // declaration whenever material.vertexColors is true.
  if (defines.DSH_VCOLOR !== undefined && material.vertexColors === true) {
    console.log(`  FAIL  ${label}: DSH_VCOLOR together with material.vertexColors duplicates the color attribute`);
    failures.push(`${label} color attribute clash`);
    ok = false;
  }

  if (ok) {
    console.log(`  ok    ${label}  (${glslUniforms.size} uniforms, ${vv.size} varyings, ${vert.split('\n').length + frag.split('\n').length} lines)`);
  }
  return ok;
}

const whale = new mods.whale.Whale({ tileSize: 2 });
const crate = new mods.crate.Crate({ tileSize: 2, registerActor: false });
const mark = new mods.crate.GoalMark({ tileSize: 2 });
const skyDome = mods.sky.createSkyDome(sky);

analyseMaterial('grass / flowers', mods.grass.grassMaterial());
analyseMaterial('terrain', terrain.material);
analyseMaterial('foliage', trees.material);
analyseMaterial('props', props.material);
analyseMaterial('whale', whale.material);
analyseMaterial('crate', crate.material);
analyseMaterial('goal mark', mark.material);
analyseMaterial('sky dome', skyDome.material);

{
  // The composite pass is built by the Stage class, which needs a canvas; pull
  // its shader pair straight out of the module instead.
  const src = await import('node:fs').then((fs) => fs.promises.readFile(
    new URL('../src/core/renderer.js', import.meta.url), 'utf8',
  ));
  check('composite pass tone maps and encodes sRGB',
    src.includes('dshACESFilmic') && src.includes('dshLinearToSRGB'));
  check('composite pass point samples the low-res target',
    src.includes('floor(vUv * uSceneSize)'));
}

{
  // Feature audit against the brief: each of these must appear in the shipped
  // grass shader source.
  const gm = mods.grass.grassMaterial();
  const src = `${gm.vertexShader}\n${gm.fragmentShader}`;
  const features = [
    ['stop-motion clock', /dshStopTime/],
    ['per-blade phase offset', /uTime \* fps \+ phase/],
    ['layered wind noise', /l1 \* 0\.56 \+ l2 \* 0\.30 \+ l3 \* 0\.14/],
    ['gust envelope', /uGustStrength/],
    ['world-space bend axis', /cross\(up, windDir3\)/],
    ['Rodrigues rotation', /dshRotateAxis/],
    ['multi-actor push loop', /for \(int i = 0; i < DSH_MAX_ACTORS/],
    ['fixed actor capacity', /uActors\[DSH_MAX_ACTORS\]/],
    ['Y-axis billboard', /uViewRight/],
    ['flatten measurement', /length\(\(pb - o\)\.xy\)/],
    ['UV flatten compensation', /vUv\.y \* squash/],
    ['stepped light with soft band', /dshToonRamp\(ndl \* cloud, uToonSteps, uToonSoft\)/],
    ['alpha clip', /if \(alpha < uAlphaCutoff\) discard;/],
    ['cloud shadow', /dshCloudShadow\(vWorld\.xz\)/],
    ['HDRI probe ambient', /dshAmbient/],
    ['distance fog', /dshApplyFog/],
  ];
  for (const [label, re] of features) check(`grass shader: ${label}`, re.test(src));
}

/* ------------------------------------------------------------------ 4. rules */

section('4. puzzle rules');

const SOLUTIONS = [
  'RR',
  'ruLLdlUU',
  'RRdrUUruLL',
  'rddLdlUUUrrrrRurDDD',
  'rrDldRRRRllldDldRRRR',
  'dRRRRurDDrddLLLrrruulDrdLL',
  'uuulDldRRRdrUUUddlluuuulDDDldRRRdrU',
  'rrdRRurDDDrdLuuullullldRRRRurDDDlDRurD',
  'lluluuRDldRRRRRllllluuuurDrDDldRRRlluuulDDldRRRdrUdrUdrU',
  'luuRRdrUUruLLrddllldRRdrUUUruLddllddllluuRRRRlllldRRRRRUUdddrUUU',
];
const LETTER_TO_DIR = { u: 'up', d: 'down', l: 'left', r: 'right' };

check('level count', mods.levels.LEVELS.length === SOLUTIONS.length, `${mods.levels.LEVELS.length} levels`);

mods.levels.LEVELS.forEach((level, i) => {
  const rules = new mods.sokoban.Sokoban(level);
  const solution = SOLUTIONS[i];
  let rejected = 0;
  for (const ch of solution) {
    const dir = LETTER_TO_DIR[ch.toLowerCase()];
    if (!rules.move(dir)) rejected += 1;
  }
  const okSolved = rules.solved && rejected === 0;
  const okPushes = rules.pushes === level.par;
  check(`${level.id} solves from the recorded line`, okSolved,
    `${rules.moves} moves, ${rules.pushes} pushes${rejected ? `, ${rejected} refused` : ''}`);
  check(`${level.id} push count matches par ${level.par}`, okPushes, `got ${rules.pushes}`);

  // undo must return the board exactly to the start
  while (rules.history.length) rules.undo();
  const backAtStart = rules.player.x === rules.level.player.x
    && rules.player.y === rules.level.player.y
    && rules.boxes.every((b, k) => b.x === rules.level.boxes[k].x && b.y === rules.level.boxes[k].y)
    && rules.moves === 0 && rules.pushes === 0;
  check(`${level.id} full undo restores the start`, backAtStart);
});

{
  /* Legal-move refusals on grove-01:
   *   #######
   *   #     #
   *   #@$ . #     player (1,2), crate (2,2), mark (4,2)
   *   #     #
   *   #######
   */
  const rules = new mods.sokoban.Sokoban(mods.levels.LEVELS[0]);
  check('a hedge refuses the whale', rules.move('left') === null);
  check('refused moves do not count', rules.moves === 0 && rules.pushes === 0);
  rules.move('right');
  rules.move('right');
  check('crate on its mark reports solved', rules.solved === true, `${rules.pushes} pushes`);
  check('a crate can be pushed off its mark', rules.move('right') !== null);
  check('the board unsolves when the crate leaves', rules.solved === false);
  check('a crate against the hedge cannot be pushed', rules.move('right') === null,
    'crate would leave the plot');
  check('the refused push left the state alone', rules.pushes === 3 && rules.moves === 3);
}

/* ------------------------------------------------------------------ 5. staging */

section('5. level staging');

const scene = new THREE.Scene();
const stagePuzzle = new mods.play.PuzzleStage(scene, terrain, {});
stagePuzzle.setAspect(16 / 9);
let stagedOk = true;
for (let i = 0; i < mods.levels.LEVELS.length; i += 1) {
  const framing = stagePuzzle.load(i);
  const level = mods.levels.LEVELS[i];
  const crates = stagePuzzle.crates.length;
  const marks = stagePuzzle.marks.length;
  const hedged = stagePuzzle.hedge ? stagePuzzle.hedge.geometry.instanceCount : 0;
  const fits = framing.frustumHeight > 14 && framing.frustumHeight < 40;
  // Every tile must land inside the mown plot, or the board would spill onto rough grass.
  let inside = true;
  for (let gy = 0; gy < level.grid.length; gy += 1) {
    for (let gx = 0; gx < stagePuzzle.rules.level.width; gx += 1) {
      const p = stagePuzzle.cellToWorld(gx, gy, new THREE.Vector3());
      if (mods.plot.PLOT.edgeDistance(p.x, p.z) > -0.4) inside = false;
    }
  }
  const good = crates === stagePuzzle.rules.boxes.length && marks === stagePuzzle.rules.goalCount
    && hedged > 0 && fits && inside;
  if (!good) stagedOk = false;
  console.log(`  ${good ? 'ok  ' : 'FAIL'}  ${level.id}: ${crates} crates, ${marks} marks, ${hedged} hedge blades, frustum ${framing.frustumHeight.toFixed(1)}${inside ? '' : ', BOARD OUTSIDE PLOT'}`);
  if (!good) failures.push(`staging ${level.id}`);
}
check('all ten boards stage inside the plot', stagedOk);

{
  // Animate a push end to end and confirm the crate lands on its mark.
  stagePuzzle.load(0);
  stagePuzzle.active = true;
  stagePuzzle.input('right');
  for (let step = 0; step < 200; step += 1) stagePuzzle.update(1 / 60, null);
  stagePuzzle.input('right');
  for (let step = 0; step < 200; step += 1) stagePuzzle.update(1 / 60, null);
  check('animated pushes reach the solved state', stagePuzzle.solved === true,
    `${stagePuzzle.rules.pushes} pushes`);
  check('settled crate switches to its seated frame',
    stagePuzzle.crates[0].material.uniforms.uFrame.value === 1);
}

{
  // The title crate must loop through a stretch of road the title camera frames.
  const roll = new mods.crate.RollingCrate(terrain.road, terrain, { tileSize: 2, speed: 3.1 });
  const target = mods.config.CAMERAS.menu.target;
  const near = terrain.road.nearest(target.x, target.z);
  const centre = terrain.road.arc[near.index];
  roll.setWindow(centre - 38, centre + 30);
  check('title crate window sits on the road', roll.to > roll.from, `${(roll.to - roll.from).toFixed(0)} m loop`);

  let insideFrame = 0;
  let maxDrop = 0;
  const samples = 140;
  for (let i = 0; i < samples; i += 1) {
    roll.update(68 / (samples * 3.1));
    const d = Math.hypot(roll.root.position.x - target.x, roll.root.position.z - target.z);
    if (d < 34) insideFrame += 1;
    const ground = terrain.sampleHeight(roll.root.position.x, roll.root.position.z);
    maxDrop = Math.max(maxDrop, Math.abs((roll.root.position.y - ground) - roll.size * 0.5));
  }
  check('title crate stays in frame for most of the loop',
    insideFrame / samples > 0.6, `${Math.round((insideFrame / samples) * 100)}% of the cycle`);
  check('title crate rides on the road surface', maxDrop < roll.size * 0.25,
    `max centre offset ${maxDrop.toFixed(3)} m`);
  check('title crate tumbles', roll.rollAngle > Math.PI, `${(roll.rollAngle / (Math.PI / 2)).toFixed(1)} quarter turns`);
  roll.dispose();
}

{
  // Art direction guard: both framings must look towards the sun, or the grass
  // shader's transmission term contributes nothing.
  const { sunDir } = mods.env;
  for (const [name, cfg] of Object.entries(mods.config.CAMERAS)) {
    const rig = new mods.cameraRig.CameraRig(16 / 9);
    rig.set({ ...cfg, target: cfg.target.clone() });
    const dir = new THREE.Vector3();
    rig.camera.getWorldDirection(dir);
    const dot = dir.dot(sunDir);
    check(`${name} framing is back-lit`, dot > 0.03,
      `dot(view, sun) = ${dot.toFixed(3)}, transmission = ${Math.pow(Math.max(dot, 0), 2.2).toFixed(3)}`);
  }
  check('sun sits above the horizon', sunDir.y > 0.15, `NdotL on level ground = ${sunDir.y.toFixed(3)}`);
}

{
  /* Screen-direction contract, measured through the real camera matrices.
   * Pressing an arrow key must move the whale that way on screen; this is the
   * check that catches a flipped basis axis. */
  stagePuzzle.load(3);
  const rig = new mods.cameraRig.CameraRig(16 / 9);
  rig.set(stagePuzzle.cameraFraming());
  const camera = rig.camera;

  const gx = 4;
  const gy = 3;
  const ndcOf = (cx, cy) => stagePuzzle.cellToWorld(cx, cy, new THREE.Vector3()).project(camera);
  const origin = ndcOf(gx, gy);
  const cases = [
    ['right', mods.sokoban.DIRS.right, 'x', +1],
    ['left', mods.sokoban.DIRS.left, 'x', -1],
    ['up', mods.sokoban.DIRS.up, 'y', +1],
    ['down', mods.sokoban.DIRS.down, 'y', -1],
  ];
  for (const [name, dir, axis, sign] of cases) {
    const p = ndcOf(gx + dir.dx, gy + dir.dy);
    const dxn = p.x - origin.x;
    const dyn = p.y - origin.y;
    const main = axis === 'x' ? dxn : dyn;
    const cross = axis === 'x' ? dyn : dxn;
    const correctSign = Math.sign(main) === sign;
    const dominant = Math.abs(main) > Math.abs(cross) * 3;
    check(`arrow ${name} moves ${name} on screen`, correctSign && dominant,
      `ndc delta (${dxn.toFixed(4)}, ${dyn.toFixed(4)})`);
  }

  // The board must also be axis-aligned on screen: a row runs horizontally.
  const rowEnd = ndcOf(gx + 3, gy);
  const colEnd = ndcOf(gx, gy + 3);
  check('board rows run horizontally on screen',
    Math.abs(rowEnd.y - origin.y) < Math.abs(rowEnd.x - origin.x) * 0.02,
    `row tilt ${Math.abs(rowEnd.y - origin.y).toFixed(5)} ndc`);
  check('board columns run vertically on screen',
    Math.abs(colEnd.x - origin.x) < Math.abs(colEnd.y - origin.y) * 0.02,
    `column tilt ${Math.abs(colEnd.x - origin.x).toFixed(5)} ndc`);
}

{
  // Props must stay off the playfield: the stepping stones used to be laid out
  // towards the wrong edge of the plot and crossed it.
  const { PLOT } = mods.plot;
  const pos = props.mesh.geometry.getAttribute('position');
  let deepest = 0;
  let inside = 0;
  for (let i = 0; i < pos.count; i += 1) {
    const d = PLOT.edgeDistance(pos.getX(i), pos.getZ(i));
    if (d < -1.0) { inside += 1; deepest = Math.min(deepest, d); }
  }
  check('no prop geometry sits on the playfield', inside === 0,
    inside ? `${inside} vertices up to ${deepest.toFixed(2)} m inside` : 'kerb hugs the boundary');

  // And the way in should face the road.
  let nearestRoadV = Infinity;
  for (const p of terrain.road.points) {
    const b = PLOT.toBoard(p.x, p.z, new THREE.Vector2());
    if (Math.abs(b.x) < PLOT.halfW + 4) nearestRoadV = Math.min(nearestRoadV, Math.abs(b.y));
  }
  check('the road runs along the far edge of the plot', nearestRoadV > PLOT.halfD,
    `closest road crossing at v = ${nearestRoadV.toFixed(1)} against half-depth ${PLOT.halfD}`);
}

{
  const { actors, bladeShared } = mods.env;
  actors.sync();
  check('actor registry packs into the uniform array',
    bladeShared.uActorCount.value >= 1 && bladeShared.uActorCount.value <= mods.config.GRASS.maxActors,
    `${bladeShared.uActorCount.value} of ${mods.config.GRASS.maxActors} slots live`);
  const cam = new mods.cameraRig.CameraRig(16 / 9);
  cam.set({ ...mods.config.CAMERAS.play, target: mods.config.CAMERAS.play.target.clone() });
  mods.env.updateShared(1.5, cam.camera, cam.focus);
  const vr = bladeShared.uViewRight.value;
  check('billboard axis is a horizontal unit vector',
    Math.abs(Math.hypot(vr.x, vr.y) - 1) < 1e-5, `(${vr.x.toFixed(3)}, ${vr.y.toFixed(3)})`);
  check('camera is orthographic', cam.camera.isOrthographicCamera === true);
}

/* ------------------------------------------------------------------ 6. locales */

section('6. localisation');

{
  const fs = await import('node:fs');
  const read = (rel) => fs.promises.readFile(new URL(rel, import.meta.url), 'utf8');
  const [i18nSrc, htmlSrc, uiSrc, mainSrc] = await Promise.all([
    read('../src/ui/i18n.js'),
    read('../index.html'),
    read('../src/ui/ui.js'),
    read('../src/main.js'),
  ]);

  // Parse the two tables straight out of the module text: the audit must not
  // depend on the same lookup it is checking.
  const tableKeys = (name) => {
    const start = i18nSrc.indexOf(`  ${name}: {`);
    if (start < 0) return null;
    const end = i18nSrc.indexOf('\n  },', start);
    const body = i18nSrc.slice(start, end);
    return new Set([...body.matchAll(/^\s{4}'([^']+)':/gm)].map((m) => m[1]));
  };
  const en = tableKeys('en');
  const zh = tableKeys('zh');
  check('both locale tables parse', !!en && !!zh, `en ${en ? en.size : 0} keys, zh ${zh ? zh.size : 0} keys`);

  const missingZh = [...en].filter((k) => !zh.has(k));
  const extraZh = [...zh].filter((k) => !en.has(k));
  check('every English key has a Chinese translation', missingZh.length === 0,
    missingZh.length ? missingZh.join(', ') : `${en.size} keys covered`);
  check('no orphan Chinese keys', extraZh.length === 0, extraZh.join(', ') || 'tables agree');

  // Keys referenced from markup and code must exist.
  const used = new Set();
  for (const m of htmlSrc.matchAll(/data-i18n(?:-html|-label)?="([^"]+)"/g)) used.add(m[1]);
  for (const src of [uiSrc, mainSrc]) {
    for (const m of src.matchAll(/\bt\('([^']+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/setBoot\('([^']+)'/g)) used.add(m[1]);
  }
  // Keys the UI composes from a descriptor id at runtime.
  for (const m of mainSrc.matchAll(/key: '([a-z]+)',/g)) used.add(`lab.group.${m[1]}`);
  // Descriptors appear both inline and spread over several lines.
  for (const m of mainSrc.matchAll(/type: '(range|toggle|segment)',\s*(?:\n\s*)?id: '([\w-]+)'/g)) {
    used.add(`lab.${m[2]}`);
    if (m[1] === 'toggle') { used.add(`lab.${m[2]}.on`); used.add(`lab.${m[2]}.off`); }
  }
  for (const d of ['up', 'down', 'left', 'right']) used.add(`hud.dir.${d}`);
  used.add('solved.next');
  used.add('solved.nextLast');

  const unknown = [...used].filter((k) => !en.has(k));
  check('every key used by the app is defined', unknown.length === 0,
    unknown.length ? unknown.join(', ') : `${used.size} keys referenced`);

  // No English copy may be left hard-coded in the panels the app builds.
  const literalLabels = [...mainSrc.matchAll(/\blabel: '([^']+)'/g)].map((m) => m[1]);
  check('the shader lab carries no hard-coded copy', literalLabels.length === 0,
    literalLabels.join(', ') || 'labels resolve through i18n');

  // Every board needs Chinese text.
  const zhLevels = new Set([...i18nSrc.matchAll(/'(grove-\d+)': \{/g)].map((m) => m[1]));
  const missingLevels = mods.levels.LEVELS.filter((l) => !zhLevels.has(l.id)).map((l) => l.id);
  check('every board has Chinese name, concept and hint', missingLevels.length === 0,
    missingLevels.join(', ') || `${zhLevels.size} boards translated`);

  // Guard the one banned-copy pattern the style rules care about most.
  const banned = /不仅仅是|不只是|而是|告别|不再是|前所未有|一站式|无缝/;
  const zhBody = i18nSrc.slice(i18nSrc.indexOf('  zh: {'));
  const offenders = [...zhBody.matchAll(/'([^']*(?:不仅仅是|不只是|而是|告别|不再是|前所未有|一站式|无缝)[^']*)'/g)].map((m) => m[1]);
  check('Chinese copy avoids contrast and hype constructions', !banned.test(zhBody),
    offenders.join(' | ') || 'clean');
}

{
  // The inline copy in index.html must match the default locale.
  const fsMod = await import('node:fs');
  const readSrc = (rel) => fsMod.promises.readFile(new URL(rel, import.meta.url), 'utf8');
  const [i18nText, htmlText] = await Promise.all([
    readSrc('../src/ui/i18n.js'),
    readSrc('../index.html'),
  ]);
  const { checkMarkupDefaults } = await import(new URL('./markup-default.mjs', import.meta.url).href);
  checkMarkupDefaults({ check, i18nSrc: i18nText, htmlSrc: htmlText });
}

{
  // Runtime check of the switch itself, against a minimal DOM.
  const { checkLocaleRuntime } = await import(new URL('./locale-runtime.mjs', import.meta.url).href);
  await checkLocaleRuntime({
    check,
    levels: mods.levels.LEVELS,
    i18nUrl: new URL('../src/ui/i18n.js', import.meta.url).href,
  });
}

/* ------------------------------------------------------------------ report */

console.log(`\n${'='.repeat(56)}`);
if (failures.length === 0) {
  console.log(`PASS — ${Date.now() - t0} ms, no failures.`);
  for (const n of notes) console.log(`  note: ${n}`);
  process.exit(0);
} else {
  console.log(`FAIL — ${failures.length} problem(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
