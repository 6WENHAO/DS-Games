/* ============================================================
 * BLOCKROOMS - entities.js
 * 实体：猎犬 / 微笑者 / 无面灵 + 掉落物 + 粒子
 * ============================================================ */
(function () {
  'use strict';
  const E = {};
  window.BREntities = E;
  const W = () => window.BRWorld;
  const B = () => window.BRBlocks;
  const P = () => window.BRPlayer;

  let scene = null;
  E.list = [];      // 怪物
  E.drops = [];     // 掉落物
  let particles = null, particleData = [];

  E.init = function (s) {
    scene = s;
    E.list = [];
    E.drops = [];
    initParticles();
  };
  E.clear = function () {
    for (const e of E.list) scene.remove(e.group);
    for (const d of E.drops) scene.remove(d.mesh);
    E.list = [];
    E.drops = [];
  };

  /* ================= 建模工具 ================= */
  function boxMesh(w, h, d, tex, matOpts) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial(Object.assign({ map: tex }, matOpts || {}))
    );
    return m;
  }

  /* ================= 猎犬 (Hound) ================= */
  function buildHound() {
    const g = new THREE.Group();
    const T = BRAssets.entityTex;
    const body = boxMesh(0.5, 0.5, 1.1, T.hound_body);
    body.position.y = 0.62;
    g.add(body);
    const head = boxMesh(0.42, 0.4, 0.44, T.hound_body);
    const face = boxMesh(0.38, 0.36, 0.05, T.hound_face);
    face.position.z = 0.24;
    head.add(face);
    head.position.set(0, 0.85, 0.72);
    g.add(head);
    const jaw = boxMesh(0.3, 0.12, 0.36, T.hound_body);
    jaw.position.set(0, -0.2, 0.06);
    head.add(jaw);
    const legs = [];
    const lp = [[-0.16, -0.42], [0.16, -0.42], [-0.16, 0.42], [0.16, 0.42]];
    for (const [x, z] of lp) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.45, z);
      const leg = boxMesh(0.14, 0.5, 0.14, T.hound_leg);
      leg.position.y = -0.25;
      pivot.add(leg);
      g.add(pivot);
      legs.push(pivot);
    }
    const tail = boxMesh(0.1, 0.1, 0.4, T.hound_body);
    tail.position.set(0, 0.75, -0.7);
    g.add(tail);
    return { group: g, head, legs, jaw, tail };
  }

  /* ================= 微笑者 (Smiler) ================= */
  function buildSmiler() {
    const g = new THREE.Group();
    const T = BRAssets.entityTex;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      [
        new THREE.MeshBasicMaterial({ map: T.smiler_side }),
        new THREE.MeshBasicMaterial({ map: T.smiler_side }),
        new THREE.MeshBasicMaterial({ map: T.smiler_side }),
        new THREE.MeshBasicMaterial({ map: T.smiler_side }),
        new THREE.MeshBasicMaterial({ map: T.smiler_face }),
        new THREE.MeshBasicMaterial({ map: T.smiler_side })
      ]
    );
    g.add(head);
    // 光环
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 2.0),
      new THREE.MeshBasicMaterial({
        map: T.smiler_face, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    glow.position.z = 0.5;
    g.add(glow);
    return { group: g, head, glow };
  }

  /* ================= 无面灵 (Faceling) ================= */
  function buildFaceling() {
    const g = new THREE.Group();
    const T = BRAssets.entityTex;
    const head = boxMesh(0.42, 0.42, 0.42, T.faceling_head);
    head.position.y = 1.62;
    g.add(head);
    const body = boxMesh(0.5, 0.68, 0.26, T.faceling_body);
    body.position.y = 1.06;
    g.add(body);
    const limbs = [];
    const mk = (x, y, tex, len) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const m = boxMesh(0.2, len, 0.2, tex);
      m.position.y = -len / 2;
      pivot.add(m);
      g.add(pivot);
      return pivot;
    };
    limbs.push(mk(-0.15, 0.72, T.faceling_leg, 0.72));
    limbs.push(mk(0.15, 0.72, T.faceling_leg, 0.72));
    limbs.push(mk(-0.36, 1.36, T.faceling_arm, 0.66));
    limbs.push(mk(0.36, 1.36, T.faceling_arm, 0.66));
    return { group: g, head, limbs };
  }

  /* ================= 实体基类逻辑 ================= */
  function makeEntity(type, x, y, z) {
    let model, hp, half, height;
    if (type === 'hound') { model = buildHound(); hp = 12; half = 0.35; height = 1.0; }
    else if (type === 'smiler') { model = buildSmiler(); hp = Infinity; half = 0.45; height = 0.9; }
    else { model = buildFaceling(); hp = 10; half = 0.25; height = 1.85; }
    const e = {
      type, model, group: model.group,
      pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 },
      yaw: Math.random() * Math.PI * 2,
      hp, half, height,
      state: 'idle', stateT: 0,
      target: null, attackCd: 0, soundCd: Math.random() * 4,
      hurtT: 0, exposure: 0, anim: Math.random() * 10,
      dead: false
    };
    e.group.position.set(x, y, z);
    scene.add(e.group);
    E.list.push(e);
    return e;
  }
  E.spawn = makeEntity;

  /* ---- 实体物理（简化 AABB） ---- */
  function entCollide(e, axis, amt) {
    const min = { x: e.pos.x - e.half, y: e.pos.y, z: e.pos.z - e.half };
    const max = { x: e.pos.x + e.half, y: e.pos.y + e.height, z: e.pos.z + e.half };
    min[axis] += amt; max[axis] += amt;
    const x0 = Math.floor(min.x), x1 = Math.floor(max.x - 1e-6);
    const y0 = Math.floor(min.y), y1 = Math.floor(max.y - 1e-6);
    const z0 = Math.floor(min.z), z1 = Math.floor(max.z - 1e-6);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          if (W().isSolid(x, y, z)) return true;
    return false;
  }
  function entMove(e, axis, amt) {
    if (!amt) return;
    if (!entCollide(e, axis, amt)) e.pos[axis] += amt;
    else {
      if (axis === 'x') e.vel.x = 0;
      if (axis === 'y') e.vel.y = 0;
      if (axis === 'z') e.vel.z = 0;
      if (axis !== 'y') e.blocked = true;
    }
  }

  function distToPlayer(e) {
    const p = P().pos;
    return Math.hypot(p.x - e.pos.x, p.z - e.pos.z);
  }
  function losToPlayer(e) {
    const p = P().pos;
    return W().lineOfSight(e.pos.x, e.pos.y + e.height * 0.8, e.pos.z, p.x, p.y + 1.5, p.z);
  }

  /* ================= AI 更新 ================= */
  E.update = function (dt, game) {
    for (let i = E.list.length - 1; i >= 0; i--) {
      const e = E.list[i];
      if (e.dead) {
        e.deadT = (e.deadT || 0) + dt;
        e.group.rotation.z = Math.min(Math.PI / 2, e.deadT * 4);
        e.group.position.y = e.pos.y - e.deadT * 0.4;
        const s = Math.max(0.01, 1 - e.deadT * 0.8);
        if (e.deadT > 0.8) {
          spawnParticlesAt(e.pos.x, e.pos.y + 0.5, e.pos.z, '#3a3a3a', 14);
          scene.remove(e.group);
          E.list.splice(i, 1);
        }
        continue;
      }
      e.stateT += dt;
      e.anim += dt;
      e.attackCd -= dt;
      e.soundCd -= dt;
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.blocked = false;

      if (e.type === 'hound') updateHound(e, dt, game);
      else if (e.type === 'smiler') updateSmiler(e, dt, game);
      else updateFaceling(e, dt, game);

      if (e.remove) {
        scene.remove(e.group);
        E.list.splice(i, 1);
        continue;
      }

      // 受击变红 + 环境明暗（微笑者保持自发光）
      e._ltT = (e._ltT === undefined ? 0 : e._ltT) - dt;
      if (e._ltT <= 0) {
        e._ltT = 0.2;
        e._lb = Math.max(0.1, Math.min(1, W().lightAt(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z)));
      }
      const lb = e._lb || 1;
      const hurt = Math.min(1, e.hurtT * 2.5);
      e.group.traverse(o => {
        if (o.isMesh && o.material && o.material.color && !o.material.isMeshBasicMaterial)
          o.material.color.setRGB(
            Math.min(1, lb + hurt),
            lb * (1 - hurt * 0.8),
            lb * (1 - hurt * 0.8));
      });
      // 距离过远 / 坠入虚空 → 消失
      if (distToPlayer(e) > 60 || e.pos.y < -12) {
        scene.remove(e.group);
        E.list.splice(i, 1);
      }
    }
    updateDrops(dt, game);
    updateParticles(dt);
  };

  function walkToward(e, tx, tz, speed, dt) {
    const dx = tx - e.pos.x, dz = tz - e.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.1) return true;
    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - e.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    e.yaw += Math.max(-6 * dt, Math.min(6 * dt, dy));
    e.vel.x = Math.sin(e.yaw) * speed;
    e.vel.z = Math.cos(e.yaw) * speed;
    // 跳跃翻越（怪物卡墙时）
    if (e.blockedTime === undefined) e.blockedTime = 0;
    return false;
  }
  function applyPhysics(e, dt) {
    e.vel.y -= 23 * dt;
    entMove(e, 'x', e.vel.x * dt);
    entMove(e, 'z', e.vel.z * dt);
    // 撞墙且在地面 → 尝试跳跃翻越（板条箱等）
    if (e.blocked && e.vel.y <= 0 &&
      W().isSolid(Math.floor(e.pos.x), Math.floor(e.pos.y - 0.1), Math.floor(e.pos.z))) {
      e.vel.y = 6.8;
    }
    entMove(e, 'y', e.vel.y * dt);
    e.group.position.set(e.pos.x, e.pos.y, e.pos.z);
    e.group.rotation.y = e.yaw;
  }

  /* ---- 猎犬 ---- */
  function updateHound(e, dt, game) {
    const d = distToPlayer(e);
    const p = P().pos;
    if (e.state === 'idle' || e.state === 'wander') {
      if (d < 15 && losToPlayer(e)) {
        e.state = 'chase'; e.stateT = 0;
        BRAudio.houndBark(e.pos.x, e.pos.y, e.pos.z);
      } else if (e.state === 'idle' && e.stateT > 2 + Math.random() * 3) {
        e.state = 'wander'; e.stateT = 0;
        const a = Math.random() * Math.PI * 2;
        e.target = { x: e.pos.x + Math.cos(a) * (4 + Math.random() * 6), z: e.pos.z + Math.sin(a) * (4 + Math.random() * 6) };
      } else if (e.state === 'wander') {
        if (!e.target || walkToward(e, e.target.x, e.target.z, 1.6, dt) || e.stateT > 6) {
          e.state = 'idle'; e.stateT = 0; e.vel.x = e.vel.z = 0;
        }
        if (e.soundCd < 0) { e.soundCd = 5 + Math.random() * 6; BRAudio.houndGrowl(e.pos.x, e.pos.y, e.pos.z); }
      } else { e.vel.x *= 0.8; e.vel.z *= 0.8; }
    } else if (e.state === 'chase') {
      walkToward(e, p.x, p.z, 4.6, dt);
      if (e.soundCd < 0) { e.soundCd = 2.2 + Math.random() * 2; BRAudio.houndGrowl(e.pos.x, e.pos.y, e.pos.z); }
      if (d < 1.5 && e.attackCd <= 0) {
        e.attackCd = 1.0;
        e.vel.y = 3.5;
        BRAudio.houndBite();
        game.damage(3, 'hound');
        game.addSanity(-4);
      }
      if (d > 20 || (d > 10 && !losToPlayer(e) && e.stateT > 8)) { e.state = 'idle'; e.stateT = 0; }
    }
    applyPhysics(e, dt);
    // 动画
    const sp = Math.hypot(e.vel.x, e.vel.z);
    const m = e.model;
    for (let l = 0; l < 4; l++)
      m.legs[l].rotation.x = Math.sin(e.anim * (2 + sp * 2.2) + (l % 2) * Math.PI) * Math.min(0.7, sp * 0.4);
    m.tail.rotation.y = Math.sin(e.anim * 6) * 0.4;
    m.head.rotation.x = e.state === 'chase' ? 0.15 : Math.sin(e.anim * 0.7) * 0.1;
    m.jaw.rotation.x = e.state === 'chase' ? (0.3 + Math.sin(e.anim * 8) * 0.25) : 0;
  }

  /* ---- 微笑者：只在黑暗中，不被注视时移动 ---- */
  function updateSmiler(e, dt, game) {
    const p = P().pos;
    const d = distToPlayer(e);
    const pl = P();
    // 玩家是否正注视它
    const dir = pl.getDir();
    const dx = e.pos.x - p.x, dy = (e.pos.y + 0.5) - (p.y + 1.62), dz = e.pos.z - p.z;
    const dist3 = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / dist3;
    const seen = dot > 0.55 && losToPlayer(e);
    // 手电筒照射
    const lit = seen && pl.flashlightOn && dot > 0.9 && dist3 < 16;
    if (lit) {
      e.exposure += dt;
      if (e.exposure > 0.9) {
        BRAudio.smilerFlee(e.pos.x, e.pos.y, e.pos.z);
        spawnParticlesAt(e.pos.x, e.pos.y + 0.5, e.pos.z, '#0a0a12', 20);
        e.remove = true;
        game.stat('smilersRepelled');
        return;
      }
    } else e.exposure = Math.max(0, e.exposure - dt * 2);

    if (seen) {
      // 被注视：静止，theatening
      e.vel.x = e.vel.z = 0;
      if (d < 24) {
        game.addSanity(-dt * (d < 8 ? 3.2 : 1.6));
        game.smilerGaze = Math.min(1, (game.smilerGaze || 0) + dt * 2);
        if (e.soundCd < 0) {
          e.soundCd = 3 + Math.random() * 3;
          BRAudio.smilerWhisper(e.pos.x, e.pos.y, e.pos.z, 1);
        }
      }
    } else {
      // 不被注视：滑向玩家
      const sp = 2.6;
      const ang = Math.atan2(p.x - e.pos.x, p.z - e.pos.z);
      e.vel.x = Math.sin(ang) * sp;
      e.vel.z = Math.cos(ang) * sp;
      // 只能待在黑暗：走进亮区就退散
      const l = W().lightAt(e.pos.x, e.pos.y + 0.5, e.pos.z);
      if (l > 0.55) {
        spawnParticlesAt(e.pos.x, e.pos.y + 0.5, e.pos.z, '#0a0a12', 10);
        e.remove = true;
        return;
      }
    }
    // 靠得太近 → 惊吓
    if (d < 1.6) {
      BRAudio.smilerScream();
      game.jumpscare();
      e.remove = true;
      return;
    }
    // 漂浮移动（无重力）
    e.pos.x += e.vel.x * dt;
    e.pos.z += e.vel.z * dt;
    const targetY = 1.2 + Math.sin(e.anim * 1.4) * 0.15;
    e.pos.y += (targetY - e.pos.y) * dt * 2;
    e.group.position.set(e.pos.x, e.pos.y, e.pos.z);
    // 始终面向玩家（+z 为脸）
    e.group.rotation.y = Math.atan2(p.x - e.pos.x, p.z - e.pos.z);
    e.model.glow.material.opacity = 0.15 + Math.sin(e.anim * 3) * 0.08;
  }

  /* ---- 无面灵 ---- */
  function updateFaceling(e, dt, game) {
    const d = distToPlayer(e);
    if (e.state === 'idle' && e.stateT > 3 + Math.random() * 4) {
      e.state = 'wander'; e.stateT = 0;
      const a = Math.random() * Math.PI * 2;
      e.target = { x: e.pos.x + Math.cos(a) * (3 + Math.random() * 5), z: e.pos.z + Math.sin(a) * (3 + Math.random() * 5) };
    } else if (e.state === 'wander') {
      if (!e.target || walkToward(e, e.target.x, e.target.z, 1.1, dt) || e.stateT > 8) {
        e.state = 'idle'; e.stateT = 0; e.vel.x = e.vel.z = 0;
      }
    } else if (e.state === 'flee') {
      const p = P().pos;
      const a = Math.atan2(e.pos.x - p.x, e.pos.z - p.z);
      e.yaw = a;
      e.vel.x = Math.sin(a) * 3.4;
      e.vel.z = Math.cos(a) * 3.4;
      if (e.stateT > 5) { e.state = 'idle'; e.stateT = 0; }
    } else if (e.state === 'idle') {
      e.vel.x *= 0.8; e.vel.z *= 0.8;
    }
    if (d < 3.5 && e.soundCd < 0) {
      e.soundCd = 6 + Math.random() * 5;
      BRAudio.facelingMurmur(e.pos.x, e.pos.y + 1.5, e.pos.z);
    }
    applyPhysics(e, dt);
    // 头看向玩家
    if (d < 5) {
      const p = P().pos;
      const a = Math.atan2(p.x - e.pos.x, p.z - e.pos.z) - e.yaw;
      e.model.head.rotation.y = Math.max(-1.2, Math.min(1.2, a));
    } else e.model.head.rotation.y *= 0.9;
    const sp = Math.hypot(e.vel.x, e.vel.z);
    e.model.limbs[0].rotation.x = Math.sin(e.anim * 5) * Math.min(0.5, sp * 0.5);
    e.model.limbs[1].rotation.x = -Math.sin(e.anim * 5) * Math.min(0.5, sp * 0.5);
    e.model.limbs[2].rotation.x = -Math.sin(e.anim * 5) * Math.min(0.4, sp * 0.4);
    e.model.limbs[3].rotation.x = Math.sin(e.anim * 5) * Math.min(0.4, sp * 0.4);
  }

  /* ---- 攻击实体 ---- */
  E.hurt = function (e, dmg, game) {
    if (e.type === 'smiler') {
      BRAudio.smilerWhisper(e.pos.x, e.pos.y, e.pos.z, 1);
      return; // 免疫物理伤害
    }
    e.hp -= dmg;
    e.hurtT = 0.35;
    BRAudio.hitFlesh();
    spawnParticlesAt(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z, '#7a2222', 8);
    // 击退
    const p = P().pos;
    const a = Math.atan2(e.pos.x - p.x, e.pos.z - p.z);
    e.vel.x += Math.sin(a) * 4; e.vel.z += Math.cos(a) * 4;
    e.vel.y = 3;
    if (e.type === 'faceling') { e.state = 'flee'; e.stateT = 0; }
    if (e.type === 'hound' && e.state !== 'chase') { e.state = 'chase'; e.stateT = 0; }
    if (e.hp <= 0) {
      e.dead = true; e.deadT = 0;
      if (e.type === 'hound') { BRAudio.houndDie(e.pos.x, e.pos.y, e.pos.z); game.stat('houndsKilled'); }
      if (e.type === 'faceling') game.addSanity(-10);
    }
  };

  /* ---- 实体射线（近战检测） ---- */
  E.raycastEntity = function (eye, dir, maxDist) {
    let best = null, bd = maxDist;
    for (const e of E.list) {
      if (e.dead) continue;
      const cx = e.pos.x - eye.x, cy = (e.pos.y + e.height / 2) - eye.y, cz = e.pos.z - eye.z;
      const t = cx * dir.x + cy * dir.y + cz * dir.z;
      if (t < 0 || t > bd) continue;
      const px = eye.x + dir.x * t - e.pos.x;
      const py = eye.y + dir.y * t - (e.pos.y + e.height / 2);
      const pz = eye.z + dir.z * t - e.pos.z;
      const r = Math.max(e.half + 0.25, 0.5);
      if (px * px + pz * pz < r * r && Math.abs(py) < e.height / 2 + 0.3) {
        best = e; bd = t;
      }
    }
    return best;
  };

  /* ---- 生成逻辑 ---- */
  let spawnTimer = 0;
  E.trySpawn = function (dt, game) {
    spawnTimer -= dt;
    if (spawnTimer > 0) return;
    spawnTimer = 3.5;
    const lv = W().level;
    if (!lv) return;
    const counts = { hound: 0, smiler: 0, faceling: 0 };
    for (const e of E.list) counts[e.type]++;
    const p = P().pos;
    for (const type of ['hound', 'smiler', 'faceling']) {
      const cap = lv.mobs[type] || 0;
      if (counts[type] >= cap) continue;
      if (Math.random() > 0.55) continue;
      // 随机找生成点
      for (let attempt = 0; attempt < 6; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const r = 16 + Math.random() * 14;
        const x = Math.floor(p.x + Math.cos(a) * r) + 0.5;
        const z = Math.floor(p.z + Math.sin(a) * r) + 0.5;
        const bx = Math.floor(x), bz = Math.floor(z);
        if (W().isSolid(bx, 1, bz) || W().isSolid(bx, 2, bz)) continue;
        if (!W().isSolid(bx, 0, bz)) continue;
        const light = W().lightAt(x, 1.5, z);
        if (type === 'smiler' && light > 0.3) continue;
        if (type === 'faceling' && light < 0.3) continue;
        makeEntity(type, x, 1.05, z);
        break;
      }
    }
  };

  /* ================= 掉落物 ================= */
  const texLoader = new THREE.TextureLoader();
  const dropTexCache = {};
  function dropMesh(itemId) {
    const it = B().items[itemId];
    if (it && it.block !== undefined && window.BRPlayer) {
      // 方块类：小方块
      const def = B().defs[it.block];
      let tiles = def.tiles;
      if (typeof tiles === 'function') tiles = tiles(0, 0, 0);
      const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      const uvAttr = geo.getAttribute('uv');
      const faceTiles = [tiles.side, tiles.side, tiles.top, tiles.bottom, tiles.side, tiles.side];
      for (let f = 0; f < 6; f++) {
        const tuv = BRAssets.tileUV[faceTiles[f]] || BRAssets.tileUV.wallpaper0;
        const [u0, v0, u1, v1] = tuv;
        const o = f * 4;
        uvAttr.setXY(o + 0, u0, v1); uvAttr.setXY(o + 1, u1, v1);
        uvAttr.setXY(o + 2, u0, v0); uvAttr.setXY(o + 3, u1, v0);
      }
      return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: BRAssets.atlasTexture }));
    }
    if (!dropTexCache[itemId]) {
      const tex = texLoader.load(BRAssets.iconURL[itemId]);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      dropTexCache[itemId] = tex;
    }
    return new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.36),
      new THREE.MeshLambertMaterial({ map: dropTexCache[itemId], transparent: true, alphaTest: 0.05, side: THREE.DoubleSide })
    );
  }
  E.spawnDrop = function (itemId, n, x, y, z, burst) {
    const mesh = dropMesh(itemId);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    const d = {
      id: itemId, n, mesh,
      pos: { x, y, z },
      vel: burst ? { x: (Math.random() - 0.5) * 2.4, y: 2.4 + Math.random() * 1.4, z: (Math.random() - 0.5) * 2.4 } : { x: 0, y: 0, z: 0 },
      age: 0, pickDelay: burst ? 0.5 : 0
    };
    E.drops.push(d);
    return d;
  };
  function updateDrops(dt, game) {
    const p = P().pos;
    for (let i = E.drops.length - 1; i >= 0; i--) {
      const d = E.drops[i];
      d.age += dt;
      d.pickDelay -= dt;
      // 简单物理
      d.vel.y -= 16 * dt;
      d.pos.x += d.vel.x * dt;
      d.pos.z += d.vel.z * dt;
      d.pos.y += d.vel.y * dt;
      const fy = Math.floor(d.pos.y - 0.14);
      if (d.vel.y < 0 && W().isSolid(Math.floor(d.pos.x), fy, Math.floor(d.pos.z))) {
        d.pos.y = fy + 1.14;
        d.vel.y = 0; d.vel.x *= 0.7; d.vel.z *= 0.7;
      }
      if (d.pos.y < -10) { scene.remove(d.mesh); E.drops.splice(i, 1); continue; }
      // 磁吸拾取
      const dx = p.x - d.pos.x, dy = (p.y + 0.9) - d.pos.y, dz = p.z - d.pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d.pickDelay <= 0 && dist < 2.2) {
        const pull = Math.max(0, 2.2 - dist) * 6;
        d.pos.x += dx / dist * pull * dt;
        d.pos.y += dy / dist * pull * dt;
        d.pos.z += dz / dist * pull * dt;
        if (dist < 0.6) {
          const left = game.giveItem(d.id, d.n);
          if (left === 0) {
            BRAudio.pop();
            scene.remove(d.mesh);
            E.drops.splice(i, 1);
            continue;
          } else d.n = left;
        }
      }
      d.mesh.position.set(d.pos.x, d.pos.y + Math.sin(d.age * 2.5) * 0.06, d.pos.z);
      d.mesh.rotation.y = d.age * 1.8;
      // 环境明暗
      d._ltT = (d._ltT === undefined ? 0 : d._ltT) - dt;
      if (d._ltT <= 0) {
        d._ltT = 0.25;
        const lb = Math.max(0.15, Math.min(1, W().lightAt(d.pos.x, d.pos.y, d.pos.z)));
        if (d.mesh.material.color) d.mesh.material.color.setScalar(lb);
      }
    }
  }

  /* ================= 粒子 ================= */
  const MAXP = 400;
  function initParticles() {
    if (particles) { scene.add(particles); return; }
    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(MAXP * 3);
    const colArr = new Float32Array(MAXP * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const mat = new THREE.PointsMaterial({ size: 0.09, vertexColors: true, sizeAttenuation: true });
    particles = new THREE.Points(geo, mat);
    particles.frustumCulled = false;
    particleData = [];
    for (let i = 0; i < MAXP; i++) particleData.push({ life: 0 });
    scene.add(particles);
  }
  function spawnParticlesAt(x, y, z, hexColor, count) {
    const c = new THREE.Color(hexColor);
    let spawned = 0;
    for (let i = 0; i < MAXP && spawned < count; i++) {
      const pd = particleData[i];
      if (pd.life > 0) continue;
      pd.life = 0.5 + Math.random() * 0.35;
      pd.x = x + (Math.random() - 0.5) * 0.6;
      pd.y = y + (Math.random() - 0.5) * 0.6;
      pd.z = z + (Math.random() - 0.5) * 0.6;
      pd.vx = (Math.random() - 0.5) * 3;
      pd.vy = Math.random() * 3.5;
      pd.vz = (Math.random() - 0.5) * 3;
      pd.r = c.r * (0.8 + Math.random() * 0.4);
      pd.g = c.g * (0.8 + Math.random() * 0.4);
      pd.b = c.b * (0.8 + Math.random() * 0.4);
      spawned++;
    }
  }
  E.spawnParticles = spawnParticlesAt;
  function updateParticles(dt) {
    if (!particles) return;
    const posArr = particles.geometry.attributes.position.array;
    const colArr = particles.geometry.attributes.color.array;
    for (let i = 0; i < MAXP; i++) {
      const pd = particleData[i];
      if (pd.life <= 0) {
        posArr[i * 3 + 1] = -999;
        continue;
      }
      pd.life -= dt;
      pd.vy -= 12 * dt;
      pd.x += pd.vx * dt; pd.y += pd.vy * dt; pd.z += pd.vz * dt;
      if (pd.y < 1.02 && pd.vy < 0) { pd.y = 1.02; pd.vy *= -0.3; pd.vx *= 0.6; pd.vz *= 0.6; }
      posArr[i * 3] = pd.x; posArr[i * 3 + 1] = pd.y; posArr[i * 3 + 2] = pd.z;
      colArr[i * 3] = pd.r; colArr[i * 3 + 1] = pd.g; colArr[i * 3 + 2] = pd.b;
    }
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;
  }
})();
