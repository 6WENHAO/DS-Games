import * as THREE from 'three';
import { setEmissiveScale } from '../voxel/palette.js';

/**
 * 四个时辰预设：晨 / 午 / 昏 / 夜
 * 注：three r155+ 采用物理光照单位（BRDF 除以 π），故强度整体按 ~π 放大
 */
export const PRESETS = {
  dawn: {
    label: '晨曦',
    sun: { dir: [-0.62, 0.26, -0.74], color: 0xffcf9c, intensity: 9.6 },
    hemi: { sky: 0xa8c4e0, ground: 0x6d5c40, intensity: 1.9 },
    ambient: { color: 0x44577a, intensity: 1.35 },
    fog: { color: 0xd9c4a4, near: 300, far: 1050 },
    sky: { top: 0x2b5da0, mid: 0x9dbfda, bottom: 0xf8ce92, haze: 1.0, sunSize: 1.0 },
    exposure: 0.98, lantern: 0.55, lampPower: 0.0
  },
  noon: {
    label: '正午',
    sun: { dir: [0.30, 0.88, -0.36], color: 0xfff4e0, intensity: 9.0 },
    hemi: { sky: 0xbcd6f2, ground: 0x7a6b4c, intensity: 2.5 },
    ambient: { color: 0x5b6f8c, intensity: 1.5 },
    fog: { color: 0xcfdcea, near: 360, far: 1200 },
    sky: { top: 0x1f6bc0, mid: 0x93c2e8, bottom: 0xdfeaf2, haze: 0.35, sunSize: 0.7 },
    exposure: 0.82, lantern: 0.28, lampPower: 0.0
  },
  dusk: {
    label: '黄昏',
    sun: { dir: [0.80, 0.18, 0.56], color: 0xff9d55, intensity: 9.0 },
    hemi: { sky: 0x8f7ba0, ground: 0x5a4632, intensity: 1.6 },
    ambient: { color: 0x4a3f63, intensity: 1.45 },
    fog: { color: 0xc99270, near: 260, far: 950 },
    sky: { top: 0x2e3f7a, mid: 0xa87a8e, bottom: 0xf5a05c, haze: 1.35, sunSize: 1.35 },
    exposure: 1.02, lantern: 0.95, lampPower: 0.6
  },
  night: {
    label: '夜色',
    sun: { dir: [-0.42, 0.55, 0.62], color: 0x9fb6e8, intensity: 2.6 },
    hemi: { sky: 0x2b3b5c, ground: 0x1c2130, intensity: 1.1 },
    ambient: { color: 0x2a3550, intensity: 1.2 },
    fog: { color: 0x1b2436, near: 220, far: 780 },
    sky: { top: 0x070d1c, mid: 0x152241, bottom: 0x33405e, haze: 0.5, sunSize: 0.55 },
    exposure: 1.2, lantern: 2.0, lampPower: 1.0
  }
};

/**
 * 灯光系统：主光（日/月，投影）+ 半球光 + 环境光 + 夜间宫灯点光
 */
export function createLighting(scene, focus, { shadowSize = 3072 } = {}) {
  const sun = new THREE.DirectionalLight(0xffffff, 3.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const R = 155;
  sun.shadow.camera.left = -R;
  sun.shadow.camera.right = R;
  sun.shadow.camera.top = R;
  sun.shadow.camera.bottom = -R;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.22;
  sun.target.position.set(focus.x, 0, focus.z);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xa8c4e0, 0x6d5c40, 0.6);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x44577a, 0.5);
  scene.add(ambient);

  // 夜间氛围点光（无阴影，开销低）
  const lampSpots = [
    [0, 12, 2], [0, 20, 74], [-44, 16, 30], [44, 16, 30], [0, 30, 130], [0, 56, 147]
  ];
  const lamps = lampSpots.map(([x, y, z]) => {
    const l = new THREE.PointLight(0xffb066, 0, 95, 2);
    l.position.set(x, y, z);
    scene.add(l);
    return l;
  });

  return { sun, hemi, ambient, lamps };
}

export function applyPreset(key, ctx) {
  const p = PRESETS[key] ?? PRESETS.dawn;
  const { sun, hemi, ambient, lamps } = ctx.lights;
  const dir = new THREE.Vector3(...p.sun.dir).normalize();

  sun.position.copy(dir).multiplyScalar(430).add(new THREE.Vector3(ctx.focus.x, 0, ctx.focus.z));
  sun.color.setHex(p.sun.color);
  sun.intensity = p.sun.intensity;
  sun.shadow.camera.updateProjectionMatrix();

  hemi.color.setHex(p.hemi.sky);
  hemi.groundColor.setHex(p.hemi.ground);
  hemi.intensity = p.hemi.intensity;

  ambient.color.setHex(p.ambient.color);
  ambient.intensity = p.ambient.intensity;

  for (const l of lamps) l.intensity = p.lampPower * 2600;

  if (ctx.scene.fog) {
    ctx.scene.fog.color.setHex(p.fog.color);
    ctx.scene.fog.near = p.fog.near;
    ctx.scene.fog.far = p.fog.far;
  }

  const u = ctx.sky.uniforms;
  u.uTop.value.setHex(p.sky.top);
  u.uMid.value.setHex(p.sky.mid);
  u.uBottom.value.setHex(p.sky.bottom);
  u.uSunColor.value.setHex(p.sun.color);
  u.uSunDir.value.copy(dir);
  u.uHaze.value = p.sky.haze;
  u.uSunSize.value = p.sky.sunSize;

  ctx.renderer.toneMappingExposure = p.exposure;
  setEmissiveScale(ctx.materials, p.lantern);
  // 云底不受直射光，单独给一点自发光，避免死黑
  const cloud = ctx.materials.CLOUD;
  cloud.emissive.setHex(p.sky.mid);
  cloud.emissiveIntensity = key === 'night' ? 0.12 : 0.42;
  return p;
}
