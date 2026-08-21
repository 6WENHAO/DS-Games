/**
 * SALTWAKE — central tuning table.
 *
 * Everything that defines how the game looks, moves and fights lives here so the
 * debug panel, the build audit and the level script all read one source.
 *
 * Units are metres and seconds. The player is 1.8 m tall with a 0.7 m hull, a
 * grid cell is 3 m, and default rooms are 4 m to the ceiling — Quake-era
 * proportions, which is what makes the movement read correctly at speed.
 */

import { CELL as GRID_CELL, STEP as GRID_STEP, WALL_HEIGHT } from '../world/grid.js';

export const TITLE = 'SALTWAKE';
export const SUBTITLE = 'Thresher\u2019s Reach, the night the tide came inland';

/* ------------------------------------------------------------------ *
 * Palette. Cool teal shadows, damp grey-brown mid-tones, sickly amber
 * and blood-red highlights. Authored in sRGB hex; the renderer works in
 * linear and the composite grades back into these anchors.
 * ------------------------------------------------------------------ */
export const PALETTE = {
  shadow: '#0d1a19',
  shadowLift: '#16292610',
  midDamp: '#4a4136',
  midStone: '#5c5648',
  midBrick: '#4e3a30',
  midWood: '#43362a',
  highAmber: '#c98b2e',
  highAmberHot: '#e8b45a',
  bloodDark: '#5c1710',
  bloodBright: '#a82a18',
  bone: '#cfc4a6',
  paper: '#d8cdb0',
  brass: '#9a7434',
  brine: '#1e3a38',
  brineLit: '#2f5a52',
  ichor: '#6f7f2a',
  flesh: '#7a5a52',
  moon: '#8fb0c4',
  fogNear: '#25332f',
  fogFar: '#33413c',
};

/** Three-point cinematic grade applied in the composite pass. */
export const GRADE = {
  shadowTint: '#12262a',
  midTint: '#5a4e3e',
  highTint: '#e0a24c',
  /** How far the hue anchors are applied. The anchors are normalised to unit
   *  luminance first, so this only shifts colour, never brightness. */
  tintStrength: 0.62,
  lift: 0.035,
  gamma: 0.94,
  gain: 1.06,
  saturation: 0.88,
  contrast: 1.18,
};

/* ------------------------------------------------------------------ *
 * Renderer
 * ------------------------------------------------------------------ */
export const RENDER = {
  /** Internal buffer height in pixels; width follows the viewport aspect.
   *  200 is the 1997 anchor. The frame is point-upscaled to the canvas. */
  heights: { low: 168, classic: 200, crisp: 240, sharp: 300 },
  quality: 'classic',

  /** Colour steps per channel before dithering. 1997 hardware territory. */
  paletteSteps: 15.0,
  ditherStrength: 0.85,

  /** Affine texture mapping: 0 = correct, 1 = full PS1-style swim. */
  affine: 0.72,
  /** Vertex snapping to the low-res pixel lattice. */
  vertexJitter: 0.85,
  /** Extra sub-pixel wobble on billboards only. */
  billboardWobble: 0.55,

  scanlines: 0.30,
  scanlineCount: 200.0,
  grain: 0.055,
  vignette: 0.34,
  exposure: 1.0,
  /** Interlace-style dropout on alternate frames. Subtle. */
  interlace: 0.07,
};

/* ------------------------------------------------------------------ *
 * Fog. The town is only ever visible about 30 m out.
 * ------------------------------------------------------------------ */
export const FOG = {
  density: 0.030,
  start: 3.0,
  power: 1.9,
  /** Ground layer: fog thickens below this height. */
  layerY: 2.6,
  layerFalloff: 0.20,
  /** How much the fog colour swings towards the light source direction. */
  lightBleed: 0.45,
  /** Slow breathing of the fog wall, in Hz. */
  breathRate: 0.055,
  breathAmount: 0.22,
};

/* ------------------------------------------------------------------ *
 * Player
 * ------------------------------------------------------------------ */
export const PLAYER = {
  height: 1.80,
  crouchHeight: 1.05,
  eye: 1.62,
  crouchEye: 0.92,
  radius: 0.35,
  stepHeight: 0.45,

  /** Quake-derived acceleration model: fast to reach speed, slippery in air. */
  walkSpeed: 6.2,
  runSpeed: 9.4,
  crouchSpeed: 2.9,
  waterSpeed: 3.6,
  accelerate: 11.0,
  airAccelerate: 1.4,
  friction: 6.2,
  stopSpeed: 1.2,
  gravity: 21.0,
  jumpSpeed: 6.0,
  waterJumpSpeed: 4.2,
  maxFallSpeed: 42.0,

  /** Fall damage kicks in past this impact speed. */
  fallSafeSpeed: 13.0,
  fallDamagePerSpeed: 3.6,

  mouseSensitivity: 0.0022,
  pitchLimit: 1.50,

  /** Bob and sway: small, stepped, never enough to spoil aim. */
  bobAmount: 0.045,
  bobRate: 9.5,
  swayAmount: 0.018,
  landDip: 0.12,

  maxHealth: 100,
  maxArmor: 100,
  /** Fraction of incoming damage armour absorbs while it holds. */
  armorAbsorb: 0.55,
  maxSanity: 100,

  drownTime: 12.0,
  drownDamage: 9,
};

/* ------------------------------------------------------------------ *
 * Sanity. Falls near horrors and when the focus is fired. It changes what
 * the player perceives; it never takes the controls away.
 * ------------------------------------------------------------------ */
export const SANITY = {
  regenPerSecond: 1.35,
  regenDelay: 6.0,
  /** Drain per second while a horror is visible and close. */
  proximityDrain: 2.4,
  proximityRange: 14.0,
  /** Cost of one focus discharge. */
  focusCost: 9,
  sightingCost: 6,
  ritualDrain: 3.2,

  /** Thresholds where new distortions come in. */
  tiers: [0.75, 0.5, 0.3, 0.12],
  phantomInterval: [7.0, 3.0],
  whisperInterval: [16.0, 5.0],
};

/* ------------------------------------------------------------------ *
 * Weapons. Slot order is the number-key order.
 * ------------------------------------------------------------------ */
export const AMMO = {
  brass: { max: 96, pickup: 12, label: 'BRASS' },
  shell: { max: 60, pickup: 8, label: 'SHELL' },
  harpoon: { max: 24, pickup: 4, label: 'IRON' },
  oil: { max: 300, pickup: 75, label: 'OIL' },
  ichor: { max: 40, pickup: 10, label: 'ICHOR' },
  bone: { max: 30, pickup: 5, label: 'BONE' },
};

export const WEAPONS = [
  {
    id: 'revolver',
    name: 'Tidewatch Revolver',
    ammo: 'brass',
    capacity: 6,
    damage: 26,
    /** Fired as hitscan pellets; 1 pellet, tight. */
    pellets: 1,
    spread: 0.006,
    fireDelay: 0.30,
    reloadTime: 1.55,
    range: 90,
    kick: 1.9,
    zoomKick: 0.9,
    light: { color: '#ffd08a', intensity: 2.6, radius: 7.0, time: 0.06 },
    sound: 'revolver',
    reloadSound: 'revolverReload',
    emptySound: 'revolverEmpty',
    viewOffset: [0.20, -0.20, -0.42],
    description: 'Six brass rounds. Accurate at any range the fog allows.',
  },
  {
    id: 'shotgun',
    name: 'Harbourman\u2019s Double',
    ammo: 'shell',
    capacity: 2,
    damage: 13,
    pellets: 9,
    spread: 0.075,
    fireDelay: 0.52,
    /** Both barrels at once with alt-fire. */
    altPellets: 18,
    altSpread: 0.105,
    altDamage: 13,
    reloadTime: 1.9,
    range: 34,
    kick: 4.4,
    light: { color: '#ffbe70', intensity: 3.4, radius: 8.5, time: 0.07 },
    sound: 'shotgun',
    reloadSound: 'shotgunReload',
    viewOffset: [0.16, -0.22, -0.36],
    description: 'Two shells. Pull both triggers to end an argument at arm\u2019s length.',
  },
  {
    id: 'harpoon',
    name: 'Whaling Harpoon Gun',
    ammo: 'harpoon',
    capacity: 1,
    damage: 78,
    projectile: 'harpoon',
    projectileSpeed: 52,
    fireDelay: 0.85,
    reloadTime: 1.35,
    kick: 3.2,
    /** Pins light enemies to whatever is behind them. */
    pinDamage: 34,
    light: { color: '#cfe4ff', intensity: 1.2, radius: 4.0, time: 0.05 },
    sound: 'harpoonFire',
    viewOffset: [0.22, -0.24, -0.30],
    description: 'One iron shaft, recovered from the wreck line. Pins what it does not kill.',
  },
  {
    id: 'flamer',
    name: 'Alchemist\u2019s Censer',
    ammo: 'oil',
    capacity: 100,
    damagePerSecond: 62,
    burnDamage: 30,
    burnTime: 4.0,
    ammoPerSecond: 22,
    fireDelay: 0.06,
    range: 7.5,
    coneAngle: 0.30,
    kick: 0.35,
    light: { color: '#ff9a3c', intensity: 2.2, radius: 9.0, time: 0.10 },
    sound: 'flamethrower',
    igniteSound: 'flamethrowerIgnite',
    viewOffset: [0.24, -0.26, -0.28],
    description: 'Pressurised whale oil and reagent salt. Burns through wet things.',
  },
  {
    id: 'focus',
    name: 'The Unlidded Focus',
    ammo: 'ichor',
    capacity: 8,
    damage: 120,
    sanityCost: SANITY.focusCost,
    projectile: 'lens',
    projectileSpeed: 26,
    /** Passes through walls; that is the point, and the price. */
    piercing: true,
    fireDelay: 1.15,
    chargeTime: 0.45,
    kick: 2.4,
    light: { color: '#9fe08a', intensity: 3.0, radius: 11.0, time: 0.22 },
    sound: 'focusRelease',
    chargeSound: 'focusCharge',
    viewOffset: [0.0, -0.30, -0.34],
    description: 'A lens ground from something that was never glass. It sees through the town.',
  },
  {
    id: 'bonecannon',
    name: 'Leviathan Bone Ordnance',
    ammo: 'bone',
    capacity: 4,
    damage: 55,
    splashDamage: 90,
    splashRadius: 5.2,
    projectile: 'boneShell',
    projectileSpeed: 34,
    fireDelay: 1.05,
    windupTime: 0.38,
    reloadTime: 2.4,
    kick: 6.5,
    light: { color: '#ffe0a0', intensity: 4.2, radius: 13.0, time: 0.12 },
    sound: 'boneCannon',
    windSound: 'boneCannonWind',
    viewOffset: [0.10, -0.34, -0.44],
    description: 'A jaw section geared into a brass breech. It has to wind before it speaks.',
  },
];

/* ------------------------------------------------------------------ *
 * Enemies. Every one needs a readable telegraph, a stated weakness and a
 * silhouette that survives being 40 pixels tall in fog.
 * ------------------------------------------------------------------ */
export const ENEMIES = {
  fisherman: {
    name: 'Drowned Hauler',
    health: 70,
    speed: 2.9,
    chargeSpeed: 5.6,
    radius: 0.42,
    height: 1.95,
    /** Silhouette: hunched, one huge swollen arm dragging a gaff hook. */
    silhouette: 'hunched, one overgrown arm, dragging hook',
    melee: { damage: 22, range: 2.4, windup: 0.62, active: 0.16, recover: 0.55 },
    weakness: { kind: 'headshot', multiplier: 2.6, note: 'the bloated skull splits' },
    resist: { flame: 0.55 },
    sanityAura: 0.4,
    gibs: 6,
    sounds: { alert: 'fishermanAlert', attack: 'fishermanSwing', hurt: 'fishermanHurt', die: 'fishermanDie' },
  },
  cultist: {
    name: 'Grafted Choirman',
    health: 55,
    speed: 2.2,
    radius: 0.38,
    height: 1.85,
    silhouette: 'tall, robed, ribcage opened outward like a lectern',
    ranged: { damage: 14, windup: 0.85, projectile: 'spit', speed: 17, range: 26, cooldown: 1.9 },
    weakness: { kind: 'flame', multiplier: 2.2, note: 'the parasite in the chest recoils' },
    resist: { bullet: 0.85 },
    sanityAura: 0.8,
    gibs: 5,
    sounds: { alert: 'cultistChant', attack: 'cultistSpit', hurt: 'fishermanHurt', die: 'cultistDie' },
  },
  crawler: {
    name: 'Trench Crawler',
    health: 38,
    speed: 6.8,
    radius: 0.44,
    height: 0.85,
    silhouette: 'low and wide, flat to the floor, too many joints',
    melee: { damage: 16, range: 1.9, windup: 0.34, active: 0.12, recover: 0.30 },
    lunge: { range: 7.0, speed: 13.5, windup: 0.40, damage: 20 },
    weakness: { kind: 'splash', multiplier: 1.9, note: 'the shell shatters under blast' },
    resist: { harpoon: 0.7 },
    sanityAura: 0.3,
    gibs: 7,
    sounds: { alert: 'crawlerSkitter', attack: 'crawlerLunge', hurt: 'fishermanHurt', die: 'crawlerDie' },
  },
  eye: {
    name: 'Vitreous Choir',
    health: 46,
    speed: 2.4,
    radius: 0.55,
    height: 1.10,
    flying: true,
    hoverHeight: 2.3,
    silhouette: 'a drifting cluster of wet spheres, no limbs at all',
    ranged: { damage: 11, windup: 1.15, beam: true, beamTime: 0.9, range: 22, cooldown: 2.4 },
    weakness: { kind: 'harpoon', multiplier: 3.0, note: 'one iron shaft bursts the whole cluster' },
    resist: { flame: 0.6 },
    sanityAura: 1.5,
    gibs: 9,
    sounds: { alert: 'eyeHum', attack: 'eyeBeam', hurt: 'fishermanHurt', die: 'eyePop' },
  },
  summoner: {
    name: 'The Wearer',
    health: 150,
    speed: 3.1,
    radius: 0.44,
    height: 2.05,
    silhouette: 'a person\u2019s outline worn slightly wrong, seams at the shoulders',
    ranged: { damage: 0, windup: 1.4, summon: 'crawler', count: 2, range: 30, cooldown: 6.5 },
    blink: { range: 9.0, cooldown: 4.0, windup: 0.5 },
    weakness: { kind: 'focus', multiplier: 2.4, note: 'the focus shows the seams' },
    resist: { bullet: 0.7, flame: 0.8 },
    sanityAura: 1.8,
    gibs: 8,
    sounds: { alert: 'summonerWhisper', attack: 'summonerSpawn', hurt: 'fishermanHurt', die: 'summonerDie' },
  },
  scion: {
    name: 'Firstborn of the Sounding',
    health: 1400,
    speed: 2.6,
    radius: 2.6,
    height: 7.4,
    boss: true,
    silhouette: 'never fully in frame; a shoulder, a limb, a shape the fog refuses',
    melee: { damage: 42, range: 6.5, windup: 1.25, active: 0.25, recover: 1.0 },
    slam: { damage: 34, radius: 9.0, windup: 1.6, cooldown: 7.0 },
    summonWave: { type: 'crawler', count: 3, cooldown: 14.0 },
    /** The fight is a puzzle: the brass conduits must be fired before damage lands. */
    weakness: { kind: 'conduit', multiplier: 1.0, note: 'armoured until the three conduits are broken' },
    armorPhases: 3,
    sanityAura: 3.2,
    gibs: 0,
    sounds: { alert: 'scionRoar', attack: 'scionSlam', hurt: 'fishermanHurt', die: 'scionRoar' },
  },
};

/* ------------------------------------------------------------------ *
 * Stop-motion animation. Poses are held, not blended.
 * ------------------------------------------------------------------ */
export const ANIM = {
  /** Discrete pose rate. Enemies run slower than the player's hands. */
  enemyFps: 8,
  bossFps: 6,
  viewmodelFps: 12,
  propFps: 6,
  /** Billboards re-pick their facing angle only this often, so they snap. */
  billboardSnapFps: 10,
  /** Number of yaw buckets a billboard can face. */
  billboardYawSteps: 16,
};

/**
 * Light bake. The world shader reads only the baked vertex colour plus the live
 * light list, so the bake has to carry the ambient itself. These numbers are what
 * keep the town navigable at a very dark palette: a hemisphere floor so shapes
 * read, a moon term for the districts under open sky, and a gain on the level's
 * own lamps.
 */
export const BAKE = {
  ambient: '#1b2b2c',
  ambientGain: 1.45,
  sky: '#2c4a4e',
  skyGain: 0.85,
  /** Indoor cells still get a fraction of the sky, as bounce. */
  indoorSkyFraction: 0.30,
  moon: '#8fb0c4',
  moonGain: 0.55,
  lightGain: 1.35,
  /** Baked lamps reach further than the same lamp does at runtime. Period
   *  lightmaps were broad soft pools; the dynamic list is the tight one. */
  radiusScale: 1.8,
};

export const WORLD = {
  /** Mirrors src/world/grid.js, which is the three-free source of truth. */
  cell: GRID_CELL,
  step: GRID_STEP,
  wallHeight: WALL_HEIGHT,
  /** Faces are subdivided to this edge length so baked vertex light has detail. */
  lightGrid: 1.0,
  maxDynamicLights: 8,
  gravityWater: 6.0,
};

export const DEBUG = {
  showColliders: false,
  showNavGrid: false,
  godMode: false,
  noclip: false,
};
