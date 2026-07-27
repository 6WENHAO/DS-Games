import * as THREE from 'three';
import { WORLD_SIZE } from './world.js';
import { SHADING_GLSL, HEIGHTFIELD_GLSL, PALETTE } from './shading.js';
import { BloomWake } from './wake.js';

// ---------------------------------------------------------------------------
// Chunked terrain, geometry-clipmap style.
// ONE geometry per LOD level, shared by every chunk. The CPU only manages a
// ring of chunk meshes and their transforms — no geometry is ever rebuilt or
// re-uploaded while moving. Height comes from the shared heightfield texture.
// ---------------------------------------------------------------------------

export const CHUNK = 64;
const LODS = [64, 32, 16, 8];          // segments per chunk edge
const LOD_DIST = [110, 200, 320];      // promote/demote thresholds
const VIEW_RADIUS = 420;
const SKIRT_DROP = 7;

function makeChunkGeometry(seg, size) {
  const vpr = seg + 1;
  const pos = [];
  const skirt = [];
  const idx = [];
  const at = (i, j) => j * vpr + i;

  for (let j = 0; j < vpr; j++) {
    for (let i = 0; i < vpr; i++) {
      pos.push((i / seg) * size, 0, (j / seg) * size);
      skirt.push(0);
    }
  }
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      idx.push(at(i, j), at(i, j + 1), at(i + 1, j));
      idx.push(at(i + 1, j), at(i, j + 1), at(i + 1, j + 1));
    }
  }

  // skirts hide LOD-seam cracks; material is DoubleSide so winding is moot
  const edges = [
    Array.from({ length: vpr }, (_, i) => at(i, 0)),
    Array.from({ length: vpr }, (_, i) => at(i, seg)),
    Array.from({ length: vpr }, (_, j) => at(0, j)),
    Array.from({ length: vpr }, (_, j) => at(seg, j)),
  ];
  for (const edge of edges) {
    const base = pos.length / 3;
    for (const v of edge) {
      pos.push(pos[v * 3], 0, pos[v * 3 + 2]);
      skirt.push(1);
    }
    for (let k = 0; k < edge.length - 1; k++) {
      const a = edge[k], b = edge[k + 1], a2 = base + k, b2 = base + k + 1;
      idx.push(a, b, a2, b, b2, a2);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSkirt', new THREE.Float32BufferAttribute(skirt, 1));
  g.setIndex(idx);
  return g;
}

const VERT = /* glsl */`
  attribute float aSkirt;
  varying vec3 vWorld;
  varying vec3 vNormal;
  ${HEIGHTFIELD_GLSL}
  void main() {
    vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 fld = sampleField(wp.xz);
    wp.y = fld.x - aSkirt * ${SKIRT_DROP.toFixed(1)};
    vWorld = wp;
    vNormal = fld.yzw;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWorld;
  varying vec3 vNormal;
  uniform vec3 uMeadow, uShadowGrn, uBleached, uApricot, uSand;
  ${SHADING_GLSL}
  ${BloomWake.glsl()}

  float patchNoise(vec2 p) {
    return sin(p.x * 0.031) * 0.5 + sin(p.y * 0.024 + 1.7) * 0.3
         + sin((p.x + p.y) * 0.011) * 0.4;
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vWorld - cameraPosition);
    float dist = length(vWorld - cameraPosition);

    // painterly patches: large soft value shifts, no texture detail
    float v = patchNoise(vWorld.xz) * 0.5 + 0.5;
    vec3 albedo = mix(uShadowGrn, uMeadow, smoothstep(0.25, 0.85, v));
    albedo = mix(albedo, uBleached, smoothstep(0.80, 1.0, n.y) * 0.14);

    // exposed earth on steep faces
    float steep = 1.0 - smoothstep(0.55, 0.80, n.y);
    albedo = mix(albedo, uSand, steep * 0.8);

    // the wake: colour trail + call bloom
    vec2 wk = sampleWake(vWorld.xz);
    albedo = mix(albedo, uBleached, clamp(wk.x, 0.0, 1.0) * 0.5);
    albedo = mix(albedo, uApricot, clamp(wk.y, 0.0, 1.0) * 0.55);

    vec3 col = illustrated(n, albedo, 1.0);
    col += uApricot * clamp(wk.y, 0.0, 1.0) * 0.18;   // flowers self-glow a little
    col = applyFog(col, dist, viewDir);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Terrain {
  constructor(world, wake, skyUniforms) {
    this.world = world;
    this.geoms = LODS.map((s) => makeChunkGeometry(s, CHUNK));

    this.material = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, skyUniforms, wake.uniforms(), {
        uHeight: { value: world.texture },
        uWorldSize: { value: WORLD_SIZE },
        uMeadow: { value: new THREE.Color(PALETTE.meadow) },
        uShadowGrn: { value: new THREE.Color(PALETTE.shadowGrn) },
        uBleached: { value: new THREE.Color(PALETTE.bleached) },
        uApricot: { value: new THREE.Color(PALETTE.apricot) },
        uSand: { value: new THREE.Color(0xd9c9a3) },
      }),
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
    });

    this.group = new THREE.Group();
    this.chunks = new Map();
    this.pool = [];
    this.visibleCount = 0;
    this.triCount = 0;

    this._sphere = new THREE.Sphere();
  }

  _chunkSphere(cx, cz, out) {
    // sample a coarse min/max so frustum culling is tight without a per-chunk
    // geometry bound (geometry is shared and flat until the vertex shader)
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j <= 4; j++) {
      for (let i = 0; i <= 4; i++) {
        const h = this.world.heightAt(cx + (i / 4) * CHUNK, cz + (j / 4) * CHUNK);
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
    }
    lo -= SKIRT_DROP + 2; hi += 2;
    out.center.set(cx + CHUNK / 2, (lo + hi) / 2, cz + CHUNK / 2);
    out.radius = Math.hypot(CHUNK * 0.72, (hi - lo) / 2);
    return out;
  }

  update(playerPos, frustum) {
    const half = WORLD_SIZE / 2;
    const c0 = Math.floor((playerPos.x - VIEW_RADIUS) / CHUNK);
    const c1 = Math.floor((playerPos.x + VIEW_RADIUS) / CHUNK);
    const r0 = Math.floor((playerPos.z - VIEW_RADIUS) / CHUNK);
    const r1 = Math.floor((playerPos.z + VIEW_RADIUS) / CHUNK);

    const live = new Set();
    this.visibleCount = 0;
    this.triCount = 0;

    for (let cz = r0; cz <= r1; cz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const ox = cx * CHUNK, oz = cz * CHUNK;
        if (ox < -half || oz < -half || ox >= half || oz >= half) continue;
        const dx = ox + CHUNK / 2 - playerPos.x;
        const dz = oz + CHUNK / 2 - playerPos.z;
        const d = Math.hypot(dx, dz);
        if (d > VIEW_RADIUS) continue;

        const key = cx + ',' + cz;
        live.add(key);
        let chunk = this.chunks.get(key);
        if (!chunk) {
          const mesh = this.pool.pop() || new THREE.Mesh(this.geoms[0], this.material);
          mesh.frustumCulled = false;      // we cull manually, see _chunkSphere
          mesh.position.set(ox, 0, oz);
          mesh.matrixAutoUpdate = false;
          mesh.updateMatrix();
          mesh.updateMatrixWorld(true);
          this.group.add(mesh);
          chunk = { mesh, sphere: this._chunkSphere(ox, oz, new THREE.Sphere()), lod: -1 };
          this.chunks.set(key, chunk);
        }

        let lod = 3;
        for (let i = 0; i < LOD_DIST.length; i++) if (d < LOD_DIST[i]) { lod = i; break; }
        if (lod !== chunk.lod) { chunk.lod = lod; chunk.mesh.geometry = this.geoms[lod]; }

        const vis = frustum.intersectsSphere(chunk.sphere);
        chunk.mesh.visible = vis;
        if (vis) {
          this.visibleCount++;
          this.triCount += chunk.mesh.geometry.index.count / 3;
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
