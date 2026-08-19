// Authored detail layer for Mondstadt: cobbled streets, statue terrace, market stalls,
// banners, lantern strings, barrels, planters, benches, a well, a signpost, a landmark
// windmill and ground weathering. Everything is merged or instanced (~20 draw calls).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { height, normalAt } from './heightfield.js';
import { makeToonRamp, makeGlowTexture } from '../core/textures.js';
import { simplex2, fbm2 } from '../core/noise.js';
import { makeRNG, clamp, lerp, TAU } from '../core/utils.js';
import { VILLAGE_LAYOUT } from './structures.js';

// ---------------------------------------------------------------- procedural textures
const _tex = new Map();
function tex(name, w, h, paint) {
  if (_tex.has(name)) return _tex.get(name);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  _tex.set(name, t);
  return t;
}

const cobbleTex = () => tex('cobble', 256, 256, (g, w, h) => {
  g.fillStyle = '#6e6a61'; g.fillRect(0, 0, w, h);
  const rng = makeRNG(99);
  for (let i = 0; i < 420; i++) {
    const x = rng() * w, y = rng() * h, r = 5 + rng() * 9;
    const v = 92 + Math.floor(rng() * 52);
    g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
    g.beginPath(); g.ellipse(x, y, r, r * (0.7 + rng() * 0.4), rng() * 3, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(40,38,34,.55)'; g.lineWidth = 1.4; g.stroke();
  }
  for (let i = 0; i < 2600; i++) {
    const v = 70 + Math.floor(rng() * 90);
    g.fillStyle = `rgba(${v},${v},${v},.18)`;
    g.fillRect(rng() * w, rng() * h, 2, 2);
  }
});

const woodTex = () => tex('twood', 128, 128, (g, w, h) => {
  g.fillStyle = '#8a6338'; g.fillRect(0, 0, w, h);
  const rng = makeRNG(31);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(${60 + rng() * 50 | 0},${38 + rng() * 30 | 0},${18 + rng() * 20 | 0},.5)`;
    g.lineWidth = 0.6 + rng() * 1.8;
    g.beginPath();
    const y = rng() * h; g.moveTo(0, y);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.09 + i) * 2.2);
    g.stroke();
  }
});

const awningTex = () => tex('awning', 128, 128, (g, w, h) => {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#e9e3d2' : '#4d7ea8';
    g.fillRect((i / 8) * w, 0, w / 8, h);
  }
  g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, h * 0.82, w, h * 0.18);
});

const bannerTex = () => tex('banner', 128, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#2e5f8e'); grd.addColorStop(1, '#1d3f63');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#e8d5a8'; g.lineWidth = 5;
  g.strokeRect(9, 9, w - 18, h - 18);
  // stylised anemo emblem: a wind curl
  g.strokeStyle = '#f2e6c2'; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath();
  g.arc(w / 2, h * 0.42, 26, Math.PI * 0.15, Math.PI * 1.55);
  g.stroke();
  g.beginPath();
  g.moveTo(w / 2 + 24, h * 0.42 + 6);
  g.quadraticCurveTo(w / 2 + 44, h * 0.5, w / 2 + 16, h * 0.58);
  g.stroke();
  g.fillStyle = '#f2e6c2';
  g.beginPath(); g.arc(w / 2, h * 0.42, 7, 0, 6.2832); g.fill();
});

const decalTex = () => tex('decal', 128, 128, (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2);
  grd.addColorStop(0, 'rgb(96,92,84)');
  grd.addColorStop(0.55, 'rgb(168,164,152)');
  grd.addColorStop(1, 'rgb(255,255,255)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

// ---------------------------------------------------------------- helpers
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
function at(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = geo.clone();
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
}
function merged(list) { return mergeGeometries(list.filter(Boolean), false); }

/** Terrain-hugging surface strip/annulus for streets. */
function annulusRoad(cx, cz, r0, r1, seg = 72, radial = 3, lift = 0.07) {
  const pos = [], uv = [], idx = [];
  const n = radial + 1;
  for (let j = 0; j < n; j++) {
    const rr = lerp(r0, r1, j / radial);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      pos.push(x - cx, height(x, z) + lift, z - cz);
      uv.push(a * rr * 0.12, j / radial * 1.2);
    }
  }
  for (let j = 0; j < radial; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function streetStrip(cx, cz, ang, from, to, halfW = 3.4, steps = 26, lift = 0.07) {
  const pos = [], uv = [], idx = [];
  const dx = Math.cos(ang), dz = Math.sin(ang);
  const px = -dz, pz = dx;
  for (let i = 0; i <= steps; i++) {
    const r = lerp(from, to, i / steps);
    const w = halfW * (1 - 0.25 * (i / steps));
    for (let s = -1; s <= 1; s += 2) {
      const x = cx + dx * r + px * w * s, z = cz + dz * r + pz * w * s;
      pos.push(x - cx, height(x, z) + lift, z - cz);
      uv.push(r * 0.12, (s + 1) * 0.5);
    }
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- the detail layer
export class TownDetail {
  constructor(ctx) {
    this.ctx = ctx;
    this.rng = makeRNG(0x70776E);
    this.group = new THREE.Group();
    this.group.name = 'townDetail';
    ctx.scene.add(this.group);
    this.ramp = makeToonRamp([0, 0.48, 0.72, 1.0], [0.46, 0.7, 0.9, 1.0]);

    this.mat = {
      stone: new THREE.MeshStandardMaterial({ map: cobbleTex(), roughness: 0.95, color: 0xb9b4a8 }),
      wood: new THREE.MeshToonMaterial({ map: woodTex(), gradientMap: this.ramp }),
      darkWood: new THREE.MeshToonMaterial({ color: 0x5a3f26, gradientMap: this.ramp }),
      cloth: new THREE.MeshToonMaterial({ map: awningTex(), gradientMap: this.ramp, side: THREE.DoubleSide }),
      banner: new THREE.MeshToonMaterial({ map: bannerTex(), gradientMap: this.ramp, side: THREE.DoubleSide }),
      metal: new THREE.MeshStandardMaterial({ color: 0x6d6a63, roughness: 0.5, metalness: 0.55 }),
      plaster: new THREE.MeshToonMaterial({ color: 0xefe6d2, gradientMap: this.ramp }),
      roof: new THREE.MeshToonMaterial({ color: 0x4a6b8a, gradientMap: this.ramp }),
      leaf: new THREE.MeshToonMaterial({ color: 0x5f9b46, gradientMap: this.ramp }),
      petal: new THREE.MeshToonMaterial({ color: 0xe8637a, gradientMap: this.ramp }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffca62, emissiveIntensity: 1.0, roughness: 0.4 }),
      decal: new THREE.MeshBasicMaterial({ map: decalTex(), transparent: true, opacity: 0.55, blending: THREE.MultiplyBlending, depthWrite: false, toneMapped: false }),
    };
    this.lampMats = [this.mat.lamp];
    this.spinners = [];
    this.sway = [];

    const T = ctx.tasks;
    T.push(() => this._streets(), 1);
    T.push(() => this._terrace(), 1);
    T.push(() => this._stalls(), 2);
    T.push(() => this._banners(), 2);
    T.push(() => this._props(), 2);
    T.push(() => this._lanternStrings(), 3);
    T.push(() => this._landmarkWindmill(), 2);
    T.push(() => this._weathering(), 3);
  }

  _add(mesh, shadow = true) {
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  // ---- cobbled street network ----
  _streets() {
    const P = VILLAGE_LAYOUT.plaza;
    const parts = [annulusRoad(P.x, P.z, 27, 37, 76, 3)];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.26;
      parts.push(streetStrip(P.x, P.z, a, 34, 108, 3.6, 30));
    }
    // approach road from the gate
    parts.push(streetStrip(P.x, P.z, -Math.PI / 2, 34, 116, 4.6, 34));
    const g = merged(parts);
    const m = this._add(new THREE.Mesh(g, this.mat.stone), false);
    m.position.set(P.x, 0, P.z);
    m.renderOrder = 1;
  }

  // ---- raised terrace + steps under the Statue of the Seven ----
  _terrace() {
    const s = VILLAGE_LAYOUT.statue;
    const y = height(s.x, s.z);
    const parts = [];
    parts.push(at(C(9.2, 9.6, 0.55, 8), 0, 0.27, 0));
    parts.push(at(C(7.4, 7.6, 0.5, 8), 0, 0.78, 0));
    // steps on the plaza side
    for (let i = 0; i < 3; i++) {
      parts.push(at(B(6.4 - i * 0.7, 0.28, 1.1), 0, 0.14 + i * 0.28, -9.4 + i * 1.0));
    }
    // corner pillars with lanterns
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      parts.push(at(C(0.26, 0.32, 2.3, 6), Math.cos(a) * 7.4, 1.9, Math.sin(a) * 7.4));
      parts.push(at(B(0.62, 0.18, 0.62), Math.cos(a) * 7.4, 3.14, Math.sin(a) * 7.4));
    }
    const m = this._add(new THREE.Mesh(merged(parts), this.mat.stone));
    m.position.set(s.x, y, s.z);
    // lantern glows on the pillars
    const lampGeo = new THREE.SphereGeometry(0.17, 8, 6);
    const lamps = new THREE.InstancedMesh(lampGeo, this.mat.lamp.clone(), 4);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      lamps.setMatrixAt(i, new THREE.Matrix4().setPosition(s.x + Math.cos(a) * 7.4, y + 3.0, s.z + Math.sin(a) * 7.4));
    }
    lamps.instanceMatrix.needsUpdate = true;
    this.group.add(lamps);
    this.lampMats.push(lamps.material);
    this.ctx.collision?.addCylinder(s.x, s.z, 9.6, y, y + 0.8, {});
  }

  // ---- market stalls (one geometry, instanced) ----
  _stalls() {
    const wood = [], cloth = [];
    // counter
    wood.push(at(B(3.0, 0.16, 1.5), 0, 1.0, 0));
    wood.push(at(B(0.14, 1.0, 0.14), -1.4, 0.5, -0.65));
    wood.push(at(B(0.14, 1.0, 0.14), 1.4, 0.5, -0.65));
    wood.push(at(B(0.14, 1.0, 0.14), -1.4, 0.5, 0.65));
    wood.push(at(B(0.14, 1.0, 0.14), 1.4, 0.5, 0.65));
    wood.push(at(B(2.8, 0.1, 0.5), 0, 0.55, 0));
    // awning frame
    wood.push(at(B(0.12, 2.4, 0.12), -1.5, 1.2, -0.7));
    wood.push(at(B(0.12, 2.4, 0.12), 1.5, 1.2, -0.7));
    wood.push(at(B(3.3, 0.12, 0.12), 0, 2.4, -0.7));
    // crates on the counter
    wood.push(at(B(0.5, 0.4, 0.42), -0.9, 1.28, 0.05));
    wood.push(at(B(0.42, 0.34, 0.38), 0.75, 1.25, -0.1));
    // awning cloth: a slightly curved sheet
    const sheet = new THREE.PlaneGeometry(3.4, 1.9, 6, 2);
    const p = sheet.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, -Math.cos(x * 0.5) * 0.18);
      p.setY(i, y * 0.55);
    }
    sheet.computeVertexNormals();
    cloth.push(at(sheet, 0, 2.16, 0.15, -1.05, 0, 0));

    const woodGeo = merged(wood), clothGeo = merged(cloth);
    const spots = [
      { r: 32, a: 0.9 }, { r: 32, a: 2.0 }, { r: 32, a: 3.3 }, { r: 32, a: 4.5 }, { r: 30, a: 5.7 },
    ];
    const wm = new THREE.InstancedMesh(woodGeo, this.mat.wood, spots.length);
    const cm = new THREE.InstancedMesh(clothGeo, this.mat.cloth, spots.length);
    wm.castShadow = cm.castShadow = true; wm.receiveShadow = true;
    spots.forEach((s, i) => {
      const x = Math.cos(s.a) * s.r, z = Math.sin(s.a) * s.r;
      const y = height(x, z);
      const m4 = new THREE.Matrix4().makeRotationY(-s.a + Math.PI / 2);
      m4.setPosition(x, y, z);
      wm.setMatrixAt(i, m4); cm.setMatrixAt(i, m4);
      this.ctx.collision?.addBox(x, y + 1, z, 1.7, 1.0, 0.9, -s.a + Math.PI / 2, {});
    });
    wm.instanceMatrix.needsUpdate = true; cm.instanceMatrix.needsUpdate = true;
    this.group.add(wm, cm);
  }

  // ---- banner poles around the plaza ----
  _banners() {
    const N = 8;
    const poleGeo = merged([at(C(0.09, 0.12, 5.4, 6), 0, 2.7, 0), at(B(1.5, 0.08, 0.08), 0.7, 5.2, 0)]);
    const flagGeo = new THREE.PlaneGeometry(1.25, 2.4, 4, 4);
    flagGeo.translate(0.72, -1.35, 0);
    const pm = new THREE.InstancedMesh(poleGeo, this.mat.darkWood, N);
    const fm = new THREE.InstancedMesh(flagGeo, this.mat.banner, N);
    pm.castShadow = fm.castShadow = true;
    this.bannerMesh = fm; this.bannerBase = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + 0.4;
      const x = Math.cos(a) * 24.5, z = Math.sin(a) * 24.5, y = height(x, z);
      const m4 = new THREE.Matrix4().makeRotationY(-a);
      m4.setPosition(x, y, z);
      pm.setMatrixAt(i, m4);
      const f4 = new THREE.Matrix4().makeRotationY(-a);
      f4.setPosition(x, y + 5.2, z);
      fm.setMatrixAt(i, f4);
      this.bannerBase.push({ x, y: y + 5.2, z, a });
      this.ctx.collision?.addCylinder(x, z, 0.22, y, y + 5, {});
    }
    pm.instanceMatrix.needsUpdate = true; fm.instanceMatrix.needsUpdate = true;
    this.group.add(pm, fm);
  }

  // ---- barrels, crates, planters, benches, well, signpost ----
  _props() {
    const rng = this.rng;
    // barrels
    const barrelGeo = merged([
      at(C(0.34, 0.30, 0.86, 10), 0, 0.43, 0),
      at(new THREE.TorusGeometry(0.345, 0.03, 4, 12), 0, 0.62, 0, Math.PI / 2),
      at(new THREE.TorusGeometry(0.345, 0.03, 4, 12), 0, 0.24, 0, Math.PI / 2),
    ]);
    const crateGeo = merged([at(B(0.62, 0.6, 0.62), 0, 0.3, 0), at(B(0.66, 0.06, 0.1), 0, 0.34, 0)]);
    const N1 = 26, N2 = 18;
    const bm = new THREE.InstancedMesh(barrelGeo, this.mat.wood, N1);
    const cm = new THREE.InstancedMesh(crateGeo, this.mat.darkWood, N2);
    bm.castShadow = cm.castShadow = true; bm.receiveShadow = cm.receiveShadow = true;
    const place = (mesh, n, minR, maxR) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, r = lerp(minR, maxR, rng());
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const m4 = new THREE.Matrix4().makeRotationY(rng() * TAU);
        m4.setPosition(x, height(x, z), z);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(bm, N1, 28, 46);
    place(cm, N2, 29, 48);
    this.group.add(bm, cm);

    // planters with flowers
    const planterGeo = merged([
      at(B(1.5, 0.5, 0.7), 0, 0.25, 0),
      at(B(1.6, 0.1, 0.8), 0, 0.52, 0),
    ]);
    const soilGeo = at(B(1.3, 0.12, 0.5), 0, 0.56, 0);
    const NP = 14;
    const pm = new THREE.InstancedMesh(planterGeo, this.mat.wood, NP);
    const fm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0), this.mat.petal, NP * 4);
    const lm = new THREE.InstancedMesh(soilGeo, this.mat.leaf, NP);
    pm.castShadow = true; pm.receiveShadow = true;
    let k = 0;
    for (let i = 0; i < NP; i++) {
      const a = (i / NP) * TAU + 0.15;
      const r = 27.5 + (i % 2) * 1.2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = height(x, z);
      const m4 = new THREE.Matrix4().makeRotationY(-a);
      m4.setPosition(x, y, z);
      pm.setMatrixAt(i, m4); lm.setMatrixAt(i, m4);
      for (let f = 0; f < 4; f++) {
        const fx = x + Math.cos(-a) * (f - 1.5) * 0.32, fz = z + Math.sin(-a) * (f - 1.5) * 0.32;
        const f4 = new THREE.Matrix4().setPosition(fx, y + 0.68, fz);
        fm.setMatrixAt(k++, f4);
      }
      this.ctx.collision?.addBox(x, y + 0.3, z, 0.8, 0.35, 0.4, -a, {});
    }
    pm.instanceMatrix.needsUpdate = true; fm.instanceMatrix.needsUpdate = true; lm.instanceMatrix.needsUpdate = true;
    this.group.add(pm, lm, fm);

    // benches
    const benchGeo = merged([
      at(B(2.0, 0.12, 0.5), 0, 0.46, 0),
      at(B(2.0, 0.42, 0.1), 0, 0.72, -0.22),
      at(B(0.12, 0.46, 0.46), -0.85, 0.23, 0),
      at(B(0.12, 0.46, 0.46), 0.85, 0.23, 0),
    ]);
    const NB = 6;
    const bem = new THREE.InstancedMesh(benchGeo, this.mat.wood, NB);
    bem.castShadow = bem.receiveShadow = true;
    for (let i = 0; i < NB; i++) {
      const a = (i / NB) * TAU + 0.8;
      const x = Math.cos(a) * 21, z = Math.sin(a) * 21, y = height(x, z);
      const m4 = new THREE.Matrix4().makeRotationY(-a + Math.PI / 2);
      m4.setPosition(x, y, z);
      bem.setMatrixAt(i, m4);
    }
    bem.instanceMatrix.needsUpdate = true;
    this.group.add(bem);

    // well
    const wx = 15, wz = -13, wy = height(wx, wz);
    const wellParts = [
      at(C(1.25, 1.35, 1.1, 14), 0, 0.55, 0),
      at(new THREE.TorusGeometry(1.28, 0.09, 5, 16), 0, 1.12, 0, Math.PI / 2),
      at(B(0.16, 2.4, 0.16), -1.1, 1.9, 0),
      at(B(0.16, 2.4, 0.16), 1.1, 1.9, 0),
      at(B(2.6, 0.16, 0.7), 0, 3.05, 0),
      at(C(0.12, 0.12, 2.0, 6), 0, 2.7, 0, 0, 0, Math.PI / 2),
    ];
    const well = this._add(new THREE.Mesh(merged(wellParts), this.mat.stone));
    well.position.set(wx, wy, wz);
    const roof = this._add(new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 4), this.mat.roof));
    roof.position.set(wx, wy + 3.5, wz); roof.rotation.y = Math.PI / 4;
    this.ctx.collision?.addCylinder(wx, wz, 1.4, wy, wy + 1.2, {});

    // signpost
    const sx = -8, sz = 30, sy = height(sx, sz);
    const signParts = [at(C(0.13, 0.16, 3.0, 6), 0, 1.5, 0)];
    const dirs = [{ a: 0.5, t: 1 }, { a: 2.4, t: -1 }, { a: 4.1, t: 1 }];
    dirs.forEach((d, i) => {
      const arm = at(B(1.7, 0.34, 0.09), d.t * 0.85, 2.55 - i * 0.45, 0, 0, 0, 0);
      const rot = new THREE.Matrix4().makeRotationY(d.a);
      arm.applyMatrix4(rot);
      signParts.push(arm);
    });
    const sign = this._add(new THREE.Mesh(merged(signParts), this.mat.darkWood));
    sign.position.set(sx, sy, sz);
    this.ctx.collision?.addCylinder(sx, sz, 0.3, sy, sy + 3, {});
  }

  // ---- lantern strings between banner poles ----
  _lanternStrings() {
    if (!this.bannerBase?.length) return;
    const pts = [], lampPos = [];
    const N = this.bannerBase.length;
    for (let i = 0; i < N; i++) {
      const a = this.bannerBase[i], b = this.bannerBase[(i + 1) % N];
      const segs = 10;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs;
        const p0 = this._catenary(a, b, t0), p1 = this._catenary(a, b, t1);
        pts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        if (s % 3 === 1) lampPos.push(p0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x3a2f22 }));
    line.frustumCulled = false;
    this.group.add(line);

    const lampGeo = new THREE.SphereGeometry(0.14, 7, 5);
    const lm = new THREE.InstancedMesh(lampGeo, this.mat.lamp.clone(), lampPos.length);
    lampPos.forEach((p, i) => lm.setMatrixAt(i, new THREE.Matrix4().setPosition(p.x, p.y - 0.16, p.z)));
    lm.instanceMatrix.needsUpdate = true;
    this.group.add(lm);
    this.lampMats.push(lm.material);
  }

  _catenary(a, b, t) {
    const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
    const y = lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * 1.1;
    return { x, y, z };
  }

  // ---- a prominent windmill right by the plaza (Mondstadt's silhouette) ----
  _landmarkWindmill() {
    const x = 40, z = -24, y = height(x, z);
    const towerParts = [
      at(C(2.2, 3.1, 15, 12), 0, 7.5, 0),
      at(C(2.5, 2.2, 1.0, 12), 0, 15.4, 0),
      at(B(1.2, 2.2, 0.2), 0, 4.2, 3.0),
    ];
    const tower = this._add(new THREE.Mesh(merged(towerParts), this.mat.plaster));
    tower.position.set(x, y, z);
    const cap = this._add(new THREE.Mesh(new THREE.ConeGeometry(2.9, 3.4, 12), this.mat.roof));
    cap.position.set(x, y + 17.4, z);

    // blades
    const hub = new THREE.Group();
    hub.position.set(x, y + 15.6, z + 2.6);
    const bladeParts = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      const spar = at(B(0.22, 8.4, 0.22), 0, 4.2, 0);
      const sail = at(B(1.5, 6.0, 0.08), 0.85, 4.4, 0.16);
      const rot = new THREE.Matrix4().makeRotationZ(a);
      spar.applyMatrix4(rot); sail.applyMatrix4(rot);
      bladeParts.push(spar, sail);
    }
    const blades = new THREE.Mesh(merged(bladeParts), this.mat.darkWood);
    blades.castShadow = true;
    hub.add(blades);
    this.group.add(hub);
    this.spinners.push({ obj: hub, speed: 0.42 });
    this.ctx.collision?.addCylinder(x, z, 3.0, y, y + 16, {});
  }

  // ---- ground weathering: dirt haloes where structures meet the ground ----
  _weathering() {
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.rotateX(-Math.PI / 2);
    const spots = [];
    for (const b of VILLAGE_LAYOUT.buildings) spots.push({ x: b.x, z: b.z, s: Math.max(b.w, b.d) * 1.75 });
    spots.push({ x: 15, z: -13, s: 5.5 });
    spots.push({ x: 40, z: -24, s: 11 });
    spots.push({ x: VILLAGE_LAYOUT.statue.x, z: VILLAGE_LAYOUT.statue.z, s: 22 });
    const im = new THREE.InstancedMesh(quad, this.mat.decal, spots.length);
    spots.forEach((s, i) => {
      const m4 = new THREE.Matrix4().makeScale(s.s, 1, s.s);
      m4.setPosition(s.x, height(s.x, s.z) + 0.085, s.z);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    im.renderOrder = 2;
    this.group.add(im);
  }

  update(dt) {
    const t = this.ctx.time.elapsed;
    for (const s of this.spinners) s.obj.rotation.z += dt * s.speed;
    // banners breathe with the wind
    if (this.bannerMesh && this.bannerBase) {
      const w = this.ctx.wind?.strength ?? 0.4;
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < this.bannerBase.length; i++) {
        const b = this.bannerBase[i];
        const s = Math.sin(t * 1.7 + i * 0.9) * 0.10 * (0.5 + w);
        m4.makeRotationY(-b.a + s * 0.6);
        m4.setPosition(b.x, b.y + Math.sin(t * 2.3 + i) * 0.02, b.z);
        this.bannerMesh.setMatrixAt(i, m4);
      }
      this.bannerMesh.instanceMatrix.needsUpdate = true;
    }
    // lanterns only glow after dusk
    const day = this.ctx.sky?.dayFactor ?? 1;
    const glow = clamp(1.25 - day * 1.6, 0, 1.25);
    for (const m of this.lampMats) m.emissiveIntensity = glow;
  }
}
