// ---------------------------------------------------------------------------
// 天空 / 太阳 / 月亮 / 星空 / 云 / 昼夜循环
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { MAT, setNight } from '../lib/materials.js';
import * as G from '../lib/geom.js';
import { Rng, clamp, smoothstep, lerp } from '../lib/rng.js';
import { glowTexture } from '../lib/textures.js';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 bottomColor;
  uniform vec3 sunDir;
  uniform vec3 sunTint;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 col;
    if (h > 0.0) col = mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.62));
    else col = mix(horizonColor, bottomColor, pow(clamp(-h * 2.2, 0.0, 1.0), 0.7));
    // 太阳附近的辉光
    float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
    col += sunTint * pow(d, 26.0) * 0.85;
    col += sunTint * pow(d, 4.0) * 0.12;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const PALETTE = {
  night: { top: 0x0d1633, horizon: 0x1d2a4c, bottom: 0x080b16, sun: 0x93a6d6, amb: 0x3d4a72, dir: 0xa8bce8 },
  dawn: { top: 0x4a6fa8, horizon: 0xf0a06a, bottom: 0x2c3450, sun: 0xffb066, amb: 0x6d6a7a, dir: 0xffb27a },
  day: { top: 0x4d86c6, horizon: 0xbcd8ea, bottom: 0x8fa3b0, sun: 0xfff3d0, amb: 0xa8c0d8, dir: 0xfff2d8 },
  dusk: { top: 0x2f4478, horizon: 0xe98a5a, bottom: 0x24263c, sun: 0xff9a52, amb: 0x5f5b70, dir: 0xff9f66 },
};

function blend(a, b, t, key, out) {
  return out.setHex(a[key]).lerp(new THREE.Color(b[key]), t);
}

export function createSky(scene) {
  const group = new THREE.Group();
  group.name = 'sky';

  /* ------------------------------ 天空球 ------------------------------ */
  const uniforms = {
    topColor: { value: new THREE.Color(PALETTE.day.top) },
    horizonColor: { value: new THREE.Color(PALETTE.day.horizon) },
    bottomColor: { value: new THREE.Color(PALETTE.day.bottom) },
    sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3) },
    sunTint: { value: new THREE.Color(0xfff0c0) },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1700, 40, 24),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
  );
  dome.name = 'skyDome';
  dome.frustumCulled = false;
  group.add(dome);

  /* ------------------------------- 星空 ------------------------------- */
  const starRng = new Rng(31337);
  const N = 900;
  const sp = new Float32Array(N * 3);
  const ss = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let y = 0;
    let x = 0;
    let z = 0;
    do {
      x = starRng.range(-1, 1);
      y = starRng.range(-0.06, 1);
      z = starRng.range(-1, 1);
    } while (x * x + y * y + z * z < 0.2);
    const l = Math.hypot(x, y, z);
    sp[i * 3] = (x / l) * 1500;
    sp[i * 3 + 1] = (y / l) * 1500;
    sp[i * 3 + 2] = (z / l) * 1500;
    ss[i] = starRng.range(1.2, 3.6);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(ss, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      varying float vTw;
      uniform float uTime;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vTw = 0.65 + 0.35 * sin(uTime * 1.7 + position.x * 0.01 + position.z * 0.013);
        gl_PointSize = aSize * vTw;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vTw;
      void main(){
        vec2 d = gl_PointCoord - vec2(0.5);
        float a = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.92), a * uOpacity * vTw);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  group.add(stars);

  /* --------------------------- 太阳 / 月亮 ---------------------------- */
  const sunTex = glowTexture('rgba(255,250,230,1)', 'rgba(255,200,120,0)');
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  );
  sunSprite.scale.setScalar(190);
  group.add(sunSprite);

  const moonTex = glowTexture('rgba(240,246,255,1)', 'rgba(150,180,230,0)');
  const moonSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  );
  moonSprite.scale.setScalar(110);
  group.add(moonSprite);

  /* -------------------------------- 云 -------------------------------- */
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.92,
    flatShading: true,
    fog: false,
  });
  cloudMat.name = 'cloud';
  const clouds = new THREE.Group();
  const cRng = new Rng(777);
  const cloudGeos = [];
  for (let v = 0; v < 3; v++) {
    const parts = [];
    const n = 5 + v;
    for (let i = 0; i < n; i++) {
      const r = cRng.range(9, 17);
      const g = G.makeBall(r, 8, 4);
      g.scale(1, 0.52, 0.85);
      g.translate(cRng.range(-24, 24), cRng.range(-2, 4), cRng.range(-9, 9));
      parts.push(g);
    }
    cloudGeos.push(G.mergeMany(parts));
  }
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(cloudGeos[i % 3], cloudMat);
    m.position.set(cRng.range(-700, 700), cRng.range(120, 230), cRng.range(-700, 700));
    m.scale.setScalar(cRng.range(0.8, 2.0));
    m.castShadow = false;
    m.receiveShadow = false;
    clouds.add(m);
  }
  group.add(clouds);

  /* ------------------------------- 灯光 ------------------------------- */
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = 190;
  sun.shadow.camera.left = -S;
  sun.shadow.camera.right = S;
  sun.shadow.camera.top = S;
  sun.shadow.camera.bottom = -S;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.5;
  const sunTarget = new THREE.Object3D();
  scene.add(sunTarget);
  sun.target = sunTarget;
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0xa8c0d8, 0x4a4436, 0.95);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.22);
  scene.add(ambient);
  // 夜间冷调补光
  const moonLight = new THREE.DirectionalLight(0x9fb4e6, 0);
  scene.add(moonLight);

  scene.fog = new THREE.Fog(0xbcd8ea, 260, 1150);
  scene.add(group);

  const tmpA = new THREE.Color();
  const tmpB = new THREE.Color();
  const sunDir = new THREE.Vector3();

  /**
   * @param {number} tod 0..24 小时
   * @param {THREE.Vector3} focus 视线焦点（阴影相机与天空球跟随它）
   */
  function update(tod, focus) {
    const ang = ((tod - 6) / 24) * Math.PI * 2;
    const el = Math.sin(ang);
    sunDir.set(Math.cos(ang) * 0.86, el, Math.cos(ang) * 0.32).normalize();

    // 三段调色：夜 → 晨/昏 → 日
    let a;
    let b;
    let t;
    if (el > 0.22) {
      a = PALETTE.dawn;
      b = PALETTE.day;
      t = smoothstep(0.22, 0.62, el);
      if (tod > 12) a = PALETTE.dusk;
    } else if (el > -0.16) {
      const rising = tod < 12;
      a = PALETTE.night;
      b = rising ? PALETTE.dawn : PALETTE.dusk;
      t = smoothstep(-0.16, 0.22, el);
    } else {
      a = PALETTE.night;
      b = PALETTE.night;
      t = 0;
    }
    blend(a, b, t, 'top', uniforms.topColor.value);
    blend(a, b, t, 'horizon', uniforms.horizonColor.value);
    blend(a, b, t, 'bottom', uniforms.bottomColor.value);
    blend(a, b, t, 'sun', uniforms.sunTint.value);
    uniforms.sunDir.value.copy(sunDir);

    const dayK = clamp((el + 0.1) / 0.5, 0, 1);
    const nightK = 1 - clamp((el + 0.06) / 0.24, 0, 1);

    // 光照
    if (focus) {
      sunTarget.position.set(focus.x, 0, focus.z);
      group.position.set(focus.x, 0, focus.z);
    }
    sun.position.copy(sunDir).multiplyScalar(320).add(sunTarget.position);
    sun.intensity = 2.55 * Math.pow(dayK, 0.75);
    tmpA.setHex(a.dir);
    tmpB.setHex(b.dir);
    sun.color.copy(tmpA).lerp(tmpB, t);
    tmpA.setHex(a.amb);
    tmpB.setHex(b.amb);
    hemi.color.copy(tmpA).lerp(tmpB, t);
    hemi.intensity = lerp(0.62, 1.0, dayK);
    ambient.intensity = lerp(0.34, 0.24, dayK);
    moonLight.intensity = nightK * 0.95;
    moonLight.position.copy(sunDir).multiplyScalar(-320);

    // 雾
    scene.fog.color.copy(uniforms.horizonColor.value).multiplyScalar(lerp(0.78, 1.0, dayK));
    scene.fog.near = lerp(150, 300, dayK);
    scene.fog.far = lerp(760, 1250, dayK);

    // 天体
    sunSprite.position.copy(sunDir).multiplyScalar(1350).add(group.position);
    sunSprite.material.opacity = clamp(dayK * 1.6, 0, 1);
    moonSprite.position.copy(sunDir).multiplyScalar(-1350).add(group.position);
    moonSprite.material.opacity = nightK;
    starMat.uniforms.uOpacity.value = nightK;

    cloudMat.color.copy(uniforms.horizonColor.value).lerp(new THREE.Color(0xffffff), lerp(0.25, 0.9, dayK));
    cloudMat.opacity = lerp(0.5, 0.92, dayK);

    // 窗户 / 路灯的发光强度
    setNight(nightK);
    return { dayK, nightK, sunDir };
  }

  function animateClouds(dt) {
    for (const c of clouds.children) {
      c.position.x += dt * 1.6;
      if (c.position.x > 760) c.position.x = -760;
    }
  }

  /** 根据观察距离调整阴影相机范围 */
  let shadowRange = S;
  function setShadowRange(r) {
    const v = Math.max(90, Math.min(460, r));
    if (Math.abs(v - shadowRange) < 25) return;
    shadowRange = v;
    const c = sun.shadow.camera;
    c.left = -v;
    c.right = v;
    c.top = v;
    c.bottom = -v;
    c.far = 700 + v * 1.6;
    c.updateProjectionMatrix();
  }

  return { group, update, animateClouds, setShadowRange, sun, hemi, stars, uniforms };
}
