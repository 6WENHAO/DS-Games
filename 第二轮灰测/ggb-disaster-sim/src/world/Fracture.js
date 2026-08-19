import * as THREE from 'three';

/**
 * Fracture.js — pre-fracture geometry generation.
 *
 * WHY 2D VORONOI PRISMS RATHER THAN A 3D VORONOI/TETRA SHATTER
 * -----------------------------------------------------------
 * The bridge deck is a slab: it is two orders of magnitude longer than it is
 * thick. A full 3D Voronoi shatter would spend most of its cells resolving
 * detail through 7.6 m of thickness that the camera never sees, and would hand
 * Rapier hundreds of sliver convex hulls — the exact input that makes a solver
 * jitter. Fracturing in the deck plane and extruding gives:
 *   • well-conditioned, fat convex hulls (great solver behaviour),
 *   • a silhouette that reads exactly like real bending-failure fragmentation,
 *   • cells that are convex by construction, so the cap triangulation is a
 *     trivial fan and the collider is a guaranteed-valid convex hull.
 *
 * Cells are produced by clipping the deck rectangle with the perpendicular
 * bisector half-plane between a site and each of its neighbours (Sutherland–
 * Hodgman). That is the textbook definition of a Voronoi cell and needs no
 * Delaunay triangulation at all.
 *
 * Everything is driven by a seeded PRNG: the same bridge shatters the same way
 * on every reload, which is what makes the "pause and compare" feature honest.
 */

/** Small, fast, deterministic PRNG (mulberry32). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clip convex polygon `poly` to the half-plane of points closer to A than B. */
function clipToBisector(poly, ax, az, bx, bz) {
  const mx = (ax + bx) * 0.5;
  const mz = (az + bz) * 0.5;
  const nx = bx - ax;      // half-plane normal points away from A
  const nz = bz - az;
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const dp = (p[0] - mx) * nx + (p[1] - mz) * nz;
    const dq = (q[0] - mx) * nx + (q[1] - mz) * nz;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

function polygonArea(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a * 0.5;
}

function polygonCentroid(poly) {
  let cx = 0, cz = 0, a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const cross = p[0] * q[1] - q[0] * p[1];
    a += cross;
    cx += (p[0] + q[0]) * cross;
    cz += (p[1] + q[1]) * cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) return [poly[0][0], poly[0][1]];
  return [cx / (6 * a), cz / (6 * a)];
}

/**
 * Voronoi-partition a rectangle centred on the origin, in the XZ plane.
 * @returns {Array<{site:[number,number], polygon:number[][], centroid:[number,number], area:number}>}
 */
export function voronoiRect(width, depth, nx, nz, jitter, seed) {
  const rng = makeRng(seed);
  const hw = width * 0.5, hd = depth * 0.5;
  const cellW = width / nx, cellD = depth / nz;

  // Jittered-grid sites: keeps cell sizes even (no giant/sliver outliers) while
  // still looking organic. Pure random sites produce unusable size variance.
  const sites = [];
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const jx = (rng() - 0.5) * jitter * cellW;
      const jz = (rng() - 0.5) * jitter * cellD;
      sites.push([
        -hw + (ix + 0.5) * cellW + jx,
        -hd + (iz + 0.5) * cellD + jz,
        ix, iz,
      ]);
    }
  }

  const rect = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  const cells = [];

  for (let i = 0; i < sites.length; i++) {
    const [ax, az, ix, iz] = sites[i];
    let poly = rect;
    // Only neighbours within 2 grid steps can contribute a bounding bisector.
    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue;
      const s = sites[j];
      if (Math.abs(s[2] - ix) > 2 || Math.abs(s[3] - iz) > 2) continue;
      poly = clipToBisector(poly, ax, az, s[0], s[1]);
      if (poly.length < 3) break;
    }
    if (poly.length < 3) continue;
    const area = Math.abs(polygonArea(poly));
    if (area < 1e-4) continue;
    cells.push({ site: [ax, az], polygon: poly, centroid: polygonCentroid(poly), area });
  }
  return cells;
}

/**
 * Extrude a convex XZ polygon into a solid prism, centred on its own centroid
 * so the mesh origin coincides with the rigid body origin.
 *
 * Faces are vertex-coloured by role, which is what sells a fracture visually:
 * the road surface stays asphalt, the original outer flanks stay painted
 * International Orange, and newly exposed interior faces are raw light concrete.
 *
 * @param {object} o
 * @param {number[][]} o.polygon
 * @param {number} o.thickness
 * @param {(edgeA:number[], edgeB:number[]) => boolean} [o.isOuterEdge]
 * @param {THREE.Color} o.topColor
 * @param {THREE.Color} o.bottomColor
 * @param {THREE.Color} o.outerColor
 * @param {THREE.Color} o.innerColor
 */
export function extrudePrism(o) {
  const { polygon, thickness } = o;
  const [cx, cz] = polygonCentroid(polygon);
  const hy = thickness * 0.5;
  const n = polygon.length;

  // Local, centroid-relative footprint. Winding is normalised to CCW so the
  // cap normals are predictable.
  let ring = polygon.map(([x, z]) => [x - cx, z - cz]);
  if (polygonArea(ring) < 0) ring = ring.reverse();

  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];

  const pushVert = (x, y, z, nxv, nyv, nzv, u, v, c) => {
    pos.push(x, y, z);
    nor.push(nxv, nyv, nzv);
    uv.push(u, v);
    col.push(c.r, c.g, c.b);
  };

  // ---- caps (fan triangulation is valid: the cell is convex) ----
  for (let i = 1; i < n - 1; i++) {
    const a = ring[0], b = ring[i], c = ring[i + 1];
    // top (+Y)
    pushVert(a[0], hy, a[1], 0, 1, 0, a[0] * 0.05, a[1] * 0.05, o.topColor);
    pushVert(b[0], hy, b[1], 0, 1, 0, b[0] * 0.05, b[1] * 0.05, o.topColor);
    pushVert(c[0], hy, c[1], 0, 1, 0, c[0] * 0.05, c[1] * 0.05, o.topColor);
    // bottom (-Y), reversed winding
    pushVert(a[0], -hy, a[1], 0, -1, 0, a[0] * 0.05, a[1] * 0.05, o.bottomColor);
    pushVert(c[0], -hy, c[1], 0, -1, 0, c[0] * 0.05, c[1] * 0.05, o.bottomColor);
    pushVert(b[0], -hy, b[1], 0, -1, 0, b[0] * 0.05, b[1] * 0.05, o.bottomColor);
  }

  // ---- side walls ----
  let arc = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    const wa = polygon[i], wb = polygon[(i + 1) % n];
    const ex = b[0] - a[0], ez = b[1] - a[1];
    const len = Math.hypot(ex, ez) || 1e-6;
    // Outward normal of a CCW ring in XZ is (dz, 0, -dx).
    const nx = ez / len, nz = -ex / len;
    const isOuter = o.isOuterEdge ? o.isOuterEdge(wa, wb) : false;
    const c = isOuter ? o.outerColor : o.innerColor;
    const u0 = arc * 0.04, u1 = (arc + len) * 0.04;
    arc += len;

    pushVert(a[0], -hy, a[1], nx, 0, nz, u0, 0, c);
    pushVert(b[0], -hy, b[1], nx, 0, nz, u1, 0, c);
    pushVert(b[0], hy, b[1], nx, 0, nz, u1, 1, c);

    pushVert(a[0], -hy, a[1], nx, 0, nz, u0, 0, c);
    pushVert(b[0], hy, b[1], nx, 0, nz, u1, 1, c);
    pushVert(a[0], hy, a[1], nx, 0, nz, u0, 1, c);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

  // Collider hull: the 2n prism corners. Rapier builds the convex hull itself,
  // so duplicated/degenerate render vertices never reach the solver.
  const hull = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    hull[i * 6 + 0] = ring[i][0]; hull[i * 6 + 1] = -hy; hull[i * 6 + 2] = ring[i][1];
    hull[i * 6 + 3] = ring[i][0]; hull[i * 6 + 4] = hy;  hull[i * 6 + 5] = ring[i][1];
  }

  return {
    geometry: g,
    hull,
    localCentroid: new THREE.Vector3(cx, 0, cz),
    volume: Math.abs(polygonArea(ring)) * thickness,
  };
}

/**
 * Box rubble: split an axis-aligned box into a jittered 3D grid of sub-boxes.
 * Used for the towers, where real failure is dominated by the riveted cell
 * structure and reads as blocky masonry-like fragmentation rather than shards.
 */
export function boxRubble(o) {
  const { size, divisions, jitter, seed, topColor, innerColor, outerColor } = o;
  const rng = makeRng(seed);
  const [dx, dy, dz] = divisions;
  const chunks = [];

  // Plane positions per axis with jitter, so cut lines do not line up.
  const axis = (n, total) => {
    const p = [0];
    for (let i = 1; i < n; i++) p.push((i / n + (rng() - 0.5) * (jitter / n)) * total);
    p.push(total);
    return p;
  };
  const xs = axis(dx, size.x);
  const ys = axis(dy, size.y);
  const zs = axis(dz, size.z);

  for (let i = 0; i < dx; i++) {
    for (let j = 0; j < dy; j++) {
      for (let k = 0; k < dz; k++) {
        const w = xs[i + 1] - xs[i];
        const h = ys[j + 1] - ys[j];
        const d = zs[k + 1] - zs[k];
        if (w < 0.05 || h < 0.05 || d < 0.05) continue;

        const g = new THREE.BoxGeometry(w, h, d);
        // Colour the outer skin orange, interior cuts raw concrete.
        const colors = [];
        const p = g.attributes.position;
        const nAttr = g.attributes.normal;
        for (let v = 0; v < p.count; v++) {
          const nx = nAttr.getX(v), ny = nAttr.getY(v), nz2 = nAttr.getZ(v);
          let c = innerColor;
          if (ny > 0.5 && j === dy - 1) c = topColor;
          else if ((nx > 0.5 && i === dx - 1) || (nx < -0.5 && i === 0)
                || (nz2 > 0.5 && k === dz - 1) || (nz2 < -0.5 && k === 0)) c = outerColor;
          colors.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        g.deleteAttribute('uv');
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));

        chunks.push({
          geometry: g.toNonIndexed(),
          hull: null,
          halfExtents: new THREE.Vector3(w * 0.5, h * 0.5, d * 0.5),
          offset: new THREE.Vector3(
            xs[i] + w * 0.5 - size.x * 0.5,
            ys[j] + h * 0.5,
            zs[k] + d * 0.5 - size.z * 0.5,
          ),
          volume: w * h * d,
        });
        g.dispose();
      }
    }
  }
  return chunks;
}
