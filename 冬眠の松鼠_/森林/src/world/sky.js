import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CONFIG } from '../core/config.js';

// 天空穹顶 + 太阳/月亮光照 + 昼夜循环 + 星空 + 雾
export class DayNight {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.time = CONFIG.time.startHour / 24; // 0..1 一天
    this.day = 1;

    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 8;
    u.rayleigh.value = 1.8;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;

    this.sunLight = new THREE.DirectionalLight(0xfff2dd, 2.6);
    this.sunLight.castShadow = true;
    const sm = this.sunLight.shadow;
    sm.mapSize.set(CONFIG.graphics.shadowMapSize, CONFIG.graphics.shadowMapSize);
    const r = CONFIG.graphics.shadowRadius;
    sm.camera.left = -r; sm.camera.right = r;
    sm.camera.top = r; sm.camera.bottom = -r;
    sm.camera.near = 1; sm.camera.far = 400;
    sm.bias = -0.0004;
    sm.normalBias = 0.6;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.moonLight = new THREE.DirectionalLight(0x8fa8cc, 0.0);
    scene.add(this.moonLight);
    scene.add(this.moonLight.target);

    this.hemi = new THREE.HemisphereLight(0xbcd3e8, 0x3a4a30, 0.7);
    scene.add(this.hemi);

    this.fog = new THREE.FogExp2(CONFIG.world.fogDay, 0.0016);
    scene.fog = this.fog;

    // 星空
    this.stars = this._makeStars();
    scene.add(this.stars);

    this._sunPos = new THREE.Vector3();
    this._colDay = new THREE.Color(CONFIG.world.fogDay);
    this._colNight = new THREE.Color(CONFIG.world.fogNight);
    this._colDawn = new THREE.Color(0xcc8866);
  }

  _makeStars() {
    const count = 1400;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // 均匀分布在上半球
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.95);
      const r = 3800;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xdde8ff, size: 2.2, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false,
      fog: false,
    });
    return new THREE.Points(geo, mat);
  }

  // dayFactor: 0 深夜 -> 1 正午
  get dayFactor() {
    const elev = Math.sin((this.time - 0.25) * Math.PI * 2); // 6点日出 18点日落
    return THREE.MathUtils.clamp(elev * 1.4 + 0.5, 0, 1);
  }

  get isNight() { return this.dayFactor < 0.12; }

  get hour() { return this.time * 24; }

  update(dt, playerPos) {
    this.time += dt / CONFIG.time.dayLength;
    if (this.time >= 1) { this.time -= 1; this.day++; }

    const angle = (this.time - 0.25) * Math.PI * 2; // 太阳角
    const elev = Math.sin(angle);
    const azim = Math.cos(angle);

    // 太阳方向
    this._sunPos.set(azim * 0.8, elev, 0.45).normalize();
    this.sky.material.uniforms.sunPosition.value.copy(this._sunPos);

    // 太阳光跟随玩家（阴影视锥居中）
    const sunDist = 180;
    this.sunLight.position.set(
      playerPos.x + this._sunPos.x * sunDist,
      Math.max(4, playerPos.y + this._sunPos.y * sunDist),
      playerPos.z + this._sunPos.z * sunDist
    );
    this.sunLight.target.position.copy(playerPos);

    const df = this.dayFactor;
    this.sunLight.intensity = df * 2.8;
    this.sunLight.castShadow = df > 0.05;

    // 日出日落染色
    const duskAmount = THREE.MathUtils.clamp(1 - Math.abs(elev) * 4, 0, 1);
    this.sunLight.color.setHSL(0.1 - duskAmount * 0.045, 0.5 + duskAmount * 0.4, 0.62 - duskAmount * 0.1);

    // 月光
    this.moonLight.position.set(playerPos.x - this._sunPos.x * sunDist, playerPos.y + 80, playerPos.z - this._sunPos.z * sunDist);
    this.moonLight.target.position.copy(playerPos);
    this.moonLight.intensity = (1 - df) * 0.22;

    this.hemi.intensity = 0.12 + df * 0.75;

    // 雾颜色/密度
    const fogCol = this._colNight.clone().lerp(this._colDay, df);
    if (duskAmount > 0 && df > 0.05) fogCol.lerp(this._colDawn, duskAmount * 0.45);
    this.fog.color.copy(fogCol);
    this.fog.density = 0.0016 + (1 - df) * 0.0012;

    // 星星
    this.stars.material.opacity = THREE.MathUtils.clamp(0.9 - df * 2.2, 0, 0.9);
    this.stars.position.copy(playerPos);
    this.stars.rotation.y = this.time * Math.PI * 2 * 0.5;

    // 天空亮度（夜晚压暗）
    this.renderer.toneMappingExposure = 0.35 + df * 0.45;
  }

  get clockText() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `Day ${this.day}  ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
