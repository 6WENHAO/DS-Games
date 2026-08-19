import * as THREE from 'three';

/**
 * CameraShake — trauma-based procedural shake.
 *
 * WHY "TRAUMA" AND NOT "PLAY A SHAKE ANIMATION"
 * --------------------------------------------
 * Events add to a single scalar reservoir; the reservoir decays exponentially
 * and the actual displacement is trauma², sampled from smooth noise. Three
 * consequences that a canned animation cannot give you:
 *   • events compose — a tower hitting the water during a quake stacks,
 *   • it never repeats, because it is noise, not a curve,
 *   • the quadratic response makes small hits subtle and big hits violent,
 *     which is how the reader's eye expects impact energy to scale.
 *
 * Shake is generated in CAMERA space (right/up/forward), so the shake direction
 * is always relative to the frame — a world-space offset would feel like the
 * bridge moving, not the operator flinching.
 *
 * Frequency is deliberately split: a low band (~2 Hz) for the ground moving a
 * heavy tripod, and a high band (~19 Hz) for the impulse rattle.
 */
export class CameraShake {
  constructor() {
    this.trauma = 0;
    this.maxTrauma = 1;
    this.decay = 1.35;          // trauma units per second
    this.offset = new THREE.Vector3();
    this.roll = 0;

    /** Sustained shake, e.g. while an earthquake is running. */
    this.ambient = 0;

    this._t = 0;
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._fwd = new THREE.Vector3();

    // Derived cinematic couplings, read by PostFX.
    this.motionBlur = 0;
    this.aberration = 0;
    this._prevQuat = new THREE.Quaternion();
    this._angularSpeed = 0;
  }

  /** @param amount 0..1. 0.25 = nearby debris impact, 1 = meteor detonation. */
  add(amount) {
    this.trauma = Math.min(this.maxTrauma, this.trauma + amount);
  }

  /** Distance-attenuated version: a collapse 2 km away should barely register. */
  addAt(amount, worldPos, cameraPos, falloffRadius = 900) {
    const d = worldPos.distanceTo(cameraPos);
    const k = Math.max(0, 1 - d / falloffRadius);
    this.add(amount * k * k);
  }

  setAmbient(a) { this.ambient = THREE.MathUtils.clamp(a, 0, 1); }

  /** Two-octave smooth noise in [-1,1], distinct per channel. */
  _noise(seed) {
    const t = this._t;
    return Math.sin(t * 19.1 + seed * 7.3) * 0.62
         + Math.sin(t * 41.7 + seed * 13.9) * 0.24
         + Math.sin(t * 2.13 + seed * 3.1) * 0.34;
  }

  /**
   * @param realDt unscaled delta — the operator's hands do not go into slow
   *               motion when the simulation does.
   * @param camera used for the camera-space basis and angular-velocity coupling
   */
  update(realDt, camera) {
    this._t += realDt;

    // Angular velocity of the rig → motion blur / aberration coupling.
    const dq = this._prevQuat.invert().premultiply(camera.quaternion);
    const angle = 2 * Math.acos(THREE.MathUtils.clamp(Math.abs(dq.w), -1, 1));
    this._angularSpeed = realDt > 0
      ? THREE.MathUtils.lerp(this._angularSpeed, angle / realDt, 0.25)
      : this._angularSpeed;
    this._prevQuat.copy(camera.quaternion);

    this.trauma = Math.max(0, this.trauma - this.decay * realDt);
    const energy = Math.max(this.trauma, this.ambient);
    const s = energy * energy;      // quadratic response

    if (s < 1e-5) {
      this.offset.set(0, 0, 0);
      this.roll = 0;
    } else {
      camera.matrixWorld.extractBasis(this._right, this._up, this._fwd);
      // Amplitude scales with distance to the target so shake stays visually
      // constant whether you are 20 m or 2 km out.
      const dist = camera.position.length() || 1;
      const amp = s * Math.min(2.4 + dist * 0.004, 9);
      this.offset.set(0, 0, 0)
        .addScaledVector(this._right, this._noise(1.0) * amp)
        .addScaledVector(this._up, this._noise(2.7) * amp * 0.82)
        .addScaledVector(this._fwd, this._noise(4.3) * amp * 0.35);
      this.roll = this._noise(6.1) * s * 0.028;
    }

    // Blur when the rig whips OR the ground is shaking.
    const whip = THREE.MathUtils.clamp(this._angularSpeed / 2.2, 0, 1);
    this.motionBlur = THREE.MathUtils.clamp(whip * 0.55 + s * 0.42, 0, 0.72);
    this.aberration = THREE.MathUtils.clamp(s * 0.9 + whip * 0.18, 0, 1) * 0.012;
  }

  reset() {
    this.trauma = 0;
    this.ambient = 0;
    this.offset.set(0, 0, 0);
    this.roll = 0;
    this.motionBlur = 0;
    this.aberration = 0;
  }
}
