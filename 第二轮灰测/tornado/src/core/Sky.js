/**
 * Sky.js — 风暴天空穹顶。
 * 解析大气散射 + 两层视差雷暴云 + 中气旋（云底在龙卷风上方旋转）+ 闪电照亮 + 雨幕。
 * 同一个材质既用于场景背景，也用于烘焙 IBL 环境贴图，保证三场景光影完全一致。
 */
import * as THREE from 'three';
import { GLSL_HASH, GLSL_NOISE2, GLSL_MATH, GLSL_PHASE, GLSL_ATMOS, GLSL_TONE } from './GlslLib.js';

export class Sky {
  /** @param {Record<string, THREE.IUniform>} shared 共享光照 uniform（按引用共用） */
  constructor(shared) {
    this.uniforms = Object.assign({
      uCloudHeight: { value: 1500 },
      uCloudScale: { value: 1.0 },
      uCloudWind: { value: new THREE.Vector2(0.9, 0.35) },
      uMesoCenter: { value: new THREE.Vector2(0, 0) },
      uMesoStrength: { value: 1.0 },
      uRain: { value: 0.35 },
    }, shared);

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main(){
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec3 vWorld;
        uniform float uTime, uFlash, uCloudHeight, uCloudScale, uMesoStrength, uRain;
        uniform vec2  uCloudWind, uMesoCenter;
        uniform vec3  uFlashDir, uFogColor;
        ${GLSL_HASH}${GLSL_NOISE2}${GLSL_MATH}${GLSL_PHASE}${GLSL_ATMOS}${GLSL_TONE}

        /* 云层密度：域扭曲 fbm + 中气旋旋转 + 螺旋雨带 */
        float cloudDensity(vec2 p, float lod){
          vec2 q = p * 0.00085 * uCloudScale;
          q += uCloudWind * uTime * 0.0016;
          /* 中气旋：绕龙卷风上方旋转，越近旋转越快 */
          vec2 rel = p - uMesoCenter;
          float d = length(rel);
          float meso = uMesoStrength * exp(-d / 2600.0);
          float ang = meso * (2.2 - 1.4 * sat(d / 3000.0)) + uTime * 0.055 * meso * 6.0;
          q = uMesoCenter * 0.00085 * uCloudScale + rot2(ang) * (q - uMesoCenter * 0.00085 * uCloudScale);
          float w = fbm2(q * 2.1 + vec2(3.1, 7.7), 3) - 0.5;
          float base = fbm2(q + w * 0.55, lod > 0.5 ? 4 : 5);
          /* 覆盖度重映射 */
          float cover = 0.30 + 0.62 * uStormCover;
          float dens = sat((base - (1.0 - cover)) / max(cover, 1e-3));
          /* 螺旋进流带 */
          float spiral = sin(atan(rel.y, rel.x) * 2.0 - d * 0.0022 + uTime * 0.10) * 0.5 + 0.5;
          dens = mix(dens, sat(dens * (0.55 + 0.85 * spiral)), meso * 0.85);
          return dens;
        }

        void main(){
          vec3 dir = normalize(vWorld - cameraPosition);
          vec3 sun = normalize(uSunDir);
          vec3 col = atmosphere(dir, sun);

          float cosT = dot(dir, sun);
          /* ---- 云层（两层视差） ---- */
          if(dir.y > 0.002){
            for(int L=0; L<2; L++){
              float H = uCloudHeight * (L == 0 ? 1.0 : 1.85);
              float t = (H - cameraPosition.y) / max(dir.y, 0.002);
              if(t <= 0.0 || t > 90000.0) continue;
              vec2 p = cameraPosition.xz + dir.xz * t;
              float dens = cloudDensity(p * (L == 0 ? 1.0 : 0.55), float(L));
              /* 地平线方向的云被大气吞没 */
              float fade = sat(dir.y * 7.5) * exp(-t * 0.000035);
              dens *= fade * (L == 0 ? 1.0 : 0.65);
              if(dens <= 0.001) continue;

              /* 简易云内光照：沿太阳方向偏移采样求"厚度差"→ 边缘银线 */
              vec2 sunOff = normalize(sun.xz + vec2(1e-4)) * 320.0;
              float dSun = cloudDensity((p + sunOff) * (L == 0 ? 1.0 : 0.55), 1.0);
              float thick = sat(dens * 1.6);
              float trans = exp(-thick * (2.4 + 2.2 * uStormDark));
              float silver = sat(dens - dSun) * hgPhase(cosT, 0.72) * 9.0;

              vec3 lit = uSunColor * (trans * 0.55 + silver) * (1.0 - 0.55 * uStormDark);
              vec3 shadowCol = mix(uHorizonColor * 0.42, vec3(0.055, 0.062, 0.078), uStormDark) * uSkyLuminance;
              vec3 cloudCol = mix(shadowCol, lit + shadowCol * 1.35, 0.55 + 0.45 * trans);
              /* 闪电从云内照亮 */
              float fl = uFlash * (0.6 + 0.8 * sat(dot(dir, normalize(uFlashDir + vec3(0.0, 0.35, 0.0)))));
              cloudCol += vec3(0.72, 0.80, 1.0) * fl * (0.5 + dens);
              col = mix(col, cloudCol, sat(dens * 1.25));
            }
          } else {
            /* 地平线以下：与地面雾同色，避免露出穹顶接缝 */
            float k = sat(-dir.y * 6.0);
            col = mix(col, uFogColor * (0.9 + 0.2 * uStormCover), k * 0.92);
          }

          /* ---- 雨幕：远处斜向条纹 ---- */
          if(uRain > 0.01 && dir.y > -0.06 && dir.y < 0.42){
            float streak = fbm2(vec2(atan(dir.z, dir.x) * 22.0, dir.y * 90.0 - uTime * 5.5), 3);
            float curtain = sat((streak - 0.42) * 2.6) * uRain * uStormCover * sat(1.0 - abs(dir.y - 0.14) * 3.2);
            col = mix(col, uFogColor * 0.9, curtain * 0.5);
          }

          /* 闪电整体照亮天空 */
          col += vec3(0.62, 0.70, 0.95) * uFlash * 0.45;
          gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
        }`,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), this.material);
    this.mesh.scale.setScalar(19000);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.name = 'sky';
  }

  /** 天穹跟随相机，避免穿出远裁剪面 */
  update(camera) {
    this.mesh.position.copy(camera.position);
    this.mesh.updateMatrix();
    this.mesh.updateMatrixWorld(true);
  }

  dispose() { this.material.dispose(); this.mesh.geometry.dispose(); }
}
