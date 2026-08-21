/* ============================================================================
 * engine.js — 兵棋推演内核 (Wargame Simulation Engine)
 * ----------------------------------------------------------------------------
 * 模型链: 环境 → 传感器/情报融合 → 决策(AI) → 机动 → 火力分配 → 飞行体
 *         → 多层拦截 → 毁伤 → 机场/出动 → 两栖投送 → 地面交战 → 后勤 → 判定
 * 无 DOM 依赖，可在 Node 中无头运行 (见 tools/headless-test.mjs)
 * ==========================================================================*/
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};

  /* =====================  数学 / 地理  ================================= */
  var R_EARTH = 6371.0088;
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;

  function dist(a, b) { // km, haversine
    var dLat = (b.lat - a.lat) * D2R, dLon = (b.lon - a.lon) * D2R;
    var la1 = a.lat * D2R, la2 = b.lat * D2R;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function bearing(a, b) {
    var la1 = a.lat * D2R, la2 = b.lat * D2R, dLon = (b.lon - a.lon) * D2R;
    var y = Math.sin(dLon) * Math.cos(la2);
    var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
    return (Math.atan2(y, x) * R2D + 360) % 360;
  }
  function moveTo(p, brg, km) {
    var la1 = p.lat * D2R, lo1 = p.lon * D2R, d = km / R_EARTH, t = brg * D2R;
    var la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(t));
    var lo2 = lo1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return { lat: la2 * R2D, lon: ((lo2 * R2D + 540) % 360) - 180 };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* 快速经纬度粗筛 (避免全量 haversine) */
  function nearBox(a, b, km) {
    if (Math.abs(a.lat - b.lat) * 111.19 > km) return false;
    var kx = 111.19 * Math.cos((a.lat + b.lat) * 0.5 * D2R);
    return Math.abs(a.lon - b.lon) * kx <= km;
  }

  /* =====================  伪随机 (可复现)  ============================= */
  function RNG(seed) { this.s = seed >>> 0 || 88675123; }
  RNG.prototype.next = function () { // xorshift32
    var x = this.s; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    this.s = x; return x / 4294967296;
  };
  RNG.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
  RNG.prototype.int = function (n) { return Math.floor(this.next() * n); };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.pick = function (arr) { return arr.length ? arr[this.int(arr.length)] : null; };
  RNG.prototype.norm = function (mu, sd) {
    var u = 1 - this.next(), v = this.next();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  /* =====================  海深近似 (潜艇/布雷用)  ====================== */
  // 台湾以西为大陆架浅水(<80m)，以东急剧下降至3000m+
  function seaDepth(lat, lon) {
    if (lon > 121.9 && lat < 25.6) return 2500 + (lon - 121.9) * 900;   // 东部深海
    if (lon > 121.5 && lat > 25.4) return 400 + (lon - 121.5) * 800;    // 东北
    if (lon < 118.4 && lat < 23.6) return 25;                            // 台湾浅滩
    if (lon > 119.2 && lon < 120.4 && lat > 22.6 && lat < 25.4) return 60; // 海峡主体
    return 90;
  }
  function isDeep(lat, lon) { return seaDepth(lat, lon) > 200; }

  /* =====================  单位构造  ==================================== */
  var UID = 1;
  function makeUnit(w, spec) {
    var P = TWG.PLATFORMS[spec.cls];
    if (!P) throw new Error('unknown platform ' + spec.cls);
    var u = {
      uid: UID++, cls: spec.cls, P: P, side: spec.side || P.side,
      name: spec.name || P.name, domain: P.domain, role: P.role,
      lat: spec.lat, lon: spec.lon, alt: spec.alt || 0,
      hdg: spec.hdg || 0, spd: 0, spdMax: P.spd || 0,
      n: spec.n || 1, n0: spec.n || 1,
      hp: P.hp, hp0: P.hp, mob: 1, fire: 1, sens: 1,
      ammo: {}, mission: null, wp: [], state: 'ready', group: spec.group || null,
      home: spec.home || null, base: spec.base || null,
      fuel: 1, endur: P.endur || 0, cd: {}, lastFire: -1e9,
      emcon: spec.emcon || 1,          // 0 静默 1 常规 2 全功率
      cp: P.cp || 0, cp0: P.cp || 0, troops: P.troops || 0,
      liftLoad: null, tag: spec.tag || null,
      detectedBy: {}, kills: 0, hitsTaken: 0, spawn: w.t,
      note: P.note || ''
    };
    // 弹药基数
    var src = P.allWeapons || {};
    Object.keys(src).forEach(function (k) { u.ammo[k] = src[k] * (spec.n || 1); });
    if (P.load && (P.domain === 'ground' || P.domain === 'sam')) {
      u.ammo = {}; Object.keys(P.load).forEach(function (k) { u.ammo[k] = P.load[k]; });
    }
    if (P.airWing) { u.airWing = {}; Object.keys(P.airWing).forEach(function (k) { u.airWing[k] = P.airWing[k]; }); }
    if (P.lift) u.lift = JSON.parse(JSON.stringify(P.lift));
    return u;
  }

  /* =====================  引擎  ======================================== */
  function Engine(cfg) {
    cfg = cfg || {};
    this.scenario = cfg.scenario;
    this.rng = new RNG(cfg.seed || 20250401);
    this.t = 0;                       // 推演秒 (D日 H时 = 0)
    this.units = [];
    this.proj = [];                   // 飞行体
    this.bases = {};
    this.sites = {};
    this.log = [];
    this.stats = [];
    this.beachheads = {};
    this.captured = {};
    this.phase = 0;
    this.ended = null;
    this.tick = 0;
    this._lastSensor = -1e9; this._lastAI = -1e9; this._lastGround = -1e9;
    this._lastStat = -1e9; this._lastLog = -1e9;
    this.counters = { salvos: 0, intercepts: 0, kills: { PLA: 0, ROC: 0, US: 0, JP: 0 } };
    this.sides = {};
    ['PLA', 'ROC', 'US', 'JP'].forEach(function (s) {
      this.sides[s] = {
        id: s, tracks: {}, morale: 1, pgm: 1, fuel: 1, c2: 1,
        losses: { air: 0, ship: 0, sub: 0, ground: 0, aircraftGround: 0 },
        tonnage: 0, sorties: 0, missilesFired: 0, missilesHit: 0,
        active: (s === 'PLA' || s === 'ROC')
      };
    }, this);
    this.env = { sea: 2.5, vis: 0.85, wind: 15, amphib: 0.8, air: 0.9, night: 0, typhoon: 0 };
    this.setup(cfg);
  }

  Engine.prototype.now = function () { return this.t; };
  Engine.prototype.dayHour = function () {
    var h = this.t / 3600;
    return { d: Math.floor(h / 24) + 1, h: Math.floor(h % 24), m: Math.floor((this.t % 3600) / 60) };
  };
  Engine.prototype.clock = function () {
    var x = this.dayHour();
    return 'D+' + (x.d - 1) + ' ' + String(x.h).padStart(2, '0') + ':' + String(x.m).padStart(2, '0');
  };
  Engine.prototype.event = function (kind, side, text, obj) {
    var e = { t: this.t, clock: this.clock(), kind: kind, side: side, text: text,
      lat: obj && obj.lat, lon: obj && obj.lon };
    this.log.push(e);
    if (this.log.length > 4000) this.log.splice(0, 1200);
    if (this.onEvent) this.onEvent(e);
    return e;
  };

  /* -----------------  初始化  ----------------- */
  Engine.prototype.setup = function (cfg) {
    var self = this, TH = TWG.THEATER, OOB = TWG.OOB, sc = this.scenario;
    var env = TWG.THEATER.SEASONS[sc.season] || null;
    if (env) { this.env.sea = env.sea; this.env.vis = env.vis; this.env.wind = env.wind; this.env.amphib = env.amphib; this.env.air = env.air; }

    /* 机场 */
    TH.AIRBASES.forEach(function (b) {
      var inv = (b.side === 'PLA' ? OOB.PLA_AIR[b.id] : b.side === 'ROC' ? OOB.ROC_AIR[b.id] : null);
      if (b.side === 'PLA' && OOB.PLA_AIRLIFT[b.id]) {
        inv = Object.assign({}, inv || {}, OOB.PLA_AIRLIFT[b.id]);
      }
      var us = (b.side === 'US' ? OOB.US_FORCES.air[b.id] : b.side === 'JP' ? OOB.JP_FORCES.air[b.id] : null);
      if (us) inv = Object.assign({}, inv || {}, us);
      self.bases[b.id] = {
        id: b.id, side: b.side, name: b.name, lat: b.lat, lon: b.lon,
        rw: b.rw, rwLen: b.rwLen, has: b.has || 0, cave: b.cave || 0, cap: b.cap,
        hwy: b.hwy || 0, wing: b.wing || '', note: b.note || '',
        inv: inv ? JSON.parse(JSON.stringify(inv)) : {},
        inv0: inv ? JSON.parse(JSON.stringify(inv)) : {},
        cuts: 0, repair: 0, ops: 1, pol: 1, muni: 1, hp: 40 + (b.rw || 1) * 10,
        aloft: 0, ready: {}, damaged: 0, active: b.side === 'PLA' || b.side === 'ROC',
        launchQ: 0
      };
    });
    /* 港口/关键节点 */
    function addSite(s, kind) {
      self.sites[s.id] = {
        id: s.id, side: s.side, name: s.name, lat: s.lat, lon: s.lon, kind: kind || s.kind || s.type,
        hp: s.hp || (s.berth ? 30 + s.berth : 20), hp0: s.hp || (s.berth ? 30 + s.berth : 20),
        hard: s.hard || 1, value: s.value || (s.objective ? 8 : 3),
        berth: s.berth || 0, lift: s.lift || 0, objective: s.objective || 0,
        embark: s.embark || 0, sub: s.sub || 0, note: s.note || '', ops: 1, owner: s.side
      };
    }
    TH.PORTS.forEach(function (p) { addSite(p, p.type === 'navy' ? 'navalbase' : 'port'); });
    TH.KEYSITES.forEach(function (k) { addSite(k); });

    /* 部队生成 */
    function spawnList(list, side, group) {
      (list || []).forEach(function (s) {
        for (var i = 0; i < (s.n || 1); i++) {
          var pos = null;
          if (s.home && self.sites[s.home]) pos = self.sites[s.home];
          else if (s.lat != null) pos = s;
          if (!pos) continue;
          var jx = (i % 6) * 0.035 - 0.09, jy = Math.floor(i / 6) * 0.035 - 0.05;
          var nm = s.name || TWG.PLATFORMS[s.cls].name;
          if ((s.n || 1) > 1) nm = nm + ' #' + (i + 1);
          var u = makeUnit(self, {
            cls: s.cls, side: side, name: nm,
            lat: pos.lat + jy + self.rng.range(-0.02, 0.02),
            lon: pos.lon + jx + self.rng.range(-0.02, 0.02),
            home: s.home || null, group: s.group || group, n: 1
          });
          u.echelon = s.echelon; u.embarkPort = s.port || null; u.airliftBase = s.air || null;
          u.mobilizeAt = s.mobilize ? s.mobilize * 3600 : 0;
          if (u.mobilizeAt > 0) u.state = 'mobilizing';
          if (u.domain === 'surface' || u.domain === 'sub') u.state = 'inport';
          self.units.push(u);
        }
      });
    }
    spawnList(OOB.PLA_NAVAL, 'PLA'); spawnList(OOB.PLA_SUBS, 'PLA');
    spawnList(OOB.PLA_MISSILE, 'PLA'); spawnList(OOB.PLA_SAM, 'PLA');
    spawnList(OOB.PLA_GROUND, 'PLA'); spawnList(OOB.PLA_RADAR, 'PLA');
    spawnList(OOB.ROC_NAVAL, 'ROC'); spawnList(OOB.ROC_SUBS, 'ROC');
    spawnList(OOB.ROC_GROUND, 'ROC'); spawnList(OOB.ROC_SAM, 'ROC');
    spawnList(OOB.ROC_RADAR, 'ROC');

    /* 剧本裁剪与初始态势 */
    if (sc.apply) sc.apply(this);
    this.usTriggerAt = (sc.usIntervention == null ? 4 : sc.usIntervention) * 24 * 3600;
    this.usArrived = false;

    this.event('sys', null, '【推演初始化完成】剧本：' + sc.name + '　季节窗口：' + sc.season +
      '　参战单位 ' + this.units.length + ' 个　海况 ' + this.env.sea.toFixed(1) + ' 级');
    this.event('sys', null, '双方兵力：解放军 ' + this.units.filter(function (u) { return u.side === 'PLA'; }).length +
      ' 个作战单元 / 台军 ' + this.units.filter(function (u) { return u.side === 'ROC'; }).length + ' 个作战单元');
  };

  /* -----------------  美日干预  ----------------- */
  Engine.prototype.bringInIntervention = function () {
    if (this.usArrived) return;
    this.usArrived = true;
    var self = this, OOB = TWG.OOB;
    ['US', 'JP'].forEach(function (s) { self.sides[s].active = true; });
    Object.keys(this.bases).forEach(function (k) {
      var b = self.bases[k]; if (b.side === 'US' || b.side === 'JP') b.active = true;
    });
    function sp(list, side) {
      list.forEach(function (s) {
        for (var i = 0; i < (s.n || 1); i++) {
          var u = makeUnit(self, {
            cls: s.cls, side: side, name: (s.name || TWG.PLATFORMS[s.cls].name) + ((s.n || 1) > 1 ? ' #' + (i + 1) : ''),
            lat: s.lat + i * 0.06, lon: s.lon + i * 0.06, group: s.group
          });
          u.state = 'enroute'; self.units.push(u);
        }
      });
    }
    sp(OOB.US_FORCES.naval, 'US'); sp(OOB.US_FORCES.subs, 'US'); sp(OOB.JP_FORCES.naval, 'JP');
    this.event('critical', 'US', '★★★ 美军正式介入：航母打击群进入菲律宾海阵位，嘉手纳/关岛航空兵进入战备，5艘弗吉尼亚级核潜艇已在台湾以东展开');
  };

  /* -----------------  主步进  ----------------- */
  Engine.prototype.step = function (dt) {
    if (this.ended) return;
    this.t += dt; this.tick++;
    var h = this.t / 3600;

    /* 环境: 昼夜 + 台风随机 */
    var hod = (h + 6) % 24;
    this.env.night = (hod < 6 || hod > 18.5) ? 1 : 0;
    if (this.scenario.season === '7-8月 (台风季)' && this.rng.next() < dt / (3600 * 96)) {
      this.env.typhoon = 36 * 3600; this.event('env', null, '⚠ 台风警报：海峡海况急剧恶化，两栖与航空作战大幅受限');
    }
    if (this.env.typhoon > 0) { this.env.typhoon -= dt; }

    /* 战役阶段推进 */
    var ph = this.scenario.phases;
    while (this.phase < ph.length - 1 && h >= ph[this.phase + 1].at) {
      this.phase++;
      this.event('phase', null, '▣ 进入战役阶段 ' + (this.phase + 1) + '：' + ph[this.phase].name + ' — ' + ph[this.phase].desc);
    }

    /* 美日干预 */
    if (!this.usArrived && this.scenario.usIntervention != null && this.t >= this.usTriggerAt) this.bringInIntervention();

    /* 后备动员 */
    for (var i = 0; i < this.units.length; i++) {
      var mu = this.units[i];
      if (mu.state === 'mobilizing' && this.t >= mu.mobilizeAt) {
        mu.state = 'ready';
        this.event('mob', mu.side, '◆ ' + mu.name + ' 完成动员编成，进入战备');
      }
    }

    if (this.t - this._lastSensor >= 60) { this.sensorPass(); this._lastSensor = this.t; }
    if (this.t - this._lastAI >= 120) {
      if (TWG.AI) { TWG.AI.think(this, 'PLA'); TWG.AI.think(this, 'ROC');
        if (this.usArrived) { TWG.AI.think(this, 'US'); TWG.AI.think(this, 'JP'); } }
      this._lastAI = this.t;
    }
    this.moveUnits(dt);
    this.fireControl(dt);
    this.stepProjectiles(dt);
    this.airOps(dt);
    if (this.t - this._lastGround >= 900) { this.groundPhase(this.t - this._lastGround); this._lastGround = this.t; }
    this.logistics(dt);
    if (this.t - this._lastStat >= 1800) { this.sample(); this._lastStat = this.t; }
    this.checkEnd();
  };

  /* =====================  传感器 / 情报融合  =========================== */
  Engine.prototype.sensorRange = function (u, tgt) {
    var P = u.P, S = P.radar;
    if (!S) return 0;
    var base = S.range * u.sens * (u.emcon === 0 ? 0 : 1);
    // RCS 四次根律
    var rcs = tgt.P.rcs != null ? tgt.P.rcs : 5;
    var ref = (tgt.domain === 'surface' || tgt.domain === 'base') ? 3000 : 5;
    var r = base * Math.pow(Math.max(rcs, 0.0005) / ref, 0.25);
    if (tgt.domain === 'surface' || tgt.domain === 'base') r = base * Math.pow(Math.max(rcs, 100) / 3000, 0.16);
    // 电子干扰 (使用每轮缓存值，避免 O(n^3))
    var jam = (u._jam != null ? u._jam : 0);
    r *= (1 - 0.55 * jam);
    // 雷达地平线 (地/海面雷达对低空/掠海目标)
    var lowSensor = (u.domain !== 'air');
    if (lowSensor) {
      var hS = 30;
      if (u.domain === 'radar') hS = 260;          // 台湾/福建山地雷达站
      else if (u.domain === 'sam') hS = 60;
      else if (u.domain === 'ground') hS = 20;
      else if (u.domain === 'sub') hS = 12;        // 潜望/桅杆
      var hT = Math.max(tgt.alt || 0, 3);
      if (tgt.domain === 'surface') hT = 32;       // 舰艇上层建筑/桅杆
      else if (tgt.domain === 'base' || tgt.domain === 'ground') hT = 15;
      var hz = 4.12 * (Math.sqrt(hS) + Math.sqrt(hT));
      if ((tgt.alt || 0) < 6000) r = Math.min(r, hz);
    }
    if (this.env.night && tgt.domain === 'ground') r *= 0.9;
    return r;
  };
  Engine.prototype.jamLevel = function (u, enemySide) {
    if (u && u._jam != null) return u._jam;
    var lvl = 0;
    for (var i = 0; i < this.units.length; i++) {
      var j = this.units[i];
      if (j.side === u.side || j.dead) continue;
      var ew = j.P.ew; if (!ew || !ew.jam) continue;
      var rad = ew.radius || (j.domain === 'air' ? 220 : 150);
      if (!nearBox(u, j, rad)) continue;
      var d = dist(u, j); if (d > rad) continue;
      lvl = Math.max(lvl, ew.jam * (1 - d / rad) * j.fire);
    }
    return clamp(lvl, 0, 0.92);
  };

  Engine.prototype.sensorPass = function () {
    var self = this, U = this.units, n = U.length;
    /* 0) 预计算干扰源列表与每单位受扰程度 (一次 O(n·j)) */
    var jammers = [];
    for (var ji = 0; ji < n; ji++) {
      var jm = U[ji];
      if (jm.dead || !jm.P.ew || !jm.P.ew.jam) continue;
      if (jm.domain === 'air' && jm.state === 'ready') continue;
      jammers.push({ u: jm, lvl: jm.P.ew.jam, rad: jm.P.ew.radius || (jm.domain === 'air' ? 220 : 150) });
    }
    for (var ui = 0; ui < n; ui++) {
      var uu = U[ui];
      uu._jam = 0;
      if (uu.dead) continue;
      for (var jj = 0; jj < jammers.length; jj++) {
        var J = jammers[jj];
        if (J.u.side === uu.side) continue;
        if (!nearBox(uu, J.u, J.rad)) continue;
        var dj = dist(uu, J.u); if (dj > J.rad) continue;
        var lv = J.lvl * (1 - dj / J.rad) * J.u.fire;
        if (lv > uu._jam) uu._jam = lv;
      }
      if (uu._jam > 0.92) uu._jam = 0.92;
    }
    // 清理过期航迹
    ['PLA', 'ROC', 'US', 'JP'].forEach(function (s) {
      var T = self.sides[s].tracks;
      Object.keys(T).forEach(function (k) {
        var tr = T[k];
        if (self.t - tr.seen > 900) delete T[k];
        else { tr.age = self.t - tr.seen; tr.err = Math.min(60, 1.5 + tr.age / 60 * (tr.dom === 'air' ? 4 : 0.8)); }
      });
    });
    for (var i = 0; i < n; i++) {
      var s = U[i]; if (s.dead || s.sens <= 0.15) continue;
      var hasR = s.P.radar || s.P.esm || s.P.sonar;
      if (!hasR) continue;
      if (s.domain === 'air' && s.state !== 'enroute' && s.state !== 'engaged' && s.state !== 'onstation' && s.state !== 'rtb') continue;
      var side = self.sides[s.side];
      var maxR = (s.P.radar ? s.P.radar.range : 0);
      if (s.P.esm) maxR = Math.max(maxR, s.P.esm);
      if (s.P.sonar) maxR = Math.max(maxR, s.P.sonar.passive || s.P.sonar.range);
      for (var j = 0; j < n; j++) {
        var t = U[j]; if (t.dead || t.side === s.side) continue;
        if (t.side === 'US' && !self.sides.US.active) continue;
        if (!nearBox(s, t, maxR + 20)) continue;
        var d = dist(s, t);
        if (d > maxR + 10) continue;
        var got = false, q = 0.4;
        /* --- 水下目标: 只能被声呐/吊放/浮标探测 --- */
        if (t.domain === 'sub') {
          if (!s.P.sonar && !s.P.sonobuoy) continue;
          if (t.state === 'inport') { got = d < 15; q = 0.7; }
          else {
            var sr = (s.P.sonar ? (s.P.sonar.passive || s.P.sonar.range) : 60);
            var shallow = seaDepth(t.lat, t.lon) < 120 ? 1.35 : 1.0;   // 浅水更易被发现
            var quiet = t.P.acoustic || 0.35;
            var eff = sr * quiet * 2.2 * shallow * (t.spd > (t.P.spdSilent || 10) ? 1.6 : 0.8);
            if (s.P.sonobuoy) eff *= 1.3;
            got = d < eff && self.rng.chance(0.25);
            q = 0.35;
          }
        } else if (t.domain === 'sam' || t.domain === 'ground' || t.domain === 'radar') {
          /* --- 地面目标: 需要 ISR/SAR 或其在发射/开机 --- */
          var emitting = (t.domain === 'radar' || t.domain === 'sam') && t.emcon > 0 && t.fire > 0.2;
          if (s.P.esm && emitting && d < s.P.esm) { got = true; q = 0.75; }
          else if ((s.P.radar && (s.role === 'isr' || s.role === 'aew' || s.role === 'elint')) && d < (s.P.radar.range || 0) * 0.6) {
            got = self.rng.chance(t.P.camo ? 1 - t.P.camo : 0.75); q = 0.6;
          } else if (self.t - (t.lastFire || -1e9) < 600) { got = d < 400; q = 0.65; } // 发射暴露
          else if (s.domain === 'air' && d < 90) { got = self.rng.chance(0.5 * (t.P.camo ? 1 - t.P.camo : 1)); q = 0.5; }
        } else {
          /* --- 空中/水面目标: 雷达 + ESM --- */
          if (t.hidden && t.domain === 'surface') {
            // 疏泊于渔港/掩体的小型舰艇：极难发现，需近距侦察或空中平台
            var closeEnough = (s.domain === 'air' && d < 28) || d < 18;
            if (closeEnough && self.rng.chance(0.06)) { got = true; q = 0.45; }
          } else {
          var rr = self.sensorRange(s, t);
          if (s.P.esm && t.emcon > 0 && t.P.radar && d < Math.min(s.P.esm, t.P.radar.range * 1.6)) { got = true; q = 0.7; }
          if (!got && d < rr) {
            var pd = 0.9 - 0.5 * (d / Math.max(rr, 1));
            if (t.P.rcs < 0.2) pd *= 0.55;               // 隐身目标断续跟踪
            got = self.rng.chance(pd); q = t.P.rcs < 0.2 ? 0.55 : 0.85;
          }
          if (got && s.P.radar && s.P.radar.aew) q = Math.min(0.95, q + 0.1);
          }
        }
        if (!got) continue;
        var T = side.tracks, key = t.uid, prev = T[key];
        var nq = Math.max(q, prev ? prev.q * 0.9 : 0);
        T[key] = {
          uid: t.uid, side: t.side, dom: t.domain, cls: t.cls, role: t.role,
          lat: t.lat, lon: t.lon, alt: t.alt, spd: t.spd, hdg: t.hdg,
          seen: self.t, age: 0, err: 1.2, q: nq, by: s.uid,
          n: t.n, hp: t.hp / Math.max(t.hp0, 1), name: t.name
        };
        if (!prev) {
          t.detectedBy[s.side] = self.t;
          if ((t.domain === 'surface' && t.P.disp > 20000) || t.role === 'cv' || t.role === 'lhd' || t.role === 'lha')
            self.event('intel', s.side, '雷达发现高价值目标：' + t.name + '（' + t.P.cls + '）距 ' + d.toFixed(0) + 'km', t);
        }
      }
    }
    // 卫星/战略侦察: 双方对固定目标基本已知
    var sat = this.sides.PLA.tracks;
    if (this.tick % 40 === 0) {
      for (var k = 0; k < n; k++) {
        var f = U[k]; if (f.dead || f.side !== 'ROC') continue;
        if (f.domain === 'ground' || f.domain === 'sam' || f.domain === 'radar') {
          if (f.P.mobility > 0.6 && this.rng.chance(0.55)) continue;   // 高机动分队常规隐蔽
          sat[f.uid] = { uid: f.uid, side: 'ROC', dom: f.domain, cls: f.cls, role: f.role,
            lat: f.lat + this.rng.range(-0.03, 0.03), lon: f.lon + this.rng.range(-0.03, 0.03),
            alt: 0, spd: 0, seen: this.t, age: 0, err: 3, q: 0.6, sat: 1, n: f.n,
            hp: f.hp / Math.max(f.hp0, 1), name: f.name };
        }
      }
    }
  };

  /* =====================  机动  ======================================== */
  Engine.prototype.moveUnits = function (dt) {
    var U = this.units;
    for (var i = 0; i < U.length; i++) {
      var u = U[i];
      if (u.dead || u.state === 'inport' || u.state === 'mobilizing') continue;
      if (u.domain === 'ground' && !u.moveTo) continue;
      var tgt = u.wp && u.wp.length ? u.wp[0] : (u.moveTo || null);
      if (!tgt) { u.spd = u.domain === 'air' ? u.P.spd * 0.75 : 0; if (u.domain === 'air') this.orbit(u, dt); continue; }
      var d = dist(u, tgt);
      var vmax = (u.P.spd || 0) * u.mob;
      if (u.domain === 'sub' && u.emcon === 0) vmax = (u.P.spdSilent || vmax * 0.3);
      if (u.domain === 'ground') vmax = 45 * (u.P.mobility || 0.6) * u.mob;
      if (u.domain === 'surface') vmax *= clamp(1 - (this.env.sea - 2) * 0.08, 0.5, 1);
      if (u.role === 'barge' || u.role === 'sealift' || u.role === 'militia') vmax *= clamp(this.env.amphib + 0.2, 0.3, 1);
      u.spd = vmax;
      var step = vmax * dt / 3600;
      if (u.domain === 'air') { u.fuel -= dt / ((u.P.endur || 3.2) * 3600); }
      if (step >= d) {
        u.lat = tgt.lat; u.lon = tgt.lon;
        if (u.wp && u.wp.length) u.wp.shift(); else u.moveTo = null;
        if (!(u.wp && u.wp.length) && !u.moveTo) this.onArrive(u);
      } else {
        var b = bearing(u, tgt); u.hdg = b;
        var p = moveTo(u, b, step); u.lat = p.lat; u.lon = p.lon;
      }
    }
  };
  Engine.prototype.orbit = function (u, dt) {
    if (!u.orbitC) return;
    u.orbitA = (u.orbitA || 0) + dt * 0.0045;
    var r = u.orbitR || 45;
    var p = moveTo(u.orbitC, (u.orbitA * 57.3) % 360, r);
    u.hdg = (u.orbitA * 57.3 + 90) % 360;
    u.lat = p.lat; u.lon = p.lon;
    u.fuel -= dt / ((u.P.endur || 3.2) * 3600);
  };
  Engine.prototype.onArrive = function (u) {
    if (u.mission && u.mission.type === 'amphib_transit') { u.state = 'offloading'; u.offloadT = 0; }
    else if (u.mission && u.mission.type === 'rtb') this.recover(u);
    else if (u.domain === 'air') { u.state = 'onstation'; if (!u.orbitC) u.orbitC = { lat: u.lat, lon: u.lon }; }
    else if (u.domain === 'ground' && u.landed) { u.state = 'engaged'; }
    else u.state = 'onstation';
  };

  /* =====================  火力控制  ==================================== */
  var TGT_PREF = {
    fighter: ['air'], interceptor: ['air'], multirole: ['air', 'surface', 'ground'],
    strike: ['ground', 'surface'], bomber: ['surface', 'ground'], ew: ['sam', 'radar'],
    ucav: ['ground', 'sam'], ddg: ['surface', 'air', 'sub'], ffg: ['surface', 'air', 'sub'],
    corvette: ['surface', 'sub'], fac: ['surface'], cv: ['air'],
    ssk: ['surface'], ssn: ['surface'], ashm_bn: ['surface'], sam_bn: ['air'], aaa_bn: ['air'],
    mlrs_bn: ['ground', 'surface'], mlrs_bde: ['ground', 'sam'], srbm_bde: ['base'],
    hgv_bde: ['base'], lacm_bde: ['base'], lacm_bn: ['base'], asbm_bde: ['surface'],
    arty_bn: ['ground'], attack_helo: ['surface', 'ground'], ccg: ['surface'], patrol: ['surface']
  };

  Engine.prototype.fireControl = function (dt) {
    if (this.t - (this._lastFC || -1e9) < 60) return;
    this._lastFC = this.t;
    var U = this.units, self = this;
    /* 每侧航迹数组只构建一次 */
    var TA = {};
    ['PLA', 'ROC', 'US', 'JP'].forEach(function (s) {
      var T = self.sides[s].tracks, keys = Object.keys(T), arr = [];
      for (var i = 0; i < keys.length; i++) arr.push(T[keys[i]]);
      TA[s] = arr;
    });
    for (var i = 0; i < U.length; i++) {
      var u = U[i];
      if (u.dead || u.fire < 0.2 || u.state === 'inport' || u.state === 'mobilizing' || u.state === 'rtb') continue;
      if (u.domain === 'base' || u.role === 'beachhead') continue;
      if (u.roe === 'hold') continue;
      var arr = TA[u.side];
      if (!arr || !arr.length) continue;
      var roe = this.rulesOfEngagement;
      /* 逐武器判断 */
      var wl = Object.keys(u.ammo);
      for (var wi = 0; wi < wl.length; wi++) {
        var wk = wl[wi], W = TWG.WEAPONS[wk];
        if (!W || u.ammo[wk] <= 0) continue;
        if (W.type === 'ciws' || W.ciws) continue;                 // 近防仅用于拦截
        if (W.type === 'sam' || W.type === 'sam_ashm') continue;    // 防空导弹仅在拦截逻辑中使用
        // 交战规则限制 (封锁/有限战争剧本)
        if (roe && roe.noShipStrike && this.t < roe.noShipStrike &&
          (W.type === 'ashm' || W.type === 'asbm' || W.type === 'torp')) continue;
        var cyc = this.cycleTime(u, W);
        if ((this.t - (u.cd[wk] || -1e9)) < cyc) continue;
        var best = null, bestScore = -1;
        for (var ki = 0; ki < arr.length; ki++) {
          var tr = arr[ki];
          if (!this.validTarget(u, W, tr)) continue;
          if (!nearBox(u, tr, W.range)) continue;
          var d = dist(u, tr);
          if (d > W.range) continue;
          var sc = this.targetScore(u, W, tr, d);
          if (sc > bestScore) { bestScore = sc; best = tr; }
        }
        if (!best) continue;
        this.launch(u, W, best);
        u.cd[wk] = this.t;
      }
    }
  };
  Engine.prototype.cycleTime = function (u, W) {
    var rl = Math.max(0.2, (u.P.reload || 1));
    if (W.type === 'aam') return 15;
    if (W.type === 'ashm' || W.type === 'sow') return u.domain === 'air' ? 45 : 150;
    if (W.type === 'arm') return u.domain === 'air' ? 90 : 300;
    if (W.type === 'srbm' || W.type === 'mrbm' || W.type === 'irbm' || W.type === 'hgv' || W.type === 'asbm')
      return 2700 / rl;                       // 一个导弹旅完成再装填-转移-再射的周期
    if (W.type === 'lacm') return u.domain === 'air' ? 60 : 2100 / rl;
    if (W.type === 'mlrs') return 1100 / rl;  // 火箭炮营齐射后需转移阵地与再装填
    if (W.type === 'arty') return 240;
    if (W.type === 'torp') return 300;
    if (W.type === 'loiter') return 420;
    return 90;
  };
  Engine.prototype.validTarget = function (u, W, tr) {
    var dom = tr.dom;
    if (W.type === 'aam') return dom === 'air';
    if (W.type === 'ashm' || W.type === 'sam_ashm') return dom === 'surface';
    if (W.type === 'torp') return dom === 'surface' || dom === 'sub';
    if (W.type === 'arm') return dom === 'sam' || dom === 'radar';
    if (W.type === 'lacm' || W.type === 'sow' || W.type === 'srbm' || W.type === 'mrbm' ||
      W.type === 'irbm' || W.type === 'hgv') return dom === 'base' || dom === 'site' || dom === 'ground' || dom === 'sam' || dom === 'radar';
    if (W.type === 'asbm') return dom === 'surface';
    if (W.type === 'mlrs' || W.type === 'arty') return dom === 'ground' || dom === 'base' || dom === 'site' || dom === 'sam';
    if (W.type === 'loiter') return dom === 'ground' || dom === 'sam' || dom === 'surface';
    return false;
  };
  Engine.prototype.targetScore = function (u, W, tr, d) {
    var pref = TGT_PREF[u.role] || [];
    var s = 100 - d / 12;
    var pi = pref.indexOf(tr.dom); if (pi >= 0) s += 40 - pi * 10;
    if (tr.role === 'cv' || tr.role === 'lhd' || tr.role === 'lha') s += 70;
    if (tr.role === 'aew') s += 65;
    if (tr.role === 'lpd' || tr.role === 'lst' || tr.role === 'sealift' || tr.role === 'barge') s += 55;
    if (tr.role === 'ddg') s += 25;
    if (tr.dom === 'sam' && (W.type === 'arm' || u.role === 'ew')) s += 60;
    if (tr.prio) s += tr.prio;
    if (tr.dom === 'base' && (W.type === 'srbm' || W.type === 'hgv' || W.type === 'mlrs')) s += 30;
    s *= (0.5 + tr.q);
    return s;
  };

  /* -----------------  发射  ----------------- */
  Engine.prototype.launch = function (u, W, tr) {
    var tgt = this.unitById(tr.uid);
    var salvo = this.salvoSize(u, W, tr);
    // 弹药存量紧张时齐射规模下降（战役后期典型现象）
    var pgmF = clamp(0.35 + 0.65 * this.sides[u.side].pgm, 0.35, 1);
    if (W.type !== 'arty') salvo = Math.max(1, Math.round(salvo * pgmF));
    salvo = Math.min(salvo, u.ammo[W.id]);
    if (salvo <= 0) return;
    u.ammo[W.id] -= salvo;
    u.lastFire = this.t;
    this.sides[u.side].missilesFired += salvo;
    this.counters.salvos++;
    if (u.domain === 'sam' || u.domain === 'ground' || u.domain === 'radar') u.emcon = 2;
    var p = {
      id: 'p' + (UID++), side: u.side, w: W, n: salvo, from: u.uid, fromName: u.name,
      lat: u.lat, lon: u.lon, alt: u.alt || (W.ballistic || W.type === 'srbm' || W.type === 'hgv' ? 0 : 100),
      tgtUid: tr.uid, tgtSite: tr.siteId || null, tlat: tr.lat, tlon: tr.lon,
      spd: W.spd, t0: this.t, life: 0, phase: 'boost', defended: 0,
      dTotal: dist(u, tr), dGone: 0, hdg: bearing(u, tr)
    };
    this.proj.push(p);
    var kindTxt = { aam: '空空导弹', ashm: '反舰导弹', lacm: '巡航导弹', srbm: '弹道导弹',
      mrbm: '中程弹道导弹', irbm: '中远程弹道导弹', hgv: '高超音速导弹', asbm: '反舰弹道导弹',
      arm: '反辐射导弹', torp: '鱼雷', mlrs: '远程火箭弹', arty: '炮兵射击', sow: '滑翔炸弹', loiter: '巡飞弹' }[W.type] || '导弹';
    if (W.type !== 'arty' || this.rng.chance(0.15)) {
      this.event('fire', u.side, u.name + ' 发射 ' + salvo + ' 枚 ' + W.name + '（' + kindTxt + '）→ ' +
        (tgt ? tgt.name : (tr.name || '目标')) + '　距 ' + p.dTotal.toFixed(0) + 'km', u);
    }
  };
  Engine.prototype.salvoSize = function (u, W, tr) {
    if (W.type === 'aam') return this.rng.chance(0.5) ? 2 : 1;
    if (W.type === 'ashm' || W.type === 'asbm') {
      var big = (tr.role === 'cv' || tr.role === 'lhd' || tr.role === 'lha');
      var mid = (tr.role === 'ddg' || tr.role === 'lpd' || tr.role === 'sealift' || tr.role === 'barge');
      return big ? 6 + this.rng.int(7) : mid ? 3 + this.rng.int(4) : 2 + this.rng.int(2);
    }
    if (W.type === 'srbm' || W.type === 'mrbm' || W.type === 'irbm') return 4 + this.rng.int(7);
    if (W.type === 'hgv') return 2 + this.rng.int(2);
    if (W.type === 'lacm') return 3 + this.rng.int(5);
    if (W.type === 'mlrs') return 12 + this.rng.int(19);
    if (W.type === 'arty') return 18 + this.rng.int(19);
    if (W.type === 'torp') return 2;
    if (W.type === 'arm') return 2;
    return 2;
  };

  /* =====================  飞行体推进 + 拦截 + 毁伤  ===================== */
  Engine.prototype.stepProjectiles = function (dt) {
    var P = this.proj, keep = [], self = this;
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      var step = p.spd * dt / 3600;
      p.dGone += step; p.life += dt;
      // 目标位置更新 (对活动目标进行末段修正)
      var tgt = this.unitById(p.tgtUid);
      if (tgt && !tgt.dead) {
        var seeker = p.w.seeker || '';
        if (p.dGone / Math.max(p.dTotal, 1) > 0.6 || tgt.domain !== 'air') { p.tlat = tgt.lat; p.tlon = tgt.lon; }
      }
      var rem = Math.max(0, p.dTotal - p.dGone);
      var pos = moveTo({ lat: p.lat, lon: p.lon }, bearing({ lat: p.lat, lon: p.lon }, { lat: p.tlat, lon: p.tlon }), Math.min(step, dist({ lat: p.lat, lon: p.lon }, { lat: p.tlat, lon: p.tlon })));
      p.lat = pos.lat; p.lon = pos.lon;
      var dRem = dist(p, { lat: p.tlat, lon: p.tlon });
      // 弹道高度剖面 (用于绘制)
      var frac = clamp(p.dGone / Math.max(p.dTotal, 1), 0, 1);
      if (p.w.ballistic || p.w.type === 'srbm' || p.w.type === 'mrbm' || p.w.type === 'irbm' || p.w.type === 'asbm')
        p.alt = Math.sin(frac * Math.PI) * (p.dTotal > 800 ? 180000 : 90000);
      else if (p.w.type === 'hgv') p.alt = 55000 * (1 - frac * 0.5);
      else if (p.w.type === 'mlrs' || p.w.type === 'arty') p.alt = Math.sin(frac * Math.PI) * 25000;
      else if (p.w.type === 'torp') p.alt = -40;
      else p.alt = frac > 0.85 ? (p.w.skim || 30) : (p.w.type === 'lacm' ? 120 : 6000 * Math.sin(frac * Math.PI) + 200);

      /* 多层拦截: 距目标 <=最大拦截圈时结算一次 */
      if (!p.defended && dRem < 260) { this.resolveDefense(p); p.defended = 1; if (p.n <= 0) continue; }
      /* 末端近防 */
      if (!p.cids && dRem < 12) { this.resolveCIWS(p); p.cids = 1; if (p.n <= 0) continue; }

      if (dRem < Math.max(step, 0.6) || p.life > 9000) {
        this.impact(p);
        continue;
      }
      keep.push(p);
    }
    this.proj = keep;
    if (this.proj.length > 2600) this.proj.splice(0, this.proj.length - 2600);
  };

  /* 拦截层: 区域防空 (舰载/陆基) */
  Engine.prototype.resolveDefense = function (p) {
    var tgt = this.unitById(p.tgtUid);
    var tp = { lat: p.tlat, lon: p.tlon };
    var W = p.w, self = this;
    var ballistic = (W.ballistic || W.type === 'srbm' || W.type === 'mrbm' || W.type === 'irbm' || W.type === 'hgv' || W.type === 'asbm');
    var defSide = tgt ? tgt.side : (this.siteOwnerSideAt(p) || null);
    if (!defSide || defSide === p.side) return;
    var defenders = [];
    for (var i = 0; i < this.units.length; i++) {
      var d = this.units[i];
      if (d.dead || d.side !== defSide || d.fire < 0.2) continue;
      if (d.domain !== 'surface' && d.domain !== 'sam') continue;
      if (d.state === 'inport' && d.domain === 'surface') continue;
      if (!nearBox(d, tp, 420)) continue;
      var dd = dist(d, tp);
      var keys = Object.keys(d.ammo);
      for (var k = 0; k < keys.length; k++) {
        var sw = TWG.WEAPONS[keys[k]];
        if (!sw || (sw.type !== 'sam' && sw.type !== 'sam_ashm') || d.ammo[keys[k]] <= 0) continue;
        if (sw.ciws) continue;
        if (dd > sw.range * 0.95) continue;
        if (ballistic && !sw.abm) continue;
        defenders.push({ u: d, w: sw, k: keys[k], d: dd });
      }
    }
    if (!defenders.length) return;
    defenders.sort(function (a, b) { return (b.w.range - a.w.range); });
    var incoming = p.n, killed = 0, shots = 0;
    for (var q = 0; q < defenders.length && incoming > 0; q++) {
      var def = defenders[q], sw = def.w, du = def.u;
      // 交战次数: 由射程与目标速度决定 (可用交战窗口)
      var closing = W.spd + 200;
      var window_s = Math.max(4, (sw.range - Math.max(def.d - 60, 6)) / closing * 3600);
      var channels = Math.min(du.P.launchers || 8, 12) * (du.domain === 'sam' ? 1 : 1.5);
      var opps = Math.floor(clamp(window_s / 11, 1, 8));
      var maxShots = Math.min(incoming * 2, Math.floor(channels * opps), du.ammo[def.k]);
      if (maxShots <= 0) continue;
      var pk = sw.pk;
      if (ballistic) pk = sw.abm * (W.type === 'hgv' ? 0.35 : W.cep && W.cep < 25 ? 0.9 : 1);
      pk *= (1 - (W.eccm || 0.3) * 0.45);
      pk *= clamp(1 - (W.spd - 2500) / 14000, 0.35, 1.0);          // 高速目标更难拦
      if ((W.skim || 999) < 12) pk *= 0.72;                         // 掠海突防
      if (W.lowObs) pk *= 0.55;
      pk *= du.fire * (0.85 + 0.15 * du.sens);
      pk *= (1 - (du._jam || 0) * 0.5);
      pk = clamp(pk, 0.02, 0.93);
      var used = 0;
      for (var s2 = 0; s2 < maxShots && incoming > 0; s2 += 2) {
        var vol = Math.min(2, maxShots - s2);
        used += vol; shots += vol;
        var pKillVol = 1 - Math.pow(1 - pk, vol);
        if (this.rng.chance(pKillVol)) { incoming--; killed++; }
      }
      du.ammo[def.k] -= used;
      du.lastFire = this.t;
      if (du.domain === 'sam') du.emcon = 2;
    }
    this.counters.intercepts += killed;
    p.n = incoming;
    if (shots > 0 && (killed > 0 || p.n === 0 || this.rng.chance(0.35))) {
      this.event('intercept', defSide, '防空拦截：对 ' + W.name + ' 齐射 ' + shots + ' 弹，击落 ' + killed +
        ' 枚，' + (p.n > 0 ? '仍有 ' + p.n + ' 枚突防' : '全部拦截'), tp);
    }
    if (p.n <= 0) p.dead = 1;
  };

  /* 拦截层: 末端近防 (CIWS/近程弹/软杀伤) */
  Engine.prototype.resolveCIWS = function (p) {
    var tgt = this.unitById(p.tgtUid);
    if (!tgt || tgt.dead) return;
    if (tgt.domain !== 'surface' && tgt.domain !== 'air') return;
    var W = p.w;
    if (W.ballistic || W.type === 'srbm' || W.type === 'hgv') return;
    var inc = p.n, killed = 0;
    var group = [tgt];
    if (tgt.domain === 'surface') {
      for (var i = 0; i < this.units.length; i++) {
        var e = this.units[i];
        if (e.dead || e.side !== tgt.side || e.domain !== 'surface' || e === tgt) continue;
        if (nearBox(e, tgt, 12) && dist(e, tgt) < 12) group.push(e);
      }
    }
    for (var g = 0; g < group.length && inc > 0; g++) {
      var u = group[g], keys = Object.keys(u.ammo);
      for (var k = 0; k < keys.length && inc > 0; k++) {
        var cw = TWG.WEAPONS[keys[k]];
        if (!cw || !(cw.ciws || cw.type === 'ciws')) continue;
        if (u.ammo[keys[k]] <= 0 && cw.type !== 'ciws') continue;
        var pk = cw.pk * u.fire * clamp(1 - (W.spd - 1000) / 5200, 0.25, 1);
        if (W.lowObs) pk *= 0.7;
        var shots = Math.min(inc, cw.type === 'ciws' ? 3 : 4);
        for (var s = 0; s < shots && inc > 0; s++) {
          if (cw.type !== 'ciws') { if (u.ammo[keys[k]] <= 0) break; u.ammo[keys[k]]--; }
          if (this.rng.chance(clamp(pk, 0.02, 0.9))) { inc--; killed++; }
        }
      }
      // 软杀伤: 箔条/干扰弹/诱饵
      var ew = u.P.ew;
      if (ew && ew.decoy && inc > 0) {
        var pd = ew.decoy * (1 - (W.eccm || 0.5)) * 0.9;
        for (var m = 0; m < inc; m++) if (this.rng.chance(clamp(pd, 0, 0.6))) { inc--; killed++; m--; if (inc <= 0) break; }
      }
    }
    this.counters.intercepts += killed;
    p.n = inc;
    if (killed > 0) this.event('intercept', tgt.side, tgt.name + ' 近防系统 + 软杀伤消耗 ' + killed + ' 枚来袭弹' +
      (inc > 0 ? '，' + inc + ' 枚命中在即' : '，成功规避'), tgt);
    if (p.n <= 0) p.dead = 1;
  };

  Engine.prototype.siteOwnerSideAt = function (p) {
    var best = null, bd = 1e9, self = this;
    Object.keys(this.sites).forEach(function (k) {
      var s = self.sites[k], d = dist(s, { lat: p.tlat, lon: p.tlon });
      if (d < bd) { bd = d; best = s; }
    });
    Object.keys(this.bases).forEach(function (k) {
      var b = self.bases[k], d = dist(b, { lat: p.tlat, lon: p.tlon });
      if (d < bd) { bd = d; best = b; }
    });
    return bd < 25 && best ? (best.owner || best.side) : null;
  };

  /* -----------------  命中结算  ----------------- */
  Engine.prototype.impact = function (p) {
    if (p.n <= 0) return;
    if (!p.defended) { p.defended = 1; this.resolveDefense(p); if (p.n <= 0) return; }
    if (!p.cids) { p.cids = 1; this.resolveCIWS(p); if (p.n <= 0) return; }
    var W = p.w, tgt = this.unitById(p.tgtUid), self = this;
    var hits = 0;
    var pk = W.pk;
    // 命中概率修正 (使用目标处受扰缓存)
    pk *= (1 - (tgt && tgt._jam ? tgt._jam : 0) * 0.15);
    if (this.env.vis < 0.7 && (W.seeker || '').indexOf('红外') >= 0) pk *= 0.75;
    if (this.env.night && (W.seeker || '').indexOf('光电') >= 0) pk *= 0.6;

    if (tgt && !tgt.dead) {
      var tp = TWG.PLATFORMS[tgt.cls];
      /* 综合折扣：实战条件下的可靠性、态势、多目标交战、非最佳发射包线 */
      if (W.type === 'aam') pk *= 0.55;
      else if (W.type === 'ashm' || W.type === 'asbm') pk *= 0.82;
      else if (W.type === 'torp') pk *= 0.8;
      if (tgt.domain === 'air') {
        var skillGap = (tgt.P.skill || 0.6) - 0.65;
        pk *= clamp(1 - skillGap * 0.8, 0.4, 1.3);
        pk *= (1 - (tgt.P.ew && tgt.P.ew.jam ? tgt.P.ew.jam : 0.2) * (1 - (W.eccm || 0.6)) * 1.2);
        if (tgt.P.rcs < 0.2) pk *= 0.6;
      } else if (tgt.domain === 'surface') {
        pk *= 1.0;
      } else if (tgt.domain === 'sub') {
        pk *= 0.9;
      } else {
        // 陆上目标: CEP 与工事影响
        pk *= clamp(1 - (W.cep || 40) / 300, 0.35, 1);
        if (tgt.P.camo) pk *= (1 - tgt.P.camo * 0.5);
      }
      for (var i = 0; i < p.n; i++) if (this.rng.chance(clamp(pk, 0.02, 0.95))) hits++;
      this.sides[p.side].missilesHit += hits;
      if (hits > 0) this.applyDamage(tgt, W, hits, p);
      else if (this.rng.chance(0.3)) this.event('miss', p.side, p.n + ' 枚 ' + W.name + ' 全部未命中 ' + tgt.name +
        '（干扰/诱饵/机动规避）', tgt);
      return;
    }
    // 无单位目标 → 打击设施/机场
    var site = this.nearestFacility(p.tlat, p.tlon, 25);
    if (site) { this.strikeFacility(site, W, p); return; }
  };

  Engine.prototype.nearestFacility = function (lat, lon, maxKm) {
    var best = null, bd = maxKm, self = this, ref = { lat: lat, lon: lon };
    Object.keys(this.bases).forEach(function (k) {
      var b = self.bases[k]; var d = dist(b, ref); if (d < bd) { bd = d; best = { kind: 'base', o: b }; }
    });
    Object.keys(this.sites).forEach(function (k) {
      var s = self.sites[k]; var d = dist(s, ref); if (d < bd) { bd = d; best = { kind: 'site', o: s }; }
    });
    return best;
  };

  /* 机场/设施打击 */
  Engine.prototype.strikeFacility = function (f, W, p) {
    var o = f.o, self = this, hits = 0;
    var pk = clamp(1 - (W.cep || 40) / 320, 0.35, 0.96) * W.pk;
    for (var i = 0; i < p.n; i++) if (this.rng.chance(pk)) hits++;
    this.sides[p.side].missilesHit += hits;
    if (hits === 0) return;
    if (f.kind === 'base') {
      var b = o;
      var subMun = (W.sub && /子母/.test(W.sub)) || W.type === 'mlrs' || W.type === 'sow' || W.type === 'lacm';
      var cuts = 0;
      for (var h = 0; h < hits; h++) {
        if (subMun && this.rng.chance(0.55)) cuts++;
        else if (this.rng.chance(0.25)) cuts++;
      }
      b.cuts += cuts;
      // 地面停放飞机损失
      var parked = 0; Object.keys(b.inv).forEach(function (k) { parked += b.inv[k]; });
      var sheltered = Math.min(parked, b.has + b.cave);
      var exposed = Math.max(0, parked - sheltered);
      var killAir = 0;
      for (var h2 = 0; h2 < hits; h2++) {
        if (exposed > 0 && this.rng.chance(0.35)) { killAir += 1 + this.rng.int(2); }
        else if (b.cave > 0 && this.rng.chance(0.012)) killAir += 1;
        else if (b.has > 0 && (W.warhead > 700) && this.rng.chance(0.10)) killAir += 1;
      }
      killAir = Math.min(killAir, Math.max(0, exposed) + Math.floor(sheltered * 0.05));
      var removed = 0;
      var invKeys = Object.keys(b.inv);
      while (removed < killAir && invKeys.length) {
        var kk = this.rng.pick(invKeys);
        if (b.inv[kk] > 0) { b.inv[kk]--; removed++; } 
        else invKeys.splice(invKeys.indexOf(kk), 1);
      }
      this.sides[b.side].losses.aircraftGround += removed;
      if (this.rng.chance(0.3 * hits)) b.pol = clamp(b.pol - 0.12 * hits, 0, 1);
      if (this.rng.chance(0.25 * hits)) b.muni = clamp(b.muni - 0.1 * hits, 0, 1);
      b.damaged += hits;
      this.updateBaseOps(b);
      this.event('strike', p.side, '☠ ' + b.name + ' 遭 ' + hits + ' 弹命中（' + W.name + '）：跑道弹坑 +' + cuts +
        '（累计 ' + b.cuts + '），地面损失 ' + removed + ' 架，起降能力 ' + (b.ops * 100).toFixed(0) + '%', b);
    } else {
      var s = o;
      var dmg = 0;
      for (var h3 = 0; h3 < hits; h3++) dmg += Math.pow(W.warhead || 200, 0.62) / (6 * (s.hard || 1));
      s.hp = Math.max(0, s.hp - dmg);
      s.ops = clamp(s.hp / s.hp0, 0, 1);
      var txt = '☠ ' + s.name + ' 遭 ' + hits + ' 弹命中（' + W.name + '），完好度 ' + (s.ops * 100).toFixed(0) + '%';
      this.event('strike', p.side, txt, s);
      if (s.hp <= 0 && !s.destroyed) {
        s.destroyed = 1;
        this.event('critical', p.side, '★ ' + s.name + ' 被彻底摧毁/失能' +
          (s.kind === 'radar' ? '（该区域预警能力丧失）' : s.kind === 'c2' ? '（指挥链受损）' : ''), s);
        if (s.kind === 'c2') this.sides[s.owner].c2 = clamp(this.sides[s.owner].c2 - 0.22, 0.35, 1);
        if (s.kind === 'radar') this.sides[s.owner].c2 = clamp(this.sides[s.owner].c2 - 0.08, 0.35, 1);
      }
    }
  };
  Engine.prototype.updateBaseOps = function (b) {
    var repairable = b.cuts;
    var perRw = repairable / Math.max(1, b.rw);
    b.ops = clamp(1 - perRw * 0.42, 0, 1) * clamp(b.pol, 0.1, 1) * clamp(0.35 + b.muni * 0.65, 0.2, 1);
    if (b.hwy) b.ops = Math.max(b.ops, 0.25 * clamp(b.pol, 0, 1));
    if (b.cave > 0) b.ops = Math.max(b.ops, 0.18);
  };

  /* -----------------  单位毁伤  ----------------- */
  Engine.prototype.applyDamage = function (u, W, hits, p) {
    var self = this;
    u.hitsTaken += hits;
    if (u.domain === 'air') {
      var killed = 0;
      for (var i = 0; i < hits; i++) if (u.n > killed) killed++;
      u.n -= killed;
      this.sides[u.side].losses.air += killed;
      this.counters.kills[p.side] += killed;
      var shooter = this.unitById(p.from); if (shooter) shooter.kills += killed;
      this.event('kill', p.side, '✈ 空战战果：' + u.name + ' 被击落 ' + killed + ' 架（' + W.name + '）' +
        (u.n > 0 ? '，残余 ' + u.n + ' 架' : '，编队全灭'), u);
      if (u.n <= 0) this.destroy(u, p.side);
      return;
    }
    var eff = 0;
    for (var h = 0; h < hits; h++) eff += Math.pow(W.warhead || 150, 0.62);
    if (u.domain === 'surface') {
      var dmg = eff * 2.1 / (1 + (u.P.disp || 3000) / 9000);
      u.hp -= dmg;
      // 子系统毁伤
      for (var s = 0; s < hits; s++) {
        var r = this.rng.next();
        if (r < 0.34) u.fire = clamp(u.fire - this.rng.range(0.15, 0.45), 0, 1);
        else if (r < 0.62) u.sens = clamp(u.sens - this.rng.range(0.15, 0.5), 0, 1);
        else u.mob = clamp(u.mob - this.rng.range(0.1, 0.4), 0.05, 1);
      }
      var pct = clamp(u.hp / u.hp0, 0, 1);
      this.event('hit', p.side, '💥 ' + u.name + ' 被 ' + hits + ' 枚 ' + W.name + ' 命中，剩余结构 ' +
        (pct * 100).toFixed(0) + '%（火力 ' + (u.fire * 100).toFixed(0) + '% / 探测 ' + (u.sens * 100).toFixed(0) +
        '% / 机动 ' + (u.mob * 100).toFixed(0) + '%）', u);
      if (u.hp <= 0) {
        this.destroy(u, p.side);
        this.sides[u.side].losses.ship++;
        // 载运部队随舰沉没
        if (u.lift && u.embarked) {
          this.event('critical', p.side, '★★ ' + u.name + ' 沉没，随舰 ' + Math.round(u.embarked.troops || 0) +
            ' 名登陆兵员与重装备损失（两栖投送能力削减）', u);
        }
      } else if (u.fire < 0.25 && !u.missionKill) {
        u.missionKill = 1;
        this.event('kill', p.side, '⚠ ' + u.name + ' 丧失作战能力（战斗系统被毁），退出战斗', u);
      }
      return;
    }
    if (u.domain === 'sub') {
      u.hp -= eff * 2.6;
      if (u.hp <= 0) { this.destroy(u, p.side); this.sides[u.side].losses.sub++;
        this.event('critical', p.side, '★ 潜艇 ' + u.name + ' 被击沉', u); }
      else this.event('hit', p.side, '💥 潜艇 ' + u.name + ' 受损，被迫上浮/退出阵位', u);
      return;
    }
    // 地面/防空/雷达
    var gdmg = eff * (u.domain === 'sam' ? 1.5 : 0.9) * (u.P.fortify ? 1 / u.P.fortify : 1);
    u.hp -= gdmg;
    u.cp = Math.max(0, u.cp * (1 - gdmg / Math.max(u.hp0, 1) * 0.8));
    u.fire = clamp(u.fire - gdmg / Math.max(u.hp0, 1) * 0.7, 0, 1);
    u.troops = Math.max(0, Math.round(u.troops * (1 - gdmg / Math.max(u.hp0, 1) * 0.5)));
    if (u.hp <= 0) {
      this.destroy(u, p.side); this.sides[u.side].losses.ground++;
      this.event('kill', p.side, '☠ ' + u.name + ' 阵地被摧毁/丧失战力', u);
    } else {
      this.event('hit', p.side, '💥 ' + u.name + ' 遭 ' + hits + ' 弹命中，战斗力 ' +
        (u.cp / Math.max(u.cp0, 1) * 100).toFixed(0) + '%', u);
    }
  };
  Engine.prototype.destroy = function (u, byWhom) {
    u.dead = 1; u.state = 'destroyed'; u.hp = 0; u.deadAt = this.t;
    if (u.domain === 'air') { /* 已计入 */ }
  };

  /* =====================  航空出动管理  ================================ */
  Engine.prototype.airOps = function (dt) {
    var self = this;
    // 跑道抢修
    Object.keys(this.bases).forEach(function (k) {
      var b = self.bases[k];
      if (!b.active) return;
      if (b.cuts > 0) {
        b.repair += dt / 3600;
        var rate = (b.side === 'PLA' ? TWG.OOB.LOGISTICS.PLA.repairAirbasePerDay : TWG.OOB.LOGISTICS.ROC.repairAirbasePerDay);
        var need = 6 / Math.max(rate, 0.5);
        while (b.repair >= need && b.cuts > 0) { b.repair -= need; b.cuts--; }
        self.updateBaseOps(b);
      }
      if (b.pol < 1 && self.rng.chance(dt / 7200)) { b.pol = clamp(b.pol + 0.04, 0, 1); self.updateBaseOps(b); }
      if (b.muni < 1 && self.rng.chance(dt / 7200)) { b.muni = clamp(b.muni + 0.04, 0, 1); self.updateBaseOps(b); }
    });
    // 空中单位燃油/返场
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (u.dead || u.domain !== 'air') continue;
      if (u.state === 'rtb') {
        if (u.wp.length === 0) this.recover(u);
        continue;
      }
      /* 弹药耗尽 / 编队损失过半 → 返场再出动 (形成真实出动周期) */
      if (u.state !== 'ready') {
        var offAmmo = 0;
        var ak = Object.keys(u.ammo);
        for (var q = 0; q < ak.length; q++) {
          var aw = TWG.WEAPONS[ak[q]];
          if (aw && !aw.ciws && aw.type !== 'ciws' && aw.type !== 'sam') offAmmo += u.ammo[ak[q]];
        }
        var isSupport = (u.role === 'aew' || u.role === 'isr' || u.role === 'elint' || u.role === 'asw' || u.role === 'transport');
        if (!isSupport && offAmmo <= 0 && u.spawn + 900 < this.t) { this.sendHome(u); continue; }
        if (u.n <= Math.floor(u.n0 / 2) && u.n0 >= 2) { this.sendHome(u); continue; }
      }
      if (u.fuel <= 0.28 && u.state !== 'rtb') this.sendHome(u);
      if (u.fuel <= 0) {
        // 燃油耗尽损失
        this.sides[u.side].losses.air += u.n;
        this.event('kill', u.side === 'PLA' ? 'ROC' : 'PLA', '✈ ' + u.name + ' 因基地无法回收/燃油耗尽损失 ' + u.n + ' 架', u);
        this.destroy(u, null);
      }
    }
  };
  Engine.prototype.sendHome = function (u) {
    var b = this.bestRecoveryBase(u);
    u.state = 'rtb'; u.mission = { type: 'rtb' }; u.orbitC = null;
    u.wp = b ? [{ lat: b.lat, lon: b.lon, baseId: b.id }] : [];
    u.rtbBase = b ? b.id : null;
  };
  Engine.prototype.bestRecoveryBase = function (u) {
    var best = null, bs = -1, self = this;
    Object.keys(this.bases).forEach(function (k) {
      var b = self.bases[k];
      if (b.side !== u.side || !b.active || b.ops <= 0.05) return;
      var d = dist(u, b);
      var sc = b.ops * 100 - d / 8 + (b.cave > 0 ? 25 : 0);
      if (sc > bs) { bs = sc; best = b; }
    });
    // 舰载机回收
    if (u.P.carrier) {
      for (var i = 0; i < this.units.length; i++) {
        var c = this.units[i];
        if (c.dead || c.side !== u.side || c.role !== 'cv') continue;
        var sc2 = 130 - dist(u, c) / 6;
        if (sc2 > bs) { bs = sc2; best = { id: 'CV' + c.uid, lat: c.lat, lon: c.lon, carrier: c }; }
      }
    }
    return best;
  };
  Engine.prototype.recover = function (u) {
    var bid = u.rtbBase;
    var b = bid && this.bases[bid];
    if (b) {
      b.inv[u.cls] = (b.inv[u.cls] || 0) + u.n;
      b.aloft = Math.max(0, b.aloft - 1);
      b.ready[u.cls] = this.t + (u.P.turn || 3) * 3600 * (1 / clamp(b.ops, 0.15, 1));
    } else {
      var cv = null;
      for (var i = 0; i < this.units.length; i++) { var c = this.units[i]; if (!c.dead && c.side === u.side && c.role === 'cv' && dist(u, c) < 60) { cv = c; break; } }
      if (cv) { cv.airWing[u.cls] = (cv.airWing[u.cls] || 0) + u.n; }
      else { this.sides[u.side].losses.air += u.n; }
    }
    u.dead = 1; u.state = 'recovered';
  };

  /* 出动: 由 AI 调用 */
  Engine.prototype.launchFlight = function (baseId, cls, count, mission) {
    var b = this.bases[baseId];
    if (!b || !b.active || b.ops <= 0.05) return null;
    if (!TWG.PLATFORMS[cls]) return null;
    if ((b.inv[cls] || 0) < count) return null;
    if (b.ready[cls] && this.t < b.ready[cls]) return null;
    var maxAloft = Math.ceil(b.cap * 0.35 * b.ops);
    if (b.aloft >= maxAloft) return null;
    b.inv[cls] -= count; b.aloft++;
    var u = makeUnit(this, {
      cls: cls, side: b.side, n: count,
      name: TWG.PLATFORMS[cls].name + ' ' + (count) + '机编队 [' + b.name.replace(/基地.*/, '') + ']',
      lat: b.lat, lon: b.lon, base: baseId, home: baseId
    });
    u.alt = TWG.PLATFORMS[cls].helo ? 300 : 8000;
    u.state = 'enroute'; u.mission = mission; u.rtbBase = baseId;
    u.wp = mission.wp || [];
    if (mission.orbit) { u.orbitC = mission.orbit; u.orbitR = mission.orbitR || 45; }
    this.units.push(u);
    this.sides[b.side].sorties += count;
    return u;
  };
  /* 舰载机出动 */
  Engine.prototype.launchCarrier = function (cv, cls, count, mission) {
    if (!TWG.PLATFORMS[cls]) return null;
    if (!cv.airWing || (cv.airWing[cls] || 0) < count) return null;
    if (cv.hp / cv.hp0 < 0.45) return null;
    cv.airWing[cls] -= count;
    var u = makeUnit(this, { cls: cls, side: cv.side, n: count,
      name: TWG.PLATFORMS[cls].name + ' 舰载 ' + count + '机编队', lat: cv.lat, lon: cv.lon });
    u.alt = 7000; u.state = 'enroute'; u.mission = mission; u.wp = mission.wp || [];
    u.carrierUid = cv.uid;
    if (mission.orbit) { u.orbitC = mission.orbit; u.orbitR = mission.orbitR || 40; }
    this.units.push(u);
    this.sides[cv.side].sorties += count;
    return u;
  };

  /* =====================  两栖投送  ==================================== */
  Engine.prototype.embark = function (ship, groundUnit) {
    if (!ship.lift || ship.embarked) return false;
    ship.embarked = { uid: groundUnit.uid, cls: groundUnit.cls, name: groundUnit.name,
      bn: ship.lift.bn || 0.5, troops: Math.min(groundUnit.troops, (ship.lift.troops || 300)),
      cp: groundUnit.cp * clamp((ship.lift.troops || 300) / Math.max(groundUnit.troops, 1), 0, 1) };
    groundUnit.troops -= ship.embarked.troops;
    groundUnit.cp -= ship.embarked.cp;
    groundUnit.embarkedTo = (groundUnit.embarkedTo || 0) + 1;
    if (groundUnit.troops <= 20) { groundUnit.state = 'embarked'; groundUnit.afloat = 1; }
    return true;
  };
  /* 建立登陆场 (首艘登陆器材开始卸载时才真正成立) */
  Engine.prototype.ensureBeachhead = function (key, beach) {
    var ex = this.beachheads[key];
    if (ex) {
      if (!ex.active) {   // 后续梯队再度上陸，重建登陆场
        ex.active = 1; ex.collapsed = 0; ex.startT = this.t; ex.everLanded = 0;
        if (!ex.unit || ex.unit.dead) {
          var nu = makeUnit(this, { cls: 'BEACHHEAD', side: 'PLA', name: '登陆场 · ' + beach.name,
            lat: beach.lat, lon: beach.lon, n: 1 });
          nu.state = 'engaged'; nu.landed = 1; nu.beachKey = key; nu.cp = 0.1; nu.cp0 = 1; nu.cpSynced = 0.1;
          this.units.push(nu); ex.unit = nu;
        }
        this.event('amphib', 'PLA', '⚓ 后续梯队在 ' + beach.name + ' 重建登陆场', beach);
      }
      return ex;
    }
    var bh = { active: 1, cp: 0, troops: 0, bn: 0, supply: 1, suppress: 0, advance: 0, key: key, startT: this.t };
    var u = makeUnit(this, { cls: 'BEACHHEAD', side: 'PLA', name: '登陆场 · ' + beach.name,
      lat: beach.lat, lon: beach.lon, n: 1 });
    u.state = 'engaged'; u.landed = 1; u.beachKey = key; u.cp = 0.1; u.cp0 = 1; u.cpSynced = 0.1;
    this.units.push(u);
    bh.unit = u;
    this.beachheads[key] = bh;
    this.event('amphib', 'PLA', '⚓⚓ 在 ' + beach.name + ' 建立登陆场，首波突击部队开始上陸', beach);
    return bh;
  };
  Engine.prototype.offload = function (ship, dt) {
    var beach = TWG.THEATER.idx.beach[ship.beachId];
    if (!beach) return;
    // 必须走 ensureBeachhead：登陆场若此前被肃清，后续梯队上陸应重建
    var bh = this.ensureBeachhead(ship.beachId, beach);
    var rate = 1 / (3600 * (ship.role === 'barge' ? 4 : ship.role === 'sealift' ? 8 : 3));
    // 滩涂/海况/敌火压制降低卸载效率
    var eff = beach.grade * clamp(this.env.amphib, 0.2, 1) * clamp(1 - beach.flat * 0.15, 0.35, 1) *
      clamp(1 - bh.suppress * 0.7, 0.15, 1);
    if (ship.lift && ship.lift.causeway) eff *= 1.5;
    if (bh.portCaptured) eff *= 1.6;
    ship.offloadT = (ship.offloadT || 0) + dt * rate * eff;
    if (ship.offloadT >= 1 && ship.embarked) {
      bh.cp += ship.embarked.cp; bh.troops += ship.embarked.troops;
      bh.bn += ship.embarked.bn;
      this.sides[ship.side].tonnage += ship.embarked.bn;
      this.event('amphib', ship.side, '⚓ ' + ship.name + ' 在 ' + beach.name + ' 完成卸载：' +
        Math.round(ship.embarked.troops) + ' 兵员上陸，滩头总兵力 ' + Math.round(bh.troops) +
        ' 人 / 战斗力指数 ' + bh.cp.toFixed(0), ship);
      ship.embarked = null; ship.offloadT = 0;
      ship.state = 'enroute';
      ship.mission = { type: 'return' };
      var hp = this.sites[ship.home];
      ship.wp = hp ? [{ lat: hp.lat, lon: hp.lon }] : [];
    }
  };

  /* =====================  地面交战  ==================================== */
  Engine.prototype.groundPhase = function (dt) {
    var self = this, hrs = dt / 3600;
    // 卸载
    for (var i = 0; i < this.units.length; i++) {
      var s = this.units[i];
      if (s.dead) continue;
      if (s.state === 'offloading' && s.beachId) this.offload(s, dt);
    }
    // 滩头战斗
    Object.keys(this.beachheads).forEach(function (bid) {
      var bh = self.beachheads[bid];
      var beach = TWG.THEATER.idx.beach[bid];
      if (!beach) return;
      // 同步：敌方炮兵/空袭对登陆场造成的毁伤 (仅在实体确实受损时回收)
      if (bh.unit && !bh.unit.dead && bh.unit.cpSynced != null && bh.unit.cp < bh.unit.cpSynced - 1e-6) {
        var ratioLoss = clamp(bh.unit.cp / Math.max(bh.unit.cpSynced, 0.01), 0, 1);
        bh.troops *= ratioLoss;
        bh.cp *= ratioLoss;
        bh.unit.cpSynced = bh.unit.cp;
      }
      if (!bh.active) return;
      // 守军: 滩头 40km 内的台军地面部队 (更远的部队需时间机动到位)
      var defCp = 0, defList = [];
      for (var i = 0; i < self.units.length; i++) {
        var d = self.units[i];
        if (d.dead || d.side !== 'ROC' || d.domain !== 'ground') continue;
        if (d.state === 'mobilizing') continue;
        if (!nearBox(d, beach, 40)) continue;
        var dd = dist(d, beach);
        if (dd > 40) continue;
        var w = clamp(1 - dd / 50, 0.15, 1) * (d.P.fortify || 1);
        defCp += d.cp * w; defList.push({ u: d, w: w });
      }
      bh.defCp = defCp;
      if (bh.cp <= 3) {
        if (bh.everLanded) {
          self.event('critical', 'ROC', '★★ ' + beach.name + ' 登陆场被肃清，PLA 滩头阵地崩溃');
          bh.active = 0; bh.collapsed = 1; bh.breakout = 0; bh.advance = 0;
          if (bh.unit) bh.unit.dead = 1;
        }
        return;
      }
      bh.everLanded = 1;
      if (bh.cp < 20) bh.breakout = 0;      // 兵力不足以维持突破态势
      // 空中/炮兵支援
      var plaSupport = self.supportFire('PLA', beach, 60);
      var rocSupport = self.supportFire('ROC', beach, 60);
      // 交战: 修正 Lanchester (双方均按对方实力受损，比值经开方压制以避免失控)
      var terrain = beach.region === '东部' ? 1.5 : beach.region === '空降' ? 1.15 : 1.0;
      // 登陆初期 12 小时享有火力准备/舰炮支援与守军未展开的红利
      var assaultBonus = (bh.startT != null && self.t - bh.startT < 12 * 3600) ? 1.45 : 1.0;
      var atk = bh.cp * (1 + plaSupport * 0.6) * clamp(bh.supply, 0.25, 1.1) * assaultBonus;
      var def = defCp * (1 + rocSupport * 0.5) * terrain * 1.1;
      var ratio = atk / Math.max(def, 1);
      var inten = 0.0055 * hrs;
      var rr = clamp(Math.sqrt(clamp(ratio, 0.15, 6)), 0.4, 2.4);
      var lossA = def * inten / rr;                 // 进攻方损失 ← 守军实力
      var lossD = atk * inten * rr * 0.8;           // 守军损失   ← 进攻方实力
      lossA = Math.max(lossA, lossD * 0.35);        // 进攻方始终付出代价(强攻不可能零伤亡)
      lossA = Math.min(lossA, bh.cp * 0.25);
      bh.cp = Math.max(0, bh.cp - lossA);
      bh.troops = Math.max(0, bh.troops - lossA * 45);
      bh.plaLoss = (bh.plaLoss || 0) + lossA * 45;
      // 分摊守军损失
      defList.forEach(function (o) {
        var share = defCp > 0 ? (o.u.cp * o.w) / defCp : 0;
        var l = Math.min(lossD * share, o.u.cp * 0.5);
        o.u.cp = Math.max(0, o.u.cp - l);
        o.u.troops = Math.max(0, o.u.troops - l * 42);
        if (o.u.cp <= o.u.cp0 * 0.12 && !o.u.broken) {
          o.u.broken = 1;
          self.event('ground', 'PLA', '⚔ ' + o.u.name + ' 遭重创失去建制战力（' + beach.name + '方向）', o.u);
        }
      });
      bh.rocLoss = (bh.rocLoss || 0) + lossD * 42;
      // 突破判定: 稳定占领并向纵深发展
      if (ratio > 1.6 && !bh.breakout && bh.bn >= 3 && bh.supply > 0.5) {
        bh.breakout = 1;
        self.event('critical', 'PLA', '★★★ ' + beach.name + ' 登陆场稳固并向纵深突破！目标：' + beach.obj);
      }
      if (ratio > 1.9 && bh.breakout) {
        // 有阻抗推进速度：装甲/机步 5-20 km/日，受兵力规模与补给限制
        bh.advance = (bh.advance || 0) + hrs * 0.42 * clamp(bh.supply, 0.3, 1.2) *
          clamp(ratio / 2.2, 0.4, 1.5) * clamp(bh.bn / 6, 0.15, 1.2);
        // 战线纵深受实际兵力约束：兵力被消耗后无法维持过长战线
        bh.advance = Math.min(bh.advance, 20 + bh.cp * 0.6);
        self.tryCapture(bh, beach);
      }
      bh.suppress = clamp(rocSupport * 0.5 + defCp / 400, 0, 0.9);
      bh.ratio = ratio;
      // 回写登陆场实体 (使其可被侦察/打击/显示)
      if (bh.unit && !bh.unit.dead) {
        bh.unit.cp = bh.cp; bh.unit.cp0 = Math.max(bh.unit.cp0, bh.cp);
        bh.unit.cpSynced = bh.cp;
        bh.unit.troops = Math.round(bh.troops);
        bh.unit.hp = Math.max(1, bh.unit.hp0 * clamp(bh.cp / Math.max(bh.unit.cp0, 1), 0.02, 1));
        bh.unit.lat = beach.lat; bh.unit.lon = beach.lon;
        bh.unit.name = '登陆场 · ' + beach.name + '（' + Math.round(bh.troops / 1000) + 'k兵力）';
        if (bh.cp <= 3) { bh.unit.dead = 1; }
      }
    });
    // 后备动员部队向受威胁方向机动
    // (由 AI 指派 moveTo)
  };
  Engine.prototype.supportFire = function (side, pos, radius) {
    var v = 0;
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (u.dead || u.side !== side) continue;
      if (u.domain === 'air' && (u.role === 'attack_helo' || u.role === 'strike' || u.role === 'multirole' || u.role === 'ucav')) {
        if (nearBox(u, pos, radius) && dist(u, pos) < radius) v += 0.09 * u.n * u.fire;
      } else if (u.domain === 'ground' && (u.role === 'arty_bn' || u.role === 'mlrs_bn' || u.role === 'mlrs_bde')) {
        var rng = u.P.rangeMax || 40;
        if (nearBox(u, pos, rng) && dist(u, pos) < rng) v += 0.16 * (u.cp / Math.max(u.cp0, 1)) * u.fire;
      } else if (u.domain === 'surface' && u.P.disp > 3000) {
        if (nearBox(u, pos, 30) && dist(u, pos) < 30) v += 0.06 * u.fire;
      }
    }
    return clamp(v, 0, 3.0);
  };
  /* 纵深夺控：每次只推进夺取最近的一个未占目标，并要求足够兵力 */
  Engine.prototype.tryCapture = function (bh, beach) {
    var self = this, adv = bh.advance || 0;
    var cands = [];
    Object.keys(this.sites).forEach(function (k) {
      var s = self.sites[k];
      if (s.owner !== 'ROC') return;
      var d = dist(s, beach);
      if (d > adv + 6) return;
      var need = (s.lift >= 4 || s.berth >= 10) ? 55 : (s.value >= 8 ? 40 : 18);
      if (bh.cp < need) return;
      cands.push({ d: d, kind: 'site', o: s, k: k });
    });
    Object.keys(this.bases).forEach(function (k) {
      var b = self.bases[k];
      if (b.side !== 'ROC' || b.captured) return;
      var d = dist(b, beach);
      if (d > adv + 6) return;
      if (bh.cp < (b.cap >= 50 ? 45 : 20)) return;
      cands.push({ d: d, kind: 'base', o: b, k: k });
    });
    TWG.THEATER.CITIES.forEach(function (c) {
      if (c.side !== 'ROC' || c.taken) return;
      var d = dist(c, beach);
      if (d > adv + 4) return;
      // 城市攻坚需要压倒性兵力与围攻时间
      var need = c.capital ? 220 : c.pop > 150 ? 150 : 70;
      if (bh.cp < need) return;
      c.siege = (c.siege || 0) + 0.25;
      if (c.siege < (c.urban || 1.5) * 12) return;   // 巷战耗时 (小时)
      cands.push({ d: d, kind: 'city', o: c, k: c.name });
    });
    if (!cands.length) return;
    cands.sort(function (a, b) { return a.d - b.d; });
    var pick = cands[0];
    if (pick.kind === 'site') {
      var s = pick.o;
      s.owner = 'PLA'; s.capturedAt = this.t; this.captured[pick.k] = 1;
      if (s.lift) bh.portCaptured = 1;
      this.event('critical', 'PLA', '★★★ 攻占 ' + s.name + (s.lift ? '（获得港口卸载能力 +' + s.lift + ' 营/日，重装可直接上陸）' : ''), s);
    } else if (pick.kind === 'base') {
      var b = pick.o;
      b.captured = 1; b.side = 'PLA'; b.owner = 'PLA'; b.inv = {}; b.cuts = Math.max(b.cuts, 2);
      this.captured[pick.k] = 1;
      this.event('critical', 'PLA', '★★★ 攻占 ' + b.name + '（可转用为前进机场，需抢修跑道）', b);
    } else {
      var c = pick.o;
      c.taken = 1;
      this.event('critical', 'PLA', '★★★ ' + c.name + ' 陷落' + (c.capital ? '——首都被占领，台湾当局指挥中枢瓦解！' : '（城市巷战结束）'), c);
    }
  };

  /* =====================  后勤  ======================================== */
  Engine.prototype.logistics = function (dt) {
    var self = this, L = TWG.OOB.LOGISTICS;
    var dd = dt / 86400;
    // PGM 消耗
    ['PLA', 'ROC'].forEach(function (s) {
      var sd = self.sides[s];
      var days = s === 'PLA' ? L.PLA.pgmDays : L.ROC.pgmDays;
      var burn = sd.missilesFired;
      sd.pgm = clamp(1 - burn / (days * (s === 'PLA' ? 260 : 150)), 0, 1);
    });
    // 滩头补给: 由跨海投送能力与被攻占港口决定
    var portLift = 0;
    Object.keys(this.sites).forEach(function (k) {
      var s = self.sites[k];
      if (s.owner === 'PLA' && s.lift && s.kind === 'port' && TWG.THEATER.idx.port[k] && TWG.THEATER.idx.port[k].side === 'ROC')
        portLift += s.lift * s.ops;
    });
    var seaControl = this.seaControlIndex();
    var bhs = Object.keys(this.beachheads).filter(function (k) {
      return self.beachheads[k].active && self.beachheads[k].bn > 0.2 && k.indexOf('AIR:') !== 0;
    });
    Object.keys(this.beachheads).forEach(function (k) {
      var bh = self.beachheads[k];
      if (!bh.active) return;
      if (k.indexOf('AIR:') === 0) {
        // 空降场依靠空中补给 + 就地夺取的机场
        bh.supply = clamp(bh.supply * 0.95 + 0.05 * (bh.portCaptured ? 1.1 : 0.55), 0.05, 1.2);
        return;
      }
      var supplyCap = (L.PLA.sealiftPerDay + portLift) * clamp(seaControl, 0.1, 1) / Math.max(bhs.length, 1);
      var demand = Math.max(0.5, bh.bn * 0.22);
      bh.supply = clamp(bh.supply * 0.9 + 0.1 * (supplyCap / demand), 0.05, 1.2);
      if (bh.supply < 0.45 && !bh.warnSupply) {
        bh.warnSupply = 1;
        self.event('logi', 'PLA', '⚠ ' + (TWG.THEATER.idx.beach[k] || {}).name + ' 登陆场补给不足（' +
          (bh.supply * 100).toFixed(0) + '%），进攻势头衰减');
      } else if (bh.supply >= 0.7) bh.warnSupply = 0;
    });
    // 士气
    ['PLA', 'ROC'].forEach(function (s) {
      var sd = self.sides[s];
      var lost = sd.losses.air + sd.losses.ship * 2 + sd.losses.ground * 1.5;
      var base = s === 'PLA' ? 240 : 160;
      sd.morale = clamp(1 - lost / base * 0.5, 0.25, 1) * (0.7 + 0.3 * sd.c2);
    });
  };

  Engine.prototype.seaControlIndex = function () {
    // 海峡中部 (119-121E, 22.5-25.5N) 双方水面战力对比
    var pla = 0, roc = 0;
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (u.dead || u.domain !== 'surface') continue;
      if (u.lon < 118.2 || u.lon > 121.6 || u.lat < 22.0 || u.lat > 26.0) continue;
      var v = Math.pow(u.P.disp || 500, 0.5) / 30 * u.fire;
      if (u.side === 'PLA') pla += v; else if (u.side === 'ROC') roc += v;
    }
    // 岸基反舰火力计入台方拒止
    for (var j = 0; j < this.units.length; j++) {
      var g = this.units[j];
      if (g.dead || g.side !== 'ROC' || g.role !== 'ashm_bn') continue;
      var am = 0; Object.keys(g.ammo).forEach(function (k) { am += g.ammo[k]; });
      roc += (am > 0 ? 2.2 : 0) * g.fire;
    }
    return clamp(pla / Math.max(pla + roc, 1), 0, 1);
  };
  Engine.prototype.airControlIndex = function () {
    var pla = 0, roc = 0, self = this;
    ['PLA', 'ROC'].forEach(function (s) {
      var v = 0;
      Object.keys(self.bases).forEach(function (k) {
        var b = self.bases[k]; if (b.side !== s || !b.active) return;
        var n = 0; Object.keys(b.inv).forEach(function (c) {
          var pp = TWG.PLATFORMS[c];
          if (pp && (pp.role === 'fighter' || pp.role === 'multirole' || pp.role === 'interceptor'))
            n += b.inv[c] * (pp.gen >= 5 ? 2.2 : pp.gen >= 4.5 ? 1.5 : 1);
        });
        v += n * (0.35 + 0.65 * clamp(b.ops, 0, 1));
      });
      for (var i = 0; i < self.units.length; i++) {
        var u = self.units[i];
        if (u.dead || u.side !== s || u.domain !== 'air') continue;
        var pp = u.P;
        if (pp.role === 'fighter' || pp.role === 'multirole' || pp.role === 'interceptor')
          v += u.n * (pp.gen >= 5 ? 2.2 : pp.gen >= 4.5 ? 1.5 : 1);
      }
      if (s === 'PLA') pla = v; else roc = v;
    });
    return clamp(pla / Math.max(pla + roc, 1), 0, 1);
  };

  /* =====================  统计采样  ==================================== */
  Engine.prototype.sample = function () {
    var self = this;
    function cnt(side, dom) {
      var n = 0;
      for (var i = 0; i < self.units.length; i++) { var u = self.units[i]; if (!u.dead && u.side === side && u.domain === dom) n += (dom === 'air' ? u.n : 1); }
      return n;
    }
    function invAir(side) {
      var n = 0; Object.keys(self.bases).forEach(function (k) {
        var b = self.bases[k]; if (b.side !== side) return;
        Object.keys(b.inv).forEach(function (c) { n += b.inv[c]; });
      });
      for (var i = 0; i < self.units.length; i++) { var u = self.units[i]; if (!u.dead && u.side === side && u.domain === 'air') n += u.n; }
      return n;
    }
    var bh = 0, bhT = 0;
    Object.keys(this.beachheads).forEach(function (k) { var b = self.beachheads[k]; if (b.active) { bh += b.cp; bhT += b.troops; } });
    this.stats.push({
      t: this.t, air: this.airControlIndex(), sea: this.seaControlIndex(),
      plaAir: invAir('PLA'), rocAir: invAir('ROC'),
      plaShip: cnt('PLA', 'surface'), rocShip: cnt('ROC', 'surface'),
      plaLossAir: this.sides.PLA.losses.air + this.sides.PLA.losses.aircraftGround,
      rocLossAir: this.sides.ROC.losses.air + this.sides.ROC.losses.aircraftGround,
      plaLossShip: this.sides.PLA.losses.ship, rocLossShip: this.sides.ROC.losses.ship,
      bhCp: bh, bhTroops: bhT, pgmPLA: this.sides.PLA.pgm, pgmROC: this.sides.ROC.pgm,
      moralePLA: this.sides.PLA.morale, moraleROC: this.sides.ROC.morale,
      baseOpsROC: this.baseOpsAvg('ROC'), baseOpsPLA: this.baseOpsAvg('PLA')
    });
    if (this.stats.length > 3000) this.stats.splice(0, 800);
  };
  Engine.prototype.baseOpsAvg = function (side) {
    var s = 0, n = 0, self = this;
    Object.keys(this.bases).forEach(function (k) {
      var b = self.bases[k]; if (b.side !== side || !b.active || b.hwy) return;
      s += b.ops; n++;
    });
    return n ? s / n : 0;
  };

  /* =====================  胜负判定  ==================================== */
  Engine.prototype.checkEnd = function () {
    var self = this, sc = this.scenario;
    var taipei = TWG.THEATER.CITIES.filter(function (c) { return c.capital; })[0];
    if (taipei && taipei.taken) {
      return this.end('PLA', '首都台北陷落，台湾当局失去有效指挥与抵抗能力');
    }
    var capturedPorts = 0;
    Object.keys(this.sites).forEach(function (k) {
      var s = self.sites[k];
      if (s.kind === 'port' && s.owner === 'PLA' && TWG.THEATER.idx.port[k] && TWG.THEATER.idx.port[k].side === 'ROC') capturedPorts++;
    });
    this.capturedPorts = capturedPorts;
    // 两栖投送能力被摧毁
    var liftAlive = 0, liftTotal = 0;
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (u.side !== 'PLA' || !u.P.lift) continue;
      liftTotal += u.P.lift.bn || 0.5;
      if (!u.dead) liftAlive += (u.P.lift.bn || 0.5);
    }
    this.liftRatio = liftTotal ? liftAlive / liftTotal : 1;
    if (sc.needAmphib && liftTotal > 0 && this.liftRatio < 0.28 && this.t > 3 * 86400) {
      return this.end('ROC', '解放军两栖投送船团损失超过 72%，跨海输送能力崩溃，登陆战役无法持续');
    }
    var anyBH = Object.keys(this.beachheads).some(function (k) { return self.beachheads[k].active; });
    if (sc.needAmphib && this.t > 5 * 86400 && !anyBH && Object.keys(this.beachheads).length > 0) {
      return this.end('ROC', '全部登陆场被肃清，解放军上陸部队被歼灭，反登陆作战成功');
    }
    if (this.t >= sc.maxDays * 86400) {
      var score = this.score();
      var winner = score.pla > score.roc + 8 ? 'PLA' : score.roc > score.pla + 8 ? 'ROC' : null;
      return this.end(winner, '推演达到时限 D+' + sc.maxDays + '，按战役目标达成度判定（PLA ' +
        score.pla.toFixed(0) + ' : ROC ' + score.roc.toFixed(0) + '）');
    }
  };
  Engine.prototype.score = function () {
    var self = this;
    var air = this.airControlIndex(), sea = this.seaControlIndex();
    var bhT = 0; Object.keys(this.beachheads).forEach(function (k) { if (self.beachheads[k].active) bhT += self.beachheads[k].troops; });
    var cities = TWG.THEATER.CITIES.filter(function (c) { return c.side === 'ROC' && c.taken; }).reduce(function (a, c) { return a + c.value; }, 0);
    var pla = air * 25 + sea * 25 + clamp(bhT / 30000, 0, 1) * 20 + clamp(cities / 60, 0, 1) * 30;
    var rocSurv = 0;
    var rocBaseOps = this.baseOpsAvg('ROC');
    var rocShips = 0, rocShips0 = 0;
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (u.side !== 'ROC' || u.domain !== 'surface') continue;
      rocShips0++; if (!u.dead) rocShips++;
    }
    rocSurv = (1 - air) * 25 + (1 - sea) * 25 + rocBaseOps * 20 +
      (rocShips0 ? rocShips / rocShips0 : 1) * 15 + (1 - clamp(cities / 60, 0, 1)) * 15;
    if (this.usArrived) rocSurv += 10;
    return { pla: pla, roc: rocSurv, air: air, sea: sea, bhTroops: bhT, cities: cities };
  };
  Engine.prototype.end = function (winner, why) {
    this.ended = { winner: winner, why: why, t: this.t, clock: this.clock(), score: this.score() };
    this.event('end', winner, '════ 推演结束 ' + this.clock() + ' ════ ' +
      (winner === 'PLA' ? '解放军达成战役目标' : winner === 'ROC' ? '台军成功遂行防卫作战' : '双方均未达成决定性目标（僵持）') +
      '：' + why);
    if (this.onEnd) this.onEnd(this.ended);
    return this.ended;
  };

  /* =====================  查询工具  ==================================== */
  Engine.prototype.unitById = function (uid) {
    if (this._idxTick !== this.tick) {
      this._idx = {}; this._idxTick = this.tick;
      for (var i = 0; i < this.units.length; i++) this._idx[this.units[i].uid] = this.units[i];
    }
    var u = this._idx[uid];
    if (u) return u;
    for (var j = 0; j < this.units.length; j++) if (this.units[j].uid === uid) { this._idx[uid] = this.units[j]; return this.units[j]; }
    return null;
  };
  Engine.prototype.alive = function (side, dom) {
    var r = [];
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (u.dead) continue;
      if (side && u.side !== side) continue;
      if (dom && u.domain !== dom) continue;
      r.push(u);
    }
    return r;
  };

  TWG.geo = { dist: dist, bearing: bearing, moveTo: moveTo, clamp: clamp, nearBox: nearBox, seaDepth: seaDepth, isDeep: isDeep };
  TWG.RNG = RNG;
  TWG.makeUnit = makeUnit;
  TWG.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
