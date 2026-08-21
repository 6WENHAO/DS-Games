/**
 * 着色系统：统一的大气 / 高度雾 / 太阳散射，加上体素专用材质。
 *
 * 之所以自己写雾：巨构的“震撼”几乎全部由大气透视承担 ——
 * 顶端必须消失在雾里，底端必须消失在更浓的雾里，
 * 而且雾的颜色必须等于同方向的天空颜色，才会出现真正的“空气感”。
 */

import * as THREE from 'three';

export const ATMO_GLSL = /* glsl */`
uniform vec3  uSunDir;
uniform vec3  uSunCol;
uniform vec3  uZenithCol;
uniform vec3  uHorizonCol;
uniform vec3  uGroundCol;
uniform float uFogDensity;
uniform float uFogHeight;
uniform float uFogBase;
uniform float uHaze;
uniform float uSkyGain;

vec3 dsSky(vec3 rd) {
  float h = rd.y;
  vec3 c = mix(uHorizonCol, uZenithCol, pow(clamp(h, 0.0, 1.0), 0.42));
  c = mix(uGroundCol, c, smoothstep(-0.16, 0.02, h));
  float sd = max(dot(rd, uSunDir), 0.0);
  c += uSunCol * (pow(sd, 2200.0) * 16.0
                + pow(sd, 26.0) * 0.55 * uHaze
                + pow(sd, 5.0)  * 0.16 * uHaze);
  return c * uSkyGain;
}

/**
 * 雾用的天空色：去掉太阳本体那一项。
 * 否则近处几何体上薄薄一层雾也会把太阳的高光带过来，逆光时整帧曝掉。
 */
vec3 dsSkyFog(vec3 rd) {
  float h = rd.y;
  vec3 c = mix(uHorizonCol, uZenithCol, pow(clamp(h, 0.0, 1.0), 0.42));
  c = mix(uGroundCol, c, smoothstep(-0.16, 0.02, h));
  float sd = max(dot(rd, uSunDir), 0.0);
  c += uSunCol * (pow(sd, 26.0) * 0.30 * uHaze + pow(sd, 5.0) * 0.14 * uHaze);
  return c * uSkyGain;
}

float dsFogAmount(vec3 camPos, vec3 wp) {
  vec3 d = wp - camPos;
  float dist = length(d);
  float k  = 1.0 / max(uFogHeight, 1.0);
  float y0 = camPos.y, y1 = wp.y;
  float dy = y1 - y0;
  float e0 = exp(-(y0 - uFogBase) * k);
  float integral;
  if (abs(dy) < 0.5) {
    integral = uFogDensity * e0 * dist;
  } else {
    float e1 = exp(-(y1 - uFogBase) * k);
    integral = uFogDensity * dist * (e0 - e1) / (dy * k);
  }
  return 1.0 - exp(-clamp(integral, 0.0, 40.0));
}

vec3 dsApplyAtmosphere(vec3 color, vec3 wp) {
  vec3 rd = normalize(wp - cameraPosition);
  float f = dsFogAmount(cameraPosition, wp);
  return mix(color, dsSkyFog(rd), f);
}
`;

export function createAtmoUniforms() {
  return {
    uSunDir: { value: new THREE.Vector3(0.4, 0.32, 0.86).normalize() },
    uSunCol: { value: new THREE.Color(1.0, 0.62, 0.34) },
    uZenithCol: { value: new THREE.Color(0.055, 0.105, 0.21) },
    uHorizonCol: { value: new THREE.Color(0.52, 0.36, 0.30) },
    uGroundCol: { value: new THREE.Color(0.045, 0.05, 0.062) },
    uFogDensity: { value: 0.0021 },
    uFogHeight: { value: 300.0 },
    uFogBase: { value: 0.0 },
    uHaze: { value: 1.0 },
    uSkyGain: { value: 1.0 },
    uNight: { value: 0.35 },
    uEmiScale: { value: 1.0 },
    uAoStrength: { value: 1.0 },
    // 环境底光 + 城市人工光的近地反射（否则天盖之下、峡谷深处会全黑）
    uAmbient: { value: new THREE.Color(0.030, 0.034, 0.045) },
    uBounceCol: { value: new THREE.Color(0.16, 0.085, 0.035) },
    uBounceH: { value: 55.0 },
    uBounceY: { value: 0.0 },
  };
}

const WORLDPOS_INJECT = /* glsl */`
#include <worldpos_vertex>
{
  vec4 dsWp = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    dsWp = instanceMatrix * dsWp;
  #endif
  vAtmWorld = ( modelMatrix * dsWp ).xyz;
}
`;

/** 给任意 three 材质接上统一大气（替换 three 自带的 fog） */
export function patchAtmosphere(material, uni) {
  material.fog = false;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    for (const k in uni) shader.uniforms[k] = uni[k];
    shader.vertexShader = 'varying vec3 vAtmWorld;\n' + shader.vertexShader
      .replace('#include <worldpos_vertex>', WORLDPOS_INJECT);
    shader.fragmentShader = 'varying vec3 vAtmWorld;\n' + ATMO_GLSL + '\n' + shader.fragmentShader
      .replace(/vec3 outgoingLight = ([^;]+);/,
        'vec3 outgoingLight = $1;\n\toutgoingLight = dsApplyAtmosphere( outgoingLight, vAtmWorld );');
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => 'dsAtmo|' + (key ? key.call(material) : material.type);
  return material;
}

/**
 * 体素材质：顶点属性携带 颜色 / AO / 自发光(基础+夜间增益)
 * 用 MeshLambertMaterial 打底，换来 three 的阴影贴图与光照管线。
 */
export function createVoxelMaterial(uni) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.fog = false;
  mat.onBeforeCompile = (shader) => {
    for (const k in uni) shader.uniforms[k] = uni[k];
    shader.vertexShader = `
      attribute vec3 aCol;
      attribute float aAo;
      attribute vec2 aEmi;
      varying vec3 vVoxCol;
      varying float vVoxAo;
      varying float vVoxEmi;
      varying vec3 vAtmWorld;
      uniform float uNight;
      uniform float uEmiScale;
      vec3 dsSrgbToLinear(vec3 c) {
        return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
      }
    ` + shader.vertexShader
      .replace('#include <worldpos_vertex>', WORLDPOS_INJECT)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vVoxCol = dsSrgbToLinear(aCol);
        vVoxAo  = aAo;
        // 属性里存的是 强度/4，这里还原；系数偏低是因为整体曝光被抬高了
        vVoxEmi = (aEmi.x + aEmi.y * uNight) * 1.3 * uEmiScale;
      `);

    shader.fragmentShader = `
      varying vec3 vVoxCol;
      varying float vVoxAo;
      varying float vVoxEmi;
      varying vec3 vAtmWorld;
      uniform float uAoStrength;
      uniform vec3 uAmbient;
      uniform vec3 uBounceCol;
      uniform float uBounceH;
      uniform float uBounceY;
    ` + ATMO_GLSL + '\n' + shader.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( diffuse * vVoxCol, opacity );')
      .replace('vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive + vVoxCol * vVoxEmi;')
      .replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        float dsAo = mix(1.0, vVoxAo, uAoStrength);
        reflectedLight.indirectDiffuse *= dsAo;
        reflectedLight.directDiffuse *= mix(1.0, dsAo, 0.4);
        // 城市自己的光：钠灯、招牌、灯带在近地面形成的暖反射
        float dsB = exp(-max(vAtmWorld.y - uBounceY, 0.0) / uBounceH);
        reflectedLight.indirectDiffuse += (uAmbient + uBounceCol * dsB) * diffuseColor.rgb * dsAo;
      `)
      .replace(/vec3 outgoingLight = ([^;]+);/,
        'vec3 outgoingLight = $1;\n\toutgoingLight = dsApplyAtmosphere( outgoingLight, vAtmWorld );');
  };
  mat.customProgramCacheKey = () => 'dsVoxel';
  return mat;
}

/** 天空穹顶：与雾共用同一个 dsSky，保证地平线严丝合缝 */
export function createSky(uni) {
  const geo = new THREE.SphereGeometry(6000, 40, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: uni,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform vec3 uZenithCol;
      uniform vec3 uHorizonCol;
      uniform vec3 uGroundCol;
      uniform float uHaze;
      uniform float uSkyGain;
      void main() {
        vec3 rd = normalize(vDir);
        float h = rd.y;
        vec3 c = mix(uHorizonCol, uZenithCol, pow(clamp(h, 0.0, 1.0), 0.42));
        c = mix(uGroundCol, c, smoothstep(-0.16, 0.02, h));
        float sd = max(dot(rd, uSunDir), 0.0);
        c += uSunCol * (pow(sd, 2200.0) * 16.0
                      + pow(sd, 26.0) * 0.55 * uHaze
                      + pow(sd, 5.0)  * 0.16 * uHaze);
        gl_FragColor = vec4(c * uSkyGain, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

/** 程序化云层贴图（多层值噪声，做出层积云的丝絮感） */
export function makeCloudTexture(size = 512, seed = 7) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const hash = (x, y) => {
    let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2246822519, 1);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  const vn = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const w = (a, b) => ((a % p) + p) % p;
    const a = hash(w(xi, p), w(yi, p)), b = hash(w(xi + 1, p), w(yi, p));
    const c = hash(w(xi, p), w(yi + 1, p)), d = hash(w(xi + 1, p), w(yi + 1, p));
    return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, f = 4;
      for (let o = 0; o < 6; o++) {
        v += vn((x / size) * f, (y / size) * f, f) * amp;
        amp *= 0.52; f *= 2;
      }
      // 拉长成层状
      let v2 = 0, amp2 = 0.5, f2 = 3;
      for (let o = 0; o < 4; o++) {
        v2 += vn((x / size) * f2 * 3.2, (y / size) * f2 * 0.5, f2) * amp2;
        amp2 *= 0.5; f2 *= 2;
      }
      const d = Math.min(1, Math.max(0, v * 0.62 + v2 * 0.55));
      const i = (y * size + x) * 4;
      const b = Math.round(d * 255);
      img.data[i] = b; img.data[i + 1] = b; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** 云层：巨核穿云而过 —— 这是“公里级”最廉价也最有效的证据 */
export function createCloudDeck(uni, tex) {
  // 全部放在 700 以上：让沙盘视角（相机在 700 以下）始终能看清整个巨构，
  // 同时保证第一视角抬头时，塔身确实是插进云里的。
  const layers = [
    { y: 700, scale: 1 / 2600, opacity: 0.46, thresh: 0.60, speed: 0.0020 },
    { y: 940, scale: 1 / 3800, opacity: 0.54, thresh: 0.56, speed: 0.0014 },
    { y: 1180, scale: 1 / 5200, opacity: 0.60, thresh: 0.53, speed: 0.0009 },
    { y: 1360, scale: 1 / 6800, opacity: 0.44, thresh: 0.58, speed: 0.0006 },
  ];
  const group = new THREE.Group();
  const mats = [];
  for (const L of layers) {
    const u = Object.assign({}, uni, {
      uMap: { value: tex },
      uScale: { value: L.scale },
      uOffset: { value: new THREE.Vector2(Math.random(), Math.random()) },
      uOpacity: { value: L.opacity },
      uThresh: { value: L.thresh },
      uLayerY: { value: L.y },
      uCloudDark: { value: new THREE.Color(0.10, 0.11, 0.14) },
      uCloudLit: { value: new THREE.Color(0.9, 0.78, 0.7) },
    });
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vAtmWorld;
        void main() {
          vAtmWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vAtmWorld;
        uniform sampler2D uMap;
        uniform float uScale, uOpacity, uThresh, uLayerY;
        uniform vec2 uOffset;
        uniform vec3 uCloudDark, uCloudLit;
        ${ATMO_GLSL}
        void main() {
          // UV 取自世界坐标：云层可以跟着相机走，图案却锁在世界里
          vec2 uv = vAtmWorld.xz * uScale + uOffset;
          float d = texture2D(uMap, uv).r;
          float a = smoothstep(uThresh, uThresh + 0.30, d);
          // 相机接近 / 越过某层云之后让它逐渐让开视线：
          // 站在地面抬头时云层是实的（塔身确实插进云里），
          // 升到云上或拉远俯瞰时云层退成薄雾，不会把整座巨构糊没。
          a *= uOpacity * (1.0 - smoothstep(-140.0, 260.0, cameraPosition.y - uLayerY));
          if (a < 0.005) discard;
          vec3 rd = normalize(vAtmWorld - cameraPosition);
          float sd = max(dot(rd, uSunDir), 0.0);
          vec3 col = mix(uCloudDark, uCloudLit, smoothstep(uThresh, 1.0, d));
          col += uSunCol * pow(sd, 9.0) * 0.7;
          col = mix(col, dsSkyFog(rd), dsFogAmount(cameraPosition, vAtmWorld));
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = L.y;
    mesh.renderOrder = 20;
    mesh.frustumCulled = false;
    group.add(mesh);
    mats.push({ mat: u, speed: L.speed, mesh, y: L.y });
  }
  group.userData.layers = mats;
  return group;
}

/** 加性光柱：天盖光井洒下的光、以及顶冠探照灯 */
export function createBeamMaterial(uni, color, softness = 1.6) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({}, uni, {
      uBeamCol: { value: new THREE.Color(color) },
      uIntensity: { value: 1.0 },
      uSoft: { value: softness },
    }),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNrm;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec3 n = mat3(modelMatrix) * normal;
        vNrm = length(n) > 1e-6 ? normalize(n) : vec3(0.0, 1.0, 0.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNrm;
      uniform vec3 uBeamCol;
      uniform float uIntensity, uSoft;
      ${ATMO_GLSL}
      void main() {
        vec3 vd = normalize(cameraPosition - vWorld);
        // 注意 max(0.0, ...)：dot 因浮点误差略微超过 1 时，pow(负数, 小数) 会产出 NaN，
        // 而 NaN 一旦进入 HDR 缓冲，就会被 bloom 抹遍全屏 —— 整帧变黑。
        float edge = pow(max(0.0, 1.0 - abs(dot(vd, vNrm))), uSoft);
        float fade = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        float a = clamp(edge * fade * uIntensity, 0.0, 4.0);
        gl_FragColor = vec4(uBeamCol * a, a);
      }
    `,
  });
}

export const SKY_PRESETS = {
  // 注意：巨构会挡掉城市 3/4 的阳光（天盖 + 巨跨 + 本体自遮蔽），
  // 所以这里的曝光普遍偏高 —— 画面的主体本来就是"阴影里的城市"。
  dusk: {
    name: '斜阳',
    sunEl: 24, sunAz: 250,
    sunCol: [1.0, 0.62, 0.36], sunInt: 3.2,
    zenith: [0.05, 0.10, 0.22], horizon: [0.66, 0.38, 0.26], ground: [0.04, 0.043, 0.056],
    hemiSky: [0.30, 0.39, 0.58], hemiGround: [0.13, 0.11, 0.09], hemiInt: 1.3,
    fog: 0.0026, fogH: 300, haze: 1.15, night: 0.42, skyGain: 1.0, exposure: 1.85,
    ambient: [0.046, 0.053, 0.068], bounce: [0.16, 0.084, 0.034], bounceH: 58,
  },
  sunset: {
    name: '日落',
    sunEl: 5.5, sunAz: 256,
    sunCol: [1.0, 0.46, 0.20], sunInt: 3.2,
    zenith: [0.04, 0.075, 0.18], horizon: [0.74, 0.34, 0.20], ground: [0.035, 0.036, 0.046],
    hemiSky: [0.26, 0.32, 0.48], hemiGround: [0.13, 0.10, 0.075], hemiInt: 1.2,
    fog: 0.0030, fogH: 280, haze: 1.5, night: 0.62, skyGain: 1.0, exposure: 2.05,
    ambient: [0.042, 0.046, 0.058], bounce: [0.19, 0.10, 0.04], bounceH: 60,
  },
  night: {
    name: '深夜',
    sunEl: -8, sunAz: 300,
    sunCol: [0.34, 0.44, 0.72], sunInt: 0.6,
    zenith: [0.012, 0.02, 0.045], horizon: [0.08, 0.10, 0.17], ground: [0.012, 0.014, 0.02],
    hemiSky: [0.11, 0.145, 0.26], hemiGround: [0.05, 0.045, 0.04], hemiInt: 0.62,
    fog: 0.0030, fogH: 260, haze: 0.5, night: 1.0, skyGain: 1.0, exposure: 2.45,
    ambient: [0.020, 0.026, 0.042], bounce: [0.20, 0.104, 0.040], bounceH: 66,
  },
  overcast: {
    name: '阴天',
    sunEl: 34, sunAz: 190,
    sunCol: [0.72, 0.75, 0.8], sunInt: 1.05,
    zenith: [0.28, 0.31, 0.35], horizon: [0.5, 0.52, 0.55], ground: [0.1, 0.1, 0.11],
    hemiSky: [0.5, 0.54, 0.6], hemiGround: [0.12, 0.12, 0.12], hemiInt: 1.3,
    fog: 0.0042, fogH: 340, haze: 0.35, night: 0.28, skyGain: 1.0, exposure: 1.55,
    ambient: [0.09, 0.098, 0.112], bounce: [0.09, 0.055, 0.026], bounceH: 50,
  },
  dawn: {
    name: '清晨',
    sunEl: 11, sunAz: 76,
    sunCol: [1.0, 0.78, 0.58], sunInt: 2.4,
    zenith: [0.07, 0.13, 0.26], horizon: [0.62, 0.55, 0.45], ground: [0.04, 0.045, 0.055],
    hemiSky: [0.3, 0.38, 0.52], hemiGround: [0.1, 0.09, 0.08], hemiInt: 1.1,
    fog: 0.0034, fogH: 220, haze: 1.0, night: 0.4, skyGain: 1.0, exposure: 1.80,
    ambient: [0.040, 0.046, 0.058], bounce: [0.13, 0.068, 0.028], bounceH: 54,
  },
  noon: {
    name: '正午',
    sunEl: 62, sunAz: 150,
    sunCol: [1.0, 0.96, 0.9], sunInt: 2.8,
    zenith: [0.13, 0.24, 0.46], horizon: [0.55, 0.62, 0.72], ground: [0.06, 0.065, 0.075],
    hemiSky: [0.4, 0.5, 0.68], hemiGround: [0.14, 0.13, 0.12], hemiInt: 1.2,
    fog: 0.0018, fogH: 380, haze: 0.6, night: 0.05, skyGain: 1.0, exposure: 1.45,
    ambient: [0.058, 0.065, 0.080], bounce: [0.07, 0.043, 0.022], bounceH: 46,
  },
};

export function sunDirFrom(elDeg, azDeg) {
  const el = (elDeg * Math.PI) / 180, az = (azDeg * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  ).normalize();
}
