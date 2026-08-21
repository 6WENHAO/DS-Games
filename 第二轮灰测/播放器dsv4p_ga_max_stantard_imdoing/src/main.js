/*!
 * src/main.js — 应用装配：渲染循环、播放头抽象、缩放平移、像素检查器、
 *               预设/工程读写、自检、拖放打开
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util, W = D.W, TC = D.TC, h = U.h;

  function App() {
    var self = this;
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('gl-canvas');
    this.stage = document.getElementById('stage-view');

    this.gl = new D.GLCore(this.canvas);
    if (!this.gl.ok) {
      W.blocker('无法初始化 WebGL', '这个播放器的滤镜依赖 WebGL。<br>请更换浏览器（Chrome / Edge / Firefox 新版），' +
        '或在系统设置里开启硬件加速。<br><span class="mono small">' + (this.gl.error || '') + '</span>');
    }

    this.pipeline = new D.Pipeline(this.gl);
    this.engine = new D.VideoEngine(this.video);
    this.cache = new D.FrameCache(this.engine);
    this.cachePlayer = new D.CachePlayer(this.cache, this.engine);
    this.markers = new D.MarkerList();
    this.recorder = D.Recorder.supported() ? new D.Recorder(this.canvas) : null;
    this.timeline = new D.Timeline(document.getElementById('timeline'), this);

    this.dirty = true;
    this.previewFrame = null;   // 拖动时的「虚拟播放头」（用帧缓存瞬间出画）
    this.exportSource = null;
    this.exportFrame = null;
    this.inspectRT = null;
    this.magnifierOn = false;
    this.renderFps = 0;
    this._scrubWasPlaying = false;
    this._lastToken = -1;

    W.initTabs();
    this.filtersUI = new D.FiltersUI(this);
    this.panels = new D.Panels(this);
    this.shortcuts = new D.Shortcuts(this);

    this._bindEngine();
    this._bindStage();
    this._bindResize();
    this._restoreSession();
    this._loop();

    W.status('就绪 — 拖入视频或点「打开视频」/「演示片」');
    document.getElementById('status-gl').textContent =
      (this.gl.isWebGL2 ? 'WebGL2' : 'WebGL1') + ' · ' + String((this.gl.rendererInfo || {}).renderer || '').slice(0, 28);

    if (D.caps.fileProtocol) {
      this.toast('当前是 file:// 直开模式：用「打开视频」选择文件最稳；若演示片报错请运行 start.sh / start.bat', 'warn', 9000);
    }
  }

  /* ------------------------------------------------------------------ *
   * 播放头抽象：可能来自 <video>，也可能来自帧缓存
   * ------------------------------------------------------------------ */

  App.prototype.displayFrame = function () {
    if (this.exportFrame != null) return this.exportFrame;
    if (this.cachePlayer.active) return this.cachePlayer.frame;
    if (this.previewFrame != null) return this.previewFrame;
    return this.engine.frame;
  };

  App.prototype.displayTime = function () {
    if (this.exportFrame != null) return this.engine.clock.timeOfFrame(this.exportFrame);
    if (this.cachePlayer.active) return this.engine.clock.timeOfFrame(this.cachePlayer.frame);
    if (this.previewFrame != null) return this.engine.clock.timeOfFrame(this.previewFrame);
    return this.engine.time;
  };

  /** 当前用于渲染的图源 */
  App.prototype.currentSource = function () {
    if (this.exportSource) return this.exportSource;
    if (this.cachePlayer.active) {
      var b = this.cache.get(this.cachePlayer.frame);
      if (b) return b;
    }
    if (this.previewFrame != null) {
      var p = this.cache.get(this.previewFrame);
      if (p) return p;
    }
    if (!this.engine.ready || this.video.readyState < 2) return null;
    return this.video;
  };

  App.prototype.sourceSize = function (src) {
    if (!src) return { w: 0, h: 0 };
    if (src === this.video) return { w: this.video.videoWidth, h: this.video.videoHeight };
    return { w: src.width, h: src.height };
  };

  App.prototype.mediaBase = function () {
    var n = (this.engine.media && this.engine.media.name) || 'video';
    return n.replace(/\.[^.]+$/, '').replace(/[^\w\u4e00-\u9fa5.-]+/g, '_').slice(0, 64) || 'video';
  };

  App.prototype.toast = function (m, k, ms) { return W.toast(m, k, ms); };
  App.prototype.requestRender = function () { this.dirty = true; };

  /* ------------------------------------------------------------------ *
   * 渲染循环
   * ------------------------------------------------------------------ */

  App.prototype._resizeCanvas = function () {
    var dpr = Math.min(2.5, global.devicePixelRatio || 1);
    var r = this.stage.getBoundingClientRect();
    var w = Math.max(16, Math.round(r.width * dpr));
    var hh = Math.max(16, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== hh) {
      this.canvas.width = w;
      this.canvas.height = hh;
      this.dirty = true;
    }
  };

  App.prototype._render = function () {
    var src = this.currentSource();
    if (!src) {
      if (this.gl.ok) this.gl.clear(null, 0.043, 0.047, 0.058);
      return;
    }
    var sz = this.sourceSize(src);
    if (!sz.w || !sz.h) return;
    var want = this.magnifierOn;
    var rt = this.pipeline.render({
      source: src,
      videoW: sz.w,
      videoH: sz.h,
      time: this.displayTime(),
      frame: this.displayFrame(),
      canvasW: this.canvas.width,
      canvasH: this.canvas.height,
      readTarget: want
    });
    if (want && rt) {
      if (this.inspectRT) this.gl.release(this.inspectRT);
      this.inspectRT = rt;
    } else if (rt) {
      this.gl.release(rt);
    }
  };

  /** 供导出使用：渲染一帧并返回渲染目标（调用方负责 release） */
  App.prototype.renderToTarget = function (opts) {
    opts = opts || {};
    var src = this.currentSource();
    if (!src || !this.gl.ok) return null;
    var sz = this.sourceSize(src);
    return this.pipeline.render({
      source: src,
      videoW: sz.w,
      videoH: sz.h,
      time: this.displayTime(),
      frame: this.displayFrame(),
      canvasW: this.canvas.width,
      canvasH: this.canvas.height,
      readTarget: true,
      bypass: !!opts.bypass
    });
  };

  App.prototype._loop = function () {
    var self = this;
    var last = global.performance ? performance.now() : Date.now();
    var frames = 0, acc = 0, lastPanels = 0;
    function tick(now) {
      requestAnimationFrame(tick);
      now = now || (global.performance ? performance.now() : Date.now());
      var dt = now - last;
      last = now;
      acc += dt; frames++;
      if (acc >= 500) { self.renderFps = frames * 1000 / acc; frames = 0; acc = 0; }

      self._resizeCanvas();
      // 录制时必须持续绘制：canvas.captureStream() 只在画布被绘制时产出帧
      if (self.recorder && self.recorder.active) self.dirty = true;
      var playing = self.engine.playing || self.engine.stepped.active || self.cachePlayer.active;
      if (self.dirty || playing || self._lastToken !== self.engine.frameToken) {
        self._lastToken = self.engine.frameToken;
        self.dirty = false;
        try { self._render(); }
        catch (e) {
          if (global.console) console.error(e);
          W.status('渲染出错：' + e.message);
        }
      }
      self.timeline.draw();
      if (now - lastPanels > 66) { lastPanels = now; self.panels.update(); }
    }
    requestAnimationFrame(tick);
  };

  /* ------------------------------------------------------------------ *
   * 引擎事件
   * ------------------------------------------------------------------ */

  App.prototype._bindEngine = function () {
    var self = this, eng = this.engine;

    eng.on('load', function (info) {
      document.getElementById('media-name').textContent = info.media.name;
      self._renderBadges();
      self.timeline.fit();
      self.previewFrame = null;
      self.cache.clear();
      self.markers.clear();
      eng.setLoop({ inFrame: 0, outFrame: Math.max(0, eng.clock.frameCount - 1), enabled: false, resetWraps: true });
      document.getElementById('seq-from').value = 0;
      document.getElementById('seq-to').value = Math.min(eng.clock.frameCount - 1, 47);
      document.getElementById('cache-fps').value = Math.round(eng.clock.fps || 24);
      document.getElementById('step-fps').value = Math.min(120, Math.max(0.25, Math.round((eng.clock.fps || 12) / 2)));
      document.getElementById('drop-hint').hidden = true;
      W.status('已加载 ' + info.media.name + ' · ' + eng.clock.describe().fpsText + ' · ' + eng.clock.frameCount + ' 帧');
      self.dirty = true;
      self.panels.update(true);
    });

    eng.on('error', function (e) {
      self.toast(e.message, 'error', 8000);
      W.status('错误：' + e.message);
    });

    eng.on('clock', function () { self._renderBadges(); });
    eng.on('loop', function (info) {
      if (info.count > 0) W.status('循环 ' + info.wraps + '/' + info.count);
    });
    eng.on('loopdone', function () { self.toast('循环次数已达上限，已停止'); });

    this.pipeline.on('uploaderror', function (e) {
      W.blocker('无法把视频帧上传到 GPU', '浏览器判定该视频是「跨源」资源，因此 WebGL 拒绝读取它。<br><br>' +
        '解决办法（任选其一）：<br>' +
        '1. 用本地服务器打开：Linux 执行 <code>./start.sh</code>，Windows 双击 <code>start.bat</code>；<br>' +
        '2. 或者点「打开视频」从文件选择器选本地文件（这样是同源的 blob 地址）。<br><br>' +
        '<span class="mono small">' + (e.message || '') + '</span>');
    });

    this.cachePlayer.on('frame', function () { self.dirty = true; });
    this.cachePlayer.on('stop', function () { self.dirty = true; });
    this.markers.on('change', function () { self.dirty = true; self._saveSession(); });
    this.pipeline.on('chain', function () { self._saveSession(); });
    this.pipeline.on('params', U.debounce(function () { self._saveSession(); }, 500));
  };

  App.prototype._renderBadges = function () {
    var eng = this.engine, c = eng.clock, el = document.getElementById('media-badges');
    U.clear(el);
    if (!eng.ready) return;
    var idx = eng.media.index;
    function badge(text, kind, title) {
      el.appendChild(h('span.badge' + (kind ? '.badge-' + kind : ''), { text: text, title: title || '' }));
    }
    badge(eng.media.width + '×' + eng.media.height);
    badge(c.describe().fpsText, c.mode === 'index' ? 'ok' : 'warn',
      c.mode === 'index' ? '来自容器采样表，逐帧精确' : '由 rVFC 观测推断，可手动指定');
    badge(c.frameCount + ' 帧');
    badge(TC.formatDuration(c.duration));
    if (idx) {
      badge(idx.codec, null, '容器编解码标识');
      badge('I×' + idx.keyframes.length, null, '关键帧数量');
      if (idx.structure === 'fragmented') badge('fMP4', 'warn', '分片 MP4');
      if (idx.vfr) badge('VFR', 'warn', '可变帧率：逐帧时间戳已逐个记录');
    } else {
      badge('无采样表', 'warn', '该容器未做采样表解析（例如 WebM），帧号来自恒定帧率模型');
    }
    if (eng.media.size) badge(U.bytes(eng.media.size));
  };

  /* ------------------------------------------------------------------ *
   * 画面交互：缩放 / 平移 / 放大镜 / 拖放
   * ------------------------------------------------------------------ */

  App.prototype._bindStage = function () {
    var self = this, st = this.stage, cv = this.canvas;
    var dragging = null;

    cv.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var v = self.pipeline.view;
      var dpr = Math.min(2.5, global.devicePixelRatio || 1);
      var r = cv.getBoundingClientRect();
      var cx = (ev.clientX - r.left) * dpr, cy = (ev.clientY - r.top) * dpr;
      var rect = self.pipeline.rect;
      if (!rect.width) return;
      var u = (cx - rect.left) / rect.width, w2 = (cy - rect.top) / rect.height;
      var factor = ev.deltaY > 0 ? 1 / 1.15 : 1.15;
      if (v.fit === 'contain') { v.fit = 'contain'; }
      v.zoom = U.clamp(v.zoom * factor, 0.05, 32);
      // 保持光标下的像素不动
      var sz = self.sourceSize(self.currentSource());
      if (sz.w) {
        var scale = (v.fit === 'actual') ? v.zoom
          : (v.fit === 'integer' ? Math.max(1, Math.floor(Math.min(cv.width / sz.w, cv.height / sz.h))) * Math.max(1, Math.round(v.zoom))
            : Math.min(cv.width / sz.w, cv.height / sz.h) * v.zoom);
        var nw = sz.w * scale, nh = sz.h * scale;
        v.panX = cx - u * nw - (cv.width - nw) / 2;
        v.panY = cy - w2 * nh - (cv.height - nh) / 2;
      }
      document.getElementById('zoom-range').value = v.zoom;
      document.getElementById('zoom-out').textContent = Math.round(v.zoom * 100) + '%';
      self.dirty = true;
    }, { passive: false });

    cv.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0 && ev.button !== 1) return;
      dragging = { x: ev.clientX, y: ev.clientY, panX: self.pipeline.view.panX, panY: self.pipeline.view.panY };
      cv.style.cursor = 'grabbing';
    });
    global.addEventListener('mousemove', function (ev) {
      if (dragging) {
        var dpr = Math.min(2.5, global.devicePixelRatio || 1);
        self.pipeline.view.panX = dragging.panX + (ev.clientX - dragging.x) * dpr;
        self.pipeline.view.panY = dragging.panY + (ev.clientY - dragging.y) * dpr;
        self.dirty = true;
        return;
      }
      if (self.magnifierOn && ev.target === cv) self._updateMagnifier(ev);
    });
    global.addEventListener('mouseup', function () {
      dragging = null;
      cv.style.cursor = '';
    });
    cv.addEventListener('dblclick', function () {
      self.pipeline.fitToWindow();
      document.getElementById('zoom-range').value = 1;
      document.getElementById('zoom-out').textContent = '100%';
      self.dirty = true;
    });
    cv.addEventListener('mouseleave', function () {
      document.getElementById('magnifier').hidden = true;
      self.panels.setPixelReadout(null);
    });

    // 拖放打开
    ['dragenter', 'dragover'].forEach(function (t) {
      st.addEventListener(t, function (ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'copy';
        document.getElementById('drop-hint').hidden = false;
        document.getElementById('drop-hint').classList.add('is-active');
      });
    });
    st.addEventListener('dragleave', function (ev) {
      if (ev.target !== st) return;
      document.getElementById('drop-hint').classList.remove('is-active');
      if (self.engine.ready) document.getElementById('drop-hint').hidden = true;
    });
    st.addEventListener('drop', function (ev) {
      ev.preventDefault();
      document.getElementById('drop-hint').classList.remove('is-active');
      var f = ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) self.openFile(f);
      else if (self.engine.ready) document.getElementById('drop-hint').hidden = true;
    });
  };

  App.prototype._updateMagnifier = function (ev) {
    var rt = this.inspectRT;
    if (!rt) return;
    var dpr = Math.min(2.5, global.devicePixelRatio || 1);
    var r = this.canvas.getBoundingClientRect();
    var cx = (ev.clientX - r.left) * dpr, cy = (ev.clientY - r.top) * dpr;
    var hit = this.pipeline.canvasToVideo(cx, cy);
    var box = document.getElementById('magnifier');
    if (!hit) { box.hidden = true; this.panels.setPixelReadout(null); return; }
    box.hidden = false;

    // 视频像素 -> 渲染目标像素（渲染目标可能被 renderScale 缩小，且行序自下而上）
    var sx = rt.w / this.pipeline.srcW, sy = rt.h / this.pipeline.srcH;
    var px = Math.floor(hit.x * sx), py = Math.floor(hit.y * sy);
    var N = 11; // 采样窗口
    var reg = this.gl.readRegion(rt, px - (N >> 1), rt.h - 1 - py - (N >> 1), N, N);

    var cv = document.getElementById('magnifier-canvas');
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(reg.width, reg.height);
    for (var y = 0; y < reg.height; y++) {
      for (var x = 0; x < reg.width; x++) {
        var s = ((reg.height - 1 - y) * reg.width + x) * 4;
        var d = (y * reg.width + x) * 4;
        img.data[d] = reg.data[s];
        img.data[d + 1] = reg.data[s + 1];
        img.data[d + 2] = reg.data[s + 2];
        img.data[d + 3] = 255;
      }
    }
    var tmp = document.createElement('canvas');
    tmp.width = reg.width; tmp.height = reg.height;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(tmp, 0, 0, cv.width, cv.height);
    var cell = cv.width / reg.width;
    ctx.strokeStyle = 'rgba(255,212,121,0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.floor(reg.width / 2) * cell, Math.floor(reg.height / 2) * cell, cell, cell);

    // 中心像素读数
    var ci = ((Math.floor(reg.height / 2)) * reg.width + Math.floor(reg.width / 2)) * 4;
    var rr = reg.data[ci], gg = reg.data[ci + 1], bb = reg.data[ci + 2];
    var hex = U.rgbToHex([rr / 255, gg / 255, bb / 255]);
    document.getElementById('magnifier-readout').textContent =
      hit.x + ',' + hit.y + '  ' + hex;
    this.panels.setPixelReadout({
      x: hit.x, y: hit.y, r: rr, g: gg, b: bb, hex: hex,
      luma: (0.2126 * rr + 0.7152 * gg + 0.0722 * bb) / 255
    });
  };

  App.prototype._bindResize = function () {
    var self = this;
    function onResize() {
      self.timeline.resize();
      self.dirty = true;
    }
    global.addEventListener('resize', onResize);
    if (global.ResizeObserver) {
      new ResizeObserver(onResize).observe(this.stage);
      new ResizeObserver(onResize).observe(document.getElementById('timeline').parentNode);
    }
  };

  /* ------------------------------------------------------------------ *
   * 打开媒体
   * ------------------------------------------------------------------ */

  App.prototype.openFile = function (file) {
    var self = this;
    if (!/^video\//.test(file.type) && !/\.(mp4|m4v|mov|webm|mkv|ogv|avi|ts)$/i.test(file.name)) {
      this.toast('这看起来不是视频文件：' + file.name, 'error');
      return;
    }
    W.status('正在加载 ' + file.name + ' …');
    W.hideBlocker();
    this.engine.open({ file: file }).catch(function (err) {
      self.toast('打开失败：' + err.message, 'error', 8000);
      W.status('打开失败：' + err.message);
    });
  };

  App.prototype.openUrl = function (url) {
    var self = this;
    W.status('正在加载 ' + url + ' …');
    this.engine.open({ url: url }).catch(function (err) {
      self.toast('打开失败：' + err.message, 'error', 8000);
    });
  };

  App.prototype.openDemo = function () {
    var self = this;
    var list = ['media/demo-motion-30fps.mp4', 'media/demo-pixelfriendly-24fps.mp4'];
    var pick = list[(this._demoIdx = ((this._demoIdx || 0) + 1) % list.length)];
    this.openUrl(pick);
    if (D.caps.fileProtocol) {
      this.toast('file:// 下演示片可能因跨源限制无法用作滤镜纹理；如报错请用 start.sh / start.bat 启动本地服务器', 'warn', 9000);
    }
  };

  /* ------------------------------------------------------------------ *
   * 定位 / 播放操作（UI 都走这里，保证行为一致）
   * ------------------------------------------------------------------ */

  App.prototype.gotoFrame = function (f) {
    var self = this;
    this.cachePlayer.stop(false);
    if (this.cache.covers(f)) { this.previewFrame = f; this.dirty = true; }
    return this.engine.seekFrame(f, { verify: true }).then(function (r) {
      self.previewFrame = null;
      self.dirty = true;
      return r;
    });
  };

  App.prototype.gotoTime = function (t) {
    var self = this;
    this.cachePlayer.stop(false);
    return this.engine.seekTime(t).then(function (r) {
      self.previewFrame = null;
      self.dirty = true;
      return { frame: self.engine.frame, time: self.engine.time, tries: 1, exact: true };
    });
  };

  App.prototype.step = function (n) {
    var self = this;
    if (this.cachePlayer.active) {
      // 缓存播放中：直接在缓存里走帧，零延迟
      this.cachePlayer.frame = U.clamp(this.cachePlayer.frame + n, this.cache.inFrame, this.cache.outFrame);
      this.dirty = true;
      return Promise.resolve({ frame: this.cachePlayer.frame, exact: true, tries: 0 });
    }
    if (this.cache.count && this.cache.covers(this.engine.frame + n)) {
      this.previewFrame = this.engine.frame + n;
      this.dirty = true;
    }
    return this.engine.step(n).then(function (r) {
      self.previewFrame = null;
      self.dirty = true;
      return r;
    });
  };

  App.prototype.playStepped = function (dir) {
    var fps = parseFloat(document.getElementById('step-fps').value) || this.engine.clock.fps || 12;
    // 缓存覆盖当前位置时优先用缓存播放（更流畅且帧精确）
    if (this.cache.ready() && this.cache.covers(this.engine.frame)) {
      this.cachePlayer.start({ fps: fps, dir: dir, mode: this.engine.loop.enabled ? this.engine.loop.mode : 'loop' });
      return;
    }
    this.engine.startStepped(fps, dir);
  };

  App.prototype.scrubStart = function () {
    this._scrubWasPlaying = this.engine.playing || this.engine.stepped.active || this.cachePlayer.active;
    this.cachePlayer.stop(false);
    this.engine.pause();
  };

  App.prototype.scrubTo = function (f) {
    f = this.engine.clock.clampFrame(f);
    if (this.cache.covers(f)) {
      this.previewFrame = f;
      this.dirty = true;
      return;
    }
    this.previewFrame = null;
    if (!this._scrubSeek) {
      var self = this;
      this._scrubSeek = U.throttle(function (target) {
        self.engine.seekFrame(target, { verify: false });
      }, 60);
    }
    this._scrubSeek(f);
  };

  App.prototype.scrubEnd = function () {
    var self = this;
    var target = this.previewFrame != null ? this.previewFrame : this.engine.frame;
    this.engine.seekFrame(target, { verify: true }).then(function () {
      self.previewFrame = null;
      self.dirty = true;
      if (self._scrubWasPlaying) self.engine.play();
    });
  };

  App.prototype.setLoopIn = function () {
    var f = this.displayFrame();
    this.engine.setLoop({ inFrame: f, enabled: true, resetWraps: true });
    this.toast('循环入点 = 帧 ' + f);
  };

  App.prototype.setLoopOut = function () {
    var f = this.displayFrame();
    this.engine.setLoop({ outFrame: f, enabled: true, resetWraps: true });
    this.toast('循环出点 = 帧 ' + f);
  };

  /* ------------------------------------------------------------------ *
   * 帧缓存
   * ------------------------------------------------------------------ */

  App.prototype.buildCache = function (scale) {
    var self = this;
    if (!this.engine.ready) { this.toast('先加载视频', 'error'); return; }
    if (this.cache.building) { this.cache.abort(); this.toast('已请求中止缓存构建'); return; }
    var L = this.engine.loop;
    var s = scale || parseFloat(document.getElementById('cache-scale').value) || 1;
    var n = L.outFrame - L.inFrame + 1;
    var cap = this.cache.capacityFor(this.engine.media.width, this.engine.media.height, s);
    if (n > cap) {
      this.toast('区间 ' + n + ' 帧超过显存预算，只会缓存前 ' + cap + ' 帧（可降低缓存倍率）', 'warn', 7000);
    }
    W.status('正在构建帧缓存…');
    this.cache.build(L.inFrame, L.outFrame, { scale: s }).then(function (info) {
      W.status('帧缓存完成：' + info.count + ' 帧 / ' + U.bytes(info.bytes) + ' / ' + (info.ms / 1000).toFixed(1) + 's');
      self.toast('帧缓存就绪：' + info.count + ' 帧，现在循环与倒放都是帧精确的', 'ok', 5000);
      self.dirty = true;
    }).catch(function (err) {
      self.toast('缓存失败：' + err.message, 'error');
    });
  };

  App.prototype.toggleCachePlay = function (fps) {
    if (this.cachePlayer.active) {
      this.cachePlayer.stop();
      return;
    }
    if (!this.cache.ready()) { this.toast('请先构建帧缓存（Shift+C）', 'error'); return; }
    var f = fps || parseFloat(document.getElementById('cache-fps').value) || this.engine.clock.fps;
    this.cachePlayer.start({
      fps: f, dir: 1,
      mode: this.engine.loop.enabled ? this.engine.loop.mode : 'loop',
      from: this.engine.frame
    });
    this.toast('从帧缓存播放 @' + f + ' fps（' + (this.engine.loop.mode === 'pingpong' ? '乒乓' : '循环') + '）', 'ok');
  };

  /* ------------------------------------------------------------------ *
   * 导出辅助（供 src/export/stills.js 调用）
   * ------------------------------------------------------------------ */

  App.prototype.gotoFrameForExport = function (i) {
    if (this.cache.covers(i)) {
      this.exportSource = this.cache.get(i);
      this.exportFrame = i;
      return Promise.resolve();
    }
    this.exportSource = null;
    this.exportFrame = i;
    return this.engine.seekFrame(i, { verify: true });
  };

  App.prototype.clearExportSource = function () {
    this.exportSource = null;
    this.exportFrame = null;
    this.dirty = true;
  };

  /* ------------------------------------------------------------------ *
   * 预设 / 工程 / 会话
   * ------------------------------------------------------------------ */

  App.prototype.applyPreset = function (id) {
    var p = D.getPreset(id);
    if (!p) { this.toast('找不到预设 ' + id, 'error'); return; }
    this.applyPresetObject(p);
  };

  App.prototype.applyPresetObject = function (p) {
    if (p.palette) this.filtersUI.setPalette(p.palette, p.paletteColors);
    if (p.glyph) {
      this.pipeline.setGlyphRamp(p.glyph);
      document.getElementById('glyph-select').value = this.pipeline.glyphRampId;
      this.filtersUI.renderGlyphPreview();
    }
    this.pipeline.loadChain(p.chain);
    this.pipeline.bypass = false;
    document.getElementById('btn-chain-bypass').classList.remove('is-active');
    this.dirty = true;
    this.toast('已套用预设：' + p.name, 'ok');
    W.status('预设 ' + p.name + ' · ' + p.chain.length + ' 个滤镜');
  };

  App.prototype.projectObject = function () {
    var eng = this.engine, c = eng.clock;
    return {
      format: 'dsv4p-project',
      version: 1,
      app: 'dsv4p max stantard imdoing ' + D.version,
      savedAt: new Date().toISOString(),
      media: eng.ready ? {
        name: eng.media.name, width: eng.media.width, height: eng.media.height,
        frameCount: c.frameCount, fps: c.fps, duration: c.duration, source: c.source
      } : null,
      palette: { id: this.pipeline.paletteId, colors: this.pipeline.paletteColors },
      glyph: this.pipeline.glyphRampId,
      renderScale: this.pipeline.renderScale,
      chain: this.pipeline.serializeChain(),
      loop: {
        inFrame: eng.loop.inFrame, outFrame: eng.loop.outFrame,
        enabled: eng.loop.enabled, mode: eng.loop.mode, count: eng.loop.count
      },
      markers: this.markers.serialize(),
      view: JSON.parse(JSON.stringify(this.pipeline.view)),
      stepFps: parseFloat(document.getElementById('step-fps').value) || 12
    };
  };

  App.prototype.saveProject = function () {
    var obj = this.projectObject();
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    U.download(blob, this.mediaBase() + '.dsv4p.json');
    this.toast('工程已保存', 'ok');
  };

  App.prototype.loadProject = function (obj) {
    if (!obj || obj.format !== 'dsv4p-project') { this.toast('不是 dsv4p 工程文件', 'error'); return; }
    if (obj.palette) this.filtersUI.setPalette(obj.palette.id, obj.palette.colors);
    if (obj.glyph) {
      this.pipeline.setGlyphRamp(obj.glyph);
      document.getElementById('glyph-select').value = this.pipeline.glyphRampId;
      this.filtersUI.renderGlyphPreview();
    }
    if (obj.renderScale) {
      this.pipeline.renderScale = obj.renderScale;
      document.getElementById('render-scale').value = obj.renderScale;
      document.getElementById('render-scale-out').textContent = Math.round(obj.renderScale * 100) + '%';
    }
    var n = this.pipeline.loadChain(obj.chain || []);
    if (obj.view) {
      var v = this.pipeline.view;
      Object.keys(obj.view).forEach(function (k) { if (v[k] !== undefined) v[k] = obj.view[k]; });
      document.getElementById('chk-nearest').checked = !!v.nearest;
      document.getElementById('chk-checker').checked = !!v.checker;
      document.getElementById('grid-overlay').value = v.gridOverlay || 0;
      document.getElementById('split-mode').value = String(v.splitMode || 0);
      document.getElementById('zoom-range').value = v.zoom || 1;
    }
    if (obj.markers) this.markers.load(obj.markers);
    if (obj.loop && this.engine.ready) {
      this.engine.setLoop({
        inFrame: obj.loop.inFrame, outFrame: obj.loop.outFrame,
        enabled: obj.loop.enabled, mode: obj.loop.mode, count: obj.loop.count, resetWraps: true
      });
    }
    if (obj.stepFps) document.getElementById('step-fps').value = obj.stepFps;
    this.dirty = true;
    this.panels.update(true);
    this.toast('工程已载入：' + n + ' 个滤镜' + (obj.media ? '（原始素材：' + obj.media.name + '）' : ''), 'ok', 5000);
  };

  App.prototype._saveSession = function () {
    if (!this._saveDebounced) {
      var self = this;
      this._saveDebounced = U.debounce(function () {
        U.store.set('session', {
          chain: self.pipeline.serializeChain(),
          palette: { id: self.pipeline.paletteId, colors: self.pipeline.paletteColors },
          glyph: self.pipeline.glyphRampId,
          view: self.pipeline.view,
          renderScale: self.pipeline.renderScale
        });
      }, 700);
    }
    this._saveDebounced();
  };

  App.prototype._restoreSession = function () {
    var s = U.store.get('session', null);
    if (s && s.chain && s.chain.length) {
      if (s.palette) this.filtersUI.setPalette(s.palette.id, s.palette.colors);
      if (s.glyph) {
        this.pipeline.setGlyphRamp(s.glyph);
        document.getElementById('glyph-select').value = this.pipeline.glyphRampId;
        this.filtersUI.renderGlyphPreview();
      }
      if (s.view) {
        var v = this.pipeline.view;
        Object.keys(s.view).forEach(function (k) { if (v[k] !== undefined) v[k] = s.view[k]; });
        document.getElementById('chk-nearest').checked = !!v.nearest;
        document.getElementById('chk-checker').checked = !!v.checker;
        document.getElementById('split-mode').value = String(v.splitMode || 0);
      }
      if (s.renderScale) {
        this.pipeline.renderScale = s.renderScale;
        document.getElementById('render-scale').value = s.renderScale;
        document.getElementById('render-scale-out').textContent = Math.round(s.renderScale * 100) + '%';
      }
      this.pipeline.loadChain(s.chain);
      W.status('已恢复上次的滤镜链（' + s.chain.length + ' 个）');
    } else {
      this.applyPreset('pixel-8bit');
    }
  };

  /* ------------------------------------------------------------------ *
   * 帮助 / 自检 / 全屏
   * ------------------------------------------------------------------ */

  App.prototype.showHelp = function () {
    this.shortcuts.renderHelp(document.getElementById('help-body'));
    W.openModal('modal-help');
  };

  App.prototype.toggleFullscreen = function () {
    var el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen();
  };

  /** 自检：编译所有滤镜 + 环境能力检查 */
  App.prototype.selfTest = function () {
    var body = document.getElementById('selftest-body');
    U.clear(body);
    var rows = [];
    var self = this;

    function row(ok, name, detail, code) {
      rows.push({ ok: ok, name: name, detail: detail, code: code });
    }

    row(this.gl.ok, 'WebGL 上下文', this.gl.ok ? ((this.gl.isWebGL2 ? 'WebGL 2' : 'WebGL 1') + ' · ' + ((this.gl.rendererInfo || {}).renderer || '')) : this.gl.error);
    row(D.caps.rvfc, 'requestVideoFrameCallback', D.caps.rvfc ? '支持：帧号来自显示帧的精确 PTS' : '不支持：退化为 rAF + currentTime（精度略降，仍可用）');
    row(!!global.createImageBitmap, 'createImageBitmap', global.createImageBitmap ? '支持：可构建帧缓存' : '不支持：帧缓存与缓存播放不可用');
    row(D.Recorder.supported(), 'MediaRecorder + captureStream', D.Recorder.supported() ? ('支持，编码：' + (D.Recorder.pickMime() || '默认')) : '不支持：无法录制 WebM');
    row(!D.caps.fileProtocol, '页面来源', D.caps.fileProtocol ? 'file:// 直开：从「打开视频」选择文件可用；相对路径素材可能被判跨源' : location.origin + '（推荐）');
    row(U.store.set('__t', 1), 'localStorage', U.store.set('__t', 1) ? '可用：会记住滤镜链与预设' : '不可用（隐私模式？）：设置不会被保存');
    U.store.del('__t');

    // 逐个编译所有滤镜
    var failed = 0, compiled = 0;
    var errs = [];
    if (this.gl.ok) {
      for (var i = 0; i < D.filters.length; i++) {
        var def = D.filters[i];
        var fake = { uid: 'selftest', id: def.id, params: D.filterDefaults(def.id), code: def.dynamic ? def.defaultCode : null };
        try {
          this.pipeline._programsFor(fake);
          compiled += def.passes.length;
        } catch (e) {
          failed++;
          errs.push('■ ' + def.id + ' (' + def.label + ')\n' + (e.message || e) + '\n');
        }
      }
    }
    row(failed === 0, '滤镜着色器编译', D.filters.length + ' 个滤镜 / ' + compiled + ' 个 pass 编译成功' + (failed ? '，' + failed + ' 个失败' : ''), errs.join('\n'));

    // 容器索引
    var eng = this.engine;
    if (eng.ready) {
      var idx = eng.media.index;
      row(!!idx, '容器采样表索引', idx
        ? (idx.structure + ' · ' + idx.frameCount + ' 帧 · ' + (idx.vfr ? 'VFR ' : '') + idx.fps + ' fps · 关键帧 ' + idx.keyframes.length)
        : '该文件未解析出采样表（WebM/MKV 或网络 URL），使用帧率推断');
      row(true, '当前时间源', eng.clock.source + '（置信度 ' + Math.round(eng.clock.confidence * 100) + '%）');
    } else {
      row(true, '媒体', '尚未加载视频，部分检查跳过');
    }

    rows.forEach(function (r) {
      var el = h('div.st-row' + (r.ok ? '.st-ok' : '.st-fail'), [
        h('strong', { text: (r.ok ? '✓ ' : '✗ ') + r.name }),
        h('span', { text: '  ' + (r.detail || '') })
      ]);
      body.appendChild(el);
      if (r.code) body.appendChild(h('pre.st-code', { text: r.code }));
    });

    body.appendChild(h('div.divider'));
    body.appendChild(h('div.hint', {
      html: '离线静态检查（不需要浏览器）：<code>node tools/lint-shaders.js</code><br>' +
        '单元测试：<code>node --test "tests/*.test.js"</code><br>' +
        'MP4 索引对照 ffprobe：<code>node tools/verify-mp4index.js media/*.mp4</code>'
    }));

    W.openModal('modal-selftest');
    return rows;
  };

  /* ------------------------------------------------------------------ *
   * 启动
   * ------------------------------------------------------------------ */

  function boot() {
    try {
      global.dsv4p = new App();
    } catch (e) {
      if (global.console) console.error(e);
      W.blocker('启动失败', '<span class="mono small">' + (e && e.message ? e.message : e) + '</span>');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  D.App = App;
})(typeof window !== 'undefined' ? window : globalThis);
