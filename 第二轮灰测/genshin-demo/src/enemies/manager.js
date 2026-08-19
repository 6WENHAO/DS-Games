// EnemyManager (CONTRACT 2.8): spawning, camps, sleep culling, attack-token
// throttling, projectile pool and the combat-music aggro signal.
import * as THREE from 'three';
import { clamp, makeRNG, TAU } from '../core/utils.js';
import { height as worldHeight, findFlatSpot } from '../world/heightfield.js';
import { elementHex, sphereGeo, torusGeo, capsuleGeo } from './rigid.js';
import { Slime } from './slime.js';
import { Hilichurl } from './hilichurl.js';
import { Mitachurl } from './mitachurl.js';
import { RuinGuard } from './ruinguard.js';
import { Whopperflower } from './whopperflower.js';
import { DvalinBoss } from './boss.js';
import { makeGlowTexture } from '../core/textures.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const FWD = new THREE.Vector3(0, 0, 1);

// -------------------------------------------------------------- projectiles
let _projRes = null;
function projResources() {
  if (_projRes) return _projRes;
  const arrow = (() => {
    const g = [];
    const shaft = new THREE.CylinderGeometry(0.011, 0.011, 0.72, 6);
    shaft.rotateX(Math.PI / 2);
    g.push(shaft);
    const tip = new THREE.ConeGeometry(0.028, 0.11, 7);
    tip.rotateX(Math.PI / 2); tip.translate(0, 0, 0.4);
    g.push(tip);
    const f1 = new THREE.BoxGeometry(0.005, 0.06, 0.12); f1.translate(0, 0.03, -0.3);
    const f2 = new THREE.BoxGeometry(0.06, 0.005, 0.12); f2.translate(0.03, 0, -0.3);
    g.push(f1, f2);
    const merged = mergeSimple(g);
    return merged;
  })();
  const missile = (() => {
    const body = new THREE.CapsuleGeometry(0.11, 0.28, 4, 10);
    body.rotateX(Math.PI / 2);
    const fin = new THREE.BoxGeometry(0.02, 0.16, 0.14); fin.translate(0, 0.11, -0.2);
    const fin2 = new THREE.BoxGeometry(0.16, 0.02, 0.14); fin2.translate(0.11, 0, -0.2);
    return mergeSimple([body, fin, fin2]);
  })();
  const bullet = sphereGeo(0.17, 12, 9);
  const blade = (() => {
    const g = new THREE.TorusGeometry(0.55, 0.075, 5, 14, Math.PI * 0.85);
    g.scale(1, 1, 0.28);
    g.rotateY(Math.PI / 2);
    return g;
  })();
  const mat = {
    arrow: new THREE.MeshToonMaterial({ color: 0xb99a63 }),
    missile: new THREE.MeshToonMaterial({ color: 0x9aa0a8, emissive: 0x331100 }),
    bullet: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
    blade: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  };
  const glowMat = new THREE.SpriteMaterial({
    map: makeGlowTexture(64, 2.2), color: 0xffffff, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
  });
  _projRes = { geo: { arrow, missile, bullet, blade }, mat, glowMat };
  return _projRes;
}

function mergeSimple(list) {
  // tiny local merge: all inputs are indexed position/normal/uv geometries
  let total = 0, idxTotal = 0;
  for (const g of list) { total += g.attributes.position.count; idxTotal += g.index ? g.index.count : 0; }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), idx = new Uint16Array(idxTotal);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
      nor[(vo + i) * 3] = n.getX(i); nor[(vo + i) * 3 + 1] = n.getY(i); nor[(vo + i) * 3 + 2] = n.getZ(i);
    }
    const gi = g.index;
    for (let i = 0; i < gi.count; i++) idx[io + i] = gi.getX(i) + vo;
    vo += p.count; io += gi.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

class ProjectilePool {
  constructor(ctx, max = 40) {
    this.ctx = ctx;
    this.max = max;
    this.free = [];
    this.active = [];
    this.fired = 0;
    this.res = projResources();
  }
  _acquire() {
    let o = this.free.pop();
    if (!o) {
      const g = new THREE.Group();
      const mesh = new THREE.Mesh(this.res.geo.bullet, this.res.mat.bullet);
      mesh.castShadow = false;
      const halo = new THREE.Sprite(this.res.glowMat.clone());
      g.add(mesh, halo);
      g.visible = false;
      this.ctx.scene?.add(g);
      o = { obj: g, mesh, halo, vel: new THREE.Vector3(), active: false };
    }
    return o;
  }
  fire(o = {}) {
    if (this.active.length >= this.max) return null;
    const p = this._acquire();
    const kind = o.kind ?? 'bullet';
    p.kind = kind;
    p.mesh.geometry = this.res.geo[kind] ?? this.res.geo.bullet;
    p.mesh.material = this.res.mat[kind] ?? this.res.mat.bullet;
    const hex = o.color ?? (kind === 'arrow' ? 0xffffff : elementHex(o.element));
    if (kind === 'bullet' || kind === 'blade') p.mesh.material = this.res.mat[kind];
    p.mesh.scale.setScalar(o.scale ?? 1);
    p.halo.material.color.set(hex);
    const haloScale = kind === 'arrow' ? 0 : (kind === 'missile' ? 0.7 : (kind === 'blade' ? 1.5 : 1.0)) * (o.scale ?? 1);
    p.halo.scale.setScalar(haloScale);
    p.halo.visible = haloScale > 0;
    p.halo.position.set(0, 0, kind === 'missile' ? -0.25 : 0);
    if (kind === 'bullet' || kind === 'blade') p.mesh.material.color.set(hex);
    p.obj.position.copy(o.pos);
    p.vel.copy(o.dir).normalize().multiplyScalar(o.speed ?? 24);
    p.life = o.life ?? 3;
    p.maxLife = p.life;
    p.gravity = o.gravity ?? 0;
    p.radius = o.radius ?? 0.4;
    p.damage = o.damage ?? 20;
    p.element = o.element ?? 'physical';
    p.knockback = o.knockback ?? 2.4;
    p.poise = o.poise ?? 12;
    p.source = o.source ?? null;
    p.homing = o.homing ?? 0;
    p.spin = o.spin ?? 0;
    p.obj.visible = true;
    p.obj.rotation.set(0, 0, 0);
    p.active = true;
    if (o.trail !== false && this.ctx.fx3d?.trail) {
      p.trail = this.ctx.fx3d.trail(p.obj, { color: hex, width: kind === 'arrow' ? 0.06 : 0.18, life: 0.25 });
    } else p.trail = null;
    this.active.push(p);
    this.fired++;
    return p;
  }
  _release(p) {
    p.active = false;
    p.obj.visible = false;
    p.trail?.stop?.();
    p.trail = null;
    const i = this.active.indexOf(p);
    if (i >= 0) this.active.splice(i, 1);
    this.free.push(p);
  }
  _target() {
    const pl = this.ctx.player;
    if (pl && pl.alive !== false) return pl;
    const h = this.ctx.hero;
    if (h) return { root: h, position: h.position, hitRadius: 0.4, hitHeight: 1.8 };
    return null;
  }
  update(dt) {
    const ctx = this.ctx;
    const target = this._target();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) { this._release(p); continue; }
      if (p.homing > 0 && target) {
        if (target.center) target.center(_v); else _v.copy(target.position);
        _v.sub(p.obj.position);
        if (_v.lengthSq() > 0.01) {
          _v.normalize().multiplyScalar(p.vel.length());
          p.vel.lerp(_v, clamp(p.homing * dt, 0, 1));
        }
      }
      if (p.gravity) p.vel.y -= p.gravity * dt;
      p.obj.position.addScaledVector(p.vel, dt);
      if (p.spin) p.obj.rotateZ(p.spin * dt);
      else {
        _v.copy(p.vel);
        if (_v.lengthSq() > 1e-6) {
          _q.setFromUnitVectors(FWD, _v.normalize());
          p.obj.quaternion.copy(_q);
        }
      }
      // player hit
      if (target) {
        if (target.center) target.center(_v); else _v.copy(target.position);
        const reach = p.radius + (target.hitRadius ?? 0.5);
        if (_v.distanceToSquared(p.obj.position) < reach * reach) { this._impact(p, target); continue; }
      }
      // ground / water
      const gy = ctx.terrain?.heightAt ? ctx.terrain.heightAt(p.obj.position.x, p.obj.position.z) : worldHeight(p.obj.position.x, p.obj.position.z);
      if (p.obj.position.y <= gy + 0.05) { this._impact(p, null); continue; }
    }
  }
  _impact(p, hit) {
    const ctx = this.ctx;
    const pos = p.obj.position.clone();
    const dir = p.vel.clone().normalize();
    if (hit) {
      if (ctx.combat?.strike) {
        ctx.combat.strike({
          origin: pos, dir, shape: 'sphere', radius: Math.max(0.6, p.radius), team: 'enemy',
          damage: Math.round(p.damage), element: p.element, poise: p.poise,
          knockback: p.knockback, hitstop: 0.05, source: p.source, once: true,
        });
      } else if (hit.takeDamage) {
        hit.takeDamage({ amount: Math.round(p.damage), element: p.element, dir, source: p.source, knockback: p.knockback, poise: p.poise });
        ctx.events?.emit?.('combat:hit', { target: hit, info: { damage: p.damage, element: p.element } });
      }
      ctx.fx3d?.hitSpark?.(pos, elementHex(p.element), 1.1);
    } else {
      ctx.fx3d?.dust?.(pos, 5, 0xb4a488);
      if (p.kind !== 'arrow') ctx.fx3d?.burst?.(pos, p.element, 0.5);
    }
    this._release(p);
  }
  clear() { for (let i = this.active.length - 1; i >= 0; i--) this._release(this.active[i]); }
}

// -------------------------------------------------------------- registry
const TYPES = {
  slime_water: (ctx, o) => new Slime(ctx, { ...o, element: 'hydro', type: 'slime_water' }),
  slime_fire: (ctx, o) => new Slime(ctx, { ...o, element: 'pyro', type: 'slime_fire' }),
  slime_electro: (ctx, o) => new Slime(ctx, { ...o, element: 'electro', type: 'slime_electro' }),
  slime_cryo: (ctx, o) => new Slime(ctx, { ...o, element: 'cryo', type: 'slime_cryo' }),
  hilichurl: (ctx, o) => new Hilichurl(ctx, { ...o, variant: 'club' }),
  hilichurl_archer: (ctx, o) => new Hilichurl(ctx, { ...o, variant: 'archer' }),
  hilichurl_shield: (ctx, o) => new Hilichurl(ctx, { ...o, variant: 'shield' }),
  mitachurl: (ctx, o) => new Mitachurl(ctx, o),
  ruinguard: (ctx, o) => new RuinGuard(ctx, o),
  whopperflower: (ctx, o) => new Whopperflower(ctx, o),
  boss_dvalin: (ctx, o) => new DvalinBoss(ctx, o),
};

export const ENEMY_TYPES = Object.keys(TYPES);

export class EnemyManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.enemies = [];
    this.aggroCount = 0;
    this.boss = null;
    /** CONTRACT: true while a living boss exists (integrator switches to boss music). */
    this.bossActive = false;
    this.rng = makeRNG(0x5eed11);
    this.maxConcurrentAttacks = 2;
    this._tokens = new Set();
    this.projectiles = new ProjectilePool(ctx);
    this.showHpBars = true;
    /** Set true to let the manager drive ctx.audio.music directly. */
    this.driveMusic = false;
    this._inCombat = false;
    this._combatCooldown = 0;
    this._campSeq = 0;
    this._propagating = false;

    this._offAggro = ctx.events?.on?.('enemy:aggro', (p) => this._propagateAggro(p?.enemy));
  }

  // ------------------------------------------------------------ spawning
  spawn(type, pos, opts = {}) {
    const make = TYPES[type];
    if (!make) { console.warn('[enemies] unknown type', type); return null; }
    const p = pos ?? { x: 0, y: 0, z: 0 };
    const e = make(this.ctx, { ...opts, pos: null });
    e.manager = this;
    const y = p.y != null && opts.snap === false ? p.y : e.groundY(p.x, p.z);
    e.setPosition(p.x, p.z, opts.snap === false ? p.y : y);
    if (opts.yaw != null) { e.yaw = opts.yaw; e.yawTarget = opts.yaw; }
    else { const a = this.rng() * TAU; e.yaw = a; e.yawTarget = a; }
    e.campId = opts.campId ?? null;
    e.level = opts.level ?? e.level;
    this.enemies.push(e);
    if (e.isBoss) { this.boss = e; this.bossActive = true; }
    this.ctx.events?.emit?.('enemy:spawned', { enemy: e, type });
    return e;
  }

  /** Scatter a camp of monsters on walkable ground. */
  spawnCamp(type, center, count = 3, radius = 8, opts = {}) {
    const campId = 'camp' + (++this._campSeq);
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + this.rng() * 0.7;
      const r = radius * (0.35 + 0.65 * Math.sqrt(this.rng()));
      const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      const spot = findFlatSpot(x, z, this.rng, Math.max(2, radius * 0.3), 8);
      const e = this.spawn(type, spot, { ...opts, campId });
      if (e) { e.home.set(spot.x, spot.y, spot.z); out.push(e); }
    }
    return out;
  }

  _propagateAggro(src) {
    if (!src || this._propagating) return;
    this._propagating = true;
    try {
      for (const e of this.enemies) {
        if (e === src || !e.alive || e.aggro) continue;
        if (e.state === 'hidden' || e.state === 'dead') continue;
        const sameCamp = src.campId && e.campId === src.campId;
        const d = e.pos.distanceTo(src.pos);
        if ((sameCamp && d < 26) || d < 11) {
          e._alertFast = true;
          e.target = e._resolveTarget();
          e.setState('alert');
        }
      }
    } finally { this._propagating = false; }
  }

  // ------------------------------------------------------------ attack tokens
  requestAttackToken(e) {
    if (this._tokens.has(e)) return true;
    if (e.isBoss) { this._tokens.add(e); return true; }
    if (this._tokens.size >= this.maxConcurrentAttacks) return false;
    this._tokens.add(e);
    return true;
  }
  releaseAttackToken(e) { this._tokens.delete(e); }

  // ------------------------------------------------------------ queries
  nearest(pos, maxDist = 30, filter = null) {
    let best = null, bestD = maxDist * maxDist;
    for (const e of this.enemies) {
      if (!e.alive || (filter && !filter(e))) continue;
      const d = e.pos.distanceToSquared(pos);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }
  inRadius(pos, radius, out = []) {
    const r2 = radius * radius;
    for (const e of this.enemies) if (e.alive && e.pos.distanceToSquared(pos) < r2) out.push(e);
    return out;
  }

  spawnProjectile(o) { return this.projectiles.fire(o); }

  remove(e) {
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    this._tokens.delete(e);
    if (this.boss === e) { this.boss = null; this.bossActive = false; this.ctx.ui?.hud?.clearBoss?.(); }
    e.dispose();
  }

  clear() {
    for (const e of this.enemies.slice()) this.remove(e);
    this.projectiles.clear();
  }

  // ------------------------------------------------------------ update
  update(dt) {
    const ctx = this.ctx;
    const ref = ctx.player?.position ?? ctx.hero?.position ?? ctx.camera?.position ?? _v.set(0, 0, 0);
    let aggro = 0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.removed) { this.remove(e); continue; }
      const d = Math.hypot(e.pos.x - ref.x, e.pos.z - ref.z);
      const sleep = d > e.cfg.sleepRange && !e.isBoss;
      if (sleep !== e.asleep) {
        e.asleep = sleep;
        e.root.visible = !sleep;
        if (sleep) { e.hideTelegraph(); e.releaseToken(); if (e._hpBar) e._hpBar.visible = false; if (e._mark) e._mark.visible = false; }
      }
      if (e.asleep) continue;
      try { e.update(dt); } catch (err) { console.error('[enemy]', e.type, err); }
      if (e.aggro && e.alive) aggro++;
    }
    this.aggroCount = aggro;
    this.bossActive = !!(this.boss && this.boss.alive && !this.boss.removed);
    this.projectiles.update(dt);

    // combat-music signal with a short tail so it does not flap
    if (aggro > 0) this._combatCooldown = 3.0;
    else this._combatCooldown = Math.max(0, this._combatCooldown - dt);
    const inCombat = this._combatCooldown > 0;
    if (inCombat !== this._inCombat) {
      this._inCombat = inCombat;
      const bossAlive = !!(this.boss && this.boss.alive);
      ctx.events?.emit?.('enemies:combat', { active: inCombat, count: aggro, boss: bossAlive });
      if (this.driveMusic) {
        if (inCombat) ctx.audio?.music?.(bossAlive ? 'boss' : 'combat', { fade: 1.2 });
        else ctx.audio?.music?.((ctx.sky?.dayFactor ?? 1) > 0.35 ? 'field_day' : 'field_night', { fade: 3 });
      }
    }
  }

  dispose() {
    this._offAggro?.();
    this.clear();
  }
}

export function createEnemyManager(ctx) { return new EnemyManager(ctx); }
