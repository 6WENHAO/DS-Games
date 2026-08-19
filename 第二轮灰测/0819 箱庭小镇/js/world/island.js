/* =============================================================
   island.js — the land itself.

   A single analytic height model drives everything:
     · the terraced island mesh (vertex-coloured, no textures)
     · height queries the layout uses to sit buildings on the ground
     · a baked height texture the water shader reads for depth,
       shoreline foam and translucency

   Five habitable elevations plus a knoll and a hilltop give the
   silhouette its 高低错落 (staggered heights) instead of one flat pad.
   ============================================================= */
(function (global) {
  'use strict';
  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U, Geo = TOWN.Geo, Mat = TOWN.Mat, P = TOWN.Palette;

  const Island = TOWN.Island = {};

  /* ------------------------------------------------------------
     Tier elevations (metres). The layout places on these.
     ------------------------------------------------------------ */
  const TIERS = Island.TIERS = {
    SEA: 0.0,
    QUAY: 1.75,     // harbour quay around the bay
    FAIR: 3.00,     // seaside fairground shelf
    TOWN: 4.40,     // main town plateau — the biggest pad
    TERRACE: 6.80,  // upper residential terrace
    KNOLL: 10.90,   // windmill fields
    HILL: 13.80,    // observatory hilltop
  };

  Island.RADIUS = 56;
  const GRID = { x0: -72, z0: -72, x1: 72, z1: 72, step: 0.9 };

  /* ------------------------------------------------------------
     Coastline — hand-authored organic polygon (CCW)
     ------------------------------------------------------------ */
  const COAST = [
    [50, 10], [52, -4], [47, -20], [36, -34], [20, -43], [2, -46],
    [-17, -44], [-33, -38], [-45, -28], [-52, -13], [-52, 5], [-47, 20],
    [-39, 32], [-27, 40], [-13, 45], [3, 47], [17, 47], [31, 46],
    [41, 40], [48, 27], [51, 17],
  ];

  /** the bay: water carved inland from +Z */
  const BAY = [
    [10, 50], [31, 50], [32, 34], [27, 22], [17, 19], [10, 23], [7, 35],
  ];

  /** a small cove on the west shore */
  const COVE = [[-52, 8], [-44, 10], [-42, 18], [-48, 22], [-53, 18]];

  /* ------------------------------------------------------------
     Pads — flat plateaux. Several convex polys may share a tier;
     they union naturally through the max() blend.
     ------------------------------------------------------------ */
  const PADS = [
    // ---- harbour quay, wrapping the bay on three sides
    { name: 'quayW', h: TIERS.QUAY, fall: 5.0, poly: [[-6, 12], [9, 12], [9, 44], [-6, 44]] },
    { name: 'quayN', h: TIERS.QUAY, fall: 5.0, poly: [[0, 10], [36, 10], [36, 22], [0, 22]] },
    { name: 'quayE', h: TIERS.QUAY, fall: 5.0, poly: [[30, 16], [42, 16], [42, 40], [30, 40]] },

    // ---- fairground shelf, east
    { name: 'fair', h: TIERS.FAIR, fall: 7.0, poly: [[29, -20], [47, -20], [47, 8], [29, 8]] },

    // ---- the main town plateau (deep enough for two frontage bands)
    { name: 'town', h: TIERS.TOWN, fall: 6.5,
      poly: [[-16, -36], [20, -37], [27, -30], [27, 10], [20, 12], [-16, 12]] },

    // ---- upper residential terrace, west
    { name: 'terrace', h: TIERS.TERRACE, fall: 7.0, poly: [[-44, -25], [-17, -25], [-17, 16], [-44, 16]] },

    // ---- windmill knoll, north
    { name: 'knoll', h: TIERS.KNOLL, fall: 8.0, poly: [[6, -45], [22, -45], [24, -40], [24, -34], [6, -34]] },

    // ---- hilltop above the terrace, and a protected crown for the observatory
    { name: 'hill', h: TIERS.HILL, fall: 3.5, poly: Geo.polyPlan(9, 9.5).map((p) => [p[0] - 36, p[1] - 19]) },

    // ---- lighthouse rock (a raised spit east of the bay)
    { name: 'spit', h: 4.2, fall: 5.0, poly: Geo.polyPlan(7, 7.5).map((p) => [p[0] + 44, p[1] + 27]) },
  ];
  Island.PADS = PADS;
  const padByName = {};
  for (const p of PADS) padByName[p.name] = p;
  Island.pad = (n) => padByName[n];

  /* ------------------------------------------------------------
     The stream — from the hilltop down to the bay, carving a
     channel through every tier it crosses.
     ------------------------------------------------------------ */
  const STREAM = Island.STREAM = [
    [-34, -15], [-33, -10], [-31, -5], [-29, 0], [-27, 5],
    [-25, 9], [-23, 13], [-21, 17], [-19, 21], [-18, 26],
  ];

  /** pond on the upper terrace */
  const POND = { x: -35, z: 0, r: 3.8, depth: 1.0 };
  Island.POND = POND;

  /* ------------------------------------------------------------
     Geometry maths: signed distance to a polygon
     ------------------------------------------------------------ */
  function sdPoly(px, pz, poly) {
    let best = Infinity, inside = false;
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = poly[i][0], zi = poly[i][1];
      const xj = poly[j][0], zj = poly[j][1];
      // squared distance to segment j->i
      let ex = xj - xi, ez = zj - zi;
      const wx = px - xi, wz = pz - zi;
      const l2 = ex * ex + ez * ez;
      let t = l2 > 1e-9 ? (wx * ex + wz * ez) / l2 : 0;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      const dx = wx - ex * t, dz = wz - ez * t;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
      if ((zi > pz) !== (zj > pz)) {
        const xc = xi + ((pz - zi) / (zj - zi)) * (xj - xi);
        if (px < xc) inside = !inside;
      }
    }
    const d = Math.sqrt(best);
    return inside ? -d : d;
  }
  Island.sdPoly = sdPoly;

  /** distance to a polyline (open) */
  function sdLine(px, pz, pts) {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const xi = pts[i][0], zi = pts[i][1];
      const xj = pts[i + 1][0], zj = pts[i + 1][1];
      const ex = xj - xi, ez = zj - zi;
      const wx = px - xi, wz = pz - zi;
      const l2 = ex * ex + ez * ez;
      let t = l2 > 1e-9 ? (wx * ex + wz * ez) / l2 : 0;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      const dx = wx - ex * t, dz = wz - ez * t;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }
  Island.sdLine = sdLine;

  /* ------------------------------------------------------------
     THE HEIGHT MODEL
     ------------------------------------------------------------ */
  const nz = TOWN.makeNoise(4711);

  /* ------------------------------------------------------------
     RAMPS — graded corridors that let streets climb between the
     terraces at a walkable grade. Without these, every tier edge
     would be a cliff and no road could connect two levels.
     ------------------------------------------------------------ */
  const RAMPS = Island.RAMPS = [
    // town plateau  ->  harbour quay
    { name: 'toQuay', w: 7.0, fall: 4.2, h0: TIERS.TOWN, h1: TIERS.QUAY,
      pts: [[20, 3], [19, 9], [16, 14], [13, 18], [11, 21]] },
    // town plateau  ->  fairground shelf
    { name: 'toFair', w: 6.5, fall: 3.6, h0: TIERS.TOWN, h1: TIERS.FAIR,
      pts: [[24, -4], [27, -8], [29, -12], [30, -16]] },
    // town plateau  ->  upper terrace (the long hill street)
    { name: 'toTerrace', w: 7.0, fall: 4.2, h0: TIERS.TOWN, h1: TIERS.TERRACE,
      pts: [[-14.5, -1], [-17, -4], [-19.5, -7], [-22, -10], [-24, -12], [-26, -13.5]] },
  ];

  for (const r of RAMPS) {
    const cum = [0];
    let total = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      total += Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
      cum.push(total);
    }
    r.cum = cum; r.total = total;
  }

  /** projected distance + normalised arc position along a polyline */
  function projLine(px, pz, pts, cum, total) {
    let best = Infinity, bestT = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const xi = pts[i][0], zi = pts[i][1];
      const ex = pts[i + 1][0] - xi, ez = pts[i + 1][1] - zi;
      const wx = px - xi, wz = pz - zi;
      const l2 = ex * ex + ez * ez;
      let t = l2 > 1e-9 ? (wx * ex + wz * ez) / l2 : 0;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      const dx = wx - ex * t, dz = wz - ez * t;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) { best = d2; bestT = (cum[i] + t * Math.sqrt(l2)) / total; }
    }
    return { d: Math.sqrt(best), t: bestT };
  }
  Island.projLine = projLine;

  /**
   * sample(x, z) -> {y, land, tier, padW, coast, stream}
   * The single source of truth for the shape of the world.
   */
  function sample(x, z) {
    // --- coastline distance, wobbled so the shore is never a smooth curve
    let dc = sdPoly(x, z, COAST);
    dc += nz.fbm(x * 0.028, z * 0.028, 3) * 3.1 + nz.fbm(x * 0.09, z * 0.09, 2) * 0.9;

    // bay + cove carve the sea inland
    const dbay = sdPoly(x, z, BAY) + nz.fbm(x * 0.05 + 9, z * 0.05 - 4, 2) * 1.4;
    const dcove = sdPoly(x, z, COVE) + nz.fbm(x * 0.06 - 3, z * 0.06 + 7, 2) * 1.0;
    const dwater = Math.min(dbay, dcove);
    if (dwater < 0) dc = Math.max(dc, -dwater * 0.9);

    let y;
    if (dc < 0) {
      // --- land: gentle rise away from the shore
      const inland = -dc;
      y = 1.25 * U.smootherstep(0, 7, inland) + 1.0 * U.smootherstep(2, 26, inland);
    } else {
      // --- sea floor, dropping away
      y = -0.35 - 1.75 * Math.pow(dc, 0.86);
      if (y < -17) y = -17;
    }

    // --- ramp corridors are resolved first: pads, edge wobble and the
    //     stream all defer to a graded road so streets stay driveable
    // pads flagged `protect` refuse to be cut by a ramp: a road climbs to
    // their rim and stops there (used for the observatory's summit plaza)
    let protectW = 0;
    for (let i = 0; i < PADS.length; i++) {
      const pad = PADS[i];
      if (!pad.protect) continue;
      const d = sdPoly(x, z, pad.poly);
      if (d > pad.fall) continue;
      const w = U.smootherstep(pad.fall, -0.6, d);
      if (w > protectW) protectW = w;
    }

    let rampW = 0, rampH = 0;
    for (let i = 0; i < RAMPS.length; i++) {
      const r = RAMPS[i];
      const pr = projLine(x, z, r.pts, r.cum, r.total);
      const edge = r.w * 0.5;
      if (pr.d > edge + r.fall) continue;
      const w = U.smootherstep(edge + r.fall, edge - 0.4, pr.d);
      if (w > rampW) {
        rampW = w;
        rampH = U.lerp(r.h0, r.h1, U.smootherstep(0, 1, pr.t));
      }
    }
    rampW *= (1 - protectW);

    // --- plateaux
    let padW = 0, tier = 0;
    for (let i = 0; i < PADS.length; i++) {
      const pad = PADS[i];
      const d = sdPoly(x, z, pad.poly);
      if (d > pad.fall) continue;
      let w = U.smootherstep(pad.fall, -0.6, d);
      // wobble the pad edge so terraces are not perfect rectangles
      if (w > 0.02 && w < 0.98) {
        w = U.saturate(w + nz.fbm(x * 0.11 + i * 13, z * 0.11 - i * 7, 2) * 0.14 * (1 - rampW));
      }
      const cand = pad.h * w;
      if (cand > y) { y = cand; }
      if (w > padW) { padW = w; tier = pad.h; }
    }

    // --- blend the graded corridor over whatever the pads produced
    if (rampW > 0) {
      y = U.lerp(y, rampH, rampW);
      if (rampW > padW) { padW = rampW; tier = rampH; }
    }

    // --- surface relief, suppressed on the flat pads so buildings sit true
    const flat = Math.max(padW, rampW); const flat2 = flat * flat;
    const relief = nz.fbm(x * 0.055, z * 0.055, 4) * 0.62 + nz.fbm(x * 0.17, z * 0.17, 2) * 0.16;
    if (dc < 0) y += relief * (1 - flat2 * 0.94);

    // --- stream channel (suppressed inside ramp corridors: roads bridge it)
    const ds = sdLine(x, z, STREAM);
    let sc = U.smoothstep(2.9, 0.7, ds) * (1 - rampW * 0.92);
    if (sc > 0) y -= 0.85 * sc;

    // --- terrace pond
    const dp = Math.hypot(x - POND.x, z - POND.z) - POND.r;
    if (dp < 1.6) y -= POND.depth * U.smoothstep(1.6, -1.2, dp);

    return { y, land: dc < 0, tier, padW, coast: dc, stream: sc };
  }
  Island.sample = sample;

  /** rampWeight(x,z) -> 0..1 how strongly a ramp corridor owns this point */
  Island.rampWeight = function (x, z) {
    let best = 0;
    for (let i = 0; i < RAMPS.length; i++) {
      const r = RAMPS[i];
      const pr = projLine(x, z, r.pts, r.cum, r.total);
      const edge = r.w * 0.5;
      if (pr.d > edge + r.fall) continue;
      const w = U.smootherstep(edge + r.fall, edge - 0.4, pr.d);
      if (w > best) best = w;
    }
    return best;
  };

  /** rampHeight(x,z) -> the graded height of the nearest ramp, or null */
  Island.onRamp = function (x, z, tol) {
    tol = tol === undefined ? 0.6 : tol;
    for (let i = 0; i < RAMPS.length; i++) {
      const r = RAMPS[i];
      const pr = projLine(x, z, r.pts, r.cum, r.total);
      if (pr.d < r.w * 0.5 + tol) return { ramp: r, t: pr.t, d: pr.d };
    }
    return null;
  };
  Island.heightAt = (x, z) => sample(x, z).y;
  Island.landAt = (x, z) => sample(x, z).land;

  /** slopeAt — magnitude of the height gradient (for placement rules) */
  Island.slopeAt = function (x, z, e) {
    e = e || 0.9;
    const h = Island.heightAt(x, z);
    const dx = Island.heightAt(x + e, z) - h;
    const dz = Island.heightAt(x, z + e) - h;
    return Math.hypot(dx, dz) / e;
  };

  /** placeOn(obj, x, z, opts) — drop an object onto the terrain */
  Island.placeOn = function (obj, x, z, opts) {
    opts = opts || {};
    const y = Island.heightAt(x, z) + (opts.lift || 0);
    obj.position.set(x, y, z);
    if (opts.ry !== undefined) obj.rotation.y = opts.ry;
    if (opts.alignSlope) {
      const e = opts.alignSlope === true ? 1.2 : opts.alignSlope;
      const hx = Island.heightAt(x + e, z) - Island.heightAt(x - e, z);
      const hz = Island.heightAt(x, z + e) - Island.heightAt(x, z - e);
      obj.rotation.z = -Math.atan2(hx, 2 * e) * 0.8;
      obj.rotation.x = Math.atan2(hz, 2 * e) * 0.8;
    }
    return obj;
  };

  /**
   * flatSpot(x,z,w,d,rot) -> {ok, y, spread}
   * Checks a footprint for flatness — the layout uses this to refuse
   * to place a building on a slope.
   */
  Island.flatSpot = function (x, z, w, d, rot) {
    rot = rot || 0;
    const c = Math.cos(rot), s = Math.sin(rot);
    let min = Infinity, max = -Infinity, sum = 0, n = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const lx = (i * w) / 2, lz = (j * d) / 2;
        const h = Island.heightAt(x + lx * c - lz * s, z + lx * s + lz * c);
        min = Math.min(min, h); max = Math.max(max, h); sum += h; n++;
      }
    }
    return { ok: max - min < 0.85, y: sum / n, lowest: min, spread: max - min };
  };

  /* ------------------------------------------------------------
     Terrain colouring — grass / soil / rock / sand / cliff strata
     ------------------------------------------------------------ */
  const C = {
    grass: new T.Color(P.grass), grassDark: new T.Color(P.grassDark),
    grassDry: new T.Color(P.grassDry), soil: new T.Color(P.soil),
    soilDark: new T.Color(P.soilDark), rock: new T.Color(P.rock),
    rockDark: new T.Color(P.rockDark), sand: new T.Color(P.sand),
    sandWet: new T.Color(P.sandWet), deep: new T.Color(0x2b4a55),
    hedge: new T.Color(P.hedge),
  };
  const tmpC = new T.Color(), tmpC2 = new T.Color();

  function terrainColor(out, x, y, z, slope, s) {
    const n = nz.fbm(x * 0.13, z * 0.13, 3);
    const n2 = nz.fbm(x * 0.42 + 11, z * 0.42 - 5, 2);

    if (y < 0.05) {
      // underwater: wet sand near the shore, darker further out
      const t = U.saturate(-y / 6);
      out.copy(C.sandWet).lerp(C.deep, t * 0.95);
      out.offsetHSL(0, 0, n2 * 0.03);
      return;
    }
    // beach band
    const beach = U.smoothstep(1.45, 0.15, y) * U.smoothstep(0.9, 0.35, slope);
    // rock where steep, plus strata banding by height
    const rocky = U.smoothstep(0.55, 1.25, slope);
    // grass base, two tones broken by noise
    out.copy(C.grass).lerp(C.grassDark, U.saturate(0.45 + n * 0.55));
    if (n2 > 0.35) out.lerp(C.grassDry, (n2 - 0.35) * 0.7);
    // dry, sunnier grass higher up
    out.lerp(C.grassDry, U.saturate((y - 8) / 14) * 0.28);

    if (rocky > 0) {
      const band = Math.sin(y * 1.9 + n * 2.2) * 0.5 + 0.5;
      tmpC.copy(C.rock).lerp(C.rockDark, band * 0.75 + n2 * 0.2);
      // a soil layer just under the grass lip
      tmpC2.copy(C.soil).lerp(C.soilDark, band * 0.6);
      tmpC.lerp(tmpC2, U.smoothstep(1.05, 0.6, rocky) * 0.45);
      out.lerp(tmpC, rocky);
    }
    if (beach > 0) out.lerp(C.sand, beach);
    // damp margin along the stream
    if (s.stream > 0.25) out.lerp(C.hedge, U.smoothstep(0.25, 0.9, s.stream) * 0.35);
  }

  /* ------------------------------------------------------------
     Build the terrain mesh
     ------------------------------------------------------------ */
  let heightTex = null;

  function buildTerrain() {
    const step = GRID.step;
    const nx = Math.round((GRID.x1 - GRID.x0) / step) + 1;
    const nzc = Math.round((GRID.z1 - GRID.z0) / step) + 1;
    const count = nx * nzc;

    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const heights = new Float32Array(count);
    const samples = new Array(count);

    for (let j = 0; j < nzc; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = GRID.x0 + i * step, z = GRID.z0 + j * step;
        const s = sample(x, z);
        samples[k] = s;
        heights[k] = s.y;
        pos[k * 3] = x; pos[k * 3 + 1] = s.y; pos[k * 3 + 2] = z;
        uv[k * 2] = i / (nx - 1); uv[k * 2 + 1] = j / (nzc - 1);
      }
    }

    // slope from the height field, then colour
    const c = new T.Color();
    for (let j = 0; j < nzc; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const kx = j * nx + Math.min(nx - 1, i + 1);
        const kz = Math.min(nzc - 1, j + 1) * nx + i;
        const slope = Math.hypot(heights[kx] - heights[k], heights[kz] - heights[k]) / step;
        terrainColor(c, pos[k * 3], heights[k], pos[k * 3 + 2], slope, samples[k]);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
    }

    // indices — skip quads that are deep underwater far from shore
    const idx = [];
    for (let j = 0; j < nzc - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
        if (heights[a] < -13 && heights[b] < -13 && heights[d] < -13 && heights[e] < -13) continue;
        idx.push(a, d, b, b, d, e);
      }
    }

    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();

    const mat = Mat.std(0xffffff, {
      vertexColors: true, rough: 0.9, metal: 0, name: 'terrain',
    });
    const mesh = new T.Mesh(g, mat);
    mesh.name = 'terrain';
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    // --- bake the height field into a texture for the water shader
    const HT = 256;
    const data = new Uint8Array(HT * HT);   // R8: height packed over [-8, +8] m
    const hx0 = GRID.x0, hz0 = GRID.z0, hsx = GRID.x1 - GRID.x0, hsz = GRID.z1 - GRID.z0;
    for (let j = 0; j < HT; j++) {
      for (let i = 0; i < HT; i++) {
        const x = hx0 + (i / (HT - 1)) * hsx;
        const z = hz0 + (j / (HT - 1)) * hsz;
        // bilinear from the grid we already computed
        const fi = (x - GRID.x0) / step, fj = (z - GRID.z0) / step;
        const i0 = U.clamp(Math.floor(fi), 0, nx - 2), j0 = U.clamp(Math.floor(fj), 0, nzc - 2);
        const tx = U.saturate(fi - i0), tz = U.saturate(fj - j0);
        const h00 = heights[j0 * nx + i0], h10 = heights[j0 * nx + i0 + 1];
        const h01 = heights[(j0 + 1) * nx + i0], h11 = heights[(j0 + 1) * nx + i0 + 1];
        const hh = U.lerp(U.lerp(h00, h10, tx), U.lerp(h01, h11, tx), tz);
        data[j * HT + i] = Math.round(U.saturate((U.clamp(hh, -8, 8) + 8) / 16) * 255);
      }
    }
    heightTex = new T.DataTexture(data, HT, HT, T.RedFormat, T.UnsignedByteType);
    heightTex.minFilter = heightTex.magFilter = T.LinearFilter;
    heightTex.wrapS = heightTex.wrapT = T.ClampToEdgeWrapping;
    heightTex.needsUpdate = true;
    Island.heightTexInfo = { tex: heightTex, origin: [hx0, hz0], size: [hsx, hsz] };

    Island.stats = { verts: count, tris: idx.length / 3 };
    return mesh;
  }

  /* ------------------------------------------------------------
     WATER — MeshStandardMaterial patched via onBeforeCompile so it
     keeps three's lighting, fog, tone mapping and env reflections
     while gaining waves, depth colour and shoreline foam.
     ------------------------------------------------------------ */
  function buildWater() {
    const grp = TOWN.group('water');

    const uniforms = {
      uTime: { value: 0 },
      uHeightMap: { value: heightTex },
      uHOrigin: { value: new T.Vector2(Island.heightTexInfo.origin[0], Island.heightTexInfo.origin[1]) },
      uHSize: { value: new T.Vector2(Island.heightTexInfo.size[0], Island.heightTexInfo.size[1]) },
      uShallow: { value: new T.Color(P.waterShallow) },
      uDeep: { value: new T.Color(P.waterDeep) },
      uFoam: { value: new T.Color(P.foam) },
      uSky: { value: new T.Color(0x9fd0e8) },
      uSunDir: { value: new T.Vector3(0.4, 0.7, 0.3) },
      uSunCol: { value: new T.Color(0xffffff) },
      uNight: { value: 0 },
      uWave: { value: 1 },
    };
    Island.waterUniforms = uniforms;

    const mat = new T.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.09,
      metalness: 0.02,
      transparent: true,
      opacity: 0.93,
      side: T.FrontSide,
      envMapIntensity: 1.35,
      name: 'sea',
    });

    mat.onBeforeCompile = function (shader) {
      Object.assign(shader.uniforms, uniforms);

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `
          #include <common>
          uniform float uTime;
          uniform float uWave;
          uniform sampler2D uHeightMap;
          uniform vec2 uHOrigin;
          uniform vec2 uHSize;
          varying vec3 vWPos;
          varying float vDepth;
          varying float vCrest;

          float terrainH(vec2 wxz){
            vec2 uv = (wxz - uHOrigin) / uHSize;
            return texture2D(uHeightMap, clamp(uv, 0.002, 0.998)).r * 16.0 - 8.0;
          }
          // four crossed swells; returns height, writes gradient
          float swell(vec2 p, float t, out vec2 grad){
            float h = 0.0; grad = vec2(0.0);
            vec2 d1 = vec2(0.86, 0.51), d2 = vec2(-0.42, 0.91);
            vec2 d3 = vec2(0.62, -0.78), d4 = vec2(-0.94, -0.34);
            float a1 = 0.075, a2 = 0.052, a3 = 0.030, a4 = 0.019;
            float f1 = 0.145, f2 = 0.215, f3 = 0.410, f4 = 0.760;
            float s1 = 1.05, s2 = 1.55, s3 = 2.35, s4 = 3.30;
            float p1 = dot(p,d1)*f1 + t*s1; h += sin(p1)*a1; grad += cos(p1)*a1*f1*d1;
            float p2 = dot(p,d2)*f2 + t*s2; h += sin(p2)*a2; grad += cos(p2)*a2*f2*d2;
            float p3 = dot(p,d3)*f3 + t*s3; h += sin(p3)*a3; grad += cos(p3)*a3*f3*d3;
            float p4 = dot(p,d4)*f4 + t*s4; h += sin(p4)*a4; grad += cos(p4)*a4*f4*d4;
            return h;
          }
        `)
        .replace('#include <beginnormal_vertex>', `
          #include <beginnormal_vertex>
          {
            vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
            float th = terrainH(wp0.xz);
            float shore = clamp((-th) / 3.0, 0.0, 1.0);
            float amp = mix(0.28, 1.0, shore) * uWave;
            vec2 grad;
            swell(wp0.xz, uTime, grad);
            grad *= amp;
            objectNormal = normalize(vec3(-grad.x, 1.0, -grad.y));
          }
        `)
        .replace('#include <begin_vertex>', `
          #include <begin_vertex>
          {
            vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
            float th = terrainH(wp0.xz);
            float shore = clamp((-th) / 3.0, 0.0, 1.0);
            float amp = mix(0.28, 1.0, shore) * uWave;
            vec2 grad;
            float h = swell(wp0.xz, uTime, grad) * amp;
            transformed.y += h;
            vWPos = wp0 + vec3(0.0, h, 0.0);
            vDepth = -th;
            vCrest = h;
          }
        `);

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `
          #include <common>
          uniform float uTime;
          uniform vec3 uShallow;
          uniform vec3 uDeep;
          uniform vec3 uFoam;
          uniform vec3 uSky;
          uniform vec3 uSunDir;
          uniform vec3 uSunCol;
          uniform float uNight;
          varying vec3 vWPos;
          varying float vDepth;
          varying float vCrest;
          float hash21(vec2 p){ p = fract(p*vec2(123.34,345.45)); p += dot(p,p+34.345); return fract(p.x*p.y); }
          float vnoise(vec2 p){
            vec2 i = floor(p), f = fract(p);
            f = f*f*(3.0-2.0*f);
            float a = hash21(i), b = hash21(i+vec2(1.0,0.0));
            float c = hash21(i+vec2(0.0,1.0)), d = hash21(i+vec2(1.0,1.0));
            return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
          }
        `)
        .replace('#include <color_fragment>', `
          #include <color_fragment>
          {
            float dep = clamp(vDepth / 7.0, 0.0, 1.0);
            vec3 wcol = mix(uShallow, uDeep, pow(dep, 0.7));

            // sun glitter
            vec3 V = normalize(cameraPosition - vWPos);
            vec3 N = normalize(vNormal);
            vec3 H = normalize(uSunDir + V);
            float spec = pow(max(dot(N, H), 0.0), 220.0);
            float sparkle = pow(max(dot(N, H), 0.0), 40.0) * 0.16;

            // fresnel toward the sky colour
            float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.4);
            wcol = mix(wcol, uSky, fres * 0.66);

            // shoreline foam + wave-crest foam
            float shoreT = 1.0 - smoothstep(0.02, 0.85, vDepth);
            float band = vnoise(vWPos.xz * 1.5 - vec2(uTime * 0.35, uTime * 0.22));
            float lace = smoothstep(0.42, 0.95, band * 0.65 + shoreT * 0.85);
            float foam = shoreT * lace;
            foam += smoothstep(0.055, 0.11, vCrest) * 0.30;
            // wet-sand darkening right at the waterline
            wcol = mix(wcol, uShallow * 1.18, smoothstep(0.6, 0.0, vDepth) * 0.5);
            wcol = mix(wcol, uFoam, clamp(foam, 0.0, 0.85));

            wcol += uSunCol * (spec * 1.5 + sparkle) * (1.0 - uNight * 0.55);
            wcol *= mix(1.0, 0.42, uNight);

            diffuseColor.rgb *= wcol;
            diffuseColor.a *= mix(0.70, 0.97, smoothstep(0.0, 2.2, vDepth));
          }
        `);
    };
    // force a unique program so the patch is not shared with other std materials
    mat.customProgramCacheKey = () => 'seaWater';

    const plane = new T.PlaneGeometry(300, 300, 150, 150);
    plane.rotateX(-Math.PI / 2);
    const sea = new T.Mesh(plane, mat);
    sea.name = 'sea';
    sea.receiveShadow = false;
    sea.renderOrder = 2;
    grp.add(sea);
    Island.sea = sea;

    // --- far ocean out to the horizon (cheap, no waves)
    const farMat = Mat.std(P.waterDeep, { rough: 0.22, metal: 0.05, name: 'seaFar' });
    const far = new T.Mesh(new T.RingGeometry(146, 2400, 64, 4), farMat);
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.12;
    far.renderOrder = 1;
    grp.add(far);
    Island.seaFar = far;

    return grp;
  }

  /* ------------------------------------------------------------
     STREAM water surface — a flowing ribbon down the terraces
     ------------------------------------------------------------ */
  function buildStream() {
    const grp = TOWN.group('stream');
    const pts = [];
    const path = Geo.catmullPath(STREAM.map((p) => [p[0], 0, p[1]]), false, 150).poly;
    for (const p of path) {
      const y = Island.heightAt(p[0], p[2]);
      pts.push([p[0], y + 0.30, p[2]]);
    }
    // widen toward the mouth
    const geo = Geo.ribbon(pts, 2.4, { widthFn: (t) => 1.9 + t * 2.6 });

    // proper UVs: u across, v along
    const posA = geo.attributes.position;
    const uvA = geo.attributes.uv;
    const n = pts.length;
    let vi = 0;
    // ribbon() emits quads as two triangles in fromQuads order
    for (let i = 0; i < n - 1; i++) {
      const v0 = i / (n - 1), v1 = (i + 1) / (n - 1);
      const set = (u, v) => { uvA.setXY(vi++, u, v); };
      set(0, v0); set(1, v0); set(1, v1);
      set(0, v0); set(1, v1); set(0, v1);
    }
    uvA.needsUpdate = true;
    posA.needsUpdate = true;

    const uniforms = {
      uTime: { value: 0 },
      uShallow: { value: new T.Color(0x8fd3d0) },
      uDeep: { value: new T.Color(0x3c8fa0) },
      uNight: { value: 0 },
    };
    Island.streamUniforms = uniforms;

    const mat = new T.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.12, metalness: 0.0,
      transparent: true, opacity: 0.88, name: 'stream',
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      // MeshStandardMaterial only declares vUv when a texture is bound,
      // so carry our own UV varying through.
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vSUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `
          #include <common>
          varying vec2 vSUv;
          uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform float uNight;
          float h21(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
          float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
        `)
        .replace('#include <color_fragment>', `
          #include <color_fragment>
          {
            vec2 fuv = vec2(vSUv.x * 3.0, vSUv.y * 46.0 - uTime * 1.35);
            float rip = vn(fuv) * 0.6 + vn(fuv * 2.3 + 7.0) * 0.4;
            vec3 c = mix(uDeep, uShallow, rip);
            // white water along the banks and in the ripples
            float edge = smoothstep(0.34, 0.0, abs(vSUv.x - 0.5) * 2.0 - 0.55);
            c = mix(c, vec3(0.94, 0.99, 0.99), smoothstep(0.72, 0.95, rip) * 0.55 + edge * 0.25);
            c *= mix(1.0, 0.45, uNight);
            diffuseColor.rgb *= c;
          }
        `);
    };
    mat.customProgramCacheKey = () => 'streamWater';

    const mesh = new T.Mesh(geo, mat);
    mesh.name = 'streamWater';
    mesh.renderOrder = 3;
    grp.add(mesh);

    // --- pond surface on the terrace
    const pondPts = Geo.polyPlan(20, POND.r * 0.94).map((p) => [p[0] + POND.x, p[1] + POND.z]);
    const pondGeo = Geo.prism(pondPts, 0.02, { y0: 0 });
    const pondY = Island.heightAt(POND.x, POND.z) + POND.depth * 0.72;
    const pond = new T.Mesh(pondGeo, mat);
    pond.position.y = pondY;
    pond.renderOrder = 3;
    grp.add(pond);
    Island.pondY = pondY;

    Island.streamPoints = pts;
    return grp;
  }

  /* ------------------------------------------------------------
     Terrace edges: retaining walls + stairs where tiers meet.
     These crisp architectural edges are what make the height
     changes read as *designed* terraces rather than lumpy ground.
     ------------------------------------------------------------ */
  const WALLS = [
    // town plateau / upper terrace boundary (runs north-south)
    { pts: [[-16.6, -24], [-16.2, -15], [-16.6, -6], [-16.2, 4], [-16.6, 11]], h: 2.6 },
    // town plateau above the harbour quay
    { pts: [[-5, 11.6], [6, 11.9], [15, 11.6], [21, 11.4]], h: 2.5 },
    // knoll, south edge above the town
    { pts: [[6.6, -33.6], [12, -33.2], [18, -33.6], [23.4, -33.2]], h: 5.6 },
    // quay walls around the bay
    { pts: [[8.6, 13], [8.9, 22], [8.6, 32], [8.9, 42]], h: 2.6, style: 'quay' },
    { pts: [[1, 21.6], [10, 21.9], [20, 21.6], [30, 21.9]], h: 2.6, style: 'quay' },
    { pts: [[30.4, 17], [30.1, 27], [30.4, 37]], h: 2.6, style: 'quay' },
    // fairground shelf, west edge
    { pts: [[27.4, -19], [27.0, -9], [27.4, 1], [27.0, 7]], h: 1.6 },
    // terrace seaward edge above the beach
    { pts: [[-42, 15.4], [-34, 15.0], [-26, 15.4], [-18, 15.0]], h: 3.0 },
  ];

  const STAIRS = [
    { x: -16.4, z: -9, ry: Math.PI / 2, w: 4.2, from: TIERS.TOWN, to: TIERS.TERRACE },
    { x: -16.4, z: 5, ry: Math.PI / 2, w: 3.4, from: TIERS.TOWN, to: TIERS.TERRACE },
    { x: 15, z: -33.6, ry: 0, w: 3.8, from: TIERS.TOWN, to: TIERS.KNOLL },
    { x: 8, z: 11.7, ry: Math.PI, w: 3.6, from: TIERS.QUAY, to: TIERS.TOWN },
    { x: 19, z: 11.5, ry: Math.PI, w: 3.0, from: TIERS.QUAY, to: TIERS.TOWN },
    { x: 27.2, z: -4, ry: -Math.PI / 2, w: 3.0, from: TIERS.FAIR, to: TIERS.TOWN },
    { x: -28.0, z: -11.0, ry: -1.15, w: 3.0, from: TIERS.TERRACE, to: TIERS.HILL },
    { x: -43.0, z: -8.0, ry: 2.3, w: 2.6, from: TIERS.TERRACE, to: TIERS.HILL },
  ];


  function buildEdges() {
    const grp = TOWN.group('edges');
    const stoneMat = Mat.std(P.stone, { rough: 0.85, flat: true, name: 'wallStone' });
    const quayMat = Mat.std(P.stoneDark, { rough: 0.88, flat: true, name: 'wallQuay' });
    const copeMat = Mat.std(P.stoneWarm, { rough: 0.8, name: 'wallCope' });

    for (const w of WALLS) {
      // resample the polyline so the wall follows the terrain lip
      const dense = Geo.catmullPath(w.pts.map((p) => [p[0], 0, p[1]]), false, Math.max(8, w.pts.length * 8)).poly;
      // break the run wherever a ramp/road cuts through, so streets pass freely
      const runs = [];
      let cur = [];
      for (const p of dense) {
        const blocked = Island.rampWeight(p[0], p[2]) > 0.30;
        if (blocked) { if (cur.length > 2) runs.push(cur); cur = []; }
        else cur.push([p[0], p[2]]);
      }
      if (cur.length > 2) runs.push(cur);
      for (const run of runs) {
        const geo = Geo.retainingWall(run, w.h, { thick: w.style === 'quay' ? 0.75 : 0.6, batter: 0.16 });
        const m = new T.Mesh(geo, w.style === 'quay' ? quayMat : stoneMat);
        // sit the wall so its coping is level with the upper tier
        const top = Math.max.apply(null, run.map((p) => Island.heightAt(p[0], p[1])));
        m.position.y = top - w.h + 0.05;
        m.castShadow = true; m.receiveShadow = true;
        grp.add(m);
      }
    }

    for (const s of STAIRS) {
      const rise = s.to - s.from;
      const steps = Math.max(4, Math.round(rise / 0.34));
      const run = rise * 1.5;
      const geo = Geo.stairs(s.w, rise, run, steps);
      const m = new T.Mesh(geo, copeMat);
      m.position.set(s.x, s.from - 0.1, s.z);
      m.rotation.y = s.ry;
      m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
      // cheek walls
      for (const side of [-1, 1]) {
        const cheek = Geo.taperBox(0.4, rise + 0.5, run, 1, 1);
        const cm = new T.Mesh(cheek, stoneMat);
        cm.position.set(
          s.x + Math.cos(s.ry) * side * (s.w / 2 + 0.2),
          s.from - 0.2,
          s.z - Math.sin(s.ry) * side * (s.w / 2 + 0.2)
        );
        cm.rotation.y = s.ry;
        cm.castShadow = true; cm.receiveShadow = true;
        grp.add(cm);
      }
    }
    Geo.mergeStatic(grp);
    return grp;
  }

  /* ------------------------------------------------------------
     build()
     ------------------------------------------------------------ */
  Island.build = function (scene) {
    const root = TOWN.group('island');
    const t0 = performance.now();

    root.add(buildTerrain());
    root.add(buildWater());
    root.add(buildStream());
    root.add(buildEdges());

    if (scene) scene.add(root);
    Island.root = root;
    Island.buildMs = performance.now() - t0;

    // water animation + day/night response
    TOWN.Ticker.add(function (dt, t, Env) {
      const wu = Island.waterUniforms, su = Island.streamUniforms;
      if (wu) {
        wu.uTime.value = t;
        wu.uSunDir.value.copy(Env.sunUp ? Env.sunDir : Env.moonDir);
        wu.uSunCol.value.copy(Env.sunUp ? Env.sunColor : new T.Color(0x8fa8d8));
        wu.uSky.value.copy(Env.horizonColor);
        wu.uNight.value = 1 - Env.dayF;
      }
      if (su) { su.uTime.value = t; su.uNight.value = 1 - Env.dayF; }
      if (Island.seaFar) {
        Island.seaFar.material.color.copy(Env.horizonColor).lerp(new T.Color(P.waterDeep), 0.62);
      }
    }, 'island-water', { always: true });

    console.log('[TOWN] island built in ' + Island.buildMs.toFixed(0) + 'ms · ' +
      Island.stats.tris + ' tris');
    return root;
  };

  console.log('[TOWN] island ready');
})(window);
