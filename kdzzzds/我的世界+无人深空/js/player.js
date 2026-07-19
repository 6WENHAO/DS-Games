// ============ 玩家控制器 ============
const Player = (() => {
  const EYE = 1.62, WIDTH = 0.6, HEIGHT_P = 1.8;
  const WALK = 4.4, RUN = 7.0, JUMP = 8.2, GRAV = -22;

  const pos = new THREE.Vector3(8, 40, 8);
  const vel = new THREE.Vector3();
  let yaw = 0, pitch = 0;
  let onGround = false;
  let camera = null;

  const stats = { health: 1, hazard: 1, life: 1, beam: 1, jet: 1 };
  const keys = {};
  let mining = null;       // { x, y, z, progress, hardness }
  let miningActive = false;
  let footTimer = 0, wasOnGround = true, fallSpeed = 0;
  let beamLine = null, beamGlow = null;
  let dead = false;

  function init(cam, scene) {
    camera = cam;
    // 采矿光束视觉
    const beamMat = new THREE.LineBasicMaterial({ color: 0xffb54a, transparent: true, opacity: 0.9 });
    const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    beamLine = new THREE.Line(beamGeo, beamMat);
    beamLine.visible = false;
    beamLine.frustumCulled = false;
    scene.add(beamLine);
    const glowGeo = new THREE.SphereGeometry(0.18, 8, 8);
    beamGlow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.85 }));
    beamGlow.visible = false;
    scene.add(beamGlow);
  }

  function spawnAt(x, z) {
    const y = World.surfaceHeight(x, z);
    pos.set(x + 0.5, y + 0.5, z + 0.5);
    vel.set(0, 0, 0);
    stats.health = 1; stats.hazard = 1; stats.life = 1; stats.beam = 1; stats.jet = 1;
    dead = false;
  }

  function onMouseMove(dx, dy) {
    yaw -= dx * 0.0022;
    pitch -= dy * 0.0022;
    pitch = Math.max(-1.55, Math.min(1.55, pitch));
  }

  function getDir() {
    return new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );
  }

  // AABB 碰撞
  function collide(axis) {
    const half = WIDTH / 2;
    const minX = Math.floor(pos.x - half), maxX = Math.floor(pos.x + half);
    const minY = Math.floor(pos.y), maxY = Math.floor(pos.y + HEIGHT_P);
    const minZ = Math.floor(pos.z - half), maxZ = Math.floor(pos.z + half);
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++) {
          if (!World.isSolid(x, y, z)) continue;
          if (axis === 'y') {
            if (vel.y < 0) { pos.y = y + 1; if (fallSpeed < -12) { damage(Math.min(0.4, (-fallSpeed - 12) * 0.03)); Sfx.land(true); } else if (!wasOnGround) Sfx.land(); vel.y = 0; onGround = true; }
            else { pos.y = y - HEIGHT_P - 0.001; vel.y = 0; }
          } else if (axis === 'x') {
            pos.x = vel.x > 0 ? x - half - 0.001 : x + 1 + half + 0.001;
            vel.x = 0;
          } else {
            pos.z = vel.z > 0 ? z - half - 0.001 : z + 1 + half + 0.001;
            vel.z = 0;
          }
          return;
        }
  }

  function damage(amount) {
    if (dead) return;
    stats.health -= amount;
    Sfx.hurt();
    UI.setDamageVignette(Math.min(1, (1 - stats.health) * 1.2));
    if (stats.health <= 0) { stats.health = 0; die(); }
  }

  function die() {
    dead = true;
    UI.notify('生命信号丢失', '外骨骼装甲重启中 · 部分资源已散佚');
    // 温和惩罚: 恢复但扣一半资源
    setTimeout(() => {
      ['carbon', 'ferrite', 'dihydrogen', 'oxygen', 'sodium'].forEach(id => {
        const c = Items.count(id);
        if (c > 0) Items.remove(id, Math.floor(c / 2));
      });
      stats.health = 1; stats.hazard = 0.5; stats.life = 0.5;
      const y = World.surfaceHeight(pos.x, pos.z);
      pos.y = y + 1; vel.set(0, 0, 0);
      dead = false;
      UI.setDamageVignette(0);
    }, 1800);
  }

  function recharge(key) {
    stats[key] = 1;
    if (key === 'hazard') UI.notify('危险防护已充能', 'HAZARD PROTECTION 100%');
    if (key === 'life') UI.notify('生命维持已充能', 'LIFE SUPPORT 100%');
    if (key === 'beam') UI.notify('采矿光束已充能', 'MINING BEAM 100%');
  }

  let envTimer = 0;
  function update(dt) {
    if (dead) return;
    const p = World.planet;

    // ---------- 移动 ----------
    const running = keys['ShiftLeft'] && (keys['KeyW']);
    const speed = running ? RUN : WALK;
    const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const r = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const move = new THREE.Vector3();
    if (keys['KeyW']) move.add(f);
    if (keys['KeyS']) move.sub(f);
    if (keys['KeyD']) move.add(r);
    if (keys['KeyA']) move.sub(r);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);
    vel.x += (move.x - vel.x) * Math.min(1, dt * 12);
    vel.z += (move.z - vel.z) * Math.min(1, dt * 12);

    // 跳跃/喷气背包
    if (keys['Space']) {
      if (onGround) { vel.y = JUMP; onGround = false; Sfx.jump(); }
      else if (stats.jet > 0.02) {
        vel.y += 26 * dt;
        vel.y = Math.min(vel.y, 9);
        stats.jet -= dt * 0.45;
        if (!Sfx.hasLoop('jet')) Sfx.jetLoop();
      }
    }
    if ((!keys['Space'] || stats.jet <= 0.02 || onGround) && Sfx.hasLoop('jet')) Sfx.stopLoop('jet');
    if (onGround) stats.jet = Math.min(1, stats.jet + dt * 0.8);

    vel.y += GRAV * dt;
    vel.y = Math.max(vel.y, -40);
    fallSpeed = vel.y;

    wasOnGround = onGround;
    onGround = false;
    pos.x += vel.x * dt; collide('x');
    pos.z += vel.z * dt; collide('z');
    pos.y += vel.y * dt; collide('y');

    // 脚步声
    if (onGround && move.lengthSq() > 0.1) {
      footTimer -= dt * (running ? 1.6 : 1);
      if (footTimer <= 0) { footTimer = 0.42; Sfx.footstep(Math.floor(pos.x + pos.z)); }
    }

    // ---------- 生存消耗 ----------
    stats.hazard -= dt * 0.004 * (p ? p.hazardRate : 1);
    stats.life -= dt * 0.0025;
    if (stats.hazard <= 0) { stats.hazard = 0; damage(dt * 0.06); }
    if (stats.life <= 0) { stats.life = 0; damage(dt * 0.06); }
    if (stats.health < 1 && stats.hazard > 0.1 && stats.life > 0.1)
      stats.health = Math.min(1, stats.health + dt * 0.02);
    UI.setDamageVignette(stats.health < 0.5 ? (0.5 - stats.health) * 1.6 : 0);

    envTimer -= dt;
    if (envTimer <= 0) {
      envTimer = 2;
      UI.setBarDanger('row-hazard', stats.hazard < 0.25);
      UI.setBarDanger('row-life', stats.life < 0.25);
      if ((stats.hazard < 0.25 || stats.life < 0.25) && Math.random() < 0.7) Sfx.warning();
    }

    // ---------- 采矿 ----------
    updateMining(dt);

    // ---------- 相机 ----------
    camera.position.set(pos.x, pos.y + EYE, pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // HUD 条
    UI.setBar('bar-hazard', stats.hazard);
    UI.setBar('bar-life', stats.life);
    UI.setBar('bar-health', stats.health);
    UI.setBar('bar-beam', stats.beam);
    UI.setBar('bar-jet', stats.jet);
  }

  function updateMining(dt) {
    const eye = new THREE.Vector3(pos.x, pos.y + EYE, pos.z);
    const dir = getDir();
    const hit = World.raycast(eye, dir, 6);

    if (miningActive && stats.beam > 0.02 && hit) {
      const def = BLOCKS[hit.block];
      if (!mining || mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z) {
        mining = { x: hit.x, y: hit.y, z: hit.z, progress: 0, hardness: def.hard || 1, block: hit.block };
      }
      if (!Sfx.hasLoop('mine')) Sfx.mineLoop();
      mining.progress += dt / mining.hardness * 1.6;
      stats.beam -= dt * 0.03;
      UI.setMineProgress(Math.min(1, mining.progress));
      if (Math.random() < dt * 8) Sfx.crunch(Math.floor(mining.progress * 10));

      // 光束视觉
      const hitPoint = eye.clone().add(dir.clone().multiplyScalar(hit.dist - 0.05));
      const muzzle = eye.clone()
        .add(dir.clone().multiplyScalar(0.8))
        .add(new THREE.Vector3(Math.cos(yaw) * 0.32, -0.28, -Math.sin(yaw) * 0.32));
      beamLine.geometry.setFromPoints([muzzle, hitPoint]);
      beamLine.visible = true;
      beamGlow.position.copy(hitPoint);
      beamGlow.scale.setScalar(0.8 + Math.random() * 0.5);
      beamGlow.visible = true;

      if (mining.progress >= 1) {
        const drop = def.drop;
        World.setBlock(mining.x, mining.y, mining.z, 0);
        Sfx.blockBreak(mining.hardness > 1);
        if (drop) {
          const bonus = Math.random() < 0.3 ? 1 : 0;
          Items.add(drop.id, drop.n + bonus);
          UI.pickup(drop.id, drop.n + bonus);
          Missions.onCollect(drop.id);
        }
        Game.spawnBreakParticles(mining.x + 0.5, mining.y + 0.5, mining.z + 0.5, mining.block);
        mining = null;
      }
    } else {
      mining = null;
      UI.setMineProgress(null);
      beamLine.visible = false;
      beamGlow.visible = false;
      if (Sfx.hasLoop('mine')) Sfx.stopLoop('mine');
      if (miningActive && stats.beam <= 0.02) {
        stats.beam = 0;
      }
    }
  }

  function startMine() { miningActive = true; }
  function stopMine() { miningActive = false; }

  function placeBlock() {
    if (Items.count('terrain') <= 0) { Sfx.error(); UI.notify('缺少地形方块', '打开物品栏(Tab) 用铁尘合成'); return; }
    const eye = new THREE.Vector3(pos.x, pos.y + EYE, pos.z);
    const hit = World.raycast(eye, getDir(), 6);
    if (!hit) return;
    const bx = hit.x + hit.face[0], by = hit.y + hit.face[1], bz = hit.z + hit.face[2];
    // 不能放在自己身上
    const half = WIDTH / 2;
    if (bx + 1 > pos.x - half && bx < pos.x + half &&
        by + 1 > pos.y && by < pos.y + HEIGHT_P &&
        bz + 1 > pos.z - half && bz < pos.z + half) return;
    World.setBlock(bx, by, bz, 13);
    Items.remove('terrain', 1);
    Sfx.blockPlace();
  }

  function setKey(code, down) { keys[code] = down; }

  return {
    init, spawnAt, update, onMouseMove, startMine, stopMine, placeBlock, setKey, recharge, damage,
    get pos() { return pos; }, get yaw() { return yaw; }, set yaw(v) { yaw = v; },
    get pitch() { return pitch; }, set pitch(v) { pitch = v; },
    getDir, stats, get dead() { return dead; },
    EYE,
  };
})();
