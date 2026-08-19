// Mitachurl: heavy brute with a bull helm and a huge wooden shield.
// Shield charge + jump slam, high poise, ground-shaking footsteps.
import * as THREE from 'three';
import { clamp, TAU } from '../core/utils.js';
import { Enemy } from './base.js';
import { defineRig } from './rigid.js';
import { buildHumanoid, humanoidClips, HILI_COLORS } from './hilichurl.js';

const _v = new THREE.Vector3();

const MITA_COLORS = {
  ...HILI_COLORS,
  skin: 0x8b5f3b, skinDark: 0x6d4526, cloth: 0x4f3f28,
  wood: 0x6a4526, woodLight: 0x86612f, iron: 0x74747c, ironDark: 0x3f3f46,
};

function mitachurlRig() {
  return defineRig('mitachurl', { outline: 0.018, ramp: 'soft' }, (b) => {
    buildHumanoid(b, {
      weapon: 'none', shield: true, shieldSize: 1.35, shieldPos: [0, -0.06, -0.34], shieldRot: [1.3, 0.12, 0], bulk: 1.42, helmet: 'bull',
      colors: MITA_COLORS,
    });
    // extra bulk: belly, fur pelt, shoulder pads, ankle wraps
    b.sphere('torso', 1, { color: MITA_COLORS.skinDark, scale: [0.4, 0.3, 0.34], pos: [0, -0.1, 0.06], ws: 16, hs: 12 });
    b.sphere('chest', 1, { color: 0x4a3a24, scale: [0.44, 0.16, 0.3], pos: [0, 0.14, -0.02], ws: 14, hs: 10 });
    for (let i = 0; i < 7; i++) {
      const a = -0.9 + i * 0.3;
      b.cone('chest', 0.05, 0.15, { color: 0x3a2c1c, pos: [Math.sin(a) * 0.3, 0.17, -0.1 + Math.cos(a) * 0.05], rot: [-0.55, 0, -a * 0.4], seg: 6 });
    }
    b.sphere('armL', 0.2, { color: MITA_COLORS.skin, ws: 12, hs: 9 });
    b.sphere('armR', 0.2, { color: MITA_COLORS.skin, ws: 12, hs: 9 });
    b.box('armR', 0.26, 0.12, 0.26, { color: MITA_COLORS.ironDark, pos: [-0.06, 0.06, 0] });
    b.sphere('handR', 0.14, { color: MITA_COLORS.skinDark, ws: 10, hs: 8 });
    b.cyl('shinL', 0.145, 0.145, 0.09, { color: MITA_COLORS.cloth, pos: [0, -0.2, 0], seg: 10 });
    b.cyl('shinR', 0.145, 0.145, 0.09, { color: MITA_COLORS.cloth, pos: [0, -0.2, 0], seg: 10 });
    // thicker limbs: this thing has to look like it weighs a tonne
    for (const s of ['L', 'R']) {
      b.cyl('leg' + s, 0.155, 0.125, 0.31, { color: MITA_COLORS.skin, pos: [0, -0.14, 0], seg: 10 });
      b.cyl('shin' + s, 0.13, 0.108, 0.29, { color: MITA_COLORS.skin, pos: [0, -0.14, 0], seg: 10 });
      b.cyl('arm' + s, 0.125, 0.11, 0.3, { color: MITA_COLORS.skin, pos: [0, -0.14, 0], seg: 10 });
      b.cyl('fore' + s, 0.11, 0.1, 0.28, { color: MITA_COLORS.skin, pos: [0, -0.13, 0], seg: 10 });
    }
  }, () => humanoidClips({
    speedScale: 1.3,
    guard: true,      // the mitachurl holds that huge shield up in front of itself
    extra: {
      charge_windup: {
        dur: 1.0, loop: false, tracks: {
          base: [[0, { pz: 0 }], [0.6, { pz: -0.16 }], [1, { pz: -0.1 }]],
          hip: [[0, { py: -0.04 }], [0.6, { py: -0.18 }], [1, { py: -0.14 }]],
          torso: [[0, { rx: 0.08 }], [0.6, { rx: 0.3 }], [1, { rx: 0.34 }]],
          chest: [[0, { rx: 0.06, ry: 0.1 }], [0.6, { rx: 0.24, ry: 0.24 }], [1, { rx: 0.26, ry: 0.2 }]],
          head: [[0, { rx: 0.05 }], [0.6, { rx: -0.2 }], [1, { rx: -0.26 }]],
          armL: [[0, { rx: -1.3, rz: 0.5 }], [0.6, { rx: -1.62, rz: 0.34, ry: -0.3 }], [1, { rx: -1.65, rz: 0.3, ry: -0.34 }]],
          foreL: [[0, { rx: -0.5 }], [1, { rx: -0.2 }]],
          armR: [[0, { rx: -0.5, rz: -0.3 }], [0.6, { rx: 0.5, rz: -0.5 }], [1, { rx: 0.3, rz: -0.4 }]],
          legL: [[0, { rx: -0.1 }], [0.6, { rx: -0.5 }], [1, { rx: -0.4 }]],
          legR: [[0, { rx: 0.1 }], [0.6, { rx: 0.4 }], [1, { rx: 0.3 }]],
          shinL: [[0, { rx: 0 }], [0.6, { rx: 0.3 }], [1, { rx: 0.2 }]],
        },
      },
      slam: {
        dur: 1.75, loop: false, tracks: {
          base: [[0, { py: 0 }], [0.34, { py: -0.05 }], [0.52, { py: 0.05 }], [1, { py: 0 }]],
          hip: [[0, { py: -0.05 }], [0.32, { py: -0.24 }], [0.5, { py: 0.1 }], [0.62, { py: 0.06 }], [0.78, { py: -0.2 }], [1, { py: -0.05 }]],
          torso: [[0, { rx: 0.1 }], [0.32, { rx: 0.4 }], [0.55, { rx: -0.2 }], [0.78, { rx: 0.5 }], [1, { rx: 0.1 }]],
          chest: [[0, { rx: 0.08 }], [0.32, { rx: 0.3 }], [0.55, { rx: -0.3 }], [0.78, { rx: 0.45 }], [1, { rx: 0.08 }]],
          head: [[0, { rx: 0.05 }], [0.55, { rx: -0.45 }], [0.78, { rx: 0.4 }], [1, { rx: 0.05 }]],
          armL: [[0, { rx: -1.3, rz: 0.5 }], [0.32, { rx: -0.4, rz: 0.7 }], [0.55, { rx: -2.5, rz: 0.5 }], [0.76, { rx: 0.9, rz: 0.2 }], [1, { rx: -1.3, rz: 0.5 }]],
          armR: [[0, { rx: -0.5, rz: -0.3 }], [0.32, { rx: -0.4, rz: -0.7 }], [0.55, { rx: -2.5, rz: -0.5 }], [0.76, { rx: 0.9, rz: -0.2 }], [1, { rx: -0.5, rz: -0.3 }]],
          foreL: [[0, { rx: -0.5 }], [0.55, { rx: -0.2 }], [0.76, { rx: -0.6 }], [1, { rx: -0.5 }]],
          foreR: [[0, { rx: -0.8 }], [0.55, { rx: -0.2 }], [0.76, { rx: -0.6 }], [1, { rx: -0.8 }]],
          legL: [[0, { rx: -0.1 }], [0.32, { rx: 0.7 }], [0.55, { rx: -0.5 }], [0.78, { rx: 0.5 }], [1, { rx: -0.1 }]],
          legR: [[0, { rx: 0.1 }], [0.32, { rx: 0.7 }], [0.55, { rx: -0.5 }], [0.78, { rx: 0.4 }], [1, { rx: 0.1 }]],
          shinL: [[0, { rx: 0 }], [0.32, { rx: -0.9 }], [0.55, { rx: 0.2 }], [0.78, { rx: -0.4 }], [1, { rx: 0 }]],
          shinR: [[0, { rx: 0 }], [0.32, { rx: -0.9 }], [0.55, { rx: 0.2 }], [0.78, { rx: -0.3 }], [1, { rx: 0 }]],
        },
      },
      roar: {
        dur: 1.4, loop: false, tracks: {
          base: [[0, { py: 0 }], [0.4, { py: 0.04 }], [1, { py: 0 }]],
          torso: [[0, { rx: 0.1 }], [0.4, { rx: -0.24 }], [1, { rx: 0.1 }]],
          chest: [[0, { rx: 0.08 }], [0.4, { rx: -0.3 }], [1, { rx: 0.08 }]],
          head: [[0, { rx: 0.05 }], [0.4, { rx: -0.55 }], [0.8, { rx: -0.5 }], [1, { rx: 0.05 }]],
          armL: [[0, { rx: -1.3, rz: 0.5 }], [0.4, { rx: -0.3, rz: 1.15 }], [1, { rx: -1.3, rz: 0.5 }]],
          armR: [[0, { rx: -0.5, rz: -0.3 }], [0.4, { rx: -0.3, rz: -1.15 }], [1, { rx: -0.5, rz: -0.3 }]],
        },
      },
    },
  }));
}

export class Mitachurl extends Enemy {
  constructor(ctx, opts = {}) {
    super(ctx, {
      type: 'mitachurl', name: opts.name ?? 'Mitachurl',
      hp: opts.hp ?? 1100, poise: opts.poise ?? 120,
      hitRadius: 1.0, hitHeight: 2.5, headOffset: 2.66, damage: opts.damage ?? 40,
      element: 'physical', armored: true,
      ...opts,
      cfg: {
        walkSpeed: 1.7, chaseSpeed: 3.4, strafeSpeed: 1.2, accel: 5.5,
        turnRate: 1.9, aggroRange: 18, loseRange: 42, attackRange: 3.9,
        keepDist: 3.2, patrolRadius: 9, mass: 6.5, kbDamp: 9,
        groundAlign: 0.3, alertTime: 1.0, poiseRegen: 0.12,
        ...(opts.cfg ?? {}),
      },
    });
    this.setupRig(mitachurlRig());
    this.rigRoot.scale.setScalar(opts.scale ?? 1.68);   // ~2.6 m tall
    this.deathAnimTime = 1.5;
    this.dissolveTime = 1.2;
    this._stepPhase = 0;

    this.attacks = {
      charge: {
        anim: 'charge_windup', dur: 2.7, cooldown: 5.5, range: 14, minRange: 3.0, weight: 1.2,
        faceLock: 0.85, sfx: 'swing3',
        telegraph: { kind: 'cone', angle: 26, radius: 11, time: 0.95, color: 0xff5a3a },
        onStart: (e) => { e._chargeAnim = false; e._chargeHits = 0; },
        hits: [
          { t: 1.0, fn: (e) => { e.ctx.fx3d?.dust?.(e.pos, 12, 0xbfae8e); e.ctx.fx3d?.shake?.(0.25, 0.2); } },
          { t: 1.15, fn: (e) => e._chargeHit() },
          { t: 1.4, fn: (e) => e._chargeHit() },
          { t: 1.65, fn: (e) => e._chargeHit() },
          { t: 1.9, fn: (e) => e._chargeHit() },
          { t: 2.15, fn: (e) => { e.ctx.fx3d?.dust?.(e.pos, 10, 0xbfae8e); e.ctx.audio?.sfx?.('land', { pos: e.pos }); } },
        ],
        move: (e, t) => {
          if (t > 0.95 && t < 2.15) {
            if (!e._chargeAnim) { e._chargeAnim = true; e.rig?.play('run', { fade: 0.12, speed: 1.6 }); }
            e.wish.copy(e.forward(_v)).multiplyScalar(11.5);
            if (t < 1.5) e.faceTarget(0.016, e.cfg.turnRate * 0.4);
          } else if (t >= 2.15) {
            e.wish.set(0, 0, 0);
            if (e._chargeAnim) { e._chargeAnim = false; e.rig?.play('idle_combat', { fade: 0.25 }); }
          }
        },
      },
      slam: {
        anim: 'slam', dur: 1.8, cooldown: 4.6, range: 5.5, weight: 1.1,
        faceLock: 0.5, sfx: 'jump',
        telegraph: { kind: 'circle', radius: 3.9, time: 0.72, color: 0xff7a3a },
        onStart: (e) => { e._slamDone = false; },
        hits: [
          {
            t: 0.5, fn: (e) => {
              e.airborne = true; e.vy = 7.2;
              _v.copy(e.dirToTarget).multiplyScalar(Math.min(6, e.distToTarget * 1.6));
              e.mv.set(_v.x, 0, _v.z);
            },
          },
          { t: 0.95, fn: (e) => e._slamImpact() },
          { t: 1.25, fn: (e) => e._slamImpact() },
        ],
      },
      bash: {
        anim: 'attack1', dur: 1.2, cooldown: 3.0, range: 3.6, weight: 1.0,
        faceLock: 0.45, sfx: 'swing2', animSpeed: 0.95,
        telegraph: { kind: 'cone', angle: 95, radius: 3.4, time: 0.5 },
        hits: [{ t: 0.58, fn: (e) => e.strike({ offset: 2.1, radius: 2.6, damage: e.damage, knockback: 7, poise: 40, hitstop: 0.09 }) }],
        move: (e, t) => { if (t > 0.48 && t < 0.7) e.wish.copy(e.forward(_v)).multiplyScalar(3.4); },
      },
    };
  }

  _chargeHit() {
    this.strike({
      offset: 1.6, radius: 1.9, damage: this.damage * 0.55, knockback: 8,
      poise: 32, hitstop: 0.07,
    });
  }

  _slamImpact() {
    if (this.airborne) return;          // wait until we actually land
    if (this._slamDone) return;
    this._slamDone = true;
    this.strike({ offset: 1.2, radius: 4.0, damage: this.damage * 1.35, knockback: 9, poise: 55, hitstop: 0.1 });
    this.ctx.fx3d?.ring?.(this.pos, 0xffb066, 4.2, 0.6);
    this.ctx.fx3d?.dust?.(this.pos, 18, 0xbfae8e);
    this.ctx.fx3d?.shake?.(0.65, 0.35);
    this.ctx.audio?.sfx?.('land', { pos: this.pos, vol: 1.2 });
  }

  onLand() {
    this.ctx.fx3d?.dust?.(this.pos, 8, 0xbfae8e);
    this.ctx.fx3d?.shake?.(0.3, 0.18);
    if (this.state === 'attack' && this.atkKey === 'slam') this._slamImpact();
  }

  onEnterState(s, prev) {
    if (s === 'alert' && prev !== 'stagger') {
      this.rig?.play('roar', { fade: 0.12, loop: false });
      this.ctx.fx3d?.shake?.(0.28, 0.25);
      this.ctx.audio?.sfx?.('enemy_alert', { pos: this.pos, rate: 0.75 });
    }
  }

  onUpdate(dt) {
    // heavy footsteps: dust + tiny shake on each footfall
    const rig = this.rig;
    if (!rig?.clip || (rig.name !== 'walk' && rig.name !== 'run')) { this._stepPhase = 0; return; }
    const u = rig.normalized;
    const phase = u < 0.5 ? 0 : 1;
    if (phase !== this._stepPhase) {
      this._stepPhase = phase;
      if (this.distToCamera < 40) {
        this.ctx.fx3d?.dust?.(this.pos, 4, 0xbfae8e);
        this.ctx.fx3d?.shake?.(0.16, 0.12);
        this.ctx.audio?.sfx?.('footstep_stone', { pos: this.pos, vol: 0.7, rate: 0.7 });
      }
    }
  }
}

export function createMitachurl(ctx, opts) { return new Mitachurl(ctx, opts); }
