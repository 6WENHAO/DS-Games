import { SKY_COMMON } from './skyCommon.glsl.js';

/**
 * sky.glsl.js — the sky dome. Consumes the shared atmosphere function so the
 * ocean's reflections and the dome can never disagree, then adds the things
 * only the dome needs: the sun disc, stars, and storm cloud structure.
 */
export const SKY_VERTEX = /* glsl */`
  varying vec3 vDir;
  void main() {
    // Dome is drawn at a fixed huge radius with depth write off, so only the
    // direction matters.
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SKY_FRAGMENT = /* glsl */`
  ${SKY_COMMON}

  uniform vec3 uSunDir;
  uniform float uTurbidity;
  uniform float uStorm;
  uniform float uNight;
  uniform float uTime;

  varying vec3 vDir;

  float dshHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float dshNoise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dshHash(i + vec3(0,0,0)), dshHash(i + vec3(1,0,0)), f.x),
                   mix(dshHash(i + vec3(0,1,0)), dshHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(dshHash(i + vec3(0,0,1)), dshHash(i + vec3(1,0,1)), f.x),
                   mix(dshHash(i + vec3(0,1,1)), dshHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float dshFbm(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * dshNoise3(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  void main() {
    vec3 dir = normalize(vDir);
    vec3 col = dshSkyColor(dir, uSunDir, uTurbidity, uStorm, uNight);

    // ---- stars: only above the horizon, only at night, twinkling ----
    if (uNight > 0.01 && dir.y > 0.0) {
      vec3 sp = dir * 260.0;
      float star = dshHash(floor(sp));
      float bright = smoothstep(0.9975, 1.0, star);
      float twinkle = 0.65 + 0.35 * sin(uTime * 2.6 + star * 90.0);
      col += vec3(0.85, 0.9, 1.0) * bright * twinkle * uNight * (1.0 - uStorm) * 2.2;
    }

    // ---- clouds: thin cirrus in fair weather, heavy deck in a storm ----
    float cloudAmount = mix(0.16, 0.94, uStorm);
    if (dir.y > 0.005) {
      // Project onto a flat cloud plane so cells stretch correctly at the horizon.
      vec2 cp = dir.xz / max(dir.y, 0.02);
      float drift = uTime * mix(0.004, 0.021, uStorm);
      float f = dshFbm(vec3(cp * mix(0.055, 0.020, uStorm) + vec2(drift, drift * 0.4), uTime * 0.006));
      float mask = smoothstep(0.52 - cloudAmount * 0.30, 0.78, f);
      mask *= smoothstep(0.0, 0.16, dir.y);          // fade at the horizon

      // Light the cloud from the sun side; storm clouds are dark and flat.
      float lit = clamp(dot(normalize(vec3(cp.x, 1.0, cp.y)), uSunDir) * 0.5 + 0.5, 0.0, 1.0);
      vec3 cloudCol = mix(vec3(0.06, 0.07, 0.085), vec3(1.02, 0.98, 0.95), lit);
      cloudCol = mix(cloudCol, cloudCol * 0.30, uStorm);
      cloudCol *= mix(1.0, 0.14, uNight);
      col = mix(col, cloudCol, mask * mix(0.55, 0.97, uStorm));
    }

    col += dshSunDisc(dir, uSunDir, uStorm, uNight);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
