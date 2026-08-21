// Weather particles: rain streaks and floating motes (pollen by day, fireflies at night).
// Both wrap around the camera so a handful of instances covers an endless field.

import * as THREE from 'three';
import { GLSL_NOISE, GLSL_TERRAIN } from './noise.js';
import { U, pick, GLSL_SHADOW } from './uniforms.js';

/* --------------------------------------------------------------------- rain */

const RAIN_VERT = /* glsl */ `
  precision highp float;
  attribute vec4 aSeed;   // xy: cell position (-1..1), z: speed, w: phase

  uniform vec3 uCamPos;
  uniform float uTime;
  uniform vec2 uWindDir;
  uniform float uWindStrength;
  uniform float uRain;

  varying float vAlpha;
  varying vec2 vLocal;

  void main(){
    float R = 34.0;
    float H = 52.0;
    float speed = 22.0 + aSeed.z * 26.0;
    vec3 slant = normalize(vec3(uWindDir.x * (2.2 + uWindStrength * 5.0), -6.0, uWindDir.y * (2.2 + uWindStrength * 5.0)));

    // camera-relative cell, drifting down along the slant
    float fall = mod(uTime * speed + aSeed.w * 137.0, H);
    vec3 c = vec3(aSeed.x * R, H * 0.55 - fall, aSeed.y * R);
    c += slant * fall * 0.35;
    vec3 world = uCamPos + c;

    vec3 toCam = uCamPos - world;
    toCam = normalize(toCam + vec3(0.0, 1e-4, 0.0));
    vec3 side = cross(slant, toCam);
    side = normalize(side + vec3(1e-5, 0.0, 0.0));
    float len = 1.3 + aSeed.z * 3.0;
    float wid = 0.022 + aSeed.w * 0.038;

    vec3 p = world + slant * (position.y * len) + side * (position.x * wid);

    float d = length(c);
    vAlpha = uRain * smoothstep(34.0, 5.0, d) * (0.45 + 0.75 * aSeed.z);
    vLocal = position.xy;

    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const RAIN_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uMistColor;
  uniform vec3 uSunColor;
  uniform float uFlash;
  varying float vAlpha;
  varying vec2 vLocal;
  void main(){
    float a = vAlpha * (1.0 - abs(vLocal.x) * 1.6) * (1.0 - abs(vLocal.y) * 0.35);
    if (a <= 0.002) discard;
    vec3 col = mix(uMistColor, uSunColor, 0.25) * (1.25 + 2.2 * uFlash);
    gl_FragColor = vec4(col * a, a);
  }
`;

export class Rain {
  constructor(count = 5200) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0,
    ], 3));
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      seed[i * 4 + 0] = Math.random() * 2 - 1;
      seed[i * 4 + 1] = Math.random() * 2 - 1;
      seed[i * 4 + 2] = Math.random();
      seed[i * 4 + 3] = Math.random();
    }
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    g.instanceCount = count;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

    const m = new THREE.ShaderMaterial({
      uniforms: pick('time', {
        uCamPos: U.uCamPos,
        uWindDir: U.uWindDir,
        uWindStrength: U.uWindStrength,
        uRain: U.uRain,
        uMistColor: U.uMistColor,
        uSunColor: U.uSunColor,
        uFlash: U.uFlash,
      }),
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.geometry = g;
    this.material = m;
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = 10;
  }

  update() {
    this.mesh.visible = U.uRain.value > 0.02;
  }

  dispose() { this.geometry.dispose(); this.material.dispose(); }
}

/* -------------------------------------------------------------------- motes */

const MOTE_VERT = /* glsl */ `
  precision highp float;
  attribute vec4 aSeed;   // xy: tile position, z: height, w: phase

  uniform vec3 uCamPos;
  uniform vec2 uCamXZ;
  uniform float uTime;
  uniform vec2 uWindDir;
  uniform float uWindStrength;
  uniform float uExtent;
  uniform float uPixelRatio;
  uniform float uFlowerGlow;

  ${GLSL_NOISE}
  ${GLSL_TERRAIN}

  varying float vGlow;
  varying float vHue;

  void main(){
    float L = uExtent;
    // drift downwind, then wrap to the tile nearest the camera
    vec2 drift = uWindDir * (uTime * (0.6 + 1.9 * uWindStrength));
    vec2 tile = mod(aSeed.xy + drift, L);
    vec2 wxz = tile + floor((uCamXZ - tile) / L + 0.5) * L;

    float ground = terrainH(wxz);
    float bob = sin(uTime * (0.7 + aSeed.w * 1.6) + aSeed.w * 31.0) * 0.55;
    float swirl = sin(uTime * 0.43 + aSeed.z * 12.0) * 0.7;
    float h = mix(0.35, 7.5, aSeed.z * aSeed.z) + bob + uFlowerGlow * 0.6;

    vec3 world = vec3(wxz.x + swirl, ground + h, wxz.y - swirl * 0.6);

    vec4 mv = viewMatrix * vec4(world, 1.0);
    float dist = -mv.z;
    gl_Position = projectionMatrix * mv;

    float fade = smoothstep(L * 0.5, L * 0.22, length(wxz - uCamXZ)) * smoothstep(0.4, 3.0, dist);
    float twinkle = 0.45 + 0.55 * sin(uTime * (1.8 + aSeed.w * 3.0) + aSeed.z * 40.0);
    vGlow = fade * twinkle;
    vHue = aSeed.w;

    gl_PointSize = clamp((30.0 + aSeed.w * 34.0) * uPixelRatio / max(dist, 0.5), 1.5, 34.0);
  }
`;

const MOTE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform float uFlowerGlow;
  uniform float uMoteAmount;
  varying float vGlow;
  varying float vHue;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float a = smoothstep(0.5, 0.02, r);
    a *= vGlow * uMoteAmount;
    if (a <= 0.004) discard;
    vec3 pollen = mix(vec3(1.0, 0.93, 0.72), vec3(1.0, 0.82, 0.55), vHue) * uSunColor * (0.7 + uSunIntensity * 0.5);
    vec3 firefly = mix(vec3(0.75, 1.0, 0.55), vec3(1.0, 0.92, 0.5), vHue) * 3.6;
    vec3 col = mix(pollen, firefly, uFlowerGlow);
    gl_FragColor = vec4(col * a, a);
  }
`;

export class Motes {
  constructor(count = 2600, extent = 120) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      seed[i * 4 + 0] = Math.random() * extent;
      seed[i * 4 + 1] = Math.random() * extent;
      seed[i * 4 + 2] = Math.random();
      seed[i * 4 + 3] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

    const m = new THREE.ShaderMaterial({
      uniforms: pick('terrain', 'time', {
        uCamPos: U.uCamPos,
        uCamXZ: U.uCamXZ,
        uWindDir: U.uWindDir,
        uWindStrength: U.uWindStrength,
        uSunColor: U.uSunColor,
        uSunIntensity: U.uSunIntensity,
        uFlowerGlow: U.uFlowerGlow,
        uExtent: { value: extent },
        uPixelRatio: { value: 1 },
        uMoteAmount: { value: 1 },
      }),
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.geometry = g;
    this.material = m;
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.matrixAutoUpdate = false;
    this.points.renderOrder = 11;
  }

  update(pixelRatio, amount) {
    this.material.uniforms.uPixelRatio.value = pixelRatio;
    this.material.uniforms.uMoteAmount.value = amount;
    this.points.visible = amount > 0.02;
  }

  dispose() { this.geometry.dispose(); this.material.dispose(); }
}
