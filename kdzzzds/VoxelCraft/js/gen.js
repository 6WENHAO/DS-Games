/* gen.js - 世界生成共享模块（主线程 + Worker 双端注入） */
function GEN_MODULE(E) {
  'use strict';
  E.CH = 16;          // 区块宽
  E.CHH = 4000;       // 存储高（gen 空间；世界高 = CHH + Y0 = 3000）
  E.Y0 = -1000;       // 世界 y = gen y + Y0（y 轴下限 -1000，基岩层在 gen 0..3）
  E.SEA = 1046;       // 海平面（gen 空间，世界 46）

  let SEED = 1337;
  E.setSeed = function (s) { SEED = s | 0; };
  E.getSeed = function () { return SEED; };

  /* ---------------- 哈希与噪声 ---------------- */
  function h2(x, z, s) {
    let n = (x * 374761393 + z * 668265263 + (SEED + s) * 974711) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  function h3(x, y, z, s) {
    let n = (x * 374761393 + y * 987643211 + z * 668265263 + (SEED + s) * 974711) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  E.h2 = h2; E.h3 = h3;

  function vnoise(x, z, s) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
    const a = h2(xi, zi, s), b = h2(xi + 1, zi, s), c = h2(xi, zi + 1, s), d = h2(xi + 1, zi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z, f, oct, s) {
    let a = 0, amp = 1, tot = 0;
    for (let i = 0; i < oct; i++) { a += vnoise(x * f, z * f, s + i * 131) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
    return a / tot;
  }
  function ridged(x, z, f, oct, s) {
    let a = 0, amp = 1, tot = 0;
    for (let i = 0; i < oct; i++) {
      let n = vnoise(x * f, z * f, s + i * 57); n = 1 - Math.abs(n * 2 - 1); n *= n;
      a += n * amp; tot += amp; amp *= 0.55; f *= 2.1;
    }
    return a / tot;
  }
  function sstep(a, b, x) { x = (x - a) / (b - a); x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  E.fbm = fbm;

  /* ---------------- 群系 ---------------- */
  const B_PLAINS = 0, B_FOREST = 1, B_DESERT = 2, B_PLATEAU = 3, B_BASIN = 4, B_LAKE = 5, B_SNOW = 6;
  const B_SWAMP = 7, B_CHERRY = 8, B_MEADOW = 9, B_HIGHSNOW = 10, B_HIGHPEAK = 11;
  E.B_PLAINS = B_PLAINS; E.B_FOREST = B_FOREST; E.B_DESERT = B_DESERT; E.B_PLATEAU = B_PLATEAU;
  E.B_BASIN = B_BASIN; E.B_LAKE = B_LAKE; E.B_SNOW = B_SNOW;
  E.B_SWAMP = B_SWAMP; E.B_CHERRY = B_CHERRY; E.B_MEADOW = B_MEADOW; E.B_HIGHSNOW = B_HIGHSNOW; E.B_HIGHPEAK = B_HIGHPEAK;
  E.BIOME_NAMES = ['平原', '森林', '沙漠', '高原', '盆地', '湖泊', '雪山', '沼泽', '樱花林', '高原草甸', '高雪原', '高雪山'];

  /* 字段采集（可被 LOD 气候格点插值替代） */
  function fieldsAt(x, z) {
    return {
      temp: fbm(x, z, 1 / 2200, 3, 11),
      hum: fbm(x, z, 1 / 1800, 3, 23),
      cont: fbm(x, z, 1 / 1600, 4, 37),
      det: fbm(x, z, 1 / 70, 3, 41),
      mRaw: fbm(x, z, 1 / 2600, 3, 53),
      pRaw: fbm(x, z, 1 / 2000, 3, 67),
      bRaw: fbm(x, z, 1 / 2400, 3, 79),
      lkRaw: fbm(x, z, 1 / 700, 2, 97),
      rS: fbm(x, z, 1 / 1400, 3, 113),
      hlRaw: fbm(x, z, 1 / 4200, 3, 171),   // 高原巨区掩码（超低频，成片出现）
      pkRaw: fbm(x, z, 1 / 2400, 3, 173),   // 高原上的山脉走廊
      chRaw: fbm(x, z, 1 / 1500, 2, 181)    // 樱花林斑块
    };
  }

  /* 成形逻辑（近景与远景共用，保证一致）
   * 高原兼容改造：
   *  ① hl 掩码前置并加宽过渡带；台地/盆地/湖泊/河流按 (1-hl) 抑制（不在半山腰挖河/塌陷）
   *  ② 过渡环内叠加山麓丘陵支脉（ridged spur），取代均匀斜坡墙
   *  ③ 群系按海拔垂直带谱统一分带：山地针叶林带(235+) → 林线 → 草甸(520+) → 高雪原(700+) → 高雪山(1150+)
   *     各带界线均带噪声抖动，斑驳过渡 */
  function shapeColumn(x, z, f) {
    const temp = f.temp, hum = f.hum, cont = f.cont, det = f.det;
    const hl = sstep(0.56, 0.76, f.hlRaw);          // ① 高原掩码（加宽 → 山麓缓坡更长）
    const lowW = 1 - hl;
    const m = sstep(0.545, 0.70, f.mRaw);
    const p = sstep(0.575, 0.675, f.pRaw) * (1 - m) * lowW;
    const b = sstep(0.555, 0.675, f.bRaw) * (1 - m) * (1 - p) * lowW;
    const bSup = 1 - sstep(0.15, 0.40, b);          // 深盆地区抑制湖泊/河流（防蓄水切穿盆缘）
    const lk = sstep(0.655, 0.755, f.lkRaw) * (1 - m) * (1 - p) * Math.max(0, 1 - hl * 1.6) * bSup;
    const rS = f.rS * 2 - 1;
    const rv = (1 - sstep(0.0, 0.055, Math.abs(rS))) * Math.max(0, 1 - hl * 2.2) * bSup;

    let h = 1052 + (cont - 0.5) * 30 + (det - 0.5) * 7;
    if (m > 0) h += Math.pow(ridged(x, z, 1 / 900, 4, 131), 1.35) * 430 * m; // 巨型雪山（平原跳过 4 倍频）
    if (p > 0.001) {                                                        // 高原大台地
      const ph = fbm(x, z, 1 / 450, 3, 149) * 72 + 18;
      const terr = Math.floor(ph / 10) * 10;
      h = h * (1 - p) + (1056 + terr) * p;
    }
    let wlv = E.SEA;
    if (b > 0.001) {                       // 深盆地：环形护堤 + 巨型凹陷（世界可达 ~-640），盆底湖
      const rim = sstep(0.04, 0.30, b) * (1 - sstep(0.34, 0.55, b));
      if (rim > 0.001) h = h * (1 - rim) + Math.max(h, 1074 + rim * 10) * rim;   // 盆缘护堤（挡海水）
      const sink = sstep(0.32, 0.95, b);
      if (sink > 0.001) {
        const tgt = 1052 - Math.pow(sink, 1.45) * 690 + (det - 0.5) * 6;
        h = h * (1 - sink) + tgt * sink;
      }
      if (b > 0.32) wlv = 480;             // 盆内独立水位（世界 -520）：盆底湖，浅盆保持干燥
    }
    if (lk > 0.001) { const tgt = 1041.5 - lk * 4; h = h * (1 - lk) + tgt * lk; } // 湖泊
    if (rv > 0.02) {                                                        // 河流下切
      const tgt = 1042.5 - rv * 3;
      const cr = Math.min(1, rv * 1.5);
      if (h > tgt) h = h * (1 - cr) + tgt * cr;
    }
    /* 青藏式高原巨区：整体抬升 + 山脉走廊拔高 + ② 山麓丘陵支脉 */
    let pk = 0;
    if (hl > 0.004) {
      pk = sstep(0.50, 0.80, f.pkRaw);
      const base2 = 1560 + (cont - 0.5) * 120 + fbm(x, z, 1 / 700, 3, 193) * 150;
      let peaks = 0;
      if (pk > 0.004) peaks = Math.pow(ridged(x, z, 1 / 1500, 5, 191), 1.7) * 2600 * pk;
      const hHigh = base2 + peaks + (det - 0.5) * 14;
      const foot = hl * (1 - hl) * 4;                 // 过渡环中部最大
      const spur = foot > 0.05 ? ridged(x, z, 1 / 520, 3, 197) * 130 * foot : 0;
      h = h * (1 - hl) + hHigh * hl + spur;
    }
    h = Math.max(6, Math.min(E.CHH - 14, h));
    const hi = Math.floor(h);
    const tA = temp - Math.max(0, hi - 1090) * 0.0022;
    const snowline = 1120 + (temp - 0.5) * 50 + (det - 0.5) * 12;
    const ch = sstep(0.60, 0.70, f.chRaw);
    /* ③ 垂直带谱群系 */
    let biome;
    let snw = null;
    const fz = (h2(x, z, 223) - 0.5) * 56;            // 带界抖动 ±28m
    if (hl > 0.30 && (hi >= 2150 + fz || (pk > 0.55 + fz / 350 && hi >= 1900 + fz * 0.5))) biome = B_HIGHPEAK;
    else if (hl > 0.22 && hi >= 1700 + fz * 0.7) biome = B_HIGHSNOW;
    else if (hl > 0.18 && hi >= 1520 + fz * 0.5) { biome = B_MEADOW; snw = false; }
    else if (hl > 0.12 && hi >= 1235 + fz * 0.4) {    // 山地带：湿坡针叶林 / 干坡山地草原
      biome = hum > 0.34 ? B_FOREST : B_PLAINS;
      snw = false;                                     // 草甸线以下无常年积雪
    }
    else if (m > 0.42 && (hi > 1140 || hi >= snowline - 8)) biome = B_SNOW;
    else if (p > 0.45) biome = B_PLATEAU;
    else if (lk > 0.5) biome = B_LAKE;
    else if (b > 0.5) biome = B_BASIN;
    else if (hum > 0.60 && hi <= E.SEA + 3 && hi >= E.SEA - 2 && tA > 0.30 && tA < 0.80) biome = B_SWAMP;
    else if (ch > 0.55 && tA > 0.30 && tA < 0.75 && hum > 0.38) biome = B_CHERRY;
    else if (tA > 0.60 && hum < 0.42) biome = B_DESERT;
    else if (hum > 0.52 && tA > 0.32 && tA < 0.72) biome = B_FOREST;
    else biome = B_PLAINS;
    /* 积雪判定（高原带谱单独规则）；低地雪线用 ±6m 点抖过渡（消等高线硬边） */
    if (snw === null) {
      if (biome === B_HIGHSNOW) snw = true;
      else if (biome === B_HIGHPEAK) snw = hi > 2320 || (hi > 1980 && h2(x, z, 199) < (hi - 1980) / 360);
      else {
        const st = (hi - snowline + 6) / 12;
        snw = st >= 1 || (st > 0 && h2(x, z, 199) < st);
      }
    }
    return { h: hi, biome: biome, temp: temp, hum: hum, tA: tA, snow: snw, wlv: wlv, m: m, p: p, b: b, lk: lk, rv: rv, det: det, hl: hl, pk: pk };
  }

  /* 单列地形信息（壮阔版：巨型山脉/大盆地/高台地） */
  E.column = function (x, z) { return shapeColumn(x, z, fieldsAt(x, z)); };

  /* ---------------- LOD 气候格点缓存（远层字段用 64 格双线性插值） ---------------- */
  const CL_STEP = 64;
  const CL_FIELDS = ['temp', 'hum', 'cont', 'mRaw', 'pRaw', 'bRaw', 'lkRaw', 'rS', 'hlRaw', 'pkRaw', 'chRaw'];
  E.makeClimate = function (x0, z0, x1, z1) {
    const gx0 = Math.floor(x0 / CL_STEP) - 1, gz0 = Math.floor(z0 / CL_STEP) - 1;
    const gx1 = Math.floor(x1 / CL_STEP) + 2, gz1 = Math.floor(z1 / CL_STEP) + 2;
    const nx = gx1 - gx0 + 1, nz = gz1 - gz0 + 1;
    const data = new Float32Array(nx * nz * CL_FIELDS.length);
    let k = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const f = fieldsAt((gx0 + i) * CL_STEP, (gz0 + j) * CL_STEP);
      for (let fi = 0; fi < CL_FIELDS.length; fi++) data[k++] = f[CL_FIELDS[fi]];
    }
    return { gx0: gx0, gz0: gz0, nx: nx, nz: nz, data: data };
  };
  const climTmp = { temp: 0, hum: 0, cont: 0, det: 0.5, mRaw: 0, pRaw: 0, bRaw: 0, lkRaw: 0, rS: 0, hlRaw: 0, pkRaw: 0, chRaw: 0 };
  E.climateAt = function (cl, x, z) {
    const fx = x / CL_STEP - cl.gx0, fz = z / CL_STEP - cl.gz0;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0) i = 0; else if (i > cl.nx - 2) i = cl.nx - 2;
    if (j < 0) j = 0; else if (j > cl.nz - 2) j = cl.nz - 2;
    const u = fx - i, v = fz - j;
    const NF = CL_FIELDS.length;
    const a = (j * cl.nx + i) * NF, b = (j * cl.nx + i + 1) * NF;
    const c = ((j + 1) * cl.nx + i) * NF, d = ((j + 1) * cl.nx + i + 1) * NF;
    const D = cl.data;
    for (let fi = 0; fi < NF; fi++) {
      const va = D[a + fi], vb = D[b + fi], vc = D[c + fi], vd = D[d + fi];
      climTmp[CL_FIELDS[fi]] = va + (vb - va) * u + (vc - va) * v + (va - vb - vc + vd) * u * v;
    }
    return climTmp;
  };
  E.detAt = function (x, z) { return fbm(x, z, 1 / 70, 3, 41); };

  /* ---------------- 方块注册 ---------------- */
  // kind: 0 不透明 1 十字植物 2 水 3 半透明(玻璃)
  const TL = [
    'grass_top', 'grass_side', 'dirt', 'stone', 'cobble', 'sand', 'red_sand', 'sandstone_top', 'sandstone_side',
    'gravel', 'snow', 'ice', 'bedrock',
    'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'ruby_ore', 'emerald_ore', 'lazul_ore',
    'coal_block', 'iron_block', 'gold_block', 'diamond_block', 'emerald_block',
    'log_fir_side', 'log_fir_top', 'log_palm_side', 'log_palm_top', 'log_cherry_side', 'log_cherry_top',
    'log_giant_side', 'log_giant_top',
    'planks_fir', 'planks_palm', 'planks_cherry', 'planks_giant',
    'leaves_fir', 'leaves_palm', 'leaves_cherry', 'leaves_giant',
    'terra_0', 'terra_1', 'terra_2', 'terra_3', 'terra_4', 'terra_5', 'terra_plain',
    'brick', 'stonebrick', 'mossy', 'obsidian', 'glowstone', 'bookshelf', 'craft_top', 'craft_side', 'furnace',
    'chest_side', 'chest_top', 'tnt_top', 'tnt_side', 'tnt_bottom', 'sponge',
    'pumpkin_side', 'pumpkin_top', 'melon_side', 'melon_top', 'cactus_side', 'cactus_top', 'hay_side', 'hay_top',
    'clay', 'mud', 'quartz', 'prismarine', 'glass',
    'wool_0', 'wool_1', 'wool_2', 'wool_3', 'wool_4', 'wool_5', 'wool_6', 'wool_7',
    'wool_8', 'wool_9', 'wool_10', 'wool_11', 'wool_12', 'wool_13', 'wool_14', 'wool_15',
    'tallgrass', 'flower_red', 'flower_yellow', 'flower_blue', 'mush_brown', 'mush_red', 'deadbush',
    'meadow_top', 'meadow_side', 'alprock',
    'log_oak_side', 'log_oak_top', 'planks_oak', 'leaves_oak',
    'log_birch_side', 'log_birch_top', 'planks_birch', 'leaves_birch',
    'log_acacia_side', 'log_acacia_top', 'planks_acacia', 'leaves_acacia',
    'log_jungle_side', 'log_jungle_top', 'planks_jungle', 'leaves_jungle',
    'log_maple_side', 'log_maple_top', 'planks_maple', 'leaves_maple',
    'log_seq_side', 'log_seq_top', 'leaves_seq',
    'log_bigoak_side', 'log_bigoak_top', 'leaves_bigoak',
    'log_banyan_side', 'log_banyan_top', 'leaves_banyan'
  ];
  const T = {};
  for (let i = 0; i < TL.length; i++) T[TL[i]] = i;
  E.TILE_LIST = TL; E.T = T;

  function bl(name, top, side, bottom, kind) {
    return { n: name, t: [T[top], T[side], T[bottom]], kind: kind | 0 };
  }
  const B = [];
  B[0] = { n: '空气', t: [0, 0, 0], kind: -1 };
  B[1] = bl('草方块', 'grass_top', 'grass_side', 'dirt', 0);
  B[2] = bl('泥土', 'dirt', 'dirt', 'dirt', 0);
  B[3] = bl('石头', 'stone', 'stone', 'stone', 0);
  B[4] = bl('圆石', 'cobble', 'cobble', 'cobble', 0);
  B[5] = bl('沙子', 'sand', 'sand', 'sand', 0);
  B[6] = bl('红沙', 'red_sand', 'red_sand', 'red_sand', 0);
  B[7] = bl('砂岩', 'sandstone_top', 'sandstone_side', 'sandstone_top', 0);
  B[8] = bl('沙砾', 'gravel', 'gravel', 'gravel', 0);
  B[9] = bl('雪块', 'snow', 'snow', 'snow', 0);
  B[10] = bl('冰', 'ice', 'ice', 'ice', 0);
  B[11] = bl('水', 'ice', 'ice', 'ice', 2);
  B[12] = bl('基岩', 'bedrock', 'bedrock', 'bedrock', 0);
  B[13] = bl('煤矿石', 'coal_ore', 'coal_ore', 'coal_ore', 0);
  B[14] = bl('铁矿石', 'iron_ore', 'iron_ore', 'iron_ore', 0);
  B[15] = bl('金矿石', 'gold_ore', 'gold_ore', 'gold_ore', 0);
  B[16] = bl('钻石矿石', 'diamond_ore', 'diamond_ore', 'diamond_ore', 0);
  B[17] = bl('红晶矿石', 'ruby_ore', 'ruby_ore', 'ruby_ore', 0);
  B[18] = bl('翠玉矿石', 'emerald_ore', 'emerald_ore', 'emerald_ore', 0);
  B[19] = bl('青金矿石', 'lazul_ore', 'lazul_ore', 'lazul_ore', 0);
  B[20] = bl('煤炭块', 'coal_block', 'coal_block', 'coal_block', 0);
  B[21] = bl('铁块', 'iron_block', 'iron_block', 'iron_block', 0);
  B[22] = bl('金块', 'gold_block', 'gold_block', 'gold_block', 0);
  B[23] = bl('钻石块', 'diamond_block', 'diamond_block', 'diamond_block', 0);
  B[24] = bl('翠玉块', 'emerald_block', 'emerald_block', 'emerald_block', 0);
  B[25] = bl('杉木原木', 'log_fir_top', 'log_fir_side', 'log_fir_top', 0);
  B[26] = bl('棕榈原木', 'log_palm_top', 'log_palm_side', 'log_palm_top', 0);
  B[27] = bl('樱花原木', 'log_cherry_top', 'log_cherry_side', 'log_cherry_top', 0);
  B[28] = bl('巨木原木', 'log_giant_top', 'log_giant_side', 'log_giant_top', 0);
  B[29] = bl('杉木木板', 'planks_fir', 'planks_fir', 'planks_fir', 0);
  B[30] = bl('棕榈木板', 'planks_palm', 'planks_palm', 'planks_palm', 0);
  B[31] = bl('樱花木板', 'planks_cherry', 'planks_cherry', 'planks_cherry', 0);
  B[32] = bl('巨木木板', 'planks_giant', 'planks_giant', 'planks_giant', 0);
  B[33] = bl('杉树针叶', 'leaves_fir', 'leaves_fir', 'leaves_fir', 0);
  B[34] = bl('棕榈叶', 'leaves_palm', 'leaves_palm', 'leaves_palm', 0);
  B[35] = bl('樱花树叶', 'leaves_cherry', 'leaves_cherry', 'leaves_cherry', 0);
  B[36] = bl('巨木树叶', 'leaves_giant', 'leaves_giant', 'leaves_giant', 0);
  for (let i = 0; i < 6; i++) B[37 + i] = bl('陶纹岩·' + i, 'terra_' + i, 'terra_' + i, 'terra_' + i, 0);
  B[43] = bl('陶纹岩', 'terra_plain', 'terra_plain', 'terra_plain', 0);
  B[44] = bl('红砖块', 'brick', 'brick', 'brick', 0);
  B[45] = bl('石砖', 'stonebrick', 'stonebrick', 'stonebrick', 0);
  B[46] = bl('苔石', 'mossy', 'mossy', 'mossy', 0);
  B[47] = bl('黑曜岩', 'obsidian', 'obsidian', 'obsidian', 0);
  B[48] = bl('萤光石', 'glowstone', 'glowstone', 'glowstone', 0);
  B[49] = bl('书架', 'planks_cherry', 'bookshelf', 'planks_cherry', 0);
  B[50] = bl('工作台', 'craft_top', 'craft_side', 'planks_fir', 0);
  B[51] = bl('熔炉', 'stone', 'furnace', 'stone', 0);
  B[52] = bl('木箱', 'chest_top', 'chest_side', 'chest_top', 0);
  B[53] = bl('炸药桶', 'tnt_top', 'tnt_side', 'tnt_bottom', 0);
  B[54] = bl('海绵', 'sponge', 'sponge', 'sponge', 0);
  B[55] = bl('南瓜', 'pumpkin_top', 'pumpkin_side', 'pumpkin_top', 0);
  B[56] = bl('西瓜', 'melon_top', 'melon_side', 'melon_top', 0);
  B[57] = bl('仙人掌', 'cactus_top', 'cactus_side', 'cactus_top', 0);
  B[58] = bl('干草捆', 'hay_top', 'hay_side', 'hay_top', 0);
  B[59] = bl('黏土块', 'clay', 'clay', 'clay', 0);
  B[60] = bl('沃泥', 'mud', 'mud', 'mud', 0);
  B[61] = bl('白玉块', 'quartz', 'quartz', 'quartz', 0);
  B[62] = bl('海晶石', 'prismarine', 'prismarine', 'prismarine', 0);
  B[63] = bl('玻璃', 'glass', 'glass', 'glass', 3);
  const WOOL_NAMES = ['白', '橙', '品红', '淡蓝', '黄', '黄绿', '粉', '灰', '浅灰', '青', '紫', '蓝', '棕', '绿', '红', '黑'];
  for (let i = 0; i < 16; i++) B[64 + i] = bl(WOOL_NAMES[i] + '色羊毛', 'wool_' + i, 'wool_' + i, 'wool_' + i, 0);
  B[80] = bl('野草', 'tallgrass', 'tallgrass', 'tallgrass', 1);
  B[81] = bl('绯红花', 'flower_red', 'flower_red', 'flower_red', 1);
  B[82] = bl('金盏花', 'flower_yellow', 'flower_yellow', 'flower_yellow', 1);
  B[83] = bl('幽蓝花', 'flower_blue', 'flower_blue', 'flower_blue', 1);
  B[84] = bl('褐菇', 'mush_brown', 'mush_brown', 'mush_brown', 1);
  B[85] = bl('红菇', 'mush_red', 'mush_red', 'mush_red', 1);
  B[86] = bl('枯灌木', 'deadbush', 'deadbush', 'deadbush', 1);
  B[87] = bl('高原草甸', 'meadow_top', 'meadow_side', 'dirt', 0);
  B[88] = bl('高原岩', 'alprock', 'alprock', 'alprock', 0);
  B[89] = bl('橡木原木', 'log_oak_top', 'log_oak_side', 'log_oak_top', 0);
  B[90] = bl('橡木木板', 'planks_oak', 'planks_oak', 'planks_oak', 0);
  B[91] = bl('橡树树叶', 'leaves_oak', 'leaves_oak', 'leaves_oak', 0);
  B[92] = bl('白桦原木', 'log_birch_top', 'log_birch_side', 'log_birch_top', 0);
  B[93] = bl('白桦木板', 'planks_birch', 'planks_birch', 'planks_birch', 0);
  B[94] = bl('白桦树叶', 'leaves_birch', 'leaves_birch', 'leaves_birch', 0);
  B[95] = bl('金合欢原木', 'log_acacia_top', 'log_acacia_side', 'log_acacia_top', 0);
  B[96] = bl('金合欢木板', 'planks_acacia', 'planks_acacia', 'planks_acacia', 0);
  B[97] = bl('金合欢树叶', 'leaves_acacia', 'leaves_acacia', 'leaves_acacia', 0);
  B[98] = bl('丛林原木', 'log_jungle_top', 'log_jungle_side', 'log_jungle_top', 0);
  B[99] = bl('丛林木板', 'planks_jungle', 'planks_jungle', 'planks_jungle', 0);
  B[100] = bl('丛林树叶', 'leaves_jungle', 'leaves_jungle', 'leaves_jungle', 0);
  B[101] = bl('枫木原木', 'log_maple_top', 'log_maple_side', 'log_maple_top', 0);
  B[102] = bl('枫木木板', 'planks_maple', 'planks_maple', 'planks_maple', 0);
  B[103] = bl('枫树树叶', 'leaves_maple', 'leaves_maple', 'leaves_maple', 0);
  B[104] = bl('红杉原木', 'log_seq_top', 'log_seq_side', 'log_seq_top', 0);
  B[105] = bl('红杉树叶', 'leaves_seq', 'leaves_seq', 'leaves_seq', 0);
  B[106] = bl('巨橡原木', 'log_bigoak_top', 'log_bigoak_side', 'log_bigoak_top', 0);
  B[107] = bl('巨橡树叶', 'leaves_bigoak', 'leaves_bigoak', 'leaves_bigoak', 0);
  B[108] = bl('榕树原木', 'log_banyan_top', 'log_banyan_side', 'log_banyan_top', 0);
  B[109] = bl('榕树树叶', 'leaves_banyan', 'leaves_banyan', 'leaves_banyan', 0);
  E.BLOCKS = B;
  E.WOOL_NAMES = WOOL_NAMES;
  E.isSolid = function (id) { return id > 0 && B[id].kind === 0; };
  E.isOpaque = function (id) { return id > 0 && B[id].kind === 0; };

  /* ---------------- 调色板（远景 LOD 与贴图共享基准色） ---------------- */
  E.PAL = {
    grass: [106, 182, 90], grassDry: [148, 180, 84], grassDark: [82, 152, 82],
    dirt: [128, 92, 60], sand: [216, 203, 145], redSand: [199, 110, 58],
    snow: [237, 243, 248], stone: [130, 132, 136], gravel: [122, 118, 114],
    waterSh: [58, 118, 205], waterDp: [22, 48, 118], ice: [166, 205, 235],
    terraWall: [178, 98, 64],
    terra: [[178, 96, 62], [201, 128, 78], [160, 82, 66], [214, 154, 98], [139, 72, 52], [190, 110, 90]],
    folFir: [44, 94, 58], folPalm: [98, 176, 68], folCherry: [236, 168, 198], folGiant: [46, 172, 100],
    logFir: [96, 66, 44], logPalm: [148, 118, 76], logCherry: [92, 58, 54], logGiant: [110, 78, 50],
    /* 新树种树冠/树皮（近景贴图与远景 LOD 共用基准色） */
    folOak: [88, 152, 66], folBirch: [130, 186, 92], folAcacia: [126, 152, 62],
    folJungle: [38, 118, 50], folMaple: [206, 94, 44],
    folSeq: [64, 108, 60], folBigOak: [80, 168, 72], folBanyan: [96, 170, 88],
    logOak: [110, 84, 50], logBirch: [216, 214, 204], logAcacia: [122, 86, 60],
    logJungle: [98, 74, 44], logMaple: [106, 62, 44],
    logSeq: [152, 78, 50], logBigOak: [104, 76, 46], logBanyan: [130, 112, 86],
    sandstone: [205, 192, 140],
    /* 青藏高原写实配色：枯黄草甸 / 灰褐山岩 / 暗色岩壁 / 沼泽沃泥 */
    meadow: [176, 154, 96], meadowWet: [128, 148, 82],
    alprock: [132, 122, 110], alprockDark: [100, 92, 84],
    mud: [96, 74, 52]
  };

  /* ---------------- 陡坡露岩（近景 genChunk / 远景 buildLodTile 同源） ----------------
   * 相邻列高差 ≥ SNOW_STEEP（×采样间距）→ 陡壁挂不住雪，露出岩体；
   * 冰面只在局部平地（dmax ≤ 间距）生成 */
  E.SNOW_STEEP = 3;
  E.qcol = function (v, big) { return big ? q32(v) : q8_(v); };
  E.steepRockTop = function (bio, x, z, big, top) {
    const P = E.PAL;
    let r, g, b;
    if (bio === B_SNOW) { r = 127; g = 127; b = 129; }   // 石6砾4混合
    else {
      const j = (h2(x, z, 217) - 0.5) * 18;
      r = P.alprock[0] + j; g = P.alprock[1] + j; b = P.alprock[2] + j;
    }
    top[0] = E.qcol(r, big); top[1] = E.qcol(g, big); top[2] = E.qcol(b, big);
  };

  /* ---------------- 树 ---------------- */
  // 树种: 0 无 1 杉 2 棕榈 3 樱花 4 橡树 5 白桦 6 金合欢 7 丛林 8 枫
  // 海拔适配：① 全局林线 ~475±20，以上密度线性衰减到 0（与草甸带衔接）
  //          ② 森林树种随海拔渐变：低地阔叶混交 → 高处纯针叶（山地针叶林带）
  E.FOL = [null, E.PAL.folFir, E.PAL.folPalm, E.PAL.folCherry, E.PAL.folOak,
    E.PAL.folBirch, E.PAL.folAcacia, E.PAL.folJungle, E.PAL.folMaple];
  E.TREE_LOG = [0, 25, 26, 27, 89, 92, 95, 98, 101];
  E.TREE_LEAF = [0, 33, 34, 35, 91, 94, 97, 100, 103];

  /* 树种选择（密度判定通过后调用）：近景 stampTree 与远景 LOD 配色共用（单一来源）
   * 片区单一树种：低频噪声把大地划成连片林区，一片林子只出一种树；
   * 山地针叶带按海拔接管、湿区丛林片/干区金合欢片走气候场；樱花片区稀有（樱花林群系除外） */
  E.pickTree = function (x, z, biome, h) {
    if (biome === B_CHERRY) return 3;
    if (biome === B_LAKE) return 2;
    if (biome === B_SNOW || biome === B_SWAMP) return 1;
    if (biome === B_DESERT) return fbm(x, z, 1 / 1800, 3, 23) > 0.34 ? 6 : 2;  // 半干旱片金合欢 / 干旱棕榈
    const sp = fbm(x, z, 1 / 800, 1, 883);            // 树种片区噪声（~800m 连片，平滑轮廓）
    if (biome === B_FOREST) {
      if (h > 1110 + fbm(x, z, 1 / 900, 2, 887) * 170) return 1;   // 山地针叶林带
      const hum = fbm(x, z, 1 / 1800, 3, 23);
      if (hum > 0.66) return 7;                       // 深湿林片 → 丛林树
      if (sp > 0.80) return 3;                        // 稀有樱花林片
      if (sp < 0.36) return 5;                        // 白桦林片
      if (sp < 0.50) return 8;                        // 枫林片
      return 4;                                       // 橡树林片
    }
    if (biome === B_PLAINS) {
      const hum = fbm(x, z, 1 / 1800, 3, 23);
      if (hum < 0.38) return 6;                       // 干草原片 → 金合欢
      if (sp > 0.80) return 3;
      if (sp < 0.38) return 5;
      if (sp < 0.52) return 8;
      return 4;
    }
    if (biome === B_BASIN) {
      const hum = fbm(x, z, 1 / 1800, 3, 23);
      if (hum > 0.60) return 7;
      if (sp < 0.32) return 1;
      if (sp < 0.46) return 5;
      if (sp < 0.58) return 8;
      if (sp > 0.86) return 3;
      return 4;
    }
    return 4;
  };

  E.treeAt = function (x, z, biome, h, snow) {
    if (h <= E.SEA) return 0;
    let fade = 1;
    if (h > 1400) {
      fade = (1475 + (h2(x, z, 229) - 0.5) * 40 - h) / 75;
      if (fade <= 0) return 0;
      if (fade > 1) fade = 1;
    }
    const r = h2(x, z, 777);
    let d = 0;
    if (biome === B_FOREST) d = 0.030;
    else if (biome === B_PLAINS) d = 0.0035;
    else if (biome === B_DESERT) d = 0.0028;
    else if (biome === B_LAKE) d = h <= E.SEA + 3 ? 0.010 : 0;
    else if (biome === B_BASIN) d = 0.009;
    else if (biome === B_SNOW) d = snow ? 0.008 : 0.014;   // 雪地也长杉（雪林）
    else if (biome === B_CHERRY) d = 0.048;                // 樱花密林
    else if (biome === B_SWAMP) d = 0.007;                 // 沼泽疏杉
    if (!d || r >= d * fade) return 0;                     // 高原三群系无树（高海拔无林，1:1）
    return E.pickTree(x, z, biome, h);
  };
  E.treeTop = function (type, x, z) { // 树冠顶相对地面高度
    const r = h2(x, z, 781);
    if (type === 1) return 9 + Math.floor(r * 4);
    if (type === 2) return 8 + Math.floor(r * 3);
    if (type === 4) return 8 + Math.floor(r * 3);
    if (type === 5) return 9 + Math.floor(r * 3);
    if (type === 6) return 7 + Math.floor(r * 2);
    if (type === 7) return 12 + Math.floor(r * 4);
    if (type === 8) return 8 + Math.floor(r * 3);
    return 9 + Math.floor(r * 3);
  };

  /* ---------------- 区块体素生成（含 1 格 padding，按需高度分配） ---------------- */
  // 返回 { pad:Uint8Array(18*18*H), blocks:Uint8Array(16*16*H), hmax, H }
  // 优化：H = 本区块实际最高地形 + 余量（平原 ~110、峰区 ~2950），内存/传输 O(地形高) 而非 O(CHH)
  const PW = 18;

  E.genChunk = function (cx, cz) {
    const CHH = E.CHH, SEA = E.SEA;
    const bx = cx * 16, bz = cz * 16;
    let hmax = SEA + 2;
    // 列缓存：-11..26（树冠余量 + 树址质检 ±2 环，保证跨区块判定确定性一致）
    const M = 11, CS = 38;
    const cols = new Array(CS * CS);
    let colMax = SEA + 2;
    for (let i = 0; i < CS; i++) for (let j = 0; j < CS; j++) {
      const c = E.column(bx + i - M, bz + j - M);
      cols[i * CS + j] = c;
      if (c.h > colMax) colMax = c.h;
    }
    const H = Math.min(CHH, colMax + 44);
    // hmin：pad 窗口(-1..16)内最低地表 —— 网格器可跳过其下的全实心层
    let hmin = 1e9;
    for (let i = -1; i <= 16; i++) for (let j = -1; j <= 16; j++) {
      const hh = cols[(i + M) * CS + (j + M)].h;
      if (hh < hmin) hmin = hh;
    }
    const pad = new Uint8Array(PW * PW * H);

    function setP(wx, y, wz, id, soft) {
      const lx = wx - bx, lz = wz - bz;
      if (lx < -1 || lx > 16 || lz < -1 || lz > 16 || y < 0 || y >= H) return;
      const idx = ((lx + 1) * PW + (lz + 1)) * H + y;
      if (soft && pad[idx] !== 0) return;
      pad[idx] = id;
      if (y > hmax) hmax = y;
    }

    // 地形填充 -1..16
    for (let lx = -1; lx <= 16; lx++) for (let lz = -1; lz <= 16; lz++) {
      const wx = bx + lx, wz = bz + lz;
      const c = cols[(lx + M) * CS + (lz + M)];
      const h = c.h, bio = c.biome;
      const base = ((lx + 1) * PW + (lz + 1)) * H;
      const bedTop = 1 + Math.floor(h2(wx, wz, 5) * 2);
      const wlv = c.wlv;
      const beach = h <= wlv + 1 && (bio === B_PLAINS || bio === B_FOREST || bio === B_BASIN || bio === B_LAKE || bio === B_CHERRY);
      if (h + 2 > hmax) hmax = h + 2;
      const alpine = bio === B_MEADOW || bio === B_HIGHSNOW || bio === B_HIGHPEAK;
      // 陡坡判定（山地三群系）：相邻列最大高差 ≥ SNOW_STEEP → 雪挂不住
      let dmax = 0, steep = false;
      if (bio === B_SNOW || alpine) {
        const ci = (lx + M) * CS + (lz + M);
        let d = h - cols[ci - CS].h; if (d < 0) d = -d; if (d > dmax) dmax = d;
        d = h - cols[ci + CS].h; if (d < 0) d = -d; if (d > dmax) dmax = d;
        d = h - cols[ci - 1].h; if (d < 0) d = -d; if (d > dmax) dmax = d;
        d = h - cols[ci + 1].h; if (d < 0) d = -d; if (d > dmax) dmax = d;
        steep = dmax >= E.SNOW_STEEP;
      }
      for (let y = 0; y <= h; y++) {
        let id;
        if (y <= bedTop) id = 12;
        else if (y > 1150 && y < h - 8) id = alpine ? 88 : 3;   // 高海拔岩体快速路径（免矿物哈希；阶地群系不受影响）
        else if (bio === B_DESERT) id = y > h - 4 ? 5 : (y > h - 9 ? 7 : oreOrStone(wx, y, wz, c));
        else if (bio === B_PLATEAU) {
          if (y === h) id = 6;
          else if (y > h - 60 && y > SEA) id = 37 + (Math.floor((y + Math.floor(h2(Math.floor(wx / 160), Math.floor(wz / 160), 313) * 6)) / 3) % 6);
          else id = oreOrStone(wx, y, wz, c);
        }
        else if (bio === B_MEADOW) {          // 高原草甸：草地→草甸斑驳渐变（与山地带无缝衔接）
          if (y === h) {
            const mixv = Math.min(1, Math.max(0, (h - 1500) / 80));
            id = (mixv >= 1 || h2(wx, wz, 227) < mixv) ? 87 : 1;
          }
          else if (y > h - 3) id = 2;
          else id = y > 1120 ? 88 : oreOrStone(wx, y, wz, c);
        }
        else if (bio === B_HIGHSNOW) {        // 高雪原：厚雪 + 平地冰面湖；陡壁露岩
          if (steep) id = y > h - 4 ? 88 : (y > 1120 ? 88 : oreOrStone(wx, y, wz, c));
          else if (y === h) id = (dmax <= 1 && c.det < 0.34 && h2(Math.floor(wx / 24), Math.floor(wz / 24), 211) < 0.4) ? 10 : 9;
          else if (y > h - 3) id = 9;
          else id = y > 1120 ? 88 : oreOrStone(wx, y, wz, c);
        }
        else if (bio === B_HIGHPEAK) {        // 高雪山：缓坡盖雪，陡壁/雪线下裸岩碎石
          if (c.snow && !steep) id = y > h - 4 ? 9 : 88;
          else if (y === h) id = h2(wx, wz, 7) < 0.22 ? 8 : 88;
          else id = y > 1120 ? 88 : oreOrStone(wx, y, wz, c);
        }
        else if (bio === B_SNOW) {
          if (y === h) {
            if (c.snow && !steep) id = 9;
            else if (h > 1110 || c.snow) id = h2(wx, wz, 7) < 0.6 ? 3 : 8;   // 高处/陡壁裸岩碎石
            else id = 1;
          }
          else if (y > h - 3) id = c.snow ? 3 : (h > 1110 ? 3 : 2);
          else id = oreOrStone(wx, y, wz, c);
        }
        else if (h < wlv) { // 水下（海/盆底湖）
          if (y > h - 3) id = h >= wlv - 5 ? 5 : (h2(wx, wz, 9) < 0.5 ? 8 : 59);
          else id = oreOrStone(wx, y, wz, c);
        }
        else if (beach) id = y > h - 3 ? 5 : oreOrStone(wx, y, wz, c);
        else if (bio === B_SWAMP) {           // 沼泽：沃泥草地混杂
          if (y === h) id = h2(wx, wz, 13) < 0.38 ? 60 : 1;
          else if (y > h - 3) id = 60;
          else id = oreOrStone(wx, y, wz, c);
        }
        else if (bio === B_BASIN && h < 1000) { // 深盆地干盆底（世界 0 以下）：砾/石/土荒漠面
          if (y === h) { const r13 = h2(wx, wz, 13); id = r13 < 0.30 ? 8 : (r13 < 0.52 ? 3 : 2); }
          else if (y > h - 4) id = 3;
          else id = oreOrStone(wx, y, wz, c);
        }
        else { // 草地类
          if (y === h) id = c.snow ? 9 : (bio === B_BASIN && h2(wx, wz, 13) < 0.18 ? 60 : 1);
          else if (y > h - 4) id = 2;
          else id = oreOrStone(wx, y, wz, c);
        }
        pad[base + y] = id;
      }
      // 水与冰（按列水位：海 SEA / 盆底湖 480）
      if (h < wlv) {
        for (let y = h + 1; y <= wlv; y++) pad[base + y] = 11;
        if (c.tA < 0.30) pad[base + wlv] = 10;
      }
      // 植被（1×1，无需跨界余量）
      if (h >= SEA && h + 1 < H && !c.snow) {
        const top = pad[base + h];
        const r = h2(wx, wz, 555);
        let plant = 0;
        if (top === 1) {
          if (bio === B_FOREST) plant = r < 0.09 ? 80 : r < 0.102 ? (r < 0.096 ? 84 : 85) : r < 0.118 ? (r < 0.11 ? 81 : 83) : 0;
          else if (bio === B_PLAINS) plant = r < 0.05 ? 80 : r < 0.062 ? (r < 0.056 ? 82 : 81) : 0;
          else if (bio === B_BASIN) plant = r < 0.07 ? 80 : r < 0.078 ? 84 : 0;
          else if (bio === B_SNOW) plant = r < 0.02 ? 80 : 0;
          else if (bio === B_SWAMP) plant = r < 0.16 ? 80 : r < 0.19 ? (r < 0.175 ? 84 : 85) : 0;
          else if (bio === B_CHERRY) plant = r < 0.06 ? 80 : r < 0.078 ? (r < 0.068 ? 81 : 83) : r < 0.084 ? 82 : 0;
          else if (bio === B_MEADOW) plant = r < 0.05 ? 80 : r < 0.057 ? 83 : 0;
        } else if (top === 87) {              // 草甸：龙胆花/枯灌木/矮草
          plant = r < 0.045 ? 80 : r < 0.052 ? 86 : r < 0.057 ? 83 : 0;
        } else if (top === 5 && bio === B_DESERT) {
          if (r < 0.010) plant = 86;
          else if (r < 0.016) { // 仙人掌 1-3 格
            const n = 1 + Math.floor(h2(wx, wz, 557) * 3);
            for (let k = 1; k <= n && h + k < H; k++) pad[base + h + k] = 57;
          }
        }
        if (plant) pad[base + h + 1] = plant;
      }
    }

    // 普通树（含跨界余量 -8..23）；树址质检：陡坡/崖边/切冠/水缘不长树
    for (let tx = -8; tx <= 23; tx++) for (let tz = -8; tz <= 23; tz++) {
      const c = cols[(tx + M) * CS + (tz + M)];
      const type = E.treeAt(bx + tx, bz + tz, c.biome, c.h, c.snow);
      if (!type) continue;
      const ci = (tx + M) * CS + (tz + M);
      const mnt = c.biome === B_SNOW || c.biome === B_HIGHSNOW || c.biome === B_HIGHPEAK;
      let drop = 0, rise = 0;
      let d = c.h - cols[ci - CS].h; if (d > drop) drop = d; if (-d > rise) rise = -d;
      d = c.h - cols[ci + CS].h; if (d > drop) drop = d; if (-d > rise) rise = -d;
      d = c.h - cols[ci - 1].h; if (d > drop) drop = d; if (-d > rise) rise = -d;
      d = c.h - cols[ci + 1].h; if (d > drop) drop = d; if (-d > rise) rise = -d;
      const lim = mnt ? E.SNOW_STEEP : 4;
      if (rise >= lim || drop >= (type === 2 ? 8 : lim)) continue;   // 悬崖边悬空/贴壁（棕榈滩涂放宽）
      let rise2 = 0;                                                 // 2 格内高墙 → 树冠会被切
      for (let rdx = -2; rdx <= 2; rdx++) for (let rdz = -2; rdz <= 2; rdz++) {
        if (rdx > -2 && rdx < 2 && rdz > -2 && rdz < 2) continue;
        const hn = cols[(tx + M + rdx) * CS + (tz + M + rdz)].h - c.h;
        if (hn > rise2) rise2 = hn;
      }
      if (rise2 >= 5) continue;
      if (type !== 2 && c.h <= SEA + 1 &&                            // 非棕榈不长在水缘
        (cols[ci - CS].h < SEA || cols[ci + CS].h < SEA || cols[ci - 1].h < SEA || cols[ci + 1].h < SEA)) continue;
      stampTree(setP, bx + tx, bz + tz, c.h, type);
    }

    // 拷出内部 16×16
    const blocks = new Uint8Array(16 * 16 * H);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      const src = ((x + 1) * PW + (z + 1)) * H;
      const dst = (x * 16 + z) * H;
      blocks.set(pad.subarray(src, src + H), dst);
    }
    return { pad: pad, blocks: blocks, hmax: Math.min(H - 1, hmax + 2), H: H, hmin: Math.max(0, hmin - 1) };
  };

  function oreOrStone(x, y, z, c) {
    const r = h3(x, y, z, 17);
    if (y < 1014 && r < 0.0035) return 16;          // 钻石
    if (y < 1022 && r > 0.995 && r < 0.9985) return 17; // 红晶
    if (y < 1030 && r > 0.010 && r < 0.0135) return 19; // 青金
    if (y < 1036 && r > 0.020 && r < 0.0255) return 15; // 金
    if (y < 1080 && r > 0.030 && r < 0.038) return 14;  // 铁
    if (r > 0.050 && r < 0.060) return 13;              // 煤
    if (c.m > 0.5 && y > 1060 && r > 0.070 && r < 0.0715) return 18; // 翠玉
    if (r > 0.080 && r < 0.084) return 8;               // 沙砾团
    if (y < 950) {                                      // 深层富矿带（世界 -50 以下，越深越富）
      if (y < 180 && r > 0.900 && r < 0.907) return 16;
      if (y < 380 && r > 0.910 && r < 0.9145) return 17;
      if (y < 500 && r > 0.915 && r < 0.919) return 19;
      if (y < 620 && r > 0.920 && r < 0.9285) return 15;
      if (r > 0.930 && r < 0.9445) return 14;
      if (r > 0.950 && r < 0.9645) return 13;
    }
    return 3;
  }

  function stampTree(setP, x, z, h, type) {
    const r = h2(x, z, 781);
    if (type === 1) { // 锥形杉树
      const th = 7 + Math.floor(r * 4);
      for (let i = 1; i <= th; i++) setP(x, h + i, z, 25);
      setP(x, h + th + 1, z, 33); setP(x, h + th + 2, z, 33, true);
      for (let ly = 3; ly <= th; ly++) {
        const rem = th - ly;
        let rad = Math.min(3, 1 + Math.floor(rem / 2));
        if (rem % 2 === 0) rad = Math.max(1, rad - 1);
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (dx === 0 && dz === 0) continue;
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad > 1) continue;
          setP(x + dx, h + ly, z + dz, 33, true);
        }
      }
    } else if (type === 2) { // 弯干伞冠棕榈
      const th = 7 + Math.floor(r * 3);
      const dirIdx = Math.floor(h2(x, z, 783) * 4);
      const dx = [1, -1, 0, 0][dirIdx], dz = [0, 0, 1, -1][dirIdx];
      let tx = x, tz = z;
      for (let i = 1; i <= th; i++) {
        const b = Math.round(2.6 * Math.pow(i / th, 2));
        tx = x + dx * b; tz = z + dz * b;
        setP(tx, h + i, tz, 26);
      }
      const ty = h + th;
      setP(tx, ty + 1, tz, 34, true);
      const AD = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (let a = 0; a < 8; a++) {
        const L = a < 4 ? 4 : 3;
        for (let j = 1; j <= L; j++) {
          const yy = ty + (j === 1 ? 1 : j >= L ? -1 : 0);
          setP(tx + AD[a][0] * j, yy, tz + AD[a][1] * j, 34, true);
        }
      }
    } else if (type === 4 || type === 8) { // 橡树/枫树：圆冠阔叶
      const th = 4 + Math.floor(r * 3);
      const log = type === 4 ? 89 : 101, leaf = type === 4 ? 91 : 103;
      for (let i = 1; i <= th; i++) setP(x, h + i, z, log);
      const cy = h + th + 2;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const dd = dx * dx + dz * dz + dy * dy * 1.9;
        const fr = (h2(x + dx * 5 + dy, z + dz * 5 - dy, 607) - 0.5) * 2.6;
        if (dd <= 7.8 + fr) setP(x + dx, cy + dy, z + dz, leaf, true);
      }
    } else if (type === 5) {               // 白桦：细高小冠
      const th = 6 + Math.floor(r * 3);
      for (let i = 1; i <= th; i++) setP(x, h + i, z, 92);
      const cy = h + th + 1;
      for (let dy = -3; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const dd = dx * dx + dz * dz + dy * dy * 0.9;
        if (dd <= 4.6) setP(x + dx, cy + dy, z + dz, 94, true);
      }
    } else if (type === 6) {               // 金合欢：斜干平顶伞冠
      const th = 5 + Math.floor(r * 2);
      const dirIdx = Math.floor(h2(x, z, 783) * 4);
      const dx0 = [1, -1, 0, 0][dirIdx], dz0 = [0, 0, 1, -1][dirIdx];
      let tx = x, tz = z;
      for (let i = 1; i <= th; i++) {
        const b = Math.round(1.8 * Math.pow(i / th, 2));
        tx = x + dx0 * b; tz = z + dz0 * b;
        setP(tx, h + i, tz, 95);
      }
      const ty = h + th;
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
        const dd = dx * dx + dz * dz;
        if (dd <= 17) setP(tx + dx, ty + 1, tz + dz, 97, true);
        if (dd <= 6) setP(tx + dx, ty + 2, tz + dz, 97, true);
      }
    } else if (type === 7) {               // 丛林树：高干层叠冠
      const th = 10 + Math.floor(r * 4);
      for (let i = 1; i <= th; i++) setP(x, h + i, z, 98);
      const ty = h + th;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const dd = dx * dx + dz * dz;
        if (dd <= 10.5) {
          setP(x + dx, ty + 1, z + dz, 100, true);
          if (dd <= 3.2) setP(x + dx, ty + 2, z + dz, 100, true);
        }
      }
      const my = h + Math.floor(th * 0.62);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
        if (Math.abs(dx) + Math.abs(dz) <= 3) setP(x + dx, my, z + dz, 100, true);
    } else { // 圆冠樱花树
      const th = 5 + Math.floor(r * 3);
      for (let i = 1; i <= th; i++) setP(x, h + i, z, 27);
      const cy = h + th + 1;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const dd = dx * dx + dz * dz + dy * dy * 2.1;
        const fr = (h2(x + dx * 3 + dy, z + dz * 3 - dy, 606) - 0.5) * 3;
        if (dd <= 9.6 + fr) setP(x + dx, cy + dy, z + dz, 35, true);
      }
    }
  }

  /* ---------------- LOD 采样（远景列信息） ---------------- */
  function q8_(v) { v = v | 0; return v < 0 ? 0 : v > 255 ? 248 : (v & 248); }
  function q32(v) { v = v | 0; return v < 0 ? 0 : v > 255 ? 224 : (v & 224); }

  // out: {h, top[3], wall[3], water, wcol[3], fh, fb, fcol[3], bio, snw}
  // clim: 可选气候格点缓存（s>=8 时用插值字段替代全量噪声）
  E.lodSample = function (x, z, s, out, clim) {
    x = Math.floor(x); z = Math.floor(z);
    let c;
    if (clim && s >= 8) {
      const f = E.climateAt(clim, x, z);
      f.det = s === 8 ? E.detAt(x, z) : 0.5;
      c = shapeColumn(x, z, f);
    } else {
      c = E.column(x, z);
    }
    const P = E.PAL, SEA = E.SEA;
    const q8 = s >= 16 ? q32 : q8_;
    const qh = s >= 32 ? 8 : s >= 16 ? 4 : s >= 8 ? 2 : 1;
    let h = c.h;
    const bio = c.biome;
    const wlv = c.wlv;
    const isWater = h < wlv;
    if (qh > 1) {
      h = Math.round(h / qh) * qh;
      if (isWater) h = Math.min(h, wlv - 1);
      else if (h < wlv) h = wlv;
    }
    out.h = h; out.water = isWater ? 1 : 0; out.fh = 0; out.fb = 0;
    out.bio = bio; out.snw = c.snow ? 1 : 0; out.ice = 0; out.wlv = wlv;
    let tr, tg, tb, wr, wg, wb;
    if (bio === E.B_HIGHPEAK) {           // 高雪山：雪冠白 / 裸岩灰褐，岩壁更暗
      if (c.snow) { tr = P.snow[0]; tg = P.snow[1]; tb = P.snow[2]; }
      else {
        const j2 = (h2(x, z, 217) - 0.5) * 18;
        tr = P.alprock[0] + j2; tg = P.alprock[1] + j2; tb = P.alprock[2] + j2;
      }
      wr = P.alprockDark[0]; wg = P.alprockDark[1]; wb = P.alprockDark[2];
    }
    else if (bio === E.B_HIGHSNOW) {      // 高雪原：整片雪面 + 冰面湖（与近景同公式），边坡露岩
      if (c.det < 0.34 && h2(Math.floor(x / 24), Math.floor(z / 24), 211) < 0.4) {
        tr = P.ice[0]; tg = P.ice[1]; tb = P.ice[2]; out.ice = 1;
      } else { tr = P.snow[0]; tg = P.snow[1]; tb = P.snow[2]; }
      wr = P.alprock[0]; wg = P.alprock[1]; wb = P.alprock[2];
    }
    else if (bio === E.B_MEADOW) {        // 高原草甸：由草地绿渐变到枯黄（与近景速配比一致）
      const wet = Math.min(1, Math.max(0, (c.hum - 0.42) * 2.2));
      let mr = P.meadow[0] * (1 - wet) + P.meadowWet[0] * wet;
      let mg = P.meadow[1] * (1 - wet) + P.meadowWet[1] * wet;
      let mb = P.meadow[2] * (1 - wet) + P.meadowWet[2] * wet;
      const mixv = Math.min(1, Math.max(0, (h - 1500) / 80));
      if (mixv < 1) {
        const dry0 = Math.min(1, Math.max(0, (0.55 - c.hum) * 2.2));
        const gr0 = P.grass[0] * (1 - dry0) + P.grassDry[0] * dry0;
        const gg0 = P.grass[1] * (1 - dry0) + P.grassDry[1] * dry0;
        const gb0 = P.grass[2] * (1 - dry0) + P.grassDry[2] * dry0;
        mr = gr0 * (1 - mixv) + mr * mixv;
        mg = gg0 * (1 - mixv) + mg * mixv;
        mb = gb0 * (1 - mixv) + mb * mixv;
      }
      tr = mr; tg = mg; tb = mb;
      wr = P.dirt[0]; wg = P.dirt[1]; wb = P.dirt[2];
    }
    else if (bio === E.B_SWAMP) {         // 沼泽：暗绿草甸 + 沃泥壁
      tr = P.grassDark[0] * 0.92; tg = P.grassDark[1] * 0.92; tb = P.grassDark[2] * 0.92;
      wr = P.mud[0]; wg = P.mud[1]; wb = P.mud[2];
    }
    else if (c.snow) { tr = P.snow[0]; tg = P.snow[1]; tb = P.snow[2]; wr = 216; wg = 222; wb = 230; }
    else if (bio === E.B_SNOW) {
      const k = Math.min(1, Math.max(0, (h - 1102) / 16));   // 与近景 h>1110 石砾硬切对齐（雪线抖动带内完成过渡）
      tr = P.grassDark[0] * (1 - k) + 127 * k; tg = P.grassDark[1] * (1 - k) + 127 * k; tb = P.grassDark[2] * (1 - k) + 129 * k;
      wr = 118; wg = 120; wb = 124;
    }
    else if (bio === E.B_DESERT) { tr = P.sand[0]; tg = P.sand[1]; tb = P.sand[2]; wr = P.sandstone[0]; wg = P.sandstone[1]; wb = P.sandstone[2]; }
    else if (bio === E.B_PLATEAU) { tr = P.redSand[0]; tg = P.redSand[1]; tb = P.redSand[2]; wr = P.terraWall[0]; wg = P.terraWall[1]; wb = P.terraWall[2]; }
    else if (h < wlv) { tr = 186; tg = 172; tb = 128; wr = 150; wg = 138; wb = 104; }
    else if (h <= wlv + 1) { tr = P.sand[0]; tg = P.sand[1]; tb = P.sand[2]; wr = P.sand[0] - 30; wg = P.sand[1] - 30; wb = P.sand[2] - 30; }
    else if (bio === E.B_BASIN && h < 1000) {   // 深盆地干盆底：砾/石/土荒漠面（与近景 8/3/2 混合同源）
      const k2 = Math.min(1, Math.max(0, (1000 - h) / 20));
      tr = P.grassDark[0] * (1 - k2) + 125 * k2; tg = P.grassDark[1] * (1 - k2) + 112 * k2; tb = P.grassDark[2] * (1 - k2) + 96 * k2;
      wr = P.stone[0]; wg = P.stone[1]; wb = P.stone[2];
    }
    else {
      const dry = Math.min(1, Math.max(0, (0.55 - c.hum) * 2.2));
      let g0 = P.grass, g1 = P.grassDry;
      if (bio === E.B_BASIN) { g0 = P.grassDark; g1 = P.grassDark; }
      tr = g0[0] * (1 - dry) + g1[0] * dry; tg = g0[1] * (1 - dry) + g1[1] * dry; tb = g0[2] * (1 - dry) + g1[2] * dry;
      wr = P.dirt[0]; wg = P.dirt[1]; wb = P.dirt[2];
    }
    out.top[0] = q8(tr); out.top[1] = q8(tg); out.top[2] = q8(tb);
    out.wall[0] = q8(wr); out.wall[1] = q8(wg); out.wall[2] = q8(wb);
    if (out.water) {
      const d = Math.min(1, (wlv - h) / 14);
      let cr = P.waterSh[0] * (1 - d) + P.waterDp[0] * d;
      let cg = P.waterSh[1] * (1 - d) + P.waterDp[1] * d;
      let cb = P.waterSh[2] * (1 - d) + P.waterDp[2] * d;
      if (c.tA < 0.30) { cr = P.ice[0]; cg = P.ice[1]; cb = P.ice[2]; }
      out.wcol[0] = q8(cr); out.wcol[1] = q8(cg); out.wcol[2] = q8(cb);
    }

    /* 地物：普通树冠 */
    if (h <= SEA) return out;
    if (s <= 4) {
      // L1/L2 树冠由 lod.js 逐方块泼溅生成（含树冠半径），此处不处理
    } else { // 统计覆盖率：森林的"绒感"树冠；树种/配色经 pickTree 与近景同源
      let cov = 0;
      if (bio === E.B_FOREST) cov = 0.93;
      else if (bio === E.B_CHERRY) cov = 0.90;
      else if (bio === E.B_SWAMP) cov = 0.10;
      else if (bio === E.B_BASIN) cov = 0.34;
      else if (bio === E.B_SNOW) cov = c.snow ? 0.17 : 0.30;   // 雪林密度与 treeAt 0.008/0.014 同比
      else if (bio === E.B_PLAINS) cov = 0.05;
      else if (bio === E.B_DESERT) cov = 0.02;
      // 林线衰减（与 treeAt fade 1:1）：1475±20 以上树冠覆盖归零
      if (cov > 0 && h > 1400) {
        const tf = (1475 + (h2(x, z, 229) - 0.5) * 40 - h) / 75;
        cov *= tf <= 0 ? 0 : tf > 1 ? 1 : tf;
      }
      if (cov > 0 && h2(x, z, 801) < cov) {
        const rj = h2(x, z, 803);
        out.fh = h + 7 + Math.floor(rj * 5 / qh) * qh;
        out.fb = out.fh - 7;
        const fc = E.FOL[E.pickTree(x, z, bio, h)] || P.folFir;
        const j = (rj - 0.5) * (qh > 1 ? 14 : 26);
        out.fcol[0] = q8(fc[0] + j); out.fcol[1] = q8(fc[1] + j); out.fcol[2] = q8(fc[2] + j);
      }
    }
    return out;
  };

  E.makeLodOut = function () {
    return { h: 0, water: 0, fh: 0, fb: 0, bio: 0, snw: 0, ice: 0, wlv: 0, top: [0, 0, 0], wall: [0, 0, 0], wcol: [0, 0, 0], fcol: [0, 0, 0] };
  };
}
if (typeof module !== 'undefined') module.exports = GEN_MODULE;
