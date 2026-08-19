/* =========================================================================
   启动与主循环
   ========================================================================= */
const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const elFill = document.getElementById('lfill'), elSt = document.getElementById('lst'), elLoad = document.getElementById('load');

let renderer, scene, camera, controls, post, clock;
let fpsAcc = 0, fpsN = 0, fpsShow = 0;

async function step(pct, msg) {
  if (elFill) elFill.style.width = pct + '%';
  if (elSt) elSt.textContent = msg;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

async function boot() {
  const q = (Q.get('q') || 'high').toLowerCase();
  const LOW = q === 'low', MID = q === 'mid';
  const TESTMODE = Q.has('test');
  const frames = parseInt(Q.get('frames') || '0', 10) || 0;
  if (Q.get('hour')) S.hour = parseFloat(Q.get('hour'));
  if (Q.get('fog')) S.fog = parseFloat(Q.get('fog'));
  if (Q.get('night')) S.hour = parseFloat(Q.get('night'));
  if (Q.get('sun')) S.hour = 11;
  if (Q.get('noon')) S.hour = 12.5;
  if (Q.get('dusk')) S.hour = 18.85;
  if (Q.get('golden')) S.hour = 18.5;

  const tryRenderer = (opts) => {
    try { return new THREE.WebGLRenderer(opts); } catch (e) { return null; }
  };
  const attempts = [
    { canvas, antialias: false, stencil: false, powerPreference: 'default' },
    { canvas, antialias: true, stencil: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false },
    { canvas, antialias: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false },
    { canvas },
  ];
  renderer = null;
  for (const o of attempts) {
    renderer = tryRenderer(o);
    if (renderer) break;
  }
  if (!renderer) throw new Error('无法创建 WebGL 上下文（请检查浏览器硬件加速设置）');
  let caps = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) caps = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
  } catch (e) { /* ignore */ }
  const SOFT = LOW || TESTMODE || /swiftshader|llvmpipe|software renderer/i.test(caps);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, SOFT ? 1 : 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;         // 由后处理统一做 ACES
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xcbb7a4, 0.00012);
  camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 1.4, 52000);
  camera.position.set(-1250, 285, -1150);

  await step(6, '生成材质与程序化贴图…');
  buildMaterials();

  await step(14, '构建大气与太阳…');
  buildSky(scene);
  if (LOW) sun.shadow.mapSize.set(1024, 1024);
  else if (MID || TESTMODE) sun.shadow.mapSize.set(2048, 2048);
  else sun.shadow.mapSize.set(3072, 3072);

  await step(26, '隆起马林海岬与旧金山半岛…');
  buildTerrain(scene);

  await step(42, '注入金门海峡潮水…');
  buildWater(scene);
  buildFogBanks(scene);

  await step(56, '架设主塔 · 主缆 · 加劲桁架…');
  buildBridge(scene);

  await step(72, '铺装桥面 · 栏杆 · 灯柱…');
  buildFort(scene);
  buildTollPlaza(scene);

  await step(82, '种植柏树林与要塞建筑…');
  buildVegetation(scene);
  buildRocks(scene);
  buildBuildings(scene);

  await step(90, '放行车流与海上船舶…');
  buildCars(scene);
  buildShips(scene);
  buildGulls(scene);

  await step(96, '编译着色器…');
  controls = new Orbit(camera, canvas);
  controls.setFrom(camera.position, new THREE.Vector3(60, 100, 40));
  post = new Post(renderer, scene, camera);
  post.enabled = !LOW && !Q.has('nopost');
  resize();
  setupUI(controls, renderer);
  clock = new THREE.Clock();
  if (Q.has('ui')) {
    S.ui = Q.get('ui') !== '0';
    if (!S.ui) document.querySelectorAll('.hud').forEach((n) => { n.style.display = 'none'; });
  }
  if (Q.has('view')) {
    const v = VIEWS[parseInt(Q.get('view'), 10)] || VIEWS[0];
    controls.setFrom(new THREE.Vector3(...v.p), new THREE.Vector3(...v.t));
    S.orbit = false;
  }
  updateSky(scene, renderer, 1);
  regenEnv(renderer, scene); envDirty = false;
  renderer.compile(scene, camera);

  await step(100, '就绪');
  elLoad.classList.add('done');
  setTimeout(() => elLoad.remove(), 1200);
  if (!Q.has('view')) setOrbit(true); else setOrbit(false);
  const dbg = (msg) => {
    document.title = 'READY ' + msg + ' | 金门大桥 3D';
    if (elSt) { elSt.textContent = msg; elSt.style.color = '#9fe0a8'; }
  };
  // 调试 / 自动化接口（供无头浏览器批量取景校验）
  window.__ggb = {
    n: 0,
    view(i) {
      const v = VIEWS[i] || VIEWS[0];
      controls.anim = null;
      controls.setFrom(new THREE.Vector3(...v.p), new THREE.Vector3(...v.t));
      setOrbit(false); controls.userTime = 9999; return v.n;
    },
    cam(px, py, pz, tx, ty, tz) {
      controls.anim = null;
      controls.setFrom(new THREE.Vector3(px, py, pz), new THREE.Vector3(tx, ty, tz));
      setOrbit(false); controls.userTime = 9999;
    },
    set(o) {
      if (o.hour !== undefined) { S.hour = o.hour; envDirty = true; if (ui.sHour) { ui.sHour.value = o.hour; ui.vHour.textContent = fmtHour(o.hour); } }
      if (o.fog !== undefined) S.fog = o.fog;
      if (o.lamps !== undefined) S.lamps = o.lamps;
      if (o.traffic !== undefined) S.traffic = o.traffic;
      if (o.xray !== undefined) { S.xray = o.xray; applyXray(); }
    },
    info() {
      return {
        frames: this.n, fps: fpsShow, hour: S.hour, fog: S.fog, night: +S.night.toFixed(2),
        tri: post.sceneTris | 0, calls: post.sceneCalls | 0,
        camY: +camera.position.y.toFixed(1), sunEl: +(Math.asin(S.sun.y) * 180 / Math.PI).toFixed(1),
      };
    },
  };
  dbg('frames=' + frames);
  if (frames > 0) {
    // 测试模式：渲染固定帧数后停机，便于截图
    let n = 0;
    const testLoop = () => {
      const dt = Math.min(clock.getDelta(), 0.06);
      S.dt = dt; S.t += dt;
      updateSky(scene, renderer, dt);
      updateWater(dt);
      controls.update(dt);
      updateShadow();
      updateFog(camera, dt);
      updateCars(dt);
      updateShips(dt);
      updateGulls();
      updateNightLights();
      post.render(S.expo);
      if (++n < frames) requestAnimationFrame(testLoop);
      else dbg('RENDERED ' + frames + 'F tri=' + renderer.info.render.triangles + ' calls=' + renderer.info.render.calls);
    };
    testLoop();
    return;
  }
  loop();
}

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (post) post.setSize(w, h, renderer.getPixelRatio());
}
let rzT = 0;
addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); });

/* 阴影相机跟随视点，近景更锐利、远景全覆盖 */
const _st = new THREE.Vector3();
function updateShadow() {
  const d = camera.position.distanceTo(controls.target);
  const ext = clamp(d * 0.62 + 120, 230, 2500);
  const c = sun.shadow.camera;
  if (Math.abs(c.right - ext) > ext * 0.06) {
    c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext;
    c.near = 20; c.far = 7000; c.updateProjectionMatrix();
  }
  _st.copy(controls.target);
  _st.y = clamp(_st.y, 0, 260);
  sun.target.position.copy(_st);
  sun.position.copy(_st).addScaledVector(S.sun, 3400);
  sun.target.updateMatrixWorld();
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.06);
  S.dt = dt; S.t += dt;

  updateSky(scene, renderer, dt);
  updateWater(dt);
  controls.update(dt);
  updateShadow();
  updateFog(camera, dt);
  updateCars(dt);
  updateShips(dt);
  updateGulls();
  updateNightLights();

  post.mComp.uniforms.uBloom.value = 0.075 + S.night * 0.16;
  post.render(S.expo);
  if (window.__ggb) window.__ggb.n++;

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) {
    fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
    if (ui.stats) ui.stats.textContent = fpsShow + ' fps · ' + ((post.sceneTris || 0) / 1000 | 0) + 'k tri';
    if (ui.clock) ui.clock.textContent = fmtHour(S.hour);
  }
}

boot().catch((e) => {
  console.error(e);
  if (elSt) { elSt.textContent = '初始化失败: ' + (e && e.message ? e.message : e); elSt.style.color = '#ff8b6a'; }
});
