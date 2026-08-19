/* ==========================================================================
   RAFT SURVIVAL · world.js
   天空 / 太阳月亮 / 星空 / 云 / Gerstner 波浪海洋 / 昼夜 / 天气 / 雨与闪电
   ========================================================================== */
RS.World = function (game) {
  const U = RS.U, T = RS.Tex;
  const scene = game.scene;
  const self = this;

  /* ------------------------------------------------------- 波浪定义（JS 与 GLSL 必须一致） */
  const WAVES = [
    { dx: 1.00, dz: 0.35, A: 0.42, L: 26.0, S: 1.00 },
    { dx: -0.60, dz: 1.00, A: 0.26, L: 16.0, S: 1.30 },
    { dx: 0.30, dz: -1.00, A: 0.15, L: 9.0, S: 1.75 },
    { dx: -1.00, dz: -0.40, A: 0.085, L: 5.0, S: 2.30 }
  ];
  WAVES.forEach(w => { const l = Math.hypot(w.dx, w.dz); w.dx /= l; w.dz /= l; w.k = U.TAU / w.L; w.w = Math.sqrt(9.8 * w.k) * w.S; });

  this.waveScale = 1.0;      // 天气放大系数
  this.time = 0;             // 波浪时间累积
  this.timeOfDay = 7.2;      // 0-24
  this.day = 1;
  this.dayLength = 600;      // 一整天 600 秒（10 分钟）
  this.windDir = U.rand(0, U.TAU);
  this.windSpeed = 1.0;
  this.weather = 'clear';
  this.rainAmount = 0;
  this.stormFactor = 0;
  this.underwater = false;

  /* 水面高度（浮力/游泳都用这个） */
  this.waterY = function (x, z) {
    let h = 0;
    const s = self.waveScale;
    for (let i = 0; i < 4; i++) {
      const w = WAVES[i];
      h += w.A * s * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * self.time);
    }
    return h;
  };
  /* 水面法线（近似，用于木筏姿态） */
  this.waterNormal = function (x, z) {
    const e = 0.6;
    const hL = self.waterY(x - e, z), hR = self.waterY(x + e, z);
    const hD = self.waterY(x, z - e), hU = self.waterY(x, z + e);
    const n = new THREE.Vector3(hL - hR, 2 * e, hD - hU);
    return n.normalize();
  };

  /* ----------------------------------------------------------------- 天空 */
  const skyGeo = new THREE.SphereGeometry(3200, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2f7fd0) },
      midColor: { value: new THREE.Color(0x7fc4e8) },
      botColor: { value: new THREE.Color(0xa8e0f5) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color(0xfff2c4) },
      sunSize: { value: 0.9992 },
      cloudy: { value: 0.0 }
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 topColor,midColor,botColor,sunColor; uniform vec3 sunDir;
      uniform float sunSize, cloudy; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y*0.5+0.5, 0.0, 1.0);
        vec3 col = mix(botColor, midColor, smoothstep(0.42,0.56,h));
        col = mix(col, topColor, smoothstep(0.54,0.92,h));
        // 地平线雾带
        col = mix(col, mix(botColor,vec3(1.0),0.22), pow(1.0-abs(vDir.y),9.0)*0.55);
        // 太阳
        float d = dot(normalize(vDir), normalize(sunDir));
        float disc = smoothstep(sunSize, sunSize+0.0006, d);
        float glow = pow(max(d,0.0), 220.0)*0.9 + pow(max(d,0.0), 14.0)*0.30;
        col += sunColor*(disc*2.4 + glow);
        col = mix(col, vec3(0.42,0.46,0.50)*(0.3+0.7*h), cloudy*0.62);
        gl_FragColor = vec4(col,1.0);
      }`
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  /* ------------------------------------------------------------- 星空 */
  const starN = 900, starPos = new Float32Array(starN * 3), starSize = new Float32Array(starN);
  for (let i = 0; i < starN; i++) {
    const u = Math.random() * U.TAU, v = Math.acos(U.rand(-.15, 1));
    const r = 2600;
    starPos[i * 3] = Math.sin(v) * Math.cos(u) * r;
    starPos[i * 3 + 1] = Math.cos(v) * r;
    starPos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
    starSize[i] = U.rand(6, 22);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('sz', new THREE.BufferAttribute(starSize, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { op: { value: 0 }, tex: { value: T.glow() } },
    vertexShader: `attribute float sz; varying float vs;
      void main(){ vs=sz; vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize = sz*(700.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float op; uniform sampler2D tex; varying float vs;
      void main(){ vec4 t=texture2D(tex,gl_PointCoord); gl_FragColor=vec4(t.rgb, t.a*op); }`
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  /* ------------------------------------------------------- 太阳 / 月亮 精灵 */
  function glowSprite(color, scale) {
    const m = new THREE.SpriteMaterial({ map: T.glow(), color: color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m); s.scale.setScalar(scale); return s;
  }
  const sunSprite = glowSprite(0xffe9a8, 620); scene.add(sunSprite);
  const moonSprite = glowSprite(0xcfe4ff, 330); scene.add(moonSprite);

  /* ---------------------------------------------------------------- 云 */
  const clouds = new THREE.Group(); scene.add(clouds);
  const cloudMat = new THREE.SpriteMaterial({ map: T.cloud(), transparent: true, depthWrite: false, opacity: .55 });
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(cloudMat.clone());
    const a = U.rand(0, U.TAU), r = U.rand(400, 1500);
    s.position.set(Math.cos(a) * r, U.rand(150, 420), Math.sin(a) * r);
    const sc = U.rand(220, 620);
    s.scale.set(sc, sc * U.rand(.4, .62), 1);
    s.material.opacity = U.rand(.3, .6);
    s.userData.sp = U.rand(.4, 1.5);
    clouds.add(s);
  }

  /* ---------------------------------------------------------------- 光照 */
  const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x2b6d78, .85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0cf, 1.5);
  sun.position.set(60, 120, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.near = 1; sc.far = 340; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x9fd8ff, .28);
  fill.position.set(-40, 30, -60); scene.add(fill);
  const lightning = new THREE.PointLight(0xdfeaff, 0, 900); lightning.position.set(0, 200, 0); scene.add(lightning);

  /* ---------------------------------------------------------------- 海洋 */
  const OCEAN_SIZE = 620, OCEAN_SEG = 260;
  const oceanGeo = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEG, OCEAN_SEG);
  oceanGeo.rotateX(-Math.PI / 2);

  const waveUni = [];
  WAVES.forEach(w => waveUni.push(new THREE.Vector4(w.dx, w.dz, w.A, w.k), new THREE.Vector4(w.w, 0, 0, 0)));

  const oceanMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1 },
      uDeep: { value: new THREE.Color(0x073b52) },
      uShallow: { value: new THREE.Color(0x1fa3ad) },
      uFoam: { value: new THREE.Color(0xf2fbff) },
      uSkyTop: { value: new THREE.Color(0x2f7fd0) },
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(0xfff0c0) },
      uCam: { value: new THREE.Vector3() },
      uDetail: { value: T.waterDetail(9, 9) },
      uIslands: { value: [new THREE.Vector4(1e6, 0, 1, 0), new THREE.Vector4(1e6, 0, 1, 0), new THREE.Vector4(1e6, 0, 1, 0), new THREE.Vector4(1e6, 0, 1, 0)] },
      uWaveA: { value: [waveUni[0], waveUni[2], waveUni[4], waveUni[6]] },
      uWaveB: { value: [waveUni[1], waveUni[3], waveUni[5], waveUni[7]] },
      uFogColor: { value: new THREE.Color(0x9fc9dd) },
      uFogDensity: { value: 0.0035 },
      uNight: { value: 0 }
    },
    vertexShader: `
      uniform float uTime,uScale; uniform vec4 uWaveA[4]; uniform vec4 uWaveB[4];
      varying vec3 vWorld; varying float vCrest; varying vec3 vNormal2;
      float wh(vec2 p){
        float h=0.0;
        for(int i=0;i<4;i++){ h += uWaveA[i].z*uScale*sin(uWaveA[i].w*dot(uWaveA[i].xy,p)-uWaveB[i].x*uTime); }
        return h;
      }
      void main(){
        vec4 wp = modelMatrix*vec4(position,1.0);
        float h = wh(wp.xz);
        wp.y += h;
        float e=0.75;
        float hl=wh(wp.xz-vec2(e,0.0)), hr=wh(wp.xz+vec2(e,0.0));
        float hd=wh(wp.xz-vec2(0.0,e)), hu=wh(wp.xz+vec2(0.0,e));
        vNormal2 = normalize(vec3(hl-hr, 2.0*e, hd-hu));
        vCrest = clamp((h/(0.9*uScale))*0.5+0.5, 0.0, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix*viewMatrix*wp;
      }`,
    fragmentShader: `
      uniform vec3 uDeep,uShallow,uFoam,uSkyTop,uSunColor,uCam,uFogColor; uniform vec3 uSun;
      uniform float uTime,uFogDensity,uNight; uniform sampler2D uDetail; uniform vec4 uIslands[4];
      varying vec3 vWorld; varying float vCrest; varying vec3 vNormal2;
      void main(){
        vec2 p = vWorld.xz;
        // 细节法线扰动
        vec3 d1 = texture2D(uDetail, p*0.021 + vec2(uTime*0.011, uTime*0.008)).rgb-0.5;
        vec3 d2 = texture2D(uDetail, p*0.061 - vec2(uTime*0.019, uTime*0.014)).rgb-0.5;
        vec3 N = normalize(vNormal2 + vec3(d1.r+d2.r*0.6, 0.0, d1.b+d2.b*0.6)*1.5);
        vec3 V = normalize(uCam - vWorld);
        float fres = pow(1.0-max(dot(N,V),0.0), 4.0);

        // 近岛浅水
        float shallow = 0.0;
        for(int i=0;i<4;i++){
          float dd = length(p-uIslands[i].xy);
          shallow = max(shallow, 1.0-smoothstep(uIslands[i].z*0.55, uIslands[i].z*1.55, dd));
        }
        vec3 base = mix(uDeep, uShallow, 0.32+0.55*shallow);
        base = mix(base, vec3(0.55,0.85,0.80), shallow*0.35);

        // 天空反射
        vec3 refl = mix(uSkyTop, vec3(1.0), 0.25);
        vec3 col = mix(base, refl, clamp(fres*0.9,0.0,0.85));

        // 高光
        vec3 H = normalize(normalize(uSun)+V);
        float spec = pow(max(dot(N,H),0.0), 220.0);
        col += uSunColor*spec*2.6;
        float sheen = pow(max(dot(N,H),0.0), 22.0);
        col += uSunColor*sheen*0.18;

        // 浪尖泡沫
        float fo = smoothstep(0.80,0.99,vCrest);
        float fnoise = texture2D(uDetail, p*0.10 + vec2(uTime*0.02,0.0)).g;
        col = mix(col, uFoam, fo*(0.35+0.5*fnoise));
        // 靠岸白浪
        float sf = smoothstep(0.72,1.0,shallow)*(0.4+0.6*fnoise);
        col = mix(col, uFoam, sf*0.7);

        col *= mix(1.0, 0.30, uNight);

        // 距离雾
        float dist = length(uCam-vWorld);
        float f = 1.0-exp(-uFogDensity*uFogDensity*dist*dist);
        col = mix(col, uFogColor, clamp(f,0.0,1.0));
        float alpha = mix(0.94, 1.0, clamp(dist/60.0,0.0,1.0));
        gl_FragColor = vec4(col, alpha);
      }`
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.frustumCulled = false;
  ocean.renderOrder = 1;
  scene.add(ocean);
  this.ocean = ocean;

  /* 远海（无位移的巨大平面，遮住近海边缘；开启雾以融入地平线） */
  const farMat = new THREE.MeshBasicMaterial({ color: 0x0a4358 });
  const farSea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), farMat);
  farSea.rotation.x = -Math.PI / 2; farSea.position.y = -0.35;
  farSea.frustumCulled = false;
  scene.add(farSea);

  /* 水下体积（从下面看水面） */
  const underMat = new THREE.MeshBasicMaterial({ color: 0x0a5f74, transparent: true, opacity: .35, side: THREE.BackSide, fog: false });
  const underDome = new THREE.Mesh(new THREE.SphereGeometry(300, 16, 12), underMat);
  underDome.visible = false; scene.add(underDome);

  /* 海底（浅水区可见） */
  const floorMat = new THREE.MeshStandardMaterial({ map: T.sand(28, 28), color: 0x9fb0a0, roughness: 1 });
  const seaFloor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 40, 40), floorMat);
  seaFloor.rotation.x = -Math.PI / 2;
  seaFloor.position.y = -26;
  const fp = seaFloor.geometry.attributes.position;
  const nz = U.makeNoise2D(991);
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), y = fp.getY(i);
    fp.setZ(i, U.fbm(nz, x * .01, y * .01, 4, 2, .5) * 6);
  }
  seaFloor.geometry.computeVertexNormals();
  seaFloor.receiveShadow = true;
  scene.add(seaFloor);
  this.seaFloor = seaFloor;

  /* ---------------------------------------------------------------- 雨 */
  const RAIN_N = 4000;
  const rainPos = new Float32Array(RAIN_N * 3);
  const rainVel = new Float32Array(RAIN_N);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = U.rand(-45, 45);
    rainPos[i * 3 + 1] = U.rand(0, 45);
    rainPos[i * 3 + 2] = U.rand(-45, 45);
    rainVel[i] = U.rand(26, 42);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({ color: 0xcfe8f5, size: .16, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.frustumCulled = false; scene.add(rain);

  /* 海鸥（简单剪影） */
  const birds = new THREE.Group(); scene.add(birds);
  const birdMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .3), birdMat);
    const wr = wl.clone();
    wl.position.x = -.85; wr.position.x = .85;
    g.add(wl, wr);
    g.userData = { wl, wr, a: U.rand(0, U.TAU), r: U.rand(40, 120), y: U.rand(22, 46), sp: U.rand(.1, .26), ph: U.rand(0, 9) };
    birds.add(g);
  }

  /* ---------------------------------------------------- 昼夜颜色关键帧 */
  const KEY = [
    { t: 0, top: 0x040a18, mid: 0x081428, bot: 0x0b2036, fog: 0x0a1a2a, sun: 0x8fa6d0, hemiS: 0x2a3f66, hemiG: 0x101f2b, int: .06, hemi: .22, deep: 0x03151f, shal: 0x0a4552 },
    { t: 5, top: 0x123055, mid: 0x3a5f8f, bot: 0x8f6f7a, fog: 0x5a6a80, sun: 0xffb08a, hemiS: 0x6a7fa8, hemiG: 0x2c4a52, int: .35, hemi: .45, deep: 0x0a3348, shal: 0x1c7f8c },
    { t: 7, top: 0x2a6fb8, mid: 0x84c2e4, bot: 0xf0c9a0, fog: 0xc3d6e0, sun: 0xffd9a8, hemiS: 0xbfe6ff, hemiG: 0x3e7a80, int: 1.15, hemi: .8, deep: 0x074258, shal: 0x1fa3ad },
    { t: 12, top: 0x2478cc, mid: 0x79c0ea, bot: 0xb6e6f8, fog: 0xb8dcea, sun: 0xfff4d8, hemiS: 0xcdefff, hemiG: 0x2f7d84, int: 1.65, hemi: .95, deep: 0x0a4a63, shal: 0x25b7bf },
    { t: 17, top: 0x2a6ab0, mid: 0x7fb8dc, bot: 0xf2c091, fog: 0xd6c2b0, sun: 0xffca8f, hemiS: 0xc0dcf0, hemiG: 0x386f78, int: 1.0, hemi: .7, deep: 0x08405a, shal: 0x1e9aa6 },
    { t: 19.5, top: 0x1a3f74, mid: 0x4a4f86, bot: 0xd4735a, fog: 0x7a6478, sun: 0xff8a5c, hemiS: 0x7a86ad, hemiG: 0x24505c, int: .38, hemi: .42, deep: 0x05283a, shal: 0x136675 },
    { t: 21.5, top: 0x061024, mid: 0x0d1b34, bot: 0x142a44, fog: 0x142334, sun: 0x9fb0d8, hemiS: 0x334a72, hemiG: 0x122430, int: .10, hemi: .26, deep: 0x03161f, shal: 0x0b4a56 },
    { t: 24, top: 0x040a18, mid: 0x081428, bot: 0x0b2036, fog: 0x0a1a2a, sun: 0x8fa6d0, hemiS: 0x2a3f66, hemiG: 0x101f2b, int: .06, hemi: .22, deep: 0x03151f, shal: 0x0a4552 }
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();
  function keyLerp(t) {
    let i = 0;
    while (i < KEY.length - 2 && KEY[i + 1].t <= t) i++;
    const a = KEY[i], b = KEY[i + 1];
    const k = U.clamp((t - a.t) / (b.t - a.t), 0, 1);
    function col(pa, pb) { cA.setHex(pa); cB.setHex(pb); return cA.clone().lerp(cB, k); }
    return {
      top: col(a.top, b.top), mid: col(a.mid, b.mid), bot: col(a.bot, b.bot),
      fog: col(a.fog, b.fog), sun: col(a.sun, b.sun),
      hemiS: col(a.hemiS, b.hemiS), hemiG: col(a.hemiG, b.hemiG),
      deep: col(a.deep, b.deep), shal: col(a.shal, b.shal),
      int: U.lerp(a.int, b.int, k), hemi: U.lerp(a.hemi, b.hemi, k)
    };
  }

  scene.fog = new THREE.FogExp2(0xb8dcea, 0.0035);

  /* --------------------------------------------------------- 天气状态机 */
  let weatherTimer = U.rand(60, 140);
  const WTYPES = ['clear', 'clear', 'cloudy', 'cloudy', 'rain', 'storm'];
  function pickWeather() {
    let w = U.choice(WTYPES);
    if (w === self.weather) w = U.choice(WTYPES);
    self.weather = w;
    weatherTimer = w === 'storm' ? U.rand(50, 100) : U.rand(90, 200);
    self.windDir += U.rand(-1.2, 1.2);
    game.bus.emit('weather', w);
    if (w === 'storm') game.ui.toast('☁ 暴风雨来了，抓紧木筏！', 'warn');
    else if (w === 'rain') game.ui.toast('🌧 开始下雨了', '');
    else if (w === 'clear') game.ui.toast('☀ 天气转晴', 'good');
  }

  let lightTimer = 0, birdTimer = 8, whaleTimer = 60;

  /* ---------------------------------------------------------------- 更新 */
  this.update = function (dt, camPos) {
    // 时间推进
    const tScale = 24 / self.dayLength;
    self.timeOfDay += dt * tScale;
    if (self.timeOfDay >= 24) { self.timeOfDay -= 24; self.day++; game.bus.emit('newday', self.day); }

    // 天气
    weatherTimer -= dt;
    if (weatherTimer <= 0) pickWeather();
    const wantRain = self.weather === 'rain' ? .55 : self.weather === 'storm' ? 1 : 0;
    self.rainAmount = U.damp(self.rainAmount, wantRain, .5, dt);
    const wantStorm = self.weather === 'storm' ? 1 : self.weather === 'rain' ? .35 : 0;
    self.stormFactor = U.damp(self.stormFactor, wantStorm, .35, dt);
    self.waveScale = 1 + self.stormFactor * 1.9;
    self.windSpeed = U.damp(self.windSpeed, .8 + self.stormFactor * 2.2 + (self.weather === 'cloudy' ? .3 : 0), .4, dt);
    self.windDir += dt * .006 * Math.sin(self.time * .05);

    self.time += dt * (1 + self.stormFactor * .25);

    // 颜色
    const K = keyLerp(self.timeOfDay);
    const cloudy = U.clamp((self.weather === 'cloudy' ? .55 : 0) + self.stormFactor * .95, 0, 1);
    const nightF = U.clamp(1 - K.int / 1.1, 0, 1);

    skyMat.uniforms.topColor.value.copy(K.top);
    skyMat.uniforms.midColor.value.copy(K.mid);
    skyMat.uniforms.botColor.value.copy(K.bot);
    skyMat.uniforms.sunColor.value.copy(K.sun);
    skyMat.uniforms.cloudy.value = cloudy;

    // 太阳方位
    const ang = (self.timeOfDay - 6) / 24 * U.TAU;
    const sdir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), .28).normalize();
    skyMat.uniforms.sunDir.value.copy(sdir);
    sun.position.copy(camPos).addScaledVector(sdir, 160);
    sun.target.position.copy(camPos);
    sun.color.copy(K.sun);
    sun.intensity = K.int * (1 - cloudy * .62);
    hemi.color.copy(K.hemiS); hemi.groundColor.copy(K.hemiG);
    hemi.intensity = K.hemi * (1 - cloudy * .25);
    fill.intensity = .1 + (1 - nightF) * .2;

    sunSprite.position.copy(camPos).addScaledVector(sdir, 2400);
    sunSprite.material.opacity = U.clamp(sdir.y * 3 + .2, 0, 1) * (1 - cloudy * .8);
    const mdir = sdir.clone().negate();
    moonSprite.position.copy(camPos).addScaledVector(mdir, 2400);
    moonSprite.material.opacity = U.clamp(mdir.y * 3, 0, 1) * (1 - cloudy * .7);
    starMat.uniforms.op.value = U.clamp(nightF * 1.25 - .18, 0, 1) * (1 - cloudy * .9);
    stars.position.copy(camPos);
    stars.rotation.y = self.timeOfDay / 24 * U.TAU * .5;
    sky.position.copy(camPos);
    farSea.position.x = camPos.x; farSea.position.z = camPos.z;

    // 雾
    const fogC = K.fog.clone().lerp(new THREE.Color(0x59707c), cloudy * .5);
    scene.fog.color.copy(fogC);
    scene.fog.density = self.underwater ? .055 : U.lerp(.0032, .012, self.stormFactor);
    if (self.underwater) scene.fog.color.setHex(0x0a5a72);
    game.renderer.setClearColor(scene.fog.color);

    // 海洋 uniform
    const ou = oceanMat.uniforms;
    ou.uTime.value = self.time;
    ou.uScale.value = self.waveScale;
    ou.uDeep.value.copy(K.deep); ou.uShallow.value.copy(K.shal);
    ou.uSkyTop.value.copy(K.mid);
    ou.uSun.value.copy(sdir); ou.uSunColor.value.copy(K.sun);
    ou.uCam.value.copy(camPos);
    ou.uFogColor.value.copy(scene.fog.color);
    ou.uFogDensity.value = scene.fog.density;
    ou.uNight.value = nightF * .8;
    // 近海跟随（对齐到网格避免顶点抖动）
    const cell = OCEAN_SIZE / OCEAN_SEG;
    ocean.position.x = Math.round(camPos.x / cell) * cell;
    ocean.position.z = Math.round(camPos.z / cell) * cell;
    seaFloor.position.x = ocean.position.x; seaFloor.position.z = ocean.position.z;

    // 云
    clouds.position.set(camPos.x, 0, camPos.z);
    clouds.rotation.y += dt * .004 * self.windSpeed;
    clouds.children.forEach(c => {
      c.material.opacity = U.damp(c.material.opacity, U.lerp(.16, .8, cloudy) * (1 - nightF * .55), .6, dt);
      c.material.color.copy(K.mid).lerp(new THREE.Color(0xffffff), 1 - cloudy * .7);
    });

    // 雨
    rainMat.opacity = self.rainAmount * .55;
    if (self.rainAmount > .02) {
      const p = rainGeo.attributes.position;
      const wx = Math.cos(self.windDir) * self.windSpeed * 3, wz = Math.sin(self.windDir) * self.windSpeed * 3;
      for (let i = 0; i < RAIN_N; i++) {
        let y = p.getY(i) - rainVel[i] * dt;
        let x = p.getX(i) + wx * dt, z = p.getZ(i) + wz * dt;
        if (y < -2) { y = 45; x = U.rand(-45, 45); z = U.rand(-45, 45); }
        if (x > 48) x -= 96; if (x < -48) x += 96;
        if (z > 48) z -= 96; if (z < -48) z += 96;
        p.setXYZ(i, x, y, z);
      }
      p.needsUpdate = true;
      rain.position.set(camPos.x, 0, camPos.z);
    }
    rain.visible = self.rainAmount > .02;

    // 闪电
    lightning.intensity = Math.max(0, lightning.intensity - dt * 22);
    if (self.weather === 'storm') {
      lightTimer -= dt;
      if (lightTimer <= 0) {
        lightTimer = U.rand(6, 18);
        lightning.position.set(camPos.x + U.rand(-200, 200), 180, camPos.z + U.rand(-200, 200));
        lightning.intensity = U.rand(6, 14);
        setTimeout(() => RS.Audio.play('thunder'), U.rand(300, 1400));
      }
    }

    // 海鸥
    birdTimer -= dt;
    birds.visible = nightF < .5 && self.rainAmount < .3;
    birds.children.forEach(b => {
      const d = b.userData;
      d.a += dt * d.sp * .18;
      b.position.set(camPos.x + Math.cos(d.a) * d.r, d.y + Math.sin(d.a * 2.2 + d.ph) * 3, camPos.z + Math.sin(d.a) * d.r);
      b.rotation.y = -d.a + Math.PI / 2;
      const f = Math.sin(self.time * 7 + d.ph) * .5;
      d.wl.rotation.z = f; d.wr.rotation.z = -f;
    });
    if (birdTimer <= 0 && birds.visible) { birdTimer = U.rand(14, 40); RS.Audio.play('seagull'); }
    whaleTimer -= dt;
    if (whaleTimer <= 0) { whaleTimer = U.rand(80, 200); RS.Audio.play('whale'); }

    // 环境音
    RS.Audio.setAmbient('ocean', self.underwater ? .12 : U.lerp(.4, .85, self.stormFactor));
    RS.Audio.setAmbient('wind', U.lerp(.12, .6, self.stormFactor));
    RS.Audio.setAmbient('rain', self.rainAmount * .55);
    RS.Audio.musicTick(dt, self.stormFactor > .5 ? 'tense' : nightF > .5 ? 'night' : 'day');

    underDome.position.copy(camPos);
    underDome.visible = self.underwater;
  };

  this.setUnderwater = function (on) {
    if (self.underwater === on) return;
    self.underwater = on;
    RS.Audio.setUnderwater(on);
  };

  /* 岛屿浅水信息传给海洋着色器 */
  this.setIslands = function (list) {
    const u = oceanMat.uniforms.uIslands.value;
    for (let i = 0; i < 4; i++) {
      if (list[i]) u[i].set(list[i].x, list[i].z, list[i].r, 0);
      else u[i].set(1e6, 0, 1, 0);
    }
  };

  this.sunDirection = function () {
    const ang = (self.timeOfDay - 6) / 24 * U.TAU;
    return new THREE.Vector3(Math.cos(ang), Math.sin(ang), .28).normalize();
  };
  this.isNight = function () { return self.timeOfDay < 5.6 || self.timeOfDay > 19.4; };
  this.windVec = function () { return new THREE.Vector3(Math.cos(self.windDir), 0, Math.sin(self.windDir)); };
};
