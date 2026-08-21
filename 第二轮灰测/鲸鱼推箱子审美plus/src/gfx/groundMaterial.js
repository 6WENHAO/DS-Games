/**
 * Terrain surface material.
 *
 * World-space texel snapping gives the ground a fixed pixel grid (4 texels per
 * metre) that reads as 3D pixel art from any camera angle. Turf, gravel road
 * and the mown plot are three palettes blended by baked vertex masks, with a
 * dithered boundary so the road edge crumbles pixel by pixel instead of fading.
 */
import * as THREE from 'three';
import { PALETTE } from '../core/config.js';
import { withShared } from '../core/env.js';
import { GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, GLSL_LIGHTING_FRAG } from './shaderChunks.js';
import { textures } from './textures.js';
import { PLOT } from '../world/plot.js';

const VERT = [GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, /* glsl */ `
attribute float aPath;
attribute float aLawn;
attribute float aShade;

varying vec3 vWorld;
varying vec3 vNormal;
varying float vPath;
varying float vLawn;
varying float vShade;

void main(){
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vPath = aPath;
  vLawn = aLawn;
  vShade = aShade;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`].join('\n');

const FRAG = [GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, GLSL_LIGHTING_FRAG, /* glsl */ `
uniform sampler2D uDetail;
uniform float uTexelsPerUnit;
uniform float uDetailTile;

uniform vec3 uTurfDeep;
uniform vec3 uTurfMid;
uniform vec3 uTurfLit;
uniform vec3 uTurfDry;
uniform vec3 uSoil;
uniform vec3 uSoilLit;
uniform vec3 uSoilDark;
uniform vec3 uGravel;
uniform float uLawnTile;
uniform vec2 uPlotCentre;
uniform vec2 uPlotU;       // plot screen-right axis, projected to XZ
uniform vec2 uPlotV;       // plot screen-up axis, projected to XZ

varying vec3 vWorld;
varying vec3 vNormal;
varying float vPath;
varying float vLawn;
varying float vShade;

void main(){
  // Snap the shading coordinate to a world-locked texel grid.
  vec2 grid = floor(vWorld.xz * uTexelsPerUnit) / uTexelsPerUnit;
  vec4 det = texture2D(uDetail, grid / uDetailTile);
  float fine = det.r;
  float broad = det.g;
  float gravel = det.b;
  float tuft = det.a;

  // --- turf ---
  vec3 turf = mix(uTurfDeep, uTurfMid, dshToonRamp(fine * 0.75 + broad * 0.45, 4.0, 0.22));
  turf = mix(turf, uTurfDry, dshToonRamp(max(broad - 0.58, 0.0) * 2.4, 3.0, 0.28) * 0.55);
  turf = mix(turf, uTurfLit, tuft * 0.55);

  // --- mown plot: a checker in the plot's own frame keeps the puzzle grid legible ---
  vec2 rel = vWorld.xz - uPlotCentre;
  vec2 board = vec2(dot(rel, uPlotU), dot(rel, uPlotV));
  vec2 cell = floor(board / uLawnTile);
  float checker = mod(cell.x + cell.y, 2.0);
  vec3 lawn = mix(uTurfMid, uTurfLit, 0.32 + checker * 0.15);
  lawn = mix(lawn, uTurfDeep, max(0.0, 0.42 - fine) * 0.5);
  // A cut line every tile: the mower's wheel track.
  vec2 edge = abs(fract(board / uLawnTile) - 0.5);
  float seam = 1.0 - smoothstep(0.44, 0.5, max(edge.x, edge.y));
  lawn = mix(lawn * 0.94, lawn, seam);
  turf = mix(turf, lawn, vLawn);

  // --- packed road: ruts, gravel, a rim of scuffed soil ---
  vec3 road = mix(uSoilDark, uSoil, dshToonRamp(fine * 0.9 + 0.1, 4.0, 0.2));
  road = mix(road, uSoilLit, dshToonRamp(broad, 3.0, 0.26) * 0.65);
  road = mix(road, uGravel, gravel * 0.85);

  // Dithered blend edge: the road dissolves into the turf as loose pixels.
  float edgeNoise = dshNoise(grid * 3.1) * 0.5 + dshNoise(grid * 11.3) * 0.5;
  float roadMask = step(0.5, vPath * 1.22 + (edgeNoise - 0.5) * 0.55);
  roadMask = max(roadMask, step(0.86, vPath));
  vec3 albedo = mix(turf, road, roadMask);

  // --- lighting: stepped diffuse, sky probe, cloud shadow ---
  vec3 N = normalize(vNormal);
  float ndl = max(dot(N, uSunDir), 0.0);
  float cloud = dshCloudShadow(vWorld.xz);
  float lit = dshToonRamp(ndl * cloud, uToonSteps, uToonSoft);

  vec3 ambient = dshAmbient(N);
  vec3 color = albedo * (ambient + uSunColor * lit);

  // Baked contact shading from canopies and prop bases.
  color *= mix(1.0, 0.52, clamp(vShade, 0.0, 1.0));

  // Grazing-angle sheen: the low sun skims the turf and picks out the crests.
  float graze = pow(1.0 - abs(dot(N, normalize(uViewDir))), 3.0);
  color += uSunColor * graze * lit * 0.06 * (1.0 - roadMask);

  color = dshApplyFog(color, vWorld);
  gl_FragColor = vec4(color, 1.0);
}
`].join('\n');

export function createGroundMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: withShared({
      uDetail: { value: textures.detail },
      uTexelsPerUnit: { value: 4.0 },
      uDetailTile: { value: 14.0 },
      uTurfDeep: { value: PALETTE.grassDeep.clone() },
      uTurfMid: { value: PALETTE.grassMid.clone() },
      uTurfLit: { value: PALETTE.grassLit.clone() },
      uTurfDry: { value: PALETTE.grassDry.clone() },
      uSoil: { value: PALETTE.soil.clone() },
      uSoilLit: { value: PALETTE.soilLit.clone() },
      uSoilDark: { value: PALETTE.soilDark.clone() },
      uGravel: { value: PALETTE.gravel.clone() },
      uLawnTile: { value: PLOT.tile },
      uPlotCentre: { value: new THREE.Vector2(PLOT.center.x, PLOT.center.z) },
      uPlotU: { value: new THREE.Vector2(PLOT.axisU.x, PLOT.axisU.z) },
      uPlotV: { value: new THREE.Vector2(PLOT.axisV.x, PLOT.axisV.z) },
    }),
    side: THREE.FrontSide,
    toneMapped: false,
  });
}
