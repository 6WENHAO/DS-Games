'use strict';
// ---------- 技能系统 (LoL 风格: Q/E/R + F闪现) ----------
const SKILLS = {
  Q: { name: '烈焰爆裂', cd: 3.5, mana: 25, minLevel: 1 },
  E: { name: '秘术护盾', cd: 12, mana: 40, minLevel: 1 },
  F: { name: '闪现', cd: 18, mana: 20, minLevel: 1 },
  R: { name: '天陨降临', cd: 45, mana: 100, minLevel: 3 },
};
const skillCd = { Q: 0, E: 0, F: 0, R: 0 };
let shieldMesh = null, ringMesh = null;
const meteorQueue = [];
let ringTimer = 0;

function initSkills(scene){
  shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  );
  shieldMesh.visible = false;
  scene.add(shieldMesh);

  ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.2, 40),
    new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.visible = false;
  scene.add(ringMesh);
}

function trySkill(key){
  if(player.dead || gameState !== 'playing') return;
  const s = SKILLS[key];
  if(player.level < s.minLevel){ flashBanner('等级不足！' + s.name + ' 需要 ' + s.minLevel + ' 级', '#ff7766', 1.2); return; }
  if(skillCd[key] > 0) return;
  if(player.mp < s.mana){ flashBanner('法力不足！', '#7fd4ff', 0.9); return; }
  let ok = false;
  if(key === 'Q') ok = castQ();
  else if(key === 'E') ok = castE();
  else if(key === 'F') ok = castF();
  else if(key === 'R') ok = castR();
  if(ok){
    player.mp -= s.mana;
    skillCd[key] = s.cd;
  }
}

function castQ(){
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const from = camera.position.clone().addScaledVector(dir, 0.8);
  makeFireball(from, dir, 42 + player.level * 9);
  sfx.fire();
  swingSword();
  return true;
}

function castE(){
  player.shield = 50 + player.level * 15;
  player.shieldTime = 4;
  shieldMesh.visible = true;
  spawnBurst(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z), { count: 16, colors: [0x66ccff, 0xaee6ff], speed: 3, life: 0.7, size: 0.1, grav: 0, up: 1 });
  sfx.shield();
  return true;
}

function castF(){
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const eye = camera.position.clone();
  const oldPos = player.pos.clone();
  for(let t = 8; t >= 1.19; t -= 0.4){
    const cx = eye.x + dir.x * t;
    const cy = eye.y + dir.y * t;
    const cz = eye.z + dir.z * t;
    const fy0 = cy - 1.62;
    if(cx < 1 || cx > SX - 1 || cz < 1 || cz > SZ - 1) continue;
    const bx = Math.floor(cx), bz = Math.floor(cz);
    for(let dy = 0; dy <= 2; dy++){
      const fy = dy === 0 ? fy0 : Math.floor(fy0) + dy + 0.01;
      if(fy < 1 || fy > SY - 3) continue;
      if(isSolid(getBlock(bx, Math.floor(fy + 0.1), bz))) continue;
      if(isSolid(getBlock(bx, Math.floor(fy + 1.0), bz))) continue;
      if(isSolid(getBlock(bx, Math.floor(fy + 1.7), bz))) continue;
      player.pos.set(cx, fy, cz);
      player.vel.set(0, 0, 0);
      spawnBurst(new THREE.Vector3(oldPos.x, oldPos.y + 1, oldPos.z), { count: 18, colors: [0xffe27a, 0xfff6cc], speed: 3.5, life: 0.55, size: 0.09, grav: 0 });
      spawnBurst(new THREE.Vector3(cx, fy + 1, cz), { count: 18, colors: [0xffe27a, 0xfff6cc], speed: 3.5, life: 0.55, size: 0.09, grav: 0 });
      sfx.flash();
      return true;
    }
  }
  flashBanner('无法闪现到该位置', '#ff7766', 0.9);
  return false;
}

function castR(){
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const hit = raycastVoxel(camera.position, dir, 40);
  let tx, ty, tz;
  if(hit){ tx = hit.x + 0.5; ty = hit.y + 1; tz = hit.z + 0.5; }
  else {
    tx = clamp(camera.position.x + dir.x * 30, 2, SX - 2);
    tz = clamp(camera.position.z + dir.z * 30, 2, SZ - 2);
    ty = surfaceY(tx | 0, tz | 0) + 1;
  }
  ringMesh.position.set(tx, ty + 0.15, tz);
  ringMesh.visible = true;
  ringTimer = 1.0;
  const dmg = 80 + player.level * 12;
  for(let i = 0; i < 6; i++){
    meteorQueue.push({
      t: 0.9 + i * 0.22,
      x: tx + (Math.random() - 0.5) * 5,
      y: ty + 22,
      z: tz + (Math.random() - 0.5) * 5,
      dmg
    });
  }
  sfx.meteorCast();
  flashBanner('☄️ 天陨降临！', '#ff9944', 1.2);
  return true;
}

function updateSkills(dt){
  for(const k in skillCd){ if(skillCd[k] > 0) skillCd[k] = Math.max(0, skillCd[k] - dt); }

  if(player.shieldTime > 0){
    player.shieldTime -= dt;
    shieldMesh.position.set(player.pos.x, player.pos.y + 0.95, player.pos.z);
    shieldMesh.material.opacity = 0.16 + Math.sin(performance.now() * 0.008) * 0.07;
    if(player.shieldTime <= 0 || player.shield <= 0){
      player.shield = 0; player.shieldTime = 0;
      shieldMesh.visible = false;
    }
  }

  if(ringTimer > 0){
    ringTimer -= dt;
    ringMesh.material.opacity = 0.4 + Math.sin(performance.now() * 0.02) * 0.3;
    if(ringTimer <= 0) ringMesh.visible = false;
  }

  for(let i = meteorQueue.length - 1; i >= 0; i--){
    const m = meteorQueue[i];
    m.t -= dt;
    if(m.t <= 0){
      makeMeteor(new THREE.Vector3(m.x, m.y, m.z), m.dmg);
      sfx.meteorFall();
      meteorQueue.splice(i, 1);
    }
  }
}
