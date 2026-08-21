// Cinematic post stack.
//
//   scene(HDR+depth) ─┐
//   sky/clouds  ──────┼─> composite (volumetric height fog, valley mist, god rays)
//                     │        │
//                     │        ├─> bloom mip chain
//                     │        └─> depth of field (thin-lens CoC, disc bokeh)
//                     └───────────────> final grade (ACES, saturation, vignette, grain, CA)

import * as THREE from 'three';
import { GLSL_NOISE } from './noise.js';
import { U, pick } from './uniforms.js';
import { blit, fsMaterial, makeRT } from './fsq.js';

// Any single non-finite pixel in the HDR chain gets smeared into a big rectangle by the
// bloom mip chain and then clamps to black, so every stage sanitises what it reads.
const SANITISE = /* glsl */ `
  vec3 finite3(vec3 c, float lim){
    bool ok = (c == c);                 // false if any component is NaN
    c = ok ? c : vec3(0.0);
    return clamp(c, vec3(0.0), vec3(lim));
  }
`;

const DEPTH_HELPERS = /* glsl */ `
  uniform float uNear;
  uniform float uFar;
  uniform mat4 uInvVP;
  uniform vec3 uCamPos;

  float linDepth(float d){
    float z = d * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  vec3 worldFromDepth(vec2 uv, float d){
    vec4 p = uInvVP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    return p.xyz / p.w;
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uScene;
  uniform sampler2D uDepth;
  uniform sampler2D uSky;
  uniform float uTime;
  uniform vec2 uCloudWind;

  uniform vec3 uFogColor;
  uniform vec3 uMistColor;
  uniform float uFogDensity;
  uniform float uFogHeight;
  uniform float uFogGround;
  uniform float uFogScale;

  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform float uFlash;
  uniform vec2 uSunScreen;
  uniform float uSunVisible;
  uniform float uGodray;

  ${GLSL_NOISE}
  ${DEPTH_HELPERS}
  ${SANITISE}

  #ifndef GODRAY_STEPS
  #define GODRAY_STEPS 10
  #endif

  void main(){
    float d = texture2D(uDepth, vUv).x;
    bool isSky = d >= 0.9999995;
    vec3 col = finite3(isSky ? texture2D(uSky, vUv).rgb : texture2D(uScene, vUv).rgb, 4096.0);

    vec3 wp = worldFromDepth(vUv, min(d, 0.9999));
    vec3 rd = normalize(wp - uCamPos);
    float dist = isSky ? 9000.0 : min(length(wp - uCamPos), 30000.0);

    // ---------- aerial perspective: exponential height fog, integrated along the ray
    float H = max(uFogHeight, 2.0);
    float dens = uFogDensity * uFogScale * 0.0021;
    float ry = rd.y;
    float camRel = min(exp(-uCamPos.y / H), 3.0);
    float fogAmt;
    if (abs(ry) < 1e-2) fogAmt = dens * camRel * dist;
    else fogAmt = dens * (H / ry) * camRel * (1.0 - exp(clamp(-ry * dist / H, -40.0, 40.0)));
    fogAmt = clamp(fogAmt, 0.0, 60.0);

    // ---------- ground mist: a low, wispy layer that pools in the hollows.
    // Same analytic integral as above but with a short scale height, and the density term
    // is clamped so being *inside* the mist never white-outs the frame.
    float Hm = 9.0;
    float mistRef = clamp(exp(-(uCamPos.y - 6.0) / Hm), 0.0, 2.6);
    float mdens = uFogGround * uFogScale * 0.0016;
    float mistAmt;
    if (abs(ry) < 1e-2) mistAmt = mdens * mistRef * dist;
    else mistAmt = mdens * (Hm / ry) * mistRef * (1.0 - exp(clamp(-ry * dist / Hm, -40.0, 40.0)));
    mistAmt = clamp(mistAmt, 0.0, 60.0);
    vec3 mp = uCamPos + rd * min(dist, 240.0) * 0.5;
    float wisp = fbm2(mp.xz * 0.0075 + uCloudWind * 3.0 + vec2(uTime * 0.011, -uTime * 0.008));
    mistAmt *= 0.35 + 1.45 * wisp;

    float total = clamp(fogAmt + mistAmt, 0.0, 60.0);
    float f = 1.0 - exp(-total);

    float mu = clamp(dot(rd, uSunDir), 0.0, 1.0);
    vec3 fogCol = mix(uFogColor, uMistColor, clamp(mistAmt / max(total, 1e-4), 0.0, 1.0));
    // forward scattering: the haze lights up around the sun
    fogCol = mix(fogCol, uSunColor * (0.9 + 0.5 * uSunIntensity), pow(mu, 5.0) * 0.55);
    fogCol *= 0.75 + 0.5 * uSunIntensity * 0.5;
    fogCol += uSunColor * uFlash * 0.5;

    float fw = isSky ? f * 0.45 * smoothstep(0.22, -0.05, rd.y) : f;
    col = mix(col, fogCol, clamp(fw, 0.0, 1.0));

    // ---------- god rays: march toward the sun, collecting clear sky
    #if GODRAY_STEPS > 0
    if (uSunVisible > 0.5 && uGodray > 0.001) {
      vec2 delta = uSunScreen - vUv;
      float len = length(delta);
      vec2 stepv = delta / float(GODRAY_STEPS);
      float acc = 0.0;
      vec2 uvp = vUv;
      float jitter = nvalRaw(gl_FragCoord.xy * 0.77).g;
      uvp += stepv * jitter * 0.9;
      for (int i = 0; i < GODRAY_STEPS; i++){
        uvp += stepv;
        vec2 cl = clamp(uvp, vec2(0.0), vec2(1.0));
        float dd = texture2D(uDepth, cl).x;
        float open = step(0.9999995, dd) * texture2D(uSky, cl).a;
        acc += open;
      }
      acc /= float(GODRAY_STEPS);
      float shaft = clamp(acc * exp(-len * 1.55) * uGodray, 0.0, 4.0);
      col += uSunColor * uSunIntensity * shaft * (0.30 + 0.85 * f);
    }
    #endif

    gl_FragColor = vec4(col, 1.0);
  }
`;

// golden-angle disc: an even, rotation-free bokeh kernel
function discVectors(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt((i + 0.5) / n);
    out.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  return out;
}

const MAX_TAPS = 40;
const DOF_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uColor;
  uniform sampler2D uDepth;
  uniform vec2 uTexel;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uMaxCoC;

  ${DEPTH_HELPERS}
  ${SANITISE}

  #ifndef TAPS
  #define TAPS 24
  #endif

  uniform vec2 uDisc[${MAX_TAPS}];

  float cocOf(float z){
    return clamp((1.0 - uFocus / max(z, 0.05)) * uAperture, -1.0, 1.0) * uMaxCoC;
  }

  void main(){
    float z = linDepth(texture2D(uDepth, vUv).x);
    float c = cocOf(z);
    float ac = abs(c);
    vec3 centre = finite3(texture2D(uColor, vUv).rgb, 4096.0);

    if (ac < 0.75) {
      gl_FragColor = vec4(centre, 1.0);
      return;
    }

    vec3 sum = centre;
    float wsum = 1.0;
    for (int i = 0; i < TAPS; i++){
      vec2 off = uDisc[i] * ac * uTexel;
      vec2 uv = clamp(vUv + off, vec2(0.0), vec2(1.0));
      vec3 s = finite3(texture2D(uColor, uv).rgb, 4096.0);
      float zs = linDepth(texture2D(uDepth, uv).x);
      float cs = abs(cocOf(zs));
      // a sample only spills onto us if its own blur circle reaches this pixel
      float reach = smoothstep(0.0, 1.0, (cs / max(ac, 1e-3)) * 1.35 - length(uDisc[i]) * 0.9);
      float w = mix(0.08, 1.0, reach);
      // brighter samples bloom into the bokeh
      w *= 1.0 + 0.5 * max(max(s.r, s.g), s.b);
      sum += s * w;
      wsum += w;
    }
    gl_FragColor = vec4(sum / wsum, 1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uColor;
  uniform float uThreshold;
  uniform float uSoft;
  ${SANITISE}
  void main(){
    vec3 c = finite3(texture2D(uColor, vUv).rgb, 512.0);
    float l = max(max(c.r, c.g), c.b);
    float k = pow(max(l - uThreshold, 0.0) / max(l, 1e-3), uSoft);
    gl_FragColor = vec4(clamp(c * k, vec3(0.0), vec3(512.0)), 1.0);
  }
`;

const DOWN_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uColor;
  uniform vec2 uTexel;
  void main(){
    vec3 c = texture2D(uColor, vUv).rgb * 4.0;
    c += texture2D(uColor, vUv + vec2( uTexel.x,  uTexel.y)).rgb;
    c += texture2D(uColor, vUv + vec2(-uTexel.x,  uTexel.y)).rgb;
    c += texture2D(uColor, vUv + vec2( uTexel.x, -uTexel.y)).rgb;
    c += texture2D(uColor, vUv + vec2(-uTexel.x, -uTexel.y)).rgb;
    c += 2.0 * texture2D(uColor, vUv + vec2( uTexel.x, 0.0)).rgb;
    c += 2.0 * texture2D(uColor, vUv + vec2(-uTexel.x, 0.0)).rgb;
    c += 2.0 * texture2D(uColor, vUv + vec2(0.0,  uTexel.y)).rgb;
    c += 2.0 * texture2D(uColor, vUv + vec2(0.0, -uTexel.y)).rgb;
    gl_FragColor = vec4(c / 16.0, 1.0);
  }
`;

const UP_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uColor;
  uniform vec2 uTexel;
  uniform float uAmount;
  void main(){
    // tent filter upsample
    vec3 c = texture2D(uColor, vUv).rgb * 4.0;
    c += texture2D(uColor, vUv + vec2( uTexel.x,  uTexel.y)).rgb;
    c += texture2D(uColor, vUv + vec2(-uTexel.x,  uTexel.y)).rgb;
    c += texture2D(uColor, vUv + vec2( uTexel.x, -uTexel.y)).rgb;
    c += texture2D(uColor, vUv + vec2(-uTexel.x, -uTexel.y)).rgb;
    c += 2.0 * texture2D(uColor, vUv + vec2( uTexel.x, 0.0)).rgb;
    c += 2.0 * texture2D(uColor, vUv + vec2(-uTexel.x, 0.0)).rgb;
    c += 2.0 * texture2D(uColor, vUv + vec2(0.0,  uTexel.y)).rgb;
    c += 2.0 * texture2D(uColor, vUv + vec2(0.0, -uTexel.y)).rgb;
    gl_FragColor = vec4(c / 16.0 * uAmount, 1.0);
  }
`;

const FINAL_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uColor;
  uniform sampler2D uBloom;
  uniform float uExposure;
  uniform float uBloomStrength;
  uniform float uSat;
  uniform float uContrast;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uCA;
  uniform float uTime;
  uniform vec3 uLift;
  uniform vec3 uGain;
  uniform float uFlash;

  ${SANITISE}

  vec3 aces(vec3 x){
    const mat3 IN = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 OUT = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    x = IN * x;
    vec3 a = x * (x + 0.0245786) - 0.000090537;
    vec3 b = x * (0.983729 * x + 0.4329510) + 0.238081;
    return clamp(OUT * (a / b), 0.0, 1.0);
  }

  vec3 toSRGB(vec3 c){
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(0.41666)) - 0.055, step(0.0031308, c));
  }

  float hash(vec2 p){
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main(){
    vec2 uv = vUv;
    vec2 fromC = uv - 0.5;
    float r2 = dot(fromC, fromC);

    // chromatic aberration grows toward the corners
    float ca = uCA * 0.0022 * r2;
    vec3 col;
    col.r = texture2D(uColor, uv + fromC * ca).r;
    col.g = texture2D(uColor, uv).g;
    col.b = texture2D(uColor, uv - fromC * ca).b;

    col = finite3(col, 512.0);
    vec3 bloom = finite3(texture2D(uBloom, uv).rgb, 512.0);
    col += bloom * uBloomStrength;

    col *= uExposure * (1.0 + uFlash * 0.55);
    col = aces(col);

    // grade: lift/gain, contrast, saturation
    col = col * uGain + uLift * (1.0 - col);
    col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(l), col, uSat), 0.0, 1.0);

    // vignette + film grain
    float vig = 1.0 - uVignette * smoothstep(0.18, 0.85, r2 * 1.35);
    col *= vig;
    float g = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 71.3) - 0.5;
    col += g * uGrain * 0.055 * (1.2 - l);

    gl_FragColor = vec4(toSRGB(clamp(col, 0.0, 1.0)), 1.0);
  }
`;

export class PostFX {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.width = 2;
    this.height = 2;
    this.mips = opts.bloomMips || 5;
    this.taps = opts.dofTaps || 24;
    this.godrays = opts.godrays !== false;

    this.sceneRT = makeRT(2, 2, { depth: true });
    this.depthTexture = new THREE.DepthTexture(2, 2);
    this.depthTexture.type = THREE.UnsignedIntType;
    this.depthTexture.format = THREE.DepthFormat;
    this.depthTexture.minFilter = THREE.NearestFilter;
    this.depthTexture.magFilter = THREE.NearestFilter;
    this.sceneRT.depthTexture = this.depthTexture;

    this.compRT = makeRT(2, 2);
    this.dofRT = makeRT(2, 2);

    this.bloomRTs = [];
    for (let i = 0; i < this.mips; i++) this.bloomRTs.push(makeRT(2, 2));

    const depthUniforms = {
      uNear: { value: 0.25 },
      uFar: { value: 4200 },
      uInvVP: { value: new THREE.Matrix4() },
      uCamPos: U.uCamPos,
    };
    this.depthUniforms = depthUniforms;

    this.composite = fsMaterial(COMPOSITE_FRAG, pick('noise', 'fog', 'time', {
      uScene: { value: this.sceneRT.texture },
      uDepth: { value: this.depthTexture },
      uSky: { value: null },
      uCloudWind: U.uCloudWind,
      uSunDir: U.uSunDir,
      uSunColor: U.uSunColor,
      uSunIntensity: U.uSunIntensity,
      uFlash: U.uFlash,
      uFogScale: { value: 1 },
      uSunScreen: { value: new THREE.Vector2(0.5, 0.5) },
      uSunVisible: { value: 0 },
      uGodray: { value: 0.5 },
      ...depthUniforms,
    }), { GODRAY_STEPS: this.godrays ? 10 : 0 });

    this.dof = fsMaterial(DOF_FRAG, {
      uDisc: { value: discVectors(MAX_TAPS) },
      uColor: { value: this.compRT.texture },
      uDepth: { value: this.depthTexture },
      uTexel: { value: new THREE.Vector2() },
      uFocus: { value: 12 },
      uAperture: { value: 1 },
      uMaxCoC: { value: 18 },
      ...depthUniforms,
    }, { TAPS: this.taps });

    this.bright = fsMaterial(BRIGHT_FRAG, {
      uColor: { value: this.dofRT.texture },
      uThreshold: { value: 1.0 },
      uSoft: { value: 1.4 },
    });

    this.down = fsMaterial(DOWN_FRAG, {
      uColor: { value: null },
      uTexel: { value: new THREE.Vector2() },
    });

    this.up = fsMaterial(UP_FRAG, {
      uColor: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uAmount: { value: 1 },
    });
    this.up.blending = THREE.AdditiveBlending;
    this.up.transparent = true;

    this.final = fsMaterial(FINAL_FRAG, pick('time', {
      uColor: { value: this.dofRT.texture },
      uBloom: { value: this.bloomRTs[0].texture },
      uExposure: { value: 1 },
      uBloomStrength: { value: 0.55 },
      uSat: { value: 1.1 },
      uContrast: { value: 1.06 },
      uVignette: { value: 0.55 },
      uGrain: { value: 0.6 },
      uCA: { value: 1 },
      uLift: { value: new THREE.Vector3(0.012, 0.014, 0.022) },
      uGain: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
      uFlash: U.uFlash,
    }));
  }

  setSize(w, h) {
    w = Math.max(2, Math.floor(w));
    h = Math.max(2, Math.floor(h));
    if (w === this.width && h === this.height) return;
    this.width = w; this.height = h;
    this.sceneRT.setSize(w, h);
    this.depthTexture.image.width = w;
    this.depthTexture.image.height = h;
    this.depthTexture.needsUpdate = true;
    this.compRT.setSize(w, h);
    this.dofRT.setSize(w, h);
    for (let i = 0; i < this.bloomRTs.length; i++) {
      this.bloomRTs[i].setSize(Math.max(2, w >> (i + 1)), Math.max(2, h >> (i + 1)));
    }
    this.dof.uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  setQuality(q) {
    if (q.dofTaps !== this.taps) {
      this.taps = q.dofTaps;
      this.dof.defines.TAPS = q.dofTaps;
      this.dof.needsUpdate = true;
    }
    const gr = q.godrays ? 10 : 0;
    if (this.composite.defines.GODRAY_STEPS !== gr) {
      this.composite.defines.GODRAY_STEPS = gr;
      this.composite.needsUpdate = true;
    }
  }

  /** call before rendering the scene */
  beginScene(camera) {
    this.depthUniforms.uNear.value = camera.near;
    this.depthUniforms.uFar.value = camera.far;
    this.depthUniforms.uInvVP.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
    return this.sceneRT;
  }

  render(skyTexture, camera, params) {
    const r = this.renderer;
    this.composite.uniforms.uSky.value = skyTexture;
    this.composite.uniforms.uFogScale.value = params.fog;
    this.composite.uniforms.uGodray.value = params.godray;

    // sun position on screen (for the shafts)
    const sunWorld = U.uSunDir.value;
    const p = _v4.set(sunWorld.x * 1e5, sunWorld.y * 1e5, sunWorld.z * 1e5, 1)
      .applyMatrix4(camera.matrixWorldInverse)
      .applyMatrix4(camera.projectionMatrix);
    if (p.w > 0) {
      const sx = (p.x / p.w) * 0.5 + 0.5;
      const sy = (p.y / p.w) * 0.5 + 0.5;
      this.composite.uniforms.uSunScreen.value.set(sx, sy);
      this.composite.uniforms.uSunVisible.value =
        (sx > -0.8 && sx < 1.8 && sy > -0.8 && sy < 1.8) ? 1 : 0;
    } else {
      this.composite.uniforms.uSunVisible.value = 0;
    }

    blit(r, this.composite, this.compRT, true);

    this.dof.uniforms.uFocus.value = params.focus;
    this.dof.uniforms.uAperture.value = params.aperture;
    this.dof.uniforms.uMaxCoC.value = params.maxCoC;
    blit(r, this.dof, this.dofRT, true);

    // bloom
    this.bright.uniforms.uColor.value = this.dofRT.texture;
    this.bright.uniforms.uThreshold.value = params.bloomThreshold;
    blit(r, this.bright, this.bloomRTs[0], true);
    for (let i = 1; i < this.bloomRTs.length; i++) {
      const src = this.bloomRTs[i - 1];
      this.down.uniforms.uColor.value = src.texture;
      this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      blit(r, this.down, this.bloomRTs[i], true);
    }
    for (let i = this.bloomRTs.length - 1; i > 0; i--) {
      const src = this.bloomRTs[i];
      this.up.uniforms.uColor.value = src.texture;
      this.up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.up.uniforms.uAmount.value = 0.82;
      blit(r, this.up, this.bloomRTs[i - 1], false);
    }

    const f = this.final.uniforms;
    f.uColor.value = this.dofRT.texture;
    f.uBloom.value = this.bloomRTs[0].texture;
    f.uExposure.value = params.exposure;
    f.uBloomStrength.value = params.bloom;
    f.uSat.value = params.saturation;
    f.uContrast.value = params.contrast;
    f.uVignette.value = params.vignette;
    f.uGrain.value = params.grain;
    f.uCA.value = params.ca;
    if (params.lift !== undefined) {
      // cool, filmic shadow lift so darks stay readable without going milky
      f.uLift.value.set(params.lift * 0.85, params.lift * 0.98, params.lift * 1.35);
    }
    blit(r, this.final, null, true);
  }

  dispose() {
    this.sceneRT.dispose();
    this.compRT.dispose();
    this.dofRT.dispose();
    for (const rt of this.bloomRTs) rt.dispose();
    for (const m of [this.composite, this.dof, this.bright, this.down, this.up, this.final]) m.dispose();
  }
}

const _v4 = new THREE.Vector4();
