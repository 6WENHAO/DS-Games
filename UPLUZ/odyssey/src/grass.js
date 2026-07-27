import * as THREE from 'three';
import { WORLD_SIZE } from './world.js';
import { SHADING_GLSL, HEIGHTFIELD_GLSL, WIND_GLSL, PALETTE } from './shading.js';
import { BloomWake } from './wake.js';

// ---------------------------------------------------------------------------
// Grass — the load-bearing technical bet.
//
// Three LOD tiers. Each tier owns ONE instance-offset buffer in chunk-local
// space, shared by every chunk at that tier: no per-chunk generation, no
// per-chunk upload, ever. Chunks are placed by transform only, and rotated in
// 90-degree steps so the shared scatter pattern doesn't read as tiling.
//
// Everything else — terrain snap, wind, player push, distance dissolve, the
// bloom wake — happens in the vertex shader. Zero CPU work per blade.
// ---------------------------------------------------------------------------

export const GRASS_CHUNK = 32;

const TIERS = [
  { seg: 4, density: 15.0, cull: 46 },   // 7 tris
  { seg: 2, density: 6.0, cull: 102 },   // 3 tris
  { seg: 1, density: 2.2, cull: 168 },   // 1 tri
];

function makeBlade(seg) {
  const pos = [], t = [], idx = [];
  for (let r = 0; r < seg; r++) {
    const y = r / seg;
    const hw = 0.5 * (1 - Math.pow(y, 1.35));
    pos.push(-hw, y, 0, hw, y, 0);
    t.push(y, y);
  }
  pos.push(0, 1, 0); t.push(1);
  for (let r = 0; r < seg - 1; r++) {
    const a = r * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const last = (seg - 1) * 2, tip = seg * 2;
  idx.push(last, tip, last + 1);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  g.setIndex(idx);
  return g;
}

function makeInstances(requested) {
  // the grid MUST be square and complete: a partial last row leaves an unseeded
  // strip along one edge of every chunk, which reads as a bald corridor running
  // to the horizon once the chunks are rotated
  const dim = Math.max(2, Math.round(Math.sqrt(requested)));
  const count = dim * dim;
  const off = new Float32Array(count * 2);
  const rot = new Float32Array(count);
  const par = new Float32Array(count * 3);
  const cell = GRASS_CHUNK / dim;
  let k = 0;
  // stratified jitter: cheap blue-noise stand-in, no clumps, no grid reading
  for (let j = 0; j < dim; j++) {
    for (let i = 0; i < dim; i++) {
      off[k * 2] = -GRASS_CHUNK / 2 + (i + Math.random()) * cell;
      off[k * 2 + 1] = -GRASS_CHUNK / 2 + (j + Math.random()) * cell;
      rot[k] = Math.random() * Math.PI;
      par[k * 3] = 0.42 + Math.random() * 0.46;      // height
      par[k * 3 + 1] = 0.075 + Math.random() * 0.055; // width
      par[k * 3 + 2] = Math.random();                // rand / dissolve key
      k++;
    }
  }
  return { off, rot, par, count };
}

const VERT = /* glsl */`
  attribute float aT;
  attribute vec2 aOffset;
  attribute float aRot;
  attribute vec3 aParams;

  uniform vec3 uPlayer;
  uniform float uCull;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vT;
  varying float vRand;
  varying vec2 vWake;

  ${HEIGHTFIELD_GLSL}
  ${WIND_GLSL}
  ${BloomWake.glsl()}

  void main() {
    vec2 wp = (modelMatrix * vec4(aOffset.x, 0.0, aOffset.y, 1.0)).xz;
    vec4 fld = sampleField(wp);
    vec3 n = fld.yzw;

    float dist = distance(wp, uPlayer.xz);
    float fade = 1.0 - smoothstep(uCull * 0.72, uCull, dist);
    float slope = smoothstep(0.56, 0.78, n.y);
    float keep = step(aParams.z, fade);

    vec2 wk = sampleWake(wp);
    float height = aParams.x * (1.0 + wk.x * 0.30) * keep * slope;
    float width = aParams.y * (1.0 + wk.y * 0.4);

    float t = aT;
    float bend = windField(wp, uTime) * 0.20 + 0.26 + aParams.z * 0.14;
    vec2 wdir = normalize(uWind);

    // the player parts the grass — pure vertex work, no collision queries
    vec2 toP = wp - uPlayer.xz;
    float pd = length(toP);
    float push = (1.0 - smoothstep(0.0, 2.4, pd)) * 1.25;
    vec2 pdir = pd > 0.001 ? toP / pd : vec2(1.0, 0.0);

    vec2 lean = wdir * bend + pdir * push;
    vec2 side = vec2(cos(aRot), sin(aRot));
    vec2 off = lean * pow(t, 1.7);

    vec3 world;
    world.xz = wp + side * (position.x * width) + off * height;
    world.y = fld.x + t * height - 0.28 * length(off) * height * t;

    vT = t;
    vRand = aParams.z;
    vWake = wk;
    vWorld = world;
    vNormal = normalize(n + vec3(-lean.x, 0.55, -lean.y));
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vT;
  varying float vRand;
  varying vec2 vWake;
  uniform vec3 uMeadow, uShadowGrn, uBleached, uApricot, uTransTint;
  ${SHADING_GLSL}

  void main() {
    vec3 viewDir = normalize(vWorld - cameraPosition);
    float dist = length(vWorld - cameraPosition);

    vec3 albedo = mix(uShadowGrn, uBleached, smoothstep(0.10, 1.0, vT));
    albedo = mix(albedo, uMeadow, 0.30);
    albedo *= 0.84 + vRand * 0.30;
    // fake the occlusion of a dense sward at the roots — this is most of what
    // makes scattered blades read as a field rather than as individual objects
    albedo *= mix(0.62, 1.0, smoothstep(0.0, 0.55, vT));
    albedo = mix(albedo, uBleached, clamp(vWake.x, 0.0, 1.0) * 0.40);

    vec3 col = illustrated(vNormal, albedo, 1.0);
    col += translucency(viewDir, pow(vT, 1.6) * 1.1, uTransTint);

    // Call response: petals open at the tips
    float bloom = clamp(vWake.y, 0.0, 1.0) * smoothstep(0.45, 1.0, vT);
    col = mix(col, uApricot * 1.15, bloom * 0.85);
    col += uApricot * bloom * 0.35;

    col = applyFog(col, dist, viewDir);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Grass {
  constructor(world, wake, skyUniforms, quality = 1.0) {
    this.world = world;
    this.tiers = TIERS.map((cfg) => {
      const wanted = Math.max(64, Math.round(cfg.density * quality * GRASS_CHUNK * GRASS_CHUNK));
      const blade = makeBlade(cfg.seg);
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = blade.index;
      geo.setAttribute('position', blade.getAttribute('position'));
      geo.setAttribute('aT', blade.getAttribute('aT'));
      const inst = makeInstances(wanted);
      const count = inst.count;
      geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(inst.off, 2));
      geo.setAttribute('aRot', new THREE.InstancedBufferAttribute(inst.rot, 1));
      geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(inst.par, 3));
      geo.instanceCount = count;

      const mat = new THREE.ShaderMaterial({
        uniforms: Object.assign({}, skyUniforms, wake.uniforms(), {
          uHeight: { value: world.texture },
          uWorldSize: { value: WORLD_SIZE },
          uCull: { value: cfg.cull },
          uMeadow: { value: new THREE.Color(PALETTE.meadow) },
          uShadowGrn: { value: new THREE.Color(PALETTE.shadowGrn) },
          uBleached: { value: new THREE.Color(PALETTE.bleached) },
          uApricot: { value: new THREE.Color(PALETTE.apricot) },
          uTransTint: { value: new THREE.Color(0xd8e88a) },
        }),
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.DoubleSide,
      });

      return { cfg, geo, mat, count, tris: blade.index.count / 3 };
    });

    this.group = new THREE.Group();
    this.chunks = new Map();
    this.pool = [];
    this.bladeCount = 0;
    this.drawCount = 0;
  }

  _sphere(cx, cz, out) {
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j <= 3; j++) {
      for (let i = 0; i <= 3; i++) {
        const h = this.world.heightAt(cx + (i / 3 - 0.5) * GRASS_CHUNK, cz + (j / 3 - 0.5) * GRASS_CHUNK);
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
    }
    hi += 2;
    out.center.set(cx, (lo + hi) / 2, cz);
    out.radius = Math.hypot(GRASS_CHUNK * 0.72, (hi - lo) / 2 + 1);
    return out;
  }

  update(playerPos, frustum) {
    const R = TIERS[TIERS.length - 1].cull;
    const half = WORLD_SIZE / 2;
    const c0 = Math.floor((playerPos.x - R) / GRASS_CHUNK);
    const c1 = Math.floor((playerPos.x + R) / GRASS_CHUNK);
    const r0 = Math.floor((playerPos.z - R) / GRASS_CHUNK);
    const r1 = Math.floor((playerPos.z + R) / GRASS_CHUNK);

    const live = new Set();
    this.bladeCount = 0;
    this.drawCount = 0;
    this.triCount = 0;

    for (let cz = r0; cz <= r1; cz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const wx = cx * GRASS_CHUNK + GRASS_CHUNK / 2;
        const wz = cz * GRASS_CHUNK + GRASS_CHUNK / 2;
        if (wx < -half || wz < -half || wx >= half || wz >= half) continue;
        const d = Math.hypot(wx - playerPos.x, wz - playerPos.z);
        if (d > R) continue;

        let tier = -1;
        for (let i = 0; i < TIERS.length; i++) if (d < TIERS[i].cull) { tier = i; break; }
        if (tier < 0) continue;

        const key = cx + ',' + cz;
        live.add(key);
        let chunk = this.chunks.get(key);
        if (!chunk) {
          const mesh = this.pool.pop() || new THREE.Mesh();
          mesh.frustumCulled = false;
          mesh.position.set(wx, 0, wz);
          // 90-degree steps break up the shared scatter pattern
          mesh.rotation.y = (Math.abs((cx * 73856093) ^ (cz * 19349663)) % 4) * Math.PI * 0.5;
          mesh.matrixAutoUpdate = false;
          mesh.updateMatrix();
          mesh.updateMatrixWorld(true);
          this.group.add(mesh);
          chunk = { mesh, sphere: this._sphere(wx, wz, new THREE.Sphere()), tier: -1 };
          this.chunks.set(key, chunk);
        }

        if (tier !== chunk.tier) {
          chunk.tier = tier;
          chunk.mesh.geometry = this.tiers[tier].geo;
          chunk.mesh.material = this.tiers[tier].mat;
        }

        const vis = frustum.intersectsSphere(chunk.sphere);
        chunk.mesh.visible = vis;
        if (vis) {
          this.drawCount++;
          this.bladeCount += this.tiers[tier].count;
          this.triCount += this.tiers[tier].count * this.tiers[tier].tris;
        }
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (live.has(key)) continue;
      this.group.remove(chunk.mesh);
      this.pool.push(chunk.mesh);
      this.chunks.delete(key);
    }
  }
}
