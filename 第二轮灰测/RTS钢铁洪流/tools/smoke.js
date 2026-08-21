/* ===================================================================
   tools/smoke.js — Node 无头逻辑冒烟测试
   用法： node tools/smoke.js  [--quick]

   用最小浏览器桩件加载全部逻辑模块，检查：
     · 数值表自洽（引用的武器/建筑/前置/美术键都存在）
     · 地图生成：连通性、出生区可建造、矿脉可达、180° 对称
     · 寻路：路径连续、不穿墙、失败时正确返回
     · 战斗数学：护甲倍率、对空/对地限制
     · 完整对局模拟：经济跑通、AI 会盖房出兵、真的打起来、坐标不 NaN
       且单位永远不会卡进不可通行地形
     · 渲染管线：用桩件 canvas 跑若干帧，保证绘制代码没有拼写错误
   =================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const QUICK = process.argv.includes('--quick');

/* ==================================================================
   1. 浏览器桩件
   ================================================================== */
function makeCtxStub(cv) {
  const noop = () => {};
  const ctx = {
    canvas: cv,
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    font: '10px sans-serif', textAlign: 'left', textBaseline: 'alphabetic',
    lineCap: 'butt', lineJoin: 'miter', imageSmoothingEnabled: true,
    shadowBlur: 0, shadowColor: '#000', globalCompositeOperation: 'source-over',
    filter: 'none', miterLimit: 10, lineDashOffset: 0,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    transform: noop, setTransform: noop, resetTransform: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop,
    bezierCurveTo: noop, quadraticCurveTo: noop,
    fill: noop, stroke: noop, clip: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop,
    fillText: noop, strokeText: noop,
    drawImage: noop, setLineDash: noop, getLineDash: () => [],
    measureText: (s) => ({ width: (s ? s.length : 0) * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({ setTransform: noop }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: noop,
    isPointInPath: () => false,
  };
  return ctx;
}

function makeCanvasStub(w, h) {
  const cv = {
    width: w || 1, height: h || 1,
    clientWidth: w || 1280, clientHeight: h || 720,
    style: {},
    _ctx: null,
    getContext() { if (!this._ctx) this._ctx = makeCtxStub(this); return this._ctx; },
    addEventListener: () => {}, removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: cv.clientWidth, height: cv.clientHeight }),
    appendChild: () => {}, toDataURL: () => 'data:,',
  };
  return cv;
}

const sandbox = {
  console,
  Math, JSON, Date, Object, Array, String, Number, Boolean, Error,
  Map, Set, WeakMap, Promise, Symbol, RegExp, Function, isFinite, isNaN,
  parseInt, parseFloat, undefined,
  Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array,
  Int8Array, Int16Array, Int32Array, Float32Array, Float64Array,
  ArrayBuffer, DataView, TextEncoder, TextDecoder,
  URLSearchParams,
  setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  devicePixelRatio: 1,
  location: { search: '' },
  navigator: { userAgent: 'node' },
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = {
  readyState: 'complete',
  createElement: (tag) => (tag === 'canvas' ? makeCanvasStub(1, 1) : {
    style: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    appendChild: () => {}, addEventListener: () => {}, innerHTML: '', textContent: '',
    children: [], setAttribute: () => {}, getAttribute: () => null,
  }),
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
};

const ctxObj = vm.createContext(sandbox);

/* ==================================================================
   2. 加载模块
   ================================================================== */
const MODULES = [
  'util.js', 'config.js', 'art.js', 'audio.js', 'mapgen.js',
  'pathfind.js', 'fx.js', 'entity.js', 'game.js', 'ai.js', 'render.js',
];

function load(file) {
  const p = path.join(ROOT, 'js', file);
  if (!fs.existsSync(p)) return { ok: false, err: '文件不存在' };
  const src = fs.readFileSync(p, 'utf8');
  try {
    vm.runInContext(src, ctxObj, { filename: 'js/' + file });
    return { ok: true };
  } catch (e) {
    return { ok: false, err: e && e.stack ? e.stack : String(e) };
  }
}

/* ==================================================================
   3. 测试框架
   ================================================================== */
let pass = 0, fail = 0;
const failures = [];
let group = '';

function G(name) { group = name; console.log('\n── ' + name + ' ' + '─'.repeat(Math.max(2, 58 - name.length))); }
function ok(cond, name, detail) {
  if (cond) { pass++; return true; }
  fail++;
  const msg = '[' + group + '] ' + name + (detail ? '　→ ' + detail : '');
  failures.push(msg);
  console.log('  ✗ ' + name + (detail ? '  → ' + detail : ''));
  return false;
}
function okq(cond, name, detail) {   // 只在失败时输出
  if (cond) { pass++; return true; }
  return ok(cond, name, detail);
}
function eq(a, b, name) { return ok(a === b, name, 'got ' + a + ' want ' + b); }
function num(v, name) { return ok(typeof v === 'number' && isFinite(v), name, 'got ' + v); }

/* ==================================================================
   开始
   ================================================================== */
console.log('钢铁洪流 · 逻辑冒烟测试' + (QUICK ? '（快速模式）' : ''));

G('模块加载');
for (const m of MODULES) {
  const r = load(m);
  ok(r.ok, '加载 ' + m, r.err);
  if (!r.ok && (m === 'util.js' || m === 'config.js')) {
    console.log('\n核心模块加载失败，中止。');
    process.exit(1);
  }
}
const R = sandbox.R;
ok(!!R, 'window.R 命名空间存在');
const U = R.U;

/* ------------------------------------------------------------------ */
G('美术 / 音频模块可用性');
if (R.Art) {
  let initErr = null;
  try { R.Art.init(); } catch (e) { initErr = e; }
  ok(!initErr, 'R.Art.init() 不抛异常', initErr && initErr.message);
  const artKeys = [];
  for (const k in R.BUILDINGS) artKeys.push(R.BUILDINGS[k].art);
  for (const k in R.UNITS) artKeys.push(R.UNITS[k].art);
  let artErr = null, drawn = 0;
  try {
    for (const k in R.BUILDINGS) {
      const d = R.BUILDINGS[k];
      if (R.Art.building(d.art, 'guard')) drawn++;
      R.Art.buildingDamaged(d.art, 'steel');
      R.Art.icon(d.id);
    }
    for (const k in R.UNITS) {
      const d = R.UNITS[k];
      for (let dir = 0; dir < 16; dir += 3) {
        R.Art.unit(d.art, 'guard', dir, dir & 3);
        R.Art.turretSprite(d.art, 'steel', dir);
      }
      R.Art.icon(d.id);
      R.Art.wreck(d.art);
    }
    for (const kind of ['grass', 'dirt', 'rock', 'water', 'shore']) {
      for (let v = 0; v < 8; v++) R.Art.tile(kind, v);
    }
    for (let l = 1; l <= 4; l++) R.Art.ore(l);
  } catch (e) { artErr = e; }
  ok(!artErr, '遍历全部美术资源不抛异常', artErr && artErr.stack);
} else {
  console.log('  · R.Art 未加载（渲染将使用兜底图形）');
}
if (R.Audio) {
  let aerr = null;
  try {
    R.Audio.init();
    for (const k in R.WEAPONS) {
      const s = R.WEAPONS[k].sfx;
      if (s) R.Audio.play(s, 10, 10);
    }
    for (const n of ['boomSmall', 'boomMedium', 'boomLarge', 'boomBuilding', 'hitSmall',
      'hitFlesh', 'build', 'buildDone', 'place', 'sell', 'oreDump', 'credit', 'powerDown']) R.Audio.play(n, 0, 0);
    for (const n of ['click', 'deny', 'select', 'order', 'tab']) R.Audio.ui(n);
    for (const n of ['unitReady', 'buildingReady', 'needPower', 'needCredits',
      'baseAttack', 'unitLost', 'ionReady', 'victory', 'defeat']) R.Audio.vo(n);
    R.Audio.update(0.016, 0, 0, 1);
  } catch (e) { aerr = e; }
  ok(!aerr, '音频接口在无 AudioContext 环境下安全降级', aerr && aerr.message);
  eq(R.Audio.ready, false, 'Node 下 R.Audio.ready === false');
}

/* ------------------------------------------------------------------ */
G('数值表自洽性');
{
  // 武器
  for (const k in R.WEAPONS) {
    const w = R.WEAPONS[k];
    okq(typeof w.name === 'string' && w.name.length > 0, '武器 ' + k + ' 有名字');
    okq(w.dmg > 0, '武器 ' + k + ' 伤害 > 0', w.dmg);
    okq(w.range > 0, '武器 ' + k + ' 射程 > 0', w.range);
    okq(w.cd >= 0, '武器 ' + k + ' 冷却 >= 0', w.cd);
    okq(!!R.PROJ[w.proj], '武器 ' + k + ' 的投射物类型 ' + w.proj + ' 已定义');
    okq(!!w.vs, '武器 ' + k + ' 有护甲倍率表');
    if (w.vs) for (const a in w.vs) okq(!!R.ARMOR[a], '武器 ' + k + ' 的护甲键 ' + a + ' 合法');
    if (w.minRange) okq(w.minRange < w.range, '武器 ' + k + ' 最小射程 < 最大射程');
  }
  // 建筑
  for (const k in R.BUILDINGS) {
    const d = R.BUILDINGS[k];
    eq(d.id, k, '建筑 ' + k + ' 的 id 与键一致');
    okq(d.cost > 0, '建筑 ' + k + ' 造价 > 0');
    okq(d.build > 0, '建筑 ' + k + ' 工期 > 0');
    okq(d.hp > 0, '建筑 ' + k + ' 生命 > 0');
    okq(d.size && d.size.w > 0 && d.size.h > 0, '建筑 ' + k + ' 占地合法');
    okq(!!R.ARMOR[d.armor], '建筑 ' + k + ' 护甲类型合法');
    okq(typeof d.art === 'string', '建筑 ' + k + ' 有美术键');
    okq(['base', 'def'].includes(d.tab), '建筑 ' + k + ' 分类合法', d.tab);
    for (const r of (d.req || [])) okq(!!R.BUILDINGS[r], '建筑 ' + k + ' 前置 ' + r + ' 存在');
    if (d.weapon) okq(!!R.WEAPONS[d.weapon], '建筑 ' + k + ' 武器 ' + d.weapon + ' 存在');
    if (d.freeUnit) okq(!!R.UNITS[d.freeUnit], '建筑 ' + k + ' 赠送单位 ' + d.freeUnit + ' 存在');
    if (d.undeploy) okq(!!R.UNITS[d.undeploy], '建筑 ' + k + ' 打包单位存在');
    if (d.superWeapon) okq(!!R.WEAPONS[d.superWeapon.weapon], '建筑 ' + k + ' 超武武器存在');
  }
  // 单位
  for (const k in R.UNITS) {
    const d = R.UNITS[k];
    eq(d.id, k, '单位 ' + k + ' 的 id 与键一致');
    okq(d.cost > 0, '单位 ' + k + ' 造价 > 0');
    okq(d.build > 0, '单位 ' + k + ' 工期 > 0');
    okq(d.hp > 0, '单位 ' + k + ' 生命 > 0');
    okq(d.speed > 0, '单位 ' + k + ' 速度 > 0');
    okq(d.rad > 0 && d.rad < R.TILE, '单位 ' + k + ' 半径合理', d.rad);
    okq(['infantry', 'vehicle', 'air'].includes(d.kind), '单位 ' + k + ' 类型合法');
    okq(!!R.ARMOR[d.armor], '单位 ' + k + ' 护甲类型合法');
    okq(typeof d.art === 'string', '单位 ' + k + ' 有美术键');
    okq(!!R.BUILDINGS[d.from], '单位 ' + k + ' 产线建筑 ' + d.from + ' 存在');
    for (const r of (d.req || [])) okq(!!R.BUILDINGS[r], '单位 ' + k + ' 前置 ' + r + ' 存在');
    if (d.weapon) okq(!!R.WEAPONS[d.weapon], '单位 ' + k + ' 武器 ' + d.weapon + ' 存在');
    if (d.deploysTo) okq(!!R.BUILDINGS[d.deploysTo], '单位 ' + k + ' 展开目标存在');
    if (d.faction) okq(!!R.FACTIONS[d.faction], '单位 ' + k + ' 阵营键合法');
    okq(R.TABS.some((t) => t.id === d.tab), '单位 ' + k + ' 分类 ' + d.tab + ' 在 TABS 中');
  }
  // 两个阵营都要能造出完整的科技链
  for (const f in R.FACTIONS) {
    const list = R.buildableFor(f);
    ok(list.length > 15, '阵营 ' + f + ' 可造项数量充足', list.length);
    // 每个阵营都要有主战坦克与专属兵
    const ids = list.map((d) => d.id);
    ok(ids.includes('harvester') && ids.includes('conyard') && ids.includes('refinery'),
      '阵营 ' + f + ' 具备核心经济链');
    const uniq = R.FACTIONS[f].unique || [];
    for (const uid of uniq) ok(ids.includes(uid), '阵营 ' + f + ' 专属单位 ' + uid + ' 可用');
  }
  // 科技树无环、可达：从空基地出发能不能一路解锁到最高级
  {
    const owned = new Set(['conyard']);
    let grew = true, guard = 0;
    while (grew && guard++ < 30) {
      grew = false;
      for (const k in R.BUILDINGS) {
        if (owned.has(k)) continue;
        const req = R.BUILDINGS[k].req || [];
        if (req.every((r) => owned.has(r))) { owned.add(k); grew = true; }
      }
    }
    for (const k in R.BUILDINGS) ok(owned.has(k), '建筑 ' + k + ' 在科技树上可达');
    for (const k in R.UNITS) {
      const d = R.UNITS[k];
      const okReq = owned.has(d.from) && (d.req || []).every((r) => owned.has(r));
      ok(okReq, '单位 ' + k + ' 在科技树上可达');
    }
  }
}

/* ------------------------------------------------------------------ */
G('战斗数学');
{
  const mg = R.WEAPONS.mg, aa = R.WEAPONS.aaGun, rocket = R.WEAPONS.rocketAT;
  eq(R.armorMul(mg, 'infantry'), 1.0, '机枪打步兵倍率 1.0');
  ok(R.armorMul(mg, 'heavy') < 0.2, '机枪打重甲倍率很低', R.armorMul(mg, 'heavy'));
  eq(R.armorMul(mg, 'nonexistent'), 1, '未定义护甲键回退 1.0');
  ok(!R.canTarget(mg, { kind: 'air', armor: 'air' }), '机枪不能打飞机');
  ok(R.canTarget(rocket, { kind: 'air', armor: 'air' }), '火箭能打飞机');
  ok(R.canTarget(aa, { kind: 'air', armor: 'air' }), '防空炮能打飞机');
  ok(!R.canTarget(aa, { kind: 'vehicle', armor: 'heavy' }), '防空炮不能打地面（airOnly）');
  ok(!R.canTarget(null, { kind: 'vehicle', armor: 'light' }), '无武器不能攻击');
  // 火炮不该能打飞机
  ok(!R.canTarget(R.WEAPONS.artilleryGun, { kind: 'air', armor: 'air' }), '火炮不能打飞机');
  // 相克关系应当成立：反装甲武器打重甲 > 机枪打重甲
  ok(R.armorMul(rocket, 'heavy') > R.armorMul(mg, 'heavy') * 4, '火箭对重甲远优于机枪');
  ok(R.armorMul(mg, 'infantry') > R.armorMul(rocket, 'infantry') * 1.5, '机枪对步兵优于火箭');
}

/* ------------------------------------------------------------------ */
G('工具函数');
{
  eq(U.clamp(5, 0, 3), 3, 'clamp 上限');
  eq(U.clamp(-5, 0, 3), 0, 'clamp 下限');
  eq(U.dir8(0), 0, 'dir8(0) = 0（东）');
  eq(U.dir8(Math.PI / 2), 2, 'dir8(PI/2) = 2（南）');
  eq(U.dir8(Math.PI), 4, 'dir8(PI) = 4（西）');
  eq(U.dir16(0), 0, 'dir16(0) = 0');
  ok(U.dir8(-0.01) >= 0 && U.dir8(-0.01) < 8, 'dir8 负角度不越界', U.dir8(-0.01));
  for (let a = -20; a < 20; a += 0.37) {
    const d8 = U.dir8(a), d16 = U.dir16(a);
    okq(d8 >= 0 && d8 < 8 && Number.isInteger(d8), 'dir8 值域', a + '→' + d8);
    okq(d16 >= 0 && d16 < 16 && Number.isInteger(d16), 'dir16 值域', a + '→' + d16);
  }
  eq(U.comma(1234567), '1,234,567', 'comma 千分位');
  eq(U.comma(-1234), '-1,234', 'comma 负数');
  eq(U.mmss(65), '1:05', 'mmss 格式');
  ok(Math.abs(Math.abs(U.wrapAngle(Math.PI * 3)) - Math.PI) < 1e-9, 'wrapAngle 归一化到 ±PI');
  ok(Math.abs(U.wrapAngle(0.5) - 0.5) < 1e-12, 'wrapAngle 区间内不变');
  ok(Math.abs(U.wrapAngle(U.TAU + 0.5) - 0.5) < 1e-12, 'wrapAngle 减去整圈');
  // 随机可复现
  const r1 = R.rng(42), r2 = R.rng(42);
  let same = true;
  for (let i = 0; i < 50; i++) if (r1() !== r2()) same = false;
  ok(same, '同种子 rng 完全可复现');
  const r3 = R.rng(7);
  let inRange = true;
  for (let i = 0; i < 500; i++) { const v = r3.int(3, 9); if (v < 3 || v > 9 || !Number.isInteger(v)) inRange = false; }
  ok(inRange, 'rng.int 值域正确且为整数');
  // 堆
  const h = new R.Heap();
  const vals = [5, 3, 9, 1, 7, 2, 8];
  for (const v of vals) h.push(v, v);
  const outv = [];
  while (h.size) outv.push(h.pop());
  eq(outv.join(','), '1,2,3,5,7,8,9', '二叉堆出堆有序');
  // 空间哈希
  const sh = new R.SpatialHash(32);
  sh.rebuild([{ x: 10, y: 10 }, { x: 200, y: 200 }, { x: 15, y: 12 }]);
  const found = sh.query(12, 11, 20, []);
  ok(found.length >= 2, '空间哈希查询命中邻居', found.length);
  ok(!found.includes(undefined), '空间哈希不返回空洞');
}

/* ------------------------------------------------------------------ */
G('地图生成');
const mapSeeds = QUICK ? [1] : [1, 7, 99, 20240521, 777777];
const mapSizes = QUICK ? ['medium'] : ['small', 'medium', 'large'];
for (const size of mapSizes) {
  for (const seed of mapSeeds) {
    const map = R.generateMap(size, seed);
    const tag = size + '/' + seed;
    okq(map.w === R.MAP_SIZES[size].w, tag + ' 尺寸正确');
    okq(map.starts.length === 2, tag + ' 有两个出生点');
    const [a, b] = map.starts;
    // 出生点对称
    okq(a.cx + b.cx === map.w - 1 && a.cy + b.cy === map.h - 1, tag + ' 出生点 180° 对称');
    // 出生点能放下建造厂
    const cyDef = R.BUILDINGS.conyard;
    for (const s of map.starts) {
      const cx = s.cx - 1, cy = s.cy - 1;
      okq(map.footprintOk(cx, cy, cyDef.size.w, cyDef.size.h), tag + ' 出生点可放建造厂');
      // 周围要有足够空地展开基地
      let free = 0;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        if (map.canBuildAt(s.cx + dx, s.cy + dy)) free++;
      }
      okq(free > 120, tag + ' 出生点周围空地充足', free);
    }
    // 连通性
    const seen = new Uint8Array(map.w * map.h);
    const q = [a.cy * map.w + a.cx];
    seen[q[0]] = 1;
    let head = 0, reach = 1;
    while (head < q.length) {
      const i = q[head++];
      const cx = i % map.w, cy = (i / map.w) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (!map.inBounds(nx, ny)) continue;
        const j = ny * map.w + nx;
        if (seen[j] || map.solid[j]) continue;
        seen[j] = 1; q.push(j); reach++;
      }
    }
    okq(seen[b.cy * map.w + b.cx] === 1, tag + ' 两出生点连通');
    okq(reach > map.w * map.h * 0.35, tag + ' 可通行区域占比合理', (reach / (map.w * map.h)).toFixed(2));
    // 矿脉
    let oreTotal = 0, oreCells = 0;
    for (let i = 0; i < map.ore.length; i++) if (map.ore[i] > 0) { oreTotal += map.ore[i]; oreCells++; }
    okq(oreCells > 60, tag + ' 矿格数量充足', oreCells);
    okq(oreTotal > 3000, tag + ' 矿脉总量充足', Math.round(oreTotal));
    for (const s of map.starts) {
      const near = map.nearestOre(s.cx, s.cy, 22);
      okq(!!near, tag + ' 出生点 22 格内有矿');
      if (near) {
        okq(!map.solid[near.cy * map.w + near.cx], tag + ' 近矿格可通行');
        // 矿必须从出生点走得到
        okq(seen[near.cy * map.w + near.cx] === 1, tag + ' 近矿从出生点可达');
      }
    }
    // 矿量对称（允许边界误差）
    let half1 = 0, half2 = 0;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const v = map.ore[y * map.w + x];
      const d = (x - (map.w - 1) / 2) + (y - (map.h - 1) / 2);
      if (d < 0) half1 += v; else if (d > 0) half2 += v;
    }
    const diff = Math.abs(half1 - half2) / Math.max(1, half1 + half2);
    okq(diff < 0.25, tag + ' 两侧矿量大体均衡', diff.toFixed(3));
    // 地形值合法
    let badT = 0;
    for (let i = 0; i < map.terrain.length; i++) if (map.terrain[i] > 4) badT++;
    okq(badT === 0, tag + ' 无非法地形值', badT);
    // 矿脉再生不炸
    map.regrow(1.0);
    let nan = 0;
    for (let i = 0; i < map.ore.length; i++) if (!isFinite(map.ore[i]) || map.ore[i] < 0) nan++;
    okq(nan === 0, tag + ' 矿脉再生后数值合法', nan);
  }
}

/* ------------------------------------------------------------------ */
G('寻路');
{
  const map = R.generateMap('medium', 20240521);
  const rnd = R.rng(31337);
  let found = 0, tried = 0, badCell = 0, discont = 0;
  const T = R.TILE;
  for (let k = 0; k < (QUICK ? 60 : 240); k++) {
    const pick = () => {
      for (let t = 0; t < 200; t++) {
        const cx = rnd.int(1, map.w - 2), cy = rnd.int(1, map.h - 2);
        if (map.passable(cx, cy)) return { cx, cy };
      }
      return null;
    };
    const s = pick(), e = pick();
    if (!s || !e) continue;
    tried++;
    const pts = R.Path.find(map, (s.cx + 0.5) * T, (s.cy + 0.5) * T, (e.cx + 0.5) * T, (e.cy + 0.5) * T);
    if (!pts) continue;
    found++;
    // 所有拐点必须在可通行格上
    for (const p of pts) {
      const cx = Math.floor(p.x / T), cy = Math.floor(p.y / T);
      if (!map.passable(cx, cy)) badCell++;
      if (!isFinite(p.x) || !isFinite(p.y)) badCell++;
    }
    // 相邻拐点之间必须视线可达（平滑的正确性前提）
    let px = (s.cx + 0.5) * T, py = (s.cy + 0.5) * T;
    for (const p of pts) {
      if (!R.losClear(map, px, py, p.x, p.y)) discont++;
      px = p.x; py = p.y;
    }
  }
  ok(tried > 0, '寻路测试样本非空');
  ok(found / tried > 0.9, '寻路成功率 > 90%', (found / tried).toFixed(3));
  eq(badCell, 0, '路径拐点全部落在可通行格');
  eq(discont, 0, '相邻拐点之间视线通畅');
  // 起点=终点
  const same = R.Path.find(map, 100, 100, 100, 100);
  ok(Array.isArray(same) && same.length === 0, '起终点同格返回空路径');
  // 目标在墙里 → 自动落到最近可通行格
  let wall = null;
  for (let i = 0; i < map.solid.length && !wall; i++) if (map.solid[i]) wall = i;
  if (wall !== null) {
    const wx = (wall % map.w + 0.5) * T, wy = ((wall / map.w | 0) + 0.5) * T;
    const st = map.starts[0];
    const p = R.Path.find(map, (st.cx + 0.5) * T, (st.cy + 0.5) * T, wx, wy);
    ok(p === null || Array.isArray(p), '目标不可通行时返回合法结果');
    if (Array.isArray(p) && p.length) {
      const last = p[p.length - 1];
      ok(map.passable(Math.floor(last.x / T), Math.floor(last.y / T)), '终点被替换为可通行格');
    }
  }
  // 视线函数本身
  ok(R.losClear(map, 100, 100, 100, 100), 'losClear 同点为真');
}

/* ------------------------------------------------------------------ */
G('对局：初始化与经济');
let g = null;
{
  g = new R.Game({ seed: 20240521, mapSize: 'medium', playerFaction: 'guard', difficulty: 'normal', fog: true });
  ok(!!g, '创建对局');
  eq(g.players.length, 2, '两名玩家');
  eq(g.me.faction, 'guard', '玩家阵营正确');
  eq(g.players[1].faction, 'steel', '敌方为对立阵营');
  ok(g.players[1].isAI && !!g.players[1].ai, 'AI 已挂载');
  for (const p of g.players) {
    okq(p.buildings.length === 1, p.name + ' 初始 1 座建造厂');
    okq(p.buildings[0].def.id === 'conyard', p.name + ' 初始建筑是建造厂');
    okq(p.units.length === 5, p.name + ' 初始 5 个单位', p.units.length);
    okq(p.countUnit('harvester') === 2, p.name + ' 初始 2 辆矿车');
    okq(p.credits === R.RULES.startCredits, p.name + ' 初始资金正确');
  }
  // 建造厂必须真的占了格子
  const b0 = g.me.buildings[0];
  let occ = 0;
  b0.forEachCell((x, y) => { if (g.map.occupied[g.map.idx(x, y)] === b0.id) occ++; });
  eq(occ, b0.w * b0.h, '建造厂占用格数正确');
  ok(!g.map.passable(b0.cx, b0.cy), '建筑占用格变为不可通行');

  // 电力
  g.recomputePower(g.me);
  eq(g.me.powerMade, 0, '初始无发电');
  eq(g.me.powerEff, 1, '无耗电时效率 100%');

  // 队列：发电厂
  ok(g.queueAdd(g.me, 'power'), '可以排入发电厂');
  ok(!g.queueAdd(g.me, 'refinery'), '缺前置（发电厂）时不能排精炼厂');
  const q = g.me.queues.structure;
  eq(q.length, 1, '队列长度 1');
  const before = g.me.credits;
  for (let i = 0; i < 400 && !q[0].ready; i++) g.updateQueues(g.me, 0.05);
  ok(q[0].ready, '发电厂建造完成并进入待放置');
  eq(g.me.pendingBuild, 'power', 'pendingBuild 已设置');
  ok(g.me.credits < before, '建造过程扣款', before + '→' + g.me.credits);
  ok(Math.abs((before - g.me.credits) - R.BUILDINGS.power.cost) < 2, '扣款总额≈造价');

  // 放置
  const cy0 = g.findConyard(g.me);
  let placed = false;
  for (let r = 2; r <= 8 && !placed; r++) {
    for (let dy = -r; dy <= r && !placed; dy++) {
      for (let dx = -r; dx <= r && !placed; dx++) {
        const cx = cy0.cx + dx, cyy = cy0.cy + dy;
        if (g.canPlace(g.me, R.BUILDINGS.power, cx, cyy)) {
          placed = g.tryPlacePending(g.me, cx, cyy);
        }
      }
    }
  }
  ok(placed, '发电厂成功放置');
  eq(g.me.pendingBuild, null, '放置后 pendingBuild 清空');
  eq(g.me.queues.structure.length, 0, '放置后队列清空');
  eq(g.me.powerMade, 100, '发电量 +100');
  ok(g.me.has('power'), 'has(power) 为真');
  ok(g.queueAdd(g.me, 'refinery'), '有发电厂后可排精炼厂');
  g.queueCancel(g.me, 'refinery', true);
  eq(g.me.queues.structure.length, 0, '取消队列生效');

  // 建造范围限制：挑一个离基地足够远的格子
  {
    const far = { cx: cy0.cx > g.map.w / 2 ? 2 : g.map.w - 5, cy: cy0.cy > g.map.h / 2 ? 2 : g.map.h - 5 };
    const gap = Math.max(Math.abs(far.cx - cy0.cx), Math.abs(far.cy - cy0.cy));
    ok(gap > R.RULES.buildRadius + 4, '测试格确实在建造范围之外', gap);
    ok(!g.canPlace(g.me, R.BUILDINGS.power, far.cx, far.cy), '建造范围外无法放置');
    ok(g.canPlace(g.me, R.BUILDINGS.power, far.cx, far.cy, true), 'ignoreRadius 可绕过范围限制（基地车展开用）');
  }
  // 水面/岩石上不能建
  let solidCell = null;
  for (let i = 0; i < g.map.solid.length && !solidCell; i++) {
    if (g.map.solid[i]) solidCell = { cx: i % g.map.w, cy: (i / g.map.w) | 0 };
  }
  if (solidCell) ok(!g.map.canBuildAt(solidCell.cx, solidCell.cy), '不可通行地形不可建造');
}

/* ------------------------------------------------------------------ */
G('对局：单位与战斗');
{
  const g2 = new R.Game({ seed: 4242, mapSize: 'small', playerFaction: 'steel', difficulty: 'easy', fog: false });
  const p0 = g2.players[0], p1 = g2.players[1];
  const c = g2.map.centerOf(g2.map.starts[0].cx, g2.map.starts[0].cy);
  const atk = g2.spawnUnit(p0, 'rifleman', c.x + 40, c.y + 60);
  const vic = g2.spawnUnit(p1, 'rifleman', c.x + 60, c.y + 60);
  ok(!!atk && !!vic, '可以生成单位');
  ok(atk.isEnemy(vic), '敌对判定正确');
  ok(!atk.isEnemy(g2.spawnUnit(p0, 'rifleman', c.x, c.y + 80)), '同阵营不敌对');

  // 伤害
  const hp0 = vic.hp;
  R.Combat.hit(vic, atk, R.WEAPONS.mg, vic.x, vic.y, 0);
  ok(vic.hp < hp0, '直接命中造成伤害', hp0 + '→' + vic.hp);
  const expect = R.WEAPONS.mg.dmg * R.armorMul(R.WEAPONS.mg, 'infantry');
  ok(Math.abs((hp0 - vic.hp) - expect) < 0.01, '伤害数值等于 伤害×护甲倍率');
  // 打不到的目标
  const air = g2.spawnUnit(p1, 'gunship', c.x + 90, c.y + 60);
  if (air) {
    const ahp = air.hp;
    R.Combat.hit(air, atk, R.WEAPONS.mg, air.x, air.y, 0);
    eq(air.hp, ahp, '机枪对飞机零伤害');
  }
  // 溅射（注意：溅射用空间哈希查询，必须先 rebuildHash）
  const v2 = g2.spawnUnit(p1, 'rifleman', c.x + 64, c.y + 64);
  const h2 = v2 ? v2.hp : 0;
  g2.rebuildHash();
  R.Combat.splash(c.x + 62, c.y + 62, 40, 60, R.WEAPONS.artilleryGun, atk, 1);
  if (v2) ok(v2.hp < h2, '溅射伤害命中范围内单位', h2 + '→' + (v2 ? v2.hp : '?'));
  if (v2) {
    // 远处的同类不该被波及
    const far2 = g2.spawnUnit(p1, 'rifleman', c.x + 400, c.y + 400);
    const fh = far2 ? far2.hp : 0;
    g2.rebuildHash();
    R.Combat.splash(c.x + 62, c.y + 62, 40, 60, R.WEAPONS.artilleryGun, atk, 1);
    if (far2) eq(far2.hp, fh, '溅射不影响范围外单位');
  }
  // 死亡
  vic.damage(99999, atk, R.WEAPONS.mg);
  ok(vic.dead, '致死伤害导致死亡');
  ok(p0.stats.kills > 0, '击杀计入统计');
  g2.cleanup();
  ok(!p1.units.includes(vic), '死亡单位从玩家列表移除');
  ok(!g2.units.includes(vic), '死亡单位从全局列表移除');

  // 建筑受伤与死亡
  const b = p1.buildings[0];
  const bhp = b.hp;
  b.damage(100, atk, R.WEAPONS.tankCannon);
  ok(b.hp === bhp - 100, '建筑受伤');
  const cells = [];
  b.forEachCell((x, y) => cells.push([x, y]));
  b.damage(99999, atk, R.WEAPONS.tankCannon);
  g2.cleanup();
  ok(b.dead, '建筑可被摧毁');
  let cleared = true;
  for (const [x, y] of cells) if (g2.map.occupied[g2.map.idx(x, y)] !== 0) cleared = false;
  ok(cleared, '建筑摧毁后释放占用格');

  // 投射物（注意：spawnUnit 会把重叠位置挪开，所以角度必须按实际坐标算）
  const shooter = g2.spawnUnit(p0, 'grizzly', c.x, c.y);
  const target = g2.spawnUnit(p1, 'lightTank', c.x + 100, c.y);
  if (shooter && target) {
    const ang = Math.atan2(target.y - shooter.y, target.x - shooter.x);
    const pr = g2.spawnProjectile(shooter, target, R.WEAPONS.tankCannon, shooter.x, shooter.y, ang);
    ok(!!pr && g2.projectiles.length > 0, '可以生成投射物');
    let steps = 0;
    const thp = target.hp;
    while (!pr.dead && steps++ < 400) { g2.rebuildHash(); pr.update(1 / 60); }
    ok(pr.dead, '投射物最终结算（命中或过期）', 'steps=' + steps);
    ok(target.hp < thp || target.dead, '炮弹命中目标造成伤害',
      '距离' + Math.round(U.dist(shooter.x, shooter.y, target.x, target.y)) + ' hp' + thp + '→' + target.hp);
  }
  // 光束武器即时结算
  const sn = g2.spawnUnit(p0, 'sniper', c.x, c.y + 30);
  const t2 = g2.spawnUnit(p1, 'rifleman', c.x + 80, c.y + 30);
  if (sn && t2) {
    const ang2 = Math.atan2(t2.y - sn.y, t2.x - sn.x);
    const beam = g2.spawnProjectile(sn, t2, R.WEAPONS.sniperRifle, sn.x, sn.y, ang2);
    g2.rebuildHash();
    beam.update(1 / 60);
    ok(t2.hp < t2.maxHp || t2.dead, '狙击光束即时命中');
  }
}

/* ------------------------------------------------------------------ */
G('对局：特殊机制');
{
  const g3 = new R.Game({ seed: 909, mapSize: 'small', playerFaction: 'guard', difficulty: 'easy', fog: false });
  const me = g3.me, en = g3.players[1];
  const c = g3.map.centerOf(g3.map.starts[0].cx, g3.map.starts[0].cy);

  // 基地车展开
  const mcv = g3.spawnUnit(me, 'mcv', c.x + R.TILE * 6, c.y + R.TILE * 6);
  ok(!!mcv, '生成基地车');
  const before = me.buildings.length;
  const deployed = g3.tryDeployMcv(mcv);
  ok(deployed, '基地车可以展开');
  ok(me.buildings.length === before + 1, '展开后多一座建造厂');
  ok(mcv.dead, '展开后基地车消失');

  // 工程师占领
  const target = en.buildings[0];
  const eng = g3.spawnUnit(me, 'engineer', target.x, target.y + R.TILE * 3);
  const oldOwner = target.owner;
  g3.engineerEnter(eng, target);
  ok(target.owner === me && oldOwner === en, '工程师占领敌方建筑');
  ok(eng.dead, '工程师占领后消失');
  ok(me.buildings.includes(target) && !en.buildings.includes(target), '建筑归属列表已迁移');

  // 出售返还
  const sellTarget = me.buildings[me.buildings.length - 1];
  const cash = me.credits;
  const refund = Math.round(sellTarget.def.cost * R.RULES.sellRefund);
  g3.sell(sellTarget);
  ok(me.credits >= cash + refund, '出售返还资金', (me.credits - cash) + ' / ' + refund);

  // 采矿闭环
  const g4 = new R.Game({ seed: 1234, mapSize: 'small', playerFaction: 'guard', difficulty: 'easy', fog: false });
  const m4 = g4.me;
  // 直接给一座精炼厂
  const cyd = g4.findConyard(m4);
  let refPlaced = null;
  for (let r = 3; r <= 10 && !refPlaced; r++) {
    for (let dy = -r; dy <= r && !refPlaced; dy++) {
      for (let dx = -r; dx <= r && !refPlaced; dx++) {
        const cx = cyd.cx + dx, cyy = cyd.cy + dy;
        if (g4.canPlace(m4, R.BUILDINGS.refinery, cx, cyy)) {
          refPlaced = g4.placeBuilding(m4, 'refinery', cx, cyy, true);
        }
      }
    }
  }
  ok(!!refPlaced, '放置精炼厂');
  ok(m4.countUnit('harvester') >= 3, '精炼厂赠送矿车', m4.countUnit('harvester'));
  const startHarvested = m4.stats.harvested;
  for (const u of m4.units) if (u.def.harvester) u.orderHarvest(null);
  let deliveries = 0;
  for (let i = 0; i < 3600; i++) {          // 模拟 3 分钟
    g4.update(1 / 20);
    if (m4.stats.harvested > startHarvested + 400) { deliveries = 1; break; }
  }
  ok(deliveries === 1, '矿车完成采矿→卸矿闭环并入账', '采矿总额 ' + Math.round(m4.stats.harvested));
  // 至少有一辆车真的走完了完整循环
  const anyCycled = m4.units.some((u) => u.def.harvester && (u.harvState === 'toRef' || u.harvState === 'unload' || u.cargo > 0 || u.harvState === 'mining'));
  ok(anyCycled, '矿车处于有效工作状态');

  // 离子炮
  const g5 = new R.Game({ seed: 55, mapSize: 'small', playerFaction: 'steel', difficulty: 'easy', fog: false });
  const m5 = g5.me;
  const cy5 = g5.findConyard(m5);
  let ionB = null;
  for (let r = 3; r <= 10 && !ionB; r++) {
    for (let dy = -r; dy <= r && !ionB; dy++) {
      for (let dx = -r; dx <= r && !ionB; dx++) {
        if (g5.canPlace(m5, R.BUILDINGS.ion, cy5.cx + dx, cy5.cy + dy)) {
          ionB = g5.placeBuilding(m5, 'ion', cy5.cx + dx, cy5.cy + dy, true);
        }
      }
    }
  }
  ok(!!ionB, '放置离子炮');
  if (ionB) {
    const sw0 = g5.superWeaponState(m5);
    ok(sw0 && !sw0.ready, '离子炮初始未充能');
    ionB.chargeReady = true;
    const victim = g5.spawnUnit(g5.players[1], 'rifleman', cy5.x + 200, cy5.y + 200);
    g5.rebuildHash();
    const fired = g5.fireIon(m5, victim ? victim.x : cy5.x + 200, victim ? victim.y : cy5.y + 200);
    ok(fired, '离子炮可以发射');
    ok(!victim || victim.dead, '离子炮消灭范围内步兵');
    ok(!g5.superWeaponState(m5).ready, '发射后需要重新充能');
  }

  // 阵型：不重叠、在界内
  const g6 = new R.Game({ seed: 66, mapSize: 'medium', playerFaction: 'guard', difficulty: 'easy', fog: false });
  const cc = g6.map.centerOf(20, 20);
  const troop = [];
  for (let i = 0; i < 24; i++) {
    const u = g6.spawnUnit(g6.me, 'grizzly', cc.x + (i % 5) * 20, cc.y + Math.floor(i / 5) * 20);
    if (u) troop.push(u);
  }
  const slots = g6.formation(troop, cc.x + 300, cc.y + 300);
  eq(slots.length, troop.length, '阵型槽位数量等于单位数');
  let dup = 0, oob = 0;
  for (let i = 0; i < slots.length; i++) {
    if (!isFinite(slots[i].x) || !isFinite(slots[i].y)) oob++;
    if (slots[i].x < 0 || slots[i].y < 0 || slots[i].x > g6.map.pxW || slots[i].y > g6.map.pxH) oob++;
    for (let j = i + 1; j < slots.length; j++) {
      if (U.dist(slots[i].x, slots[i].y, slots[j].x, slots[j].y) < 1) dup++;
    }
  }
  eq(dup, 0, '阵型槽位互不重合');
  eq(oob, 0, '阵型槽位全在地图内且数值合法');

  // 迷雾
  const g7 = new R.Game({ seed: 77, mapSize: 'small', playerFaction: 'guard', difficulty: 'easy', fog: true });
  g7.updateFog();
  const myBase = g7.findConyard(g7.me);
  ok(g7.visibleTo(g7.me, myBase.x, myBase.y), '己方基地可见');
  const enBase = g7.findConyard(g7.players[1]);
  ok(!g7.visibleTo(g7.me, enBase.x, enBase.y), '敌方基地初始不可见');
  ok(!g7.exploredBy(g7.me, enBase.x, enBase.y), '敌方基地初始未探明');
  // 侦察后应当可见
  const spy = g7.spawnUnit(g7.me, 'scout', enBase.x, enBase.y + R.TILE * 2);
  g7.updateFog();
  ok(g7.visibleTo(g7.me, enBase.x, enBase.y), '单位靠近后敌方基地可见');
  ok(g7.me.knownEnemy.size > 0, '已探明敌方建筑记入记忆');
  if (spy) spy.dead = true;
  g7.cleanup();
  g7.updateFog();
  ok(g7.exploredBy(g7.me, enBase.x, enBase.y), '离开后仍保留"已探明"状态');
  ok(!g7.visibleTo(g7.me, enBase.x, enBase.y), '离开后不再"可见"');
}

/* ------------------------------------------------------------------ */
G('完整对局长时模拟');
{
  const MINUTES = QUICK ? 3 : 9;
  const STEP = 1 / 20;
  const steps = Math.round(MINUTES * 60 / STEP);
  const gg = new R.Game({ seed: 20240601, mapSize: 'medium', playerFaction: 'guard', difficulty: 'normal', fog: true });
  // 让人类一方也由 AI 托管，这样才能测出"双方都在正常运作"。
  // 注意：Game.update 内部已经会驱动所有带 .ai 的玩家，
  // 这里绝不能再手动调一次 ai.update —— 否则托管方思考频率翻倍，
  // 会把对手单方面打崩，测出来的就不是平衡性而是测试脚本的 bug。
  gg.me.ai = new R.AI(gg, gg.me, 'normal');

  let err = null, nanCount = 0, oobCount = 0, stuckInWall = 0;
  const t0 = Date.now();
  let maxUnits = 0, firstKillT = -1, firstBuildT = -1;
  // 记录"曾经达到过"的状态：对局可能提前结束，用峰值而不是终局值来断言
  const peak = gg.players.map(() => ({ buildings: 0, units: 0, sawPower: false, sawRefinery: false, harvesters: 0 }));
  const T = R.TILE;

  for (let i = 0; i < steps; i++) {
    try {
      gg.update(STEP);
    } catch (e) { err = e; break; }

    if (i % 20 === 0) {
      for (const u of gg.units) {
        if (!isFinite(u.x) || !isFinite(u.y) || !isFinite(u.hp) || !isFinite(u.angle)) nanCount++;
        if (u.x < -T || u.y < -T || u.x > gg.map.pxW + T || u.y > gg.map.pxH + T) oobCount++;
        if (!u.isAir) {
          const cx = Math.floor(u.x / T), cy = Math.floor(u.y / T);
          if (gg.map.inBounds(cx, cy) && gg.map.solid[gg.map.idx(cx, cy)]) stuckInWall++;
        }
      }
      maxUnits = Math.max(maxUnits, gg.units.length);
      for (let pi = 0; pi < gg.players.length; pi++) {
        const p = gg.players[pi], k = peak[pi];
        k.buildings = Math.max(k.buildings, p.buildings.length);
        k.units = Math.max(k.units, p.units.length);
        k.harvesters = Math.max(k.harvesters, p.countUnit('harvester'));
        if (p.has('power')) k.sawPower = true;
        if (p.has('refinery')) k.sawRefinery = true;
      }
      if (firstKillT < 0 && (gg.me.stats.kills > 0 || gg.players[1].stats.kills > 0)) firstKillT = gg.time;
      if (firstBuildT < 0 && gg.players[1].buildings.length > 1) firstBuildT = gg.time;
    }
    if (gg.over) break;
  }
  const ms = Date.now() - t0;

  ok(!err, '长时模拟无异常抛出', err && err.stack);
  eq(nanCount, 0, '从未出现 NaN 坐标 / 生命值');
  eq(oobCount, 0, '单位从未跑出地图');
  eq(stuckInWall, 0, '单位从未卡进不可通行地形');

  const ai = gg.players[1];
  for (let pi = 0; pi < 2; pi++) {
    const p = gg.players[pi], k = peak[pi];
    const tag = 'P' + pi + '(' + p.name + ')';
    ok(k.buildings >= 5, tag + ' 盖出过至少 5 座建筑', k.buildings);
    ok(k.sawPower, tag + ' 造过发电厂');
    ok(k.sawRefinery, tag + ' 造过精炼厂');
    ok(p.stats.harvested > 2500, tag + ' 采矿收入正常', Math.round(p.stats.harvested));
    ok(p.stats.unitsBuilt > 8, tag + ' 生产了部队', p.stats.unitsBuilt);
    ok(k.harvesters >= 3, tag + ' 维持了矿车数量', k.harvesters);
    ok(p.powerMade > 0 || p.buildings.length === 0, tag + ' 有电力供应', p.powerMade);
    ok(p.credits >= 0, tag + ' 资金从不为负');
  }
  ok(firstBuildT > 0 && firstBuildT < 90, 'AI 在 90 秒内盖出第二座建筑', firstBuildT.toFixed(1) + 's');
  ok(firstKillT > 0, '双方在模拟期内交火', firstKillT > 0 ? firstKillT.toFixed(0) + 's' : '未交火');
  ok(maxUnits > 14, '战场上出现过足够多的单位', maxUnits);
  // 平衡性：同难度互打不该在 2 分钟内一边倒
  if (gg.over) ok(gg.time > 150, '同难度对局不会在 2.5 分钟内结束', U.mmss(gg.time));

  const simSpeed = (gg.time / (ms / 1000));
  ok(simSpeed > 8, '模拟速度足够（>8× 实时）', simSpeed.toFixed(1) + '×');
  console.log('  · 模拟 ' + U.mmss(gg.time) + ' 游戏时间，耗时 ' + ms + 'ms（' + simSpeed.toFixed(1) + '× 实时）');
  console.log('  · 我方 建筑' + gg.me.buildings.length + ' 单位' + gg.me.units.length +
    ' 击杀' + gg.me.stats.kills + ' 采矿' + Math.round(gg.me.stats.harvested));
  console.log('  · 敌方 建筑' + ai.buildings.length + ' 单位' + ai.units.length +
    ' 击杀' + ai.stats.kills + ' 采矿' + Math.round(ai.stats.harvested));
  console.log('  · 寻路 请求' + gg.pathQueue.stats.requests + ' 完成' + gg.pathQueue.stats.done +
    ' 失败' + gg.pathQueue.stats.fails);
  const failRate = gg.pathQueue.stats.fails / Math.max(1, gg.pathQueue.stats.requests);
  ok(failRate < 0.2, '寻路失败率 < 20%', (failRate * 100).toFixed(1) + '%');

  /* 胜负判定 */
  const g8 = new R.Game({ seed: 8888, mapSize: 'small', playerFaction: 'guard', difficulty: 'easy', fog: false });
  for (const b of g8.players[1].buildings.slice()) { b.dead = true; g8.removeBuilding(b); }
  for (const u of g8.players[1].units.slice()) u.dead = true;
  g8.cleanup();
  g8.checkVictory();
  ok(g8.over && g8.result === 'win', '敌方全灭 → 胜利');

  const g9 = new R.Game({ seed: 9999, mapSize: 'small', playerFaction: 'guard', difficulty: 'easy', fog: false });
  for (const b of g9.me.buildings.slice()) { b.dead = true; g9.removeBuilding(b); }
  for (const u of g9.me.units.slice()) u.dead = true;
  g9.cleanup();
  g9.checkVictory();
  ok(g9.over && g9.result === 'lose', '我方全灭 → 战败');
}

/* ------------------------------------------------------------------ */
G('平衡性抽样（多种子 AI 对轰）');
{
  // 同难度 AI 互打若干局，检查：不会一边倒、不会僵死、双方都能发展。
  // 这是唯一能自动发现"某个数值改崩了游戏"的手段。
  const seeds = QUICK ? [11, 22] : [11, 22, 33, 44, 55, 66];
  const STEP = 1 / 15;
  const LIMIT = 60 * 6;       // 每局最多模拟 6 分钟
  const results = [];
  let earlyWipe = 0, deadlock = 0;

  for (const sd of seeds) {
    const gb = new R.Game({ seed: sd, mapSize: 'medium', playerFaction: 'guard', difficulty: 'normal', fog: true });
    gb.me.ai = new R.AI(gb, gb.me, 'normal');
    const steps = Math.round(LIMIT / STEP);
    let endT = LIMIT;
    for (let i = 0; i < steps; i++) {
      gb.update(STEP);
      if (gb.over) { endT = gb.time; break; }
    }
    const a = gb.players[0], b = gb.players[1];
    results.push({
      seed: sd, t: endT, over: gb.over,
      ab: a.buildings.length, bb: b.buildings.length,
      ah: Math.round(a.stats.harvested), bh: Math.round(b.stats.harvested),
      au: a.stats.unitsBuilt, bu: b.stats.unitsBuilt,
      ak: a.stats.kills, bk: b.stats.kills,
    });
    // 双方都必须真的把经济和兵力跑起来
    okq(a.stats.harvested > 2500 && b.stats.harvested > 2500,
      'seed ' + sd + ' 双方经济均已启动', a.stats.harvested.toFixed(0) + '/' + b.stats.harvested.toFixed(0));
    okq(a.stats.unitsBuilt > 8 && b.stats.unitsBuilt > 8,
      'seed ' + sd + ' 双方都在出兵', a.stats.unitsBuilt + '/' + b.stats.unitsBuilt);
    okq(a.stats.kills + b.stats.kills > 4,
      'seed ' + sd + ' 双方发生了实质交战', a.stats.kills + '/' + b.stats.kills);
    if (gb.over && endT < 120) earlyWipe++;
    if (!gb.over && a.stats.kills + b.stats.kills < 3) deadlock++;
  }

  console.log('  种子   结束(s) 已分胜负  建筑(我/敌) 采矿(我/敌)      出兵(我/敌) 击杀(我/敌)');
  for (const r of results) {
    const f = (v, w) => String(v).padStart(w);
    console.log('  ' + f(r.seed, 5) + f(r.t.toFixed(0), 8) + f(r.over ? '是' : '否', 8) +
      f(r.ab + '/' + r.bb, 12) + f(r.ah + '/' + r.bh, 16) + f(r.au + '/' + r.bu, 12) +
      f(r.ak + '/' + r.bk, 12));
  }
  eq(earlyWipe, 0, '没有任何一局在 2 分钟内被打崩');
  eq(deadlock, 0, '没有出现"6 分钟互不接触"的僵死局');
  // 不要求胜负 50/50（RTS 混沌很正常），但两侧长期均值不该悬殊
  let sumA = 0, sumB = 0;
  for (const r of results) { sumA += r.ah; sumB += r.bh; }
  const ratio = sumA / Math.max(1, sumB);
  ok(ratio > 0.55 && ratio < 1.8, '两侧平均经济产出量级相当', ratio.toFixed(2));
}

/* ------------------------------------------------------------------ */
G('渲染管线（桩件 canvas）');
if (R.Renderer) {
  let err = null;
  try {
    const gr = new R.Game({ seed: 31415, mapSize: 'small', playerFaction: 'guard', difficulty: 'easy', fog: true });
    // 先跑一段，让场上有建筑、单位、弹药、特效、贴花
    for (let i = 0; i < 1200; i++) gr.update(1 / 20);
    // 制造一些特效与残骸
    gr.fx.explosion(gr.me.buildings[0].x, gr.me.buildings[0].y, 'building');
    gr.fx.wreck(gr.me.buildings[0].x + 40, gr.me.buildings[0].y, 'grizzly', 1);
    gr.fx.corpse(gr.me.buildings[0].x + 20, gr.me.buildings[0].y, '#844', 0.5);
    gr.fx.rubble(gr.me.buildings[0].x - 40, gr.me.buildings[0].y, 60, 60);
    gr.fx.text(0, 0, 'test', '#fff', 12);
    gr.fx.beam(0, 0, 100, 100, '#fff', 3, 0.4);

    const cv = makeCanvasStub(1280, 720);
    const mm = makeCanvasStub(220, 220);
    const rr = new R.Renderer(gr, cv, mm);
    rr.resize();
    rr.centerOn(gr.startFocus.x, gr.startFocus.y);
    rr.showDebug = true;
    rr.showGrid = true;
    // 建造预览 + 超武瞄准 + 框选，把所有分支都画一遍
    rr.placeDef = R.BUILDINGS.refinery;
    rr.placeCell = { cx: 10, cy: 10 };
    rr.placeValid = true;
    rr.selBox = { x0: 10, y0: 10, x1: 200, y1: 160 };
    for (const e of gr.me.units) e.selected = true;
    gr.selection = gr.me.units.slice();
    for (let f = 0; f < 8; f++) { gr.update(1 / 60); rr.render(1 / 60); }
    rr.superTargeting = true;
    rr.placeDef = null;
    rr.render(1 / 60);
    // 各种缩放
    for (const z of [0.55, 0.8, 1, 1.4, 1.9]) { rr.setZoom(z, 100, 100); rr.render(1 / 60); }
    // 小地图无雷达分支
    for (const b of gr.me.buildings) if (b.def.givesRadar) b.dead = true;
    rr.render(1 / 60);
    ok(rr.frameMs >= 0, '渲染帧耗时可统计', rr.frameMs.toFixed(2) + 'ms');
    const w = rr.worldToScreen(100, 200);
    const back = rr.screenToWorld(w.x, w.y);
    ok(Math.abs(back.x - 100) < 0.01 && Math.abs(back.y - 200) < 0.01, '世界↔屏幕坐标可逆');
    const mmw = rr.minimapToWorld(50, 50);
    ok(isFinite(mmw.x) && isFinite(mmw.y), '小地图坐标换算合法');
  } catch (e) { err = e; }
  ok(!err, '渲染管线跑完 20+ 帧无异常', err && err.stack);
} else {
  console.log('  · R.Renderer 未加载，跳过');
}

/* ==================================================================
   汇总
   ================================================================== */
console.log('\n' + '='.repeat(64));
if (fail === 0) {
  console.log('全部通过：' + pass + ' / ' + pass + '　✔');
} else {
  console.log('结果：' + pass + ' 通过，' + fail + ' 失败');
  console.log('\n失败项：');
  for (const f of failures.slice(0, 60)) console.log('  · ' + f);
  if (failures.length > 60) console.log('  … 另有 ' + (failures.length - 60) + ' 项');
}
console.log('='.repeat(64));
process.exit(fail === 0 ? 0 : 1);
