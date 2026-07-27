import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, Effect, BlendFunction,
  SMAAEffect, SMAAPreset,
} from 'postprocessing';

// ---------------------------------------------------------------------------
// One merged post pass.
//   - bloom via mipmap/Kawase downsample (~0.6 ms), NOT UnrealBloomPass (~2.5)
//   - the entire "Ghibli grade" as a few curve constants an art director owns
//   - paper grain: one static screen-space overlay that unifies everything
//   - DITHER IS MANDATORY. High-key low-contrast gradients band brutally in
//     8-bit; an ordered dither costs ~0.05 ms and is the difference between
//     "painting" and "cheap".
// ---------------------------------------------------------------------------

const GRADE_FRAG = /* glsl */`
  uniform float uTime;
  uniform float uGrain;
  uniform float uVignette;
  uniform vec3  uLift;
  uniform vec3  uGain;
  uniform float uSat;

  // 4x4 ordered dither, computed rather than tabled so it compiles under
  // both GLSL ES 1.00 and 3.00 without an array constructor
  float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;

    // lift shadows warm, gain highlights toward butter — the whole grade
    c = c * uGain + uLift * (1.0 - smoothstep(0.0, 0.55, c));

    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSat);

    // soft vignette, warm not black
    float d = distance(uv, vec2(0.5));
    c *= 1.0 - smoothstep(0.42, 0.95, d) * uVignette;

    // static paper grain at ~4% — hides banding and unifies the illustration
    float g = hash(floor(uv * vec2(1600.0, 900.0)));
    c += (g - 0.5) * uGrain;

    // ordered dither, last
    c += (bayer4(gl_FragCoord.xy) - 0.5) * (1.0 / 255.0) * 1.8;

    outputColor = vec4(c, inputColor.a);
  }
`;

class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', GRADE_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['uTime', new THREE.Uniform(0)],
        ['uGrain', new THREE.Uniform(0.040)],
        ['uVignette', new THREE.Uniform(0.28)],
        ['uLift', new THREE.Uniform(new THREE.Vector3(0.030, 0.022, 0.008))],
        ['uGain', new THREE.Uniform(new THREE.Vector3(1.02, 1.005, 0.975))],
        ['uSat', new THREE.Uniform(1.06)],
      ]),
    });
  }
}

export function createPost(renderer, scene, camera, quality) {
  // NOTE: MSAA on a half-float composer buffer renders black on some drivers
  // (reproduced here on Chrome/macOS). We keep the HDR buffer — bloom needs it
  // — and anti-alias with SMAA instead, which is also cheaper than 2x MSAA at
  // this resolution.
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: 0,
  });
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    intensity: 0.85,
    luminanceThreshold: 0.58,
    luminanceSmoothing: 0.35,
    mipmapBlur: true,
    radius: 0.72,
  });

  const grade = new GradeEffect();
  // SMAA MEDIUM costs ~1.5 ms at 2 MP on an M1; HIGH costs ~3 ms at 4 MP and
  // is not distinguishable through the grade. MEDIUM is the shipping default.
  const effects = [bloom];
  if (quality.aa) {
    effects.unshift(new SMAAEffect({
      preset: quality.aa === 2 ? SMAAPreset.HIGH : SMAAPreset.MEDIUM,
    }));
  }
  effects.push(grade);
  composer.addPass(new EffectPass(camera, ...effects));
  return { composer, bloom, grade };
}
