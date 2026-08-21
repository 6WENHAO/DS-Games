/**
 * 昼夜系统：渐变天空球、太阳/月亮、星空、流星、云层，
 * 以及随时间插值的光照 / 雾 / 曝光 / 水色 / 灯火。
 */
import * as THREE from 'three';
import { mat, mesh, group, sphere, lathe, clamp, lerp, smoothstep, TAU, RNG, setNightFactor, mergeGeometries } from '../lib/utils.js';
import { waterUniforms, riverUniforms } from './water.js';

/** 关键时刻色板（t: 0-24 小时） */
const KEYS = [
  { t: 0.0, top: '#050912', bot: '#0d1a2e', sun: '#3a4a7a', si: 0.06, amb: '#22314f', ai: 0.30, fog: '#0a1526', fd: 0.0055, exp: 0.95, shallow: '#123a52', deep: '#061626', foam: '#7f9fc0', hemi: 0.28 },
  { t: 4.6, top: '#0b142a', bot: '#233a52', sun: '#4a5a8a', si: 0.10, amb: '#2c3e5e', ai: 0.36, fog: '#1a2740', fd: 0.0070, exp: 0.98, shallow: '#1c4d63', deep: '#0a1e30', foam: '#93b0cc', hemi: 0.34 },
  { t: 6.3, top: '#2f4a7a', bot: '#e8a06a', sun: '#ff9d55', si: 1.35, amb: '#6b6a80', ai: 0.52, fog: '#c98f6a', fd: 0.0090, exp: 1.05, shallow: '#4a8f9a', deep: '#1d4258', foam: '#ffd8b0', hemi: 0.52 },
  { t: 8.2, top: '#3f7fca', bot: '#a9d6ef', sun: '#ffe6c0', si: 2.55, amb: '#8fb4d8', ai: 0.62, fog: '#bcd9ea', fd: 0.0058, exp: 1.0, shallow: '#5fbcc4', deep: '#0d4a6b', foam: '#eaf7ff', hemi: 0.72 },
  { t: 12.0, top: '#2f74d0', bot: '#c3e2f6', sun: '#fffaf0', si: 3.05, amb: '#a8cbe6', ai: 0.66, fog: '#cbe6f5', fd: 0.0045, exp: 1.0, shallow: '#63c6c9', deep: '#0e4a6b', foam: '#f4fbff', hemi: 0.80 },
  { t: 16.0, top: '#3877c4', bot: '#bfdcee', sun: '#fff0d0', si: 2.60, amb: '#9dc0dd', ai: 0.62, fog: '#c6dfef', fd: 0.0052, exp: 1.0, shallow: '#5cbcc4', deep: '#0d4767', foam: '#eef8ff', hemi: 0.74 },
  { t: 18.4, top: '#38508f', bot: '#f0955c', sun: '#ff7a35', si: 1.45, amb: '#7a6a80', ai: 0.54, fog: '#d18a5f', fd: 0.0092, exp: 1.06, shallow: '#4f93a0', deep: '#1b3c55', foam: '#ffcfa8', hemi: 0.54 },
  { t: 19.8, top: '#1b2547', bot: '#6b4a6e', sun: '#8a5a7a', si: 0.30, amb: '#42425f', ai: 0.40, fog: '#4a3a52', fd: 0.0082, exp: 1.02, shallow: '#2b5a72', deep: '#0d2438', foam: '#a898b8', hemi: 0.38 },
  { t: 21.5, top: '#070d1c', bot: '#131f38', sun: '#3f4f80', si: 0.08, amb: '#26354f', ai: 0.32, fog: '#101b30', fd: 0.0060, exp: 0.96, shallow: '#143c54', deep: '#071827', foam: '#88a4c4', hemi: 0.30 },
  { t: 24.0, top: '#050912', bot: '#0d1a2e', sun: '#3a4a7a', si: 0.06, amb: '#22314f', ai: 0.30, fog: '#0a1526', fd: 0.0055, exp: 0.95, shallow: '#123a52', deep: '#061626', foam: '#7f9fc0', hemi: 0.28 },
];

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAG = /* glsl */`
  uniform vec3 uTop, uBot, uSunCol, uHorizonGlow;
  uniform vec3 uSunDir, uMoonDir;
  uniform float uNight, uSunI;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uBot, uTop, pow(h, 0.75));
    // 地平线泛光（日出日落方向）
    float sunAmt = max(0.0, dot(d, normalize(uSunDir)));
    col += uHorizonGlow * pow(sunAmt, 6.0) * 0.85;
    col += uSunCol * pow(sunAmt, 90.0) * uSunI * 0.35;
    // 低空霞光带
    float band = exp(-abs(d.y) * 6.0);
    col += uHorizonGlow * band * 0.22 * pow(max(0.0, sunAmt), 1.5);
    // 夜间月光辉
    float moonAmt = max(0.0, dot(d, normalize(uMoonDir)));
    col += vec3(0.55, 0.62, 0.85) * pow(moonAmt, 40.0) * uNight * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function sampleKeys(t) {
  t = ((t % 24) + 24) % 24;
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i].t && t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const k = smoothstep((t - a.t) / Math.max(0.0001, b.t - a.t));
  return { a, b, k };
}

const tmpC1 = new THREE.Color(), tmpC2 = new THREE.Color();
function lerpCol(out, ha, hb, k) {
  tmpC1.set(ha); tmpC2.set(hb);
  return out.copy(tmpC1).lerp(tmpC2, k);
}

export function buildSky(scene, renderer) {
  const root = group('sky');
  scene.add(root);

  const uniforms = {
    uTop: { value: new THREE.Color('#3f7fca') },
    uBot: { value: new THREE.Color('#a9d6ef') },
    uSunCol: { value: new THREE.Color('#fff6e0') },
    uHorizonGlow: { value: new THREE.Color('#ff9d55') },
    uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.4) },
    uMoonDir: { value: new THREE.Vector3(-0.4, -0.6, -0.4) },
    uNight: { value: 0 },
    uSunI: { value: 1 },
  };
  const skyGeo = new THREE.SphereGeometry(320, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(skyGeo, skyMat);
  dome.name = 'skyDome';
  dome.frustumCulled = false;
  root.add(dome);

  /* --------- 星空 --------- */
  const rng = new RNG(80808);
  const starCount = 1400;
  const pos = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  const cols = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    let x, y, z, l;
    do {
      x = rng.range(-1, 1); y = rng.range(-0.08, 1); z = rng.range(-1, 1);
      l = Math.hypot(x, y, z);
    } while (l < 0.001);
    const r = 290;
    pos[i * 3] = (x / l) * r; pos[i * 3 + 1] = (y / l) * r; pos[i * 3 + 2] = (z / l) * r;
    sizes[i] = rng.range(0.7, 2.6);
    const c = new THREE.Color().setHSL(rng.range(0.5, 0.68), rng.range(0.0, 0.35), rng.range(0.75, 1.0));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  starGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aSize; varying vec3 vC; varying float vTw;
      uniform float uTime;
      void main() {
        vC = color;
        vTw = 0.65 + 0.35 * sin(uTime * 2.2 + position.x * 0.7 + position.z * 0.3);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mv.z) * 1.3;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying vec3 vC; varying float vTw;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.05, length(d));
        gl_FragColor = vec4(vC, a * uOpacity * vTw);
      }
    `,
    transparent: true, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  root.add(stars);

  /* --------- 太阳 / 月亮 --------- */
  const sunSprite = new THREE.Mesh(
    new THREE.CircleGeometry(11, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff4d8, transparent: true, opacity: 0.95, fog: false, depthWrite: false })
  );
  sunSprite.name = 'sunDisc';
  root.add(sunSprite);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0.3, fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  root.add(sunGlow);

  const moon = group('moon');
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 32),
    new THREE.MeshBasicMaterial({ color: 0xf2f4ff, transparent: true, opacity: 0.95, fog: false, depthWrite: false })
  );
  moon.add(moonDisc);
  const moonGlow = new THREE.Mesh(
    new THREE.CircleGeometry(22, 32),
    new THREE.MeshBasicMaterial({ color: 0xa8c0ff, transparent: true, opacity: 0.22, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  moon.add(moonGlow);
  root.add(moon);

  /* --------- 云 --------- */
  const cloudRoot = group('clouds');
  root.add(cloudRoot);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, metalness: 0, transparent: true, opacity: 0.92, flatShading: true, fog: false,
  });
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const parts = [];
    const n = rng.int(4, 8);
    for (let k = 0; k < n; k++) {
      const r = rng.range(3.2, 6.5);
      const g = sphere(r, 8, 6);
      g.scale(rng.range(1.1, 1.9), rng.range(0.5, 0.8), rng.range(0.9, 1.5));
      g.translate(rng.range(-9, 9), rng.range(-1.2, 1.2), rng.range(-5, 5));
      parts.push(g.toNonIndexed());
    }
    const cl = new THREE.Mesh(mergeGeometries(parts, false), cloudMat);
    cl.castShadow = false; cl.receiveShadow = false;
    const a = rng.range(0, TAU), rr = rng.range(45, 130);
    cl.position.set(Math.cos(a) * rr, rng.range(38, 68), Math.sin(a) * rr);
    cl.scale.setScalar(rng.range(0.8, 1.7));
    cloudRoot.add(cl);
    clouds.push({ obj: cl, speed: rng.range(0.35, 0.9), a, rr });
  }

  /* --------- 流星 --------- */
  const meteorGeo = new THREE.BufferGeometry();
  meteorGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -26], 3));
  const meteorMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false });
  const meteor = new THREE.Line(meteorGeo, meteorMat);
  meteor.frustumCulled = false;
  root.add(meteor);
  const meteorState = { t: -1, next: 6 };

  /* --------- 灯光 --------- */
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = 52;
  sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
  sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  const moonLight = new THREE.DirectionalLight(0x9fb4ff, 0);
  scene.add(moonLight);
  scene.add(moonLight.target);

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xbcd9ea, 0x6a6350, 0.7);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2(0xcbe6f5, 0.0045);

  const state = {
    hours: 9.4,
    night: 0,
    sunDir: new THREE.Vector3(),
    moonDir: new THREE.Vector3(),
    sunAltitude: 0,
  };

  function apply(t, elapsed = 0) {
    state.hours = ((t % 24) + 24) % 24;
    const { a, b, k } = sampleKeys(state.hours);

    // 太阳轨迹：日出 6:00 → 日落 18:30，轴略倾斜
    const dayPhase = (state.hours - 6.0) / 12.5; // 0..1 白天
    const ang = dayPhase * Math.PI;
    const alt = Math.sin(ang);
    const az = Math.cos(ang);
    state.sunDir.set(-az * 0.82, alt, -0.42 + az * 0.16).normalize();
    state.moonDir.copy(state.sunDir).multiplyScalar(-1);
    state.sunAltitude = state.sunDir.y;

    // 夜色权重
    const night = 1 - smoothstep((state.sunDir.y + 0.12) / 0.30);
    state.night = night;

    lerpCol(uniforms.uTop.value, a.top, b.top, k);
    lerpCol(uniforms.uBot.value, a.bot, b.bot, k);
    lerpCol(uniforms.uSunCol.value, a.sun, b.sun, k);
    lerpCol(uniforms.uHorizonGlow.value, a.fog, b.fog, k);
    uniforms.uSunDir.value.copy(state.sunDir);
    uniforms.uMoonDir.value.copy(state.moonDir);
    uniforms.uNight.value = night;
    uniforms.uSunI.value = lerp(a.si, b.si, k);

    // 灯光
    const si = lerp(a.si, b.si, k);
    sun.position.copy(state.sunDir).multiplyScalar(120);
    sun.target.position.set(0, 4, 0);
    lerpCol(sun.color, a.sun, b.sun, k);
    sun.intensity = Math.max(0, si) * clamp(smoothstep((state.sunDir.y + 0.05) / 0.2), 0, 1);
    sun.visible = sun.intensity > 0.01;

    moonLight.position.copy(state.moonDir).multiplyScalar(120);
    moonLight.target.position.set(0, 4, 0);
    moonLight.intensity = night * 0.42 * clamp(smoothstep(state.moonDir.y / 0.2));

    lerpCol(ambient.color, a.amb, b.amb, k);
    ambient.intensity = lerp(a.ai, b.ai, k);
    lerpCol(hemi.color, a.bot, b.bot, k);
    lerpCol(hemi.groundColor, a.fog, b.fog, k);
    hemi.intensity = lerp(a.hemi, b.hemi, k);

    lerpCol(scene.fog.color, a.fog, b.fog, k);
    scene.fog.density = lerp(a.fd, b.fd, k);
    if (renderer) renderer.toneMappingExposure = lerp(a.exp, b.exp, k);

    // 水色
    lerpCol(waterUniforms.uShallow.value, a.shallow, b.shallow, k);
    lerpCol(waterUniforms.uDeep.value, a.deep, b.deep, k);
    lerpCol(waterUniforms.uFoam.value, a.foam, b.foam, k);
    riverUniforms.uShallow.value.copy(waterUniforms.uShallow.value).lerp(tmpC1.set('#ffffff'), 0.22);
    riverUniforms.uDeep.value.copy(waterUniforms.uDeep.value).lerp(tmpC1.set('#4a8f9a'), 0.3);
    riverUniforms.uFoam.value.copy(waterUniforms.uFoam.value);

    // 日月位置
    const R = 250;
    sunSprite.position.copy(state.sunDir).multiplyScalar(R);
    sunGlow.position.copy(sunSprite.position);
    sunSprite.lookAt(0, 0, 0); sunGlow.lookAt(0, 0, 0);
    sunSprite.material.opacity = clamp(smoothstep((state.sunDir.y + 0.12) / 0.16)) * 0.95;
    sunGlow.material.opacity = clamp(smoothstep((state.sunDir.y + 0.2) / 0.3)) * 0.32;
    lerpCol(sunSprite.material.color, a.sun, b.sun, k);
    lerpCol(sunGlow.material.color, a.sun, b.sun, k);

    moon.position.copy(state.moonDir).multiplyScalar(R);
    moon.lookAt(0, 0, 0);
    const mo = clamp(smoothstep((state.moonDir.y + 0.05) / 0.2));
    moonDisc.material.opacity = mo * 0.96;
    moonGlow.material.opacity = mo * 0.26;

    // 星空
    starMat.uniforms.uOpacity.value = night * 0.95;
    stars.rotation.y = elapsed * 0.004;
    stars.rotation.z = 0.24;

    // 云：白天亮、黄昏染色、夜里压暗
    lerpCol(cloudMat.color, a.bot, b.bot, k);
    cloudMat.color.lerp(tmpC1.set('#ffffff'), 0.45);
    cloudMat.opacity = lerp(0.55, 0.93, clamp(1 - night * 0.75));

    // 夜间灯火
    setNightFactor(night);
  }

  function update(dt, elapsed) {
    for (const c of clouds) {
      c.obj.position.x += c.speed * dt * 0.35;
      c.obj.position.z += c.speed * dt * 0.12;
      if (c.obj.position.x > 150) c.obj.position.x = -150;
      if (c.obj.position.z > 150) c.obj.position.z = -150;
    }
    starMat.uniforms.uTime.value = elapsed;
    // 流星
    if (state.night > 0.5) {
      meteorState.next -= dt;
      if (meteorState.next <= 0 && meteorState.t < 0) {
        meteorState.t = 0;
        meteorState.next = 7 + Math.random() * 16;
        const a = Math.random() * TAU;
        meteor.position.set(Math.cos(a) * 150, 90 + Math.random() * 60, Math.sin(a) * 150);
        meteor.rotation.set(Math.random() * 0.6 - 0.3, a + Math.PI * 0.5, Math.random() * 0.8 - 0.4);
      }
      if (meteorState.t >= 0) {
        meteorState.t += dt;
        const k = meteorState.t / 1.1;
        meteorMat.opacity = Math.sin(clamp(k) * Math.PI) * 0.9;
        meteor.position.y -= dt * 42;
        meteor.position.x -= dt * 26;
        if (k > 1) { meteorState.t = -1; meteorMat.opacity = 0; }
      }
    } else {
      meteorMat.opacity = 0;
      meteorState.t = -1;
    }
  }

  return { root, state, apply, update, sun, moonLight, ambient, hemi, dome, stars };
}
