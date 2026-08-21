/* ==========================================================================
 * tests/smoke_stub.js — minimal DOM/canvas stubs so the browser game code can
 * run under node. Exposes the captured animation frame queue as __raf.
 * ==========================================================================*/
'use strict';

function mkGradient() { return { addColorStop() { } }; }
function mkCtx(canvas) {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k === 'canvas') return canvas;
      if (k in t) return t[k];
      t[k] = function () {
        if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return mkGradient();
        if (k === 'measureText') return { width: 40 };
        return undefined;
      };
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

class El {
  constructor(id) {
    this.id = id;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this._text = '';
    this._html = '';
    this.className = '';
    this.offsetWidth = 180;
    this.offsetHeight = 40;
    const set = new Set();
    this.classList = {
      add: c => set.add(c),
      remove: c => set.delete(c),
      toggle: (c, on) => { if (on === undefined) on = !set.has(c); if (on) set.add(c); else set.delete(c); },
      contains: c => set.has(c)
    };
    if (id === 'view') {
      this.width = 1280; this.height = 720;
      this.getContext = () => (this._ctx || (this._ctx = mkCtx(this)));
      this.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 });
    }
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); if (v === '') this.children.length = 0; }
  get firstChild() { return this.children[0]; }
  appendChild(c) { c._parent = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c._parent = null; }
  remove() { if (this._parent) this._parent.removeChild(this); }
  addEventListener() { }
  removeEventListener() { }
}

const els = new Map();
globalThis.window = globalThis;
globalThis.document = {
  readyState: 'complete',
  getElementById(id) {
    if (!els.has(id)) els.set(id, new El(id));
    return els.get(id);
  },
  createElement(tag) { return new El(tag); },
  addEventListener() { },
  body: new El('body')
};
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => { };
globalThis.removeEventListener = () => { };
globalThis.__raf = [];
globalThis.requestAnimationFrame = fn => { globalThis.__raf.push(fn); return globalThis.__raf.length; };
if (!globalThis.performance) globalThis.performance = { now: () => Date.now() };
delete globalThis.AudioContext;

module.exports = { El, els };
