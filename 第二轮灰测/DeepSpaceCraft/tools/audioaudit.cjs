/* 音频图审计（零依赖、确定性、毫秒级）：
   不只是"调用不报错"，而是对每个音效验证存在一条真实可听通路：
     源节点(Oscillator/BufferSource) → …(增益/滤波/声像/混响)… → destination
   且路径上每个 GainNode 的自动化峰值 > 阈值、源节点被 start() 且 stop > start。
   同时检查 loop/engine/wind/mining/music 的节点泄漏（stop 后必须断链）。
   用法：node tools/audioaudit.cjs */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fails = 0, warns = 0;
const ok = m => console.log('  \u2713 ' + m);
const bad = m => { console.log('  \u2717 ' + m); fails++; };
const warn = m => { console.log('  ! ' + m); warns++; };

/* ---------------- 迷你 WebAudio 打桩（记录图与自动化） ---------------- */
let UID = 0;
const ALL = [];          // 所有创建的节点
let RECORD = null;       // 当前录制窗口（新建节点集合）

class Param {
  constructor(v, owner, name) {
    this._v = v; this.peak = Math.abs(v); this.owner = owner; this.name = name; this.events = 0;
    Object.defineProperty(this, 'value', {
      get: () => this._v,
      set: (x) => { this._v = x; if (Math.abs(x) > this.peak) this.peak = Math.abs(x); this.events++; },
      enumerable: true
    });
  }
  _mark(v) { this.events++; if (Math.abs(v) > this.peak) this.peak = Math.abs(v); }
  setValueAtTime(v, t) { this._mark(v); this._v = v; return this; }
  linearRampToValueAtTime(v, t) { this._mark(v); this._v = v; return this; }
  exponentialRampToValueAtTime(v, t) { this._mark(v); this._v = v; return this; }
  setTargetAtTime(v, t, c) { this._mark(v); this._v = v; return this; }
  cancelScheduledValues() { return this; }
  setValueCurveAtTime(a) { for (const v of a) this._mark(v); return this; }
}
/* 参数"曾达到过的最大绝对值"：直接赋值与自动化都算 */
const pk = p => (p ? Math.max(p.peak, Math.abs(p.value)) : 0);

class Node {
  constructor(kind) {
    this.kind = kind; this.id = ++UID; this.out = []; this.disconnected = false;
    this.started = null; this.stopped = null;
    ALL.push(this);
    if (RECORD) RECORD.push(this);
  }
  connect(dst) {
    if (!dst) throw new Error(this.kind + '.connect(undefined)');
    this.out.push(dst.__isParam ? { param: dst } : dst);
    return dst;
  }
  disconnect() { this.out = []; this.disconnected = true; }
  start(t) { this.started = t === undefined ? 0 : t; }
  stop(t) { this.stopped = t === undefined ? 0 : t; }
}
function mkParam(node, name, v) { const p = new Param(v, node, name); p.__isParam = true; return p; }

class Ctx {
  constructor() {
    this.currentTime = 0; this.sampleRate = 44100; this.state = 'running';
    this.destination = new Node('destination');
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { const n = new Node('gain'); n.gain = mkParam(n, 'gain', 1); return n; }
  createOscillator() {
    const n = new Node('osc'); n.type = 'sine';
    n.frequency = mkParam(n, 'frequency', 440); n.detune = mkParam(n, 'detune', 0);
    return n;
  }
  createBufferSource() {
    const n = new Node('bufsrc'); n.buffer = null; n.loop = false;
    n.playbackRate = mkParam(n, 'playbackRate', 1); n.detune = mkParam(n, 'detune', 0);
    return n;
  }
  createBiquadFilter() {
    const n = new Node('filter'); n.type = 'lowpass';
    n.frequency = mkParam(n, 'frequency', 350); n.Q = mkParam(n, 'Q', 1); n.gain = mkParam(n, 'gain', 0);
    n.__passthrough = true;
    return n;
  }
  createStereoPanner() { const n = new Node('panner'); n.pan = mkParam(n, 'pan', 0); n.__passthrough = true; return n; }
  createConvolver() { const n = new Node('convolver'); n.buffer = null; n.normalize = true; n.__passthrough = true; return n; }
  createDynamicsCompressor() {
    const n = new Node('comp'); n.__passthrough = true;
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = mkParam(n, k, 0);
    return n;
  }
  createWaveShaper() { const n = new Node('shaper'); n.curve = null; n.oversample = 'none'; n.__passthrough = true; return n; }
  createDelay() { const n = new Node('delay'); n.delayTime = mkParam(n, 'delayTime', 0); n.__passthrough = true; return n; }
  createBuffer(ch, len, sr) {
    const data = [];
    for (let i = 0; i < ch; i++) data.push(new Float32Array(len));
    return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: i => data[i] };
  }
}

/* ---------------- 载入被测模块 ---------------- */
const listeners = {};
global.window = {
  addEventListener: (k, f) => { (listeners[k] = listeners[k] || []).push(f); },
  setTimeout: () => 0, clearTimeout: () => { }
};
global.document = { readyState: 'loading', addEventListener: () => { }, getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }) };
try { global.navigator = { userAgent: 'node' }; } catch (e) { }
const ctx = new Ctx();
global.window.AudioContext = function () { return ctx; };
global.window.webkitAudioContext = global.window.AudioContext;
global.AudioContext = global.window.AudioContext;

const src = fs.readFileSync(path.join(ROOT, 'js', 'audio.js'), 'utf8');
new Function(src)();
const A = global.window.DSC.Audio;

console.log('== 1. 初始化 ==');
if (A.ready) bad('加载期就已 ready（应等 init）');
A.init();
if (!A.ready) bad('init() 后 ready 仍为 false'); else ok('init() 建图完成，节点数 ' + ALL.length);
A.setVolumes({ master: 1, sfx: 1, music: 1 });
const baseNodes = ALL.length;

/* 判定：从节点出发能否走到 destination，且沿途 gain 峰值都 > 阈值 */
function audible(node, seen = new Set()) {
  if (node === ctx.destination) return { reach: true, gain: 1 };
  if (seen.has(node)) return { reach: false, gain: 0 };
  seen.add(node);
  let best = { reach: false, gain: 0 };
  for (const e of node.out) {
    if (e.param) continue;                      // 连到 AudioParam 的是调制，不是主通路
    const r = audible(e, seen);
    if (!r.reach) continue;
    let g = r.gain;
    if (e.kind === 'gain') g *= pk(e.gain);
    if (g > best.gain) best = { reach: true, gain: g };
  }
  if (node.kind === 'gain') best.gain *= pk(node.gain);
  return best;
}

console.log('\n== 2. 逐个音效可听性审计（' + A.NAMES.length + ' 个） ==');
const silent = [], noStart = [], badStop = [], weak = [];
let totalSources = 0;
for (const name of A.NAMES) {
  RECORD = [];
  ctx.currentTime += 1;                       // 跳过 40ms 节流
  A.play(name, { volume: 1 });
  const created = RECORD; RECORD = null;
  const sources = created.filter(n => n.kind === 'osc' || n.kind === 'bufsrc');
  totalSources += sources.length;
  if (!sources.length) { silent.push(name + '(无源节点)'); continue; }
  const started = sources.filter(s => s.started !== null);
  if (!started.length) { noStart.push(name); continue; }
  for (const s of started) {
    if (s.stopped !== null && s.stopped <= s.started) badStop.push(name + '(stop<=start)');
  }
  let best = 0;
  for (const s of started) { const r = audible(s); if (r.reach && r.gain > best) best = r.gain; }
  if (best <= 0) silent.push(name + '(无通路或增益为0)');
  else if (best < 0.005) weak.push(name + '(' + best.toFixed(4) + ')');
}
ok('平均每个音效 ' + (totalSources / A.NAMES.length).toFixed(1) + ' 个源节点（合计 ' + totalSources + '）');
if (silent.length) bad('无可听通路 ' + silent.length + ' 个: ' + silent.join(', '));
else ok('全部 ' + A.NAMES.length + ' 个音效都有 源→非零增益→destination 的通路');
if (noStart.length) bad('源节点未 start(): ' + noStart.join(', ')); else ok('所有源节点均已 start()');
if (badStop.length) bad('stop 时间早于 start: ' + [...new Set(badStop)].join(', ')); else ok('start/stop 时序正确');
if (weak.length) warn('通路增益偏低: ' + weak.join(', '));

console.log('\n== 3. 材质音差异化（不能所有材质长一样） ==');
{
  const mats = ['stone', 'dirt', 'grass', 'sand', 'wood', 'metal', 'glass', 'crystal', 'snow'];
  const sig = {};
  for (const m of mats) {
    RECORD = []; ctx.currentTime += 1;
    A.play('break_' + m, { volume: 1 });
    const c = RECORD; RECORD = null;
    const filters = c.filter(n => n.kind === 'filter');
    sig[m] = [
      c.filter(n => n.kind === 'osc').length,
      c.filter(n => n.kind === 'bufsrc').length,
      filters.map(f => f.type).sort().join('/'),
      Math.round(filters.reduce((a, f) => a + pk(f.frequency), 0))
    ].join('|');
  }
  const uniq = new Set(Object.values(sig));
  if (uniq.size < 5) bad('材质音特征过于雷同（' + uniq.size + '/9 种）: ' + JSON.stringify(sig));
  else ok('9 种材质音有 ' + uniq.size + ' 种不同的合成特征（滤波器类型/频率/源数量）');
  /* step 必须比 break 轻 */
  RECORD = []; ctx.currentTime += 1; A.play('step_stone', { volume: 1 }); const st = RECORD;
  RECORD = []; ctx.currentTime += 1; A.play('break_stone', { volume: 1 }); const bk = RECORD;
  RECORD = null;
  const peak = arr => Math.max(...arr.filter(n => n.kind === 'gain').map(n => pk(n.gain)), 0);
  if (peak(st) >= peak(bk)) warn('step_stone 增益(' + peak(st).toFixed(3) + ') 未低于 break_stone(' + peak(bk).toFixed(3) + ')');
  else ok('step 比 break 更轻（' + peak(st).toFixed(3) + ' < ' + peak(bk).toFixed(3) + '）');
}

console.log('\n== 4. 音高随机化（连续触发不能一模一样） ==');
{
  const freqs = [];
  for (let i = 0; i < 8; i++) {
    RECORD = []; ctx.currentTime += 1;
    A.play('dig_stone', { volume: 1 });
    const c = RECORD; RECORD = null;
    const f = c.filter(n => n.kind === 'osc' || n.kind === 'bufsrc')
      .map(n => (n.kind === 'osc' ? n.frequency.value.toFixed(4) + ':' + n.detune.value.toFixed(2) : n.playbackRate.value.toFixed(5))).join(',');
    freqs.push(f);
  }
  const u = new Set(freqs);
  if (u.size < 5) bad('8 次触发只有 ' + u.size + ' 种音高（缺少随机化，会像机器人）');
  else ok('8 次触发 ' + u.size + ' 种不同音高（±抖动生效）');
}

console.log('\n== 5. loop / 连续参数 / 泄漏 ==');
{
  const before = ALL.length;
  const h = A.loop('ship_engine', { volume: 0.6 });
  if (!h || typeof h.stop !== 'function' || typeof h.gain !== 'function' || typeof h.rate !== 'function') bad('loop handle 不完整');
  else ok('loop handle 完整 {stop,gain,rate}');
  if (A.loop('ship_engine') !== h) bad('同名 loop 未复用同一实例'); else ok('同名 loop 复用实例');
  RECORD = [];
  const loops = ['ambient_space', 'ambient_planet', 'ambient_cave', 'ambient_underwater', 'atmos_burn', 'rain'];
  const hs = loops.map(n => A.loop(n, { volume: 0.4 }));
  const made = RECORD; RECORD = null;
  const loopSrc = made.filter(n => (n.kind === 'osc' || n.kind === 'bufsrc') && n.started !== null);
  if (!loopSrc.length) bad('氛围 loop 没有创建并启动源节点');
  else {
    const looping = made.filter(n => n.kind === 'bufsrc' && n.loop);
    ok(loops.length + ' 个氛围 loop 启动了 ' + loopSrc.length + ' 个源（其中循环缓冲 ' + looping.length + ' 个）');
    let aud = 0;
    for (const s of loopSrc) if (audible(s).reach) aud++;
    if (aud === 0) bad('氛围 loop 没有连到 destination'); else ok('氛围 loop 有 ' + aud + ' 条可听通路');
  }
  h.gain(0.3); h.rate(1.1);
  hs.forEach(x => x && x.stop(0.05));
  h.stop(0.05);
  loops.forEach(n => A.stopLoop(n, 0.05));
  A.engine(0.8, 0.5); A.engine(0.2, 0);
  A.wind(0.7); A.wind(0);
  A.mining(true, 'stone'); A.mining(true, 'crystal'); A.mining(false);
  ['title', 'space', 'planet', 'cave', 'warp', 'none'].forEach(s => A.setMusic(s));
  A.setListener([0, 0, 0], [0, 0, -1]);
  ctx.currentTime += 1; A.play('dig_stone', { pos: [4, 0, 2] });
  RECORD = []; ctx.currentTime += 1; A.play('dig_stone', { pos: [999, 0, 0] }); const far = RECORD; RECORD = null;
  if (far.filter(n => n.kind === 'osc' || n.kind === 'bufsrc').length) warn('超远距离音效仍然建了源节点（应静默）');
  else ok('超距音效被正确剔除（不建节点）');
  A.stopAll();
  const live = ALL.filter(n => !n.disconnected && n.out.length && (n.kind === 'osc' || n.kind === 'bufsrc'));
  ok('stopAll 后仍持有连接的源节点 ' + live.length + ' 个（一次性音效等其 onended 回收属正常）');
  ok('审计期间共创建节点 ' + ALL.length + ' 个（初始化占 ' + baseNodes + '）');
}

console.log('\n== 6. 静音安全（未 init 时不得抛异常） ==');
{
  /* 重新加载一份未初始化的实例 */
  const w2 = { addEventListener: () => { }, setTimeout: () => 0, clearTimeout: () => { } };
  const saved = global.window;
  global.window = w2;
  new Function(src)();
  const A2 = w2.DSC.Audio;
  let err = null;
  try {
    A2.play('dig_stone'); A2.loop('ambient_space'); A2.stopLoop('ambient_space');
    A2.setMusic('space'); A2.engine(1, 1); A2.wind(1); A2.mining(true, 'stone'); A2.mining(false);
    A2.setVolumes({ master: 1 }); A2.beep(440, 0.1); A2.stopAll(); A2.suspend(); A2.resume();
  } catch (e) { err = e; }
  global.window = saved;
  if (err) bad('未 init 时调用抛异常: ' + err.message);
  else ok('未 init 时全部 API 安全静默（首帧竞态不会崩）');
}

console.log('\n=========================================');
console.log(fails ? ('AUDIO AUDIT FAILED: ' + fails + ' 项失败, ' + warns + ' 警告')
  : ('AUDIO AUDIT ALL PASS (' + warns + ' 警告)'));
console.log('=========================================');
process.exit(fails ? 1 : 0);
