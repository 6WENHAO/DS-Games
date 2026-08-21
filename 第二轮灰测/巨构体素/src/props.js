/**
 * 动态道具层 —— 巨构的“尺度参照物”。
 *
 * 一个人 3 体素、一辆车 6 体素、一台飞行器 8 体素、一部轿厢 10 体素：
 * 只有把这些东西放进画面，1436 体素才会真的变成“震撼”。
 */

import * as THREE from 'three';
import { createBeamMaterial } from './shading.js';

const S = 1 / 255;

/** 用一组体素方盒拼出小模型，直接复用体素材质（颜色/AO/自发光都走顶点属性） */
export function makeVoxModel(boxes) {
  const pos = [], nor = [], col = [], ao = [], emi = [];
  const FACES = [
    { n: [1, 0, 0], v: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] },
    { n: [-1, 0, 0], v: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]] },
    { n: [0, 1, 0], v: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
    { n: [0, -1, 0], v: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]] },
    { n: [0, 0, 1], v: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]] },
    { n: [0, 0, -1], v: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] },
  ];
  const idx = [];
  let vi = 0;
  for (const b of boxes) {
    const r = ((b.color >> 16) & 255) * S, g = ((b.color >> 8) & 255) * S, bl = (b.color & 255) * S;
    const e = b.emi || 0, ng = b.night === undefined ? (e > 0 ? 1 : 0) : b.night;
    for (const f of FACES) {
      for (const v of f.v) {
        pos.push(b.x + v[0] * b.w, b.y + v[1] * b.h, b.z + v[2] * b.d);
        nor.push(f.n[0], f.n[1], f.n[2]);
        col.push(r, g, bl);
        // 顶面亮、底面暗，给小模型一点体积感
        ao.push(f.n[1] > 0 ? 1.0 : f.n[1] < 0 ? 0.55 : 0.82);
        emi.push(e / 4, ng / 4);
      }
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aAo', new THREE.Float32BufferAttribute(ao, 1));
  geo.setAttribute('aEmi', new THREE.Float32BufferAttribute(emi, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

const MODEL = {
  // 飞行器：8 体素长
  aircraft: () => makeVoxModel([
    { x: -4, y: -0.8, z: -1.1, w: 8, h: 1.6, d: 2.2, color: 0x2c3138 },
    { x: -1.4, y: 0.8, z: -0.9, w: 3.2, h: 0.9, d: 1.8, color: 0x3a424c },
    { x: 1.4, y: -0.5, z: -3.6, w: 1.8, h: 0.7, d: 7.2, color: 0x353b43 },
    { x: 2.6, y: 0.6, z: -0.7, w: 1.4, h: 1.2, d: 1.4, color: 0xa9d8ff, emi: 1.4 },
    { x: -4.6, y: -0.4, z: -0.5, w: 0.8, h: 0.9, d: 1.0, color: 0xff5a3c, emi: 2.4 },
    { x: -2.2, y: -1.3, z: -2.4, w: 1.2, h: 0.7, d: 1.2, color: 0x46f0ff, emi: 2.0 },
    { x: -2.2, y: -1.3, z: 1.2, w: 1.2, h: 0.7, d: 1.2, color: 0x46f0ff, emi: 2.0 },
  ]),
  // 地面车辆：6 体素长
  vehicle: (body) => makeVoxModel([
    { x: -3, y: 0, z: -1.2, w: 6, h: 1.7, d: 2.4, color: body },
    { x: -1.4, y: 1.7, z: -1.0, w: 3.0, h: 1.2, d: 2.0, color: 0x1d2429 },
    { x: 2.6, y: 0.5, z: -1.0, w: 0.5, h: 0.7, d: 0.8, color: 0xfff0cf, emi: 2.2 },
    { x: 2.6, y: 0.5, z: 0.2, w: 0.5, h: 0.7, d: 0.8, color: 0xfff0cf, emi: 2.2 },
    { x: -3.2, y: 0.5, z: -0.9, w: 0.4, h: 0.6, d: 1.8, color: 0xff2f26, emi: 1.8 },
  ]),
  // 行人：3 体素高
  person: (c1, c2) => makeVoxModel([
    { x: -0.45, y: 0, z: -0.35, w: 0.9, h: 1.9, d: 0.7, color: c1 },
    { x: -0.4, y: 1.9, z: -0.35, w: 0.8, h: 0.8, d: 0.7, color: c2 },
  ]),
  // 电梯轿厢：10 体素高
  pod: () => makeVoxModel([
    { x: -4, y: 0, z: -4, w: 8, h: 10, d: 8, color: 0xb9c0c8 },
    { x: -4.3, y: 1.6, z: -3, w: 0.4, h: 6, d: 6, color: 0xffd6a0, emi: 1.5 },
    { x: 3.9, y: 1.6, z: -3, w: 0.4, h: 6, d: 6, color: 0xffd6a0, emi: 1.5 },
    { x: -3, y: 1.6, z: -4.3, w: 6, h: 6, d: 0.4, color: 0xffd6a0, emi: 1.5 },
    { x: -3, y: 1.6, z: 3.9, w: 6, h: 6, d: 0.4, color: 0xffd6a0, emi: 1.5 },
    { x: -3, y: 10, z: -3, w: 6, h: 1.6, d: 6, color: 0x3c434c },
    { x: -1, y: 11.6, z: -1, w: 2, h: 0.8, d: 2, color: 0xff2f26, emi: 2.0 },
  ]),
  blinker: () => makeVoxModel([
    { x: -0.5, y: -0.5, z: -0.5, w: 1, h: 1, d: 1, color: 0xffffff, emi: 3.2, night: 0.6 },
  ]),
};

function inst(geo, mat, count) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

export function createProps({ data, uni, voxMat, cfg }) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const H = cfg.HALF;
  const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();

  // ——— 飞行器 ———
  const air = [];
  for (const lane of data.droneLanes) {
    for (let i = 0; i < lane.count; i++) {
      air.push({
        axis: lane.axis, y: lane.y + (rnd() - 0.5) * 10,
        c: (rnd() * 2 - 1) * (lane.axis === 0 ? H * 0.85 : H * 0.85),
        t: rnd() * 2 * H - H,
        dir: rnd() < 0.5 ? 1 : -1,
        speed: lane.speed * (0.7 + rnd() * 0.7),
        bob: rnd() * 6.28,
      });
    }
  }
  const airMesh = inst(MODEL.aircraft(), voxMat, air.length);
  group.add(airMesh);

  // ——— 车辆 ———
  const cars = [];
  const carGeos = [0x8a3a32, 0x2f4a63, 0x6a6e75, 0x2f5a44, 0xa08a4a].map((c) => MODEL.vehicle(c));
  const carMeshes = carGeos.map(() => null);
  const carBuckets = carGeos.map(() => []);
  for (const p of data.carPaths) {
    for (let i = 0; i < p.count; i++) {
      const b = (rnd() * carGeos.length) | 0;
      carBuckets[b].push({
        axis: p.axis, c: p.c, y: p.y + 0.2, dir: p.dir,
        t: (i / p.count) * 2 * H - H + rnd() * 12,
        speed: 26 + rnd() * 26,
      });
    }
  }
  carBuckets.forEach((b, i) => {
    if (!b.length) return;
    carMeshes[i] = inst(carGeos[i], voxMat, b.length);
    group.add(carMeshes[i]);
  });

  // ——— 行人 ———
  const pedGeos = [
    MODEL.person(0x2b3038, 0xc9a884),
    MODEL.person(0x7a3b33, 0xd8bb98),
    MODEL.person(0x33455c, 0xb99a78),
    MODEL.person(0x4a4f45, 0xe0c7a6),
  ];
  const pedBuckets = pedGeos.map(() => []);
  for (const p of data.pedPaths) {
    const n = 9 + ((rnd() * 7) | 0);
    for (let i = 0; i < n; i++) {
      const b = (rnd() * pedGeos.length) | 0;
      pedBuckets[b].push({
        axis: p.axis, c: p.c + (rnd() - 0.5) * 5, y: p.y,
        t: p.a0 + rnd() * (p.a1 - p.a0),
        a0: p.a0, a1: p.a1,
        dir: rnd() < 0.5 ? 1 : -1,
        speed: 3.4 + rnd() * 2.6,
        ph: rnd() * 6.28,
      });
    }
  }
  const pedMeshes = pedBuckets.map((b, i) => {
    if (!b.length) return null;
    const m = inst(pedGeos[i], voxMat, b.length);
    group.add(m);
    return m;
  });

  // ——— 电梯轿厢 ———
  const podMesh = inst(MODEL.pod(), voxMat, Math.max(1, data.elevators.length));
  group.add(podMesh);

  // ——— 航空障碍灯 ———
  const blinkMesh = inst(MODEL.blinker(), voxMat, Math.max(1, data.blinkers.length));
  group.add(blinkMesh);

  // ——— 光井光柱 ———
  const shaftMat = createBeamMaterial(uni, 0xdfeaff, 1.35);
  shaftMat.uniforms.uIntensity.value = 0.5;
  const shafts = new THREE.Group();
  for (const s of data.lightShafts) {
    const h = s.top + 6;
    const g = new THREE.CylinderGeometry(s.r * 0.55, s.r * 1.02, h, 22, 1, true);
    const m = new THREE.Mesh(g, shaftMat);
    m.position.set(s.pos[0], h / 2 - 2, s.pos[2]);
    m.renderOrder = 12;
    shafts.add(m);
  }
  group.add(shafts);

  // ——— 顶冠探照灯 ———
  const beamMat = createBeamMaterial(uni, 0xcfe6ff, 1.9);
  beamMat.uniforms.uIntensity.value = 0.85;
  const beams = [];
  for (const s of data.searchlights) {
    const len = 1500;
    const g = new THREE.ConeGeometry(60, len, 18, 1, true);
    g.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(g, beamMat);
    m.position.set(s.pos[0], s.pos[1], s.pos[2]);
    m.renderOrder = 13;
    beams.push({ mesh: m, base: s.dir, ph: rnd() * 6.28 });
    group.add(m);
  }

  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();

  function place(mesh, list, fn) {
    if (!mesh) return;
    for (let i = 0; i < list.length; i++) {
      fn(list[i], i);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function update(time, dt) {
    // 飞行器
    place(airMesh, air, (a) => {
      a.t += a.dir * a.speed * dt;
      if (a.t > H + 60) a.t = -H - 60;
      if (a.t < -H - 60) a.t = H + 60;
      const x = a.axis === 0 ? a.t : a.c;
      const z = a.axis === 0 ? a.c : a.t;
      dummy.position.set(x, a.y + Math.sin(time * 0.6 + a.bob) * 1.6, z);
      dummy.rotation.set(0, a.axis === 0 ? (a.dir > 0 ? 0 : Math.PI) : (a.dir > 0 ? -Math.PI / 2 : Math.PI / 2), Math.sin(time * 0.9 + a.bob) * 0.07);
      dummy.scale.setScalar(1);
    });
    // 车辆
    carBuckets.forEach((b, i) => place(carMeshes[i], b, (c) => {
      c.t += c.dir * c.speed * dt;
      if (c.t > H) c.t = -H;
      if (c.t < -H) c.t = H;
      const x = c.axis === 0 ? c.t : c.c;
      const z = c.axis === 0 ? c.c : c.t;
      dummy.position.set(x, c.y, z);
      dummy.rotation.set(0, c.axis === 0 ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2), 0);
      dummy.scale.setScalar(1);
    }));
    // 行人
    pedBuckets.forEach((b, i) => place(pedMeshes[i], b, (p) => {
      p.t += p.dir * p.speed * dt;
      if (p.t > p.a1) { p.t = p.a1; p.dir = -1; }
      if (p.t < p.a0) { p.t = p.a0; p.dir = 1; }
      const x = p.axis === 0 ? p.t : p.c;
      const z = p.axis === 0 ? p.c : p.t;
      const step = Math.abs(Math.sin(time * 5.2 + p.ph)) * 0.22;
      dummy.position.set(x, p.y + step, z);
      dummy.rotation.set(0, p.axis === 0 ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? -Math.PI / 2 : Math.PI / 2), 0);
      dummy.scale.setScalar(1);
    }));
    // 轿厢：巨构里最诚实的尺度尺
    place(podMesh, data.elevators, (e) => {
      const span = e.y1 - e.y0;
      const period = (span * 2) / e.speed;
      const ph = ((time / period) + e.phase) % 1;
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const ease = tri * tri * (3 - 2 * tri);
      dummy.position.set(e.x, e.y0 + span * ease, e.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
    });
    // 障碍灯
    place(blinkMesh, data.blinkers, (b) => {
      dummy.position.set(b.pos[0], b.pos[1], b.pos[2]);
      dummy.rotation.set(0, 0, 0);
      let s = b.size;
      if (b.rate > 0) {
        const p = (Math.sin(time * b.rate * Math.PI * 2) + 1) * 0.5;
        s *= 0.25 + Math.pow(p, 3) * 1.5;
      }
      dummy.scale.setScalar(s);
    });
    // 探照灯扫动
    for (const b of beams) {
      const a = time * 0.11 + b.ph;
      tmpV.set(b.base[0] + Math.sin(a) * 0.6, b.base[1] - 0.25 + Math.sin(a * 1.7) * 0.12, b.base[2] + Math.cos(a * 0.8) * 0.6).normalize();
      tmpQ.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tmpV);
      b.mesh.quaternion.copy(tmpQ);
    }
  }

  function setNight(v) {
    shaftMat.uniforms.uIntensity.value = 0.30 + v * 0.55;
    beamMat.uniforms.uIntensity.value = 0.12 + v * 1.5;
  }

  return { group, update, setNight, counts: { air: air.length, cars: carBuckets.reduce((a, b) => a + b.length, 0), peds: pedBuckets.reduce((a, b) => a + b.length, 0) } };
}
