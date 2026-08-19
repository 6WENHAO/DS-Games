/* =====================================================================
 * Biomes — 生物群系定义（表层方块、植被密度、颜色、生物）
 * ===================================================================== */
import { BIOME } from '../core/Constants.js';

/**
 * surface : 最上层方块
 * filler  : 表层以下 3~4 格
 * tree    : { type, chance }  每列的生成概率
 * grass   : 草/花密度
 */
export const BIOMES = {
  [BIOME.OCEAN]: {
    name: '海洋', surface: 'sand', filler: 'sand', underwater: 'gravel',
    tree: null, grassDensity: 0, flowerDensity: 0, temp: 0.5,
    fog: [0.62, 0.72, 0.85], grassTint: '#4d8a4a', mobs: ['squid'],
  },
  [BIOME.RIVER]: {
    name: '河流', surface: 'sand', filler: 'sand', underwater: 'sand',
    tree: null, grassDensity: 0.02, flowerDensity: 0.004, temp: 0.5,
    fog: [0.68, 0.78, 0.9], grassTint: '#5b9c3c', mobs: ['squid'],
  },
  [BIOME.BEACH]: {
    name: '沙滩', surface: 'sand', filler: 'sand', underwater: 'sand',
    tree: null, grassDensity: 0, flowerDensity: 0, temp: 0.7,
    fog: [0.75, 0.82, 0.92], grassTint: '#6ba03c', mobs: ['turtle'],
  },
  [BIOME.PLAINS]: {
    name: '平原', surface: 'grass_block', filler: 'dirt', underwater: 'dirt',
    tree: { type: 'oak', chance: 0.004 }, grassDensity: 0.13, flowerDensity: 0.02, temp: 0.8,
    fog: [0.72, 0.82, 0.95], grassTint: '#5d9c3c', mobs: ['pig', 'sheep', 'cow', 'chicken', 'horse'],
  },
  [BIOME.FOREST]: {
    name: '森林', surface: 'grass_block', filler: 'dirt', underwater: 'dirt',
    tree: { type: 'oak', chance: 0.055 }, grassDensity: 0.14, flowerDensity: 0.015, temp: 0.7,
    fog: [0.68, 0.78, 0.9], grassTint: '#4f8f34', mobs: ['pig', 'sheep', 'cow', 'wolf'],
  },
  [BIOME.FLOWER_FOREST]: {
    name: '繁花森林', surface: 'grass_block', filler: 'dirt', underwater: 'dirt',
    tree: { type: 'oak', chance: 0.03 }, grassDensity: 0.2, flowerDensity: 0.22, temp: 0.7,
    fog: [0.74, 0.85, 0.95], grassTint: '#5fa83f', mobs: ['rabbit', 'sheep', 'cow'],
  },
  [BIOME.BIRCH_FOREST]: {
    name: '白桦森林', surface: 'grass_block', filler: 'dirt', underwater: 'dirt',
    tree: { type: 'birch', chance: 0.06 }, grassDensity: 0.12, flowerDensity: 0.02, temp: 0.6,
    fog: [0.72, 0.82, 0.92], grassTint: '#589a3c', mobs: ['pig', 'sheep'],
  },
  [BIOME.TAIGA]: {
    name: '针叶林', surface: 'grass_block', filler: 'dirt', underwater: 'dirt',
    tree: { type: 'spruce', chance: 0.07 }, grassDensity: 0.08, flowerDensity: 0.004, temp: 0.25,
    fog: [0.66, 0.74, 0.85], grassTint: '#3f7a4a', mobs: ['wolf', 'rabbit', 'fox'],
  },
  [BIOME.SNOWY]: {
    name: '雪原', surface: 'grass_block_snowy', filler: 'dirt', underwater: 'dirt',
    tree: { type: 'spruce', chance: 0.012 }, grassDensity: 0.01, flowerDensity: 0, temp: 0.0,
    fog: [0.82, 0.88, 0.95], grassTint: '#7fa87f', mobs: ['rabbit', 'polar_bear'],
  },
  [BIOME.SNOWY_MOUNTAINS]: {
    name: '雪山', surface: 'snow_block', filler: 'stone', underwater: 'stone',
    tree: { type: 'spruce', chance: 0.006 }, grassDensity: 0, flowerDensity: 0, temp: -0.2,
    fog: [0.85, 0.9, 0.97], grassTint: '#7fa87f', mobs: ['goat'],
  },
  [BIOME.MOUNTAINS]: {
    name: '山地', surface: 'grass_block', filler: 'dirt', underwater: 'stone',
    tree: { type: 'spruce', chance: 0.01 }, grassDensity: 0.04, flowerDensity: 0.006, temp: 0.3,
    fog: [0.72, 0.8, 0.9], grassTint: '#4f8f5f', mobs: ['goat', 'sheep'],
  },
  [BIOME.DESERT]: {
    name: '沙漠', surface: 'sand', filler: 'sand', underwater: 'sand',
    tree: { type: 'cactus', chance: 0.012 }, grassDensity: 0.006, flowerDensity: 0, temp: 2.0,
    fog: [0.88, 0.82, 0.68], grassTint: '#bfb755', mobs: ['rabbit', 'husk'],
  },
  [BIOME.MESA]: {
    name: '恶地', surface: 'red_sand', filler: 'terracotta', underwater: 'red_sand',
    tree: { type: 'deadbush', chance: 0.02 }, grassDensity: 0.01, flowerDensity: 0, temp: 2.0,
    fog: [0.88, 0.74, 0.6], grassTint: '#b0a044', mobs: ['rabbit'],
  },
  [BIOME.SAVANNA]: {
    name: '热带草原', surface: 'grass_block', filler: 'dirt', underwater: 'dirt',
    tree: { type: 'acacia', chance: 0.012 }, grassDensity: 0.22, flowerDensity: 0.006, temp: 1.2,
    fog: [0.82, 0.82, 0.72], grassTint: '#a8a83c', mobs: ['horse', 'cow', 'sheep'],
  },
  [BIOME.JUNGLE]: {
    name: '丛林', surface: 'grass_block', filler: 'dirt', underwater: 'dirt',
    tree: { type: 'jungle', chance: 0.09 }, grassDensity: 0.3, flowerDensity: 0.03, temp: 0.95,
    fog: [0.6, 0.78, 0.68], grassTint: '#2f9c24', mobs: ['parrot', 'ocelot', 'chicken'],
  },
  [BIOME.SWAMP]: {
    name: '沼泽', surface: 'grass_block', filler: 'dirt', underwater: 'clay',
    tree: { type: 'swamp_oak', chance: 0.02 }, grassDensity: 0.16, flowerDensity: 0.01, temp: 0.8,
    fog: [0.48, 0.56, 0.45], grassTint: '#4c763a', mobs: ['slime', 'frog'],
  },
};

/** 兜底 */
export function biomeInfo(id) {
  return BIOMES[id] || BIOMES[BIOME.PLAINS];
}

/**
 * 由温度/湿度/高度/侵蚀度决定生物群系
 * 各输入范围约 [-1,1]，height 为绝对高度
 */
export function pickBiome(temp, humid, height, seaLevel, weird = 0) {
  if (height < seaLevel - 4) return BIOME.OCEAN;
  if (height <= seaLevel + 1) {
    return (temp < -0.45) ? BIOME.SNOWY : BIOME.BEACH;
  }

  const alt = height - seaLevel;
  if (alt > 44) return temp < -0.15 ? BIOME.SNOWY_MOUNTAINS : BIOME.MOUNTAINS;
  if (alt > 30 && weird > 0.1) return temp < -0.15 ? BIOME.SNOWY_MOUNTAINS : BIOME.MOUNTAINS;

  if (temp < -0.5) return humid > 0.1 ? BIOME.TAIGA : BIOME.SNOWY;
  if (temp < -0.1) {
    if (humid > 0.35) return BIOME.TAIGA;
    if (humid > -0.1) return BIOME.FOREST;
    return BIOME.PLAINS;
  }
  if (temp < 0.45) {
    if (humid > 0.5) return BIOME.SWAMP;
    if (humid > 0.2) return weird > 0 ? BIOME.BIRCH_FOREST : BIOME.FOREST;
    if (humid > -0.15) return weird > 0.35 ? BIOME.FLOWER_FOREST : BIOME.PLAINS;
    return BIOME.PLAINS;
  }
  // 炎热
  if (humid > 0.4) return BIOME.JUNGLE;
  if (humid > 0.0) return BIOME.SAVANNA;
  return weird > 0.45 ? BIOME.MESA : BIOME.DESERT;
}
