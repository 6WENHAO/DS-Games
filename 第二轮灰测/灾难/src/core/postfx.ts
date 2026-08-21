/**
 * postfx.ts — post-processing shader definitions for the miniature voxel city scene.
 *
 * Contains two plain-GLSL (ES 1.00 style, like three's own example shaders) passes:
 *  - TiltShiftShader: separable 13-tap gaussian whose radius grows with distance
 *    from a horizontal focus band, producing the classic "tabletop miniature" look.
 *    Run it twice in a row (horizontal then vertical) with two ShaderPass instances.
 *  - GradeShader: final look pass — exposure, saturation, contrast, vignette and an
 *    additive full-screen flash (for explosions / lightning / camera pops).
 *
 * Both are shaped for `new ShaderPass(Shader)` from
 * `three/examples/jsm/postprocessing/ShaderPass.js`.
 */

import * as THREE from 'three';

/** Shared fullscreen-quad vertex shader. */
const fullscreenVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

/**
 * Separable (single-direction) tilt-shift blur.
 *
 * The blur radius is 0 inside the sharp band around `uFocusCenter` and ramps up
 * outside it, so foreground and background rows get progressively softer.
 */
export const TiltShiftShader: {
  name: string;
  uniforms: {
    tDiffuse: { value: THREE.Texture | null };
    uResolution: { value: THREE.Vector2 };
    uDirection: { value: THREE.Vector2 };
    uStrength: { value: number };
    uFocusCenter: { value: number };
    uFocusRange: { value: number };
    uFocusFeather: { value: number };
  };
  vertexShader: string;
  fragmentShader: string;
} = {
  name: 'TiltShiftShader',

  uniforms: {
    tDiffuse: { value: null },
    // Render target size in pixels; used to convert a pixel radius into UV steps.
    uResolution: { value: new THREE.Vector2(1, 1) },
    // (1,0) for the horizontal pass, (0,1) for the vertical pass.
    uDirection: { value: new THREE.Vector2(1, 0) },
    // Max blur radius in pixels (0 disables the effect).
    uStrength: { value: 0 },
    // Band centre in screen V coords (0..1).
    uFocusCenter: { value: 0.5 },
    // Half-height of the fully sharp band, in V units.
    uFocusRange: { value: 0.3 },
    // How quickly blur ramps up outside the band.
    uFocusFeather: { value: 0.34 },
  },

  vertexShader: fullscreenVertexShader,

  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform vec2 uDirection;
uniform float uStrength;
uniform float uFocusCenter;
uniform float uFocusRange;
uniform float uFocusFeather;

varying vec2 vUv;

// 13-tap gaussian (sigma = 3.0), normalised: W0 + 2 * (W1 + ... + W6) == 1.0
const float W0 = 0.136966;
const float W1 = 0.129646;
const float W2 = 0.109720;
const float W3 = 0.083108;
const float W4 = 0.056332;
const float W5 = 0.034167;
const float W6 = 0.018544;

void main() {
  vec4 centerSample = texture2D( tDiffuse, vUv );

  // Distance from the sharp band, remapped through the feather ramp.
  float d = abs( vUv.y - uFocusCenter );
  float m = smoothstep( uFocusRange, uFocusRange + max( uFocusFeather, 1e-4 ), d );
  float radius = uStrength * m;

  // Cheap early-out: sub-pixel radius is visually identical to the centre tap.
  if ( radius < 0.05 ) {
    gl_FragColor = vec4( centerSample.rgb, 1.0 );
    return;
  }

  // One texel step scaled to the requested pixel radius, along the pass direction.
  vec2 step1 = ( uDirection / uResolution ) * radius;

  vec3 sum = centerSample.rgb * W0;

  sum += texture2D( tDiffuse, vUv + step1 * 1.0 ).rgb * W1;
  sum += texture2D( tDiffuse, vUv - step1 * 1.0 ).rgb * W1;
  sum += texture2D( tDiffuse, vUv + step1 * 2.0 ).rgb * W2;
  sum += texture2D( tDiffuse, vUv - step1 * 2.0 ).rgb * W2;
  sum += texture2D( tDiffuse, vUv + step1 * 3.0 ).rgb * W3;
  sum += texture2D( tDiffuse, vUv - step1 * 3.0 ).rgb * W3;
  sum += texture2D( tDiffuse, vUv + step1 * 4.0 ).rgb * W4;
  sum += texture2D( tDiffuse, vUv - step1 * 4.0 ).rgb * W4;
  sum += texture2D( tDiffuse, vUv + step1 * 5.0 ).rgb * W5;
  sum += texture2D( tDiffuse, vUv - step1 * 5.0 ).rgb * W5;
  sum += texture2D( tDiffuse, vUv + step1 * 6.0 ).rgb * W6;
  sum += texture2D( tDiffuse, vUv - step1 * 6.0 ).rgb * W6;

  gl_FragColor = vec4( sum, 1.0 );
}
`,
};

/**
 * Final look pass: exposure, saturation, contrast/lift, vignette and a
 * full-screen additive flash. Output is clamped to [0, 8] so downstream
 * tonemapping (or none at all) still behaves.
 */
export const GradeShader: {
  name: string;
  uniforms: {
    tDiffuse: { value: THREE.Texture | null };
    uExposure: { value: number };
    uSaturation: { value: number };
    uContrast: { value: number };
    uVignette: { value: number };
    uFlashColor: { value: THREE.Color };
    uFlashAmount: { value: number };
    uTint: { value: THREE.Color };
  };
  vertexShader: string;
  fragmentShader: string;
} = {
  name: 'GradeShader',

  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.0 },
    uSaturation: { value: 1.15 },
    uContrast: { value: 1.05 },
    // 0..1 vignette strength.
    uVignette: { value: 0.35 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    // 0..1 additive screen flash.
    uFlashAmount: { value: 0 },
    // Multiplicative colour tint; white = neutral.
    uTint: { value: new THREE.Color(1, 1, 1) },
  },

  vertexShader: fullscreenVertexShader,

  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uExposure;
uniform float uSaturation;
uniform float uContrast;
uniform float uVignette;
uniform vec3 uFlashColor;
uniform float uFlashAmount;
uniform vec3 uTint;

varying vec2 vUv;

void main() {
  // Exposure + tint.
  vec3 c = texture2D( tDiffuse, vUv ).rgb * uExposure * uTint;

  // Saturation around perceptual luminance.
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = mix( vec3( l ), c, uSaturation );

  // Contrast / lift around mid grey.
  c = ( c - 0.5 ) * uContrast + 0.5;

  // Radial vignette, blended by strength.
  float v = smoothstep( 0.98, 0.28, length( vUv - 0.5 ) );
  c *= mix( 1.0, v, uVignette );

  // Additive screen flash (explosions, lightning, hits).
  c += uFlashColor * uFlashAmount;

  gl_FragColor = vec4( clamp( c, 0.0, 8.0 ), 1.0 );
}
`,
};

/** Uniform block type shared by both tilt-shift passes. */
export type TiltShiftUniforms = (typeof TiltShiftShader)['uniforms'];

/**
 * Small controller that keeps the horizontal and vertical tilt-shift passes in
 * sync from a single 0..1 user slider.
 *
 * Usage:
 *   const h = new ShaderPass( TiltShiftShader );
 *   const v = new ShaderPass( TiltShiftShader );
 *   const ctrl = new TiltShiftController( h.uniforms as TiltShiftUniforms, v.uniforms as TiltShiftUniforms );
 *   ctrl.setResolution( width, height );
 *   ctrl.setAmount( 0.6 );
 */
export class TiltShiftController {
  private readonly horizontal: TiltShiftUniforms;
  private readonly vertical: TiltShiftUniforms;
  private _amount = 0;

  constructor(horizontalUniforms: TiltShiftUniforms, verticalUniforms: TiltShiftUniforms) {
    this.horizontal = horizontalUniforms;
    this.vertical = verticalUniforms;

    // Fix the separable pass directions once.
    this.horizontal.uDirection.value.set(1, 0);
    this.vertical.uDirection.value.set(0, 1);

    this.setAmount(this._amount);
  }

  /** 0..1 user slider -> internal blur strength; keeps both passes in sync. */
  setAmount(amount01: number): void {
    const a = Math.min(1, Math.max(0, amount01));
    this._amount = a;

    // Quadratic ramp feels more natural on a linear slider.
    const strength = a * a * 9.0;
    // Narrow the sharp band (and tighten the ramp) as the effect grows.
    const range = 0.3 - 0.13 * a;
    const feather = 0.34 - 0.12 * a;

    this.horizontal.uStrength.value = strength;
    this.horizontal.uFocusRange.value = range;
    this.horizontal.uFocusFeather.value = feather;
    this.horizontal.uDirection.value.set(1, 0);

    this.vertical.uStrength.value = strength;
    this.vertical.uFocusRange.value = range;
    this.vertical.uFocusFeather.value = feather;
    this.vertical.uDirection.value.set(0, 1);
  }

  /** Write the render target size (in pixels) into both uniform sets. */
  setResolution(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.horizontal.uResolution.value.set(w, h);
    this.vertical.uResolution.value.set(w, h);
  }

  /** Last value passed to setAmount, clamped to 0..1. */
  get amount(): number {
    return this._amount;
  }
}
