// Whopperflower: disguised as a flower bush, pops out when the player gets close,
// spits elemental bullets and lunges with a toothy maw. Rooted in place.
import * as THREE from 'three';
import { clamp, TAU } from '../core/utils.js';
import { Enemy } from './base.js';
import { defineRig, elementHex, ELEMENT_HEX } from './rigid.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

const PETAL_TINT = {
  pyro: { petal: 0xe8604a, petal2: 0xffb07a, core: 0xffd0a0 },
  cryo: { petal: 0x8fd8ea, petal2: 0xd6f4ff, core: 0xe8fbff },
  electro: { petal: 0xb079e8, petal2: 0xe0c0ff, core: 0xf0dcff },
  dendro: { petal: 0x9ad24a, petal2: 0xd6f08a, core: 0xeaffb0 },
  hydro: { petal: 0x5aa8e8, petal2: 0xa8d8ff, core: 0xd8f0ff },
};
const STEM = 0x71984a, STEM_DARK = 0x53722f, LEAF = 0x83b053, MOUTH = 0x9c3542;

function whopperRig(element) {
  const T = PETAL_TINT[element] ?? PETAL_TINT.pyro;
  return defineRig('whopper_' + element, { outline: 0.013 }, (b) => {
    b.bone('base', null, [0, 0, 0]);
    b.bone('stem', 'base', [0, 0.12, 0]);
    b.bone('stem2', 'stem', [0, 0.38, 0]);
    b.bone('head', 'stem2', [0, 0.4, 0]);
    for (let i = 0; i < 6; i++) b.bone('p' + i, 'head', [0, 0.04, 0], [0, i / 6 * TAU, -0.85]);

    // ---- ground disguise: leaves + grass tufts
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + 0.3;
      b.sphere('base', 1, { color: i % 2 ? LEAF : STEM, scale: [0.34, 0.05, 0.16], pos: [Math.sin(a) * 0.3, 0.08, Math.cos(a) * 0.3], rot: [0, -a, 0.12] });
    }
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + 0.9;
      b.cone('base', 0.045, 0.34, { color: STEM_DARK, pos: [Math.sin(a) * 0.42, 0.16, Math.cos(a) * 0.42], rot: [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35], seg: 5 });
    }
    // ---- stem
    b.cyl('stem', 0.15, 0.19, 0.44, { color: STEM, pos: [0, 0.19, 0], seg: 10 });
    b.cyl('stem2', 0.125, 0.15, 0.44, { color: STEM, pos: [0, 0.19, 0], seg: 10 });
    b.sphere('stem2', 0.15, { color: STEM_DARK, pos: [0, 0, 0], ws: 10, hs: 8 });
    b.sphere('stem', 0.19, { color: STEM_DARK, pos: [0, 0, 0], ws: 10, hs: 8 });

    // ---- head: cup, maw, teeth, core
    b.sphere('head', 1, { color: STEM_DARK, scale: [0.28, 0.2, 0.28], pos: [0, -0.05, 0], ws: 14, hs: 10 });
    b.cone('head', 0.26, 0.42, { color: MOUTH, pos: [0, 0.14, 0], rot: [Math.PI, 0, 0], seg: 14 });
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU;
      b.cone('head', 0.035, 0.14, { color: 0xf4ecd8, pos: [Math.sin(a) * 0.21, 0.26, Math.cos(a) * 0.21], rot: [-Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45], seg: 5 });
    }
    b.sphere('head', 0.11, { color: T.core, group: 'glow', glow: 1.8, pos: [0, 0.08, 0], ws: 12, hs: 9, outline: false });
    // sepals under the head
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + 0.4;
      b.cone('head', 0.06, 0.22, { color: LEAF, pos: [Math.sin(a) * 0.2, -0.16, Math.cos(a) * 0.2], rot: [Math.cos(a) * 2.4, 0, -Math.sin(a) * 2.4], seg: 5 });
    }
    // ---- petals
    for (let i = 0; i < 6; i++) {
      b.cone('p' + i, 0.22, 0.66, { color: i % 2 ? T.petal : T.petal2, pos: [0, 0.32, 0], seg: 9 });
      b.cone('p' + i, 0.1, 0.3, { color: T.petal2, pos: [0, 0.36, 0.03], seg: 7, outline: false });
    }
  }, () => ({
    hide: {
      dur: 1.0, loop: true, tracks: {
        stem: [[0, { sy: 0.22, py: -0.06 }], [0.5, { sy: 0.24, py: -0.05 }], [1, { sy: 0.22, py: -0.06 }]],
        stem2: [[0, { sy: 0.3, py: -0.3 }], [1, { sy: 0.3, py: -0.3 }]],
        head: [[0, { py: -0.34, sx: 0.85, sy: 0.85, sz: 0.85 }], [1, { py: -0.34, sx: 0.85, sy: 0.85, sz: 0.85 }]],
        p0: [[0, { rz: 1.62 }], [1, { rz: 1.62 }]],
        p1: [[0, { rz: 1.58 }], [1, { rz: 1.58 }]],
        p2: [[0, { rz: 1.66 }], [1, { rz: 1.66 }]],
        p3: [[0, { rz: 1.6 }], [1, { rz: 1.6 }]],
        p4: [[0, { rz: 1.64 }], [1, { rz: 1.64 }]],
        p5: [[0, { rz: 1.56 }], [1, { rz: 1.56 }]],
      },
    },
    pop: {
      dur: 0.85, loop: false, tracks: {
        stem: [[0, { sy: 0.22, py: -0.06 }], [0.45, { sy: 1.22, py: 0.04 }], [0.7, { sy: 0.92 }], [1, { sy: 1 }]],
        stem2: [[0, { sy: 0.3, py: -0.3 }], [0.5, { sy: 1.15, py: 0.05 }], [1, { sy: 1, py: 0 }]],
        head: [[0, { py: -0.34, sx: 0.85, sy: 0.85, sz: 0.85, rx: 0.2 }], [0.5, { py: 0.06, sx: 1.15, sy: 1.15, sz: 1.15, rx: -0.3 }], [0.75, { py: 0, sx: 0.95, sy: 0.95, sz: 0.95 }], [1, { py: 0, sx: 1, sy: 1, sz: 1 }]],
        p0: [[0, { rz: 1.62 }], [0.55, { rz: -0.35 }], [1, { rz: 0 }]],
        p1: [[0, { rz: 1.58 }], [0.6, { rz: -0.3 }], [1, { rz: 0 }]],
        p2: [[0, { rz: 1.66 }], [0.5, { rz: -0.4 }], [1, { rz: 0 }]],
        p3: [[0, { rz: 1.6 }], [0.58, { rz: -0.32 }], [1, { rz: 0 }]],
        p4: [[0, { rz: 1.64 }], [0.52, { rz: -0.38 }], [1, { rz: 0 }]],
        p5: [[0, { rz: 1.56 }], [0.62, { rz: -0.28 }], [1, { rz: 0 }]],
      },
    },
    idle: {
      dur: 3.0, loop: true, tracks: {
        stem: [[0, { rx: 0.05, rz: 0.03 }], [0.35, { rx: -0.04, rz: -0.05 }], [0.7, { rx: 0.02, rz: 0.06 }], [1, { rx: 0.05, rz: 0.03 }]],
        stem2: [[0, { rx: -0.06, rz: 0.04 }], [0.5, { rx: 0.07, rz: -0.04 }], [1, { rx: -0.06, rz: 0.04 }]],
        head: [[0, { ry: -0.2, rx: 0.05 }], [0.5, { ry: 0.2, rx: -0.03 }], [1, { ry: -0.2, rx: 0.05 }]],
        p0: [[0, { rz: 0.06 }], [0.5, { rz: -0.06 }], [1, { rz: 0.06 }]],
        p3: [[0, { rz: -0.06 }], [0.5, { rz: 0.06 }], [1, { rz: -0.06 }]],
      },
    },
    idle_combat: {
      dur: 1.6, loop: true, tracks: {
        stem: [[0, { rx: 0.1 }], [0.5, { rx: 0.02 }], [1, { rx: 0.1 }]],
        stem2: [[0, { rx: -0.12 }], [0.5, { rx: -0.02 }], [1, { rx: -0.12 }]],
        head: [[0, { rx: 0.12, py: 0 }], [0.5, { rx: 0.0, py: 0.05 }], [1, { rx: 0.12, py: 0 }]],
        p0: [[0, { rz: 0.12 }], [0.5, { rz: -0.1 }], [1, { rz: 0.12 }]],
        p1: [[0, { rz: -0.08 }], [0.5, { rz: 0.12 }], [1, { rz: -0.08 }]],
        p2: [[0, { rz: 0.1 }], [0.5, { rz: -0.12 }], [1, { rz: 0.1 }]],
        p3: [[0, { rz: -0.12 }], [0.5, { rz: 0.1 }], [1, { rz: -0.12 }]],
        p4: [[0, { rz: 0.08 }], [0.5, { rz: -0.08 }], [1, { rz: 0.08 }]],
        p5: [[0, { rz: -0.1 }], [0.5, { rz: 0.12 }], [1, { rz: -0.1 }]],
      },
    },
    spit: {
      dur: 1.7, loop: false, tracks: {
        stem: [[0, { rx: 0.08 }], [0.3, { rx: -0.3 }], [0.5, { rx: 0.16 }], [1, { rx: 0.08 }]],
        stem2: [[0, { rx: -0.1 }], [0.3, { rx: -0.35 }], [0.5, { rx: 0.3 }], [1, { rx: -0.1 }]],
        head: [[0, { rx: 0.1, sx: 1, sy: 1, sz: 1 }], [0.32, { rx: -0.42, sx: 1.16, sy: 1.16, sz: 1.16 }], [0.48, { rx: 0.3, sx: 0.92, sy: 0.92, sz: 0.92 }], [0.72, { rx: 0.16, sx: 1.06, sy: 1.06, sz: 1.06 }], [1, { rx: 0.1, sx: 1, sy: 1, sz: 1 }]],
        p0: [[0, { rz: 0 }], [0.32, { rz: -0.5 }], [1, { rz: 0 }]],
        p1: [[0, { rz: 0 }], [0.32, { rz: -0.5 }], [1, { rz: 0 }]],
        p2: [[0, { rz: 0 }], [0.32, { rz: -0.5 }], [1, { rz: 0 }]],
        p3: [[0, { rz: 0 }], [0.32, { rz: -0.5 }], [1, { rz: 0 }]],
        p4: [[0, { rz: 0 }], [0.32, { rz: -0.5 }], [1, { rz: 0 }]],
        p5: [[0, { rz: 0 }], [0.32, { rz: -0.5 }], [1, { rz: 0 }]],
      },
    },
    bite: {
      dur: 1.25, loop: false, tracks: {
        base: [[0, { pz: 0 }], [0.35, { pz: -0.1 }], [0.52, { pz: 0.5 }], [0.75, { pz: 0.2 }], [1, { pz: 0 }]],
        stem: [[0, { rx: 0.08 }], [0.35, { rx: -0.35 }], [0.52, { rx: 0.75 }], [1, { rx: 0.08 }]],
        stem2: [[0, { rx: -0.1 }], [0.35, { rx: -0.3 }], [0.52, { rx: 0.5 }], [1, { rx: -0.1 }]],
        head: [[0, { rx: 0.1 }], [0.35, { rx: -0.5 }], [0.52, { rx: 0.6 }], [1, { rx: 0.1 }]],
        p0: [[0, { rz: 0 }], [0.35, { rz: -0.55 }], [0.55, { rz: 0.5 }], [1, { rz: 0 }]],
        p1: [[0, { rz: 0 }], [0.35, { rz: -0.55 }], [0.55, { rz: 0.5 }], [1, { rz: 0 }]],
        p2: [[0, { rz: 0 }], [0.35, { rz: -0.55 }], [0.55, { rz: 0.5 }], [1, { rz: 0 }]],
        p3: [[0, { rz: 0 }], [0.35, { rz: -0.55 }], [0.55, { rz: 0.5 }], [1, { rz: 0 }]],
        p4: [[0, { rz: 0 }], [0.35, { rz: -0.55 }], [0.55, { rz: 0.5 }], [1, { rz: 0 }]],
        p5: [[0, { rz: 0 }], [0.35, { rz: -0.55 }], [0.55, { rz: 0.5 }], [1, { rz: 0 }]],
      },
    },
    hit: {
      dur: 0.4, loop: false, tracks: {
        stem: [[0, { rx: 0 }], [0.3, { rx: -0.4, rz: 0.16 }], [1, { rx: 0 }]],
        stem2: [[0, { rx: 0 }], [0.3, { rx: -0.3 }], [1, { rx: 0 }]],
        head: [[0, { rx: 0, sy: 1 }], [0.28, { rx: -0.4, sy: 0.85, sx: 1.12, sz: 1.12 }], [1, { rx: 0, sy: 1 }]],
      },
    },
    death: {
      dur: 1.3, loop: false, tracks: {
        stem: [[0, { rx: 0 }], [0.4, { rx: -0.4 }], [1, { rx: 1.15, sy: 0.85 }]],
        stem2: [[0, { rx: 0 }], [0.4, { rx: -0.2 }], [1, { rx: 0.7 }]],
        head: [[0, { rx: 0 }], [0.4, { rx: -0.4 }], [1, { rx: 0.8, sx: 0.85, sy: 0.85, sz: 0.85 }]],
        p0: [[0, { rz: 0 }], [1, { rz: 1.5 }]],
        p1: [[0, { rz: 0 }], [1, { rz: 1.45 }]],
        p2: [[0, { rz: 0 }], [1, { rz: 1.55 }]],
        p3: [[0, { rz: 0 }], [1, { rz: 1.48 }]],
        p4: [[0, { rz: 0 }], [1, { rz: 1.52 }]],
        p5: [[0, { rz: 0 }], [1, { rz: 1.42 }]],
      },
    },
  }));
}

export class Whopperflower extends Enemy {
  constructor(ctx, opts = {}) {
    const element = opts.element ?? 'pyro';
    super(ctx, {
      type: 'whopperflower', name: opts.name ?? 'Whopperflower',
      hp: opts.hp ?? 380, poise: opts.poise ?? 30,
      hitRadius: 0.6, hitHeight: 1.4, headOffset: 1.62, damage: opts.damage ?? 24,
      element,
      ...opts,
      cfg: {
        walkSpeed: 0, chaseSpeed: 0, strafeSpeed: 0, accel: 6,
        turnRate: 2.6, aggroRange: 6.5, loseRange: 26, attackRange: 14,
        keepDist: 30, canPatrol: false, mass: 3.5, groundAlign: 0.6,
        revealRange: 6.5, hideDelay: 7.0,
        ...(opts.cfg ?? {}),
      },
    });
    this.setupRig(whopperRig(element));
    this.rigRoot.scale.setScalar(opts.scale ?? 1.18);
    this.revealed = false;
    this.deathAnimTime = 1.35;
    this.dissolveTime = 1.0;
    this.state = 'hidden';
    this.rig.play('hide', { fade: 0 });
    this._farT = 0;

    this.attacks = {
      spit: {
        anim: 'spit', dur: 1.8, cooldown: 2.8, range: 16, minRange: 3.0, weight: 1.2,
        faceLock: 0.42, faceWhile: true, sfx: 'skill_pyro',
        telegraph: { kind: 'cone', angle: 16, radius: 11, time: 0.4, element },
        hits: [
          { t: 0.5, fn: (e) => e._spit(0) },
          { t: 0.68, fn: (e) => e._spit(1) },
          { t: 0.86, fn: (e) => e._spit(-1) },
        ],
      },
      bite: {
        anim: 'bite', dur: 1.3, cooldown: 2.4, range: 3.6, weight: 1.4,
        faceLock: 0.4, sfx: 'swing1',
        telegraph: { kind: 'cone', angle: 60, radius: 3.2, time: 0.38, element },
        hits: [{ t: 0.5, fn: (e) => e.strike({ offset: 1.5, radius: 1.5, damage: e.damage, element: e.elementType, knockback: 4, poise: 20, y: 0.9 }) }],
      },
    };
  }

  _spit(spread) {
    const head = this.bone('head');
    if (!head) return;
    head.getWorldPosition(_v);
    const dir = new THREE.Vector3();
    if (this.target) {
      const tc = this.target.center ? this.target.center(_v2) : _v2.copy(this.target.position);
      dir.copy(tc).sub(_v);
    } else dir.copy(this.forward(_v2));
    dir.y += 0.08;
    dir.normalize();
    if (spread) {
      _v2.set(-dir.z, 0, dir.x).normalize().multiplyScalar(spread * 0.14);
      dir.add(_v2).normalize();
    }
    this.manager?.spawnProjectile({
      kind: 'bullet', pos: _v.clone(), dir, speed: 16, damage: this.damage * 0.7,
      element: this.elementType, radius: 0.5, life: 3.0, gravity: 1.4, source: this, scale: 0.9,
    });
    this.ctx.audio?.sfx?.('skill_pyro', { pos: this.pos, rate: 1.4, vol: 0.6 });
  }

  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.setState('reveal');
  }

  onEnterState(s) {
    if (s === 'reveal') {
      this.revealed = true;
      this.rig.play('pop', { fade: 0.05, loop: false, restart: true });
      this.showMark(1.0);
      this.ctx.fx3d?.dust?.(this.pos, 12, 0x7f9a4a);
      this.ctx.fx3d?.ring?.(this.pos, elementHex(this.elementType), 1.6, 0.4);
      this.ctx.fx3d?.burst?.(this.center(_v), this.elementType, 0.5);
      this.ctx.audio?.sfx?.('enemy_alert', { pos: this.pos, rate: 1.25 });
      this.ctx.events?.emit?.('enemy:aggro', { enemy: this });
    }
    if (s === 'burrow') {
      this.revealed = false;
      this.rig.play('hide', { fade: 0.4 });
      this.ctx.fx3d?.dust?.(this.pos, 8, 0x7f9a4a);
    }
  }

  onState(state, dt) {
    const cfg = this.cfg;
    if (state === 'hidden') {
      this.wish.set(0, 0, 0);
      this.aggro = false;
      this.engaged = false;
      this.rig.play('hide', { fade: 0.3 });
      if (this.target && this.distToTarget < cfg.revealRange) this.reveal();
      return true;
    }
    if (state === 'reveal') {
      this.wish.set(0, 0, 0);
      this.aggro = true;
      this.engaged = true;
      this.faceTarget(dt);
      if (this.stateT > 0.8) { this.atkCd = 0.35; this.setState('combat'); }
      return true;
    }
    if (state === 'burrow') {
      this.wish.set(0, 0, 0);
      this.aggro = false;
      this.engaged = false;
      if (this.target && this.distToTarget < cfg.revealRange * 0.8) { this.reveal(); return true; }
      if (this.stateT > 1.0) this.setState('hidden');
      return true;
    }
    if (state === 'alert') {
      if (!this.revealed) { this.reveal(); return true; }
      return false;
    }
    if (state === 'chase' || state === 'return') { this.setState('combat'); return true; }
    if (state === 'combat') {
      // rooted: never moves, but hides again if the player leaves
      this._farT = this.distToTarget > cfg.loseRange * 0.6 ? this._farT + dt : 0;
      if (!this.target || this._farT > cfg.hideDelay) { this._farT = 0; this.setState('burrow'); return true; }
      return false;
    }
    return false;
  }

  onUpdate(dt) {
    this.wish.set(0, 0, 0);
    this.mv.multiplyScalar(0.001);
  }
}

export function createWhopperflower(ctx, opts) { return new Whopperflower(ctx, opts); }
