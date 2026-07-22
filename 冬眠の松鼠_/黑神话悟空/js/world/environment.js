import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { assets } from '../core/assets.js';

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.sun = null;
    this.flickerLights = [];
    this.time = 0;
  }

  build() {
    const { scene, renderer } = this;

    scene.fog = new THREE.FogExp2(CONFIG.world.fogColor, CONFIG.world.fogDensity);

    if (assets.envMap) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envRT = pmrem.fromEquirectangular(assets.envMap);
      scene.environment = envRT.texture;
      scene.background = assets.envMap;
      scene.backgroundBlurriness = 0.06;
      scene.backgroundIntensity = 0.72;
      scene.environmentIntensity = 0.55;
      pmrem.dispose();
    } else {
      scene.background = new THREE.Color(0x8fa3ae);
    }

    const sun = new THREE.DirectionalLight(0xfff2dc, 2.0);
    sun.position.set(-38, 52, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 8;
    sun.shadow.camera.far = 160;
    const ext = 46;
    sun.shadow.camera.left = -ext;
    sun.shadow.camera.right = ext;
    sun.shadow.camera.top = ext;
    sun.shadow.camera.bottom = -ext;
    sun.shadow.bias = -0.0011;
    sun.shadow.normalBias = 0.35;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    const hemi = new THREE.HemisphereLight(0xbfd0d8, 0x3d4a38, 0.5);
    scene.add(hemi);

    const amb = new THREE.AmbientLight(0x6c7a80, 0.28);
    scene.add(amb);

    return this;
  }

  addFlameLight(x, y, z, color = 0xff8a3c, intensity = 2.6, distance = 13) {
    const light = new THREE.PointLight(color, intensity, distance, 1.8);
    light.position.set(x, y, z);
    light.castShadow = false;
    this.scene.add(light);
    this.flickerLights.push({ light, base: intensity, seed: Math.random() * 100 });
    return light;
  }

  update(dt, focusPos) {
    this.time += dt;
    // keep shadow box centered on player
    if (focusPos && this.sun) {
      this.sun.position.set(focusPos.x - 38, 52, focusPos.z + 26);
      this.sun.target.position.set(focusPos.x, 0, focusPos.z);
      this.sun.target.updateMatrixWorld();
    }
    for (const f of this.flickerLights) {
      const n = Math.sin(this.time * 11 + f.seed) * 0.5 + Math.sin(this.time * 23 + f.seed * 2.7) * 0.3;
      f.light.intensity = f.base * (1 + n * 0.22);
    }
  }
}
