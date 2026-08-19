import type {
  ActorState, BattleState, ElementId, Grade, StainId, StanceId, StatusId, ActionInstance,
} from './types';
import type { DifficultyConfig } from './data/difficulty';
import type { Rng } from './rng';

/**
 * 技能钩子可以调用的受限运行时。由 BattleEngine 实现，使技能数据与引擎实现解耦。
 */
export interface SkillRuntime {
  state: BattleState;
  actor: ActorState;
  targets: ActorState[];
  primaryTarget: ActorState | null;
  action: ActionInstance;
  rng: Rng;
  difficulty: DifficultyConfig;
  log(text: string, tone?: string): void;
  addAp(actorId: string, delta: number, reason: string): void;
  applyStatus(targetId: string, id: StatusId, stacks: number, turns: number, applierId?: string): void;
  removeStatus(targetId: string, id: StatusId): boolean;
  hasStatus(actorId: string, id: StatusId): boolean;
  statusStacks(actorId: string, id: StatusId): number;
  addShield(targetId: string, layers: number): void;
  healActor(targetId: string, amount: number, sourceId: string): void;
  addBreak(amount: number): void;
  addForetell(targetId: string, layers: number): void;
  foretellOn(targetId: string): number;
  consumeForetell(targetId: string, max: number): number;
  addStain(stain: StainId): void;
  consumeStain(stain: StainId): boolean;
  setStance(stance: StanceId): void;
  insertAtQueueHead(targetId: string): boolean;
  grantExtraTurn(actorId: string): boolean;
  reviveActor(targetId: string, ratio: number): boolean;
  /** 追加一段命中（相对上一段的间隔秒数与权重） */
  extendHit(spacingSec: number, weight: number, element?: ElementId): void;
  /** 取消尚未结算的第 index 段（0 基） */
  cancelHit(index: number): void;
  spreadBuffs(fromId: string): void;
  allies(): ActorState[];
  enemies(): ActorState[];
}

export interface SkillPlan {
  hitCount?: number;
  elements?: ElementId[];
  powerMul?: number;
}

export interface SkillHooks {
  plan?: (rt: SkillRuntime) => SkillPlan | void;
  onStart?: (rt: SkillRuntime) => void;
  onPrompt?: (rt: SkillRuntime, index: number, grade: Grade) => void;
  onHit?: (rt: SkillRuntime, index: number, dealt: number, absorbed: boolean) => void;
  onEnd?: (rt: SkillRuntime) => void;
}
