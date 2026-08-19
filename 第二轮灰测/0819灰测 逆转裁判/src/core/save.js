/* ============================================================
   save.js — 设置与进度存档（localStorage）
   ============================================================ */
(function (AA) {
  'use strict';
  var SV = AA.SAVE = {};
  var KEY = 'gyakuten_dsfan_v1';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function write(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { }
  }

  SV.settings = function () {
    var d = read();
    return Object.assign({
      filter: 1.0, volume: 0.7, layout: 'auto', scale: 0, textSpeed: 1, shellSkin: 'lite'
    }, d.settings || {});
  };
  SV.saveSettings = function (s) {
    var d = read(); d.settings = Object.assign(SV.settings(), s); write(d);
  };
  SV.slot = function () { var d = read(); return d.slot || null; };
  SV.saveSlot = function (state) {
    var d = read();
    d.slot = Object.assign({}, state, { at: Date.now() });
    write(d);
  };
  SV.clearSlot = function () { var d = read(); delete d.slot; write(d); };
  SV.flag = function (k, v) {
    var d = read(); d.flags = d.flags || {};
    if (v === undefined) return d.flags[k];
    d.flags[k] = v; write(d);
  };

})(window.AA);
