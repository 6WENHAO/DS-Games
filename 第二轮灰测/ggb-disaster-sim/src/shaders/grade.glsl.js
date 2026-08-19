/**
 * grade.glsl.js — the single final pass: motion blur, chromatic aberration,
 * vignette, grain and a filmic contrast/saturation trim.
 *
 * WHY ONE PASS AND NOT FOUR
 * -------------------------
 * Each of these is a couple of instructions but a full-screen pass costs a
 * complete read+write of the framebuffer. At 1440p with a 1.75 device ratio that
 * is ~35 MB of bandwidth per pass. Fusing four trivial effects into one pass
 * saves three round trips — the cheapest large win in the whole chain.
 *
 * MOTION BLUR APPROACH
 * --------------------
 * No velocity buffer, no reprojection: this is a temporal accumulation blur.
 * tPrev holds last frame's *output*, and uBlend is driven from actual camera
 * angular velocity + disaster trauma. That means it only smears when the camera
 * is genuinely whipping around or the ground is shaking, which is exactly when a
 * film camera would smear — and it costs one texture fetch.
 */
export const GradeShader = {
  name: 'DshGradeShader',
  uniforms: {
    tDiffuse:     { value: null },
    tPrev:        { value: null },
    uBlend:       { value: 0.0 },   // motion-blur strength 0..0.85
    uAberration:  { value: 0.0 },   // radial RGB split in uv units
    uVignette:    { value: 0.32 },
    uGrain:       { value: 0.035 },
    uTime:        { value: 0.0 },
    uContrast:    { value: 1.045 },
    uSaturation:  { value: 1.06 },
    uAspect:      { value: 1.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tPrev;
    uniform float uBlend;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uTime;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uAspect;

    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 centred = uv - 0.5;
      centred.x *= uAspect;
      float r = length(centred);

      // ---- chromatic aberration -------------------------------------------
      // Zero at the optical axis, growing with r² like a real lens.
      vec3 col;
      if (uAberration > 0.00001) {
        vec2 dir = (uv - 0.5);
        float k = uAberration * r * r;
        col.r = texture2D(tDiffuse, uv - dir * k).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv + dir * k).b;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }

      // ---- temporal motion blur -------------------------------------------
      if (uBlend > 0.001) {
        vec3 prev = texture2D(tPrev, uv).rgb;
        col = mix(col, prev, uBlend);
      }

      // ---- contrast + saturation ------------------------------------------
      col = (col - 0.5) * uContrast + 0.5;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum), col, uSaturation);

      // ---- vignette --------------------------------------------------------
      col *= 1.0 - uVignette * smoothstep(0.35, 1.05, r);

      // ---- grain (animated, luminance-weighted so blacks stay clean) -------
      float n = fract(sin(dot(uv * vec2(1.0, uAspect) + uTime * 0.61,
                              vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * uGrain * smoothstep(0.02, 0.5, lum);

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};
