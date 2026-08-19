/**
 * config.js — single source of truth for world scale, tuning and palette.
 *
 * COORDINATE SYSTEM (metres, right-handed, Y-up)
 *   +X  = bridge axis, pointing from Marin (north, -X) toward San Francisco (south, +X)
 *   Y   = altitude. y = 0 is mean sea level (the ocean plane).
 *   +Z  = out to the Pacific (west). -Z = into the Bay (east).
 *
 * Real Golden Gate Bridge figures are used so the sense of scale reads correctly
 * on camera: a 1280 m main span with 227 m towers is what makes a 90 m tsunami
 * look like a 90 m tsunami.
 */

export const WORLD = {
  // ---- deck ----
  deckLength: 2737,     // total structure length
  deckWidth: 27.4,      // roadway width
  deckThickness: 7.6,   // stiffening truss depth
  deckY: 67,            // clearance above mean high water at mid-span

  // ---- towers ----
  towerX: 640,          // towers at x = -640 and x = +640  → 1280 m main span
  mainSpan: 1280,
  towerHeight: 227,     // above water
  towerLegWidth: 12,
  towerLegDepth: 16,
  towerLegSpread: 21,   // centre-to-centre of the two legs (across the deck, Z)
  towerStruts: 7,       // horizontal cross-braces per tower

  // ---- cables ----
  cableRadius: 0.46,    // 0.92 m diameter main cable
  cableSegments: 132,   // verlet particles per main cable
  cableAnchorX: 1368,   // anchorage blocks at the deck ends
  cableAnchorY: 20,
  hangerSpacing: 15.2,  // suspender rope pitch
  hangerRadius: 0.12,

  // ---- piers ----
  pierRadius: 24,
  pierHeight: 30,

  // ---- water / world extents ----
  oceanSize: 12000,
  oceanSegments: 320,   // 320×320 grid = ~205k tris, LOD-skirted
  seaLevel: 0,
  terrainInnerEdge: 1500,
};

export const CAMERA = {
  fov: 42,
  near: 0.5,
  far: 30000,
  minDistance: 10,      // close enough to watch a single cable strand let go
  maxDistance: 3000,    // whole-bay establishing shot
  dampingFactor: 0.055, // smooth damping / inertia
  focusLerp: 0.08,      // how fast the orbit target glides to a clicked focus point
  start: { theta: -0.85, phi: 1.24, radius: 1150, target: [0, 90, 0] },
};

export const PHYSICS = {
  fixedStep: 1 / 120,   // deterministic substep
  maxSubSteps: 4,       // clamp so a stalled tab cannot explode the sim
  gravity: -9.82,
  sleepAfter: 6.0,      // s of near-stillness before a chunk is frozen out of the solver
  linearDamping: 0.04,
  angularDamping: 0.06,
  maxActiveBodies: 900, // budget guard for mid-range GPUs
};

export const FRACTURE = {
  deckCellsAlongX: 96,  // Voronoi sites down the length of the deck
  deckCellsAlongZ: 3,   // and across it
  deckJitter: 0.62,     // 0 = regular grid, 1 = fully random sites
  towerChunkRows: 26,   // vertical slices per tower leg
  seed: 1337,
};

export const DISASTER = {
  earthquake: {
    buildUp: 3.2,           // s of shaking before the first cable parts
    swayAmplitude: 4.2,     // m of tower-top sway
    swayFrequency: 0.31,    // Hz — low frequency, the reason towers whip
    cableBreakInterval: 0.16,
    deckReleaseDelay: 4.6,
    magnitude: 8.2,
  },
  tsunami: {
    waveHeight: 92,
    waveLength: 1400,
    speed: 108,             // m/s wall of water
    startX: -5200,
    impactImpulse: 26000,
  },
  meteor: {
    radius: 26,
    entrySpeed: 940,
    impactPoint: [140, 67, 0],
    blastRadius: 460,
    blastImpulse: 52000,
    shockwaveSpeed: 620,
  },
  monster: {
    swipeDuration: 2.4,
    clawRadius: 34,
    strikeImpulse: 38000,
    footstepInterval: 1.9,
  },
};

export const RENDER = {
  shadowMapSize: 4096,
  shadowRadius: 3.2,        // soft-shadow blur (VSM/PCF radius)
  exposure: 1.06,
  bloomStrength: 0.72,
  bloomRadius: 0.62,
  bloomThreshold: 0.82,
  godRaySamples: 48,
  maxPixelRatio: 1.75,
  adaptiveTargetMs: 15.5,   // budget for the dynamic-resolution governor
};

export const COLORS = {
  internationalOrange: 0xc0362c,
  orangeShadow: 0x8f2419,
  cable: 0x9a9188,
  deckAsphalt: 0x2b2b30,
  concrete: 0xb9b2a4,
  rubbleInterior: 0x6e6357,   // freshly fractured faces read lighter than weathered paint
  terrainDry: 0x8d8154,
  terrainGreen: 0x5c6b3f,
  terrainRock: 0x6b6155,
  cityWindow: 0xffe6b0,
  deepWater: 0x0b2733,
  shallowWater: 0x1d5b63,
  foam: 0xeaf4f6,
  fire: 0xff7a1c,
  emberHot: 0xfff0b0,
  smoke: 0x2e2b28,
  splash: 0xdfeef2,
};

/** Time-of-day presets, t in [0,1). Drives sun elevation + atmosphere tint. */
export const TIME_PRESETS = {
  dawn:       0.055,
  morning:    0.16,
  noon:       0.30,
  goldenHour: 0.44,
  dusk:       0.50,
  stormNight: 0.78,
};
