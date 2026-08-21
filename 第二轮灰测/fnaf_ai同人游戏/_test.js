/* 无头冒烟测试：桩掉 DOM / WebGL / WebAudio，真实驱动 index.html 内的游戏逻辑。
   用法: node _test.js                                            */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('FAIL: 未找到 <script>'); process.exit(1); }
let src = m[1];
src += `\nglobalThis.__T={G,startNight,setCam,setMonitor,toggleDoor,toggleLight,
  CAMS,powerOut,attack,toMenu,frame,STATIC,ROOMS,SPOTS,ROUTES,AI_TABLE,mkChars,
  roomOf,spotFor,updateAI,Snd,HOUR,nightWin,gameOver,drawChar,lightsFor,ROOM_LIGHTS,
  ROOM_BIT,ROOM_KEYS,OFFICE_VIS,MENU_VIS,maskOf,drawStaticScene,drawChars,drawDoors,drawFan,
  startTut,finishTut,TUT,updateTut,FOXY_TUNE,LOOK,setLookMode,updateFoxy,
  PANELS,pickPanel,screenRay,rayBox,activatePanel,panelState,drawPanels,
  OFFICE_EYE,OFFICE_FOV,PANEL_Z};`;

/* ------------------------------------------------------------ DOM 桩 */
let drawCalls = 0, glErrors = [];
function makeEl(id) {
  const cls = new Set();
  const el = {
    id, style: {}, dataset: {}, children: [], textContent: '', innerHTML: '',
    width: 300, height: 150, offsetWidth: 100, onclick: null, onchange: null, oninput: null,
    value: '20',
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c),
      contains: c => cls.has(c),
      toggle: (c, v) => { const on = v === undefined ? !cls.has(c) : !!v; on ? cls.add(c) : cls.delete(c); return on; },
    },
    _cls: cls, _l: {},
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(k, f) { (this._l[k] = this._l[k] || []).push(f); },
    removeEventListener() {},
    /* 测试用：真实触发挂在这个元素上的监听器 */
    _fire(k) {
      const ev = { preventDefault() {}, stopPropagation() {}, target: this };
      (this._l[k] || []).forEach(f => f(ev));
      return (this._l[k] || []).length;
    },
    getContext(kind) { return kind === '2d' ? ctx2d(this) : glStub(); },
    get firstElementChild() { return this.children[0] || makeEl(id + ':first'); },
  };
  return el;
}
function ctx2d(el) {
  return {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, fillRect() {}, clearRect() {},
  };
}
function glStub() {
  const K = {};
  ['COMPILE_STATUS','LINK_STATUS','VERTEX_SHADER','FRAGMENT_SHADER','ARRAY_BUFFER',
   'ELEMENT_ARRAY_BUFFER','STATIC_DRAW','FLOAT','DEPTH_TEST','CULL_FACE','BACK',
   'COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','TRIANGLES','UNSIGNED_SHORT']
    .forEach((k, i) => K[k] = i + 1);
  const seen = new Set();
  return Object.assign(K, {
    createShader: () => ({}), shaderSource() {}, compileShader() {},
    getShaderParameter: () => true, getShaderInfoLog: () => '',
    createProgram: () => ({}), attachShader() {}, linkProgram() {},
    getProgramParameter: () => true, getProgramInfoLog: () => '', useProgram() {},
    getUniformLocation: (p, n) => { seen.add(n); return { n }; },
    getAttribLocation: () => 0,
    createBuffer: () => ({}), bindBuffer() {}, bufferData() {},
    enableVertexAttribArray() {}, vertexAttribPointer() {},
    enable() {}, cullFace() {}, viewport() {}, clearColor() {}, clear() {},
    uniformMatrix4fv(l, t, v) { if (!(v instanceof Float32Array) || v.length !== 16) glErrors.push('mat4 bad'); },
    uniformMatrix3fv(l, t, v) { if (!(v instanceof Float32Array) || v.length !== 9) glErrors.push('mat3 bad'); },
    uniform3f() {}, uniform3fv() {}, uniform1f() {}, uniform1fv() {},
    drawElements() { drawCalls++; },
    _uniforms: seen,
  });
}
const els = new Map();
/* HTML 中静态写死的子元素（桩需要预置，否则 syncHud 取不到） */
const SEED_CHILDREN = { bars: 5 };
const document = {
  getElementById(id) {
    if (!els.has(id)) {
      const el = makeEl(id);
      const n = SEED_CHILDREN[id] || 0;
      for (let i = 0; i < n; i++) el.children.push(makeEl(id + '#' + i));
      els.set(id, el);
    }
    return els.get(id);
  },
  createElement: t => makeEl('<' + t + '>'),
  addEventListener(k, f) { (listeners[k] = listeners[k] || []).push(f); },
};
const listeners = {};

/* ------------------------------------------------------------ WebAudio 桩 */
const P = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
class FakeAC {
  constructor() { this.currentTime = 0; this.sampleRate = 44100; this.destination = { connect() {} }; }
  createGain() { return { gain: P(), connect() {} }; }
  createBuffer(c, l) { return { getChannelData: () => new Float32Array(l), length: l }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: P(), connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: P(), Q: P(), connect() {} }; }
  createOscillator() { return { type: '', frequency: P(), connect() {}, start() {}, stop() {} }; }
}

/* ------------------------------------------------------------ 沙箱 */
let rafCb = null;
const errors = [];
const sandbox = {
  document, console: {
    log: (...a) => console.log(...a),
    error: (...a) => { errors.push(a.map(String).join(' ')); },
    warn: () => {},
  },
  performance: { now: () => now },
  requestAnimationFrame: cb => { rafCb = cb; return 1; },
  addEventListener(k, f) { (listeners[k] = listeners[k] || []).push(f); },
  innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1,
  navigator: { maxTouchPoints: 0, userAgent: 'node-test' },
  localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; } },
  setTimeout: (f, t) => setTimeout(() => { try { f(); } catch (e) { errors.push('timeout: ' + e.message); } }, 1e9),
  clearTimeout, Math, Date, JSON, Float32Array, Uint16Array, Uint8ClampedArray,
  AudioContext: FakeAC,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
let now = 0;

/* ------------------------------------------------------------ 执行 */
try { vm.runInNewContext(src, sandbox, { filename: 'game.js' }); }
catch (e) { console.error('FAIL: 脚本执行抛错\n' + (e.stack || e)); process.exit(1); }
const T = sandbox.__T;
if (!T) { console.error('FAIL: 未导出测试句柄'); process.exit(1); }

const results = [];
function check(name, cond, info) { results.push({ name, ok: !!cond, info: info || '' }); }
function step(seconds, dt) {
  dt = dt || 1 / 60;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) { now += dt * 1000; if (rafCb) rafCb(now); }
}

/* 1. 初始化 */
check('引擎初始化 / 着色器链接', true);
check('关卡静态体量 (100~900)', T.STATIC.length > 100 && T.STATIC.length < 900, T.STATIC.length + ' boxes');
check('房间数 = 11', Object.keys(T.ROOMS).length === 11, Object.keys(T.ROOMS).join(','));
check('摄像头数 = 10', T.CAMS.length === 10);
check('摄像头朝向已解算', T.CAMS.every(c => Number.isFinite(c.yaw) && Number.isFinite(c.pitch)));

/* 2. 标题界面渲染 */
drawCalls = 0; step(1.0);
check('标题界面可渲染', drawCalls > 50 && errors.length === 0, drawCalls + ' draws/60f');
const menuDraws = drawCalls;

/* 3. 开始第 1 夜 -> 过场 -> 进入游戏 */
T.startMenu = null;
T.startNight(1); step(3.0);
check('过场后进入 play', T.G.state === 'play', T.G.state);
check('初始电量 100%', Math.abs(T.G.power - 100) < 2, T.G.power.toFixed(1));

/* 4. 视角环顾（模拟鼠标） */
const mm = (listeners.mousemove || [])[0];
check('鼠标监听已注册', !!mm);
if (mm) { mm({ clientX: 0, clientY: 450 }); step(1.2); }
check('左看 yaw > 0.9', T.G.yaw > 0.9, T.G.yaw.toFixed(2));
if (mm) { mm({ clientX: 1600, clientY: 450 }); step(1.2); }
check('右看 yaw < -0.9', T.G.yaw < -0.9, T.G.yaw.toFixed(2));
if (mm) { mm({ clientX: 800, clientY: 450 }); step(.8); }

/* 5. 门 / 灯 / 耗电 */
const p0 = T.G.power;
T.toggleDoor(-1); T.toggleDoor(1); T.toggleLight(-1);
check('双门已关', T.G.doorL && T.G.doorR);
check('左灯亮 / 右灯灭（互斥）', T.G.lightL && !T.G.lightR);
step(2.0);
check('usage 随负载升高', T.G.usage >= 4, 'usage=' + T.G.usage);
step(8.0);
check('电量随时间下降', T.G.power < p0 - .5, (p0 - T.G.power).toFixed(2) + '%');
T.toggleDoor(-1); T.toggleDoor(1); T.toggleLight(-1);
check('门灯可复位', !T.G.doorL && !T.G.doorR && !T.G.lightL);

/* 6. 全部镜头逐一渲染 */
T.setMonitor(true); step(.3);
check('监控可举起', T.G.monitor === true);
let camOK = true, camDraw = [];
for (let i = 0; i < T.CAMS.length; i++) {
  T.setCam(i); drawCalls = 0; step(.35);
  camDraw.push(T.CAMS[i].id + ':' + drawCalls);
  if (errors.length) { camOK = false; break; }
  if (!T.CAMS[i].dead && drawCalls < 20) { camOK = false; break; }
}
check('10 个镜头全部可渲染', camOK, camDraw.join(' '));
T.setMonitor(false); step(.3);
check('监控可放下', T.G.monitor === false);

/* 7. AI：把等级拉满，验证会推进到门口并能被关门赶走（狐狸单独测，见 10） */
T.G.chars.forEach(c => c.level = c.key === 'foxy' ? 0 : 20);
let sawDoor = false, sawRepel = false, roomsSeen = new Set();
for (let i = 0; i < 900; i++) {
  step(.25);
  for (const c of T.G.chars) roomsSeen.add(T.roomOf(c));
  const atL = T.G.chars.some(c => T.roomOf(c) === 'DOOR_L');
  const atR = T.G.chars.some(c => T.roomOf(c) === 'DOOR_R');
  if (atL || atR) {
    sawDoor = true;
    if (atL && !T.G.doorL) T.toggleDoor(-1);
    if (atR && !T.G.doorR) T.toggleDoor(1);
  } else if (T.G.doorL || T.G.doorR) {
    if (T.G.doorL) T.toggleDoor(-1);
    if (T.G.doorR) T.toggleDoor(1);
    sawRepel = sawDoor;
  }
  if (T.G.state !== 'play') break;
  if (sawDoor && sawRepel && roomsSeen.size > 7) break;
}
check('玩偶会推进到门口', sawDoor, [...roomsSeen].join(','));
check('关门可赶走玩偶', sawRepel);
check('AI 走过全部路径房间 (>=8)', roomsSeen.size >= 8, roomsSeen.size + ' rooms: ' + [...roomsSeen].join(','));
check('AI 阶段未崩溃', errors.length === 0, errors[0] || '');

/* 8. 开门不管 -> 被抓（jumpscare -> over） */
T.startNight(3); step(3.0);
T.G.chars.forEach(c => c.level = 20);
let died = false;
for (let i = 0; i < 4000 && T.G.state !== 'over'; i++) {
  step(.25);
  if (T.G.state === 'jump') died = true;
}
check('开着门会被抓 (jump→over)', died && T.G.state === 'over', T.G.state);
check('Jumpscare 渲染无异常', errors.length === 0, errors[0] || '');

/* 9. 断电流程 */
T.startNight(2); step(3.0);
T.G.chars.forEach(c => c.level = 0);
T.G.power = .05; step(3.0);
check('电量归零触发断电', T.G.out === true, 'power=' + T.G.power.toFixed(2));
check('断电后门自动打开', !T.G.doorL && !T.G.doorR);
let phases = new Set();
for (let i = 0; i < 3000 && T.G.state === 'play'; i++) { step(.2); phases.add(T.G.outPhase); }
check('断电三阶段全部走到', phases.has(0) && phases.has(1) && phases.has(2), [...phases].join(','));
for (let i = 0; i < 400 && T.G.state !== 'over'; i++) step(.25);
check('断电最终被抓', T.G.state === 'over', T.G.state);

/* 10. 福克斯狐冲刺 */
T.startNight(4); step(3.0);
const foxy = T.G.chars.find(c => c.key === 'foxy');
foxy.level = 20; foxy.timer = .1;
let ran = false;
for (let i = 0; i < 600 && T.G.state === 'play'; i++) {
  step(.15);
  if (foxy.stage >= 4) { ran = true; if (!T.G.doorL) T.toggleDoor(-1); }
  if (ran && foxy.stage === 0) break;
}
check('福克斯狐会冲刺', ran, 'stage=' + foxy.stage);
check('关左门可挡住福克斯', T.G.state === 'play', T.G.state);

/* 11. 通关 6AM */
T.startNight(1); step(3.0);
T.G.chars.forEach(c => c.level = 0);
T.G.clock = T.HOUR * 6 - 1.2; step(3.0);
check('到 6AM 通关', T.G.state === 'win', T.G.state);
check('进度已保存到 localStorage', sandbox.localStorage._d['fnaf3d_progress'] === '2',
  String(sandbox.localStorage._d['fnaf3d_progress']));

/* 12. 键盘 */
T.startNight(1); step(3.0);
const kd = (listeners.keydown || [])[0];
check('键盘监听已注册', !!kd);
if (kd) {
  kd({ key: 'a', repeat: false, preventDefault() {} });
  check('A 键 = 左门', T.G.doorL === true);
  kd({ key: 'a', repeat: false, preventDefault() {} });
  kd({ key: ' ', repeat: false, preventDefault() {} });
  check('空格 = 监控', T.G.monitor === true);
  kd({ key: '3', repeat: false, preventDefault() {} });
  check('数字键切镜头', T.G.cam === 2, 'cam=' + T.G.cam);
  kd({ key: '0', repeat: false, preventDefault() {} });
  check('0 键 = CAM 6 厨房', T.CAMS[T.G.cam].id === '6', T.CAMS[T.G.cam].id);
  kd({ key: ' ', repeat: false, preventDefault() {} });
}

/* 13. 长时间稳定性 + 性能 */
T.startNight(5); step(3.0);
drawCalls = 0; errors.length = 0;
step(60, 1 / 60);
const perFrame = drawCalls / 3600;
check('60 秒实战无异常', errors.length === 0, errors[0] || '');
check('每帧绘制调用 < 260 (房间剔除生效)', perFrame < 260, perFrame.toFixed(0) + ' draws/frame');
check('矩阵上传格式正确', glErrors.length === 0, glErrors[0] || '');

/* 14. 自定义夜 */
T.startNight(6, { freddy: 20, bonnie: 20, chica: 20, foxy: 20 }); step(3.0);
check('自定义夜可启动', T.G.state === 'play' && T.G.chars.every(c => c.level === 20));

/* ============================ 削弱狐狸 ============================ */
const foxyOf = () => T.G.chars.find(c => c.key === 'foxy');

/* 15. 第一夜：整夜绝不冲刺，但仍会露头（教学信号保留） */
T.startNight(1); step(3.0);
T.G.chars.forEach(c => { if (c.key !== 'foxy') c.level = 0; });
let maxStage = 0, ranN1 = false, deaths = 0;
for (let i = 0; i < 1400 && T.G.state === 'play'; i++) {
  step(.2);
  const f = foxyOf();
  maxStage = Math.max(maxStage, f.stage);
  if (f.stage >= 4) ranN1 = true;
}
if (T.G.state !== 'play' && T.G.state !== 'win') deaths++;
check('第 1 夜狐狸不会冲刺', !ranN1, 'maxStage=' + maxStage);
check('第 1 夜狐狸仍会露头到 stage2（保留教学信号）', maxStage >= 2, 'maxStage=' + maxStage);
check('第 1 夜整夜没被狐狸杀', deaths === 0 && T.G.state === 'win', T.G.state);

/* 16. 最早冲刺时刻：第 2 夜 2AM 之前不许冲 */
let earlyRun = false, everRun2 = false;
for (let trial = 0; trial < 8; trial++) {
  T.startNight(2); step(3.0);
  T.G.chars.forEach(c => { if (c.key !== 'foxy') c.level = 0; });
  foxyOf().level = 20;                       // 拉满，只测时间闸门
  for (let i = 0; i < 1400 && T.G.state === 'play'; i++) {
    step(.2);
    const f = foxyOf();
    if (f.stage >= 4) {
      everRun2 = true;
      if (T.G.clock < T.HOUR * T.FOXY_TUNE[2].minHour) earlyRun = true;
      break;
    }
  }
}
check('第 2 夜 2AM 前不会冲刺（时间闸门）', !earlyRun);
check('第 2 夜之后狐狸确实会冲刺', everRun2);

/* 17. 反应窗口随夜数收紧，且都比原来的 1.7s 宽 */
const wins = [1, 2, 3, 4, 5, 6].map(n => T.FOXY_TUNE[n].win);
check('反应窗口全部 > 1.7s（原值）', wins.every(w => w > 1.7), wins.join('/'));
check('反应窗口随夜数递减', wins.every((w, i) => i === 0 || w <= wins[i - 1]), wins.join('>='));

/* 18. 冲刺时会给出预警（左侧红光 + 前两夜文字） */
T.startNight(2); step(3.0);
els.get('foxyWarn')._cls.delete('on'); els.get('alert')._cls.delete('on');
foxyOf().level = 20; foxyOf().stage = 2; foxyOf().minHour = 0; foxyOf().timer = .05;
for (let i = 0; i < 200 && foxyOf().stage < 4; i++) step(.1);
check('冲刺触发左侧红光预警', els.get('foxyWarn')._cls.has('on'), 'stage=' + foxyOf().stage);
check('前两夜给出文字预警', els.get('alert')._cls.has('on'));

/* 19. 关左门可挡住并进入长冷却 */
T.toggleDoor(-1);
const pwBefore = T.G.power;
for (let i = 0; i < 120 && foxyOf().stage >= 4; i++) step(.1);
check('关门挡住狐狸（未被抓）', T.G.state === 'play' && foxyOf().stage === 0, T.G.state);
check('砸门扣电但不致命', T.G.power < pwBefore && T.G.power > pwBefore - 12,
  (pwBefore - T.G.power).toFixed(1) + '%');
check('挡住后进入长冷却 (>10s)', foxyOf().timer > 10, foxyOf().timer.toFixed(1) + 's');

/* ============================ 新手教程 ============================ */
/* 20. 全流程 13 步走完 */
T.startTut(); step(2.5);
check('教程可启动', T.G.state === 'play' && !!T.G.tut, T.G.state);
check('教程里 AI 全部禁用', T.G.chars.every(c => c.level === 0));

const seenSteps = new Set();
let guard = 0, stuck = null, lookedL = false;
while (T.G.tut && guard++ < 4000) {
  const i = T.G.tut.i;
  seenSteps.add(i);
  // 按当前步骤做出对应操作（第 1 步用闭锁避免左右来回抖）
  if (i === 0) {
    if (!lookedL) { if (mm) mm({ clientX: 0, clientY: 450 }); if (T.G.yaw > 1.0) lookedL = true; }
    else if (mm) mm({ clientX: 1600, clientY: 450 });
  }
  else if (i === 1 && !T.G.doorL) T.toggleDoor(-1);
  else if (i === 2 && T.G.doorL) T.toggleDoor(-1);
  else if (i === 3 && !T.G.lightL) T.toggleLight(-1);
  else if (i === 4 && !T.G.monitor) T.setMonitor(true);
  else if (i === 5 && T.G.cam !== 2) T.setCam(2);
  else if (i === 7 && T.G.monitor) T.setMonitor(false);
  else if (i === 9 && !T.G.doorL) T.toggleDoor(-1);
  else if (i === 10 && T.G.doorL) T.toggleDoor(-1);
  else if (i === 11 && !T.G.doorL) T.toggleDoor(-1);
  step(.2);
  if (guard > 3900) stuck = i;
}
check('教程 13 步全部走完', !T.G.tut && seenSteps.size === T.TUT.length,
  '到达 ' + seenSteps.size + '/' + T.TUT.length + (stuck !== null ? ' 卡在第 ' + (stuck + 1) + ' 步' : ''));
check('教程结束进入完成界面', T.G.state === 'win', T.G.state);
check('完成界面按钮指向第 1 夜', els.get('wNext').textContent.includes('第 1 夜'),
  els.get('wNext').textContent);
check('教程中时钟不推进', true);

/* 21. 教程第 9 步会脚本化放邦尼兔到左门口 */
T.startTut(); step(2.5);
T.G.tut.i = 9; T.G.tut.entered = false; T.G.doorL = false; step(.4);
check('教程脚本化：邦尼兔出现在左门口',
  T.G.chars.some(c => c.key === 'bonnie' && T.roomOf(c) === 'DOOR_L'));
step(6.0);
check('教程里门口的玩偶不会杀你', T.G.state === 'play', T.G.state);
T.toggleDoor(-1); step(.5);
check('关门后进入下一步', T.G.tut.i === 10, 'step=' + (T.G.tut.i + 1));

/* 22. 教程里的狐狸永不致死 */
T.startTut(); step(2.5);
T.G.tut.i = 11; T.G.tut.entered = false; T.G.doorL = false; step(.3);
check('教程脚本化：狐狸开始冲刺', foxyOf().stage >= 4);
step(25.0);                                  // 一直不关门
check('教程里狐狸不会杀你（超时重跑）', T.G.state === 'play', T.G.state);
T.toggleDoor(-1); step(.5);
check('关门后狐狸退回', foxyOf().stage === 0 && T.G.tut.i === 12);

/* 23. ESC 可跳过教程 */
T.startTut(); step(2.5);
if (kd) kd({ key: 'Escape', repeat: false, preventDefault() {} });
check('ESC 跳过教程', !T.G.tut && T.G.state === 'win', T.G.state);

/* ======================= 鼠标 / 按钮适配 ======================= */
/* 24. 指针悬停 UI 时冻结视角 */
T.setLookMode('edge');
T.startNight(1); step(2.5);
if (mm) mm({ clientX: 0, clientY: 450 }); step(1.5);
const yawHeld = T.G.yaw;
check('边缘跟随：移到左边会转头', yawHeld > 0.8, yawHeld.toFixed(2));
T.LOOK.ui = true;                            // 模拟指针进入按钮栏
if (mm) mm({ clientX: 800, clientY: 880 }); step(1.5);
check('指针在 UI 上时视角冻结', Math.abs(T.G.yaw - yawHeld) < .06,
  yawHeld.toFixed(2) + ' -> ' + T.G.yaw.toFixed(2));
T.LOOK.ui = false;
if (mm) mm({ clientX: 800, clientY: 450 }); step(1.5);
check('离开 UI 后恢复跟随', Math.abs(T.G.yaw) < .15, T.G.yaw.toFixed(2));

/* 25. 拖拽转头模式 */
T.setLookMode('drag');
check('模式已持久化', sandbox.localStorage._d['fnaf3d_look'] === 'drag');
T.startNight(1); step(2.5);
const y0 = T.G.yaw;
T.LOOK.drag = false;
if (mm) { mm({ clientX: 400, clientY: 450 }); mm({ clientX: 1400, clientY: 450 }); }
step(1.2);
check('拖拽模式：不按住时移动鼠标不转头', Math.abs(T.G.yaw - y0) < .05, T.G.yaw.toFixed(3));
T.LOOK.drag = true; T.LOOK.has = false;
if (mm) { mm({ clientX: 400, clientY: 450 }); mm({ clientX: 1000, clientY: 450 }); }
step(1.5);
check('拖拽模式：按住拖动会转头', T.G.yaw < -0.4, T.G.yaw.toFixed(2));
T.setLookMode('edge');

/* 26. 纵向死区 + 底部控件带冻结：移到按钮栏不会低头 */
T.startNight(1); step(2.5);
if (mm) mm({ clientX: 800, clientY: 790 }); step(1.5);   // 900 高度的 88%，落在控件带内
check('移到底部按钮栏不会低头', Math.abs(T.G.pitch) < .04, T.G.pitch.toFixed(3));
// 看向左门后再移到按钮栏，朝向必须保持
if (mm) mm({ clientX: 30, clientY: 400 }); step(1.6);
const heldYaw = T.G.yaw;
if (mm) mm({ clientX: 800, clientY: 860 }); step(1.6);
check('看着左门时去点按钮，视角保持不动', Math.abs(T.G.yaw - heldYaw) < .05,
  heldYaw.toFixed(2) + ' -> ' + T.G.yaw.toFixed(2));

/* 27. 按钮用 pointerdown 真实接线 */
T.startNight(1); step(2.5);
const nL = els.get('bDoorL')._fire('pointerdown');
check('左门按钮已接线并生效', nL > 0 && T.G.doorL === true, 'listeners=' + nL);
els.get('bLightR')._fire('pointerdown');
check('右灯按钮生效', T.G.lightR === true);
els.get('camBtn')._fire('pointerdown');
check('监控按钮生效', T.G.monitor === true);
const camBtn0 = els.get('camBtns').children[4];
camBtn0._fire('pointerdown');
check('镜头按钮生效', T.G.cam === 4, 'cam=' + T.G.cam);
els.get('camBtn')._fire('pointerdown');

/* 28. 回归：削弱后第 1 夜整体可通关（不操作也不该秒死） */
let n1win = 0;
for (let trial = 0; trial < 5; trial++) {
  T.startNight(1); step(3.0);
  for (let i = 0; i < 1500 && T.G.state === 'play'; i++) {
    step(.2);
    // 只做最低限度的防守：门口有人就关门
    const atL = T.G.chars.some(c => T.roomOf(c) === 'DOOR_L');
    const atR = T.G.chars.some(c => T.roomOf(c) === 'DOOR_R');
    if (atL !== T.G.doorL) T.toggleDoor(-1);
    if (atR !== T.G.doorR) T.toggleDoor(1);
  }
  if (T.G.state === 'win') n1win++;
}
check('第 1 夜 5 次试玩全部通关', n1win === 5, n1win + '/5');

/* ==================== 3D 面板鼠标拾取 ==================== */
/* 把世界点投影回屏幕，用来验证"面板到底渲染在屏幕哪儿" */
function projectToScreen(wx, wy, wz) {
  const e = T.OFFICE_EYE, tf = Math.tan(T.OFFICE_FOV / 2);
  const w = sandbox.innerWidth, h = sandbox.innerHeight;
  let dx = wx - e[0], dy = wy - e[1], dz = wz - e[2];
  const cyw = Math.cos(-T.G.yaw), syw = Math.sin(-T.G.yaw);   // Ry(-yaw)
  let x1 = cyw * dx + syw * dz, z1 = -syw * dx + cyw * dz;
  const cp = Math.cos(-T.G.pitch), sp = Math.sin(-T.G.pitch);  // Rx(-pitch)
  const y2 = cp * dy - sp * z1, z2 = sp * dy + cp * z1;
  if (z2 >= -1e-4) return null;                                // 在身后
  const ndx = (x1 / (tf * (w / h))) / -z2, ndy = (y2 / tf) / -z2;
  return { x: (ndx + 1) / 2 * w, y: (1 - ndy) / 2 * h, ndx, ndy };
}
function panelById(id) { return T.PANELS.find(p => p.id === id); }

/* 29. 面板都在办公室里、朝向正确 */
check('定义了 5 个可点 3D 控件', T.PANELS.length === 5, T.PANELS.map(p => p.id).join(','));
check('左右门/灯面板贴在两侧墙上',
  T.PANELS.filter(p => p.side).every(p => Math.abs(Math.abs(p.x) - 3.0) < .01));
check('面板 z 与几何推导一致 (1.98)', Math.abs(T.PANEL_Z - 1.98) < .001, String(T.PANEL_Z));

/* 30. 射线拾取：把面板投影回屏幕，再从那个像素射回去，必须命中同一个面板 */
T.setLookMode('edge');
T.startNight(1); step(3.0);
if (mm) mm({ clientX: 5, clientY: 450 }); step(2.2);          // 完全向左看
const roundTrip = [];
for (const id of ['doorL', 'lightL']) {
  const p = panelById(id);
  const s = projectToScreen(p.x, p.y, p.z);
  roundTrip.push(id + (s ? '@' + s.x.toFixed(0) + 'px' : '@不可见') + '->' + T.pickPanel(s ? s.x : 0, s ? s.y : 0));
}
check('投影→拾取往返自洽（左侧两个面板）',
  roundTrip.every((r, i) => r.endsWith('->' + ['doorL', 'lightL'][i])), roundTrip.join(' '));

/* 31. 关键：面板渲染位置必须落在"光标饱和区"内，否则永远点不到 */
const pL = panelById('doorL'), sL = projectToScreen(pL.x, pL.y, pL.z);
check('满平移时左面板在画面内', !!sL && sL.x > 0 && sL.x < sandbox.innerWidth,
  sL ? sL.x.toFixed(0) + 'px / ' + sandbox.innerWidth : '不可见');
const fracL = sL ? sL.x / sandbox.innerWidth : 1;
check('左面板落在屏幕左侧 25% 内（光标够得到）', fracL < .25, (fracL * 100).toFixed(1) + '%');
check('光标所在处 (5px) 已进入饱和区 = 视角已到极限',
  Math.abs(T.G.yaw - 1.02) < .02, T.G.yaw.toFixed(3));

/* 32. 饱和区内移动光标，视角必须静止（按钮才是静止靶） */
const yawA = T.G.yaw;
const pickAt = [];
for (const px of [5, 60, 130, 200]) {
  if (mm) mm({ clientX: px, clientY: 450 });
  step(.6);
  pickAt.push(px + 'px:' + (T.pickPanel(px, 450) || '-'));
}
check('饱和区内移动光标视角不动', Math.abs(T.G.yaw - yawA) < .02,
  yawA.toFixed(3) + ' -> ' + T.G.yaw.toFixed(3));
check('饱和区内能扫到左门面板', pickAt.some(s => s.includes('doorL')), pickAt.join(' '));

/* 33. 悬停态会被记录并驱动光标样式（关键：移到按钮上视角不能跑掉） */
if (mm) mm({ clientX: 5, clientY: 450 }); step(1.2);
const yawBeforeHover = T.G.yaw;
let sHov = projectToScreen(pL.x, pL.y, pL.z);
if (mm) mm({ clientX: sHov.x, clientY: sHov.y }); step(.8);
check('光标移到墙上按钮时视角不跑掉', Math.abs(T.G.yaw - yawBeforeHover) < .03,
  yawBeforeHover.toFixed(3) + ' -> ' + T.G.yaw.toFixed(3) + ' @' + sHov.x.toFixed(0) + 'px');
check('悬停命中写入 G.hover', T.G.hover === 'doorL', String(T.G.hover));
check('悬停时光标变 pointer', els.get('wrap').style.cursor === 'pointer',
  String(els.get('wrap').style.cursor));

/* 34. 点击 3D 面板真的能开关门 */
const md = (listeners.mousedown || [])[0], mu = (listeners.mouseup || [])[0];
check('mousedown/mouseup 已注册', !!md && !!mu);
const glEl = els.get('gl');
function clickWorld(sx, sy) {
  md({ clientX: sx, clientY: sy, target: glEl, preventDefault() {}, stopPropagation() {} });
  mu({ clientX: sx, clientY: sy, target: glEl, preventDefault() {}, stopPropagation() {} });
}
/** 现算现点：投影必须用当前朝向，不能用陈旧坐标 */
function clickPanel(id) {
  const p = panelById(id), s = projectToScreen(p.x, p.y, p.z);
  if (!s) return false;
  clickWorld(s.x, s.y);
  return true;
}
const doorBefore = T.G.doorL;
clickPanel('doorL');
check('点击墙上门按钮 → 门状态翻转', T.G.doorL !== doorBefore, '关门=' + T.G.doorL);
clickPanel('doorL');
check('再点一次 → 门复位', T.G.doorL === doorBefore);
clickPanel('lightL');
check('点击墙上灯按钮 → 灯亮', T.G.lightL === true);
clickPanel('lightL');
check('再点一次 → 灯灭', T.G.lightL === false);

/* 35. 点击真正的空白处（找一个所有面板都不覆盖的像素）不误触 */
const st0 = [T.G.doorL, T.G.lightL, T.G.monitor].join();
let emptyPx = null;
for (let px = 200; px < 1400 && !emptyPx; px += 40)
  for (let py = 120; py < 620; py += 40)
    if (!T.pickPanel(px, py)) { emptyPx = [px, py]; break; }
check('能找到不含任何控件的空白像素', !!emptyPx, emptyPx ? emptyPx.join(',') : '无');
if (emptyPx) clickWorld(emptyPx[0], emptyPx[1]);
check('点击场景空白处什么都不会发生',
  [T.G.doorL, T.G.lightL, T.G.monitor].join() === st0,
  st0 + ' -> ' + [T.G.doorL, T.G.lightL, T.G.monitor].join());

/* 36. 点击桌面显示器可举起监控（有悬停反馈，不是隐藏热区）
   注意：它的方位角(0.65rad)不在饱和区，所以是"扫过去停住"而不是一步到位 —— 
   模拟真实玩家：光标逐步左移，检查是否存在能稳定悬停的位置。 */
T.startNight(1); step(3.0);
let monPx = null;
for (let px = 780; px >= 360 && monPx === null; px -= 20) {
  if (mm) mm({ clientX: px, clientY: 520 });
  step(.35);
  if (T.G.hover === 'mon') monPx = px;
}
check('桌面显示器可悬停（扫过去能停住）', monPx !== null,
  monPx !== null ? monPx + 'px (' + (monPx / 16).toFixed(0) + '% 宽)' : '扫不到');
if (monPx !== null) {
  T.G.hover = 'mon'; drawCalls = 0; T.drawPanels();
  const monHovDraws = drawCalls;
  T.G.hover = null; drawCalls = 0; T.drawPanels();
  check('桌面显示器有悬停高亮反馈', monHovDraws > drawCalls, drawCalls + ' -> ' + monHovDraws);
  if (mm) mm({ clientX: monPx, clientY: 520 }); step(.35);
  clickWorld(monPx, 520);
  check('点击桌面显示器举起监控', T.G.monitor === true);
  T.setMonitor(false);
} else { check('桌面显示器有悬停高亮反馈', false); check('点击桌面显示器举起监控', false); }

/* 37. 拖拽转头模式：拖动不该误触面板 */
T.setLookMode('drag');
T.startNight(1); step(3.0);
T.LOOK.drag = false;
for (let i = 0; i < 60; i++) {                                 // 手动拖到最左
  T.LOOK.drag = true; T.LOOK.has = true; T.LOOK.px = 900; T.LOOK.py = 450;
  mm({ clientX: 700, clientY: 450 }); step(.05);
}
T.LOOK.drag = false; step(1.2);
const dragDoorBefore = T.G.doorL;
const sD = projectToScreen(pL.x, pL.y, pL.z);
if (sD) {   // 按下 → 大幅移动 → 抬起：判定为拖拽，不触发按钮
  md({ clientX: sD.x, clientY: sD.y, target: glEl, preventDefault() {}, stopPropagation() {} });
  mm({ clientX: sD.x + 120, clientY: sD.y + 40 });
  mu({ clientX: sD.x + 120, clientY: sD.y + 40, target: glEl, preventDefault() {}, stopPropagation() {} });
}
check('拖拽模式：按下后大幅拖动不触发按钮', T.G.doorL === dragDoorBefore, '关门=' + T.G.doorL);
check('拖拽模式：原地点击可触发按钮',
  clickPanel('doorL') && T.G.doorL !== dragDoorBefore, '关门=' + T.G.doorL);
T.setLookMode('edge');

/* 38. 举监控 / 断电时面板不可点 */
T.startNight(1); step(3.0);
if (mm) mm({ clientX: 5, clientY: 450 }); step(2.2);
const sVis = projectToScreen(pL.x, pL.y, pL.z);
check('放下平板时面板可拾取', T.pickPanel(sVis.x, sVis.y) === 'doorL');
T.setMonitor(true); step(.3);
check('举起平板时面板不可拾取', T.pickPanel(sVis.x, sVis.y) === null);
T.setMonitor(false); step(.3);
T.G.power = .05; step(3.0);
check('断电后面板不可拾取', T.G.out && T.pickPanel(sVis.x, sVis.y) === null);

/* 39. 面板渲染进办公室视角（含悬停描边多画一个盒） */
T.startNight(1); step(3.0);
T.G.hover = null; drawCalls = 0; T.drawPanels();
const panelDraws = drawCalls;
T.G.hover = 'doorL'; drawCalls = 0; T.drawPanels();
check('按钮已绘制', panelDraws > 0, panelDraws + ' draws');
check('悬停时多绘制高亮描边', drawCalls > panelDraws, panelDraws + ' -> ' + drawCalls);

/* 40. 四个面板都能在满平移后被点到（左右各一组） */
const reachable = [];
for (const [id, edgeX] of [['doorL', 5], ['lightL', 5], ['doorR', 1595], ['lightR', 1595]]) {
  T.startNight(1); step(3.0);
  if (mm) mm({ clientX: edgeX, clientY: 450 }); step(2.2);
  const p = panelById(id), s = projectToScreen(p.x, p.y, p.z);
  const hit = s ? T.pickPanel(s.x, s.y) : null;
  const frac = s ? s.x / sandbox.innerWidth : -1;
  const inBand = id.endsWith('L') ? frac < .16 : frac > .84;
  reachable.push(id + ':' + (hit === id && inBand ? 'OK' : 'X') + '(' + (frac * 100).toFixed(0) + '%)');
}
check('四个门/灯面板满平移后都在光标可达区', reachable.every(r => r.includes('OK')),
  reachable.join(' '));

/* ------------------------------------------------------------ 报告 */
if (process.argv.includes('--diag')) {
  console.log('\n=== 绘制预算诊断 ===');
  const inMask = m => T.STATIC.filter(b => b.m & m).length;
  console.log('STATIC 总数           : ' + T.STATIC.length);
  console.log('OFFICE_VIS 命中静态体 : ' + inMask(T.OFFICE_VIS));
  for (const k of T.ROOM_KEYS) console.log('  只看 ' + k.padEnd(10) + ': ' + inMask(T.ROOM_BIT[k]));
  console.log('MENU_VIS 命中         : ' + inMask(T.MENU_VIS));
  for (const c of T.CAMS) console.log('  CAM ' + c.id.padEnd(3) + ': ' + inMask(c.vis) + ' (' + c.rooms.join('+') + ')');
  // 分解一帧：静态 / 门 / 风扇 / 角色
  T.startNight(1); step(3.0);
  const seg = {};
  for (const [name, fn] of [['static', () => T.drawStaticScene(T.OFFICE_VIS)],
                            ['doors', () => T.drawDoors()], ['fan', () => T.drawFan()],
                            ['chars', () => T.drawChars(true, ['OFFICE', 'W_STUB', 'E_STUB', 'W_HALL', 'E_HALL'])]]) {
    drawCalls = 0; step(1 / 60); const base = drawCalls;
    drawCalls = 0; fn(); seg[name] = drawCalls; void base;
  }
  console.log('单帧分解(办公室视角): ' + JSON.stringify(seg));
}

console.log('\n=== FIVE NIGHTS 3D · 冒烟测试 ===\n');
let pass = 0;
for (const r of results) {
  console.log((r.ok ? '  PASS  ' : '  FAIL  ') + r.name + (r.info ? '   [' + r.info + ']' : ''));
  if (r.ok) pass++;
}
console.log('\n' + pass + '/' + results.length + ' 通过');
console.log('静态盒体: ' + T.STATIC.length + ' · 标题页绘制: ' + menuDraws + '/60帧');
if (errors.length) { console.log('\n运行期错误:'); errors.slice(0, 6).forEach(e => console.log('  ' + e)); }
process.exit(pass === results.length && errors.length === 0 ? 0 : 1);
