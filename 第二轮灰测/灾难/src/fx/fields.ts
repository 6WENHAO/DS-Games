/**
 * Lightweight force fields shared by debris, collapse chunks, cars and people.
 * Disasters register a slot and mutate it; consumers just sample.
 */
export interface Vortex {
  active: boolean;
  x: number;
  z: number;
  radius: number;
  strength: number;
  top: number;
}

export interface Well {
  active: boolean;
  x: number;
  y: number;
  z: number;
  radius: number;
  strength: number;
  eat: number;
}

export class FieldSet {
  readonly vortices: Vortex[] = [];
  readonly wells: Well[] = [];
  /** Flood surface height (0 = dry). */
  waterLevel = 0;
  /** Outward drift applied to floating things. */
  waterCurrent = 0;

  constructor() {
    for (let i = 0; i < 2; i++)
      this.vortices.push({ active: false, x: 0, z: 0, radius: 20, strength: 0, top: 60 });
    for (let i = 0; i < 2; i++)
      this.wells.push({ active: false, x: 0, y: 10, z: 0, radius: 40, strength: 0, eat: 3 });
  }

  reset(): void {
    for (const v of this.vortices) v.active = false;
    for (const w of this.wells) w.active = false;
    this.waterLevel = 0;
    this.waterCurrent = 0;
  }

  get anyActive(): boolean {
    for (const v of this.vortices) if (v.active) return true;
    for (const w of this.wells) if (w.active) return true;
    return false;
  }
}

/** Scratch accumulator (single-threaded, avoids per-particle allocation). */
export const FORCE = { x: 0, y: 0, z: 0, eaten: false };

/** Accumulate acceleration from every active field at a world position. */
export function sampleForce(f: FieldSet, px: number, py: number, pz: number): void {
  FORCE.x = 0;
  FORCE.y = 0;
  FORCE.z = 0;
  FORCE.eaten = false;

  for (let i = 0; i < f.vortices.length; i++) {
    const v = f.vortices[i];
    if (!v.active) continue;
    const dx = px - v.x;
    const dz = pz - v.z;
    const d = Math.hypot(dx, dz);
    if (d > v.radius || py > v.top) continue;
    const t = 1 - d / v.radius;
    const inv = 1 / Math.max(0.7, d);
    const nx = dx * inv;
    const nz = dz * inv;
    const s = v.strength * (0.25 + t * t * 1.75);
    // tangential swirl + inward suction + updraft
    FORCE.x += -nz * s * 3.1 - nx * s * 1.15;
    FORCE.z += nx * s * 3.1 - nz * s * 1.15;
    FORCE.y += s * 2.7 * (1 - Math.min(1, py / v.top) * 0.55);
  }

  for (let i = 0; i < f.wells.length; i++) {
    const w = f.wells[i];
    if (!w.active) continue;
    const dx = w.x - px;
    const dy = w.y - py;
    const dz = w.z - pz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > w.radius) continue;
    if (d < w.eat) {
      FORCE.eaten = true;
      continue;
    }
    const inv = 1 / d;
    const falloff = w.strength * (1 - d / w.radius) ** 1.4;
    FORCE.x += dx * inv * falloff * 9;
    FORCE.y += dy * inv * falloff * 9;
    FORCE.z += dz * inv * falloff * 9;
    // orbital component so matter spirals instead of dropping straight in
    FORCE.x += -dz * inv * falloff * 7.5;
    FORCE.z += dx * inv * falloff * 7.5;
  }
}
