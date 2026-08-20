// Infinite rolling terrain.
//
// One draw call: a camera-relative grid whose vertex spacing grows with distance
// (dense under your feet, coarse at the horizon). The height field is evaluated in the
// vertex shader from the shared noise, so there is no heightmap to stream and the CPU
// can ask for the exact same height at any point.

import * as THREE from 'three';
import { WORLD } from './config.js';
import { GLSL_NOISE, GLSL_TERRAIN } from './noise.js';
import { U, UG, pick, GLSL_LIFE, GLSL_LIGHT, GLSL_SHADOW } from './uniforms.js';

const VERT = /* glsl */ `
  precision highp float;

  attribute float aEdge;

  uniform vec2 uOrigin;
  uniform vec3 uCamPos;

  ${GLSL_NOISE}
  ${GLSL_TERRAIN}
  ${GLSL_LIFE}

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDist;
  varying vec4 vLife;

  void main(){
    vec2 wxz = position.xz + uOrigin;
    vec3 hd = terrainHD(wxz);
    vec3 n = terrainNormalOf(hd);

    float y = hd.x;
    // skirt: drop the outer ring far below so no gap can show under the horizon
    y -= aEdge * 400.0;

    vWorld = vec3(wxz.x, y, wxz.y);
    vNormal = n;
    vDist = length(vWorld - uCamPos);
    vLife = lifeAt(wxz);

    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  ${GLSL_NOISE}
  ${GLSL_LIGHT}
  ${GLSL_SHADOW}

  uniform vec3 uCamPos;
  uniform vec3 uGrassDry;
  uniform vec3 uGrassLush;
  uniform vec3 uGrassDeep;
  uniform vec3 uGrassTip;
  uniform vec3 uEarth;
  uniform float uFlowerGlow;
  uniform float uTime;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDist;
  varying vec4 vLife;

  void main(){
    vec3 n = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorld);
    float near = 1.0 - smoothstep(18.0, 150.0, vDist);

    // ---- micro relief: fake blade clumping so the ground reads as grass, not a plane
    float m1 = vnoise(vWorld.xz * 1.7);
    float m2 = vnoise(vWorld.xz * 0.42 + 31.7);
    float m3 = vnoise(vWorld.xz * 0.11 + 7.3);
    vec2 dn = vec2(vnoise(vWorld.xz * 1.7 + vec2(0.35, 0.0)) - m1,
                   vnoise(vWorld.xz * 1.7 + vec2(0.0, 0.35)) - m1);
    n = normalize(n + vec3(dn.x, 0.0, dn.y) * 3.4 * near);

    float life = clamp(vLife.r * 1.25, 0.0, 1.0);
    float bloom = clamp(vLife.g * 1.3, 0.0, 1.0);

    // ---- stylised meadow palette: dry gold -> lush green, with patchy variation
    vec3 dry = mix(uGrassDry, uGrassDry * vec3(1.12, 1.04, 0.82), m2);
    vec3 lush = mix(uGrassLush, uGrassDeep, 0.30 + 0.55 * m2);
    vec3 col = mix(mix(dry, lush, 0.20), lush, life);
    col = mix(col, col * vec3(1.06, 1.1, 0.9), m3 * 0.7);
    col *= 0.86 + 0.30 * m1;

    // steep slopes show earth
    float slope = clamp(1.0 - n.y, 0.0, 1.0);
    col = mix(col, uEarth * (0.8 + 0.4 * m1), smoothstep(0.26, 0.62, slope));

    // ---- far-field flower speckles: keeps the bloom reading past the instanced flowers
    float spk = vnoise(vWorld.xz * 5.3 + 11.0);
    float spk2 = vnoise(vWorld.xz * 13.1 + 3.0);
    float dotMask = smoothstep(0.80, 0.97, spk * 0.6 + spk2 * 0.55) * bloom * (1.0 - near * 0.75);
    vec3 fcol = mix(vec3(1.0, 0.86, 0.93), vec3(1.0, 0.94, 0.62), fract(vLife.b * 3.7 + spk2));
    col = mix(col, fcol, dotMask * 0.85);

    // ---- lighting
    float shade = cloudShade(vWorld.xz);
    float ndl = wrapDiffuse(n, uSunDir, 0.42);
    vec3 sun = uSunColor * uSunIntensity * ndl * shade;
    vec3 amb = hemiAmbient(n) * (0.62 + 0.38 * shade);
    vec3 lit = col * (sun + amb) * (1.0 + 0.12 * shade);

    // grazing-light sheen along the meadow, plus a wet sheen when it rains
    float sheen = pow(clamp(dot(normalize(reflect(-uSunDir, n)), V), 0.0, 1.0), mix(14.0, 60.0, uWet));
    lit += uSunColor * sheen * shade * (0.05 + 0.55 * uWet) * uSunIntensity;

    // damp ground darkens and saturates
    lit *= mix(1.0, 0.85, uWet * (1.0 - dotMask));

    // blossoms glow faintly at dusk / night
    lit += fcol * dotMask * uFlowerGlow * 0.55;

    // contact darkening where grass meets ground
    lit *= mix(1.0, 0.82, near * (1.0 - m1) * 0.5);

    lit += uSunColor * uFlash * 0.6;

    gl_FragColor = vec4(lit, 1.0);
  }
`;

function warp(t) {
  const a = Math.abs(t);
  return Math.sign(t) * (0.10 * a + 0.90 * Math.pow(a, 2.6));
}

export class Terrain {
  constructor(grid = 352, radius = WORLD.terrainRadius) {
    this.grid = grid;
    this.radius = radius;
    this.geometry = this.build(grid, radius);
    this.material = new THREE.ShaderMaterial({
      uniforms: pick('terrain', 'life', 'light', 'shadow', 'palette', 'time', {
        uOrigin: { value: new THREE.Vector2() },
        uCamPos: U.uCamPos,
      }),
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = 0;
  }

  build(N, R) {
    const g = new THREE.BufferGeometry();
    const count = (N + 1) * (N + 1);
    const pos = new Float32Array(count * 3);
    const edge = new Float32Array(count);
    let p = 0;
    for (let j = 0; j <= N; j++) {
      const v = warp((j / N) * 2 - 1) * R;
      for (let i = 0; i <= N; i++) {
        const u = warp((i / N) * 2 - 1) * R;
        pos[p * 3 + 0] = u;
        pos[p * 3 + 1] = 0;
        pos[p * 3 + 2] = v;
        edge[p] = (i === 0 || j === 0 || i === N || j === N) ? 1 : 0;
        p++;
      }
    }
    const idx = (N * N * 6 > 65535 ? new Uint32Array(N * N * 6) : new Uint16Array(N * N * 6));
    let k = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i;
        const b = a + 1;
        const c = a + (N + 1);
        const d = c + 1;
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    return g;
  }

  update(camPos) {
    // snap the grid so distant tessellation does not crawl as you walk
    const step = 6.0;
    this.material.uniforms.uOrigin.value.set(
      Math.round(camPos.x / step) * step,
      Math.round(camPos.z / step) * step,
    );
  }

  setGrid(grid) {
    if (grid === this.grid) return;
    const old = this.geometry;
    this.geometry = this.build(grid, this.radius);
    this.mesh.geometry = this.geometry;
    this.grid = grid;
    old.dispose();
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
