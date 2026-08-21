/*!
 * src/gl/pipeline.js — 滤镜链执行 + 画面合成（缩放/平移/对比/像素网格）
 *
 * 每帧流程：
 *   视频帧 -> 源纹理 -> [滤镜1 pass...] -> [滤镜2 pass...] -> ... -> 合成到画布
 * 中间用两三个池化的渲染目标来回倒，峰值显存只与「单个滤镜的 pass 数」有关。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util;

  var DISPLAY_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform sampler2D uOrig;',
    'uniform vec2 uCanvas;',
    'uniform vec2 uRectOff;',
    'uniform vec2 uRectSize;',
    'uniform vec2 uVideoSize;',
    'uniform float uNearest;',
    'uniform float uSplit;',
    'uniform float uSplitMode;',
    'uniform float uDiffGain;',
    'uniform float uGridSize;',
    'uniform float uCheck;',
    'uniform vec3 uBg1;',
    'uniform vec3 uBg2;',
    'void main(){',
    '  vec2 cpx = vUv * uCanvas;',
    '  vec2 uv = (cpx - uRectOff) / max(uRectSize, vec2(1.0));',
    '  vec3 outc;',
    '  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {',
    '    vec2 q = floor(cpx / 14.0);',
    '    float ck = mod(q.x + q.y, 2.0);',
    '    outc = uCheck > 0.5 ? mix(uBg1, uBg2, ck) : uBg1;',
    '  } else {',
    '    vec2 suv = uv;',
    '    if (uNearest > 0.5) suv = (floor(uv * uVideoSize) + 0.5) / uVideoSize;',
    '    suv = clamp(suv, vec2(0.0), vec2(1.0));',
    '    vec3 fc = texture2D(uTex, suv).rgb;',
    '    vec3 oc = texture2D(uOrig, suv).rgb;',
    '    if (uSplitMode > 2.5) {',
    '      outc = oc;',
    '    } else if (uSplitMode > 1.5) {',
    '      outc = clamp(abs(fc - oc) * uDiffGain, 0.0, 1.0);',
    '    } else if (uSplitMode > 0.5) {',
    '      outc = uv.x < uSplit ? oc : fc;',
    '      float w = 1.5 / max(uRectSize.x, 1.0);',
    '      if (abs(uv.x - uSplit) < w) outc = vec3(1.0, 0.85, 0.2);',
    '    } else {',
    '      outc = fc;',
    '    }',
    '    if (uGridSize >= 2.0) {',
    '      vec2 vpx = uv * uVideoSize;',
    '      vec2 perCanvas = uVideoSize / max(uRectSize, vec2(1.0));',
    '      vec2 g = mod(vpx, uGridSize);',
    '      float line = 0.0;',
    '      if (g.x < perCanvas.x || g.y < perCanvas.y) line = 1.0;',
    '      outc = mix(outc, vec3(1.0, 1.0, 1.0), line * 0.16);',
    '    }',
    '  }',
    '  gl_FragColor = vec4(outc, 1.0);',
    '}'
  ].join('\n');

  var uidSeq = 1;

  function Pipeline(glcore) {
    D.Emitter.call(this);
    this.gl = glcore;
    this.chain = [];
    this.bypass = false;          // 全局旁通（B 键）：保留链但不执行
    this.errors = Object.create(null);
    this.srcTex = null;
    this.srcW = 0;
    this.srcH = 0;
    this.grid = 1;
    this.renderScale = 1;
    this.maxProcessPixels = 1920 * 1080 * 2;   // 超过就自动降处理分辨率
    this.paletteId = 'gb-dmg';
    this.palette = D.Resources.paletteFloats(D.Resources.paletteById('gb-dmg').colors);
    this.glyphRampId = 'ascii';
    this.glyph = null;
    this.texBayer = null;
    this.texNoise = null;
    this.texGlyph = null;
    this.view = {
      fit: 'contain',        // contain | actual | integer
      zoom: 1,
      panX: 0,
      panY: 0,
      nearest: true,
      checker: true,
      splitMode: 0,          // 0 全滤镜 1 左右对比 2 差异 3 仅原片
      split: 0.5,
      diffGain: 4,
      gridOverlay: 0
    };
    this.rect = { left: 0, top: 0, width: 0, height: 0, scale: 1 };
    this.stats = { ms: 0, passes: 0, filters: 0, procW: 0, procH: 0 };
    this._initResources();
  }
  Pipeline.prototype = Object.create(D.Emitter.prototype);
  Pipeline.prototype.constructor = Pipeline;

  Pipeline.prototype._initResources = function () {
    var g = this.gl;
    if (!g.ok) return;
    var R = D.Resources;
    this.texBayer = g.createTexture({ width: 8, height: 8, data: R.bayerBytes(8), filter: 'nearest', wrap: 'repeat' });
    this.texNoise = g.createTexture({ width: 64, height: 64, data: R.noiseBytes(64, 0x51ED27), filter: 'linear', wrap: 'repeat' });
    this.setGlyphRamp(this.glyphRampId);
    this.display = g.program(DISPLAY_FS, '__display__');
  };

  Pipeline.prototype.setGlyphRamp = function (id, cellPx) {
    var R = D.Resources;
    var chars = R.RAMPS[id] || R.RAMPS.ascii;
    this.glyphRampId = R.RAMPS[id] ? id : 'ascii';
    this.glyph = R.buildGlyphAtlas(chars, cellPx || 16);
    if (!this.gl.ok) return;
    if (this.texGlyph) this.gl.gl.deleteTexture(this.texGlyph);
    this.texGlyph = this.gl.createTexture({ filter: 'linear', wrap: 'clamp' });
    this.gl.uploadFrame(this.texGlyph, this.glyph.canvas, true);
    this.emit('resources', { glyph: this.glyphRampId, count: this.glyph.count });
  };

  Pipeline.prototype.setPalette = function (id, customColors) {
    var R = D.Resources;
    var p = R.paletteById(id);
    var colors = (id === 'custom' && customColors && customColors.length) ? customColors : p.colors;
    if (!colors || !colors.length) colors = ['#000000', '#ffffff'];
    this.paletteId = id;
    this.paletteColors = colors.slice(0, 32);
    this.palette = R.paletteFloats(this.paletteColors);
    this.emit('resources', { palette: id, count: this.palette.count });
  };

  /* ------------------------------------------------------------------ *
   * 滤镜链管理
   * ------------------------------------------------------------------ */

  Pipeline.prototype.addFilter = function (id, params, atIndex) {
    var def = D.getFilter(id);
    if (!def) return null;
    var inst = {
      uid: 'f' + (uidSeq++),
      id: id,
      enabled: true,
      params: D.filterDefaults(id),
      code: def.dynamic ? def.defaultCode : null
    };
    if (params) Object.keys(params).forEach(function (k) {
      if (inst.params[k] !== undefined) inst.params[k] = params[k];
    });
    if (atIndex == null || atIndex < 0 || atIndex >= this.chain.length) this.chain.push(inst);
    else this.chain.splice(atIndex, 0, inst);
    this.emit('chain', this.chain);
    return inst;
  };

  Pipeline.prototype.find = function (uid) {
    for (var i = 0; i < this.chain.length; i++) if (this.chain[i].uid === uid) return this.chain[i];
    return null;
  };

  Pipeline.prototype.indexOf = function (uid) {
    for (var i = 0; i < this.chain.length; i++) if (this.chain[i].uid === uid) return i;
    return -1;
  };

  Pipeline.prototype.remove = function (uid) {
    var i = this.indexOf(uid);
    if (i < 0) return false;
    this.chain.splice(i, 1);
    delete this.errors[uid];
    this.emit('chain', this.chain);
    return true;
  };

  Pipeline.prototype.move = function (uid, delta) {
    var i = this.indexOf(uid);
    if (i < 0) return false;
    var j = U.clamp(i + delta, 0, this.chain.length - 1);
    if (i === j) return false;
    var it = this.chain.splice(i, 1)[0];
    this.chain.splice(j, 0, it);
    this.emit('chain', this.chain);
    return true;
  };

  Pipeline.prototype.moveTo = function (uid, index) {
    var i = this.indexOf(uid);
    if (i < 0) return false;
    var it = this.chain.splice(i, 1)[0];
    this.chain.splice(U.clamp(index, 0, this.chain.length), 0, it);
    this.emit('chain', this.chain);
    return true;
  };

  Pipeline.prototype.clearChain = function () {
    this.chain.length = 0;
    this.errors = Object.create(null);
    this.emit('chain', this.chain);
  };

  Pipeline.prototype.setParam = function (uid, key, value) {
    var inst = this.find(uid);
    if (!inst) return;
    inst.params[key] = value;
    this.emit('params', { uid: uid, key: key, value: value });
  };

  Pipeline.prototype.setCode = function (uid, code) {
    var inst = this.find(uid);
    if (!inst) return;
    inst.code = code;
    delete this.errors[uid];
    this.emit('params', { uid: uid, key: 'code' });
  };

  Pipeline.prototype.serializeChain = function () {
    return this.chain.map(function (inst) {
      var o = { id: inst.id, enabled: inst.enabled, params: JSON.parse(JSON.stringify(inst.params)) };
      if (inst.code) o.code = inst.code;
      return o;
    });
  };

  Pipeline.prototype.loadChain = function (list) {
    this.clearChain();
    if (!Array.isArray(list)) return 0;
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || !D.getFilter(item.id)) continue;
      var inst = this.addFilter(item.id, item.params);
      if (!inst) continue;
      if (item.enabled === false) inst.enabled = false;
      if (item.code && D.getFilter(item.id).dynamic) inst.code = item.code;
      n++;
    }
    this.emit('chain', this.chain);
    return n;
  };

  /* ------------------------------------------------------------------ *
   * 编译
   * ------------------------------------------------------------------ */

  Pipeline.prototype._programsFor = function (inst) {
    var def = D.getFilter(inst.id);
    // 动态滤镜（自定义 GLSL）：源码取自实例，缓存键用源码哈希
    if (def.dynamic && inst.code) {
      var srcDef = { id: def.id, params: def.params, passes: [{ fs: inst.code }] };
      var fsSrc = D.ShaderLib.buildFragment(srcDef, 0);
      return [{ rec: this.gl.program(fsSrc, 'dyn:' + hash(fsSrc)), pass: def.passes[0] || {} }];
    }
    var progs = [];
    for (var i = 0; i < def.passes.length; i++) {
      progs.push({
        rec: this.gl.program(D.ShaderLib.buildFragment(def, i), def.id + '#' + i),
        pass: def.passes[i]
      });
    }
    return progs;
  };

  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /** 预编译所有已启用滤镜，返回错误列表（用于自检与 UI 提示） */
  Pipeline.prototype.compileAll = function () {
    var out = [];
    for (var i = 0; i < this.chain.length; i++) {
      var inst = this.chain[i];
      try {
        this._programsFor(inst);
        delete this.errors[inst.uid];
      } catch (e) {
        this.errors[inst.uid] = this._formatError(inst, e);
        out.push({ uid: inst.uid, id: inst.id, error: this.errors[inst.uid] });
      }
    }
    return out;
  };

  Pipeline.prototype._formatError = function (inst, e) {
    var def = D.getFilter(inst.id);
    var offset = 0;
    try { offset = D.ShaderLib.headerLineCount(def); } catch (x) {}
    var msg = String(e && e.message ? e.message : e);
    // 把 "ERROR: 0:42:" 里的行号换算成滤镜源码行号
    msg = msg.replace(/0:(\d+)/g, function (m, n) {
      var line = parseInt(n, 10) - offset;
      return '滤镜源码第 ' + line + ' 行';
    });
    return msg;
  };

  /* ------------------------------------------------------------------ *
   * 视图几何
   * ------------------------------------------------------------------ */

  /** 计算内容矩形（CSS/设备像素同一套，调用方传设备像素画布尺寸） */
  Pipeline.prototype.computeRect = function (cw, ch, vw, vh) {
    var v = this.view;
    var scale;
    if (v.fit === 'actual') scale = v.zoom;
    else if (v.fit === 'integer') {
      var base = Math.max(1, Math.floor(Math.min(cw / vw, ch / vh)));
      scale = base * Math.max(1, Math.round(v.zoom));
    } else {
      scale = Math.min(cw / vw, ch / vh) * v.zoom;
    }
    var w = vw * scale, h = vh * scale;
    var left = (cw - w) / 2 + v.panX;
    var top = (ch - h) / 2 + v.panY;
    this.rect = { left: left, top: top, width: w, height: h, scale: scale };
    return this.rect;
  };

  /** 画布坐标(左上原点, 设备像素) -> 视频像素坐标；越界返回 null */
  Pipeline.prototype.canvasToVideo = function (x, y) {
    var r = this.rect;
    if (!r.width || !r.height || !this.srcW) return null;
    var u = (x - r.left) / r.width;
    var v = (y - r.top) / r.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    return {
      x: Math.min(this.srcW - 1, Math.max(0, Math.floor(u * this.srcW))),
      y: Math.min(this.srcH - 1, Math.max(0, Math.floor(v * this.srcH))),
      u: u, v: v
    };
  };

  Pipeline.prototype.fitToWindow = function () {
    this.view.fit = 'contain';
    this.view.zoom = 1;
    this.view.panX = 0;
    this.view.panY = 0;
  };

  /* ------------------------------------------------------------------ *
   * 渲染
   * ------------------------------------------------------------------ */

  /**
   * @param {object} o
   *   o.source     视频元素 / ImageBitmap / canvas
   *   o.videoW/H   源尺寸
   *   o.time       媒体时间（秒）
   *   o.frame      帧号
   *   o.canvasW/H  画布设备像素尺寸
   *   o.readTarget 若为 true，返回最终渲染目标（调用方负责 release）
   */
  Pipeline.prototype.render = function (o) {
    var g = this.gl;
    if (!g.ok) return null;
    var t0 = global.performance ? performance.now() : Date.now();
    var vw = Math.max(1, o.videoW | 0), vh = Math.max(1, o.videoH | 0);

    // 源纹理
    if (!this.srcTex) this.srcTex = g.createTexture({ filter: 'linear', wrap: 'clamp' });
    if (o.source) {
      if (!g.uploadFrame(this.srcTex, o.source, true)) {
        this.emit('uploaderror', { message: g.error });
        return null;
      }
    }
    this.srcW = vw;
    this.srcH = vh;

    // 处理分辨率
    var procScale = this.renderScale;
    var pixels = vw * vh * procScale * procScale;
    if (this.maxProcessPixels > 0 && pixels > this.maxProcessPixels) {
      procScale *= Math.sqrt(this.maxProcessPixels / pixels);
    }
    var pw = Math.max(1, Math.round(vw * procScale));
    var ph = Math.max(1, Math.round(vh * procScale));

    var srcRef = { tex: this.srcTex, w: vw, h: vh, virtual: true };
    var cur = srcRef;
    var passCount = 0, filterCount = 0;
    this.grid = 1;


    function rel(rt) {
      if (rt && !rt.virtual) g.release(rt);
    }

    var bypassAll = this.bypass || o.bypass;
    for (var i = 0; i < this.chain.length && !bypassAll; i++) {
      var inst = this.chain[i];
      if (!inst.enabled) continue;
      var def = D.getFilter(inst.id);
      if (!def) continue;
      var progs;
      try {
        progs = this._programsFor(inst);
        if (this.errors[inst.uid]) { delete this.errors[inst.uid]; this.emit('shaderok', { uid: inst.uid }); }
      } catch (e) {
        var msg = this._formatError(inst, e);
        if (this.errors[inst.uid] !== msg) {
          this.errors[inst.uid] = msg;
          this.emit('shadererror', { uid: inst.uid, id: inst.id, message: msg });
        }
        continue; // 编译失败的滤镜直接跳过（画面保持可用）
      }

      var stageIn = cur;
      var passIn = cur;
      for (var p = 0; p < progs.length; p++) {
        var pass = progs[p].pass || {};
        var scale = pass.scale && pass.scale > 0 ? pass.scale : 1;
        var tw = Math.max(1, Math.round(pw * scale));
        var th = Math.max(1, Math.round(ph * scale));
        var out = g.rt(tw, th, pass.filter === 'nearest' ? 'nearest' : 'linear');
        var uni = this._uniforms(inst, def, passIn, stageIn, srcRef, tw, th, vw, vh, o, p);
        g.draw(progs[p].rec, uni, out);
        passCount++;
        if (passIn !== stageIn) rel(passIn);
        passIn = out;
      }
      if (stageIn !== passIn) rel(stageIn);
      cur = passIn;
      filterCount++;
      if (def.gridParam && inst.params[def.gridParam] > 0) this.grid = inst.params[def.gridParam];
    }

    // 合成到画布
    var cw = Math.max(1, o.canvasW | 0), chh = Math.max(1, o.canvasH | 0);
    var rect = this.computeRect(cw, chh, vw, vh);
    var v = this.view;
    var bg1 = [0.055, 0.06, 0.075], bg2 = [0.085, 0.09, 0.11];
    g.draw(this.display, {
      uTex: cur,
      uOrig: srcRef,
      uCanvas: [cw, chh],
      // 着色器里的 y 从画布底部起算，这里做一次翻转
      uRectOff: [rect.left, chh - (rect.top + rect.height)],
      uRectSize: [rect.width, rect.height],
      uVideoSize: [vw, vh],
      uNearest: v.nearest ? 1 : 0,
      uSplit: v.split,
      uSplitMode: v.splitMode,
      uDiffGain: v.diffGain,
      uGridSize: v.gridOverlay,
      uCheck: v.checker ? 1 : 0,
      uBg1: bg1,
      uBg2: bg2
    }, null);

    this.stats.ms = (global.performance ? performance.now() : Date.now()) - t0;
    this.stats.passes = passCount;
    this.stats.filters = filterCount;
    this.stats.procW = pw;
    this.stats.procH = ph;

    if (o.readTarget) return cur.virtual ? this._copyOf(cur, pw, ph) : cur;
    rel(cur);
    return null;
  };

  /** 把源纹理复制到一个真正的渲染目标（导出「无滤镜原图」时用） */
  Pipeline.prototype._copyOf = function (srcRef, w, h) {
    var g = this.gl;
    var rt = g.rt(w, h, 'linear');
    var rec = g.program([
      'precision highp float;',
      'varying vec2 vUv;',
      'uniform sampler2D uTex;',
      'void main(){ gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0); }'
    ].join('\n'), '__copy__');
    g.draw(rec, { uTex: srcRef }, rt);
    return rt;
  };

  Pipeline.prototype._uniforms = function (inst, def, passIn, stageIn, srcRef, tw, th, vw, vh, o, passIndex) {
    var uni = {
      uTex: passIn,
      uStageIn: stageIn,
      uSrc: srcRef,
      uBayer: this.texBayer,
      uNoise: this.texNoise,
      uGlyph: this.texGlyph,
      uSize: [tw, th],
      uTexel: [1 / tw, 1 / th],
      uSrcSize: [vw, vh],
      uTime: o.time || 0,
      uFrame: o.frame || 0,
      uRandom: fracHash(o.frame || 0),
      uGrid: Math.max(1, this.grid),
      uGlyphCount: this.glyph ? this.glyph.count : 1,
      uPaletteCount: this.palette.count,
      uPalette: this.palette.data
    };
    var params = def.params;
    for (var i = 0; i < params.length; i++) {
      var p = params[i];
      var val = inst.params[p.key];
      if (p.type === 'color') uni['u_' + p.key] = U.hexToRgb(val);
      else if (p.type === 'bool') uni['u_' + p.key] = val ? 1 : 0;
      else uni['u_' + p.key] = Number(val) || 0;
    }
    return uni;
  };

  /** 帧号决定的伪随机数：同一帧重复渲染结果一致（暂停时画面不会跳） */
  function fracHash(n) {
    var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  D.Pipeline = Pipeline;
})(typeof window !== 'undefined' ? window : globalThis);
