// Toon materials for characters: cel ramp + fresnel rim light + inverted-hull outline.
// Shaders are injected into three's built-in materials so skinning/shadows keep working.
import * as THREE from 'three';
import { makeToonRamp } from '../core/textures.js';
import { clamp } from '../core/utils.js';

// ---------------------------------------------------------------- shared ramp
let _ramp = null;
/** 3-step anime lighting ramp (module level cache, 64x1). */
export function charToonRamp() {
  if (!_ramp) _ramp = makeToonRamp([0.0, 0.44, 0.70, 1.0], [0.52, 0.78, 0.95, 1.0]);
  return _ramp;
}

const RIM_GLSL = /* glsl */ '\n{\n' +
  '  vec3 rN = normalize( normal );\n' +
  '  vec3 rV = normalize( vViewPosition );\n' +
  '  float rf = 1.0 - clamp( dot( rN, rV ), 0.0, 1.0 );\n' +
  '  rf = pow( rf, uRimPower );\n' +
  '  rf *= mix( 0.45, 1.0, clamp( rN.y * 0.5 + 0.75, 0.0, 1.0 ) );\n' +
  '  reflectedLight.indirectDiffuse += uRimColor * ( rf * uRimStrength );\n' +
  '}\n';

/**
 * MeshToonMaterial + gradient ramp + fresnel rim light.
 * Vertex colours carry the per-part palette so a whole character is one draw call.
 */
export function makeCharMaterial(opts = {}) {
  const {
    map = null, color = 0xffffff, vertexColors = true,
    rimColor = 0xcfe4ff, rimStrength = 0.55, rimPower = 3.2,
    side = THREE.FrontSide, transparent = false, alphaTest = 0,
  } = opts;
  const mat = new THREE.MeshToonMaterial({
    color, map, vertexColors, gradientMap: charToonRamp(), side, transparent, alphaTest,
  });
  const u = {
    uRimColor: new THREE.Uniform(new THREE.Color(rimColor)),
    uRimStrength: new THREE.Uniform(rimStrength),
    uRimPower: new THREE.Uniform(rimPower),
  };
  mat.userData.rim = u;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = u.uRimColor;
    shader.uniforms.uRimStrength = u.uRimStrength;
    shader.uniforms.uRimPower = u.uRimPower;
    shader.fragmentShader =
      'uniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;\n' +
      shader.fragmentShader.replace('#include <aomap_fragment>', '#include <aomap_fragment>' + RIM_GLSL);
  };
  mat.customProgramCacheKey = () => 'gi-char-toon-rim';
  return mat;
}

const OUTLINE_GLSL = /* glsl */ '\n' +
  '#ifdef USE_SKINNING\n' +
  '  transformed += normalize( objectNormal ) * ( uOutlineWidth * aOutline );\n' +
  '#else\n' +
  '  transformed += normalize( normal ) * ( uOutlineWidth * aOutline );\n' +
  '#endif\n';

/**
 * Inverted hull outline: BackSide shell pushed along the (skinned) normal.
 * Needs an aOutline float attribute (0 hides the outline on interior seams).
 */
export function makeOutlineMaterial(opts = {}) {
  const { color = 0x2a2119, width = 0.008, fog = true } = opts;
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, fog });
  const u = { uOutlineWidth: new THREE.Uniform(width) };
  mat.userData.outline = u;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uOutlineWidth = u.uOutlineWidth;
    shader.vertexShader =
      'uniform float uOutlineWidth;\nattribute float aOutline;\n' +
      shader.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>' + OUTLINE_GLSL);
  };
  mat.customProgramCacheKey = () => 'gi-char-outline';
  return mat;
}

const _warm = new THREE.Color(1.0, 0.72, 0.45);
const _night = new THREE.Color(0.34, 0.46, 0.78);

/** Tint the rim light from the current sky (called throttled by the character). */
export function syncRim(mat, ctx) {
  const u = mat && mat.userData && mat.userData.rim; if (!u) return;
  const day = clamp((ctx && ctx.sky && ctx.sky.dayFactor != null) ? ctx.sky.dayFactor : 1, 0, 1);
  const sun = ctx && ctx.sky && ctx.sky.sunDir;
  const low = sun ? clamp(1 - Math.abs(sun.y) * 2.4, 0, 1) : 0;
  const c = u.uRimColor.value;
  c.setRGB(0.62, 0.80, 1.0);
  if (low > 0) c.lerp(_warm, low * 0.75 * day);
  if (day < 0.5) c.lerp(_night, (0.5 - day) * 1.4);
  u.uRimStrength.value = 0.30 + day * 0.34;
}

/** Dark outline colour derived from a base palette colour. */
export function outlineColorFrom(hex, k = 0.30) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  c.lerp(new THREE.Color(0x241c14), 0.45);
  return c.getHex();
}
