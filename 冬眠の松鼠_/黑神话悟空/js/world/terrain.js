import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { fbm, clamp, distToPolyline, lerp } from '../core/utils.js';
import { assets } from '../core/assets.js';

export class Terrain {
  constructor() {
    const { size, segments, maxHeight } = CONFIG.world;
    this.size = size;
    this.segments = segments;
    this.maxHeight = maxHeight;
    this.heights = new Float32Array((segments + 1) * (segments + 1));
    this.mesh = null;
    this.splat = null;
  }

  heightAtRaw(x, z) {
    const { arena, shrine } = CONFIG;
    // base rolling hills
    let h = fbm(x * 0.018 + 31.7, z * 0.018 + 11.3, 4) * this.maxHeight;
    h += fbm(x * 0.09 + 5.2, z * 0.09 + 8.8, 3) * 1.1;
    h -= this.maxHeight * 0.52;

    // rim mountains toward the boundary
    const r = Math.hypot(x, z);
    const rim = clamp((r - CONFIG.world.boundaryRadius + 16) / 22, 0, 1);
    h += rim * rim * 26;

    // flatten arena
    const dArena = Math.hypot(x - arena.x, z - arena.z);
    const arenaK = clamp(1 - dArena / (CONFIG.arena.radius + 9), 0, 1);
    h = lerp(h, -0.35, Math.pow(arenaK, 1.4));

    // flatten shrine plaza
    const dShrine = Math.hypot(x - shrine.x, z - shrine.z);
    const shrineK = clamp(1 - dShrine / 13, 0, 1);
    h = lerp(h, 0.15, Math.pow(shrineK, 1.5));

    // flatten along the pilgrim road
    const dPath = distToPolyline(x, z, CONFIG.path.points);
    const pathK = clamp(1 - dPath / (CONFIG.path.width + 4.5), 0, 1);
    const roadH = fbm(x * 0.012 + 3.1, z * 0.012 + 9.4, 2) * 2.2 - 0.6;
    h = lerp(h, roadH, Math.pow(pathK, 1.6) * 0.85);

    return h;
  }

  build() {
    const { size, segments } = this;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.heightAtRaw(x, z);
      pos.setY(i, h);
      this.heights[i] = h;
    }
    geo.computeVertexNormals();

    this.buildSplatTexture();

    const groundColor = assets.tex('groundColor');
    const gravelColor = assets.tex('gravelColor');
    const rockColor = assets.tex('rockColor');
    const mossColor = assets.tex('mossColor');
    const groundNormal = assets.tex('groundNormal');
    const rockNormal = assets.tex('rockNormal');

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0.0,
      map: groundColor,
      normalMap: groundNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
    });

    const repeat = 46;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGravel = { value: gravelColor };
      shader.uniforms.uRock = { value: rockColor };
      shader.uniforms.uMoss = { value: mossColor };
      shader.uniforms.uRockN = { value: rockNormal };
      shader.uniforms.uSplat = { value: this.splat };
      shader.uniforms.uRepeat = { value: repeat };
      shader.uniforms.uWorldSize = { value: this.size };

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTerrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D uGravel;
uniform sampler2D uRock;
uniform sampler2D uMoss;
uniform sampler2D uSplat;
uniform float uRepeat;
uniform float uWorldSize;
varying vec3 vTerrainPos;`)
        .replace('#include <map_fragment>', `{
  vec2 wuv = vTerrainPos.xz / uWorldSize + 0.5;
  vec4 splat = texture2D(uSplat, wuv);
  vec2 tuv = wuv * uRepeat;
  vec2 tuv2 = wuv * uRepeat * 0.31; // large-scale variation to hide tiling
  vec4 gCol = texture2D(map, tuv);
  vec4 gCol2 = texture2D(map, tuv2);
  gCol.rgb = mix(gCol.rgb, gCol2.rgb, 0.42);
  vec3 gravel = texture2D(uGravel, tuv).rgb;
  vec3 rock = texture2D(uRock, tuv * 0.8).rgb;
  vec3 rock2 = texture2D(uRock, tuv * 0.23).rgb;
  rock = mix(rock, rock2, 0.5);
  vec3 moss = texture2D(uMoss, tuv).rgb;
  vec3 col = gCol.rgb;
  col = mix(col, moss, splat.g);
  col = mix(col, gravel, splat.b);
  col = mix(col, rock, splat.r);
  col *= 0.82 + 0.18 * splat.a; // baked AO-ish variation
  diffuseColor = vec4(col, 1.0);
}`);
    };

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = 'terrain';
    this.mesh = mesh;
    return mesh;
  }

  buildSplatTexture() {
    const N = 256;
    const data = new Uint8Array(N * N * 4);
    const half = this.size / 2;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * this.size - half;
        const z = (j / (N - 1)) * this.size - half;
        const idx = (j * N + i) * 4;

        const hL = this.heightAtRaw(x - 1.2, z);
        const hR = this.heightAtRaw(x + 1.2, z);
        const hD = this.heightAtRaw(x, z - 1.2);
        const hU = this.heightAtRaw(x, z + 1.2);
        const slope = Math.hypot(hR - hL, hU - hD) / 2.4;

        const dPath = distToPolyline(x, z, CONFIG.path.points);
        const pathK = clamp(1 - dPath / CONFIG.path.width, 0, 1);
        const dArena = Math.hypot(x - CONFIG.arena.x, z - CONFIG.arena.z);
        const arenaK = clamp(1 - dArena / CONFIG.arena.radius, 0, 1);

        let rockW = clamp((slope - 0.55) * 1.9, 0, 1);
        let gravelW = clamp(Math.max(Math.pow(pathK, 1.2), arenaK > 0 ? Math.pow(arenaK, 0.7) * 0.9 : 0) - rockW * 0.4, 0, 1);
        const mossN = fbm(x * 0.05 + 77.7, z * 0.05 + 13.2, 3);
        let mossW = clamp((mossN - 0.52) * 2.4, 0, 1) * (1 - gravelW) * (1 - rockW);
        const ao = fbm(x * 0.11 + 3.3, z * 0.11 + 51.9, 3);

        data[idx] = Math.round(rockW * 255);
        data[idx + 1] = Math.round(mossW * 255);
        data[idx + 2] = Math.round(gravelW * 255);
        data[idx + 3] = Math.round(clamp(ao, 0, 1) * 255);
      }
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    this.splat = tex;
  }

  // bilinear sampled height for gameplay
  getHeight(x, z) {
    const { size, segments } = this;
    const half = size / 2;
    const fx = ((x + half) / size) * segments;
    const fz = ((z + half) / size) * segments;
    const ix = clamp(Math.floor(fx), 0, segments - 1);
    const iz = clamp(Math.floor(fz), 0, segments - 1);
    const tx = clamp(fx - ix, 0, 1);
    const tz = clamp(fz - iz, 0, 1);
    const w = segments + 1;
    const h00 = this.heights[iz * w + ix];
    const h10 = this.heights[iz * w + ix + 1];
    const h01 = this.heights[(iz + 1) * w + ix];
    const h11 = this.heights[(iz + 1) * w + ix + 1];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }
}
