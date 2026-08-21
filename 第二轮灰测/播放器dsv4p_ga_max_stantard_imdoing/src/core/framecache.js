/*!
 * src/core/framecache.js — 帧缓存：把一段范围逐帧抽成 ImageBitmap
 *
 * 为什么需要它：
 *  · 原生 <video> 的 seek 有代价，逐帧倒放/短循环会抖动；
 *  · 把循环区间预先解成位图后，可以做到 **真正帧精确** 的循环、倒放、乒乓、变速，
 *    并且拖动时间轴时瞬间出画（不再等 seek）。
 *  · 导出帧序列 / 逐帧检查也复用同一套抽帧逻辑。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util;

  var DEFAULT_BUDGET = 512 * 1024 * 1024; // 512MB 位图预算

  function FrameCache(engine) {
    D.Emitter.call(this);
    this.engine = engine;
    this.frames = Object.create(null); // frameIndex -> ImageBitmap
    this.inFrame = 0;
    this.outFrame = -1;
    this.count = 0;
    this.width = 0;
    this.height = 0;
    this.scale = 1;
    this.bytes = 0;
    this.building = false;
    this._abort = false;
    this._canvas = null;
    this._ctx = null;
  }
  FrameCache.prototype = Object.create(D.Emitter.prototype);
  FrameCache.prototype.constructor = FrameCache;

  /** 按分辨率与预算算出能缓存多少帧 */
  FrameCache.prototype.capacityFor = function (w, h, scale, budgetBytes) {
    var bw = Math.max(1, Math.round(w * scale)), bh = Math.max(1, Math.round(h * scale));
    var per = bw * bh * 4;
    return Math.max(1, Math.floor((budgetBytes || DEFAULT_BUDGET) / per));
  };

  FrameCache.prototype.has = function (i) { return this.frames[i] !== undefined; };
  FrameCache.prototype.get = function (i) { return this.frames[i] || null; };
  FrameCache.prototype.covers = function (i) { return i >= this.inFrame && i <= this.outFrame && this.has(i); };
  FrameCache.prototype.ready = function () { return this.count > 0 && !this.building; };

  /**
   * 建立缓存
   * @param {number} a 起始帧
   * @param {number} b 结束帧（含）
   * @param {{scale?:number, budget?:number, onProgress?:function}} [opts]
   */
  FrameCache.prototype.build = function (a, b, opts) {
    var self = this;
    opts = opts || {};
    if (this.building) return Promise.reject(new Error('缓存正在构建中'));
    var eng = this.engine;
    if (!eng.ready) return Promise.reject(new Error('尚未加载视频'));

    this.clear();
    this.building = true;
    this._abort = false;
    this.scale = U.clamp(opts.scale || 1, 0.1, 1);

    var lo = eng.clock.clampFrame(Math.min(a, b));
    var hi = eng.clock.clampFrame(Math.max(a, b));
    var vw = eng.video.videoWidth || eng.media.width || 640;
    var vh = eng.video.videoHeight || eng.media.height || 360;
    var cap = this.capacityFor(vw, vh, this.scale, opts.budget);
    var wanted = hi - lo + 1;
    var limited = false;
    if (wanted > cap) { hi = lo + cap - 1; wanted = cap; limited = true; }

    this.width = Math.max(1, Math.round(vw * this.scale));
    this.height = Math.max(1, Math.round(vh * this.scale));
    this.inFrame = lo;
    this.outFrame = lo - 1;

    if (this.scale !== 1) {
      this._canvas = document.createElement('canvas');
      this._canvas.width = this.width;
      this._canvas.height = this.height;
      this._ctx = this._canvas.getContext('2d');
    }

    var wasPlaying = eng.playing || eng.stepped.active;
    eng.pause();

    var i = lo;
    var t0 = global.performance ? performance.now() : Date.now();

    function grabOne() {
      if (self._abort) return Promise.resolve();
      if (i > hi) return Promise.resolve();
      return eng.seekFrame(i, { verify: true }).then(function (res) {
        if (self._abort) return;
        return self._grab(eng.video).then(function (bmp) {
          if (self._abort) { if (bmp && bmp.close) bmp.close(); return; }
          // 用「实际落到的帧」作为键，保证键与画面严格对应
          var key = res && res.frame != null ? res.frame : i;
          if (self.frames[key] === undefined) {
            self.frames[key] = bmp;
            self.count++;
            self.bytes += self.width * self.height * 4;
            if (key > self.outFrame) self.outFrame = key;
          } else if (bmp && bmp.close) {
            bmp.close();
          }
          self.emit('progress', {
            done: i - lo + 1, total: wanted, frame: i,
            exact: res ? res.exact : true,
            bytes: self.bytes
          });
          i++;
          return grabOne();
        });
      });
    }

    return grabOne().then(function () {
      self.building = false;
      var ms = (global.performance ? performance.now() : Date.now()) - t0;
      var info = {
        inFrame: self.inFrame, outFrame: self.outFrame, count: self.count,
        bytes: self.bytes, ms: ms, limited: limited, capacity: cap,
        width: self.width, height: self.height, scale: self.scale,
        aborted: self._abort
      };
      self.emit('built', info);
      if (wasPlaying) { /* 交给上层决定是否继续播放 */ }
      return info;
    }).catch(function (err) {
      self.building = false;
      self.emit('error', err);
      throw err;
    });
  };

  FrameCache.prototype._grab = function (video) {
    var self = this;
    if (this.scale !== 1 && this._ctx) {
      this._ctx.drawImage(video, 0, 0, this.width, this.height);
      return createImageBitmap(this._canvas);
    }
    // 直接从 video 抓帧（Chrome / Firefox / Edge 均支持）
    return createImageBitmap(video).catch(function () {
      // 兜底：走 canvas
      if (!self._canvas) {
        self._canvas = document.createElement('canvas');
        self._canvas.width = self.width;
        self._canvas.height = self.height;
        self._ctx = self._canvas.getContext('2d');
      }
      self._ctx.drawImage(video, 0, 0, self.width, self.height);
      return createImageBitmap(self._canvas);
    });
  };

  FrameCache.prototype.abort = function () { this._abort = true; };

  FrameCache.prototype.clear = function () {
    var keys = Object.keys(this.frames);
    for (var i = 0; i < keys.length; i++) {
      var b = this.frames[keys[i]];
      if (b && b.close) { try { b.close(); } catch (e) {} }
    }
    this.frames = Object.create(null);
    this.count = 0;
    this.bytes = 0;
    this.outFrame = this.inFrame - 1;
    this._canvas = null;
    this._ctx = null;
    this.emit('cleared', {});
  };

  FrameCache.prototype.info = function () {
    return {
      ready: this.ready(), building: this.building,
      inFrame: this.inFrame, outFrame: this.outFrame, count: this.count,
      bytes: this.bytes, width: this.width, height: this.height, scale: this.scale
    };
  };

  /* ------------------------------------------------------------------ *
   * 从缓存播放：帧精确、可倒放、可乒乓、可任意步进帧率
   * ------------------------------------------------------------------ */

  function CachePlayer(cache, engine) {
    D.Emitter.call(this);
    this.cache = cache;
    this.engine = engine;
    this.active = false;
    this.frame = 0;
    this.dir = 1;
    this.fps = 24;
    this.mode = 'loop'; // loop | pingpong | once
    this._raf = 0;
    this._acc = 0;
    this._last = 0;
    this.wraps = 0;
  }
  CachePlayer.prototype = Object.create(D.Emitter.prototype);
  CachePlayer.prototype.constructor = CachePlayer;

  CachePlayer.prototype.start = function (opts) {
    opts = opts || {};
    if (!this.cache.ready()) return false;
    this.engine.pause();
    this.fps = U.clamp(opts.fps || this.engine.clock.fps || 24, 0.25, 240);
    this.dir = opts.dir < 0 ? -1 : 1;
    this.mode = opts.mode || 'loop';
    this.wraps = 0;
    var start = opts.from != null ? opts.from : this.engine.frame;
    this.frame = U.clamp(start, this.cache.inFrame, this.cache.outFrame) | 0;
    if (!this.cache.has(this.frame)) this.frame = this.cache.inFrame;
    this.active = true;
    this._acc = 0;
    this._last = global.performance ? performance.now() : Date.now();
    var self = this;
    var tick = function () {
      if (!self.active) return;
      self._raf = requestAnimationFrame(tick);
      self._advance();
    };
    this._raf = requestAnimationFrame(tick);
    this.emit('start', { frame: this.frame, fps: this.fps, dir: this.dir, mode: this.mode });
    return true;
  };

  CachePlayer.prototype._advance = function () {
    var now = global.performance ? performance.now() : Date.now();
    var dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > 0.5) dt = 1 / this.fps; // 掉出后台后不追赶
    var rate = Math.max(0.0625, this.engine.rate);
    this._acc += dt * this.fps * rate;
    var steps = Math.floor(this._acc);
    if (steps <= 0) return;
    this._acc -= steps;
    if (steps > 8) steps = 8;
    for (var s = 0; s < steps; s++) this._step();
    this.emit('frame', { frame: this.frame });
  };

  CachePlayer.prototype._step = function () {
    var lo = this.cache.inFrame, hi = this.cache.outFrame;
    var n = this.frame + this.dir;
    if (n > hi) {
      this.wraps++;
      if (this.mode === 'pingpong') { this.dir = -1; n = Math.max(lo, hi - 1); }
      else if (this.mode === 'loop') { n = lo; }
      else { this.stop(); this.emit('end', {}); return; }
      this.emit('wrap', { wraps: this.wraps });
    } else if (n < lo) {
      this.wraps++;
      if (this.mode === 'pingpong') { this.dir = 1; n = Math.min(hi, lo + 1); }
      else if (this.mode === 'loop') { n = hi; }
      else { this.stop(); this.emit('end', {}); return; }
      this.emit('wrap', { wraps: this.wraps });
    }
    this.frame = n;
  };

  /** 停止；默认把 <video> 同步到当前缓存帧，保证界面与音轨位置一致 */
  CachePlayer.prototype.stop = function (sync) {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (!this.active) return Promise.resolve();
    this.active = false;
    this.emit('stop', { frame: this.frame });
    if (sync === false) return Promise.resolve();
    return this.engine.seekFrame(this.frame, { verify: true });
  };

  D.FrameCache = FrameCache;
  D.CachePlayer = CachePlayer;
})(typeof window !== 'undefined' ? window : globalThis);
