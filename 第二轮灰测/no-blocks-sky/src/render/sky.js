// Sky dome, square Minecraft sun/moon, blocky cloud layer, stars, companion planets.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const SKY_FRAG = /* glsl */`
  varying vec3 vDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uStars;
  uniform float uTime;
  uniform float uSpace;
  uniform vec3 uNebula;

  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    float h = clamp(vDir.y, -1.0, 1.0);
    float t = pow(clamp(h * 0.5 + 0.5, 0.0, 1.0), 0.75);
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.85, t));
    // sun glow / halo
    float sd = max(0.0, dot(normalize(vDir), normalize(uSunDir)));
    col += uSunColor * pow(sd, 220.0) * 3.2;
    col += uSunColor * pow(sd, 12.0) * 0.32;
    col += uSunColor * pow(sd, 3.0) * 0.09;
    // horizon band warm glow near sunrise/sunset
    float band = exp(-abs(h) * 9.0) * pow(max(0.0, dot(normalize(vec3(uSunDir.x, 0.0, uSunDir.z)), normalize(vec3(vDir.x, 0.0, vDir.z)))), 2.2);
    col += uSunColor * band * 0.7 * (1.0 - abs(uSunDir.y));
    // permanent soft horizon lift so the skyline reads clearly
    col += uHorizon * exp(-abs(h) * 6.0) * 0.16;
    // stars (blocky, quantised directions => pixel-ish)
    if (uStars > 0.001) {
      vec3 q = floor(normalize(vDir) * 460.0);
      float s = hash(q);
      float star = smoothstep(0.9958, 1.0, s);
      float tw = 0.65 + 0.35 * sin(uTime * 2.5 + s * 90.0);
      col += vec3(1.0, 0.98, 0.94) * star * uStars * 2.4 * tw;
      float s2 = hash(q * 0.5 + 11.0);
      col += vec3(0.75, 0.85, 1.0) * smoothstep(0.9986, 1.0, s2) * uStars * 5.5;
    }
    // subtle ordered dither removes 8-bit gradient banding
    float dth = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (dth - 0.5) * 0.008;
    // nebula clouds for space
    if (uSpace > 0.001) {
      float n = 0.0;
      vec3 p = normalize(vDir) * 2.2;
      float amp = 0.5;
      for (int i = 0; i < 4; i++) {
        n += amp * hash(floor(p * 8.0)) ;
        p *= 2.03; amp *= 0.55;
      }
      n = smoothstep(0.45, 1.05, n);
      col += uNebula * n * uSpace * 0.5;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function makeCloudTexture(seed = 7, size = 128, coverage = 0.42) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const rnd = mulberry32(seed);
  // low-res value noise, upsampled to blocky cells => Minecraft cloud feel
  const res = 32;
  const low = new Float32Array(res * res);
  for (let i = 0; i < low.length; i++) low[i] = rnd();
  const smooth = new Float32Array(res * res);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      let s = 0, w = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const wt = 1 / (1 + Math.abs(dx) + Math.abs(dy));
        s += low[((y + dy + res) % res) * res + ((x + dx + res) % res)] * wt;
        w += wt;
      }
      smooth[y * res + x] = s / w;
    }
  }
  // clouds occupy the top of the value range only => sparse islands like Minecraft
  const sorted = Array.from(smooth).sort((a, b) => a - b);
  const thr = sorted[Math.floor(sorted.length * (1 - coverage * 0.55))];
  const cell = size / res;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      const v = smooth[gy * res + gx];
      const on = v > thr;
      const i = (y * size + x) * 4;
      // slight per-cell brightness variation + a 1px darker bottom edge for depth
      const cellShade = 240 + Math.floor(((gx + gy) % 3) * 6);
      const edge = (y % cell) >= cell - 1 ? -26 : 0;
      img.data[i] = cellShade + edge;
      img.data[i + 1] = cellShade + edge;
      img.data[i + 2] = Math.min(255, cellShade + 8 + edge);
      img.data[i + 3] = on ? 225 : 0;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class Sky {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.uniforms = {
      uZenith: { value: new THREE.Color(0x3f7fd0) },
      uHorizon: { value: new THREE.Color(0xbfe4ff) },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
      uSunColor: { value: new THREE.Color(0xfff3d6) },
      uStars: { value: 0 },
      uTime: { value: 0 },
      uSpace: { value: 0 },
      uNebula: { value: new THREE.Color(0x4a2f7a) },
    };
    const geo = new THREE.SphereGeometry(1, 32, 20);
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.scale.setScalar(1);
    scene.add(this.mesh);

    // square sun & moon (Minecraft style flat quads)
    const sunGeo = new THREE.PlaneGeometry(1, 1);
    this.sunMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending });
    this.sun = new THREE.Mesh(sunGeo, this.sunMat);
    this.sun.renderOrder = -900;
    this.sun.frustumCulled = false;
    scene.add(this.sun);

    this.moonMat = new THREE.MeshBasicMaterial({ map: makeMoonTexture(), transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0.95 });
    this.moon = new THREE.Mesh(sunGeo.clone(), this.moonMat);
    this.moon.renderOrder = -900;
    this.moon.frustumCulled = false;
    scene.add(this.moon);

    // blocky cloud layer
    const cloudTex = makeCloudTexture(opts.cloudSeed || 11, 256, opts.cloudCoverage ?? 0.42);
    cloudTex.repeat.set(6, 6);
    this.cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      color: 0xffffff, opacity: 0.82,
    });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 168;
    this.clouds.renderOrder = -800;
    this.clouds.frustumCulled = false;
    scene.add(this.clouds);

    // companion planet in the sky (NMS signature look)
    this.companions = new THREE.Group();
    scene.add(this.companions);
  }

  addCompanion(color, size, pos, ringed = false) {
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(size, 16, 12);
    const mat = new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false, depthTest: false });
    const m = new THREE.Mesh(geo, mat);
    // fake terminator shading with a second darker hemisphere
    const dark = new THREE.Mesh(new THREE.SphereGeometry(size * 1.003, 16, 12, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x0a0e18, transparent: true, opacity: 0.62, fog: false, depthWrite: false, depthTest: false }));
    dark.rotation.y = Math.PI * 0.35;
    g.add(m); g.add(dark);
    if (ringed) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.35, size * 2.1, 40, 1),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, side: THREE.DoubleSide, fog: false, depthWrite: false, depthTest: false })
      );
      ring.rotation.x = Math.PI / 2.35;
      g.add(ring);
    }
    g.position.copy(pos);
    g.renderOrder = -850;
    g.traverse((o) => { o.frustumCulled = false; o.renderOrder = -850; });
    this.companions.add(g);
    return g;
  }

  setPalette(pal) {
    this.uniforms.uZenith.value.setRGB(pal.sky[0] / 255, pal.sky[1] / 255, pal.sky[2] / 255);
    this.uniforms.uHorizon.value.setRGB(pal.skyHorizon[0] / 255, pal.skyHorizon[1] / 255, pal.skyHorizon[2] / 255);
    this.uniforms.uSunColor.value.setRGB(pal.sun[0] / 255, pal.sun[1] / 255, pal.sun[2] / 255);
    this._cloudBase = [pal.cloud[0] / 255, pal.cloud[1] / 255, pal.cloud[2] / 255];
    this.cloudMat.color.setRGB(this._cloudBase[0], this._cloudBase[1], this._cloudBase[2]);
  }

  /** dayT: 0..1 (0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight) */
  update(dt, camPos, dayT, time) {
    this.uniforms.uTime.value = time;
    this.mesh.position.copy(camPos);
    this.mesh.scale.setScalar(1400);

    const ang = dayT * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang) * 0.55, Math.sin(ang), Math.sin(ang * 0.35) * 0.3).normalize();
    this.uniforms.uSunDir.value.copy(sunDir);
    const dist = 900;
    this.sun.position.copy(camPos).addScaledVector(sunDir, dist);
    this.sun.lookAt(camPos);
    this.sun.scale.setScalar(120);
    this.moon.position.copy(camPos).addScaledVector(sunDir, -dist);
    this.moon.lookAt(camPos);
    this.moon.scale.setScalar(95);

    const night = Math.max(0, Math.min(1, (-sunDir.y + 0.14) * 3.2));
    this.uniforms.uStars.value = night;
    this.sunMat.opacity = Math.max(0, Math.min(1, sunDir.y * 4 + 0.3));
    this.moonMat.opacity = night * 0.95;

    // clouds dim with the daylight so they never glow at night
    if (this._cloudBase) {
      const k = 0.22 + 0.78 * Math.max(0, Math.min(1, sunDir.y * 2.2 + 0.22));
      this.cloudMat.color.setRGB(this._cloudBase[0] * k, this._cloudBase[1] * k, this._cloudBase[2] * k);
      this.cloudMat.opacity = 0.62 + 0.24 * k;
    }
    this.clouds.position.x = camPos.x;
    this.clouds.position.z = camPos.z;
    if (this.cloudMat.map) {
      this.cloudMat.map.offset.x = (time * 0.0028) % 1;
      this.cloudMat.map.offset.y = (time * 0.0009) % 1;
    }
    this.companions.position.copy(camPos);
    return sunDir;
  }

  dispose() {
    this.scene.remove(this.mesh); this.scene.remove(this.sun); this.scene.remove(this.moon);
    this.scene.remove(this.clouds); this.scene.remove(this.companions);
    this.mesh.geometry.dispose(); this.mat.dispose();
    this.cloudMat.map?.dispose(); this.cloudMat.dispose();
  }
}

function makeMoonTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#e8eef8';
  g.fillRect(0, 0, 32, 32);
  const rnd = mulberry32(4242);
  for (let i = 0; i < 26; i++) {
    const x = (rnd() * 32) | 0, y = (rnd() * 32) | 0, r = 1 + ((rnd() * 3) | 0);
    g.fillStyle = 'rgba(160,172,190,' + (0.35 + rnd() * 0.4) + ')';
    g.fillRect(x, y, r, r);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  return tex;
}
