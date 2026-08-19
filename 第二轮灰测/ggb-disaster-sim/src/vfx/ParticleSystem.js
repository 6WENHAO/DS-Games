import * as THREE from 'three';
import { PARTICLE_VERTEX, PARTICLE_FRAGMENT } from '../shaders/particles.glsl.js';
import { COLORS } from '../config.js';

export const BLOOM_LAYER = 1;

const KIND = { FIRE: 0, SMOKE: 1, SPLASH: 2, SPARK: 3 };

/**
 * ParticleSystem — one instanced, analytically-simulated pool per kind.
 *
 * The CPU touches an instance exactly once, at spawn. After that the particle
 * is a pure function of the uTime uniform, so a frame with 60 000 live particles
 * costs the same as a frame with zero: one draw call and no buffer traffic.
 *
 * Slots are handed out from a ring buffer. Overrunning simply recycles the
 * oldest particle, which is the correct failure mode for VFX — you would rather
 * lose the tail of an old plume than stall or allocate mid-explosion.
 */
class ParticlePool {
  constructor(scene, kind, capacity, opts) {
    this.capacity = capacity;
    this.cursor = 0;
    this.kind = kind;

    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.attributes.position = quad.attributes.position;
    geo.attributes.uv = quad.attributes.uv;
    geo.instanceCount = capacity;

    this.aOrigin = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aVelocity = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aParams = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.aSeed = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    for (const a of [this.aOrigin, this.aVelocity, this.aParams, this.aSeed]) {
      a.setUsage(THREE.DynamicDrawUsage);
    }
    // spawnTime = -1e9 → age > life → collapsed offscreen. Pool starts empty.
    for (let i = 0; i < capacity; i++) {
      this.aParams.array[i * 4] = -1e9;
      this.aParams.array[i * 4 + 1] = 1;
    }
    geo.setAttribute('iOrigin', this.aOrigin);
    geo.setAttribute('iVelocity', this.aVelocity);
    geo.setAttribute('iParams', this.aParams);
    geo.setAttribute('iSeed', this.aSeed);

    // A generous bounding sphere: particles are displaced entirely on the GPU,
    // so the CPU cannot know their extent. Culling is disabled instead.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.uniforms = {
      uTime: { value: 0 },
      uGravity: { value: opts.gravity ?? -9.82 },
      uWind: { value: new THREE.Vector3(0, 0, 0) },
      uSizeScale: { value: 1 },
      uOpacity: { value: opts.opacity ?? 1 },
      uColorA: { value: new THREE.Color(opts.colorA ?? 0xffffff) },
      uColorB: { value: new THREE.Color(opts.colorB ?? 0xffffff) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      uniforms: this.uniforms,
      defines: { KIND: kind },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.renderOrder ?? 10;
    if (opts.bloom) this.mesh.layers.enable(BLOOM_LAYER);
    scene.add(this.mesh);
    this.geometry = geo;
    this._quad = quad;
    this._dirty = false;
  }

  /**
   * Emit `count` particles.
   * @param {object} o
   * @param {THREE.Vector3} o.origin
   * @param {THREE.Vector3} o.direction   mean launch direction (need not be unit)
   * @param {number} o.speed              mean launch speed
   * @param {number} o.speedJitter        0..1 relative randomisation
   * @param {number} o.spread             0..1 cone widening (1 = full sphere)
   * @param {number} o.life               seconds
   * @param {number} o.size0 @param {number} o.size1
   * @param {number} [o.drag]             linear drag coefficient k
   * @param {number} [o.buoyancy]         0 = ballistic, 1 = fully lifted
   * @param {number} [o.originJitter]     metres of spawn-point scatter
   */
  emit(o) {
    const n = o.count;
    const t = this.uniforms.uTime.value;
    const dir = o.direction ? o.direction.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const tmp = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
      const s = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;

      // Cone sampling: lerp from the mean direction toward a uniform sphere
      // sample. spread = 1 gives an isotropic burst.
      tmp.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (tmp.lengthSq() < 1e-6) tmp.set(0, 1, 0);
      tmp.normalize().multiplyScalar(o.spread ?? 0.4);
      tmp.add(dir).normalize();

      const speed = o.speed * (1 + ((Math.random() * 2 - 1) * (o.speedJitter ?? 0.4)));
      const j = o.originJitter ?? 0;

      this.aOrigin.array[s * 3] = o.origin.x + (Math.random() - 0.5) * j;
      this.aOrigin.array[s * 3 + 1] = o.origin.y + (Math.random() - 0.5) * j;
      this.aOrigin.array[s * 3 + 2] = o.origin.z + (Math.random() - 0.5) * j;

      this.aVelocity.array[s * 3] = tmp.x * speed;
      this.aVelocity.array[s * 3 + 1] = tmp.y * speed;
      this.aVelocity.array[s * 3 + 2] = tmp.z * speed;

      const life = o.life * (0.7 + Math.random() * 0.6);
      this.aParams.array[s * 4] = t;
      this.aParams.array[s * 4 + 1] = life;
      this.aParams.array[s * 4 + 2] = o.size0 * (0.75 + Math.random() * 0.5);
      this.aParams.array[s * 4 + 3] = o.size1 * (0.75 + Math.random() * 0.5);

      this.aSeed.array[s * 4] = Math.random();
      this.aSeed.array[s * 4 + 1] = o.drag ?? 0.6;
      this.aSeed.array[s * 4 + 2] = Math.random() * 2 - 1;
      this.aSeed.array[s * 4 + 3] = o.buoyancy ?? 0;
    }
    this._dirty = true;
  }

  update(dt, sunDir) {
    this.uniforms.uTime.value += dt;
    if (sunDir) this.uniforms.uSunDir.value.copy(sunDir);
    if (this._dirty) {
      this.aOrigin.needsUpdate = true;
      this.aVelocity.needsUpdate = true;
      this.aParams.needsUpdate = true;
      this.aSeed.needsUpdate = true;
      this._dirty = false;
    }
  }

  clear() {
    for (let i = 0; i < this.capacity; i++) this.aParams.array[i * 4] = -1e9;
    this._dirty = true;
  }

  dispose() {
    this.geometry.dispose();
    this._quad.dispose();
    this.material.dispose();
  }
}

/**
 * ParticleManager — semantic emitters. Disaster modules describe events
 * ("a 26 m meteor hit the deck"), not particle parameters.
 */
export class ParticleManager {
  constructor(scene) {
    this.fire = new ParticlePool(scene, KIND.FIRE, 7000, {
      additive: true, bloom: true, renderOrder: 20, opacity: 0.95, gravity: -2.0,
    });
    this.smoke = new ParticlePool(scene, KIND.SMOKE, 5000, {
      additive: false, renderOrder: 15, opacity: 0.62, gravity: -1.2,
      colorA: COLORS.smoke, colorB: 0x8d8479,
    });
    this.splash = new ParticlePool(scene, KIND.SPLASH, 9000, {
      additive: false, renderOrder: 18, opacity: 0.9, gravity: -9.82,
      colorA: COLORS.splash, colorB: 0x8fc4cf,
    });
    this.spark = new ParticlePool(scene, KIND.SPARK, 5000, {
      additive: true, bloom: true, renderOrder: 22, opacity: 1, gravity: -9.82,
    });
    this.pools = [this.fire, this.smoke, this.splash, this.spark];
    this._up = new THREE.Vector3(0, 1, 0);
  }

  /** Meteor / explosive detonation. `power` ≈ 1 for a car bomb, 8 for a meteor. */
  explosion(pos, power = 1) {
    // Sizes are METRES. A 26 m meteor makes a fireball a few hundred metres
    // across, so individual fire puffs are ~30-80 m and it is their COUNT that
    // builds the volume. Authoring each puff at 234 m instead produced a
    // screen-filling white card.
    this.fire.emit({
      origin: pos, direction: this._up, speed: 24 * power, speedJitter: 0.75,
      spread: 1.0, count: Math.round(70 * power), life: 1.5 + power * 0.28,
      size0: 3 * power, size1: 9 * power, drag: 1.5, originJitter: 6 * power,
    });
    this.smoke.emit({
      origin: pos, direction: this._up, speed: 12 * power, speedJitter: 0.8,
      spread: 0.9, count: Math.round(60 * power), life: 7 + power * 1.4,
      size0: 5 * power, size1: 20 * power, drag: 0.8, buoyancy: 0.86,
      originJitter: 9 * power,
    });
    this.spark.emit({
      origin: pos, direction: this._up, speed: 78 * power, speedJitter: 0.9,
      spread: 1.0, count: Math.round(90 * power), life: 2.4,
      size0: 1.1, size1: 0.3, drag: 0.22, originJitter: 4,
    });
  }

  /** Water entry. `speed` is the impact speed in m/s. */
  waterImpact(pos, speed) {
    const p = Math.min(speed / 26, 3.2);
    this.splash.emit({
      origin: pos, direction: this._up, speed: 16 + 13 * p, speedJitter: 0.65,
      spread: 0.42, count: Math.round(30 + 55 * p), life: 2.3,
      size0: 2.4 * p + 1.4, size1: 9 * p + 3, drag: 0.5, originJitter: 5 * p,
    });
    // Fine mist lingers and catches the light.
    this.splash.emit({
      origin: pos, direction: this._up, speed: 7, speedJitter: 0.9,
      spread: 0.9, count: Math.round(14 + 20 * p), life: 3.6,
      size0: 5 * p, size1: 22 * p, drag: 1.4, buoyancy: 0.55, originJitter: 9 * p,
    });
  }

  /** Concrete-on-concrete hit: dust puff plus a few sparks. */
  debrisImpact(pos, speed) {
    const p = Math.min(speed / 22, 2.4);
    this.smoke.emit({
      origin: pos, direction: this._up, speed: 5 + 5 * p, speedJitter: 0.8,
      spread: 0.85, count: Math.round(6 + 12 * p), life: 3.4,
      size0: 3.5, size1: 20 * p + 8, drag: 1.1, buoyancy: 0.42, originJitter: 4,
    });
    if (p > 1.1) {
      this.spark.emit({
        origin: pos, direction: this._up, speed: 22 * p, speedJitter: 0.9,
        spread: 0.95, count: Math.round(8 * p), life: 1.1, size0: 0.7, size1: 0.2, drag: 0.3,
      });
    }
  }

  /** A sustained fire on a piece of wreckage. */
  burn(pos, scale = 1) {
    this.fire.emit({
      origin: pos, direction: this._up, speed: 8 * scale, speedJitter: 0.5,
      spread: 0.32, count: 5, life: 1.5, size0: 3 * scale, size1: 11 * scale,
      drag: 1.2, buoyancy: 0.3, originJitter: 4 * scale,
    });
    this.smoke.emit({
      origin: pos, direction: this._up, speed: 6 * scale, speedJitter: 0.6,
      spread: 0.4, count: 3, life: 6, size0: 6 * scale, size1: 44 * scale,
      drag: 0.7, buoyancy: 0.9, originJitter: 5 * scale,
    });
  }

  /** Spray torn off the crest of the tsunami. */
  waveSpray(pos, dirX, power) {
    this.splash.emit({
      origin: pos, direction: new THREE.Vector3(dirX * 0.55, 1, 0), speed: 26 * power,
      speedJitter: 0.7, spread: 0.55, count: Math.round(40 * power), life: 3.2,
      size0: 8, size1: 46, drag: 0.85, buoyancy: 0.35, originJitter: 120,
    });
  }

  update(dt, sunDir, wind) {
    for (const p of this.pools) {
      if (wind) p.uniforms.uWind.value.copy(wind);
      p.update(dt, sunDir);
    }
  }

  clear() { for (const p of this.pools) p.clear(); }
  dispose() { for (const p of this.pools) p.dispose(); }
}
