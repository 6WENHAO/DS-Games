/**
 * particles.glsl.js — analytically simulated GPU particles.
 *
 * THE DESIGN CHOICE THAT MAKES 60k PARTICLES FREE
 * -----------------------------------------------
 * There is no per-particle CPU work and no GPGPU ping-pong. Every particle's
 * entire life is a closed-form function of one number: age. The CPU writes an
 * instance's spawn state exactly once (origin, velocity, seed, spawn time) into
 * an InstancedBufferGeometry, and from then on the vertex shader evaluates
 *
 *     p(t) = origin + v₀·(1 - e^{-kt})/k + g·t²/2·drag_correction
 *
 * which is the exact solution of ballistic motion with linear drag. So:
 *   • zero CPU cost per frame, zero buffer updates after spawn,
 *   • one draw call per particle kind,
 *   • time is a uniform, so slow motion and PAUSE work perfectly — a paused
 *     explosion freezes mid-air and can be orbited and inspected, which is
 *     precisely what the snapshot-compare feature needs.
 *
 * The cost is that particles cannot collide. For fire, smoke, spray and sparks
 * that is invisible; the rigid debris that must collide is handled by Rapier in
 * BatchedRigidMesh instead. Right tool per phenomenon.
 *
 * KIND is injected as a #define so there is no branching in the fragment shader:
 *   0 = fire   1 = smoke   2 = splash   3 = spark/ember
 */

export const PARTICLE_VERTEX = /* glsl */`
  // instance attributes
  attribute vec3 iOrigin;
  attribute vec3 iVelocity;
  attribute vec4 iParams;   // x = spawnTime, y = life, z = size0, w = size1
  attribute vec4 iSeed;     // x = seed 0..1, y = drag k, z = spin, w = buoyancy

  uniform float uTime;
  uniform float uGravity;
  uniform vec3  uWind;
  uniform float uSizeScale;

  varying vec2 vUv;
  varying float vAge;       // 0..1 normalised lifetime
  varying float vSeed;

  void main() {
    float age = uTime - iParams.x;
    float life = iParams.y;
    vAge = clamp(age / life, 0.0, 1.0);
    vSeed = iSeed.x;
    vUv = uv;

    // Dead / unborn particles collapse to a degenerate point → no rasterisation.
    if (age < 0.0 || age > life) {
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      return;
    }

    // ---- closed-form ballistic motion with linear drag ----
    float k = max(iSeed.y, 0.0001);
    float decay = (1.0 - exp(-k * age)) / k;          // ∫e^{-kt}dt
    vec3 p = iOrigin + iVelocity * decay;

    // Gravity, corrected for the same drag, plus per-kind buoyancy (smoke rises).
    float gEff = uGravity * (1.0 - iSeed.w);
    p.y += 0.5 * gEff * decay * age;
    p += uWind * (age * age * 0.5) * iSeed.w;         // only buoyant stuff drifts

    // ---- billboard in view space, with per-particle roll ----
    float sizeT = vAge;
    float size = mix(iParams.z, iParams.w, sizeT) * uSizeScale;
    float roll = (iSeed.z * 6.2831853) + age * iSeed.z * 1.7;
    float cr = cos(roll), sr = sin(roll);
    vec2 corner = position.xy * size;
    corner = vec2(corner.x * cr - corner.y * sr, corner.x * sr + corner.y * cr);

    vec4 view = viewMatrix * vec4(p, 1.0);
    view.xy += corner;
    gl_Position = projectionMatrix * view;
  }
`;

export const PARTICLE_FRAGMENT = /* glsl */`
  uniform float uOpacity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uSunDir;

  varying vec2 vUv;
  varying float vAge;
  varying float vSeed;

  float dshHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float dshNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(dshHash(i), dshHash(i + vec2(1, 0)), f.x),
               mix(dshHash(i + vec2(0, 1)), dshHash(i + vec2(1, 1)), f.x), f.y);
  }
  float dshFbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * dshNoise(p); p *= 2.07; a *= 0.5; }
    return s;
  }

  void main() {
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    if (r > 1.0) discard;

  #if KIND == 0
    // ---------- FIRE: blackbody ramp, turbulent edge, additive ----------
    float turb = dshFbm(vUv * 3.4 + vec2(vSeed * 31.0, -vAge * 2.2));
    float mask = smoothstep(1.0, 0.18, r + (turb - 0.5) * 0.55);
    // Temperature falls with age: white-hot → yellow → orange → deep red.
    float temp = (1.0 - vAge) * mask;
    vec3 col = mix(vec3(0.55, 0.045, 0.0), vec3(1.0, 0.42, 0.06), smoothstep(0.05, 0.45, temp));
    col = mix(col, vec3(1.0, 0.86, 0.52), smoothstep(0.55, 0.9, temp));
    col = mix(col, vec3(1.0, 0.99, 0.93), smoothstep(0.88, 1.0, temp));
    float a = mask * (1.0 - vAge * vAge) * uOpacity;
    // ADDITIVE BUDGET — the number that matters most in this file.
    // Additive blending contributes colour × alpha PER PARTICLE, so the core of
    // a dense burst stacks 20-40 layers deep. Per-particle peak must therefore
    // be ~1/overlap, not ~1. Authoring fire at "looks bright on its own" values
    // made a meteor blast render 100% pure white for a full second (measured).
    // At ~0.1 peak the core lands around 2-3 in HDR: hot enough to drive bloom
    // and tone-map to a white-hot centre, while the edges keep real structure.
    gl_FragColor = vec4(col * (0.015 + temp * 0.10), a);

  #elif KIND == 1
    // ---------- SMOKE: soft, fbm-eroded, lit from the sun side ----------
    float turb = dshFbm(vUv * 2.6 + vec2(vSeed * 57.0, vAge * 0.9));
    float mask = smoothstep(1.0, 0.05, r + (turb - 0.5) * 0.75);
    // Fade in fast, out slowly — young smoke is dense, old smoke dissipates.
    float a = mask * smoothstep(0.0, 0.09, vAge) * (1.0 - smoothstep(0.45, 1.0, vAge));
    // Fake self-shadowing: the side facing the sun is brighter.
    float lit = clamp(dot(normalize(vec3(d, 0.6)), normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, lit * 0.85 + turb * 0.15);
    // Freshly born smoke still carries fire light.
    col += vec3(1.0, 0.35, 0.08) * (1.0 - smoothstep(0.0, 0.16, vAge)) * 0.8;
    gl_FragColor = vec4(col, a * uOpacity);

  #elif KIND == 2
    // ---------- SPLASH: droplet cluster, bright rim, translucent ----------
    float core = smoothstep(1.0, 0.35, r);
    float grain = dshNoise(vUv * 7.0 + vSeed * 19.0);
    float mask = core * (0.55 + 0.45 * grain);
    float a = mask * (1.0 - smoothstep(0.35, 1.0, vAge)) * uOpacity;
    // Rim brightens where the droplet catches the sun; centre stays sea-green.
    vec3 col = mix(uColorA, uColorB, smoothstep(0.25, 1.0, r));
    col += vec3(0.35) * pow(1.0 - r, 3.0);
    gl_FragColor = vec4(col, a);

  #else
    // ---------- SPARK / EMBER: tiny, hot, flickering, additive ----------
    float mask = smoothstep(1.0, 0.0, r);
    float flick = 0.55 + 0.45 * sin(vSeed * 90.0 + vAge * 55.0);
    vec3 col = mix(vec3(1.0, 0.32, 0.05), vec3(1.0, 0.92, 0.66), (1.0 - vAge) * flick);
    float a = mask * (1.0 - vAge) * flick * uOpacity;
    gl_FragColor = vec4(col * 0.55, a);
  #endif
  }
`;
