/* DEEP SPACE CRAFT · universe.js —— 星系 / 星球 程序化生成（NMS 侧数据层） */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var U = DSC.Util, L = function () { return DSC.Lore; };

  /* ---------------------------------------------------------------- 群系配置
     每个群系定义：地表方块组、天空/大气配色、地形参数、危害、特征密度 */
  var BIOMES = {
    lush: {
      blocks: { surface: 'grass', sub: 'dirt', deep: 'stone', beach: 'sand', tree: 'log', leaf: 'leaves', crystal: 'chryson', extra: 'star_bulb' },
      sky: { top: '#2a6fd6', horizon: '#a8d8ef', fog: '#b9dcf0', sun: '#fff2d8', dens: 0.9 },
      space: { low: '#2e6b3a', mid: '#4f9a4a', high: '#8fae63', water: '#1f4f8f', ice: '#e8f4ff', cloud: '#ffffff' },
      atmo: '#7fc4ff', terrain: { sea: 34, amp: 20, rough: 1.0, cave: 1.0, tree: 1.0, ore: 1.0, crystal: 0.35, mount: 1.0 },
      hazard: { type: 'none', dps: 0 }, res: ['carbon', 'ferrite', 'sodium', 'oxygen', 'copper']
    },
    toxic: {
      blocks: { surface: 'alien_grass', sub: 'alien_dirt', deep: 'basalt', beach: 'alien_sand', tree: 'alien_log', leaf: 'fungal_cap', crystal: 'emeril_ore', extra: 'fungal_cap' },
      sky: { top: '#3f5a2a', horizon: '#c8d86a', fog: '#9fae57', sun: '#e8ffb0', dens: 1.5 },
      space: { low: '#3d5a2a', mid: '#7fa03c', high: '#b8c46a', water: '#4a6b1f', ice: '#dff0b0', cloud: '#d8e8a0' },
      atmo: '#b6f05a', terrain: { sea: 32, amp: 16, rough: 1.1, cave: 1.2, tree: 0.8, ore: 1.1, crystal: 0.5, mount: 0.8 },
      hazard: { type: 'toxic', dps: 3.2 }, res: ['carbon', 'emeril', 'sodium', 'oxygen', 'salt']
    },
    frozen: {
      blocks: { surface: 'snow_block', sub: 'frost_stone', deep: 'stone', beach: 'ice', tree: 'alien_log', leaf: 'alien_leaves', crystal: 'crystal_block', extra: 'ice' },
      sky: { top: '#5f86b8', horizon: '#dff0ff', fog: '#cfe6f7', sun: '#ffffff', dens: 1.2 },
      space: { low: '#7c96b8', mid: '#c8dcee', high: '#ffffff', water: '#3d6ea8', ice: '#ffffff', cloud: '#eef7ff' },
      atmo: '#bfe4ff', terrain: { sea: 30, amp: 26, rough: 1.2, cave: 0.9, tree: 0.35, ore: 1.0, crystal: 0.6, mount: 1.4 },
      hazard: { type: 'cold', dps: 3.6 }, res: ['ice_shard', 'ferrite', 'sodium', 'diamond', 'oxygen']
    },
    desert: {
      blocks: { surface: 'sand', sub: 'sandstone', deep: 'stone', beach: 'sand', tree: 'alien_log', leaf: 'alien_leaves', crystal: 'chryson', extra: 'salt_block' },
      sky: { top: '#c98b3a', horizon: '#f6d9a0', fog: '#e6c48a', sun: '#fff0c0', dens: 0.7 },
      space: { low: '#8a5f2a', mid: '#c99a4a', high: '#e8cf94', water: '#2f6f8f', ice: '#f0f0e0', cloud: '#f0e0b8' },
      atmo: '#ffc98a', terrain: { sea: 26, amp: 18, rough: 0.8, cave: 1.0, tree: 0.12, ore: 1.2, crystal: 0.4, mount: 0.9 },
      hazard: { type: 'heat', dps: 3.4 }, res: ['salt', 'ferrite', 'copper', 'gold', 'carbon']
    },
    radioactive: {
      blocks: { surface: 'alien_grass', sub: 'ash_block', deep: 'basalt', beach: 'alien_sand', tree: 'alien_log', leaf: 'alien_leaves', crystal: 'sodium_block', extra: 'star_bulb' },
      sky: { top: '#2c5a3a', horizon: '#8fe07a', fog: '#7fc46a', sun: '#e0ffcf', dens: 1.3 },
      space: { low: '#2f4f30', mid: '#5f9a4a', high: '#9fd070', water: '#2f6f5f', ice: '#dfffe0', cloud: '#c0f0b0' },
      atmo: '#8cff9a', terrain: { sea: 33, amp: 22, rough: 1.15, cave: 1.3, tree: 0.6, ore: 1.3, crystal: 0.7, mount: 1.1 },
      hazard: { type: 'radiation', dps: 3.8 }, res: ['sodium', 'emeril', 'copper', 'carbon', 'oxygen']
    },
    exotic: {
      blocks: { surface: 'alien_sand', sub: 'basalt', deep: 'obsidian', beach: 'crystal_block', tree: 'alien_log', leaf: 'crystal_block', crystal: 'indium', extra: 'lumina' },
      sky: { top: '#5a2c86', horizon: '#e07ad0', fog: '#b06ac0', sun: '#ffd8ff', dens: 1.6 },
      space: { low: '#4a2a6a', mid: '#8a4ab0', high: '#d090e0', water: '#3a2a8f', ice: '#f0dfff', cloud: '#e0b8ff' },
      atmo: '#e08cff', terrain: { sea: 28, amp: 30, rough: 1.5, cave: 1.4, tree: 0.5, ore: 1.5, crystal: 1.4, mount: 1.6 },
      hazard: { type: 'radiation', dps: 2.4 }, res: ['indium', 'chryson', 'emeril', 'diamond', 'sodium'] 
    },
    barren: {
      blocks: { surface: 'gravel', sub: 'stone', deep: 'basalt', beach: 'sand', tree: 'alien_log', leaf: 'alien_leaves', crystal: 'chryson', extra: 'cobblestone' },
      sky: { top: '#3a4a5a', horizon: '#9aa8b4', fog: '#8f9aa4', sun: '#ffffff', dens: 0.5 },
      space: { low: '#4a4a4a', mid: '#7a7a72', high: '#a8a89a', water: '#2a3a4a', ice: '#dcdcdc', cloud: '#c0c0c0' },
      atmo: '#a8c0d8', terrain: { sea: 18, amp: 24, rough: 1.0, cave: 1.5, tree: 0.03, ore: 1.4, crystal: 0.3, mount: 1.2 },
      hazard: { type: 'none', dps: 0 }, res: ['ferrite', 'carbon', 'copper', 'gold', 'diamond']
    },
    volcanic: {
      blocks: { surface: 'ash_block', sub: 'basalt', deep: 'obsidian', beach: 'red_sand', tree: 'alien_log', leaf: 'alien_leaves', crystal: 'chryson', extra: 'magma' },
      sky: { top: '#5a1a1a', horizon: '#e0703a', fog: '#a04a2a', sun: '#ffcf90', dens: 1.8 },
      space: { low: '#3a1a14', mid: '#7a3a20', high: '#c06030', water: '#8a2a10', ice: '#f0d0c0', cloud: '#a08070' },
      atmo: '#ff8a4a', terrain: { sea: 22, amp: 28, rough: 1.4, cave: 1.6, tree: 0.08, ore: 1.5, crystal: 0.5, mount: 1.5 },
      hazard: { type: 'heat', dps: 4.6 }, res: ['carbon', 'copper', 'gold', 'ferrite', 'chryson']
    },
    ocean: {
      blocks: { surface: 'sand', sub: 'sandstone', deep: 'stone', beach: 'sand', tree: 'coral_block', leaf: 'coral_block', crystal: 'chryson', extra: 'coral_block' },
      sky: { top: '#1f5aa8', horizon: '#8fd0e8', fog: '#a0d8ea', sun: '#fff6e0', dens: 1.1 },
      space: { low: '#1f4a7a', mid: '#2f7aa8', high: '#7fbfd8', water: '#12406f', ice: '#e0f4ff', cloud: '#ffffff' },
      atmo: '#7fd8ff', terrain: { sea: 46, amp: 14, rough: 0.9, cave: 0.8, tree: 0.5, ore: 0.9, crystal: 0.4, mount: 0.7 },
      hazard: { type: 'none', dps: 0 }, res: ['salt', 'oxygen', 'copper', 'carbon', 'ice_shard']
    }
  };

  var BIOME_KEYS = ['lush', 'toxic', 'frozen', 'desert', 'radioactive', 'exotic', 'barren', 'volcanic', 'ocean'];

  function hexv(h) { return U.hex(h); }

  /* ---------------------------------------------------------------- 星球 */
  function makePlanet(sysSeed, index, rng, forceBiome) {
    var biome = forceBiome || U.pick(rng, BIOME_KEYS);
    var B = BIOMES[biome];
    var lore = L();
    var seed = (sysSeed ^ Math.imul(index + 1, 0x9E3779B9)) >>> 0;
    var radius = U.randRange(rng, 1400, 3400);          /* 太空尺度（单位≈m 的抽象） */
    var orbit = 26000 + index * U.randRange(rng, 12000, 21000);
    var t = B.terrain;

    var p = {
      seed: seed, index: index, biome: biome,
      name: lore ? lore.planetName(rng) : 'PLANET-' + index,
      radius: radius,
      orbitRadius: orbit,
      orbitAngle: rng() * Math.PI * 2,
      orbitSpeed: 0.0009 / (1 + index * 0.35),
      orbitTilt: U.randRange(rng, -0.22, 0.22),
      spin: U.randRange(rng, 0.004, 0.02),
      axialTilt: U.randRange(rng, -0.4, 0.4),
      /* 太空外观 */
      palette: {
        low: hexv(B.space.low), mid: hexv(B.space.mid), high: hexv(B.space.high),
        water: hexv(B.space.water), ice: hexv(B.space.ice), cloud: hexv(B.space.cloud)
      },
      atmoColor: hexv(B.atmo),
      atmoStrength: U.randRange(rng, 0.75, 1.45),
      hasWater: biome === 'ocean' ? true : rng() < 0.62,
      hasClouds: rng() < 0.85,
      hasRings: rng() < 0.22,
      ringColor: hexv(U.pick(rng, ['#c8b48a', '#9fb8d0', '#d0a0b8', '#b0c8a8'])),
      cityLights: rng() < 0.18 ? U.randRange(rng, 0.3, 1) : 0,
      /* 地表天空 */
      sky: {
        top: hexv(B.sky.top), horizon: hexv(B.sky.horizon), fog: hexv(B.sky.fog),
        sun: hexv(B.sky.sun), fogDensity: B.sky.dens * U.randRange(rng, 0.8, 1.25),
        dayLength: U.randRange(rng, 340, 620)
      },
      /* 地形 */
      terrain: {
        seaLevel: Math.round(t.sea + U.randRange(rng, -4, 5)),
        amp: t.amp * U.randRange(rng, 0.82, 1.28),
        rough: t.rough * U.randRange(rng, 0.85, 1.2),
        cave: t.cave * U.randRange(rng, 0.8, 1.25),
        tree: t.tree * U.randRange(rng, 0.7, 1.35),
        ore: t.ore * U.randRange(rng, 0.85, 1.2),
        crystal: t.crystal * U.randRange(rng, 0.7, 1.5),
        mount: t.mount * U.randRange(rng, 0.8, 1.3),
        arch: rng() < 0.35 ? U.randRange(rng, 0.4, 1) : 0,   /* 浮空拱门/悬浮岛 */
        float: rng() < 0.22 ? U.randRange(rng, 0.4, 1) : 0
      },
      blocks: B.blocks,
      hazard: { type: B.hazard.type, dps: B.hazard.dps * U.randRange(rng, 0.8, 1.25), level: 0 },
      resources: B.res.slice(),
      /* 文案 */
      labels: null,
      discovered: false, scanned: false, visited: false, customName: null
    };

    if (lore) {
      p.labels = {
        biome: lore.biomeLabel(biome),
        weather: lore.weather(rng, biome),
        sentinels: lore.sentinels(rng),
        flora: lore.floraLine(rng),
        fauna: lore.faunaLine(rng),
        blurb: lore.discoveryBlurb(rng, 'planet')
      };
      p.hazard.level = p.labels.weather.hazard;
    } else {
      p.labels = {
        biome: { zh: biome, en: biome.toUpperCase(), desc: '' },
        weather: { zh: '未知', en: 'UNKNOWN', hazard: 0 },
        sentinels: { zh: '未知', en: 'UNKNOWN', level: 0 },
        flora: { zh: '未知', en: 'UNKNOWN' }, fauna: { zh: '未知', en: 'UNKNOWN' },
        blurb: ''
      };
    }
    /* 极端天候放大危害 */
    p.hazard.dps *= (1 + p.hazard.level * 0.35);
    return p;
  }

  /* ---------------------------------------------------------------- 星系 */
  function makeSystem(seed, mapPos, idx) {
    var rng = U.makeRng(seed);
    var lore = L();
    var sc = lore ? lore.starClass(rng) : { zh: '黄矮星', en: 'G', color: '#fff2d0' };
    var n = 2 + Math.floor(rng() * 4);
    var sys = {
      seed: seed, index: idx,
      name: lore ? lore.systemName(rng) : 'SYS-' + idx,
      starClass: sc, starColor: hexv(sc.color),
      economy: lore ? lore.systemEconomy(rng) : { zh: '采矿', en: 'MINING', color: '#ffa03c' },
      nebulaA: hexv(U.pick(rng, ['#3a1f6e', '#6e1f3a', '#1f3a6e', '#6e4a1f', '#1f6e5a', '#4a1f6e'])),
      nebulaB: hexv(U.pick(rng, ['#0a1030', '#301020', '#102030', '#201830', '#08202a'])),
      starDensity: U.randRange(rng, 0.7, 1.4),
      mapPos: mapPos,
      planets: [], visited: false, scanned: false
    };
    var used = {};
    for (var i = 0; i < n; i++) {
      var forced = null;
      /* 保证首星系第一颗是宜居的 lush，给新手一个温柔开局 */
      if (idx === 0 && i === 0) forced = 'lush';
      var p = makePlanet(seed, i, rng, forced);
      while (used[p.biome] && rng() < 0.55) { p = makePlanet(seed, i, rng, null); }
      used[p.biome] = 1;
      p.system = sys;
      sys.planets.push(p);
    }
    /* 空间站（NMS 味的太空锚点） */
    sys.station = {
      angle: rng() * Math.PI * 2, dist: 16000 + rng() * 6000,
      y: U.randRange(rng, -2200, 2200), spin: 0.05,
      name: (lore ? lore.systemName(rng) : 'STATION') + ' 空间站'
    };
    return sys;
  }

  /* ---------------------------------------------------------------- 银河 */
  function makeGalaxy(seedStr, count) {
    var baseSeed = typeof seedStr === 'number' ? (seedStr >>> 0) : U.hashStr(String(seedStr || 'DEEP-SPACE'));
    var rng = U.makeRng(baseSeed);
    count = count || 26;
    var systems = [], i;
    for (i = 0; i < count; i++) {
      /* 螺旋臂分布，供星系图使用（归一化 0..1 坐标） */
      var arm = i % 2, t = i / count;
      var ang = t * Math.PI * 3.1 + arm * Math.PI + U.randRange(rng, -0.22, 0.22);
      var rad = 0.09 + t * 0.42 + U.randRange(rng, -0.05, 0.05);
      var pos = [0.5 + Math.cos(ang) * rad, 0.5 + Math.sin(ang) * rad * 0.82];
      var sSeed = (baseSeed ^ Math.imul(i + 7, 0x85EBCA6B)) >>> 0;
      systems.push(makeSystem(sSeed, pos, i));
    }
    return {
      seed: baseSeed, seedStr: String(seedStr || 'DEEP-SPACE'), systems: systems,
      current: 0,
      name: (L() ? L().systemName(rng) : 'GALAXY') + ' 星云带'
    };
  }

  /* 两星系间曲速距离（用于耗费与星系图连线） */
  function warpDistance(a, b) {
    var dx = a.mapPos[0] - b.mapPos[0], dy = a.mapPos[1] - b.mapPos[1];
    return Math.sqrt(dx * dx + dy * dy) * 1200; /* 光年 */
  }
  function warpCost(a, b) {
    return Math.max(1, Math.round(warpDistance(a, b) / 220));
  }

  DSC.Universe = {
    BIOMES: BIOMES, BIOME_KEYS: BIOME_KEYS,
    makeGalaxy: makeGalaxy, makeSystem: makeSystem, makePlanet: makePlanet,
    warpDistance: warpDistance, warpCost: warpCost,
    biomeOf: function (k) { return BIOMES[k] || BIOMES.lush; }
  };
})();
