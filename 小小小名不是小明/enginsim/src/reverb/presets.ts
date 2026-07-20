import type { EarlyIROptions } from './early-ir';

export interface ScenePreset {
  early: number;
  tail: number;
  t60: number;
  damp: number;
  cabinLp: number;
  preDelay: number;
  ir: EarlyIROptions;
}

export const SCENES: Record<string, ScenePreset> = {
  exterior: {
    early: 0.16, tail: 0.10, t60: 0.45, damp: 0.62, cabinLp: 20000, preDelay: 0.008,
    ir: { duration: 0.05, taps: 8, size: 0.5, color: 7000 }
  },
  cockpit: {
    early: 0.30, tail: 0.07, t60: 0.32, damp: 0.85, cabinLp: 1100, preDelay: 0.003,
    ir: { duration: 0.03, taps: 10, size: 0.25, color: 2500 }
  },
  tunnel: {
    early: 0.30, tail: 0.50, t60: 3.6, damp: 0.35, cabinLp: 20000, preDelay: 0.02,
    ir: { duration: 0.09, taps: 16, size: 0.9, color: 5000 }
  },
  garage: {
    early: 0.36, tail: 0.26, t60: 1.1, damp: 0.5, cabinLp: 20000, preDelay: 0.012,
    ir: { duration: 0.07, taps: 14, size: 0.6, color: 4000 }
  }
};

export type SceneName = keyof typeof SCENES;
