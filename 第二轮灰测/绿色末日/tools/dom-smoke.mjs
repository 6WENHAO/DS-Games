/* Canvas 2D 桩测试：用一个记录型上下文实跑全部程序化绘制代码
   —— 覆盖 212 张方块贴图 + 337 个物品图标的每一行画法，捕获任何拼写/API 错误。 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');

/* ---------------- Canvas 2D 桩 ---------------- */
let opCount = 0;
function makeCtx(w, h) {
  const stack = [];
  const state = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: 'left' };
  const num = (v, name, op) => {
    if (typeof v !== 'number' || !isFinite(v)) throw new Error(`${op}() 收到非法数值 ${name}=${v}`);
  };
  const color = (c, op) => {
    if (typeof c !== 'string') throw new Error(`${op}: 颜色不是字符串 (${c})`);
    if (!/^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\)|transparent|[a-z]+)$/.test(c))
      throw new Error(`${op}: 颜色字符串非法 "${c}"`);
  };
  const api = {
    canvas: { width: w, height: h },
    imageSmoothingEnabled: false,
    save() { stack.push(Object.assign({}, state)); },
    restore() { const s = stack.pop(); if (s) Object.assign(state, s); },
    translate(x, y) { num(x, 'x', 'translate'); num(y, 'y', 'translate'); opCount++; },
    rotate(a) { num(a, 'a', 'rotate'); opCount++; },
    scale(x, y) { num(x, 'x', 'scale'); num(y, 'y', 'scale'); },
    setTransform() { opCount++; },
    beginPath() { opCount++; }, closePath() { opCount++; }, clip() { opCount++; },
    moveTo(x, y) { num(x, 'x', 'moveTo'); num(y, 'y', 'moveTo'); },
    lineTo(x, y) { num(x, 'x', 'lineTo'); num(y, 'y', 'lineTo'); },
    quadraticCurveTo(a, b, c, d) { [a, b, c, d].forEach((v, i) => num(v, i, 'quadraticCurveTo')); },
    bezierCurveTo() { }, arcTo(a, b, c, d, r) { [a, b, c, d, r].forEach((v, i) => num(v, i, 'arcTo')); },
    arc(x, y, r, s, e) { num(x, 'x', 'arc'); num(y, 'y', 'arc'); num(r, 'r', 'arc'); if (r < 0) throw new Error('arc 半径为负 ' + r); },
    ellipse(x, y, rx, ry) { num(rx, 'rx', 'ellipse'); num(ry, 'ry', 'ellipse'); if (rx < 0 || ry < 0) throw new Error('ellipse 半径为负'); },
    rect() { }, fill() { color(state.fillStyle, 'fill'); opCount++; },
    stroke() { color(state.strokeStyle, 'stroke'); opCount++; },
    fillRect(x, y, ww, hh) { [x, y, ww, hh].forEach((v, i) => num(v, i, 'fillRect')); color(state.fillStyle, 'fillRect'); opCount++; },
    strokeRect(x, y, ww, hh) { [x, y, ww, hh].forEach((v, i) => num(v, i, 'strokeRect')); opCount++; },
    clearRect(x, y, ww, hh) { [x, y, ww, hh].forEach((v, i) => num(v, i, 'clearRect')); opCount++; },
    fillText(t, x, y) { num(x, 'x', 'fillText'); num(y, 'y', 'fillText'); opCount++; },
    measureText(t) { return { width: String(t).length * 6 }; },
    createLinearGradient() { return { addColorStop(o, c) { color(c, 'gradient'); } }; },
    createRadialGradient() { return { addColorStop(o, c) { color(c, 'gradient'); } }; },
    drawImage(img, ...a) {
      if (!img) throw new Error('drawImage: 源图为空');
      a.forEach((v, i) => num(v, i, 'drawImage'));
      opCount++;
    },
    getImageData(x, y, ww, hh) {
      num(ww, 'w', 'getImageData'); num(hh, 'h', 'getImageData');
      const d = new Uint8ClampedArray(Math.max(1, ww * hh * 4));
      for (let i = 0; i < d.length; i += 4) { d[i] = 90; d[i + 1] = 120; d[i + 2] = 70; d[i + 3] = 255; }
      return { data: d, width: ww, height: hh };
    },
    putImageData() { },
  };
  for (const k of ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign', 'textBaseline', 'lineCap', 'lineJoin']) {
    Object.defineProperty(api, k, {
      get() { return state[k]; },
      set(v) {
        if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string') color(v, k);
        if (k === 'globalAlpha') { num(v, 'alpha', 'globalAlpha'); if (v < 0 || v > 1) throw new Error('globalAlpha 越界 ' + v); }
        state[k] = v;
      },
    });
  }
  return api;
}

const sandbox = {
  console, Math, Date, JSON, Uint8ClampedArray, Float32Array, Uint8Array, Uint16Array, Int16Array, Set, Map,
  performance: { now: () => Date.now() },
  document: {
    createElement(tag) {
      if (tag !== 'canvas') return { style: {}, appendChild() { }, remove() { } };
      const cv = { width: 300, height: 150, style: {} };
      cv.getContext = (t) => (t === '2d' ? makeCtx(cv.width, cv.height) : null);
      cv.toDataURL = () => 'data:image/png;base64,STUB';
      return cv;
    },
    getElementById() { return null; },
    addEventListener() { },
  },
  window: null,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

const FILES = ['core', 'blocks', 'items', 'recipes', 'atlas', 'worldgen', 'structures',
  'world', 'render', 'entities', 'survival', 'quests', 'audio', 'ui', 'game'];
let warns = [];
const origWarn = console.warn;
console.warn = (...a) => { warns.push(a.join(' ')); };

let pass = 0, fail = 0;
const T = (n, fn) => {
  try { const m = fn(); origWarn.call(console, '  ✓ ' + n + (m ? '  ' + m : '')); pass++; }
  catch (e) { origWarn.call(console, '  ✗ ' + n + ' — ' + e.message); fail++; }
};

origWarn.call(console, '\n=== Canvas 绘制桩测试 ===\n');

T('全部 15 个源文件加载无异常', () => {
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(root, 'src', f + '.js'), 'utf8'), ctx, { filename: f });
  vm.runInContext(fs.readFileSync(path.join(root, 'mods', 'example-mod.js'), 'utf8'), ctx, { filename: 'example-mod' });
  return FILES.length + ' 个 + 1 个 mod';
});
const GF = sandbox.GF;

T('MOD 注册生效（贴图/方块/物品/配方/地标/POI）', () => {
  if (!GF.Blocks.byKey['mod_beacon']) throw new Error('mod 方块没注册');
  if (!GF.Items.get('mod_beacon_item')) throw new Error('mod 物品没注册');
  if (!GF.Recipes.byOut['mod_beacon_item']) throw new Error('mod 配方没注册');
  if (!GF.Landmarks.list.some((l) => l.key === 'mod_ring')) throw new Error('mod 地标没注册');
  if (!GF.Landmarks.POI_TYPES.some((p) => p.key === 'mod_glowstump')) throw new Error('mod POI 没注册');
  if (!GF.Recipes.UNLOCKS.biolume) throw new Error('mod 科技没注册');
  return `方块 ${GF.Blocks.count()} 物品 ${GF.Items.count()} 配方 ${GF.Recipes.count()} 地标 ${GF.Landmarks.list.length}`;
});

T('图集：全部贴图绘制无报错', () => {
  warns = [];
  const before = opCount;
  const a = GF.Atlas.build();
  if (!a.canvas) throw new Error('没有生成 canvas');
  const tileFails = warns.filter((w) => w.includes('atlas tile fail'));
  if (tileFails.length) throw new Error(tileFails.join(' | '));
  return `${GF.Atlas.tileCount()} 张贴图 / ${opCount - before} 次绘制调用 / 剩余 ${GF.Atlas.freeSlots()} 格`;
});

T('物品图标：全部 337+ 个绘制无报错', () => {
  const before = opCount;
  GF.IconSheet.build();
  if (GF.IconSheet.errors.length) throw new Error(GF.IconSheet.errors.slice(0, 5).join(' | '));
  const n = Object.keys(GF.IconSheet.pos).length;
  if (n !== GF.Items.count()) throw new Error(`图标数 ${n} ≠ 物品数 ${GF.Items.count()}`);
  return `${n} 个图标 / ${opCount - before} 次绘制调用`;
});

T('每个物品都能取到图标定位样式', () => {
  const miss = GF.Items.order.filter((k) => !GF.IconSheet.style(k));
  if (miss.length) throw new Error('无样式: ' + miss.slice(0, 6).join(','));
  return '全部命中';
});

T('mod 地标可建造（含新方块与新贴图）', () => {
  const w = new GF.World(777);
  const l = GF.Landmarks.list.find((x) => x.key === 'mod_ring');
  const data = w.gen.generateChunk(Math.floor(l.x / 16), Math.floor(l.z / 16));
  let beacon = 0, stalk = 0;
  for (const id of data.blocks) {
    if (id === GF.Blocks.ID.mod_beacon) beacon++;
    if (id === GF.Blocks.ID.spore_stalk) stalk++;
  }
  if (!beacon) throw new Error('信标没有生成');
  return `信标 ${beacon} 个，孢囊柱 ${stalk} 个`;
});

T('新方块能被正常网格化（贴图 UV 有效）', () => {
  const w = new GF.World(777);
  const c = w.generateNow(0, 0);
  const h = c.heightMap[8 + 8 * 16];
  w.setBlock(8, h + 1, 8, GF.Blocks.ID.mod_beacon);
  const g = w.buildMesh(c);
  if (!g.opaque || !g.opaque.count) throw new Error('没有几何');
  const uv = GF.Atlas.uvOf('beacon_top');
  if (uv[0] <= 0 || uv[1] < 0) throw new Error('mod 贴图 UV 无效');
  return `UV(${uv[0].toFixed(3)}, ${uv[1].toFixed(3)}) 顶点 ${g.opaque.count}`;
});

T('方块平均色采样（粒子/地图配色）', () => {
  // game.js 内部的 avgColor 通过 getImageData 工作；这里验证 UV 与索引一致
  const missing = [];
  for (const b of GF.Blocks.list) {
    for (const k of Object.keys(b.tex)) {
      if (GF.Atlas.index[b.tex[k]] === undefined) missing.push(b.key + '.' + k);
    }
  }
  if (missing.length) throw new Error('贴图索引缺失: ' + missing.join(','));
  return GF.Blocks.count() + ' 个方块贴图索引齐全';
});

T('Audio 类可实例化且无 AudioContext 时安全降级', () => {
  const a = new GF.Audio();
  a.enabled = true;
  a.ensure();               // 没有 AudioContext -> enabled=false
  a.play({ freq: 440 });    // 不应抛错
  a.step('grass'); a.gunshot(true); a.zombie(); a.ambient({ wind: 0.4, rain: 0.2 });
  if (a.enabled) throw new Error('无 AudioContext 时应自动禁用');
  return '已降级，调用安全';
});

/* -------------------- GLSL 着色器静态一致性校验 -------------------- */
const renderSrc = fs.readFileSync(path.join(root, 'src', 'render.js'), 'utf8');
function shaderBlocks() {
  const out = {};
  const re = /const\s+((?:VS|FS)_\w+)\s*=\s*`([\s\S]*?)`;/g;
  let m;
  while ((m = re.exec(renderSrc))) out[m[1]] = m[2];
  return out;
}
const SH = shaderBlocks();

T('提取到全部 10 段着色器且以 #version 300 es 开头', () => {
  const names = Object.keys(SH);
  if (names.length !== 10) throw new Error('提取到 ' + names.length + ' 段: ' + names.join(','));
  for (const n of names) {
    if (!SH[n].startsWith('#version 300 es\n')) throw new Error(n + ' 缺少或错位的 #version 指令');
    if (n.startsWith('FS_') && !/precision\s+\w+\s+float;/.test(SH[n])) throw new Error(n + ' 片元着色器缺少 precision');
    if (n.startsWith('FS_') && !/out\s+vec4\s+\w+;/.test(SH[n])) throw new Error(n + ' 缺少 out 变量');
  }
  return names.join(' ');
});

T('顶点 out 与片元 in 变量完全对应', () => {
  const pairs = [['VS_TERRAIN', 'FS_TERRAIN'], ['VS_SKY', 'FS_SKY'], ['VS_MODEL', 'FS_MODEL'], ['VS_PART', 'FS_PART']];
  const TYPES = 'vec2|vec3|vec4|float|int|mat2|mat3|mat4|sampler2D';
  const decl = (src, kw) => {
    const s = new Map();
    const re = new RegExp('\\b' + kw + '\\s+(' + TYPES + ')\\s+(\\w+)\\s*;', 'g');
    let m; while ((m = re.exec(src))) s.set(m[2], m[1]);
    return s;
  };
  const rep = [];
  for (const [vs, fs2] of pairs) {
    const outs = decl(SH[vs], 'out'), ins = decl(SH[fs2], 'in');
    if (!ins.size) throw new Error(fs2 + ' 没解析到任何 in 变量');
    for (const [n, t] of ins) {
      if (!outs.has(n)) throw new Error(`${fs2} 的 in ${n} 在 ${vs} 里没有对应 out`);
      if (outs.get(n) !== t) throw new Error(`${n} 类型不一致: ${vs}=${outs.get(n)} ${fs2}=${t}`);
    }
    rep.push(`${vs.slice(3)}:${[...ins.keys()].join('/')}`);
  }
  return rep.join('  ');
});

T('JS 里引用的每个 uniform / attribute 都在着色器中声明', () => {
  const TYPES = 'vec2|vec3|vec4|float|int|mat2|mat3|mat4|sampler2D';
  const declared = new Set();
  for (const n of Object.keys(SH)) {
    let m;
    const ru = new RegExp('uniform\\s+(?:' + TYPES + ')\\s+([\\w,\\s]+);', 'g');
    while ((m = ru.exec(SH[n]))) for (const v of m[1].split(',')) declared.add(v.trim());
    const ra = new RegExp('\\bin\\s+(?:' + TYPES + ')\\s+(\\w+)\\s*;', 'g');
    while ((m = ra.exec(SH[n]))) declared.add(m[1]);
  }
  const usedU = new Set(), usedA = new Set();
  let m;
  const ru2 = /\.u\.(u[A-Z]\w*)/g;
  while ((m = ru2.exec(renderSrc))) usedU.add(m[1]);
  const ra2 = /\.a\.(a[A-Z]\w*)/g;
  while ((m = ra2.exec(renderSrc))) usedA.add(m[1]);
  const missing = [...usedU, ...usedA].filter((n) => !declared.has(n));
  if (missing.length) throw new Error('着色器里没有声明: ' + missing.join(', '));
  return `声明 ${declared.size} 个，JS 引用 uniform ${usedU.size} + attribute ${usedA.size}，全部匹配`;
});

T('着色器里没有明显的类型/括号错误（配对检查）', () => {
  for (const n of Object.keys(SH)) {
    const s = SH[n];
    const bal = (a, b) => { let c = 0; for (const ch of s) { if (ch === a) c++; else if (ch === b) c--; if (c < 0) throw new Error(n + ' 括号 ' + a + b + ' 不配对'); } if (c) throw new Error(n + ' 括号 ' + a + b + ' 未闭合(' + c + ')'); };
    bal('{', '}'); bal('(', ')');
    if (!/void\s+main\s*\(\s*\)\s*\{/.test(s)) throw new Error(n + ' 缺少 main()');
    if (/\bgl_FragColor\b/.test(s)) throw new Error(n + ' 使用了 GLSL ES 1.0 的 gl_FragColor');
    if (/\battribute\b|\bvarying\b/.test(s)) throw new Error(n + ' 使用了 GLSL ES 1.0 的 attribute/varying');
  }
  return '10 段全部通过';
});

T('渲染管线状态成对（BLEND / CULL_FACE / depthMask）', () => {
  const cnt = (re) => (renderSrc.match(re) || []).length;
  const en = cnt(/gl\.enable\(gl\.BLEND\)/g), di = cnt(/gl\.disable\(gl\.BLEND\)/g);
  if (en !== di) throw new Error(`BLEND enable ${en} 次 / disable ${di} 次，不成对`);
  const mOff = cnt(/gl\.depthMask\(false\)/g), mOn = cnt(/gl\.depthMask\(true\)/g);
  if (mOff !== mOn) throw new Error(`depthMask false ${mOff} 次 / true ${mOn} 次，不成对`);
  const cOff = cnt(/gl\.disable\(gl\.CULL_FACE\)/g), cOn = cnt(/gl\.enable\(gl\.CULL_FACE\)/g);
  if (cOn < cOff) throw new Error(`CULL_FACE 关 ${cOff} 次但只开 ${cOn} 次`);
  return `BLEND ${en}/${di} · depthMask ${mOff}/${mOn} · CULL_FACE ${cOff}/${cOn}`;
});

T('粒子尺寸走"世界米 × 透视缩放"，且有上限（防巨块碎屑）', () => {
  const vs = SH.VS_PART;
  const m = vs.match(/gl_PointSize\s*=\s*clamp\(([\s\S]*?),\s*([\d.]+)\s*,\s*([\d.]+)\s*\)\s*;/);
  if (!m) throw new Error('VS_PART 没有对 gl_PointSize 做 clamp');
  const maxPx = parseFloat(m[3]);
  if (maxPx > 32) throw new Error(`粒子最大像素 ${maxPx} 太大`);
  if (!/uScale\s*\/\s*max\(/.test(vs)) throw new Error('没有按深度 (p.w) 缩放');
  // uScale 必须由 fov 推出（屏幕高 / 2tan(fov/2)），否则尺寸与视角脱钩
  if (!/_pxPerUnit\s*=\s*this\.canvas\.height\s*\/\s*\(2\s*\*\s*Math\.tan\(/.test(renderSrc))
    throw new Error('uScale 不是由 fov 推导的透视缩放');
  // 游戏侧传入的尺寸必须是"米"级别
  const gameSrc = fs.readFileSync(path.join(root, 'src', 'game.js'), 'utf8');
  const def = gameSrc.match(/size\s*==\s*null\s*\?\s*([\d.]+)/);
  if (!def) throw new Error('spawnParticles 没有默认尺寸');
  const defSize = parseFloat(def[1]);
  if (defSize > 0.12) throw new Error(`默认粒子尺寸 ${defSize} 米偏大（碎屑会像方块一样）`);
  const sizes = [...gameSrc.matchAll(/spawnParticles\([^)]*?,\s*([\d.]+)\s*\)/g)].map((x) => parseFloat(x[1]));
  const big = sizes.filter((s) => s > 0.35);
  if (big.length) throw new Error('有过大的粒子尺寸: ' + big.join(','));
  const rain = gameSrc.match(/size:\s*([\d.]+),\s*life:\s*1\.6/);
  if (!rain || parseFloat(rain[1]) > 0.06) throw new Error('雨滴粒子过大');
  return `上限 ${maxPx}px · 默认 ${defSize}m · 调用点尺寸 ${Math.min(...sizes)}~${Math.max(...sizes)}m · 雨滴 ${rain[1]}m`;
});

T('移动基向量与 lookAt 的屏幕右一致（A/D 不会反）', () => {
  const gameSrc = fs.readFileSync(path.join(root, 'src', 'game.js'), 'utf8');
  if (!/U\.moveBasis\(p\.yaw\)/.test(gameSrc)) throw new Error('game.js 没有使用 GF.util.moveBasis');
  const B = GF.util.moveBasis(1.234);
  const cross = [-B.fz, 0, B.fx];        // cross(forward, up)
  const err = Math.hypot(B.rx - cross[0], B.rz - cross[2]);
  if (err > 1e-9) throw new Error('右向 ≠ cross(前向, 上) 偏差 ' + err);
  return 'right = cross(forward, up) ✓';
});

T('地面摩擦系数够高（不像冰面）', () => {
  const entSrc = fs.readFileSync(path.join(root, 'src', 'entities.js'), 'utf8');
  const m = entSrc.match(/this\.onGround\s*\?\s*([\d.]+)\s*:\s*([\d.]+)/);
  if (!m) throw new Error('没找到地面/空中阻尼系数');
  const ground = parseFloat(m[1]), air = parseFloat(m[2]);
  if (ground < 8) throw new Error(`地面阻尼 k=${ground} 太小，会打滑`);
  if (air > 3) throw new Error(`空中阻尼 k=${air} 太大，跳跃会被吃掉惯性`);
  if (!/Math\.exp\(-k \* dt\)/.test(entSrc)) throw new Error('阻尼没有用与帧率无关的指数衰减');
  const halfLife = Math.log(2) / ground;
  return `地面 k=${ground}（半衰期 ${(halfLife * 1000).toFixed(0)}ms）· 空中 k=${air} · 指数衰减与帧率无关`;
});

console.warn = origWarn;
console.log(`\n${fail === 0 ? '✅' : '❌'} 通过 ${pass} · 失败 ${fail}　（累计绘制调用 ${opCount}）\n`);
process.exitCode = fail ? 1 : 0;
