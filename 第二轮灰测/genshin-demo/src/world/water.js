// Lake + ocean surface: reflective, refracting, animated, with shoreline foam.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { makeWaterNormals } from '../core/textures.js';
import { WORLD, height } from './heightfield.js';
import { GLSL_NOISE } from '../core/noise.js';

export class WaterSystem {
  constructor(ctx) {
    this.ctx = ctx;
    const normals = makeWaterNormals(ctx.quality.texSize >= 256 ? 256 : 128);
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    const geo = new THREE.PlaneGeometry(WORLD.size * 1.6, WORLD.size * 1.6, 1, 1);
    const reflect = ctx.quality.reflections;

    this.water = new Water(geo, {
      textureWidth: reflect ? 512 : 64,
      textureHeight: reflect ? 512 : 64,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x1b4f63,
      distortionScale: 3.1,
      fog: true,
      alpha: 0.94,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = WORLD.waterLevel;
    this.water.frustumCulled = false;
    this.water.renderOrder = -1;
    if (!reflect) {
      // cheap mode: skip the mirror render entirely
      this.water.onBeforeRender = () => {};
    }
    // richer surface: deep/shallow gradient + shoreline foam band
    this.water.material.onBeforeCompile = (() => {
      const orig = this.water.material.onBeforeCompile;
      return (shader, renderer) => {
        orig?.call(this.water.material, shader, renderer);
        shader.uniforms.uShore = { value: new THREE.Color(0x63c8c0) };
        shader.uniforms.uDeep = { value: new THREE.Color(0x0a2f45) };
        shader.uniforms.uFoamTime = { value: 0 };
        this._extra = shader.uniforms;
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', `uniform vec3 uShore; uniform vec3 uDeep; uniform float uFoamTime;
            ${GLSL_NOISE}
            void main() {`)
          .replace('gl_FragColor = vec4( ( vec3( 0.1 ) + scatter * 0.4 + reflectionSample * 0.9 + reflectionSample * specularLight ), alpha );',
            `vec3 base = vec3(0.1) + scatter * 0.4 + reflectionSample * 0.9 + reflectionSample * specularLight;
             float camDist = length(worldPosition.xyz - cameraPosition);
             float depthFade = smoothstep(0.0, 26.0, camDist * 0.06);
             base = mix(base * 1.22 + uShore * 0.16, base + uDeep * 0.10, depthFade);
             float ripple = gfbm(worldPosition.xz * 0.42 + vec2(uFoamTime * 0.5, uFoamTime * 0.31), 3);
             float band = smoothstep(0.55, 1.0, ripple + 0.5);
             base += vec3(band) * 0.05;
             gl_FragColor = vec4(base, alpha);`);
      };
    })();
    this.water.material.needsUpdate = true;
    ctx.scene.add(this.water);
    this.enabled = true;

    // The mirror pass re-renders the whole scene, which tripled draw calls near the coast.
    // Grass/props/NPCs are invisible in a rippling reflection, so mask them out of it.
    const HEAVY = ['structures', 'worldobjects', 'puzzles', 'npcs', 'vegetation', 'scatter', 'ambientlife', 'fx', 'sight', 'nameplates'];
    const prevOBR = this.water.onBeforeRender;
    this._reflectHidden = [];
    this.water.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      if (!this._heavyRefs) {
        this._heavyRefs = HEAVY.map(n => scene.getObjectByName(n)).filter(Boolean);
      }
      const hidden = this._reflectHidden;
      hidden.length = 0;
      for (const g of this._heavyRefs) if (g.visible) { g.visible = false; hidden.push(g); }
      try { prevOBR.call(this.water, renderer, scene, camera, geometry, material, group); }
      finally { for (const g of hidden) g.visible = true; }
    };
  }

  /** Is a point underwater? */
  isUnder(y) { return y < WORLD.waterLevel - 0.15; }
  /** Depth of water at (x,z); <=0 means dry land. */
  depthAt(x, z) { return WORLD.waterLevel - height(x, z); }

  update(dt) {
    const u = this.water.material.uniforms;
    u.time.value += dt * 0.62;
    u.sunDirection.value.copy(this.ctx.sky.sunDir);
    u.sunColor.value.copy(this.ctx.sky.sun.color).multiplyScalar(0.9);
    const day = this.ctx.sky.dayFactor;
    u.waterColor.value.setHSL(0.53, 0.62, 0.06 + day * 0.10);
    if (this._extra) this._extra.uFoamTime.value += dt;
    // keep the infinite plane centred on the camera
    this.water.position.x = this.ctx.camera.position.x;
    this.water.position.z = this.ctx.camera.position.z;
    // only pay for reflections when the camera can actually see water
    if (this.ctx.quality.reflections) {
      const camY = this.ctx.camera.position.y;
      this.water.visible = camY < 260;
    }
  }
}
