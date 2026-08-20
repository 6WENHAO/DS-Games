// Sky dome + raymarched volumetric clouds, rendered offscreen at reduced resolution.
//
// The cloud shape comes from the same 2D fbm field that bakes the ground shadows, given
// volume by a vertical profile, altitude shear and 3D erosion — so the shadow patches on
// the meadow really do belong to the clouds you can see overhead.

import * as THREE from 'three';
import { GLSL_NOISE } from './noise.js';
import { U, pick, GLSL_CLOUD_FIELD, GLSL_LIGHT, GLSL_SKY } from './uniforms.js';
import { blit, fsMaterial, makeRT } from './fsq.js';

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform mat4 uInvVP;
  uniform vec3 uCamPos;
  uniform float uTime;
  uniform vec2 uWindDir;
  uniform float uStars;
  uniform float uRain;

  ${GLSL_NOISE}
  ${GLSL_LIGHT}
  ${GLSL_SKY}
  ${GLSL_CLOUD_FIELD}

  #ifndef STEPS
  #define STEPS 48
  #endif
  #ifndef LSTEPS
  #define LSTEPS 5
  #endif

  vec3 rayDir(vec2 uv){
    vec4 far = uInvVP * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
    return normalize(far.xyz / far.w - uCamPos);
  }

  float starField(vec3 rd){
    if (uStars <= 0.001) return 0.0;
    vec2 sph = vec2(atan(rd.z, rd.x), asin(clamp(rd.y, -1.0, 1.0))) * 190.0;
    vec2 i = floor(sph), f = fract(sph);
    vec4 r = nvalRaw(i);
    if (r.r < 0.955) return 0.0;
    float d = length(f - vec2(r.g, r.b));
    float tw = 0.55 + 0.45 * sin(uTime * 2.1 + r.g * 71.0);
    return smoothstep(0.36, 0.0, d) * tw * smoothstep(0.0, 0.25, rd.y);
  }

  float heightNorm(vec3 p){ return (p.y - uCloudBase) / uCloudThick; }

  float profileOf(float hN){
    return smoothstep(0.0, 0.17, hN) * (1.0 - smoothstep(0.55, 1.0, hN));
  }

  // altitude shear: gives the flat field a believable 3D lean
  vec2 shear(vec3 p, float hN){ return p.xz + uWindDir * (hN * 130.0); }

  // full density: coverage eroded by billow detail
  float cloudDensityFrom(vec3 p, float hN, float cov){
    float prof = profileOf(hN);
    float det = fbm3(shear(p, hN) * uCloudFreq * 7.5 + vec2(hN * 4.3) + uCloudWind * 3.1);
    return clamp((cov * prof - det * 0.26) / 0.74, 0.0, 1.0) * uCloudDensity;
  }

  // cheap density for the light march: coverage only, no erosion
  float cloudDensityCheap(vec3 p){
    float hN = heightNorm(p);
    if (hN < 0.0 || hN > 1.0) return 0.0;
    float prof = profileOf(hN);
    if (prof < 0.004) return 0.0;
    return cloudCover(shear(p, hN)) * prof * 0.82 * uCloudDensity;
  }

  float lightMarch(vec3 p){
    float tau = 0.0;
    float ls = 18.0;
    vec3 q = p;
    for (int i = 0; i < LSTEPS; i++){
      q += uSunDir * ls;
      tau += cloudDensityCheap(q) * ls;
      ls *= 1.9;
    }
    return exp(-tau * 0.030 * uCloudAbsorb);
  }

  void main(){
    vec3 rd = rayDir(vUv);
    vec3 sky = skyGradient(rd);

    float mu = clamp(dot(rd, uSunDir), -1.0, 1.0);

    // stars + moon/sun disc
    sky += vec3(0.9, 0.94, 1.0) * starField(rd) * uStars * 1.6;
    float disc = smoothstep(0.99955, 0.99982, mu);
    float mottle = mix(1.0, 0.72 + 0.5 * vnoise(rd.xz * 420.0), uStars);
    sky += uSunColor * disc * mottle * (2.6 + 6.0 * (1.0 - uStars)) * step(0.0, uSunDir.y + 0.06);

    // ---- volumetric clouds
    vec4 acc = vec4(0.0);
    float trans = 1.0;
    if (rd.y > 0.006 && uCloudDensity > 0.001) {
      float t0 = (uCloudBase - uCamPos.y) / rd.y;
      float t1 = (uCloudBase + uCloudThick - uCamPos.y) / rd.y;
      float tStart = max(min(t0, t1), 0.0);
      float tEnd = min(max(t0, t1), 26000.0);
      if (tEnd > tStart) {
        float span = tEnd - tStart;
        float stepLen = span / float(STEPS);
        float jitter = nvalRaw(gl_FragCoord.xy * 1.37).b;
        float t = tStart + stepLen * jitter;

        float phase = mix(hg(mu, 0.74), hg(mu, -0.22), 0.36) * 12.0 + 0.28;
        vec3 ambTop = mix(uAmbSky, uSkyTop, 0.35) * 1.15;
        vec3 ambBot = mix(uAmbSky * 0.55, uSkyHaze * 0.5, 0.5);

        for (int i = 0; i < STEPS; i++){
          if (trans < 0.02) break;
          vec3 p = uCamPos + rd * t;
          float hNorm = heightNorm(p);
          // empty-space skipping: one cheap coverage tap decides if this step is worth it
          float cov = (hNorm < 0.0 || hNorm > 1.0) ? 0.0 : cloudCover(shear(p, hNorm));
          if (cov < 0.012) { t += stepLen * 1.85; continue; }
          float dens = cloudDensityFrom(p, hNorm, cov);
          if (dens > 0.004) {
            float hN = clamp(hNorm, 0.0, 1.0);
            float lt = lightMarch(p);
            float powder = 1.0 - exp(-dens * 5.0);
            vec3 lum = uSunColor * uSunIntensity * (lt * phase * (0.35 + 0.75 * powder)) * 1.35
                     + mix(ambBot, ambTop, hN) * (0.55 + 0.45 * powder);
            // rain clouds are heavy and grey underneath
            lum *= mix(1.0, mix(0.45, 0.95, hN), uRain);
            float a = 1.0 - exp(-dens * stepLen * 0.115 * uCloudAbsorb);
            // aerial perspective: distant deck thins out *and* sinks into the haze, so a
            // grazing view of the cloud layer does not turn the whole sky milky white
            float fade = 1.0 - exp(-t * 0.00019);
            a *= 1.0 - 0.85 * fade;
            lum = mix(lum, uSkyHaze * (0.9 + 0.5 * uSunIntensity * 0.2), fade * 0.85);
            acc.rgb += lum * a * trans;
            trans *= 1.0 - a;
          }
          t += stepLen;
        }
      }
    }

    // horizon: clouds cannot cover the ground half of the dome
    float horizon = smoothstep(-0.02, 0.10, rd.y);
    float cloudA = (1.0 - trans) * horizon;
    vec3 col = sky * (1.0 - cloudA) + acc.rgb * horizon;

    gl_FragColor = vec4(col, trans);
  }
`;

export class Sky {
  constructor(steps = 48, lsteps = 5, scale = 0.6) {
    this.scale = scale;
    this.rt = makeRT(2, 2, { type: THREE.HalfFloatType });
    this.material = fsMaterial(FRAG, pick('noise', 'light', 'sky', 'cloudField', 'time', {
      uInvVP: { value: new THREE.Matrix4() },
      uCamPos: U.uCamPos,
      uWindDir: U.uWindDir,
      uRain: U.uRain,
    }), { STEPS: steps, LSTEPS: lsteps });
    this.steps = steps;
    this.lsteps = lsteps;
  }

  setSize(w, h) {
    const sw = Math.max(2, Math.floor(w * this.scale));
    const sh = Math.max(2, Math.floor(h * this.scale));
    if (this.rt.width !== sw || this.rt.height !== sh) this.rt.setSize(sw, sh);
  }

  setSteps(steps, lsteps, scale) {
    let dirty = false;
    if (steps !== this.steps) { this.material.defines.STEPS = steps; this.steps = steps; dirty = true; }
    if (lsteps !== this.lsteps) { this.material.defines.LSTEPS = lsteps; this.lsteps = lsteps; dirty = true; }
    if (dirty) this.material.needsUpdate = true;
    if (scale !== undefined) this.scale = scale;
  }

  render(renderer, camera) {
    const invVP = this.material.uniforms.uInvVP.value;
    invVP.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
    blit(renderer, this.material, this.rt, true);
    return this.rt.texture;
  }

  dispose() {
    this.rt.dispose();
    this.material.dispose();
  }
}
