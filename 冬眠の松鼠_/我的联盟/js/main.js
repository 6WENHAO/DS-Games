'use strict';
// ---------- 主逻辑：渲染 / 玩家 / 输入 / 波次 / HUD / 音效 ----------

// ===== 音效 (WebAudio 程序合成) =====
let AC = null;
function ac(){
  if(!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if(AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(freq, dur, type, vol, slideTo, delay){
  try{
    const ctx = ac();
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }catch(err){}
}
function noiseSfx(dur, vol, filterFreq){
  try{
    const ctx = ac();
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t0);
  }catch(err){}
}
const sfx = {
  break: () => noiseSfx(0.09, 0.18, 900),
  place: () => tone(220, 0.07, 'square', 0.14),
  swing: () => tone(320, 0.08, 'triangle', 0.1, 140),
  hit: () => { tone(160, 0.08, 'square', 0.22); noiseSfx(0.05, 0.1, 2000); },
  crit: () => { tone(220, 0.1, 'square', 0.25, 330); noiseSfx(0.08, 0.15, 3000); },
  hurt: () => tone(110, 0.22, 'sawtooth', 0.28, 55),
  fire: () => tone(280, 0.3, 'sawtooth', 0.18, 900),
  explode: () => { noiseSfx(0.5, 0.35, 420); tone(65, 0.4, 'sine', 0.35, 28); },
  flash: () => tone(480, 0.16, 'sine', 0.22, 1400),
  shield: () => { tone(380, 0.25, 'sine', 0.18, 520); tone(560, 0.3, 'sine', 0.1, 700, 0.08); },
  arrow: () => tone(700, 0.08, 'triangle', 0.08, 300),
  kill: () => { tone(392, 0.1, 'square', 0.12); tone(523, 0.14, 'square', 0.12, null, 0.08); },
  levelup: () => { tone(440, 0.13, 'square', 0.16); tone(554, 0.13, 'square', 0.16, null, 0.11); tone(659, 0.22, 'square', 0.18, null, 0.22); },
  meteorCast: () => tone(90, 0.7, 'sawtooth', 0.22, 40),
  meteorFall: () => tone(600, 0.4, 'sawtooth', 0.1, 100),
  wave: () => { tone(330, 0.15, 'square', 0.14); tone(262, 0.2, 'square', 0.14, null, 0.14); },
};

// ===== 场景 =====
let scene, camera, renderer;
let sunLight, ambLight, hemiLight;
let gameState = 'menu'; // menu | playing | paused | dead
let yaw = 0, pitch = -0.15;
let shakeAmt = 0;
const clouds = [];

const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  w: 0.3, h: 1.8,
  hp: 100, maxHp: 100, mp: 100, maxMp: 100,
  level: 1, xp: 0, ad: 27,
  shield: 0, shieldTime: 0,
  dead: false, invuln: 0, lastHurt: -99,
  kills: 0, onGround: false, inWater: false,
};
function xpNeed(lv){ return 60 + (lv - 1) * 55; }

// ===== 波次 =====
let wave = 0, waveState = 'rest', waveTimer = 4, gameTime = 0;

// ===== 物品栏 =====
const PLACEABLE = [B.GRASS, B.DIRT, B.STONE, B.LOG, B.LEAF, B.SAND, B.PLANK, B.COBBLE, B.GOLD];
const inventory = {};
for(const id of PLACEABLE) inventory[id] = 0;
inventory[B.PLANK] = 64;
inventory[B.COBBLE] = 64;
let selectedSlot = 6; // 默认木板

// ===== 剑视角模型 =====
let swordGroup = null, swordAnim = 0;
function makeSword(){
  swordGroup = new THREE.Group();
  const mats = {
    blade: new THREE.MeshLambertMaterial({ color: 0xdfe8f0 }),
    edge: new THREE.MeshLambertMaterial({ color: 0xb8c4d0 }),
    guard: new THREE.MeshLambertMaterial({ color: 0x8a6d31 }),
    grip: new THREE.MeshLambertMaterial({ color: 0x5a3d1e }),
  };
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.55), mats.blade);
  blade.position.z = -0.42;
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.1), mats.edge);
  tip.position.z = -0.73;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), mats.guard);
  guard.position.z = -0.14;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), mats.grip);
  grip.position.z = -0.04;
  swordGroup.add(blade, tip, guard, grip);
  swordGroup.position.set(0.42, -0.34, -0.55);
  swordGroup.rotation.set(0.15, -0.25, 0.1);
  camera.add(swordGroup);
}
function swingSword(){ swordAnim = 1; }
function updateSword(dt){
  if(swordAnim > 0){
    swordAnim = Math.max(0, swordAnim - dt * 4.5);
    const t = 1 - swordAnim;
    const s = Math.sin(t * Math.PI);
    swordGroup.rotation.x = 0.15 - s * 1.1;
    swordGroup.rotation.z = 0.1 + s * 0.4;
    swordGroup.position.z = -0.55 - s * 0.15;
  } else {
    const bob = Math.sin(performance.now() * 0.004) * 0.008;
    swordGroup.rotation.x = 0.15;
    swordGroup.rotation.z = 0.1;
    swordGroup.position.z = -0.55;
    swordGroup.position.y = -0.34 + bob;
  }
}

// ===== HUD 引用 =====
const $ = id => document.getElementById(id);
let hudRefs = {};
function collectHud(){
  hudRefs = {
    hud: $('hud'), crosshair: $('crosshair'), badge: $('level-badge'),
    hpfill: $('hpfill'), hptext: $('hptext'), mpfill: $('mpfill'), mptext: $('mptext'),
    xpfill: $('xpfill'), stats: $('stats'),
    waveinfo: $('waveinfo'), killinfo: $('killinfo'), timeinfo: $('timeinfo'),
    banner: $('banner'), subbanner: $('subbanner'),
    vignette: $('vignette'), watertint: $('watertint'), shieldind: $('shieldind'),
    hotbar: $('hotbar'),
    menu: $('menu'), pause: $('pause'), death: $('death'), dstats: $('dstats'),
  };
}
let vignetteT = 0;
let bannerT = 0;
function flashBanner(text, color, dur){
  hudRefs.banner.textContent = text;
  hudRefs.banner.style.color = color || '#f0e6d2';
  hudRefs.banner.style.opacity = 1;
  bannerT = dur || 1.6;
}
let subBannerT = 0;
function flashSubBanner(text, dur){
  hudRefs.subbanner.textContent = text;
  hudRefs.subbanner.style.opacity = 1;
  subBannerT = dur || 2;
}

// ===== 物品栏 UI =====
const slotEls = [];
function buildHotbar(){
  hudRefs.hotbar.innerHTML = '';
  slotEls.length = 0;
  PLACEABLE.forEach((id, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 32;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const tile = faceTile(id, id === B.GRASS ? 3 : 0);
    const sx = (tile % ATLAS_COLS) * TILE_PX, sy = ((tile / ATLAS_COLS) | 0) * TILE_PX;
    ctx.drawImage(atlasCanvas, sx, sy, TILE_PX, TILE_PX, 0, 0, 32, 32);
    const num = document.createElement('div');
    num.className = 'num'; num.textContent = '';
    const cnt = document.createElement('div');
    cnt.className = 'cnt';
    slot.appendChild(cv); slot.appendChild(num); slot.appendChild(cnt);
    slot.title = BLOCK_NAME[id];
    hudRefs.hotbar.appendChild(slot);
    slotEls.push({ el: slot, cnt });
  });
  updateHotbar();
}
function updateHotbar(){
  PLACEABLE.forEach((id, i) => {
    const s = slotEls[i];
    const c = inventory[id];
    s.cnt.textContent = c > 0 ? c : '';
    s.el.classList.toggle('sel', i === selectedSlot);
    s.el.classList.toggle('empty', c <= 0);
  });
}

// ===== 玩家伤害 / 死亡 / 升级 =====
function addShake(a){ shakeAmt = Math.min(0.8, shakeAmt + a); }

function playerTakeDamage(dmg, srcPos){
  if(player.dead || player.invuln > 0) return;
  dmg = Math.round(dmg);
  if(player.shield > 0){
    const abs = Math.min(player.shield, dmg);
    player.shield -= abs;
    dmg -= abs;
    spawnBurst(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z), { count: 8, colors: [0x66ccff], speed: 3, life: 0.4, size: 0.08, grav: 0 });
    if(dmg <= 0){ tone(500, 0.08, 'sine', 0.15); return; }
  }
  player.hp -= dmg;
  player.lastHurt = gameTime;
  vignetteT = 0.6;
  addShake(0.3);
  sfx.hurt();
  if(srcPos){
    const kd = new THREE.Vector3(player.pos.x - srcPos.x, 0, player.pos.z - srcPos.z);
    if(kd.lengthSq() > 0.01){ kd.normalize(); player.vel.x += kd.x * 4; player.vel.z += kd.z * 4; }
  }
  if(player.hp <= 0){ player.hp = 0; playerDie(); }
}
function playerDie(){
  player.dead = true;
  gameState = 'dead';
  document.exitPointerLock && document.exitPointerLock();
  const mins = Math.floor(gameTime / 60), secs = Math.floor(gameTime % 60);
  hudRefs.dstats.innerHTML =
    '等级 <b>' + player.level + '</b> &nbsp;·&nbsp; 击杀 <b>' + player.kills + '</b><br>' +
    '坚持到第 <b>' + wave + '</b> 波 &nbsp;·&nbsp; 存活 <b>' + mins + '分' + secs + '秒</b>';
  hudRefs.death.classList.remove('hidden');
  tone(220, 0.6, 'sawtooth', 0.25, 55);
}
function respawn(){
  player.dead = false;
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  player.invuln = 3;
  player.vel.set(0, 0, 0);
  placePlayerAtSpawn();
  hudRefs.death.classList.add('hidden');
  gameState = 'playing';
  requestLock();
}
function onEnemyKilled(e){
  player.kills++;
  player.hp = Math.min(player.maxHp, player.hp + 8);
  player.mp = Math.min(player.maxMp, player.mp + 15);
  gainXp(e.xp);
}
function gainXp(amt){
  if(player.level >= 18) return;
  player.xp += amt;
  while(player.level < 18 && player.xp >= xpNeed(player.level)){
    player.xp -= xpNeed(player.level);
    player.level++;
    player.maxHp += 16;
    player.maxMp += 10;
    player.ad = 22 + player.level * 5;
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.4);
    player.mp = player.maxMp;
    spawnBurst(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z), { count: 30, colors: [0xffd700, 0xfff2b0], speed: 4.5, life: 0.9, size: 0.11, grav: 0.2, up: 3 });
    sfx.levelup();
    flashBanner('⬆ 升级！Lv ' + player.level, '#ffd700', 1.6);
    if(player.level === 3) flashSubBanner('☄️ 终极技能 4 [天陨降临] 已解锁！', 3);
  }
}

// ===== 攻击 / 挖掘 / 放置 =====
const _camDir = new THREE.Vector3();
function pickEnemy(maxDist, radius){
  camera.getWorldDirection(_camDir);
  const o = camera.position;
  let best = null, bestD = maxDist;
  for(const e of enemies){
    if(e.dead) continue;
    const c = enemyCenter(e).sub(o);
    const proj = c.dot(_camDir);
    if(proj < 0 || proj > bestD) continue;
    const perpSq = c.lengthSq() - proj * proj;
    const r = radius * e.scale;
    if(perpSq < r * r){ best = e; bestD = proj; }
  }
  if(best){
    const hit = raycastVoxel(o, _camDir, bestD - 0.1);
    if(hit) return null;
  }
  return best;
}
let breakCd = 0, meleeCd = 0;
function doAttack(){
  const e = pickEnemy(3.8, 1.0);
  if(e && meleeCd <= 0){
    meleeCd = 0.42;
    swingSword();
    const crit = Math.random() < 0.2;
    const dmg = player.ad * (crit ? 1.75 : 1);
    camera.getWorldDirection(_camDir);
    damageEnemy(e, dmg, {
      color: crit ? '#ffd700' : '#ffffff', big: crit,
      kb: { x: _camDir.x * 4.5, y: 2.5, z: _camDir.z * 4.5 }
    });
    crit ? sfx.crit() : sfx.hit();
    return;
  }
  if(breakCd > 0) return;
  camera.getWorldDirection(_camDir);
  const hit = raycastVoxel(camera.position, _camDir, 5);
  if(!hit) { if(meleeCd <= 0){ swingSword(); sfx.swing(); meleeCd = 0.3; } return; }
  breakCd = 0.24;
  swingSword();
  const b = hit.block;
  if(b === B.BEDROCK){ sfx.hit(); return; }
  setBlock(hit.x, hit.y, hit.z, B.AIR);
  const dropId = b === B.GRASS ? B.DIRT : b;
  if(inventory[dropId] !== undefined) inventory[dropId]++;
  updateHotbar();
  spawnBurst(new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5), { count: 10, colors: [BLOCK_COLOR[b] || 0x888888], speed: 3, life: 0.55, size: 0.1 });
  sfx.break();
}
function doPlace(){
  const id = PLACEABLE[selectedSlot];
  if(inventory[id] <= 0) return;
  camera.getWorldDirection(_camDir);
  const hit = raycastVoxel(camera.position, _camDir, 5);
  if(!hit) return;
  const x = hit.px, y = hit.py, z = hit.pz;
  if(y < 1 || y >= SY) return;
  if(isSolid(getBlock(x, y, z))) return;
  const px = player.pos;
  if(x + 1 > px.x - player.w && x < px.x + player.w &&
     y + 1 > px.y && y < px.y + player.h &&
     z + 1 > px.z - player.w && z < px.z + player.w) return;
  for(const e of enemies){
    if(e.dead) continue;
    if(x + 1 > e.pos.x - e.w && x < e.pos.x + e.w &&
       y + 1 > e.pos.y && y < e.pos.y + e.h &&
       z + 1 > e.pos.z - e.w && z < e.pos.z + e.w) return;
  }
  setBlock(x, y, z, id);
  inventory[id]--;
  updateHotbar();
  sfx.place();
}

// ===== 输入 =====
const keys = {};
let lmbDown = false, rmbDown = false, placeCd = 0;
function requestLock(){
  const el = renderer.domElement;
  try{
    const p = el.requestPointerLock && el.requestPointerLock();
    if(p && p.catch) p.catch(() => {});
  }catch(err){}
}
function isLocked(){ return document.pointerLockElement === renderer.domElement; }

function setupInput(){
  document.addEventListener('keydown', ev => {
    keys[ev.code] = true;
    if(gameState !== 'playing') return;
    if(ev.code === 'Digit1') trySkill('Q');
    else if(ev.code === 'Digit2') trySkill('E');
    else if(ev.code === 'Digit3') trySkill('F');
    else if(ev.code === 'Digit4') trySkill('R');
  });
  document.addEventListener('keyup', ev => { keys[ev.code] = false; });
  document.addEventListener('mousemove', ev => {
    if(!isLocked() || gameState !== 'playing') return;
    yaw -= ev.movementX * 0.0022;
    pitch -= ev.movementY * 0.0022;
    pitch = clamp(pitch, -1.55, 1.55);
  });
  document.addEventListener('mousedown', ev => {
    if(gameState !== 'playing' || !isLocked()) return;
    if(ev.button === 0){ lmbDown = true; doAttack(); }
    else if(ev.button === 2){ rmbDown = true; doPlace(); placeCd = 0.25; }
  });
  document.addEventListener('mouseup', ev => {
    if(ev.button === 0) lmbDown = false;
    else if(ev.button === 2) rmbDown = false;
  });
  document.addEventListener('contextmenu', ev => ev.preventDefault());
  document.addEventListener('wheel', ev => {
    if(gameState !== 'playing') return;
    selectedSlot = (selectedSlot + (ev.deltaY > 0 ? 1 : -1) + PLACEABLE.length) % PLACEABLE.length;
    updateHotbar();
  });
  document.addEventListener('pointerlockchange', () => {
    if(!isLocked() && gameState === 'playing'){
      gameState = 'paused';
      hudRefs.pause.classList.remove('hidden');
    }
  });
  $('btn-start').addEventListener('click', () => {
    ac();
    hudRefs.menu.classList.add('hidden');
    hudRefs.hud.classList.remove('hidden');
    gameState = 'playing';
    requestLock();
  });
  $('btn-resume').addEventListener('click', () => {
    hudRefs.pause.classList.add('hidden');
    gameState = 'playing';
    requestLock();
  });
  $('btn-respawn').addEventListener('click', respawn);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ===== 玩家移动 =====
function updatePlayer(dt){
  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = player.inWater ? 3 : (sprint ? 7 : 4.6);
  let f = 0, s = 0;
  if(keys['KeyW']) f += 1;
  if(keys['KeyS']) f -= 1;
  if(keys['KeyD']) s += 1;
  if(keys['KeyA']) s -= 1;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  let wx = (-sin * f + cos * s), wz = (-cos * f - sin * s);
  const wl = Math.hypot(wx, wz);
  if(wl > 0){ wx /= wl; wz /= wl; }
  const accel = player.onGround ? 12 : 6;
  const k = Math.min(1, accel * dt);
  player.vel.x += (wx * speed - player.vel.x) * k;
  player.vel.z += (wz * speed - player.vel.z) * k;
  if(keys['Space']){
    if(player.onGround) player.vel.y = 8.2;
    else if(player.inWater) player.vel.y = Math.min(player.vel.y + 24 * dt, 4);
  }
  moveEntity(player, dt);
  if(player.pos.y < -12 && !player.dead){
    playerTakeDamage(9999, null);
  }
  if(player.invuln > 0) player.invuln -= dt;
  // 回复
  if(gameTime - player.lastHurt > 4 && player.hp < player.maxHp){
    player.hp = Math.min(player.maxHp, player.hp + (2 + player.level * 0.4) * dt);
  }
  player.mp = Math.min(player.maxMp, player.mp + (5 + player.level * 0.5) * dt);
}

// ===== 波次管理 =====
function trySpawnPos(){
  for(let i = 0; i < 12; i++){
    const a = Math.random() * Math.PI * 2;
    const d = randRange(18, 28);
    const x = clamp(Math.round(player.pos.x + Math.cos(a) * d), 2, SX - 3);
    const z = clamp(Math.round(player.pos.z + Math.sin(a) * d), 2, SZ - 3);
    const y = surfaceY(x, z);
    if(y > WATER_Y) return { x: x + 0.5, z: z + 0.5 };
  }
  return null;
}
function startWave(){
  wave++;
  waveState = 'fighting';
  const zombies = 3 + wave;
  const skeletons = Math.floor(wave * 0.6);
  const boss = wave % 5 === 0 ? 1 : 0;
  let spawned = 0;
  for(let i = 0; i < zombies && enemies.length < 42; i++){
    const p = trySpawnPos();
    if(p){ spawnEnemy('zombie', wave, p.x, p.z); spawned++; }
  }
  for(let i = 0; i < skeletons && enemies.length < 42; i++){
    const p = trySpawnPos();
    if(p){ spawnEnemy('skeleton', wave, p.x, p.z); spawned++; }
  }
  if(boss){
    const p = trySpawnPos();
    if(p){ spawnEnemy('boss', wave, p.x, p.z); spawned++; }
  }
  sfx.wave();
  flashBanner('⚔️ 第 ' + wave + ' 波来袭！', boss ? '#ff5544' : '#f0e6d2', 2);
  if(boss) flashSubBanner('💀 BOSS 出现了！小心它的震地猛击！', 3);
}
function updateWaves(dt){
  if(waveState === 'rest'){
    waveTimer -= dt;
    if(waveTimer <= 0) startWave();
  } else if(enemies.length === 0){
    waveState = 'rest';
    waveTimer = 8;
    player.hp = Math.min(player.maxHp, player.hp + 20);
    player.mp = Math.min(player.maxMp, player.mp + 30);
    gainXp(15 + wave * 5);
    flashBanner('✅ 第 ' + wave + ' 波清空！', '#7fe57f', 1.6);
    flashSubBanner('+回复奖励 · 8 秒后下一波', 2.4);
  }
}

// ===== HUD 更新 =====
function fmtCd(v){ return v >= 9.95 ? Math.round(v) : v.toFixed(1); }
function updateHUD(){
  hudRefs.hpfill.style.width = (player.hp / player.maxHp * 100) + '%';
  hudRefs.mpfill.style.width = (player.mp / player.maxMp * 100) + '%';
  hudRefs.hptext.textContent = Math.ceil(player.hp) + ' / ' + player.maxHp + (player.shield > 0 ? '  (+' + Math.ceil(player.shield) + ')' : '');
  hudRefs.mptext.textContent = Math.floor(player.mp) + ' / ' + player.maxMp;
  hudRefs.xpfill.style.width = (player.level >= 18 ? 100 : player.xp / xpNeed(player.level) * 100) + '%';
  hudRefs.badge.textContent = player.level;
  hudRefs.stats.textContent = '攻击力 ' + player.ad + ' · 火球 ' + (42 + player.level * 9);
  hudRefs.killinfo.textContent = '⚔️ 击杀 ' + player.kills;
  if(waveState === 'rest'){
    hudRefs.waveinfo.textContent = wave === 0 ? ('首波倒计时 ' + Math.ceil(waveTimer) + 's') : ('下一波 ' + Math.ceil(waveTimer) + 's');
  } else {
    hudRefs.waveinfo.textContent = '第 ' + wave + ' 波 · 剩余 ' + enemies.length;
  }
  for(const key of ['Q', 'E', 'F', 'R']){
    const el = $('sk-' + key);
    const s = SKILLS[key];
    const cd = skillCd[key];
    const mask = el.querySelector('.cdmask');
    const txt = el.querySelector('.cdtext');
    const lock = el.querySelector('.lock');
    const locked = player.level < s.minLevel;
    el.classList.toggle('locked', locked);
    if(lock) lock.classList.toggle('hidden', !locked);
    if(cd > 0){
      mask.style.height = (cd / s.cd * 100) + '%';
      txt.textContent = fmtCd(cd);
      el.classList.remove('ready');
    } else {
      mask.style.height = '0%';
      txt.textContent = '';
      el.classList.toggle('ready', !locked && player.mp >= s.mana);
    }
    el.classList.toggle('nomana', !locked && cd <= 0 && player.mp < s.mana);
  }
  const target = pickEnemy(28, 1.1);
  hudRefs.crosshair.classList.toggle('enemy', !!target);
  if(player.shield > 0){
    hudRefs.shieldind.classList.remove('hidden');
    hudRefs.shieldind.textContent = '🛡️ ' + Math.ceil(player.shield);
  } else hudRefs.shieldind.classList.add('hidden');
  if(vignetteT > 0){
    vignetteT -= 0.016;
    hudRefs.vignette.style.opacity = clamp(vignetteT / 0.6, 0, 1);
  }
  if(bannerT > 0){
    bannerT -= 0.016;
    if(bannerT <= 0) hudRefs.banner.style.opacity = 0;
  }
  if(subBannerT > 0){
    subBannerT -= 0.016;
    if(subBannerT <= 0) hudRefs.subbanner.style.opacity = 0;
  }
  const headBlock = getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 1.62), Math.floor(player.pos.z));
  hudRefs.watertint.style.opacity = headBlock === B.WATER ? 1 : 0;
}

// ===== 日夜循环 =====
const DAY_LEN = 240;
let dayTime = DAY_LEN * 0.2;
const skyDay = new THREE.Color(0x87ceeb), skyNight = new THREE.Color(0x0a0e26);
const skyCur = new THREE.Color();
function updateDayNight(dt){
  dayTime = (dayTime + dt) % DAY_LEN;
  const ang = dayTime / DAY_LEN * Math.PI * 2;
  const sunH = Math.sin(ang); // >0 白天
  const dayF = clamp(sunH * 2 + 0.5, 0, 1);
  skyCur.copy(skyNight).lerp(skyDay, dayF);
  scene.background = skyCur;
  scene.fog.color.copy(skyCur);
  sunLight.intensity = lerp(0.12, 0.85, dayF);
  hemiLight.intensity = lerp(0.25, 0.6, dayF);
  ambLight.intensity = lerp(0.28, 0.45, dayF);
  sunLight.position.set(Math.cos(ang) * 80, Math.abs(sunH) * 100 + 10, 40);
  hudRefs.timeinfo.textContent = dayF > 0.4 ? '☀️ 白天' : '🌙 夜晚';
}
function makeClouds(){
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  for(let i = 0; i < 16; i++){
    const m = new THREE.Mesh(new THREE.BoxGeometry(randRange(6, 14), 1, randRange(4, 9)), mat);
    m.position.set(Math.random() * SX, randRange(42, 47), Math.random() * SZ);
    scene.add(m);
    clouds.push(m);
  }
}
function updateClouds(dt){
  for(const c of clouds){
    c.position.x += dt * 1.2;
    if(c.position.x > SX + 10) c.position.x = -10;
  }
}

// ===== 初始化 =====
function placePlayerAtSpawn(){
  let bx = SX >> 1, bz = SZ >> 1;
  for(let r = 0; r < 40; r++){
    const x = clamp(bx + ((Math.random() - 0.5) * r * 2) | 0, 2, SX - 3);
    const z = clamp(bz + ((Math.random() - 0.5) * r * 2) | 0, 2, SZ - 3);
    const y = surfaceY(x, z);
    if(y > WATER_Y){ player.pos.set(x + 0.5, y + 1.2, z + 0.5); return; }
  }
  player.pos.set(bx, SY - 5, bz);
}

function init(){
  collectHud();
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x87ceeb, 40, 110);
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
  scene.add(camera);
  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  $('game').appendChild(renderer.domElement);

  ambLight = new THREE.AmbientLight(0xffffff, 0.4);
  hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x77664a, 0.5);
  sunLight = new THREE.DirectionalLight(0xfff4d6, 0.8);
  sunLight.position.set(60, 90, 40);
  scene.add(ambLight, hemiLight, sunLight);

  generateWorld();
  initWorldMeshes(scene);
  initEntities(scene);
  initSkills(scene);
  makeClouds();
  makeSword();
  placePlayerAtSpawn();
  buildHotbar();
  setupInput();

  const clockNow = { t: performance.now() };
  function animate(){
    requestAnimationFrame(animate);
    const now = performance.now();
    let dt = (now - clockNow.t) / 1000;
    clockNow.t = now;
    dt = Math.min(dt, 0.05);

    if(gameState === 'playing'){
      gameTime += dt;
      breakCd -= dt; meleeCd -= dt; placeCd -= dt;
      if(lmbDown && breakCd <= 0 && meleeCd <= 0) doAttack();
      if(rmbDown && placeCd <= 0){ doPlace(); placeCd = 0.22; }
      updatePlayer(dt);
      updateSkills(dt);
      updateProjectiles(dt);
      updateEnemies(dt);
      updateWaves(dt);
      updateHUD();
    }
    updateParticles(dt);
    updateDamageNumbers(dt);
    updateDayNight(gameState === 'playing' ? dt : 0);
    updateClouds(dt);
    updateSword(dt);

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.position.set(player.pos.x, player.pos.y + 1.62, player.pos.z);
    if(shakeAmt > 0.001){
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
      camera.position.z += (Math.random() - 0.5) * shakeAmt;
      shakeAmt *= Math.pow(0.02, dt);
    }
    processDirtyChunks();
    renderer.render(scene, camera);
  }
  animate();
}
init();
