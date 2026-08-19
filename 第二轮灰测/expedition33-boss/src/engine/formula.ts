import type { ActorState, BlockGrade, ElementId, Grade } from './types';
import type { DifficultyConfig } from './data/difficulty';

export const DAMAGE_DISPLAY_CAP = 9999;

export function hasStatus(actor: ActorState, id: string): boolean {
  return actor.statuses.some((s) => s.id === id && (s.stacks > 0 || s.turns > 0));
}

export function statusStacks(actor: ActorState, id: string): number {
  const s = actor.statuses.find((x) => x.id === id);
  return s ? s.stacks : 0;
}

/** 攻方增益乘区：强力 x1.25，虚弱 x0.75 */
export function attackerBuffMultiplier(actor: ActorState): number {
  let m = 1;
  if (hasStatus(actor, 'strong')) m *= 1.25;
  if (hasStatus(actor, 'weak')) m *= 0.75;
  return m;
}

/** 受方承伤乘区：坚壳 x0.80，破防 x1.25，玛埃尔姿态 */
export function targetTakenMultiplier(actor: ActorState): number {
  let m = 1;
  if (hasStatus(actor, 'sturdy')) m *= 0.8;
  if (actor.broken) m *= 1.25;
  if (actor.stance === 'offensive') m *= 1.35;
  if (actor.stance === 'defensive') m *= 0.5;
  return m;
}

/** 攻方姿态乘区（玛埃尔） */
export function stanceMultiplier(actor: ActorState): number {
  if (actor.stance === 'offensive') return 1.5;
  if (actor.stance === 'virtuose') return 3.0;
  return 1;
}

/** 熙艾尔薄暮：伤害 +75% */
export function twilightMultiplier(actor: ActorState): number {
  return actor.phaseTag === 'twilight' ? 1.75 : 1;
}

export function effectiveDefense(actor: ActorState): number {
  let d = actor.defense;
  if (hasStatus(actor, 'vulnerable')) d *= 0.75;
  if (hasStatus(actor, 'defenseUp')) d *= 1.25;
  return d;
}

export function effectiveSpeed(actor: ActorState): number {
  let s = actor.speed;
  if (hasStatus(actor, 'swift')) s *= 1.2;
  if (hasStatus(actor, 'slow')) s *= 0.8;
  return Math.max(1, s);
}

export function elementMultiplier(target: ActorState, element: ElementId): number {
  const m = target.elementMods[element];
  return m === undefined ? 1 : m;
}

export function qteMultiplier(grade: Grade | null): number {
  if (grade === 'perfect') return 1.25;
  if (grade === 'good') return 1.0;
  if (grade === 'miss') return 0.65;
  return 1.0;
}

export interface DamageContext {
  attacker: ActorState;
  target: ActorState;
  power: number;
  hitWeight: number;
  element: ElementId;
  qteMul: number;
  powerMul: number;
  crit: boolean;
  critMultiplier: number;
  markConsumed: boolean;
  variance: number;
  defenseModifier: number;
  /** 招式 / 难度级别的额外倍率（Boss 伤害倍率等） */
  extraMul: number;
}

export interface DamageResult {
  damage: number;
  uncapped: number;
  capped: boolean;
  base: number;
  mitigation: number;
  factors: {
    stance: number;
    buff: number;
    element: number;
    mark: number;
    qte: number;
    crit: number;
    variance: number;
    twilight: number;
    extra: number;
  };
  weakness: boolean;
  resist: boolean;
  immune: boolean;
  absorb: boolean;
}

export function computeDamage(ctx: DamageContext): DamageResult {
  const base = ctx.power * (ctx.attacker.attack / 160) * ctx.hitWeight * ctx.powerMul;
  const def = Math.max(0, effectiveDefense(ctx.target) * ctx.defenseModifier);
  const mitigation = 100 / (100 + def);
  const stance = stanceMultiplier(ctx.attacker);
  const buff = attackerBuffMultiplier(ctx.attacker) * targetTakenMultiplier(ctx.target);
  const element = elementMultiplier(ctx.target, ctx.element);
  const mark = ctx.markConsumed ? 1.5 : 1;
  const qte = ctx.qteMul;
  const crit = ctx.crit ? ctx.critMultiplier : 1;
  const twilight = twilightMultiplier(ctx.attacker);
  const raw = base * mitigation * stance * buff * element * mark * qte * crit * ctx.variance * twilight * ctx.extraMul;
  const uncapped = Math.floor(raw);
  const sign = uncapped < 0 ? -1 : 1;
  const capped = Math.abs(uncapped) > DAMAGE_DISPLAY_CAP;
  const damage = capped ? sign * DAMAGE_DISPLAY_CAP : uncapped;
  return {
    damage,
    uncapped,
    capped,
    base,
    mitigation,
    factors: { stance, buff, element, mark, qte, crit, variance: ctx.variance, twilight, extra: ctx.extraMul },
    weakness: element > 1,
    resist: element < 1 && element > 0,
    immune: element === 0,
    absorb: element < 0,
  };
}

export function critChance(attacker: ActorState, target: ActorState): number {
  return Math.max(0, attacker.critRate - target.critResist);
}

// ---------------------------------------------------------------- 判定窗口

export function judgeSkillPrompt(deltaMs: number, cfg: DifficultyConfig): Grade {
  const d = Math.abs(deltaMs);
  if (d <= cfg.skillPerfect) return 'perfect';
  if (d <= cfg.skillGood) return 'good';
  return 'miss';
}

export type BlockJudgement = 'perfect' | 'block' | 'outside';

export function judgeBlock(deltaMs: number, cfg: DifficultyConfig): BlockJudgement {
  const d = Math.abs(deltaMs);
  if (d <= cfg.blockPerfect) return 'perfect';
  if (d <= cfg.blockOuter) return 'block';
  return 'outside';
}

/** 早按输入缓冲上限（ms）：可以合法绑定到最近且尚未结算的一段 */
export const EARLY_BUFFER_MS = 60;
/** 乱按惩罚冷却（ms） */
export const SPAM_COOLDOWN_MS = 250;
/** 完美格挡后命中停顿 */
export const PERFECT_HITSTOP_MS = 120;
/** 反击窗口长度 */
export const COUNTER_WINDOW_MS = 650;

export function blockDamageMultiplier(grade: BlockGrade): number {
  if (grade === 'perfect') return 0;
  if (grade === 'block') return 0.3;
  return 1;
}

export function queueDelta(actor: ActorState, actionDelay: number): number {
  return (1000 / effectiveSpeed(actor)) * actionDelay;
}
