// Ruin Guard: ancient machine. Cylindrical hull, single glowing eye (weak point),
// blocky armour, mechanical legs. Punch / spin sweep / homing missile volley.
import * as THREE from 'three';
import { clamp, damp, TAU } from '../core/utils.js';
import { Enemy } from './base.js';
import { defineRig } from './rigid.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

const C = {
  hull: 0x8d8579, hullDark: 0x585349, plate: 0xa39a89, trim: 0xb9a271,
  dark: 0x3c3831, rune: 0xffb454, eye: 0xff3b28,
};

function ruinguardRig() {
  return defineRig('ruinguard', { outline: 0.02, ramp: 'metal', rim: 0xcfe4ff }, (b) => {
    b.bone('base', null, [0, 0, 0]);
    b.bone('hip', 'base', [0, 1.62, 0]);
    b.bone('chest', 'hip', [0, 0.42, 0]);
    b.bone('head', 'chest', [0, 0.62, 0]);
    b.bone('eye', 'head', [0, 0.0, 0.26]);
    b.bone('bay', 'chest', [0, 0.16, -0.52], [0, 0, 0]);
    b.bone('shoulderL', 'chest', [0.74, 0.32, 0]);
    b.bone('armL', 'shoulderL', [0, -0.3, 0]);
    b.bone('foreL', 'armL', [0, -0.6, 0]);
    b.bone('fistL', 'foreL', [0, -0.52, 0]);
    b.bone('shoulderR', 'chest', [-0.74, 0.32, 0]);
    b.bone('armR', 'shoulderR', [0, -0.3, 0]);
    b.bone('foreR', 'armR', [0, -0.6, 0]);
    b.bone('fistR', 'foreR', [0, -0.52, 0]);
    b.bone('legL', 'hip', [0.36, -0.18, 0]);
    b.bone('shinL', 'legL', [0, -0.62, 0]);
    b.bone('footL', 'shinL', [0, -0.68, 0]);
    b.bone('legR', 'hip', [-0.36, -0.18, 0]);
    b.bone('shinR', 'legR', [0, -0.62, 0]);
    b.bone('footR', 'shinR', [0, -0.68, 0]);

    const M = 'metal';
    // ---- pelvis
    b.cyl('hip', 0.5, 0.44, 0.46, { color: C.hullDark, group: M, seg: 14 });
    b.torus('hip', 0.5, 0.07, { color: C.trim, group: M, rot: [Math.PI / 2, 0, 0], rs: 6, ts: 18 });
    b.box('hip', 0.34, 0.4, 0.36, { color: C.plate, group: M, pos: [0.44, -0.06, 0], rot: [0, 0, -0.2] });
    b.box('hip', 0.34, 0.4, 0.36, { color: C.plate, group: M, pos: [-0.44, -0.06, 0], rot: [0, 0, 0.2] });

    // ---- hull
    b.cyl('chest', 0.6, 0.56, 1.06, { color: C.hull, group: M, seg: 16 });
    b.torus('chest', 0.63, 0.06, { color: C.trim, group: M, pos: [0, -0.4, 0], rot: [Math.PI / 2, 0, 0], rs: 6, ts: 18 });
    b.torus('chest', 0.6, 0.05, { color: C.trim, group: M, pos: [0, 0.36, 0], rot: [Math.PI / 2, 0, 0], rs: 6, ts: 18 });
    b.box('chest', 0.86, 0.66, 0.28, { color: C.plate, group: M, pos: [0, 0.02, 0.44], rot: [0.04, 0, 0] });
    b.box('chest', 0.2, 0.5, 0.1, { color: C.dark, group: M, pos: [0, 0.02, 0.6] });
    b.box('chest', 0.12, 0.34, 0.06, { color: C.rune, group: 'glow', glow: 1.5, pos: [0, 0.02, 0.63], outline: false });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      b.sphere('chest', 0.05, { color: C.dark, group: M, pos: [Math.sin(a) * 0.6, -0.28, Math.cos(a) * 0.6], ws: 6, hs: 5 });
    }
    b.box('chest', 0.7, 0.2, 0.5, { color: C.hullDark, group: M, pos: [0, 0.44, -0.16] });

    // ---- head + eye
    b.cyl('head', 0.28, 0.4, 0.2, { color: C.hullDark, group: M, pos: [0, -0.2, 0], seg: 14 });
    b.sphere('head', 1, { color: C.hull, group: M, scale: [0.42, 0.4, 0.42], ws: 18, hs: 12 });
    b.box('head', 0.5, 0.14, 0.3, { color: C.plate, group: M, pos: [0, 0.2, 0.16], rot: [0.5, 0, 0] });
    b.cone('head', 0.09, 0.3, { color: C.trim, group: M, pos: [0, 0.36, -0.06], rot: [-0.25, 0, 0], seg: 8 });
    b.torus('eye', 0.21, 0.055, { color: C.dark, group: M, pos: [0, 0, 0.06], rs: 6, ts: 18 });
    b.sphere('eye', 0.165, { color: C.eye, group: 'glow', glow: 2.4, pos: [0, 0, 0.08], ws: 14, hs: 10, outline: false });
    b.sphere('eye', 0.05, { color: 0xffe8c8, group: 'glow', glow: 2.6, pos: [0.05, 0.05, 0.19], ws: 6, hs: 5, outline: false });

    // ---- missile bay
    b.box('bay', 0.82, 0.5, 0.3, { color: C.hullDark, group: M });
    b.box('bay', 0.86, 0.1, 0.34, { color: C.trim, group: M, pos: [0, 0.28, 0] });
    for (let i = 0; i < 4; i++) {
      const x = -0.27 + (i % 2) * 0.54, y = 0.11 - Math.floor(i / 2) * 0.22;
      b.cyl('bay', 0.1, 0.1, 0.34, { color: C.dark, group: M, pos: [x, y, -0.06], rot: [Math.PI / 2, 0, 0], seg: 10 });
      b.sphere('bay', 0.055, { color: C.rune, group: 'glow', glow: 1.4, pos: [x, y, -0.2], ws: 6, hs: 5, outline: false });
    }

    // ---- shoulders + arms
    for (const s of ['L', 'R']) {
      const sgn = s === 'L' ? 1 : -1;
      b.box('shoulder' + s, 0.52, 0.5, 0.56, { color: C.plate, group: M });
      b.box('shoulder' + s, 0.6, 0.14, 0.62, { color: C.hullDark, group: M, pos: [sgn * 0.06, 0.24, 0], rot: [0, 0, -sgn * 0.12] });
      b.sphere('shoulder' + s, 0.2, { color: C.hullDark, group: M, pos: [0, -0.24, 0], ws: 12, hs: 9 });
      b.cyl('arm' + s, 0.19, 0.17, 0.64, { color: C.hull, group: M, pos: [0, -0.31, 0], seg: 12 });
      b.sphere('arm' + s, 0.19, { color: C.hullDark, group: M, pos: [0, -0.62, 0], ws: 12, hs: 9 });
      b.cyl('fore' + s, 0.22, 0.2, 0.6, { color: C.hull, group: M, pos: [0, -0.3, 0], seg: 12 });
      b.box('fore' + s, 0.4, 0.24, 0.4, { color: C.plate, group: M, pos: [0, -0.14, 0] });
      b.box('fist' + s, 0.42, 0.4, 0.46, { color: C.plate, group: M });
      b.sphere('fist' + s, 0.1, { color: C.hullDark, group: M, pos: [sgn * 0.14, 0.14, 0.22], ws: 8, hs: 6 });
      b.sphere('fist' + s, 0.1, { color: C.hullDark, group: M, pos: [sgn * -0.02, 0.14, 0.24], ws: 8, hs: 6 });
    }

    // ---- legs
    for (const s of ['L', 'R']) {
      b.cyl('leg' + s, 0.24, 0.2, 0.64, { color: C.hullDark, group: M, pos: [0, -0.31, 0], seg: 12 });
      b.box('leg' + s, 0.34, 0.3, 0.34, { color: C.plate, group: M, pos: [0, -0.04, 0.02] });
      b.sphere('shin' + s, 0.2, { color: C.hull, group: M, pos: [0, 0, 0], ws: 12, hs: 9 });
      b.cyl('shin' + s, 0.2, 0.22, 0.7, { color: C.hull, group: M, pos: [0, -0.34, 0], seg: 12 });
      b.box('shin' + s, 0.3, 0.24, 0.3, { color: C.plate, group: M, pos: [0, -0.2, -0.1] });
      b.box('foot' + s, 0.46, 0.26, 0.8, { color: C.hullDark, group: M, pos: [0, 0, 0.1] });
      b.box('foot' + s, 0.5, 0.12, 0.3, { color: C.trim, group: M, pos: [0, -0.06, 0.4] });
    }
  }, () => ({
    idle: {
      dur: 3.4, loop: true, tracks: {
        chest: [[0, { py: 0, rx: 0 }], [0.5, { py: 0.035, rx: -0.02 }], [1, { py: 0, rx: 0 }]],
        head: [[0, { ry: -0.3, rx: 0.04 }], [0.3, { ry: 0.0, rx: 0.0 }], [0.65, { ry: 0.32, rx: 0.05 }], [1, { ry: -0.3, rx: 0.04 }]],
        armL: [[0, { rz: 0.1, rx: 0.04 }], [0.5, { rz: 0.13, rx: 0.0 }], [1, { rz: 0.1, rx: 0.04 }]],
        armR: [[0, { rz: -0.1, rx: 0.04 }], [0.5, { rz: -0.13, rx: 0.0 }], [1, { rz: -0.1, rx: 0.04 }]],
        foreL: [[0, { rx: -0.12 }], [1, { rx: -0.12 }]],
        foreR: [[0, { rx: -0.12 }], [1, { rx: -0.12 }]],
      },
    },
    idle_combat: {
      dur: 2.2, loop: true, tracks: {
        hip: [[0, { py: -0.06 }], [0.5, { py: -0.1 }], [1, { py: -0.06 }]],
        chest: [[0, { rx: 0.05, ry: 0.06 }], [0.5, { rx: 0.02, ry: -0.06 }], [1, { rx: 0.05, ry: 0.06 }]],
        armL: [[0, { rz: 0.2, rx: -0.2 }], [0.5, { rz: 0.24, rx: -0.16 }], [1, { rz: 0.2, rx: -0.2 }]],
        armR: [[0, { rz: -0.2, rx: -0.2 }], [0.5, { rz: -0.24, rx: -0.16 }], [1, { rz: -0.2, rx: -0.2 }]],
        foreL: [[0, { rx: -0.5 }], [1, { rx: -0.5 }]],
        foreR: [[0, { rx: -0.5 }], [1, { rx: -0.5 }]],
        legL: [[0, { rx: -0.1 }], [1, { rx: -0.1 }]],
        legR: [[0, { rx: 0.1 }], [1, { rx: 0.1 }]],
      },
    },
    walk: {
      dur: 1.7, loop: true, tracks: {
        hip: [[0, { py: 0, ry: 0 }], [0.25, { py: 0.06, ry: 0.07 }], [0.5, { py: 0, ry: 0 }], [0.75, { py: 0.06, ry: -0.07 }], [1, { py: 0, ry: 0 }]],
        chest: [[0, { ry: -0.08, rx: 0.03 }], [0.5, { ry: 0.08, rx: 0.03 }], [1, { ry: -0.08, rx: 0.03 }]],
        legL: [[0, { rx: 0.42 }], [0.3, { rx: 0.1 }], [0.5, { rx: -0.34 }], [0.8, { rx: 0 }], [1, { rx: 0.42 }]],
        shinL: [[0, { rx: -0.3 }], [0.3, { rx: -0.05 }], [0.5, { rx: 0.36 }], [0.8, { rx: 0.6 }], [1, { rx: -0.3 }]],
        footL: [[0, { rx: 0.1 }], [0.5, { rx: 0.1 }], [1, { rx: 0.1 }]],
        legR: [[0, { rx: -0.34 }], [0.3, { rx: 0 }], [0.5, { rx: 0.42 }], [0.8, { rx: 0.1 }], [1, { rx: -0.34 }]],
        shinR: [[0, { rx: 0.36 }], [0.3, { rx: 0.6 }], [0.5, { rx: -0.3 }], [0.8, { rx: -0.05 }], [1, { rx: 0.36 }]],
        armL: [[0, { rx: -0.3, rz: 0.16 }], [0.5, { rx: 0.24, rz: 0.2 }], [1, { rx: -0.3, rz: 0.16 }]],
        armR: [[0, { rx: 0.24, rz: -0.2 }], [0.5, { rx: -0.3, rz: -0.16 }], [1, { rx: 0.24, rz: -0.2 }]],
        foreL: [[0, { rx: -0.3 }], [1, { rx: -0.3 }]],
        foreR: [[0, { rx: -0.3 }], [1, { rx: -0.3 }]],
      },
    },
    run: {
      dur: 1.15, loop: true, tracks: {
        hip: [[0, { py: 0, ry: 0 }], [0.25, { py: 0.1, ry: 0.1 }], [0.5, { py: 0, ry: 0 }], [0.75, { py: 0.1, ry: -0.1 }], [1, { py: 0, ry: 0 }]],
        chest: [[0, { rx: 0.14, ry: -0.12 }], [0.5, { rx: 0.14, ry: 0.12 }], [1, { rx: 0.14, ry: -0.12 }]],
        legL: [[0, { rx: 0.66 }], [0.3, { rx: 0.16 }], [0.5, { rx: -0.5 }], [0.8, { rx: 0.05 }], [1, { rx: 0.66 }]],
        shinL: [[0, { rx: -0.45 }], [0.3, { rx: -0.1 }], [0.5, { rx: 0.5 }], [0.8, { rx: 0.9 }], [1, { rx: -0.45 }]],
        legR: [[0, { rx: -0.5 }], [0.3, { rx: 0.05 }], [0.5, { rx: 0.66 }], [0.8, { rx: 0.16 }], [1, { rx: -0.5 }]],
        shinR: [[0, { rx: 0.5 }], [0.3, { rx: 0.9 }], [0.5, { rx: -0.45 }], [0.8, { rx: -0.1 }], [1, { rx: 0.5 }]],
        armL: [[0, { rx: -0.6, rz: 0.2 }], [0.5, { rx: 0.5, rz: 0.24 }], [1, { rx: -0.6, rz: 0.2 }]],
        armR: [[0, { rx: 0.5, rz: -0.24 }], [0.5, { rx: -0.6, rz: -0.2 }], [1, { rx: 0.5, rz: -0.24 }]],
      },
    },
    punch: {
      dur: 1.65, loop: false, tracks: {
        base: [[0, { pz: 0 }], [0.42, { pz: -0.12 }], [0.55, { pz: 0.3 }], [1, { pz: 0 }]],
        hip: [[0, { py: -0.06 }], [0.42, { py: 0.04 }], [0.56, { py: -0.26 }], [0.8, { py: -0.16 }], [1, { py: -0.06 }]],
        chest: [[0, { rx: 0.04, ry: 0.1 }], [0.42, { rx: -0.24, ry: 0.42 }], [0.56, { rx: 0.42, ry: -0.2 }], [1, { rx: 0.04, ry: 0.1 }]],
        head: [[0, { rx: 0 }], [0.42, { rx: -0.2 }], [0.56, { rx: 0.34 }], [1, { rx: 0 }]],
        armR: [[0, { rx: -0.2, rz: -0.2 }], [0.42, { rx: -2.1, rz: -0.35 }], [0.56, { rx: 0.9, rz: 0.05 }], [0.75, { rx: 1.0, rz: 0.0 }], [1, { rx: -0.2, rz: -0.2 }]],
        foreR: [[0, { rx: -0.4 }], [0.42, { rx: -0.7 }], [0.56, { rx: -0.05 }], [1, { rx: -0.4 }]],
        armL: [[0, { rx: -0.2, rz: 0.2 }], [0.42, { rx: 0.4, rz: 0.6 }], [0.56, { rx: -0.5, rz: 0.3 }], [1, { rx: -0.2, rz: 0.2 }]],
        legL: [[0, { rx: -0.1 }], [0.56, { rx: 0.4 }], [1, { rx: -0.1 }]],
        legR: [[0, { rx: 0.1 }], [0.56, { rx: -0.36 }], [1, { rx: 0.1 }]],
        shinL: [[0, { rx: 0 }], [0.56, { rx: -0.4 }], [1, { rx: 0 }]],
      },
    },
    sweep: {
      dur: 2.3, loop: false, tracks: {
        hip: [[0, { ry: 0, py: -0.05 }], [0.26, { ry: -0.7, py: -0.16 }], [0.42, { ry: 2.2, py: -0.1 }], [0.62, { ry: 6.4, py: -0.1 }], [0.8, { ry: 10.6, py: -0.1 }], [1, { ry: 12.56, py: -0.05 }]],
        chest: [[0, { rx: 0.05 }], [0.26, { rx: 0.18 }], [0.62, { rx: 0.1 }], [1, { rx: 0.05 }]],
        armL: [[0, { rz: 0.2, rx: -0.2 }], [0.26, { rz: 0.5, rx: -0.4 }], [0.42, { rz: 1.45, rx: 0.1 }], [0.8, { rz: 1.5, rx: 0.05 }], [1, { rz: 0.2, rx: -0.2 }]],
        armR: [[0, { rz: -0.2, rx: -0.2 }], [0.26, { rz: -0.5, rx: -0.4 }], [0.42, { rz: -1.45, rx: 0.1 }], [0.8, { rz: -1.5, rx: 0.05 }], [1, { rz: -0.2, rx: -0.2 }]],
        foreL: [[0, { rx: -0.5 }], [0.42, { rx: -0.05 }], [1, { rx: -0.5 }]],
        foreR: [[0, { rx: -0.5 }], [0.42, { rx: -0.05 }], [1, { rx: -0.5 }]],
        legL: [[0, { rx: 0 }], [0.42, { rx: 0.2 }], [1, { rx: 0 }]],
        legR: [[0, { rx: 0 }], [0.42, { rx: -0.2 }], [1, { rx: 0 }]],
      },
    },
    missile: {
      dur: 2.7, loop: false, tracks: {
        base: [[0, { pz: 0 }], [0.3, { pz: -0.14 }], [1, { pz: 0 }]],
        hip: [[0, { py: -0.05 }], [0.3, { py: 0.02 }], [1, { py: -0.05 }]],
        chest: [[0, { rx: 0.04 }], [0.3, { rx: -0.24 }], [0.8, { rx: -0.2 }], [1, { rx: 0.04 }]],
        head: [[0, { rx: 0 }], [0.3, { rx: -0.22 }], [1, { rx: 0 }]],
        bay: [[0, { rx: 0, py: 0 }], [0.28, { rx: -0.85, py: 0.12 }], [0.85, { rx: -0.85, py: 0.12 }], [1, { rx: 0, py: 0 }]],
        armL: [[0, { rz: 0.2, rx: -0.2 }], [0.3, { rz: 0.65, rx: 0.1 }], [1, { rz: 0.2, rx: -0.2 }]],
        armR: [[0, { rz: -0.2, rx: -0.2 }], [0.3, { rz: -0.65, rx: 0.1 }], [1, { rz: -0.2, rx: -0.2 }]],
      },
    },
    hit: {
      dur: 0.5, loop: false, tracks: {
        base: [[0, { pz: 0 }], [0.3, { pz: -0.14 }], [1, { pz: 0 }]],
        chest: [[0, { rx: 0 }], [0.3, { rx: -0.24, ry: 0.16 }], [1, { rx: 0 }]],
        head: [[0, { rx: 0 }], [0.3, { rx: -0.3 }], [1, { rx: 0 }]],
        armL: [[0, { rz: 0.2 }], [0.3, { rz: 0.6, rx: 0.3 }], [1, { rz: 0.2 }]],
        armR: [[0, { rz: -0.2 }], [0.3, { rz: -0.6, rx: 0.3 }], [1, { rz: -0.2 }]],
      },
    },
    topple: {
      dur: 1.1, loop: false, tracks: {
        base: [[0, { rx: 0, py: 0 }], [0.35, { rx: -0.45, py: 0.05 }], [0.8, { rx: -1.32, py: 0.5 }], [1, { rx: -1.4, py: 0.55 }]],
        chest: [[0, { rx: 0 }], [0.6, { rx: 0.35 }], [1, { rx: 0.2 }]],
        head: [[0, { rx: 0 }], [0.6, { rx: -0.4 }], [1, { rx: 0.3 }]],
        armL: [[0, { rz: 0.2 }], [1, { rz: 1.1, rx: 0.4 }]],
        armR: [[0, { rz: -0.2 }], [1, { rz: -1.1, rx: 0.4 }]],
        legL: [[0, { rx: 0 }], [1, { rx: 0.7 }]],
        legR: [[0, { rx: 0 }], [1, { rx: 0.5 }]],
        shinL: [[0, { rx: 0 }], [1, { rx: -0.6 }]],
        shinR: [[0, { rx: 0 }], [1, { rx: -0.4 }]],
      },
    },
    getup: {
      dur: 1.0, loop: false, tracks: {
        base: [[0, { rx: -1.4, py: 0.55 }], [0.5, { rx: -0.6, py: 0.2 }], [1, { rx: 0, py: 0 }]],
        chest: [[0, { rx: 0.2 }], [0.5, { rx: 0.3 }], [1, { rx: 0 }]],
        legL: [[0, { rx: 0.7 }], [0.5, { rx: 0.4 }], [1, { rx: 0 }]],
        legR: [[0, { rx: 0.5 }], [0.5, { rx: 0.3 }], [1, { rx: 0 }]],
      },
    },
    death: {
      dur: 1.9, loop: false, tracks: {
        base: [[0, { rx: 0, py: 0 }], [0.3, { rx: 0.15, py: -0.06 }], [0.75, { rx: 1.15, py: 0.1 }], [1, { rx: 1.25, py: 0.06 }]],
        hip: [[0, { py: 0 }], [0.4, { py: -0.5 }], [1, { py: -0.62 }]],
        chest: [[0, { rx: 0 }], [0.5, { rx: -0.3 }], [1, { rx: -0.45 }]],
        head: [[0, { rx: 0 }], [0.5, { rx: 0.5 }], [1, { rx: 0.8 }]],
        armL: [[0, { rz: 0.2 }], [1, { rz: 0.9, rx: -0.5 }]],
        armR: [[0, { rz: -0.2 }], [1, { rz: -0.9, rx: -0.5 }]],
        legL: [[0, { rx: 0 }], [1, { rx: -0.5, rz: 0.3 }]],
        legR: [[0, { rx: 0 }], [1, { rx: -0.4, rz: -0.3 }]],
        shinL: [[0, { rx: 0 }], [1, { rx: 1.2 }]],
        shinR: [[0, { rx: 0 }], [1, { rx: 1.0 }]],
      },
    },
  }));
}

export class RuinGuard extends Enemy {
  constructor(ctx, opts = {}) {
    super(ctx, {
      type: 'ruinguard', name: opts.name ?? 'Ruin Guard',
      hp: opts.hp ?? 1600, poise: opts.poise ?? 160,
      hitRadius: 1.7, hitHeight: 4.8, headOffset: 5.3, damage: opts.damage ?? 46,
      element: 'physical', armored: true,
      ...opts,
      cfg: {
        walkSpeed: 1.9, chaseSpeed: 3.5, strafeSpeed: 1.2, accel: 4.2,
        turnRate: 1.5, aggroRange: 22, loseRange: 48, attackRange: 7.6,
        keepDist: 5.6, patrolRadius: 8, mass: 9, kbDamp: 11,
        groundAlign: 0.22, alertTime: 1.1, poiseRegen: 0.1, toppleTime: 3.0,
        sleepRange: 130,
        ...(opts.cfg ?? {}),
      },
    });
    this.setupRig(ruinguardRig());
    const S = opts.scale ?? 1.7;                       // ~5.3 m tall
    this.sizeScale = S;
    this.rigRoot.scale.setScalar(S);
    this.deathAnimTime = 1.9;
    this.dissolveTime = 1.4;
    this.deathSfx = 'hit_metal';
    this._stepPhase = -1;
    this._scan = 0;
    this._eyeFlash = 0;

    // CONTRACT: expose the weak point so combat can double-dip it
    this.weakPoint = {
      obj: this.bone('eye'), radius: 0.5 * S, mult: 2.2,
      pos: (out = new THREE.Vector3()) => this.bone('eye').getWorldPosition(out),
    };

    this.attacks = {
      punch: {
        anim: 'punch', dur: 1.7, cooldown: 3.2, range: 8.0, weight: 1.1,
        faceLock: 0.5, sfx: 'swing3',
        telegraph: { kind: 'cone', angle: 65, radius: 6.6, time: 0.72, color: 0xff7040 },
        hits: [{
          t: 0.94, fn: (e) => {
            e.strike({ offset: 4.0, radius: 3.5, damage: e.damage, knockback: 8, poise: 45, hitstop: 0.09 });
            _v.copy(e.pos).addScaledVector(e.forward(_v2), 4.2);
            e.ctx.fx3d?.ring?.(_v, 0xffa860, 4.4, 0.5);
            e.ctx.fx3d?.dust?.(_v, 14, 0xbfae8e);
            e.ctx.fx3d?.shake?.(0.55, 0.3);
            e.ctx.audio?.sfx?.('hit_metal', { pos: e.pos, rate: 0.6 });
          },
        }],
        move: (e, t) => { if (t > 0.8 && t < 1.0) e.wish.copy(e.forward(_v)).multiplyScalar(4.5); },
      },
      sweep: {
        anim: 'sweep', dur: 2.35, cooldown: 5.0, range: 7.2, weight: 1.0,
        faceLock: 0.4, sfx: 'swing2',
        telegraph: { kind: 'circle', radius: 6.8, time: 0.62, color: 0xff5a3a },
        hits: [
          { t: 0.95, fn: (e) => e._sweepHit() },
          { t: 1.3, fn: (e) => e._sweepHit() },
          { t: 1.68, fn: (e) => e._sweepHit() },
        ],
        move: (e, t) => { if (t > 0.8 && t < 1.9) e.wish.copy(e.forward(_v)).multiplyScalar(2.0); },
      },
      missiles: {
        anim: 'missile', dur: 2.8, cooldown: 6.5, range: 34, minRange: 7.5, weight: 1.3,
        faceLock: 1.0, faceWhile: true, sfx: 'skill_anemo',
        onStart: (e) => { e._eyeFlash = 1; },
        hits: [
          { t: 0.85, fn: (e) => e._fireMissile(0) },
          { t: 1.05, fn: (e) => e._fireMissile(1) },
          { t: 1.25, fn: (e) => e._fireMissile(2) },
          { t: 1.45, fn: (e) => e._fireMissile(3) },
        ],
      },
    };
  }

  _sweepHit() {
    this.strike({ offset: 0.8, radius: 6.4, damage: this.damage * 0.8, knockback: 9, poise: 40, hitstop: 0.08 });
    this.ctx.fx3d?.ring?.(this.pos, 0xffc080, 6.4, 0.35);
    this.ctx.fx3d?.dust?.(this.pos, 8, 0xbfae8e);
    this.ctx.fx3d?.shake?.(0.3, 0.2);
  }

  _fireMissile(i) {
    const bay = this.bone('bay');
    if (!bay) return;
    bay.getWorldPosition(_v);
    const x = -0.27 + (i % 2) * 0.54, y = 0.11 - Math.floor(i / 2) * 0.22;
    _v2.set(x, y, -0.25);
    bay.localToWorld(_v2);
    const dir = new THREE.Vector3(0, 0.85, 0);
    dir.x += (i % 2 ? 0.5 : -0.5);
    dir.normalize();
    this._eyeFlash = 1;
    this.ctx.audio?.sfx?.('skill_pyro', { pos: this.pos, rate: 1.3 });
    this.manager?.spawnProjectile({
      kind: 'missile', pos: _v2.clone(), dir, speed: 12, damage: this.damage * 0.55,
      element: 'physical', radius: 0.55, life: 5.0, gravity: -1.6, homing: 2.2,
      color: 0xffa060, source: this,
    });
    this.ctx.fx3d?.dust?.(_v2, 4, 0x999089);
  }

  onEnterState(s, prev) {
    if (s === 'alert' && prev !== 'stagger') {
      this._eyeFlash = 1;
      this.ctx.fx3d?.shake?.(0.3, 0.2);
      this.ctx.audio?.sfx?.('enemy_alert', { pos: this.pos, rate: 0.6 });
    }
  }

  onUpdate(dt) {
    // eye scan + glow pulse
    const eye = this.bone('eye');
    const head = this.bone('head');
    this._eyeFlash = Math.max(0, this._eyeFlash - dt * 2.2);
    if (eye) {
      const pulse = 1 + Math.sin(this.age * 3.2) * 0.06 + this._eyeFlash * 0.5;
      eye.scale.setScalar(pulse);
    }
    if (head && !this.aggro) {
      this._scan = damp(this._scan, Math.sin(this.age * 0.55) * 0.55, 2, dt);
      head.rotation.y += this._scan;
    }
    // heavy footsteps
    const rig = this.rig;
    if (!rig?.clip || (rig.name !== 'walk' && rig.name !== 'run')) { this._stepPhase = -1; return; }
    const phase = rig.normalized < 0.5 ? 0 : 1;
    if (this._stepPhase !== phase) {
      const first = this._stepPhase < 0;
      this._stepPhase = phase;
      if (!first && this.distToCamera < 50) {
        this.ctx.fx3d?.dust?.(this.pos, 5, 0xbfae8e);
        this.ctx.fx3d?.shake?.(0.3, 0.15);
        this.ctx.audio?.sfx?.('footstep_stone', { pos: this.pos, vol: 0.9, rate: 0.55 });
      }
    }
  }

  onDie() {
    this.ctx.fx3d?.shake?.(0.7, 0.5);
    this.ctx.fx3d?.dust?.(this.pos, 20, 0x9a9086);
    const eye = this.bone('eye');
    if (eye) { eye.getWorldPosition(_v); this.ctx.fx3d?.hitSpark?.(_v, 0xff3b28, 2.2); }
  }
}

export function createRuinGuard(ctx, opts) { return new RuinGuard(ctx, opts); }
