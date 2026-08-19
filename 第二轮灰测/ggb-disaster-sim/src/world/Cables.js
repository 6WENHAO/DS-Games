import * as THREE from 'three';
import { WORLD, COLORS, PHYSICS } from '../config.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * CableSystem — the main suspension cables and the vertical suspender ropes.
 *
 * WHY VERLET AND NOT RAPIER
 * -------------------------
 * A main cable is 132 nodes of an almost inextensible constraint chain. Handing
 * that to a rigid-body solver means 132 bodies and 131 joints per cable, and
 * stiff joint chains are exactly what makes an impulse solver ring and explode.
 * Position-based Verlet integration with N constraint-relaxation passes is the
 * standard answer: unconditionally stable, trivially cheap, and it produces the
 * one thing this scene has to sell — the elastic RECOIL when a cable parts.
 *
 * Cables are inert while intact: every node is pinned, so simulate() early-outs
 * and the cost is zero. Breaking a cable unpins a span and stores the release
 * energy as an initial velocity, which is what snaps the free end away.
 *
 * Rendering: one InstancedMesh of open cylinders for every cable segment in the
 * scene, and one for all suspenders — 2 draw calls for ~430 rope segments.
 */
export class CableSystem {
  constructor(scene) {
    this.scene = scene;
    this.ropes = [];
    this.hangers = [];
    this._accum = 0;
    this._step = 1 / 120;
    this.wind = new THREE.Vector3(0, 0, 0);

    const segGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    this.cableMat = new THREE.MeshStandardMaterial({
      color: COLORS.cable, roughness: 0.62, metalness: 0.72,
    });
    this.hangerMat = new THREE.MeshStandardMaterial({
      color: COLORS.cable, roughness: 0.7, metalness: 0.6,
    });

    this._segGeo = segGeo;
    this.segMesh = null;      // built in build()
    this.hangerMesh = null;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v0 = new THREE.Vector3();
    this._v1 = new THREE.Vector3();
    this._mid = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  /**
   * Add a rope from an array of world points. All nodes start pinned (intact).
   * @returns {number} rope index
   */
  addRope(points, radius) {
    const n = points.length;
    const pos = new Float32Array(n * 3);
    const prev = new Float32Array(n * 3);
    const home = new Float32Array(n * 3);
    const pinned = new Uint8Array(n).fill(1);
    const rest = new Float32Array(n - 1);

    for (let i = 0; i < n; i++) {
      pos[i * 3] = prev[i * 3] = home[i * 3] = points[i].x;
      pos[i * 3 + 1] = prev[i * 3 + 1] = home[i * 3 + 1] = points[i].y;
      pos[i * 3 + 2] = prev[i * 3 + 2] = home[i * 3 + 2] = points[i].z;
    }
    for (let i = 0; i < n - 1; i++) rest[i] = points[i].distanceTo(points[i + 1]);

    this.ropes.push({ n, pos, prev, home, pinned, rest, radius, active: false, broken: [] });
    return this.ropes.length - 1;
  }

  /** Add a suspender: top follows a cable node, bottom is a fixed deck point. */
  addHanger(ropeIndex, nodeIndex, bottom) {
    this.hangers.push({
      ropeIndex, nodeIndex,
      bottom: bottom.clone(),
      alive: true,
    });
    return this.hangers.length - 1;
  }

  /** Allocate the instanced meshes. Call once after all ropes/hangers exist. */
  build() {
    let segCount = 0;
    for (const r of this.ropes) segCount += r.n - 1;

    this.segMesh = new THREE.InstancedMesh(this._segGeo, this.cableMat, segCount);
    this.segMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.segMesh.castShadow = true;
    this.segMesh.frustumCulled = false;
    this.scene.add(this.segMesh);

    this.hangerMesh = new THREE.InstancedMesh(this._segGeo, this.hangerMat, this.hangers.length);
    this.hangerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.hangerMesh.castShadow = false;      // 12 cm ropes cast no meaningful shadow
    this.hangerMesh.frustumCulled = false;
    this.scene.add(this.hangerMesh);

    this._segOffsets = [];
    let o = 0;
    for (const r of this.ropes) { this._segOffsets.push(o); o += r.n - 1; }

    this.refreshAll();
  }

  /**
   * Sever a cable at a node, releasing a span of length `span` on each side.
   * `energy` becomes the initial recoil velocity of the freed nodes — this is
   * the whip.
   */
  breakAt(ropeIndex, nodeIndex, span = 26, energy = 34) {
    const r = this.ropes[ropeIndex];
    if (!r) return;
    const a = Math.max(1, nodeIndex - span);
    const b = Math.min(r.n - 2, nodeIndex + span);

    for (let i = a; i <= b; i++) {
      if (!r.pinned[i]) continue;
      r.pinned[i] = 0;
      // Recoil: away from the break, scaled by how close to it this node is,
      // plus a small lateral kick so the whip is not planar.
      const t = 1 - Math.abs(i - nodeIndex) / (span + 1);
      const away = i < nodeIndex ? -1 : 1;
      const k = energy * t * t;
      r.prev[i * 3] -= away * k * this._step * 1.2;
      r.prev[i * 3 + 1] += k * this._step * 0.55;
      r.prev[i * 3 + 2] -= (Math.sin(i * 2.399) * 0.6) * k * this._step;
    }
    // Fully detach the chain at the break so the two halves are independent.
    r.broken.push(nodeIndex);
    r.active = true;

    // Any suspender hanging off the freed span goes with it.
    for (const h of this.hangers) {
      if (h.ropeIndex === ropeIndex && h.nodeIndex >= a && h.nodeIndex <= b) h.alive = false;
    }
  }

  /** Drop the suspenders over a world-X range (used when the deck lets go). */
  cutHangersInRange(x0, x1) {
    for (const h of this.hangers) {
      if (h.bottom.x >= x0 && h.bottom.x <= x1) h.alive = false;
    }
  }

  /** Rigid vertical offset applied to still-pinned nodes (earthquake sway). */
  offsetPinned(fn) {
    for (let ri = 0; ri < this.ropes.length; ri++) {
      const r = this.ropes[ri];
      for (let i = 0; i < r.n; i++) {
        if (!r.pinned[i]) continue;
        const hx = r.home[i * 3], hy = r.home[i * 3 + 1], hz = r.home[i * 3 + 2];
        const d = fn(hx, hy, hz);
        r.pos[i * 3] = hx + d.x;
        r.pos[i * 3 + 1] = hy + d.y;
        r.pos[i * 3 + 2] = hz + d.z;
      }
    }
    this._dirty = true;
  }

  _simulateRope(r, dt) {
    const g = PHYSICS.gravity * dt * dt;
    const damp = 0.994;
    const { pos, prev, pinned, n } = r;

    // --- integrate ---
    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue;
      const o = i * 3;
      for (let c = 0; c < 3; c++) {
        const x = pos[o + c];
        let v = (x - prev[o + c]) * damp;
        if (c === 1) v += g;
        else v += (c === 0 ? this.wind.x : this.wind.z) * dt * dt;
        prev[o + c] = x;
        pos[o + c] = x + v;
      }
    }

    // --- relax distance constraints (Gauss-Seidel, both directions) ---
    const iters = 8;
    for (let k = 0; k < iters; k++) {
      const forward = (k & 1) === 0;
      for (let s = 0; s < n - 1; s++) {
        const i = forward ? s : (n - 2 - s);
        if (r.broken.includes(i)) continue;      // severed link transmits nothing
        const a = i * 3, b = (i + 1) * 3;
        const dx = pos[b] - pos[a];
        const dy = pos[b + 1] - pos[a + 1];
        const dz = pos[b + 2] - pos[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - r.rest[i]) / d;
        const pa = pinned[i], pb = pinned[i + 1];
        if (pa && pb) continue;
        // Weight the correction by which ends are free.
        const wa = pa ? 0 : (pb ? 1 : 0.5);
        const wb = pb ? 0 : (pa ? 1 : 0.5);
        pos[a] += dx * diff * wa; pos[a + 1] += dy * diff * wa; pos[a + 2] += dz * diff * wa;
        pos[b] -= dx * diff * wb; pos[b + 1] -= dy * diff * wb; pos[b + 2] -= dz * diff * wb;
      }
    }

    // --- water plane: cables that reach the sea stop there and go slack ---
    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue;
      const o = i * 3;
      if (pos[o + 1] < WORLD.seaLevel) {
        pos[o + 1] = WORLD.seaLevel;
        prev[o + 1] = WORLD.seaLevel;
        prev[o] += (pos[o] - prev[o]) * 0.55;      // drag
        prev[o + 2] += (pos[o + 2] - prev[o + 2]) * 0.55;
      }
    }
  }

  update(dt) {
    let anyActive = false;
    for (const r of this.ropes) if (r.active) { anyActive = true; break; }
    if (!anyActive && !this._dirty) return;

    if (anyActive) {
      this._accum += dt;
      let steps = 0;
      while (this._accum >= this._step && steps < 4) {
        for (const r of this.ropes) if (r.active) this._simulateRope(r, this._step);
        this._accum -= this._step;
        steps++;
      }
      if (this._accum > this._step * 8) this._accum = 0;
    }

    this.refreshAll();
    this._dirty = false;
  }

  /** Push every rope segment and suspender into the instance matrices. */
  refreshAll() {
    if (!this.segMesh) return;

    for (let ri = 0; ri < this.ropes.length; ri++) {
      const r = this.ropes[ri];
      const base = this._segOffsets[ri];
      for (let i = 0; i < r.n - 1; i++) {
        const a = i * 3, b = (i + 1) * 3;
        this._v0.set(r.pos[a], r.pos[a + 1], r.pos[a + 2]);
        this._v1.set(r.pos[b], r.pos[b + 1], r.pos[b + 2]);
        this._writeSegment(this.segMesh, base + i, this._v0, this._v1, r.radius);
      }
    }
    this.segMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.hangers.length; i++) {
      const h = this.hangers[i];
      if (!h.alive) {
        this.hangerMesh.setMatrixAt(i, this._hidden);
        continue;
      }
      const r = this.ropes[h.ropeIndex];
      const o = h.nodeIndex * 3;
      this._v0.set(r.pos[o], r.pos[o + 1], r.pos[o + 2]);
      this._writeSegment(this.hangerMesh, i, this._v0, h.bottom, WORLD.hangerRadius);
    }
    this.hangerMesh.instanceMatrix.needsUpdate = true;
  }

  _writeSegment(mesh, index, a, b, radius) {
    this._dir.subVectors(b, a);
    const len = this._dir.length();
    if (len < 1e-5) { mesh.setMatrixAt(index, this._hidden); return; }
    this._mid.addVectors(a, b).multiplyScalar(0.5);
    this._dir.divideScalar(len);
    this._q.setFromUnitVectors(UP, this._dir);
    this._scale.set(radius, len, radius);
    this._m.compose(this._mid, this._q, this._scale);
    mesh.setMatrixAt(index, this._m);
  }

  reset() {
    for (const r of this.ropes) {
      r.pos.set(r.home);
      r.prev.set(r.home);
      r.pinned.fill(1);
      r.broken.length = 0;
      r.active = false;
    }
    for (const h of this.hangers) h.alive = true;
    this._accum = 0;
    this.refreshAll();
  }

  dispose() {
    this._segGeo.dispose();
    this.cableMat.dispose();
    this.hangerMat.dispose();
    if (this.segMesh) this.scene.remove(this.segMesh);
    if (this.hangerMesh) this.scene.remove(this.hangerMesh);
  }
}
