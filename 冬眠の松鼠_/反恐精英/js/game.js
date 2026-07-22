// ============================================================
//  game.js  -  core: scene/renderer, round FSM, economy,
//  hitscan, damage routing, bomb, grenades, effects, radar.
// ============================================================
import * as THREE from "three";
import {
  WEAPONS, GRENADES, GEAR, TEAM, TIMING, ECON, MAX_SCORE,
  DIFFICULTY, BOT_NAMES, PHYS,
} from "./config.js";
import { buildMap, segmentBlocked } from "./map.js";
import { Player } from "./player.js";
import { Input } from "./input.js";
import { WeaponController, computeDamage, weaponMoveSpeed } from "./weapons.js";
import { Bot } from "./bots.js";
import { HUD } from "./hud.js";
import { Audio } from "./audio.js";

export class Game {
  constructor(opts) {
    this.opts = opts;
    this.diff = DIFFICULTY[opts.difficulty || "normal"];
    this.botsPerTeam = opts.botCount || 3;
    this.baseFOV = 90;

    // ---- renderer ----
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById("game-container").appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.baseFOV, window.innerWidth / window.innerHeight, 0.05, 300);
    this.scene.add(this.camera);

    // ---- systems ----
    this.map = buildMap(this.scene);
    this.player = new Player(this.camera, this.map);
    this.player.isPlayer = true;
    this.player.name = "You";
    this.player.kills = 0; this.player.deaths = 0; this.player.money = ECON.start;
    let chosen = opts.team || TEAM.CT;
    if (chosen === "random") chosen = Math.random() < 0.5 ? TEAM.CT : TEAM.T;
    this.player.team = chosen === TEAM.T ? TEAM.T : TEAM.CT;
    this.enemyTeam = this.player.team === TEAM.CT ? TEAM.T : TEAM.CT;
    this.player.survived = true;
    this.player.hasDefuse = false;
    this.player.hasBomb = false;

    this.hud = new HUD();
    this.audio = new Audio();
    this.input = new Input(this.renderer.domElement);
    this.input.sensitivity = opts.sensitivity || 2.2;

    this.controller = new WeaponController(this.player, this.camera, this.scene, {
      fireBullet: (o, d, w, s) => this.fireBullet(o, d, w, s),
      meleeAttack: (s, w) => this.meleeAttack(s, w),
      throwGrenade: (o, d, k, s) => this.throwGrenade(o, d, k, s),
      playSound: (n, w) => this.playLocalSound(n, w),
      onScope: (lvl, w) => this.onScope(lvl, w),
    });

    // ---- bots ----
    this.bots = [];
    this._makeBots();
    // points of interest bots patrol between (drives engagement)
    this._patrolPoints = [
      this.map.bombsites.A.center.clone(),
      this.map.bombsites.B.center.clone(),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 24),
      new THREE.Vector3(0, 0, -24),
      new THREE.Vector3(30, 0, 8),
      new THREE.Vector3(-30, 0, 8),
    ];

    // ---- effects ----
    this.effects = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.9 });
    this.grenades = [];
    this.smokes = [];
    this.fires = [];

    // ---- round state ----
    this.state = {
      phase: "buy", timer: TIMING.freezeTime, roundNum: 1,
      scoreCT: 0, scoreT: 0, winner: null, reason: "",
      lossStreak: { [TEAM.CT]: 0, [TEAM.T]: 0 },
    };
    this.bomb = { planted: false, dropped: false, pos: new THREE.Vector3(), timer: 0, site: null, mesh: null, defusing: false, defuseProg: 0, planting: false, plantProg: 0 };
    this.frozen = true;
    this.aimScale = 1;
    this.roundStartClock = 0;

    // flashbang overlay element
    this.flashDiv = document.createElement("div");
    this.flashDiv.style.cssText = "position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:26;transition:opacity 0.1s;";
    document.body.appendChild(this.flashDiv);
    this.flashUntil = 0;

    this._footstepT = 0;
    this._lastTime = performance.now();
    this._raycaster = new THREE.Raycaster();

    window.addEventListener("resize", () => this._onResize());
    this._setupInput();
    this._setupBuyMenu();
  }

  // ============================================================
  //  Setup
  // ============================================================
  _makeBots() {
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    let ni = 0;
    // enemies = botsPerTeam ; teammates = botsPerTeam-1 (the human fills one slot)
    for (let i = 0; i < this.botsPerTeam; i++) {
      this.bots.push(new Bot(this.scene, this.map, this.enemyTeam, names[ni++ % names.length], this.diff));
    }
    for (let i = 0; i < this.botsPerTeam - 1; i++) {
      this.bots.push(new Bot(this.scene, this.map, this.player.team, "BOT " + names[ni++ % names.length], this.diff));
    }
  }

  _setupInput() {
    this.input.onLockChange = (locked) => {
      if (locked) {
        document.getElementById("pause-screen").classList.add("hidden");
      } else {
        if (this.started && !this.hud.buyOpen) document.getElementById("pause-screen").classList.remove("hidden");
      }
    };
    // global keys (work without lock)
    this.input.globalKeyHandlers["KeyB"] = () => this.toggleBuyMenu();
    this.input.globalKeyHandlers["Escape"] = () => { if (this.hud.buyOpen) this.toggleBuyMenu(); };
    this.input.globalKeyHandlers["Tab"] = () => this.showScoreboard();
    window.addEventListener("keyup", (e) => { if (e.code === "Tab") this.hud.hideScoreboard(); });
    // buy category number keys when buy menu open
    for (let i = 1; i <= 7; i++) {
      this.input.globalKeyHandlers["Digit" + i] = ((k) => () => {
        if (this.hud.buyOpen) this.hud.selectCategoryByKey(String(k));
      })(i);
    }
    // click to resume
    document.getElementById("pause-screen").addEventListener("click", () => {
      if (!this.hud.buyOpen) this.input.requestLock();
    });
  }

  _setupBuyMenu() {
    this.hud.buildBuyMenu(
      (key, type, price) => this.buyItem(key, type, price),
      () => ({
        money: this.player.money,
        team: this.player.team,
        owned: (key) => this._owns(key),
      })
    );
  }

  _owns(key) {
    if (WEAPONS[key]) {
      const w = WEAPONS[key];
      if (w.cat === "pistol") return this.controller.inv.pistol.key === key;
      return this.controller.inv.primary && this.controller.inv.primary.key === key;
    }
    if (GRENADES[key]) return this.controller.inv.grenades.includes(key);
    if (key === "kevlar") return this.player.armor >= 100 && !this.player.helmet;
    if (key === "kevlarhelmet") return this.player.armor >= 100 && this.player.helmet;
    if (key === "defuse") return this.player.hasDefuse;
    return false;
  }

  // ============================================================
  //  Start / main loop
  // ============================================================
  start() {
    this.started = true;
    this.audio.init();
    this.audio.resume();
    this._lastTime = performance.now();
    this.nowSec = this._lastTime / 1000;
    this.startRound(true);
    this.input.requestLock();
    this._loop();
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const now = performance.now();
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    if (dt > 0.05) dt = 0.05; // clamp
    this.nowSec = now / 1000;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  // ============================================================
  //  Update
  // ============================================================
  update(dt) {
    const now = this.nowSec;

    // movement speed based on weapon / scope
    const w = this.controller.currentWeapon();
    let ms = weaponMoveSpeed(this.controller.inv);
    if (this.controller.scope > 0) ms *= 0.5;
    this.player.maxSpeed = ms;

    // player
    if (this.player.alive && !this.frozen && this.input.locked && !this.hud.buyOpen) {
      this.player.update(dt, this.input, this.aimScale);
    } else {
      // frozen / paused / dead: look only when mouse is captured
      if (this.input.locked) this.player.applyLook(this.input.mouse.dx, this.input.mouse.dy, this.input.sensitivity * this.aimScale);
      this.player._updateCamera(0);
    }

    // weapon controller
    if (this.player.alive && !this.hud.buyOpen && this.input.locked) {
      this.controller.update(dt, this.input, now);
    }

    // bomb interaction (hold E)
    this._updateBombInteraction(dt, now);

    // footsteps
    if (this.player.alive && !this.frozen) {
      const sp = Math.hypot(this.player.vel.x, this.player.vel.z);
      if (this.player.onGround && sp > 1 && !this.player.wishWalk) {
        this._footstepT -= dt;
        if (this._footstepT <= 0) { this.audio.footstep(0); this._footstepT = 0.35; }
      }
    }

    // bots
    const ctEnemies = this._combatants().filter((c) => c.team === TEAM.T && c.alive);
    const tEnemies = this._combatants().filter((c) => c.team === TEAM.CT && c.alive);
    for (const bot of this.bots) {
      if (!bot.alive) continue;
      if (this.frozen) { bot._syncModel(); continue; }
      bot.update(dt, {
        now,
        enemies: bot.team === TEAM.CT ? ctEnemies : tEnemies,
        dealDamage: (t, wp, hg, dist, atk) => this.dealDamage(t, wp, hg, dist, atk),
        spawnTracer: (from, to, team) => this.spawnTracer(from, to, team === TEAM.CT ? 0x88bbff : 0xffcc66),
        playSound: (n, wp, pos) => this.playWorldSound(n, wp, pos),
        smokeBlocked: (from, to) => this._smokeBlocked(from, to),
        bomb: this.bomb,
        sites: this.map.bombsites,
        patrolPoints: this._patrolPoints,
        inBombsite: (pos) => this._inBombsite(pos),
        botPlant: (b, d) => this.botPlant(b, d),
        botDefuse: (b, d) => this.botDefuse(b, d),
      });
    }

    // effects, grenades
    this._updateEffects(dt, now);
    this._updateGrenades(dt, now);
    this._updateSmokes(now);
    this._updateFires(dt, now);

    // flashbang fade
    if (now < this.flashUntil) {
      const remain = (this.flashUntil - now);
      this.flashDiv.style.opacity = Math.min(1, remain / 1.5);
    } else this.flashDiv.style.opacity = 0;

    // round FSM
    this._updateRound(dt, now);

    // HUD
    this._updateHUD();
  }

  _combatants() { return [this.player, ...this.bots]; }

  // ============================================================
  //  Shooting / hitscan
  // ============================================================
  fireBullet(origin, dir, weapon, shooter) {
    // build target list for player: enemy bots
    this._raycaster.set(origin, dir);
    this._raycaster.far = 200;

    let closest = null, closestDist = Infinity, hitInfo = null;

    // world (walls)
    const wallHits = this._raycaster.intersectObjects(this.map.worldMeshes, false);
    if (wallHits.length) { closestDist = wallHits[0].distance; closest = { type: "wall", point: wallHits[0].point, normal: wallHits[0].face ? wallHits[0].face.normal : null }; }

    // enemy bots
    const enemyMeshes = [];
    for (const bot of this.bots) {
      if (bot.alive && bot.team !== shooter.team) enemyMeshes.push(...bot.hitMeshes);
    }
    const botHits = this._raycaster.intersectObjects(enemyMeshes, false);
    if (botHits.length && botHits[0].distance < closestDist) {
      closestDist = botHits[0].distance;
      const mesh = botHits[0].object;
      closest = { type: "bot", point: botHits[0].point, bot: mesh.userData.bot, hitgroup: mesh.userData.hitgroup };
    }

    // muzzle position (approx viewmodel tip)
    const muzzle = origin.clone().addScaledVector(dir, 0.6);
    const endPoint = closest ? closest.point : origin.clone().addScaledVector(dir, 100);
    this.spawnTracer(muzzle, endPoint, 0xffee88);

    if (!closest) return;
    if (closest.type === "wall") {
      this.spawnImpact(closest.point, closest.normal, "wall");
    } else if (closest.type === "bot") {
      const dist = origin.distanceTo(closest.point);
      this.spawnImpact(closest.point, dir.clone().negate(), "blood");
      this.dealDamage(closest.bot, weapon, closest.hitgroup, dist, shooter);
    }
  }

  meleeAttack(shooter, weapon) {
    const origin = shooter.eyePosition;
    const dir = shooter.getForward();
    let best = null, bestD = weapon.range;
    for (const bot of this.bots) {
      if (!bot.alive || bot.team === shooter.team) continue;
      const to = bot.eyePos;
      const d = origin.distanceTo(to);
      if (d > weapon.range + 0.5) continue;
      const dot = dir.clone().normalize().dot(to.clone().sub(origin).normalize());
      if (dot > 0.7 && d < bestD) { bestD = d; best = bot; }
    }
    if (best) {
      // back stab?
      const back = best.model.rotation.y;
      this.dealDamage(best, weapon, "chest", bestD, shooter);
      this.spawnImpact(best.eyePos, dir.clone().negate(), "blood");
    }
  }

  dealDamage(target, weapon, hitgroup, distance, attacker) {
    if (!target.alive) return;
    const dmg = computeDamage(weapon, distance, hitgroup,
      target.armor, target.helmet);

    if (target.isPlayer) {
      if (target.armor > 0 && dmg.armor) target.armor = Math.max(0, target.armor - dmg.armor);
      target.health -= dmg.health;
      this.hud.hurt();
      this.audio.hurt();
      if (target.health <= 0) { target.health = 0; this.onDeath(target, attacker, weapon, hitgroup); }
    } else {
      const dead = target.takeDamage(dmg);
      // feedback to player if player is attacker
      if (attacker === this.player) {
        this.hud.hitmarker(dead);
        if (hitgroup === "head") this.audio.headshot(); else this.audio.hit();
      }
      this.audio.hitFlesh(this.player.pos.distanceTo(target.pos));
      if (dead) this.onDeath(target, attacker, weapon, hitgroup);
    }
  }

  onDeath(victim, attacker, weapon, hitgroup) {
    victim.alive = false;
    victim.deaths = (victim.deaths || 0) + 1;
    const headshot = hitgroup === "head";
    const wname = weapon ? weapon.name : "world";

    if (victim.isBot) victim.die();
    else {
      this.audio.death();
      this.hud.showCenter("YOU DIED", "Spectating until round ends", 3, "#ff5555");
    }

    // drop bomb
    if (victim.hasBomb) this._dropBomb(victim.pos);

    // rewards
    if (attacker && attacker !== victim && attacker.team !== victim.team) {
      attacker.kills = (attacker.kills || 0) + 1;
      const reward = ECON.killReward[weapon ? weapon.killType : "rifle"] || 300;
      attacker.money = Math.min(ECON.maxMoney, (attacker.money || 0) + reward);
      if (attacker === this.player) this.hud.setMoney(this.player.money, true);
    }

    this.hud.addKill(
      attacker ? attacker.name : "world",
      attacker ? attacker.team : victim.team,
      victim.name, victim.team, wname, headshot
    );

    this._checkRoundEnd();
  }

  spawnTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.effects.push({ obj: line, until: this.nowSec + 0.05, fade: true });
    // muzzle flash (additive sprite - no dynamic light => no shader recompiles)
    this._flashSprite(from, 0xffdd66, 0.35, 0.045);
  }

  _flashSprite(pos, color, size, dur) {
    const mat = new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.set(size, size, size);
    this.scene.add(s);
    this.effects.push({ obj: s, until: this.nowSec + dur, fade: true });
  }

  spawnImpact(point, normal, kind) {
    const color = kind === "blood" ? 0xaa1111 : 0xcccccc;
    const count = kind === "blood" ? 6 : 4;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.03, 4, 4);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
      m.position.copy(point);
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.6 + 0.2, (Math.random() - 0.5));
      if (normal) v.add(normal.clone().multiplyScalar(0.5));
      this.scene.add(m);
      this.effects.push({ obj: m, until: this.nowSec + 0.4, vel: v.multiplyScalar(3), gravity: true });
    }
  }

  _updateEffects(dt, now) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      if (e.vel) {
        if (e.gravity) e.vel.y -= 12 * dt;
        e.obj.position.addScaledVector(e.vel, dt);
      }
      if (e.fade && e.obj.material) e.obj.material.opacity *= Math.exp(-30 * dt);
      if (now >= e.until) {
        this.scene.remove(e.obj);
        if (e.obj.geometry) e.obj.geometry.dispose();
        if (e.obj.material) e.obj.material.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  // ============================================================
  //  Grenades
  // ============================================================
  throwGrenade(origin, dir, key, owner) {
    const g = GRENADES[key];
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshLambertMaterial({ color: g.type === "he" ? 0x445533 : g.type === "flash" ? 0xcccccc : g.type === "smoke" ? 0x88aa88 : g.type === "fire" ? 0x883322 : 0x999999 })
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);
    const vel = dir.clone().multiplyScalar(18);
    vel.add(owner.vel ? owner.vel.clone().multiplyScalar(0.5) : new THREE.Vector3());
    this.grenades.push({
      mesh, vel, key, type: g.type, owner,
      detonateAt: this.nowSec + (g.type === "he" ? 1.6 : g.type === "flash" ? 1.5 : g.type === "smoke" ? 1.6 : g.type === "fire" ? 1.4 : 1.6),
      bounces: 0,
    });
    this.playLocalSound("throw");
  }

  _updateGrenades(dt, now) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const gr = this.grenades[i];
      gr.vel.y -= 16 * dt;
      const p = gr.mesh.position;
      const next = p.clone().addScaledVector(gr.vel, dt);
      // floor bounce
      if (next.y < 0.1) { next.y = 0.1; gr.vel.y *= -0.5; gr.vel.x *= 0.7; gr.vel.z *= 0.7; gr.bounces++; }
      // wall bounce (simple)
      for (const c of this.map.colliders) {
        if (next.x > c.minX - 0.1 && next.x < c.maxX + 0.1 && next.z > c.minZ - 0.1 && next.z < c.maxZ + 0.1 && next.y < c.maxY) {
          // reflect on nearest axis
          const dxl = Math.abs(next.x - c.minX), dxr = Math.abs(next.x - c.maxX);
          const dzl = Math.abs(next.z - c.minZ), dzr = Math.abs(next.z - c.maxZ);
          const m = Math.min(dxl, dxr, dzl, dzr);
          if (m === dxl || m === dxr) gr.vel.x *= -0.5; else gr.vel.z *= -0.5;
          next.copy(p);
          break;
        }
      }
      p.copy(next);

      if (now >= gr.detonateAt) {
        this._detonate(gr);
        this.scene.remove(gr.mesh);
        gr.mesh.geometry.dispose(); gr.mesh.material.dispose();
        this.grenades.splice(i, 1);
      }
    }
  }

  _detonate(gr) {
    const pos = gr.mesh.position.clone();
    const g = GRENADES[gr.key];
    if (gr.type === "he") {
      this.audio.explosion();
      this._explosionFX(pos, 0xff7722);
      for (const c of this._combatants()) {
        if (!c.alive) continue;
        const cp = c.isPlayer ? c.pos : c.pos;
        const d = cp.distanceTo(pos);
        if (d < g.radius) {
          const frac = 1 - d / g.radius;
          const dmg = Math.round(g.maxDmg * frac * frac);
          this.dealDamage(c, { dmg, armorPen: 0.5, killType: "hegrenade", name: "HE Grenade" }, "stomach", 0, gr.owner);
        }
      }
    } else if (gr.type === "flash") {
      this.audio.flash();
      this._explosionFX(pos, 0xffffff);
      // player flash
      const eye = this.player.eyePosition;
      const toNade = pos.clone().sub(eye);
      const d = toNade.length();
      if (d < g.radius * 3 && !segmentBlocked(this.map.colliders, eye.x, eye.z, pos.x, pos.z, 0.2)) {
        const facing = this.player.getForward().dot(toNade.normalize());
        const intensity = Math.max(0.3, (facing + 1) / 2) * (1 - d / (g.radius * 3));
        this.flashUntil = this.nowSec + 1.2 + intensity * 2.5;
      }
      // bots flash
      for (const bot of this.bots) {
        if (!bot.alive) continue;
        const bd = bot.eyePos.distanceTo(pos);
        if (bd < g.radius * 3 && !segmentBlocked(this.map.colliders, bot.eyePos.x, bot.eyePos.z, pos.x, pos.z, 0.2)) {
          bot.blindUntil = this.nowSec + 2 + Math.random() * 2;
        }
      }
    } else if (gr.type === "smoke") {
      const smokeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(g.radius, 16, 16),
        new THREE.MeshLambertMaterial({ color: 0xdddddd, transparent: true, opacity: 0 })
      );
      smokeMesh.position.copy(pos); smokeMesh.position.y = g.radius * 0.6;
      this.scene.add(smokeMesh);
      this.smokes.push({ mesh: smokeMesh, pos: smokeMesh.position.clone(), radius: g.radius, until: this.nowSec + 15, born: this.nowSec });
    } else if (gr.type === "fire") {
      this._explosionFX(pos, 0xff5522);
      this.fires.push({ pos, radius: g.radius, dps: g.dps, until: this.nowSec + 7, particles: [] });
    } else if (gr.type === "decoy") {
      this.playWorldSound("shoot", WEAPONS.ak47, pos);
    }
  }

  _explosionFX(pos, color) {
    const fpos = pos.clone(); fpos.y += 1;
    this._flashSprite(fpos, color, 6, 0.22);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 4, 4), new THREE.MeshBasicMaterial({ color }));
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2).multiplyScalar(6);
      this.scene.add(m);
      this.effects.push({ obj: m, until: this.nowSec + 0.5, vel: v, gravity: true });
    }
  }

  _updateSmokes(now) {
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      const age = now - s.born;
      const life = s.until - s.born;
      let op = 0.85;
      if (age < 1) op = age * 0.85;
      else if (now > s.until - 2) op = 0.85 * (s.until - now) / 2;
      s.mesh.material.opacity = Math.max(0, op);
      if (now >= s.until) {
        this.scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose();
        this.smokes.splice(i, 1);
      }
    }
  }
  _smokeBlocked(from, to) {
    for (const s of this.smokes) {
      if (this.nowSec - s.born < 1) continue;
      if (this._segSphere(from, to, s.pos, s.radius * 0.85)) return true;
    }
    return false;
  }
  _segSphere(a, b, c, r) {
    const ab = b.clone().sub(a);
    const t = Math.max(0, Math.min(1, c.clone().sub(a).dot(ab) / ab.lengthSq()));
    const p = a.clone().addScaledVector(ab, t);
    return p.distanceTo(c) < r;
  }

  _updateFires(dt, now) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      // damage
      for (const c of this._combatants()) {
        if (!c.alive) continue;
        if (c.pos.distanceTo(f.pos) < f.radius) {
          const dmg = f.dps * dt;
          if (c.isPlayer) { c.health -= dmg; this.hud.hurt(); if (c.health <= 0) { c.health = 0; this.onDeath(c, f.owner, { name: "Molotov", killType: "hegrenade" }, "leg"); } }
          else { if (c.takeDamage({ health: dmg, armor: 0 })) this.onDeath(c, null, { name: "Molotov", killType: "hegrenade" }, "leg"); }
        }
      }
      // flame particles
      if (Math.random() < 0.6) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 4, 4), new THREE.MeshBasicMaterial({ color: 0xff6622, transparent: true, opacity: 0.8 }));
        m.position.set(f.pos.x + (Math.random() - 0.5) * f.radius * 1.5, 0.2, f.pos.z + (Math.random() - 0.5) * f.radius * 1.5);
        this.scene.add(m);
        this.effects.push({ obj: m, until: now + 0.5, vel: new THREE.Vector3(0, 2, 0), fade: false });
      }
      if (now >= f.until) this.fires.splice(i, 1);
    }
  }

  // ============================================================
  //  Bomb
  // ============================================================
  _updateBombInteraction(dt, now) {
    const holdE = this.input.keys["KeyE"];
    // planting (T with bomb, in site, on ground)
    if (this.player.alive && this.player.team === TEAM.T && this.player.hasBomb && !this.bomb.planted) {
      const site = this._inBombsite(this.player.pos);
      if (site && holdE && this.player.onGround && Math.hypot(this.player.vel.x, this.player.vel.z) < 1) {
        this.bomb.planting = true;
        this.bomb.plantProg += dt;
        this.hud.setBombStatus(`PLANTING... ${Math.ceil(TIMING.plantTime - this.bomb.plantProg)}`, false);
        if (Math.floor(this.bomb.plantProg * 3) !== this._lastPlantBeep) { this._lastPlantBeep = Math.floor(this.bomb.plantProg * 3); this.audio.plantBeep(); }
        if (this.bomb.plantProg >= TIMING.plantTime) this._plantBomb(site);
      } else if (this.bomb.planting) {
        this.bomb.planting = false; this.bomb.plantProg = 0; this.hud.setBombStatus("", false);
      }
    }
    // defusing (CT near planted bomb)
    if (this.player.alive && this.player.team === TEAM.CT && this.bomb.planted) {
      const d = this.player.pos.distanceTo(this.bomb.pos);
      if (d < 2.2 && holdE && this.player.onGround) {
        this.bomb.defusing = true;
        const dtime = this.player.hasDefuse ? TIMING.defuseKit : TIMING.defuseNoKit;
        this.bomb.defuseProg += dt;
        this.hud.setBombStatus(`DEFUSING... ${Math.ceil(dtime - this.bomb.defuseProg)}`, true);
        if (Math.floor(this.bomb.defuseProg * 3) !== this._lastDefBeep) { this._lastDefBeep = Math.floor(this.bomb.defuseProg * 3); this.audio.defuseBeep(); }
        if (this.bomb.defuseProg >= dtime) this._defuseBomb();
      } else if (this.bomb.defusing) {
        this.bomb.defusing = false; this.bomb.defuseProg = 0;
        this.hud.setBombStatus("BOMB PLANTED", true);
      }
    }
    // pick up dropped bomb
    if (this.player.alive && this.player.team === TEAM.T && this.bomb.dropped && !this.player.hasBomb) {
      if (this.player.pos.distanceTo(this.bomb.pos) < 1.5) {
        this.player.hasBomb = true; this.bomb.dropped = false;
        if (this.bomb.mesh) { this.scene.remove(this.bomb.mesh); this.bomb.mesh = null; }
        this.controller.giveC4();
        this.hud.showCenter("", "", 0);
      }
    }
  }

  _inBombsite(pos) {
    for (const [name, s] of Object.entries(this.map.bombsites)) {
      if (pos.x > s.minX && pos.x < s.maxX && pos.z > s.minZ && pos.z < s.maxZ) return name;
    }
    return null;
  }

  _plantBomb(site) {
    this._plantBombAt(this.player.pos, site, this.player);
    this.hud.showCenter("BOMB PLANTED", `Site ${site}`, 2, "#ff5555");
  }

  _plantBombAt(pos, site, planter) {
    this.bomb.planted = true;
    this.bomb.planting = false;
    this.bomb.site = site;
    this.bomb.pos.copy(pos);
    this.bomb.pos.y = 0.2;
    this.bomb.timer = TIMING.bombTimer;
    if (planter) {
      planter.hasBomb = false;
      planter.money = Math.min(ECON.maxMoney, (planter.money || 0) + ECON.plantReward);
      if (planter === this.player) this.hud.setMoney(this.player.money, true);
    }
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x882222 }));
    m.position.copy(this.bomb.pos);
    this.scene.add(m);
    this.bomb.mesh = m;
    this.audio.planted();
    this.hud.setBombStatus("BOMB PLANTED", true);
    if (this.player.team === TEAM.T) this.hud.showCenter("BOMB PLANTED", `Defend site ${site}`, 2, "#ff5555");
    else this.hud.showCenter("BOMB HAS BEEN PLANTED", `Site ${site} — defuse it!`, 2.5, "#ff5555");
  }

  // bot planting (called from bot AI while standing on a site with the bomb)
  botPlant(bot, dt) {
    const site = this._inBombsite(bot.pos);
    if (!site) { bot.plantProg = 0; return false; }
    bot.plantProg = (bot.plantProg || 0) + dt;
    if (bot.plantProg >= TIMING.plantTime) {
      this._plantBombAt(bot.pos, site, bot);
      bot.plantProg = 0;
    }
    return true;
  }

  // bot defusing
  botDefuse(bot, dt) {
    if (!this.bomb.planted) return false;
    bot.defuseProg = (bot.defuseProg || 0) + dt;
    const time = bot.hasDefuse ? TIMING.defuseKit : TIMING.defuseNoKit;
    if (bot.defuseProg >= time) {
      bot.defuseProg = 0;
      this.bomb.planted = false;
      if (this.bomb.mesh) { this.scene.remove(this.bomb.mesh); this.bomb.mesh = null; }
      bot.money = Math.min(ECON.maxMoney, (bot.money || 0) + ECON.defuseReward);
      this.endRound(TEAM.CT, "Bomb defused");
    }
    return true;
  }

  _defuseBomb() {
    this.bomb.planted = false;
    this.bomb.defusing = false;
    if (this.bomb.mesh) { this.scene.remove(this.bomb.mesh); this.bomb.mesh = null; }
    this.player.money = Math.min(ECON.maxMoney, this.player.money + ECON.defuseReward);
    this.endRound(TEAM.CT, "Bomb defused");
  }

  _dropBomb(pos) {
    this.bomb.dropped = true;
    this.bomb.pos.copy(pos); this.bomb.pos.y = 0.2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x662222 }));
    m.position.copy(this.bomb.pos);
    this.scene.add(m);
    this.bomb.mesh = m;
  }

  // ============================================================
  //  Round FSM
  // ============================================================
  startRound(first) {
    const s = this.state;
    s.phase = "buy";
    s.timer = TIMING.freezeTime;
    s.winner = null; s.reason = "";
    this.frozen = true;
    this.roundStartClock = this.nowSec;

    // reset bomb
    if (this.bomb.mesh) { this.scene.remove(this.bomb.mesh); this.bomb.mesh = null; }
    this.bomb = { planted: false, dropped: false, pos: new THREE.Vector3(), timer: 0, site: null, mesh: null, defusing: false, defuseProg: 0, planting: false, plantProg: 0 };
    this.hud.setBombStatus("", false);

    // clear smokes/fires/grenades
    for (const sm of this.smokes) this.scene.remove(sm.mesh);
    this.smokes = []; this.fires = [];
    for (const gr of this.grenades) this.scene.remove(gr.mesh);
    this.grenades = [];

    // economy for the round (except first / pistol)
    if (!first) this._awardRoundStartMoney();

    // respawn player
    const isPistol = s.roundNum === 1;
    const ctSpawns = this.map.spawns[TEAM.CT];
    const tSpawns = this.map.spawns[TEAM.T];
    const pspawn = this.player.team === TEAM.CT ? ctSpawns : tSpawns;
    const idx = 0;
    this.player.reset(pspawn[idx].clone(), this.player.team);

    // reset player loadout if died last round OR pistol round
    if (!this.player.survived || isPistol || first) {
      this.controller.inv = createDefaultInv(this.player.team);
      this.player.armor = 0; this.player.helmet = false;
      this.player.hasDefuse = false;
      if (isPistol || first) { this.player.money = ECON.start; }
      this.controller.equip("pistol", true);
    } else {
      // refill ammo
      this._refillAmmo();
      this.controller.equip(this.controller.inv.primary ? "primary" : "pistol", true);
    }
    this.player.survived = true;
    this.player.hasBomb = false;

    // decide bomb carrier among Terrorists (player included if T)
    const tCombatants = this._combatants().filter((c) => c.team === TEAM.T);
    const carrier = tCombatants.length ? tCombatants[Math.floor(Math.random() * tCombatants.length)] : null;
    if (carrier === this.player) {
      this.player.hasBomb = true;
      this.controller.giveC4();
    }

    // spawn bots
    let ci = 1, ti = 1;
    for (const bot of this.bots) {
      const spawns = bot.team === TEAM.CT ? ctSpawns : tSpawns;
      const idxB = bot.team === TEAM.CT ? ci++ : ti++;
      const sp = spawns[idxB % spawns.length].clone();
      const loadout = this._botLoadout(bot, isPistol);
      const giveBomb = bot === carrier;
      bot.spawn(sp, loadout.weapon, loadout.armor, loadout.helmet, giveBomb, loadout.defuse);
      bot.money = loadout.moneyLeft;
    }

    // HUD
    this.hud.setScore(s.scoreCT, s.scoreT);
    this.hud.showCenter(`ROUND ${s.roundNum}`, isPistol ? "Pistol Round" : "Buy phase", 2.5, "#d7c07a");
    this._updateHUDStatic();

    // auto-open buy menu during freeze
    if (this.input.locked || first) setTimeout(() => { if (this.state.phase === "buy") this.showBuyIfPossible(); }, 300);
  }

  showBuyIfPossible() {
    if (this.canBuy()) { this.hud.showBuyMenu(); this.input.exitLock(); }
  }

  _refillAmmo() {
    const inv = this.controller.inv;
    if (inv.primary) { const w = WEAPONS[inv.primary.key]; inv.primary.clip = w.mag; inv.primary.reserve = w.reserve; }
    const wp = WEAPONS[inv.pistol.key];
    inv.pistol.clip = wp.mag; inv.pistol.reserve = wp.reserve;
  }

  _botLoadout(bot, isPistol) {
    const money = bot.money || ECON.start;
    let weapon, armor = 0, helmet = false, defuse = false, cost = 0;
    const isCT = bot.team === TEAM.CT;
    if (isPistol || money < 1000) {
      weapon = isCT ? "usp" : "glock";
      if (money >= 650) { armor = 100; cost += 650; }
    } else if (money < 2700) {
      const smgs = isCT ? ["mp9", "mp7", "ump"] : ["mac10", "mp7", "ump"];
      weapon = smgs[Math.floor(Math.random() * smgs.length)];
      armor = 100; helmet = money > 2500; cost += 1000;
    } else {
      const r = Math.random();
      if (isCT) weapon = r < 0.25 ? "awp" : r < 0.7 ? "m4a4" : "m4a1s";
      else weapon = r < 0.25 ? "awp" : "ak47";
      armor = 100; helmet = true; cost += 1000;
      if (isCT && money > 4000 && Math.random() < 0.5) defuse = true;
    }
    return { weapon, armor, helmet, defuse, moneyLeft: Math.max(0, money - cost) };
  }

  _awardRoundStartMoney() {
    // handled at endRound via loss/win; here just ensure caps
    for (const c of this._combatants()) c.money = Math.min(ECON.maxMoney, c.money);
  }

  _updateRound(dt, now) {
    const s = this.state;
    if (s.phase === "buy") {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.phase = "live";
        s.timer = TIMING.roundTime;
        this.frozen = false;
        if (this.hud.buyOpen) {
          this.hud.hideBuyMenu();
          if (!this.input.locked) document.getElementById("pause-screen").classList.remove("hidden");
        }
        this.hud.setPhase("");
        this.audio.buy();
      } else {
        this.hud.setPhase(`Freeze time — buy now (B)`);
      }
    } else if (s.phase === "live") {
      if (this.bomb.planted) {
        this.bomb.timer -= dt;
        // beeping
        const fast = this.bomb.timer < 10;
        if (Math.floor(this.bomb.timer * (fast ? 2 : 1)) !== this._lastBombBeep) {
          this._lastBombBeep = Math.floor(this.bomb.timer * (fast ? 2 : 1));
          this.audio.bombBeep(fast);
        }
        if (this.bomb.timer <= 0) this._bombExplode();
      } else {
        s.timer -= dt;
        if (s.timer <= 0) {
          // time up -> CT win (defenders)
          this.endRound(TEAM.CT, "Time expired");
        }
      }
      // buy availability messaging
      const buyWindow = (now - this.roundStartClock) < (TIMING.freezeTime + TIMING.buyTime);
      if (!buyWindow && this.hud.buyOpen) {
        this.hud.hideBuyMenu();
        if (!this.input.locked) document.getElementById("pause-screen").classList.remove("hidden");
      }
    } else if (s.phase === "ended") {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.roundNum++;
        if (s.scoreCT >= MAX_SCORE || s.scoreT >= MAX_SCORE) { this._matchOver(); return; }
        this.startRound(false);
      }
    }
  }

  _bombExplode() {
    this.audio.explosion();
    this._explosionFX(this.bomb.pos, 0xff5522);
    // kill nearby
    for (const c of this._combatants()) {
      if (!c.alive) continue;
      const d = c.pos.distanceTo(this.bomb.pos);
      if (d < 12) {
        const dmg = d < 6 ? 500 : Math.round(300 * (1 - d / 12));
        if (c.isPlayer) { c.health -= dmg; if (c.health <= 0) { c.health = 0; this.onDeath(c, null, { name: "C4", killType: "hegrenade" }, "chest"); } }
        else { if (c.takeDamage({ health: dmg, armor: 0 })) c.die(); }
      }
    }
    this.endRound(TEAM.T, "Bomb detonated");
  }

  _checkRoundEnd() {
    if (this.state.phase !== "live") return;
    const tAlive = this._combatants().filter((c) => c.team === TEAM.T && c.alive).length;
    const ctAlive = this._combatants().filter((c) => c.team === TEAM.CT && c.alive).length;
    if (ctAlive === 0) { this.endRound(TEAM.T, "Terrorists eliminated the CTs"); return; }
    if (tAlive === 0 && !this.bomb.planted) { this.endRound(TEAM.CT, "Counter-Terrorists eliminated the Ts"); return; }
    // if all T dead but bomb planted, round continues (bomb can still explode)
  }

  endRound(winner, reason) {
    if (this.state.phase === "ended") return;
    const s = this.state;
    s.phase = "ended";
    s.timer = TIMING.postRound;
    s.winner = winner; s.reason = reason;
    if (winner === TEAM.CT) s.scoreCT++; else s.scoreT++;
    this.hud.setScore(s.scoreCT, s.scoreT);

    // economy: win/loss
    const loser = winner === TEAM.CT ? TEAM.T : TEAM.CT;
    s.lossStreak[loser] = Math.min(5, s.lossStreak[loser] + 1);
    s.lossStreak[winner] = Math.max(0, s.lossStreak[winner] - 1);
    const lossBonus = Math.min(ECON.loseMax, ECON.loseBase + (s.lossStreak[loser] - 1) * ECON.loseStep);
    for (const c of this._combatants()) {
      if (c.team === winner) c.money = Math.min(ECON.maxMoney, c.money + ECON.winRound);
      else {
        let bonus = lossBonus;
        if (c.team === TEAM.T && this.bomb.site) bonus += 800; // planted bonus
        c.money = Math.min(ECON.maxMoney, c.money + bonus);
      }
    }
    // player survived?
    this.player.survived = this.player.alive;

    // freeze everyone
    this.frozen = true;

    const won = winner === this.player.team;
    if (won) this.audio.win(); else this.audio.lose();
    this.hud.showCenter(
      won ? "ROUND WON" : "ROUND LOST",
      reason, TIMING.postRound, won ? "#8fe06b" : "#ff6b6b"
    );
    this.hud.setMoney(this.player.money, true);
  }

  _matchOver() {
    const s = this.state;
    const won = s.scoreCT >= MAX_SCORE ? this.player.team === TEAM.CT : this.player.team === TEAM.T;
    this.frozen = true;
    this.hud.showCenter(won ? "VICTORY" : "DEFEAT", `${s.scoreCT} : ${s.scoreT}  —  refresh to play again`, 0, won ? "#8fe06b" : "#ff6b6b");
    this.input.exitLock();
  }

  // ============================================================
  //  Buy
  // ============================================================
  canBuy() {
    if (!this.player.alive) return false;
    const s = this.state;
    const inWindow = s.phase === "buy" || (s.phase === "live" && (this.nowSec - this.roundStartClock) < (TIMING.freezeTime + TIMING.buyTime));
    if (!inWindow) return false;
    // in own spawn buy zone
    const z = this.player.pos.z;
    if (this.player.team === TEAM.T && z < 24) return false;
    if (this.player.team === TEAM.CT && z > -24) return false;
    return true;
  }

  toggleBuyMenu() {
    if (this.hud.buyOpen) {
      this.hud.hideBuyMenu();
      if (this.started && this.player.alive) this.input.requestLock();
    } else {
      if (!this.canBuy()) { this.hud.showCenter("Cannot buy now", "Return to spawn during buy time", 1.5, "#ff9955"); return; }
      this.hud.showBuyMenu();
      this.input.exitLock();
    }
  }

  buyItem(key, type, price) {
    if (!this.canBuy()) return;
    if (this.player.money < price) { this.hud.showCenter("Not enough money", "", 1, "#ff9955"); return; }
    if (this._owns(key)) return;

    if (type === "weapon") {
      this.controller.giveWeapon(key);
      this.player.money -= price;
    } else if (type === "grenade") {
      if (!this.controller.giveGrenade(key)) return;
      this.player.money -= price;
    } else if (type === "gear") {
      if (key === "kevlar") { this.player.armor = 100; this.player.helmet = false; }
      else if (key === "kevlarhelmet") { this.player.armor = 100; this.player.helmet = true; }
      else if (key === "defuse") { this.player.hasDefuse = true; }
      this.player.money -= price;
    }
    this.audio.buy();
    this.hud.setMoney(this.player.money, true);
    this.hud.renderBuyItems();
    this.hud.setWeaponSlots(this.controller.inv);
  }

  // ============================================================
  //  Scope / FOV
  // ============================================================
  onScope(level, weapon) {
    let fov = this.baseFOV;
    if (level > 0 && weapon) {
      if (weapon.sniper && weapon.zoom) fov = weapon.zoom[Math.min(level - 1, weapon.zoom.length - 1)];
      else if (weapon.scoped) fov = 55;
    }
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.aimScale = fov / this.baseFOV;
    this.hud.setScope(level);
  }

  // ============================================================
  //  Sound helpers
  // ============================================================
  playLocalSound(name, weapon) {
    switch (name) {
      case "shoot": this.audio.gunshot(weapon, 0); break;
      case "reload": this.audio.reload(); break;
      case "empty": this.audio.empty(); break;
      case "knife": this.audio.knife(); break;
      case "throw": this.audio.footstep(0); break;
    }
  }
  playWorldSound(name, weapon, pos) {
    const d = pos ? this.player.pos.distanceTo(pos) : 0;
    if (name === "shoot") this.audio.gunshot(weapon, d);
  }

  // ============================================================
  //  Scoreboard
  // ============================================================
  showScoreboard() {
    const players = this._combatants().map((c) => ({
      name: c.name, team: c.team, kills: c.kills || 0, deaths: c.deaths || 0,
      money: c.money || 0, alive: c.alive, you: c.isPlayer,
    }));
    players.sort((a, b) => b.kills - a.kills);
    this.hud.showScoreboard(players, this.state.scoreCT, this.state.scoreT);
  }

  // ============================================================
  //  HUD update
  // ============================================================
  _updateHUD() {
    const s = this.state;
    // timer
    if (s.phase === "live" && this.bomb.planted) this.hud.setRoundTimer(this.bomb.timer);
    else this.hud.setRoundTimer(s.timer);

    this.hud.setHealth(this.player.health);
    this.hud.setArmor(this.player.armor);

    const w = this.controller.currentWeapon();
    const inv = this.controller.inv;
    if (inv.current === "grenade") {
      const gk = this.controller.currentGrenade();
      this.hud.setWeaponName(gk ? GRENADES[gk].name : "");
      this.hud.setAmmo(inv.grenades.filter((g) => g === gk).length, 0, false);
    } else if (inv.current === "c4") {
      this.hud.setWeaponName("C4 Explosive");
      this.hud.setAmmo(0, 0, false);
    } else if (w) {
      this.hud.setWeaponName(w.name);
      const e = this.controller.currentEntry();
      const isGun = w.cat !== "melee";
      this.hud.setAmmo(e && e.clip !== undefined ? e.clip : "", e && e.reserve !== undefined ? e.reserve : "", isGun);
    }

    // crosshair dynamic gap
    if (w && w.cat !== "melee") {
      const inacc = this.controller.getInaccuracy(w);
      this.hud.setCrosshairGap(3 + inacc * 900);
    } else this.hud.setCrosshairGap(6);

    // radar
    const visibleEnemies = this.bots.filter((b) => b.alive && b.team !== this.player.team && this._playerCanSee(b));
    this.hud.renderRadar(this.map, this.player, this.bots, this.bomb, visibleEnemies);

    // bomb timer text for player when planted
    if (this.bomb.planted && !this.bomb.defusing && !this.bomb.planting) {
      this.hud.setBombStatus(`BOMB PLANTED  ${Math.ceil(this.bomb.timer)}s`, true);
    }
  }

  _updateHUDStatic() {
    this.hud.setWeaponSlots(this.controller.inv);
    this.hud.setMoney(this.player.money, false);
  }

  _playerCanSee(bot) {
    const from = this.player.eyePosition, to = bot.eyePos;
    if (from.distanceTo(to) > 70) return false;
    if (segmentBlocked(this.map.colliders, from.x, from.z, to.x, to.z, 0.2)) return false;
    // within fov-ish or close
    return true;
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// default inventory helper (kept here to avoid circular import churn)
function createDefaultInv(team) {
  return {
    knife: { key: "knife" },
    pistol: {
      key: team === TEAM.T ? "glock" : "usp",
      clip: team === TEAM.T ? 20 : 12,
      reserve: team === TEAM.T ? 120 : 24,
    },
    primary: null, grenades: [], c4: false, hasDefuse: false,
    current: "pistol", grenadeIndex: 0,
  };
}
