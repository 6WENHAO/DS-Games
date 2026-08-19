import * as THREE from 'three';
import { OCEAN_VERTEX, OCEAN_FRAGMENT } from '../shaders/ocean.glsl.js';
import { WORLD, COLORS, DISASTER } from '../config.js';

/**
 * Ocean — Gerstner sea surface plus the tsunami soliton.
 *
 * ONE WAVE TABLE, TWO EVALUATORS
 * ------------------------------
 * The wave parameters live here in JS and are pushed to the shader as uniform
 * arrays. `sampleHeight()` re-implements the exact same summation on the CPU.
 * That duplication is deliberate and load-bearing: splash spawn points, debris
 * water-entry tests and the tsunami's collision front must agree with the
 * surface the player actually sees. A single source of parameters with two
 * evaluators is far safer than reading pixels back from the GPU.
 *
 * Steepness is clamped so that Σ(Q·A·k) ≤ 1 per wave, the point at which a
 * Gerstner surface starts to self-intersect and shows through itself.
 */
export class Ocean {
  constructor(scene) {
    this.scene = scene;

    // dir(x,z) · amplitude · wavelength · steepness · speed
    this.waves = [
      { dir: [1.0, 0.22], amp: 1.35, len: 210, steep: 0.62, speed: 13.5 },
      { dir: [0.82, -0.55], amp: 0.95, len: 148, steep: 0.55, speed: 11.2 },
      { dir: [0.55, 0.83], amp: 0.62, len: 92, steep: 0.48, speed: 8.4 },
      { dir: [-0.35, 0.94], amp: 0.34, len: 57, steep: 0.42, speed: 6.1 },
      { dir: [0.97, 0.24], amp: 0.19, len: 31, steep: 0.36, speed: 4.4 },
      { dir: [-0.72, -0.69], amp: 0.10, len: 17, steep: 0.30, speed: 3.1 },
    ];
    this._clampSteepness();

    const waveA = [];
    const waveB = [];
    for (const w of this.waves) {
      const d = new THREE.Vector2(w.dir[0], w.dir[1]).normalize();
      waveA.push(new THREE.Vector4(d.x, d.y, w.amp, w.len));
      waveB.push(new THREE.Vector2(w.steep, w.speed));
    }

    this.tsunami = new THREE.Vector4(DISASTER.tsunami.startX, 0, 400, 0);

    this.uniforms = {
      uWaveA: { value: waveA },
      uWaveB: { value: waveB },
      uTime: { value: 0 },
      uTsunami: { value: this.tsunami },
      uCameraPos: { value: new THREE.Vector3() },
      uMorphNear: { value: 900 },
      uMorphFar: { value: 4200 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uDeepColor: { value: new THREE.Color(COLORS.deepWater) },
      uShallowColor: { value: new THREE.Color(COLORS.shallowWater) },
      uFoamColor: { value: new THREE.Color(COLORS.foam) },
      uTurbidity: { value: 2.8 },
      uStorm: { value: 0 },
      uNight: { value: 0 },
    };

    const geo = new THREE.PlaneGeometry(
      WORLD.oceanSize, WORLD.oceanSize, WORLD.oceanSegments, WORLD.oceanSegments,
    );
    geo.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: OCEAN_VERTEX,
      fragmentShader: OCEAN_FRAGMENT,
      uniforms: this.uniforms,
      side: THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = WORLD.seaLevel;
    this.mesh.receiveShadow = false;   // a displaced shader surface cannot use the
                                       // standard shadow path; the water reads its
                                       // light from the shared sky function instead
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);

    this.time = 0;
    this._snapStep = WORLD.oceanSize / WORLD.oceanSegments;
  }

  /** Keep every wave below the trochoidal self-intersection limit. */
  _clampSteepness() {
    for (const w of this.waves) {
      const k = (Math.PI * 2) / w.len;
      const maxQ = 1 / (k * w.amp * this.waves.length);
      w.steep = Math.min(w.steep, maxQ);
    }
  }

  /**
   * CPU mirror of the shader's displacement. Returns world-space Y at (x,z).
   * @param {number} x
   * @param {number} z
   * @param {THREE.Vector3} [outNormal] optional normal output
   */
  sampleHeight(x, z, outNormal = null) {
    let y = 0;
    let tx = 1, ty = 0, tz = 0;
    let bx = 0, by = 0, bz = 1;

    for (const w of this.waves) {
      const dl = Math.hypot(w.dir[0], w.dir[1]) || 1;
      const dx = w.dir[0] / dl, dz = w.dir[1] / dl;
      const k = (Math.PI * 2) / w.len;
      const f = k * (dx * x + dz * z - w.speed * this.time);
      const s = Math.sin(f), c = Math.cos(f);
      y += w.amp * s;
      if (outNormal) {
        const wa = k * w.amp;
        tx += -w.steep * dx * dx * wa * s; ty += dx * wa * c; tz += -w.steep * dx * dz * wa * s;
        bx += -w.steep * dx * dz * wa * s; by += dz * wa * c; bz += -w.steep * dz * dz * wa * s;
      }
    }

    if (this.tsunami.w > 0.5) {
      const d = (x - this.tsunami.x) / this.tsunami.z;
      const shaped = d > 0 ? d * 2.35 : d * 0.55;
      y += this.tsunami.y * Math.exp(-shaped * shaped);
    }

    if (outNormal) {
      // n = binormal × tangent
      outNormal.set(by * tz - bz * ty, bz * tx - bx * tz, bx * ty - by * tx).normalize();
      if (outNormal.y < 0) outNormal.negate();
    }
    return y;
  }

  /** True if a world point is under the (possibly tsunami-raised) surface. */
  isSubmerged(x, y, z) { return y < this.sampleHeight(x, z); }

  setTsunami(frontX, height, width, enabled) {
    this.tsunami.set(frontX, height, width, enabled ? 1 : 0);
  }

  /** Pull sky state in so reflections match the dome exactly. */
  syncSky(sky) {
    this.uniforms.uSunDir.value.copy(sky.sunDir);
    this.uniforms.uTurbidity.value = sky.turbidity;
    this.uniforms.uStorm.value = sky.storm;
    this.uniforms.uNight.value = sky.night;
  }

  /**
   * @param dt scaled delta
   * @param camera used to keep the finite grid centred on the viewer and to
   *               drive distance-based amplitude damping
   */
  update(dt, camera) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    this.uniforms.uCameraPos.value.copy(camera.position);

    // Snap the grid to the camera in whole cells. Because the shader samples the
    // wave field in WORLD space, translating the mesh does not slide the waves —
    // it only moves which part of the infinite ocean we are tessellating.
    const step = this._snapStep;
    this.mesh.position.x = Math.round(camera.position.x / step) * step;
    this.mesh.position.z = Math.round(camera.position.z / step) * step;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
  }
}
