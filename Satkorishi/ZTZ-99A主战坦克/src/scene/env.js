/**
 * 环境 / 光影 / 后处理
 *
 * - 物理天空 (Sky) 驱动太阳方向 + 由天空实时烘出 PMREM 环境贴图（金属件反射才对）
 * - 平行光阴影（贴合车体的紧凑正交视锥，保证 2048 分辨率下也有细节）
 * - 5 种光照预案：正午 / 上午 / 黄昏 / 夜间 / 展厅
 * - 后处理链：Render → Outline(红) → Bloom → Output(ACES 色调映射)
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { groundTexture } from '../tank/materials.js';

// RectAreaLight 必须先初始化 LTC 查找表，否则渲染为黑
RectAreaLightUniformsLib.init();

export const LIGHT_PRESETS = [
  {
    id: 'noon',
    name: '正午强光',
    sun: { el: 64, az: 128, intensity: 4.6, color: 0xfff4e2 },
    hemi: { sky: 0xbcd6ff, ground: 0x6b6350, intensity: 0.55 },
    sky: { turbidity: 3.2, rayleigh: 1.4, mie: 0.006, mieG: 0.8 },
    exposure: 0.92,
    bloom: { strength: 0.32, radius: 0.5, threshold: 0.92 },
    env: 1.0,
    lamps: 0.15,
    fog: 0.0016,
    fogColor: 0xbcc9d6,
  },
  {
    id: 'morning',
    name: '上午侧光',
    sun: { el: 32, az: 74, intensity: 4.0, color: 0xffe9c8 },
    hemi: { sky: 0xa9c6ef, ground: 0x5e5a49, intensity: 0.5 },
    sky: { turbidity: 4.5, rayleigh: 2.1, mie: 0.008, mieG: 0.82 },
    exposure: 0.95,
    bloom: { strength: 0.42, radius: 0.55, threshold: 0.86 },
    env: 1.05,
    lamps: 0.2,
    fog: 0.0022,
    fogColor: 0xc4cfd8,
  },
  {
    id: 'dusk',
    name: '黄昏逆光',
    sun: { el: 5.5, az: 196, intensity: 3.4, color: 0xff9d52 },
    hemi: { sky: 0x4a5a80, ground: 0x3a3026, intensity: 0.42 },
    sky: { turbidity: 8.5, rayleigh: 2.6, mie: 0.02, mieG: 0.88 },
    exposure: 1.02,
    bloom: { strength: 0.72, radius: 0.62, threshold: 0.72 },
    env: 1.1,
    lamps: 0.55,
    fog: 0.006,
    fogColor: 0x6d5a4c,
  },
  {
    id: 'night',
    name: '夜间行动',
    sun: { el: -6, az: 220, intensity: 0.35, color: 0x9fc0ff },
    hemi: { sky: 0x1b2434, ground: 0x0d1014, intensity: 0.3 },
    sky: { turbidity: 12, rayleigh: 0.35, mie: 0.004, mieG: 0.9 },
    exposure: 1.35,
    bloom: { strength: 0.95, radius: 0.7, threshold: 0.45 },
    env: 0.55,
    lamps: 1.6,
    fog: 0.009,
    fogColor: 0x0b1018,
  },
  {
    id: 'studio',
    name: '展厅棚拍',
    sun: { el: 46, az: 150, intensity: 2.0, color: 0xffffff },
    hemi: { sky: 0xffffff, ground: 0x9a9a9a, intensity: 0.7 },
    studio: true,
    exposure: 0.9,
    bloom: { strength: 0.28, radius: 0.45, threshold: 0.95 },
    env: 1.5,
    lamps: 0.25,
    fog: 0.0,
    fogColor: 0x1a1d21,
  },
];

export class Environment {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.presetId = 'morning';
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.envRT = null;
    this.roomRT = null;

    /* ---- 天空 ---- */
    this.sky = new Sky();
    this.sky.scale.setScalar(20000);
    this.sky.name = 'sky';
    this.sky.userData.noExport = true;
    scene.add(this.sky);
    this.sunDir = new THREE.Vector3();

    /* ---- 光源 ---- */
    this.sun = new THREE.DirectionalLight(0xffffff, 4);
    this.sun.name = 'sunLight';
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 60;
    this.setShadowExtent(7.5);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.022;
    this.sun.target.position.set(0, 1, 0);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x6b6350, 0.5);
    scene.add(this.hemi);

    // 补光（模拟地面/环境反射，避免暗部死黑）
    this.fill = new THREE.DirectionalLight(0xdfe8ff, 0.45);
    this.fill.position.set(-6, 4, -7);
    scene.add(this.fill);

    // 展厅三点光
    this.studioLights = new THREE.Group();
    this.studioLights.visible = false;
    const key = new THREE.RectAreaLight(0xffffff, 6, 8, 5);
    key.position.set(6, 7, 8);
    key.lookAt(0, 1.4, 0);
    const rim = new THREE.RectAreaLight(0xbfd8ff, 4, 10, 4);
    rim.position.set(-8, 5, -8);
    rim.lookAt(0, 1.4, 0);
    const top = new THREE.RectAreaLight(0xffffff, 3, 12, 12);
    top.position.set(0, 12, 0);
    top.lookAt(0, 0, 0);
    this.studioLights.add(key, rim, top);
    scene.add(this.studioLights);

    /* ---- 地面 ---- */
    this.groundTex = groundTexture(1024);
    this.groundTex.repeat.set(16, 16);
    this.groundMat = new THREE.MeshStandardMaterial({
      name: 'ground',
      map: this.groundTex,
      roughness: 0.96,
      metalness: 0.02,
      color: 0x9a9384,
    });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.002;
    this.ground.receiveShadow = true;
    this.ground.name = 'ground';
    this.ground.userData.noExport = true;
    scene.add(this.ground);

    // 展厅地面（深色镜面）
    this.studioFloorMat = new THREE.MeshStandardMaterial({
      name: 'studio_floor',
      color: 0x14171b,
      roughness: 0.22,
      metalness: 0.5,
    });

    /* ---- 雾 ---- */
    scene.fog = new THREE.FogExp2(0xc4cfd8, 0.002);

    /* ---- 后处理 ---- */
    const size = renderer.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.outline = new OutlinePass(new THREE.Vector2(size.x, size.y), scene, camera, []);
    this.outline.edgeStrength = 4.2;
    this.outline.edgeGlow = 0.45;
    this.outline.edgeThickness = 1.6;
    this.outline.pulsePeriod = 0;
    this.outline.visibleEdgeColor.set(0xff3b26);
    this.outline.hiddenEdgeColor.set(0x7a1508);
    this.composer.addPass(this.outline);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.55, 0.86);
    this.composer.addPass(this.bloom);

    this.output = new OutputPass();
    this.composer.addPass(this.output);

    // 关键：用一次 setSize 让 composer 按设备像素比重算所有 RT 与 pass 尺寸
    // （构造时传入的自定义 RT 会被 EffectComposer 当作 CSS 尺寸，不重算会渲染模糊）
    this.setSize(size.x, size.y);

    this.applyPreset('morning');
  }

  setShadowExtent(r) {
    const c = this.sun.shadow.camera;
    c.left = -r;
    c.right = r;
    c.top = r;
    c.bottom = -r;
    c.updateProjectionMatrix();
  }

  setShadowQuality(n) {
    this.sun.shadow.mapSize.set(n, n);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
  }

  get preset() {
    return LIGHT_PRESETS.find((p) => p.id === this.presetId) || LIGHT_PRESETS[0];
  }

  /** 由天空实时烘环境贴图 —— 金属反射与天光一致 */
  #bakeSkyEnv() {
    const parent = this.sky.parent;
    const tmp = new THREE.Scene();
    tmp.add(this.sky);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(tmp);
    if (parent) parent.add(this.sky);
    this.scene.environment = this.envRT.texture;
  }

  #bakeRoomEnv() {
    if (!this.roomRT) this.roomRT = this.pmrem.fromScene(new RoomEnvironment(), 0.035);
    this.scene.environment = this.roomRT.texture;
  }

  applyPreset(id, opts = {}) {
    const p = LIGHT_PRESETS.find((x) => x.id === id) || LIGHT_PRESETS[0];
    this.presetId = p.id;
    const studio = !!p.studio;

    // 太阳方向
    const el = THREE.MathUtils.degToRad(opts.sunEl ?? p.sun.el);
    const az = THREE.MathUtils.degToRad(opts.sunAz ?? p.sun.az);
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(24);
    this.sun.intensity = p.sun.intensity;
    this.sun.color.setHex(p.sun.color);
    this.hemi.color.setHex(p.hemi.sky);
    this.hemi.groundColor.setHex(p.hemi.ground);
    this.hemi.intensity = p.hemi.intensity;
    this.fill.intensity = studio ? 0 : 0.4;

    // 天空
    this.sky.visible = !studio;
    if (!studio) {
      const u = this.sky.material.uniforms;
      u.turbidity.value = p.sky.turbidity;
      u.rayleigh.value = p.sky.rayleigh;
      u.mieCoefficient.value = p.sky.mie;
      u.mieDirectionalG.value = p.sky.mieG;
      u.sunPosition.value.copy(this.sunDir);
      this.#bakeSkyEnv();
      this.scene.background = this.envRT.texture;
      this.scene.backgroundIntensity = 1;
      this.ground.material = this.groundMat;
    } else {
      this.#bakeRoomEnv();
      this.scene.background = new THREE.Color(0x0e1114);
      this.ground.material = this.studioFloorMat;
    }
    this.studioLights.visible = studio;

    // 雾
    if (p.fog > 0) {
      if (!this.scene.fog) this.scene.fog = new THREE.FogExp2(p.fogColor, p.fog);
      this.scene.fog.color.setHex(p.fogColor);
      this.scene.fog.density = p.fog;
    } else {
      this.scene.fog = null;
    }

    // 曝光与泛光
    this.renderer.toneMappingExposure = opts.exposure ?? p.exposure;
    this.bloom.strength = p.bloom.strength;
    this.bloom.radius = p.bloom.radius;
    this.bloom.threshold = p.bloom.threshold;
    return p;
  }

  setExposure(v) {
    this.renderer.toneMappingExposure = v;
  }

  setBloom(strength) {
    this.bloom.strength = strength;
  }

  setOutlineTargets(objects) {
    this.outline.selectedObjects = objects || [];
  }

  setSize(w, h) {
    // composer.setSize 内部会按 pixelRatio 换算并逐个 pass 调 setSize，
    // 因此这里不能再单独用 CSS 尺寸去调 outline/bloom（会把它们降到 CSS 分辨率）
    this.composer.setSize(w, h);
  }

  /** 渲染倍率变化时同步 composer（它自己缓存了 pixelRatio） */
  setPixelRatio(r) {
    this.composer.setPixelRatio(r);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
    if (this.envRT) this.envRT.dispose();
    if (this.roomRT) this.roomRT.dispose();
    this.pmrem.dispose();
    this.groundTex.dispose();
    this.groundMat.dispose();
    this.studioFloorMat.dispose();
    this.ground.geometry.dispose();
  }
}
