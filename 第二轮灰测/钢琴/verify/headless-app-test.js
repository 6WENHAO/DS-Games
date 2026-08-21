/* 集成验证：用 DOM / WebAudio / WebGLRenderer 桩在 node 中真实跑一遍 app.js
 * 覆盖：初始化、灯光、开合动画、点击琴键（真实 Raycaster）、电脑键盘、演示曲、UI 按钮
 * 运行: node tools/headless-app-test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const STAGE = path.join(__dirname, '..');

/* ---------------- DOM 桩 ---------------- */
function makeEl(tag, id) {
  const L = {};
  return {
    tagName: (tag || 'div').toUpperCase(), id: id || '', style: {}, dataset: {},
    children: [], textContent: '', value: '0.5', clientWidth: 1500, clientHeight: 940,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, v) { if (v === undefined) v = !this._s.has(c); v ? this._s.add(c) : this._s.delete(c); return v; },
    },
    _listeners: L,
    addEventListener(t, f) { (L[t] = L[t] || []).push(f); },
    removeEventListener(t, f) { if (L[t]) L[t] = L[t].filter((x) => x !== f); },
    dispatchEvent(ev) { (L[ev.type] || []).slice().forEach((f) => f(ev)); return true; },
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    getBoundingClientRect() { return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight }; },
    setPointerCapture() {}, releasePointerCapture() {},
    focus() {}, blur() {},
  };
}

const els = new Map();
function el(id) {
  if (!els.has(id)) els.set(id, makeEl('div', id));
  return els.get(id);
}
const viewButtons = ['front', 'player', 'top', 'side', 'tail', 'detail'].map((v) => {
  const b = makeEl('button'); b.dataset.view = v; return b;
});
const pedalButtons = [0, 1, 2].map((i) => {
  const b = i === 2 ? el('pedal-ind') : makeEl('button');
  b.dataset.pedal = String(i); return b;
});
['vol', 'rev'].forEach((k) => { el(k).value = k === 'vol' ? '0.85' : '0.26'; });

let virtualNow = 0;
const rafQueue = [];
const errors = [];

const sandbox = {
  console,
  setTimeout: (f, ms) => { return 0; },
  clearTimeout: () => {},
  setInterval: () => 0, clearInterval: () => {},
  performance: { now: () => virtualNow },
  requestAnimationFrame: (cb) => { rafQueue.push(cb); return rafQueue.length; },
  devicePixelRatio: 1,
  navigator: { userAgent: 'node', maxTouchPoints: 0 },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const winL = {};
sandbox.addEventListener = (t, f) => { (winL[t] = winL[t] || []).push(f); };
sandbox.removeEventListener = (t, f) => { if (winL[t]) winL[t] = winL[t].filter((x) => x !== f); };
sandbox.dispatchEvent = (ev) => { (winL[ev.type] || []).slice().forEach((f) => f(ev)); };

sandbox.document = {
  readyState: 'complete',
  createElement(tag) {
    if (tag === 'canvas') {
      const c = makeEl('canvas');
      c.width = 1; c.height = 1;
      c.getContext = () => ctxStub();
      return c;
    }
    return makeEl(tag);
  },
  getElementById: (id) => el(id),
  querySelector: (s) => null,
  querySelectorAll(s) {
    if (s === '[data-view]') return viewButtons;
    if (s === '[data-pedal]') return pedalButtons;
    return [];
  },
  addEventListener: (t, f) => sandbox.addEventListener(t, f),
  body: makeEl('body'),
};

function ctxStub() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  return new Proxy({
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    measureText: () => ({ width: 100 }),
  }, { get: (t, k) => (k in t ? t[k] : noop), set: () => true });
}

/* ---------------- WebAudio 桩 ---------------- */
function param(v) {
  return {
    value: v,
    setValueAtTime() { return this; }, linearRampToValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; }, setTargetAtTime() { return this; },
    cancelScheduledValues() { return this; },
  };
}
const audioStats = { osc: 0, gains: 0 };
function anode(extra) {
  return Object.assign({ connect(t) { return t; }, disconnect() {} }, extra);
}
class FakeAudioCtx {
  constructor() { this.sampleRate = 48000; this.state = 'running'; this.destination = anode({}); }
  get currentTime() { return virtualNow / 1000; }
  createGain() { audioStats.gains++; return anode({ gain: param(1) }); }
  createOscillator() {
    audioStats.osc++;
    return anode({ type: 'sine', frequency: param(440), detune: param(0), start() {}, stop() {} });
  }
  createBiquadFilter() { return anode({ type: 'lowpass', frequency: param(1000), Q: param(1) }); }
  createStereoPanner() { return anode({ pan: param(0) }); }
  createConvolver() { return anode({ buffer: null, normalize: true }); }
  createDynamicsCompressor() {
    return anode({ threshold: param(0), knee: param(0), ratio: param(0), attack: param(0), release: param(0) });
  }
  createBufferSource() { return anode({ buffer: null, start() {}, stop() {} }); }
  createBuffer(ch, len, rate) {
    const d = []; for (let i = 0; i < ch; i++) d.push(new Float32Array(len));
    return { length: len, sampleRate: rate, numberOfChannels: ch, getChannelData: (i) => d[i] };
  }
  resume() {}
}
sandbox.AudioContext = FakeAudioCtx;

/* ---------------- 载入脚本 ---------------- */
const ctxObj = vm.createContext(sandbox);
function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(STAGE, rel), 'utf8'), ctxObj, { filename: rel });
}
load('js/three.min.js');
const T = sandbox.THREE;

/* --- 渲染器 / PMREM 桩（几何与数学仍是真实 three） --- */
let renderCount = 0;
sandbox.THREE.WebGLRenderer = class {
  constructor() {
    this.domElement = sandbox.document.createElement('canvas');
    this.shadowMap = { enabled: false, type: 0 };
    this.info = { render: { triangles: 128000, calls: 130 }, memory: {} };
    this.outputColorSpace = ''; this.toneMapping = 0; this.toneMappingExposure = 1;
    this.useLegacyLights = true;
    this.capabilities = { isWebGL2: true, getMaxAnisotropy: () => 8 };
  }
  setPixelRatio() {} setSize() {} setClearAlpha() {} setClearColor() {}
  render(scene, cam) { renderCount++; scene.updateMatrixWorld(true); cam.updateMatrixWorld(true); }
  compile() {} dispose() {} getContext() { return {}; }
};
sandbox.THREE.PMREMGenerator = class {
  constructor() {}
  fromScene() { return { texture: new T.Texture() }; }
  fromEquirectangular() { return { texture: new T.Texture() }; }
  compileEquirectangularShader() {} dispose() {}
};

load('js/geom.js');
load('js/orbit.js');
load('js/audio.js');
load('js/piano.js');
process.on('uncaughtException', (e) => { console.log('✗ 未捕获异常:'); console.log(e.stack); process.exit(1); });
load('js/app.js');   // 立即执行 init()

const App = sandbox.PianoApp;
if (!App || !App.piano) throw new Error('init 失败：PianoApp.piano 不存在');
console.log('✓ init 完成，渲染器/场景/钢琴均已建立');

/* ---------------- 帧推进 ---------------- */
function frames(seconds, step) {
  step = step || 1000 / 60;
  const end = virtualNow + seconds * 1000;
  let n = 0;
  while (virtualNow < end) {
    virtualNow += step;
    const q = rafQueue.splice(0, rafQueue.length);
    if (!q.length) break;
    q.forEach((cb) => cb(virtualNow));
    n++;
    if (n > 6000) break;
  }
  return n;
}
frames(1.2);
console.log('✓ 动画循环运行 ' + renderCount + ' 帧，无异常');
const st = App.state;
console.log('  琴盖开合进度 lid=' + st.lid.toFixed(3) + ' 键盘盖 fall=' + st.fall.toFixed(3));
if (st.lid < 0.9 || st.fall < 0.9) throw new Error('初始开盖动画未收敛');

/* ---------------- 点击琴键（真实投影 + Raycaster） ---------------- */
const piano = App.piano;
const cam = (function findCam() {
  let found = null;
  // 相机不在场景里，从 controls 状态反推：直接用 App 暴露的 piano 场景父级
  return found;
})();
// 通过 renderer.render 捕获相机
let sceneRef = null, camRef = null;
const origRender = sandbox.THREE.WebGLRenderer.prototype.render;
sandbox.THREE.WebGLRenderer.prototype.render = function (s, c) { sceneRef = s; camRef = c; return origRender.call(this, s, c); };
frames(0.1);
if (!camRef) throw new Error('未捕获到相机');

function screenOfKey(midi) {
  const k = piano.keys.find((x) => x.midi === midi);
  const box = new T.Box3().setFromObject(k.mesh);
  const p = box.getCenter(new T.Vector3());
  p.y = box.max.y + 0.0005;
  p.z = box.max.z - 0.012;
  const v = p.clone().project(camRef);
  return { x: (v.x * 0.5 + 0.5) * 1500, y: (-v.y * 0.5 + 0.5) * 940, key: k, world: p };
}

const audioApi = sandbox.PianoAudio;
let noteOnCount = 0;
const origOn = audioApi.noteOn;
audioApi.noteOn = function (m, v) { noteOnCount++; return origOn.call(audioApi, m, v); };

// 切到键盘特写视角，保证琴键在画面内
viewButtons.find((b) => b.dataset.view === 'player').dispatchEvent({ type: 'click' });
frames(1.6);

const canvas = camRef ? null : null;
const rendererCanvas = (function () {
  // app 把 canvas 挂到 #stage
  return el('stage').children[0];
})();
if (!rendererCanvas) throw new Error('canvas 未挂载到 #stage');

let hits = 0, tried = 0;
[60, 61, 64, 67, 72].forEach((midi) => {
  const s = screenOfKey(midi);
  tried++;
  const ev = {
    type: 'pointerdown', clientX: s.x, clientY: s.y, pointerId: 1, button: 0,
    stopPropagation() {}, preventDefault() {},
  };
  rendererCanvas.dispatchEvent(ev);
  frames(0.05);
  const k = piano.keys.find((x) => x.midi === midi);
  if (k.held) hits++;
  sandbox.dispatchEvent({ type: 'pointerup', pointerId: 1 });
  frames(0.05);
});
console.log('✓ 鼠标点击琴键命中 ' + hits + '/' + tried + '（真实 Raycaster + 屏幕投影）');
if (hits < tried) throw new Error('部分琴键点击未命中，射线拾取或键位有问题');

/* ---------------- 电脑键盘 ---------------- */
sandbox.dispatchEvent({ type: 'keydown', code: 'KeyQ', repeat: false, preventDefault() {} });
frames(0.1);
const qKey = piano.keys.find((k) => k.midi === 60);
if (!qKey.held) throw new Error('电脑键盘 Q 未触发 C4');
sandbox.dispatchEvent({ type: 'keyup', code: 'KeyQ' });
sandbox.dispatchEvent({ type: 'keydown', code: 'Space', repeat: false, preventDefault() {} });
frames(0.3);
if (!App.state.sustain) throw new Error('空格未踩下延音踏板');
const damperLift = piano.dampers.info[30].lift;
sandbox.dispatchEvent({ type: 'keyup', code: 'Space' });
frames(0.3);
console.log('✓ 电脑键盘弹奏 / 空格延音踏板正常（制音器抬起 ' + (damperLift * 1000).toFixed(1) + ' mm）');
if (damperLift < 0.01) throw new Error('延音踏板未抬起制音器');

/* ---------------- UI 按钮 ---------------- */
const before = { lid: App.state.lidT, fall: App.state.fallT };
el('btn-lid').dispatchEvent({ type: 'click' });
el('btn-fallboard').dispatchEvent({ type: 'click' });
el('btn-rotate').dispatchEvent({ type: 'click' });
el('btn-contrast').dispatchEvent({ type: 'click' });
frames(1.0);
console.log('  按钮文本: ' + el('btn-lid').textContent + ' / ' + el('btn-fallboard').textContent +
  ' / ' + el('btn-rotate').textContent + ' / ' + el('btn-contrast').textContent);
if (App.state.lidT === before.lid || App.state.fallT === before.fall) throw new Error('琴盖/键盘盖按钮未生效');
const contrastMat = piano.keys.find((k) => !k.white).mesh.material;
if (contrastMat !== piano.materials.blackKeyContrast) throw new Error('半音键对比材质未切换');
el('btn-contrast').dispatchEvent({ type: 'click' });   // 切回纯白
el('vol').dispatchEvent({ type: 'input' });
el('rev').dispatchEvent({ type: 'input' });
el('btn-collapse').dispatchEvent({ type: 'click' });
console.log('✓ 面板按钮 / 滑块 / 折叠 全部可用');

/* ---------------- 演示曲 ---------------- */
noteOnCount = 0;
el('btn-demo').dispatchEvent({ type: 'click' });
frames(1.0);
if (!App.state.demo) throw new Error('演示曲未启动');
frames(13.0);
console.log('✓ 演示曲播放完成：触发 ' + noteOnCount + ' 个音，结束后自动停止 = ' + (App.state.demo === null));
if (noteOnCount < 48) throw new Error('演示曲音符过少: ' + noteOnCount);
if (App.state.demo !== null) throw new Error('演示曲结束后未自动停止');

/* ---------------- 视角切换 + 重置 ---------------- */
// 逐个预设视角检查：钢琴是否完整落在画面内
function framing(name) {
  const box = new T.Box3();
  piano.root.updateMatrixWorld(true);
  piano.keys.forEach((k) => box.expandByObject(k.mesh));
  box.expandByObject(piano.caseGroup);
  const pts = [];
  for (let i = 0; i < 8; i++) {
    pts.push(new T.Vector3(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z
    ).project(camRef));
  }
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return {
    name,
    x: [+Math.min(...xs).toFixed(2), +Math.max(...xs).toFixed(2)],
    y: [+Math.min(...ys).toFixed(2), +Math.max(...ys).toFixed(2)],
    behind: pts.some((p) => p.z > 1),
  };
}
const framings = [];
viewButtons.forEach((b) => {
  b.dispatchEvent({ type: 'click' });
  frames(2.4);
  framings.push(framing(b.dataset.view));
});
framings.forEach((f) => console.log('  视角 ' + f.name.padEnd(7) +
  ' NDC x=[' + f.x.join(', ') + '] y=[' + f.y.join(', ') + ']' + (f.behind ? '  ⚠ 有顶点在相机后' : '')));
const wide = framings.filter((f) => f.name !== 'detail' && f.name !== 'player' &&
  (Math.abs(f.x[0]) > 1.3 || Math.abs(f.x[1]) > 1.3 || Math.abs(f.y[0]) > 1.4 || Math.abs(f.y[1]) > 1.4));
if (wide.length) console.log('  ⚠ 整体视角构图偏大: ' + wide.map((f) => f.name).join(', '));
el('btn-reset').dispatchEvent({ type: 'click' });
frames(0.8);
console.log('✓ 六个预设视角切换 + 重置 正常');

/* ---------------- 屏幕踏板 ---------------- */
pedalButtons.forEach((b) => {
  b.dispatchEvent({ type: 'pointerdown', preventDefault() {} });
  frames(0.2);
  sandbox.dispatchEvent({ type: 'pointerup' });
  frames(0.2);
});
console.log('✓ 屏幕三踏板可用');

/* ---------------- 长时间稳定性 ---------------- */
frames(6.0);
if (errors.length) {
  console.log('⚠ 捕获到异常:');
  errors.forEach((e) => console.log('   ' + e.stack));
  process.exitCode = 1;
} else {
  console.log('✓ 共渲染 ' + renderCount + ' 帧，全程无异常');
  console.log('  合成器统计: 振荡器 ' + audioStats.osc + ' / 增益节点 ' + audioStats.gains);
  console.log('OK');
}
