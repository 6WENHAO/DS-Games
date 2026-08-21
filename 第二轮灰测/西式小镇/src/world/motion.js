// ---------------------------------------------------------------------------
// 动态对象：会走路的镇民、马车、放牧的羊群、游动的野鸭、划桨小船……
// 镇民与动物用 InstancedMesh（顶点色区分衣着），几十号人只占几个 draw call。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { MAT } from '../lib/materials.js';
import * as G from '../lib/geom.js';
import { Rng } from '../lib/rng.js';

const TAU = Math.PI * 2;

/* ========================================================================== */
/*                                路径工具                                    */
/* ========================================================================== */
function prepPath(pts) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1e-4) continue;
    segs.push({ x0, z0, len, dx: (x1 - x0) / len, dz: (z1 - z0) / len });
    total += len;
  }
  return { segs, total };
}

const _sm = { x: 0, z: 0, dx: 0, dz: 1 };
function sample(path, d) {
  let dd = Math.max(0, Math.min(d, path.total));
  const segs = path.segs;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (dd <= s.len || i === segs.length - 1) {
      _sm.x = s.x0 + s.dx * dd;
      _sm.z = s.z0 + s.dz * dd;
      _sm.dx = s.dx;
      _sm.dz = s.dz;
      return _sm;
    }
    dd -= s.len;
  }
  return _sm;
}

/** 给几何体刷上顶点色（用于共享材质 + 多种配色） */
function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  return geo;
}

function mergeTinted(parts) {
  return G.mergeMany(parts);
}

/* ========================================================================== */
/*                              走路的镇民                                    */
/* ========================================================================== */
const COATS = [0x8f3b2f, 0x33506e, 0x2f5744, 0x6b4a5e, 0x3c3630, 0x7d6a45, 0x9c6b3f, 0x4a5a6b];
const SKIN = 0xe0b49a;
const HAT = 0x2a2620;

/** 上半身（原点在脚底），腿另算 */
function bodyGeom(coat, female) {
  const parts = [];
  if (female) {
    const skirt = G.makeCyl(0.2, 0.36, 0.5, 10, 0.6);
    skirt.translate(0, 0.62, 0);
    parts.push(paint(skirt, coat));
    const top = G.makeBox(0.42, 0.5, 0.26, 0.6);
    top.translate(0, 1.0, 0);
    parts.push(paint(top, coat));
  } else {
    const torso = G.makeBox(0.46, 0.72, 0.28, 0.6);
    torso.translate(0, 0.7, 0);
    parts.push(paint(torso, coat));
  }
  for (const sx of [-1, 1]) {
    const arm = G.makeBox(0.12, 0.6, 0.14, 0.5);
    arm.translate(sx * 0.28, 0.74, 0);
    parts.push(paint(arm, coat));
  }
  const neck = G.makeCyl(0.09, 0.09, 0.11, 8, 0.4);
  neck.translate(0, 1.36, 0);
  parts.push(paint(neck, SKIN));
  const head = G.makeBall(0.145, 10, 0.5);
  head.translate(0, 1.58, 0);
  parts.push(paint(head, SKIN));
  const brim = G.makeCyl(0.25, 0.25, 0.03, 10, 0.5);
  brim.translate(0, 1.66, 0);
  parts.push(paint(brim, HAT));
  const crown = G.makeCyl(0.14, 0.15, 0.2, 10, 0.5);
  crown.translate(0, 1.68, 0);
  parts.push(paint(crown, HAT));
  return mergeTinted(parts);
}

/** 腿：原点在髋部，向下延伸 */
function legGeom() {
  const parts = [];
  const leg = G.makeBox(0.17, 0.68, 0.19, 0.5);
  leg.translate(0, -0.68, 0);
  parts.push(paint(leg, 0x35302a));
  const shoe = G.makeBox(0.19, 0.1, 0.3, 0.5);
  shoe.translate(0, -0.78, 0.04);
  parts.push(paint(shoe, 0x1f1c18));
  return mergeTinted(parts);
}

/**
 * @param {Array} routes [{ pts, n, speed, y, spread }]
 */
export function createWalkers(routes, seed = 4321) {
  const rng = new Rng(seed);
  const variants = [];
  for (let i = 0; i < COATS.length; i++) {
    variants.push(bodyGeom(COATS[i], i % 3 === 0));
  }
  const legGeo = legGeom();

  const walkers = [];
  for (const r of routes) {
    const path = prepPath(r.pts);
    if (!path.total) continue;
    const n = r.n ?? 4;
    for (let i = 0; i < n; i++) {
      walkers.push({
        path,
        y: r.y ?? 0,
        d: rng.range(0, path.total),
        dir: rng.bool() ? 1 : -1,
        sp: rng.range(0.7, 1.35) * (r.speed ?? 1),
        side: rng.range(-1, 1) * (r.spread ?? 2.6),
        ph: rng.range(0, TAU),
        v: rng.int(0, variants.length - 1),
        scale: rng.range(0.93, 1.07),
        pause: 0,
        pauseAt: rng.range(6, 30),
      });
    }
  }

  const group = new THREE.Group();
  group.name = 'walkers';
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  bodyMat.name = 'walkerBody';

  const buckets = variants.map(() => []);
  walkers.forEach((w) => {
    w.slot = buckets[w.v].length;
    buckets[w.v].push(w);
  });
  const bodyMeshes = variants.map((geo, i) => {
    const im = new THREE.InstancedMesh(geo, bodyMat, Math.max(1, buckets[i].length));
    im.castShadow = true;
    im.receiveShadow = false;
    im.frustumCulled = false;
    im.name = 'walkerBody' + i;
    group.add(im);
    return im;
  });
  const legMats = [new THREE.InstancedMesh(legGeo, bodyMat, walkers.length), new THREE.InstancedMesh(legGeo, bodyMat, walkers.length)];
  legMats.forEach((im, i) => {
    im.castShadow = true;
    im.frustumCulled = false;
    im.name = 'walkerLeg' + i;
    group.add(im);
  });
  walkers.forEach((w, i) => {
    w.gi = i;
  });

  const m = new THREE.Matrix4();
  const mLeg = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();

  function update(dt, t) {
    for (const w of walkers) {
      // 偶尔停下来「聊天」
      if (w.pause > 0) {
        w.pause -= dt;
      } else {
        w.d += w.dir * w.sp * dt;
        w.pauseAt -= dt;
        if (w.pauseAt <= 0) {
          w.pause = 1.5 + Math.random() * 3.5;
          w.pauseAt = 12 + Math.random() * 30;
        }
        if (w.d > w.path.total) {
          w.d = w.path.total;
          w.dir = -1;
        } else if (w.d < 0) {
          w.d = 0;
          w.dir = 1;
        }
      }
      const p = sample(w.path, w.d);
      const dx = p.dx * w.dir;
      const dz = p.dz * w.dir;
      const heading = Math.atan2(dx, dz);
      const nx = -dz;
      const nz = dx;
      const moving = w.pause <= 0 ? 1 : 0;
      const gait = t * 5.4 * w.sp + w.ph;
      const bob = moving ? Math.abs(Math.sin(gait)) * 0.045 : 0;
      e.set(0, heading, moving ? Math.sin(gait * 2) * 0.03 : 0);
      q.setFromEuler(e);
      v.set(p.x + nx * w.side, w.y + bob, p.z + nz * w.side);
      sv.set(w.scale, w.scale, w.scale);
      m.compose(v, q, sv);
      bodyMeshes[w.v].setMatrixAt(w.slot, m);
      // 双腿摆动
      const swing = moving ? Math.sin(gait) * 0.46 : 0;
      for (let s = 0; s < 2; s++) {
        tmp.makeTranslation((s ? 0.11 : -0.11) * w.scale, 0.72 * w.scale, 0);
        mLeg.copy(m).multiply(tmp);
        tmp.makeRotationX(s ? -swing : swing);
        mLeg.multiply(tmp);
        legMats[s].setMatrixAt(w.gi, mLeg);
      }
    }
    bodyMeshes.forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
    });
    legMats.forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
    });
  }

  return { group, update, count: walkers.length };
}

/* ========================================================================== */
/*                            马车 / 板车（会跑）                              */
/* ========================================================================== */
/**
 * @param {Object} o { pts, speed, kind:'coach'|'wagon'|'cart', y, phase }
 * @returns {{group: THREE.Group, update: Function}}
 */
export function createVehicle(o = {}) {
  const kind = o.kind ?? 'coach';
  const group = new THREE.Group();
  group.name = 'vehicle-' + kind;
  const s = new G.Sculptor('veh');
  const frontR = kind === 'cart' ? 0.5 : 0.56;
  const rearR = kind === 'cart' ? 0.5 : 0.86;
  const frontZ = 1.5;
  const rearZ = -1.3;

  if (kind === 'coach') {
    s.box(MAT.timberDark, 2.3, 0.24, 4.2, 0, 0.66, 0, 0, 1.2);
    s.box(MAT.woodRed, 2.2, 1.6, 3.1, 0, 0.9, -0.2, 0, 1.2);
    s.box(MAT.trim, 2.3, 0.14, 3.2, 0, 2.5, -0.2, 0, 1.2);
    s.hip(MAT.roofSlate, 3.3, 2.5, 0.5, 0, 2.6, -0.2, Math.PI / 2, 0.6, 1.2);
    s.panel(MAT.glass, 1.0, 0.9, 1.12, 1.45, -0.2, Math.PI / 2, 1);
    s.panel(MAT.glass, 1.0, 0.9, -1.12, 1.45, -0.2, -Math.PI / 2, 1);
    s.panel(MAT.glass, 0.9, 0.8, 0, 1.5, 1.36, 0, 1);
    s.box(MAT.woodPlank, 1.7, 0.16, 0.7, 0, 2.0, 1.5, 0, 0.8); // 车夫座
    s.box(MAT.timberDark, 0.14, 0.5, 0.14, 0, 2.16, 1.2);
    s.box(MAT.gold, 0.5, 0.5, 0.04, 1.12, 1.0, -0.2, Math.PI / 2, 0.5);
  } else if (kind === 'wagon') {
    s.box(MAT.timberDark, 2.4, 0.26, 5.0, 0, 0.6, 0, 0, 1.2);
    s.box(MAT.woodPlank, 2.4, 0.9, 4.6, 0, 0.86, 0, 0, 1);
    s.box(MAT.hay, 2.2, 1.5, 4.2, 0, 1.7, 0, 0, 1.4);
    s.box(MAT.hay, 1.6, 0.7, 3.2, 0, 3.2, 0, 0, 1.4);
    s.box(MAT.woodPlank, 1.6, 0.14, 0.6, 0, 1.8, 2.4, 0, 0.8);
  } else {
    s.box(MAT.timberDark, 1.9, 0.22, 3.2, 0, 0.55, 0, 0, 1.2);
    s.box(MAT.woodPlank, 1.9, 0.7, 3.0, 0, 0.77, 0, 0, 1);
    s.box(MAT.woodPlank, 1.5, 0.5, 1.4, 0, 1.47, -0.4, 0, 0.7);
    s.cyl(MAT.woodPlankV, 0.34, 0.34, 0.8, -0.5, 1.47, 0.7, 10, 0, 1);
    s.cyl(MAT.woodPlankV, 0.34, 0.34, 0.8, 0.45, 1.47, 0.9, 10, 0, 1);
  }
  // 车辕
  s.box(MAT.timber, 0.11, 0.11, 2.8, -0.55, 0.9, frontZ + 1.6);
  s.box(MAT.timber, 0.11, 0.11, 2.8, 0.55, 0.9, frontZ + 1.6);
  // 马
  const hx = kind === 'wagon' ? 0.9 : 0;
  horseInto(s, -hx, frontZ + 3.3, 0);
  if (kind === 'wagon') horseInto(s, hx, frontZ + 3.3, 0);
  group.add(s.finalize());

  // 车轮（可滚动）
  function wheelPair(r, z) {
    const parts = [];
    for (const sx of [-1, 1]) {
      const t = G.makeTorus(r, r * 0.13, 16, 6, 1);
      t.rotateY(Math.PI / 2);
      t.translate(sx * 1.05, 0, 0);
      parts.push(t);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        const sp = G.makeBox(0.07, r * 2 * 0.94, 0.07, 1);
        sp.translate(0, -r * 0.94, 0);
        sp.rotateZ(a);
        sp.rotateY(Math.PI / 2);
        sp.translate(sx * 1.05, 0, 0);
        parts.push(sp);
      }
      const hub = G.makeCyl(0.12, 0.12, 0.3, 8, 1);
      hub.rotateZ(Math.PI / 2);
      hub.translate(sx * 1.05 + 0.15, 0, 0);
      parts.push(hub);
    }
    const mesh = new THREE.Mesh(G.mergeMany(parts), MAT.timberDark);
    mesh.castShadow = true;
    mesh.position.set(0, r, z);
    group.add(mesh);
    return mesh;
  }
  const wf = wheelPair(frontR, frontZ);
  const wr = wheelPair(rearR, rearZ);

  const path = prepPath(o.pts);
  const speed = o.speed ?? 3.2;
  const y0 = o.y ?? 0;
  let d = (o.phase ?? 0) * path.total;
  let dir = 1;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  function update(dt, t) {
    d += dir * speed * dt;
    if (d > path.total) {
      d = path.total;
      dir = -1;
    } else if (d < 0) {
      d = 0;
      dir = 1;
    }
    const p = sample(path, d);
    group.position.set(p.x, y0 + Math.sin(t * 6 + d) * 0.02, p.z);
    e.set(0, Math.atan2(p.dx * dir, p.dz * dir), 0);
    q.setFromEuler(e);
    group.quaternion.copy(q);
    wf.rotation.x -= (speed * dt) / frontR;
    wr.rotation.x -= (speed * dt) / rearR;
  }

  return { group, update };
}

/** 往 Sculptor 里放一匹马（原点在蹄下，朝 +Z） */
function horseInto(s, x, z, ry) {
  s.push(x, 0, z, ry);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) s.box(MAT.trimDark, 0.14, 0.98, 0.14, sx * 0.3, 0, sz * 0.6);
  s.box(MAT.horse, 0.82, 0.88, 2.1, 0, 0.94, 0, 0, 1);
  s.box(MAT.horse, 0.44, 0.85, 0.5, 0, 1.42, 1.05, -0.34, 0.8);
  s.box(MAT.horse, 0.38, 0.52, 0.72, 0, 1.95, 1.34, 0.42, 0.7);
  s.box(MAT.trimDark, 0.2, 0.5, 0.2, 0, 1.9, 1.02, 0.2, 0.5);
  s.box(MAT.trimDark, 0.1, 0.72, 0.1, 0, 1.25, -1.06, -0.35);
  s.box(MAT.doorRed, 0.86, 0.3, 0.6, 0, 1.7, 0.2, 0, 0.6);
  s.pop();
}

/* ========================================================================== */
/*                          放牧的羊 / 游动的野鸭                              */
/* ========================================================================== */
function sheepGeom() {
  const parts = [];
  const body = G.makeBall(0.52, 10, 0.8);
  body.scale(1.1, 0.95, 1.25);
  body.translate(0, 0.74, 0);
  parts.push(paint(body, 0xf0ece0));
  const rump = G.makeBall(0.34, 8, 0.8);
  rump.translate(0, 0.76, 0.5);
  parts.push(paint(rump, 0xf5f2e8));
  const head = G.makeBall(0.19, 8, 0.6);
  head.translate(0, 0.8, 0.78);
  parts.push(paint(head, 0x3a352f));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const leg = G.makeBox(0.09, 0.44, 0.09, 0.5);
      leg.translate(sx * 0.22, 0, sz * 0.28);
      parts.push(paint(leg, 0x3a352f));
    }
  return mergeTinted(parts);
}

function duckGeom() {
  const parts = [];
  const body = G.makeBall(0.22, 8, 0.5);
  body.scale(1, 0.85, 1.3);
  body.translate(0, 0.16, 0);
  parts.push(paint(body, 0xf6f2e6));
  const neck = G.makeCyl(0.08, 0.1, 0.18, 6, 0.4);
  neck.translate(0, 0.24, 0.16);
  parts.push(paint(neck, 0xf6f2e6));
  const head = G.makeBall(0.12, 8, 0.4);
  head.translate(0, 0.44, 0.18);
  parts.push(paint(head, 0x3f6b4a));
  const beak = G.makeCone(0.06, 0.16, 6, 0.4);
  beak.rotateX(Math.PI / 2);
  beak.translate(0, 0.44, 0.32);
  parts.push(paint(beak, 0xe8c34a));
  return mergeTinted(parts);
}

/** 牧场上慢慢移动、低头吃草的羊群 */
export function createFlock(spots, seed = 2468) {
  const rng = new Rng(seed);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  mat.name = 'flock';
  const geo = sheepGeom();
  const list = [];
  for (const sp of spots) {
    for (let i = 0; i < (sp.n ?? 4); i++) {
      list.push({
        cx: sp.x,
        cz: sp.z,
        r: sp.r ?? 10,
        y: sp.y ?? 0,
        x: sp.x + rng.range(-sp.r, sp.r),
        z: sp.z + rng.range(-sp.r, sp.r),
        tx: 0,
        tz: 0,
        heading: rng.range(0, TAU),
        sp: rng.range(0.25, 0.5),
        wait: rng.range(0, 6),
        ph: rng.range(0, TAU),
        scale: rng.range(0.85, 1.12),
      });
    }
  }
  list.forEach((a) => {
    a.tx = a.x;
    a.tz = a.z;
  });
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'flock';

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();

  function update(dt, t) {
    list.forEach((a, i) => {
      if (a.wait > 0) {
        a.wait -= dt;
      } else {
        const dx = a.tx - a.x;
        const dz = a.tz - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.3) {
          const ang = Math.random() * TAU;
          const rr = Math.random() * a.r;
          a.tx = a.cx + Math.cos(ang) * rr;
          a.tz = a.cz + Math.sin(ang) * rr;
          a.wait = 3 + Math.random() * 9;
        } else {
          a.x += (dx / dist) * a.sp * dt;
          a.z += (dz / dist) * a.sp * dt;
          a.heading = Math.atan2(dx, dz);
        }
      }
      const grazing = a.wait > 0;
      e.set(grazing ? 0.34 + Math.sin(t * 1.6 + a.ph) * 0.12 : 0.05, a.heading, 0);
      q.setFromEuler(e);
      v.set(a.x, a.y, a.z);
      sv.set(a.scale, a.scale, a.scale);
      m.compose(v, q, sv);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, update };
}

/** 水面上打转的野鸭 */
export function createDucks(ponds, seed = 1357) {
  const rng = new Rng(seed);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  mat.name = 'ducks';
  const geo = duckGeom();
  const list = [];
  for (const p of ponds) {
    for (let i = 0; i < (p.n ?? 4); i++) {
      list.push({
        cx: p.x,
        cz: p.z,
        y: p.y ?? 0.14,
        r: rng.range(p.r * 0.25, p.r * 0.85),
        a: rng.range(0, TAU),
        sp: rng.range(0.1, 0.26) * (rng.bool() ? 1 : -1),
        ph: rng.range(0, TAU),
        scale: rng.range(0.9, 1.15),
      });
    }
  }
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  mesh.name = 'ducks';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();
  function update(dt, t) {
    list.forEach((d, i) => {
      d.a += d.sp * dt;
      const x = d.cx + Math.cos(d.a) * d.r;
      const z = d.cz + Math.sin(d.a) * d.r;
      e.set(Math.sin(t * 1.4 + d.ph) * 0.06, d.a + (d.sp > 0 ? Math.PI / 2 : -Math.PI / 2), Math.cos(t * 1.1 + d.ph) * 0.05);
      q.setFromEuler(e);
      v.set(x, d.y + Math.sin(t * 1.7 + d.ph) * 0.03, z);
      sv.set(d.scale, d.scale, d.scale);
      m.compose(v, q, sv);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, update };
}

/* ========================================================================== */
/*                              划桨的小船                                    */
/* ========================================================================== */
export function createRowBoat(o = {}) {
  const group = new THREE.Group();
  group.name = 'rowboat';
  const s = new G.Sculptor('row');
  s.box(MAT.woodPlankV, 1.5, 0.55, 3.6, 0, 0, 0, 0, 1);
  s.box(MAT.woodPlankV, 1.0, 0.5, 1.1, 0, 0.04, 2.2, 0, 1);
  s.box(MAT.woodPlankV, 0.9, 0.48, 1.0, 0, 0.04, -2.0, 0, 1);
  s.box(MAT.woodRed, 1.6, 0.14, 3.8, 0, 0.5, 0, 0, 1.2);
  for (const zz of [-0.9, 0.4]) s.box(MAT.woodPlank, 1.35, 0.09, 0.3, 0, 0.5, zz, 0, 0.6);
  // 船夫
  s.box(MAT.doorBlue, 0.42, 0.62, 0.26, 0, 0.62, 0.1, 0, 0.6);
  s.ball(MAT.plasterRose, 0.14, 0, 1.4, 0.1, 8);
  s.cyl(MAT.trimDark, 0.22, 0.22, 0.03, 0, 1.5, 0.1, 8);
  group.add(s.finalize());

  // 两支会划的桨
  const oars = [];
  for (const sx of [-1, 1]) {
    const sub = new G.Sculptor('oar');
    sub.bar(MAT.timber, 0.05, 2.6, 0, 0, -1.0, 'z', 6);
    sub.boxC(MAT.woodPlank, 0.24, 0.9, 0.05, 0, 0, -2.45, Math.PI / 2, 0, 0, 0.6);
    const g = sub.finalize();
    g.position.set(sx * 0.85, 0.62, 0.35);
    group.add(g);
    oars.push({ g, sx });
  }

  const path = prepPath(o.pts);
  const speed = o.speed ?? 0.6;
  const y0 = o.y ?? 0.18;
  let d = (o.phase ?? 0) * path.total;
  let dir = 1;
  function update(dt, t) {
    d += dir * speed * dt;
    if (d > path.total) {
      d = path.total;
      dir = -1;
    } else if (d < 0) {
      d = 0;
      dir = 1;
    }
    const p = sample(path, d);
    group.position.set(p.x, y0 + Math.sin(t * 0.9) * 0.05, p.z);
    group.rotation.y = Math.atan2(p.dx * dir, p.dz * dir) + Math.PI;
    group.rotation.z = Math.sin(t * 0.8) * 0.03;
    const stroke = Math.sin(t * 1.9);
    for (const o2 of oars) {
      o2.g.rotation.x = 0.35 + stroke * 0.42;
      o2.g.rotation.z = o2.sx * (0.2 + Math.cos(t * 1.9) * 0.12);
    }
  }
  return { group, update };
}

/* ========================================================================== */
/*                         风车（可独立摆放的整台）                            */
/* ========================================================================== */
/** 荷兰式柱式小风车（body 会随风转向） */
export function postMill(s, o = {}) {
  const h = o.h ?? 6.5;
  // 基座
  s.box(MAT.stoneDark, 4.6, 0.6, 4.6, 0, 0, 0, 0, 2);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      s.boxC(MAT.timberDark, 0.34, 5.2, 0.34, sx * 1.5, 1.9, sz * 1.5, sx * sz * 0, 0, sx * 0.28, 1);
    }
  s.cyl(MAT.timberDark, 0.55, 0.8, h * 0.62, 0, 0.6, 0, 10, 0, 1.4);
  // 磨坊主体（木盒 + 双坡顶）
  const body = new THREE.Group();
  const sub = new G.Sculptor('mill');
  sub.box(MAT.woodPlankV, 4.2, 4.4, 5.0, 0, -2.2, 0, 0, 1.2);
  sub.gable(MAT.roofBrown, 5.4, 4.6, 1.8, 0, 2.2, 0, Math.PI / 2, 1.2, 'slopes');
  sub.gable(MAT.woodPlankV, 5.4, 4.6, 1.8, 0, 2.2, 0, Math.PI / 2, 1.2, 'ends');
  sub.box(MAT.timberDark, 0.3, 0.3, 5.2, -1.9, 2.0, 0);
  sub.box(MAT.timberDark, 0.3, 0.3, 5.2, 1.9, 2.0, 0);
  sub.box(MAT.timberDark, 0.28, 5.6, 0.28, 0, -2.4, -3.2, 0, 1); // 尾梯
  sub.boxC(MAT.timber, 0.24, 6.4, 0.24, 0, -1.4, -4.0, 0.5, 0, 0, 1);
  sub.panel(MAT.glass, 0.7, 0.9, 0, -1.2, 2.55, 0, 1);
  sub.box(MAT.timberDark, 1.1, 1.7, 0.18, 0, -2.2, 2.52, 0, 0.8);
  body.add(sub.finalize());

  // 四叶风车
  const sails = new THREE.Group();
  const ss = new G.Sculptor('sails');
  ss.cyl(MAT.timberDark, 0.32, 0.4, 0.7, 0, -0.35, 0, 10);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    ss.boxC(MAT.timber, 0.26, 7.6, 0.26, Math.cos(a) * 3.9, Math.sin(a) * 3.9, 0.3, 0, 0, -a + Math.PI / 2, 1);
    for (let k = 1; k <= 6; k++) {
      const tt = 1.0 + k * 0.95;
      ss.boxC(MAT.timber, 1.7, 0.1, 0.1, Math.cos(a) * tt, Math.sin(a) * tt, 0.42, 0, 0, -a, 0.7);
    }
    ss.boxC(MAT.clothCream, 1.55, 5.4, 0.05, Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0.52, 0, 0, -a + Math.PI / 2, 1.6);
  }
  sails.add(ss.finalize());
  sails.position.set(0, 0.6, 2.9);
  body.add(sails);

  s.attach(body, 0, h, 0, 0);
  const spd = o.speed ?? 0.62;
  s.onUpdate((dt, t) => {
    sails.rotation.z -= dt * spd * (1 + Math.sin(t * 0.23) * 0.3);
    body.rotation.y = Math.sin(t * 0.07) * 0.5;
  });
  return h + 5;
}
