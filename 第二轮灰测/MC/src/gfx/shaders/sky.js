/**
 * gfx/shaders/sky.js
 * ------------------------------------------------------------------
 * Everything above the horizon: the sky gradient (drawn as a single
 * full-screen triangle with reconstructed view rays), the star field,
 * the sun/moon billboards and the scrolling cloud deck.
 */

import { GLSL_NOISE } from './common.js';

/* ------------------------------------------------------------------ */
/* sky dome gradient                                                   */
/* ------------------------------------------------------------------ */

export const skyVertexShader = /* glsl */`
uniform mat4 uInvViewProj;
uniform vec3 uCameraPos;

out vec3 vRay;

void main() {
  // Full-screen triangle: (-1,-1) (3,-1) (-1,3)
  vec2 p = vec2(float((gl_VertexID & 1) * 4 - 1), float((gl_VertexID >> 1) * 4 - 1));
  vec4 far = uInvViewProj * vec4(p, 1.0, 1.0);
  vRay = far.xyz / far.w - uCameraPos;
  gl_Position = vec4(p, 1.0, 1.0);
}
`;

export const skyFragmentShader = /* glsl */`
uniform vec3  uZenithColor;
uniform vec3  uHorizonColor;
uniform vec3  uVoidColor;
uniform vec3  uSunDir;
uniform vec3  uSunGlowColor;
uniform float uSunGlowStrength;
uniform float uNight;      // 0 = day, 1 = night

${GLSL_NOISE}

in vec3 vRay;
out vec4 fragColor;

void main() {
  vec3 dir = normalize(vRay);
  float up = dir.y;

  // Above the horizon: zenith -> horizon gradient with a soft haze band.
  vec3 sky = mix(uHorizonColor, uZenithColor, pow(clamp(up, 0.0, 1.0), 0.55));
  // Below the horizon fades into the void colour, like the vanilla void sky.
  sky = mix(sky, uVoidColor, clamp(-up * 3.2, 0.0, 1.0));

  // Sun / sunset glow hugging the horizon in the sun's direction.
  float sunDot = max(dot(dir, uSunDir), 0.0);
  float glow = pow(sunDot, 6.0) * 0.55 + pow(sunDot, 48.0) * 0.9;
  float horizonBias = 1.0 - clamp(abs(up) * 2.4, 0.0, 1.0);
  sky += uSunGlowColor * (glow * uSunGlowStrength) * (0.45 + 0.55 * horizonBias);

  fragColor = vec4(sky, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/* stars                                                              */
/* ------------------------------------------------------------------ */

export const starVertexShader = /* glsl */`
layout(location = 0) in vec3 aDir;      // unit vector on the celestial sphere
layout(location = 1) in float aMag;     // 0..1 apparent magnitude

uniform mat4  uViewProj;
uniform vec3  uCameraPos;
uniform float uCelestialAngle;
uniform float uAlpha;
uniform float uPointScale;

out float vAlpha;

void main() {
  // Rotate the sphere about the X axis so stars track the sun/moon.
  float c = cos(uCelestialAngle);
  float s = sin(uCelestialAngle);
  vec3 d = vec3(aDir.x, aDir.y * c - aDir.z * s, aDir.y * s + aDir.z * c);
  vAlpha = uAlpha * (0.35 + 0.65 * aMag) * step(0.02, d.y);
  gl_Position = uViewProj * vec4(uCameraPos + d * 220.0, 1.0);
  gl_PointSize = uPointScale * (0.6 + aMag * 1.5);
}
`;

export const starFragmentShader = /* glsl */`
in float vAlpha;
out vec4 fragColor;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float falloff = 1.0 - smoothstep(0.02, 0.25, r);
  fragColor = vec4(vec3(1.0, 0.98, 0.95), vAlpha * falloff);
}
`;

/* ------------------------------------------------------------------ */
/* sun & moon                                                         */
/* ------------------------------------------------------------------ */

export const celestialVertexShader = /* glsl */`
layout(location = 0) in vec2 aCorner;   // -1..1 quad

uniform mat4  uViewProj;
uniform vec3  uCenter;                  // world-space centre
uniform vec3  uRight;
uniform vec3  uUp;
uniform float uSize;
uniform vec4  uUVRect;                  // xy = origin, zw = size

out vec2 vUV;

void main() {
  vUV = uUVRect.xy + (aCorner * 0.5 + 0.5) * uUVRect.zw;
  vec3 world = uCenter + (uRight * aCorner.x + uUp * aCorner.y) * uSize;
  gl_Position = uViewProj * vec4(world, 1.0);
}
`;

export const celestialFragmentShader = /* glsl */`
uniform sampler2D uTex;
uniform vec4 uColor;

in vec2 vUV;
out vec4 fragColor;

void main() {
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.02) discard;
  fragColor = vec4(t.rgb * uColor.rgb, t.a * uColor.a);
}
`;

/* ------------------------------------------------------------------ */
/* clouds                                                             */
/* ------------------------------------------------------------------ */

export const cloudVertexShader = /* glsl */`
layout(location = 0) in vec2 aCorner;   // 0..1 across the cloud deck

uniform mat4  uViewProj;
uniform vec3  uCameraPos;
uniform float uHeight;
uniform float uExtent;
uniform vec2  uScroll;
uniform float uScale;

out vec2  vUV;
out float vDist;

void main() {
  vec2 offset = (aCorner - 0.5) * uExtent;
  vec3 world = vec3(uCameraPos.x + offset.x, uHeight, uCameraPos.z + offset.y);
  vUV = (world.xz + uScroll) * uScale;
  vDist = length(offset);
  gl_Position = uViewProj * vec4(world, 1.0);
}
`;

export const cloudFragmentShader = /* glsl */`
uniform sampler2D uTex;
uniform vec3  uCloudColor;
uniform float uOpacity;
uniform vec3  uFogColor;
uniform float uFadeStart;
uniform float uFadeEnd;

in vec2  vUV;
in float vDist;
out vec4 fragColor;

void main() {
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.15) discard;
  float fade = 1.0 - clamp((vDist - uFadeStart) / max(uFadeEnd - uFadeStart, 1.0), 0.0, 1.0);
  if (fade <= 0.001) discard;
  vec3 col = mix(uFogColor, t.rgb * uCloudColor, fade);
  fragColor = vec4(col, t.a * uOpacity * fade);
}
`;
