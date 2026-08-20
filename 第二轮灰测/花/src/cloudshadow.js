// Bakes the cloud field into a small camera-relative shadow map.
//
// The volumetric dome and the ground shadows read the *same* 2D cloud field, so the
// patches of shade on the meadow always match the clouds drifting overhead. Baking it
// once per frame keeps the expensive fbm out of the terrain/grass/flower shaders.

import * as THREE from 'three';
import { U, pick, GLSL_CLOUD_FIELD } from './uniforms.js';
import { GLSL_NOISE, GLSL_TERRAIN } from './noise.js';
import { blit, fsMaterial, makeRT } from './fsq.js';

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform vec2 uShadowCenter;
  uniform float uShadowSize;
  uniform vec3 uSunDir;
  uniform vec2 uWindDir;

  ${GLSL_NOISE}
  ${GLSL_TERRAIN}
  ${GLSL_CLOUD_FIELD}

  // Same shape the volumetric dome marches through, evaluated at mid-altitude:
  // coverage eroded by the detail octaves, so the shade patches carry the same
  // silhouette as the clouds you can see overhead.
  float cloudSlabDensity(vec2 sp){
    const float hN = 0.35;
    vec2 q = sp + uWindDir * (hN * 130.0);
    float cov = cloudCover(q);
    if (cov < 0.004) return 0.0;
    float prof = smoothstep(0.0, 0.17, hN) * (1.0 - smoothstep(0.55, 1.0, hN));
    float det = fbm3(q * uCloudFreq * 7.5 + vec2(hN * 4.3) + uCloudWind * 3.1);
    return clamp((cov * prof - det * 0.26) / 0.74, 0.0, 1.0) * uCloudDensity;
  }

  // vertical optical depth through the deck -> transmittance to the ground
  float transAt(vec2 wxz){
    float y = terrainH(wxz);
    float sy = max(abs(uSunDir.y), 0.13);
    float t = (uCloudBase + uCloudThick * 0.35 - y) / sy;
    vec2 sp = wxz + uSunDir.xz * t;
    float dens = cloudSlabDensity(sp);
    return exp(-dens * uCloudThick * 0.030 * uCloudAbsorb);
  }

  void main(){
    vec2 wxz = (vUv - 0.5) * uShadowSize + uShadowCenter;
    // penumbra widens as the sun sinks (longer path through the deck)
    float soft = mix(14.0, 62.0, 1.0 - clamp(abs(uSunDir.y), 0.0, 1.0));
    float tr = transAt(wxz) * 0.36;
    tr += transAt(wxz + vec2( soft,  soft * 0.4)) * 0.16;
    tr += transAt(wxz + vec2(-soft, -soft * 0.4)) * 0.16;
    tr += transAt(wxz + vec2( soft * 0.3, -soft)) * 0.16;
    tr += transAt(wxz + vec2(-soft * 0.3,  soft)) * 0.16;
    float shade = mix(1.0, clamp(tr, 0.0, 1.0), uCloudShadow);
    gl_FragColor = vec4(shade, shade, shade, 1.0);
  }
`;

export class CloudShadow {
  constructor(res = 1024, size = 1800) {
    this.rt = makeRT(res, res, { type: THREE.UnsignedByteType });
    this.rt.texture.wrapS = this.rt.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.material = fsMaterial(FRAG, pick('terrain', 'cloudField', {
      uShadowCenter: U.uShadowCenter,
      uShadowSize: U.uShadowSize,
      uSunDir: U.uSunDir,
      uWindDir: U.uWindDir,
    }));
    U.uShadowMap.value = this.rt.texture;
    U.uShadowSize.value = size;
  }

  update(renderer, camPos) {
    // snap so the baked texels do not crawl while walking
    const step = U.uShadowSize.value / 64;
    U.uShadowCenter.value.set(
      Math.round(camPos.x / step) * step,
      Math.round(camPos.z / step) * step,
    );
    blit(renderer, this.material, this.rt, true);
  }

  dispose() {
    this.rt.dispose();
    this.material.dispose();
  }
}
