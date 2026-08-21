/**
 * The shared uniform bus.
 *
 * Every custom material receives *these exact uniform objects* (by reference),
 * so one write per frame updates the whole scene: sun, cloud drift, wind,
 * fog and the actor push list. It is also what keeps grass, ground, foliage and
 * props locked to a single lighting model.
 */
import * as THREE from 'three';
import { PALETTE, SUN, TOON, CLOUDS, FOGCFG, WIND, GRASS } from './config.js';

function sunDirection(azimuthDeg, elevationDeg) {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const c = Math.cos(el);
  return new THREE.Vector3(Math.cos(az) * c, Math.sin(el), Math.sin(az) * c).normalize();
}

/**
 * 1x1 hemisphere value the materials hold until buildEnvironment() installs the
 * real probe, which happens during boot and before the first frame is drawn.
 * Byte-typed and point-filtered, so it needs no float-filtering extension.
 */
const bootstrapProbe = new THREE.DataTexture(
  new Uint8Array([90, 115, 140, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType,
);
bootstrapProbe.colorSpace = THREE.NoColorSpace;
bootstrapProbe.magFilter = THREE.NearestFilter;
bootstrapProbe.minFilter = THREE.NearestFilter;
bootstrapProbe.generateMipmaps = false;
bootstrapProbe.needsUpdate = true;

export const sunDir = sunDirection(SUN.azimuth, SUN.elevation);

export const shared = {
  uTime: { value: 0 },
  uStopFps: { value: WIND.stopFps },
  uStopMotion: { value: WIND.stopMotion },

  uSunDir: { value: sunDir.clone() },
  uSunColor: { value: PALETTE.sun.clone().multiplyScalar(SUN.intensity) },
  uSkyColor: { value: PALETTE.sky.clone() },
  uBounceColor: { value: PALETTE.bounce.clone() },
  uViewDir: { value: new THREE.Vector3(0, -0.5, -1).normalize() },

  uToonSteps: { value: TOON.steps },
  uToonSoft: { value: TOON.soft },
  uAmbientStrength: { value: SUN.ambient },

  uCloudDir: { value: new THREE.Vector2(CLOUDS.dirX, CLOUDS.dirZ).normalize() },
  uCloudScale: { value: CLOUDS.scale },
  uCloudSpeed: { value: CLOUDS.speed },
  uCloudCover: { value: CLOUDS.cover },
  uCloudSoft: { value: CLOUDS.soft },
  uCloudDark: { value: CLOUDS.dark },

  uFogColor: { value: PALETTE.fog.clone() },
  uFogSunColor: { value: PALETTE.fogSun.clone() },
  uFogDensity: { value: FOGCFG.density },
  uFogCurve: { value: FOGCFG.curve },
  uFogStart: { value: FOGCFG.start },
  uFogHeight: { value: FOGCFG.height },
  uFogHeightFalloff: { value: FOGCFG.heightFalloff },
  uFocus: { value: new THREE.Vector3(0, 1, 0) },

  uWindDir: { value: new THREE.Vector2(WIND.dirX, WIND.dirZ).normalize() },
  uWindScale: { value: WIND.scale },
  uWindSpeed: { value: WIND.speed },
  uWindStrength: { value: WIND.strength },
  uGustStrength: { value: WIND.gust },

  uIrradiance: { value: bootstrapProbe },
  uIrradianceGain: { value: 1.0 },
};

/** Uniforms shared only by the two billboard-sprite fields (grass, flowers). */
export const bladeShared = {
  uViewRight: { value: new THREE.Vector2(1, 0) },
  uActors: {
    value: Array.from({ length: GRASS.maxActors }, () => new THREE.Vector4(0, -999, 0, 0)),
  },
  uActorCount: { value: 0 },
  uPushStrength: { value: GRASS.pushStrength },
  uPushRadiusScale: { value: GRASS.pushRadiusScale },
  uUvCompensate: { value: GRASS.uvCompensate },
  uUvSquashFloor: { value: GRASS.uvSquashFloor },
  uCurvePow: { value: GRASS.curvePow },
  uBaseLean: { value: GRASS.baseLean },
  uYawJitter: { value: GRASS.yawJitter },
  uSpriteW: { value: GRASS.spriteW },
  uSpriteH: { value: GRASS.spriteH },
  uVariants: { value: GRASS.variants },
};

/**
 * Fixed-capacity registry of things that push grass aside. Capacity is
 * allocated once (GRASS.maxActors) because the uniform array size is baked into
 * the compiled shader.
 */
class ActorRegistry {
  constructor(capacity) {
    this.capacity = capacity;
    this.slots = [];
  }

  /** @returns {{position: THREE.Vector3, radius: number, active: boolean, release(): void}} */
  register(radius = 1.6) {
    const slot = {
      position: new THREE.Vector3(0, -999, 0),
      radius,
      active: true,
      release: () => {
        const i = this.slots.indexOf(slot);
        if (i >= 0) this.slots.splice(i, 1);
      },
    };
    if (this.slots.length >= this.capacity) {
      console.warn('[dsh] actor registry full; oldest slot recycled');
      this.slots.shift();
    }
    this.slots.push(slot);
    return slot;
  }

  clear() {
    this.slots.length = 0;
  }

  /** Packs the live slots into the uniform array once per frame. */
  sync() {
    const arr = bladeShared.uActors.value;
    let n = 0;
    for (const slot of this.slots) {
      if (!slot.active || n >= this.capacity) continue;
      arr[n].set(slot.position.x, slot.position.y, slot.position.z, slot.radius);
      n += 1;
    }
    for (let i = n; i < this.capacity; i += 1) arr[i].set(0, -9999, 0, 0);
    bladeShared.uActorCount.value = n;
  }
}

export const actors = new ActorRegistry(GRASS.maxActors);

/** Merge the shared bus into a material's own uniforms, keeping references. */
export function withShared(own = {}, includeBlade = false) {
  return Object.assign({}, shared, includeBlade ? bladeShared : null, own);
}

const _camDir = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Call once per frame, before rendering. */
export function updateShared(elapsed, camera, focus = null) {
  shared.uTime.value = elapsed;
  if (focus) shared.uFocus.value.copy(focus);

  camera.getWorldDirection(_camDir);
  shared.uViewDir.value.copy(_camDir);

  // Horizontal screen-right vector: the billboard axis for every blade. Taking
  // it from the camera basis (instead of a per-blade look-at) keeps the field
  // coherent under an orthographic projection, which has one view direction for
  // the whole frame. cross(forward, up) is screen right.
  _camRight.crossVectors(_camDir, UP);
  if (_camRight.lengthSq() < 1e-6) _camRight.set(1, 0, 0);
  _camRight.normalize();
  bladeShared.uViewRight.value.set(_camRight.x, _camRight.z);

  actors.sync();
}

export function setIrradiance(texture) {
  shared.uIrradiance.value = texture;
}

export function setSunAngles(azimuthDeg, elevationDeg) {
  const d = sunDirection(azimuthDeg, elevationDeg);
  sunDir.copy(d);
  shared.uSunDir.value.copy(d);
}

/** Mutable view settings the shader lab writes to. */
export const renderState = {
  quality: GRASS.defaultQuality,
};
