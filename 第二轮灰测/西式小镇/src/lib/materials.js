// ---------------------------------------------------------------------------
// 材质库：全镇共用的材质实例（共用才能合并几何、压低 draw call）
// userData.shadow: 'both' | 'cast' | 'receive' | 'none'
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as TX from './textures.js';

const cache = {};
function T(key, factory) {
  if (!cache[key]) cache[key] = factory();
  return cache[key];
}

function mk(name, params, shadow = 'both', extra = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  m.name = name;
  m.userData.shadow = shadow;
  Object.assign(m.userData, extra);
  return m;
}

// 夜间会自发光的材质（窗户、灯、炉火）
export const nightGlow = [];
function glowMat(name, params, color, intensity, shadow = 'none') {
  const m = mk(name, params, shadow);
  m.emissive = new THREE.Color(color);
  m.emissiveIntensity = 0;
  nightGlow.push({ mat: m, intensity });
  return m;
}

const texBrickRed = () => T('brickRed', () => TX.brickTexture('#a8503c', '#d8c9b0', 7));
const texBrickTan = () => T('brickTan', () => TX.brickTexture('#c98f5e', '#e6dcc4', 12));
const texBrickGrey = () => T('brickGrey', () => TX.brickTexture('#8d7f78', '#cfc7bb', 19));

export const MAT = {
  /* ------------------------------ 墙体 ------------------------------ */
  plasterCream: mk('plasterCream', { map: T('pl1', () => TX.plasterTexture('#f0e4cb', 11)), roughness: 0.9 }),
  plasterWhite: mk('plasterWhite', { map: T('pl2', () => TX.plasterTexture('#f6f1e6', 21)), roughness: 0.9 }),
  plasterOchre: mk('plasterOchre', { map: T('pl3', () => TX.plasterTexture('#e2b877', 33)), roughness: 0.9 }),
  plasterRose: mk('plasterRose', { map: T('pl4', () => TX.plasterTexture('#e3b9ad', 44)), roughness: 0.9 }),
  plasterBlue: mk('plasterBlue', { map: T('pl5', () => TX.plasterTexture('#bdcbd4', 55)), roughness: 0.9 }),
  plasterMint: mk('plasterMint', { map: T('pl6', () => TX.plasterTexture('#c8d6c0', 66)), roughness: 0.9 }),
  brickRed: mk('brickRed', { map: texBrickRed(), roughness: 0.95 }),
  brickTan: mk('brickTan', { map: texBrickTan(), roughness: 0.95 }),
  brickGrey: mk('brickGrey', { map: texBrickGrey(), roughness: 0.95 }),
  stone: mk('stone', { map: T('st1', () => TX.stoneTexture('#bdb6a8', 23)), roughness: 0.92 }),
  stoneDark: mk('stoneDark', { map: T('st2', () => TX.stoneTexture('#8f8a80', 29)), roughness: 0.95 }),
  stoneWarm: mk('stoneWarm', { map: T('st3', () => TX.stoneTexture('#d3c3a2', 37)), roughness: 0.9 }),

  /* ------------------------------ 木作 ------------------------------ */
  timber: mk('timber', { map: T('wd1', () => TX.woodTexture('#5a3d29', true, 31)), roughness: 0.85 }),
  timberDark: mk('timberDark', { map: T('wd2', () => TX.woodTexture('#3e2b1e', true, 39)), roughness: 0.85 }),
  woodPlank: mk('woodPlank', { map: T('wd3', () => TX.woodTexture('#9c6b3f', false, 47)), roughness: 0.85 }),
  woodPlankV: mk('woodPlankV', { map: T('wd4', () => TX.woodTexture('#8a5c37', true, 51)), roughness: 0.85 }),
  woodGrey: mk('woodGrey', { map: T('wd5', () => TX.woodTexture('#8d8577', false, 57)), roughness: 0.9 }),
  woodRed: mk('woodRed', { map: T('wd6', () => TX.woodTexture('#9c3f31', false, 59)), roughness: 0.85 }),

  /* ------------------------------ 屋顶 ------------------------------ */
  roofTerracotta: mk('roofTerracotta', { map: T('rf1', () => TX.tileTexture('#b0492f', 3)), roughness: 0.85 }),
  roofRust: mk('roofRust', { map: T('rf2', () => TX.tileTexture('#8f3f2c', 8)), roughness: 0.85 }),
  roofSlate: mk('roofSlate', { map: T('rf3', () => TX.tileTexture('#4d5560', 13)), roughness: 0.8 }),
  roofBlue: mk('roofBlue', { map: T('rf4', () => TX.tileTexture('#3f5570', 18)), roughness: 0.8 }),
  roofBrown: mk('roofBrown', { map: T('rf5', () => TX.tileTexture('#6d4a35', 25)), roughness: 0.85 }),
  roofGreen: mk('roofGreen', { map: T('rf6', () => TX.tileTexture('#4e7f6d', 27)), roughness: 0.7, metalness: 0.15 }),
  thatch: mk('thatch', { map: T('th1', () => TX.thatchTexture('#c19a4e', 73)), roughness: 1.0 }),

  /* ------------------------------ 地面 ------------------------------ */
  grass: mk('grass', { map: T('gr1', () => TX.grassTexture('#7d9b53', 17)), roughness: 1 }, 'receive'),
  grassDark: mk('grassDark', { map: T('gr2', () => TX.grassTexture('#5f7f45', 71)), roughness: 1 }, 'receive'),
  cobble: mk('cobble', { map: T('cb1', () => TX.cobbleTexture('#8e8779', 5)), roughness: 0.95 }, 'receive'),
  cobbleWarm: mk('cobbleWarm', { map: T('cb2', () => TX.cobbleTexture('#a89a83', 15)), roughness: 0.95 }, 'receive'),
  dirt: mk('dirt', { map: T('dt1', () => TX.dirtTexture('#9c7c54', 41)), roughness: 1 }, 'receive'),
  soil: mk('soil', { map: T('dt2', () => TX.dirtTexture('#6b543a', 43)), roughness: 1 }, 'receive'),
  gravel: mk('gravel', { map: T('dt3', () => TX.dirtTexture('#b3a894', 45)), roughness: 1 }, 'receive'),
  sand: mk('sand', { map: T('dt4', () => TX.dirtTexture('#d8c69b', 49)), roughness: 1 }, 'receive'),

  /* ------------------------------ 水面 ------------------------------ */
  water: (() => {
    const m = mk('water', {
      map: T('wt1', () => TX.waterTexture()),
      color: 0x9fc6dd,
      roughness: 0.12,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88,
    }, 'receive');
    return m;
  })(),
  waterStill: mk('waterStill', {
    map: T('wt1', () => TX.waterTexture()),
    color: 0x8fb9d6,
    roughness: 0.18,
    metalness: 0.3,
    transparent: true,
    opacity: 0.9,
  }, 'receive'),

  /* ------------------------------ 植物 ------------------------------ */
  trunk: mk('trunk', { map: T('wd7', () => TX.woodTexture('#6b4a30', true, 61)), roughness: 0.95 }),
  leafA: mk('leafA', { color: 0x4e7c3f, roughness: 0.9, flatShading: true }),
  leafB: mk('leafB', { color: 0x3f6b36, roughness: 0.9, flatShading: true }),
  leafC: mk('leafC', { color: 0x6d8f45, roughness: 0.9, flatShading: true }),
  leafD: mk('leafD', { color: 0x8a9c4e, roughness: 0.9, flatShading: true }),
  pine: mk('pine', { color: 0x2f5a3f, roughness: 0.9, flatShading: true }),
  hedge: mk('hedge', { color: 0x496b34, roughness: 1, flatShading: true }),
  crop: mk('crop', { color: 0xc9a94f, roughness: 1, flatShading: true, side: THREE.DoubleSide }),
  cropGreen: mk('cropGreen', { color: 0x7d9b3f, roughness: 1, flatShading: true, side: THREE.DoubleSide }),
  flowerRed: mk('flowerRed', { color: 0xc0392b, roughness: 0.9 }, 'none'),
  flowerPink: mk('flowerPink', { color: 0xd987a8, roughness: 0.9 }, 'none'),
  flowerYellow: mk('flowerYellow', { color: 0xe8c34a, roughness: 0.9 }, 'none'),
  flowerWhite: mk('flowerWhite', { color: 0xf2eee0, roughness: 0.9 }, 'none'),

  /* ------------------------------ 细部 ------------------------------ */
  trim: mk('trim', { color: 0xf3ece0, roughness: 0.8 }),
  trimDark: mk('trimDark', { color: 0x3c3630, roughness: 0.8 }),
  doorRed: mk('doorRed', { color: 0x7d3428, roughness: 0.7 }),
  doorGreen: mk('doorGreen', { color: 0x2f5744, roughness: 0.7 }),
  doorBlue: mk('doorBlue', { color: 0x33506e, roughness: 0.7 }),
  shutterGreen: mk('shutterGreen', { color: 0x3c6b4e, roughness: 0.8 }),
  shutterBlue: mk('shutterBlue', { color: 0x3d5f80, roughness: 0.8 }),
  shutterRed: mk('shutterRed', { color: 0x8f3b2f, roughness: 0.8 }),
  metal: mk('metal', { color: 0x4a4a52, roughness: 0.45, metalness: 0.8 }),
  metalRust: mk('metalRust', { color: 0x6e4a38, roughness: 0.7, metalness: 0.5 }),
  gold: mk('gold', { color: 0xd8a94a, roughness: 0.28, metalness: 0.95 }),
  copper: mk('copper', { color: 0x5f9e8a, roughness: 0.5, metalness: 0.6 }),
  black: mk('black', { color: 0x24232a, roughness: 0.6 }),
  white: mk('white', { color: 0xf5f2ea, roughness: 0.75 }),
  cloth: mk('cloth', { color: 0xe8e2d2, roughness: 1, side: THREE.DoubleSide }),
  clothRed: mk('clothRed', { color: 0xa8382f, roughness: 1, side: THREE.DoubleSide }),
  clothBlue: mk('clothBlue', { color: 0x2f4f74, roughness: 1, side: THREE.DoubleSide }),
  clothGreen: mk('clothGreen', { color: 0x3d6b4a, roughness: 1, side: THREE.DoubleSide }),
  clothCream: mk('clothCream', { color: 0xefe2c2, roughness: 1, side: THREE.DoubleSide }),
  coal: mk('coal', { color: 0x2a2a2e, roughness: 0.85 }),
  hay: mk('hay', { color: 0xd2b263, roughness: 1 }),
  sheep: mk('sheep', { color: 0xf0ece0, roughness: 1, flatShading: true }),
  cow: mk('cow', { color: 0x4a3a33, roughness: 1, flatShading: true }),
  cowWhite: mk('cowWhite', { color: 0xf2ede2, roughness: 1, flatShading: true }),
  duck: mk('duck', { color: 0xf6f2e6, roughness: 1, flatShading: true }),
  horse: mk('horse', { color: 0x6b4a34, roughness: 1, flatShading: true }),

  /* --------------------------- 夜间发光 ---------------------------- */
  glass: glowMat('glass', { color: 0x2b3a48, roughness: 0.15, metalness: 0.2 }, 0xffcb73, 1.9),
  glassStained: glowMat(
    'glassStained',
    { map: T('sg1', () => TX.stainedGlassTexture()), roughness: 0.3 },
    0xffd9a0,
    1.2,
    'none'
  ),
  lampGlass: glowMat('lampGlass', { color: 0xfff3d6, roughness: 0.2 }, 0xffc46b, 3.4),
  fire: glowMat('fire', { color: 0xff9a3c, roughness: 0.6 }, 0xff7a1e, 2.6),
};

/** 夜晚强度 0..1 */
export function setNight(k) {
  for (const g of nightGlow) g.mat.emissiveIntensity = g.intensity * k;
}

export const SPRITE_TEX = {
  glow: TX.glowTexture(),
  smoke: TX.smokeTexture(),
};
