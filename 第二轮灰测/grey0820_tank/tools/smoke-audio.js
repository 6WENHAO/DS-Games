/* =============================================================================
   tools/smoke-audio.js - executes js/audio.js against a STRICT Web Audio stub.

   The stub deliberately enforces the error behaviour real browsers have
   (exponentialRampToValueAtTime(0) throws, non-finite values throw, negative
   times throw, connect(undefined) throws, unknown node properties throw, ...)
   so that mistakes which only show up at runtime in a browser are caught here.

   It also counts node allocations, to verify the contract that setEngine()
   drives a persistent graph instead of building nodes every frame.

   Usage:  node tools/smoke-audio.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let created = 0;                 /* node allocation counter */
let ctxTime = 0;                 /* fake currentTime        */
const endedCallbacks = [];       /* scheduled onended       */
const problems = [];

function bad(msg) { throw new TypeError(msg); }
function range(msg) { const e = new Error(msg); e.name = 'RangeError'; throw e; }
function finite(v, where) {
  if (typeof v !== 'number' || !isFinite(v)) bad(where + ': value is not a finite number (' + v + ')');
}
function timeOk(t, where) {
  finite(t, where + ' time');
  if (t < 0) range(where + ': time must not be negative (' + t + ')');
}

class AudioParam {
  constructor(name, def, min, max) {
    this._name = name; this._value = def;
    this._min = min === undefined ? -Infinity : min;
    this._max = max === undefined ? Infinity : max;
    this.automationCount = 0;
  }
  get value() { return this._value; }
  set value(v) { finite(v, this._name + '.value'); this._value = v; }
  setValueAtTime(v, t) {
    finite(v, this._name + '.setValueAtTime'); timeOk(t, this._name + '.setValueAtTime');
    this.automationCount++; this._value = v; return this;
  }
  linearRampToValueAtTime(v, t) {
    finite(v, this._name + '.linearRampToValueAtTime'); timeOk(t, this._name + '.linearRampToValueAtTime');
    this.automationCount++; this._value = v; return this;
  }
  exponentialRampToValueAtTime(v, t) {
    finite(v, this._name + '.exponentialRampToValueAtTime');
    timeOk(t, this._name + '.exponentialRampToValueAtTime');
    /* browsers reject a target of (or extremely near) zero */
    if (Math.abs(v) < 1.40130e-45) {
      range(this._name + '.exponentialRampToValueAtTime: target must be non-zero (got ' + v + ')');
    }
    this.automationCount++; this._value = v; return this;
  }
  setTargetAtTime(v, t, tc) {
    finite(v, this._name + '.setTargetAtTime'); timeOk(t, this._name + '.setTargetAtTime');
    finite(tc, this._name + '.setTargetAtTime timeConstant');
    if (tc < 0) range(this._name + '.setTargetAtTime: timeConstant must not be negative');
    this.automationCount++; this._value = v; return this;
  }
  setValueCurveAtTime(curve, t, dur) {
    if (!curve || curve.length === undefined) bad(this._name + '.setValueCurveAtTime needs an array');
    timeOk(t, this._name + '.setValueCurveAtTime'); finite(dur, 'duration');
    this.automationCount++; return this;
  }
  cancelScheduledValues(t) { timeOk(t, this._name + '.cancelScheduledValues'); return this; }
  cancelAndHoldAtTime(t) { timeOk(t, this._name + '.cancelAndHoldAtTime'); return this; }
}

/* every node is sealed: touching a property the real API does not have throws */
class AudioNode {
  constructor(kind) {
    this.kind = kind;
    this.numberOfInputs = 1; this.numberOfOutputs = 1;
    this.channelCount = 2; this.channelCountMode = 'max'; this.channelInterpretation = 'speakers';
    this._connections = [];
    this._disconnected = false;
    created++;
  }
  connect(dest, out, inp) {
    if (!(dest instanceof AudioNode) && !(dest instanceof AudioParam)) {
      bad(this.kind + '.connect(): destination is not an AudioNode or AudioParam (' + dest + ')');
    }
    if (out !== undefined) finite(out, 'connect output index');
    if (inp !== undefined) finite(inp, 'connect input index');
    this._connections.push(dest);
    return dest instanceof AudioNode ? dest : undefined;
  }
  disconnect() { this._connections.length = 0; this._disconnected = true; }
}

class ScheduledNode extends AudioNode {
  constructor(kind) { super(kind); this._started = false; this._stopped = false; this.onended = null; }
  start(when, offset, dur) {
    if (this._started) { const e = new Error(this.kind + '.start() called twice'); e.name = 'InvalidStateError'; throw e; }
    if (when !== undefined) timeOk(when, this.kind + '.start');
    if (offset !== undefined) finite(offset, this.kind + '.start offset');
    if (dur !== undefined) finite(dur, this.kind + '.start duration');
    this._started = true;
    this._startAt = when === undefined ? ctxTime : when;
    return this;
  }
  stop(when) {
    if (!this._started) { const e = new Error(this.kind + '.stop() before start()'); e.name = 'InvalidStateError'; throw e; }
    if (when !== undefined) timeOk(when, this.kind + '.stop');
    this._stopped = true;
    this._stopAt = when === undefined ? ctxTime : when;
    endedCallbacks.push({ node: this, at: this._stopAt });
    return this;
  }
}

const OSC_TYPES = ['sine', 'square', 'sawtooth', 'triangle', 'custom'];
const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass'];

class OscillatorNode extends ScheduledNode {
  constructor(rate) {
    super('OscillatorNode');
    this.numberOfInputs = 0;
    this.frequency = new AudioParam('osc.frequency', 440, -rate / 2, rate / 2);
    this.detune = new AudioParam('osc.detune', 0);
    this._type = 'sine';
  }
  get type() { return this._type; }
  set type(v) {
    if (OSC_TYPES.indexOf(v) < 0) bad('OscillatorNode.type: unknown type "' + v + '"');
    if (v === 'custom') bad('OscillatorNode.type cannot be set to "custom" directly');
    this._type = v;
  }
  setPeriodicWave(w) { if (!w) bad('setPeriodicWave needs a PeriodicWave'); this._type = 'custom'; }
}

class AudioBuffer {
  constructor(ch, len, rate) {
    if (!(len > 0)) bad('createBuffer: length must be > 0 (got ' + len + ')');
    if (!(rate > 0)) bad('createBuffer: sampleRate must be > 0');
    if (!(ch > 0)) bad('createBuffer: numberOfChannels must be > 0');
    this.numberOfChannels = ch; this.length = len; this.sampleRate = rate;
    this.duration = len / rate;
    this._data = [];
    for (let i = 0; i < ch; i++) this._data.push(new Float32Array(len));
  }
  getChannelData(i) {
    if (!(i >= 0 && i < this.numberOfChannels)) {
      const e = new Error('getChannelData: channel index ' + i + ' out of range'); e.name = 'IndexSizeError'; throw e;
    }
    return this._data[i];
  }
}

class AudioBufferSourceNode extends ScheduledNode {
  constructor() {
    super('AudioBufferSourceNode');
    this.numberOfInputs = 0;
    this.playbackRate = new AudioParam('src.playbackRate', 1);
    this.detune = new AudioParam('src.detune', 0);
    this._buffer = null;
    this.loop = false; this.loopStart = 0; this.loopEnd = 0;
  }
  get buffer() { return this._buffer; }
  set buffer(b) {
    if (b !== null && !(b instanceof AudioBuffer)) bad('AudioBufferSourceNode.buffer must be an AudioBuffer');
    this._buffer = b;
  }
  start(when, offset, dur) {
    if (!this._buffer) {
      /* a browser allows this but plays nothing: flag it as a likely mistake */
      problems.push('AudioBufferSourceNode.start() with no buffer assigned');
    }
    return super.start(when, offset, dur);
  }
}

class GainNode extends AudioNode {
  constructor() { super('GainNode'); this.gain = new AudioParam('gain.gain', 1); }
}
class BiquadFilterNode extends AudioNode {
  constructor(rate) {
    super('BiquadFilterNode');
    this.frequency = new AudioParam('filter.frequency', 350, 0, rate / 2);
    this.Q = new AudioParam('filter.Q', 1);
    this.detune = new AudioParam('filter.detune', 0);
    this.gain = new AudioParam('filter.gain', 0);
    this._type = 'lowpass';
  }
  get type() { return this._type; }
  set type(v) {
    if (FILTER_TYPES.indexOf(v) < 0) bad('BiquadFilterNode.type: unknown type "' + v + '"');
    this._type = v;
  }
}
class DelayNode extends AudioNode {
  constructor(max) {
    super('DelayNode');
    if (max !== undefined && !(max > 0 && max <= 180)) bad('createDelay: maxDelayTime out of range');
    this.delayTime = new AudioParam('delay.delayTime', 0, 0, max === undefined ? 1 : max);
  }
}
class DynamicsCompressorNode extends AudioNode {
  constructor() {
    super('DynamicsCompressorNode');
    this.threshold = new AudioParam('comp.threshold', -24, -100, 0);
    this.knee = new AudioParam('comp.knee', 30, 0, 40);
    this.ratio = new AudioParam('comp.ratio', 12, 1, 20);
    this.attack = new AudioParam('comp.attack', 0.003, 0, 1);
    this.release = new AudioParam('comp.release', 0.25, 0, 1);
    this.reduction = 0;
  }
}
class WaveShaperNode extends AudioNode {
  constructor() { super('WaveShaperNode'); this.curve = null; this.oversample = 'none'; }
}
class StereoPannerNode extends AudioNode {
  constructor() { super('StereoPannerNode'); this.pan = new AudioParam('panner.pan', 0, -1, 1); }
}
class ConstantSourceNode extends ScheduledNode {
  constructor() { super('ConstantSourceNode'); this.numberOfInputs = 0; this.offset = new AudioParam('const.offset', 1); }
}
class ChannelMergerNode extends AudioNode { constructor() { super('ChannelMergerNode'); } }
class ChannelSplitterNode extends AudioNode { constructor() { super('ChannelSplitterNode'); } }
class AnalyserNode extends AudioNode {
  constructor() { super('AnalyserNode'); this.fftSize = 2048; this.frequencyBinCount = 1024; }
  getByteFrequencyData(a) { if (!a) bad('getByteFrequencyData needs an array'); }
}
class ConvolverNode extends AudioNode {
  constructor() { super('ConvolverNode'); this._buffer = null; this.normalize = true; }
  get buffer() { return this._buffer; }
  set buffer(b) {
    if (b !== null && !(b instanceof AudioBuffer)) bad('ConvolverNode.buffer must be an AudioBuffer');
    this._buffer = b;
  }
}

class FakeAudioContext {
  constructor(opts) {
    this.sampleRate = (opts && opts.sampleRate) || 48000;
    this.state = 'suspended';
    this.destination = new AudioNode('AudioDestinationNode');
    this.destination.numberOfOutputs = 0;
    this.listener = {};
    this.baseLatency = 0.01;
    this._closed = false;
  }
  get currentTime() { return ctxTime; }
  createGain() { return new GainNode(); }
  createOscillator() { return new OscillatorNode(this.sampleRate); }
  createBiquadFilter() { return new BiquadFilterNode(this.sampleRate); }
  createDelay(max) { return new DelayNode(max); }
  createDynamicsCompressor() { return new DynamicsCompressorNode(); }
  createBufferSource() { return new AudioBufferSourceNode(); }
  createBuffer(ch, len, rate) { return new AudioBuffer(ch, len, rate); }
  createWaveShaper() { return new WaveShaperNode(); }
  createStereoPanner() { return new StereoPannerNode(); }
  createConstantSource() { return new ConstantSourceNode(); }
  createChannelMerger() { return new ChannelMergerNode(); }
  createChannelSplitter() { return new ChannelSplitterNode(); }
  createAnalyser() { return new AnalyserNode(); }
  createConvolver() { return new ConvolverNode(); }
  createPeriodicWave() { return { kind: 'PeriodicWave' }; }
  resume() { if (this._closed) return Promise.reject(new Error('closed')); this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this._closed = true; this.state = 'closed'; return Promise.resolve(); }
  decodeAudioData() { return Promise.resolve(new AudioBuffer(2, 1024, this.sampleRate)); }
}

/* ---- run audio.js in that world --------------------------------------- */
const sandbox = {};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.console = console;
sandbox.AudioContext = FakeAudioContext;
sandbox.webkitAudioContext = FakeAudioContext;
sandbox.performance = { now: () => ctxTime * 1000 };
sandbox.setTimeout = (fn, ms) => setTimeout(fn, 0);
sandbox.clearTimeout = clearTimeout;
sandbox.document = { createElement: () => ({ style: {}, getContext: () => null }) };

const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'audio.js'), 'utf8'), ctx, { filename: 'js/audio.js' });
const A = sandbox.TS && sandbox.TS.Audio;

let failed = false;
function check(label, fn) {
  try { fn(); console.log('  ok  ' + label); }
  catch (e) {
    failed = true;
    console.error('FAILED ' + label + '\n       ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n       ') : e));
  }
}
function advance(dt) {
  ctxTime += dt;
  for (let i = endedCallbacks.length - 1; i >= 0; i--) {
    if (endedCallbacks[i].at <= ctxTime) {
      const n = endedCallbacks.splice(i, 1)[0].node;
      if (typeof n.onended === 'function') n.onended({ target: n });
    }
  }
}

const NAMES = ['fire', 'explosion', 'hit', 'breechOpen', 'breechClose', 'load', 'shellDrop',
  'switch', 'button', 'knob', 'lever', 'gear', 'hatch', 'starterFail', 'ignite', 'stall',
  'buzzer', 'radioBeep', 'squeak', 'clunk', 'reticleClick', 'hydraulic', 'dust'];

check('module exposes the contract', () => {
  if (!A) throw new Error('TS.Audio missing');
  for (const m of ['init', 'resume', 'suspend', 'setMaster', 'setMuted', 'setInterior', 'setRadio', 'setEngine', 'play', 'ready']) {
    if (typeof A[m] !== 'function') throw new Error('TS.Audio.' + m + ' is not a function');
  }
});

check('safe before init()', () => {
  A.setMaster(0.5); A.setMuted(false); A.setInterior(true); A.setRadio(true);
  A.setEngine({ running: true, rpm: 1200, throttle: 0.5, load: 0.3, speed: 4, tracks: 0.5 });
  for (const n of NAMES) A.play(n, {});
  A.resume(); A.suspend();
  if (A.ready()) throw new Error('ready() true before init');
});

check('init() builds the master chain', () => {
  A.init(); A.init(); A.resume();
  if (!A.ready()) throw new Error('ready() false after init+resume');
});
const afterInit = created;
console.log('      nodes allocated by init(): ' + afterInit);

check('setEngine() allocates no nodes per frame', () => {
  const before = created;
  for (let i = 0; i < 400; i++) {
    advance(1 / 60);
    A.setEngine({
      running: i > 30, starting: i <= 30, rpm: 600 + (i % 200) * 10,
      throttle: (i % 100) / 100, load: (i % 50) / 50,
      speed: Math.sin(i / 20) * 10, tracks: (i % 30) / 30, damaged: i > 300
    });
  }
  const grew = created - before;
  console.log('      nodes allocated across 400 setEngine frames: ' + grew);
  if (grew > 0) throw new Error('setEngine allocated ' + grew + ' nodes (must reuse a persistent graph)');
});

check('setEngine() survives hostile input', () => {
  const hostile = [
    {}, null, undefined,
    { running: true, rpm: NaN, throttle: NaN, load: NaN, speed: NaN, tracks: NaN },
    { running: true, rpm: Infinity, throttle: 1e9, load: -5, speed: -1e9, tracks: 42 },
    { running: true, rpm: -3000, throttle: -1, load: 1e-9, speed: 0, tracks: -1 },
    { running: 'yes', starting: 1, rpm: '1500', throttle: '0.5', load: null, speed: undefined, tracks: {} }
  ];
  for (const h of hostile) { advance(0.02); A.setEngine(h); }
});

check('every play() name fires and cleans up', () => {
  const live = [];
  for (const n of NAMES) {
    const before = created;
    A.play(n);
    A.play(n, { gain: 0.5, rate: 1.5, delay: 0.05 });
    if (created === before) problems.push('play("' + n + '") allocated no nodes at all');
    live.push(n);
  }
  /* hostile options must not throw */
  for (const n of NAMES) {
    A.play(n, { gain: NaN, rate: 0, delay: -3 });
    A.play(n, { gain: Infinity, rate: -1, delay: NaN });
    A.play(n, null);
  }
  A.play('buzzer', { duration: 2.5 });
  A.play('hydraulic', { duration: 0.2 });
  A.play('buzzer', { duration: NaN });
  A.play('hydraulic', { duration: -1 });
});

check('unknown names are silent, not fatal', () => {
  A.play('nope'); A.play(''); A.play(null); A.play(undefined); A.play(123); A.play({});
});

/* cross-module: every sound the game asks for must be implemented, otherwise it
   silently plays nothing in the browser and nobody notices */
check('game code only asks for implemented sounds', () => {
  const src = ['sim.js', 'cockpit.js', 'main.js']
    .map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n');
  const asked = new Set();
  const re = /(?:snd|play)\(\s*'([A-Za-z]+)'/g;
  let m;
  while ((m = re.exec(src))) asked.add(m[1]);
  const missing = [...asked].filter(n => NAMES.indexOf(n) < 0);
  console.log('      sound names requested by the game: ' + asked.size +
    ', implemented: ' + NAMES.length);
  if (missing.length) throw new Error('game requests unimplemented sounds: ' + missing.join(', '));
});

check('one-shots release their nodes (onended)', () => {
  for (let i = 0; i < 60; i++) advance(0.25);
  const pending = endedCallbacks.length;
  console.log('      scheduled stops still pending after 15 s: ' + pending);
  if (pending > 40) throw new Error(pending + ' sources were never stopped: leak');
});

check('mixer controls', () => {
  A.setMaster(0); A.setMaster(1); A.setMaster(0.4);
  A.setMaster(NaN); A.setMaster(-1); A.setMaster(5); A.setMaster('0.5');
  A.setMuted(true); A.setMuted(false);
  A.setInterior(true); A.setInterior(false); A.setInterior(1); A.setInterior(null);
  A.setRadio(true); A.setRadio(false);
  if (typeof A.muted !== 'boolean') throw new Error('muted getter missing');
});

check('suspend / resume cycle', () => {
  A.suspend(); A.resume(); A.suspend(); A.resume();
  for (let i = 0; i < 30; i++) { advance(1 / 60); A.setEngine({ running: true, rpm: 1800, throttle: 0.7, load: 0.5, speed: 8, tracks: 0.8 }); }
  A.play('fire'); A.play('explosion', { delay: 0.4 });
  for (let i = 0; i < 40; i++) advance(0.1);
});

check('a full mission-like burst', () => {
  for (let i = 0; i < 900; i++) {
    advance(1 / 60);
    A.setEngine({
      running: true, starting: false, rpm: 700 + 900 * (0.5 + 0.5 * Math.sin(i / 40)),
      throttle: 0.5 + 0.5 * Math.sin(i / 30), load: 0.4, speed: 6, tracks: 0.7, damaged: false
    });
    if (i % 90 === 0) A.play('fire');
    if (i % 90 === 12) A.play('breechOpen');
    if (i % 90 === 30) A.play('shellDrop');
    if (i % 90 === 45) A.play('load');
    if (i % 90 === 60) A.play('breechClose');
    if (i % 7 === 0) A.play('clunk', { gain: 0.3, rate: 2.2 });
    if (i % 200 === 0) A.play('explosion', { delay: 0.6 });
  }
  for (let i = 0; i < 100; i++) advance(0.1);
});

console.log('\ntotal nodes created: ' + created + ',  fake clock: ' + ctxTime.toFixed(1) + ' s');
if (problems.length) {
  console.log('\nwarnings:');
  for (const p of [...new Set(problems)]) console.log('  ! ' + p);
}
console.log(failed ? '\nAUDIO SMOKE TESTS FAILED' : '\nALL AUDIO SMOKE TESTS PASSED');
process.exit(failed ? 1 : 0);
