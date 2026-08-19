/**
 * godrays.glsl.js — volumetric light shafts (Tyndall effect), the cheap-but-
 * convincing way: a radial blur of the scene's bright pass, anchored on the
 * sun's projected screen position.
 *
 * WHY NOT RAY-MARCHED VOLUMETRICS
 * ------------------------------
 * True volumetrics need a shadow-map march per pixel — 32+ taps of a 4k depth
 * texture, on top of a 900-body destruction sim. Radial occlusion blur gets
 * >90% of the look for one pass, and it degrades gracefully: when the sun goes
 * behind a tower leg, the tower is dark in the bright pass, so it carves a real
 * shadow shaft out of the rays for free. That self-occlusion is the effect.
 *
 * The pass also handles the sun being off-screen or behind the camera: rays are
 * faded by the angular term supplied from JS, so shafts never appear when the
 * light is at your back.
 */
export const GodRaysShader = {
  name: 'DshGodRaysShader',
  uniforms: {
    tDiffuse:   { value: null },
    uSunScreen: { value: null },   // THREE.Vector2, uv space
    uIntensity: { value: 0.8 },
    uDecay:     { value: 0.955 },  // per-sample attenuation
    uWeight:    { value: 0.42 },
    uDensity:   { value: 0.78 },   // how far along the ray each step travels
    uThreshold: { value: 0.72 },   // bright-pass cutoff
    uAspect:    { value: 1.0 },
    uTint:      { value: null },   // THREE.Color
    uVisible:   { value: 1.0 },    // 0 when the sun is behind the camera
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    #define SAMPLES 48

    uniform sampler2D tDiffuse;
    uniform vec2 uSunScreen;
    uniform float uIntensity;
    uniform float uDecay;
    uniform float uWeight;
    uniform float uDensity;
    uniform float uThreshold;
    uniform float uAspect;
    uniform vec3 uTint;
    uniform float uVisible;

    varying vec2 vUv;

    /** Keep only what is bright enough to be a light source. */
    vec3 brightPass(vec2 uv) {
      vec3 c = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float k = smoothstep(uThreshold, uThreshold + 0.45, l);
      return c * k;
    }

    void main() {
      vec3 scene = texture2D(tDiffuse, vUv).rgb;

      if (uVisible < 0.001) {
        gl_FragColor = vec4(scene, 1.0);
        return;
      }

      // March from this pixel toward the sun, accumulating occluded brightness.
      vec2 delta = (uSunScreen - vUv) * (uDensity / float(SAMPLES));
      vec2 uv = vUv;
      float illum = 1.0;
      vec3 rays = vec3(0.0);

      // Dither the start offset to break up banding on the long shafts.
      float jitter = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      uv += delta * jitter;

      for (int i = 0; i < SAMPLES; i++) {
        rays += brightPass(uv) * illum * uWeight;
        uv += delta;
        illum *= uDecay;
      }
      rays /= float(SAMPLES) * 0.55;

      // Radial falloff so the effect concentrates around the light, and an
      // aspect-corrected distance so it is round.
      vec2 d = vUv - uSunScreen;
      d.x *= uAspect;
      float falloff = exp(-length(d) * 1.35);

      vec3 col = scene + rays * uTint * uIntensity * falloff * uVisible;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
