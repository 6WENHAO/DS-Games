/* 临时性能探针：按阶段统计 Game.update 的耗时占比 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

const noop = () => {};
function ctxStub(cv) {
  const c = { canvas: cv, measureText: (s) => ({ width: (s || '').length * 6 }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    getLineDash: () => [] };
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

const acc = {};
const hr = () => Number(process.hrtime.bigint()) / 1e6;
function wrap(obj, name, label) {
  const orig = obj[name];
  if (typeof orig !== 'function') { console.log('缺少方法 ' + name); return; }
  obj[name] = function (...a) { const t = hr(); const r = orig.apply(this, a); acc[label] = (acc[label] || 0) + (hr() - t); return r; };
}

wrap(R.Game.prototype, 'rebuildHash', 'hash');
wrap(R.Game.prototype, 'separate', 'separate');
wrap(R.Game.prototype, 'updateFog', 'fog');
wrap(R.Game.prototype, 'cleanup', 'cleanup');
wrap(R.Game.prototype, 'checkBaseAttack', 'baseAttack');
wrap(R.Game.prototype, 'checkVictory', 'victory');
wrap(R.Game.prototype, 'updateRepairs', 'repairs');
wrap(R.Game.prototype, 'queryHostiles', 'queryHostiles');
wrap(R.Game.prototype, 'queryAll', 'queryAll');
wrap(R.GameMap.prototype, 'regrow', 'regrow');
wrap(R.GameMap.prototype, 'nearestOre', 'nearestOre');
wrap(R.PathQueue.prototype, 'process', 'pathProcess');
wrap(R.FX.prototype, 'update', 'fx');
wrap(R.Unit.prototype, 'update', 'units');
wrap(R.Building.prototype, 'update', 'buildings');
wrap(R.Projectile.prototype, 'update', 'projectiles');
wrap(R.AI.prototype, 'update', 'ai');
wrap(R.AI.prototype, 'findSpot', 'ai.findSpot');
wrap(R.AI.prototype, 'pickOreField', 'ai.pickOreField');
wrap(R.AI.prototype, 'thinkCommand', 'ai.thinkCommand');
wrap(R.AI.prototype, 'thinkArmy', 'ai.thinkArmy');
wrap(R.Unit.prototype, 'findTarget', 'unit.findTarget');
wrap(R.Unit.prototype, 'followPath', 'unit.followPath');
wrap(R.Unit.prototype, 'doCrush', 'unit.doCrush');
wrap(R.Unit.prototype, 'thinkHarvest', 'unit.harvest');

const MIN = parseFloat(process.argv[2] || '6');
const g = new R.Game({ seed: 20240601, mapSize: 'medium', playerFaction: 'guard', difficulty: 'normal', fog: true });
g.me.ai = new R.AI(g, g.me, 'normal');
const STEP = 1 / 20, steps = Math.round(MIN * 60 / STEP);
const t0 = hr();
for (let i = 0; i < steps; i++) { g.update(STEP); g.me.ai.update(STEP); if (g.over) break; }
const total = hr() - t0;

console.log('模拟 ' + MIN + ' 分钟游戏时间，真实耗时 ' + total.toFixed(0) + 'ms（' + (g.time / (total / 1000)).toFixed(1) + '× 实时）');
console.log('单位 ' + g.units.length + '  建筑 ' + g.buildings.length + '  弹 ' + g.projectiles.length);
console.log('我方建筑' + g.me.buildings.length + ' 采矿' + Math.round(g.me.stats.harvested) + ' 击杀' + g.me.stats.kills);
console.log('敌方建筑' + g.players[1].buildings.length + ' 采矿' + Math.round(g.players[1].stats.harvested) + ' 击杀' + g.players[1].stats.kills);
console.log('寻路 请求' + g.pathQueue.stats.requests + ' 完成' + g.pathQueue.stats.done + ' 失败' + g.pathQueue.stats.fails);
console.log('\n阶段耗时（含嵌套，可能重复计）：');
const rows = Object.keys(acc).map((k) => [k, acc[k]]).sort((a, b) => b[1] - a[1]);
for (const [k, v] of rows) {
  console.log('  ' + k.padEnd(20) + v.toFixed(0).padStart(8) + 'ms  ' + (v / total * 100).toFixed(1) + '%');
}
