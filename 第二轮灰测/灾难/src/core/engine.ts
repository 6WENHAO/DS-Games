import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GradeShader, TiltShiftController, TiltShiftShader } from './postfx';
import type { TiltShiftUniforms } from './postfx';
import { PerfGovernor, makeQuality } from './quality';
import type { QualitySettings } from './quality';

export interface GradeUniforms {
  uExposure: { value: number };
  uSaturation: { value: number };
  uContrast: { value: number };
  uVignette: { value: number };
  uFlashColor: { value: THREE.Color };
  uFlashAmount: { value: number };
  uTint: { value: THREE.Color };
}

/**
 * Owns the renderer, the single animation loop, the post-processing chain and
 * the adaptive quality governor. Exactly one instance exists for the page
 * lifetime, so "rebuild" can never spawn a second loop.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;
  readonly quality: QualitySettings;
  readonly tilt: TiltShiftController;
  readonly grade: GradeUniforms;
  readonly governor: PerfGovernor;

  timeScale = 1;
  private bloom: UnrealBloomPass | null = null;
  private raf = 0;
  private clock = new THREE.Clock();
  private observer: ResizeObserver | null = null;
  private lastW = 0;
  private lastH = 0;
  private lastDpr = 0;
  private updaters: Array<(dt: number, simDt: number) => void> = [];
  private lastRealDt = 1 / 60;

  constructor(readonly container: HTMLElement) {
    this.quality = makeQuality();

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setClearColor(0xbfe4ff, 1);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = this.quality.shadows;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.6, 1900);
    this.camera.position.set(102, 126, 131);

    const dpr = this.quality.pixelRatio;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const rt = new THREE.WebGLRenderTarget(
      Math.round(w * dpr),
      Math.round(h * dpr),
      {
        type: THREE.HalfFloatType,
        samples: this.quality.msaa,
        depthBuffer: true,
        stencilBuffer: false,
      },
    );
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.quality.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.48, 0.62, 1.0);
      this.composer.addPass(this.bloom);
    }

    const tiltH = new ShaderPass(TiltShiftShader);
    const tiltV = new ShaderPass(TiltShiftShader);
    this.composer.addPass(tiltH);
    this.composer.addPass(tiltV);
    this.tilt = new TiltShiftController(
      tiltH.uniforms as unknown as TiltShiftUniforms,
      tiltV.uniforms as unknown as TiltShiftUniforms,
    );
    this.tilt.setAmount(0.45);

    const gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(gradePass);
    this.grade = gradePass.uniforms as unknown as GradeUniforms;

    this.composer.addPass(new OutputPass());

    this.governor = new PerfGovernor((step) => this.downgrade(step));

    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    // A bare `resize` event can be delivered before layout settles (mobile
    // orientation changes, on-screen keyboards), which would leave a stale
    // drawing buffer. ResizeObserver always reports the post-layout box.
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(container);
    }
    window.visualViewport?.addEventListener('resize', this.resize);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[sandbox] WebGL context lost');
    });
    this.resize();
  }

  get fps(): number {
    return this.governor.fps;
  }

  get realDelta(): number {
    return this.lastRealDt;
  }

  onUpdate(fn: (dt: number, simDt: number) => void): void {
    this.updaters.push(fn);
  }

  /** One complete simulate + render step. Shared by the rAF loop and tooling. */
  frame(dt: number, render = true): void {
    const clamped = Math.min(Math.max(dt, 0), 0.05);
    this.lastRealDt = clamped;
    const simDt = clamped * this.timeScale;
    this.governor.update(clamped);
    for (const u of this.updaters) u(clamped, simDt);
    if (render) this.composer.render(clamped);
  }

  /** Single rAF loop — created once, never duplicated. */
  start(): void {
    if (this.raf) return;
    this.clock.start();
    const tick = (): void => {
      this.raf = requestAnimationFrame(tick);
      this.frame(this.clock.getDelta());
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize = (): void => {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const dpr = this.quality.pixelRatio;
    // ResizeObserver + resize + visualViewport can all fire for one change;
    // skip the expensive render-target reallocation when nothing moved.
    if (w === this.lastW && h === this.lastH && dpr === this.lastDpr) return;
    this.lastW = w;
    this.lastH = h;
    this.lastDpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the whole model readable on tall/narrow phone screens.
    this.camera.fov = w / h < 0.85 ? 44 : 32;
    this.camera.updateProjectionMatrix();
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.tilt.setResolution(w * dpr, h * dpr);
    if (this.bloom) this.bloom.setSize(w * dpr, h * dpr);
  };

  private downgrade(step: number): void {
    const q = this.quality;
    if (step === 1) {
      q.pixelRatio = Math.max(0.72, q.pixelRatio * 0.78);
      if (this.bloom) {
        this.bloom.enabled = false;
        q.bloom = false;
      }
      q.sparkCap = Math.round(q.sparkCap * 0.6);
      q.smokeCap = Math.round(q.smokeCap * 0.6);
      q.eventDebris = Math.round(q.eventDebris * 0.65);
    } else {
      q.pixelRatio = Math.max(0.6, q.pixelRatio * 0.82);
      q.shadows = false;
      this.renderer.shadowMap.enabled = false;
      this.renderer.shadowMap.autoUpdate = false;
      q.eventDebris = Math.round(q.eventDebris * 0.7);
    }
    this.resize();
    console.info(`[sandbox] quality downgraded (step ${step})`);
  }

  setTiltAmount(a: number): void {
    this.tilt.setAmount(a);
  }

  /**
   * Read the current drawing buffer straight out of WebGL as a PNG data URL.
   * Must be called in the same task as a render (no preserveDrawingBuffer).
   * Used by the verification tooling, which cannot rely on the compositor.
   */
  captureDataURL(): string {
    const gl = this.renderer.getContext();
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(w, h);
    const row = w * 4;
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * row;
      img.data.set(buf.subarray(src, src + row), y * row);
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  }

  /** Lower the internal render resolution (used by tooling / weak devices). */
  setPixelRatio(r: number): void {
    this.quality.pixelRatio = r;
    this.resize();
  }
}
