// Shaders / materials for the voxel world.
import * as THREE from 'three';

export const shared = {
  uTime: { value: 0 },
  uAtlas: { value: null },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
  uSunColor: { value: new THREE.Color(1, 0.96, 0.88) },
  uAmbient: { value: new THREE.Color(0.42, 0.48, 0.6) },
  uFogColor: { value: new THREE.Color(0.65, 0.8, 0.95) },
  uFogDensity: { value: 0.0042 },
  uSunIntensity: { value: 1.0 },
  uLampPos: { value: new THREE.Vector3() },
  uLampColor: { value: new THREE.Color(1.0, 0.86, 0.6) },
  uLampStrength: { value: 0.0 },
  uUnderwater: { value: 0 },
  uExposure: { value: 1.0 },
  uScanPulse: { value: -1 },     // scanner ping radius, <0 = off
  uScanOrigin: { value: new THREE.Vector3() },
  uScanColor: { value: new THREE.Color(0.35, 0.95, 1.0) },
};

const COMMON_VERT = /* glsl */`
  attribute float aLight;
  attribute float aEmit;
  attribute float aSway;
  attribute vec3 aTint;
  varying vec2 vUv;
  varying float vLight;
  varying float vEmit;
  varying vec3 vTint;
  varying vec3 vWorld;
  varying float vDist;
  uniform float uTime;
`;

const COMMON_FRAG = /* glsl */`
  uniform sampler2D uAtlas;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uSunIntensity;
  uniform vec3 uLampPos;
  uniform vec3 uLampColor;
  uniform float uLampStrength;
  uniform float uUnderwater;
  uniform float uExposure;
  uniform float uTime;
  uniform float uScanPulse;
  uniform vec3 uScanOrigin;
  uniform vec3 uScanColor;
  varying vec2 vUv;
  varying float vLight;
  varying float vEmit;
  varying vec3 vTint;
  varying vec3 vWorld;
  varying float vDist;

  vec3 applyLighting(vec3 base) {
    vec3 amb = uAmbient * (0.42 + 0.58 * vLight);
    vec3 sun = uSunColor * uSunIntensity * vLight * 0.88;
    vec3 col = base * min(vec3(1.12), amb + sun);
    // emissive blocks glow and pulse very slightly
    float pulse = 0.92 + 0.08 * sin(uTime * 2.2 + vWorld.x * 0.7 + vWorld.z * 0.5);
    col += base * vEmit * 1.15 * pulse;
    // suit lamp
    float d = length(vWorld - uLampPos);
    float lamp = uLampStrength * exp(-d * 0.115) * (0.35 + 0.65 * vLight);
    col += base * uLampColor * lamp;
    return col;
  }

  vec3 applyScan(vec3 col) {
    if (uScanPulse < 0.0) return col;
    float d = length(vWorld - uScanOrigin);
    float ring = 1.0 - smoothstep(0.0, 5.0, abs(d - uScanPulse));
    float fade = 1.0 - smoothstep(30.0, 90.0, uScanPulse);
    col += uScanColor * ring * 0.85 * fade;
    // scan grid highlight inside the ring
    float inside = step(d, uScanPulse) * fade;
    float grid = step(0.94, max(fract(vWorld.x * 0.5), max(fract(vWorld.y * 0.5), fract(vWorld.z * 0.5))));
    col += uScanColor * grid * inside * 0.16;
    return col;
  }

  vec3 grade(vec3 col) {
    // gentle contrast S-curve + saturation lift keeps the voxel palette punchy
    col = clamp(col, 0.0, 4.0);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, 1.06);
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.10);
    return col;
  }

  vec3 applyFog(vec3 col) {
    float dens = uFogDensity * (1.0 + uUnderwater * 11.0);
    // gentle exponential haze: keeps mid-distance readable, fades far terrain
    float f = 1.0 - exp(-pow(vDist * dens, 1.55));
    f *= 0.94;
    vec3 fc = mix(uFogColor, vec3(0.04, 0.22, 0.36), uUnderwater);
    return mix(col, fc, clamp(f, 0.0, 1.0));
  }
`;

export function createTerrainMaterial(atlasTexture, opts = {}) {
  const uniforms = THREE.UniformsUtils.merge([{}]);
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, shared, { uAtlas: { value: atlasTexture } }),
    vertexShader: COMMON_VERT + /* glsl */`
      void main() {
        vUv = uv;
        vLight = aLight;
        vEmit = aEmit;
        vTint = aTint;
        vec3 p = position;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        if (aSway > 0.5) {
          float t = uTime * 1.6 + wp.x * 0.55 + wp.z * 0.42;
          float amt = uv.y * 0.085;
          wp.x += sin(t) * amt;
          wp.z += cos(t * 0.85) * amt;
        }
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: COMMON_FRAG + /* glsl */`
      void main() {
        vec4 tex = texture2D(uAtlas, vUv);
        if (tex.a < 0.45) discard;
        vec3 base = tex.rgb * vTint;
        vec3 col = applyLighting(base);
        col = grade(col);
        col = applyScan(col);
        col = applyFog(col);
        gl_FragColor = vec4(col * uExposure, 1.0);
      }
    `,
    side: opts.side || THREE.FrontSide,
  });
  mat.name = 'terrain';
  return mat;
}

export function createWaterMaterial(atlasTexture, tint = new THREE.Color(0.25, 0.55, 0.95)) {
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, shared, { uAtlas: { value: atlasTexture }, uWaterTint: { value: tint } }),
    vertexShader: COMMON_VERT + /* glsl */`
      void main() {
        vUv = uv;
        vLight = aLight;
        vEmit = aEmit;
        vTint = aTint;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float w = sin(uTime * 1.15 + wp.x * 0.42 + wp.z * 0.33) * 0.055
                + sin(uTime * 0.7 - wp.x * 0.21 + wp.z * 0.55) * 0.035;
        wp.y += w;
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: COMMON_FRAG + /* glsl */`
      uniform vec3 uWaterTint;
      void main() {
        vec2 uvw = vUv + vec2(sin(uTime * 0.4 + vWorld.z * 0.3) * 0.004, cos(uTime * 0.33 + vWorld.x * 0.3) * 0.004);
        vec4 tex = texture2D(uAtlas, uvw);
        vec3 base = tex.rgb * vTint;
        vec3 col = applyLighting(base);
        // specular glint
        vec3 v = normalize(cameraPosition - vWorld);
        float spec = pow(max(0.0, dot(reflect(-normalize(vec3(0.4,0.9,0.3)), vec3(0.0,1.0,0.0)), v)), 24.0);
        col += uSunColor * spec * 0.32 * uSunIntensity;
        col = applyScan(col);
        col = applyFog(col);
        gl_FragColor = vec4(col * uExposure, 0.86);
      }
    `,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  mat.name = 'water';
  return mat;
}

/** Minecraft-style 10-stage crack overlay atlas (procedural). */
export function createCrackTexture() {
  const stages = 10, size = 16;
  const c = document.createElement('canvas');
  c.width = size * stages; c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  let rngState = 991;
  const rnd = () => { rngState = (rngState * 1103515245 + 12345) & 0x7fffffff; return rngState / 0x7fffffff; };
  // build progressive crack pixels
  const pixels = [];
  for (let s = 0; s < stages; s++) {
    const n = 6 + s * 9;
    const arr = [];
    let x = 8, y = 8;
    for (let i = 0; i < n; i++) {
      arr.push([x, y]);
      x += Math.round(rnd() * 2 - 1);
      y += Math.round(rnd() * 2 - 1);
      if (x < 0 || x > 15 || y < 0 || y > 15 || rnd() < 0.12) { x = (rnd() * 16) | 0; y = (rnd() * 16) | 0; }
    }
    pixels.push(arr);
  }
  for (let s = 0; s < stages; s++) {
    g.save();
    g.translate(s * size, 0);
    for (let k = 0; k <= s; k++) {
      for (const [px, py] of pixels[k]) {
        g.fillStyle = 'rgba(0,0,0,' + (0.55 + 0.04 * (s - k)) + ')';
        g.fillRect(px, py, 1, 1);
      }
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeAtlasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
