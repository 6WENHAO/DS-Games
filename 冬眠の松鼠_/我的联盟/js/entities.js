'use strict';
// ---------- 实体：物理 / 粒子 / 伤害数字 / 敌人 / 投射物 ----------
const GRAVITY = 24;
const enemies = [];
const projectiles = [];
let entScene = null;

// ---------- 通用 AABB 体素碰撞 ----------
function entityInWater(e){
  return getBlock(Math.floor(e.pos.x), Math.floor(e.pos.y + 0.4), Math.floor(e.pos.z)) === B.WATER;
}
function collideAxis(e, axis){
  const eps = 0.001;
  const w = e.w, h = e.h;
  const minX = Math.floor(e.pos.x - w), maxX = Math.floor(e.pos.x + w);
  const minY = Math.floor(e.pos.y), maxY = Math.floor(e.pos.y + h - eps);
  const minZ = Math.floor(e.pos.z - w), maxZ = Math.floor(e.pos.z + w);
  for(let bx = minX; bx <= maxX; bx++){
    for(let by = minY; by <= maxY; by++){
      for(let bz = minZ; bz <= maxZ; bz++){
        if(!isSolid(getBlock(bx, by, bz))) continue;
        if(axis === 'y'){
          if(e.vel.y <= 0){ e.pos.y = by + 1; e.onGround = true; }
          else { e.pos.y = by - h - eps; }
          e.vel.y = 0;
        } else if(axis === 'x'){
          if(e.vel.x > 0) e.pos.x = bx - w - eps;
          else if(e.vel.x < 0) e.pos.x = bx + 1 + w + eps;
          e.vel.x = 0; e.hitWall = true;
        } else {
          if(e.vel.z > 0) e.pos.z = bz - w - eps;
          else if(e.vel.z < 0) e.pos.z = bz + 1 + w + eps;
          e.vel.z = 0; e.hitWall = true;
        }
        return;
      }
    }
  }
}
function moveEntity(e, dt){
  const inWater = entityInWater(e);
  e.inWater = inWater;
  const g = inWater ? 7 : GRAVITY;
  e.vel.y -= g * dt;
  if(inWater){
    e.vel.y = clamp(e.vel.y, -3.2, 5);
    const damp = Math.pow(0.35, dt);
    e.vel.x *= damp; e.vel.z *= damp;
  }
  if(e.vel.y < -42) e.vel.y = -42;
  e.onGround = false; e.hitWall = false;
  e.pos.x += e.vel.x * dt; collideAxis(e, 'x');
  e.pos.z += e.vel.z * dt; collideAxis(e, 'z');
  e.pos.y += e.vel.y * dt; collideAxis(e, 'y');
}

// ---------- 粒子系统 (InstancedMesh) ----------
const MAXP = 700;
let particleMesh = null;
const particles = [];
const _pm = new THREE.Matrix4();
const _pq = new THREE.Quaternion();
const _ps = new THREE.Vector3();
const _pv = new THREE.Vector3();

function initParticles(scene){
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  particleMesh = new THREE.InstancedMesh(geo, mat, MAXP);
  particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particleMesh.frustumCulled = false;
  const white = new THREE.Color(0xffffff);
  for(let i = 0; i < MAXP; i++){
    particles.push({ life: 0, maxLife: 1, size: 0.1, grav: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3() });
    particleMesh.setColorAt(i, white);
  }
  scene.add(particleMesh);
}
let pCursor = 0;
const _pcol = new THREE.Color();
function spawnParticle(x, y, z, vx, vy, vz, color, life, size, grav){
  const idx = pCursor;
  pCursor = (pCursor + 1) % MAXP;
  const p = particles[idx];
  p.pos.set(x, y, z); p.vel.set(vx, vy, vz);
  p.life = p.maxLife = life; p.size = size; p.grav = grav;
  particleMesh.setColorAt(idx, _pcol.set(color));
  if(particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
}
function spawnBurst(pos, opts){
  const n = opts.count || 12;
  const colors = opts.colors || [0xffffff];
  const speed = opts.speed || 4;
  const life = opts.life || 0.7;
  const size = opts.size || 0.12;
  const grav = opts.grav !== undefined ? opts.grav : 1;
  const up = opts.up || 0;
  for(let i = 0; i < n; i++){
    const a = Math.random() * Math.PI * 2;
    const b = (Math.random() - 0.5) * Math.PI;
    const s = speed * (0.4 + Math.random() * 0.6);
    spawnParticle(
      pos.x + (Math.random() - 0.5) * 0.4, pos.y + (Math.random() - 0.5) * 0.4, pos.z + (Math.random() - 0.5) * 0.4,
      Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + up, Math.sin(a) * Math.cos(b) * s,
      colors[(Math.random() * colors.length) | 0],
      life * (0.6 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.9), grav
    );
  }
}
function updateParticles(dt){
  for(let i = 0; i < MAXP; i++){
    const p = particles[i];
    if(p.life > 0){
      p.life -= dt;
      p.vel.y -= GRAVITY * 0.55 * p.grav * dt;
      p.pos.addScaledVector(p.vel, dt);
      const s = p.size * Math.max(0.05, p.life / p.maxLife);
      _ps.set(s, s, s);
      _pq.setFromEuler(new THREE.Euler(p.life * 5, p.life * 7, 0));
      _pm.compose(p.pos, _pq, _ps);
    } else {
      _ps.set(0, 0, 0);
      _pm.compose(_pv.set(0, -100, 0), _pq.identity(), _ps);
    }
    particleMesh.setMatrixAt(i, _pm);
  }
  particleMesh.instanceMatrix.needsUpdate = true;
}

// ---------- 伤害数字 ----------
const dmgPool = [];
function initDamageNumbers(scene){
  for(let i = 0; i < 36; i++){
    const cv = document.createElement('canvas');
    cv.width = 192; cv.height = 96;
    const tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(1.9, 0.95, 1);
    sp.visible = false;
    scene.add(sp);
    dmgPool.push({ sp, cv, tex, life: 0, vy: 0 });
  }
}
let dmgCursor = 0;
function showDamage(pos, text, color, big){
  const d = dmgPool[dmgCursor];
  dmgCursor = (dmgCursor + 1) % dmgPool.length;
  const ctx = d.cv.getContext('2d');
  ctx.clearRect(0, 0, 192, 96);
  ctx.font = 'bold ' + (big ? 52 : 40) + 'px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 8; ctx.strokeStyle = '#000';
  ctx.strokeText(text, 96, 48);
  ctx.fillStyle = color || '#fff';
  ctx.fillText(text, 96, 48);
  d.tex.needsUpdate = true;
  d.sp.position.copy(pos);
  d.sp.position.x += (Math.random() - 0.5) * 0.5;
  d.sp.position.z += (Math.random() - 0.5) * 0.5;
  d.sp.visible = true;
  d.sp.material.opacity = 1;
  d.life = 0.9;
  d.vy = 1.6;
}
function updateDamageNumbers(dt){
  for(const d of dmgPool){
    if(d.life <= 0) continue;
    d.life -= dt;
    d.sp.position.y += d.vy * dt;
    d.vy *= Math.pow(0.4, dt);
    d.sp.material.opacity = clamp(d.life / 0.45, 0, 1);
    if(d.life <= 0) d.sp.visible = false;
  }
}

// ---------- 敌人 ----------
function makeHumanoid(o){
  const g = new THREE.Group();
  const mats = [];
  const M = c => { const m = new THREE.MeshLambertMaterial({ color: c }); mats.push(m); return m; };
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), M(o.head));
  head.position.y = 1.75; g.add(head);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.26), M(o.shirt));
  body.position.y = 1.125; g.add(body);
  function limb(c, x, y, len){
    const geo = new THREE.BoxGeometry(0.22, len, 0.22);
    geo.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(geo, M(c));
    m.position.set(x, y, 0); g.add(m);
    return m;
  }
  const armL = limb(o.arm, -0.37, 1.5, 0.72);
  const armR = limb(o.arm, 0.37, 1.5, 0.72);
  const legL = limb(o.pants, -0.13, 0.76, 0.76);
  const legR = limb(o.pants, 0.13, 0.76, 0.76);
  if(o.zombieArms){ armL.rotation.x = -Math.PI / 2; armR.rotation.x = -Math.PI / 2; }
  if(o.eyes){
    const em = new THREE.MeshBasicMaterial({ color: o.eyes }); mats.push(em);
    const e1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.03), em);
    e1.position.set(-0.11, 1.8, 0.26); g.add(e1);
    const e2 = e1.clone(); e2.position.x = 0.11; g.add(e2);
  }
  return { group: g, head, body, armL, armR, legL, legR, mats };
}
function addHpBar(e){
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x111111, depthTest: false }));
  bg.scale.set(0.95, 0.11, 1);
  bg.position.y = 2.35;
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x44e04c, depthTest: false }));
  fg.center.set(0, 0.5);
  fg.scale.set(0.9, 0.08, 1);
  fg.position.set(-0.45, 2.35, 0.001);
  e.model.group.add(bg); e.model.group.add(fg);
  e.hpFg = fg;
}
function updateHpBar(e){
  if(e.hpFg) e.hpFg.scale.x = 0.9 * clamp(e.hp / e.maxHp, 0, 1);
}

function spawnEnemy(type, wave, x, z){
  const y = surfaceY(x | 0, z | 0) + 1;
  let e;
  if(type === 'zombie'){
    const model = makeHumanoid({ head: 0x4f9e46, shirt: 0x2f8f8f, arm: 0x4f9e46, pants: 0x4a4a8a, zombieArms: true, eyes: 0x111111 });
    e = { type, model, scale: 1, w: 0.32, h: 1.95,
      hp: 50 + wave * 14, dmg: 8 + wave * 2, speed: 2.6 + Math.min(wave * 0.14, 1.8),
      xp: 26 + wave * 4 };
  } else if(type === 'skeleton'){
    const model = makeHumanoid({ head: 0xd8d8d8, shirt: 0xbfbfbf, arm: 0xd0d0d0, pants: 0xa8a8a8, eyes: 0x222222 });
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), new THREE.MeshLambertMaterial({ color: 0x6b4a26 }));
    bow.position.set(0.42, 1.15, 0.3);
    model.group.add(bow);
    model.armR.rotation.x = -Math.PI / 2;
    e = { type, model, scale: 1, w: 0.32, h: 1.95,
      hp: 36 + wave * 10, dmg: 7 + wave * 2, speed: 2.4,
      xp: 34 + wave * 5 };
  } else { // boss
    const model = makeHumanoid({ head: 0x2e6b28, shirt: 0x8a2020, arm: 0x2e6b28, pants: 0x222222, zombieArms: true, eyes: 0xff2200 });
    model.group.scale.setScalar(1.9);
    e = { type, model, scale: 1.9, w: 0.6, h: 3.7, boss: true,
      hp: 320 + wave * 70, dmg: 18 + wave * 3, speed: 2.3,
      xp: 240 + wave * 10, slamCd: 4 };
  }
  e.maxHp = e.hp;
  e.pos = new THREE.Vector3(x, y, z);
  e.vel = new THREE.Vector3();
  e.attackCd = 1 + Math.random();
  e.animT = Math.random() * 6;
  e.flashT = 0;
  e.dead = false;
  addHpBar(e);
  e.model.group.position.copy(e.pos);
  entScene.add(e.model.group);
  enemies.push(e);
  return e;
}

function enemyCenter(e){ return new THREE.Vector3(e.pos.x, e.pos.y + e.h * 0.55, e.pos.z); }
function enemyHead(e){ return new THREE.Vector3(e.pos.x, e.pos.y + e.h + 0.3, e.pos.z); }

function damageEnemy(e, amt, opts){
  if(e.dead) return;
  opts = opts || {};
  amt = Math.max(1, Math.round(amt));
  e.hp -= amt;
  updateHpBar(e);
  showDamage(enemyHead(e), String(amt), opts.color || '#ffffff', !!opts.big);
  e.flashT = 0.12;
  for(const m of e.model.mats){ if(m.emissive) m.emissive.setHex(0x991111); }
  if(opts.kb){
    e.vel.x += opts.kb.x; e.vel.y += opts.kb.y || 2; e.vel.z += opts.kb.z;
  }
  spawnBurst(enemyCenter(e), { count: 6, colors: [0xc22525, 0x7d1f1f], speed: 3, life: 0.5, size: 0.09 });
  if(e.hp <= 0) killEnemy(e);
}
function killEnemy(e){
  if(e.dead) return;
  e.dead = true;
  spawnBurst(enemyCenter(e), { count: 26, colors: [0xc22525, 0x333333, 0x888888], speed: 5.5, life: 0.9, size: 0.13, up: 3 });
  entScene.remove(e.model.group);
  sfx.kill();
  onEnemyKilled(e);
}

function losClear(from, to){
  const dir = to.clone().sub(from);
  const dist = dir.length();
  if(dist < 0.001) return true;
  dir.normalize();
  const hit = raycastVoxel(from, dir, dist);
  return !hit;
}
function shootArrow(e){
  const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.55 * e.scale, e.pos.z);
  const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.2, player.pos.z);
  const d = from.distanceTo(target);
  target.addScaledVector(player.vel, d / 17 * 0.55);
  target.y += d * 0.045;
  const dir = target.sub(from).normalize();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, 0.55),
    new THREE.MeshBasicMaterial({ color: 0xd9c9a3 })
  );
  mesh.position.copy(from);
  mesh.lookAt(from.clone().add(dir));
  entScene.add(mesh);
  projectiles.push({ type: 'arrow', owner: 'enemy', mesh, pos: from.clone(), vel: dir.multiplyScalar(17), life: 4, grav: 5, dmg: e.dmg, r: 0.3 });
  sfx.arrow();
}

function updateEnemies(dt){
  for(let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    if(e.dead){ enemies.splice(i, 1); continue; }
    if(e.flashT > 0){
      e.flashT -= dt;
      if(e.flashT <= 0) for(const m of e.model.mats){ if(m.emissive) m.emissive.setHex(0); }
    }
    e.attackCd -= dt;
    if(e.slamCd !== undefined) e.slamCd -= dt;

    const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    let mvx = 0, mvz = 0;
    if(!player.dead){
      if(e.type === 'skeleton'){
        if(dist > 12){ mvx = dx / dist; mvz = dz / dist; }
        else if(dist < 6){ mvx = -dx / dist; mvz = -dz / dist; }
        if(e.attackCd <= 0 && dist <= 17){
          const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.55, e.pos.z);
          const to = new THREE.Vector3(player.pos.x, player.pos.y + 1.4, player.pos.z);
          if(losClear(from, to)){ shootArrow(e); e.attackCd = 2.4; }
          else { e.attackCd = 0.35; mvx = dx / dist; mvz = dz / dist; }
        }
      } else {
        if(dist > 1.35){ mvx = dx / dist; mvz = dz / dist; }
        if(e.attackCd <= 0 && dist < 1.95 && Math.abs(player.pos.y - e.pos.y) < 2.4){
          playerTakeDamage(e.dmg, e.pos);
          e.attackCd = 1.25;
        }
        if(e.boss && e.slamCd <= 0 && dist < 5.5){
          e.slamCd = 6;
          e.vel.y = 7;
          e.slamPending = 0.55;
        }
      }
    }
    if(e.slamPending !== undefined){
      e.slamPending -= dt;
      if(e.slamPending <= 0){
        delete e.slamPending;
        spawnBurst(e.pos, { count: 30, colors: [0x8a5a2a, 0x666666], speed: 7, life: 0.8, size: 0.16, up: 4 });
        addShake(0.5);
        sfx.explode();
        const d2 = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
        if(d2 < 5 && Math.abs(player.pos.y - e.pos.y) < 3 && !player.dead){
          playerTakeDamage(e.dmg * 1.5, e.pos);
          const kd = new THREE.Vector3(player.pos.x - e.pos.x, 0, player.pos.z - e.pos.z).normalize();
          player.vel.x += kd.x * 9; player.vel.z += kd.z * 9; player.vel.y += 6;
        }
      }
    }
    const sp = e.speed;
    const k = Math.min(1, 10 * dt);
    e.vel.x += (mvx * sp - e.vel.x) * k;
    e.vel.z += (mvz * sp - e.vel.z) * k;
    moveEntity(e, dt);
    if(e.hitWall && e.onGround && (mvx || mvz)) e.vel.y = 8.4;
    if(e.inWater && (mvx || mvz)) e.vel.y = Math.max(e.vel.y, 2.5);

    const moving = Math.hypot(e.vel.x, e.vel.z) > 0.4;
    e.animT += dt * (moving ? sp * 2.4 : 0);
    const sw = Math.sin(e.animT) * 0.55;
    e.model.legL.rotation.x = sw;
    e.model.legR.rotation.x = -sw;
    if(e.type === 'skeleton'){
      e.model.armL.rotation.x = -sw * 0.7;
    } else {
      e.model.armL.rotation.x = -Math.PI / 2 + Math.sin(e.animT * 0.7) * 0.12;
      e.model.armR.rotation.x = -Math.PI / 2 - Math.sin(e.animT * 0.7) * 0.12;
    }
    e.model.group.position.copy(e.pos);
    if(dist > 0.01) e.model.group.rotation.y = Math.atan2(dx, dz);
    if(e.pos.y < -20){ e.dead = true; entScene.remove(e.model.group); enemies.splice(i, 1); }
  }
}

// ---------- 投射物 ----------
function makeFireball(from, dir, dmg){
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffdd66 }));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.55 }));
  g.add(core); g.add(glow);
  g.position.copy(from);
  entScene.add(g);
  projectiles.push({ type: 'fire', owner: 'player', mesh: g, pos: from.clone(), vel: dir.clone().multiplyScalar(26), life: 2.5, grav: 0, dmg, r: 0.5 });
}
function makeMeteor(pos, dmg){
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.45 }));
  g.add(core); g.add(glow);
  g.position.copy(pos);
  entScene.add(g);
  projectiles.push({
    type: 'meteor', owner: 'player', mesh: g, pos: pos.clone(),
    vel: new THREE.Vector3((Math.random() - 0.5) * 3, -27, (Math.random() - 0.5) * 3),
    life: 4, grav: 0, dmg, r: 0.9
  });
}

function explodeFX(pos, breakR, dmgR, dmg, isMeteor){
  explodeTerrain(pos.x, pos.y, pos.z, breakR);
  spawnBurst(pos, { count: isMeteor ? 46 : 30, colors: [0xffcc44, 0xff7711, 0xff3300, 0x555555], speed: isMeteor ? 9 : 7, life: 0.9, size: 0.17, up: 3 });
  spawnBurst(pos, { count: 14, colors: [0x777777, 0x444444], speed: 4, life: 1.2, size: 0.2, grav: 0.4, up: 4 });
  addShake(isMeteor ? 0.55 : 0.35);
  sfx.explode();
  for(const e of enemies){
    if(e.dead) continue;
    const d = enemyCenter(e).distanceTo(pos);
    if(d < dmgR){
      const fall = 1 - 0.55 * (d / dmgR);
      const kd = enemyCenter(e).sub(pos).normalize();
      damageEnemy(e, dmg * fall, { color: '#ffb347', kb: { x: kd.x * 6, y: 4, z: kd.z * 6 }, big: isMeteor });
    }
  }
}

function updateProjectiles(dt){
  for(let i = projectiles.length - 1; i >= 0; i--){
    const p = projectiles[i];
    p.life -= dt;
    if(p.life <= 0){ entScene.remove(p.mesh); projectiles.splice(i, 1); continue; }
    if(p.grav) p.vel.y -= p.grav * dt;
    let hit = false;
    const steps = 3;
    for(let s = 0; s < steps && !hit; s++){
      p.pos.addScaledVector(p.vel, dt / steps);
      if(isSolid(getBlockRay(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)))) hit = true;
      if(!hit && p.owner === 'player'){
        for(const e of enemies){
          if(e.dead) continue;
          if(enemyCenter(e).distanceTo(p.pos) < 0.95 * e.scale + p.r){ hit = true; break; }
        }
      } else if(!hit && p.owner === 'enemy'){
        const pc = new THREE.Vector3(player.pos.x, player.pos.y + 0.95, player.pos.z);
        if(pc.distanceTo(p.pos) < 0.75 + p.r && !player.dead){
          playerTakeDamage(p.dmg, p.pos);
          hit = true;
        }
      }
    }
    p.mesh.position.copy(p.pos);
    if(p.type === 'fire'){
      spawnParticle(p.pos.x, p.pos.y, p.pos.z, (Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5, Math.random() < 0.5 ? 0xff8822 : 0xffcc44, 0.35, 0.1, 0);
    } else if(p.type === 'meteor'){
      spawnParticle(p.pos.x, p.pos.y, p.pos.z, (Math.random()-0.5)*2, 2 + Math.random()*2, (Math.random()-0.5)*2, Math.random() < 0.5 ? 0xff5511 : 0xffaa33, 0.5, 0.16, 0);
    }
    if(hit){
      if(p.type === 'fire') explodeFX(p.pos, 2, 3.4, p.dmg, false);
      else if(p.type === 'meteor') explodeFX(p.pos, 2.5, 4.5, p.dmg, true);
      else spawnBurst(p.pos, { count: 5, colors: [0xbbbbbb], speed: 2, life: 0.4, size: 0.07 });
      entScene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

function initEntities(scene){
  entScene = scene;
  initParticles(scene);
  initDamageNumbers(scene);
}
