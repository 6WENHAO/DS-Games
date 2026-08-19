// Streaming LOD terrain with a 4-way splat-mapped physical material.
import * as THREE from 'three';
import { height, normalAt, WORLD } from './heightfield.js';
import { makeTerrainTextures } from '../core/textures.js';
import { GLSL_NOISE } from '../core/noise.js';

const CHUNK = 64;
const RINGS = [[1, 32], [3, 16], [7, 8]];   // [maxRingDistance, segments]
const VIEW_CHUNKS = 7;
const SKIRT = 2.2;

function lodFor(ring) { for (const [d, s] of RINGS) if (ring <= d) return s; return 4; }

/** Grid + downward skirt so LOD seams never show sky. */
function buildChunkGeometry(ox, oz, size, segs) {
  const n = segs + 1, step = size / segs;
  const gridCount = n * n, skirtCount = 4 * n;
  const pos = new Float32Array((gridCount + skirtCount) * 3);
  const nrm = new Float32Array((gridCount + skirtCount) * 3);
  const uv = new Float32Array((gridCount + skirtCount) * 2);
  let minY = Infinity, maxY = -Infinity;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ox + i * step, z = oz + j * step, y = height(x, z);
    const k = (j * n + i), p = k * 3;
    pos[p] = x - ox; pos[p + 1] = y; pos[p + 2] = z - oz;
    const nv = normalAt(x, z, Math.max(0.75, step * 0.5));
    nrm[p] = nv.x; nrm[p + 1] = nv.y; nrm[p + 2] = nv.z;
    uv[k * 2] = i / segs; uv[k * 2 + 1] = j / segs;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const idx = [];
  for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  // skirts: edge j=0, j=segs, i=0, i=segs
  let sBase = gridCount;
  const addSkirt = (getK, flip) => {
    const start = sBase;
    for (let i = 0; i < n; i++) {
      const k = getK(i), src = k * 3, dst = (sBase + i) * 3;
      pos[dst] = pos[src]; pos[dst + 1] = pos[src + 1] - SKIRT; pos[dst + 2] = pos[src + 2];
      nrm[dst] = nrm[src]; nrm[dst + 1] = nrm[src + 1]; nrm[dst + 2] = nrm[src + 2];
      uv[(sBase + i) * 2] = uv[k * 2]; uv[(sBase + i) * 2 + 1] = uv[k * 2 + 1];
    }
    for (let i = 0; i < segs; i++) {
      const a = getK(i), b = getK(i + 1), c = start + i, d = start + i + 1;
      if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    sBase += n;
  };
  addSkirt(i => i, true);                       // j = 0
  addSkirt(i => segs * n + i, false);            // j = segs
  addSkirt(j => j * n, false);                   // i = 0
  addSkirt(j => j * n + segs, true);             // i = segs

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(size / 2, (minY + maxY) / 2, size / 2), Math.hypot(size, maxY - minY + SKIRT) * 0.72);
  return g;
}

export function createTerrainMaterial(tex, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.92, metalness: 0.0, dithering: true,
    map: tex.grass.map, normalMap: tex.grass.normalMap,
  });
  mat.userData.uniforms = {
    uMapGrass: { value: tex.grass.map }, uNrmGrass: { value: tex.grass.normalMap },
    uMapRock: { value: tex.rock.map }, uNrmRock: { value: tex.rock.normalMap },
    uMapSand: { value: tex.sand.map }, uNrmSand: { value: tex.sand.normalMap },
    uMapSnow: { value: tex.snow.map }, uNrmSnow: { value: tex.snow.normalMap },
    uSnowLine: { value: 128.0 }, uWaterLevel: { value: WORLD.waterLevel },
    uDetail: { value: opts.detail ?? 1.0 }, uTime: { value: 0 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vec4 _wp = modelMatrix * vec4(transformed, 1.0);
        vWPos = _wp.xyz; vWNrm = normalize(mat3(modelMatrix) * objectNormal);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm;
        uniform sampler2D uMapGrass, uNrmGrass, uMapRock, uNrmRock, uMapSand, uNrmSand, uMapSnow, uNrmSnow;
        uniform float uSnowLine, uWaterLevel, uDetail, uTime;
        vec4 gW; float gRough; float gWet; float gDirtMix;
        ${GLSL_NOISE}
        void splatWeights(vec3 wp, vec3 nw) {
          float up = clamp(nw.y, 0.0, 1.0);
          float macro = gfbm(wp.xz * 0.0034, 3);
          float snowLine = uSnowLine + macro * 30.0;
          float wSnow = smoothstep(snowLine - 14.0, snowLine + 12.0, wp.y) * smoothstep(0.30, 0.70, up);
          float wRock = smoothstep(0.86, 0.55, up);
          wRock = max(wRock, smoothstep(0.55, 0.92, gfbm(wp.xz * 0.021 + 7.0, 2) + 0.5) * 0.35 * smoothstep(0.95, 0.72, up));
          float wSand = smoothstep(3.6, 0.5, wp.y - uWaterLevel) * smoothstep(0.35, 0.80, up);
          float wDirt = smoothstep(-0.20, -0.46, macro) * 0.9 * (1.0 - wRock) * (1.0 - wSnow);
          float wGrass = max(0.0, 1.0 - wRock - wSnow - wSand - wDirt) + 0.001;
          float sandy = wSand + wDirt;
          gW = vec4(wGrass, wRock, sandy, wSnow);
          float s = gW.x + gW.y + gW.z + gW.w; gW /= max(s, 1e-4);
          gRough = gW.x * 0.88 + gW.y * 0.95 + gW.z * 0.90 + gW.w * 0.42;
          gWet = smoothstep(1.1, -0.6, wp.y - uWaterLevel);
          gRough = mix(gRough, 0.24, gWet * 0.8);
          gDirtMix = clamp(wDirt / max(sandy, 1e-4), 0.0, 1.0);
        }`)
      .replace('#include <map_fragment>', `
        splatWeights(vWPos, vWNrm);
        float _cd = length(vWPos - cameraPosition);
        float _df = smoothstep(280.0, 90.0, _cd) * uDetail;
        vec2 uvD = vWPos.xz * 0.145;
        vec2 uvM = vWPos.xz * 0.0198;
        vec3 cG = texture2D(uMapGrass, uvD).rgb, mG = texture2D(uMapGrass, uvM).rgb;
        vec3 cR = texture2D(uMapRock,  uvD * 0.62).rgb, mR = texture2D(uMapRock,  uvM).rgb;
        vec3 cS = texture2D(uMapSand,  uvD).rgb, mS = texture2D(uMapSand,  uvM).rgb;
        vec3 cW = texture2D(uMapSnow,  uvD * 0.8).rgb, mW = texture2D(uMapSnow,  uvM).rgb;
        cG = mix(mG, cG, _df) * (0.72 + 0.56 * mG.g);
        cR = mix(mR, cR, _df) * (0.74 + 0.52 * mR.g);
        cS = mix(mS, cS, _df) * (0.76 + 0.48 * mS.g);
        cW = mix(mW, cW, _df) * (0.86 + 0.28 * mW.g);
        vec3 dirtTint = vec3(1.14, 0.80, 0.55);
        vec3 sandTint = vec3(1.0);
        cS *= mix(sandTint, dirtTint, gDirtMix);
        float moist = gfbm(vWPos.xz * 0.0013 - 21.0, 3) * 0.5 + 0.5;
        vec3 grassCool = vec3(0.80, 1.04, 0.80), grassWarm = vec3(1.06, 1.00, 0.74);
        cG *= mix(grassWarm, grassCool, clamp(moist * 1.4 + 0.18, 0.0, 1.0));
        vec3 albedo = cG * gW.x + cR * gW.y + cS * gW.z + cW * gW.w;
        albedo *= 0.82 + 0.20 * (gfbm(vWPos.xz * 0.0009 + 5.0, 2) + 0.5);
        albedo = mix(albedo, albedo * vec3(0.52, 0.55, 0.50), gWet * 0.75);
        diffuseColor.rgb *= albedo;`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness * gRough;`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        {
          vec2 uvD = vWPos.xz * 0.145;
          vec3 nG = texture2D(uNrmGrass, uvD).xyz * 2.0 - 1.0;
          vec3 nR = texture2D(uNrmRock,  uvD * 0.62).xyz * 2.0 - 1.0;
          vec3 nS = texture2D(uNrmSand,  uvD).xyz * 2.0 - 1.0;
          vec3 nW = texture2D(uNrmSnow,  uvD * 0.8).xyz * 2.0 - 1.0;
          vec3 nT = normalize(nG * gW.x + nR * gW.y + nS * gW.z + nW * gW.w);
          float fade = smoothstep(320.0, 80.0, length(vWPos - cameraPosition)) * uDetail;
          nT.xy *= 0.42 * fade * (1.0 - gWet * 0.6);
          vec3 Nw = normalize(vWNrm);
          vec3 Tw = normalize(cross(Nw, vec3(0.0, 0.0, 1.0)) + vec3(1e-5, 0.0, 0.0));
          vec3 Bw = cross(Tw, Nw);
          vec3 pert = normalize(Tw * nT.x + Bw * nT.y + Nw * max(nT.z, 0.15));
          normal = normalize((viewMatrix * vec4(pert, 0.0)).xyz);
        }`);
  };
  mat.customProgramCacheKey = () => 'terrain-splat-v4';
  return mat;
}

export class Terrain {
  constructor(ctx) {
    this.ctx = ctx;
    this.textures = makeTerrainTextures(ctx.quality.texSize ?? 256);
    this.material = createTerrainMaterial(this.textures, { detail: ctx.quality.terrainDetail ?? 1 });
    this.group = new THREE.Group(); this.group.name = 'terrain';
    ctx.scene.add(this.group);
    this.chunks = new Map();
    this.geoCache = new Map();
    this._pc = { x: 9999, z: 9999 };

    // Static low-res mesh for the whole world: distant mountains in one draw call.
    const farSegs = ctx.quality.farSegs ?? 180;
    const farGeo = buildChunkGeometry(-WORLD.half, -WORLD.half, WORLD.size, farSegs);
    this.far = new THREE.Mesh(farGeo, this.material);
    this.far.position.set(-WORLD.half, -1.2, -WORLD.half);
    this.far.receiveShadow = false; this.far.castShadow = false;
    this.far.frustumCulled = false;
    this.far.name = 'terrain-far';
    this.group.add(this.far);
  }

  heightAt(x, z) { return height(x, z); }

  update(dt, playerPos) {
    const cx = Math.floor(playerPos.x / CHUNK), cz = Math.floor(playerPos.z / CHUNK);
    if (cx === this._pc.x && cz === this._pc.z) return;
    this._pc.x = cx; this._pc.z = cz;
    const need = new Set();
    for (let j = -VIEW_CHUNKS; j <= VIEW_CHUNKS; j++) for (let i = -VIEW_CHUNKS; i <= VIEW_CHUNKS; i++) {
      const ring = Math.max(Math.abs(i), Math.abs(j));
      if (ring > VIEW_CHUNKS) continue;
      const gx = cx + i, gz = cz + j, key = gx + ',' + gz;
      need.add(key);
      const segs = lodFor(ring);
      const cur = this.chunks.get(key);
      if (cur && cur.segs === segs) continue;
      // strongly negative priority: terrain must never be starved by content generation
      this.ctx.tasks.push(() => this._build(gx, gz, segs, key), ring - 1000);
    }
    for (const [key, c] of this.chunks) if (!need.has(key)) { this.group.remove(c.mesh); this.chunks.delete(key); }
  }

  _build(gx, gz, segs, key) {
    const cacheKey = key + ':' + segs;
    let geo = this.geoCache.get(cacheKey);
    if (!geo) {
      geo = buildChunkGeometry(gx * CHUNK, gz * CHUNK, CHUNK, segs);
      if (this.geoCache.size > 900) { const k0 = this.geoCache.keys().next().value; this.geoCache.get(k0).dispose(); this.geoCache.delete(k0); }
      this.geoCache.set(cacheKey, geo);
    }
    const old = this.chunks.get(key);
    if (old) this.group.remove(old.mesh);
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.position.set(gx * CHUNK, 0, gz * CHUNK);
    mesh.receiveShadow = true;
    mesh.castShadow = segs >= 16;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    this.group.add(mesh);
    this.chunks.set(key, { mesh, segs });
  }

  /** Force-generate the chunks immediately around a point (used during loading). */
  preload(x, z, rings = 3) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let j = -rings; j <= rings; j++) for (let i = -rings; i <= rings; i++) {
      const ring = Math.max(Math.abs(i), Math.abs(j));
      this._build(cx + i, cz + j, lodFor(ring), (cx + i) + ',' + (cz + j));
    }
  }
}
