// Dvalin (simplified Stormterror): giant flying dragon boss.
// Long neck + head, deformable wing membranes, verlet tail, three phases,
// boss HP bar signal, roars and screen shake.
import * as THREE from 'three';
import { clamp, damp, lerp, smoothstep, wrapAngle, TAU } from '../core/utils.js';
import { makeGlowTexture } from '../core/textures.js';
import { Enemy } from './base.js';
import { defineRig, bodyMaterial, VerletChain, ELEMENT_HEX } from './rigid.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3(), _m = new THREE.Matrix4();

const COL = {
  hide: 0x51607e, hideDark: 0x3c4763, belly: 0x9daabb, membrane: 0x6d7c9e,
  horn: 0xd9cdb6, spine: 0x37415a, claw: 0xe8e0cf, eye: 0x9ff2dc,
};

let _windTex = null;
function windTex() { if (!_windTex) _windTex = makeGlowTexture(64, 2.0); return _windTex; }

function dvalinRig() {
  return defineRig('boss_dvalin', { outline: 0.035, rim: 0xa8e8ff, rimStrength: 0.75, membraneOpacity: 0.94 }, (b) => {
    b.bone('base', null, [0, 0, 0]);
    b.bone('body', 'base', [0, 2.0, 0]);
    b.bone('hips', 'body', [0, 0.1, -2.1]);
    b.bone('shoulder', 'body', [0, 0.55, 1.9]);
    b.bone('neck1', 'shoulder', [0, 0.35, 0.7], [-0.25, 0, 0]);
    b.bone('neck2', 'neck1', [0, 0.62, 0.42], [-0.2, 0, 0]);
    b.bone('neck3', 'neck2', [0, 0.6, 0.5], [0.2, 0, 0]);
    b.bone('neck4', 'neck3', [0, 0.4, 0.62], [0.28, 0, 0]);
    b.bone('head', 'neck4', [0, 0.12, 0.66], [0.05, 0, 0]);
    b.bone('jaw', 'head', [0, -0.16, 0.28]);
    b.bone('wingLA', 'body', [1.1, 0.72, 0.45], [0, -0.22, -0.12]);
    b.bone('wingLB', 'wingLA', [2.55, 0, 0], [0, 0.4, 0.18]);
    b.bone('wingLC', 'wingLB', [2.45, 0, 0], [0, 0.45, 0.12]);
    b.bone('wingRA', 'body', [-1.1, 0.72, 0.45], [0, 0.22, 0.12]);
    b.bone('wingRB', 'wingRA', [-2.55, 0, 0], [0, -0.4, -0.18]);
    b.bone('wingRC', 'wingRB', [-2.45, 0, 0], [0, -0.45, -0.12]);
    b.bone('legL', 'hips', [0.82, -0.5, 0.1], [0.35, 0, 0]);
    b.bone('shinL', 'legL', [0, -1.05, 0], [-0.7, 0, 0]);
    b.bone('footL', 'shinL', [0, -0.95, 0], [0.4, 0, 0]);
    b.bone('legR', 'hips', [-0.82, -0.5, 0.1], [0.35, 0, 0]);
    b.bone('shinR', 'legR', [0, -1.05, 0], [-0.7, 0, 0]);
    b.bone('footR', 'shinR', [0, -0.95, 0], [0.4, 0, 0]);
    for (let i = 0; i < 6; i++) b.bone('tail' + i, 'base', [0, 2, -2.5 - i * 0.9]);

    // ---------------- torso
    b.sphere('body', 1, { color: COL.hide, scale: [1.45, 1.34, 2.6], ws: 22, hs: 16 });
    b.sphere('body', 1, { color: COL.belly, scale: [1.1, 0.62, 2.1], pos: [0, -0.85, 0.1], ws: 18, hs: 12 });
    for (let i = 0; i < 6; i++) {
      b.box('body', 1.5 - i * 0.08, 0.12, 0.34, { color: COL.belly, pos: [0, -1.15 + i * 0.03, 1.3 - i * 0.5], rot: [0.1, 0, 0] });
    }
    for (let i = 0; i < 7; i++) {
      const z = 1.9 - i * 0.62;
      b.cone('body', 0.16 - i * 0.008, 0.5 - i * 0.02, { color: COL.spine, pos: [0, 1.25 - i * 0.03, z], rot: [-0.35, 0, 0], seg: 6 });
    }
    b.sphere('hips', 1, { color: COL.hide, scale: [1.1, 1.0, 1.15], ws: 16, hs: 12 });
    b.sphere('shoulder', 1, { color: COL.hide, scale: [1.02, 0.95, 0.9], ws: 16, hs: 12 });

    // ---------------- neck
    const necks = [['neck1', 0.5], ['neck2', 0.45], ['neck3', 0.4], ['neck4', 0.35]];
    for (const [n, r] of necks) {
      b.sphere(n, 1, { color: COL.hide, scale: [r, r * 1.05, r * 1.35], ws: 14, hs: 10 });
      b.cone(n, r * 0.32, r * 0.9, { color: COL.spine, pos: [0, r * 0.95, -0.05], rot: [-0.4, 0, 0], seg: 6 });
      b.sphere(n, 1, { color: COL.belly, scale: [r * 0.6, r * 0.4, r * 1.2], pos: [0, -r * 0.72, 0.02], ws: 10, hs: 8 });
    }

    // ---------------- head
    b.sphere('head', 1, { color: COL.hide, scale: [0.62, 0.56, 0.98], ws: 18, hs: 14 });
    b.cone('head', 0.37, 0.86, { color: COL.hide, pos: [0, -0.02, 0.88], rot: [Math.PI / 2, 0, 0], seg: 12 });
    b.sphere('head', 0.09, { color: COL.hideDark, pos: [0.14, 0.06, 1.06], ws: 8, hs: 6 });
    b.sphere('head', 0.09, { color: COL.hideDark, pos: [-0.14, 0.06, 1.06], ws: 8, hs: 6 });
    b.box('head', 0.72, 0.16, 0.44, { color: COL.hideDark, pos: [0, 0.3, 0.34], rot: [0.22, 0, 0] });
    // big swept horns
    b.cone('head', 0.17, 1.9, { color: COL.horn, pos: [0.5, 0.46, -0.42], rot: [1.0, 0.6, -0.85], seg: 9 });
    b.cone('head', 0.17, 1.9, { color: COL.horn, pos: [-0.5, 0.46, -0.42], rot: [1.0, -0.6, 0.85], seg: 9 });
    b.cone('head', 0.08, 0.6, { color: COL.horn, pos: [0.36, 0.22, -0.1], rot: [0.9, 0.5, -0.7], seg: 7 });
    b.cone('head', 0.08, 0.6, { color: COL.horn, pos: [-0.36, 0.22, -0.1], rot: [0.9, -0.5, 0.7], seg: 7 });
    b.cone('head', 0.07, 0.34, { color: COL.horn, pos: [0.3, -0.14, 0.2], rot: [1.4, 0.4, -1.0], seg: 6 });
    b.cone('head', 0.07, 0.34, { color: COL.horn, pos: [-0.3, -0.14, 0.2], rot: [1.4, -0.4, 1.0], seg: 6 });
    // glowing eyes
    b.sphere('head', 0.12, { color: COL.eye, group: 'glow', glow: 2.2, pos: [0.31, 0.16, 0.5], ws: 10, hs: 8, outline: false });
    b.sphere('head', 0.12, { color: COL.eye, group: 'glow', glow: 2.2, pos: [-0.31, 0.16, 0.5], ws: 10, hs: 8, outline: false });
    // jaw + teeth
    b.box('jaw', 0.46, 0.2, 0.9, { color: COL.hideDark, pos: [0, -0.04, 0.42], rot: [0.06, 0, 0] });
    b.sphere('jaw', 1, { color: COL.belly, scale: [0.24, 0.16, 0.4], pos: [0, -0.1, 0.3], ws: 10, hs: 8 });
    for (let i = 0; i < 4; i++) {
      const z = 0.28 + i * 0.2;
      b.cone('jaw', 0.045, 0.16, { color: COL.claw, pos: [0.18, 0.08, z], seg: 5, outline: false });
      b.cone('jaw', 0.045, 0.16, { color: COL.claw, pos: [-0.18, 0.08, z], seg: 5, outline: false });
      b.cone('head', 0.045, 0.16, { color: COL.claw, pos: [0.2, -0.16, z + 0.06], rot: [0, 0, Math.PI], seg: 5, outline: false });
      b.cone('head', 0.045, 0.16, { color: COL.claw, pos: [-0.2, -0.16, z + 0.06], rot: [0, 0, Math.PI], seg: 5, outline: false });
    }

    // ---------------- wings (bones extend along +-X)
    for (const s of ['L', 'R']) {
      const g = s === 'L' ? 1 : -1;
      b.sphere('wing' + s + 'A', 0.42, { color: COL.hide, ws: 12, hs: 9 });
      b.cyl('wing' + s + 'A', 0.2, 0.15, 2.5, { color: COL.hide, pos: [g * 1.27, 0, 0], rot: [0, 0, -g * Math.PI / 2], seg: 10 });
      b.sphere('wing' + s + 'B', 0.26, { color: COL.hideDark, ws: 10, hs: 8 });
      b.cyl('wing' + s + 'B', 0.15, 0.11, 2.4, { color: COL.hide, pos: [g * 1.22, 0, 0], rot: [0, 0, -g * Math.PI / 2], seg: 9 });
      b.sphere('wing' + s + 'C', 0.18, { color: COL.hideDark, ws: 10, hs: 8 });
      b.cyl('wing' + s + 'C', 0.11, 0.05, 2.2, { color: COL.hide, pos: [g * 1.1, 0, 0], rot: [0, 0, -g * Math.PI / 2], seg: 8 });
      b.cone('wing' + s + 'C', 0.09, 0.44, { color: COL.claw, pos: [g * 2.3, 0.02, 0], rot: [0, 0, -g * 1.35], seg: 7 });
      // membrane finger ribs, swept back along the sail
      b.cyl('wing' + s + 'B', 0.05, 0.028, 2.0, { color: COL.hideDark, pos: [g * 1.25, -0.22, -0.95], rot: [1.38, 0, -g * 0.42], seg: 6 });
      b.cyl('wing' + s + 'C', 0.045, 0.025, 2.3, { color: COL.hideDark, pos: [g * 1.15, -0.24, -1.1], rot: [1.34, 0, -g * 0.36], seg: 6 });
    }

    // ---------------- hind legs
    for (const s of ['L', 'R']) {
      const g = s === 'L' ? 1 : -1;
      b.sphere('leg' + s, 0.4, { color: COL.hide, ws: 12, hs: 9 });
      b.cyl('leg' + s, 0.44, 0.33, 1.05, { color: COL.hide, pos: [0, -0.52, 0], seg: 10 });
      b.sphere('shin' + s, 0.33, { color: COL.hideDark, ws: 10, hs: 8 });
      b.cyl('shin' + s, 0.3, 0.23, 0.95, { color: COL.hide, pos: [0, -0.48, 0], seg: 10 });
      b.sphere('leg' + s, 1, { color: COL.hide, scale: [0.5, 0.62, 0.5], pos: [0, -0.3, -0.05], ws: 12, hs: 9 });
      b.box('foot' + s, 0.56, 0.26, 0.86, { color: COL.hideDark, pos: [0, -0.06, 0.18] });
      for (let i = 0; i < 3; i++) {
        b.cone('foot' + s, 0.07, 0.34, { color: COL.claw, pos: [(i - 1) * 0.15, -0.08, 0.56], rot: [1.5, 0, 0], seg: 6 });
      }
    }

    // ---------------- tail segments (verlet driven, geometry points along +Z)
    for (let i = 0; i < 6; i++) {
      const r0 = 0.74 - i * 0.108, r1 = 0.632 - i * 0.108;
      b.cyl('tail' + i, Math.max(0.07, r1), Math.max(0.09, r0), 0.94, { color: COL.hide, pos: [0, 0, 0.46], rot: [Math.PI / 2, 0, 0], seg: 10 });
      b.cone('tail' + i, Math.max(0.05, r0 * 0.42), 0.36, { color: COL.spine, pos: [0, r0 * 0.85, 0.3], rot: [-0.5, 0, 0], seg: 6 });
      if (i === 5) {
        // single spade fin so the silhouette stays clean
        b.cone('tail' + i, 0.62, 1.5, { color: COL.membrane, scale: [1, 1, 0.16], pos: [0, 0.12, 1.0], rot: [-1.0, 0, 0], seg: 3 });
        b.cone('tail' + i, 0.3, 0.7, { color: COL.spine, scale: [1, 1, 0.3], pos: [0, -0.2, 0.72], rot: [Math.PI + 0.5, 0, 0], seg: 3 });
      }
    }
  }, () => ({
    fly: {
      dur: 1.9, loop: true, tracks: {
        body: [[0, { py: 0.25, rx: 0.04 }], [0.3, { py: -0.2, rx: -0.03 }], [0.65, { py: 0.3, rx: 0.05 }], [1, { py: 0.25, rx: 0.04 }]],
        wingLA: [[0, { rz: 0.62, ry: -0.1 }], [0.3, { rz: -0.42, ry: 0.12 }], [0.65, { rz: 0.66, ry: -0.12 }], [1, { rz: 0.62, ry: -0.1 }]],
        wingLB: [[0, { rz: 0.3, ry: 0.15 }], [0.3, { rz: -0.28, ry: -0.1 }], [0.65, { rz: 0.34, ry: 0.16 }], [1, { rz: 0.3, ry: 0.15 }]],
        wingLC: [[0, { rz: 0.24 }], [0.35, { rz: -0.3 }], [0.7, { rz: 0.26 }], [1, { rz: 0.24 }]],
        wingRA: [[0, { rz: -0.62, ry: 0.1 }], [0.3, { rz: 0.42, ry: -0.12 }], [0.65, { rz: -0.66, ry: 0.12 }], [1, { rz: -0.62, ry: 0.1 }]],
        wingRB: [[0, { rz: -0.3, ry: -0.15 }], [0.3, { rz: 0.28, ry: 0.1 }], [0.65, { rz: -0.34, ry: -0.16 }], [1, { rz: -0.3, ry: -0.15 }]],
        wingRC: [[0, { rz: -0.24 }], [0.35, { rz: 0.3 }], [0.7, { rz: -0.26 }], [1, { rz: -0.24 }]],
        neck1: [[0, { rx: 0.06 }], [0.5, { rx: -0.05 }], [1, { rx: 0.06 }]],
        neck3: [[0, { rx: -0.06 }], [0.5, { rx: 0.07 }], [1, { rx: -0.06 }]],
        head: [[0, { rx: 0.05 }], [0.5, { rx: -0.06 }], [1, { rx: 0.05 }]],
        legL: [[0, { rx: 0.5 }], [1, { rx: 0.5 }]],
        legR: [[0, { rx: 0.5 }], [1, { rx: 0.5 }]],
        shinL: [[0, { rx: -1.1 }], [1, { rx: -1.1 }]],
        shinR: [[0, { rx: -1.1 }], [1, { rx: -1.1 }]],
      },
    },
    glide: {
      dur: 3.2, loop: true, tracks: {
        body: [[0, { rx: 0.02 }], [0.5, { rx: -0.02 }], [1, { rx: 0.02 }]],
        wingLA: [[0, { rz: 0.14 }], [0.5, { rz: 0.24 }], [1, { rz: 0.14 }]],
        wingLB: [[0, { rz: 0.05 }], [0.5, { rz: 0.12 }], [1, { rz: 0.05 }]],
        wingRA: [[0, { rz: -0.14 }], [0.5, { rz: -0.24 }], [1, { rz: -0.14 }]],
        wingRB: [[0, { rz: -0.05 }], [0.5, { rz: -0.12 }], [1, { rz: -0.05 }]],
        legL: [[0, { rx: 0.6 }], [1, { rx: 0.6 }]],
        legR: [[0, { rx: 0.6 }], [1, { rx: 0.6 }]],
        shinL: [[0, { rx: -1.2 }], [1, { rx: -1.2 }]],
        shinR: [[0, { rx: -1.2 }], [1, { rx: -1.2 }]],
      },
    },
    dive: {
      dur: 2.0, loop: true, tracks: {
        body: [[0, { rx: 0.2 }], [1, { rx: 0.2 }]],
        wingLA: [[0, { rz: -0.15, ry: 0.55 }], [1, { rz: -0.15, ry: 0.55 }]],
        wingLB: [[0, { rz: -0.1, ry: 0.6 }], [1, { rz: -0.1, ry: 0.6 }]],
        wingLC: [[0, { rz: -0.05, ry: 0.5 }], [1, { rz: -0.05, ry: 0.5 }]],
        wingRA: [[0, { rz: 0.15, ry: -0.55 }], [1, { rz: 0.15, ry: -0.55 }]],
        wingRB: [[0, { rz: 0.1, ry: -0.6 }], [1, { rz: 0.1, ry: -0.6 }]],
        wingRC: [[0, { rz: 0.05, ry: -0.5 }], [1, { rz: 0.05, ry: -0.5 }]],
        neck1: [[0, { rx: 0.15 }], [1, { rx: 0.15 }]],
        neck2: [[0, { rx: 0.12 }], [1, { rx: 0.12 }]],
        jaw: [[0, { rx: 0.3 }], [0.5, { rx: 0.5 }], [1, { rx: 0.3 }]],
      },
    },
    ground_idle: {
      dur: 3.6, loop: true, tracks: {
        base: [[0, { py: -0.35 }], [1, { py: -0.35 }]],
        body: [[0, { py: -0.05, rx: 0.02 }], [0.5, { py: 0.05, rx: -0.02 }], [1, { py: -0.05, rx: 0.02 }]],
        wingLA: [[0, { rz: 0.35, ry: 1.15 }], [0.5, { rz: 0.42, ry: 1.2 }], [1, { rz: 0.35, ry: 1.15 }]],
        wingLB: [[0, { rz: 0.2, ry: 1.5 }], [1, { rz: 0.2, ry: 1.5 }]],
        wingLC: [[0, { rz: 0.1, ry: 1.3 }], [1, { rz: 0.1, ry: 1.3 }]],
        wingRA: [[0, { rz: -0.35, ry: -1.15 }], [0.5, { rz: -0.42, ry: -1.2 }], [1, { rz: -0.35, ry: -1.15 }]],
        wingRB: [[0, { rz: -0.2, ry: -1.5 }], [1, { rz: -0.2, ry: -1.5 }]],
        wingRC: [[0, { rz: -0.1, ry: -1.3 }], [1, { rz: -0.1, ry: -1.3 }]],
        neck1: [[0, { rx: 0.16 }], [0.5, { rx: 0.1 }], [1, { rx: 0.16 }]],
        neck2: [[0, { rx: 0.1 }], [0.5, { rx: 0.16 }], [1, { rx: 0.1 }]],
        head: [[0, { rx: -0.2, ry: -0.18 }], [0.5, { rx: -0.14, ry: 0.18 }], [1, { rx: -0.2, ry: -0.18 }]],
        legL: [[0, { rx: -0.15 }], [1, { rx: -0.15 }]],
        legR: [[0, { rx: -0.15 }], [1, { rx: -0.15 }]],
        shinL: [[0, { rx: 0.2 }], [1, { rx: 0.2 }]],
        shinR: [[0, { rx: 0.2 }], [1, { rx: 0.2 }]],
      },
    },
    walk: {
      dur: 1.9, loop: true, tracks: {
        base: [[0, { py: -0.35 }], [1, { py: -0.35 }]],
        body: [[0, { py: 0, ry: 0.05, rz: 0.03 }], [0.5, { py: 0.08, ry: -0.05, rz: -0.03 }], [1, { py: 0, ry: 0.05, rz: 0.03 }]],
        legL: [[0, { rx: 0.55 }], [0.5, { rx: -0.5 }], [1, { rx: 0.55 }]],
        shinL: [[0, { rx: -0.6 }], [0.5, { rx: 0.3 }], [1, { rx: -0.6 }]],
        legR: [[0, { rx: -0.5 }], [0.5, { rx: 0.55 }], [1, { rx: -0.5 }]],
        shinR: [[0, { rx: 0.3 }], [0.5, { rx: -0.6 }], [1, { rx: 0.3 }]],
        wingLA: [[0, { rz: 0.4, ry: 1.1 }], [0.5, { rz: 0.55, ry: 1.0 }], [1, { rz: 0.4, ry: 1.1 }]],
        wingRA: [[0, { rz: -0.4, ry: -1.1 }], [0.5, { rz: -0.55, ry: -1.0 }], [1, { rz: -0.4, ry: -1.1 }]],
        wingLB: [[0, { rz: 0.2, ry: 1.45 }], [1, { rz: 0.2, ry: 1.45 }]],
        wingRB: [[0, { rz: -0.2, ry: -1.45 }], [1, { rz: -0.2, ry: -1.45 }]],
        neck1: [[0, { rx: 0.2, ry: 0.06 }], [0.5, { rx: 0.14, ry: -0.06 }], [1, { rx: 0.2, ry: 0.06 }]],
        head: [[0, { rx: -0.2 }], [1, { rx: -0.2 }]],
      },
    },
    roar: {
      dur: 2.4, loop: false, tracks: {
        body: [[0, { rx: 0 }], [0.35, { rx: -0.14 }], [1, { rx: 0 }]],
        neck1: [[0, { rx: 0 }], [0.3, { rx: -0.5 }], [0.75, { rx: -0.45 }], [1, { rx: 0 }]],
        neck2: [[0, { rx: 0 }], [0.3, { rx: -0.4 }], [0.75, { rx: -0.35 }], [1, { rx: 0 }]],
        neck3: [[0, { rx: 0 }], [0.3, { rx: 0.2 }], [1, { rx: 0 }]],
        head: [[0, { rx: 0 }], [0.3, { rx: 0.55 }], [0.75, { rx: 0.5 }], [1, { rx: 0 }]],
        jaw: [[0, { rx: 0 }], [0.28, { rx: 0.75 }], [0.72, { rx: 0.65 }], [1, { rx: 0 }]],
        wingLA: [[0, { rz: 0.3, ry: 0 }], [0.35, { rz: 1.0, ry: -0.35 }], [1, { rz: 0.3, ry: 0 }]],
        wingRA: [[0, { rz: -0.3, ry: 0 }], [0.35, { rz: -1.0, ry: 0.35 }], [1, { rz: -0.3, ry: 0 }]],
        wingLB: [[0, { rz: 0.1 }], [0.35, { rz: 0.5 }], [1, { rz: 0.1 }]],
        wingRB: [[0, { rz: -0.1 }], [0.35, { rz: -0.5 }], [1, { rz: -0.1 }]],
      },
    },
    breath: {
      dur: 4.2, loop: false, tracks: {
        body: [[0, { rx: 0 }], [0.25, { rx: -0.1 }], [0.4, { rx: 0.08 }], [1, { rx: 0 }]],
        neck1: [[0, { rx: 0.05 }], [0.25, { rx: -0.42 }], [0.42, { rx: 0.24 }], [0.8, { rx: 0.2 }], [1, { rx: 0.05 }]],
        neck2: [[0, { rx: 0 }], [0.25, { rx: -0.3 }], [0.42, { rx: 0.2 }], [1, { rx: 0 }]],
        neck3: [[0, { rx: 0 }], [0.25, { rx: 0.2 }], [0.42, { rx: -0.1 }], [1, { rx: 0 }]],
        head: [[0, { rx: 0 }], [0.25, { rx: 0.45 }], [0.42, { rx: -0.12 }], [0.8, { rx: -0.1 }], [1, { rx: 0 }]],
        jaw: [[0, { rx: 0 }], [0.22, { rx: 0.5 }], [0.42, { rx: 0.9 }], [0.8, { rx: 0.85 }], [1, { rx: 0 }]],
        wingLA: [[0, { rz: 0.35 }], [0.3, { rz: 0.75 }], [0.6, { rz: 0.5 }], [1, { rz: 0.35 }]],
        wingRA: [[0, { rz: -0.35 }], [0.3, { rz: -0.75 }], [0.6, { rz: -0.5 }], [1, { rz: -0.35 }]],
      },
    },
    claw: {
      dur: 2.0, loop: false, tracks: {
        base: [[0, { py: -0.35, pz: 0 }], [0.35, { py: -0.3, pz: -0.2 }], [0.55, { py: -0.35, pz: 0.7 }], [1, { py: -0.35, pz: 0 }]],
        body: [[0, { ry: 0, rz: 0 }], [0.35, { ry: 0.4, rz: -0.16 }], [0.55, { ry: -0.42, rz: 0.2 }], [1, { ry: 0, rz: 0 }]],
        wingLA: [[0, { rz: 0.35, ry: 1.15 }], [0.35, { rz: 1.15, ry: 0.2 }], [0.55, { rz: -0.35, ry: 1.5 }], [1, { rz: 0.35, ry: 1.15 }]],
        wingLB: [[0, { rz: 0.2, ry: 1.5 }], [0.35, { rz: 0.6, ry: 0.4 }], [0.55, { rz: -0.2, ry: 1.7 }], [1, { rz: 0.2, ry: 1.5 }]],
        wingLC: [[0, { rz: 0.1, ry: 1.3 }], [0.35, { rz: 0.3, ry: 0.3 }], [0.55, { rz: -0.1, ry: 1.6 }], [1, { rz: 0.1, ry: 1.3 }]],
        neck1: [[0, { rx: 0.16 }], [0.35, { rx: -0.3 }], [0.55, { rx: 0.35 }], [1, { rx: 0.16 }]],
        head: [[0, { rx: -0.2 }], [0.35, { rx: 0.2, ry: 0.3 }], [0.55, { rx: 0.1, ry: -0.3 }], [1, { rx: -0.2 }]],
        jaw: [[0, { rx: 0 }], [0.5, { rx: 0.6 }], [1, { rx: 0 }]],
      },
    },
    tailsweep: {
      dur: 2.3, loop: false, tracks: {
        base: [[0, { py: -0.35, ry: 0 }], [0.3, { py: -0.32, ry: -0.5 }], [0.62, { py: -0.32, ry: 1.5 }], [1, { py: -0.35, ry: 0 }]],
        body: [[0, { rz: 0 }], [0.3, { rz: 0.16, rx: -0.1 }], [0.62, { rz: -0.2, rx: 0.08 }], [1, { rz: 0 }]],
        hips: [[0, { ry: 0 }], [0.3, { ry: -0.3 }], [0.62, { ry: 0.4 }], [1, { ry: 0 }]],
        neck1: [[0, { rx: 0.16, ry: 0 }], [0.3, { rx: 0, ry: 0.35 }], [0.62, { rx: 0.1, ry: -0.4 }], [1, { rx: 0.16, ry: 0 }]],
        wingLA: [[0, { rz: 0.35, ry: 1.15 }], [0.4, { rz: 0.7, ry: 0.8 }], [1, { rz: 0.35, ry: 1.15 }]],
        wingRA: [[0, { rz: -0.35, ry: -1.15 }], [0.4, { rz: -0.7, ry: -0.8 }], [1, { rz: -0.35, ry: -1.15 }]],
      },
    },
    gust: {
      dur: 2.6, loop: false, tracks: {
        base: [[0, { py: -0.35 }], [0.4, { py: -0.1 }], [0.62, { py: 0.5 }], [0.85, { py: -0.2 }], [1, { py: -0.35 }]],
        body: [[0, { rx: 0 }], [0.4, { rx: -0.2 }], [0.62, { rx: 0.12 }], [1, { rx: 0 }]],
        wingLA: [[0, { rz: 0.35, ry: 1.1 }], [0.4, { rz: 1.25, ry: -0.1 }], [0.64, { rz: -0.55, ry: 0.1 }], [1, { rz: 0.35, ry: 1.1 }]],
        wingLB: [[0, { rz: 0.2, ry: 1.45 }], [0.4, { rz: 0.7, ry: 0.1 }], [0.64, { rz: -0.4, ry: 0.2 }], [1, { rz: 0.2, ry: 1.45 }]],
        wingLC: [[0, { rz: 0.1, ry: 1.3 }], [0.4, { rz: 0.4, ry: 0.1 }], [0.64, { rz: -0.3, ry: 0.2 }], [1, { rz: 0.1, ry: 1.3 }]],
        wingRA: [[0, { rz: -0.35, ry: -1.1 }], [0.4, { rz: -1.25, ry: 0.1 }], [0.64, { rz: 0.55, ry: -0.1 }], [1, { rz: -0.35, ry: -1.1 }]],
        wingRB: [[0, { rz: -0.2, ry: -1.45 }], [0.4, { rz: -0.7, ry: -0.1 }], [0.64, { rz: 0.4, ry: -0.2 }], [1, { rz: -0.2, ry: -1.45 }]],
        wingRC: [[0, { rz: -0.1, ry: -1.3 }], [0.4, { rz: -0.4, ry: -0.1 }], [0.64, { rz: 0.3, ry: -0.2 }], [1, { rz: -0.1, ry: -1.3 }]],
        neck1: [[0, { rx: 0.16 }], [0.4, { rx: -0.4 }], [0.64, { rx: 0.3 }], [1, { rx: 0.16 }]],
        jaw: [[0, { rx: 0 }], [0.55, { rx: 0.7 }], [1, { rx: 0 }]],
      },
    },
    land: {
      dur: 2.6, loop: false, tracks: {
        base: [[0, { py: 0 }], [0.55, { py: -0.1 }], [0.75, { py: -0.5 }], [1, { py: -0.35 }]],
        body: [[0, { rx: -0.2 }], [0.5, { rx: 0.16 }], [0.78, { rx: 0.05 }], [1, { rx: 0 }]],
        wingLA: [[0, { rz: 0.7, ry: -0.2 }], [0.45, { rz: 1.2, ry: -0.4 }], [0.8, { rz: 0.3, ry: 1.0 }], [1, { rz: 0.35, ry: 1.15 }]],
        wingLB: [[0, { rz: 0.3 }], [0.45, { rz: 0.7, ry: 0.2 }], [1, { rz: 0.2, ry: 1.5 }]],
        wingRA: [[0, { rz: -0.7, ry: 0.2 }], [0.45, { rz: -1.2, ry: 0.4 }], [0.8, { rz: -0.3, ry: -1.0 }], [1, { rz: -0.35, ry: -1.15 }]],
        wingRB: [[0, { rz: -0.3 }], [0.45, { rz: -0.7, ry: -0.2 }], [1, { rz: -0.2, ry: -1.5 }]],
        legL: [[0, { rx: 0.6 }], [0.6, { rx: -0.4 }], [0.8, { rx: 0.1 }], [1, { rx: -0.15 }]],
        legR: [[0, { rx: 0.6 }], [0.6, { rx: -0.4 }], [0.8, { rx: 0.1 }], [1, { rx: -0.15 }]],
        shinL: [[0, { rx: -1.2 }], [0.6, { rx: 0.5 }], [1, { rx: 0.2 }]],
        shinR: [[0, { rx: -1.2 }], [0.6, { rx: 0.5 }], [1, { rx: 0.2 }]],
        neck1: [[0, { rx: -0.2 }], [0.6, { rx: 0.3 }], [1, { rx: 0.16 }]],
        jaw: [[0, { rx: 0.4 }], [0.5, { rx: 0.7 }], [1, { rx: 0 }]],
      },
    },
    takeoff: {
      dur: 2.2, loop: false, tracks: {
        base: [[0, { py: -0.35 }], [0.3, { py: -0.6 }], [0.6, { py: 0.4 }], [1, { py: 0 }]],
        body: [[0, { rx: 0 }], [0.3, { rx: 0.2 }], [0.6, { rx: -0.24 }], [1, { rx: 0 }]],
        wingLA: [[0, { rz: 0.35, ry: 1.15 }], [0.3, { rz: -0.4, ry: 0.2 }], [0.6, { rz: 1.3, ry: -0.3 }], [1, { rz: 0.6, ry: -0.1 }]],
        wingRA: [[0, { rz: -0.35, ry: -1.15 }], [0.3, { rz: 0.4, ry: -0.2 }], [0.6, { rz: -1.3, ry: 0.3 }], [1, { rz: -0.6, ry: 0.1 }]],
        wingLB: [[0, { rz: 0.2, ry: 1.5 }], [0.3, { rz: -0.2, ry: 0.2 }], [0.6, { rz: 0.6 }], [1, { rz: 0.3, ry: 0.15 }]],
        wingRB: [[0, { rz: -0.2, ry: -1.5 }], [0.3, { rz: 0.2, ry: -0.2 }], [0.6, { rz: -0.6 }], [1, { rz: -0.3, ry: -0.15 }]],
        legL: [[0, { rx: -0.15 }], [0.4, { rx: -0.6 }], [1, { rx: 0.5 }]],
        legR: [[0, { rx: -0.15 }], [0.4, { rx: -0.6 }], [1, { rx: 0.5 }]],
        shinL: [[0, { rx: 0.2 }], [1, { rx: -1.1 }]],
        shinR: [[0, { rx: 0.2 }], [1, { rx: -1.1 }]],
        jaw: [[0, { rx: 0 }], [0.5, { rx: 0.6 }], [1, { rx: 0.1 }]],
      },
    },
    hit: {
      dur: 0.5, loop: false, tracks: {
        body: [[0, { rx: 0 }], [0.3, { rx: -0.1, rz: 0.08 }], [1, { rx: 0 }]],
        neck1: [[0, { rx: 0 }], [0.3, { rx: -0.2 }], [1, { rx: 0 }]],
        head: [[0, { rx: 0 }], [0.3, { rx: -0.25, ry: 0.2 }], [1, { rx: 0 }]],
        jaw: [[0, { rx: 0 }], [0.3, { rx: 0.5 }], [1, { rx: 0 }]],
      },
    },
    death: {
      dur: 3.2, loop: false, tracks: {
        base: [[0, { py: 0, rx: 0, rz: 0 }], [0.35, { py: -0.2, rx: 0.1, rz: 0.2 }], [0.7, { py: -0.5, rx: -0.1, rz: 0.45 }], [1, { py: -0.5, rx: -0.05, rz: 0.5 }]],
        body: [[0, { rx: 0 }], [0.5, { rx: 0.1 }], [1, { rx: 0.05, rz: 0.1 }]],
        neck1: [[0, { rx: 0 }], [0.3, { rx: -0.5 }], [1, { rx: 0.5 }]],
        neck2: [[0, { rx: 0 }], [0.3, { rx: -0.3 }], [1, { rx: 0.4 }]],
        neck3: [[0, { rx: 0 }], [1, { rx: 0.3 }]],
        head: [[0, { rx: 0 }], [0.3, { rx: 0.5 }], [1, { rx: -0.2, ry: 0.4 }]],
        jaw: [[0, { rx: 0 }], [0.3, { rx: 0.8 }], [1, { rx: 0.2 }]],
        wingLA: [[0, { rz: 0.35, ry: 0 }], [0.4, { rz: 1.0, ry: -0.3 }], [1, { rz: -0.25, ry: 1.2 }]],
        wingRA: [[0, { rz: -0.35, ry: 0 }], [0.4, { rz: -1.0, ry: 0.3 }], [1, { rz: 0.25, ry: -1.2 }]],
        wingLB: [[0, { rz: 0.2 }], [1, { rz: -0.2, ry: 1.6 }]],
        wingRB: [[0, { rz: -0.2 }], [1, { rz: 0.2, ry: -1.6 }]],
        legL: [[0, { rx: 0.5 }], [1, { rx: -0.3 }]],
        legR: [[0, { rx: 0.5 }], [1, { rx: -0.5 }]],
      },
    },
  }));
}

// ---------------------------------------------------------------- membrane
class WingMembrane {
  constructor(bones, side, parent) {
    this.side = side;
    this.g = side === 'L' ? 1 : -1;
    this.bones = [bones.get('wing' + side + 'A'), bones.get('wing' + side + 'B'), bones.get('wing' + side + 'C')];
    this.US = 8; this.VS = 4;
    const verts = this.US * this.VS;
    const pos = new Float32Array(verts * 3);
    const col = new Float32Array(verts * 3);
    const c = new THREE.Color(COL.membrane), c2 = new THREE.Color(COL.hideDark);
    const idx = [];
    for (let u = 0; u < this.US; u++) for (let v = 0; v < this.VS; v++) {
      const i = u * this.VS + v;
      const cc = v === 0 ? c2 : c;
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    for (let u = 0; u < this.US - 1; u++) for (let v = 0; v < this.VS - 1; v++) {
      const a = u * this.VS + v, b = a + 1, d = a + this.VS, e = d + 1;
      if (this.g > 0) idx.push(a, d, b, b, d, e);
      else idx.push(a, b, d, b, e, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(verts * 2), 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, bodyMaterial({ ramp: 'hard', rim: 0xa8e8ff, rimStrength: 0.65, opacity: 0.95, doubleSide: true }));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this._L = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.parent = parent;
  }
  update(flap) {
    const inv = _m.copy(this.parent.matrixWorld).invert();
    const B = this.bones;
    B[0].getWorldPosition(this._L[0]).applyMatrix4(inv);
    B[1].getWorldPosition(this._L[1]).applyMatrix4(inv);
    B[2].getWorldPosition(this._L[2]).applyMatrix4(inv);
    _v.set(this.g * 2.3, 0, 0);
    B[2].localToWorld(_v);
    this._L[3].copy(_v).applyMatrix4(inv);

    const pos = this.geo.attributes.position;
    const root = this._L[0];
    for (let u = 0; u < this.US; u++) {
      const t = u / (this.US - 1);
      // sample the 4-point leading edge polyline
      const seg = Math.min(2, Math.floor(t * 3));
      const lt = clamp(t * 3 - seg, 0, 1);
      _v2.copy(this._L[seg]).lerp(this._L[seg + 1], lt);
      // trailing edge: quadratic curve from the hip out to behind the wing tip,
      // bulging backwards so the sail has a real chord
      const tip = this._L[3];
      const t0x = root.x * 0.6, t0y = root.y - 0.62, t0z = -1.95;
      const t1x = tip.x * 0.9, t1y = tip.y - 0.5, t1z = tip.z - 1.5;
      const cx = (t0x + t1x) * 0.5 * 1.06, cy = (t0y + t1y) * 0.5 - 0.42, cz = Math.min(t0z, t1z) - 1.7;
      const it = 1 - t;
      _v3.set(
        it * it * t0x + 2 * it * t * cx + t * t * t1x,
        it * it * t0y + 2 * it * t * cy + t * t * t1y,
        it * it * t0z + 2 * it * t * cz + t * t * t1z);
      for (let v = 0; v < this.VS; v++) {
        const vv = v / (this.VS - 1);
        const i = u * this.VS + v;
        const x = lerp(_v2.x, _v3.x, vv);
        const y = lerp(_v2.y, _v3.y, vv) - Math.sin(Math.PI * vv) * (0.5 + t * 0.7) * (1 - flap * 0.5);
        const z = lerp(_v2.z, _v3.z, vv);
        pos.setXYZ(i, x, y + Math.sin(t * 3.1 + flap * 4) * 0.06 * vv, z);
      }
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
  dispose() { this.geo.dispose(); }
}

// ---------------------------------------------------------------- boss
export class DvalinBoss extends Enemy {
  constructor(ctx, opts = {}) {
    super(ctx, {
      type: 'boss_dvalin', name: opts.name ?? 'Stormterror Dvalin',
      hp: opts.hp ?? 12000, poise: opts.poise ?? 420,
      hitRadius: 3.4, hitHeight: 5.4, headOffset: 6.4, damage: opts.damage ?? 70,
      element: 'anemo', isBoss: true, armored: false,
      ...opts,
      cfg: {
        walkSpeed: 3.0, chaseSpeed: 9.5, strafeSpeed: 3.0, accel: 3.0,
        turnRate: 1.0, aggroRange: 60, loseRange: 200, attackRange: 40,
        keepDist: 8, canPatrol: false, mass: 100, kbDamp: 14,
        groundAlign: 0.12, alertTime: 0.4, poiseRegen: 0.06,
        sleepRange: 400, climbRate: 2.2, outlineRange: 200, hpBarRange: 0,
        orbitRadius: 22, airAltitude: 13, lowAltitude: 8, groundOffset: 0.95,
        ...(opts.cfg ?? {}),
      },
    });
    this.setupRig(dvalinRig());
    this.rigRoot.scale.setScalar(opts.scale ?? 1.15);   // ~19 m wingspan, ~13 m long
    this.displayName = opts.displayName ?? '\u98a8\u9b54\u9f8d \u00b7 \u7279\u74e6\u6797';
    this.phase = opts.phase ?? 1;
    this.flying = this.phase !== 2;
    if (opts.altitude != null) { this.cfg.airAltitude = opts.altitude; this.cfg.lowAltitude = Math.min(opts.altitude, this.cfg.lowAltitude); }
    this.altitude = this.flying ? this.cfg.airAltitude : (this.cfg.groundOffset ?? 0);
    this.deathAnimTime = 3.2;
    this.dissolveTime = 2.2;
    this.deathSfx = 'dragon_roar';
    this.orbitDir = this.rng() < 0.5 ? 1 : -1;
    this._breathT = 0;
    this._windT = 0;
    this._fieldTick = 0;
    this._transTo = 0;

    const baseBone = this.bone('base');
    this.membranes = [new WingMembrane(this.bones, 'L', baseBone), new WingMembrane(this.bones, 'R', baseBone)];
    this.tail = new VerletChain(6, 0.94, { gravity: -2.0, damp: 0.9, restPull: 0.16, sag: -0.1 });
    this._extraMeshes = [this.membranes[0].mesh, this.membranes[1].mesh];

    this._makeBreath();
    this._makeWindField();

    this.attacks = {
      dive: {
        anim: 'dive', dur: 3.6, cooldown: 5.0, range: 90, minRange: 6, weight: 1.1,
        faceLock: 1.05, sfx: 'wind_gust',
        onStart: (e) => {
          e._diveTarget = e.tPos.clone();
          e._diveHit = false;
          if (e._tele) { e._teleAt = e._diveTarget.clone(); e._teleFollow = false; }
        },
        telegraph: { kind: 'circle', radius: 5.0, time: 1.05, color: 0x8ff0dc },
        hits: [
          { t: 1.85, fn: (e) => e._diveImpact() },
          { t: 2.1, fn: (e) => e._diveImpact() },
        ],
        move: (e, t) => {
          const target = e._diveTarget ?? e.tPos;
          if (t < 1.05) {
            e.altitude = damp(e.altitude, e.cfg.airAltitude + 3, 2, 0.016);
            e.rig?.play('fly', { fade: 0.3, speed: 1.35 });
          } else if (t < 2.35) {
            e.cfg.climbRate = 7;
            e.altitude = 2.6;
            e.pitch = 0.28;
            _v.set(target.x - e.pos.x, 0, target.z - e.pos.z);
            const d = _v.length();
            if (d > 0.4) _v.multiplyScalar(1 / d);
            e.wish.copy(_v).multiplyScalar(24);
            e.yawTarget = Math.atan2(_v.x, _v.z);
            e.rig?.play('dive', { fade: 0.2 });
          } else {
            e.cfg.climbRate = 3.2;
            e.altitude = e.phase === 3 ? e.cfg.lowAltitude : e.cfg.airAltitude;
            e.pitch = damp(e.pitch ?? 0, -0.12, 3, 0.016);
            e.wish.copy(e.forward(_v)).multiplyScalar(10);
            e.rig?.play('fly', { fade: 0.25, speed: 1.5 });
          }
        },
      },
      breath: {
        anim: 'breath', dur: 4.4, cooldown: 7.0, range: 40, minRange: 8, weight: 1.0,
        faceLock: 1.5, faceWhile: true, sfx: 'dragon_roar',
        telegraph: { kind: 'cone', angle: 46, radius: 22, time: 1.35, color: 0x8ff0dc },
        onStart: (e) => { e._breathT = 0; },
        hits: (() => {
          const list = [];
          for (let i = 0; i < 8; i++) list.push({ t: 1.5 + i * 0.22, fn: (e) => e._breathTick() });
          return list;
        })(),
        move: (e, t) => {
          if (e.flying) { e.altitude = damp(e.altitude, 11, 2.5, 0.016); e.wish.set(0, 0, 0); }
          e._breathActive = t > 1.4 && t < 3.4;
        },
      },
      blades: {
        anim: 'gust', dur: 2.8, cooldown: 5.5, range: 60, minRange: 5, weight: 1.0,
        faceLock: 1.0, faceWhile: true, sfx: 'wind_gust',
        hits: (() => {
          const list = [];
          for (let i = 0; i < 5; i++) list.push({ t: 1.0 + i * 0.12, fn: (e) => e._fireBlade(i - 2) });
          return list;
        })(),
        move: (e) => { if (e.flying) e.wish.set(0, 0, 0); },
      },
      claw: {
        anim: 'claw', dur: 2.1, cooldown: 3.4, range: 9.5, weight: 1.4,
        faceLock: 0.75, sfx: 'swing3',
        telegraph: { kind: 'cone', angle: 95, radius: 8.5, time: 0.78 },
        hits: [{
          t: 1.05, fn: (e) => {
            e.strike({ offset: 5.0, radius: 4.6, damage: e.damage, element: 'anemo', knockback: 12, poise: 90, hitstop: 0.1 });
            _v.copy(e.pos).addScaledVector(e.forward(_v2), 5.0);
            e.ctx.fx3d?.ring?.(_v, 0x8ff0dc, 4.6, 0.5);
            e.ctx.fx3d?.shake?.(0.6, 0.3);
            e.ctx.fx3d?.dust?.(_v, 16, 0xb8c4d0);
          },
        }],
        move: (e, t) => { if (t > 0.9 && t < 1.2) e.wish.copy(e.forward(_v)).multiplyScalar(6); },
      },
      tailsweep: {
        anim: 'tailsweep', dur: 2.4, cooldown: 4.6, range: 11, weight: 1.1,
        faceLock: 0.6, sfx: 'swing2',
        telegraph: { kind: 'circle', radius: 9.5, time: 0.7, color: 0xa8e0ff },
        hits: [
          { t: 0.95, fn: (e) => e._tailHit() },
          { t: 1.25, fn: (e) => e._tailHit() },
        ],
      },
      gust: {
        anim: 'gust', dur: 2.7, cooldown: 6.0, range: 16, weight: 0.9,
        faceLock: 0.5, sfx: 'wind_gust',
        telegraph: { kind: 'circle', radius: 11, time: 1.3, color: 0x74c8a8 },
        hits: [{
          t: 1.42, fn: (e) => {
            e.strike({ offset: 0, radius: 11, damage: e.damage * 0.55, element: 'anemo', knockback: 20, poise: 80, hitstop: 0.08 });
            e.ctx.fx3d?.ring?.(e.pos, 0x74c8a8, 11, 0.8);
            e.ctx.fx3d?.burst?.(e.center(_v), 'anemo', 2.2);
            e.ctx.fx3d?.shake?.(0.9, 0.5);
            e.ctx.audio?.sfx?.('wind_gust', { pos: e.pos });
            if (e.ctx.fx?.uRadial) e._radialPulse = 1;
          },
        }],
      },
    };
    // spawning with { phase: 2 } gives the integrator a grounded, immediately visible
    // boss (no fly-in), which is what a scripted "the dragon lands" beat wants
    if (this.phase === 2) {
      this.flying = false;
      this.engaged = true;
      this.aggro = true;
      this.rig.play('ground_idle', { fade: 0 });
      this.atkCd = 1.4;
      this.setState('combat');
    } else {
      this.setState('intro');
    }
  }

  center(out = _v) {
    const b = this.bone('body');
    if (b) return b.getWorldPosition(out);
    return out.set(this.pos.x, this.pos.y + 2.2, this.pos.z);
  }

  // ---------------------------------------------------------- fx bits
  _makeBreath() {
    const n = 42;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this._breathPts = new THREE.Points(g, new THREE.PointsMaterial({
      size: 2.2, map: windTex(), color: 0x9ff2dc, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, opacity: 0,
    }));
    this._breathPts.frustumCulled = false;
    this.ctx.scene?.add(this._breathPts);
    this._breathData = [];
    for (let i = 0; i < n; i++) this._breathData.push({ t: this.rng(), a: this.rng() * TAU, r: this.rng() });
  }
  _makeWindField() {
    const n = 90;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this._windPts = new THREE.Points(g, new THREE.PointsMaterial({
      size: 1.5, map: windTex(), color: 0x74c8a8, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, opacity: 0,
    }));
    this._windPts.frustumCulled = false;
    this.ctx.scene?.add(this._windPts);
    this._windData = [];
    for (let i = 0; i < n; i++) this._windData.push({ a: this.rng() * TAU, r: 6 + this.rng() * 16, y: this.rng() * 6, s: 0.6 + this.rng() * 1.1 });
  }

  _mouth(out = _v) {
    const jaw = this.bone('jaw');
    if (!jaw) return this.center(out);
    out.set(0, 0.1, 1.0);
    jaw.localToWorld(out);
    return out;
  }

  _breathTick() {
    this._mouth(_v);
    this.forward(_v2);
    if (this.target) {
      const tc = this.target.center ? this.target.center(_v3) : _v3.copy(this.target.position);
      _v2.copy(tc).sub(_v).normalize();
    }
    this.strike({
      origin: _v.clone(), dir: _v2.clone(), shape: 'cone', angle: 48, radius: 22,
      damage: this.damage * 0.3, element: 'anemo', knockback: 6, poise: 25, hitstop: 0.04, once: true,
    });
    this.ctx.fx3d?.shake?.(0.22, 0.2);
  }

  _fireBlade(i) {
    this._mouth(_v);
    this.forward(_v2);
    const a = i * 0.22;
    const dir = new THREE.Vector3(
      _v2.x * Math.cos(a) - _v2.z * Math.sin(a), -0.06,
      _v2.x * Math.sin(a) + _v2.z * Math.cos(a)).normalize();
    this.manager?.spawnProjectile({
      kind: 'blade', pos: _v.clone(), dir, speed: 24, damage: this.damage * 0.35,
      element: 'anemo', radius: 1.1, life: 4.0, gravity: 0, spin: 9, scale: 1.3,
      color: 0x9ff2dc, source: this,
    });
    this.ctx.audio?.sfx?.('wind_gust', { pos: this.pos, vol: 0.5, rate: 1.3 });
  }

  _tailHit() {
    const t5 = this.bone('tail4');
    if (t5) t5.getWorldPosition(_v); else this.center(_v);
    this.strike({
      origin: _v.clone(), dir: this.forward(_v2).clone().negate(), shape: 'sphere', radius: 6.0,
      damage: this.damage * 0.75, element: 'anemo', knockback: 14, poise: 70, hitstop: 0.09,
    });
    this.ctx.fx3d?.ring?.(_v, 0xa8e0ff, 5.5, 0.4);
    this.ctx.fx3d?.dust?.(_v, 12, 0xb8c4d0);
    this.ctx.fx3d?.shake?.(0.5, 0.28);
  }

  _diveImpact() {
    if (this._diveHit) return;
    this._diveHit = true;
    this.strike({ offset: 2.0, radius: 5.4, damage: this.damage * 1.1, element: 'anemo', knockback: 16, poise: 100, hitstop: 0.11 });
    this.ctx.fx3d?.ring?.(this.pos, 0x8ff0dc, 6, 0.7);
    this.ctx.fx3d?.dust?.(this.pos, 22, 0xb8c4d0);
    this.ctx.fx3d?.shake?.(0.85, 0.4);
    this.ctx.audio?.sfx?.('wind_gust', { pos: this.pos });
  }

  roar(shake = 0.9) {
    this.rig?.play('roar', { fade: 0.15, loop: false });
    this.ctx.audio?.sfx?.('dragon_roar', { pos: this.pos });
    this.ctx.fx3d?.shake?.(shake, 0.7);
    this._radialPulse = 1;
  }

  // ---------------------------------------------------------- AI
  pickAttack() {
    const air = this.phase !== 2;
    const pool = air
      ? (this.phase === 3 ? ['blades', 'dive', 'breath', 'blades'] : ['dive', 'breath', 'blades'])
      : ['claw', 'tailsweep', 'gust', 'breath'];
    const usable = pool.filter((k) => {
      const a = this.attacks[k];
      return a && this.distToTarget >= (a.minRange ?? 0) && this.distToTarget <= (a.range ?? 99);
    });
    if (!usable.length) return null;
    return usable[Math.floor(this.rng() * usable.length) % usable.length];
  }

  onState(state, dt) {
    if (state === 'intro') {
      this.flying = true;
      this.altitude = this.cfg.airAltitude;
      this.wish.set(0, 0, 0);
      if (this.stateT < 0.05) this.roar(1.1);
      this._orbit(dt, 0.35);
      if (this.stateT > 3.0) { this.aggro = true; this.engaged = true; this.setState('combat'); }
      return true;
    }
    if (state === 'transition') {
      this.wish.set(0, 0, 0);
      if (this._transTo === 2) {
        this.flying = true;
        this.cfg.climbRate = 3.0;
        this.altitude = damp(this.altitude, this.cfg.groundOffset ?? 0.5, 1.8, dt);
        if (this.target) this.faceTarget(dt);
        if (this.stateT > 2.4) {
          this.flying = false;
          this.altitude = 0;
          this.phase = 2;
          this.ctx.fx3d?.ring?.(this.pos, 0x74c8a8, 12, 0.9);
          this.ctx.fx3d?.dust?.(this.pos, 26, 0xb8c4d0);
          this.ctx.fx3d?.shake?.(1.0, 0.6);
          this.roar(1.0);
          this.atkCd = 1.6;
          this.setState('combat');
        }
        return true;
      }
      this.flying = true;
      this.cfg.climbRate = 2.6;
      this.altitude = damp(this.altitude, this.cfg.lowAltitude, 1.8, dt);
      if (this.stateT > 2.2) {
        this.phase = 3;
        this.atkCd = 1.2;
        this.setState('combat');
      }
      return true;
    }
    if (state === 'chase' || state === 'combat') {
      this._checkPhase();
      if (!this.target) { this._orbit(dt, 0.5); return true; }
      if (this.phase === 2) this._groundAI(dt);
      else this._airAI(dt);
      return true;
    }
    return false;
  }

  _checkPhase() {
    const frac = this.hp / this.maxHp;
    if (this.phase === 1 && frac < 0.66) {
      this._transTo = 2;
      this.releaseToken();
      this.hideTelegraph();
      this.rig?.play('land', { fade: 0.25, loop: false });
      this.ctx.ui?.subtitle?.('\u98a8\u9b54\u9f8d\u964d\u843d\u4e86\uff01', 2200);
      this.setState('transition');
      return true;
    }
    if (this.phase === 2 && frac < 0.3) {
      this._transTo = 3;
      this.releaseToken();
      this.hideTelegraph();
      this.rig?.play('takeoff', { fade: 0.2, loop: false });
      this.roar(1.2);
      this.ctx.ui?.subtitle?.('\u72c2\u6012\uff1a\u98a8\u66b4\u964d\u4e34\uff01', 2400);
      this.setState('transition');
      return true;
    }
    return false;
  }

  _orbit(dt, speedScale = 1) {
    const cfg = this.cfg;
    const cx = this.target ? this.tPos.x : this.home.x;
    const cz = this.target ? this.tPos.z : this.home.z;
    const a = Math.atan2(this.pos.x - cx, this.pos.z - cz) + this.orbitDir * 0.55 * speedScale;
    const r = cfg.orbitRadius;
    _v.set(cx + Math.sin(a) * r, 0, cz + Math.cos(a) * r);
    _v2.set(_v.x - this.pos.x, 0, _v.z - this.pos.z);
    const d = _v2.length();
    if (d > 0.5) _v2.multiplyScalar(1 / d);
    this.wish.copy(_v2).multiplyScalar(cfg.chaseSpeed * speedScale);
    this.yawTarget = Math.atan2(_v2.x, _v2.z);
    this.roll = damp(this.roll ?? 0, -this.orbitDir * 0.3 * speedScale, 2, dt);
    this.pitch = damp(this.pitch ?? 0, -0.05, 2, dt);
  }

  _airAI(dt) {
    const cfg = this.cfg;
    this.flying = true;
    this.cfg.climbRate = 2.2;
    this.altitude = damp(this.altitude, this.phase === 3 ? cfg.lowAltitude : cfg.airAltitude, 1.2, dt);
    this._orbit(dt, 1);
    this.rig?.play(this.rig.name === 'roar' && !this.rig.finished ? 'roar' : 'fly', { fade: 0.3, speed: 1 });
    this.atkCd -= dt;
    if (this.atkCd <= 0) {
      const key = this.pickAttack();
      if (key) { this.requestToken(); this.startAttack(key); }
      else this.atkCd = 0.5;
    }
  }

  _groundAI(dt) {
    const cfg = this.cfg;
    this.flying = false;
    this.roll = damp(this.roll ?? 0, 0, 3, dt);
    this.pitch = damp(this.pitch ?? 0, 0, 3, dt);
    this.faceTarget(dt);
    const err = this.distToTarget - cfg.keepDist;
    if (Math.abs(err) > 1.5) {
      this.wish.copy(this.dirToTarget).multiplyScalar(clamp(err, -1, 1) * cfg.walkSpeed);
      this.rig?.play('walk', { fade: 0.3 });
    } else {
      this.wish.set(0, 0, 0);
      this.rig?.play('ground_idle', { fade: 0.3 });
    }
    this.atkCd -= dt;
    if (this.atkCd <= 0) {
      const key = this.pickAttack();
      if (key) { this.requestToken(); this.startAttack(key); }
      else this.atkCd = 0.5;
    }
  }

  // ---------------------------------------------------------- per frame
  onUpdate(dt) {
    // boss HP bar (CONTRACT 2.5)
    this.ctx.ui?.hud?.setBoss?.(this.displayName, this.hp, this.maxHp);
    // a boss keeps the combat signal up through intros and phase transitions
    if (this.alive && this.engaged) this.aggro = true;

    // wing membranes follow the bones
    const flap = this.rig?.name === 'fly' ? Math.sin(this.rig.normalized * TAU) * 0.5 + 0.5 : 0.35;
    for (const m of this.membranes) m.update(flap);

    // verlet tail
    const hips = this.bone('hips'), baseBone = this.bone('base');
    if (hips && baseBone) {
      hips.getWorldPosition(_v);
      _v2.set(0, 0, -1).applyQuaternion(this.root.quaternion).normalize();
      _v.addScaledVector(_v2, 1.4);
      this.tail.update(dt, _v, _v2);
      // never let the tail sink through the terrain
      for (let i = 1; i < this.tail.p.length; i++) {
        const tp = this.tail.p[i];
        const gy = this.groundY(tp.x, tp.z) + 0.45;
        if (tp.y < gy) { tp.y = gy; this.tail.prev[i].y = gy; }
      }
      const inv = _m.copy(baseBone.matrixWorld).invert();
      for (let i = 0; i < 6; i++) {
        const bone = this.bone('tail' + i);
        if (!bone) continue;
        _v3.copy(this.tail.p[i]).applyMatrix4(inv);
        bone.position.copy(_v3);
        const next = this.tail.p[Math.min(5, i + 1)];
        if (i === 5) { _v4.copy(this.tail.p[5]).sub(this.tail.p[4]).add(this.tail.p[5]); bone.lookAt(_v4); }
        else bone.lookAt(next);
      }
    }

    // breath cone particles
    const bp = this._breathPts;
    if (bp) {
      const on = !!this._breathActive;
      bp.material.opacity = damp(bp.material.opacity, on ? 0.85 : 0, 6, dt);
      if (bp.material.opacity > 0.01) {
        this._mouth(_v);
        this.forward(_v2);
        if (this.target) {
          const tc = this.target.center ? this.target.center(_v3) : _v3.copy(this.target.position);
          _v2.copy(tc).sub(_v).normalize();
        }
        const arr = bp.geometry.attributes.position.array;
        const side = _v3.set(-_v2.z, 0, _v2.x);
        for (let i = 0; i < this._breathData.length; i++) {
          const d = this._breathData[i];
          d.t += dt * (0.5 + d.r * 0.7);
          if (d.t > 1) d.t -= 1;
          const dist = d.t * 20;
          const spread = 0.22 * dist * (0.4 + d.r * 0.6);
          arr[i * 3] = _v.x + _v2.x * dist + Math.cos(d.a + d.t * 4) * spread * side.x + Math.sin(d.a) * spread * 0.2;
          arr[i * 3 + 1] = _v.y + _v2.y * dist + Math.sin(d.a + d.t * 5) * spread * 0.9;
          arr[i * 3 + 2] = _v.z + _v2.z * dist + Math.cos(d.a + d.t * 4) * spread * side.z;
        }
        bp.geometry.attributes.position.needsUpdate = true;
      }
    }

    // phase 3 wind field: constant pressure + slow chip damage
    const wp = this._windPts;
    if (wp) {
      const on = this.phase === 3 && this.alive;
      wp.material.opacity = damp(wp.material.opacity, on ? 0.7 : 0, 3, dt);
      if (wp.material.opacity > 0.01) {
        const arr = wp.geometry.attributes.position.array;
        for (let i = 0; i < this._windData.length; i++) {
          const d = this._windData[i];
          d.a += dt * d.s * 0.9;
          d.y += dt * d.s * 1.6;
          if (d.y > 9) { d.y = 0; d.r = 6 + this.rng() * 16; }
          arr[i * 3] = this.pos.x + Math.cos(d.a) * d.r;
          arr[i * 3 + 1] = this.groundY(this.pos.x, this.pos.z) + d.y;
          arr[i * 3 + 2] = this.pos.z + Math.sin(d.a) * d.r;
        }
        wp.geometry.attributes.position.needsUpdate = true;
      }
      if (on) {
        this._fieldTick -= dt;
        if (this._fieldTick <= 0) {
          this._fieldTick = 1.4;
          if (this.target && this.distToTarget < 24) {
            this.strike({
              origin: this.pos.clone(), dir: this.dirToTarget.clone(), shape: 'sphere', radius: 24,
              damage: this.damage * 0.12, element: 'anemo', knockback: 1.2, poise: 4, hitstop: 0, once: true,
            });
          }
        }
      }
    }

    // radial screen distortion pulse on roars / gusts
    if (this._radialPulse > 0) {
      this._radialPulse = Math.max(0, this._radialPulse - dt * 1.6);
      const u = this.ctx.fx?.uRadial;
      if (u) u.value = Math.max(u.value ?? 0, this._radialPulse * 0.7);
    }
  }

  onFrozen(dt) { for (const m of this.membranes) m.update(0.4); }

  onEnterState(s) {
    if (s === 'stagger') this.ctx.fx3d?.shake?.(0.3, 0.2);
  }

  onDie() {
    this.roar(1.4);
    this.flying = false;
    this.vy = 0;
    this._breathActive = false;
    this.ctx.ui?.hud?.clearBoss?.();
    this.ctx.ui?.subtitle?.('\u98a8\u9b54\u9f8d\u5df2\u88ab\u5c01\u5370', 3000);
    this.ctx.fx3d?.shake?.(1.2, 1.2);
  }

  onDeathUpdate(dt) {
    for (const m of this.membranes) m.update(0.2);
    if (this._deathT < 2.4) {
      const hips = this.bone('hips'), baseBone = this.bone('base');
      if (hips && baseBone) {
        hips.getWorldPosition(_v);
        _v2.set(0, 0, -1).applyQuaternion(this.root.quaternion);
        _v.addScaledVector(_v2, 1.4);
        this.tail.update(dt, _v, _v2);
        const inv = _m.copy(baseBone.matrixWorld).invert();
        for (let i = 0; i < 6; i++) {
          const bone = this.bone('tail' + i);
          if (!bone) continue;
          _v3.copy(this.tail.p[i]).applyMatrix4(inv);
          bone.position.copy(_v3);
          bone.lookAt(this.tail.p[Math.min(5, i + 1)]);
        }
      }
    }
    if (this._breathPts) this._breathPts.material.opacity = 0;
    if (this._windPts) this._windPts.material.opacity = Math.max(0, this._windPts.material.opacity - dt);
  }

  onDispose() {
    for (const m of this.membranes) { m.mesh.parent?.remove(m.mesh); m.dispose(); }
    if (this._breathPts) { this._breathPts.parent?.remove(this._breathPts); this._breathPts.geometry.dispose(); this._breathPts.material.dispose(); }
    if (this._windPts) { this._windPts.parent?.remove(this._windPts); this._windPts.geometry.dispose(); this._windPts.material.dispose(); }
    this.ctx.ui?.hud?.clearBoss?.();
  }
}

export function createDvalin(ctx, opts) { return new DvalinBoss(ctx, opts); }
