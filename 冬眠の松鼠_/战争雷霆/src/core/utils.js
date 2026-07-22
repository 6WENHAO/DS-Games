import * as THREE from 'three';

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function moveAngleTowards(cur, target, maxStep) {
  const d = angleDelta(cur, target);
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}

/** 确定性伪随机 */
export function makeRNG(seed = 1) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 2D value noise（用于地形与贴图生成） */
export function makeNoise2D(seed = 7) {
  const rng = makeRNG(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => {
    switch (h & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return function (x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const aa = perm[X + perm[Y]], ab = perm[X + perm[Y + 1]];
    const ba = perm[X + 1 + perm[Y]], bb = perm[X + 1 + perm[Y + 1]];
    return lerp(
      lerp(grad(aa, x, y), grad(ba, x - 1, y), u),
      lerp(grad(ab, x, y - 1), grad(bb, x - 1, y - 1), u),
      v
    ) * 0.7071;
  };
}

export function fbm(noise, x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

const _v1 = new THREE.Vector3();
/** 世界坐标 -> 屏幕坐标。返回 {x,y,visible} */
export function worldToScreen(pos, camera, out = {}) {
  _v1.copy(pos).project(camera);
  out.behind = _v1.z > 1;
  out.x = (_v1.x * 0.5 + 0.5) * window.innerWidth;
  out.y = (-_v1.y * 0.5 + 0.5) * window.innerHeight;
  out.visible = !out.behind && _v1.x > -1.15 && _v1.x < 1.15 && _v1.y > -1.15 && _v1.y < 1.15;
  return out;
}

export function formatTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = (sec / 60) | 0, s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 线段与AABB(局部空间)求交, 返回 t (0-1) 或 null */
export function segmentBoxIntersect(p0, p1, box, outPoint) {
  let tmin = 0, tmax = 1;
  const d = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
  for (const axis of ['x', 'y', 'z']) {
    const o = p0[axis], dir = d[axis];
    const mn = box.min[axis], mx = box.max[axis];
    if (Math.abs(dir) < 1e-9) {
      if (o < mn || o > mx) return null;
    } else {
      let t1 = (mn - o) / dir, t2 = (mx - o) / dir;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  if (outPoint) {
    outPoint.set(p0.x + d.x * tmin, p0.y + d.y * tmin, p0.z + d.z * tmin);
  }
  return tmin;
}

/** 求交面法线（AABB局部） */
export function boxHitNormal(box, point, out) {
  const eps = 0.02;
  out.set(0, 0, 0);
  if (Math.abs(point.x - box.min.x) < eps) out.set(-1, 0, 0);
  else if (Math.abs(point.x - box.max.x) < eps) out.set(1, 0, 0);
  else if (Math.abs(point.y - box.min.y) < eps) out.set(0, -1, 0);
  else if (Math.abs(point.y - box.max.y) < eps) out.set(0, 1, 0);
  else if (Math.abs(point.z - box.min.z) < eps) out.set(0, 0, -1);
  else out.set(0, 0, 1);
  return out;
}
