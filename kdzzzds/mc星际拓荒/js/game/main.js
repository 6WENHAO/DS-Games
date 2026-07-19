"use strict";
// ============================================================
//  方块星野 BlockWilds - 主程序
//  引导 / 渲染循环 / 相机 / 手持模型 / 天空大气 / 指针锁定
// ============================================================
window.G = window.G || {};

(function() {
  var U = G.U;
  var _renderer = null, _scene = null, _camera = null;
  var _started = false, _locked = false;
  var _simTime = 0, _lastT = 0;
  var _handGroup = null, _handMesh = null, _handKey = '';
  var _ambLight = null;
  var _fog = null;

  // ---------------- 注册表填充 ----------------
  function fillRegistries() {
    G.BLOCK_DEFS.forEach(function(d) {
      G.BLOCKS[d.id] = d;
      G.BLOCK_BY_KEY[d.key] = d;
    });
    G.ITEM_DEFS.forEach(function(d) { G.ITEMS[d.key] = d; });
  }

  // ---------------- 渲染器 ----------------
  function setupRenderer() {
    var canvas = U.$('gl');
    _renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance'
    });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    _renderer.setSize(window.innerWidth, window.innerHeight);
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x02040a);
    _fog = new THREE.FogExp2(0x02040a, 0.0);
    _scene.fog = _fog;
    _camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 90000);
    _ambLight = new THREE.AmbientLight(0x8a93a8, 0.85);
    _scene.add(_ambLight);
    // 半球补光：天光/地光，显著提升整体能见度
    var hemi = new THREE.HemisphereLight(0xbfd4ff, 0x6a5844, 0.5);
    _scene.add(hemi);
    window.addEventListener('resize', function() {
      _renderer.setSize(window.innerWidth, window.innerHeight);
      _camera.aspect = window.innerWidth / window.innerHeight;
      _camera.updateProjectionMatrix();
    });
  }

  // ---------------- 指针锁定 ----------------
  function setupPointer() {
    var canvas = U.$('gl');
    canvas.addEventListener('click', function() {
      if (_started && !G.Screens.isOpen()) G.Main.lockPointer();
    });
    document.addEventListener('pointerlockchange', function() {
      _locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', function(e) {
      if (_locked) G.Input.feedMouse(e.movementX || 0, e.movementY || 0);
    });
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  }

  // ---------------- 快捷栏选择 ----------------
  function setupHotkeys() {
    document.addEventListener('keydown', function(e) {
      if (!_started || G.Screens.isOpen()) return;
      if (e.code.indexOf('Digit') === 0) {
        var n = parseInt(e.code.substring(5));
        if (n >= 1 && n <= 9) {
          if (G.Inv.sel !== n - 1) {
            G.Inv.sel = n - 1;
            G.Player.state.holdAnim.switch = 1;
            G.SFX.play('ui_click', 0.5);
            G.HUD.refreshHotbar();
          }
        }
      }
    });
    document.addEventListener('wheel', function(e) {
      if (!_started || G.Screens.isOpen() || !_locked) return;
      var d = e.deltaY > 0 ? 1 : -1;
      G.Inv.sel = (G.Inv.sel + d + 9) % 9;
      G.Player.state.holdAnim.switch = 1;
      G.HUD.refreshHotbar();
    }, { passive: true });
  }

  // ---------------- 手持模型 ----------------
  function setupHand() {
    _handGroup = new THREE.Group();
    _camera.add(_handGroup);
    _scene.add(_camera);
    _handGroup.position.set(0.42, -0.38, -0.7);
  }

  function refreshHandMesh() {
    var s = G.Inv.selStack;
    var key = s ? (s.kind === 'block' ? 'b' + s.id : 'i' + s.key) : '';
    if (key === _handKey) return;
    _handKey = key;
    if (_handMesh) { _handGroup.remove(_handMesh); _handMesh = null; }
    if (!s) return;
    if (s.kind === 'block') {
      var def = G.BLOCKS[s.id];
      var tiles = def.tiles;
      var names = typeof tiles === 'string' ? [tiles, tiles, tiles] : [tiles[0], tiles[1], tiles[2] || tiles[1]];
      var mats = [];
      var order = [1, 1, 0, 2, 1, 1]; // px nx py ny pz nz
      for (var i = 0; i < 6; i++) {
        var cv = G.Textures.tileCanvas(names[order[i]]);
        var tex = new THREE.CanvasTexture(cv);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        mats.push(new THREE.MeshLambertMaterial({ map: tex, transparent: !!def.alpha, alphaTest: 0.4 }));
      }
      _handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), mats);
      _handMesh.rotation.set(0.35, 0.8, 0);
    } else {
      // 物品：像素图标做成竖立薄片
      var url = G.Icons.itemURL(s.key);
      var img = new Image();
      var tex2 = new THREE.Texture();
      img.onload = function() { tex2.image = img; tex2.needsUpdate = true; };
      img.src = url;
      tex2.magFilter = THREE.NearestFilter;
      tex2.minFilter = THREE.NearestFilter;
      var mat = new THREE.MeshBasicMaterial({ map: tex2, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
      _handMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), mat);
      _handMesh.rotation.set(-0.15, -0.5, 0.25);
    }
    _handGroup.add(_handMesh);
  }

  function updateHand(dt, t) {
    if (!_handGroup) return;
    refreshHandMesh();
    var P = G.Player.state;
    _handGroup.visible = !P.inShip && !P.dead;
    if (!_handGroup.visible) return;
    var swing = P.holdAnim.swing;
    var sw = Math.sin(swing * Math.PI) * 0.5;
    var bob = P.grounded ? Math.sin(P.walkCycle * 2.4) * 0.02 : 0;
    var switchDip = P.holdAnim.switch * 0.3;
    // 呼吸浮动（待机动画）
    var idle = Math.sin(t * 1.6) * 0.008;
    _handGroup.position.set(0.42 - sw * 0.25, -0.38 + bob + idle - switchDip - sw * 0.15, -0.7 - sw * 0.1);
    _handGroup.rotation.set(-sw * 0.9, sw * 0.3, 0);
  }

  window.__MainInternal = {
    fillRegistries: fillRegistries, setupRenderer: setupRenderer,
    setupPointer: setupPointer, setupHotkeys: setupHotkeys, setupHand: setupHand,
    updateHand: updateHand,
    get renderer() { return _renderer; },
    get scene() { return _scene; },
    get camera() { return _camera; },
    get started() { return _started; }, set started(v) { _started = v; },
    get locked() { return _locked; },
    get simTime() { return _simTime; }, set simTime(v) { _simTime = v; },
    get lastT() { return _lastT; }, set lastT(v) { _lastT = v; },
    get fog() { return _fog; },
    get ambLight() { return _ambLight; }
  };
})();

// ============================================================
//  天空/大气 / 上下船 / 主循环
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__MainInternal;
  var _tv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  var _skyCol = new THREE.Color();
  var _spaceCol = new THREE.Color(0x02040a);
  var _tmpCol = new THREE.Color();

  // ---------------- 天空与雾（无缝大气过渡） ----------------
  function updateSky() {
    var P = G.Player.state;
    var atmoF = 0, dayF = 0.5, planet = null;
    if (P.frame === 'planet') planet = P.planet;
    else {
      var near = G.Solar.nearestPlanet(P.camWorldPos);
      if (near.surfDist < (near.planet.atmosphere ? near.planet.atmosphere.h * 1.5 : 0)) planet = near.planet;
    }
    if (planet && planet.atmosphere) {
      var wp = P.camWorldPos;
      var alt = wp.distanceTo(planet.pos) - planet.radius;
      atmoF = U.clamp(1 - alt / (planet.atmosphere.h * 1.2), 0, 1);
      // 昼夜：头顶方向与太阳方向的夹角
      var up = _tv[0].copy(wp).sub(planet.pos).normalize();
      var toSun = _tv[1].copy(G.Solar.SUN.pos).sub(wp).normalize();
      dayF = U.clamp(up.dot(toSun) * 0.9 + 0.42, 0.04, 1);
      _skyCol.setHex(planet.skyColor).multiplyScalar(dayF);
      _tmpCol.copy(_spaceCol).lerp(_skyCol, atmoF);
    } else {
      _tmpCol.copy(_spaceCol);
    }
    IN.scene.background.copy(_tmpCol);
    // 雾
    var fogDense = 0;
    if (planet && planet.atmosphere) {
      fogDense = atmoF * (planet.atmosphere.fogDense ? 0.028 : 0.0035);
      IN.fog.color.setHex(planet.atmosphere.fog).multiplyScalar(Math.max(0.25, dayF));
    }
    IN.fog.density = fogDense;
    // 环境光随大气/昼夜（保持较高底亮度，保证能见度）
    IN.ambLight.intensity = 0.72 + atmoF * dayF * 0.45;
    // 星星在大气内淡出
    var r = window.__FarInternal && window.__FarInternal.refs;
    if (r && r.stars) r.stars.material.opacity = 1 - atmoF * dayF * 0.9;
  }

  // ---------------- 上下船 ----------------
  function enterShip() {
    var P = G.Player.state;
    P.inShip = true;
    G.Ship.state.doorOpen = true;
    G.SFX.play('ship_door');
    setTimeout(function() { G.Ship.state.doorOpen = false; }, 900);
    G.HUD.toast('已进入飞船 · <span class="keycap">R</span> 起飞 · 鼠标转向 · WASD+空格/Shift 推进', '#9fe8ff', 3600);
  }

  function exitShip() {
    var P = G.Player.state;
    var S = G.Ship.state;
    P.inShip = false;
    G.Ship.state.doorOpen = true;
    G.SFX.play('ship_door');
    setTimeout(function() { G.Ship.state.doorOpen = false; }, 1200);
    var door = G.Ship.doorWorldPos(_tv[0]);
    if (S.state === 'landed' && S.planet) {
      P.frame = 'planet';
      P.planet = S.planet;
      G.Solar.worldToLocal(S.planet, door, P.pos);
      P.pos.addScaledVector(_tv[1].copy(P.pos).normalize(), 0.6);
      P.vel.set(0, 0, 0);
      var up = P.pos.clone().normalize();
      P.ori.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    } else {
      P.frame = 'space';
      P.planet = null;
      P.pos.copy(door);
      P.vel.copy(S.vel);
      P.ori.copy(S.quat);
    }
    P.pitch = 0;
  }

  // 驾驶时把玩家"藏"进飞船（位置跟随，供距离判定/生命体征使用）
  function syncPlayerToShip() {
    var P = G.Player.state;
    if (!P.inShip) return;
    var S = G.Ship.state;
    var seat = G.Ship.seatWorldPos(_tv[0]);
    if (S.state === 'landed' && S.planet) {
      P.frame = 'planet';
      P.planet = S.planet;
      G.Solar.worldToLocal(S.planet, seat, P.pos);
      P.vel.set(0, 0, 0);
    } else {
      P.frame = 'space';
      P.planet = null;
      P.pos.copy(seat);
      P.vel.copy(S.vel);
    }
    // 相机 = 驾驶位
    P.camWorldPos.copy(seat);
    G.Ship.worldQuat(P.camWorldQuat);
    P.ori.copy(P.camWorldQuat);
  }

  IN.updateSky = updateSky;
  IN.enterShip = enterShip;
  IN.exitShip = exitShip;
  IN.syncPlayerToShip = syncPlayerToShip;
})();

// ============================================================
//  引导 / 标题界面 / 主循环入口
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__MainInternal;

  var _loadPhase = 'idle'; // idle -> building -> running
  var _testMode = location.search.indexOf('autostart') >= 0;
  function schedule(fn) {
    if (_testMode) setTimeout(function() { fn(performance.now()); }, 16);
    else requestAnimationFrame(fn);
  }

  function makeTitleStars() {
    var box = U.$('title-stars');
    var rng = U.mulberry(42);
    for (var i = 0; i < 90; i++) {
      var s = document.createElement('div');
      var sz = rng() < 0.8 ? 2 : 3;
      s.style.cssText = 'position:absolute;width:' + sz + 'px;height:' + sz + 'px;background:#fff;' +
        'left:' + (rng() * 100) + '%;top:' + (rng() * 100) + '%;opacity:' + (0.25 + rng() * 0.7) + ';';
      box.appendChild(s);
    }
  }

  function boot() {
    IN.fillRegistries();
    G.Textures.init();
    G.Icons.init();
    IN.setupRenderer();
    IN.setupPointer();
    IN.setupHotkeys();
    makeTitleStars();

    U.$('btn-start').addEventListener('click', function() { startClicked(false); });
    U.$('btn-creative').addEventListener('click', function() { startClicked(true); });
    function startClicked(creative) {
      if (_loadPhase !== 'idle') return;
      G.Creative = creative;
      _loadPhase = 'building';
      G.Audio.init();
      G.SFX.play('ui_click');
      U.$('btn-start').style.display = 'none';
      U.$('btn-creative').style.display = 'none';
      U.$('title-loading').style.display = 'block';
      // 先跑一次轨道，再建结构
      G.Solar.updateOrbits(0, 0);
      setTimeout(function() {
        G.Structures.buildAll();
        G.Chunks.init(IN.scene);
        G.FarLOD.init(IN.scene);
        IN.setupHand();
        schedule(loadingLoop);
      }, 60);
    }

    requestAnimationFrame(idleLoop);

    // 自动化测试入口：?autostart 直接开始（?creative 创造模式）
    if (location.search.indexOf('autostart') >= 0) {
      setTimeout(function() {
        U.$(location.search.indexOf('creative') >= 0 ? 'btn-creative' : 'btn-start').click();
      }, 200);
    }
  }

  function idleLoop(t) {
    if (_loadPhase === 'idle') {
      requestAnimationFrame(idleLoop);
    }
  }

  function loadingLoop(t) {
    // 分帧构建远景星球
    var done = G.FarLOD.buildStep();
    U.$('title-loading').textContent = '正在生成太阳系…… ' + Math.round(G.FarLOD.progress() * 100) + '%';
    if (!done) { schedule(loadingLoop); return; }
    startGame();
  }

  function startGame() {
    G.Screens.init();
    G.HUD.init();
    G.Gameplay.init();
    G.Ship.init(IN.scene);
    G.Player.respawn();
    // 预热出生点方块
    var pw = new THREE.Vector3();
    G.Solar.localToWorld(G.Player.state.planet, G.Player.state.pos, pw);
    for (var i = 0; i < 40; i++) G.Chunks.update(pw, 24);
    U.$('title-screen').style.transition = 'opacity 1.2s';
    U.$('title-screen').style.opacity = 0;
    setTimeout(function() { U.$('title-screen').style.display = 'none'; }, 1300);
    IN.started = true;
    _loadPhase = 'running';
    IN.lastT = performance.now();
    G.Main.lockPointer();
    G.HUD.toast('你在营火边醒来。<br><span style="font-size:13px">村口的挪麦石碑刻着发光文字——手持翻译机右键破译，学会驾驶飞船。</span>', '#ffe9a8', 6000);
    schedule(mainLoop);
  }

  function mainLoop(t) {
    schedule(mainLoop);
    var dt = Math.min(0.05, (t - IN.lastT) / 1000);
    IN.lastT = t;
    if (dt <= 0) return;
    IN.simTime += dt;
    var st = IN.simTime;

    // 1. 轨道
    G.Solar.updateOrbits(st, dt);
    // 2. 远景 & 组变换
    G.FarLOD.update(st, dt);
    // 3. 玩家 / 飞船
    G.Player.update(dt);
    G.Ship.update(dt, st);
    IN.syncPlayerToShip();
    // 4. 体素流
    G.Chunks.update(G.Player.state.camWorldPos, 6);
    // 5. 玩法
    G.Gameplay.update(dt);
    // 6. HUD / 天空 / 手持
    G.HUD.update(dt);
    IN.updateSky();
    IN.updateHand(dt, st);
    // 7. 相机 & 渲染
    IN.camera.position.copy(G.Player.state.camWorldPos);
    IN.camera.quaternion.copy(G.Player.state.camWorldQuat);
    IN.renderer.render(IN.scene, IN.camera);
  }

  G.Main = {
    get scene() { return IN.scene; },
    started: function() { return IN.started; },
    pointerLocked: function() { return IN.locked; },
    lockPointer: function() {
      var c = U.$('gl');
      if (c.requestPointerLock) {
        try { c.requestPointerLock(); } catch (e) {}
      }
    },
    enterShip: function() { IN.enterShip(); },
    exitShip: function() { IN.exitShip(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
