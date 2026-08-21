/**
 * SALTWAKE — shared render state.
 *
 * Every custom material receives these exact uniform objects by reference, so one
 * write per frame moves the fog, the moon, the dynamic light list and the retro
 * knobs for the whole scene at once. It is also what keeps the world, the
 * billboards, the enemies and the viewmodel inside one consistent look.
 *
 * The dynamic light list has a fixed capacity because the array size is compiled
 * into the shader. Lights are submitted every frame and the nearest ones to the
 * camera win, which is how the era's engines handled a light budget.
 */
import * as THREE from 'three';
import { PALETTE, FOG, RENDER, WORLD } from './config.js';

const col = (hex) => new THREE.Color(hex);

export const shared = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(356, 200) },
  uAffine: { value: RENDER.affine },
  uVertexJitter: { value: RENDER.vertexJitter },
  uCameraPos: { value: new THREE.Vector3() },

  uAmbient: { value: col(PALETTE.shadow).multiplyScalar(1.15) },
  uSkyColor: { value: col(PALETTE.brine).multiplyScalar(0.9) },
  uMoonDir: { value: new THREE.Vector3(0.35, 0.55, -0.75).normalize() },
  uMoonColor: { value: col(PALETTE.moon).multiplyScalar(0.42) },

  uLightCount: { value: 0 },
  uLightPos: { value: Array.from({ length: WORLD.maxDynamicLights }, () => new THREE.Vector4(0, -999, 0, 0)) },
  uLightColor: { value: Array.from({ length: WORLD.maxDynamicLights }, () => new THREE.Color(0, 0, 0)) },

  uFogNear: { value: col(PALETTE.fogNear) },
  uFogFar: { value: col(PALETTE.fogFar) },
  uFogDensity: { value: FOG.density },
  uFogStart: { value: FOG.start },
  uFogPower: { value: FOG.power },
  uFogLayerY: { value: FOG.layerY },
  uFogLayerFalloff: { value: FOG.layerFalloff },
  uFogBleed: { value: FOG.lightBleed },
  uFogBreath: { value: FOG.breathAmount },
};

/** Merge the shared bus into a material's own uniforms, keeping references. */
export function withShared(own = {}) {
  return Object.assign({}, shared, own);
}

/**
 * Dynamic light submission. Lights are gathered each frame and the closest
 * WORLD.maxDynamicLights to the camera are uploaded.
 */
class LightBudget {
  constructor(capacity) {
    this.capacity = capacity;
    this.pending = [];
  }

  /** @param {THREE.Vector3|{x,y,z}} pos @param {THREE.Color|string} color */
  add(pos, radius, color, intensity = 1) {
    if (radius <= 0 || intensity <= 0) return;
    this.pending.push({ x: pos.x, y: pos.y, z: pos.z, radius, color, intensity });
  }

  clear() {
    this.pending.length = 0;
  }

  /** Sorts by distance to the camera, uploads the winners, clears the queue. */
  flush(cameraPos) {
    const list = this.pending;
    if (list.length > this.capacity) {
      for (const l of list) {
        const dx = l.x - cameraPos.x;
        const dy = l.y - cameraPos.y;
        const dz = l.z - cameraPos.z;
        // Bias by intensity: a bright muzzle flash outranks a distant candle.
        l._key = (dx * dx + dy * dy + dz * dz) / Math.max(l.intensity, 0.05);
      }
      list.sort((a, b) => a._key - b._key);
    }
    const n = Math.min(list.length, this.capacity);
    const posArr = shared.uLightPos.value;
    const colArr = shared.uLightColor.value;
    for (let i = 0; i < n; i += 1) {
      const l = list[i];
      posArr[i].set(l.x, l.y, l.z, l.radius);
      if (typeof l.color === 'string') colArr[i].set(l.color).multiplyScalar(l.intensity);
      else colArr[i].copy(l.color).multiplyScalar(l.intensity);
    }
    for (let i = n; i < this.capacity; i += 1) {
      posArr[i].set(0, -9999, 0, 0);
      colArr[i].setRGB(0, 0, 0);
    }
    shared.uLightCount.value = n;
    list.length = 0;
    return n;
  }
}

export const lights = new LightBudget(WORLD.maxDynamicLights);

/** Call once per frame, before rendering. */
export function updateShared(time, camera, bufferSize) {
  shared.uTime.value = time;
  camera.getWorldPosition(shared.uCameraPos.value);
  if (bufferSize) shared.uResolution.value.copy(bufferSize);
  lights.flush(shared.uCameraPos.value);
}

/** Retro knobs, exposed so the options menu can move them live. */
export function setRetro({ affine, jitter } = {}) {
  if (affine !== undefined) shared.uAffine.value = affine;
  if (jitter !== undefined) shared.uVertexJitter.value = jitter;
}
