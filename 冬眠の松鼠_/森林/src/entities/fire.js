import * as THREE from 'three';
import { Assets } from '../core/assets.js';

// 篝火：石头火坑模型 + 粒子火焰 + 闪烁点光源 + 烟雾
function makeFlameTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(0.35, 'rgba(255,160,40,0.85)');
  g.addColorStop(0.7, 'rgba(200,60,10,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

let flameTex = null;

export class Campfire {
  constructor(scene, x, y, z) {
    this.scene = scene;
    this.pos = new THREE.Vector3(x, y, z);
    this.isLit = true;

    this.group = new THREE.Group();
    this.group.position.set(x, y, z);

    const pit = Assets.cloneModelScene('fire_pit', { receiveShadow: true });
    if (pit) this.group.add(pit);

    if (!flameTex) flameTex = makeFlameTexture();

    // 火焰粒子
    this.count = 40;
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) this._resetParticle(i, Math.random());
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.flameMat = new THREE.PointsMaterial({
      map: flameTex, size: 0.55, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xffcc88,
    });
    this.flames = new THREE.Points(geo, this.flameMat);
    this.flames.position.y = 0.15;
    this.group.add(this.flames);

    // 烟雾粒子
    const sgeo = new THREE.BufferGeometry();
    this.smokeCount = 14;
    this.smokePositions = new Float32Array(this.smokeCount * 3);
    this.smokeLife = new Float32Array(this.smokeCount);
    for (let i = 0; i < this.smokeCount; i++) this._resetSmoke(i, Math.random());
    sgeo.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));
    this.smokeMat = new THREE.PointsMaterial({
      map: flameTex, size: 1.1, transparent: true, opacity: 0.16,
      depthWrite: false, color: 0x555555,
    });
    this.smoke = new THREE.Points(sgeo, this.smokeMat);
    this.smoke.position.y = 0.6;
    this.group.add(this.smoke);

    // 光源
    this.light = new THREE.PointLight(0xff9944, 12, 22, 1.8);
    this.light.position.y = 0.9;
    this.group.add(this.light);

    scene.add(this.group);
    this._t = Math.random() * 10;
  }

  _resetParticle(i, seed = 0) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.28;
    this.positions[i * 3] = Math.cos(a) * r;
    this.positions[i * 3 + 1] = 0;
    this.positions[i * 3 + 2] = Math.sin(a) * r;
    this.life[i] = seed;
  }

  _resetSmoke(i, seed = 0) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.15;
    this.smokePositions[i * 3] = Math.cos(a) * r;
    this.smokePositions[i * 3 + 1] = 0;
    this.smokePositions[i * 3 + 2] = Math.sin(a) * r;
    this.smokeLife[i] = seed;
  }

  update(dt) {
    if (!this.isLit) return;
    this._t += dt;

    for (let i = 0; i < this.count; i++) {
      this.life[i] += dt * 1.4;
      if (this.life[i] > 1) this._resetParticle(i);
      const l = this.life[i];
      this.positions[i * 3 + 1] = l * 1.1;
      // 向内收拢
      this.positions[i * 3] *= 1 - dt * 1.6;
      this.positions[i * 3 + 2] *= 1 - dt * 1.6;
    }
    this.flames.geometry.attributes.position.needsUpdate = true;

    for (let i = 0; i < this.smokeCount; i++) {
      this.smokeLife[i] += dt * 0.5;
      if (this.smokeLife[i] > 1) this._resetSmoke(i);
      const l = this.smokeLife[i];
      this.smokePositions[i * 3 + 1] = l * 2.6;
      this.smokePositions[i * 3] += Math.sin(this._t * 2 + i) * dt * 0.12;
    }
    this.smoke.geometry.attributes.position.needsUpdate = true;

    // 光照闪烁
    this.light.intensity = 10 + Math.sin(this._t * 9.7) * 1.6 + Math.sin(this._t * 23.3) * 1.1;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
