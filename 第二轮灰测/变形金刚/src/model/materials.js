/**
 * materials.js —— 共享材质库（经典红/蓝/铬配色）
 * 所有零件共用这些材质实例，于是 GUI 里改一次颜色/金属度，全身立即生效。
 */
import * as THREE from 'three';
import { softDot } from './geom.js';

export const PALETTE = {
  red: '#c8202a',      // 主装甲红
  blue: '#1f4fa0',     // 次装甲蓝
  metal: '#b9c0c9',    // 银灰结构件
  chrome: '#e8edf4',   // 镀铬（排气管 / 前格栅）
  dark: '#20242b',     // 关节 / 液压 / 缝隙
  glass: '#8fd0ff',    // 风挡玻璃
  glow: '#7fe3ff',     // 眼睛 / 能量光
  lamp: '#fff3d0',     // 车灯
};

export function createMaterials() {
  const P = { ...PALETTE };
  const std = (color, metalness, roughness, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });

  const M = {
    red: std(P.red, 0.58, 0.34),
    redDark: std(P.red, 0.60, 0.46),
    blue: std(P.blue, 0.60, 0.32),
    blueDark: std(P.blue, 0.62, 0.44),
    metal: std(P.metal, 0.88, 0.30),
    chrome: std(P.chrome, 1.0, 0.09),
    dark: std(P.dark, 0.72, 0.52),
    joint: std('#2b3138', 0.90, 0.38),
    tire: std('#101317', 0.18, 0.92),
    tireTread: std('#0a0c0f', 0.16, 0.98),
    glass: new THREE.MeshStandardMaterial({
      color: P.glass, metalness: 0.55, roughness: 0.06,
      transparent: true, opacity: 0.42, envMapIntensity: 1.4,
    }),
    glow: new THREE.MeshStandardMaterial({
      color: '#0a1620', emissive: new THREE.Color(P.glow), emissiveIntensity: 2.6, roughness: 0.4,
    }),
    lamp: new THREE.MeshStandardMaterial({
      color: '#2b2d31', emissive: new THREE.Color(P.lamp), emissiveIntensity: 0.45, roughness: 0.18, metalness: 0.35,
    }),
    amber: new THREE.MeshStandardMaterial({
      color: '#2a1a05', emissive: new THREE.Color('#ffa522'), emissiveIntensity: 0.9, roughness: 0.35,
    }),
    emblem: null,      // 见下方（带贴图）
    energy: new THREE.MeshBasicMaterial({
      color: P.glow, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    }),
    boltCore: new THREE.MeshBasicMaterial({ color: '#dffbff' }),
    boltGlow: new THREE.MeshBasicMaterial({
      color: P.glow, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  };

  // 机体材质集合（受线框/金属度/爆炸等全局开关影响；玻璃与发光另算）
  M.body = [M.red, M.redDark, M.blue, M.blueDark, M.metal, M.chrome, M.dark, M.joint, M.tire, M.tireTread];
  M.paint = [M.red, M.redDark, M.blue, M.blueDark];
  M.all = Object.values(M).filter((m) => m && m.isMaterial);
  M.palette = P;
  M.dot = softDot();
  return M;
}

/** GUI 改色回调 */
export function applyPalette(M, key, hex) {
  M.palette[key] = hex;
  const c = new THREE.Color(hex);
  switch (key) {
    case 'red': M.red.color.copy(c); M.redDark.color.copy(c); break;
    case 'blue': M.blue.color.copy(c); M.blueDark.color.copy(c); break;
    case 'metal': M.metal.color.copy(c); break;
    case 'chrome': M.chrome.color.copy(c); break;
    case 'dark': M.dark.color.copy(c); M.joint.color.set(hex); break;
    case 'glass': M.glass.color.copy(c); break;
    case 'glow':
      M.glow.emissive.copy(c); M.energy.color.copy(c); M.boltGlow.color.copy(c);
      break;
    case 'lamp': M.lamp.emissive.copy(c); break;
  }
}
