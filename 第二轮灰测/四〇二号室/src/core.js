/* =============================================================================
 * アパート四〇二号室 / Apartment 402
 * core.js — 命名空间、随机数、数学工具、设置持久化、错误兜底
 * 无模块（classic script），可直接 file:// 打开
 * ===========================================================================*/
(function () {
  'use strict';

  var HZ = (window.HZ = window.HZ || {});
  HZ.VERSION = '1.0.0';

  /* ---------------------------------------------------------------- RNG ---- */
  // mulberry32：确定性、快，够用
  HZ.rng = function (seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* -------------------------------------------------------------- 数学 ---- */
  HZ.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  HZ.lerp = function (a, b, t) { return a + (b - a) * t; };
  HZ.smoothstep = function (a, b, x) {
    var t = HZ.clamp((x - a) / (b - a || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  };
  // 与帧率无关的指数平滑
  HZ.damp = function (cur, target, lambda, dt) {
    return HZ.lerp(cur, target, 1 - Math.exp(-lambda * dt));
  };
  HZ.range = function (rnd, a, b) { return a + (b - a) * rnd(); };
  HZ.irange = function (rnd, a, b) { return Math.floor(a + (b - a + 1) * rnd()); };
  HZ.pick = function (rnd, arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; };
  HZ.chance = function (rnd, p) { return rnd() < p; };
  HZ.wrapAngle = function (a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  /* ------------------------------------------------------------ URL 参数 --- */
  var qs = {};
  try {
    var raw = (location.search || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < raw.length; i++) {
      if (!raw[i]) continue;
      var kv = raw[i].split('=');
      qs[decodeURIComponent(kv[0])] = kv.length > 1 ? decodeURIComponent(kv[1]) : '1';
    }
  } catch (e) { /* noop */ }
  HZ.query = qs;
  HZ.flag = function (name, dflt) {
    if (!(name in qs)) return dflt;
    var v = qs[name];
    return !(v === '0' || v === 'false' || v === 'off');
  };

  /* --------------------------------------------------------------- 设置 --- */
  // safe=1 → 关掉所有可能有兼容性风险的效果（黑屏排障用）
  var SAFE = HZ.flag('safe', false);

  HZ.settings = {
    renderScale: SAFE ? 1.0 : 0.5,   // 内部渲染分辨率倍率（PS1 颗粒感来源）
    fov: 72,
    sensitivity: 0.0022,
    invertY: false,
    // 后处理
    bloom: SAFE ? 0.0 : 0.85,
    grain: SAFE ? 0.0 : 0.55,
    scanlines: SAFE ? 0.0 : 0.45,
    ao: SAFE ? 0.0 : 0.8,
    aberration: SAFE ? 0.0 : 0.6,
    vignette: SAFE ? 0.2 : 0.85,
    dither: SAFE ? 0.0 : 1.0,
    // PS1 材质效果
    vertexSnap: SAFE ? 0.0 : 1.0,
    affineUV: SAFE ? false : true,
    // 音量 / 其它
    volume: 0.7,
    shadows: !SAFE,
    dust: !SAFE,
    showFps: false
  };

  var LSKEY = 'hz402.settings.v1';
  HZ.loadSettings = function () {
    try {
      var s = window.localStorage.getItem(LSKEY);
      if (!s) return;
      var o = JSON.parse(s);
      for (var k in o) if (k in HZ.settings && typeof o[k] === typeof HZ.settings[k]) HZ.settings[k] = o[k];
    } catch (e) { /* file:// 下 localStorage 可能不可用 */ }
    if (SAFE) { // safe 模式强制覆盖已存档的设置
      HZ.settings.bloom = 0; HZ.settings.grain = 0; HZ.settings.scanlines = 0;
      HZ.settings.ao = 0; HZ.settings.aberration = 0; HZ.settings.dither = 0;
      HZ.settings.vertexSnap = 0; HZ.settings.affineUV = false;
      HZ.settings.renderScale = 1; HZ.settings.shadows = false;
    }
  };
  HZ.saveSettings = function () {
    try { window.localStorage.setItem(LSKEY, JSON.stringify(HZ.settings)); } catch (e) { /* noop */ }
  };

  /* --------------------------------------------------------- 错误兜底 UI --- */
  var errShown = false;
  HZ.fatal = function (title, detail) {
    try { console.error('[HZ]', title, detail); } catch (e) { /* noop */ }
    if (errShown) return;
    errShown = true;
    var el = document.getElementById('crash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'crash';
      document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.innerHTML =
      '<div class="crash-box">' +
      '<h2>■ 运行错误 / エラー</h2>' +
      '<p class="crash-title"></p>' +
      '<pre class="crash-detail"></pre>' +
      '<p class="crash-hint">排障建议：<br>' +
      '1) 在网址后加 <code>?safe=1</code> 重新打开（关闭全部后处理与着色器补丁）<br>' +
      '2) 加 <code>?raw=1</code> 绕过后处理（保留材质补丁）<br>' +
      '3) 游戏内按 <code>F3</code> 关闭顶点抖动、<code>F4</code> 关闭仿射 UV<br>' +
      '4) 确认浏览器已启用硬件加速（chrome://gpu）<br>' +
      '5) 若提示 three.js 未加载：本机断网时，请把 three.min.js 放到 <code>vendor/</code> 目录</p>' +
      '</div>';
    el.querySelector('.crash-title').textContent = String(title || '未知错误');
    el.querySelector('.crash-detail').textContent = String(detail == null ? '' : detail);
  };

  HZ.installErrorHandlers = function () {
    window.addEventListener('error', function (ev) {
      var m = ev && ev.message ? ev.message : 'error';
      if (/NotAllowedError|pointer lock|user gesture/i.test(m)) return; // 无害的指针锁拒绝
      var src = ev && ev.filename ? (ev.filename + ':' + ev.lineno) : '';
      HZ.fatal(m, src + (ev && ev.error && ev.error.stack ? '\n' + ev.error.stack : ''));
    });
    window.addEventListener('unhandledrejection', function (ev) {
      var r = ev && ev.reason;
      var msg = r && r.stack ? r.stack : String(r);
      if (/NotAllowedError|pointer lock|user gesture/i.test(msg)) return;
      HZ.fatal('Unhandled promise rejection', msg);
    });
  };

  /* ------------------------------------------------------------ 小工具 ---- */
  HZ.$ = function (sel) { return document.querySelector(sel); };
  HZ.deg = Math.PI / 180;

  // 事件总线（世界 / 玩家 / 音频之间解耦）
  HZ.bus = (function () {
    var map = {};
    return {
      on: function (name, fn) { (map[name] = map[name] || []).push(fn); return fn; },
      off: function (name, fn) {
        var l = map[name]; if (!l) return;
        var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
      },
      emit: function (name, payload) {
        var l = map[name]; if (!l) return;
        for (var i = 0; i < l.length; i++) {
          try { l[i](payload); } catch (e) { console.warn('[HZ.bus]', name, e); }
        }
      }
    };
  })();

  HZ.loadSettings();
})();
