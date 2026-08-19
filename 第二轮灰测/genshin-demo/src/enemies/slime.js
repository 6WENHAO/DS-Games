// Slimes: translucent jelly ball + element core, hop locomotion with squash & stretch,
// element crown symbol, pop-into-droplets death.
import * as THREE from 'three';
import { clamp, damp, lerp, TAU } from '../core/utils.js';
import { makeGlowTexture } from '../core/textures.js';
import { Enemy } from './base.js';
import { defineRig, ELEMENT_HEX, elementHex } from './rigid.js';

const _v = new THREE.Vector3();

// -------------------------------------------------------------- shared bits
let _glowTex = null;
function glowTex() { if (!_glowTex) _glowTex = makeGlowTexture(64, 2.6); return _glowTex; }
const _ptMats = new Map();
function pointMat(colorHex, size) {
  const key = colorHex + '|' + size;
  let m = _ptMats.get(key);
  if (!m) {
    m = new THREE.PointsMaterial({
      size, map: glowTex(), color: colorHex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, opacity: 0.95,
    });
    _ptMats.set(key, m);
  }
  return m;
}
let _arcMat = null;
function arcMat() {
  if (!_arcMat) _arcMat = new THREE.LineBasicMaterial({ color: ELEMENT_HEX.electro, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  return _arcMat;
}

const SLIME_TINT = {
  hydro: { body: 0x5fc9f8, core: 0xbdf0ff },
  pyro: { body: 0xff8355, core: 0xffd9a0 },
  electro: { body: 0xc08bfa, core: 0xf0d8ff },
  cryo: { body: 0x9ee6f2, core: 0xdffbff },
  anemo: { body: 0x86d6b4, core: 0xd6f6e8 },
  dendro: { body: 0xa8dd52, core: 0xe4ffb0 },
  geo: { body: 0xf0c04c, core: 0xffeeb0 },
};

function slimeRig(element) {
  const tint = SLIME_TINT[element] ?? SLIME_TINT.hydro;
  return defineRig('slime_' + element, { outline: 0.018, jellyOpacity: 0.52, outlineColor: 0x1d2630 }, (b) => {
    b.bone('base', null, [0, 0, 0]);
    b.bone('body', 'base', [0, 0.44, 0]);
    b.bone('crown', 'base', [0, 0.94, 0]);

    // jelly shell + inner core
    b.sphere('body', 0.46, { color: tint.body, group: 'jelly', ws: 20, hs: 14 });
    b.sphere('body', 0.2, { color: tint.core, group: 'glow', glow: 1.5, ws: 12, hs: 9, pos: [0, -0.04, 0], outline: false });
    b.sphere('body', 0.1, { color: tint.core, group: 'glow', glow: 1.1, ws: 8, hs: 6, pos: [0.16, 0.16, -0.14], outline: false });

    // face
    b.sphere('body', 0.072, { color: 0x1a1420, pos: [-0.145, 0.09, 0.38], ws: 10, hs: 8, outline: false });
    b.sphere('body', 0.072, { color: 0x1a1420, pos: [0.145, 0.09, 0.38], ws: 10, hs: 8, outline: false });
    b.sphere('body', 0.026, { color: 0xffffff, group: 'glow', glow: 1.3, pos: [-0.168, 0.125, 0.42], ws: 6, hs: 5, outline: false });
    b.sphere('body', 0.026, { color: 0xffffff, group: 'glow', glow: 1.3, pos: [0.122, 0.125, 0.42], ws: 6, hs: 5, outline: false });
    b.box('body', 0.11, 0.028, 0.03, { color: 0x1a1420, pos: [0, -0.055, 0.42], outline: false });

    // element crown symbol
    if (element === 'pyro') {
      b.cone('crown', 0.13, 0.34, { color: tint.body, group: 'glow', glow: 1.7, pos: [0, 0.02, 0], seg: 10, outline: false });
      b.cone('crown', 0.07, 0.2, { color: 0xffe9c0, group: 'glow', glow: 2.0, pos: [0, -0.02, 0], seg: 8, outline: false });
    } else if (element === 'electro') {
      b.box('crown', 0.055, 0.19, 0.035, { color: tint.core, group: 'glow', glow: 2.0, pos: [-0.03, 0.07, 0], rot: [0, 0, 0.5], outline: false });
      b.box('crown', 0.055, 0.19, 0.035, { color: tint.core, group: 'glow', glow: 2.0, pos: [0.03, -0.07, 0], rot: [0, 0, -0.5], outline: false });
    } else {
      b.cone('crown', 0.1, 0.26, { color: tint.core, group: 'glow', glow: 1.7, pos: [0, 0.08, 0], seg: 10, outline: false });
      b.sphere('crown', 0.1, { color: tint.core, group: 'glow', glow: 1.5, pos: [0, -0.04, 0], ws: 10, hs: 8, outline: false });
    }
  }, () => ({
    idle: {
      dur: 2.2, loop: true, tracks: {
        body: [[0, { sy: 1, sx: 1, sz: 1 }], [0.5, { sy: 0.94, sx: 1.04, sz: 1.04 }], [1, { sy: 1, sx: 1, sz: 1 }]],
        crown: [[0, { py: 0, rz: -0.05 }], [0.5, { py: -0.03, rz: 0.05 }], [1, { py: 0, rz: -0.05 }]],
      },
    },
    idle_combat: {
      dur: 1.0, loop: true, tracks: {
        body: [[0, { sy: 1.02, sx: 0.99, sz: 0.99 }], [0.5, { sy: 0.93, sx: 1.05, sz: 1.05 }], [1, { sy: 1.02, sx: 0.99, sz: 0.99 }]],
        crown: [[0, { py: 0.02 }], [0.5, { py: -0.04 }], [1, { py: 0.02 }]],
      },
    },
    hit: {
      dur: 0.34, loop: false, tracks: {
        body: [[0, { sy: 0.72, sx: 1.2, sz: 1.2 }], [0.55, { sy: 1.1, sx: 0.94, sz: 0.94 }], [1, { sy: 1, sx: 1, sz: 1 }]],
      },
    },
    death: {
      dur: 0.5, loop: false, tracks: {
        body: [[0, { sy: 1.05, sx: 0.97, sz: 0.97 }], [0.45, { sy: 1.25, sx: 0.8, sz: 0.8 }], [1, { sy: 0.12, sx: 1.5, sz: 1.5 }]],
        crown: [[0, { py: 0 }], [0.45, { py: 0.18 }], [1, { py: -0.7, sx: 0.2, sy: 0.2, sz: 0.2 }]],
      },
    },
  }));
}

export class Slime extends Enemy {
  constructor(ctx, opts = {}) {
    const element = opts.element ?? 'hydro';
    const scale = opts.scale ?? 1;
    super(ctx, {
      type: opts.type ?? ('slime_' + element),
      name: opts.name ?? 'Slime',
      hp: opts.hp ?? 150 * scale,
      poise: opts.poise ?? 18,
      hitRadius: 0.5 * scale,
      hitHeight: 0.95 * scale,
      headOffset: 1.2 * scale,
      damage: opts.damage ?? 15 * scale,
      element,
      ...opts,
      cfg: {
        walkSpeed: 1.4, chaseSpeed: 3.4, strafeSpeed: 1.0, accel: 14,
        turnRate: 4.2, aggroRange: 13, loseRange: 30, attackRange: 6.5,
        keepDist: 1.7, patrolRadius: 7, mass: 0.55, kbDamp: 4.5,
        groundAlign: 0.5, alertTime: 0.5,
        ...(opts.cfg ?? {}),
      },
    });
    this.deathSfx = 'slime_die';
    this.scaleFactor = scale;
    this.setupRig(slimeRig(element));
    if (scale !== 1) this.rigRoot.scale.setScalar(scale);

    this.squash = 0;
    this.squashVel = 0;
    this.hopT = 0.3 + this.rng() * 0.5;
    this.crouching = false;
    this.deathAnimTime = 0.5;
    this.dissolveTime = 0.55;

    this.attacks = {
      leap: {
        anim: 'idle_combat', dur: 1.5, cooldown: 2.4, range: 7.5, minRange: 1.4, weight: 1,
        faceLock: 0.55, sfx: 'jump',
        telegraph: { kind: 'circle', radius: 2.1 * scale, time: 0.55, element },
        onStart: (e) => {
          e._leapTarget = e.tPos.clone();
          e._leapHit = false;
          if (e._tele) { e._teleAt = e._leapTarget.clone(); e._teleFollow = false; }
        },
        hits: [
          { t: 0.55, fn: (e) => e._launchLeap() },
          { t: 1.42, fn: (e) => e._leapImpact() },
        ],
        move: (e, t) => { if (t < 0.5) e.crouching = true; },
      },
      bump: {
        anim: 'idle_combat', dur: 0.95, cooldown: 1.7, range: 2.3, weight: 0.8,
        faceLock: 0.35,
        telegraph: { kind: 'cone', angle: 70, radius: 2.0 * scale, time: 0.35, element },
        hits: [
          { t: 0.36, fn: (e) => { e.airborne = true; e.vy = 3.2; e.mv.copy(e.dirToTarget).multiplyScalar(5.2); } },
          { t: 0.5, fn: (e) => e.strike({ offset: 0.9 * e.scaleFactor, radius: 1.5 * e.scaleFactor, damage: e.damage * 0.7, element: e.elementType, knockback: 2.4, poise: 12 }) },
        ],
        move: (e, t) => { if (t < 0.3) e.crouching = true; },
      },
    };

    if (element === 'pyro') this._makeFlames();
    if (element === 'electro') this._makeArcs();
  }

  // ------------------------------------------------- element decorations
  _makeFlames() {
    const n = 14;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this._flames = new THREE.Points(g, pointMat(0xff9a55, 0.32));
    this._flames.frustumCulled = false;
    this._flames.renderOrder = 3;
    this.root.add(this._flames);
    this._flameData = [];
    for (let i = 0; i < n; i++) this._flameData.push({ t: this.rng(), sp: 0.7 + this.rng() * 0.7, a: this.rng() * TAU, r: 0.1 + this.rng() * 0.32 });
  }
  _updateFlames(dt) {
    const arr = this._flames.geometry.attributes.position.array;
    for (let i = 0; i < this._flameData.length; i++) {
      const f = this._flameData[i];
      f.t += dt * f.sp;
      if (f.t > 1) { f.t -= 1; f.a = this.rng() * TAU; f.r = 0.08 + this.rng() * 0.34; }
      const k = f.t;
      arr[i * 3] = Math.cos(f.a) * f.r * (1 - k * 0.6);
      arr[i * 3 + 1] = 0.45 + k * 0.85;
      arr[i * 3 + 2] = Math.sin(f.a) * f.r * (1 - k * 0.6);
    }
    this._flames.geometry.attributes.position.needsUpdate = true;
  }

  _makeArcs() {
    const arcs = 4, seg = 5;
    this._arcSeg = seg;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arcs * seg * 2 * 3), 3));
    this._arcs = new THREE.LineSegments(g, arcMat());
    this._arcs.frustumCulled = false;
    this.root.add(this._arcs);
    this._arcT = 0;
  }
  _updateArcs(dt) {
    this._arcT -= dt;
    if (this._arcT > 0) return;
    this._arcT = 0.07;
    const arr = this._arcs.geometry.attributes.position.array;
    const seg = this._arcSeg;
    let p = 0;
    for (let a = 0; a < 4; a++) {
      const a0 = this.rng() * TAU, a1 = a0 + (this.rng() - 0.5) * 2.4;
      const r = 0.5 * this.scaleFactor;
      const from = _v.set(Math.cos(a0) * r, 0.42 + this.rng() * 0.4, Math.sin(a0) * r).clone();
      const to = new THREE.Vector3(Math.cos(a1) * r, 0.42 + this.rng() * 0.5, Math.sin(a1) * r);
      let px = from.x, py = from.y, pz = from.z;
      for (let s = 0; s < seg; s++) {
        const t = (s + 1) / seg;
        const nx = lerp(from.x, to.x, t) + (this.rng() - 0.5) * 0.16;
        const ny = lerp(from.y, to.y, t) + (this.rng() - 0.5) * 0.16;
        const nz = lerp(from.z, to.z, t) + (this.rng() - 0.5) * 0.16;
        arr[p++] = px; arr[p++] = py; arr[p++] = pz;
        arr[p++] = nx; arr[p++] = ny; arr[p++] = nz;
        px = nx; py = ny; pz = nz;
      }
    }
    this._arcs.geometry.attributes.position.needsUpdate = true;
  }

  // ------------------------------------------------- hopping locomotion
  _launchLeap() {
    const to = this._leapTarget ?? this.tPos;
    _v.set(to.x - this.pos.x, 0, to.z - this.pos.z);
    const d = Math.min(_v.length(), 9);
    if (d > 0.01) _v.multiplyScalar(1 / _v.length());
    const air = clamp(0.28 + d * 0.075, 0.32, 0.85);
    this.airborne = true;
    this.vy = 0.5 * (this.cfg.gravity ?? 22) * air;
    this.mv.set(_v.x * d / air, 0, _v.z * d / air);
    this.crouching = false;
    this.squashVel = 9;
  }
  _leapImpact() {
    if (this._leapHit) return;
    this._leapHit = true;
    this.strike({
      offset: 0, radius: 2.1 * this.scaleFactor, damage: this.damage * 1.3,
      element: this.elementType, knockback: 4.2, poise: 24, hitstop: 0.08,
    });
    this.ctx.fx3d?.ring?.(this.pos, elementHex(this.elementType), 2.2 * this.scaleFactor, 0.45);
    this.ctx.fx3d?.dust?.(this.pos, 10, 0xbfae8e);
    this.ctx.fx3d?.shake?.(0.12, 0.12);
    this.squashVel = -9;
  }

  onLand() {
    this.squashVel = -7.5 - Math.min(6, Math.abs(this.vy) * 0.6);
    this.ctx.fx3d?.dust?.(this.pos, 5, 0xbfae8e);
    this.ctx.audio?.sfx?.('land', { pos: this.pos, vol: 0.4 });
    if (this.state === 'attack' && this.atkKey === 'leap' && this.atkT > 0.5) this._leapImpact();
    this.hopT = 0.16 + this.rng() * 0.22;
  }

  _hopDrive(dt, speed, dir) {
    if (this.airborne) { this.wish.copy(this.mv); return; }
    this.wish.set(0, 0, 0);
    this.hopT -= dt;
    this.crouching = this.hopT < 0.16;
    if (this.hopT <= 0) {
      this.airborne = true;
      this.vy = 5.0 + this.rng() * 0.8;
      this.mv.set(dir.x * speed, 0, dir.z * speed);
      this.wish.copy(this.mv);
      this.crouching = false;
      this.squashVel = 8.5;
      this.hopT = 0.55 + this.rng() * 0.35;
    }
  }

  /** Slimes replace walking with hops in every locomotion state. */
  onState(state, dt) {
    const cfg = this.cfg;
    if (state === 'patrol') {
      if (this._canAggro()) { this.setState('alert'); return true; }
      _v.set(this.wp.x - this.pos.x, 0, this.wp.z - this.pos.z);
      const d = _v.length();
      if (d < 1.2 || this.stateT > 14) { this.setState('idle'); return true; }
      _v.multiplyScalar(1 / d);
      this.yawTarget = Math.atan2(_v.x, _v.z);
      this._hopDrive(dt, cfg.walkSpeed * 2.2, _v);
      return true;
    }
    if (state === 'chase') {
      if (!this.target || this.distToTarget > cfg.loseRange) { this.setState('return'); return true; }
      this.faceTarget(dt);
      if (this.distToTarget < cfg.keepDist + 0.6 && !this.airborne) { this.setState('combat'); return true; }
      this._hopDrive(dt, cfg.chaseSpeed, this.dirToTarget);
      return true;
    }
    if (state === 'return') {
      this.aggro = false;
      this.engaged = false;
      if (this._canAggro() && this.distToTarget < cfg.aggroRange * 0.85) { this._alertFast = true; this.setState('alert'); return true; }
      _v.set(this.home.x - this.pos.x, 0, this.home.z - this.pos.z);
      const d = _v.length();
      if (d < 1.3) { this.setState('idle'); return true; }
      _v.multiplyScalar(1 / d);
      this.yawTarget = Math.atan2(_v.x, _v.z);
      this._hopDrive(dt, cfg.walkSpeed * 2.0, _v);
      return true;
    }
    if (state === 'combat') {
      if (!this.target || this.distToTarget > cfg.loseRange) { this.setState('return'); return true; }
      if (this.distToTarget > cfg.attackRange + 1.5) { this.setState('chase'); return true; }
      this.faceTarget(dt);
      this.atkCd -= dt;
      if (!this.airborne) {
        this.wish.set(0, 0, 0);
        if (this.atkCd <= 0) {
          const key = this.pickAttack();
          if (key) {
            if (this.requestToken()) this.startAttack(key);
            else this.atkCd = 0.3;
          } else {
            // too far for bump, too close for leap: shuffle sideways
            _v.set(-this.dirToTarget.z, 0, this.dirToTarget.x).multiplyScalar(cfg.strafeDir);
            this._hopDrive(dt, cfg.walkSpeed * 1.6, _v);
            this.atkCd = 0.25;
          }
        }
      } else this.wish.copy(this.mv);
      return true;
    }
    return false;
  }

  onUpdate(dt) {
    // spring-driven squash & stretch, volume preserving
    let target = 0;
    if (this.crouching) target = -0.34;
    else if (this.airborne) target = clamp(this.vy * 0.055, -0.22, 0.36);
    this.squashVel += (target - this.squash) * 120 * dt;
    this.squashVel *= Math.exp(-7.5 * dt);
    this.squash = clamp(this.squash + this.squashVel * dt, -0.55, 0.5);

    const body = this.bone('body');
    const crown = this.bone('crown');
    if (body) {
      const sy = 1 + this.squash * 0.55;
      const sxz = 1 - this.squash * 0.3;
      body.scale.x *= sxz; body.scale.z *= sxz; body.scale.y *= sy;
      body.position.y *= sy;
      if (crown) crown.position.y = body.position.y + 0.5 * sy + (this.rig.out.get('crown')?.py ?? 0);
    }
    if (this._flames) this._updateFlames(dt);
    if (this._arcs) this._updateArcs(dt);
  }

  onFrozen(dt) {
    if (this._flames) this._updateFlames(dt * 0.15);
  }

  // ------------------------------------------------- death: burst to droplets
  onDie() {
    const n = 26;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const tint = SLIME_TINT[this.elementType] ?? SLIME_TINT.hydro;
    this._drops = new THREE.Points(g, pointMat(tint.core, 0.22 * this.scaleFactor));
    this._drops.frustumCulled = false;
    this.root.add(this._drops);
    this._dropData = [];
    for (let i = 0; i < n; i++) {
      const a = this.rng() * TAU, e = 0.3 + this.rng() * 1.2;
      this._dropData.push({
        x: 0, y: 0.45, z: 0,
        vx: Math.cos(a) * e * 1.7, vy: 2.2 + this.rng() * 2.6, vz: Math.sin(a) * e * 1.7,
      });
    }
    this._extraMeshes = [];
    this.ctx.fx3d?.burst?.(this.center(_v), this.elementType, 0.85);
    if (this._flames) this._flames.visible = false;
    if (this._arcs) this._arcs.visible = false;
  }

  onDeathUpdate(dt) {
    if (!this._drops) return;
    const arr = this._drops.geometry.attributes.position.array;
    for (let i = 0; i < this._dropData.length; i++) {
      const d = this._dropData[i];
      d.vy -= 9.5 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (d.y < 0.02) { d.y = 0.02; d.vy *= -0.32; d.vx *= 0.6; d.vz *= 0.6; }
      arr[i * 3] = d.x; arr[i * 3 + 1] = d.y; arr[i * 3 + 2] = d.z;
    }
    this._drops.geometry.attributes.position.needsUpdate = true;
    this._drops.material.opacity = clamp(1 - (this._deathT - 0.35) / 0.9, 0, 1) * 0.95;
  }

  onDispose() {
    this._drops?.geometry.dispose();
    this._flames?.geometry.dispose();
    this._arcs?.geometry.dispose();
  }
}

export function createSlime(ctx, opts) { return new Slime(ctx, opts); }
