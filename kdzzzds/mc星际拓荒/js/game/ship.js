"use strict";
// ============================================================
//  方块星野 BlockWilds - 飞船
//  方块化飞船建模 / 全物理飞行 / 起飞降落 / 舱门与引擎动画
// ============================================================
window.G = window.G || {};

(function() {
  var U = G.U;

  var S = {
    group: null,
    state: 'landed',            // 'landed' | 'flying'
    planet: null,               // landed 时所在星球
    localPos: new THREE.Vector3(),
    localQuat: new THREE.Quaternion(),
    pos: new THREE.Vector3(),   // flying: 世界坐标
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    angVel: new THREE.Vector3(),
    fuel: 100, hull: 100,
    thrustLevel: 0,
    doorOpen: false, doorAnim: 0,
    legAnim: 1,
    flames: [], flameLight: null,
    doorMesh: null, legs: [],
    landedTimer: 0
  };

  var _tv = [];
  for (var i = 0; i < 8; i++) _tv.push(new THREE.Vector3());
  var _tq = [new THREE.Quaternion(), new THREE.Quaternion()];

  // ---------------- 建模：方块化小飞船 ----------------
  function tileMat(name, opts) {
    var cv = G.Textures.tileCanvas(name);
    var tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    var p = { map: tex };
    if (opts) for (var k in opts) p[k] = opts[k];
    return new THREE.MeshLambertMaterial(p);
  }

  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  function buildShip() {
    var g = new THREE.Group();
    var mMetal = tileMat('metal');
    var mPad = tileMat('launch_pad');
    var mGlass = tileMat('glass', { transparent: true, opacity: 0.55, depthWrite: false });
    var mWood = tileMat('planks');
    var mLamp = tileMat('nomai_lamp', { emissive: new THREE.Color(0x55e6c8), emissiveIntensity: 0.6 });

    // 主舱体
    g.add(box(3, 2.2, 4, mMetal, 0, 1.6, 0));
    // 驾驶舱（前部玻璃）
    g.add(box(2.2, 1.4, 1.2, mGlass, 0, 2.9, -1.8));
    g.add(box(2.6, 0.5, 1.6, mMetal, 0, 2.35, -1.6));
    // 机翼
    g.add(box(6.4, 0.4, 1.6, mMetal, 0, 1.1, 0.8));
    g.add(box(0.5, 1.4, 1.4, mPad, -3.0, 1.6, 0.8));
    g.add(box(0.5, 1.4, 1.4, mPad, 3.0, 1.6, 0.8));
    // 尾部引擎舱
    g.add(box(2.2, 1.8, 1.2, mPad, 0, 1.5, 2.4));
    // 内饰
    g.add(box(1.2, 0.6, 0.6, mWood, 0, 1.0, -1.2));
    g.add(box(0.4, 0.4, 0.4, mLamp, 0, 2.4, 0.6));

    // 舱门（右侧滑门）
    var door = box(0.25, 1.7, 1.2, mMetal, 1.62, 1.3, 0.2);
    g.add(door);
    S.doorMesh = door;

    // 着陆腿×4
    var legPos = [[-1.3, 0, -1.4], [1.3, 0, -1.4], [-1.3, 0, 1.6], [1.3, 0, 1.6]];
    for (var i = 0; i < 4; i++) {
      var leg = box(0.3, 1.3, 0.3, mMetal, legPos[i][0], 0.15, legPos[i][2]);
      g.add(leg);
      S.legs.push(leg);
    }

    // 引擎喷口 + 尾焰
    var flameGeo = new THREE.ConeGeometry(0.42, 1.6, 6);
    var flameMat = new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    var flameMat2 = new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    var nozzles = [[-0.8, 0.9, 3.1], [0.8, 0.9, 3.1]];
    for (var j = 0; j < 2; j++) {
      var nz = box(0.7, 0.7, 0.5, mPad, nozzles[j][0], nozzles[j][1], nozzles[j][2] - 0.2);
      g.add(nz);
      var fl = new THREE.Mesh(flameGeo, flameMat);
      fl.rotation.x = -Math.PI / 2;
      fl.position.set(nozzles[j][0], nozzles[j][1], nozzles[j][2] + 0.9);
      g.add(fl);
      var fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.0, 6), flameMat2);
      fl2.rotation.x = -Math.PI / 2;
      fl2.position.copy(fl.position);
      g.add(fl2);
      S.flames.push(fl, fl2);
    }
    // 底部升空喷口尾焰
    var bells = [[-1.0, 0.35, 0], [1.0, 0.35, 0]];
    for (var b = 0; b < 2; b++) {
      var fl3 = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.3, 6), flameMat);
      fl3.rotation.x = Math.PI;
      fl3.position.set(bells[b][0], bells[b][1] - 0.6, bells[b][2]);
      g.add(fl3);
      S.flames.push(fl3);
    }

    S.flameLight = new THREE.PointLight(0xff9a40, 0, 26, 2);
    S.flameLight.position.set(0, 0.6, 2.6);
    g.add(S.flameLight);

    // 指示灯（待机慢闪）
    var beacon = box(0.25, 0.25, 0.25, new THREE.MeshBasicMaterial({ color: 0xff4040 }));
    beacon.position.set(0, 3.9, 0.5);
    g.add(beacon);
    S.beacon = beacon;

    return g;
  }

  window.__ShipInternal = { S: S, buildShip: buildShip, tv: _tv, tq: _tq };
})();

// ============================================================
//  飞船物理 / 驾驶 / 起降 / 声音与动画
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__ShipInternal;
  var S = IN.S;
  var _tv = IN.tv;
  var _tq = IN.tq;
  var _lp = new THREE.Vector3();

  // 船体碰撞采样点（本地坐标：腿底+舱底）
  var HULL_PTS = [
    new THREE.Vector3(-1.3, -0.5, -1.4), new THREE.Vector3(1.3, -0.5, -1.4),
    new THREE.Vector3(-1.3, -0.5, 1.6), new THREE.Vector3(1.3, -0.5, 1.6),
    new THREE.Vector3(0, 0.6, -2.2), new THREE.Vector3(0, 0.6, 2.9),
    new THREE.Vector3(-3.1, 1.1, 0.8), new THREE.Vector3(3.1, 1.1, 0.8),
    new THREE.Vector3(0, 3.6, 0)
  ];

  function worldPos(out) {
    if (S.state === 'landed' && S.planet) return G.Solar.localToWorld(S.planet, S.localPos, out);
    return out.copy(S.pos);
  }
  function worldQuat(out) {
    if (S.state === 'landed' && S.planet) return out.copy(S.planet.quat).multiply(S.localQuat);
    return out.copy(S.quat);
  }

  function takeOff() {
    if (S.state !== 'landed') return;
    var p = S.planet;
    S.pos.copy(G.Solar.localToWorld(p, S.localPos, _tv[0]));
    S.quat.copy(p.quat).multiply(S.localQuat);
    S.vel.copy(G.Player.surfaceVelAt(p, S.localPos, _tv[1]));
    S.angVel.set(0, 0, 0);
    S.state = 'flying';
    S.legAnim = 1;
  }

  function land(planet) {
    S.planet = planet;
    G.Solar.worldToLocal(planet, S.pos, S.localPos);
    S.localQuat.copy(_tq[0].copy(planet.quat).invert().multiply(S.quat));
    S.state = 'landed';
    G.SFX.play('landing_thud', 0.8);
  }

  function updateFlying(dt) {
    var driving = G.Player.state.inShip;
    var keys = G.Input.keys;
    var thrust = _tv[0].set(0, 0, 0);
    var boost = keys['ControlLeft'] ? 2.2 : 1;

    if (driving && !G.Screens.isOpen()) {
      // 鼠标 -> 角速度（俯仰/偏航），QE 滚转
      var m = G.Input.consumeMouse();
      var sens = 0.0032;
      S.angVel.x += -m[1] * sens;
      S.angVel.y += -m[0] * sens;
      if (keys['KeyQ']) S.angVel.z += dt * 2.2;
      if (keys['KeyE']) S.angVel.z -= dt * 2.2;
      if (keys['KeyW']) thrust.z -= 1;
      if (keys['KeyS']) thrust.z += 1;
      if (keys['KeyA']) thrust.x -= 1;
      if (keys['KeyD']) thrust.x += 1;
      if (keys['Space']) thrust.y += 1;
      if (keys['ShiftLeft']) thrust.y -= 1;
    }

    // 角速度阻尼 + 应用
    S.angVel.multiplyScalar(Math.pow(0.02, dt));
    var dq = _tq[0].set(S.angVel.x * dt, S.angVel.y * dt, S.angVel.z * dt, 1).normalize();
    S.quat.multiply(dq);

    // 推力
    S.thrustLevel = 0;
    if (thrust.lengthSq() > 0 && (S.fuel > 0 || G.Creative)) {
      thrust.normalize().applyQuaternion(S.quat);
      var acc = 26 * boost;
      S.vel.addScaledVector(thrust, acc * dt);
      if (!G.Creative) S.fuel = Math.max(0, S.fuel - dt * 0.5 * boost);
      S.thrustLevel = boost > 1 ? 1 : 0.6;
      if (S.fuel <= 0 && !G.Creative) G.SFX.play('alarm_fuel');
    }

    // 重力
    var gv = G.Solar.gravityAt(S.pos, _tv[1]);
    S.vel.addScaledVector(gv, dt);
    S.pos.addScaledVector(S.vel, dt);

    // ---- 体素碰撞（近星球时） ----
    var near = G.Solar.nearestPlanet(S.pos);
    var p = near.planet;
    if (near.surfDist < 80) {
      var contacts = 0;
      var pushSum = _tv[2].set(0, 0, 0);
      var relV = _tv[3].copy(S.vel).sub(G.Player.surfaceVelAt(p, G.Solar.worldToLocal(p, S.pos, _lp), _tv[4]));
      var speed = relV.length();
      for (var i = 0; i < HULL_PTS.length; i++) {
        var wp = _tv[5].copy(HULL_PTS[i]).applyQuaternion(S.quat).add(S.pos);
        G.Solar.worldToLocal(p, wp, _lp);
        var bx = Math.floor(_lp.x), by = Math.floor(_lp.y), bz = Math.floor(_lp.z);
        if (G.Chunks.isSolid(p, bx, by, bz)) {
          contacts++;
          var up = _tv[6].copy(_lp).normalize();
          G.Solar.localDirToWorld(p, up, up);
          pushSum.add(up);
        }
      }
      if (contacts > 0) {
        pushSum.normalize();
        // 硬着陆伤害
        if (speed > 16) {
          S.hull = Math.max(0, S.hull - (speed - 14) * 2);
          G.SFX.play('landing_thud', 1);
          if (G.Player.state.inShip && speed > 26) G.Player.damage(Math.floor((speed - 24) * 0.5), 'crash');
        }
        S.pos.addScaledVector(pushSum, contacts * 0.06);
        // 反弹+摩擦
        var vn = relV.dot(pushSum);
        if (vn < 0) {
          S.vel.addScaledVector(pushSum, -vn * 1.25);
          var tang = _tv[7].copy(relV).addScaledVector(pushSum, -vn);
          S.vel.addScaledVector(tang, -Math.min(1, dt * 6));
        }
        // 姿态回正（让船底朝向地面）
        var shipUp = _tv[4].set(0, 1, 0).applyQuaternion(S.quat);
        var alignQ = _tq[1].setFromUnitVectors(shipUp, pushSum);
        _tq[0].identity().slerp(alignQ, Math.min(1, dt * 3));
        S.quat.premultiply(_tq[0]);
        S.angVel.multiplyScalar(Math.pow(0.001, dt));
        // 静止判定 -> 着陆
        if (speed < 2.2 && contacts >= 2) {
          S.landedTimer += dt;
          if (S.landedTimer > 0.5) { land(p); S.landedTimer = 0; }
        } else S.landedTimer = 0;
      } else S.landedTimer = 0;
      S.legAnim = Math.min(1, S.legAnim + dt * 2);
    } else {
      S.legAnim = Math.max(0, S.legAnim - dt * 1.5);
    }
  }

  // ---------------- 动画与声音 ----------------
  function updateVisual(dt, t) {
    if (!S.group) return;
    worldPos(S.group.position);
    worldQuat(S.group.quaternion);
    // 舱门
    S.doorAnim += ((S.doorOpen ? 1 : 0) - S.doorAnim) * Math.min(1, dt * 5);
    if (S.doorMesh) S.doorMesh.position.z = 0.2 + S.doorAnim * 1.15;
    // 着陆腿
    for (var i = 0; i < S.legs.length; i++) {
      S.legs[i].scale.y = 0.25 + S.legAnim * 0.75;
      S.legs[i].position.y = 0.15 + (1 - S.legAnim) * 0.5;
    }
    // 尾焰
    var fl = S.thrustLevel;
    var flick = 0.85 + Math.sin(t * 31) * 0.15;
    for (var j = 0; j < S.flames.length; j++) {
      S.flames[j].visible = fl > 0.01;
      S.flames[j].scale.set(1, (0.4 + fl * flick), 1);
    }
    if (S.flameLight) S.flameLight.intensity = fl * 2.4 * flick;
    // 指示灯慢闪
    if (S.beacon) S.beacon.material.color.setHex((Math.floor(t * 1.2) % 2) ? 0xff4040 : 0x501010);
    // 引擎音
    var lp = G.SFX.getLoop('ship_thrust');
    G.SFX.setLoopLevel('ship_thrust', fl * 0.7, 0.1);
    if (lp && lp.gain._engineFilter) {
      lp.gain._engineFilter.frequency.value = 300 + fl * 900;
      lp.gain._engineOsc.frequency.value = 42 + fl * 40;
    }
    // 机身微震（驾驶时推进）
    if (G.Player.state.inShip && fl > 0) {
      S.group.position.x += (Math.random() - 0.5) * 0.03;
      S.group.position.y += (Math.random() - 0.5) * 0.03;
    }
  }

  G.Ship = {
    state: S,
    init: function(scene) {
      S.group = IN.buildShip();
      scene.add(S.group);
      // 初始停在木炉星停机坪
      var timber = G.Solar.byKey.timber;
      var f = timber.shipPadFrame;
      S.planet = timber;
      S.localPos.copy(f.world(0, 1.6, 0));
      var up = S.localPos.clone().normalize();
      S.localQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      S.state = 'landed';
    },
    update: function(dt, t) {
      if (S.state === 'flying') updateFlying(dt);
      else if (G.Player.state.inShip) G.Input.consumeMouse(); // 停泊时丢弃视角增量，防止起飞瞬间猛转
      updateVisual(dt, t);
    },
    takeOff: takeOff,
    worldPos: worldPos,
    worldQuat: worldQuat,
    toggleDoor: function() {
      S.doorOpen = !S.doorOpen;
      G.SFX.play('ship_door');
    },
    // 玩家与舱门的距离（世界）
    doorWorldPos: function(out) {
      worldPos(out);
      var offset = _tv[0].set(1.9, 1.3, 0.2).applyQuaternion(worldQuat(_tq[0]));
      return out.add(offset);
    },
    // 驾驶位
    seatWorldPos: function(out) {
      worldPos(out);
      var offset = _tv[0].set(0, 2.6, -1.2).applyQuaternion(worldQuat(_tq[0]));
      return out.add(offset);
    },
    reset: function() {
      var timber = G.Solar.byKey.timber;
      var f = timber.shipPadFrame;
      S.planet = timber;
      S.localPos.copy(f.world(0, 1.6, 0));
      var up = S.localPos.clone().normalize();
      S.localQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      S.state = 'landed';
      S.fuel = 100; S.hull = 100;
      S.vel.set(0, 0, 0); S.angVel.set(0, 0, 0);
      S.thrustLevel = 0; S.doorOpen = false;
    }
  };
})();
