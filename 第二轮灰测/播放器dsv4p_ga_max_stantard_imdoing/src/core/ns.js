/*!
 * dsv4p max stantard imdoing — 帧级视频播放器 / Frame-precise video player
 * src/core/ns.js — 全局命名空间、事件总线与通用工具
 *
 * 设计约束（很重要）：
 *  - 全部使用「经典脚本」而非 ES module，这样 index.html 可以直接用 file:// 双击打开
 *    （ES module 在 file:// 下会被 CORS 拦截）。所有模块挂到 window.DSV4P 上。
 *  - 零第三方依赖：不加载任何 CDN / node_modules，Linux 与 Windows 复制即用。
 */
(function (global) {
  'use strict';

  var D = global.DSV4P || (global.DSV4P = {});

  D.version = '1.0.0';
  D.buildName = 'dsv4p max stantard imdoing';

  /* ------------------------------------------------------------------ *
   * 事件总线
   * ------------------------------------------------------------------ */
  function Emitter() {
    this._h = Object.create(null);
  }
  Emitter.prototype.on = function (type, fn) {
    (this._h[type] || (this._h[type] = [])).push(fn);
    return this;
  };
  Emitter.prototype.off = function (type, fn) {
    var a = this._h[type];
    if (!a) return this;
    var i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
    return this;
  };
  Emitter.prototype.once = function (type, fn) {
    var self = this;
    function w(p) { self.off(type, w); fn(p); }
    return this.on(type, w);
  };
  Emitter.prototype.emit = function (type, payload) {
    var a = this._h[type];
    if (a) {
      a = a.slice();
      for (var i = 0; i < a.length; i++) {
        try { a[i](payload); }
        catch (e) { if (global.console) console.error('[dsv4p] listener error on "' + type + '"', e); }
      }
    }
    var any = this._h['*'];
    if (any) {
      any = any.slice();
      for (var j = 0; j < any.length; j++) {
        try { any[j]({ type: type, payload: payload }); } catch (e2) { /* ignore */ }
      }
    }
    return this;
  };
  D.Emitter = Emitter;

  /* ------------------------------------------------------------------ *
   * 数学 / 字符串工具
   * ------------------------------------------------------------------ */
  var U = D.util = {};

  U.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.nearlyEqual = function (a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-6 : eps); };

  /** 保留 n 位小数（返回数字，避免浮点尾巴） */
  U.round = function (v, n) {
    var f = Math.pow(10, n || 0);
    return Math.round(v * f) / f;
  };

  U.pad = function (v, n, ch) {
    var s = String(v);
    ch = ch || '0';
    while (s.length < n) s = ch + s;
    return s;
  };

  U.bytes = function (n) {
    if (n == null || !isFinite(n)) return '—';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(n < 10 ? 2 : 1)) + ' ' + u[i];
  };

  /** 中位数（不修改入参） */
  U.median = function (arr) {
    if (!arr || !arr.length) return NaN;
    var a = Array.prototype.slice.call(arr).sort(function (x, y) { return x - y; });
    var m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };

  U.hexToRgb = function (hex) {
    var s = String(hex || '').trim().replace(/^#/, '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return [0, 0, 0];
    var n = parseInt(s, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  U.rgbToHex = function (rgb) {
    function c(x) {
      var v = Math.round(U.clamp(x, 0, 1) * 255).toString(16);
      return v.length < 2 ? '0' + v : v;
    }
    return '#' + c(rgb[0]) + c(rgb[1]) + c(rgb[2]);
  };

  /** 二分查找：返回最后一个 <= x 的下标（arr 升序），全部大于 x 时返回 -1 */
  U.lowerIndex = function (arr, x, len) {
    var lo = 0, hi = (len == null ? arr.length : len) - 1, ans = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (arr[mid] <= x) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return ans;
  };

  U.debounce = function (fn, ms) {
    var t = 0;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms || 80);
    };
  };

  U.throttle = function (fn, ms) {
    var last = 0, timer = 0, pending = null;
    return function () {
      var now = Date.now(), self = this, a = arguments;
      pending = function () { last = Date.now(); fn.apply(self, a); };
      if (now - last >= (ms || 60)) { clearTimeout(timer); timer = 0; pending(); }
      else if (!timer) {
        timer = setTimeout(function () { timer = 0; if (pending) pending(); }, (ms || 60) - (now - last));
      }
    };
  };

  /* ------------------------------------------------------------------ *
   * DOM 工具（极简，够用即可）
   * ------------------------------------------------------------------ */

  /**
   * h('div.cls#id', {attrs}, [children])  —— 迷你 hyperscript
   * 属性支持：text / html / class / style(对象) / dataset(对象) / on* 事件 / 其余走 setAttribute
   */
  U.h = function (sel, attrs, children) {
    var m = /^([a-zA-Z0-9\-]+)?((?:[.#][^.#]+)*)$/.exec(sel || 'div');
    var tag = (m && m[1]) || 'div';
    var el = document.createElement(tag);
    if (m && m[2]) {
      var parts = m[2].split(/(?=[.#])/);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p[0] === '#') el.id = p.slice(1);
        else if (p[0] === '.') el.classList.add(p.slice(1));
      }
    }
    if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) {
      children = attrs; attrs = null;
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'class' || k === 'className') el.className = String(v);
        else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (s) { el.style[s] = v[s]; });
        else if (k === 'dataset' && typeof v === 'object') Object.keys(v).forEach(function (s) { el.dataset[s] = v[s]; });
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value') el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    U.append(el, children);
    return el;
  };

  U.append = function (el, children) {
    if (children == null) return el;
    if (!Array.isArray(children)) children = [children];
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      if (c == null || c === false) continue;
      el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  };

  U.clear = function (el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; };
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------------------ *
   * 下载 / 存储
   * ------------------------------------------------------------------ */
  U.download = function (blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = U.h('a', { href: url, download: filename || 'download.bin' });
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 4000);
  };

  U.store = {
    get: function (k, dflt) {
      try {
        var s = global.localStorage.getItem('dsv4p:' + k);
        return s == null ? dflt : JSON.parse(s);
      } catch (e) { return dflt; }
    },
    set: function (k, v) {
      try { global.localStorage.setItem('dsv4p:' + k, JSON.stringify(v)); return true; }
      catch (e) { return false; }
    },
    del: function (k) {
      try { global.localStorage.removeItem('dsv4p:' + k); } catch (e) { /* ignore */ }
    }
  };

  /* ------------------------------------------------------------------ *
   * 环境能力探测
   * ------------------------------------------------------------------ */
  D.caps = {
    rvfc: typeof HTMLVideoElement !== 'undefined' &&
      !!(HTMLVideoElement.prototype && HTMLVideoElement.prototype.requestVideoFrameCallback),
    recorder: typeof global.MediaRecorder !== 'undefined',
    captureStream: typeof HTMLCanvasElement !== 'undefined' &&
      !!(HTMLCanvasElement.prototype && HTMLCanvasElement.prototype.captureStream),
    fileProtocol: global.location ? global.location.protocol === 'file:' : false,
    webgl2: false // 由 GL 层填写
  };

  /* ------------------------------------------------------------------ *
   * 滤镜注册表
   * ------------------------------------------------------------------ */
  D.filters = [];
  D._filterMap = Object.create(null);

  /** 注册一个滤镜定义（详见 src/gl/filters/README-contract.md） */
  D.registerFilter = function (def) {
    if (!def || !def.id) throw new Error('registerFilter: 缺少 id');
    if (D._filterMap[def.id]) throw new Error('registerFilter: id 重复 -> ' + def.id);
    def.params = def.params || [];
    def.passes = def.passes || [];
    def.category = def.category || 'misc';
    def.label = def.label || def.id;
    def.order = D.filters.length;
    D._filterMap[def.id] = def;
    D.filters.push(def);
    return def;
  };

  D.getFilter = function (id) { return D._filterMap[id] || null; };

  /** 参数默认值（返回可修改副本） */
  D.filterDefaults = function (id) {
    var def = D.getFilter(id);
    if (!def) return {};
    var o = {};
    for (var i = 0; i < def.params.length; i++) {
      var p = def.params[i];
      o[p.key] = (p.type === 'color') ? String(p.def) : (p.type === 'bool' ? !!p.def : Number(p.def));
    }
    return o;
  };

  D.log = function () {
    if (!global.console) return;
    var a = Array.prototype.slice.call(arguments);
    a.unshift('%c[dsv4p]', 'color:#5cf');
    console.log.apply(console, a);
  };

})(typeof window !== 'undefined' ? window : globalThis);
