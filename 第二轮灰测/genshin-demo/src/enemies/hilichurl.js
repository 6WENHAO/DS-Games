// Hilichurls: stocky humanoids with wooden masks, grass skirts and clubs.
// Three variants: club / archer (bow) / shield (blockable front).
// Exports the shared humanoid rig + clip factory that the mitachurl reuses.
import * as THREE from 'three';
import { clamp, damp, TAU } from '../core/utils.js';
import { Enemy } from './base.js';
import { defineRig, elementHex } from './rigid.js';

const _v = new THREE.Vector3(), _f = new THREE.Vector3();

export const HILI_COLORS = {
  skin: 0x9c6f47, skinDark: 0x7d5335, mask: 0xd8c49a, maskDark: 0x7a6440,
  straw: 0xc2a758, strawDark: 0x9b7f3c, cloth: 0x6b5a3e, wood: 0x6f4a2c,
  woodLight: 0x8a6136, iron: 0x6d6d75, ironDark: 0x45454c, hair: 0x3d2a1c,
};

/**
 * Build a stocky humanoid rig into a RigBuilder.
 * o = { colors, weapon:'club'|'bow'|'axe'|'none', shield:bool, helmet:'mask'|'bull', bulk }
 */
export function buildHumanoid(b, o = {}) {
  const C = { ...HILI_COLORS, ...(o.colors ?? {}) };
  const K = o.bulk ?? 1;              // torso bulk multiplier
  const skirt = o.skirt !== false;

  b.bone('base', null, [0, 0, 0]);
  b.bone('hip', 'base', [0, 0.66, 0]);
  b.bone('torso', 'hip', [0, 0.16, 0]);
  b.bone('chest', 'torso', [0, 0.2, 0]);
  b.bone('head', 'chest', [0, 0.3, 0]);
  b.bone('armL', 'chest', [0.3 * K, 0.12, 0]);
  b.bone('foreL', 'armL', [0, -0.28, 0]);
  b.bone('handL', 'foreL', [0, -0.26, 0]);
  b.bone('armR', 'chest', [-0.3 * K, 0.12, 0]);
  b.bone('foreR', 'armR', [0, -0.28, 0]);
  b.bone('handR', 'foreR', [0, -0.26, 0]);
  b.bone('legL', 'hip', [0.15, -0.06, 0]);
  b.bone('shinL', 'legL', [0, -0.28, 0]);
  b.bone('footL', 'shinL', [0, -0.28, 0]);
  b.bone('legR', 'hip', [-0.15, -0.06, 0]);
  b.bone('shinR', 'legR', [0, -0.28, 0]);
  b.bone('footR', 'shinR', [0, -0.28, 0]);
  b.bone('weapon', 'handR', [0, -0.05, 0.03], [0.8, 0.1, 0.3]);
  b.bone('offhand', 'handL', [0, -0.03, 0.03], [0, 0, 0]);

  // ---- torso / hips
  b.sphere('hip', 1, { color: C.skin, scale: [0.28 * K, 0.17, 0.22 * K], ws: 14, hs: 10 });
  b.sphere('torso', 1, { color: C.skin, scale: [0.31 * K, 0.26, 0.25 * K], ws: 16, hs: 12 });
  b.sphere('torso', 1, { color: C.skinDark, scale: [0.27 * K, 0.2, 0.23 * K], pos: [0, -0.05, 0.05], ws: 12, hs: 9 });
  b.sphere('chest', 1, { color: C.skin, scale: [0.33 * K, 0.24, 0.26 * K], ws: 16, hs: 12 });
  // shoulder caps
  b.sphere('armL', 0.13, { color: C.skin, ws: 12, hs: 9 });
  b.sphere('armR', 0.13, { color: C.skin, ws: 12, hs: 9 });

  // ---- loincloth / grass skirt
  if (skirt) {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      const r = 0.225 * K;
      b.box('hip', 0.08, 0.32, 0.04, {
        color: i % 3 === 0 ? C.strawDark : C.straw,
        pos: [Math.sin(a) * r, -0.16, Math.cos(a) * r],
        rot: [Math.cos(a) * 0.42, -a, -Math.sin(a) * 0.42],
      });
    }
    b.torus('hip', 0.25 * K, 0.028, { color: C.cloth, pos: [0, -0.02, 0], rot: [Math.PI / 2, 0, 0], rs: 6, ts: 14 });
  }

  // ---- head + mask
  b.sphere('head', 1, { color: C.skin, scale: [0.22, 0.21, 0.21], ws: 16, hs: 12 });
  b.sphere('head', 0.055, { color: C.skin, pos: [0.2, -0.01, 0], ws: 8, hs: 6 });
  b.sphere('head', 0.055, { color: C.skin, pos: [-0.2, -0.01, 0], ws: 8, hs: 6 });
  if (o.helmet === 'bull') {
    // iron cap + bull horns
    b.sphere('head', 1, { color: C.iron, scale: [0.235, 0.2, 0.235], pos: [0, 0.045, 0], ws: 16, hs: 10 });
    b.torus('head', 0.225, 0.032, { color: C.ironDark, pos: [0, 0.0, 0], rot: [Math.PI / 2, 0, 0], rs: 6, ts: 16 });
    b.cone('head', 0.062, 0.32, { color: 0xe8e0cc, pos: [0.25, 0.11, 0.02], rot: [0, 0, 1.15], seg: 9 });
    b.cone('head', 0.062, 0.32, { color: 0xe8e0cc, pos: [-0.25, 0.11, 0.02], rot: [0, 0, -1.15], seg: 9 });
    b.box('head', 0.3, 0.13, 0.06, { color: C.ironDark, pos: [0, 0.02, 0.19] });
    b.sphere('head', 0.035, { color: 0xff6a3a, group: 'glow', glow: 1.6, pos: [0.075, 0.02, 0.22], ws: 6, hs: 5, outline: false });
    b.sphere('head', 0.035, { color: 0xff6a3a, group: 'glow', glow: 1.6, pos: [-0.075, 0.02, 0.22], ws: 6, hs: 5, outline: false });
  } else {
    // wooden mask with eye holes + strap
    b.box('head', 0.33, 0.35, 0.075, { color: C.mask, pos: [0, 0.01, 0.175], rot: [0.05, 0, 0] });
    b.box('head', 0.28, 0.06, 0.05, { color: C.maskDark, pos: [0, 0.13, 0.2] });
    b.cone('head', 0.05, 0.1, { color: C.maskDark, pos: [0, -0.02, 0.22], rot: [1.6, 0, 0], seg: 4 });
    b.cyl('head', 0.045, 0.045, 0.06, { color: 0x120d0a, pos: [0.082, 0.045, 0.2], rot: [Math.PI / 2, 0, 0], seg: 8, outline: false });
    b.cyl('head', 0.045, 0.045, 0.06, { color: 0x120d0a, pos: [-0.082, 0.045, 0.2], rot: [Math.PI / 2, 0, 0], seg: 8, outline: false });
    b.box('head', 0.13, 0.035, 0.05, { color: 0x1a1209, pos: [0, -0.1, 0.2], outline: false });
    b.torus('head', 0.215, 0.022, { color: C.cloth, pos: [0, 0.02, 0], rot: [Math.PI / 2, 0, 0], rs: 5, ts: 14 });
    // hair tufts
    b.cone('head', 0.06, 0.17, { color: C.hair, pos: [0.06, 0.19, -0.07], rot: [-0.3, 0, -0.3], seg: 6 });
    b.cone('head', 0.055, 0.15, { color: C.hair, pos: [-0.07, 0.185, -0.05], rot: [-0.35, 0, 0.35], seg: 6 });
    b.cone('head', 0.05, 0.13, { color: C.hair, pos: [0, 0.18, -0.13], rot: [-0.6, 0, 0], seg: 6 });
  }

  // ---- arms
  for (const side of ['L', 'R']) {
    b.cyl('arm' + side, 0.09, 0.082, 0.29, { color: C.skin, pos: [0, -0.14, 0], seg: 10 });
    b.cyl('fore' + side, 0.08, 0.072, 0.27, { color: C.skin, pos: [0, -0.13, 0], seg: 10 });
    b.sphere('hand' + side, 0.088, { color: C.skinDark, ws: 10, hs: 8 });
    b.cyl('fore' + side, 0.083, 0.083, 0.05, { color: C.cloth, pos: [0, -0.24, 0], seg: 10 });
  }

  // ---- legs
  for (const side of ['L', 'R']) {
    b.cyl('leg' + side, 0.105, 0.092, 0.3, { color: C.skin, pos: [0, -0.14, 0], seg: 10 });
    b.cyl('shin' + side, 0.09, 0.078, 0.28, { color: C.skin, pos: [0, -0.14, 0], seg: 10 });
    b.box('foot' + side, 0.135, 0.09, 0.27, { color: C.skinDark, pos: [0, 0.0, 0.04] });
    b.cyl('shin' + side, 0.092, 0.092, 0.05, { color: C.cloth, pos: [0, -0.02, 0], seg: 10 });
  }

  // ---- weapons
  if (o.weapon === 'club') {
    b.cyl('weapon', 0.048, 0.062, 0.76, { color: C.wood, pos: [0, 0.32, 0], seg: 9 });
    b.sphere('weapon', 0.105, { color: C.woodLight, pos: [0, 0.68, 0], ws: 10, hs: 8 });
    b.sphere('weapon', 0.075, { color: C.woodLight, pos: [0.06, 0.5, 0.03], ws: 8, hs: 6 });
    b.sphere('weapon', 0.062, { color: C.wood, pos: [-0.05, 0.36, -0.03], ws: 8, hs: 6 });
    b.cyl('weapon', 0.056, 0.056, 0.07, { color: C.cloth, pos: [0, 0.06, 0], seg: 8 });
  } else if (o.weapon === 'axe') {
    b.cyl('weapon', 0.055, 0.07, 1.0, { color: C.wood, pos: [0, 0.42, 0], seg: 9 });
    b.box('weapon', 0.09, 0.42, 0.5, { color: C.iron, pos: [0, 0.86, 0.16], rot: [0.1, 0, 0] });
    b.box('weapon', 0.1, 0.16, 0.2, { color: C.ironDark, pos: [0, 0.86, -0.06] });
  }
  if (o.weapon === 'bow') {
    b.torus('offhand', 0.44, 0.032, { color: C.woodLight, rot: [0, -Math.PI / 2, -0.625 * Math.PI], rs: 5, ts: 20, arc: 1.25 * Math.PI, pos: [0, 0, 0] });
    b.box('offhand', 0.024, 0.82, 0.024, { color: 0xf2ece0, pos: [0, 0, -0.16] });
    b.cyl('offhand', 0.04, 0.04, 0.16, { color: C.cloth, pos: [0, 0, 0.02], rot: [Math.PI / 2, 0, 0], seg: 8 });
    // quiver on the back
    b.cyl('chest', 0.07, 0.06, 0.4, { color: C.wood, pos: [-0.16, 0.02, -0.22], rot: [-0.3, 0, 0.35], seg: 9 });
    for (let i = 0; i < 3; i++) {
      b.cyl('chest', 0.012, 0.012, 0.3, { color: 0xcdb98d, pos: [-0.19 + i * 0.03, 0.26, -0.28], rot: [-0.3, 0, 0.35], seg: 5, outline: false });
    }
  }
  if (o.shield) {
    const S = o.shieldSize ?? 1;
    b.bone('shield', 'offhand', o.shieldPos ?? [0, -0.02, 0.1], o.shieldRot ?? [0, 0, 0]);
    b.box('shield', 0.5 * S, 0.62 * S, 0.055, { color: C.wood, pos: [0, 0, 0.02] });
    b.box('shield', 0.15 * S, 0.66 * S, 0.075, { color: C.woodLight, pos: [-0.17 * S, 0, 0.03] });
    b.box('shield', 0.15 * S, 0.66 * S, 0.075, { color: C.woodLight, pos: [0.17 * S, 0, 0.03] });
    b.box('shield', 0.54 * S, 0.09 * S, 0.095, { color: C.cloth, pos: [0, 0.2 * S, 0.03] });
    b.box('shield', 0.54 * S, 0.09 * S, 0.095, { color: C.cloth, pos: [0, -0.2 * S, 0.03] });
    b.sphere('shield', 0.06, { color: C.ironDark, pos: [0, 0, 0.08], ws: 8, hs: 6 });
    // grip bar on the back face so the hand visibly holds the shield
    b.box('shield', 0.1 * S, 0.09, 0.16, { color: C.cloth, pos: [0, 0.02, -0.06] });
  }
}

/** Shared humanoid clip set. speedScale >1 = heavier/slower monster. */
export function humanoidClips(o = {}) {
  const S = o.speedScale ?? 1;
  const guard = !!o.guard;
  const armIdleL = guard ? { rx: -1.25, rz: 0.42, ry: -0.2 } : { rx: 0.12, rz: 0.14 };
  const clips = {
    idle: {
      dur: 2.8 * S, loop: true, tracks: {
        hip: [[0, { py: 0 }], [0.5, { py: 0.018 }], [1, { py: 0 }]],
        torso: [[0, { rx: 0.03 }], [0.5, { rx: -0.02 }], [1, { rx: 0.03 }]],
        chest: [[0, { rx: 0.02, ry: 0.04 }], [0.5, { rx: -0.03, ry: -0.05 }], [1, { rx: 0.02, ry: 0.04 }]],
        head: [[0, { ry: -0.16, rx: 0.06 }], [0.35, { ry: 0.02, rx: 0.02 }], [0.7, { ry: 0.2, rx: 0.07 }], [1, { ry: -0.16, rx: 0.06 }]],
        armL: [[0, armIdleL], [0.5, guard ? { rx: -1.3, rz: 0.46, ry: -0.2 } : { rx: 0.03, rz: 0.1 }], [1, armIdleL]],
        armR: [[0, { rx: 0.14, rz: -0.16 }], [0.5, { rx: 0.04, rz: -0.12 }], [1, { rx: 0.14, rz: -0.16 }]],
        foreL: [[0, { rx: guard ? -0.5 : -0.22 }], [1, { rx: guard ? -0.5 : -0.22 }]],
        foreR: [[0, { rx: -0.3 }], [0.5, { rx: -0.22 }], [1, { rx: -0.3 }]],
      },
    },
    idle_combat: {
      dur: 1.5 * S, loop: true, tracks: {
        hip: [[0, { py: -0.03 }], [0.5, { py: -0.05 }], [1, { py: -0.03 }]],
        torso: [[0, { rx: 0.07 }], [0.5, { rx: 0.03 }], [1, { rx: 0.07 }]],
        chest: [[0, { rx: 0.08, ry: 0.12 }], [0.5, { rx: 0.03, ry: 0.06 }], [1, { rx: 0.08, ry: 0.12 }]],
        head: [[0, { rx: 0.1 }], [1, { rx: 0.1 }]],
        armL: [[0, guard ? { rx: -1.35, rz: 0.5, ry: -0.25 } : { rx: -0.35, rz: 0.3 }], [0.5, guard ? { rx: -1.42, rz: 0.52, ry: -0.25 } : { rx: -0.28, rz: 0.26 }], [1, guard ? { rx: -1.35, rz: 0.5, ry: -0.25 } : { rx: -0.35, rz: 0.3 }]],
        armR: [[0, { rx: -0.5, rz: -0.32 }], [0.5, { rx: -0.42, rz: -0.28 }], [1, { rx: -0.5, rz: -0.32 }]],
        foreL: [[0, { rx: guard ? -0.55 : -0.7 }], [1, { rx: guard ? -0.55 : -0.7 }]],
        foreR: [[0, { rx: -0.85 }], [1, { rx: -0.85 }]],
        legL: [[0, { rx: -0.12 }], [1, { rx: -0.12 }]],
        legR: [[0, { rx: 0.12 }], [1, { rx: 0.12 }]],
      },
    },
    walk: {
      dur: 0.95 * S, loop: true, tracks: {
        hip: [[0, { py: 0, ry: 0 }], [0.25, { py: 0.028, ry: 0.09 }], [0.5, { py: 0, ry: 0 }], [0.75, { py: 0.028, ry: -0.09 }], [1, { py: 0, ry: 0 }]],
        torso: [[0, { rx: 0.06 }], [1, { rx: 0.06 }]],
        chest: [[0, { ry: -0.1 }], [0.5, { ry: 0.1 }], [1, { ry: -0.1 }]],
        head: [[0, { rx: 0.04 }], [1, { rx: 0.04 }]],
        legL: [[0, { rx: 0.52 }], [0.3, { rx: 0.1 }], [0.5, { rx: -0.42 }], [0.8, { rx: -0.05 }], [1, { rx: 0.52 }]],
        shinL: [[0, { rx: -0.22 }], [0.3, { rx: -0.06 }], [0.5, { rx: 0.3 }], [0.8, { rx: 0.62 }], [1, { rx: -0.22 }]],
        footL: [[0, { rx: 0.1 }], [0.5, { rx: 0.16 }], [1, { rx: 0.1 }]],
        legR: [[0, { rx: -0.42 }], [0.3, { rx: -0.05 }], [0.5, { rx: 0.52 }], [0.8, { rx: 0.1 }], [1, { rx: -0.42 }]],
        shinR: [[0, { rx: 0.3 }], [0.3, { rx: 0.62 }], [0.5, { rx: -0.22 }], [0.8, { rx: -0.06 }], [1, { rx: 0.3 }]],
        footR: [[0, { rx: 0.16 }], [0.5, { rx: 0.1 }], [1, { rx: 0.16 }]],
        armL: [[0, guard ? { rx: -1.2, rz: 0.42 } : { rx: -0.36, rz: 0.16 }], [0.5, guard ? { rx: -1.28, rz: 0.44 } : { rx: 0.34, rz: 0.1 }], [1, guard ? { rx: -1.2, rz: 0.42 } : { rx: -0.36, rz: 0.16 }]],
        armR: [[0, { rx: 0.34, rz: -0.14 }], [0.5, { rx: -0.36, rz: -0.18 }], [1, { rx: 0.34, rz: -0.14 }]],
        foreL: [[0, { rx: guard ? -0.5 : -0.3 }], [1, { rx: guard ? -0.5 : -0.3 }]],
        foreR: [[0, { rx: -0.3 }], [1, { rx: -0.3 }]],
      },
    },
    strafe: {
      dur: 1.1 * S, loop: true, tracks: {
        hip: [[0, { py: -0.02, ry: 0 }], [0.25, { py: 0.01, ry: 0.06 }], [0.5, { py: -0.02, ry: 0 }], [0.75, { py: 0.01, ry: -0.06 }], [1, { py: -0.02, ry: 0 }]],
        legL: [[0, { rx: 0.3, rz: 0.12 }], [0.5, { rx: -0.24, rz: 0.06 }], [1, { rx: 0.3, rz: 0.12 }]],
        legR: [[0, { rx: -0.24, rz: -0.06 }], [0.5, { rx: 0.3, rz: -0.12 }], [1, { rx: -0.24, rz: -0.06 }]],
        shinL: [[0, { rx: -0.16 }], [0.5, { rx: 0.24 }], [1, { rx: -0.16 }]],
        shinR: [[0, { rx: 0.24 }], [0.5, { rx: -0.16 }], [1, { rx: 0.24 }]],
        chest: [[0, { rx: 0.08, ry: 0.14 }], [1, { rx: 0.08, ry: 0.14 }]],
        armL: [[0, guard ? { rx: -1.35, rz: 0.5 } : { rx: -0.4, rz: 0.3 }], [1, guard ? { rx: -1.35, rz: 0.5 } : { rx: -0.4, rz: 0.3 }]],
        armR: [[0, { rx: -0.5, rz: -0.34 }], [1, { rx: -0.5, rz: -0.34 }]],
        foreR: [[0, { rx: -0.9 }], [1, { rx: -0.9 }]],
        foreL: [[0, { rx: guard ? -0.55 : -0.6 }], [1, { rx: guard ? -0.55 : -0.6 }]],
      },
    },
    run: {
      dur: 0.66 * S, loop: true, tracks: {
        hip: [[0, { py: 0, ry: 0 }], [0.25, { py: 0.06, ry: 0.13 }], [0.5, { py: 0, ry: 0 }], [0.75, { py: 0.06, ry: -0.13 }], [1, { py: 0, ry: 0 }]],
        torso: [[0, { rx: 0.2 }], [1, { rx: 0.2 }]],
        chest: [[0, { rx: 0.1, ry: -0.16 }], [0.5, { rx: 0.1, ry: 0.16 }], [1, { rx: 0.1, ry: -0.16 }]],
        head: [[0, { rx: -0.16 }], [1, { rx: -0.16 }]],
        legL: [[0, { rx: 0.92 }], [0.3, { rx: 0.2 }], [0.5, { rx: -0.6 }], [0.8, { rx: 0.1 }], [1, { rx: 0.92 }]],
        shinL: [[0, { rx: -0.5 }], [0.3, { rx: -0.1 }], [0.5, { rx: 0.5 }], [0.8, { rx: 1.1 }], [1, { rx: -0.5 }]],
        legR: [[0, { rx: -0.6 }], [0.3, { rx: 0.1 }], [0.5, { rx: 0.92 }], [0.8, { rx: 0.2 }], [1, { rx: -0.6 }]],
        shinR: [[0, { rx: 0.5 }], [0.3, { rx: 1.1 }], [0.5, { rx: -0.5 }], [0.8, { rx: -0.1 }], [1, { rx: 0.5 }]],
        armL: [[0, guard ? { rx: -1.1, rz: 0.4 } : { rx: -0.9, rz: 0.2 }], [0.5, guard ? { rx: -1.2, rz: 0.42 } : { rx: 0.5, rz: 0.12 }], [1, guard ? { rx: -1.1, rz: 0.4 } : { rx: -0.9, rz: 0.2 }]],
        armR: [[0, { rx: 0.5, rz: -0.18 }], [0.5, { rx: -0.9, rz: -0.22 }], [1, { rx: 0.5, rz: -0.18 }]],
        foreL: [[0, { rx: -0.8 }], [1, { rx: -0.8 }]],
        foreR: [[0, { rx: -0.8 }], [1, { rx: -0.8 }]],
      },
    },
    attack1: {
      dur: 1.05 * S, loop: false, tracks: {
        base: [[0, { pz: 0 }], [0.42, { pz: -0.05 }], [0.56, { pz: 0.22 }], [1, { pz: 0 }]],
        hip: [[0, { py: -0.02 }], [0.4, { py: 0.04 }], [0.56, { py: -0.09 }], [1, { py: -0.02 }]],
        torso: [[0, { rx: 0.06 }], [0.4, { rx: -0.3 }], [0.56, { rx: 0.36 }], [0.75, { rx: 0.2 }], [1, { rx: 0.06 }]],
        chest: [[0, { rx: 0.05, ry: 0.1 }], [0.4, { rx: -0.32, ry: 0.5 }], [0.56, { rx: 0.34, ry: -0.28 }], [1, { rx: 0.05, ry: 0.1 }]],
        head: [[0, { rx: 0.06 }], [0.4, { rx: -0.24 }], [0.6, { rx: 0.28 }], [1, { rx: 0.06 }]],
        armR: [[0, { rx: -0.4, rz: -0.3 }], [0.4, { rx: -2.35, rz: -0.5 }], [0.56, { rx: 0.72, rz: 0.1 }], [0.72, { rx: 0.95, rz: 0.05 }], [1, { rx: -0.4, rz: -0.3 }]],
        foreR: [[0, { rx: -0.8 }], [0.4, { rx: -0.5 }], [0.56, { rx: -0.1 }], [1, { rx: -0.8 }]],
        armL: [[0, { rx: -0.35, rz: 0.3 }], [0.4, { rx: 0.4, rz: 0.7 }], [0.56, { rx: -0.7, rz: 0.35 }], [1, { rx: -0.35, rz: 0.3 }]],
        foreL: [[0, { rx: -0.7 }], [1, { rx: -0.7 }]],
        legL: [[0, { rx: -0.1 }], [0.4, { rx: -0.3 }], [0.56, { rx: 0.35 }], [1, { rx: -0.1 }]],
        legR: [[0, { rx: 0.1 }], [0.4, { rx: 0.35 }], [0.56, { rx: -0.32 }], [1, { rx: 0.1 }]],
        shinL: [[0, { rx: -0.05 }], [0.56, { rx: -0.3 }], [1, { rx: -0.05 }]],
      },
    },
    attack2: {
      dur: 0.92 * S, loop: false, tracks: {
        base: [[0, { pz: 0 }], [0.3, { pz: -0.04 }], [0.48, { pz: 0.18 }], [1, { pz: 0 }]],
        hip: [[0, { py: -0.03, ry: 0 }], [0.3, { ry: 0.5, py: -0.02 }], [0.5, { ry: -0.45, py: -0.07 }], [1, { py: -0.03, ry: 0 }]],
        chest: [[0, { ry: 0.1 }], [0.3, { ry: 0.65, rx: -0.1 }], [0.5, { ry: -0.7, rx: 0.16 }], [1, { ry: 0.1 }]],
        head: [[0, { ry: 0 }], [0.3, { ry: 0.3 }], [0.5, { ry: -0.35 }], [1, { ry: 0 }]],
        armR: [[0, { rx: -0.5, rz: -0.3 }], [0.3, { rx: -0.9, rz: -1.15 }], [0.5, { rx: -0.7, rz: 0.75 }], [0.68, { rx: -0.5, rz: 0.5 }], [1, { rx: -0.5, rz: -0.3 }]],
        foreR: [[0, { rx: -0.85 }], [0.3, { rx: -1.2 }], [0.5, { rx: -0.3 }], [1, { rx: -0.85 }]],
        armL: [[0, { rx: -0.35, rz: 0.3 }], [0.3, { rx: -0.2, rz: -0.3 }], [0.5, { rx: -0.5, rz: 0.9 }], [1, { rx: -0.35, rz: 0.3 }]],
        legL: [[0, { rz: 0.05 }], [0.5, { rz: 0.2 }], [1, { rz: 0.05 }]],
        legR: [[0, { rz: -0.05 }], [0.5, { rz: -0.2 }], [1, { rz: -0.05 }]],
      },
    },
    shoot: {
      dur: 1.55, loop: false, tracks: {
        hip: [[0, { py: -0.03 }], [0.3, { py: -0.05 }], [1, { py: -0.03 }]],
        chest: [[0, { ry: 0.1, rx: 0.06 }], [0.3, { ry: 0.34, rx: 0.02 }], [0.62, { ry: 0.3, rx: 0.02 }], [1, { ry: 0.1, rx: 0.06 }]],
        head: [[0, { ry: 0 }], [0.3, { ry: -0.24, rx: 0.05 }], [0.62, { ry: -0.24 }], [1, { ry: 0 }]],
        armL: [[0, { rx: -0.4, rz: 0.3 }], [0.28, { rx: -1.62, rz: 0.16, ry: -0.1 }], [0.7, { rx: -1.62, rz: 0.16, ry: -0.1 }], [1, { rx: -0.4, rz: 0.3 }]],
        foreL: [[0, { rx: -0.5 }], [0.28, { rx: -0.06 }], [0.7, { rx: -0.06 }], [1, { rx: -0.5 }]],
        armR: [[0, { rx: -0.5, rz: -0.3 }], [0.3, { rx: -1.35, rz: -0.6 }], [0.58, { rx: -1.5, rz: -0.95 }], [0.63, { rx: -1.2, rz: -1.3 }], [1, { rx: -0.5, rz: -0.3 }]],
        foreR: [[0, { rx: -0.8 }], [0.3, { rx: -1.5 }], [0.58, { rx: -2.1 }], [0.63, { rx: -1.4 }], [1, { rx: -0.8 }]],
        legL: [[0, { rx: -0.1, rz: 0.1 }], [0.3, { rx: -0.22, rz: 0.14 }], [1, { rx: -0.1, rz: 0.1 }]],
        legR: [[0, { rx: 0.1, rz: -0.1 }], [0.3, { rx: 0.24, rz: -0.14 }], [1, { rx: 0.1, rz: -0.1 }]],
      },
    },
    guard_hit: {
      dur: 0.34, loop: false, tracks: {
        base: [[0, { pz: 0 }], [0.25, { pz: -0.16 }], [1, { pz: 0 }]],
        armL: [[0, { rx: -1.35, rz: 0.5 }], [0.25, { rx: -1.05, rz: 0.75 }], [1, { rx: -1.35, rz: 0.5 }]],
        chest: [[0, { rx: 0.08 }], [0.25, { rx: -0.16, ry: 0.3 }], [1, { rx: 0.08 }]],
        legL: [[0, { rx: -0.12 }], [0.25, { rx: -0.35 }], [1, { rx: -0.12 }]],
      },
    },
    hit: {
      dur: 0.44, loop: false, tracks: {
        base: [[0, { pz: 0 }], [0.3, { pz: -0.14 }], [1, { pz: 0 }]],
        hip: [[0, { py: 0 }], [0.3, { py: -0.06 }], [1, { py: 0 }]],
        torso: [[0, { rx: 0 }], [0.3, { rx: -0.34 }], [1, { rx: 0 }]],
        chest: [[0, { rx: 0 }], [0.3, { rx: -0.3, ry: 0.24 }], [1, { rx: 0 }]],
        head: [[0, { rx: 0 }], [0.28, { rx: -0.42 }], [1, { rx: 0 }]],
        armL: [[0, { rx: -0.3, rz: 0.3 }], [0.3, { rx: 0.5, rz: 0.85 }], [1, { rx: -0.3, rz: 0.3 }]],
        armR: [[0, { rx: -0.3, rz: -0.3 }], [0.3, { rx: 0.5, rz: -0.85 }], [1, { rx: -0.3, rz: -0.3 }]],
        legL: [[0, { rx: 0 }], [0.3, { rx: 0.3 }], [1, { rx: 0 }]],
        legR: [[0, { rx: 0 }], [0.3, { rx: 0.18 }], [1, { rx: 0 }]],
      },
    },
    death: {
      dur: 1.2, loop: false, tracks: {
        base: [[0, { rx: 0, py: 0 }], [0.25, { rx: -0.35, py: 0.02 }], [0.7, { rx: -1.32, py: 0.2 }], [0.85, { rx: -1.45, py: 0.16 }], [1, { rx: -1.42, py: 0.17 }]],
        hip: [[0, { py: 0 }], [0.4, { py: -0.1 }], [1, { py: -0.05 }]],
        torso: [[0, { rx: 0 }], [0.5, { rx: 0.3 }], [1, { rx: 0.12 }]],
        chest: [[0, { rx: 0 }], [0.5, { rx: 0.2, ry: 0.2 }], [1, { rx: 0.1, ry: 0.1 }]],
        head: [[0, { rx: 0 }], [0.5, { rx: -0.4 }], [1, { rx: 0.3 }]],
        armL: [[0, { rx: -0.2, rz: 0.3 }], [0.5, { rx: 0.9, rz: 1.1 }], [1, { rx: 0.4, rz: 1.35 }]],
        armR: [[0, { rx: -0.2, rz: -0.3 }], [0.5, { rx: 0.9, rz: -1.1 }], [1, { rx: 0.4, rz: -1.35 }]],
        legL: [[0, { rx: 0 }], [0.6, { rx: 0.5 }], [1, { rx: 0.35, rz: 0.2 }]],
        legR: [[0, { rx: 0 }], [0.6, { rx: 0.35 }], [1, { rx: 0.5, rz: -0.2 }]],
        shinL: [[0, { rx: 0 }], [1, { rx: -0.5 }]],
        shinR: [[0, { rx: 0 }], [1, { rx: -0.35 }]],
      },
    },
    backjump: {
      dur: 0.75, loop: false, tracks: {
        hip: [[0, { py: 0 }], [0.2, { py: -0.14 }], [0.45, { py: 0.06 }], [1, { py: 0 }]],
        torso: [[0, { rx: 0.05 }], [0.2, { rx: 0.3 }], [0.5, { rx: -0.14 }], [1, { rx: 0.05 }]],
        legL: [[0, { rx: 0 }], [0.2, { rx: 0.7 }], [0.5, { rx: -0.4 }], [1, { rx: 0 }]],
        legR: [[0, { rx: 0 }], [0.2, { rx: 0.7 }], [0.5, { rx: -0.4 }], [1, { rx: 0 }]],
        shinL: [[0, { rx: 0 }], [0.2, { rx: -0.9 }], [0.5, { rx: 0.2 }], [1, { rx: 0 }]],
        shinR: [[0, { rx: 0 }], [0.2, { rx: -0.9 }], [0.5, { rx: 0.2 }], [1, { rx: 0 }]],
        armL: [[0, { rx: -0.3, rz: 0.3 }], [0.3, { rx: -1.4, rz: 0.5 }], [1, { rx: -0.3, rz: 0.3 }]],
        armR: [[0, { rx: -0.3, rz: -0.3 }], [0.3, { rx: -1.4, rz: -0.5 }], [1, { rx: -0.3, rz: -0.3 }]],
      },
    },
  };
  if (o.extra) Object.assign(clips, o.extra);
  return clips;
}

const RIGS = {
  club: () => defineRig('hilichurl_club', { outline: 0.013 }, (b) => buildHumanoid(b, { weapon: 'club' }), () => humanoidClips()),
  archer: () => defineRig('hilichurl_archer', { outline: 0.013 }, (b) => buildHumanoid(b, {
    weapon: 'bow', colors: { skin: 0x9d7a4c, cloth: 0x5c6b48, mask: 0xcbb98f },
  }), () => humanoidClips()),
  shield: () => defineRig('hilichurl_shield', { outline: 0.013 }, (b) => buildHumanoid(b, {
    weapon: 'club', shield: true, shieldPos: [0, -0.06, -0.24], shieldRot: [1.32, 0.1, 0],
    colors: { skin: 0x8f6440, cloth: 0x5f4a30 },
  }), () => humanoidClips({ guard: true })),
};

export class Hilichurl extends Enemy {
  constructor(ctx, opts = {}) {
    const variant = opts.variant ?? 'club';
    const isArcher = variant === 'archer';
    const isShield = variant === 'shield';
    super(ctx, {
      type: opts.type ?? ('hilichurl' + (isArcher ? '_archer' : isShield ? '_shield' : '')),
      name: opts.name ?? 'Hilichurl',
      hp: opts.hp ?? (isShield ? 320 : isArcher ? 200 : 260),
      poise: opts.poise ?? (isShield ? 55 : 32),
      hitRadius: 0.44, hitHeight: 1.6, headOffset: 1.64,
      damage: opts.damage ?? (isArcher ? 16 : 22),
      element: 'physical',
      ...opts,
      cfg: {
        walkSpeed: 1.7, chaseSpeed: isArcher ? 3.6 : 4.0, strafeSpeed: isArcher ? 1.9 : 1.5,
        turnRate: isArcher ? 3.6 : 3.2, aggroRange: isArcher ? 19 : 16, loseRange: 38,
        attackRange: isArcher ? 18 : 2.6, keepDist: isArcher ? 9.5 : 2.1,
        patrolRadius: 10, mass: isShield ? 1.8 : 1.1, accel: 9,
        ...(opts.cfg ?? {}),
      },
    });
    this.variant = variant;
    this.setupRig(RIGS[variant]());
    this.rigRoot.scale.setScalar(opts.scale ?? 1.03);   // ~1.6 m tall
    this.shieldHits = 0;
    this.shieldBroken = false;

    if (isArcher) {
      this.attacks = {
        shoot: {
          anim: 'shoot', dur: 1.6, cooldown: 2.6, range: 22, minRange: 3.5, weight: 1,
          faceLock: 0.62, faceWhile: true, sfx: 'bow_charge',
          telegraph: { kind: 'cone', angle: 9, radius: 16, time: 0.6, color: 0xffb84a, alpha: 0.9 },
          hits: [{ t: 0.63, fn: (e) => e._shootArrow() }],
        },
        kick: {
          anim: 'attack2', dur: 0.9, cooldown: 2.2, range: 2.6, weight: 1.4,
          faceLock: 0.3,
          telegraph: { kind: 'cone', angle: 80, radius: 2.2, time: 0.34 },
          hits: [{ t: 0.42, fn: (e) => e.strike({ offset: 1.0, radius: 1.5, damage: e.damage * 0.8, knockback: 3, poise: 14 }) }],
        },
      };
    } else {
      this.attacks = {
        swing1: {
          anim: 'attack1', dur: 1.08, cooldown: 2.3, range: 3.0, weight: 1,
          faceLock: 0.42, sfx: 'swing1', next: 'swing2', chainChance: 0.6, maxCombo: 1, chainRange: 3.4,
          telegraph: { kind: 'cone', angle: 85, radius: 2.7, time: 0.44 },
          hits: [{ t: 0.52, fn: (e) => e.strike({ offset: 1.35, radius: 1.75, damage: e.damage, knockback: 3.4, poise: 20, hitstop: 0.07 }) }],
          move: (e, t) => { if (t > 0.42 && t < 0.6) e.wish.copy(e.forward(_v)).multiplyScalar(2.4); },
        },
        swing2: {
          anim: 'attack2', dur: 0.95, cooldown: 2.8, range: 3.0, weight: 0.9,
          faceLock: 0.3, sfx: 'swing2',
          telegraph: { kind: 'cone', angle: 130, radius: 2.6, time: 0.32 },
          hits: [{ t: 0.44, fn: (e) => e.strike({ offset: 1.2, radius: 1.9, angle: 150, shape: 'cone', damage: e.damage * 0.9, knockback: 4.2, poise: 18 }) }],
          move: (e, t) => { if (t > 0.3 && t < 0.52) e.wish.copy(e.forward(_v)).multiplyScalar(1.8); },
        },
        hop: {
          anim: 'backjump', dur: 0.8, cooldown: 4.5, range: 2.0, weight: 0.35,
          faceLock: 0.1,
          hits: [{ t: 0.2, fn: (e) => { e.airborne = true; e.vy = 4.2; e.mv.copy(e.forward(_v)).multiplyScalar(-6.5); } }],
        },
      };
      if (isShield) {
        this.attacks.bash = {
          anim: 'attack1', dur: 0.95, cooldown: 3.0, range: 2.8, weight: 0.8,
          faceLock: 0.35, animSpeed: 1.1,
          telegraph: { kind: 'cone', angle: 60, radius: 2.4, time: 0.36 },
          hits: [{ t: 0.44, fn: (e) => e.strike({ offset: 1.2, radius: 1.6, damage: e.damage * 0.7, knockback: 5.5, poise: 26 }) }],
          move: (e, t) => { if (t > 0.34 && t < 0.62) e.wish.copy(e.forward(_v)).multiplyScalar(5.0); },
        };
      }
    }
  }

  _shootArrow() {
    const from = _v.copy(this.pos);
    from.y += 1.15;
    this.forward(_f);
    from.addScaledVector(_f, 0.42);
    const dir = new THREE.Vector3();
    if (this.target) {
      const tc = this.target.center ? this.target.center(new THREE.Vector3()) : _v.clone();
      dir.copy(tc).sub(from);
      // lead the target a little for a "3A" feel
      const v = this.target.velocity;
      if (v) dir.addScaledVector(v, Math.min(0.45, dir.length() / 34));
    } else dir.copy(_f);
    dir.normalize();
    this.ctx.audio?.sfx?.('bow_shot', { pos: this.pos });
    this.manager?.spawnProjectile({
      kind: 'arrow', pos: from, dir, speed: 34, damage: this.damage * 1.1,
      element: 'physical', radius: 0.45, life: 3.0, gravity: 3.2, source: this,
    });
  }

  /** Wooden shield blocks 70% of frontal damage and breaks after 3 blocked hits. */
  onIncomingDamage(info) {
    if (this.variant !== 'shield' || this.shieldBroken || !info.dir) return null;
    if (this.state === 'stagger' || this.state === 'dead') return null;
    this.forward(_f);
    _v.set(info.dir.x, 0, info.dir.z);
    if (_v.lengthSq() < 1e-6) return null;
    if (_v.normalize().dot(_f) > -0.3) return null;
    const amount = (info.amount ?? 0) * 0.3;
    this.shieldHits++;
    const sb = this.bone('shield');
    if (sb) sb.getWorldPosition(_v); else this.center(_v);
    this.ctx.fx3d?.hitSpark?.(_v, 0xffd27a, 1.25);
    this.ctx.audio?.sfx?.('hit_metal', { pos: _v, rate: 1.2 });
    this.rig?.play('guard_hit', { fade: 0.05, loop: false, restart: true });
    if (this.shieldHits >= 3) this._breakShield();
    return { amount, blocked: true };
  }

  _breakShield() {
    this.shieldBroken = true;
    const sb = this.bone('shield');
    if (sb) { sb.getWorldPosition(_v); this.rig.setBoneRestScale('shield', 0.0001); } else this.center(_v);
    this.ctx.fx3d?.burst?.(_v, 'geo', 0.8);
    this.ctx.fx3d?.dust?.(_v, 14, 0x8a6136);
    this.ctx.audio?.sfx?.('hit_metal', { pos: _v, rate: 0.7 });
    this.ctx.ui?.toast?.('Shield broken', { icon: 'combat', ms: 1200 });
    // enraged: faster and more aggressive without the shield
    this.cfg.chaseSpeed *= 1.25;
    this.cfg.turnRate *= 1.2;
    this.maxPoise = Math.max(20, this.maxPoise * 0.5);
    this.poise = this.maxPoise;
    this.stagger(0.5);
  }

  onUpdate(dt) {
    // archers keep backing off while shooting
    if (this.variant === 'archer' && this.state === 'combat' && this.distToTarget < 4.5) {
      this.wish.addScaledVector(this.dirToTarget, -this.cfg.walkSpeed * 1.6);
    }
  }
}

export function createHilichurl(ctx, opts) { return new Hilichurl(ctx, opts); }
