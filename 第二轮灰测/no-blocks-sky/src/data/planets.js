// Procedural star systems, planets, palettes, hazards — No Man's Sky flavour.
import { makeRng, strSeed } from '../core/rng.js';
import { hex, mix, shade } from '../world/atlas.js';

const SYL_A = ['Ap', 'Ni', 'Ko', 'Vek', 'Er', 'Zo', 'Tu', 'Bal', 'Cy', 'Dro', 'Fe', 'Gam', 'Hyl', 'Ix', 'Jor', 'Kel', 'Lum', 'Mar', 'Nax', 'Oth', 'Pol', 'Qua', 'Rho', 'Sil', 'Tha', 'Ura', 'Vor', 'Wex', 'Xan', 'Yth', 'Zar'];
const SYL_B = ['te', 'na', 'va', 'ri', 'mo', 'shi', 'lu', 'ke', 'da', 'zu', 'pha', 'gre', 'sto', 'nyx', 'bel', 'car', 'dim', 'eno'];
const SYL_C = ['feu', 'nis', 'xis', 'ra', 'gon', 'tal', 'sha', 'vek', 'mir', 'dor', 'lyn', 'sur', 'tep', 'wu', 'zen', 'iv'];
const SUFFIX = ['', ' Prime', ' Major', ' Minor', ' XVI', ' IX', ' IV', ' VII', ' XI', ' Alpha', ' Beta', ' Gamma', ' Delta', ' Epsilon'];

export function procName(rng) {
  let n = rng.pick(SYL_A) + rng.pick(SYL_B);
  if (rng.chance(0.55)) n += rng.pick(SYL_C);
  if (rng.chance(0.3)) n += '-' + rng.pick(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII']);
  else n += rng.pick(SUFFIX);
  return n;
}

export const BIOMES = {
  lush: {
    key: 'lush', name: 'Lush', cn: '茂盛星球',
    desc: ['生机勃勃', '异星丛林', '温和气候', '繁茂植被'],
    hazard: 'none', hazardLevel: 0,
    weather: ['微风', '细雨', '晴朗', '雾气'],
    pal: () => ({
      grass: hex(0x6cbf4a), grass2: hex(0x8fdd63), dirt: hex(0x7d5a3a), stone: hex(0x8b9098),
      sand: hex(0xdfd39a), wood: hex(0x86603a), leaf: hex(0x4fa83d), water: hex(0x3d86d8),
      rock: hex(0x7c8189), glow: hex(0x8affd0), floraRed: hex(0xe0483d), floraYellow: hex(0xf2c93a),
      crystal: hex(0x49c8ff),
      sky: hex(0x5aa2e8), skyHorizon: hex(0xbfe4ff), fog: hex(0xa9d6f5), sun: hex(0xfff3d6),
      cloud: hex(0xffffff), ambient: hex(0x6f88a8), spaceTint: hex(0x59b2ff),
    }),
    terrain: { amp: 26, hill: 9, mountain: 34, sea: 44, base: 46, caves: 1, water: true, treeDensity: 0.055, tufts: 0.22, boulders: 0.012, crystals: 0.004, trees: ['oak', 'oak', 'tall', 'mushroom'] },
  },
  desert: {
    key: 'desert', name: 'Scorched', cn: '灼热星球',
    desc: ['干旱荒漠', '烈日炙烤', '沙暴频发', '缺水'],
    hazard: 'heat', hazardLevel: 2,
    weather: ['热浪', '沙尘', '干燥', '灼热风暴'],
    pal: () => ({
      grass: hex(0xc0a85a), grass2: hex(0xd8c070), dirt: hex(0xa8763f), stone: hex(0xa08056),
      sand: hex(0xe8c882), wood: hex(0x8a6234), leaf: hex(0x9aa84a), water: hex(0x36a0a8),
      rock: hex(0xb08a58), glow: hex(0xffb64a), floraRed: hex(0xe0603d), floraYellow: hex(0xffd24a),
      crystal: hex(0x5fd9ff),
      sky: hex(0xe8a95a), skyHorizon: hex(0xffe0a8), fog: hex(0xf2cf96), sun: hex(0xfff0c0),
      cloud: hex(0xffe8c8), ambient: hex(0xa8825a), spaceTint: hex(0xffb45a),
    }),
    terrain: { amp: 20, hill: 7, mountain: 26, sea: 38, base: 44, caves: 1, water: true, treeDensity: 0.008, tufts: 0.06, boulders: 0.03, crystals: 0.006, trees: ['cactus', 'dead'] },
  },
  frozen: {
    key: 'frozen', name: 'Frozen', cn: '冰冻星球',
    desc: ['极寒冰原', '永冻荒野', '暴风雪', '冰晶遍布'],
    hazard: 'cold', hazardLevel: 2,
    weather: ['降雪', '暴风雪', '严寒', '冰雾'],
    pal: () => ({
      grass: hex(0xa8ccc0), grass2: hex(0xd6ece6), dirt: hex(0x6e6a72), stone: hex(0x8e96a2),
      sand: hex(0xd8e2ea), wood: hex(0x6a5b52), leaf: hex(0x6fa8a0), water: hex(0x4a8ad0),
      rock: hex(0x7e8894), glow: hex(0x9fe8ff), floraRed: hex(0xd06a80), floraYellow: hex(0xd8e05a),
      crystal: hex(0x8ce0ff),
      sky: hex(0x7fb4d8), skyHorizon: hex(0xdcf0ff), fog: hex(0xd2e6f2), sun: hex(0xeaf6ff),
      cloud: hex(0xf2f8ff), ambient: hex(0x8fa8bd), spaceTint: hex(0x9fd8ff),
    }),
    terrain: { amp: 24, hill: 8, mountain: 40, sea: 42, base: 46, caves: 1, water: true, treeDensity: 0.03, tufts: 0.1, boulders: 0.02, crystals: 0.012, trees: ['pine', 'dead', 'pine'] },
  },
  toxic: {
    key: 'toxic', name: 'Toxic', cn: '剧毒星球',
    desc: ['腐蚀大气', '毒沼遍地', '孢子云', '酸雨'],
    hazard: 'toxic', hazardLevel: 3,
    weather: ['酸雨', '毒雾', '孢子风', '腐蚀暴雨'],
    pal: () => ({
      grass: hex(0x87c23a), grass2: hex(0xc3e05a), dirt: hex(0x5c5230), stone: hex(0x6e7a58),
      sand: hex(0xb2b25a), wood: hex(0x5e5a30), leaf: hex(0x9ad63a), water: hex(0x5ac26a),
      rock: hex(0x66744e), glow: hex(0xb6ff4a), floraRed: hex(0xd63a8a), floraYellow: hex(0xd8f23a),
      crystal: hex(0x6affc0),
      sky: hex(0x8fbf4a), skyHorizon: hex(0xd6e88a), fog: hex(0xb6cc6a), sun: hex(0xf2ffc0),
      cloud: hex(0xd8e8a0), ambient: hex(0x76924a), spaceTint: hex(0x9aff5a),
    }),
    terrain: { amp: 22, hill: 10, mountain: 24, sea: 45, base: 46, caves: 1.2, water: true, treeDensity: 0.06, tufts: 0.26, boulders: 0.014, crystals: 0.008, trees: ['mushroom', 'mushroom', 'tall'] },
  },
  radioactive: {
    key: 'radioactive', name: 'Irradiated', cn: '辐射星球',
    desc: ['伽马射线', '辐射废土', '离子风暴', '发光矿脉'],
    hazard: 'radiation', hazardLevel: 3,
    weather: ['辐射尘', '离子风暴', '干燥', '静电云'],
    pal: () => ({
      grass: hex(0x9ac23a), grass2: hex(0xd6e05a), dirt: hex(0x7a5a3a), stone: hex(0x8a8270),
      sand: hex(0xd0b878), wood: hex(0x6e5638), leaf: hex(0xb6d63a), water: hex(0x4ac2a8),
      rock: hex(0x8a8068), glow: hex(0x6affe0), floraRed: hex(0xff5a3a), floraYellow: hex(0xf2ff5a),
      crystal: hex(0x5affd8),
      sky: hex(0x4ac2b0), skyHorizon: hex(0xc0f2e8), fog: hex(0x9fd8cc), sun: hex(0xe8ffd6),
      cloud: hex(0xd6f2e8), ambient: hex(0x6fa898), spaceTint: hex(0x5affd0),
    }),
    terrain: { amp: 26, hill: 9, mountain: 30, sea: 40, base: 45, caves: 1.1, water: true, treeDensity: 0.03, tufts: 0.14, boulders: 0.025, crystals: 0.018, trees: ['dead', 'tall', 'dead'] },
  },
  volcanic: {
    key: 'volcanic', name: 'Volcanic', cn: '火山星球',
    desc: ['熔岩地表', '火山灰云', '地热喷发', '焦土'],
    hazard: 'heat', hazardLevel: 4,
    weather: ['火山灰', '熔岩喷发', '炽热风', '烟尘'],
    pal: () => ({
      grass: hex(0x6a4a3a), grass2: hex(0x8a5a42), dirt: hex(0x4a3a34), stone: hex(0x5a5258),
      sand: hex(0x6e5a4a), wood: hex(0x4a3a2e), leaf: hex(0x8a4a2e), water: hex(0xff6a1e),
      rock: hex(0x50484e), glow: hex(0xff7a2e), floraRed: hex(0xff4a2e), floraYellow: hex(0xffa02e),
      crystal: hex(0xff9a4a),
      sky: hex(0x8a3a2e), skyHorizon: hex(0xe8763a), fog: hex(0x9a5540), sun: hex(0xffd6a0),
      cloud: hex(0x6a4a44), ambient: hex(0x7a4a3a), spaceTint: hex(0xff7a3a),
    }),
    terrain: { amp: 30, hill: 12, mountain: 44, sea: 36, base: 46, caves: 1.4, water: true, treeDensity: 0.006, tufts: 0.03, boulders: 0.04, crystals: 0.01, trees: ['dead', 'dead'] },
  },
  exotic: {
    key: 'exotic', name: 'Exotic', cn: '奇异星球',
    desc: ['未知构造', '晶体丛林', '异常读数', '几何生物群'],
    hazard: 'none', hazardLevel: 1,
    weather: ['异常静电', '晶尘', '奇异微风', '虹彩雾'],
    pal: () => ({
      grass: hex(0xc85ad8), grass2: hex(0xe89aff), dirt: hex(0x5a4a72), stone: hex(0x7a6a9a),
      sand: hex(0xd8b6e8), wood: hex(0x6a4a82), leaf: hex(0xff6ad8), water: hex(0x9a5aff),
      rock: hex(0x6a5a8a), glow: hex(0xff9aff), floraRed: hex(0xff4aa8), floraYellow: hex(0xa0ff6a),
      crystal: hex(0xc06aff),
      sky: hex(0x9a4ad8), skyHorizon: hex(0xffb6f2), fog: hex(0xc08ae8), sun: hex(0xffe0ff),
      cloud: hex(0xe8c0ff), ambient: hex(0x8a6ab0), spaceTint: hex(0xc06aff),
    }),
    terrain: { amp: 34, hill: 14, mountain: 38, sea: 42, base: 48, caves: 1.3, water: true, treeDensity: 0.05, tufts: 0.2, boulders: 0.02, crystals: 0.03, trees: ['spiral', 'spiral', 'mushroom'] },
  },
  barren: {
    key: 'barren', name: 'Barren', cn: '荒芜星球',
    desc: ['贫瘠岩地', '无大气活动', '陨石坑', '死寂'],
    hazard: 'none', hazardLevel: 1,
    weather: ['无风', '尘埃', '静默', '微弱辐射'],
    pal: () => ({
      grass: hex(0x8a7a62), grass2: hex(0xa89a7a), dirt: hex(0x6e6252), stone: hex(0x8a8a88),
      sand: hex(0xbaae94), wood: hex(0x6a5a48), leaf: hex(0x8a8a5a), water: hex(0x4a7a8a),
      rock: hex(0x86847e), glow: hex(0xffd68a), floraRed: hex(0xc06a4a), floraYellow: hex(0xd8c06a),
      crystal: hex(0x8ad8ff),
      sky: hex(0x7a8a9a), skyHorizon: hex(0xd0d6dc), fog: hex(0xb0b6bc), sun: hex(0xfff6e0),
      cloud: hex(0xd8dce0), ambient: hex(0x8a8f96), spaceTint: hex(0xb0b6bc),
    }),
    terrain: { amp: 18, hill: 6, mountain: 22, sea: 34, base: 42, caves: 0.9, water: false, treeDensity: 0.004, tufts: 0.03, boulders: 0.035, crystals: 0.01, trees: ['dead'] },
  },
};

export const HAZARD_INFO = {
  none: { cn: '无危害', en: 'BENIGN', icon: '✔', color: '#7fe8a0' },
  heat: { cn: '高温', en: 'EXTREME HEAT', icon: '☀', color: '#ff8a3a' },
  cold: { cn: '严寒', en: 'EXTREME COLD', icon: '❄', color: '#7fd8ff' },
  toxic: { cn: '剧毒', en: 'TOXIC ATMOSPHERE', icon: '☣', color: '#b6ff4a' },
  radiation: { cn: '辐射', en: 'RADIATION', icon: '☢', color: '#6affe0' },
};

const BIOME_KEYS = Object.keys(BIOMES);

export function makePlanet(rng, index, systemName) {
  const key = rng.pick(BIOME_KEYS);
  const b = BIOMES[key];
  const seed = (rng.next() * 0xffffffff) >>> 0;
  const pal = b.pal();
  const name = procName(rng);
  const hazardLevel = Math.max(0, Math.min(4, b.hazardLevel + (rng.chance(0.3) ? (rng.chance(0.5) ? 1 : -1) : 0)));
  const radius = 46 + rng.range(0, 40);
  return {
    id: systemName + '#' + index,
    name, seed, biome: key, biomeName: b.name, biomeCn: b.cn,
    desc: rng.pick(b.desc), weather: rng.pick(b.weather),
    hazard: b.hazard, hazardLevel,
    sentinels: rng.pick(['低', '低', '中', '中', '高', '被动']),
    fauna: rng.chance(0.75), faunaCount: rng.int(2, 6),
    flora: rng.chance(0.9),
    palette: pal,
    terrain: Object.assign({}, b.terrain),
    // space placement
    orbit: 260 + index * 210 + rng.range(-40, 40),
    orbitPhase: rng.range(0, Math.PI * 2),
    orbitSpeed: rng.range(0.004, 0.012) * (rng.chance(0.2) ? -1 : 1),
    radius,
    axialTilt: rng.range(-0.4, 0.4),
    ringed: rng.chance(0.25),
    moon: rng.chance(0.5),
    discovered: false,
  };
}

export function generateSystem(seedStr) {
  const seed = typeof seedStr === 'number' ? seedStr : strSeed(String(seedStr));
  const rng = makeRng(seed);
  const name = procName(rng);
  const starClass = rng.pick(['F', 'G', 'K', 'M', 'B', 'O']);
  const starColors = { F: 0xfff4e0, G: 0xffe9a8, K: 0xffb86a, M: 0xff7a5a, B: 0x9fd0ff, O: 0x6aa8ff };
  const count = rng.int(3, 5);
  const planets = [];
  for (let i = 0; i < count; i++) planets.push(makePlanet(rng, i, name));
  return {
    seed, name, starClass, starColor: starColors[starClass],
    economy: rng.pick(['采矿业', '制造业', '贸易中心', '科研', '高科技', '能源生产']),
    conflict: rng.pick(['低', '中', '高', '和平']),
    race: rng.pick(['盖克 GEK', '克若维斯 KORVAX', '瓦伊金 VYKEEN']),
    planets,
    station: { name: name + ' 空间站', orbit: 170, phase: rng.range(0, 6.28) },
    discovered: false,
  };
}
