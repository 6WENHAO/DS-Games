/* ==========================================================================
 * mesh.js — MeshBuilder: builds flat-shaded polygon soup meshes.
 *
 * A mesh is:  { verts:[[x,y,z],...], faces:[{i:[idx...], c:[r,g,b], ...}],
 *               c:[centre], r:radius }
 * Faces are convex polygons (tri or quad, occasionally n-gon). Nothing is
 * culled by winding order, so vertex order only matters for shape.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.M, C = global.C;

  class MeshBuilder {
    constructor() {
      this.verts = [];
      this.faces = [];
      this.mat = M.ident();
      this.stack = [];
    }

    /* ---- transform stack ---- */
    save() { this.stack.push(this.mat); return this; }
    restore() { this.mat = this.stack.pop() || M.ident(); return this; }
    xf(m) { this.mat = M.mul(this.mat, m); return this; }
    move(x, y, z) { return this.xf(M.translate(x, y, z)); }
    rotX(a) { return this.xf(M.rotX(a)); }
    rotY(a) { return this.xf(M.rotY(a)); }
    rotZ(a) { return this.xf(M.rotZ(a)); }
    scale(x, y, z) { return this.xf(M.scaleM(x, y === undefined ? x : y, z === undefined ? x : z)); }

    /* ---- primitives ---- */
    vert(x, y, z) {
      const p = M.xformPoint(this.mat, [x, y, z]);
      this.verts.push(p);
      return this.verts.length - 1;
    }
    vertV(p) { return this.vert(p[0], p[1], p[2]); }

    face(idx, color, opts) {
      const f = { i: idx, c: color };
      if (opts) {
        if (opts.glow) f.glow = opts.glow;
        if (opts.heat) f.heat = opts.heat;
        if (opts.flat) f.flat = 1;
        if (opts.edge) f.edge = opts.edge;
      }
      this.faces.push(f);
      return f;
    }

    /** free polygon from an array of local-space points */
    poly(points, color, opts) {
      const idx = points.map(p => this.vertV(p));
      return this.face(idx, color, opts);
    }
    quad(a, b, c, d, color, opts) { return this.poly([a, b, c, d], color, opts); }
    tri(a, b, c, color, opts) { return this.poly([a, b, c], color, opts); }

    /** axis aligned box, centre + full size */
    box(cx, cy, cz, sx, sy, sz, color, opts) {
      const hx = sx / 2, hy = sy / 2, hz = sz / 2;
      const v = [];
      for (let i = 0; i < 8; i++) {
        v.push(this.vert(cx + (i & 1 ? hx : -hx), cy + (i & 2 ? hy : -hy), cz + (i & 4 ? hz : -hz)));
      }
      const top = (opts && opts.topColor) || C.tint(color, 1.06);
      const side = color;
      const bot = (opts && opts.botColor) || C.tint(color, 0.82);
      this.face([v[0], v[1], v[3], v[2]], bot, opts);          // -Z
      this.face([v[4], v[6], v[7], v[5]], side, opts);         // +Z
      this.face([v[0], v[2], v[6], v[4]], C.tint(side, 0.93), opts); // -X
      this.face([v[1], v[5], v[7], v[3]], C.tint(side, 0.97), opts); // +X
      this.face([v[2], v[3], v[7], v[6]], top, opts);          // +Y
      this.face([v[0], v[4], v[5], v[1]], C.tint(color, 0.7), opts); // -Y
      return this;
    }

    /**
     * Extrude a 2D profile along one axis.
     *   axis 'x': profile pts are [y,z], extruded x0..x1  (hull side profiles)
     *   axis 'y': profile pts are [x,z], extruded y0..y1  (turret plan views)
     *   axis 'z': profile pts are [x,y], extruded z0..z1
     */
    extrude(profile, axis, a, b, color, opts) {
      opts = opts || {};
      const mk = (p, t) => {
        if (axis === 'x') return [t, p[0], p[1]];
        if (axis === 'y') return [p[0], t, p[1]];
        return [p[0], p[1], t];
      };
      const n = profile.length;
      const A = profile.map(p => this.vertV(mk(p, a)));
      const B = profile.map(p => this.vertV(mk(p, b)));
      const capC = opts.capColor || C.tint(color, 0.9);
      if (opts.caps !== false) {
        this.face(A.slice(), capC, opts);
        this.face(B.slice().reverse(), capC, opts);
      }
      const shades = opts.shades || null;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (!opts.closed && i === n - 1) break;
        let col = color;
        if (shades && shades[i] !== undefined) col = C.tint(color, shades[i]);
        else {
          // fake a little variation per band so slopes read clearly
          col = C.tint(color, 0.94 + 0.12 * ((i * 37) % 5) / 5);
        }
        this.face([A[i], A[j], B[j], B[i]], col, opts);
      }
      return this;
    }

    /** cylinder / cone between two local points */
    tube(p0, p1, r0, r1, seg, color, opts) {
      opts = opts || {};
      seg = seg || 10;
      const dir = M.norm(M.sub(p1, p0));
      let up = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const rx = M.norm(M.cross(up, dir));
      const ry = M.cross(dir, rx);
      const A = [], B = [];
      for (let i = 0; i < seg; i++) {
        const t = i / seg * M.TAU, ct = Math.cos(t), st = Math.sin(t);
        A.push(this.vertV([
          p0[0] + (rx[0] * ct + ry[0] * st) * r0,
          p0[1] + (rx[1] * ct + ry[1] * st) * r0,
          p0[2] + (rx[2] * ct + ry[2] * st) * r0]));
        B.push(this.vertV([
          p1[0] + (rx[0] * ct + ry[0] * st) * r1,
          p1[1] + (rx[1] * ct + ry[1] * st) * r1,
          p1[2] + (rx[2] * ct + ry[2] * st) * r1]));
      }
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        const shade = 0.78 + 0.34 * Math.abs(Math.cos(i / seg * M.TAU + 0.6));
        this.face([A[i], A[j], B[j], B[i]], C.tint(color, shade), opts);
      }
      if (opts.cap0 !== false) this.face(A.slice().reverse(), C.tint(color, 0.8), opts);
      if (opts.cap1 !== false) this.face(B.slice(), C.tint(color, 1.05), opts);
      return this;
    }

    /** flat disc facing an axis ('x'|'y'|'z') */
    disc(center, axis, r, seg, color, opts) {
      seg = seg || 12;
      const pts = [];
      for (let i = 0; i < seg; i++) {
        const t = i / seg * M.TAU, ct = Math.cos(t) * r, st = Math.sin(t) * r;
        if (axis === 'x') pts.push([center[0], center[1] + ct, center[2] + st]);
        else if (axis === 'y') pts.push([center[0] + ct, center[1], center[2] + st]);
        else pts.push([center[0] + ct, center[1] + st, center[2]]);
      }
      return this.poly(pts, color, opts);
    }

    /** flat ring (washer) — hatch rims, wheel hubs, handwheels */
    ring(center, axis, rOut, rIn, seg, color, opts) {
      seg = seg || 12;
      const at = (r, t) => {
        const ct = Math.cos(t) * r, st = Math.sin(t) * r;
        if (axis === 'x') return [center[0], center[1] + ct, center[2] + st];
        if (axis === 'y') return [center[0] + ct, center[1], center[2] + st];
        return [center[0] + ct, center[1] + st, center[2]];
      };
      for (let i = 0; i < seg; i++) {
        const t0 = i / seg * M.TAU, t1 = (i + 1) / seg * M.TAU;
        this.quad(at(rOut, t0), at(rOut, t1), at(rIn, t1), at(rIn, t0),
          C.tint(color, 0.9 + 0.2 * Math.abs(Math.cos(t0))), opts);
      }
      return this;
    }

    /** low poly dome (cupolas, helmets, hemispherical mantlets) */
    dome(center, r, seg, rings, color, opts) {
      seg = seg || 10; rings = rings || 3;
      let prev = null;
      for (let k = 0; k <= rings; k++) {
        const phi = (k / rings) * Math.PI / 2;
        const y = Math.sin(phi) * r, rr = Math.cos(phi) * r;
        const row = [];
        for (let i = 0; i < seg; i++) {
          const t = i / seg * M.TAU;
          row.push(this.vertV([center[0] + Math.cos(t) * rr, center[1] + y, center[2] + Math.sin(t) * rr]));
        }
        if (prev) {
          for (let i = 0; i < seg; i++) {
            const j = (i + 1) % seg;
            this.face([prev[i], prev[j], row[j], row[i]],
              C.tint(color, 0.85 + 0.3 * (k / rings)), opts);
          }
        }
        prev = row;
        if (k === rings) this.face(row.slice(), C.tint(color, 1.15), opts);
      }
      return this;
    }

    /** sloped armour plate helper: quad given by centre, right/up vectors */
    plate(center, right, up, color, opts) {
      const a = M.sub(M.sub(center, right), up);
      const b = M.sub(M.add(center, right), up);
      const c = M.add(M.add(center, right), up);
      const d = M.add(M.sub(center, right), up);
      return this.quad(a, b, c, d, color, opts);
    }

    /** merge another built mesh through the current matrix */
    merge(mesh, tintF) {
      const base = this.verts.length;
      for (const v of mesh.verts) this.verts.push(M.xformPoint(this.mat, v));
      for (const f of mesh.faces) {
        const g = { i: f.i.map(i => i + base), c: tintF ? C.tint(f.c, tintF) : f.c };
        if (f.glow) g.glow = f.glow;
        if (f.heat) g.heat = f.heat;
        if (f.flat) g.flat = f.flat;
        if (f.edge) g.edge = f.edge;
        this.faces.push(g);
      }
      return this;
    }

    /** recolour everything (used for wrecks / burnt hulks) */
    recolor(fn) {
      for (const f of this.faces) f.c = fn(f.c);
      return this;
    }

    build() {
      const mesh = { verts: this.verts, faces: this.faces };
      let minx = 1e9, miny = 1e9, minz = 1e9, maxx = -1e9, maxy = -1e9, maxz = -1e9;
      for (const v of this.verts) {
        if (v[0] < minx) minx = v[0]; if (v[0] > maxx) maxx = v[0];
        if (v[1] < miny) miny = v[1]; if (v[1] > maxy) maxy = v[1];
        if (v[2] < minz) minz = v[2]; if (v[2] > maxz) maxz = v[2];
      }
      if (!this.verts.length) { minx = miny = minz = maxx = maxy = maxz = 0; }
      mesh.c = [(minx + maxx) / 2, (miny + maxy) / 2, (minz + maxz) / 2];
      mesh.r = 0.5 * Math.hypot(maxx - minx, maxy - miny, maxz - minz) || 0.001;
      mesh.min = [minx, miny, minz];
      mesh.max = [maxx, maxy, maxz];
      return mesh;
    }
  }

  /** convenience: build a mesh from a callback */
  function buildMesh(fn) {
    const mb = new MeshBuilder();
    fn(mb);
    return mb.build();
  }

  global.MeshBuilder = MeshBuilder;
  global.buildMesh = buildMesh;
  if (typeof module !== 'undefined' && module.exports) module.exports = { MeshBuilder, buildMesh };
})(typeof window !== 'undefined' ? window : globalThis);
