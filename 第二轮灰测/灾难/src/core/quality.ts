/**
 * Device capability tiers + adaptive governor.
 * Everything that costs memory or fill-rate reads its budget from here so a
 * weak laptop / phone silently gets a smaller sandbox instead of dying.
 */
export interface QualitySettings {
  tier: 0 | 1 | 2;
  pixelRatio: number;
  msaa: number;
  shadows: boolean;
  shadowSize: number;
  bloom: boolean;
  debrisCap: number;
  chunkCap: number;
  sparkCap: number;
  smokeCap: number;
  pedCount: number;
  carCount: number;
  cloudCount: number;
  eventDebris: number;
}

const TIERS: Record<0 | 1 | 2, Omit<QualitySettings, 'tier' | 'pixelRatio'>> = {
  2: {
    msaa: 4,
    shadows: true,
    shadowSize: 2048,
    bloom: true,
    debrisCap: 2400,
    chunkCap: 2600,
    sparkCap: 4200,
    smokeCap: 3000,
    pedCount: 230,
    carCount: 64,
    cloudCount: 26,
    eventDebris: 190,
  },
  1: {
    msaa: 0,
    shadows: true,
    shadowSize: 1024,
    bloom: true,
    debrisCap: 1400,
    chunkCap: 1600,
    sparkCap: 2600,
    smokeCap: 1800,
    pedCount: 150,
    carCount: 44,
    cloudCount: 18,
    eventDebris: 130,
  },
  0: {
    msaa: 0,
    shadows: false,
    shadowSize: 512,
    bloom: false,
    debrisCap: 750,
    chunkCap: 900,
    sparkCap: 1400,
    smokeCap: 950,
    pedCount: 90,
    carCount: 28,
    cloudCount: 12,
    eventDebris: 80,
  },
};

export function isMobileLike(): boolean {
  const ua = navigator.userAgent;
  const touch = (navigator.maxTouchPoints ?? 0) > 1;
  return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua) || (touch && window.innerWidth < 900);
}

function detectTier(): 0 | 1 | 2 {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 0;
  if (isMobileLike()) return cores >= 8 ? 1 : 0;
  if (cores <= 4) return 1;
  if (mem && mem <= 4) return 1;
  return 2;
}

export function makeQuality(): QualitySettings {
  const tier = detectTier();
  const dprCap = tier === 2 ? 1.75 : tier === 1 ? 1.4 : 1.1;
  return {
    tier,
    pixelRatio: Math.min(window.devicePixelRatio || 1, dprCap),
    ...TIERS[tier],
  };
}

/**
 * Watches frame time and asks for one downgrade step when the machine is
 * clearly struggling. Never upgrades (avoids oscillation), never fires more
 * than twice per session.
 */
export class PerfGovernor {
  private acc = 0;
  private frames = 0;
  private slowStreak = 0;
  private downgrades = 0;
  fps = 60;

  constructor(private readonly onDowngrade: (step: number) => void) {}

  update(dt: number): void {
    this.acc += dt;
    this.frames++;
    if (this.acc < 0.5) return;
    this.fps = this.frames / this.acc;
    const measured = this.fps;
    this.acc = 0;
    this.frames = 0;
    if (this.downgrades >= 2) return;
    if (measured < 34) {
      this.slowStreak++;
      if (this.slowStreak >= 6) {
        this.slowStreak = 0;
        this.downgrades++;
        this.onDowngrade(this.downgrades);
      }
    } else if (measured > 48) {
      this.slowStreak = Math.max(0, this.slowStreak - 1);
    }
  }
}
