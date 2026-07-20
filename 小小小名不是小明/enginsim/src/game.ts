import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { EngineAudio } from './core/EngineAudio';
import { V8Viz } from './viz';
import { Track, TUNNEL_T0, TUNNEL_T1 } from './game/track';
import { createMuscleCar, createSportsCar, type MuscleCar } from './game/car';
import { createBasinTerrain } from './game/terrain';
import { buildDecorations } from './game/decorations';
import { GamepadInput } from './game/gamepad';
import { toonMat } from './game/textures';
import { VehicleSim, MUSCLE_CAR, SPORT_CAR, type DriveInput, type VehicleParams } from './game/physics';

const app = document.getElementById('app')!;
const overlay = document.getElementById('overlay')!;
const speedVal = document.getElementById('speedVal')!;
const gearVal = document.getElementById('gearVal')!;
const rpmFill = document.getElementById('rpmFill')!;
const vizWrap = document.getElementById('vizWrap')!;
const vizCanvas = document.getElementById('engineViz') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.domElement.className = 'webgl';
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbcd8ee, 0.0019);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);

const sky = new Sky();
sky.scale.setScalar(2500);
const sunDir = new THREE.Vector3();
{
  const u = sky.material.uniforms;
  u.turbidity.value = 6;
  u.rayleigh.value = 1.8;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.82;
  const elev = THREE.MathUtils.degToRad(16);
  const azim = THREE.MathUtils.degToRad(205);
  sunDir.setFromSphericalCoords(1, Math.PI / 2 - elev, azim);
  u.sunPosition.value.copy(sunDir);
}
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xcfe2f5, 0x5a7a4a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 500;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.09, 0.35, 0.9
);
composer.addPass(bloom);
const AnimeShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    edgeStrength: { value: 0.8 },
    levels: { value: 7.0 },
    saturation: { value: 1.28 },
    vignette: { value: 0.3 },
    lineColor: { value: new THREE.Color(0x141824) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float edgeStrength;
    uniform float levels;
    uniform float saturation;
    uniform float vignette;
    uniform vec3 lineColor;
    varying vec2 vUv;

    float luma(vec2 uv) {
      vec3 c = texture2D(tDiffuse, uv).rgb;
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec2 px = 1.35 / resolution;
      vec3 c = texture2D(tDiffuse, vUv).rgb;

      float tl = luma(vUv + vec2(-px.x,  px.y));
      float tc = luma(vUv + vec2( 0.0,   px.y));
      float tr = luma(vUv + vec2( px.x,  px.y));
      float ml = luma(vUv + vec2(-px.x,  0.0));
      float mr = luma(vUv + vec2( px.x,  0.0));
      float bl = luma(vUv + vec2(-px.x, -px.y));
      float bc = luma(vUv + vec2( 0.0,  -px.y));
      float br = luma(vUv + vec2( px.x, -px.y));
      float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
      float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
      float g = length(vec2(gx, gy));
      float edge = smoothstep(0.22, 0.55, g);

      vec3 q = (floor(c * levels) + 0.5) / levels;
      c = mix(c, q, 0.5);

      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(lum), c, saturation);

      c = mix(c, lineColor, edge * edgeStrength);

      vec2 d = vUv - 0.5;
      c *= 1.0 - vignette * dot(d, d) * 2.0;

      gl_FragColor = vec4(c, 1.0);
    }`
};
composer.addPass(new ShaderPass(AnimeShader));
const fxaaPass = new ShaderPass(FXAAShader);
composer.addPass(fxaaPass);
composer.addPass(new OutputPass());

function updatePostSize() {
  const w = window.innerWidth, h = window.innerHeight;
  const pr = renderer.getPixelRatio();
  const anime = composer.passes[2] as ShaderPass;
  anime.uniforms.resolution.value.set(w * pr, h * pr);
  fxaaPass.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
}
updatePostSize();

const track = new Track();
scene.add(track.group);
scene.add(createBasinTerrain());
scene.add(buildDecorations(track));

interface CarDef {
  id: string;
  engineName: 'engine-v8' | 'engine-flat6';
  params: VehicleParams;
  create: () => MuscleCar;
  hasViz: boolean;
}
const CAR_DEFS: Record<string, CarDef> = {
  muscle: { id: 'muscle', engineName: 'engine-v8', params: MUSCLE_CAR, create: createMuscleCar, hasViz: true },
  sport: { id: 'sport', engineName: 'engine-flat6', params: SPORT_CAR, create: createSportsCar, hasViz: false }
};
let selectedCar = 'muscle';
let carDef = CAR_DEFS.muscle;

let car = createMuscleCar();
scene.add(car.group);

let sim = new VehicleSim(MUSCLE_CAR);
const start = track.startPose();
sim.reset(start.pos.x, start.pos.z, start.yaw);

let engine = new EngineAudio();
const viz = new V8Viz(vizCanvas);
let audioReady = false;
let currentEngineName = '';
let mode: 'menu' | 'intro' | 'drive' = 'menu';
let menuT = 0;
let introT = 0;
const countdownEl = document.getElementById('countdown')!;
const countdownSpan = countdownEl.querySelector('span')!;

const start0 = track.startPose();
const fwdX = Math.cos(start0.yaw), fwdZ = Math.sin(start0.yaw);
const showCenter = new THREE.Vector3(
  start0.pos.x - fwdX * 12 + fwdZ * 26,
  0,
  start0.pos.z - fwdZ * 12 - fwdX * 26
);

function buildShowroom(): THREE.Group {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.6, 0.42, 36), toonMat({ color: 0xb4bac6 }));
  ped.position.y = 0.21;
  ped.receiveShadow = true;
  g.add(ped);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.45, 0.07, 6, 40),
    new THREE.MeshBasicMaterial({ color: 0xff9a50 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.44;
  g.add(ring);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(8.5, 36), toonMat({ color: 0x2c313c }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  g.add(floor);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.4, 0.14), toonMat({ color: 0x38404c }));
    pole.position.set(Math.cos(a) * 7.4, 2.2, Math.sin(a) * 7.4);
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff2cc }));
    head.position.set(Math.cos(a) * 7.4, 4.45, Math.sin(a) * 7.4);
    g.add(head);
  }
  g.position.copy(showCenter);
  return g;
}
scene.add(buildShowroom());

let skidGain: GainNode | null = null;
function setupSkid() {
  const ctx = engine.ctx;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    lp += 0.25 * (Math.random() * 2 - 1 - lp);
    d[i] = lp * 2.4;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 620;
  bp.Q.value = 1.1;
  skidGain = ctx.createGain();
  skidGain.gain.value = 0;
  src.connect(bp);
  bp.connect(skidGain);
  skidGain.connect(ctx.destination);
  src.start();
}

overlay.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.carCard') as HTMLElement | null;
  if (card) {
    selectedCar = card.dataset.car!;
    document.querySelectorAll('.carCard').forEach(c => c.classList.remove('sel'));
    card.classList.add('sel');
    const def = CAR_DEFS[selectedCar] ?? CAR_DEFS.muscle;
    if (def !== carDef) {
      carDef = def;
      swapCarModel(def);
    }
  }
});

function swapCarModel(def: CarDef) {
  scene.remove(car.group);
  car = def.create();
  car.body.visible = true;
  scene.add(car.group);
}

const introFrom = new THREE.Vector3();
const introLookFrom = new THREE.Vector3();

document.getElementById('goBtn')!.addEventListener('click', async () => {
  const btn = document.getElementById('goBtn')!;
  btn.textContent = 'Loading...';
  await ensureAudio(carDef);
  btn.textContent = '开始驾驶';

  sim = new VehicleSim(carDef.params);
  sim.reset(start.pos.x, start.pos.z, start.yaw);
  carY = start.pos.y;
  car.body.visible = camMode !== 'cockpit';
  car.group.rotation.set(0, -sim.yaw, 0);

  introFrom.copy(camera.position);
  introLookFrom.set(showCenter.x, 1, showCenter.z);
  overlay.style.display = 'none';
  introT = 0;
  mode = 'intro';
});

async function ensureAudio(def: CarDef) {
  if (audioReady && currentEngineName === def.engineName) {
    await engine.resume();
    return;
  }
  if (audioReady) {
    engine.dispose();
    engine = new EngineAudio();
    audioReady = false;
    skidGain = null;
  }
  await engine.init({ engineName: def.engineName });
  await engine.resume();
  engine.setTailLength(def.id === 'sport' ? 1.3 : 1.9);
  engine.setCrossMix(0.15);
  engine.setVolume(0.85);
  engine.setScene('exterior', 0);
  currentScene = 'exterior';
  if (def.hasViz) engine.onTelemetry = (t) => viz.update(t);
  else vizWrap.style.display = 'none';
  setupSkid();
  currentEngineName = def.engineName;
  audioReady = true;
}

function openMenu() {
  mode = 'menu';
  camMode = 'chase';
  car.body.visible = true;
  countdownEl.style.display = 'none';
  overlay.style.display = 'flex';
}

const keys = new Set<string>();
const pad = new GamepadInput();
let camMode: 'chase' | 'cockpit' = 'chase';
let inTunnel = false;
let currentScene = '';

function applyCamScene() {
  if (!audioReady) return;
  const target = inTunnel ? 'tunnel' : (camMode === 'cockpit' ? 'cockpit' : 'exterior');
  if (target !== currentScene) {
    currentScene = target;
    engine.setScene(target);
  }
}

function toggleCamera() {
  camMode = camMode === 'chase' ? 'cockpit' : 'chase';
  car.body.visible = camMode !== 'cockpit';
  applyCamScene();
}
function toggleViz() {
  if (!carDef.hasViz) return;
  vizWrap.style.display = vizWrap.style.display === 'block' ? 'none' : 'block';
}
function resetCar() {
  sim.reset(start.pos.x, start.pos.z, start.yaw);
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (mode === 'drive') {
    if (e.code === 'KeyC') toggleCamera();
    if (e.code === 'KeyV') toggleViz();
    if (e.code === 'KeyR') resetCar();
    if (e.code === 'Escape') openMenu();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

const input: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };
let kbSteer = 0;
function updateInput(dt: number) {
  const pf = pad.poll();
  if (mode === 'drive') {
    if (pf.camToggle) toggleCamera();
    if (pf.reset) resetCar();
    if (pf.vizToggle) toggleViz();
  }

  const tT = keys.has('KeyW') ? 1 : 0;
  const tB = keys.has('KeyS') ? 1 : 0;
  input.throttle += THREE.MathUtils.clamp(tT - input.throttle, -6 * dt, 3.2 * dt);
  input.brake += THREE.MathUtils.clamp(tB - input.brake, -8 * dt, 5 * dt);
  const sT = (keys.has('KeyA') ? -1 : 0) + (keys.has('KeyD') ? 1 : 0);
  const rate = sT !== 0 ? 2.6 : 3.8;
  kbSteer += THREE.MathUtils.clamp(sT - kbSteer, -rate * dt, rate * dt);
  input.steer = kbSteer;
  input.handbrake = keys.has('Space');

  if (pf.connected) {
    input.throttle = Math.max(input.throttle, pf.throttle);
    input.brake = Math.max(input.brake, pf.brake);
    if (Math.abs(pf.steer) > 0.01) input.steer = pf.steer;
    input.handbrake = input.handbrake || pf.handbrake;
  }
}

const camPos = new THREE.Vector3(start.pos.x - Math.cos(start.yaw) * 9, 4, start.pos.z - Math.sin(start.yaw) * 9);
const camLook = new THREE.Vector3();
let carY = start.pos.y;
let slopePitch = 0;

function updateCamera(dt: number) {
  const c = Math.cos(sim.yaw), s = Math.sin(sim.yaw);
  if (camMode === 'chase') {
    const speedZoom = Math.min(1, sim.speedKmh / 180);
    const back = 8.2 + speedZoom * 2.4;
    const target = new THREE.Vector3(
      sim.pos.x - c * back, carY + 3.2 + speedZoom * 0.6, sim.pos.y - s * back
    );
    camPos.lerp(target, Math.min(1, dt * 4.2));
    camera.position.copy(camPos);
    camLook.set(sim.pos.x + c * 4, carY + 1.1, sim.pos.y + s * 4);
    camera.lookAt(camLook);
    camera.fov = 62 + speedZoom * 12;
  } else {
    camera.position.set(
      sim.pos.x + c * (-0.2) - s * (-0.38),
      carY + 1.42,
      sim.pos.y + s * (-0.2) + c * (-0.38)
    );
    camLook.set(sim.pos.x + c * 20, carY + 1.1 + Math.tan(slopePitch) * 20, sim.pos.y + s * 20);
    camera.lookAt(camLook);
    camera.fov = 68;
  }
  camera.updateProjectionMatrix();
}

const clock = new THREE.Clock();
let phyAcc = 0;
const PHY_DT = 1 / 240;
const INTRO_FLIGHT = 2.6;
const INTRO_TOTAL = INTRO_FLIGHT + 3.0;

function menuFrame(dt: number) {
  menuT += dt;
  car.group.position.set(showCenter.x, 0.42, showCenter.z);
  car.group.rotation.y += dt * 0.45;
  car.body.rotation.x *= 0.9;
  car.body.rotation.z *= 0.9;

  const ang = menuT * 0.13 + 2.2;
  camera.position.set(
    showCenter.x + Math.cos(ang) * 8.6,
    2.05 + Math.sin(menuT * 0.35) * 0.3,
    showCenter.z + Math.sin(ang) * 8.6
  );
  camera.lookAt(showCenter.x, 1.0, showCenter.z);
  camera.fov = 54;
  camera.updateProjectionMatrix();

  if (audioReady) {
    engine.setRpm(carDef.params.idleRpm);
    engine.setThrottle(0);
    if (skidGain) skidGain.gain.value = 0;
  }
  sun.position.set(showCenter.x + sunDir.x * 260, sunDir.y * 260, showCenter.z + sunDir.z * 260);
  sun.target.position.set(showCenter.x, 0, showCenter.z);
}

function introFrame(dt: number) {
  introT += dt;
  const k = THREE.MathUtils.smoothstep(Math.min(1, introT / INTRO_FLIGHT), 0, 1);
  const c = Math.cos(sim.yaw), s = Math.sin(sim.yaw);
  const endPos = new THREE.Vector3(sim.pos.x - c * 8.6, carY + 3.3, sim.pos.y - s * 8.6);
  camera.position.lerpVectors(introFrom, endPos, k);
  camLook.lerpVectors(introLookFrom, new THREE.Vector3(sim.pos.x + c * 3, carY + 1.0, sim.pos.y + s * 3), k);
  camera.lookAt(camLook);
  camera.fov = THREE.MathUtils.lerp(54, 62, k);
  camera.updateProjectionMatrix();

  if (introT < INTRO_FLIGHT) {
    countdownEl.style.display = 'none';
    if (audioReady) {
      engine.setRpm(carDef.params.idleRpm);
      engine.setThrottle(0);
    }
  } else {
    const cd = introT - INTRO_FLIGHT;
    const n = 3 - Math.floor(cd);
    countdownEl.style.display = 'flex';
    countdownSpan.textContent = n > 0 ? String(n) : 'GO!';
    const blip = Math.pow(Math.max(0, Math.sin(cd * Math.PI * 2)), 2);
    if (audioReady) {
      engine.setRpm(carDef.params.idleRpm + blip * carDef.params.redline * 0.42);
      engine.setThrottle(blip * 0.7);
    }
  }

  if (introT >= INTRO_TOTAL) {
    mode = 'drive';
    camPos.copy(camera.position);
    countdownSpan.textContent = 'GO!';
    setTimeout(() => { if (mode === 'drive') countdownEl.style.display = 'none'; }, 650);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const frameDt = Math.min(0.05, clock.getDelta());

  updateInput(frameDt);

  if (mode === 'menu') {
    menuFrame(frameDt);
    composer.render();
    return;
  }

  const info = track.nearestInfo(sim.pos.x, sim.pos.y);
  const offRoad = info.dist > track.halfWidth + track.curbWidth;

  if (audioReady && mode === 'drive') {
    phyAcc += frameDt;
    while (phyAcc > PHY_DT) {
      sim.update(PHY_DT, input, offRoad);
      phyAcc -= PHY_DT;
    }
  }

  inTunnel = info.t > TUNNEL_T0 && info.t < TUNNEL_T1 && info.dist < track.halfWidth + 2.5;
  applyCamScene();

  const fade = offRoad ? Math.max(0, 1 - (info.dist - track.halfWidth - track.curbWidth) / 5) : 1;
  const targetY = info.y * fade;
  carY = THREE.MathUtils.lerp(carY, targetY, Math.min(1, frameDt * 10));

  const c = Math.cos(sim.yaw), s = Math.sin(sim.yaw);
  const hF = track.heightAt(sim.pos.x + c * 2.2, sim.pos.y + s * 2.2);
  const hB = track.heightAt(sim.pos.x - c * 2.2, sim.pos.y - s * 2.2);
  slopePitch = THREE.MathUtils.lerp(slopePitch, Math.atan2(hF - hB, 4.4) * fade, Math.min(1, frameDt * 8));

  car.group.position.set(sim.pos.x, carY, sim.pos.y);
  car.group.rotation.y = -sim.yaw;

  const latG = (sim.vx * sim.yawRate) / 9.81;
  const longG = THREE.MathUtils.clamp(sim.ax / 9.81, -1.2, 1.2);
  const roll = carDef.params.rollStiffness;
  car.body.rotation.x = THREE.MathUtils.lerp(car.body.rotation.x, -latG * 0.05 * roll, 0.15);
  car.body.rotation.z = THREE.MathUtils.lerp(
    car.body.rotation.z, longG * 0.03 * roll + slopePitch, 0.12
  );

  const spin = sim.vx / car.wheelRadius * frameDt;
  for (const key of ['fl', 'fr', 'rl', 'rr'] as const) {
    const w = car.wheels[key];
    (w.children[0] as THREE.Group).rotation.z -= spin;
  }
  car.wheels.fl.rotation.y = -sim.steerAngle;
  car.wheels.fr.rotation.y = -sim.steerAngle;

  sun.position.set(sim.pos.x + sunDir.x * 260, sunDir.y * 260, sim.pos.y + sunDir.z * 260);
  sun.target.position.set(sim.pos.x, carY, sim.pos.y);

  if (mode === 'intro') {
    introFrame(frameDt);
  } else {
    updateCamera(frameDt);
  }

  if (audioReady && mode === 'drive') {
    engine.setRpm(sim.rpm);
    engine.setThrottle(sim.audioThrottle);
    if (skidGain) {
      const slip = Math.max(Math.abs(sim.slipRear), Math.abs(sim.slipFront) * 0.7);
      const speed = Math.abs(sim.vx);
      const target = (slip > 0.13 && speed > 5 && !sim.onGrass)
        ? Math.min(0.4, (slip - 0.13) * 2.2) * Math.min(1, speed / 14)
        : 0;
      skidGain.gain.setTargetAtTime(target, engine.ctx.currentTime, 0.06);
    }
  }
  if (audioReady && vizWrap.style.display === 'block') viz.draw();

  speedVal.textContent = String(Math.round(sim.speedKmh));
  gearVal.textContent = sim.shiftTimer > 0 ? '·' : String(sim.gear);
  (rpmFill as HTMLElement).style.width = `${Math.min(100, sim.rpm / (carDef.params.redline + 400) * 100)}%`;

  composer.render();
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  updatePostSize();
});
