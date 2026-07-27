import * as THREE from 'three';
import { PALETTE } from './shading.js';

// ---------------------------------------------------------------------------
// The response system.
// Everything that answers the Call registers into a 16 m spatial hash at load.
// A Call queries the 9 neighbouring cells only — the world is never iterated.
// Each object is a tiny state machine ticked only while non-dormant
// (typical active count < 40), so CPU cost stays flat as the world grows.
// ---------------------------------------------------------------------------

const CELL = 16;

export class SpatialHash {
  constructor() { this.cells = new Map(); }
  _key(x, z) { return Math.floor(x / CELL) + ',' + Math.floor(z / CELL); }
  insert(item) {
    const k = this._key(item.x, item.z);
    let a = this.cells.get(k);
    if (!a) { a = []; this.cells.set(k, a); }
    a.push(item);
  }
  query(x, z, radius, out) {
    out.length = 0;
    const r = Math.ceil(radius / CELL);
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const r2 = radius * radius;
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        const a = this.cells.get((cx + i) + ',' + (cz + j));
        if (!a) continue;
        for (const it of a) {
          const dx = it.x - x, dz = it.z - z;
          if (dx * dx + dz * dz <= r2) out.push(it);
        }
      }
    }
    return out;
  }
}

// wind chimes tuned to a pentatonic set, so any random collision is consonant
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

export class ChimeStones {
  constructor(world, skyUniforms, audio, count = 150) {
    this.world = world;
    this.audio = audio;
    this.hash = new SpatialHash();
    this.active = [];
    this._scratch = [];

    const geo = new THREE.CylinderGeometry(0.16, 0.30, 2.1, 7, 1);
    geo.translate(0, 1.05, 0);
    const inst = new THREE.InstancedBufferGeometry();
    inst.index = geo.index;
    inst.setAttribute('position', geo.getAttribute('position'));
    inst.setAttribute('normal', geo.getAttribute('normal'));

    const off = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    this.glow = new Float32Array(count);
    this.items = [];

    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 40) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.sqrt(Math.random()) * 420;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const n = world.normalAt(x, z);
      if (n.y < 0.86) continue;                    // only on gentle ground
      const y = world.heightAt(x, z);
      off[placed * 3] = x; off[placed * 3 + 1] = y; off[placed * 3 + 2] = z;
      rnd[placed] = Math.random();
      const item = {
        x, z, y, index: placed,
        note: PENTATONIC[placed % PENTATONIC.length],
        state: 'dormant', t: 0, lit: 0,
      };
      this.items.push(item);
      this.hash.insert(item);
      placed++;
    }
    this.count = placed;

    inst.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
    inst.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 1));
    this.glowAttr = new THREE.InstancedBufferAttribute(this.glow, 1);
    this.glowAttr.setUsage(THREE.DynamicDrawUsage);
    inst.setAttribute('aGlow', this.glowAttr);
    inst.instanceCount = placed;

    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, {
        uTime: skyUniforms.uTime,
        uSunDir: skyUniforms.uSunDir,
        uSunColor: skyUniforms.uSunColor,
        uSkyColor: skyUniforms.uSkyColor,
        uGroundCol: skyUniforms.uGroundCol,
        uFogColor: skyUniforms.uFogColor,
        uFogDensity: skyUniforms.uFogDensity,
        uStone: { value: new THREE.Color(0xcfc6b2) },
        uCyan: { value: new THREE.Color(PALETTE.runeCyan) },
      }),
      vertexShader: /* glsl */`
        attribute vec3 aOffset;
        attribute float aRand;
        attribute float aGlow;
        uniform float uTime;
        varying vec3 vNormalW;
        varying vec3 vWorld;
        varying float vGlow;
        varying float vY;
        void main() {
          float a = aRand * 6.283;
          mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
          vec3 p = position;
          p.xz = rot * p.xz;
          // it answers by leaning, very slightly
          float sway = sin(uTime * 1.6 + aRand * 6.28) * 0.05 * aGlow;
          p.x += sway * position.y;
          vec3 w = aOffset + p;
          vec3 nn = normal;
          nn.xz = rot * nn.xz;
          vNormalW = normalize(nn);
          vWorld = w; vGlow = aGlow; vY = position.y / 2.1;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3 uSunDir, uSunColor, uSkyColor, uGroundCol, uFogColor, uStone, uCyan;
        uniform float uFogDensity;
        varying vec3 vNormalW;
        varying vec3 vWorld;
        varying float vGlow;
        varying float vY;
        void main() {
          vec3 n = normalize(vNormalW);
          float ndl = dot(n, uSunDir) * 0.5 + 0.5;
          float band = 0.26 + smoothstep(0.30, 0.40, ndl) * 0.34 + smoothstep(0.58, 0.72, ndl) * 0.40;
          vec3 fill = mix(uGroundCol, uSkyColor, n.y * 0.5 + 0.5);
          vec3 col = uStone * (uSunColor * band + fill);
          // rune cyan is rationed: it only ever appears on something awake
          float ring = smoothstep(0.55, 0.95, vY) * vGlow;
          col = mix(col, uCyan * 1.6, ring * 0.85);
          float dist = length(vWorld - cameraPosition);
          float f = 1.0 - exp(-dist * uFogDensity);
          gl_FragColor = vec4(mix(col, uFogColor, clamp(f, 0.0, 1.0)), 1.0);
        }`,
    });

    this.mesh = new THREE.Mesh(inst, mat);
    this.mesh.frustumCulled = false;
  }

  // a Call sweeps outward: stones answer as the pulse reaches them, not at once
  onCall(pos, radius = 26) {
    const hits = this.hash.query(pos.x, pos.z, radius, this._scratch);
    for (const it of hits) {
      if (it.state !== 'dormant') continue;
      const d = Math.hypot(it.x - pos.x, it.z - pos.z);
      it.state = 'answering';
      it.t = -d / 34;                     // pulse travel time
      this.active.push(it);
    }
    return hits.length;
  }

  update(dt) {
    let write = 0;
    for (let i = 0; i < this.active.length; i++) {
      const it = this.active[i];
      it.t += dt;
      if (it.state === 'answering' && it.t >= 0) {
        it.state = 'active';
        it.t = 0;
        if (this.audio) this.audio.chime(it.note);
      }
      if (it.state === 'active') {
        it.lit = Math.min(1, it.lit + dt * 5);
        if (it.t > 2.6) it.state = 'settling';
      } else if (it.state === 'settling') {
        it.lit = Math.max(0, it.lit - dt * 0.55);
        if (it.lit <= 0.001) { it.state = 'dormant'; it.t = 0; }
      }
      this.glow[it.index] = it.lit;
      if (it.state !== 'dormant') this.active[write++] = it;
      else this.glow[it.index] = 0;
    }
    if (write !== this.active.length || this.active.length) this.glowAttr.needsUpdate = true;
    this.active.length = write;
  }
}

// ---------------------------------------------------------------------------
// The Call itself: an expanding luminous ring on the ground.
// ---------------------------------------------------------------------------
export class CallRing {
  constructor(skyUniforms, world) {
    this.world = world;
    const geo = new THREE.RingGeometry(0.55, 1.0, 96, 1);
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uAge: { value: 99 },
        uColor: { value: new THREE.Color(PALETTE.butter) },
        uOrigin: { value: new THREE.Vector3() },
        uHeight: { value: null },
        uWorldSize: { value: 1024 },
      },
      vertexShader: /* glsl */`
        uniform float uAge;
        uniform vec3 uOrigin;
        uniform sampler2D uHeight;
        uniform float uWorldSize;
        varying float vR;
        void main() {
          float R = uAge * 15.0;
          vec3 p = position * R;
          vR = length(position.xz);
          vec2 wxz = uOrigin.xz + p.xz;
          float h = texture2D(uHeight, wxz / uWorldSize + 0.5).r;
          gl_Position = projectionMatrix * viewMatrix * vec4(wxz.x, h + 0.35, wxz.y, 1.0);
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform float uAge;
        uniform vec3 uColor;
        varying float vR;
        void main() {
          float life = 1.0 - smoothstep(0.0, 0.95, uAge);
          float edge = smoothstep(0.55, 0.78, vR) * (1.0 - smoothstep(0.9, 1.0, vR));
          float a = edge * life * 0.75;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 700;
  }

  fire(pos) {
    this.material.uniforms.uOrigin.value.copy(pos);
    this.material.uniforms.uAge.value = 0;
    this.mesh.visible = true;
  }

  update(dt) {
    const u = this.material.uniforms.uAge;
    if (u.value > 1.0) { this.mesh.visible = false; return; }
    u.value += dt;
  }
}
