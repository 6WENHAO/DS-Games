/**
 * SALTWAKE — low-poly model kit.
 *
 * Everything is built from boxes, wedges, tapered tubes and faceted blobs, merged
 * per model into one flat-shaded vertex-coloured buffer. Part counts are kept in
 * the 40-120 triangle range because that is what reads correctly at 200 pixels
 * of vertical resolution, and because a silhouette made of six chunky masses is
 * legible in fog where a detailed mesh is not.
 *
 * Animation is genuinely stop-motion. Every animate() takes a **quantised** clock
 * (ANIM.enemyFps or ANIM.viewmodelFps) so poses are held, not blended. The pose
 * curves are shaped for weight: a long slow windup, a two-frame snap, then a
 * recovery with overshoot. Nothing eases.
 */
import * as THREE from 'three';
import { PALETTE, ANIM } from '../core/config.js';

const C = (hex) => new THREE.Color(hex);

/* ================================================================== *
 * Accumulator and primitives
 * ================================================================== */

/** Merges primitives into one flat-shaded vertex-coloured geometry. */
export class Acc {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
  }

  /**
   * @param {THREE.BufferGeometry} geo non-indexed or indexed
   * @param {THREE.Matrix4} m
   * @param {THREE.Color|((n:THREE.Vector3)=>THREE.Color)} color
   */
  add(geo, m, color) {
    let g = geo;
    if (g.index) g = g.toNonIndexed();
    const p = g.getAttribute('position');
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const n = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    for (let t = 0; t < p.count / 3; t += 1) {
      a.fromBufferAttribute(p, t * 3).applyMatrix4(m);
      b.fromBufferAttribute(p, t * 3 + 1).applyMatrix4(m);
      c.fromBufferAttribute(p, t * 3 + 2).applyMatrix4(m);
      e1.subVectors(b, a);
      e2.subVectors(c, a);
      n.crossVectors(e1, e2);
      if (n.lengthSq() < 1e-12) n.set(0, 1, 0); else n.normalize();
      const cc = typeof color === 'function' ? color(n) : color;
      for (const v of [a, b, c]) {
        this.pos.push(v.x, v.y, v.z);
        this.nrm.push(n.x, n.y, n.z);
        this.col.push(cc.r, cc.g, cc.b);
      }
    }
    if (g !== geo) g.dispose();
    return this;
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeBoundingSphere();
    return geo;
  }

  get triangles() { return this.pos.length / 9; }
}

const M = () => new THREE.Matrix4();
const place = (x, y, z, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  const m = M().makeRotationY(ry);
  if (rz) m.multiply(M().makeRotationZ(rz));
  m.scale(new THREE.Vector3(sx, sy, sz));
  m.setPosition(x, y, z);
  return m;
};

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** A wedge: a box with one edge collapsed. Reads as a beak, fin or blade. */
function wedge(w, h, d) {
  const hx = w / 2; const hz = d / 2;
  const v = [
    // base quad
    -hx, 0, -hz, hx, 0, -hz, hx, 0, hz,
    -hx, 0, -hz, hx, 0, hz, -hx, 0, hz,
    // two slanted faces meeting at the top edge along X
    -hx, 0, -hz, -hx, h, 0, hx, 0, -hz,
    hx, 0, -hz, -hx, h, 0, hx, h, 0,
    hx, 0, hz, hx, h, 0, -hx, 0, hz,
    -hx, 0, hz, hx, h, 0, -hx, h, 0,
    // end caps
    -hx, 0, -hz, -hx, 0, hz, -hx, h, 0,
    hx, 0, -hz, hx, h, 0, hx, 0, hz,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

/** Faceted blob, jittered off a lattice so the hull stays closed. */
function blob(radius, detail, jitter, seedRng) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.getAttribute('position');
  const memo = new Map();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 1) {
    v.fromBufferAttribute(p, i);
    const k = `${v.x.toFixed(3)}|${v.y.toFixed(3)}|${v.z.toFixed(3)}`;
    let d = memo.get(k);
    if (!d) {
      const j = radius * jitter;
      d = new THREE.Vector3((seedRng() - 0.5) * 2 * j, (seedRng() - 0.5) * 2 * j, (seedRng() - 0.5) * 2 * j);
      memo.set(k, d);
    }
    p.setXYZ(i, v.x + d.x, v.y + d.y, v.z + d.z);
  }
  p.needsUpdate = true;
  return g;
}

/** Tapered tube along +Y, `sides` low so facets show. */
function tube(h, r0, r1, sides = 6) {
  const v = [];
  for (let s = 0; s < sides; s += 1) {
    const a0 = (s / sides) * Math.PI * 2;
    const a1 = ((s + 1) / sides) * Math.PI * 2;
    const p0 = [Math.cos(a0) * r0, 0, Math.sin(a0) * r0];
    const p1 = [Math.cos(a1) * r0, 0, Math.sin(a1) * r0];
    const q0 = [Math.cos(a0) * r1, h, Math.sin(a0) * r1];
    const q1 = [Math.cos(a1) * r1, h, Math.sin(a1) * r1];
    v.push(...p0, ...q0, ...p1, ...p1, ...q0, ...q1);
    v.push(...q0, 0, h, 0, ...q1);
    v.push(...p1, 0, 0, 0, ...p0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

function rng(seed) {
  let s = seed | 0 || 1;
  return () => { s ^= s << 13; s |= 0; s ^= s >>> 17; s ^= s << 5; s |= 0; return (s >>> 0) / 4294967296; };
}

/** Darkens downward-facing facets so a flat-shaded mass still reads as solid. */
const facetShade = (base, spread = 0.34) => (n) => {
  const up = Math.max(0, Math.min(1, n.y * 0.5 + 0.5));
  return base.clone().multiplyScalar(1 - spread + spread * 2 * up * 0.72);
};

/* ================================================================== *
 * Part rig
 * ================================================================== */

/**
 * A model is a THREE.Group of named part groups, each holding one baked mesh.
 * animate() writes rotations and offsets onto the parts, never onto vertices.
 */
class Rig {
  constructor(material) {
    this.group = new THREE.Group();
    this.parts = {};
    this.material = material;
    this.triangles = 0;
  }

  /** @param {string} name @param {Acc} acc @param {[number,number,number]} pivot */
  part(name, acc, pivot = [0, 0, 0], parent = null) {
    const g = new THREE.Group();
    g.position.set(pivot[0], pivot[1], pivot[2]);
    const geo = acc.build();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.frustumCulled = false;
    g.add(mesh);
    (parent ? this.parts[parent] : this.group).add(g);
    this.parts[name] = g;
    this.triangles += acc.triangles;
    g.userData.rest = { x: 0, y: 0, z: 0, px: pivot[0], py: pivot[1], pz: pivot[2] };
    return g;
  }

  reset() {
    for (const key of Object.keys(this.parts)) {
      const p = this.parts[key];
      const r = p.userData.rest;
      p.rotation.set(0, 0, 0);
      p.position.set(r.px, r.py, r.pz);
      p.scale.set(1, 1, 1);
    }
  }
}

/* ================================================================== *
 * Enemy models
 * ================================================================== */

/** Quantised clock. Returns a held frame index and its phase. */
export function stopMotion(time, fps) {
  const frame = Math.floor(time * fps);
  return { frame, t: frame / fps };
}

/**
 * A hunched hauler: one overgrown arm dragging a gaff hook, the other withered.
 * The silhouette is asymmetric on purpose so it reads instantly in fog.
 */
function buildFisherman(material) {
  const rig = new Rig(material);
  const r = rng(7);
  const skin = C(PALETTE.flesh);
  const cloth = C('#2f3a30');
  const bone = C(PALETTE.bone);
  const iron = C('#4a4239');

  const torso = new Acc();
  torso.add(box(0.62, 0.78, 0.44), place(0, 0.39, 0), facetShade(cloth));
  torso.add(box(0.70, 0.16, 0.50), place(0, 0.80, 0), facetShade(cloth.clone().multiplyScalar(0.8)));
  // The swollen shoulder that makes the outline lopsided.
  torso.add(blob(0.30, 0, 0.22, r), place(0.40, 0.72, 0), facetShade(skin));
  rig.part('torso', torso, [0, 0.92, 0]);

  const head = new Acc();
  head.add(blob(0.20, 0, 0.26, r), place(0, 0.14, 0), facetShade(skin));
  head.add(wedge(0.16, 0.20, 0.30), place(0, 0.10, 0.16, 0, -Math.PI / 2), facetShade(skin.clone().multiplyScalar(1.1)));
  rig.part('head', head, [0, 0.82, 0.02], 'torso');

  const armBig = new Acc();
  armBig.add(tube(0.66, 0.17, 0.13, 6), place(0, -0.66, 0), facetShade(skin));
  armBig.add(blob(0.17, 0, 0.3, r), place(0, -0.70, 0), facetShade(skin));
  // The hook: a long iron curve that leads the swing.
  armBig.add(tube(0.52, 0.035, 0.03, 4), place(0, -1.20, 0.02), facetShade(iron));
  armBig.add(wedge(0.10, 0.26, 0.06), place(0.02, -1.20, 0.16, 0, 2.2), facetShade(iron));
  rig.part('armBig', armBig, [0.40, 0.70, 0], 'torso');

  const armThin = new Acc();
  armThin.add(tube(0.56, 0.075, 0.055, 5), place(0, -0.56, 0), facetShade(skin.clone().multiplyScalar(0.85)));
  rig.part('armThin', armThin, [-0.34, 0.68, 0], 'torso');

  for (const [name, sx] of [['legL', -1], ['legR', 1]]) {
    const leg = new Acc();
    leg.add(tube(0.86, 0.13, 0.10, 5), place(0, -0.86, 0), facetShade(cloth.clone().multiplyScalar(0.85)));
    leg.add(box(0.20, 0.10, 0.30), place(0, -0.90, 0.06), facetShade(bone.clone().multiplyScalar(0.5)));
    rig.part(name, leg, [0.17 * sx, 0.0, 0], 'torso');
  }

  rig.animate = (state, st, time) => {
    const { t } = stopMotion(time, ANIM.enemyFps);
    const p = rig.parts;
    rig.reset();
    // Permanent hunch: the mass sits forward of the hips.
    p.torso.rotation.x = 0.34;
    p.head.rotation.x = -0.22;

    if (state === 'walk' || state === 'chase') {
      const rate = state === 'chase' ? 7.0 : 3.6;
      const s = Math.sin(t * rate);
      const s2 = Math.sin(t * rate + Math.PI);
      p.legL.rotation.x = s * 0.62;
      p.legR.rotation.x = s2 * 0.62;
      p.torso.rotation.z = s * 0.07;
      p.armBig.rotation.x = -s * 0.28 - 0.15;
      p.armThin.rotation.x = -s2 * 0.42;
      p.torso.position.y += Math.abs(s) * 0.05;
    } else if (state === 'telegraph') {
      // Long, obvious windup: the arm goes up and back, the body coils away.
      const k = Math.min(1, st / 0.62);
      p.armBig.rotation.x = -2.1 * k;
      p.armBig.rotation.z = -0.5 * k;
      p.torso.rotation.y = -0.55 * k;
      p.torso.rotation.x = 0.34 - 0.2 * k;
      p.head.rotation.y = 0.4 * k;
    } else if (state === 'attack') {
      // Two-frame snap through, then hold at full extension.
      const k = Math.min(1, st / 0.16);
      p.armBig.rotation.x = -2.1 + 3.0 * k;
      p.armBig.rotation.z = -0.5 + 0.9 * k;
      p.torso.rotation.y = -0.55 + 1.1 * k;
      p.torso.rotation.x = 0.34 + 0.28 * k;
    } else if (state === 'recover') {
      const k = Math.min(1, st / 0.55);
      p.armBig.rotation.x = 0.9 - 1.05 * k;
      p.torso.rotation.y = 0.55 * (1 - k);
      p.torso.rotation.x = 0.62 - 0.28 * k;
    } else if (state === 'hurt') {
      p.torso.rotation.x = 0.34 - 0.3;
      p.head.rotation.x = 0.4;
      p.armThin.rotation.x = -0.8;
    } else if (state === 'die') {
      const k = Math.min(1, st / 0.7);
      p.torso.rotation.x = 0.34 + k * 1.25;
      p.torso.position.y -= k * 0.72;
      p.head.rotation.x = k * 0.7;
      p.armBig.rotation.x = k * 1.2;
      p.legL.rotation.x = -k * 0.9;
      p.legR.rotation.x = -k * 0.5;
    } else {
      // idle: a slow shift of weight, two poses only
      const s = Math.sin(t * 1.4);
      p.torso.rotation.z = s * 0.05;
      p.armBig.rotation.x = -0.15 + s * 0.06;
      p.head.rotation.y = s * 0.22;
    }
  };
  return rig;
}

/** Tall, robed, ribcage opened outward like a lectern with a parasite inside. */
function buildCultist(material) {
  const rig = new Rig(material);
  const r = rng(13);
  const robe = C('#26302c');
  const flesh = C('#6d4a44');
  const parasite = C(PALETTE.ichor);

  const torso = new Acc();
  torso.add(tube(1.05, 0.30, 0.22, 6), place(0, 0, 0), facetShade(robe));
  // The opened ribs: four splayed wedges framing a lit cavity.
  for (let i = 0; i < 4; i += 1) {
    const a = -0.5 + i * 0.33;
    torso.add(wedge(0.07, 0.34, 0.10), place(Math.sin(a) * 0.26, 0.62, 0.20 + Math.cos(a) * 0.05, a, -0.5),
      facetShade(C(PALETTE.bone)));
  }
  torso.add(blob(0.13, 0, 0.34, r), place(0, 0.66, 0.20), facetShade(parasite, 0.2));
  rig.part('torso', torso, [0, 0.72, 0]);

  const head = new Acc();
  head.add(tube(0.30, 0.13, 0.10, 5), place(0, 0, 0), facetShade(flesh));
  head.add(box(0.24, 0.06, 0.20), place(0, 0.30, 0.02), facetShade(robe.clone().multiplyScalar(0.7)));
  rig.part('head', head, [0, 1.03, 0], 'torso');

  for (const [name, sx] of [['armL', -1], ['armR', 1]]) {
    const arm = new Acc();
    arm.add(tube(0.62, 0.09, 0.06, 5), place(0, -0.62, 0), facetShade(robe.clone().multiplyScalar(0.9)));
    arm.add(blob(0.08, 0, 0.3, r), place(0, -0.64, 0), facetShade(flesh));
    rig.part(name, arm, [0.30 * sx, 0.92, 0], 'torso');
  }
  const skirt = new Acc();
  skirt.add(tube(0.74, 0.24, 0.34, 6), place(0, -0.74, 0), facetShade(robe.clone().multiplyScalar(0.75)));
  rig.part('skirt', skirt, [0, 0.02, 0], 'torso');

  rig.animate = (state, st, time) => {
    const { t } = stopMotion(time, ANIM.enemyFps);
    const p = rig.parts;
    rig.reset();
    if (state === 'walk' || state === 'chase') {
      const s = Math.sin(t * 3.1);
      p.torso.rotation.z = s * 0.05;
      p.skirt.rotation.z = -s * 0.06;
      p.armL.rotation.x = s * 0.2;
      p.armR.rotation.x = -s * 0.2;
      p.torso.position.y += Math.abs(s) * 0.03;
    } else if (state === 'telegraph') {
      // Both arms rise and the chest cavity opens towards the player: the tell.
      const k = Math.min(1, st / 0.85);
      p.armL.rotation.x = -1.9 * k;
      p.armR.rotation.x = -1.9 * k;
      p.armL.rotation.z = 0.5 * k;
      p.armR.rotation.z = -0.5 * k;
      p.torso.rotation.x = -0.30 * k;
      p.head.rotation.x = -0.45 * k;
    } else if (state === 'attack') {
      const k = Math.min(1, st / 0.18);
      p.torso.rotation.x = -0.30 + 0.75 * k;
      p.armL.rotation.x = -1.9 + 1.4 * k;
      p.armR.rotation.x = -1.9 + 1.4 * k;
      p.head.rotation.x = -0.45 + 0.9 * k;
    } else if (state === 'hurt') {
      p.torso.rotation.x = 0.35;
      p.armL.rotation.z = 0.9;
      p.armR.rotation.z = -0.9;
    } else if (state === 'die') {
      const k = Math.min(1, st / 0.8);
      p.torso.rotation.x = -k * 1.1;
      p.torso.position.y -= k * 0.55;
      p.armL.rotation.x = -k * 1.6;
      p.armR.rotation.x = -k * 1.6;
      p.head.rotation.x = -k * 0.9;
    } else {
      const s = Math.sin(t * 1.1);
      p.torso.rotation.y = s * 0.16;
      p.armL.rotation.x = -0.2 + s * 0.1;
      p.armR.rotation.x = -0.2 - s * 0.1;
    }
  };
  return rig;
}

/** Low, wide, flat to the floor, too many joints. Reads as a shape, not a body. */
function buildCrawler(material) {
  const rig = new Rig(material);
  const r = rng(29);
  const shell = C('#3b3a2c');
  const under = C('#5a3f38');

  const body = new Acc();
  body.add(blob(0.42, 0, 0.30, r), place(0, 0, 0, 0, 0, 1.35, 0.55, 1.0), facetShade(shell));
  body.add(wedge(0.44, 0.16, 0.40), place(0, 0.10, 0.30, 0, -Math.PI / 2), facetShade(shell.clone().multiplyScalar(1.15)));
  body.add(blob(0.14, 0, 0.4, r), place(0, -0.04, 0.34), facetShade(under));
  rig.part('body', body, [0, 0.34, 0]);

  // Six legs, splayed wide: the silhouette is a fringe, not limbs.
  for (let i = 0; i < 6; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const along = Math.floor(i / 2) - 1;
    const leg = new Acc();
    leg.add(tube(0.42, 0.05, 0.03, 4), place(0, 0, 0, 0, side * 1.05), facetShade(shell.clone().multiplyScalar(0.8)));
    rig.part(`leg${i}`, leg, [0.34 * side, 0.02, along * 0.24], 'body');
  }

  rig.animate = (state, st, time) => {
    const { t } = stopMotion(time, ANIM.enemyFps);
    const p = rig.parts;
    rig.reset();
    const scuttle = (state === 'chase' || state === 'walk') ? (state === 'chase' ? 12.0 : 6.0) : 0;
    if (scuttle) {
      for (let i = 0; i < 6; i += 1) {
        const phase = (i % 3) * 2.09;
        p[`leg${i}`].rotation.x = Math.sin(t * scuttle + phase) * 0.75;
      }
      p.body.position.y += Math.abs(Math.sin(t * scuttle)) * 0.04;
      p.body.rotation.z = Math.sin(t * scuttle * 0.5) * 0.10;
    }
    if (state === 'telegraph') {
      // Coils back and lifts the front: a short, unmistakable tell before a lunge.
      const k = Math.min(1, st / 0.40);
      p.body.rotation.x = -0.55 * k;
      p.body.position.y += 0.10 * k;
      p.body.position.z -= 0.18 * k;
    } else if (state === 'attack' || state === 'lunge') {
      const k = Math.min(1, st / 0.14);
      p.body.rotation.x = -0.55 + 0.95 * k;
      p.body.position.z += 0.24 * k;
    } else if (state === 'hurt') {
      p.body.rotation.z = 0.4;
    } else if (state === 'die') {
      const k = Math.min(1, st / 0.5);
      p.body.rotation.z = Math.PI * 0.55 * k;
      p.body.position.y -= k * 0.16;
      for (let i = 0; i < 6; i += 1) p[`leg${i}`].rotation.x = -1.1 * k;
    } else if (!scuttle) {
      p.body.position.y += Math.sin(t * 1.9) * 0.02;
    }
  };
  return rig;
}

/** A drifting cluster of wet spheres. No limbs at all, which is the point. */
function buildEye(material) {
  const rig = new Rig(material);
  const r = rng(37);
  const sclera = C('#8a8674');
  const iris = C('#5c1f18');
  const veil = C('#31413c');

  const core = new Acc();
  core.add(blob(0.34, 1, 0.10, r), place(0, 0, 0), facetShade(sclera, 0.28));
  core.add(blob(0.16, 0, 0.12, r), place(0, 0, 0.30), facetShade(iris, 0.2));
  rig.part('core', core, [0, 0, 0]);

  // Satellites: five smaller spheres that orbit and give the cluster its outline.
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const sat = new Acc();
    const rad = 0.13 + (i % 2) * 0.05;
    sat.add(blob(rad, 0, 0.16, r), place(0, 0, 0), facetShade(sclera.clone().multiplyScalar(0.9), 0.3));
    sat.add(blob(rad * 0.45, 0, 0.2, r), place(0, 0, rad * 0.8), facetShade(iris, 0.2));
    rig.part(`sat${i}`, sat, [Math.cos(a) * 0.42, Math.sin(a) * 0.30, Math.sin(a * 2) * 0.12], 'core');
  }
  const drape = new Acc();
  drape.add(tube(0.46, 0.20, 0.03, 5), place(0, -0.46, 0), facetShade(veil));
  rig.part('drape', drape, [0, -0.22, 0], 'core');

  rig.animate = (state, st, time) => {
    const { t } = stopMotion(time, ANIM.enemyFps);
    const p = rig.parts;
    rig.reset();
    // The cluster always breathes and rotates: it never looks inert.
    p.core.rotation.y = t * 0.5;
    p.core.position.y += Math.sin(t * 1.3) * 0.07;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + t * 0.8;
      const sp = p[`sat${i}`];
      sp.position.set(Math.cos(a) * 0.42, Math.sin(a * 1.3) * 0.26, Math.sin(a * 2) * 0.14);
    }
    if (state === 'telegraph') {
      // Every satellite turns to face the player and the cluster contracts.
      const k = Math.min(1, st / 1.15);
      for (let i = 0; i < 5; i += 1) p[`sat${i}`].position.multiplyScalar(1 - 0.45 * k);
      p.core.scale.setScalar(1 + 0.18 * k);
    } else if (state === 'attack') {
      p.core.scale.setScalar(1.24);
      p.core.position.z += 0.06 * Math.sin(t * 30);
    } else if (state === 'hurt') {
      p.core.scale.set(1.2, 0.82, 1.2);
    } else if (state === 'die') {
      const k = Math.min(1, st / 0.35);
      p.core.scale.setScalar(Math.max(0.02, 1 - k));
      for (let i = 0; i < 5; i += 1) p[`sat${i}`].position.multiplyScalar(1 + k * 2.2);
    }
  };
  return rig;
}

/** A person's outline worn slightly wrong, with seams at the shoulders. */
function buildSummoner(material) {
  const rig = new Rig(material);
  const r = rng(53);
  const skin = C('#8a7a68');
  const seam = C('#3a1e1a');
  const dark = C('#161c1a');

  const torso = new Acc();
  torso.add(box(0.52, 0.86, 0.34), place(0, 0.43, 0), facetShade(skin));
  // The seams: dark bands where the skin does not meet.
  torso.add(box(0.56, 0.05, 0.38), place(0, 0.80, 0), facetShade(seam, 0.15));
  torso.add(box(0.56, 0.05, 0.38), place(0, 0.30, 0), facetShade(seam, 0.15));
  rig.part('torso', torso, [0, 1.02, 0]);

  const head = new Acc();
  head.add(box(0.26, 0.30, 0.26), place(0, 0.15, 0), facetShade(skin));
  head.add(box(0.28, 0.06, 0.28), place(0, 0.31, 0), facetShade(seam, 0.15));
  // No face: a flat plane where one should be.
  head.add(box(0.20, 0.20, 0.02), place(0, 0.15, 0.14), facetShade(dark, 0.1));
  rig.part('head', head, [0, 0.88, 0], 'torso');

  for (const [name, sx] of [['armL', -1], ['armR', 1]]) {
    const arm = new Acc();
    arm.add(tube(0.72, 0.08, 0.06, 5), place(0, -0.72, 0), facetShade(skin.clone().multiplyScalar(0.92)));
    rig.part(name, arm, [0.30 * sx, 0.78, 0], 'torso');
  }
  for (const [name, sx] of [['legL', -1], ['legR', 1]]) {
    const leg = new Acc();
    leg.add(tube(1.00, 0.11, 0.09, 5), place(0, -1.00, 0), facetShade(skin.clone().multiplyScalar(0.85)));
    rig.part(name, leg, [0.14 * sx, 0, 0], 'torso');
  }

  rig.animate = (state, st, time) => {
    const { t } = stopMotion(time, ANIM.enemyFps);
    const p = rig.parts;
    rig.reset();
    // The walk is wrong on purpose: too even, no weight shift.
    if (state === 'walk' || state === 'chase') {
      const s = Math.sin(t * 4.2);
      p.legL.rotation.x = s * 0.5;
      p.legR.rotation.x = -s * 0.5;
      p.armL.rotation.x = -s * 0.12;
      p.armR.rotation.x = s * 0.12;
      p.head.rotation.y = 0;
    } else if (state === 'telegraph') {
      // Arms out level, head tips too far: the summon tell.
      const k = Math.min(1, st / 1.4);
      p.armL.rotation.z = 1.5 * k;
      p.armR.rotation.z = -1.5 * k;
      p.head.rotation.z = 0.75 * k;
      p.torso.position.y += 0.12 * k;
    } else if (state === 'attack') {
      p.armL.rotation.z = 1.5;
      p.armR.rotation.z = -1.5;
      p.head.rotation.z = 0.75;
      p.torso.scale.set(1.08, 0.94, 1.08);
    } else if (state === 'hurt') {
      p.torso.rotation.x = 0.22;
      p.head.rotation.x = 0.5;
    } else if (state === 'die') {
      // It comes apart at the seams rather than falling over.
      const k = Math.min(1, st / 0.9);
      p.head.position.y += k * 0.5;
      p.head.rotation.z = k * 2.2;
      p.armL.position.x -= k * 0.4;
      p.armR.position.x += k * 0.4;
      p.torso.rotation.x = k * 0.9;
      p.torso.position.y -= k * 0.5;
    } else {
      p.head.rotation.y = Math.sin(t * 0.6) * 0.5;
    }
  };
  return rig;
}

/**
 * The boss. Never fully in frame: a shoulder, a limb, a shape the fog refuses.
 * Built oversized and deliberately incomplete — there is no head, because the
 * player is never meant to establish where it ends.
 */
function buildScion(material) {
  const rig = new Rig(material);
  const r = rng(97);
  const hide = C('#1d2724');
  const plate = C('#2c3a33');
  const glow = C('#6f7f2a');

  const mass = new Acc();
  mass.add(blob(2.2, 1, 0.30, r), place(0, 0, 0, 0, 0, 1.2, 1.5, 1.0), facetShade(hide, 0.4));
  // Plates across the back, which is mostly what the player sees.
  for (let i = 0; i < 5; i += 1) {
    const a = -0.9 + i * 0.45;
    mass.add(wedge(1.1, 1.5, 0.5), place(Math.sin(a) * 1.5, 1.6 + Math.cos(a) * 0.4, -1.0, a, -0.2), facetShade(plate, 0.45));
  }
  rig.part('mass', mass, [0, 3.0, 0]);

  // Three brass conduits: the fight's actual targets, lit so they read in fog.
  for (let i = 0; i < 3; i += 1) {
    const a = -0.7 + i * 0.7;
    const cond = new Acc();
    cond.add(tube(1.1, 0.30, 0.22, 6), place(0, 0, 0), facetShade(C(PALETTE.brass), 0.25));
    cond.add(blob(0.30, 0, 0.2, r), place(0, 1.1, 0), facetShade(glow, 0.12));
    rig.part(`conduit${i}`, cond, [Math.sin(a) * 1.7, 0.4, 1.2 + Math.cos(a) * 0.3], 'mass');
  }

  for (const [name, sx] of [['limbL', -1], ['limbR', 1]]) {
    const limb = new Acc();
    limb.add(tube(3.0, 0.42, 0.24, 6), place(0, -3.0, 0), facetShade(hide, 0.4));
    limb.add(wedge(0.5, 1.0, 0.3), place(0, -3.4, 0.2, 0, -0.4), facetShade(plate, 0.4));
    rig.part(name, limb, [2.0 * sx, 1.2, 0], 'mass');
  }

  rig.animate = (state, st, time) => {
    const { t } = stopMotion(time, ANIM.bossFps);
    const p = rig.parts;
    rig.reset();
    p.mass.position.y += Math.sin(t * 0.5) * 0.20;
    p.mass.rotation.y = Math.sin(t * 0.22) * 0.10;

    if (state === 'walk' || state === 'chase') {
      const s = Math.sin(t * 1.5);
      p.limbL.rotation.x = s * 0.45;
      p.limbR.rotation.x = -s * 0.45;
      p.mass.rotation.z = s * 0.06;
      p.mass.position.y += Math.abs(s) * 0.28;
    } else if (state === 'telegraph') {
      // A very long, very readable rear-back before the slam.
      const k = Math.min(1, st / 1.6);
      p.limbL.rotation.x = -1.5 * k;
      p.limbR.rotation.x = -1.5 * k;
      p.mass.rotation.x = -0.32 * k;
      p.mass.position.y += 0.9 * k;
    } else if (state === 'attack') {
      const k = Math.min(1, st / 0.25);
      p.limbL.rotation.x = -1.5 + 2.3 * k;
      p.limbR.rotation.x = -1.5 + 2.3 * k;
      p.mass.rotation.x = -0.32 + 0.55 * k;
      p.mass.position.y += 0.9 * (1 - k);
    } else if (state === 'hurt') {
      p.mass.rotation.z = 0.10;
      p.mass.position.y -= 0.18;
    } else if (state === 'die') {
      const k = Math.min(1, st / 4.0);
      p.mass.position.y -= k * 4.2;
      p.mass.rotation.x = k * 0.55;
      p.limbL.rotation.x = k * 1.4;
      p.limbR.rotation.x = k * 1.2;
      p.mass.rotation.z = Math.sin(k * 9) * 0.12 * (1 - k);
    }
  };
  return rig;
}

const ENEMY_BUILDERS = {
  fisherman: buildFisherman,
  cultist: buildCultist,
  crawler: buildCrawler,
  eye: buildEye,
  summoner: buildSummoner,
  scion: buildScion,
};

/**
 * @param {string} type one of the ENEMIES keys
 * @param {THREE.Material} material
 * @returns {Rig}
 */
export function buildEnemyModel(type, material) {
  const builder = ENEMY_BUILDERS[type];
  if (!builder) throw new Error(`buildEnemyModel: unknown type "${type}"`);
  return builder(material);
}

/* ================================================================== *
 * Weapon viewmodels
 * ================================================================== */

const brass = () => C(PALETTE.brass);
const steel = () => C('#3f474a');
const woodDark = () => C('#3a2a1c');

/**
 * Viewmodels live in view space: -Z is forward, +X right, +Y up. Each returns a
 * rig whose animate() takes the weapon's fire progress so the recoil is stepped.
 */
function buildRevolverModel(material) {
  const rig = new Rig(material);
  const body = new Acc();
  body.add(box(0.055, 0.075, 0.30), place(0, 0, -0.15), facetShade(steel()));
  body.add(tube(0.12, 0.048, 0.046, 6), place(0, 0, -0.20, 0, Math.PI / 2), facetShade(steel(), 0.4));
  body.add(box(0.05, 0.14, 0.07), place(0, -0.10, 0.02, 0, 0.28), facetShade(woodDark()));
  body.add(box(0.02, 0.03, 0.03), place(0, 0.05, -0.29), facetShade(brass()));
  rig.part('gun', body, [0, 0, 0]);
  const cylinder = new Acc();
  cylinder.add(tube(0.075, 0.055, 0.055, 6), place(0, 0, 0, 0, Math.PI / 2), facetShade(brass(), 0.35));
  rig.part('cylinder', cylinder, [0, 0, -0.055], 'gun');
  const hand = new Acc();
  hand.add(box(0.07, 0.11, 0.09), place(0, 0, 0), facetShade(C(PALETTE.flesh)));
  rig.part('hand', hand, [0.005, -0.115, 0.03], 'gun');

  rig.animate = (fire, reload, time) => {
    rig.reset();
    const p = rig.parts;
    // Recoil: one frame of hard rise, then a stepped settle.
    p.gun.rotation.x = fire * 0.42;
    p.gun.position.z = fire * 0.075;
    p.cylinder.rotation.z = Math.floor(reload * 6) * (Math.PI / 3);
    if (reload > 0) {
      p.gun.rotation.z = Math.sin(reload * Math.PI) * 0.85;
      p.gun.position.y = -Math.sin(reload * Math.PI) * 0.09;
    }
  };
  return rig;
}

function buildShotgunModel(material) {
  const rig = new Rig(material);
  const body = new Acc();
  body.add(tube(0.52, 0.030, 0.028, 6), place(-0.022, 0, -0.26, 0, Math.PI / 2), facetShade(steel(), 0.4));
  body.add(tube(0.52, 0.030, 0.028, 6), place(0.022, 0, -0.26, 0, Math.PI / 2), facetShade(steel(), 0.4));
  body.add(box(0.09, 0.09, 0.16), place(0, -0.01, 0.02), facetShade(brass(), 0.3));
  body.add(box(0.055, 0.10, 0.24), place(0, -0.055, 0.16, 0, 0.16), facetShade(woodDark()));
  rig.part('gun', body, [0, 0, 0]);
  const hand = new Acc();
  hand.add(box(0.075, 0.10, 0.11), place(0, 0, 0), facetShade(C(PALETTE.flesh)));
  rig.part('hand', hand, [0.01, -0.10, 0.10], 'gun');

  rig.animate = (fire, reload, time) => {
    rig.reset();
    const p = rig.parts;
    p.gun.rotation.x = fire * 0.60;
    p.gun.position.z = fire * 0.11;
    if (reload > 0) {
      // Break action: the barrels hinge down and two shells go in.
      const k = Math.sin(reload * Math.PI);
      p.gun.rotation.x = -k * 0.55;
      p.gun.position.y = -k * 0.12;
    }
  };
  return rig;
}

function buildHarpoonModel(material) {
  const rig = new Rig(material);
  const body = new Acc();
  body.add(box(0.07, 0.07, 0.42), place(0, 0, -0.21), facetShade(steel()));
  body.add(tube(0.20, 0.055, 0.05, 5), place(0, 0.055, -0.10, 0, Math.PI / 2), facetShade(brass(), 0.3));
  body.add(box(0.05, 0.12, 0.07), place(0, -0.09, 0.06, 0, 0.22), facetShade(woodDark()));
  rig.part('gun', body, [0, 0, 0]);
  const shaft = new Acc();
  shaft.add(tube(0.62, 0.016, 0.014, 4), place(0, 0, 0, 0, Math.PI / 2), facetShade(steel(), 0.5));
  shaft.add(wedge(0.05, 0.10, 0.03), place(0, 0, -0.34, 0, 0, 1, 1, 1), facetShade(C(PALETTE.bone)));
  rig.part('shaft', shaft, [0, 0.02, -0.30], 'gun');

  rig.animate = (fire, reload, time) => {
    rig.reset();
    const p = rig.parts;
    p.gun.rotation.x = fire * 0.34;
    p.gun.position.z = fire * 0.13;
    // The shaft leaves and a new one is cranked in.
    p.shaft.visible = !(fire > 0.05 || (reload > 0 && reload < 0.6));
    if (reload > 0) p.gun.rotation.z = Math.sin(reload * Math.PI) * 0.4;
  };
  return rig;
}

function buildFlamerModel(material) {
  const rig = new Rig(material);
  const body = new Acc();
  body.add(tube(0.34, 0.045, 0.038, 6), place(0, 0, -0.17, 0, Math.PI / 2), facetShade(steel(), 0.4));
  // Censer head: a perforated brass bell.
  body.add(tube(0.13, 0.055, 0.085, 6), place(0, 0, -0.36, 0, Math.PI / 2), facetShade(brass(), 0.3));
  body.add(box(0.10, 0.16, 0.12), place(0.04, -0.04, 0.06), facetShade(C('#4a3a22')));
  body.add(tube(0.20, 0.045, 0.045, 6), place(-0.06, -0.02, 0.10), facetShade(C(PALETTE.ichor), 0.3));
  rig.part('gun', body, [0, 0, 0]);
  const pilot = new Acc();
  pilot.add(blob(0.022, 0, 0.3, rng(5)), place(0, 0, 0), facetShade(C(PALETTE.highAmberHot), 0.1));
  rig.part('pilot', pilot, [0, 0.045, -0.40], 'gun');

  rig.animate = (fire, reload, time) => {
    rig.reset();
    const p = rig.parts;
    const { frame } = stopMotion(time, ANIM.viewmodelFps);
    // Continuous fire shakes rather than recoils.
    const shake = fire > 0.02 ? ((frame % 2) ? 1 : -1) * 0.012 : 0;
    p.gun.position.x = shake;
    p.gun.position.y = shake * 0.5;
    p.gun.rotation.x = fire * 0.08;
    p.pilot.scale.setScalar(1 + (frame % 3) * 0.25 + fire * 2.0);
  };
  return rig;
}

function buildFocusModel(material) {
  const rig = new Rig(material);
  const body = new Acc();
  // Held in both hands, centred: a ring of brass around a lens that is not glass.
  body.add(tube(0.06, 0.135, 0.135, 8), place(0, 0, -0.03, 0, Math.PI / 2), facetShade(brass(), 0.3));
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    body.add(box(0.022, 0.05, 0.022), place(Math.cos(a) * 0.15, Math.sin(a) * 0.15, -0.03, 0, a), facetShade(brass()));
  }
  rig.part('ring', body, [0, 0, 0]);
  const lens = new Acc();
  lens.add(blob(0.105, 1, 0.06, rng(3)), place(0, 0, 0, 0, 0, 1, 1, 0.28), facetShade(C('#7fa06a'), 0.14));
  rig.part('lens', lens, [0, 0, -0.03], 'ring');

  rig.animate = (fire, reload, time, charge = 0) => {
    rig.reset();
    const p = rig.parts;
    const { frame } = stopMotion(time, ANIM.viewmodelFps);
    p.ring.rotation.z = frame * 0.09;
    p.lens.scale.setScalar(1 + charge * 0.35 + fire * 0.6);
    p.ring.position.z = fire * 0.10;
    // The ring counter-rotates as it charges: the only cue that it is loading.
    if (charge > 0) p.ring.rotation.z -= charge * 1.6;
  };
  return rig;
}

function buildBoneCannonModel(material) {
  const rig = new Rig(material);
  const body = new Acc();
  // A jaw section geared into a brass breech.
  body.add(tube(0.44, 0.085, 0.11, 6), place(0, 0, -0.22, 0, Math.PI / 2), facetShade(C(PALETTE.bone), 0.34));
  for (let i = 0; i < 5; i += 1) {
    body.add(wedge(0.05, 0.09, 0.04), place(0, -0.075, -0.10 - i * 0.075, 0, Math.PI), facetShade(C(PALETTE.bone)));
  }
  body.add(box(0.14, 0.14, 0.14), place(0, 0, 0.04), facetShade(brass(), 0.3));
  body.add(box(0.06, 0.15, 0.08), place(0, -0.11, 0.14, 0, 0.2), facetShade(woodDark()));
  rig.part('gun', body, [0, 0, 0]);
  const gear = new Acc();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    gear.add(box(0.018, 0.04, 0.018), place(Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0), facetShade(brass()));
  }
  gear.add(tube(0.02, 0.058, 0.058, 8), place(0, 0, -0.01, 0, Math.PI / 2), facetShade(brass(), 0.25));
  rig.part('gear', gear, [0.085, 0.01, 0.04], 'gun');

  rig.animate = (fire, reload, time, charge = 0) => {
    rig.reset();
    const p = rig.parts;
    // The windup is visible: the gear spins up before the shot exists.
    p.gear.rotation.z = -(charge * 14 + time * 2);
    p.gun.rotation.x = fire * 0.85;
    p.gun.position.z = fire * 0.16;
    p.gun.position.y = -fire * 0.05;
    if (reload > 0) {
      const k = Math.sin(reload * Math.PI);
      p.gun.rotation.z = k * 0.5;
      p.gun.position.y = -k * 0.14;
    }
  };
  return rig;
}

const WEAPON_BUILDERS = {
  revolver: buildRevolverModel,
  shotgun: buildShotgunModel,
  harpoon: buildHarpoonModel,
  flamer: buildFlamerModel,
  focus: buildFocusModel,
  bonecannon: buildBoneCannonModel,
};

export function buildViewmodel(weaponId, material) {
  const builder = WEAPON_BUILDERS[weaponId];
  if (!builder) throw new Error(`buildViewmodel: unknown weapon "${weaponId}"`);
  return builder(material);
}

/* ================================================================== *
 * Pickups and world props
 * ================================================================== */

/** Small spinning pickup markers, one silhouette per category. */
export function buildPickupModel(kind, material) {
  const acc = new Acc();
  const r = rng(kind.length * 17 + 3);
  switch (kind) {
    case 'health':
      acc.add(box(0.24, 0.10, 0.16), place(0, 0.05, 0), facetShade(C('#7a2a20')));
      acc.add(box(0.08, 0.12, 0.06), place(0, 0.12, 0), facetShade(C(PALETTE.bone)));
      break;
    case 'armor':
      acc.add(wedge(0.30, 0.26, 0.14), place(0, 0, 0), facetShade(C(PALETTE.brass), 0.3));
      break;
    case 'key':
      acc.add(tube(0.26, 0.022, 0.022, 5), place(0, 0, 0), facetShade(C(PALETTE.brass), 0.25));
      acc.add(box(0.10, 0.03, 0.03), place(0.04, 0.03, 0), facetShade(C(PALETTE.brass)));
      acc.add(tube(0.04, 0.07, 0.07, 6), place(0, 0.26, 0, 0, Math.PI / 2), facetShade(C(PALETTE.brass), 0.3));
      break;
    case 'weapon':
      acc.add(box(0.34, 0.08, 0.10), place(0, 0.05, 0), facetShade(C('#3f474a')));
      acc.add(box(0.08, 0.14, 0.06), place(-0.11, -0.02, 0), facetShade(woodDark()));
      break;
    case 'note':
      acc.add(box(0.20, 0.24, 0.008), place(0, 0.12, 0), facetShade(C(PALETTE.paper), 0.18));
      break;
    default: // ammo
      acc.add(box(0.22, 0.14, 0.16), place(0, 0.07, 0), facetShade(C('#3a3a2c')));
      acc.add(box(0.24, 0.03, 0.18), place(0, 0.145, 0), facetShade(C(PALETTE.brass)));
      break;
  }
  const mesh = new THREE.Mesh(acc.build(), material);
  mesh.frustumCulled = false;
  return mesh;
}

/** A gib: one small irregular chunk, reused for every enemy. */
export function buildGibGeometry(seed = 1) {
  const acc = new Acc();
  const r = rng(seed);
  acc.add(blob(0.09, 0, 0.55, r), place(0, 0, 0), facetShade(C('#5c1710'), 0.4));
  return acc.build();
}

export { Rig, wedge, blob, tube, box, facetShade, rng };
