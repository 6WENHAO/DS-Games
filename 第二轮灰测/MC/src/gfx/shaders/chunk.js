/**
 * gfx/shaders/chunk.js
 * ------------------------------------------------------------------
 * The terrain shader. One program renders every solid, cutout and
 * translucent block face.
 *
 * Vertex layout (20 bytes, see world/mesher.js which writes it):
 *   offset  0 : aMeta  1 x uint32   packed layer/face/ao/light/flags
 *   offset  4 : aPos   3 x uint16   chunk-local position in 1/16 blocks
 *   offset 10 : aUV    2 x uint16   tile-space UV in 1/16 tile units
 *   offset 14 : aTint  4 x uint8n   biome tint (rgb) + sway amount (a)
 *
 * aMeta bit layout:
 *   [ 0..11] texture array layer          (4096 layers max)
 *   [12..14] face id 0=+X 1=-X 2=+Y 3=-Y 4=+Z 5=-Z
 *   [15..16] ambient occlusion level 0..3
 *   [17..20] sky light 0..15
 *   [21..24] block light 0..15
 *   [25..29] flags: 1=sway 2=flat-shade 4/8=anim group 16=liquid surface
 */

import { GLSL_LIGHT, GLSL_FACE_SHADE, GLSL_AO, GLSL_FOG, GLSL_WAVE } from './common.js';

export const CHUNK_VERTEX_STRIDE = 20;

/** Attribute locations are fixed so every chunk VAO shares one layout. */
export const CHUNK_ATTRIBS = {
  meta: 0,
  pos: 1,
  uv: 2,
  tint: 3,
};

export const chunkVertexShader = /* glsl */`
layout(location = 0) in uint aMeta;
layout(location = 1) in vec3 aPos;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aTint;

uniform mat4  uViewProj;
uniform vec3  uChunkOrigin;
uniform vec3  uCameraPos;
uniform float uTime;
uniform float uDaylight;
uniform vec3  uSkyLightColor;
uniform float uAmbient;
uniform vec4  uAnimFrames;   // [unused, group1, group2, group3]

${GLSL_LIGHT}
${GLSL_FACE_SHADE}
${GLSL_AO}
${GLSL_WAVE}

out vec3  vTexCoord;    // xy = tile uv, z = array layer
out vec3  vLight;       // final per-vertex light colour
out vec3  vTint;
out float vDist;
out float vFogDist;

void main() {
  uint layer   = aMeta & 0xFFFu;
  uint face    = (aMeta >> 12) & 0x7u;
  uint ao      = (aMeta >> 15) & 0x3u;
  float sky    = float((aMeta >> 17) & 0xFu);
  float block  = float((aMeta >> 21) & 0xFu);
  uint flags   = (aMeta >> 25) & 0x1Fu;

  bool sway      = (flags & 1u) != 0u;
  bool flatShade = (flags & 2u) != 0u;
  uint animGroup = (flags >> 2u) & 3u;

  // Animated textures store consecutive frames in consecutive layers.
  layer += uint(uAnimFrames[animGroup]);

  vec3 world = uChunkOrigin + aPos * (1.0 / 16.0);
  if (sway) world = foliageSway(world, uTime, aTint.a);

  float shade = flatShade ? 0.92 : FACE_SHADE[face];
  vec3 lm = lightmap(sky, block, uDaylight, uSkyLightColor, uAmbient);

  vTexCoord = vec3(aUV * (1.0 / 16.0), float(layer));
  vLight    = lm * (AO_LEVEL[ao] * shade);
  vTint     = aTint.rgb;
  vDist     = length(world - uCameraPos);
  // Fog uses horizontal distance so looking up does not thin the fog wall.
  vFogDist  = length((world - uCameraPos).xz) * 0.92 + abs(world.y - uCameraPos.y) * 0.35;

  gl_Position = uViewProj * vec4(world, 1.0);
}
`;

export const chunkFragmentShader = /* glsl */`
uniform mediump sampler2DArray uAtlas;
uniform float uAlphaCutoff;
uniform float uOpacity;

${GLSL_FOG}

in vec3  vTexCoord;
in vec3  vLight;
in vec3  vTint;
in float vDist;
in float vFogDist;

out vec4 fragColor;

void main() {
  vec4 tex = texture(uAtlas, vTexCoord);
  if (tex.a < uAlphaCutoff) discard;

  vec3 color = tex.rgb * vTint * vLight;
  float alpha = tex.a * uOpacity;

  color = applyFog(color, vFogDist);
  fragColor = vec4(color, alpha);
}
`;

/**
 * Overlay program: the crack animation drawn on the block being mined
 * and the translucent selection highlight. Uses plain 2D textures.
 */
export const overlayVertexShader = /* glsl */`
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUV;

uniform mat4 uViewProj;
uniform vec3 uOffset;

out vec2 vUV;

void main() {
  vUV = aUV;
  gl_Position = uViewProj * vec4(aPos + uOffset, 1.0);
}
`;

export const overlayFragmentShader = /* glsl */`
uniform sampler2D uTex;
uniform vec4 uColor;
uniform int uUseTexture;
/**
 * The block-breaking crack stages are packed into one vertical strip, so
 * stage N occupies v in [N/uStageCount, (N+1)/uStageCount].
 */
uniform float uStage;
uniform float uStageCount;

in vec2 vUV;
out vec4 fragColor;

void main() {
  vec4 c = uColor;
  if (uUseTexture == 1) {
    vec2 uv = vUV;
    if (uStageCount > 0.0) uv.y = (uv.y + uStage) / uStageCount;
    vec4 t = texture(uTex, uv);
    if (t.a < 0.02) discard;
    c = vec4(t.rgb, t.a * uColor.a);
  }
  fragColor = c;
}
`;
