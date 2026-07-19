/* ============================================================
   STARFORGE - main.js
   游戏状态机 / 主循环 / 昼夜 / 任务 / 飞船实体 / 存档
   ============================================================ */
'use strict';

const Game = (() => {
  const $ = id => document.getElementById(id);

  // ---------- 渲染器 ----------
  const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // ---------- 画面设置（ESC → 画面设置；持久化到 localStorage）----------
  const SETTINGS_KEY = 'starforge_settings';
  const settings = { fov: 75, chunkDist: 16, farDist: 1536, quality: 'mid', planetLod: 'mid', clouds: 'on', realAtmo: 'on', npcShips: 7 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch(e){}
  let lastQuality = null;
  function baseFov(){ return settings.fov; }
  function applySettings(){
    World.setViewDist(settings.chunkDist >= 33 ? 64 : settings.chunkDist);   // 拉满 = 无限（64 区块渐进生成）
    World.setFarDist(settings.farDist);
    // 画质：流畅=降采样渲染 · 标准=原生1x · 高画质=全分辨率+实时阳光阴影+电影级调色（MC光影风格）
    const q = settings.quality;
    renderer.setPixelRatio(q === 'low' ? 0.75 : q === 'high' ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = q === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = q === 'high' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.18;
    $('game').style.filter = q === 'high' ? 'saturate(1.14) contrast(1.04)' : '';
    World.setShadows(q === 'high');
    Space.setLodQuality(settings.planetLod);
    Space.setClouds(settings.clouds === 'on');
    Space.setRealAtmo(settings.realAtmo === 'on');
    Space.setVisitorCount(settings.npcShips);
    if (planetScene){
      if (settings.clouds === 'on' && !groundClouds) buildGroundClouds();
      if (groundClouds) groundClouds.inst.visible = settings.clouds === 'on';
      if (settings.realAtmo === 'on' && !skyDome) buildSkyDome();
      if (skyDome) skyDome.visible = settings.realAtmo === 'on';
    }
    if (q !== lastQuality){
      // 切换阴影/色调映射需要材质重编译；星球区块重建触发 LOD 着色器预热
      const recompile = o => { if (o.isMesh || o.isSprite || o.isPoints){ const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m) m.needsUpdate = true; }); } };
      if (planetScene) planetScene.traverse(recompile);
      if (Space.scene) Space.scene.traverse(recompile);
      lastQuality = q;
    }
    if (sunLight){
      sunLight.castShadow = q === 'high';
    }
    if (state === 'planet' || state === 'seated'){ camera.fov = baseFov(); camera.updateProjectionMatrix(); }
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch(e){}
  }
  function setupSunShadow(light){
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -70; light.shadow.camera.right = 70;
    light.shadow.camera.top = 70; light.shadow.camera.bottom = -70;
    light.shadow.camera.near = 1; light.shadow.camera.far = 500;
    light.shadow.bias = -0.0006;
  }

  // ---------- 状态 ----------
  let state = 'menu';            // menu | planet | space | docked
  let planetScene = null;
  let sunLight = null, ambLight = null, hemiLight = null;
  let dayTime = 0.3;             // 0~1
  const DAY_LEN = 480;           // 秒/天
  let currentPlanet = 0;
  let landedPlanet = 0;          // 最近实际着陆/进入过大气层的星球（区别于接近预备的 currentPlanet）
  let visitedPlanets = {};       // id -> {blocks(RLE), machines, shipPos}
  let galaxyArchives = {};       // 星系种子 -> visitedPlanets（跨星系往返时保留信标/建筑）
  let techState = {};            // id -> true
  let lastTech = null;
  let flags = {};                // 任务事件旗标
  let market = {};               // 物价波动
  let questIdx = 0;
  let shipMesh = null, shipHere = true, shipPos = new THREE.Vector3();
  let fuelLoaded = 0;            // 飞船燃料（次数）
  let playTime = 0;
  let pointerLocked = false;
  let paused = false;
  let creative = false;          // 创造模式
  let dropMult = 1;              // 生存难度产出倍率（简单×7 普通×4 困难×1）

  for (const id of TRADE_GOODS) market[id] = 0.9 + Math.random() * 0.2;
  techState.survival = true;

  // ---------- 星球场景 ----------
  let sceneFor = null;   // 当前 planetScene 属于哪颗星球（同球再入免重建）
  function buildPlanetScene(){
    planetScene = new THREE.Scene();
    sceneFor = currentPlanet;
    const b = World.biome;
    planetScene.background = new THREE.Color(b.sky[0], b.sky[1], b.sky[2]);
    planetScene.fog = new THREE.Fog(new THREE.Color(b.fog[0], b.fog[1], b.fog[2]), 90, 1050);
    ambLight = new THREE.AmbientLight(0xffffff, 0.35);
    planetScene.add(ambLight);
    hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x5a4a33, 0.5);
    planetScene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfff2d0, 1.0);
    sunLight.position.set(60, 100, 30);
    setupSunShadow(sunLight);
    sunLight.castShadow = settings.quality === 'high';
    planetScene.add(sunLight);
    planetScene.add(sunLight.target);
    planetScene.add(World.group);
    planetScene.add(World.farMesh);   // 超级视距：远景模拟地形
    planetScene.add(camera);          // 相机入场景（手持工具为相机子对象）
    Factory.init(planetScene);
    Player.initVisuals(planetScene);
    Creatures.init(planetScene);
    // 停驻的飞船
    shipMesh = buildLandedShip();
    planetScene.add(shipMesh);
    // 天空中的姊妹星球（酷炫背景）
    addSkyPlanets();
    // 星星（夜晚显示）
    addPlanetStars();
    // 远方星系贴图（夜晚似繁星，白天不明显）
    addSkyGalaxies();
    // 太阳（与昼夜光照方向一致）
    addPlanetSun();
    // 体积云（画面设置可开关）
    groundClouds = null;
    if (settings.clouds === 'on') buildGroundClouds();
    // 逼真大气层：天穹散射穹顶（画面设置可开关）
    skyDome = null;
    if (settings.realAtmo === 'on') buildSkyDome();
  }
  // ---------- 逼真大气层（地面）：程序化天穹散射 + 晨昏霞光 ----------
  let skyDome = null, skyDomeU = null;
  function buildSkyDome(){
    if (!planetScene || !World.biome) return;
    const b = World.biome;
    skyDomeU = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uZenith: { value: new THREE.Color(b.sky[0] * 0.52, b.sky[1] * 0.62, b.sky[2] * 0.88) },
      uHorizon: { value: new THREE.Color(
        Math.min(1, b.sky[0] * 0.85 + 0.22), Math.min(1, b.sky[1] * 0.85 + 0.2), Math.min(1, b.sky[2] * 0.8 + 0.16)) },
      uDay: { value: 1 },
      uSpace: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: skyDomeU,
      vertexShader: 'varying vec3 vDir;\nvoid main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 uSunDir, uZenith, uHorizon;',
        'uniform float uDay, uSpace;',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  float h = max(d.y, 0.0);',
        '  vec3 col = mix(uHorizon, uZenith, pow(h, 0.48));',
        '  float s = max(dot(d, uSunDir), 0.0);',
        '  col += vec3(1.0, 0.86, 0.62) * pow(s, 6.0) * 0.26;',       // 米氏前向散射光晕
        '  float tw = 1.0 - clamp(abs(uSunDir.y) * 3.2, 0.0, 1.0);',  // 晨昏系数
        '  float hz = 1.0 - clamp(abs(d.y) * 2.4, 0.0, 1.0);',        // 地平线带
        '  vec2 dh = normalize(d.xz + vec2(1e-5));',
        '  vec2 sh = normalize(uSunDir.xz + vec2(1e-5));',
        '  float fac = pow(max(dot(dh, sh), 0.0), 2.0);',
        '  col = mix(col, vec3(1.0, 0.42, 0.2), tw * hz * fac * 0.8);',   // 霞光染色
        '  col *= max(uDay, 0.05) + tw * hz * 0.08;',                     // 夜晚压暗
        '  col *= 1.0 - uSpace;',                                         // 高空渐入太空黑
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    skyDome = new THREE.Mesh(new THREE.SphereGeometry(870, 32, 20), mat);
    skyDome.renderOrder = -6;
    skyDome.frustumCulled = false;
    skyDome.visible = settings.realAtmo === 'on';
    planetScene.add(skyDome);
  }
  // ---------- 体积云（地面/大气层：体素风蓬松云团，环绕玩家循环漂移）----------
  let groundClouds = null;
  const _gcM = new THREE.Matrix4();
  function buildGroundClouds(){
    if (!planetScene) return;
    const rnd = mulberry32(((World.seed || 1) ^ 0xC10D5) >>> 0);
    const span = 1100, items = [];
    for (let c = 0; c < 70; c++){
      const cx = (rnd() - 0.5) * span, cz = (rnd() - 0.5) * span;
      const cy = 124 + rnd() * 30;
      const parts = 2 + (rnd() * 3 | 0);
      const spd = 1.5 + rnd() * 2.5;
      for (let k = 0; k < parts; k++){
        items.push({
          x: cx + (rnd() - 0.5) * 26, z: cz + (rnd() - 0.5) * 26,
          y: cy + (rnd() - 0.5) * 4,
          w: 14 + rnd() * 22, h: 3.5 + rnd() * 4.5, d: 14 + rnd() * 22,
          spd,
        });
      }
    }
    const inst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false }),
      items.length);
    inst.frustumCulled = false;
    inst.renderOrder = 1;
    planetScene.add(inst);
    groundClouds = { inst, items, span, t: 0 };
    groundClouds.inst.visible = settings.clouds === 'on';
    updateGroundClouds(0, Player.pos.x, Player.pos.z);
  }
  function updateGroundClouds(dt, px, pz){
    if (!groundClouds || !groundClouds.inst.visible) return;
    const g = groundClouds;
    g.t += dt;
    const half = g.span / 2;
    for (let i = 0; i < g.items.length; i++){
      const c = g.items[i];
      const wx = px + (((c.x + g.t * c.spd) - px + half) % g.span + g.span) % g.span - half;
      const wz = pz + ((c.z - pz + half) % g.span + g.span) % g.span - half;
      _gcM.makeScale(c.w, c.h, c.d);
      _gcM.setPosition(wx, c.y, wz);
      g.inst.setMatrixAt(i, _gcM);
    }
    g.inst.instanceMatrix.needsUpdate = true;
  }
  let skyPlanets = [], nightStars = null, planetSun = null, skyStation = null, skyGalaxies = [];
  // 距离感：以当前星球到目标天体的距离决定清晰度（近=锐利，远=模糊+朦胧）
  function skyClarity(dist){ return THREE.MathUtils.clamp(1 - (dist - 500) / 4500, 0.12, 1); }
  function blurredSnapshot(srcCanvas, k, w, h){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.filter = 'blur(' + ((1 - k) * 3.5).toFixed(1) + 'px)';
    x.drawImage(srcCanvas, 0, 0, w, h);
    return c;
  }
  function addSkyPlanets(){
    Space.scene;   // 惰性初始化太空场景：星球直读档时 Space 尚未 init，否则姊妹星球/空间站在天上全部隐形
    skyPlanets = [];
    for (const pd of SYSTEM_PLANETS){
      if (pd.id === currentPlanet) continue;
      const tint = BIOMES[pd.biome].tint;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(14 + pd.radius * 0.05, 24, 16),
        new THREE.MeshLambertMaterial({ color: tint, fog: false, transparent: true, opacity: 0.95 })
      );
      const ang = pd.id * 2.1, el = 0.35 + (pd.id % 3) * 0.18;
      m.position.set(Math.cos(ang) * 700, Math.sin(el * Math.PI) * 500 + 200, Math.sin(ang) * 700);
      m.userData.basePos = m.position.clone();
      m.userData.pid = pd.id;
      planetScene.add(m);
      skyPlanets.push(m);
    }
    addSkyStation();
  }
  // 天空中的轨道空间站（模拟渲染贴图：程序化肖像画布，按距离模糊）
  function drawStationPortrait(x, S){
    x.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2;
    // 主塔（纺锤轮廓）
    const grd = x.createLinearGradient(cx - 9, 0, cx + 9, 0);
    grd.addColorStop(0, '#5a6672'); grd.addColorStop(0.45, '#aeb9c4'); grd.addColorStop(1, '#3e4650');
    x.fillStyle = grd;
    x.beginPath();
    x.moveTo(cx, cy - 40);
    x.quadraticCurveTo(cx + 13, cy - 18, cx + 12, cy + 6);
    x.quadraticCurveTo(cx + 10, cy + 26, cx, cy + 34);
    x.quadraticCurveTo(cx - 10, cy + 26, cx - 12, cy + 6);
    x.quadraticCurveTo(cx - 13, cy - 18, cx, cy - 40);
    x.fill();
    // 尖塔 + 信标
    x.fillStyle = '#39424c'; x.fillRect(cx - 1, cy - 56, 2, 18);
    x.fillStyle = '#ffb347'; x.fillRect(cx - 1.5, cy - 59, 3, 3);
    // 机库块（面向侧）+ 入口光缝
    x.fillStyle = '#77828e'; x.fillRect(cx + 6, cy - 6, 20, 16);
    x.fillStyle = '#35e0e8'; x.fillRect(cx + 24, cy - 2, 2, 8);
    // 巨环（侧视扁椭圆）
    x.strokeStyle = '#8a95a1'; x.lineWidth = 3;
    x.beginPath(); x.ellipse(cx, cy + 18, 34, 7, 0, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(53,224,232,0.5)'; x.lineWidth = 1;
    x.beginPath(); x.ellipse(cx, cy + 18, 34, 7, 0, 0, Math.PI * 2); x.stroke();
    // 太阳能翼
    x.fillStyle = '#2a4a7a'; x.fillRect(cx - 34, cy - 10, 14, 5); x.fillRect(cx + 20, cy - 22, 14, 5);
    // 舷窗光点
    x.fillStyle = '#dff4ff';
    for (let i = 0; i < 7; i++) x.fillRect(cx - 6 + i * 2, cy - 8 + (i % 3) * 7, 1, 1);
  }
  function addSkyStation(){
    skyStation = null;
    if (typeof STATION_POS === 'undefined') return;
    const pd = SYSTEM_PLANETS[currentPlanet];
    // 真·3D：克隆整座站体入天（星球场景阳光实时打光——受光面亮、背光面暗，与姊妹星球同级质感）
    const dist = new THREE.Vector3(...STATION_POS).distanceTo(new THREE.Vector3(...pd.pos));
    const k = skyClarity(dist);
    const model = Space.cloneStationModel(k);
    if (!model) return;
    skyStation = new THREE.Group();
    skyStation.add(model);
    skyStation.userData = { k, dist };
    planetScene.add(skyStation);
  }
  function addPlanetStars(){
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const rnd = mulberry32(99);
    for (let i = 0; i < 500; i++){
      const v = new THREE.Vector3(rnd() - 0.5, rnd() * 0.5 + 0.1, rnd() - 0.5).normalize().multiplyScalar(900);
      pos.push(v.x, v.y, v.z);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    nightStars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    planetScene.add(nightStars);
  }
  // 地表可见的远方星系贴图：方向/大小与太空场景一致（出大气无跳变），夜晚神似繁星、白天几乎隐没
  function addSkyGalaxies(){
    skyGalaxies = [];
    for (const seed of neighborSeeds()){
      const rnd = mulberry32(seed >>> 0);
      const theta = rnd() * Math.PI * 2;
      const elev = (rnd() - 0.5) * 1.1;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(Space.galaxyCanvas(seed)),
        transparent: true, depthWrite: false, fog: false, opacity: 0,
      }));
      sp.userData.dir = new THREE.Vector3(
        Math.cos(elev) * Math.cos(theta), Math.sin(elev), Math.cos(elev) * Math.sin(theta));
      sp.scale.setScalar((650 + rnd() * 550) / 8200 * 870);
      sp.renderOrder = -2;
      sp.visible = false;
      planetScene.add(sp);
      skyGalaxies.push(sp);
    }
  }
  function addPlanetSun(){
    // 与太空恒星同源：同一张米粒组织表面贴图 + 同款双层日冕，视直径按真实几何换算
    const tex = Space.sunTextures();
    const pd = SYSTEM_PLANETS[currentPlanet];
    const dist = Space.SUN_POS.distanceTo(new THREE.Vector3(...pd.pos));
    const appR = Space.SUN_R / Math.max(1, dist) * 850;   // 天穹半径850处的视半径
    planetSun = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.SphereGeometry(appR, 32, 16),
      new THREE.MeshBasicMaterial({ map: tex.surface, transparent: true, fog: false, depthWrite: false }));
    disc.renderOrder = -2;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.corona, transparent: true, fog: false, depthWrite: false }));
    glow.scale.set(appR * 8, appR * 8, 1);
    glow.renderOrder = -3;
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.corona, transparent: true, fog: false, depthWrite: false, opacity: 0.85 }));
    corona.scale.set(appR * 3.2, appR * 3.2, 1);
    corona.renderOrder = -3;
    planetSun.add(glow, corona, disc);
    planetSun.userData = { disc, glow, corona };
    planetScene.add(planetSun);
  }
  function buildLandedShip(){
    const g = new THREE.Group();
    // 外部精模（随座驾型号；Quaternius 系转正机头），缺失时回退程序化体素飞船
    const mdl = (typeof playerShip !== 'undefined' && playerShip.model) || 'ship';
    const glb = window.ModelLib && ModelLib.get(mdl, mdl === 'ship' ? 5.2 : 7.0, { yaw: mdl === 'ship' ? 0 : Math.PI });
    if (glb){
      glb.position.y = 0.12;
      g.add(glb);
    } else {
      const hull = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('metal') });
      const dark = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('metal_dark') });
      const glassM = new THREE.MeshLambertMaterial({ color: 0x66ddee, transparent: true, opacity: 0.7, emissive: 0x113344 });
      const accent = new THREE.MeshLambertMaterial({ color: 0xc9641a });
      const B = (w, h, d, m, x, y, z) => { const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mm.position.set(x, y, z); g.add(mm); return mm; };
      B(1.4, 0.9, 3.6, hull, 0, 1.0, 0);
      B(0.9, 0.62, 1.2, glassM, 0, 1.55, -0.9);
      B(1.2, 0.3, 1.1, dark, 0, 0.65, -1.9);
      B(2.6, 0.16, 1.4, hull, -1.9, 0.9, 0.7);
      B(2.6, 0.16, 1.4, hull, 1.9, 0.9, 0.7);
      B(0.5, 0.5, 1.0, accent, -3.0, 1.05, 0.8);
      B(0.5, 0.5, 1.0, accent, 3.0, 1.05, 0.8);
      B(0.55, 0.55, 0.9, dark, -0.55, 0.95, 1.9);
      B(0.55, 0.55, 0.9, dark, 0.55, 0.95, 1.9);
      B(0.14, 1.0, 0.14, dark, -0.5, 0.25, -0.8);
      B(0.14, 1.0, 0.14, dark, 0.5, 0.25, -0.8);
      B(0.14, 1.0, 0.14, dark, 0, 0.25, 1.2);
    }
    // 信标灯
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    beacon.position.set(0, 1.9, 0.5);
    g.add(beacon);
    g.userData.beacon = beacon;
    g.userData.model = mdl;   // 记录建造型号（换船后跨场景比对重建）
    return g;
  }

  // ---------- 新游戏 / 换星球 ----------
  const loadFlavors = ['铺设体素地层', '注入矿脉', '培育生态植被', '校准大气散射', '唤醒机器之灵', '压缩量子存档'];
  async function genPlanet(pid, fresh, center){
    state = 'loading';
    $('loading').classList.remove('hidden');
    $('loadTitle').textContent = `正在抵达「${SYSTEM_PLANETS[pid].name}」…`;
    const setP = f => {
      $('loadFill').style.width = (f * 100).toFixed(0) + '%';
      $('loadFlavor').textContent = loadFlavors[Math.min(loadFlavors.length - 1, (f * loadFlavors.length) | 0)];
    };
    await new Promise(r => setTimeout(r, 50));
    currentPlanet = pid;
    landedPlanet = pid;
    clearScanMarkers();
    const pd = SYSTEM_PLANETS[pid];
    const saved = visitedPlanets[pid];
    if (saved && !fresh){
      World.init(pd.biome, saved.seed, saved.mods || null);
      if (!center) center = [saved.shipPos[0], saved.shipPos[2]];
    } else {
      World.init(pd.biome, (Math.random() * 1e9) | 0, null);
    }
    if (!center) center = [0, 0];
    await World.pregen(center[0], center[1], 4, f => setP(f * 0.9));
    buildPlanetScene();
    if (saved && !fresh){
      Factory.deserialize(saved.machines);
      shipPos.fromArray(saved.shipPos);
      // 停船位贴地保护（修复悬空飞船）
      shipPos.y = World.topAt(Math.floor(shipPos.x), Math.floor(shipPos.z)) + 1;
      // 若建有发射平台，飞船优先停泊在平台上（免燃料起飞）
      for (const m of Factory.machines.values()){
        if (m.type === 'launchpad'){ shipPos.set(m.x + 0.5, m.y + 1, m.z + 0.5); break; }
      }
    } else {
      const sp = World.findSpawn();
      shipPos.copy(sp).add(new THREE.Vector3(4, -1, 2));
      // 确保飞船地面平整
      shipPos.y = World.topAt(Math.floor(shipPos.x), Math.floor(shipPos.z)) + 1;
    }
    shipMesh.position.copy(shipPos);
    shipHere = true;
    worldLoadedFor = pid;
    camera.fov = baseFov();
    camera.updateProjectionMatrix();
    ensureSpaceMatWarm();   // 载入屏后面预编译太空+地形着色器，运行时零编译
    setP(1);
    await new Promise(r => setTimeout(r, 200));
    $('loading').classList.add('hidden');
    state = 'planet';
    Sound.Music.setMode(World.biome.haz ? 'danger' : 'planet');
  }
  function savePlanetState(){
    const w = World.serialize();
    visitedPlanets[currentPlanet] = {
      mods: w.mods,
      machines: Factory.serialize(),
      shipPos: shipPos.toArray(),
      seed: w.seed,
      biome: SYSTEM_PLANETS[currentPlanet].biome,
    };
  }

  async function newGame(creativeMode, mult){
    Sound.begin();
    creative = !!creativeMode;
    dropMult = creative ? 1 : (mult || 1);
    activeSaveKey = null;
    galaxyCount = 1;
    Space.restoreGalaxy(HOME_GALAXY_SEED);
    $('boot').classList.add('hidden');
    UI.buildHotbar();
    // 重置
    techState = { survival: true };
    flags = {}; questIdx = 0; fuelLoaded = 0;
    visitedPlanets = {};
    galaxyArchives = {};
    mapMarks = {};
    Player.credits = 250;
    Player.inv.fill(null);
    Player.addItem('carbon', 10, true);
    Player.addItem('sodium', 5, true);
    await genPlanet(0, true);
    const sp = World.findSpawn();
    Player.pos.copy(sp);
    shipPos.copy(sp).add(new THREE.Vector3(4, 0, 2));
    shipPos.y = World.topAt(Math.floor(shipPos.x), Math.floor(shipPos.z)) + 1;
    shipMesh.position.copy(shipPos);
    $('hud').classList.remove('hidden');
    $('quests').style.display = creative ? 'none' : '';
    UI.refreshAll();
    Sound.play('questNew');
    if (creative){
      UI.bigMessage('创造模式', SYSTEM_PLANETS[0].name + ' · 按 P 打开物品库 · 无限资源');
      // 创造模式解锁全部科技
      for (const k in TECH) techState[k] = true;
    } else {
      UI.bigMessage('紧急迫降', SYSTEM_PLANETS[0].name + ' · ' + World.biome.name);
      announceQuest();
    }
    lockPointer();
    if (window.Net) Net.onWorldReady();   // 联机：主机世界就绪，同步给访客
  }

  // ---------- 联机加入：用主机的种子/改动/机器重建同一世界 ----------
  async function joinGame(init){
    Sound.begin();
    creative = !!init.creative;
    dropMult = init.dropMult || 1;
    activeSaveKey = null;
    galaxyCount = 1;
    Space.restoreGalaxy(init.galaxySeed !== undefined ? init.galaxySeed : HOME_GALAXY_SEED);
    $('boot').classList.add('hidden');
    UI.closeAll();
    UI.buildHotbar();
    techState = { survival: true };
    flags = {}; questIdx = 0; fuelLoaded = 0;
    visitedPlanets = {};
    galaxyArchives = {};
    mapMarks = {};
    Player.credits = 250;
    Player.inv.fill(null);
    Player.addItem('carbon', 10, true);
    Player.addItem('sodium', 5, true);
    visitedPlanets[init.planet] = {
      mods: init.mods || {}, machines: init.machines || [],
      shipPos: [4, 40, 2], seed: init.seed, biome: SYSTEM_PLANETS[init.planet].biome,
    };
    await genPlanet(init.planet, false);
    dayTime = init.dayTime !== undefined ? init.dayTime : 0.3;
    const sp = World.findSpawn();
    Player.pos.copy(sp);
    shipPos.copy(sp).add(new THREE.Vector3(4, 0, 2));
    shipPos.y = World.topAt(Math.floor(shipPos.x), Math.floor(shipPos.z)) + 1;
    shipMesh.position.copy(shipPos);
    $('hud').classList.remove('hidden');
    $('quests').style.display = creative ? 'none' : '';
    if (creative) for (const k in TECH) techState[k] = true;
    UI.refreshAll();
    UI.bigMessage('已加入联机世界', SYSTEM_PLANETS[init.planet].name + ' · ' + World.biome.name);
    lockPointer();
  }

  // ---------- 任务系统 ----------
  function currentQuests(){
    const out = [];
    for (let i = Math.max(0, questIdx - 1); i <= questIdx && i < QUESTS.length; i++){
      const q = QUESTS[i];
      out.push({ desc: q.title + '：' + q.desc, done: i < questIdx, progress: i === questIdx ? questProgress(q) : null });
    }
    return out;
  }
  function currentQuestId(){
    return questIdx < QUESTS.length ? QUESTS[questIdx].id : null;
  }
  function questProgress(q){
    if (q.type === 'collect') return `${Math.min(Player.countItem(q.item), q.n)}/${q.n}`;
    if (q.type === 'place' && q.n) return `${placedCount[q.block] || 0}/${q.n}`;
    return null;
  }
  const placedCount = {};
  function checkQuest(){
    if (creative || questIdx >= QUESTS.length) return;
    const q = QUESTS[questIdx];
    let done = false;
    switch (q.type){
      case 'collect': done = Player.countItem(q.item) >= q.n; break;
      case 'place': done = (placedCount[q.block] || 0) >= (q.n || 1); break;
      case 'tech': done = !!techState[q.tech]; break;
      case 'event': done = !!flags[q.flag]; break;
    }
    if (done){
      questIdx++;
      Sound.play('questDone');
      UI.bigMessage('任务完成', q.title);
      Player.credits += 50 + questIdx * 25;
      setTimeout(announceQuest, 2600);
    }
    UI.refreshQuests();
  }
  function announceQuest(){
    if (creative || questIdx >= QUESTS.length) return;
    const q = QUESTS[questIdx];
    Sound.play('questNew');
    if (q.dialog) UI.bigMessage('◈ ' + q.title, q.dialog, 5200);
    else UI.bigMessage('◈ 新任务', q.title + ' — ' + q.desc, 4000);
    UI.refreshQuests();
  }
  function onBlockMined(def){ checkQuest(); }
  function onBlockPlaced(blockKey){
    placedCount[blockKey] = (placedCount[blockKey] || 0) + 1;
    checkQuest();
  }
  function techDone(id){ return !!techState[id]; }
  function completeTech(id){
    techState[id] = true;
    lastTech = id;
    checkQuest();
    UI.refreshInv();
  }

  // ---------- 指针锁定 ----------
  function lockPointer(){
    if (state === 'planet' || state === 'space' || state === 'atmo' || state === 'station'){
      try {
        const p = renderer.domElement.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch(e){}
    }
  }
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
    if (!pointerLocked) Player.mineHeld = false;
  });

  // ---------- 输入 ----------
  const spaceInput = { mouseDX: 0, mouseDY: 0, thrust: false, brake: false, boost: false, pulse: false, rollLeft: false, rollRight: false };
  document.addEventListener('mousemove', e => {
    if (!pointerLocked) return;
    if (state === 'planet' || (state === 'station' && Station.walking)){
      // station 行走与星球行走共用同一条被验证的视角通道（Player.yaw/pitch）
      Player.yaw -= e.movementX * 0.0024;
      Player.pitch = THREE.MathUtils.clamp(Player.pitch - e.movementY * 0.0024, -1.55, 1.55);
    } else if (state === 'station'){
      // 站内行走视角：复用太空飞行同一条输入管线（spaceInput 累积 → station.js 消费）
      spaceInput.mouseDX += e.movementX;
      spaceInput.mouseDY += e.movementY;
    } else if (state === 'space' || state === 'atmo'){
      spaceInput.mouseDX += e.movementX;
      spaceInput.mouseDY += e.movementY;
    }
  });
  document.addEventListener('mousedown', e => {
    if (state === 'menu' || UI.anyPanelOpen()) return;
    if (dialogActive()){ advanceDialog(); return; }   // 对话中：点击推进，不触发挖掘
    if (!pointerLocked){ lockPointer(); return; }
    if (state === 'planet'){
      if (e.button === 0) Player.mineHeld = true;
      if (e.button === 2) Player.tryPlace(camera);
    } else if (state === 'space'){
      if (e.button === 0) Space.shoot(camera);
    }
  });
  document.addEventListener('mouseup', e => { if (e.button === 0) Player.mineHeld = false; });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('wheel', e => {
    if (state !== 'planet' || UI.anyPanelOpen()) return;
    // 循环：1..9 → 激光(-1) → 1（激光排在 9 号之后）
    const cur = Player.hotIdx === -1 ? 9 : Player.hotIdx;   // 0..9
    const next = (cur + (e.deltaY > 0 ? 1 : -1) + 10) % 10;
    Player.hotIdx = next === 9 ? -1 : next;
    UI.refreshHotbar();
    UI.showItemName();
  });

  document.addEventListener('keydown', e => {
    if (state === 'menu') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;   // 文本框输入中不触发快捷键
    Player.keys[e.code] = true;
    if (e.code === 'Tab'){ e.preventDefault(); UI.toggle('invPanel'); }
    if (e.code === 'KeyT' && state === 'planet'){ UI.toggle('techPanel'); }
    if (e.code === 'Escape'){
      if (e.ctrlKey || e.code === 'F8'){   // Ctrl+Esc 或 F8 → 运行时诊断面板
        toggleErrPanel();
        return;
      }
      if (dialogActive()){ closeDialog(); return; }
      if (UI.anyPanelOpen()){ UI.closeAll(); Sound.play('uiClose'); lockPointer(); }
      else UI.toggle('pausePanel');
    }
    if (e.code === 'F8'){ toggleErrPanel(); return; }   // F8 也可打开诊断面板
    if (e.code === 'F5'){ e.preventDefault(); if (save()) UI.bigMessage('已快速存档', '', 1200); }
    if (e.code === 'KeyP' && creative && (state === 'planet' || state === 'space')){ UI.toggleCreative(); }
    if (e.code === 'KeyC' && state === 'planet' && !UI.anyPanelOpen()){ doScan(); }
    if (e.code === 'KeyC' && state === 'atmo' && !UI.anyPanelOpen()){ shipScanPOI(); }
    if (e.code === 'KeyC' && state === 'space' && !UI.anyPanelOpen()){
      if (Space.spaceScan()){
        const n = addSpacePoi();
        UI.bigMessage('星系扫描', '已标记本星系所有天体' + (n ? ` · 邻近星球 ${n} 处兴趣点` : ''), 2000);
      }
    }
    if (e.code === 'KeyV' && state === 'space' && !UI.anyPanelOpen()){ UI.openGalaxyMap(); }
    if (e.code === 'KeyM' && state === 'space' && !UI.anyPanelOpen()){ UI.openGalaxyMap(); }
    if (e.code === 'KeyJ' && state === 'space') spaceInput.pulse = true;   // J 脉冲仍保留
    if (e.code === 'KeyM' && (state === 'planet' || state === 'seated' || state === 'atmo')){ togglePlanetMap(); }
    if (e.code === 'KeyR' && state === 'planet' && !UI.anyPanelOpen()){ Player.cycleRot(); }
    if (e.code === 'KeyG' && state === 'planet' && !UI.anyPanelOpen()){ Player.throwHeld(); }
    if (e.code.startsWith('Digit')){
      const n = +e.code.slice(5);
      if (state === 'planet'){
        if (n === 0){ Player.hotIdx = -1; UI.refreshHotbar(); UI.showItemName(); }
        else if (n >= 1 && n <= 9){ Player.hotIdx = n - 1; UI.refreshHotbar(); UI.showItemName(); }
      }
    }
    if (e.code === 'KeyE' && !e.repeat){   // 忽略按键自动重复：一次物理按压只触发一次交互
      if (state === 'station') Station.pressE();
      else if (dialogActive()) advanceDialog();
      else interact();
    }
    // 座舱内：W 点火起飞
    if (state === 'seated' && e.code === 'KeyW' && !UI.anyPanelOpen()){ attemptTakeoff(); }
    // 空间站停机位：W 起飞离站
    if (state === 'station' && e.code === 'KeyW' && !e.repeat){ Station.pressW(); }
    // 太空/大气层按键
    if (state === 'space' || state === 'atmo'){
      if (e.code === 'KeyW') spaceInput.thrust = true;
      if (e.code === 'KeyS') spaceInput.brake = true;
      if (e.code === 'ShiftLeft') spaceInput.boost = true;
      if (e.code === 'KeyJ') spaceInput.pulse = true;
      if (e.code === 'KeyA') spaceInput.rollLeft = true;
      if (e.code === 'KeyD') spaceInput.rollRight = true;
    }
  });
  document.addEventListener('keyup', e => {
    Player.keys[e.code] = false;
    if (e.code === 'KeyW') spaceInput.thrust = false;
    if (e.code === 'KeyS') spaceInput.brake = false;
    if (e.code === 'ShiftLeft') spaceInput.boost = false;
    if (e.code === 'KeyJ') spaceInput.pulse = false;
    if (e.code === 'KeyA') spaceInput.rollLeft = false;
    if (e.code === 'KeyD') spaceInput.rollRight = false;
  });

  // ---------- 交互 ----------
  // RPG 对话系统：打字机逐字显示 · E/点击推进（未显完先补完）· 走远自动结束
  const VILLAGER_TALKS = [
    ['这片地啊，是我爷爷的爷爷开垦的。', '那会儿天上还没有你们这些亮闪闪的飞船呢。', '……时代真是变了呀，旅行者。'],
    ['你闻到没有？要下雨了。', '别看扫描仪嘀嘀响得欢，论看天，还得靠我这把老腰。'],
    ['小豆豆又跑出去追跳羚了，这孩子……', '要是在草原上碰见她，劳驾让她回家吃饭。'],
    ['听说危险星球上有先民留下的遗迹。', '发光的石柱、会唱歌的方尖碑……', '别看我，我是不敢去的。你不一样，你有枪。'],
    ['空间站的物价一天三变。', '数据芯片涨的时候赶紧卖，铁锭跌的时候放胆买。', '……唉，我要是有艘飞船就好了。'],
    ['看见村口那根灯柱了吗？全星球最亮。', '夜里迷了路，就朝着光走，准没错。'],
    ['你身上有股太空的味道。', '冷冰冰的，像星星。……不是坏话，挺好闻的。'],
    ['铀矿石那玩意儿可碰不得。', '我表哥当年非要揣两块回家，现在他的头发……算了，不提了。'],
    ['风车吱呀吱呀转，我能坐着听一下午。', '比空间站里放的那些电子乐好听多了。'],
    ['旅行者，帮我带句话给邻村——', '就说老全还欠我两筐碳薯，别想赖账！'],
    ['我们村的屋顶漏雨，想修可木板不够。', '你要是有多余的碳板，跟铁匠换点好东西不亏。'],
    ['昨晚我看见一颗星星动得飞快。', '八成又是你们这些飞船在拉练吧？', '……什么？那是流星？咳，我就说嘛。'],
  ];
  let dlg = null;   // {lines:[{name,text}], idx, chars, anchor:Vector3}
  function dialogActive(){ return !!dlg; }
  function startDialog(name, lines, anchorPos){
    dlg = {
      lines: lines.map(t => ({ name, text: t })),
      idx: 0, chars: 0,
      anchor: anchorPos ? anchorPos.clone() : null,
    };
    $('dialogBox').classList.remove('hidden');
    Sound.play('uiOpen');
    renderDialog();
  }
  function renderDialog(){
    const cur = dlg.lines[dlg.idx];
    $('dlgName').textContent = cur.name;
    $('dlgText').textContent = cur.text.slice(0, dlg.chars | 0);
    $('dlgNext').style.visibility = (dlg.chars | 0) >= cur.text.length ? 'visible' : 'hidden';
  }
  function advanceDialog(){
    if (!dlg) return;
    const cur = dlg.lines[dlg.idx];
    if ((dlg.chars | 0) < cur.text.length){
      dlg.chars = cur.text.length;   // 未显完 → 立即补完
      renderDialog();
      return;
    }
    dlg.idx++;
    if (dlg.idx >= dlg.lines.length){ closeDialog(); return; }
    dlg.chars = 0;
    Sound.play('uiClick');
    renderDialog();
  }
  function closeDialog(){
    dlg = null;
    $('dialogBox').classList.add('hidden');
    Sound.play('uiClose');
  }
  function tickDialog(dt){
    if (!dlg) return;
    // 打字机
    const cur = dlg.lines[dlg.idx];
    if ((dlg.chars | 0) < cur.text.length){
      dlg.chars = Math.min(cur.text.length, dlg.chars + dt * 26);
      renderDialog();
    }
    // 走远自动结束
    if (dlg && dlg.anchor && Player.pos.distanceTo(dlg.anchor) > 7) closeDialog();
  }
  function talkToVillager(g){
    const talk = VILLAGER_TALKS[(Math.random() * VILLAGER_TALKS.length) | 0];
    startDialog(g.userData.name, talk, g.position);
    // 面向玩家并驻足（模型前方为 -Z，与 Creatures.tickOne 行走朝向一致：取反向角）
    g.userData.state = 'idle';
    g.userData.timer = Math.max(g.userData.timer, 10);
    g.rotation.y = Math.atan2(g.position.x - Player.pos.x, g.position.z - Player.pos.z);
  }
  function interact(){
    if (UI.anyPanelOpen()) return;
    if (state === 'atmo'){ atmoLandStart(); return; }
    if (state === 'seated'){ exitShip(); return; }
    if (state === 'planet'){
      // 村民对话
      const v = Creatures.nearestVillager(Player.pos, 3.6);
      if (v){ talkToVillager(v.g); return; }
      // 飞船
      if (shipHere && Player.pos.distanceTo(shipPos) < 4.5){
        interactShip();
        return;
      }
      // 机器
      const hit = Player.lookTarget(camera);
      if (hit){
        const m = Factory.at(hit.x, hit.y, hit.z);
        if (m){
          UI.openMachinePanel(m);
          return;
        }
      }
      // 充能
      if (Player.stats.haz < Player.stats.hazMax - 5 && Player.recharge('haz')) return;
      if (Player.stats.o2 < Player.stats.o2Max - 5 && Player.recharge('o2')) return;
    }
    else if (state === 'space'){
      const t = Space.nearestTarget();
      if (!t) return;
      if (t.type === 'station' && t.dist < 300)
        UI.bigMessage('泊入指引', '飞向机库发光入口，穿过蓝色护盾即自动泊入', 2600);
      // 星球降落改为无缝再入：直接飞向星球即可
    }
  }
  function interactShip(){
    flags.checkedShip = true;
    checkQuest();
    // 创造模式：直接登船
    if (creative){ boardShip(); return; }
    // 修复阶段
    if (!flags.shipRepaired){
      if (questIdx >= 6 && Player.countItem('iron') >= 10 && Player.countItem('carbon') >= 20){
        Player.removeItem('iron', 10);
        Player.removeItem('carbon', 20);
        flags.shipRepaired = true;
        Sound.play('craft');
        UI.bigMessage('推进器修复完毕', '按 E 登船 → W 点火起飞（需发射燃料）');
        checkQuest();
      } else {
        Sound.play('uiOpen');
        UI.bigMessage('飞船受损', '修复需要：铁锭×10 + 碳×20（完成前期任务解锁冶炼）');
      }
      return;
    }
    boardShip();
  }

  // ---------- 登船 / 下船 / 点火（NMS 式）----------
  let boardYaw = 0, seatedT = 0;
  function boardShip(){
    state = 'seated';
    seatedT = 0;
    const eu = new THREE.Euler().setFromQuaternion(shipMesh.quaternion, 'YXZ');
    boardYaw = eu.y;
    // 玩家收纳进船舱（存档时以舱旁坐标记录）
    Player.pos.set(shipPos.x + 2.2, World.topAt(Math.floor(shipPos.x + 2.2), Math.floor(shipPos.z)) + 1.2, shipPos.z);
    Player.vel.set(0, 0, 0);
    Player.setToolVisible(false);
    Player.mineHeld = false;
    UI.closeAll();
    $('spaceHud').classList.add('hidden');
    Sound.play('openChest');
    Sound.loops.engine.start();
    Sound.loops.engine.set('speed', 0.04);      // 怠速嗡鸣
    UI.bigMessage('已登船', 'W 点火起飞 · E 下船', 2400);
    lockPointer();
  }
  function exitShip(){
    Sound.loops.engine.stop();
    state = 'planet';
    const ex = shipPos.x + 2.5, ez = shipPos.z;
    Player.pos.set(ex, World.topAt(Math.floor(ex), Math.floor(ez)) + 1.2, ez);
    Player.vel.set(0, 0, 0);
    Player.yaw = boardYaw + Math.PI / 2;
    camera.fov = baseFov(); camera.updateProjectionMatrix();
    Sound.play('land');
    lockPointer();
  }
  function attemptTakeoff(){
    if (creative){ launch(); return; }
    const onPad = !!Factory.at(Math.floor(shipPos.x), Math.floor(shipPos.y) - 1, Math.floor(shipPos.z))
      && Factory.at(Math.floor(shipPos.x), Math.floor(shipPos.y) - 1, Math.floor(shipPos.z)).type === 'launchpad';
    if (fuelLoaded < 1 && !onPad){
      if (Player.countItem('fuel') > 0){
        Player.removeItem('fuel', 1);
        fuelLoaded = 1;
        Sound.play('recharge');
        UI.bigMessage('燃料已加注', '再次按 W 点火起飞', 2000);
        return;
      }
      Sound.play('uiError');
      UI.bigMessage('燃料不足', '需要发射燃料×1（碳×25+氧×10 合成）或将飞船停在发射平台');
      return;
    }
    launch();
  }

  // ---------- 起飞 / 大气层飞行 / 降落 ----------
  let launchAnim = null;
  const atmo = { yaw: 0, pitch: 0, speed: 0, roll: 0, camRoll: 0 };
  const _trimQ = new THREE.Quaternion(), _trimAxis = new THREE.Vector3(0, 0, 1);
  const _atQ = new THREE.Quaternion(), _atD = new THREE.Quaternion(), _atE = new THREE.Euler();
  let atmoLand = null;
  function launch(){
    if (fuelLoaded > 0) fuelLoaded--;
    flags.launched = true;
    checkQuest();
    Sound.play('takeoff');
    Sound.loops.jet.stop();
    // 平滑爬升起飞（无切换动画）
    startAtmo(false);
  }
  function startAtmo(fromSpace){
    state = 'atmo';
    shipHere = false;
    if (fromSpace){
      // 从太空再入：高空开始，玩家驾驶择地降落（NMS 风格）
      const gy = World.topAt(Math.floor(shipPos.x), Math.floor(shipPos.z));
      shipMesh.position.set(shipPos.x, Math.max(HANDOFF_Y, gy + 40), shipPos.z);
      atmo.yaw = Math.random() * Math.PI * 2;
      atmo.pitch = -0.18;
      atmo.speed = 24;
    } else {
      // 地面点火：从停机位置平滑爬升
      shipMesh.position.copy(shipPos);
      atmo.yaw = boardYaw;
      atmo.pitch = 0.42;
      atmo.speed = 14;
    }
    atmo.roll = 0;
    atmo.camRoll = 0;
    atmo.warmed = false;
    atmo.presaved = false;
    Player.setToolVisible(false);
    $('spaceHud').classList.remove('hidden');
    UI.bigMessage('大气层飞行', 'W/S 油门 · 鼠标转向 · A/D 滚转 · E 就地降落 · 持续拉升冲出大气层');
    lockPointer();
  }
  function updateAtmo(dt){
    // 转向：NMS 式——鼠标俯仰/偏航 + A/D 绕前进轴滚转，均作用于机体本地轴
    // 滚转存入 camRoll（模型/相机整体携带，缓慢自动回正，与太空换系无缝衔接）
    const dRoll = (spaceInput.rollLeft ? -1.7 : spaceInput.rollRight ? 1.7 : 0) * dt;
    _atQ.setFromEuler(_atE.set(atmo.pitch, atmo.yaw, atmo.camRoll || 0, 'YXZ'));
    _atQ.multiply(_atD.setFromEuler(_atE.set(spaceInput.mouseDY * -0.0022, spaceInput.mouseDX * -0.0022, dRoll, 'YXZ')));
    _atE.setFromQuaternion(_atQ, 'YXZ');
    // 动态俯仰上限：无缝再入时可暂超 ±1.2，随后缓收回常规范围（无clamp跳变）
    atmo.pitchLim = Math.max(1.2, (atmo.pitchLim || 1.2) - dt * 0.45);
    atmo.pitch = THREE.MathUtils.clamp(_atE.x, -atmo.pitchLim, atmo.pitchLim);
    atmo.yaw = _atE.y;
    atmo.camRoll = _atE.z;
    const targetRoll = spaceInput.mouseDX * -0.04;
    atmo.roll += (targetRoll - atmo.roll) * Math.min(1, dt * 5);
    const steer = Math.abs(spaceInput.mouseDX) + Math.abs(spaceInput.mouseDY);
    spaceInput.mouseDX = 0; spaceInput.mouseDY = 0;
    // 速度
    const maxS = spaceInput.boost ? 55 : 30;
    let target = spaceInput.thrust ? maxS : spaceInput.brake ? 3 : Math.min(atmo.speed, maxS);
    atmo.speed += (target - atmo.speed) * Math.min(1, dt * 2.2);
    // 位移
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(atmo.pitch, atmo.yaw, 0, 'YXZ'));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    shipMesh.position.addScaledVector(fwd, atmo.speed * dt);
    // 星球是圆的：飞越经度周界（≈1571格=环球一周）/纬度带边界从另一侧回来，一直向前必回原点
    {
      const WRAP_X = Math.PI * 2 / 0.004, WRAP_Z = 2.3 / 0.004;
      let wrapped = false;
      if (shipMesh.position.x > WRAP_X / 2){ shipMesh.position.x -= WRAP_X; wrapped = true; }
      else if (shipMesh.position.x < -WRAP_X / 2){ shipMesh.position.x += WRAP_X; wrapped = true; }
      if (shipMesh.position.z > WRAP_Z / 2){ shipMesh.position.z -= WRAP_Z; wrapped = true; }
      else if (shipMesh.position.z < -WRAP_Z / 2){ shipMesh.position.z += WRAP_Z; wrapped = true; }
      if (wrapped) World.stream(shipMesh.position.x, shipMesh.position.z);
    }
    // 地形回避（自动拉起）；再入期间加高安全垫 + 更强拉起（入场绝不撞地）
    const gh = World.topAt(Math.floor(shipMesh.position.x), Math.floor(shipMesh.position.z));
    const clr = reentryT > 0 ? 16 : 3;
    if (shipMesh.position.y < gh + clr){
      shipMesh.position.y += (gh + clr - shipMesh.position.y) * Math.min(1, dt * (reentryT > 0 ? 12 : 6));
      if (atmo.pitch < 0) atmo.pitch += dt * (reentryT > 0 ? 2.6 : 1.2);
    }
    // 姿态与相机（机头朝 -Z，与运动方向一致）；换系继承的滚转微调整体携带、缓慢配平
    const shipQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(atmo.pitch, atmo.yaw, -atmo.roll, 'YXZ'));
    const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(atmo.pitch, atmo.yaw, 0, 'YXZ'));
    if (atmo.camRoll && Math.abs(atmo.camRoll) > 0.0008){
      _trimQ.setFromAxisAngle(_trimAxis, atmo.camRoll);
      shipQ.multiply(_trimQ);
      camQ.multiply(_trimQ);
      atmo.camRoll -= atmo.camRoll * Math.min(1, dt * (0.08 + Math.min(0.7, steer * 0.02) + (Math.abs(atmo.camRoll) > 0.5 ? 1.2 : 0)));
    } else {
      atmo.camRoll = 0;
    }
    shipMesh.quaternion.slerp(shipQ, Math.min(1, dt * 8));
    // 入大气视距/FOV 比例过渡（朝向零动画）
    let backOff = 11, blendE = 1;
    if (camBlend){
      camBlend.t += dt / 1.4;
      const k = Math.min(1, camBlend.t);
      blendE = k * k * (3 - 2 * k);
      backOff = THREE.MathUtils.lerp(camBlend.dist0, 11, blendE);
    }
    const camOff = new THREE.Vector3(0, backOff * (3.2 / 11), backOff).applyQuaternion(camQ);
    camera.position.copy(shipMesh.position).add(camOff);
    // 再入震动 + 摩擦特效衰减
    if (reentryT > 0){
      reentryT -= dt;
      const shake = Math.min(1, reentryT) * 0.35;
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      if (reentryT <= 0.6) $('reentryFx').classList.remove('show');
      // NMS 式再入：大气色滤镜停留渐散 + 船头激波火焰粒子
      atmoTintTarget = Math.min(0.75, Math.max(0, reentryT * 0.32));
      if (reentryT > 0.35){
        if (Math.random() < Math.min(1, reentryT * 0.8)){
          Player.spawnParticles(
            shipMesh.position.x - 0.5 + fwd.x * (1.8 + Math.random() * 1.6) + (Math.random() - 0.5) * 1.4,
            shipMesh.position.y - 0.5 + fwd.y * 2.0 + (Math.random() - 0.3) * 0.9,
            shipMesh.position.z - 0.5 + fwd.z * (1.8 + Math.random() * 1.6) + (Math.random() - 0.5) * 1.4,
            Math.random() < 0.55 ? 0xff6a2a : 0xffcc55, 2);
        }
      }
    }
    // 接近大气层顶：天空色滤镜渐显 + 船头摩擦燃烧粒子 + 气流震动渐强——
    // 突破前的挣扎感铺垫，与 finishLaunch 的爆发闪光/呼啸声衔接成完整的冲出序列
    const topT = THREE.MathUtils.clamp((shipMesh.position.y - (EXIT_Y - 55)) / 50, 0, 1);
    if (topT > 0 && reentryT <= 0){
      setAtmoTintColor(SYSTEM_PLANETS[currentPlanet].biome);
      atmoTintTarget = Math.max(atmoTintTarget, topT * 0.7);
      camera.position.x += (Math.random() - 0.5) * 0.3 * topT;
      camera.position.y += (Math.random() - 0.5) * 0.3 * topT;
      if (Math.random() < topT * 0.85){
        Player.spawnParticles(
          shipMesh.position.x - 0.5 + fwd.x * (1.6 + Math.random() * 1.4) + (Math.random() - 0.5) * 1.2,
          shipMesh.position.y - 0.5 + fwd.y * 1.8 + (Math.random() - 0.3) * 0.8,
          shipMesh.position.z - 0.5 + fwd.z * (1.6 + Math.random() * 1.4) + (Math.random() - 0.5) * 1.2,
          Math.random() < 0.55 ? 0xff6a2a : 0xffcc55, 2);
      }
    }
    camera.quaternion.copy(camQ);
    if (camBlend){
      camera.fov = THREE.MathUtils.lerp(camBlend.fov0, baseFov() - 3 + atmo.speed * 0.15, blendE);
      if (camBlend.t >= 1) camBlend = null;
    } else {
      camera.fov = baseFov() - 3 + atmo.speed * 0.15;
    }
    camera.updateProjectionMatrix();
    Sound.loops.engine.start();
    Sound.loops.engine.set('speed', Math.min(1, atmo.speed / 55));
    // 尾焰粒子
    if (Math.random() < atmo.speed * dt * 0.5)
      Player.spawnParticles(shipMesh.position.x - 0.5 - fwd.x, shipMesh.position.y - 0.5, shipMesh.position.z - 0.5 - fwd.z, 0x66ccff, 1);
    // HUD
    $('speedVal').textContent = atmo.speed.toFixed(0);
    $('pulseHint').textContent = `高度 ${(shipMesh.position.y - gh).toFixed(0)}m · 大气层顶 ${Math.max(0, EXIT_Y - shipMesh.position.y).toFixed(0)}m`;
    UI.setInteractHint('<b>E</b> 就地降落 · 拉升至大气层顶进入太空');
    // 高空预热太空场景（初始化 + 着色器预编译）+ 预存档（消除冲出大气层瞬间的卡顿）
    if (!atmo.warmed && shipMesh.position.y > 145){
      atmo.warmed = true;
      renderer.compile(Space.scene, camera);
    }
    if (!atmo.presaved && shipMesh.position.y > 160){
      atmo.presaved = true;
      savePlanetState();
    }
    // 大气层内持续整球回绘 + 浮雕位移（出大气前球面已是本星球地形全貌）
    Space.paintGlobe(currentPlanet, World.mapColorAt, World.seed, 2);
    Space.displaceGlobe(currentPlanet, World.mapHeightAt, World.seed, 2);
    // 冲出大气层
    if (shipMesh.position.y > EXIT_Y){
      Sound.loops.engine.stop();
      finishLaunch();
    }
  }
  function atmoLandStart(){
    const x = Math.floor(shipMesh.position.x), z = Math.floor(shipMesh.position.z);
    const gy = World.topAt(x, z);
    if (World.getDef(x, gy, z).liquid){
      Sound.play('uiError');
      UI.bigMessage('无法降落', '下方是液体表面，请寻找陆地');
      return;
    }
    Sound.loops.engine.stop();
    Sound.loops.pulse.stop();
    Sound.play('landShip');
    state = 'atmoland';
    const landingY = gy + 1.2;
    atmoLand = { t: 0, from: shipMesh.position.clone(), to: new THREE.Vector3(shipMesh.position.x, landingY, shipMesh.position.z) };
    boardYaw = atmo.yaw;   // 提前预订坐舱朝向，落地无缝
  }
  function updateAtmoLand(dt){
    atmoLand.t += dt / 1.6;
    const t = Math.min(1, atmoLand.t);
    const ease = 1 - Math.pow(1 - t, 3);
    shipMesh.position.lerpVectors(atmoLand.from, atmoLand.to, ease);
    // 从当前四元数提取 yaw，构建纯水平朝向再 slerp
    const eu = new THREE.Euler().setFromQuaternion(shipMesh.quaternion, 'YXZ');
    const targetQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, eu.y, 0, 'YXZ'));
    shipMesh.quaternion.slerp(targetQ, Math.min(1, dt * 6));
    // 追尾相机（绕目标点环绕）
    const y = eu.y;
    camera.position.set(
      shipMesh.position.x + Math.sin(y) * 8,
      shipMesh.position.y + 4,
      shipMesh.position.z + Math.cos(y) * 8);
    camera.lookAt(shipMesh.position);
    if (t >= 1){
      // 落地扬尘
      Player.spawnParticles(shipMesh.position.x - 0.5, shipMesh.position.y - 1, shipMesh.position.z - 0.5, 0xbbaa88, 14);
      shipPos.copy(atmoLand.to);
      shipHere = true;
      atmoLand = null;
      // NMS 式：降落后仍坐在舱内，E 下船 / W 再次起飞
      state = 'seated';
      seatedT = 0;
      $('spaceHud').classList.add('hidden');
      Player.pos.set(shipPos.x + 2.2, World.topAt(Math.floor(shipPos.x + 2.2), Math.floor(shipPos.z)) + 1.2, shipPos.z);
      Player.vel.set(0, 0, 0);
      camera.fov = baseFov(); camera.updateProjectionMatrix();
      Sound.loops.engine.start();
      Sound.loops.engine.set('speed', 0.04);
      UI.bigMessage('降落完成', 'E 下船 · W 再次起飞', 2200);
      lockPointer();
    }
  }
  function finishLaunch(){
    // 记录最后停泊点（地面）——爬升时已预存档则跳过，消除换系瞬间卡顿
    if (!atmo.presaved) savePlanetState();
    Space.enter(currentPlanet);
    // 连续换系：体素位置/朝向 → 太空球面位置/朝向（与再入互为精确逆映射）
    const planet = Space.planets.find(p => p.def.id === currentPlanet);
    if (planet){
      const s = voxelScale(planet);
      const lon = shipMesh.position.x * 0.004 + planet.mesh.rotation.y;
      const lat = THREE.MathUtils.clamp(shipMesh.position.z * 0.004, -1.15, 1.15);
      _pDir.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      Space.shipState.pos.copy(planet.mesh.position)
        .addScaledVector(_pDir, planet.def.radius + (shipMesh.position.y - SEA_Y) * s);
      tangentFrame(_pDir, _pEast, _pNorth);
      _mBasis3.makeBasis(_pEast, _pDir, _pNorth);
      _qBasis.setFromRotationMatrix(_mBasis3);
      // 完整姿态（含滚转微调）精确映射：太空侧相机/模型与大气侧完全一致，直飞无重置
      // （越顶爬升的大滚转由太空侧微调项快速平滑回正，无瞬间跳变也无长时间反转）
      const vq = new THREE.Quaternion().setFromEuler(new THREE.Euler(atmo.pitch, atmo.yaw, atmo.camRoll || 0, 'YXZ'));
      const sq = _qBasis.clone().multiply(vq);
      const se = new THREE.Euler().setFromQuaternion(sq, 'YXZ');
      Space.setAttitude(se.y, se.x, se.z);
      // 动量延续
      Space.shipState.speed = Math.max(24, atmo.speed * s);
    }
    clearSkyBeaconEls();
    state = 'space';
    // 突破大气层瞬间：摩擦特效闪光 + 呼啸声（冲破的爆发感）
    $('reentryFx').classList.add('show');
    setTimeout(() => { if (state !== 'atmo') $('reentryFx').classList.remove('show'); }, 450);
    Sound.play('reentry');
    $('spaceHud').classList.remove('hidden');
    Sound.Music.setMode('space');
    UI.bigMessage('冲出大气层', '按 J 长按脉冲引擎 · 准星对准目标按 E 交互');
    lockPointer();
  }
  let landAnim = null;
  // ---------- 无缝入星（NMS 式：接近星球自动再入，无加载画面）----------
  let worldLoadedFor = null;        // 当前 World 数据属于哪颗星球
  let prepState = null;             // {pid, center:[x,z]}
  let reentryT = 0;
  // ---- 大气颜色滤镜：接近星球时渐显目标星球天空色（NMS 式再入氛围）----
  let atmoTintTarget = 0, atmoTintOp = 0;
  function setAtmoTintColor(biomeKey){
    const b = BIOMES[biomeKey];
    const c = ((b.sky[0] * 255) | 0) + ',' + ((b.sky[1] * 255) | 0) + ',' + ((b.sky[2] * 255) | 0);
    const el = $('atmoTint');
    if (el.dataset.c !== c){
      el.dataset.c = c;
      el.style.background = `radial-gradient(ellipse at center, rgba(${c},0.10) 0%, rgba(${c},0.40) 66%, rgba(${c},0.72) 100%)`;
    }
  }
  function applyAtmoTint(dt){
    atmoTintOp += (atmoTintTarget - atmoTintOp) * Math.min(1, dt * 4);
    if (atmoTintOp < 0.004) atmoTintOp = 0;
    $('atmoTint').style.opacity = atmoTintOp.toFixed(3);
    atmoTintTarget = 0;   // 每帧由所在状态重新声明（不声明则自动淡出）
  }
  // ---- 星球昼夜几何：进入点相对恒星的方位角 → 当地时间 ----
  const _sunDir = new THREE.Vector3(), _relDir = new THREE.Vector3();
  function localTimeAt(planet, worldPos){
    _relDir.copy(worldPos).sub(planet.mesh.position).normalize();
    _sunDir.copy(Space.SUN_POS).sub(planet.mesh.position).normalize();
    let a = Math.atan2(_relDir.z, _relDir.x) - Math.atan2(_sunDir.z, _sunDir.x);
    return (((0.5 + a / (Math.PI * 2)) % 1) + 1) % 1;   // 0=午夜 0.25=清晨 0.5=正午 0.75=黄昏
  }
  function timeLabel(dayT){
    const hh = String((dayT * 24) | 0).padStart(2, '0');
    const mm = String(((dayT * 24 * 60) % 60) | 0).padStart(2, '0');
    const word = dayT < 0.18 ? '深夜' : dayT < 0.32 ? '清晨' : dayT < 0.68 ? '白天' : dayT < 0.82 ? '黄昏' : '深夜';
    return `${hh}:${mm} · ${word}`;
  }
  // ---- 经度 ↔ 当地时间（星球自转下，东西移动改变当地时间）----
  const LON_PER_BLOCK = 0.004;    // 体素 x → 球面经度系数（与信标映射一致）
  function localTimeAtVoxelX(planet, x){
    _sunDir.copy(Space.SUN_POS).sub(planet.mesh.position).normalize();
    const a = x * LON_PER_BLOCK + planet.mesh.rotation.y - Math.atan2(_sunDir.z, _sunDir.x);
    return (((0.5 + a / (Math.PI * 2)) % 1) + 1) % 1;
  }
  // dayTime 存 x=0 处基准时间；当地时间 = 基准 + 当前位置经度偏移
  function refWorldX(){
    if (state === 'planet') return Player.pos.x;
    if (shipMesh && (state === 'atmo' || state === 'atmoland' || state === 'launching' || state === 'seated')) return shipMesh.position.x;
    return shipPos.x;
  }
  function localDayTime(){
    // 与主世界光照/地图同源：优先真实恒星几何（HUD 时钟、地图点选、天空明暗三者恒一致）
    const sp = Space.planets.find(p => p.def.id === currentPlanet);
    if (sp) return localTimeAtVoxelX(sp, refWorldX());
    return ((dayTime + refWorldX() * LON_PER_BLOCK / (Math.PI * 2)) % 1 + 1) % 1;
  }
  // ---- 信标 ↔ 星球球面映射 ----
  function beaconsOfPlanet(pid){
    const out = [];
    // 优先从持久存档读取（太空/切换星球时可靠）
    const saved = visitedPlanets[pid];
    if (saved && saved.machines)
      for (const s of saved.machines)
        if (s.type === 'beacon') out.push({ x: s.x, z: s.z, label: (s.data && s.data.label) || '标记点', perm: !!(s.data && s.data.perm) });
    // 若当前星球恰好在内存且存档空，从 Factory 实时取（放置后还未存档的情况）
    // 须同时匹配 currentPlanet：接近未访问星球时 worldLoadedFor 已切换，但 Factory 仍持有旧星球机器
    if (out.length === 0 && pid === worldLoadedFor && pid === currentPlanet){
      for (const m of Factory.machines.values())
        if (m.type === 'beacon') out.push({ x: m.x, z: m.z, label: m.data.label || '标记点', perm: !!m.data.perm });
    }
    // 地图标记：勾选「全星系显示」的虚拟标记与永久信标同权（太空/其他星球可见、可定点登陆）
    const marks = mapMarks[pid];
    if (marks) for (const m of marks) if (m.gal) out.push({ x: m.x, z: m.z, label: m.label || '标记', perm: true });
    return out;
  }
  function beaconSphereDir(planet, b, out){
    // 体素坐标 → 经纬度（随星球自转）
    const lon = b.x * 0.004 + planet.mesh.rotation.y;
    const lat = THREE.MathUtils.clamp(b.z * 0.004, -1.15, 1.15);
    return out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
  }
  // 球面方向 → 体素坐标（beaconSphereDir 的逆映射）
  function sphereDirToVoxelF(planet, dir){
    const lat = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), -1.15, 1.15);
    let lon = Math.atan2(dir.z, dir.x) - planet.mesh.rotation.y;
    lon = ((lon + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return { x: lon / 0.004, z: lat / 0.004 };
  }
  function sphereDirToVoxel(planet, dir){
    const v = sphereDirToVoxelF(planet, dir);
    return { x: Math.round(v.x), z: Math.round(v.z) };
  }
  // 球面切平面基：east=+x（经度）方向, north=+z（纬度）方向
  function tangentFrame(dir, east, north){
    const phi = Math.atan2(dir.z, dir.x);
    const lat = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    east.set(-Math.sin(phi), 0, Math.cos(phi));
    north.set(-Math.sin(lat) * Math.cos(phi), Math.cos(lat), -Math.sin(lat) * Math.sin(phi));
  }
  const BEACON_LOCK_ANG = 0.12;   // 信标定点登陆需精确对准（约 7°）
  const SEA_Y = 16;               // 与球面表面对应的体素高度（略低于海平面20，防止球体穿透水面）
  const HANDOFF_Y = 104;          // 太空→大气 握手高度（体素）：入场留足反应高度（峰顶+树冠≈63）
  const EXIT_Y = 175;             // 大气→太空 高度（体素）：突破云层顶(≈124~158)即冲出大气，不再爬无谓的平流层
  // 信标放置/改名后即刻存档（使太空立即可见）
  function saveBeaconState(pid){
    if (!pid && pid !== 0) pid = currentPlanet;
    visitedPlanets[pid] = {
      mods: World.serialize().mods,
      machines: Factory.serialize(),
      shipPos: shipPos.toArray(),
      seed: World.seed,
      biome: SYSTEM_PLANETS[pid].biome,
    };
  }
  function prepPlanet(pid){
    if (worldLoadedFor === pid) return;                 // 已加载（如刚起飞的星球）
    if (!prepState || prepState.pid !== pid){
      World.dispose();                                   // 旧星球区块数据彻底清空——残留 block ID 与新星球 biome 冲突的根源
      const pd = SYSTEM_PLANETS[pid];
      const saved = visitedPlanets[pid];
      if (saved){
        World.init(pd.biome, saved.seed, saved.mods || null);
        prepState = { pid, center: [saved.shipPos[0], saved.shipPos[2]] };
      } else {
        World.init(pd.biome, (Math.random() * 1e9) | 0, null);
        prepState = { pid, center: [0, 0] };
      }
      worldLoadedFor = pid;
      clearScanMarkers();   // 换星球：上一颗星球的矿物/兴趣点标记全部作废
    }
  }
  function prepTick(){
    if (prepState){
      World.stream(prepState.center[0], prepState.center[1]);
      World.update(0.016, prepState.center[0], prepState.center[1]);   // 远景模拟地形提前刷好
    }
  }
  const _bDir = new THREE.Vector3();
  // 计算入点：信标（精确对准时）或 实际进入方向对应的地表位置（NMS 式）
  function computeEntry(planet){
    _relDir.copy(Space.shipState.pos).sub(planet.mesh.position).normalize();
    let target = null, bestAng = BEACON_LOCK_ANG;
    for (const b of beaconsOfPlanet(planet.def.id)){
      const ang = beaconSphereDir(planet, b, _bDir).angleTo(_relDir);
      if (ang < bestAng){ bestAng = ang; target = b; }
    }
    const e = sphereDirToVoxel(planet, _relDir);
    return { target, x: target ? target.x + 4 : e.x, z: target ? target.z + 4 : e.z };
  }
  // ---------- 真无缝：体素地形直接贴附在太空星球表面渲染 ----------
  let previewGroup = null, previewOn = false;
  let lastSurfPaint = 0, paintPhase = 0;
  let approachPid = -1;   // 正被模拟渲染的星球（远离时还原贴图）
  let lodActivePid = -1;  // 正在生成 LOD 地形块的星球（越出范围时清除残留）
  let scenePrepQ = null;   // 后台场景预备队列（逐帧一步）
  const _pDir = new THREE.Vector3(), _pEast = new THREE.Vector3(), _pNorth = new THREE.Vector3();
  const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3();
  const _pM = new THREE.Matrix4(), _pAnchor = new THREE.Vector3();
  function voxelScale(planet){ return planet.def.radius * 0.004; }   // 体素→太空缩放
  function handoffDist(planet){ return (HANDOFF_Y - SEA_Y) * voxelScale(planet); }
  function updateSurfacePreview(planet, bestD){
    if (!World.group){ detachPreview(); return; }
    if (!previewGroup){
      previewGroup = new THREE.Group();
      previewGroup.matrixAutoUpdate = false;
      Space.scene.add(previewGroup);
    }
    if (World.group.parent !== previewGroup){
      previewGroup.clear();
      previewGroup.add(World.group);   // 借用体素网格（太空态不渲染 planetScene）
      previewOn = true;
    }
    // 贴图→方块的形变：远处地形完全压扁成球面色块（与回绘贴图同貌），靠近时立体感渐长
    const fade = THREE.MathUtils.clamp((340 - bestD) / 50, 0, 1);
    const grow = THREE.MathUtils.clamp((330 - bestD) / 165, 0.08, 1);
    previewGroup.visible = fade > 0.001;
    // 球面贴图同步溶解：贴图渐隐处恰由体素地形皮肤接管——贴图“变成”方块
    Space.setSurfaceHole(planet.def.id, fade, _pDir.copy(Space.shipState.pos).sub(planet.mesh.position).normalize());
    // 船下方向 → 切平面锚点：体素 (vx, SEA_Y, vz) 精确落在球面点上
    _pDir.copy(Space.shipState.pos).sub(planet.mesh.position).normalize();
    const v = sphereDirToVoxelF(planet, _pDir);
    tangentFrame(_pDir, _pEast, _pNorth);
    const s = voxelScale(planet);
    _bx.copy(_pEast).multiplyScalar(s);
    _by.copy(_pDir).multiplyScalar(s);
    _bz.copy(_pNorth).multiplyScalar(s);
    _pM.makeBasis(_bx, _by, _bz);
    _pAnchor.copy(planet.mesh.position).addScaledVector(_pDir, planet.def.radius)
      .addScaledVector(_bx, -v.x)
      .addScaledVector(_by, -SEA_Y)
      .addScaledVector(_bz, -v.z);
    _pM.setPosition(_pAnchor);
    previewGroup.matrix.copy(_pM);
    World.setCurve(1, v.x, v.z, fade, grow, 160);   // 边缘径向淡出为圆形，消除方形贴片突兀感
  }
  function detachPreview(){
    if (previewOn && previewGroup && World.group && World.group.parent === previewGroup){
      previewGroup.remove(World.group);
      if (planetScene) planetScene.add(World.group);
    }
    if (previewOn) Space.setSurfaceHole(-1, 0, null);
    previewOn = false;
  }
  // 太空材质预热：地形着色器随空间场景一并编译（在载入屏/跃迁遮罩后面完成，运行时零编译）
  function ensureSpaceMatWarm(){
    const sc = Space.scene;
    if (sc.userData.matWarm) return;
    sc.userData.matWarm = true;
    const g = new THREE.PlaneGeometry(0.01, 0.01);
    for (const m of World.materials){
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(0, -99999, 0);
      sc.add(mesh);
    }
    renderer.compile(sc, camera);
  }
  let camBlend = null;   // 入大气相机融合
  let spaceCamBlend = null;   // 出大气相机融合
  const _qBasis = new THREE.Quaternion(), _mBasis3 = new THREE.Matrix4();
  const _skyUp = new THREE.Vector3(), _skyE = new THREE.Vector3(), _skyN = new THREE.Vector3(), _skyDir = new THREE.Vector3();
  const _sunDirL = new THREE.Vector3();
  function enterPlanetSeamless(pid){
    const pd = SYSTEM_PLANETS[pid];
    const planet = Space.planets.find(p => p.def.id === pid);
    const wasNew = visitedPlanets[pid] === undefined && pid !== landedPlanet;
    const samePlanet = sceneFor === pid && worldLoadedFor === pid;
    const s = voxelScale(planet);
    // 连续换系：太空位置/朝向 → 体素位置/朝向（无传送，无跳变）
    _pDir.copy(Space.shipState.pos).sub(planet.mesh.position).normalize();
    const vf = sphereDirToVoxelF(planet, _pDir);
    const alt = SEA_Y + (Space.shipState.pos.distanceTo(planet.mesh.position) - planet.def.radius) / s;
    const target = computeEntry(planet).target;
    const ex = vf.x, ez = vf.z;
    // 入点当地时间（面朝恒星=白天，背面=黑夜），dayTime 记为 x=0 基准时间
    const entryTime = localTimeAtVoxelX(planet, ex);
    dayTime = ((entryTime - ex * LON_PER_BLOCK / (Math.PI * 2)) % 1 + 1) % 1;
    // 切平面基（纯旋转）：体素轴 ↔ 太空轴，用于相机/机身朝向的精确换系
    tangentFrame(_pDir, _pEast, _pNorth);
    _mBasis3.makeBasis(_pEast, _pDir, _pNorth);
    _qBasis.setFromRotationMatrix(_mBasis3);
    prepPlanet(pid);
    currentPlanet = pid;
    detachPreview();                 // buildPlanetScene 会重新收编 World.group
    const saved = visitedPlanets[pid];
    if (!samePlanet){
      buildPlanetScene();
    }
    // 无论是否重建场景，机器数据都必须恢复（跨星系来回 samePlanet===true 时会跳过上方反序列化）
    if (saved){
      Factory.deserialize(saved.machines);
      shipPos.fromArray(saved.shipPos);
      shipPos.y = World.topAt(Math.floor(shipPos.x), Math.floor(shipPos.z)) + 1;
      for (const m of Factory.machines.values()){
        if (m.type === 'launchpad'){ shipPos.set(m.x + 0.5, m.y + 1, m.z + 0.5); break; }
      }
    } else if (!samePlanet){
      Factory.reset();
      // 廉价占位（真实停泊点由降落时写入），避免 findSpawn 全图探测卡顿
      shipPos.set(ex + 4, World.topAt(Math.floor(ex + 4), Math.floor(ez + 2)) + 1, ez + 2);
    }
    // 接近期间已持续预载/预备，入场无需批量补齐
    World.stream(ex, ez);
    rebuildShipMesh();   // 换船后进入星球：停驻船模型与座驾同步（同星球复用场景时不重建场景）
    if (wasNew){ flags.newPlanet = true; checkQuest(); }
    prepState = null;
    scenePrepQ = null;
    clearSpaceMarkers();
    Sound.loops.pulse.stop();
    // 大气飞行：位置/姿态/速度全部由太空态连续映射而来
    state = 'atmo';
    shipHere = false;
    const gy = World.topAt(Math.floor(ex), Math.floor(ez));
    shipMesh.position.set(ex, Math.max(alt, gy + 40), ez);
    // 完整姿态（含滚转）精确映射：太空姿态 → 体素姿态，零跳变——
    // 俯仰可暂超常规限（动态上限缓收回 ±1.2），大滚转由微调项快速平滑回正（再入自稳，无瞬间跳变）
    const shipSpaceQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      Space.shipState.pitch, Space.shipState.yaw, Space.shipState.roll + (Space.shipState.camRoll || 0), 'YXZ'));
    const qVox = _qBasis.clone().invert().multiply(shipSpaceQ);
    const ev = new THREE.Euler().setFromQuaternion(qVox, 'YXZ');
    atmo.yaw = ev.y;
    // 俯冲角入场保护：太空正对星球俯冲映射过来常是大角度俯冲，低空反应时间不足会一头砸进方块地面
    atmo.pitch = Math.max(ev.x, -0.4);
    atmo.pitchLim = Math.max(1.2, Math.abs(atmo.pitch) + 0.01);
    atmo.camRoll = ev.z;
    // 动量延续：速度按比例换算，超出大气极速的部分由空气阻力自然衰减
    atmo.speed = Math.min(110, Space.shipState.speed / s);
    atmo.roll = 0;
    atmo.warmed = false;
    atmo.presaved = false;
    // 机身初始姿态 = 精确映射姿态（模型无跳变）
    shipMesh.quaternion.copy(qVox);
    camBlend = { t: 0, dist0: 11 / s, fov0: camera.fov };   // 仅视距/FOV 比例过渡，朝向零动画
    landedPlanet = pid;
    Player.setToolVisible(false);
    $('spaceHud').classList.remove('hidden');
    // NMS 式再入：摩擦震动 + 激波火焰 + 大气摩擦特效层
    reentryT = 2.6;
    $('reentryFx').classList.add('show');
    setAtmoTintColor(pd.biome);
    Sound.play('reentry');
    Sound.Music.setMode(World.biome.haz ? 'danger' : 'planet');
    UI.bigMessage(pd.name,
      World.biome.name + ' · 当地时间 ' + timeLabel(entryTime) +
      (target ? ` · 已锁定信标「${target.label}」` : '') + ' — E 就地降落', 4000);
    lockPointer();
  }
  // 太空中接近星球 → 后台预载 + 地表贴附渲染 → 连续再入
  function seamlessApproach(){
    if (state !== 'space') return;   // 跃迁/空间站等接管态禁止再入检测
    let best = null, bestD = Infinity;
    for (const p of Space.planets){
      const d = Space.shipState.pos.distanceTo(p.mesh.position) - p.def.radius;
      if (d < bestD){ bestD = d; best = p; }
    }
    if (!best){ detachPreview(); return; }
    // 接近时大气光晕渐强
    const glow = best.mesh.children[0];
    if (glow && glow.material)
      glow.material.opacity = 0.16 + 0.3 * THREE.MathUtils.clamp(1 - (bestD - 100) / 350, 0, 1);
    // 大气颜色滤镜：距握手点 2.4 倍内渐显目标星球天空色（快要进入星球的氛围感）
    {
      const hd = handoffDist(best);
      const tf = THREE.MathUtils.clamp((hd * 2.4 - bestD) / (hd * 1.4), 0, 1);
      if (tf > 0){
        setAtmoTintColor(best.def.biome);
        atmoTintTarget = tf * 0.8;
      }
    }
    if (bestD < Space.lodRange()){
      prepPlanet(best.def.id);
      // 预载实际入点区域（随飞行方向实时更新）
      const e = computeEntry(best);
      if (prepState && prepState.pid === best.def.id) prepState.center = [e.x, e.z];
      else if (worldLoadedFor === best.def.id) World.stream(e.x, e.z);
      if (worldLoadedFor === best.def.id){
        // 整球模拟渲染（贴图回绘+浮雕位移）只在贴近时激活（<700）——远离后可靠还原原始像素贴图
        if (bestD < 700){
          Space.paintGlobe(best.def.id, World.mapColorAt, World.seed, 4);
          Space.displaceGlobe(best.def.id, World.mapHeightAt, World.seed, 4);
          approachPid = best.def.id;
          // 入点附近用真实区块数据精绘（含树木/矿物等细节）
          if (performance.now() - lastSurfPaint > 320){
            lastSurfPaint = performance.now();
            Space.paintSurfaceRegion(best.def.id, e.x, e.z, 150, World.surfaceColorAt, paintPhase);
            paintPhase = (paintPhase + 1) % 4;
          }
        }
        // 立方体球面四叉树 LOD（星球区块档位控制可见距离/密度）——独立于贴图模拟渲染
        Space.updateLOD(best.def.id, World.mapHeightAt, World.mapColorRGB, World.seed, camera.position);
        lodActivePid = best.def.id;
      }
    }
    // 远离/切换目标：贴图+浮雕整球还原为原始像素贴图（固定阈值，不随星球区块档位漂移）
    if (approachPid >= 0 && (approachPid !== best.def.id || bestD > 820)){
      Space.restoreGlobe(approachPid);
      approachPid = -1;
    }
    // 越出星球区块激活范围：清掉残留的 LOD 地形块（不再东一块西一块挂在星球上）
    if (lodActivePid >= 0 && (lodActivePid !== best.def.id || bestD > Space.lodRange() + 80)){
      Space.clearLodTiles(lodActivePid);
      lodActivePid = -1;
    }
    if (prepState || worldLoadedFor === best.def.id) prepTick();
    // 后台预备目标星球的场景/工厂/着色器（逐帧一步，摊销开销，太空态不渲染 planetScene）
    if (scenePrepQ && scenePrepQ.pid !== best.def.id) scenePrepQ = null;
    if (bestD < 480 && worldLoadedFor === best.def.id && sceneFor !== best.def.id && !scenePrepQ){
      scenePrepQ = { pid: best.def.id, step: 0 };
    }
    if (scenePrepQ && worldLoadedFor === scenePrepQ.pid){
      const q = scenePrepQ;
      if (q.step === 0){
        currentPlanet = q.pid;
        buildPlanetScene();
        q.step = 1;
      } else if (q.step === 1){
        const saved = visitedPlanets[q.pid];
        if (saved){
          Factory.deserialize(saved.machines);
          shipPos.fromArray(saved.shipPos);
          shipPos.y = World.topAt(Math.floor(shipPos.x), Math.floor(shipPos.z)) + 1;
          for (const m of Factory.machines.values()){
            if (m.type === 'launchpad'){ shipPos.set(m.x + 0.5, m.y + 1, m.z + 0.5); break; }
          }
        } else {
          Factory.reset();
          shipPos.set(0, 40, 0);   // 占位：真实停泊点由降落写入
        }
        q.step = 2;
      } else {
        renderer.compile(planetScene, camera);
        scenePrepQ = null;
      }
    }
    // 体素地形贴附在星球表面：先隐形挂载预编译，随后贴图形变为方块（无突兀切换）
    if (bestD < 600 && worldLoadedFor === best.def.id) updateSurfacePreview(best, bestD);
    else detachPreview();
    if (bestD < handoffDist(best)) enterPlanetSeamless(best.def.id);
  }
  // ---------- 曲速跃迁 3.0：星系图锁定 → 太空准星对准星系 → 脉冲引擎冲刺 → 达到跃迁速度自动点火 ----------
  let warpAnim = null;
  let warpLock = null;   // {seed, name}
  let warpAimed = false;         // 本帧准星是否对准锁定星系（updateWarpMarker 每帧刷新）
  let warpCellWarned = false;    // 冲刺就绪但缺电池：只警告一次（脱离冲刺后复位）
  const WARP_ENGAGE_SPEED = 700; // 脉冲冲刺达到此速度自动开启跃迁（脉冲极速 900）
  const _vd = new THREE.Vector3(), _vq = new THREE.Quaternion(), _ve = new THREE.Euler();   // 跃迁分支专用温存
  let warpBoxEl = null, warpArrowEl = null, warpAimEl = null;
  function setWarpLock(seed, name){
    warpLock = seed === null ? null : { seed, name: name || ('星系 #' + seed) };
    if (!warpLock) hideWarpMarker();
    Sound.play(warpLock ? 'uiOpen' : 'uiClose');
    if (warpLock) UI.bigMessage('◎ 已锁定 ' + warpLock.name, '出图后准星对准方框 → [J] 脉冲引擎全速冲刺自动跃迁（曲率电池×1）', 3600);
  }
  function galaxyLightYears(seed){ return ((seed % 9000) / 100 + 4.2).toFixed(1); }
  function hideWarpMarker(){
    warpAimed = false;
    if (warpBoxEl) warpBoxEl.style.display = 'none';
    if (warpArrowEl) warpArrowEl.style.display = 'none';
    if (warpAimEl) warpAimEl.style.display = 'none';
  }
  function updateWarpMarker(){
    if (!warpLock){ hideWarpMarker(); return; }
    if (!warpBoxEl){
      warpBoxEl = document.createElement('div');
      warpBoxEl.className = 'warpBox';
      document.body.appendChild(warpBoxEl);
      warpArrowEl = document.createElement('div');
      warpArrowEl.className = 'enemyArrow warpArrow';
      warpArrowEl.textContent = '➤';
      document.body.appendChild(warpArrowEl);
      warpAimEl = document.createElement('div');
      warpAimEl.className = 'warpAim';
      document.body.appendChild(warpAimEl);
    }
    const pos = Space.getGalaxySpritePos(warpLock.seed);
    if (!pos){ hideWarpMarker(); return; }
    _proj.copy(pos).project(camera);
    const behind = _eaV.copy(pos).applyMatrix4(camera.matrixWorldInverse).z > 0;
    if (!behind && Math.abs(_proj.x) < 0.88 && Math.abs(_proj.y) < 0.84){
      // 屏内：方框锁定标记；准星对准方框时在准星旁显示跃迁引导/冲刺进度
      warpArrowEl.style.display = 'none';
      warpArrowEl._ang = undefined;
      warpBoxEl.style.display = '';
      const W = window.innerWidth, H = window.innerHeight;
      warpBoxEl.style.left = ((_proj.x + 1) / 2 * W) + 'px';
      warpBoxEl.style.top = ((1 - _proj.y) / 2 * H) + 'px';
      _vd.copy(pos).sub(Space.shipState.pos).normalize();
      camera.getWorldDirection(_eaV);
      warpAimed = _eaV.dot(_vd) >= 0.94;
      if (warpAimed){
        warpAimEl.style.display = '';
        const st = Space.shipState;
        if (st.pulsing){
          const prog = Math.min(1, st.speed / WARP_ENGAGE_SPEED);
          warpAimEl.textContent = prog >= 1
            ? '⟠ 跃迁速度已达 · 通道展开…'
            : `${warpLock.name} · 冲刺 ${(prog * 100) | 0}% → 自动跃迁`;
        } else {
          warpAimEl.textContent = `${warpLock.name} · ${galaxyLightYears(warpLock.seed)} 光年 · [J] 脉冲冲刺跃迁`;
        }
      } else {
        warpAimEl.style.display = 'none';
      }
    } else {
      // 屏外：紫色屏缘箭头（共享 edgeAngle 不翻转算法 + 最短路径角度平滑）
      warpAimed = false;
      warpBoxEl.style.display = 'none';
      warpAimEl.style.display = 'none';
      const ang = edgeAngle(pos, warpArrowEl);
      if (ang === null){ warpArrowEl.style.display = 'none'; return; }
      placeEdgeArrow(warpArrowEl, ang);
    }
  }
  // 每帧检测：对准 + 脉冲冲刺达速 → 自动点火跃迁
  function tickWarpAutoJump(){
    if (state !== 'space' || !warpLock || !warpAimed || warpLock.seed === Space.getCurrentGalaxySeed()){
      warpCellWarned = false;
      return;
    }
    const st = Space.shipState;
    if (!st.pulsing || st.speed < WARP_ENGAGE_SPEED){
      if (!st.pulsing) warpCellWarned = false;
      return;
    }
    if (Player.countItem('warpcell') < 1){
      if (!warpCellWarned){
        warpCellWarned = true;
        Sound.play('uiError');
        UI.bigMessage('缺少曲率电池', '跃迁需曲率电池×1 — 精炼厂合成或空间站购买', 2600);
      }
      return;
    }
    engageWarpJump();
  }
  // 点火：脉冲冲刺状态无缝转入曲速（消耗电池，脉冲循环音切曲速轰鸣）
  function engageWarpJump(){
    const pos = Space.getGalaxySpritePos(warpLock.seed);
    if (!pos) return;
    const dir = pos.clone().sub(Space.shipState.pos).normalize();
    Player.removeItem('warpcell', 1);
    spaceInput.pulse = false;
    Space.shipState.pulsing = false;
    Space.shipState.pulseCharge = 0;
    Sound.loops.pulse.stop();
    Sound.play('pulseStart');
    Sound.loops.warp.start();
    hideWarpMarker();
    clearSpaceMarkers();
    state = 'warping';
    // 跃迁前确保远方星系贴图已存在（每次跃迁都刷新为最新邻域）
    Space.setGalaxySprites(neighborSeeds().map(s => ({ seed: s })));
    warpAnim = { t: 0, seed: warpLock.seed, yaw: Math.atan2(-dir.x, -dir.z), pitch: Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), phase: 0, _f: 0, v0: Space.shipState.speed };
    warpLock = null;   // 跃迁开始即解除锁定标识（但动画仍持有 seed）
    warpCellWarned = false;
    UI.bigMessage('⟠ 曲速引擎点火', '脉冲全速突破 · 跃迁通道展开', 3000);
  }
  let galaxyCount = 1;
  // 邻近星系种子（由当前星系种子确定性派生）
  function neighborSeeds(){
    const cur = Space.getCurrentGalaxySeed();
    const rnd = mulberry32((cur ^ 0x9E3779B9) >>> 0);
    const arr = [];
    for (let i = 0; i < 55; i++) arr.push((rnd() * 1e9) | 0);
    // 起源星系永远在第一顺位可见（无论你跃迁到多远都能锁定回家）
    if (cur !== HOME_GALAXY_SEED) arr.push(HOME_GALAXY_SEED);
    return arr;
  }
  function warpTo(targetSeed){
    if (state !== 'space'){ Sound.play('uiError'); return; }
    if (targetSeed === Space.getCurrentGalaxySeed()){ Sound.play('uiError'); return; }
    if (Player.countItem('warpcell') < 1){
      Sound.play('uiError');
      UI.bigMessage('缺少曲率电池', '精炼厂合成（需科技「曲率理论」）或空间站购买');
      return;
    }
    Player.removeItem('warpcell', 1);
    Sound.play('pulseStart');
    Sound.loops.pulse.start();
    state = 'warping';
    warpAnim = { t: 0, seed: targetSeed };
    UI.bigMessage('曲速引擎充能', '正在撕裂空间…');
    lockPointer();
  }
  async function finishWarp(){
    Sound.loops.warp.stop();
    Sound.play('pulseEnd');
    warpLock = null;        // 抵达即解除锁定
    hideWarpMarker();
    const prevSeed = Space.getCurrentGalaxySeed();
    const targetSeed = warpAnim.seed;
    const leavingHome = prevSeed === HOME_GALAXY_SEED;
    // 归档当前星系的星球档案（信标/建筑）+ 地图标记——返回时恢复，离开时不留痕迹在别星系
    galaxyArchives[prevSeed] = visitedPlanets;
    galaxyArchives[prevSeed + '_marks'] = mapMarks;
    detachPreview();
    const gal = await Space.warpGalaxy(targetSeed);
    previewGroup = null;        // 旧太空场景已销毁
    previewOn = false;
    scenePrepQ = null;
    ensureSpaceMatWarm();       // 新场景着色器在跃迁遮罩后面编译
    warpAnim = null;
    // 切换星系档案：去过的星系恢复旧档，新星系为空
    visitedPlanets = galaxyArchives[targetSeed] || {};
    mapMarks = galaxyArchives[targetSeed + '_marks'] || {};
    currentPlanet = 0;
    landedPlanet = -1;          // 新星系尚未着陆任何星球
    worldLoadedFor = null;      // 旧星系地形失效
    prepState = null;
    Factory.reset();            // 清空内存中旧星系的机器（防止信标泄漏到新星系的星球上）
    galaxyCount++;
    for (const k in gal.market) market[k] = gal.market[k];
    $('fader').classList.remove('show');
    state = 'space';
    Sound.Music.setMode('space');
    // 第一章目标：飞出初始星系
    if (leavingHome && !flags.warpedOut){
      flags.warpedOut = true;
      checkQuest();
      setTimeout(() => {
        Sound.play('research');
        UI.bigMessage('🏆 第一章完结', '你离开了起源星系 — 宇宙没有边界，旅程仍在继续', 6000);
      }, 4500);
    }
    UI.bigMessage(`✦ ${gal.name}`, `${gal.planets.length} 颗未知星球在呼唤 · 按 C 扫描本星系`, 4200);
    lockPointer();
  }

  // ---------- 空间站（重制版）：泊入/停机/行走/交易/离站全部收口在 station.js —— 主循环仅保留胶水 ----------
  let __stFrames = 0;
  $('btnUndock').style.display = 'none';   // 旧「离站」按钮弃用：离站=停机位按 W
  Station.onDocked = () => {
    flags.docked = true;
    Sound.Music.setMode('station');
    checkQuest();
  };
  // ---------- 玩家飞船档案（NMS 式等级/武器/货仓）+ 飞船仓库 ----------
  let playerShip = { model: 'ship', cls: 'C', name: '拓荒者号', inv: Array(12).fill(null) };
  let shipGarage = [];
  const SHIP_STACK_MULT = 5;   // 飞船货仓单格容量 = 随身堆叠上限 ×5（NMS 式大容量货格）
  function shipMaxFor(id){ return ((window.ITEMS && ITEMS[id] && ITEMS[id].stack) || 99) * SHIP_STACK_MULT; }
  // ---- 舱内物资联通：计数/消耗贯通「随身背包 + 飞船货仓」----
  // 曲率电池、合成材料等存进飞船也能直接使用（NMS 手感）；扣除顺序：先随身后货仓
  {
    const _cnt = Player.countItem, _rm = Player.removeItem;
    const shipCount = id => {
      let n = 0;
      for (const s of playerShip.inv) if (s && s.item === id) n += s.n;
      return n;
    };
    const shipDeduct = (id, n) => {
      for (let i = 0; i < playerShip.inv.length && n > 0; i++){
        const s = playerShip.inv[i];
        if (s && s.item === id){
          const t = Math.min(s.n, n);
          s.n -= t; n -= t;
          if (s.n <= 0) playerShip.inv[i] = null;
        }
      }
      if (document.getElementById('shipSect')) refreshShipPanel();
    };
    Player.countItem = id => _cnt(id) + shipCount(id);
    Player.removeItem = (id, n = 1) => {
      const suit = _cnt(id);
      if (suit >= n) return _rm(id, n);
      if (suit + shipCount(id) < n) return false;
      if (suit > 0) _rm(id, suit);
      shipDeduct(id, n - suit);
      return true;
    };
    Player.hasItems = costs => Object.keys(costs).every(k => Player.countItem(k) >= (costs[k] || 0));
    Player.payItems = costs => {
      if (!Player.hasItems(costs)) return false;
      for (const k in costs) Player.removeItem(k, costs[k]);
      return true;
    };
  }
  function shipWeapon(cls){ return (Space.SHIP_CLASSES[cls] || Space.SHIP_CLASSES.C).weapon; }
  function syncShipLoadout(){
    // 武器随当前座驾等级；太空侧/星球侧模型同步
    Space.shipState.weapon = shipWeapon(playerShip.cls);
    Space.setShipModel(playerShip.model);
    rebuildShipMesh();
  }
  // 星球侧停驻船模型重建（换船后进入星球模型保持一致；位置/朝向原地保留）
  function rebuildShipMesh(){
    if (!shipMesh || !planetScene) return;
    if (shipMesh.userData.model === playerShip.model) return;
    const old = shipMesh;
    shipMesh = buildLandedShip();
    shipMesh.position.copy(old.position);
    shipMesh.quaternion.copy(old.quaternion);
    planetScene.remove(old);
    planetScene.add(shipMesh);
  }
  // 购买驾驶员的飞船（station.js 两步确认后回调）：扣款 → 旧船入库 → 新船成为座驾
  Station.onBuyShip = (v) => {
    const u = v.userData;
    if (Player.credits < u.price){
      Sound.play('uiError');
      UI.bigMessage('信用点不足', `需要 ¥${u.price.toLocaleString()}，当前 ¥${Player.credits.toLocaleString()}`, 2600);
      return false;
    }
    Player.credits -= u.price;
    // 旧座驾入库（含货仓物资），新船上岗（货仓全空）
    shipGarage.push(playerShip);
    playerShip = {
      model: u.model, cls: u.cls,
      name: (Space.SHIP_MODEL_NAMES[u.model] || u.model) + '·' + u.cls,
      inv: Array(Space.SHIP_CLASSES[u.cls].slots).fill(null),
    };
    syncShipLoadout();
    Space.removeVisitorShip(v);   // 原船主的船消失（已是你的了——由换船电脑调度）
    Station.closeDialog();
    Sound.play('buy');
    UI.bigMessage('✦ 购得 ' + playerShip.name, `${u.cls} 级 · ${Space.SHIP_CLASSES[u.cls].wName} · 货仓 ${Space.SHIP_CLASSES[u.cls].slots} 格 — 旧船已存入飞船仓库`, 4200);
    flags.traded = true; checkQuest();
    refreshShipPanel();
    return true;
  };
  // ---------- 换船电脑：飞船仓库面板（动态注入 DOM，不改 index.html）----------
  let garagePanelEl = null;
  function ensureGaragePanel(){
    if (garagePanelEl) return garagePanelEl;
    garagePanelEl = document.createElement('div');
    garagePanelEl.id = 'garagePanel';
    garagePanelEl.className = 'panel hidden';
    garagePanelEl.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:520px;max-height:70vh;overflow:auto;z-index:60';
    document.body.appendChild(garagePanelEl);
    // 纳入全局面板体系（anyPanelOpen/closeAll 感知）
    const _apo = UI.anyPanelOpen, _ca = UI.closeAll;
    UI.anyPanelOpen = () => _apo() || !garagePanelEl.classList.contains('hidden');
    UI.closeAll = () => { _ca(); garagePanelEl.classList.add('hidden'); };
    return garagePanelEl;
  }
  function clsColor(cls){ return (Space.SHIP_CLASSES[cls] || {}).col || '#9aa6b2'; }
  function shipCardHTML(s, idx){
    const C = Space.SHIP_CLASSES[s.cls];
    const used = s.inv.filter(x => x).length;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #234;margin:6px 0;border-radius:6px;background:rgba(10,25,32,0.6)">
      <div style="font-size:22px;font-weight:bold;color:${clsColor(s.cls)};width:34px;text-align:center">${s.cls}</div>
      <div style="flex:1"><b>${s.name}</b><br><small>${C.wName} · 货仓 ${used}/${C.slots}</small></div>
      ${idx >= 0 ? `<button class="boot-btn small" data-swap="${idx}">换乘</button>` : '<small style="color:#7dd">当前座驾</small>'}
    </div>`;
  }
  function openGaragePanel(){
    const el = ensureGaragePanel();
    document.exitPointerLock && document.exitPointerLock();
    el.innerHTML = `<h2>⬡ 舰船调度终端</h2>
      <p style="color:#9ad">更换座驾：所选飞船将生成在你的停机位上，现座驾归库。</p>
      ${shipCardHTML(playerShip, -1)}
      <h3 style="margin-top:10px">飞船仓库（${shipGarage.length}）</h3>
      ${shipGarage.length ? shipGarage.map((s, i) => shipCardHTML(s, i)).join('') : '<p><small>仓库空空如也——去和停机坪上的驾驶员聊聊吧。</small></p>'}
      <button class="boot-btn small" data-close="1" style="margin-top:8px">关闭</button>`;
    el.classList.remove('hidden');
    Sound.play('uiOpen');
    el.onclick = ev => {
      const b = ev.target;
      if (b.dataset && b.dataset.close){ el.classList.add('hidden'); Sound.play('uiClose'); lockPointer(); return; }
      if (b.dataset && b.dataset.swap !== undefined){
        const i = +b.dataset.swap;
        const chosen = shipGarage[i];
        if (!chosen) return;
        // 换乘：现座驾入库，所选船出库上岗（同一停机位原地重生成）
        shipGarage[i] = playerShip;
        playerShip = chosen;
        syncShipLoadout();
        Sound.play('craft');
        UI.bigMessage('已换乘 ' + playerShip.name, `${playerShip.cls} 级 · ${Space.SHIP_CLASSES[playerShip.cls].wName}`, 3000);
        openGaragePanel();   // 刷新列表
        refreshShipPanel();
      }
    };
  }
  Station.onGarage = openGaragePanel;
  // ---------- 背包分页窗口（NMS 式：行囊 / 飞船 双页签 + 座驾 3D 预览）----------
  let invTabMode = 'suit';
  let shipPrev = null;   // {renderer, scene, camera, holder, canvas, model}
  function buildInvTabs(){
    if (document.getElementById('invTabs')) return;
    const grid = $('invGrid');
    if (!grid) return;
    const body = grid.parentElement;
    // 页签栏
    const tabs = document.createElement('div');
    tabs.id = 'invTabs';
    tabs.innerHTML = `<button class="invtab on" data-t="suit">◢ 行囊 · EXOSUIT</button><button class="invtab" data-t="ship">◢ 飞船 · STARSHIP</button>`;
    body.insertBefore(tabs, body.firstChild);
    // 行囊页：把原有内容整体收编
    const suit = document.createElement('div');
    suit.id = 'invSuitTab';
    while (tabs.nextSibling) suit.appendChild(tabs.nextSibling);
    body.appendChild(suit);
    // 飞船页：3D 预览 + 档案 + 货舱（shipSect 由 refreshShipPanel 挂入）
    const ship = document.createElement('div');
    ship.id = 'invShipTab';
    ship.className = 'hidden';
    ship.innerHTML = `<div id="shipPrevWrap"></div>`;
    body.appendChild(ship);
    tabs.querySelectorAll('.invtab').forEach(b => {
      b.onclick = () => {
        Sound.play('uiClick');
        invTabMode = b.dataset.t;
        tabs.querySelectorAll('.invtab').forEach(x => x.classList.toggle('on', x === b));
        suit.classList.toggle('hidden', invTabMode !== 'suit');
        ship.classList.toggle('hidden', invTabMode !== 'ship');
        if (invTabMode === 'ship'){ refreshShipPanel(); ensureShipPreview(); }
      };
    });
  }
  function ensureShipPreview(){
    const wrap = document.getElementById('shipPrevWrap');
    if (!wrap) return;
    if (!shipPrev){
      const canvas = document.createElement('canvas');
      canvas.width = 560; canvas.height = 240;
      canvas.id = 'shipPrevCanvas';
      wrap.appendChild(canvas);
      const renderer2 = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer2.setSize(560, 240, false);
      const scene2 = new THREE.Scene();
      scene2.add(new THREE.AmbientLight(0x8899aa, 0.5));
      const key = new THREE.DirectionalLight(0xfff2d0, 1.3); key.position.set(3, 5, 4); scene2.add(key);
      const rim = new THREE.DirectionalLight(0x35e0e8, 0.8); rim.position.set(-4, 2, -3); scene2.add(rim);
      const cam2 = new THREE.PerspectiveCamera(38, 560 / 240, 0.1, 100);
      cam2.position.set(0, 2.4, 8.2);
      cam2.lookAt(0, 0.9, 0);
      // 全息展台：双环底座
      const ring1 = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.72, 48), new THREE.MeshBasicMaterial({ color: 0x35e0e8, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      ring1.rotation.x = -Math.PI / 2; ring1.position.y = -0.6; scene2.add(ring1);
      const ring2 = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.16, 48), new THREE.MeshBasicMaterial({ color: 0x35e0e8, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
      ring2.rotation.x = -Math.PI / 2; ring2.position.y = -0.6; scene2.add(ring2);
      const holder = new THREE.Group();
      scene2.add(holder);
      shipPrev = { renderer: renderer2, scene: scene2, camera: cam2, holder, canvas, model: null, ring1 };
    }
    if (shipPrev.model !== playerShip.model){
      shipPrev.model = playerShip.model;
      shipPrev.holder.clear();
      const m = window.ModelLib && ModelLib.get(playerShip.model, 4.6, { ground: false, yaw: playerShip.model === 'ship' ? 0 : Math.PI });
      if (m){ m.position.y = 0.6; shipPrev.holder.add(m); }
    }
  }
  function tickShipPreview(dt){
    if (!shipPrev || invTabMode !== 'ship') return;
    if ($('invPanel').classList.contains('hidden')) return;
    shipPrev.holder.rotation.y += dt * 0.7;
    shipPrev.ring1.rotation.z += dt * 0.3;
    shipPrev.renderer.render(shipPrev.scene, shipPrev.camera);
  }
  function itemName(id){
    return (window.ITEMS && ITEMS[id] && ITEMS[id].name) || (window.BLOCKS && BLOCKS[id] && BLOCKS[id].name) || id;
  }
  function refreshShipPanel(){
    buildInvTabs();
    let sect = document.getElementById('shipSect');
    if (!sect){
      const host = document.getElementById('invShipTab') || $('invGrid').parentElement;
      sect = document.createElement('div');
      sect.id = 'shipSect';
      host.appendChild(sect);
    }
    ensureShipPreview();
    const C = Space.SHIP_CLASSES[playerShip.cls];
    let html = `<h3 style="margin:10px 0 4px">✦ 座驾 ${playerShip.name}
      <span style="color:${clsColor(playerShip.cls)};border:1px solid ${clsColor(playerShip.cls)};padding:0 6px;border-radius:4px">${playerShip.cls} 级</span>
      <small style="color:#9ad"> ${C.wName} · 仓库存船 ${shipGarage.length} 艘 · 货格容量 ×${SHIP_STACK_MULT}</small></h3>
      <p style="margin:2px 0"><small>飞船货仓：手持物品（背包/快捷栏点击拿起）点击格子存入 · 空手点击取出 · 单格可堆 ${SHIP_STACK_MULT} 倍上限</small></p>
      <div class="slot-grid" id="shipInvGrid">`;
    for (let i = 0; i < playerShip.inv.length; i++){
      html += `<div class="slot" data-ssi="${i}"></div>`;
    }
    html += '</div>';
    sect.innerHTML = html;
    sect.querySelectorAll('[data-ssi]').forEach(el => {
      const i = +el.dataset.ssi;
      const s = playerShip.inv[i];
      if (s){
        // 真实物品图标（与背包同源渲染），数量徽章右下
        try { el.appendChild(Icons.img(s.item)); } catch(e){}
        const c = document.createElement('span');
        c.className = 'cnt';
        c.textContent = s.n > 1 ? s.n : '';
        el.appendChild(c);
        el.title = itemName(s.item) + ' ×' + s.n;
      }
      el.onclick = () => shipSlotClick(i);
    });
  }
  function shipSlotClick(i){
    const s = playerShip.inv[i];
    const cur = UI.getCursor && UI.getCursor();
    if (cur){
      // 手持物品 → 存入/合并（货仓大格：上限 = 随身堆叠 ×5）/ 交换
      if (!s){
        playerShip.inv[i] = { item: cur.item, n: cur.n };
        UI.setCursor(null);
      } else if (s.item === cur.item){
        const add = Math.min(cur.n, shipMaxFor(s.item) - s.n);
        if (add <= 0){ Sound.play('uiError'); return; }
        s.n += add; cur.n -= add;
        UI.setCursor(cur.n > 0 ? cur : null);
      } else {
        playerShip.inv[i] = { item: cur.item, n: cur.n };
        UI.setCursor({ ...s });
      }
      Sound.play('insert');
    } else if (s){
      // 空手点击：整格取出（背包放不下的留在货仓）
      const moved = Player.addItem(s.item, s.n);
      if (moved <= 0){ Sound.play('uiError'); UI.bigMessage('背包已满', '', 1200); return; }
      s.n -= moved;
      if (s.n <= 0) playerShip.inv[i] = null;
      Sound.play('insert');
    } else {
      // 空手点空格：回退旧流程——热栏选中物整组存入
      const ser = Player.serialize();
      const sel = Player.hotIdx >= 0 ? ser.inv[Player.hotIdx] : null;
      if (!sel){ Sound.play('uiError'); UI.bigMessage('先拿起或在热栏选中要存入的物品', '', 1600); return; }
      Player.removeItem(sel.item, sel.n);
      playerShip.inv[i] = { item: sel.item, n: sel.n };
      Sound.play('insert');
    }
    refreshShipPanel();
    UI.refreshAll && UI.refreshAll();
  }
  // 背包打开时同步刷新飞船栏（保留原返回值：togglePlanetMap 等依赖它判断面板开合）
  {
    const _tg = UI.toggle;
    UI.toggle = (id) => {
      const r = _tg(id);
      if (id === 'invPanel' && r) refreshShipPanel();
      return r;
    };
  }

  // ---------- 存档（多槽位）----------
  const INDEX_KEY = 'starforge_index';
  const LEGACY_KEY = 'starforge_save1';
  let activeSaveKey = null;

  function listSaves(){
    // 迁移旧版单存档
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy){
        const idx = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
        const key = 'starforge_sv_legacy';
        localStorage.setItem(key, legacy);
        const d = JSON.parse(legacy);
        idx.push({ key, name: '旧档案', time: Date.now(), creative: false,
          planetName: SYSTEM_PLANETS[d.currentPlanet || 0].name,
          credits: (d.player && d.player.credits) || 0, playMin: ((d.playTime || 0) / 60) | 0 });
        localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch(e){}
    try {
      const arr = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
      return arr.sort((a, b) => b.time - a.time);
    } catch(e){ return []; }
  }
  function writeIndex(arr){ localStorage.setItem(INDEX_KEY, JSON.stringify(arr)); }

  function buildSaveData(){
    // 仅当内存中的地形/机器确属当前星球时才归档（跃迁后在太空存档时 worldLoadedFor 为 null）
    if (worldLoadedFor !== null && worldLoadedFor === currentPlanet) savePlanetState();
    const STATION_STATES = ['station', 'docked', 'dockAnim', 'stationed', 'stationWalk', 'undockAnim'];
    return {
      v: 2, state: STATION_STATES.includes(state) ? 'space' : state,
      currentPlanet, dayTime, playTime, questIdx, flags, techState, market,
      fuelLoaded, placedCount, creative, dropMult,
      galaxySeed: Space.getCurrentGalaxySeed(), galaxyCount,
      player: Player.serialize(),
      planets: visitedPlanets,
      galaxyArchives,
      mapMarks,
      playerShip, shipGarage,   // NMS 式飞船档案与仓库
      warpLock,                 // 曲速导航锁定
      // 站内存档：出生点记在机库出口外（读档回到太空，不卡在站体几何里）
      shipState: state !== 'planet' ? {
        pos: (STATION_STATES.includes(state) && Space.getDock())
          ? Space.getDock().exit.toArray()
          : Space.shipState.pos.toArray(),
        yaw: Space.shipState.yaw, pitch: Space.shipState.pitch,
      } : null,
    };
  }
  // saveTo(key)：覆盖指定槽位；saveTo(null, name)：新建槽位
  function saveTo(key, name){
    if (state === 'menu' || state === 'loading') return false;
    if (state === 'atmo' || state === 'atmoland' || state === 'launching'){
      UI.bigMessage('飞行中无法存档', '请先降落', 1600);
      return false;
    }
    const idx = listSaves();
    if (!key){
      key = 'starforge_sv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      idx.push({ key, name: name || ('档案 ' + (idx.length + 1)) });
    }
    const entry = idx.find(s => s.key === key);
    if (!entry) return false;
    if (name) entry.name = name;
    entry.time = Date.now();
    entry.creative = creative;
    entry.planetName = SYSTEM_PLANETS[currentPlanet].name;
    entry.credits = Player.credits;
    entry.playMin = (playTime / 60) | 0;
    try {
      localStorage.setItem(key, JSON.stringify(buildSaveData()));
      writeIndex(idx);
      activeSaveKey = key;
      return true;
    } catch(e){ UI.bigMessage('存档失败', '浏览器存储空间不足，请删除旧档'); return false; }
  }
  // 快捷存档：存到当前槽位（没有则自动新建）
  function save(){
    return saveTo(activeSaveKey);
  }
  async function loadFrom(key){
    const raw = localStorage.getItem(key);
    if (!raw){ UI.bigMessage('读档失败', '档案数据丢失'); return false; }
    Sound.begin();
    const d = JSON.parse(raw);
    $('boot').classList.add('hidden');
    UI.closeAll();
    activeSaveKey = key;
    creative = !!d.creative;
    dropMult = d.dropMult || 1;
    galaxyCount = d.galaxyCount || 1;
    Space.restoreGalaxy(d.galaxySeed !== undefined ? d.galaxySeed : HOME_GALAXY_SEED);
    currentPlanet = d.currentPlanet; dayTime = d.dayTime; playTime = d.playTime || 0;
    questIdx = d.questIdx; flags = d.flags; techState = d.techState; market = d.market;
    fuelLoaded = d.fuelLoaded || 0;
    for (const k in placedCount) delete placedCount[k];
    Object.assign(placedCount, d.placedCount || {});
    visitedPlanets = d.planets || {};
    galaxyArchives = d.galaxyArchives || {};
    mapMarks = d.mapMarks || {};
    if (d.playerShip) playerShip = d.playerShip;
    shipGarage = d.shipGarage || [];
    warpLock = d.warpLock || null;
    syncShipLoadout();   // 座驾模型/武器随档案恢复（太空未初始化时 setShipModel 自动跳过并记住型号）
    Player.deserialize(d.player);
    await genPlanet(currentPlanet, false, [Player.pos.x, Player.pos.z]);
    if (d.state === 'space' && d.shipState){
      savePlanetState();
      Space.enter(currentPlanet);
      Space.shipState.pos.fromArray(d.shipState.pos);
      Space.shipState.yaw = d.shipState.yaw;
      Space.shipState.pitch = d.shipState.pitch;
      state = 'space';
      $('spaceHud').classList.remove('hidden');
      Sound.Music.setMode('space');
    }
    $('hud').classList.remove('hidden');
    $('quests').style.display = creative ? 'none' : '';
    UI.buildHotbar();
    UI.refreshAll();
    UI.bigMessage('档案恢复', '欢迎回来，旅行者' + (creative ? ' · 创造模式' : ''));
    lockPointer();
    if (window.Net) Net.onWorldReady();   // 联机：主机世界就绪，同步给访客
    return true;
  }
  function deleteSave(key){
    localStorage.removeItem(key);
    writeIndex(listSaves().filter(s => s.key !== key));
    if (activeSaveKey === key) activeSaveKey = null;
    $('btnContinue').disabled = listSaves().length === 0;
  }

  // ---------- 昼夜 ----------
  function updateDayNight(dt){
    dayTime = (dayTime + dt / DAY_LEN) % 1;
    // 太阳方向：优先按真实太空几何投影到本地切平面（与太空中的恒星方位一致，换系无跳变）
    const curSp = Space.planets.find(p => p.def.id === currentPlanet);
    let sunH;
    if (curSp){
      const refP = (state === 'atmo' || state === 'atmoland' || state === 'seated') && shipMesh ? shipMesh.position : Player.pos;
      const lon = refP.x * LON_PER_BLOCK + curSp.mesh.rotation.y;
      // 日照仅随经度/时间（与当地时间时钟一致）：南北移动/跨越纬度带边界不再突变昼夜
      _skyUp.set(Math.cos(lon), 0, Math.sin(lon));
      tangentFrame(_skyUp, _skyE, _skyN);
      _skyDir.copy(Space.SUN_POS).sub(curSp.mesh.position).normalize();
      _sunDirL.set(_skyDir.dot(_skyE), _skyDir.dot(_skyUp), _skyDir.dot(_skyN)).normalize();
      sunH = _sunDirL.y;
    } else {
      // 太空场景未初始化时回退：按当地时间近似
      const ang = localDayTime() * Math.PI * 2 - Math.PI / 2;
      sunH = Math.sin(ang);
      _sunDirL.set(Math.cos(ang) * 100, sunH * 120, 40).normalize();
    }
    const day = THREE.MathUtils.clamp(sunH * 2 + 0.3, 0, 1);
    if (sunLight){
      // 光源锚定在玩家附近（阴影相机跟随），方向 = 太阳方向（夜间保留微光）
      const lref = (state === 'atmo' || state === 'atmoland' || state === 'seated') && shipMesh ? shipMesh.position : Player.pos;
      _skyDir.set(_sunDirL.x, Math.max(0.05, _sunDirL.y), _sunDirL.z).normalize();
      sunLight.position.copy(lref).addScaledVector(_skyDir, 180);
      sunLight.target.position.copy(lref);
      sunLight.intensity = 0.25 + day * 0.85;
      ambLight.intensity = 0.16 + day * 0.24;
      hemiLight.intensity = 0.15 + day * 0.4;
      const b = World.biome;
      const skyDay = new THREE.Color(b.sky[0], b.sky[1], b.sky[2]);
      const skyNight = new THREE.Color(0x070a18);
      const sky = skyNight.clone().lerp(skyDay, day);
      // 高空过渡到太空背景（真无缝：握手高度处与太空场景底色一致）
      const spaceF = THREE.MathUtils.clamp((camera.position.y - 78) / (HANDOFF_Y - 78), 0, 1);
      sky.lerp(new THREE.Color(0x020308), spaceF);
      planetScene.background = sky;
      planetScene.fog.color.copy(sky.clone().lerp(new THREE.Color(1, 1, 1), 0.15 * day * (1 - spaceF)));
      // 高度雾：超级视距下远景由模拟地形兜底，高空趋近真空
      const altF = THREE.MathUtils.clamp((camera.position.y - 80) / 170, 0, 1);
      planetScene.fog.near = 90 + altF * 260;
      planetScene.fog.far = 1050 + altF * 650;
      // 星球曲率：高空呈球面弯曲（与太空贴附视角一致），降落过程渐变回平坦方块世界
      const curveAmt = THREE.MathUtils.clamp((camera.position.y - 62) / (HANDOFF_Y - 62), 0, 1);
      const cRef = (state === 'atmo' || state === 'atmoland' || state === 'seated') && shipMesh ? shipMesh.position : camera.position;
      World.setCurve(curveAmt, cRef.x, cRef.z);
      if (nightStars) nightStars.material.opacity = Math.max(1 - day, spaceF);
      // 逼真大气层穹顶：跟随相机，太阳方向/昼夜/高空系数实时驱动
      if (skyDome && skyDome.visible){
        skyDome.position.copy(camera.position);
        skyDomeU.uSunDir.value.copy(_sunDirL);
        skyDomeU.uDay.value = day;
        skyDomeU.uSpace.value = spaceF;
      }
      // 可见太阳：方向与平行光/太空恒星方位一致（夜晚沉入地平线），贴图与太空恒星同源
      if (planetSun){
        planetSun.position.copy(camera.position).addScaledVector(_sunDirL, 850);
        const { disc, glow, corona } = planetSun.userData;
        disc.rotation.y += dt * 0.008;   // 与太空恒星相同的自转
        // 地平线渐隐（不做高空渐隐：视直径/方位与太空恒星精确对齐，出大气切场景瞬间无缝换接）
        const op = THREE.MathUtils.clamp((sunH + 0.06) * 9, 0, 1);
        disc.material.opacity = op;
        glow.material.opacity = op;
        corona.material.opacity = op * 0.85;
        // 低角度偏暖：清晨/黄昏染橙
        const warm = THREE.MathUtils.clamp(1 - sunH * 2.2, 0, 1);
        disc.material.color.setRGB(1, 1 - warm * 0.22, 1 - warm * 0.4);
        glow.material.color.copy(disc.material.color);
        corona.material.color.copy(disc.material.color);
      }
      // 天空姊妹星球：按真实太空几何定位——对准它飞、冲出大气层即直达，方向无跳变
      // 观察点含真实海拔（爬升时近大远小连续，出大气交棒比例零跳变）
      const skyAltR = curSp ? curSp.def.radius + Math.max(0, ((state === 'atmo' || state === 'atmoland' || state === 'seated') && shipMesh ? shipMesh.position.y : Player.pos.y) - SEA_Y) * voxelScale(curSp) : 0;
      for (const sp of skyPlanets){
        const other = curSp ? Space.planets.find(p => p.def.id === sp.userData.pid) : null;
        if (!other){ sp.visible = false; continue; }
        const refP = (state === 'atmo' || state === 'atmoland' || state === 'seated') && shipMesh ? shipMesh.position : Player.pos;
        const lon = refP.x * LON_PER_BLOCK + curSp.mesh.rotation.y;
        const lat = THREE.MathUtils.clamp(refP.z * LON_PER_BLOCK, -1.15, 1.15);
        _skyUp.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
        tangentFrame(_skyUp, _skyE, _skyN);
        _skyDir.copy(other.mesh.position).sub(curSp.mesh.position).addScaledVector(_skyUp, -skyAltR);
        const dist = Math.max(1, _skyDir.length());
        _skyDir.normalize();
        const vy = _skyDir.dot(_skyUp);
        sp.visible = vy > -0.25;   // 地平线以下隐藏
        if (!sp.visible) continue;
        sp.position.set(
          camera.position.x + _skyDir.dot(_skyE) * 800,
          camera.position.y + vy * 800,
          camera.position.z + _skyDir.dot(_skyN) * 800);
        // 视直径与真实几何一致（握手瞬间与太空中的真实星球无缝衔接）
        const geoR = sp.geometry.parameters.radius;
        sp.scale.setScalar(Math.max(0.12, (800 * other.def.radius / dist) / geoR));
        // 真实星球贴图映射（按距离出雾化快照：越近越清晰，越远越朦胧——距离感）
        if (!sp.userData.texApplied && other.tex){
          const k = skyClarity(curSp.mesh.position.distanceTo(other.mesh.position));
          const snap = blurredSnapshot(other.texCanvas, k, 256, 128);
          sp.material.map = new THREE.CanvasTexture(snap);
          sp.material.map.magFilter = k > 0.75 ? THREE.NearestFilter : THREE.LinearFilter;
          sp.material.color.set(0xffffff);
          sp.material.opacity = 0.42 + 0.55 * k;
          sp.material.needsUpdate = true;
          sp.userData.texApplied = true;
        }
        // 朝向与真实星球一致：太空自转姿态映射到本地切平面坐标系
        _mBasis3.makeBasis(_skyE, _skyUp, _skyN);
        _qBasis.setFromRotationMatrix(_mBasis3);
        sp.quaternion.copy(_qBasis).invert().multiply(other.mesh.quaternion);
      }
      // 天空中的轨道空间站：与姊妹星球同一套真实几何定位（伪3D烘焙肖像，带距离朦胧）
      if (skyStation && curSp){
        const refP = (state === 'atmo' || state === 'atmoland' || state === 'seated') && shipMesh ? shipMesh.position : Player.pos;
        const lon = refP.x * LON_PER_BLOCK + curSp.mesh.rotation.y;
        const lat = THREE.MathUtils.clamp(refP.z * LON_PER_BLOCK, -1.15, 1.15);
        _skyUp.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
        tangentFrame(_skyUp, _skyE, _skyN);
        _skyDir.set(STATION_POS[0], STATION_POS[1], STATION_POS[2]).sub(curSp.mesh.position).addScaledVector(_skyUp, -skyAltR);
        const dist = Math.max(1, _skyDir.length());
        _skyDir.normalize();
        const vy = _skyDir.dot(_skyUp);
        skyStation.visible = vy > -0.2;
        if (skyStation.visible){
          skyStation.position.set(
            camera.position.x + _skyDir.dot(_skyE) * 800,
            camera.position.y + vy * 800,
            camera.position.z + _skyDir.dot(_skyN) * 800);
          // 视大小 = 真实几何换算；朝向 = 世界轴映射到本地切平面（与姊妹星球同一套换系）
          skyStation.scale.setScalar(800 / dist);
          _mBasis3.makeBasis(_skyE, _skyUp, _skyN);
          _qBasis.setFromRotationMatrix(_mBasis3);
          skyStation.quaternion.copy(_qBasis).invert();
        }
      }
      if (nightStars) nightStars.position.set(camera.position.x, 0, camera.position.z);
      // 远方星系贴图：方向经切平面换系与太空一致；夜里亮如繁星，白天淡到几乎看不见
      if (skyGalaxies.length){
        const galNight = Math.max(1 - day, spaceF);
        const refP = (state === 'atmo' || state === 'atmoland' || state === 'seated') && shipMesh ? shipMesh.position : Player.pos;
        if (curSp){
          const lon = refP.x * LON_PER_BLOCK + curSp.mesh.rotation.y;
          const lat = THREE.MathUtils.clamp(refP.z * LON_PER_BLOCK, -1.15, 1.15);
          _skyUp.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
        } else {
          _skyUp.set(0, 1, 0);
        }
        tangentFrame(_skyUp, _skyE, _skyN);
        for (const gs of skyGalaxies){
          _skyDir.copy(gs.userData.dir);
          const vy = _skyDir.dot(_skyUp);
          gs.visible = vy > -0.12;
          if (!gs.visible) continue;
          gs.position.set(
            camera.position.x + _skyDir.dot(_skyE) * 870,
            camera.position.y + vy * 870,
            camera.position.z + _skyDir.dot(_skyN) * 870);
          const horizon = THREE.MathUtils.clamp((vy + 0.04) * 6, 0, 1);
          gs.material.opacity = (0.06 + 0.84 * galNight) * horizon;
        }
      }
    }
    return day;
  }

  // ---------- 环境信息 HUD ----------
  let envT = 0;
  function refreshEnv(dt){
    envT += dt;
    if (envT < 0.5) return;
    envT = 0;
    const b = World.biome;
    if (!b) return;
    const hour = (localDayTime() * 24) | 0;
    const min = ((localDayTime() * 24 * 60) % 60) | 0;
    $('envInfo').innerHTML =
      `⬢ ${SYSTEM_PLANETS[currentPlanet].name} · ${b.name}<br>` +
      `${b.haz ? '<span style="color:#ffb347">' + b.hazName + '</span>' : '<span style="color:#7dff8a">环境宜居</span>'}` +
      ` · ${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    $('hazIcon').textContent = b.haz ? (b.haz === 'heat' ? '☀' : b.haz === 'cold' ? '❄' : b.haz === 'rad' ? '☢' : b.haz === 'storm' ? '⚡' : '☣') : '';
    $('clockHud').innerHTML = `游玩 ${(playTime / 60) | 0} 分钟 · F5 存档`;
    UI.refreshHUD();
  }

  // ---------- 交互提示 ----------
  function refreshHints(){
    if (UI.anyPanelOpen()){ UI.setInteractHint(null); return; }
    if (state === 'planet'){
      const vv = Creatures.nearestVillager(Player.pos, 3.6);
      if (vv){ UI.setInteractHint(`<b>E</b> 与 ${vv.g.userData.name} 交谈`); return; }
      if (shipHere && Player.pos.distanceTo(shipPos) < 4.5){
        if (creative) UI.setInteractHint('<b>E</b> 登船（W 起飞）🚀');
        else if (!flags.shipRepaired) UI.setInteractHint('<b>E</b> 检查飞船（修复：铁锭×10 碳×20）');
        else UI.setInteractHint(`<b>E</b> 登船入座（燃料 ${fuelLoaded >= 1 ? '已就绪' : '持有 ' + Player.countItem('fuel') + ' 枚'}）`);
        return;
      }
      const hit = Player.lookTarget(camera);
      if (hit && Factory.at(hit.x, hit.y, hit.z)){
        const mm = Factory.at(hit.x, hit.y, hit.z);
        UI.setInteractHint(mm.type === 'beacon'
          ? `<b>E</b> 设置信标「${mm.data.label || '标记点'}」`
          : `<b>E</b> 打开 ${BLOCK_BY_ID[World.get(hit.x, hit.y, hit.z)].name}`);
        return;
      }
      if (Player.stats.haz < 40 && Player.countItem('sodium') > 0){ UI.setInteractHint('<b>E</b> 使用钠为防护充能'); return; }
      if (Player.stats.o2 < 40 && Player.countItem('oxygen') > 0){ UI.setInteractHint('<b>E</b> 使用氧气补给'); return; }
      UI.setInteractHint(null);
    } else if (state === 'space'){
      const t = Space.nearestTarget();
      if (t && t.type === 'station') UI.setInteractHint('◈ 飞向机库发光入口，穿过护盾自动泊入');
      else if (t && t.type === 'planet') UI.setInteractHint(`◈ 保持飞行即可再入 ${t.def.name} 大气层`);
      else UI.setInteractHint(null);
      // 准星目标
      const ai = Space.aheadInfo(camera);
      const ti = $('targetInfo');
      if (ai){
        ti.classList.remove('hidden');
        if (ai.type === 'ship'){
          const cc = clsColor(ai.cls);
          const hpBar = '▰'.repeat(Math.max(0, Math.ceil(ai.hp / ai.hpMax * 8))) + '▱'.repeat(Math.max(0, 8 - Math.ceil(ai.hp / ai.hpMax * 8)));
          ti.innerHTML = `⚔ <span style="color:${cc}">${ai.cls} 级</span> ${Space.SHIP_MODEL_NAMES[ai.model] || ai.model}${ai.hostile ? ' <span style="color:#ff6a5e">[敌对]</span>' : ''}<br>` +
            `<span style="color:#ff9a6a">${hpBar}</span> ${ai.hp}/${ai.hpMax} · <span style="color:#5f7d8c">${ai.dist.toFixed(0)}u</span>`;
        } else if (ai.type === 'planet'){
          const pObj = Space.planets.find(p => p.def.id === ai.def.id);
          const lt = pObj ? timeLabel(localTimeAt(pObj, Space.shipState.pos)) : '';
          ti.innerHTML = `◇ ${ai.def.name} · ${BIOMES[ai.def.biome].name}<br><span style="color:#5f7d8c">${ai.dist.toFixed(0)}u · 入点当地时间 ${lt}</span>`;
        } else {
          ti.innerHTML = `◇ 轨道空间站<br><span style="color:#5f7d8c">${ai.dist.toFixed(0)}u</span>`;
        }
      } else ti.classList.add('hidden');
      $('tritVal').textContent = Player.countItem('tritium');
      const wc = Player.countItem('warpcell');
      $('pulseHint').innerHTML =
        (Space.shipState.pulsing ? '◈ 脉冲航行中' :
          Space.shipState.pulseCharge > 0 ? `脉冲充能 ${(Space.shipState.pulseCharge * 100) | 0}%` :
          Player.countItem('tritium') > 0 ? '[J] 脉冲引擎' : '⚠ 缺少氚（射击小行星获取）') +
        '<br>[C] 星系扫描 · <span style="color:#b48cff">[M] 星系地图</span>' +
        (warpLock ? `<br><span style="color:#b48cff">◎ ${warpLock.name} · 对准方框脉冲冲刺跃迁</span>` :
          wc > 0 ? `<br><span style="color:#b48cff">曲率电池 ×${wc} 就绪</span>` : '');
    }
  }

  // ---------- 主循环 ----------
  let lastT = performance.now();
  // ---------- 星球地图（M 键）：球形全息地图——拖拽旋转 / 点击标记 / 全星系或仅本星球 ----------
  let mapMarks = {};             // pid -> [{x, z, y, label, gal}]（gal=true 全星系显示，可定点登陆）
  let map3d = null;              // { renderer, scene, camera, root, sphere, tex, texCtx, texRow, texSeed, markGroup, yaw, pitch }
  let mapPending = null;         // 待添加标记 {x, z}
  let mapScopeGal = false;
  const MAP_R = 100;
  function markDir(x, z, out){
    const lon = x * 0.004;
    const lat = THREE.MathUtils.clamp(z * 0.004, -1.15, 1.15);
    return out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
  }
  function initMap3d(){
    if (map3d) return;
    const canvas = $('mapCanvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.width, canvas.height, false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04080c);
    // 昼夜光照系统：压低环境光，方向光扮演恒星——亮暗半球与主世界时间实时同步
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    const dl = new THREE.DirectionalLight(0xfff2d0, 1.15);
    dl.position.set(0.4, 0.7, 1).multiplyScalar(300);
    scene.add(dl);
    scene.add(dl.target);
    const camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 1, 1000);
    camera.position.set(0, 0, 262);
    const root = new THREE.Group();
    scene.add(root);
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a141d'; ctx.fillRect(0, 0, 512, 256);
    const tex = new THREE.CanvasTexture(c);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(MAP_R, 48, 32), new THREE.MeshLambertMaterial({ map: tex }));
    root.add(sphere);
    // 经纬网格线（全息感）
    const grid = new THREE.Mesh(new THREE.SphereGeometry(MAP_R + 0.4, 36, 18),
      new THREE.MeshBasicMaterial({ color: 0x35e0e8, wireframe: true, transparent: true, opacity: 0.06 }));
    root.add(grid);
    const markGroup = new THREE.Group();
    root.add(markGroup);
    map3d = { renderer, scene, camera, root, sphere, tex, texCtx: ctx, texRow: 1e9, texSeed: null, markGroup, yaw: 0, pitch: 0, sun: dl };
    // ---- 交互：拖拽旋转 / 点击选点 / 悬停显示标点名称 ----
    let dragging = false, moved = 0, lx = 0, ly = 0;
    canvas.addEventListener('mousedown', e => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; });
    window.addEventListener('mousemove', e => {
      if (dragging){
        const dx = e.clientX - lx, dy = e.clientY - ly;
        lx = e.clientX; ly = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        map3d.yaw += dx * 0.007;
        map3d.pitch = THREE.MathUtils.clamp(map3d.pitch + dy * 0.007, -1.4, 1.4);
      }
      // 悬停：标点投影到屏幕就近拾取（18px 容差，球背面不拾取）→ 名称提示
      const tip = $('mapTip');
      if (e.target === canvas && !dragging && !$('mapPanel').classList.contains('hidden')){
        const r2 = canvas.getBoundingClientRect();
        const mx = e.clientX - r2.left, my = e.clientY - r2.top;
        let best = null, bestD = 18;
        for (const p of map3d.markGroup.children){
          if (!p.userData.label) continue;
          _mHov.copy(p.position).applyQuaternion(map3d.root.quaternion);
          if (_mHov.z < 0) continue;   // 球背面
          _mHov.project(map3d.camera);
          const sx = (_mHov.x + 1) / 2 * r2.width, sy = (1 - _mHov.y) / 2 * r2.height;
          const d = Math.hypot(sx - mx, sy - my);
          if (d < bestD){ bestD = d; best = p; }
        }
        if (best){
          tip.textContent = best.userData.label;
          tip.style.left = Math.min(r2.width - 10, mx + 14) + 'px';
          tip.style.top = (my + 12) + 'px';
          tip.classList.remove('hidden');
          canvas.style.cursor = 'pointer';
        } else {
          tip.classList.add('hidden');
          canvas.style.cursor = '';
        }
      } else {
        tip.classList.add('hidden');
      }
    });
    window.addEventListener('mouseup', e => {
      if (!dragging) return;
      dragging = false;
      if (moved < 5 && e.target === canvas) mapClick(e);
    });
  }
  const _mRay = new THREE.Raycaster(), _mNdc = new THREE.Vector2(), _mDir = new THREE.Vector3(), _mQ = new THREE.Quaternion(), _mHov = new THREE.Vector3();
  function mapClick(e){
    const r = $('mapCanvas').getBoundingClientRect();
    _mNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    _mRay.setFromCamera(_mNdc, map3d.camera);
    const hit = _mRay.intersectObject(map3d.sphere)[0];
    if (!hit) return;
    // 世界方向 → 星球本地 → 经纬 → 体素坐标
    _mDir.copy(hit.point).applyQuaternion(_mQ.copy(map3d.root.quaternion).invert()).normalize();
    const lat = Math.asin(THREE.MathUtils.clamp(_mDir.y, -1, 1));
    let lon = Math.atan2(_mDir.z, _mDir.x);
    mapPending = {
      x: Math.round(lon / 0.004),
      z: Math.round(THREE.MathUtils.clamp(lat, -1.15, 1.15) / 0.004),
    };
    // 点选处的准确当地时间：与主世界同源（优先真实恒星几何，回退 dayTime 时钟）
    const spClk = Space.planets.find(p => p.def.id === currentPlanet);
    const tt = spClk
      ? localTimeAtVoxelX(spClk, mapPending.x)
      : ((dayTime + mapPending.x * LON_PER_BLOCK / (Math.PI * 2)) % 1 + 1) % 1;
    $('mapAddForm').classList.remove('hidden');
    $('mapAddPos').textContent = `选中坐标 X ${mapPending.x} · Z ${mapPending.z} · 当地时间 ${timeLabel(tt)}`;
    $('mapMarkName').value = '';
    $('mapMarkName').focus();
    Sound.play('uiClick');
    refreshMapMarks3d();
  }
  function addMapMark(){
    if (!mapPending) return;
    const list = mapMarks[currentPlanet] || (mapMarks[currentPlanet] = []);
    list.push({
      x: mapPending.x, z: mapPending.z,
      y: World.topAt(mapPending.x, mapPending.z) + 1,
      label: $('mapMarkName').value.trim() || ('标记' + (list.length + 1)),
      gal: mapScopeGal,
    });
    mapPending = null;
    $('mapAddForm').classList.add('hidden');
    Sound.play('craft');
    refreshMapMarkList();
    refreshMapMarks3d();
  }
  function refreshMapMarkList(){
    const box = $('mapMarkList');
    const list = mapMarks[currentPlanet] || [];
    box.innerHTML = list.length ? '' : '<div class="map-empty">— 点击星球表面添加标记 —</div>';
    list.forEach((m, i) => {
      const row = document.createElement('div');
      row.className = 'map-mark-row';
      row.innerHTML = `<span class="mm-name">${m.gal ? '✦ ' : '⚑ '}${m.label}</span>` +
        `<span class="mm-pos">${m.x},${m.z}</span>` +
        `<button class="mm-scope" title="切换显示范围">${m.gal ? '全星系' : '本星球'}</button>` +
        `<button class="mm-del" title="删除标记">✕</button>`;
      row.querySelector('.mm-scope').onclick = () => {
        m.gal = !m.gal;
        Sound.play('uiClick');
        refreshMapMarkList(); refreshMapMarks3d();
      };
      row.querySelector('.mm-del').onclick = () => {
        list.splice(i, 1);
        Sound.play('uiClose');
        refreshMapMarkList(); refreshMapMarks3d();
      };
      box.appendChild(row);
    });
  }
  const _mkDir = new THREE.Vector3();
  // 当前有效位置：驾驶/飞行中「我」= 飞船位置（两个标点重合）
  function mapRefPos(){
    return (state === 'atmo' || state === 'atmoland' || state === 'seated') && shipMesh ? shipMesh.position : Player.pos;
  }
  function mapPin(color, size){
    return new THREE.Mesh(new THREE.SphereGeometry(size || 2.2, 10, 8), new THREE.MeshBasicMaterial({ color }));
  }
  function refreshMapMarks3d(){
    if (!map3d) return;
    const g = map3d.markGroup;
    while (g.children.length) g.remove(g.children[0]);
    const put = (x, z, color, size, label) => {
      const p = mapPin(color, size);
      p.position.copy(markDir(x, z, _mkDir)).multiplyScalar(MAP_R + 1.5);
      p.userData.label = label || '';
      g.add(p);
      return p;
    };
    for (const m of (mapMarks[currentPlanet] || [])) put(m.x, m.z, m.gal ? 0xc07dff : 0xffd94d, 0, (m.gal ? '✦ ' : '⚑ ') + (m.label || '标记'));
    for (const m of Factory.machines.values()) if (m.type === 'beacon') put(m.x, m.z, 0xffa030, 0, '⚑ ' + (m.data.label || '信标'));
    // 兴趣点：村庄（绿）/ 遗迹（黄）
    for (const st of (World.structures || [])) put(st.x, st.z, st.type === 'village' ? 0x4dc86a : 0xd8b038, 1.8, (st.type === 'village' ? '⌂ ' : '🏛 ') + st.name);
    if (mapPending) put(mapPending.x, mapPending.z, 0xff4444, 2.8, '✚ 待添加标记');
    if (shipMesh && shipHere && state === 'planet')
      put(shipPos.x, shipPos.z, 0x35e0e8, 0, '⌂ 飞船');
    const ref = mapRefPos();
    // 「我」= GPS 式导航箭头：扁平指针贴在球面（白色主体+发光描边），箭头指向实际朝向
    {
      const col = state === 'planet' ? 0x7dff8a : 0x35e0e8;
      const mkArrow = (scale, color, opacity) => {
        const sh = new THREE.Shape();
        sh.moveTo(0, 3.4);        // 尖端
        sh.lineTo(2.2, -2.2);     // 右后角
        sh.lineTo(0, -1.0);       // 尾部凹口
        sh.lineTo(-2.2, -2.2);    // 左后角
        sh.closePath();
        const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: opacity < 1, opacity }));
        m.scale.setScalar(scale);
        return m;
      };
      const arrow = new THREE.Group();
      arrow.add(mkArrow(1.5, col, 0.45));      // 外层发光描边
      arrow.add(mkArrow(1.0, 0xffffff, 1));    // 白色主体
      arrow.children[1].position.z = 0.15;     // 主体略浮于描边之上
      arrow.userData.label = state === 'planet' ? '➤ 我的位置' : '➤ 我（飞船中）';
      arrow.userData.isPlayerArrow = true;
      g.add(arrow);
      map3d.playerPin = arrow;
      orientPlayerArrow();   // 立即摆好位置/朝向
    }
  }
  // 玩家箭头姿态：贴于球面（法线=径向），箭头尖指向当前航向在球面上的切向投影
  function mapRefYaw(){
    if (state === 'atmo' || state === 'atmoland') return atmo.yaw;
    if (state === 'seated') return boardYaw;
    return Player.yaw;
  }
  const _aT = new THREE.Vector3(), _aE = new THREE.Vector3(), _aN = new THREE.Vector3(), _aX = new THREE.Vector3(), _aM = new THREE.Matrix4();
  function orientPlayerArrow(){
    if (!map3d || !map3d.playerPin) return;
    const ref = mapRefPos();
    const dir = markDir(ref.x, ref.z, _mkDir);   // 径向（球面法线）
    map3d.playerPin.position.copy(dir).multiplyScalar(MAP_R + 0.8);
    // 切平面基：east（经度+）/ north（纬度+），世界 +x→east、+z→north
    const lon = ref.x * 0.004, lat = THREE.MathUtils.clamp(ref.z * 0.004, -1.15, 1.15);
    _aE.set(-Math.sin(lon), 0, Math.cos(lon));
    _aN.set(-Math.sin(lat) * Math.cos(lon), Math.cos(lat), -Math.sin(lat) * Math.sin(lon));
    const yaw = mapRefYaw();
    _aT.copy(_aE).multiplyScalar(-Math.sin(yaw)).addScaledVector(_aN, -Math.cos(yaw));
    _aT.addScaledVector(dir, -_aT.dot(dir));     // 投影到切平面
    if (_aT.lengthSq() < 1e-6) _aT.copy(_aN);
    _aT.normalize();
    _aX.crossVectors(_aT, dir).normalize();      // x = 切向 × 法线
    _aM.makeBasis(_aX, _aT, dir);                // 局部 +Y=箭头尖朝向, +Z=球面外法线
    map3d.playerPin.quaternion.setFromRotationMatrix(_aM);
  }
  function togglePlanetMap(){
    if (UI.toggle('mapPanel')){
      initMap3d();
      // 地形贴图按种子重绘（逐行摊销）
      if (map3d.texSeed !== World.seed){
        map3d.texSeed = World.seed;
        map3d.texRow = 0;
        map3d.texCtx.fillStyle = '#0a141d';
        map3d.texCtx.fillRect(0, 0, 512, 256);
      }
      // 初始朝向：正对当前位置（地面=玩家 · 飞行/驾驶=飞船）
      markDir(mapRefPos().x, mapRefPos().z, _mkDir);
      map3d.pitch = Math.asin(THREE.MathUtils.clamp(_mkDir.y, -1, 1));
      map3d.yaw = Math.atan2(_mkDir.z, _mkDir.x) - Math.PI / 2;
      mapPending = null;
      $('mapAddForm').classList.add('hidden');
      refreshMapMarkList();
      refreshMapMarks3d();
      updatePlanetMap();
    }
  }
  function tickMapPanel(){
    if (!$('mapPanel').classList.contains('hidden')) updatePlanetMap();
  }
  const _mEulQ1 = new THREE.Quaternion(), _mEulQ2 = new THREE.Quaternion();
  const _xAxis3 = new THREE.Vector3(1, 0, 0), _yAxis3 = new THREE.Vector3(0, 1, 0);
  function updatePlanetMap(){
    if (!map3d || !World.biome) return;
    // 地形逐行摊销绘制（噪声模拟渲染，与太空整球贴图同源）
    const W = 512, H = 256;
    if (map3d.texRow < H){
      const ctx = map3d.texCtx;
      const end = Math.min(H, map3d.texRow + 6);
      for (let py = map3d.texRow; py < end; py++){
        const lat = (0.5 - (py + 0.5) / H) * Math.PI;
        const wz = THREE.MathUtils.clamp(lat, -1.15, 1.15) / 0.004;
        for (let px = 0; px < W; px++){
          const lon = Math.PI - (px + 0.5) / W * (Math.PI * 2);
          const col = World.mapColorRGB(lon / 0.004, wz);
          ctx.fillStyle = 'rgb(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ')';
          ctx.fillRect(px, py, 1, 1);
        }
      }
      map3d.texRow = end;
      map3d.tex.needsUpdate = true;
    }
    // 姿态 + 玩家标记实时刷新
    _mEulQ1.setFromAxisAngle(_xAxis3, map3d.pitch);
    _mEulQ2.setFromAxisAngle(_yAxis3, map3d.yaw);
    map3d.root.quaternion.copy(_mEulQ1).multiply(_mEulQ2);
    // 昼夜光照与主世界同源：优先真实太空几何（恒星方位−星球自转），与 updateDayNight 完全一致；
    // 太空未初始化时才退回 dayTime 时钟近似——绝不出现「地图与世界两套昼夜」
    {
      const spCur = Space.planets.find(p => p.def.id === currentPlanet);
      let lonNoon;
      if (spCur){
        _sunDir.copy(Space.SUN_POS).sub(spCur.mesh.position).normalize();
        lonNoon = Math.atan2(_sunDir.z, _sunDir.x) - spCur.mesh.rotation.y;
      } else {
        lonNoon = (0.5 - dayTime) * Math.PI * 2;
      }
      _mkDir.set(Math.cos(lonNoon), 0, Math.sin(lonNoon))
        .applyQuaternion(map3d.root.quaternion)
        .multiplyScalar(300);
      map3d.sun.position.copy(_mkDir);
      map3d.sun.target.position.set(0, 0, 0);
    }
    if (map3d.playerPin){
      orientPlayerArrow();   // 位置 + 贴面姿态 + 航向实时同步
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.12;
      map3d.playerPin.scale.setScalar(pulse);
    }
    const refI = mapRefPos();
    $('mapInfo').textContent = `X ${refI.x | 0} · Z ${refI.z | 0} · 标记 ${(mapMarks[currentPlanet] || []).length} 个`;
    map3d.renderer.render(map3d.scene, map3d.camera);
  }

  // 全局错误浮出：任何未捕获异常直接大字提示 + 记入仪表——绝不允许「静默冻结」式疑难杂症
  window.addEventListener('error', ev => {
    try {
      const msg = ((ev.message || '') + ' @' + ((ev.filename || '').split('/').pop() || '') + ':' + (ev.lineno || 0)).slice(0, 160);
      window.__lastErr = msg;
      UI.bigMessage('⚠ 脚本错误', msg, 9000);
    } catch(e){}
  });
  window.addEventListener('unhandledrejection', ev => {
    try {
      window.__lastErr = ('Promise:' + (ev.reason && ev.reason.message || ev.reason)).slice(0, 160);
      UI.bigMessage('⚠ 异步错误', window.__lastErr, 9000);
    } catch(e){}
  });
  // 构建水印：右下角常驻小字（station 态升级为实时仪表：阶段/相机/朝向逐帧显示）
  {
    const bd = document.createElement('div');
    bd.textContent = 'build v82-station';
    bd.style.cssText = 'position:fixed;right:6px;bottom:4px;font-size:11px;color:rgba(160,210,230,0.85);z-index:9999;pointer-events:none;font-family:monospace;text-shadow:0 1px 2px #000';
    document.body.appendChild(bd);
    window.__stDbg = bd;
  }
  window.__V_MAIN = 'v82';
  // ================ 运行时诊断面板（F8 / Ctrl+Esc 开关）================
  let errPanelEl = null, errCache = [];
  function logErr(msg){ errCache.push(new Date().toLocaleTimeString() + ' ' + msg); if (errCache.length > 40) errCache.shift(); }
  window.logErr = logErr;
  function toggleErrPanel(){
    if (!errPanelEl){
      errPanelEl = document.createElement('div');
      errPanelEl.style.cssText = 'position:fixed;z-index:9999;left:0;top:0;width:100vw;height:100vh;background:rgba(4,8,14,.94);color:#c8eaff;font:12px monospace;overflow:auto;padding:16px;white-space:pre-wrap;display:none';
      document.body.appendChild(errPanelEl);
      const live = document.createElement('div');
      live.id = 'errLive';
      live.style.cssText = 'margin-bottom:12px;padding:10px;border:1px solid #35e0e8;color:#35e0e8;font:13px monospace';
      errPanelEl.appendChild(live);
      const log = document.createElement('div');
      log.id = 'errLog';
      log.style.cssText = 'color:#9ad4dc';
      errPanelEl.appendChild(log);
      setInterval(() => {
        if (errPanelEl.style.display === 'none') return;
        const r = document.getElementById('errLive');
        if (r) r.textContent = 'st:' + state + ' warp._f:' + (warpAnim ? warpAnim._f : '-') +
          ' cam:' + camera.position.x.toFixed(0) + ',' + camera.position.y.toFixed(0) + ',' + camera.position.z.toFixed(0) +
          ' ship:' + (Space.shipGroup ? Space.shipGroup.position.x.toFixed(0) : '-') + ',' + (Space.shipGroup ? Space.shipGroup.position.y.toFixed(0) : '-') + ',' + (Space.shipGroup ? Space.shipGroup.position.z.toFixed(0) : '-');
        const l = document.getElementById('errLog');
        if (l) l.textContent = errCache.join('\n');
      }, 500);
    }
    const show = errPanelEl.style.display === 'none';
    errPanelEl.style.display = show ? '' : 'none';
    if (show) logErr('—— 诊断面板已打开 ' + new Date().toLocaleTimeString() + ' ——');
    Sound.play(show ? 'uiOpen' : 'uiClose');
  }

  function loop(){
    requestAnimationFrame(loop);
    const now = performance.now();
    let dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    // 全帧仪表（在任何早退之前写入）：状态 | 阶段 | 帧数 | 门禁 | 数值体检（NaN 即刻现形）
    if (window.__stDbg){
      __stFrames = (__stFrames + 1) | 0;
      let ext = '';
      if (state === 'station' && window.Station && Station.walking){
        ext = ' yaw:' + (+Player.yaw).toFixed(2) + ' pit:' + (+Player.pitch).toFixed(2) +
          ' p:' + Player.pos.x.toFixed(1) + ',' + Player.pos.y.toFixed(1) + ',' + Player.pos.z.toFixed(1) +
          ' c:' + camera.position.x.toFixed(1) + ',' + camera.position.y.toFixed(1) + ',' + camera.position.z.toFixed(1);
      }
      __stDbg.textContent = 'v82 st:' + state + ' ph:' + ((window.Station && Station.phase) || '-') +
        ' f:' + __stFrames +
        ' pn:' + (UI.anyPanelOpen() ? 1 : 0) + ' lk:' + (pointerLocked ? 1 : 0) + ' kW:' + (Player.keys['KeyW'] ? 1 : 0) +
        ext + (window.__lastErr ? ' ⚠' + window.__lastErr : '');
    }
    if (state === 'menu' || state === 'loading') return;
    if (paused) return;
    playTime += dt;
    Space.tickRotation(dt);   // 星球自转：任何状态下持续推进
    applyAtmoTint(dt);        // 大气颜色滤镜（接近/再入渐显，其余状态自动淡出）
    tickAtmoScan(dt);         // 地表扫描波前动画（跨状态走完）
    tickShipPreview(dt);      // 背包飞船页 3D 预览（打开时才渲染）
    if (window.Net) Net.tick(dt);   // 联机：位置广播 + 远程玩家化身

    if (state === 'planet'){
      const day = updateDayNight(dt);
      Player.setToolVisible(true);
      if (!UI.anyPanelOpen()) Player.update(dt, camera);
      else Player.update(dt * 0, camera); // 面板打开时暂停移动但保持相机
      World.stream(Player.pos.x, Player.pos.z);
      World.update(dt, Player.pos.x, Player.pos.z);
      Factory.update(dt, day);
      Creatures.update(dt, Player.pos, World.biome);
      Creatures.tick(dt, Player.pos);
      UI.updateResearch(dt);
      UI.tickMachinePanel(dt);
      // 飞船信标闪烁
      if (shipMesh) shipMesh.userData.beacon.visible = Math.sin(now * 0.005) > 0;
      refreshEnv(dt);
      refreshHints();
      updateMarkers(dt);
      checkQuestCollect(dt);
      updateGroundClouds(dt, Player.pos.x, Player.pos.z);
      tickDialog(dt);
      tickMapPanel();
      renderer.render(planetScene, camera);
    }
    else if (state === 'seated'){
      const day = updateDayNight(dt);
      seatedT += dt;
      World.stream(shipPos.x, shipPos.z);
      World.update(dt, shipPos.x, shipPos.z);
      Factory.update(dt, day);
      Creatures.tick(dt, shipPos);
      UI.updateResearch(dt);
      // 驾驶舱视角：机尾后上方轻微悬浮感
      const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, boardYaw, 0, 'YXZ'));
      const camOff = new THREE.Vector3(0, 2.9 + Math.sin(seatedT * 1.4) * 0.05, 9.2).applyQuaternion(camQ);
      camera.position.copy(shipMesh.position).add(camOff);
      camera.quaternion.copy(camQ);
      // 怠速轻晃（基于 Y 轴常姿态 + 微小 roll 调制，不累积不翻转）
      const baseQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, boardYaw, 0, 'YXZ'));
      const wobbleAmt = Math.sin(seatedT * 2.2) * 0.006;
      baseQ.x += wobbleAmt; baseQ.z += wobbleAmt;
      baseQ.normalize();
      shipMesh.quaternion.copy(baseQ);
      if (shipMesh.userData.beacon) shipMesh.userData.beacon.visible = Math.sin(now * 0.005) > 0;
      const fuelTxt = creative ? '' : fuelLoaded >= 1 ? ' · 燃料已就绪' : ` · 燃料 ${Player.countItem('fuel')} 枚`;
      UI.setInteractHint(`<b>W</b> 点火起飞 · <b>E</b> 下船${fuelTxt}`);
      refreshEnv(dt);
      updateMarkers(dt);
      updateGroundClouds(dt, shipPos.x, shipPos.z);
      tickMapPanel();
      renderer.render(planetScene, camera);
    }
    else if (state === 'atmo'){
      const day = updateDayNight(dt);
      updateAtmo(dt);
      if (state !== 'atmo'){
        // 已冲出大气层：立即以太空姿态渲染本帧，直飞无停顿
        if (state === 'space'){
          Space.update(0, camera, { mouseDX: 0, mouseDY: 0 });
          renderer.render(Space.scene, camera);
        }
        return;
      }
      World.stream(shipMesh.position.x, shipMesh.position.z);
      World.update(dt, shipMesh.position.x, shipMesh.position.z);
      Factory.update(dt, day);
      refreshEnv(dt);
      updateMarkers(dt);
      updateGroundClouds(dt, shipMesh.position.x, shipMesh.position.z);
      Player.tickParticles(dt);   // 再入火焰/引擎尾迹粒子
      tickMapPanel();
      renderer.render(planetScene, camera);
    }
    else if (state === 'atmoland'){
      const day = updateDayNight(dt);
      updateAtmoLand(dt);
      World.update(dt, shipMesh.position.x, shipMesh.position.z);
      Factory.update(dt, day);
      refreshEnv(dt);
      updateGroundClouds(dt, shipMesh.position.x, shipMesh.position.z);
      Player.tickParticles(dt);
      renderer.render(planetScene, camera);
    }
    else if (state === 'launching'){
      launchAnim.t += dt;
      Player.setToolVisible(false);
      const t = launchAnim.t;
      shipMesh.position.y = shipPos.y + Math.pow(t, 2.2) * 14;
      shipMesh.rotation.z = Math.sin(t * 3) * 0.02;
      // 相机跟随仰望
      camera.position.set(Player.pos.x, Player.pos.y + 1.6, Player.pos.z);
      camera.lookAt(shipMesh.position);
      if (t > 0.2) Player.spawnParticles(shipMesh.position.x - 0.5, shipMesh.position.y - 1.5, shipMesh.position.z - 0.5, 0xff8c1a, 3);
      const day = updateDayNight(dt);
      Factory.update(dt, day);
      if (t > 1.8){
        shipMesh.rotation.z = 0;
        startAtmo();
      }
      renderer.render(planetScene, camera);
    }
    else if (state === 'space'){
      Space.update(dt, camera, spaceInput);
      Space.tickSpaceScan(dt);
      // 机库入口/库内 → 空间站模块整体接管（station.js 重制版）
      if (Station.tryBegin()){
        state = 'station';
        clearSpaceMarkers();   // 太空扫描标记是 HTML 元素：不清除会永远卡在屏幕上
        spaceInput.mouseDX = 0; spaceInput.mouseDY = 0;
        return;
      }
      seamlessApproach();
      spaceInput.mouseDX = 0; spaceInput.mouseDY = 0;
      if (state !== 'space') return;   // 已无缝入星（rAF 已在循环顶部调度）
      if (worldLoadedFor !== null) World.update(dt);   // 地表贴附预览的区块淡入
      if (!Space.galaxySpritesReady) Space.setGalaxySprites(neighborSeeds().map(s => ({ seed: s })));   // 远方星系贴图（惰性，跃迁后自动重建）
      $('speedVal').textContent = Space.shipState.speed.toFixed(0);
      refreshHints();
      updateSpaceMarkers();
      updateEnemyArrows();   // 敌舰出屏边缘箭头（NMS 式）
      updateWarpMarker();    // 锁定星系方框/屏缘箭头
      tickWarpAutoJump();    // 对准 + 脉冲达速 → 自动跃迁
      if (state !== 'space') return;   // 本帧已点火跃迁
      UI.updateResearch(dt);
      renderer.render(Space.scene, camera);
    }
    else if (state === 'warping'){
      try {
      // 启航→星轨 双幕：0→6s 加速驶离原星系 / 6→15s 目标旋涡星系在航向前方逐帧放大至满屏
      // 全段第三人称硬锁船尾，与进出空间站同一镜头语言（相机固定在机尾后上方不动）
      if (!warpAnim || !warpAnim._f) warpAnim._f = 0;
      warpAnim._f++;
      const ship = Space.shipGroup;
      if (!ship) return;
      const frame = warpAnim._f;
      const inLaunch = frame < 400;                        // 0→400 帧 ≈ 6.7s（启航段）
      const totalRide = 540;                              // 星轨段总帧 ≈ 9s
      const rideFrame = Math.max(0, frame - 400);
      const kRide = THREE.MathUtils.clamp(rideFrame / totalRide, 0, 1);
      // 航向：启航段缓转对齐星系，星轨段完全锁定
      if (warpAnim.yaw !== undefined){
        if (inLaunch){
          const ak = THREE.MathUtils.clamp(frame / 250, 0, 1);
          const a = 1 - (1 - ak) * (1 - ak);     // EaseOutQuad：从慢到快对齐
          Space.setAttitude(
            Space.shipState.yaw + (warpAnim.yaw - Space.shipState.yaw) * a * 0.3,
            Space.shipState.pitch + (warpAnim.pitch - Space.shipState.pitch) * a * 0.3,
            0
          );
        } else {
          Space.setAttitude(warpAnim.yaw, warpAnim.pitch, 0);
        }
      }
      // 速度：启航段 从点火时实际速度→约 4800（EaseOutQuad 无缝续接脉冲冲刺），星轨段全速
      if (inLaunch){
        const ak = THREE.MathUtils.clamp(frame / 400, 0, 1);
        const v0 = warpAnim.v0 || 30;
        Space.shipState.speed = v0 + (1 - (1 - ak) * (1 - ak)) * (4800 - v0);
      } else {
        Space.shipState.speed = 4800;
      }
      // 调用常规脉冲管线（星流/引擎/姿态—全自动，与按 J 的脉冲引擎完全一致）
      
    // 跃迁态完全手动推进——不走 Space.update（它会重置航向/位置，瞬间覆盖跃迁曲线）
    const q = ship.quaternion;
    _vd.set(0, 0, -1).applyQuaternion(q);
    Space.shipState.pos.addScaledVector(_vd, Space.shipState.speed * 0.016);
    ship.position.copy(Space.shipState.pos);
    const flames = ship.userData.flames;
    if (flames){
      const fs = 0.4 + Space.shipState.speed / 46 * 0.8 + 2;
      flames.forEach(f => { f.scale.z = fs * (0.9 + Math.random() * 0.2); f.material.opacity = 0.9; });
    }
      Space.shipState.pulseCharge = 1;
      // 硬锁镜头（船尾固定机位：每帧无条件覆写——不受 Space.update 内部相机逻辑干扰）
      {
        const q = ship.quaternion;
        _vd.set(0, 3.4, 12).applyQuaternion(q);
        camera.position.copy(ship.position).add(_vd);
        camera.quaternion.copy(q);
        camera.fov = baseFov() + 36;
        camera.matrixAutoUpdate = true;
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();
        // 诊断记录（按 F8 查看是否 camera 在动、是否追随 ship）
        if (warpAnim._f % 30 === 1) logErr('warp f:' + warpAnim._f + ' cam:(' + camera.position.x.toFixed(1) + ',' + camera.position.y.toFixed(1) + ',' + camera.position.z.toFixed(1) + ') ship:(' + ship.position.x.toFixed(1) + ',' + ship.position.y.toFixed(1) + ',' + ship.position.z.toFixed(1) + ')');
      }
      // 旋涡星系贴图：启航段其他星系慢慢变淡（驶离效果），星轨段目标星系在正前方放大
      {
        const gents = Space._galaxySprites ? Space._galaxySprites() : null;
        if (gents){
          const gsp = gents.find(e => e.seed === warpAnim.seed);
          if (gsp && gsp.origScale){
            const sk = inLaunch ? 0.0 : Math.pow(kRide, 6);
            const s = gsp.origScale.x * (0.04 + sk * 18.0);
            gsp.sprite.scale.setScalar(s);
            gsp.sprite.material.opacity = Math.min(1, sk * 1.3);
            // 目标星系推到正前方
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
            gsp.sprite.position.copy(ship.position).addScaledVector(fwd, gsp.origScale.x > 0 ? 2400 : 8200);
          }
          // 其他星系随进度渐隐（启航段缓慢淡出，星轨段几乎全黑——只留目标在视野中央发光）
          for (const g of gents){
            if (g.seed === warpAnim.seed) continue;
            if (!g.origOpacity) g.origOpacity = g.sprite.material.opacity;
            const fadeK = inLaunch ? THREE.MathUtils.clamp(frame / 400, 0, 0.9) : 0.9 + kRide * 0.1;
            g.sprite.material.opacity = THREE.MathUtils.lerp(g.origOpacity, 0, fadeK);
          }
        }
      // 曲速粒子尘：固定世界位置的漂浮光点，船以极速穿过——每帧批量前移 + 后方新生
      if (!warpAnim._dust){
        const N = 300;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
        const mat = new THREE.PointsMaterial({ color: 0xc8e4ff, size: 2.0, sizeAttenuation: false, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
        warpAnim._dust = new THREE.Points(geo, mat);
        warpAnim._dustAge = new Float32Array(N);   // 粒子寿命（秒），0=死亡需重生
        warpAnim._dustLife = new Float32Array(N);  // 粒子总寿命（秒）
        Space.scene.add(warpAnim._dust);
      }
      {
        const dgeo = warpAnim._dust.geometry;
        const dpos = dgeo.attributes.position;
        const N = dpos.count;
        const spd = Space.shipState.speed;
        const shipFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
        const shipRight = new THREE.Vector3(0, 1, 0).crossVectors(_vd.set(0, 0, -1).applyQuaternion(ship.quaternion), _vd).cross(_vd).normalize() || new THREE.Vector3(1, 0, 0);
        for (let i = 0; i < N; i++){
          let age = warpAnim._dustAge[i];
          if (age <= 0){
            // 重生：在船体周围圆柱体随机散点（稍偏后方，覆盖两侧+上下）
            const ringRad = 30 + Math.random() * 160;
            const ringAng = Math.random() * Math.PI * 2;
            const rx = Math.cos(ringAng) * ringRad;
            const ry = (Math.random() - 0.5) * 100;
            const rz = (Math.random() - 0.5) * 350;   // 重心偏后
            _vd.set(rx, ry, rz).applyQuaternion(ship.quaternion);
            dpos.setXYZ(i, Space.shipState.pos.x + _vd.x, Space.shipState.pos.y + _vd.y, Space.shipState.pos.z + _vd.z);
            warpAnim._dustAge[i] = 0.4 + Math.random() * 2.0;
            warpAnim._dustLife[i] = warpAnim._dustAge[i];
            age = warpAnim._dustAge[i];
          } else {
            // 向船头反方向（即"留在原地"被甩到后方）缓慢漂移
            const px = dpos.getX(i);
            const py = dpos.getY(i);
            const pz = dpos.getZ(i);
            // 每帧微漂（等效于风阻/惯性）——粒子留原地，船自己飞走了，视觉上粒子向后狂泻
            const drift = spd * 0.016 * (0.5 + Math.random() * 0.5);
            // 允许微小随机飘散（非严格反向，产生不规则流星雨效果）
            const dx = -shipFwd.x * drift + (Math.random() - 0.5) * 4;
            const dy = -shipFwd.y * drift + (Math.random() - 0.5) * 4;
            const dz = -shipFwd.z * drift + (Math.random() - 0.5) * 4;
            dpos.setXYZ(i, px + dx, py + dy, pz + dz);
            warpAnim._dustAge[i] -= 0.016;
          }
        }
        dpos.needsUpdate = true;
        warpAnim._dust.visible = true;
      }
      }
      // 白闪抵达
      if (!inLaunch && kRide > 0.94) $('fader').classList.add('show');
      if (kRide >= 1){
        // 清理跃迁粒子尘
        if (warpAnim._dust){ Space.scene.remove(warpAnim._dust); warpAnim._dust.geometry.dispose(); warpAnim._dust = null; }
        const anim = warpAnim;
        warpAnim = null;
        renderer.setClearColor(0xffffff); renderer.clear();
        setTimeout(() => {
          renderer.setClearColor(0x000000);
          $('fader').classList.remove('show');
          warpAnim = { t: -99, seed: anim.seed };
          finishWarp();
        }, 200);
        return;
      }
      renderer.render(Space.scene, camera);
      } catch(err){
        const em = String(err && err.message || err).slice(0, 140);
        window.__lastErr = em;
        UI.bigMessage('⚠ 跃迁模块异常', em, 9000);
        console.error('[warp]', err);
        $('fader').classList.remove('show');
        if (warpAnim && warpAnim._dust){ Space.scene.remove(warpAnim._dust); warpAnim._dust.geometry.dispose(); }
        warpAnim = { t: -99, seed: state === 'warping' && warpAnim ? warpAnim.seed : 0 };
        finishWarp();
      }
    }
    else if (state === 'station'){
      Space.tickStation(dt);
      // 铁闸：站内任何异常都不允许冻结画面——出错立即弹红字并安全弹回太空态
      let stRes;
      try {
        stRes = Station.update(dt, camera, pointerLocked, spaceInput);
      } catch(err){
        UI.bigMessage('⚠ 空间站模块异常', String(err && err.message || err).slice(0, 140), 9000);
        console.error('[station]', err);
        stRes = 'exit';
      }
      spaceInput.mouseDX = 0; spaceInput.mouseDY = 0;
      if (stRes === 'exit'){
        // 离站交棒：位置/姿态/速度连续衔接回太空飞行
        const ex = Station.exitData;
        state = 'space';
        if (ex){
          Space.shipState.pos.copy(ex.pos);
          Space.setAttitude(ex.yaw, ex.pitch, 0);
          Space.shipState.speed = 30;
        } else {
          // 异常弹出：把船挪到站外安全点，避免再次触发泊入
          const dk = Space.getDock();
          if (dk) Space.shipState.pos.copy(dk.exit);
          Space.shipState.speed = 20;
        }
        Sound.Music.setMode('space');
        $('spaceHud').classList.remove('hidden');
        lockPointer();
        return;
      }
      UI.updateResearch(dt);
      renderer.render(Space.scene, camera);
    }
  }
  // ---------- 世界标记：飞船 + 矿物/植物扫描（NMS 风格）----------
  const ORE_MARK = {
    coal_ore: { c: '#9a9a9a', ic: '◆' }, iron_ore: { c: '#d8af93', ic: '◆' },
    copper_ore: { c: '#e8935a', ic: '◆' }, titanium_ore: { c: '#e8f2f8', ic: '◈' },
    uranium_ore: { c: '#7dff56', ic: '☢' }, gold_ore: { c: '#ffd94d', ic: '◈' },
    sodium_plant: { c: '#ffd23e', ic: '✿' }, oxygen_plant: { c: '#ff6a5e', ic: '✿' },
    glow_shroom: { c: '#4ee8b8', ic: '✿' }, crystal: { c: '#7fe8e0', ic: '◈' },
    amber: { c: '#e8b84a', ic: '◈' },
  };
  const SCAN_TARGETS = ['sodium_plant', 'oxygen_plant', 'glow_shroom', 'crystal', 'amber'];
  let scanMarkers = [];        // {pos:Vector3, name, color, ic, el, expire}
  function clearScanMarkers(){
    scanMarkers.forEach(m => m.el.remove());
    scanMarkers = [];
  }
  let shipMarkerEl = null;
  let scanCd = 0, scanRing = null, scanRingT = 0;
  let atmoScanFx = null;   // 地表扫描脉冲（波前贴地扩张动画）
  const _proj = new THREE.Vector3();
  function worldToScreen(v, allowBehind){
    _proj.copy(v).project(camera);
    const behind = _proj.z > 1;
    if (behind && !allowBehind) return null;
    let x = (_proj.x + 1) / 2 * window.innerWidth;
    let y = (1 - _proj.y) / 2 * window.innerHeight;
    if (behind){ x = window.innerWidth - x; y = window.innerHeight - 50; }   // 背后目标贴下缘
    return { x, y, behind };
  }
  function makeMarkEl(cls, color, ic){
    const el = document.createElement('div');
    el.className = 'wmark ' + cls;
    if (color) el.style.color = color;
    el.innerHTML = `<span class="wm-ic">${ic}</span><span class="wm-tx"></span>`;
    $('markers').appendChild(el);
    return el;
  }
  function scanRange(){
    if (techDone('scan2')) return 80;
    if (techDone('scan1')) return 48;
    return 24;
  }
  function doScan(){
    if (scanCd > 0 || state !== 'planet') return;
    scanCd = 6;
    Sound.play('scan');
    const R = scanRange();
    // 扫描波纹
    if (!scanRing){
      scanRing = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0x35e0e8, transparent: true, opacity: 0.25, wireframe: true, depthWrite: false })
      );
      planetScene.add(scanRing);
    }
    scanRing.visible = true;
    scanRing.position.copy(Player.pos);
    scanRingT = 0;
    scanRing.userData.range = R;
    // 收集范围内矿物
    const found = [];
    const px = Math.floor(Player.pos.x), py = Math.floor(Player.pos.y), pz = Math.floor(Player.pos.z);
    for (let x = px - R; x <= px + R; x += 1){
      for (let z = pz - R; z <= pz + R; z += 1){
        const dx = x - px, dz = z - pz;
        if (dx * dx + dz * dz > R * R) continue;
        for (let y = Math.max(1, py - 24); y <= Math.min(World.WORLD_H - 1, py + 16); y++){
          const def = BLOCK_BY_ID[World.get(x, y, z)];
          if (!def) continue;
          // 矿物 + 稀有植物/资源方块（常见碳类植物不标记）
          if (def.ore || SCAN_TARGETS.includes(def.key))
            found.push({ x, y, z, key: def.key, name: def.name,
              d2: dx * dx + dz * dz + (y - py) * (y - py) });
        }
      }
    }
    found.sort((a, b) => a.d2 - b.d2);
    // 聚簇去重：同类矿 5 格内只保留一个
    const picked = [];
    for (const f of found){
      if (picked.length >= 24) break;
      if (picked.some(p => p.key === f.key && Math.abs(p.x - f.x) + Math.abs(p.y - f.y) + Math.abs(p.z - f.z) < 6)) continue;
      picked.push(f);
    }
    // 清理旧标记
    scanMarkers.forEach(m => m.el.remove());
    scanMarkers = [];
    for (const p of picked){
      const mk = ORE_MARK[p.key] || { c: '#ffffff', ic: '◆' };
      scanMarkers.push({
        pos: new THREE.Vector3(p.x + 0.5, p.y + 0.5, p.z + 0.5),
        name: p.name, color: mk.c,
        el: makeMarkEl('ore', mk.c, mk.ic),
        expire: 25,
        blockId: BLOCKS[p.key].id,   // 被挖走后标记立即消散
      });
    }
    if (picked.length){ setTimeout(() => Sound.play('scanHit'), 500); }
    UI.bigMessage(`扫描完成`, picked.length ? `发现 ${picked.length} 处矿物信号 · 范围 ${R}m` : `范围 ${R}m 内无矿物信号（研究扫描增幅可扩大范围）`, 2200);
  }
  // 飞船扫描（大气层内按 C）：探测全星球兴趣点——村庄/遗迹
  const WRAPX = Math.PI * 2 / 0.004;
  function shipScanPOI(){
    if (scanCd > 0) return;
    scanCd = 6;
    Sound.play('scan');
    const sp = shipMesh.position;
    // NMS 式地表扫描：青色波前贴地扩张扫过地形（注入地形着色器），兴趣点在波前抵达时浮现
    atmoScanFx = { t: 0, x: sp.x, z: sp.z, dur: 3.4 };
    const WAVE = 480;   // 波前速度（格/秒）
    const found = [];
    for (const st of (World.structures || [])){
      // 环球最短经度差（跨周界也能指对方向）
      let dx = st.x - sp.x;
      dx = ((dx + WRAPX / 2) % WRAPX + WRAPX) % WRAPX - WRAPX / 2;
      found.push({ st, d: Math.hypot(dx, st.z - sp.z), x: sp.x + dx });
    }
    found.sort((a, b) => a.d - b.d);
    let n = 0;
    const nowMs = performance.now();
    for (const f of found){
      if (n >= 6) break;
      n++;
      const vil = f.st.type === 'village';
      const reveal = Math.min(f.d / WAVE, 3.3) * 1000;   // 波前抵达时刻（远处封顶到动画尾）
      scanMarkers.push({
        pos: new THREE.Vector3(f.x + 0.5, World.mapHeightAt(f.x, f.st.z) + 8, f.st.z + 0.5),
        name: f.st.name, color: vil ? '#7dff8a' : '#ffd94d',
        el: makeMarkEl('ore', vil ? '#7dff8a' : '#ffd94d', vil ? '⌂' : '🏛'),
        expire: 120, poi: true, showAt: nowMs + reveal,
      });
      setTimeout(() => Sound.play('scanHit'), reveal);
    }
    UI.bigMessage('地表扫描', n ? `探测到 ${n} 处兴趣点（村庄/遗迹）` : '本星球未探测到兴趣点', 2400);
  }
  // 地表扫描脉冲推进：波前扩张 → 渐隐收场（着色器 uniform 驱动，落地/入舱也走完动画）
  function tickAtmoScan(dt){
    if (!atmoScanFx) return;
    atmoScanFx.t += dt;
    const fadeIn = Math.min(1, atmoScanFx.t * 6);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(atmoScanFx.t, atmoScanFx.dur - 0.6, atmoScanFx.dur);
    World.setScanPulse(atmoScanFx.t * 480, atmoScanFx.x, atmoScanFx.z, fadeIn * fadeOut * 0.9);
    if (atmoScanFx.t >= atmoScanFx.dur){
      World.setScanPulse(-1e9, 0, 0, 0);
      atmoScanFx = null;
    }
  }
  // 太空扫描兴趣点：邻近且已加载的星球 → 把村庄/遗迹标在星球球面上（随自转）
  function addSpacePoi(){
    let best = null, bestD = Infinity;
    for (const p of Space.planets){
      const d = Space.shipState.pos.distanceTo(p.mesh.position) - p.def.radius;
      if (d < bestD){ bestD = d; best = p; }
    }
    if (!best || worldLoadedFor !== best.def.id || bestD > Space.lodRange()) return 0;
    const marks = Space.getSpaceMarkers();
    let n = 0;
    for (const st of (World.structures || [])){
      const vil = st.type === 'village';
      marks.push({
        poi: { pid: best.def.id, x: st.x, z: st.z },
        pos: new THREE.Vector3(),
        name: st.name, color: vil ? '#7dff8a' : '#ffd94d', ic: vil ? '⌂' : '🏛',
        until: performance.now() + 150000,
      });
      n++;
    }
    return n;
  }
  function updateMarkers(dt){
    scanCd = Math.max(0, scanCd - dt);
    // 扫描波纹扩散
    if (scanRing && scanRing.visible){
      scanRingT += dt;
      const r = scanRingT * scanRing.userData.range / 0.9;
      scanRing.scale.setScalar(Math.max(0.1, r));
      scanRing.material.opacity = Math.max(0, 0.3 - scanRingT * 0.32);
      if (scanRingT > 1) scanRing.visible = false;
    }
    const inPanel = UI.anyPanelOpen();
    // 飞船标记
    if (!shipMarkerEl) shipMarkerEl = makeMarkEl('ship', null, '▼');
    const shipDist = state === 'planet' ? Player.pos.distanceTo(shipPos) : 0;
    if (state === 'planet' && shipHere && shipDist > 8 && !inPanel){
      const s = worldToScreen(shipPos.clone().add(new THREE.Vector3(0, 3, 0)), true);
      if (s){
        shipMarkerEl.style.display = '';
        shipMarkerEl.classList.remove('edge');
        shipMarkerEl.style.left = Math.max(30, Math.min(window.innerWidth - 30, s.x)) + 'px';
        shipMarkerEl.style.top = Math.max(40, Math.min(window.innerHeight - 40, s.y)) + 'px';
        shipMarkerEl.querySelector('.wm-tx').textContent = `飞船 ${shipDist.toFixed(0)}m`;
        if (s.behind || s.x < 30 || s.x > window.innerWidth - 30 || s.y < 40 || s.y > window.innerHeight - 40)
          shipMarkerEl.classList.add('edge');
      } else shipMarkerEl.style.display = 'none';
    } else shipMarkerEl.style.display = 'none';
    // 矿物/兴趣点标记
    const refPos = state === 'atmo' ? shipMesh.position : Player.pos;
    for (let i = scanMarkers.length - 1; i >= 0; i--){
      const m = scanMarkers[i];
      m.expire -= dt;
      // 消散机制：超时 / 矿被挖走 / 已经走到跟前（视为已找到）
      const arrived = refPos.distanceTo(m.pos) < (m.poi ? 24 : 3.5);
      const mined = m.blockId !== undefined &&
        World.get(Math.floor(m.pos.x), Math.floor(m.pos.y), Math.floor(m.pos.z)) !== m.blockId;
      if (m.expire <= 0 || arrived || mined){ m.el.remove(); scanMarkers.splice(i, 1); continue; }
      if (inPanel){ m.el.style.display = 'none'; continue; }
      if (m.showAt && performance.now() < m.showAt){ m.el.style.display = 'none'; continue; }   // 扫描波前未抵达
      const s = worldToScreen(m.pos);
      if (!s || s.x < 0 || s.x > window.innerWidth || s.y < 0 || s.y > window.innerHeight){
        m.el.style.display = 'none'; continue;
      }
      m.el.style.display = '';
      m.el.style.left = s.x + 'px';
      m.el.style.top = s.y + 'px';
      m.el.style.opacity = m.expire < 3 ? m.expire / 3 : 1;
      m.el.querySelector('.wm-tx').textContent = `${m.name} ${refPos.distanceTo(m.pos).toFixed(0)}m`;
    }
    // 标记方块（信标）：常驻定位标签
    updateBeaconMarkers(inPanel, refPos);
    // 全星系信标：贴在天空姊妹星球面上
    updateSkyBeaconMarkers(inPanel);
    // 联机队友标记
    updateMateMarkers(inPanel);
  }
  // ---- 联机队友标记：常驻可见（屏幕外贴边指示），地面/太空通用 ----
  let mateMarkEls = [];
  const _matePos = new THREE.Vector3();
  function updateMateMarkers(inPanel){
    const list = [];
    if (window.Net && Net.active()){
      const onPlanet = state === 'planet' || state === 'seated' || state === 'atmo' || state === 'atmoland';
      for (const r of Net.getRemotes()){
        if (onPlanet && r.planet === currentPlanet && r.st !== 'space')
          list.push({ id: r.id, pos: r.pos, ground: true });
        else if (state === 'space' && r.st === 'space')
          list.push({ id: r.id, pos: r.pos, ground: false });
      }
    }
    while (mateMarkEls.length < list.length) mateMarkEls.push(makeMarkEl('mate', '#7dff8a', '◉'));
    while (mateMarkEls.length > list.length) mateMarkEls.pop().remove();
    const refPos = state === 'space' ? Space.shipState.pos :
      (state === 'atmo' || state === 'atmoland' || state === 'seated') && shipMesh ? shipMesh.position : Player.pos;
    for (let i = 0; i < list.length; i++){
      const mk = list[i], el = mateMarkEls[i];
      if (inPanel){ el.style.display = 'none'; continue; }
      _matePos.copy(mk.pos);
      if (mk.ground) _matePos.y += 2.4;
      const dist = refPos.distanceTo(_matePos);
      if (dist < 6){ el.style.display = 'none'; continue; }   // 近在身边不标记
      const s = worldToScreen(_matePos, true);
      if (!s){ el.style.display = 'none'; continue; }
      el.style.display = '';
      el.classList.remove('edge');
      el.style.left = Math.max(30, Math.min(window.innerWidth - 30, s.x)) + 'px';
      el.style.top = Math.max(40, Math.min(window.innerHeight - 40, s.y)) + 'px';
      if (s.behind || s.x < 30 || s.x > window.innerWidth - 30 || s.y < 40 || s.y > window.innerHeight - 40)
        el.classList.add('edge');
      el.querySelector('.wm-tx').textContent =
        `队友 P${mk.id} ${state === 'space' ? (dist / 100).toFixed(1) + 'ku' : dist.toFixed(0) + 'm'}`;
    }
  }
  let beaconMarkEls = [];
  const _beaconPos = new THREE.Vector3();
  function updateBeaconMarkers(inPanel, refPos){
    const beacons = [];
    if (state === 'planet' || state === 'atmo'){
      for (const m of Factory.machines.values()){
        if (m.type === 'beacon') beacons.push(m);
      }
      // 地图标记（M 键地图上添加的虚拟标记，本星球常驻显示）
      const mk = mapMarks[currentPlanet];
      if (mk) for (const m of mk) beacons.push({ x: m.x, y: m.y || 30, z: m.z, data: { label: (m.gal ? '✦' : '') + (m.label || '标记') } });
    }
    while (beaconMarkEls.length < beacons.length){
      beaconMarkEls.push(makeMarkEl('beacon', '#ffd94d', '⚑'));
    }
    while (beaconMarkEls.length > beacons.length){
      beaconMarkEls.pop().remove();
    }
    for (let i = 0; i < beacons.length; i++){
      const b = beacons[i], el = beaconMarkEls[i];
      if (inPanel){ el.style.display = 'none'; continue; }
      _beaconPos.set(b.x + 0.5, b.y + 2.5, b.z + 0.5);
      const dist = refPos.distanceTo(_beaconPos);
      if (dist < 6){ el.style.display = 'none'; continue; }   // 太近不显示
      const s = worldToScreen(_beaconPos, true);
      if (!s){ el.style.display = 'none'; continue; }
      el.style.display = '';
      el.classList.remove('edge');
      el.style.left = Math.max(30, Math.min(window.innerWidth - 30, s.x)) + 'px';
      el.style.top = Math.max(40, Math.min(window.innerHeight - 40, s.y)) + 'px';
      if (s.behind || s.x < 30 || s.x > window.innerWidth - 30 || s.y < 40 || s.y > window.innerHeight - 40)
        el.classList.add('edge');
      el.querySelector('.wm-tx').textContent = `${b.data.label || '标记点'} ${dist.toFixed(0)}m`;
    }
  }
  // ---- 全星系信标：从其他星球地表仰望，精确贴在天空星球对应位置 ----
  let skyBeaconEls = [];
  const _viewDirS = new THREE.Vector3(), _rightS = new THREE.Vector3(), _upS = new THREE.Vector3();
  const _toSky = new THREE.Vector3(), _rightK = new THREE.Vector3(), _upK = new THREE.Vector3(), _skyPos = new THREE.Vector3();
  function updateSkyBeaconMarkers(inPanel){
    const list = [];
    const onPlanet = state === 'planet' || state === 'seated' || state === 'atmo' || state === 'atmoland';
    const curP = onPlanet ? Space.planets.find(p => p.def.id === currentPlanet) : null;
    if (curP){
      for (const p of Space.planets){
        if (p.def.id === currentPlanet) continue;
        const sky = skyPlanets.find(sp => sp.userData.pid === p.def.id);
        if (!sky) continue;
        for (const b of beaconsOfPlanet(p.def.id)){
          if (!b.perm) continue;
          // 太空真实几何：从本星球看向标记星球的视线基
          _viewDirS.copy(p.mesh.position).sub(curP.mesh.position).normalize();
          _rightS.set(0, 1, 0).cross(_viewDirS).normalize();
          _upS.copy(_viewDirS).cross(_rightS);
          beaconSphereDir(p, b, _bDir);
          const ox = _bDir.dot(_rightS), oy = _bDir.dot(_upS), oz = -_bDir.dot(_viewDirS);   // oz>0 = 信标朝向本星球
          // 映射到天空装饰星球球面（以相机→星球视线为基准）
          _toSky.copy(sky.position).sub(camera.position).normalize();
          _rightK.set(0, 1, 0).cross(_toSky).normalize();
          _upK.copy(_toSky).cross(_rightK);
          const R = sky.geometry.parameters.radius;
          _skyPos.copy(sky.position)
            .addScaledVector(_rightK, ox * R)
            .addScaledVector(_upK, oy * R)
            .addScaledVector(_toSky, -Math.max(0, oz) * R);
          list.push({ pos: _skyPos.clone(), label: b.label, pname: p.def.name, back: oz < -0.05 });
        }
      }
    }
    while (skyBeaconEls.length < list.length){
      skyBeaconEls.push(makeMarkEl('beacon', '#ffd94d', '⚑'));
    }
    while (skyBeaconEls.length > list.length){
      skyBeaconEls.pop().remove();
    }
    for (let i = 0; i < list.length; i++){
      const bk = list[i], el = skyBeaconEls[i];
      if (inPanel){ el.style.display = 'none'; continue; }
      const s = worldToScreen(bk.pos);
      if (!s || s.x < 20 || s.x > window.innerWidth - 20 || s.y < 30 || s.y > window.innerHeight - 30){
        el.style.display = 'none'; continue;
      }
      el.style.display = '';
      el.style.opacity = bk.back ? 0.55 : 1;
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
      el.querySelector('.wm-tx').textContent = `⚑ ${bk.label} · ${bk.pname}${bk.back ? '（背面）' : ''}`;
    }
  }
  function clearSkyBeaconEls(){
    skyBeaconEls.forEach(el => el.remove());
    skyBeaconEls = [];
    beaconMarkEls.forEach(el => el.remove());
    beaconMarkEls = [];
  }

  // 太空天体标记（扫描后显示）
  let spaceMarkEls = [];
  let spaceBeaconEls = [];
  const _bWorld = new THREE.Vector3();
  function updateSpaceMarkers(){
    const marks = Space.getSpaceMarkers();
    // 消散机制：超时 / 小行星已被采掘 → 移除标记
    const nowT = performance.now();
    for (let i = marks.length - 1; i >= 0; i--){
      const mk = marks[i];
      if ((mk.until && mk.until < nowT) || (mk.ast && (!mk.ast.parent || !mk.ast.visible))) marks.splice(i, 1);
    }
    // 兴趣点：贴在星球球面对应位置（随自转实时更新）
    for (const mk of marks){
      if (mk.poi){
        const p = Space.planets.find(q => q.def.id === mk.poi.pid);
        if (p){
          beaconSphereDir(p, mk.poi, _bDir);
          mk.pos.copy(_bDir).multiplyScalar(p.def.radius + 6).add(p.mesh.position);
        }
      }
    }
    // 数量对齐
    while (spaceMarkEls.length < marks.length){
      spaceMarkEls.push(makeMarkEl('ore', '#fff', '◆'));
    }
    while (spaceMarkEls.length > marks.length){
      spaceMarkEls.pop().remove();
    }
    const inPanel = UI.anyPanelOpen();
    for (let i = 0; i < marks.length; i++){
      const mk = marks[i], el = spaceMarkEls[i];
      if (inPanel || (mk.ast && !mk.ast.visible)){ el.style.display = 'none'; continue; }
      if (mk.showAt && nowT < mk.showAt){ el.style.display = 'none'; continue; }   // 扫描波前未抵达：标记按距离先后浮现
      const s = worldToScreen(mk.pos);
      if (!s || s.x < 20 || s.x > window.innerWidth - 20 || s.y < 30 || s.y > window.innerHeight - 30){
        el.style.display = 'none'; continue;
      }
      el.style.display = '';
      el.style.color = mk.color;
      el.querySelector('.wm-ic').textContent = mk.ic;
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
      el.querySelector('.wm-tx').textContent = `${mk.name} ${(Space.shipState.pos.distanceTo(mk.pos) / 100).toFixed(1)}ku`;
    }
    // 星球表面信标（常驻可见，随星球自转，朝它飞即定点登陆）
    const beaconList = [];
    for (const p of Space.planets){
      for (const b of beaconsOfPlanet(p.def.id)){
        beaconSphereDir(p, b, _bDir);
        _bWorld.copy(_bDir).multiplyScalar(p.def.radius + 10).add(p.mesh.position);
        // 非永久信标：仅显示面向我们的（容差放宽）；永久信标全程可见
        _relDir.copy(Space.shipState.pos).sub(p.mesh.position).normalize();
        if (!b.perm && _bDir.dot(_relDir) < -0.35) continue;      // 背面太远才隐藏
        beaconList.push({ pos: _bWorld.clone(), label: b.perm ? `${b.label}·${p.def.name}` : b.label });
      }
    }
    while (spaceBeaconEls.length < beaconList.length){
      spaceBeaconEls.push(makeMarkEl('beacon', '#ffd94d', '⚑'));
    }
    while (spaceBeaconEls.length > beaconList.length){
      spaceBeaconEls.pop().remove();
    }
    for (let i = 0; i < beaconList.length; i++){
      const bk = beaconList[i], el = spaceBeaconEls[i];
      if (inPanel){ el.style.display = 'none'; continue; }
      const s = worldToScreen(bk.pos);
      if (!s){ el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
      el.querySelector('.wm-tx').textContent = `⚑ ${bk.label} ${(Space.shipState.pos.distanceTo(bk.pos) / 100).toFixed(1)}ku`;
    }
    // 联机队友标记（太空态）
    updateMateMarkers(inPanel);
  }
  function clearSpaceMarkers(){
    spaceMarkEls.forEach(el => el.remove());
    spaceMarkEls = [];
    spaceBeaconEls.forEach(el => el.remove());
    spaceBeaconEls = [];
    hideEnemyArrows();
    hideWarpMarker();
  }
  // ---------- 敌舰屏幕边缘指示箭头（NMS 式：目标出屏后沿屏缘红色箭头指向其方位）----------
  let enemyArrowEls = [];
  const _eaV = new THREE.Vector3();
  // 屏缘方位角：视空间 (x,y) 方向本身就侧向连续（目标在正后方也不翻转——翻转正是乱飞根源）
  // 返回平滑后的角度；目标在屏内返回 null（el._ang 逐元素记忆用于最短路径角度插值）
  function edgeAngle(pos, el){
    _eaV.copy(pos).applyMatrix4(camera.matrixWorldInverse);
    const behind = _eaV.z > 0;
    if (!behind){
      _proj.copy(pos).project(camera);
      if (Math.abs(_proj.x) < 0.9 && Math.abs(_proj.y) < 0.85) return null;   // 屏内可见
    }
    let dx = _eaV.x, dy = _eaV.y;
    const l = Math.hypot(dx, dy);
    if (l < 1e-4){ dx = 0; dy = -1; } else { dx /= l; dy /= l; }
    let ang = Math.atan2(dy, dx);
    const prev = el._ang;
    if (prev !== undefined){
      let d = ang - prev;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      ang = prev + d * 0.3;   // 最短路径角度平滑，去抖
    }
    el._ang = ang;
    return ang;
  }
  function placeEdgeArrow(el, ang){
    const W = window.innerWidth, H = window.innerHeight;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    el.style.display = '';
    el.style.left = (W / 2 + dx * W * 0.44) + 'px';
    el.style.top = (H / 2 - dy * H * 0.42) + 'px';
    el.style.transform = `translate(-50%,-50%) rotate(${(-ang * 180 / Math.PI).toFixed(1)}deg)`;
  }
  function hideEnemyArrows(){
    for (const el of enemyArrowEls){ el.style.display = 'none'; el._ang = undefined; }
  }
  function updateEnemyArrows(){
    const hostiles = Space.hostileShips ? Space.hostileShips() : [];
    while (enemyArrowEls.length < hostiles.length){
      const el = document.createElement('div');
      el.className = 'enemyArrow';
      el.textContent = '➤';
      document.body.appendChild(el);
      enemyArrowEls.push(el);
    }
    for (let i = 0; i < enemyArrowEls.length; i++){
      const el = enemyArrowEls[i];
      const v = hostiles[i];
      if (!v){ el.style.display = 'none'; el._ang = undefined; continue; }
      const ang = edgeAngle(v.position, el);
      if (ang === null){ el.style.display = 'none'; el._ang = undefined; continue; }
      placeEdgeArrow(el, ang);
    }
  }

  // collect 类任务轮询
  let qT = 0;
  function checkQuestCollect(dt){
    qT += dt;
    if (qT > 0.5){ qT = 0; checkQuest(); }
  }

  // ---------- 菜单绑定 ----------
  const tips = [
    '「旅行者，你的飞船坠毁在了未知星球……」',
    '「传送带会跟随你放置时的视线方向。」',
    '「采矿机必须放在矿脉正上方，还需要电力。」',
    '「小行星里藏着氚——脉冲引擎的口粮。」',
    '「熔核星危险，但矿藏是别处的两倍。」',
  ];
  let tipIdx = 0;
  setInterval(() => {
    if (state !== 'menu') return;
    tipIdx = (tipIdx + 1) % tips.length;
    const el = $('bootTip');
    el.style.opacity = 0;
    setTimeout(() => { el.textContent = tips[tipIdx]; el.style.opacity = 1; }, 400);
  }, 4000);

  $('btnNew').onclick = () => {
    Sound.begin(); Sound.play('uiClick');
    $('bootMenu').classList.add('hidden');
    $('modeSelect').classList.remove('hidden');
  };
  $('btnSurvival').onclick = () => {
    Sound.play('uiClick');
    $('modeSelect').classList.add('hidden');
    $('diffSelect').classList.remove('hidden');
  };
  $('btnCreative').onclick = () => { Sound.play('uiClick'); newGame(true); };
  $('btnDiffEasy').onclick = () => { Sound.play('uiClick'); newGame(false, 7); };
  $('btnDiffNormal').onclick = () => { Sound.play('uiClick'); newGame(false, 4); };
  $('btnDiffHard').onclick = () => { Sound.play('uiClick'); newGame(false, 1); };
  $('btnDiffBack').onclick = () => {
    Sound.play('uiClose');
    $('diffSelect').classList.add('hidden');
    $('modeSelect').classList.remove('hidden');
  };
  $('btnModeBack').onclick = () => {
    Sound.play('uiClose');
    $('modeSelect').classList.add('hidden');
    $('bootMenu').classList.remove('hidden');
  };
  $('btnContinue').onclick = () => { Sound.begin(); Sound.play('uiClick'); UI.openSavePanel('load'); };
  $('btnHelp').onclick = () => { Sound.begin(); Sound.play('uiOpen'); $('helpPanel').classList.remove('hidden'); };
  $('btnHelp2').onclick = () => { Sound.play('uiOpen'); $('pausePanel').classList.add('hidden'); $('helpPanel').classList.remove('hidden'); };
  $('btnResume').onclick = () => { Sound.play('uiClose'); UI.closeAll(); lockPointer(); };
  $('btnSave').onclick = () => { Sound.play('uiClick'); UI.openSavePanel('save'); };
  $('btnSettings').onclick = () => { Sound.play('uiOpen'); $('pausePanel').classList.add('hidden'); $('settingsPanel').classList.remove('hidden'); refreshSettingsUI(); };
  $('btnQuit').onclick = () => { if (activeSaveKey) save(); location.reload(); };
  $('volSlider').oninput = e => Sound.setVolume(e.target.value / 100);
  $('dialogBox').addEventListener('mousedown', e => { e.stopPropagation(); advanceDialog(); });

  // ---------- 画面设置面板 ----------
  function refreshSettingsUI(){
    $('setFov').value = settings.fov;
    $('setFovVal').textContent = settings.fov + '°';
    $('setChunk').value = settings.chunkDist;
    $('setChunkVal').textContent = settings.chunkDist >= 33 ? '∞ 无限' : settings.chunkDist + ' 区块 (' + settings.chunkDist * 16 + '格)';
    $('setFar').value = settings.farDist;
    $('setFarVal').textContent = settings.farDist + ' 格';
    $('setNpc').value = settings.npcShips;
    $('setNpcVal').textContent = settings.npcShips + ' 艘';
    document.querySelectorAll('#setQuality button').forEach(b =>
      b.classList.toggle('on', b.dataset.q === settings.quality));
    document.querySelectorAll('#setPlanetLod button').forEach(b =>
      b.classList.toggle('on', b.dataset.q === settings.planetLod));
    document.querySelectorAll('#setClouds button').forEach(b =>
      b.classList.toggle('on', b.dataset.q === settings.clouds));
    document.querySelectorAll('#setRealAtmo button').forEach(b =>
      b.classList.toggle('on', b.dataset.q === settings.realAtmo));
  }
  $('setFov').oninput = e => { settings.fov = +e.target.value; applySettings(); refreshSettingsUI(); };
  $('setChunk').oninput = e => { settings.chunkDist = +e.target.value; applySettings(); refreshSettingsUI(); };
  $('setFar').oninput = e => { settings.farDist = +e.target.value; applySettings(); refreshSettingsUI(); };
  $('setNpc').oninput = e => { settings.npcShips = +e.target.value; applySettings(); refreshSettingsUI(); };
  document.querySelectorAll('#setQuality button').forEach(b => {
    b.onclick = () => { Sound.play('uiClick'); settings.quality = b.dataset.q; applySettings(); refreshSettingsUI(); };
  });
  document.querySelectorAll('#setPlanetLod button').forEach(b => {
    b.onclick = () => { Sound.play('uiClick'); settings.planetLod = b.dataset.q; applySettings(); refreshSettingsUI(); };
  });
  document.querySelectorAll('#setClouds button').forEach(b => {
    b.onclick = () => { Sound.play('uiClick'); settings.clouds = b.dataset.q; applySettings(); refreshSettingsUI(); };
  });
  document.querySelectorAll('#setRealAtmo button').forEach(b => {
    b.onclick = () => { Sound.play('uiClick'); settings.realAtmo = b.dataset.q; applySettings(); refreshSettingsUI(); };
  });
  $('btnSettingsBoot').onclick = () => {
    Sound.begin(); Sound.play('uiOpen');
    $('settingsPanel').classList.remove('hidden');
    refreshSettingsUI();
  };

  // ---------- 星球地图：标记表单 ----------
  $('mapAddBtn').onclick = addMapMark;
  $('mapMarkName').addEventListener('keydown', e => { if (e.key === 'Enter') addMapMark(); });
  $('mapScopePlanet').onclick = () => {
    mapScopeGal = false; Sound.play('uiClick');
    $('mapScopePlanet').classList.add('on'); $('mapScopeGal').classList.remove('on');
  };
  $('mapScopeGal').onclick = () => {
    mapScopeGal = true; Sound.play('uiClick');
    $('mapScopeGal').classList.add('on'); $('mapScopePlanet').classList.remove('on');
  };
  applySettings();

  // ---------- 局域网联机面板 ----------
  function openNetPanel(){
    $('pausePanel').classList.add('hidden');
    $('netPanel').classList.remove('hidden');
    if (!$('netAddr').value && (location.protocol === 'http:' || location.protocol === 'https:'))
      $('netAddr').value = location.hostname;
    $('netStatus').textContent = Net.status();
  }
  $('btnNet').onclick = () => { Sound.play('uiOpen'); openNetPanel(); };
  $('btnNetBoot').onclick = () => { Sound.begin(); Sound.play('uiOpen'); openNetPanel(); };
  Net.statusChanged = () => { $('netStatus').textContent = Net.status(); };
  $('btnNetHost').onclick = async () => {
    Sound.play('uiClick');
    $('netStatus').textContent = '连接中…';
    try {
      await Net.hostRoom($('netAddr').value.trim());
      UI.bigMessage('房间已创建', '好友加入后自动同步你的世界', 2600);
    } catch(e){ $('netStatus').textContent = '未连接'; UI.bigMessage('创建失败', e.message, 3200); }
  };
  $('btnNetJoin').onclick = async () => {
    Sound.play('uiClick');
    $('netStatus').textContent = '连接中…';
    try {
      await Net.joinRoom($('netAddr').value.trim());
      UI.bigMessage('已进入房间', '等待房主世界同步…', 2600);
    } catch(e){ $('netStatus').textContent = '未连接'; UI.bigMessage('加入失败', e.message, 3200); }
  };
  $('btnNetLeave').onclick = () => {
    Sound.play('uiClose');
    Net.disconnect();
    $('netStatus').textContent = Net.status();
  };
  document.querySelectorAll('.boot-btn').forEach(b => b.addEventListener('mouseenter', () => Sound.play('hover')));

  if (listSaves().length) $('btnContinue').disabled = false;

  // 自动存档（星球上每60秒，仅当已有存档槽位）
  setInterval(() => { if (state === 'planet' && !paused && activeSaveKey) save(); }, 60000);
  window.addEventListener('beforeunload', () => { if ((state === 'planet' || state === 'space') && activeSaveKey) save(); });

  loop();

  const api = {
    get state(){ return state; },
    get flags(){ return flags; },
    get market(){ return market; },
    get lastTech(){ return lastTech; },
    get creative(){ return creative; },
    get dropMult(){ return dropMult; },
    get baseFov(){ return settings.fov; },
    get currentPlanet(){ return currentPlanet; },
    get dayTime(){ return dayTime; },
    get planetScene(){ return planetScene; },
    joinGame,
    get shipPos(){ return shipPos; },
    // 战利品入舱：优先飞船货仓（合并→空格，享受 ×5 大格），溢出转随身背包；返回实际入库数
    addCargo(id, n){
      let left = n;
      for (const s of playerShip.inv){
        if (left <= 0) break;
        if (s && s.item === id && s.n < shipMaxFor(id)){
          const t = Math.min(left, shipMaxFor(id) - s.n);
          s.n += t; left -= t;
        }
      }
      for (let i = 0; i < playerShip.inv.length && left > 0; i++){
        if (!playerShip.inv[i]){
          const t = Math.min(left, shipMaxFor(id));
          playerShip.inv[i] = { item: id, n: t };
          left -= t;
        }
      }
      if (left > 0) left -= Player.addItem(id, left, true);
      if (document.getElementById('shipSect')) refreshShipPanel();
      UI.refreshHUD && UI.refreshHUD();   // 入舱战利品即时反映到 HUD
      return n - left;
    },
    techDone, completeTech, currentQuests, currentQuestId, onBlockMined, onBlockPlaced, lockPointer,
    setWarpLock,
    get warpLockSeed(){ return warpLock ? warpLock.seed : null; },
    isGalaxyVisited(seed){ return seed === Space.getCurrentGalaxySeed() || seed === HOME_GALAXY_SEED || galaxyArchives[seed] !== undefined; },
    save, saveTo, loadFrom, deleteSave, listSaves, doScan, warpTo, neighborSeeds,
    saveBeaconState,
    get atmo(){ return atmo; },
    get scanMarkerCount(){ return scanMarkers.length; },
  };
  window.Game = api;
  return api;
})();
