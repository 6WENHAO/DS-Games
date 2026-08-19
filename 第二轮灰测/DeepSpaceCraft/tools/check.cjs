/* 项目自检：不依赖浏览器，校验模块契约一致性 + 地形生成逻辑
   用法：node tools/check.js  */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fails = 0, warns = 0;
function ok(msg) { console.log('  \u2713 ' + msg); }
function bad(msg) { console.log('  \u2717 ' + msg); fails++; }
function warn(msg) { console.log('  ! ' + msg); warns++; }
function section(t) { console.log('\n== ' + t + ' =='); }

/* ---------- 浏览器打桩 ---------- */
const listeners = {};
global.window = {
  addEventListener: (k, f) => { (listeners[k] = listeners[k] || []).push(f); },
  devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900,
  requestAnimationFrame: () => 0, setTimeout: setTimeout, clearTimeout: clearTimeout
};
global.document = {
  readyState: 'loading',
  addEventListener: () => { },
  getElementById: () => null,
  createElement: () => ({ style: {}, appendChild() { }, setAttribute() { }, addEventListener() { }, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } } })
};
global.performance = global.performance || { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem: () => { }, removeItem: () => { } };
try { global.navigator = { userAgent: 'node' }; } catch (e) { /* node 24 起 navigator 只读，忽略 */ }

const FILES = ['math', 'gl', 'noise', 'textures', 'audio', 'lore', 'blocks', 'universe', 'models', 'spacefx', 'world', 'render', 'player', 'space', 'transition', 'ui', 'save', 'main'];

section('1. 语法与加载（classic script，加载期零副作用）');
for (const f of FILES) {
  const p = path.join(ROOT, 'js', f + '.js');
  if (!fs.existsSync(p)) { bad(f + '.js 不存在'); continue; }
  try {
    const src = fs.readFileSync(p, 'utf8');
    if (/\bexport\s|\bimport\s+[\w{*]/.test(src)) bad(f + '.js 含 ESM 语法');
    if (/\bfetch\s*\(|XMLHttpRequest/.test(src)) bad(f + '.js 含网络请求');
    // eslint-disable-next-line no-new-func
    new Function(src)();
    ok(f + '.js 加载通过');
  } catch (e) { bad(f + '.js 加载失败: ' + e.message); }
}
const DSC = global.window.DSC || {};

section('2. 模块导出完整性');
const need = {
  M4: ['perspective', 'lookAt', 'mul', 'invert'], V3: ['add', 'norm', 'dist'], Util: ['clamp', 'makeRng', 'hex'],
  GL: ['init', 'program', 'vao', 'fbo', 'sphereMesh'], Noise: ['perlin2', 'fbm2', 'perlin3', 'ridged2'],
  Textures: ['build', 'icon', 'avgColor', 'TILE_NAMES'], Audio: ['init', 'play', 'loop', 'setMusic', 'engine', 'wind', 'mining', 'NAMES'],
  Lore: ['planetName', 'biomeLabel', 'bootLog', 'blockName', 'starClass', 'systemEconomy', 'resourceName', 'tip'],
  Blocks: ['LIST', 'ID', 'ITEMS', 'REFINER', 'CRAFT', 'init', 'tile', 'drops'],
  Universe: ['makeGalaxy', 'makeSystem', 'makePlanet', 'warpCost'],
  Models: ['get', 'boxesOf'], SpaceFX: ['init', 'drawBackground', 'drawPlanet', 'drawStar', 'drawWarp', 'drawDust'],
  World: ['init', 'generate', 'computeLight', 'buildMesh', 'raycast', 'heightAt', 'update'],
  Render: ['init', 'begin', 'end', 'drawSky', 'drawChunks', 'drawModel', 'buildBoxModel'],
  Player: ['init', 'update', 'addItem', 'scan'], Space: ['init', 'update', 'render', 'beginWarp'],
  Transition: ['beginEntry', 'beginExit', 'update', 'visual'],
  UI: ['init', 'boot', 'update', 'showScreen', 'toast', 'planetCard', 'entryWarning', 'fx'],
  Save: ['write', 'read', 'info'], Game: ['boot', 'update', 'render'], Input: ['init', 'key'], Cam: ['update'], Particles: ['spawn', 'update']
};
for (const mod in need) {
  const m = DSC[mod];
  if (!m) { bad('DSC.' + mod + ' 缺失'); continue; }
  const miss = need[mod].filter(k => m[k] === undefined);
  if (miss.length) bad('DSC.' + mod + ' 缺少: ' + miss.join(','));
  else ok('DSC.' + mod + ' 完整');
}

section('3. 音效名交叉校验（代码调用 ⊆ Audio.NAMES）');
if (DSC.Audio && DSC.Audio.NAMES) {
  const names = new Set(DSC.Audio.NAMES);
  const used = new Map();
  for (const f of FILES) {
    if (f === 'audio') continue;
    const src = fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8');
    const re = /\.(?:play|loop|stopLoop)\(\s*'([a-z0-9_]+)'/g;
    let m;
    while ((m = re.exec(src))) if (!used.has(m[1])) used.set(m[1], f);
  }
  const missing = [...used.keys()].filter(k => !names.has(k) && !/_$/.test(k));
  if (missing.length) missing.forEach(k => bad('音效未实现: ' + k + '（' + used.get(k) + '）'));
  else ok('代码用到的 ' + used.size + ' 个音效全部存在（音效库共 ' + names.size + ' 个）');
  // 材质音全覆盖（SPEC：break/place 无 water 变体，由 Blocks.sfx 回退 stone）
  const mats = ['stone', 'dirt', 'grass', 'sand', 'wood', 'metal', 'glass', 'crystal', 'snow', 'water'];
  const pre = ['dig_', 'break_', 'place_', 'step_'];
  const mm = [];
  pre.forEach(p => mats.forEach(mt => {
    if (mt === 'water' && (p === 'break_' || p === 'place_')) return;
    if (!names.has(p + mt)) mm.push(p + mt);
  }));
  if (mm.length) bad('材质音缺失: ' + mm.join(',')); else ok('38 个材质音（dig/break/place/step × 材质）齐全');
  if (DSC.Blocks.sfx(DSC.Blocks.ID.water, 'break') !== 'break_stone') bad('Blocks.sfx 水材质回退失效');
  else ok('Blocks.sfx 水材质回退正确');
}

section('4. 贴图 tile 名交叉校验');
if (DSC.Textures && DSC.Textures.TILE_NAMES) {
  const tiles = new Set(DSC.Textures.TILE_NAMES);
  ok('TILE_NAMES 数量 = ' + DSC.Textures.TILE_NAMES.length);
  const missing = [];
  DSC.Blocks.LIST.forEach(d => {
    if (!d || !d.tiles) return;
    const t = d.tiles;
    const arr = typeof t === 'string' ? [t] : [t.top, t.side, t.bottom, t.all].filter(Boolean);
    arr.forEach(n => { if (!tiles.has(n)) missing.push(d.key + ' -> ' + n); });
  });
  if (missing.length) missing.forEach(m => bad('方块引用了不存在的 tile: ' + m));
  else ok('方块表引用的 tile 全部存在');
  const itemMiss = [];
  for (const k in DSC.Blocks.ITEMS) {
    const it = DSC.Blocks.ITEMS[k];
    if (it.tile && !tiles.has(it.tile)) itemMiss.push(k + ' -> ' + it.tile);
  }
  if (itemMiss.length) itemMiss.forEach(m => bad('物品图标 tile 缺失: ' + m));
  else ok('物品图标 tile 全部存在');
}

section('5. 文案覆盖（Lore.blockName / biomeLabel / resourceName）');
if (DSC.Lore) {
  const miss = [];
  DSC.Blocks.LIST.forEach((d, i) => {
    if (!d) return;
    if (i > 0 && d.id !== i) return;
    const n = DSC.Lore.blockName(d.key);
    if (!n || !n.zh) miss.push(d.key);
  });
  if (miss.length) bad('blockName 缺失: ' + [...new Set(miss)].join(',')); else ok('blockName 覆盖全部方块 key');
  const bm = DSC.Universe.BIOME_KEYS.filter(b => { const l = DSC.Lore.biomeLabel(b); return !l || !l.zh; });
  if (bm.length) bad('biomeLabel 缺失: ' + bm.join(',')); else ok('biomeLabel 覆盖 9 群系');
  const resMiss = [];
  for (const k in DSC.Blocks.ITEMS) {
    if (DSC.Blocks.ITEMS[k].type !== 'resource') continue;
    const r = DSC.Lore.resourceName(k);
    if (!r || !r.zh) resMiss.push(k);
  }
  if (resMiss.length) warn('resourceName 缺失（将回退方块名）: ' + resMiss.join(','));
  else ok('resourceName 覆盖全部资源');
}

section('6. DOM id 契约（ui.js/main.js 引用 ⊆ index.html）');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const uiSrc = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  const refs = new Set();
  for (const m of uiSrc.matchAll(/D\['([a-z0-9-]+)'\]/g)) refs.add(m[1]);
  for (const m of uiSrc.matchAll(/\$\('([a-z0-9-]+)'\)/g)) refs.add(m[1]);
  for (const m of mainSrc.matchAll(/getElementById\('([a-z0-9-]+)'\)/g)) refs.add(m[1]);
  const missing = [...refs].filter(r => !ids.has(r));
  if (missing.length) missing.forEach(r => bad('index.html 缺少 id: ' + r));
  else ok('引用的 ' + refs.size + ' 个 id 全部存在（HTML 共 ' + ids.size + ' 个）');
  /* ui.js 的 D 缓存表必须登记所有被 D['x'] 使用的 id，否则运行时 undefined 崩溃 */
  const listM = uiSrc.match(/var D = UI\.D;\s*\[([\s\S]*?)\]\.forEach/);
  if (!listM) warn('未能解析 ui.js 的 D 登记表');
  else {
    const registered = new Set([...listM[1].matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]));
    const used = new Set([...uiSrc.matchAll(/D\['([a-z0-9-]+)'\]/g)].map(m => m[1]));
    const notReg = [...used].filter(u => !registered.has(u));
    if (notReg.length) notReg.forEach(u => bad("ui.js D['" + u + "'] 未在登记表中（运行时会 undefined 崩溃）"));
    else ok('ui.js D 表登记完整（登记 ' + registered.size + ' / 使用 ' + used.size + '）');
    const unused = [...registered].filter(r => !used.has(r) && !ids.has(r));
    if (unused.length) warn('D 表登记了 HTML 不存在的 id: ' + unused.join(','));
  }
  // 脚本齐全
  const scripts = [...html.matchAll(/src="js\/([a-z]+)\.js"/g)].map(m => m[1]);
  const missS = FILES.filter(f => !scripts.includes(f));
  if (missS.length) bad('index.html 未加载: ' + missS.join(',')); else ok('index.html 按序加载全部 ' + scripts.length + ' 个脚本');
}

section('7. CSS 覆盖率');
{
  const css = fs.readFileSync(path.join(ROOT, 'css', 'ui.css'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ids = [...new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]))];
  const miss = ids.filter(i => !css.includes('#' + i));
  if (miss.length) bad('CSS 未覆盖 id: ' + miss.join(',')); else ok('CSS 覆盖全部 ' + ids.length + ' 个 id');
  const classes = ['slot', 'inv-slot', 'recipe', 'marker', 'blip', 'c-tick', 'notify', 'log-item', 'gnode', 'rung', 'menu-btn', 'panel', 'kv', 'hidden', 'show', 'play', 'out', 'active', 'sel', 'disabled', 'empty', 'edge', 'warn', 'crit', 'full', 'charging'];
  const cm = classes.filter(c => !css.includes('.' + c));
  if (cm.length) bad('CSS 未覆盖类: ' + cm.join(',')); else ok('CSS 覆盖 SPEC §11 全部动态类');
  if (/url\(/.test(css)) bad('CSS 含外部资源 url()'); else ok('CSS 零外部资源');
}

section('8. GLSL 合规（WebGL2 ES 3.00）');
{
  let shaderCount = 0, bad1 = 0;
  const check = (name, src) => {
    shaderCount++;
    if (!/^#version 300 es\n/.test(src)) { bad('着色器 ' + name + ' 首行不是 #version 300 es'); bad1++; }
    if (/gl_FragColor|varying |attribute |texture2D\(/.test(src)) { bad('着色器 ' + name + ' 含 WebGL1 语法'); bad1++; }
  };
  const rsrc = fs.readFileSync(path.join(ROOT, 'js', 'render.js'), 'utf8');
  for (const m of rsrc.matchAll(/'#version 300 es\\n'[\s\S]{0,20000}?;\n/g)) {
    /* render.js 用字符串拼接，粗检查即可 */
  }
  const vcount = (rsrc.match(/#version 300 es/g) || []).length;
  if (vcount < 8) bad('render.js 着色器数量异常: ' + vcount); else ok('render.js 含 ' + vcount + ' 段 GLSL 头');
  if (/gl_FragColor|texture2D\(/.test(rsrc)) bad('render.js 含 WebGL1 语法'); else ok('render.js 无 WebGL1 语法');
  if (DSC.SpaceFX && DSC.SpaceFX._shaders) {
    for (const k in DSC.SpaceFX._shaders) check('spacefx:' + k, DSC.SpaceFX._shaders[k]);
    if (!bad1) ok('spacefx 全部 ' + shaderCount + ' 段 GLSL 合规');
  } else warn('spacefx 未暴露 _shaders');
}

section('9. 地形生成 / 光照 / 射线（无 GL 逻辑冒烟）');
{
  const galaxy = DSC.Universe.makeGalaxy('SMOKE-TEST', 6);
  ok('银河生成：' + galaxy.systems.length + ' 星系，首系 ' + galaxy.systems[0].name + ' 有 ' + galaxy.systems[0].planets.length + ' 颗行星');
  let biomes = new Set();
  galaxy.systems.forEach(s => s.planets.forEach(p => biomes.add(p.biome)));
  ok('群系多样性：' + [...biomes].join(','));

  const planet = galaxy.systems[0].planets[0];
  DSC.World.init(planet, {});
  const t0 = Date.now();
  const heights = [];
  for (let i = 0; i < 400; i++) heights.push(DSC.World.heightAt(i * 3, i * 7));
  const hmin = Math.min(...heights), hmax = Math.max(...heights);
  if (hmin < 2 || hmax > 90) bad('地形高度越界 ' + hmin + '..' + hmax); else ok('地形高度范围 ' + hmin + '..' + hmax + '（海平面 ' + planet.terrain.seaLevel + '）');

  const nGen = 9;
  for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) {
    const ch = DSC.World.ensureChunk(cx, cz);
    DSC.World.generate(ch);
  }
  const genMs = Date.now() - t0;
  ok(nGen + ' 个区块生成耗时 ' + genMs + 'ms（' + (genMs / nGen).toFixed(1) + 'ms/区块）');
  if (genMs / nGen > 60) warn('单区块生成偏慢，可能造成卡顿');

  const mid = DSC.World.getChunk(0, 0);
  let solid = 0, air = 0, kinds = new Set();
  for (let i = 0; i < mid.blocks.length; i++) {
    const b = mid.blocks[i];
    if (b) { solid++; kinds.add(b); } else air++;
  }
  if (solid < 1000) bad('区块几乎是空的（solid=' + solid + '）'); else ok('区块方块数 ' + solid + '，种类 ' + kinds.size + '，空气 ' + air);
  const t1 = Date.now();
  DSC.World.computeLight(mid);
  ok('光照计算耗时 ' + (Date.now() - t1) + 'ms；顶部天光 ' + mid.sky[0 + 16 * (0 + 16 * 95)] + '，深处天光 ' + mid.sky[0 + 16 * (0 + 16 * 2)]);
  let lit = 0;
  for (let i = 0; i < mid.blk.length; i++) if (mid.blk[i] > 0) lit++;
  ok('方块光影响格数 ' + lit + '（自发光矿脉/晶簇）');

  const sy = DSC.World.surfaceY(8, 8);
  ok('地表高度 surfaceY(8,8) = ' + sy);
  const hit = DSC.World.raycast([8.5, sy + 3, 8.5], [0, -1, 0], 8);
  if (!hit.hit) bad('垂直向下射线未命中地面'); else ok('射线命中 ' + DSC.Blocks.keyOf(hit.id) + ' @ y=' + hit.y);

  /* 采矿与背包 */
  DSC.Player.init([8.5, sy, 8.5], false);
  const before = DSC.Player.count('carbon');
  DSC.Player.addItem('carbon', 7);
  if (DSC.Player.count('carbon') !== before + 7) bad('背包 addItem 失败'); else ok('背包增删正常（碳 ' + DSC.Player.count('carbon') + '）');
  if (!DSC.Player.removeItem('carbon', 7)) bad('removeItem 失败'); else ok('removeItem 正常');
  /* 配方可解 */
  const P = DSC.Player;
  const solvable = DSC.Blocks.CRAFT.filter(r => r.in.every(x => DSC.Blocks.ITEMS[x.k]));
  if (solvable.length !== DSC.Blocks.CRAFT.length) bad('存在引用未知物品的配方'); else ok('全部 ' + solvable.length + ' 条合成配方物品有效');
  const rSolv = DSC.Blocks.REFINER.every(r => r.in.every(x => DSC.Blocks.ITEMS[x.k]) && DSC.Blocks.ITEMS[r.out.k]);
  if (!rSolv) bad('精炼配方引用未知物品'); else ok('精炼配方全部有效');

  /* 落点搜索 */
  const spot = DSC.World.findLandingSpot(40, 40);
  ok('降落点搜索 = ' + spot.join(','));
  /* setBlock/edits */
  DSC.World.setBlock(8, sy, 8, DSC.Blocks.ID.glow_panel);
  const ed = DSC.World.edits['0,0'];
  if (!ed || !ed.length) bad('方块改动未记入存档 diff'); else ok('存档 diff 记录 ' + (ed.length / 2) + ' 项');
}

section('10. 星球/系统数据完整性');
{
  const g = DSC.Universe.makeGalaxy('DATA', 12);
  let issues = 0;
  g.systems.forEach(s => {
    if (!s.name || !s.starClass || !s.economy) { bad('星系字段缺失'); issues++; }
    s.planets.forEach(p => {
      ['name', 'biome', 'palette', 'atmoColor', 'sky', 'terrain', 'blocks', 'hazard', 'labels'].forEach(k => {
        if (p[k] === undefined) { bad('行星缺字段 ' + k); issues++; }
      });
      ['surface', 'sub', 'deep', 'beach', 'tree', 'leaf', 'crystal'].forEach(k => {
        if (DSC.Blocks.ID[p.blocks[k]] === undefined) { bad('行星 ' + p.name + ' 方块 ' + k + '=' + p.blocks[k] + ' 未注册'); issues++; }
      });
      if (!p.labels.biome || !p.labels.weather || !p.labels.sentinels) { bad('行星文案缺失'); issues++; }
    });
  });
  if (!issues) ok('12 星系 × 全部行星字段与方块引用均有效');
  const cost = DSC.Universe.warpCost(g.systems[0], g.systems[5]);
  ok('曲速消耗计算 = ' + cost + ' 单位距离');
}

console.log('\n=========================================');
console.log(fails ? ('FAILED: ' + fails + ' 项失败, ' + warns + ' 项警告') : ('ALL PASS (' + warns + ' 警告)'));
console.log('=========================================');
process.exit(fails ? 1 : 0);
