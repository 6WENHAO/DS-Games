/**
 * Central tuning table. Everything the look depends on lives here so the debug
 * panel and both scenes read from one source.
 */
import * as THREE from 'three';

export const WORLD = {
  size: 150,          // terrain is size x size units, centred on the origin
  segments: 176,      // ground tessellation
  seed: 20482,
};

/** Late-afternoon meadow palette. Hex values are authored in sRGB; THREE.Color
 *  converts them into the linear working space on construction. */
export const PALETTE = {
  sun:        new THREE.Color('#ffe2ae'),
  sky:        new THREE.Color('#8ec5e6'),
  skyHorizon: new THREE.Color('#d8ecf2'),
  skyZenith:  new THREE.Color('#4f9fd4'),
  bounce:     new THREE.Color('#6b8a44'),
  fog:        new THREE.Color('#cbe0e6'),
  fogSun:     new THREE.Color('#f6dcb0'),

  grassDeep:  new THREE.Color('#23421c'),
  grassMid:   new THREE.Color('#41762a'),
  grassLit:   new THREE.Color('#87bc46'),
  grassDry:   new THREE.Color('#b8ab52'),
  grassTip:   new THREE.Color('#d3e07a'),

  soil:       new THREE.Color('#7b5533'),
  soilLit:    new THREE.Color('#b58a58'),
  soilDark:   new THREE.Color('#4a3220'),
  gravel:     new THREE.Color('#c9b394'),

  bark:       new THREE.Color('#5a4130'),
  barkLit:    new THREE.Color('#8b6a4c'),
  leafDeep:   new THREE.Color('#22491f'),
  leafMid:    new THREE.Color('#3f7a2c'),
  leafLit:    new THREE.Color('#8dc24a'),

  stone:      new THREE.Color('#8f9490'),
  stoneLit:   new THREE.Color('#c2c6bd'),

  crate:      new THREE.Color('#b3803f'),
  crateDark:  new THREE.Color('#6d4a24'),
  crateBand:  new THREE.Color('#8a6a45'),

  whaleBody:  new THREE.Color('#4f6f9c'),
  whaleBelly: new THREE.Color('#dfe9ef'),
  whaleFin:   new THREE.Color('#3d5880'),
};

export const SUN = {
  /**
   * Azimuth in degrees measured from +X towards +Z, elevation above horizon.
   * 226 deg puts the sun roughly opposite both cameras, so the meadow is lit
   * from behind: that is what drives the transmission term in the grass shader
   * and lights every blade tip from within.
   */
  azimuth: 226,
  elevation: 29,
  intensity: 1.5,
  ambient: 0.64,
};

export const TOON = {
  steps: 4.0,
  soft: 0.16,
};

export const CLOUDS = {
  scale: 0.0125,
  speed: 0.42,
  cover: 0.545,
  soft: 0.115,
  dark: 0.52,
  dirX: 0.86,
  dirZ: 0.51,
};

/**
 * Aerial perspective. Under a tilted orthographic camera the ground plane fills
 * the frame all the way up, so distance is closed by haze rather than by a
 * horizon line: about 24% at 20 m from the focus, 52% at 30 m, 69% at the top of
 * the frame. Canopies keep more contrast than the ground under them because of
 * the height falloff, which is what gives the treeline its depth.
 */
export const FOGCFG = {
  density: 0.040,
  curve: 1.40,
  start: 10.0,
  height: 2.4,
  heightFalloff: 0.05,
};

export const WIND = {
  dirX: 0.82,
  dirZ: 0.57,
  scale: 0.055,
  speed: 1.35,
  strength: 0.78,
  gust: 1.15,
  stopFps: 12.0,
  stopMotion: 1.0,
};

export const GRASS = {
  /** Blade budget per quality tier. One draw call regardless of count. */
  counts: { low: 14000, medium: 34000, high: 68000 },
  defaultQuality: 'medium',
  spriteW: 8,        // virtual pixel-art sprite resolution, in texels
  spriteH: 16,
  variants: 6,
  width: [0.28, 0.46],
  height: [0.85, 1.9],
  curvePow: 1.85,
  baseLean: 0.5,
  yawJitter: 0.85,
  pushStrength: 1.65,
  pushRadiusScale: 1.0,
  uvCompensate: 0.9,
  uvSquashFloor: 0.42,
  maxActors: 8,
};

export const FLOWERS = {
  width: [0.2, 0.32],
  height: [0.5, 0.95],
};

export const RENDER = {
  /** Internal render height in pixels; the frame is point-upscaled to the
   *  canvas so the 3D layer keeps a chunky pixel grid. */
  pixelHeights: { low: 288, medium: 384, high: 512 },
  pixelArt: true,
  paletteSteps: 26.0,
  ditherStrength: 0.55,
  vignette: 0.28,
  exposure: 1.06,
  saturation: 1.1,
};

/** Isometric framing for the two app modes. */
export const CAMERAS = {
  menu: {
    target: new THREE.Vector3(-3, 1.4, 11),
    yaw: 44,
    pitch: 26,
    distance: 140,
    frustumHeight: 34,
  },
  play: {
    target: new THREE.Vector3(37, 1.2, 11),
    yaw: 38,
    pitch: 44,
    distance: 140,
    frustumHeight: 25,
  },
};

/** The mown plot the puzzle is staged on. Terrain is levelled here. */
export const LAWN = {
  center: new THREE.Vector3(37, 0, 11),
  tile: 2.0,
  halfW: 13.5,
  halfD: 12.5,
  height: 1.05,
  border: 3.5,
};

export const QUALITY_ORDER = ['low', 'medium', 'high'];
