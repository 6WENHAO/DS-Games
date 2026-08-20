// The "life field": a persistent, world-anchored texture that remembers where the
// petals have drifted. Grass reads it to turn from dry gold to lush green, the terrain
// reads it for colour and flower speckles, and the flower system uses it as a mask.

import * as THREE from 'three';
import { U } from './uniforms.js';
import { FS_VERT, blit, fsMaterial } from './fsq.js';

const SPLAT_VERT = /* glsl */ `
  uniform vec2 uCenter;   // target position in UV space
  uniform vec2 uRadius;   // radius in UV space
  varying vec2 vLocal;
  void main(){
    vLocal = position.xy;
    vec2 ndc = (uCenter + position.xy * uRadius) * 2.0 - 1.0;
    gl_Position = vec4(ndc, 0.0, 1.0);
  }
`;

const SPLAT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vLocal;
  uniform float uAmount;
  uniform float uBloom;
  uniform float uHue;
  void main(){
    float d = length(vLocal);
    if (d > 1.0) discard;
    float fall = pow(1.0 - d, 1.7);
    float life = uAmount * fall;
    float bloom = uBloom * pow(max(0.0, 1.0 - d * 1.45), 2.2);
    gl_FragColor = vec4(life, bloom, uHue * life * 2.0, life);
  }
`;

const SHIFT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uSrc;
  uniform vec2 uShift;
  void main(){
    vec2 uv = vUv + uShift;
    vec2 cl = clamp(uv, vec2(0.0), vec2(1.0));
    gl_FragColor = (cl == uv) ? texture2D(uSrc, uv) : vec4(0.0);
  }
`;

function makeLifeRT(res) {
  const rt = new THREE.WebGLRenderTarget(res, res, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.wrapS = rt.texture.wrapT = THREE.ClampToEdgeWrapping;
  return rt;
}

export class LifeMap {
  constructor(renderer, res = 1024, size = 1400) {
    this.size = size;
    this.res = res;
    this.a = makeLifeRT(res);
    this.b = makeLifeRT(res);
    this.center = new THREE.Vector2(0, 0);
    this.queue = [];
    this.painted = 0;

    const quad = new THREE.BufferGeometry();
    quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -1, -1, 0, 1, -1, 0, 1, 1, 0,
      -1, -1, 0, 1, 1, 0, -1, 1, 0,
    ]), 3));
    quad.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

    this.splatMat = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector2() },
        uRadius: { value: new THREE.Vector2() },
        uAmount: { value: 0.1 },
        uBloom: { value: 0.1 },
        uHue: { value: 0.5 },
      },
      vertexShader: SPLAT_VERT,
      fragmentShader: SPLAT_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // true 1:1 accumulation. THREE.AdditiveBlending weights the source by its own
      // alpha, which quantises these small per-frame increments away in an 8-bit target.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });

    this.scene = new THREE.Scene();
    this.cam = new THREE.Camera();
    this.mesh = new THREE.Mesh(quad, this.splatMat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.shiftMat = fsMaterial(SHIFT_FRAG, {
      uSrc: { value: null },
      uShift: { value: new THREE.Vector2() },
    });

    U.uLifeMap.value = this.a.texture;
    U.uLifeSize.value = size;
    U.uLifeCenter.value.copy(this.center);

    this.clear(renderer);
  }

  clear(renderer) {
    const prev = renderer.getClearColor(new THREE.Color());
    const prevA = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const rt of [this.a, this.b]) {
      renderer.setRenderTarget(rt);
      renderer.clear(true, false, false);
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor(prev, prevA);
    this.painted = 0;
  }

  /** world-space splat; radius in meters, amount in [0,1] per call */
  splat(x, z, radius, amount, bloom = amount, hue = 0.5) {
    if (this.queue.length > 96) return;
    this.queue.push({ x, z, radius, amount, bloom, hue });
  }

  worldToUv(x, z, out) {
    out.set((x - this.center.x) / this.size + 0.5, (z - this.center.y) / this.size + 0.5);
    return out;
  }

  recentre(renderer, x, z) {
    const dx = x - this.center.x;
    const dz = z - this.center.y;
    // shift in whole texels to avoid resampling blur
    const texel = this.size / this.res;
    const sx = Math.round(dx / texel) * texel;
    const sz = Math.round(dz / texel) * texel;
    this.shiftMat.uniforms.uSrc.value = this.a.texture;
    this.shiftMat.uniforms.uShift.value.set(sx / this.size, sz / this.size);
    blit(renderer, this.shiftMat, this.b, true);
    const t = this.a; this.a = this.b; this.b = t;
    this.center.x += sx;
    this.center.y += sz;
    U.uLifeMap.value = this.a.texture;
    U.uLifeCenter.value.copy(this.center);
  }

  update(renderer, camX, camZ) {
    const lim = this.size * 0.26;
    if (Math.abs(camX - this.center.x) > lim || Math.abs(camZ - this.center.y) > lim) {
      this.recentre(renderer, camX, camZ);
    }
    if (!this.queue.length) return;

    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.a);
    const uv = new THREE.Vector2();
    for (const s of this.queue) {
      this.worldToUv(s.x, s.z, uv);
      const r = s.radius / this.size;
      if (uv.x < -r || uv.x > 1 + r || uv.y < -r || uv.y > 1 + r) continue;
      this.splatMat.uniforms.uCenter.value.copy(uv);
      this.splatMat.uniforms.uRadius.value.set(r, r);
      this.splatMat.uniforms.uAmount.value = s.amount;
      this.splatMat.uniforms.uBloom.value = s.bloom;
      this.splatMat.uniforms.uHue.value = s.hue;
      renderer.render(this.scene, this.cam);
      this.painted++;
    }
    renderer.setRenderTarget(null);
    renderer.autoClear = prevAuto;
    this.queue.length = 0;
  }

  dispose() {
    this.a.dispose();
    this.b.dispose();
    this.splatMat.dispose();
    this.shiftMat.dispose();
  }
}
