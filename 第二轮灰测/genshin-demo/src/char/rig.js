// Procedural skeleton + skinned mesh generation for anime-proportioned characters.
// Everything is authored in NORMALISED units (1.0 = character height); the root group is
// scaled by the character height in metres, so one geometry set works at any size.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, TAU } from '../core/utils.js';
import { FACE_V0, WHITE_UV, FaceTexture } from './face.js';
import { makeCharMaterial, makeOutlineMaterial, outlineColorFrom } from './materials.js';

const DEG = Math.PI / 180;

/** Head ellipsoid (normalised). 1/6.05 of the body height -> anime proportions. */
export const HEADP = { ax: 0.0552, ay: 0.0872, az: 0.0658, cy: 0.9125, jaw: 1.0, chin: 1.0 };
/** Face decal patch extent on that ellipsoid. */
export const PATCH = { lon: 72 * DEG, lat0: -48 * DEG, lat1: 30 * DEG };

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
const _FW = new THREE.Vector3(0, 0, 1);

/**
 * Genshin-style face normal flattening: inside the face patch the normal is pulled
 * towards +Z so the cel terminator never cuts across the face. Applied to BOTH the
 * skull and the decal patch with the same mask, so the two shade identically.
 */
export function flattenFaceNormal(lon, lat, n, amount) {
  if (!amount) return n;
  let l = ((lon + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const tu = l / PATCH.lon;
  const tv = ((lat - PATCH.lat0) / (PATCH.lat1 - PATCH.lat0)) * 2 - 1;
  const rr = Math.max(Math.abs(tu), Math.abs(tv));
  const m = 1 - smoothstep(0.55, 1.08, rr);
  if (m <= 0) return n;
  return n.lerp(_FW, amount * m).normalize();
}

/** Point on the head surface. k scales x/z, ky scales y (hair shells use k>1). */
export function headSurface(lon, lat, k, ky, out, hp) {
  const h = hp || HEADP;
  const cl = Math.cos(lat), sl = Math.sin(lat);
  const low = Math.max(0, -sl);
  const narrow = 1 - low * low * 0.36 * (h.jaw != null ? h.jaw : 1);
  const ax = h.ax * k, az = h.az * k, ay = h.ay * ky;
  const front = Math.max(0, Math.cos(lon));
  const x = ax * Math.sin(lon) * cl * narrow;
  const y = h.cy + ay * sl;
  const z = az * Math.cos(lon) * cl * narrow + low * low * 0.30 * (h.chin != null ? h.chin : 1) * az * front;
  return out.set(x, y, z);
}
export function headNormal(lon, lat, k, ky, out, hp) {
  const e = 0.012;
  headSurface(lon + e, lat, k, ky, _t1, hp); headSurface(lon - e, lat, k, ky, _t2, hp);
  _v2.subVectors(_t1, _t2);
  headSurface(lon, clamp(lat + e, -1.55, 1.55), k, ky, _t1, hp);
  headSurface(lon, clamp(lat - e, -1.55, 1.55), k, ky, _t2, hp);
  _v3.subVectors(_t1, _t2);
  return out.crossVectors(_v2, _v3).normalize();
}

// ---------------------------------------------------------------- skeleton spec
/** Absolute bind positions; converted to parent-relative offsets by buildSkeleton. */
export function skeletonSpec(def) {
  const S = [];
  const P = (n, p, x, y, z) => S.push({ n, p, a: [x, y, z] });
  P('hips', null, 0, 0.498, 0);
  P('spine', 'hips', 0, 0.588, 0);
  P('chest', 'spine', 0, 0.688, 0);
  P('neck', 'chest', 0, 0.795, 0);
  P('head', 'neck', 0, 0.848, 0);
  P('headTop', 'head', 0, 0.998, 0);
  for (const sd of [['L', 1], ['R', -1]]) {
    const n = sd[0], s = sd[1];
    P('shoulder' + n, 'chest', s * 0.028, 0.778, 0);
    P('arm' + n, 'shoulder' + n, s * 0.082, 0.772, 0);
    P('foreArm' + n, 'arm' + n, s * 0.1250, 0.6420, 0);
    P('hand' + n, 'foreArm' + n, s * 0.1505, 0.5090, 0);
    P('handEnd' + n, 'hand' + n, s * 0.1610, 0.4360, 0);
    P('thigh' + n, 'hips', s * 0.048, 0.496, 0);
    P('shin' + n, 'thigh' + n, s * 0.055, 0.262, 0);
    P('foot' + n, 'shin' + n, s * 0.058, 0.052, 0);
    P('toe' + n, 'foot' + n, s * 0.058, 0.018, 0.086);
  }
  // ---- secondary dynamics ----
  const hs = def.hair || {};
  const tails = hs.tails || [];
  for (let i = 0; i < tails.length; i++) {
    const t = tails[i], id = 'hair' + i;
    let parent = 'head';
    for (let j = 0; j < t.bones.length; j++) {
      const b = t.bones[j];
      P(id + '_' + j, parent, b[0], b[1], b[2]);
      parent = id + '_' + j;
    }
  }
  if (def.skirt) {
    const y0 = def.skirt.top, y1 = def.skirt.bottom;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // [dx, dz], index 0 = front (+Z)
    for (let i = 0; i < 4; i++) {
      const d = dirs[i];
      P('skirt' + i, 'hips', d[0] * 0.028, y0, d[1] * 0.028);
      P('skirt' + i + 't', 'skirt' + i, d[0] * 0.120, y1 - 0.010, d[1] * 0.120);
    }
  }
  if (def.cape) {
    P('cape0', 'chest', 0, 0.780, -0.046);
    P('cape1', 'cape0', 0, 0.640, -0.062);
    P('cape2', 'cape1', 0, 0.500, -0.074);
    P('cape3', 'cape2', 0, 0.380, -0.082);
  }
  return S;
}

/** Build THREE.Bone hierarchy + bind-space segments used by the skin solver. */
export function buildSkeleton(def) {
  const spec = skeletonSpec(def);
  const bones = {}, list = [], abs = {}, childOf = {};
  for (const e of spec) {
    const b = new THREE.Bone();
    b.name = e.n;
    abs[e.n] = e.a;
    bones[e.n] = b;
    list.push(b);
    if (e.p) { bones[e.p].add(b); if (!childOf[e.p]) childOf[e.p] = e.n; }
    b.position.set(e.a[0] - (e.p ? abs[e.p][0] : 0), e.a[1] - (e.p ? abs[e.p][1] : 0), e.a[2] - (e.p ? abs[e.p][2] : 0));
    b.userData.parentName = e.p;
  }
  // segments: head -> tail (first child, or extrapolated for leaves)
  const segs = [], segOf = {};
  for (let i = 0; i < spec.length; i++) {
    const e = spec[i], h = abs[e.n];
    let t;
    const c = childOf[e.n];
    if (c) t = abs[c];
    else {
      const pa = e.p ? abs[e.p] : [h[0], h[1] - 0.05, h[2]];
      const dx = h[0] - pa[0], dy = h[1] - pa[1], dz = h[2] - pa[2];
      const l = Math.hypot(dx, dy, dz) || 1;
      t = [h[0] + dx / l * 0.05, h[1] + dy / l * 0.05, h[2] + dz / l * 0.05];
    }
    const seg = { name: e.n, i, h: new THREE.Vector3(h[0], h[1], h[2]), t: new THREE.Vector3(t[0], t[1], t[2]) };
    segs.push(seg); segOf[e.n] = seg;
  }
  return { bones, list, segs, segOf, abs };
}

// ---------------------------------------------------------------- skin solving
function distSeg(px, py, pz, s) {
  const ax = s.h.x, ay = s.h.y, az = s.h.z;
  const bx = s.t.x - ax, by = s.t.y - ay, bz = s.t.z - az;
  const dx = px - ax, dy = py - ay, dz = pz - az;
  const bb = bx * bx + by * by + bz * bz;
  let t = bb > 1e-9 ? (dx * bx + dy * by + dz * bz) / bb : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = dx - bx * t, ey = dy - by * t, ez = dz - bz * t;
  return Math.sqrt(ex * ex + ey * ey + ez * ez);
}

/**
 * Distance-weighted skinning restricted to an anatomical bone set, so nearby
 * limbs never bleed into each other. Returns up to 4 normalised weights.
 */
export function makeSolver(rig) {
  const cache = new Map();
  const resolve = (names) => {
    const key = names.join(',');
    let l = cache.get(key);
    if (!l) { l = names.map((n) => rig.segOf[n]).filter(Boolean); cache.set(key, l); }
    return l;
  };
  const bi = [0, 0, 0, 0], bw = [0, 0, 0, 0];
  return function solve(x, y, z, names, outI, outW) {
    const l = resolve(names);
    bi[0] = bi[1] = bi[2] = bi[3] = 0; bw[0] = bw[1] = bw[2] = bw[3] = 0;
    for (let k = 0; k < l.length; k++) {
      const d = distSeg(x, y, z, l[k]);
      const w = 1 / Math.pow(d + 0.012, 3);
      for (let m = 0; m < 4; m++) {
        if (w > bw[m]) {
          for (let q = 3; q > m; q--) { bw[q] = bw[q - 1]; bi[q] = bi[q - 1]; }
          bw[m] = w; bi[m] = l[k].i; break;
        }
      }
    }
    const sum = bw[0] + bw[1] + bw[2] + bw[3] || 1;
    outI.push(bi[0], bi[1], bi[2], bi[3]);
    outW.push(bw[0] / sum, bw[1] / sum, bw[2] / sum, bw[3] / sum);
  };
}

// ---------------------------------------------------------------- part buffers
const _colCache = new Map();
export function col3(hex) {
  let c = _colCache.get(hex);
  if (!c) { const k = new THREE.Color(hex); c = [k.r, k.g, k.b]; _colCache.set(hex, c); }
  return c;
}

export class Part {
  constructor(solve) {
    this.solve = solve;
    this.pos = []; this.nrm = []; this.uv = []; this.col = [];
    this.si = []; this.sw = []; this.out = []; this.idx = [];
    this.fixed = [];    // 1 = analytic normal supplied, keep it
  }
  get count() { return this.pos.length / 3; }
  vert(x, y, z, nx, ny, nz, u, v, c, ol, bones, w) {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.uv.push(u, v);
    this.col.push(c[0], c[1], c[2]);
    this.out.push(ol);
    this.fixed.push((nx !== 0 || ny !== 0 || nz !== 0) ? 1 : 0);
    if (w) { this.si.push(w[0], w[1], w[2], w[3]); this.sw.push(w[4], w[5], w[6], w[7]); }
    else this.solve(x, y, z, bones, this.si, this.sw);
  }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  tri(a, b, c) { this.idx.push(a, b, c); }
  computeNormals() {
    const P = this.pos, I = this.idx, F = this.fixed;
    const N = new Float64Array(this.nrm.length);
    for (let f = 0; f < I.length; f += 3) {
      const a = I[f] * 3, b = I[f + 1] * 3, c = I[f + 2] * 3;
      const ax = P[b] - P[a], ay = P[b + 1] - P[a + 1], az = P[b + 2] - P[a + 2];
      const bx = P[c] - P[a], by = P[c + 1] - P[a + 1], bz = P[c + 2] - P[a + 2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      N[a] += nx; N[a + 1] += ny; N[a + 2] += nz;
      N[b] += nx; N[b + 1] += ny; N[b + 2] += nz;
      N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
    }
    for (let i = 0, v = 0; i < N.length; i += 3, v++) {
      if (F[v]) continue;
      const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
      this.nrm[i] = N[i] / l; this.nrm[i + 1] = N[i + 1] / l; this.nrm[i + 2] = N[i + 2] / l;
    }
  }
}

/** Merge parts into one indexed BufferGeometry (single draw call per character). */
export function mergeParts(parts) {
  let nv = 0, ni = 0;
  for (const p of parts) { p.computeNormals(); nv += p.count; ni += p.idx.length; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const col = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const out = new Float32Array(nv), idx = new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const p of parts) {
    pos.set(p.pos, vo * 3); nrm.set(p.nrm, vo * 3); uv.set(p.uv, vo * 2);
    col.set(p.col, vo * 3); si.set(p.si, vo * 4); sw.set(p.sw, vo * 4); out.set(p.out, vo);
    for (let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo;
    vo += p.count; io += p.idx.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('aOutline', new THREE.BufferAttribute(out, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius *= 1.45;   // limbs swing outside the bind pose
  return g;
}

// ---------------------------------------------------------------- primitives
/** Piecewise-linear chain sampler by arc length. */
export function makeChain(pts) {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    cum.push(total);
  }
  return {
    total,
    at(t) {
      const d = clamp(t, 0, 1) * total;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const u = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u), lerp(pts[i - 1][2], pts[i][2], u)];
    },
  };
}

/** Cubic bezier point. */
export function bez(p0, p1, p2, p3, t) {
  const s = 1 - t, a = s * s * s, b = 3 * s * s * t, c = 3 * s * t * t, d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
}

/**
 * Generalised tube: rings = [{p:[x,y,z], rx, ry?, col, ol?, bulge?}].
 * Frames use parallel transport so twisting never flips. ry is along the frame
 * normal (front for body parts, radial-out for hair cards), rx along the binormal.
 */
export function addTube(P, rings, opts = {}) {
  const sides = opts.sides || 10;
  const bones = opts.bones;
  const n = rings.length;
  const up = new THREE.Vector3().fromArray(opts.up || [0, 0, 1]);
  const T = [], N = [], B = [];
  for (let i = 0; i < n; i++) {
    const p0 = rings[Math.max(0, i - 1)].p, p1 = rings[Math.min(n - 1, i + 1)].p;
    const t = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    if (t.lengthSq() < 1e-12) t.set(0, -1, 0);
    T.push(t.normalize());
  }
  for (let i = 0; i < n; i++) {
    let nn;
    if (i === 0) {
      nn = up.clone().addScaledVector(T[0], -up.dot(T[0]));
      if (nn.lengthSq() < 1e-8) nn.set(1, 0, 0).addScaledVector(T[0], -T[0].x);
      nn.normalize();
    } else {
      const q = new THREE.Quaternion().setFromUnitVectors(T[i - 1], T[i]);
      nn = N[i - 1].clone().applyQuaternion(q);
      nn.addScaledVector(T[i], -nn.dot(T[i]));
      if (nn.lengthSq() < 1e-8) nn.copy(N[i - 1]);
      nn.normalize();
    }
    N.push(nn);
    B.push(new THREE.Vector3().crossVectors(T[i], nn));
  }
  const base = P.count;
  for (let i = 0; i < n; i++) {
    const r = rings[i], rx = r.rx, ry = (r.ry != null ? r.ry : r.rx);
    const c = col3(r.col), ol = (r.ol != null ? r.ol : 1);
    for (let j = 0; j < sides; j++) {
      const a = j / sides * TAU, sa = Math.sin(a), ca = Math.cos(a);
      const rm = opts.rmul ? opts.rmul[j % opts.rmul.length] : 1;
      const k = (r.bulge ? 1 + r.bulge * Math.pow(Math.max(0, ca), 2) : 1) * rm;
      const x = r.p[0] + B[i].x * (sa * rx * rm) + N[i].x * (ca * ry * k);
      const y = r.p[1] + B[i].y * (sa * rx * rm) + N[i].y * (ca * ry * k);
      const z = r.p[2] + B[i].z * (sa * rx * rm) + N[i].z * (ca * ry * k);
      P.vert(x, y, z, 0, 0, 0, WHITE_UV[0], WHITE_UV[1], c, ol, r.bones || bones);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) {
    const j1 = (j + 1) % sides;
    P.quad(base + i * sides + j, base + i * sides + j1, base + (i + 1) * sides + j1, base + (i + 1) * sides + j);
  }
  // caps
  const cap = (i, dir, mode) => {
    if (mode === 'none' || !mode) return;
    const r = rings[i], c = col3(r.col), ol = (r.ol != null ? r.ol : 1);
    const tip = mode === 'point' ? (opts.tip || 0.02) : 0;
    const ci = P.count;
    P.vert(r.p[0] + T[i].x * dir * tip, r.p[1] + T[i].y * dir * tip, r.p[2] + T[i].z * dir * tip,
      0, 0, 0, WHITE_UV[0], WHITE_UV[1], c, ol, r.bones || bones);
    for (let j = 0; j < sides; j++) {
      const j1 = (j + 1) % sides, o = base + i * sides;
      if (dir > 0) P.tri(ci, o + j, o + j1); else P.tri(ci, o + j1, o + j);
    }
  };
  cap(0, -1, opts.capStart);
  cap(n - 1, 1, opts.capEnd);
  return base;
}

/** Closed head/skull ellipsoid with analytic normals. */
export function addHead(P, colorHex, bones, opts = {}) {
  const nLon = opts.nLon || 20, nLat = opts.nLat || 14;
  const lat0 = -87 * DEG, lat1 = 87 * DEG;
  const k = opts.k || 1, ky = opts.ky || 1;
  const c = col3(colorHex);
  const hp = opts.hp;
  const base = P.count;
  const pv = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let iv = 0; iv <= nLat; iv++) {
    const lat = lerp(lat0, lat1, iv / nLat);
    for (let iu = 0; iu < nLon; iu++) {
      const lon = iu / nLon * TAU;
      // no outline across the face: an inverted hull would swallow the face decal
      let aa = lon; if (aa > Math.PI) aa = TAU - aa;
      const ol = smoothstep(80 * DEG, 104 * DEG, aa) * 0.85;
      headSurface(lon, lat, k, ky, pv, hp);
      headNormal(lon, lat, k, ky, nv, hp);
      flattenFaceNormal(lon, lat, nv, opts.flat != null ? opts.flat : 0.72);
      P.vert(pv.x, pv.y, pv.z, nv.x, nv.y, nv.z, WHITE_UV[0], WHITE_UV[1], c, ol, bones);
    }
  }
  for (let iv = 0; iv < nLat; iv++) for (let iu = 0; iu < nLon; iu++) {
    const u1 = (iu + 1) % nLon;
    P.quad(base + iv * nLon + iu, base + iv * nLon + u1, base + (iv + 1) * nLon + u1, base + (iv + 1) * nLon + iu);
  }
  return base;
}

/**
 * Face decal patch: same ellipsoid surface pushed out by 0.6%, so it is invisible
 * where the texture is skin coloured. Normals are flattened towards +Z in the middle
 * (the Genshin face-normal trick) so the cel terminator never cuts across the face.
 */
export function addFacePatch(P, bones, opts = {}) {
  const nu = opts.nu || 16, nv = opts.nv || 18;
  const k = 1.022, ky = 1.016;
  const c = col3(0xffffff), flat = opts.flat != null ? opts.flat : 0.72;
  const hp = opts.hp;
  const base = P.count;
  const pv = new THREE.Vector3(), nv3 = new THREE.Vector3(), fw = new THREE.Vector3(0, 0, 1);
  for (let iv = 0; iv <= nv; iv++) {
    const tv = iv / nv;                      // 0 = chin side, 1 = forehead
    const lat = lerp(PATCH.lat0, PATCH.lat1, tv);
    for (let iu = 0; iu <= nu; iu++) {
      const tu = iu / nu;
      const lon = lerp(-PATCH.lon, PATCH.lon, tu);
      headSurface(lon, lat, k, ky, pv, hp);
      headNormal(lon, lat, k, ky, nv3, hp);
      flattenFaceNormal(lon, lat, nv3, flat);
      P.vert(pv.x, pv.y, pv.z, nv3.x, nv3.y, nv3.z, tu, FACE_V0 + tv * (1 - FACE_V0), c, 0, bones);
    }
  }
  const W = nu + 1;
  for (let iv = 0; iv < nv; iv++) for (let iu = 0; iu < nu; iu++) {
    P.quad(base + iv * W + iu, base + iv * W + iu + 1, base + (iv + 1) * W + iu + 1, base + (iv + 1) * W + iu);
  }
  return base;
}

/**
 * Two-sided cloth sheet with thickness (skirt, cape, ribbons).
 * fn(tu, tv, out:Vector3) defines the mid surface; normals come from finite differences.
 * opts.skin(tu, tv, out8) can supply explicit skin indices/weights.
 */
export function addSheet(P, fn, nu, nv, opts = {}) {
  const th = (opts.thickness != null ? opts.thickness : 0.007) * 0.5;
  const closeU = !!opts.closeU;
  const colFn = opts.col || (() => opts.color || 0xffffff);
  const olFn = opts.ol || (() => 1);
  const bones = opts.bones;
  const W = closeU ? nu : nu + 1;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const p = new THREE.Vector3(), du = new THREE.Vector3(), dv = new THREE.Vector3(), nn = new THREE.Vector3();
  const w8 = [0, 0, 0, 0, 0, 0, 0, 0];
  const base = P.count;
  const eu = 0.5 / nu, ev = 0.5 / nv;
  const emit = (sign) => {
    for (let iv = 0; iv <= nv; iv++) for (let iu = 0; iu < W; iu++) {
      const tu = iu / nu, tv = iv / nv;
      fn(tu, tv, p);
      fn(clamp(tu + eu, 0, 1), tv, a); fn(clamp(tu - eu, 0, 1), tv, b);
      du.subVectors(a, b);
      fn(tu, clamp(tv + ev, 0, 1), a); fn(tu, clamp(tv - ev, 0, 1), c);
      dv.subVectors(a, c);
      nn.crossVectors(du, dv);
      if (nn.lengthSq() < 1e-12) nn.set(0, 0, 1); else nn.normalize();
      const col = col3(colFn(tu, tv));
      const skin = opts.skin ? (opts.skin(tu, tv, w8), w8) : null;
      P.vert(p.x + nn.x * th * sign, p.y + nn.y * th * sign, p.z + nn.z * th * sign,
        0, 0, 0, WHITE_UV[0], WHITE_UV[1], col, olFn(tu, tv), bones, skin);
    }
  };
  emit(1); emit(-1);
  const layer = (nv + 1) * W;
  for (let iv = 0; iv < nv; iv++) for (let iu = 0; iu < (closeU ? W : W - 1); iu++) {
    const u1 = (iu + 1) % W;
    const f = base, k = base + layer;
    P.quad(f + iv * W + iu, f + iv * W + u1, f + (iv + 1) * W + u1, f + (iv + 1) * W + iu);
    P.quad(k + iv * W + iu, k + (iv + 1) * W + iu, k + (iv + 1) * W + u1, k + iv * W + u1);
  }
  // rims
  for (let iu = 0; iu < (closeU ? W : W - 1); iu++) {
    const u1 = (iu + 1) % W;
    // bottom edge (tv = 1)
    const rowB = nv * W;
    P.quad(base + rowB + iu, base + layer + rowB + iu, base + layer + rowB + u1, base + rowB + u1);
    // top edge (tv = 0)
    P.quad(base + u1, base + layer + u1, base + layer + iu, base + iu);
  }
  if (!closeU) for (let iv = 0; iv < nv; iv++) {
    const r0 = iv * W, r1 = (iv + 1) * W;
    P.quad(base + r0, base + layer + r0, base + layer + r1, base + r1);
    P.quad(base + r0 + W - 1, base + r1 + W - 1, base + layer + r1 + W - 1, base + layer + r0 + W - 1);
  }
  return base;
}

/** Hair shell over the skull with a real hairline; closed (outer + inner + rim). */
export function addHairCap(P, hairlineFn, colorHex, bones, opts = {}) {
  const nLon = opts.nLon || 22, nLat = opts.nLat || 7;
  const kOut = opts.kOut || 1.085, kyOut = opts.kyOut || 1.055;
  const kIn = 1.008, latTop = 88 * DEG;
  const c = col3(colorHex), c2 = col3(opts.color2 != null ? opts.color2 : colorHex);
  const hp = opts.hp;
  const base = P.count;
  const pv = new THREE.Vector3(), nv = new THREE.Vector3();
  const rows = nLat + 1;
  for (let layer = 0; layer < 2; layer++) {
    for (let iv = 0; iv <= nLat; iv++) {
      const tv = iv / nLat;
      for (let iu = 0; iu < nLon; iu++) {
        const lon = iu / nLon * TAU;
        const lat = lerp(hairlineFn(lon), latTop, tv);
        const kk = layer === 0 ? kOut : lerp(kIn, kOut, Math.pow(tv, 2.5));
        const kyy = layer === 0 ? kyOut : lerp(1.0, kyOut, Math.pow(tv, 2.5));
        headSurface(lon, lat, kk, kyy, pv, hp);
        headNormal(lon, lat, kk, kyy, nv, hp);
        if (layer === 1) nv.multiplyScalar(-1);
        P.vert(pv.x, pv.y, pv.z, nv.x, nv.y, nv.z, WHITE_UV[0], WHITE_UV[1],
          (iv === 0 ? c2 : c), (iv === 0 ? 0.7 : 1) * (opts.ol != null ? opts.ol : 1), bones);
      }
    }
  }
  const L = rows * nLon;
  for (let iv = 0; iv < nLat; iv++) for (let iu = 0; iu < nLon; iu++) {
    const u1 = (iu + 1) % nLon;
    P.quad(base + iv * nLon + iu, base + iv * nLon + u1, base + (iv + 1) * nLon + u1, base + (iv + 1) * nLon + iu);
    const k = base + L;
    P.quad(k + iv * nLon + iu, k + (iv + 1) * nLon + iu, k + (iv + 1) * nLon + u1, k + iv * nLon + u1);
  }
  for (let iu = 0; iu < nLon; iu++) {
    const u1 = (iu + 1) % nLon;
    P.quad(base + iu, base + L + iu, base + L + u1, base + u1);
  }
  return base;
}

// ---------------------------------------------------------------- bone sets
const BS = {
  torso: ['hips', 'spine', 'chest', 'neck'],
  neck: ['chest', 'neck', 'head'],
  head: ['head'],
  armL: ['chest', 'shoulderL', 'armL', 'foreArmL', 'handL', 'handEndL'],
  armR: ['chest', 'shoulderR', 'armR', 'foreArmR', 'handR', 'handEndR'],
  legL: ['hips', 'thighL', 'shinL', 'footL'],
  legR: ['hips', 'thighR', 'shinR', 'footR'],
  footL: ['shinL', 'footL', 'toeL'],
  footR: ['shinR', 'footR', 'toeR'],
};

function lut(table, t) {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (t <= table[i][0]) {
      const u = (t - table[i - 1][0]) / Math.max(1e-6, table[i][0] - table[i - 1][0]);
      return lerp(table[i - 1][1], table[i][1], u);
    }
  }
  return table[table.length - 1][1];
}

/** Pick a colour from [ [t0, t1, colour], ... ] bands. */
function band(bands, t, fallback) {
  if (bands) for (const b of bands) if (t >= b[0] && t <= b[1]) return b[2];
  return fallback;
}
function bandEdges(bands, lo, hi) {
  const e = [];
  if (bands) for (const b of bands) for (const v of [b[0], b[1]]) if (v > lo + 1e-4 && v < hi - 1e-4) e.push(v);
  return e;
}

// ---------------------------------------------------------------- body
const TORSO = [
  [0.470, 0.074, 0.059, 0],
  [0.492, 0.0965, 0.0725, 0],
  [0.548, 0.088, 0.066, 0],
  [0.612, 0.0705, 0.0545, 0],
  [0.662, 0.078, 0.056, 0.55],
  [0.706, 0.089, 0.058, 1.0],
  [0.752, 0.084, 0.053, 0.30],
  [0.790, 0.0825, 0.050, 0],
  [0.814, 0.055, 0.044, 0],
];

export function buildTorso(def, rig, solve) {
  const P = new Part(solve);
  const c = def.col, b = def.body || {};
  const bust = b.bust != null ? b.bust : 0.18;
  const gw = b.girth != null ? b.girth : 1;
  const waistK = b.waist != null ? b.waist : 1;
  const shK = b.shoulder != null ? b.shoulder : 1;
  const ys = TORSO.map((r) => r[0]);
  for (const e of bandEdges(def.torsoBands, ys[0], ys[ys.length - 1])) { ys.push(e - 0.0012, e + 0.0012); }
  ys.sort((a, z) => a - z);
  const rings = [];
  for (const y of ys) {
    const rx = lut(TORSO.map((r) => [r[0], r[1]]), y);
    const rz = lut(TORSO.map((r) => [r[0], r[2]]), y);
    const bl = lut(TORSO.map((r) => [r[0], r[3]]), y);
    let k = gw;
    if (y > 0.58 && y < 0.65) k *= waistK;
    if (y > 0.74) k *= shK;
    rings.push({ p: [0, y, 0], rx: rx * k, ry: rz * k, bulge: bl * bust, col: band(def.torsoBands, y, c.top) });
  }
  addTube(P, rings, { sides: 16, bones: BS.torso, capStart: 'flat', capEnd: 'flat', up: [0, 0, 1] });
  // neck
  addTube(P, [
    { p: [0, 0.784, 0.002], rx: 0.035, ry: 0.033, col: c.skin },
    { p: [0, 0.826, 0.002], rx: 0.031, ry: 0.029, col: c.skin },
    { p: [0, 0.874, 0.002], rx: 0.029, ry: 0.028, col: c.skin },
  ], { sides: 12, bones: BS.neck, up: [0, 0, 1] });
  return P;
}

const ARM_R = [[0, 0.031], [0.08, 0.0325], [0.25, 0.0262], [0.388, 0.0212], [0.50, 0.0234],
  [0.68, 0.0194], [0.779, 0.0168], [0.83, 0.0212], [0.94, 0.0196], [1.0, 0.0090]];
const LEG_R = [[0, 0.057], [0.13, 0.055], [0.36, 0.046], [0.527, 0.0395], [0.63, 0.0425],
  [0.80, 0.0315], [0.94, 0.0245], [1.0, 0.0235]];

export function buildLimbs(def, rig, solve) {
  const P = new Part(solve);
  const c = def.col, A = rig.abs;
  const sleeve = def.sleeve != null ? def.sleeve : 0.30;    // 0..1 along the arm
  const glove = def.glove != null ? def.glove : 1.02;       // start of gloves
  const legwear = def.legwear != null ? def.legwear : 0.0;  // tights/socks coverage from hip
  const boot = def.boot != null ? def.boot : 0.86;          // boot top along the leg
  const LS = (def.body && def.body.limb) != null ? def.body.limb : 1;
  for (const sd of [['L', 1], ['R', -1]]) {
    const n = sd[0];
    // ---- arm ----
    const ch = makeChain([A['arm' + n], A['foreArm' + n], A['hand' + n], A['handEnd' + n]]);
    const ts = [0, 0.06, 0.16, 0.28, 0.388, 0.50, 0.63, 0.779, 0.84, 0.92, 1.0];
    for (const e of [sleeve, glove]) if (e > 0.02 && e < 0.98) ts.push(e - 0.0035, e + 0.0035);
    ts.sort((a, z) => a - z);
    for (const e of bandEdges(def.armBands, 0, 1)) ts.push(e - 0.0035, e + 0.0035);
    ts.sort((a, z) => a - z);
    const rings = ts.map((t) => {
      const p = ch.at(t);
      let r = lut(ARM_R, t);
      if (Math.abs(t - sleeve) < 0.05 && sleeve > 0.05) r *= 1.16;      // cuff
      const flat = lerp(0.94, 0.60, smoothstep(0.74, 0.86, t));
      const base = t < sleeve ? (c.sleeve != null ? c.sleeve : c.top) : (t > glove ? (c.glove != null ? c.glove : c.boot) : c.skin);
      return { p, rx: r * LS, ry: r * flat * LS, col: band(def.armBands, t, base) };
    });
    addTube(P, rings, { sides: 10, bones: BS['arm' + n], capStart: 'flat', capEnd: 'flat', up: [0, 0, 1] });
    // ---- leg ----
    const lch = makeChain([A['thigh' + n], A['shin' + n], A['foot' + n]]);
    const lts = [0, 0.10, 0.25, 0.40, 0.527, 0.63, 0.76, 0.88, 1.0];
    for (const e of [legwear, boot]) if (e > 0.02 && e < 0.98) lts.push(e - 0.0035, e + 0.0035);
    lts.sort((a, z) => a - z);
    for (const e of bandEdges(def.legBands, 0, 1)) lts.push(e - 0.0035, e + 0.0035);
    lts.sort((a, z) => a - z);
    const lrings = lts.map((t) => {
      const p = lch.at(t);
      let r = lut(LEG_R, t);
      if (Math.abs(t - boot) < 0.04) r *= 1.12;
      let base = t > boot ? (c.boot != null ? c.boot : 0x3a3f57) : (t < legwear ? (c.legwear != null ? c.legwear : c.bottom) : c.skin);
      if (t < 0.115 && !def.skirt && c.bottom != null) base = c.bottom;
      return { p, rx: r * LS, ry: r * 0.97 * LS, col: band(def.legBands, t, base) };
    });
    addTube(P, lrings, { sides: 10, bones: BS['leg' + n], capStart: 'flat', up: [0, 0, 1] });
    // ---- fist wrap (right hand grips the weapon hilt) ----
    if (n === 'R' && def.weapon && def.weapon !== 'none') {
      const h = A['handR'];
      const ax0 = 0, ay0 = -0.682, az0 = 0.731;   // weapon axis in hand space
      const gx = h[0], gy = h[1] - 0.030, gz = h[2] + 0.006;
      const gc = (c.glove != null && def.glove != null && def.glove < 0.9) ? c.glove : c.skin;
      addTube(P, [
        { p: [gx - ax0 * 0.030, gy - ay0 * 0.030, gz - az0 * 0.030], rx: 0.0140, ry: 0.0135, col: gc },
        { p: [gx - ax0 * 0.012, gy - ay0 * 0.012, gz - az0 * 0.012], rx: 0.0170, ry: 0.0160, col: gc },
        { p: [gx + ax0 * 0.014, gy + ay0 * 0.014, gz + az0 * 0.014], rx: 0.0168, ry: 0.0158, col: gc },
        { p: [gx + ax0 * 0.030, gy + ay0 * 0.030, gz + az0 * 0.030], rx: 0.0138, ry: 0.0132, col: gc },
      ], { sides: 8, bones: BS.armR, capStart: 'flat', capEnd: 'flat', up: [1, 0, 0] });
    }
    // ---- foot ----
    const ax = A['foot' + n][0];
    addTube(P, [
      { p: [ax, 0.064, -0.026], rx: 0.026 * LS, ry: 0.027 * LS, col: c.boot || 0x3a3f57 },
      { p: [ax, 0.036, -0.012], rx: 0.030 * LS, ry: 0.033 * LS, col: c.boot || 0x3a3f57 },
      { p: [ax, 0.028, 0.034], rx: 0.032 * LS, ry: 0.029 * LS, col: c.boot || 0x3a3f57 },
      { p: [ax, 0.026, 0.084], rx: 0.029 * LS, ry: 0.024 * LS, col: c.boot || 0x3a3f57 },
      { p: [ax, 0.026, 0.116], rx: 0.020 * LS, ry: 0.016 * LS, col: c.boot || 0x3a3f57 },
    ], { sides: 10, bones: BS['foot' + n], capStart: 'flat', capEnd: 'point', tip: 0.008, up: [0, 1, 0] });
  }
  return P;
}

// ---------------------------------------------------------------- head + face
export function buildHead(def, rig, solve) {
  const P = new Part(solve);
  const hp = def.headP || HEADP;
  addHead(P, def.col.skin, BS.head, { nLon: 26, nLat: 18, hp });
  addFacePatch(P, BS.head, { hp, nu: 18, nv: 20 });
  // ears
  for (const s of [1, -1]) {
    const e = headSurface(s * 92 * DEG, -6 * DEG, 0.96, 1.0, new THREE.Vector3(), hp).toArray();
    addTube(P, [
      { p: [e[0] * 0.96, e[1] + 0.014, e[2] - 0.004], rx: 0.006, ry: 0.011, col: def.col.skin },
      { p: [e[0] * 1.05, e[1] + 0.004, e[2] + 0.002], rx: 0.008, ry: 0.014, col: def.col.skin },
      { p: [e[0] * 1.02, e[1] - 0.014, e[2] + 0.004], rx: 0.005, ry: 0.008, col: def.col.skin },
    ], { sides: 6, bones: BS.head, capStart: 'flat', capEnd: 'flat', up: [1, 0, 0] });
  }
  return P;
}

// ---------------------------------------------------------------- hair
function makeHairline(hs) {
  const front = (hs.frontLine != null ? hs.frontLine : 33) * DEG;
  const side = (hs.sideLine != null ? hs.sideLine : -18) * DEG;
  const back = (hs.backLine != null ? hs.backLine : -56) * DEG;
  return (lon) => {
    let a = ((lon % TAU) + TAU) % TAU;
    if (a > Math.PI) a = TAU - a;                    // 0 = front, PI = back
    if (a < 62 * DEG) return lerp(front, side, smoothstep(0, 62 * DEG, a));
    return lerp(side, back, smoothstep(62 * DEG, 155 * DEG, a));
  };
}

export function buildHair(def, rig, solve) {
  const P = new Part(solve);
  const hs = def.hair || {}, c = def.col;
  const hp = def.headP || HEADP;
  const hair = c.hair, hair2 = c.hair2 != null ? c.hair2 : hair;
  const V = new THREE.Vector3();
  const surf = (lon, lat, k, ky) => headSurface(lon, lat, k, ky, V, hp).toArray();
  const nrm = (lon, lat, k, ky) => headNormal(lon, lat, k, ky, V, hp).toArray();

  addHairCap(P, makeHairline(hs), hair, BS.head, {
    hp, nLon: 24, nLat: 7,
    kOut: hs.volume != null ? hs.volume : 1.085,
    kyOut: (hs.volume != null ? hs.volume : 1.085) * 0.97,
    color2: hair2,
  });

  // ---- bangs ----
  const NB = hs.bangs != null ? hs.bangs : 6;
  const spread = (hs.bangSpread != null ? hs.bangSpread : 58) * DEG;
  for (let i = 0; i < NB; i++) {
    const tt = NB === 1 ? 0 : (i / (NB - 1)) * 2 - 1;
    const lon = tt * spread;
    const j = (((i * 7919) % 11) / 11) - 0.5;
    const p0 = surf(lon, 36 * DEG, 1.06, 1.045);
    const p1 = surf(lon * 1.02, 26 * DEG, 1.26, 1.10);
    const p2 = surf(lon * 1.06, 14 * DEG, 1.24, 1.05);
    const tipLat = (18 - 12 * Math.abs(tt) + j * 4 + (hs.bangDrop || 0)) * DEG;
    const p3 = surf(lon * 1.10, tipLat, 1.07, 1.03);
    const w = 0.0115 * (0.74 + 0.44 * (1 - Math.abs(tt))) * (hs.bangW || 1);
    const NR = 6, rings = [];
    for (let k = 0; k <= NR; k++) {
      const t = k / NR, p = bez(p0, p1, p2, p3, t);
      const taper = Math.pow(1 - t, 0.55);
      rings.push({ p, rx: w * (0.40 + 0.60 * taper), ry: 0.0085 * (0.26 + 0.74 * taper), col: t > 0.72 ? hair2 : hair });
    }
    addTube(P, rings, { sides: 6, bones: BS.head, up: nrm(lon, 22 * DEG, 1.1, 1.05), capStart: 'flat', capEnd: 'point', tip: 0.008 });
  }

  // ---- side locks ----
  const sideLen = hs.sideLen != null ? hs.sideLen : 0.795;
  for (const s of [1, -1]) {
    const lon = s * 84 * DEG;
    const a0 = surf(lon, 14 * DEG, 1.06, 1.04);
    const a3 = [a0[0] * 1.00, sideLen, a0[2] * 0.42 + 0.004];
    const a1 = [a0[0] * 1.10, lerp(a0[1], a3[1], 0.30), a0[2] * 0.94];
    const a2 = [a0[0] * 1.08, lerp(a0[1], a3[1], 0.70), a0[2] * 0.74];
    const NR = 7, rings = [];
    for (let k = 0; k <= NR; k++) {
      const t = k / NR, p = bez(a0, a1, a2, a3, t);
      const taper = Math.pow(1 - t, 0.5);
      rings.push({ p, rx: 0.021 * (0.30 + 0.70 * taper), ry: 0.014 * (0.26 + 0.74 * taper), col: t > 0.7 ? hair2 : hair });
    }
    addTube(P, rings, { sides: 6, bones: BS.head, up: nrm(lon, 10 * DEG, 1.1, 1.05), capStart: 'flat', capEnd: 'point', tip: 0.01 });
  }

  // ---- back mass ----
  const backLen = hs.backLen != null ? hs.backLen : 0.800;
  const NBK = hs.backLocks != null ? hs.backLocks : 3;
  for (let i = 0; i < NBK; i++) {
    const lon = Math.PI + (NBK === 1 ? 0 : ((i / (NBK - 1)) * 2 - 1) * 34 * DEG);
    const b0 = surf(lon, -34 * DEG, 1.05, 1.03);
    const b3 = [b0[0] * 0.85, backLen, b0[2] * 1.06];
    const b1 = [b0[0] * 1.05, lerp(b0[1], b3[1], 0.35), b0[2] * 1.16];
    const b2 = [b0[0] * 0.95, lerp(b0[1], b3[1], 0.72), b0[2] * 1.14];
    const NR = 7, rings = [];
    for (let k = 0; k <= NR; k++) {
      const t = k / NR, p = bez(b0, b1, b2, b3, t);
      const taper = Math.pow(1 - t, 0.45);
      rings.push({ p, rx: 0.032 * (0.34 + 0.66 * taper), ry: 0.020 * (0.30 + 0.70 * taper), col: t > 0.72 ? hair2 : hair });
    }
    addTube(P, rings, { sides: 7, bones: BS.head, up: nrm(lon, -30 * DEG, 1.1, 1.05), capStart: 'flat', capEnd: 'point', tip: 0.012 });
  }

  // ---- dynamic tails ----
  const tails = hs.tails || [];
  for (let i = 0; i < tails.length; i++) {
    const t = tails[i];
    const names = ['head'];
    for (let j = 0; j < t.bones.length; j++) names.push('hair' + i + '_' + j);
    const pts = t.bones.slice();
    const last = pts[pts.length - 1], prev = pts[pts.length - 2] || [last[0], last[1] + 0.05, last[2]];
    pts.push([last[0] + (last[0] - prev[0]) * 0.85, last[1] + (last[1] - prev[1]) * 0.85, last[2] + (last[2] - prev[2]) * 0.85]);
    const ch = makeChain(pts);
    const r0 = t.r0 != null ? t.r0 : 0.026, r1 = t.r1 != null ? t.r1 : 0.008;
    const ts = [0, 0.05, 0.052, 0.14, 0.142, 0.26, 0.40, 0.55, 0.70, 0.85, 1.0];
    const rings = ts.map((tv) => {
      const p = ch.at(tv);
      const tie = tv > 0.05 && tv < 0.142;
      let r = lerp(r0, r1, Math.pow(tv, 0.8));
      if (tie) r *= 0.84;
      const col = tie ? (t.ribbon != null ? t.ribbon : (c.ribbon != null ? c.ribbon : hair2)) : (tv > 0.8 ? hair2 : hair);
      return { p, rx: r * (t.flat || 1), ry: r, col };
    });
    addTube(P, rings, { sides: 8, bones: names, capStart: 'flat', capEnd: 'point', tip: 0.014, up: t.up || [0, 0, -1] });
  }
  return P;
}

// ---------------------------------------------------------------- cloth
function skirtSkin(rig) {
  const hips = rig.segOf.hips.i;
  const ids = [];
  for (let i = 0; i < 4; i++) { const s = rig.segOf['skirt' + i]; ids.push(s ? s.i : hips); }
  const w = [0, 0, 0, 0];
  return (tu, tv, out) => {
    const phi = -tu * TAU;
    const wh = Math.pow(1 - tv, 1.7);
    let best = -1, second = -1;
    for (let i = 0; i < 4; i++) { const d = Math.max(0, Math.cos(phi - i * Math.PI * 0.5)); w[i] = d * d; }
    for (let i = 0; i < 4; i++) { if (best < 0 || w[i] > w[best]) { second = best; best = i; } else if (second < 0 || w[i] > w[second]) second = i; }
    const s = w[best] + w[second] || 1;
    const rest = 1 - wh;
    out[0] = hips; out[1] = ids[best]; out[2] = ids[second]; out[3] = 0;
    out[4] = wh; out[5] = rest * w[best] / s; out[6] = rest * w[second] / s; out[7] = 0;
  };
}
function capeSkin(rig) {
  const chest = rig.segOf.chest.i;
  const ids = [];
  for (let i = 0; i < 4; i++) { const s = rig.segOf['cape' + i]; ids.push(s ? s.i : chest); }
  return (tu, tv, out) => {
    const f = tv * 3;
    const i0 = clamp(Math.floor(f), 0, 2), fr = f - i0;
    const wc = Math.pow(Math.max(0, 1 - tv * 3.4), 2);
    const rest = 1 - wc;
    out[0] = chest; out[1] = ids[i0]; out[2] = ids[i0 + 1]; out[3] = 0;
    out[4] = wc; out[5] = rest * (1 - fr); out[6] = rest * fr; out[7] = 0;
  };
}

export function buildCloth(def, rig, solve) {
  const P = new Part(solve);
  const c = def.col;
  let any = false;
  if (def.skirt) {
    const sk = def.skirt; any = true;
    const y0 = sk.top, y1 = sk.bottom, r0 = sk.r0, r1 = sk.r1;
    const waveN = sk.wave != null ? sk.wave : 5, waveA = sk.waveAmp != null ? sk.waveAmp : 0.045;
    const fn = (tu, tv, out) => {
      const phi = -tu * TAU;
      const yy = lerp(y0, y1, tv);
      const rr = lerp(r0, r1, Math.pow(tv, 0.68)) * (1 + waveA * Math.sin(tu * TAU * waveN) * Math.pow(tv, 1.4));
      out.set(Math.sin(phi) * rr, yy - Math.pow(tv, 3) * waveA * 0.5 * Math.cos(tu * TAU * waveN), Math.cos(phi) * rr * 0.94);
    };
    const trimT = sk.trimT != null ? sk.trimT : 0.86;
    addSheet(P, fn, 34, 6, {
      closeU: true, thickness: sk.thickness || 0.009,
      col: (tu, tv) => (tv > trimT ? (c.trim != null ? c.trim : c.top) : (c.skirt != null ? c.skirt : c.top)),
      skin: skirtSkin(rig),
    });
  }
  if (def.cape) {
    const cp = def.cape; any = true;
    const span = (cp.span || 105) * DEG;
    const fn = (tu, tv, out) => {
      const phi = lerp(-span, span, tu);
      const yy = lerp(cp.top, cp.bottom, tv);
      const rr = lerp(cp.r0, cp.r1, Math.pow(tv, 0.8)) * (1 + 0.05 * Math.sin(tu * Math.PI * 3) * tv);
      out.set(Math.sin(phi) * rr, yy, -Math.cos(phi) * rr - tv * 0.018);
    };
    addSheet(P, fn, 14, 7, {
      thickness: cp.thickness || 0.010,
      col: (tu, tv) => (tv > 0.9 ? (cp.trim != null ? cp.trim : cp.col) : (Math.abs(tu - 0.5) > 0.44 ? (cp.inner != null ? cp.inner : cp.col) : cp.col)),
      skin: capeSkin(rig),
    });
    // collar
    addTube(P, [
      { p: [0, 0.792, -0.004], rx: 0.048, ry: 0.044, col: cp.trim != null ? cp.trim : cp.col },
      { p: [0, 0.828, -0.010], rx: 0.052, ry: 0.048, col: cp.col },
    ], { sides: 12, bones: BS.neck, capStart: 'flat', capEnd: 'flat', up: [0, 0, 1] });
  }
  if (def.belt) {
    any = true;
    const b = def.belt;
    addTube(P, [
      { p: [0, b.y - (b.h || 0.016) * 0.5, 0], rx: b.r, ry: b.r * 0.79, col: b.col },
      { p: [0, b.y + (b.h || 0.016) * 0.5, 0], rx: b.r, ry: b.r * 0.79, col: b.col },
    ], { sides: 16, bones: BS.torso, capStart: 'flat', capEnd: 'flat', up: [0, 0, 1] });
  }
  return any ? P : null;
}

// ---------------------------------------------------------------- accessories
const STAR5 = [1, 0.40, 1, 0.40, 1, 0.40, 1, 0.40, 1, 0.40];
const WING4 = [1, 0.34, 0.78, 0.30, 0.9, 0.30, 0.78, 0.34];

export function buildExtras(def, rig, solve) {
  const P = new Part(solve);
  let any = false;
  const hp = def.headP || HEADP, c = def.col;
  const V = new THREE.Vector3();
  if (def.hat) {
    any = true;
    const h = def.hat, cy = hp.cy, ay = hp.ay;
    const dz = h.tilt || 0;
    if (h.type === 'beret') {
      addTube(P, [
        { p: [0.012, cy + ay * 1.16, -0.010 + dz], rx: 0.024, ry: 0.024, col: h.col },
        { p: [0.008, cy + ay * 1.02, -0.006 + dz], rx: 0.060, ry: 0.056, col: h.col },
        { p: [0.004, cy + ay * 0.84, 0.000 + dz], rx: 0.082, ry: 0.078, col: h.col },
        { p: [0.000, cy + ay * 0.66, 0.006 + dz], rx: 0.072, ry: 0.070, col: h.col },
      ], { sides: 14, bones: BS.head, capStart: 'flat', capEnd: 'flat', up: [0, 0, 1] });
      if (h.deco != null) addTube(P, [
        { p: [0.006, cy + ay * 1.20, -0.012 + dz], rx: 0.012, ry: 0.012, col: h.deco },
        { p: [0.006, cy + ay * 1.30, -0.014 + dz], rx: 0.006, ry: 0.006, col: h.deco },
      ], { sides: 6, bones: BS.head, capStart: 'flat', capEnd: 'point', tip: 0.006, up: [0, 0, 1] });
    } else if (h.type === 'cap') {
      addTube(P, [
        { p: [0, cy + ay * 1.12, -0.004 + dz], rx: 0.030, ry: 0.030, col: h.col },
        { p: [0, cy + ay * 0.96, -0.002 + dz], rx: 0.060, ry: 0.058, col: h.col },
        { p: [0, cy + ay * 0.72, 0.002 + dz], rx: 0.074, ry: 0.072, col: h.col },
        { p: [0, cy + ay * 0.56, 0.004 + dz], rx: 0.076, ry: 0.074, col: h.col2 != null ? h.col2 : h.col },
      ], { sides: 14, bones: BS.head, capStart: 'flat', capEnd: 'flat', up: [0, 0, 1] });
      // brim
      addTube(P, [
        { p: [0, cy + ay * 0.56, 0.030], rx: 0.062, ry: 0.010, col: h.col2 != null ? h.col2 : h.col },
        { p: [0, cy + ay * 0.50, 0.098], rx: 0.050, ry: 0.007, col: h.col2 != null ? h.col2 : h.col },
      ], { sides: 10, bones: BS.head, capStart: 'flat', capEnd: 'flat', up: [0, 1, 0] });
    }
  }
  const gear = def.headGear;
  if (gear === 'butterfly' || gear === 'wings') {
    any = true;
    for (const s of [1, -1]) {
      const p = headSurface(s * 74 * DEG, 36 * DEG, 1.13, 1.08, V, hp).toArray();
      const n = headNormal(s * 74 * DEG, 36 * DEG, 1.13, 1.08, V, hp).toArray();
      addTube(P, [
        { p: [p[0] - n[0] * 0.004, p[1] - n[1] * 0.004, p[2] - n[2] * 0.004], rx: 0.026, ry: 0.020, col: c.gear != null ? c.gear : 0xf2e9d0 },
        { p: [p[0] + n[0] * 0.006, p[1] + n[1] * 0.006, p[2] + n[2] * 0.006], rx: 0.030, ry: 0.023, col: c.gear2 != null ? c.gear2 : 0xffffff },
      ], { sides: 8, rmul: WING4, bones: BS.head, capStart: 'flat', capEnd: 'flat', up: [0, 1, 0] });
    }
  } else if (gear === 'star') {
    any = true;
    const p = headSurface(0, 44 * DEG, 1.16, 1.10, V, hp).toArray();
    const n = headNormal(0, 44 * DEG, 1.16, 1.10, V, hp).toArray();
    addTube(P, [
      { p: [p[0] - n[0] * 0.004, p[1] - n[1] * 0.004, p[2] - n[2] * 0.004], rx: 0.030, ry: 0.030, col: c.gear != null ? c.gear : 0xf5e6a8 },
      { p: [p[0] + n[0] * 0.008, p[1] + n[1] * 0.008, p[2] + n[2] * 0.008], rx: 0.024, ry: 0.024, col: c.gear2 != null ? c.gear2 : 0xfff8d8 },
    ], { sides: 10, rmul: STAR5, bones: BS.head, capStart: 'flat', capEnd: 'flat', up: [0, 1, 0] });
  }
  return any ? P : null;
}

/** Skin solver stub for unskinned meshes (weapons, props). */
export const noSkin = (x, y, z, names, outI, outW) => { outI.push(0, 0, 0, 0); outW.push(1, 0, 0, 0); };

// ---------------------------------------------------------------- dynamics / IK
const _pq = new THREE.Quaternion(), _iq = new THREE.Quaternion(), _rq = new THREE.Quaternion();
const _tq = new THREE.Quaternion(), _sq = new THREE.Quaternion();
const _m3 = new THREE.Matrix3();
const _w1 = new THREE.Vector3(), _w2 = new THREE.Vector3(), _w3 = new THREE.Vector3();
const _w4 = new THREE.Vector3(), _w5 = new THREE.Vector3(), _w6 = new THREE.Vector3();

/** Apply a world-space delta rotation to a bone's local transform. */
export function rotateBoneWorld(bone, qDelta) {
  if (!bone.parent) { bone.quaternion.premultiply(qDelta); return; }
  bone.parent.getWorldQuaternion(_pq);
  _iq.copy(_pq).invert();
  _rq.copy(_iq).multiply(qDelta).multiply(_pq);
  bone.quaternion.premultiply(_rq);
}

/** Verlet "dynamic bone" chain: hair tails, skirt panels, capes. */
export class DynChain {
  constructor(bones, opts = {}) {
    this.items = [];
    for (const b of bones) {
      if (!b) continue;
      let child = null;
      for (const ch of b.children) if (ch.isBone) { child = ch; break; }
      const dir = child ? child.position.clone() : new THREE.Vector3(0, -0.06, 0);
      const len = dir.length() || 0.06;
      this.items.push({
        b, dir: dir.clone().normalize(), len,
        p: new THREE.Vector3(), prev: new THREE.Vector3(), init: false,
        rest: b.quaternion.clone(), ph: Math.random() * 6.283,
      });
    }
    this.stiff = opts.stiff != null ? opts.stiff : 0.26;
    this.damp = opts.damp != null ? opts.damp : 0.86;
    this.gravity = opts.gravity != null ? opts.gravity : -3.2;
    this.limit = opts.limit != null ? opts.limit : 50 * DEG;
    this.wind = opts.wind != null ? opts.wind : 0.5;
  }
  reset() { for (const it of this.items) { it.init = false; it.b.quaternion.copy(it.rest); } }
  update(dt, time) {
    const h = Math.min(dt, 1 / 30);
    const hh = h * h;
    for (const it of this.items) {
      const b = it.b;
      b.quaternion.copy(it.rest);
      b.updateMatrixWorld(true);
      _w1.setFromMatrixPosition(b.matrixWorld);                       // joint (world)
      _m3.setFromMatrix4(b.matrixWorld);
      _w2.copy(it.dir).multiplyScalar(it.len).applyMatrix3(_m3);       // rest bone vector (world)
      const wl = _w2.length() || 1e-4;
      _w3.copy(_w1).add(_w2);                                          // rest tip
      if (!it.init) { it.p.copy(_w3); it.prev.copy(_w3); it.init = true; continue; }
      _w4.subVectors(it.p, it.prev).multiplyScalar(this.damp);
      it.prev.copy(it.p);
      it.p.add(_w4);
      it.p.y += this.gravity * hh;
      _w5.subVectors(_w3, it.p).multiplyScalar(this.stiff);
      it.p.add(_w5);
      if (this.wind) {
        const w = this.wind * hh * 6.0;
        it.p.x += Math.sin(time * 1.7 + it.ph) * w;
        it.p.z += Math.cos(time * 1.3 + it.ph * 1.7) * w * 0.8;
      }
      _w6.subVectors(it.p, _w1);
      if (_w6.lengthSq() < 1e-10) _w6.copy(_w2);
      _w6.normalize();
      _w2.normalize();
      const dot = clamp(_w6.dot(_w2), -1, 1);
      const ang = Math.acos(dot);
      if (ang > this.limit) {
        _tq.setFromUnitVectors(_w2, _w6);
        _sq.identity().slerp(_tq, this.limit / ang);
        _w6.copy(_w2).applyQuaternion(_sq);
      }
      it.p.copy(_w1).addScaledVector(_w6, wl);
      _tq.setFromUnitVectors(_w2, _w6);
      rotateBoneWorld(b, _tq);
      b.updateMatrixWorld(true);
    }
  }
}

/**
 * Shift the hips vertically so the lowest sole rests on groundY. Makes every hand
 * authored grounded pose contact the floor and produces the hip bob of gait for free.
 */
const _HEEL = new THREE.Vector3(0, -0.030, -0.034);
const _BALL = new THREE.Vector3(0, -0.010, 0.014);
/** Lowest point of the boot sole in world space (heel and ball are sampled). */
export function soleY(rig, n) {
  const b = rig.bones, a = b['foot' + n], t = b['toe' + n];
  if (!a) return Infinity;
  _w1.copy(_HEEL).applyMatrix4(a.matrixWorld);
  let y = _w1.y;
  if (t) { _w2.copy(_BALL).applyMatrix4(t.matrixWorld); y = Math.min(y, _w2.y); }
  return y;
}

export function plantFeet(rig, groundY, maxShift, wL, wR) {
  const b = rig.bones;
  // use the WORST (highest) planted sole so contact is always reachable; the other
  // foot then only needs the knee to bend, which IK can always do.
  let hi = -Infinity;
  const ws = [wL != null ? wL : 1, wR != null ? wR : 1];
  const ns = ['L', 'R'];
  for (let i = 0; i < 2; i++) {
    if (ws[i] < 0.3) continue;
    const y = soleY(rig, ns[i]);
    if (y > hi) hi = y;
  }
  if (!isFinite(hi)) return 0;
  const dy = clamp(groundY - hi, -maxShift, maxShift);
  if (Math.abs(dy) > 1e-5 && b.hips) {
    b.hips.position.y += dy / rig.scaleM;
    rig.root.updateMatrixWorld(true);
  }
  return dy;
}

/**
 * Foot IK: move the sole to groundY (both directions) with a plant weight, so authored
 * poses always make clean contact. weight 0 disables, maxFix guards silly poses.
 */
export function footToGround(rig, n, groundY, weight, maxFix) {
  const thigh = rig.bones['thigh' + n], shin = rig.bones['shin' + n], foot = rig.bones['foot' + n];
  if (!thigh || !shin || !foot || weight <= 0.02) return;
  const dy = (groundY - soleY(rig, n)) * clamp(weight, 0, 1);
  if (!isFinite(dy)) return;
  if (Math.abs(dy) < 0.0008 || Math.abs(dy) > maxFix) return;
  _w1.setFromMatrixPosition(foot.matrixWorld);
  const ty = _w1.y + dy;
  for (let it = 0; it < 2; it++) {
    const chain = it === 0 ? [shin, thigh] : [thigh, shin];
    for (const b of chain) {
      _w2.setFromMatrixPosition(b.matrixWorld);
      _w1.setFromMatrixPosition(foot.matrixWorld);
      _w3.set(_w1.x, ty, _w1.z);
      _w4.subVectors(_w1, _w2); _w5.subVectors(_w3, _w2);
      if (_w4.lengthSq() < 1e-9 || _w5.lengthSq() < 1e-9) continue;
      _w4.normalize(); _w5.normalize();
      _tq.setFromUnitVectors(_w4, _w5);
      _sq.identity().slerp(_tq, b === thigh ? 0.5 : 0.95);
      rotateBoneWorld(b, _sq);
      b.updateMatrixWorld(true);
    }
  }
}

/** Two-iteration CCD so a foot never sinks below minY (world). */
export function groundLeg(rig, n, minY, maxFix) {
  const thigh = rig.bones['thigh' + n], shin = rig.bones['shin' + n], foot = rig.bones['foot' + n];
  if (!thigh || !shin || !foot) return;
  _w1.setFromMatrixPosition(foot.matrixWorld);
  const pen = minY - _w1.y;
  if (pen <= 0.0008 || pen > maxFix) return;
  for (let it = 0; it < 2; it++) {
    const chain = it === 0 ? [shin, thigh] : [thigh, shin];
    for (const b of chain) {
      _w2.setFromMatrixPosition(b.matrixWorld);
      _w1.setFromMatrixPosition(foot.matrixWorld);
      _w3.set(_w1.x, Math.max(_w1.y, minY), _w1.z);
      _w4.subVectors(_w1, _w2); _w5.subVectors(_w3, _w2);
      if (_w4.lengthSq() < 1e-9 || _w5.lengthSq() < 1e-9) continue;
      _w4.normalize(); _w5.normalize();
      _tq.setFromUnitVectors(_w4, _w5);
      _sq.identity().slerp(_tq, b === thigh ? 0.55 : 0.9);
      rotateBoneWorld(b, _sq);
      b.updateMatrixWorld(true);
    }
  }
}

// ---------------------------------------------------------------- rig assembly
/**
 * Build skeleton + one merged SkinnedMesh (+ outline shell) for a character def.
 * Heavy generation is sliced through ctx.tasks when available; rig.ready flips to
 * true on the last slice.
 */
export function buildRig(ctx, def, opts = {}) {
  const skel = buildSkeleton(def);
  const solve = makeSolver(skel);
  const root = new THREE.Group();
  root.name = 'char:' + def.id;
  const scaleM = def.height * (opts.scale != null ? opts.scale : 1);
  root.scale.setScalar(scaleM);
  root.add(skel.bones.hips);

  const face = new FaceTexture(def);
  const mat = makeCharMaterial({
    map: face.texture,
    rimColor: def.rimColor != null ? def.rimColor : 0xcfe4ff,
    rimStrength: def.rim != null ? def.rim : 0.55,
  });
  const oMat = makeOutlineMaterial({
    color: def.outlineColor != null ? def.outlineColor : outlineColorFrom(def.col.hair),
    width: (def.outlineWidth != null ? def.outlineWidth : 0.0026),
  });

  const weaponBone = new THREE.Object3D();
  weaponBone.name = 'weaponMount';
  weaponBone.position.set(0, -0.038, 0.008);
  weaponBone.rotation.set(Math.PI * 0.74, 0, Math.PI * 0.03);
  weaponBone.scale.setScalar(1 / Math.max(1e-4, scaleM));
  if (skel.bones.handR) skel.bones.handR.add(weaponBone);

  const rig = {
    def, root, scaleM, bones: skel.bones, boneList: skel.list, segOf: skel.segOf, abs: skel.abs,
    face, mat, outlineMat: oMat, weaponBone, parts: [], dyn: [], ready: false, disposed: false,
    mesh: null, outline: null, skeleton: null,
  };

  const steps = [
    () => rig.parts.push(buildTorso(def, skel, solve)),
    () => rig.parts.push(buildLimbs(def, skel, solve)),
    () => rig.parts.push(buildHead(def, skel, solve)),
    () => rig.parts.push(buildHair(def, skel, solve)),
    () => {
      const a = buildCloth(def, skel, solve); if (a) rig.parts.push(a);
      const b = buildExtras(def, skel, solve); if (b) rig.parts.push(b);
    },
    () => {
      const geo = mergeParts(rig.parts);
      rig.geometry = geo;
      const skeleton = new THREE.Skeleton(skel.list);
      const mesh = new THREE.SkinnedMesh(geo, mat);
      mesh.name = 'charMesh';
      mesh.castShadow = true;
      // Toon faces must not receive the sun's self-shadow (hair shadow + normalBias
      // wrecks the cel terminator). Integrator can flip it via ch.setReceiveShadow(true).
      mesh.receiveShadow = def.receiveShadow === true;
      root.add(mesh);
      const outline = new THREE.SkinnedMesh(geo, oMat);
      outline.name = 'charOutline';
      outline.castShadow = false; outline.receiveShadow = false;
      root.add(outline);
      root.updateMatrixWorld(true);
      mesh.bind(skeleton);
      outline.bind(skeleton, mesh.bindMatrix.clone());
      rig.mesh = mesh; rig.outline = outline; rig.skeleton = skeleton;
      // secondary dynamics
      const tails = (def.hair && def.hair.tails) || [];
      for (let i = 0; i < tails.length; i++) {
        const chain = [];
        for (let j = 0; j < tails[i].bones.length; j++) chain.push(skel.bones['hair' + i + '_' + j]);
        rig.dyn.push(new DynChain(chain, {
          stiff: tails[i].stiff != null ? tails[i].stiff : 0.24,
          damp: 0.87, gravity: -3.4, limit: 55 * DEG, wind: 0.6,
        }));
      }
      if (def.skirt) {
        const c = [];
        for (let i = 0; i < 4; i++) c.push(skel.bones['skirt' + i]);
        rig.dyn.push(new DynChain(c, { stiff: 0.34, damp: 0.80, gravity: -4.6, limit: 34 * DEG, wind: 0.35 }));
      }
      if (def.cape) {
        const c = [];
        for (let i = 0; i < 4; i++) c.push(skel.bones['cape' + i]);
        rig.dyn.push(new DynChain(c, { stiff: 0.20, damp: 0.89, gravity: -2.6, limit: 62 * DEG, wind: 1.1 }));
      }
      rig.parts.length = 0;
      rig.ready = true;
      if (typeof rig.onReady === 'function') rig.onReady(rig);
    },
  ];

  const run = (fn) => { if (!rig.disposed) { try { fn(); } catch (e) { console.error('[char build]', def.id, e); } } };
  if (ctx && ctx.tasks && ctx.tasks.push && opts.sync !== true) {
    const pr = opts.priority != null ? opts.priority : 4;
    for (let i = 0; i < steps.length; i++) { const f = steps[i]; ctx.tasks.push(() => run(f), pr + i * 0.01); }
  } else {
    for (const f of steps) run(f);
  }
  return rig;
}

export function disposeRig(rig) {
  rig.disposed = true;
  if (rig.geometry) rig.geometry.dispose();
  if (rig.mat) rig.mat.dispose();
  if (rig.outlineMat) rig.outlineMat.dispose();
  if (rig.face) rig.face.dispose();
  if (rig.root.parent) rig.root.parent.remove(rig.root);
  rig.ready = false;
}
