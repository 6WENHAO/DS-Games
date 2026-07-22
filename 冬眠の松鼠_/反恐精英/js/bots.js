// ============================================================
//  bots.js  -  AI combatants (both teams). Navigation via the
//  map nav-graph, line-of-sight target acquisition, and a
//  reaction/accuracy-based firing model.
// ============================================================
import * as THREE from "three";
import { WEAPONS, TEAM, PHYS } from "./config.js";
import { segmentBlocked, findPath } from "./map.js";

let BOT_ID = 1;

export class Bot {
  constructor(scene, map, team, name, diff) {
    this.scene = scene;
    this.map = map;
    this.team = team;
    this.name = name;
    this.diff = diff;
    this.id = BOT_ID++;
    this.isBot = true;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.alive = false;
    this.health = 100;
    this.armor = 0;
    this.helmet = false;
    this.weaponKey = "ak47";
    this.clip = 30;
    this.reserve = 90;

    this.kills = 0; this.deaths = 0; this.money = 800;
    this.hasBomb = false;
    this.hasDefuse = false;

    this.state = "roam";
    this.target = null;
    this.path = [];
    this.pathIdx = 0;
    this.goal = new THREE.Vector3();
    this.repathAt = 0;
    this.reactionAt = 0;
    this.lastFire = 0;
    this.reloadEnd = 0;
    this.reloading = false;
    this.strafeDir = 1;
    this.strafeChangeAt = 0;
    this.assignedSite = Math.random() < 0.5 ? "A" : "B";
    this.aimYaw = 0; this.aimPitch = 0;

    this._buildModel();
  }

  _buildModel() {
    const g = new THREE.Group();
    const color = this.team === TEAM.CT ? 0x3a6ea5 : 0xb08040;
    const skin = new THREE.MeshLambertMaterial({ color });
    const dark = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xd8b38a });

    // legs
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.35), dark);
    legs.position.y = 0.42; legs.userData = { bot: this, hitgroup: "leg" };
    // stomach
    const stomach = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.35, 0.34), skin);
    stomach.position.y = 1.02; stomach.userData = { bot: this, hitgroup: "stomach" };
    // chest
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.36), skin);
    chest.position.y = 1.42; chest.userData = { bot: this, hitgroup: "chest" };
    // arms
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), skin);
    armL.position.set(-0.33, 1.4, 0); armL.userData = { bot: this, hitgroup: "arm" };
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), skin);
    armR.position.set(0.33, 1.4, 0); armR.userData = { bot: this, hitgroup: "arm" };
    // head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), headMat);
    head.position.y = 1.78; head.userData = { bot: this, hitgroup: "head" };
    // gun stub
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), dark);
    gun.position.set(0.28, 1.42, -0.25);

    [legs, stomach, chest, armL, armR, head, gun].forEach((m) => {
      m.castShadow = true; g.add(m);
    });
    this.model = g;
    this.hitMeshes = [legs, stomach, chest, armL, armR, head];
    this.head = head; this.gunMesh = gun;

    // name tag
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    this._nameCanvas = canvas;
    this._nameTex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: this._nameTex, depthTest: true, transparent: true });
    this.nameSprite = new THREE.Sprite(spriteMat);
    this.nameSprite.scale.set(2.4, 0.6, 1);
    this.nameSprite.position.y = 2.15;
    g.add(this.nameSprite);
    this._drawName(100, 100);

    this.scene.add(g);
    g.visible = false;
  }

  _drawName(hp, maxhp) {
    const c = this._nameCanvas, g = c.getContext("2d");
    g.clearRect(0, 0, 256, 64);
    g.font = "bold 26px Segoe UI"; g.textAlign = "center";
    g.fillStyle = this.team === TEAM.CT ? "#8fc0ff" : "#ffcf7a";
    g.strokeStyle = "#000"; g.lineWidth = 4;
    g.strokeText(this.name, 128, 26); g.fillText(this.name, 128, 26);
    // health bar
    g.fillStyle = "#000"; g.fillRect(63, 40, 130, 10);
    const frac = Math.max(0, hp / maxhp);
    g.fillStyle = frac > 0.5 ? "#7ee06b" : frac > 0.25 ? "#e0c14b" : "#e05050";
    g.fillRect(64, 41, 128 * frac, 8);
    this._nameTex.needsUpdate = true;
  }

  get eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z);
  }

  spawn(pos, weaponKey, armor, helmet, hasBomb, hasDefuse) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.alive = true;
    this.health = this.diff.hp;
    this.armor = armor || 0;
    this.helmet = !!helmet;
    this.weaponKey = weaponKey;
    const w = WEAPONS[weaponKey];
    this.clip = w.mag; this.reserve = w.reserve;
    this.hasBomb = !!hasBomb;
    this.hasDefuse = !!hasDefuse;
    this.state = "roam";
    this.target = null;
    this.path = []; this.pathIdx = 0;
    this.reloading = false;
    this.plantProg = 0;
    this.defuseProg = 0;
    this.blindUntil = 0;
    this.wanderGoal = null;
    this.yaw = this.team === TEAM.T ? Math.PI : 0;
    this.assignedSite = Math.random() < 0.5 ? "A" : "B";
    this.model.visible = true;
    this._drawName(this.health, this.diff.hp);
    this._syncModel();
  }

  die() {
    this.alive = false;
    this.model.visible = false;
    this.hasBomb = false;
  }

  _syncModel() {
    this.model.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.model.rotation.y = this.yaw;
    // face the camera-ish for nametag handled by sprite automatically
  }

  // ---- movement with collision (per axis slide) ----
  _move(dx, dz) {
    const r = PHYS.radius + 0.05;
    this.pos.x += dx;
    for (const c of this.map.colliders) {
      if (this.pos.x - r < c.maxX && this.pos.x + r > c.minX &&
          this.pos.z - r < c.maxZ && this.pos.z + r > c.minZ &&
          c.maxY > 0.4) {
        this.pos.x = dx > 0 ? c.minX - r : c.maxX + r;
      }
    }
    this.pos.z += dz;
    for (const c of this.map.colliders) {
      if (this.pos.x - r < c.maxX && this.pos.x + r > c.minX &&
          this.pos.z - r < c.maxZ && this.pos.z + r > c.minZ &&
          c.maxY > 0.4) {
        this.pos.z = dz > 0 ? c.minZ - r : c.maxZ + r;
      }
    }
    const b = this.map.bounds;
    this.pos.x = Math.max(b.minX + 1, Math.min(b.maxX - 1, this.pos.x));
    this.pos.z = Math.max(b.minZ + 1, Math.min(b.maxZ - 1, this.pos.z));
  }

  canSee(entity, ctx) {
    const from = this.eyePos, to = entity.isPlayer ? entity.eyePosition : entity.eyePos;
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    if (d > 60) return false;
    if (segmentBlocked(this.map.colliders, from.x, from.z, to.x, to.z, 0.2)) return false;
    if (ctx && ctx.smokeBlocked && ctx.smokeBlocked(from, to)) return false;
    return true;
  }

  update(dt, ctx) {
    if (!this.alive) return;
    const now = ctx.now;

    // reload finish
    if (this.reloading && now >= this.reloadEnd) {
      const w = WEAPONS[this.weaponKey];
      const need = w.mag - this.clip;
      const take = Math.min(need, this.reserve);
      this.clip += take; this.reserve -= take;
      this.reloading = false;
    }

    // acquire target: nearest visible enemy
    let best = null, bestD = Infinity;
    for (const e of ctx.enemies) {
      if (!e.alive) continue;
      if (this.canSee(e, ctx)) {
        const to = e.isPlayer ? e.eyePosition : e.eyePos;
        const d = this.pos.distanceTo(to);
        if (d < bestD) { bestD = d; best = e; }
      }
    }

    if (best) {
      if (this.target !== best) {
        this.target = best;
        this.reactionAt = now + this.diff.reaction * (0.6 + Math.random() * 0.8);
      }
      this.state = "combat";
    } else {
      if (this.state === "combat") { this.state = "roam"; this.target = null; }
    }

    if (this.state === "combat" && this.target && this.target.alive) {
      this._combat(dt, ctx, now);
    } else {
      // ---- objective: plant / defuse ----
      if (this.team === TEAM.T && this.hasBomb && !ctx.bomb.planted && ctx.inBombsite(this.pos)) {
        this.vel.set(0, 0, 0);
        if (ctx.botPlant(this, dt)) { this._syncModel(); return; }
      }
      if (this.team === TEAM.CT && ctx.bomb.planted && this.pos.distanceTo(ctx.bomb.pos) < 2.0) {
        this.vel.set(0, 0, 0);
        if (ctx.botDefuse(this, dt)) { this._syncModel(); return; }
      }
      this._roam(dt, ctx, now);
    }

    this._syncModel();
  }

  _combat(dt, ctx, now) {
    const t = this.target;
    const tp = t.isPlayer ? t.eyePosition : t.eyePos;
    const from = this.eyePos;
    const dx = tp.x - from.x, dy = tp.y - from.y, dz = tp.z - from.z;
    const dist = Math.hypot(dx, dz);

    // face target
    const desiredYaw = Math.atan2(-dx, -dz);
    this.yaw = lerpAngle(this.yaw, desiredYaw, Math.min(1, dt * 10));

    // strafe a little
    if (now > this.strafeChangeAt) {
      this.strafeChangeAt = now + 0.5 + Math.random();
      this.strafeDir = Math.random() < 0.5 ? -1 : (Math.random() < 0.5 ? 1 : 0);
    }
    const aggr = this.diff.aggression;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let mvx = 0, mvz = 0;
    // keep preferred range
    const w = WEAPONS[this.weaponKey];
    const speed = (w.moveSpeed || 6) * (w.sniper ? 0.4 : 0.55);
    if (dist > 22 && aggr > 0.4) { mvx += forward.x; mvz += forward.z; }
    else if (dist < 6) { mvx -= forward.x; mvz -= forward.z; }
    mvx += right.x * this.strafeDir * 0.7;
    mvz += right.z * this.strafeDir * 0.7;
    const ml = Math.hypot(mvx, mvz);
    if (ml > 0) { this._move((mvx / ml) * speed * dt, (mvz / ml) * speed * dt); }

    // fire control
    if (now < this.reactionAt) return;
    if (now < (this.blindUntil || 0)) return;
    if (this.reloading) return;
    if (this.clip <= 0) {
      if (this.reserve > 0) { this.reloading = true; this.reloadEnd = now + w.reload; }
      return;
    }
    // only fire if roughly facing
    const facing = Math.cos(angleDiff(this.yaw, Math.atan2(-dx, -dz)));
    if (facing < 0.9) return;

    const interval = 60 / w.rpm * (w.auto ? 1 : 1.15);
    if (now - this.lastFire < interval) return;
    this.lastFire = now;
    this.clip--;

    // hit calculation
    const moveFrac = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 6);
    let hitChance = this.diff.accuracy;
    hitChance *= 1 - Math.min(0.6, dist / 100);       // distance
    if (t.isPlayer && !t.onGround) hitChance *= 0.7;
    if (dist < 10) hitChance = Math.min(0.98, hitChance + 0.15);
    hitChance = Math.max(0.05, hitChance);

    ctx.spawnTracer(this._muzzlePos(), tp, this.team);
    ctx.playSound("shoot", w, this.pos);

    if (Math.random() < hitChance) {
      // pick hitgroup
      const roll = Math.random();
      let hg = "chest";
      const hsChance = 0.12 + this.diff.accuracy * 0.2;
      if (roll < hsChance) hg = "head";
      else if (roll < hsChance + 0.15) hg = "stomach";
      else if (roll < hsChance + 0.35) hg = "leg";
      else hg = "chest";
      ctx.dealDamage(t, w, hg, dist, this);
    }
  }

  _muzzlePos() {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return new THREE.Vector3(this.pos.x + f.x * 0.5, this.pos.y + 1.5, this.pos.z + f.z * 0.5);
  }

  _roam(dt, ctx, now) {
    // choose goal
    let goal;
    if (ctx.bomb.planted) {
      goal = ctx.bomb.pos;
    } else if (this.hasBomb) {
      goal = ctx.sites[this.assignedSite].center;
    } else {
      // patrol: pick a point of interest and move to it, then re-pick
      if (!this.wanderGoal || this.pos.distanceTo(this.wanderGoal) < 3.5) {
        const pts = ctx.patrolPoints;
        this.wanderGoal = pts[Math.floor(Math.random() * pts.length)];
        this.path = [];
      }
      goal = this.wanderGoal;
    }

    if (now > this.repathAt || this.path.length === 0) {
      this.repathAt = now + 1.0 + Math.random();
      this.path = findPath(this.map.nav, this.pos, goal);
      this.pathIdx = 0;
    }

    const w = WEAPONS[this.weaponKey];
    const speed = (w.moveSpeed || 6) * 0.7;
    if (this.path && this.path.length) {
      let wp = this.path[this.pathIdx];
      while (wp && Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 1.6) {
        this.pathIdx++;
        wp = this.path[this.pathIdx];
      }
      if (wp) {
        const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        this.yaw = lerpAngle(this.yaw, Math.atan2(-dx, -dz), Math.min(1, dt * 6));
        this._move((dx / l) * speed * dt, (dz / l) * speed * dt);
        this.vel.set((dx / l) * speed, 0, (dz / l) * speed);
      } else {
        this.vel.set(0, 0, 0);
      }
    }
  }

  takeDamage(dmg) {
    // dmg {health, armor}
    if (this.armor > 0 && dmg.armor) this.armor = Math.max(0, this.armor - dmg.armor);
    this.health -= dmg.health;
    this._drawName(this.health, this.diff.hp);
    if (this.health <= 0) { this.health = 0; return true; }
    return false;
  }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
