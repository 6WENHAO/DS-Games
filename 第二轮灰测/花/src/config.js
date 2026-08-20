// Global tunables. World unit = 1 meter.

export const WORLD = {
  // terrain
  terrainRadius: 2600,      // visible terrain half-extent (camera relative)
  terrainAmp: 23.0,         // vertical relief scale
  // clouds
  cloudBase: 460,
  cloudThick: 250,
  // life map (world-anchored field recording where petals have travelled)
  lifeSize: 1400,           // world extent covered by the life texture
  lifeRes: 2048,
  // camera
  near: 0.25,
  far: 4200,
  fov: 52,
};

export const QUALITY = {
  low: {
    label: '轻盈',
    terrainGrid: 160,
    resScale: 0.72,
    grass: 0.28,
    cloudSteps: 18,
    cloudLightSteps: 2,
    cloudScale: 0.4,
    dofTaps: 10,
    bloomMips: 4,
    godrays: false,
    motes: 900,
    rain: 2200,
    flowers: 2600,
  },
  medium: {
    label: '轻风',
    terrainGrid: 224,
    resScale: 0.9,
    grass: 0.5,
    cloudSteps: 26,
    cloudLightSteps: 3,
    cloudScale: 0.45,
    dofTaps: 14,
    bloomMips: 5,
    godrays: true,
    motes: 1600,
    rain: 3600,
    flowers: 4200,
  },
  high: {
    label: '盛放',
    terrainGrid: 288,
    resScale: 1.0,
    grass: 0.85,
    cloudSteps: 38,
    cloudLightSteps: 4,
    cloudScale: 0.5,
    dofTaps: 18,
    bloomMips: 5,
    godrays: true,
    motes: 2600,
    rain: 5200,
    flowers: 7000,
  },
  ultra: {
    label: '梦境',
    terrainGrid: 384,
    resScale: 1.2,
    grass: 1.3,
    cloudSteps: 56,
    cloudLightSteps: 5,
    cloudScale: 0.62,
    dofTaps: 26,
    bloomMips: 5,
    godrays: true,
    motes: 3600,
    rain: 6400,
    flowers: 9000,
  },
};

// grass layers: [wrapExtent, share of budget, minHeight, maxHeight, width, segments]
export const GRASS_LAYERS = [
  { extent: 27, share: 0.44, h0: 0.42, h1: 0.95, w: 0.042, seg: 5 },
  { extent: 74, share: 0.34, h0: 0.62, h1: 1.35, w: 0.062, seg: 4 },
  { extent: 196, share: 0.22, h0: 1.0, h1: 2.05, w: 0.115, seg: 3 },
];

export const GRASS_BUDGET = 168000; // at grass = 1.0

export const DEFAULTS = {
  quality: 'high',
  autoWeather: true,
  adaptive: true,
  cinematicBars: false,
  godrays: true,
  freeCam: false,
  dof: 1.0,
  bloom: 1.0,
  fog: 1.0,
  exposure: 1.0,
  saturation: 1.0,
  grain: 0.6,
  wind: 1.0,
  petals: 168,
  spread: 4.5,
};

export function detectQuality() {
  const dpr = window.devicePixelRatio || 1;
  const px = window.innerWidth * window.innerHeight * dpr * dpr;
  const mem = navigator.deviceMemory || 8;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (mobile) return 'low';
  if (px > 4.2e6 || mem <= 4) return 'medium';
  return 'high';
}
