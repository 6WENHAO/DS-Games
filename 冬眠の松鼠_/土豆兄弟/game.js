// ===================== 游戏主逻辑 =====================
"use strict";

const WORLD = { w: 1600, h: 1000 };
let canvas, ctx, viewScale = 1, viewOx = 0, viewOy = 0;
let keys = {};
let game = null;
let state = "menu"; // menu / charSelect / weaponSelect / playing / paused / interlude / gameover / win
let lastTime = 0;
let soundOn = true;

// -------------------- 音效 --------------------
let actx = null;
const sndGate = {};
function beep(freq, dur, type = "square", vol = 0.05, slide = 0) {
  if (!soundOn) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, actx.currentTime + dur);
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch (e) {}
}
function sfx(name) {
  const now = performance.now();
  if (sndGate[name] && now - sndGate[name] < 45) return;
  sndGate[name] = now;
  switch (name) {
    case "hit":    beep(220, 0.05, "square", 0.03); break;
    case "shoot":  beep(700, 0.04, "triangle", 0.02, -200); break;
    case "pickup": beep(880, 0.06, "sine", 0.04, 200); break;
    case "hurt":   beep(120, 0.18, "sawtooth", 0.07, -40); break;
    case "kill":   beep(330, 0.08, "square", 0.035, -80); break;
    case "level":  beep(523, 0.12, "sine", 0.06, 200); break;
    case "buy":    beep(660, 0.1, "sine", 0.05, 120); break;
    case "crate":  beep(440, 0.15, "sine", 0.05, 220); break;
    case "wave":   beep(392, 0.25, "sine", 0.06, 130); break;
    case "die":    beep(200, 0.6, "sawtooth", 0.08, -150); break;
  }
}

// -------------------- 初始化 --------------------
window.addEventListener("load", () => {
  canvas = document.getElementById("game");
  ctx = canvas.getContext("2d");
  window.addEventListener("resize", resize);
  resize();
  document.addEventListener("keydown", e => {
    keys[e.code] = true;
    if (e.code === "Escape" || e.code === "KeyP") togglePause();
    if (e.code === "KeyM") { soundOn = !soundOn; UI.toast(soundOn ? "🔊 音效开" : "🔇 音效关"); }
    if (e.code === "Tab") { e.preventDefault(); UI.toggleStats(); }
  });
  document.addEventListener("keyup", e => keys[e.code] = false);
  UI.init();
  requestAnimationFrame(loop);
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  viewScale = Math.min(canvas.width / WORLD.w, canvas.height / WORLD.h);
  viewOx = (canvas.width - WORLD.w * viewScale) / 2;
  viewOy = (canvas.height - WORLD.h * viewScale) / 2;
}

function togglePause() {
  if (state === "playing") { state = "paused"; UI.showPause(); }
  else if (state === "paused") { state = "playing"; UI.hidePause(); }
}

// -------------------- 游戏创建 --------------------
function startGame(charDef, weaponDef) {
  game = {
    wave: 0, timer: 0, spawnT: 1.2, running: false,
    enemies: [], bullets: [], ebullets: [], mats: [], warns: [], dnums: [], parts: [],
    crates: 0, levelQueue: 0, rerolls: 0, shopOffers: [],
    kills: 0, totalMats: 0, bossAlive: false,
    player: {
      x: WORLD.w / 2, y: WORLD.h / 2, hp: 10, level: 1, xp: 0, materials: 25,
      weapons: [], itemList: [], upgrades: {}, char: charDef,
      regenT: 0, hurtT: 0, face: 1, stats: null,
    }
  };
  addWeapon(weaponDef, 1);
  computeStats();
  game.player.hp = game.player.stats.maxHp;
  startWave(1);
}

function addWeapon(def, tier) {
  if (game.player.weapons.length >= 6) return false;
  game.player.weapons.push({ def, tier, cd: Math.random() * 0.4, angle: 0, atk: null });
  layoutWeapons();
  return true;
}
function layoutWeapons() {
  const n = game.player.weapons.length;
  game.player.weapons.forEach((w, i) => w.slot = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2);
}

function computeStats() {
  const p = game.player;
  const s = { maxHp: 10, hpRegen: 0, lifeSteal: 0, damagePct: 0, meleeDamage: 0, rangedDamage: 0,
    elementalDamage: 0, attackSpeed: 0, critChance: 0, engineering: 0, range: 0, armor: 0,
    dodge: 0, speed: 0, luck: 0, harvesting: 0, pickupRange: 60 };
  const add = o => { for (const k in o) if (k in s) s[k] += o[k]; };
  add(p.char.stats);
  p.itemList.forEach(it => add(it.stats));
  add(p.upgrades);
  s.maxHp = Math.max(1, s.maxHp);
  const oldMax = p.stats ? p.stats.maxHp : s.maxHp;
  p.stats = s;
  if (s.maxHp > oldMax) p.hp += s.maxHp - oldMax;
  p.hp = Math.min(p.hp, s.maxHp);
}

function addUpgrade(stat, v) {
  const u = game.player.upgrades;
  u[stat] = (u[stat] || 0) + v;
  computeStats();
}
function addItem(def) {
  game.player.itemList.push(def);
  computeStats();
}

// -------------------- 波次 --------------------
function startWave(n) {
  const g = game;
  g.wave = n;
  g.timer = waveDuration(n);
  g.enemies = []; g.bullets = []; g.ebullets = []; g.mats = []; g.warns = []; g.dnums = []; g.parts = [];
  g.spawnT = 1.0; g.crates = 0; g.rerolls = 0; g.bossAlive = false;
  g.player.x = WORLD.w / 2; g.player.y = WORLD.h / 2;
  if (n === 10) spawnWarn("boss1", WORLD.w / 2, WORLD.h / 4);
  if (n === 20) spawnWarn("boss2", WORLD.w / 2, WORLD.h / 4);
  state = "playing";
  UI.hideAll();
  UI.waveBanner(n);
  sfx("wave");
}

function endWave() {
  const g = game, p = g.player;
  // 吸收场上所有材料
  let ground = 0;
  g.mats.forEach(m => ground += m.v);
  g.enemies = []; g.bullets = []; g.ebullets = []; g.warns = []; g.mats = [];
  gainMaterials(ground);
  // 收获属性结算
  const harvest = Math.max(0, Math.floor(p.stats.harvesting * (1 + 0.05 * g.wave)));
  if (harvest > 0) gainMaterials(harvest);
  state = "interlude";
  UI.startInterlude(harvest);
}

function gainMaterials(n) {
  const p = game.player;
  p.materials += n; game.totalMats += n;
  p.xp += n;
  while (p.xp >= xpNeeded(p.level)) {
    p.xp -= xpNeeded(p.level);
    p.level++; game.levelQueue++;
    sfx("level");
    dnum(p.x, p.y - 40, "升级!", "#ffd75a", 1.2);
  }
}

// -------------------- 生成敌人 --------------------
function spawnWarn(type, x, y) {
  x = Math.max(40, Math.min(WORLD.w - 40, x));
  y = Math.max(40, Math.min(WORLD.h - 40, y));
  game.warns.push({ type, x, y, t: 0.9 });
}

function spawnEnemy(type, x, y) {
  const def = ENEMY_TYPES[type];
  const w = game.wave;
  const e = {
    def, type, x, y,
    hp: Math.round(def.hp * enemyHpMul(w)),
    maxHp: Math.round(def.hp * enemyHpMul(w)),
    dmg: Math.max(1, Math.round(def.dmg * enemyDmgMul(w))),
    r: def.r, speed: def.speed * (1 + Math.random() * 0.12),
    hitT: 0, flash: 0, kvx: 0, kvy: 0, burn: null,
    st: "chase", stT: 0, shootT: 1 + Math.random() * (def.shootCd || 2),
    spawnT: def.spawnCd || 0, dashX: 0, dashY: 0, wob: Math.random() * 6.28,
  };
  if (def.boss) game.bossAlive = true;
  game.enemies.push(e);
}

function pickSpawnType() {
  const pool = waveEnemyPool(game.wave);
  let tot = 0; pool.forEach(p => tot += p[1]);
  let r = Math.random() * tot;
  for (const [t, w] of pool) { r -= w; if (r <= 0) return t; }
  return "chaser";
}

function updateSpawning(dt) {
  const g = game;
  // 警告 → 实际生成
  for (let i = g.warns.length - 1; i >= 0; i--) {
    const w = g.warns[i];
    w.t -= dt;
    if (w.t <= 0) { spawnEnemy(w.type, w.x, w.y); g.warns.splice(i, 1); }
  }
  if (g.timer < 2) return; // 收尾阶段不再生成
  g.spawnT -= dt;
  if (g.spawnT <= 0 && g.enemies.length + g.warns.length < 70) {
    g.spawnT = waveSpawnInterval(g.wave) * (0.8 + Math.random() * 0.4);
    const n = waveGroupSize(g.wave);
    const cx = Math.random() * WORLD.w, cy = Math.random() * WORLD.h;
    for (let i = 0; i < n; i++) {
      // 避免刷在玩家脸上
      let x = cx + (Math.random() - 0.5) * 160, y = cy + (Math.random() - 0.5) * 160;
      const dx = x - g.player.x, dy = y - g.player.y;
      if (dx * dx + dy * dy < 220 * 220) { x = WORLD.w - x; y = WORLD.h - y; }
      spawnWarn(pickSpawnType(), x, y);
    }
  }
}

// -------------------- 玩家 --------------------
function updatePlayer(dt) {
  const p = game.player, s = p.stats;
  let dx = 0, dy = 0;
  if (keys["KeyW"] || keys["ArrowUp"]) dy -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) dy += 1;
  if (keys["KeyA"] || keys["ArrowLeft"]) dx -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const spd = 210 * (1 + s.speed / 100);
    p.x += dx / len * spd * dt;
    p.y += dy / len * spd * dt;
    if (dx) p.face = dx > 0 ? 1 : -1;
  }
  p.x = Math.max(24, Math.min(WORLD.w - 24, p.x));
  p.y = Math.max(28, Math.min(WORLD.h - 28, p.y));
  p.hurtT = Math.max(0, p.hurtT - dt);
  // 再生：每秒回复 再生值*0.2
  if (s.hpRegen > 0 && p.hp < s.maxHp) {
    p.regenT += dt;
    const interval = 1 / (s.hpRegen * 0.2);
    while (p.regenT >= interval) { p.regenT -= interval; p.hp = Math.min(s.maxHp, p.hp + 1); }
  }
}

function damagePlayer(raw) {
  const p = game.player, s = p.stats;
  const dodge = Math.min(60, Math.max(0, s.dodge));
  if (Math.random() * 100 < dodge) { dnum(p.x, p.y - 30, "闪避", "#9adcf0", 0.9); return; }
  const reduced = Math.max(1, Math.round(raw * (1 - s.armor / (s.armor + 15))));
  p.hp -= reduced;
  p.hurtT = 0.25;
  dnum(p.x, p.y - 30, "-" + reduced, "#ff6a6a", 1.1);
  sfx("hurt");
  if (p.hp <= 0) { p.hp = 0; state = "gameover"; sfx("die"); UI.showGameOver(false); }
}

// -------------------- 武器 --------------------
function weaponBaseDmg(w) {
  const t = w.def.tiers[w.tier - 1], s = game.player.stats;
  let d = t.dmg;
  for (const k in w.def.scaling) d += (s[k] || 0) * w.def.scaling[k];
  d *= 1 + s.damagePct / 100;
  return Math.max(1, Math.round(d));
}
function weaponRange(w) {
  const t = w.def.tiers[w.tier - 1], s = game.player.stats;
  return t.range + s.range * (w.def.type === "melee" ? 0.35 : 1);
}
function weaponCd(w) {
  const t = w.def.tiers[w.tier - 1], s = game.player.stats;
  return t.cd / (1 + Math.max(-60, s.attackSpeed) / 100);
}

function nearestEnemy(x, y, range) {
  let best = null, bd = range * range;
  for (const e of game.enemies) {
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function slotPos(w) {
  const p = game.player;
  return { x: p.x + Math.cos(w.slot) * 44, y: p.y + Math.sin(w.slot) * 44 };
}

function updateWeapons(dt) {
  const p = game.player;
  for (const w of p.weapons) {
    const t = w.def.tiers[w.tier - 1];
    const pos = slotPos(w);
    if (w.atk) {
      // 近战挥击动画
      const a = w.atk;
      a.t += dt;
      const dur = 0.16;
      let prog;
      if (a.t < dur) prog = a.t / dur;
      else if (a.t < dur * 2) prog = 1 - (a.t - dur) / dur;
      else { w.atk = null; continue; }
      const reach = weaponRange(w) * prog;
      const tipX = pos.x + Math.cos(a.dir) * reach;
      const tipY = pos.y + Math.sin(a.dir) * reach;
      w.tip = { x: tipX, y: tipY, prog };
      w.angle = a.dir;
      if (a.t < dur && a.hitsLeft > 0) {
        for (const e of game.enemies) {
          if (a.hit.has(e)) continue;
          const hitR = w.def.sweep ? 55 : 30;
          const dx = e.x - tipX, dy = e.y - tipY;
          if (dx * dx + dy * dy < (hitR + e.r) * (hitR + e.r)) {
            a.hit.add(e);
            a.hitsLeft--;
            hitEnemy(e, w, a.dir);
            if (a.hitsLeft <= 0) break;
          }
        }
      }
      continue;
    }
    w.cd -= dt;
    const range = weaponRange(w);
    const target = nearestEnemy(pos.x, pos.y, range + (w.def.type === "ranged" ? 40 : 0));
    if (target) {
      const want = Math.atan2(target.y - pos.y, target.x - pos.x);
      w.angle += angDiff(w.angle, want) * Math.min(1, dt * 14);
    }
    if (w.cd <= 0 && target) {
      w.cd = weaponCd(w);
      const dir = Math.atan2(target.y - pos.y, target.x - pos.x);
      if (w.def.type === "melee") {
        w.atk = { dir, t: 0, hit: new Set(), hitsLeft: t.pierce + 1 };
      } else {
        const count = t.count || 1;
        for (let i = 0; i < count; i++) {
          const spread = (w.def.spread || 0.04);
          const a = dir + (Math.random() - 0.5) * spread * 2;
          game.bullets.push({
            x: pos.x, y: pos.y,
            vx: Math.cos(a) * w.def.projSpeed, vy: Math.sin(a) * w.def.projSpeed,
            w, pierce: t.pierce, traveled: 0, maxDist: range + 60,
            hit: new Set(),
          });
        }
        sfx("shoot");
      }
    }
  }
}
function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function hitEnemy(e, w, dir) {
  const t = w.def.tiers[w.tier - 1], s = game.player.stats;
  let dmg = weaponBaseDmg(w);
  const critC = w.def.critC + s.critChance / 100;
  const crit = Math.random() < critC;
  if (crit) dmg = Math.round(dmg * w.def.critM);
  e.hp -= dmg;
  e.flash = 0.1;
  e.kvx += Math.cos(dir) * t.kb * 14;
  e.kvy += Math.sin(dir) * t.kb * 14;
  if (t.burn) e.burn = { dmg: t.burn, t: 3, tick: 0.5 };
  dnum(e.x, e.y - e.r - 6, dmg, crit ? "#ffd75a" : "#ffffff", crit ? 1.15 : 0.85);
  sfx("hit");
  // 生命偷取
  if (s.lifeSteal > 0 && Math.random() * 100 < s.lifeSteal) {
    const p = game.player;
    if (p.hp < s.maxHp) { p.hp++; dnum(p.x, p.y - 34, "+1", "#7ef07e", 0.8); }
  }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  const g = game;
  const idx = g.enemies.indexOf(e);
  if (idx < 0) return;
  g.enemies.splice(idx, 1);
  g.kills++;
  sfx("kill");
  for (let i = 0; i < 6; i++)
    g.parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260,
      t: 0.35, color: e.def.color, r: 2 + Math.random() * 3 });
  if (e.def.boss) g.bossAlive = false;
  // 材料掉落
  let v = e.def.value;
  while (v > 0) {
    const chunk = Math.min(v, 3);
    v -= chunk;
    if (g.mats.length < 60) {
      g.mats.push({ x: e.x + (Math.random() - 0.5) * 30, y: e.y + (Math.random() - 0.5) * 30, v: chunk, t: 0 });
    } else gainMaterials(chunk);
  }
  // 宝箱
  const luck = game.player.stats.luck;
  if (g.crates < 3 && Math.random() < 0.018 * (1 + luck / 100)) {
    g.crates++;
    sfx("crate");
    dnum(e.x, e.y - 20, "📦宝箱!", "#ffd75a", 1.3);
  }
}

// -------------------- 敌人行为 --------------------
function updateEnemies(dt) {
  const g = game, p = g.player;
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    e.flash = Math.max(0, e.flash - dt);
    e.hitT = Math.max(0, e.hitT - dt);
    e.wob += dt * 6;
    // 燃烧
    if (e.burn) {
      e.burn.t -= dt; e.burn.tick -= dt;
      if (e.burn.tick <= 0) {
        e.burn.tick = 0.5;
        e.hp -= e.burn.dmg;
        dnum(e.x, e.y - e.r - 4, e.burn.dmg, "#ff9540", 0.7);
        if (e.hp <= 0) { killEnemy(e); continue; }
      }
      if (e.burn.t <= 0) e.burn = null;
    }
    // 击退衰减
    e.x += e.kvx * dt; e.y += e.kvy * dt;
    e.kvx *= Math.pow(0.001, dt); e.kvy *= Math.pow(0.001, dt);

    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const ai = e.def.ai;

    if (ai === "chase") {
      e.x += ux * e.speed * dt; e.y += uy * e.speed * dt;
    } else if (ai === "shooter") {
      if (dist > e.def.keepDist) { e.x += ux * e.speed * dt; e.y += uy * e.speed * dt; }
      else { e.x += -uy * e.speed * 0.4 * dt; e.y += ux * e.speed * 0.4 * dt; }
      e.shootT -= dt;
      if (e.shootT <= 0 && dist < e.def.keepDist + 150) {
        e.shootT = e.def.shootCd;
        fireEnemyBullet(e, Math.atan2(dy, dx), e.def.projSpeed);
      }
    } else if (ai === "charger") {
      e.stT -= dt;
      if (e.st === "chase") {
        e.x += ux * e.speed * dt; e.y += uy * e.speed * dt;
        if (dist < 380 && e.stT <= 0) { e.st = "aim"; e.stT = 0.6; e.dashX = ux; e.dashY = uy; }
      } else if (e.st === "aim") {
        e.dashX = ux; e.dashY = uy;
        if (e.stT <= 0) { e.st = "dash"; e.stT = 0.5; }
      } else if (e.st === "dash") {
        e.x += e.dashX * e.speed * 4.5 * dt; e.y += e.dashY * e.speed * 4.5 * dt;
        if (e.stT <= 0) { e.st = "chase"; e.stT = 1.4; }
      }
    } else if (ai === "spawner") {
      e.x += ux * e.speed * dt; e.y += uy * e.speed * dt;
      e.spawnT -= dt;
      if (e.spawnT <= 0 && g.enemies.length < 70) {
        e.spawnT = e.def.spawnCd;
        spawnEnemy(e.def.spawnType, e.x + (Math.random() - 0.5) * 40, e.y + (Math.random() - 0.5) * 40);
      }
    } else if (ai === "boss") {
      e.stT -= dt;
      if (e.st === "chase") {
        e.x += ux * e.speed * dt; e.y += uy * e.speed * dt;
        e.shootT -= dt;
        if (e.shootT <= 0) { e.st = "ring"; e.stT = 0.5; e.shootT = e.def.shootCd; }
        else if (dist < 420 && Math.random() < dt * 0.35) { e.st = "aim"; e.stT = 0.7; }
      } else if (e.st === "ring") {
        if (e.stT <= 0) {
          const n = e.def.ring;
          const off = Math.random() * Math.PI * 2;
          for (let k = 0; k < n; k++) fireEnemyBullet(e, off + k / n * Math.PI * 2, e.def.projSpeed);
          e.st = "chase"; e.stT = 1;
        }
      } else if (e.st === "aim") {
        e.dashX = ux; e.dashY = uy;
        if (e.stT <= 0) { e.st = "dash"; e.stT = 0.55; }
      } else if (e.st === "dash") {
        e.x += e.dashX * e.speed * 5 * dt; e.y += e.dashY * e.speed * 5 * dt;
        if (e.stT <= 0) { e.st = "chase"; e.stT = 1.2; }
      }
    }

    e.x = Math.max(e.r, Math.min(WORLD.w - e.r, e.x));
    e.y = Math.max(e.r, Math.min(WORLD.h - e.r, e.y));

    // 接触伤害
    if (e.hitT <= 0) {
      const rr = e.r + 17;
      if (dist < rr) { damagePlayer(e.dmg); e.hitT = 0.9; }
    }
  }
}

function fireEnemyBullet(e, angle, speed) {
  game.ebullets.push({
    x: e.x, y: e.y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    dmg: e.def.projDmg ? Math.max(1, Math.round(e.def.projDmg * enemyDmgMul(game.wave))) : e.dmg,
    t: 5,
  });
}

// -------------------- 子弹与材料 --------------------
function updateBullets(dt) {
  const g = game;
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    const mx = b.vx * dt, my = b.vy * dt;
    b.x += mx; b.y += my;
    b.traveled += Math.hypot(mx, my);
    if (b.traveled > b.maxDist || b.x < 0 || b.x > WORLD.w || b.y < 0 || b.y > WORLD.h) {
      g.bullets.splice(i, 1); continue;
    }
    for (const e of g.enemies) {
      if (b.hit.has(e)) continue;
      const dx = e.x - b.x, dy = e.y - b.y;
      if (dx * dx + dy * dy < (e.r + 6) * (e.r + 6)) {
        b.hit.add(e);
        hitEnemy(e, b.w, Math.atan2(b.vy, b.vx));
        b.pierce--;
        if (b.pierce <= 0) { g.bullets.splice(i, 1); break; }
      }
    }
  }
  for (let i = g.ebullets.length - 1; i >= 0; i--) {
    const b = g.ebullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.t -= dt;
    if (b.t <= 0 || b.x < -20 || b.x > WORLD.w + 20 || b.y < -20 || b.y > WORLD.h + 20) {
      g.ebullets.splice(i, 1); continue;
    }
    const p = g.player;
    const dx = p.x - b.x, dy = p.y - b.y;
    if (dx * dx + dy * dy < 22 * 22) {
      damagePlayer(b.dmg);
      g.ebullets.splice(i, 1);
    }
  }
}

function updateMats(dt) {
  const g = game, p = g.player, pr = p.stats.pickupRange;
  for (let i = g.mats.length - 1; i >= 0; i--) {
    const m = g.mats[i];
    m.t += dt;
    const dx = p.x - m.x, dy = p.y - m.y;
    const dist = Math.hypot(dx, dy);
    if (m.pull || dist < pr) {
      m.pull = true;
      const spd = 420 + m.t * 500;
      m.x += dx / dist * spd * dt; m.y += dy / dist * spd * dt;
    }
    if (dist < 24) {
      g.mats.splice(i, 1);
      gainMaterials(m.v);
      sfx("pickup");
    }
  }
}

function dnum(x, y, txt, color, scale = 1) {
  game.dnums.push({ x, y, txt: String(txt), color, t: 0.8, scale });
  if (game.dnums.length > 80) game.dnums.shift();
}

// -------------------- 主循环 --------------------
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0.016);
  lastTime = ts;
  if (state === "playing" && game) {
    update(dt);
    render();
    UI.hud();
  } else if ((state === "paused" || state === "interlude" || state === "gameover" || state === "win") && game) {
    render();
  } else {
    renderMenuBg(ts);
  }
}

function update(dt) {
  const g = game;
  g.timer -= dt;
  updatePlayer(dt);
  updateSpawning(dt);
  updateWeapons(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updateMats(dt);
  for (let i = g.dnums.length - 1; i >= 0; i--) {
    const d = g.dnums[i];
    d.t -= dt; d.y -= 40 * dt;
    if (d.t <= 0) g.dnums.splice(i, 1);
  }
  for (let i = g.parts.length - 1; i >= 0; i--) {
    const pa = g.parts[i];
    pa.t -= dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt;
    if (pa.t <= 0) g.parts.splice(i, 1);
  }
  if (g.timer <= 0) {
    // Boss 波需要击杀 Boss 才结束（Boss 存活时时间停在 0）
    if (g.bossAlive) { g.timer = 0; }
    else endWave();
  }
}

// -------------------- 渲染 --------------------
function render() {
  const g = game, p = g.player;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#101418";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(viewScale, 0, 0, viewScale, viewOx, viewOy);

  // 地面
  ctx.fillStyle = "#23282e";
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.strokeStyle = "#2e343b"; ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.w; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.h); ctx.stroke(); }
  for (let y = 0; y <= WORLD.h; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); ctx.stroke(); }
  ctx.strokeStyle = "#4a525c"; ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, WORLD.w - 6, WORLD.h - 6);

  // 生成警告
  for (const w of g.warns) {
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(w.t * 12));
    ctx.strokeStyle = "#e04a4a"; ctx.lineWidth = 5;
    const s = ENEMY_TYPES[w.type].boss ? 34 : 14;
    ctx.beginPath();
    ctx.moveTo(w.x - s, w.y - s); ctx.lineTo(w.x + s, w.y + s);
    ctx.moveTo(w.x + s, w.y - s); ctx.lineTo(w.x - s, w.y + s);
    ctx.stroke();
    ctx.restore();
  }

  // 材料
  for (const m of g.mats) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#4ade80";
    const s = 5 + m.v;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 1.5;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }

  // 粒子
  for (const pa of g.parts) {
    ctx.globalAlpha = Math.max(0, pa.t / 0.35);
    ctx.fillStyle = pa.color;
    ctx.beginPath(); ctx.arc(pa.x, pa.y, pa.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 敌人
  for (const e of g.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y + Math.sin(e.wob) * 2);
    if (e.st === "aim") {
      ctx.strokeStyle = "rgba(255,80,80,.5)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(e.dashX * 300, e.dashY * 300); ctx.stroke();
    }
    ctx.fillStyle = e.flash > 0 ? "#ffffff" : e.def.color;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, 7); ctx.fill();
    if (e.burn) {
      ctx.fillStyle = "rgba(255,140,40,.55)";
      ctx.beginPath(); ctx.arc(0, -e.r * 0.6, e.r * 0.5, 0, 7); ctx.fill();
    }
    // 眼睛
    const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x);
    const ex = Math.cos(ang) * e.r * 0.35, ey = Math.sin(ang) * e.r * 0.35;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-e.r * 0.3 + ex, -e.r * 0.15 + ey, e.r * 0.22, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(e.r * 0.3 + ex, -e.r * 0.15 + ey, e.r * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(-e.r * 0.3 + ex * 1.3, -e.r * 0.15 + ey * 1.3, e.r * 0.1, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(e.r * 0.3 + ex * 1.3, -e.r * 0.15 + ey * 1.3, e.r * 0.1, 0, 7); ctx.fill();
    // 血条（受伤或Boss）
    if (e.hp < e.maxHp || e.def.boss) {
      const w = e.r * 2.2;
      ctx.fillStyle = "rgba(0,0,0,.5)";
      ctx.fillRect(-w / 2, -e.r - 12, w, 5);
      ctx.fillStyle = e.def.boss ? "#e04a4a" : "#7ec46a";
      ctx.fillRect(-w / 2, -e.r - 12, w * Math.max(0, e.hp / e.maxHp), 5);
    }
    ctx.restore();
  }

  // 敌方子弹
  ctx.fillStyle = "#ff7a7a";
  for (const b of g.ebullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.fill();
  }

  // 玩家子弹
  for (const b of g.bullets) {
    ctx.strokeStyle = b.w.def.cls === "元素" ? "#7ad6ff" : "#ffe08a";
    ctx.lineWidth = 4;
    const l = 10;
    const d = Math.hypot(b.vx, b.vy) || 1;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx / d * l, b.y - b.vy / d * l);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // 玩家（土豆）
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.hurtT > 0) ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(p.hurtT * 40));
  ctx.fillStyle = p.hurtT > 0 ? "#ff9c9c" : "#cfa356";
  ctx.beginPath(); ctx.ellipse(0, 0, 17, 22, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = "#8a6a34"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#3a2d16";
  ctx.beginPath(); ctx.arc(-6 * p.face, -6, 2.6, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(6 * p.face, -6, 2.6, 0, 7); ctx.fill();
  ctx.strokeStyle = "#3a2d16"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 3, 6, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();

  // 武器
  ctx.font = "26px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const w of p.weapons) {
    const pos = slotPos(w);
    let x = pos.x, y = pos.y;
    if (w.atk && w.tip) { x = pos.x + (w.tip.x - pos.x) * 0.9; y = pos.y + (w.tip.y - pos.y) * 0.9; }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(w.angle + Math.PI / 4);
    ctx.fillText(w.def.emoji, 0, 0);
    if (w.tier > 1) {
      ctx.rotate(-(w.angle + Math.PI / 4));
      ctx.fillStyle = TIER_COLORS[w.tier];
      ctx.beginPath(); ctx.arc(12, -12, 4, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // 伤害数字
  for (const d of g.dnums) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, d.t / 0.4);
    ctx.fillStyle = d.color;
    ctx.font = `bold ${Math.round(18 * d.scale)}px sans-serif`;
    ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 3;
    ctx.strokeText(d.txt, d.x, d.y);
    ctx.fillText(d.txt, d.x, d.y);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderMenuBg(ts) {
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const t = ts / 1000;
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, "#1a2028");
  grd.addColorStop(1, "#10141a");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "40px serif"; ctx.textAlign = "center";
  for (let i = 0; i < 8; i++) {
    const x = ((i * 977 + t * 30 * (1 + i % 3)) % (canvas.width + 100)) - 50;
    const y = 100 + (i * 313) % (canvas.height - 200) + Math.sin(t + i) * 20;
    ctx.globalAlpha = 0.12;
    ctx.fillText("🥔", x, y);
  }
  ctx.globalAlpha = 1;
}
