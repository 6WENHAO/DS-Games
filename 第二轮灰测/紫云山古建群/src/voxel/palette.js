import * as THREE from 'three';

/**
 * 体素调色板 —— 中式古建常用材质
 * vary:      每块随机明度扰动幅度（模拟 Minecraft 材质噪点）
 * opaque:    false 时不参与相邻面剔除
 * shadow:    false 时不投射阴影（云、灯笼等）
 * emissive:  自发光（灯笼、烛火）
 */
export const PALETTE = {
  // ---- 地面 / 环境 ----
  GRASS:         { color: 0x527f34, roughness: 0.96, vary: 0.17 },
  GRASS_DARK:    { color: 0x3c6427, roughness: 0.96, vary: 0.15 },
  MOSS:          { color: 0x63893c, roughness: 0.96, vary: 0.13 },
  SOIL:          { color: 0x6b5236, roughness: 1.0,  vary: 0.13 },

  // ---- 铺装 / 石作 ----
  PAVE:          { color: 0x928f86, roughness: 0.92, vary: 0.13 },
  PAVE_DARK:     { color: 0x74716a, roughness: 0.92, vary: 0.11 },
  PAVE_LIGHT:    { color: 0xaba795, roughness: 0.86, vary: 0.11 },
  MARBLE:        { color: 0xd2ccb8, roughness: 0.74, vary: 0.09 },
  MARBLE_DARK:   { color: 0xaaa48f, roughness: 0.8,  vary: 0.09 },
  STONE:         { color: 0x88837a, roughness: 0.9,  vary: 0.13 },
  STONE_DARK:    { color: 0x5f5b53, roughness: 0.9,  vary: 0.11 },

  // ---- 墙体 / 木作 ----
  WALL_RED:      { color: 0xa03427, roughness: 0.86, vary: 0.11 },
  WALL_RED_DARK: { color: 0x7d2418, roughness: 0.86, vary: 0.09 },
  PLASTER:       { color: 0xd8cdb5, roughness: 0.92, vary: 0.09 },
  COLUMN:        { color: 0x8f2c20, roughness: 0.7,  vary: 0.07 },
  WOOD:          { color: 0x8d5c30, roughness: 0.82, vary: 0.11 },
  WOOD_DARK:     { color: 0x5b3920, roughness: 0.82, vary: 0.1  },
  DOOR:          { color: 0x7d2c1d, roughness: 0.62, vary: 0.07 },
  WINDOW:        { color: 0x2a2017, roughness: 0.6,  vary: 0.06 },
  LATTICE:       { color: 0xab7440, roughness: 0.72, vary: 0.09 },

  // ---- 瓦作（琉璃 / 青瓦）----
  TILE_GOLD:     { color: 0xd6a42b, roughness: 0.42, metalness: 0.34, vary: 0.11 },
  TILE_GOLD_RIB: { color: 0xf2c95a, roughness: 0.34, metalness: 0.36, vary: 0.09 },
  TILE_GREEN:    { color: 0x2c6a44, roughness: 0.44, metalness: 0.26, vary: 0.11 },
  TILE_GREEN_RIB:{ color: 0x3f8b59, roughness: 0.38, metalness: 0.28, vary: 0.09 },
  TILE_GREY:     { color: 0x414a57, roughness: 0.6,  metalness: 0.14, vary: 0.11 },
  TILE_GREY_RIB: { color: 0x55606f, roughness: 0.54, metalness: 0.16, vary: 0.09 },
  RIDGE:         { color: 0xe9c256, roughness: 0.34, metalness: 0.48, vary: 0.08 },
  GOLD:          { color: 0xf4d167, roughness: 0.26, metalness: 0.66, vary: 0.07 },
  BRONZE:        { color: 0x7d6b3c, roughness: 0.44, metalness: 0.58, vary: 0.09 },

  // ---- 灯彩 ----
  LANTERN:       { color: 0xda3a2c, roughness: 0.5, emissive: 0xff5c28, emissiveBase: 0.85, vary: 0.05 },
  FLAME:         { color: 0xffcf86, roughness: 0.8, emissive: 0xffb347, emissiveBase: 1.25, vary: 0.05, shadow: false },

  // ---- 植物 ----
  LEAF:          { color: 0x33632f, roughness: 0.96, vary: 0.2  },
  LEAF_DARK:     { color: 0x244b26, roughness: 0.96, vary: 0.18 },
  LEAF_WARM:     { color: 0x6d7a2c, roughness: 0.96, vary: 0.19 },
  TRUNK:         { color: 0x4c3624, roughness: 0.96, vary: 0.13 },

  // ---- 水 / 云 ----
  WATER:         { color: 0x35708c, roughness: 0.18, metalness: 0.25, transparent: true, opacity: 0.82, opaque: false },
  CLOUD:         { color: 0xf3f0e7, roughness: 1.0, vary: 0.045, shadow: false, emissive: 0x9fb4cc, emissiveBase: 0.5 }
};

/** 材质名常量：M.WALL_RED === 'WALL_RED'，写错即为 undefined，便于早期报错 */
export const M = Object.freeze(
  Object.fromEntries(Object.keys(PALETTE).map((k) => [k, k]))
);

/** 生成 Three.js 材质表（颜色由 InstancedMesh 的实例色承载） */
export function createMaterials() {
  const mats = {};
  for (const [key, def] of Object.entries(PALETTE)) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: def.roughness ?? 0.9,
      metalness: def.metalness ?? 0.0,
      transparent: !!def.transparent,
      opacity: def.opacity ?? 1.0,
      flatShading: false
    });
    if (def.emissive !== undefined) {
      mat.emissive = new THREE.Color(def.emissive);
      mat.emissiveIntensity = def.emissiveBase ?? 0.6;
    }
    mat.name = key;
    mats[key] = mat;
  }
  return mats;
}

/** 按时辰调整自发光强度（夜间灯笼更亮） */
export function setEmissiveScale(mats, scale) {
  for (const [key, def] of Object.entries(PALETTE)) {
    if (def.emissive === undefined) continue;
    mats[key].emissiveIntensity = (def.emissiveBase ?? 0.6) * scale;
  }
}
