/* ============================================================================
 *  70 · 场景：渲染器 / 程序化 HDR 环境 / 光照 / 地面 / 自研后处理
 * ==========================================================================*/

let MAXANISO = 8;

/* ------------------------------------------------------------- 全屏 Pass */
const FS_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class FSQuad {
  constructor(material) {
    this.material = material;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  render(renderer, target = null) {
    renderer.setRenderTarget(target);
    renderer.clear(true, false, false);
    renderer.render(this.scene, this.camera);
  }
}

/* -------------------------------------------------------------- 天空材质 */
function skyMaterial(cloudTex) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x2f6fbd) },
      uHorizon: { value: new THREE.Color(0xbcd0dc) },
      uGround: { value: new THREE.Color(0x2a2a26) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.45, 0.75) },
      uSunCol: { value: new THREE.Color(0xfff2df) },
      uSunI: { value: 26.0 },
      uHaze: { value: 1.0 },
      uCloud: { value: cloudTex },
      uCloudAmt: { value: 0.55 },
      uExp: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunCol;
      uniform float uSunI, uHaze, uCloudAmt, uExp;
      uniform sampler2D uCloud;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 sky = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.52));
        sky = mix(sky, uGround, smoothstep(0.005, -0.10, h));
        vec3 sd = normalize(uSunDir);
        float md = max(dot(d, sd), 0.0);
        sky += uSunCol * pow(md, 1400.0) * uSunI;
        sky += uSunCol * pow(md, 8.0) * 0.22 * uHaze;
        sky += uSunCol * pow(md, 2.0) * 0.06 * uHaze;
        // 云层
        if (uCloudAmt > 0.001 && h > 0.0) {
          vec2 cuv = vec2(atan(d.z, d.x) * 0.159154, (0.30 / max(h, 0.05)));
          float c = texture2D(uCloud, cuv * vec2(1.0, 0.55)).r;
          float c2 = texture2D(uCloud, cuv * vec2(2.1, 1.2) + 0.37).r;
          float m = smoothstep(0.52, 0.86, c * 0.65 + c2 * 0.45) * smoothstep(0.0, 0.22, h);
          sky = mix(sky, mix(vec3(0.72,0.75,0.80), uSunCol * 1.25, pow(md, 3.0) * 0.6) * (0.7 + 0.5 * uHaze), m * uCloudAmt);
        }
        gl_FragColor = vec4(sky * uExp, 1.0);
      }`,
  });
}

const ENV_PRESETS = {
  day: {
    label: '白昼', zenith: 0x2f74c9, horizon: 0xcedde6, ground: 0x3a382f,
    sun: [0.55, 0.58, 0.62], sunCol: 0xfff5e6, sunI: 3.9, skySunI: 32, haze: 1.0, cloud: 0.5,
    hemi: [0xa8cbea, 0x565446, 0.75], fill: 0.42, exposure: 1.18, bloom: 0.5, fog: [0xbecdd6, 0.0032],
    padRough: 1.0, padTint: 1.0,
  },
  dusk: {
    label: '黄昏', zenith: 0x1e2f5e, horizon: 0xe6a356, ground: 0x241f1a,
    sun: [-0.85, 0.16, 0.35], sunCol: 0xffb066, sunI: 3.4, skySunI: 46, haze: 1.6, cloud: 0.62,
    hemi: [0x6c7cb4, 0x453728, 0.62], fill: 0.34, exposure: 1.30, bloom: 0.95, fog: [0xc98a5a, 0.0058],
    padRough: 0.92, padTint: 0.92,
  },
  night: {
    label: '夜航', zenith: 0x050a16, horizon: 0x14223a, ground: 0x08090b,
    sun: [-0.35, 0.30, -0.85], sunCol: 0xa9c8ff, sunI: 0.9, skySunI: 7, haze: 0.5, cloud: 0.25,
    hemi: [0x2a3f61, 0x0d0e13, 0.5], fill: 0.22, exposure: 1.75, bloom: 1.5, fog: [0x0b1220, 0.0088],
    padRough: 0.85, padTint: 0.5,
  },
  studio: {
    label: '棚拍', zenith: 0x191d22, horizon: 0x474e56, ground: 0x15181c,
    sun: [0.62, 0.82, 0.38], sunCol: 0xffffff, sunI: 3.5, skySunI: 0, haze: 0.0, cloud: 0.0,
    hemi: [0x475262, 0x1a1d22, 1.05], fill: 1.3, exposure: 1.06, bloom: 0.36, fog: [0x1b1f24, 0.0032],
    padRough: 0.58, padTint: 0.62,
  },
};

/* --------------------------------------------------------------- 场景搭建 */
function buildScene(renderer, canvasEl) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 2, 0.08, 3000);
  camera.position.set(13.2, 5.4, 12.6);

  /* 云噪声 */
  const cloudTex = tex(fbmCanvas(512, { octaves: 6, base: 3, gain: 0.58 }), { repeat: 1 });
  cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;

  /* 天空穹顶 */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), skyMaterial(cloudTex));
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  scene.add(sky);

  /* 环境光照（PMREM 由天空 + 柔光板烘焙） */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 20), skyMaterial(cloudTex));
  envScene.add(envSky);
  const panels = [];
  for (const [px, py, pz, sx, sy, col, inten] of [
    [16, 14, 10, 20, 14, 0xffffff, 2.2],
    [-14, 10, 12, 18, 12, 0xd8e6ff, 0.9],
    [4, 8, -20, 22, 12, 0xfff0dd, 0.7],
  ]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy),
      new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, toneMapped: false }));
    p.material.color.multiplyScalar(inten);
    p.position.set(px, py, pz); p.lookAt(0, 2, 0);
    envScene.add(p); panels.push({ mesh: p, base: inten, col });
  }
  const envGround = new THREE.Mesh(new THREE.PlaneGeometry(300, 300),
    new THREE.MeshBasicMaterial({ color: 0x3a3a34, toneMapped: false }));
  envGround.rotation.x = -PI / 2; envGround.position.y = -0.02;
  envScene.add(envGround);

  /* 光源 */
  const sun = new THREE.DirectionalLight(0xffffff, 3.0);
  sun.castShadow = true;
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  sun.shadow.mapSize.set(lowEnd ? 2048 : 4096, lowEnd ? 2048 : 4096);
  const sc = sun.shadow.camera;
  sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 0.5; sc.far = 60;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.022;
  sun.shadow.radius = 1.6;
  scene.add(sun, sun.target);
  sun.target.position.set(0, 1.6, 0);

  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35);
  fill.position.set(-9, 5, -7);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(-6, 3, 10);
  scene.add(rim);
  const hemi = new THREE.HemisphereLight(0x9fc4e8, 0x4b4a40, 0.55);
  scene.add(hemi);

  /* 地面：混凝土停机坪 + 远景地面 */
  const padMaps = makeHelipad(1536);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(15, 96), new THREE.MeshPhysicalMaterial({
    ...padMaps, color: 0xffffff, roughness: 1.0, metalness: 0.04,
    normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 0.55,
  }));
  pad.rotation.x = -PI / 2;
  pad.position.y = 0.001;
  pad.receiveShadow = true;
  scene.add(pad);

  const terrain = tex(fbmCanvas(512, { octaves: 6, base: 3, gain: 0.6 }), { srgb: true, repeat: 26, aniso: 8 });
  const terrainR = tex(fbmCanvas(256, { octaves: 5, base: 4 }), { repeat: 26 });
  const farGround = new THREE.Mesh(new THREE.CircleGeometry(600, 64), new THREE.MeshStandardMaterial({
    color: 0x6b6a5c, map: terrain, roughnessMap: terrainR, roughness: 1.0, metalness: 0.0,
  }));
  farGround.rotation.x = -PI / 2;
  farGround.position.y = -0.02;
  farGround.receiveShadow = false;
  scene.add(farGround);

  /* 接地软阴影：机体大范围 + 各轮下小范围 */
  const csMap = makeContactShadow();
  const contact = new THREE.Group();
  const addPatch = (w, h, x, z, op) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: csMap, transparent: true, opacity: op, depthWrite: false, color: 0xffffff,
    }));
    m.rotation.x = -PI / 2; m.position.set(x, 0.012, z); m.renderOrder = 1;
    contact.add(m);
    return m;
  };
  addPatch(9.0, 3.0, 0.6, 0, 0.30);
  addPatch(1.5, 1.2, 2.36, 1.10, 0.5);
  addPatch(1.5, 1.2, 2.36, -1.10, 0.5);
  addPatch(0.9, 0.7, -5.79, 0, 0.5);
  scene.add(contact);
  contact.material = { set opacity(v) { contact.children.forEach(c => c.material.opacity = v * (c.geometry.parameters.width > 5 ? 0.55 : 0.9)); } };

  const state = {
    scene, camera, sky, sun, fill, rim, hemi, pad, farGround, contact,
    pmrem, envScene, envSky, panels, cloudTex, envRT: null, preset: 'day',
  };

  applyPreset(state, 'day');
  return state;
}

/* 切换环境预设（同时重新烘焙 PMREM） */
function applyPreset(S, key) {
  const P = ENV_PRESETS[key];
  S.preset = key;
  const sd = new THREE.Vector3(...P.sun).normalize();
  for (const m of [S.sky.material, S.envSky.material]) {
    m.uniforms.uZenith.value.setHex(P.zenith);
    m.uniforms.uHorizon.value.setHex(P.horizon);
    m.uniforms.uGround.value.setHex(P.ground);
    m.uniforms.uSunDir.value.copy(sd);
    m.uniforms.uSunCol.value.setHex(P.sunCol);
    m.uniforms.uHaze.value = P.haze;
    m.uniforms.uCloudAmt.value = P.cloud;
  }
  S.sky.material.uniforms.uSunI.value = P.skySunI;
  S.envSky.material.uniforms.uSunI.value = Math.min(P.skySunI, 18);
  S.sun.position.copy(sd).multiplyScalar(26);
  S.sun.intensity = P.sunI;
  S.sun.color.setHex(P.sunCol);
  S.fill.intensity = P.fill;
  S.rim.intensity = P.fill * 0.9;
  S.hemi.color.setHex(P.hemi[0]);
  S.hemi.groundColor.setHex(P.hemi[1]);
  S.hemi.intensity = P.hemi[2];
  S.scene.fog = new THREE.FogExp2(P.fog[0], P.fog[1]);
  for (const p of S.panels) {
    p.mesh.material.color.setHex(p.col).multiplyScalar(p.base * (key === 'studio' ? 1.6 : key === 'night' ? 0.18 : 1.0));
  }
  S.pad.material.color.setScalar(P.padTint ?? 1.0);
  S.pad.material.roughness = P.padRough ?? 1.0;
  S.pad.material.metalness = key === 'studio' ? 0.35 : 0.04;
  S.pad.material.envMapIntensity = key === 'studio' ? 1.1 : 0.55;
  S.farGround.material.color.setHex(key === 'night' ? 0x23252a : key === 'dusk' ? 0x7a614a : key === 'studio' ? 0x24262a : 0x6b6a5c);
  S.contact.material.opacity = key === 'studio' ? 0.40 : 0.55;
  bakeEnv(S);
  return P;
}

function bakeEnv(S) {
  if (S.envRT) S.envRT.dispose();
  S.envRT = S.pmrem.fromScene(S.envScene, 0.02, 0.5, 200);
  S.scene.environment = S.envRT.texture;
}

/* ------------------------------------------------------------ 后处理链 */
class Composer {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.enabled = true;
    this.bloomStrength = 0.6;
    this.exposure = 1.0;
    this.grain = 0.3;
    this.vignette = 0.6;
    this.chroma = 0.42;

    const rtOpt = {
      type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false,
      colorSpace: THREE.NoColorSpace,
    };
    this.sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpt);
    this.sceneRT.samples = 4;
    this.mipRT = [];
    for (let i = 0; i < 4; i++) {
      this.mipRT.push([
        new THREE.WebGLRenderTarget(2, 2, { ...rtOpt, depthBuffer: false }),
        new THREE.WebGLRenderTarget(2, 2, { ...rtOpt, depthBuffer: false }),
      ]);
    }

    this.bright = new FSQuad(new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uThresh: { value: 1.42 }, uKnee: { value: 0.6 } },
      vertexShader: FS_VERT, depthTest: false, depthWrite: false,
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tSrc; uniform float uThresh, uKnee;
        void main(){
          vec3 c = texture2D(tSrc, vUv).rgb;
          float l = max(c.r, max(c.g, c.b));
          float s = clamp((l - uThresh + uKnee) / (2.0 * uKnee), 0.0, 1.0);
          float w = max(l - uThresh, s * s * uKnee) / max(l, 1e-4);
          gl_FragColor = vec4(c * w, 1.0);
        }`,
    }));
    this.blur = new FSQuad(new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT, depthTest: false, depthWrite: false,
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir, uTexel;
        void main(){
          vec2 o = uDir * uTexel;
          vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;
          c += (texture2D(tSrc, vUv + o * 1.3846).rgb + texture2D(tSrc, vUv - o * 1.3846).rgb) * 0.316216;
          c += (texture2D(tSrc, vUv + o * 3.2307).rgb + texture2D(tSrc, vUv - o * 3.2307).rgb) * 0.070270;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    this.up = new FSQuad(new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null } }, vertexShader: FS_VERT,
      depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tSrc;
        void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }`,
    }));
    this.final = new FSQuad(new THREE.ShaderMaterial({
      uniforms: {
        tSrc: { value: null }, tBloom: { value: null },
        uExposure: { value: 1.0 }, uBloom: { value: 0.6 }, uGrain: { value: 0.5 },
        uVignette: { value: 0.85 }, uChroma: { value: 0.5 }, uTime: { value: 0 },
        uTexel: { value: new THREE.Vector2() },
      },
      vertexShader: FS_VERT, depthTest: false, depthWrite: false,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tSrc, tBloom;
        uniform float uExposure, uBloom, uGrain, uVignette, uChroma, uTime;
        uniform vec2 uTexel;
        vec3 aces(vec3 x){
          const mat3 M1 = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
          const mat3 M2 = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
          vec3 v = M1 * x;
          vec3 a = v * (v + 0.0245786) - 0.000090537;
          vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
          return clamp(M2 * (a / b), 0.0, 1.0);
        }
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec2 uv = vUv;
          vec2 d = uv - 0.5;
          float r2 = dot(d, d);
          // 轻微色散
          vec2 off = d * uChroma * 0.0016 * (0.35 + r2);
          vec3 c;
          c.r = texture2D(tSrc, uv + off).r;
          c.g = texture2D(tSrc, uv).g;
          c.b = texture2D(tSrc, uv - off).b;
          c += texture2D(tBloom, uv).rgb * uBloom;
          c *= uExposure;
          c = aces(c);
          // 暗角
          c *= mix(1.0, smoothstep(0.86, 0.18, r2 * 1.55), uVignette);
          // 胶片颗粒
          float g = hash(uv * 1024.0 + fract(uTime) * 91.7) - 0.5;
          c += g * uGrain * 0.016;
          // sRGB
          vec3 s = mix(c * 12.92, 1.055 * pow(max(c, vec3(1e-5)), vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
          gl_FragColor = vec4(s, 1.0);
        }`,
    }));
  }
  setSize(w, h, dpr) {
    const W = Math.max(2, Math.floor(w * dpr)), H = Math.max(2, Math.floor(h * dpr));
    this.W = W; this.H = H;
    this.sceneRT.setSize(W, H);
    let sw = W, sh = H;
    for (let i = 0; i < this.mipRT.length; i++) {
      sw = Math.max(2, Math.floor(sw / 2)); sh = Math.max(2, Math.floor(sh / 2));
      this.mipRT[i][0].setSize(sw, sh);
      this.mipRT[i][1].setSize(sw, sh);
    }
    this.final.material.uniforms.uTexel.value.set(1 / W, 1 / H);
  }
  render(time) {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(this.scene, this.camera);
      return;
    }
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(this.scene, this.camera);
    this.calls = r.info.render.calls;

    let src = this.sceneRT.texture;
    const useBloom = this.bloomStrength > 0.001;
    if (useBloom) {
      // 亮部提取 → 第 0 级
      this.bright.material.uniforms.tSrc.value = src;
      this.bright.render(r, this.mipRT[0][0]);
      // 逐级模糊 + 下采样
      for (let i = 0; i < this.mipRT.length; i++) {
        const [a, b] = this.mipRT[i];
        const w = a.width, h = a.height;
        if (i > 0) {
          this.up.material.blending = THREE.NoBlending;
          this.up.material.uniforms.tSrc.value = this.mipRT[i - 1][0].texture;
          this.up.render(r, a);
        }
        this.blur.material.uniforms.tSrc.value = a.texture;
        this.blur.material.uniforms.uDir.value.set(1, 0);
        this.blur.material.uniforms.uTexel.value.set(1 / w, 1 / h);
        this.blur.render(r, b);
        this.blur.material.uniforms.tSrc.value = b.texture;
        this.blur.material.uniforms.uDir.value.set(0, 1);
        this.blur.render(r, a);
      }
      // 由小到大累加
      for (let i = this.mipRT.length - 1; i > 0; i--) {
        this.up.material.blending = THREE.AdditiveBlending;
        this.up.material.uniforms.tSrc.value = this.mipRT[i][0].texture;
        r.setRenderTarget(this.mipRT[i - 1][0]);
        r.render(this.up.scene, this.up.camera);
      }
    }
    const u = this.final.material.uniforms;
    u.tSrc.value = src;
    u.tBloom.value = useBloom ? this.mipRT[0][0].texture : null;
    u.uBloom.value = useBloom ? this.bloomStrength : 0;
    u.uExposure.value = this.exposure;
    u.uGrain.value = this.grain;
    u.uVignette.value = this.vignette;
    u.uChroma.value = this.chroma;
    u.uTime.value = time;
    r.setRenderTarget(null);
    this.final.render(r, null);
  }
}
