/**
 * tools/smoke-dom.js — 无浏览器环境下的「启动 + 渲染路径」冒烟测试
 *
 * 本机没有浏览器，但绝大多数致命问题（元素 id 写错、方法名拼错、未定义引用、
 * uniform 组装崩掉、事件回调抛异常…）都可以在一个最小 DOM + WebGL 桩里被抓出来。
 * 做法：解析 index.html 拿到全部 id 与脚本顺序，造桩，按真实顺序加载脚本，
 * 然后驱动一遍：启动 → 套用每个预设 → 添加每个滤镜 → 逐帧渲染 → 自检 → 导出工程。
 *
 * 用法： node tools/smoke-dom.js [--verbose]
 * 退出码 0 = 通过。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const errors = [];
const warnings = [];
function fail(msg, err) {
  errors.push(msg + (err ? ('\n    ' + (err.stack || err.message || err)).split('\n').slice(0, 6).join('\n    ') : ''));
}
function log(...a) { if (VERBOSE) console.log('   ', ...a); }

/* ------------------------------------------------------------------ *
 * 从 index.html 提取 id -> tagName 与脚本顺序
 * ------------------------------------------------------------------ */
const idTags = new Map();
const tagRe = /<([a-zA-Z0-9]+)\b([^>]*?)>/g;
let m;
while ((m = tagRe.exec(html))) {
  const tag = m[1].toLowerCase();
  const attrs = m[2];
  const idm = /\bid="([^"]+)"/.exec(attrs);
  if (idm) idTags.set(idm[1], tag);
}
const scripts = [];
const scriptRe = /<script\s+src="([^"]+)"><\/script>/g;
while ((m = scriptRe.exec(html))) scripts.push(m[1]);

/* ------------------------------------------------------------------ *
 * 最小 DOM
 * ------------------------------------------------------------------ */
class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...c) { c.forEach((x) => x && this.set.add(x)); }
  remove(...c) { c.forEach((x) => this.set.delete(x)); }
  contains(c) { return this.set.has(c); }
  toggle(c, force) {
    const on = force === undefined ? !this.set.has(c) : !!force;
    if (on) this.set.add(c); else this.set.delete(c);
    return on;
  }
  get value() { return [...this.set].join(' '); }
  toString() { return this.value; }
}

class El {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.classList = new ClassList(this);
    this._text = '';
    this._html = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.nodeType = 1;
    this.listeners = {};
    this.files = null;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.readyState = 4;
    this.videoWidth = 0;
    this.videoHeight = 0;
    this.currentTime = 0;
    this.duration = NaN;
    this.paused = true;
    this.muted = false;
    this.volume = 1;
    this.playbackRate = 1;
    this.seeking = false;
    this.width = 300;
    this.height = 150;
    this.id = '';
    this.className = '';
    this.error = null;
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.children.length = 0; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  get firstChild() { return this.children[0] || null; }
  get isContentEditable() { return false; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c, ref) {
    const i = this.children.indexOf(ref);
    c.parentNode = this;
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    return c;
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = String(v);
  }
  getAttribute(k) { return this.attributes[k] === undefined ? null : this.attributes[k]; }
  hasAttribute(k) { return this.attributes[k] !== undefined; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(t, fn) { (this.listeners[t] || (this.listeners[t] = [])).push(fn); }
  removeEventListener(t, fn) {
    const a = this.listeners[t];
    if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  }
  dispatch(type, ev) {
    const a = (this.listeners[type] || []).slice();
    const event = Object.assign({
      type, target: this, preventDefault() {}, stopPropagation() {},
      clientX: 0, clientY: 0, button: 0, deltaY: 0, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
      dataTransfer: { files: [], setData() {}, getData() { return ''; } }
    }, ev || {});
    for (const fn of a) fn.call(this, event);
    return a.length;
  }
  click() { this.dispatch('click'); }
  focus() { document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = document.body; }
  select() {}
  contains(n) {
    if (n === this) return true;
    return this.children.some((c) => c.contains && c.contains(n));
  }
  closest(sel) {
    let n = this;
    const want = sel.replace(/^\./, '');
    while (n) {
      if (n.classList && n.classList.contains(want)) return n;
      n = n.parentNode;
    }
    return null;
  }
  querySelector(sel) { const r = this.querySelectorAll(sel); return r[0] || null; }
  querySelectorAll(sel) {
    const out = [];
    const want = sel.trim();
    const walk = (node) => {
      for (const c of node.children) {
        if (matches(c, want)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.id === 'timeline' ? 900 : 960, height: this.id === 'timeline' ? 96 : 540, right: 960, bottom: 540 };
  }
  getContext(kind) {
    if (kind === '2d') return make2D(this);
    return makeGL(this);
  }
  toBlob(cb) { cb(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })); }
  toDataURL() { return 'data:image/png;base64,iVBORw0KGgo='; }
  captureStream() { return { getTracks: () => [], getAudioTracks: () => [], addTrack() {} }; }
  play() { this.paused = false; this.dispatch('play'); return Promise.resolve(); }
  pause() { this.paused = true; this.dispatch('pause'); }
  load() {
    // 模拟解码器：异步给出元数据并派发 loadeddata
    setTimeout(() => {
      this.videoWidth = this.videoWidth || 128;
      this.videoHeight = this.videoHeight || 72;
      this.duration = 2;
      this.readyState = 4;
      this.dispatch('loadeddata');
    }, 0);
  }
  requestFullscreen() { return Promise.resolve(); }
}

function matches(el, sel) {
  if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
  if (sel.startsWith('[')) {
    const mm = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (!mm) return false;
    const key = mm[1];
    const dsKey = key.startsWith('data-') ? key.slice(5).replace(/-(\w)/g, (s, c) => c.toUpperCase()) : null;
    const has = el.attributes[key] !== undefined || (dsKey && el.dataset[dsKey] !== undefined);
    if (!has) return false;
    if (mm[2] === undefined) return true;
    return String(el.attributes[key] !== undefined ? el.attributes[key] : el.dataset[dsKey]) === mm[2];
  }
  return el.tagName === sel.toUpperCase();
}

/* ---------------- Canvas 2D 桩 ---------------- */
function make2D(canvas) {
  const noop = () => {};
  return {
    canvas,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, imageSmoothingEnabled: true,
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop, clip: noop, rect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop, drawImage: noop, arc: noop,
    measureText: (t) => ({ width: String(t).length * 6 }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(128) }),
    putImageData: noop
  };
}

/* ---------------- WebGL 桩 ----------------
 * 关键增强：桩会解析着色器里声明的 uniform 列表，并记录每次 uniform*() 赋值，
 * 于是可以校验一个硬性不变量：**每次绘制前，所有声明的 uniform 都必须被赋过值**。
 * 这能抓出「参数没接到 uniform 上」「公共 uniform 漏传」这类真实 bug。
 */
const glStats = { draws: 0, programs: 0, textures: 0, uploads: 0, uniformCalls: 0 };
const uniformProblems = new Map(); // key -> Set(missing names)
function makeGL(canvas) {
  const K = {
    TEXTURE_2D: 3553, RGBA: 6408, UNSIGNED_BYTE: 5121, NEAREST: 9728, LINEAR: 9729,
    CLAMP_TO_EDGE: 33071, REPEAT: 10497, TEXTURE_MIN_FILTER: 10241, TEXTURE_MAG_FILTER: 10240,
    TEXTURE_WRAP_S: 10242, TEXTURE_WRAP_T: 10243, ARRAY_BUFFER: 34962, STATIC_DRAW: 35044,
    FRAGMENT_SHADER: 35632, VERTEX_SHADER: 35633, COMPILE_STATUS: 35713, LINK_STATUS: 35714,
    ACTIVE_UNIFORMS: 35718, SAMPLER_2D: 35678, FLOAT: 5126, FLOAT_VEC2: 35664, FLOAT_VEC3: 35665,
    FRAMEBUFFER: 36160, COLOR_ATTACHMENT0: 36064, FRAMEBUFFER_COMPLETE: 36053,
    COLOR_BUFFER_BIT: 16384, TRIANGLES: 4, DEPTH_TEST: 2929, BLEND: 3042, CULL_FACE: 2884,
    UNPACK_ALIGNMENT: 3317, UNPACK_FLIP_Y_WEBGL: 37440, MAX_TEXTURE_SIZE: 3379,
    MAX_TEXTURE_IMAGE_UNITS: 34930, VENDOR: 7936, RENDERER: 7937, TEXTURE0: 33984
  };
  const noop = () => {};
  let current = null;
  let assigned = new Set();

  function parseUniforms(src) {
    const out = [];
    const re = /uniform\s+(lowp\s+|mediump\s+|highp\s+)?(\w+)\s+(\w+)\s*(\[\s*(\d+)\s*\])?\s*;/g;
    let mm;
    while ((mm = re.exec(src))) out.push({ type: mm[2], name: mm[3], array: !!mm[4] });
    return out;
  }

  const gl = Object.assign({}, K, {
    canvas,
    createShader: () => ({ __shader: true, src: '' }),
    shaderSource: (sh, src) => { sh.src = src; },
    compileShader: noop,
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: noop,
    createProgram: () => { glStats.programs++; return { __prog: true, shaders: [], uniforms: [] }; },
    attachShader: (p, sh) => { p.shaders.push(sh); },
    bindAttribLocation: noop,
    linkProgram: (p) => {
      const seen = new Set();
      p.uniforms = [];
      p.shaders.forEach((sh) => parseUniforms(sh.src || '').forEach((u) => {
        if (!seen.has(u.name)) { seen.add(u.name); p.uniforms.push(u); }
      }));
    },
    deleteProgram: noop,
    getProgramParameter: (p, k) => (k === K.LINK_STATUS ? true : p.uniforms.length),
    getProgramInfoLog: () => '',
    getActiveUniform: (p, i) => {
      const u = p.uniforms[i];
      if (!u) return null;
      const type = u.type === 'sampler2D' ? K.SAMPLER_2D
        : u.type === 'vec2' ? K.FLOAT_VEC2 : (u.type === 'vec3' ? K.FLOAT_VEC3 : K.FLOAT);
      return { name: u.name + (u.array ? '[0]' : ''), type: type, size: 1 };
    },
    getUniformLocation: (p, name) => ({ __loc: true, prog: p, name: String(name).replace(/\[0\]$/, '') }),
    createTexture: () => { glStats.textures++; return { __tex: true }; },
    bindTexture: noop, texParameteri: noop,
    texImage2D: () => { glStats.uploads++; },
    createFramebuffer: () => ({ __fbo: true }),
    bindFramebuffer: noop, framebufferTexture2D: noop,
    checkFramebufferStatus: () => K.FRAMEBUFFER_COMPLETE,
    deleteFramebuffer: noop, deleteTexture: noop,
    createBuffer: () => ({ __buf: true }), bindBuffer: noop, bufferData: noop,
    enableVertexAttribArray: noop, vertexAttribPointer: noop,
    useProgram: (p) => { current = p; assigned = new Set(); },
    activeTexture: noop,
    uniform1f: (l) => { glStats.uniformCalls++; if (l) assigned.add(l.name); },
    uniform1i: (l) => { glStats.uniformCalls++; if (l) assigned.add(l.name); },
    uniform2f: (l) => { glStats.uniformCalls++; if (l) assigned.add(l.name); },
    uniform3f: (l) => { glStats.uniformCalls++; if (l) assigned.add(l.name); },
    uniform4f: (l) => { glStats.uniformCalls++; if (l) assigned.add(l.name); },
    uniform3fv: (l) => { glStats.uniformCalls++; if (l) assigned.add(l.name); },
    drawArrays: () => {
      glStats.draws++;
      if (current) {
        const missing = current.uniforms
          .filter((u) => !assigned.has(u.name))
          .map((u) => u.name);
        if (missing.length) {
          const key = (current.uniforms.map((u) => u.name).join(',')).slice(0, 40);
          if (!uniformProblems.has(key)) uniformProblems.set(key, new Set());
          missing.forEach((n) => uniformProblems.get(key).add(n));
        }
      }
    },
    viewport: noop, clearColor: noop, clear: noop, disable: noop, enable: noop, pixelStorei: noop,
    readPixels: (x, y, w, h, f, t, buf) => { buf.fill(96); },
    getExtension: () => null,
    getParameter: (k) => {
      if (k === K.MAX_TEXTURE_SIZE) return 8192;
      if (k === K.MAX_TEXTURE_IMAGE_UNITS) return 16;
      return 'smoke-stub';
    }
  });
  return gl;
}

/* ---------------- document / window ---------------- */
const document = {
  readyState: 'complete',
  activeElement: null,
  fullscreenElement: null,
  documentElement: new El('html'),
  head: new El('head'),
  body: new El('body'),
  _byId: new Map(),
  createElement: (t) => new El(t),
  createTextNode: (t) => ({ nodeType: 3, textContent: String(t), parentNode: null, contains: () => false }),
  getElementById(id) { return this._byId.get(id) || null; },
  querySelector(sel) { return this.body.querySelector(sel); },
  querySelectorAll(sel) { return this.body.querySelectorAll(sel); },
  addEventListener(t, fn) { (this._l || (this._l = {}))[t] = ((this._l || {})[t] || []).concat(fn); },
  removeEventListener() {},
  dispatch(t, ev) {
    const a = ((this._l || {})[t] || []).slice();
    const event = Object.assign({ type: t, target: this.body, preventDefault() {}, stopPropagation() {}, key: '', shiftKey: false, ctrlKey: false, metaKey: false }, ev || {});
    a.forEach((fn) => fn(event));
    return a.length;
  },
  exitFullscreen() { return Promise.resolve(); }
};
document.body.parentNode = document.documentElement;
document.activeElement = document.body;

// 依据 index.html 建立所有 id 元素
for (const [id, tag] of idTags) {
  const el = new El(tag);
  el.id = id;
  document._byId.set(id, el);
  document.body.appendChild(el);
}
// data-* 按钮（app 用 querySelectorAll 找它们）
[['data-nudge', ['-10', '-5', '-1', '1', '5', '10']],
  ['data-fit', ['contain', 'actual', 'integer']],
  ['data-loopnudge', ['in:-1', 'in:1', 'out:-1', 'out:1']]].forEach(([attr, vals]) => {
  vals.forEach((v) => {
    const b = new El('button');
    b.setAttribute(attr, v);
    document.body.appendChild(b);
  });
});
// .tabs / .tabpanes 结构
['left', 'right'].forEach((side) => {
  const panel = new El('aside');
  const tabs = new El('div');
  tabs.classList.add('tabs');
  tabs.setAttribute('data-tabs', side);
  const panes = new El('div');
  panes.classList.add('tabpanes');
  panel.appendChild(tabs);
  panel.appendChild(panes);
  document.body.appendChild(panel);
});

const rafQueue = [];
const globalObj = globalThis;
function def_(obj, key, value) {
  // Node 里 navigator/location 是只读 getter，必须用 defineProperty 覆盖
  try { obj[key] = value; if (obj[key] === value) return; } catch (e) {}
  Object.defineProperty(obj, key, { value: value, writable: true, configurable: true });
}
globalObj.window = globalObj;
globalObj.document = document;
def_(globalObj, 'navigator', { userAgent: 'smoke', platform: 'linux' });
def_(globalObj, 'location', { protocol: 'http:', origin: 'http://smoke', href: 'http://smoke/index.html' });
globalObj.devicePixelRatio = 1;
globalObj.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
globalObj.cancelAnimationFrame = () => {};
globalObj.HTMLVideoElement = function () {};
globalObj.HTMLVideoElement.prototype = {}; // 故意不提供 rVFC：验证降级路径
globalObj.HTMLCanvasElement = function () {};
globalObj.HTMLCanvasElement.prototype = { captureStream: function () {} };
globalObj.WebGLTexture = function () {};
globalObj.MediaRecorder = function () {
  this.start = () => {}; this.stop = () => { if (this.onstop) this.onstop(); };
};
globalObj.MediaRecorder.isTypeSupported = () => true;
globalObj.URL.createObjectURL = () => 'blob:smoke/1';
globalObj.URL.revokeObjectURL = () => {};
globalObj.FileReader = function () {
  this.readAsText = () => { this.result = '{}'; if (this.onload) this.onload(); };
  this.readAsArrayBuffer = () => { this.result = new ArrayBuffer(8); if (this.onload) this.onload(); };
};
globalObj.createImageBitmap = () => Promise.resolve({ width: 64, height: 36, close() {} });
globalObj.ResizeObserver = function (cb) { this.observe = () => {}; this.disconnect = () => {}; };
globalObj.alert = () => {};
globalObj.confirm = () => true;
globalObj.prompt = () => null;
const storeMap = new Map();
globalObj.localStorage = {
  getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
  setItem: (k, v) => { storeMap.set(k, String(v)); },
  removeItem: (k) => { storeMap.delete(k); }
};
globalObj.addEventListener = (t, fn) => { (globalObj._l || (globalObj._l = {}))[t] = ((globalObj._l || {})[t] || []).concat(fn); };

function pumpRaf(n) {
  for (let i = 0; i < n; i++) {
    const batch = rafQueue.splice(0, rafQueue.length);
    batch.forEach((fn) => {
      try { fn(1000 + i * 16.7); } catch (e) { fail('rAF 回调抛异常', e); }
    });
  }
}

/* ------------------------------------------------------------------ *
 * 按 index.html 的顺序加载脚本
 * ------------------------------------------------------------------ */
console.log(`加载 ${scripts.length} 个脚本（顺序取自 index.html）…`);
for (const s of scripts) {
  const p = path.join(ROOT, s);
  if (!fs.existsSync(p)) { fail(`index.html 引用了不存在的脚本：${s}`); continue; }
  try {
    require(p);
    log('ok', s);
  } catch (e) {
    fail(`加载 ${s} 失败`, e);
  }
}

const D = globalObj.DSV4P;
if (!D) fail('DSV4P 命名空间未建立');

/* ------------------------------------------------------------------ *
 * 驱动应用
 * ------------------------------------------------------------------ */
const app = globalObj.dsv4p;
if (!app) fail('App 未启动（window.dsv4p 不存在）');

if (app) {
  console.log('应用已启动，开始驱动…');

  // 1) 造一个「已加载媒体」的状态，让渲染路径可以真正跑起来
  function setupMedia() {
    const eng = app.engine;
    eng.media = { name: 'smoke.mp4', size: 1234, width: 64, height: 36, index: null, isLocal: true };
    eng.video.videoWidth = 64;
    eng.video.videoHeight = 36;
    eng.video.readyState = 4;
    eng.clock.setCfr(30, 10, 'observed');
    eng.ready = true;
    eng.setLoop({ inFrame: 10, outFrame: 40, enabled: true, mode: 'loop' });
    eng.emit('load', { media: eng.media, clock: eng.clock.describe() });
  }
  try { setupMedia(); } catch (e) { fail('构造媒体状态失败', e); }

  // 2) 渲染若干帧
  const drawsBefore = glStats.draws;
  pumpRaf(3);
  if (glStats.draws <= drawsBefore) fail('渲染循环没有产生任何 drawArrays 调用');
  log('draws after 3 frames:', glStats.draws, 'uniformCalls:', glStats.uniformCalls);

  // 3) 每个预设都套一遍并渲染
  for (const p of D.presets) {
    try {
      app.applyPreset(p.id);
      pumpRaf(1);
      if (app.pipeline.chain.length !== p.chain.length) {
        fail(`预设 ${p.id} 载入的滤镜数不符：${app.pipeline.chain.length} != ${p.chain.length}`);
      }
      const errs = Object.keys(app.pipeline.errors);
      if (errs.length) fail(`预设 ${p.id} 有滤镜编译失败：${errs.join(',')}`);
    } catch (e) { fail(`套用预设 ${p.id} 失败`, e); }
  }
  log('presets ok:', D.presets.length);

  // 4) 每个滤镜单独添加 + 改一遍全部参数 + 渲染
  for (const def of D.filters) {
    try {
      app.pipeline.clearChain();
      const inst = app.pipeline.addFilter(def.id);
      if (!inst) { fail(`addFilter(${def.id}) 返回空`); continue; }
      for (const prm of def.params) {
        const v = prm.type === 'float' ? (prm.min + prm.max) / 2
          : prm.type === 'enum' ? prm.options[prm.options.length - 1].v
            : prm.type === 'bool' ? !prm.def : '#123456';
        app.pipeline.setParam(inst.uid, prm.key, v);
      }
      pumpRaf(1);
      // 极端值也走一遍
      for (const prm of def.params) {
        if (prm.type === 'float') app.pipeline.setParam(inst.uid, prm.key, prm.min);
      }
      pumpRaf(1);
      for (const prm of def.params) {
        if (prm.type === 'float') app.pipeline.setParam(inst.uid, prm.key, prm.max);
      }
      pumpRaf(1);
    } catch (e) { fail(`滤镜 ${def.id} 运行期出错`, e); }
  }
  log('filters ok:', D.filters.length);

  // 5) 调色板 / 字符集 / 处理倍率
  try {
    for (const pal of D.Resources.palettes) app.filtersUI.setPalette(pal.id, pal.colors);
    for (const ramp of Object.keys(D.Resources.RAMPS)) app.pipeline.setGlyphRamp(ramp);
    app.pipeline.renderScale = 0.5;
    pumpRaf(1);
    app.pipeline.renderScale = 1;
  } catch (e) { fail('资源切换失败', e); }

  // 6) 视图 / 对比模式
  try {
    for (const mode of [0, 1, 2, 3]) {
      app.pipeline.view.splitMode = mode;
      pumpRaf(1);
    }
    ['contain', 'actual', 'integer'].forEach((fit) => {
      app.pipeline.view.fit = fit;
      pumpRaf(1);
      const r = app.pipeline.rect;
      if (!(r.width > 0 && r.height > 0)) fail(`fit=${fit} 时内容矩形无效`);
    });
    app.pipeline.view.gridOverlay = 8;
    app.pipeline.view.nearest = false;
    pumpRaf(1);
    const hit = app.pipeline.canvasToVideo(app.pipeline.rect.left + 2, app.pipeline.rect.top + 2);
    if (!hit) fail('canvasToVideo 在内容矩形内返回 null');
  } catch (e) { fail('视图切换失败', e); }

  // 7) UI 交互：点一遍所有按钮（不应抛异常）
  const clickIds = ['btn-add-filter', 'btn-chain-bypass', 'btn-chain-clear', 'btn-loop-in', 'btn-loop-out',
    'btn-loop-goto-in', 'btn-loop-goto-out', 'btn-loop-clear', 'btn-marker-add', 'btn-marker-next',
    'btn-marker-prev', 'btn-marker-loop', 'btn-marker-clear', 'btn-tl-zoom-in', 'btn-tl-zoom-out',
    'btn-tl-fit', 'btn-view-reset', 'btn-seq-loop', 'btn-help', 'btn-help-close', 'btn-selftest',
    'btn-selftest-close', 'btn-cache-clear', 'btn-preset-save', 'btn-project-save', 'btn-demo'];
  for (const id of clickIds) {
    const el = document.getElementById(id);
    if (!el) { fail(`index.html 缺少按钮 #${id}（或 id 拼写不一致）`); continue; }
    try { el.dispatch('click'); } catch (e) { fail(`点击 #${id} 抛异常`, e); }
  }
  pumpRaf(1);
  setupMedia(); // btn-demo 会触发 engine.open()，这里恢复「已加载」状态

  // 8) 键盘快捷键全过一遍
  const keys = [' ', 'k', 'j', 'l', 'i', 'o', 'm', '[', ']', 'b', 'n', 'g', 'p', 's', 'f', 't', '?',
    'Escape', 'Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '0', '1', '5', '+', '-', 'c'];
  for (const k of keys) {
    try {
      document.dispatch('keydown', { key: k, target: document.body });
      document.dispatch('keydown', { key: k, shiftKey: true, target: document.body });
    } catch (e) { fail(`快捷键 "${k}" 抛异常`, e); }
  }
  pumpRaf(2);

  // 9) 时间码与定位入口
  try {
    const tc = document.getElementById('tc-input');
    tc.value = '00:00:01:05';
    tc.dispatch('keydown', { key: 'Enter' });
    const seek = document.getElementById('seek-input');
    seek.value = '#42';
    document.getElementById('btn-seek-go').dispatch('click');
    const fi = document.getElementById('frame-input');
    fi.value = '77';
    fi.dispatch('change');
  } catch (e) { fail('时间码/定位入口出错', e); }

  // 10) 自检 + 工程读写
  try {
    const rows = app.selfTest();
    const bad = rows.filter((r) => !r.ok).map((r) => r.name);
    if (bad.includes('滤镜着色器编译')) fail('自检报告着色器编译失败');
    const proj = app.projectObject();
    const round = JSON.parse(JSON.stringify(proj));
    app.loadProject(round);
    if (app.pipeline.serializeChain().length !== round.chain.length) fail('工程往返后滤镜数不一致');
  } catch (e) { fail('自检/工程往返失败', e); }

  // 11) 面板读数与时间轴绘制
  try {
    app.panels.update(true);
    app.timeline.resize();
    app.timeline.fit();
    app.timeline.draw();
    app.timeline.zoomAt(0.5, 20);
    app.timeline.draw();
    app.panels.setPixelReadout({ x: 1, y: 2, r: 3, g: 4, b: 5, hex: '#030405', luma: 0.5 });
  } catch (e) { fail('面板/时间轴绘制失败', e); }

  // 12) 导出路径（PNG）
  try {
    app.pipeline.clearChain();
    app.pipeline.addFilter('pixelate');
    const rt = app.renderToTarget({ bypass: false });
    if (!rt) fail('renderToTarget 返回空');
    else {
      const cv = app.gl.toCanvas(rt);
      if (!cv || !cv.width) fail('toCanvas 结果无效');
      app.gl.release(rt);
    }
  } catch (e) { fail('导出渲染路径失败', e); }

  // 13) 渲染目标是否回收干净（不应无限增长）
  const liveBefore = app.gl.stats.rtLive;
  pumpRaf(10);
  const liveAfter = app.gl.stats.rtLive;
  if (liveAfter > liveBefore + 4) {
    warnings.push(`渲染目标可能泄漏：rtLive ${liveBefore} -> ${liveAfter}`);
  }
}

/* ------------------------------------------------------------------ *
 * 14) 真实 open() 路径：喂真实 MP4 文件，走 Mp4Index + FrameClock + 首帧定位
 * ------------------------------------------------------------------ */
async function testRealOpen() {
  const fixture = path.join(ROOT, 'tests/fixtures/cfr30.mp4');
  if (!fs.existsSync(fixture) || !app) { warnings.push('缺少 tests/fixtures/cfr30.mp4，跳过 open() 路径测试'); return; }
  const buf = fs.readFileSync(fixture);
  const blob = new Blob([buf], { type: 'video/mp4' });
  blob.name = 'cfr30.mp4';
  const pump = setInterval(() => pumpRaf(1), 4);
  try {
    app.engine.video.videoWidth = 128;
    app.engine.video.videoHeight = 72;
    await app.engine.open({ file: blob });
    const c = app.engine.clock;
    if (c.mode !== 'index') fail(`open() 后应进入 index 模式，实际 ${c.mode}`);
    if (c.frameCount !== 60) fail(`open() 后帧数应为 60，实际 ${c.frameCount}`);
    if (Math.abs(c.fps - 30) > 1e-9) fail(`open() 后帧率应为 30，实际 ${c.fps}`);
    if (!c.keyframes || !c.keyframes.length) fail('open() 后应有关键帧列表');
    if (!app.engine.media.index) fail('media.index 未挂上');
    // 帧号 <-> 时间往返
    for (let i = 0; i < c.frameCount; i++) {
      if (c.frameAtTime(c.timeOfFrame(i)) !== i) { fail(`帧号往返失败 @${i}`); break; }
      const t = c.seekTargetForFrame(i);
      if (!(t >= c.timeOfFrame(i) && t < c.endOfFrame(i))) { fail(`seek 目标越界 @${i}`); break; }
    }
    pumpRaf(3);
    // 定位 + 步进（走 _awaitSeek 的降级路径）
    const r1 = await app.gotoFrame(17);
    if (r1.frame !== 17) warnings.push(`gotoFrame(17) 落到 ${r1.frame}（桩 video 无真实解码，属预期）`);
    await app.step(1);
    await app.engine.stepKeyframe(1);
    pumpRaf(2);
    app.panels.update(true);
    log('open() 路径 ok：', c.describe());
  } catch (e) {
    fail('open() 路径失败', e);
  } finally {
    clearInterval(pump);
  }
}

/* ------------------------------------------------------------------ *
 * 结果
 * ------------------------------------------------------------------ */
function report() {
console.log('');
console.log(`WebGL 桩统计：drawArrays ${glStats.draws} 次，program ${glStats.programs} 个，纹理 ${glStats.textures} 个，上传 ${glStats.uploads} 次，uniform 赋值 ${glStats.uniformCalls} 次`);
if (uniformProblems.size) {
  for (const [key, set] of uniformProblems) {
    fail(`有 uniform 在绘制前没有被赋值：${[...set].join(', ')}（程序 uniform 列表片段：${key}…）`);
  }
} else {
  console.log('uniform 完整性：每次绘制前，所有声明的 uniform 都已赋值 ✓');
}
if (warnings.length) {
  console.log('\n提醒：');
  warnings.forEach((w) => console.log('  · ' + w));
}
if (errors.length) {
  console.log(`\n✗ 冒烟测试失败，${errors.length} 个问题：`);
  errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  process.exit(1);
}
console.log('\n✓ 冒烟测试通过：启动、渲染、全部预设/滤镜/按钮/快捷键/导出路径均无异常');
}

testRealOpen().then(report, (e) => { fail('异步测试崩溃', e); report(); });
