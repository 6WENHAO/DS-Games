/*!
 * src/ui/timeline.js — 时间轴：刻度、关键帧、循环区间、标记、缓存缩略图、拖动定位
 *
 * 交互：
 *   左键拖动      = 拖动播放头（有帧缓存时瞬间出画）
 *   Shift+拖动    = 直接框选循环区间
 *   拖动黄色手柄  = 调整循环入/出点
 *   滚轮          = 以光标为中心缩放；Shift+滚轮 = 平移
 *   双击          = 显示全部
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util;

  var C = {
    bg: '#0d0e13', bgAlt: '#101218', ruler: '#161922', text: '#8b94a6', textDim: '#5b6371',
    key: '#3d6d8f', keyLine: '#4f8fbb', loop: 'rgba(255,212,121,0.16)', loopEdge: '#ffd479',
    cache: 'rgba(138,255,193,0.15)', cacheEdge: '#8affc1',
    play: '#5cc8ff', marker: '#c6a0ff', grid: '#1c1f29', hover: 'rgba(255,255,255,0.08)'
  };

  var H_RULER = 18, H_KEYS = 12, H_TRACK = 30;

  function Timeline(canvas, app) {
    this.canvas = canvas;
    this.app = app;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.viewA = 0;         // 视图起始帧
    this.viewB = 100;       // 视图结束帧
    this.hoverFrame = null;
    this.drag = null;       // {type:'play'|'in'|'out'|'range'|'pan', ...}
    this.showKeyframes = true;
    this.showCache = true;
    this.thumbs = true;
    this._bind();
    this.resize();
  }

  Timeline.prototype.frameCount = function () {
    return Math.max(1, this.app.engine.clock.frameCount || 1);
  };

  Timeline.prototype.resize = function () {
    var cv = this.canvas;
    var rect = cv.getBoundingClientRect();
    this.dpr = Math.min(2.5, global.devicePixelRatio || 1);
    var w = Math.max(64, Math.round(rect.width * this.dpr));
    var hh = Math.max(48, Math.round(rect.height * this.dpr));
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    this.w = w;
    this.h = hh;
  };

  Timeline.prototype.fit = function () {
    this.viewA = 0;
    this.viewB = this.frameCount() - 1;
    if (this.viewB <= this.viewA) this.viewB = this.viewA + 1;
  };

  Timeline.prototype.clampView = function () {
    var n = this.frameCount();
    var span = Math.max(1, this.viewB - this.viewA);
    if (span > n - 1) { this.viewA = 0; this.viewB = Math.max(1, n - 1); return; }
    if (this.viewA < 0) { this.viewB -= this.viewA; this.viewA = 0; }
    if (this.viewB > n - 1) { this.viewA -= (this.viewB - (n - 1)); this.viewB = n - 1; }
    if (this.viewA < 0) this.viewA = 0;
  };

  Timeline.prototype.zoomAt = function (factor, atFrame) {
    var a = this.viewA, b = this.viewB;
    var span = Math.max(1, b - a);
    var newSpan = U.clamp(span * factor, 2, Math.max(2, this.frameCount() - 1));
    var t = (atFrame - a) / span;
    this.viewA = atFrame - t * newSpan;
    this.viewB = this.viewA + newSpan;
    this.clampView();
  };

  Timeline.prototype.pan = function (frames) {
    this.viewA += frames;
    this.viewB += frames;
    this.clampView();
  };

  Timeline.prototype.xOfFrame = function (f) {
    var span = Math.max(1e-6, this.viewB - this.viewA);
    return ((f - this.viewA) / span) * this.w;
  };

  Timeline.prototype.frameOfX = function (x) {
    var span = Math.max(1e-6, this.viewB - this.viewA);
    return this.viewA + (x / this.w) * span;
  };

  /* ------------------------------------------------------------------ *
   * 交互
   * ------------------------------------------------------------------ */

  Timeline.prototype._pos = function (ev) {
    var r = this.canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * this.dpr,
      y: (ev.clientY - r.top) * this.dpr
    };
  };

  Timeline.prototype._bind = function () {
    var self = this;
    var cv = this.canvas;

    cv.addEventListener('mousedown', function (ev) {
      var p = self._pos(ev);
      var f = self.frameOfX(p.x);
      var loop = self.app.engine.loop;
      var xin = self.xOfFrame(loop.inFrame), xout = self.xOfFrame(loop.outFrame + 1);
      var grab = 7 * self.dpr;

      if (ev.button === 1 || ev.altKey) {
        self.drag = { type: 'pan', x: p.x, a: self.viewA, b: self.viewB };
      } else if (ev.shiftKey) {
        var start = Math.round(f);
        self.drag = { type: 'range', start: start };
        self.app.engine.setLoop({ inFrame: start, outFrame: start, enabled: true });
      } else if (Math.abs(p.x - xin) < grab) {
        self.drag = { type: 'in' };
      } else if (Math.abs(p.x - xout) < grab) {
        self.drag = { type: 'out' };
      } else {
        self.drag = { type: 'play' };
        self.app.scrubStart();
        self.app.scrubTo(Math.round(f));
      }
      cv.setPointerCapture && ev.pointerId != null && cv.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });

    global.addEventListener('mousemove', function (ev) {
      var p = self._pos(ev);
      self.hoverFrame = self.frameOfX(p.x);
      if (!self.drag) return;
      var f = Math.round(self.frameOfX(p.x));
      if (self.drag.type === 'play') {
        self.app.scrubTo(f);
      } else if (self.drag.type === 'in') {
        self.app.engine.setLoop({ inFrame: f, enabled: true });
      } else if (self.drag.type === 'out') {
        self.app.engine.setLoop({ outFrame: f, enabled: true });
      } else if (self.drag.type === 'range') {
        var a = Math.min(self.drag.start, f), b = Math.max(self.drag.start, f);
        self.app.engine.setLoop({ inFrame: a, outFrame: b, enabled: true });
      } else if (self.drag.type === 'pan') {
        var span = self.drag.b - self.drag.a;
        var dx = (p.x - self.drag.x) / self.w * span;
        self.viewA = self.drag.a - dx;
        self.viewB = self.drag.b - dx;
        self.clampView();
      }
    });

    global.addEventListener('mouseup', function () {
      if (!self.drag) return;
      var t = self.drag.type;
      self.drag = null;
      if (t === 'play') self.app.scrubEnd();
    });

    cv.addEventListener('mouseleave', function () { self.hoverFrame = null; });

    cv.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var p = self._pos(ev);
      var f = self.frameOfX(p.x);
      if (ev.shiftKey) {
        self.pan((ev.deltaY > 0 ? 1 : -1) * Math.max(1, (self.viewB - self.viewA) * 0.08));
      } else {
        self.zoomAt(ev.deltaY > 0 ? 1.22 : 1 / 1.22, f);
      }
    }, { passive: false });

    cv.addEventListener('dblclick', function () { self.fit(); });
  };

  /* ------------------------------------------------------------------ *
   * 绘制
   * ------------------------------------------------------------------ */

  Timeline.prototype.draw = function () {
    var ctx = this.ctx, w = this.w, hh = this.h, dpr = this.dpr;
    var app = this.app, eng = app.engine, clock = eng.clock;
    if (!w || !hh) return;

    var rulerH = H_RULER * dpr, keysH = H_KEYS * dpr, trackH = H_TRACK * dpr;
    var trackY = rulerH + keysH;
    var thumbY = trackY + trackH;
    var thumbH = Math.max(0, hh - thumbY);

    ctx.save();
    ctx.clearRect(0, 0, w, hh);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, hh);

    if (!eng.ready) {
      ctx.fillStyle = C.textDim;
      ctx.font = (11 * dpr) + 'px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('未加载媒体', w / 2, hh / 2);
      ctx.restore();
      return;
    }

    var span = Math.max(1e-6, this.viewB - this.viewA);
    var pxPerFrame = w / span;

    /* --- 刻度 --- */
    ctx.fillStyle = C.ruler;
    ctx.fillRect(0, 0, w, rulerH);
    ctx.font = (10 * dpr) + 'px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    var fps = clock.fps || 25;
    // 选择合适的时间步长（秒）
    var steps = [1 / fps, 2 / fps, 5 / fps, 10 / fps, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    var stepSec = steps[steps.length - 1];
    for (var s = 0; s < steps.length; s++) {
      if (steps[s] * fps * pxPerFrame >= 58 * dpr) { stepSec = steps[s]; break; }
    }
    var stepFrames = Math.max(1, stepSec * fps);
    var firstTick = Math.ceil(this.viewA / stepFrames) * stepFrames;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (var f = firstTick; f <= this.viewB; f += stepFrames) {
      var x = Math.round(this.xOfFrame(f)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, hh);
      ctx.stroke();
      ctx.fillStyle = C.text;
      var label = pxPerFrame > 12 * dpr
        ? ('#' + Math.round(f))
        : D.TC.formatShort(clock.timeOfFrame(Math.round(f)), stepSec < 0.5 ? 2 : (stepSec < 5 ? 1 : 0));
      ctx.fillText(label, x + 3 * dpr, rulerH / 2);
    }

    // 单帧格（放得足够大时画出每一帧的边界）
    if (pxPerFrame > 6 * dpr) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      for (var fi = Math.ceil(this.viewA); fi <= this.viewB; fi++) {
        var fx = Math.round(this.xOfFrame(fi)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(fx, trackY);
        ctx.lineTo(fx, trackY + trackH);
        ctx.stroke();
      }
    }

    /* --- 关键帧 --- */
    if (this.showKeyframes && clock.keyframes) {
      ctx.fillStyle = C.key;
      ctx.fillRect(0, rulerH, w, keysH);
      ctx.fillStyle = C.keyLine;
      var kf = clock.keyframes;
      var lastX = -99;
      for (var k = 0; k < kf.length; k++) {
        var kx = this.xOfFrame(kf[k]);
        if (kx < -2 || kx > w + 2) continue;
        if (kx - lastX < 1.5) continue;
        lastX = kx;
        ctx.fillRect(Math.round(kx), rulerH, Math.max(1, dpr), keysH);
      }
      ctx.fillStyle = C.textDim;
      ctx.font = (9 * dpr) + 'px ui-monospace, monospace';
      ctx.fillText('I 帧 ' + kf.length, 4 * dpr, rulerH + keysH / 2);
    } else {
      ctx.fillStyle = C.bgAlt;
      ctx.fillRect(0, rulerH, w, keysH);
    }

    /* --- 主轨背景 --- */
    ctx.fillStyle = C.bgAlt;
    ctx.fillRect(0, trackY, w, trackH);

    /* --- 帧缓存区间 --- */
    var cache = app.cache;
    if (this.showCache && cache && cache.count > 0) {
      var cx1 = this.xOfFrame(cache.inFrame), cx2 = this.xOfFrame(cache.outFrame + 1);
      ctx.fillStyle = C.cache;
      ctx.fillRect(cx1, trackY, Math.max(1, cx2 - cx1), trackH);
      ctx.strokeStyle = C.cacheEdge;
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(cx1, trackY + trackH - dpr);
      ctx.lineTo(cx2, trackY + trackH - dpr);
      ctx.stroke();
    }

    /* --- 循环区间 --- */
    var loop = eng.loop;
    if (loop.outFrame > loop.inFrame || loop.enabled) {
      var lx1 = this.xOfFrame(loop.inFrame), lx2 = this.xOfFrame(loop.outFrame + 1);
      ctx.fillStyle = loop.enabled ? C.loop : 'rgba(255,212,121,0.07)';
      ctx.fillRect(lx1, trackY, Math.max(1, lx2 - lx1), trackH);
      ctx.strokeStyle = C.loopEdge;
      ctx.lineWidth = Math.max(1, 1.5 * dpr);
      ctx.globalAlpha = loop.enabled ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.round(lx1) + 0.5, trackY);
      ctx.lineTo(Math.round(lx1) + 0.5, trackY + trackH);
      ctx.moveTo(Math.round(lx2) + 0.5, trackY);
      ctx.lineTo(Math.round(lx2) + 0.5, trackY + trackH);
      ctx.stroke();
      // 手柄
      ctx.fillStyle = C.loopEdge;
      ctx.fillRect(Math.round(lx1) - 1, trackY, 3 * dpr, 7 * dpr);
      ctx.fillRect(Math.round(lx2) - 2 * dpr, trackY, 3 * dpr, 7 * dpr);
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.loopEdge;
      ctx.font = (9 * dpr) + 'px ui-monospace, monospace';
      var lbl = 'I ' + loop.inFrame + ' → O ' + loop.outFrame + '  (' + (loop.outFrame - loop.inFrame + 1) + '帧)';
      if (lx2 - lx1 > ctx.measureText(lbl).width + 12 * dpr) {
        ctx.fillText(lbl, lx1 + 5 * dpr, trackY + trackH - 6 * dpr);
      }
    }

    /* --- 缓存缩略图 --- */
    if (this.thumbs && thumbH > 6 && cache && cache.count > 0) {
      var tw = Math.max(8, Math.round(thumbH * (cache.width / Math.max(1, cache.height))));
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, thumbY, w, thumbH);
      ctx.clip();
      ctx.globalAlpha = 0.9;
      for (var tx = 0; tx < w; tx += tw) {
        var tf = Math.round(this.frameOfX(tx + tw / 2));
        var bmp = cache.get(tf);
        if (bmp) {
          try { ctx.drawImage(bmp, tx, thumbY, tw, thumbH); } catch (e) {}
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (thumbH > 6) {
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, thumbY, w, thumbH);
      ctx.fillStyle = C.textDim;
      ctx.font = (9 * dpr) + 'px ui-monospace, monospace';
      ctx.fillText('构建帧缓存后这里会显示缩略图条', 6 * dpr, thumbY + thumbH / 2);
    }

    /* --- 标记 --- */
    var items = app.markers.items;
    ctx.font = (9 * dpr) + 'px ui-monospace, monospace';
    for (var mi = 0; mi < items.length; mi++) {
      var m = items[mi];
      var mx = this.xOfFrame(m.frame);
      if (mx < -20 || mx > w + 20) continue;
      ctx.fillStyle = m.color || C.marker;
      ctx.beginPath();
      ctx.moveTo(mx, trackY + 2 * dpr);
      ctx.lineTo(mx - 4 * dpr, trackY + 8 * dpr);
      ctx.lineTo(mx + 4 * dpr, trackY + 8 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(Math.round(mx), trackY, Math.max(1, dpr), trackH);
      if (pxPerFrame > 2) ctx.fillText(m.label, mx + 5 * dpr, trackY + 14 * dpr);
    }

    /* --- 悬停指示 --- */
    if (this.hoverFrame != null && !this.drag) {
      var hx = this.xOfFrame(Math.round(this.hoverFrame));
      ctx.fillStyle = C.hover;
      ctx.fillRect(hx - Math.max(1, pxPerFrame / 2), rulerH, Math.max(1, pxPerFrame), hh - rulerH);
      ctx.fillStyle = C.text;
      var ht = '#' + Math.round(this.hoverFrame) + '  ' + D.TC.formatTime(clock.timeOfFrame(Math.round(this.hoverFrame)), 3);
      var tw2 = ctx.measureText(ht).width;
      var lx = Math.min(w - tw2 - 6 * dpr, Math.max(4 * dpr, hx + 6 * dpr));
      ctx.font = (10 * dpr) + 'px ui-monospace, monospace';
      ctx.fillText(ht, lx, hh - 6 * dpr);
    }

    /* --- 播放头 --- */
    var pf = app.displayFrame();
    var px = Math.round(this.xOfFrame(pf)) + 0.5;
    ctx.strokeStyle = C.play;
    ctx.lineWidth = Math.max(1, 1.5 * dpr);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, hh);
    ctx.stroke();
    ctx.fillStyle = C.play;
    ctx.beginPath();
    ctx.moveTo(px - 5 * dpr, 0);
    ctx.lineTo(px + 5 * dpr, 0);
    ctx.lineTo(px, 7 * dpr);
    ctx.closePath();
    ctx.fill();
    if (pxPerFrame > 3 * dpr) {
      ctx.globalAlpha = 0.18;
      ctx.fillRect(px - pxPerFrame / 2, rulerH, pxPerFrame, hh - rulerH);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  D.Timeline = Timeline;
})(typeof window !== 'undefined' ? window : globalThis);
