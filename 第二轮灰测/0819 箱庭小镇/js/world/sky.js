/* =============================================================
   js/world/sky.js — TOWN.Sky
   The sky dome, the sun & moon, and the WHOLE day/night cycle.

   This module is the single writer of TOWN.Env.  Everything else in
   the town reads it, so the numbers here are the contract:

     Env.hours dayF nightF duskF lampF sunUp sunDir moonDir
        sunColor fogColor horizonColor zenithColor
     (+ extras: sunElev moonElev exposure weather moonPhase)

   Contents
     1 · time model      analytic solar path + smooth 0..1 factors
     2 · colour grading   24 h keyframe tables, linear-space lerp
     3 · sky dome         one ShaderMaterial: gradient, sun disc + Mie
                          halo, directional sunset band, phased moon,
                          procedural stars + milky way, horizon haze
     4 · lights           sun / moon / hemi / ambient  -> TOWN.Stage
     5 · clouds           merged low-poly clusters + cirrus sheets
     6 · distant scenery  3 rings of island silhouettes
     7 · environment map  PMREM bake of the dome -> scene.environment

   Only this module may author raw shaders (see CONTRACT §1.3).
   ============================================================= */
(function (global) {
  'use strict';

  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U;
  const Geo = TOWN.Geo;
  const Mat = TOWN.Mat;
  const P = TOWN.Palette;
  const Env = TOWN.Env;
  const Stage = TOWN.Stage;

  const Sky = TOWN.Sky = {};

  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;

  /* ============================================================
     0 · module state  (everything reused — zero per-frame allocation)
     ============================================================ */
  let _built = false;
  let _scene = null;
  let _renderer = null;
  let _root = null;
  let _radius = 900;
  let _islandR = 60;

  let _dome = null, _domeMat = null, _uni = null;
  let _sun = null, _moon = null, _hemi = null, _amb = null;
  let _fog = null;

  const _clouds = [];            // {mesh, sp, lat, reseat}
  const _cirrus = [];            // {mesh, sp}
  const _cloudMats = [];         // 4 shared, re-tinted
  let _cirrusMat = null;
  const _ringMats = [];          // 3 shared, re-tinted

  let _weather = 0.25;
  let _lastH = 9;
  let _dayIndex = 0;
  let _moonPhase = 0.68;         // 0 = new, 0.5 = full
  let _exposure = 1;

  // env map
  Sky.envMapEnabled = true;
  let _pmrem = null, _envRT = null, _envScene = null, _envMesh = null;
  let _envBakedAt = -99, _envDirty = true, _envFailed = false, _envLastMs = -1e9;

  // scratch — never allocate inside setHours / the ticker
  const _cA = new T.Color();
  const _cB = new T.Color();
  const _cC = new T.Color();
  const _cD = new T.Color();
  const _cE = new T.Color();
  const _defWind = new T.Vector2(0.82, 0.57).normalize();

  // reusable palette colours (built once)
  const _cGrass = new T.Color(P.grass);
  const _cSand = new T.Color(P.sand);
  const _cGroundDay = new T.Color().lerpColors(_cGrass, _cSand, 0.38);
  const _cGroundNight = new T.Color(0x0a1020);
  const _cAmbNight = new T.Color(0x28345c);
  const _cAmbDay = new T.Color(0xbcd2e8);
  const _cCloudDay = new T.Color(0xf6f8fc);
  const _cCloudDusk = new T.Color(0xffcfae);
  const _cCloudNight = new T.Color(0x1c2440);
  const _cCloudEmNight = new T.Color(0x141d34);
  const _cRock = new T.Color(0x39493f);

  /* ============================================================
     1 · time model — analytic solar path
     Latitude / declination chosen so that: sunrise 6.30, solar noon
     12.50 at 68.0 deg elevation, sunset 18.70.  Azimuth sweeps
     E (84 deg) -> S (179 deg) -> W (276 deg) so shadows rotate.
     ============================================================ */
  const LAT = 27.65 * DEG;
  const DECL = 5.65 * DEG;
  const SIN_LAT = Math.sin(LAT), COS_LAT = Math.cos(LAT);

  // world convention: +X = east, -Z = north, +Z = south, +Y = up
  // fills `out` with the unit direction origin -> body, returns elevation in degrees
  function bodyDir(hourAngle, decl, out) {
    const sd = Math.sin(decl), cd = Math.cos(decl);
    let sinE = sd * SIN_LAT + cd * COS_LAT * Math.cos(hourAngle);
    if (sinE > 1) sinE = 1; else if (sinE < -1) sinE = -1;
    const elev = Math.asin(sinE);
    const cosE = Math.cos(elev);
    const den = cosE * COS_LAT;
    let cosA = den > 1e-6 ? (sd - sinE * SIN_LAT) / den : -1;
    if (cosA > 1) cosA = 1; else if (cosA < -1) cosA = -1;
    const sinA = -Math.sin(hourAngle) * cd / (cosE > 1e-6 ? cosE : 1e-6);
    const az = Math.atan2(sinA, cosA);
    out.set(cosE * Math.sin(az), sinE, -cosE * Math.cos(az));
    return elev / DEG;
  }

  /* ============================================================
     2 · colour keyframes — authored in sRGB hex, lerped in the
     linear space THREE.Color stores (ColorManagement is on in r152).
     Key spacing is chosen so that no channel ever moves faster than
     ~0.35 / hour, which keeps the transitions visually seamless
     (measured worst step over 0.05 h: 0.0173).
     ============================================================ */
  const ZENITH_K = [
    [0.0, 0x191c48], [4.0, 0x1b214f], [4.6, 0x1f2752], [5.2, 0x24305c], [5.7, 0x2c406c],
    [6.15, 0x30507e], [6.8, 0x3e6698], [7.5, 0x4c7cae], [8.2, 0x5a8ec0], [9.0, 0x66a0d2],
    [11.0, 0x66a4dc], [12.5, 0x6aabe2], [14.5, 0x68a6dd], [16.0, 0x649bd0], [17.0, 0x6293c6],
    [17.7, 0x6089bb], [18.2, 0x557aa4], [18.7, 0x496a8e], [19.2, 0x3c5776], [19.7, 0x2f4560],
    [20.3, 0x22344a], [20.9, 0x1e2a46], [21.6, 0x1b1f40], [22.6, 0x181c44], [24.0, 0x191c48],
  ];
  const MID_K = [
    [0.0, 0x1d2248], [4.0, 0x202650], [4.6, 0x242c5a], [5.2, 0x2c3a64], [5.7, 0x424874],
    [6.15, 0x565480], [6.8, 0x74708e], [7.6, 0x8e94b4], [8.4, 0x9cb0cf], [9.2, 0xa6c2e0],
    [11.0, 0xa2c6e8], [12.5, 0xa4cbee], [14.5, 0xa2c6e8], [16.0, 0xaabed6], [16.8, 0xb4bacc],
    [17.7, 0xc6b4a4], [18.2, 0xc9a184], [18.7, 0xc08e70], [19.2, 0xa8765f], [19.7, 0x8a5e56],
    [20.3, 0x644a52], [20.9, 0x4a3e52], [21.6, 0x343544], [22.6, 0x262a46], [24.0, 0x1d2248],
  ];
  const HORIZON_K = [
    [0.0, 0x26304e], [4.0, 0x293456], [4.6, 0x313c60], [5.2, 0x484d70], [5.7, 0x6e5c76],
    [6.15, 0x8a6874], [6.8, 0xb88478], [7.5, 0xcd9c86], [8.2, 0xdbbca6], [9.0, 0xdccdc2],
    [9.8, 0xd8d6d8], [10.8, 0xd2dcec], [12.5, 0xd4e6f4], [14.5, 0xd6e0ea], [16.0, 0xdcd8cd],
    [17.0, 0xe2cba8], [17.7, 0xe6b784], [18.2, 0xe0a468], [18.7, 0xd68a52], [19.2, 0xc27a58],
    [19.7, 0xac6e5e], [20.3, 0x7e5258], [20.9, 0x5a4054], [21.6, 0x3e3652], [22.6, 0x2c3048],
    [24.0, 0x26304e],
  ];
  const SUNCOL_K = [
    [0.0, 0x9a7a80], [5.2, 0xbc8068], [6.0, 0xdd8a58], [6.6, 0xf09858], [7.4, 0xffb673],
    [8.2, 0xffcd94], [9.2, 0xffe0b8], [11.0, 0xfff2dd], [12.5, 0xfff8e8], [14.5, 0xfff0d8],
    [16.0, 0xffe6c4], [17.0, 0xffd6a4], [17.7, 0xffc07a], [18.2, 0xffa25c], [18.7, 0xff7a44],
    [19.4, 0xe8683c], [20.2, 0xcc6a52], [22.0, 0x9a7a80], [24.0, 0x9a7a80],
  ];
  // lampF is a keyframe curve too: the evening ramp starts 1.7 h before
  // sunset while the morning ramp ends 0.85 h after sunrise — that
  // asymmetry IS the hysteresis (lamps come on before it is dark).
  const LAMP_K = [
    [0, 1], [4.2, 1], [4.8, 0.97], [5.4, 0.90], [5.8, 0.78], [6.2, 0.56],
    [6.5, 0.36], [6.8, 0.17], [7.0, 0.03], [7.3, 0.0], [16.4, 0.0], [17.0, 0.07],
    [17.6, 0.17], [18.0, 0.28], [18.4, 0.40], [18.7, 0.50], [19.0, 0.60],
    [19.2, 0.70], [19.4, 0.79], [19.8, 0.90], [20.4, 0.97], [21.2, 1], [24, 1],
  ];

  // compiled tables: [{h, c:Color}] — built once
  function compileC(keys) {
    const out = [];
    for (let i = 0; i < keys.length; i++) out.push({ h: keys[i][0], c: new T.Color(keys[i][1]) });
    return out;
  }
  let ZEN_T = null, MID_T = null, HOR_T = null, SUN_T = null;

  // linear scan from a cached cursor: setHours moves monotonically in
  // practice, so this is ~1 comparison per call.
  function pickC(tab, h, out) {
    const n = tab.length;
    let i = 0;
    while (i < n - 2 && tab[i + 1].h <= h) i++;
    const a = tab[i], b = tab[i + 1];
    const span = b.h - a.h;
    let t = span > 1e-6 ? (h - a.h) / span : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    out.lerpColors(a.c, b.c, t);
    return out;
  }
  function pickF(keys, h) {
    const n = keys.length;
    let i = 0;
    while (i < n - 2 && keys[i + 1][0] <= h) i++;
    const a = keys[i], b = keys[i + 1];
    const span = b[0] - a[0];
    let t = span > 1e-6 ? (h - a[0]) / span : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    t = t * t * (3 - 2 * t);
    return a[1] + (b[1] - a[1]) * t;
  }

  /* ============================================================
     3 · sky dome shader
     ============================================================ */
  const VERT = [
    'varying vec3 vWorld;',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorld = wp.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}',
  ].join('\n');

  const FRAG = [
    'uniform vec3 uZenith;',
    'uniform vec3 uMid;',
    'uniform vec3 uHorizon;',
    'uniform vec3 uHaze;',
    'uniform vec3 uBand;',
    'uniform vec3 uSunTint;',
    'uniform vec3 uSunDir;',
    'uniform vec3 uMoonDir;',
    'uniform float uTime;',
    'uniform float uSunI;',
    'uniform float uHaloI;',
    'uniform float uBandI;',
    'uniform float uLowSun;',
    'uniform float uStarF;',
    'uniform float uMoonI;',
    'uniform float uMoonPhase;',
    'uniform float uWeather;',
    'varying vec3 vWorld;',
    '',
    'const vec3 MW_AXIS = vec3(0.4243, 0.3031, -0.8534);',
    '',
    'float h13(vec3 p) {',
    '  p = fract(p * 0.3183099 + vec3(0.11, 0.71, 0.31));',
    '  p *= 17.0;',
    '  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));',
    '}',
    'float vnoise(vec3 p) {',
    '  vec3 i = floor(p), f = p - i;',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float n000 = h13(i);',
    '  float n100 = h13(i + vec3(1.0, 0.0, 0.0));',
    '  float n010 = h13(i + vec3(0.0, 1.0, 0.0));',
    '  float n110 = h13(i + vec3(1.0, 1.0, 0.0));',
    '  float n001 = h13(i + vec3(0.0, 0.0, 1.0));',
    '  float n101 = h13(i + vec3(1.0, 0.0, 1.0));',
    '  float n011 = h13(i + vec3(0.0, 1.0, 1.0));',
    '  float n111 = h13(i + vec3(1.0, 1.0, 1.0));',
    '  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),',
    '             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);',
    '}',
    // one cell of a jittered star lattice: hashed position, size and
    // brightness give a natural (non-grid) distribution
    'float starCell(vec3 dir, float scale, float sizeK, float thresh, float tw) {',
    '  vec3 sp = dir * scale;',
    '  vec3 c = floor(sp);',
    '  vec3 f = sp - c;',
    '  float m = h13(c + 1.73);',
    '  if (m < thresh) return 0.0;',
    '  vec3 j = vec3(h13(c + 3.17), h13(c + 5.71), h13(c + 9.37));',
    '  float mag = (m - thresh) / max(1.0 - thresh, 1e-4);',
    '  float rad = sizeK * (0.34 + 0.66 * mag * mag);',
    '  float d = length(f - j);',
    '  float s = smoothstep(rad, 0.0, d);',
    '  float twk = 0.70 + 0.30 * sin(uTime * tw + m * 137.0);',
    '  return s * s * (0.45 + 0.55 * mag) * twk;',
    '}',
    '',
    'void main() {',
    '  vec3 dir = normalize(vWorld - cameraPosition);',
    '  float hy = dir.y;',
    '',
    '  /* vertical gradient: horizon -> mid -> zenith */',
    '  float a = smoothstep(-0.045, 0.34, hy);',
    '  float b = smoothstep(0.13, 0.92, hy);',
    '  vec3 col = mix(uHorizon, uMid, a);',
    '  col = mix(col, uZenith, b);',
    '  col = mix(col * 0.55, col, smoothstep(-0.34, 0.0, hy));',
    '',
    '  /* horizon haze band, lifted by weather */',
    '  float haze = exp(-abs(hy) / (0.052 + 0.14 * uWeather));',
    '  col += uHaze * haze * (0.14 + 0.62 * uWeather);',
    '',
    '  /* directional sunrise / sunset band around the sun azimuth */',
    '  vec2 sa = uSunDir.xz;',
    '  float saL = length(sa);',
    '  vec2 da = dir.xz;',
    '  float daL = length(da);',
    '  float az = 0.0;',
    '  if (saL > 1e-4 && daL > 1e-4) az = max(dot(sa / saL, da / daL), 0.0);',
    '  float bandV = exp(-max(hy + 0.05, 0.0) / 0.21);',
    '  col += uBand * (pow(az, 2.6) * bandV) * uBandI;',
    '',
    '  /* sun: soft limb + wide Mie-ish halo that warms & widens low down */',
    '  float cs = max(dot(dir, uSunDir), 0.0);',
    '  float nTight = mix(1500.0, 340.0, uLowSun);',
    '  float nWide = mix(110.0, 22.0, uLowSun);',
    '  float halo = pow(cs, nTight) * 0.80 + pow(cs, nWide) * mix(0.32, 0.21, uLowSun) + pow(cs, 6.0) * 0.085;',
    '  col += uSunTint * halo * uHaloI;',
    '  float disc = smoothstep(0.99975, 0.99993, cs);',
    '  col += uSunTint * disc * uSunI * mix(6.0, 3.4, uLowSun);',
    '',
    '  /* moon: crescent terminator from the phase, glow + earthshine */',
    '  if (uMoonI > 0.002) {',
    '    float cm = max(dot(dir, uMoonDir), 0.0);',
    '    vec3 mx = cross(vec3(0.0, 1.0, 0.0), uMoonDir) + vec3(1e-3, 0.0, 0.0);',
    '    mx = normalize(mx);',
    '    vec3 my = cross(uMoonDir, mx);',
    '    float R = 0.0150;',
    '    float px = dot(dir, mx) / R;',
    '    float py = dot(dir, my) / R;',
    '    float rr = sqrt(max(0.0, 1.0 - py * py));',
    '    float k = cos(uMoonPhase * 6.2831853);',
    '    float lit = smoothstep(-0.09, 0.16, px - k * rr);',
    '    float md = smoothstep(1.03, 0.88, length(vec2(px, py)));',
    '    vec3 mc = vec3(1.0, 0.975, 0.925);',
    '    col += mc * md * (0.075 + 2.50 * lit) * uMoonI;',
    '    col += mc * (pow(cm, 2600.0) * 0.10 + pow(cm, 58.0) * 0.13) * uMoonI;',
    '  }',
    '',
    '  /* stars + milky way */',
    '  if (uStarF > 0.003) {',
    '    float above = smoothstep(-0.03, 0.10, hy);',
    '    float bb = dot(dir, MW_AXIS);',
    '    float bandm = exp(-bb * bb * 17.0);',
    '    float n = vnoise(dir * 6.5 + 3.1) * 0.62 + vnoise(dir * 14.0) * 0.38;',
    '    float mw = bandm * smoothstep(0.34, 0.86, n);',
    '    float s1 = starCell(dir, 62.0, 0.45, 0.8900 - mw * 0.040, 2.1);',
    '    float s2 = starCell(dir, 127.0, 0.29, 0.9400 - mw * 0.020, 3.4);',
    '    float sf = uStarF * above * (1.0 - 0.62 * uWeather);',
    '    col += (s1 * vec3(1.0, 0.97, 0.93) + s2 * vec3(0.84, 0.90, 1.0)) * sf * 2.1;',
    '    col += vec3(0.33, 0.37, 0.56) * mw * 0.085 * sf;',
    '  }',
    '',
    '  /* cheap ordered-ish dither: kills 8-bit banding in the gradient */',
    '  float dh = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
    '  col += (dh - 0.5) * 0.0035;',
    '',
    '  gl_FragColor = vec4(max(col, 0.0), 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '}',
  ].join('\n');

  function buildDome() {
    _uni = {
      uZenith: { value: new T.Color(0x66a0d2) },
      uMid: { value: new T.Color(0xa6c2e0) },
      uHorizon: { value: new T.Color(0xd0dae6) },
      uHaze: { value: new T.Color(0xd8e2ee) },
      uBand: { value: new T.Color(0xffb070) },
      uSunTint: { value: new T.Color(0xfff2dd) },
      uSunDir: { value: new T.Vector3(0, 1, 0) },
      uMoonDir: { value: new T.Vector3(0, -1, 0) },
      uTime: { value: 0 },
      uSunI: { value: 1 },
      uHaloI: { value: 0.3 },
      uBandI: { value: 0 },
      uLowSun: { value: 0 },
      uStarF: { value: 0 },
      uMoonI: { value: 0 },
      uMoonPhase: { value: _moonPhase },
      uWeather: { value: _weather },
    };
    _domeMat = new T.ShaderMaterial({
      uniforms: _uni,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      name: 'sky_dome',
    });
    // 48x24 keeps the per-fragment direction error far below the
    // sun-disc size, at 2208 triangles for one draw call.
    _dome = new T.Mesh(new T.SphereGeometry(_radius, 48, 24), _domeMat);
    _dome.frustumCulled = false;
    _dome.renderOrder = -1;
    _dome.castShadow = false;
    _dome.receiveShadow = false;
    _dome.name = 'skyDome';
    _dome.userData.dynamic = true;
    return _dome;
  }

  /* ============================================================
     4 · lights
     ============================================================ */
  function buildLights(g) {
    _sun = new T.DirectionalLight(0xfff2dd, 1.2);
    _sun.name = 'sunLight';
    _sun.position.set(60, 100, 40);
    _sun.castShadow = true;
    _sun.shadow.mapSize.set(2048, 2048);
    const d = _islandR * 1.15;
    const sc = _sun.shadow.camera;
    sc.left = -d; sc.right = d; sc.top = d; sc.bottom = -d;
    sc.near = 1; sc.far = 400;
    sc.updateProjectionMatrix();
    _sun.shadow.bias = -0.0005;
    _sun.shadow.normalBias = 0.02;

    // cool moonlight; 1024 map (a quarter of the sun's cost).
    // castShadow stays permanently true and we park shadow.autoUpdate
    // instead of toggling it: flipping castShadow changes
    // NUM_DIR_LIGHT_SHADOWS and would recompile every material twice a day.
    _moon = new T.DirectionalLight(0x9fb8e8, 0.0);
    _moon.name = 'moonLight';
    _moon.position.set(-60, 100, -40);
    _moon.castShadow = true;
    _moon.shadow.mapSize.set(1024, 1024);
    const mc = _moon.shadow.camera;
    mc.left = -d; mc.right = d; mc.top = d; mc.bottom = -d;
    mc.near = 1; mc.far = 400;
    mc.updateProjectionMatrix();
    _moon.shadow.bias = -0.0007;
    _moon.shadow.normalBias = 0.035;

    _hemi = new T.HemisphereLight(0xa6c2e0, _cGroundDay.getHex(), 0.6);
    _hemi.name = 'hemi';
    _amb = new T.AmbientLight(0xbcd2e8, 0.05);
    _amb.name = 'skyAmbient';

    g.add(_sun, _moon, _hemi, _amb);
    Stage.sunLight = _sun;
    Stage.moonLight = _moon;
    Stage.hemi = _hemi;
    Stage.ambient = _amb;
  }

  /* ============================================================
     5 · clouds
     ============================================================ */
  const CLOUD_N = 12;
  const CLOUD_WRAP = 285;      // along-wind half extent
  const CLOUD_HOLE = 118;      // min cross-wind offset -> clouds keep a ring

  function buildClouds(g, rng) {
    const blobA = new T.SphereGeometry(1, 6, 4);   // 36 tris
    const blobB = new T.SphereGeometry(1, 5, 3);   // 20 tris
    // 4 shared materials, re-tinted per time of day. The `name` makes
    // the Mat cache key private to this module so re-tinting can never
    // touch another author's material.
    for (let i = 0; i < 4; i++) {
      _cloudMats.push(Mat.std(0xf6f8fc, {
        flat: true, rough: 0.95, metal: 0, name: 'sky_cloud_' + i,
      }));
    }
    const m4 = new T.Matrix4();
    for (let i = 0; i < CLOUD_N; i++) {
      const parts = [];
      const n = rng.int(5, 8);
      const spread = rng.range(9, 16);
      for (let j = 0; j < n; j++) {
        const src = rng.chance(0.5) ? blobA : blobB;
        const geo = src.clone();
        const sx = rng.range(5.5, 12.5);
        const sy = sx * rng.range(0.28, 0.46);
        const sz = sx * rng.range(0.6, 1.05);
        m4.makeScale(sx, sy, sz);
        geo.applyMatrix4(m4);
        geo.translate(
          rng.bell() * spread,
          rng.bell() * 2.4 + (j === 0 ? 1.2 : 0),
          rng.bell() * spread * 0.7
        );
        parts.push(geo);
      }
      const merged = Geo.mergeGeometries(parts);
      const mesh = new T.Mesh(merged, _cloudMats[i % 4]);
      const ang = (i / CLOUD_N) * TAU + rng.range(-0.22, 0.22);
      const rad = rng.range(130, 260);
      mesh.position.set(Math.cos(ang) * rad, rng.range(55, 95), Math.sin(ang) * rad);
      mesh.rotation.y = rng.range(0, TAU);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.dynamic = true;
      mesh.name = 'cloud' + i;
      g.add(mesh);
      _clouds.push({ mesh: mesh, sp: rng.range(0.24, 0.46), lat: rng.range(4, 130), reseat: true });
    }
    blobA.dispose(); blobB.dispose();

    /* 3 huge faint cirrus sheets for depth (unlit, so they read at any
       hour); `tag` only exists to give this module a private cache key */
    _cirrusMat = Mat.basic(0xffffff, {
      transparent: true, opacity: 0.18, side: T.DoubleSide,
      depthWrite: false, tag: 'sky_cirrus',
    });
    for (let i = 0; i < 3; i++) {
      const w = rng.range(200, 320), d2 = rng.range(150, 240);
      const pg = new T.PlaneGeometry(w, d2, 3, 2);      // 12 tris
      pg.rotateX(-Math.PI / 2);
      Geo.applyVertexNoise(pg, 6.5, 0.012);
      const mesh = new T.Mesh(pg, _cirrusMat);
      mesh.position.set(rng.bell() * 90, rng.range(115, 165), rng.bell() * 90);
      mesh.rotation.y = rng.range(0, TAU);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.dynamic = true;
      mesh.name = 'cirrus' + i;
      g.add(mesh);
      _cirrus.push({ mesh: mesh, sp: rng.range(0.06, 0.13) });
    }
  }

  /**
   * Wind for the cloud drift. TOWN.Dynamics (if that module is loaded) exposes
   * windDir as a *function of time returning radians*, so support that, a bare
   * angle, and a Vector2/Vector3 — anything unusable falls back to a fixed
   * breeze. Result goes into _wx / _wz (module scope: no allocation).
   */
  let _wx = 0.822, _wz = 0.570, _wSpeed = 1;
  function readWind(elapsed) {
    _wx = _defWind.x; _wz = _defWind.y; _wSpeed = 1;
    const D = TOWN.Dynamics;
    if (!D || !D.windDir) return;
    try {
      const w = D.windDir;
      let a = null;
      if (typeof w === 'function') { const v = w(elapsed); if (typeof v === 'number' && isFinite(v)) a = v; }
      else if (typeof w === 'number' && isFinite(w)) a = w;
      if (a !== null) {
        _wx = Math.cos(a); _wz = Math.sin(a);
      } else if (w && typeof w === 'object') {
        const zz = (w.z === undefined) ? w.y : w.z;
        const l = Math.sqrt(w.x * w.x + zz * zz);
        if (isFinite(l) && l > 1e-4) { _wx = w.x / l; _wz = zz / l; }
      }
      if (typeof D.windStrength === 'function') {
        const s = D.windStrength(elapsed);
        if (typeof s === 'number' && isFinite(s)) _wSpeed = 0.55 + 1.1 * U.saturate(s);
      }
    } catch (e) {
      _wx = _defWind.x; _wz = _defWind.y; _wSpeed = 1;
    }
  }

  function driftClouds(dt, elapsed) {
    if (!(dt > 0)) return;
    readWind(elapsed);
    const wx = _wx, wz = _wz, spd = _wSpeed;
    for (let i = 0; i < _clouds.length; i++) {
      const c = _clouds[i], p = c.mesh.position;
      p.x += wx * c.sp * spd * dt;
      p.z += wz * c.sp * spd * dt;
      let proj = p.x * wx + p.z * wz;
      // wrap upwind (whole laps at once), and re-seat the cross-wind offset
      // so a cluster never ends up parked directly over the town
      if (proj > CLOUD_WRAP || c.reseat) {
        if (proj > CLOUD_WRAP) {
          proj -= CLOUD_WRAP * 2 * Math.ceil((proj - CLOUD_WRAP) / (CLOUD_WRAP * 2));
        }
        c.reseat = false;
        let lat = p.z * wx - p.x * wz;
        const aLat = lat < 0 ? -lat : lat;
        if (aLat < CLOUD_HOLE) lat = (lat < 0 ? -1 : 1) * (CLOUD_HOLE + c.lat);
        p.x = wx * proj - wz * lat;
        p.z = wz * proj + wx * lat;
      }
      // Dynamics rotates the wind, so a re-seated cluster can still be carried
      // toward the middle later. Steer it back out gently (never teleport) so
      // the ring stays a ring and nothing hangs over the town centre.
      const r2 = p.x * p.x + p.z * p.z;
      if (r2 < CLOUD_HOLE * CLOUD_HOLE) {
        const r = Math.sqrt(r2);
        if (r > 1e-3) {
          const push = (CLOUD_HOLE / r - 1) * c.sp * spd * dt * 2.2;
          p.x += (p.x / r) * push;
          p.z += (p.z / r) * push;
        } else {
          p.x = CLOUD_HOLE;
        }
      }
    }
    for (let i = 0; i < _cirrus.length; i++) {
      const c = _cirrus[i], p = c.mesh.position;
      p.x += wx * c.sp * spd * dt;
      p.z += wz * c.sp * spd * dt;
      const proj = p.x * wx + p.z * wz;
      if (proj > 200) {
        const k = 400 * Math.ceil((proj - 200) / 400);
        p.x -= wx * k; p.z -= wz * k;
      }
    }
  }

  /* ============================================================
     6 · distant scenery — 3 concentric rings of island silhouettes,
     one merged geometry + one shared material per ring.
     ============================================================ */
  function ringMesh(rng, count, rIn, rOut, hMin, hMax, sides, mat, name) {
    const parts = [];
    const m4 = new T.Matrix4();
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * TAU + rng.range(-0.4, 0.4) * (TAU / count);
      const rad = rng.range(rIn, rOut);
      const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad;
      const peaks = rng.chance(0.55) ? 2 : 1;
      for (let k = 0; k < peaks; k++) {
        const h = rng.range(hMin, hMax) * (k === 0 ? 1 : rng.range(0.45, 0.72));
        const base = h * rng.range(1.6, 3.4);
        const prof = [
          [base, 0],
          [base * rng.range(0.42, 0.62), h * rng.range(0.48, 0.62)],
          [base * 0.05, h],
        ];
        const geo = Geo.lathe(prof, sides);
        m4.makeScale(1, 1, rng.range(0.5, 0.85));
        geo.applyMatrix4(m4);
        m4.makeRotationY(rng.range(0, TAU));
        geo.applyMatrix4(m4);
        geo.translate(cx + rng.bell() * base * 1.1, -1.2, cz + rng.bell() * base * 1.1);
        parts.push(geo);
      }
    }
    const mesh = new T.Mesh(Geo.mergeGeometries(parts), mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.userData.dynamic = true;      // keep out of the static merger
    mesh.name = name;
    return mesh;
  }

  function buildScenery(g, rng) {
    const specs = [
      [14, 195, 240, 7, 17, 6],
      [12, 285, 330, 13, 27, 6],
      [10, 375, 425, 20, 40, 5],
    ];
    for (let i = 0; i < specs.length; i++) {
      const mat = Mat.std(0x39493f, {
        flat: true, rough: 0.95, metal: 0, name: 'sky_far_' + i,
      });
      // scene fog would wash these back into the sky on top of the aerial
      // perspective we grade by hand below, so opt them out of it
      mat.fog = false;
      _ringMats.push(mat);
      const s = specs[i];
      g.add(ringMesh(rng, s[0], s[1], s[2], s[3], s[4], s[5], mat, 'farRing' + i));
    }
  }

  /* ============================================================
     7 · environment map (PMREM of the dome only)
     ============================================================ */
  function initEnv() {
    if (!_renderer || _envFailed) return;
    try {
      _pmrem = new T.PMREMGenerator(_renderer);
      _envScene = new T.Scene();
      _envMesh = new T.Mesh(new T.SphereGeometry(12, 24, 14), _domeMat);
      _envMesh.frustumCulled = false;
      _envScene.add(_envMesh);
    } catch (e) {
      _envFailed = true;
      _pmrem = null;
    }
  }

  function bakeEnv() {
    if (_envFailed || !Sky.envMapEnabled || !_renderer || !_scene) return;
    if (!_pmrem) initEnv();
    if (!_pmrem) return;
    const now = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
    if (now - _envLastMs < 240) return;          // never thrash the GPU
    try {
      const rt = _pmrem.fromScene(_envScene, 0, 1, 60);
      if (_envRT && _envRT.dispose) _envRT.dispose();
      _envRT = rt;
      _scene.environment = rt.texture;
      _envBakedAt = Env.hours;
      _envDirty = false;
      _envLastMs = now;
    } catch (e) {
      _envFailed = true;
      console.warn('[sky] PMREM unavailable, continuing without an env map');
    }
  }

  /* ============================================================
     8 · build
     ============================================================ */
  Sky.build = function (opts) {
    opts = opts || {};
    if (_built) return _root;

    _scene = opts.scene || Stage.scene || null;
    _renderer = opts.renderer || Stage.renderer || null;
    _radius = opts.radius === undefined ? 900 : opts.radius;
    _islandR = opts.islandRadius === undefined ? 60 : opts.islandRadius;
    if (opts.weather !== undefined) _weather = U.saturate(opts.weather);

    ZEN_T = compileC(ZENITH_K);
    MID_T = compileC(MID_K);
    HOR_T = compileC(HORIZON_K);
    SUN_T = compileC(SUNCOL_K);

    const rng = U.rng(opts.seed || 8190);

    _root = TOWN.group('sky');
    _root.userData.dynamic = true;          // clouds move: never merge us
    _root.add(buildDome());
    buildClouds(_root, rng);
    buildScenery(_root, rng);
    buildLights(_root);

    _fog = new T.FogExp2(0xbcd8e8, 0.0022);
    if (_scene) {
      _scene.add(_root);
      _scene.fog = _fog;
      if (!Stage.scene) Stage.scene = _scene;
    }
    if (_renderer && !Stage.renderer) Stage.renderer = _renderer;

    _built = true;
    initEnv();
    Sky.setHours(opts.hours === undefined ? Env.hours : opts.hours);
    bakeEnv();                              // one bake up front

    TOWN.Ticker.add(function (dt, elapsed) {
      Env.dt = dt;
      Env.elapsed = elapsed;
      if (_uni) _uni.uTime.value = elapsed;
      driftClouds(dt, elapsed);
      // flicker must keep animating even when the clock is paused
      Mat.updateNight(Env.lampF, elapsed);
      TOWN.updateHalos(Env.lampF, elapsed);
      if (!_scene && Stage.scene) { _scene = Stage.scene; _scene.add(_root); _scene.fog = _fog; }
      if (_envDirty) bakeEnv();             // at most one bake per frame
      fitDome();
    }, 'sky', { always: true });

    return _root;
  };

  // if the host camera's far plane cannot reach the dome, shrink it —
  // the shader is radius independent, so this is purely defensive.
  let _lastFar = -1;
  function fitDome() {
    const cam = Stage.camera;
    if (!cam || !_dome) return;
    if (cam.far === _lastFar) return;
    _lastFar = cam.far;
    if (cam.far < _radius * 1.02) {
      const s = (cam.far * 0.92) / _radius;
      _dome.scale.setScalar(s > 0.02 ? s : 0.02);
    } else if (_dome.scale.x !== 1) {
      _dome.scale.setScalar(1);
    }
  }

  /* ============================================================
     9 · presets & weather
     ============================================================ */
  Sky.presets = {
    dawn: 5.4, sunrise: 6.4, morning: 9, noon: 12.5, afternoon: 15.5,
    goldenHour: 17.6, sunset: 18.6, dusk: 19.4, night: 21.5, midnight: 1.0,
  };

  Sky.setWeather = function (w) {
    _weather = U.saturate(w === undefined ? 0.25 : w);
    if (_uni) _uni.uWeather.value = _weather;
    Env.weather = _weather;
    _envDirty = true;
    return _weather;
  };

  Sky.setMoonPhase = function (p) {
    _moonPhase = U.mod(p === undefined ? 0.68 : p, 1);
    if (_uni) _uni.uMoonPhase.value = _moonPhase;
    return _moonPhase;
  };

  /* ============================================================
     10 · setHours — the whole cycle, recomputed and applied.
     Called every frame by the host: allocation free.
     ============================================================ */
  let _nightVis = false, _dayVis = true, _nightLen = -1, _dayLen = -1;

  Sky.setHours = function (h) {
    if (!_built) return;
    h = +h;
    if (!isFinite(h)) h = 12;
    h = U.mod(h, 24);

    // day counter (for the moon phase) from wrap detection
    if (h < _lastH - 6) _dayIndex++;
    else if (h > _lastH + 6) _dayIndex--;
    _lastH = h;
    _moonPhase = U.mod(0.68 + _dayIndex / 29.53, 1);

    /* ---- 1 · geometry of sun & moon ---------------------------- */
    const H = (h - 12.5) * 15 * DEG;
    const sunElev = bodyDir(H, DECL, Env.sunDir);
    // the moon opposes the sun, with an 8 deg orbital inclination offset
    const moonElev = bodyDir(H + Math.PI, -DECL + 8 * DEG, Env.moonDir);
    const sunY = Env.sunDir.y;

    /* ---- 2 · scalar factors ------------------------------------ */
    let dayF = U.smoothstep(-5, 9, sunElev);
    dayF *= 0.90 + 0.10 * U.smoothstep(9, 70, sunElev);
    const duskF = 1 - U.smoothstep(2.5, 12.5, Math.abs(sunElev));
    const lampF = pickF(LAMP_K, h);
    const nightF = 1 - dayF;

    Env.hours = h;
    Env.dayF = dayF;
    Env.nightF = nightF;
    Env.duskF = duskF;
    Env.lampF = lampF;
    Env.sunUp = sunElev > 0;
    Env.sunElev = sunElev;
    Env.moonElev = moonElev;
    Env.moonPhase = _moonPhase;
    Env.weather = _weather;

    /* ---- 3 · colours ------------------------------------------- */
    pickC(ZEN_T, h, Env.zenithColor);
    pickC(MID_T, h, _cA);                       // mid band
    pickC(HOR_T, h, Env.horizonColor);
    pickC(SUN_T, h, Env.sunColor);
    // fog sits between the horizon and the mid band, a touch warmer at dusk
    Env.fogColor.lerpColors(Env.horizonColor, _cA, 0.32);
    if (duskF > 0.001) {
      _cB.lerpColors(Env.fogColor, Env.sunColor, 0.07 * duskF);
      Env.fogColor.copy(_cB);
    }

    /* ---- 4 · dome uniforms ------------------------------------- */
    _uni.uZenith.value.copy(Env.zenithColor);
    _uni.uMid.value.copy(_cA);
    _uni.uHorizon.value.copy(Env.horizonColor);
    // additive haze: pale version of the horizon, weather lifts it
    _cB.lerpColors(Env.horizonColor, _cA, 0.35);
    _uni.uHaze.value.copy(_cB);
    // sunset band: sun colour pulled toward the horizon, scaled down
    _cC.lerpColors(Env.sunColor, Env.horizonColor, 0.28);
    _cC.multiplyScalar(0.60);
    _uni.uBand.value.copy(_cC);
    _uni.uSunTint.value.copy(Env.sunColor);
    _uni.uSunDir.value.copy(Env.sunDir);
    _uni.uMoonDir.value.copy(Env.moonDir);
    _uni.uLowSun.value = 1 - U.smoothstep(0.02, 0.42, sunY);
    _uni.uSunI.value = U.smoothstep(-0.012, 0.014, sunY) * (0.80 + 0.60 * dayF);
    _uni.uHaloI.value = (0.30 + 0.85 * duskF) * U.smoothstep(-0.14, -0.005, sunY);
    _uni.uBandI.value = 0.10 * dayF + 1.15 * duskF;
    _uni.uStarF.value = U.smoothstep(1.5, -7.0, sunElev);
    _uni.uMoonI.value = U.smoothstep(-0.03, 0.10, Env.moonDir.y) * (0.25 + 0.85 * nightF);
    _uni.uMoonPhase.value = _moonPhase;
    _uni.uWeather.value = _weather;

    /* ---- 5 · lights ------------------------------------------- */
    const sunI = U.smoothstep(0, 5.0, sunElev) * U.lerp(0.75, 1.55, U.smoothstep(2, 62, sunElev));
    _sun.intensity = sunI;
    _sun.color.copy(Env.sunColor);
    _sun.position.copy(Env.sunDir).multiplyScalar(120);
    // below the horizon: no light, and stop spending a shadow pass
    _sun.shadow.autoUpdate = sunI > 0.001;

    const moonI = U.smoothstep(0.0, 0.16, Env.moonDir.y) * nightF * 0.30;
    _moon.intensity = moonI;
    _moon.position.copy(Env.moonDir).multiplyScalar(120);
    _moon.shadow.autoUpdate = moonI > 0.02;

    // hemisphere: sky above, bounced grass/sand below
    _cD.lerpColors(Env.horizonColor, Env.zenithColor, 0.45);
    _hemi.color.copy(_cD);
    _cE.lerpColors(_cGroundNight, _cGroundDay, U.smoothstep(0.02, 0.55, dayF));
    _hemi.groundColor.copy(_cE);
    _hemi.intensity = U.lerp(0.17, 0.62, dayF) + 0.06 * duskF;

    _amb.color.lerpColors(_cAmbNight, _cAmbDay, dayF);
    _amb.intensity = U.lerp(0.12, 0.05, dayF);

    /* ---- 6 · fog + exposure ----------------------------------- */
    _fog.color.copy(Env.fogColor);
    _fog.density = U.lerp(0.0026, 0.0018, dayF) + 0.0014 * duskF + 0.0030 * _weather;
    if (_scene && _scene.fog !== _fog) _scene.fog = _fog;

    _exposure = U.lerp(0.92, 1.0, dayF) + 0.28 * duskF;
    Env.exposure = _exposure;
    // the host may create the renderer after build(); pick it up late
    if (!_renderer && Stage.renderer) _renderer = Stage.renderer;
    if (_renderer) _renderer.toneMappingExposure = _exposure;

    /* ---- 7 · clouds & distant scenery tinting ----------------- */
    // clouds warm up from the whole low-sun window, not just civil twilight,
    // so they already carry gold-pink rims through the golden hour
    const duskMix = U.smoothstep(0.52, 0.01, sunY);
    // one smooth "is there still light on them" factor, driven straight off
    // the sun height so the fade to night never steps
    const litMix = U.smoothstep(-0.34, 0.06, sunY);
    for (let i = 0; i < _cloudMats.length; i++) {
      const v = i / 3;                                   // per-material variety
      _cB.lerpColors(_cCloudDay, _cCloudDusk, duskMix * (0.65 + 0.35 * v));
      _cC.lerpColors(_cCloudNight, _cB, litMix);
      const m = _cloudMats[i];
      m.color.copy(_cC);
      m.emissive.copy(_cCloudEmNight);
      m.emissiveIntensity = nightF * (0.55 + 0.25 * v);
    }
    if (_cirrusMat) {
      _cB.lerpColors(_cCloudNight, _cCloudDay, litMix);
      _cC.lerpColors(_cB, Env.sunColor, 0.50 * duskMix * litMix);
      _cirrusMat.color.copy(_cC);
      _cirrusMat.opacity = 0.10 + 0.14 * dayF + 0.16 * duskF;
    }
    // Distant scenery is air-light dominated: its emissive carries a fixed
    // fraction of the horizon colour (so the silhouette is legible at every
    // hour and can never out-shine the sky) while a dark albedo picks up the
    // sun for shape. Fog is off on these materials — this IS their fog.
    for (let i = 0; i < _ringMats.length; i++) {
      const far = i * 0.5;                               // 0, 0.5, 1
      const m = _ringMats[i];
      _cB.lerpColors(_cRock, Env.horizonColor, 0.06 + 0.12 * far);
      m.color.copy(_cB);
      m.emissive.copy(Env.horizonColor);
      m.emissiveIntensity = 0.45 + 0.13 * far;
    }

    /* ---- 8 · night-only / day-only visibility ----------------- */
    const nv = lampF > 0.15, dv = dayF > 0.2;
    const nl = Stage.nightOnly.length, dl = Stage.dayOnly.length;
    if (nv !== _nightVis || nl !== _nightLen) {
      for (let i = 0; i < nl; i++) Stage.nightOnly[i].visible = nv;
      _nightVis = nv; _nightLen = nl;
    }
    if (dv !== _dayVis || dl !== _dayLen) {
      for (let i = 0; i < dl; i++) Stage.dayOnly[i].visible = dv;
      _dayVis = dv; _dayLen = dl;
    }

    /* ---- 9 · night materials + halos, then the env map -------- */
    Mat.updateNight(lampF, Env.elapsed);
    TOWN.updateHalos(lampF, Env.elapsed);
    if (Sky.envMapEnabled) {
      if (Math.abs(h - _envBakedAt) > 0.3) _envDirty = true;
    } else if (_scene && _scene.environment) {
      _scene.environment = null;
      if (_envRT && _envRT.dispose) { _envRT.dispose(); _envRT = null; }
      _envBakedAt = -99;
    }
  };

  /* ---- small conveniences ------------------------------------- */
  Sky.preset = function (name) {
    const v = Sky.presets[name];
    Sky.setHours(v === undefined ? 12.5 : v);
    return v;
  };
  Sky.root = function () { return _root; };
  Sky.dispose = function () {
    if (_envRT && _envRT.dispose) _envRT.dispose();
    if (_pmrem && _pmrem.dispose) _pmrem.dispose();
    _envRT = null; _pmrem = null;
  };

  console.log('[TOWN] sky ready');
})(window);

/* ---- probe results ----------------------------------------------------------
   All measured headless (Chromium + real WebGL, swiftshader) with tools/probe.sh.
   Zero console errors / page errors in every run below; the only warning is the
   pre-existing "three.min.js is deprecated" notice from the vendor bundle.

   A · exports
     ./tools/probe.sh --files js/world/sky.js --eval "return Object.keys(TOWN.Sky)"
     -> envMapEnabled, build, presets, setWeather, setMoonPhase, setHours,
        preset, root, dispose

   B · budget (one build, returned root group)
     meshes 19 · geometries 19 · materials 9 · lights 4 · dynamicNodes 20
     triangles 5784 total =  dome 2208 (1 draw call, 48x24)
                          + clouds 2260 (12 merged clusters, 5-8 blobs each)
                          + cirrus   36 (3 sheets)
                          + scenery 1280 (3 merged rings, 36 islands)
     clouds + cirrus + scenery = 3576  (budget 4000)
     materials: sky_dome (ShaderMaterial) + sky_cloud_0..3 + cirrus basic
                + sky_far_0..2 = 9      (budget 10)
     setHours() cost: 3.4 us / call, 5000-call loop (budget 250 us) · 0 allocations

   C · 24 h environment table
     h  dayF  lampF duskF up  sunDir.y horizon  sunI moonI hemi expo  fogDensity
      0 0.000 1.000 0.000  0   -0.828  #26304e  0.00 0.30 0.17 0.92  0.00335
      1 0.000 1.000 0.000  0   -0.828  #273150  0.00 0.30 0.17 0.92  0.00335
      2 0.000 1.000 0.000  0   -0.769  #283252  0.00 0.30 0.17 0.92  0.00335
      3 0.000 1.000 0.000  0   -0.654  #283354  0.00 0.30 0.17 0.92  0.00335
      4 0.000 1.000 0.000  0   -0.491  #293456  0.00 0.30 0.17 0.92  0.00335
      5 0.000 0.952 0.000  0   -0.292  #41486b  0.00 0.30 0.17 0.92  0.00335
      6 0.014 0.670 0.941  0   -0.069  #826475  0.00 0.28 0.23 1.18  0.00466
      7 0.900 0.030 0.248  1    0.161  #be8b7c  0.78 0.00 0.59 1.06  0.00298
      8 0.913 0.000 0.000  1    0.383  #d7b49e  0.97 0.00 0.58 0.99  0.00262
      9 0.940 0.000 0.000  1    0.582  #dccdc2  1.22 0.00 0.59 1.00  0.00260
     10 0.971 0.000 0.000  1    0.745  #d7d7dc  1.44 0.00 0.61 1.00  0.00257
     11 0.992 0.000 0.000  1    0.860  #d2dded  1.55 0.00 0.62 1.00  0.00256
     12 0.999 0.000 0.000  1    0.920  #d3e3f2  1.55 0.00 0.62 1.00  0.00255
     13 0.999 0.000 0.000  1    0.920  #d5e5f2  1.55 0.00 0.62 1.00  0.00255
     14 0.992 0.000 0.000  1    0.860  #d6e2ed  1.55 0.00 0.62 1.00  0.00256
     15 0.971 0.000 0.000  1    0.745  #d8dde1  1.44 0.00 0.61 1.00  0.00257
     16 0.940 0.000 0.000  1    0.582  #dcd8cd  1.22 0.00 0.59 1.00  0.00260
     17 0.913 0.070 0.000  1    0.383  #e2cba8  0.97 0.00 0.58 0.99  0.00262
     18 0.900 0.280 0.248  1    0.161  #e2ac74  0.78 0.00 0.59 1.06  0.00298
     19 0.014 0.600 0.941  0   -0.069  #ca8156  0.00 0.28 0.23 1.18  0.00466
     20 0.000 0.918 0.000  0   -0.292  #97615b  0.00 0.30 0.17 0.92  0.00335
     21 0.000 0.995 0.000  0   -0.491  #573f54  0.00 0.30 0.17 0.92  0.00335
     22 0.000 1.000 0.000  0   -0.654  #38344e  0.00 0.30 0.17 0.92  0.00335
     23 0.000 1.000 0.000  0   -0.769  #2a304a  0.00 0.30 0.17 0.92  0.00335

   D · asserts (481-sample sweep, h = 0 .. 24 step 0.05)
     NaN / non-finite values anywhere in Env, lights, fog ...... 0
     sunLight.intensity != 0 while sunDir.y <= 0 ............... 0 occurrences
     dayF peak hour ........................................... 12 (0.999)
     max dayF over 20:00-05:00 ................................ 0.0000
     horizonColor worst step per 0.05 h ....................... 0.0173  (< 0.020)
       (at h 6.35; all four Env colours worst = 0.0175)
     worst adjacent-INTEGER-hour colour jump .................. 0.2979  (< 0.35)
     lampF: 6.9->0.100  7.0->0.030  7.3->0  12->0  17.6->0.170
            18.6->0.474  19.0->0.600  19.2->0.700  21.5->1.000
     Mat.lamp emissiveIntensity: 7.0 -> 0.00 (hard off, lampF below its 0.05
            threshold) · 12 -> 0.00 · 17.6 -> 1.36 (visibly on at golden hour)
            · 19.2 -> 2.40 (saturated) — hysteresis confirmed
     cloud radius over a 50-min drift, fixed wind ............. 116.6 .. 363.9
     cloud radius over an 83-min drift, Dynamics rotating wind . 83.8 .. 378.2
       (TOWN.Dynamics.windDir is a function(t)->radians; that shape, a bare
        angle, a Vector2/Vector3 and garbage were all exercised: 0 non-finite
        positions, ticker never disabled)
     PMREM scene.environment populated ........................ true

   E · real render test — /tmp/skytest.html (NOT in the repo): this sky + 9 grey
       Geo.chamferBox blocks on a 600x600 ground plane, 960x600, ACESFilmic,
       outputColorSpace SRGB, useLegacyLights true, PCFSoft shadows.
       Mean channel values read back in-page from renderer.domElement via a 2-D
       canvas drawImage + getImageData.  "stars" = pixels with luma > 90 in the
       upper third (192 000 px).
        hour   meanLum  upperLum  lowerLum  meanR-meanB   stars>90 / >140 / >180
         1.0    26.71     16.62     31.75      -44.54      395 /  245 /  124
         5.4    55.14     47.69     58.87      -47.24      481 /  269 /  140
         6.4   121.52    115.37    124.60       -9.00      all sky bright
         9.0   195.22    192.14    196.76      -11.35      all sky bright
        12.5   208.12    199.63    212.36      -22.56      all sky bright
        15.5   200.08    194.04    203.10      -14.56      all sky bright
        17.6   182.43    187.77    179.76      +25.02      all sky bright
        18.6   166.33    176.44    161.28      +67.32      all sky bright
        19.4   115.00    118.67    113.16      +63.85      189428 / 507 / 250
        21.5    38.17     33.33     40.59      -19.72      443 /  267 /  145
     -> noon / midnight mean-luminance ratio = 7.79   (requirement >= 2.2)
     -> midnight star pixels in the upper third = 395 (non-zero)
     -> warmth at 18.6 (+67.32) minus warmth at noon (-22.56) = +89.88 warmer
     Shots: /tmp/sky_noon.png /tmp/sky_dusk.png /tmp/sky_midnight.png
            /tmp/sky_sunfacing.png /tmp/sky_moonfacing.png

   F · pixel-level checks on those shots
     sun disc at 18.6, camera facing the sun: solid disc 28x28 px (~1.0 deg
       radius at 12.6 px/deg), core #fff3e0 luma 244, soft limb over ~5 px,
       warm halo falling 244 -> 229 over 4.5 deg, horizon row peaks at the sun
       azimuth (#fde1bb) and falls to #f0c896 at +-33 deg -> the sky is
       directional, not a flat gradient.
     moon at 1.0, camera facing the moon, phase 0.714: luma across the disc
       117,119,...,130 | 216,223 x12,220,197 | 155,154,...117
       = earthshine limb (117-130) -> sharp crescent terminator -> lit face 223
       -> soft glow. Moon is the brightest object in the night frame.
     sky gradient column (pure sky): max neighbour-row 8-bit jump 1, 28 stepped
       rows over 300 -> dithered, no banding.
     star field (upper 55 % of an upward night view): 142 blobs, nearest-
       neighbour CV 0.60 (Poisson-like, i.e. natural, not a grid), blob size
       median 3 px / max 49 px -> real magnitude variety, milky-way clumping.
     distant-scenery silhouette contrast (sky luma - land luma, per ring):
       09:00  +16 / +19 /  +5      12:30  +14 /  +7 /  -2 (hazed out, by design)
       17:36  +20 / +34 / +22      18:36  +20 / +50 / +31
       19:24  +18 / +54 / +35      21:30   +5 / +19 / +11      01:00 +2/+9/+4

   G · animation: probe --anim 1500 on the live page reports
       animBytesDiffer = true (cloud drift + star twinkle + lamp flicker keep
       running with the clock paused, because the ticker is registered
       {always:true}).

   H · final light numbers (useLegacyLights = true)
     sunLight   DirectionalLight, colour = Env.sunColor, r=120 along sunDir,
                intensity 0 (below horizon) .. 1.55 (solar noon 68 deg),
                0.78 at 09:00-equivalent elevation 9 deg, 0.13 at sunset;
                shadow 2048^2, ortho +-69 (islandRadius 60 x 1.15), near 1,
                far 400, bias -0.0005, normalBias 0.02
     moonLight  DirectionalLight 0x9fb8e8, r=120 along moonDir, 0 .. 0.30,
                shadow 1024^2, bias -0.0007, normalBias 0.035
     hemi       0.17 (night) .. 0.62 (noon) + 0.06 * duskF,
                sky = mix(horizon, zenith, .45), ground = grass/sand mix by day
                -> 0x0a1020 at night
     ambient    0.05 (day) .. 0.12 (night)
     exposure   0.92 (night) .. 1.00 (noon), +0.28 * duskF -> 1.24 at sunset
     fog        FogExp2, colour = Env.fogColor,
                density 0.00255 (noon) .. 0.00335 (night) .. 0.00466 (dusk)
                at the default weather 0.25
   --------------------------------------------------------------------------- */
