"use strict";
// ============================================================
//  方块星野 BlockWilds - 核心玩法整合
//  时间循环 / 挪麦文字翻译 / 信号镜 / 侦察兵 / 量子 / 营火
//  （所有文本均为本游戏原创撰写）
// ============================================================
window.G = window.G || {};

(function() {
  var U = G.U;

  var GP = {
    loopStart: 0,
    loopLen: G.CONF.LOOP_SECONDS,
    loopEnding: false,
    loopCount: 0,
    launchCodes: false,
    warpCoreInstalled: false,
    hasWarpCore: false,
    currentHint: '',
    nearCampfire: false,
    log: {},                 // key -> {title, clues:[], seen}
    openedChests: {},
    scoutObj: null,
    quantumShard: null,
    anglerfish: null,
    novaWave: null,
    novaCueStarted: false,
    translating: null,
    roasting: null,
    scopeMode: false,
    scopeFreq: 0,
    ended: false
  };

  // ---------------- 原创挪麦文本库 ----------------
  var NOMAI_TEXTS = {
    museum: {
      title: '村口的挪麦石碑',
      lines: [
        '「致后来的旅行者：这颗星系的恒星即将走到尽头。」',
        '「我们留下了记录。请去寻找散落在各个星球的刻文。」',
        '「飞船的点火序列是：向上，向上，然后是群星。」',
        '（你记住了发射密码——现在可以驾驶飞船起飞了！）'
      ],
      log: ['launch', '发射密码', '村口石碑教会了你飞船的点火序列。按 F 进入飞船，按 R 起飞。'],
      onDone: function() {
        if (!GP.launchCodes) {
          GP.launchCodes = true;
          G.HUD.toast('获得发射密码！飞船已解锁', '#7cff7c', 3600);
          G.SFX.play('discovery');
        }
      }
    },
    ember_city: {
      title: '峡谷城刻文',
      lines: [
        '「双子星共舞，沙从一颗流向另一颗。」',
        '「当沙覆盖此城时，请去它的兄弟星球——塔中藏着我们最伟大的造物。」',
        '「记住：沙柱既是沙漏，也是钥匙。」'
      ],
      log: ['twins', '灰烬双星的秘密', '峡谷城刻文提到：灰渣星的高塔中藏着挪麦人「最伟大的造物」。']
    },
    warp_tower: {
      title: '跃迁塔核心室',
      lines: [
        '「这里安放着先进跃迁核心——它能撕开时空。」',
        '「若恒星死亡，把核心装入你的飞船，在冲击波抵达前点火。」',
        '「愿群星记得我们。」',
        '（你获得了：先进跃迁核心！）'
      ],
      log: ['warpcore', '先进跃迁核心', '把跃迁核心带回飞船并安装（手持核心对飞船按右键），也许能在超新星中幸存。'],
      onDone: function() {
        if (!GP.hasWarpCore && G.Inv.count('warp_core') === 0 && !GP.warpCoreInstalled) {
          G.Inv.give(G.Inv.mkStack('warp_core', 1));
          GP.hasWarpCore = true;
          G.HUD.toast('获得 先进跃迁核心！', '#b478ff', 3600);
          G.SFX.play('discovery');
        }
      }
    },
    brittle_ruin: {
      title: '南极观测台刻文',
      lines: [
        '「我们在这颗星球的心脏里发现了一个洞——一个吞噬一切的洞。」',
        '「坠入黑洞的东西并没有消失，它们从别处涌出。」',
        '「不要害怕坠落，害怕的是从未跳下。」'
      ],
      log: ['blackhole', '碎空星黑洞', '刻文暗示坠入黑洞不会死亡，而是会被抛到别的地方。']
    },
    giant_island: {
      title: '风暴信标刻文',
      lines: [
        '「龙卷风把岛屿抛向天空，也能把飞船压入深海。」',
        '「星球的核心藏在无尽深水之下，我们从未抵达。」'
      ],
      log: ['giant', '深巨星风暴', '深巨星的龙卷风非常危险，降落时要避开水面上的风柱。']
    },
    bramble_pod: {
      title: '坠毁逃生舱记录',
      lines: [
        '「不要打开灯。不要发出声音。」',
        '「雾里有会发光的『眼睛』，它们循着声音而来。」',
        '「如果你听到心跳般的轰鸣……跑。」'
      ],
      log: ['angler', '黑棘星的居民', '逃生舱的记录警告：迷雾中有循声而动的巨大生物。靠近时会听到心跳声。']
    },
    quantum_shrine: {
      title: '量子圣坛刻文',
      lines: [
        '「观测即固定。移开视线，它便流浪。」',
        '「这颗卫星同样遵循此律——它在五颗星球之间漂泊。」',
        '「若想留住量子之物，就永远注视它。」'
      ],
      log: ['quantum', '量子法则', '量子物体在不被观测时会移动位置。量子月也一样。']
    }
  };

  // ---------------- 日志 ----------------
  function addLog(key, title, clue) {
    var e = GP.log[key];
    if (!e) {
      e = GP.log[key] = { title: title, clues: [], seen: false };
    }
    if (e.clues.indexOf(clue) < 0) {
      e.clues.push(clue);
      e.seen = false;
      G.SFX.play('log_update');
      G.HUD.toast('✦ 飞船日志已更新：' + title, '#9fe8ff');
      saveLog();
    }
  }

  function saveLog() {
    try {
      localStorage.setItem('blockwilds_log', JSON.stringify({
        log: GP.log, launchCodes: GP.launchCodes, loopCount: GP.loopCount
      }));
    } catch (e) {}
  }
  function loadLog() {
    try {
      var d = JSON.parse(localStorage.getItem('blockwilds_log') || 'null');
      if (d) {
        GP.log = d.log || {};
        GP.launchCodes = !!d.launchCodes;
        GP.loopCount = d.loopCount || 0;
      }
    } catch (e) {}
  }

  window.__GameplayInternal = { GP: GP, NOMAI_TEXTS: NOMAI_TEXTS, addLog: addLog, saveLog: saveLog, loadLog: loadLog };
})();

// ============================================================
//  交互：方块使用 / 物品使用 / 翻译 / 烤棉花糖 / 补给箱
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__GameplayInternal;
  var GP = IN.GP;
  var _tv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  // ---------------- 挪麦文字：定位 -> 文本键 ----------------
  function nomaiKeyFor(planet, t) {
    // 根据星球和结构位置判断属于哪段文本
    var frames = [
      ['timber', 'museumFrame', 'museum'],
      ['ember', 'cityFrame', 'ember_city'],
      ['ashen', 'warpTowerFrame', 'warp_tower'],
      ['brittle', 'ruinFrame', 'brittle_ruin'],
      ['giant', 'islandFrame', 'giant_island'],
      ['bramble', 'podFrame', 'bramble_pod'],
      ['quantum', 'shrineFrame', 'quantum_shrine']
    ];
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (planet.key === f[0] && planet[f[1]]) return f[2];
    }
    return 'museum';
  }

  // ---------------- 方块交互 ----------------
  function useBlock(planet, t, def) {
    if (def.use === 'craft') {
      G.Screens.openCraft();
    } else if (def.use === 'chest') {
      var ck = planet.key + ':' + t.x + ',' + t.y + ',' + t.z;
      var loot = [];
      if (!GP.openedChests[ck]) {
        GP.openedChests[ck] = true;
        loot = [
          G.Inv.mkStack('marshmallow', 6),
          G.Inv.mkStack('oxygen_tank', 2),
          G.Inv.mkStack('fuel_tank', 2),
          G.Inv.mkStack(G.BLOCK_BY_KEY.torch.id, 12)
        ];
        loot.forEach(function(s) { G.Inv.give({ kind: s.kind, id: s.id, key: s.key, count: s.count }); });
        G.SFX.play('pickup');
      }
      G.Screens.openChest(loot);
    } else if (def.use === 'nomai_text') {
      var sel = G.Inv.selStack;
      if (!sel || sel.kind !== 'item' || sel.key !== 'translator') {
        G.HUD.toast('需要手持挪麦翻译机', '#ffd270');
        return;
      }
      startTranslate(planet, t);
    } else if (def.use === 'campfire') {
      var s = G.Inv.selStack;
      if (s && s.kind === 'item' && s.key === 'marshmallow') {
        startRoast(planet, t);
      } else {
        G.HUD.toast('手持棉花糖靠近营火可以烘烤', '#ffd270');
      }
    }
  }

  // ---------------- 翻译（逐字点亮动画） ----------------
  function startTranslate(planet, t) {
    var key = nomaiKeyFor(planet, t);
    var txt = IN.NOMAI_TEXTS[key];
    if (!txt) return;
    GP.translating = {
      key: key, txt: txt, line: 0, chars: 0, timer: 0, done: false
    };
    G.HUD.translate(true, '', '◈ 挪麦翻译机 · 破译中 ◈');
  }

  function updateTranslate(dt) {
    var tr = GP.translating;
    if (!tr) return;
    // 玩家移开或死亡则中断
    if (G.Player.state.dead) { stopTranslate(); return; }
    tr.timer += dt;
    var speed = 22; // 字/秒
    var target = tr.txt.lines[tr.line];
    var want = Math.min(target.length, Math.floor(tr.timer * speed));
    if (want > tr.chars) {
      if (Math.random() < 0.35) G.SFX.play('translate_note', 0.6);
      tr.chars = want;
    }
    var html = '';
    for (var i = 0; i <= tr.line; i++) {
      var full = i < tr.line;
      var line = tr.txt.lines[i];
      var shown = full ? line : line.substring(0, tr.chars);
      html += '<div style="opacity:' + (full ? 0.75 : 1) + '">' + shown +
        (full ? '' : '<span style="color:#55e6c8">▌</span>') + '</div>';
    }
    G.HUD.translate(true, html);
    if (tr.chars >= target.length) {
      if (tr.line < tr.txt.lines.length - 1) {
        tr.line++; tr.chars = 0; tr.timer = 0;
      } else if (!tr.done) {
        tr.done = true;
        G.SFX.play('translate_done');
        if (tr.txt.log) IN.addLog(tr.txt.log[0], tr.txt.log[1], tr.txt.log[2]);
        if (tr.txt.onDone) tr.txt.onDone();
        setTimeout(stopTranslate, 2600);
      }
    }
  }
  function stopTranslate() {
    GP.translating = null;
    G.HUD.translate(false);
  }

  // ---------------- 烤棉花糖 ----------------
  function startRoast(planet, t) {
    if (GP.roasting) return;
    GP.roasting = { t: 0, planet: planet, pos: new THREE.Vector3(t.x + 0.5, t.y + 0.5, t.z + 0.5) };
  }
  function updateRoast(dt, nearFire) {
    if (!GP.roasting) { G.HUD.roastBar(null); return; }
    var s = G.Inv.selStack;
    var P = G.Player.state;
    var stillNear = P.frame === 'planet' && P.planet === GP.roasting.planet &&
      P.pos.distanceTo(GP.roasting.pos) < 5.5;
    if (!stillNear || !s || s.kind !== 'item' || s.key !== 'marshmallow') {
      GP.roasting = null; G.HUD.roastBar(null);
      return;
    }
    GP.roasting.t += dt;
    var t = GP.roasting.t / 4; // 4秒金黄
    G.HUD.roastBar(Math.min(1, t));
    if (GP.roasting.t >= 7) {
      // 烤焦
      G.Inv.consumeSel();
      G.Inv.give(G.Inv.mkStack('marshmallow_burnt', 1));
      G.SFX.play('marshmallow_catch_fire');
      G.HUD.toast('烤焦了……', '#ff8855');
      GP.roasting = null;
      G.HUD.roastBar(null);
    }
  }
  function finishRoast() {
    if (!GP.roasting) return false;
    if (GP.roasting.t >= 3.2) {
      G.Inv.consumeSel();
      G.Inv.give(G.Inv.mkStack('marshmallow_roasted', 1));
      G.SFX.play('pickup');
      G.HUD.toast('金黄酥脆！', '#ffd270');
    }
    GP.roasting = null;
    G.HUD.roastBar(null);
    return true;
  }

  // ---------------- 物品使用 ----------------
  function useItem(s) {
    var P = G.Player.state;
    var d = G.ITEMS[s.key];
    if (!d) return;
    if (d.food) {
      P.hp = Math.min(G.CONF.HP_MAX, P.hp + d.food);
      G.Inv.consumeSel();
      G.SFX.play('eat');
      return;
    }
    if (d.use === 'oxygen') {
      P.o2 = Math.min(G.CONF.O2_MAX, P.o2 + 50);
      G.Inv.consumeSel();
      G.SFX.play('eat');
      G.HUD.toast('氧气 +50%', '#9fd8ff');
      return;
    }
    if (d.use === 'fuel') {
      P.fuel = Math.min(G.CONF.FUEL_MAX, P.fuel + 50);
      G.Inv.consumeSel();
      G.SFX.play('eat');
      G.HUD.toast('喷气燃料 +50%', '#ffd24d');
      return;
    }
    if (s.key === 'warp_core') {
      // 对着飞船安装
      var shipPos = G.Ship.worldPos(_tv[0]);
      if (shipPos.distanceTo(G.Player.state.camWorldPos) < 8) {
        G.Inv.consumeSel();
        GP.warpCoreInstalled = true;
        G.SFX.play('statue_activate');
        G.HUD.toast('跃迁核心已安装！飞船获得了穿越时空的力量', '#b478ff', 4000);
        IN.addLog('warpcore', '先进跃迁核心', '核心已安装到飞船。当超新星爆发时，也许该起飞了……');
      } else {
        G.HUD.toast('靠近飞船后使用', '#ffd270');
      }
      return;
    }
    if (s.key === 'repair_kit') {
      var shipPos2 = G.Ship.worldPos(_tv[0]);
      if (shipPos2.distanceTo(G.Player.state.camWorldPos) < 8 && G.Ship.state.hull < 100) {
        G.Ship.state.hull = Math.min(100, G.Ship.state.hull + 40);
        G.Inv.consumeSel();
        G.SFX.play('craft');
        G.HUD.toast('船体 +40%', '#7cff7c');
      }
      return;
    }
    if (s.key === 'scout') { launchScout(); return; }
    if (s.key === 'marshmallow') {
      // 若在营火边则由 useBlock 处理；否则生吃
      if (!GP.nearCampfire) {
        P.hp = Math.min(G.CONF.HP_MAX, P.hp + 3);
        G.Inv.consumeSel();
        G.SFX.play('eat');
      }
      return;
    }
  }

  // ---------------- 侦察兵 ----------------
  function launchScout() {
    if (GP.scoutObj) { recallScout(); return; }
    var P = G.Player.state;
    if (P.frame !== 'planet') { G.HUD.toast('太空中无法发射侦察兵', '#ffd270'); return; }
    var dir = _tv[0].set(0, 0, -1).applyQuaternion(P.camWorldQuat);
    G.Solar.worldDirToLocal(P.planet, dir, dir);
    GP.scoutObj = {
      planet: P.planet,
      pos: P.pos.clone(),
      vel: dir.clone().multiplyScalar(34),
      stuck: false, light: null, mesh: null, beepT: 0
    };
    G.SFX.play('scout_launch');
    G.Player.setHoldSwing();
    buildScoutMesh();
  }
  function buildScoutMesh() {
    var so = GP.scoutObj;
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x9aa2a2 }));
    g.add(body);
    var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x55e6c8 }));
    lamp.position.y = 0.3;
    g.add(lamp);
    var light = new THREE.PointLight(0xaef0e0, 1.6, 22, 2);
    g.add(light);
    so.mesh = g; so.lamp = lamp;
    so.planet.group.add(g);
  }
  function recallScout() {
    var so = GP.scoutObj;
    if (so && so.mesh && so.mesh.parent) so.mesh.parent.remove(so.mesh);
    GP.scoutObj = null;
    G.SFX.play('scout_recall');
  }
  function updateScout(dt) {
    var so = GP.scoutObj;
    if (!so) return;
    if (!so.stuck) {
      // 重力
      var up = _tv[0].copy(so.pos).normalize();
      so.vel.addScaledVector(up, -G.CONF.GRAVITY * so.planet.gravity * dt);
      so.pos.addScaledVector(so.vel, dt);
      var bx = Math.floor(so.pos.x), by = Math.floor(so.pos.y), bz = Math.floor(so.pos.z);
      if (G.Chunks.isSolid(so.planet, bx, by, bz)) {
        so.stuck = true;
        so.pos.addScaledVector(so.vel.normalize(), -0.4);
        G.SFX.play('scout_beep');
      }
    } else {
      so.beepT += dt;
      if (so.beepT > 3) { so.beepT = 0; G.SFX.play('scout_beep', 0.4); }
    }
    if (so.mesh) {
      so.mesh.position.copy(so.pos);
      if (so.lamp) so.lamp.material.color.setHex((Math.floor(performance.now() / 400) % 2) ? 0x55e6c8 : 0x1d7a68);
    }
  }

  IN.useBlock = useBlock;
  IN.useItem = useItem;
  IN.updateTranslate = updateTranslate;
  IN.updateRoast = updateRoast;
  IN.finishRoast = finishRoast;
  IN.updateScout = updateScout;
  IN.recallScout = recallScout;
  IN.stopTranslate = stopTranslate;
})();

// ============================================================
//  信号镜 / 量子物体 / 鮟鱇鱼 / 黑洞坠落
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__GameplayInternal;
  var GP = IN.GP;
  var _tv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  // ---------------- 信号镜 ----------------
  var FREQS = [
    { name: '旅行者旋律', signals: [{ key: 'camp', label: '营火旋律 · 木炉星', planetKey: 'timber', useSpawn: true }] },
    { name: '量子涨落', signals: [{ key: 'qshard', label: '量子碎片 · 木炉星', planetKey: 'timber', frameKey: 'quantumShardFrame' }, { key: 'qmoon', label: '量子月', planetKey: 'quantum', center: true }] },
    { name: '求救信标', signals: [{ key: 'pod', label: '逃生舱信标 · 黑棘星', planetKey: 'bramble', frameKey: 'podFrame' }] },
    { name: '挪麦回响', signals: [{ key: 'warp', label: '古代科技回波 · 灰渣星', planetKey: 'ashen', frameKey: 'warpTowerFrame' }] }
  ];

  function signalWorldPos(sig, out) {
    var p = G.Solar.byKey[sig.planetKey];
    if (!p) return null;
    if (sig.center) { out.copy(p.pos); return out; }
    var f = sig.useSpawn ? p.spawnFrame : p[sig.frameKey];
    if (!f) { out.copy(p.pos); return out; }
    return G.Solar.localToWorld(p, f.origin, out);
  }

  function updateScope(dt) {
    var P = G.Player.state;
    var holdingScope = !P.inShip && G.Inv.selStack && G.Inv.selStack.kind === 'item' && G.Inv.selStack.key === 'signalscope';
    if (!holdingScope || G.Screens.isOpen()) {
      if (GP.scopeMode) {
        GP.scopeMode = false;
        G.HUD.scope(false);
        G.SFX.setLoopLevel('signal_static', 0, 0.2);
      }
      return;
    }
    if (!GP.scopeMode) {
      GP.scopeMode = true;
      G.SFX.loop('signal_static');
    }
    var fq = FREQS[GP.scopeFreq];
    var fwd = _tv[0].set(0, 0, -1).applyQuaternion(P.camWorldQuat);
    var best = null, bestAlign = 0;
    for (var i = 0; i < fq.signals.length; i++) {
      var sig = fq.signals[i];
      var sp = signalWorldPos(sig, _tv[1]);
      if (!sp) continue;
      var to = _tv[2].copy(sp).sub(P.camWorldPos);
      var dist = to.length();
      to.normalize();
      var align = Math.max(0, fwd.dot(to));
      if (align > bestAlign) { bestAlign = align; best = { sig: sig, dist: dist, align: align }; }
    }
    var text = '';
    var strength = 0;
    if (best && best.align > 0.965) {
      strength = (best.align - 0.965) / 0.035;
      text = '≈ ' + best.sig.label + ' ≈<br>距离 ' + Math.round(best.dist) + 'm';
      if (!best.sig.found && strength > 0.7) {
        best.sig.found = true;
        G.SFX.play('signal_found');
        IN.addLog('signals', '信号镜记录', '发现信号：' + best.sig.label);
      }
    }
    // 音频：营火旋律频段对准时听到音乐
    if (fq.signals[0].key === 'camp') {
      G.Music.setCampfireLevel(Math.max(GP.campfireMusicBase || 0, strength * 0.9), 0.15);
    }
    G.SFX.setLoopLevel('signal_static', 0.12 + strength * 0.2, 0.15);
    G.HUD.scope(true, fq.name, text, strength);
  }

  // 右键切换频段（信号镜模式下）
  document.addEventListener('mousedown', function(e) {
    if (e.button === 2 && GP.scopeMode && G.Main && G.Main.pointerLocked()) {
      GP.scopeFreq = (GP.scopeFreq + 1) % FREQS.length;
      G.SFX.play('ui_click');
    }
  });

  // ---------------- 量子碎片（不被观测时移动） ----------------
  function ensureQuantumShard() {
    if (GP.quantumShard) return;
    var timber = G.Solar.byKey.timber;
    if (!timber.quantumShardFrame || !timber.group) return;
    var mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 3, 2),
      (function() {
        var cv = G.Textures.tileCanvas('quantum_stone');
        var tex = new THREE.CanvasTexture(cv);
        tex.magFilter = THREE.NearestFilter;
        return new THREE.MeshLambertMaterial({ map: tex, emissive: new THREE.Color(0x30104a), emissiveIntensity: 0.5 });
      })()
    );
    var spots = [];
    for (var i = 0; i < 5; i++) {
      var ang = i * 1.256;
      var d = timber.quantumShardFrame.up.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.06 * Math.cos(ang)).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.06 * Math.sin(ang)).normalize();
      var r = G.Solar.surfaceR(timber, d);
      spots.push(d.multiplyScalar(r + 1.8));
    }
    mesh.position.copy(spots[0]);
    timber.group.add(mesh);
    GP.quantumShard = { mesh: mesh, spots: spots, idx: 0, planet: timber, unseenT: 0 };
  }

  function updateQuantum(dt) {
    ensureQuantumShard();
    updateQuantumMoon(dt);
    var q = GP.quantumShard;
    if (!q) return;
    var P = G.Player.state;
    if (P.frame !== 'planet' || P.planet !== q.planet) return;
    // 是否被观测：视线角度+距离
    var wp = G.Solar.localToWorld(q.planet, q.mesh.position, _tv[0]);
    var to = _tv[1].copy(wp).sub(P.camWorldPos);
    var dist = to.length();
    var fwd = _tv[2].set(0, 0, -1).applyQuaternion(P.camWorldQuat);
    var seen = dist < 90 && fwd.dot(to.normalize()) > 0.35 && !G.Screens.isOpen();
    if (!seen) {
      q.unseenT += dt;
      if (q.unseenT > 1.2 && Math.random() < dt * 0.7) {
        q.idx = (q.idx + 1 + Math.floor(Math.random() * (q.spots.length - 1))) % q.spots.length;
        q.mesh.position.copy(q.spots[q.idx]);
        q.unseenT = 0;
        if (dist < 60) G.SFX.play('quantum_shift', 0.6);
        if (!q.logged && dist < 60) {
          q.logged = true;
          IN.addLog('quantum', '量子法则', '木炉星上有一块会「瞬移」的碎片——它只在你不看它的时候移动。');
        }
      }
    } else q.unseenT = 0;
    // 待机闪烁
    q.mesh.material.emissiveIntensity = 0.35 + Math.sin(performance.now() * 0.003) * 0.15;
  }

  // ---------------- 鮟鱇鱼（黑棘星内部） ----------------
  function ensureAngler() {
    if (GP.anglerfish) return;
    var br = G.Solar.byKey.bramble;
    if (!br.group) return;
    var g = new THREE.Group();
    var mBody = new THREE.MeshLambertMaterial({ color: 0x4a5a5a });
    var body = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 9), mBody);
    g.add(body);
    var jaw = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 4), new THREE.MeshLambertMaterial({ color: 0x384646 }));
    jaw.position.set(0, -2.2, -3.4);
    g.add(jaw);
    var lure = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xbfe8ff }));
    lure.position.set(0, 3.4, -5.6);
    g.add(lure);
    var lureLight = new THREE.PointLight(0xbfe8ff, 2, 40, 2);
    lure.add(lureLight);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3, 3), mBody);
    tail.position.set(0, 0, 5.6);
    g.add(tail);
    br.group.add(g);
    GP.anglerfish = { mesh: g, tail: tail, planet: br, pos: new THREE.Vector3(120, 20, 0), dir: new THREE.Vector3(0, 0, 1), state: 'roam', speed: 6 };
  }

  function updateAngler(dt) {
    ensureAngler();
    var A = GP.anglerfish;
    if (!A) return;
    var P = G.Player.state;
    var inside = P.frame === 'planet' && P.planet === A.planet && P.pos.length() < A.planet.radius - 10;
    // 巡游
    var t = performance.now() * 0.0001;
    if (A.state === 'roam') {
      A.dir.set(Math.sin(t * 3.1), Math.sin(t * 2.3) * 0.4, Math.cos(t * 3.1)).normalize();
      A.pos.addScaledVector(A.dir, A.speed * dt);
      if (A.pos.length() > A.planet.radius - 60) A.pos.multiplyScalar(0.995);
      if (A.pos.length() < 90) A.pos.multiplyScalar(1.01);
    }
    var heartLevel = 0;
    if (inside) {
      var d = _tv[0].copy(P.pos).sub(A.pos).length();
      // 玩家声响（移动/喷气）会吸引
      var noise = P.vel.length() > 3 ? 1 : 0.3;
      if (d < 100 * noise && A.state === 'roam') A.state = 'hunt';
      if (A.state === 'hunt') {
        var to = _tv[1].copy(P.pos).sub(A.pos).normalize();
        A.dir.lerp(to, dt * 2).normalize();
        A.pos.addScaledVector(A.dir, 16 * dt);
        if (d > 140) A.state = 'roam';
        if (d < 6) {
          G.Player.damage(20, 'angler');
          A.state = 'roam';
          A.pos.addScaledVector(A.dir, -40);
        }
      }
      heartLevel = U.clamp(1 - d / 120, 0, 1);
      var hb = G.SFX.loop('heartbeat');
      if (hb) hb.gain._rate = 1 + heartLevel * 1.6;
    } else if (A.state === 'hunt') A.state = 'roam';
    G.SFX.setLoopLevel('heartbeat', heartLevel * 0.8, 0.3);
    G.SFX.setLoopLevel('anglerfish', inside ? 0.25 : 0, 0.5);
    // 位置与动画
    A.mesh.position.copy(A.pos);
    var look = _tv[2].copy(A.pos).add(A.dir);
    A.mesh.lookAt(look);
    A.tail.rotation.y = Math.sin(performance.now() * 0.004) * 0.5;
  }

  // ---------------- 黑洞坠落（碎空星 -> 白洞站） ----------------
  function updateBlackHole(dt) {
    var P = G.Player.state;
    if (P.frame !== 'planet') return;
    var p = P.planet;
    if (!p.blackHole) {
      G.SFX.setLoopLevel('blackhole', 0, 0.4);
      return;
    }
    var r = P.pos.length();
    var lvl = U.clamp(1 - (r - p.blackHole) / 160, 0, 1);
    G.SFX.setLoopLevel('blackhole', lvl * 0.8, 0.3);
    if (r < p.blackHole + 8) {
      // 吞入 -> 从白洞吐出（抛回太空，朝向木炉星）
      G.SFX.play('loop_reset');
      IN.addLog('blackhole', '碎空星黑洞', '你坠入了黑洞——然后从一个白洞被吐了出来。挪麦刻文说得没错。');
      G.Player.toSpaceFrame();
      var timber = G.Solar.byKey.timber;
      var dirOut = _tv[0].copy(p.pos).sub(G.Solar.SUN.pos).normalize();
      P.pos.copy(p.pos).addScaledVector(dirOut, p.radius * 3);
      var toTimber = _tv[1].copy(timber.pos).sub(P.pos).normalize();
      P.vel.copy(toTimber.multiplyScalar(30)).add(timber.vel);
      G.HUD.toast('你穿过了黑洞……又活了下来！', '#b478ff', 4000);
    }
  }

  // 量子月：不被观测时在宿主星球间漂泊
  var _qmTimer = 0;
  function updateQuantumMoon(dt) {
    var qm = G.Solar.byKey.quantum;
    if (!qm) return;
    _qmTimer += dt;
    if (_qmTimer < 5) return;
    _qmTimer = 0;
    var P = G.Player.state;
    var to = _tv[0].copy(qm.pos).sub(P.camWorldPos);
    var dist = to.length();
    if (dist < qm.radius * 4) return; // 太近不移动
    var fwd = _tv[1].set(0, 0, -1).applyQuaternion(P.camWorldQuat);
    var seen = fwd.dot(to.normalize()) > 0.55 && !G.Screens.isOpen();
    if (!seen && Math.random() < 0.65) {
      var hosts = qm.quantumHosts.filter(function(h) { return h !== qm.quantumHostKey; });
      qm.quantumHostKey = hosts[Math.floor(Math.random() * hosts.length)];
    }
  }

  IN.updateScope = updateScope;
  IN.updateQuantum = updateQuantum;
  IN.updateAngler = updateAngler;
  IN.updateBlackHole = updateBlackHole;
  IN.FREQS = FREQS;
})();

// ============================================================
//  时间循环 / 超新星 / 环境音驱动 / 公开API
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__GameplayInternal;
  var GP = IN.GP;
  var _tv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  // ---------------- 超新星流程 ----------------
  function loopElapsed() { return (performance.now() - GP.loopStart) / 1000; }
  function loopRemaining() { return Math.max(0, GP.loopLen - loopElapsed()); }

  function updateSupernova(dt) {
    var remain = loopRemaining();
    var SUN = G.Solar.SUN;
    // 恒星膨胀变红（最后90秒可见变化）
    var phase = U.clamp(1 - remain / 90, 0, 1);
    SUN.radiusNow = SUN.radius * (1 + phase * 0.6);
    var r = window.__FarInternal && window.__FarInternal.refs;
    if (r && r.sun) {
      var c = r.sun.material.color;
      c.setRGB(1, 0.82 - phase * 0.5, 0.4 - phase * 0.32);
    }
    // 弦乐预警（最后40秒）
    if (remain < 40 && !GP.novaCueStarted && !GP.ended) {
      GP.novaCueStarted = true;
      G.Music.startNovaSwell(38);
      G.HUD.toast('……恒星在颤抖', '#ff8855', 3200);
    }
    if (remain <= 0 && !GP.loopEnding) {
      GP.loopEnding = true;
      beginNova();
    }
    // 冲击波推进
    if (GP.novaWave) {
      GP.novaWave.r += dt * 2600;
      GP.novaWave.mesh.scale.setScalar(GP.novaWave.r);
      var pw = G.Player.state.frame === 'space'
        ? G.Player.state.pos
        : G.Solar.localToWorld(G.Player.state.planet, G.Player.state.pos, _tv[0]);
      var d = pw.distanceTo(G.Solar.SUN.pos);
      if (d < GP.novaWave.r) {
        if (GP.warpCoreInstalled && G.Player.state.inShip && G.Ship.state.state === 'flying') {
          winGame();
        } else {
          triggerLoopReset('supernova');
        }
      }
    }
  }

  function beginNova() {
    // 白色冲击波球
    var geo = new THREE.SphereGeometry(1, 32, 24);
    var mat = new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(G.Solar.SUN.pos);
    G.Main.scene.add(mesh);
    GP.novaWave = { mesh: mesh, r: G.Solar.SUN.radiusNow };
    G.Music.stopNovaSwell();
    G.SFX.play('loop_reset');
  }

  function triggerLoopReset(cause) {
    if (GP.ended) return;
    var flash = U.$('supernova-flash');
    flash.style.transition = 'opacity 1.6s';
    flash.style.opacity = 1;
    G.Music.stopNovaSwell();
    setTimeout(function() {
      doReset();
      flash.style.transition = 'opacity 2.5s';
      flash.style.opacity = 0;
    }, 1700);
  }

  function doReset() {
    GP.loopCount++;
    GP.loopStart = performance.now();
    GP.loopEnding = false;
    GP.novaCueStarted = false;
    GP.warpCoreInstalled = false;
    GP.hasWarpCore = false;
    if (GP.novaWave) {
      G.Main.scene.remove(GP.novaWave.mesh);
      GP.novaWave = null;
    }
    G.Solar.SUN.radiusNow = G.Solar.SUN.radius;
    var r = window.__FarInternal && window.__FarInternal.refs;
    if (r && r.sun) r.sun.material.color.setHex(0xffd268);
    // 清除玩家方块修改（世界重置），日志保留
    G.Solar.PLANETS.forEach(function(p) { p.edits = {}; });
    G.Chunks.purgeAll();
    GP.openedChests = {};
    IN.recallScout();
    IN.stopTranslate();
    G.Ship.reset();
    G.Player.respawn();
    G.Screens.close();
    G.SFX.play('loop_reset');
    G.HUD.toast('☀ 时间循环重置 · 第 ' + (GP.loopCount + 1) + ' 次循环<br><span style="font-size:13px">你在营火边醒来。记忆完好无损。</span>', '#9fe8ff', 4200);
    IN.addLog('loop', '时间循环', '第 ' + GP.loopCount + ' 次循环结束。死亡不是终点——你总会在营火边醒来。');
    IN.saveLog();
  }

  function winGame() {
    if (GP.ended) return;
    GP.ended = true;
    var flash = U.$('supernova-flash');
    flash.style.transition = 'opacity 2.5s';
    flash.style.background = '#fff';
    flash.style.opacity = 1;
    setTimeout(function() {
      flash.innerHTML = '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#04060d;color:#e8e0c8;font-size:22px;line-height:2.4;text-align:center;">' +
        '<div style="font-size:38px;letter-spacing:8px;color:#fff;">旅 途 继 续</div>' +
        '<div style="font-size:15px;color:#86a8ff;margin-top:14px">跃迁核心撕开了时空。超新星的光芒在你身后凝固。</div>' +
        '<div style="font-size:15px;color:#86a8ff;">你带着整个太阳系的记忆，驶向下一片群星。</div>' +
        '<div style="font-size:13px;color:#666;margin-top:22px">— 方块星野 · 完 —（共 ' + (GP.loopCount + 1) + ' 次循环）</div>' +
        '<button class="mc-btn" style="margin-top:26px;pointer-events:auto" onclick="location.reload()">再次开始</button></div>';
      flash.style.pointerEvents = 'auto';
    }, 2600);
  }

  // ---------------- 环境音 / 营火 / 提示驱动 ----------------
  function updateAmbience(dt) {
    var P = G.Player.state;
    var inAtmo = 0, windLvl = 0;
    if (P.frame === 'planet' && P.planet.atmosphere) {
      var alt = P.pos.length() - P.planet.radius;
      inAtmo = U.clamp(1 - alt / P.planet.atmosphere.h, 0, 1);
      windLvl = inAtmo * (P.planet.key === 'giant' ? 0.5 : 0.28);
    }
    G.SFX.setLoopLevel('wind', windLvl, 0.6);
    G.SFX.setLoopLevel('space_drone', (1 - inAtmo) * 0.35, 1.2);
    G.Music.setSpacePad(P.frame === 'space' ? 0.5 : 0, 2.0);
    // 龙卷风声
    var tornadoLvl = 0;
    if (P.frame === 'planet' && P.planet.key === 'giant') tornadoLvl = inAtmo * 0.4;
    G.SFX.setLoopLevel('tornado', tornadoLvl, 0.8);

    // 营火：距离驱动音效+音乐
    GP.nearCampfire = false;
    var campLvl = 0;
    if (P.frame === 'planet' && P.planet.spawnFrame) {
      var d = P.pos.distanceTo(P.planet.spawnFrame.world(0, 1, 0));
      if (d < 4) GP.nearCampfire = true;
      campLvl = U.clamp(1 - d / 26, 0, 1);
    }
    G.SFX.setLoopLevel('campfire', campLvl * 0.7, 0.4);
    GP.campfireMusicBase = campLvl * 0.65;
    if (!GP.scopeMode) G.Music.setCampfireLevel(GP.campfireMusicBase, 1.2);

    // 幽灵物质噼啪声（附近有 ghost_matter 方块）
    var ghostLvl = 0;
    if (P.frame === 'planet') {
      for (var dx = -4; dx <= 4; dx += 4) for (var dy = -4; dy <= 4; dy += 4) for (var dz = -4; dz <= 4; dz += 4) {
        var id = G.Chunks.getBlock(P.planet, Math.floor(P.pos.x + dx), Math.floor(P.pos.y + dy), Math.floor(P.pos.z + dz));
        var def = G.BLOCKS[id];
        if (def && def.key === 'ghost_matter') { ghostLvl = 0.5; break; }
      }
    }
    G.SFX.setLoopLevel('ghost_crackle', ghostLvl, 0.4);
  }

  // ---------------- 交互提示 ----------------
  function updateHints() {
    var P = G.Player.state;
    GP.currentHint = '';
    if (P.inShip) return;
    // 靠近飞船舱门
    var doorPos = G.Ship.doorWorldPos(_tv[0]);
    if (doorPos.distanceTo(P.camWorldPos) < 3.4) {
      GP.currentHint = (GP.launchCodes || G.Creative)
        ? '<span class="keycap">F</span> 进入飞船'
        : '飞船已锁定——先去村口的挪麦石碑学习发射密码';
    }
    if (GP.roasting) GP.currentHint = '烤棉花糖中…… <span class="keycap">右键松开</span> 取回（4秒金黄，7秒烤焦）';
  }

  // F 键交互
  document.addEventListener('keydown', function(e) {
    if (e.code !== 'KeyF' || !G.Main || !G.Main.started() || G.Screens.isOpen()) return;
    var P = G.Player.state;
    if (P.inShip) { G.Main.exitShip(); return; }
    var doorPos = G.Ship.doorWorldPos(_tv[0]);
    if (doorPos.distanceTo(P.camWorldPos) < 3.4) {
      if (!GP.launchCodes && !G.Creative) {
        G.HUD.toast('飞船已锁定。去村口的挪麦石碑学习发射密码（手持翻译机右键石碑上的发光文字）', '#ffd270', 3800);
        return;
      }
      G.Main.enterShip();
    }
  });
  // R 起飞
  document.addEventListener('keydown', function(e) {
    if (e.code !== 'KeyR' || !G.Main || !G.Main.started()) return;
    var P = G.Player.state;
    if (P.inShip && G.Ship.state.state === 'landed') {
      G.Ship.takeOff();
      G.SFX.play('ship_door', 0.5);
    }
  });
  // 松开右键完成烤糖
  document.addEventListener('mouseup', function(e) {
    if (e.button === 2) IN.finishRoast();
  });

  // ---------------- 公开 API ----------------
  G.Gameplay = {
    get nearCampfire() { return IN.GP.nearCampfire; },
    get currentHint() { return IN.GP.currentHint; },
    init: function() {
      IN.loadLog();
      GP.loopStart = performance.now();
      // 初始物资
      G.Inv.give(G.Inv.mkStack('translator', 1));
      G.Inv.give(G.Inv.mkStack('signalscope', 1));
      G.Inv.give(G.Inv.mkStack('scout', 1));
      G.Inv.give(G.Inv.mkStack('marshmallow', 4));
      G.Inv.give(G.Inv.mkStack(G.BLOCK_BY_KEY.torch.id, 8));
      IN.addLog('home', '木炉星 · 家园', '你在营火边醒来。飞船停在山坡的停机坪上。村口的挪麦石碑上刻着发光的文字——也许翻译机能读懂它。');
      G.Music.startCampfireTheme();
    },
    update: function(dt) {
      updateSupernova(dt);
      updateAmbience(dt);
      updateHints();
      IN.updateTranslate(dt);
      IN.updateRoast(dt, GP.nearCampfire);
      IN.updateScout(dt);
      IN.updateScope(dt);
      IN.updateQuantum(dt);
      IN.updateAngler(dt);
      IN.updateBlackHole(dt);
    },
    loopRemaining: loopRemaining,
    logEntries: function() { return GP.log; },
    useBlock: IN.useBlock,
    useItem: IN.useItem,
    triggerLoopReset: triggerLoopReset,
    onPlayerDeath: function(cause) {
      G.HUD.toast('你失去了意识……', '#ff5555', 2400);
      setTimeout(function() { triggerLoopReset(cause); }, 1400);
    },
    onBlockBroken: function(planet, t, def) {
      if (def.key === 'nomai_text') return;
    },
    onBlockPlaced: function(planet, x, y, z, def) {
      if (def.key === 'gravity_crystal') G.SFX.loop('gravity_hum');
    },
    handleLeftClick: function() {
      var s = G.Inv.selStack;
      if (s && s.kind === 'item' && s.key === 'scout') { IN.useItem(s); return true; }
      return false;
    }
  };
})();
