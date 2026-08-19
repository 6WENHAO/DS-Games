// Scatter: rocks, ore crystals, deadwood, mushrooms, ground pebbles — instanced + streamed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { height, slopeAt, moistureAt, surfaceAt, regionAt, WORLD } from './heightfield.js';
import { hash2 } from '../core/noise.js';
import { makeRNG, clamp, TAU } from '../core/utils.js';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m4 = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _e = new THREE.Euler();
const _s = new THREE.Vector3(); const _p = new THREE.Vector3(); const _v = new THREE.Vector3();

function cellRNG(gx, gz, salt) { return makeRNG((hash2(gx * 193939 + salt * 911, gz * 73471 + salt * 331) * 4294967296) >>> 0); }
function cellKey(gx, gz) { return gx + ',' + gz; }

class Store {
  constructor(mesh, n) {
    this.mesh = mesh; this.n = n; this.byKey = new Map(); this.keys = new Array(n).fill(null);
    this.count = 0; this.dirty = false;
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, ZERO);
    mesh.count = 0;
  }
  alloc(k) { const i = this.count; if (i >= this.n) return -1; this.byKey.set(k, i); this.keys[i] = k; this.count++; return i; }
  set(k, x, y, z, rx, ry, rz, sx, sy, sz, color) {
    const i = this.byKey.get(k); if (i == null) return;
    _p.set(x, y, z); _e.set(rx, ry, rz); _s.set(sx, sy, sz);
    this.mesh.setMatrixAt(i, _m4.compose(_p, _q.setFromEuler(_e), _s));
    if (color) this.mesh.setColorAt(i, color);
    this.dirty = true;
  }
  release(k) {
    const i = this.byKey.get(k); if (i == null) return;
    this.byKey.delete(k);
    const last = this.count - 1;
    if (i !== last) {
      const moved = this.keys[last]; this.keys[i] = moved; this.byKey.set(moved, i);
      const m = new THREE.Matrix4(); this.mesh.getMatrixAt(last, m); this.mesh.setMatrixAt(i, m);
      if (this.mesh.instanceColor) { const c = new THREE.Color(); this.mesh.getColorAt(last, c); this.mesh.setColorAt(i, c); }
    }
    this.keys[last] = null; this.mesh.setMatrixAt(last, ZERO); this.count = last; this.dirty = true;
  }
  flush() { if (this.dirty) { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; this.mesh.count = this.count; this.dirty = false; } }
}

function lumpy(geo, amt) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i); const d = hash2(i, 55); _v.multiplyScalar(1 + (d * 2 - 1) * amt); pos.setXYZ(i, _v.x, _v.y, _v.z); }
  geo.computeVertexNormals(); return geo;
}
function bend(geo, amt, ang) {
  const pos = geo.attributes.position; let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const h = (maxY - minY) || 1; const dx = Math.cos(ang), dz = Math.sin(ang);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), t = clamp((y - minY) / h, 0, 1); const off = Math.sin(t * Math.PI * 0.7) * amt; pos.setX(i, pos.getX(i) + dx * off); pos.setZ(i, pos.getZ(i) + dz * off); }
  geo.computeVertexNormals(); return geo;
}
function paint(geo, color, jitter = 0.06, seed = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count, c = new Float32Array(n * 3), base = new THREE.Color(color);
  for (let i = 0; i < n; i++) { const j = (hash2(i, seed) * 2 - 1) * jitter; c[i * 3] = clamp(base.r + j, 0, 1); c[i * 3 + 1] = clamp(base.g + j, 0, 1); c[i * 3 + 2] = clamp(base.b + j, 0, 1); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}

function rockGeo() {
  const a = lumpy(new THREE.IcosahedronGeometry(1, 0), 0.34);
  const b = lumpy(new THREE.IcosahedronGeometry(0.7, 0), 0.3); b.translate(0.5, 0.1, 0.2);
  return paint(mergeGeometries([paint(a, 0x8a877f, 0.08, 3), paint(b, 0x78756e, 0.08, 9)], false), 0xffffff, 0);
}
function crystalGeo() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU, cone = new THREE.ConeGeometry(0.16, 0.5 + (i % 2) * 0.3, 4, 1).translate(0, 0.25, 0);
    cone.rotateY(a); cone.rotateZ(0.3 + (i % 2) * 0.4);
    cone.translate(Math.cos(a) * 0.22, 0.1, Math.sin(a) * 0.22);
    parts.push(paint(cone, 0xbfefff, 0.06, i + 5));
  }
  parts.push(paint(new THREE.IcosahedronGeometry(0.14, 0), 0xdff6ff, 0.03, 21));
  return mergeGeometries(parts, false);
}
function logGeo() { return paint(bend(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 6, 3).translate(0, 1.6, 0), 0.5, 0.8), 0x6b4f35, 0.06, 7); }
function mushroomGeo() {
  const stem = paint(new THREE.CylinderGeometry(0.05, 0.08, 0.28, 6, 1).translate(0, 0.14, 0), 0xe9e2d4, 0.05, 11);
  const cap = paint(new THREE.SphereGeometry(0.2, 8, 6, 0, TAU, 0, Math.PI / 2).translate(0, 0.26, 0), 0xc8463a, 0.06, 13);
  const cap2 = paint(new THREE.SphereGeometry(0.14, 8, 5, 0, TAU, 0, Math.PI / 2).translate(0.12, 0.24, 0.08), 0xffffff, 0.02, 17);
  return mergeGeometries([stem, cap, cap2], false);
}
function pebbleGeo() { return paint(lumpy(new THREE.IcosahedronGeometry(0.12, 0), 0.4), 0x9a948a, 0.1, 23); }

export class Scatter {
  constructor(ctx) {
    this.ctx = ctx; this.scene = ctx.scene;
    this.group = new THREE.Group(); this.group.name = 'scatter'; this.scene.add(this.group);

    const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true });
    const basic = () => new THREE.MeshBasicMaterial({ vertexColors: true });

    this.meshes = {
      rock: new THREE.InstancedMesh(rockGeo(), lambert(), 400),
      crystal: new THREE.InstancedMesh(crystalGeo(), basic(), 160),
      log: new THREE.InstancedMesh(logGeo(), lambert(), 140),
      mushroom: new THREE.InstancedMesh(mushroomGeo(), lambert(), 140),
      pebble: new THREE.InstancedMesh(pebbleGeo(), lambert(), 1000),
    };
    this.stores = {};
    for (const [k, m] of Object.entries(this.meshes)) {
      m.castShadow = k === 'rock' || k === 'log'; m.receiveShadow = true; m.name = 'scatter-' + k;
      this.group.add(m); this.stores[k] = new Store(m, m.count);
    }
    this.cells = new Map(); this._pc = { x: 1e9, z: 1e9 };
    this.collisionKeys = new Set();
  }

  update(dt, playerPos) {
    const p = playerPos || this.ctx.camera.position;
    const cs = 40, radius = 120;
    const cx = Math.floor(p.x / cs), cz = Math.floor(p.z / cs);
    if (cx === this._pc.x && cz === this._pc.z) { for (const k in this.stores) this.stores[k].flush(); return; }
    this._pc.x = cx; this._pc.z = cz;
    const rings = Math.ceil(radius / cs);
    const need = new Set(); const newCells = [];
    for (let j = -rings; j <= rings; j++) for (let i = -rings; i <= rings; i++) {
      const gx = cx + i, gz = cz + j, key = cellKey(gx, gz);
      need.add(key);
      if (!this.cells.has(key)) { this.cells.set(key, { list: [] }); newCells.push([gx, gz, key, Math.max(Math.abs(i), Math.abs(j))]); }
    }
    for (let b = 0; b < newCells.length; b += 9) {
      const group = newCells.slice(b, b + 9); const pri = group[0][3];
      this.ctx.tasks.push(() => { for (const c of group) this._genCell(c[0], c[1], c[2]); }, pri);
    }
    for (const [key, rec] of this.cells) if (!need.has(key)) { for (const k of rec.list) this.stores[k.kind]?.release(k.key); this.cells.delete(key); }
    for (const k in this.stores) this.stores[k].flush();
  }

  _genCell(gx, gz, key) {
    const rec = this.cells.get(key); if (!rec) return;
    const rng = cellRNG(gx, gz, 404);
    const cs = 40;
    const emit = (kind, kkey, x, y, z, rx, ry, rz, sx, sy, sz, color) => {
      if (this.stores[kind].alloc(kkey) < 0) return;
      this.stores[kind].set(kkey, x, y, z, rx, ry, rz, sx, sy, sz, color);
      rec.list.push({ kind, key: kkey });
    };
    const n = Math.round(cs * cs * 0.05);
    for (let a = 0; a < n * 3; a++) {
      const x = (gx + rng()) * cs, z = (gz + rng()) * cs;
      if (Math.abs(x) > WORLD.landRadius || Math.abs(z) > WORLD.landRadius) continue;
      const h = height(x, z); if (h < 0.5) continue;
      const sl = slopeAt(x, z), surf = surfaceAt(x, z), m = moistureAt(x, z);
      const reg = regionAt(x, z);
      const r = rng();
      if (surf === 'rock' || sl > 0.42) {
        // boulders / ore on rocky or steep terrain
        if (r < 0.7) {
          const s = 0.4 + rng() * 1.4;
          emit('rock', 'r' + key + ':' + a, x, h, z, rng() * 0.6, rng() * TAU, rng() * 0.6, s, s * (0.6 + rng() * 0.6), s);
          if (s > 1.1) this._rockCollision(x, z, h, s);
        } else {
          const col = reg?.id === 'dragonspine' ? 0x93e0ef : reg?.id === 'stonegate' ? 0xf0b93c : 0xc88bfa;
          emit('crystal', 'c' + key + ':' + a, x, h, z, 0, rng() * TAU, 0, 0.7 + rng() * 0.9, 0.7 + rng() * 0.9, 0.7 + rng() * 0.9, new THREE.Color(col));
        }
      } else if (surf === 'grass') {
        if (r < 0.16) { const s = 0.15 + rng() * 0.4; emit('rock', 'r' + key + ':' + a, x, h, z, rng() * 0.7, rng() * TAU, rng() * 0.7, s, s, s); }
        else if (r < 0.24 && m > 0.45) { emit('mushroom', 'm' + key + ':' + a, x, h, z, 0, rng() * TAU, 0, 0.6 + rng() * 0.5, 0.6 + rng() * 0.5, 0.6 + rng() * 0.5); }
        else if (r < 0.3 && (reg?.id === 'stormbearer' || reg?.id === 'windrise' || m > 0.5)) { emit('log', 'l' + key + ':' + a, x, h, z, rng() * 0.5 - 0.25, rng() * TAU, rng() * 0.5 - 0.25, 0.7 + rng() * 0.8, 0.7 + rng() * 0.8, 0.7 + rng() * 0.8); }
        else { emit('pebble', 'p' + key + ':' + a, x, h, z, rng() * 0.8, rng() * TAU, rng() * 0.8, 0.5 + rng() * 0.7, 0.4 + rng() * 0.5, 0.5 + rng() * 0.7); }
      } else if (surf === 'dirt') {
        if (r < 0.5) { const s = 0.2 + rng() * 0.5; emit('rock', 'r' + key + ':' + a, x, h, z, rng() * 0.7, rng() * TAU, rng() * 0.7, s, s, s); }
        else emit('pebble', 'p' + key + ':' + a, x, h, z, rng() * 0.8, rng() * TAU, rng() * 0.8, 0.4 + rng() * 0.6, 0.35 + rng() * 0.5, 0.4 + rng() * 0.6);
      }
    }
    for (const k in this.stores) this.stores[k].flush();
  }

  _rockCollision(x, z, y, s) {
    const ck = 'rock_' + Math.round(x) + '_' + Math.round(z);
    if (this.collisionKeys.has(ck)) return;
    this.collisionKeys.add(ck);
    this.ctx.collision?.addCylinder(x, z, Math.max(0.4, s * 0.6), y, y + s * 0.9);
  }

  dispose() {
    for (const m of Object.values(this.meshes)) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.scene.remove(this.group);
  }
}
