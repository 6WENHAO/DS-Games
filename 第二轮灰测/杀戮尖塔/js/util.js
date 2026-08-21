/* ============================================================
   util.js —— 基础工具：DOM、随机数、动画、提示条
   ============================================================ */
'use strict';

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- 随机数（mulberry32 可复现） ---------- */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let RNG = makeRng((Math.random() * 1e9) | 0);
function rnd() { return RNG(); }
function ri(min, max) { return min + Math.floor(RNG() * (max - min + 1)); }   // 含两端
function pick(arr) { return arr[Math.floor(RNG() * arr.length)]; }
function chance(p) { return RNG() < p; }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(RNG() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
/* 从数组中随机取 n 个不重复元素 */
function sample(arr, n) {
  const c = arr.slice();
  shuffle(c);
  return c.slice(0, n);
}
/* 权重表：[[item,w],...] */
function weighted(table) {
  let total = 0;
  for (const t of table) total += t[1];
  let r = RNG() * total;
  for (const t of table) { r -= t[1]; if (r <= 0) return t[0]; }
  return table[table.length - 1][0];
}

let _uid = 1;
function uid() { return _uid++; }

/* ---------- 提示条 ---------- */
const TIP = {
  node: null,
  init() { this.node = $('#tooltip'); },
  show(html, x, y, opts) {
    opts = opts || {};
    const t = this.node;
    t.innerHTML = html;
    t.classList.add('on');
    const w = t.offsetWidth, h = t.offsetHeight;
    let nx = x, ny = y;
    if (opts.anchor === 'right') nx = x - w - 10;
    if (opts.anchor === 'above') ny = y - h - 12;
    nx = clamp(nx, 8, 1600 - w - 8);
    ny = clamp(ny, 8, 900 - h - 8);
    t.style.left = nx + 'px';
    t.style.top = ny + 'px';
  },
  hide() { if (this.node) this.node.classList.remove('on'); }
};

/* 把某元素注册为「悬停显示提示」（可重复调用，自动替换旧处理器） */
function bindTip(node, htmlFn, opts) {
  if (node.__tipEnter) {
    node.removeEventListener('mouseenter', node.__tipEnter);
    node.removeEventListener('mouseleave', node.__tipLeave);
  }
  node.__tipEnter = () => {
    const r = stageRect(node);
    const o = Object.assign({}, opts);
    let x = r.x + r.w / 2 - 140, y = r.y + r.h + 10;
    if (o.anchor === 'above') { y = r.y - 6; }
    if (o.anchor === 'left') { x = r.x - 300; y = r.y; o.anchor = null; }
    if (o.anchor === 'rightside') { x = r.x + r.w + 12; y = r.y; o.anchor = null; }
    TIP.show(typeof htmlFn === 'function' ? htmlFn() : htmlFn, x, y, o);
  };
  node.__tipLeave = () => TIP.hide();
  node.addEventListener('mouseenter', node.__tipEnter);
  node.addEventListener('mouseleave', node.__tipLeave);
}

/* 元素在 1600x900 舞台坐标系中的位置 */
function stageRect(node) {
  const st = $('#stage');
  const s = window.__stageScale || 1;
  const a = node.getBoundingClientRect(), b = st.getBoundingClientRect();
  return { x: (a.left - b.left) / s, y: (a.top - b.top) / s, w: a.width / s, h: a.height / s };
}
function stagePoint(clientX, clientY) {
  const st = $('#stage');
  const s = window.__stageScale || 1;
  const b = st.getBoundingClientRect();
  return { x: (clientX - b.left) / s, y: (clientY - b.top) / s };
}

/* ---------- toast ---------- */
function toast(msg) {
  const layer = $('#toast-layer');
  const t = el('div', 'toast', msg);
  layer.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ---------- 浮动数字 / 特效 ---------- */
function floatNum(x, y, text, kind) {
  const n = el('div', 'float-num ' + (kind || 'dmg'), text);
  n.style.left = x + 'px';
  n.style.top = y + 'px';
  $('#fx-layer').appendChild(n);
  setTimeout(() => n.remove(), 1050);
}
function slashAt(x, y, color) {
  const n = el('div', 'slash-fx');
  n.style.left = x + 'px'; n.style.top = y + 'px';
  n.innerHTML = SVG.slashFx(color || '#fff');
  $('#fx-layer').appendChild(n);
  setTimeout(() => n.remove(), 380);
}
function screenFlash() {
  const n = el('div', 'screen-flash');
  $('#fx-layer').appendChild(n);
  setTimeout(() => n.remove(), 260);
}

/* ---------- 舞台缩放 ---------- */
function fitStage() {
  const st = $('#stage');
  const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
  window.__stageScale = s;
  st.style.transform = 'scale(' + s + ')';
  st.style.left = ((window.innerWidth - 1600 * s) / 2) + 'px';
  st.style.top = ((window.innerHeight - 900 * s) / 2) + 'px';
}
window.addEventListener('resize', fitStage);

/* ---------- 文本工具 ---------- */
/* 关键词高亮：把 [xx] 变成金色，{n} 变成粗体数值 */
function fmt(text) {
  return String(text)
    .replace(/\[([^\]]+)\]/g, '<span class="kw">$1</span>')
    .replace(/\{([^}]+)\}/g, '<b>$1</b>');
}
