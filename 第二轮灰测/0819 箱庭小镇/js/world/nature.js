/* =============================================================
   nature.js — TOWN.Nature
   Vegetation, rocks and ground cover for the 箱庭 diorama town.

   Design notes (read before integrating)
   --------------------------------------
   * Every factory: f(opts) -> THREE.Group, origin at the trunk base /
     footprint centre on y = 0, +Z is "front". Sets
     userData.footprint{w,d}, userData.height, userData.kind.
     opts is always defaulted, opts.seed drives ALL randomness.
   * ANTI-CUBE: not a single BoxGeometry in this file. Trunks are lathes,
     canopies are noise-deformed icosahedra, rocks are noise-deformed
     icosahedra, hedges are jittered prisms + vertex noise, cones are
     hand-built with per-angle radius jitter.
   * GEOMETRY CACHE: every geometry is built once into `GC` (module-level
     Map, keyed by rounded params) and shared by every instance; factories
     only create Meshes + transforms. That is what makes ~150 tree calls
     from the layout cheap (120 x treeBroad ≈ 18 ms measured).
   * LOD: every tree factory accepts `opts.lod` (0 = full detail, default;
     1 = cheap version, ~60–110 tris, no branches/bark dashes/fruit).
     treeCluster and windbreak use lod 1 so a whole copse stays under 900.
   * INSTANCING: leaves, blooms, blades, gravel, shells, bark dashes,
     cabbages, firewood — anything repeated > 12 times — goes through
     Geo.instanced.
   * ≤ 24 shared materials for the whole module (see `M` below).
   * FOOTPRINT is measured from the real bounding box, with the authored
     area (or the crown diameter) acting as a 0.75x floor so a scatter
     patch never under-reserves ground. Always within 25 % of the AABB.
   * GROUND: everything is lifted so minY >= 0 EXCEPT the deliberately
     half-buried mineral props — rock/rockCluster/cliffRocks −0.20…−0.26,
     driftwood −0.07, treeCluster −0.23 (its rocks). Never below −0.3.
   * Crowns are hung so the tree top lands exactly on the target height
     AND the crown base always bites into the trunk/branches (see
     hangCanopy) — no floating green blobs.

   Integration helpers
   -------------------
   TOWN.Nature.variants(kind, n, seed) -> [Group x n]
       Pre-built, cached variant groups for the layout to `.clone()`.
       Cloning is the cheapest way to place hundreds of trees (150 clones
       ≈ 20 ms); three's Object3D.copy() deep-copies userData via JSON, so
       footprint / height / kind / petalAnchor all survive the clone (that
       is also why no Object3D is ever stored in userData — JSON.stringify
       on an Object3D throws on the circular parent/children refs).
   TOWN.Nature.sway(obj, {amount, speed, seed})
       Registers obj (or its child named 'canopy', which every tree has)
       with ONE shared ticker that gently rotates it. Call it on the
       placed tree/clone; it marks only the canopy dynamic so the trunk
       still gets baked by the static merger. 150 registered trees cost
       ≈ 0.03 ms/frame in total.
   TOWN.Nature.kinds        — the 9 tree factory names, for random picking.
   TOWN.Nature.materials    — the 24 shared materials, by short name.
   TOWN.Nature.stats()      — {materials, cachedGeometries, swaying}.
   ============================================================= */
(function (global) {
  'use strict';

  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U, Geo = TOWN.Geo, Mat = TOWN.Mat, P = TOWN.Palette;
  const TAU = U.TAU;

  const Nature = TOWN.Nature = {};

  /* ==========================================================
     0 · materials — 24 shared, flat-shaded for the crafted look
     ========================================================== */
  const DS = T.DoubleSide;
  const M = {
    // wood
    bark: Mat.std(P.bark, { flat: true, rough: 0.92, name: 'nat_bark' }),
    barkLt: Mat.std(P.barkLight, { flat: true, rough: 0.9, name: 'nat_barkLt' }),
    woodDk: Mat.std(P.woodDark, { flat: true, rough: 0.88, name: 'nat_woodDk' }),
    pale: Mat.std(P.offWhite, { flat: true, rough: 0.82, name: 'nat_pale' }),
    // foliage
    spring: Mat.std(P.leafSpring, { flat: true, rough: 0.86, name: 'nat_spring' }),
    deep: Mat.std(P.leafDeep, { flat: true, rough: 0.86, name: 'nat_deep' }),
    lime: Mat.std(P.leafLime, { flat: true, rough: 0.86, name: 'nat_lime' }),
    olive: Mat.std(P.leafOlive, { flat: true, rough: 0.86, name: 'nat_olive' }),
    pine: Mat.std(P.leafPine, { flat: true, rough: 0.86, name: 'nat_pine' }),
    pineDk: Mat.std(P.leafPineDark, { flat: true, rough: 0.86, name: 'nat_pineDk' }),
    autumn: Mat.std(P.leafAutumn, { flat: true, rough: 0.86, name: 'nat_autumn' }),
    rust: Mat.std(P.leafRust, { flat: true, rough: 0.86, name: 'nat_rust' }),
    pink: Mat.std(P.leafPink, { flat: true, rough: 0.8, name: 'nat_pink' }),
    hedge: Mat.std(P.hedge, { flat: true, rough: 0.9, name: 'nat_hedge' }),
    // thin blades — double sided so 3-triangle tufts read from any angle
    grass: Mat.std(P.grass, { flat: true, rough: 0.9, side: DS, name: 'nat_grass' }),
    grassDk: Mat.std(P.grassDark, { flat: true, rough: 0.9, side: DS, name: 'nat_grassDk' }),
    grassDry: Mat.std(P.grassDry, { flat: true, rough: 0.9, side: DS, name: 'nat_grassDry' }),
    // mineral / earth
    rock: Mat.std(P.rock, { flat: true, rough: 0.95, name: 'nat_rock' }),
    rockDk: Mat.std(P.rockDark, { flat: true, rough: 0.95, name: 'nat_rockDk' }),
    soil: Mat.std(P.soil, { flat: true, rough: 1, name: 'nat_soil' }),
    soilDk: Mat.std(P.soilDark, { flat: true, rough: 1, name: 'nat_soilDk' }),
    // accents
    red: Mat.std(P.flowerRed, { flat: true, rough: 0.7, name: 'nat_red' }),
    yellow: Mat.std(P.flowerYellow, { flat: true, rough: 0.7, name: 'nat_yellow' }),
    terra: Mat.std(P.wallTerra, { flat: true, rough: 0.85, name: 'nat_terra' }),
  };
  Nature.materials = M;

  /** map a requested bloom colour onto one of the shared materials */
  function bloomMat(hex) {
    if (hex === undefined || hex === P.flowerRed) return M.red;
    if (hex === P.flowerYellow || hex === P.flowerOrange) return M.yellow;
    if (hex === P.leafPink || hex === P.flowerPink) return M.pink;
    if (hex === P.flowerWhite || hex === P.offWhite || hex === P.white) return M.pale;
    return Mat.std(hex, { flat: true, rough: 0.7 });   // caller-supplied colour
  }

  /* ==========================================================
     1 · geometry cache + shared unit geometries
     ========================================================== */
  const GC = new Map();
  function gcache(key, build) {
    let g = GC.get(key);
    if (!g) { g = build(); GC.set(key, g); }
    return g;
  }
  Nature.geoCache = GC;

  const NS = [];
  function nz(i) {
    i = ((i | 0) % 8 + 8) % 8;
    if (!NS[i]) NS[i] = TOWN.makeNoise(9101 + i * 137);
    return NS[i];
  }

  /**
   * rng(seed) — U.rng with the seed avalanched first.
   * mulberry32's FIRST output is strongly correlated for small sequential
   * seeds (U.rng(1)()…U.rng(6)() all land in 0.52…0.93) and the layout
   * hands out seeds 1,2,3,… — without this every tree came out tall.
   * Still 100 % deterministic, still U.rng underneath.
   */
  function rng(seed) {
    let s = (seed | 0) || 0x5bf03635;
    s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d);
    s ^= s >>> 12;
    s = Math.imul(s ^ (s >>> 16), 0x297a2d39);
    return U.rng(s | 0);
  }
  Nature.rng = rng;

  /** unit foliage blob: noise-deformed icosahedron, r≈1, 20 tris */
  function blobGeo(i) {
    i = ((i | 0) % 8 + 8) % 8;
    return gcache('blob' + i, function () {
      const g = new T.IcosahedronGeometry(1, 0);
      g.applyMatrix4(new T.Matrix4().makeRotationY(i * 0.83));
      g.applyMatrix4(new T.Matrix4().makeRotationZ(0.21 + i * 0.37));
      Geo.applyVertexNoise(g, 0.24, 0.85, nz(i));
      return g;
    });
  }

  /** unit boulder: harsher noise, more angular, 20 tris */
  function rockGeo(i) {
    i = ((i | 0) % 6 + 6) % 6;
    return gcache('rock' + i, function () {
      const g = new T.IcosahedronGeometry(1, 0);
      g.applyMatrix4(new T.Matrix4().makeRotationY(i * 1.13));
      g.applyMatrix4(new T.Matrix4().makeRotationX(i * 0.53));
      Geo.applyVertexNoise(g, 0.36, 1.55, nz(i + 3));
      return g;
    });
  }

  /* trunk profiles: radius in units of the base radius, y in 0..1 */
  const TRUNKS = [
    [[1.45, 0], [1.05, 0.05], [0.86, 0.28], [0.66, 0.62], [0.44, 1]],
    [[1.62, 0], [1.02, 0.06], [0.80, 0.34], [0.72, 0.66], [0.40, 1]],
    [[1.30, 0], [0.98, 0.04], [0.74, 0.40], [0.50, 1]],
    [[1.55, 0], [1.00, 0.05], [0.62, 0.50], [0.30, 1]],
    [[1.22, 0], [0.95, 0.08], [0.55, 1]],
  ];
  /** unit trunk (h = 1, base radius = 1) with a root flare */
  function trunkGeo(v, sides) {
    v = ((v | 0) % TRUNKS.length + TRUNKS.length) % TRUNKS.length;
    sides = sides || 6;
    return gcache('trunk' + v + '_' + sides, function () { return Geo.lathe(TRUNKS[v], sides); });
  }

  /** unit branch: Geo.tube along a short rising curve, tip at (1,0.85,~0) */
  function branchGeo(i) {
    i = ((i | 0) % 4 + 4) % 4;
    return gcache('branch' + i, function () {
      const r = rng(517 + i * 29);
      const pts = [
        [0, 0, 0],
        [0.46, 0.30 + r.range(0, 0.14), r.bell() * 0.1],
        [1, 0.85, r.bell() * 0.18],
      ];
      return Geo.tube(pts, 0.085, 3);
    });
  }

  /** unit conifer layer: base ring r≈1 at y=0, apex at y=1, jittered ring */
  function coneGeo(i, droop) {
    i = ((i | 0) % 5 + 5) % 5;
    return gcache('cone' + i + (droop ? 'd' : ''), function () {
      const r = rng(721 + i * 13);
      const sides = 7, v = [], f = [];
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * TAU;
        const rr = 1 + r.bell() * 0.2;
        const y = droop ? -0.16 * (0.35 + Math.abs(r.bell())) : r.bell() * 0.03;
        v.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
      }
      v.push([r.bell() * 0.07, 1, r.bell() * 0.07]);         // apex
      const apex = v.length - 1;
      v.push([0, droop ? -0.05 : 0.03, 0]);                  // base centre
      const bc = v.length - 1;
      for (let k = 0; k < sides; k++) {
        const j = (k + 1) % sides;
        f.push([k, j, apex]);
        f.push([j, k, bc]);
      }
      return Geo.fromQuads(v, f);
    });
  }

  /** unit cypress spindle: y 0..1, max radius 1 */
  function spindleGeo(i, low) {
    i = ((i | 0) % 3 + 3) % 3;
    return gcache('spindle' + i + (low ? 'L' : ''), function () {
      const r = rng(311 + i * 71);
      const steps = low ? 5 : 7, sides = low ? 5 : 6, pts = [];
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        let rr = Math.sin(Math.pow(t, 0.55) * Math.PI * 0.94);
        rr = Math.max(0.05, rr * (1 + r.bell() * 0.18));
        pts.push([rr, t]);
      }
      pts[0][0] = 0.3;
      const g = Geo.lathe(pts, sides);
      Geo.applyVertexNoise(g, 0.05, 2.3, nz(i + 5));
      return g;
    });
  }

  /** unit palm frond: rib along +X (length 1), drooping, 24 tris */
  function frondGeo(i) {
    i = ((i | 0) % 3 + 3) % 3;
    return gcache('frond' + i, function () {
      const r = rng(883 + i * 37);
      const seg = 6, v = [], f = [];
      for (let k = 0; k <= seg; k++) {
        const t = k / seg;
        const ry = Math.sin(t * 2.0) * 0.2 - Math.pow(t, 2.4) * 0.66;
        const w = Math.max(0.025, Math.sin(Math.pow(t, 0.7) * Math.PI * 0.95) * 0.2 *
          (1 + r.bell() * 0.14) * (1 - t * 0.3));
        v.push([t, ry, 0]);
        v.push([t * 0.98, ry - w * 0.22, w]);
        v.push([t * 0.98, ry - w * 0.22, -w]);
      }
      for (let k = 0; k < seg; k++) {
        const a = k * 3, b = (k + 1) * 3;
        f.push([a, b, b + 1, a + 1]);
        f.push([a + 2, b + 2, b, a]);
      }
      return Geo.fromQuads(v, f);
    });
  }

  /** unit palm trunk: Geo.tube along an arc, faceted rings, height 1 */
  function palmTrunkGeo(i) {
    i = ((i | 0) % 3 + 3) % 3;
    return gcache('palmTrunk' + i, function () {
      const r = rng(957 + i * 23);
      const bend = 0.16 + r.range(0, 0.16), sgn = (i % 2) ? -1 : 1;
      const pts = [];
      for (let k = 0; k <= 2; k++) {
        const t = k / 2;
        pts.push([sgn * bend * t * t, t, sgn * bend * 0.3 * t * t]);
      }
      return Geo.tube(pts, 0.08, 5);
    });
  }

  /** grass/reed tuft: 3 tapered blades in a star, unit height, 3 tris */
  function bladeGeo() {
    return gcache('blade', function () {
      const v = [], f = [];
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI / 3, dx = Math.cos(a), dz = Math.sin(a);
        const bw = 0.085, bend = (k === 1 ? -0.2 : 0.16);
        const b = v.length;
        v.push([-dx * bw, 0, -dz * bw], [dx * bw, 0, dz * bw],
          [dx * bend, 1, dz * bend]);
        f.push([b, b + 1, b + 2]);
      }
      return Geo.fromQuads(v, f);
    });
  }

  /** tiny leaf / gravel chip, 4 tris */
  function chipGeo() { return gcache('chip', function () { return new T.TetrahedronGeometry(1, 0); }); }
  /** small bloom / fruit / cabbage, 8 tris */
  function budGeo() { return gcache('bud', function () { return new T.OctahedronGeometry(1, 0); }); }
  /** flat disc facing +Y (lily pad, cut face, pot soil), 6 tris */
  function discGeo() {
    return gcache('disc', function () { const g = new T.CircleGeometry(1, 6); g.rotateX(-Math.PI / 2); return g; });
  }
  /** thin quad facing +Z (birch dashes), 2 tris */
  function dashGeo() { return gcache('dash', function () { return new T.PlaneGeometry(1, 1); }); }
  /** log along X: 6-sided, unit length & radius, 24 tris */
  function logGeo() {
    return gcache('log', function () {
      const g = new T.CylinderGeometry(1, 0.92, 1, 6, 1);
      g.rotateZ(Math.PI / 2);
      return g;
    });
  }
  /** log along Z (firewood ends face +Z), 20 tris */
  function logZGeo() {
    return gcache('logZ', function () {
      const g = new T.CylinderGeometry(1, 0.95, 1, 5, 1);
      g.rotateX(Math.PI / 2);
      return g;
    });
  }
  /** terracotta pot, unit height & radius */
  function potGeo() {
    return gcache('pot', function () {
      return Geo.lathe([[0.62, 0], [0.78, 0.12], [0.92, 0.78], [1, 0.86], [1, 1], [0.86, 0.96]], 7);
    });
  }
  /** stump: flared, unit height & base radius */
  function stumpGeo(i) {
    i = ((i | 0) % 2 + 2) % 2;
    return gcache('stump' + i, function () {
      const g = Geo.lathe(i ? [[1.5, 0], [1.12, 0.16], [0.96, 0.6], [0.9, 1]]
        : [[1.62, 0], [1.05, 0.22], [0.92, 1]], 7);
      Geo.applyVertexNoise(g, 0.05, 1.6, nz(i + 1));
      return g;
    });
  }

  /* ==========================================================
     2 · small helpers
     ========================================================== */

  /**
   * stamp(g, kind, fp, lift) — contract userData from the real bounding box.
   * Cheap: geometry bounding boxes are computed once per cached geometry.
   * `lift` nudges the whole group up so nothing dips under the ground
   * (leaning trunks and tilted blades otherwise poke ~5 cm below y = 0);
   * rocks deliberately skip it so they stay half-buried.
   * `fp` is a *floor* for the reported footprint (the authored area, or a
   * rotation-invariant crown diameter): the value reported is
   * max(measured, 0.75 * fp) so it never under-reserves space for a
   * scatter patch yet always stays within 25 % of the real bounding box.
   */
  function stamp(g, kind, fp, lift) {
    const b = new T.Box3().setFromObject(g);
    let w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y;
    if (lift && isFinite(b.min.y) && b.min.y < -0.004) {
      const dy = -b.min.y;
      for (let i = 0; i < g.children.length; i++) g.children[i].position.y += dy;
      h += dy;
    }
    if (!isFinite(w) || w <= 0) w = 0.2;
    if (!isFinite(d) || d <= 0) d = 0.2;
    if (!isFinite(h) || h <= 0) h = 0.2;
    if (fp) {
      if (fp.w) w = Math.max(w, fp.w * 0.75);
      if (fp.d) d = Math.max(d, fp.d * 0.75);
    }
    g.userData.footprint = { w: +w.toFixed(3), d: +d.toFixed(3) };
    g.userData.height = +h.toFixed(3);
    g.userData.kind = kind;
    return g;
  }

  /** sit an object on the ground: shift so its lowest point is at -sink */
  function sit(obj, sink) {
    const b = new T.Box3().setFromObject(obj);
    if (isFinite(b.min.y)) obj.position.y += -(sink || 0) - b.min.y;
    return obj;
  }

  /**
   * cells(r, n, w, d, jit) — n jittered positions covering a w x d area.
   * Stratified (shuffled grid cells) + bell jitter: even coverage, zero
   * grid look, deterministic, O(n) — used by every scatter factory.
   */
  function cells(r, n, w, d, jit) {
    n = Math.max(1, n | 0);
    const ar = Math.max(0.15, w / Math.max(d, 0.001));
    let cx = Math.max(1, Math.round(Math.sqrt(n * ar)));
    let cz = Math.max(1, Math.ceil(n / cx));
    const list = [];
    for (let i = 0; i < cx; i++) for (let j = 0; j < cz; j++) list.push([i, j]);
    r.shuffle(list);
    const sw = w / cx, sd = d / cz, jj = jit === undefined ? 0.45 : jit;
    const out = [];
    for (let k = 0; k < n; k++) {
      const c = list[k % list.length];
      out.push([-w / 2 + sw * (c[0] + 0.5) + r.bell() * sw * jj,
        -d / 2 + sd * (c[1] + 0.5) + r.bell() * sd * jj]);
    }
    return out;
  }

  /** blue-noise-ish points inside a disc of radius R (rejection, best-of-k) */
  function discPoints(r, n, R, minD) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      let bx = 0, bz = 0, best = -1;
      for (let k = 0; k < 10; k++) {
        const a = r.range(0, TAU), rr = R * Math.sqrt(r.range(0.02, 1));
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        let dm = 1e9;
        for (let j = 0; j < pts.length; j++) {
          const dx = pts[j][0] - x, dz = pts[j][1] - z;
          const dd = dx * dx + dz * dz;
          if (dd < dm) dm = dd;
        }
        if (dm > best) { best = dm; bx = x; bz = z; }
        if (dm > minD * minD) break;
      }
      pts.push([bx, bz]);
    }
    return pts;
  }

  /** clumped scatter: nClump centres, blades gathered around each */
  function clumps(r, count, w, d, nClump, spread) {
    const cs = cells(r, Math.max(1, nClump), w, d, 0.5);
    const out = [];
    for (let i = 0; i < count; i++) {
      const c = cs[i % cs.length];
      const rr = spread * (0.25 + Math.abs(r.bell()));
      const a = r.range(0, TAU);
      out.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, i % cs.length]);
    }
    return out;
  }

  /**
   * blobCrown(parent, r, o) — overlapping deformed blobs around local y = 0.
   * o: {n, rx, ry, matA (lit/lighter), matB (shade), matC (accent),
   *     spread, vseed, squash, flatten}
   * Irregular silhouette: one big blob + satellites at varying heights.
   */
  function blobCrown(parent, r, o) {
    const n = Math.max(1, o.n | 0);
    const rx = o.rx, ry = o.ry === undefined ? rx : o.ry;
    const spread = o.spread === undefined ? 0.62 : o.spread;
    const vs = o.vseed === undefined ? 0 : o.vseed;
    const a0 = r.range(0, TAU);
    let rad = 0, top = -1e9;
    for (let i = 0; i < n; i++) {
      const main = (i === 0 && n > 2);
      const a = a0 + (i / n) * TAU + r.bell() * 0.55;
      const dist = main ? rx * 0.12 * Math.abs(r.bell()) : rx * spread * r.range(0.42, 1);
      const br = main ? rx * r.range(0.6, 0.76) : rx * r.range(0.34, 0.58);
      const px = Math.cos(a) * dist, pz = Math.sin(a) * dist * (o.flatten || 1);
      const py = main ? ry * r.range(0.06, 0.22) : ry * r.range(-0.55, 0.5);
      let mat = (py > ry * 0.02 || px > 0) ? o.matA : o.matB;
      if (o.matC && r.chance(0.22)) mat = o.matC;
      const m = TOWN.mesh(blobGeo(i + vs), mat, px, py, pz);
      const sy = br * (o.squash === undefined ? r.range(0.72, 0.98) : o.squash * r.range(0.88, 1.12));
      m.scale.set(br * r.range(0.9, 1.18), sy, br * r.range(0.9, 1.18));
      m.rotation.set(r.bell() * 0.35, r.range(0, TAU), r.bell() * 0.3);
      parent.add(m);
      rad = Math.max(rad, Math.hypot(px, pz) + Math.max(m.scale.x, m.scale.z) * 1.2);
      top = Math.max(top, py + sy * 1.2);
    }
    return { rad: rad, top: top };
  }

  /**
   * hangCanopy(g, canopy, h, x, z, opts) — hang a crown on a trunk.
   * Guarantees BOTH contract-critical things at once:
   *   1. the highest point of the tree lands exactly on y = h;
   *   2. the crown base actually bites into the woody parts already added
   *      to g — otherwise slim crowns hover in mid-air above the trunk.
   * If the crown is too shallow to reach the wood it is stretched
   * downwards (up to opts.sMax; the blobs are noise-deformed already, so
   * this just reads as a fuller crown) and, if that is still not enough,
   * opts.trunk is lengthened — its geometry is a unit-height lathe, so
   * that is a free scale change.
   * Returns the crown centre y (used for treeSakura's petalAnchor).
   */
  function hangCanopy(g, canopy, h, x, z, opts) {
    opts = opts || {};
    const lb = new T.Box3().setFromObject(canopy);         // canopy still parentless
    const lo = isFinite(lb.min.y) ? lb.min.y : 0, hi = isFinite(lb.max.y) ? lb.max.y : 0;
    const ext = Math.max(0.05, hi - lo);
    const wood = new T.Box3();
    for (let i = 0; i < g.children.length; i++) wood.expandByObject(g.children[i]);
    const woodTop = isFinite(wood.max.y) ? wood.max.y : 0;
    const wantBase = woodTop - ext * 0.16;                 // overlap, never a seam
    let sy = 1;
    if (h - wantBase > ext) sy = Math.min(opts.sMax === undefined ? 1.5 : opts.sMax, (h - wantBase) / ext);
    canopy.scale.y = sy;
    canopy.position.set(x || 0, h - hi * sy, z || 0);
    const base = canopy.position.y + lo * sy;
    if (opts.trunk && woodTop < base + ext * sy * 0.12) {
      opts.trunk.scale.y += (base + ext * sy * 0.2) - woodTop;
    }
    g.add(canopy);
    return canopy.position.y + (lo + hi) * 0.5 * sy;
  }

  /** a leaning stem group (trunk + branches inherit the lean) */
  function stemGroup(r, lean) {
    const s = TOWN.group('stem');
    s.rotation.z = lean * r.sign() * r.range(0.6, 1);
    s.rotation.x = lean * r.sign() * r.range(0.3, 0.9);
    return s;
  }
  const _v3 = new T.Vector3();
  function stemTip(stem, h) {
    _v3.set(0, h, 0).applyEuler(stem.rotation);
    return _v3;
  }

  /* ==========================================================
     3 · trees
     ========================================================== */

  /**
   * treeBroad({seed, scale, lod}) — h 5.2–8.8.
   * Tapered leaning trunk with a root flare, 3–4 real tube branches,
   * 4–7 deformed blobs at varying heights → irregular crown.
   */
  Nature.treeBroad = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale || 1, lod = o.lod | 0;
    const g = TOWN.group('treeBroad');
    const h = r.range(5.2, 8.8) * s;
    const crownH = h * r.range(0.5, 0.62);
    const trunkH = h - crownH * 0.78;
    const tR = h * r.range(0.046, 0.06);
    const stem = stemGroup(r, 0.055);
    const trunk = TOWN.mesh(trunkGeo(lod ? 4 : r.int(0, 1), lod ? 5 : 6),
      r.chance(0.5) ? M.bark : M.barkLt);
    trunk.scale.set(tR, trunkH, tR);
    stem.add(trunk);
    if (!lod) {
      const nb = r.int(3, 4);
      for (let i = 0; i < nb; i++) {
        const L = trunkH * r.range(0.34, 0.5);
        const b = TOWN.mesh(branchGeo(i), M.bark, 0, trunkH * r.range(0.52, 0.86), 0);
        b.scale.set(L, L * r.range(0.7, 1.05), L);
        b.rotation.y = (i / nb) * TAU + r.bell() * 0.6;
        b.rotation.z = r.bell() * 0.12;
        stem.add(b);
      }
    }
    g.add(stem);
    const tip = stemTip(stem, trunkH * 0.96);
    const canopy = TOWN.group('canopy');
    const cr = blobCrown(canopy, r, {
      n: lod ? 3 : r.int(4, 7), rx: h * r.range(0.21, 0.27), ry: crownH * 0.5,
      matA: M.spring, matB: M.deep, matC: lod ? null : M.lime,
      vseed: r.int(0, 7), spread: 0.66,
    });
    hangCanopy(g, canopy, h, tip.x, tip.z, { trunk: trunk, sMax: 1.4 });
    return stamp(g, 'treeBroad', { w: Math.max(cr.rad * 2, tR * 3), d: Math.max(cr.rad * 2, tR * 3) }, true);
  };

  /**
   * treePine({seed, scale, lod}) — h 6.2–11.6.
   * 5–8 stacked jittered cones, decreasing radius, per-layer rotation,
   * drooping lowest layer, bare trunk at the base.
   */
  Nature.treePine = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale || 1, lod = o.lod | 0;
    const g = TOWN.group('treePine');
    const h = r.range(6.2, 11.6) * s;
    const nL = lod ? r.int(4, 5) : r.int(5, 8);
    const baseR = h * r.range(0.085, 0.115);
    const y0 = h * r.range(0.17, 0.25);
    const tR = h * r.range(0.018, 0.026);
    const trunk = TOWN.mesh(trunkGeo(3, lod ? 5 : 6), M.bark);
    trunk.scale.set(tR, h * 0.66, tR);
    g.add(trunk);
    const canopy = TOWN.group('canopy');
    canopy.position.y = y0 * 0.85;
    let rad = tR * 1.6;
    for (let i = 0; i < nL; i++) {
      const t = nL > 1 ? i / (nL - 1) : 0;
      const ly = U.lerp(y0, h * 0.8, t) - canopy.position.y;
      const lr = baseR * Math.pow(1 - t * 0.92, 0.8) * r.range(0.9, 1.08) + h * 0.006;
      const lh = (h - (ly + canopy.position.y)) * r.range(0.3, 0.44) + 0.25;
      const m = TOWN.mesh(coneGeo(i, i === 0), (i % 2) ? M.pine : M.pineDk, 0, ly, 0);
      m.scale.set(lr, lh, lr * r.range(0.9, 1.1));
      m.rotation.y = r.range(0, TAU);
      m.rotation.z = r.bell() * 0.05;
      canopy.add(m);
      rad = Math.max(rad, lr * 1.25);
    }
    // apex spike reaching the target height
    const apR = baseR * 0.2;
    const ap = TOWN.mesh(coneGeo(2), M.pineDk, 0, h * 0.8 - canopy.position.y, 0);
    ap.scale.set(apR, h * 0.2, apR);
    ap.rotation.y = r.range(0, TAU);
    canopy.add(ap);
    g.add(canopy);
    return stamp(g, 'treePine', { w: rad * 2, d: rad * 2 }, true);
  };

  /**
   * treeCypress({seed, scale, lod}) — h 7–11, w ≤ 1.8. Skyline vertical.
   */
  Nature.treeCypress = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale || 1, lod = o.lod | 0;
    const g = TOWN.group('treeCypress');
    const h = r.range(7, 11) * s;
    const w = r.range(1.0, 1.5) * s;
    const tR = w * 0.075;
    const trunk = TOWN.mesh(trunkGeo(2, 5), M.bark);
    trunk.scale.set(tR, h * 0.3, tR);
    g.add(trunk);
    const canopy = TOWN.group('canopy');
    const sp = TOWN.mesh(spindleGeo(r.int(0, 2), !!lod), r.chance(0.5) ? M.pine : M.deep, 0, 0, 0);
    sp.scale.set(w / 2, h * 0.98, w / 2 * r.range(0.86, 1.05));
    sp.rotation.y = r.range(0, TAU);
    sp.rotation.z = r.bell() * 0.008;      // tiny: a 10 m spindle must stay narrow
    canopy.add(sp);
    if (!lod) {
      const b = TOWN.mesh(blobGeo(r.int(0, 7)), M.pineDk, 0, h * r.range(0.1, 0.2), 0);
      const br = w * r.range(0.24, 0.34);
      b.scale.set(br, br * 1.4, br);
      canopy.add(b);
    }
    canopy.position.y = h * 0.02;
    g.add(canopy);
    return stamp(g, 'treeCypress', { w: w, d: w }, true);
  };

  /**
   * treeBirch({seed, scale, lod}) — h 6–9. Pale slender trunk with
   * instanced dark dashes, airy small canopy.
   */
  Nature.treeBirch = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale || 1, lod = o.lod | 0;
    const g = TOWN.group('treeBirch');
    const h = r.range(6, 9) * s;
    const trunkH = h * r.range(0.62, 0.72);
    const tR = h * r.range(0.024, 0.032);
    const stem = stemGroup(r, 0.05);
    const trunk = TOWN.mesh(trunkGeo(lod ? 4 : 2, 5), M.pale);
    trunk.scale.set(tR, trunkH, tR);
    stem.add(trunk);
    if (!lod) {
      const nd = 16, tr = [];
      for (let i = 0; i < nd; i++) {
        const y = trunkH * (0.06 + 0.86 * (i / nd)) + r.bell() * 0.1;
        const a = r.range(0, TAU);
        const rr = tR * U.lerp(1.25, 0.55, y / trunkH) * 1.02;
        tr.push({
          p: [Math.cos(a) * rr, y, Math.sin(a) * rr],
          r: [0, a + Math.PI / 2, r.bell() * 0.4],
          s: [tR * r.range(0.5, 1.5), tR * r.range(0.35, 0.8), 1],
        });
      }
      stem.add(Geo.instanced(dashGeo(), M.woodDk, tr));
      for (let i = 0; i < 2; i++) {
        const L = trunkH * r.range(0.2, 0.3);
        const b = TOWN.mesh(branchGeo(i + 2), M.pale, 0, trunkH * r.range(0.6, 0.85), 0);
        b.scale.set(L, L * 1.1, L * 0.6);
        b.rotation.y = r.range(0, TAU);
        stem.add(b);
      }
    }
    g.add(stem);
    const tip = stemTip(stem, trunkH * 0.97);
    const canopy = TOWN.group('canopy');
    const cr = blobCrown(canopy, r, {
      n: lod ? 3 : r.int(4, 5), rx: h * r.range(0.15, 0.2), ry: h * 0.16,
      matA: M.lime, matB: M.spring, vseed: r.int(0, 7), spread: 0.85, squash: 0.8,
    });
    hangCanopy(g, canopy, h, tip.x, tip.z, { trunk: trunk, sMax: 1.15 });
    return stamp(g, 'treeBirch', { w: cr.rad * 2, d: cr.rad * 2 }, true);
  };

  /**
   * treeSakura({seed, scale, lod}) — h 4.5–7. Dark twisting trunk,
   * wide spreading pink crown. Sets userData.petalAnchor = crown centre.
   */
  Nature.treeSakura = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale || 1, lod = o.lod | 0;
    const g = TOWN.group('treeSakura');
    const h = r.range(4.5, 7) * s;
    const trunkH = h * r.range(0.36, 0.46);
    const tR = h * r.range(0.05, 0.065);
    const stem = stemGroup(r, 0.12);
    const trunk = TOWN.mesh(trunkGeo(lod ? 4 : 0, lod ? 5 : 6), M.woodDk);
    trunk.scale.set(tR, trunkH, tR);
    stem.add(trunk);
    if (!lod) {
      const nb = r.int(3, 4);
      for (let i = 0; i < nb; i++) {
        const L = trunkH * r.range(0.55, 0.85);
        const b = TOWN.mesh(branchGeo(i), M.woodDk, 0, trunkH * r.range(0.55, 0.9), 0);
        b.scale.set(L, L * r.range(0.5, 0.8), L);
        b.rotation.y = (i / nb) * TAU + r.bell() * 0.7;
        b.rotation.z = r.bell() * 0.25;
        stem.add(b);
      }
    }
    g.add(stem);
    const tip = stemTip(stem, trunkH * 0.95);
    const canopy = TOWN.group('canopy');
    const cr = blobCrown(canopy, r, {
      n: lod ? 4 : r.int(5, 7), rx: h * r.range(0.3, 0.38), ry: h * 0.14,
      matA: M.pink, matB: M.pink, matC: M.pale, vseed: r.int(0, 7),
      spread: 0.8, squash: 0.6,
    });
    const cy = hangCanopy(g, canopy, h, tip.x, tip.z, { trunk: trunk, sMax: 1.55 });
    g.userData.petalAnchor = [+tip.x.toFixed(3), +(cy).toFixed(3), +tip.z.toFixed(3)];
    return stamp(g, 'treeSakura', { w: cr.rad * 2, d: cr.rad * 2 }, true);
  };

  /** treeAutumn({seed, scale, lod}) — h 5–8, mixed autumn/rust crown. */
  Nature.treeAutumn = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale || 1, lod = o.lod | 0;
    const g = TOWN.group('treeAutumn');
    const h = r.range(5, 8) * s;
    const crownH = h * r.range(0.48, 0.6);
    const trunkH = h - crownH * 0.8;
    const tR = h * r.range(0.045, 0.058);
    const stem = stemGroup(r, 0.06);
    const trunk = TOWN.mesh(trunkGeo(lod ? 4 : 1, lod ? 5 : 6), M.barkLt);
    trunk.scale.set(tR, trunkH, tR);
    stem.add(trunk);
    if (!lod) {
      for (let i = 0; i < 3; i++) {
        const L = trunkH * r.range(0.3, 0.46);
        const b = TOWN.mesh(branchGeo(i + 1), M.barkLt, 0, trunkH * r.range(0.55, 0.88), 0);
        b.scale.set(L, L * r.range(0.7, 1), L);
        b.rotation.y = (i / 3) * TAU + r.bell() * 0.7;
        stem.add(b);
      }
    }
    g.add(stem);
    const tip = stemTip(stem, trunkH * 0.96);
    const canopy = TOWN.group('canopy');
    const cr = blobCrown(canopy, r, {
      n: lod ? 3 : r.int(4, 6), rx: h * r.range(0.22, 0.28), ry: crownH * 0.5,
      matA: M.autumn, matB: M.rust, matC: lod ? null : M.yellow,
      vseed: r.int(0, 7), spread: 0.7,
    });
    hangCanopy(g, canopy, h, tip.x, tip.z, { trunk: trunk, sMax: 1.45 });
    return stamp(g, 'treeAutumn', { w: cr.rad * 2, d: cr.rad * 2 }, true);
  };

  /**
   * treePalm({seed, scale, lod}) — h 5–8. Curved tube trunk (faceted so
   * the segments read as rings), 7–11 drooping tapered fronds with a
   * mid-rib, small coconuts. Fronds use the double-sided grass materials
   * so they read from below too.
   */
  Nature.treePalm = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale || 1, lod = o.lod | 0;
    const g = TOWN.group('treePalm');
    const h = r.range(5, 8) * s;
    const fl = h * r.range(0.3, 0.4);                 // frond length
    const tR = h * r.range(0.055, 0.07);
    const tv = r.int(0, 2);
    // build the crown first: the fronds arc above their root by an amount
    // that depends on their droop, so measure it and back the trunk off by
    // exactly that much — the finished palm then measures h.
    const canopy = TOWN.group('canopy');
    const nF = lod ? 5 : r.int(7, 11);
    for (let i = 0; i < nF; i++) {
      const f = TOWN.mesh(frondGeo(i % 3), (i % 2) ? M.grass : M.grassDk, 0, 0, 0);
      f.scale.set(fl * r.range(0.82, 1.15), fl * r.range(0.7, 1.05), fl * r.range(0.8, 1.1));
      f.rotation.y = (i / nF) * TAU + r.bell() * 0.35;
      f.rotation.z = r.range(0.1, 0.5);
      canopy.add(f);
    }
    for (let i = 0; i < 3; i++) {                     // coconuts
      const a = r.range(0, TAU);
      const c = TOWN.mesh(budGeo(), M.woodDk, Math.cos(a) * tR * 1.2, -tR * 0.6, Math.sin(a) * tR * 1.2);
      c.scale.setScalar(h * 0.028);
      canopy.add(c);
    }
    const cb = new T.Box3().setFromObject(canopy);
    const trunkH = Math.max(h * 0.5, h - (isFinite(cb.max.y) ? cb.max.y : 0));
    const trunk = TOWN.mesh(palmTrunkGeo(tv), M.barkLt);
    trunk.scale.set(tR / 0.08, trunkH, tR / 0.08);
    trunk.rotation.y = r.range(0, TAU);
    g.add(trunk);
    // crown sits at the leaning tip of the arc
    const bend = 0.16 + (tv * 0.06);
    const lx = ((tv % 2) ? -1 : 1) * bend * (tR / 0.08);
    canopy.position.set(lx * Math.cos(trunk.rotation.y), trunkH * 0.995,
      -lx * Math.sin(trunk.rotation.y));
    g.add(canopy);
    return stamp(g, 'treePalm', null, true);
  };

  /** treeOlive({seed, scale, lod}) — h 3.5–5, gnarled multi-stem. */
  Nature.treeOlive = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale || 1, lod = o.lod | 0;
    const g = TOWN.group('treeOlive');
    const h = r.range(3.5, 5) * s;
    const nS = lod ? 2 : r.int(2, 3);
    const trunkH = h * r.range(0.4, 0.5);
    const tR = h * r.range(0.055, 0.075);
    for (let i = 0; i < nS; i++) {
      const a = (i / nS) * TAU + r.bell() * 0.5;
      const off = tR * r.range(0.5, 1.4);
      const st = TOWN.group('stem');
      st.position.set(Math.cos(a) * off, 0, Math.sin(a) * off);
      st.rotation.z = Math.cos(a) * r.range(0.08, 0.2);
      st.rotation.x = -Math.sin(a) * r.range(0.08, 0.2);
      const tk = TOWN.mesh(trunkGeo(lod ? 4 : 1, 5), M.bark);
      tk.scale.set(tR * r.range(0.6, 1), trunkH * r.range(0.8, 1.1), tR * r.range(0.6, 1));
      st.add(tk);
      g.add(st);
    }
    const canopy = TOWN.group('canopy');
    const cr = blobCrown(canopy, r, {
      n: lod ? 3 : r.int(4, 6), rx: h * r.range(0.3, 0.38), ry: h * 0.17,
      matA: M.olive, matB: M.deep, matC: lod ? null : M.lime,
      vseed: r.int(0, 7), spread: 0.72, squash: 0.75,
    });
    hangCanopy(g, canopy, h, 0, 0, { sMax: 1.7 });
    return stamp(g, 'treeOlive', { w: cr.rad * 2, d: cr.rad * 2 }, true);
  };

  /** treeFruit({seed, scale, lod}) — h 3.5–5, rounded crown + instanced fruit. */
  Nature.treeFruit = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale || 1, lod = o.lod | 0;
    const g = TOWN.group('treeFruit');
    const h = r.range(3.5, 5) * s;
    const trunkH = h * r.range(0.34, 0.42);
    const tR = h * r.range(0.05, 0.065);
    const stem = stemGroup(r, 0.05);
    const trunk = TOWN.mesh(trunkGeo(lod ? 4 : 0, 5), M.bark);
    trunk.scale.set(tR, trunkH, tR);
    stem.add(trunk);
    g.add(stem);
    const tip = stemTip(stem, trunkH * 0.95);
    const canopy = TOWN.group('canopy');
    const R = h * r.range(0.26, 0.33);
    const cr = blobCrown(canopy, r, {
      n: lod ? 3 : r.int(4, 5), rx: R, ry: h * 0.17,
      matA: M.spring, matB: M.deep, vseed: r.int(0, 7), spread: 0.6, squash: 0.9,
    });
    if (!lod) {
      const warm = r.chance(0.5) ? M.red : M.yellow;
      const n = r.int(13, 18), tr = [];
      const pts = discPoints(r, n, R * 0.95, R * 0.35);
      for (let i = 0; i < n; i++) {
        const fr = h * r.range(0.014, 0.022);
        tr.push({ p: [pts[i][0], r.range(-0.35, 0.2) * h * 0.17, pts[i][1]], s: fr, r: r.range(0, TAU) });
      }
      canopy.add(Geo.instanced(budGeo(), warm, tr));
    }
    hangCanopy(g, canopy, h, tip.x, tip.z, { trunk: trunk, sMax: 1.55 });
    return stamp(g, 'treeFruit', { w: cr.rad * 2, d: cr.rad * 2 }, true);
  };

  /** treeStump({seed, scale}) — cut stump with flared roots + rings. */
  Nature.treeStump = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale || 1;
    const g = TOWN.group('treeStump');
    const h = r.range(0.45, 0.95) * s;
    const R = h * r.range(0.32, 0.5);
    const body = TOWN.mesh(stumpGeo(r.int(0, 1)), M.bark, 0, 0, 0);
    body.scale.set(R, h, R * r.range(0.9, 1.12));
    body.rotation.y = r.range(0, TAU);
    body.rotation.z = r.bell() * 0.05;
    g.add(body);
    const cut = TOWN.mesh(discGeo(), M.barkLt, 0, h * 0.99, 0);
    cut.scale.setScalar(R * 0.9);
    cut.rotation.y = r.range(0, TAU);
    g.add(cut);
    const core = TOWN.mesh(discGeo(), M.woodDk, 0, h * 1.005, 0);
    core.scale.setScalar(R * 0.42);
    core.rotation.y = r.range(0, TAU);
    g.add(core);
    if (r.chance(0.6)) {   // moss patch
      const m = TOWN.mesh(blobGeo(r.int(0, 7)), M.deep, R * r.range(0.3, 0.7), h * 0.75, R * r.bell() * 0.5);
      m.scale.set(R * 0.4, R * 0.18, R * 0.4);
      g.add(m);
    }
    return stamp(g, 'treeStump', null, true);
  };

  /** logPile({seed, count}) — stacked logs with pale cut faces. */
  Nature.logPile = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('logPile');
    const n = U.clamp(o.count === undefined ? r.int(3, 6) : o.count, 1, 8);
    const L = r.range(2.2, 3.4), R = r.range(0.16, 0.24);
    const rows = [3, 2, 1, 2, 1];
    let placed = 0, row = 0, y = R;
    while (placed < n && row < rows.length) {
      const cnt = Math.min(rows[row], n - placed);
      for (let i = 0; i < cnt; i++) {
        const z = (i - (cnt - 1) / 2) * R * 2.15 + r.bell() * R * 0.12;
        const rr = R * r.range(0.85, 1.12);
        const lg = TOWN.mesh(logGeo(), r.chance(0.5) ? M.bark : M.barkLt, r.bell() * 0.16, y, z);
        lg.scale.set(L * r.range(0.9, 1.06), rr, rr);
        lg.rotation.y = r.bell() * 0.06;
        lg.rotation.x = r.bell() * 0.05;
        g.add(lg);
        const cf = TOWN.mesh(discGeo(), M.pale, lg.position.x + L * 0.5 * 1.0, y, z);
        cf.scale.setScalar(rr * 0.95);
        cf.rotation.z = -Math.PI / 2;
        g.add(cf);
        placed++;
      }
      row++;
      y += R * 1.75;
    }
    return stamp(g, 'logPile', null, true);
  };

  /** firewoodStack({seed, rows, cols}) — instanced split logs, ends to +Z. */
  Nature.firewoodStack = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('firewoodStack');
    const cols = U.clamp(o.cols === undefined ? r.int(4, 6) : o.cols, 2, 8);
    const rows = U.clamp(o.rows === undefined ? r.int(3, 4) : o.rows, 2, 6);
    const R = r.range(0.11, 0.15), D = r.range(0.55, 0.8);
    const logs = [], ends = [];
    for (let j = 0; j < rows; j++) {
      const cn = cols - (j === rows - 1 ? r.int(0, 2) : 0);
      for (let i = 0; i < cn; i++) {
        const rr = R * r.range(0.78, 1.15);
        const x = (i - (cn - 1) / 2) * R * 2.2 + r.bell() * R * 0.2;
        const y = R + j * R * 1.9 + r.bell() * 0.02;
        const dz = D * r.range(0.85, 1.1);
        logs.push({ p: [x, y, 0], r: [r.bell() * 0.05, r.bell() * 0.07, r.range(0, TAU)], s: [rr, rr, dz] });
        ends.push({ p: [x, y, dz * 0.51], r: [Math.PI / 2, r.range(0, TAU), 0], s: rr * 0.92 });
      }
    }
    g.add(Geo.instanced(logZGeo(), M.bark, logs));
    g.add(Geo.instanced(discGeo(), M.pale, ends));
    return stamp(g, 'firewoodStack', null, true);
  };

  /* ==========================================================
     4 · shrubs & ground cover
     ========================================================== */

  /** bush({seed, r, flower}) — 0.6–1.6 blobby shrub, sometimes flowering. */
  Nature.bush = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('bush');
    const R = o.r === undefined ? r.range(0.35, 0.85) : o.r;
    const h = R * r.range(1.5, 2.2);
    const flower = o.flower === undefined ? r.chance(0.3) : !!o.flower;
    const lod = o.lod | 0;
    const canopy = TOWN.group('canopy');
    const cr = blobCrown(canopy, r, {
      n: (flower || lod) ? 3 : r.int(3, 4), rx: R, ry: h * 0.4,
      matA: r.chance(0.5) ? M.spring : M.lime, matB: M.deep,
      vseed: r.int(0, 7), spread: 0.55, squash: 0.9,
    });
    canopy.position.y = h - cr.top;
    g.add(canopy);
    if (flower) {
      const n = r.int(9, 12), tr = [];
      const col = bloomMat(r.pick([P.flowerWhite, P.flowerRed, P.flowerYellow, P.leafPink]));
      const pts = discPoints(r, n, R * 0.95, R * 0.4);
      for (let i = 0; i < n; i++) {
        tr.push({
          p: [pts[i][0], h * r.range(0.45, 0.95), pts[i][1]],
          s: R * r.range(0.09, 0.15),
          r: [r.bell() * 0.8, r.range(0, TAU), r.bell() * 0.8],
        });
      }
      // 4-tri chips (not 8-tri buds) keep a flowering bush inside 120 tris
      g.add(Geo.instanced(chipGeo(), col, tr));
    }
    return stamp(g, 'bush', { w: cr.rad * 2, d: cr.rad * 2 }, true);
  };

  /**
   * hedge({seed, len, h, w, curve, gap, arch}) — clipped run along X.
   * Jittered plan + vertex noise (never a smooth box) + lumpy top blobs.
   * `gap` (-0.4..0.4, fraction of len) opens a doorway, `arch` bridges it.
   * The body geometry is cached per (runLength@0.1, h, w@0.05, seed&3, run)
   * — all cache-key inputs are quantised so repeated calls hit the cache
   * instead of growing it.
   */
  Nature.hedge = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('hedge');
    const len = o.len === undefined ? 6 : Math.max(1.2, o.len);
    const h = o.h === undefined ? 0.9 : o.h;
    const bucket = (o.seed || 1) & 3;
    // width follows the seed bucket (not a free random) so the cache key
    // space stays tiny: lengths x 4 buckets x 2 runs
    const wid = Math.round((o.w === undefined ? 0.6 + bucket * 0.07 : o.w) * 20) / 20;
    const curve = o.curve || 0;
    let gap = o.gap;
    if (gap === undefined) gap = (o.arch || r.chance(0.18)) ? r.range(-0.2, 0.2) : 0;
    const gw = gap ? Math.round(r.range(1, 1.5) * 10) / 10 : 0;
    const runs = [];
    if (gap) {
      const cx = Math.round(gap * len * 10) / 10;
      if (cx - gw / 2 > -len / 2 + 0.5) runs.push([-len / 2, cx - gw / 2]);
      if (cx + gw / 2 < len / 2 - 0.5) runs.push([cx + gw / 2, len / 2]);
      if (!runs.length) runs.push([-len / 2, len / 2]);
    } else runs.push([-len / 2, len / 2]);

    for (let s = 0; s < runs.length; s++) {
      const x0 = runs[s][0];
      const L = Math.max(0.4, Math.round((runs[s][1] - x0) * 10) / 10);
      const x1 = x0 + L;
      const key = 'hedge' + L.toFixed(1) + '_' + h.toFixed(2) + '_' + wid.toFixed(2) + '_' + bucket + '_' + s;
      const geo = gcache(key, function () {
        const rr = rng(bucket * 31 + s * 7 + 5);
        const n = Math.max(3, Math.round(L / 0.85) + 1);
        const back = [], front = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1), x = L * t;
          const zc = Math.sin(t * Math.PI) * curve;
          const wj = wid * (1 + rr.bell() * 0.2);
          back.push([x, zc - wj / 2]);
          front.push([x, zc + wj / 2]);
        }
        const plan = back.concat(front.reverse());
        const gg = Geo.prism(plan, h * (1 + rr.bell() * 0.04));
        Geo.applyVertexNoise(gg, 0.055, 1.5, nz(bucket + 2));
        return gg;
      });
      const body = TOWN.mesh(geo, M.hedge, x0, 0, 0);
      g.add(body);
      // lumpy clipped top
      const nl = Math.max(2, Math.round((x1 - x0) / 1.5));
      for (let i = 0; i < nl; i++) {
        const t = (i + 0.5) / nl;
        const x = U.lerp(x0, x1, t);
        const b = TOWN.mesh(blobGeo(i + bucket), M.spring,
          x + r.bell() * 0.15, h * r.range(0.82, 0.95), Math.sin(t * Math.PI) * curve + r.bell() * 0.06);
        const br = wid * r.range(0.4, 0.6);
        b.scale.set(br * 1.25, br * r.range(0.4, 0.6), br * 1.05);
        b.rotation.y = r.range(0, TAU);
        g.add(b);
      }
    }
    if (gap && o.arch !== false && (o.arch || r.chance(0.4))) {
      const cx = gap * len;
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6, a = Math.PI * t;
        pts.push([cx - Math.cos(a) * gw * 0.5, h * 0.85 + Math.sin(a) * h * 0.55, 0]);
      }
      const ar = TOWN.mesh(Geo.tube(pts, wid * 0.3, 4), M.hedge, 0, 0, 0);
      g.add(ar);
    }
    return stamp(g, 'hedge', { w: len }, true);
  };

  /**
   * flowerPatch({seed, w, d, count, colors}) — instanced stems + blooms,
   * three height classes mixed so the patch never reads as one carpet.
   */
  Nature.flowerPatch = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('flowerPatch');
    const w = o.w === undefined ? 4 : o.w, d = o.d === undefined ? 3 : o.d;
    const n = U.clamp(o.count === undefined ? 40 : o.count, 1, 220);
    // 2–3 colours per patch (a scheme rather than a rainbow → fewer draw calls)
    const cols = (o.colors && o.colors.length) ? o.colors
      : r.shuffle([P.flowerRed, P.flowerYellow, P.flowerWhite, P.leafPink]).slice(0, r.int(2, 3));
    const pts = cells(r, n, w, d, 0.5);
    const stems = [], buckets = {};
    const heights = [0.22, 0.4, 0.62];
    for (let i = 0; i < n; i++) {
      const hc = r.pickW([[0, 3], [1, 4], [2, 2]]);
      const hh = heights[hc] * r.range(0.8, 1.25);
      const x = pts[i][0], z = pts[i][1];
      const lean = r.bell() * 0.12;
      stems.push({ p: [x, 0, z], r: [lean, r.range(0, TAU), lean * 0.7], s: [0.5, hh, 0.5] });
      const hex = cols[(i + hc) % cols.length];
      const k = String(hex);
      if (!buckets[k]) buckets[k] = { mat: bloomMat(hex), tr: [] };
      buckets[k].tr.push({
        p: [x + lean * hh * 0.5, hh * r.range(0.9, 1.02), z],
        s: r.range(0.045, 0.075), r: [r.bell() * 0.5, r.range(0, TAU), r.bell() * 0.5],
      });
    }
    g.add(Geo.instanced(bladeGeo(), M.grassDk, stems));
    for (const k in buckets) g.add(Geo.instanced(budGeo(), buckets[k].mat, buckets[k].tr));
    return stamp(g, 'flowerPatch', { w: w, d: d }, true);
  };

  /**
   * grassTufts({seed, w, d, count}) — instanced 3-triangle crossed blades
   * gathered into clumps (never an even lawn), two green tones.
   */
  Nature.grassTufts = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('grassTufts');
    const w = o.w === undefined ? 6 : o.w, d = o.d === undefined ? 6 : o.d;
    const n = U.clamp(o.count === undefined ? 120 : o.count, 1, 400);
    const nc = Math.max(1, Math.round(n / 7));
    const cl = clumps(r, n, w * 0.92, d * 0.92, nc, Math.min(w, d) * 0.09);
    const A = [], B = [];
    for (let i = 0; i < n; i++) {
      const hh = r.range(0.2, 0.5) * (r.chance(0.15) ? 1.5 : 1);
      const sc = r.range(0.7, 1.15);
      const t = {
        p: [cl[i][0], 0, cl[i][1]],
        r: [r.bell() * 0.16, r.range(0, TAU), r.bell() * 0.16],
        s: [sc, hh, sc],
      };
      ((cl[i][2] % 2) ? A : B).push(t);
    }
    if (A.length) g.add(Geo.instanced(bladeGeo(), M.grass, A));
    if (B.length) g.add(Geo.instanced(bladeGeo(), M.grassDk, B));
    return stamp(g, 'grassTufts', { w: w, d: d }, true);
  };

  /** reeds({seed, w, d, count}) — tall thin waterside blades + seed heads. */
  Nature.reeds = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('reeds');
    const w = o.w === undefined ? 4 : o.w, d = o.d === undefined ? 1.6 : o.d;
    const n = U.clamp(o.count === undefined ? 44 : o.count, 1, 220);
    const cl = clumps(r, n, w * 0.94, d * 0.94, Math.max(1, Math.round(n / 6)), Math.min(w, d) * 0.12);
    const A = [], B = [], heads = [];
    for (let i = 0; i < n; i++) {
      const hh = r.range(0.75, 1.85);
      const t = {
        p: [cl[i][0], 0, cl[i][1]],
        r: [r.bell() * 0.1, r.range(0, TAU), r.bell() * 0.1],
        s: [r.range(0.25, 0.45), hh, r.range(0.25, 0.45)],
      };
      (r.chance(0.55) ? A : B).push(t);
      if (r.chance(0.3)) {
        heads.push({ p: [cl[i][0], hh * 0.98, cl[i][1]], s: [0.035, 0.13, 0.035], r: r.range(0, TAU) });
      }
    }
    if (A.length) g.add(Geo.instanced(bladeGeo(), M.grassDk, A));
    if (B.length) g.add(Geo.instanced(bladeGeo(), M.grassDry, B));
    if (heads.length) g.add(Geo.instanced(budGeo(), M.woodDk, heads));
    return stamp(g, 'reeds', { w: w, d: d }, true);
  };

  /** lilyPads({seed, r, count}) — flat discs floating at y≈0.02 + flowers. */
  Nature.lilyPads = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('lilyPads');
    const R = o.r === undefined ? 2.5 : o.r;
    const n = U.clamp(o.count === undefined ? r.int(9, 16) : o.count, 1, 80);
    const pts = discPoints(r, n, R, R * 0.3);
    const A = [], B = [], fl = [];
    for (let i = 0; i < n; i++) {
      const pr = r.range(0.16, 0.34);
      const t = { p: [pts[i][0], 0.02 + r.range(0, 0.01), pts[i][1]], r: r.range(0, TAU), s: [pr, 1, pr * r.range(0.85, 1.1)] };
      (r.chance(0.6) ? A : B).push(t);
      if (r.chance(0.18)) {
        fl.push({ p: [pts[i][0], 0.075, pts[i][1]], s: pr * 0.35, r: r.range(0, TAU) });
      }
    }
    if (A.length) g.add(Geo.instanced(discGeo(), M.deep, A, { castShadow: false }));
    if (B.length) g.add(Geo.instanced(discGeo(), M.olive, B, { castShadow: false }));
    if (fl.length) g.add(Geo.instanced(budGeo(), r.chance(0.5) ? M.pale : M.pink, fl));
    return stamp(g, 'lilyPads', { w: R * 2, d: R * 2 }, true);
  };

  /**
   * ivy({seed, w, h}) — climbing mat of instanced leaves in the XY plane,
   * facing +Z, origin bottom-centre on y = 0. Stick it on a wall face.
   */
  Nature.ivy = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('ivy');
    const w = o.w === undefined ? 3 : o.w, h = o.h === undefined ? 2.5 : o.h;
    const n = Math.round(U.clamp(w * h * 9, 14, 90));
    const pts = cells(r, n, w, h, 0.55);
    const A = [], B = [];
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0], y = pts[i][1] + h / 2;
      const dens = U.saturate(1 - (y / h) * 0.8);
      if (r() > 0.3 + dens * 0.7) continue;
      const sc = r.range(0.1, 0.19) * (0.65 + dens * 0.5);
      const t = {
        p: [x, U.clamp(y, 0.03, h), r.range(0.02, 0.11)],
        r: [r.bell() * 0.6, r.range(0, TAU), r.bell() * 0.9],
        s: [sc, sc * r.range(0.7, 1.1), sc * 0.45],
      };
      (r.chance(0.55) ? A : B).push(t);
    }
    if (A.length) g.add(Geo.instanced(chipGeo(), M.deep, A));
    if (B.length) g.add(Geo.instanced(chipGeo(), M.spring, B));
    for (let i = 0; i < 3; i++) {   // vine strands
      const v = TOWN.mesh(bladeGeo(), M.grassDk, r.bell() * w * 0.35, 0, 0.03);
      v.scale.set(0.05, h * r.range(0.7, 0.98), 0.05);
      v.rotation.y = r.range(0, TAU);
      g.add(v);
    }
    return stamp(g, 'ivy', { w: w, d: 0.24 }, true);
  };

  /**
   * vegPatch({seed, w, d}) — kitchen garden: soil plate, ridged furrows,
   * instanced cabbages and carrot tops in rows.
   */
  Nature.vegPatch = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('vegPatch');
    const w = o.w === undefined ? 5 : o.w, d = o.d === undefined ? 3.5 : o.d;
    const base = TOWN.mesh(Geo.prism(Geo.roundRectPlan(w, d, 0.4, 2, 0.2, r), 0.1), M.soil, 0, 0, 0);
    g.add(base);
    const nR = U.clamp(Math.floor(d / 0.75), 2, 7);
    const cab = [], car = [];
    for (let i = 0; i < nR; i++) {
      const z = -d / 2 + (d / nR) * (i + 0.5);
      const rw = (d / nR) * r.range(0.5, 0.66);
      const ridge = TOWN.mesh(Geo.gableRoof(w * r.range(0.86, 0.95), rw, r.range(0.14, 0.22),
        { over: 0, thick: 0.03 }), M.soilDk, 0, 0.09, z + r.bell() * 0.04);
      ridge.rotation.y = r.bell() * 0.02;
      g.add(ridge);
      const crop = i % 2;
      const nc = Math.max(2, Math.round(w / (crop ? 0.42 : 0.62)));
      for (let k = 0; k < nc; k++) {
        const x = -w / 2 + (w / nc) * (k + 0.5) + r.bell() * 0.06;
        if (Math.abs(x) > w / 2 - 0.25) continue;
        if (crop) {
          car.push({
            p: [x, 0.2, z + r.bell() * 0.05], r: [r.bell() * 0.2, r.range(0, TAU), r.bell() * 0.2],
            s: [0.45, r.range(0.2, 0.34), 0.45],
          });
        } else {
          const cr = r.range(0.13, 0.2);
          cab.push({ p: [x, 0.2 + cr * 0.6, z + r.bell() * 0.05], s: [cr, cr * 0.8, cr], r: r.range(0, TAU) });
        }
      }
    }
    if (cab.length) g.add(Geo.instanced(budGeo(), M.lime, cab));
    if (car.length) g.add(Geo.instanced(bladeGeo(), M.spring, car));
    return stamp(g, 'vegPatch', { w: w, d: d }, true);
  };

  /** potPlant({seed}) — terracotta pot + plant, h 0.4–0.9. */
  Nature.potPlant = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('potPlant');
    const pr = r.range(0.14, 0.22), ph = pr * r.range(1.1, 1.5);
    const pot = TOWN.mesh(potGeo(), M.terra, 0, 0, 0);
    pot.scale.set(pr, ph, pr);
    pot.rotation.y = r.range(0, TAU);
    g.add(pot);
    const soil = TOWN.mesh(discGeo(), M.soilDk, 0, ph * 0.94, 0);
    soil.scale.setScalar(pr * 0.86);
    g.add(soil);
    const canopy = TOWN.group('canopy');
    const h = ph + r.range(0.2, 0.55);
    if (r.chance(0.55)) {
      const cr = blobCrown(canopy, r, {
        n: 3, rx: pr * r.range(1.1, 1.5), ry: (h - ph) * 0.5,
        matA: M.spring, matB: M.deep, vseed: r.int(0, 7), spread: 0.5, squash: 0.9,
      });
      canopy.position.y = h - cr.top;
    } else {
      const n = 3;
      for (let i = 0; i < n; i++) {
        const b = TOWN.mesh(bladeGeo(), r.chance(0.5) ? M.grass : M.lime,
          pr * r.bell() * 0.4, 0, pr * r.bell() * 0.4);
        b.scale.set(pr * r.range(0.6, 1), (h - ph) * r.range(0.7, 1), pr * r.range(0.6, 1));
        b.rotation.y = r.range(0, TAU);
        b.rotation.z = r.bell() * 0.2;
        canopy.add(b);
      }
      canopy.position.y = ph * 0.95;
      if (r.chance(0.5)) {
        const fl = TOWN.mesh(budGeo(), bloomMat(r.pick([P.flowerRed, P.flowerYellow, P.leafPink])),
          0, (h - ph) * 0.95, 0);
        fl.scale.setScalar(pr * 0.28);
        canopy.add(fl);
      }
    }
    g.add(canopy);
    return stamp(g, 'potPlant', null, true);
  };

  /* ==========================================================
     5 · rocks & terrain accents
     ========================================================== */

  /**
   * rock({seed, scale, sink}) — irregular boulder, never a cube.
   * h 0.4–2.5, partially sunk: minY ≈ -0.08 … -0.26 by design.
   */
  Nature.rock = function (o) {
    o = o || {};
    const r = rng(o.seed), s = o.scale === undefined ? 1 : o.scale;
    const g = TOWN.group('rock');
    const h = r.pickW([[r.range(0.55, 1), 4], [r.range(1, 1.6), 3], [r.range(1.6, 2.45), 2]]) * s;
    // the noisy icosahedron spans ~±1.2, so 0.42*h of scale ≈ h of height
    const m = TOWN.mesh(rockGeo(r.int(0, 5)), r.chance(0.62) ? M.rock : M.rockDk, 0, 0, 0);
    m.scale.set(h * r.range(0.42, 0.62), h * r.range(0.38, 0.48), h * r.range(0.42, 0.62));
    m.rotation.set(r.bell() * 0.22, r.range(0, TAU), r.bell() * 0.22);
    g.add(m);
    sit(m, o.sink === undefined ? U.clamp(h * 0.12, 0.06, 0.26) : o.sink);
    return stamp(g, 'rock');
  };

  /** rockCluster({seed, r, count}) — mixed sizes, biggest off-centre, + gravel. */
  Nature.rockCluster = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('rockCluster');
    const R = o.r === undefined ? 3 : o.r;
    const n = U.clamp(o.count === undefined ? r.int(3, 5) : o.count, 1, 12);
    const pts = discPoints(r, n, R * 0.7, R * 0.45);
    const big = r.range(1.4, 2.3) * U.clamp(R / 3, 0.6, 1.4);
    for (let i = 0; i < n; i++) {
      const hh = i === 0 ? big : big * r.range(0.25, 0.62);
      const m = TOWN.mesh(rockGeo(i % 6), (i % 3 === 1) ? M.rockDk : M.rock,
        pts[i][0] + (i === 0 ? R * 0.28 : 0), 0, pts[i][1] + (i === 0 ? R * 0.16 : 0));
      m.scale.set(hh * r.range(0.5, 0.8), hh * r.range(0.4, 0.62), hh * r.range(0.5, 0.8));
      m.rotation.set(r.bell() * 0.2, r.range(0, TAU), r.bell() * 0.2);
      g.add(m);
      sit(m, U.clamp(hh * 0.13, 0.06, 0.24));
    }
    const ng = r.int(18, 26), tr = [];
    const gp = discPoints(r, ng, R, R * 0.12);
    for (let i = 0; i < ng; i++) {
      const sc = r.range(0.04, 0.11);
      tr.push({
        p: [gp[i][0], sc * 0.35, gp[i][1]],
        r: [r.bell() * 1.2, r.range(0, TAU), r.bell() * 1.2], s: [sc, sc * 0.6, sc],
      });
    }
    g.add(Geo.instanced(chipGeo(), M.rockDk, tr));
    return stamp(g, 'rockCluster', { w: R * 2, d: R * 2 });
  };

  /** cliffRocks({seed, len, h}) — angular rock run along X for terrace edges. */
  Nature.cliffRocks = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('cliffRocks');
    const len = o.len === undefined ? 6 : Math.max(1.5, o.len);
    const hh = o.h === undefined ? r.range(1.1, 1.9) : o.h;
    const n = Math.max(2, Math.round(len / 1.45));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = -len / 2 + len * t + r.bell() * (len / n) * 0.2;
      const s = hh * (0.55 + Math.abs(Math.sin(t * 5.1 + 1)) * 0.7) * r.range(0.85, 1.15);
      const m = TOWN.mesh(rockGeo(i % 6), (i % 2) ? M.rock : M.rockDk, x, 0, r.bell() * 0.4);
      m.scale.set(s * r.range(0.42, 0.66), s * r.range(0.6, 0.95), s * r.range(0.4, 0.62));
      m.rotation.set(r.bell() * 0.18, r.range(0, TAU), r.bell() * 0.2);
      g.add(m);
      sit(m, U.clamp(s * 0.1, 0.05, 0.2));
    }
    const ng = r.int(14, 20), tr = [];
    for (let i = 0; i < ng; i++) {
      const sc = r.range(0.05, 0.12);
      tr.push({
        p: [r.range(-len / 2, len / 2), sc * 0.3, r.bell() * 0.75],
        r: [r.bell() * 1.2, r.range(0, TAU), r.bell() * 1.2], s: [sc, sc * 0.55, sc],
      });
    }
    g.add(Geo.instanced(chipGeo(), M.rockDk, tr));
    return stamp(g, 'cliffRocks', { w: len });
  };

  /** driftwood({seed}) — bleached log lying on the sand with stubs. */
  Nature.driftwood = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('driftwood');
    const L = r.range(1.6, 3.2), R = r.range(0.11, 0.19);
    const main = TOWN.mesh(logGeo(), M.pale, 0, 0, 0);
    main.scale.set(L, R, R * r.range(0.8, 1.1));
    main.rotation.y = r.bell() * 0.5;
    main.rotation.z = r.bell() * 0.12;
    main.rotation.x = r.bell() * 0.2;
    g.add(main);
    sit(main, R * 0.35);
    for (let i = 0; i < 2; i++) {
      const bl = L * r.range(0.16, 0.3);
      const b = TOWN.mesh(branchGeo(i), M.pale, L * r.range(-0.4, 0.4) * 0.9,
        main.position.y + R * 0.4, r.bell() * R);
      b.scale.set(bl, bl * r.range(0.3, 0.6), bl);
      b.rotation.y = r.range(0, TAU);
      b.rotation.z = r.range(0.15, 0.55);      // stubs point up out of the sand
      g.add(b);
    }
    const st = TOWN.mesh(discGeo(), M.woodDk, L * 0.5 * Math.cos(main.rotation.y), main.position.y, 0);
    st.scale.setScalar(R * 0.8);
    st.rotation.z = -Math.PI / 2;
    st.rotation.y = main.rotation.y;
    g.add(st);
    return stamp(g, 'driftwood');
  };

  /** seashells({seed, count, r}) — tiny instanced shells on the sand. */
  Nature.seashells = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('seashells');
    const R = o.r === undefined ? 1.6 : o.r;
    const n = U.clamp(o.count === undefined ? 16 : o.count, 1, 90);
    const pts = discPoints(r, n, R, R * 0.18);
    const A = [], B = [];
    for (let i = 0; i < n; i++) {
      const sc = r.range(0.035, 0.075);
      const t = {
        p: [pts[i][0], sc * 0.3, pts[i][1]],
        r: [Math.PI * 0.5 + r.bell() * 0.5, r.range(0, TAU), r.bell() * 0.6],
        s: [sc, sc * r.range(0.5, 0.9), sc],
      };
      (r.chance(0.6) ? A : B).push(t);
    }
    if (A.length) g.add(Geo.instanced(chipGeo(), M.pale, A, { castShadow: false }));
    if (B.length) g.add(Geo.instanced(chipGeo(), M.pink, B, { castShadow: false }));
    return stamp(g, 'seashells', { w: R * 2, d: R * 2 }, true);
  };

  /** beachGrass({seed, count, w, d}) — sparse dry clumps for dunes. */
  Nature.beachGrass = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('beachGrass');
    const w = o.w === undefined ? 3.5 : o.w, d = o.d === undefined ? 2.5 : o.d;
    const n = U.clamp(o.count === undefined ? 34 : o.count, 1, 200);
    const cl = clumps(r, n, w * 0.9, d * 0.9, Math.max(1, Math.round(n / 5)), Math.min(w, d) * 0.1);
    const A = [], B = [];
    for (let i = 0; i < n; i++) {
      const hh = r.range(0.35, 0.95);
      const t = {
        p: [cl[i][0], 0, cl[i][1]],
        r: [r.bell() * 0.28, r.range(0, TAU), r.bell() * 0.28],
        s: [r.range(0.35, 0.6), hh, r.range(0.35, 0.6)],
      };
      (r.chance(0.65) ? A : B).push(t);
    }
    if (A.length) g.add(Geo.instanced(bladeGeo(), M.grassDry, A));
    if (B.length) g.add(Geo.instanced(bladeGeo(), M.grassDk, B));
    return stamp(g, 'beachGrass', { w: w, d: d }, true);
  };

  /* ==========================================================
     6 · composites — the anti-monotony workhorses
     ========================================================== */

  const CLUSTER_KINDS = ['treeBroad', 'treePine', 'treeCypress', 'treeBirch',
    'treeAutumn', 'treeSakura', 'treeOlive'];
  Nature.kinds = ['treeBroad', 'treePine', 'treeCypress', 'treeBirch', 'treeSakura',
    'treeAutumn', 'treePalm', 'treeOlive', 'treeFruit'];

  /**
   * treeCluster({seed, r, count, kinds, hMax}) — mixed copse.
   * Guarantees ≥ 3 species, a ≥ 1.6 m height spread and the tallest
   * off-centre; dresses the feet with rocks, bushes and tufts.
   * Uses lod-1 trees so a 6-tree copse stays under ~900 triangles.
   */
  Nature.treeCluster = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('treeCluster');
    const R = o.r === undefined ? 4 : o.r;
    const n = U.clamp(o.count === undefined ? 5 : o.count, 2, 10);
    let kinds = (o.kinds && o.kinds.length >= 3) ? o.kinds.slice() : r.shuffle(CLUSTER_KINDS.slice()).slice(0, r.int(3, 4));
    const pts = discPoints(r, n, R * 0.82, R * 0.62);
    const hMax = (o.hMax === undefined ? r.range(7.4, 9.4) : o.hMax);
    const drop = r.range(2.2, 3.6);
    for (let i = 0; i < n; i++) {
      const kind = kinds[i % kinds.length];
      const f = Nature[kind] || Nature.treeBroad;
      const t = f({ seed: (o.seed || 1) * 977 + i * 131 + 7, lod: 1 });
      const target = i === 0 ? hMax
        : hMax - drop * (0.35 + 0.65 * (i / Math.max(1, n - 1))) * r.range(0.85, 1.15);
      const k = U.clamp(target / Math.max(0.4, t.userData.height), 0.35, 2.2);
      t.scale.setScalar(k);
      // tallest deliberately off-centre
      t.position.set(pts[i][0] + (i === 0 ? R * 0.34 : 0), 0, pts[i][1] + (i === 0 ? R * 0.2 : 0));
      t.rotation.y = r.range(0, TAU);
      g.add(t);
    }
    // feet dressing
    const nRock = n >= 6 ? 2 : 3;
    for (let i = 0; i < nRock; i++) {
      const a = r.range(0, TAU), rr = R * r.range(0.45, 0.95);
      const rk = Nature.rock({ seed: (o.seed || 1) * 53 + i * 17, scale: r.range(0.4, 0.8) });
      rk.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      g.add(rk);
    }
    const nBush = n >= 6 ? 1 : 2;
    for (let i = 0; i < nBush; i++) {
      const a = r.range(0, TAU), rr = R * r.range(0.5, 0.95);
      const b = Nature.bush({ seed: (o.seed || 1) * 71 + i * 29, r: r.range(0.3, 0.6), lod: 1, flower: false });
      b.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      g.add(b);
    }
    g.add(Nature.grassTufts({
      seed: (o.seed || 1) * 13 + 3, w: R * 1.7, d: R * 1.7,
      count: n >= 6 ? 12 : 16,
    }));
    return stamp(g, 'treeCluster', { w: R * 2, d: R * 2 });
  };

  /** windbreak({seed, len, count, kinds}) — staggered conifer row along X. */
  Nature.windbreak = function (o) {
    o = o || {};
    const r = rng(o.seed);
    const g = TOWN.group('windbreak');
    const len = o.len === undefined ? 12 : Math.max(2, o.len);
    const n = U.clamp(o.count === undefined ? Math.max(3, Math.round(len / 2.4)) : o.count, 2, 20);
    const kinds = (o.kinds && o.kinds.length) ? o.kinds : ['treeCypress', 'treePine'];
    const step = len / n;
    for (let i = 0; i < n; i++) {
      const kind = kinds[i % kinds.length];
      const t = (Nature[kind] || Nature.treeCypress)({ seed: (o.seed || 1) * 613 + i * 97, lod: 1 });
      // staggered: alternating tall / short with jitter, never a smooth row
      const stag = (i % 2 ? 0.74 : 1) * (i % 3 === 0 ? 1.12 : 0.94);
      const target = (kind === 'treeCypress' ? 8.6 : 8) * stag * r.range(0.9, 1.1);
      t.scale.setScalar(U.clamp(target / Math.max(0.4, t.userData.height), 0.35, 2));
      t.position.set(-len / 2 + step * (i + 0.5) + r.bell() * step * 0.16, 0, r.bell() * 0.5);
      t.rotation.y = r.range(0, TAU);
      g.add(t);
    }
    return stamp(g, 'windbreak', { w: len }, true);
  };

  /** demo() — every factory in a row along X, spaced by footprint + 2. */
  Nature.demo = function (o) {
    o = o || {};
    const g = TOWN.group('natureDemo');
    const items = [
      ['treeBroad', {}], ['treePine', {}], ['treeCypress', {}], ['treeBirch', {}],
      ['treeSakura', {}], ['treeAutumn', {}], ['treePalm', {}], ['treeOlive', {}],
      ['treeFruit', {}], ['treeStump', {}], ['logPile', {}], ['firewoodStack', {}],
      ['bush', { flower: true }], ['hedge', { len: 6, arch: true }],
      ['flowerPatch', { w: 4, d: 3 }], ['grassTufts', { w: 5, d: 5 }],
      ['reeds', { w: 4, d: 1.6 }], ['lilyPads', { r: 2 }], ['ivy', { w: 3, h: 3 }],
      ['vegPatch', { w: 5, d: 3.5 }], ['potPlant', {}], ['rock', {}],
      ['rockCluster', { r: 3 }], ['cliffRocks', { len: 6 }], ['driftwood', {}],
      ['seashells', {}], ['beachGrass', {}], ['treeCluster', { r: 4, count: 5 }],
      ['windbreak', { len: 10 }],
    ];
    let x = 0;
    for (let i = 0; i < items.length; i++) {
      const opts = {};
      for (const k in items[i][1]) opts[k] = items[i][1][k];
      opts.seed = (o.seed || 100) + i * 37;
      const sub = Nature[items[i][0]](opts);
      const fw = sub.userData.footprint.w;
      x += fw / 2;
      sub.position.x = x;
      g.add(sub);
      x += fw / 2 + 2;
    }
    return stamp(g, 'natureDemo');
  };

  /* ==========================================================
     7 · variants() — pre-built groups for the layout to clone
     ========================================================== */
  const variantCache = new Map();
  /**
   * variants(kind, n, seed) -> [Group, ...]
   * Cached, deterministic set of n distinct pre-built groups. The layout
   * should `.clone()` these instead of calling the factory 150 times:
   * clone() reuses the cached geometries AND the userData (deep-copied by
   * three via JSON), so footprint / height / kind / petalAnchor survive.
   * Every clone still has a child named 'canopy' for sway().
   */
  Nature.variants = function (kind, n, seed) {
    n = Math.max(1, (n === undefined ? 4 : n) | 0);
    seed = seed || 1;
    const key = kind + '|' + n + '|' + seed;
    if (variantCache.has(key)) return variantCache.get(key);
    const f = Nature[kind];
    const out = [];
    if (typeof f === 'function') {
      for (let i = 0; i < n; i++) out.push(f({ seed: seed * 131 + i * 7717 + 1 }));
    }
    variantCache.set(key, out);
    return out;
  };

  /* ==========================================================
     8 · wind — ONE shared ticker for every registered plant
     ========================================================== */
  const swayers = [];
  let swayTicker = null;

  function swayUpdate(dt, elapsed) {
    for (let i = 0; i < swayers.length; i++) {
      const s = swayers[i];
      const p = elapsed * s.spd + s.ph;
      s.o.rotation.z = s.rz + (Math.sin(p) + Math.sin(p * 2.37) * 0.35) * s.amp;
      s.o.rotation.x = s.rx + Math.cos(p * 0.83) * s.amp * 0.6;
    }
  }

  /** kinds that must never sway even if sway() is called on them */
  const NO_SWAY = {
    rock: 1, rockCluster: 1, cliffRocks: 1, driftwood: 1, seashells: 1,
    logPile: 1, firewoodStack: 1, treeStump: 1,
  };

  /**
   * sway(obj, {amount = 0.03, speed = 1, seed}) -> obj
   * Registers obj's canopy with the single shared 'nature.sway' ticker.
   * Pass the placed tree (or clone): the child named 'canopy' is used when
   * present, otherwise obj itself — and for a composite (treeCluster /
   * windbreak / demo) EVERY canopy inside it is registered, each with its
   * own phase, so one call is enough whatever you hand it.
   * Only the canopies are marked dynamic, so trunks, rocks and ground
   * cover still get baked by Geo.mergeStatic.
   * Safe to call twice on the same object (second call is a no-op) and safe
   * to call on a boulder or a log pile (ignored — stone must not wobble).
   */
  Nature.sway = function (obj, opts) {
    if (!obj) return obj;
    opts = opts || {};
    const targets = [];
    if (obj.name === 'canopy' || !obj.traverse) targets.push(obj);
    else {
      obj.traverse(function (o) { if (o.name === 'canopy') targets.push(o); });
      if (!targets.length) {
        if (obj.userData && NO_SWAY[obj.userData.kind]) return obj;
        targets.push(obj);
      }
    }
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (target.userData.swaying) continue;
      target.userData.swaying = true;
      TOWN.markDynamic(target);
      const r = rng((opts.seed || (swayers.length * 37 + 11)) + i * 613);
      swayers.push({
        o: target,
        amp: (opts.amount === undefined ? 0.03 : opts.amount) * r.range(0.65, 1.35),
        spd: (opts.speed === undefined ? 1 : opts.speed) * r.range(0.7, 1.35),
        ph: r.range(0, TAU),
        rx: target.rotation.x, rz: target.rotation.z,
      });
    }
    if (!swayTicker) swayTicker = TOWN.Ticker.add(swayUpdate, 'nature.sway');
    return obj;
  };
  Nature.swayers = swayers;

  /** stats() — quick introspection for the integrator / probe */
  Nature.stats = function () {
    return { materials: Object.keys(M).length, cachedGeometries: GC.size, swaying: swayers.length };
  };

  console.log('[TOWN] nature ready · ' + Object.keys(M).length + ' materials');
})(window);

/* ---- probe results ----------------------------------------------------
   tools/probe.sh --files js/world/nature.js   ·  three r152 / swiftshader
   errors: []   ·  no NaN geometry anywhere  ·  every factory ok:true
   30 factories x seeds 1..10 (+ no-args, {} and 13 hostile opt sets ×30 —
   0 throws, 0 non-finite bounds).

   factory        triMax  mats  instMesh/inst   height        w             d          minY
   treeBroad        384    4      0/0        5.43– 8.51   2.31–5.36   2.52–4.63    0
   treePine         162    3      0/0        6.51–11.09   1.44–3.09   1.44–3.15    0
   treeCypress      134    3      0/0        7.30–10.72   1.07–1.79   1.03–1.87    0
   treeBirch        270    4      1/16       6.19– 8.73   2.33–3.38   2.15–3.53    0
   treeSakura       404    3      0/0        4.70– 6.84   3.40–5.52   3.46–5.20    0
   treeAutumn       330    4      0/0        5.20– 7.76   2.33–3.84   2.63–4.18    0
   treePalm         378    4      0/0        5.19– 7.75   3.60–6.06   3.42–6.53    0
   treeOlive        240    4      0/0        3.63– 4.94   2.43–3.26   2.25–3.29    0
   treeFruit        276    4      1/18       3.60– 4.88   1.86–2.97   1.94–3.10    0
   treeStump         74    4      0/0        0.50– 0.93   0.74–1.85   0.69–1.85   -0.002
   logPile          180    3      0/0        0.32– 1.04   2.43–3.47   1.05–1.63   -0.002
   firewoodStack    624    2      2/48       0.74– 1.28   1.04–1.83   0.61–0.84    0
   bush             108    2      1/12       0.61– 1.57   0.74–1.65   0.71–1.61    0
   hedge (len 6)    312    2      0/0        0.98– 1.47   6.00–6.28   0.92–1.32    0
   flowerPatch      440    4      4/80       0.71– 0.87   3.72–3.99   2.83–3.01    0
   grassTufts       360    2      2/120      0.73– 0.80   5.17–6.11   5.50–6.15    0
   reeds            252    3      3/59       1.85– 1.95   3.00–3.66   1.20–1.50    0
   lilyPads         136    3      3/21       0.13– 0.23   4.11–5.12   3.92–5.62   -0.002
   ivy              221    3      2/53       2.39– 2.58   2.91–3.05   0.32–0.37    0
   vegPatch         300    4      2/36       0.53– 0.54   4.97–5.08   3.46–3.58    0
   potPlant         136    5      0/0        0.38– 0.75   0.32–0.56   0.32–0.56    0
   rock              20    1      0/0        0.39– 2.30   0.69–3.49   0.68–3.37   -0.260
   rockCluster      204    2      1/26       1.12– 2.35   5.20–6.67   4.50–6.67   -0.240
   cliffRocks       156    2      1/19       1.73– 3.27   5.80–7.67   1.84–3.36   -0.200
   driftwood        138    2      0/0        0.41– 0.91   1.71–3.04   0.31–1.43   -0.066
   seashells         64    2      2/16       0.10– 0.13   2.40–3.15   2.40–3.12    0
   beachGrass       102    2      2/34       0.86– 0.97   2.63–3.46   1.88–2.37    0
   treeCluster      722   15      2/16       7.65– 9.34   6.57–9.69   7.04–10.60  -0.227
   windbreak        468    4      0/0        8.78–10.41  10.63–11.16  1.63–2.27    0
   demo()          7091   23     29/560     10.61       159.3        10.2        -0.240

   budgets    tree ≤ 500 (worst 404) · bush ≤ 120 (108) · cluster ≤ 900
              (722) · prop ≤ 900 (624) · module materials 24 ≤ 25 · lights 0
   footprint  reported value is always within 19.6 % of the real AABB
   structure  crown-to-wood overlap ≥ 0.17 m and crown top within 0.03 m of
              the target height, for all 9 species x 12 seeds
   variety    treeBroad h over seeds 1..6 = 6.01 5.62 5.43 8.51 5.46 7.70
              treePine  = 7.35 6.78 6.51 11.09 6.55 9.86
              treeCypress = 7.95 7.50 7.30 10.72 7.34 9.77
              treeSakura  = 5.12 4.82 4.70 6.84 4.71 6.29
              60-seed histograms fill all 5 height bins for broad/pine/bush
              inside one treeCluster: 3–4 species, height spread 2.5–3.4 m
              windbreak row heights (seed 3): 8.78 5.75 7.53 6.38 8.05
   perf       120 x treeBroad  = 17.7–26.8 ms  (limit 900 ms), 20 720 tris
              150 mixed species = 20.5 ms · 200 mixed plants = 12.5 ms warm
              variants('treeBroad',6) + 150 clones = 18–23 ms
              66–108 cached geometries after hundreds of calls (bounded)
              sway: 1 ticker for 150 canopies, 60 frames = 2 ms total
   ---------------------------------------------------------------------- */
