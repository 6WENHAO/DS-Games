/* 临时诊断：逐段打印双方发展曲线，找出一方发展不起来的原因 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const noop = () => {};
function ctxStub(cv) {
  const c = { canvas: cv, measureText: (s) => ({ width: (s || '').length * 6 }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), getLineDash: () => [] };
  for (const k of ['save','restore','translate','rotate','scale','beginPath','closePath','moveTo','lineTo','arc','ellipse','rect','fill','stroke','clip','fillRect','strokeRect','clearRect','fillText','strokeText','drawImage','setLineDash','putImageData','setTransform','transform','bezierCurveTo','quadraticCurveTo','arcTo','roundRect']) c[k] = noop;
  return c;
}
function cvStub(w, h) { const cv = { width: w || 1, height: h || 1, clientWidth: w || 1, clientHeight: h || 1, style: {}, _c: null, getContext() { if (!this._c) this._c = ctxStub(this); return this._c; }, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0 }) }; return cv; }
const sb = { console, Math, JSON, Date, Object, Array, String, Number, Boolean, Error, Map, Set, Promise, isFinite, isNaN, parseInt, parseFloat, RegExp, Function, Symbol, URLSearchParams, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, ArrayBuffer, setTimeout, clearTimeout, performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 }, devicePixelRatio: 1, requestAnimationFrame: () => 0, location: { search: '' } };
sb.window = sb; sb.globalThis = sb;
sb.document = { readyState: 'complete', createElement: (t) => (t === 'canvas' ? cvStub(1, 1) : { style: {}, classList: { add: noop, remove: noop, toggle: noop }, appendChild: noop, addEventListener: noop, children: [] }), getElementById: () => null, querySelectorAll: () => [], addEventListener: noop };
const cx = vm.createContext(sb);
for (const f of ['util.js','config.js','art.js','audio.js','mapgen.js','pathfind.js','fx.js','entity.js','game.js','ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), cx, { filename: f });
}
const R = sb.R;
const seed = parseInt(process.argv[2] || '20240601', 10);
const bothAI = process.argv.includes('--both');

const g = new R.Game({ seed, mapSize: 'medium', playerFaction: 'guard', difficulty: 'normal', fog: true });
if (bothAI) g.me.ai = new R.AI(g, g.me, 'normal');

// 记录 AI 的建造决策
const log = [];
const origQueueAdd = R.Game.prototype.queueAdd;
R.Game.prototype.queueAdd = function (p, id, n) {
  const r = origQueueAdd.call(this, p, id, n);
  if (R.isBuilding(id)) log.push([this.time.toFixed(0), p.index, id, r ? 'ok' : 'REJECT']);
  return r;
};
const origPlace = R.Game.prototype.tryPlacePending;
R.Game.prototype.tryPlacePending = function (p, cx2, cy2) {
  const r = origPlace.call(this, p, cx2, cy2);
  log.push([this.time.toFixed(0), p.index, 'PLACE@' + cx2 + ',' + cy2, r ? 'ok' : 'FAIL']);
  return r;
};
const origCancel = R.Game.prototype.queueCancel;
R.Game.prototype.queueCancel = function (p, id, all) {
  const r = origCancel.call(this, p, id, all);
  if (r) log.push([this.time.toFixed(0), p.index, 'CANCEL ' + id, '']);
  return r;
};

const STEP = 1 / 20;
const MIN = parseFloat(process.argv[3] || '8');
const steps = Math.round(MIN * 60 / STEP);
let nextReport = 0;
console.log('seed=' + seed + '  bothAI=' + bothAI);
console.log('出生点 A=' + JSON.stringify(g.map.starts[0]) + ' B=' + JSON.stringify(g.map.starts[1]));
// 双方近矿检查
for (let i = 0; i < 2; i++) {
  const s = g.map.starts[i];
  const near = g.map.nearestOre(s.cx, s.cy, 30);
  let total = 0;
  for (let dy = -16; dy <= 16; dy++) for (let dx = -16; dx <= 16; dx++) {
    const x = s.cx + dx, y = s.cy + dy;
    if (g.map.inBounds(x, y)) total += g.map.ore[g.map.idx(x, y)];
  }
  console.log('  玩家' + i + ' 最近矿=' + (near ? (near.cx + ',' + near.cy + ' 距离' + Math.round(Math.hypot(near.cx - s.cx, near.cy - s.cy))) : '无') + '  16格内矿量=' + Math.round(total));
}
console.log('');
console.log('时间   P0建筑 P0兵 P0钱   P0采矿 | P1建筑 P1兵 P1钱   P1采矿 | P0矿车状态');
for (let i = 0; i < steps; i++) {
  g.update(STEP);
  if (g.time >= nextReport) {
    nextReport += 20;
    const a = g.players[0], b = g.players[1];
    const f = (v, w) => String(v).padStart(w);
    const hs = a.units.filter((u) => u.def.harvester).map((u) =>
      u.harvState + '(' + Math.round(u.cargo) + (u.oreCell ? '@' + u.oreCell.cx + ',' + u.oreCell.cy : '') +
      (u.path ? ' p' + (u.path.length - u.pathI) : ' p-') + (u.pathPending ? ' W' : '') + ')').join(' ');
    console.log(
      f(Math.round(g.time), 5) + f(a.buildings.length, 7) + f(a.units.length, 5) + f(Math.round(a.credits), 7) + f(Math.round(a.stats.harvested), 8) +
      ' |' + f(b.buildings.length, 6) + f(b.units.length, 5) + f(Math.round(b.credits), 7) + f(Math.round(b.stats.harvested), 8) +
      ' | ' + hs);
  }
  if (g.over) { console.log('对局结束于 ' + Math.round(g.time) + 's，结果=' + g.result); break; }
}
console.log('\n建造决策日志（前 70 条）：');
for (const l of log.slice(0, 70)) console.log('  t=' + String(l[0]).padStart(4) + ' P' + l[1] + ' ' + String(l[2]).padEnd(16) + l[3]);
console.log('\n最终 P0 建筑：' + g.players[0].buildings.map((x) => x.def.id).join(','));
console.log('最终 P1 建筑：' + g.players[1].buildings.map((x) => x.def.id).join(','));
