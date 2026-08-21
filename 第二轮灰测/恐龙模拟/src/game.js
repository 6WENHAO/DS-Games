/* ============ 游戏主体：循环 / 生态 / 天气 / 事件 / HUD ============ */
(function (D) {
  "use strict";
  var U = D.util;
  var SAVE_KEY = "dino-survival-save-v1";
  var SET_KEY = "dino-survival-settings-v1";

  var ACH = {
    firstKill: "第一滴血 · 完成首次击杀",
    adult: "长大成人 · 成长为成年体",
    apex: "屠龙者 · 击杀顶级掠食者",
    nest: "安家 · 建造第一个巢",
    hatch: "为父/为母 · 孵化一只幼崽",
    day3: "站稳脚跟 · 存活 3 天",
    day7: "王者归来 · 存活 7 天",
    meteor: "劫后余生 · 在陨石雨中活下来",
    fullgrown: "霸主 · 达到最终成长阶段",
    village: "不速之客 · 发现人类营地",
    totem: "推倒图腾 · 摧毁一座部落图腾",
    relic: "远古馈赠 · 获得第一件遗物",
    rune: "符文低语 · 在符文圈获得祝福",
    dragonlord: "屠龙者 · 击杀熔岩暴龙",
    breather: "吐息大师 · 释放吐息 50 次",
    manhunt: "猎人的猎物 · 击杀 10 名部落成员"
  };

  var WEATHERS = [
    { type: "clear", name: "☀ 晴朗", rain: 0, fog: 0, wind: 0.25, w: 34 },
    { type: "cloudy", name: "☁ 多云", rain: 0, fog: 0.12, wind: 0.4, w: 24 },
    { type: "rain", name: "🌧 降雨", rain: 0.8, fog: 0.18, wind: 0.6, w: 20 },
    { type: "storm", name: "⛈ 雷暴", rain: 1, fog: 0.22, wind: 1, w: 10 },
    { type: "fog", name: "🌫 浓雾", rain: 0, fog: 0.85, wind: 0.15, w: 12 }
  ];

  function byId(id) { try { return document.getElementById(id); } catch (e) { return null; } }

  function Game() {
    this.canvas = byId("game");
    this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext("2d") : null;
    this.dpr = 1; this.vw = 900; this.vh = 600;
    this.cam = { x: 0, y: 0, zoom: 1, sx: 0, sy: 0, shake: 0 };
    this.view = { x0: 0, y0: 0, x1: 0, y1: 0 };
    this.fx = new D.FX();
    this.creatures = []; this.allies = []; this.eggs = [];
    this.fires = []; this.meteors = []; this.flyers = []; this.projectiles = [];
    this.grid = new Map(); this.gridSize = 200;
    this.state = "menu";
    this.time = 0; this.day = 1; this.tod = 0.26; this.dayLength = 195;
    this.light = 1; this.night = 0; this.darkness = 0; this.warm = 0; this.flash = 0; this.fogFactor = 0;
    this.weather = { type: "clear", name: "☀ 晴朗", t: 30, rain: 0, fog: 0, tr: 0, tf: 0, wind: 0.25, strikeT: 6 };
    this.event = null; this.eventT = 0; this.nextEventT = 75; this.predBuff = 1;
    this.quality = 2; this.fpsAcc = 0; this.fpsN = 0; this.fpsLow = 0; this.autoDropped = false;
    this.stats = this.blankStats();
    this.ach = {};
    this.selected = "raptor";
    this.hudT = 0; this.miniT = 0; this.saveT = 0; this.warnT = 0;
    this.sleeping = false; this.sleepFade = 0;
    this.playerTarget = null; this.currentAct = null;
    this.paused = false; this.lastTs = 0; this.running = false;
    this.settings = { sound: true, hand: "left", quality: "high", vibe: true, touch: "auto", zoom: "mid" };
    this.el = {};
    this.lightCanvas = null;
  }

  var G = Game.prototype;

  G.blankStats = function () {
    return {
      kills: 0, meals: 0, drinks: 0, eggs: 0, hatch: 0, roars: 0, days: 1, maxLevel: 1,
      nests: 0, sleeps: 0, hits: 0, breaths: 0, humans: 0, totems: 0
    };
  };

  /* ---------------- 初始化 ---------------- */
  G.init = function () {
    var e = this.el;
    e.hud = byId("hud"); e.touch = byId("touch"); e.stick = byId("stick"); e.knob = byId("knob");
    e.stickzone = byId("stickzone");
    e.whoName = byId("who-name"); e.whoStage = byId("who-stage"); e.whoLv = byId("who-lv");
    e.fHp = byId("f-hp"); e.fFood = byId("f-food"); e.fWater = byId("f-water");
    e.fStam = byId("f-stam"); e.fExp = byId("f-exp"); e.fMana = byId("f-mana");
    e.relics = byId("relics"); e.btnBreath = byId("btn-breath");
    e.clock = byId("clock"); e.weatherChip = byId("weather"); e.minimap = byId("minimap");
    e.prompt = byId("prompt"); e.toasts = byId("toasts"); e.keyhint = byId("keyhint");
    e.btnAttack = byId("btn-attack"); e.btnSprint = byId("btn-sprint"); e.btnAct = byId("btn-act");
    e.btnRoar = byId("btn-roar"); e.btnNest = byId("btn-nest");
    e.screens = {
      menu: byId("menu"), help: byId("help"), settings: byId("settings"),
      pause: byId("pause"), over: byId("over")
    };
    e.overStats = byId("over-stats"); e.overTitle = byId("over-title"); e.overReason = byId("over-reason");
    e.pauseStats = byId("pause-stats"); e.rotate = byId("rotate");
    e.btnSound = byId("btn-sound");

    this.loadSettings();

    D.Input.init({
      stickzone: e.stickzone, stick: e.stick, knob: e.knob, touch: e.touch, canvas: this.canvas,
      btnAttack: e.btnAttack, btnSprint: e.btnSprint, btnAct: e.btnAct,
      btnRoar: e.btnRoar, btnNest: e.btnNest, btnBreath: e.btnBreath
    });
    var self = this;
    D.Input.onTouchDetect = function () { self.applyTouchVisibility(); };
    D.Input.onPause = function () {
      if (self.state === "play") self.pauseGame();
      else if (self.state === "pause") self.resumeGame();
    };
    D.Input.setHand(this.settings.hand);

    this.resize();
    window.addEventListener("resize", function () { self.resize(); });
    if (window.visualViewport) window.visualViewport.addEventListener("resize", function () { self.resize(); });
    window.addEventListener("orientationchange", function () { setTimeout(function () { self.resize(); }, 260); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && self.state === "play") self.pauseGame();
    });
    this.applyTouchVisibility();
  };

  G.resize = function () {
    var w = Math.max(320, window.innerWidth || 800);
    var h = Math.max(240, window.innerHeight || 600);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    // 像素上限，保证低端机流畅
    var maxPix = this.quality > 1 ? 2600000 : 1700000;
    while (w * h * dpr * dpr > maxPix && dpr > 1) dpr -= 0.1;
    dpr = Math.max(1, Math.round(dpr * 10) / 10);
    this.dpr = dpr; this.vw = w; this.vh = h;
    if (this.canvas) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    if (typeof document !== "undefined" && document.createElement) {
      if (!this.lightCanvas) this.lightCanvas = document.createElement("canvas");
      this.lightCanvas.width = Math.round(w * dpr);
      this.lightCanvas.height = Math.round(h * dpr);
    }
    var base = { near: 470, mid: 560, far: 670 }[this.settings.zoom] || 560;
    this.cam.zoom = U.clamp(Math.min(w, h) / base, 0.5, 1.35);
    if (this.el.rotate) {
      if (w < h && w < 620) this.el.rotate.classList.remove("hidden");
      else this.el.rotate.classList.add("hidden");
    }
  };

  G.applyTouchVisibility = function () {
    var show;
    if (this.settings.touch === "on") show = true;
    else if (this.settings.touch === "off") show = false;
    else show = D.Input.touchMode || (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
    this.showTouch = show;
    if (this.el.touch) {
      if (show && this.state === "play") this.el.touch.classList.remove("hidden");
      else this.el.touch.classList.add("hidden");
    }
    if (this.el.keyhint) {
      if (show) this.el.keyhint.classList.add("hidden");
      else this.el.keyhint.classList.remove("hidden");
    }
  };

  /* ---------------- 设置与存档 ---------------- */
  G.loadSettings = function () {
    try {
      var raw = localStorage.getItem(SET_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        for (var k in this.settings) if (s[k] !== undefined) this.settings[k] = s[k];
      }
    } catch (e) {}
    this.quality = this.settings.quality === "high" ? 2 : this.settings.quality === "mid" ? 1 : 0;
    D.Audio.setEnabled(this.settings.sound);
  };
  G.saveSettings = function () {
    try { localStorage.setItem(SET_KEY, JSON.stringify(this.settings)); } catch (e) {}
  };
  G.hasSave = function () {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  };
  G.save = function () {
    if (!this.player || this.player.dead) return;
    var p = this.player;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, seed: this.seedVal, sp: p.sp, day: this.day, tod: this.tod,
        level: p.level, exp: p.exp, hp: p.hp, hunger: p.hunger, thirst: p.thirst,
        x: p.x, y: p.y, stats: this.stats, ach: this.ach,
        nest: this.nest ? { x: this.nest.x, y: this.nest.y } : null,
        relics: p.relics || null, mana: Math.round(p.mana),
        villages: (this.world.villages || []).map(function (v) {
          return { r: v.ruined ? 1 : 0, hp: Math.round(v.totemHp || 0) };
        })
      }));
    } catch (e) {}
  };
  G.clearSave = function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };
  G.readSave = function () {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
  };

  /* ---------------- 新局 ---------------- */
  G.newGame = function (spKey, seed, saved) {
    this.seedVal = (seed | 0) || (Math.random() * 1000000000 | 0);
    this.world = new D.World(this.seedVal);
    this.creatures.length = 0; this.allies.length = 0;
    this.eggs.length = 0; this.fires.length = 0; this.meteors.length = 0; this.flyers.length = 0;
    this.projectiles.length = 0;
    this.fx.clear();
    this.nest = null; this.sleeping = false; this.sleepFade = 0;
    this.day = 1; this.tod = 0.26; this.time = 0;
    this.weather = { type: "clear", name: "☀ 晴朗", t: 34, rain: 0, fog: 0, tr: 0, tf: 0, wind: 0.25, strikeT: 6 };
    this.event = null; this.eventT = 0; this.nextEventT = 70 + Math.random() * 50; this.predBuff = 1;
    this.stats = this.blankStats();
    this.ach = {};
    this.playerTarget = null;
    this.graceT = saved ? 12 : 45;   // 开局/读档后的适应期，掠食者暂不盯上你
    this.graceDone = false;

    var rng = U.mulberry32(this.seedVal ^ 0x1f3d);
    var spot = null;
    for (var i = 0; i < 300 && !spot; i++) {
      var c = this.world.randomSpawn(rng, 34);
      if (this.world.typeAt(c.x, c.y) >= D.T.GRASS && !this.world.inVillage(c.x, c.y, 420)) spot = c;
    }
    if (!spot) spot = this.world.randomSpawn(rng, 34);

    this.player = new D.Creature(spKey, spot.x, spot.y, { player: true, level: 1, hunger: 82, thirst: 82 });
    this.creatures.push(this.player);

    if (saved) {
      var p = this.player;
      p.level = saved.level || 1; p.exp = saved.exp || 0;
      p.applyLevel(false);
      p.hp = Math.min(p.maxHp, saved.hp || p.maxHp);
      p.hunger = saved.hunger != null ? saved.hunger : 80;
      p.thirst = saved.thirst != null ? saved.thirst : 80;
      var lp = this.world.findLand(saved.x || spot.x, saved.y || spot.y, p.radius);
      p.x = lp.x; p.y = lp.y;
      this.day = saved.day || 1; this.tod = saved.tod != null ? saved.tod : 0.26;
      this.stats = saved.stats || this.blankStats();
      this.ach = saved.ach || {};
      if (saved.nest) this.nest = { x: saved.nest.x, y: saved.nest.y };
      if (saved.relics) { p.relics = saved.relics; p.applyLevel(true); }
      if (saved.mana != null) p.mana = Math.min(p.manaMax, saved.mana);
      if (saved.villages && this.world.villages) {
        for (var vi = 0; vi < this.world.villages.length && vi < saved.villages.length; vi++) {
          var sv = saved.villages[vi];
          this.world.villages[vi].ruined = !!sv.r;
          this.world.villages[vi].totemDown = !!sv.r;
          this.world.villages[vi].totemHp = sv.hp || 0;
        }
      }
    }

    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.updateCamera(0.016);
    this.initPopulation();
    this.buildGrid();
    this.initFlyers();
    this.state = "play";
    this.paused = false;
    this.show(null);
    if (this.el.hud) this.el.hud.classList.remove("hidden");
    this.applyTouchVisibility();
    this.updateHud(true);
    this.toast("你是一只" + D.STAGES[0] + this.player.def.name + "，活下去！", "info");
    var self = this;
    setTimeout(function () { if (self.state === "play") self.toast("饱食与水分会下降，注意补给", "info"); }, 5200);
    setTimeout(function () {
      if (self.state !== "play" || !self.player) return;
      var B = D.Magic.breathOf(self.player);
      if (B) self.toast("试试吐息：" + B.name + "（手机点「" + B.short + "」/ 键盘 Q）", "info");
    }, 11500);
    if (!this.running) { this.running = true; this.lastTs = 0; this.tick(); }
  };

  G.popTargets = function () {
    var day = this.day;
    return {
      compy: 12, para: 7, trike: 4, stego: 3, anky: 2,
      raptor: 2 + Math.min(4, day - 1),
      rex: day >= 2 ? 1 : 0,
      spino: day >= 4 ? 1 : 0
    };
  };

  G.spawn = function (spKey, x, y, opts) {
    if (this.creatures.length > 150) return null;
    var c = new D.Creature(spKey, x, y, opts);
    this.creatures.push(c);
    this.gridInsert(c);
    return c;
  };

  // 玩家在幼年期受到的伤害减免，避免开局被瞬杀
  G.playerDamageMul = function () {
    var p = this.player;
    if (!p) return 1;
    var m = [0.5, 0.72, 0.88, 1][p.stage] || 1;
    if (D.Magic.relicHas(p, "stoneskin")) m *= 0.8;
    return m;
  };

  G.initPopulation = function () {
    var rng = U.mulberry32(this.seedVal ^ 0x2b7);
    var t = this.popTargets();
    for (var k in t) {
      for (var i = 0; i < t[k]; i++) {
        var s = this.world.spawnRing(rng, this.player.x, this.player.y, 380, 1700, D.SPECIES[k].size);
        if (!s) s = this.world.randomSpawn(rng, D.SPECIES[k].size);
        var lv = 1 + Math.floor(rng() * (D.SPECIES[k].apex ? 4 : 4));
        this.spawn(k, s.x, s.y, { level: lv });
      }
    }
  };

  G.initFlyers = function () {
    this.flyers.length = 0;
    for (var i = 0; i < 4; i++) {
      var a = Math.random() * U.TAU;
      this.flyers.push({
        x: this.player.x + Math.cos(a) * 500, y: this.player.y + Math.sin(a) * 500,
        alt: 120 + Math.random() * 90, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 60,
        ph: Math.random() * 6
      });
    }
  };

  /* ---------------- 主循环 ---------------- */
  G.tick = function () {
    var self = this;
    var step = function (ts) {
      if (!self.running) return;
      var dt = self.lastTs ? (ts - self.lastTs) / 1000 : 0.016;
      self.lastTs = ts;
      dt = U.clamp(dt, 0.001, 0.05);
      if (self.state === "play" && !self.paused) {
        self.update(dt);
        self.measureFps(dt);
      }
      if (self.state === "play" || self.state === "pause" || self.state === "over") {
        if (self.world) D.Render.draw(self);
      }
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(step);
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(step);
  };

  G.measureFps = function (dt) {
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 1) {
      var fps = this.fpsN / this.fpsAcc;
      this.fpsAcc = 0; this.fpsN = 0;
      if (fps < 42) this.fpsLow++; else this.fpsLow = Math.max(0, this.fpsLow - 1);
      if (this.fpsLow >= 3 && !this.autoDropped && this.settings.quality !== "low") {
        this.autoDropped = true;
        this.quality = Math.max(0, this.quality - 1);
        this.resize();
        this.toast("已自动降低画质以保持流畅", "info");
      }
    }
  };

  G.update = function (dt) {
    var mult = (this.sleeping && this.sleepFade >= 1) ? 9 : 1;
    this.buildGrid();
    this.time += dt;
    this.updateTime(dt * mult);
    if (this.graceT > 0) {
      this.graceT -= dt;
      if (this.player) this.player.untargetable = this.graceT > 0;
      if (this.graceT <= 0 && !this.graceDone) {
        this.graceDone = true;
        if (this.player) this.player.untargetable = false;
        this.toast("掠食者开始注意到你了，小心行事", "bad");
      }
    }
    this.updateWeather(dt);
    this.updateEvents(dt);
    this.controlPlayer(dt);
    if (this.state !== "play") return;
    this.updateCreatures(dt);
    this.updateAllies(dt);
    this.updateEggs(dt);
    this.updateMeteors(dt);
    this.updateFires(dt);
    this.updateFlyers(dt);
    D.Magic.updateProjectiles(this, dt);
    D.Magic.updateVillages(this, dt);
    D.Magic.updateWorldMagic(this, dt);
    if (this.manaWarnT > 0) this.manaWarnT -= dt;
    this.world.update(dt, this.weather.rain > 0.3);
    this.fx.update(dt);
    this.updateSleep(dt);
    this.updatePopulation(dt);
    this.checkDanger(dt);
    this.updateCamera(dt);
    this.checkAch();
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.updateHud(false); }
    this.miniT -= dt;
    if (this.miniT <= 0) { this.miniT = 0.28; this.drawMinimap(); }
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 25; this.save(); }
  };

  G.updateTime = function (dt) {
    this.tod += dt / this.dayLength;
    while (this.tod >= 1) { this.tod -= 1; this.day++; this.onNewDay(); }
    var t = this.tod, light;
    if (t < 0.2) light = 0;
    else if (t < 0.29) light = (t - 0.2) / 0.09;
    else if (t < 0.72) light = 1;
    else if (t < 0.82) light = 1 - (t - 0.72) / 0.1;
    else light = 0;
    this.light = light;
    this.night = 1 - light;
    var extra = this.event === "bloodmoon" ? 0.1 : 0;
    this.darkness = U.clamp((1 - light) * 0.8 + extra, 0, 0.92);
    var warmDusk = Math.max(0, 1 - Math.abs(t - 0.765) / 0.07);
    var warmDawn = Math.max(0, 1 - Math.abs(t - 0.245) / 0.06);
    this.warm = Math.min(1, warmDusk + warmDawn * 0.7);
  };

  G.onNewDay = function () {
    this.stats.days = this.day;
    this.toast("第 " + this.day + " 天开始了", "good");
    this.save();
    if (this.day === 3) this.unlock("day3");
    if (this.day === 7) this.unlock("day7");
  };

  G.updateWeather = function (dt) {
    var w = this.weather;
    w.t -= dt;
    if (w.t <= 0) {
      var total = 0, i;
      for (i = 0; i < WEATHERS.length; i++) total += WEATHERS[i].w;
      var pickV = Math.random() * total, acc = 0, chosen = WEATHERS[0];
      for (i = 0; i < WEATHERS.length; i++) {
        acc += WEATHERS[i].w;
        if (pickV <= acc) { chosen = WEATHERS[i]; break; }
      }
      w.type = chosen.type; w.name = chosen.name;
      w.tr = chosen.rain; w.tf = chosen.fog; w.wind = chosen.wind;
      w.t = 45 + Math.random() * 60;
      w.strikeT = 4 + Math.random() * 5;
      if (this.state === "play") this.toast("天气转为 " + chosen.name, "info");
    }
    w.rain = U.lerp(w.rain, w.tr, Math.min(1, dt * 0.4));
    w.fog = U.lerp(w.fog, w.tf, Math.min(1, dt * 0.35));
    this.fogFactor = w.fog;
    D.Audio.setRain(w.rain);
    D.Audio.setWind(w.wind);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (w.type === "storm") {
      w.strikeT -= dt;
      if (w.strikeT <= 0) {
        w.strikeT = 3.5 + Math.random() * 8;
        this.flash = 0.85;
        D.Audio.thunder();
        var p = this.player;
        if (p && !p.dead && Math.random() < 0.4) {
          var a = Math.random() * U.TAU, r = 140 + Math.random() * 460;
          var lx = p.x + Math.cos(a) * r, ly = p.y + Math.sin(a) * r;
          this.fx.spark(lx, ly, 18, "#cfe8ff");
          this.fx.ring(lx, ly, 10, 120, "rgba(200,230,255,0.8)", 0.5);
          this.shake(9);
          var near = this.neighbors(lx, ly, 110);
          for (var n = 0; n < near.length; n++) {
            if (!near[n].dead) near[n].damage(26 + Math.random() * 14, null, this);
          }
        }
      }
    }
    var pl = this.player;
    if (pl && !pl.dead && w.rain > 0.35) pl.thirst = Math.min(100, pl.thirst + 1.5 * w.rain * dt);
  };

  /* ---------------- 事件 ---------------- */
  G.updateEvents = function (dt) {
    if (this.event) {
      this.eventT -= dt;
      if (this.event === "meteor") {
        this.meteorT -= dt;
        if (this.meteorT <= 0 && this.eventT > 3) {
          this.meteorT = 1.1 + Math.random() * 1.3;
          var p = this.player;
          if (p) {
            var a = Math.random() * U.TAU, r = 60 + Math.random() * 460;
            this.meteors.push({
              x: U.clamp(p.x + Math.cos(a) * r, 60, this.world.w - 60),
              y: U.clamp(p.y + Math.sin(a) * r, 60, this.world.h - 60),
              t: 0, dur: 1.9, r: 78 + Math.random() * 46
            });
          }
        }
      }
      if (this.eventT <= 0) this.endEvent();
      return;
    }
    this.nextEventT -= dt;
    if (this.nextEventT <= 0) this.startEvent();
  };

  G.startEvent = function () {
    var pool = ["stampede", "tribe"];
    if (this.day >= 2) pool.push("meteor");
    if (this.night > 0.5) pool.push("bloodmoon", "manasurge");
    if (this.day >= 3) pool.push("migration", "manasurge");
    if (this.day >= 5) pool.push("dragonlord");
    var ev = pool[Math.floor(Math.random() * pool.length)];
    this.event = ev;
    this.nextEventT = 999;
    var p = this.player;
    if (ev === "meteor") {
      this.eventT = 17; this.meteorT = 0.6;
      this.toast("⚠ 陨石雨来袭！远离红色光圈", "bad");
      D.Audio.roar(2);
    } else if (ev === "bloodmoon") {
      this.eventT = 55; this.predBuff = 1.4;
      this.toast("🔴 血月升起，掠食者变得狂暴", "bad");
      var rng = U.mulberry32((Math.random() * 1e9) | 0);
      for (var i = 0; i < 2; i++) {
        var s = this.world.spawnRing(rng, p.x, p.y, 700, 1200, 34);
        if (s) this.spawn(this.day >= 4 ? "spino" : "rex", s.x, s.y, { level: 4 + Math.floor(Math.random() * 6) });
      }
    } else if (ev === "tribe") {
      this.eventT = 45;
      this.toast("🗡 部落狩猎队正在逼近", "bad");
      var rngT = U.mulberry32((Math.random() * 1e9) | 0);
      var baseT = this.world.spawnRing(rngT, p.x, p.y, 700, 1000, 14);
      if (baseT) {
        var party = ["hunter", "hunter", "hunter", "spearman", "shaman"];
        if (this.day >= 4) party.push("chief");
        for (var pi = 0; pi < party.length; pi++) {
          var ptx = baseT.x + (Math.random() - 0.5) * 150, pty = baseT.y + (Math.random() - 0.5) * 150;
          var lp2 = this.world.findLand(ptx, pty, 12);
          var hh = this.spawn(party[pi], lp2.x, lp2.y, { level: 2 + Math.floor(Math.random() * (2 + this.day)) });
          if (hh) { hh.homeX = p.x; hh.homeY = p.y; hh.target = this.player; hh.state = "hunt"; }
        }
      }
      D.Audio.roar(0.8);
    } else if (ev === "manasurge") {
      this.eventT = 48;
      this.toast("✨ 魔潮涌动：魔力回复大增，幽影出没", "info");
      D.Audio.magic();
      var rngM = U.mulberry32((Math.random() * 1e9) | 0);
      var nW = this.night > 0.5 ? 3 : 1;
      for (var wi = 0; wi < nW; wi++) {
        var sw2 = this.world.spawnRing(rngM, p.x, p.y, 620, 1200, 20);
        if (sw2) this.spawn("wraith", sw2.x, sw2.y, { level: 2 + Math.floor(Math.random() * (2 + this.day)) });
      }
      var rs2 = this.world.runes || [];
      for (var rj = 0; rj < rs2.length; rj++) rs2[rj].cd = 0;
    } else if (ev === "dragonlord") {
      this.eventT = 95;
      this.toast("🐲 龙王降临！熔岩暴龙正在靠近", "bad");
      D.Audio.roar(2.4);
      this.shake(20);
      this.flash = 0.5;
      var rngD = U.mulberry32((Math.random() * 1e9) | 0);
      var sd = this.world.spawnRing(rngD, p.x, p.y, 900, 1400, 42);
      if (sd) this.spawn("lavarex", sd.x, sd.y, { level: 6 + Math.min(8, this.day) });
    } else if (ev === "stampede") {
      this.eventT = 26;
      this.toast("🦶 副栉龙群正在迁徙", "info");
      var rng2 = U.mulberry32((Math.random() * 1e9) | 0);
      var base = this.world.spawnRing(rng2, p.x, p.y, 600, 900, 26);
      if (base) {
        for (var j = 0; j < 6; j++) {
          var c = this.spawn("para", base.x + (Math.random() - 0.5) * 240, base.y + (Math.random() - 0.5) * 240, { level: 2 + Math.floor(Math.random() * 5) });
          if (c) { c.wanderT = 20; c.wx = base.x + (Math.random() - 0.5) * 400; c.wy = base.y - 1200; }
        }
      }
    } else {
      this.eventT = 34;
      this.toast("🌿 一群植食恐龙经过这里", "info");
      var rng3 = U.mulberry32((Math.random() * 1e9) | 0);
      var b2 = this.world.spawnRing(rng3, p.x, p.y, 500, 900, 30);
      if (b2) {
        for (var k = 0; k < 4; k++) {
          this.spawn(Math.random() < 0.5 ? "stego" : "anky", b2.x + (Math.random() - 0.5) * 260, b2.y + (Math.random() - 0.5) * 260, { level: 3 + Math.floor(Math.random() * 6) });
        }
      }
    }
  };

  G.endEvent = function () {
    if (this.event === "meteor") this.unlock("meteor");
    this.event = null;
    this.predBuff = 1;
    this.nextEventT = 70 + Math.random() * 80;
  };

  G.updateMeteors = function (dt) {
    for (var i = this.meteors.length - 1; i >= 0; i--) {
      var m = this.meteors[i];
      m.t += dt;
      if (m.t >= m.dur) {
        this.meteors.splice(i, 1);
        this.fx.spark(m.x, m.y, 26, "#ffb347");
        this.fx.ring(m.x, m.y, 12, m.r * 1.6, "rgba(255,170,90,0.75)", 0.6);
        this.fires.push({ x: m.x, y: m.y, r: m.r * 0.75, t: 8 + Math.random() * 4, dmgT: 0 });
        this.shake(16);
        D.Audio.boom();
        this.vibrate(90);
        var near = this.neighbors(m.x, m.y, m.r);
        for (var n = 0; n < near.length; n++) {
          var c = near[n];
          if (c.dead) continue;
          var dd = U.dist(m.x, m.y, c.x, c.y);
          c.damage(46 * (1 - dd / m.r) + 12, null, this);
        }
      }
    }
  };

  G.updateFires = function (dt) {
    for (var i = this.fires.length - 1; i >= 0; i--) {
      var f = this.fires[i];
      f.t -= dt;
      if (f.t <= 0) { this.fires.splice(i, 1); continue; }
      if (this.quality > 0 && Math.random() < dt * 12) this.fx.ember(f.x + (Math.random() - 0.5) * f.r, f.y + (Math.random() - 0.5) * f.r * 0.5);
      f.dmgT -= dt;
      if (f.dmgT <= 0) {
        f.dmgT = 0.5;
        var near = this.neighbors(f.x, f.y, f.r * 0.8);
        for (var n = 0; n < near.length; n++) {
          if (!near[n].dead) near[n].damage(7, null, this);
        }
      }
    }
  };

  G.updateFlyers = function (dt) {
    var p = this.player;
    if (!p) return;
    for (var i = 0; i < this.flyers.length; i++) {
      var f = this.flyers[i];
      f.x += f.vx * dt; f.y += f.vy * dt; f.ph += dt * 5.5;
      if (Math.random() < dt * 0.4) {
        var a = Math.atan2(f.vy, f.vx) + (Math.random() - 0.5) * 1.2;
        var s = 70 + Math.random() * 60;
        f.vx = Math.cos(a) * s; f.vy = Math.sin(a) * s;
      }
      if (U.dist(f.x, f.y, p.x, p.y) > 1300) {
        var ang = Math.random() * U.TAU;
        f.x = p.x + Math.cos(ang) * 900; f.y = p.y + Math.sin(ang) * 900;
        f.vx = (p.x - f.x) * 0.1; f.vy = (p.y - f.y) * 0.1;
      }
    }
  };

  /* ---------------- 生态 ---------------- */
  G.gridInsert = function (c) {
    var cs = this.gridSize;
    var k = Math.floor(c.x / cs) + ":" + Math.floor(c.y / cs);
    var a = this.grid.get(k);
    if (!a) { a = []; this.grid.set(k, a); }
    a.push(c);
  };

  G.buildGrid = function () {
    this.grid.clear();
    for (var i = 0; i < this.creatures.length; i++) this.gridInsert(this.creatures[i]);
  };

  G.neighbors = function (x, y, r) {
    var out = [], cs = this.gridSize, r2 = r * r;
    var c0 = Math.floor((x - r) / cs), c1 = Math.floor((x + r) / cs);
    var r0 = Math.floor((y - r) / cs), r1 = Math.floor((y + r) / cs);
    for (var cy = r0; cy <= r1; cy++) {
      for (var cx = c0; cx <= c1; cx++) {
        var a = this.grid.get(cx + ":" + cy);
        if (!a) continue;
        for (var i = 0; i < a.length; i++) {
          if (U.dist2(x, y, a[i].x, a[i].y) <= r2) out.push(a[i]);
        }
      }
    }
    return out;
  };

  G.near = function (c, d) {
    var p = this.player;
    if (!p) return false;
    return U.dist2(p.x, p.y, c.x, c.y) < d * d;
  };

  G.inView = function (x, y, m) {
    var v = this.view;
    return x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;
  };

  G.updateCreatures = function (dt) {
    var l = this.creatures, i;
    for (i = 0; i < l.length; i++) l[i].update(dt, this);
    this.resolveOverlap();
    var j = 0;
    for (i = 0; i < l.length; i++) {
      var c = l[i];
      if (c.remove && c !== this.player) continue;
      l[j++] = c;
    }
    l.length = j;
  };

  G.resolveOverlap = function () {
    var l = this.creatures;
    for (var i = 0; i < l.length; i++) {
      var a = l[i];
      if (a.dead) continue;
      var nb = this.neighbors(a.x, a.y, a.radius * 2 + 60);
      for (var k = 0; k < nb.length; k++) {
        var b = nb[k];
        if (b === a || b.dead || b.id < a.id) continue;
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        var min = (a.radius + b.radius) * 0.85;
        if (d >= min) continue;
        var push = (min - d) / d * 0.5;
        var wa = b.radius / (a.radius + b.radius), wb = 1 - wa;
        var ax = a.x - dx * push * wa, ay = a.y - dy * push * wa;
        var bx = b.x + dx * push * wb, by = b.y + dy * push * wb;
        if (this.world.canWalk(ax, ay, a.radius * 0.7)) { a.x = ax; a.y = ay; }
        if (this.world.canWalk(bx, by, b.radius * 0.7)) { b.x = bx; b.y = by; }
      }
    }
  };

  G.updatePopulation = function (dt) {
    this.popT = (this.popT || 0) - dt;
    if (this.popT > 0) return;
    this.popT = 2.5;
    var p = this.player;
    if (!p) return;
    var counts = {}, i, c;
    for (i = 0; i < this.creatures.length; i++) {
      c = this.creatures[i];
      if (c.isPlayer || c.ally || c.dead) continue;
      counts[c.sp] = (counts[c.sp] || 0) + 1;
      // 远离玩家的生物回收
      if (!c.def.apex && U.dist2(c.x, c.y, p.x, p.y) > 2400 * 2400) c.remove = true;
    }
    var t = this.popTargets();
    var rng = Math.random;
    var wantWraith = (this.night > 0.55 ? (this.day >= 2 ? 2 : 1) : 0);
    var haveWraith = counts.wraith || 0;
    if (haveWraith < wantWraith) {
      var swp = this.world.spawnRing(rng, p.x, p.y, 700, 1300, 20);
      if (swp) this.spawn("wraith", swp.x, swp.y, { level: 2 + Math.floor(rng() * (2 + this.day)) });
    } else if (this.night < 0.25 && haveWraith > 0) {
      for (i = 0; i < this.creatures.length; i++) {
        var cw = this.creatures[i];
        if (cw.sp === "wraith" && !cw.dead) {
          cw.remove = true;
          this.fx.spray(cw.x, cw.y, 8, { col: "#8f9bff", r: 3, sp: 40, life: 0.6 });
        }
      }
    }
    for (var k in t) {
      var missing = t[k] - (counts[k] || 0);
      if (missing <= 0) continue;
      var batch = D.SPECIES[k].pack ? Math.min(missing, 2) : 1;
      var far = (this.graceT > 0 && D.SPECIES[k].diet === "carn");
      for (var b = 0; b < batch; b++) {
        var s = this.world.spawnRing(rng, p.x, p.y, far ? 1300 : 620, far ? 2100 : 1400, D.SPECIES[k].size);
        if (!s) continue;
        var lvBase = D.SPECIES[k].apex ? 4 : 1;
        this.spawn(k, s.x, s.y, { level: lvBase + Math.floor(rng() * (3 + this.day)) });
      }
    }
  };

  G.checkDanger = function (dt) {
    this.dangerT = (this.dangerT || 0) - dt;
    if (this.dangerT > 0) return;
    this.dangerT = 2.5;
    var p = this.player;
    if (!p || p.dead) return;
    var list = this.neighbors(p.x, p.y, 780), found = null;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o.dead || o.ally || o.isPlayer) continue;
      if (o.def.apex || o.power > p.power * 2.2) { found = o; break; }
    }
    if (found && !this.dangerFlag) {
      this.dangerFlag = true;
      this.toast("⚠ 大地在颤动 —— 附近有" + found.def.name + "，快躲开", "bad");
      this.vibrate(80);
      D.Audio.roar(1.6);
    } else if (!found) this.dangerFlag = false;
  };

  G.updateAllies = function (dt) {
    for (var i = this.allies.length - 1; i >= 0; i--) {
      var a = this.allies[i];
      if (a.dead || a.remove) this.allies.splice(i, 1);
    }
  };

  G.updateEggs = function (dt) {
    for (var i = this.eggs.length - 1; i >= 0; i--) {
      var e = this.eggs[i];
      e.t -= dt;
      if (e.t <= 0) {
        this.eggs.splice(i, 1);
        var c = this.spawn(this.player.sp, e.x, e.y, { ally: true, level: 1 });
        if (c) {
          this.allies.push(c);
          this.stats.hatch++;
          this.fx.spark(e.x, e.y, 12, "#fff2c0");
          D.Audio.hatch();
          this.toast("一只幼崽孵化了！它会跟随你战斗", "good");
          this.unlock("hatch");
        }
      }
    }
  };

  /* ---------------- 玩家 ---------------- */
  G.controlPlayer = function (dt) {
    var p = this.player, In = D.Input;
    if (!p) return;
    if (p.dead) return;
    In.update();
    var ax = In.axis.x, ay = In.axis.y;
    var mag = Math.min(1, U.len(ax, ay));
    if (this.sleeping) { p.throttle = 0; }
    else if (mag > 0.14) {
      p.dirWanted = Math.atan2(ay, ax);
      p.throttle = U.clamp((mag - 0.1) / 0.8, 0, 1);
    } else p.throttle = 0;

    var wantSprint = In.btn.sprint && p.stamina > 2 && p.throttle > 0.25 && !this.sleeping;
    p.sprinting = wantSprint;
    if (wantSprint) p.stamina = Math.max(0, p.stamina - 19 * dt);
    else p.stamina = Math.min(100, p.stamina + (p.throttle > 0.15 ? 12 : 19) * dt);

    var d = p.def;
    var burn = p.sprinting ? 2.0 : (p.throttle > 0.2 ? 1.15 : 0.75);
    p.hunger = Math.max(0, p.hunger - 0.42 * d.appetite * burn * dt);
    p.thirst = Math.max(0, p.thirst - 0.5 * d.thirsty * (0.75 + burn * 0.25) * dt);
    if (p.hunger <= 0 || p.thirst <= 0) {
      p.hp -= p.maxHp * 0.021 * dt;
      this.warnT -= dt;
      if (this.warnT <= 0) {
        this.warnT = 12;
        this.toast(p.hunger <= 0 ? "你快饿死了！赶紧找食物" : "你严重脱水！赶紧找水源", "bad");
      }
      if (p.hp <= 0) { p.die(null, this); return; }
    } else if (p.hp < p.maxHp && p.hunger > 40 && p.thirst > 30) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.012 * dt);
    }

    p.mana = Math.min(p.manaMax, p.mana + D.Magic.manaRegen(this, p) * dt);
    this.currentAct = this.resolveAct();
    if (this.sleeping) {
      if (In.consume("act") || In.consume("attack") || mag > 0.4) this.wake("你醒了");
      In.consume("nest"); In.consume("roar");
      return;
    }
    if (In.btn.attack) this.doAttack();
    if (In.btn.breath) this.doBreath();
    if (In.btn.act && this.currentAct) this.performAct(this.currentAct, dt);
    if (In.consume("roar")) this.doRoar();
    if (In.consume("nest")) this.nestAction();
    In.consume("act");
    In.consume("attack");
    In.consume("breath");
  };

  G.resolveAct = function () {
    var p = this.player;
    if (!p || p.dead) return null;
    var rs = this.world.runes || [];
    for (var ri = 0; ri < rs.length; ri++) {
      var rn = rs[ri];
      if (rn.cd > 0) continue;
      if (U.dist2(p.x, p.y, rn.x, rn.y) < rn.r * rn.r * 0.7) return { type: "rune", target: rn, label: "祈祷" };
    }
    var water = null;
    var w = this.world.findWater(p.x, p.y, 200);
    if (w && U.dist(p.x, p.y, w.x, w.y) < p.radius + 78 && p.thirst < 99.5) {
      water = { type: "drink", target: w, label: "喝水" };
    }
    if (water && p.thirst < 32) return water;
    if (p.def.diet !== "herb") {
      var list = this.neighbors(p.x, p.y, p.radius + 120);
      var best = null, bd = 1e9;
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        if (!o.dead || o.meat <= 0) continue;
        var dd = U.dist(p.x, p.y, o.x, o.y);
        if (dd > p.radius + o.radius * 0.9 + 26) continue;
        if (dd < bd) { bd = dd; best = o; }
      }
      if (best && p.hunger < 99.5) return { type: "eat", target: best, label: "进食" };
    }
    if (p.def.diet !== "carn") {
      var pl = this.world.findPlant(p.x, p.y, p.radius + 62, 6);
      if (pl && p.hunger < 99.5) return { type: "graze", target: pl, label: "吃草" };
    }
    return water;
  };

  G.performAct = function (act, dt) {
    var p = this.player;
    if (act.type === "eat") {
      p.feedCorpse(act.target, dt, this);
      this.stats.meals += dt;
    } else if (act.type === "graze") {
      p.grazePlant(act.target, dt, this);
      this.stats.meals += dt;
    } else if (act.type === "rune") {
      D.Magic.activateRune(this, act.target);
    } else if (act.type === "drink") {
      p.thirst = Math.min(100, p.thirst + 30 * dt);
      p.eatT = 0.25;
      this.stats.drinks += dt;
      if (Math.random() < dt * 8) {
        this.fx.splash(act.target.x, act.target.y, 16);
        D.Audio.drink();
      }
    }
  };

  G.doAttack = function () {
    var p = this.player;
    if (p.attackCd > 0 || p.dead) return;
    p.attackCd = p.def.atkRate * 0.92;
    p.atkAnim = 0.3;
    p.stamina = Math.max(0, p.stamina - 4);
    D.Audio.bite(p.scale);
    var reach = p.radius * 0.9 + p.def.reach * p.scale + 30;
    this.fx.slash(
      p.x + Math.cos(p.face) * p.radius * 0.7,
      p.y + Math.sin(p.face) * p.radius * 0.7 - p.radius * 0.35,
      p.face, reach * 0.85
    );
    var list = this.neighbors(p.x, p.y, reach + 60), hit = 0;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === p || o.remove || o.dead || o.ally) continue;
      var dd = U.dist(p.x, p.y, o.x, o.y);
      if (dd > p.reach(o) + 16) continue;
      var ang = Math.atan2(o.y - p.y, o.x - p.x);
      if (Math.abs(U.angleDiff(p.face, ang)) > 1.0) continue;
      var dmg = p.dmg * (0.9 + Math.random() * 0.28);
      var crit = Math.random() < 0.12;
      if (crit) dmg *= 1.85;
      if (p.bless && p.bless.dmg) dmg *= p.bless.dmg;
      o.damage(dmg, p, this);
      if (D.Magic.relicHas(p, "hexfang")) D.Magic.applyBurn(o, 3, p.dmg * 0.22, this);
      if (D.Magic.relicHas(p, "frostheart")) D.Magic.applyChill(o, 2.5);
      this.fx.text(o.x, o.y - o.radius - 8, (crit ? "会心 " : "") + Math.round(dmg), crit ? "#ffce54" : "#ffe4dc");
      this.playerTarget = o;
      hit++;
    }
    if (hit) {
      this.shake(3.2);
      this.vibrate(16);
      this.stats.hits++;
    }
  };

  G.doBreath = function () {
    var p = this.player;
    if (!p || p.dead || this.sleeping) return;
    var B = D.Magic.breathOf(p);
    if (!B) return;
    if (!D.Magic.canCast(p)) {
      if (p.breathCd <= 0 && p.mana < D.Magic.costOf(p, B) && !(this.manaWarnT > 0)) {
        this.manaWarnT = 4;
        this.toast("魔力不足 —— 去魔力水晶或符文圈旁回魔", "bad");
      }
      return;
    }
    D.Magic.cast(this, p);
    this.stats.breaths++;
  };

  G.doRoar = function () {
    var p = this.player;
    if (p.dead || p.roarT > 0 || p.stamina < 14) return;
    p.roarT = 0.95;
    p.stamina -= 14;
    this.stats.roars++;
    D.Audio.roar(p.scale);
    this.shake(5);
    this.vibrate(45);
    this.fx.ring(p.x, p.y, 30, 460, "rgba(255,240,200,0.6)", 0.85);
    var list = this.neighbors(p.x, p.y, 620);
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === p || o.dead || o.ally) continue;
      if (o.power < p.power * 1.05) {
        o.scaredT = 5; o.fleeT = 4.5; o.fleeFrom = p; o.state = "flee"; o.thinkT = 0.5;
      } else {
        o.grudge = p.id; o.target = p; o.state = "fight"; o.thinkT = 0.4;
      }
    }
    this.toast("咆哮震彻森林", "info");
  };

  G.nestAction = function () {
    var p = this.player;
    if (p.dead) return;
    if (!this.nest) {
      if (this.world.isWater(p.x, p.y)) { this.toast("不能在水里筑巢", "bad"); return; }
      if (p.hunger < 45 || p.thirst < 30) { this.toast("太虚弱了，先吃饱喝足再筑巢", "bad"); return; }
      this.nest = { x: p.x, y: p.y };
      p.hunger -= 20;
      this.stats.nests++;
      D.Audio.level();
      this.fx.ring(p.x, p.y, 10, 90, "rgba(255,206,84,0.7)", 0.7);
      this.toast("巢穴建成！夜里可在此睡觉，白天可产蛋", "good");
      this.unlock("nest");
      return;
    }
    var dd = U.dist(p.x, p.y, this.nest.x, this.nest.y);
    if (dd > 100) {
      this.toast("巢在小地图金色点处（约 " + Math.round(dd / 10) + " 米）", "info");
      return;
    }
    if (this.night > 0.42) { this.sleep(); return; }
    if (this.eggs.length + this.allies.length >= 3) { this.toast("幼崽数量已达上限", "info"); return; }
    if (p.hunger < 55) { this.toast("饱食度不足 55，无法产蛋", "bad"); return; }
    p.hunger -= 30;
    this.eggs.push({
      x: this.nest.x + (Math.random() - 0.5) * 44,
      y: this.nest.y + (Math.random() - 0.5) * 18,
      t: 40
    });
    this.stats.eggs++;
    D.Audio.egg();
    this.toast("产下一枚蛋，约 40 秒后孵化", "good");
  };

  G.sleep = function () {
    var p = this.player;
    var list = this.neighbors(p.x, p.y, 460);
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o.dead || o.ally || o.isPlayer) continue;
      if (o.def.diet === "carn" && o.power > p.power * 0.6) {
        this.toast("附近有掠食者，无法安睡", "bad");
        return;
      }
    }
    this.sleeping = true;
    this.toast("睡下了... 到天亮为止", "info");
  };

  G.wake = function (msg) {
    if (!this.sleeping) return;
    this.sleeping = false;
    if (msg) this.toast(msg, "info");
  };

  G.updateSleep = function (dt) {
    if (!this.sleeping) {
      this.sleepFade = Math.max(0, this.sleepFade - dt * 2.4);
      return;
    }
    var p = this.player;
    this.sleepFade = Math.min(1, this.sleepFade + dt * 2.2);
    var list = this.neighbors(p.x, p.y, 340);
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (!o.dead && !o.ally && !o.isPlayer && o.def.diet === "carn" && o.power > p.power * 0.55) {
        this.wake("有东西靠近，你惊醒了！");
        return;
      }
    }
    if (this.sleepFade >= 1) {
      var k = dt * 9;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.05 * k);
      p.hunger = Math.max(0, p.hunger - 0.16 * k);
      p.thirst = Math.max(0, p.thirst - 0.14 * k);
      p.stamina = 100;
      if (this.tod > 0.235 && this.tod < 0.45) {
        this.sleeping = false;
        this.stats.sleeps++;
        this.toast("天亮了，你恢复了体力", "good");
      }
    }
  };

  /* ---------------- 回调 ---------------- */
  G.onAttack = function (a, t) {
    if (a.isPlayer || !t || t.dead || t.remove) return;
    if (U.dist(a.x, a.y, t.x, t.y) > a.reach(t) * 1.3) return;
    var dmg = a.dmg * (0.85 + Math.random() * 0.3);
    t.damage(dmg, a, this);
    if (this.near(a, 800)) D.Audio.bite(a.scale);
  };

  G.onDeath = function (victim, killer) {
    if (victim.def.kind === "struct") {
      if (killer === this.player) D.Magic.onStructDestroyed(this, victim);
      else if (victim.village) { victim.village.totem = null; }
      return;
    }
    if (victim === this.player) {
      var why = killer ? ("被" + killer.def.name + "杀死") :
        (victim.hunger <= 0 ? "饿死在荒野中" : victim.thirst <= 0 ? "因缺水而死" : "死于天灾");
      this.gameOver(why);
      return;
    }
    if (victim.ally) {
      var idx = this.allies.indexOf(victim);
      if (idx >= 0) this.allies.splice(idx, 1);
      this.toast("你的幼崽死了...", "bad");
    }
    if (killer === this.player) {
      this.stats.kills++;
      var exp = 14 + victim.maxHp * 0.24;
      this.player.gainExp(exp, this);
      this.fx.text(victim.x, victim.y - victim.radius - 22, "+" + Math.round(exp) + " 成长", "#dcb0ff");
      this.toast("击杀 " + victim.def.name + "，可以进食了", "good");
      this.vibrate(60);
      if (this.stats.kills === 1) this.unlock("firstKill");
      if (victim.def.apex) this.unlock("apex");
      if (victim.def.kind === "human") this.stats.humans++;
      if (victim.def.manaDrop) {
        this.player.mana = Math.min(this.player.manaMax, this.player.mana + victim.def.manaDrop);
        this.fx.text(victim.x, victim.y - victim.radius - 34, "+" + victim.def.manaDrop + " 魔力", "#9ff0ff");
      }
      if (victim.def.boss) {
        this.unlock("dragonlord");
        this.player.gainExp(220, this);
        D.Magic.giveRelic(this, "emberheart");
        this.toast("龙王倒下了！你继承了它的地火", "good");
      }
    }
  };

  G.onLevelUp = function () {
    var p = this.player;
    D.Audio.level();
    this.vibrate(70);
    this.fx.ring(p.x, p.y, 15, 190, "rgba(199,139,245,0.8)", 0.9);
    this.fx.text(p.x, p.y - p.radius * 2.2, "Lv " + p.level, "#ffce54");
    this.stats.maxLevel = Math.max(this.stats.maxLevel, p.level);
    this.toast("成长！" + D.STAGES[p.stage] + " · Lv " + p.level, "good");
    if (p.stage >= 2) this.unlock("adult");
    if (p.stage >= 3) this.unlock("fullgrown");
  };

  G.unlock = function (id) {
    if (this.ach[id] || !ACH[id]) return;
    this.ach[id] = 1;
    this.toast("🏆 " + ACH[id], "good");
  };

  G.checkAch = function () {
    if (this.stats.days >= 3) this.unlock("day3");
    if (this.stats.days >= 7) this.unlock("day7");
    if (this.stats.breaths >= 50) this.unlock("breather");
    if (this.stats.humans >= 10) this.unlock("manhunt");
  };

  G.shake = function (v) { this.cam.shake = Math.min(26, this.cam.shake + v); };

  G.vibrate = function (ms) {
    if (!this.settings.vibe) return;
    try { if (navigator && navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  };

  G.updateCamera = function (dt) {
    var p = this.player, cam = this.cam;
    if (p) {
      var lead = p.radius * 1.1 + p.speedNow * 0.18;
      var tx = p.x + Math.cos(p.face) * lead;
      var ty = p.y + Math.sin(p.face) * lead;
      var k = Math.min(1, dt * 4.2);
      cam.x = U.lerp(cam.x, tx, k);
      cam.y = U.lerp(cam.y, ty, k);
    }
    var hw = this.vw / 2 / cam.zoom, hh = this.vh / 2 / cam.zoom;
    cam.x = this.world.w > hw * 2 ? U.clamp(cam.x, hw, this.world.w - hw) : this.world.w / 2;
    cam.y = this.world.h > hh * 2 ? U.clamp(cam.y, hh, this.world.h - hh) : this.world.h / 2;
    cam.shake *= Math.pow(0.0008, dt);
    if (cam.shake < 0.2) cam.shake = 0;
    cam.sx = (Math.random() - 0.5) * cam.shake;
    cam.sy = (Math.random() - 0.5) * cam.shake;
    this.view.x0 = cam.x - hw - 40;
    this.view.x1 = cam.x + hw + 40;
    this.view.y0 = cam.y - hh - 40;
    this.view.y1 = cam.y + hh + 40;
  };

  /* ---------------- HUD ---------------- */
  G.pct = function (v) { return U.clamp(v, 0, 100).toFixed(1) + "%"; };

  G.updateHud = function (force) {
    var p = this.player, e = this.el;
    if (!p) return;
    if (e.fHp) e.fHp.style.width = this.pct(p.hp / p.maxHp * 100);
    if (e.fFood) e.fFood.style.width = this.pct(p.hunger);
    if (e.fWater) e.fWater.style.width = this.pct(p.thirst);
    if (e.fStam) e.fStam.style.width = this.pct(p.stamina);
    if (e.fExp) e.fExp.style.width = this.pct(p.exp / D.expNeed(p.level) * 100);
    if (e.fMana) e.fMana.style.width = this.pct(p.mana / p.manaMax * 100);
    if (e.btnBreath) {
      var B = D.Magic.breathOf(p);
      e.btnBreath.textContent = B ? B.short : "吐";
      if (D.Magic.canCast(p)) e.btnBreath.classList.remove("dim");
      else e.btnBreath.classList.add("dim");
    }
    if (e.relics) {
      var rh = "";
      if (p.relics) for (var rk in p.relics) {
        if (D.Magic.RELICS[rk]) rh += "<i>" + D.Magic.RELICS[rk].icon + "</i>";
      }
      if (p.bless) rh += "<i class=\"bl\">" + (p.bless.key === "might" ? "⚔" : p.bless.key === "haste" ? "💨" : "🛡") + "</i>";
      if (e.relics.innerHTML !== rh) e.relics.innerHTML = rh;
    }
    if (e.whoName) e.whoName.textContent = p.def.name;
    if (e.whoStage) e.whoStage.textContent = D.STAGES[p.stage];
    if (e.whoLv) e.whoLv.textContent = "Lv " + p.level;
    if (e.clock) e.clock.textContent = "第 " + this.day + " 天 " + U.clockText(this.tod);
    if (e.weatherChip) {
      var ev = this.event === "bloodmoon" ? " · 血月" : this.event === "meteor" ? " · 陨石雨" : "";
      e.weatherChip.textContent = (this.night > 0.5 ? "🌙 " : "") + this.weather.name + ev;
    }
    var act = this.currentAct;
    if (e.btnAct) {
      e.btnAct.textContent = act ? act.label : "进食";
      if (act) e.btnAct.classList.remove("dim"); else e.btnAct.classList.add("dim");
    }
    if (e.btnNest) {
      var nl = "筑巢";
      if (this.nest) {
        var dd = U.dist(p.x, p.y, this.nest.x, this.nest.y);
        nl = dd > 100 ? "巢穴" : (this.night > 0.42 ? "睡觉" : "产蛋");
      }
      e.btnNest.textContent = nl;
    }
    if (e.prompt) {
      var msg = "";
      if (this.sleeping) msg = "睡眠中 · 触屏任意按钮醒来";
      else if (act) msg = this.showTouch ? ("点住「" + act.label + "」按钮") : ("按住 E " + act.label);
      else if (p.hunger < 25) msg = p.def.diet === "herb" ? "去找蕨类或灌木进食" : "去猎杀或啃食尸体";
      else if (p.thirst < 25) msg = "去水边喝水";
      if (msg) { e.prompt.textContent = msg; e.prompt.classList.remove("hidden"); }
      else e.prompt.classList.add("hidden");
    }
  };

  G.drawMinimap = function () {
    var cv = this.el.minimap;
    if (!cv || !cv.getContext) return;
    var c = cv.getContext("2d");
    if (!c) return;
    var w = this.world, W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    if (w.mini) { try { c.drawImage(w.mini, 0, 0, W, H); } catch (e) {} }
    var sx = W / w.w, sy = H / w.h;
    var p = this.player;
    if (this.nest) {
      c.fillStyle = "#ffce54";
      c.fillRect(this.nest.x * sx - 2, this.nest.y * sy - 2, 4, 4);
    }
    for (var i = 0; i < this.creatures.length; i++) {
      var o = this.creatures[i];
      if (o.isPlayer || o.dead) continue;
      if (U.dist2(o.x, o.y, p.x, p.y) > 1400 * 1400) continue;
      c.fillStyle = o.ally ? "#9dffb0"
        : o.def.kind === "human" ? "#ffffff"
        : o.def.kind === "struct" ? "#ffd257"
        : o.def.spectral ? "#9fb0ff"
        : (o.def.diet === "herb" ? "#8fd06a" : "#ff6a5a");
      var s = (o.def.apex || o.def.boss) ? 4 : (o.def.kind === "human" ? 2 : 2.4);
      c.fillRect(o.x * sx - s / 2, o.y * sy - s / 2, s, s);
    }
    var vs = w.villages || [];
    for (var vv = 0; vv < vs.length; vv++) {
      c.fillStyle = vs[vv].ruined ? "rgba(150,150,150,0.75)" : "#ff9a3a";
      c.fillRect(vs[vv].x * sx - 3, vs[vv].y * sy - 3, 6, 6);
    }
    var crs = w.crystals || [];
    for (var ci = 0; ci < crs.length; ci++) {
      c.fillStyle = "#7fd8ff";
      c.fillRect(crs[ci].x * sx - 1.5, crs[ci].y * sy - 1.5, 3, 3);
    }
    var rns = w.runes || [];
    for (var rj2 = 0; rj2 < rns.length; rj2++) {
      c.fillStyle = rns[rj2].cd > 0 ? "rgba(160,130,200,0.6)" : "#c9a0ff";
      c.fillRect(rns[rj2].x * sx - 2, rns[rj2].y * sy - 2, 4, 4);
    }
    for (var f = 0; f < this.fires.length; f++) {
      c.fillStyle = "#ffa23d";
      c.fillRect(this.fires[f].x * sx - 2, this.fires[f].y * sy - 2, 4, 4);
    }
    if (p) {
      c.save();
      c.translate(p.x * sx, p.y * sy);
      c.rotate(p.face);
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.moveTo(5, 0); c.lineTo(-3.5, 3.5); c.lineTo(-3.5, -3.5);
      c.closePath(); c.fill();
      c.restore();
    }
    if (this.darkness > 0.2) {
      c.fillStyle = "rgba(6,10,32," + (this.darkness * 0.5) + ")";
      c.fillRect(0, 0, W, H);
    }
  };

  G.toast = function (text, kind) {
    var box = this.el.toasts;
    if (!box || !document.createElement) return;
    var d = document.createElement("div");
    d.className = "toast " + (kind || "");
    d.textContent = text;
    box.appendChild(d);
    if (box.children && box.children.length > 4 && box.removeChild) box.removeChild(box.children[0]);
    setTimeout(function () {
      d.className += " fade";
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 450);
    }, 2600);
  };

  /* ---------------- 状态切换 ---------------- */
  G.show = function (name) {
    var s = this.el.screens;
    for (var k in s) {
      if (!s[k]) continue;
      if (k === name) s[k].classList.remove("hidden");
      else s[k].classList.add("hidden");
    }
    if (this.el.hud) {
      if (name === null) this.el.hud.classList.remove("hidden");
      else this.el.hud.classList.add("hidden");
    }
    if (this.el.touch) {
      if (name === null && this.showTouch) this.el.touch.classList.remove("hidden");
      else this.el.touch.classList.add("hidden");
    }
  };

  G.pauseGame = function () {
    if (this.state !== "play") return;
    this.state = "pause";
    this.paused = true;
    this.save();
    if (this.el.pauseStats) {
      this.el.pauseStats.innerHTML = this.statHtml();
    }
    this.show("pause");
  };

  G.resumeGame = function () {
    if (this.state !== "pause") return;
    this.state = "play";
    this.paused = false;
    this.lastTs = 0;
    D.Audio.resume();
    this.show(null);
  };

  G.statHtml = function () {
    var p = this.player, s = this.stats;
    var rows = [
      ["物种", p ? (p.def.name + " " + D.STAGES[p.stage]) : "-"],
      ["等级", p ? ("Lv " + p.level) : "-"],
      ["存活", "第 " + this.day + " 天"],
      ["击杀", s.kills + " 只"],
      ["产蛋", s.eggs + " 枚"],
      ["幼崽", s.hatch + " 只"],
      ["吐息", s.breaths + " 次"],
      ["部落", s.humans + " 人 / " + s.totems + " 图腾"],
      ["遗物", D.Magic.relicCount(p) + " / 4"],
      ["评分", this.score() + " 分"]
    ];
    var html = "";
    for (var i = 0; i < rows.length; i++) {
      html += "<div><span>" + rows[i][0] + "</span><b>" + rows[i][1] + "</b></div>";
    }
    return html;
  };

  G.score = function () {
    var s = this.stats, p = this.player;
    return Math.round(
      this.day * 150 + s.kills * 70 + (p ? p.level * 90 : 0) + s.eggs * 140 + s.hatch * 130 +
      s.nests * 80 + s.humans * 45 + s.totems * 260 + (p && p.relics ? D.Magic.relicCount(p) * 120 : 0)
    );
  };

  G.gameOver = function (reason) {
    if (this.state === "over") return;
    this.state = "over";
    this.paused = true;
    this.clearSave();
    D.Audio.setRain(0);
    var sc = this.score();
    var grade = sc >= 3200 ? "S" : sc >= 2000 ? "A" : sc >= 1100 ? "B" : sc >= 500 ? "C" : "D";
    if (this.el.overReason) this.el.overReason.textContent = reason || "生命走到了尽头";
    if (this.el.overTitle) this.el.overTitle.textContent = "第 " + this.day + " 天 · 你倒下了";
    if (this.el.overStats) {
      this.el.overStats.innerHTML = "<div style=\"grid-column:1/-1\" class=\"grade\">评级 " + grade + "</div>" + this.statHtml();
    }
    this.show("over");
  };

  D.Game = Game;
})(window.DINO);
