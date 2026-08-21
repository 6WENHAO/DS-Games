/**
 * Geometry accumulator.
 *
 * Merges many small non-indexed pieces into one buffer with the extra attributes
 * the toon material needs (per-vertex colour, wind-sway weight, sway origin,
 * phase). Trees, shrubs, stones, fences and the signpost all end up in a single
 * draw call this way.
 */
import * as THREE from 'three';

export class MeshAccumulator {
  constructor({ sway = true, vertexColors = true } = {}) {
    this.useSway = sway;
    this.useColor = vertexColors;
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.uv = [];
    this.origin = [];
    this.sway = [];
    this.phase = [];
    this.vertexCount = 0;
  }

  /**
   * @param {THREE.BufferGeometry} geometry non-indexed, with normals
   * @param {THREE.Matrix4} matrix world transform
   * @param {object} opts
   * @param {THREE.Color|((normal:THREE.Vector3, position:THREE.Vector3, faceIndex:number)=>THREE.Color)} opts.color
   * @param {number|((position:THREE.Vector3)=>number)} opts.sway
   * @param {THREE.Vector3} opts.origin sway pivot in world space
   * @param {number} opts.phase stop-motion phase for this element
   */
  add(geometry, matrix, { color, sway = 0, origin = null, phase = 0 } = {}) {
    let geo = geometry;
    if (geo.index) geo = geo.toNonIndexed();
    const posAttr = geo.getAttribute('position');
    const uvAttr = geo.getAttribute('uv');

    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const p = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const fn = new THREE.Vector3();
    const org = origin || new THREE.Vector3(0, 0, 0);

    const triCount = posAttr.count / 3;
    for (let t = 0; t < triCount; t += 1) {
      a.fromBufferAttribute(posAttr, t * 3).applyMatrix4(matrix);
      b.fromBufferAttribute(posAttr, t * 3 + 1).applyMatrix4(matrix);
      c.fromBufferAttribute(posAttr, t * 3 + 2).applyMatrix4(matrix);
      // Flat shading: one normal per triangle, computed after transform.
      fn.copy(b).sub(a).cross(new THREE.Vector3().copy(c).sub(a)).normalize();
      if (!isFinite(fn.x) || fn.lengthSq() < 1e-8) fn.set(0, 1, 0);
      fn.applyMatrix3(normalMatrix).normalize();

      const tri = [a, b, c];
      const faceColor = typeof color === 'function' ? color(fn, b, t) : color;
      for (let k = 0; k < 3; k += 1) {
        p.copy(tri[k]);
        this.pos.push(p.x, p.y, p.z);
        this.nrm.push(fn.x, fn.y, fn.z);
        if (this.useColor) this.col.push(faceColor.r, faceColor.g, faceColor.b);
        if (uvAttr) this.uv.push(uvAttr.getX(t * 3 + k), uvAttr.getY(t * 3 + k));
        else this.uv.push(0, 0);
        if (this.useSway) {
          const w = typeof sway === 'function' ? sway(p) : sway;
          this.sway.push(w);
          this.origin.push(org.x, org.y, org.z);
          this.phase.push(phase);
        }
        this.vertexCount += 1;
      }
    }
    if (geo !== geometry) geo.dispose();
    return this;
  }

  build(material, name = 'merged') {
    if (this.vertexCount === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.useColor) geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.useSway) {
      geometry.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
      geometry.setAttribute('aOrigin', new THREE.Float32BufferAttribute(this.origin, 3));
      geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(this.phase, 1));
    }
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }
}

/* ------------------------------------------------------------------ *
 * Low-poly primitives
 * ------------------------------------------------------------------ */

/**
 * Low-poly tapered tube along a spine. Used for trunks, branches and fence
 * rails; `sides` stays at 5-7 so the silhouette keeps visible facets.
 */
export function makeTube(spine, radii, sides = 6, twist = 0) {
  const rings = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  for (let i = 0; i < spine.length; i += 1) {
    const prev = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(spine.length - 1, i + 1)];
    tangent.copy(next).sub(prev);
    if (tangent.lengthSq() < 1e-8) tangent.set(0, 1, 0);
    tangent.normalize();
    normal.copy(up).cross(tangent);
    if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0);
    normal.normalize();
    binormal.copy(tangent).cross(normal).normalize();

    const ring = [];
    for (let s = 0; s < sides; s += 1) {
      const a = (s / sides) * Math.PI * 2 + twist * i;
      const r = radii[i];
      ring.push(new THREE.Vector3(
        spine[i].x + (Math.cos(a) * normal.x + Math.sin(a) * binormal.x) * r,
        spine[i].y + (Math.cos(a) * normal.y + Math.sin(a) * binormal.y) * r,
        spine[i].z + (Math.cos(a) * normal.z + Math.sin(a) * binormal.z) * r,
      ));
    }
    rings.push(ring);
  }

  const verts = [];
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let s = 0; s < sides; s += 1) {
      const s2 = (s + 1) % sides;
      const a = rings[i][s];
      const b = rings[i][s2];
      const c = rings[i + 1][s];
      const d = rings[i + 1][s2];
      verts.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
      verts.push(b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
    }
  }
  // Cap the top so a cut branch does not show a hole.
  const top = rings[rings.length - 1];
  const centre = new THREE.Vector3();
  top.forEach((v) => centre.add(v));
  centre.multiplyScalar(1 / top.length);
  for (let s = 0; s < sides; s += 1) {
    const a = top[s];
    const b = top[(s + 1) % sides];
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z, centre.x, centre.y, centre.z);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Irregular faceted blob: the canopy unit. */
export function makeBlob(radius, { detail = 0, jitter = 0.22, squash = 1, rng } = {}) {
  // PolyhedronGeometry is already non-indexed, so no conversion is needed.
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.getAttribute('position');
  // Displace by lattice position so shared corners move together and the hull
  // stays closed.
  const key = new Map();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const k = `${v.x.toFixed(3)}|${v.y.toFixed(3)}|${v.z.toFixed(3)}`;
    let d = key.get(k);
    if (!d) {
      const j = radius * jitter;
      d = new THREE.Vector3(
        (rng.next() - 0.5) * 2 * j,
        (rng.next() - 0.5) * 2 * j,
        (rng.next() - 0.5) * 2 * j,
      );
      key.set(k, d);
    }
    pos.setXYZ(i, v.x + d.x, (v.y + d.y) * squash, v.z + d.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Faceted cone: conifer tiers and the signpost cap. */
export function makeCone(radius, height, sides = 7) {
  const verts = [];
  const apex = new THREE.Vector3(0, height, 0);
  for (let s = 0; s < sides; s += 1) {
    const a0 = (s / sides) * Math.PI * 2;
    const a1 = ((s + 1) / sides) * Math.PI * 2;
    const p0 = new THREE.Vector3(Math.cos(a0) * radius, 0, Math.sin(a0) * radius);
    const p1 = new THREE.Vector3(Math.cos(a1) * radius, 0, Math.sin(a1) * radius);
    verts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, apex.x, apex.y, apex.z);
    verts.push(p1.x, p1.y, p1.z, p0.x, p0.y, p0.z, 0, 0, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Chamfered box: 6 inset faces, 12 edge strips, 8 corner triangles. Used for
 * crates, plot kerbs, fence posts and the whale's blocky masses. The chamfer is
 * what stops a low-poly box from reading as a placeholder cube — it catches a
 * separate light band on every edge.
 *
 * UVs are a box projection along each triangle's dominant axis, so a face texture
 * maps cleanly and the chamfers pick up the border texels of that texture.
 */
export function makeChamferBox(w, h, d, bevel = 0.08) {
  const hx = w * 0.5;
  const hy = h * 0.5;
  const hz = d * 0.5;
  const b = Math.min(bevel, Math.min(hx, Math.min(hy, hz)) * 0.45);
  const half = [hx, hy, hz];
  const inner = [hx - b, hy - b, hz - b];
  const tris = [];

  const P = (x, y, z) => [x, y, z];

  // --- 6 inset faces ---
  for (let axis = 0; axis < 3; axis += 1) {
    const a1 = (axis + 1) % 3;
    const a2 = (axis + 2) % 3;
    for (const s of [1, -1]) {
      const corner = (s1, s2) => {
        const p = [0, 0, 0];
        p[axis] = s * half[axis];
        p[a1] = s1 * inner[a1];
        p[a2] = s2 * inner[a2];
        return p;
      };
      const q = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
      tris.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
    }
  }

  // --- 12 edge strips ---
  for (let axis = 0; axis < 3; axis += 1) {
    const a1 = (axis + 1) % 3;
    const a2 = (axis + 2) % 3;
    for (const s1 of [1, -1]) {
      for (const s2 of [1, -1]) {
        const mk = (along, outer1, outer2) => {
          const p = [0, 0, 0];
          p[axis] = along * inner[axis];
          p[a1] = s1 * (outer1 ? half[a1] : inner[a1]);
          p[a2] = s2 * (outer2 ? half[a2] : inner[a2]);
          return p;
        };
        const q = [mk(-1, true, false), mk(1, true, false), mk(1, false, true), mk(-1, false, true)];
        tris.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
      }
    }
  }

  // --- 8 corner triangles ---
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        tris.push([
          P(sx * hx, sy * inner[1], sz * inner[2]),
          P(sx * inner[0], sy * hy, sz * inner[2]),
          P(sx * inner[0], sy * inner[1], sz * hz),
        ]);
      }
    }
  }

  const verts = [];
  const uvs = [];
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (const t of tris) {
    const [p0, p1, p2] = t;
    e1.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    e2.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    n.copy(e1).cross(e2);
    centroid.set((p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3, (p0[2] + p1[2] + p2[2]) / 3);
    // The solid is convex and origin-centred, so an outward normal always
    // agrees with the centroid direction.
    const ordered = n.dot(centroid) >= 0 ? [p0, p1, p2] : [p0, p2, p1];
    n.normalize();

    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    for (const p of ordered) {
      verts.push(p[0], p[1], p[2]);
      let u;
      let v;
      if (ax >= ay && ax >= az) { u = p[2] / d + 0.5; v = p[1] / h + 0.5; }
      else if (ay >= az) { u = p[0] / w + 0.5; v = p[2] / d + 0.5; }
      else { u = p[0] / w + 0.5; v = p[1] / h + 0.5; }
      uvs.push(Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v)));
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}
