import * as THREE from 'three';

/**
 * 环境：HDRI天空 / 阳光 / 半球光 / 雾
 */
export class Environment {
  constructor(scene, assets) {
    this.scene = scene;

    scene.environment = assets.envMap;
    scene.background = assets.skyTexture;
    scene.backgroundIntensity = 1.0;
    scene.fog = new THREE.Fog(0xc3d2de, 420, 2900);

    this.hemi = new THREE.HemisphereLight(0xbdd3e6, 0x5e5442, 0.55);
    scene.add(this.hemi);

    this.sunDir = new THREE.Vector3(-0.52, 0.62, 0.42).normalize();
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.6);
    this.sun.castShadow = true;
    const s = 130;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 700;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.35;
    scene.add(this.sun);
    scene.add(this.sun.target);
  }

  /** 阴影相机跟随焦点 */
  follow(focus) {
    const d = 300;
    this.sun.position.set(
      focus.x + this.sunDir.x * d,
      focus.y + this.sunDir.y * d,
      focus.z + this.sunDir.z * d
    );
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
  }
}
