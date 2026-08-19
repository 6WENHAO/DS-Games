import type { ActorState, BossMoveDef, ElementId, WeakPoint } from '../types';
import type { DifficultyConfig } from './difficulty';

const M = (d: BossMoveDef): BossMoveDef => d;

export const BOSS_MOVES: BossMoveDef[] = [
  M({
    id: 'four_arm_combo',
    name: '四臂连击',
    warning: '四臂连击',
    defenseHint: '四段递进 —— 最后一段最重',
    target: 'single',
    impactTimes: [0.98, 1.54, 2.32, 2.68],
    power: 1300,
    hitWeights: [0.18, 0.2, 0.25, 0.37],
    elements: ['physical', 'fire', 'dark', 'physical'],
    jumpHits: [],
    phases: [1, 2, 3],
    actionDelay: 1.0,
    tail: 0.9,
    desc: '四条手臂依次挥落，最后一段命中会施加破绽。',
  }),
  M({
    id: 'swift_thrust',
    name: '迅敏突刺',
    warning: '动作迅敏',
    defenseHint: '三段急促 —— 前两段间隔极短',
    target: 'single',
    impactTimes: [0.72, 0.98, 1.62],
    power: 1050,
    hitWeights: [0.25, 0.25, 0.5],
    elements: ['physical', 'physical', 'dark'],
    jumpHits: [],
    phases: [1, 2, 3],
    actionDelay: 0.95,
    tail: 0.8,
    desc: '极快的三段突刺。任一段未完美格挡会让 Boss 恢复 10 点破防值。',
  }),
  M({
    id: 'sweeping_slash',
    name: '全体斩击',
    warning: '全体斩击',
    defenseHint: '金 / 紫 / 灰三波扫过全队',
    target: 'all',
    impactTimes: [1.25, 2.05, 2.84],
    power: 1450,
    hitWeights: [0.3, 0.3, 0.4],
    elements: ['fire', 'dark', 'physical'],
    jumpHits: [],
    phases: [1, 2, 3],
    actionDelay: 1.0,
    tail: 0.9,
    desc: '三波剑气横扫全队。金色波未完美施加着火，紫色波有 35% 施加迟缓。',
  }),
  M({
    id: 'inverted_array',
    name: '倒逆剑阵',
    warning: '倒逆剑阵',
    defenseHint: '单段大范围 —— 完美格挡可完全免疫倒逆',
    target: 'all',
    impactTimes: [1.75],
    power: 260,
    hitWeights: [1],
    elements: ['dark'],
    jumpHits: [],
    phases: [2, 3],
    actionDelay: 1.0,
    tail: 1.0,
    desc: '低伤害但会施加倒逆：治疗将转为伤害。完美格挡完全免疫。',
  }),
  M({
    id: 'blade_charge',
    name: '刀锋蓄势',
    warning: '刀锋蓄势',
    defenseHint: '无攻击 —— Boss 正在强化',
    target: 'self',
    impactTimes: [1.1],
    power: 0,
    hitWeights: [1],
    elements: ['light'],
    jumpHits: [],
    phases: [2, 3],
    actionDelay: 0.9,
    tail: 0.6,
    desc: 'Boss 获得 3 层护盾与强力 2 回合，下一次行动更偏向单体连击。',
  }),
  M({
    id: 'twin_execution',
    name: '双刃处刑',
    warning: '双刃处刑',
    defenseHint: '两段处刑 —— 瞄准最脆弱的人',
    target: 'lowest',
    impactTimes: [0.9, 1.86],
    power: 1550,
    hitWeights: [0.35, 0.65],
    elements: ['light', 'dark'],
    jumpHits: [],
    phases: [3],
    actionDelay: 1.05,
    tail: 0.9,
    desc: '对生命最低者的两段处刑。第二段未完美且目标低于 30% 生命时额外施加 2 层着火。',
  }),
  M({
    id: 'blood_storm',
    name: '腥风血雨',
    warning: '腥风血雨',
    defenseHint: '七段混合 —— 第 3 / 6 段为地面横扫，同样按空格跳跃',
    target: 'all',
    impactTimes: [1.08, 1.56, 1.96, 2.75, 3.06, 3.48, 4.32],
    power: 2400,
    hitWeights: [0.1, 0.1, 0.12, 0.14, 0.14, 0.16, 0.24],
    elements: ['fire', 'dark', 'physical', 'fire', 'dark', 'physical', 'light'],
    jumpHits: [2, 5],
    phases: [3],
    actionDelay: 1.25,
    tail: 1.2,
    desc: '终结技。任一段 Miss 会让下一段速度 +8%；全 Perfect 时队伍反击伤害额外 x1.5。',
  }),
];

export const BOSS_MOVE_BY_ID: Record<string, BossMoveDef> = Object.fromEntries(
  BOSS_MOVES.map((m) => [m.id, m]),
);

/** 四手剑客元素表 */
export const BOSS_ELEMENT_MODS: Record<ElementId, number> = {
  physical: 1.0,
  fire: 0.85,
  ice: 1.25,
  lightning: 1.0,
  earth: 0.9,
  light: 1.1,
  dark: 0.8,
};

export const BOSS_PHASE_THRESHOLDS = [0.68, 0.32];

export function createBoss(cfg: DifficultyConfig): ActorState {
  const weakPoints: WeakPoint[] = [
    {
      id: 'gold_core',
      name: '金剑核心',
      durability: cfg.weakDurability,
      maxDurability: cfg.weakDurability,
      broken: false,
      anchor: [1.15, 2.35, 0.35],
      color: '#ffcf6b',
    },
    {
      id: 'violet_core',
      name: '紫剑核心',
      durability: cfg.weakDurability,
      maxDurability: cfg.weakDurability,
      broken: false,
      anchor: [-1.15, 2.35, 0.35],
      color: '#b483ff',
    },
  ];
  return {
    id: 'boss',
    name: '四手剑客',
    kind: 'boss',
    role: '苍白之城的守卫',
    hp: cfg.bossHp,
    maxHp: cfg.bossHp,
    ap: 0,
    maxAp: 0,
    attack: 210,
    defense: 135,
    speed: 100 * cfg.bossSpeedMul,
    critRate: 0.05,
    critResist: 0.2,
    shield: 0,
    maxShield: 5,
    alive: true,
    statuses: [],
    nextActAt: 0,
    seq: 10,
    weaponElement: 'dark',
    elementMods: { ...BOSS_ELEMENT_MODS },
    foretell: {},
    phaseTag: 'sun',
    twilightTurns: 0,
    alternations: 0,
    lastTagUsed: null,
    stains: [],
    maxStains: 0,
    stance: 'none',
    breakGauge: 0,
    breakMax: 100,
    broken: false,
    brokenSkipPending: false,
    weakPoints,
    fateUsedInChain: false,
    extraTurnUsedInRound: false,
    portrait: '四',
    color: '#e8dccb',
  };
}

/** 按难度产生招式的实际时间轴（专家难度有节奏变体 / 假动作 / 追加段） */
export interface MoveTimeline {
  move: BossMoveDef;
  impactTimes: number[];
  hitWeights: number[];
  elements: ElementId[];
  jumpHits: number[];
  feintAt: number | null;
  variantName: string | null;
  tail: number;
}

export function buildMoveTimeline(
  move: BossMoveDef,
  cfg: DifficultyConfig,
  roll: number,
): MoveTimeline {
  let impactTimes = [...move.impactTimes];
  let hitWeights = [...move.hitWeights];
  let elements = [...move.elements];
  let jumpHits = [...move.jumpHits];
  let feintAt: number | null = null;
  let variantName: string | null = null;

  if (move.id === 'blood_storm') {
    if (cfg.bloodStormHits === 5) {
      impactTimes = [1.08, 1.62, 2.1, 2.9, 3.4];
      hitWeights = [0.16, 0.18, 0.2, 0.2, 0.26];
      elements = ['fire', 'dark', 'physical', 'dark', 'light'];
      jumpHits = [2];
      variantName = '简化五段';
    } else if (cfg.bloodStormHits === 9) {
      impactTimes = [...impactTimes, 4.68, 5.1];
      hitWeights = [0.08, 0.08, 0.1, 0.11, 0.11, 0.12, 0.16, 0.1, 0.14];
      elements = [...elements, 'dark', 'fire'];
      jumpHits = [2, 5, 7];
      variantName = '九段变体';
    }
  }

  if (cfg.rhythmVariants && move.id === 'four_arm_combo' && roll > 0.5) {
    impactTimes = [0.88, 1.24, 2.08, 2.34, 2.7];
    hitWeights = [0.14, 0.16, 0.2, 0.22, 0.28];
    elements = ['physical', 'fire', 'dark', 'physical', 'dark'];
    variantName = '五段疾风节奏';
  }

  if (cfg.rhythmVariants && move.id === 'sweeping_slash' && roll > 0.55) {
    impactTimes = [impactTimes[0], impactTimes[1], impactTimes[2] + 0.22];
    variantName = '第三波延迟';
  }

  if (cfg.feints && move.id === 'swift_thrust' && roll > 0.45) {
    feintAt = Math.max(0.2, impactTimes[0] - 0.34);
    variantName = '带假动作';
  }

  return { move, impactTimes, hitWeights, elements, jumpHits, feintAt, variantName, tail: move.tail };
}
