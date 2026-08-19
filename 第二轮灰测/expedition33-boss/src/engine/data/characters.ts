import type { ActorState, ElementId } from '../types';

export interface CharacterSeed {
  id: string;
  name: string;
  role: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  ap: number;
  critRate: number;
  weaponElement: ElementId;
  portrait: string;
  color: string;
  rimColor: string;
  blurb: string;
}

export const CHARACTER_SEEDS: CharacterSeed[] = [
  {
    id: 'sciel',
    name: '熙艾尔',
    role: '先见 / 增益 / 插队',
    hp: 932,
    attack: 170,
    defense: 120,
    speed: 118,
    ap: 4,
    critRate: 0.1,
    weaponElement: 'dark',
    portrait: '熙',
    color: '#a97cff',
    rimColor: '#7f6bd8',
    blurb: '以先见叠层与日月姿态操纵战局节奏。',
  },
  {
    id: 'lune',
    name: '吕涅',
    role: '异色 / 燃烧 / 治疗',
    hp: 1424,
    attack: 155,
    defense: 108,
    speed: 106,
    ap: 4,
    critRate: 0.08,
    weaponElement: 'ice',
    portrait: '吕',
    color: '#59c9f2',
    rimColor: '#4aa6e8',
    blurb: '收集五色异色印记，以元素组合改写伤害与治疗。',
  },
  {
    id: 'maelle',
    name: '玛埃尔',
    role: '姿态 / 爆发 / 破防',
    hp: 1193,
    attack: 190,
    defense: 115,
    speed: 125,
    ap: 5,
    critRate: 0.12,
    weaponElement: 'light',
    portrait: '玛',
    color: '#ff6f5e',
    rimColor: '#ffd479',
    blurb: '在攻守之间切换姿态，于高手态爆发致命剑舞。',
  },
];

export function createActorFromSeed(seed: CharacterSeed, index: number): ActorState {
  return {
    id: seed.id,
    name: seed.name,
    kind: 'player',
    role: seed.role,
    hp: seed.hp,
    maxHp: seed.hp,
    ap: seed.ap,
    maxAp: 9,
    attack: seed.attack,
    defense: seed.defense,
    speed: seed.speed,
    critRate: seed.critRate,
    critResist: 0,
    shield: 2,
    maxShield: 5,
    alive: true,
    statuses: [],
    nextActAt: 0,
    seq: index,
    weaponElement: seed.weaponElement,
    elementMods: {},
    foretell: {},
    phaseTag: 'sun',
    twilightTurns: 0,
    alternations: 0,
    lastTagUsed: null,
    stains: [],
    maxStains: 4,
    stance: 'none',
    breakGauge: 0,
    breakMax: 0,
    broken: false,
    brokenSkipPending: false,
    weakPoints: [],
    fateUsedInChain: false,
    extraTurnUsedInRound: false,
    portrait: seed.portrait,
    color: seed.color,
  };
}

export const ITEM_DEFS = [
  {
    id: 'heal',
    name: '中瓶疗愈亮色',
    target: 'ally' as const,
    desc: '恢复 45% 最大生命',
    longDesc: '单个友方恢复其最大生命 45%。若目标处于倒逆，治疗将转为等量伤害。',
    actionDelay: 0.95,
  },
  {
    id: 'energy',
    name: '强力精力亮色',
    target: 'ally' as const,
    desc: '获得 7 点行动点',
    longDesc: '单个友方获得 7 点行动点，上限 9。',
    actionDelay: 0.95,
  },
  {
    id: 'revive',
    name: '复苏亮色',
    target: 'deadAlly' as const,
    desc: '复活并恢复 50% 生命',
    longDesc: '复活一名已倒下的远征队员，并恢复其最大生命 50%。',
    actionDelay: 0.95,
  },
];
