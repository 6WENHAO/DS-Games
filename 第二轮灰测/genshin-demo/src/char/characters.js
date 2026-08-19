// Character definitions + createCharacter factory (module A public API).
import * as THREE from 'three';
import { clamp, damp } from '../core/utils.js';
import { buildRig, disposeRig, plantFeet, footToGround, soleY, Part, addTube, mergeParts, noSkin, HEADP } from './rig.js';
import { Animator, CLIP_NAMES, hasClip } from './anim.js';
import { makeCharMaterial, makeOutlineMaterial, syncRim } from './materials.js';

// ================================================================ definitions
// col keys: skin hair hair2 eye top sleeve skirt trim bottom legwear boot glove
//           ribbon blush lash brow gear gear2
// t params: sleeve (0..1 along arm), glove, legwear, boot (0..1 along leg)
const LUMINE = {
  id: 'lumine', name: '荧', element: 'anemo', height: 1.62, weapon: 'sword',
  col: {
    skin: 0xf8ddc6, hair: 0xf2e6bf, hair2: 0xfdf7e0, eye: 0xd9b34c,
    top: 0xf7f3e9, sleeve: 0xf7f3e9, skirt: 0xf4efe2, trim: 0xe3c675,
    bottom: 0x2e3348, legwear: 0x2b3046, boot: 0x39405a, ribbon: 0xe8d5a8,
    blush: 0xf0949a, gear: 0xf6efdc, gear2: 0xe3c675,
  },
  body: { girth: 1.0, waist: 0.93, shoulder: 0.98, bust: 0.20 },
  torsoBands: [[0.40, 0.598, 0xf7f3e9], [0.598, 0.628, 0xe3c675], [0.628, 0.90, 0xf7f3e9]],
  sleeve: 0.21, glove: 1.1, legwear: 0.84, boot: 0.84,
  belt: { y: 0.612, r: 0.070, col: 0xe3c675, h: 0.020 },
  skirt: { top: 0.606, bottom: 0.412, r0: 0.072, r1: 0.132, trimT: 0.88, wave: 5, waveAmp: 0.030 },
  hair: {
    style: 'twintail', volume: 1.085, bangs: 7, bangSpread: 64, sideLen: 0.800, backLen: 0.800, backLocks: 3,
    tails: [
      { bones: [[0.054, 0.936, -0.030], [0.082, 0.868, -0.050], [0.096, 0.800, -0.058]], r0: 0.026, r1: 0.007, up: [0, 0, -1] },
      { bones: [[-0.054, 0.936, -0.030], [-0.082, 0.868, -0.050], [-0.096, 0.800, -0.058]], r0: 0.026, r1: 0.007, up: [0, 0, -1] },
    ],
  },
  headGear: 'butterfly',
};

const AETHER = {
  id: 'aether', name: '空', element: 'anemo', height: 1.70, weapon: 'sword',
  col: {
    skin: 0xf6d8bd, hair: 0xf0dfaa, hair2: 0xfaf0c8, eye: 0xd8a648,
    top: 0xf3eee1, sleeve: 0x3a4058, skirt: 0xf3eee1, trim: 0xe0c070,
    bottom: 0x2b2f42, legwear: 0x2b2f42, boot: 0x3b4157, ribbon: 0xd8c07a,
    blush: 0xe0868c, gear: 0xf0e6c8, gear2: 0xe0c070,
  },
  body: { girth: 1.03, waist: 1.05, shoulder: 1.14, bust: 0.03 },
  torsoBands: [[0.40, 0.60, 0x2b2f42], [0.60, 0.64, 0xe0c070], [0.64, 0.90, 0xf3eee1]],
  sleeve: 0.62, glove: 1.1, legwear: 0.55, boot: 0.82,
  belt: { y: 0.618, r: 0.072, col: 0xe0c070, h: 0.022 },
  hair: {
    style: 'ponytail', volume: 1.08, bangs: 7, bangSpread: 62, sideLen: 0.800, backLen: 0.815, backLocks: 3,
    tails: [{ bones: [[0.0, 0.950, -0.052], [0.0, 0.876, -0.078], [0.0, 0.792, -0.086]], r0: 0.028, r1: 0.008, up: [0, 0, -1] }],
  },
};

const PAIMON = {
  id: 'paimon', name: '派蒙', element: 'anemo', height: 0.86, weapon: 'none', floats: true,
  headP: { ax: 0.074, ay: 0.112, az: 0.086, cy: 0.882, jaw: 1.06, chin: 0.9 },
  col: {
    skin: 0xfbe3d0, hair: 0xfbf7ef, hair2: 0xffffff, eye: 0x6fd0d8,
    top: 0xf2ecdd, sleeve: 0xdcd3bd, skirt: 0xe8e1cd, trim: 0xc4b183, bottom: 0xe0d9c6,
    legwear: 0xeae3d2, boot: 0x9fa8b8, ribbon: 0xc4b183,
    blush: 0xf39aa0, gear: 0xf7e9a8, gear2: 0xfff8d8,
  },
  body: { girth: 1.05, waist: 1.06, shoulder: 0.94, bust: 0.05, limb: 1.34 },
  sleeve: 0.34, glove: 1.1, legwear: 0.90, boot: 0.90,
  skirt: { top: 0.600, bottom: 0.386, r0: 0.074, r1: 0.126, trimT: 0.84, wave: 5, waveAmp: 0.030 },
  cape: { top: 0.782, bottom: 0.470, r0: 0.068, r1: 0.118, col: 0xf7f4ec, inner: 0xdfd8c6, trim: 0xd9c890, span: 96 },
  hair: { style: 'short', volume: 1.075, bangs: 6, bangSpread: 66, sideLen: 0.820, backLen: 0.830, backLocks: 3, tails: [] },
  headGear: 'star',
  outlineWidth: 0.0085,
};

const JEAN = {
  id: 'jean', name: '琴', element: 'anemo', height: 1.68, weapon: 'sword',
  col: {
    skin: 0xf7dcc4, hair: 0xf3dc99, hair2: 0xfbf0c4, eye: 0x7fd0e8,
    top: 0xeef1f7, sleeve: 0x44659e, skirt: 0x2f4470, trim: 0xd9c184,
    bottom: 0x2f4470, legwear: 0xf6f8fc, boot: 0x35425e, ribbon: 0x44659e,
    blush: 0xeb8f96, gear: 0xd9c184, gear2: 0xf2e8c8,
  },
  body: { girth: 1.0, waist: 0.94, shoulder: 1.0, bust: 0.24 },
  torsoBands: [[0.40, 0.60, 0x2f4470], [0.60, 0.635, 0xd9c184], [0.635, 0.755, 0xeef1f7], [0.755, 0.90, 0x44659e]],
  sleeve: 0.86, glove: 1.1, legwear: 0.90, boot: 0.90,
  legBands: [[0.0, 0.62, 0xf6f8fc], [0.62, 0.86, 0x2f4470], [0.86, 1.0, 0x35425e]],
  belt: { y: 0.616, r: 0.072, col: 0xd9c184, h: 0.024 },
  skirt: { top: 0.604, bottom: 0.395, r0: 0.072, r1: 0.136, trimT: 0.90, wave: 5, waveAmp: 0.026 },
  hair: {
    style: 'ponytail', volume: 1.08, bangs: 6, bangSpread: 60, sideLen: 0.795, backLen: 0.800, backLocks: 3,
    tails: [{ bones: [[0.0, 0.948, -0.050], [0.010, 0.856, -0.082], [0.016, 0.756, -0.092]], r0: 0.030, r1: 0.009, up: [0, 0, -1], stiff: 0.20 }],
  },
};

const AMBER = {
  id: 'amber', name: '安柏', element: 'pyro', height: 1.60, weapon: 'bow',
  col: {
    skin: 0xf8d9bc, hair: 0x8d5c3d, hair2: 0xb0794c, eye: 0xd8a840,
    top: 0xd94a3c, sleeve: 0xd94a3c, skirt: 0x8a4a34, trim: 0xf0e6d4,
    bottom: 0xf0e6d4, legwear: 0x2a2028, boot: 0x6d4b31, ribbon: 0xd94a3c,
    blush: 0xf08a86, gear: 0xf0e6d4, gear2: 0xd94a3c,
  },
  body: { girth: 0.99, waist: 0.92, shoulder: 0.99, bust: 0.19 },
  torsoBands: [[0.40, 0.60, 0xf0e6d4], [0.60, 0.63, 0x6d4b31], [0.63, 0.90, 0xd94a3c]],
  sleeve: 0.30, glove: 0.86, legwear: 0.0, boot: 0.90,
  legBands: [[0.0, 0.50, 0xf8d9bc], [0.50, 0.88, 0x2a2028], [0.88, 1.0, 0x6d4b31]],
  armBands: [[0.0, 0.30, 0xd94a3c], [0.30, 0.78, 0xf8d9bc], [0.78, 1.0, 0x2a2028]],
  belt: { y: 0.614, r: 0.071, col: 0x6d4b31, h: 0.026 },
  skirt: { top: 0.560, bottom: 0.452, r0: 0.086, r1: 0.112, trimT: 0.80, wave: 5, waveAmp: 0.022 },
  hair: {
    style: 'twintail', volume: 1.09, bangs: 8, bangSpread: 66, sideLen: 0.800, backLen: 0.820, backLocks: 3,
    tails: [
      { bones: [[0.062, 0.900, -0.036], [0.086, 0.826, -0.058], [0.098, 0.752, -0.066]], r0: 0.024, r1: 0.007, ribbon: 0xd94a3c, up: [0, 0, -1] },
      { bones: [[-0.062, 0.900, -0.036], [-0.086, 0.826, -0.058], [-0.098, 0.752, -0.066]], r0: 0.024, r1: 0.007, ribbon: 0xd94a3c, up: [0, 0, -1] },
    ],
  },
  hat: { type: 'cap', col: 0xd94a3c, col2: 0xf0e6d4, tilt: -0.004, deco: 0xf0e6d4 },
};

const KAEYA = {
  id: 'kaeya', name: '凯亚', element: 'cryo', height: 1.78, weapon: 'sword',
  col: {
    skin: 0xe9c2a2, hair: 0x3b4a74, hair2: 0x5c6e9c, eye: 0x7fd8e8,
    top: 0x262c44, sleeve: 0x262c44, skirt: 0x1e2338, trim: 0xd8c690,
    bottom: 0x1e2338, legwear: 0x1e2338, boot: 0x2a2f44, ribbon: 0x6f86c0,
    blush: 0xd07a76, cape: 0x2b3350, gear: 0xd8c690, gear2: 0x6f86c0,
  },
  body: { girth: 1.05, waist: 1.07, shoulder: 1.2, bust: 0.04 },
  torsoBands: [[0.40, 0.62, 0x1e2338], [0.62, 0.65, 0xd8c690], [0.65, 0.90, 0x262c44]],
  sleeve: 0.92, glove: 0.88, legwear: 0.98, boot: 0.78,
  belt: { y: 0.620, r: 0.074, col: 0xd8c690, h: 0.024 },
  cape: { top: 0.786, bottom: 0.400, r0: 0.078, r1: 0.150, col: 0x2b3350, inner: 0x6f86c0, trim: 0xd8c690, span: 108 },
  hair: { style: 'short', volume: 1.075, bangs: 8, bangSpread: 68, sideLen: 0.792, backLen: 0.790, backLocks: 3, tails: [] },
  faceMark: 'eyepatch',
};

const VENTI = {
  id: 'venti', name: '温迪', element: 'anemo', height: 1.62, weapon: 'bow',
  col: {
    skin: 0xf6dcc6, hair: 0x2d3c36, hair2: 0x74c0a0, eye: 0x7fd8b8,
    top: 0xdceee2, sleeve: 0x3a4a44, skirt: 0x3a4a44, trim: 0xd9c184,
    bottom: 0x3a4a44, legwear: 0x2f3c38, boot: 0x4a5a50, ribbon: 0x74c0a0,
    blush: 0xe88f92, cape: 0x6fbf96, gear: 0xd9c184, gear2: 0xdceee2,
  },
  body: { girth: 0.99, waist: 1.0, shoulder: 1.02, bust: 0.06 },
  torsoBands: [[0.40, 0.60, 0x3a4a44], [0.60, 0.63, 0xd9c184], [0.63, 0.90, 0xdceee2]],
  sleeve: 0.55, glove: 1.1, legwear: 0.62, boot: 0.74,
  belt: { y: 0.612, r: 0.070, col: 0xd9c184, h: 0.020 },
  cape: { top: 0.780, bottom: 0.470, r0: 0.072, r1: 0.126, col: 0x6fbf96, inner: 0xcfe8d8, trim: 0xd9c184, span: 96 },
  hair: {
    style: 'braid', volume: 1.075, bangs: 7, bangSpread: 64, sideLen: 0.790, backLen: 0.805, backLocks: 3,
    tails: [
      { bones: [[0.058, 0.898, -0.026], [0.070, 0.836, -0.044], [0.076, 0.780, -0.050]], r0: 0.016, r1: 0.006, ribbon: 0x74c0a0, up: [0, 0, -1] },
      { bones: [[-0.058, 0.898, -0.026], [-0.070, 0.836, -0.044], [-0.076, 0.780, -0.050]], r0: 0.016, r1: 0.006, ribbon: 0x74c0a0, up: [0, 0, -1] },
    ],
  },
  hat: { type: 'beret', col: 0x4f8f70, deco: 0xd8e8c0, tilt: -0.006 },
};

const VILLAGER_M = {
  id: 'villager_m', name: '村民', element: 'physical', height: 1.72, weapon: 'none',
  col: {
    skin: 0xeecfae, hair: 0x6b4a34, hair2: 0x8a6448, eye: 0x8a6a3a,
    top: 0xbaa887, sleeve: 0xbaa887, trim: 0x8a7358, bottom: 0x6a5a48,
    legwear: 0x6a5a48, boot: 0x4a3f34, ribbon: 0x8a7358, blush: 0xd08a80,
  },
  body: { girth: 1.06, waist: 1.1, shoulder: 1.18, bust: 0.02 },
  torsoBands: [[0.40, 0.60, 0x6a5a48], [0.60, 0.64, 0x8a7358], [0.64, 0.90, 0xbaa887]],
  sleeve: 0.52, glove: 1.1, legwear: 0.72, boot: 0.86,
  hair: { style: 'short', volume: 1.065, bangs: 6, bangSpread: 58, sideLen: 0.828, backLen: 0.832, backLocks: 2, tails: [] },
};

const VILLAGER_F = {
  id: 'villager_f', name: '村民', element: 'physical', height: 1.62, weapon: 'none',
  col: {
    skin: 0xf6d8bd, hair: 0x8a6a4a, hair2: 0xa9825c, eye: 0x7a5c3a,
    top: 0xd2b189, sleeve: 0xd2b189, skirt: 0x8f6f52, trim: 0xf0e8d8, bottom: 0x8f6f52,
    legwear: 0xe8ddc8, boot: 0x5a4a3c, ribbon: 0xc86a70, blush: 0xe8949a,
  },
  body: { girth: 1.0, waist: 0.96, shoulder: 0.98, bust: 0.17 },
  torsoBands: [[0.40, 0.60, 0xd2b189], [0.60, 0.63, 0xc86a70], [0.63, 0.90, 0xf0e8d8]],
  sleeve: 0.26, glove: 1.1, legwear: 0.0, boot: 0.88,
  skirt: { top: 0.606, bottom: 0.360, r0: 0.074, r1: 0.134, trimT: 0.92, wave: 5, waveAmp: 0.028 },
  hair: {
    style: 'ponytail', volume: 1.07, bangs: 6, bangSpread: 60, sideLen: 0.790, backLen: 0.805, backLocks: 3,
    tails: [{ bones: [[0.0, 0.940, -0.048], [0.0, 0.872, -0.070], [0.0, 0.812, -0.076]], r0: 0.024, r1: 0.008, up: [0, 0, -1] }],
  },
};

export const CHARACTER_DEFS = {
  lumine: LUMINE, aether: AETHER, paimon: PAIMON, jean: JEAN,
  amber: AMBER, kaeya: KAEYA, venti: VENTI,
  villager_m: VILLAGER_M, villager_f: VILLAGER_F,
};
export const CHARACTER_IDS = Object.keys(CHARACTER_DEFS);

// ================================================================ default sword
let _swordGeo = null;
/** Cartoon sword geometry, authored in METRES (blade up +Y, grip at origin). */
export function makeSword(opts) {
  const o = opts || {};
  const c = {
    blade: o.blade != null ? o.blade : 0xcfdcf0,
    edge: o.edge != null ? o.edge : 0x7cb6e4,
    guard: o.guard != null ? o.guard : 0xe8c46a,
    grip: o.grip != null ? o.grip : 0x2c3a5c,
    gem: o.gem != null ? o.gem : 0x7fd8e8,
  };
  const P = new Part(noSkin);
  // pommel + grip
  addTube(P, [
    { p: [0, -0.082, 0], rx: 0.010, ry: 0.010, col: c.guard },
    { p: [0, -0.068, 0], rx: 0.017, ry: 0.017, col: c.guard },
    { p: [0, -0.056, 0], rx: 0.0115, ry: 0.0115, col: c.grip },
    { p: [0, 0.022, 0], rx: 0.0115, ry: 0.0115, col: c.grip },
    { p: [0, 0.034, 0], rx: 0.015, ry: 0.015, col: c.guard },
  ], { sides: 8, capStart: 'flat', capEnd: 'flat', up: [0, 0, 1] });
  // guard
  addTube(P, [
    { p: [0, 0.036, 0], rx: 0.052, ry: 0.014, col: c.guard },
    { p: [0, 0.052, 0], rx: 0.060, ry: 0.017, col: c.guard },
    { p: [0, 0.068, 0], rx: 0.036, ry: 0.013, col: c.guard },
  ], { sides: 10, capStart: 'flat', capEnd: 'flat', up: [0, 0, 1] });
  // gem
  addTube(P, [
    { p: [0, 0.052, -0.016], rx: 0.011, ry: 0.011, col: c.gem },
    { p: [0, 0.052, 0.016], rx: 0.011, ry: 0.011, col: c.gem },
  ], { sides: 6, capStart: 'point', capEnd: 'point', tip: 0.006, up: [0, 1, 0] });
  // blade
  addTube(P, [
    { p: [0, 0.066, 0], rx: 0.036, ry: 0.0085, col: c.blade },
    { p: [0, 0.100, 0], rx: 0.040, ry: 0.0090, col: c.blade },
    { p: [0, 0.420, 0], rx: 0.037, ry: 0.0082, col: c.blade },
    { p: [0, 0.660, 0], rx: 0.033, ry: 0.0070, col: c.blade },
    { p: [0, 0.800, 0], rx: 0.026, ry: 0.0056, col: c.edge },
    { p: [0, 0.870, 0], rx: 0.012, ry: 0.0036, col: c.edge },
  ], { sides: 8, capStart: 'flat', capEnd: 'point', tip: 0.030, up: [0, 0, 1] });
  const geo = mergeParts([P]);
  const mat = makeCharMaterial({ rimStrength: 0.75, rimPower: 2.6 });
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  g.add(mesh);
  const oMat = makeOutlineMaterial({ color: 0x1d1c24, width: 0.0045 });
  const out = new THREE.Mesh(geo, oMat);
  g.add(out);
  g.userData.dispose = () => { geo.dispose(); mat.dispose(); oMat.dispose(); };
  g.name = 'sword';
  return g;
}

/** Simple bow for archers (metres, string along Y). */
export function makeBow(opts) {
  const o = opts || {};
  const wood = o.wood != null ? o.wood : 0xb0562f, gold = o.gold != null ? o.gold : 0xe8c46a;
  const P = new Part(noSkin);
  const rings = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, a = (t - 0.5) * 2.2;
    rings.push({
      p: [0, Math.sin(a) * 0.34, -Math.cos(a) * 0.10 + 0.10],
      rx: 0.012 * (1 - Math.abs(t - 0.5) * 1.2), ry: 0.008 * (1 - Math.abs(t - 0.5) * 1.0),
      col: (i === 5 ? gold : wood),
    });
  }
  addTube(P, rings, { sides: 6, capStart: 'point', capEnd: 'point', tip: 0.01, up: [1, 0, 0] });
  const geo = mergeParts([P]);
  const mat = makeCharMaterial({ rimStrength: 0.5 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  const oMat = makeOutlineMaterial({ color: 0x1d1c24, width: 0.004 });
  g.add(new THREE.Mesh(geo, oMat));
  g.userData.dispose = () => { geo.dispose(); mat.dispose(); oMat.dispose(); };
  g.name = 'bow';
  return g;
}

// ================================================================ factory
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _e1 = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * createCharacter(ctx, defId, opts) -> character handle (see docs/CONTRACT.md 2.7)
 * opts: { scale=1, sync=false, priority=4, outline=true, weapon=false, ik=true }
 */
export function createCharacter(ctx, defId, opts) {
  const o = opts || {};
  const def = CHARACTER_DEFS[defId] || CHARACTER_DEFS.lumine;
  const rig = buildRig(ctx, def, o);
  const anim = new Animator(rig, def);
  const scale = o.scale != null ? o.scale : 1;

  let lookTarget = null, lookY = 0, lookP = 0, lookW = 0;
  let weapon = null, weaponVisible = false;
  let outlineOn = o.outline !== false;
  let envT = 0.37;

  const applyLook = (dt) => {
    const head = rig.bones.head, neck = rig.bones.neck;
    if (!head || !neck) return;
    let ty = 0, tp = 0, tw = 0;
    if (lookTarget) {
      _v1.setFromMatrixPosition(head.matrixWorld);
      _v2.copy(lookTarget).sub(_v1);
      if (_v2.lengthSq() > 1e-6) {
        rig.root.getWorldQuaternion(_q1).invert();
        _v2.applyQuaternion(_q1).normalize();
        ty = clamp(Math.atan2(_v2.x, Math.max(0.15, _v2.z)), -1.15, 1.15);
        tp = clamp(Math.asin(clamp(-_v2.y, -1, 1)), -0.55, 0.42);
        tw = _v2.z > -0.2 ? 1 : 0;      // do not look through the back of the head
      }
    }
    lookY = damp(lookY, ty, 7, dt);
    lookP = damp(lookP, tp, 7, dt);
    lookW = damp(lookW, tw, 6, dt);
    if (lookW < 0.002) return;
    const y = lookY * lookW, p = lookP * lookW;
    _e1.set(p * 0.34, y * 0.34, 0); _q2.setFromEuler(_e1); neck.quaternion.multiply(_q2);
    _e1.set(p * 0.66, y * 0.66, 0); _q2.setFromEuler(_e1); head.quaternion.multiply(_q2);
    rig.face.setGaze(clamp(y * 1.5, -1, 1), clamp(-p * 1.8, -1, 1));
  };

  const api = {
    def, id: def.id, name: def.name, element: def.element,
    root: rig.root, height: def.height * scale, rig, anim,
    bones: rig.bones, weaponBone: rig.weaponBone, face: rig.face,
    ikGround: o.ik !== false,
    get ready() { return rig.ready; },

    setLook(v) { lookTarget = v ? (lookTarget ? lookTarget.copy(v) : v.clone()) : null; return api; },
    setBlink(on) { rig.face.setBlink(on); return api; },
    setExpression(name) { rig.face.setExpression(name); return api; },
    blink() { rig.face.blink(); return api; },

    setOutline(on) {
      outlineOn = !!on;
      if (rig.outline) rig.outline.visible = outlineOn;
      if (weapon) { const ol = weapon.children[1]; if (ol) ol.visible = outlineOn; }
      return api;
    },
    setReceiveShadow(on) { if (rig.mesh) rig.mesh.receiveShadow = !!on; return api; },
    setOutlineWidth(w) {
      const u = rig.outlineMat.userData.outline; if (u) u.uOutlineWidth.value = w;
      return api;
    },

    showWeapon(on) {
      weaponVisible = !!on;
      if (weaponVisible && !weapon && def.weapon !== 'none') {
        weapon = def.weapon === 'bow' ? makeBow() : makeSword();
        rig.weaponBone.add(weapon);
        const ol = weapon.children[1]; if (ol) ol.visible = outlineOn;
      }
      if (weapon) weapon.visible = weaponVisible;
      return api;
    },
    get weapon() { return weapon; },
    attachWeapon(obj) { rig.weaponBone.add(obj); return api; },

    play(clip, o2) { anim.play(clip, o2); return api; },

    update(dt) {
      if (rig.disposed) return;
      const d = Math.min(Math.max(dt, 0), 0.05);
      anim.update(d);
      if (!rig.ready) { rig.face.update(d); return; }
      applyLook(d);
      if (rig.outline) rig.outline.visible = outlineOn;
      rig.root.updateMatrixWorld(true);
      if (api.ikGround && anim.grounded && !def.floats) {
        const rootY = _v1.setFromMatrixPosition(rig.root.matrixWorld).y;
        const fp = anim.footPlant;
        const cap = 0.22 * rig.scaleM;
        if (anim.plant) plantFeet(rig, rootY, 0.10 * rig.scaleM, fp[0], fp[1]);
        for (let i = 0; i < 2; i++) {
          const n = i ? 'R' : 'L';
          if (fp[i] > 0.35) footToGround(rig, n, rootY, fp[i], cap);          // planted: full contact
          else if (soleY(rig, n) < rootY) footToGround(rig, n, rootY, 1, cap); // swinging: no sinking
        }
      }
      const t = (ctx && ctx.time && ctx.time.elapsed != null) ? ctx.time.elapsed : performance.now() * 0.001;
      for (let i = 0; i < rig.dyn.length; i++) rig.dyn[i].update(d, t);
      rig.face.update(d);
      envT += d;
      if (envT > 0.4) { envT = 0; syncRim(rig.mat, ctx); if (weapon) syncRim(weapon.children[0].material, ctx); }
    },

    dispose() {
      if (weapon && weapon.userData.dispose) weapon.userData.dispose();
      disposeRig(rig);
    },
  };

  rig.onReady = () => {
    if (rig.outline) rig.outline.visible = outlineOn;
    if (o.weapon) api.showWeapon(true);
    syncRim(rig.mat, ctx);
  };
  if (rig.ready) rig.onReady();
  return api;
}

/** Optional manager so the integrator can do ctx.characters = new CharacterSystem(ctx). */
export class CharacterSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.list = [];
    this.CHARACTER_DEFS = CHARACTER_DEFS;
    this.defs = CHARACTER_DEFS;
    this.ids = CHARACTER_IDS;
    this.clips = CLIP_NAMES;
  }
  createCharacter(defId, opts) {
    const ch = createCharacter(this.ctx, defId, opts);
    this.list.push(ch);
    return ch;
  }
  create(defId, opts) { return this.createCharacter(defId, opts); }
  makeSword(o) { return makeSword(o); }
  makeBow(o) { return makeBow(o); }
  hasClip(n) { return hasClip(n); }
  remove(ch) {
    const i = this.list.indexOf(ch);
    if (i >= 0) this.list.splice(i, 1);
    ch.dispose();
  }
  update(dt) {
    for (let i = 0; i < this.list.length; i++) {
      try { this.list[i].update(dt); } catch (e) { console.error('[char]', e); }
    }
  }
  dispose() { for (const c of this.list.slice()) this.remove(c); }
}

export { CLIP_NAMES, hasClip };
