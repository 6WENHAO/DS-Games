// Flowers that bloom in the swarm's wake.
//
// One instanced mesh, a ring-buffer pool and a coarse occupancy grid so blossoms never
// stack on top of each other. Each instance stores its planting time; the growth spring
// runs entirely in the vertex shader.

import * as THREE from 'three';
import { terrainHeight, terrainNormal } from './noise.js';
import { GLSL_NOISE, GLSL_TERRAIN } from './noise.js';
import { U, pick, GLSL_LIGHT, GLSL_SHADOW, GLSL_WIND } from './uniforms.js';

const VERT = /* glsl */ `
  precision highp float;

  attribute vec4 aInst0;   // xyz: base position, w: plant time
  attribute vec4 aInst1;   // x: scale, y: yaw, z: hue, w: kind
  attribute vec3 aTilt;    // ground normal
  attribute vec3 aPart;    // x: part id (0 petal, 1 core, 2 stem), y: v along petal, z: petal index

  ${GLSL_NOISE}
  ${GLSL_WIND}

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vPart;
  varying float vV;
  varying float vHue;
  varying float vGrow;

  mat3 rotY(float a){
    float c = cos(a), s = sin(a);
    return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  }

  void main(){
    float plant = aInst0.w;
    float age = max(0.0, uTime - plant);
    float g = clamp(age / 2.1, 0.0, 1.0);
    // springy bloom with a little overshoot
    float e = 1.0 - pow(1.0 - g, 3.0);
    float grow = e * (1.0 + 0.17 * sin(g * 9.0) * (1.0 - g));
    if (plant < 0.0) grow = 0.0;

    float scale = aInst1.x * grow;
    vec3 p = rotY(aInst1.y) * position;

    // petals unfurl: they start folded upward and open as the flower grows
    float fold = 1.0 - smoothstep(0.25, 1.0, g);
    p.y += (1.0 - aPart.x) * length(p.xz) * fold * 1.35;
    p.xz *= mix(0.35, 1.0, smoothstep(0.1, 0.9, g));

    p *= scale;

    // lean with the ground, then bend with the wind
    vec3 base = aInst0.xyz;
    vec3 tilt = normalize(mix(vec3(0.0, 1.0, 0.0), aTilt, 0.55));
    float hfac = clamp(p.y / max(scale, 0.001), 0.0, 2.0);
    vec2 bend = windBend(base.xz, uTime) * 0.34 * scale * hfac;
    bend += vec2(cos(aInst1.y), sin(aInst1.y)) * 0.02 * sin(uTime * 2.6 + aInst1.z * 31.0) * scale;

    vec3 world = base + p + vec3(bend.x, 0.0, bend.y) + (tilt - vec3(0.0, 1.0, 0.0)) * p.y * 0.6;

    vWorld = world;
    vNormal = normalize(rotY(aInst1.y) * normal + vec3(bend.x, 0.0, bend.y) * 1.5);
    vPart = aPart.x;
    vV = aPart.y;
    vHue = aInst1.z;
    vGrow = g;

    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  ${GLSL_NOISE}
  ${GLSL_LIGHT}
  ${GLSL_SHADOW}

  uniform vec3 uCamPos;
  uniform vec3 uPetalTint;
  uniform float uFlowerGlow;
  uniform vec3 uGrassDeep;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vPart;
  varying float vV;
  varying float vHue;
  varying float vGrow;

  vec3 flowerPalette(float h){
    vec3 pink = vec3(1.00, 0.63, 0.76);
    vec3 butter = vec3(1.00, 0.90, 0.52);
    vec3 peri = vec3(0.70, 0.79, 1.00);
    vec3 white = vec3(1.00, 0.98, 0.94);
    vec3 coral = vec3(1.00, 0.55, 0.45);
    if (h < 0.32) return mix(pink, coral, h / 0.32);
    if (h < 0.58) return mix(butter, white, (h - 0.32) / 0.26);
    if (h < 0.82) return mix(peri, white, (h - 0.58) / 0.24);
    return mix(white, pink, (h - 0.82) / 0.18);
  }

  void main(){
    vec3 V = normalize(uCamPos - vWorld);
    vec3 n = normalize(vNormal);
    if (dot(n, V) < 0.0) n = -n;

    float shade = cloudShade(vWorld.xz);

    vec3 col;
    if (vPart > 1.5) {
      col = mix(uGrassDeep, vec3(0.55, 0.72, 0.36), 0.55);         // stem
    } else if (vPart > 0.5) {
      col = mix(vec3(1.0, 0.85, 0.35), vec3(0.98, 0.62, 0.22), vHue); // core
    } else {
      vec3 base = flowerPalette(vHue) * mix(vec3(1.0), uPetalTint, 0.28);
      // pale toward the tip, deeper at the throat
      col = mix(base * 0.72, mix(base, vec3(1.0), 0.28), smoothstep(0.0, 1.0, vV));
      float streak = smoothstep(0.6, 1.0, abs(sin(vV * 5.0 + vHue * 20.0)));
      col *= 0.95 + 0.1 * streak;
    }

    float ndl = wrapDiffuse(n, uSunDir, 0.55);
    vec3 sun = uSunColor * uSunIntensity * ndl * shade;
    vec3 amb = hemiAmbient(n) * 1.05;
    float back = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 2.4);
    vec3 trans = uSunColor * uSunIntensity * back * shade * 0.85 * col * (vPart > 0.5 ? 0.25 : 1.0);

    vec3 lit = col * (sun + amb) + trans;
    lit += col * uFlowerGlow * (vPart > 0.5 ? 0.15 : 0.75) * (0.5 + 0.5 * vGrow);
    lit *= mix(1.0, 0.86, uWet);
    lit += uSunColor * uFlash * 0.4;

    gl_FragColor = vec4(lit, 1.0);
  }
`;

function flowerGeometry() {
  const pos = [], nrm = [], part = [], idx = [];
  const PETALS = 5;
  const stemH = 0.30, headR = 0.16;

  // ---- stem (a thin tapered prism, 3 sides)
  const sides = 3;
  const base = pos.length / 3;
  for (let s = 0; s < sides; s++) {
    const a = (s / sides) * Math.PI * 2;
    const c = Math.cos(a), si = Math.sin(a);
    pos.push(c * 0.014, 0, si * 0.014); nrm.push(c, 0.15, si); part.push(2, 0, 0);
    pos.push(c * 0.008, stemH, si * 0.008); nrm.push(c, 0.15, si); part.push(2, 1, 0);
  }
  for (let s = 0; s < sides; s++) {
    const a = base + s * 2, b = base + ((s + 1) % sides) * 2;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }

  // ---- petals
  for (let p = 0; p < PETALS; p++) {
    const yaw = (p / PETALS) * Math.PI * 2;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const NV = 4, NU = 2;
    const start = pos.length / 3;
    for (let j = 0; j <= NV; j++) {
      const v = j / NV;
      const halfW = Math.pow(Math.sin(Math.PI * Math.min(v * 0.9 + 0.1, 1)), 0.7) * 0.55;
      for (let i = 0; i <= NU; i++) {
        const u = i / NU;
        const lx = (u - 0.5) * 2 * halfW * headR * 1.35;   // across the petal
        const lz = 0.05 + v * headR * 1.55;                // along the petal
        const ly = stemH + Math.sin(v * Math.PI * 0.82) * headR * 0.42 - Math.pow(v, 2) * headR * 0.30;
        // rotate the (lz, lx) petal frame around Y by `yaw`
        pos.push(cy * lz - sy * lx, ly, sy * lz + cy * lx);
        const bulge = Math.cos(v * Math.PI * 0.82);
        nrm.push(-cy * 0.25 * bulge, 0.9, -sy * 0.25 * bulge);
        part.push(0, v, p);
      }
    }
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const a = start + j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
  }

  // ---- core (small fan)
  const cstart = pos.length / 3;
  pos.push(0, stemH + headR * 0.30, 0); nrm.push(0, 1, 0); part.push(1, 1, 0);
  const CN = 7;
  for (let s = 0; s <= CN; s++) {
    const a = (s / CN) * Math.PI * 2;
    pos.push(Math.cos(a) * headR * 0.34, stemH + headR * 0.13, Math.sin(a) * headR * 0.34);
    nrm.push(Math.cos(a) * 0.4, 0.9, Math.sin(a) * 0.4);
    part.push(1, 0.2, 0);
  }
  for (let s = 0; s < CN; s++) idx.push(cstart, cstart + 1 + s, cstart + 2 + s);

  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 3));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  return g;
}

export class Flowers {
  constructor(capacity = 7000) {
    this.capacity = capacity;
    this.geometry = flowerGeometry();
    this.i0 = new Float32Array(capacity * 4);
    this.i1 = new Float32Array(capacity * 4);
    this.tilt = new Float32Array(capacity * 3);
    for (let i = 0; i < capacity; i++) {
      this.i0[i * 4 + 3] = -1;             // plant time < 0 == empty slot
      this.tilt[i * 3 + 1] = 1;
    }
    this.aI0 = new THREE.InstancedBufferAttribute(this.i0, 4);
    this.aI1 = new THREE.InstancedBufferAttribute(this.i1, 4);
    this.aTilt = new THREE.InstancedBufferAttribute(this.tilt, 3);
    this.aI0.setUsage(THREE.DynamicDrawUsage);
    this.aI1.setUsage(THREE.DynamicDrawUsage);
    this.aTilt.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('aInst0', this.aI0);
    this.geometry.setAttribute('aInst1', this.aI1);
    this.geometry.setAttribute('aTilt', this.aTilt);
    this.geometry.instanceCount = 0;

    this.material = new THREE.ShaderMaterial({
      uniforms: pick('noise', 'light', 'shadow', 'palette', 'wind', {
        uCamPos: U.uCamPos,
      }),
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;

    this.next = 0;
    this.live = 0;
    this.cells = new Map();
    this.slotCell = new Array(capacity).fill(null);
    this.cell = 1.05;
    this.dirtyLo = Infinity;
    this.dirtyHi = -Infinity;
    this._n = { x: 0, y: 1, z: 0 };
    this.total = 0;
  }

  key(x, z) {
    return `${Math.round(x / this.cell)}:${Math.round(z / this.cell)}`;
  }

  /** returns true when a flower was actually planted */
  plant(x, z, time, hue = Math.random(), scale = 1) {
    const k = this.key(x, z);
    if (this.cells.has(k)) return false;

    const i = this.next;
    this.next = (this.next + 1) % this.capacity;

    const old = this.slotCell[i];
    if (old !== null) this.cells.delete(old);
    this.cells.set(k, i);
    this.slotCell[i] = k;

    const y = terrainHeight(x, z);
    const n = terrainNormal(x, z, this._n);

    this.i0[i * 4 + 0] = x;
    this.i0[i * 4 + 1] = y;
    this.i0[i * 4 + 2] = z;
    this.i0[i * 4 + 3] = time;
    this.i1[i * 4 + 0] = scale * (0.7 + Math.random() * 0.85);
    this.i1[i * 4 + 1] = Math.random() * Math.PI * 2;
    this.i1[i * 4 + 2] = hue;
    this.i1[i * 4 + 3] = Math.random();
    this.tilt[i * 3 + 0] = n.x;
    this.tilt[i * 3 + 1] = n.y;
    this.tilt[i * 3 + 2] = n.z;

    this.dirtyLo = Math.min(this.dirtyLo, i);
    this.dirtyHi = Math.max(this.dirtyHi, i);
    this.live = Math.min(this.capacity, this.live + 1);
    this.total++;
    this.geometry.instanceCount = this.live;
    return true;
  }

  flush() {
    if (this.dirtyHi < this.dirtyLo) return;
    const lo = this.dirtyLo, hi = this.dirtyHi;
    for (const [attr, stride] of [[this.aI0, 4], [this.aI1, 4], [this.aTilt, 3]]) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(lo * stride, (hi - lo + 1) * stride);
      attr.needsUpdate = true;
    }
    this.dirtyLo = Infinity;
    this.dirtyHi = -Infinity;
  }

  clear() {
    for (let i = 0; i < this.capacity; i++) {
      this.i0[i * 4 + 3] = -1;
      this.slotCell[i] = null;
    }
    this.cells.clear();
    this.next = 0;
    this.live = 0;
    this.total = 0;
    this.geometry.instanceCount = 0;
    this.aI0.clearUpdateRanges();
    this.aI0.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
