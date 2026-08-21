/**
 * environment.js —— 场景环境：渐变天空、程序化环境反射、地面、展台、灯光、夜间模式
 */
import * as THREE from 'three';
import { bevelBox, cyl, part, groundTexture, padTexture } from '../model/geom.js';

/* 程序化「影棚」环境贴图（给金属/镀铬提供反射，无需外部 HDR） */
function studioEquirect() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#0c1524');
  g.addColorStop(0.42, '#3d5a7d');
  g.addColorStop(0.52, '#8fa8c4');
  g.addColorStop(0.60, '#2b3440');
  g.addColorStop(1.0, '#0a0d12');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  const blob = (cx, cy, r, col) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  blob(120, 70, 90, 'rgba(255,255,255,.95)');
  blob(360, 52, 70, 'rgba(180,215,255,.8)');
  blob(250, 210, 120, 'rgba(255,120,110,.30)');
  blob(470, 150, 90, 'rgba(90,150,255,.35)');
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const SKY_FRAG = /* glsl */`
uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 glowCol; uniform float glow;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(mid, top, smoothstep(0.02, 0.75, h));
  c = mix(bottom, c, smoothstep(-0.30, 0.02, h));
  float band = pow(max(0.0, 1.0 - abs(h) * 4.2), 3.0);
  c += glowCol * band * glow;
  gl_FragColor = vec4(c, 1.0);
}`;

export function createEnvironment(renderer, scene, M) {
  const env = {};

  /* ---------- 环境反射 ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const src = studioEquirect();
  env.envMap = pmrem.fromEquirectangular(src).texture;
  scene.environment = env.envMap;
  src.dispose();
  pmrem.dispose();

  /* ---------- 天空 ---------- */
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#0a1020') },
      mid: { value: new THREE.Color('#1b2740') },
      bottom: { value: new THREE.Color('#05070b') },
      glowCol: { value: new THREE.Color('#2f6ab0') },
      glow: { value: 0.55 },
    },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);
  env.sky = sky;

  scene.fog = new THREE.FogExp2(0x0a0f18, 0.006);

  /* ---------- 地面 ---------- */
  const gTex = groundTexture();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(140, 96),
    new THREE.MeshStandardMaterial({ map: gTex, color: 0x8f97a4, metalness: 0.25, roughness: 0.78 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  env.ground = ground;

  /* 展台贴花 */
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(5.0, 96),
    new THREE.MeshBasicMaterial({ map: padTexture(), transparent: true, depthWrite: false, opacity: 0.95 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.006;
  scene.add(pad);
  env.pad = pad;

  const grid = new THREE.GridHelper(160, 80, 0x3a6ea8, 0x1c2a3c);
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  grid.visible = false;
  scene.add(grid);
  env.grid = grid;

  /* ---------- 场景道具：立柱 + 灯塔（提供尺度感与反射） ---------- */
  const props = new THREE.Group();
  const strip = new THREE.MeshStandardMaterial({
    color: '#0d1118', emissive: new THREE.Color('#2f7ce0'), emissiveIntensity: 1.1, roughness: 0.4,
  });
  env.stripMat = strip;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 44 + (i % 3) * 3;
    const h = 6 + (i % 4) * 2.5;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.rotation.y = -a;
    part(g, bevelBox(2.4, h, 2.4, { r: 0.18, bevel: 0.1 }), M.dark, [0, h / 2, 0]);
    part(g, bevelBox(0.35, h * 0.7, 0.12, { r: 0.05 }), strip, [1.24, h * 0.5, 0]);
    part(g, bevelBox(2.8, 0.5, 2.8, { r: 0.1 }), M.metal, [0, h + 0.2, 0]);
    props.add(g);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * 26, 0, Math.sin(a) * 26);
    g.rotation.y = -a + Math.PI;
    part(g, cyl(0.24, 0.34, 16, 12), M.metal, [0, 8, 0]);
    part(g, bevelBox(3.2, 0.45, 0.7, { r: 0.1 }), M.dark, [0, 16.1, 0.4]);
    for (let k = -1; k <= 1; k++) part(g, bevelBox(0.8, 0.35, 0.25, { r: 0.06 }), M.lamp, [k * 1.05, 16.1, 0.78]);
    props.add(g);
  }
  scene.add(props);
  env.props = props;

  /* ---------- 灯光 ---------- */
  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x2a2f38, 0.75);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff2dd, 2.7);
  key.position.set(7.5, 13, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -11; key.shadow.camera.right = 11;
  key.shadow.camera.top = 11; key.shadow.camera.bottom = -11;
  key.shadow.camera.near = 1; key.shadow.camera.far = 46;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.025;
  scene.add(key);
  scene.add(key.target);

  const fill = new THREE.DirectionalLight(0x9fc4ff, 0.55);
  fill.position.set(-9, 5, 8);
  scene.add(fill);

  const rimR = new THREE.PointLight(0xff3d3d, 26, 34, 1.6);
  rimR.position.set(-7.5, 4.2, -7.5);
  const rimB = new THREE.PointLight(0x3a86ff, 26, 34, 1.6);
  rimB.position.set(7.5, 5.0, -8.5);
  scene.add(rimR, rimB);

  Object.assign(env, { hemi, key, fill, rimR, rimB, skyMat });

  /* ---------- 昼夜 ---------- */
  env.night = false;
  env.setNight = (on) => {
    env.night = on;
    hemi.intensity = on ? 0.16 : 0.75;
    key.intensity = on ? 0.42 : 2.7;
    fill.intensity = on ? 0.10 : 0.55;
    rimR.intensity = on ? 48 : 26;
    rimB.intensity = on ? 48 : 26;
    strip.emissiveIntensity = on ? 2.6 : 1.1;
    scene.fog.color.set(on ? 0x04060a : 0x0a0f18);
    scene.fog.density = on ? 0.010 : 0.006;
    skyMat.uniforms.top.value.set(on ? '#02040a' : '#0a1020');
    skyMat.uniforms.mid.value.set(on ? '#080e1c' : '#1b2740');
    skyMat.uniforms.bottom.value.set(on ? '#010204' : '#05070b');
    skyMat.uniforms.glow.value = on ? 0.30 : 0.55;
    for (const m of M.body) if ('envMapIntensity' in m) { m.envMapIntensity = on ? 0.35 : 1.0; m.needsUpdate = true; }
    ground.material.color.set(on ? 0x4d5560 : 0x8f97a4);
    M.lamp.emissiveIntensity = on ? 1.8 : 0.5;
  };

  env.setShadows = (on) => {
    renderer.shadowMap.enabled = on;
    key.castShadow = on;
    scene.traverse((o) => { if (o.isMesh) o.receiveShadow = on ? o.userData.__recv !== false : false; });
  };

  /* 关键光跟随机体，保证阴影贴图始终裹住模型 */
  env.follow = (target) => {
    key.position.set(target.x + 7.5, 13, target.z + 7);
    key.target.position.set(target.x, 1.4, target.z);
    key.target.updateMatrixWorld();
    pad.position.x = 0; pad.position.z = 0;
  };

  return env;
}
