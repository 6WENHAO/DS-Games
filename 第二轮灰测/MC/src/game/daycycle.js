/**
 * game/daycycle.js
 * ------------------------------------------------------------------
 * Time of day and every colour/lighting value derived from it.
 *
 * A full Minecraft day is 24000 ticks over 20 real minutes (20 ticks per
 * second). Tick 0 is dawn, 6000 noon, 12000 dusk, 18000 midnight.
 *
 * The sky palette is keyed off the sun's elevation, which makes sunrise
 * and sunset fall out naturally instead of needing a separate timeline.
 */

import { clamp, lerp, smoothstep, vec3 } from '../core/math.js';

export const TICKS_PER_DAY = 24000;
export const TICKS_PER_SECOND = 20;

/** Named times, usable from the /time command. */
export const TIME_PRESETS = {
  day: 1000,
  noon: 6000,
  sunset: 12000,
  night: 13000,
  midnight: 18000,
  sunrise: 23000,
};

/**
 * Sky colour key frames, blended by sun elevation.
 *
 * Night is deliberately dark but not pitch black: vanilla's moonlit night
 * reads at roughly light level 4, which is dim enough to feel dangerous
 * while still letting the player navigate.
 */
const PALETTE = {
  night: {
    zenith: [0.030, 0.040, 0.100],
    horizon: [0.070, 0.085, 0.160],
    fog: [0.055, 0.070, 0.130],
    sunGlow: [0.20, 0.24, 0.42],
    light: [0.46, 0.53, 0.78],
  },
  twilight: {
    zenith: [0.10, 0.13, 0.32],
    horizon: [0.78, 0.38, 0.18],
    fog: [0.52, 0.33, 0.28],
    sunGlow: [1.00, 0.52, 0.20],
    light: [1.00, 0.72, 0.52],
  },
  day: {
    zenith: [0.29, 0.49, 0.94],
    horizon: [0.62, 0.77, 1.00],
    fog: [0.66, 0.79, 1.00],
    sunGlow: [1.00, 0.96, 0.83],
    light: [1.00, 0.98, 0.94],
  },
};

/** Blends three colour stops with the given weights into `out`. */
function blend3(out, a, b, c, wa, wb, wc) {
  out[0] = a[0] * wa + b[0] * wb + c[0] * wc;
  out[1] = a[1] * wa + b[1] * wb + c[1] * wc;
  out[2] = a[2] * wa + b[2] * wb + c[2] * wc;
  return out;
}

export class DayCycle {
  /**
   * @param {object} [opts]
   * @param {number} [opts.time]      starting tick
   * @param {boolean} [opts.frozen]   stop the clock (doDaylightCycle false)
   * @param {number} [opts.dayLength] seconds per full day
   */
  constructor({ time = 1000, frozen = false, dayLength = 1200 } = {}) {
    this.time = time;
    this.frozen = frozen;
    this.dayLength = dayLength;

    /** Unit vector pointing from the world toward the sun. */
    this.sunDirection = vec3.create(0, 1, 0);
    this.moonDirection = vec3.create(0, -1, 0);

    this.zenithColor = vec3.create();
    this.horizonColor = vec3.create();
    this.fogColor = vec3.create();
    this.sunGlowColor = vec3.create();
    this.skyLightColor = vec3.create();
    this.voidColor = vec3.create();
    this.cloudColor = vec3.create();

    /** 0..1 multiplier applied to sky light in the terrain shader. */
    this.daylight = 1;
    /** 0..1, 1 at full night. Drives stars and mob spawning. */
    this.nightFactor = 0;
    /** 0..1 sunrise/sunset strength, for the horizon glow. */
    this.twilightFactor = 0;
    /** Moon phase 0..7. */
    this.moonPhase = 0;

    this.update(0);
  }

  /** In-game hour 0..24, for the debug overlay. */
  get hour() {
    return ((this.time / TICKS_PER_DAY) * 24 + 6) % 24;
  }

  get dayNumber() {
    return Math.floor(this.time / TICKS_PER_DAY);
  }

  /** Formats the clock as HH:MM. */
  formatTime() {
    const h = this.hour;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  /** Sets absolute time; accepts a preset name or a tick count. */
  setTime(value) {
    const ticks = typeof value === 'string' ? TIME_PRESETS[value] : value;
    if (ticks === undefined || Number.isNaN(ticks)) return false;
    this.time = ((ticks % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY
      + Math.floor(this.time / TICKS_PER_DAY) * TICKS_PER_DAY;
    this.update(0);
    return true;
  }

  /**
   * Advances the clock and recomputes every derived value.
   * @param {number} dt seconds since the previous frame
   */
  update(dt) {
    if (!this.frozen) this.time += dt * (TICKS_PER_DAY / this.dayLength);
    this.moonPhase = Math.floor(this.time / TICKS_PER_DAY) % 8;

    // --- celestial geometry -------------------------------------
    const fraction = (this.time % TICKS_PER_DAY) / TICKS_PER_DAY;
    // theta = 0 at noon, +-PI/2 at dusk/dawn.
    const theta = (fraction - 0.25) * Math.PI * 2;
    this.celestialAngle = theta;
    const tilt = 0.28;
    vec3.set(this.sunDirection, Math.sin(theta), Math.cos(theta), tilt);
    vec3.normalize(this.sunDirection, this.sunDirection);
    vec3.set(this.moonDirection, -this.sunDirection[0], -this.sunDirection[1], -this.sunDirection[2]);

    const elevation = this.sunDirection[1];   // -1 .. 1

    // --- weights ------------------------------------------------
    // day peaks when the sun is high, twilight when it is near the
    // horizon, night once it is well below.
    const dayW = smoothstep(clamp((elevation - 0.02) / 0.30, 0, 1));
    const nightW = smoothstep(clamp((-elevation - 0.10) / 0.22, 0, 1));
    const twilightW = clamp(1 - dayW - nightW, 0, 1);
    this.nightFactor = nightW;
    this.twilightFactor = twilightW;

    blend3(this.zenithColor, PALETTE.day.zenith, PALETTE.twilight.zenith, PALETTE.night.zenith, dayW, twilightW, nightW);
    blend3(this.horizonColor, PALETTE.day.horizon, PALETTE.twilight.horizon, PALETTE.night.horizon, dayW, twilightW, nightW);
    blend3(this.fogColor, PALETTE.day.fog, PALETTE.twilight.fog, PALETTE.night.fog, dayW, twilightW, nightW);
    blend3(this.sunGlowColor, PALETTE.day.sunGlow, PALETTE.twilight.sunGlow, PALETTE.night.sunGlow, dayW, twilightW, nightW);
    blend3(this.skyLightColor, PALETTE.day.light, PALETTE.twilight.light, PALETTE.night.light, dayW, twilightW, nightW);

    // Void colour: a darker version of the fog, like looking into the abyss.
    vec3.scale(this.voidColor, this.fogColor, 0.32);
    // Clouds pick up the sky tint but stay brighter than the fog.
    this.cloudColor[0] = lerp(0.62, 1.0, dayW) * (0.55 + 0.45 * (1 - nightW));
    this.cloudColor[1] = lerp(0.58, 1.0, dayW) * (0.55 + 0.45 * (1 - nightW));
    this.cloudColor[2] = lerp(0.66, 1.0, dayW) * (0.60 + 0.40 * (1 - nightW));

    // --- sky light strength -------------------------------------
    // Vanilla never fully darkens sky light: a moonlit night still reads
    // around light level 4, which is ~25% brightness.
    this.daylight = lerp(0.25, 1.0, dayW + twilightW * 0.45);

    // Glow strength: strongest during twilight so sunsets pop.
    this.sunGlowStrength = 0.35 + twilightW * 1.15 + dayW * 0.25;
    return this;
  }

  /** Snapshot for saving. */
  serialise() {
    return { time: this.time, frozen: this.frozen, dayLength: this.dayLength };
  }

  restore(state) {
    if (!state) return;
    if (typeof state.time === 'number') this.time = state.time;
    if (typeof state.frozen === 'boolean') this.frozen = state.frozen;
    if (typeof state.dayLength === 'number') this.dayLength = state.dayLength;
    this.update(0);
  }
}
