/* ============ HUD（顶部资源栏 / 底部按钮 / 提示） ============ */
COC.UIState = { selected: null, selObstacle: null, placing: null, dragging: null, pointer: null };
COC.Mode = 'home';

COC.UI = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;
  var el = {};

  function $(id) { return document.getElementById(id); }

  function init() {
    el.gold = $('res-gold'); el.elixir = $('res-elixir'); el.gem = $('res-gem');
    el.goldFill = document.querySelector('#res-gold-bar .res-fill');
    el.elixirFill = document.querySelector('#res-elixir-bar .res-fill');
    el.builder = $('builder-num'); el.trophy = $('trophy-num');
    el.name = $('hud-name'); el.xpFill = $('xp-fill'); el.xpText = $('xp-text');
    el.hudTop = $('hud-top'); el.hudBottom = $('hud-bottom');
    el.toastWrap = $('toast-wrap');

    $('btn-shop').onclick = function () { COC.Audio.play('open'); COC.ShopUI.open(); };
    $('btn-army').onclick = function () { COC.Audio.play('open'); COC.ArmyUI.open(); };
    $('btn-attack').onclick = function () { COC.Audio.play('click'); COC.BattleUI.enter(); };
    $('btn-sound').onclick = toggleSound;

    /* 模态窗口通用关闭 */
    var closes = document.querySelectorAll('[data-close]');
    for (var i = 0; i < closes.length; i++) {
      (function (btn) {
        btn.onclick = function () {
          $(btn.getAttribute('data-close')).classList.add('hidden');
          COC.Audio.play('close');
        };
      })(closes[i]);
    }

    U.on('hud', update);
    U.on('mode', onMode);
    update();
    syncSoundIcon();
  }

  function toggleSound() {
    var S = COC.State.get();
    S.soundOn = !S.soundOn;
    COC.Audio.setEnabled(S.soundOn);
    syncSoundIcon();
    COC.Audio.play('click');
  }

  function syncSoundIcon() {
    var S = COC.State.get();
    COC.Audio.setEnabled(S.soundOn !== false);
    $('sound-icon').src = 'assets/img/icons/' + (S.soundOn !== false ? 'audioOn' : 'audioOff') + '.png';
  }

  function update() {
    var S = COC.State.get();
    if (!S) return;
    el.gold.textContent = U.fmt(S.gold);
    el.elixir.textContent = U.fmt(S.elixir);
    el.gem.textContent = U.fmt(S.gems);
    var gCap = COC.State.storageCap('gold'), eCap = COC.State.storageCap('elixir');
    el.goldFill.style.width = Math.max(4, Math.min(97, S.gold / gCap * 97)) + '%';
    el.elixirFill.style.width = Math.max(4, Math.min(97, S.elixir / eCap * 97)) + '%';
    el.builder.textContent = COC.State.builderFree() + '/' + COC.State.builderTotal();
    el.trophy.textContent = S.trophies;
    el.name.textContent = S.name + ' · ' + S.level + '级';
    var need = COC.State.xpNeed(S.level);
    el.xpFill.style.width = Math.min(100, S.xp / need * 100) + '%';
    el.xpText.textContent = S.xp + '/' + need;
  }

  function onMode() {
    var home = COC.Mode === 'home';
    el.hudTop.classList.toggle('hidden', !home);
    el.hudBottom.classList.toggle('hidden', !home);
    if (home) {
      $('battle-hud').classList.add('hidden');
      $('scout-bar').classList.add('hidden');
    }
    update();
  }

  var toastCount = 0;
  function toast(msg, ms) {
    if (toastCount > 4) return;
    toastCount++;
    var div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    el.toastWrap.appendChild(div);
    setTimeout(function () {
      div.classList.add('out');
      setTimeout(function () { div.remove(); toastCount--; }, 420);
    }, ms || 2300);
  }

  function showLoaded() {
    $('loading-screen').style.display = 'none';
    el.hudTop.classList.remove('hidden');
    el.hudBottom.classList.remove('hidden');
  }

  return { init: init, update: update, toast: toast, showLoaded: showLoaded };
})();
