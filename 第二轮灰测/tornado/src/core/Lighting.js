/**
 * Lighting.js — 三个场景共用的唯一一套光影系统。
 *
 *  · 一盏方向光太阳（阴影贴图按相机自适应 + 纹素对齐消抖动）
 *  · 半球环境光（天/地反弹）
 *  · 天空穹顶烘焙的 PMREM 环境贴图（PBR 材质的 IBL）
 *  · 共享高度雾 / 空气透视：注入到所有内置材质与自定义着色器，全场景一致
 *  · 闪电系统：照亮云层 + 提升环境光 + 补一盏冷色补光
 *
 * 所有系统通过 `lighting.uniforms` 按引用共享同一组 uniform 对象。
 */
import * as THREE from 'three';
import { P } from './Params.js';
import { Sky } from './Sky.js';
import { clamp, lerp, smoothstep, damp } from './Random.js';
import { GLSL_AERIAL } from './GlslLib.js';

const DEG = Math.PI / 180;
const _tmpCol = new THREE.Color();

export class Lighting {
  constructor(renderer) {
    this.renderer = renderer;

    /* ---------------- 共享 uniform ---------------- */
    this.uniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.4, 0.3, 0.6).normalize() },
      uSunColor: { value: new THREE.Color(1, 0.92, 0.82) },
      uSunIntensity: { value: 3.0 },
      uZenithColor: { value: new THREE.Color(0.09, 0.16, 0.30) },
      uHorizonColor: { value: new THREE.Color(0.62, 0.60, 0.58) },
      uSkyLuminance: { value: 1.0 },
      uTurbidity: { value: 4.6 },
      uStormCover: { value: 0.85 },
      uStormDark: { value: 0.85 },
      uFogColor: { value: new THREE.Color(0.42, 0.45, 0.5) },
      uFogDensity: { value: 0.00016 },
      uFogHeightFalloff: { value: 0.0018 },
      uFogSunAmount: { value: 0.35 },
      uFlash: { value: 0 },
      uFlashDir: { value: new THREE.Vector3(0, 1, 0) },
      uAmbient: { value: new THREE.Color(0.28, 0.33, 0.42) },
      uGroundAlbedo: { value: new THREE.Color(0.30, 0.28, 0.24) },
      /* 龙卷风位置（云层中气旋、水面涡流、草地压弯都要用） */
      uTornadoPos: { value: new THREE.Vector3(0, 0, 0) },
      uTornadoRadius: { value: 30 },
      uTornadoStrength: { value: 1 },
    };

    /* ---------------- 灯光 ---------------- */
    this.sun = new THREE.DirectionalLight(0xffffff, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 1.6;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 6000;
    this.sun.shadow.blurSamples = 8;
    this.sunTarget = new THREE.Object3D();
    this.sun.target = this.sunTarget;

    this.hemi = new THREE.HemisphereLight(0x9fb6d6, 0x4a4034, 1.0);
    this.fill = new THREE.DirectionalLight(0xbcd4ff, 0.25);   // 反方向弱补光，避免死黑
    this.fill.castShadow = false;

    this.sky = new Sky(this.uniforms);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader?.();
    this._envScene = new THREE.Scene();
    this._envSky = new THREE.Mesh(this.sky.mesh.geometry, this.sky.material);
    this._envSky.scale.setScalar(6000);
    this._envSky.frustumCulled = false;
    this._envScene.add(this._envSky);
    this.envMap = null;
    this._envDirty = true;
    this._envTimer = 0;

    /* 闪电 */
    this._flashTimer = 3.5;
    this._flashEnv = 0;
    this._pulses = [];

    /* 需要跟随光照更新的材质（内置材质的雾覆写） */
    this._patched = new Set();
    this._shadowBucket = 0;

    this._syncFromParams();
    P.onAny((v, k) => { if (k.startsWith('l_') || k === 'q_shadowRes') this._syncFromParams(); });
  }

  /** 把光照对象挂到当前场景（切场景时调用） */
  attach(scene) {
    scene.add(this.sun, this.sunTarget, this.hemi, this.fill, this.sky.mesh);
    // 需要 USE_FOG 宏；实际雾计算被 patchFog 覆写成高度雾
    scene.fog = new THREE.FogExp2(this.uniforms.uFogColor.value.getHex(), 0.00001);
    scene.environment = this.envMap;
    scene.environmentIntensity = 1.0;
    this.scene = scene;
  }

  detach(scene) {
    scene.remove(this.sun, this.sunTarget, this.hemi, this.fill, this.sky.mesh);
  }

  _syncFromParams() {
    const elev = P.get('l_sunElev') * DEG;
    const azim = P.get('l_sunAzim') * DEG;
    const d = this.uniforms.uSunDir.value;
    d.set(Math.cos(elev) * Math.sin(azim), Math.sin(elev), Math.cos(elev) * Math.cos(azim)).normalize();

    const elevDeg = P.get('l_sunElev');
    const storm = P.get('l_storm');
    const turb = P.get('l_turbidity');
    this.uniforms.uTurbidity.value = turb;
    this.uniforms.uStormCover.value = storm;
    this.uniforms.uStormDark.value = P.get('l_stormDark');

    /* 太阳颜色：低空经过更多大气 → 偏红 + 变暗 */
    const lowT = smoothstep(-4, 16, elevDeg);
    const sunCol = this.uniforms.uSunColor.value;
    sunCol.setRGB(
      lerp(1.00, 1.00, lowT),
      lerp(0.44, 0.94, lowT),
      lerp(0.17, 0.86, lowT),
    );
    // 浑浊大气进一步压低蓝光
    sunCol.b *= lerp(1.0, 0.82, clamp((turb - 2) / 10, 0, 1));
    const sunI = 3.6 * smoothstep(-5, 9, elevDeg) * (1 - 0.68 * storm) + 0.06;
    this.uniforms.uSunIntensity.value = sunI;
    this.sun.color.copy(sunCol);
    this.sun.intensity = sunI;

    /* 天顶 / 地平线颜色 */
    const z = this.uniforms.uZenithColor.value;
    z.setRGB(0.075, 0.145, 0.30).lerp(new THREE.Color(0.085, 0.093, 0.115), storm * 0.85);
    const h = this.uniforms.uHorizonColor.value;
    h.setRGB(0.66, 0.63, 0.60).lerp(new THREE.Color(0.30, 0.30, 0.32), storm * 0.75);
    const dusk = 1 - smoothstep(0, 14, elevDeg);
    h.lerp(new THREE.Color(0.72, 0.36, 0.20), dusk * 0.55 * (1 - storm * 0.5));
    this.uniforms.uSkyLuminance.value = lerp(1.05, 0.42, storm) * lerp(0.55, 1.0, smoothstep(-6, 12, elevDeg));

    /* 雾：从天空色推导，保证与天空、水面反射一致 */
    const fog = this.uniforms.uFogColor.value;
    fog.copy(h).multiplyScalar(0.82).lerp(sunCol, 0.14 * (1 - storm));
    fog.multiplyScalar(lerp(1.0, 0.62, storm) * this.uniforms.uSkyLuminance.value);
    this.uniforms.uFogDensity.value = 0.000105 * P.get('l_fog') * lerp(1, 1.7, storm);
    this.uniforms.uFogSunAmount.value = 0.42 * (1 - 0.5 * storm);

    /* 环境光 */
    const amb = this.uniforms.uAmbient.value;
    amb.copy(z).multiplyScalar(1.5);
    _tmpCol.copy(h).multiplyScalar(0.5);
    amb.add(_tmpCol);
    this.hemi.color.copy(h).multiplyScalar(1.05);
    this.hemi.groundColor.copy(this.uniforms.uGroundAlbedo.value).multiplyScalar(0.75);
    this.hemi.intensity = lerp(0.55, 1.05, storm) * lerp(0.35, 1.0, smoothstep(-6, 10, elevDeg));
    this.fill.color.copy(h).lerp(new THREE.Color(0.6, 0.72, 1.0), 0.5);
    this.fill.intensity = 0.18 + 0.22 * storm;
    this.fill.position.set(-d.x, Math.abs(d.y) * 0.35 + 0.25, -d.z).multiplyScalar(1000);

    /* 阴影 */
    this.sun.castShadow = P.get('l_shadow');
    const res = P.get('q_shadowRes') | 0;
    if (this.sun.shadow.mapSize.x !== res) {
      this.sun.shadow.mapSize.set(res, res);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    if (this.scene?.fog) this.scene.fog.color.copy(fog);
    this._envDirty = true;
  }

  /** 场景特有的地面反弹色（唯一允许的差异：物理上不同地表的漫反射反弹） */
  setGroundAlbedo(colorHex) {
    this.uniforms.uGroundAlbedo.value.set(colorHex);
    this.hemi.groundColor.copy(this.uniforms.uGroundAlbedo.value).multiplyScalar(0.75);
    this._envDirty = true;
  }

  /** 更新：太阳跟随相机做阴影框、闪电、IBL 烘焙 */
  update(camera, dt, focus = null, tornado = null) {
    const u = this.uniforms;
    u.uTime.value += dt;

    /* ---- 中气旋跟随龙卷风 ---- */
    if (tornado) {
      u.uTornadoPos.value.copy(tornado.position);
      u.uTornadoRadius.value = tornado.baseRadius;
      u.uTornadoStrength.value = tornado.strength;
      this.sky.uniforms.uMesoCenter.value.set(tornado.position.x, tornado.position.z);
      this.sky.uniforms.uMesoStrength.value = 0.85 * tornado.strength;
    }
    this.sky.uniforms.uCloudWind.value.set(
      Math.cos(P.get('w_windDir') * DEG), Math.sin(P.get('w_windDir') * DEG),
    ).multiplyScalar(0.6 + P.get('w_windSpeed') * 0.05);
    this.sky.uniforms.uRain.value = 0.22 + 0.5 * P.get('l_storm');
    this.sky.update(camera);

    /* ---- 闪电 ---- */
    this._flashTimer -= dt;
    const stormy = P.get('l_storm');
    if (this._flashTimer <= 0 && stormy > 0.25) {
      this._flashTimer = lerp(9.5, 2.2, stormy) * (0.45 + Math.random());
      const n = 1 + (Math.random() * 3) | 0;
      for (let i = 0; i < n; i++) {
        this._pulses.push({ t: -i * (0.06 + Math.random() * 0.14), a: (0.55 + Math.random() * 0.75) * stormy });
      }
      const ang = Math.random() * Math.PI * 2;
      u.uFlashDir.value.set(Math.cos(ang), 0.4 + Math.random() * 0.5, Math.sin(ang)).normalize();
    }
    let flash = 0;
    for (let i = this._pulses.length - 1; i >= 0; i--) {
      const p = this._pulses[i];
      p.t += dt;
      if (p.t < 0) continue;
      const v = p.a * Math.exp(-p.t * 11.0) * (0.6 + 0.4 * Math.sin(p.t * 90));
      flash += Math.max(0, v);
      if (p.t > 0.7) this._pulses.splice(i, 1);
    }
    u.uFlash.value = Math.min(flash, 2.2);
    this._flashEnv = damp(this._flashEnv, u.uFlash.value, 22, dt);
    this.hemi.intensity = (lerp(0.55, 1.05, stormy) * lerp(0.35, 1.0, smoothstep(-6, 10, P.get('l_sunElev')))) + this._flashEnv * 2.6;

    /* ---- 阴影框：跟随焦点，按距离分档，纹素对齐 ---- */
    const f = focus || camera.position;
    const camDist = camera.position.distanceTo(f);
    const want = clamp(camDist * 1.25 + 180, 340, 3400);
    const bucket = Math.pow(2, Math.round(Math.log2(want / 256))) * 256;
    if (bucket !== this._shadowBucket) {
      this._shadowBucket = bucket;
      const c = this.sun.shadow.camera;
      c.left = -bucket; c.right = bucket; c.top = bucket; c.bottom = -bucket;
      c.near = 1; c.far = bucket * 4.5 + 2000;
      c.updateProjectionMatrix();
      this.sun.shadow.bias = -0.00035 * (bucket / 1024);
      this.sun.shadow.normalBias = 0.9 + bucket / 900;
    }
    const res = this.sun.shadow.mapSize.x;
    const texel = (bucket * 2) / res;
    const cx = Math.round(f.x / texel) * texel;
    const cz = Math.round(f.z / texel) * texel;
    const cy = Math.round(clamp(f.y, -5, 400) / texel) * texel;
    this.sunTarget.position.set(cx, cy, cz);
    this.sunTarget.updateMatrixWorld();
    const dist = bucket * 2.2 + 900;
    this.sun.position.set(cx + u.uSunDir.value.x * dist, cy + u.uSunDir.value.y * dist, cz + u.uSunDir.value.z * dist);
    this.sun.updateMatrixWorld();

    /* ---- IBL 烘焙（节流） ---- */
    this._envTimer -= dt;
    if ((this._envDirty && this._envTimer <= 0) || this._envTimer <= -2.5) {
      this._bakeEnv();
      this._envDirty = false;
      this._envTimer = 1.6;
    }
  }

  _bakeEnv() {
    const prevAuto = this.renderer.shadowMap.autoUpdate;
    this.renderer.shadowMap.autoUpdate = false;
    const old = this.envMap;
    try {
      this._envSky.position.set(0, 0, 0);
      this._envSky.updateMatrixWorld(true);
      const rt = this.pmrem.fromScene(this._envScene, 0.04, 10, 20000);
      this.envMap = rt.texture;
      if (this.scene) this.scene.environment = this.envMap;
      if (old) old.dispose?.();
      this._envRT?.dispose?.();
      this._envRT = rt;
    } catch (e) {
      window.__diag?.('PMREM bake failed: ' + e.message);
    }
    this.renderer.shadowMap.autoUpdate = prevAuto;
  }

  /**
   * 把内置材质（MeshStandardMaterial 等）的雾替换为共享高度雾，
   * 让建筑/船只/植被与天空、水面、龙卷风处在同一套空气透视里。
   */
  patchFog(material) {
    if (!material || material.userData.__fogPatched) return material;
    material.userData.__fogPatched = true;
    material.fog = true;
    const U = this.uniforms;
    /* 与已有的 onBeforeCompile 组合，绝不覆盖（地形/植被等自带注入） */
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer, ...rest) => {
      if (typeof prev === 'function') prev.call(material, shader, renderer, ...rest);
      shader.uniforms.uFogColor = U.uFogColor;
      shader.uniforms.uFogDensity = U.uFogDensity;
      shader.uniforms.uFogHeightFalloff = U.uFogHeightFalloff;
      shader.uniforms.uFogSunAmount = U.uFogSunAmount;
      shader.uniforms.uSunDir = U.uSunDir;
      shader.uniforms.uSunColor = U.uSunColor;
      shader.uniforms.uFlash = U.uFlash;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFogWorld;')
        .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vFogWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vFogWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
        varying vec3 vFogWorld;
        uniform float uFlash;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        float sat(float v){ return clamp(v,0.0,1.0); }
        ${GLSL_AERIAL}`)
        .replace('#include <fog_fragment>', `
        gl_FragColor.rgb += vec3(0.55,0.62,0.85) * uFlash * 0.10;
        gl_FragColor.rgb = applyAerial(gl_FragColor.rgb, cameraPosition, vFogWorld, normalize(uSunDir), uSunColor);
        `);
    };
    material.needsUpdate = true;
    this._patched.add(material);
    return material;
  }

  /** 递归给对象树里的所有材质打补丁并设置合理的环境反射强度 */
  register(root, envIntensity = 1.0) {
    root.traverse?.((o) => {
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        this.patchFog(m);
        if ('envMapIntensity' in m) m.envMapIntensity = envIntensity;
      }
    });
    return root;
  }

  dispose() {
    this.sky.dispose();
    this.pmrem.dispose();
    this._envRT?.dispose?.();
  }
}
