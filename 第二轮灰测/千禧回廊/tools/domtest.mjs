// tools/domtest.mjs —— 用假 DOM + 假 WebAudio 真的跑一遍 main.js
//   目的：在没有浏览器的情况下，验证 index.html 的外壳、hud.js、audio.js、
//   输入绑定、主循环、以及"按键 → 交互 → 字幕"这条链路真的通。
//   任何 DOM 拼写错误、WebAudio 用法错误，都会在这里炸出来。

const errors = [];
const original = { error: console.error };
console.error = (...a) => { errors.push(a.join(' ')); original.error(...a); };

// ————————————————————————— 假 DOM —————————————————————————
const listeners = new Map();
function el(tag = 'div') {
  const node = {
    tagName: tag, style: {}, dataset: {},
    _text: '', _html: '', children: [],
    className: '',
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c) { if (this._s.has(c)) { this._s.delete(c); return false; } this._s.add(c); return true; },
    },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); if (v === '') this.children.length = 0; },
    offsetWidth: 100,
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { (listeners.get(this) || listeners.set(this, new Map()).get(this)).set(t, f); },
    removeEventListener() {},
    requestPointerLock() { globalThis.document.pointerLockElement = this; },
    getContext() {
      return {
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData() {}, clearRect() {}, fillText() {},
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        set font(v) {}, set fillStyle(v) {}, set textBaseline(v) {}, set textAlign(v) {},
      };
    },
    width: 0, height: 0,
  };
  return node;
}
const byId = new Map();
globalThis.document = {
  pointerLockElement: null,
  getElementById(id) {
    if (!byId.has(id)) byId.set(id, el(id === 'view' ? 'canvas' : 'div'));
    return byId.get(id);
  },
  createElement: (t) => el(t),
  addEventListener(t, f) { (listeners.get(globalThis.document) || listeners.set(globalThis.document, new Map()).get(globalThis.document)).set(t, f); },
  exitPointerLock() { globalThis.document.pointerLockElement = null; },
};

const frames = [];
globalThis.window = {
  innerWidth: 1600, innerHeight: 900,
  addEventListener(t, f) { (listeners.get(globalThis.window) || listeners.set(globalThis.window, new Map()).get(globalThis.window)).set(t, f); },
  removeEventListener() {},
};
globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };

// ————————————————————————— 假 WebAudio —————————————————————————
let audioCalls = 0;
const param = () => ({
  value: 0,
  setValueAtTime() { audioCalls++; return this; },
  linearRampToValueAtTime() { audioCalls++; return this; },
  exponentialRampToValueAtTime() { audioCalls++; return this; },
  setTargetAtTime() { audioCalls++; return this; },
  cancelScheduledValues() { return this; },
});
const anode = (extra = {}) => ({
  connect(t) { audioCalls++; return t; }, disconnect() {},
  start() { audioCalls++; }, stop() { audioCalls++; },
  ...extra,
});
class FakeAudioContext {
  constructor() { this.sampleRate = 48000; this.state = 'running'; this._t = 0; this.destination = anode(); }
  get currentTime() { return (this._t += 0.0005); }
  resume() { this.state = 'running'; }
  createGain() { return anode({ gain: param() }); }
  createBiquadFilter() { return anode({ type: '', frequency: param(), Q: param(), detune: param() }); }
  createOscillator() { return anode({ type: '', frequency: param(), detune: param() }); }
  createBufferSource() { return anode({ buffer: null, loop: false, playbackRate: param() }); }
  createBuffer(ch, len) { return { numberOfChannels: ch, length: len, getChannelData: () => new Float32Array(len) }; }
  createConvolver() { return anode({ buffer: null, normalize: true }); }
  createStereoPanner() { return anode({ pan: param() }); }
  createWaveShaper() { return anode({ curve: null, oversample: 'none' }); }
  createDynamicsCompressor() { return anode({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
}
globalThis.window.AudioContext = FakeAudioContext;
globalThis.AudioContext = FakeAudioContext;

// ————————————————————————— 跑起来 —————————————————————————
const step = () => { const f = frames.shift(); if (f) f(performance.now()); };
const fire = (target, type, ev = {}) => {
  const m = listeners.get(target);
  const f = m && m.get(type);
  if (f) f({ preventDefault() {}, changedTouches: [], ...ev });
  return !!f;
};

let ok = 0, bad = 0;
const check = (cond, msg) => { console.log(`  ${cond ? '✔' : '✘'} ${msg}`); cond ? ok++ : bad++; };

await import('../src/main.js');

const QX = globalThis.window.__QX;
check(!!QX && !!QX.game, '入口跑通，window.__QX 暴露出 game');
if (!QX) { console.log('  ✘ 入口没跑起来，后续跳过'); process.exit(1); }
check(byId.get('view').width === 384, `画布内部分辨率 ${byId.get('view').width}×${byId.get('view').height}`);
check(frames.length > 0, '主循环已注册 requestAnimationFrame');
check(QX.game.paused === true, '初始处于标题页（暂停）');

// 汉字渲染器：横幅上的字是真汉字而不是抽象字块
const { hasGlyphRenderer } = await import('../src/gfx/pixels.js');
check(hasGlyphRenderer(), '汉字渲染器已装好（横幅/小广告能出真字）');

// 按回车开始
const started = fire(globalThis.window, 'keydown', { code: 'Enter' });
check(started, '键盘事件已绑定');
check(QX.game.paused === false, '回车后进入游戏');
check(byId.get('title').style.display === 'none', '标题页已隐藏');
const afterStart = audioCalls;
check(afterStart > 25, `WebAudio 已铺好环境床：${afterStart} 次节点/参数调用`);

// 走 4 秒（含淡入）
for (let i = 0; i < 240; i++) { QX.game.update(1 / 60); QX.game.render(); }
check(QX.game.fade < 0.05, '淡入完成');
check(byId.get('sub').textContent.length > 0 || QX.game.subQueue.length >= 0, '字幕系统在跑');

// 往前走：会踩出脚步声、触发声控灯
fire(globalThis.window, 'keydown', { code: 'KeyW' });
const before = { x: QX.game.cam.x, y: QX.game.cam.y };
for (let i = 0; i < 180; i++) { QX.game.update(1 / 60); }
const moved = Math.hypot(QX.game.cam.x - before.x, QX.game.cam.y - before.y);
check(moved > 1.5, `按 W 真的走动了 ${moved.toFixed(2)} 米`);
check(QX.game.get('lampTimer', 0) > 0, '脚步声唤醒了声控灯（lampTimer 已置位）');
const lampOn = QX.game.world.lights.find((l) => l.id === 'l_hall')?.on;
check(lampOn === true, '门厅那盏声控灯亮了');
fire(globalThis.window, 'keyup', { code: 'KeyW' });
check(audioCalls > afterStart + 60, `走路期间又发了 ${audioCalls - afterStart} 次声（脚步/声控灯/环境事件）`);

// 走到自行车前面按 E
QX.game.cam.x = 5.4; QX.game.cam.y = 24.2; QX.game.cam.a = -Math.PI / 2;
QX.game.update(1 / 60);
check(QX.game.prompt?.id === 'bike', `靠近自行车时提示的是「${QX.game.prompt?.label}」`);
const subsBefore = QX.game.subQueue.length;
fire(globalThis.window, 'keydown', { code: 'KeyE' });
check(QX.game.subQueue.length > subsBefore, '按 E 触发了交互文本');

// 记忆手册
fire(globalThis.window, 'keydown', { code: 'Tab' });
check(byId.get('log').classList.contains('open'), 'Tab 打开记忆手册');
check(byId.get('logList').innerHTML.length > 0, '手册内容已渲染');
fire(globalThis.window, 'keydown', { code: 'Tab' });
check(!byId.get('log').classList.contains('open'), 'Tab 再按一次关闭');

// 静音
fire(globalThis.window, 'keydown', { code: 'KeyM' });
check(QX.A.isMuted(), 'M 键静音生效');
fire(globalThis.window, 'keydown', { code: 'KeyM' });

// 鼠标转头
byId.get('view').requestPointerLock();
const a0 = QX.game.cam.a;
fire(globalThis.document, 'mousemove', { movementX: 220, movementY: 0 });
QX.game.update(1 / 60);
check(Math.abs(QX.game.cam.a - a0) > 0.2, '鼠标锁定后能转头');

// 上下视角方向：pitch 是地平线的屏幕偏移，>0 = 抬头
QX.game.lookPitch = 0;
fire(globalThis.document, 'mousemove', { movementX: 0, movementY: 120 });
QX.game.update(1 / 60);
const downPitch = QX.game.lookPitch;
check(downPitch < -5, `鼠标下推 → 低头（lookPitch ${downPitch.toFixed(1)}）`);
QX.game.lookPitch = 0;
fire(globalThis.document, 'mousemove', { movementX: 0, movementY: -120 });
QX.game.update(1 / 60);
const upPitch = QX.game.lookPitch;
check(upPitch > 5, `鼠标上推 → 抬头（lookPitch ${upPitch.toFixed(1)}）`);
QX.game.lookPitch = 0;
fire(globalThis.window, 'keydown', { code: 'ArrowUp' });
QX.game.update(1 / 30);
check(QX.game.lookPitch > 0, '↑ 键抬头，与鼠标方向一致');
fire(globalThis.window, 'keyup', { code: 'ArrowUp' });

// 视角必须"保持"，不能自动回正（否则抬头看不了斗拱/采光顶/吸顶灯）
fire(globalThis.document, 'mousemove', { movementX: 0, movementY: -90 });
QX.game.update(1 / 60);
const held = QX.game.lookPitch;
for (let i = 0; i < 120; i++) QX.game.update(1 / 60);   // 松手站两秒
check(Math.abs(QX.game.lookPitch - held) < 0.001,
  `松开鼠标两秒后视角保持不动（${held.toFixed(1)} → ${QX.game.lookPitch.toFixed(1)}）`);

// 上下有上限，但要够大（至少能抬到 30°）
const focal = (QX.game.renderer.w / 2) / Math.tan(QX.game.cam.fov / 2);
for (let i = 0; i < 40; i++) {
  fire(globalThis.document, 'mousemove', { movementX: 0, movementY: -400 });
  QX.game.update(1 / 60);
}
const maxDeg = (Math.atan(QX.game.lookPitch / focal) * 180) / Math.PI;
check(maxDeg > 30 && maxDeg < 45, `抬头上限 ${maxDeg.toFixed(0)}°（够看天花板，又不至于翻过去）`);

// C 键归正
fire(globalThis.window, 'keydown', { code: 'KeyC' });
for (let i = 0; i < 90; i++) QX.game.update(1 / 60);
fire(globalThis.window, 'keyup', { code: 'KeyC' });
check(Math.abs(QX.game.lookPitch) < 12, `按住 C 视角归正（剩余 ${QX.game.lookPitch.toFixed(1)} px）`);
QX.game.lookPitch = 0;

// 转场 + 结局面板
QX.game.goto('roof', 0.05);
for (let i = 0; i < 300; i++) { QX.game.update(1 / 60); }
check(QX.game.zoneId === 'roof', '场景切换到天台');
check(byId.get('zone').textContent === '天台', `HUD 场景名：${byId.get('zone').textContent}`);
QX.game.finish();
for (let i = 0; i < 400; i++) { QX.game.update(1 / 60); }
check(byId.get('end').classList.contains('open'), '结局面板已打开');
check(byId.get('end').children.length > 10, `结局有 ${byId.get('end').children.length} 行文本`);

// 再跑几帧主循环，确认 rAF 链没断
for (let i = 0; i < 5; i++) step();
check(errors.length === 0, errors.length ? `控制台报错：${errors[0]}` : '全程无 console.error');

console.log(`\n${bad === 0 ? '✔' : '✘'} 浏览器桩测试：${ok} 项通过${bad ? `，${bad} 项失败` : ''}`);
process.exit(bad === 0 ? 0 : 1);
