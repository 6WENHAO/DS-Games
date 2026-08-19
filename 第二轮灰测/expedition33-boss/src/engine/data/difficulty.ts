import type { DifficultyId } from '../types';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  subtitle: string;
  blurb: string[];
  bossHp: number;
  bossDamageMul: number;
  bossSpeedMul: number;
  /** 技能连协：Perfect / Good 窗口（ms） */
  skillPerfect: number;
  skillGood: number;
  /** 格挡：Perfect 内窗 / 普通格挡外窗（ms） */
  blockPerfect: number;
  blockOuter: number;
  /** 提示环提前显示时间（ms） */
  telegraphLead: number;
  invertedTurns: number;
  /** 治疗前二次确认（倒逆时） */
  invertedConfirm: boolean;
  bloodStormHits: number;
  bossExtra: 'none' | 'phase3rare' | 'phase2rule';
  weakDurability: number;
  rhythmVariants: boolean;
  feints: boolean;
  invertedFromHalfHp: boolean;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  expedition: {
    id: 'expedition',
    name: '远征',
    subtitle: 'EXPEDITION',
    blurb: ['判定窗口宽松，提示提前 450ms', '腥风血雨为 5 段简化版', '倒逆仅 2 回合，治疗有二次确认'],
    bossHp: 70000,
    bossDamageMul: 0.7,
    bossSpeedMul: 0.9,
    skillPerfect: 110,
    skillGood: 260,
    blockPerfect: 100,
    blockOuter: 260,
    telegraphLead: 450,
    invertedTurns: 2,
    invertedConfirm: true,
    bloodStormHits: 5,
    bossExtra: 'none',
    weakDurability: 1,
    rhythmVariants: false,
    feints: false,
    invertedFromHalfHp: false,
  },
  standard: {
    id: 'standard',
    name: '标准',
    subtitle: 'STANDARD',
    blurb: ['原作节奏，提示提前 320ms', '腥风血雨 7 段', '阶段三有低概率额外行动'],
    bossHp: 96000,
    bossDamageMul: 1.0,
    bossSpeedMul: 1.0,
    skillPerfect: 80,
    skillGood: 180,
    blockPerfect: 70,
    blockOuter: 160,
    telegraphLead: 320,
    invertedTurns: 3,
    invertedConfirm: false,
    bloodStormHits: 7,
    bossExtra: 'phase3rare',
    weakDurability: 2,
    rhythmVariants: false,
    feints: false,
    invertedFromHalfHp: false,
  },
  expert: {
    id: 'expert',
    name: '专家',
    subtitle: 'EXPERT',
    blurb: ['窗口极窄，提示提前 220ms', '招式有节奏变体与假动作', '阶段二起 Boss 会插入额外行动'],
    bossHp: 130000,
    bossDamageMul: 1.25,
    bossSpeedMul: 1.12,
    skillPerfect: 50,
    skillGood: 120,
    blockPerfect: 45,
    blockOuter: 105,
    telegraphLead: 220,
    invertedTurns: 3,
    invertedConfirm: false,
    bloodStormHits: 9,
    bossExtra: 'phase2rule',
    weakDurability: 3,
    rhythmVariants: true,
    feints: true,
    invertedFromHalfHp: true,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['expedition', 'standard', 'expert'];
