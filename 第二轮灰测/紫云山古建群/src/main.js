import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials } from './voxel/palette.js';
import { buildSite } from './build/site.js';
import { createSky } from './scene/sky.js';
import { createLighting, applyPreset, PRESETS } from './scene/lighting.js';

const $ = (s) => document.querySelector(s);

/** URL 参数：?preset=dusk&nointro=1&shadow=1024&dpr=1&view=axis&rotate=0 */
const Q = new URLSearchParams(location.search);
const qNum = (k, d) => (Q.has(k) ? Number(Q.get(k)) : d);

function fatal(err) {
  console.error(err);
  const box = $('#error');
  box.style.display = 'block';
  box.textContent = '场景初始化失败：\n\n' + (err?.stack || err);
  $('#loader')?.classList.add('hide');
}

/* ============================ 初始化 ============================ */
function init() {
  const container = $('#app');

  /* ---- 渲染器 ---- */
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false
  });
  const dprMax = Math.min(window.devicePixelRatio || 1, qNum('dpr', 1.75));
  let dprNow = dprMax;
  renderer.setPixelRatio(dprNow);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;          // 静态场景：仅在需要时重算阴影
  container.appendChild(renderer.domElement);

  /* ---- 场景 ---- */
  const scene = new THREE.Scene();
  scene.fog = qNum('fog', 1) === 0 ? null : new THREE.Fog(0xd9c4a4, 280, 1000);

  const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.6, 4000);

  /* ---- 天空 ---- */
  const sky = createSky();
  scene.add(sky.mesh);

  /* ---- 体素建筑群 ---- */
  const t0 = performance.now();
  const materials = createMaterials();
  const site = buildSite();
  const { group, stats } = site.world.buildMeshes(materials, { cull: true, ao: true });
  scene.add(group);
  const buildMs = Math.round(performance.now() - t0);

  // 远景地坪（隐藏体素地面边界）
  const skirt = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ color: 0x4a6b36, roughness: 1 })
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.set(0, 0.98, 80);
  skirt.receiveShadow = false;
  scene.add(skirt);

  /* ---- 灯光 ---- */
  const shadowSize = qNum('shadow', Math.min(window.innerWidth, window.innerHeight) > 700 ? 3072 : 1536);
  const lights = createLighting(scene, site.focus, { shadowSize });

  const ctx = { scene, renderer, sky, materials, lights, focus: site.focus };
  let currentPreset = 'dawn';
  let shadowDirty = true;

  function setPreset(key) {
    currentPreset = key;
    applyPreset(key, ctx);
    shadowDirty = true;
    document.querySelectorAll('#seg-time button').forEach((b) => {
      b.classList.toggle('on', b.dataset.preset === key);
    });
  }

  /* ---- 相机 / 控制器 ---- */
  const VIEWS = {
    hero:  [84, 75, -61],        // 默认：东南 30° 三分之四正面全景
    front: [0, 52, -112],        // 中轴正视立面
    axis:  [0, 224, 128],        // 高空俯瞰院落布局
    side:  [186, 62, 84],        // 正侧掠影
    close: [72, 40, 26]          // 主殿近景
  };
  const HOME = new THREE.Vector3(...(VIEWS[Q.get('view')] ?? VIEWS.hero));
  const target = new THREE.Vector3(site.focus.x, site.focus.y, site.focus.z);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.6;
  controls.minDistance = 55;
  controls.maxDistance = 620;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI * 0.474;        // 不穿到地面以下
  controls.autoRotate = qNum('rotate', 1) === 1;
  controls.autoRotateSpeed = 0.36;

  camera.position.copy(HOME);
  camera.lookAt(target);

  /* ---- 开场推镜 ---- */
  const INTRO_MS = 5200;
  let introStart = performance.now();
  let intro = false;
  const FLY_FROM = HOME.clone().multiplyScalar(1.9).setY(HOME.y * 2.1);

  function startIntro() {
    intro = true;
    introStart = performance.now();
    controls.enabled = false;
  }
  if (!Q.has('nointro')) startIntro();

  /* ---- HUD ---- */
  document.querySelectorAll('#seg-time button').forEach((btn) => {
    btn.addEventListener('click', () => setPreset(btn.dataset.preset));
  });
  const tRotate = $('#t-rotate');
  tRotate.classList.toggle('on', controls.autoRotate);
  tRotate.addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    tRotate.classList.toggle('on', controls.autoRotate);
  });
  const tShadow = $('#t-shadow');
  tShadow.addEventListener('click', () => {
    const on = !lights.sun.castShadow;
    lights.sun.castShadow = on;
    tShadow.classList.toggle('on', on);
    shadowDirty = true;
  });
  const tFly = $('#t-fly');
  tFly.addEventListener('click', () => {
    startIntro();
    tFly.classList.add('on');
    setTimeout(() => tFly.classList.remove('on'), 600);
  });
  window.addEventListener('keydown', (e) => {
    const map = { '1': 'dawn', '2': 'noon', '3': 'dusk', '4': 'night' };
    if (map[e.key]) setPreset(map[e.key]);
    if (e.key === 'r' || e.key === 'R') tRotate.click();
  });

  setPreset(PRESETS[Q.get('preset')] ? Q.get('preset') : 'dawn');

  const sFps = $('#s-fps'), sVox = $('#s-vox'), sCall = $('#s-call'), sTri = $('#s-tri');
  sVox.textContent = stats.drawn.toLocaleString('en-US');

  /* ---- 自适应 ---- */
  addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dprNow);
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---- 主循环 ---- */
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let frames = 0, fpsClock = performance.now(), cloudClock = 0;
  const cloudMeshes = group.children.filter((m) => m.name === 'CLOUD');

  function tick(now) {
    requestAnimationFrame(tick);

    if (intro) {
      const t = Math.min(1, (now - introStart) / INTRO_MS);
      const e = easeInOut(t);
      camera.position.lerpVectors(FLY_FROM, HOME, e);
      camera.lookAt(target);
      if (t >= 1) { intro = false; controls.enabled = true; }
    } else {
      controls.update();
    }

    // 云缓慢飘移
    cloudClock += 0.0016;
    for (const m of cloudMeshes) {
      m.position.x = Math.sin(cloudClock) * 26;
      m.position.z = Math.cos(cloudClock * 0.6) * 10;
    }

    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    renderer.render(scene, camera);

    frames++;
    if (now - fpsClock >= 500) {
      const fps = Math.round((frames * 1000) / (now - fpsClock));
      sFps.textContent = fps;
      sCall.textContent = renderer.info.render.calls;
      sTri.textContent = (renderer.info.render.triangles / 1000).toFixed(0) + 'k';
      frames = 0; fpsClock = now;

      // 自适应分辨率：弱机自动降采样，保证 ≥30fps
      if (fps > 0 && fps < 28 && dprNow > 0.6) {
        dprNow = Math.max(0.6, dprNow - 0.25);
        renderer.setPixelRatio(dprNow);
        renderer.setSize(window.innerWidth, window.innerHeight);
        shadowDirty = true;
      } else if (fps > 56 && dprNow < dprMax) {
        dprNow = Math.min(dprMax, dprNow + 0.25);
        renderer.setPixelRatio(dprNow);
        renderer.setSize(window.innerWidth, window.innerHeight);
        shadowDirty = true;
      }
    }
  }
  requestAnimationFrame(tick);

  // 首帧渲染完成后收起载入层
  requestAnimationFrame(() => {
    setTimeout(() => $('#loader').classList.add('hide'), 90);
  });

  console.log(
    `[体素古建群] 建造 ${buildMs}ms | 体素总数 ${stats.total} | 剔除后绘制 ${stats.drawn} | InstancedMesh ${stats.meshes} 个`
  );
  console.table(site.buildings.map((b) => ({ 建筑: b.name, x: b.cx, z: b.cz })));

  window.__scene = { scene, camera, renderer, controls, site, stats, setPreset };
}

try {
  init();
} catch (e) {
  fatal(e);
}
