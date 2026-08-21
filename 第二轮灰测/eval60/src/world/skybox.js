/**
 * 天空：程序化星空球 + 由它烘焙出的环境贴图（给金属船体反射用）。
 */
import * as THREE from 'three';
import { SKY_GLSL } from '../fx/skyGLSL.js';

export class Skybox {
  constructor({ radius = 200000 } = {}) {
    this.radius = radius;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uIntensity: { value: 1.0 },
        uStarBoost: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        ${SKY_GLSL}
        uniform float uIntensity;
        uniform float uStarBoost;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          vec3 col = skyNebula(d) + skyStars(d) * uStarBoost;
          gl_FragColor = vec4(col * uIntensity, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), this.material);
    this.mesh.name = 'Skybox';
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
  }

  /** 天空球始终跟随相机，避免飞出边界 */
  update(cameraPosition) {
    this.mesh.position.copy(cameraPosition);
    this.mesh.updateMatrix();
    this.mesh.updateMatrixWorld(true);
  }

  /** 用天空烘焙 PMREM 环境贴图（临时提亮，让金属船体有可读的反射） */
  bakeEnvironment(renderer, boost = 2.6) {
    const prev = this.material.uniforms.uIntensity.value;
    this.material.uniforms.uIntensity.value = prev * boost;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const tmp = new THREE.Scene();
    const probe = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20), this.material);
    probe.frustumCulled = false;
    tmp.add(probe);
    const rt = pmrem.fromScene(tmp, 0.04, 1, 4000);
    probe.geometry.dispose();
    pmrem.dispose();
    this.material.uniforms.uIntensity.value = prev;
    return rt.texture;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
