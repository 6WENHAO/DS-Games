import * as THREE from 'three';
import { SKY_VERTEX, SKY_FRAGMENT } from '../shaders/sky.glsl.js';
import { RENDER, WORLD } from '../config.js';

/**
 * SkySystem — atmosphere, sun, and the lighting rig, all driven by one scalar:
 * time of day.
 *
 * t ∈ [0,1) is a full 24 h cycle. Sun elevation is sin(2πt), so
 *   t=0.00 sunrise · t=0.25 zenith · t=0.50 sunset · t=0.75 solar midnight.
 * Azimuth drifts slowly so the sun is never exactly on the bridge axis — a
 * raking light is what makes the towers read as three-dimensional.
 *
 * Everything downstream (ocean reflections, fog, god-ray tint, shadow softness)
 * reads its state from here, so there is exactly one place where "what time is
 * it" lives.
 */
export class SkySystem {
  constructor(scene) {
    this.scene = scene;
    this.timeOfDay = 0.3;
    this.storm = 0;
    this.night = 0;
    this.turbidity = 2.8;
    this.sunDir = new THREE.Vector3(0.4, 0.6, 0.5).normalize();

    // ---- dome -----------------------------------------------------------
    this.uniforms = {
      uSunDir: { value: this.sunDir },
      uTurbidity: { value: this.turbidity },
      uStorm: { value: 0 },
      uNight: { value: 0 },
      uTime: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(WORLD.oceanSize * 1.6, 48, 32);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1000;
    scene.add(this.dome);

    // ---- sun ------------------------------------------------------------
    this.sunLight = new THREE.DirectionalLight(0xffffff, 3.1);
    this.sunLight.castShadow = true;
    const s = this.sunLight.shadow;
    s.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
    s.radius = RENDER.shadowRadius;
    s.bias = -0.0006;
    s.normalBias = 0.9;
    // Orthographic frustum sized to the structure, not the world: 3200×1500 m
    // over a 4k map is ~0.8 m/texel, enough to resolve tower bracing shadows.
    s.camera.left = -1700; s.camera.right = 1700;
    s.camera.top = 780;   s.camera.bottom = -780;
    s.camera.near = 10;   s.camera.far = 7000;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Sky/ground bounce. Real ambient occlusion comes from the shadow map; this
    // just keeps shadowed faces from going pure black.
    this.hemi = new THREE.HemisphereLight(0x9fc4e8, 0x40352a, 0.55);
    scene.add(this.hemi);

    // Fill light opposite the sun, faked bounce off the water.
    this.fill = new THREE.DirectionalLight(0x88aacc, 0.35);
    scene.add(this.fill);

    scene.fog = new THREE.FogExp2(0x9fb6c4, 0.000075);

    this.setTimeOfDay(this.timeOfDay);
  }

  /** @param t 0..1 day fraction. */
  setTimeOfDay(t) {
    this.timeOfDay = ((t % 1) + 1) % 1;
    this._recompute();
  }

  /** @param s 0 = clear, 1 = full storm. */
  setStorm(s) {
    this.storm = THREE.MathUtils.clamp(s, 0, 1);
    this._recompute();
  }

  _recompute() {
    const t = this.timeOfDay;
    const elev = Math.sin(t * Math.PI * 2);            // -1..1
    const az = 2.05 + t * 1.25;                        // slow drift, radians
    const ce = Math.cos(Math.asin(THREE.MathUtils.clamp(elev, -1, 1)));
    this.sunDir.set(ce * Math.cos(az), elev, ce * Math.sin(az)).normalize();

    // Night ramps in as the sun crosses the horizon, with civil twilight width.
    this.night = THREE.MathUtils.smoothstep(-this.sunDir.y, -0.02, 0.14);
    this.turbidity = THREE.MathUtils.lerp(2.6, 11.5, this.storm);

    this.uniforms.uSunDir.value.copy(this.sunDir);
    this.uniforms.uTurbidity.value = this.turbidity;
    this.uniforms.uStorm.value = this.storm;
    this.uniforms.uNight.value = this.night;

    // ---- key light ------------------------------------------------------
    const up = Math.max(this.sunDir.y, 0);
    // Warm and dim near the horizon (long optical path), neutral and strong high.
    const warm = new THREE.Color(1.0, 0.42, 0.16);
    const white = new THREE.Color(1.0, 0.97, 0.92);
    this.sunLight.color.copy(warm).lerp(white, THREE.MathUtils.smoothstep(up, 0.02, 0.42));
    this.sunLight.intensity = (0.15 + 3.3 * Math.pow(up, 0.72)) * (1 - this.storm * 0.72);

    const D = 3000;
    this.sunLight.position.copy(this.sunDir).multiplyScalar(D);
    this.sunLight.target.position.set(0, WORLD.deckY, 0);
    this.fill.position.set(-this.sunDir.x * D, 400, -this.sunDir.z * D);
    this.fill.intensity = 0.12 + 0.32 * up * (1 - this.storm * 0.4);

    // Moonlight replaces sunlight at night rather than going black.
    if (this.night > 0.5) {
      this.sunLight.color.setRGB(0.55, 0.66, 1.0);
      this.sunLight.intensity = 0.34 * (1 - this.storm * 0.6);
      this.sunLight.position.set(-D * 0.4, D * 0.7, D * 0.5);
    }

    // ---- ambient + fog --------------------------------------------------
    this.hemi.intensity = (0.14 + 0.62 * up) * (1 - this.storm * 0.25)
                        + this.night * 0.06;
    this.hemi.color.setRGB(
      THREE.MathUtils.lerp(0.30, 0.62, up),
      THREE.MathUtils.lerp(0.40, 0.77, up),
      THREE.MathUtils.lerp(0.62, 0.92, up),
    );

    // Fog colour tracks the horizon so distant land dissolves into the sky.
    const fogWarm = new THREE.Color(0.95, 0.62, 0.42);
    const fogDay = new THREE.Color(0.62, 0.73, 0.82);
    const fogNight = new THREE.Color(0.035, 0.055, 0.10);
    const c = fogWarm.clone().lerp(fogDay, THREE.MathUtils.smoothstep(up, 0.03, 0.35));
    c.lerp(fogNight, this.night);
    if (this.storm > 0) c.lerp(new THREE.Color(0.30, 0.33, 0.36), this.storm * 0.85);
    this.scene.fog.color.copy(c);
    this.scene.fog.density = THREE.MathUtils.lerp(0.000068, 0.00021, this.storm);

    /** Tint used by the god-ray pass so the shafts match the sun. */
    this.rayTint = this.sunLight.color.clone();
    /** Whether god rays should be visible at all. */
    this.rayStrength = (1 - this.night) * (1 - this.storm * 0.55)
                     * THREE.MathUtils.smoothstep(this.sunDir.y, -0.02, 0.30);
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
  }

  dispose() {
    this.dome.geometry.dispose();
    this.dome.material.dispose();
    this.scene.remove(this.dome, this.sunLight, this.hemi, this.fill);
  }
}
