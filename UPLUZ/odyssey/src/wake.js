import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Bloom wake.
// The highest value-per-millisecond system in the game: instead of spawning
// flower objects behind the player, we splat into a single 1024^2 texture
// covering a 512 m window around them. Terrain and grass shaders sample it.
// Infinite trail length, free persistence, ~0.1 ms/frame, one texture.
//
//   R = walk wake  (soft colour trail)
//   G = call bloom (flower burst from the Call)
//
// The window re-centres by blitting itself with a UV offset, so the trail
// survives travel without any CPU-side history.
// ---------------------------------------------------------------------------

const RES = 1024;
export const WAKE_SPAN = 512;      // metres covered by the texture
const RECENTRE_AT = 96;            // metres of drift before we re-centre

const QUAD = new THREE.PlaneGeometry(1, 1);

export class BloomWake {
  constructor(renderer) {
    this.renderer = renderer;
    this.origin = new THREE.Vector2(0, 0);

    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.rtA = new THREE.WebGLRenderTarget(RES, RES, opts);
    this.rtB = new THREE.WebGLRenderTarget(RES, RES, opts);

    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1);
    this.scene = new THREE.Scene();

    // --- fade: dst *= f, run every frame, ~0.05 ms on a 1024^2 ---
    this.fadeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
      depthTest: false, depthWrite: false,
    });
    this.fadeQuad = new THREE.Mesh(QUAD, this.fadeMat);
    this.fadeQuad.frustumCulled = false;
    this.scene.add(this.fadeQuad);

    // --- splat: additive radial brush ---
    this.splatMat = new THREE.ShaderMaterial({
      uniforms: { uStrength: { value: 1 }, uChannel: { value: new THREE.Vector2(1, 0) } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false, depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uStrength;
        uniform vec2 uChannel;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float a = pow(1.0 - clamp(d, 0.0, 1.0), 2.2) * uStrength;
          gl_FragColor = vec4(uChannel.x * a, uChannel.y * a, 0.0, a);
        }`,
    });
    this.splatQuad = new THREE.Mesh(QUAD, this.splatMat);
    this.splatQuad.frustumCulled = false;
    this.splatQuad.visible = false;
    this.scene.add(this.splatQuad);

    // --- blit: re-centre the window ---
    this.blitMat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uShift: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTex;
        uniform vec2 uShift;
        void main() {
          vec2 uv = vUv + uShift;
          if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
            gl_FragColor = vec4(0.0);
          } else {
            gl_FragColor = texture2D(uTex, uv);
          }
        }`,
    });
    this.blitQuad = new THREE.Mesh(QUAD, this.blitMat);
    this.blitQuad.frustumCulled = false;
    this.blitQuad.visible = false;
    this.scene.add(this.blitQuad);

    // one shared uniform block, handed to every world shader
    this._uniforms = {
      uWake: { value: this.rtA.texture },
      uWakeOrigin: { value: this.origin },
      uWakeSpan: { value: WAKE_SPAN },
    };

    this.clear();
  }

  get texture() { return this.rtA.texture; }

  clear() {
    const prev = this.renderer.getRenderTarget();
    for (const rt of [this.rtA, this.rtB]) {
      this.renderer.setRenderTarget(rt);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear(true, false, false);
    }
    this.renderer.setRenderTarget(prev);
  }

  // world XZ -> wake-space [-0.5, 0.5]
  toLocal(x, z, out) {
    out.set((x - this.origin.x) / WAKE_SPAN, (z - this.origin.y) / WAKE_SPAN);
    return out;
  }

  _draw(target, only) {
    this.fadeQuad.visible = only === 'fade';
    this.splatQuad.visible = only === 'splat';
    this.blitQuad.visible = only === 'blit';
    const prev = this.renderer.getRenderTarget();
    const prevAuto = this.renderer.autoClear;
    this.renderer.autoClear = only === 'blit';
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = prevAuto;
    this.renderer.setRenderTarget(prev);
  }

  splat(x, z, radius, strength, channel = 0) {
    const p = this.toLocal(x, z, new THREE.Vector2());
    if (Math.abs(p.x) > 0.55 || Math.abs(p.y) > 0.55) return;
    const s = (radius * 2) / WAKE_SPAN;
    this.splatQuad.position.set(p.x, -p.y, 0);
    this.splatQuad.scale.set(s, s, 1);
    this.splatMat.uniforms.uStrength.value = strength;
    this.splatMat.uniforms.uChannel.value.set(channel === 0 ? 1 : 0, channel === 1 ? 1 : 0);
    this._draw(this.rtA, 'splat');
  }

  recentre(x, z) {
    const dx = x - this.origin.x, dz = z - this.origin.y;
    if (Math.hypot(dx, dz) < RECENTRE_AT) return;
    this.blitMat.uniforms.uTex.value = this.rtA.texture;
    // texture V is flipped relative to world Z
    this.blitMat.uniforms.uShift.value.set(dx / WAKE_SPAN, -dz / WAKE_SPAN);
    this._draw(this.rtB, 'blit');
    const t = this.rtA; this.rtA = this.rtB; this.rtB = t;
    this.origin.set(x, z);
  }

  // half-life in seconds for the trail
  update(dt, halfLife = 34) {
    const f = Math.pow(0.5, dt / halfLife);
    this.fadeMat.color.setScalar(f);
    this._draw(this.rtA, 'fade');
    // rtA identity changes on recentre, so republish it every frame
    this._uniforms.uWake.value = this.rtA.texture;
  }

  // uniforms every world shader mixes in
  uniforms() { return this._uniforms; }

  static glsl() {
    return `
      uniform sampler2D uWake;
      uniform vec2 uWakeOrigin;
      uniform float uWakeSpan;
      vec2 sampleWake(vec2 worldXZ) {
        vec2 uv = (worldXZ - uWakeOrigin) / uWakeSpan + 0.5;
        uv.y = 1.0 - uv.y;
        if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec2(0.0);
        return texture2D(uWake, uv).rg;
      }
    `;
  }
}
