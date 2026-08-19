/* =========================================================================
   天空 · 太阳 · 环境光照（解析大气 + 云 + 星空，PMREM 生成环境反射）
   ========================================================================= */

// 与水面共用的天空着色器函数
const SKY_GLSL = /* glsl */`
uniform vec3 uSun, uZen, uHz, uSunC;
uniform float uNight, uT, uCloud;

float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y);
}
float fb(vec2 p){
  float s=0.0, a=0.5;
  for(int i=0;i<6;i++){ s+=a*vn(p); p=p*2.03+vec2(13.1,7.7); a*=0.5; }
  return s;
}
vec3 skyColor(vec3 d, float withClouds){
  float h = d.y;
  float t = pow(clamp(h*1.05+0.02, 0.0, 1.0), 0.68);
  vec3 col = mix(uHz, uZen, t);
  // 地平线厚重气溶胶（收窄，避免整片泛白）
  col = mix(col, uHz*1.02, pow(clamp(1.0-abs(h)*5.2,0.0,1.0), 3.0)*0.40);
  float mu = dot(normalize(d), uSun);
  // 前向散射（太阳周围晕）
  col += uSunC * pow(clamp(mu,0.0,1.0), 8.0) * 0.17 * (1.0-uNight*0.85);
  col += uSunC * pow(clamp(mu,0.0,1.0), 46.0) * 0.52 * (1.0-uNight*0.9);
  // 太阳/月亮本体（含 HDR 过曝，供泛光提取）
  float disk = smoothstep(0.99955, 0.99985, mu);
  col += uSunC * disk * mix(46.0, 6.0, uNight) * step(-0.06, uSun.y);
  // 星空
  if(uNight > 0.01){
    vec3 sd = d/max(abs(d.y)*0.35+0.35, 0.001);
    vec2 g = floor(sd.xz*46.0);
    float st = hh(g);
    float tw = 0.6+0.4*sin(uT*2.1+st*40.0);
    float bright = smoothstep(0.9955, 0.9995, st) * tw;
    col += vec3(0.85,0.9,1.0)*bright*2.6*uNight*smoothstep(-0.02,0.25,h);
  }
  // 云层（把方向投影到高空平面）
  if(withClouds > 0.5 && h > 0.004){
    vec2 pp = d.xz/max(h,0.004);
    vec2 uv = pp*0.0021 + vec2(uT*0.0032, uT*0.0011);
    float f = fb(uv*1.7);
    float f2 = fb(uv*4.3+vec2(5.0,2.0));
    float cov = smoothstep(0.52-uCloud*0.26, 0.93, f*0.72+f2*0.28);
    cov *= smoothstep(0.006, 0.10, h);            // 地平线附近压扁
    cov *= smoothstep(0.0, 0.35, 1.0-length(pp)*0.00016); // 远处淡出
    float lit = pow(clamp(mu*0.5+0.5,0.0,1.0), 2.6);
    vec3 cl = mix(mix(uHz*0.55, uZen*0.5, 0.4), vec3(1.0,0.96,0.92), 0.55+0.45*lit);
    cl = mix(cl, uSunC*1.25, lit*0.55*(1.0-uNight));
    cl *= mix(0.30, 1.0, 1.0-uNight*0.86);
    col = mix(col, cl, cov*0.9);
  }
  return col;
}`;

let sky, skyMat, skyProbe, pmrem, envRT = null;
let sun, hemi, fillLight;

function skyUniforms() {
  return {
    uSun: { value: new THREE.Vector3(0.4, 0.2, -0.9) },
    uZen: { value: new THREE.Color(0x2c5f9e) },
    uHz: { value: new THREE.Color(0xdcc0a0) },
    uSunC: { value: new THREE.Color(0xffd0a0) },
    uNight: { value: 0 }, uT: { value: 0 }, uCloud: { value: 0.5 },
  };
}
const SKY_U = skyUniforms();

function buildSky(scene) {
  skyMat = new THREE.ShaderMaterial({
    uniforms: SKY_U, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: SKY_GLSL + `varying vec3 vD;
      void main(){ gl_FragColor = vec4(max(skyColor(normalize(vD), 1.0), vec3(0.0)), 1.0); }`,
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), skyMat);
  sky.scale.setScalar(24000); sky.renderOrder = -1000; sky.frustumCulled = false;
  scene.add(sky);

  // PMREM 用的小球（同材质，独立场景，避免远裁剪问题）
  skyProbe = new THREE.Scene();
  const p = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 20), skyMat);
  skyProbe.add(p);

  // 太阳（主平行光 + 阴影）
  sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 6500;
  sun.shadow.bias = -0.00022; sun.shadow.normalBias = 0.9;
  sun.shadow.blurSamples = 12;
  scene.add(sun); scene.add(sun.target);

  hemi = new THREE.HemisphereLight(0x9dbbe0, 0x4a4235, 0.55);
  scene.add(hemi);
  // 逆光补光（模拟大气多次散射，让暗面不死黑）
  fillLight = new THREE.DirectionalLight(0x9fc0e6, 0.35);
  scene.add(fillLight);
}

/* 按太阳高度角插值的色板：正午 → 黄金时刻 → 日落 → 蓝调 → 夜 */
const KEYS = [
  { e: -14, zen: 0x02040c, hz: 0x08101f, sun: 0x6f86bb, i: 0.02, hemi: 0.16, fill: 0.10, night: 1.0, expo: 1.30, cloud: 0.35 },
  { e: -6, zen: 0x081026, hz: 0x1b2742, sun: 0xa38ab0, i: 0.10, hemi: 0.30, fill: 0.16, night: 0.85, expo: 1.22, cloud: 0.4 },
  { e: -1.5, zen: 0x122a56, hz: 0xa9503c, sun: 0xff8a4a, i: 0.60, hemi: 0.44, fill: 0.26, night: 0.30, expo: 1.10, cloud: 0.5 },
  { e: 2.5, zen: 0x17407c, hz: 0xdd7440, sun: 0xffa860, i: 2.30, hemi: 0.60, fill: 0.34, night: 0.06, expo: 0.98, cloud: 0.5 },
  { e: 8, zen: 0x1d5093, hz: 0xe8a276, sun: 0xffd2a0, i: 3.20, hemi: 0.70, fill: 0.38, night: 0.0, expo: 0.92, cloud: 0.48 },
  { e: 20, zen: 0x235aa6, hz: 0xc6d2da, sun: 0xfff0d8, i: 3.60, hemi: 0.88, fill: 0.42, night: 0.0, expo: 0.88, cloud: 0.44 },
  { e: 45, zen: 0x2867bd, hz: 0xbcd0e2, sun: 0xfffaf0, i: 3.95, hemi: 1.05, fill: 0.46, night: 0.0, expo: 0.85, cloud: 0.4 },
  { e: 70, zen: 0x2867bd, hz: 0xbcd0e2, sun: 0xffffff, i: 4.05, hemi: 1.15, fill: 0.48, night: 0.0, expo: 0.84, cloud: 0.4 },
];
const _cA = new THREE.Color(), _cB = new THREE.Color();
function palette(elev) {
  let i = 0; while (i < KEYS.length - 2 && elev > KEYS[i + 1].e) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = clamp((elev - a.e) / (b.e - a.e), 0, 1);
  const mix = (ka, kb) => _cA.setHex(ka).lerp(_cB.setHex(kb), t).clone();
  return {
    zen: mix(a.zen, b.zen), hz: mix(a.hz, b.hz), sunC: mix(a.sun, b.sun),
    i: lerp(a.i, b.i, t), hemi: lerp(a.hemi, b.hemi, t), fill: lerp(a.fill, b.fill, t),
    night: lerp(a.night, b.night, t), expo: lerp(a.expo, b.expo, t), cloud: lerp(a.cloud, b.cloud, t),
  };
}

/* 由钟点求太阳方向：北=+X 东=+Z（旧金山 37.8°N 夏季近似） */
function sunDirection(hour) {
  const t = (hour - 6) / 13.6;                      // 日出 6:00 日落 19:36
  const elev = Math.sin(clamp(t, -0.6, 1.6) * Math.PI) * 62 - (t < 0 || t > 1 ? 0 : 0);
  const az = lerp(68, 292, clamp(t, -0.15, 1.15));  // ENE → WNW
  const e = elev * Math.PI / 180, a = az * Math.PI / 180;
  return { v: new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)), elev };
}

let envDirty = true, envTimer = 0;
function updateSky(scene, renderer, dt) {
  const sd = sunDirection(S.hour), P = palette(sd.elev);
  S.sun.copy(sd.v); S.night = P.night;
  S.hz.copy(P.hz); S.zen.copy(P.zen); S.sunC.copy(P.sunC); S.sunI = P.i; S.expo = P.expo;

  SKY_U.uSun.value.copy(sd.v);
  SKY_U.uZen.value.copy(P.zen); SKY_U.uHz.value.copy(P.hz); SKY_U.uSunC.value.copy(P.sunC);
  SKY_U.uNight.value = P.night; SKY_U.uCloud.value = P.cloud; SKY_U.uT.value = S.t;

  // 太阳灯：接近地平线时压低并加暖
  sun.position.copy(sd.v).multiplyScalar(3000);
  sun.intensity = P.i;
  sun.color.copy(P.sunC).lerp(_cA.setHex(0xffffff), 0.25);
  hemi.intensity = P.hemi; hemi.color.copy(P.zen).lerp(_cA.setHex(0xffffff), 0.45); hemi.groundColor.copy(P.hz).lerp(_cA.setHex(0x4a4030), 0.6);
  fillLight.intensity = P.fill;
  fillLight.position.set(-sd.v.x * 1000 + 400, 900, -sd.v.z * 1000);
  fillLight.color.copy(P.zen).lerp(_cA.setHex(0xffffff), 0.5);

  // 雾：水平色 + 太阳方向暖调
  const fogC = _cA.copy(P.hz).lerp(P.sunC, 0.20 * (1 - P.night));
  scene.fog.color.copy(fogC);
  scene.fog.density = 0.000042 + S.fog * 0.00026 + P.night * 0.00002;
  scene.background = null;

  envTimer += dt;
  if (envDirty && envTimer > 0.16) { regenEnv(renderer, scene); envTimer = 0; envDirty = false; }
}
function regenEnv(renderer, scene) {
  if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(skyProbe, 0, 0.1, 200);
  if (envRT) envRT.dispose();
  envRT = rt; scene.environment = rt.texture;
}
