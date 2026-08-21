/* main.js — 启动 */
(function (K) {
  'use strict';
  function boot() {
    var cv = document.getElementById('game');
    K.Game.init(cv);
    var kick = function () { K.Snd.init(); K.Snd.resume(); window.removeEventListener('pointerdown', kick); };
    window.addEventListener('pointerdown', kick);
    requestAnimationFrame(function (n) { K.Game.loop(n); });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
  K.boot = boot;
})(window.K);
