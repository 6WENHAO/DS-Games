import { SKY_COMMON } from './skyCommon.glsl.js';

/**
 * ocean.glsl.js — Gerstner-wave ocean with a tsunami term.
 *
 * WHY GERSTNER AND NOT A HEIGHTMAP SINE STACK
 * -------------------------------------------
 * A sum of sines only moves vertices up and down, so crests stay round and the
 * water reads like rubber. Gerstner waves also displace HORIZONTALLY, toward the
 * crest, which sharpens peaks and flattens troughs — the trochoidal shape real
 * water has. Steepness Q controls that pinch; Q·A·k > 1 is where the surface
 * self-intersects, so the CPU side clamps it.
 *
 * The analytic tangent/binormal accumulation gives an exact normal for free, so
 * there is no normal map and no derivative popping when the camera pushes in
 * from 3000 m to 10 m.
 *
 * The tsunami is deliberately NOT another Gerstner wave. A 90 m wall of water is
 * a soliton: a single, non-periodic, steep-fronted crest that translates without
 * changing shape. It is modelled as a travelling sech²-style profile with an
 * asymmetric front, plus a foam band pinned to the leading edge.
 */

export const OCEAN_UNIFORM_DECL = /* glsl */`
  #define WAVE_COUNT 6
  uniform vec4 uWaveA[WAVE_COUNT];   // xy = dir, z = amplitude, w = wavelength
  uniform vec2 uWaveB[WAVE_COUNT];   // x = steepness Q, y = phase speed
  uniform float uTime;

  // Tsunami: x = front position along X, y = height, z = width, w = enabled
  uniform vec4 uTsunami;
`;

/** Shared displacement routine — also mirrored in JS (Ocean.js #sampleHeight). */
export const OCEAN_DISPLACE = /* glsl */`
  struct DshSurface {
    vec3 position;
    vec3 normal;
    float crest;     // 0..1 how sharp this point is (drives foam)
    float tsunami;   // 0..1 tsunami influence at this point
  };

  DshSurface dshOceanSurface(vec2 xz) {
    vec3 p = vec3(xz.x, 0.0, xz.y);
    vec3 tangent  = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);
    float steepSum = 0.0;

    for (int i = 0; i < WAVE_COUNT; i++) {
      vec2 dir = normalize(uWaveA[i].xy);
      float amp = uWaveA[i].z;
      float wavelength = uWaveA[i].w;
      float Q = uWaveB[i].x;
      float speed = uWaveB[i].y;

      float k = 6.28318530718 / wavelength;
      float f = k * (dot(dir, xz) - speed * uTime);
      float a = amp;
      float s = sin(f), c = cos(f);

      // Trochoidal displacement: horizontal pinch toward the crest.
      p.x += Q * a * dir.x * c;
      p.z += Q * a * dir.y * c;
      p.y += a * s;

      // Analytic derivatives of the above.
      float wa = k * a;
      tangent  += vec3(-Q * dir.x * dir.x * wa * s,  dir.x * wa * c, -Q * dir.x * dir.y * wa * s);
      binormal += vec3(-Q * dir.x * dir.y * wa * s,  dir.y * wa * c, -Q * dir.y * dir.y * wa * s);

      steepSum += Q * wa * max(s, 0.0);
    }

    // ---- tsunami soliton -------------------------------------------------
    float tsu = 0.0;
    if (uTsunami.w > 0.5) {
      float d = (xz.x - uTsunami.x) / uTsunami.z;
      // Asymmetric profile: steep leading face (d>0), long trailing swell (d<0).
      float shaped = d > 0.0 ? d * 2.35 : d * 0.55;
      float env = exp(-shaped * shaped);
      tsu = env;
      float h = uTsunami.y * env;
      p.y += h;
      // Water is drawn INTO the wave: suck the surface backward ahead of it and
      // heap it up behind, which is what gives a soliton its curl.
      p.x += uTsunami.y * 0.34 * env * (d > 0.0 ? 1.0 : -0.25);
      // Slope of the wall feeds the normal so the face catches the sun.
      float dEnv = -2.0 * shaped * env * (d > 0.0 ? 2.35 : 0.55) / uTsunami.z;
      tangent += vec3(0.0, uTsunami.y * dEnv, 0.0);
      steepSum += env * 2.4;
    }

    DshSurface s;
    s.position = p;
    s.normal = normalize(cross(binormal, tangent));
    s.crest = clamp(steepSum, 0.0, 1.0);
    s.tsunami = tsu;
    return s;
  }
`;

export const OCEAN_VERTEX = /* glsl */`
  ${OCEAN_UNIFORM_DECL}
  ${OCEAN_DISPLACE}

  uniform vec3 uCameraPos;
  uniform float uMorphNear;   // radial LOD blend distances
  uniform float uMorphFar;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vCrest;
  varying float vTsunami;
  varying float vDist;

  void main() {
    // The mesh is a static grid in local space; it is snapped to the camera in
    // JS, so the vertex attribute is already a world-space XZ coordinate after
    // the mesh translation. Sampling in world space keeps waves from sliding
    // with it.
    vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;

    DshSurface s = dshOceanSurface(wp.xz);

    // Distance-based amplitude damping: at 3 km the grid is coarser than the
    // wavelength, so full-amplitude waves alias into noise. Fading them out
    // preserves the horizon line instead of shimmering.
    float d = length(wp.xz - uCameraPos.xz);
    float damp = 1.0 - smoothstep(uMorphNear, uMorphFar, d) * 0.72;
    vec3 displaced = mix(vec3(wp.x, 0.0, wp.z), s.position, damp);

    vWorld = displaced;
    vNormal = normalize(mix(vec3(0.0, 1.0, 0.0), s.normal, damp));
    vCrest = s.crest * damp;
    vTsunami = s.tsunami;
    vDist = d;

    gl_Position = projectionMatrix * viewMatrix * vec4(displaced, 1.0);
  }
`;

export const OCEAN_FRAGMENT = /* glsl */`
  ${SKY_COMMON}

  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;
  uniform float uTurbidity;
  uniform float uStorm;
  uniform float uNight;
  uniform float uTime;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vCrest;
  varying float vTsunami;
  varying float vDist;

  // Cheap value noise for foam breakup.
  float dshHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float dshNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(dshHash(i), dshHash(i + vec2(1, 0)), f.x),
               mix(dshHash(i + vec2(0, 1)), dshHash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorld);
    if (dot(N, V) < 0.0) N = -N;      // keep normals facing the eye at grazing angles

    // ---- Fresnel (Schlick, F0 = 0.02 for water) ----
    float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);

    // ---- reflection: the SAME atmosphere the dome draws ----
    vec3 R = reflect(-V, N);
    R.y = abs(R.y) * 0.55 + 0.02;      // bias up: no sampling below the horizon
    vec3 reflected = dshSkyColor(normalize(R), uSunDir, uTurbidity, uStorm, uNight);
    reflected += dshSunDisc(normalize(R), uSunDir, uStorm, uNight) * 0.45;

    // ---- refracted body colour: depth + a fake subsurface upwelling ----
    float upwell = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 1.6);
    vec3 body = mix(uDeepColor, uShallowColor, upwell * 0.75 + vCrest * 0.25);
    // Sun transmission through the wave back — the green glow in a lit swell.
    float trans = pow(max(dot(V, -normalize(vec3(uSunDir.x, -uSunDir.y, uSunDir.z))), 0.0), 4.0);
    body += vec3(0.06, 0.22, 0.17) * trans * max(uSunDir.y, 0.0) * (0.4 + vTsunami);

    // ---- specular sun glitter ----
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 620.0) * 3.4
               + pow(max(dot(N, H), 0.0), 60.0) * 0.16;
    spec *= (1.0 - uStorm * 0.7) * (1.0 - uNight * 0.8);

    vec3 col = mix(body, reflected, fres);
    col += vec3(1.0, 0.92, 0.78) * spec;

    // ---- foam: crest-driven, plus a hard band on the tsunami's leading face ----
    float n = dshNoise(vWorld.xz * 0.055 + uTime * 0.22)
            * dshNoise(vWorld.xz * 0.21 - uTime * 0.13);
    float crestFoam = smoothstep(0.42, 0.92, vCrest + n * 0.35);
    float wallFoam = smoothstep(0.35, 0.95, vTsunami) * smoothstep(0.25, 0.7, n + 0.35);
    float foam = clamp(crestFoam * 0.75 + wallFoam, 0.0, 1.0);
    col = mix(col, uFoamColor * (0.72 + 0.5 * max(uSunDir.y, 0.05)), foam * 0.85);

    // ---- distance fade into the atmosphere (aerial perspective) ----
    // Sample the sky along the OUTGOING view direction (-V), just above the
    // horizon, so distant water dissolves into the same band the dome draws.
    vec3 horizonDir = normalize(vec3(-V.x, 0.035, -V.z));
    vec3 horizonCol = dshSkyColor(horizonDir, uSunDir, uTurbidity, uStorm, uNight);
    float fog = 1.0 - exp(-vDist * 0.00019);
    col = mix(col, horizonCol, fog * 0.92);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
