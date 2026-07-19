"use strict";
// ============================================================
//  方块星野 BlockWilds - 玩家控制器
//  球面行走 / 喷气背包 / 氧气燃料 / 挖掘放置 / 手持模型
// ============================================================
window.G = window.G || {};

(function() {
  var U = G.U;
  var CFG = G.CONF;

  var P = {
    frame: 'space',          // 'planet' | 'space'
    planet: null,
    pos: new THREE.Vector3(),   // 当前帧坐标（planet=本地 / space=世界）
    vel: new THREE.Vector3(),
    ori: new THREE.Quaternion(),  // 身体朝向（yaw已含，up对齐重力）
    pitch: 0,
    hp: CFG.HP_MAX, o2: CFG.O2_MAX, fuel: CFG.FUEL_MAX,
    grounded: false,
    inShip: false,
    dead: false,
    swim: false,
    breakTarget: null, breakProgress: 0,
    lastStepAt: 0, walkCycle: 0,
    fallSpeed: 0,
    camWorldPos: new THREE.Vector3(),
    camWorldQuat: new THREE.Quaternion(),
    bodyUpW: new THREE.Vector3(0, 1, 0),
    holdAnim: { swing: 0, bob: 0, switch: 0 },
    oxygenWarned: false
  };

  var _tv = [];
  for (var i = 0; i < 8; i++) _tv.push(new THREE.Vector3());
  var _tq = [new THREE.Quaternion(), new THREE.Quaternion()];

  // ---------------- 帧转换 ----------------
  function toPlanetFrame(planet) {
    if (P.frame === 'planet' && P.planet === planet) return;
    var wp = P.frame === 'space' ? P.pos.clone() : G.Solar.localToWorld(P.planet, P.pos);
    var wv = P.frame === 'space' ? P.vel.clone() : localVelToWorld(P.planet, P.pos, P.vel);
    P.frame = 'planet';
    P.planet = planet;
    G.Solar.worldToLocal(planet, wp, P.pos);
    // 速度：减去星球平移+自转带来的表面速度
    var surfV = surfaceVelAt(planet, P.pos);
    wv.sub(surfV);
    G.Solar.worldDirToLocal(planet, wv, P.vel);
  }
  function toSpaceFrame() {
    if (P.frame === 'space') return;
    var wp = G.Solar.localToWorld(P.planet, P.pos);
    var wv = localVelToWorld(P.planet, P.pos, P.vel);
    P.frame = 'space';
    P.planet = null;
    P.pos.copy(wp);
    P.vel.copy(wv);
  }
  // 星球某本地点的世界速度（平移+自转）
  function surfaceVelAt(planet, lpos, out) {
    out = out || new THREE.Vector3();
    // ω × r（自转轴为本地Y）
    var wLocal = _tv[6].set(0, planet.spinSpeed, 0);
    var rWorld = G.Solar.localDirToWorld(planet, lpos, _tv[5]);
    var wWorld = G.Solar.localDirToWorld(planet, wLocal, _tv[4]);
    out.crossVectors(wWorld, rWorld).add(planet.vel);
    return out;
  }
  function localVelToWorld(planet, lpos, lvel) {
    var v = G.Solar.localDirToWorld(planet, lvel, new THREE.Vector3());
    v.add(surfaceVelAt(planet, lpos));
    return v;
  }

  // ---------------- 碰撞（球体 vs 体素） ----------------
  function collideSphere(planet, center, radius, resolveVel) {
    var hitNormal = null;
    var cx = Math.floor(center.x), cy = Math.floor(center.y), cz = Math.floor(center.z);
    for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) for (var dz = -1; dz <= 1; dz++) {
      var bx = cx + dx, by = cy + dy, bz = cz + dz;
      var id = G.Chunks.getBlock(planet, bx, by, bz);
      if (!id) continue;
      var def = G.BLOCKS[id];
      if (!def || def.solid === false) continue;
      var maxY = by + (def.render === 'slab' ? (def.slabH || 0.5) : 1);
      // 最近点
      var px = U.clamp(center.x, bx, bx + 1);
      var py = U.clamp(center.y, by, maxY);
      var pz = U.clamp(center.z, bz, bz + 1);
      var ox = center.x - px, oy = center.y - py, oz = center.z - pz;
      var d2 = ox * ox + oy * oy + oz * oz;
      if (d2 < radius * radius && d2 > 1e-9) {
        var d = Math.sqrt(d2);
        var push = (radius - d) / d;
        center.x += ox * push; center.y += oy * push; center.z += oz * push;
        var n = _tv[7].set(ox / d, oy / d, oz / d);
        // 移除法向速度
        if (resolveVel) {
          var vn = P.vel.dot(n);
          if (vn < 0) P.vel.addScaledVector(n, -vn);
        }
        if (!hitNormal) hitNormal = n.clone();
        else hitNormal.add(n).normalize();
      }
    }
    return hitNormal;
  }

  window.__PlayerInternal = {
    P: P, toPlanetFrame: toPlanetFrame, toSpaceFrame: toSpaceFrame,
    surfaceVelAt: surfaceVelAt, localVelToWorld: localVelToWorld,
    collideSphere: collideSphere, tv: _tv, tq: _tq
  };
})();

// ============================================================
//  玩家更新：输入 / 移动 / 重力 / 生命 / 声音
// ============================================================
(function() {
  var U = G.U;
  var CFG = G.CONF;
  var IN = window.__PlayerInternal;
  var P = IN.P;
  var _tv = IN.tv;
  var keys = {};
  var _mouseDX = 0, _mouseDY = 0;
  var _lastO2Beep = 0;

  document.addEventListener('keydown', function(e) { keys[e.code] = true; });
  document.addEventListener('keyup', function(e) { keys[e.code] = false; });
  window.addEventListener('blur', function() { keys = {}; });

  G.Input = {
    keys: keys,
    consumeMouse: function() {
      var r = [_mouseDX, _mouseDY];
      _mouseDX = 0; _mouseDY = 0;
      return r;
    },
    feedMouse: function(dx, dy) { _mouseDX += dx; _mouseDY += dy; }
  };

  function updatePlanetMode(dt) {
    var planet = P.planet;
    var up = _tv[0].copy(P.pos).normalize();
    var r = P.pos.length();

    // ---- 身体姿态：up 对齐径向 ----
    U.alignUp(P.ori, up, Math.min(1, dt * 8));

    // ---- 视线/移动方向 ----
    var fwd = _tv[1].set(0, 0, -1).applyQuaternion(P.ori);
    fwd.addScaledVector(up, -fwd.dot(up)).normalize();
    var right = _tv[2].crossVectors(fwd, up).normalize().negate();

    var wish = _tv[3].set(0, 0, 0);
    if (!P.dead && !G.Screens.isOpen()) {
      if (keys['KeyW']) wish.add(fwd);
      if (keys['KeyS']) wish.sub(fwd);
      if (keys['KeyA']) wish.add(right);
      if (keys['KeyD']) wish.sub(right);
    }
    if (wish.lengthSq() > 0) wish.normalize();

    // 水中检测（径向脚部位置）
    var footP = _tv[4].copy(P.pos).addScaledVector(up, -(CFG.PLAYER_EYE - 0.4));
    var feetId = G.Chunks.getBlock(planet, Math.floor(footP.x), Math.floor(footP.y), Math.floor(footP.z));
    var feetDef = G.BLOCKS[feetId];
    P.swim = !!(feetDef && feetDef.render === 'liquid' && feetDef.key === 'water');

    // ---- 重力 ----
    var gW = G.Solar.gravityAt(G.Solar.localToWorld(planet, P.pos, _tv[4]), _tv[5]);
    var gL = G.Solar.worldDirToLocal(planet, gW, _tv[6]);
    P.vel.addScaledVector(gL, dt * (P.swim ? 0.3 : 1));

    // ---- 行走加速 ----
    var speed = keys['ControlLeft'] ? CFG.RUN_SPEED : CFG.WALK_SPEED;
    if (G.Creative) speed *= 3;
    if (P.swim) speed *= 0.6;
    var vTang = _tv[7].copy(P.vel).addScaledVector(up, -P.vel.dot(up));
    var target = wish.multiplyScalar(speed);
    var accel = P.grounded || P.swim ? 42 : 7;
    vTang.lerp(target, Math.min(1, accel * dt));
    var vRad = P.vel.dot(up);
    P.vel.copy(vTang).addScaledVector(up, vRad);

    // ---- 跳跃 / 喷气 ----
    var jetting = false;
    if (!P.dead && !G.Screens.isOpen()) {
      if (keys['Space']) {
        if (P.grounded) {
          P.vel.addScaledVector(up, CFG.JUMP_SPEED - Math.max(0, vRad));
          P.grounded = false;
        } else if (P.swim) {
          P.vel.addScaledVector(up, dt * 22);
        } else if (P.fuel > 0 || G.Creative) {
          P.vel.addScaledVector(up, CFG.JETPACK_ACC * (G.Creative ? 1.6 : 1) * dt);
          if (!G.Creative) P.fuel = Math.max(0, P.fuel - dt * 5.5);
          jetting = true;
        }
      }
      if (keys['ShiftLeft'] && !P.grounded && !P.swim && (P.fuel > 0 || G.Creative)) {
        P.vel.addScaledVector(up, -CFG.JETPACK_ACC * 0.7 * dt);
        if (!G.Creative) P.fuel = Math.max(0, P.fuel - dt * 3);
        jetting = true;
      }
    }
    G.SFX.setLoopLevel('jetpack', jetting ? 0.5 : 0, 0.08);

    // ---- 积分 + 碰撞 ----
    var steps = Math.max(1, Math.ceil(P.vel.length() * dt / 0.4));
    var stepDt = dt / steps;
    P.grounded = false;
    for (var s = 0; s < steps; s++) {
      P.pos.addScaledVector(P.vel, stepDt);
      // 双球体（脚+头）
      var feet = _tv[4].copy(P.pos).addScaledVector(up, -(CFG.PLAYER_EYE - CFG.PLAYER_RADIUS));
      var n1 = IN.collideSphere(planet, feet, CFG.PLAYER_RADIUS, true);
      if (n1) {
        P.pos.copy(feet).addScaledVector(up, CFG.PLAYER_EYE - CFG.PLAYER_RADIUS);
        if (n1.dot(up) > 0.55) {
          if (!P.groundedPrev && P.fallSpeed > 14) {
            var dmg = Math.floor((P.fallSpeed - 13) * 0.8);
            if (dmg > 0) damage(dmg, 'fall');
            G.SFX.play('landing_thud', Math.min(1, P.fallSpeed / 30));
          }
          P.grounded = true;
        }
      }
      var head = _tv[4].copy(P.pos).addScaledVector(up, -0.15);
      var n2 = IN.collideSphere(planet, head, CFG.PLAYER_RADIUS, true);
      if (n2) P.pos.copy(head).addScaledVector(up, 0.15);
    }
    P.fallSpeed = -P.vel.dot(up);
    P.groundedPrev = P.grounded;

    // ---- 脚步声 ----
    if (P.grounded && vTang.length() > 1.5) {
      P.walkCycle += dt * vTang.length() * 1.55;
      if (P.walkCycle > 3.2) {
        P.walkCycle = 0;
        var gpos = _tv[4].copy(P.pos).addScaledVector(up, -(CFG.PLAYER_EYE + 0.4));
        var gid = G.Chunks.getBlock(planet, Math.floor(gpos.x), Math.floor(gpos.y), Math.floor(gpos.z));
        var gdef = G.BLOCKS[gid];
        if (gdef) G.SFX.step(gdef.mat, 0.8);
      }
    }

    // ---- 离开星球 ----
    if (r > planet.influence * 0.9) IN.toSpaceFrame();
  }

  function updateSpaceMode(dt) {
    // 太空漂浮：喷气六自由度
    var q = P.ori;
    var fwd = _tv[1].set(0, 0, -1).applyQuaternion(q);
    var right = _tv[2].set(1, 0, 0).applyQuaternion(q);
    var up = _tv[0].set(0, 1, 0).applyQuaternion(q);
    var acc = _tv[3].set(0, 0, 0);
    if (!P.dead && !G.Screens.isOpen()) {
      if (keys['KeyW']) acc.add(fwd);
      if (keys['KeyS']) acc.sub(fwd);
      if (keys['KeyA']) acc.sub(right);
      if (keys['KeyD']) acc.add(right);
      if (keys['Space']) acc.add(up);
      if (keys['ShiftLeft']) acc.sub(up);
    }
    var jetting = acc.lengthSq() > 0 && (P.fuel > 0 || G.Creative);
    if (jetting) {
      acc.normalize();
      P.vel.addScaledVector(acc, CFG.JETPACK_ACC * (G.Creative ? 1.5 : 0.9) * dt);
      if (!G.Creative) P.fuel = Math.max(0, P.fuel - dt * 4);
    }
    G.SFX.setLoopLevel('jetpack', jetting ? 0.5 : 0, 0.08);
    var gW = G.Solar.gravityAt(P.pos, _tv[5]);
    P.vel.addScaledVector(gW, dt);
    P.pos.addScaledVector(P.vel, dt);

    // 进入星球影响圈
    var near = G.Solar.nearestPlanet(P.pos);
    if (near.surfDist < near.planet.influence - near.planet.radius - 20) {
      IN.toPlanetFrame(near.planet);
    }
  }

  function damage(n, cause) {
    if (P.dead || G.Creative) return;
    P.hp = Math.max(0, P.hp - n);
    G.SFX.play('hurt');
    G.HUD.damageFlash();
    if (P.hp <= 0) {
      P.dead = true;
      G.SFX.play('death');
      G.Gameplay.onPlayerDeath(cause);
    }
  }

  // ---------------- 生命体征 ----------------
  function updateVitals(dt) {
    if (P.dead) return;
    if (G.Creative) {
      P.hp = G.CONF.HP_MAX; P.o2 = G.CONF.O2_MAX; P.fuel = G.CONF.FUEL_MAX;
      return;
    }
    var inO2 = false;
    if (P.frame === 'planet' && P.planet.hasO2) {
      var alt = P.pos.length() - P.planet.radius;
      if (alt < (P.planet.atmosphere ? P.planet.atmosphere.h * 0.7 : 40)) inO2 = true;
    }
    if (P.inShip) inO2 = true;
    if (G.Gameplay && G.Gameplay.nearCampfire) inO2 = true;
    if (inO2) {
      P.o2 = Math.min(CFG.O2_MAX, P.o2 + dt * 12);
      P.oxygenWarned = false;
    } else {
      P.o2 = Math.max(0, P.o2 - dt * 1.35);
      if (P.o2 < 25 && performance.now() - _lastO2Beep > 4000) {
        _lastO2Beep = performance.now();
        G.SFX.play('alarm_oxygen');
        G.HUD.toast(P.o2 <= 0 ? '氧气耗尽！' : '氧气不足！', '#ff5555');
      }
      if (P.o2 <= 0) {
        P.suffocate = (P.suffocate || 0) + dt;
        if (P.suffocate > 1.6) { P.suffocate = 0; damage(3, 'oxygen'); }
      }
    }
    // 幽灵物质 / 熔岩 / 荆棘伤害（径向脚下）
    if (P.frame === 'planet') {
      var upv = _tv[3].copy(P.pos).normalize();
      var hp = _tv[2].copy(P.pos).addScaledVector(upv, -1.0);
      var id = G.Chunks.getBlock(P.planet, Math.floor(hp.x), Math.floor(hp.y), Math.floor(hp.z));
      var def = G.BLOCKS[id];
      if (def && def.damage) {
        P.hazardT = (P.hazardT || 0) + dt;
        if (P.hazardT > 0.7) { P.hazardT = 0; damage(def.damage, def.key); }
      }
    }
  }

  IN.updatePlanetMode = updatePlanetMode;
  IN.updateSpaceMode = updateSpaceMode;
  IN.updateVitals = updateVitals;
  IN.damage = damage;
})();

// ============================================================
//  视角 / 挖掘放置 / 手持模型动画 / 公开API
// ============================================================
(function() {
  var U = G.U;
  var CFG = G.CONF;
  var IN = window.__PlayerInternal;
  var P = IN.P;
  var _tv = IN.tv;
  var _handGroup = null, _handMeshes = {}, _currentHold = '';
  var _crackMesh = null, _crackTextures = [];
  var _mineDown = false, _placeDown = false;
  var _placeCooldown = 0;

  // ---------------- 视角 ----------------
  function applyLook(dt) {
    var m = G.Input.consumeMouse();
    var sens = 0.0023;
    var yaw = -m[0] * sens, pitch = -m[1] * sens;
    if (P.frame === 'planet') {
      var up = _tv[0].copy(P.pos).normalize();
      var qYaw = IN.tq[0].setFromAxisAngle(up, yaw);
      P.ori.premultiply(qYaw);
      P.pitch = U.clamp(P.pitch + pitch, -1.52, 1.52);
    } else {
      var qy = IN.tq[0].setFromAxisAngle(_tv[0].set(0, 1, 0).applyQuaternion(P.ori), yaw);
      var qp = IN.tq[1].setFromAxisAngle(_tv[1].set(1, 0, 0).applyQuaternion(P.ori), pitch);
      P.ori.premultiply(qy).premultiply(qp);
      P.pitch = 0;
    }
  }

  // 相机世界位姿
  function computeCamera() {
    if (P.frame === 'planet') {
      G.Solar.localToWorld(P.planet, P.pos, P.camWorldPos);
      var q = IN.tq[0].copy(P.planet.quat).multiply(P.ori);
      var right = _tv[1].set(1, 0, 0).applyQuaternion(q);
      var qp = IN.tq[1].setFromAxisAngle(right, P.pitch);
      P.camWorldQuat.copy(qp.multiply(q));
      P.bodyUpW.copy(P.pos).normalize().applyQuaternion(P.planet.quat);
    } else {
      P.camWorldPos.copy(P.pos);
      P.camWorldQuat.copy(P.ori);
      P.bodyUpW.set(0, 1, 0).applyQuaternion(P.ori);
    }
  }

  // ---------------- 目标方块（准星射线） ----------------
  function getTarget() {
    if (P.frame !== 'planet') return null;
    var camL = _tv[2].copy(P.pos);
    var fwd = _tv[3].set(0, 0, -1).applyQuaternion(P.ori);
    var up = _tv[0].copy(P.pos).normalize();
    // pitch 在本地系里应用
    var right = _tv[4].crossVectors(fwd, up).normalize();
    var qp = IN.tq[0].setFromAxisAngle(right, P.pitch);
    var dir = fwd.applyQuaternion(qp).normalize();
    return G.Chunks.raycast(P.planet, camL, dir, CFG.REACH);
  }

  // ---------------- 挖掘 ----------------
  function updateMining(dt) {
    var t = P.dead || P.inShip || G.Screens.isOpen() ? null : getTarget();
    G.HUD.setTargetInfo(t);
    if (!t || !_mineDown) {
      P.breakTarget = null; P.breakProgress = 0;
      if (_crackMesh) _crackMesh.visible = false;
      return;
    }
    var def = G.BLOCKS[t.id];
    if (!def || def.hard < 0) { P.breakProgress = 0; if (_crackMesh) _crackMesh.visible = false; return; }
    var k = t.x + ',' + t.y + ',' + t.z;
    if (P.breakTarget !== k) { P.breakTarget = k; P.breakProgress = 0; }
    // 挖掘速度（创造模式秒破）
    var speed = 1;
    P.breakProgress += G.Creative ? 1 : (dt * speed / Math.max(0.15, def.hard));
    P.holdAnim.swing = 1;
    // 挖掘声（间隔）
    if (!P._digSndT || performance.now() - P._digSndT > 240) {
      P._digSndT = performance.now();
      G.SFX.dig(def.mat, 0.5);
    }
    updateCrack(t);
    if (P.breakProgress >= 1) {
      P.breakProgress = 0; P.breakTarget = null;
      G.Chunks.setBlock(P.planet, t.x, t.y, t.z, 0);
      G.SFX.dig(def.mat, 1);
      // 掉落（创造模式不掉落）
      var dropRef = def.drops === undefined ? def.id : def.drops;
      if (dropRef !== null && !G.Creative) {
        var stack;
        if (typeof dropRef === 'string') {
          if (dropRef.indexOf('item:') === 0) stack = G.Inv.mkStack(dropRef.substring(5), 1);
          else stack = G.Inv.mkStack(G.BLOCK_BY_KEY[dropRef].id, 1);
        } else stack = G.Inv.mkStack(def.id, 1);
        if (G.Inv.give(stack)) G.SFX.play('pickup', 0.7);
      }
      G.Gameplay.onBlockBroken(P.planet, t, def);
    }
  }

  function updateCrack(t) {
    if (!_crackMesh) {
      // 裂纹贴图（5阶段程序化）
      for (var s = 0; s < 5; s++) {
        var cv = document.createElement('canvas');
        cv.width = cv.height = 16;
        var x = cv.getContext('2d');
        x.strokeStyle = 'rgba(20,16,12,0.85)';
        x.lineWidth = 1;
        var rng = U.mulberry(77 + s);
        for (var l = 0; l < 3 + s * 3; l++) {
          x.beginPath();
          var sx = rng() * 16, sy = rng() * 16;
          x.moveTo(sx, sy);
          x.lineTo(sx + (rng() - 0.5) * 9, sy + (rng() - 0.5) * 9);
          x.stroke();
        }
        var tex = new THREE.CanvasTexture(cv);
        tex.magFilter = THREE.NearestFilter;
        _crackTextures.push(tex);
      }
      var mat = new THREE.MeshBasicMaterial({ map: _crackTextures[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      _crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.003, 1.003, 1.003), mat);
      _crackMesh.renderOrder = 5;
    }
    if (!_crackMesh.parent && P.planet && P.planet.group) P.planet.group.add(_crackMesh);
    _crackMesh.visible = true;
    _crackMesh.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
    var stage = Math.min(4, Math.floor(P.breakProgress * 5));
    _crackMesh.material.map = _crackTextures[stage];
    _crackMesh.material.needsUpdate = true;
  }

  // ---------------- 放置 / 使用 ----------------
  function tryPlace() {
    if (P.dead || P.inShip || G.Screens.isOpen()) return;
    var t = getTarget();
    var s = G.Inv.selStack;
    if (!t) {
      // 无目标：手持物品仍可使用（吃/补给/侦察兵等）
      if (s && s.kind === 'item') G.Gameplay.useItem(s);
      return;
    }
    var tDef = G.BLOCKS[t.id];
    // 可交互方块优先
    if (tDef && tDef.use) { G.Gameplay.useBlock(P.planet, t, tDef); return; }
    if (!s) return;
    if (s.kind === 'item') { G.Gameplay.useItem(s); return; }
    // 放置方块
    var px = t.x + t.face[0], py = t.y + t.face[1], pz = t.z + t.face[2];
    // 不能放进玩家身体
    var eye = P.pos;
    var d2 = (px + 0.5 - eye.x) * (px + 0.5 - eye.x) + (py + 0.5 - eye.y + 0.8) * (py + 0.5 - eye.y + 0.8) + (pz + 0.5 - eye.z) * (pz + 0.5 - eye.z);
    var def = G.BLOCKS[s.id];
    if (def.solid !== false && d2 < 1.2) return;
    if (G.Chunks.getBlock(P.planet, px, py, pz) !== 0) return;
    G.Chunks.setBlock(P.planet, px, py, pz, s.id);
    G.SFX.place(def.mat, 0.9);
    if (!G.Creative) G.Inv.consumeSel();
    P.holdAnim.swing = 1;
    G.Gameplay.onBlockPlaced(P.planet, px, py, pz, def);
  }

  // ---------------- 鼠标 ----------------
  document.addEventListener('mousedown', function(e) {
    if (!G.Main || !G.Main.pointerLocked()) return;
    if (e.button === 0) {
      if (G.Gameplay.handleLeftClick && G.Gameplay.handleLeftClick()) return;
      _mineDown = true;
    }
    if (e.button === 2) { _placeDown = true; tryPlace(); _placeCooldown = 0.28; }
  });
  document.addEventListener('mouseup', function(e) {
    if (e.button === 0) _mineDown = false;
    if (e.button === 2) _placeDown = false;
  });

  // ---------------- 更新入口 ----------------
  G.Player = {
    state: P,
    update: function(dt) {
      if (G.Main.pointerLocked() && !P.inShip) applyLook(dt);
      if (!P.inShip) {
        if (P.frame === 'planet') IN.updatePlanetMode(dt);
        else IN.updateSpaceMode(dt);
        updateMining(dt);
        if (_placeDown) {
          _placeCooldown -= dt;
          if (_placeCooldown <= 0) { tryPlace(); _placeCooldown = 0.24; }
        }
      } else {
        G.SFX.setLoopLevel('jetpack', 0, 0.1);
      }
      IN.updateVitals(dt);
      computeCamera();
      // 手持动画衰减
      P.holdAnim.swing = Math.max(0, P.holdAnim.swing - dt * 5);
      P.holdAnim.switch = Math.max(0, P.holdAnim.switch - dt * 4);
    },
    getTarget: getTarget,
    damage: IN.damage,
    toPlanetFrame: IN.toPlanetFrame,
    toSpaceFrame: IN.toSpaceFrame,
    surfaceVelAt: IN.surfaceVelAt,
    // 出生
    respawn: function() {
      var timber = G.Solar.byKey.timber;
      P.frame = 'planet';
      P.planet = timber;
      var f = timber.spawnFrame;
      // 沿实际方向重新采样地表，确保出生在地面之上
      var sp = f.world(2.5, 0, 2.5);
      var dir = sp.clone().normalize();
      var sr = G.Solar.surfaceR(timber, dir);
      P.pos.copy(dir.multiplyScalar(sr + 2.7));
      P.vel.set(0, 0, 0);
      var up = P.pos.clone().normalize();
      P.ori.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      // 面向营火方向
      P.pitch = 0;
      P.hp = CFG.HP_MAX; P.o2 = CFG.O2_MAX; P.fuel = CFG.FUEL_MAX;
      P.dead = false;
      P.inShip = false;
    },
    setHoldSwing: function() { P.holdAnim.swing = 1; }
  };
})();
