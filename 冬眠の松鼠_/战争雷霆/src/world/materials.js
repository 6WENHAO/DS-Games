import * as THREE from 'three';
import { makeNoise2D, fbm } from '../core/utils.js';

/**
 * 材质工具：程序化细节噪声贴图 + 三平面细节着色（让低多边形模型呈现表面纹理质感）
 */

let _noiseTex = null;

/** 生成可平铺的分形噪声贴图 */
export function getNoiseTexture() {
  if (_noiseTex) return _noiseTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const noise = makeNoise2D(1337);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 通过对四个偏移采样加权实现近似平铺
      const u = x / size, v = y / size;
      const n =
        fbm(noise, u * 8, v * 8, 4) * (1 - u) * (1 - v) +
        fbm(noise, (u - 1) * 8, v * 8, 4) * u * (1 - v) +
        fbm(noise, u * 8, (v - 1) * 8, 4) * (1 - u) * v +
        fbm(noise, (u - 1) * 8, (v - 1) * 8, 4) * u * v;
      const g = Math.round((n * 0.5 + 0.5) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  _noiseTex = new THREE.CanvasTexture(canvas);
  _noiseTex.wrapS = _noiseTex.wrapT = THREE.RepeatWrapping;
  _noiseTex.needsUpdate = true;
  return _noiseTex;
}

/**
 * 给材质注入三平面细节噪声（削弱大面积纯色的塑料感），可选迷彩斑块
 */
export function applySurfaceDetail(material, { scale = 0.55, strength = 0.34, camo = null, camoScale = 0.16 } = {}) {
  if (material.userData.__detailApplied) return material;
  material.userData.__detailApplied = true;
  const noiseTex = getNoiseTexture();

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDetailTex = { value: noiseTex };
    shader.uniforms.uDetailScale = { value: scale };
    shader.uniforms.uDetailStrength = { value: strength };
    shader.uniforms.uCamoColor = { value: camo ? new THREE.Color(camo) : new THREE.Color(0x000000) };
    shader.uniforms.uCamoScale = { value: camoScale };
    shader.uniforms.uCamoOn = { value: camo ? 1 : 0 };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDetailPos;
        varying vec3 vDetailNormal;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vDetailPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vDetailNormal = normalize(mat3(modelMatrix) * objectNormal);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uDetailTex;
        uniform float uDetailScale;
        uniform float uDetailStrength;
        uniform vec3 uCamoColor;
        uniform float uCamoScale;
        uniform float uCamoOn;
        varying vec3 vDetailPos;
        varying vec3 vDetailNormal;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 dw = abs(vDetailNormal);
          dw = dw * dw;
          dw /= (dw.x + dw.y + dw.z + 1e-5);
          float dn =
            texture2D(uDetailTex, vDetailPos.yz * uDetailScale).r * dw.x +
            texture2D(uDetailTex, vDetailPos.xz * uDetailScale).r * dw.y +
            texture2D(uDetailTex, vDetailPos.xy * uDetailScale).r * dw.z;
          float dn2 =
            texture2D(uDetailTex, vDetailPos.yz * uDetailScale * 4.7).r * dw.x +
            texture2D(uDetailTex, vDetailPos.xz * uDetailScale * 4.7).r * dw.y +
            texture2D(uDetailTex, vDetailPos.xy * uDetailScale * 4.7).r * dw.z;
          float shade = 1.0 - uDetailStrength * 0.5 + (dn * 0.7 + dn2 * 0.3) * uDetailStrength;
          diffuseColor.rgb *= shade;
          if (uCamoOn > 0.5) {
            float cp =
              texture2D(uDetailTex, vDetailPos.yz * uCamoScale).r * dw.x +
              texture2D(uDetailTex, vDetailPos.xz * uCamoScale).r * dw.y +
              texture2D(uDetailTex, vDetailPos.xy * uCamoScale).r * dw.z;
            float m = smoothstep(0.46, 0.54, cp);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uCamoColor * 2.0, m * 0.42);
          }
        }`);
  };
  material.needsUpdate = true;
  return material;
}

/** 遍历模型应用细节材质 & 阴影设置 */
export function prepareModel(root, { camo = null, castShadow = true, receiveShadow = true, detailScale = 0.55, strength = 0.34 } = {}) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = castShadow;
      o.receiveShadow = receiveShadow;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) {
          m.roughness = Math.min(1, (m.roughness ?? 1) * 0.98);
          m.metalness = Math.min(0.35, m.metalness ?? 0);
          applySurfaceDetail(m, { camo, scale: detailScale, strength });
        }
      });
    }
  });
  return root;
}
