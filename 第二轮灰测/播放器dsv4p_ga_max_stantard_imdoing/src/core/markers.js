/*!
 * src/core/markers.js — 帧标记（打点 / 跳转 / 区间）
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util;

  var PALETTE = ['#5cc8ff', '#ffd479', '#ff7a90', '#8affc1', '#c6a0ff', '#ffa45c'];

  function MarkerList() {
    D.Emitter.call(this);
    this.items = []; // [{frame, label, color}] 按 frame 升序
  }
  MarkerList.prototype = Object.create(D.Emitter.prototype);
  MarkerList.prototype.constructor = MarkerList;

  MarkerList.prototype._sort = function () {
    this.items.sort(function (a, b) { return a.frame - b.frame; });
  };

  MarkerList.prototype.indexOfFrame = function (frame) {
    for (var i = 0; i < this.items.length; i++) if (this.items[i].frame === frame) return i;
    return -1;
  };

  MarkerList.prototype.add = function (frame, label, color) {
    frame = Math.max(0, Math.round(frame));
    var i = this.indexOfFrame(frame);
    if (i >= 0) {
      if (label != null) this.items[i].label = label;
      if (color) this.items[i].color = color;
    } else {
      this.items.push({
        frame: frame,
        label: label != null ? label : ('M' + (this.items.length + 1)),
        color: color || PALETTE[this.items.length % PALETTE.length]
      });
      this._sort();
    }
    this.emit('change', this.items);
    return this.items[this.indexOfFrame(frame)];
  };

  MarkerList.prototype.remove = function (frame) {
    var i = this.indexOfFrame(frame);
    if (i < 0) return false;
    this.items.splice(i, 1);
    this.emit('change', this.items);
    return true;
  };

  /** 有则删、无则加 */
  MarkerList.prototype.toggle = function (frame, label) {
    return this.remove(frame) ? null : this.add(frame, label);
  };

  MarkerList.prototype.clear = function () {
    this.items.length = 0;
    this.emit('change', this.items);
  };

  MarkerList.prototype.next = function (frame) {
    for (var i = 0; i < this.items.length; i++) if (this.items[i].frame > frame) return this.items[i];
    return null;
  };

  MarkerList.prototype.prev = function (frame) {
    for (var i = this.items.length - 1; i >= 0; i--) if (this.items[i].frame < frame) return this.items[i];
    return null;
  };

  MarkerList.prototype.nearest = function (frame) {
    var best = null, bd = Infinity;
    for (var i = 0; i < this.items.length; i++) {
      var d = Math.abs(this.items[i].frame - frame);
      if (d < bd) { bd = d; best = this.items[i]; }
    }
    return best;
  };

  /** 相邻两个标记构成的区间（用于「按标记设循环」） */
  MarkerList.prototype.spanAround = function (frame) {
    var prev = null, next = null;
    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].frame <= frame) prev = this.items[i];
      if (this.items[i].frame > frame && !next) next = this.items[i];
    }
    if (prev && next) return { inFrame: prev.frame, outFrame: Math.max(prev.frame, next.frame - 1) };
    if (prev && !next) return { inFrame: prev.frame, outFrame: prev.frame };
    if (!prev && next) return { inFrame: 0, outFrame: Math.max(0, next.frame - 1) };
    return null;
  };

  MarkerList.prototype.serialize = function () {
    return this.items.map(function (m) { return { frame: m.frame, label: m.label, color: m.color }; });
  };

  MarkerList.prototype.load = function (arr) {
    this.items.length = 0;
    if (Array.isArray(arr)) {
      for (var i = 0; i < arr.length; i++) {
        var m = arr[i];
        if (!m || !isFinite(m.frame)) continue;
        this.items.push({
          frame: Math.max(0, Math.round(m.frame)),
          label: String(m.label == null ? 'M' : m.label).slice(0, 60),
          color: /^#[0-9a-fA-F]{3,8}$/.test(String(m.color)) ? m.color : PALETTE[i % PALETTE.length]
        });
      }
      this._sort();
    }
    this.emit('change', this.items);
    return this.items.length;
  };

  MarkerList.PALETTE = PALETTE;
  D.MarkerList = MarkerList;
  if (typeof module !== 'undefined' && module.exports) module.exports = MarkerList;
})(typeof window !== 'undefined' ? window : globalThis);
