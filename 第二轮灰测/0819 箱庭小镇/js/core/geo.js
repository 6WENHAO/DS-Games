/* =============================================================
   geo.js — geometry toolkit.
   The anti-cube arsenal: bevelled volumes, six kinds of roof,
   lathed towers, arches, stairs, railings, ramps + a geometry
   merger that collapses static detail into few draw calls.
   ============================================================= */
(function (global) {
  'use strict';
  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U;

  const Geo = TOWN.Geo = {};

  /* ============================================================
     0 · low-level construction from explicit triangles
     ============================================================ */

  /**
   * fromQuads(verts, quads) — build a non-indexed BufferGeometry.
   * verts: [[x,y,z],...]; quads: [[a,b,c,d]] (ccw) or [[a,b,c]] triangles.
   * Normals are computed; UVs are a cheap planar projection so that
   * optional textures still work after merging.
   */
  Geo.fromQuads = function (verts, quads) {
    const pos = [];
    const push = (i) => { const v = verts[i]; pos.push(v[0], v[1], v[2]); };
    // NOTE ON WINDING: quad/triangle indices are given counter-clockwise as
    // seen in the (x, z) plane from ABOVE, which is clockwise in three's
    // right-handed screen space — so each face is emitted reversed here to
    // produce outward-facing normals. Verified by a signed-volume audit of
    // every helper (tools/probe.sh + the audit in docs/CONTRACT.md).
    for (const f of quads) {
      if (f.length === 4) { push(f[0]); push(f[2]); push(f[1]); push(f[0]); push(f[3]); push(f[2]); }
      else { push(f[0]); push(f[2]); push(f[1]); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    // planar-ish uv from the two largest axes of each triangle's normal
    const n = pos.length / 3;
    const uv = new Float32Array(n * 2);
    const nor = g.attributes.normal.array;
    for (let i = 0; i < n; i++) {
      const nx = Math.abs(nor[i * 3]), ny = Math.abs(nor[i * 3 + 1]), nz = Math.abs(nor[i * 3 + 2]);
      let u, v;
      if (ny >= nx && ny >= nz) { u = pos[i * 3]; v = pos[i * 3 + 2]; }
      else if (nx >= nz) { u = pos[i * 3 + 2]; v = pos[i * 3 + 1]; }
      else { u = pos[i * 3]; v = pos[i * 3 + 1]; }
      uv[i * 2] = u; uv[i * 2 + 1] = v;
    }
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    return g;
  };

  /* ============================================================
     1 · volumes  (bevelled / tapered — never a raw cube)
     ============================================================ */

  const boxCache = new Map();

  /** box(w,h,d) — cached plain box, origin at centre */
  Geo.box = function (w, h, d) {
    const k = 'b' + w.toFixed(3) + '_' + h.toFixed(3) + '_' + d.toFixed(3);
    if (boxCache.has(k)) return boxCache.get(k);
    const g = new T.BoxGeometry(w, h, d);
    boxCache.set(k, g);
    return g;
  };

  /**
   * chamferBox(w,h,d,c) — box with chamfered vertical edges (octagonal plan).
   * Reads as a crafted volume rather than a cube: the tiny 45° corner
   * catches a highlight on every building edge.
   */
  Geo.chamferBox = function (w, h, d, c) {
    c = Math.min(c === undefined ? 0.08 : c, Math.min(w, d) * 0.4);
    const hw = w / 2, hd = d / 2;
    const plan = [
      [-hw + c, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c],
      [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c],
    ];
    return Geo.prism(plan, h, { center: true });
  };

  /**
   * taperBox(w,h,d,topScaleX,topScaleZ) — slightly battered walls.
   */
  Geo.taperBox = function (w, h, d, sx, sz) {
    sz = sz === undefined ? sx : sz;
    const g = new T.CylinderGeometry(0.5, 0.5, 1, 4, 1);
    // rebuild manually for exact control
    const hw = w / 2, hd = d / 2, tw = (w * sx) / 2, td = (d * sz) / 2;
    const v = [
      [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd],
      [-tw, h, -td], [tw, h, -td], [tw, h, td], [-tw, h, td],
    ];
    g.dispose();
    return Geo.fromQuads(v, [
      [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
      [4, 5, 6, 7], [3, 2, 1, 0],
    ]);
  };

  /**
   * prism(plan2d, height, opts) — extrude a 2-D polygon upward.
   * plan: [[x,z],...] counter-clockwise. opts.center centres in Y.
   * The workhorse for L-shaped, splayed and irregular footprints.
   */
  Geo.prism = function (plan, height, opts) {
    opts = opts || {};
    const y0 = opts.center ? -height / 2 : (opts.y0 || 0);
    const y1 = y0 + height;
    const n = plan.length;
    const verts = [];
    for (const p of plan) verts.push([p[0], y0, p[1]]);
    for (const p of plan) verts.push([p[0], y1, p[1]]);
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push([i, j, j + n, i + n]);
    }
    // caps via fan triangulation (plans are convex or mildly concave)
    if (opts.cap !== false) {
      const cx = plan.reduce((s, p) => s + p[0], 0) / n;
      const cz = plan.reduce((s, p) => s + p[1], 0) / n;
      verts.push([cx, y1, cz]); const top = verts.length - 1;
      verts.push([cx, y0, cz]); const bot = verts.length - 1;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        faces.push([i + n, j + n, top]);
        faces.push([j, i, bot]);
      }
    }
    return Geo.fromQuads(verts, faces);
  };

  /** regular n-gon plan of radius r, optional rotation */
  Geo.polyPlan = function (sides, r, rot) {
    rot = rot || 0;
    const p = [];
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * U.TAU;
      p.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return p;
  };

  /** rounded rectangle plan (for organic plates, ponds, plazas) */
  Geo.roundRectPlan = function (w, d, r, seg, jitter, rng) {
    seg = seg || 4;
    const hw = w / 2 - r, hd = d / 2 - r;
    const pts = [];
    const corners = [[hw, hd, 0], [-hw, hd, 1], [-hw, -hd, 2], [hw, -hd, 3]];
    // order: +x+z, -x+z, -x-z, +x-z  (ccw in xz with z up)
    for (const [cx, cz, ci] of corners) {
      for (let i = 0; i <= seg; i++) {
        const a = (ci * U.TAU) / 4 + (i / seg) * (U.TAU / 4);
        let rr = r;
        if (jitter && rng) rr = r * (1 + rng.bell() * jitter);
        pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]);
      }
    }
    return pts;
  };

  /**
   * orientOutward(geo) — flip any individual triangle whose normal points
   * back toward the body centroid. A reliable auto-fix for the convex
   * hand-built solids here, and the reason the roof helpers no longer
   * depend on getting every quad's winding right by hand.
   * Do NOT use on shells with deliberate inward faces (barrel vaults).
   */
  Geo.orientOutward = function (geo) {
    const p = geo.attributes.position;
    const a = p.array;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < p.count; i++) { cx += a[i * 3]; cy += a[i * 3 + 1]; cz += a[i * 3 + 2]; }
    cx /= p.count; cy /= p.count; cz /= p.count;
    for (let i = 0; i < p.count; i += 3) {
      const o = i * 3;
      const ax = a[o], ay = a[o + 1], az = a[o + 2];
      const bx = a[o + 3], by = a[o + 4], bz = a[o + 5];
      const gx = a[o + 6], gy = a[o + 7], gz = a[o + 8];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = gx - ax, vy = gy - ay, vz = gz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const mx = (ax + bx + gx) / 3 - cx, my = (ay + by + gy) / 3 - cy, mz = (az + bz + gz) / 3 - cz;
      if (nx * mx + ny * my + nz * mz < 0) {
        a[o + 3] = gx; a[o + 4] = gy; a[o + 5] = gz;
        a[o + 6] = bx; a[o + 7] = by; a[o + 8] = bz;
      }
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  };

  /* ============================================================
     2 · roofs — the strongest anti-cube tool.
     Every roof gets eaves overhang + a thickness so the edge reads.
     ============================================================ */

  /**
   * gableRoof(w,d,h,opts) — classic two-slope roof ridged along X.
   * opts: {over (eaves), thick, ridgeShift, hipFront, hipBack}
   * Origin at the eaves plane centre (y=0), apex at y=h.
   */
  Geo.gableRoof = function (w, d, h, opts) {
    opts = opts || {};
    const over = opts.over === undefined ? 0.28 : opts.over;
    const th = opts.thick === undefined ? 0.16 : opts.thick;
    const W = w / 2 + over, D = d / 2 + over;
    const shift = (opts.ridgeShift || 0) * D;
    const verts = [
      // lower eaves ring (outer, top surface of the slab)
      [-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D],
      // ridge line
      [-W, h, shift], [W, h, shift],
      // lower eaves ring (under-side)
      [-W, -th, -D], [W, -th, -D], [W, -th, D], [-W, -th, D],
      // ridge under-side
      [-W, h - th * 1.4, shift], [W, h - th * 1.4, shift],
    ];
    const faces = [
      [0, 1, 5, 4],       // slope -Z
      [3, 4, 5, 2],       // slope +Z  (wound so normal faces out)
      [7, 6, 10, 11],     // under -Z
      [9, 8, 11, 10],     // under +Z
      [0, 4, 10, 6],      // gable end -X
      [1, 7, 11, 5],      // gable end +X
      [0, 6, 7, 1],       // eaves fascia -Z
      [2, 8, 9, 3],       // eaves fascia +Z  (fixed winding below)
    ];
    return Geo.orientOutward(Geo.fromQuads(verts, faces));
  };

  /** hipRoof(w,d,h,opts) — four slopes meeting a short ridge */
  Geo.hipRoof = function (w, d, h, opts) {
    opts = opts || {};
    const over = opts.over === undefined ? 0.26 : opts.over;
    const ridgeF = opts.ridge === undefined ? 0.42 : opts.ridge; // ridge length / w
    const W = w / 2 + over, D = d / 2 + over;
    const rl = W * ridgeF;
    const verts = [
      [-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D],
      [-rl, h, 0], [rl, h, 0],
    ];
    const faces = [
      [0, 1, 5, 4],  // -Z slope
      [3, 2, 5, 4],  // +Z slope -> fix winding
      [0, 4, 3],     // -X hip
      [1, 2, 5],     // +X hip
      [3, 2, 1, 0],  // soffit
    ];
    return Geo.orientOutward(Geo.fromQuads(verts, faces));
  };

  /** pyramidRoof(w,d,h) — single apex; for towers & gazebos */
  Geo.pyramidRoof = function (w, d, h, opts) {
    opts = opts || {};
    const over = opts.over === undefined ? 0.22 : opts.over;
    const W = w / 2 + over, D = d / 2 + over;
    const verts = [[-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D], [0, h, 0]];
    return Geo.orientOutward(Geo.fromQuads(verts, [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [3, 2, 1, 0]]));
  };

  /**
   * mansardRoof(w,d,h,opts) — steep lower slope + shallow upper.
   * Instantly reads as "old European town" and breaks box silhouettes.
   */
  Geo.mansardRoof = function (w, d, h, opts) {
    opts = opts || {};
    const over = opts.over === undefined ? 0.24 : opts.over;
    const kneeF = opts.knee === undefined ? 0.62 : opts.knee;   // height of the break
    const insetF = opts.inset === undefined ? 0.3 : opts.inset;  // plan inset at the break
    const capF = opts.cap === undefined ? 0.62 : opts.cap;       // plan inset at the top
    const W = w / 2 + over, D = d / 2 + over;
    const kh = h * kneeF;
    const W1 = W * (1 - insetF), D1 = D * (1 - insetF);
    const W2 = W1 * (1 - capF), D2 = D1 * (1 - capF);
    const v = [
      [-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D],
      [-W1, kh, -D1], [W1, kh, -D1], [W1, kh, D1], [-W1, kh, D1],
      [-W2, h, -D2], [W2, h, -D2], [W2, h, D2], [-W2, h, D2],
    ];
    const f = [
      [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
      [4, 5, 9, 8], [5, 6, 10, 9], [6, 7, 11, 10], [7, 4, 8, 11],
      [8, 9, 10, 11], [3, 2, 1, 0],
    ];
    return Geo.fromQuads(v, f);
  };

  /**
   * barrelRoof(w,d,h,seg) — curved vault, ridged along X.
   * Warehouses, greenhouses, markets, station canopies.
   */
  Geo.barrelRoof = function (w, d, h, seg, opts) {
    opts = opts || {};
    seg = seg || 10;
    const over = opts.over === undefined ? 0.2 : opts.over;
    const W = w / 2 + over, D = d / 2 + over;
    const th = opts.thick === undefined ? 0.12 : opts.thick;
    const arc = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, a = t * Math.PI;
      arc.push([-Math.cos(a) * D, Math.sin(a) * h]);
    }
    const v = [], f = [];
    for (const p of arc) { v.push([-W, p[1], p[0]]); v.push([W, p[1], p[0]]); }
    const base = 0;
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2, b = a + 1, c = a + 3, d2 = a + 2;
      f.push([a, b, c, d2]);
    }
    // inner shell (offset inward) for thickness
    const off = v.length;
    for (const p of arc) {
      const s = 1 - th / Math.max(h, D);
      v.push([-W + th, p[1] * s, p[0] * s]); v.push([W - th, p[1] * s, p[0] * s]);
    }
    for (let i = 0; i < seg; i++) {
      const a = off + i * 2, b = a + 1, c = a + 3, d2 = a + 2;
      f.push([d2, c, b, a]);
    }
    // end caps
    for (let i = 0; i < seg; i++) {
      const o = i * 2, oi = off + i * 2;
      f.push([o, oi, oi + 2, o + 2]);          // -X rim
      f.push([o + 3, oi + 3, oi + 1, o + 1]);  // +X rim
    }
    return Geo.fromQuads(v, f);
  };

  /** coneRoof(r,h,sides) — conical turret cap / spire */
  Geo.coneRoof = function (r, h, sides, opts) {
    opts = opts || {};
    const g = new T.ConeGeometry(r, h, sides || 8, 1, false);
    g.translate(0, h / 2, 0);
    return Geo.fixNormals(g);
  };

  /**
   * bellSpire(r,h,sides) — concave "witch hat" spire via lathe.
   * Far more charming than a plain cone for churches & towers.
   */
  Geo.bellSpire = function (r, h, sides, curve) {
    curve = curve === undefined ? 0.55 : curve;
    const pts = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const rr = r * Math.pow(1 - t, 1 + curve);
      pts.push([Math.max(rr, 0.001), t * h]);
    }
    return Geo.lathe(pts, sides || 10);
  };

  /** domeRoof(r,h,sides) — hemispherical / ogee dome */
  Geo.domeRoof = function (r, h, sides, ogee) {
    const pts = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = t * Math.PI * 0.5;
      let rr = Math.cos(a) * r, yy = Math.sin(a) * h;
      if (ogee) { rr = Math.cos(a) * r * (1 + 0.22 * Math.sin(a * 2)); yy = Math.sin(a) * h; }
      pts.push([Math.max(rr, 0.001), yy]);
    }
    return Geo.lathe(pts, sides || 14);
  };

  /**
   * sawtoothRoof(w,d,h,teeth) — factory / atelier roof with glazing runs.
   */
  Geo.sawtoothRoof = function (w, d, h, teeth) {
    teeth = teeth || 3;
    const v = [], f = [];
    const step = d / teeth, hw = w / 2;
    for (let i = 0; i < teeth; i++) {
      const z0 = -d / 2 + i * step, z1 = z0 + step;
      const b = v.length;
      v.push([-hw, 0, z0], [hw, 0, z0], [hw, h, z1], [-hw, h, z1]); // slope
      v.push([-hw, 0, z1], [hw, 0, z1]);                            // vertical face foot
      f.push([b, b + 1, b + 2, b + 3]);       // sloping plane
      f.push([b + 3, b + 2, b + 5, b + 4]);   // vertical riser (glazing)
      f.push([b, b + 3, b + 4]);              // -X gable
      f.push([b + 1, b + 5, b + 2]);          // +X gable  (wound outward)
    }
    return Geo.fromQuads(v, f);
  };

  /* ============================================================
     3 · lathed / revolved forms — towers, chimneys, urns, fountains
     ============================================================ */

  /**
   * fixNormals(geo) — repair zero-length normals.
   * Surfaces of revolution produce degenerate normals at their poles
   * (radius -> 0) which render as black specks; replace those with the
   * radial direction so dome tops and spire tips shade cleanly.
   */
  Geo.fixNormals = function (geo) {
    const n = geo.attributes.normal, p = geo.attributes.position;
    if (!n) { geo.computeVertexNormals(); return geo; }
    let fixed = 0;
    for (let i = 0; i < n.count; i++) {
      const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
      if (isFinite(l) && l > 0.5) continue;
      const x = p.getX(i), z = p.getZ(i);
      const rl = Math.hypot(x, z);
      if (rl > 1e-4) n.setXYZ(i, x / rl * 0.4, 0.92, z / rl * 0.4);
      else n.setXYZ(i, 0, 1, 0);
      fixed++;
    }
    if (fixed) n.needsUpdate = true;
    return geo;
  };

  /**
   * lathe(profile, sides) — profile as [[radius, y],...]
   * Consecutive duplicate points are dropped (they create zero-area
   * quads with null normals) and pole normals are repaired.
   */
  Geo.lathe = function (profile, sides) {
    const pts = [];
    for (const p of profile) {
      const v = new T.Vector2(Math.max(p[0], 0.0005), p[1]);
      const last = pts[pts.length - 1];
      if (last && Math.abs(last.x - v.x) < 1e-5 && Math.abs(last.y - v.y) < 1e-5) continue;
      pts.push(v);
    }
    if (pts.length < 2) pts.push(new T.Vector2(pts[0] ? pts[0].x : 0.001, (pts[0] ? pts[0].y : 0) + 0.001));
    return Geo.fixNormals(new T.LatheGeometry(pts, sides || 16));
  };

  /**
   * taperTower(rBase,rTop,h,sides,opts) — battered tower (lighthouse,
   * windmill, silo). opts.bands adds a projecting ring every N units.
   */
  Geo.taperTower = function (rBase, rTop, h, sides, opts) {
    opts = opts || {};
    const prof = [];
    const steps = opts.steps || 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const bulge = opts.bulge ? Math.sin(t * Math.PI) * opts.bulge : 0;
      prof.push([U.lerp(rBase, rTop, Math.pow(t, opts.pow || 1)) + bulge, t * h]);
    }
    return Geo.lathe(prof, sides || 14);
  };

  /** ring(rIn,rOut,h,sides) — cornice / balcony ring / gallery deck */
  Geo.ring = function (rIn, rOut, h, sides) {
    return Geo.lathe([[rIn, 0], [rOut, 0], [rOut, h], [rIn, h]], sides || 16);
  };

  /** torus for handrails, wheel rims */
  Geo.torus = function (r, tube, seg, rad) {
    return new T.TorusGeometry(r, tube, rad || 8, seg || 24);
  };

  /* ============================================================
     4 · openings, arches, frames
     ============================================================ */

  /**
   * archShape(w,h,arcH) — THREE.Shape of a round-headed opening.
   */
  Geo.archShape = function (w, h, arcH) {
    const s = new T.Shape();
    const hw = w / 2, straight = h - arcH;
    s.moveTo(-hw, 0);
    s.lineTo(-hw, straight);
    s.quadraticCurveTo(-hw, h, 0, h);
    s.quadraticCurveTo(hw, h, hw, straight);
    s.lineTo(hw, 0);
    s.lineTo(-hw, 0);
    return s;
  };

  /**
   * archWall(w,h,d,openings) — a wall slab pierced by arches/rects.
   * openings: [{x, y, w, h, arc}]  (x,y = centre-bottom of the hole)
   * Gives colonnades, arcades and cloisters — huge anti-cube win.
   */
  Geo.archWall = function (w, h, d, openings) {
    const shape = new T.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, h); shape.lineTo(-w / 2, h); shape.lineTo(-w / 2, 0);
    for (const o of openings || []) {
      const hole = new T.Path();
      const hw = o.w / 2, x = o.x, y0 = o.y, y1 = o.y + o.h;
      if (o.arc) {
        const straight = y1 - Math.min(o.arc, o.h * 0.9);
        hole.moveTo(x - hw, y0);
        hole.lineTo(x - hw, straight);
        hole.quadraticCurveTo(x - hw, y1, x, y1);
        hole.quadraticCurveTo(x + hw, y1, x + hw, straight);
        hole.lineTo(x + hw, y0);
      } else {
        hole.moveTo(x - hw, y0); hole.lineTo(x + hw, y0);
        hole.lineTo(x + hw, y1); hole.lineTo(x - hw, y1);
      }
      hole.lineTo(x - hw, y0);
      shape.holes.push(hole);
    }
    const g = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -d / 2);
    return g;
  };

  /**
   * frameGeo(w,h,t,d) — a rectangular window/door frame (4 bars merged)
   */
  Geo.frame = function (w, h, t, d) {
    const parts = [];
    const add = (g, x, y) => { g.translate(x, y, 0); parts.push(g); };
    add(new T.BoxGeometry(w, t, d), 0, h / 2 - t / 2);
    add(new T.BoxGeometry(w, t, d), 0, -h / 2 + t / 2);
    add(new T.BoxGeometry(t, h - t * 2, d), -w / 2 + t / 2, 0);
    add(new T.BoxGeometry(t, h - t * 2, d), w / 2 - t / 2, 0);
    return Geo.mergeGeometries(parts);
  };

  /** mullioned window pane grid: returns geometry of the muntin bars */
  Geo.muntins = function (w, h, cols, rows, t, d) {
    const parts = [];
    for (let i = 1; i < cols; i++) {
      const g = new T.BoxGeometry(t, h, d); g.translate(-w / 2 + (w * i) / cols, 0, 0); parts.push(g);
    }
    for (let j = 1; j < rows; j++) {
      const g = new T.BoxGeometry(w, t, d); g.translate(0, -h / 2 + (h * j) / rows, 0); parts.push(g);
    }
    if (!parts.length) return null;
    return Geo.mergeGeometries(parts);
  };

  /* ============================================================
     5 · stairs, ramps, railings, retaining walls
     ============================================================ */

  /**
   * stairs(width, rise, run, steps) — flight climbing +Z, base at y=0.
   * Returns one merged geometry.
   */
  Geo.stairs = function (width, rise, run, steps) {
    const parts = [];
    const sh = rise / steps, sd = run / steps;
    for (let i = 0; i < steps; i++) {
      const g = new T.BoxGeometry(width, sh * (i + 1), sd);
      g.translate(0, (sh * (i + 1)) / 2, -run / 2 + sd * (i + 0.5));
      parts.push(g);
    }
    return Geo.mergeGeometries(parts);
  };

  /** curvedStairs: flight following an arc — used on the terrace slopes */
  Geo.curvedStairs = function (rInner, rOuter, rise, steps, arcRad) {
    const parts = [];
    const sh = rise / steps;
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * arcRad;
      const a1 = ((i + 1) / steps) * arcRad;
      const plan = [];
      const seg = 3;
      for (let k = 0; k <= seg; k++) {
        const a = U.lerp(a0, a1, k / seg);
        plan.push([Math.cos(a) * rOuter, Math.sin(a) * rOuter]);
      }
      for (let k = seg; k >= 0; k--) {
        const a = U.lerp(a0, a1, k / seg);
        plan.push([Math.cos(a) * rInner, Math.sin(a) * rInner]);
      }
      const g = Geo.prism(plan, sh * (i + 1));
      parts.push(g);
    }
    return Geo.mergeGeometries(parts);
  };

  /**
   * railing(len, h, opts) — balusters + top/bottom rail, along X.
   * opts: {spacing, postR, style:'baluster'|'bar'|'lattice'}
   */
  Geo.railing = function (len, h, opts) {
    opts = opts || {};
    const sp = opts.spacing || 0.55;
    const r = opts.postR || 0.045;
    const parts = [];
    const n = Math.max(2, Math.round(len / sp));
    for (let i = 0; i <= n; i++) {
      const x = -len / 2 + (len * i) / n;
      let g;
      if (opts.style === 'baluster') {
        g = Geo.lathe([[r * 0.7, 0], [r * 1.5, h * 0.12], [r * 0.8, h * 0.42],
        [r * 1.35, h * 0.68], [r * 0.75, h * 0.9], [r * 1.1, h]], 6);
      } else {
        g = new T.CylinderGeometry(r, r, h, 5);
        g.translate(0, h / 2, 0);
      }
      g.translate(x, 0, 0);
      parts.push(g);
    }
    const top = new T.BoxGeometry(len, h * 0.075, r * 3.4); top.translate(0, h, 0); parts.push(top);
    if (opts.style !== 'bar') {
      const mid = new T.BoxGeometry(len, h * 0.05, r * 2.6); mid.translate(0, h * 0.45, 0); parts.push(mid);
    }
    return Geo.mergeGeometries(parts);
  };

  /**
   * retainingWall(plan, height, opts) — a battered stone wall following a
   * polyline, with a coping course on top. Defines the terrace edges.
   * plan: [[x,z],...] polyline (open), returns merged geometry.
   */
  Geo.retainingWall = function (plan, height, opts) {
    opts = opts || {};
    const th = opts.thick || 0.55;
    const batter = opts.batter === undefined ? 0.14 : opts.batter;
    const parts = [];
    for (let i = 0; i < plan.length - 1; i++) {
      const a = plan[i], b = plan[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.001) continue;
      const ang = Math.atan2(dz, dx);
      const g = Geo.taperBox(len + th, height, th, 1, 1 - batter);
      const m = new T.Matrix4().makeRotationY(-ang);
      g.applyMatrix4(m);
      g.translate((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
      parts.push(g);
      // coping
      const c = new T.BoxGeometry(len + th * 1.6, 0.16, th * 1.35);
      c.applyMatrix4(new T.Matrix4().makeRotationY(-ang));
      c.translate((a[0] + b[0]) / 2, height + 0.08, (a[1] + b[1]) / 2);
      parts.push(c);
    }
    return Geo.mergeGeometries(parts);
  };

  /* ============================================================
     6 · paths, ribbons, tracks  (roads, rails, streams)
     ============================================================ */

  /**
   * ribbon(points, width, opts) — a flat strip following a polyline.
   * points: [[x,y,z],...]. opts.taperEnds, opts.lift
   * Used for roads, pavements, rails, stream beds.
   */
  Geo.ribbon = function (points, width, opts) {
    opts = opts || {};
    const n = points.length;
    if (n < 2) return new T.BufferGeometry();
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[2] - a[2];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const nx = -dz, nz = dx;
      let w = width / 2;
      if (opts.widthFn) w = opts.widthFn(i / (n - 1)) / 2;
      left.push([p[0] + nx * w, p[1], p[2] + nz * w]);
      right.push([p[0] - nx * w, p[1], p[2] - nz * w]);
    }
    const verts = [], faces = [];
    for (let i = 0; i < n; i++) { verts.push(left[i]); verts.push(right[i]); }
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 3, d = a + 2;
      faces.push([a, b, c, d]);
    }
    const g = Geo.fromQuads(verts, faces);
    // proper UV along the strip so dashed markings can be textured
    const uv = [];
    const posCount = g.attributes.position.count;
    for (let i = 0; i < posCount; i++) uv.push(0, 0);
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    return g;
  };

  /**
   * catmullPath(pts, closed, samples) — THREE.CatmullRomCurve3 helper
   * returning both the curve and a sampled polyline.
   */
  Geo.catmullPath = function (pts, closed, samples) {
    const vs = pts.map((p) => new T.Vector3(p[0], p[1] === undefined ? 0 : p[1], p[2] === undefined ? p[1] : p[2]));
    const curve = new T.CatmullRomCurve3(vs, !!closed, 'catmullrom', 0.5);
    const poly = curve.getSpacedPoints(samples || 128).map((v) => [v.x, v.y, v.z]);
    return { curve, poly };
  };

  /**
   * tube(points, radius, radialSeg) — pipes, cables, branches, ropes.
   */
  Geo.tube = function (points, radius, radialSeg, closed) {
    const vs = points.map((p) => new T.Vector3(p[0], p[1], p[2]));
    const curve = new T.CatmullRomCurve3(vs, !!closed);
    return new T.TubeGeometry(curve, Math.max(8, vs.length * 3), radius, radialSeg || 5, !!closed);
  };

  /** catenary cable between two points (power lines, cable car, bunting) */
  Geo.catenary = function (a, b, sag, radius, seg) {
    seg = seg || 10;
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const x = U.lerp(a[0], b[0], t), z = U.lerp(a[2], b[2], t);
      const y = U.lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag;
      pts.push([x, y, z]);
    }
    return { geo: Geo.tube(pts, radius || 0.03, 4), pts };
  };

  /** signedVolume(geo) — >0 means outward-facing winding for a closed solid */
  Geo.signedVolume = function (geo) {
    const p = geo.attributes.position;
    if (!p) return 0;
    const idx = geo.index ? geo.index.array : null;
    const a = p.array;
    const n = idx ? idx.length : p.count;
    let v = 0;
    for (let i = 0; i + 2 < n; i += 3) {
      const i0 = (idx ? idx[i] : i) * 3, i1 = (idx ? idx[i + 1] : i + 1) * 3, i2 = (idx ? idx[i + 2] : i + 2) * 3;
      const ax = a[i0], ay = a[i0 + 1], az = a[i0 + 2];
      const bx = a[i1], by = a[i1 + 1], bz = a[i1 + 2];
      const cx = a[i2], cy = a[i2 + 1], cz = a[i2 + 2];
      v += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
    }
    return v;
  };

  /** reverseWinding(geo) — flip every triangle in place */
  Geo.reverseWinding = function (geo) {
    if (geo.index) {
      const ix = geo.index.array;
      for (let i = 0; i + 2 < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
      geo.index.needsUpdate = true;
    } else {
      for (const name of ['position', 'normal', 'uv', 'color']) {
        const at = geo.attributes[name];
        if (!at) continue;
        const arr = at.array, k = at.itemSize;
        for (let t = 0; t + 2 < at.count; t += 3) {
          for (let c = 0; c < k; c++) {
            const i1 = (t + 1) * k + c, i2 = (t + 2) * k + c;
            const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
          }
        }
        at.needsUpdate = true;
      }
    }
    geo.computeVertexNormals();
    return geo;
  };

  /**
   * repairOrientation(root) — walk a subtree and flip any closed solid whose
   * winding is inverted (negative signed volume relative to its own bounds).
   * A safety net: a single mis-wound mesh renders as a hole in the model, and
   * this catches it no matter which module produced it. Geometry is deduped
   * by uuid so shared/cached geometry is never flipped twice.
   */
  Geo.repairOrientation = function (root, seen) {
    seen = seen || new Set();
    let checked = 0, fixed = 0;
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const g = o.geometry;
      if (seen.has(g.uuid)) return;
      seen.add(g.uuid);
      const p = g.attributes.position;
      if (p.count < 12) return;                 // too small to be a solid
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox;
      const bv = Math.max(1e-6, (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y) * (bb.max.z - bb.min.z));
      const v = Geo.signedVolume(g);
      checked++;
      if (v < 0 && Math.abs(v) > bv * 0.04) { Geo.reverseWinding(g); fixed++; }
    });
    return { checked, fixed, seen };
  };

  /* ============================================================
     7 · merging — collapse static detail into few draw calls
     ============================================================ */

  /**
   * mergeGeometries(list) — merges non-indexed position/normal/uv/color.
   * (three's BufferGeometryUtils lives in examples/, which the UMD
   *  build does not ship, so this is a compact local equivalent.)
   */
  Geo.mergeGeometries = function (list) {
    const geos = list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
    if (!geos.length) return new T.BufferGeometry();
    if (geos.length === 1) return geos[0];
    let total = 0;
    let anyColor = false;
    for (const g of geos) {
      total += g.attributes.position.count;
      if (g.attributes.color) anyColor = true;
    }
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const uv = new Float32Array(total * 2);
    const col = anyColor ? new Float32Array(total * 3) : null;
    let o = 0;
    for (const g of geos) {
      if (!g.attributes.normal) g.computeVertexNormals();
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3);
      nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), o * 2);
      if (col) {
        if (g.attributes.color) col.set(g.attributes.color.array.subarray(0, c * 3), o * 3);
        else for (let i = 0; i < c * 3; i++) col[o * 3 + i] = 1;
      }
      o += c;
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    if (col) out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return out;
  };

  /**
   * mergeStatic(root, opts) — walk a subtree, bake every static mesh
   * (userData.dynamic !== true) into one mesh per material, keeping
   * dynamic children in place. Returns the same root, restructured.
   *
   * This is what lets a building be authored as 60 friendly little
   * parts and still cost ~4 draw calls.
   */
  Geo.mergeStatic = function (root, opts) {
    opts = opts || {};
    root.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map();
    const doomed = [];

    root.traverse((o) => {
      if (o === root) return;
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
      if (o.userData.dynamic) return;
      // if any ancestor is dynamic, leave it alone
      let p = o.parent, dyn = false;
      while (p && p !== root) { if (p.userData.dynamic) { dyn = true; break; } p = p.parent; }
      if (dyn) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.length > 1) return;                 // multi-material: skip
      const mat = mats[0];
      if (!mat || mat.transparent && opts.skipTransparent !== false) {
        if (mat && mat.transparent) return;        // keep glass sorted separately
      }
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      const m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(m);
      const key = mat.uuid;
      if (!buckets.has(key)) buckets.set(key, { mat, geos: [] });
      buckets.get(key).geos.push(g);
      doomed.push(o);
    });

    if (!buckets.size) return root;
    for (const o of doomed) if (o.parent) o.parent.remove(o);

    for (const { mat, geos } of buckets.values()) {
      const merged = Geo.mergeGeometries(geos);
      const mesh = new T.Mesh(merged, mat);
      mesh.castShadow = opts.castShadow !== false;
      mesh.receiveShadow = opts.receiveShadow !== false;
      mesh.name = 'merged_' + (mat.name || 'mat');
      root.add(mesh);
    }
    // prune emptied groups
    const prune = (node) => {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const c = node.children[i];
        prune(c);
        if (c.isGroup && c.children.length === 0 && !c.userData.dynamic && !c.userData.keep) node.remove(c);
      }
    };
    prune(root);
    return root;
  };

  /**
   * instanced(geo, mat, transforms) -> InstancedMesh
   * transforms: [{p:[x,y,z], r:[rx,ry,rz]|ry, s:[sx,sy,sz]|s, c:hex}]
   */
  Geo.instanced = function (geo, mat, transforms, opts) {
    opts = opts || {};
    const n = transforms.length;
    const im = new T.InstancedMesh(geo, mat, Math.max(n, 1));
    const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    const pos = new T.Vector3(), scl = new T.Vector3();
    let useColor = false;
    for (const t of transforms) if (t.c !== undefined) useColor = true;
    if (useColor) {
      im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(Math.max(n, 1) * 3), 3);
    }
    const col = new T.Color();
    for (let i = 0; i < n; i++) {
      const t = transforms[i];
      pos.set(t.p[0], t.p[1], t.p[2]);
      if (Array.isArray(t.r)) e.set(t.r[0], t.r[1], t.r[2]);
      else e.set(0, t.r || 0, 0);
      q.setFromEuler(e);
      if (Array.isArray(t.s)) scl.set(t.s[0], t.s[1], t.s[2]);
      else { const s = t.s === undefined ? 1 : t.s; scl.set(s, s, s); }
      m.compose(pos, q, scl);
      im.setMatrixAt(i, m);
      if (useColor) { col.set(t.c === undefined ? 0xffffff : t.c); im.setColorAt(i, col); }
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = opts.castShadow !== false;
    im.receiveShadow = opts.receiveShadow !== false;
    im.frustumCulled = opts.frustumCulled !== false;
    im.userData.dynamic = true;   // instanced meshes must survive merging
    if (n === 0) im.visible = false;
    return im;
  };

  /* ============================================================
     8 · misc helpers
     ============================================================ */

  /** applyVertexNoise(geo, amp, freq, noise) — organic wobble */
  Geo.applyVertexNoise = function (geo, amp, freq, noise) {
    noise = noise || TOWN.noise;
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = noise.fbm(x * freq, z * freq, 3);
      const n2 = noise.fbm(x * freq + 31.2, y * freq + 7.7, 2);
      p.setXYZ(i, x + n * amp, y + n2 * amp * 0.6, z + n2 * amp);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  };

  /** paint(geo, colorFn) — bake per-vertex colours (used for terrain) */
  Geo.paint = function (geo, colorFn) {
    const p = geo.attributes.position;
    const arr = new Float32Array(p.count * 3);
    const c = new T.Color();
    for (let i = 0; i < p.count; i++) {
      colorFn(c, p.getX(i), p.getY(i), p.getZ(i), i);
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(arr, 3));
    return geo;
  };

  /** translated clone of a geometry (helper for building part kits) */
  Geo.at = function (geo, x, y, z, ry) {
    const g = geo.clone();
    if (ry) g.applyMatrix4(new T.Matrix4().makeRotationY(ry));
    g.translate(x || 0, y || 0, z || 0);
    return g;
  };

  /** bounding size of an object3D */
  Geo.sizeOf = function (obj) {
    const b = new T.Box3().setFromObject(obj);
    const s = new T.Vector3();
    b.getSize(s);
    return { size: s, box: b };
  };

  console.log('[TOWN] geo ready');
})(window);
