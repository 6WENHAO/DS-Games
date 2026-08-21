/**
 * gfx/shaders/gui.js
 * ------------------------------------------------------------------
 * 2D sprite/text shader for the HUD and every in-canvas screen, plus
 * the world-space billboard shader used by particles and the shader for
 * boxy entity models.
 */

import { GLSL_FOG, GLSL_LIGHT } from './common.js';

/* ------------------------------------------------------------------ */
/* GUI sprite batch                                                   */
/* ------------------------------------------------------------------ */

export const GUI_VERTEX_STRIDE = 20; // 2*4 pos + 2*4 uv + 4*1 colour

export const guiVertexShader = /* glsl */`
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUV;
layout(location = 2) in vec4 aColor;

uniform mat4 uProj;

out vec2 vUV;
out vec4 vColor;

void main() {
  vUV = aUV;
  vColor = aColor;
  gl_Position = uProj * vec4(aPos, 0.0, 1.0);
}
`;

export const guiFragmentShader = /* glsl */`
uniform sampler2D uTex;

in vec2 vUV;
in vec4 vColor;
out vec4 fragColor;

void main() {
  vec4 t = texture(uTex, vUV);
  vec4 c = t * vColor;
  if (c.a < 0.004) discard;
  fragColor = c;
}
`;

/* ------------------------------------------------------------------ */
/* particles (world-space billboards)                                 */
/* ------------------------------------------------------------------ */

export const PARTICLE_VERTEX_STRIDE = 28; // 3*4 pos + 2*4 uv + 4*1 colour + 1*4 light

export const particleVertexShader = /* glsl */`
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUV;
layout(location = 2) in vec4 aColor;
layout(location = 3) in float aLight;

uniform mat4 uViewProj;
uniform vec3 uCameraPos;

out vec2  vUV;
out vec4  vColor;
out float vFogDist;

void main() {
  vUV = aUV;
  vColor = vec4(aColor.rgb * aLight, aColor.a);
  vFogDist = length(aPos - uCameraPos);
  gl_Position = uViewProj * vec4(aPos, 1.0);
}
`;

export const particleFragmentShader = /* glsl */`
uniform sampler2D uTex;

${GLSL_FOG}

in vec2  vUV;
in vec4  vColor;
in float vFogDist;
out vec4 fragColor;

void main() {
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.05) discard;
  vec3 col = applyFog(t.rgb * vColor.rgb, vFogDist);
  fragColor = vec4(col, t.a * vColor.a);
}
`;

/* ------------------------------------------------------------------ */
/* entities (boxy models with a skin texture)                         */
/* ------------------------------------------------------------------ */

export const ENTITY_VERTEX_STRIDE = 24; // 3*4 pos + 2*4 uv + 3*1 normalId(+pad)

export const entityVertexShader = /* glsl */`
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUV;
layout(location = 2) in vec3 aNormal;

uniform mat4  uViewProj;
uniform mat4  uModel;
uniform vec3  uCameraPos;

out vec2  vUV;
out float vShade;
out float vFogDist;

void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec3 n = normalize(mat3(uModel) * aNormal);
  // Same directional weighting as block faces so entities sit in the scene.
  vShade = 0.55 + 0.45 * clamp(n.y * 0.5 + 0.5, 0.0, 1.0) * (0.7 + 0.3 * abs(n.x) + 0.15 * abs(n.z));
  vUV = aUV;
  vFogDist = length(world.xyz - uCameraPos);
  gl_Position = uViewProj * world;
}
`;

export const entityFragmentShader = /* glsl */`
uniform sampler2D uTex;
uniform vec4  uTint;
uniform vec3  uLight;
uniform float uFlash;      // 0..1 white damage flash

${GLSL_FOG}

in vec2  vUV;
in float vShade;
in float vFogDist;
out vec4 fragColor;

void main() {
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.06) discard;
  vec3 col = t.rgb * uTint.rgb * uLight * vShade;
  col = mix(col, vec3(1.0, 0.35, 0.35), uFlash);
  col = applyFog(col, vFogDist);
  fragColor = vec4(col, t.a * uTint.a);
}
`;

/* ------------------------------------------------------------------ */
/* first-person held item                                             */
/* ------------------------------------------------------------------ */

export const handVertexShader = /* glsl */`
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUV;
layout(location = 2) in float aFace;
layout(location = 3) in float aLayer;

uniform mat4 uProj;
uniform mat4 uModel;

out vec3  vTexCoord;
out float vShade;

const float FACE_SHADE[6] = float[6](0.60, 0.60, 1.00, 0.50, 0.80, 0.80);

void main() {
  vTexCoord = vec3(aUV, aLayer);
  vShade = FACE_SHADE[int(aFace)];
  gl_Position = uProj * uModel * vec4(aPos, 1.0);
}
`;

export const handFragmentShader = /* glsl */`
uniform mediump sampler2DArray uAtlas;
uniform sampler2D uFlat;
uniform int   uUseArray;
uniform vec3  uLight;
uniform vec3  uTint;

${GLSL_LIGHT}

in vec3  vTexCoord;
in float vShade;
out vec4 fragColor;

void main() {
  vec4 t = uUseArray == 1
    ? texture(uAtlas, vTexCoord)
    : texture(uFlat, vTexCoord.xy);
  if (t.a < 0.1) discard;
  fragColor = vec4(t.rgb * uTint * uLight * vShade, 1.0);
}
`;
