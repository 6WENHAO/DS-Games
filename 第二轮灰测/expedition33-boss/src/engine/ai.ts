import type { ActorState, BattleState, BossMoveDef } from './types';
import { BOSS_MOVES } from './data/boss';
import type { Rng } from './rng';
import { hasStatus } from './formula';

/** 教学序列：第一局前三次 Boss 行动固定，确保格挡由慢到快 */
export const TUTORIAL_MOVES = ['four_arm_combo', 'sweeping_slash', 'swift_thrust'];

export interface MoveChoice {
  move: BossMoveDef;
  reason: string;
}

function movesForPhase(phase: number): BossMoveDef[] {
  return BOSS_MOVES.filter((m) => m.phases.includes(phase));
}

export function chooseBossMove(state: BattleState, rng: Rng): MoveChoice {
  const boss = state.actors[state.bossId];
  const alive = state.partyOrder.map((id) => state.actors[id]).filter((a) => a.alive);

  if (state.forcedBossMove) {
    const forced = BOSS_MOVES.find((m) => m.id === state.forcedBossMove);
    if (forced) return { move: forced, reason: '阶段强制' };
  }
  if (state.phase === 1 && state.tutorialIndex < TUTORIAL_MOVES.length) {
    const id = TUTORIAL_MOVES[state.tutorialIndex];
    const m = BOSS_MOVES.find((x) => x.id === id);
    if (m) return { move: m, reason: '教学节奏' };
  }

  const pool = movesForPhase(state.phase);
  const maxAp = Math.max(0, ...alive.map((a) => a.ap));
  const anyVirtuose = alive.some((a) => a.stance === 'virtuose');
  const typhoonUp = alive.some((a) => hasStatus(a, 'typhoon'));
  const anyInverted = alive.some((a) => hasStatus(a, 'inverted'));
  const hpRatio = boss.hp / boss.maxHp;
  const last = state.bossHistory[state.bossHistory.length - 1];
  const bloodStormReady = state.bossActionCount - state.lastBloodStormAt >= 4;

  const entries = pool.map((move) => {
    let w = 1;
    let reason = '常规';
    switch (move.id) {
      case 'four_arm_combo':
        w = 3;
        if (anyVirtuose) { w += 2.5; reason = '压制高手姿态'; }
        break;
      case 'swift_thrust':
        w = 2.4;
        if (maxAp >= 7) { w += 1.6; reason = '打断高 AP 角色'; }
        break;
      case 'sweeping_slash':
        w = 2.6;
        if (alive.length === 3) w += 0.8;
        break;
      case 'inverted_array':
        w = 1.6;
        if (typhoonUp) { w += 3.2; reason = '台风将反噬远征队'; }
        if (!anyInverted && maxAp >= 6) { w += 1.2; reason = '压制治疗节奏'; }
        if (anyInverted) w -= 1.2;
        break;
      case 'blade_charge':
        w = 1.2;
        if (boss.shield === 0 && hpRatio < 0.6) { w += 1.8; reason = '重整刀锋'; }
        if (boss.broken) w += 1.5;
        break;
      case 'twin_execution': {
        w = 2.2;
        const weakest = alive.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (weakest && weakest.hp / weakest.maxHp < 0.45) { w += 2.6; reason = '处刑濒死者'; }
        break;
      }
      case 'blood_storm':
        w = bloodStormReady ? 2.0 : 0;
        reason = '终结技';
        break;
      default:
        w = 1;
    }
    if (move.id === last) w *= 0.35;
    return { item: { move, reason }, weight: Math.max(0, w) };
  });

  const picked = rng.weighted(entries);
  return picked;
}

/** 目标选择：高 AP / 高手姿态优先，但至少保留 35% 随机性 */
export function chooseBossTarget(
  state: BattleState,
  move: BossMoveDef,
  rng: Rng,
): ActorState[] {
  const alive = state.partyOrder.map((id) => state.actors[id]).filter((a) => a.alive);
  if (alive.length === 0) return [];
  if (move.target === 'all') return alive;
  if (move.target === 'self') return [state.actors[state.bossId]];
  if (move.target === 'lowest') {
    return [alive.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]];
  }
  // single
  let candidates = alive;
  if (alive.length > 1 && state.lastSingleTargetId) {
    const filtered = alive.filter((a) => a.id !== state.lastSingleTargetId);
    if (filtered.length > 0) candidates = filtered;
  }
  const roll = rng.next();
  if (roll < 0.4) {
    const byAp = candidates.slice().sort((a, b) => b.ap - a.ap);
    return [byAp[0]];
  }
  if (roll < 0.65) {
    const virt = candidates.find((a) => a.stance === 'virtuose');
    if (virt) return [virt];
  }
  return [rng.pick(candidates)];
}

/** 专家难度：阶段二起每 3 次行动安排一次额外行动 */
export function shouldScheduleExtra(state: BattleState, mode: string, rng: Rng): boolean {
  if (mode === 'none') return false;
  if (mode === 'phase2rule') {
    return state.phase >= 2 && state.bossActionCount > 0 && state.bossActionCount % 3 === 0;
  }
  if (mode === 'phase3rare') {
    return state.phase >= 3 && rng.chance(0.22);
  }
  return false;
}
