// ---------------------------------------------------------------------------
// 粒子特效：炊烟 / 蒸汽 / 喷泉水花 / 路灯光晕 / 飞鸟
// 全部用单个 Points（自定义 shader）实现，保证 draw call 极少。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { MAT, SPRITE_TEX } from '../lib/materials.js';
import * as G from '../lib/geom.js';
import { Rng } from '../lib/rng.js';

const PART_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main(){
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (320.0 / max(-mv.z, 1.0));
  }
`;
const PART_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main(){
    vec4 t = texture2D(uMap, gl_PointCoord);
    if (t.a * vAlpha < 0.004) discard;
    gl_FragColor = vec4(vColor, t.a * vAlpha);
  }
`;

/** 通用粒子池 */
export class ParticlePool {
  constructor(max = 700, map = SPRITE_TEX.smoke, blending = THREE.NormalBlending) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.color = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    geo.setDrawRange(0, max);
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map } },
      vertexShader: PART_VERT,
      fragmentShader: PART_FRAG,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.name = 'particles';
    for (let i = 0; i < max; i++) {
      this.alpha[i] = 0;
      this.pos[i * 3 + 1] = -9999;
    }
  }

  spawn(x, y, z, vx, vy, vz, size, life, color, grow = 0.9, gravity = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.size[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grow[i] = grow;
    this.gravity[i] = gravity;
    this.color[i * 3] = color.r;
    this.color[i * 3 + 1] = color.g;
    this.color[i * 3 + 2] = color.b;
  }

  update(dt) {
    const { pos, vel, size, alpha, life, maxLife, grow, gravity } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) {
        if (alpha[i] !== 0) alpha[i] = 0;
        continue;
      }
      life[i] -= dt;
      const k = Math.max(life[i], 0) / maxLife[i];
      vel[i * 3 + 1] -= gravity[i] * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] += grow[i] * dt;
      alpha[i] = k < 0.25 ? (k / 0.25) * 0.55 : 0.55 * (1 - (k - 0.25) * 0.25);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }
}

const _wp = new THREE.Vector3();

/** 炊烟 / 蒸汽系统：从 anchors.smoke 持续喷出 */
export function createSmoke(anchors) {
  const pool = new ParticlePool(760, SPRITE_TEX.smoke, THREE.NormalBlending);
  const rng = new Rng(5150);
  const timers = anchors.map(() => rng.f());
  const cols = anchors.map((a) => new THREE.Color(a.color ?? 0xdad7d0));
  return {
    points: pool.points,
    update(dt, t, ctx = {}) {
      const wind = 0.6 + Math.sin(t * 0.21) * 0.35;
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i];
        timers[i] -= dt;
        if (timers[i] > 0) continue;
        const rate = a.rate ?? 0.55;
        timers[i] = rate * rng.range(0.7, 1.3);
        if (a.obj) a.obj.getWorldPosition(_wp);
        else _wp.copy(a.pos);
        const sz = a.size ?? 1.1;
        pool.spawn(
          _wp.x + rng.range(-0.2, 0.2),
          _wp.y,
          _wp.z + rng.range(-0.2, 0.2),
          wind * rng.range(0.5, 1.1) + rng.range(-0.2, 0.2),
          (a.speed ?? 1.5) * rng.range(0.8, 1.25),
          rng.range(-0.25, 0.25) + wind * 0.25,
          sz * 6,
          a.life ?? rng.range(5, 8.5),
          cols[i],
          sz * 1.5,
          0
        );
      }
      pool.update(dt);
    },
  };
}

/** 喷泉水花 */
export function createSpray(anchors) {
  const pool = new ParticlePool(520, SPRITE_TEX.glow, THREE.AdditiveBlending);
  const rng = new Rng(6161);
  const col = new THREE.Color(0xbfe4f5);
  let acc = 0;
  return {
    points: pool.points,
    update(dt) {
      acc += dt;
      const step = 0.02;
      while (acc > step) {
        acc -= step;
        for (const a of anchors) {
          const p = a.pos;
          const n = 2;
          for (let k = 0; k < n; k++) {
            const ang = rng.range(0, Math.PI * 2);
            const sp = rng.range(0.7, 1.5);
            pool.spawn(
              p.x,
              p.y,
              p.z,
              Math.cos(ang) * sp * 0.55,
              rng.range(2.6, 3.9),
              Math.sin(ang) * sp * 0.55,
              1.6,
              rng.range(1.0, 1.6),
              col,
              -0.2,
              7.2
            );
          }
        }
      }
      pool.update(dt);
    },
  };
}

/** 路灯 / 窗口的暖光晕（夜间显现） */
export function createGlows(anchors) {
  const n = anchors.length;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const alpha = new Float32Array(n);
  const color = new Float32Array(n * 3);
  const c = new THREE.Color();
  anchors.forEach((a, i) => {
    pos[i * 3] = a.pos.x;
    pos[i * 3 + 1] = a.pos.y;
    pos[i * 3 + 2] = a.pos.z;
    size[i] = (a.size ?? 2.6) * 2.6;
    alpha[i] = 0;
    c.setHex(a.color ?? 0xffc46b);
    color[i * 3] = c.r;
    color[i * 3 + 1] = c.g;
    color[i * 3 + 2] = c.b;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: SPRITE_TEX.glow } },
    vertexShader: PART_VERT,
    fragmentShader: PART_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.name = 'lampGlow';
  return {
    points,
    update(dt, t, nightK = 0) {
      const attr = geo.attributes.aAlpha;
      for (let i = 0; i < n; i++) {
        attr.array[i] = nightK * (0.55 + 0.12 * Math.sin(t * 2.1 + i * 1.7));
      }
      attr.needsUpdate = true;
    },
  };
}

/** 盘旋的飞鸟 */
export function createBirds(count = 18) {
  const rng = new Rng(9091);
  const parts = [];
  const wing = G.makeBox(1.5, 0.06, 0.42, 1);
  parts.push(wing);
  const body = G.makeBox(0.34, 0.16, 0.8, 1);
  body.translate(0, 0.02, 0);
  parts.push(body);
  const geo = G.mergeMany(parts);
  const mesh = new THREE.InstancedMesh(geo, MAT.black, count);
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  mesh.name = 'birds';
  const flock = [];
  for (let i = 0; i < count; i++) {
    flock.push({
      cx: rng.range(-120, 140),
      cz: rng.range(-140, 120),
      r: rng.range(18, 56),
      y: rng.range(26, 58),
      sp: rng.range(0.14, 0.3) * (rng.bool() ? 1 : -1),
      ph: rng.range(0, Math.PI * 2),
      flap: rng.range(6, 11),
    });
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3(1, 1, 1);
  return {
    mesh,
    update(dt, t) {
      for (let i = 0; i < count; i++) {
        const b = flock[i];
        const a = b.ph + t * b.sp;
        const x = b.cx + Math.cos(a) * b.r;
        const z = b.cz + Math.sin(a) * b.r;
        const y = b.y + Math.sin(t * 0.6 + b.ph) * 2.4;
        e.set(Math.sin(t * b.flap + b.ph) * 0.55, -a + (b.sp > 0 ? Math.PI / 2 : -Math.PI / 2), 0);
        q.setFromEuler(e);
        v.set(x, y, z);
        m.compose(v, q, sc);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
