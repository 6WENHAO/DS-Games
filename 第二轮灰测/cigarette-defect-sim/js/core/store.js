/**
 * store.js —— 全局可观测状态 + 参数总线
 * 所有视图（三维平台 / 电气原理 / 工作流程 / 算法 / HMI / 追溯）都只读这里，
 * 修改参数一律走 setParam，保证"拆解"后各模块彼此独立、互不直接依赖。
 */
import { SIM_DEFAULTS } from '../data/thesis-data.js';

function clone(o) { return JSON.parse(JSON.stringify(o)); }

export const store = {
  params: clone(SIM_DEFAULTS),
  ui: {
    view: 'platform',
    explode: 0,
    zones: { '检测区域': true, '控制区域': true, '执行区域': true, '输送机构': true },
    labels: true,
    wireframe: false,
    selected: null,
    hmiMode: 'workstation',
    timeScale: 1,
    running: false,
    followCigarette: null,
  },
  _subs: {},

  on(evt, fn) {
    if (!this._subs[evt]) this._subs[evt] = [];
    this._subs[evt].push(fn);
    return function () {};
  },
  emit(evt, payload) {
    var list = this._subs[evt];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { console.error('[store] listener error on ' + evt, e); }
    }
  },
  setParam(key, value) {
    if (this.params[key] === value) return;
    this.params[key] = value;
    this.emit('param', { key: key, value: value });
  },
  setUI(key, value) {
    this.ui[key] = value;
    this.emit('ui', { key: key, value: value });
  },
  reset() {
    this.params = clone(SIM_DEFAULTS);
    this.emit('param', { key: '*', value: null });
  },
};

/* ---------- 通用格式化 ---------- */
export function fmt(n, d) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  var k = d === undefined ? 2 : d;
  return Number(n).toFixed(k);
}
export function pct(n, d) { return fmt(n * 100, d === undefined ? 1 : d) + '%'; }
export function int(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}
export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function hhmmss(ms) {
  var s = Math.floor(ms / 1000);
  var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  function p(x) { return (x < 10 ? '0' : '') + x; }
  return p(h) + ':' + p(m) + ':' + p(ss);
}
export function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
export function qs(sel, root) { return (root || document).querySelector(sel); }
export function qsa(sel, root) {
  var out = [];
  var list = (root || document).querySelectorAll(sel);
  for (var i = 0; i < list.length; i++) out.push(list[i]);
  return out;
}

/* 确定性伪随机（可复现实验） */
export function makeRng(seed) {
  var s = seed >>> 0 || 88675123;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}
