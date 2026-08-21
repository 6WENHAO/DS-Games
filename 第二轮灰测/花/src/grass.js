// Stylised grass meadow.
//
// Three instanced layers (near / mid / far) whose blades are *wrapped* around the camera
// in the vertex shader: each instance picks the copy of its tile nearest to the viewer,
// so the field is endless with zero CPU work. Height comes from the shared terrain
// function, lushness from the life field, motion from a travelling wind wave with slow
// gust bands — that is the "wind over wheat" ripple.

import * as THREE from 'three';
import { GRASS_LAYERS, GRASS_BUDGET } from './config.js';
import { GLSL_NOISE, GLSL_TERRAIN } from './noise.js';
import { U, pick, GLSL_LIFE, GLSL_LIGHT, GLSL_SHADOW, GLSL_WIND } from './uniforms.js';

const VERT = /* glsl */ `
  precision highp float;

  attribute vec2 aPos;
  attribute vec4 aRand;
  attribute float aSide;
  attribute float aT;

  uniform float uExtent;
  uniform vec2 uCamXZ;
  uniform vec3 uCamPos;
  uniform vec3 uCamFwd;
  uniform float uH0;
  uniform float uH1;
  uniform float uW;

  ${GLSL_NOISE}
  ${GLSL_TERRAIN}
  ${GLSL_LIFE}
  ${GLSL_WIND}

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vT;
  varying float vLife;
  varying float vWave;
  varying float vHue;

  void main(){
    // ---- endless wrap: nearest copy of this blade's tile position
    vec2 tile = aPos;
    vec2 wxz = tile + floor((uCamXZ - tile) / uExtent + 0.5) * uExtent;
    vec2 rel = wxz - uCamXZ;

    float lim = uExtent * 0.5;
    float edge = 1.0 - smoothstep(lim * 0.78, lim * 0.995, max(abs(rel.x), abs(rel.y)));

    // ---- behind-camera cull (cheap: collapse the blade)
    float d2 = length(rel);
    vec2 fwd = normalize(uCamFwd.xz + vec2(1e-5, 0.0));
    float facing = d2 > 5.0 ? dot(rel / max(d2, 1e-4), fwd) : 1.0;
    if (facing < -0.35) edge = 0.0;

    vec3 hd = terrainHD(wxz);
    vec3 gn = terrainNormalOf(hd);
    vec4 life4 = lifeAt(wxz);
    float life = clamp(life4.r * 1.35, 0.0, 1.0);

    float yaw = aRand.x * 6.2831853;
    float hf = mix(uH0, uH1, aRand.y) * (0.74 + 0.46 * life) * edge;
    float w = uW * (0.72 + 0.55 * aRand.z) * edge;

    float t = aT;
    float wave = windWave(wxz, uTime);
    vec2 bend = uWindDir * wave * uWindStrength;
    bend += vec2(cos(yaw), sin(yaw)) * 0.14 * sin(uTime * (2.2 + aRand.w * 2.5) + aRand.x * 37.0) * uWindStrength;

    vec2 lean = vec2(cos(yaw + 1.9), sin(yaw + 1.9)) * (0.09 + 0.21 * aRand.z);
    vec2 sweep = lean + bend * 0.70;

    float tt = pow(t, 1.55);
    vec2 offXZ = sweep * tt * hf;
    float droop = -0.30 * tt * hf * min(length(sweep), 1.6);
    vec3 mid = vec3(offXZ.x, t * hf + droop, offXZ.y);

    float dtt = 1.55 * pow(max(t, 1e-3), 0.55);
    float hfSafe = max(hf, 1e-3);
    vec3 tangent = normalize(vec3(sweep.x * dtt * hfSafe, hfSafe, sweep.y * dtt * hfSafe));

    vec3 side = vec3(cos(yaw), 0.0, sin(yaw));
    float taper = 1.0 - pow(t, 1.75);
    vec3 local = mid + side * (aSide * w * taper);

    vec3 nrm = normalize(cross(side, tangent));
    vNormal = normalize(nrm + side * aSide * 0.62);

    vec3 world = vec3(wxz.x, hd.x, wxz.y) + local;
    // let blades lie with the slope a little
    world += (gn - vec3(0.0, 1.0, 0.0)) * (t * hf * 0.45);

    vWorld = world;
    vT = t;
    vLife = life;
    vWave = wave;
    vHue = aRand.w;

    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
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
  uniform float uFlowerGlow;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vT;
  varying float vLife;
  varying float vWave;
  varying float vHue;

  void main(){
    vec3 V = normalize(uCamPos - vWorld);
    vec3 n = normalize(vNormal);
    if (dot(n, V) < 0.0) n = -n;

    float shade = cloudShade(vWorld.xz);

    vec3 dry = uGrassDry * mix(0.92, 1.14, vHue);
    vec3 lush = mix(uGrassLush, uGrassDeep, 0.28 + 0.5 * vHue);
    vec3 base = mix(mix(dry, lush, 0.22), lush, vLife);
    base = mix(base * 0.50, mix(base, uGrassTip, 0.20 + 0.20 * vHue), smoothstep(0.0, 0.92, vT));

    float ao = mix(0.52, 1.0, smoothstep(0.0, 0.6, vT));

    float ndl = wrapDiffuse(n, uSunDir, 0.5);
    vec3 sun = uSunColor * uSunIntensity * ndl * shade;
    vec3 amb = hemiAmbient(n) * (0.55 + 0.45 * shade);

    // translucency: blades light up like paper lanterns when back-lit
    float back = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 3.0);
    vec3 transTint = mix(vec3(1.0, 0.93, 0.66), vec3(0.72, 1.0, 0.5), vLife);
    vec3 trans = uSunColor * uSunIntensity * back * (0.28 + 0.72 * vT) * shade * 0.85 * transTint;

    // crest of each wave catches the light => visible ripples rolling across the field
    float crest = smoothstep(0.42, 1.0, vWave) * pow(vT, 1.5);

    // indirect bounce between blades keeps the meadow luminous instead of muddy
    vec3 bounce = base * uSunColor * uSunIntensity * 0.18 * shade * (0.30 + 0.70 * vT);
    vec3 col = base * (sun + amb) * ao + trans + bounce;
    col += uSunColor * uSunIntensity * crest * 0.14 * shade;
    col *= mix(1.0, 0.88, uWet);
    col += uSunColor * uFlash * 0.5;
    col += vec3(0.9, 1.0, 0.7) * uFlowerGlow * 0.05 * vLife * vT;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function bladeGeometry(seg) {
  const rows = seg;                  // rows of paired verts, plus one tip vertex
  const vcount = rows * 2 + 1;
  const side = new Float32Array(vcount);
  const tt = new Float32Array(vcount);
  const pos = new Float32Array(vcount * 3); // unused by shader but three wants `position`
  for (let i = 0; i < rows; i++) {
    const t = i / rows;
    side[i * 2 + 0] = -1; tt[i * 2 + 0] = t;
    side[i * 2 + 1] = +1; tt[i * 2 + 1] = t;
  }
  side[vcount - 1] = 0; tt[vcount - 1] = 1;

  const tris = [];
  for (let i = 0; i < rows - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    tris.push(a, c, b, b, c, d);
  }
  const l = (rows - 1) * 2;
  tris.push(l, vcount - 1, l + 1);

  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
  g.setIndex(tris);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  return g;
}

function scatter(count, extent, seed) {
  // stratified jitter: even coverage, no clumps or holes
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const pos = new Float32Array(count * 2);
  const rnd = new Float32Array(count * 4);
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const cx = i % cols, cy = (i / cols) | 0;
    pos[i * 2 + 0] = ((cx + rand()) / cols) * extent;
    pos[i * 2 + 1] = ((cy + rand()) / cols) * extent;
    rnd[i * 4 + 0] = rand();
    rnd[i * 4 + 1] = rand();
    rnd[i * 4 + 2] = rand();
    rnd[i * 4 + 3] = rand();
  }
  return { pos, rnd };
}

export class Grass {
  constructor(density = 1.0) {
    this.group = new THREE.Group();
    this.layers = [];
    this.density = density;

    GRASS_LAYERS.forEach((cfg, i) => {
      const geo = bladeGeometry(cfg.seg);
      const mat = new THREE.ShaderMaterial({
        uniforms: pick('terrain', 'life', 'light', 'shadow', 'palette', 'wind', {
          uExtent: { value: cfg.extent },
          uCamXZ: U.uCamXZ,
          uCamPos: U.uCamPos,
          uCamFwd: U.uCamFwd,
          uH0: { value: cfg.h0 },
          uH1: { value: cfg.h1 },
          uW: { value: cfg.w },
        }),
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      this.layers.push({ cfg, geo, mat, mesh, seed: 991 + i * 7717 });
    });

    this.setDensity(density);
  }

  setDensity(d) {
    this.density = d;
    this.count = 0;
    for (const layer of this.layers) {
      const n = Math.max(64, Math.round(GRASS_BUDGET * d * layer.cfg.share));
      const { pos, rnd } = scatter(n, layer.cfg.extent, layer.seed);
      layer.geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 2));
      layer.geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 4));
      layer.geo.instanceCount = n;
      this.count += n;
    }
  }

  dispose() {
    for (const l of this.layers) { l.geo.dispose(); l.mat.dispose(); }
  }
}
