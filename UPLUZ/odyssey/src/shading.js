import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Illustrated (non-PBR) lighting, shared by every world material.
// Three authored bands + a wrapped terminator + warm ground bounce.
// No specular anywhere except water and awakened runes — specular is what
// makes stylised worlds look like plastic.
// ---------------------------------------------------------------------------

export const PALETTE = {
  meadow:    0xc9dfa4,
  bleached:  0xe4eec0,
  shadowGrn: 0x7fa97e,
  skyHigh:   0x8fc4e8,
  horizon:   0xe9f2f5,
  butter:    0xffe3b0,
  apricot:   0xf2a65a,
  runeCyan:  0x7fd8d2,
  cloud:     0xfbf7ee,
  inkTeal:   0x2e4a54,
  bounce:    0xe8d8b0,
};

const c = (hex) => new THREE.Color(hex);

export function makeSkyUniforms() {
  // sun held low — between 12 and 28 degrees for 80% of the game
  const elev = THREE.MathUtils.degToRad(19);
  const azim = THREE.MathUtils.degToRad(38);
  const dir = new THREE.Vector3(
    Math.cos(elev) * Math.sin(azim),
    Math.sin(elev),
    Math.cos(elev) * Math.cos(azim),
  );
  return {
    uTime:       { value: 0 },
    uSunDir:     { value: dir },
    uSunColor:   { value: c(PALETTE.butter).multiplyScalar(0.86) },
    uSkyColor:   { value: c(PALETTE.skyHigh).multiplyScalar(0.30) },
    uGroundCol:  { value: c(PALETTE.bounce).multiplyScalar(0.22) },
    uFogColor:   { value: c(0xd7e6ea) },
    uFogDensity: { value: 0.0021 },
    uPlayer:     { value: new THREE.Vector3() },
    uWind:       { value: new THREE.Vector2(0.82, 0.57) },
    uWindGust:   { value: 1 },
  };
}

export const SHADING_GLSL = /* glsl */`
  uniform float uTime;
  uniform vec3  uSunDir;
  uniform vec3  uSunColor;
  uniform vec3  uSkyColor;
  uniform vec3  uGroundCol;
  uniform vec3  uFogColor;
  uniform float uFogDensity;

  // three hand-authored bands, soft wrapped terminator
  float lightBands(float ndl) {
    float w = ndl * 0.5 + 0.5;               // wrap: nothing reads as black
    float b = 0.20;
    b += smoothstep(0.30, 0.40, w) * 0.26;
    b += smoothstep(0.58, 0.72, w) * 0.30;
    return b;
  }

  vec3 illustrated(vec3 n, vec3 albedo, float shade) {
    float ndl = dot(normalize(n), uSunDir);
    vec3 direct = uSunColor * lightBands(ndl) * shade;
    // hemisphere fill: sky above, WARM ground bounce below (never grey)
    vec3 fill = mix(uGroundCol, uSkyColor, n.y * 0.5 + 0.5);
    return albedo * (direct + fill);
  }

  // wrapped back-scatter — backlit foliage glowing amber is the signature shot
  vec3 translucency(vec3 viewDir, float thickness, vec3 tint) {
    float back = pow(max(dot(viewDir, -uSunDir), 0.0), 3.5);
    return uSunColor * tint * back * thickness;
  }

  vec3 applyFog(vec3 col, float dist, vec3 viewDir) {
    float f = 1.0 - exp(-dist * uFogDensity);
    float s = max(dot(viewDir, uSunDir), 0.0);
    vec3 fc = mix(uFogColor, uSunColor, pow(s, 5.0) * 0.30);
    return mix(col, fc, clamp(f, 0.0, 1.0));
  }
`;

// height + normal fetch, shared by terrain and grass so blades sit exactly on
// the surface the player walks on
export const HEIGHTFIELD_GLSL = /* glsl */`
  uniform sampler2D uHeight;
  uniform float uWorldSize;
  vec4 sampleField(vec2 worldXZ) {
    vec2 uv = worldXZ / uWorldSize + 0.5;
    vec4 t = texture2D(uHeight, uv);
    return vec4(t.r, normalize(vec3(t.g, t.b, t.a)));
  }
`;

// cheap procedural wind — three sines, zero CPU work, zero texture fetch
export const WIND_GLSL = /* glsl */`
  uniform float uTime;
  uniform vec2 uWind;
  uniform float uWindGust;
  float windField(vec2 p, float t) {
    float w  = sin(dot(p, uWind) * 0.075 + t * 1.35) * 0.55;
          w += sin(dot(p, vec2(-uWind.y, uWind.x)) * 0.049 - t * 0.92) * 0.32;
          w += sin(dot(p, uWind) * 0.017 + t * 0.41) * 0.60;
    return w * uWindGust;
  }
`;
