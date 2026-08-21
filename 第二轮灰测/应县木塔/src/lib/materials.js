// ---------------------------------------------------------------------------
// 材质库：柱、拱、斗、昂、枋、椽、瓦、石、铁……
// userData.shadow: 'both' | 'cast' | 'receive' | 'none'
// 榫头材质单列（MAT.tenon / MAT.mortise），可整体高亮以观察榫卯
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as TX from './textures.js';

const cache = {};
const T = (k, fn) => (cache[k] || (cache[k] = fn()));

function mk(name, params, shadow = 'both') {
  const m = new THREE.MeshStandardMaterial(params);
  m.name = name;
  m.userData.shadow = shadow;
  return m;
}

const woodParams = (tex, color = 0xffffff, rough = 0.86) => ({
  map: tex,
  color,
  roughness: rough,
  metalness: 0.02,
});

export const MAT = {
  /* --------------------------- 大木作 --------------------------- */
  zhu: mk('柱', woodParams(T('w1', () => TX.woodTexture('#9a7350', true, 3)))), // 柱（竖纹）
  zhuIn: mk('内槽柱', woodParams(T('w1b', () => TX.woodTexture('#8f6a49', true, 8)))),
  fang: mk('枋', woodParams(T('w2', () => TX.woodTexture('#a67f57', false, 13)))), // 阑额/普拍枋/罗汉枋
  gong: mk('拱', woodParams(T('w3', () => TX.woodTexture('#b48c60', false, 19)))), // 拱
  dou: mk('斗', woodParams(T('w4', () => TX.woodTexture('#ab8459', false, 27)))), // 斗
  ang: mk('昂', woodParams(T('w5', () => TX.woodTexture('#9c7550', false, 33)))), // 昂 / 耍头
  liang: mk('梁', woodParams(T('w6', () => TX.woodTexture('#a07850', false, 39)))), // 梁栿
  chuan: mk('椽', woodParams(T('w7', () => TX.woodTexture('#b9926a', false, 45)))), // 椽子
  ban: mk('板', woodParams(T('w8', () => TX.woodTexture('#a98a66', false, 51)))), // 望板/楼板
  door: mk('板门', woodParams(T('w9', () => TX.woodTexture('#8a5636', false, 57)), 0xe0bb96)),
  lan: mk('勾栏', woodParams(T('w10', () => TX.woodTexture('#a68053', false, 63)))),
  xie: mk('斜撑', woodParams(T('w11', () => TX.woodTexture('#8b6949', false, 69)))),

  /* --------------------------- 榫卯高亮 -------------------------- */
  tenon: mk('榫头', woodParams(T('w12', () => TX.woodTexture('#c09a68', false, 71)))),

  /* ----------------------------- 石作 ---------------------------- */
  stone: mk('台基石', woodParams(T('s1', () => TX.stoneTexture('#9d9a92', 11)), 0xffffff, 0.95)),
  stoneDark: mk('压阑石', woodParams(T('s2', () => TX.stoneTexture('#7f7c75', 17)), 0xffffff, 0.95)),
  base: mk('柱础', woodParams(T('s3', () => TX.stoneTexture('#8b8880', 23)), 0xffffff, 0.9)),

  /* ----------------------------- 瓦作 ---------------------------- */
  tile: mk('筒瓦', woodParams(T('t1', () => TX.tileTexture('#565b62', 23)), 0xffffff, 0.72)),
  tileDark: mk('脊瓦', woodParams(T('t2', () => TX.tileTexture('#44484e', 29)), 0xffffff, 0.7)),

  /* ----------------------------- 墙面 ---------------------------- */
  wall: mk('拱眼壁', woodParams(T('p1', () => TX.plasterTexture('#d7ccb4', 31)), 0xffffff, 0.95)),
  wallIn: mk('板壁', woodParams(T('p2', () => TX.plasterTexture('#c9bda2', 37)), 0xffffff, 0.95)),

  /* ----------------------------- 铁件 ---------------------------- */
  iron: mk('铁件', woodParams(T('i1', () => TX.ironTexture(41)), 0xffffff, 0.55)),

  /* ----------------------------- 地面 ---------------------------- */
  ground: mk('地面', woodParams(T('g1', () => TX.groundTexture(53)), 0xb9ae98, 1), 'receive'),
};

// 鎏金（塔刹宝珠）
MAT.gold = mk('鎏金', { color: 0xc9a44a, roughness: 0.3, metalness: 0.85 });

/** 榫卯高亮开关：把榫头类构件染成醒目的赭红 */
let hi = false;
export function setJointHighlight(on) {
  hi = on;
  MAT.tenon.color.set(on ? 0xd2603a : 0xffffff);
  MAT.tenon.emissive.set(on ? 0x3a1206 : 0x000000);
}
export const jointHighlight = () => hi;

/** 整体线框 / 半透明（看内部结构） */
export function setXray(on) {
  for (const k of Object.keys(MAT)) {
    const m = MAT[k];
    if (!m || !m.isMaterial) continue;
    if (k === 'ground') continue;
    m.transparent = on;
    m.opacity = on ? 0.38 : 1;
    m.depthWrite = !on;
    m.needsUpdate = true;
  }
}
