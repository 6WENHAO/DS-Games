/*!
 * src/core/frameclock.js — 帧 ↔ 时间 的双向映射（帧级操作的核心）
 *
 * 两种工作模式：
 *   index —— 有 MP4 采样表索引：逐帧精确时间戳，支持 VFR，帧号绝对可靠
 *   cfr   —— 无索引（如 WebM）：用 rVFC 观测出的帧率建立恒定帧率模型
 *
 * 关键约定：
 *   frame i 的显示区间为 [timeOfFrame(i), endOfFrame(i))
 *   seekTargetForFrame(i) 返回该区间内的「最稳落点」（靠近中点），
 *   这样即使浏览器 seek 有 ±半帧误差也不会落到邻帧。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util;
  var TC = D.TC;

  var EPS = 1e-6;

  function FrameClock() {
    this.mode = 'cfr';
    this.fps = 25;
    this.nominalFps = 25;
    this.duration = 0;
    this.frameCount = 0;
    this.vfr = false;
    this.times = null;      // Float64Array（index 模式）
    this.keyframes = null;  // Int32Array
    this.source = 'default';
    this.confidence = 0;    // 帧率置信度 0..1
    this._obs = [];         // rVFC 观测到的 mediaTime 序列
    this._lastObs = -1;
  }

  /** 使用容器索引（src/core/mp4index.js 的结果） */
  FrameClock.prototype.setIndex = function (idx) {
    this.mode = 'index';
    this.times = idx.times;
    this.keyframes = idx.keyframes && idx.keyframes.length ? idx.keyframes : null;
    this.frameCount = idx.frameCount;
    this.fps = idx.fps;
    this.nominalFps = TC.snapFps(idx.fps, 0.002);
    this.vfr = !!idx.vfr;
    this.duration = idx.duration;
    this.source = 'container(' + (idx.structure || 'mp4') + ')';
    this.confidence = 1;
    return this;
  };

  /** 使用恒定帧率模型 */
  FrameClock.prototype.setCfr = function (fps, duration, source) {
    this.mode = 'cfr';
    this.times = null;
    this.keyframes = null;
    this.fps = fps > 0 ? fps : 25;
    this.nominalFps = TC.snapFps(this.fps, 0.005);
    this.vfr = false;
    this.duration = duration > 0 && isFinite(duration) ? duration : 0;
    this.frameCount = this.duration > 0 ? Math.max(1, Math.round(this.duration * this.fps)) : 0;
    this.source = source || 'assumed';
    this.confidence = source === 'observed' ? 0.8 : 0.3;
    return this;
  };

  /** 用户手动指定帧率（会重算帧数） */
  FrameClock.prototype.overrideFps = function (fps) {
    if (!(fps > 0)) return this;
    if (this.mode === 'index') {
      // 索引模式下不允许破坏精确时间戳，只改「名义帧率」（影响时间码显示）
      this.nominalFps = fps;
      return this;
    }
    this.fps = fps;
    this.nominalFps = fps;
    this.frameCount = this.duration > 0 ? Math.max(1, Math.round(this.duration * fps)) : 0;
    this.source = 'manual';
    this.confidence = 1;
    return this;
  };

  FrameClock.prototype.clampFrame = function (i) {
    if (!isFinite(i)) return 0;
    i = Math.round(i);
    var max = Math.max(0, this.frameCount - 1);
    return i < 0 ? 0 : (i > max ? max : i);
  };

  /** 第 i 帧的显示起始时间（秒） */
  FrameClock.prototype.timeOfFrame = function (i) {
    i = this.clampFrame(i);
    if (this.mode === 'index' && this.times) return this.times[i];
    return i / this.fps;
  };

  /** 第 i 帧的结束时间（= 下一帧起点，末帧用时长兜底） */
  FrameClock.prototype.endOfFrame = function (i) {
    i = this.clampFrame(i);
    if (this.mode === 'index' && this.times) {
      if (i + 1 < this.frameCount) return this.times[i + 1];
      return this.duration > this.times[i] ? this.duration : this.times[i] + 1 / this.fps;
    }
    return (i + 1) / this.fps;
  };

  /** 第 i 帧的时长（秒），VFR 下逐帧不同 */
  FrameClock.prototype.frameDuration = function (i) {
    return Math.max(1e-6, this.endOfFrame(i) - this.timeOfFrame(i));
  };

  /** 时间 t 落在哪一帧（右开区间；越界会 clamp） */
  FrameClock.prototype.frameAtTime = function (t) {
    if (!isFinite(t)) return 0;
    if (this.mode === 'index' && this.times && this.frameCount > 0) {
      var i = U.lowerIndex(this.times, t + 1e-4, this.frameCount);
      return i < 0 ? 0 : i;
    }
    return this.clampFrame(Math.floor(t * this.fps + 1e-4));
  };

  /**
   * 给定帧号，返回赋给 video.currentTime 的最佳目标时间。
   * 取帧区间内偏中点的位置：既避开上一帧边界，也避开下一帧边界。
   */
  FrameClock.prototype.seekTargetForFrame = function (i) {
    i = this.clampFrame(i);
    var a = this.timeOfFrame(i), b = this.endOfFrame(i);
    var d = Math.max(1e-6, b - a);
    // 0.45 略偏前：某些解码器对「刚好中点」的边界处理不同，偏前更安全
    var t = a + d * 0.45;
    if (this.duration > 0) t = Math.min(t, Math.max(0, this.duration - 1e-4));
    return Math.max(0, t);
  };

  /** 该帧是否为关键帧（无 stss 信息时返回 null 表示未知） */
  FrameClock.prototype.isKeyframe = function (i) {
    if (!this.keyframes) return null;
    i = this.clampFrame(i);
    var k = U.lowerIndex(this.keyframes, i, this.keyframes.length);
    return k >= 0 && this.keyframes[k] === i;
  };

  /** <= i 的最近关键帧（无信息时返回 i） */
  FrameClock.prototype.prevKeyframe = function (i) {
    if (!this.keyframes) return this.clampFrame(i);
    var k = U.lowerIndex(this.keyframes, this.clampFrame(i), this.keyframes.length);
    return k < 0 ? 0 : this.keyframes[k];
  };

  /** > i 的最近关键帧（没有则返回 null） */
  FrameClock.prototype.nextKeyframe = function (i) {
    if (!this.keyframes) return null;
    var k = U.lowerIndex(this.keyframes, this.clampFrame(i), this.keyframes.length);
    var n = (k < 0 ? 0 : k + 1);
    return n < this.keyframes.length ? this.keyframes[n] : null;
  };

  /** 关键帧时间数组（时间轴绘制用） */
  FrameClock.prototype.keyframeTimes = function () {
    if (!this.keyframes) return null;
    var out = new Float64Array(this.keyframes.length);
    for (var i = 0; i < this.keyframes.length; i++) out[i] = this.timeOfFrame(this.keyframes[i]);
    return out;
  };

  /* ---------------- 无索引时的帧率学习 ---------------- */

  /**
   * 每次 rVFC 回调调用一次，观测 mediaTime 序列并推断帧率。
   * @returns {boolean} 帧率是否被更新
   */
  FrameClock.prototype.observe = function (mediaTime) {
    if (this.mode === 'index') return false;
    if (!isFinite(mediaTime)) return false;
    if (this._lastObs >= 0) {
      var d = mediaTime - this._lastObs;
      // 只接受正向、合理范围内的间隔（跳过 seek 造成的跳变）
      if (d > 1 / 1000 && d < 1 / 4) this._obs.push(d);
      if (this._obs.length > 90) this._obs.shift();
    }
    this._lastObs = mediaTime;
    if (this._obs.length < 12) return false;

    var med = U.median(this._obs);
    if (!(med > 0)) return false;
    var raw = 1 / med;
    // 稳定度：落在中位数 ±3% 内的样本比例
    var inliers = 0;
    for (var i = 0; i < this._obs.length; i++) if (Math.abs(this._obs[i] - med) / med < 0.03) inliers++;
    var stability = inliers / this._obs.length;
    var snapped = TC.snapFps(raw, 0.008);
    var changed = Math.abs(snapped - this.fps) / snapped > 1e-4;
    if (stability > 0.7 && this.confidence < 0.95) {
      this.fps = snapped;
      this.nominalFps = snapped;
      this.frameCount = this.duration > 0 ? Math.max(1, Math.round(this.duration * snapped)) : 0;
      this.source = 'observed(rVFC)';
      this.confidence = Math.min(0.95, 0.5 + stability * 0.45);
      return changed;
    }
    return false;
  };

  FrameClock.prototype.resetObservation = function () {
    this._obs.length = 0;
    this._lastObs = -1;
  };

  /** 供 UI 显示的摘要 */
  FrameClock.prototype.describe = function () {
    var f = this.fps;
    var pretty = Math.abs(f - Math.round(f)) < 1e-4 ? String(Math.round(f)) : f.toFixed(3);
    return {
      fps: f,
      fpsText: pretty + ' fps' + (this.vfr ? ' (VFR 平均)' : ''),
      frameCount: this.frameCount,
      duration: this.duration,
      mode: this.mode,
      source: this.source,
      confidence: this.confidence,
      keyframes: this.keyframes ? this.keyframes.length : 0
    };
  };

  D.FrameClock = FrameClock;
  if (typeof module !== 'undefined' && module.exports) module.exports = FrameClock;
})(typeof window !== 'undefined' ? window : globalThis);
