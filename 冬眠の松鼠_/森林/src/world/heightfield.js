import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { CONFIG } from '../core/config.js';
import { makeRng } from '../core/rng.js';

// 岛屿高度场：径向衰减 + 多层分形噪声。
// 全部系统（地形网格、生成物、玩家物理、AI）共用该解析函数。
const rng = makeRng(CONFIG.seed);
const simplex = new SimplexNoise({ random: rng });

const SIZE = CONFIG.world.size;
const HALF = SIZE / 2;
const MAX_H = CONFIG.world.maxHeight;

function fbm(x, z, octaves, lacunarity = 2.0, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * simplex.noise(x * freq, z * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export function getHeight(x, z) {
  const nx = x / SIZE, nz = z / SIZE;

  // 径向岛屿轮廓（噪声扰动边缘）
  const distEdge = Math.sqrt(nx * nx + nz * nz) * 2; // 0 中心 -> 1 边缘
  const edgeNoise = 0.16 * simplex.noise(nx * 3.1 + 7.3, nz * 3.1 - 2.9);
  const island = Math.max(0, 1 - Math.pow(distEdge + edgeNoise, 2.2));

  // 基础起伏
  const base = fbm(nx * 2.4, nz * 2.4, 4) * 0.5 + 0.5;
  // 山脉脊线
  const ridgeRaw = 1 - Math.abs(fbm(nx * 1.7 + 11, nz * 1.7 - 5, 3));
  const ridge = Math.pow(ridgeRaw, 2.6);
  // 细节
  const detail = fbm(nx * 9 + 3, nz * 9 - 8, 3) * 0.5;

  let h = island * (base * 0.45 + ridge * 0.75 + detail * 0.08) * MAX_H;
  h -= 3.2; // 让边缘浸入海面，形成海滩
  return h;
}

export function getNormal(x, z, eps = 0.35) {
  const hL = getHeight(x - eps, z);
  const hR = getHeight(x + eps, z);
  const hD = getHeight(x, z - eps);
  const hU = getHeight(x, z + eps);
  // 未归一化法线
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = 2 * eps;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return { x: nx / len, y: ny / len, z: nz / len };
}

export function getSlope(x, z) {
  return 1 - getNormal(x, z).y; // 0 平地, ~1 悬崖
}

export function isInIsland(x, z, margin = 0) {
  return Math.abs(x) < HALF - margin && Math.abs(z) < HALF - margin;
}

export const WORLD_HALF = HALF;
