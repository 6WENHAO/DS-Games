import * as THREE from 'three';
import type { GradeUniforms } from '../core/engine';

/**
 * Screen-level feedback: trauma-based camera shake plus additive full-screen
 * flashes and short exposure kicks driven through the grade pass.
 */
export class ScreenFx {
  private trauma = 0;
  private flashAmount = 0;
  private flashDecay = 4;
  private exposure = 1;
  private exposureTarget = 1;
  private t = 0;
  private rumble = 0;
  private baseVignette: number;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly grade: GradeUniforms,
  ) {
    this.baseVignette = grade.uVignette.value;
  }

  /** Impulse shake, 0..1. */
  shake(amount: number): void {
    this.trauma = Math.min(1.3, this.trauma + amount);
  }

  /** Sustained shake (earthquake / storm). */
  setRumble(amount: number): void {
    this.rumble = amount;
  }

  flash(hex: number, amount: number, decay = 4): void {
    this.grade.uFlashColor.value.setHex(hex);
    this.flashAmount = Math.max(this.flashAmount, amount);
    this.flashDecay = decay;
  }

  kickExposure(v: number): void {
    this.exposureTarget = v;
  }

  reset(): void {
    this.trauma = 0;
    this.rumble = 0;
    this.flashAmount = 0;
    this.exposure = 1;
    this.exposureTarget = 1;
    this.grade.uFlashAmount.value = 0;
    this.grade.uExposure.value = 1;
    this.grade.uVignette.value = this.baseVignette;
  }

  /** Called after the camera rig has positioned the camera. */
  update(dt: number): void {
    this.t += dt;
    const shake = this.trauma * this.trauma + this.rumble * this.rumble * 0.55;
    if (shake > 0.00002) {
      const s = shake * 2.6;
      const t = this.t;
      const ox = Math.sin(t * 47.3) * 0.6 + Math.sin(t * 23.1) * 0.4;
      const oy = Math.sin(t * 39.7 + 1.7) * 0.6 + Math.sin(t * 61.3) * 0.4;
      const oz = Math.sin(t * 53.9 + 0.6) * 0.6 + Math.sin(t * 31.7) * 0.4;
      this.camera.position.x += ox * s;
      this.camera.position.y += oy * s * 0.8;
      this.camera.position.z += oz * s;
      this.camera.rotation.z += Math.sin(t * 33.1) * shake * 0.02;
      this.camera.updateMatrixWorld();
    }
    this.trauma = Math.max(0, this.trauma - dt * (0.9 + this.trauma * 1.6));

    if (this.flashAmount > 0.0005) {
      this.flashAmount *= Math.max(0, 1 - dt * this.flashDecay);
      this.grade.uFlashAmount.value = this.flashAmount;
    } else if (this.grade.uFlashAmount.value !== 0) {
      this.flashAmount = 0;
      this.grade.uFlashAmount.value = 0;
    }

    this.exposure += (this.exposureTarget - this.exposure) * Math.min(1, dt * 3.4);
    this.grade.uExposure.value = this.exposure;
    this.exposureTarget += (1 - this.exposureTarget) * Math.min(1, dt * 1.6);
  }
}
