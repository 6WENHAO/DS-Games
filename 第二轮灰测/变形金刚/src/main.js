/**
 * main.js —— 装配一切：渲染器、场景、机体、变形器、动画、驾驶、特效、UI
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createMaterials } from './model/materials.js';
import { buildRobot, buildTrailer } from './model/robot.js';
import { Transformer } from './rig/transformer.js';
import { Animator } from './rig/animations.js';
import { Motion, KMH } from './systems/motion.js';
import { Effects } from './systems/effects.js';
import { createEnvironment } from './systems/environment.js';
import { createHUD } from './ui/hud.js';
import { buildGUI } from './ui/gui.js';

/* ================================================================== *
 * 渲染器 / 场景 / 相机
 * ================================================================== */
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(8.2, 4.6, 10.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.target.set(0, 2.2, 0);
controls.minDistance = 1.4;
controls.maxDistance = 70;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotateSpeed = 0.9;

/* ================================================================== *
 * 机体 / 系统
 * ================================================================== */
const M = createMaterials();
const rig = buildRobot(M);
scene.add(rig.root);

const trailer = buildTrailer(M);
scene.add(trailer);

const env = createEnvironment(renderer, scene, M);
const tf = new Transformer(rig, M);
const anim = new Animator(rig, tf, M);
const motion = new Motion(rig, tf, anim);
motion.attachTrailer(trailer);
const effects = new Effects(scene, rig, M, tf);
const hud = createHUD();

/* ================================================================== *
 * 相机机位
 * ================================================================== */
const CAMERAS = [
  { id: 'orbit', name: '标准 3/4 全景', pos: [8.2, 4.6, 10.4], target: [0, 2.2, 0] },
  { id: 'front', name: '正面', pos: [0, 2.9, 11.5], target: [0, 2.4, 0] },
  { id: 'side', name: '侧面', pos: [12.5, 2.6, 0.2], target: [0, 2.2, 0] },
  { id: 'low', name: '低角度英雄镜头', pos: [5.4, 1.0, 6.6], target: [0, 2.6, 0] },
  { id: 'top', name: '俯视', pos: [0.02, 13.5, 0.06], target: [0, 0.4, 0] },
  { id: 'head', name: '头部特写', pos: [1.35, 5.2, 3.1], target: [0, 4.55, 0] },
  { id: 'wheel', name: '车轮/关节特写', pos: [2.6, 0.9, 3.0], target: [0.5, 0.7, 0.3] },
  { id: 'rear', name: '后方', pos: [-3.6, 3.4, -9.8], target: [0, 2.0, -0.6] },
];
let camIdx = 0;
const camTween = { t: 1, fromP: new THREE.Vector3(), toP: new THREE.Vector3(), fromT: new THREE.Vector3(), toT: new THREE.Vector3() };

function setCamera(id) {
  const c = CAMERAS.find((x) => x.id === id) || CAMERAS[0];
  camIdx = CAMERAS.indexOf(c);
  const o = rig.root.position;
  camTween.fromP.copy(camera.position);
  camTween.fromT.copy(controls.target);
  camTween.toP.set(c.pos[0] + o.x, c.pos[1], c.pos[2] + o.z);
  camTween.toT.set(c.target[0] + o.x, c.target[1], c.target[2] + o.z);
  camTween.t = 0;
  app.onCameraPreset?.(c.id);
  hud.toast('机位：' + c.name);
}
function cycleCamera() { setCamera(CAMERAS[(camIdx + 1) % CAMERAS.length].id); }

/* ================================================================== *
 * 全局开关与工具
 * ================================================================== */
const state = {
  follow: false, chase: false, trailer: false, wireframe: false, explode: 0,
  axes: false, shadows: true, grid: false, pad: true, props: true,
  night: false, headlights: false, weapon: false,
};

const app = {
  renderer, scene, camera, controls, rig, trailer, tf, anim, motion, effects, env, M, hud,
  state, CAMERAS, setCamera, cycleCamera,
};

/* ---- 爆炸视图 ---- */
app.setExplode = (v) => {
  state.explode = v;
  for (const m of rig.meshes) m.position.copy(m.userData.home).addScaledVector(m.userData.expl, v);
};

/* ---- 线框 ---- */
app.setWireframe = (v) => {
  state.wireframe = v;
  for (const m of M.all) if ('wireframe' in m) m.wireframe = v;
};

/* ---- 关节坐标轴 ---- */
let axesHelpers = null;
app.setJointAxes = (v) => {
  state.axes = v;
  if (!axesHelpers) {
    axesHelpers = [];
    for (const s of tf.slots) {
      const a = new THREE.AxesHelper(0.42);
      a.material.depthTest = false;
      a.material.transparent = true;
      a.material.opacity = 0.95;
      a.renderOrder = 999;
      s.obj.add(a);
      axesHelpers.push(a);
    }
  }
  axesHelpers.forEach((a) => (a.visible = v));
};

/* ---- 车灯 ---- */
app.syncLights = () => {
  const on = state.headlights;
  const inten = on ? (state.night ? 190 : 70) : 0;
  for (const l of rig.headlights) l.intensity = inten;
  M.lamp.emissiveIntensity = on ? 3.4 : (state.night ? 1.8 : 0.5);
};

/* ---- 拖车 ---- */
app.setTrailer = (v) => {
  state.trailer = v;
  trailer.visible = v;
  if (v) motion.snapTrailer();
  hud.toast(v ? '已挂上拖车（载具态自动跟随）' : '已卸下拖车');
};

/* ---- 截图 ---- */
app.screenshot = () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `optimus-${tf.mode}-${Date.now()}.png`;
  a.click();
  hud.toast('已保存 PNG 截图');
};

/* ---- 姿势导入导出 ---- */
app.copyPose = async () => {
  const txt = JSON.stringify(tf.toJSON(), null, 2);
  try {
    await navigator.clipboard.writeText(txt);
    hud.toast('姿势 JSON 已复制到剪贴板');
  } catch {
    console.log(txt);
    hud.toast('剪贴板不可用，已打印到控制台');
  }
};
app.downloadPose = () => {
  const blob = new Blob([JSON.stringify(tf.toJSON(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `optimus-pose-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  hud.toast('姿势 JSON 已下载');
};
app.importPose = () => {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        tf.fromJSON(JSON.parse(String(r.result)));
        app.refreshGUI?.();
        hud.toast('姿势已导入');
      } catch (e) { hud.toast('导入失败：' + e.message, 2600); }
    };
    r.readAsText(f);
  };
  inp.click();
};

/* ================================================================== *
 * UI
 * ================================================================== */
const gui = buildGUI(app);
app.gui = gui;
hud.setStatic(rig.meshes.length, rig.jointCount);
env.setNight(false);
app.syncLights();
tf.applyPreset('stand', 0.001);

tf.onModeChange = (mode) => {
  if (mode === 'vehicle') { hud.toast('载具形态就绪 · WASD 驾驶'); if (state.trailer) motion.snapTrailer(); }
  else if (mode === 'robot') hud.toast('机器人形态就绪 · WASD 行走');
};

/* ================================================================== *
 * 键盘
 * ================================================================== */
const isTyping = (e) => {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};
const NAV = new Set([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

window.addEventListener('keydown', (e) => {
  if (isTyping(e)) return;
  const k = e.key.toLowerCase();
  if (NAV.has(k)) e.preventDefault();
  motion.keys.add(k);
  if (e.repeat) return;
  switch (k) {
    case 't': tf.toggle(); hud.toast(tf.target > 0.5 ? '变形 → 卡车' : '变形 → 机器人'); break;
    case ' ': tf.auto = !tf.auto; hud.toast(tf.auto ? '循环演示：开' : '循环演示：关'); break;
    case 'c': cycleCamera(); break;
    case 'v': state.follow = !state.follow; hud.toast('跟随镜头：' + (state.follow ? '开' : '关')); break;
    case 'r': motion.reset(); setCamera(CAMERAS[camIdx].id); hud.toast('机体已归位'); break;
    case 'q': anim.wave = !anim.wave; hud.toast('挥手：' + (anim.wave ? '开' : '关')); break;
    case 'e':
      state.weapon = !state.weapon;
      rig.blaster.root.visible = state.weapon;
      hud.toast(state.weapon ? '离子炮已装备（F 开火）' : '已收起离子炮');
      break;
    case 'f': if (!effects.fire()) hud.toast('先按 E 装备离子炮'); break;
    case 'l': state.headlights = !state.headlights; app.syncLights(); hud.toast('车灯：' + (state.headlights ? '开' : '关')); break;
    case 'n': state.night = !state.night; env.setNight(state.night); app.syncLights(); hud.toast('夜间模式：' + (state.night ? '开' : '关')); break;
    case 'g': state.grid = !state.grid; env.grid.visible = state.grid; break;
    case 'j': app.setJointAxes(!state.axes); hud.toast('关节坐标轴：' + (state.axes ? '开' : '关')); break;
    case 'x': app.setExplode(state.explode > 0.01 ? 0 : 0.75); hud.toast('爆炸视图：' + (state.explode > 0.01 ? '开' : '关')); break;
    case 'p': app.screenshot(); break;
    case 'h': hud.toggleKeys(); break;
    default: return;
  }
  app.refreshGUI?.();
});
window.addEventListener('keyup', (e) => motion.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => motion.keys.clear());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ================================================================== *
 * 主循环
 * ================================================================== */
const _t = new THREE.Vector3();
const _d = new THREE.Vector3();
let last = performance.now();
let booted = false;

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
  last = now;

  tf.update(dt);                 // ① 基础位姿（变形）
  const ctx = motion.update(dt); // ② 世界移动 / 车轮 / 转向
  anim.update(dt, ctx);          // ③ 叠加动画
  effects.update(dt, ctx);       // ④ 粒子与能量特效
  env.follow(rig.root.position); // ⑤ 阴影跟随

  /* 相机 */
  if (camTween.t < 1) {
    camTween.t = Math.min(1, camTween.t + dt * 1.6);
    const e = camTween.t < 0.5 ? 4 * camTween.t ** 3 : 1 - Math.pow(-2 * camTween.t + 2, 3) / 2;
    camera.position.lerpVectors(camTween.fromP, camTween.toP, e);
    controls.target.lerpVectors(camTween.fromT, camTween.toT, e);
  } else if (state.follow) {
    _t.set(rig.root.position.x, tf.vehicleW > 0.5 ? 1.15 : 2.25, rig.root.position.z);
    _d.copy(_t).sub(controls.target);
    controls.target.add(_d);
    camera.position.add(_d);
    if (state.chase) {
      const h = motion.heading;
      _t.set(rig.root.position.x - Math.sin(h) * 9.5, 3.6, rig.root.position.z - Math.cos(h) * 9.5);
      camera.position.lerp(_t, Math.min(1, dt * 2.4));
    }
  }
  controls.update();

  renderer.render(scene, camera);

  hud.frame(dt, {
    progress: tf.progress, mode: tf.mode, kmh: ctx.kmh,
    tri: renderer.info.render.triangles.toLocaleString('en-US'),
  });

  if (!booted) { booted = true; hud.ready(); }
}
renderer.setAnimationLoop(frame);

/* 开场演示：机位缓推 + 提示 */
setTimeout(() => hud.toast('按 T 变形 · WASD 驾驶 · 右侧面板可调每个关节', 3600), 900);
window.__OPTIMUS__ = app;   // 方便在控制台里玩
