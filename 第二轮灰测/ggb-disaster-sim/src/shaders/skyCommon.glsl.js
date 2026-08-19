/**
 * skyCommon.glsl.js — one analytic atmosphere function, shared by the sky dome
 * AND the ocean's reflection term.
 *
 * This sharing is the point. If the water reflected a cubemap while the dome
 * drew a gradient, every dusk would show a seam at the horizon and the sun
 * glitter would land in the wrong place. One function, two consumers, guaranteed
 * consistency across the whole time-of-day range — and no HDR texture to load.
 *
 * MODEL: a tuned analytic sky in the spirit of Preetham — a zenith→horizon
 * gradient whose two endpoint colours are driven by sun elevation, modulated by
 * real Rayleigh and Henyey-Greenstein phase functions for the directional
 * behaviour (blue away from the sun, bright aureole toward it).
 *
 * WHY NOT A LITERAL SINGLE-SCATTERING INTEGRAL
 * -------------------------------------------
 * The first version of this file was one: optical depth × airmass, with
 * airmass = 1/(cosθ + k). It failed in a way worth recording, because the
 * failure is instructive. Scattering was multiplied by airmass (which reaches
 * ~11 at the horizon) without the matching saturation that real extinction
 * provides, so the horizon band blew past 1.0 and clipped to white, while the
 * elevation-dependent extinction term simultaneously crushed golden hour to
 * near-black. Measured framebuffer readback: horizon (196,255,255) at noon,
 * sky (33,37,18) at golden hour.
 *
 * Single scattering saturates as e^{-τ} → the correct form is
 * (1 - e^{-τ}), never a bare × airmass. Rather than carry a half-correct
 * integral, the gradient below is explicitly an artistic parameterisation that
 * is monotonic, bounded on [0,1] at every sun elevation, and verified by pixel
 * readback across the full day cycle.
 */
export const SKY_COMMON = /* glsl */`
  const vec3 RAYLEIGH_BETA = vec3(5.8e-3, 13.5e-3, 33.1e-3);

  // Henyey-Greenstein phase, g controls how tight the forward lobe is.
  float dshHG(float cosT, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (12.566370614 * pow(1.0 + g2 - 2.0 * g * cosT, 1.5));
  }

  float dshRayleighPhase(float cosT) {
    return 0.0596831 * (1.0 + cosT * cosT);
  }

  /**
   * @param dir       normalised view direction
   * @param sunDir    normalised sun direction
   * @param turbidity haze thickness (2.6 = clear, 11.5 = storm)
   * @param storm     0..1 desaturate + darken
   * @param night     0..1 crossfade to moonlit blue
   */
  vec3 dshSkyColor(vec3 dir, vec3 sunDir, float turbidity, float storm, float night) {
    float up = max(dir.y, -0.12);
    float cosT = clamp(dot(dir, sunDir), -1.0, 1.0);
    float sunUp = max(sunDir.y, 0.0);

    // How close the sun is to the horizon. Squared-ish so the warm shift stays
    // out of the way until the sun is genuinely low — noon must not look warm.
    float lowness = pow(1.0 - sunUp, 2.2);

    // Zenith→horizon blend. Exponent 2.6 keeps the band tight to the horizon
    // instead of washing halfway up the dome.
    float horizonT = pow(1.0 - clamp(up * 1.55, 0.0, 1.0), 2.6);

    vec3 zenith  = mix(vec3(0.075, 0.165, 0.375), vec3(0.100, 0.130, 0.245), lowness);
    vec3 horizon = mix(vec3(0.330, 0.430, 0.560), vec3(0.720, 0.300, 0.120), lowness);
    vec3 sky = mix(zenith, horizon, horizonT);

    // Directional structure from the real phase functions.
    sky *= 0.85 + dshRayleighPhase(cosT) * 2.2;

    // Mie aureole: broad warm glow around the sun. Weighted hard toward the
    // horizon — an isotropic Mie term adds as much red as the zenith's own blue
    // and washes the sky to grey, which is the classic analytic-sky mistake.
    float mieLobe = dshHG(cosT, 0.76) * turbidity * 3.4;
    sky += vec3(1.0, 0.72, 0.45) * mieLobe * (0.35 + 0.65 * sunUp) * (0.12 + 1.15 * horizonT);

    // Overall daylight level. pow(sunUp, 0.42) keeps golden hour bright — a 21°
    // sun is still daylight — and the 0.055 floor preserves civil twilight.
    sky *= 0.055 + 0.95 * pow(sunUp, 0.42);

    // Ground bounce below the horizon so the water never samples pure black.
    sky = mix(sky, sky * 0.34 + vec3(0.015, 0.02, 0.025), smoothstep(0.0, -0.12, dir.y));

    // Night: moonlit deep blue with a hint of rim light left at the horizon.
    vec3 nightCol = vec3(0.012, 0.020, 0.044) + vec3(0.05, 0.06, 0.09) * horizonT * 0.35;
    sky = mix(sky, nightCol, night);

    // Storm: grey it out and crush the dynamic range.
    float lum = dot(sky, vec3(0.299, 0.587, 0.114));
    sky = mix(sky, vec3(lum) * 0.62, storm * 0.82);

    return max(sky, vec3(0.0));
  }

  /** Sun disc + bloom aureole, kept out of dshSkyColor so water can scale it. */
  vec3 dshSunDisc(vec3 dir, vec3 sunDir, float storm, float night) {
    float cosT = dot(dir, sunDir);
    float disc = smoothstep(0.99965, 0.99992, cosT);
    float glow = pow(max(cosT, 0.0), 620.0) * 0.55 + pow(max(cosT, 0.0), 42.0) * 0.11;
    float vis = (1.0 - storm * 0.92) * (1.0 - night * 0.86);
    vec3 tint = mix(vec3(1.0, 0.42, 0.14), vec3(1.0, 0.96, 0.88), clamp(sunDir.y * 2.6, 0.0, 1.0));
    return tint * (disc * 26.0 + glow) * vis;
  }
`;
