/* ============================================================
   main.js — 启动、主循环、模式切换、设置与网页控件
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX, P = AA.PAL, F = AA.FONT, A = AA.AUDIO, S = AA.SFX, M = AA.MUSIC;
  var IN = AA.INPUT, SV = AA.SAVE, SC = AA.SCREEN, FL = AA.FILTER;
  var SCN = AA.SCENES, RIG = AA.RIG, FX = AA.FX, TB = AA.TEXTBOX, HUD = AA.HUD, RC = AA.RECORD;
  var VM = AA.VM, T = AA.TITLE, CAST = AA.CAST, C1 = AA.CASE1;

  var W = 256, H = 192;
  var mode = 'boot';      // boot | title | game | gallery
  var time = 0, last = 0;
  var settings = SV.settings();

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    SC.init({
      device: document.getElementById('device'),
      shell: document.getElementById('shell'),
      screens: document.getElementById('screens')
    });
    CAST.ensure();
    CAST.fillPoses();
    if (CAST.missing.length) console.warn('缺少角色文件，已用占位角色替代：', CAST.missing.join(', '));

    FL.setStrength(settings.filter);
    A.setVolume('master', settings.volume);
    if (settings.layout && settings.layout !== 'auto') SC.setLayout(settings.layout);

    bindDom();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  /* ============================================================
     启动流程
     ============================================================ */
  function boot() {
    A.init();
    M.onAudioReady();
    // 字体就绪后重建字形缓存（避免用回退字体缓存了错误字形）
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { F.clearCache(); PX.clearCache(); });
    }
    var b = document.getElementById('boot');
    b.classList.add('gone');
    setTimeout(function () { b.style.display = 'none'; }, 600);
    CAST.warm(['naruhodo', 'mayoi', 'judge', 'mitsurugi'], function () {
      CAST.warm(null, null);
    });
    enterTitle();
  }

  function enterTitle() {
    mode = 'title';
    FX.clear(); FX.uncover();
    TB.hide(); HUD.reset(); RC.reset();
    T.enter(!!SV.slot());
    T.onStart = function (id) {
      if (id === 'new') startGame();
      else if (id === 'continue') startGame(SV.slot());
      else if (id === 'gallery') enterGallery();
      else if (id === 'help') document.getElementById('helpmodal').hidden = false;
    };
  }

  function startGame(slot) {
    mode = 'game';
    T.leave();
    M.stop(.4);
    FX.clear();
    VM.onEnd = function (result) {
      SV.clearSlot();
      setTimeout(function () { enterTitle(); }, 1200);
    };
    VM.start(C1.script, {
      life: (slot && slot.life) || 5,
      at: slot && slot.label ? slot.label : null,
      flags: slot && slot.flags,
      items: slot && slot.items
    });
  }

  /* ============================================================
     角色 / 演出一览（额外的鉴赏模式）
     ============================================================ */
  var gal = { chars: [], ci: 0, pi: 0, poses: [], t: 0, bgIdx: 0, talk: false };
  var GBG = [['court', 'defense'], ['court', 'witness'], ['court', 'judge'], ['court', 'prosecution'],
  ['court', 'wide'], ['studio', 'main'], ['detention', 'main'], ['lobby', 'main'], ['office', 'main']];

  function enterGallery() {
    mode = 'gallery';
    T.leave();
    gal.chars = RIG.list();
    gal.ci = 0; gal.pi = 0; gal.t = 0; gal.bgIdx = 0;
    galPoses();
    SCN.load(GBG[0][0], GBG[0][1]);
    M.play('investigate', { fadeIn: .5 });
  }
  function galPoses() {
    var d = RIG.get(gal.chars[gal.ci]);
    gal.poses = d ? Object.keys(d.poses) : ['normal'];
    if (gal.pi >= gal.poses.length) gal.pi = 0;
  }

  function galDrawTop(ctx) {
    ctx.drawImage(SCN.bg(), 0, 0);
    var who = gal.chars[gal.ci], pose = gal.poses[gal.pi];
    var n = RIG.frames(who, pose);
    var f = Math.floor(gal.t / (gal.talk ? .105 : .5)) % n;
    var cv = RIG.sprite(who, pose, f, gal.talk);
    var slot = SCN.slot(who) || SCN.slot('talk') || { x: 128, y: 219, s: 1 };
    if (cv) RIG.draw(ctx, cv, slot);
    var fg = SCN.fg(); if (fg) ctx.drawImage(fg, 0, 0);
    var d = RIG.get(who);
    var lab = (d ? d.full : who) + '　/　' + pose + '　(' + (f + 1) + '/' + n + ')';
    ctx.fillStyle = 'rgba(4,7,16,.7)'; ctx.fillRect(0, 0, W, 15);
    F.draw(ctx, lab, 5, 1, 'uiS', '#ffe9a8');
    if (d && d.placeholder) F.draw(ctx, '※ 占位素材', W - 62, 1, 'uiS', '#ff8a8a');
  }
  function galDrawBot(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a2650'); g.addColorStop(1, '#080c1c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    F.center(ctx, '角 色 与 演 出 一 览', 128, 5, 'ui', '#ffe9a8');
    ctx.fillStyle = '#e8c46a'; ctx.fillRect(20, 20, W - 40, 1);
    // 角色列
    for (var i = 0; i < gal.chars.length; i++) {
      var on = i === gal.ci;
      var x = 6 + (i % 4) * 62, y = 26 + Math.floor(i / 4) * 20;
      HUD.drawButton(ctx, x, y, 59, 18, (RIG.get(gal.chars[i]) || {}).label || gal.chars[i], on ? 'gold' : 'dark', true, false);
    }
    // 姿势列
    var top = 26 + Math.ceil(gal.chars.length / 4) * 20 + 6;
    F.draw(ctx, '姿势', 6, top, 'tiny', '#93a4d8');
    for (var p = 0; p < gal.poses.length; p++) {
      var onp = p === gal.pi;
      var px = 6 + (p % 4) * 62, py = top + 11 + Math.floor(p / 4) * 17;
      if (py > 128) break;
      HUD.drawButton(ctx, px, py, 59, 15, gal.poses[p], onp ? 'hot' : 'normal', true, false);
    }
    HUD.drawButton(ctx, 6, 136, 78, 20, gal.talk ? '口型：开' : '口型：关', 'normal', true, false);
    HUD.drawButton(ctx, 90, 136, 78, 20, '换 背 景', 'normal', true, false);
    HUD.drawButton(ctx, 174, 136, 76, 20, '演 出 试 听', 'gold', true, false);
    HUD.drawButton(ctx, 6, 160, 116, 26, '异 议 演 出', 'hot', true, false);
    HUD.drawButton(ctx, 132, 160, 118, 26, '返 回 标 题', 'dark', true, false);
  }
  function galTap(x, y, scr) {
    if (scr !== 1) return;
    for (var i = 0; i < gal.chars.length; i++) {
      var bx = 6 + (i % 4) * 62, by = 26 + Math.floor(i / 4) * 20;
      if (x >= bx && x < bx + 59 && y >= by && y < by + 18) { gal.ci = i; gal.pi = 0; galPoses(); S.cursor(); return; }
    }
    var top = 26 + Math.ceil(gal.chars.length / 4) * 20 + 6;
    for (var p = 0; p < gal.poses.length; p++) {
      var px = 6 + (p % 4) * 62, py = top + 11 + Math.floor(p / 4) * 17;
      if (py > 128) break;
      if (x >= px && x < px + 59 && y >= py && y < py + 15) { gal.pi = p; S.cursor(); return; }
    }
    if (y >= 136 && y < 156) {
      if (x < 84) { gal.talk = !gal.talk; S.select(); }
      else if (x < 168) { gal.bgIdx = (gal.bgIdx + 1) % GBG.length; SCN.load(GBG[gal.bgIdx][0], GBG[gal.bgIdx][1]); S.select(); }
      else { S.slam(); FX.shake(6, .5); FX.flash('#ffffff', .2, .6); FX.shockBg(.9); }
      return;
    }
    if (y >= 160) {
      if (x < 122) { FX.bubble(['objection', 'holdit', 'takethat', 'gotcha'][Math.floor(Math.random() * 4)], { gender: (RIG.get(gal.chars[gal.ci]) || {}).gender }); }
      else { M.stop(.3); enterTitle(); }
    }
  }
  function galKey(k) {
    if (k === 'left') { gal.pi = U.mod(gal.pi - 1, gal.poses.length); S.cursor(); }
    else if (k === 'right') { gal.pi = U.mod(gal.pi + 1, gal.poses.length); S.cursor(); }
    else if (k === 'up') { gal.ci = U.mod(gal.ci - 1, gal.chars.length); gal.pi = 0; galPoses(); S.cursor(); }
    else if (k === 'down') { gal.ci = U.mod(gal.ci + 1, gal.chars.length); gal.pi = 0; galPoses(); S.cursor(); }
    else if (k === 'confirm') { gal.talk = !gal.talk; S.select(); }
    else if (k === 'objection') FX.bubble('objection', { gender: (RIG.get(gal.chars[gal.ci]) || {}).gender });
    else if (k === 'cancel') { M.stop(.3); enterTitle(); }
  }

  /* ============================================================
     主循环
     ============================================================ */
  function loop(now) {
    var dt = Math.min(.05, (now - last) / 1000);
    last = now; time += dt;
    try { step(dt); } catch (e) { console.error(e); }
    requestAnimationFrame(loop);
  }

  function step(dt) {
    /* --- 输入 --- */
    var k;
    while ((k = IN.consumeAny())) dispatchKey(k);
    var tp;
    while ((tp = IN.consumeTap())) dispatchTap(tp);

    /* --- 更新 --- */
    var top = SC.top, bot = SC.bot;
    if (mode === 'title') {
      T.update(dt);
      FX.update(dt);
      T.drawTop(top);
      T.drawBot(bot);
    } else if (mode === 'gallery') {
      gal.t += dt;
      SCN.update(dt); FX.update(dt);
      galDrawTop(top);
      FX.draw(top, 'bg'); FX.draw(top, 'over'); FX.draw(top, 'top');
      galDrawBot(bot);
    } else if (mode === 'game') {
      VM.update(dt);
      VM.drawTop(top, dt);
      VM.drawBot(bot, dt);
    } else {
      top.fillStyle = '#05070f'; top.fillRect(0, 0, W, H);
      bot.fillStyle = '#05070f'; bot.fillRect(0, 0, W, H);
    }
    SC.present(time);
  }

  function dispatchKey(k) {
    if (mode === 'title') T.handleKey(k);
    else if (mode === 'gallery') galKey(k);
    else if (mode === 'game') VM.handleKey(k);
  }
  function dispatchTap(tp) {
    if (mode === 'title') T.handleTap(tp.x, tp.y, tp.scr);
    else if (mode === 'gallery') galTap(tp.x, tp.y, tp.scr);
    else if (mode === 'game') VM.handleTap(tp.x, tp.y, tp.scr);
  }

  /* ============================================================
     网页控件
     ============================================================ */
  function bindDom() {
    var bg = document.getElementById('boot-go');
    bg.addEventListener('click', function () { boot(); });
    document.getElementById('boot').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') boot();
    });

    var slF = document.getElementById('sl-filter'), outF = document.getElementById('out-filter');
    slF.value = Math.round(settings.filter * 100);
    outF.textContent = slF.value + '%';
    slF.addEventListener('input', function () {
      var v = slF.value / 100;
      FL.setStrength(v); outF.textContent = slF.value + '%';
      settings.filter = v; SV.saveSettings({ filter: v });
    });

    var slV = document.getElementById('sl-vol'), outV = document.getElementById('out-vol');
    slV.value = Math.round(settings.volume * 100);
    outV.textContent = slV.value + '%';
    slV.addEventListener('input', function () {
      var v = slV.value / 100;
      A.setVolume('master', v); outV.textContent = slV.value + '%';
      settings.volume = v; SV.saveSettings({ volume: v });
    });

    document.getElementById('btn-layout').addEventListener('click', function () {
      var l = SC.cycleLayout();
      settings.layout = l; SV.saveSettings({ layout: l });
      this.classList.toggle('on', l === 'shell');
      SC.markShellDirty();
    });
    document.getElementById('btn-scale').addEventListener('click', function () { SC.cycleScale(); });
    document.getElementById('btn-full').addEventListener('click', toggleFull);
    document.getElementById('btn-help').addEventListener('click', function () {
      document.getElementById('helpmodal').hidden = false;
    });
    document.getElementById('help-close').addEventListener('click', function () {
      document.getElementById('helpmodal').hidden = true;
    });
    document.getElementById('helpmodal').addEventListener('click', function (e) {
      if (e.target === this) this.hidden = true;
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
      if (mode === 'boot') return;
      M.stop(.2); S.stopAll();
      enterTitle();
    });

    window.addEventListener('keydown', function (e) {
      if (e.target && e.target.tagName === 'INPUT') return;
      var kk = e.key;
      if (kk === 'l' || kk === 'L') { var l = SC.cycleLayout(); settings.layout = l; SV.saveSettings({ layout: l }); }
      else if (kk === 'f' || kk === 'F') toggleFull();
      else if (kk === '+' || kk === '=') SC.cycleScale();
      else if (kk === '-' || kk === '_') SC.cycleScale();
      else if (kk === 'h' || kk === 'H') {
        var hm = document.getElementById('helpmodal'); hm.hidden = !hm.hidden;
      } else if (kk === 'Escape') {
        var hm2 = document.getElementById('helpmodal');
        if (!hm2.hidden) hm2.hidden = true;
      }
    });

    document.addEventListener('fullscreenchange', function () {
      document.body.classList.toggle('fs', !!document.fullscreenElement);
      setTimeout(function () { SC.resize(); }, 60);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) A.suspend(); else A.resume();
    });
  }

  function toggleFull() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || function () { })
        .call(document.documentElement).catch(function () { });
    } else document.exitFullscreen();
  }

  /* ============================================================
     调试接口（供自动化检查使用）
     ============================================================ */
  AA.DEV = {
    mode: function () { return mode; },
    setMode: function (m) {
      if (m === 'game') startGame();
      else if (m === 'title') enterTitle();
      else if (m === 'gallery') enterGallery();
    },
    boot: boot,
    jump: function (label) {
      if (mode !== 'game') startGame();
      VM.jump(label); VM.setState('run'); VM.run();
    },
    press: function (k, n) { for (var i = 0; i < (n || 1); i++) dispatchKey(k); },
    tap: function (x, y, scr) { dispatchTap({ x: x, y: y, scr: scr === undefined ? 1 : scr }); },
    state: function () { return VM.state(); },
    giveAll: function () {
      var n = 0;
      for (var id in C1.items) if (AA.RECORD.add(Object.assign({ id: id }, C1.items[id]))) n++;
      return n;
    },
    info: function () {
      return {
        mode: mode, vm: VM.state(), scene: SCN.name(), cam: SCN.camName(),
        life: VM.G.life, actors: Object.keys(VM.G.actors),
        record: AA.RECORD.all().map(function (i) { return i.id; }),
        missing: CAST.missing
      };
    },
    skipTo: function (label, steps) {
      AA.DEV.jump(label);
      for (var i = 0; i < (steps || 200); i++) {
        if (VM.state() === 'text') dispatchKey('confirm');
        else break;
      }
      return AA.DEV.info();
    }
  };

  /* ---------------- 启动 ---------------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(window.AA);
