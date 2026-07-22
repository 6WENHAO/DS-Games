import * as THREE from 'three';

/**
 * 渲染引擎封装：renderer / scene / camera / 主循环
 */
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.hqPixelRatio = true;
    this.updatePixelRatio();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.3, 4000);
    this.camera.position.set(0, 5, 12);

    this.clock = new THREE.Clock();
    this.updatables = new Set();
    this.running = false;
    this.timeScale = 1;
    this.onRender = null;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  updatePixelRatio() {
    const pr = this.hqPixelRatio ? Math.min(window.devicePixelRatio, 2) : 1;
    this.renderer.setPixelRatio(pr);
  }

  setShadows(on) {
    this.renderer.shadowMap.enabled = on;
    this.scene.traverse((o) => {
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => (m.needsUpdate = true));
      }
    });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  add(updatable) { this.updatables.add(updatable); return updatable; }
  remove(updatable) { this.updatables.delete(updatable); }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  tick() {
    let dt = this.clock.getDelta();
    if (dt > 0.1) dt = 0.1;
    dt *= this.timeScale;
    for (const u of this.updatables) u.update(dt);
    if (this.onRender) this.onRender(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
