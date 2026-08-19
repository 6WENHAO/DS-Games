/* DEEP SPACE CRAFT · audio.js —— 程序化 WebAudio 引擎（零依赖，全部实时合成）
 * 契约：SPEC §0（classic script / 加载期零副作用）+ §6（API 形状与 SFX 名单）。
 * 总线：master → compressor → destination；下挂 sfxBus / musicBus / ambientBus。
 * 所有一次性音效：白噪/棕噪缓冲各生成一次复用 + 包络(attack≥0.002s) + onended 断开整链。
 * 音乐/事件循环：ctx.currentTime + setTimeout 预排 lookahead 调度器，禁止逐音符 setInterval。 */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});

  /* ================================================================ 运行时状态 */
  var ctx = null, master = null, comp = null, sfxBus = null, musicBus = null, ambientBus = null, revBus = null;
  var _whiteBuf = null, _brownBuf = null, _irSpace = null, _irCave = null;
  var _warned = {};    // 未知名字只警告一次
  var _lastPlay = {};  // 同名 40ms 节流
  var _listener = null; // setListener 存储，供 play(name,{pos}) 声像
  var _vols = { master: 0.9, sfx: 0.85, music: 0.55 };
  var _loops = {};     // activeLoops 表：name -> handle
  var _musics = {};    // 音乐场景表：scene -> 场景对象
  var _musicCur = null;
  var _musicWant = null; // init 前请求的音乐场景，init 后补放
  var _engine = null, _wind = null, _mining = null; // 自管连续 loop
  var _gens = [];      // lookahead 调度器中的生成器（音乐场景 / 事件循环）
  var _schedTimer = null;

  /* ================================================================ SFX 名单（SPEC §6，一个不能少） */
  var NAMES = [
    'dig_stone', 'dig_dirt', 'dig_grass', 'dig_sand', 'dig_wood', 'dig_metal', 'dig_glass', 'dig_crystal', 'dig_snow', 'dig_water',
    'break_stone', 'break_dirt', 'break_grass', 'break_sand', 'break_wood', 'break_metal', 'break_glass', 'break_crystal', 'break_snow',
    'place_stone', 'place_dirt', 'place_grass', 'place_sand', 'place_wood', 'place_metal', 'place_glass', 'place_crystal', 'place_snow',
    'step_stone', 'step_dirt', 'step_grass', 'step_sand', 'step_wood', 'step_metal', 'step_glass', 'step_crystal', 'step_snow', 'step_water',
    'jump', 'land', 'hurt', 'heal', 'splash', 'swim', 'drown',
    'item_pickup', 'item_craft', 'item_refine', 'inv_open', 'inv_close',
    'ui_hover', 'ui_click', 'ui_back', 'ui_error', 'ui_type', 'ui_tab',
    'scan_ping', 'scan_sweep', 'scan_return', 'discovery', 'upload', 'units_gain', 'milestone',
    'ship_engine', 'ship_start', 'ship_boost', 'ship_pulse', 'ship_land', 'ship_takeoff', 'ship_hatch', 'ship_alarm',
    'warp_charge', 'warp_jump', 'warp_arrive', 'atmos_burn', 'atmos_boom', 'thunder',
    'ambient_space', 'ambient_planet', 'ambient_cave', 'ambient_underwater', 'rain',
    'laser_hit', 'terrain_edit', 'portal', 'glyph'
  ];

  /* ================================================================ 材质音色参数 */
  var MAT = {
    stone:   { filter: 'bandpass', f: 1100, q: 1.2, dur: 0.16, extra: 'click' },
    dirt:    { filter: 'lowpass',  f: 900,  q: 0.8, dur: 0.14, extra: null },
    grass:   { filter: 'lowpass',  f: 700,  q: 0.7, dur: 0.12, extra: 'rustle' },
    sand:    { filter: 'highpass', f: 2500, q: 0.9, dur: 0.18, extra: 'sizzle' },
    wood:    { filter: 'bandpass', f: 520,  q: 2.0, dur: 0.15, extra: 'knock' },
    metal:   { filter: 'bandpass', f: 2200, q: 6,   dur: 0.30, extra: 'ring' },
    glass:   { filter: 'highpass', f: 3200, q: 1.5, dur: 0.22, extra: 'shards' },
    crystal: { filter: 'bandpass', f: 2600, q: 8,   dur: 0.35, extra: 'bell' },
    snow:    { filter: 'highpass', f: 1800, q: 0.8, dur: 0.10, extra: 'crunch' },
    water:   { filter: 'bandpass', f: 900,  q: 1.0, dur: 0.30, extra: 'splash' }
  };
  var _MATNAMES = { stone: 1, dirt: 1, grass: 1, sand: 1, wood: 1, metal: 1, glass: 1, crystal: 1, snow: 1, water: 1 };

  /* ================================================================ 基础工具 */
  function _warnOnce(name) {
    if (_warned[name]) return;
    _warned[name] = true;
    var c = window.console || (typeof console !== 'undefined' ? console : null);
    if (c && c.warn) c.warn('DSC.Audio: 未知音效 "' + name + '"（已忽略）');
  }
  function _jitter(p) { return 1 + (Math.random() * 2 - 1) * p; } // 微随机化 ±p
  function _randOff(buf) { return buf ? Math.random() * Math.max(0, buf.duration - 0.05) : 0; } // 噪声取样偏移
  function _clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* 安全包络：attack 至少 0.002s，指数收尾到 0.0001，杜绝硬切爆音 */
  function _env(g, t0, a, peak, d) {
    a = Math.max(a, 0.002);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + Math.max(d, 0.02));
  }

  function _osc(type, freq) {
    var o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    return o;
  }
  function _bufSrc(buf, rate) {
    var s = ctx.createBufferSource();
    s.buffer = buf; s.loop = false; s.playbackRate.value = rate || 1;
    s._off = _randOff(buf);
    return s;
  }

  /* 目标增益（含单声道声像），返回 {g, p}；p 可能为 null */
  function _dest(pan) {
    var g = ctx.createGain();
    g.gain.value = 1;
    var p = null;
    if (ctx.createStereoPanner) {
      p = ctx.createStereoPanner();
      p.pan.value = _clamp(pan || 0, -1, 1);
      g.connect(p); p.connect(sfxBus);
    } else {
      g.connect(sfxBus);
    }
    return { g: g, p: p };
  }

  /* 源结束后断开整条链，防节点泄漏 */
  function _clean(src, nodes) {
    src.onended = function () {
      for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) {} }
    };
  }
  function _lateClean(nodes, ms) {
    setTimeout(function () {
      for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) {} }
    }, ms);
  }

  /* 短促正弦（软起音 + 指数衰减 + 自清理） */
  function _tonal(t, f, vol, dur, type, out) {
    var o = _osc(type || 'sine', f);
    var g = ctx.createGain();
    _env(g, t, Math.min(0.012, dur * 0.1), vol, dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.3);
    o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) {} };
  }
  /* 高频噪声颗粒（碎屑/雨滴/无线电） */
  function _tick(t, f, vol, out) {
    var src = _bufSrc(_whiteBuf, 1.2);
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = f;
    var g = ctx.createGain();
    _env(g, t, 0.002, vol, 0.03);
    src.connect(hp); hp.connect(g); g.connect(out);
    src.start(t, src._off); src.stop(t + 0.1);
    src.onended = function () { try { src.disconnect(); hp.disconnect(); g.disconnect(); } catch (e) {} };
  }
  /* 扫频正弦 */
  function _sweepTone(t0, o, f0, f1, dur, vol, type) {
    var out = _dest(o.pan || 0);
    var osc = _osc(type || 'sine', f0);
    var g = ctx.createGain();
    _env(g, t0, Math.max(0.01, dur * 0.08), vol * (o.vol || 1), dur);
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    osc.connect(g); g.connect(out.g);
    osc.start(t0); osc.stop(t0 + dur + 0.3);
    _clean(osc, [osc, g, out.g, out.p]);
  }
  /* 方波短哔（警报） */
  function _beepTone(t, f, dur, vol, type, out) {
    var osc = _osc(type || 'square', f);
    var g = ctx.createGain();
    _env(g, t, 0.004, vol, dur);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + dur + 0.25);
    osc.onended = function () { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
  }
  /* 低频爆裂：下坠正弦 + 噪声爆 */
  function _boom(t0, o, size) {
    var out = _dest(o.pan || 0);
    var d = 0.9 * (size || 1);
    var osc = _osc('sine', 110);
    var g = ctx.createGain();
    _env(g, t0, 0.008, 0.7 * (o.vol || 1) * (size || 1), d);
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(30, t0 + d);
    osc.connect(g); g.connect(out.g);
    osc.start(t0); osc.stop(t0 + d + 0.4);
    _clean(osc, [osc, g]);
    var src = _bufSrc(_brownBuf, 0.6);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 0.7;
    var ng = ctx.createGain();
    _env(ng, t0, 0.01, 0.8 * (o.vol || 1) * (size || 1), d * 0.8);
    src.connect(lp); lp.connect(ng); ng.connect(out.g);
    src.start(t0, src._off); src.stop(t0 + d + 0.3);
    _clean(src, [src, lp, ng, out.g, out.p]);
  }

  /* ================================================================ 材质撞击（dig/break/place/step 共用） */
  function _matHit(m, t0, o, ex) {
    var vol = (o.vol || 1) * (ex.volScale || 1);
    var rate = (o.rate || 1) * (ex.rateScale || 1);
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_whiteBuf, rate);
    var flt = ctx.createBiquadFilter();
    flt.type = m.filter;
    flt.frequency.value = m.f * (ex.low ? 0.55 : 1) * _jitter(0.08);
    flt.Q.value = m.q * (ex.low ? 0.7 : 1);
    var g = ctx.createGain();
    var dur = m.dur * (ex.low ? 1.3 : 1) * (ex.intensity || 1);
    _env(g, t0, 0.003, vol * 0.85, dur);
    src.connect(flt); flt.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + dur + 0.25);
    _clean(src, [src, flt, g, d.g, d.p]);
    _matExtra(m, t0, o, ex, vol, d.g);
  }
  function _matExtra(m, t0, o, ex, vol, out) {
    var i;
    if (m.extra === 'ring') {            // 金属：谐振簇
      for (i = 0; i < 3; i++) _tonal(t0 + i * 0.015, (620 + Math.random() * 340) * (1 + i * 1.9), vol * 0.35, 0.22, 'sine', out);
    } else if (m.extra === 'bell') {     // 晶体：铃音 + 泛音
      var f2 = 1300 + Math.random() * 700;
      _tonal(t0, f2, vol * 0.4, 0.5, 'sine', out);
      _tonal(t0 + 0.02, f2 * 2.01, vol * 0.12, 0.4, 'sine', out);
    } else if (m.extra === 'shards') {   // 玻璃：多颗粒
      for (i = 0; i < 4; i++) _tick(t0 + i * 0.035 + Math.random() * 0.02, 3200 + Math.random() * 2000, vol * 0.22, out);
    } else if (m.extra === 'knock') {    // 木：低频敲击
      _tonal(t0, 150 + Math.random() * 40, vol * 0.5, 0.1, 'sine', out);
    } else if (m.extra === 'click') {    // 石：咔哒
      _tick(t0, 2600 + Math.random() * 800, vol * 0.3, out);
    } else if (m.extra === 'sizzle') {   // 沙：细砂层
      _matHitLayer(t0, o, ex, vol * 0.5, 3200);
    } else if (m.extra === 'rustle') {   // 草：柔层
      _matHitLayer(t0, o, ex, vol * 0.4, 800);
    } else if (m.extra === 'crunch') {   // 雪：脆响
      _tick(t0, 1800 + Math.random() * 600, vol * 0.25, out);
      _tick(t0 + 0.03, 2200 + Math.random() * 500, vol * 0.2, out);
    } else if (m.extra === 'splash') {   // 水：气泡
      for (i = 0; i < 3; i++) _tonal(t0 + i * 0.05, 500 + Math.random() * 400, vol * 0.3, 0.12, 'sine', out);
    }
  }
  function _matHitLayer(t0, o, ex, vol, f) {
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_whiteBuf, (o.rate || 1) * (ex.rateScale || 1));
    var flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = f; flt.Q.value = 1.2;
    var g = ctx.createGain();
    _env(g, t0, 0.004, vol, 0.1);
    src.connect(flt); flt.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 0.2);
    _clean(src, [src, flt, g, d.g, d.p]);
  }
  function _matPlace(m, t0, o) {
    var vol = (o.vol || 1) * 0.9;
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_whiteBuf, 0.8);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 450 + Math.random() * 150; lp.Q.value = 0.8;
    var g = ctx.createGain();
    _env(g, t0, 0.004, vol * 0.6, 0.1);
    src.connect(lp); lp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 0.25);
    _clean(src, [src, lp, g, d.g, d.p]);
    _tonal(t0, 110 + Math.random() * 30, vol * 0.5, 0.12, 'sine', d.g);
  }
  function _matEvent(kind, mat, t0, o) {
    var m = MAT[mat];
    if (kind === 'dig') {
      _matHit(m, t0, o, { intensity: 1, volScale: 1, rateScale: 1 });
    } else if (kind === 'break') {
      _matHit(m, t0, o, { intensity: 1.6, volScale: 1.25, rateScale: 0.95 });
      _matHit(m, t0 + 0.05 + Math.random() * 0.04, o, { intensity: 1.1, volScale: 0.8, rateScale: 1.1 }); // 碎层
    } else if (kind === 'place') {
      _matPlace(m, t0, o);
    } else { // step：更轻更闷 + 低八度
      _matHit(m, t0, o, { intensity: 0.8, volScale: 0.25, rateScale: 0.55, low: true });
    }
  }

  /* ================================================================ 一次性音效全集 */
  function _jump(t0, o) {
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_whiteBuf, 1.1);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 1.2;
    var g = ctx.createGain();
    _env(g, t0, 0.01, 0.35 * (o.vol || 1), 0.2);
    bp.frequency.setValueAtTime(500, t0);
    bp.frequency.exponentialRampToValueAtTime(1600, t0 + 0.18);
    src.connect(bp); bp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 0.3);
    _clean(src, [src, bp, g, d.g, d.p]);
    _tonal(t0, 240, 0.16 * (o.vol || 1), 0.09, 'sine', d.g);
  }
  function _land(t0, o) {
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_brownBuf, 0.7);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 1;
    var g = ctx.createGain();
    _env(g, t0, 0.004, 0.6 * (o.vol || 1), 0.18);
    src.connect(lp); lp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 0.3);
    _clean(src, [src, lp, g, d.g, d.p]);
    _tonal(t0, 95, 0.5 * (o.vol || 1), 0.14, 'sine', d.g);
  }
  function _hurt(t0, o) {
    var d = _dest(o.pan || 0);
    var osc = _osc('sawtooth', 300);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2;
    var g = ctx.createGain();
    _env(g, t0, 0.006, 0.4 * (o.vol || 1), 0.25);
    osc.frequency.setValueAtTime(300, t0);
    osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.22);
    osc.connect(lp); lp.connect(g); g.connect(d.g);
    osc.start(t0); osc.stop(t0 + 0.35);
    _clean(osc, [osc, lp, g]);
    var src = _bufSrc(_whiteBuf, 0.8);
    var nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 500;
    var ng = ctx.createGain();
    _env(ng, t0, 0.004, 0.25 * (o.vol || 1), 0.15);
    src.connect(nf); nf.connect(ng); ng.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 0.25);
    _clean(src, [src, nf, ng, d.g, d.p]);
  }
  function _heal(t0, o) {
    var d = _dest(0);
    _tonal(t0, 523.25, 0.3 * (o.vol || 1), 0.4, 'sine', d.g);
    _tonal(t0 + 0.09, 783.99, 0.22 * (o.vol || 1), 0.5, 'sine', d.g);
    _lateClean([d.g, d.p], 900);
  }
  function _splash(t0, o) {
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_whiteBuf, 0.85);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1;
    var g = ctx.createGain();
    _env(g, t0, 0.005, 0.7 * (o.vol || 1), 0.4);
    src.connect(bp); bp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 0.6);
    _clean(src, [src, bp, g, d.g, d.p]);
    for (var i = 0; i < 4; i++) _tonal(t0 + i * 0.05 + Math.random() * 0.04, 400 + Math.random() * 700, 0.18 * (o.vol || 1), 0.1, 'sine', d.g);
  }
  function _swim(t0, o) {
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_whiteBuf, 0.6);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 1.2;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.3 * (o.vol || 1), t0 + 0.15);
    g.gain.linearRampToValueAtTime(0.12 * (o.vol || 1), t0 + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
    src.connect(lp); lp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 1);
    _clean(src, [src, lp, g, d.g, d.p]);
  }
  function _drown(t0, o) {
    var d = _dest(0);
    for (var i = 0; i < 4; i++) {
      _tonal(t0 + i * 0.16, 600 - i * 110 + Math.random() * 60, 0.2 * (o.vol || 1), 0.12, 'sine', d.g);
    }
    _lateClean([d.g, d.p], 1200);
  }
  function _itemPickup(t0, o) {
    var d = _dest(0);
    var v = 0.32 * (o.vol || 1);
    _tonal(t0, 659.26, v, 0.09, 'sine', d.g);
    _tonal(t0 + 0.06, 987.77, v, 0.14, 'sine', d.g);
    _lateClean([d.g, d.p], 700);
  }
  function _itemCraft(t0, o) {
    var d = _dest(0);
    var v = 0.28 * (o.vol || 1);
    _tonal(t0, 880, v, 0.12, 'sine', d.g);
    _tonal(t0 + 0.05, 1174.66, v, 0.16, 'sine', d.g);
    _tick(t0, 2400, 0.12, d.g);
    _lateClean([d.g, d.p], 800);
  }
  function _itemRefine(t0, o) {
    var d = _dest(0);
    var osc = _osc('square', 180);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 1.5;
    var g = ctx.createGain();
    _env(g, t0, 0.01, 0.22 * (o.vol || 1), 0.2);
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.linearRampToValueAtTime(240, t0 + 0.12);
    osc.connect(lp); lp.connect(g); g.connect(d.g);
    osc.start(t0); osc.stop(t0 + 0.3);
    _clean(osc, [osc, lp, g, d.g, d.p]);
    _tick(t0 + 0.02, 1500, 0.1, d.g);
  }
  function _whoosh(t0, o, up, dur, vol) {
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_whiteBuf, 1);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = up ? 300 : 1600; bp.Q.value = 1.4;
    var g = ctx.createGain();
    var dd = dur || 0.3;
    _env(g, t0, 0.03, (vol || 0.4) * (o.vol || 1), dd);
    bp.frequency.setValueAtTime(up ? 300 : 1600, t0);
    bp.frequency.exponentialRampToValueAtTime(up ? 1800 : 300, t0 + dd);
    src.connect(bp); bp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + dd + 0.2);
    _clean(src, [src, bp, g, d.g, d.p]);
  }
  function _uiHover(t0, o) {
    var d = _dest(0);
    _tonal(t0, 1250, 0.1 * (o.vol || 1), 0.04, 'sine', d.g);
    _lateClean([d.g, d.p], 300);
  }
  function _uiClick(t0, o) {
    var d = _dest(0);
    var osc = _osc('square', 520);
    var g = ctx.createGain();
    _env(g, t0, 0.003, 0.22 * (o.vol || 1), 0.05);
    osc.connect(g); g.connect(d.g);
    osc.start(t0); osc.stop(t0 + 0.12);
    _clean(osc, [osc, g, d.g, d.p]);
    _tick(t0, 2400, 0.1, d.g);
  }
  function _uiBack(t0, o) { _sweepTone(t0, o, 700, 380, 0.12, 0.2, 'sine'); }
  function _uiError(t0, o) {
    var d = _dest(0);
    _beepTone(t0, 170, 0.12, 0.2 * (o.vol || 1), 'sawtooth', d.g);
    _beepTone(t0 + 0.14, 130, 0.18, 0.2 * (o.vol || 1), 'sawtooth', d.g);
    _lateClean([d.g, d.p], 900);
  }
  function _uiType(t0, o) {
    var d = _dest(0);
    _tonal(t0, 1500, 0.07 * (o.vol || 1), 0.025, 'sine', d.g);
    _lateClean([d.g, d.p], 250);
  }
  function _uiTab(t0, o) { _sweepTone(t0, o, 760, 980, 0.07, 0.18, 'sine'); }
  function _scanPing(t0, o) {
    var d = _dest(0);
    var v = 0.3 * (o.vol || 1);
    _tonal(t0, 1250, v, 0.5, 'sine', d.g);
    _tonal(t0 + 0.16, 1250, v * 0.5, 0.4, 'sine', d.g);
    _lateClean([d.g, d.p], 1400);
  }
  function _scanSweep(t0, o) {
    var d = _dest(0);
    var osc = _osc('sine', 600);
    var g = ctx.createGain();
    _env(g, t0, 0.01, 0.28 * (o.vol || 1), 0.7);
    osc.frequency.setValueAtTime(600, t0);
    osc.frequency.exponentialRampToValueAtTime(2600, t0 + 0.6);
    osc.connect(g); g.connect(d.g);
    osc.start(t0); osc.stop(t0 + 0.9);
    _clean(osc, [osc, g, d.g, d.p]);
    _tonal(t0 + 0.2, 1600, 0.15 * (o.vol || 1), 0.4, 'sine', d.g);
  }
  function _scanReturn(t0, o) { // 无线电静噪 + 结尾 blip
    var d = _dest(0);
    for (var i = 0; i < 8; i++) {
      _tick(t0 + i * 0.045, 1800 + Math.random() * 800, 0.16 * (o.vol || 1) * (i % 2 ? 0.5 : 1), d.g);
    }
    _tonal(t0 + 0.42, 880, 0.2 * (o.vol || 1), 0.25, 'sine', d.g);
    _lateClean([d.g, d.p], 1100);
  }
  function _discovery(t0, o) { // 上升琶音 + 尾音三和弦
    var d = _dest(0);
    var seq = [523.25, 659.26, 783.99, 1046.5];
    var v = 0.24 * (o.vol || 1);
    for (var i = 0; i < 4; i++) _tonal(t0 + i * 0.085, seq[i], v, 0.5, 'sine', d.g);
    _tonal(t0 + 0.36, 523.25, v * 0.6, 0.8, 'sine', d.g);
    _tonal(t0 + 0.36, 659.26, v * 0.6, 0.8, 'sine', d.g);
    _tonal(t0 + 0.36, 783.99, v * 0.6, 0.8, 'sine', d.g);
    _lateClean([d.g, d.p], 2200);
  }
  function _upload(t0, o) { // 数据流
    var d = _dest(0);
    for (var i = 0; i < 12; i++) _tick(t0 + i * 0.04, 1400 + Math.random() * 1200, 0.1 * (o.vol || 1), d.g);
    _tonal(t0 + 0.5, 660, 0.2 * (o.vol || 1), 0.3, 'sine', d.g);
    _lateClean([d.g, d.p], 1400);
  }
  function _unitsGain(t0, o) {
    var d = _dest(0);
    var v = 0.2 * (o.vol || 1);
    _tonal(t0, 1318.5, v, 0.18, 'sine', d.g);
    _tonal(t0 + 0.05, 1760, v * 0.8, 0.3, 'sine', d.g);
    _lateClean([d.g, d.p], 800);
  }
  function _milestone(t0, o) {
    var d = _dest(0);
    var seq = [392, 523.25, 659.26];
    var v = 0.2 * (o.vol || 1);
    for (var i = 0; i < 3; i++) _tonal(t0 + i * 0.1, seq[i], v, 0.4, 'sine', d.g);
    _tonal(t0 + 0.32, 392, v * 0.7, 1, 'sine', d.g);
    _tonal(t0 + 0.32, 493.88, v * 0.7, 1, 'sine', d.g);
    _tonal(t0 + 0.32, 587.33, v * 0.7, 1, 'sine', d.g);
    _lateClean([d.g, d.p], 2200);
  }
  function _shipEngineShot(t0, o) {
    var d = _dest(o.pan || 0);
    var osc = _osc('sawtooth', 60);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    var g = ctx.createGain();
    _env(g, t0, 0.06, 0.25 * (o.vol || 1), 0.7);
    osc.frequency.setValueAtTime(60, t0);
    osc.frequency.linearRampToValueAtTime(110, t0 + 0.5);
    osc.connect(lp); lp.connect(g); g.connect(d.g);
    osc.start(t0); osc.stop(t0 + 1);
    _clean(osc, [osc, lp, g, d.g, d.p]);
  }
  function _shipStart(t0, o) {
    var d = _dest(0);
    var src = _bufSrc(_brownBuf, 0.9);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 250; bp.Q.value = 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.6 * (o.vol || 1), t0 + 0.35);
    g.gain.linearRampToValueAtTime(0.35 * (o.vol || 1), t0 + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
    bp.frequency.setValueAtTime(250, t0);
    bp.frequency.exponentialRampToValueAtTime(1400, t0 + 1.1);
    src.connect(bp); bp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 1.8);
    _clean(src, [src, bp, g, d.g, d.p]);
    var osc = _osc('sawtooth', 55);
    var og = ctx.createGain();
    _env(og, t0 + 0.15, 0.05, 0.2 * (o.vol || 1), 0.9);
    osc.frequency.setValueAtTime(55, t0);
    osc.frequency.linearRampToValueAtTime(120, t0 + 1.1);
    osc.connect(og); og.connect(d.g);
    osc.start(t0); osc.stop(t0 + 1.6);
    _clean(osc, [osc, og]);
  }
  function _shipBoost(t0, o) {
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_brownBuf, 1);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 0.9;
    var g = ctx.createGain();
    _env(g, t0, 0.05, 0.7 * (o.vol || 1), 0.8);
    bp.frequency.setValueAtTime(300, t0);
    bp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.7);
    src.connect(bp); bp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 1.1);
    _clean(src, [src, bp, g, d.g, d.p]);
    var osc = _osc('sawtooth', 90);
    var og = ctx.createGain();
    _env(og, t0 + 0.05, 0.05, 0.3 * (o.vol || 1), 0.6);
    osc.frequency.setValueAtTime(90, t0);
    osc.frequency.exponentialRampToValueAtTime(320, t0 + 0.65);
    osc.connect(og); og.connect(d.g);
    osc.start(t0); osc.stop(t0 + 1);
    _clean(osc, [osc, og]);
  }
  function _shipPulseShot(t0, o) {
    var d = _dest(o.pan || 0);
    var osc = _osc('sine', 70);
    var g = ctx.createGain();
    _env(g, t0, 0.004, 0.4 * (o.vol || 1), 0.22);
    osc.frequency.setValueAtTime(70, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.2);
    osc.connect(g); g.connect(d.g);
    osc.start(t0); osc.stop(t0 + 0.3);
    _clean(osc, [osc, g, d.g, d.p]);
  }
  function _shipLand(t0, o) {
    var d = _dest(o.pan || 0);
    _tonal(t0, 85, 0.6 * (o.vol || 1), 0.18, 'sine', d.g);
    var src = _bufSrc(_whiteBuf, 0.7);
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
    var g = ctx.createGain();
    _env(g, t0 + 0.1, 0.02, 0.2 * (o.vol || 1), 0.35);
    src.connect(hp); hp.connect(g); g.connect(d.g);
    src.start(t0 + 0.1, src._off); src.stop(t0 + 0.7);
    _clean(src, [src, hp, g, d.g, d.p]);
  }
  function _shipTakeoff(t0, o) {
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_brownBuf, 1);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 200; bp.Q.value = 0.9;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.7 * (o.vol || 1), t0 + 0.5);
    g.gain.linearRampToValueAtTime(0.5 * (o.vol || 1), t0 + 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    bp.frequency.setValueAtTime(200, t0);
    bp.frequency.exponentialRampToValueAtTime(2200, t0 + 1.8);
    src.connect(bp); bp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 2.8);
    _clean(src, [src, bp, g, d.g, d.p]);
    var osc = _osc('sawtooth', 50);
    var og = ctx.createGain();
    _env(og, t0 + 0.2, 0.06, 0.22 * (o.vol || 1), 1.6);
    osc.frequency.setValueAtTime(50, t0);
    osc.frequency.linearRampToValueAtTime(180, t0 + 1.8);
    osc.connect(og); og.connect(d.g);
    osc.start(t0); osc.stop(t0 + 2.5);
    _clean(osc, [osc, og]);
  }
  function _shipHatch(t0, o) {
    var d = _dest(o.pan || 0);
    _tonal(t0, 130, 0.4 * (o.vol || 1), 0.06, 'square', d.g);
    _tonal(t0 + 0.14, 160, 0.3 * (o.vol || 1), 0.05, 'square', d.g);
    _lateClean([d.g, d.p], 800);
  }
  function _shipAlarmShot(t0, o) {
    var d = _dest(0);
    _beepTone(t0, 880, 0.16, 0.22 * (o.vol || 1), 'square', d.g);
    _beepTone(t0 + 0.18, 660, 0.16, 0.22 * (o.vol || 1), 'square', d.g);
    _lateClean([d.g, d.p], 1000);
  }
  function _warpCharge(t0, o) {
    var d = _dest(o.pan || 0);
    var osc = _osc('sawtooth', 180);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    var g = ctx.createGain();
    _env(g, t0, 0.1, 0.25 * (o.vol || 1), 1.2);
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(1300, t0 + 1.2);
    osc.connect(lp); lp.connect(g); g.connect(d.g);
    osc.start(t0); osc.stop(t0 + 1.6);
    _clean(osc, [osc, lp, g, d.g, d.p]);
    _sweepTone(t0, { vol: o.vol, pan: 0 }, 900, 2400, 1.1, 0.12, 'sine');
  }
  function _warpJump(t0, o) { // 充能上扫 + 爆裂 + 长尾 whoosh
    var d = _dest(o.pan || 0);
    var osc = _osc('sawtooth', 200);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 2;
    var g = ctx.createGain();
    _env(g, t0, 0.05, 0.3 * (o.vol || 1), 0.7);
    osc.frequency.setValueAtTime(200, t0);
    osc.frequency.exponentialRampToValueAtTime(1800, t0 + 0.6);
    osc.connect(bp); bp.connect(g); g.connect(d.g);
    osc.start(t0); osc.stop(t0 + 1);
    _clean(osc, [osc, bp, g]);
    _boom(t0 + 0.55, { vol: o.vol, pan: o.pan }, 0.8);
    var src = _bufSrc(_whiteBuf, 1.1);
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
    var gg = ctx.createGain();
    gg.gain.setValueAtTime(0.0001, t0 + 0.5);
    gg.gain.linearRampToValueAtTime(0.3 * (o.vol || 1), t0 + 0.9);
    gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8);
    src.connect(hp); hp.connect(gg); gg.connect(d.g);
    src.start(t0 + 0.5, src._off); src.stop(t0 + 3.1);
    _clean(src, [src, hp, gg, d.g, d.p]);
  }
  function _warpArrive(t0, o) {
    var d = _dest(o.pan || 0);
    _sweepTone(t0, o, 1400, 300, 1.2, 0.2, 'sine');
    _boom(t0 + 0.15, o, 1);
    _tonal(t0 + 0.5, 523.25, 0.2 * (o.vol || 1), 0.9, 'sine', d.g);
    _lateClean([d.g, d.p], 2400);
  }
  function _atmosBurnShot(t0, o) { // 宽带噪声 + 缓慢滤波扫动 + 隆隆低频
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_whiteBuf, 0.9);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.8;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.55 * (o.vol || 1), t0 + 0.8);
    g.gain.linearRampToValueAtTime(0.4 * (o.vol || 1), t0 + 1.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8);
    lp.frequency.setValueAtTime(500, t0);
    lp.frequency.exponentialRampToValueAtTime(2200, t0 + 1.6);
    lp.frequency.exponentialRampToValueAtTime(400, t0 + 2.6);
    src.connect(lp); lp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 3.2);
    _clean(src, [src, lp, g, d.g, d.p]);
    var rum = _osc('sine', 42);
    var rg = ctx.createGain();
    _env(rg, t0 + 0.2, 0.1, 0.4 * (o.vol || 1), 1.8);
    rum.connect(rg); rg.connect(d.g);
    rum.start(t0); rum.stop(t0 + 2.6);
    _clean(rum, [rum, rg]);
  }
  function _thunder(t0, o) {
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_brownBuf, 0.5);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200; lp.Q.value = 0.7;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.8 * (o.vol || 1), t0 + 0.12);
    g.gain.setValueAtTime(0.6 * (o.vol || 1), t0 + 0.4);
    g.gain.linearRampToValueAtTime(0.3 * (o.vol || 1), t0 + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
    src.connect(lp); lp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 3.6);
    _clean(src, [src, lp, g, d.g, d.p]);
    _tonal(t0 + 0.1, 70, 0.5 * (o.vol || 1), 1.4, 'sine', d.g);
    _tonal(t0 + 0.9, 50, 0.3 * (o.vol || 1), 1.2, 'sine', d.g);
  }
  function _ambientSpaceShot(t0, o) {
    var d = _dest(0);
    _tonal(t0, 110, 0.1 * (o.vol || 1), 1.8, 'sine', d.g);
    _tonal(t0 + 0.05, 110.8, 0.1 * (o.vol || 1), 1.8, 'sine', d.g);
    _lateClean([d.g, d.p], 2600);
  }
  function _ambientPlanetShot(t0, o) {
    var d = _dest(0);
    var src = _bufSrc(_brownBuf, 0.7);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 1;
    var g = ctx.createGain();
    _env(g, t0, 0.3, 0.3 * (o.vol || 1), 1.2);
    src.connect(bp); bp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 2);
    _clean(src, [src, bp, g, d.g, d.p]);
  }
  function _ambientCaveShot(t0, o) {
    var d = _dest(0);
    var osc = _osc('sine', 1300 + Math.random() * 300);
    var g = ctx.createGain();
    _env(g, t0, 0.003, 0.12 * (o.vol || 1), 0.14);
    osc.frequency.setTargetAtTime(osc.frequency.value * 0.55, t0 + 0.03, 0.05);
    osc.connect(g); g.connect(d.g);
    osc.start(t0); osc.stop(t0 + 0.4);
    _clean(osc, [osc, g, d.g, d.p]);
    _tonal(t0 + 1, 500 + Math.random() * 300, 0.08 * (o.vol || 1), 0.6, 'sine', d.g);
  }
  function _ambientWaterShot(t0, o) {
    var d = _dest(0);
    var src = _bufSrc(_whiteBuf, 0.5);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    var g = ctx.createGain();
    _env(g, t0, 0.2, 0.25 * (o.vol || 1), 1);
    src.connect(lp); lp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 1.4);
    _clean(src, [src, lp, g, d.g, d.p]);
  }
  function _rainShot(t0, o) {
    var d = _dest(0);
    var src = _bufSrc(_whiteBuf, 0.9);
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
    var g = ctx.createGain();
    _env(g, t0, 0.1, 0.3 * (o.vol || 1), 1.3);
    src.connect(hp); hp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 1.7);
    _clean(src, [src, hp, g, d.g, d.p]);
    for (var i = 0; i < 5; i++) _tick(t0 + 0.1 + i * 0.22, 2600 + Math.random() * 1200, 0.06 * (o.vol || 1), d.g);
  }
  function _laserHit(t0, o) {
    var d = _dest(o.pan || 0);
    var osc = _osc('square', 950 + Math.random() * 200);
    var g = ctx.createGain();
    _env(g, t0, 0.003, 0.25 * (o.vol || 1), 0.07);
    osc.connect(g); g.connect(d.g);
    osc.start(t0); osc.stop(t0 + 0.15);
    _clean(osc, [osc, g, d.g, d.p]);
    _tick(t0, 3000 + Math.random() * 1000, 0.15 * (o.vol || 1), d.g);
  }
  function _terrainEdit(t0, o) {
    var d = _dest(o.pan || 0);
    var src = _bufSrc(_whiteBuf, 1.1);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2;
    var g = ctx.createGain();
    _env(g, t0, 0.003, 0.3 * (o.vol || 1), 0.1);
    src.connect(bp); bp.connect(g); g.connect(d.g);
    src.start(t0, src._off); src.stop(t0 + 0.18);
    _clean(src, [src, bp, g, d.g, d.p]);
  }
  function _portalShot(t0, o) {
    var d = _dest(0);
    var o1 = _osc('sine', 220), o2 = _osc('sine', 233.08);
    var g1 = ctx.createGain(); _env(g1, t0, 0.3, 0.14 * (o.vol || 1), 1.6);
    var g2 = ctx.createGain(); _env(g2, t0, 0.3, 0.14 * (o.vol || 1), 1.6);
    o1.connect(g1); o2.connect(g2); g1.connect(d.g); g2.connect(d.g);
    o1.frequency.setTargetAtTime(330, t0 + 1.5, 0.8);
    o2.frequency.setTargetAtTime(349.23, t0 + 1.5, 0.8);
    o1.start(t0); o2.start(t0); o1.stop(t0 + 3); o2.stop(t0 + 3);
    o1.onended = function () { try { o1.disconnect(); g1.disconnect(); } catch (e) {} };
    o2.onended = function () { try { o2.disconnect(); g2.disconnect(); } catch (e) {} };
    _lateClean([d.g, d.p], 3400);
  }
  function _glyph(t0, o) {
    var d = _dest(0);
    var notes = [523.25, 659.26, 783.99];
    var v = 0.16 * (o.vol || 1);
    for (var i = 0; i < 3; i++) _tonal(t0 + i * 0.13, notes[i], v, 0.7, 'sine', d.g);
    _tonal(t0 + 0.26, 1046.5, v * 0.6, 0.9, 'sine', d.g);
    _lateClean([d.g, d.p], 2200);
  }

  /* 总调度：material 前缀走材质管线，其余按名分发 */
  function _buildOne(name, t0, o) {
    var p = name.split('_');
    if ((p[0] === 'dig' || p[0] === 'break' || p[0] === 'place' || p[0] === 'step') && _MATNAMES[p[1]]) {
      _matEvent(p[0], p[1], t0, o);
      return;
    }
    switch (name) {
      case 'jump': _jump(t0, o); break;
      case 'land': _land(t0, o); break;
      case 'hurt': _hurt(t0, o); break;
      case 'heal': _heal(t0, o); break;
      case 'splash': _splash(t0, o); break;
      case 'swim': _swim(t0, o); break;
      case 'drown': _drown(t0, o); break;
      case 'item_pickup': _itemPickup(t0, o); break;
      case 'item_craft': _itemCraft(t0, o); break;
      case 'item_refine': _itemRefine(t0, o); break;
      case 'inv_open': _whoosh(t0, o, true, 0.3, 0.4); break;
      case 'inv_close': _whoosh(t0, o, false, 0.25, 0.35); break;
      case 'ui_hover': _uiHover(t0, o); break;
      case 'ui_click': _uiClick(t0, o); break;
      case 'ui_back': _uiBack(t0, o); break;
      case 'ui_error': _uiError(t0, o); break;
      case 'ui_type': _uiType(t0, o); break;
      case 'ui_tab': _uiTab(t0, o); break;
      case 'scan_ping': _scanPing(t0, o); break;
      case 'scan_sweep': _scanSweep(t0, o); break;
      case 'scan_return': _scanReturn(t0, o); break;
      case 'discovery': _discovery(t0, o); break;
      case 'upload': _upload(t0, o); break;
      case 'units_gain': _unitsGain(t0, o); break;
      case 'milestone': _milestone(t0, o); break;
      case 'ship_engine': _shipEngineShot(t0, o); break;
      case 'ship_start': _shipStart(t0, o); break;
      case 'ship_boost': _shipBoost(t0, o); break;
      case 'ship_pulse': _shipPulseShot(t0, o); break;
      case 'ship_land': _shipLand(t0, o); break;
      case 'ship_takeoff': _shipTakeoff(t0, o); break;
      case 'ship_hatch': _shipHatch(t0, o); break;
      case 'ship_alarm': _shipAlarmShot(t0, o); break;
      case 'warp_charge': _warpCharge(t0, o); break;
      case 'warp_jump': _warpJump(t0, o); break;
      case 'warp_arrive': _warpArrive(t0, o); break;
      case 'atmos_burn': _atmosBurnShot(t0, o); break;
      case 'atmos_boom': _boom(t0, o, 1.4); break;
      case 'thunder': _thunder(t0, o); break;
      case 'ambient_space': _ambientSpaceShot(t0, o); break;
      case 'ambient_planet': _ambientPlanetShot(t0, o); break;
      case 'ambient_cave': _ambientCaveShot(t0, o); break;
      case 'ambient_underwater': _ambientWaterShot(t0, o); break;
      case 'rain': _rainShot(t0, o); break;
      case 'laser_hit': _laserHit(t0, o); break;
      case 'terrain_edit': _terrainEdit(t0, o); break;
      case 'portal': _portalShot(t0, o); break;
      case 'glyph': _glyph(t0, o); break;
      default: _warnOnce(name);
    }
  }

  /* ================================================================ lookahead 调度器（ctx.currentTime + setTimeout 预排） */
  function _schedStart() {
    if (!ctx || _schedTimer) return;
    _schedTimer = setTimeout(_schedTick, 100);
  }
  function _schedTick() {
    _schedTimer = null;
    if (!ctx) return;
    var now = ctx.currentTime, horizon = now + 0.5;
    for (var i = _gens.length - 1; i >= 0; i--) {
      var g = _gens[i];
      if (!g.alive) { _gens.splice(i, 1); continue; }
      try { g.fill(now, horizon); } catch (e) { g.alive = false; }
    }
    if (_gens.length) _schedTimer = setTimeout(_schedTick, 100);
  }
  function _genAdd(g) { _gens.push(g); _schedStart(); }
  /* 事件型生成器：按 intervalFn 间隔预排一次性发声 */
  function _evtGen(intervalFn, firstDelay) {
    var g = { alive: true, _next: ctx.currentTime + (firstDelay === undefined ? 0.3 : firstDelay), _rate: 1, _vol: 1 };
    g.fill = function (now, horizon) {
      while (g._next <= horizon) {
        if (g._onTick) { try { g._onTick(g._next); } catch (e) {} }
        g._next += intervalFn(g) / g._rate;
      }
    };
    _genAdd(g);
    return g;
  }

  /* ================================================================ loop()：连续循环 / 事件循环 / 兜底重放 */
  function _dummy() {
    var d = { stop: function () {}, gain: function () { return d; }, rate: function () { return d; } };
    return d;
  }
  /* 连续循环骨架：build(io) 填 srcs/nodes/rates，io.out 为总音量节点 */
  function _cont(name, build) {
    var io = { out: ctx.createGain(), srcs: [], nodes: [], rates: [] };
    io.out.gain.value = 0.0001;
    build(io);
    for (var i = 0; i < io.srcs.length; i++) io.srcs[i].start();
    var dead = false;
    var h = {
      stop: function (fade) {
        if (dead) return; dead = true;
        var t = ctx.currentTime;
        var f = fade === undefined ? 0.2 : fade;
        io.out.gain.setTargetAtTime(0.0001, t, Math.max(f, 0.04) / 3);
        var at = t + f + 0.1;
        for (var j = 0; j < io.srcs.length; j++) { try { io.srcs[j].stop(at); } catch (e) {} }
        setTimeout(function () {
          for (var k = 0; k < io.nodes.length; k++) { try { io.nodes[k].disconnect(); } catch (e) {} }
          try { io.out.disconnect(); } catch (e) {}
          if (_loops[name] === h) delete _loops[name];
        }, (f + 0.5) * 1000);
      },
      gain: function (v) { if (!dead) io.out.gain.setTargetAtTime(Math.max(v, 0.0001), ctx.currentTime, 0.05); return h; },
      rate: function (v) {
        if (dead) return h;
        var t = ctx.currentTime;
        v = Math.max(0.01, v);
        for (var r = 0; r < io.rates.length; r++) {
          var nd = io.rates[r];
          if (!nd) continue;
          /* 缓冲源用 playbackRate；振荡器没有 playbackRate，用 detune（音分）等效变调 */
          if (nd.playbackRate) nd.playbackRate.setTargetAtTime(v, t, 0.08);
          else if (nd.detune) nd.detune.setTargetAtTime(1200 * Math.log(v) / Math.LN2, t, 0.08);
          else if (nd.frequency) nd.frequency.setTargetAtTime(nd.frequency.value * v, t, 0.08);
        }
        return h;
      }
    };
    io.out.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
    return h;
  }
  function _mkEvtHandle(name, gen) {
    var dead = false;
    var h = {
      stop: function (fade) {
        if (dead) return; dead = true;
        gen.alive = false;
        if (_loops[name] === h) delete _loops[name];
      },
      gain: function (v) { gen._vol = v; return h; },
      rate: function (v) { gen._rate = v || 1; return h; }
    };
    return h;
  }

  /* ---- 循环音色构建 ---- */
  function _ioShipEngine(io) {
    io.out.connect(sfxBus);
    var o1 = _osc('sawtooth', 50), o2 = _osc('sawtooth', 50);
    o1.detune.value = -9; o2.detune.value = 11;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 1.5;
    var g = ctx.createGain(); g.gain.value = 0.5;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(io.out);
    var hum = _osc('sine', 34); var hg = ctx.createGain(); hg.gain.value = 0.5;
    hum.connect(hg); hg.connect(io.out);
    io.srcs.push(o1, o2, hum); io.rates.push(o1, o2);
    io.nodes.push(o1, o2, hum, lp, g, hg);
  }
  function _ioAmbientSpace(io) {
    io.out.connect(ambientBus);
    var o1 = _osc('sine', 55), o2 = _osc('sine', 55.7), o3 = _osc('sine', 110.3);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 1;
    var g = ctx.createGain(); g.gain.value = 0.5;
    o1.connect(lp); o2.connect(lp); o3.connect(lp); lp.connect(g); g.connect(io.out);
    var lfo = _osc('sine', 0.055); var lg = ctx.createGain(); lg.gain.value = 0.14;
    lfo.connect(lg); lg.connect(g.gain);
    var ns = _bufSrc(_brownBuf, 0.5); ns.loop = true;
    var nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 130;
    var ng = ctx.createGain(); ng.gain.value = 0.3;
    ns.connect(nf); nf.connect(ng); ng.connect(io.out);
    io.srcs.push(o1, o2, o3, lfo, ns); io.rates.push(ns);
    io.nodes.push(o1, o2, o3, lfo, lg, lp, g, ns, nf, ng);
  }
  function _ioAmbientPlanet(io) {
    io.out.connect(ambientBus);
    var ns = _bufSrc(_brownBuf, 0.6); ns.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 1.1;
    var g = ctx.createGain(); g.gain.value = 0.6;
    ns.connect(bp); bp.connect(g); g.connect(io.out);
    var lfo = _osc('sine', 0.11); var lg = ctx.createGain(); lg.gain.value = 0.2;
    lfo.connect(lg); lg.connect(g.gain);
    io.srcs.push(ns, lfo); io.rates.push(ns);
    io.nodes.push(ns, bp, g, lfo, lg);
  }
  function _ioAtmosBurn(io) {
    io.out.connect(sfxBus);
    var ns = _bufSrc(_whiteBuf, 0.8); ns.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.8;
    var g = ctx.createGain(); g.gain.value = 0.55;
    ns.connect(lp); lp.connect(g); g.connect(io.out);
    var sweep = _osc('sine', 0.13); var sg = ctx.createGain(); sg.gain.value = 500;
    sweep.connect(sg); sg.connect(lp.frequency);
    var rum = _osc('sine', 40); var rg = ctx.createGain(); rg.gain.value = 0.4;
    rum.connect(rg); rg.connect(io.out);
    io.srcs.push(ns, sweep, rum); io.rates.push(ns);
    io.nodes.push(ns, lp, g, sweep, sg, rum, rg);
  }
  function _ioLaserHit(io) {
    io.out.connect(sfxBus);
    var o = _osc('sawtooth', 420);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 10;
    var g = ctx.createGain(); g.gain.value = 0.4;
    o.connect(bp); bp.connect(g); g.connect(io.out);
    var lfo = _osc('sine', 11); var lg = ctx.createGain(); lg.gain.value = 0.1;
    lfo.connect(lg); lg.connect(g.gain);
    var ns = _bufSrc(_whiteBuf, 1); ns.loop = true;
    var nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 2500;
    var ng = ctx.createGain(); ng.gain.value = 0.25;
    ns.connect(nf); nf.connect(ng); ng.connect(io.out);
    io.srcs.push(o, lfo, ns); io.rates.push(o, ns);
    io.nodes.push(o, bp, g, lfo, lg, ns, nf, ng);
  }
  function _ioPortal(io) {
    io.out.connect(ambientBus);
    var o1 = _osc('sine', 220), o2 = _osc('sine', 233), o3 = _osc('sine', 440);
    var g = ctx.createGain(); g.gain.value = 0.18;
    o1.connect(g); o2.connect(g); o3.connect(g); g.connect(io.out);
    var lfo = _osc('sine', 0.07); var lg = ctx.createGain(); lg.gain.value = 90;
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    var ns = _bufSrc(_whiteBuf, 0.4); ns.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 6;
    var ng = ctx.createGain(); ng.gain.value = 0.15;
    ns.connect(bp); bp.connect(ng); ng.connect(io.out);
    io.srcs.push(o1, o2, o3, lfo, ns);
    io.nodes.push(o1, o2, o3, g, lfo, lg, ns, bp, ng);
  }
  function _ioRain(io) {
    io.out.connect(ambientBus);
    var ns = _bufSrc(_whiteBuf, 0.9); ns.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 480;
    var g = ctx.createGain(); g.gain.value = 0.5;
    ns.connect(hp); hp.connect(g); g.connect(io.out);
    var lfo = _osc('sine', 0.27); var lg = ctx.createGain(); lg.gain.value = 0.13;
    lfo.connect(lg); lg.connect(g.gain);
    io.srcs.push(ns, lfo); io.rates.push(ns);
    io.nodes.push(ns, hp, g, lfo, lg);
  }
  function _rainTick(t, g) {
    var src = _bufSrc(_whiteBuf, 1.3 + Math.random() * 0.4);
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600 + Math.random() * 1200;
    var gg = ctx.createGain();
    _env(gg, t, 0.002, 0.045 * g._vol, 0.03);
    src.connect(hp); hp.connect(gg); gg.connect(ambientBus);
    src.start(t, src._off); src.stop(t + 0.09);
    src.onended = function () { try { src.disconnect(); hp.disconnect(); gg.disconnect(); } catch (e) {} };
  }
  function _alarmBeep(t, g, f) {
    var osc = _osc('square', f);
    var gg = ctx.createGain();
    _env(gg, t, 0.004, 0.16 * g._vol, 0.12);
    osc.connect(gg); gg.connect(sfxBus);
    osc.start(t); osc.stop(t + 0.25);
    osc.onended = function () { try { osc.disconnect(); gg.disconnect(); } catch (e) {} };
  }
  function _pulseThump(t, g) {
    var osc = _osc('sine', 70);
    var gg = ctx.createGain();
    _env(gg, t, 0.004, 0.4 * g._vol, 0.22);
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    osc.connect(gg); gg.connect(sfxBus);
    osc.start(t); osc.stop(t + 0.3);
    osc.onended = function () { try { osc.disconnect(); gg.disconnect(); } catch (e) {} };
  }
  function _chargeWhine(t, g) {
    var osc = _osc('sawtooth', 160);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    var gg = ctx.createGain();
    _env(gg, t, 0.08, 0.22 * g._vol, 1.1);
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 1.2);
    osc.connect(lp); lp.connect(gg); gg.connect(sfxBus);
    osc.start(t); osc.stop(t + 1.5);
    osc.onended = function () { try { osc.disconnect(); lp.disconnect(); gg.disconnect(); } catch (e) {} };
  }
  function _caveDrip(t, g) {
    var osc = _osc('sine', 1200 + Math.random() * 400);
    var gg = ctx.createGain();
    _env(gg, t, 0.003, 0.09 * g._vol, 0.15);
    osc.frequency.setTargetAtTime(osc.frequency.value * 0.6, t + 0.02, 0.05);
    osc.connect(gg); gg.connect(ambientBus);
    osc.start(t); osc.stop(t + 0.4);
    osc.onended = function () { try { osc.disconnect(); gg.disconnect(); } catch (e) {} };
  }
  function _bubble(t, g) {
    var osc = _osc('sine', 300 + Math.random() * 200);
    var gg = ctx.createGain();
    _env(gg, t, 0.005, 0.07 * g._vol, 0.09);
    osc.frequency.setTargetAtTime(osc.frequency.value * 1.6, t + 0.03, 0.05);
    osc.connect(gg); gg.connect(ambientBus);
    osc.start(t); osc.stop(t + 0.2);
    osc.onended = function () { try { osc.disconnect(); gg.disconnect(); } catch (e) {} };
  }
  function _loopRain() {
    var h = _cont('rain', _ioRain);
    var g = _evtGen(function () { return 0.35 + Math.random() * 1.1; }, 0.6);
    g._onTick = function (t) { _rainTick(t, g); };
    var stop0 = h.stop;
    h.stop = function (fade) { g.alive = false; stop0(fade); };
    return h;
  }
  function _loopAmbientCave() {
    var h = _cont('ambient_cave', function (io) {
      io.out.connect(ambientBus);
      var ns = _bufSrc(_brownBuf, 0.5); ns.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120; lp.Q.value = 1.2;
      var g = ctx.createGain(); g.gain.value = 0.5;
      ns.connect(lp); lp.connect(g); g.connect(io.out);
      var lfo = _osc('sine', 0.05); var lg = ctx.createGain(); lg.gain.value = 0.16;
      lfo.connect(lg); lg.connect(g.gain);
      io.srcs.push(ns, lfo); io.nodes.push(ns, lp, g, lfo, lg);
    });
    var g = _evtGen(function () { return 3 + Math.random() * 5; }, 2);
    g._onTick = function (t) { _caveDrip(t, g); };
    var stop0 = h.stop;
    h.stop = function (fade) { g.alive = false; stop0(fade); };
    return h;
  }
  function _loopAmbientWater() {
    var h = _cont('ambient_underwater', function (io) {
      io.out.connect(ambientBus);
      var ns = _bufSrc(_whiteBuf, 0.5); ns.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.9;
      var g = ctx.createGain(); g.gain.value = 0.45;
      ns.connect(lp); lp.connect(g); g.connect(io.out);
      var lfo = _osc('sine', 0.08); var lg = ctx.createGain(); lg.gain.value = 0.15;
      lfo.connect(lg); lg.connect(g.gain);
      var hum = _osc('sine', 60); var hg = ctx.createGain(); hg.gain.value = 0.3;
      hum.connect(hg); hg.connect(io.out);
      io.srcs.push(ns, lfo, hum); io.nodes.push(ns, lp, g, lfo, lg, hum, hg);
    });
    var g = _evtGen(function () { return 0.8 + Math.random() * 2.2; }, 1);
    g._onTick = function (t) { _bubble(t, g); };
    var stop0 = h.stop;
    h.stop = function (fade) { g.alive = false; stop0(fade); };
    return h;
  }
  function _loopAlarm() {
    var g = _evtGen(function () { return 0.9; }, 0.3);
    g._onTick = function (t) { _alarmBeep(t, g, 880); _alarmBeep(t + 0.16, g, 660); };
    return _mkEvtHandle('ship_alarm', g);
  }
  function _loopPulse() {
    var g = _evtGen(function () { return 0.5; }, 0.2);
    g._onTick = function (t) { _pulseThump(t, g); };
    return _mkEvtHandle('ship_pulse', g);
  }
  function _loopWarpCharge() {
    var g = _evtGen(function () { return 1.4; }, 0.3);
    g._onTick = function (t) { _chargeWhine(t, g); };
    return _mkEvtHandle('warp_charge', g);
  }
  var _LOOP_BUILDERS = {
    ship_engine: function () { return _cont('ship_engine', _ioShipEngine); },
    ambient_space: function () { return _cont('ambient_space', _ioAmbientSpace); },
    ambient_planet: function () { return _cont('ambient_planet', _ioAmbientPlanet); },
    ambient_cave: function () { return _loopAmbientCave(); },
    ambient_underwater: function () { return _loopAmbientWater(); },
    rain: function () { return _loopRain(); },
    atmos_burn: function () { return _cont('atmos_burn', _ioAtmosBurn); },
    laser_hit: function () { return _cont('laser_hit', _ioLaserHit); },
    ship_alarm: function () { return _loopAlarm(); },
    ship_pulse: function () { return _loopPulse(); },
    warp_charge: function () { return _loopWarpCharge(); },
    portal: function () { return _cont('portal', _ioPortal); }
  };
  function _buildLoop(name, opts) {
    var b = _LOOP_BUILDERS[name];
    if (b) return b(opts);
    // 兜底：任何一次性音效也支持 loop —— 周期性重放
    var g = _evtGen(function () { return 0.5; });
    g._onTick = function (t) { _buildOne(name, t, { vol: 0.5, rate: 1, pan: 0 }); };
    return _mkEvtHandle(name, g);
  }

  /* ================================================================ 音乐场景（lookahead 调度） */
  var _convCache = {};
  function _conv(key) {
    var c = _convCache[key];
    if (c) return c;
    c = ctx.createConvolver();
    c.buffer = key === 'cave' ? _irCave : _irSpace;
    c.normalize = true;
    c.connect(revBus);
    _convCache[key] = c;
    return c;
  }
  function _planetNote(m, t) {
    var low = Math.random() < 0.16;
    var count = 2 + ((Math.random() * 2) | 0); // 2~3 音琶音
    for (var i = 0; i < count; i++) {
      var f = m.pent[(Math.random() * m.pent.length) | 0];
      if (low) f /= 2; // 偶发低八度长音
      var o = _osc('sine', f);
      var g = ctx.createGain();
      var a = 0.06, peak = 0.13 * (0.7 + Math.random() * 0.6), d = 1.4 + Math.random() * 1.4;
      _env(g, t + i * 0.09, a, peak, d);
      o.connect(g);
      g.connect(m._dry);
      g.connect(m._send);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + a + d + 0.4);
      o.onended = (function (o2, g2) { return function () { try { o2.disconnect(); g2.disconnect(); } catch (e) {} }; })(o, g);
    }
  }
  function _musicPlanet(m) { // MC 味：五声音阶三音琶音，随机间隔 6~14s
    m._dry = ctx.createGain(); m._dry.gain.value = 0.8; m._dry.connect(musicBus);
    m.nodes.push(m._dry);
    var send = ctx.createGain(); send.gain.value = 0.5;
    send.connect(_conv('space'));
    m._send = send; m.nodes.push(send);
    m.pent = [220, 261.63, 293.66, 329.63, 392, 440];
    m._next = ctx.currentTime + 2.5;
    m.fill = function (now, horizon) {
      while (m._next <= horizon) {
        _planetNote(m, m._next);
        m._next += 6 + Math.random() * 8;
      }
    };
  }
  function _musicSpace(m) { // NMS 味：3 detune 锯齿 pad + 低通 LFO + 慢速和弦 i–VI–III–VII
    var o1 = _osc('sawtooth', 110), o2 = _osc('sawtooth', 110), o3 = _osc('sawtooth', 110);
    o1.detune.value = -7; o2.detune.value = 6; o3.detune.value = 14;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.6;
    var g = ctx.createGain(); g.gain.value = 0.14;
    o1.connect(lp); o2.connect(lp); o3.connect(lp); lp.connect(g); g.connect(m.out);
    var lfo = _osc('sine', 0.045); var lg = ctx.createGain(); lg.gain.value = 240;
    lfo.connect(lg); lg.connect(lp.frequency);
    // 极慢高频泛音闪烁
    var sh = _osc('sine', 1760); var shg = ctx.createGain(); shg.gain.value = 0.0001;
    sh.connect(shg); shg.connect(m.out);
    var slfo = _osc('sine', 0.07); var slg = ctx.createGain(); slg.gain.value = 0.018;
    slfo.connect(slg); slg.connect(shg.gain);
    o1.start(); o2.start(); o3.start(); lfo.start(); sh.start(); slfo.start();
    m.srcs = [o1, o2, o3, lfo, sh, slfo];
    m.nodes = m.nodes.concat([o1, o2, o3, lp, g, lfo, lg, sh, shg, slfo, slg]);
    var prog = [
      [110, 130.81, 164.81], // i  Am
      [87.31, 130.81, 174.61], // VI F
      [130.81, 164.81, 196],   // III C
      [98, 146.83, 196]        // VII G
    ];
    var idx = 0;
    m._next = ctx.currentTime + 1;
    m.fill = function (now, horizon) {
      while (m._next <= horizon) {
        var ch = prog[idx % 4]; idx++;
        var tt = m._next;
        o1.frequency.setTargetAtTime(ch[0], tt, 2.4);
        o2.frequency.setTargetAtTime(ch[1], tt, 2.4);
        o3.frequency.setTargetAtTime(ch[2], tt, 2.4);
        shg.gain.setTargetAtTime(0.02, tt, 1.4);
        shg.gain.setTargetAtTime(0.0001, tt + 3.5, 2.2);
        m._next += 14 + Math.random() * 6;
      }
    };
  }
  function _drip(m, t, metal) {
    if (metal) { // 远处金属回响
      var o = _osc('sine', 600 + Math.random() * 500);
      var g = ctx.createGain();
      _env(g, t, 0.005, 0.1, 0.55);
      o.connect(g); g.connect(m.out); g.connect(m._send);
      o.start(t); o.stop(t + 1);
      o.onended = (function (o2, g2) { return function () { try { o2.disconnect(); g2.disconnect(); } catch (e) {} }; })(o, g);
    } else { // 水滴下滑
      var o2 = _osc('sine', 1300 + Math.random() * 350);
      var g2 = ctx.createGain();
      _env(g2, t, 0.003, 0.14, 0.16);
      o2.frequency.setTargetAtTime(o2.frequency.value * 0.55, t + 0.03, 0.05);
      o2.connect(g2); g2.connect(m.out);
      o2.start(t); o2.stop(t + 0.45);
      o2.onended = (function (o3, g3) { return function () { try { o3.disconnect(); g3.disconnect(); } catch (e) {} }; })(o2, g2);
    }
  }
  function _musicCave(m) { // 低频轰鸣 + 稀疏水滴 + 远处金属回响
    var ns = _bufSrc(_brownBuf, 0.5); ns.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 90; lp.Q.value = 1;
    var g = ctx.createGain(); g.gain.value = 0.45;
    ns.connect(lp); lp.connect(g); g.connect(m.out);
    var lfo = _osc('sine', 0.06); var lg = ctx.createGain(); lg.gain.value = 0.15;
    lfo.connect(lg); lg.connect(g.gain);
    var send = ctx.createGain(); send.gain.value = 0.6;
    send.connect(_conv('cave'));
    m._send = send;
    ns.start(); lfo.start();
    m.srcs = [ns, lfo];
    m.nodes = m.nodes.concat([ns, lp, g, lfo, lg, send]);
    m._next = ctx.currentTime + 1.2;
    m.fill = function (now, horizon) {
      while (m._next <= horizon) {
        _drip(m, m._next, Math.random() >= 0.45);
        m._next += 2.5 + Math.random() * 5;
      }
    };
  }
  function _warpPulse(m, t) {
    var o = _osc('square', 640 + Math.random() * 90);
    var g = ctx.createGain();
    _env(g, t, 0.004, 0.07, 0.045);
    o.connect(g); g.connect(m.out);
    o.start(t); o.stop(t + 0.14);
    o.onended = (function (o2, g2) { return function () { try { o2.disconnect(); g2.disconnect(); } catch (e) {} }; })(o, g);
  }
  function _musicWarp(m) { // 节奏化 16 分脉冲 + 上升扫频
    m._next = ctx.currentTime + 0.05;
    m.fill = function (now, horizon) {
      while (m._next <= horizon) {
        _warpPulse(m, m._next);
        m._next += 0.11;
      }
    };
    var o = _osc('sawtooth', 60);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    var g = ctx.createGain(); g.gain.value = 0.12;
    o.connect(lp); lp.connect(g); g.connect(m.out);
    var sweep = _osc('sine', 0.09); var sg = ctx.createGain(); sg.gain.value = 900;
    sweep.connect(sg); sg.connect(o.frequency);
    o.start(); sweep.start();
    m.srcs = [o, sweep];
    m.nodes = m.nodes.concat([o, lp, g, sweep, sg]);
  }
  function _musicTitle(m) { // pad + 稀疏琶音混合
    var o1 = _osc('sawtooth', 110), o2 = _osc('sawtooth', 110.8);
    o1.detune.value = -6; o2.detune.value = 8;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    var g = ctx.createGain(); g.gain.value = 0.09;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(m.out);
    var lfo = _osc('sine', 0.05); var lg = ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(lp.frequency);
    o1.start(); o2.start(); lfo.start();
    m.srcs = [o1, o2, lfo];
    m.nodes = m.nodes.concat([o1, o2, lp, g, lfo, lg]);
    m._dry = ctx.createGain(); m._dry.gain.value = 0.8; m._dry.connect(musicBus);
    m.nodes.push(m._dry);
    var send = ctx.createGain(); send.gain.value = 0.45;
    send.connect(_conv('space'));
    m._send = send; m.nodes.push(send);
    m.pent = [220, 261.63, 293.66, 329.63, 392];
    m._next = ctx.currentTime + 3;
    m.fill = function (now, horizon) {
      while (m._next <= horizon) {
        _planetNote(m, m._next);
        m._next += 4.5 + Math.random() * 6;
      }
    };
  }
  function _musicCreate(scene) {
    var out = ctx.createGain(); out.gain.value = 0.0001; out.connect(musicBus);
    var m = { scene: scene, out: out, nodes: [out], srcs: [], _dead: false, alive: true, _next: 0, fill: null };
    if (scene === 'planet') _musicPlanet(m);
    else if (scene === 'space') _musicSpace(m);
    else if (scene === 'cave') _musicCave(m);
    else if (scene === 'warp') _musicWarp(m);
    else if (scene === 'title') _musicTitle(m);
    else return null;
    _genAdd(m);
    return m;
  }
  function _musicKill(m) {
    if (m._dead) return;
    m._dead = true; m.alive = false;
    var t = ctx.currentTime;
    m.out.gain.setTargetAtTime(0.0001, t, 0.25);
    var srcs = m.srcs || [];
    for (var i = 0; i < srcs.length; i++) { try { srcs[i].stop(t + 0.6); } catch (e) {} }
    setTimeout(function () {
      var nodes = m.nodes || [];
      for (var j = 0; j < nodes.length; j++) { try { nodes[j].disconnect(); } catch (e) {} }
      for (var k = 0; k < srcs.length; k++) { try { srcs[k].disconnect(); } catch (e) {} }
    }, 1000);
    if (_musics[m.scene] === m) {
      delete _musics[m.scene];
      if (_musicCur === m.scene) _musicCur = null;
    }
  }

  /* ================================================================ 飞船引擎 / 风 / 采矿（自管连续 loop） */
  function _ensureEngine() {
    if (_engine) return _engine;
    var out = ctx.createGain(); out.gain.value = 0.0001; out.connect(sfxBus);
    var o1 = _osc('sawtooth', 55), o2 = _osc('sawtooth', 55);
    o1.detune.value = -9; o2.detune.value = 10;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 1.4;
    var g1 = ctx.createGain(); g1.gain.value = 0.5;
    o1.connect(lp); o2.connect(lp); lp.connect(g1); g1.connect(out);
    var hum = _osc('sine', 34); var hg = ctx.createGain(); hg.gain.value = 0.6;
    hum.connect(hg); hg.connect(out);
    var ns = _bufSrc(_brownBuf, 0.8); ns.loop = true;
    var nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 600; nf.Q.value = 0.8;
    var ng = ctx.createGain(); ng.gain.value = 0.25;
    ns.connect(nf); nf.connect(ng); ng.connect(out);
    var bo = _osc('sawtooth', 95); // boost 上扫谐振层
    var bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1200; bf.Q.value = 7;
    var bg = ctx.createGain(); bg.gain.value = 0.0001;
    bo.connect(bf); bf.connect(bg); bg.connect(out);
    o1.start(); o2.start(); hum.start(); ns.start(); bo.start();
    _engine = { out: out, lp: lp, o1: o1, o2: o2, hg: hg, ng: ng, bf: bf, bg: bg,
      srcs: [o1, o2, hum, ns, bo], nodes: [o1, o2, lp, g1, hum, hg, ns, nf, ng, bo, bf, bg],
      idleSince: null, active: true };
    return _engine;
  }
  function _engineKill(fade) {
    if (!_engine) return;
    var e = _engine; _engine = null;
    var t = ctx.currentTime;
    e.out.gain.setTargetAtTime(0.0001, t, Math.max(fade, 0.05) / 3);
    var at = t + fade + 0.1;
    for (var i = 0; i < e.srcs.length; i++) { try { e.srcs[i].stop(at); } catch (err) {} }
    setTimeout(function () {
      for (var j = 0; j < e.nodes.length; j++) { try { e.nodes[j].disconnect(); } catch (err) {} }
      try { e.out.disconnect(); } catch (err) {}
    }, (fade + 0.6) * 1000);
  }
  function _ensureWind() {
    if (_wind) return _wind;
    var out = ctx.createGain(); out.gain.value = 0.0001; out.connect(ambientBus);
    var ns = _bufSrc(_brownBuf, 0.6); ns.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 1.2;
    var g = ctx.createGain(); g.gain.value = 0.6;
    ns.connect(f); f.connect(g); g.connect(out);
    var lfo = _osc('sine', 0.13); var lg = ctx.createGain(); lg.gain.value = 0.22;
    lfo.connect(lg); lg.connect(g.gain); // 阵风 LFO
    var walk = _osc('sine', 0.045); var wg = ctx.createGain(); wg.gain.value = 0;
    walk.connect(wg); wg.connect(f.frequency); // 带通随机漫步
    ns.start(); lfo.start(); walk.start();
    _wind = { out: out, f: f, g: g, lg: lg, wg: wg, srcs: [ns, lfo, walk],
      nodes: [ns, f, g, lfo, lg, walk, wg], idleSince: null, _nextWalk: 0 };
    return _wind;
  }
  function _windKill(fade) {
    if (!_wind) return;
    var w = _wind; _wind = null;
    var t = ctx.currentTime;
    w.out.gain.setTargetAtTime(0.0001, t, Math.max(fade, 0.05) / 3);
    var at = t + fade + 0.1;
    for (var i = 0; i < w.srcs.length; i++) { try { w.srcs[i].stop(at); } catch (err) {} }
    setTimeout(function () {
      for (var j = 0; j < w.nodes.length; j++) { try { w.nodes[j].disconnect(); } catch (err) {} }
      try { w.out.disconnect(); } catch (err) {}
    }, (fade + 0.6) * 1000);
  }
  function _ensureMining() {
    if (_mining) return _mining;
    var out = ctx.createGain(); out.gain.value = 0.0001; out.connect(sfxBus);
    var o = _osc('sawtooth', 300);
    var flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 1000; flt.Q.value = 15;
    var og = ctx.createGain(); og.gain.value = 0.5;
    o.connect(flt); flt.connect(og); og.connect(out);
    var lfo = _osc('sine', 9); var lg = ctx.createGain(); lg.gain.value = 0.1;
    lfo.connect(lg); lg.connect(og.gain);
    var ns = _bufSrc(_whiteBuf, 1); ns.loop = true;
    var nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1600; nf.Q.value = 2;
    var ng = ctx.createGain(); ng.gain.value = 0.25;
    ns.connect(nf); nf.connect(ng); ng.connect(out);
    var bell = _osc('sine', 1800); var bg = ctx.createGain(); bg.gain.value = 0.0001;
    bell.connect(bg); bg.connect(out);
    o.start(); lfo.start(); ns.start(); bell.start();
    _mining = { out: out, o: o, flt: flt, og: og, nf: nf, ng: ng, bell: bell, bg: bg,
      srcs: [o, lfo, ns, bell], nodes: [o, flt, og, lfo, lg, ns, nf, ng, bell, bg], active: false };
    return _mining;
  }
  function _miningKill(fade) {
    if (!_mining) return;
    var m = _mining; _mining = null;
    var t = ctx.currentTime;
    m.out.gain.setTargetAtTime(0.0001, t, Math.max(fade, 0.04) / 3);
    var at = t + fade + 0.1;
    for (var i = 0; i < m.srcs.length; i++) { try { m.srcs[i].stop(at); } catch (err) {} }
    setTimeout(function () {
      for (var j = 0; j < m.nodes.length; j++) { try { m.nodes[j].disconnect(); } catch (err) {} }
      try { m.out.disconnect(); } catch (err) {}
    }, (fade + 0.6) * 1000);
  }
  function _applyMiningMat(m, material) {
    var t = ctx.currentTime;
    material = material || 'stone';
    if (material === 'metal') {           // 更尖
      m.flt.frequency.setTargetAtTime(2300, t, 0.05);
      m.nf.frequency.setTargetAtTime(3600, t, 0.05);
      m.ng.gain.setTargetAtTime(0.5, t, 0.05);
      m.o.frequency.setTargetAtTime(360, t, 0.05);
      m.bg.gain.setTargetAtTime(0.0001, t, 0.05);
    } else if (material === 'crystal') {  // 带铃音
      m.flt.frequency.setTargetAtTime(1500, t, 0.05);
      m.nf.frequency.setTargetAtTime(2100, t, 0.05);
      m.ng.gain.setTargetAtTime(0.3, t, 0.05);
      m.o.frequency.setTargetAtTime(310, t, 0.05);
      m.bg.gain.setTargetAtTime(0.3, t, 0.05);
    } else if (material === 'wood' || material === 'glass' || material === 'snow') {
      m.flt.frequency.setTargetAtTime(1200, t, 0.05);
      m.nf.frequency.setTargetAtTime(2400, t, 0.05);
      m.ng.gain.setTargetAtTime(0.3, t, 0.05);
      m.o.frequency.setTargetAtTime(280, t, 0.05);
      m.bg.gain.setTargetAtTime(0.0001, t, 0.05);
    } else {                              // stone/dirt/grass/sand/water 默认更闷
      m.flt.frequency.setTargetAtTime(750, t, 0.05);
      m.nf.frequency.setTargetAtTime(1400, t, 0.05);
      m.ng.gain.setTargetAtTime(0.3, t, 0.05);
      m.o.frequency.setTargetAtTime(260, t, 0.05);
      m.bg.gain.setTargetAtTime(0.0001, t, 0.05);
    }
  }

  /* ================================================================ 公共 API */
  function init() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    // 总线：master → compressor → destination
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 6;
    comp.attack.value = 0.004; comp.release.value = 0.24;
    master = ctx.createGain();
    master.gain.value = _vols.master;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = _vols.sfx; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = _vols.music; musicBus.connect(master);
    ambientBus = ctx.createGain(); ambientBus.gain.value = 0.75; ambientBus.connect(master);
    revBus = ctx.createGain(); revBus.gain.value = 0.6; revBus.connect(master);
    // 噪声缓冲：白噪 / 棕噪 各生成一次复用
    _whiteBuf = _makeNoise(1, 1);
    _brownBuf = _makeNoise(1, 2);
    // 程序化脉冲响应：太空 / 洞穴小空间混响
    _irSpace = _makeIR(1.6, 0.35, 3800);
    _irCave = _makeIR(0.9, 0.6, 1600);
    Audio.ready = true;
    _schedStart();
    if (_musicWant) { var s = _musicWant; _musicWant = null; setMusic(s); }
  }
  function _makeNoise(sec, kind) {
    var len = Math.floor(ctx.sampleRate * sec);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      if (kind === 2) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return buf;
  }
  function _makeIR(sec, decay, lpF) {
    var len = Math.floor(ctx.sampleRate * sec);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      var state = 0;
      for (var i = 0; i < len; i++) {
        var t = i / ctx.sampleRate;
        var n = Math.random() * 2 - 1;
        state += 0.06 * (n - state);
        d[i] = state * Math.exp(-decay * t) * (1 - t / sec);
      }
    }
    return buf;
  }
  function _rightOf(fwd) {
    var up = [0, 1, 0];
    var rx = fwd[1] * up[2] - fwd[2] * up[1], ry = fwd[2] * up[0] - fwd[0] * up[2], rz = fwd[0] * up[1] - fwd[1] * up[0];
    var l = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    return [rx / l, ry / l, rz / l];
  }
  function _posPan(pos) {
    var L = _listener;
    var dx = pos[0] - L.pos[0], dy = pos[1] - L.pos[1], dz = pos[2] - L.pos[2];
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 48) return null; // 超出听力范围
    var v = 1 - dist / 48; v = v * v;
    var pan = 0;
    if (dist > 0.001) {
      var R = L.right;
      pan = (dx * R[0] + dy * R[1] + dz * R[2]) / dist;
      pan = _clamp(pan, -1, 1);
    }
    return { pan: pan, vol: v };
  }
  function setListener(pos, forward) {
    _listener = { pos: pos, forward: forward, right: _rightOf(forward) };
  }

  function play(name, opts) {
    if (NAMES.indexOf(name) < 0) { _warnOnce(name); return; }
    if (!ctx) return;
    opts = opts || {};
    var vol = opts.volume === undefined ? 1 : opts.volume;
    var rate = (opts.rate === undefined ? 1 : opts.rate) * _jitter(0.08); // 音高微随机 ±8%
    var pan = opts.pan === undefined ? 0 : opts.pan;
    var delay = opts.delay === undefined ? 0 : opts.delay;
    if (opts.pos && _listener) {
      var d = _posPan(opts.pos);
      if (!d) return;
      pan = d.pan; vol *= d.vol;
    }
    var now = ctx.currentTime;
    var lt = _lastPlay[name];
    if (lt !== undefined && now - lt < 0.04) return; // 40ms 节流合并
    _lastPlay[name] = now;
    var t0 = now + Math.max(delay, 0);
    _buildOne(name, t0, { vol: vol, rate: rate, pan: pan });
  }

  function loop(name, opts) {
    if (NAMES.indexOf(name) < 0) { _warnOnce(name); return _dummy(); }
    if (!ctx) return _dummy();
    if (_loops[name]) return _loops[name];
    var h = _buildLoop(name, opts || {});
    _loops[name] = h;
    return h;
  }
  function stopLoop(name, fade) {
    if (_loops[name]) _loops[name].stop(fade === undefined ? 0.2 : fade);
  }
  function setMusic(scene) {
    if (!ctx) { _musicWant = scene; return; }
    if (scene === _musicCur) return;
    var t = ctx.currentTime;
    if (_musicCur && _musics[_musicCur]) {
      var old = _musics[_musicCur];
      old.out.gain.setTargetAtTime(0.0001, t, 0.55); // 交叉淡出 ~1.65s 到 -60dB
      setTimeout(function () { if (old && !old._dead) _musicKill(old); }, 2000);
    }
    if (scene === 'none') { _musicCur = null; return; }
    var m = _musicCreate(scene);
    if (!m) return;
    _musics[scene] = m;
    _musicCur = scene;
    m.out.gain.setValueAtTime(0.0001, t);
    m.out.gain.setTargetAtTime(1, t, 0.9); // 交叉淡入 ~2.7s
    _schedStart();
  }
  function engine(throttle01, boost01) {
    if (!ctx) return;
    throttle01 = throttle01 || 0; boost01 = boost01 || 0;
    var t = ctx.currentTime;
    if (throttle01 < 0.005 && boost01 < 0.005) {
      if (_engine) {
        if (_engine.idleSince === null) _engine.idleSince = t;
        else if (t - _engine.idleSince > 3.5) { _engineKill(0.8); return; } // 长时停机回收
        _engine.out.gain.setTargetAtTime(0.0001, t, 0.2);
        _engine.lp.frequency.setTargetAtTime(400, t, 0.3);
        _engine.bg.gain.setTargetAtTime(0.0001, t, 0.12);
      }
      return;
    }
    var e = _ensureEngine();
    e.idleSince = null;
    var cut = 400 + 2200 * throttle01; // 低通 400→2600Hz 随油门
    e.lp.frequency.setTargetAtTime(cut, t, 0.12);
    e.out.gain.setTargetAtTime(0.14 + 0.45 * throttle01, t, 0.16);
    e.o1.frequency.setTargetAtTime(55 + 22 * throttle01, t, 0.2);
    e.o2.frequency.setTargetAtTime(55 + 22 * throttle01, t, 0.2);
    e.hg.gain.setTargetAtTime(0.2 + 0.5 * throttle01, t, 0.22);
    e.ng.gain.setTargetAtTime(0.06 + 0.3 * throttle01, t, 0.18);
    if (boost01 > 0.01) {
      e.bg.gain.setTargetAtTime(0.28 * boost01, t, 0.06);
      e.bf.frequency.setTargetAtTime(800 + 2800 * boost01, t, 0.09);
    } else {
      e.bg.gain.setTargetAtTime(0.0001, t, 0.14);
    }
  }
  function wind(intensity01) {
    if (!ctx) return;
    intensity01 = intensity01 || 0;
    var t = ctx.currentTime;
    if (intensity01 < 0.005) {
      if (_wind) {
        if (_wind.idleSince === null) _wind.idleSince = t;
        else if (t - _wind.idleSince > 3) { _windKill(0.8); return; }
        _wind.out.gain.setTargetAtTime(0.0001, t, 0.3);
      }
      return;
    }
    var w = _ensureWind();
    w.idleSince = null;
    var base = 260 + 1000 * intensity01;
    w.f.frequency.setTargetAtTime(base, t, 0.35);
    w.g.gain.setTargetAtTime(0.55 * intensity01, t, 0.3);
    w.lg.gain.setTargetAtTime(0.22 * intensity01, t, 0.3);
    if (t > w._nextWalk) { // 带通中心随机漫步
      w._nextWalk = t + 0.5 + Math.random() * 1.2;
      w.wg.gain.setTargetAtTime((Math.random() * 2 - 1) * 420 * (0.5 + intensity01), t + 0.15, 0.6);
    }
  }
  function mining(on, material) {
    if (!ctx) return;
    if (on) {
      var m = _ensureMining();
      m.active = true; m._retire = false;
      _applyMiningMat(m, material);
      m.out.gain.setTargetAtTime(0.5, ctx.currentTime, 0.05);
    } else if (_mining) {
      _mining.active = false;
      _mining.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
      if (!_mining._retire) {
        _mining._retire = true;
        (function (mm) {
          setTimeout(function () { if (mm && !mm.active) _miningKill(0.05); }, 500);
        })(_mining);
      }
    }
  }
  function setVolumes(v) {
    if (v.master !== undefined) _vols.master = v.master;
    if (v.sfx !== undefined) _vols.sfx = v.sfx;
    if (v.music !== undefined) _vols.music = v.music;
    if (!ctx) return;
    var t = ctx.currentTime;
    if (master) master.gain.setTargetAtTime(_vols.master, t, 0.08);
    if (sfxBus) sfxBus.gain.setTargetAtTime(_vols.sfx, t, 0.08);
    if (musicBus) musicBus.gain.setTargetAtTime(_vols.music, t, 0.08);
  }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function beep(freq, dur, type) {
    if (!ctx) return;
    var t = ctx.currentTime;
    var o = _osc(type || 'sine', freq || 440);
    var g = ctx.createGain();
    var d = Math.max(dur || 0.08, 0.03);
    _env(g, t, 0.004, 0.3, d);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + d + 0.3);
    o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) {} };
  }
  function stopAll() {
    var keys = Object.keys(_loops);
    for (var i = 0; i < keys.length; i++) { try { _loops[keys[i]].stop(0.1); } catch (e) {} }
    _loops = {};
    _musicCur = null;
    var mk = Object.keys(_musics);
    for (var j = 0; j < mk.length; j++) { var m = _musics[mk[j]]; if (m) _musicKill(m); }
    _musics = {};
    if (_engine) _engineKill(0.3);
    if (_wind) _windKill(0.3);
    if (_mining) _miningKill(0.15);
  }

  var Audio = {
    ready: false,
    NAMES: NAMES,
    init: init,
    play: play,
    loop: loop,
    stopLoop: stopLoop,
    setMusic: setMusic,
    engine: engine,
    wind: wind,
    mining: mining,
    setVolumes: setVolumes,
    suspend: suspend,
    resume: resume,
    setListener: setListener,
    beep: beep,
    stopAll: stopAll
  };
  DSC.Audio = Audio;
})();
