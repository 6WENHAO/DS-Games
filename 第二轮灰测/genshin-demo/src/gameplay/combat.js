// Damage, elemental gauges & reactions, hitboxes, projectiles, hitstop.
import * as THREE from 'three';
import { clamp } from '../core/utils.js';
import { ELEMENT_COLORS } from './fx.js';
import { height } from '../world/heightfield.js';

export const REACTIONS = {
  vaporize: { name: '蒸发', color: '#ffb3a0', mult: 2.0 },
  melt: { name: '融化', color: '#ffd0a0', mult: 2.0 },
  overload: { name: '超载', color: '#ff9a6b', mult: 1.4 },
  electrocharged: { name: '感电', color: '#d3a6ff', mult: 1.3 },
  frozen: { name: '冻结', color: '#b8f0ff', mult: 1.0 },
  superconduct: { name: '超导', color: '#c9d8ff', mult: 1.2 },
  swirl: { name: '扩散', color: '#a8f0d4', mult: 1.25 },
  crystallize: { name: '结晶', color: '#ffdd93', mult: 1.0 },
  burning: { name: '燃烧', color: '#ffa060', mult: 1.2 },
};

const PAIR = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const TABLE = {
  [PAIR('pyro', 'hydro')]: 'vaporize',
  [PAIR('pyro', 'cryo')]: 'melt',
  [PAIR('pyro', 'electro')]: 'overload',
  [PAIR('hydro', 'electro')]: 'electrocharged',
  [PAIR('hydro', 'cryo')]: 'frozen',
  [PAIR('cryo', 'electro')]: 'superconduct',
};

export class Combat {
  constructor(ctx) {
    this.ctx = ctx;
    this.gauges = new WeakMap();   // target -> { element, gauge, t }
    this.hitstopT = 0;
    this.projectiles = [];
    this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
    this.stats = { totalDamage: 0, hits: 0, kills: 0 };
  }

  targets(team) {
    const out = [];
    if (team === 'player') {                       // player attacking -> enemies
      const list = this.ctx.enemies?.enemies;
      if (list) for (const e of list) if (e.alive !== false) out.push(e);
    } else {
      if (this.ctx.player?.alive !== false) out.push(this.ctx.player);
    }
    return out;
  }

  /** Sweep a shape and damage everything inside. */
  strike(def) {
    const {
      origin, dir = new THREE.Vector3(0, 0, 1), shape = 'sphere', radius = 2.2, angle = 110,
      halfExtents, team = 'player', damage = 40, element = 'physical', poise = 20,
      knockback = 2.0, hitstop = 0.06, crit, source, onHit, maxTargets = 8, shake = 0,
    } = def;
    const hits = [];
    const d = this._v2.copy(dir).setY(dir.y * 0.4).normalize();
    for (const t of this.targets(team)) {
      if (!t || t.alive === false) continue;
      const c = t.center ? t.center(this._v) : this._v.copy(t.position ?? t.root.position);
      const to = c.clone().sub(origin);
      const dist = to.length() - (t.hitRadius ?? 0.7);
      if (shape === 'sphere') { if (dist > radius) continue; }
      else if (shape === 'cone') {
        if (dist > radius) continue;
        const flat = to.clone().setY(0).normalize();
        const ang = Math.acos(clamp(flat.dot(new THREE.Vector3(d.x, 0, d.z).normalize()), -1, 1)) * 180 / Math.PI;
        if (ang > angle * 0.5) continue;
      } else if (shape === 'box') {
        const he = halfExtents ?? new THREE.Vector3(1, 1, 2);
        const q = this._tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(d.x, 0, d.z).normalize());
        const local = to.clone().applyQuaternion(q.clone().invert());
        if (Math.abs(local.x) > he.x + (t.hitRadius ?? 0.7) || Math.abs(local.y) > he.y + 1.0 || Math.abs(local.z) > he.z + (t.hitRadius ?? 0.7)) continue;
      }
      const kdir = to.clone().setY(0);
      if (kdir.lengthSq() < 1e-5) kdir.copy(d);
      kdir.normalize();
      const info = this.damage(t, { amount: damage, element, crit, poise, knockback, dir: kdir, source });
      hits.push(t);
      onHit?.(t, info);
      if (hits.length >= maxTargets) break;
    }
    if (hits.length) {
      if (hitstop > 0) this.hitstop(hitstop);
      if (shake > 0) this.ctx.fx3d?.shake(shake, 0.18);
    }
    return hits;
  }

  /** Apply elemental aura, resolve reaction, deal damage, spawn feedback. */
  damage(target, info) {
    if (!target || target.alive === false) return null;
    const ctx = this.ctx;
    let amount = info.amount ?? 0;
    const element = info.element ?? 'physical';
    let reaction = null;

    if (element !== 'physical') {
      reaction = this.applyElement(target, element, info.gauge ?? 1);
      if (reaction) {
        amount *= REACTIONS[reaction]?.mult ?? 1;
        this._reactionFx(target, reaction, element);
      }
    }
    const crit = info.crit ?? (Math.random() < (info.critRate ?? 0.22));
    if (crit) amount *= info.critMult ?? 1.75;
    if (target.frozen) amount *= 1.15;
    amount = Math.max(1, Math.round(amount));

    const out = { ...info, amount, element, crit, reaction };
    const c = target.center ? target.center(new THREE.Vector3()) : new THREE.Vector3().copy(target.position ?? target.root.position);
    try { target.takeDamage?.(out); } catch (e) { console.error('[takeDamage]', e); }

    ctx.fx3d?.damageNumber(c, amount, { crit, element });
    ctx.fx3d?.hitSpark(c, ELEMENT_COLORS[element] ?? 0xffe0a0, crit ? 1.4 : 1);
    ctx.audio?.sfx?.(element === 'physical' ? (target.armored ? 'hit_metal' : 'hit_flesh') : 'hit_flesh', { pos: c, rate: 0.9 + Math.random() * 0.25 });
    if (crit) ctx.audio?.sfx?.('crit', { pos: c });
    this.stats.hits++; this.stats.totalDamage += amount;
    ctx.events.emit('combat:hit', { target, info: out });
    if (info.source === ctx.player || info.source?.isPlayer) ctx.player?.gainEnergy?.(crit ? 3.5 : 2.2);
    return out;
  }

  heal(target, amount) {
    if (!target) return;
    target.hp = Math.min(target.maxHp ?? 100, (target.hp ?? 0) + amount);
    const c = target.center ? target.center(new THREE.Vector3()) : new THREE.Vector3().copy(target.position ?? target.root.position);
    this.ctx.fx3d?.damageNumber(c, amount, { heal: true });
    this.ctx.audio?.sfx?.('heal', { pos: c });
  }

  /** Returns reaction name or null. */
  applyElement(target, element, gauge = 1) {
    const g = this.gauges.get(target);
    const now = this.ctx.time.elapsed;
    if (g && g.gauge > 0 && g.element !== element && now - g.t < 12) {
      const r = TABLE[PAIR(g.element, element)];
      if (element === 'anemo') { this.gauges.set(target, { element: g.element, gauge: g.gauge * 0.5, t: now }); return 'swirl'; }
      if (element === 'geo') { this.gauges.set(target, { element: g.element, gauge: g.gauge * 0.5, t: now }); return 'crystallize'; }
      if (r) {
        this.gauges.set(target, { element, gauge: gauge * 0.4, t: now });
        if (r === 'frozen') { target.frozen = true; target.frozenT = 2.4; }
        if (r === 'overload') {
          const c = target.center ? target.center(new THREE.Vector3()) : target.root.position;
          setTimeout(() => this.strike({ origin: c.clone(), shape: 'sphere', radius: 3.4, team: target.team === 'enemy' ? 'player' : 'enemy',
            damage: 40, element: 'pyro', knockback: 4.5, hitstop: 0.05, shake: 0.5, source: 'overload' }), 60);
        }
        return r;
      }
    }
    if (element !== 'anemo' && element !== 'geo') this.gauges.set(target, { element, gauge, t: now });
    return null;
  }

  reaction(target, element) { return this.applyElement(target, element, 1); }

  _reactionFx(target, reaction, element) {
    const c = target.center ? target.center(new THREE.Vector3()) : new THREE.Vector3().copy(target.root.position);
    const r = REACTIONS[reaction];
    this.ctx.fx3d?.reactionText(c.clone().add(new THREE.Vector3(0, 0.55, 0)), r?.name ?? reaction, r?.color ?? '#fff');
    this.ctx.fx3d?.burst(c, element, 0.55);
    const tint = new THREE.Color(ELEMENT_COLORS[element] ?? 0xffffff);
    const u = this.ctx.fx?.uElement; if (u) { u.value.set(tint.r * 0.12, tint.g * 0.12, tint.b * 0.12); }
  }

  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }

  // ---------------- projectiles ----------------
  spawnProjectile(def) {
    const ctx = this.ctx;
    const color = ELEMENT_COLORS[def.element ?? 'physical'] ?? 0xffffff;
    let mesh = def.mesh;
    if (!mesh) {
      if (!this._arrowGeo) {
        this._arrowGeo = new THREE.ConeGeometry(0.06, 0.55, 6);
        this._arrowGeo.rotateX(Math.PI / 2);
      }
      mesh = new THREE.Mesh(this._arrowGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    }
    mesh.position.copy(def.origin);
    ctx.scene.add(mesh);
    const p = {
      mesh, pos: def.origin.clone(), dir: def.dir.clone().normalize(), speed: def.speed ?? 42,
      damage: def.damage ?? 30, element: def.element ?? 'physical', team: def.team ?? 'player',
      radius: def.radius ?? 0.45, life: def.life ?? 3, gravity: def.gravity ?? 0,
      pierce: def.pierce ?? 0, onHit: def.onHit, source: def.source, hitstop: def.hitstop ?? 0.05,
      knockback: def.knockback ?? 1.6, trail: def.trail !== false, homing: def.homing ?? 0, target: def.target ?? null,
      dead: false, aoe: def.aoe ?? 0, crit: def.crit,
    };
    this.projectiles.push(p);
    if (p.trail) p.trailH = ctx.fx3d?.trail(mesh, { color, width: def.trailWidth ?? 0.09, segments: 10 });
    return p;
  }

  update(dt) {
    // element gauge decay + frozen timers
    for (const t of this.targets('player')) {
      if (t.frozen) { t.frozenT = (t.frozenT ?? 0) - dt; if (t.frozenT <= 0) t.frozen = false; }
    }
    const u = this.ctx.fx?.uElement;
    if (u && u.value.lengthSq() > 1e-5) u.value.multiplyScalar(Math.exp(-4 * dt));

    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.homing && p.target && p.target.alive !== false) {
        const to = (p.target.center ? p.target.center(this._v) : this._v.copy(p.target.root.position)).clone().sub(p.pos).normalize();
        p.dir.lerp(to, clamp(p.homing * dt, 0, 1)).normalize();
      }
      if (p.gravity) p.dir.y -= p.gravity * dt / p.speed;
      const step = this._v.copy(p.dir).multiplyScalar(p.speed * dt);
      p.pos.add(step);
      p.mesh.position.copy(p.pos);
      p.mesh.lookAt(this._v2.copy(p.pos).add(p.dir));
      let hit = null;
      for (const t of this.targets(p.team)) {
        if (!t || t.alive === false) continue;
        const c = t.center ? t.center(this._v2) : this._v2.copy(t.position ?? t.root.position);
        if (c.distanceTo(p.pos) < p.radius + (t.hitRadius ?? 0.7)) { hit = t; break; }
      }
      const groundY = height(p.pos.x, p.pos.z);
      if (hit) {
        const dir = this._v.copy(hit.center ? hit.center(this._v2) : hit.root.position).sub(p.pos).setY(0).normalize();
        this.damage(hit, { amount: p.damage, element: p.element, dir, knockback: p.knockback, source: p.source, crit: p.crit });
        p.onHit?.(hit, p);
        if (p.aoe > 0) this.strike({ origin: p.pos.clone(), shape: 'sphere', radius: p.aoe, team: p.team, damage: p.damage * 0.6, element: p.element, source: p.source, knockback: 2, shake: 0.3 });
        if (p.hitstop) this.hitstop(p.hitstop);
        if (p.pierce > 0) p.pierce--; else p.dead = true;
      } else if (p.pos.y < groundY + 0.05 || p.life <= 0) {
        if (p.aoe > 0 && p.life > 0) this.strike({ origin: p.pos.clone(), shape: 'sphere', radius: p.aoe, team: p.team, damage: p.damage * 0.6, element: p.element, source: p.source, knockback: 2, shake: 0.3 });
        this.ctx.fx3d?.hitSpark(p.pos, ELEMENT_COLORS[p.element] ?? 0xffffff, 0.6);
        p.dead = true;
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.dead) continue;
      p.trailH?.stop();
      this.ctx.scene.remove(p.mesh);
      if (p.mesh.material?.dispose && !p.mesh.userData.shared) p.mesh.material.dispose();
      this.projectiles.splice(i, 1);
    }
  }
}
