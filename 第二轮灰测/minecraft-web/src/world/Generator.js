/* =====================================================================
 * Generator — 地形生成器
 *  阶段 1 generateChunk : 高度场 / 生物群系 / 表层 / 洞穴 / 矿脉 / 水
 *  阶段 2 decorate      : 树木 / 花草 / 甘蔗 / 睡莲 / 建筑（可写入邻区块）
 * ===================================================================== */
import {
  CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, BIOME,
} from '../core/Constants.js';
import { makeNoiseSet } from '../math/Noise.js';
import { Rng, hashSeed, hash2i } from '../math/Random.js';
import { clamp, clamp01, smoothstep, lerp } from '../math/MathUtils.js';
import { idByName } from '../data/blocks.js';
import { biomeInfo, pickBiome } from './Biomes.js';
import { STATE } from './Chunk.js';

/** 常用方块 ID 速查 */
const B = {};
function initIds() {
  const names = ['air', 'stone', 'dirt', 'grass_block', 'grass_block_snowy', 'sand', 'red_sand',
    'sandstone', 'gravel', 'clay', 'water', 'lava', 'bedrock', 'snow_block', 'ice', 'terracotta',
    'coal_ore', 'iron_ore', 'copper_ore', 'gold_ore', 'redstone_ore', 'lapis_ore', 'diamond_ore',
    'emerald_ore', 'granite', 'diorite', 'andesite', 'cobblestone', 'mossy_cobblestone',
    'oak_log', 'oak_leaves', 'birch_log', 'birch_leaves', 'spruce_log', 'spruce_leaves',
    'jungle_log', 'jungle_leaves', 'oak_planks', 'spruce_planks', 'tall_grass', 'fern',
    'dandelion', 'poppy', 'blue_orchid', 'red_mushroom', 'brown_mushroom', 'dead_bush',
    'cactus', 'sugar_cane', 'lily_pad', 'pumpkin', 'melon', 'vine', 'torch', 'chest',
    'crafting_table', 'furnace', 'glass', 'white_concrete', 'orange_concrete', 'red_concrete',
    'light_gray_concrete', 'yellow_concrete', 'bookshelf', 'glowstone', 'obsidian',
    'oak_sapling', 'podzol', 'coarse_dirt', 'smooth_stone', 'stone_bricks', 'bricks_hay'];
  for (const n of names) B[n] = idByName(n);
}
initIds();

const ORES = [
  { id: 'coal_ore', tries: 20, size: 14, minY: 6, maxY: 100 },
  { id: 'iron_ore', tries: 16, size: 9, minY: 5, maxY: 64 },
  { id: 'copper_ore', tries: 10, size: 10, minY: 20, maxY: 72 },
  { id: 'gold_ore', tries: 4, size: 7, minY: 5, maxY: 34 },
  { id: 'redstone_ore', tries: 6, size: 8, minY: 5, maxY: 22 },
  { id: 'lapis_ore', tries: 3, size: 7, minY: 8, maxY: 36 },
  { id: 'diamond_ore', tries: 2, size: 6, minY: 3, maxY: 16 },
  { id: 'gravel', tries: 7, size: 30, minY: 10, maxY: 92 },
  { id: 'andesite', tries: 6, size: 34, minY: 5, maxY: 72 },
  { id: 'granite', tries: 5, size: 34, minY: 5, maxY: 62 },
  { id: 'diorite', tries: 5, size: 34, minY: 5, maxY: 62 },
  { id: 'dirt', tries: 5, size: 26, minY: 24, maxY: 92 },
];

export class Generator {
  constructor(options = {}) {
    this.seedString = options.seed ?? 'mineweb';
    this.seed = hashSeed(this.seedString);
    this.type = options.type || 'default';
    this.structures = options.structures !== false;
    this.noise = makeNoiseSet(this.seed);
    this.seaLevel = SEA_LEVEL;

    // 世界类型参数
    this.amplify = this.type === 'amplified' ? 2.0 : 1.0;
    this.flat = this.type === 'flat';
    this.islands = this.type === 'islands';
    this.allWater = this.type === 'water';

    // 高度缓存（相邻区块共享列信息，减少重复噪声计算）
    this._colCache = new Map();
  }

  /* ---------------- 列信息（高度 + 生物群系） ---------------- */
  columnInfo(wx, wz) {
    const key = wx * 46341 + wz;
    const cached = this._colCache.get(key);
    if (cached) return cached;

    const n = this.noise;
    let h, biome, temp, humid, weird = 0, riverAmount = 0;

    if (this.flat) {
      h = 40;
      temp = 0.5; humid = 0;
      biome = BIOME.PLAINS;
    } else {
      // 域扰动，让海岸线更自然
      const wxx = wx + n.weird.simplex2(wx * 0.004, wz * 0.004) * 12;
      const wzz = wz + n.weird.simplex2(wx * 0.004 + 33, wz * 0.004 - 17) * 12;

      const continent = n.continent.fbm2(wxx * 0.0018, wzz * 0.0018, 5, 2, 0.5);
      const erosion = n.erosion.fbm2(wxx * 0.0052, wzz * 0.0052, 3, 2, 0.5);
      const ridge = n.ridge.ridged2(wxx * 0.0062, wzz * 0.0062, 4, 2, 0.5);
      const detail = n.detail.fbm2(wxx * 0.028, wzz * 0.028, 3, 2, 0.5);
      temp = clamp(n.temperature.fbm2(wx * 0.0011 + 120, wz * 0.0011 - 40, 3, 2, 0.5) * 2.1, -1, 1);
      humid = clamp(n.humidity.fbm2(wx * 0.0014 - 90, wz * 0.0014 + 250, 3, 2, 0.5) * 2.1, -1, 1);
      weird = n.weird.fbm2(wx * 0.0032, wz * 0.0032, 2, 2, 0.5) * 1.6;

      if (this.islands) {
        const isl = n.continent.fbm2(wxx * 0.006, wzz * 0.006, 4, 2, 0.5);
        h = this.seaLevel - 7 + Math.pow(clamp01(isl * 1.5 + 0.15), 1.6) * 42 + detail * 2.5;
      } else if (this.allWater) {
        h = 22 + detail * 4 + continent * 6;
      } else {
        // 大陆度整形：偏移后约 2/3 为陆地
        const cont = continent * 1.62 + 0.22;
        if (cont < 0) {
          h = this.seaLevel - 2 + cont * 26;                 // 海洋盆地
        } else {
          h = this.seaLevel + 1 + cont * 23;                 // 陆地
          const mountMask = smoothstep(clamp01((cont - 0.34) / 0.52));
          const rough = 0.45 + 0.55 * clamp01(erosion * 0.5 + 0.5);
          h += ridge * 38 * mountMask * rough;
        }
        h += detail * 3.2;

        // 侵蚀：高侵蚀地区更平坦
        const flatten = clamp01(erosion * 0.5 + 0.5);
        h = lerp(h, this.seaLevel + 4 + cont * 11, flatten * 0.3);

        // 放大化
        if (this.amplify !== 1) h = this.seaLevel + (h - this.seaLevel) * this.amplify;

        // 河流
        const r = Math.abs(n.river.simplex2(wx * 0.0021, wz * 0.0021));
        if (r < 0.032 && h > this.seaLevel - 2) {
          riverAmount = 1 - smoothstep(r / 0.032);
          const target = this.seaLevel - 2.5;
          h = lerp(h, target, riverAmount * 0.92);
        }
      }
    }

    h = clamp(Math.round(h), 2, CHUNK_HEIGHT - 12);
    if (!this.flat) {
      biome = pickBiome(temp, humid, h, this.seaLevel, weird);
      if (riverAmount > 0.45 && biome !== BIOME.OCEAN) biome = BIOME.RIVER;
    }

    const info = { h, biome, temp, humid, weird, river: riverAmount };
    if (this._colCache.size > 70000) this._colCache.clear();
    this._colCache.set(key, info);
    return info;
  }

  /** 供出生点搜索使用 */
  surfaceHeight(wx, wz) { return this.columnInfo(wx, wz).h; }

  /* ---------------- 阶段 1：地形 ---------------- */
  generateChunk(chunk) {
    const ox = chunk.originX, oz = chunk.originZ;
    const blocks = chunk.blocks;
    const sea = this.seaLevel;
    const rng = new Rng((this.seed ^ (chunk.cx * 341873128) ^ (chunk.cz * 132897987)) >>> 0);

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = ox + x, wz = oz + z;
        const info = this.columnInfo(wx, wz);
        const h = info.h;
        const biome = info.biome;
        const bi = biomeInfo(biome);
        chunk.biomes[(z << 4) | x] = biome;

        const surfaceId = B[bi.surface] ?? B.grass_block;
        const fillerId = B[bi.filler] ?? B.dirt;
        const underwaterId = B[bi.underwater] ?? B.dirt;
        const isUnderwater = h < sea;
        const colBase = (z << 4) | x;

        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = B.bedrock;
          else if (y <= 3 && hash2i(this.seed, wx * 31 + y, wz * 17) < (4 - y) * 0.3) id = B.bedrock;
          else {
            const depth = h - y;
            if (this.flat) {
              id = y === h ? B.grass_block : (depth <= 3 ? B.dirt : B.stone);
            } else if (depth === 0) {
              id = isUnderwater ? underwaterId : surfaceId;
              if (isUnderwater && biome === BIOME.OCEAN && rng.chance(0.12)) id = B.clay;
            } else if (depth <= 3) {
              id = isUnderwater ? underwaterId : fillerId;
              if (biome === BIOME.DESERT && depth <= 4) id = B.sand;
            } else if (depth <= 7 && biome === BIOME.DESERT) {
              id = B.sandstone;
            } else if (biome === BIOME.MESA && y > sea) {
              id = this._mesaBand(y);
            } else {
              id = B.stone;
            }
          }
          blocks[(y << 8) | colBase] = id;
        }

        // 水面 / 冰
        if (h < sea && !this.flat) {
          for (let y = h + 1; y <= sea; y++) blocks[(y << 8) | colBase] = B.water;
          if (bi.temp <= 0.05 && B.ice) blocks[(sea << 8) | colBase] = B.ice;
        }
      }
    }

    if (!this.flat) {
      this._carveCaves(chunk);
      this._generateOres(chunk, rng);
    }

    chunk.recomputeAllColumns();
    chunk.recomputeSectionEmptiness();
    chunk.state = STATE.GENERATED;
    return chunk;
  }

  _mesaBand(y) {
    const band = (y * 7 + 3) % 23;
    if (band < 3) return B.orange_concrete || B.terracotta;
    if (band < 5) return B.white_concrete || B.terracotta;
    if (band < 7) return B.light_gray_concrete || B.terracotta;
    if (band < 9) return B.red_concrete || B.terracotta;
    if (band < 11) return B.yellow_concrete || B.terracotta;
    return B.terracotta;
  }

  /* ---------------- 洞穴 ---------------- */
  _carveCaves(chunk) {
    const ox = chunk.originX, oz = chunk.originZ;
    const blocks = chunk.blocks;
    const n = this.noise;
    const sea = this.seaLevel;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = ox + x, wz = oz + z;
        const colBase = (z << 4) | x;
        const surface = this.columnInfo(wx, wz).h;
        const top = Math.min(surface - 1, CHUNK_HEIGHT - 1);

        for (let y = 4; y <= top; y++) {
          const id = blocks[(y << 8) | colBase];
          if (id === B.air || id === B.water || id === B.bedrock) continue;

          // 蠕虫隧道：两个 3D 噪声的交集
          const s = 0.0195, ys = 0.036;
          const n1 = n.cave.simplex3(wx * s, y * ys, wz * s);
          const n2 = n.cave2.simplex3(wx * s + 41.7, y * ys - 13.3, wz * s + 91.1);
          let carve = (n1 * n1 + n2 * n2) < 0.0022;

          // 大型溶洞（深处）
          if (!carve && y < 44) {
            const c = n.cave.fbm3(wx * 0.011, y * 0.021, wz * 0.011, 3, 2, 0.5);
            const bias = (44 - y) / 44 * 0.14;
            if (c > 0.60 - bias) carve = true;
          }

          if (carve) {
            // 海底保护：不要在水下 3 格内开洞，避免"排空海洋"
            if (surface < sea && y > surface - 4) continue;
            blocks[(y << 8) | colBase] = (y <= 6) ? B.lava : B.air;
          }
        }
      }
    }
  }

  /* ---------------- 矿脉 ---------------- */
  _generateOres(chunk, rng) {
    const blocks = chunk.blocks;
    const biomeAt = (x, z) => chunk.biomes[(z << 4) | x];

    for (const ore of ORES) {
      const oreId = B[ore.id];
      if (!oreId) continue;
      for (let t = 0; t < ore.tries; t++) {
        const cx = rng.int(0, 15), cz = rng.int(0, 15);
        const cy = rng.int(ore.minY, ore.maxY);
        if (cy >= CHUNK_HEIGHT - 1) continue;
        let px = cx, py = cy, pz = cz;
        const count = Math.max(1, Math.round(ore.size * rng.range(0.5, 1.0)));
        for (let k = 0; k < count; k++) {
          if (px >= 0 && px < 16 && pz >= 0 && pz < 16 && py > 0 && py < CHUNK_HEIGHT) {
            const i = (py << 8) | (pz << 4) | px;
            if (blocks[i] === B.stone) blocks[i] = oreId;
          }
          // 随机游走
          const d = rng.int(0, 5);
          if (d === 0) px++; else if (d === 1) px--;
          else if (d === 2) py++; else if (d === 3) py--;
          else if (d === 4) pz++; else pz--;
          px = clamp(px, 0, 15); pz = clamp(pz, 0, 15);
          py = clamp(py, 1, CHUNK_HEIGHT - 2);
        }
      }
    }

    // 绿宝石：仅山地，单点分布
    const emerald = B.emerald_ore;
    if (emerald) {
      for (let t = 0; t < 10; t++) {
        const x = rng.int(0, 15), z = rng.int(0, 15);
        const bm = biomeAt(x, z);
        if (bm !== BIOME.MOUNTAINS && bm !== BIOME.SNOWY_MOUNTAINS) continue;
        const y = rng.int(10, 90);
        const i = (y << 8) | (z << 4) | x;
        if (blocks[i] === B.stone) blocks[i] = emerald;
      }
    }
  }

  /* ==================================================================== *
   *  阶段 2：装饰（可跨区块写入，要求邻区块已生成）
   * ==================================================================== */
  decorate(chunk, world) {
    const rng = new Rng((this.seed ^ (chunk.cx * 0x1f1f1f1f) ^ (chunk.cz * 0x2c2c2c2c) ^ 0x5eed) >>> 0);
    const ox = chunk.originX, oz = chunk.originZ;
    const sea = this.seaLevel;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = ox + x, wz = oz + z;
        const ci = (z << 4) | x;
        const biome = chunk.biomes[ci];
        const bi = biomeInfo(biome);
        const h = chunk.heightMap[ci];       // 顶部方块 y+1
        if (h <= 0 || h >= CHUNK_HEIGHT - 8) continue;
        const groundY = h - 1;
        const ground = chunk.getBlock(x, groundY, z);
        const above = chunk.getBlock(x, groundY + 1, z);

        // ---- 水面装饰：睡莲 / 甘蔗 ----
        if (ground === B.water || above === B.water) {
          if (groundY >= sea - 1 && rng.chance(0.006) && B.lily_pad) {
            const wy = sea + 1;
            if (world.getBlockGen(wx, wy, wz) === B.air && world.getBlockGen(wx, wy - 1, wz) === B.water) {
              world.setBlockGen(wx, wy, wz, B.lily_pad);
            }
          }
          continue;
        }

        const soil = ground === B.grass_block || ground === B.dirt || ground === B.podzol ||
          ground === B.grass_block_snowy || ground === B.coarse_dirt;
        const sandy = ground === B.sand || ground === B.red_sand;

        // ---- 甘蔗（临水） ----
        if ((soil || sandy) && B.sugar_cane && rng.chance(0.05) && this._nearWater(world, wx, groundY, wz)) {
          const n = rng.int(1, 3);
          for (let k = 1; k <= n; k++) {
            if (world.getBlockGen(wx, groundY + k, wz) !== B.air) break;
            world.setBlockGen(wx, groundY + k, wz, B.sugar_cane);
          }
          continue;
        }

        // ---- 树 ----
        if (bi.tree && soil || (bi.tree && sandy && bi.tree.type === 'cactus') ||
            (bi.tree && sandy && bi.tree.type === 'deadbush')) {
          if (rng.float() < bi.tree.chance) {
            this._placeTree(world, wx, groundY + 1, wz, bi.tree.type, rng);
            continue;
          }
        }

        // ---- 花草 ----
        if (soil && above === B.air) {
          const r = rng.float();
          if (r < bi.grassDensity) {
            const plant = (biome === BIOME.TAIGA || biome === BIOME.JUNGLE) && rng.chance(0.3) ? B.fern : B.tall_grass;
            world.setBlockGen(wx, groundY + 1, wz, plant);
          } else if (r < bi.grassDensity + bi.flowerDensity) {
            const flowers = [B.dandelion, B.poppy, B.blue_orchid];
            world.setBlockGen(wx, groundY + 1, wz, rng.pick(flowers));
          } else if (r < bi.grassDensity + bi.flowerDensity + 0.0016 && biome === BIOME.SWAMP) {
            world.setBlockGen(wx, groundY + 1, wz, rng.chance(0.5) ? B.red_mushroom : B.brown_mushroom);
          } else if (r < bi.grassDensity + bi.flowerDensity + 0.0009) {
            world.setBlockGen(wx, groundY + 1, wz, rng.chance(0.5) ? B.pumpkin : B.melon);
          }
        }
        if (sandy && above === B.air && biome === BIOME.DESERT && rng.chance(0.004) && B.dead_bush) {
          world.setBlockGen(wx, groundY + 1, wz, B.dead_bush);
        }
      }
    }

    // ---- 洞穴蘑菇（低光处） ----
    for (let t = 0; t < 6; t++) {
      const x = rng.int(0, 15), z = rng.int(0, 15), y = rng.int(8, 46);
      const wx = ox + x, wz = oz + z;
      if (world.getBlockGen(wx, y, wz) === B.air && world.getBlockGen(wx, y - 1, wz) === B.stone) {
        if (rng.chance(0.4)) world.setBlockGen(wx, y, wz, rng.chance(0.5) ? B.brown_mushroom : B.red_mushroom);
      }
    }

    // ---- 建筑 ----
    if (this.structures) this._maybeStructure(chunk, world, rng);

    chunk.recomputeAllColumns();
    chunk.recomputeSectionEmptiness();
    chunk.state = STATE.DECORATED;
  }

  _nearWater(world, wx, wy, wz) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (world.getBlockGen(wx + dx, wy, wz + dz) === B.water) return true;
      }
    }
    return false;
  }

  /* ---------------- 树木 ---------------- */
  _placeTree(world, x, y, z, type, rng) {
    switch (type) {
      case 'cactus': {
        const n = rng.int(1, 3);
        for (let k = 0; k < n; k++) {
          if (world.getBlockGen(x, y + k, z) !== B.air) break;
          world.setBlockGen(x, y + k, z, B.cactus);
        }
        return;
      }
      case 'deadbush':
        world.setBlockGen(x, y, z, B.dead_bush);
        return;
      case 'spruce': return this._spruce(world, x, y, z, rng);
      case 'birch': return this._classicTree(world, x, y, z, rng, B.birch_log, B.birch_leaves, 6, 8);
      case 'jungle': return this._jungle(world, x, y, z, rng);
      case 'acacia': return this._acacia(world, x, y, z, rng);
      case 'swamp_oak': return this._swampOak(world, x, y, z, rng);
      case 'oak':
      default: return this._classicTree(world, x, y, z, rng, B.oak_log, B.oak_leaves, 4, 6);
    }
  }

  /** 经典橡木/白桦：树干 + 两层 5×5 + 两层 3×3 */
  _classicTree(world, x, y, z, rng, logId, leafId, minH, maxH) {
    const h = rng.int(minH, maxH);
    if (y + h + 2 >= CHUNK_HEIGHT) return;
    // 检查空间
    for (let k = 0; k < h; k++) {
      const b = world.getBlockGen(x, y + k, z);
      if (b !== B.air && b !== B.tall_grass && b !== B.fern) return;
    }
    for (let k = 0; k < h; k++) world.setBlockGen(x, y + k, z, logId);

    const topY = y + h - 1;
    for (let dy = -2; dy <= 1; dy++) {
      const ly = topY + dy;
      const radius = (dy <= -1) ? 2 : (dy === 0 ? 1 : 1);
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dz === 0 && dy < 1) continue;
          // 角落随机剪裁
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && (radius > 1 ? rng.chance(0.6) : true)) {
            if (radius > 1) continue;
          }
          if (world.getBlockGen(x + dx, ly, z + dz) === B.air) {
            world.setBlockGen(x + dx, ly, z + dz, leafId);
          }
        }
      }
    }
    // 顶部十字
    world.setBlockGen(x, topY + 2, z, leafId);
    if (world.getBlockGen(x + 1, topY + 1, z) === B.air) world.setBlockGen(x + 1, topY + 1, z, leafId);
    if (world.getBlockGen(x - 1, topY + 1, z) === B.air) world.setBlockGen(x - 1, topY + 1, z, leafId);
    if (world.getBlockGen(x, topY + 1, z + 1) === B.air) world.setBlockGen(x, topY + 1, z + 1, leafId);
    if (world.getBlockGen(x, topY + 1, z - 1) === B.air) world.setBlockGen(x, topY + 1, z - 1, leafId);
  }

  /** 云杉：锥形 */
  _spruce(world, x, y, z, rng) {
    const h = rng.int(7, 12);
    if (y + h + 2 >= CHUNK_HEIGHT) return;
    for (let k = 0; k < h; k++) {
      const b = world.getBlockGen(x, y + k, z);
      if (b !== B.air && b !== B.tall_grass) return;
    }
    for (let k = 0; k < h; k++) world.setBlockGen(x, y + k, z, B.spruce_log);
    let radius = 0;
    for (let dy = h - 1; dy >= 2; dy--) {
      const ly = y + dy;
      const step = (h - 1 - dy);
      radius = step === 0 ? 0 : Math.min(3, 1 + Math.floor(step / 2.2));
      if ((step % 4) === 3) radius = Math.max(0, radius - 1);
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dz === 0) continue;
          if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
          if (world.getBlockGen(x + dx, ly, z + dz) === B.air) {
            world.setBlockGen(x + dx, ly, z + dz, B.spruce_leaves);
          }
        }
      }
    }
    world.setBlockGen(x, y + h, z, B.spruce_leaves);
    world.setBlockGen(x, y + h + 1, z, B.spruce_leaves);
  }

  /** 丛林大树 + 藤蔓 */
  _jungle(world, x, y, z, rng) {
    const h = rng.int(8, 14);
    if (y + h + 3 >= CHUNK_HEIGHT) return;
    for (let k = 0; k < h; k++) {
      const b = world.getBlockGen(x, y + k, z);
      if (b !== B.air && b !== B.tall_grass && b !== B.fern) return;
    }
    for (let k = 0; k < h; k++) world.setBlockGen(x, y + k, z, B.jungle_log);
    const topY = y + h;
    for (let dy = -2; dy <= 1; dy++) {
      const ly = topY + dy;
      const radius = dy <= -1 ? 3 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dz * dz > radius * radius + 1) continue;
          if (world.getBlockGen(x + dx, ly, z + dz) === B.air) {
            world.setBlockGen(x + dx, ly, z + dz, B.jungle_leaves);
          }
        }
      }
    }
    // 藤蔓垂下
    if (B.vine) {
      for (let t = 0; t < 8; t++) {
        const dx = rng.int(-3, 3), dz = rng.int(-3, 3);
        let vy = topY - 2;
        const len = rng.int(2, 6);
        for (let k = 0; k < len; k++, vy--) {
          if (world.getBlockGen(x + dx, vy, z + dz) !== B.air) break;
          world.setBlockGen(x + dx, vy, z + dz, B.vine);
        }
      }
    }
  }

  /** 金合欢：斜干 + 平顶（用橡木材质近似） */
  _acacia(world, x, y, z, rng) {
    const h = rng.int(4, 6);
    if (y + h + 3 >= CHUNK_HEIGHT) return;
    let cx = x, cz = z;
    for (let k = 0; k < h; k++) world.setBlockGen(cx, y + k, cz, B.oak_log);
    const dir = rng.int(0, 3);
    const dx = dir === 0 ? 1 : dir === 1 ? -1 : 0;
    const dz = dir === 2 ? 1 : dir === 3 ? -1 : 0;
    for (let k = 0; k < 2; k++) {
      cx += dx; cz += dz;
      world.setBlockGen(cx, y + h + k, cz, B.oak_log);
    }
    const topY = y + h + 2;
    for (let ddz = -3; ddz <= 3; ddz++) {
      for (let ddx = -3; ddx <= 3; ddx++) {
        if (Math.abs(ddx) + Math.abs(ddz) > 4) continue;
        if (world.getBlockGen(cx + ddx, topY, cz + ddz) === B.air) {
          world.setBlockGen(cx + ddx, topY, cz + ddz, B.oak_leaves);
        }
        if (Math.abs(ddx) + Math.abs(ddz) <= 2 && world.getBlockGen(cx + ddx, topY + 1, cz + ddz) === B.air) {
          world.setBlockGen(cx + ddx, topY + 1, cz + ddz, B.oak_leaves);
        }
      }
    }
  }

  /** 沼泽橡木：宽冠 + 藤蔓 */
  _swampOak(world, x, y, z, rng) {
    const h = rng.int(5, 7);
    for (let k = 0; k < h; k++) world.setBlockGen(x, y + k, z, B.oak_log);
    const topY = y + h - 1;
    for (let dy = -1; dy <= 1; dy++) {
      const radius = dy === 1 ? 2 : 3;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dz * dz > radius * radius) continue;
          if (world.getBlockGen(x + dx, topY + dy, z + dz) === B.air) {
            world.setBlockGen(x + dx, topY + dy, z + dz, B.oak_leaves);
          }
        }
      }
    }
    if (B.vine) {
      for (let t = 0; t < 10; t++) {
        const dx = rng.int(-3, 3), dz = rng.int(-3, 3);
        let vy = topY - 1;
        for (let k = 0; k < rng.int(1, 4); k++, vy--) {
          if (world.getBlockGen(x + dx, vy, z + dz) !== B.air) break;
          world.setBlockGen(x + dx, vy, z + dz, B.vine);
        }
      }
    }
  }

  /* ---------------- 建筑 ---------------- */
  _maybeStructure(chunk, world, rng) {
    // 每 ~90 个区块出现一次
    const roll = hash2i(this.seed ^ 0xabcdef, chunk.cx, chunk.cz);
    if (roll > 0.014) return;

    const x0 = chunk.originX + rng.int(3, 10);
    const z0 = chunk.originZ + rng.int(3, 10);
    const ci = ((z0 - chunk.originZ) << 4) | (x0 - chunk.originX);
    const y0 = chunk.heightMap[ci];
    if (y0 < this.seaLevel + 1 || y0 > 100) return;

    // 地面平整度检查
    let minH = 999, maxH = 0;
    for (let dz = -1; dz <= 5; dz++) {
      for (let dx = -1; dx <= 5; dx++) {
        const h = world.surfaceHeightGen(x0 + dx, z0 + dz);
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }
    if (maxH - minH > 3) return;

    if (roll < 0.007) this._hut(world, x0, minH, z0, rng);
    else this._ruin(world, x0, minH, z0, rng);
  }

  /** 小木屋 */
  _hut(world, x, y, z, rng) {
    const W = 5, D = 5, H = 3;
    const plank = B.oak_planks, log = B.oak_log, cobble = B.cobblestone;
    for (let dz = 0; dz < D; dz++) {
      for (let dx = 0; dx < W; dx++) {
        world.setBlockGen(x + dx, y - 1, z + dz, cobble);
        for (let dy = 0; dy < H; dy++) world.setBlockGen(x + dx, y + dy, z + dz, B.air);
      }
    }
    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const isCorner = (dx === 0 || dx === W - 1);
        world.setBlockGen(x + dx, y + dy, z, isCorner ? log : plank);
        world.setBlockGen(x + dx, y + dy, z + D - 1, isCorner ? log : plank);
      }
      for (let dz = 1; dz < D - 1; dz++) {
        world.setBlockGen(x, y + dy, z + dz, plank);
        world.setBlockGen(x + W - 1, y + dy, z + dz, plank);
      }
    }
    // 门洞
    world.setBlockGen(x + 2, y, z, B.air);
    world.setBlockGen(x + 2, y + 1, z, B.air);
    // 窗
    if (B.glass) {
      world.setBlockGen(x, y + 1, z + 2, B.glass);
      world.setBlockGen(x + W - 1, y + 1, z + 2, B.glass);
      world.setBlockGen(x + 2, y + 1, z + D - 1, B.glass);
    }
    // 屋顶
    for (let dz = -1; dz <= D; dz++) {
      for (let dx = -1; dx <= W; dx++) {
        world.setBlockGen(x + dx, y + H, z + dz, B.spruce_planks || plank);
      }
    }
    for (let dz = 0; dz < D; dz++) {
      for (let dx = 0; dx < W; dx++) {
        if (dx > 0 && dx < W - 1 && dz > 0 && dz < D - 1) {
          world.setBlockGen(x + dx, y + H + 1, z + dz, B.spruce_planks || plank);
        }
      }
    }
    // 内部
    if (B.torch) world.setBlockGen(x + 1, y + 1, z + 1, B.torch);
    if (B.crafting_table) world.setBlockGen(x + 3, y, z + 1, B.crafting_table);
    if (B.furnace) world.setBlockGen(x + 3, y, z + 2, B.furnace);
    if (B.chest) world.setBlockGen(x + 1, y, z + 3, B.chest);
  }

  /** 废墟：残破石柱 + 苔石 */
  _ruin(world, x, y, z, rng) {
    const cobble = B.cobblestone, mossy = B.mossy_cobblestone;
    const size = rng.int(4, 7);
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        const edge = dx === 0 || dz === 0 || dx === size - 1 || dz === size - 1;
        world.setBlockGen(x + dx, y - 1, z + dz, rng.chance(0.5) ? cobble : mossy);
        if (!edge) continue;
        const h = rng.int(0, 3);
        for (let dy = 0; dy < h; dy++) {
          if (rng.chance(0.25)) continue;
          world.setBlockGen(x + dx, y + dy, z + dz, rng.chance(0.4) ? mossy : cobble);
        }
      }
    }
    if (rng.chance(0.5) && B.torch) world.setBlockGen(x + 1, y, z + 1, B.torch);
    if (rng.chance(0.35) && B.chest) world.setBlockGen(x + 2, y, z + 2, B.chest);
  }
}
