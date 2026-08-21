/*!
 * src/core/player.js — 播放引擎：帧级步进、可验证的精确定位、帧精确循环、逐帧倒放
 *
 * 精度策略（重点）：
 *  1. 帧号一律通过 FrameClock 由「显示时间戳」换算，不用 currentTime 直接估算；
 *     有 rVFC 时使用 metadata.mediaTime（这是当前显示帧的精确 PTS，比 currentTime 更可靠）。
 *  2. seekFrame() 是「带验证」的：seek 后检查实际落在哪一帧，若不对则按帧长做偏置重试，
 *     最多 4 次。这样即使容器时间戳与解码器行为略有差异，也能稳定落到目标帧。
 *  3. 循环用帧号比较（frame >= outFrame 立刻回卷），保证「绝不多播一帧」；
 *     另配一个 setTimeout 兜底，处理后台标签页里 rVFC 被节流的情况。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util;

  var SEEK_TIMEOUT = 4000;

  function VideoEngine(video) {
    D.Emitter.call(this);
    this.video = video;
    this.clock = new D.FrameClock();
    this.media = null;

    this.frame = 0;
    this.time = 0;
    this.frameToken = 0;        // 每呈现一帧自增，渲染层用它判断「需要重新上传纹理」
    this.presented = 0;
    this.dropped = 0;
    this.decodeMs = 0;

    this.playing = false;
    this.seeking = false;
    this.ready = false;
    this.rate = 1;

    this.loop = { enabled: false, inFrame: 0, outFrame: 0, mode: 'loop', count: 0, wraps: 0 };
    this.dir = 1;

    this.stepped = { active: false, fps: 12, dir: 1 };
    this._stepTimer = 0;
    this._stepNext = 0;
    this._rvfcId = 0;
    this._rafId = 0;
    this._loopTimer = 0;
    this._seekJob = null;
    this._objectUrl = null;
    this._lastPresented = -1;

    this._bind();
  }
  VideoEngine.prototype = Object.create(D.Emitter.prototype);
  VideoEngine.prototype.constructor = VideoEngine;

  /* ------------------------------------------------------------------ *
   * 加载
   * ------------------------------------------------------------------ */

  VideoEngine.prototype._bind = function () {
    var self = this, v = this.video;
    v.addEventListener('play', function () { self.playing = true; self._armLoopBackstop(); self.emit('state', self.snapshot()); });
    v.addEventListener('pause', function () { self.playing = false; self._clearLoopBackstop(); self.emit('state', self.snapshot()); });
    v.addEventListener('ratechange', function () { self.rate = v.playbackRate; self.emit('state', self.snapshot()); });
    v.addEventListener('volumechange', function () { self.emit('state', self.snapshot()); });
    v.addEventListener('seeking', function () { self.seeking = true; });
    v.addEventListener('seeked', function () { self.seeking = false; self._tick(null); });
    v.addEventListener('ended', function () { self._onEnded(); });
    v.addEventListener('error', function () {
      var e = v.error;
      var msg = '视频加载失败';
      if (e) {
        var m = {
          1: '加载被中止 (MEDIA_ERR_ABORTED)',
          2: '网络错误 (MEDIA_ERR_NETWORK)',
          3: '解码失败 (MEDIA_ERR_DECODE)：文件可能损坏',
          4: '浏览器不支持该编码/容器 (MEDIA_ERR_SRC_NOT_SUPPORTED)'
        };
        msg = m[e.code] || msg;
      }
      self.emit('error', { message: msg });
    });
  };

  /**
   * 打开媒体
   * @param {{file?:File, url?:string, name?:string}} src
   * @returns {Promise<object>} media 信息
   */
  VideoEngine.prototype.open = function (src) {
    var self = this, v = this.video;
    this.stopStepped();
    this._clearLoopBackstop();
    this.ready = false;
    this.dropped = 0;
    this.presented = 0;
    this._lastPresented = -1;
    this.clock.resetObservation();

    if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} this._objectUrl = null; }

    var url, name, size = 0, type = '';
    if (src.file) {
      url = URL.createObjectURL(src.file);
      this._objectUrl = url;
      name = src.file.name;
      size = src.file.size;
      type = src.file.type || '';
    } else {
      url = src.url;
      name = src.name || String(url).split('/').pop().split('?')[0] || 'video';
    }

    this.media = { name: name, size: size, type: type, url: url, isLocal: !!src.file };
    this.emit('loading', this.media);

    // 容器索引（仅本地文件；网络 URL 不做 range 读取以免二次下载）
    var indexPromise = src.file
      ? D.Mp4Index.fromBlob(src.file)
      : Promise.resolve(null);

    // crossOrigin 只对真正的远程 http(s) 资源有意义：
    //   · blob:（文件选择器/拖放）本身同源，加了反而多一次无意义的 CORS 检查
    //   · file:// 下 CORS 请求必然失败，绝不能加
    if (/^https?:/i.test(url)) v.crossOrigin = 'anonymous';
    else v.removeAttribute('crossorigin');

    var metaPromise = new Promise(function (resolve, reject) {
      var done = false;
      function ok() {
        if (done) return;
        done = true;
        cleanup();
        resolve();
      }
      function fail() {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('无法读取视频元数据（编码可能不被浏览器支持）'));
      }
      function cleanup() {
        v.removeEventListener('loadeddata', ok);
        v.removeEventListener('error', fail);
      }
      v.addEventListener('loadeddata', ok);
      v.addEventListener('error', fail);
      v.src = url;
      v.load();
    });

    return metaPromise.then(function () {
      return indexPromise;
    }).then(function (idx) {
      var vw = v.videoWidth, vh = v.videoHeight;
      if (idx && idx.frameCount > 1) {
        self.clock.setIndex(idx);
        // 容器时长与解码器时长取较可信者
        if (isFinite(v.duration) && v.duration > 0) {
          self.clock.duration = Math.max(self.clock.duration, v.duration);
        }
      } else {
        var guess = 30;
        self.clock.setCfr(guess, isFinite(v.duration) ? v.duration : 0, 'assumed');
      }
      self.media.width = vw;
      self.media.height = vh;
      self.media.index = idx || null;
      self.ready = true;
      self.frame = 0;
      self.time = 0;
      self.loop.enabled = false;
      self.loop.inFrame = 0;
      self.loop.outFrame = Math.max(0, self.clock.frameCount - 1);
      self.loop.wraps = 0;
      self._startPump();
      self.emit('load', { media: self.media, clock: self.clock.describe() });
      return self.seekFrame(0, { verify: false }).then(function () { return self.media; });
    });
  };

  /* ------------------------------------------------------------------ *
   * 帧泵：rVFC 优先，退化到 rAF
   * ------------------------------------------------------------------ */

  VideoEngine.prototype._startPump = function () {
    var self = this, v = this.video;
    this._stopPump();
    if (D.caps.rvfc) {
      var cb = function (now, meta) {
        self._rvfcId = v.requestVideoFrameCallback(cb);
        self._tick(meta);
      };
      this._rvfcId = v.requestVideoFrameCallback(cb);
    } else {
      var loop = function () {
        self._rafId = requestAnimationFrame(loop);
        self._tick(null);
      };
      this._rafId = requestAnimationFrame(loop);
    }
  };

  VideoEngine.prototype._stopPump = function () {
    if (this._rvfcId && this.video.cancelVideoFrameCallback) {
      try { this.video.cancelVideoFrameCallback(this._rvfcId); } catch (e) {}
    }
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rvfcId = 0;
    this._rafId = 0;
  };

  VideoEngine.prototype._tick = function (meta) {
    var v = this.video;
    var mediaTime = meta && isFinite(meta.mediaTime) ? meta.mediaTime : v.currentTime;
    if (!isFinite(mediaTime)) return;

    if (meta) {
      if (meta.presentedFrames != null) {
        if (this._lastPresented >= 0 && this.playing) {
          var d = meta.presentedFrames - this._lastPresented;
          if (d > 1) this.dropped += (d - 1);
        }
        this._lastPresented = meta.presentedFrames;
        this.presented = meta.presentedFrames;
      }
      if (meta.processingDuration != null) this.decodeMs = meta.processingDuration * 1000;
    }

    if (this.playing && this.clock.mode === 'cfr') {
      if (this.clock.observe(mediaTime)) this.emit('clock', this.clock.describe());
    }

    var changed = Math.abs(mediaTime - this.time) > 1e-9;
    this.time = mediaTime;
    var f = this.clock.frameAtTime(mediaTime);
    var frameChanged = f !== this.frame;
    this.frame = f;
    if (changed || frameChanged) this.frameToken++;

    this.emit('frame', { frame: f, time: mediaTime, changed: frameChanged, meta: meta || null });
    if (frameChanged || changed) this._enforceLoop();
  };

  /** 强制通知渲染层刷新（例如滤镜参数变化时不需要，但换源/尺寸变化时需要） */
  VideoEngine.prototype.invalidate = function () { this.frameToken++; };

  /* ------------------------------------------------------------------ *
   * 定位
   * ------------------------------------------------------------------ */

  /** 等待一次 seek 完成（seeked 事件 + 一帧呈现） */
  VideoEngine.prototype._awaitSeek = function () {
    var self = this, v = this.video;
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { finish(); }, SEEK_TIMEOUT);
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        v.removeEventListener('seeked', onSeeked);
        resolve();
      }
      function onSeeked() {
        v.removeEventListener('seeked', onSeeked);
        // 再等一帧真正呈现，这样 mediaTime 才是最终落点
        if (D.caps.rvfc && v.requestVideoFrameCallback) {
          var guard = setTimeout(finish, 400);
          v.requestVideoFrameCallback(function () { clearTimeout(guard); finish(); });
        } else {
          setTimeout(finish, 32);
        }
      }
      if (!v.seeking) {
        // 有些浏览器在赋值极小差异时不会触发 seeking/seeked
        setTimeout(function () { if (!v.seeking) finish(); else v.addEventListener('seeked', onSeeked); }, 16);
      } else {
        v.addEventListener('seeked', onSeeked);
      }
    });
  };

  /** 精确定位到时间（秒） */
  VideoEngine.prototype.seekTime = function (t, opts) {
    var self = this;
    opts = opts || {};
    var dur = this.clock.duration || this.video.duration || 0;
    t = U.clamp(t, 0, dur > 0 ? Math.max(0, dur - 1e-4) : 1e9);
    this.video.currentTime = t;
    this.emit('seekstart', { time: t });
    return this._awaitSeek().then(function () {
      self._tick(null);
      self.emit('seekend', { time: self.time, frame: self.frame });
      return self.time;
    });
  };

  /**
   * 定位到指定帧，并验证真的落在该帧上
   * @param {number} i 帧号
   * @param {{verify?:boolean, maxTries?:number}} [opts]
   * @returns {Promise<{frame:number, time:number, tries:number, exact:boolean}>}
   */
  VideoEngine.prototype.seekFrame = function (i, opts) {
    var self = this;
    opts = opts || {};
    var verify = opts.verify !== false;
    var maxTries = opts.maxTries || 4;
    var target = this.clock.clampFrame(i);
    var bias = 0;
    var tries = 0;

    // 串行化：避免多次 seek 互相打断
    var run = function () {
      tries++;
      var t = self.clock.seekTargetForFrame(target) + bias;
      var dur = self.clock.duration || self.video.duration || 0;
      t = U.clamp(t, 0, dur > 0 ? Math.max(0, dur - 1e-4) : 1e9);
      self.video.currentTime = t;
      return self._awaitSeek().then(function () {
        self._tick(null);
        var landed = self.frame;
        if (!verify || landed === target || tries >= maxTries) {
          self.emit('seekend', { time: self.time, frame: landed, target: target, tries: tries });
          return { frame: landed, time: self.time, tries: tries, exact: landed === target };
        }
        var delta = target - landed;
        var fd = self.clock.frameDuration(target);
        bias += delta * fd * (1 + 0.25 * tries);
        // 落点已经很接近但一直差一帧时，额外往区间中心推一点
        if (Math.abs(delta) === 1) bias += delta * fd * 0.15;
        return run();
      });
    };

    var chain = this._seekJob ? this._seekJob.then(run, run) : run();
    this._seekJob = chain.catch(function () {});
    return chain;
  };

  /** 步进 n 帧（n 可负）；会自动暂停 */
  VideoEngine.prototype.step = function (n) {
    this.pause();
    return this.seekFrame(this.frame + (n || 1), { verify: true });
  };

  /** 跳到上/下一个关键帧 */
  VideoEngine.prototype.stepKeyframe = function (dir) {
    var k = dir > 0 ? this.clock.nextKeyframe(this.frame) : this.clock.prevKeyframe(Math.max(0, this.frame - 1));
    if (k == null) return Promise.resolve(null);
    this.pause();
    return this.seekFrame(k, { verify: true });
  };

  /* ------------------------------------------------------------------ *
   * 播放控制
   * ------------------------------------------------------------------ */

  VideoEngine.prototype.play = function () {
    if (!this.ready) return Promise.resolve();
    this.stopStepped();
    // 如果正好停在循环末端，先回到入点，避免立刻触发回卷
    if (this.loop.enabled && this.frame >= this.loop.outFrame) {
      var self = this;
      return this.seekFrame(this.loop.inFrame, { verify: false }).then(function () { return self.video.play(); });
    }
    if (this.clock.frameCount > 0 && this.frame >= this.clock.frameCount - 1 && !this.loop.enabled) {
      var s2 = this;
      return this.seekFrame(0, { verify: false }).then(function () { return s2.video.play(); });
    }
    return this.video.play() || Promise.resolve();
  };

  VideoEngine.prototype.pause = function () {
    this.stopStepped();
    if (!this.video.paused) this.video.pause();
  };

  VideoEngine.prototype.toggle = function () {
    if (this.playing || this.stepped.active) this.pause();
    else this.play();
  };

  VideoEngine.prototype.setRate = function (r) {
    r = U.clamp(r, 0.0625, 16);
    this.rate = r;
    try { this.video.playbackRate = r; } catch (e) {}
    if (this.stepped.active) this._scheduleStep(true);
    return r;
  };

  VideoEngine.prototype.setMuted = function (m) { this.video.muted = !!m; };
  VideoEngine.prototype.setVolume = function (v) { this.video.volume = U.clamp(v, 0, 1); };

  /* ------------------------------------------------------------------ *
   * 逐帧播放（定格动画 / 倒放）
   * ------------------------------------------------------------------ */

  /**
   * 启动逐帧播放模式：按给定「步进帧率」逐帧 seek，可负向倒放。
   * 原生 <video> 无法倒放，这是唯一可靠的做法。
   */
  VideoEngine.prototype.startStepped = function (fps, dir) {
    if (!this.ready) return;
    if (!this.video.paused) this.video.pause();
    this.stepped.active = true;
    this.stepped.fps = U.clamp(fps || this.clock.fps || 12, 0.25, 120);
    this.stepped.dir = dir < 0 ? -1 : 1;
    this.dir = this.stepped.dir;
    this._stepNext = (global.performance ? performance.now() : Date.now());
    this.emit('state', this.snapshot());
    this._scheduleStep(true);
  };

  VideoEngine.prototype.stopStepped = function () {
    if (this._stepTimer) { clearTimeout(this._stepTimer); this._stepTimer = 0; }
    if (this.stepped.active) {
      this.stepped.active = false;
      this.emit('state', this.snapshot());
    }
  };

  VideoEngine.prototype._scheduleStep = function (immediate) {
    var self = this;
    if (!this.stepped.active) return;
    if (this._stepTimer) { clearTimeout(this._stepTimer); this._stepTimer = 0; }
    var now = global.performance ? performance.now() : Date.now();
    var interval = 1000 / (this.stepped.fps * Math.max(0.0625, this.rate));
    if (immediate) this._stepNext = now;
    var delay = Math.max(0, this._stepNext - now);
    this._stepTimer = setTimeout(function () {
      self._stepNext += interval;
      // 落后太多时重新对齐，避免追赶风暴
      var t = global.performance ? performance.now() : Date.now();
      if (self._stepNext < t - interval * 3) self._stepNext = t + interval;
      self._doStep();
    }, delay);
  };

  VideoEngine.prototype._doStep = function () {
    var self = this;
    if (!this.stepped.active) return;
    var next = this.frame + this.stepped.dir;
    var lo = this.loop.enabled ? this.loop.inFrame : 0;
    var hi = this.loop.enabled ? this.loop.outFrame : Math.max(0, this.clock.frameCount - 1);

    if (next > hi) {
      if (this.loop.enabled && this.loop.mode === 'pingpong') { this.stepped.dir = -1; this.dir = -1; next = Math.max(lo, hi - 1); this._countWrap(); }
      else if (this.loop.enabled && this.loop.mode === 'loop') { next = lo; this._countWrap(); }
      else { this.stopStepped(); this.emit('ended', {}); return; }
    } else if (next < lo) {
      if (this.loop.enabled && this.loop.mode === 'pingpong') { this.stepped.dir = 1; this.dir = 1; next = Math.min(hi, lo + 1); this._countWrap(); }
      else if (this.loop.enabled && this.loop.mode === 'loop') { next = hi; this._countWrap(); }
      else { this.stopStepped(); this.emit('ended', {}); return; }
    }
    if (!this.stepped.active) return;

    this.seekFrame(next, { verify: true, maxTries: 2 }).then(function () {
      self._scheduleStep(false);
    }, function () {
      self._scheduleStep(false);
    });
  };

  /* ------------------------------------------------------------------ *
   * 循环
   * ------------------------------------------------------------------ */

  /** 设置循环（部分字段更新） */
  VideoEngine.prototype.setLoop = function (patch) {
    var L = this.loop;
    if (patch.inFrame != null) L.inFrame = this.clock.clampFrame(patch.inFrame);
    if (patch.outFrame != null) L.outFrame = this.clock.clampFrame(patch.outFrame);
    if (L.outFrame < L.inFrame) { var t = L.inFrame; L.inFrame = L.outFrame; L.outFrame = t; }
    if (patch.mode) L.mode = patch.mode;
    if (patch.count != null) L.count = Math.max(0, patch.count | 0);
    if (patch.enabled != null) L.enabled = !!patch.enabled;
    if (patch.resetWraps) L.wraps = 0;
    this._armLoopBackstop();
    this.emit('loopchange', this.loopInfo());
    return this.loopInfo();
  };

  VideoEngine.prototype.loopInfo = function () {
    var L = this.loop;
    return {
      enabled: L.enabled, mode: L.mode, count: L.count, wraps: L.wraps,
      inFrame: L.inFrame, outFrame: L.outFrame,
      inTime: this.clock.timeOfFrame(L.inFrame),
      outTime: this.clock.timeOfFrame(L.outFrame),
      outTimeEnd: this.clock.endOfFrame(L.outFrame),
      frames: L.outFrame - L.inFrame + 1,
      seconds: this.clock.endOfFrame(L.outFrame) - this.clock.timeOfFrame(L.inFrame)
    };
  };

  VideoEngine.prototype.clearLoop = function () {
    return this.setLoop({ enabled: false, inFrame: 0, outFrame: Math.max(0, this.clock.frameCount - 1), resetWraps: true });
  };

  VideoEngine.prototype._countWrap = function () {
    this.loop.wraps++;
    this.emit('loop', this.loopInfo());
    if (this.loop.count > 0 && this.loop.wraps >= this.loop.count) {
      this.loop.enabled = false;
      this.pause();
      this.emit('loopdone', this.loopInfo());
    }
  };

  VideoEngine.prototype._enforceLoop = function () {
    var L = this.loop;
    if (!L.enabled || this.seeking) return;
    if (this.stepped.active) return; // 逐帧模式在 _doStep 内处理
    if (!this.playing) return;

    if (this.frame > L.outFrame || (this.frame === L.outFrame && this._pastOutFrame())) {
      var self = this;
      if (L.mode === 'once') {
        this.pause();
        this._countWrap();
        return;
      }
      if (L.mode === 'pingpong') {
        // 原生播放无法倒放：切到逐帧倒放
        this._countWrap();
        if (L.enabled) this.startStepped(this.clock.fps, -1);
        return;
      }
      // 普通循环
      this._countWrap();
      if (!L.enabled) return;
      this.seekFrame(L.inFrame, { verify: false }).then(function () {
        if (self.loop.enabled && !self.video.paused) self._armLoopBackstop();
      });
    } else if (this.frame < L.inFrame - 1) {
      // 用户跳到入点之前又开着循环：拉回入点
      this.seekFrame(L.inFrame, { verify: false });
    }
  };

  /** 出点帧是否已经播完（用于「播满出点帧再回卷」） */
  VideoEngine.prototype._pastOutFrame = function () {
    var end = this.clock.endOfFrame(this.loop.outFrame);
    // 留半帧余量：rVFC 通常在帧刚呈现时回调，等它接近帧尾再回卷
    return this.time >= end - this.clock.frameDuration(this.loop.outFrame) * 0.5;
  };

  /** 后台标签页里 rVFC 会被节流，用定时器兜底防止播过出点 */
  VideoEngine.prototype._armLoopBackstop = function () {
    var self = this;
    this._clearLoopBackstop();
    if (!this.loop.enabled || this.video.paused) return;
    var remain = this.clock.endOfFrame(this.loop.outFrame) - this.video.currentTime;
    var ms = Math.max(20, (remain / Math.max(0.0625, this.rate)) * 1000 + 40);
    this._loopTimer = setTimeout(function () {
      self._loopTimer = 0;
      if (!self.loop.enabled || self.video.paused) return;
      var f = self.clock.frameAtTime(self.video.currentTime);
      if (f >= self.loop.outFrame) {
        self.frame = f;
        self.time = self.video.currentTime;
        self._enforceLoop();
      } else {
        self._armLoopBackstop();
      }
    }, ms);
  };

  VideoEngine.prototype._clearLoopBackstop = function () {
    if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = 0; }
  };

  VideoEngine.prototype._onEnded = function () {
    this.playing = false;
    if (this.loop.enabled && this.loop.mode !== 'once') {
      var self = this;
      this._countWrap();
      if (this.loop.enabled) {
        this.seekFrame(this.loop.inFrame, { verify: false }).then(function () { self.video.play(); });
      }
      return;
    }
    this.emit('ended', {});
    this.emit('state', this.snapshot());
  };

  /* ------------------------------------------------------------------ *
   * 状态快照
   * ------------------------------------------------------------------ */

  VideoEngine.prototype.snapshot = function () {
    return {
      ready: this.ready,
      playing: this.playing,
      stepped: this.stepped.active,
      steppedDir: this.stepped.dir,
      steppedFps: this.stepped.fps,
      rate: this.rate,
      muted: this.video.muted,
      volume: this.video.volume,
      frame: this.frame,
      time: this.time,
      frameCount: this.clock.frameCount,
      duration: this.clock.duration,
      dropped: this.dropped,
      loop: this.loopInfo()
    };
  };

  VideoEngine.prototype.dispose = function () {
    this._stopPump();
    this.stopStepped();
    this._clearLoopBackstop();
    if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} }
  };

  D.VideoEngine = VideoEngine;
})(typeof window !== 'undefined' ? window : globalThis);
