// Atmosphere: Preetham sky, sun/moon, day-night cycle, star dome, cloud layers, IBL.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { makeStarTexture, makeGlowTexture } from '../core/textures.js';
import { GLSL_NOISE } from '../core/noise.js';
import { clamp, lerp, smoothstep } from '../core/utils.js';

const SUN_DIST = 3000;

export class SkySystem {
  constructor(ctx) {
    this.ctx = ctx;
    const scene = ctx.scene;

    this.sky = new Sky();
    this.sky.scale.setScalar(12000);
    this.sky.material.uniforms.turbidity.value = 3.2;
    this.sky.material.uniforms.rayleigh.value = 1.6;
    this.sky.material.uniforms.mieCoefficient.value = 0.006;
    this.sky.material.uniforms.mieDirectionalG.value = 0.82;
    scene.add(this.sky);

    this.sunDir = new THREE.Vector3(0.4, 0.6, 0.4).normalize();

    this.sun = new THREE.DirectionalLight(0xfff2dc, 3.1);
    this.sun.castShadow = true;
    const sm = ctx.quality.shadowMap ?? 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 460;
    const ext = ctx.quality.shadowExtent ?? 90;
    Object.assign(this.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.055;
    this.sun.shadow.blurSamples = 12;
    this.sun.shadow.radius = 2.4;
    // Stylised NPR shadows: never fully black, so shaded areas keep their albedo.
    if ('intensity' in this.sun.shadow) this.sun.shadow.intensity = 0.78;
    scene.add(this.sun); scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x9fb6ff, 0.0);
    scene.add(this.moon); scene.add(this.moon.target);

    this.hemi = new THREE.HemisphereLight(0xbfd7ff, 0x5c6b4a, 0.55);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.08);
    scene.add(this.ambient);

    // ---- star dome ----
    const starMat = new THREE.MeshBasicMaterial({ map: makeStarTexture(1024), side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.stars = new THREE.Mesh(new THREE.SphereGeometry(4300, 32, 20), starMat);
    this.stars.rotation.z = 0.4;
    scene.add(this.stars);

    // ---- moon billboard ----
    this.moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(128, 3.2), color: 0xbfd0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.moonHalo.scale.setScalar(420);
    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(128, 0.26), color: 0xf2f6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.moonSprite.scale.setScalar(86);
    scene.add(this.moonSprite, this.moonHalo);

    this._makeClouds(scene);

    this.pmrem = new THREE.PMREMGenerator(ctx.renderer);
    this.pmrem.compileEquirectangularShader();
    this._envScene = new THREE.Scene();
    this._envSky = new Sky(); this._envSky.scale.setScalar(12000); this._envScene.add(this._envSky);
    this._lastEnvHour = -99;
    this.timeOfDay = 8.5;      // hours
    this.daySpeed = 1 / 180;   // in-game hours per real second (1 day = 72 min)
    this.fogColor = new THREE.Color();
    ctx.scene.fog = new THREE.FogExp2(0xa9c6e8, 0.00085);
    this.update(0, true);
  }

  _makeClouds(scene) {
    // two scrolling procedural cloud planes high above the world
    const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
    this.cloudMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: {
        uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() },
        uTint: { value: new THREE.Color(0xffffff) }, uShade: { value: new THREE.Color(0x6f7f99) },
        uCover: { value: 0.46 }, uOpacity: { value: 0.9 }, uScale: { value: 1.0 },
      },
      vertexShader: `varying vec2 vUv; varying vec3 vW;
        void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `precision highp float; varying vec2 vUv; varying vec3 vW;
        uniform float uTime, uCover, uOpacity, uScale; uniform vec3 uSunDir, uTint, uShade;
        ${GLSL_NOISE}
        void main(){
          vec2 p = vW.xz * 0.00055 * uScale + vec2(uTime * 0.0035, uTime * 0.0012);
          float n = gfbm(p * 1.0, 6) * 0.5 + 0.5;
          float n2 = gfbm(p * 2.7 + 13.0, 4) * 0.5 + 0.5;
          float d = smoothstep(uCover, uCover + 0.30, n * 0.72 + n2 * 0.28);
          if (d <= 0.003) discard;
          float h = smoothstep(uCover - 0.05, uCover + 0.45, n);
          vec3 col = mix(uShade, uTint, pow(h, 0.7));
          float rim = smoothstep(0.25, 0.9, h);
          col += uTint * rim * 0.25;
          float horizonFade = smoothstep(0.0, 900.0, length(vW.xz - cameraPosition.xz)) ;
          float far = 1.0 - smoothstep(3200.0, 8000.0, length(vW.xz - cameraPosition.xz));
          gl_FragColor = vec4(col, d * uOpacity * far);
        }`,
    });
    this.clouds = new THREE.Mesh(geo, this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 620;
    this.clouds.frustumCulled = false;
    scene.add(this.clouds);

    this.cloudMat2 = this.cloudMat.clone();
    this.cloudMat2.uniforms.uCover.value = 0.60;
    this.cloudMat2.uniforms.uOpacity.value = 0.55;
    this.cloudMat2.uniforms.uScale.value = 2.1;
    this.clouds2 = new THREE.Mesh(geo, this.cloudMat2);
    this.clouds2.rotation.x = -Math.PI / 2; this.clouds2.position.y = 860;
    this.clouds2.frustumCulled = false;
    scene.add(this.clouds2);
  }

  setTimeOfDay(h) { this.timeOfDay = ((h % 24) + 24) % 24; this.update(0, true); }

  /** 0 at midnight, 1 at noon-ish elevation factor. */
  get dayFactor() { return clamp(this.sunDir.y * 1.9 + 0.12, 0, 1); }

  update(dt, force = false) {
    const ctx = this.ctx;
    if (!ctx.paused) this.timeOfDay = (this.timeOfDay + dt * this.daySpeed * 24 / 24 * 24) % 24;
    const t = this.timeOfDay;

    // sun path (tilted arc)
    const ang = (t / 24) * Math.PI * 2 - Math.PI / 2;
    const elev = Math.sin(ang), azim = Math.cos(ang);
    this.sunDir.set(azim * 0.72, elev, azim * 0.36 + 0.42 * Math.cos(ang * 0.5)).normalize();
    const day = this.dayFactor;

    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.sky.material.uniforms.turbidity.value = lerp(2.4, 6.5, smoothstep(0.35, 0.0, this.sunDir.y));
    this.sky.material.uniforms.rayleigh.value = lerp(0.35, 2.6, smoothstep(0.5, 0.02, Math.abs(this.sunDir.y)));
    this.sky.material.uniforms.mieCoefficient.value = lerp(0.004, 0.021, smoothstep(0.4, 0.0, this.sunDir.y));

    // sun light colour: warm at horizon, white at noon, near-zero at night
    const warm = smoothstep(0.45, 0.02, Math.max(0, this.sunDir.y));
    this.sun.color.setRGB(1.0, lerp(1.0, 0.62, warm), lerp(0.96, 0.30, warm));
    this.sun.intensity = 2.70 * smoothstep(-0.06, 0.22, this.sunDir.y);
    const sunPos = this.sunDir.clone().multiplyScalar(SUN_DIST);
    const focus = ctx.shadowFocus ?? new THREE.Vector3();
    this.sun.position.copy(focus).add(this.sunDir.clone().multiplyScalar(220));
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();

    // moon: opposite the sun
    const moonDir = this.sunDir.clone().multiplyScalar(-1);
    this.moon.intensity = 0.52 * smoothstep(0.02, -0.20, this.sunDir.y);
    this.moon.position.copy(focus).add(moonDir.clone().multiplyScalar(200));
    this.moon.target.position.copy(focus); this.moon.target.updateMatrixWorld();
    const moonPos = ctx.camera.position.clone().add(moonDir.clone().multiplyScalar(3600));
    this.moonSprite.position.copy(moonPos);
    this.moonHalo.position.copy(moonPos);
    const moonVis = smoothstep(0.06, -0.15, this.sunDir.y);
    this.moonSprite.material.opacity = moonVis * 1.0;
    this.moonHalo.material.opacity = moonVis * 0.30;

    this.stars.material.opacity = smoothstep(0.10, -0.12, this.sunDir.y) * 0.85;
    this.stars.rotation.y = t * 0.026;

    this.hemi.intensity = lerp(0.19, 0.25, day);
    this.hemi.color.setHSL(0.60, lerp(0.30, 0.42, day), lerp(0.34, 0.72, day));
    this.hemi.groundColor.setHSL(0.24, 0.26, lerp(0.07, 0.30, day));
    this.ambient.intensity = lerp(0.085, 0.075, day);

    // fog + cloud tint follow the sky
    const zenith = new THREE.Color().setHSL(0.58, lerp(0.20, 0.52, day), lerp(0.08, 0.66, day));
    const horizon = new THREE.Color().setHSL(lerp(0.07, 0.55, smoothstep(0.02, 0.35, this.sunDir.y)), lerp(0.55, 0.42, day), lerp(0.12, 0.78, day));
    this.fogColor.copy(horizon).lerp(zenith, 0.35);
    // pull cyan out of the aerial haze so distant mountains keep their form
    const _hsl = { h: 0, s: 0, l: 0 };
    this.fogColor.getHSL(_hsl);
    this.fogColor.setHSL(_hsl.h, _hsl.s * 0.78, Math.min(0.62, _hsl.l * 0.80));
    ctx.scene.fog.color.copy(this.fogColor);
    ctx.scene.fog.density = lerp(0.00150, 0.00064, day);

    for (const m of [this.cloudMat, this.cloudMat2]) {
      m.uniforms.uTime.value += dt * 12;
      m.uniforms.uSunDir.value.copy(this.sunDir);
      m.uniforms.uTint.value.copy(this.sun.color).multiplyScalar(lerp(0.16, 1.0, day)).lerp(new THREE.Color(0x5c6b8c), 0.45 * (1 - day));
      m.uniforms.uShade.value.setHSL(0.60, 0.28, lerp(0.045, 0.52, day));
    }

    // refresh IBL a few times per in-game hour
    if (force || Math.abs(t - this._lastEnvHour) > 0.35) {
      this._lastEnvHour = t;
      this._envSky.material.uniforms.sunPosition.value.copy(this.sunDir);
      for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'])
        this._envSky.material.uniforms[k].value = this.sky.material.uniforms[k].value;
      const rt = this.pmrem.fromScene(this._envScene, 0, 1, 12000);
      if (this._envRT) this._envRT.dispose();
      this._envRT = rt;
      ctx.scene.environment = rt.texture;
      ctx.scene.environmentIntensity = lerp(0.26, 0.30, day);
    }
    this.clouds.position.x = ctx.camera.position.x; this.clouds.position.z = ctx.camera.position.z;
    this.clouds2.position.x = ctx.camera.position.x; this.clouds2.position.z = ctx.camera.position.z;
    this.stars.position.copy(ctx.camera.position);
    this.sky.position.copy(ctx.camera.position);
  }
}
