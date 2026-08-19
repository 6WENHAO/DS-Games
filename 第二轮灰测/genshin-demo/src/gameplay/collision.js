// Static world collision: cylinders + oriented boxes in a spatial hash, plus terrain.
import * as THREE from 'three';
import { height, normalAt } from '../world/heightfield.js';

const CELL = 16;

export class CollisionWorld {
  constructor(ctx) {
    this.ctx = ctx;
    this.grid = new Map();
    this.items = [];
  }
  _key(cx, cz) { return cx + ',' + cz; }
  _insert(item) {
    const r = item.type === 'cyl' ? item.r : Math.hypot(item.hx, item.hz);
    const x0 = Math.floor((item.x - r) / CELL), x1 = Math.floor((item.x + r) / CELL);
    const z0 = Math.floor((item.z - r) / CELL), z1 = Math.floor((item.z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = this._key(cx, cz);
      let l = this.grid.get(k); if (!l) this.grid.set(k, l = []);
      l.push(item);
    }
    this.items.push(item);
    return { item, remove: () => this.remove(item) };
  }
  remove(item) {
    item.dead = true;
    const i = this.items.indexOf(item); if (i >= 0) this.items.splice(i, 1);
  }
  addCylinder(x, z, r, y0, y1, opts = {}) {
    return this._insert({ type: 'cyl', x, z, r, y0, y1, climb: !!opts.climbable, ...opts });
  }
  addBox(cx, cy, cz, hx, hy, hz, yaw = 0, opts = {}) {
    return this._insert({ type: 'box', x: cx, y: cy, z: cz, hx, hy, hz, yaw, cos: Math.cos(-yaw), sin: Math.sin(-yaw), climb: !!opts.climbable, ...opts });
  }
  /** Register a mesh's bounding box quickly. */
  addMeshBox(mesh, opts) {
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    return this.addBox(c.x, c.y, c.z, s.x / 2, s.y / 2, s.z / 2, 0, opts);
  }

  _near(x, z, pad = 1) {
    const out = [];
    const x0 = Math.floor((x - pad) / CELL), x1 = Math.floor((x + pad) / CELL);
    const z0 = Math.floor((z - pad) / CELL), z1 = Math.floor((z + pad) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const l = this.grid.get(this._key(cx, cz));
      if (l) for (const it of l) if (!it.dead && !out.includes(it)) out.push(it);
    }
    return out;
  }

  /** Push a capsule (pos = feet) out of static geometry on the XZ plane. Returns true if moved. */
  resolve(pos, radius = 0.35, hgt = 1.8) {
    const near = this._near(pos.x, pos.z, radius + 1.5);
    let moved = false;
    const top = pos.y + hgt, bot = pos.y + 0.2;
    for (const it of near) {
      if (it.type === 'cyl') {
        if (top < it.y0 || bot > it.y1) continue;
        const dx = pos.x - it.x, dz = pos.z - it.z;
        const d = Math.hypot(dx, dz), min = it.r + radius;
        if (d < min && d > 1e-5) { const s = (min - d) / d; pos.x += dx * s; pos.z += dz * s; moved = true; }
        else if (d <= 1e-5) { pos.x += min; moved = true; }
      } else {
        if (top < it.y - it.hy || bot > it.y + it.hy) continue;
        // to local space
        const dx = pos.x - it.x, dz = pos.z - it.z;
        const lx = dx * it.cos - dz * it.sin, lz = dx * it.sin + dz * it.cos;
        const ex = it.hx + radius, ez = it.hz + radius;
        if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
          const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
          let nlx = lx, nlz = lz;
          if (px < pz) nlx = Math.sign(lx || 1) * ex; else nlz = Math.sign(lz || 1) * ez;
          const wx = nlx * it.cos + nlz * it.sin, wz = -nlx * it.sin + nlz * it.cos;
          pos.x = it.x + wx; pos.z = it.z + wz; moved = true;
        }
      }
    }
    return moved;
  }

  /** Highest solid surface at (x,z) at or below fromY (terrain included). */
  rayDown(x, z, fromY = 400) {
    let best = height(x, z), obj = null;
    for (const it of this._near(x, z, 0.4)) {
      if (it.type === 'cyl') {
        if (Math.hypot(x - it.x, z - it.z) > it.r) continue;
        if (it.y1 <= fromY + 0.05 && it.y1 > best) { best = it.y1; obj = it; }
      } else {
        const dx = x - it.x, dz = z - it.z;
        const lx = dx * it.cos - dz * it.sin, lz = dx * it.sin + dz * it.cos;
        if (Math.abs(lx) > it.hx || Math.abs(lz) > it.hz) continue;
        const t = it.y + it.hy;
        if (t <= fromY + 0.05 && t > best) { best = t; obj = it; }
      }
    }
    return { y: best, object: obj };
  }

  /** Is there a climbable wall in front? dir must be normalised. */
  wallAhead(pos, dir, radius = 0.5) {
    const probe = 0.55;
    const px = pos.x + dir.x * probe, pz = pos.z + dir.z * probe;
    const hy = height(px, pz);
    if (hy > pos.y + 0.85) {
      const n = normalAt(px, pz, 0.8);
      if (n.y < 0.62) return { y: hy, normal: new THREE.Vector3(n.x, n.y, n.z), kind: 'terrain' };
    }
    for (const it of this._near(px, pz, radius + 0.6)) {
      if (it.type === 'cyl' && it.climb) {
        const d = Math.hypot(px - it.x, pz - it.z);
        if (d < it.r + radius && it.y1 > pos.y + 1.0) {
          const nx = (pos.x - it.x), nz = (pos.z - it.z), l = Math.hypot(nx, nz) || 1;
          return { y: it.y1, normal: new THREE.Vector3(nx / l, 0, nz / l), kind: 'prop', top: it.y1 };
        }
      }
    }
    return null;
  }
  get count() { return this.items.length; }
}
