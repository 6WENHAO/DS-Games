/**
 * 破晓号 · 星际战舰模拟器 —— 主程序
 *
 * 组装顺序：渲染器 → 天空(含环境贴图) → 太阳系 → 黑洞 → 小行星/尘埃
 *          → 战舰 → 飞行模型 → 相机 → 后期 → 输入/HUD → 主循环
 */
import * as THREE from 'three';
import { Skybox } from './world/skybox.js';
import { SolarSystem } from './world/solarSystem.js';
import { BlackHole } from './world/blackhole.js';
import { AsteroidBelt, SpaceDust } from './world/debris.js';
import { Starship } from './ship/starship.js';
import { FlightModel } from './ship/flight.js';
import { CameraRig } from './ship/cameraRig.js';
import { PostFX } from './fx/postfx.js';
import { InputManager } from './ui/input.js';
import { HUD } from './ui/hud.js';
import { clamp01, formatDistance } from './util/math.js';

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** URL 参数：?autostart=1&spawn=bh&cam=cine&quality=high&throttle=0.4 */
const PARAMS = new URLSearchParams(location.search);
const param = (k, d = null) => (PARAMS.has(k) ? PARAMS.get(k) : d);

/* ==================== 设备与画质 ==================== */
function detectProfile() {
  const ua = navigator.userAgent;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) || (coarse && Math.min(screen.width, screen.height) < 900);
  const mem = navigator.deviceMemory ?? navigator.hardwareConcurrency ?? 4;
  let quality = 'high';
  if (isMobile) quality = (window.devicePixelRatio > 2.4 || mem <= 4) ? 'low' : 'medium';
  else if (mem <= 4) quality = 'medium';
  return { isMobile, coarse, quality };
}

const QUALITY = {
  low: {
    dpr: 1.35, bhSteps: 42, bhStep: 1.5, dust: 620, asteroids: 340,
    planetSeg: 'low', bloom: true,
  },
  medium: {
    dpr: 1.7, bhSteps: 74, bhStep: 1.15, dust: 1000, asteroids: 620,
    planetSeg: 'medium', bloom: true,
  },
  high: {
    dpr: 2.0, bhSteps: 118, bhStep: 1.0, dust: 1500, asteroids: 960,
    planetSeg: 'high', bloom: true,
  },
};

const app = {
  quality: 'high',
  paused: true,
  started: false,
  renderScale: 1,
  perfAcc: 0,
  perfFrames: 0,
  targetIndex: 0,
};

async function boot() {
  const profile = detectProfile();
  app.quality = param('quality') && QUALITY[param('quality')] ? param('quality') : profile.quality;
  app.isMobile = profile.isMobile;
  let cfg = QUALITY[app.quality];

  const loadBar = $('loadBar');
  const loadLabel = $('loadLabel');
  const setProgress = async (p, label) => {
    loadBar.style.width = `${Math.round(p * 100)}%`;
    if (label) loadLabel.textContent = label;
    await nextFrame();
  };

  await setProgress(0.03, '启动渲染管线…');

  /* ---------------- 渲染器 ---------------- */
  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,          // 由 EffectComposer 的 MSAA / 后期处理负责
    powerPreference: 'high-performance',
    stencil: false,
    alpha: false,
  });
  const basePR = Math.min(window.devicePixelRatio || 1, cfg.dpr);
  renderer.setPixelRatio(basePR);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.6, 420000);
  scene.add(camera);

  /* ---------------- 天空 + 环境贴图 ---------------- */
  await setProgress(0.1, '生成星空与星云…');
  const skybox = new Skybox({ radius: 200000 });
  scene.add(skybox.mesh);
  const envTex = skybox.bakeEnvironment(renderer);
  scene.environment = envTex;
  scene.environmentIntensity = 1.7;
  scene.add(new THREE.AmbientLight(0x36506c, 0.85));

  /* ---------------- 太阳系 ---------------- */
  const solar = new SolarSystem({ quality: cfg.planetSeg });
  scene.add(solar.group);
  const steps = solar.buildSteps();
  for (let i = 0; i < steps.length; i++) {
    await setProgress(0.12 + (i / steps.length) * 0.5, `${steps[i].label}…`);
    steps[i].fn();
  }

  /* ---------------- 黑洞 ---------------- */
  await setProgress(0.66, '折叠时空 · 生成黑洞…');
  const blackHole = new BlackHole({
    position: new THREE.Vector3(-52000, 15000, 88000),
    rs: 900,
    steps: cfg.bhSteps,
    tilt: new THREE.Vector3(0.28, 1.0, 0.2),
  });
  blackHole.uniforms.uStepScale.value = cfg.bhStep;
  scene.add(blackHole.group);

  /* ---------------- 小行星带 + 尘埃 ---------------- */
  await setProgress(0.74, '播撒小行星带…');
  const belt = new AsteroidBelt({ count: cfg.asteroids });
  scene.add(belt.group);
  const dust = new SpaceDust({ count: cfg.dust, box: 1100 });
  scene.add(dust.object);

  /* ---------------- 战舰 ---------------- */
  await setProgress(0.82, '总装星际战舰 · 破晓号…');
  const ship = new Starship({ quality: app.quality });
  scene.add(ship.group);

  /* ---------------- 兴趣点（含黑洞） ---------------- */
  const bhBody = {
    key: 'bh', name: 'Gargantua', cn: '黑洞', type: 'blackhole',
    radius: blackHole.rs * blackHole.diskOut, object: blackHole.group,
    position: blackHole.position, color: 0xb478ff,
  };
  const pois = [...solar.bodies, bhBody];

  /* ---------------- 飞行 / 相机 ---------------- */
  await setProgress(0.9, '校准飞控与惯性系…');
  solar.update(0.0001, camera);   // 先摆好行星位置
  const earth = solar.getBody('earth');
  const flight = new FlightModel(ship, {
    bodies: solar.bodies,
    blackHole,
    sunRadius: solar.sunRadius,
  });
  const spawn = earth.position.clone().add(new THREE.Vector3(560, 210, 900));
  flight.setSpawnNear(earth, { dist: 1250, height: 240, offset: 0.66 });
  const rig = new CameraRig(camera);
  rig.update(0.016, flight, ship);

  /* ---------------- 后期 ---------------- */
  const postfx = new PostFX(renderer, scene, camera, { quality: app.quality });

  /* ---------------- UI ---------------- */
  await setProgress(0.96, '接入座舱界面…');
  const hud = new HUD({
    root: $('hud'),
    markerLayer: $('markerLayer'),
    radar: $('radar'),
    speed: $('hudSpeed'),
    mode: $('hudMode'),
    throttleBar: $('hudThrottleBar'),
    throttleVal: $('hudThrottleVal'),
    energyBar: $('hudEnergyBar'),
    energyVal: $('hudEnergyVal'),
    hullBar: $('hudHullBar'),
    hullVal: $('hudHullVal'),
    targetName: $('hudTargetName'),
    targetDist: $('hudTargetDist'),
    targetClose: $('hudTargetClose'),
    warnBox: $('warnBox'),
    toast: $('toast'),
    fps: $('fps'),
    velVec: $('velVec'),
    boostLamp: $('lampBoost'),
    warpLamp: $('lampWarp'),
  });

  const overlay = $('overlay');
  const touchUI = $('touchUI');
  if (profile.coarse || profile.isMobile) {
    touchUI.classList.add('enabled');
    document.body.classList.add('touch-mode');
  }
  // 首次触摸即启用触屏 UI（兼容“既有鼠标又有触屏”的二合一设备）
  window.addEventListener('touchstart', () => {
    touchUI.classList.add('enabled');
    document.body.classList.add('touch-mode');
  }, { passive: true, once: true });

  const setQuality = (q) => {
    app.quality = q;
    cfg = QUALITY[q];
    blackHole.setQuality(cfg.bhSteps, cfg.bhStep);
    postfx.setQuality(q);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.dpr) * app.renderScale);
    onResize();
    hud.message(`画质：${q.toUpperCase()}`);
  };

  const cycleTarget = (dir = 1) => {
    app.targetIndex = (app.targetIndex + dir + pois.length) % pois.length;
    const t = pois[app.targetIndex];
    hud.message(`锁定：${t.cn} ${t.name} · ${formatDistance(flight.position.distanceTo(t.position))}`);
  };
  // 默认锁定黑洞，方便玩家找到它
  app.targetIndex = pois.indexOf(bhBody);

  const input = new InputManager({
    canvas,
    onAction: (action, value) => {
      switch (action) {
        case 'camera': {
          const m = rig.cycle();
          hud.message({ chase: '追尾视角', cockpit: '座舱视角', cine: '电影视角' }[m]);
          break;
        }
        case 'target': cycleTarget(1); break;
        case 'hud': hud.toggle(); break;
        case 'respawn': flight.respawn(); hud.message('已执行紧急跃迁'); break;
        case 'pause': togglePause(); break;
        case 'quality': {
          const order = ['low', 'medium', 'high'];
          setQuality(order[(order.indexOf(app.quality) + 1) % order.length]);
          break;
        }
        case 'throttleWheel':
          flight.throttle = clamp01(flight.throttle + value);
          break;
        default: break;
      }
    },
  });
  input.bindTouchUI({
    leftBase: $('stickL'), leftKnob: $('knobL'),
    rightBase: $('stickR'), rightKnob: $('knobR'),
    buttons: {
      boost: $('btnBoost'), warp: $('btnWarp'), brake: $('btnBrake'),
      align: $('btnAlign'), camera: $('btnCam'), target: $('btnTgt'),
    },
  });

  function togglePause(force) {
    const next = force ?? !app.paused;
    app.paused = next;
    overlay.classList.toggle('hidden', !next);
    if (!next) app.started = true;
  }

  $('startBtn').addEventListener('click', () => {
    togglePause(false);
    hud.message('推进器已就绪 —— 提高油门起飞', 3200);
  });

  /* ---------------- 尺寸 ---------------- */
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    postfx.setSize(buf.x, buf.y);
    hud.resizeRadar();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 260));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !app.paused) togglePause(true);
  });

  /* ---------------- 收尾 ---------------- */
  await setProgress(1, '就绪');
  $('loader').classList.add('hidden');
  setTimeout(() => { $('loader').style.display = 'none'; }, 800);

  /* ---------------- URL 参数：出生点 / 视角 / 直接开始 ---------------- */
  const spawnKey = param('spawn');
  if (spawnKey) {
    const poi = spawnKey === 'bh' ? bhBody : pois.find((p) => p.key === spawnKey);
    if (poi) {
      if (poi.key === 'bh') {
        const dir = new THREE.Vector3(0.55, 0.22, 0.8).normalize();
        flight.setSpawn(
          poi.position.clone().addScaledVector(dir, blackHole.rs * 26),
          poi.position,
        );
      } else {
        flight.setSpawnNear(poi, { dist: poi.radius * 5.2 + 700, height: poi.radius * 0.9 });
      }
      app.targetIndex = Math.max(0, pois.indexOf(poi));
      rig.update(0.016, flight, ship);
      hud.message(`已抵达 ${poi.cn}`);
    }
  }
  if (param('cam')) rig.setMode(param('cam'));
  if (param('throttle')) flight.throttle = clamp01(parseFloat(param('throttle')) || 0);
  if (param('autostart') !== null) togglePause(false);

  /* ---------------- 开发自检（?selftest=1） ---------------- */
  let selftest = null;
  if (param('selftest') !== null) {
    const { createSelfTest } = await import('./dev/selftest.js');
    selftest = createSelfTest({
      renderer, camera, flight, rig, ship, pois, blackHole, solar, hud, postfx,
      setTarget: (key) => {
        const i = pois.findIndex((p) => p.key === key);
        if (i >= 0) app.targetIndex = i;
      },
    });
    togglePause(false);
  }

  /* ==================== 主循环 ==================== */
  let last = performance.now();
  let impact = 0;
  const inputState = {};

  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(0.05, Math.max(0.0001, raw));
    renderer.info.reset();   // 统计整帧（含后期各 pass）

    const target = pois[app.targetIndex];

    if (!app.paused) {
      const s = input.sample(dt);
      inputState.pitch = s.pitch;
      inputState.yaw = s.yaw;
      inputState.roll = s.roll;
      inputState.throttleDelta = s.throttleDelta;
      inputState.boost = s.boost;
      inputState.brake = s.brake;
      inputState.warp = s.warp;
      inputState.align = s.align;
      inputState.alignTarget = target?.position;
      flight.update(dt, inputState);

      // 事件（撞击 / 死亡 / 复活）
      while (flight.events.length) {
        const e = flight.events.shift();
        hud.message(e.text, 3400);
        if (e.type === 'death') impact = 1;
      }
      if (flight.warnings.some((w) => w.key === 'impact')) impact = Math.max(impact, 0.7);
    } else {
      ship.update(dt * 0.35, { throttle: flight.throttle, boost: 0, warp: 0 });
    }
    impact = Math.max(0, impact - dt * 1.8);

    // 世界更新
    rig.update(dt, flight, ship, { bhDanger: flight.bhDanger ?? 0, impact });
    skybox.update(camera.position);
    solar.update(app.paused ? 0 : dt, camera);
    blackHole.update(dt, camera);
    belt.update(app.paused ? 0 : dt, flight.position);
    dust.update(dt, flight.position, flight.velocity);

    hud.update(dt, {
      flight, camera, bodies: pois, blackHole, target,
      cameraMode: rig.mode, quality: app.quality.toUpperCase(),
    });

    postfx.render(dt, {
      warp: flight.warp,
      damage: impact * 0.8 + clamp01(1 - flight.hull / 42) * 0.35,
      gravity: (flight.bhDanger ?? 0) * 1.2,
    });

    // 自检必须在渲染之后立即回读帧缓冲
    if (selftest && !selftest.done) selftest.tick();

    // 动态分辨率：低帧时自动降采样，回升时恢复
    app.perfAcc += dt; app.perfFrames++;
    if (app.perfAcc > 1.1) {
      const fps = app.perfFrames / app.perfAcc;
      app.perfAcc = 0; app.perfFrames = 0;
      let scale = app.renderScale;
      if (fps < 42 && scale > 0.62) scale = Math.max(0.62, scale - 0.12);
      else if (fps > 57 && scale < 1) scale = Math.min(1, scale + 0.08);
      if (scale !== app.renderScale) {
        app.renderScale = scale;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.dpr) * scale);
        onResize();
      }
    }
  }
  requestAnimationFrame(frame);

  // 暴露调试句柄
  window.DAWNBREAKER = { app, scene, camera, renderer, ship, flight, rig, solar, blackHole, postfx, hud, input };
}

boot().catch((err) => {
  console.error(err);
  const label = $('loadLabel');
  if (label) {
    label.innerHTML = `<span style="color:#ff6b6b">启动失败：${String(err && err.message ? err.message : err)}</span>`;
  }
});
