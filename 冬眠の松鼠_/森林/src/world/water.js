import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { CONFIG } from '../core/config.js';
import { Assets } from '../core/assets.js';

// 海洋（three.js Water 反射着色器）
export class Ocean {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(CONFIG.world.size * 6, CONFIG.world.size * 6);
    this.water = new Water(geo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: Assets.tex('waternormals'),
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x02171e,
      distortionScale: 3.2,
      fog: true,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = CONFIG.world.waterLevel;
    scene.add(this.water);
  }

  update(dt, sunDir, dayFactor) {
    this.water.material.uniforms.time.value += dt * 0.6;
    if (sunDir) this.water.material.uniforms.sunDirection.value.copy(sunDir).normalize();
    const c = this.water.material.uniforms.waterColor.value;
    c.setHex(0x02171e).multiplyScalar(0.25 + dayFactor * 0.75);
  }
}
