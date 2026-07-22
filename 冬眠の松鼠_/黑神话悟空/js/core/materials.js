import * as THREE from 'three';
import { assets } from './assets.js';

// Adds world-space detail texturing on top of Kenney/KayKit flat materials so
// nothing in the scene reads as an untextured color block.

const detailCache = new Map();

function detailFor(kind) {
  if (detailCache.has(kind)) return detailCache.get(kind);
  let tex = null;
  if (kind === 'bark') tex = assets.tex('barkColor');
  else if (kind === 'rock') tex = assets.tex('rockColor');
  else if (kind === 'moss') tex = assets.tex('mossColor');
  else tex = assets.tex('groundColor');
  detailCache.set(kind, tex);
  return tex;
}

function classify(meshName, matName, modelName) {
  const s = `${modelName}/${meshName}/${matName}`.toLowerCase();
  if (/(trunk|wood|fence|bench|cross-wood|coffin|debris|stump|log|altar-wood|lightpost|shovel)/.test(s)) return 'bark';
  if (/(leaf|leaves|foliage|pine|bush|grass|plant|mushroom)/.test(s)) return 'moss';
  if (/(rock|stone|grave|crypt|pillar|column|statue|cliff|urn|border|road|altar|brick|obelisk|ring|head)/.test(s)) return 'rock';
  return 'rock';
}

export function applyDetailShader(material, kind, strength = 0.55, scale = 0.35) {
  if (material.userData.__detailApplied) return material;
  const tex = detailFor(kind);
  if (!tex) return material;
  material.userData.__detailApplied = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDetailMap = { value: tex };
    shader.uniforms.uDetailStrength = { value: strength };
    shader.uniforms.uDetailScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vDetailPos;\nvarying vec3 vDetailNormal;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n{\n  vec4 dwp = modelMatrix * vec4(transformed, 1.0);\n  vDetailPos = dwp.xyz;\n  vDetailNormal = normalize(mat3(modelMatrix) * objectNormal);\n}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uDetailMap;\nuniform float uDetailStrength;\nuniform float uDetailScale;\nvarying vec3 vDetailPos;\nvarying vec3 vDetailNormal;\nvec3 triDetail(sampler2D map, vec3 p, vec3 n, float sc){\n  vec3 an = abs(n) + 0.001;\n  an /= (an.x + an.y + an.z);\n  vec3 tx = texture2D(map, p.zy * sc).rgb;\n  vec3 ty = texture2D(map, p.xz * sc).rgb;\n  vec3 tz = texture2D(map, p.xy * sc).rgb;\n  return tx * an.x + ty * an.y + tz * an.z;\n}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n{\n  vec3 det = triDetail(uDetailMap, vDetailPos, vDetailNormal, uDetailScale);\n  float lum = dot(det, vec3(0.299, 0.587, 0.114));\n  vec3 overlayCol = diffuseColor.rgb * mix(vec3(1.0), det / max(lum, 0.001) * lum * 2.0, 0.5);\n  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.55 + det * 0.9), uDetailStrength);\n  diffuseColor.rgb = mix(diffuseColor.rgb, overlayCol, uDetailStrength * 0.35);\n}`);
  };
  material.needsUpdate = true;
  return material;
}

// Prepare a prop template: enable shadows, apply detail overlay, keep materials shared per-model.
export function prepareProp(scene, modelName, { detail = true, strength, scale } = {}) {
  const seen = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (!detail) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      const kind = classify(o.name, m.name, modelName);
      const key = `${m.uuid}`;
      if (!seen.has(key)) {
        const cloned = m.clone();
        cloned.name = m.name;
        applyDetailShader(cloned, kind, strength ?? (kind === 'moss' ? 0.4 : 0.6), scale ?? (kind === 'bark' ? 0.55 : 0.33));
        if (cloned.map) cloned.map.colorSpace = THREE.SRGBColorSpace;
        seen.set(key, cloned);
      }
      return seen.get(key);
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  return scene;
}

export function prepareCharacter(scene) {
  scene.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        m.metalness = Math.min(m.metalness ?? 0, 0.35);
      });
    }
  });
  return scene;
}

// tint helpers for status effects
export function setTint(root, color, emissiveIntensity = 0.65) {
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m.userData.__origEmissive) {
        m.userData.__origEmissive = m.emissive ? m.emissive.clone() : new THREE.Color(0, 0, 0);
        m.userData.__origEmissiveIntensity = m.emissiveIntensity ?? 1;
      }
      if (m.emissive) {
        m.emissive.set(color);
        m.emissiveIntensity = emissiveIntensity;
      }
    });
  });
}

export function clearTint(root) {
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (m.userData.__origEmissive && m.emissive) {
        m.emissive.copy(m.userData.__origEmissive);
        m.emissiveIntensity = m.userData.__origEmissiveIntensity;
      }
    });
  });
}

// clone materials for a character instance so tinting doesn't leak between clones
export function isolateMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    if (Array.isArray(o.material)) o.material = o.material.map((m) => m.clone());
    else o.material = o.material.clone();
  });
}
