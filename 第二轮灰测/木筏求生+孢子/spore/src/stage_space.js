/* ==========================================================================
 * 孢子·星际阶段  SP.StageSpace   ——  唯一文件 stage_space.js
 * --------------------------------------------------------------------------
 * 经典脚本（非 ES 模块）：只定义 SP.StageSpace，全部逻辑在函数体内。
 * 依赖：全局 THREE (r149 UMD) + 宿主 SP.U / SP.Tex / SP.Audio / SP.Genome / game.ui
 * 零外部资源：贴图全部来自 SP.Tex 或本地 Canvas。
 *
 * 模块结构：
 *   1. 常量与状态
 *   2. Canvas 贴图库（光晕/圆点/圆环/文字标签/星云）
 *   3. 特效系统（粒子爆炸、光束、遮罩）
 *   4. 星系生成（螺旋银河、约120星系、黑洞、Grox环带）
 *   5. 帝国生成（8~11帝国 + 格罗克斯）
 *   6. 飞船模型（碟形 + 引擎 + 护盾球）
 *   7. 银河视图（悬停高亮、航线虚线、跃迁、外交/任务/徽章）
 *   8. 行星视图（WASD飞行、鼠标瞄准、地表场景）
 *   9. 工具系统（扫描/牵引/地球化/殖民/贸易/武器/修理/巨石）
 *  10. 战斗（敌舰AI、激光、导弹、殖民地攻防、Grox突破战）
 *  11. 任务与徽章
 *  12. update 主循环 / 存档 / 出入口
 * ========================================================================== */
SP.StageSpace = function (game) {
  'use strict';
  var self = this;
  var U = SP.U, TAU = U.TAU, clamp = U.clamp, lerp = U.lerp, rand = U.rand, randi = U.randi,
      choice = U.choice, chance = U.chance, Rng = U.Rng;

  /* ================= 1. 常量与状态 ================= */
  var SPICE = [
    { key: 'red', name: '红香料', price: 60, color: 0xff5555 },
    { key: 'yellow', name: '黄香料', price: 50, color: 0xffd23f },
    { key: 'green', name: '绿香料', price: 70, color: 0x5fde5f },
    { key: 'blue', name: '蓝香料', price: 90, color: 0x4f9fff },
    { key: 'purple', name: '紫香料', price: 110, color: 0xb45fff },
    { key: 'pink', name: '粉香料', price: 130, color: 0xff7fd0 },
    { key: 'white', name: '白香料', price: 160, color: 0xe8e8ff },
    { key: 'black', name: '黑香料', price: 200, color: 0x5a5a6a }
  ];
  var GOODS = [
    { key: 'missile', name: '导弹', price: 120 },
    { key: 'fuel', name: '燃料电池', price: 150 },
    { key: 'repair', name: '维修套件', price: 250 }
  ];
  var PK_CN = { lush: '丰饶', dry: '干旱', ice: '冰封', gas: '气态', rock: '岩石' };
  var PERS = ['好战', '贸易', '宗教', '科学'];
  var EMP_COLORS = [0x44aaff, 0xff6644, 0x66cc55, 0xffcc33, 0xcc66ff, 0xff77aa, 0x33ddcc, 0xbb8844, 0x7799ff, 0xee5599, 0x88dd66];
  var ENAME = ['泽尔', '克朗', '维加', '塔努', '奥瑟', '科瑞', '米拉', '萨隆', '伊修', '帕克', '胡恩'];
  var ESUF = ['帝国', '联邦', '同盟', '王国', '议会', '合众'];
  var GA = ['克', '塔', '泽', '诺', '维', '帕', '穆', '伊', '奥', '斯', '洛', '提', '亚', '卡', '伦', '希'];
  var GB = ['尔', '塔', '诺', '姆', '斯', '因', '亚', '恩', '乌', '瑞', '隆', '德'];
  var GREEK = ['α ', 'β ', 'γ ', 'δ ', 'ε ', 'ζ ', 'θ ', 'λ ', 'σ ', 'φ '];
  var CA = ['呜', '咔', '吱', '噜', '多', '奇', '布', '咕', '米', '哞', '嘶', '嗒'];
  var BADGES = [
    { key: 'colonist', icon: '🏠', name: '殖民先驱', desc: '建立第一座殖民地', cond: function () { return S.colCount >= 1; } },
    { key: 'ally', icon: '🤝', name: '星际盟友', desc: '与一个帝国结盟', cond: function () { return S.allyCount >= 1; } },
    { key: 'trader', icon: '💰', name: '贸易大亨', desc: '累计交易额达 10000', cond: function () { return S.tradeTotal >= 10000; } },
    { key: 'terra', icon: '🌍', name: '地球化大师', desc: '3 颗行星宜居度达到 2', cond: function () { return countT2() >= 3; } },
    { key: 'hunter', icon: '🎯', name: '猎手', desc: '击落 10 艘敌舰', cond: function () { return S.kills >= 10; } },
    { key: 'explorer', icon: '🔭', name: '探索者', desc: '访问 10 个星系', cond: function () { return S.visitedCount >= 10; } },
    { key: 'traveler', icon: '🚀', name: '星际旅人', desc: '访问 25 个星系', cond: function () { return S.visitedCount >= 25; } },
    { key: 'spice', icon: '🌶', name: '香料收藏家', desc: '同时持有 6 种香料', cond: function () { var n = 0; for (var k in S.cargo.spice) if (S.cargo.spice[k] > 0) n++; return n >= 6; } }
  ];

  var S = {
    view: 'galaxy', t: 0, money: 100000,
    energy: 100, shield: 100, hull: 100, cargoCap: 60,
    cargo: { spice: {}, goods: {} },
    creatures: [],
    curSystem: null, curPlanet: null,
    hoverSys: null, warp: null, warpDots: [],
    tool: 'scan', lat: 0, lng: 0,
    scanT: 0, scanRing: null,
    laserCd: 0, noE: false, collectT: 0,
    groxFight: false, groxBreached: false, groxKills: 0, groxNeed: 3,
    raids: [], shots: [], parts: [], beams: [],
    quests: [], qid: 1, questTimer: 18,
    raidTimer: 55, greetT: 0,
    badges: {}, badgeT: 0,
    kills: 0, tradeTotal: 0, t2planets: 0,
    visitedCount: 0, colCount: 0, allyCount: 0,
    prevDown0: false, hudT: 0,
    dialogOpen: false,
    flashA: 0, winT: 0, winDialog: false,
    shieldFlash: 0, hullFlash: 0,
    startPos: new THREE.Vector3(0, 0, 0)
  };
  var PLAYER = { id: 'player', name: '你的联盟', color: 0x66ccff, personality: '科学' };
  var GROX = null;
  var SYSTEMS = [], EMPIRES = [], CENTER = null, groxSystems = [];
  var sysSprites = [], sysById = {}, empById = {};
  var gGalaxy = null, gPlanet = null, gFx = null, overlay = null;
  var shipMesh = null, shipMarker = null, engMats = [], shieldMat = null, hullMats = [];
  var hlRing = null, galaxyHlRing = null;
  var rc = new THREE.Raycaster();
  var spaceHeld = false;
  var _v2 = new THREE.Vector2(), _v3 = new THREE.Vector3(), _plane = new THREE.Plane();

  /* ================= 2. Canvas 贴图库 ================= */
  var _tex = {};
  function makeTex(key, draw, w, h) {
    if (!_tex[key]) {
      var c = document.createElement('canvas');
      c.width = w || 64; c.height = h || w || 64;
      draw(c.getContext('2d'), c.width, c.height);
      var t = new THREE.CanvasTexture(c);
      if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
      _tex[key] = t;
    }
    return _tex[key];
  }
  function glowTex() { return makeTex('glow', function (x, SZ) {
    var g = x.createRadialGradient(SZ / 2, SZ / 2, 0, SZ / 2, SZ / 2, SZ / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, SZ, SZ);
  }, 64); }
  function dotTex() { return makeTex('dot', function (x, SZ) {
    var g = x.createRadialGradient(SZ / 2, SZ / 2, 0, SZ / 2, SZ / 2, SZ / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, SZ, SZ);
  }, 16); }
  function ringTex() { return makeTex('ring', function (x, SZ) {
    x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = SZ * 0.07;
    x.beginPath(); x.arc(SZ / 2, SZ / 2, SZ * 0.36, 0, TAU); x.stroke();
  }, 64); }
  function labelTex(text) {
    var key = 'label_' + text;
    if (!_tex[key]) {
      var c = document.createElement('canvas'); c.width = 256; c.height = 48;
      var x = c.getContext('2d');
      x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(6,10,20,0.6)'; x.fillRect(0, 0, 256, 48);
      x.fillStyle = '#cfe8ff'; x.fillText(text, 128, 25);
      var t = new THREE.CanvasTexture(c);
      if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
      _tex[key] = t;
    }
    return _tex[key];
  }
  function nebulaTexLocal(colorHex) {
    var key = 'neb_' + colorHex;
    if (!_tex[key]) {
      var SZ = 256, c = document.createElement('canvas'); c.width = SZ; c.height = SZ;
      var x = c.getContext('2d');
      var col = new THREE.Color(colorHex);
      var rr = Math.round(col.r * 255), gg = Math.round(col.g * 255), bb = Math.round(col.b * 255);
      for (var i = 0; i < 24; i++) {
        var cx = Math.random() * SZ, cy = Math.random() * SZ, r = 26 + Math.random() * 92;
        var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(' + rr + ',' + gg + ',' + bb + ',0.5)');
        g.addColorStop(1, 'rgba(' + rr + ',' + gg + ',' + bb + ',0)');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
      }
      var t = new THREE.CanvasTexture(c);
      _tex[key] = t;
    }
    return _tex[key];
  }

  /* ================= 3. 特效系统 ================= */
  function burstAt(pos, color, n, speed, size, life) {
    for (var i = 0; i < n; i++) {
      var m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: color, transparent: true, opacity: 0.9, depthWrite: false }));
      m.position.copy(pos); m.scale.setScalar(size);
      var v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(speed);
      gFx.add(m);
      S.parts.push({ m: m, v: v, g: 5, life: life || 0.75, max: life || 0.75, s: size });
    }
  }
  function burst(pos, color, n, speed, size) { burstAt(pos, color, n, speed, size, 0.8); }
  function beamFx(a, b, color, life) {
    var g = new THREE.BufferGeometry().setFromPoints([a, b]);
    var mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.9 });
    var line = new THREE.Line(g, mat);
    gFx.add(line);
    S.beams.push({ a: a.clone(), b: b.clone(), line: line, life: life, max: life });
  }
  function flash() { S.flashA = 0.9; }
  function updateFx(dt) {
    var i;
    for (i = S.parts.length - 1; i >= 0; i--) {
      var p = S.parts[i];
      p.life -= dt;
      if (p.life <= 0) { gFx.remove(p.m); disposeObj(p.m); S.parts.splice(i, 1); continue; }
      p.m.position.addScaledVector(p.v, dt);
      p.v.y -= p.g * dt;
      var k = p.life / p.max;
      p.m.material.opacity = k;
      p.m.scale.setScalar(p.s * (1.6 - k * 0.6));
    }
    for (i = S.beams.length - 1; i >= 0; i--) {
      var b = S.beams[i];
      b.life -= dt;
      if (b.life <= 0) { gFx.remove(b.line); disposeObj(b.line); S.beams.splice(i, 1); continue; }
      b.line.geometry.setFromPoints([b.a, b.b]);
      b.line.material.opacity = (b.life / b.max) * 0.9;
    }
    if (shieldMat) {
      if (S.shieldFlash > 0) { S.shieldFlash -= dt; shieldMat.opacity = 0.25 + Math.sin(S.t * 60) * 0.18; }
      else shieldMat.opacity = 0.14 + (S.shield / 100) * 0.06;
    }
    if (S.hullFlash > 0) S.hullFlash -= dt;
    for (i = 0; i < engMats.length; i++) engMats[i].emissiveIntensity = 1.4 + Math.sin(S.t * 9) * 0.7;
    if (overlay) {
      overlay.position.copy(game.camera.position);
      overlay.lookAt(game.camera.position.clone().add(game.camera.getWorldDirection(_v3)));
      if (S.flashA > 0) { S.flashA -= dt * 2.2; overlay.material.opacity = Math.max(0, S.flashA); }
    }
    if (S.winT > 0) {
      S.winT -= dt;
      overlay.material.opacity = Math.max(overlay.material.opacity, 1 - Math.max(0, S.winT) / 1.6);
      if (S.winT <= 0 && !S.winDialog) {
        S.winDialog = true;
        dialog('宇宙的答案',
          '你穿越了格罗克斯的重重封锁，抵达银河核心。\n亿万星辰在此汇聚，所有生命的疑问都指向同一个答案：\n\n存在本身，就是宇宙的答案。\n\n你的文明已成为银河的传说。\n\n访问星系 ' + S.visitedCount + ' · 徽章 ' + badgeCount() + '/' + BADGES.length + ' · 星币 ' + S.money,
          [btn('见证终局', function () {
            try { game.ui.closeDialog(); } catch (e) {}
            S.winDialog = false;
            game.win({ stage: 'space', money: S.money, visited: S.visitedCount, colonies: S.colCount, badges: badgeList() });
          })]);
      }
    }
  }
  function disposeObj(o) {
    if (!o) return;
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); }); else o.material.dispose(); }
  }
  function clearGroup(g) {
    if (!g) return;
    game.scene.remove(g);
    g.traverse(function (o) { disposeObj(o); });
  }

  /* ================= 4. 星系生成 ================= */
  function shuf(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) { var j = rng.int(0, i); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function genName(rng) {
    var g = rng.chance(0.5) ? rng.pick(GREEK) : '';
    return g + rng.pick(GA) + rng.pick(GB) + '星系';
  }
  function genCreatureName(rng) { return rng.pick(CA) + rng.pick(CA) + rng.pick(['', '', '', '兽']); }
  function starColor(rng) {
    var r = rng.next();
    if (r < 0.35) return 0xfff2cc;
    if (r < 0.55) return 0xffd9a0;
    if (r < 0.7) return 0xffb36b;
    if (r < 0.85) return 0xff8f8f;
    return 0xa8d8ff;
  }
  function spiceKey(rng, arr) { return SPICE[rng.pick(arr)].key; }
  function makePlanet(rng, sys, idx) {
    var kind = rng.pick(['lush', 'dry', 'ice', 'gas', 'rock']);
    var p = {
      name: sys.name + ' ' + 'ⅠⅡⅢⅣⅤ'[idx], kind: kind, size: rng.int(1, 3),
      spin: rng.range(0.03, 0.12), tilt: rng.range(-0.35, 0.35),
      stats: { atm: rng.int(0, 2), temp: rng.int(0, 2), water: rng.int(0, 2), life: 0 },
      spice: null, scanned: false, monolith: false, civ: 0, civT: 0, colony: null,
      crNames: [], creatures: [], mesh: null, radius: 40, dir: null
    };
    if (kind === 'lush') { p.stats.life = rng.int(1, 2); p.spice = rng.chance(0.9) ? spiceKey(rng, [0, 1, 2, 5]) : null; }
    else if (kind === 'dry') { p.stats.life = rng.int(0, 1); p.spice = rng.chance(0.85) ? spiceKey(rng, [1, 3, 6]) : null; }
    else if (kind === 'ice') { p.stats.life = rng.int(0, 1); p.spice = rng.chance(0.85) ? spiceKey(rng, [4, 6, 0]) : null; }
    else if (kind === 'gas') { p.stats.life = 0; p.spice = rng.chance(0.8) ? spiceKey(rng, [3, 4]) : null; }
    else { p.stats.life = 0; p.spice = rng.chance(0.6) ? spiceKey(rng, [7]) : null; }
    var cn = rng.int(2, 6);
    for (var i = 0; i < cn; i++) p.crNames.push(genCreatureName(rng));
    return p;
  }
  function tScore(p) {
    var st = p.stats;
    return clamp(Math.floor((st.atm + st.temp + st.water + st.life) / 2.0), 0, 3);
  }
  function buildSystemMarker(s) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: s.color, transparent: true, opacity: 0.95, depthWrite: false }));
    sp.scale.setScalar(8 + s.planets.length * 1.3);
    sp.position.copy(s.pos);
    sp.userData.sys = s;
    gGalaxy.add(sp);
    s.sprite = sp;
    sysSprites.push(sp);
    sysById[s.id] = s;
    var lb = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(s.name), transparent: true, opacity: 0, depthWrite: false }));
    lb.scale.set(150, 28, 1);
    lb.position.copy(s.pos).add(new THREE.Vector3(0, 30, 0));
    gGalaxy.add(lb);
    s.label = lb;
  }
  function makeSystem(rng, x, y, z, name) {
    var s = {
      id: '', name: name, pos: new THREE.Vector3(x, y, z),
      color: starColor(rng), starClass: choice(['G', 'K', 'M', 'F', 'A', 'B', '白矮星', '红巨星']),
      planets: [], owner: null, scanned: false, visited: false,
      isGrox: false, isCenter: false, isHome: false, colMarker: null
    };
    var n = rng.int(1, 5);
    for (var i = 0; i < n; i++) s.planets.push(makePlanet(rng, s, i));
    buildSystemMarker(s);
    return s;
  }
  function buildBackgroundStars(rng) {
    var N = 14000, pos = [], col = [];
    for (var i = 0; i < N; i++) {
      var a = rng.range(0, TAU), r = Math.pow(rng.next(), 0.6) * 1450;
      var y = rng.range(-50, 50);
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      var b = 0.35 + rng.next() * 0.65;
      var warm = rng.chance(0.18);
      col.push(b * (warm ? 1 : 0.75), b * (warm ? 0.85 : 0.85), b * (warm ? 0.6 : 1));
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    var m = new THREE.PointsMaterial({ size: 1.7, vertexColors: true, map: dotTex(), transparent: true, depthWrite: false, fog: false });
    var pts = new THREE.Points(g, m);
    gGalaxy.add(pts);
  }
  function buildNebulas(rng) {
    var cols = [0x6644aa, 0x4466cc, 0xaa4466, 0x44aa88, 0xaa6644, 0x8844aa];
    for (var i = 0; i < 14; i++) {
      var a = rng.range(0, TAU), r = rng.range(150, 1000);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTexLocal(rng.pick(cols)), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(rng.range(380, 720));
      sp.position.set(Math.cos(a) * r, rng.range(-40, 40), Math.sin(a) * r);
      gGalaxy.add(sp);
    }
  }
  function buildBlackHole() {
    var bh = new THREE.Mesh(new THREE.SphereGeometry(20, 24, 18), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    gGalaxy.add(bh);
    var ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), color: 0xff8844, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.scale.setScalar(64);
    gGalaxy.add(ring);
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff6633, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(150);
    glow.position.copy(CENTER.pos);
    gGalaxy.add(glow);
    // 中心可点击（纳入拾取）
    var pick = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff8844, transparent: true, opacity: 0.0001, depthWrite: false }));
    pick.scale.setScalar(120);
    pick.position.copy(CENTER.pos);
    pick.userData.sys = CENTER;
    gGalaxy.add(pick);
    sysSprites.push(pick);
    sysById[CENTER.id] = CENTER;
  }
  function generateGalaxy() {
    var rng = Rng(20240501);
    var R = 1150;
    SYSTEMS = []; sysSprites = []; sysById = {}; groxSystems = [];
    buildBackgroundStars(rng);
    buildNebulas(rng);
    // 银河核心（黑洞）
    CENTER = makeSystem(rng, 0, 0, 0, '银河核心');
    CENTER.isCenter = true; CENTER.planets = [];
    CENTER.id = 'center';
    CENTER.pos.set(0, 0, 0);
    buildBlackHole();
    SYSTEMS.push(CENTER);
    // Grox 环带（中心外一圈）
    var gn = 12;
    for (var i = 0; i < gn; i++) {
      var ga = (i / gn) * TAU + rng.range(-0.16, 0.16);
      var gr = R * rng.range(0.5, 0.68);
      var s = makeSystem(rng, Math.cos(ga) * gr, rng.range(-8, 8), Math.sin(ga) * gr, '格罗克斯 ' + (i + 1) + ' 哨站');
      s.isGrox = true;
      SYSTEMS.push(s); groxSystems.push(s);
    }
    // 螺旋臂星系
    var arms = 4, count = 104;
    for (var i = 0; i < count; i++) {
      var t = i / count;
      var r = R * (0.6 + 0.4 * Math.pow(t, 0.7));
      var arm = rng.int(0, arms - 1);
      var a = (arm / arms) * TAU + t * 5.2 + rng.range(-0.5, 0.5);
      var s = makeSystem(rng, Math.cos(a) * r, rng.range(-12, 12), Math.sin(a) * r, genName(rng));
      SYSTEMS.push(s);
    }
    // 编号
    for (var i = 0; i < SYSTEMS.length; i++) if (!SYSTEMS[i].id) SYSTEMS[i].id = 'sys' + i;
  }

  /* ================= 5. 帝国生成 ================= */
  function genEmpires() {
    var rng = Rng(777);
    EMPIRES = []; empById = {};
    var n = rng.int(8, 11);
    var names = shuf(ENAME.slice(), rng);
    for (var i = 0; i < n; i++) {
      var e = {
        id: 'emp' + i, name: names[i] + rng.pick(ESUF),
        color: EMP_COLORS[i % EMP_COLORS.length],
        personality: rng.pick(PERS),
        relation: rng.int(-20, 30), allied: false, atWar: false,
        home: null, sysCount: 0
      };
      EMPIRES.push(e); empById[e.id] = e;
    }
    var cands = SYSTEMS.filter(function (s) { return !s.isGrox && !s.isCenter; });
    shuf(cands, rng);
    EMPIRES.forEach(function (e, i) {
      var home = cands[i % cands.length];
      e.home = home; home.owner = e; home.isHome = true;
    });
    // 其余星系按最近领地划分，45% 保持无主
    cands.forEach(function (s) {
      if (s.owner) return;
      if (rng.chance(0.45)) return;
      var best = null, bd = 1e9;
      EMPIRES.forEach(function (e) {
        var d = s.pos.distanceTo(e.home.pos);
        if (d < bd) { bd = d; best = e; }
      });
      if (bd < 340) s.owner = best;
    });
    EMPIRES.forEach(function (e) { e.sysCount = SYSTEMS.filter(function (s) { return s.owner === e; }).length; });
    // 格罗克斯
    GROX = { id: 'grox', name: '格罗克斯', color: 0xdd2222, personality: '好战', relation: -100, allied: false, atWar: true, home: null, sysCount: groxSystems.length };
    empById.grox = GROX;
    groxSystems.forEach(function (s) { s.owner = GROX; });
  }

  /* ================= 6. 飞船模型 ================= */
  function buildShip() {
    shipMesh = new THREE.Group();
    var hm = new THREE.MeshStandardMaterial({ map: SP.Tex.hull(1, 1), roughness: 0.5, metalness: 0.35 });
    var dm = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.6, metalness: 0.2 });
    hullMats = [hm, dm];
    var body = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 1.5, 24), hm);
    body.scale.z = 1.9;
    var deck = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 0.7, 16), dm);
    deck.position.y = 1.1;
    var cock = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.15, metalness: 0.1 }));
    cock.position.y = 1.8; cock.scale.z = 1.6;
    var nose = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4.4, 4), hm);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 5.6;
    var engMat = new THREE.MeshStandardMaterial({ color: 0x222a33, emissive: 0x66ddff, emissiveIntensity: 1.4 });
    engMats = [engMat];
    var e1 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.8, 12), engMat); e1.position.set(-2.6, 0.4, -5.4);
    var e2 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.8, 12), engMat); e2.position.set(2.6, 0.4, -5.4);
    var engGlow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0x88eeff }));
    engGlow.position.set(0, 0.4, -6.6);
    var sh = new THREE.Mesh(new THREE.SphereGeometry(8.6, 24, 18), new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.15, depthWrite: false }));
    shieldMat = sh.material;
    var wl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 2.6), dm); wl.position.set(-3.6, 0.2, 3.2);
    var wr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 2.6), dm); wr.position.set(3.6, 0.2, 3.2);
    shipMesh.add(body, deck, cock, nose, e1, e2, engGlow, sh, wl, wr);
    var light = new THREE.PointLight(0x88eeff, 1.2, 60);
    light.position.set(0, 0.4, -7);
    shipMesh.add(light);
    shipMesh.visible = false;
    game.scene.add(shipMesh);
    shipMarker = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x66ccff, transparent: true, opacity: 1, depthWrite: false }));
    shipMarker.scale.setScalar(16);
    gGalaxy.add(shipMarker);
  }
  function applyDesign(d) {
    if (!d) return;
    try {
      if (d.color != null) {
        var col = new THREE.Color(d.color);
        hullMats.forEach(function (m) { m.color.copy(col); });
      }
      if (d.size) shipMesh.scale.setScalar(clamp(d.size, 0.6, 1.8));
      toast('飞船改装完成', 'good');
      snd('confirm');
    } catch (e) { toast('改装数据无法应用', 'warn'); }
  }

  /* ================= 7. 银河视图 ================= */
  function progressToCenter() {
    var p = S.curSystem ? S.curSystem.pos : S.startPos;
    return clamp(p.length() / 1150, 0, 1);
  }
  function setObjectiveGalaxy() {
    var prog = progressToCenter();
    game.ui.setObjective('抵达银河中心（黑洞）— 距中心 ' + Math.round(prog * 100) + '%' + (S.groxBreached ? '（格罗克斯防线已突破）' : '（需突破格罗克斯封锁）'));
    game.ui.setProgress(1 - prog, '距银河核心');
  }
  function setObjectivePlanet() {
    var p = S.curPlanet, s = S.curSystem;
    if (!p || !s) return;
    game.ui.setObjective(s.name + ' · ' + p.name + ' — 宜居度 ' + tScore(p) + '/3' +
      (S.groxFight ? ' · 击退格罗克斯舰队 ' + S.groxKills + '/' + S.groxNeed : ''));
  }
  function enterGalaxyView() {
    clearGroup(gPlanet); gPlanet = null;
    S.view = 'galaxy'; S.tool = 'scan';
    S.raids.length = 0; S.shots.length = 0;
    gGalaxy.visible = true;
    if (shipMesh) shipMesh.visible = false;
    game.camera.position.set(0, 1050, 750);
    game.camera.up.set(0, 1, 0);
    game.camera.lookAt(0, 0, 0);
    game.scene.fog = new THREE.FogExp2(0x05060c, 0.00028);
    game.scene.background = new THREE.Color(0x05060c);
    rebuildColonyMarkers();
    game.ui.setActions(galaxyActions());
    setObjectiveGalaxy();
    toast('银河视图 — 点击星系跃迁', '');
  }
  function rebuildColonyMarkers() {
    SYSTEMS.forEach(function (s) {
      s.planets.forEach(function (p) {
        if (p.colony && !s.colMarker) {
          var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x66ff88, transparent: true, opacity: 0.9, depthWrite: false }));
          sp.scale.setScalar(12);
          sp.position.copy(s.pos).add(new THREE.Vector3(0, 16, 0));
          gGalaxy.add(sp);
          s.colMarker = sp;
        }
      });
    });
  }
  function buildWarpPath(from, to) {
    var mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y += 160 + rand(0, 140);
    var pts = [];
    for (var i = 0; i <= 36; i++) {
      var t = i / 36, it = 1 - t;
      pts.push(new THREE.Vector3(
        it * it * from.x + 2 * it * t * mid.x + t * t * to.x,
        it * it * from.y + 2 * it * t * mid.y + t * t * to.y,
        it * it * from.z + 2 * it * t * mid.z + t * t * to.z));
    }
    return pts;
  }
  function addWarpDots(pts, color) {
    S.warpDots = [];
    for (var j = 2; j < pts.length - 2; j += 3) {
      var dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: color, transparent: true, opacity: 0.9, depthWrite: false }));
      dot.scale.setScalar(10);
      dot.position.copy(pts[j]);
      gGalaxy.add(dot);
      S.warpDots.push(dot);
    }
  }
  function clearWarpDots() {
    S.warpDots.forEach(function (d) { gGalaxy.remove(d); disposeObj(d); });
    S.warpDots = [];
  }
  function startWarp(target) {
    if (S.warp || S.dialogOpen || S.winDialog) return;
    if (target.isCenter) { centerWarp(); return; }
    var from = S.curSystem ? S.curSystem.pos : S.startPos;
    var dist = from.distanceTo(target.pos);
    var cost = Math.ceil(8 + dist * 0.02);
    if (S.energy < cost) { toast('引擎能量不足（需 ' + cost + '），请到殖民地或友邦补给', 'bad'); snd('deny'); return; }
    S.energy -= cost;
    S.warp = { from: from, to: target.pos, pts: buildWarpPath(from, target.pos), t: 0, dur: Math.max(1.1, dist / 800), target: target, center: false };
    addWarpDots(S.warp.pts, 0xaaccff);
    flash();
    snd('warp');
    toast('跃迁至 ' + target.name);
  }
  function centerWarp() {
    if (S.energy < 80) { toast('核心跃迁需要至少 80 能量', 'bad'); snd('deny'); return; }
    if (!S.groxBreached) {
      toast('格罗克斯舰队封锁了核心！必须突破防线！', 'warn');
      snd('roar');
      S.groxFight = true; S.groxKills = 0;
      var gs = groxSystems[randi(0, groxSystems.length - 1)];
      enterPlanetView(gs, gs.planets[0]);
      return;
    }
    S.energy -= 80;
    var from = S.curSystem ? S.curSystem.pos : S.startPos;
    S.warp = { from: from, to: CENTER.pos, pts: buildWarpPath(from, CENTER.pos), t: 0, dur: 2.4, target: CENTER, center: true };
    addWarpDots(S.warp.pts, 0xffaa66);
    flash();
    snd('warp');
    toast('向银河核心跃迁…');
  }
  function updateWarp(dt) {
    var w = S.warp;
    w.t += dt / w.dur;
    var t = Math.min(1, w.t);
    var i = t * (w.pts.length - 1), i0 = Math.floor(i), f = i - i0;
    var p = w.pts[i0].clone().lerp(w.pts[Math.min(i0 + 1, w.pts.length - 1)], f);
    shipMarker.position.copy(p);
    if (Math.random() < 0.6) burstAt(p, 0x88ccff, 1, 10, 2.4, 0.35);
    if (w.t >= 1) finishWarp();
  }
  function finishWarp() {
    var w = S.warp, t = w.target;
    S.warp = null;
    clearWarpDots();
    S.curSystem = t;
    if (!t.visited) { t.visited = true; S.visitedCount++; }
    if (t.isCenter) { winGame(); return; }
    if (t.isGrox) toast('警告：你已进入格罗克斯领地！', 'warn');
    else if (t.owner && (t.owner.atWar || t.owner.relation <= -40)) toast('警告：' + t.owner.name + ' 的敌意舰队在此巡逻！', 'warn');
    snd('confirm');
    setObjectiveGalaxy();
  }
  function winGame() {
    S.winT = 1.6;
    toast('你抵达了银河核心', 'good');
    snd('stage_up');
  }
  function updateHover() {
    var m = game.input.mouse;
    _v2.set(m.x, m.y);
    rc.setFromCamera(_v2, game.camera);
    gGalaxy.updateMatrixWorld(true);
    var hits = rc.intersectObjects(sysSprites, false);
    var hov = hits.length ? hits[0].object.userData.sys : null;
    if (hov !== S.hoverSys) {
      if (S.hoverSys && S.hoverSys.label) S.hoverSys.label.material.opacity = 0;
      S.hoverSys = hov;
      if (hov && hov.label) hov.label.material.opacity = 1;
    }
    if (hlRing) {
      hlRing.visible = !!hov;
      if (hov) hlRing.position.copy(hov.pos);
    }
    if (galaxyHlRing) {
      galaxyHlRing.visible = !!hov;
      if (hov) galaxyHlRing.position.copy(hov.pos);
    }
    if (m.down0 && !S.prevDown0 && hov) startWarp(hov);
  }
  function updateGalaxy(dt) {
    gGalaxy.rotation.y += dt * 0.0035;
    if (S.warp) updateWarp(dt);
    else shipMarker.position.copy(S.curSystem ? S.curSystem.pos : S.startPos);
    // 友方星系能量缓慢恢复
    if (S.curSystem && S.curSystem.owner) {
      var e = S.curSystem.owner;
      if (e === PLAYER || e.allied) S.energy = Math.min(100, S.energy + dt * 2);
    }
    updateHover();
  }

  /* ================= 8. 行星视图 ================= */
  function placeOnSphere(mesh, dir, r) {
    var d = dir.clone().normalize();
    mesh.position.copy(d.clone().multiplyScalar(r));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  }
  function buildCreatureMesh(cr) {
    var g = null;
    try { g = SP.Genome.build(SP.Genome.random('creature'), {}); }
    catch (e) {
      g = new THREE.Group();
      var m = new THREE.MeshStandardMaterial({ color: 0x88cc66 });
      var body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), m);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), m);
      head.position.y = 1; body.add(head);
      g.add(body);
    }
    g.scale.setScalar(cr.size);
    return g;
  }
  function buildPlant() {
    var g = new THREE.Group();
    var h = rand(0, 0.35), s = rand(0.5, 0.75);
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.3, 6), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(h, s, 0.3) }));
    stem.position.y = 0.65;
    var leaf = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 6), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(h, s, 0.5) }));
    leaf.position.y = 1.55;
    g.add(stem, leaf);
    return g;
  }
  function buildColonyMesh() {
    var g = new THREE.Group();
    var colMat = new THREE.MeshStandardMaterial({ color: 0x8899bb, roughness: 0.7, metalness: 0.3 });
    var base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 1.4, 8), colMat);
    base.position.y = 0.7;
    var dome = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 10), new THREE.MeshStandardMaterial({ color: 0x66ccff, transparent: true, opacity: 0.6, roughness: 0.2 }));
    dome.position.y = 2.2;
    var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), colMat);
    ant.position.y = 3.4;
    var bl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0x66ff88 }));
    bl.position.y = 4.6;
    g.add(base, dome, ant, bl);
    return g;
  }
  function buildMonolithMesh() {
    var g = new THREE.Group();
    var slab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.4, 1.6), new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.3, metalness: 0.6 }));
    slab.position.y = 2.2;
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x8844ff, transparent: true, opacity: 0.85, depthWrite: false }));
    glow.scale.setScalar(3.2);
    glow.position.y = 5.2;
    g.add(slab, glow);
    return g;
  }
  function buildEnemyMesh(empire) {
    var g = new THREE.Group();
    var m = new THREE.MeshStandardMaterial({ color: new THREE.Color(empire.color), roughness: 0.6, metalness: 0.2 });
    var body = new THREE.Mesh(new THREE.ConeGeometry(1.3, 4.2, 4), m);
    body.rotation.x = Math.PI / 2;
    var wing = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.14, 1.6), m);
    var eng = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: empire === GROX ? 0xff2222 : 0xffaa44 }));
    eng.position.z = -2.2;
    g.add(body, wing, eng);
    return g;
  }
  function resetEmissive(mesh) {
    mesh.traverse(function (o) { if (o.material && o.material.emissive) o.material.emissive.set(0x000000); });
  }
  function enterPlanetView(sys, planet) {
    if (!planet) return;
    clearGroup(gPlanet);
    S.view = 'planet'; S.tool = 'scan';
    S.curSystem = sys; S.curPlanet = planet;
    S.raids.length = 0; S.shots.length = 0;
    S.lat = 0; S.lng = 0; S.laserCd = 0; S.collectT = 0;
    gGalaxy.visible = false;
    shipMesh.visible = true;
    game.scene.fog = null;
    game.scene.background = new THREE.Color(0x010208);
    gPlanet = new THREE.Group();
    game.scene.add(gPlanet);
    // 星空背景
    var sfPos = [], sfCol = [];
    for (var i = 0; i < 1200; i++) {
      var d = rand(2200, 3200), th = rand(0, TAU), ph = Math.acos(rand(-1, 1));
      sfPos.push(d * Math.sin(ph) * Math.cos(th), d * Math.cos(ph), d * Math.sin(ph) * Math.sin(th));
      var b = rand(0.35, 1);
      sfCol.push(b * 0.8, b, b);
    }
    var sfGeo = new THREE.BufferGeometry();
    sfGeo.setAttribute('position', new THREE.Float32BufferAttribute(sfPos, 3));
    sfGeo.setAttribute('color', new THREE.Float32BufferAttribute(sfCol, 3));
    gPlanet.add(new THREE.Points(sfGeo, new THREE.PointsMaterial({ size: 3, vertexColors: true, map: dotTex(), transparent: true, depthWrite: false, fog: false })));
    // 光照
    gPlanet.add(new THREE.AmbientLight(0x556688, 0.85));
    var sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
    sun.position.set(50, 80, 30);
    gPlanet.add(sun);
    // 行星本体
    var R = 40 * (0.75 + planet.size * 0.25);
    planet.radius = R;
    var pMat = new THREE.MeshStandardMaterial({ map: SP.Tex.planet(planet.kind), roughness: 0.92, metalness: 0.05 });
    planet.pMat = pMat;
    var pMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), pMat);
    pMesh.rotation.z = planet.tilt || 0;
    gPlanet.add(pMesh);
    planet.mesh = pMesh;
    // 大气与云层
    var atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0x88bbff, transparent: true, opacity: 0.22, side: THREE.BackSide, depthWrite: false }));
    gPlanet.add(atm);
    var cloudMat = new THREE.MeshStandardMaterial({ map: SP.Tex.cloud(), transparent: true, opacity: 0.22 + planet.stats.atm * 0.16, depthWrite: false });
    planet.cloudMat = cloudMat;
    var clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 32, 24), cloudMat);
    gPlanet.add(clouds);
    // 地表生命
    planet.creatures = [];
    if (planet.stats.life > 0) {
      var cn = planet.stats.life + randi(1, 3);
      for (var i = 0; i < cn; i++) {
        var cr = { name: planet.crNames[i] || '未知生物', size: rand(0.7, 1.6) };
        var mesh = buildCreatureMesh(cr);
        var dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
        placeOnSphere(mesh, dir, R + 0.6);
        pMesh.add(mesh);
        cr.mesh = mesh;
        planet.creatures.push(cr);
      }
    }
    // 植物
    var pn = randi(4, 8);
    for (var i = 0; i < pn; i++) {
      var pl = buildPlant();
      var pd = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      placeOnSphere(pl, pd, R + 0.4);
      pl.rotation.y = rand(0, TAU);
      pMesh.add(pl);
    }
    // 殖民地
    if (planet.colony) {
      if (!planet.colony.dir) planet.colony.dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      var cm = buildColonyMesh();
      placeOnSphere(cm, planet.colony.dir, R + 0.9);
      pMesh.add(cm);
      planet.colony.mesh = cm;
    }
    // 巨石
    if (planet.monolith) {
      var mm = buildMonolithMesh();
      if (!planet.monDir) planet.monDir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      placeOnSphere(mm, planet.monDir, R + 0.8);
      pMesh.add(mm);
      planet.monMesh = mm;
    }
    // 扫描环
    S.scanRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), color: 0x66ddff, transparent: true, opacity: 0, depthWrite: false }));
    gPlanet.add(S.scanRing);
    // 瞄准环
    hlRing = new THREE.Mesh(new THREE.RingGeometry(R * 0.055, R * 0.085, 24), new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    hlRing.visible = false;
    gPlanet.add(hlRing);
    // 敌方巡逻队
    spawnDefenders(sys, planet);
    game.ui.setActions(planetActions());
    setObjectivePlanet();
    toast('进入 ' + sys.name + ' · ' + planet.name + '（' + PK_CN[planet.kind] + ' 宜居度 ' + tScore(planet) + '/3）', '');
  }
  function spawnDefenders(sys, planet) {
    var owner = sys.owner, n = 0;
    if (S.groxFight) { owner = GROX; n = 3; }
    else if (owner && owner !== PLAYER && (owner.atWar || owner.relation <= -40)) n = 1 + randi(0, 1);
    for (var i = 0; i < n; i++) spawnOneEnemy(owner, planet);
    if (n) toast('遭遇 ' + n + ' 艘敌方飞船！', 'warn');
  }
  function spawnOneEnemy(empire, planet) {
    if (!planet) return;
    var e = buildEnemyMesh(empire);
    var th = rand(0, TAU), ph = rand(-1.2, 1.2);
    e.position.set(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)).multiplyScalar(planet.radius * 1.7);
    gPlanet.add(e);
    S.raids.push({ mesh: e, empire: empire, hp: empire === GROX ? 60 : 40, ang: rand(0, TAU), alt: rand(0.3, 1) * planet.radius, speed: rand(0.12, 0.35), cd: rand(1, 2.5), tilt: rand(0, TAU), flash: 0 });
  }
  function shipUp() {
    var c = Math.cos(S.lat);
    return new THREE.Vector3(c * Math.cos(S.lng), Math.sin(S.lat), c * Math.sin(S.lng));
  }
  function aimPoint() {
    var m = game.input.mouse;
    _v2.set(m.x, m.y);
    rc.setFromCamera(_v2, game.camera);
    var up = shipUp();
    _plane.setFromNormalAndCoplanarPoint(up, shipMesh.position);
    var out = new THREE.Vector3();
    if (rc.ray.intersectPlane(_plane, out)) return out;
    return shipMesh.position.clone().add(_v3.copy(rc.ray.direction).multiplyScalar(60));
  }
  function distToSegment(p, a, b) {
    var ab = _v3.copy(b).sub(a);
    var t = clamp(_v3.copy(p).sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1);
    return _v3.copy(a).add(_v3.copy(ab).multiplyScalar(t)).distanceTo(p);
  }
  function updatePlanet(dt) {
    var planet = S.curPlanet, sys = S.curSystem;
    if (!planet || !planet.mesh) { enterGalaxyView(); return; }
    var R = planet.radius;
    // 飞行控制
    var spd = 0.75;
    if (held('W', 'ArrowUp')) S.lat += spd * dt;
    if (held('S', 'ArrowDown')) S.lat -= spd * dt;
    if (held('A', 'ArrowLeft')) S.lng -= spd * dt;
    if (held('D', 'ArrowRight')) S.lng += spd * dt;
    S.lat = clamp(S.lat, -1.25, 1.25);
    var up = shipUp();
    var pos = up.clone().multiplyScalar(R * 1.7 + 16);
    shipMesh.position.copy(pos);
    // 行星自转与云层
    planet.mesh.rotation.y += dt * planet.spin;
    var aim = aimPoint();
    if (hlRing) {
      hlRing.visible = S.tool === 'weapon' || S.tool === 'tractor' || S.tool === 'colonize' || S.tool === 'monolith';
      if (hlRing.visible) {
        hlRing.position.copy(aim.clone().normalize().multiplyScalar(R + 1.2));
        hlRing.lookAt(aim.clone().normalize().multiplyScalar(2 * R));
      }
    }
    // 工具
    if (S.tool === 'weapon') {
      if (game.input.mouse.down0) fireLaser(dt, aim);
      if (spacePressed()) fireMissile();
    } else if (S.tool === 'tractor' && game.input.mouse.down0) tractorAt(dt);
    else if (S.tool === 'terraform' && mouseClicked()) terraDialog();
    else if (S.tool === 'colonize' && mouseClicked()) colonize(aim);
    else if (S.tool === 'monolith' && mouseClicked()) monolith(aim);
    else if (S.tool === 'scan' && S.scanT <= 0 && mouseClicked()) startScan();
    // 飞船朝向瞄准点
    var fwd = aim.clone().sub(pos);
    if (fwd.lengthSq() > 1) shipMesh.lookAt(pos.clone().add(fwd.normalize()));
    // 扫描动画
    if (S.scanT > 0) {
      S.scanT -= dt;
      var k = 1 - S.scanT / 0.9;
      S.scanRing.scale.setScalar(R * (0.2 + k * 2.6));
      S.scanRing.material.opacity = 0.8 * (1 - k);
      if (S.scanT <= 0) finishScan();
    }
    // 战斗与杂项
    updateEnemies(dt, planet);
    updateMissiles(dt);
    collectNearColony(dt, planet, pos);
    if (S.shieldFlash <= 0) S.shield = Math.min(100, S.shield + dt * 1.2);
    if (S.groxFight) {
      setObjectivePlanet();
      if (S.groxKills >= S.groxNeed) {
        S.groxBreached = true; S.groxFight = false;
        toast('格罗克斯防线被突破！现在可以跃迁至银河核心！', 'good');
        snd('mission_ok');
      }
    }
    // 相机跟随
    var east = new THREE.Vector3(-Math.sin(S.lng), 0, Math.cos(S.lng));
    var cam = pos.clone().add(up.clone().multiplyScalar(16)).add(east.clone().multiplyScalar(24));
    game.camera.position.copy(cam);
    game.camera.up.copy(up);
    game.camera.lookAt(pos);
  }
  function collectNearColony(dt, planet, shipPos) {
    var col = planet.colony;
    if (!col || !col.mesh || col.stock <= 0) return;
    S.collectT -= dt;
    if (S.collectT > 0) return;
    var d = col.mesh.getWorldPosition(_v3).distanceTo(shipPos);
    if (d < 40) {
      var take = Math.min(col.stock, S.cargoCap - cargoUsed());
      if (take > 0 && planet.spice) {
        col.stock -= take;
        S.cargo.spice[planet.spice] = (S.cargo.spice[planet.spice] || 0) + take;
        toast('收集香料 +' + take, 'good');
        snd('spice');
        S.collectT = 2;
      }
    }
  }

  /* ================= 9. 工具系统 ================= */
  function startScan() {
    if (S.scanT > 0) return;
    S.scanT = 0.9;
    S.scanRing.position.set(0, 0, 0);
    S.scanRing.scale.setScalar(1);
    S.scanRing.material.opacity = 0.8;
    snd('scan');
  }
  function finishScan() {
    var p = S.curPlanet;
    p.scanned = true;
    var body = p.name + '（' + PK_CN[p.kind] + '）\n' +
      '大气 ' + p.stats.atm + '/2 · 温度 ' + p.stats.temp + '/2\n' +
      '海洋 ' + p.stats.water + '/2 · 生命 ' + p.stats.life + '/2\n' +
      '宜居度 ' + tScore(p) + '/3\n' +
      (p.spice ? '香料：' + spiceName(p.spice) + '\n' : '香料：无\n') +
      '生物：' + (p.crNames.length ? p.crNames.join('、') : '无');
    dialog('扫描完成', body, [btn('关闭')]);
  }
  function tractorAt(dt) {
    var planet = S.curPlanet;
    var best = null, bd = 1e9;
    planet.creatures.forEach(function (c) {
      var wp = c.mesh.getWorldPosition(_v3);
      var d = wp.distanceTo(shipMesh.position);
      if (d < 80 && d < bd) { bd = d; best = c; }
    });
    if (!best) return;
    if (!best.lift) {
      best.lift = 0;
      beamFx(best.mesh.getWorldPosition(new THREE.Vector3()), shipMesh.position, 0x88ffaa, 0.1);
      snd('dna');
    }
    best.lift += dt * 1.3;
    var t = Math.min(1, best.lift);
    var target = planet.mesh.worldToLocal(shipMesh.position.clone());
    best.mesh.position.lerpVectors(best.homeLocal || best.mesh.position, target, U.smooth(t));
    best.homeLocal = best.homeLocal || best.mesh.position.clone();
    if (t >= 1) {
      if (S.creatures.length >= 8) { toast('生物货舱已满', 'warn'); delete best.lift; return; }
      planet.creatures.splice(planet.creatures.indexOf(best), 1);
      planet.mesh.remove(best.mesh);
      disposeObj(best.mesh);
      S.creatures.push({ name: best.name, size: best.size, genome: null, from: planet.name });
      toast('已绑架 ' + best.name + '（货舱生物 +1）', 'good');
      snd('shock');
    }
  }
  function terraDialog() {
    var p = S.curPlanet;
    dialog('地球化改造', p.name + '\n宜居度 ' + tScore(p) + '/3\n大气 ' + p.stats.atm + '/2 · 温度 ' + p.stats.temp + '/2 · 海洋 ' + p.stats.water + '/2 · 生命 ' + p.stats.life + '/2',
      [btn('大气增强器 600', function () { applyTerra('atm', 600); }),
        btn('降温器 600', function () { applyTerra('temp', 600); }),
        btn('海洋制造机 900', function () { applyTerra('water', 900); }),
        btn('种植植物 400', function () { applyTerra('life', 400); }),
        btn('放置动物（货舱 ' + S.creatures.length + '）', function () { releaseDialog(); }),
        btn('关闭')]);
  }
  function applyTerra(key, cost) {
    var p = S.curPlanet;
    if (p.stats[key] >= 2) { toast('该指标已达上限', 'warn'); return; }
    if (key === 'life' && p.stats.life === 0 && p.stats.water < 1) { toast('需要海洋才能维持生命', 'warn'); snd('deny'); return; }
    if (!spend(cost)) return;
    p.stats[key]++;
    if (key === 'atm' && p.cloudMat) p.cloudMat.opacity = 0.22 + p.stats.atm * 0.16;
    if (key === 'life' && p.pMat) p.pMat.color.lerp(new THREE.Color(0x66cc88), 0.5);
    if (key === 'water' && p.pMat) p.pMat.color.lerp(new THREE.Color(0x88aaff), 0.35);
    burst(shipMesh.position, 0x88ffaa, 18, 16, 3);
    snd('terraform');
    toast('改造完成，宜居度 ' + tScore(p) + '/3', 'good');
    setObjectivePlanet();
    checkBadges(true);
  }
  function releaseDialog() {
    if (!S.creatures.length) { toast('货舱里没有生物', 'warn'); return; }
    var btns = S.creatures.map(function (c, i) {
      return btn('释放 ' + c.name, function () {
        var p = S.curPlanet;
        var cr = S.creatures.splice(i, 1)[0];
        var mesh = buildCreatureMesh(cr);
        var dir = aimPoint().normalize();
        placeOnSphere(mesh, dir, p.radius + 0.6);
        p.mesh.add(mesh);
        p.stats.life = Math.max(1, p.stats.life);
        p.crNames.push(cr.name);
        toast(cr.name + ' 已在 ' + p.name + ' 安家', 'good');
        snd('place');
      });
    });
    btns.push(btn('关闭'));
    dialog('放置动物', '选择要释放到本行星的生物：', btns);
  }
  function colonize(aim) {
    var planet = S.curPlanet, sys = S.curSystem;
    if (planet.colony) { toast('该行星已有殖民地', 'warn'); return; }
    if (tScore(planet) < 1) { toast('宜居度需 ≥1 才能殖民（请先地球化）', 'bad'); snd('deny'); return; }
    if (sys.owner && sys.owner !== PLAYER && sys.owner.relation < 40 && sys.owner !== GROX) { toast('该星系属于 ' + sys.owner.name + '，关系不足 40 无法殖民', 'bad'); snd('deny'); return; }
    if (!spend(2000)) return;
    planet.colony = { stock: 0, hp: 100, prod: 1, dir: aim.clone().normalize(), mesh: null };
    var cm = buildColonyMesh();
    placeOnSphere(cm, planet.colony.dir, planet.radius + 0.9);
    planet.mesh.add(cm);
    planet.colony.mesh = cm;
    sys.owner = PLAYER;
    S.colCount++;
    toast('殖民地建立成功！会持续产出香料，可补给能量与修理', 'good');
    snd('colonize');
    rebuildColonyMarkers();
    checkBadges(true);
  }
  function monolith(aim) {
    var p = S.curPlanet;
    if (p.monolith) { toast('该行星已有巨石', 'warn'); return; }
    if (!p.creatures.length && p.stats.life < 1) { toast('没有原始生命可以引导', 'bad'); snd('deny'); return; }
    if (p.civ >= 3) { toast('该文明已进入太空时代', 'warn'); return; }
    if (!spend(1500)) return;
    p.monolith = true; p.civ = 0; p.civT = 40;
    p.monDir = aim.clone().normalize();
    var mm = buildMonolithMesh();
    placeOnSphere(mm, p.monDir, p.radius + 0.8);
    p.mesh.add(mm);
    p.monMesh = mm;
    toast('巨石已投放，文明开始加速进化', 'good');
    snd('terraform');
    EMPIRES.forEach(function (e) { if (e.personality === '宗教') e.relation = clamp(e.relation + 5, -100, 100); });
  }
  function repairDialog() {
    var costH = Math.ceil((100 - S.hull) * 6), costS = Math.ceil((100 - S.shield) * 3);
    var total = costH + costS;
    dialog('修理与补给', '船体 ' + S.hull + '/100（修理费 ' + costH + '）\n护盾 ' + S.shield + '/100（充能费 ' + costS + '）\n引擎能量 ' + S.energy + '/100',
      [btn('完全修复 ' + total + ' 星币', function () {
        if (spend(total)) { S.hull = 100; S.shield = 100; toast('飞船已完全修复', 'good'); snd('confirm'); }
      }),
        btn('补充能量 200', function () {
          if (spend(200)) { S.energy = 100; toast('引擎能量已充满', 'good'); snd('confirm'); }
        }),
        btn('使用维修套件', function () {
          if (S.cargo.goods.repair < 1) { toast('货舱中没有维修套件', 'warn'); return; }
          S.cargo.goods.repair--; S.hull = Math.min(100, S.hull + 40);
          toast('船体修复 +40', 'good'); snd('confirm');
        }),
        btn('使用燃料电池', function () {
          if (S.cargo.goods.fuel < 1) { toast('货舱中没有燃料电池', 'warn'); return; }
          S.cargo.goods.fuel--; S.energy = Math.min(100, S.energy + 30);
          toast('能量 +30', 'good'); snd('confirm');
        }),
        btn('关闭')]);
  }
  function cargoUsed() {
    var n = 0, a;
    for (a in S.cargo.spice) n += S.cargo.spice[a];
    for (a in S.cargo.goods) n += S.cargo.goods[a];
    return n;
  }
  function cargoSummary() {
    var a = [], b;
    for (b in S.cargo.spice) if (S.cargo.spice[b]) a.push(spiceName(b) + '×' + S.cargo.spice[b]);
    for (b in S.cargo.goods) if (S.cargo.goods[b]) a.push(goodsName(b) + '×' + S.cargo.goods[b]);
    return a.length ? a.join(' ') : '空';
  }
  function spiceInfo(key) { for (var i = 0; i < SPICE.length; i++) if (SPICE[i].key === key) return SPICE[i]; return SPICE[0]; }
  function spiceName(key) { return spiceInfo(key).name; }
  function goodsName(key) { for (var i = 0; i < GOODS.length; i++) if (GOODS[i].key === key) return GOODS[i].name; return key; }
  function marketFactor(e) {
    if (!e || e === PLAYER) return 0.7;
    if (e.personality === '贸易') return 0.8;
    if (e.personality === '好战') return 1.25;
    if (e.personality === '宗教') return 1.05;
    return 1.0;
  }
  function tradeDialog() { marketMenu(S.curSystem && S.curSystem.owner); }
  function marketMenu(e) {
    var who = (e && e !== PLAYER) ? e.name + '（买入系数 ×' + marketFactor(e).toFixed(2) + '）' : '你的殖民地市场';
    dialog('香料市场', who + '\n持有：' + cargoSummary() + '\n仓位：' + cargoUsed() + '/' + S.cargoCap,
      [btn('买入香料…', function () { marketDialog(e, 'buySpice'); }),
        btn('卖出香料…', function () { marketDialog(e, 'sellSpice'); }),
        btn('买入货物…', function () { marketDialog(e, 'buyGoods'); }),
        btn('卖出货物…', function () { marketDialog(e, 'sellGoods'); }),
        btn('关闭')]);
  }
  function marketDialog(e, mode) {
    var f = marketFactor(e);
    var isSpice = mode.indexOf('Spice') >= 0;
    var isBuy = mode.indexOf('buy') === 0;
    var qty = isSpice ? 5 : 1;
    var items = isSpice ? SPICE : GOODS;
    var body = (isBuy ? '买入价' : '卖出价') + '（每次 ' + qty + ' 单位）\n';
    var btns = items.map(function (it) {
      var price = Math.round(it.price * (isBuy ? 1.1 : 0.9) * f) * qty;
      body += it.name + ' ' + price + ' 星币\n';
      return btn((isBuy ? '买 ' : '卖 ') + it.name + (qty > 1 ? ' ×' + qty : '') + '（' + price + '）', function () {
        var dict = isSpice ? S.cargo.spice : S.cargo.goods;
        if (isBuy) {
          if (cargoUsed() + qty > S.cargoCap) { toast('货舱已满', 'bad'); snd('deny'); return; }
          if (!spend(price)) return;
          dict[it.key] = (dict[it.key] || 0) + qty;
          toast('购入 ' + it.name + (qty > 1 ? ' ×' + qty : ''), 'good');
        } else {
          if ((dict[it.key] || 0) < qty) { toast(it.name + ' 不足 ' + qty, 'warn'); return; }
          dict[it.key] -= qty;
          addMoney(price);
          toast('售出 ' + it.name + (qty > 1 ? ' ×' + qty : '') + '，+' + price, 'good');
        }
        S.tradeTotal += price;
        snd('spice');
        checkBadges(true);
      });
    });
    btns.push(btn('返回', function () { marketMenu(e); }));
    dialog((isBuy ? '买入' : '卖出') + (isSpice ? '香料' : '货物'), body, btns);
  }
  function supplyDialog() {
    var s = S.curSystem;
    var hasCol = s && s.planets.some(function (p) { return p.colony; });
    var btns = [];
    if (hasCol) {
      btns.push(btn('修复飞船 300', function () { if (spend(300)) { S.hull = 100; S.shield = 100; toast('飞船已修复', 'good'); snd('confirm'); } }));
      btns.push(btn('充满能量 200', function () { if (spend(200)) { S.energy = 100; toast('引擎能量已充满', 'good'); snd('confirm'); } }));
      btns.push(btn('收集殖民地香料', function () {
        var got = 0;
        s.planets.forEach(function (p) {
          if (p.colony && p.spice && p.colony.stock > 0) {
            var take = Math.min(p.colony.stock, S.cargoCap - cargoUsed());
            if (take > 0) { S.cargo.spice[p.spice] = (S.cargo.spice[p.spice] || 0) + take; p.colony.stock -= take; got += take; }
          }
        });
        if (got) { toast('收集香料 +' + got, 'good'); snd('spice'); }
        else toast('殖民地没有存货', '');
      }));
    } else btns.push(btn('查看殖民地列表', function () { colonyListDialog(); }));
    btns.push(btn('关闭'));
    dialog('补给与殖民地', '当前星系：' + (s ? s.name : '（深空）') + (hasCol ? '\n拥有殖民地：可修理 / 补给 / 收集香料' : '\n没有殖民地，可在其他殖民地星系补给'), btns);
  }
  function colonyListDialog() {
    var list = [];
    SYSTEMS.forEach(function (s) { s.planets.forEach(function (p) { if (p.colony) list.push({ s: s, p: p }); }); });
    if (!list.length) { toast('还没有殖民地', 'warn'); return; }
    var body = '殖民地 ' + list.length + ' 座：\n';
    var btns = list.map(function (c) {
      return btn(c.s.name + '·' + c.p.name + ' 存货 ' + (c.p.colony.stock || 0), function () {
        S.curSystem = c.s;
        shipMarker.position.copy(c.s.pos);
        toast('已定位到 ' + c.s.name, 'good');
        setObjectiveGalaxy();
      });
    });
    btns.push(btn('关闭'));
    dialog('殖民地列表', body, btns);
  }

  /* ================= 10. 战斗 ================= */
  function fireLaser(dt, aim) {
    S.laserCd -= dt;
    if (S.laserCd > 0) return;
    if (S.energy < 1) { if (!S.noE) { toast('能量不足，无法开火', 'warn'); S.noE = true; } return; }
    S.noE = false;
    S.energy -= 1; S.laserCd = 0.14;
    beamFx(shipMesh.position, aim, 0x66ddff, 0.09);
    snd('laser', 0.5);
    for (var i = S.raids.length - 1; i >= 0; i--) {
      var e = S.raids[i];
      if (distToSegment(e.mesh.position, shipMesh.position, aim) < 10) {
        e.hp -= 12;
        e.flash = 0.12;
        burst(e.mesh.position, 0x88ddff, 4, 7, 2);
        if (e.hp <= 0) killEnemy(i, e);
      }
    }
  }
  function fireMissile() {
    if (!S.cargo.goods.missile) { toast('没有导弹（可在市场购买）', 'warn'); return; }
    if (!S.raids.length) { toast('没有目标', 'warn'); return; }
    var t = S.raids[0], bd = 1e9;
    S.raids.forEach(function (e) { var d = e.mesh.position.distanceTo(shipMesh.position); if (d < bd) { bd = d; t = e; } });
    S.cargo.goods.missile--;
    var m = new THREE.Group();
    m.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0xcc8844, emissive: 0xff6622, emissiveIntensity: 0.6 })));
    var gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff8844, transparent: true, opacity: 0.9, depthWrite: false }));
    gl.scale.setScalar(2.4);
    m.add(gl);
    m.position.copy(shipMesh.position);
    gPlanet.add(m);
    S.shots.push({ mesh: m, target: t, speed: 55, dmg: 35 });
    snd('spear_throw', 0.6);
  }
  function updateMissiles(dt) {
    for (var i = S.shots.length - 1; i >= 0; i--) {
      var s = S.shots[i];
      if (!s.target || !s.target.mesh) {
        gPlanet.remove(s.mesh); disposeObj(s.mesh); S.shots.splice(i, 1);
        continue;
      }
      var dir = s.target.mesh.position.clone().sub(s.mesh.position);
      var d = dir.length();
      if (d < 9) {
        burst(s.mesh.position, 0xff8844, 22, 24, 4);
        snd('boom', 0.7);
        s.target.hp -= s.dmg;
        if (s.target.hp <= 0) { var idx = S.raids.indexOf(s.target); if (idx >= 0) killEnemy(idx, s.target); }
        gPlanet.remove(s.mesh); disposeObj(s.mesh);
        S.shots.splice(i, 1);
        continue;
      }
      s.mesh.position.add(dir.normalize().multiplyScalar(s.speed * dt));
      s.mesh.lookAt(s.target.mesh.position);
      if (Math.random() < 0.45) burstAt(s.mesh.position, 0xffaa66, 1, 4, 1.6, 0.25);
    }
  }
  function killEnemy(i, e) {
    var en = S.raids[i];
    burst(en.mesh.position, e.empire.color, 24, 26, 4);
    burst(en.mesh.position, 0xffaa44, 14, 16, 3);
    gPlanet.remove(en.mesh);
    disposeObj(en.mesh);
    S.raids.splice(i, 1);
    S.kills++;
    if (S.groxFight) S.groxKills++;
    snd('boom');
    checkBadges(true);
  }
  function updateEnemies(dt, planet) {
    var R = planet.radius;
    var playerPos = shipMesh.position;
    for (var i = S.raids.length - 1; i >= 0; i--) {
      var e = S.raids[i];
      e.ang += e.speed * dt;
      var orb = new THREE.Vector3(Math.cos(e.ang) * Math.cos(e.tilt), Math.sin(e.tilt), Math.sin(e.ang) * Math.cos(e.tilt)).multiplyScalar(R * 1.55 + e.alt);
      e.mesh.position.copy(orb);
      e.mesh.lookAt(0, 0, 0);
      e.mesh.rotation.z += dt * 0.5;
      if (e.flash > 0) {
        e.flash -= dt;
        if (e.flash <= 0) resetEmissive(e.mesh);
        else e.mesh.traverse(function (o) { if (o.material && o.material.emissive) o.material.emissive.set(0xffffff); });
      }
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = rand(1.8, 3.2);
        var col = planet.colony && planet.colony.mesh ? planet.colony.mesh.getWorldPosition(new THREE.Vector3()) : null;
        var target = playerPos;
        if (col && col.distanceTo(orb) < playerPos.distanceTo(orb)) target = col;
        beamFx(orb, target, e.empire.color, 0.18);
        snd('laser', 0.35);
        if (target === playerPos) damagePlayer(rand(5, 9));
        else damageColony(planet, rand(4, 7));
      }
    }
  }
  function damagePlayer(n) {
    if (S.shield > 0) { S.shield = Math.max(0, S.shield - n); S.shieldFlash = 0.25; }
    else { S.hull = Math.max(0, S.hull - n); S.hullFlash = 0.25; }
    if (S.hull <= 0) respawn();
  }
  function respawn() {
    burst(shipMesh.position, 0xff8844, 30, 30, 5);
    snd('boom');
    toast('飞船被击毁，已紧急回收！', 'bad');
    S.hull = 50; S.shield = 50; S.energy = 50;
    S.lat = 0; S.lng = 0;
  }
  function damageColony(planet, n) {
    var col = planet.colony;
    if (!col || !col.mesh) return;
    col.hp -= n;
    if (col.hp <= 0) {
      toast(planet.name + ' 的殖民地被摧毁了！', 'bad');
      snd('boom');
      planet.mesh.remove(col.mesh);
      disposeObj(col.mesh);
      planet.colony = null;
      var sys = S.curSystem;
      if (sys && sys.colMarker) { gGalaxy.remove(sys.colMarker); disposeObj(sys.colMarker); sys.colMarker = null; }
    }
  }

  /* ================= 11. 外交 · 任务 · 徽章 ================= */
  function dialog(title, body, buttons) {
    S.dialogOpen = true;
    try { game.ui.dialog({ title: title, body: body, buttons: buttons }); } catch (e) {}
  }
  function btn(label, cb) {
    return { label: label, cb: function () {
      try { game.ui.closeDialog(); } catch (e) {}
      S.dialogOpen = false;
      if (cb) cb();
    } };
  }
  function empireDialog() {
    var body = '银河帝国关系\n';
    EMPIRES.forEach(function (e, i) {
      body += (i + 1) + '. ' + e.name + '（' + e.personality + '）关系 ' + e.relation + (e.allied ? '【同盟】' : '') + (e.atWar ? '【交战】' : '') + '\n';
    });
    body += '· 格罗克斯：关系 -100（无法和解）';
    var btns = EMPIRES.map(function (e, i) { return btn((i + 1) + '. ' + e.name, function () { empireActionDialog(e); }); });
    btns.push(btn('关闭'));
    dialog('帝国外交', body, btns);
  }
  function empireActionDialog(e) {
    if (e === GROX) {
      dialog('格罗克斯', '格罗克斯：\n“你们这些脆弱的有机体，只会污染银河的纯净。”\n它们封锁着通往银河核心的道路。',
        [btn('挑衅', function () { e.relation = clamp(e.relation - 5, -100, 100); toast('格罗克斯发出低沉的威胁…', 'warn'); snd('roar', 0.6); }),
          btn('关闭')]);
      return;
    }
    var t = '外交官：\n';
    if (e.relation <= -50) t += '“我们不欢迎你。”\n';
    else if (e.relation < 20) t += '“你好，来自远方的旅人。”\n';
    else if (e.relation < 60) t += '“我们的关系正日益紧密。”\n';
    else t += '“你是我们最信任的朋友！”\n';
    var btns = [
      btn('问候', function () {
        if (S.greetT > 0) { toast('外交官正在休息，稍后再来', ''); return; }
        S.greetT = 30;
        e.relation = clamp(e.relation + 2, -100, 100);
        toast(e.name + ' 关系 +2', 'good'); snd('social_ok');
      }),
      btn('送礼（500 星币）', function () {
        if (spend(500)) { e.relation = clamp(e.relation + 15, -100, 100); toast(e.name + ' 关系 +15', 'good'); snd('charm'); }
      }),
      btn('贸易', function () { marketMenu(e); }),
      btn('结盟（需关系≥40，2000 星币）', function () {
        if (e.relation < 40) { toast('关系不足 40，无法结盟', 'bad'); snd('deny'); return; }
        if (!spend(2000)) return;
        e.allied = true; S.allyCount++;
        toast('与 ' + e.name + ' 结盟成功！', 'good');
        snd('ally');
        checkBadges(true);
      }),
      btn(e.atWar ? '停战（2000 星币）' : '宣战', function () {
        if (e.atWar) {
          if (!spend(2000)) return;
          e.atWar = false; e.relation = clamp(e.relation + 20, -100, 100);
          toast('与 ' + e.name + ' 达成停战', 'good'); snd('confirm');
        } else {
          if (e.allied) e.allied = false;
          e.atWar = true; e.relation = -60;
          toast('向 ' + e.name + ' 宣战！', 'warn'); snd('epic_roar', 0.5);
          if (S.view === 'planet' && S.curSystem && S.curSystem.owner === e) spawnDefenders(S.curSystem, S.curPlanet);
        }
      }),
      btn('关闭')
    ];
    dialog(e.name + '（' + e.personality + '）\n领地 ' + e.sysCount + ' 星系 · 关系 ' + e.relation, t, btns);
  }
  function issueQuest() {
    var ok = EMPIRES.filter(function (e) { return e.relation >= 10 && !e.atWar; });
    if (!ok.length) return;
    var e = choice(ok);
    var kind = choice(['kill', 'deliver', 'explore', 'terraform', 'scan']);
    var q = { id: 'q' + (S.qid++), empire: e, kind: kind, need: 0, key: null, desc: '', baseKills: S.kills, sys: null, p: null, pRef: null };
    if (kind === 'kill') {
      q.need = randi(2, 4);
      q.desc = '击落 ' + q.need + ' 艘敌舰';
    } else if (kind === 'deliver') {
      q.key = e.home && e.home.planets.some(function (p) { return p.spice; }) ? e.home.planets.find(function (p) { return p.spice; }).spice : 'red';
      q.need = randi(4, 8);
      q.desc = '运送 ' + q.need + ' 单位' + spiceName(q.key) + ' 到 ' + e.name + ' 领地';
    } else if (kind === 'explore') {
      var un = SYSTEMS.filter(function (s) { return !s.visited && !s.isCenter; });
      if (!un.length) return;
      q.sys = choice(un);
      q.desc = '探索 ' + q.sys.name;
    } else if (kind === 'terraform') {
      var cand = [];
      SYSTEMS.forEach(function (s) { s.planets.forEach(function (p) { if (tScore(p) < 2 && !p.colony) cand.push({ s: s, p: p }); }); });
      if (!cand.length) return;
      var pick = choice(cand);
      q.p = pick.p; q.pRef = { sys: pick.s.id, idx: pick.s.planets.indexOf(pick.p) };
      q.desc = '将 ' + pick.s.name + '·' + pick.p.name + ' 宜居度提升至 2';
    } else {
      var uns = SYSTEMS.filter(function (s) { return !s.scanned && !s.isCenter; });
      if (!uns.length) return;
      q.sys = choice(uns);
      q.desc = '扫描 ' + q.sys.name;
    }
    S.quests.push(q);
    toast('新任务：' + e.name + ' 委托 — ' + q.desc, 'warn');
    snd('ui_open');
  }
  function questDone(q) {
    var rew = randi(800, 2200);
    addMoney(rew);
    q.empire.relation = clamp(q.empire.relation + 12, -100, 100);
    toast('任务完成：' + q.desc + '  奖励 ' + rew + ' 星币', 'good');
    snd('mission_ok');
  }
  function checkQuests() {
    for (var i = S.quests.length - 1; i >= 0; i--) {
      var q = S.quests[i];
      var ok = false;
      if (q.kind === 'kill') ok = (S.kills - q.baseKills) >= q.need;
      else if (q.kind === 'explore') ok = !!(q.sys && q.sys.visited);
      else if (q.kind === 'scan') ok = !!(q.sys && q.sys.scanned);
      else if (q.kind === 'terraform') ok = !!(q.p && tScore(q.p) >= 2);
      else if (q.kind === 'deliver') {
        if (S.curSystem === q.empire.home && (S.cargo.spice[q.key] || 0) >= q.need) {
          S.cargo.spice[q.key] -= q.need;
          ok = true;
        }
      }
      if (ok) { questDone(q); S.quests.splice(i, 1); }
    }
  }
  function questDialog() {
    if (!S.quests.length) {
      dialog('任务', '当前没有进行中的任务。\n帝国会定期委托任务，完成后获得星币与好感。', [btn('关闭')]);
      return;
    }
    var body = '';
    S.quests.forEach(function (q, i) {
      body += (i + 1) + '. [' + q.empire.name + '] ' + q.desc;
      if (q.kind === 'kill') body += '（' + Math.min(q.need, S.kills - q.baseKills) + '/' + q.need + '）';
      if (q.kind === 'deliver') body += '（' + Math.min(q.need, S.cargo.spice[q.key] || 0) + '/' + q.need + '）';
      body += '\n';
    });
    dialog('任务', body, [btn('关闭')]);
  }
  function badgeCount() {
    var n = 0;
    BADGES.forEach(function (b) { if (S.badges[b.key]) n++; });
    return n;
  }
  function badgeList() {
    var a = [];
    BADGES.forEach(function (b) { if (S.badges[b.key]) a.push(b.name); });
    return a;
  }
  function checkBadges(force) {
    if (!force && S.badgeT > 0) return;
    S.badgeT = 1;
    BADGES.forEach(function (b) {
      if (!S.badges[b.key] && b.cond()) {
        S.badges[b.key] = true;
        toast('解锁徽章：' + b.icon + ' ' + b.name + ' — ' + b.desc, 'good');
        snd('unlock');
      }
    });
  }
  function badgeDialog() {
    var body = '';
    BADGES.forEach(function (b) {
      body += (S.badges[b.key] ? '✔ ' : '✘ ') + b.icon + ' ' + b.name + ' — ' + b.desc + '\n';
    });
    dialog('徽章收藏', '已解锁 ' + badgeCount() + '/' + BADGES.length + '\n' + body, [btn('关闭')]);
  }
  function helpDialog() {
    dialog('操作说明',
      '银河视图：\n· 鼠标悬停星系预览名称，点击星系跃迁（消耗引擎能量）\n· 数字键 1-8 使用工具\n\n行星视图：\n· WASD / 方向键飞行\n· 鼠标瞄准，左键使用工具 / 开火\n· 空格发射导弹（需在市场购买）\n\n目标：\n· 地球化、殖民、贸易、结盟\n· 突破格罗克斯封锁，抵达银河核心',
      [btn('关闭')]);
  }

  /* ================= 12. 主循环 / 存档 / 出入口 ================= */
  function held() {
    var k = game.input.keys || {};
    for (var i = 0; i < arguments.length; i++) {
      var n = arguments[i];
      if (k[n] || k[n.toLowerCase()] || k[n.toUpperCase()] || k['Key' + n]) return true;
    }
    return false;
  }
  function spacePressed() {
    var k = game.input.keys || {};
    var now = !!(k.Space || k.space || k[' ']);
    var e = now && !spaceHeld;
    spaceHeld = now;
    return e;
  }
  function mouseClicked() {
    var m = game.input.mouse;
    return m.down0 && !S.prevDown0;
  }
  function toast(t, kind) { try { game.ui.toast(t, kind || ''); } catch (e) {} }
  function snd(name, g) { try { SP.Audio.play(name, g); } catch (e) {} }
  function addMoney(n) { S.money += n; try { game.addMoney(n); } catch (e) {} }
  function spend(n) {
    if (S.money < n) { toast('星币不足（需要 ' + n + '）', 'bad'); snd('deny'); return false; }
    S.money -= n;
    try { game.addMoney(-n); } catch (e) {}
    return true;
  }
  function countT2() {
    var n = 0;
    SYSTEMS.forEach(function (s) { s.planets.forEach(function (p) { if (tScore(p) >= 2) n++; }); });
    return n;
  }
  function updateColonies(dt) {
    S.colTick = (S.colTick || 0) - dt;
    if (S.colTick > 0) return;
    S.colTick = 8;
    SYSTEMS.forEach(function (s) {
      s.planets.forEach(function (p) {
        if (p.colony && p.spice && p.colony.stock < 20) p.colony.stock = Math.min(20, p.colony.stock + p.colony.prod);
      });
    });
  }
  function updateCiv(dt) {
    SYSTEMS.forEach(function (s) {
      s.planets.forEach(function (p) {
        if (p.monolith && p.civ < 3) {
          p.civT -= dt;
          if (p.civT <= 0) {
            p.civ++;
            var stage = ['原始', '部落', '文明', '太空'][p.civ];
            toast(s.name + '·' + p.name + ' 的文明进入「' + stage + '时代」！', 'good');
            if (p.civ >= 3) {
              addMoney(800);
              EMPIRES.forEach(function (e) { if (e.personality === '宗教') e.relation = clamp(e.relation + 10, -100, 100); });
              snd('levelup');
            } else { p.civT = p.civ === 1 ? 45 : 60; snd('unlock'); }
          }
        }
      });
    });
  }
  function hudHTML() {
    var bd = '';
    BADGES.forEach(function (b) { if (S.badges[b.key]) bd += b.icon + ' '; });
    var sp = [], gd = [];
    SPICE.forEach(function (s) { if (S.cargo.spice[s.key]) sp.push(s.name + '×' + S.cargo.spice[s.key]); });
    GOODS.forEach(function (g) { if (S.cargo.goods[g.key]) gd.push(g.name + '×' + S.cargo.goods[g.key]); });
    var cr = S.creatures.length ? ' 生物×' + S.creatures.length : '';
    return '星币 <b>' + S.money + '</b> · 货舱 ' + cargoUsed() + '/' + S.cargoCap +
      (sp.length ? '<br>香料：' + sp.join(' ') : '') +
      (gd.length ? '<br>货物：' + gd.join(' ') : '') + cr +
      (bd ? '<br><span style="font-size:13px;color:#ffd76a">' + bd + '</span>' : '');
  }
  function updateHud(dt) {
    S.hudT -= dt;
    if (S.hudT > 0) return;
    S.hudT = 0.3;
    try {
      game.ui.setBars([
        { label: '能量', v: S.energy, max: 100, color: '#7fd0ff' },
        { label: '护盾', v: S.shield, max: 100, color: '#66ddff' },
        { label: '船体', v: S.hull, max: 100, color: '#ff8f5f' }
      ]);
      game.ui.setHud(hudHTML());
      game.ui.setProgress(1 - progressToCenter(), '距银河核心');
    } catch (e) {}
  }
  function galaxyActions() {
    return [
      { key: '1', label: '扫描', desc: '扫描当前/悬停星系', cb: function () { var s = S.curSystem || S.hoverSys; if (!s) { toast('请先悬停或点击一个星系', 'warn'); return; } scanSystemDialog(s); } },
      { key: '2', label: '外交', desc: '帝国关系', cb: function () { empireDialog(); } },
      { key: '3', label: '任务', desc: '任务列表', cb: function () { questDialog(); } },
      { key: '4', label: '徽章', desc: '徽章收藏', cb: function () { badgeDialog(); } },
      { key: '5', label: '补给', desc: '修理 / 能量 / 殖民地', cb: function () { supplyDialog(); } },
      { key: '6', label: '进入行星', desc: '进入当前星系', cb: function () { planetListDialog(); } },
      { key: '7', label: '改装飞船', desc: '飞船编辑器', cb: function () { try { game.ui.openEditor('ship', function (d) { applyDesign(d); }); } catch (e) { toast('编辑器不可用', 'warn'); } } },
      { key: '8', label: '帮助', desc: '操作说明', cb: function () { helpDialog(); } }
    ];
  }
  function planetActions() {
    return [
      { key: '1', label: '扫描', desc: '扫描行星信息', cb: function () { S.tool = 'scan'; toast('点击地面开始扫描', ''); } },
      { key: '2', label: '牵引', desc: '绑架地表生物', cb: function () { S.tool = 'tractor'; toast('按住鼠标左键绑架最近生物', ''); } },
      { key: '3', label: '地球化', desc: '改造行星环境', cb: function () { S.tool = 'terraform'; terraDialog(); } },
      { key: '4', label: '殖民', desc: '建立殖民地 (T≥1)', cb: function () { S.tool = 'colonize'; toast('点击地表建立殖民地（2000 星币）', ''); } },
      { key: '5', label: '贸易', desc: '买卖香料与货物', cb: function () { tradeDialog(); } },
      { key: '6', label: '武器', desc: '激光 · 按住左键', cb: function () { S.tool = 'weapon'; toast('按住左键开火，空格发射导弹', ''); } },
      { key: '7', label: '修理', desc: '修复飞船与补给', cb: function () { repairDialog(); } },
      { key: '8', label: '巨石', desc: '投放巨石引导文明', cb: function () { S.tool = 'monolith'; toast('点击地表投放巨石（1500 星币）', ''); } },
      { key: '9', label: '返回银河', desc: '离开行星', cb: function () { enterGalaxyView(); } }
    ];
  }
  function scanSystemDialog(s) {
    if (!s) return;
    s.scanned = true;
    var body = s.name + '\n恒星等级：' + s.starClass + ' · 行星 ' + s.planets.length + ' 颗\n' +
      (s.owner ? '归属：' + s.owner.name + (s.owner === GROX ? '（极度危险）' : '') + '\n' : '归属：无主\n');
    s.planets.forEach(function (p) {
      body += p.name + ' ' + PK_CN[p.kind] + ' T' + tScore(p) + (p.spice ? ' · ' + spiceName(p.spice) : '') + (p.colony ? ' · 殖民地' : '') + '\n';
    });
    snd('scan');
    dialog('扫描结果 — ' + s.name, body,
      [btn('进入行星', function () { S.curSystem = s; enterPlanetView(s, s.planets[0]); }),
        btn('关闭')]);
  }
  function planetListDialog() {
    var s = S.curSystem;
    if (!s) { toast('请先跃迁到一个星系', 'warn'); return; }
    var btns = s.planets.map(function (p) {
      return btn(p.name + ' ' + PK_CN[p.kind] + ' T' + tScore(p) + (p.colony ? ' ●' : ''), function () { enterPlanetView(s, p); });
    });
    btns.push(btn('关闭'));
    dialog(s.name + ' — 选择行星', '点击进入行星视图', btns);
  }

  this.enter = function (payload) {
    if (!gGalaxy) {
      gGalaxy = new THREE.Group();
      game.scene.add(gGalaxy);
      gFx = new THREE.Group();
      game.scene.add(gFx);
      overlay = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      overlay.scale.setScalar(6000);
      overlay.renderOrder = 9999;
      game.scene.add(overlay);
      generateGalaxy();
      genEmpires();
      buildShip();
      galaxyHlRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), color: 0x66ffcc, transparent: true, opacity: 0.9, depthWrite: false }));
      galaxyHlRing.scale.setScalar(34);
      galaxyHlRing.visible = false;
      gGalaxy.add(galaxyHlRing);
    }
    S.money = game.money || 100000;
    S.energy = 100; S.shield = 100; S.hull = 100;
    var a = rand(0, TAU);
    S.startPos = new THREE.Vector3(Math.cos(a) * 1100, 0, Math.sin(a) * 1100);
    if (payload && payload.space) self.deserialize(payload.space);
    if (S.curSystem) shipMarker.position.copy(S.curSystem.pos);
    else shipMarker.position.copy(S.startPos);
    enterGalaxyView();
    toast('欢迎来到星际时代！点击星系跃迁，探索银河', 'good');
    snd('stage_up');
  };
  this.exit = function () {
    try { game.ui.closeDialog(); } catch (e) {}
    clearGroup(gPlanet); gPlanet = null;
    clearGroup(gGalaxy); gGalaxy = null;
    clearGroup(gFx); gFx = null;
    game.scene.remove(shipMesh);
    game.scene.remove(overlay);
    game.scene.fog = null;
    game.scene.background = null;
    S.warp = null; S.warpDots = [];
    S.raids.length = 0; S.shots.length = 0; S.parts.length = 0; S.beams.length = 0;
    S.curSystem = null; S.curPlanet = null; S.view = 'galaxy';
    S.dialogOpen = false; S.winT = 0; S.winDialog = false;
  };
  this.update = function (dt) {
    if (!gGalaxy) return;
    dt = Math.min(dt, 0.05);
    S.t += dt;
    S.greetT = Math.max(0, S.greetT - dt);
    updateFx(dt);
    if (S.view === 'galaxy') updateGalaxy(dt);
    else updatePlanet(dt);
    updateColonies(dt);
    updateCiv(dt);
    checkQuests();
    checkBadges(false);
    updateHud(dt);
    S.questTimer -= dt;
    if (S.questTimer <= 0) { S.questTimer = rand(35, 60); issueQuest(); }
    S.raidTimer -= dt;
    if (S.raidTimer <= 0) {
      S.raidTimer = rand(50, 80);
      if (S.view === 'planet') {
        var atWar = EMPIRES.filter(function (e) { return e.atWar; });
        if (atWar.length) {
          toast('警告：敌方舰队来袭！', 'warn');
          spawnOneEnemy(choice(atWar), S.curPlanet);
        }
      }
    }
    S.prevDown0 = game.input.mouse.down0;
  };
  this.serialize = function () {
    return {
      v: 1,
      money: S.money, energy: S.energy, shield: S.shield, hull: S.hull,
      cargo: S.cargo,
      creatures: S.creatures.map(function (c) { return { name: c.name, size: c.size, from: c.from }; }),
      curSystem: S.curSystem ? S.curSystem.id : null,
      systems: SYSTEMS.map(function (s) {
        return {
          id: s.id, scanned: !!s.scanned, visited: !!s.visited, owner: s.owner ? s.owner.id : null,
          planets: s.planets.map(function (p) {
            return {
              stats: p.stats, spice: p.spice, scanned: !!p.scanned, monolith: !!p.monolith,
              civ: p.civ, civT: p.civT,
              colony: p.colony ? { stock: p.colony.stock, hp: p.colony.hp, prod: p.colony.prod } : null
            };
          })
        };
      }),
      empires: EMPIRES.map(function (e) { return { id: e.id, relation: e.relation, allied: e.allied, atWar: e.atWar }; }),
      groxBreached: S.groxBreached,
      quests: S.quests.map(function (q) {
        return { kind: q.kind, need: q.need, key: q.key, desc: q.desc, baseKills: q.baseKills, sys: q.sys ? q.sys.id : null, pRef: q.pRef, empire: q.empire.id };
      }),
      badges: S.badges, kills: S.kills, tradeTotal: S.tradeTotal,
      visitedCount: S.visitedCount, colCount: S.colCount, allyCount: S.allyCount
    };
  };
  this.deserialize = function (s) {
    if (!s || s.v !== 1) return;
    S.money = s.money || 100000;
    try { game.addMoney(S.money - game.money); } catch (e) {}
    S.energy = s.energy != null ? s.energy : 100;
    S.shield = s.shield != null ? s.shield : 100;
    S.hull = s.hull != null ? s.hull : 100;
    S.cargo = s.cargo || { spice: {}, goods: {} };
    S.creatures = (s.creatures || []).map(function (c) { return { name: c.name, size: c.size, from: c.from, genome: null }; });
    S.badges = s.badges || {};
    S.kills = s.kills || 0; S.tradeTotal = s.tradeTotal || 0;
    S.visitedCount = s.visitedCount || 0; S.colCount = s.colCount || 0; S.allyCount = s.allyCount || 0;
    S.groxBreached = !!s.groxBreached;
    (s.systems || []).forEach(function (sv) {
      var sys = sysById[sv.id];
      if (!sys) return;
      sys.scanned = sv.scanned; sys.visited = sv.visited;
      sys.owner = sv.owner === 'grox' ? GROX : (sv.owner === 'player' ? PLAYER : (sv.owner ? empById[sv.owner] : null));
      sv.planets.forEach(function (pv, i) {
        var p = sys.planets[i];
        if (!p) return;
        p.stats = pv.stats; p.spice = pv.spice; p.scanned = pv.scanned;
        p.monolith = pv.monolith; p.civ = pv.civ || 0; p.civT = pv.civT || 0;
        if (pv.colony) p.colony = { stock: pv.colony.stock, hp: pv.colony.hp, prod: pv.colony.prod };
      });
      if (sys.owner && sys.isHome) sys.owner.home = sys;
    });
    (s.empires || []).forEach(function (ev) {
      var e = empById[ev.id];
      if (e) { e.relation = ev.relation; e.allied = ev.allied; e.atWar = ev.atWar; }
    });
    S.quests = (s.quests || []).map(function (q) {
      var nq = { kind: q.kind, need: q.need, key: q.key, desc: q.desc, baseKills: q.baseKills, sys: q.sys ? sysById[q.sys] : null, pRef: q.pRef, p: null, empire: empById[q.empire] };
      if (nq.pRef && sysById[nq.pRef.sys]) nq.p = sysById[nq.pRef.sys].planets[nq.pRef.idx] || null;
      return nq;
    }).filter(function (q) { return q.empire; });
    if (s.curSystem && sysById[s.curSystem]) S.curSystem = sysById[s.curSystem];
  };
};
