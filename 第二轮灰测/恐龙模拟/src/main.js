/* ============ 启动与界面绑定 ============ */
(function (D) {
  "use strict";
  var U = D.util;
  var game = null;
  var previewT = 0, previewRaf = null;

  function byId(id) { return document.getElementById(id); }

  function buildSpeciesList() {
    var box = byId("speclist");
    if (!box) return;
    box.innerHTML = "";
    for (var i = 0; i < D.PLAYABLE.length; i++) {
      var key = D.PLAYABLE[i];
      var def = D.SPECIES[key];
      var card = document.createElement("button");
      card.className = "spec" + (key === game.selected ? " sel" : "");
      card.setAttribute("data-sp", key);
      var cv = document.createElement("canvas");
      cv.className = "pv";
      card.appendChild(cv);
      var b = document.createElement("b");
      b.textContent = def.name;
      card.appendChild(b);
      var em = document.createElement("em");
      em.textContent = (def.diet === "carn" ? "肉食" : def.diet === "herb" ? "植食" : "杂食") + " · " + (def.difficulty || "普通");
      card.appendChild(em);
      card.addEventListener("click", (function (k) {
        return function () {
          game.selected = k;
          D.Audio.blip();
          var all = box.querySelectorAll(".spec");
          for (var j = 0; j < all.length; j++) all[j].classList.remove("sel");
          this.classList.add("sel");
          showDetail(k);
        };
      })(key));
      box.appendChild(card);
    }
    showDetail(game.selected);
    startPreview();
  }

  function showDetail(key) {
    var d = D.SPECIES[key], box = byId("spec-detail");
    if (!box || !d) return;
    box.innerHTML = "<b>" + d.name + "</b> <span style=\"opacity:.6\">" + d.latin + "</span><br>" + d.desc +
      "<div class=\"stats\"><span>速度 <b>" + d.speed + "</b></span><span>生命 <b>" + d.hp + "</b></span>" +
      "<span>攻击 <b>" + d.dmg + "</b></span><span>食性 <b>" +
      (d.diet === "carn" ? "肉食" : d.diet === "herb" ? "植食" : "杂食") + "</b></span>" +
      "<span>吐息 <b>" + ((D.Magic.BREATHS[d.breath] || {}).name || "无") + "</b></span></div>" +
      "<div style=\"margin-top:4px;color:#ffce54\">建议：" + (d.tips || "先填饱肚子，再考虑领地") + "</div>";
  }

  function startPreview() {
    if (previewRaf !== null) return;
    var loop = function () {
      previewRaf = null;
      var menu = byId("menu");
      if (!menu || menu.classList.contains("hidden")) return;
      previewT += 0.016;
      var cards = document.querySelectorAll(".spec");
      for (var i = 0; i < cards.length; i++) {
        var cv = cards[i].querySelector("canvas");
        if (!cv) continue;
        var w = cv.clientWidth || 70, h = cv.clientHeight || 46;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        var ctx = cv.getContext("2d");
        if (!ctx) continue;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        D.Render.preview(ctx, cards[i].getAttribute("data-sp"), w, h, previewT + i);
      }
      if (typeof requestAnimationFrame === "function") previewRaf = requestAnimationFrame(loop);
    };
    if (typeof requestAnimationFrame === "function") previewRaf = requestAnimationFrame(loop);
  }

  function setOpt(id, text) { var el = byId(id); if (el) el.textContent = text; }

  function refreshSettings() {
    var s = game.settings;
    setOpt("set-sound", s.sound ? "开" : "关");
    setOpt("set-hand", s.hand === "left" ? "左手" : "右手");
    setOpt("set-quality", s.quality === "high" ? "高" : s.quality === "mid" ? "中" : "省电");
    setOpt("set-vibe", s.vibe ? "开" : "关");
    setOpt("set-touch", s.touch === "auto" ? "自动" : s.touch === "on" ? "常显" : "隐藏");
    setOpt("set-zoom", s.zoom === "near" ? "近" : s.zoom === "mid" ? "标准" : "远");
    var b = byId("btn-sound");
    if (b) {
      b.textContent = s.sound ? "🔊" : "🔇";
      if (s.sound) b.classList.remove("off"); else b.classList.add("off");
    }
  }

  function toggleFullscreen() {
    try {
      var el = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch (e) {}
  }

  var wakeLock = null;
  function keepAwake() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }).catch(function () {});
      }
    } catch (e) {}
  }

  function on(id, fn) {
    var el = byId(id);
    if (!el) return;
    el.addEventListener("click", function (e) {
      if (e && e.preventDefault) e.preventDefault();
      D.Audio.resume();
      D.Audio.blip();
      fn.call(el, e);
    });
  }

  function bindUI() {
    on("btn-start", function () {
      D.Audio.init();
      keepAwake();
      game.newGame(game.selected, 0, null);
    });
    on("btn-continue", function () {
      var s = game.readSave();
      if (!s) { game.toast("没有存档", "bad"); return; }
      D.Audio.init();
      keepAwake();
      game.selected = s.sp || "raptor";
      game.newGame(game.selected, s.seed, s);
    });
    on("btn-help", function () { game.show("help"); });
    on("btn-settings", function () { refreshSettings(); game.settingsBack = "menu"; game.show("settings"); });
    on("btn-psettings", function () { refreshSettings(); game.settingsBack = "pause"; game.show("settings"); });
    on("btn-resume", function () { game.resumeGame(); });
    on("btn-quit", function () {
      game.save();
      game.state = "menu";
      game.paused = true;
      var cont = byId("btn-continue");
      if (cont) cont.classList.remove("hidden");
      game.show("menu");
      startPreview();
    });
    on("btn-again", function () { game.newGame(game.selected, 0, null); });
    on("btn-tomenu", function () {
      game.state = "menu";
      game.paused = true;
      var cont2 = byId("btn-continue");
      if (cont2) cont2.classList.add("hidden");
      game.show("menu");
      startPreview();
    });
    on("btn-pause", function () { game.pauseGame(); });
    on("btn-full", function () { toggleFullscreen(); });
    on("btn-sound", function () {
      game.settings.sound = !game.settings.sound;
      D.Audio.setEnabled(game.settings.sound);
      game.saveSettings();
      refreshSettings();
    });

    var backs = document.querySelectorAll("[data-back]");
    for (var i = 0; i < backs.length; i++) {
      backs[i].addEventListener("click", function () {
        D.Audio.blip();
        var target = this.getAttribute("data-back");
        if (game.settingsBack === "pause" && game.state === "pause") { game.show("pause"); game.settingsBack = null; return; }
        game.show(target);
        if (target === "menu") startPreview();
      });
    }

    on("set-sound", function () {
      game.settings.sound = !game.settings.sound;
      D.Audio.setEnabled(game.settings.sound);
      game.saveSettings(); refreshSettings();
    });
    on("set-hand", function () {
      game.settings.hand = game.settings.hand === "left" ? "right" : "left";
      D.Input.setHand(game.settings.hand);
      game.saveSettings(); refreshSettings();
    });
    on("set-quality", function () {
      var order = ["high", "mid", "low"];
      var i2 = (order.indexOf(game.settings.quality) + 1) % 3;
      game.settings.quality = order[i2];
      game.quality = i2 === 0 ? 2 : i2 === 1 ? 1 : 0;
      game.autoDropped = false;
      game.resize();
      game.saveSettings(); refreshSettings();
    });
    on("set-vibe", function () {
      game.settings.vibe = !game.settings.vibe;
      game.vibrate(30);
      game.saveSettings(); refreshSettings();
    });
    on("set-touch", function () {
      var order2 = ["auto", "on", "off"];
      var i3 = (order2.indexOf(game.settings.touch) + 1) % 3;
      game.settings.touch = order2[i3];
      game.applyTouchVisibility();
      game.saveSettings(); refreshSettings();
    });
    on("set-zoom", function () {
      var order3 = ["near", "mid", "far"];
      var i4 = (order3.indexOf(game.settings.zoom) + 1) % 3;
      game.settings.zoom = order3[i4];
      game.resize();
      game.saveSettings(); refreshSettings();
    });
    on("set-clear", function () {
      game.clearSave();
      var cont3 = byId("btn-continue");
      if (cont3) cont3.classList.add("hidden");
      game.toast("存档已清除", "info");
    });
  }

  function boot() {
    game = new D.Game();
    D.game = game;
    game.init();
    buildSpeciesList();
    bindUI();
    refreshSettings();
    var cont = byId("btn-continue");
    if (cont && game.hasSave()) cont.classList.remove("hidden");
    // 首次触摸即解锁音频
    var unlock = function () {
      D.Audio.init();
      D.Audio.resume();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    // 离线支持（仅 http/https）
    try {
      if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      }
    } catch (e) {}
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(window.DINO);
