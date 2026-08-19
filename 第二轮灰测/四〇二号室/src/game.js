/* =============================================================================
 * game.js — 玩家、交互、事件调度、主循环
 * ===========================================================================*/
(function () {
  'use strict';
  var HZ = window.HZ;

  /* ============================ 玩家 ============================ */

  function Player(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 0, 2.6);
    this.vel = new THREE.Vector3();
    this.radius = 0.3;
    this.height = 1.62;
    this.yaw = 0;           // 面向 -z（走廊深处，与相机旋转约定一致）
    this.pitch = 0;
    this.bobPhase = 0;
    this.bobAmt = 0;
    this.crouch = 0;         // 0..1
    this.stamina = 1;
    this.battery = 1;
    this.flashOn = true;
    this.speedMul = 1;
    this.moving = false;
    this.stepAcc = 0;
    this.locked = false;
  }

  Player.prototype.update = function (dt, input, world, game) {
    if (game.scare.active || !this.locked) {
      // 视角由外部（指针锁定）控制；这里只做位移
    }
    var fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    var right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    var move = new THREE.Vector3();
    if (input.forward) move.add(fwd);
    if (input.back) move.sub(fwd);
    if (input.left) move.sub(right);
    if (input.right) move.add(right);
    if (move.lengthSq() > 0) move.normalize();

    var sprint = input.sprint && this.stamina > 0.05 && move.lengthSq() > 0;
    var speed = 2.35;
    if (sprint) { speed = 4.0; this.stamina = Math.max(0, this.stamina - dt * 0.16); }
    else this.stamina = Math.min(1, this.stamina + dt * 0.07);
    if (input.crouch) this.crouch = HZ.damp(this.crouch, 1, 8, dt);
    else this.crouch = HZ.damp(this.crouch, 0, 8, dt);
    speed *= HZ.lerp(1, 0.45, this.crouch);

    var target = move.clone().multiplyScalar(speed);
    this.vel.x = HZ.damp(this.vel.x, target.x, 14, dt);
    this.vel.z = HZ.damp(this.vel.z, target.z, 14, dt);

    // 移动 + 碰撞滑动（XZ 平面圆 vs AABB）
    this.pos.x += this.vel.x * dt;
    this._collide(world, 0);
    this.pos.z += this.vel.z * dt;
    this._collide(world, 1);

    // 头部摆动
    var spd = Math.hypot(this.vel.x, this.vel.z);
    this.moving = spd > 0.4;
    this.bobAmt = HZ.damp(this.bobAmt, this.moving ? (sprint ? 0.055 : 0.032) : 0, 8, dt);
    this.bobPhase += dt * (sprint ? 13 : 8.5) * (this.moving ? 1 : 0.2);
    var bobY = Math.sin(this.bobPhase * 2) * this.bobAmt;

    // 脚步声
    if (this.moving) {
      this.stepAcc += spd * dt;
      if (this.stepAcc > 1.9) {
        this.stepAcc = 0;
        game.audio.play('footstep');
      }
    }

    var eye = this.height * HZ.lerp(1, 0.72, this.crouch);
    this.camera.position.set(this.pos.x, eye + bobY, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // 手电筒电池
    if (this.flashOn) {
      this.battery = Math.max(0, this.battery - dt * 0.0026);
      if (this.battery <= 0) {
        this.flashOn = false;
        HZ.bus.emit('toast', '电池耗尽了……');
        game.audio.play('switch');
      }
    }
  };

  Player.prototype._collide = function (world, axis) {
    var cols = world.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (c.active === false || c.type === 'void') continue;
      var px = this.pos.x, pz = this.pos.z, r = this.radius;
      var cx = HZ.clamp(px, c.minX, c.maxX);
      var cz = HZ.clamp(pz, c.minZ, c.maxZ);
      var dx = px - cx, dz = pz - cz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          var d = Math.sqrt(d2);
          var nx = dx / d, nz = dz / d;
          if (axis === 0) this.pos.x = cx + nx * r;
          else this.pos.z = cz + nz * r;
        } else {
          // 圆心在盒内：推出最近面
          var pushL = px - (c.minX - r), pushR = (c.maxX + r) - px;
          var pushT = pz - (c.minZ - r), pushB = (c.maxZ + r) - pz;
          var m = Math.min(pushL, pushR, pushT, pushB);
          if (axis === 0) this.pos.x = (m === pushL) ? c.minX - r : (c.maxX + r);
          else this.pos.z = (m === pushT) ? c.minZ - r : (c.maxZ + r);
        }
      }
    }
    // 黑洞：掉下去 → 瞬移回起点 + 惊吓
    for (var v = 0; v < cols.length; v++) {
      var cv = cols[v];
      if (cv.type === 'void' &&
          this.pos.x > cv.minX && this.pos.x < cv.maxX &&
          this.pos.z > cv.minZ && this.pos.z < cv.maxZ) {
        HZ.bus.emit('voidFall', null);
        this.pos.set(0, 0, 2.6);
      }
    }
  };

  Player.prototype.setYaw = function (y) { this.yaw = y; };
  Player.prototype.setPitch = function (p) {
    this.pitch = HZ.clamp(p, -1.5, 1.5);
  };

  /* ============================ 事件调度 ============================ */

  function EventScheduler(game) {
    this.game = game;
    this.timer = 8;
    this.minInterval = 9;
    this.maxInterval = 22;
    this.pool = [];
    this.fired = {};
  }

  EventScheduler.prototype.pick = function () {
    var loop = this.game.world.loopCount;
    // 权重事件池（按循环解锁）
    var pool = [
      { id: 'flicker', w: 10, minLoop: 0 },
      { id: 'slam', w: 8, minLoop: 0 },
      { id: 'shadow', w: 6, minLoop: 1 },
      { id: 'footsteps', w: 8, minLoop: 1 },
      { id: 'whisperNear', w: 7, minLoop: 2 },
      { id: 'tvGhost', w: 5, minLoop: 2 },
      { id: 'photoChange', w: 4, minLoop: 2 },
      { id: 'doorsOpen', w: 5, minLoop: 3 },
      { id: 'phone', w: 6, minLoop: 3 },
      { id: 'flashDead', w: 5, minLoop: 3 },
      { id: 'movedChair', w: 4, minLoop: 4 },
      { id: 'stalkerGlimpse', w: 5, minLoop: 4 }
    ];
    var avail = pool.filter(function (p) { return p.minLoop <= loop; });
    var total = 0;
    for (var i = 0; i < avail.length; i++) total += avail[i].w;
    var r = Math.random() * total;
    for (var j = 0; j < avail.length; j++) {
      r -= avail[j].w;
      if (r <= 0) return avail[j].id;
    }
    return 'flicker';
  };

  EventScheduler.prototype.update = function (dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    var game = this.game;
    this.timer = HZ.lerp(this.maxInterval, this.minInterval, HZ.clamp(game.dread, 0, 1)) *
      HZ.range(HZ.rng(Math.floor(Math.abs(this.timer) * 97)), 0.7, 1.4);
    var id = this.pick();
    this.run(id);
  };

  EventScheduler.prototype.run = function (id) {
    var game = this.game;
    var world = game.world;
    var audio = game.audio;
    var rnd = HZ.rng(id.length * 31 + 7);

    // 防御：单个随机事件出错绝不能拖垮整个游戏
    try {
      this._runCase(id, game, world, audio, rnd);
    } catch (e) {
      console.error('[HZ event]', id, e);
      HZ.bus.emit('toast', '事件异常（已忽略）');
    }
  };

  EventScheduler.prototype._runCase = function (id, game, world, audio, rnd) {
    switch (id) {
      case 'flicker':
        // 走廊灯集体狂闪
        for (var i = 0; i < world.corridorLights.length; i++) {
          var l = world.corridorLights[i];
          if (!l.dead) { l.flicker = 18; l.base = 1.1; }
        }
        setTimeout(function () {
          for (var j = 0; j < world.corridorLights.length; j++) {
            world.corridorLights[j].flicker = 2;
          }
        }, 2200);
        audio.play('lightsOut');
        HZ.bus.emit('subtitle', '灯在闪。');
        break;

      case 'slam':
        audio.play('doorClose');
        audio.play('thump', { freq: 60 });
        HZ.bus.emit('subtitle', 'どこかで……（哪里传来了关门声）');
        break;

      case 'shadow':
        game.spawnShadow();
        break;

      case 'footsteps':
        game.fakeFootsteps();
        break;

      case 'whisperNear':
        audio.play('whisper', { dur: 2.6, pan: rnd() < 0.5 ? -0.95 : 0.95 });
        HZ.bus.emit('subtitle', 'かえして……（还给我……）');
        break;

      case 'tvGhost':
        if (world.tv && !world.tv.on) {
          world.toggleTV(game);
          setTimeout(function () { if (world.tv && world.tv.on) world.toggleTV(game); }, 5000);
        }
        break;

      case 'photoChange':
        if (world.shrine && world.shrine.photo) {
          world.shrine.photo.material = new THREE.MeshBasicMaterial({
            color: 0x000000, side: THREE.DoubleSide
          });
          audio.play('paper');
        }
        break;

      case 'doorsOpen':
        for (var d = 0; d < world.doors.length; d++) {
          var door = world.doors[d];
          if (!door.open && !door.locked) {
            door.open = true;
            door.target = (door.spec.side > 0 ? -1 : 1) * 0.3;
            door.state = 'opening';
            door.collider.active = false;
          }
        }
        audio.play('doorOpen');
        HZ.bus.emit('subtitle', 'すべての扉が……（所有的门，都开了）');
        break;

      case 'phone':
        audio.play('phone');
        HZ.bus.emit('subtitle', '电话。没有人接。');
        break;

      case 'flashDead':
        game.player.flashOn = false;
        audio.play('switch');
        HZ.bus.emit('toast', '手电筒……灭了？');
        setTimeout(function () {
          if (!game.player.flashOn) {
            game.player.flashOn = true;
            audio.play('switch');
          }
        }, 4000);
        break;

      case 'movedChair':
        if (world.chair) {
          world.chair.rotation.y += Math.PI * 0.9;
          world.chair.position.x += 0.5;
          audio.play('creak');
          HZ.bus.emit('subtitle', '椅子……不在原地。');
        }
        break;

      case 'stalkerGlimpse':
        if (game.stalker && !game.stalker.visible) {
          game.stalker.teleport(
            new THREE.Vector3(0, 0, game.player.pos.z - 14), 'stand');
          game.stalker.vanishTimer = 2.2;
          audio.play('stinger', 0.35);
        }
        break;
    }
  };

  /* ============================ 游戏主体 ============================ */

  function Game(renderer, postfx) {
    this.renderer = renderer;
    this.postfx = postfx;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1018);
    this.scene.fog = new THREE.FogExp2(0x0a1018, 0.055);

    this.camera = new THREE.PerspectiveCamera(
      HZ.settings.fov, 1, 0.08, 90);
    this.camera.rotation.order = 'YXZ';

    this.world = new HZ.World(this.scene);
    this.player = new Player(this.camera);
    this.audio = new HZ.AudioSys();
    this.scheduler = new EventScheduler(this);
    this.stalker = null;
    this.mannequins = [];
    this.shadows = [];
    this.loopCount = 0;
    this.dread = 0;
    this.darkness = 0;
    this.elapsed = 0;
    this.scare = { active: false, t: 0 };
    this.notes = {};
    this.input = {
      forward: false, back: false, left: false, right: false,
      sprint: false, crouch: false
    };
    this.clock = new THREE.Clock();
    this.ready = false;
    this.started = false;
    this.glitch = 0;
    this.fading = false;

    this._buildNotes();
    this._buildFlashlight();
    this._bindInput();
    this._bindBus();

    // PS1 材质补丁（顶点抖动 + 仿射 UV）
    HZ.PS1.patchScene(this.scene);

    // 阴影（动态）
    if (HZ.settings.shadows) {
      try {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
      } catch (e) { HZ.settings.shadows = false; }
    }
  }

  /** 测试/调试钩子 */
  Game.prototype.teleportPlayer = function (x, y, z, yaw) {
    this.player.pos.set(x, y || 0, z);
    this.player.yaw = yaw !== undefined ? yaw : 0;
    this.player.setPitch(0);
  };
  Game.prototype.forceLoop = function (n) {
    this.loopCount = n;
    this.world.applyLoop(n);
    this.teleportPlayer(0, 0, 2.4);
  };

  Game.prototype._buildNotes = function () {
    this.notes = {
      familyNote: {
        title: '发黄的信纸',
        jp: 'おかあさん、ごめんなさい。',
        zh: '妈妈，对不起。\n\n水槽の下の鍵は、もう捨てた。\n水槽下面的钥匙，已经扔掉了。\n\nわたしは、ちゃんとやります。\n我会好好做的。'
      },
      bathNote: {
        title: '湿透的纸条',
        jp: 'おふろ、ひとりではいれるよ。',
        zh: '我可以一个人洗澡了。\n\nでも、せんめんじょの かがみを みないで。\n但是，不要看洗手池上的镜子。\n\nみているから。\n因为它也在看着。'
      },
      storageNote: {
        title: '揉皱的纸',
        jp: 'さんにんめは どこ？',
        zh: '第三个人在哪里？\n\n（纸被反复涂抹，只能认出这些字）\n\nおとうとを なおして。\n把弟弟修好。'
      },
      drawing1: {
        title: '蜡笔画',
        jp: 'かぞくのえ。',
        zh: '（一家人的画。三个人。\n其中一个的脸被黑色的蜡笔涂掉了。）'
      },
      news0: {
        title: '旧报纸',
        jp: '新聞の切れ端。',
        zh: '（平成十七年七月十三日。\n一则豆腐块新闻：某公寓住户失踪。\n照片被撕掉了。）'
      },
      loop1: {
        title: '日记（一）',
        jp: 'また、おなじ ろうか。',
        zh: '又是同一条走廊。\n\n我明明一直往前走。\n玄关在哪里？'
      },
      loop2: {
        title: '日记（二）',
        jp: '四〇二号室。',
        zh: '四〇二号室。\n\n它记得我。\n它一直在那里。'
      },
      loop3: {
        title: '日记（三）',
        jp: 'ここは もう、わたしの いえでは ない。',
        zh: '这里已经不是我的家了。\n\n但我也已经不是我了。'
      },
      voidFall: {
        title: '……',
        jp: 'おちた。',
        zh: '我掉下去了。\n\n又回到了这里。\n走廊。'
      }
    };
  };

  Game.prototype._buildFlashlight = function () {
    // 手电筒 SpotLight（挂在相机）
    var light = new THREE.SpotLight(0xdfe8ff, 2.1, 26, 0.55, 0.45, 1.6);
    light.position.set(0.12, -0.08, 0.1);
    light.target.position.set(0, 0, -1);
    this.camera.add(light);
    this.camera.add(light.target);
    this.scene.add(this.camera);
    this.flash = light;
    if (HZ.settings.shadows) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = 30;
      light.shadow.bias = -0.0012;
      light.shadow.normalBias = 0.03;
    }
    // 体积光锥（additive 圆筒光柱）
    var coneGeo = new THREE.CylinderGeometry(0.05, 2.6, 6.5, 12, 6, true);
    var coneMat = new THREE.MeshBasicMaterial({
      map: HZ.Tex.get('coneFalloff', 1, 1),
      color: 0xbfd4ff, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false
    });
    this.cone = new THREE.Mesh(coneGeo, coneMat);
    this.cone.position.set(0, 0, -3.4);
    this.cone.rotation.x = Math.PI / 2;
    this.cone.frustumCulled = false;
    this.camera.add(this.cone);
  };

  Game.prototype._bindInput = function () {
    var self = this;
    var KEYMAP = {
      KeyW: 'forward', ArrowUp: 'forward',
      KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right'
    };
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      if (e.code in KEYMAP) { self.input[KEYMAP[e.code]] = true; }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') self.input.sprint = true;
      if (e.code === 'ControlLeft' || e.code === 'KeyC') self.input.crouch = true;
      if (e.code === 'KeyF') self.toggleFlash();
      if (e.code === 'KeyE') self.tryInteract();
      if (e.code === 'KeyR') self.tryReadNote();
    });
    window.addEventListener('keyup', function (e) {
      if (e.code in KEYMAP) { self.input[KEYMAP[e.code]] = false; }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') self.input.sprint = false;
      if (e.code === 'ControlLeft' || e.code === 'KeyC') self.input.crouch = false;
    });
    window.addEventListener('mousemove', function (e) {
      if ((!self.player.locked && !self.debugMode) || self.noteOpen || self.paused) return;
      var dx = e.movementX || 0, dy = e.movementY || 0;
      self.player.yaw -= dx * HZ.settings.sensitivity;
      var inv = HZ.settings.invertY ? -1 : 1;
      self.player.setPitch(self.player.pitch - dy * HZ.settings.sensitivity * inv);
    });
    window.addEventListener('resize', function () { self.onResize(); });

    /* 指针锁定：失去锁 → 显示暂停菜单（除非在读笔记） */
    document.addEventListener('pointerlockchange', function () {
      var locked = document.pointerLockElement === self.renderer.domElement;
      self.player.locked = locked;
      if (!locked && self.started && !self.noteOpen && !self.scare.active && !self.fading) {
        self.setPaused(true);
      }
    });
    /* 点击画布重新捕获（从暂停/笔记返回） */
    self.renderer.domElement.addEventListener('click', function () {
      if (self.started && !self.paused && !self.noteOpen && !self.scare.active) {
        self._acquireLock();
      }
    });
    /* 暂停菜单快捷键 */
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Escape' && self.started && !self.noteOpen) {
        if (self.paused) self.resume();
        else self.setPaused(true);
      }
      if (e.code === 'F2') { self.settingsToggle('showFps'); }
      if (e.code === 'F3') { self.settingsToggle('vertexSnap'); self.toast('PS1 顶点抖动：' + (HZ.settings.vertexSnap ? '开' : '关')); }
      if (e.code === 'F4') { self.settingsToggle('affineUV'); self.toast('仿射 UV：' + (HZ.settings.affineUV ? '开' : '关')); }
    });
  };

  Game.prototype._bindBus = function () {
    var self = this;
    HZ.bus.on('trigger', function (id) {
      if (id === 'firstStep') {
        self.subtitle('戻れない……（回不去了……）');
        self.audio.play('breath', { pan: 0.4 });
      } else if (id === 'midway' && self.loopCount === 0) {
        self.subtitle('这条走廊，有这么长吗？');
      } else if (id === 'deep') {
        self.audio.play('creak');
      } else if (id === 'nearEnd' && self.loopCount === 0) {
        self.subtitle('尽头是一扇门。');
      } else if (id === 'atEnd') {
        self.audio.play('thump', { freq: 45 });
      }
    });
    HZ.bus.on('voidFall', function () {
      self.readNote('voidFall');
      self.audio.play('stinger', 0.4);
    });
    HZ.bus.on('toast', function (msg) { self.toast(msg); });
    HZ.bus.on('subtitle', function (msg) { self.subtitle(msg); });
    HZ.bus.on('stinger', function (g) { self.audio.play('stinger', g); });
  };

  /* ---------------- UI 反馈 ---------------- */

  Game.prototype.subtitle = function (text, dur) {
    var el = HZ.$('#subtitle');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this._subT);
    this._subT = setTimeout(function () { el.classList.remove('show'); }, (dur || 3.6) * 1000);
  };

  Game.prototype.toast = function (text) {
    var el = HZ.$('#toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(function () { el.classList.remove('show'); }, 2400);
  };

  Game.prototype.prompt = function (text) {
    var el = HZ.$('#prompt');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('show', !!text);
  };

  /* ---------------- 笔记 ---------------- */

  Game.prototype.readNote = function (id) {
    var note = this.notes[id];
    if (!note) return;
    this.noteOpen = id;
    var box = HZ.$('#noteBox');
    var title = HZ.$('#noteTitle');
    var body = HZ.$('#noteBody');
    if (box && title && body) {
      title.textContent = note.title;
      body.innerHTML = note.jp + '<br><br>' + note.zh.replace(/\n/g, '<br>');
      box.classList.add('show');
    }
    if (this.player) this.player.locked = false;
    this._exitLock();
  };

  Game.prototype.tryReadNote = function () {
    if (this.noteOpen) this.closeNote();
  };

  Game.prototype.closeNote = function () {
    this.noteOpen = null;
    var box = HZ.$('#noteBox');
    if (box) box.classList.remove('show');
    this._acquireLock();
  };

  /* ---------------- 交互 ---------------- */

  Game.prototype.raycastTarget = function (maxDist) {
    var origin = this.camera.position;
    var dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    var targets = this.world.interactives || [];
    var raycaster = new THREE.Raycaster(origin, dir, 0.1, maxDist || 2.6);
    var hits = raycaster.intersectObjects(targets, true);
    return hits.length ? hits[0].object : null;
  };

  Game.prototype.tryInteract = function () {
    if (this.noteOpen || (!this.player.locked && !this.debugMode) || this.paused) return;
    var obj = this.raycastTarget(2.6);
    if (obj) this.world.interact(obj, this);
  };

  Game.prototype.toggleFlash = function () {
    if (this.noteOpen || this.paused) return;
    var p = this.player;
    if (!p.flashOn && p.battery <= 0) {
      this.toast('没有电池了');
      return;
    }
    p.flashOn = !p.flashOn;
    this.audio.play('switch');
  };

  /* ---------------- 指针锁定 ---------------- */

  Game.prototype._acquireLock = function () {
    if (this.paused || this.noteOpen) return;
    var cv = this.renderer.domElement;
    var lock = cv.requestPointerLock ||
      cv.mozRequestPointerLock || cv.webkitRequestPointerLock;
    if (lock) {
      try {
        var p = lock.call(cv);
        // 吞掉 NotAllowedError（无用户手势 / 自动测试），避免全局兜底误判为崩溃
        if (p && typeof p.catch === 'function') {
          p.catch(function () { /* pointer lock 未授予，忽略 */ });
        }
      } catch (e) { /* noop */ }
    }
  };

  Game.prototype._exitLock = function () {
    try {
      if (document.exitPointerLock) document.exitPointerLock();
    } catch (e) { /* noop */ }
  };

  Game.prototype.setPaused = function (p) {
    this.paused = p;
    var menu = HZ.$('#pauseMenu');
    if (menu) menu.classList.toggle('show', p);
    if (p) this._exitLock();
  };

  Game.prototype.resume = function () {
    this.setPaused(false);
    var self = this;
    setTimeout(function () { self._acquireLock(); }, 60);
  };

  Game.prototype.settingsToggle = function (key) {
    var v = !HZ.settings[key];
    HZ.settings[key] = v;
    HZ.saveSettings();
    return v;
  };

  Game.prototype.applySettings = function (updates) {
    for (var k in updates) {
      if (k in HZ.settings) HZ.settings[k] = updates[k];
    }
    HZ.saveSettings();
    this.camera.fov = HZ.settings.fov;
    this.camera.updateProjectionMatrix();
    this.audio.setVolume(HZ.settings.volume);
    if (this.postfx) this.postfx.resize();
    // 重新打补丁（vertexSnap/affineUV 变化 → 程序缓存键变化）
    HZ.PS1.patchScene(this.scene);
    this.onResize();
  };

  /* ---------------- 事件效果 ---------------- */

  Game.prototype.spawnShadow = function () {
    // 视野前方的黑影，一闪而过
    var geo = new THREE.PlaneGeometry(0.5, 1.9);
    var mat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, depthWrite: false
    });
    var m = new THREE.Mesh(geo, mat);
    var fwd = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
    var p = this.player.pos.clone().add(fwd.clone().multiplyScalar(HZ.range(Math.random, 3, 7)));
    p.y = 0.95;
    m.position.copy(p);
    m.lookAt(this.camera.position);
    this.scene.add(m);
    this.shadows.push(m);
    var self = this;
    setTimeout(function () {
      self.scene.remove(m);
      geo.dispose(); mat.dispose();
      var i = self.shadows.indexOf(m);
      if (i >= 0) self.shadows.splice(i, 1);
    }, 380);
    this.audio.play('breath', { pan: HZ.range(Math.random, -0.7, 0.7) });
  };

  Game.prototype.fakeFootsteps = function () {
    var self = this;
    var n = 3;
    var pan = Math.random() < 0.5 ? -0.5 : 0.5;
    (function step(i) {
      if (i >= n) return;
      self.audio.play('footstep');
      setTimeout(function () { step(i + 1); }, HZ.range(Math.random, 380, 620));
    })(0);
    this.subtitle('后ろ……（后面有脚步声）', 2.2);
  };

  /* ---------------- 循环传送 ---------------- */

  Game.prototype.loopWorld = function () {
    var self = this;
    // 黑屏过渡
    this.fading = true;
    this.fadeTo(1, 0.7, function () {
      self.loopCount++;
      self.world.applyLoop(self.loopCount);
      self.player.pos.set(0, 0, 2.6);
      self.player.yaw = 0;
      self.player.setPitch(0);
      // 循环剧情推进
      if (self.loopCount === 1) self.readNote('loop1');
      else if (self.loopCount === 2) self.readNote('loop2');
      else if (self.loopCount === 3) {
        self.readNote('loop3');
        self.audio.play('lightsOut');
      } else if (self.loopCount === 4 && !self.stalker) {
        self.spawnStalker();
      } else if (self.loopCount > 4 && self.stalker && !self.stalker.visible) {
        self.stalker.teleport(new THREE.Vector3(0, 0, -30), 'stand');
      }
      self.fading = false;
      self.fadeTo(0, 1.2);
    });
  };

  Game.prototype.spawnStalker = function () {
    this.stalker = new HZ.Stalker(this.scene, {
      pos: new THREE.Vector3(0, 0, -40),
      scale: 1.06,
      speed: 0.85
    });
    this.stalker.body.group.rotation.y = 0;
    this.stalker.setVisible(false);
    var self = this;
    // 玩家的回调上下文
    this.stalkerCtx = {
      playerPos: this.player.pos,
      lookDir: new THREE.Vector3(),
      camPos: this.camera.position,
      flashOn: this.player.flashOn,
      flashRange: 24,
      onStep: function (pos) { self.audio.play('footstep'); },
      onCatch: function () { self.onCaught(); }
    };
    // 22 秒后现身
    setTimeout(function () {
      if (self.stalker && !self.stalker.visible && self.loopCount >= 4) {
        self.stalker.teleport(new THREE.Vector3(0, 0, self.player.pos.z - 16), 'stand');
        self.subtitle('廊下の先に……（走廊的尽头，有什么站着）');
        self.audio.play('stinger', 0.3);
      }
    }, 22000);
  };

  Game.prototype.onCaught = function () {
    var self = this;
    this.scare.active = true;
    this.scare.t = 0;
    this.glitch = 1;
    this.audio.play('stinger', 0.9);
    this.audio.play('static', { dur: 1.6 });
    var face = HZ.$('#scareFace');
    if (face) face.classList.add('show');
    setTimeout(function () {
      if (face) face.classList.remove('show');
      self.scare.active = false;
      self.loopCount = Math.max(0, self.loopCount - 1);
      self.world.applyLoop(self.loopCount);
      self.player.pos.set(0, 0, 2.6);
      self.player.yaw = 0;
      if (self.stalker) { self.stalker.setVisible(false); self.stalker.state = 'stand'; }
      self.subtitle('目が覚めた……ここは。');
    }, 1500);
  };

  /* ---------------- 淡入淡出 ---------------- */

  Game.prototype.fadeTo = function (target, dur, done) {
    var el = HZ.$('#fade');
    if (!el) { if (done) done(); return; }
    el.style.transition = 'opacity ' + dur + 's ease';
    el.style.opacity = target;
    var self = this;
    clearTimeout(this._fadeT);
    this._fadeT = setTimeout(function () {
      if (done) done();
    }, dur * 1000);
  };

  /* ---------------- 主循环 ---------------- */

  Game.prototype.start = function () {
    if (this.ready) return;
    this.ready = true;
    this.started = true;
    this.onResize();
    this.audio.init();
    this.audio.play('static', { dur: 0.5 });
    this.subtitle('ようこそ。四〇二号室へ。', 4);
    var self = this;
    this._raf = requestAnimationFrame(function loop() {
      self._frame();
      self._raf = requestAnimationFrame(loop);
    });
  };

  /** 测试钩子：?autostart=1 时跳过标题画面直接进入 */
  Game.prototype.autostart = function () {
    var self = this;
    // 无头/自动化环境拿不到指针锁 → 用 debugMode 豁免"需要锁定"的检查
    this.debugMode = true;
    setTimeout(function () {
      var title = HZ.$('#titleScreen');
      if (title) title.classList.remove('show');
      self.start();
      setTimeout(function () { self._acquireLock(); }, 100);
    }, 150);
  };

  Game.prototype._frame = function () {
    var dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    if (!this.paused && !this.noteOpen) {
      this.player.update(dt, this.input, this.world, this);

      // 环境光照：手电筒
      var p = this.player;
      this.flash.visible = p.flashOn;
      this.cone.visible = p.flashOn;
      if (p.flashOn) {
        var low = p.battery < 0.25;
        var fl = low ? (0.55 + Math.sin(this.elapsed * 23) * 0.45) : 1;
        this.flash.intensity = 2.1 * fl;
        this.cone.material.opacity = 0.16 * fl;
      }
      // 相机轻微摇摆
      var sway = Math.sin(this.elapsed * 1.1) * 0.004;
      this.camera.rotation.z = sway;

      // 黑暗度 & 恐惧值
      this.darkness = p.flashOn ? 0.25 : 0.95;
      this.dread = HZ.clamp(
        this.darkness * 0.5 +
        (this.stalker && this.stalker.visible ?
          HZ.clamp(1 - this.stalker.pos.distanceTo(p.pos) / 22, 0, 1) * 0.6 : 0) +
        this.loopCount * 0.04, 0, 1);

      // 怪物
      if (this.stalker) {
        var ctx = this.stalkerCtx;
        ctx.playerPos.copy(p.pos);
        this.camera.getWorldDirection(ctx.lookDir);
        ctx.lookDir.y = 0; ctx.lookDir.normalize();
        ctx.camPos.copy(this.camera.position);
        ctx.flashOn = p.flashOn;
        this.stalker.update(dt, this.elapsed, ctx);
        // 短暂现身自动消失
        if (this.stalker.vanishTimer) {
          this.stalker.vanishTimer -= dt;
          if (this.stalker.vanishTimer <= 0) {
            this.stalker.vanishTimer = 0;
            this.stalker.vanish();
          }
        }
      }
      // 人偶（第 6 圈起：和室里的"一家人"）
      if (this.loopCount >= 6 && this.world.mannequins.length === 0) {
        this.world.spawnFamily();
        this.subtitle('和室に、家族がいる。（和室里，有一家人。）');
        this.audio.play('stinger', 0.4);
      }
      var lookTmp = new THREE.Vector3();
      for (var i = 0; i < this.world.mannequins.length; i++) {
        this.world.mannequins[i].update(dt, this.elapsed, {
          camPos: this.camera.position,
          lookDir: this.camera.getWorldDirection(lookTmp)
        });
      }

      this.world.update(dt, this.elapsed, this.camera.position);
      this.scheduler.update(dt);
    }

    // 音频状态
    this.audio.update(dt, { dread: this.dread, darkness: this.darkness });

    // 交互提示
    if ((this.player.locked || this.debugMode) && !this.noteOpen && !this.paused) {
      var obj = this.raycastTarget(2.6);
      if (obj && obj.userData.pickup) this.prompt('[E] ' + (obj.userData.pickup.label || '查看'));
      else if (obj && obj.userData.door) {
        var d = null;
        for (var k = 0; k < this.world.doors.length; k++) {
          if (this.world.doors[k].mesh === obj || this.world.doors[k].group === obj) { d = this.world.doors[k]; break; }
        }
        if (d) this.prompt(d.locked ? '[E] 门锁着' : (d.open ? '[E] 关门' : '[E] 开门'));
      }
      else if (obj && obj.userData.tv) this.prompt('[E] 电视');
      else if (obj && obj.userData.lightSwitch) this.prompt('[E] 电灯开关');
      else if (obj && obj.userData.portal) this.prompt('[E] 推开尽头的大门');
      else if (obj && obj.userData.entrance) this.prompt('[E] 玄关门（锁死）');
      else this.prompt('');
    } else this.prompt('');

    // HUD：电池
    var bat = HZ.$('#batteryFill');
    if (bat) bat.style.width = Math.round(this.player.battery * 100) + '%';

    // 渲染（后处理或直出）
    var self = this;
    // 惊吓白噪 / 恐惧扰动强度（向 0 衰减）
    this.glitch = Math.max(0, this.glitch - dt * 1.8);
    try {
      if (this.postfx && !HZ.flag('raw', false)) {
        this.postfx.render(this.scene, this.camera, dt, {
          dread: this.dread,
          glitch: this.scare.active ? 1 : this.glitch
        });
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    } catch (e) {
      console.error(e);
      if (!this._ps1Fatal) {
        this._ps1Fatal = true;
        HZ.PS1.disablePatches(this.scene);
        this.toast('已切换到兼容渲染模式');
      }
      this.renderer.render(this.scene, this.camera);
    }
  };

  Game.prototype.onResize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.postfx) this.postfx.resize();
  };

  HZ.Game = Game;
  HZ.EventScheduler = EventScheduler;
})();
