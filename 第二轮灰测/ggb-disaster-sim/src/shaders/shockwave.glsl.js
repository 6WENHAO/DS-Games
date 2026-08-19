/**
 * shockwave.glsl.js — screen-space shockwave: refraction ring + heat haze.
 *
 * HOW THIS IS BUILT (and why it looks right)
 * -----------------------------------------
 * A blast front is a thin shell of compressed air with a steep refractive-index
 * gradient. Seen from a camera it does three things at once:
 *   1. bends light radially — a ring-shaped UV displacement, strongest AT the
 *      front and zero inside and outside it,
 *   2. splits colour — the bend is wavelength dependent, so R/G/B sample at
 *      slightly different radii (this is real dispersion, not a "cool filter"),
 *   3. shimmers behind the front — hot turbulent air, done as animated noise
 *      that only exists inside the swept volume.
 *
 * The ring is evaluated in ASPECT-CORRECTED screen space so the wave stays
 * circular on a 21:9 monitor, and up to three fronts are supported so a meteor
 * impact and a secondary detonation can overlap.
 */
export const ShockwaveShader = {
  name: 'DshShockwaveShader',
  uniforms: {
    tDiffuse:  { value: null },
    uAspect:   { value: 1.0 },
    uTime:     { value: 0.0 },
    // per-wave: xy = centre (uv space), z = radius (uv), w = amplitude
    uWaves:    { value: [] },
    // per-wave: x = thickness, y = chromatic spread, z = heat, w = unused
    uWaveMod:  { value: [] },
    uCount:    { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    #define MAX_WAVES 3

    uniform sampler2D tDiffuse;
    uniform float uAspect;
    uniform float uTime;
    uniform vec4 uWaves[MAX_WAVES];
    uniform vec4 uWaveMod[MAX_WAVES];
    uniform int uCount;

    varying vec2 vUv;

    float dshHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float dshNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(dshHash(i), dshHash(i + vec2(1, 0)), f.x),
                 mix(dshHash(i + vec2(0, 1)), dshHash(i + vec2(1, 1)), f.x), f.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 totalOffset = vec2(0.0);
      float chroma = 0.0;
      float heat = 0.0;
      float rim = 0.0;

      for (int i = 0; i < MAX_WAVES; i++) {
        if (i >= uCount) break;
        vec4 w = uWaves[i];
        vec4 m = uWaveMod[i];
        if (w.w <= 0.0001) continue;

        // Aspect-corrected radial coordinate: circles stay circles.
        vec2 d = vUv - w.xy;
        d.x *= uAspect;
        float r = length(d);
        vec2 dir = r > 1e-5 ? d / r : vec2(0.0);
        dir.x /= uAspect;

        // Ring profile: a signed lobe centred on the front. The derivative-like
        // shape (positive just inside, negative just outside) is what makes the
        // front read as a lens rather than a smear.
        float x = (r - w.z) / max(m.x, 1e-4);
        float lobe = x * exp(-x * x * 2.0) * 2.718;      // peak magnitude ~1
        float amp = w.w;

        totalOffset += dir * lobe * amp;
        chroma += abs(lobe) * m.y * amp;
        rim += exp(-x * x * 3.0) * amp;

        // Heat shimmer fills the volume already swept by the front.
        float inside = smoothstep(w.z, w.z * 0.35, r);
        heat += inside * m.z;
      }

      vec3 col;
      if (chroma > 0.0001) {
        // Dispersion: sample each channel at a slightly different displacement.
        vec2 o = totalOffset;
        col.r = texture2D(tDiffuse, uv + o * (1.0 + chroma)).r;
        col.g = texture2D(tDiffuse, uv + o).g;
        col.b = texture2D(tDiffuse, uv + o * (1.0 - chroma)).b;
      } else {
        col = texture2D(tDiffuse, uv + totalOffset).rgb;
      }

      if (heat > 0.001) {
        // Rising turbulent air: noise scrolls upward, distorts, and slightly
        // desaturates toward soot.
        vec2 hp = vUv * vec2(uAspect, 1.0) * 26.0;
        float n1 = dshNoise(hp + vec2(0.0, -uTime * 1.7));
        float n2 = dshNoise(hp * 2.1 + vec2(uTime * 0.6, -uTime * 2.4));
        vec2 hoff = (vec2(n1, n2) - 0.5) * 0.010 * heat;
        vec3 hot = texture2D(tDiffuse, uv + totalOffset + hoff).rgb;
        col = mix(col, hot, clamp(heat, 0.0, 1.0));
      }

      // A faint incandescent glint on the front itself.
      col += vec3(1.0, 0.72, 0.42) * rim * 0.11;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
