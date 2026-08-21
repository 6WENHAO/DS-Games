import type * as THREE from 'three';

export type DisasterId =
  | 'blast'
  | 'meteor'
  | 'lightning'
  | 'tornado'
  | 'blackhole'
  | 'nuke'
  | 'quake'
  | 'flood'
  | 'storm';

export interface DisasterSpec {
  id: DisasterId;
  name: string;
  icon: string;
  /** CSS colour for the toolbar glow. */
  css: string;
  /** Three.js hex for the aiming reticle. */
  hex: number;
  sustained: boolean;
  /** Aiming reticle radius for the current power setting. */
  radius: (power: number) => number;
  hint: string;
}

export const SPECS: DisasterSpec[] = [
  {
    id: 'blast',
    name: '定点爆破',
    icon: '💥',
    css: '#ff8a4c',
    hex: 0xff9a4c,
    sustained: false,
    radius: (p) => 9 * p,
    hint: '点击地图释放【定点爆破】',
  },
  {
    id: 'meteor',
    name: '陨石坠落',
    icon: '☄️',
    css: '#ff6a3d',
    hex: 0xff7a3d,
    sustained: false,
    radius: (p) => 15 * p,
    hint: '点击地图释放【陨石坠落】',
  },
  {
    id: 'lightning',
    name: '天罚落雷',
    icon: '⚡',
    css: '#7cc4ff',
    hex: 0xaee2ff,
    sustained: false,
    radius: (p) => 4.2 * p,
    hint: '点击地图释放【天罚落雷】',
  },
  {
    id: 'tornado',
    name: '龙卷风',
    icon: '🌪️',
    css: '#9fb6c9',
    hex: 0xd7e4ee,
    sustained: true,
    radius: (p) => 16 * p,
    hint: '点击地图投放【龙卷风】',
  },
  {
    id: 'blackhole',
    name: '微型黑洞',
    icon: '🕳️',
    css: '#b57bff',
    hex: 0xc08cff,
    sustained: true,
    radius: (p) => 26 * p,
    hint: '点击地图投放【微型黑洞】',
  },
  {
    id: 'nuke',
    name: '核弹',
    icon: '☢️',
    css: '#ffd23f',
    hex: 0xfff0a0,
    sustained: false,
    radius: (p) => 36 * p,
    hint: '点击地图投放【核弹】',
  },
  {
    id: 'quake',
    name: '大地震',
    icon: '📳',
    css: '#c08a5a',
    hex: 0xd8a06a,
    sustained: true,
    radius: () => 46,
    hint: '点击地图启动【大地震】',
  },
  {
    id: 'flood',
    name: '大洪水',
    icon: '🌊',
    css: '#3fb8ff',
    hex: 0x5fc8ff,
    sustained: true,
    radius: (p) => 30 * p,
    hint: '点击地图启动【大洪水】',
  },
  {
    id: 'storm',
    name: '雷暴',
    icon: '⛈️',
    css: '#6f8fb5',
    hex: 0x9fc4ff,
    sustained: true,
    radius: (p) => 30 * p,
    hint: '点击地图启动【雷暴】',
  },
];

export interface Disaster {
  readonly id: DisasterId;
  readonly sustained: boolean;
  readonly running: boolean;
  /** Fire an instant disaster, or start a sustained one. */
  trigger(x: number, z: number, power: number): void;
  stop(): void;
  update(dt: number, simDt: number): void;
  /** Keyboard steering for sustained disasters (unit vector on the ground). */
  steer(v: THREE.Vector2, dt: number): void;
  reset(): void;
  /** Extra on-screen hint while running. */
  runningHint(): string;
}
