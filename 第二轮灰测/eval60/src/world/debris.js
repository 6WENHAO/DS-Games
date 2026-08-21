/**
 * 碎屑与速度感：小行星带 + 近场星际尘埃（拉丝粒子）。
 * 尘埃条纹是“飞行速度感”的关键：会随速度拉长、跟随飞船循环复用。
 */
import * as THREE from 'three';
import { TAU, makeRng, clamp01 } from '../util/math.js';
import { rockGeometry } from '../util/geom.js';

export class AsteroidBelt {
  constructor({ inner = 31000, outer = 38500, count = 900, thickness = 900, seed = 4321 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'AsteroidBelt';
    const rng = makeRng(seed);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8a8177, roughness: 0.95, metalness: 0.05, flatShading: true,
    });
    this.meshes = [];
    const variants = 3;
    const per = Math.ceil(count / variants);
    this._spin = [];
    for (let v = 0; v < variants; v++) {
      const geo = rockGeometry(1, v === 0 ? 1 : 2, rng);
      const im = new THREE.InstancedMesh(geo, mat, per);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      const spins = [];
      for (let i = 0; i < per; i++) {
        const a = rng() * TAU;
        const r = inner + (outer - inner) * Math.pow(rng(), 0.75);
        const y = rng.gauss(0, thickness * 0.35);
        pos.set(Math.cos(a) * r, y, Math.sin(a) * r);
        const s = 12 + Math.pow(rng(), 3.2) * 190;
        scl.set(s * rng.range(0.7, 1.3), s * rng.range(0.7, 1.3), s * rng.range(0.7, 1.3));
        e.set(rng() * TAU, rng() * TAU, rng() * TAU);
        q.setFromEuler(e);
        m.compose(pos, q, scl);
        im.setMatrixAt(i, m);
        spins.push({
          pos: pos.clone(), scl: scl.clone(), q: q.clone(),
          ax: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
          sp: rng.range(-0.35, 0.35),
        });
      }
      im.frustumCulled = true;
      im.computeBoundingSphere();
      this.group.add(im);
      this.meshes.push(im);
      this._spin.push(spins);
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._t = 0;
  }

  update(dt, shipPos) {
    this._t += dt;
    // 整体缓慢公转
    this.group.rotation.y += dt * 0.0035;
    // 仅当飞船靠近小行星带时才逐块自转，节省 CPU
    const r = Math.hypot(shipPos.x, shipPos.z);
    if (r < 44000 && Math.abs(shipPos.y) < 6000) {
      for (let v = 0; v < this.meshes.length; v++) {
        const im = this.meshes[v];
        const spins = this._spin[v];
        for (let i = 0; i < spins.length; i++) {
          const s = spins[i];
          this._q.setFromAxisAngle(s.ax, s.sp * this._t);
          this._m.compose(s.pos, this._q.multiply(s.q), s.scl);
          im.setMatrixAt(i, this._m);
        }
        im.instanceMatrix.needsUpdate = true;
      }
    }
  }
}

/**
 * 近场尘埃：以飞船为中心的立方体内循环复用的短线段，
 * 线段方向/长度由速度决定 —— 静止时几乎不可见，高速时化作光带。
 */
export class SpaceDust {
  constructor({ count = 1400, box = 900 } = {}) {
    this.box = box;
    this.count = count;
    const rng = makeRng(99);
    const positions = new Float32Array(count * 2 * 3);
    const ends = new Float32Array(count * 2);
    const shades = new Float32Array(count * 2);
    this.base = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * box, y = (rng() - 0.5) * box, z = (rng() - 0.5) * box;
      this.base[i * 3] = x; this.base[i * 3 + 1] = y; this.base[i * 3 + 2] = z;
      for (let k = 0; k < 2; k++) {
        positions[(i * 2 + k) * 3] = x;
        positions[(i * 2 + k) * 3 + 1] = y;
        positions[(i * 2 + k) * 3 + 2] = z;
        ends[i * 2 + k] = k;
        shades[i * 2 + k] = 0.35 + rng() * 0.65;
      }
    }
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    geo.setAttribute('aShade', new THREE.BufferAttribute(shades, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), box * 1.8);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uStreak: { value: new THREE.Vector3() },
        uOpacity: { value: 0.5 },
        uColor: { value: new THREE.Color(0xbcd8ff) },
      },
      vertexShader: /* glsl */ `
        attribute float aEnd;
        attribute float aShade;
        uniform vec3 uStreak;
        varying float vFade;
        void main(){
          vec3 p = position + uStreak * aEnd;
          vFade = aShade * (1.0 - aEnd * 0.85);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        uniform float uOpacity;
        uniform vec3 uColor;
        varying float vFade;
        void main(){
          gl_FragColor = vec4(uColor * vFade * uOpacity * 2.0, vFade * uOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.object = new THREE.LineSegments(geo, this.material);
    this.object.frustumCulled = false;
    this.object.name = 'SpaceDust';
    this._tmp = new THREE.Vector3();
  }

  /** shipPos 为中心，velocity 决定拉丝 */
  update(dt, shipPos, velocity) {
    const b = this.box, h = b * 0.5;
    const arr = this.posAttr.array;
    const base = this.base;
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      let x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      let dx = x - shipPos.x, dy = y - shipPos.y, dz = z - shipPos.z;
      let moved = false;
      if (dx > h) { x -= b; moved = true; } else if (dx < -h) { x += b; moved = true; }
      if (dy > h) { y -= b; moved = true; } else if (dy < -h) { y += b; moved = true; }
      if (dz > h) { z -= b; moved = true; } else if (dz < -h) { z += b; moved = true; }
      if (moved) {
        base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z;
        dirty = true;
      }
      const o = i * 6;
      if (arr[o] !== x || arr[o + 1] !== y || arr[o + 2] !== z) {
        arr[o] = x; arr[o + 1] = y; arr[o + 2] = z;
        arr[o + 3] = x; arr[o + 4] = y; arr[o + 5] = z;
        dirty = true;
      }
    }
    if (dirty) this.posAttr.needsUpdate = true;

    const speed = velocity.length();
    const streakLen = Math.min(760, speed * 0.075);
    this._tmp.copy(velocity);
    if (speed > 1e-3) this._tmp.multiplyScalar(-streakLen / speed);
    this.material.uniforms.uStreak.value.copy(this._tmp);
    this.material.uniforms.uOpacity.value = 0.1 + clamp01(speed / 900) * 0.62;
  }
}
