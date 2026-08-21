/**
 * gfx/shaders/common.js
 * ------------------------------------------------------------------
 * GLSL snippets shared by several programs: the Minecraft-style light
 * curve, face shading table, ambient occlusion levels and distance fog.
 */

/**
 * Minecraft's light attenuation: each level is ~80% of the one above it,
 * so level 15 is full brightness and level 0 is almost black.
 */
export const GLSL_LIGHT = /* glsl */`
const float LIGHT_FALLOFF = 0.8;

float lightCurve(float level) {
  return pow(LIGHT_FALLOFF, 15.0 - level);
}

/**
 * Combines sky light (modulated by the time of day) with warm block
 * light, exactly like the vanilla lightmap: whichever is brighter wins
 * per channel.
 */
vec3 lightmap(float skyLevel, float blockLevel, float daylight, vec3 skyTint, float ambient) {
  vec3 skyPart = lightCurve(skyLevel) * daylight * skyTint;
  vec3 blockPart = lightCurve(blockLevel) * vec3(1.0, 0.82, 0.58);
  return max(max(skyPart, blockPart), vec3(ambient));
}
`;

/**
 * Per-face brightness. Vanilla shades the six faces differently so cubes
 * read as 3D even under perfectly uniform light.
 * Order: 0=+X 1=-X 2=+Y 3=-Y 4=+Z 5=-Z
 */
export const GLSL_FACE_SHADE = /* glsl */`
const float FACE_SHADE[6] = float[6](0.60, 0.60, 1.00, 0.50, 0.80, 0.80);
const vec3 FACE_NORMAL[6] = vec3[6](
  vec3( 1.0, 0.0, 0.0), vec3(-1.0, 0.0, 0.0),
  vec3( 0.0, 1.0, 0.0), vec3( 0.0,-1.0, 0.0),
  vec3( 0.0, 0.0, 1.0), vec3( 0.0, 0.0,-1.0)
);
`;

/** Four ambient-occlusion steps baked per vertex by the mesher. */
export const GLSL_AO = /* glsl */`
const float AO_LEVEL[4] = float[4](0.52, 0.68, 0.84, 1.00);
`;

/**
 * Linear distance fog blended toward the sky colour, plus a stronger
 * exponential term used when the camera is submerged.
 */
export const GLSL_FOG = /* glsl */`
uniform vec3  uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uFogDensity;   // 0 = linear only, >0 = exponential (underwater)

float fogAmount(float dist) {
  float linearPart = clamp((dist - uFogStart) / max(uFogEnd - uFogStart, 0.001), 0.0, 1.0);
  if (uFogDensity > 0.0) {
    float expPart = 1.0 - exp(-dist * uFogDensity);
    return clamp(max(linearPart, expPart), 0.0, 1.0);
  }
  return linearPart;
}

vec3 applyFog(vec3 color, float dist) {
  return mix(color, uFogColor, fogAmount(dist));
}
`;

/** Cheap 2D hash + value noise, used for foliage sway and cloud detail. */
export const GLSL_NOISE = /* glsl */`
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

/**
 * Vertex-level sway for grass, flowers and leaves. Amplitude is tiny so
 * blocks still read as being on the voxel grid.
 */
export const GLSL_WAVE = /* glsl */`
vec3 foliageSway(vec3 worldPos, float time, float amount) {
  if (amount <= 0.0) return worldPos;
  float phase = worldPos.x * 0.7 + worldPos.z * 0.63 + worldPos.y * 0.15;
  float s = sin(time * 1.9 + phase) * 0.5 + sin(time * 3.1 + phase * 1.7) * 0.5;
  worldPos.x += s * 0.045 * amount;
  worldPos.z += cos(time * 1.6 + phase * 1.2) * 0.035 * amount;
  return worldPos;
}
`;
