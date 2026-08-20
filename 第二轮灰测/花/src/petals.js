// The protagonist: a drifting swarm of petals.
//
// A "guide" point is what the player actually steers; the petals chase a delayed copy of
// its path with a swirl, so the swarm reads as one soft ribbon that stretches when you
// accelerate and gathers into a slow bloom when you stop.

import * as THREE from 'three';
import { terrainHeight, terrainNormal } from './noise.js';
import { U, pick, GLSL_LIGHT, GLSL_SHADOW } from './uniforms.js';
import { GLSL_NOISE } from './noise.js';

const VERT = /* glsl */ `
  precision highp float;

  attribute vec4 aData;   // x: phase, y: size, z: alpha, w: hue
  attribute vec2 aUV;

  uniform float uTime;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec2 vUV;
  varying float vHue;
  varying float vAlpha;

  void main(){
    vec3 p = position;
    // soft flutter: the petal ripples along its length
    float ph = aData.x * 6.2831853;
    float fl = sin(uTime * (3.4 + aData.x * 2.6) + ph + aUV.y * 3.4);
    p.z += fl * 0.055 * aUV.y;
    p.x *= 1.0 + 0.12 * fl * aUV.y;

    vec4 ip = instanceMatrix * vec4(p, 1.0);
    vWorld = ip.xyz;
    vNormal = normalize((instanceMatrix * vec4(normal, 0.0)).xyz);
    vUV = aUV;
    vHue = aData.w;
    vAlpha = aData.z;

    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
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

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec2 vUV;
  varying float vHue;
  varying float vAlpha;

  void main(){
    // petal outline: rounded tip, soft base
    float edge = 1.0 - abs(vUV.x * 2.0 - 1.0);
    float mask = smoothstep(0.02, 0.16, edge) * smoothstep(0.0, 0.12, vUV.y) * smoothstep(1.02, 0.86, vUV.y);
    if (mask * vAlpha < 0.42) discard;

    vec3 V = normalize(uCamPos - vWorld);
    vec3 n = normalize(vNormal);
    if (dot(n, V) < 0.0) n = -n;

    float shade = mix(1.0, cloudShade(vWorld.xz), 0.55);

    vec3 tint = uPetalTint * mix(vec3(1.0, 0.97, 0.98), vec3(1.0, 0.86, 0.72), vHue);
    // veins
    float vein = smoothstep(0.55, 0.95, abs(sin(vUV.x * 9.0 + vUV.y * 1.6)));
    tint *= 0.94 + 0.10 * vein;

    float ndl = wrapDiffuse(n, uSunDir, 0.65);
    vec3 sun = uSunColor * uSunIntensity * ndl * shade;
    vec3 amb = hemiAmbient(n) * 1.15;

    // thin translucent membrane: glows when the light is behind it
    float back = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 2.2);
    vec3 trans = uSunColor * uSunIntensity * back * 1.05 * shade * tint;

    vec3 col = tint * (sun * 0.9 + amb) + trans;
    // gentle self-glow so bloom gives the swarm a halo
    col += tint * (0.16 + 0.62 * uFlowerGlow) * (0.6 + 0.4 * vUV.y);
    col += uSunColor * uFlash * 0.4;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function petalGeometry(len = 0.60, wid = 0.35) {
  const NU = 4, NV = 7;
  const verts = [], uvs = [], idx = [];
  for (let j = 0; j <= NV; j++) {
    const v = j / NV;
    const halfW = Math.pow(Math.sin(Math.PI * Math.min(v * 0.92 + 0.04, 1)), 0.72) * 0.5 * wid;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const x = (u - 0.5) * 2 * halfW;
      const y = v * len;
      // cupped cross-section + lengthwise curl
      const z = -Math.pow((u - 0.5) * 2, 2) * halfW * 0.55 + Math.sin(v * Math.PI) * len * 0.10;
      verts.push(x, y, z);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('aUV', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // pivot near the base so tumbling looks like a falling petal
  g.translate(0, -len * 0.35, 0);
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);
const AX_X = new THREE.Vector3(1, 0, 0);
const AX_Y = new THREE.Vector3(0, 1, 0);

export class Petals {
  constructor(maxCount = 320) {
    this.max = maxCount;
    this.geometry = petalGeometry();
    this.material = new THREE.ShaderMaterial({
      uniforms: pick('noise', 'light', 'shadow', 'palette', 'time', {
        uCamPos: U.uCamPos,
      }),
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
    });

    this.data = new Float32Array(maxCount * 4);
    this.geometry.setAttribute('aData', new THREE.InstancedBufferAttribute(this.data, 4));

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, maxCount);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.matrixAutoUpdate = false;

    // guide point (what the player steers)
    this.guide = new THREE.Vector3(0, 0, 0);
    this.guideVel = new THREE.Vector3();
    this.guide.y = terrainHeight(0, 0) + 2.6;
    this.hover = 2.6;
    this.speed = 0;
    this.heading = new THREE.Vector3(0, 0, -1);
    this.wantDir = new THREE.Vector3();
    this.boost = 0;
    this.lift = 0;

    // path history so petals trail behind
    this.hist = new Float32Array(512 * 3);
    this.histN = 512;
    this.histI = 0;
    for (let i = 0; i < this.histN; i++) {
      this.hist[i * 3] = this.guide.x; this.hist[i * 3 + 1] = this.guide.y; this.hist[i * 3 + 2] = this.guide.z;
    }

    this.items = [];
    for (let i = 0; i < maxCount; i++) {
      this.items.push({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        lag: 0, radius: 1, phase: 0, spin: 0, tumble: 0, twist: 0, size: 1, wob: 0,
      });
    }
    this.setCount(168);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this.centroid = new THREE.Vector3().copy(this.guide);
    this.spreadRadius = 3;
    this.idle = 0;
  }

  setCount(n) {
    n = Math.max(8, Math.min(this.max, Math.round(n)));
    this.count = n;
    this.mesh.count = n;
    const rnd = mulberry(4711);
    for (let i = 0; i < n; i++) {
      const it = this.items[i];
      const r = rnd();
      it.lag = Math.pow(rnd(), 1.35) * 0.86;         // 0 = at the guide, 1 = far back
      it.radius = 0.35 + Math.pow(rnd(), 0.7) * 2.4;
      it.phase = rnd() * Math.PI * 2;
      it.spin = (0.5 + rnd() * 1.6) * (rnd() < 0.5 ? -1 : 1);
      it.tumble = rnd() * Math.PI * 2;
      it.twist = rnd() * Math.PI * 2;
      it.size = 0.55 + Math.pow(rnd(), 1.4) * 0.85;
      it.wob = 0.4 + rnd() * 1.5;
      it.pos.copy(this.guide).add(new THREE.Vector3((rnd() - 0.5) * 4, rnd() * 1.5, (rnd() - 0.5) * 4));
      it.vel.set(0, 0, 0);
      this.data[i * 4 + 0] = r;
      this.data[i * 4 + 1] = it.size;
      this.data[i * 4 + 2] = 1;
      this.data[i * 4 + 3] = rnd();
    }
    this.geometry.attributes.aData.needsUpdate = true;
  }

  steer(dir, boost, lift) {
    this.wantDir.copy(dir);
    this.boost = boost;
    this.lift = lift;
  }

  sampleHist(lagSeconds, out) {
    // history is stored at a fixed 1/60 s cadence
    const back = Math.min(this.histN - 2, Math.max(0, lagSeconds * 60));
    const f = Math.floor(back);
    const frac = back - f;
    const i0 = ((this.histI - 1 - f) % this.histN + this.histN) % this.histN;
    const i1 = ((i0 - 1) % this.histN + this.histN) % this.histN;
    const a = i0 * 3, b = i1 * 3;
    out.set(
      this.hist[a] + (this.hist[b] - this.hist[a]) * frac,
      this.hist[a + 1] + (this.hist[b + 1] - this.hist[a + 1]) * frac,
      this.hist[a + 2] + (this.hist[b + 2] - this.hist[a + 2]) * frac,
    );
    return out;
  }

  update(dt, time, wind) {
    const g = this.guide;

    // ---- guide motion
    const want = this.wantDir;
    const wantLen = want.length();
    const maxSpeed = 9.5 + this.boost * 12.0;
    const accel = wantLen > 0.01 ? 26 : 9;
    this._v.copy(want).multiplyScalar(maxSpeed);
    // let go and the swarm just breathes downwind, slowly, so stopping really reads as stopping
    const steering = wantLen > 0.01;
    if (!steering) {
      this._v.set(wind.x, 0, wind.y).multiplyScalar(0.30 + 0.16 * Math.sin(time * 0.21));
    }
    this.guideVel.x += (this._v.x - this.guideVel.x) * Math.min(1, accel * dt * 0.16);
    this.guideVel.z += (this._v.z - this.guideVel.z) * Math.min(1, accel * dt * 0.16);

    g.x += this.guideVel.x * dt;
    g.z += this.guideVel.z * dt;

    // hover above the ground, rising over ridges and when lifting
    const gh = terrainHeight(g.x, g.z);
    const targetHover = 2.55 + this.lift * 7.5 + this.boost * 1.2 + Math.sin(time * 0.53) * 0.35;
    const targetY = gh + targetHover;
    this.guideVel.y += (targetY - g.y) * 5.2 * dt;
    this.guideVel.y *= Math.pow(0.0016, dt);
    g.y += this.guideVel.y * dt;

    this.speed = Math.hypot(this.guideVel.x, this.guideVel.z);
    if (this.speed > 0.35) this.heading.set(this.guideVel.x, 0, this.guideVel.z).normalize();
    if (steering || this.boost > 0.5) {
      this.idle = Math.max(0, this.idle - dt * 2.4);
    } else {
      this.idle = Math.min(1, this.idle + dt * 0.55);
    }
    this.steering = steering;

    // record path
    this._histAcc = (this._histAcc || 0) + dt;
    while (this._histAcc >= 1 / 60) {
      this._histAcc -= 1 / 60;
      this.hist[this.histI * 3 + 0] = g.x;
      this.hist[this.histI * 3 + 1] = g.y;
      this.hist[this.histI * 3 + 2] = g.z;
      this.histI = (this.histI + 1) % this.histN;
    }

    // ---- petals chase the delayed path with a swirl
    const target = this._v;
    const tmp = this._v2;
    const gather = 0.45 + 0.85 * this.idle;      // stopping pulls the swarm together
    const cx = { x: 0, y: 0, z: 0 };
    let maxR2 = 0;

    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      this.sampleHist(it.lag * (0.35 + this.speed * 0.075), target);

      const ph = it.phase + time * it.spin * (0.55 + 0.5 * this.idle);
      const swirlR = it.radius * (1.25 - 0.55 * gather) * (1 + this.speed * 0.02);
      target.x += Math.cos(ph) * swirlR;
      target.z += Math.sin(ph) * swirlR;
      target.y += Math.sin(ph * 0.7 + it.phase) * swirlR * 0.55
                + Math.sin(time * it.wob + it.phase) * 0.35
                + it.lag * 0.6;

      // spring + wind + drag
      tmp.copy(target).sub(it.pos);
      const k = 3.1 + 3.4 * (1 - it.lag);
      it.vel.x += tmp.x * k * dt;
      it.vel.y += tmp.y * k * dt;
      it.vel.z += tmp.z * k * dt;
      it.vel.x += wind.x * 1.1 * dt;
      it.vel.z += wind.y * 1.1 * dt;
      const drag = Math.pow(0.0045, dt);
      it.vel.multiplyScalar(drag);
      it.pos.addScaledVector(it.vel, dt);

      // never sink into the meadow
      const th = terrainHeight(it.pos.x, it.pos.z) + 0.35;
      if (it.pos.y < th) {
        it.pos.y += (th - it.pos.y) * Math.min(1, 9 * dt);
        it.vel.y += 2.5 * dt;
      }

      // orientation: fly along velocity, tumble like a falling petal
      const sp = it.vel.length();
      tmp.copy(it.vel);
      if (sp < 0.05) tmp.set(this.heading.x, 0.2, this.heading.z);
      tmp.normalize();
      it.tumble += dt * (1.1 + sp * 0.55) * it.spin * 0.55;
      it.twist += dt * (0.7 + sp * 0.25);

      this._q.setFromUnitVectors(UP, tmp);
      this._q2.setFromAxisAngle(AX_X, it.tumble);
      this._q.multiply(this._q2);
      this._q2.setFromAxisAngle(AX_Y, it.twist);
      this._q.multiply(this._q2);

      const s = it.size * (0.85 + 0.3 * Math.sin(time * 1.7 + it.phase));
      this._s.set(s, s, s);
      this._m.compose(it.pos, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);

      cx.x += it.pos.x; cx.y += it.pos.y; cx.z += it.pos.z;
    }

    this.mesh.instanceMatrix.needsUpdate = true;

    this.centroid.set(cx.x / this.count, cx.y / this.count, cx.z / this.count);
    for (let i = 0; i < this.count; i++) {
      const d = this.items[i].pos.distanceToSquared(this.centroid);
      if (d > maxR2) maxR2 = d;
    }
    this.spreadRadius = Math.sqrt(maxR2);
  }

  groundNormal(out) {
    return terrainNormal(this.guide.x, this.guide.z, out);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
