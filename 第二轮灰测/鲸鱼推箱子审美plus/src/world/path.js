/**
 * The dirt road.
 *
 * A Catmull-Rom spline is baked into a polyline and bucketed into a uniform
 * grid, so the ~100k distance queries needed to carve the terrain and thin the
 * grass stay cheap. The same spline drives the crate that tumbles along the
 * road on the title screen.
 */
import * as THREE from 'three';
import { fbm2, smoothstep, clamp } from './noise.js';

const CELL = 4;

export class RoadPath {
  /**
   * @param {THREE.Vector3[]} controls control points in XZ (y is ignored)
   * @param {object} opts
   */
  constructor(controls, { samples = 900, halfWidth = 2.05, widthVariance = 0.55, seed = 771 } = {}) {
    this.curve = new THREE.CatmullRomCurve3(controls.map((p) => p.clone()), false, 'catmullrom', 0.5);
    this.baseHalfWidth = halfWidth;
    this.widthVariance = widthVariance;
    this.seed = seed;

    const pts = this.curve.getSpacedPoints(samples);
    this.points = pts;
    this.count = pts.length;

    // Arc length table for even travel speed.
    this.arc = new Float32Array(this.count);
    let total = 0;
    for (let i = 1; i < this.count; i += 1) {
      total += pts[i].distanceTo(pts[i - 1]);
      this.arc[i] = total;
    }
    this.length = total;

    this.grid = new Map();
    for (let i = 0; i < this.count; i += 1) {
      const key = this.cellKey(pts[i].x, pts[i].z);
      let bucket = this.grid.get(key);
      if (!bucket) { bucket = []; this.grid.set(key, bucket); }
      bucket.push(i);
    }
    this.heights = new Float32Array(this.count);
  }

  cellKey(x, z) {
    return `${Math.floor(x / CELL)}|${Math.floor(z / CELL)}`;
  }

  /** Half-width of the road bed at normalised position t, with a wandering edge. */
  halfWidthAt(t, x = 0, z = 0) {
    const wobble = fbm2(t * 9.5, 3.1, { seed: this.seed, octaves: 3 }) - 0.5;
    const edge = fbm2(x * 0.22, z * 0.22, { seed: this.seed + 31, octaves: 2 }) - 0.5;
    return this.baseHalfWidth * (1 + wobble * this.widthVariance) + edge * 0.7;
  }

  /**
   * Nearest point on the road.
   * @returns {{dist:number, t:number, index:number}}
   */
  nearest(x, z) {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = Infinity;
    let bestIndex = -1;
    let radius = 1;
    while (bestIndex < 0 && radius <= 6) {
      for (let gz = cz - radius; gz <= cz + radius; gz += 1) {
        for (let gx = cx - radius; gx <= cx + radius; gx += 1) {
          const bucket = this.grid.get(`${gx}|${gz}`);
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k += 1) {
            const i = bucket[k];
            const p = this.points[i];
            const dx = p.x - x;
            const dz = p.z - z;
            const d2 = dx * dx + dz * dz;
            if (d2 < best) { best = d2; bestIndex = i; }
          }
        }
      }
      radius += 2;
    }
    if (bestIndex < 0) return { dist: Infinity, t: 0, index: 0 };
    return {
      dist: Math.sqrt(best),
      t: bestIndex / (this.count - 1),
      index: bestIndex,
    };
  }

  /**
   * Road coverage in [0,1]: 1 on the packed centre, 0 in unbroken grass.
   * The soft shoulder is where grass thins out and gravel shows through.
   */
  maskAt(x, z, nearestResult = null) {
    const n = nearestResult || this.nearest(x, z);
    if (!isFinite(n.dist)) return 0;
    const hw = this.halfWidthAt(n.t, x, z);
    return 1 - smoothstep(hw * 0.62, hw * 1.28, n.dist);
  }

  /** Bake the longitudinal profile so the road reads as a graded surface. */
  bakeProfile(sampleHeight, smoothing = 26) {
    const raw = new Float32Array(this.count);
    for (let i = 0; i < this.count; i += 1) {
      raw[i] = sampleHeight(this.points[i].x, this.points[i].z);
    }
    for (let i = 0; i < this.count; i += 1) {
      let sum = 0;
      let n = 0;
      for (let k = -smoothing; k <= smoothing; k += 1) {
        const j = clamp(i + k, 0, this.count - 1);
        const w = 1 - Math.abs(k) / (smoothing + 1);
        sum += raw[j] * w;
        n += w;
      }
      this.heights[i] = sum / n;
    }
    for (let i = 0; i < this.count; i += 1) this.points[i].y = this.heights[i];
  }

  heightAtIndex(index) {
    return this.heights[clamp(index, 0, this.count - 1)];
  }

  /** Position along the road by normalised arc length. */
  pointAtDistance(distance, out = new THREE.Vector3()) {
    const d = ((distance % this.length) + this.length) % this.length;
    let lo = 0;
    let hi = this.count - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.arc[mid] <= d) lo = mid; else hi = mid;
    }
    const a = this.points[lo];
    const b = this.points[hi];
    const span = Math.max(1e-5, this.arc[hi] - this.arc[lo]);
    const f = (d - this.arc[lo]) / span;
    out.lerpVectors(a, b, f);
    return out;
  }

  tangentAtDistance(distance, out = new THREE.Vector3()) {
    const eps = Math.max(0.35, this.length * 0.0008);
    const a = this.pointAtDistance(distance - eps, new THREE.Vector3());
    const b = this.pointAtDistance(distance + eps, new THREE.Vector3());
    return out.subVectors(b, a).normalize();
  }
}

/**
 * The road: it enters low on the west rim, meanders across the basin, runs
 * along the south verge of the garden plot, and climbs out to the east.
 */
export function createRoad(worldSize) {
  const h = worldSize * 0.5;
  const controls = [
    new THREE.Vector3(-h - 8, 0, 27),
    new THREE.Vector3(-56, 0, 22.5),
    new THREE.Vector3(-38, 0, 14.5),
    new THREE.Vector3(-22, 0, 10.0),
    new THREE.Vector3(-8, 0, 13.5),
    new THREE.Vector3(3.5, 0, 10.0),
    new THREE.Vector3(13.0, 0, 4.0),
    new THREE.Vector3(20.0, 0, -6.0),
    new THREE.Vector3(30.0, 0, -9.5),
    new THREE.Vector3(42.0, 0, -10.5),
    new THREE.Vector3(54.0, 0, -6.0),
    new THREE.Vector3(66.0, 0, 2.5),
    new THREE.Vector3(h + 8, 0, 11.0),
  ];
  return new RoadPath(controls, { samples: 1100, halfWidth: 2.15, widthVariance: 0.5 });
}
