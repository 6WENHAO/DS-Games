/* =========================================================================
 * GREENFALL · worldgen.js —— 地形 / 生物群系 / 洞穴 / 矿脉 / 植被
 *
 * 世界是"无限"程序化生成的，但中心 ±1600 内布置了 26 处手工设计地标
 * （见 structures.js），因此既有定制地图的辨识度，也有无尽的可探索性。
 * ======================================================================= */
(function (GF) {
  'use strict';

  const CH = 16;            // 区块水平边长
  const H = 96;             // 世界高度
  const SEA = 32;           // 海平面
  GF.CHUNK = CH; GF.HEIGHT = H; GF.SEA = SEA;

  const idx = (x, y, z) => x + z * CH + y * CH * CH;
  GF.blockIndex = idx;

  const U = GF.util;

  /* ==================================================== 生物群系定义 */
  const BIOMES = [
    {
      key: 'meadow', name: '苔原草甸', map: '#6f9c4a', temp: 18, surf: 'grass', sub: 'dirt', deep: 'stone',
      tree: 'oak', treeD: 0.010, plants: [['grass_tall', 0.26], ['moss_carpet', 0.06], ['flower_white', 0.02],
        ['flower_red', 0.016], ['herb_yarrow', 0.012], ['herb_mint', 0.008], ['bush_berry', 0.012], ['mushroom_brown', 0.004]],
    },
    {
      key: 'fernwood', name: '蕨影林', map: '#4f7f3a', temp: 16, surf: 'grass', sub: 'dirt', deep: 'stone',
      tree: 'mixed', treeD: 0.055, plants: [['fern', 0.30], ['grass_tall', 0.12], ['moss_carpet', 0.14],
        ['mushroom_brown', 0.02], ['mushroom_toxic', 0.006], ['bush_berry', 0.01], ['herb_willow', 0.008]],
    },
    {
      key: 'giant', name: '巨木深林', map: '#2f5f30', temp: 15, surf: 'moss_ground', sub: 'rich_soil', deep: 'stone',
      tree: 'giant', treeD: 0.020, plants: [['fern', 0.26], ['moss_carpet', 0.30], ['glow_moss', 0.02],
        ['mushroom_brown', 0.03], ['mushroom_toxic', 0.01], ['herb_willow', 0.006]],
    },
    {
      key: 'pine', name: '松脊岭', map: '#3f6b52', temp: 10, surf: 'grass', sub: 'dirt', deep: 'stone',
      tree: 'pine', treeD: 0.050, plants: [['fern', 0.10], ['grass_tall', 0.10], ['bush_dead', 0.02], ['mushroom_brown', 0.012]],
    },
    {
      key: 'marsh', name: '雾沼泽', map: '#5a6b3a', temp: 19, surf: 'mud', sub: 'mud', deep: 'peat', wet: true,
      tree: 'dead', treeD: 0.016, plants: [['reeds', 0.22], ['cattail', 0.16], ['moss_carpet', 0.12],
        ['mushroom_toxic', 0.012], ['fern', 0.06]],
    },
    {
      key: 'rocky', name: '裸岩高地', map: '#8a8a80', temp: 8, surf: 'stone', sub: 'stone', deep: 'granite',
      tree: 'none', treeD: 0.002, plants: [['moss_carpet', 0.05], ['bush_dead', 0.01], ['grass_tall', 0.03]],
    },
    {
      key: 'blight', name: '孢化荒带', map: '#8f9c3a', temp: 21, surf: 'blight_soil', sub: 'dirt', deep: 'stone',
      tree: 'dead', treeD: 0.02, plants: [['spore_stalk', 0.10], ['mushroom_toxic', 0.05], ['bush_dead', 0.04], ['glow_moss', 0.02]],
      hazard: 'spore',
    },
    {
      key: 'coast', name: '砂岸', map: '#c9b98a', temp: 20, surf: 'sand', sub: 'sand', deep: 'stone',
      tree: 'none', treeD: 0.002, plants: [['reeds', 0.04], ['grass_tall', 0.05]],
    },
    {
      key: 'suburb', name: '旧城郊野', map: '#7a8a5a', temp: 18, surf: 'grass', sub: 'dirt', deep: 'stone',
      tree: 'oak', treeD: 0.014, plants: [['grass_tall', 0.24], ['moss_carpet', 0.08], ['bush_berry', 0.008], ['flower_white', 0.01]],
      urbanJunk: 0.004,
    },
    {
      key: 'farmland', name: '荒废农田', map: '#9c9c52', temp: 19, surf: 'grass', sub: 'rich_soil', deep: 'stone',
      tree: 'none', treeD: 0.004, plants: [['grass_tall', 0.34], ['crop_wheat_3', 0.03], ['flower_white', 0.01], ['bush_berry', 0.006]],
    },
  ];
  const BIOME_ID = {};
  BIOMES.forEach((b, i) => { b.id = i; BIOME_ID[b.key] = i; });
  GF.Biomes = { list: BIOMES, byKey: BIOME_ID };

  /* ============================================================ 主类 */
  class WorldGen {
    constructor(seed) {
      seed = seed | 0;
      this.seed = seed;
      const N = GF.Noise;
      this.nCont = new N(seed + 1);
      this.nHill = new N(seed + 2);
      this.nRidge = new N(seed + 3);
      this.nRiver = new N(seed + 4);
      this.nMoist = new N(seed + 5);
      this.nTemp = new N(seed + 6);
      this.nBlight = new N(seed + 7);
      this.nCave = new N(seed + 8);
      this.nCave2 = new N(seed + 9);
      this.nOre = new N(seed + 10);
      this.nGiant = new N(seed + 11);
      this.nDetail = new N(seed + 12);
      this._hCache = new Map();
    }

    /* --------------------------------------------------- 地形高度 */
    rawHeight(wx, wz) {
      const c = this.nCont.fbm2(wx * 0.0011, wz * 0.0011, 5);
      const h = this.nHill.fbm2(wx * 0.0075, wz * 0.0075, 4);
      const r = this.nRidge.ridged(wx * 0.0026, wz * 0.0026, 4);
      const d = this.nDetail.fbm2(wx * 0.03, wz * 0.03, 2);
      let e = c * 0.58 + h * 0.24 + r * 0.14 + d * 0.04;
      e = Math.pow(U.clamp(e, 0, 1), 1.28);
      let y = 14 + e * 68;
      // 河流：把河道压到海平面以下
      const rv = Math.abs(this.nRiver.fbm2(wx * 0.0015, wz * 0.0015, 3) - 0.5);
      if (rv < 0.024 && y > SEA - 6 && y < 62) {
        const t = 1 - rv / 0.024;
        y = U.lerp(y, SEA - 3.0, t * t * 0.95);
      }
      return y;
    }

    heightAt(wx, wz) {
      const k = wx * 100000 + wz;
      const c = this._hCache.get(k);
      if (c !== undefined) return c;
      let y = this.rawHeight(wx, wz);
      // 地标整平
      if (GF.Landmarks) y = GF.Landmarks.flatten(this, wx, wz, y);
      y = Math.max(6, Math.min(H - 22, Math.round(y)));
      if (this._hCache.size > 400000) this._hCache.clear();
      this._hCache.set(k, y);
      return y;
    }

    /* ------------------------------------------------- 生物群系选择 */
    biomeAt(wx, wz, hy) {
      const h = hy === undefined ? this.heightAt(wx, wz) : hy;
      const urban = GF.Landmarks ? GF.Landmarks.zoneAt(wx, wz) : null;
      if (urban && urban.biome) return BIOMES[BIOME_ID[urban.biome]];
      const m = this.nMoist.fbm2(wx * 0.0018, wz * 0.0018, 4);
      const t = this.nTemp.fbm2(wx * 0.0013, wz * 0.0013, 3) - (h - SEA) * 0.004;
      const bl = this.nBlight.fbm2(wx * 0.0035, wz * 0.0035, 3);
      const g = this.nGiant.fbm2(wx * 0.0009, wz * 0.0009, 2);
      if (h <= SEA + 1) return BIOMES[BIOME_ID['coast']];
      if (h > 60 + m * 6) return BIOMES[BIOME_ID['rocky']];
      if (bl > 0.745) return BIOMES[BIOME_ID['blight']];
      if (m > 0.66 && h < SEA + 5) return BIOMES[BIOME_ID['marsh']];
      if (g > 0.615 && m > 0.44) return BIOMES[BIOME_ID['giant']];
      if (t < 0.36) return BIOMES[BIOME_ID['pine']];
      if (m > 0.50) return BIOMES[BIOME_ID['fernwood']];
      if (m < 0.30 && t > 0.5) return BIOMES[BIOME_ID['farmland']];
      return BIOMES[BIOME_ID['meadow']];
    }

    /* ------------------------------------------------------ 区块生成 */
    generateChunk(cx, cz) {
      const B = GF.Blocks.ID;
      const blocks = new Uint16Array(CH * H * CH);
      const heightMap = new Int16Array(CH * CH);
      const biomeMap = new Uint8Array(CH * CH);
      const meta = { containers: [], lights: [], notes: [], spawns: [] };

      const AIR = 0, STONE = B.stone, WATER = B.water, DIRTY = B.water_dirty, BED = B.bedrock;

      /* ---- 1. 基础地层 ---- */
      for (let z = 0; z < CH; z++) {
        for (let x = 0; x < CH; x++) {
          const wx = cx * CH + x, wz = cz * CH + z;
          const hy = this.heightAt(wx, wz);
          const bio = this.biomeAt(wx, wz, hy);
          heightMap[x + z * CH] = hy;
          biomeMap[x + z * CH] = bio.id;
          const surfId = B[bio.surf], subId = B[bio.sub], deepId = B[bio.deep];
          const soilDepth = bio.key === 'rocky' ? 1 : 3 + ((wx * 7 + wz * 13) % 3);

          for (let y = 0; y <= hy; y++) {
            let id;
            if (y === 0) id = BED;
            else if (y === hy) id = (hy <= SEA) ? (bio.wet ? B.mud : B.sand) : surfId;
            else if (y > hy - soilDepth) id = subId;
            else if (y > hy - soilDepth - 6) id = deepId;
            else {
              // 岩层多样性：用 2³ 体素粒度的哈希，比三维噪声快一个量级
              const n = U.hash3(wx >> 1, y >> 1, wz >> 1, this.seed ^ 0x1b3d);
              id = n > 0.84 ? B.granite : (n < 0.17 ? B.limestone : STONE);
            }
            blocks[idx(x, y, z)] = id;
          }
          // 水体
          if (hy < SEA) {
            const wid = bio.key === 'marsh' ? DIRTY : WATER;
            for (let y = hy + 1; y <= SEA; y++) blocks[idx(x, y, z)] = wid;
          }
        }
      }

      /* ---- 2. 洞穴系统（4x4x4 降采样噪声场 + 三线性插值，快且更平滑） ---- */
      const GS = 4, GN = CH / GS + 1, GH = Math.floor(H / GS) + 1;
      const field = new Float32Array(GN * GN * GH);
      for (let gy = 0; gy < GH; gy++) for (let gz = 0; gz < GN; gz++) for (let gx = 0; gx < GN; gx++) {
        const wx = cx * CH + gx * GS, wz = cz * CH + gz * GS, y = gy * GS;
        const a = this.nCave.value3(wx * 0.028, y * 0.052, wz * 0.028);
        const b2 = this.nCave2.value3(wx * 0.026 + 61, y * 0.055, wz * 0.026 + 61);
        field[gx + gz * GN + gy * GN * GN] = Math.abs(a - 0.5) + Math.abs(b2 - 0.5);
      }
      const sampleField = (x, y, z) => {
        const fx = x / GS, fy = y / GS, fz = z / GS;
        const x0 = Math.min(GN - 2, fx | 0), y0 = Math.min(GH - 2, fy | 0), z0 = Math.min(GN - 2, fz | 0);
        const tx = fx - x0, ty = fy - y0, tz = fz - z0;
        const o = (xx, yy, zz) => field[xx + zz * GN + yy * GN * GN];
        const c00 = U.lerp(o(x0, y0, z0), o(x0 + 1, y0, z0), tx);
        const c10 = U.lerp(o(x0, y0, z0 + 1), o(x0 + 1, y0, z0 + 1), tx);
        const c01 = U.lerp(o(x0, y0 + 1, z0), o(x0 + 1, y0 + 1, z0), tx);
        const c11 = U.lerp(o(x0, y0 + 1, z0 + 1), o(x0 + 1, y0 + 1, z0 + 1), tx);
        return U.lerp(U.lerp(c00, c10, tz), U.lerp(c01, c11, tz), ty);
      };
      for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
        const wx = cx * CH + x, wz = cz * CH + z;
        const hy = heightMap[x + z * CH];
        const top = Math.min(hy - 3, H - 8);
        for (let y = 3; y <= top; y++) {
          const cur = blocks[idx(x, y, z)];
          if (cur === 0 || cur === WATER || cur === DIRTY) continue;
          if (sampleField(x, y, z) < 0.104) blocks[idx(x, y, z)] = AIR;
        }
        // 洞顶苔与荧光苔
        for (let y = 4; y <= top; y++) {
          if (blocks[idx(x, y, z)] !== 0) continue;
          const below = blocks[idx(x, y - 1, z)];
          if (below === 0) continue;
          const bb = GF.Blocks.list[below];
          if (!bb || !bb.solid) continue;
          const r = U.hash3(wx, y, wz, this.seed ^ 0x5a5a);
          if (r < 0.014) blocks[idx(x, y, z)] = B.glow_moss;
          else if (r < 0.022) blocks[idx(x, y, z)] = B.mushroom_brown;
          else if (r < 0.026) blocks[idx(x, y, z)] = B.bone_pile;
        }
      }

      /* ---- 3. 矿脉（单遍 + 2³ 体素簇） ---- */
      const ROCK = WorldGen._rockSet || (WorldGen._rockSet = (() => {
        const s = new Uint8Array(GF.Blocks.list.length);
        for (const k of ['stone', 'granite', 'limestone']) s[B[k]] = 1;
        return s;
      })());
      for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
        const wx = cx * CH + x, wz = cz * CH + z;
        const top = Math.min(60, heightMap[x + z * CH] - 3);
        for (let y = 3; y <= top; y++) {
          const cur = blocks[idx(x, y, z)];
          if (!ROCK[cur]) continue;
          const cr = U.hash3(wx >> 1, y >> 1, wz >> 1, this.seed ^ 0x0e0e);
          if (cr > 0.030) continue;                        // 绝大多数体素直接跳过
          if (U.hash3(wx, y, wz, 0x3c) > 0.66) continue;    // 簇内孔隙
          const deep = y < 30;
          let id;
          if (cr < 0.0075) id = B.coal_ore;
          else if (cr < 0.0130) id = B.iron_ore;
          else if (cr < 0.0170) id = B.copper_ore;
          else if (cr < 0.0195) id = deep ? B.lead_ore : B.coal_ore;
          else if (cr < 0.0220) id = B.sulfur_ore;
          else if (cr < 0.0245) id = B.niter_ore;
          else if (cr < 0.0262) id = deep ? B.quartz_vein : B.iron_ore;
          else if (cr < 0.0285) id = B.gravel;
          else id = (y > 22 && y < 42) ? B.clay : B.gravel;
          blocks[idx(x, y, z)] = id;
        }
      }

      /* ---- 4. 地表植被（含跨界大树） ---- */
      const setSafe = (x, y, z, id, overwrite) => {
        if (x < 0 || x >= CH || z < 0 || z >= CH || y < 1 || y >= H) return;
        const cur = blocks[idx(x, y, z)];
        if (!overwrite && cur !== 0 && !GF.Blocks.list[cur].liquid) return;
        blocks[idx(x, y, z)] = id;
      };
      const MARGIN = 10;
      for (let z = -MARGIN; z < CH + MARGIN; z++) {
        for (let x = -MARGIN; x < CH + MARGIN; x++) {
          const wx = cx * CH + x, wz = cz * CH + z;
          const inChunk = x >= 0 && x < CH && z >= 0 && z < CH;
          const tr = U.hash2(wx, wz, this.seed ^ 0x7f4a);
          // 区块外只可能贡献"跨界大树"，其余一律跳过（性能关键）
          if (!inChunk) {
            if (tr >= 0.056) continue;
            const hy2 = this.heightAt(wx, wz);
            if (hy2 <= SEA) continue;
            if (GF.Landmarks && GF.Landmarks.noVeg(wx, wz)) continue;
            const bio2 = this.biomeAt(wx, wz, hy2);
            if (tr < bio2.treeD) this._tree(bio2.tree, x, hy2 + 1, z, U.rngAt(wx, wz, this.seed ^ 0x1234), setSafe, B, bio2);
            continue;
          }
          const hy = heightMap[x + z * CH];
          if (hy <= SEA) { this._shorePlants(blocks, x, z, hy, wx, wz, setSafe, B); continue; }
          const bio = BIOMES[biomeMap[x + z * CH]];
          if (GF.Landmarks && GF.Landmarks.noVeg(wx, wz)) continue;

          // 树
          if (tr < bio.treeD) {
            const rnd = U.rngAt(wx, wz, this.seed ^ 0x1234);
            this._tree(bio.tree, x, hy + 1, z, rnd, setSafe, B, bio);
            continue;
          }

          // 地被
          const surf = blocks[idx(x, hy, z)];
          if (surf === 0) continue;

          // 地表裸露的砂砾滩 / 碎石地（徒手可采 → 燧石 → 石斧，开局的关键资源）
          const rockChance = bio.key === 'rocky' ? 0.085 : bio.key === 'coast' ? 0.055
            : bio.key === 'marsh' ? 0.010 : 0.016;
          if (U.hash2(wx, wz, this.seed ^ 0x6a17) < rockChance) {
            blocks[idx(x, hy, z)] = B.gravel;
            if (U.hash2(wz, wx, 0x77b1) < 0.10) setSafe(x, hy + 1, z, B.cobblestone);
            continue;
          }

          let acc = U.hash2(wx * 3 + 1, wz * 3 + 7, this.seed ^ 0x2f1d);
          for (const [pk, prob] of bio.plants) {
            if (acc < prob) { setSafe(x, hy + 1, z, B[pk]); break; }
            acc -= prob;
          }
          // 城郊垃圾与残骸
          if (bio.urbanJunk && U.hash2(wx, wz, this.seed ^ 0x9a1) < bio.urbanJunk) {
            setSafe(x, hy + 1, z, U.hash2(wz, wx, 5) < 0.5 ? B.trash_pile : B.rubble, true);
          }
          // 孢化带菌毯
          if (bio.key === 'blight' && U.hash2(wx, wz, 0x3131) < 0.02) {
            setSafe(x, hy + 1, z, B.fungal_wall, true);
          }
        }
      }

      /* ---- 5. 结构：地标 + 程序化 POI ---- */
      if (GF.Landmarks) {
        GF.Landmarks.buildChunk(this, cx, cz, {
          blocks, heightMap, biomeMap, meta, B,
          setW: (wx, wy, wz, id) => {
            const x = wx - cx * CH, z = wz - cz * CH;
            if (x < 0 || x >= CH || z < 0 || z >= CH || wy < 1 || wy >= H) return;
            blocks[idx(x, wy, z)] = id;
          },
          getW: (wx, wy, wz) => {
            const x = wx - cx * CH, z = wz - cz * CH;
            if (x < 0 || x >= CH || z < 0 || z >= CH || wy < 0 || wy >= H) return -1;
            return blocks[idx(x, wy, z)];
          },
          groundAt: (wx, wz) => this.heightAt(wx, wz),
          inChunk: (wx, wz) => {
            const x = wx - cx * CH, z = wz - cz * CH;
            return x >= 0 && x < CH && z >= 0 && z < CH;
          },
        });
      }

      /* ---- 6. 重算 heightMap（结构会改变地表） ---- */
      for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
        let top = 0;
        for (let y = H - 1; y >= 0; y--) {
          const id = blocks[idx(x, y, z)];
          if (id !== 0 && GF.Blocks.list[id].opaque) { top = y; break; }
        }
        heightMap[x + z * CH] = top;
      }

      return { blocks, heightMap, biomeMap, meta };
    }

    /* -------------------------------------------------- 岸边植物 */
    _shorePlants(blocks, x, z, hy, wx, wz, setSafe, B) {
      if (hy < SEA - 3) return;
      const r = U.hash2(wx, wz, this.seed ^ 0x77);
      if (r < 0.05) setSafe(x, SEA + 1, z, B.reeds);
      else if (r < 0.07) setSafe(x, SEA + 1, z, B.cattail);
    }

    /* ------------------------------------------------------ 树木 */
    _tree(kind, x, y, z, rnd, setSafe, B, bio) {
      if (kind === 'none') return;
      if (kind === 'mixed') kind = rnd() < 0.55 ? 'oak' : (rnd() < 0.6 ? 'birch' : 'pine');
      switch (kind) {
        case 'oak': return this._treeBroad(x, y, z, rnd, setSafe, B.log_oak, B.leaves_oak, 5, 8, B);
        case 'birch': return this._treeBroad(x, y, z, rnd, setSafe, B.log_birch, B.leaves_birch, 6, 10, B);
        case 'pine': return this._treeConifer(x, y, z, rnd, setSafe, B.log_pine, B.leaves_pine, 8, 15, B);
        case 'giant': return this._treeGiant(x, y, z, rnd, setSafe, B);
        case 'dead': return this._treeDead(x, y, z, rnd, setSafe, B);
      }
    }

    _treeBroad(x, y, z, rnd, setSafe, logId, leafId, hmin, hmax, B) {
      const h = hmin + Math.floor(rnd() * (hmax - hmin + 1));
      for (let i = 0; i < h; i++) setSafe(x, y + i, z, logId, true);
      const top = y + h;
      const r = 2 + (rnd() < 0.5 ? 0 : 1);
      for (let dy = -2; dy <= 1; dy++) {
        const rr = r - Math.abs(dy) * 0.5;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dz * dz > rr * rr + 0.6) continue;
          if (dx === 0 && dz === 0 && dy < 1) continue;
          setSafe(x + dx, top + dy, z + dz, leafId);
        }
      }
      // 垂挂藤蔓（绿蚀特征）
      for (let i = 0; i < 6; i++) {
        const dx = Math.floor((rnd() - 0.5) * (r * 2 + 1)), dz = Math.floor((rnd() - 0.5) * (r * 2 + 1));
        const len = 1 + Math.floor(rnd() * 4);
        for (let k = 0; k < len; k++) setSafe(x + dx, top - 2 - k, z + dz, B.vine);
      }
    }

    _treeConifer(x, y, z, rnd, setSafe, logId, leafId, hmin, hmax, B) {
      const h = hmin + Math.floor(rnd() * (hmax - hmin + 1));
      for (let i = 0; i < h; i++) setSafe(x, y + i, z, logId, true);
      let r = 3;
      for (let i = h - 1; i > 2; i--) {
        const rr = Math.max(0, Math.round(r * (i / h) * 1.5));
        for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
          if (Math.abs(dx) + Math.abs(dz) > rr + 0.5) continue;
          if (dx === 0 && dz === 0) continue;
          setSafe(x + dx, y + i, z + dz, leafId);
        }
      }
      setSafe(x, y + h, z, leafId);
      setSafe(x, y + h + 1, z, leafId);
    }

    _treeGiant(x, y, z, rnd, setSafe, B) {
      const h = 20 + Math.floor(rnd() * 14);
      // 2x2 树干 + 板根
      for (let i = 0; i < h; i++) {
        for (let dz = 0; dz <= 1; dz++) for (let dx = 0; dx <= 1; dx++)
          setSafe(x + dx, y + i, z + dz, B.log_giant, true);
      }
      for (let i = 0; i < 4; i++) {
        const a = i * 1.57 + 0.4;
        for (let k = 1; k <= 3; k++) {
          setSafe(x + Math.round(Math.cos(a) * k), y + Math.max(0, 3 - k), z + Math.round(Math.sin(a) * k), B.log_giant, true);
        }
      }
      // 分层冠盖
      for (let layer = 0; layer < 3; layer++) {
        const ly = y + h - layer * 4, rad = 6 - layer;
        for (let dy = -1; dy <= 1; dy++) for (let dz = -rad; dz <= rad + 1; dz++) for (let dx = -rad; dx <= rad + 1; dx++) {
          const d = Math.hypot(dx - 0.5, dz - 0.5);
          if (d > rad + (dy === 0 ? 0.8 : -0.4)) continue;
          setSafe(x + dx, ly + dy, z + dz, B.leaves_giant);
        }
      }
      // 巨藤
      for (let i = 0; i < 14; i++) {
        const a = rnd() * 6.283, d = 2 + rnd() * 5;
        const vx = x + Math.round(Math.cos(a) * d), vz = z + Math.round(Math.sin(a) * d);
        const len = 3 + Math.floor(rnd() * 10);
        const topY = y + h - 2 - Math.floor(rnd() * 6);
        for (let k = 0; k < len; k++) setSafe(vx, topY - k, vz, rnd() < 0.3 ? B.thick_vine : B.vine);
      }
    }

    _treeDead(x, y, z, rnd, setSafe, B) {
      const h = 3 + Math.floor(rnd() * 5);
      for (let i = 0; i < h; i++) setSafe(x, y + i, z, B.log_dead, true);
      if (rnd() < 0.6) setSafe(x + (rnd() < 0.5 ? 1 : -1), y + h - 1, z, B.log_dead);
      if (rnd() < 0.5) for (let i = 0; i < 3; i++) setSafe(x, y + h - 1 - i, z + 1, B.vine);
    }
  }

  GF.WorldGen = WorldGen;
})(globalThis.GF = globalThis.GF || {});
