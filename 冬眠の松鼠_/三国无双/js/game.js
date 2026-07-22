/* ============================================================
 * 真·三國無雙 WEB —— 游戏主逻辑
 * 主循环 / 玩家连招 / 无双 / 敌我AI / 据点 / 事件演出
 * ============================================================ */
'use strict';

var GAME = (function () {

  /* ================= 基础 ================= */
  var scene, camera, renderer, clock;
  var canvas;

  var APP = { state: 'title' };   // title/select/intro/battle/paused/over

  var G = null;                   // 每局战斗状态
  var keys = {};
  var camYaw = Math.PI;           // 初始面向北（-z）
  var camShake = 0;

  var GRAV = 26;
  var PBASE = 15;                 // 玩家武器基础伤害

  function v3(x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); }
  function normAng(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function lerpAng(a, b, t) { return a + normAng(b - a) * Math.min(1, t); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function dist2(a, b) { var dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; }

  function inArc(srcPos, facing, range, arcDeg, tPos, extra) {
    var dx = tPos.x - srcPos.x, dz = tPos.z - srcPos.z;
    var r = range + (extra || 0);
    if (dx * dx + dz * dz > r * r) return false;
    if (tPos.y > 3.2) return false;
    if (arcDeg >= 350) return true;
    var a = Math.atan2(dx, dz);
    return Math.abs(normAng(a - facing)) <= arcDeg * Math.PI / 360;
  }

  /* ================= 特效 ================= */
  var FX = {
    list: [],
    add: function (mesh, dur, update, onEnd) {
      scene.add(mesh);
      FX.list.push({ mesh: mesh, t: 0, dur: dur, update: update, onEnd: onEnd });
    },
    update: function (dt) {
      for (var i = FX.list.length - 1; i >= 0; i--) {
        var f = FX.list[i];
        f.t += dt;
        var k = f.t / f.dur;
        if (k >= 1) {
          scene.remove(f.mesh);
          disposeDeep(f.mesh);
          if (f.onEnd) f.onEnd();
          FX.list.splice(i, 1);
        } else if (f.update) f.update(f.mesh, k);
      }
    },
    spark: function (pos, color, size) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: MODELS.glowTex, color: color || 0xffdd88, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      sp.position.copy(pos);
      var s0 = size || 1.4;
      sp.scale.set(s0, s0, 1);
      FX.add(sp, 0.18, function (m, k) {
        m.material.opacity = 1 - k;
        var s = s0 * (1 + k * 1.5);
        m.scale.set(s, s, 1);
      });
    },
    slash: function (pos, facing, arcDeg, range, color, tilt) {
      var arc = arcDeg * Math.PI / 180;
      var geo = new THREE.RingGeometry(range * 0.35, range, 14, 1, -arc / 2, arc);
      var mat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      var m = new THREE.Mesh(geo, mat);
      m.position.set(pos.x, pos.y + 1.15, pos.z);
      m.rotation.order = 'YXZ';
      m.rotation.y = facing - Math.PI / 2;
      m.rotation.x = -Math.PI / 2 + (tilt || 0.12);
      FX.add(m, 0.16, function (mm, k) { mm.material.opacity = 0.75 * (1 - k); });
    },
    shock: function (pos, maxR, color) {
      var geo = new THREE.RingGeometry(0.82, 1, 26);
      var mat = new THREE.MeshBasicMaterial({
        color: color || 0xffcc66, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      });
      var m = new THREE.Mesh(geo, mat);
      m.position.set(pos.x, 0.15, pos.z);
      m.rotation.x = -Math.PI / 2;
      FX.add(m, 0.4, function (mm, k) {
        var s = 0.5 + k * maxR;
        mm.scale.set(s, s, 1);
        mm.material.opacity = 0.9 * (1 - k);
      });
    },
    dust: function (pos) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: MODELS.glowTex, color: 0x998866, transparent: true, opacity: 0.4, depthWrite: false
      }));
      sp.position.set(pos.x, 0.3, pos.z);
      sp.scale.set(1.2, 0.7, 1);
      FX.add(sp, 0.35, function (m, k) {
        m.material.opacity = 0.4 * (1 - k);
        m.scale.set(1.2 + k * 2, 0.7 + k, 1);
      });
    },
    lightning: function (pos) {
      var geo = new THREE.CylinderGeometry(0.12, 0.55, 34, 6);
      var mat = new THREE.MeshBasicMaterial({
        color: 0xccddff, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      var m = new THREE.Mesh(geo, mat);
      m.position.set(pos.x, 17, pos.z);
      FX.add(m, 0.28, function (mm, k) { mm.material.opacity = 1 - k; });
      FX.spark(v3(pos.x, 1, pos.z), 0xaaccff, 3);
      FX.shock(pos, 3.5, 0x88aaff);
    },
    warnRing: function (pos, dur) {
      var geo = new THREE.RingGeometry(2.0, 2.5, 22);
      var mat = new THREE.MeshBasicMaterial({
        color: 0xff3322, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false
      });
      var m = new THREE.Mesh(geo, mat);
      m.position.set(pos.x, 0.12, pos.z);
      m.rotation.x = -Math.PI / 2;
      FX.add(m, dur, function (mm, k) {
        mm.material.opacity = 0.3 + 0.4 * Math.sin(k * 25);
        var s = 1 - k * 0.5;
        mm.scale.set(s, s, 1);
      });
    }
  };

  function disposeDeep(obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map && o.material.map !== MODELS.glowTex && o.material.map !== MODELS.shadowTex && o.material.map !== MODELS.ringTex) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  /* ================= 初始化three ================= */
  function initThree() {
    canvas = document.getElementById('game');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb8c4d8);
    scene.fog = new THREE.Fog(0xb8c4d8, 70, 240);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 800);
    camera.position.set(0, 5, 220);

    var hemi = new THREE.HemisphereLight(0xcdd8ee, 0x55503a, 0.95);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff0d0, 0.85);
    sun.position.set(60, 100, 40);
    scene.add(sun);

    clock = new THREE.Clock();

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* ================= 战斗状态构建 ================= */
  function newGame(hero) {
    var stage = DATA.stage;
    G = {
      stage: stage,
      time: 0,
      timeLeft: stage.timeLimit,
      morale: 50,
      hitstop: 0,
      slowmo: 0,
      mobs: [],
      officers: [],
      projectiles: [],
      groundItems: [],
      pots: [],
      bases: [],
      events: [],
      basesTaken: 0,
      sorcery: false,
      sorceryT: 0,
      barrierBroken: false,
      objective: DATA.text.barrierHint,
      win: null,
      overT: 0,
      hintMusou: false,
      hintDanger: 0,
      heJinWarn: 0,
      player: null
    };

    // 地形
    MODELS.buildTerrain(scene, stage);

    // 据点
    stage.bases.forEach(function (bd) {
      var built = MODELS.makeBase(bd);
      scene.add(built.root);
      var base = {
        id: bd.id, name: bd.name, side: bd.side, x: bd.x, z: bd.z,
        main: bd.main, flagMat: built.flagMat, captain: null, spawnT: rand(2, 6)
      };
      G.bases.push(base);
      // 敌方据点兵长
      if (bd.side === 2 && !bd.main) {
        base.captain = spawnMob(2, 'captain', bd.x + rand(-2, 2), bd.z + rand(-2, 2), base);
      }
      // 罐子
      var potN = bd.main ? 5 : 3;
      for (var i = 0; i < potN; i++) {
        var pm = MODELS.makePot();
        var px = bd.x + rand(-6, 6), pz = bd.z + rand(-6, 6);
        pm.position.set(px, 0, pz);
        scene.add(pm);
        G.pots.push({ pos: v3(px, 0, pz), mesh: pm, alive: true });
      }
    });

    // 武将
    var officerDefs = stage.officers.slice();
    var bro = stage.npcBrothers[hero.id === 'zhaoyun' ? 'guanyu' : (hero.id === 'guanyu' ? 'zhangfei' : 'guanyu')];
    if (bro) officerDefs.push(bro);
    if (hero.id === 'zhaoyun') officerDefs.push(stage.npcBrothers.zhangfei);
    officerDefs.forEach(function (d) { if (d) spawnOfficer(d); });

    // 玩家
    G.player = makePlayer(hero);

    // 初期兵力
    seedTroops();

    // 事件
    setupEvents();

    // 相机
    camYaw = Math.PI;
  }

  /* ================= 玩家 ================= */
  function makePlayer(hero) {
    var model = MODELS.makeHero(hero);
    scene.add(model.root);
    var st = DATA.stage.playerStart;
    var p = {
      kind: 'player', side: 1,
      hero: hero,
      moveset: DATA.movesets[hero.weaponType],
      pos: v3(st.x, 0, st.z),
      vy: 0, grounded: true,
      facing: Math.PI,
      hp: hero.hp, maxHp: hero.hp,
      musou: 0, musouActive: false, musouT: 0, trueMusou: false, musouAura: null,
      kills: 0, officerKills: 0,
      combo: 0, comboT: 0, maxCombo: 0,
      atkBuff: 0, defBuff: 0,
      action: null, buffered: null,
      hitstunT: 0, downT: 0, iframes: 0,
      guarding: false,
      dead: false,
      model: model,
      animT: 0,
      riding: false,
      horse: null,
      horseCalled: false
    };
    model.root.position.copy(p.pos);
    model.root.rotation.y = p.facing;

    // 坐骑
    var horseColor = hero.id === 'guanyu' ? 0xb8402a : (hero.id === 'zhangfei' ? 0x2a2a30 : 0xe8e8ee);
    var hm = MODELS.makeHorse(horseColor);
    scene.add(hm.root);
    p.horse = {
      model: hm, pos: v3(st.x + 4, 0, st.z + 6), facing: Math.PI,
      coming: false, animT: 0, speed: 0
    };
    hm.root.position.copy(p.horse.pos);
    return p;
  }

  /* ================= 兵卒 ================= */
  function spawnMob(side, typeName, x, z, base) {
    var type = DATA.mobTypes[typeName];
    var model = MODELS.makeSoldier(side, type);
    var m = {
      kind: 'mob', side: side, typeName: typeName,
      hp: type.hp, maxHp: type.hp, atk: type.atk, spd: type.spd, range: type.range,
      captain: !!type.captain, base: base || null,
      pos: v3(x, 0, z), vy: 0, kx: 0, kz: 0,
      facing: rand(-Math.PI, Math.PI),
      state: 'idle', stateT: 0, windup: 0, cd: rand(0.5, 2),
      target: null, retargetT: rand(0, 0.6),
      animT: rand(0, 6), dead: false, deadT: 0,
      model: model, stunFx: null
    };
    if (m.captain) {
      var lbl = MODELS.makeNameLabel('据点兵长', '', side === 1 ? '#8ab4ff' : '#ff9a66');
      lbl.position.y = 2.5;
      lbl.scale.set(2.2, 0.7, 1);
      model.root.add(lbl);
      m.label = lbl;
    }
    model.root.position.copy(m.pos);
    scene.add(model.root);
    G.mobs.push(m);
    return m;
  }

  function spawnOfficer(def) {
    var model = MODELS.makeOfficer(def);
    var o = {
      kind: 'officer', side: def.side,
      name: def.name, title: def.title || '', def: def,
      hp: def.hp, maxHp: def.hp, atk: def.atk || 1,
      pos: v3(def.x, 0, def.z), home: v3(def.x, 0, def.z),
      vy: 0, kx: 0, kz: 0,
      facing: def.side === 1 ? Math.PI : 0,
      behavior: def.behavior, boss: def.boss || null,
      strong: !!def.strong, sorcerer: !!def.sorcerer,
      barrier: !!def.barrier, vital: !!def.vital, commander: !!def.commander,
      state: 'idle', stateT: 0, windup: 0, cd: rand(0.5, 2), castCd: rand(2, 4),
      target: null, retargetT: rand(0, 0.5),
      animT: rand(0, 6), dead: false, deadT: 0,
      quoted: false, quote: def.quote,
      model: model, stunFx: null, poise: 0
    };
    var colorCss = def.side === 1 ? '#7dabff' : '#ff5544';
    var lbl = MODELS.makeNameLabel(def.name, def.title || '', colorCss);
    lbl.position.y = def.boss ? 3.3 : 3.0;
    model.root.add(lbl);
    o.label = lbl;
    var bar = MODELS.makeMiniHpBar();
    bar.position.y = def.boss ? 2.85 : 2.6;
    model.root.add(bar);
    o.hpBar = bar;

    if (o.barrier) {
      var bMat = new THREE.MeshBasicMaterial({
        color: 0x9944ff, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      });
      var sphere = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), bMat);
      sphere.position.y = 1.6;
      model.root.add(sphere);
      o.barrierMesh = sphere;
    }

    model.root.position.copy(o.pos);
    model.root.rotation.y = o.facing;
    scene.add(model.root);
    G.officers.push(o);
    return o;
  }

  function seedTroops() {
    // 各武将卫队
    G.officers.forEach(function (o) {
      var n = o.boss ? 6 : 4;
      for (var i = 0; i < n; i++) {
        var t = Math.random() < 0.22 ? 'archer' : (Math.random() < 0.5 ? 'spear' : 'sword');
        spawnMob(o.side, t, o.pos.x + rand(-5, 5), o.pos.z + rand(-5, 5));
      }
    });
    // 前线冲突群
    for (var c = 0; c < 5; c++) {
      var cx = rand(-100, 100), cz = rand(60, 110);
      for (var i = 0; i < 4; i++) {
        spawnMob(2, Math.random() < 0.5 ? 'sword' : 'spear', cx + rand(-4, 4), cz + rand(-4, 4));
        spawnMob(1, Math.random() < 0.5 ? 'sword' : 'spear', cx + rand(-4, 4), cz + 14 + rand(-4, 4));
      }
    }
  }

  function countMobs(side) {
    var n = 0;
    for (var i = 0; i < G.mobs.length; i++) if (!G.mobs[i].dead && G.mobs[i].side === side) n++;
    return n;
  }

  /* ================= 事件 ================= */
  function setupEvents() {
    var T = DATA.text, st = DATA.stage;
    G.events = [
      { t: 0.5, fn: function () { UI.banner(st.name, st.subtitle, 'bannerStage', 3000); } },
      { t: 3.6, fn: function () { UI.banner(T.stageStart, '', 'bannerGo', 1800); SFX.alert(); } },
      { t: 4.2, fn: function () { UI.addMsg('<b class="nAlly">何进</b>：' + findOff('何进').quote); } },
      { t: 6.5, fn: function () { UI.addMsg('<b class="nMe">' + G.player.hero.name + '</b>：' + G.player.hero.quotes.start, 'msgMe'); } },
      { t: 9, fn: function () { UI.addMsg(T.barrierHint, 'msgWarn'); } },
      {
        cond: function () { return G.time > 120 || G.player.pos.z < 40; },
        fn: function () {
          var bao = findOff('张宝');
          if (bao && !bao.dead) {
            G.sorcery = true;
            UI.setSorcery(true);
            UI.banner('妖 术', '张宝施展妖术！雷火将降于我军！', 'bannerEvil', 3000);
            UI.addMsg(T.sorceryStart, 'msgWarn');
            SFX.lightning();
            scene.fog.color.set(0x4a4258);
            scene.background.set(0x4a4258);
          }
        }
      },
      {
        t: st.ambush.time,
        fn: function () {
          var d = st.ambush;
          spawnOfficer(d);
          for (var i = 0; i < 7; i++) spawnMob(2, Math.random() < 0.5 ? 'sword' : 'spear', d.x + rand(-5, 5), d.z + rand(-5, 5));
          UI.banner('伏 兵', d.msg, 'bannerEvil', 2800);
          UI.addMsg(d.msg, 'msgWarn');
          SFX.alert();
        }
      }
    ];
    st.reinforcements.forEach(function (r) {
      G.events.push({
        t: r.time,
        fn: function () {
          var o = spawnOfficer(r);
          for (var i = 0; i < 6; i++) spawnMob(1, Math.random() < 0.3 ? 'archer' : 'sword', r.x + rand(-5, 5), r.z + rand(-5, 5));
          UI.banner('援 军', r.msg, 'bannerGood', 2800);
          UI.addMsg(r.msg, 'msgGood');
          UI.addMsg('<b class="nAlly">' + r.name + '</b>：' + r.quote);
          G.morale = Math.min(95, G.morale + 5);
          SFX.fanfare();
        }
      });
    });
  }

  function findOff(name) {
    for (var i = 0; i < G.officers.length; i++) if (G.officers[i].name === name) return G.officers[i];
    return null;
  }

  function runEvents() {
    for (var i = G.events.length - 1; i >= 0; i--) {
      var e = G.events[i];
      if ((e.t !== undefined && G.time >= e.t) || (e.cond && e.cond())) {
        G.events.splice(i, 1);
        e.fn();
      }
    }

    // 妖术落雷
    if (G.sorcery) {
      G.sorceryT -= dtWorld;
      if (G.sorceryT <= 0) {
        G.sorceryT = rand(2.4, 3.4);
        var targets = [G.player.pos];
        G.officers.forEach(function (o) { if (o.side === 1 && !o.dead && o.pos.z < 150) targets.push(o.pos); });
        var tp = targets[Math.floor(Math.random() * targets.length)];
        var lx = tp.x + rand(-8, 8), lz = tp.z + rand(-8, 8);
        var lpos = v3(lx, 0, lz);
        FX.warnRing(lpos, 1.0);
        setTimeout(function () {
          if (!G || !G.sorcery) return;
          FX.lightning(lpos);
          SFX.lightning();
          camShake = Math.max(camShake, 0.3);
          var p = G.player;
          if (!p.dead && dist2(p.pos, lpos) < 8 && p.pos.y < 1.5) {
            damagePlayer(24, Math.atan2(p.pos.x - lx, p.pos.z - lz), 'knockback');
          }
          G.officers.forEach(function (o) {
            if (o.side === 1 && !o.dead && dist2(o.pos, lpos) < 8) hurtEnt(o, 30, { react: 'flinch' });
          });
          G.mobs.forEach(function (m) {
            if (m.side === 1 && !m.dead && dist2(m.pos, lpos) < 8) hurtEnt(m, 30, { react: 'launch' });
          });
        }, 1000);
      }
      G.morale = Math.max(5, G.morale - dtWorld * 0.25);
    }

    // 结界解除
    if (!G.barrierBroken) {
      var liang = findOff('张梁'), bao = findOff('张宝');
      if (liang && bao && liang.dead && bao.dead) {
        G.barrierBroken = true;
        var jiao = findOff('张角');
        if (jiao) {
          jiao.barrier = false;
          if (jiao.barrierMesh) { jiao.model.root.remove(jiao.barrierMesh); jiao.barrierMesh = null; }
          jiao.behavior = 'guard';
          jiao.home = v3(0, 0, -200);
        }
        G.objective = '讨伐敌总大将 <b>张角</b>！';
        UI.setObjective(G.objective);
        UI.banner('结界破除', DATA.text.barrierBreak, 'bannerGood', 3200);
        UI.addMsg(DATA.text.barrierBreak, 'msgGood');
        UI.addMsg('<b class="nEnemy">张角</b>：' + jiao.quote, 'msgWarn');
        SFX.alert();
        G.morale = Math.min(95, G.morale + 10);
      }
    }

    // 何进危机提示
    var heJin = findOff('何进');
    if (heJin && !heJin.dead && heJin.hp < heJin.maxHp * 0.45 && G.time > G.heJinWarn) {
      G.heJinWarn = G.time + 25;
      UI.banner('危 机', DATA.text.heJinDanger, 'bannerEvil', 2600);
      UI.addMsg(DATA.text.heJinDanger, 'msgWarn');
      SFX.alert();
    }
  }

  /* ================= 伤害处理 ================= */
  function hurtEnt(ent, dmg, opts) {
    if (ent.dead) return false;
    opts = opts || {};

    // 张角结界
    if (ent.barrier) {
      FX.spark(v3(ent.pos.x, 1.5, ent.pos.z), 0x9944ff, 2);
      if (opts.fromPlayer && Math.random() < 0.15) UI.addMsg(DATA.text.barrierHint, 'msgWarn');
      return false;
    }

    // 武将格挡
    if (ent.kind === 'officer' && ent.state !== 'stunned' && ent.state !== 'launched' && ent.state !== 'down'
      && ent.windup <= 0 && Math.random() < (ent.boss ? 0.3 : 0.18)) {
      dmg *= 0.15;
      SFX.clang();
      FX.spark(v3(ent.pos.x, 1.3, ent.pos.z), 0xaaccff, 1.0);
      ent.hp -= dmg;
      if (ent.hp > 0) return true;
    } else {
      ent.hp -= dmg;
    }

    var react = opts.react || 'flinch';
    var heavy = react === 'knockback' || react === 'launch';

    // 强将抗性
    if (ent.kind === 'officer') {
      if (ent.boss && (react === 'launch' || react === 'knockup')) react = 'flinch';
      if (ent.strong && ent.windup > 0 && react === 'flinch' && Math.random() < 0.45) react = 'none';
    }

    if (react !== 'none') {
      ent.windup = 0;
      if (react === 'flinch') {
        ent.state = 'hitstun'; ent.stateT = 0.32;
      } else if (react === 'stun') {
        ent.state = 'stunned'; ent.stateT = 2.8;
        SFX.stun();
      } else if (react === 'launch' || react === 'knockup') {
        ent.state = 'launched';
        ent.vy = react === 'launch' ? 8 : 5.5;
        if (ent.pos.y > 0.1) ent.vy = 5.5; // 浮空追打
        var d = opts.dir !== undefined ? opts.dir : 0;
        ent.kx = Math.sin(d) * 2; ent.kz = Math.cos(d) * 2;
      } else if (react === 'knockback') {
        ent.state = 'launched';
        ent.vy = 4.5;
        var d2 = opts.dir !== undefined ? opts.dir : 0;
        var pw = opts.power || 9;
        ent.kx = Math.sin(d2) * pw; ent.kz = Math.cos(d2) * pw;
      }
    }

    // 表现
    var hitPos = v3(ent.pos.x + rand(-0.3, 0.3), ent.pos.y + 1.2, ent.pos.z + rand(-0.3, 0.3));
    FX.spark(hitPos, heavy ? 0xffaa33 : 0xffdd88, heavy ? 1.8 : 1.2);
    if (opts.fromPlayer) {
      SFX.hit(heavy);
      spawnDmgNum(hitPos, Math.round(dmg), ent.kind === 'officer' ? 'dmgBig' : '');
      var p = G.player;
      p.combo++; p.comboT = 3;
      if (p.combo > p.maxCombo) p.maxCombo = p.combo;
      if (!p.musouActive) p.musou = Math.min(100, p.musou + 1.4);
      if (p.musou >= 100 && !G.hintMusou) {
        G.hintMusou = true;
        UI.addMsg(DATA.text.musouFull, 'msgGood');
      }
      if (ent.kind === 'officer') {
        G.hitstop = Math.max(G.hitstop, heavy ? 0.09 : 0.04);
      }
    }

    if (ent.hp <= 0) killEnt(ent, opts);
    return true;
  }

  function killEnt(ent, opts) {
    ent.dead = true;
    ent.deadT = 0;
    ent.hp = 0;
    if (ent.stunFx) { ent.model.root.remove(ent.stunFx); ent.stunFx = null; }
    SFX.kill();

    var p = G.player;
    if (opts && opts.fromPlayer) {
      p.kills++;
      if (!p.musouActive) p.musou = Math.min(100, p.musou + 2.5);
      checkKillMilestones();
    }

    if (ent.kind === 'mob') {
      // 掉落
      var roll = Math.random();
      if (ent.captain) {
        if (roll < 0.7) dropItem(ent.pos, roll < 0.3 ? 'wine' : 'baozi');
      } else if (roll < 0.045) {
        dropItem(ent.pos, roll < 0.012 ? 'wine' : 'baozi');
      }
      // 据点占领
      if (ent.base && ent.base.captain === ent) captureBase(ent.base);
    } else if (ent.kind === 'officer') {
      officerDefeated(ent, opts);
    }
  }

  function officerDefeated(o, opts) {
    var T = DATA.text;
    if (o.side === 2) {
      G.morale = Math.min(95, G.morale + 6);
      if (opts && opts.fromPlayer) {
        G.player.officerKills++;
        G.slowmo = Math.max(G.slowmo, 1.1);
        UI.banner(T.officerDefeated, o.title ? o.title + ' ' + o.name : o.name, 'bannerKill', 2400);
        UI.addMsg('<b class="nMe">' + G.player.hero.name + '</b>：' + G.player.hero.quotes.kill, 'msgMe');
        SFX.fanfare();
        dropItem(o.pos, Math.random() < 0.5 ? 'wine' : 'bigbaozi');
      } else {
        UI.addMsg(T.enemyOfficerLost(o.name), 'msgGood');
        SFX.fanfare();
      }
      if (o.boss === 'bao' && G.sorcery) {
        G.sorcery = false;
        UI.setSorcery(false);
        scene.fog.color.set(0xb8c4d8);
        scene.background.set(0xb8c4d8);
        UI.addMsg(T.sorceryEnd, 'msgGood');
        G.morale = Math.min(95, G.morale + 5);
      }
      if (o.boss === 'jiao') {
        endBattle(true);
      }
    } else {
      G.morale = Math.max(5, G.morale - 6);
      UI.addMsg(T.allyOfficerLost(o.name), 'msgWarn');
      SFX.alert();
      if (o.vital) endBattle(false);
    }
  }

  function checkKillMilestones() {
    var k = G.player.kills, T = DATA.text;
    if (k === 100) { UI.banner('百人斩', T.k100, 'bannerGood', 2200); SFX.fanfare(); }
    if (k === 500) { UI.banner('五百人斩', T.k500, 'bannerGood', 2200); SFX.fanfare(); G.morale = Math.min(95, G.morale + 4); }
    if (k === 1000) {
      UI.banner('千人斩！', T.k1000, 'bannerKill', 3000);
      UI.addMsg('<b class="nMe">' + G.player.hero.name + '</b>：' + G.player.hero.quotes.k1000, 'msgMe');
      SFX.victory();
      G.morale = Math.min(95, G.morale + 6);
    }
  }

  function captureBase(base) {
    if (base.side === 1) return;
    base.side = 1;
    base.captain = null;
    base.flagMat.map = MODELS.baseFlagTex(1);
    base.flagMat.needsUpdate = true;
    G.basesTaken++;
    G.morale = Math.min(95, G.morale + 5);
    UI.banner('据点占领', DATA.text.baseTaken(base.name), 'bannerGood', 2200);
    UI.addMsg(DATA.text.baseTaken(base.name), 'msgGood');
    SFX.baseCapture();
    dropItem(v3(base.x, 0, base.z), Math.random() < 0.5 ? 'atkup' : 'defup');
  }

  /* ================= 道具 ================= */
  function dropItem(pos, type) {
    var mesh = MODELS.makeItem(type);
    mesh.position.set(pos.x + rand(-0.8, 0.8), 0, pos.z + rand(-0.8, 0.8));
    scene.add(mesh);
    G.groundItems.push({ type: type, pos: v3(mesh.position.x, 0, mesh.position.z), mesh: mesh, t: 30 });
  }

  function updateItems(dt) {
    var p = G.player;
    for (var i = G.groundItems.length - 1; i >= 0; i--) {
      var it = G.groundItems[i];
      it.t -= dt;
      it.mesh.userData.spin.rotation.y += dt * 2.5;
      it.mesh.position.y = Math.sin(G.time * 3 + i) * 0.08;
      var gone = it.t <= 0;
      if (!gone && !p.dead && dist2(p.pos, it.pos) < 1.8 && p.pos.y < 1) {
        var def = DATA.items[it.type];
        if (def.effect === 'hp') { p.hp = Math.min(p.maxHp, p.hp + def.value); SFX.pickup(); }
        else if (def.effect === 'musou') { p.musou = Math.min(100, p.musou + def.value); SFX.pickup(); }
        else if (def.effect === 'atk') { p.atkBuff = def.value; SFX.powerup(); }
        else if (def.effect === 'def') { p.defBuff = def.value; SFX.powerup(); }
        UI.addMsg('<b class="nItem">' + def.name + '</b> ' + def.msg, 'msgItem');
        gone = true;
      }
      if (gone) {
        scene.remove(it.mesh);
        disposeDeep(it.mesh);
        G.groundItems.splice(i, 1);
      }
    }
  }

  /* ================= 玩家控制 ================= */
  var dtWorld = 0;

  function playerAttackInput(type) {
    var p = G.player;
    if (p.dead || p.musouActive || p.hitstunT > 0 || p.downT > 0) return;

    if (p.riding) {
      if (!p.action) startAction(p, { type: 'mounted', move: p.moveset.mounted, t: 0, hitDone: false });
      return;
    }

    if (!p.grounded) {
      if (!p.action) {
        var mv = type === 'N' ? p.moveset.jumpAtk : p.moveset.jumpCharge;
        startAction(p, { type: type === 'N' ? 'JN' : 'JC', move: mv, t: 0, hitDone: false });
      }
      return;
    }

    if (!p.action) {
      if (type === 'N') {
        startAction(p, { type: 'N', idx: 0, move: p.moveset.chain[0], t: 0, hitDone: false });
      } else {
        startAction(p, { type: 'C', idx: 1, move: p.moveset.charges[1], t: 0, hitDone: false, hitCount: 0 });
      }
    } else {
      p.buffered = type;
    }
  }

  function startAction(p, action) {
    p.action = action;
    p.buffered = null;
    SFX.swing();
    // 移动目标吸附：朝输入方向
    var mv = getMoveInput();
    if (mv) p.facing = mv.ang;
  }

  function getMoveInput() {
    var x = 0, z = 0;
    if (keys['w']) z -= 1;
    if (keys['s']) z += 1;
    if (keys['a']) x -= 1;
    if (keys['d']) x += 1;
    if (x === 0 && z === 0) return null;
    // 相机相对
    var ang = Math.atan2(x, z) + camYaw + Math.PI;
    return { ang: normAng(ang) };
  }

  function activateMusou() {
    var p = G.player;
    if (p.dead || p.musouActive || p.musou < 100 || p.riding) return;
    p.musouActive = true;
    p.musouT = 0;
    p.trueMusou = p.hp < p.maxHp * 0.25;
    p.action = null;
    p.buffered = null;
    p.iframes = 99;
    SFX.musou();
    UI.musouCutIn(p.hero.name, p.hero.musouName + (p.trueMusou ? '・真' : ''));
    UI.setMusouActive(true, p.trueMusou);
    UI.addMsg('<b class="nMe">' + p.hero.name + '</b>：' + p.hero.quotes.musou, 'msgMe');
    camShake = 0.4;

    var aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: MODELS.glowTex, color: p.trueMusou ? 0xff5522 : 0x66aaff,
      transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    aura.scale.set(5, 5, 1);
    aura.position.y = 1.2;
    p.model.root.add(aura);
    p.musouAura = aura;
    FX.shock(p.pos, 8, p.trueMusou ? 0xff5522 : 0x66aaff);
  }

  function endMusou(p) {
    var ms = p.moveset.musou;
    p.musouActive = false;
    p.musou = 0;
    p.iframes = 0.5;
    UI.setMusouActive(false, false);
    if (p.musouAura) { p.model.root.remove(p.musouAura); p.musouAura = null; }
    // 无双终结技
    SFX.musouFin();
    camShake = 0.6;
    var fin = ms.fin;
    var mult = p.trueMusou ? 1.4 : 1;
    FX.shock(p.pos, fin.range + 2, p.trueMusou ? 0xff5522 : 0xffcc66);
    strikeArea(p.pos, p.facing, fin.range, 360, PBASE * fin.dmg * p.hero.atk * mult, 'knockback', true);
  }

  function playerDmgMult(p) {
    return p.hero.atk * (p.atkBuff > 0 ? 2 : 1);
  }

  function strikeArea(pos, facing, range, arc, dmg, react, fromPlayer) {
    var n = 0;
    var p = G.player;
    for (var i = 0; i < G.mobs.length; i++) {
      var m = G.mobs[i];
      if (m.dead || m.side === 1) continue;
      if (inArc(pos, facing, range, arc, m.pos, 0.4)) {
        var d = Math.atan2(m.pos.x - pos.x, m.pos.z - pos.z);
        hurtEnt(m, dmg * rand(0.9, 1.1), { react: react, dir: d, fromPlayer: fromPlayer });
        n++;
      }
    }
    for (var j = 0; j < G.officers.length; j++) {
      var o = G.officers[j];
      if (o.dead || o.side === 1) continue;
      if (inArc(pos, facing, range, arc, o.pos, 0.6)) {
        var d2 = Math.atan2(o.pos.x - pos.x, o.pos.z - pos.z);
        hurtEnt(o, dmg * rand(0.9, 1.1) * 0.9, { react: react, dir: d2, fromPlayer: fromPlayer });
        n++;
      }
    }
    // 罐子
    if (fromPlayer) {
      for (var k = 0; k < G.pots.length; k++) {
        var pot = G.pots[k];
        if (!pot.alive) continue;
        if (inArc(pos, facing, range, arc, pot.pos, 0.4)) {
          pot.alive = false;
          scene.remove(pot.mesh);
          disposeDeep(pot.mesh);
          FX.spark(v3(pot.pos.x, 0.6, pot.pos.z), 0xbb9966, 1.4);
          SFX.hit(false);
          var roll = Math.random();
          var type = roll < 0.4 ? 'baozi' : roll < 0.62 ? 'wine' : roll < 0.76 ? 'atkup' : roll < 0.9 ? 'defup' : 'bigbaozi';
          dropItem(pot.pos, type);
        }
      }
    }
    return n;
  }

  function updatePlayer(dt) {
    var p = G.player;
    if (p.dead) {
      p.model.body.rotation.x = Math.max(-Math.PI / 2, p.model.body.rotation.x - dt * 3);
      return;
    }

    var ms = p.moveset;
    if (p.iframes > 0 && !p.musouActive) p.iframes -= dt;
    if (p.atkBuff > 0) p.atkBuff -= dt;
    if (p.defBuff > 0) p.defBuff -= dt;

    // 连击计时
    if (p.comboT > 0) {
      p.comboT -= dt;
      if (p.comboT <= 0) p.combo = 0;
    }

    // 受击状态
    if (p.hitstunT > 0) { p.hitstunT -= dt; return; }
    if (p.downT > 0) {
      p.downT -= dt;
      p.model.body.rotation.x = -Math.PI / 2 * Math.min(1, (0.8 - p.downT) * 4);
      if (p.downT <= 0) { p.model.body.rotation.x = 0; p.iframes = 0.8; }
      // 击飞飞行
      p.pos.x += p.kx * dt; p.pos.z += p.kz * dt;
      p.kx *= 0.9; p.kz *= 0.9;
      applyWalls(p);
      syncPlayerModel(p, dt);
      return;
    }

    p.guarding = (keys['shift'] || keys['u']) && p.grounded && !p.action && !p.musouActive && !p.riding;

    /* ---- 无双乱舞 ---- */
    if (p.musouActive) {
      var mu = ms.musou;
      p.musouT += dt;
      p.musou = Math.max(0, 100 - (p.musouT / mu.dur) * 100);
      var mv2 = getMoveInput();
      if (mv2) {
        p.facing = lerpAng(p.facing, mv2.ang, dt * 6);
        var spd2 = 6.5 * p.hero.spd * 0.75;
        p.pos.x += Math.sin(p.facing) * spd2 * dt;
        p.pos.z += Math.cos(p.facing) * spd2 * dt;
      }
      // 旋转连斩
      p.model.body.rotation.y += dt * 18;
      p.model.armR.rotation.z = 1.4;
      p.model.armL.rotation.z = -1.4;
      if (!p.musouTick || G.time >= p.musouTick) {
        p.musouTick = G.time + mu.tick;
        var mult = p.trueMusou ? 1.35 : 1;
        strikeArea(p.pos, p.facing, mu.range, mu.arc, PBASE * mu.dmg * p.hero.atk * mult, 'knockup', true);
        FX.slash(p.pos, rand(-Math.PI, Math.PI), 300, mu.range, p.trueMusou ? 0xff6633 : ms.trailColor || 0x88bbff, rand(-0.3, 0.3));
        SFX.swing();
      }
      if (p.musouT >= mu.dur) {
        p.model.body.rotation.y = 0;
        p.model.armR.rotation.z = 0;
        p.model.armL.rotation.z = 0;
        endMusou(p);
      }
      applyWalls(p);
      syncPlayerModel(p, dt);
      return;
    }

    /* ---- 骑乘 ---- */
    if (p.riding) {
      updateRiding(p, dt);
      return;
    }

    /* ---- 攻击动作 ---- */
    if (p.action) {
      updatePlayerAction(p, dt);
    } else {
      // 移动
      var mv = getMoveInput();
      var spd = 6.5 * p.hero.spd * (p.guarding ? 0.35 : 1);
      if (mv && p.grounded) {
        p.facing = lerpAng(p.facing, mv.ang, dt * 10);
        p.pos.x += Math.sin(mv.ang) * spd * dt;
        p.pos.z += Math.cos(mv.ang) * spd * dt;
        p.animT += dt * (p.guarding ? 4 : 9);
      } else if (mv && !p.grounded) {
        p.facing = lerpAng(p.facing, mv.ang, dt * 4);
        p.pos.x += Math.sin(mv.ang) * spd * 0.85 * dt;
        p.pos.z += Math.cos(mv.ang) * spd * 0.85 * dt;
      } else {
        p.animT += dt * 1.2;
      }
    }

    // 重力/跳跃
    if (!p.grounded) {
      p.vy -= GRAV * dt;
      p.pos.y += p.vy * dt;
      if (p.pos.y <= 0) {
        p.pos.y = 0; p.grounded = true;
        FX.dust(p.pos);
        // 跳跃蓄力落地冲击
        if (p.action && p.action.type === 'JC' && !p.action.hitDone) {
          p.action.hitDone = true;
          var jc = ms.jumpCharge;
          FX.shock(p.pos, jc.range + 1, 0xffcc66);
          SFX.musouFin();
          camShake = 0.5;
          strikeArea(p.pos, p.facing, jc.range, 360, PBASE * jc.dmg * playerDmgMult(p), jc.react, true);
          p.action = null;
        } else if (p.action && (p.action.type === 'JN' || p.action.type === 'JC')) {
          p.action = null;
        }
      }
    }

    applyWalls(p);
    clampToWorld(p.pos);
    syncPlayerModel(p, dt);
  }

  function updatePlayerAction(p, dt) {
    var a = p.action;
    var mv = a.move;
    a.t += dt;

    // 多段判定 (C3)
    if (mv.hits) {
      var hitN = Math.min(mv.hits, Math.floor((a.t - mv.hitT) / mv.hitGap) + 1);
      while (a.t >= mv.hitT && a.hitCount < hitN) {
        a.hitCount++;
        doPlayerStrike(p, mv);
        SFX.swing();
      }
    } else if (!a.hitDone && a.t >= mv.hitT && a.type !== 'JC') {
      a.hitDone = true;
      doPlayerStrike(p, mv);
    }

    // C6/dash 向前突进
    if (mv.fx === 'dash' && a.t < mv.hitT + 0.15) {
      p.pos.x += Math.sin(p.facing) * 16 * dt;
      p.pos.z += Math.cos(p.facing) * 16 * dt;
    }
    if (mv.fx === 'spin') {
      p.model.body.rotation.y += dt * 16;
    }

    // 空中动作
    if (a.type === 'JN' || a.type === 'JC') {
      if (a.type === 'JC') { p.vy = Math.min(p.vy, -14); } // 下砸
      if (a.t >= mv.dur && a.type === 'JN') p.action = null;
      return;
    }

    if (a.t >= mv.dur) {
      p.model.body.rotation.y = 0;
      // 连段衔接
      if (a.type === 'N' && p.buffered) {
        var idx = a.idx;
        if (p.buffered === 'N' && idx < p.moveset.chain.length - 1) {
          startAction(p, { type: 'N', idx: idx + 1, move: p.moveset.chain[idx + 1], t: 0, hitDone: false });
          return;
        }
        if (p.buffered === 'C') {
          var cIdx = Math.min(idx + 2, 6);
          var cMove = p.moveset.charges[cIdx];
          if (cMove) {
            startAction(p, { type: 'C', idx: cIdx, move: cMove, t: 0, hitDone: false, hitCount: 0 });
            return;
          }
        }
      }
      p.action = null;
      p.buffered = null;
    } else if (a.type === 'N' && a.t >= mv.hitT + 0.08 && p.buffered) {
      // 提前取消进入下一段
      var idx2 = a.idx;
      if (p.buffered === 'N' && idx2 < p.moveset.chain.length - 1) {
        startAction(p, { type: 'N', idx: idx2 + 1, move: p.moveset.chain[idx2 + 1], t: 0, hitDone: false });
      } else if (p.buffered === 'C') {
        var cIdx2 = Math.min(idx2 + 2, 6);
        var cMove2 = p.moveset.charges[cIdx2];
        if (cMove2) startAction(p, { type: 'C', idx: cIdx2, move: cMove2, t: 0, hitDone: false, hitCount: 0 });
      }
    }
  }

  function doPlayerStrike(p, mv) {
    var dmg = PBASE * mv.dmg * playerDmgMult(p);
    var n = strikeArea(p.pos, p.facing, mv.range, mv.arc, dmg, mv.react, true);
    var color = p.moveset.trailColor || 0xaaccff;
    if (mv.fx === 'shockwave') {
      FX.shock(p.pos, mv.range + 1, color);
      camShake = Math.max(camShake, 0.25);
    } else if (mv.fx === 'spin') {
      FX.slash(p.pos, p.facing, 340, mv.range, color, 0.05);
      camShake = Math.max(camShake, 0.3);
    } else if (mv.fx === 'upslash') {
      FX.slash(p.pos, p.facing, mv.arc, mv.range, color, -1.2);
    } else if (mv.fx === 'dash') {
      FX.slash(p.pos, p.facing, 40, mv.range, color, 0.05);
      camShake = Math.max(camShake, 0.3);
    } else {
      FX.slash(p.pos, p.facing, mv.arc, mv.range, color, mv.swing === 'T' ? -0.4 : 0.12);
    }
    if (n === 0 && !mv.hits) SFX.swing();
  }

  /* ---- 骑乘 ---- */
  function updateRiding(p, dt) {
    var h = p.horse;
    var mv = getMoveInput();
    var spd = 0;
    if (mv) {
      h.facing = lerpAng(h.facing, mv.ang, dt * 2.8);
      spd = 13.5 * Math.max(0.85, p.hero.spd);
    }
    h.speed += (spd - h.speed) * Math.min(1, dt * 3);
    h.pos.x += Math.sin(h.facing) * h.speed * dt;
    h.pos.z += Math.cos(h.facing) * h.speed * dt;
    clampToWorld(h.pos);
    applyWalls(h);

    p.pos.copy(h.pos);
    p.facing = h.facing;

    // 骑乘攻击
    if (p.action) {
      var a = p.action;
      a.t += dt;
      if (!a.hitDone && a.t >= a.move.hitT) {
        a.hitDone = true;
        doPlayerStrike(p, a.move);
      }
      if (a.t >= a.move.dur) p.action = null;
    }

    // 冲撞践踏
    if (h.speed > 9) {
      for (var i = 0; i < G.mobs.length; i++) {
        var m = G.mobs[i];
        if (m.dead || m.side === 1 || m.pos.y > 0.5) continue;
        if (dist2(h.pos, m.pos) < 1.7) {
          var d = Math.atan2(m.pos.x - h.pos.x, m.pos.z - h.pos.z);
          hurtEnt(m, 10, { react: 'knockback', dir: d, fromPlayer: true, power: 7 });
        }
      }
    }

    h.animT += dt * (2 + h.speed * 0.75);
    syncHorse(p, dt);
    syncPlayerModel(p, dt);
  }

  function toggleHorse() {
    var p = G.player;
    if (p.dead || p.musouActive) return;
    var h = p.horse;
    if (p.riding) {
      p.riding = false;
      p.pos.y = 0;
      p.grounded = true;
      var off = p.facing + Math.PI / 2;
      p.pos.x += Math.sin(off) * 1.4;
      p.pos.z += Math.cos(off) * 1.4;
      h.coming = false;
      return;
    }
    if (dist2(p.pos, h.pos) < 25) {
      p.riding = true;
      p.action = null;
      h.coming = false;
    } else {
      h.coming = true;
      UI.addMsg('<b class="nMe">' + p.hero.name + '</b>：' + p.hero.quotes.horse, 'msgMe');
    }
  }

  function updateHorse(dt) {
    var p = G.player;
    var h = p.horse;
    if (p.riding) return;
    if (h.coming) {
      var d = Math.sqrt(dist2(h.pos, p.pos));
      if (d > 3.2) {
        var ang = Math.atan2(p.pos.x - h.pos.x, p.pos.z - h.pos.z);
        h.facing = lerpAng(h.facing, ang, dt * 3);
        h.speed = 14;
        h.pos.x += Math.sin(h.facing) * h.speed * dt;
        h.pos.z += Math.cos(h.facing) * h.speed * dt;
        h.animT += dt * (2 + h.speed * 0.75);
      } else {
        h.coming = false;
        h.speed = 0;
      }
    } else h.speed = 0;
    syncHorse(p, dt);
  }

  function syncHorse(p, dt) {
    var h = p.horse;
    var m = h.model;
    m.root.position.copy(h.pos);
    m.root.rotation.y = h.facing;
    var g = h.animT;
    for (var i = 0; i < 4; i++) {
      m.legs[i].rotation.x = Math.sin(g * 2 + (i % 2) * Math.PI + (i < 2 ? 0.5 : 0)) * Math.min(0.7, h.speed * 0.06 + 0.02);
    }
    m.body.position.y = Math.abs(Math.sin(g * 2)) * Math.min(0.12, h.speed * 0.012);
  }

  function syncPlayerModel(p, dt) {
    var mdl = p.model;
    mdl.root.position.copy(p.pos);
    if (p.riding) {
      mdl.root.position.y = p.pos.y + 1.35;
      mdl.root.rotation.y = p.facing;
      mdl.legL.rotation.x = -1.1; mdl.legR.rotation.x = -1.1;
      mdl.legL.rotation.z = 0.5; mdl.legR.rotation.z = -0.5;
      if (!p.action) {
        mdl.armL.rotation.x = -0.5;
        mdl.armR.rotation.x = -0.3;
      }
    } else {
      mdl.root.rotation.y = p.facing;
      mdl.legL.rotation.z = 0; mdl.legR.rotation.z = 0;
      animateLimbs(p, mdl, dt);
    }

    // 攻击动作手臂表现
    if (p.action && p.action.move) {
      var a = p.action, mv = a.move;
      var k = Math.min(1, a.t / mv.dur);
      var wind = mv.hitT / mv.dur;
      if (k < wind) {
        var kk = k / wind;
        mdl.armR.rotation.x = -0.4 - kk * 2.2;
        mdl.body.rotation.y = (mv.swing === 'L' ? 0.45 : -0.45) * kk * (mv.fx === 'spin' ? 0 : 1);
      } else {
        var kk2 = (k - wind) / (1 - wind);
        mdl.armR.rotation.x = -2.6 + kk2 * 3.2;
        if (mv.fx !== 'spin') mdl.body.rotation.y = (mv.swing === 'L' ? -0.35 : 0.35) * (1 - kk2);
      }
    } else if (!p.riding && !p.musouActive) {
      if (Math.abs(mdl.body.rotation.y) > 0.01) mdl.body.rotation.y *= 0.8;
    }

    // 防御姿态
    if (p.guarding) {
      mdl.armL.rotation.x = -1.5;
      mdl.armR.rotation.x = -1.2;
    }
  }

  function animateLimbs(ent, mdl, dt) {
    var g = ent.animT;
    var moving = ent.kind === 'player' ? !!getMoveInput() && !ent.action : (ent.state === 'chase' || ent.state === 'advance');
    var amp = moving ? 0.65 : 0.04;
    mdl.legL.rotation.x = Math.sin(g) * amp;
    mdl.legR.rotation.x = Math.sin(g + Math.PI) * amp;
    if (!ent.action && !(ent.windup > 0)) {
      mdl.armL.rotation.x = Math.sin(g + Math.PI) * amp * 0.6;
      mdl.armR.rotation.x = Math.sin(g) * amp * 0.6;
    }
  }

  function damagePlayer(dmg, dir, react) {
    var p = G.player;
    if (p.dead || p.iframes > 0 || p.musouActive) return;

    // 防御判定（正面180°）
    if (p.guarding && Math.abs(normAng(dir + Math.PI - p.facing)) < Math.PI / 2) {
      SFX.guard();
      FX.spark(v3(p.pos.x + Math.sin(p.facing), 1.2, p.pos.z + Math.cos(p.facing)), 0xaaccff, 1);
      p.pos.x += Math.sin(dir) * 0.3;
      p.pos.z += Math.cos(dir) * 0.3;
      return;
    }

    dmg *= (p.defBuff > 0 ? 0.5 : 1) / p.hero.def;
    p.hp -= dmg;
    p.musou = Math.min(100, p.musou + dmg * 0.45);
    SFX.hurt();
    camShake = Math.max(camShake, 0.25);
    FX.spark(v3(p.pos.x, 1.3, p.pos.z), 0xff4444, 1.4);
    p.combo = 0;

    if (p.riding && react === 'knockback') {
      toggleHorse(); // 击落下马
    }

    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      endBattle(false);
      return;
    }

    if (react === 'knockback') {
      p.downT = 0.8;
      p.kx = Math.sin(dir) * 8;
      p.kz = Math.cos(dir) * 8;
      p.action = null;
    } else {
      p.hitstunT = 0.3;
      if (Math.random() < 0.3) UI.addMsg('<b class="nMe">' + p.hero.name + '</b>：' + p.hero.quotes.hurt, 'msgMe');
    }

    if (p.hp < p.maxHp * 0.25 && G.time > G.hintDanger) {
      G.hintDanger = G.time + 30;
      UI.addMsg(DATA.text.playerDanger, 'msgWarn');
      SFX.alert();
    }
  }

  /* ================= 兵卒AI ================= */
  function updateMob(m, dt) {
    var mdl = m.model;
    if (m.dead) {
      m.deadT += dt;
      mdl.body.rotation.x = -Math.PI / 2 * Math.min(1, m.deadT * 4);
      if (m.pos.y > 0) {
        m.pos.y = Math.max(0, m.pos.y - dt * 9);
        mdl.root.position.y = m.pos.y;
      } else if (m.deadT > 1.2) {
        mdl.root.position.y = -(m.deadT - 1.2) * 1.2;
      }
      if (m.deadT > 2) m.gone = true;
      return;
    }

    // 硬直/浮空/倒地
    if (m.state === 'hitstun' || m.state === 'stunned') {
      m.stateT -= dt;
      if (m.state === 'stunned') {
        addStunFx(m);
        mdl.body.rotation.z = Math.sin(G.time * 10) * 0.12;
      }
      if (m.stateT <= 0) {
        removeStunFx(m);
        mdl.body.rotation.z = 0;
        m.state = 'idle';
      }
      syncEnt(m);
      return;
    }
    if (m.state === 'launched') {
      m.vy -= GRAV * dt;
      m.pos.y += m.vy * dt;
      m.pos.x += m.kx * dt;
      m.pos.z += m.kz * dt;
      m.kx *= 0.98; m.kz *= 0.98;
      mdl.body.rotation.x = Math.max(-1.9, mdl.body.rotation.x - dt * 5);
      if (m.pos.y <= 0) {
        m.pos.y = 0;
        m.state = 'down';
        m.stateT = rand(0.6, 1.0);
        FX.dust(m.pos);
      }
      syncEnt(m);
      return;
    }
    if (m.state === 'down') {
      m.stateT -= dt;
      if (m.stateT <= 0) {
        m.state = 'idle';
        mdl.body.rotation.x = 0;
      }
      syncEnt(m);
      return;
    }
    mdl.body.rotation.x = 0;

    // 索敌
    m.retargetT -= dt;
    if (m.retargetT <= 0) {
      m.retargetT = 0.55 + Math.random() * 0.3;
      m.target = findTargetFor(m, m.typeName === 'archer' ? 30 : 26);
    }

    var p = G.player;
    m.cd -= dt;

    if (m.windup > 0) {
      m.windup -= dt;
      mdl.armR.rotation.x = -2.4;
      if (m.windup <= 0) {
        mdl.armR.rotation.x = 0.6;
        // 出手
        var t = m.target;
        if (t && !isDeadEnt(t)) {
          var tp = t.kind === 'player' ? t.pos : t.pos;
          if (inArc(m.pos, m.facing, m.range + 0.7, 120, tp, 0.4)) {
            var moraleFac = m.side === 2 ? (1.15 - G.morale * 0.005) : (0.85 + G.morale * 0.005);
            var dmg = m.atk * moraleFac;
            var dir = Math.atan2(tp.x - m.pos.x, tp.z - m.pos.z);
            if (t.kind === 'player') damagePlayer(dmg, dir, 'flinch');
            else hurtEnt(t, dmg * (t.kind === 'officer' ? 0.5 : 1.6), { react: 'none', dir: dir });
          }
        }
        m.cd = rand(1.3, 2.2);
      }
      syncEnt(m);
      return;
    }

    if (m.target && !isDeadEnt(m.target)) {
      var tp2 = m.target.pos;
      var d = Math.sqrt(dist2(m.pos, tp2));
      var ang = Math.atan2(tp2.x - m.pos.x, tp2.z - m.pos.z);
      m.facing = lerpAng(m.facing, ang, dt * 6);

      if (m.typeName === 'archer') {
        if (d < 8) { // 后撤
          m.pos.x -= Math.sin(ang) * m.spd * 0.7 * dt;
          m.pos.z -= Math.cos(ang) * m.spd * 0.7 * dt;
          m.animT += dt * 7;
          m.state = 'chase';
        } else if (d < 26 && m.cd <= 0) {
          m.cd = rand(2.6, 3.6);
          shootArrow(m, tp2);
        } else if (d > 26) {
          moveEnt(m, ang, m.spd, dt);
        } else { m.state = 'idle'; }
      } else {
        if (d > m.range) {
          moveEnt(m, ang, m.spd, dt);
        } else {
          m.state = 'idle';
          if (m.cd <= 0) m.windup = 0.45;
        }
      }
    } else {
      // 无目标：向敌阵推进
      m.state = 'advance';
      var goal = m.side === 2 ? v3(0, 0, 238) : v3(0, 0, -238);
      if (m.base && m.captain) { m.state = 'idle'; } // 兵长驻守
      else {
        var ang2 = Math.atan2(goal.x - m.pos.x, goal.z - m.pos.z);
        m.facing = lerpAng(m.facing, ang2 + Math.sin(m.animT * 0.3) * 0.4, dt * 2);
        moveEnt(m, m.facing, m.spd * 0.55, dt);
      }
    }

    syncEnt(m);
    animateLimbs(m, mdl, dt);
  }

  function moveEnt(m, ang, spd, dt) {
    m.pos.x += Math.sin(ang) * spd * dt;
    m.pos.z += Math.cos(ang) * spd * dt;
    m.animT += dt * 8;
    m.state = 'chase';
    clampToWorld(m.pos);
  }

  function isDeadEnt(e) { return e.kind === 'player' ? e.dead : e.dead; }

  function findTargetFor(m, maxD) {
    var best = null, bestD = maxD * maxD;
    var p = G.player;
    if (m.side === 2 && !p.dead) {
      var dp = dist2(m.pos, p.pos);
      if (dp < bestD * 1.2) { best = p; bestD = dp; }
    }
    for (var i = 0; i < G.officers.length; i++) {
      var o = G.officers[i];
      if (o.dead || o.side === m.side) continue;
      var d = dist2(m.pos, o.pos);
      if (d < bestD) { best = o; bestD = d; }
    }
    // 采样部分小兵防止O(n²)全扫
    var step = G.mobs.length > 40 ? 3 : 1;
    for (var j = (Math.random() * step) | 0; j < G.mobs.length; j += step) {
      var mm = G.mobs[j];
      if (mm.dead || mm.side === m.side) continue;
      var d2 = dist2(m.pos, mm.pos);
      if (d2 < bestD) { best = mm; bestD = d2; }
    }
    return best;
  }

  function shootArrow(m, tp) {
    SFX.arrowShot();
    var mesh = MODELS.makeArrow();
    var dir = Math.atan2(tp.x - m.pos.x, tp.z - m.pos.z);
    mesh.position.set(m.pos.x, 1.4, m.pos.z);
    mesh.rotation.y = dir;
    scene.add(mesh);
    G.projectiles.push({
      kind: 'arrow', side: m.side, mesh: mesh,
      pos: v3(m.pos.x, 1.4, m.pos.z),
      vx: Math.sin(dir) * 24, vz: Math.cos(dir) * 24,
      dmg: m.atk, t: 2.2
    });
  }

  function shootFireball(o, tp) {
    var g = new THREE.Group();
    var ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6622 }));
    g.add(ball);
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: MODELS.glowTex, color: 0xff8833, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(2, 2, 1);
    g.add(glow);
    var dir = Math.atan2(tp.x - o.pos.x, tp.z - o.pos.z);
    g.position.set(o.pos.x + Math.sin(dir) * 1.5, 1.6, o.pos.z + Math.cos(dir) * 1.5);
    scene.add(g);
    G.projectiles.push({
      kind: 'fire', side: o.side, mesh: g,
      pos: v3(g.position.x, 1.6, g.position.z),
      vx: Math.sin(dir) * 13, vz: Math.cos(dir) * 13,
      dmg: 22, t: 3
    });
    SFX.musou();
  }

  function updateProjectiles(dt) {
    var p = G.player;
    for (var i = G.projectiles.length - 1; i >= 0; i--) {
      var pr = G.projectiles[i];
      pr.t -= dt;
      pr.pos.x += pr.vx * dt;
      pr.pos.z += pr.vz * dt;
      pr.mesh.position.set(pr.pos.x, pr.pos.y, pr.pos.z);
      var hit = false;

      if (pr.side === 2) {
        if (!p.dead && p.pos.y < 1.6 && dist2(pr.pos, p.pos) < (pr.kind === 'fire' ? 1.6 : 0.9)) {
          damagePlayer(pr.dmg, Math.atan2(pr.vx, pr.vz), pr.kind === 'fire' ? 'knockback' : 'flinch');
          hit = true;
        }
        if (!hit) {
          for (var j = 0; j < G.officers.length; j++) {
            var o = G.officers[j];
            if (o.dead || o.side === 2) continue;
            if (dist2(pr.pos, o.pos) < 1.2) {
              hurtEnt(o, pr.dmg * 0.6, { react: 'none' });
              hit = true; break;
            }
          }
        }
      } else {
        for (var k = 0; k < G.mobs.length; k++) {
          var mm = G.mobs[k];
          if (mm.dead || mm.side === 1 || mm.pos.y > 1.5) continue;
          if (dist2(pr.pos, mm.pos) < 0.9) {
            hurtEnt(mm, pr.dmg * 1.5, { react: 'flinch' });
            hit = true; break;
          }
        }
      }

      if (hit && pr.kind === 'fire') {
        FX.spark(pr.pos, 0xff7733, 2.2);
        FX.shock(v3(pr.pos.x, 0, pr.pos.z), 3, 0xff7733);
      }

      if (hit || pr.t <= 0) {
        scene.remove(pr.mesh);
        disposeDeep(pr.mesh);
        G.projectiles.splice(i, 1);
      }
    }
  }

  /* ================= 武将AI ================= */
  function updateOfficer(o, dt) {
    var mdl = o.model;
    if (o.dead) {
      o.deadT += dt;
      mdl.body.rotation.x = -Math.PI / 2 * Math.min(1, o.deadT * 3);
      if (o.pos.y > 0) {
        o.pos.y = Math.max(0, o.pos.y - dt * 9);
        mdl.root.position.y = o.pos.y;
      } else if (o.deadT > 1.6) {
        mdl.root.position.y = -(o.deadT - 1.6);
      }
      return;
    }

    if (o.hpBar) o.hpBar.userData.fg.scale.x = 1.6 * Math.max(0, o.hp / o.maxHp);

    // 状态处理
    if (o.state === 'hitstun' || o.state === 'stunned') {
      o.stateT -= dt;
      if (o.state === 'stunned') addStunFx(o);
      if (o.stateT <= 0) { removeStunFx(o); o.state = 'idle'; }
      syncEnt(o);
      return;
    }
    if (o.state === 'launched') {
      o.vy -= GRAV * dt;
      o.pos.y += o.vy * dt;
      o.pos.x += o.kx * dt; o.pos.z += o.kz * dt;
      o.kx *= 0.97; o.kz *= 0.97;
      mdl.body.rotation.x = Math.max(-1.6, mdl.body.rotation.x - dt * 4);
      if (o.pos.y <= 0) {
        o.pos.y = 0;
        o.state = 'down';
        o.stateT = 0.7;
        FX.dust(o.pos);
      }
      syncEnt(o);
      return;
    }
    if (o.state === 'down') {
      o.stateT -= dt;
      if (o.stateT <= 0) { o.state = 'idle'; mdl.body.rotation.x = 0; }
      syncEnt(o);
      return;
    }
    mdl.body.rotation.x = 0;

    // 结界演出
    if (o.barrierMesh) {
      o.barrierMesh.material.opacity = 0.18 + Math.sin(G.time * 2.5) * 0.07;
      o.barrierMesh.rotation.y += dt * 0.5;
    }

    o.cd -= dt;
    o.castCd -= dt;

    // 索敌
    o.retargetT -= dt;
    if (o.retargetT <= 0) {
      o.retargetT = 0.6;
      var maxD = o.behavior === 'camp' ? 14 : 16;
      o.target = findTargetFor(o, maxD);
      // 进击型武将远征
      if (!o.target && o.behavior === 'advance') o.farGoal = true;
    }

    var p = G.player;

    // 出手中
    if (o.windup > 0) {
      o.windup -= dt;
      mdl.armR.rotation.x = -2.6;
      var t = o.target;
      if (t) {
        var ang0 = Math.atan2(t.pos.x - o.pos.x, t.pos.z - o.pos.z);
        o.facing = lerpAng(o.facing, ang0, dt * 3);
      }
      if (o.windup <= 0) {
        mdl.armR.rotation.x = 0.8;
        var heavy = o.heavyNext;
        o.heavyNext = false;
        var range = heavy ? 4.2 : 3.2;
        var arc = heavy ? 200 : 130;
        FX.slash(o.pos, o.facing, arc, range, o.side === 1 ? 0x88bbff : 0xffbb66, 0.1);
        SFX.swing();
        if (heavy) camShake = Math.max(camShake, dist2(o.pos, p.pos) < 400 ? 0.2 : 0);
        var dmgBase = 13 * o.atk * (heavy ? 1.6 : 1);
        // 对玩家
        if (o.side === 2 && !p.dead && inArc(o.pos, o.facing, range, arc, p.pos, 0.4)) {
          damagePlayer(dmgBase, Math.atan2(p.pos.x - o.pos.x, p.pos.z - o.pos.z), heavy ? 'knockback' : 'flinch');
        }
        // 对小兵
        for (var i = 0; i < G.mobs.length; i++) {
          var m = G.mobs[i];
          if (m.dead || m.side === o.side) continue;
          if (inArc(o.pos, o.facing, range, arc, m.pos, 0.4)) {
            var d = Math.atan2(m.pos.x - o.pos.x, m.pos.z - o.pos.z);
            hurtEnt(m, dmgBase * 2.2, { react: heavy ? 'knockback' : 'flinch', dir: d });
          }
        }
        // 对武将
        for (var j = 0; j < G.officers.length; j++) {
          var oo = G.officers[j];
          if (oo.dead || oo.side === o.side) continue;
          if (inArc(o.pos, o.facing, range, arc, oo.pos, 0.5)) {
            var d2 = Math.atan2(oo.pos.x - o.pos.x, oo.pos.z - o.pos.z);
            hurtEnt(oo, dmgBase * 0.55, { react: heavy ? 'flinch' : 'none', dir: d2 });
          }
        }
        o.cd = rand(1.2, 2.0) * (o.boss ? 0.75 : 1);
      }
      syncEnt(o);
      return;
    }

    if (o.target && !isDeadEnt(o.target)) {
      var tp = o.target.pos;
      var dd = Math.sqrt(dist2(o.pos, tp));
      var ang = Math.atan2(tp.x - o.pos.x, tp.z - o.pos.z);

      // 法师远程
      if (o.sorcerer && !o.barrier && o.castCd <= 0 && dd > 6 && dd < 24 && o.target.kind === 'player') {
        o.castCd = rand(3.5, 5);
        shootFireball(o, tp);
        syncEnt(o);
        return;
      }

      if (dd > 2.9) {
        o.facing = lerpAng(o.facing, ang, dt * 5);
        var spd = 3.8 * (o.boss ? 1.1 : 1);
        o.pos.x += Math.sin(o.facing) * spd * dt;
        o.pos.z += Math.cos(o.facing) * spd * dt;
        o.animT += dt * 8;
        o.state = 'chase';
      } else {
        o.state = 'idle';
        o.facing = lerpAng(o.facing, ang, dt * 6);
        if (o.cd <= 0) {
          o.heavyNext = Math.random() < (o.boss ? 0.4 : 0.25);
          o.windup = o.heavyNext ? 0.7 : 0.5;
        }
      }
    } else {
      // 行为模式移动
      var goal = null;
      if (o.behavior === 'advance') {
        // 找最近的敌方武将或敌本阵
        var bestD = 1e9;
        for (var q = 0; q < G.officers.length; q++) {
          var eo = G.officers[q];
          if (eo.dead || eo.side === o.side || eo.barrier) continue;
          var dq = dist2(o.pos, eo.pos);
          if (dq < bestD) { bestD = dq; goal = eo.pos; }
        }
        if (!goal) goal = o.side === 1 ? v3(0, 0, -200) : v3(0, 0, 238);
      } else if (o.behavior === 'guard' || o.behavior === 'camp') {
        if (dist2(o.pos, o.home) > 16) goal = o.home;
      }
      if (goal) {
        var ang2 = Math.atan2(goal.x - o.pos.x, goal.z - o.pos.z);
        o.facing = lerpAng(o.facing, ang2, dt * 3);
        var spd2 = o.behavior === 'advance' ? 2.6 : 3.4;
        o.pos.x += Math.sin(o.facing) * spd2 * dt;
        o.pos.z += Math.cos(o.facing) * spd2 * dt;
        o.animT += dt * 7;
        o.state = 'chase';
      } else {
        o.state = 'idle';
        o.animT += dt;
      }
    }

    clampToWorld(o.pos);
    syncEnt(o);
    animateLimbs(o, mdl, dt);

    // 名牌可视距离
    var showLbl = dist2(o.pos, p.pos) < 4900;
    if (o.label) o.label.visible = showLbl;
    if (o.hpBar) o.hpBar.visible = showLbl && o.hp < o.maxHp;
  }

  function addStunFx(e) {
    if (e.stunFx) return;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: MODELS.ringTex, color: 0xffee66, transparent: true, opacity: 0.9, depthTest: false
    }));
    sp.scale.set(1.3, 1.3, 1);
    sp.position.y = 2.2;
    e.model.root.add(sp);
    e.stunFx = sp;
  }
  function removeStunFx(e) {
    if (e.stunFx) { e.model.root.remove(e.stunFx); e.stunFx = null; }
  }

  function syncEnt(e) {
    e.model.root.position.set(e.pos.x, e.pos.y, e.pos.z);
    e.model.root.rotation.y = e.facing;
  }

  /* ================= 据点刷兵 ================= */
  function updateBases(dt) {
    for (var i = 0; i < G.bases.length; i++) {
      var b = G.bases[i];
      b.spawnT -= dt;
      if (b.spawnT > 0) continue;
      b.spawnT = b.main ? rand(6, 9) : rand(7, 11);
      var cap = b.side === 2 ? 52 : 24;
      if (countMobs(b.side) >= cap) continue;
      var n = b.main ? 5 : 4;
      for (var j = 0; j < n; j++) {
        var t = Math.random() < 0.18 ? 'archer' : (Math.random() < 0.5 ? 'sword' : 'spear');
        spawnMob(b.side, t, b.x + rand(-5, 5), b.z + rand(-5, 5));
      }
    }
  }

  /* ================= 分离 & 围墙 ================= */
  function separation() {
    // 简易网格分离（每帧只处理一部分）
    var all = G.mobs;
    for (var i = 0; i < all.length; i++) {
      var a = all[i];
      if (a.dead || a.pos.y > 0.2) continue;
      for (var j = i + 1; j < Math.min(all.length, i + 6); j++) {
        var b = all[j];
        if (b.dead || b.pos.y > 0.2) continue;
        var dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        var d2 = dx * dx + dz * dz;
        if (d2 < 0.81 && d2 > 0.0001) {
          var d = Math.sqrt(d2);
          var push = (0.9 - d) * 0.5 / d;
          a.pos.x -= dx * push; a.pos.z -= dz * push;
          b.pos.x += dx * push; b.pos.z += dz * push;
        }
      }
    }
    // 玩家推开小兵
    var p = G.player;
    if (!p.dead) {
      for (var k = 0; k < all.length; k++) {
        var m = all[k];
        if (m.dead || m.pos.y > 0.2) continue;
        var dx2 = m.pos.x - p.pos.x, dz2 = m.pos.z - p.pos.z;
        var dd2 = dx2 * dx2 + dz2 * dz2;
        if (dd2 < 0.64 && dd2 > 0.0001) {
          var dd = Math.sqrt(dd2);
          var push2 = (0.8 - dd) / dd;
          m.pos.x += dx2 * push2; m.pos.z += dz2 * push2;
        }
      }
    }
  }

  function applyWalls(e) {
    // 据点围墙（留门）
    for (var i = 0; i < G.bases.length; i++) {
      var b = G.bases[i];
      var hw = (b.main ? 26 : 17) / 2;
      var dx = e.pos.x - b.x, dz = e.pos.z - b.z;
      if (Math.abs(dx) > hw + 0.6 || Math.abs(dz) > hw + 0.6) continue;
      // 门在南北中央 |dx|<2.5
      var inGateCol = Math.abs(dx) < 2.5;
      // 距墙内外判断：把实体推离最近的墙线
      var dIn = Math.min(hw - Math.abs(dx), hw - Math.abs(dz));
      if (Math.abs(Math.abs(dz) - hw) < 0.6 && !inGateCol && Math.abs(dx) < hw + 0.6) {
        e.pos.z = b.z + (dz > 0 ? 1 : -1) * (Math.abs(dz) > hw ? hw + 0.6 : hw - 0.6);
      }
      if (Math.abs(Math.abs(dx) - hw) < 0.6 && Math.abs(dz) < hw + 0.6) {
        e.pos.x = b.x + (dx > 0 ? 1 : -1) * (Math.abs(dx) > hw ? hw + 0.6 : hw - 0.6);
      }
    }
  }

  function clampToWorld(pos) {
    var half = DATA.stage.size / 2 - 2;
    pos.x = Math.max(-half, Math.min(half, pos.x));
    pos.z = Math.max(-half, Math.min(half, pos.z));
  }

  /* ================= 伤害数字 ================= */
  var projV = new THREE.Vector3();
  function spawnDmgNum(worldPos, dmg, cls) {
    projV.copy(worldPos).project(camera);
    if (projV.z > 1) return;
    var sx = (projV.x * 0.5 + 0.5) * window.innerWidth;
    var sy = (-projV.y * 0.5 + 0.5) * window.innerHeight;
    UI.spawnDmg(sx, sy, dmg, cls);
  }

  /* ================= 相机 ================= */
  function updateCamera(dt) {
    var p = G.player;
    if (keys['q']) camYaw += dt * 2.4;
    if (keys['e']) camYaw -= dt * 2.4;

    var dist = p.riding ? 11 : 8.5;
    var height = p.riding ? 5.2 : 4.3;
    var tx = p.pos.x - Math.sin(camYaw) * dist;
    var tz = p.pos.z - Math.cos(camYaw) * dist;
    var ty = p.pos.y + height;

    camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (ty - camera.position.y) * Math.min(1, dt * 6);
    camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 6);

    if (camShake > 0) {
      camShake -= dt * 1.6;
      camera.position.x += rand(-1, 1) * camShake * 0.4;
      camera.position.y += rand(-1, 1) * camShake * 0.4;
    }

    camera.lookAt(p.pos.x, p.pos.y + 1.8, p.pos.z);
  }

  /* ================= 交战武将血条 ================= */
  function updateTargetBar() {
    var p = G.player;
    var best = null, bestD = 20 * 20;
    for (var i = 0; i < G.officers.length; i++) {
      var o = G.officers[i];
      if (o.dead || o.side === 1) continue;
      var d = dist2(p.pos, o.pos);
      if (d < bestD) { best = o; bestD = d; }
    }
    if (best) {
      UI.showTarget(best.name, best.title, Math.max(0, best.hp / best.maxHp), !!best.boss);
      if (!best.quoted) {
        best.quoted = true;
        UI.addMsg('<b class="nEnemy">' + best.name + '</b>：' + best.quote, 'msgEnemy');
      }
    } else UI.hideTarget();

    // 张角总大将血条
    var jiao = findOff('张角');
    if (jiao && !jiao.dead && G.barrierBroken) {
      UI.showBoss('天公将军 张角', jiao.hp / jiao.maxHp);
    } else UI.hideBoss();
  }

  /* ================= 胜负 ================= */
  function endBattle(win) {
    if (G.win !== null) return;
    G.win = win;
    G.overT = 0;
    G.slowmo = 2.2;
    APP.state = 'over';
    if (win) {
      UI.banner('敌总大将讨取', '天公将军 张角 已被讨取！！', 'bannerKill', 3500);
      SFX.victory();
    } else {
      UI.banner('败 北', G.player.dead ? '' : '总大将何进阵亡……', 'bannerEvil', 3500);
      SFX.defeat();
      if (!G.player.dead) { /* 何进阵亡 */ }
    }
    SFX.stopBGM();
  }

  /* ================= 主循环 ================= */
  var rafId = null;
  function loop() {
    rafId = requestAnimationFrame(loop);
    var rawDt = Math.min(0.05, clock.getDelta());

    if (APP.state === 'paused') {
      renderer.render(scene, camera);
      return;
    }
    if (APP.state !== 'battle' && APP.state !== 'over') {
      renderer.render(scene, camera);
      return;
    }

    // 时间缩放
    var scale = 1;
    if (G.hitstop > 0) { G.hitstop -= rawDt; scale = 0.06; }
    else if (G.slowmo > 0) { G.slowmo -= rawDt; scale = 0.28; }
    dtWorld = rawDt * scale;

    if (APP.state === 'battle') {
      G.time += dtWorld;
      G.timeLeft -= dtWorld;
      if (G.timeLeft <= 0) endBattle(false);
      runEvents();
      updateBases(dtWorld);
    }

    updatePlayer(dtWorld);
    updateHorse(dtWorld);

    for (var i = G.mobs.length - 1; i >= 0; i--) {
      var m = G.mobs[i];
      updateMob(m, dtWorld);
      if (m.gone) {
        scene.remove(m.model.root);
        disposeDeep(m.model.root);
        G.mobs.splice(i, 1);
      }
    }
    for (var j = G.officers.length - 1; j >= 0; j--) {
      updateOfficer(G.officers[j], dtWorld);
    }

    separation();
    updateProjectiles(dtWorld);
    updateItems(dtWorld);
    FX.update(dtWorld);
    updateCamera(rawDt);

    // HUD
    var p = G.player;
    UI.updateHUD(p, G);
    UI.setCombo(p.combo, p.comboT / 3);
    UI.updateDmg(rawDt);
    UI.drawMinimap(G);
    updateTargetBar();
    UI.setLowHp(p.hp < p.maxHp * 0.25 && !p.dead);

    // 结束流程
    if (APP.state === 'over') {
      G.overT += rawDt;
      if (G.overT > 3.2) {
        APP.state = 'result';
        UI.showResult(G.win, p, G);
        if (G.win) UI.addMsg('<b class="nMe">' + p.hero.name + '</b>：' + p.hero.quotes.win, 'msgMe');
      }
    }

    renderer.render(scene, camera);
  }

  /* ================= 输入 ================= */
  function bindInput() {
    document.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      keys[k] = true;

      if (APP.state === 'title' && (k === 'enter' || k === ' ')) {
        SFX.init(); SFX.select();
        gotoSelect();
        return;
      }
      if (APP.state === 'result' && k === 'enter') {
        location.reload();
        return;
      }
      if (APP.state !== 'battle' && APP.state !== 'paused') return;

      if (e.repeat) return;
      if (k === 'escape') {
        if (APP.state === 'battle') { APP.state = 'paused'; UI.showPause(G); }
        else { APP.state = 'battle'; UI.hide('screenPause'); }
        return;
      }
      if (k === 'm') { SFX.toggleBGM(); UI.addMsg('音乐：' + (SFX.bgmIsOn() ? '开' : '关')); return; }
      if (APP.state !== 'battle') return;
      switch (k) {
        case 'j': playerAttackInput('N'); break;
        case 'k': playerAttackInput('C'); break;
        case 'l': activateMusou(); break;
        case ' ':
          e.preventDefault();
          var p = G.player;
          if (p.riding) { toggleHorse(); }
          else if (p.grounded && !p.action && !p.musouActive && p.hitstunT <= 0 && p.downT <= 0 && !p.dead) {
            p.vy = 9.2; p.grounded = false; SFX.jump();
          }
          break;
        case 'r': toggleHorse(); break;
      }
    });
    document.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

    // 鼠标：左键普攻 右键蓄力
    canvas = document.getElementById('game');
    canvas.addEventListener('mousedown', function (e) {
      if (APP.state !== 'battle') return;
      if (e.button === 0) playerAttackInput('N');
      if (e.button === 2) playerAttackInput('C');
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('blur', function () { keys = {}; });
  }

  /* ================= 流程 ================= */
  function gotoSelect() {
    UI.hide('screenTitle');
    UI.show('screenSelect');
    UI.buildHeroCards(function (hero) {
      UI.hide('screenSelect');
      UI.showIntro(function () {
        startBattle(hero);
      });
    });
  }

  function startBattle(hero) {
    newGame(hero);
    UI.setPlayerName(hero);
    UI.setObjective(G.objective);
    UI.show('hudTop');
    document.getElementById('hudBottom').style.display = '';
    APP.state = 'battle';
    SFX.init();
    SFX.startBGM();
    UI.addMsg('<b class="nMe">' + hero.name + '</b>：' + hero.quotes.select, 'msgMe');
  }

  function boot() {
    UI.init();
    initThree();
    bindInput();
    UI.hide('hudTop');
    document.getElementById('hudBottom').style.display = 'none';
    UI.hide('screenSelect');
    UI.hide('screenIntro');
    UI.hide('screenResult');
    UI.hide('screenPause');
    document.getElementById('bannerWrap').style.display = 'none';
    UI.hideTarget();
    UI.hideBoss();
    UI.setSorcery(false);
    document.getElementById('musouCut').style.display = 'none';
    // 标题演示场景：旋转的战场
    MODELS.buildTerrain(scene, DATA.stage);
    var demoT = 0;
    (function demoSpin() {
      if (APP.state !== 'title' && APP.state !== 'select' && APP.state !== 'intro') return;
      demoT += 0.016;
      camera.position.set(Math.sin(demoT * 0.08) * 120, 55, Math.cos(demoT * 0.08) * 120);
      camera.lookAt(0, 0, 0);
      requestAnimationFrame(demoSpin);
    })();
    document.getElementById('screenTitle').addEventListener('click', function () {
      if (APP.state === 'title') { SFX.init(); SFX.select(); gotoSelect(); }
    });
    document.getElementById('screenResult').addEventListener('click', function () {
      if (APP.state === 'result') location.reload();
    });
    loop();
  }

  // 选将/剧情阶段的状态跟踪
  var _gotoSelect = gotoSelect;
  gotoSelect = function () { APP.state = 'select'; _gotoSelect(); };
  var _startBattle = startBattle;
  startBattle = function (h) { _startBattle(h); };

  return { boot: boot, APP: APP, _G: function () { return G; } };
})();

window.addEventListener('load', GAME.boot);
