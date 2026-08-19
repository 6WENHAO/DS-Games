import type {
  ActionInstance, ActorState, BattleState, BlockGrade, DifficultyId, ElementId, EngineEvent,
  EngineEventMap, FsmState, Grade, LogRecord, QueueEntry, StainId, StanceId, StatusId, TimelineEvent,
} from './types';
import { DIFFICULTIES, type DifficultyConfig } from './data/difficulty';
import { CHARACTER_SEEDS, createActorFromSeed, ITEM_DEFS } from './data/characters';
import { BASIC_ATTACK, SKILL_BY_ID, SKILL_HOOKS, effectiveApCost, skillsOf } from './data/skills';
import { BOSS_MOVE_BY_ID, buildMoveTimeline, createBoss, type MoveTimeline } from './data/boss';
import { STATUS_DEFS } from './data/statuses';
import { chooseBossMove, chooseBossTarget, shouldScheduleExtra, TUTORIAL_MOVES } from './ai';
import { Rng } from './rng';
import type { SkillPlan, SkillRuntime } from './skillRuntime';
import {
  COUNTER_WINDOW_MS, EARLY_BUFFER_MS, PERFECT_HITSTOP_MS, SPAM_COOLDOWN_MS,
  blockDamageMultiplier, computeDamage, critChance, effectiveSpeed, hasStatus, judgeBlock,
  judgeSkillPrompt, qteMultiplier, queueDelta, statusStacks,
} from './formula';

export interface EngineOptions {
  difficulty: DifficultyId;
  seed?: number;
}

export interface InputRecord {
  t: number;
  kind: string;
  data?: Record<string, unknown>;
}

export interface BattleLogFile {
  version: number;
  difficulty: DifficultyId;
  seed: number;
  inputs: InputRecord[];
  records: LogRecord[];
  result?: { outcome: string; stats: unknown };
}

const INTRO_MS = 2000;
const PHASE_TRANSITION_MS = 1850;
const DEATH_FEEDBACK_MS = 800;
const ACTION_TAIL_MS = 700;
const COUNTER_STEP_MS = 460;
const COUNTER_POWER = 1000;
const TORSO_POWER = 260;
const TYPHOON_POWER = 1400;

export class BattleEngine {
  readonly cfg: DifficultyConfig;
  readonly rng: Rng;
  state: BattleState;
  private out: EngineEvent[] = [];
  private records: LogRecord[] = [];
  private inputs: InputRecord[] = [];
  private idSeq = 0;
  private pressSeq = 0;
  private currentEntryIsExtra = false;
  private pendingBossTurnEnd = false;
  private currentMoveTimeline: MoveTimeline | null = null;
  private disposed = false;

  constructor(opts: EngineOptions) {
    this.cfg = DIFFICULTIES[opts.difficulty];
    const seed = opts.seed === undefined ? (Math.floor(Math.random() * 0xffffffff) >>> 0) : (opts.seed >>> 0);
    this.rng = new Rng(seed);
    this.state = this.createState(opts.difficulty, seed);
  }

  // ------------------------------------------------------------------ 初始化

  private createState(difficulty: DifficultyId, seed: number): BattleState {
    const actors: Record<string, ActorState> = {};
    const partyOrder: string[] = [];
    CHARACTER_SEEDS.forEach((s, i) => {
      const a = createActorFromSeed(s, i);
      a.nextActAt = 1000 / a.speed;
      actors[a.id] = a;
      partyOrder.push(a.id);
    });
    const boss = createBoss(this.cfg);
    boss.nextActAt = 1000 / boss.speed;
    actors[boss.id] = boss;
    return {
      fsm: 'BOOT',
      difficulty,
      seed,
      now: 0,
      paused: false,
      actors,
      partyOrder,
      bossId: boss.id,
      phase: 1,
      pendingPhase: null,
      inventory: { heal: 2, energy: 2, revive: 1 },
      stats: {
        startedAt: 0, elapsedMs: 0, totalDamage: 0, maxHit: 0, damageTaken: 0,
        perfectBlocks: 0, normalBlocks: 0, missedBlocks: 0, dodges: 0, fullCounters: 0,
        promptPerfect: 0, promptGood: 0, promptMiss: 0, bestBlockChain: 0, turns: 0,
        weakPointsBroken: 0, healing: 0,
      },
      currentActorId: null,
      action: null,
      pending: null,
      blockChain: 0,
      chainDefensibleCount: 0,
      chainPerfectCount: 0,
      chainResolvedCount: 0,
      apFromBlocksThisChain: {},
      defensiveApThisChain: {},
      counterArmed: false,
      counterWindow: null,
      counterResolved: false,
      spamCooldownUntil: -1,
      activePrompt: null,
      activeDefense: null,
      bossHistory: [],
      bossActionCount: 0,
      bossMoveName: null,
      bossMoveVariant: null,
      bossMoveHint: null,
      extraEntries: [],
      forcedBossMove: null,
      lastBloodStormAt: -99,
      lastSingleTargetId: null,
      typhoonSourceId: null,
      outcome: 'none',
      pendingVictoryAt: null,
      pendingDefeatAt: null,
      phaseTransitionEndsAt: null,
      introEndsAt: null,
      roundCounter: 1,
      aimShotsFired: 0,
      tutorialIndex: 0,
      lastPressId: 0,
      lastPromptDelta: null,
      lastDefenseDelta: null,
      message: null,
      seqCounter: 100,
      queueNow: 0,
      invertedReduction: 0,
      counterBonusMul: 1,
    };
  }

  start(): void {
    this.state.fsm = 'INTRO';
    this.state.introEndsAt = this.state.now + INTRO_MS;
    this.state.stats.startedAt = this.state.now;
    this.emit('stateChange', { from: 'BOOT', to: 'INTRO' });
    this.emit('log', { text: '远征队与四手剑客对峙 —— 空格键即是生死线', tone: 'intro' });
    this.emit('queueChange', { entries: this.previewQueue(8) });
  }

  dispose(): void {
    this.disposed = true;
    this.out = [];
    if (this.state.action) this.state.action.cancelled = true;
    this.state.action = null;
    this.state.counterWindow = null;
    this.state.activePrompt = null;
    this.state.activeDefense = null;
  }

  // ------------------------------------------------------------------ 事件

  private emit<K extends keyof EngineEventMap>(type: K, payload: EngineEventMap[K]): void {
    if (this.disposed) return;
    this.out.push({ type, payload, at: this.state.now } as EngineEvent);
    this.records.push({ t: Math.round(this.state.now), kind: type, data: payload as unknown as Record<string, unknown> });
    if (this.records.length > 6000) this.records.splice(0, 2000);
  }

  drain(): EngineEvent[] {
    const e = this.out;
    this.out = [];
    return e;
  }

  private setFsm(to: FsmState): void {
    if (this.state.fsm === to) return;
    const from = this.state.fsm;
    this.state.fsm = to;
    this.emit('stateChange', { from, to });
  }

  private nextId(prefix: string): string {
    this.idSeq += 1;
    return prefix + '_' + this.idSeq;
  }

  private recordInput(kind: string, data?: Record<string, unknown>): void {
    this.inputs.push({ t: this.state.now, kind, data });
  }

  // ------------------------------------------------------------------ 时钟

  /**
   * 推进模拟时钟。事件总是在"预定时刻"被结算（now 会先被拉到该时刻），
   * 因此 16ms 与 500ms 的步长会得到完全一致的结果 —— 这是重放与测试可复现的基础。
   */
  advance(dtMs: number): void {
    if (this.state.paused || this.disposed) return;
    const dt = Math.max(0, Math.min(dtMs, 500));
    const target = this.state.now + dt;
    let guard = 0;
    while (guard++ < 4000) {
      const item = this.earliestDue(target);
      if (!item) break;
      if (item.at > this.state.now) this.state.now = item.at;
      this.announceWindows();
      item.run();
    }
    if (target > this.state.now) this.state.now = target;
    this.announceWindows();
    if (this.state.outcome === 'none') {
      this.checkOutcomes();
      this.state.stats.elapsedMs = this.state.now - this.state.stats.startedAt;
    }
  }

  /** 推进到绝对模拟时间 t（内部按 500ms 上限分片，保证不被单次 clamp 截断） */
  advanceTo(t: number): void {
    let guard = 0;
    while (this.state.now < t && guard++ < 20000) {
      const dt = Math.min(500, t - this.state.now);
      const before = this.state.now;
      this.advance(dt);
      if (this.state.now <= before) break;
    }
  }

  setPaused(p: boolean): void {
    this.state.paused = p;
  }

  /** 立刻把所有已到期的事件跑完（按键结算后调用） */
  private pump(): void {
    let guard = 0;
    while (guard++ < 4000) {
      const item = this.earliestDue(this.state.now);
      if (!item) break;
      this.announceWindows();
      item.run();
    }
    this.announceWindows();
  }

  /**
   * 取出"预定时刻 <= limit"的最早一件到期事情。按 (时刻, 优先级) 排序，
   * 保证顺序与随机数消耗顺序与步长无关。
   */
  private earliestDue(limit: number): { at: number; prio: number; run: () => void } | null {
    const st = this.state;
    if (st.outcome !== 'none') return null;

    type Due = { at: number; prio: number; run: () => void };
    const dues: Due[] = [];
    if (st.pendingVictoryAt !== null && limit >= st.pendingVictoryAt) {
      dues.push({ at: st.pendingVictoryAt, prio: 0, run: () => this.finishVictory() });
    }
    if (st.pendingDefeatAt !== null && limit >= st.pendingDefeatAt) {
      dues.push({ at: st.pendingDefeatAt, prio: 0, run: () => this.finishDefeat() });
    }
    if (st.fsm === 'INTRO' && st.introEndsAt !== null && limit >= st.introEndsAt) {
      dues.push({
        at: st.introEndsAt, prio: 2,
        run: () => { st.introEndsAt = null; this.beginNextTurn(); },
      });
    }
    if (st.fsm === 'PHASE_TRANSITION' && st.phaseTransitionEndsAt !== null && limit >= st.phaseTransitionEndsAt) {
      dues.push({
        at: st.phaseTransitionEndsAt, prio: 2,
        run: () => { st.phaseTransitionEndsAt = null; this.beginNextTurn(); },
      });
    }
    if (st.counterWindow && !st.counterResolved && limit > st.counterWindow.closesAt) {
      const w = st.counterWindow;
      dues.push({
        at: w.closesAt, prio: 3,
        run: () => {
          st.counterResolved = true;
          st.counterArmed = false;
          this.emit('log', { text: '反击窗口错过 —— 队伍收剑', tone: 'warn' });
          this.finishBossAction();
        },
      });
    }
    const action = st.action;
    if (action && !action.cancelled) {
      const due = this.dueEvent(action, limit);
      if (due) {
        dues.push({
          at: this.eventDueTime(due), prio: 1,
          run: () => this.resolveEvent(action, due),
        });
      }
    }
    if (dues.length === 0) return null;
    dues.sort((a, b) => a.at - b.at || a.prio - b.prio);
    return dues[0];
  }

  private eventDueTime(ev: TimelineEvent): number {
    if (ev.type === 'prompt') return ev.at + this.cfg.skillGood;
    if (ev.type === 'defenseHit' && ev.defensible) {
      // 合法早按缓冲：外窗一开启即以普通格挡结算
      if (ev.bufferedPressAt !== undefined) return ev.at - this.cfg.blockOuter;
      return ev.at + this.cfg.blockOuter;
    }
    return ev.at;
  }

  /** 命中段必须等待它所绑定的连协提示结算，保证 QTE 倍率不会用错 */
  private hitBlockedByPrompt(action: ActionInstance, ev: TimelineEvent): boolean {
    if (ev.type !== 'hit') return false;
    if (ev.promptFor === undefined || ev.promptFor < 0) return false;
    const prompt = action.events.find((p) => p.type === 'prompt' && p.index === ev.promptFor);
    if (!prompt) return false;
    return !prompt.resolved && !prompt.cancelled;
  }

  private dueEvent(action: ActionInstance, limit: number): TimelineEvent | null {
    let best: TimelineEvent | null = null;
    let bestT = Infinity;
    let pendingNonEnd = false;
    for (const ev of action.events) {
      if (ev.resolved || ev.cancelled) continue;
      if (ev.type !== 'end') pendingNonEnd = true;
    }
    for (const ev of action.events) {
      if (ev.resolved || ev.cancelled) continue;
      if (ev.type === 'end' && pendingNonEnd) continue;
      if (this.hitBlockedByPrompt(action, ev)) continue;
      const t = this.eventDueTime(ev);
      if (t <= limit && t < bestT) {
        best = ev;
        bestT = t;
      }
    }
    return best;
  }

  /** 打开 / 关闭判定窗口的 UI 通告（不消费事件） */
  /** 目标全部倒下的段落跳过（只针对该角色的段数），不计入格挡链 */
  private skipDeadTargetHits(action: ActionInstance): void {
    const st = this.state;
    if (action.kind !== 'boss') return;
    let changed = false;
    for (const ev of action.events) {
      if (ev.type !== 'defenseHit' || !ev.defensible || ev.resolved || ev.cancelled) continue;
      const ids = ev.targetIds && ev.targetIds.length ? ev.targetIds : (ev.targetId ? [ev.targetId] : []);
      if (ids.length === 0) continue;
      if (ids.every((id) => !st.actors[id] || !st.actors[id].alive)) {
        ev.cancelled = true;
        st.chainDefensibleCount = Math.max(0, st.chainDefensibleCount - 1);
        changed = true;
        this.emit('log', { text: '目标已倒下 —— 该段攻击落空', tone: 'info' });
      }
    }
    if (changed) {
      this.refreshActionEnd(action);
      const remaining = action.events.filter((e) => e.type === 'defenseHit' && e.defensible && !e.resolved && !e.cancelled);
      if (remaining.length === 0) this.maybeOpenCounter(action);
    }
  }

  private announceWindows(): void {
    const st = this.state;
    const action = st.action;
    st.activePrompt = null;
    st.activeDefense = null;
    if (!action || action.cancelled) return;
    this.skipDeadTargetHits(action);
    const showLead = Math.max(this.cfg.telegraphLead, this.cfg.skillGood);
    const defLead = Math.max(this.cfg.telegraphLead, this.cfg.blockOuter + EARLY_BUFFER_MS);
    const prompts = action.events.filter((e) => e.type === 'prompt');
    const defs = action.events.filter((e) => e.type === 'defenseHit' && e.defensible);
    for (const ev of prompts) {
      if (ev.resolved || ev.cancelled) continue;
      if (st.now >= ev.at - showLead) {
        if (!ev.announced) {
          ev.announced = true;
          this.emit('promptOpen', { eventId: ev.id, at: ev.at, index: ev.index, total: prompts.length, kind: 'skill' });
        }
        if (st.activePrompt === null) {
          st.activePrompt = { eventId: ev.id, at: ev.at, index: ev.index, total: prompts.length, kind: 'skill' };
        }
      }
    }
    for (const ev of defs) {
      if (ev.resolved || ev.cancelled) continue;
      if (st.now >= ev.at - defLead) {
        if (!ev.announced) {
          ev.announced = true;
          if (st.fsm === 'BOSS_TELEGRAPH') this.setFsm('DEFENSE_SEQUENCE');
          this.emit('defenseOpen', {
            eventId: ev.id, at: ev.at, index: ev.index, total: st.chainDefensibleCount,
            targetId: ev.targetId || '', jump: !!ev.jump,
          });
        }
        if (st.activeDefense === null) {
          st.activeDefense = {
            eventId: ev.id, at: ev.at, jump: !!ev.jump, targetId: ev.targetId || '',
            index: ev.index, total: st.chainDefensibleCount,
          };
        }
      }
    }
  }

  // ------------------------------------------------------------------ 队列

  queueEntries(): QueueEntry[] {
    const st = this.state;
    const list: QueueEntry[] = [];
    for (const id of [...st.partyOrder, st.bossId]) {
      const a = st.actors[id];
      if (!a.alive) continue;
      list.push({ actorId: id, at: a.nextActAt, seq: a.seq, kind: 'actor' });
    }
    for (const e of st.extraEntries) {
      if (st.actors[e.actorId] && st.actors[e.actorId].alive) list.push(e);
    }
    list.sort((x, y) => x.at - y.at || x.seq - y.seq);
    return list;
  }

  previewQueue(count = 8): QueueEntry[] {
    const st = this.state;
    const sim = this.queueEntries().map((e) => ({ ...e }));
    const clocks: Record<string, number> = {};
    for (const e of sim) if (e.kind === 'actor') clocks[e.actorId] = e.at;
    const result: QueueEntry[] = [];
    const pool = sim.slice();
    let guard = 0;
    while (result.length < count && guard++ < 60) {
      pool.sort((x, y) => x.at - y.at || x.seq - y.seq);
      const head = pool.shift();
      if (!head) break;
      result.push({ ...head });
      if (head.kind === 'actor') {
        const a = st.actors[head.actorId];
        const delta = queueDelta(a, 1.0);
        pool.push({ actorId: head.actorId, at: head.at + delta, seq: a.seq, kind: 'actor' });
      }
    }
    return result;
  }

  private advanceActorClock(actor: ActorState, actionDelay: number): void {
    actor.nextActAt = Math.max(actor.nextActAt, this.state.queueNow) + queueDelta(actor, actionDelay);
  }

  private beginNextTurn(): void {
    const st = this.state;
    if (st.outcome !== 'none' || st.pendingVictoryAt !== null || st.pendingDefeatAt !== null) return;
    if (st.pendingPhase !== null) {
      this.startPhaseTransition(st.pendingPhase);
      return;
    }
    st.action = null;
    st.pending = null;
    st.counterWindow = null;
    st.counterArmed = false;
    st.counterResolved = false;
    const entries = this.queueEntries();
    if (entries.length === 0) return;
    const head = entries[0];
    st.queueNow = head.at;
    this.currentEntryIsExtra = head.kind === 'extra';
    if (this.currentEntryIsExtra) {
      const idx = st.extraEntries.findIndex((e) => e.actorId === head.actorId && e.at === head.at);
      if (idx >= 0) st.extraEntries.splice(idx, 1);
    }
    st.currentActorId = head.actorId;
    const actor = st.actors[head.actorId];
    st.stats.turns += 1;
    this.setFsm('TURN_START');
    this.emit('turnStart', { actorId: actor.id, isBoss: actor.kind === 'boss' });
    this.emit('queueChange', { entries: this.previewQueue(8) });

    if (actor.kind === 'boss') {
      if (actor.brokenSkipPending) {
        actor.brokenSkipPending = false;
        actor.broken = false;
        actor.breakGauge = 0;
        this.emit('breakChange', { value: 0, broken: false });
        this.emit('log', { text: '四手剑客从破防中恢复 —— 失去这次行动', tone: 'break' });
        this.advanceActorClock(actor, 1.0);
        this.beginNextTurn();
        return;
      }
      this.startBossAction();
      return;
    }
    this.onPlayerTurnStart(actor);
  }

  private onPlayerTurnStart(actor: ActorState): void {
    if (hasStatus(actor, 'typhoon')) this.triggerTyphoon(actor);
    if (this.state.outcome !== 'none' || this.state.pendingVictoryAt !== null || this.state.pendingDefeatAt !== null) return;
    if (!actor.alive) {
      this.endTurn(1.0);
      return;
    }
    this.setFsm('COMMAND');
  }

  private triggerTyphoon(actor: ActorState): void {
    const st = this.state;
    const inst = actor.statuses.find((s) => s.id === 'typhoon');
    if (!inst) return;
    this.emit('log', { text: '台风席卷战场 —— 冰霜伤敌并治疗全队', tone: 'lune' });
    const boss = st.actors[st.bossId];
    if (boss.alive) {
      this.dealDamage({
        attacker: actor, target: boss, power: TYPHOON_POWER, hitWeight: 1, element: 'ice',
        qteMul: 1, powerMul: 1, critMultiplier: 1.5, eventId: this.nextId('typhoon'), index: 0,
        extraMul: 1, allowShield: true, canCrit: true,
      });
    }
    for (const id of st.partyOrder) {
      const a = st.actors[id];
      if (!a.alive) continue;
      this.healActor(a.id, Math.floor(a.maxHp * 0.12), actor.id);
    }
    inst.turns -= 1;
    if (inst.turns <= 0) {
      this.removeStatus(actor.id, 'typhoon');
      st.typhoonSourceId = null;
      this.emit('log', { text: '台风消散', tone: 'info' });
    } else {
      this.emit('statusChange', { targetId: actor.id, statusId: 'typhoon', stacks: 1, turns: inst.turns, removed: false });
    }
    this.checkOutcomes();
  }

  // ------------------------------------------------------------------ 玩家指令

  availableSkills(actorId: string) {
    return skillsOf(actorId);
  }

  chooseCommand(kind: 'attack' | 'skill' | 'aim' | 'item'): boolean {
    const st = this.state;
    if (st.fsm !== 'COMMAND') return false;
    this.recordInput('command', { kind });
    if (kind === 'attack') {
      st.pending = { kind: 'attack' };
      this.setFsm('TARGET_SELECT');
      return true;
    }
    if (kind === 'aim') {
      const actor = st.actors[st.currentActorId!];
      if (actor.ap < 1) return false;
      st.pending = { kind: 'aim' };
      st.aimShotsFired = 0;
      this.setFsm('AIM');
      return true;
    }
    return true;
  }

  chooseSkill(skillId: string): boolean {
    const st = this.state;
    if (st.fsm !== 'COMMAND') return false;
    const actor = st.actors[st.currentActorId!];
    const skill = SKILL_BY_ID[skillId];
    if (!skill || skill.owner !== actor.id) return false;
    if (actor.ap < effectiveApCost(skill, actor)) return false;
    this.recordInput('skill', { skillId });
    st.pending = { kind: 'skill', skillId };
    if (skill.target === 'allyAll' || skill.target === 'field' || skill.target === 'self') {
      this.startPlayerAction();
      return true;
    }
    this.setFsm('TARGET_SELECT');
    return true;
  }

  chooseItem(itemId: string): boolean {
    const st = this.state;
    if (st.fsm !== 'COMMAND') return false;
    const item = ITEM_DEFS.find((i) => i.id === itemId);
    if (!item) return false;
    if ((st.inventory as unknown as Record<string, number>)[itemId] <= 0) return false;
    this.recordInput('item', { itemId });
    st.pending = { kind: 'item', itemId };
    this.setFsm('TARGET_SELECT');
    return true;
  }

  legalTargets(): string[] {
    const st = this.state;
    if (!st.pending) return [];
    const p = st.pending;
    let kind = 'enemy';
    if (p.kind === 'skill' && p.skillId) kind = SKILL_BY_ID[p.skillId].target;
    if (p.kind === 'item' && p.itemId) kind = ITEM_DEFS.find((i) => i.id === p.itemId)!.target;
    if (p.kind === 'attack') kind = 'enemy';
    switch (kind) {
      case 'enemy':
      case 'enemyAll':
        return [st.bossId];
      case 'ally':
        return st.partyOrder.filter((id) => st.actors[id].alive);
      case 'allyAll':
        return st.partyOrder.filter((id) => st.actors[id].alive);
      case 'deadAlly':
        return st.partyOrder.filter((id) => !st.actors[id].alive);
      case 'self':
        return [st.currentActorId!];
      default:
        return [st.bossId];
    }
  }

  chooseTarget(targetId: string): boolean {
    const st = this.state;
    if (st.fsm !== 'TARGET_SELECT' || !st.pending) return false;
    if (!this.legalTargets().includes(targetId)) return false;
    this.recordInput('target', { targetId });
    this.startPlayerAction(targetId);
    return true;
  }

  back(): boolean {
    const st = this.state;
    if (st.fsm === 'TARGET_SELECT') {
      st.pending = null;
      this.setFsm('COMMAND');
      this.recordInput('back');
      return true;
    }
    if (st.fsm === 'AIM') {
      this.exitAim();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ 行动构建

  private makeAction(kind: ActionInstance['kind'], actorId: string, targetIds: string[]): ActionInstance {
    return {
      id: this.nextId('act'),
      actorId,
      kind,
      targetIds,
      startedAt: this.state.now,
      events: [],
      promptResults: [],
      blockResults: [],
      cancelled: false,
      apSpent: 0,
      breakAccrued: 0,
      flags: {},
      consumedStains: [],
      consumedForetell: 0,
      cameraShots: 0,
      endsAt: this.state.now,
      powerMul: 1,
      defensibleTotal: 0,
      perfectChain: true,
    };
  }

  private startPlayerAction(targetId?: string): void {
    const st = this.state;
    const p = st.pending;
    if (!p) return;
    const actor = st.actors[st.currentActorId!];
    st.pending = null;

    if (p.kind === 'item') {
      this.startItemAction(actor, p.itemId!, targetId!);
      return;
    }
    const skill = p.kind === 'attack' ? BASIC_ATTACK : SKILL_BY_ID[p.skillId!];
    const targetIds = this.resolveTargetIds(skill.target, targetId);
    const action = this.makeAction(p.kind === 'attack' ? 'attack' : 'skill', actor.id, targetIds);
    action.skillId = skill.id;
    const cost = effectiveApCost(skill, actor);
    if (actor.ap < cost) {
      this.emit('log', { text: '行动点不足', tone: 'warn' });
      this.setFsm('COMMAND');
      return;
    }
    if (cost > 0) {
      this.addAp(actor.id, -cost, skill.name);
      action.apSpent = cost;
    }
    st.action = action;
    this.applyPhaseTagAlternation(actor, skill.tags);

    const rt = this.runtimeFor(action);
    const hooks = SKILL_HOOKS[skill.id];
    let plan: SkillPlan = {};
    if (hooks && hooks.plan) plan = (hooks.plan(rt) as SkillPlan) || {};
    action.powerMul = plan.powerMul === undefined ? 1 : plan.powerMul;
    if (plan.elements) action.elementsOverride = plan.elements;
    this.scheduleSkillEvents(action, skill, plan);
    this.setFsm('PLAYER_ACTION');
    this.emit('actionStart', { action });
    this.emit('log', { text: actor.name + ' 使用 ' + skill.name, tone: actor.id });
    if (hooks && hooks.onStart) hooks.onStart(rt);
  }

  private startItemAction(actor: ActorState, itemId: string, targetId: string): void {
    const st = this.state;
    const item = ITEM_DEFS.find((i) => i.id === itemId)!;
    const inv = st.inventory as unknown as Record<string, number>;
    if (inv[itemId] <= 0) {
      this.setFsm('COMMAND');
      return;
    }
    inv[itemId] -= 1;
    const action = this.makeAction('item', actor.id, [targetId]);
    action.itemId = itemId;
    action.events.push({ id: this.nextId('ev'), at: st.now + 800, type: 'hit', index: 0, resolved: false, weight: 1 });
    action.endsAt = st.now + 800 + ACTION_TAIL_MS;
    action.events.push({ id: this.nextId('ev'), at: action.endsAt, type: 'end', index: 0, resolved: false });
    st.action = action;
    this.setFsm('PLAYER_ACTION');
    this.emit('actionStart', { action });
    this.emit('log', { text: actor.name + ' 使用 ' + item.name, tone: actor.id });
  }

  private resolveTargetIds(kind: string, targetId?: string): string[] {
    const st = this.state;
    if (kind === 'enemyAll') return [st.bossId];
    if (kind === 'allyAll') return st.partyOrder.filter((id) => st.actors[id].alive);
    if (kind === 'field') return [st.currentActorId!];
    if (kind === 'self') return [st.currentActorId!];
    return targetId ? [targetId] : [st.bossId];
  }

  private resolveElement(skill: { element: string }, actor: ActorState, index: number, action: ActionInstance): ElementId {
    if (skill.element === 'weapon') return actor.weaponElement;
    if (skill.element === 'dynamic') {
      const arr = action.elementsOverride;
      if (arr && arr[index]) return arr[index];
      return actor.weaponElement;
    }
    return skill.element as ElementId;
  }

  private scheduleSkillEvents(action: ActionInstance, skill: typeof BASIC_ATTACK, plan: SkillPlan): void {
    const st = this.state;
    const t0 = action.startedAt;
    const maxHits = Math.min(skill.hitTimes.length, skill.hitWeights.length);
    const hitCount = Math.max(1, Math.min(plan.hitCount === undefined ? maxHits : plan.hitCount, skill.hitTimes.length));
    const actor = st.actors[action.actorId];
    const promptCount = skill.element === 'dynamic' ? Math.min(skill.promptTimes.length, hitCount) : skill.promptTimes.length;
    for (let i = 0; i < hitCount; i++) {
      const weight = action.weightsOverride ? (action.weightsOverride[i] === undefined ? 1 : action.weightsOverride[i]) : skill.hitWeights[Math.min(i, skill.hitWeights.length - 1)];
      const promptFor = skill.promptTimes.length === skill.hitTimes.length ? i : (i < promptCount ? i : -1);
      action.events.push({
        id: this.nextId('ev'), at: t0 + skill.hitTimes[i] * 1000, type: 'hit', index: i,
        resolved: false, weight, element: this.resolveElement(skill, actor, i, action),
        promptFor,
      });
    }
    for (let i = 0; i < promptCount; i++) {
      action.events.push({
        id: this.nextId('ev'), at: t0 + skill.promptTimes[i] * 1000, type: 'prompt', index: i, resolved: false,
      });
    }
    this.refreshActionEnd(action);
  }

  private refreshActionEnd(action: ActionInstance): void {
    let last = action.startedAt;
    for (const ev of action.events) {
      if (ev.type === 'end') continue;
      if (ev.cancelled) continue;
      last = Math.max(last, this.eventDueTime(ev));
    }
    const endAt = last + ACTION_TAIL_MS;
    action.endsAt = endAt;
    const existing = action.events.find((e) => e.type === 'end');
    if (existing) existing.at = endAt;
    else action.events.push({ id: this.nextId('ev'), at: endAt, type: 'end', index: 0, resolved: false });
  }

  // ------------------------------------------------------------------ 事件结算

  private resolveEvent(action: ActionInstance, ev: TimelineEvent): void {
    switch (ev.type) {
      case 'prompt':
        ev.resolved = true;
        this.applyPromptGrade(action, ev, 'miss', this.cfg.skillGood + 1);
        break;
      case 'hit':
        ev.resolved = true;
        this.resolveHitEvent(action, ev);
        break;
      case 'defenseHit':
        ev.resolved = true;
        if (ev.defensible) {
          this.applyBlockGrade(action, ev, 'miss', this.cfg.blockOuter + 1);
        } else {
          this.resolveBossSelfEvent(action, ev);
        }
        break;
      case 'counterHit':
        ev.resolved = true;
        this.resolveCounterHit(action, ev);
        break;
      case 'end':
        ev.resolved = true;
        this.finishAction(action);
        break;
      default:
        ev.resolved = true;
    }
  }

  private lastPromptGrade(action: ActionInstance): Grade | null {
    if (action.promptResults.length === 0) return null;
    return action.promptResults[action.promptResults.length - 1];
  }

  private resolveHitEvent(action: ActionInstance, ev: TimelineEvent): void {
    const st = this.state;
    const actor = st.actors[action.actorId];
    if (action.kind === 'item') {
      this.applyItemEffect(action);
      return;
    }
    const skill = SKILL_BY_ID[action.skillId!];
    const hooks = SKILL_HOOKS[skill.id];
    const rt = this.runtimeFor(action);
    let dealt = 0;
    let absorbed = false;
    if (skill.power > 0) {
      const targets = action.targetIds.map((id) => st.actors[id]).filter((a) => a && a.alive);
      const pf = ev.promptFor;
      const grade = pf !== undefined && pf >= 0
        ? (action.promptResults[pf] === undefined ? 'good' : action.promptResults[pf])
        : this.lastPromptGrade(action);
      const qte = qteMultiplier(grade);
      for (const target of targets) {
        const res = this.dealDamage({
          attacker: actor,
          target,
          power: skill.power,
          hitWeight: ev.weight === undefined ? 1 : ev.weight,
          element: ev.element || this.resolveElement(skill, actor, ev.index, action),
          qteMul: qte,
          powerMul: action.powerMul,
          critMultiplier: skill.id === 'sword_dance' ? 2.0 : 1.5,
          eventId: ev.id,
          index: ev.index,
          extraMul: 1,
          allowShield: true,
          canCrit: true,
        });
        dealt += res.damage;
        absorbed = absorbed || res.absorbed;
      }
      if (dealt > 0 && skill.breakValue > 0) {
        const perHit = skill.breakValue / Math.max(1, action.events.filter((e) => e.type === 'hit').length);
        this.addBreak(perHit);
      }
    }
    if (hooks && hooks.onHit) hooks.onHit(rt, ev.index, dealt, absorbed);
    if (action.kind === 'attack' && dealt > 0) {
      const gained = (action.flags.apGained as unknown as number) || 0;
      if (gained < 3) {
        action.flags.apGained = (gained + 1) as unknown as boolean;
        this.addAp(actor.id, 1, '基础攻击命中');
      }
    }
    this.checkOutcomes();
  }

  private applyItemEffect(action: ActionInstance): void {
    const st = this.state;
    const target = st.actors[action.targetIds[0]];
    if (!target) return;
    if (action.itemId === 'heal') {
      this.healActor(target.id, Math.floor(target.maxHp * 0.45), action.actorId);
    } else if (action.itemId === 'energy') {
      this.addAp(target.id, 7, '强力精力亮色');
    } else if (action.itemId === 'revive') {
      this.reviveActor(target.id, 0.5);
    }
    this.checkOutcomes();
  }

  private resolveBossSelfEvent(action: ActionInstance, ev: TimelineEvent): void {
    const boss = this.state.actors[this.state.bossId];
    if (action.moveId === 'blade_charge') {
      this.addShield(boss.id, 3);
      this.applyStatus(boss.id, 'strong', 1, 2, boss.id);
      this.emit('log', { text: '四手剑客蓄势 —— 获得 3 层护盾与强力', tone: 'boss' });
    }
  }

  // ------------------------------------------------------------------ 伤害

  private dealDamage(params: {
    attacker: ActorState; target: ActorState; power: number; hitWeight: number; element: ElementId;
    qteMul: number; powerMul: number; critMultiplier: number; eventId: string; index: number;
    extraMul: number; allowShield: boolean; canCrit?: boolean; blockGrade?: BlockGrade;
  }): { damage: number; absorbed: boolean } {
    const st = this.state;
    const { attacker, target } = params;
    if (!target.alive) return { damage: 0, absorbed: false };
    const grade = params.blockGrade;
    const blockMul = grade ? blockDamageMultiplier(grade) : 1;
    if (blockMul === 0) {
      this.emit('hit', {
        eventId: params.eventId, sourceId: attacker.id, targetId: target.id, damage: 0,
        element: params.element, crit: false, weakness: false, resist: false, absorbed: false,
        shielded: false, grade, heal: false, overkill: false, index: params.index,
      });
      return { damage: 0, absorbed: false };
    }
    if (params.allowShield && target.shield > 0) {
      this.addShield(target.id, -1);
      this.emit('hit', {
        eventId: params.eventId, sourceId: attacker.id, targetId: target.id, damage: 0,
        element: params.element, crit: false, weakness: false, resist: false, absorbed: true,
        shielded: true, grade, heal: false, overkill: false, index: params.index,
      });
      return { damage: 0, absorbed: true };
    }
    const markInst = target.statuses.find((s) => s.id === 'mark');
    const crit = params.canCrit === false ? false : this.rng.chance(critChance(attacker, target));
    const variance = this.rng.range(0.96, 1.04);
    const res = computeDamage({
      attacker, target, power: params.power, hitWeight: params.hitWeight, element: params.element,
      qteMul: params.qteMul, powerMul: params.powerMul, crit, critMultiplier: params.critMultiplier,
      markConsumed: !!markInst, variance, defenseModifier: 1, extraMul: params.extraMul * blockMul,
    });
    let dmg = res.damage;
    if (res.absorb) {
      const healAmount = Math.abs(dmg);
      this.healActor(target.id, healAmount, attacker.id);
      return { damage: 0, absorbed: false };
    }
    if (markInst && dmg > 0) this.removeStatus(target.id, 'mark');
    target.hp = Math.max(0, target.hp - dmg);
    if (attacker.kind === 'player') {
      st.stats.totalDamage += dmg;
      st.stats.maxHit = Math.max(st.stats.maxHit, dmg);
    } else {
      st.stats.damageTaken += dmg;
    }
    this.emit('hit', {
      eventId: params.eventId, sourceId: attacker.id, targetId: target.id, damage: dmg,
      element: params.element, crit, weakness: res.weakness, resist: res.resist, absorbed: false,
      shielded: false, grade, heal: false, overkill: target.hp <= 0, index: params.index,
    });
    if (target.hp <= 0 && target.alive) this.killActor(target);
    return { damage: dmg, absorbed: false };
  }

  private killActor(actor: ActorState): void {
    actor.alive = false;
    actor.hp = 0;
    actor.stance = 'none';
    this.state.extraEntries = this.state.extraEntries.filter((e) => e.actorId !== actor.id);
    this.emit('death', { actorId: actor.id });
    this.emit('log', { text: actor.name + (actor.kind === 'boss' ? ' 崩解！' : ' 倒下了'), tone: 'death' });
    this.checkOutcomes();
  }

  private checkOutcomes(): void {
    const st = this.state;
    if (st.outcome !== 'none') return;
    const boss = st.actors[st.bossId];
    if (!boss.alive || boss.hp <= 0) {
      if (st.pendingVictoryAt === null) {
        st.pendingVictoryAt = st.now + DEATH_FEEDBACK_MS;
        st.pendingPhase = null;
        this.emit('log', { text: '四手剑客的四臂同时垂落 ——', tone: 'victory' });
      }
      return;
    }
    const anyAlive = st.partyOrder.some((id) => st.actors[id].alive);
    if (!anyAlive && st.pendingDefeatAt === null) {
      st.pendingDefeatAt = st.now + DEATH_FEEDBACK_MS;
    }
  }

  private finishVictory(): void {
    const st = this.state;
    if (st.outcome !== 'none') return;
    st.outcome = 'victory';
    if (st.action) st.action.cancelled = true;
    st.action = null;
    st.counterWindow = null;
    st.activeDefense = null;
    st.activePrompt = null;
    st.stats.elapsedMs = st.now - st.stats.startedAt;
    this.setFsm('VICTORY');
    this.emit('victory', { stats: { ...st.stats } });
  }

  private finishDefeat(): void {
    const st = this.state;
    if (st.outcome !== 'none') return;
    st.outcome = 'defeat';
    if (st.action) st.action.cancelled = true;
    st.action = null;
    st.counterWindow = null;
    st.stats.elapsedMs = st.now - st.stats.startedAt;
    this.setFsm('DEFEAT');
    this.emit('defeat', { stats: { ...st.stats } });
  }

  // ------------------------------------------------------------------ 资源与状态

  addAp(actorId: string, delta: number, reason: string): void {
    const a = this.state.actors[actorId];
    if (!a) return;
    const before = a.ap;
    a.ap = Math.max(0, Math.min(a.maxAp, a.ap + delta));
    if (a.ap !== before) this.emit('apChange', { actorId, delta: a.ap - before, reason, ap: a.ap });
  }

  addShield(actorId: string, layers: number): void {
    const a = this.state.actors[actorId];
    if (!a) return;
    const before = a.shield;
    a.shield = Math.max(0, Math.min(a.maxShield, a.shield + layers));
    if (a.shield !== before) this.emit('shieldChange', { actorId, shield: a.shield, delta: a.shield - before });
  }

  healActor(targetId: string, amount: number, sourceId: string): void {
    const a = this.state.actors[targetId];
    if (!a || !a.alive || amount <= 0) return;
    if (hasStatus(a, 'inverted')) {
      a.hp = Math.max(0, a.hp - amount);
      this.state.stats.damageTaken += amount;
      this.emit('heal', { targetId, amount: -amount, sourceId, inverted: true });
      this.emit('hit', {
        eventId: this.nextId('inv'), sourceId, targetId, damage: amount, element: 'physical',
        crit: false, weakness: false, resist: false, absorbed: false, shielded: false,
        heal: false, overkill: a.hp <= 0, index: 0,
      });
      if (a.hp <= 0) this.killActor(a);
      return;
    }
    const before = a.hp;
    a.hp = Math.min(a.maxHp, a.hp + amount);
    const gained = a.hp - before;
    this.state.stats.healing += gained;
    this.emit('heal', { targetId, amount: gained, sourceId, inverted: false });
  }

  applyStatus(targetId: string, id: StatusId, stacks: number, turns: number, applierId?: string): void {
    const st = this.state;
    const a = st.actors[targetId];
    if (!a || !a.alive) return;
    if (id === 'burn' && hasStatus(st.actors[st.bossId], 'noFireInfuse') && applierId === st.bossId) {
      this.emit('log', { text: '金剑核心已破损 —— 着火附加失效', tone: 'aim' });
      return;
    }
    let t = turns;
    if (id === 'inverted' && st.invertedReduction > 0) {
      t = Math.max(1, t - st.invertedReduction);
      st.invertedReduction = 0;
      this.emit('log', { text: '紫剑核心破损 —— 倒逆持续时间 -1', tone: 'aim' });
    }
    const def = STATUS_DEFS[id];
    const existing = a.statuses.find((s) => s.id === id);
    if (existing) {
      if (def.stacking === 'stacks') existing.stacks = Math.min(def.maxStacks, existing.stacks + stacks);
      existing.turns = Math.max(existing.turns, t);
      existing.appliedTurn = st.stats.turns;
      if (applierId) existing.applierId = applierId;
      this.emit('statusChange', { targetId, statusId: id, stacks: existing.stacks, turns: existing.turns, removed: false });
      return;
    }
    a.statuses.push({
      id, stacks: Math.min(def.maxStacks, stacks), turns: t,
      applierId: applierId || st.currentActorId || targetId, appliedTurn: st.stats.turns,
    });
    this.emit('statusChange', { targetId, statusId: id, stacks, turns: t, removed: false });
    if (id === 'swift') this.recomputeNextAct(a);
    if (id === 'slow') this.recomputeNextAct(a);
  }

  private recomputeNextAct(actor: ActorState): void {
    const remaining = actor.nextActAt - this.state.queueNow;
    if (remaining <= 0) return;
    const ratio = hasStatus(actor, 'swift') ? 1 / 1.2 : hasStatus(actor, 'slow') ? 1 / 0.8 : 1;
    actor.nextActAt = this.state.queueNow + remaining * ratio;
    this.emit('queueChange', { entries: this.previewQueue(8) });
  }

  removeStatus(targetId: string, id: StatusId): boolean {
    const a = this.state.actors[targetId];
    if (!a) return false;
    const idx = a.statuses.findIndex((s) => s.id === id);
    if (idx < 0) return false;
    a.statuses.splice(idx, 1);
    this.emit('statusChange', { targetId, statusId: id, stacks: 0, turns: 0, removed: true });
    return true;
  }

  addBreak(amount: number): void {
    const st = this.state;
    const boss = st.actors[st.bossId];
    if (!boss.alive) return;
    boss.breakGauge = Math.max(0, Math.min(boss.breakMax, boss.breakGauge + amount));
    this.emit('breakChange', { value: boss.breakGauge, broken: boss.broken });
    if (!boss.broken && boss.breakGauge >= boss.breakMax) {
      boss.broken = true;
      boss.brokenSkipPending = true;
      this.emit('breakChange', { value: boss.breakGauge, broken: true });
      this.emit('log', { text: '四手剑客破防！受到伤害 x1.25 并失去下一次行动', tone: 'break' });
      const action = st.action;
      if (action && action.kind === 'boss') {
        const anyResolved = action.events.some((e) => e.type === 'defenseHit' && e.resolved);
        if (!anyResolved) {
          for (const e of action.events) if (e.type === 'defenseHit') e.cancelled = true;
          this.emit('log', { text: 'Boss 的招式被打断', tone: 'break' });
          this.refreshActionEnd(action);
        }
      }
    }
  }

  addForetell(targetId: string, layers: number): void {
    const st = this.state;
    const sciel = st.actors['sciel'];
    if (!sciel) return;
    const cap = sciel.phaseTag === 'twilight' ? 20 : 10;
    const mult = sciel.phaseTag === 'twilight' ? 2 : 1;
    const cur = sciel.foretell[targetId] || 0;
    sciel.foretell[targetId] = Math.min(cap, cur + layers * mult);
    this.emit('log', { text: '先见 ' + sciel.foretell[targetId] + ' 层', tone: 'sciel' });
  }

  consumeForetell(targetId: string, max: number): number {
    const sciel = this.state.actors['sciel'];
    if (!sciel) return 0;
    const cur = sciel.foretell[targetId] || 0;
    const used = Math.min(cur, max);
    sciel.foretell[targetId] = cur - used;
    return used;
  }

  addStain(stain: StainId): void {
    const lune = this.state.actors['lune'];
    if (!lune) return;
    if (lune.stains.length >= lune.maxStains) lune.stains.shift();
    lune.stains.push(stain);
    this.emit('log', { text: '生成异色：' + stain, tone: 'lune' });
  }

  consumeStain(stain: StainId): boolean {
    const lune = this.state.actors['lune'];
    if (!lune) return false;
    const idx = lune.stains.indexOf(stain);
    if (idx < 0) return false;
    lune.stains.splice(idx, 1);
    this.emit('log', { text: '消费异色：' + stain, tone: 'lune' });
    return true;
  }

  setStance(stance: StanceId): void {
    const maelle = this.state.actors['maelle'];
    if (!maelle) return;
    maelle.stance = stance;
    this.emit('statusChange', { targetId: 'maelle', statusId: 'defenseUp', stacks: 0, turns: 0, removed: true });
    this.emit('log', { text: '玛埃尔姿态：' + stance, tone: 'maelle' });
  }

  private applyPhaseTagAlternation(actor: ActorState, tags: ('sun' | 'moon')[]): void {
    if (actor.id !== 'sciel' || tags.length === 0) return;
    const tag = tags[0];
    if (actor.phaseTag === 'twilight') return;
    const opposite = actor.lastTagUsed !== null && actor.lastTagUsed !== tag;
    if (opposite) {
      actor.alternations += 1;
      if (actor.alternations >= 2) {
        actor.phaseTag = 'twilight';
        actor.twilightTurns = 2;
        actor.alternations = 0;
        this.emit('log', { text: '熙艾尔进入薄暮 —— 伤害 +75%，先见层数与上限翻倍', tone: 'sciel' });
      }
    } else {
      actor.alternations = 0;
      actor.phaseTag = tag;
    }
    actor.lastTagUsed = tag;
  }

  insertAtQueueHead(targetId: string): boolean {
    const st = this.state;
    const a = st.actors[targetId];
    if (!a || !a.alive) return false;
    if (a.fateUsedInChain) return false;
    a.fateUsedInChain = true;
    const entries = this.queueEntries();
    const minAt = entries.length ? entries[0].at : st.queueNow;
    a.nextActAt = Math.min(a.nextActAt, minAt) - 0.001;
    this.emit('queueChange', { entries: this.previewQueue(8) });
    return true;
  }

  grantExtraTurn(actorId: string): boolean {
    const st = this.state;
    const a = st.actors[actorId];
    if (!a || !a.alive || a.extraTurnUsedInRound) return false;
    a.extraTurnUsedInRound = true;
    const entries = this.queueEntries();
    const minAt = entries.length ? entries[0].at : st.queueNow;
    st.extraEntries.push({ actorId, at: minAt - 0.002, seq: a.seq, kind: 'extra', label: '额外回合' });
    this.emit('queueChange', { entries: this.previewQueue(8) });
    return true;
  }

  reviveActor(targetId: string, ratio: number): boolean {
    const st = this.state;
    const a = st.actors[targetId];
    if (!a || a.alive) return false;
    a.alive = true;
    a.hp = Math.max(1, Math.floor(a.maxHp * ratio));
    a.statuses = [];
    a.nextActAt = st.queueNow + queueDelta(a, 1.0);
    this.emit('revive', { actorId: targetId });
    this.emit('log', { text: a.name + ' 归队', tone: 'buff' });
    this.emit('queueChange', { entries: this.previewQueue(8) });
    return true;
  }

  private spreadBuffs(fromId: string): void {
    const st = this.state;
    const src = st.actors[fromId];
    if (!src) return;
    const buffs = src.statuses.filter((s) => STATUS_DEFS[s.id].kind === 'buff');
    for (const b of buffs) {
      for (const id of st.partyOrder) {
        if (id === fromId) continue;
        this.applyStatus(id, b.id, b.stacks, Math.max(1, b.turns - 1), id);
      }
    }
    if (buffs.length > 0) this.emit('log', { text: '增益扩散至全队', tone: 'buff' });
  }

  private runtimeFor(action: ActionInstance): SkillRuntime {
    const st = this.state;
    const self = this;
    const actor = st.actors[action.actorId];
    const targets = action.targetIds.map((id) => st.actors[id]).filter(Boolean);
    return {
      state: st,
      actor,
      targets,
      primaryTarget: targets[0] || null,
      action,
      rng: this.rng,
      difficulty: this.cfg,
      log: (text, tone) => self.emit('log', { text, tone }),
      addAp: (id, d, reason) => self.addAp(id, d, reason),
      applyStatus: (id, sid, stacks, turns, applier) => self.applyStatus(id, sid, stacks, turns, applier || actor.id),
      removeStatus: (id, sid) => self.removeStatus(id, sid),
      hasStatus: (id, sid) => (st.actors[id] ? hasStatus(st.actors[id], sid) : false),
      statusStacks: (id, sid) => (st.actors[id] ? statusStacks(st.actors[id], sid) : 0),
      addShield: (id, n) => self.addShield(id, n),
      healActor: (id, amt, src) => self.healActor(id, amt, src),
      addBreak: (n) => self.addBreak(n),
      addForetell: (id, n) => self.addForetell(id, n),
      foretellOn: (id) => (st.actors['sciel'] ? st.actors['sciel'].foretell[id] || 0 : 0),
      consumeForetell: (id, max) => self.consumeForetell(id, max),
      addStain: (s) => self.addStain(s),
      consumeStain: (s) => self.consumeStain(s),
      setStance: (s) => self.setStance(s),
      insertAtQueueHead: (id) => self.insertAtQueueHead(id),
      grantExtraTurn: (id) => self.grantExtraTurn(id),
      reviveActor: (id, ratio) => self.reviveActor(id, ratio),
      extendHit: (spacing, weight, element) => self.extendHit(action, spacing, weight, element),
      cancelHit: (index) => self.cancelHit(action, index),
      spreadBuffs: (id) => self.spreadBuffs(id),
      allies: () => st.partyOrder.map((id) => st.actors[id]).filter((a) => a.alive),
      enemies: () => [st.actors[st.bossId]].filter((a) => a.alive),
    };
  }

  private extendHit(action: ActionInstance, spacing: number, weight: number, element?: ElementId): void {
    const hits = action.events.filter((e) => e.type === 'hit' && !e.cancelled);
    const last = hits.length ? hits[hits.length - 1] : null;
    const at = (last ? last.at : this.state.now) + spacing * 1000;
    const actor = this.state.actors[action.actorId];
    const skill = action.skillId ? SKILL_BY_ID[action.skillId] : BASIC_ATTACK;
    action.events.push({
      id: this.nextId('ev'), at, type: 'hit', index: hits.length, resolved: false, weight,
      element: element || this.resolveElement(skill, actor, hits.length, action),
    });
    this.refreshActionEnd(action);
  }

  private cancelHit(action: ActionInstance, index: number): void {
    const hits = action.events.filter((e) => e.type === 'hit');
    const target = hits.find((e) => e.index === index);
    if (target && !target.resolved) {
      target.cancelled = true;
      this.refreshActionEnd(action);
    }
  }

  // ------------------------------------------------------------------ 空格判定

  pressSpace(): void {
    const st = this.state;
    if (this.disposed || st.paused || st.outcome !== 'none') return;
    this.pressSeq += 1;
    st.lastPressId = this.pressSeq;
    this.recordInput('press');
    if (st.now < st.spamCooldownUntil) {
      this.emit('spam', { until: st.spamCooldownUntil });
      return;
    }
    const action = st.action;
    if (!action || action.cancelled) return;

    // 1) 未结算的可防御段（含 60ms 早按缓冲）
    const defs = action.events.filter((e) => e.type === 'defenseHit' && e.defensible && !e.resolved && !e.cancelled);
    if (defs.length > 0) {
      let nearest = defs[0];
      for (const e of defs) if (Math.abs(e.at - st.now) < Math.abs(nearest.at - st.now)) nearest = e;
      const delta = st.now - nearest.at;
      if (delta > this.cfg.blockOuter) {
        // 该段已过期，等待其自动结算
        st.spamCooldownUntil = st.now + SPAM_COOLDOWN_MS;
        this.emit('spam', { until: st.spamCooldownUntil });
        return;
      }
      if (delta < -this.cfg.blockOuter) {
        if (delta >= -(this.cfg.blockOuter + EARLY_BUFFER_MS)) {
          nearest.bufferedPressAt = st.now;
          this.emit('log', { text: '早按已缓冲', tone: 'info' });
          return;
        }
        st.spamCooldownUntil = st.now + SPAM_COOLDOWN_MS;
        this.emit('spam', { until: st.spamCooldownUntil });
        return;
      }
      const judged = judgeBlock(delta, this.cfg);
      const grade: BlockGrade = judged === 'perfect' ? 'perfect' : judged === 'block' ? 'block' : 'miss';
      nearest.resolved = true;
      this.applyBlockGrade(action, nearest, grade, delta);
      this.pump();
      return;
    }

    // 2) 反击窗口
    if (st.counterWindow && !st.counterResolved && st.counterArmed) {
      if (st.now >= st.counterWindow.opensAt && st.now <= st.counterWindow.closesAt) {
        const delta = st.now - st.counterWindow.idealAt;
        const perfect = Math.abs(delta) <= this.cfg.skillPerfect;
        st.counterResolved = true;
        st.counterArmed = false;
        this.emit('counterJudged', { grade: perfect ? 'perfect' : 'block', deltaMs: delta });
        this.performCounter(perfect);
        return;
      }
      if (st.now < st.counterWindow.opensAt) {
        st.spamCooldownUntil = st.now + SPAM_COOLDOWN_MS;
        this.emit('spam', { until: st.spamCooldownUntil });
        return;
      }
    }

    // 3) 技能连协提示
    const prompts = action.events.filter((e) => e.type === 'prompt' && !e.resolved && !e.cancelled);
    if (prompts.length > 0) {
      let nearest = prompts[0];
      for (const e of prompts) if (Math.abs(e.at - st.now) < Math.abs(nearest.at - st.now)) nearest = e;
      const delta = st.now - nearest.at;
      if (Math.abs(delta) <= this.cfg.skillGood) {
        nearest.resolved = true;
        const grade = judgeSkillPrompt(delta, this.cfg);
        this.applyPromptGrade(action, nearest, grade, delta);
        this.pump();
        return;
      }
    }
  }

  private applyPromptGrade(action: ActionInstance, ev: TimelineEvent, grade: Grade, delta: number): void {
    const st = this.state;
    ev.grade = grade;
    action.promptResults[ev.index] = grade;
    st.lastPromptDelta = delta;
    if (grade === 'perfect') st.stats.promptPerfect += 1;
    else if (grade === 'good') st.stats.promptGood += 1;
    else st.stats.promptMiss += 1;
    this.emit('promptJudged', { eventId: ev.id, grade, deltaMs: delta, index: ev.index });
    const skill = action.skillId ? SKILL_BY_ID[action.skillId] : null;
    const hooks = skill ? SKILL_HOOKS[skill.id] : null;
    if (hooks && hooks.onPrompt) hooks.onPrompt(this.runtimeFor(action), ev.index, grade);
    this.refreshActionEnd(action);
  }

  private applyBlockGrade(action: ActionInstance, ev: TimelineEvent, grade: BlockGrade, delta: number): void {
    const st = this.state;
    // 早按缓冲：窗口开启时以普通格挡结算
    if (grade === 'miss' && ev.bufferedPressAt !== undefined) {
      grade = 'block';
      delta = ev.bufferedPressAt - ev.at;
    }
    ev.grade = grade;
    st.lastDefenseDelta = delta;
    action.blockResults[ev.index] = grade;
    st.chainResolvedCount += 1;
    const targets = (ev.targetIds || [ev.targetId || '']).map((id) => st.actors[id]).filter((a) => a && a.alive);
    if (grade === 'perfect') {
      st.chainPerfectCount += 1;
      st.blockChain += 1;
      st.stats.perfectBlocks += 1;
      st.stats.bestBlockChain = Math.max(st.stats.bestBlockChain, st.blockChain);
      for (const t of targets) this.rewardBlockAp(t, true);
    } else if (grade === 'block') {
      st.stats.normalBlocks += 1;
      st.blockChain = 0;
      action.perfectChain = false;
      for (const t of targets) this.rewardBlockAp(t, false);
    } else {
      st.stats.missedBlocks += 1;
      st.blockChain = 0;
      action.perfectChain = false;
    }
    this.emit('defenseJudged', {
      eventId: ev.id, grade, deltaMs: delta, index: ev.index, targetId: ev.targetId || '',
    });

    const move = action.moveId ? BOSS_MOVE_BY_ID[action.moveId] : null;
    const boss = st.actors[st.bossId];
    if (move && move.power > 0 && grade !== 'perfect') {
      for (const t of targets) {
        this.dealDamage({
          attacker: boss, target: t, power: move.power, hitWeight: ev.weight === undefined ? 1 : ev.weight,
          element: ev.element || 'physical', qteMul: 1, powerMul: 1, critMultiplier: 1.5,
          eventId: ev.id, index: ev.index, extraMul: this.cfg.bossDamageMul, allowShield: true,
          canCrit: true, blockGrade: grade,
        });
      }
    }
    if (move) this.applyMoveSideEffects(move, ev, grade, targets, action);
    this.checkOutcomes();

    const remaining = action.events.filter((e) => e.type === 'defenseHit' && e.defensible && !e.resolved && !e.cancelled);
    if (remaining.length === 0) this.maybeOpenCounter(action);
  }

  private rewardBlockAp(actor: ActorState, perfect: boolean): void {
    const st = this.state;
    if (perfect) {
      const got = st.apFromBlocksThisChain[actor.id] || 0;
      if (got < 3) {
        st.apFromBlocksThisChain[actor.id] = got + 1;
        this.addAp(actor.id, 1, '完美格挡');
      }
    }
    if (actor.id === 'maelle' && actor.stance === 'defensive') {
      const got = st.defensiveApThisChain[actor.id] || 0;
      if (got < 2) {
        st.defensiveApThisChain[actor.id] = got + 1;
        this.addAp(actor.id, 1, '守势格挡');
      }
    }
  }

  private applyMoveSideEffects(
    move: { id: string }, ev: TimelineEvent, grade: BlockGrade, targets: ActorState[], action: ActionInstance,
  ): void {
    const st = this.state;
    const boss = st.actors[st.bossId];
    const isLast = ev.index === st.chainDefensibleCount - 1;
    switch (move.id) {
      case 'four_arm_combo':
        if (isLast && grade !== 'perfect') {
          for (const t of targets) this.applyStatus(t.id, 'vulnerable', 1, 1, boss.id);
        }
        break;
      case 'swift_thrust':
        if (grade === 'miss') {
          boss.breakGauge = Math.max(0, boss.breakGauge - 10);
          this.emit('breakChange', { value: boss.breakGauge, broken: boss.broken });
          this.emit('log', { text: '突刺未被完美格挡 —— Boss 恢复 10 破防值', tone: 'boss' });
        }
        break;
      case 'sweeping_slash':
        if (grade === 'miss' && ev.index === 0) {
          for (const t of targets) this.applyStatus(t.id, 'burn', 1, 99, boss.id);
        }
        if (grade === 'miss' && ev.index === 1 && this.rng.chance(0.35)) {
          for (const t of targets) this.applyStatus(t.id, 'slow', 1, 2, boss.id);
        }
        break;
      case 'inverted_array':
        if (grade === 'block') {
          for (const t of targets) this.applyStatus(t.id, 'inverted', 1, 2, boss.id);
        } else if (grade === 'miss') {
          for (const t of targets) this.applyStatus(t.id, 'inverted', 1, this.cfg.invertedTurns, boss.id);
        }
        break;
      case 'twin_execution':
        if (ev.index === 1 && grade !== 'perfect') {
          for (const t of targets) {
            if (t.alive && t.hp / t.maxHp < 0.3) this.applyStatus(t.id, 'burn', 2, 99, boss.id);
          }
        }
        break;
      case 'blood_storm':
        if (grade !== 'perfect') this.speedUpRemaining(action, 0.08);
        break;
      default:
        break;
    }
  }

  private speedUpRemaining(action: ActionInstance, ratio: number): void {
    const st = this.state;
    const pending = action.events
      .filter((e) => e.type === 'defenseHit' && !e.resolved && !e.cancelled)
      .sort((a, b) => a.at - b.at);
    if (pending.length === 0) return;
    const first = pending[0];
    const gap = first.at - st.now;
    if (gap <= 0) return;
    const shift = gap * ratio;
    for (const e of pending) e.at -= shift;
    this.refreshActionEnd(action);
    this.emit('log', { text: '剑势加速 —— 下一段提前 ' + Math.round(shift) + 'ms', tone: 'warn' });
  }

  // ------------------------------------------------------------------ 反击

  private maybeOpenCounter(action: ActionInstance): void {
    const st = this.state;
    if (action.kind !== 'boss') return;
    if (action.flags.counterOpened) return;
    if (st.chainDefensibleCount === 0) return;
    const alive = st.partyOrder.filter((id) => st.actors[id].alive);
    if (alive.length === 0) return;
    if (st.chainPerfectCount !== st.chainDefensibleCount) return;
    const lastImpact = Math.max(...action.events.filter((e) => e.type === 'defenseHit').map((e) => e.at));
    const opensAt = Math.max(st.now, lastImpact) + PERFECT_HITSTOP_MS;
    action.flags.counterOpened = true;
    st.counterWindow = { opensAt, closesAt: opensAt + COUNTER_WINDOW_MS, idealAt: opensAt + 200 };
    st.counterArmed = true;
    st.counterResolved = false;
    st.counterBonusMul = action.moveId === 'blood_storm' ? 1.5 : 1;
    this.setFsm('COUNTER_WINDOW');
    this.emit('counterOpen', { opensAt, closesAt: st.counterWindow.closesAt });
    this.emit('log', { text: '完美格挡！按空格发动队伍反击', tone: 'perfect' });
  }

  private performCounter(perfect: boolean): void {
    const st = this.state;
    const alive = st.partyOrder.filter((id) => st.actors[id].alive);
    st.stats.fullCounters += 1;
    const action = this.makeAction('counter', alive[0], [st.bossId]);
    const mul = (perfect ? 1.25 : 1) * st.counterBonusMul;
    action.powerMul = mul;
    alive.forEach((id, i) => {
      action.events.push({
        id: this.nextId('ev'), at: st.now + 120 + i * COUNTER_STEP_MS, type: 'counterHit', index: i,
        resolved: false, weight: 1, targetId: st.bossId, meta: { actorId: id },
      });
    });
    action.endsAt = st.now + 120 + alive.length * COUNTER_STEP_MS + ACTION_TAIL_MS;
    action.events.push({ id: this.nextId('ev'), at: action.endsAt, type: 'end', index: 0, resolved: false });
    this.pendingBossTurnEnd = true;
    st.action = action;
    this.addBreak(30);
    this.emit('counterPerformed', { actorIds: alive, perfect });
    this.emit('log', { text: perfect ? '完美反击！伤害 x1.25' : '队伍反击', tone: 'perfect' });
  }

  private resolveCounterHit(action: ActionInstance, ev: TimelineEvent): void {
    const st = this.state;
    const actorId = (ev.meta && (ev.meta.actorId as string)) || action.actorId;
    const actor = st.actors[actorId];
    const boss = st.actors[st.bossId];
    if (!actor || !actor.alive || !boss.alive) return;
    this.dealDamage({
      attacker: actor, target: boss, power: COUNTER_POWER, hitWeight: 1, element: actor.weaponElement,
      qteMul: 1, powerMul: action.powerMul, critMultiplier: 1.5, eventId: ev.id, index: ev.index,
      extraMul: 1, allowShield: true, canCrit: true,
    });
    this.checkOutcomes();
  }

  // ------------------------------------------------------------------ Boss 行动

  private startBossAction(): void {
    const st = this.state;
    const boss = st.actors[st.bossId];
    for (const id of st.partyOrder) {
      st.actors[id].fateUsedInChain = false;
      st.actors[id].extraTurnUsedInRound = false;
    }
    st.roundCounter += 1;
    const choice = chooseBossMove(st, this.rng);
    const move = choice.move;
    if (st.phase === 1 && st.tutorialIndex < TUTORIAL_MOVES.length && !st.forcedBossMove) st.tutorialIndex += 1;
    st.forcedBossMove = null;
    if (move.id === 'blood_storm') st.lastBloodStormAt = st.bossActionCount;
    st.bossActionCount += 1;
    st.bossHistory.push(move.id);

    const roll = this.rng.next();
    const tl = buildMoveTimeline(move, this.cfg, roll);
    this.currentMoveTimeline = tl;
    const targets = chooseBossTarget(st, move, this.rng);
    if (move.target === 'single' && targets[0]) st.lastSingleTargetId = targets[0].id;

    const action = this.makeAction('boss', boss.id, targets.map((t) => t.id));
    action.moveId = move.id;
    const t0 = st.now;
    const defensible = move.power > 0;
    tl.impactTimes.forEach((time, i) => {
      action.events.push({
        id: this.nextId('ev'), at: t0 + time * 1000, type: 'defenseHit', index: i, resolved: false,
        weight: tl.hitWeights[Math.min(i, tl.hitWeights.length - 1)],
        element: tl.elements[Math.min(i, tl.elements.length - 1)],
        defensible,
        jump: tl.jumpHits.includes(i),
        targetId: targets[0] ? targets[0].id : undefined,
        targetIds: targets.map((t) => t.id),
      });
    });
    action.defensibleTotal = defensible ? tl.impactTimes.length : 0;
    st.chainDefensibleCount = action.defensibleTotal;
    st.chainPerfectCount = 0;
    st.chainResolvedCount = 0;
    st.apFromBlocksThisChain = {};
    st.defensiveApThisChain = {};
    st.counterWindow = null;
    st.counterArmed = false;
    st.counterResolved = false;
    st.bossMoveName = move.name;
    st.bossMoveVariant = tl.variantName;
    st.bossMoveHint = move.defenseHint;
    this.refreshActionEnd(action);
    st.action = action;
    this.setFsm('BOSS_TELEGRAPH');
    this.emit('bossTelegraph', {
      moveId: move.id, name: move.name, warning: move.warning,
      hint: move.defenseHint + (tl.variantName ? '（' + tl.variantName + '）' : ''),
      targetIds: targets.map((t) => t.id), total: action.defensibleTotal,
    });
    this.emit('log', { text: '四手剑客：' + move.name + (tl.variantName ? '（' + tl.variantName + '）' : ''), tone: 'boss' });
    if (tl.feintAt !== null) {
      this.emit('log', { text: '注意：剑光中夹着假动作', tone: 'warn' });
    }
  }

  private finishBossAction(): void {
    const action = this.state.action;
    if (!action) {
      this.endTurn(1.0);
      return;
    }
    const move = action.moveId ? BOSS_MOVE_BY_ID[action.moveId] : null;
    this.endTurn(move ? move.actionDelay : 1.0);
  }

  // ------------------------------------------------------------------ 行动收尾

  private finishAction(action: ActionInstance): void {
    const st = this.state;
    if (action.cancelled) return;
    if (action.kind === 'counter') {
      this.pendingBossTurnEnd = false;
      st.counterWindow = null;
      this.emit('actionEnd', { actionId: action.id });
      this.endTurn(1.0);
      return;
    }
    if (action.kind === 'boss') {
      if (st.counterArmed && !st.counterResolved) return; // 等待反击窗口
      this.emit('actionEnd', { actionId: action.id });
      const move = action.moveId ? BOSS_MOVE_BY_ID[action.moveId] : null;
      this.endTurn(move ? move.actionDelay : 1.0);
      return;
    }
    const skill = action.skillId ? SKILL_BY_ID[action.skillId] : null;
    if (skill) {
      const hooks = SKILL_HOOKS[skill.id];
      if (hooks && hooks.onEnd) hooks.onEnd(this.runtimeFor(action));
    }
    this.emit('actionEnd', { actionId: action.id });
    this.checkOutcomes();
    const delay = skill ? skill.actionDelay : action.kind === 'item' ? 0.95 : 1.0;
    this.endTurn(delay);
  }

  private endTurn(actionDelay: number): void {
    const st = this.state;
    const actorId = st.currentActorId;
    if (!actorId) return;
    const actor = st.actors[actorId];
    this.setFsm('RESOLVE');
    this.tickTurnEnd(actor);
    if (!this.currentEntryIsExtra && actor.alive) this.advanceActorClock(actor, actionDelay);
    st.action = null;
    st.activeDefense = null;
    st.activePrompt = null;
    st.counterWindow = null;
    st.counterArmed = false;
    this.checkOutcomes();
    this.evaluatePhase();
    this.emit('queueChange', { entries: this.previewQueue(8) });
    this.setFsm('ADVANCE_QUEUE');
    if (st.outcome === 'none' && st.pendingVictoryAt === null && st.pendingDefeatAt === null) this.beginNextTurn();
  }

  private tickTurnEnd(actor: ActorState): void {
    const st = this.state;
    const turn = st.stats.turns;
    if (actor.alive) {
      const burn = actor.statuses.find((s) => s.id === 'burn');
      if (burn && burn.stacks > 0) {
        const dmg = Math.floor(actor.maxHp * 0.012 * burn.stacks);
        this.emit('log', { text: actor.name + ' 燃烧 ' + burn.stacks + ' 层 —— ' + dmg + ' 点火焰伤害', tone: 'fire' });
        const before = actor.hp;
        actor.hp = Math.max(0, actor.hp - dmg);
        if (actor.kind === 'player') st.stats.damageTaken += dmg;
        else { st.stats.totalDamage += dmg; st.stats.maxHit = Math.max(st.stats.maxHit, dmg); }
        this.emit('hit', {
          eventId: this.nextId('burn'), sourceId: 'burn', targetId: actor.id, damage: dmg,
          element: 'fire', crit: false, weakness: false, resist: false, absorbed: false,
          shielded: false, heal: false, overkill: actor.hp <= 0, index: 0,
        });
        burn.stacks -= 1;
        if (burn.stacks <= 0) this.removeStatus(actor.id, 'burn');
        else this.emit('statusChange', { targetId: actor.id, statusId: 'burn', stacks: burn.stacks, turns: burn.turns, removed: false });
        if (actor.hp <= 0 && before > 0) this.killActor(actor);
      }
    }
    // 自身回合计时的状态
    for (const id of Object.keys(st.actors)) {
      const a = st.actors[id];
      const keep: typeof a.statuses = [];
      for (const s of a.statuses) {
        if (s.appliedTurn === turn) { keep.push(s); continue; }
        const def = STATUS_DEFS[s.id];
        const isSelfTick = def.tickOn === 'self' && a.id === actor.id;
        const isApplierTick = def.tickOn === 'applier' && s.applierId === actor.id;
        if (s.id === 'burn' || s.id === 'typhoon') { keep.push(s); continue; }
        if (isSelfTick || isApplierTick) {
          s.turns -= 1;
          if (s.turns <= 0) {
            this.emit('statusChange', { targetId: a.id, statusId: s.id, stacks: 0, turns: 0, removed: true });
            continue;
          }
          this.emit('statusChange', { targetId: a.id, statusId: s.id, stacks: s.stacks, turns: s.turns, removed: false });
        }
        keep.push(s);
      }
      a.statuses = keep;
    }
    if (actor.id === 'sciel' && actor.phaseTag === 'twilight') {
      actor.twilightTurns -= 1;
      if (actor.twilightTurns <= 0) {
        actor.phaseTag = 'sun';
        this.emit('log', { text: '薄暮结束 —— 熙艾尔回到旭日', tone: 'sciel' });
      }
    }
    if (actor.kind === 'boss' && this.cfg.bossExtra !== 'none') {
      if (shouldScheduleExtra(st, this.cfg.bossExtra, this.rng)) {
        const delta = queueDelta(actor, 1.0);
        st.extraEntries.push({
          actorId: actor.id, at: Math.max(actor.nextActAt, st.queueNow) + delta * 0.45,
          seq: actor.seq + 1, kind: 'extra', label: '额外行动',
        });
        this.emit('log', { text: '四手剑客将插入一次额外行动', tone: 'warn' });
      }
    }
  }

  private evaluatePhase(): void {
    const st = this.state;
    if (st.outcome !== 'none' || st.pendingVictoryAt !== null) return;
    const boss = st.actors[st.bossId];
    if (!boss.alive) return;
    const ratio = boss.hp / boss.maxHp;
    let target = 1;
    if (ratio <= 0.32) target = 3;
    else if (ratio <= 0.68) target = 2;
    if (target > st.phase && st.pendingPhase === null) st.pendingPhase = target;
  }

  private startPhaseTransition(phase: number): void {
    const st = this.state;
    st.pendingPhase = null;
    st.phase = phase;
    const boss = st.actors[st.bossId];
    if (phase === 2) {
      boss.speed = boss.speed * 1.12;
      this.removeStatus(boss.id, 'slow');
      this.emit('log', { text: '阶段二 —— 金紫双剑亮起，速度提升 12%', tone: 'phase' });
    } else if (phase === 3) {
      st.forcedBossMove = 'blood_storm';
      this.emit('log', { text: '阶段三 —— 四臂全开，下一击是腥风血雨！', tone: 'phase' });
    }
    st.phaseTransitionEndsAt = st.now + PHASE_TRANSITION_MS;
    this.setFsm('PHASE_TRANSITION');
    this.emit('phaseChange', { phase });
  }

  // ------------------------------------------------------------------ 瞄准

  aimShot(weakPointId: string | null): void {
    const st = this.state;
    if (st.fsm !== 'AIM') return;
    const actor = st.actors[st.currentActorId!];
    if (actor.ap < 1) { this.exitAim(); return; }
    this.recordInput('aimShot', { weakPointId });
    this.addAp(actor.id, -1, '瞄准射击');
    st.aimShotsFired += 1;
    const boss = st.actors[st.bossId];
    const wp = weakPointId ? boss.weakPoints.find((w) => w.id === weakPointId && !w.broken) : null;
    const eventId = this.nextId('aim');
    const res = this.dealDamage({
      attacker: actor, target: boss, power: TORSO_POWER, hitWeight: 1, element: 'physical',
      qteMul: 1, powerMul: wp ? 1.5 : 1, critMultiplier: 1.5, eventId, index: 0, extraMul: 1,
      allowShield: false, canCrit: false,
    });
    if (wp) {
      this.addBreak(20);
      wp.durability -= 1;
      if (wp.durability <= 0) {
        wp.broken = true;
        st.stats.weakPointsBroken += 1;
        this.emit('weakPointBroken', { id: wp.id, name: wp.name });
        this.emit('log', { text: wp.name + ' 被击碎！', tone: 'aim' });
        if (wp.id === 'gold_core') this.applyStatus(boss.id, 'noFireInfuse', 1, 2, boss.id);
        if (wp.id === 'violet_core') st.invertedReduction = 1;
      }
    }
    this.emit('aimShot', { hit: true, weakPointId: wp ? wp.id : null, damage: res.damage });
    this.checkOutcomes();
    if (actor.ap <= 0) this.exitAim();
  }

  exitAim(): void {
    const st = this.state;
    if (st.fsm !== 'AIM') return;
    this.recordInput('aimEnd');
    st.pending = null;
    if (st.aimShotsFired === 0) {
      this.setFsm('COMMAND');
      return;
    }
    this.endTurn(1.0);
  }

  // ------------------------------------------------------------------ 调试 / 日志

  exportLog(): BattleLogFile {
    return {
      version: 1,
      difficulty: this.state.difficulty,
      seed: this.state.seed,
      inputs: this.inputs.slice(),
      records: this.records.slice(),
      result: { outcome: this.state.outcome, stats: { ...this.state.stats } },
    };
  }

  getInputs(): InputRecord[] {
    return this.inputs.slice();
  }

  debugDamageBoss(amount: number): void {
    const boss = this.state.actors[this.state.bossId];
    boss.hp = Math.max(0, boss.hp - amount);
    this.emit('hit', {
      eventId: this.nextId('dbg'), sourceId: 'debug', targetId: boss.id, damage: amount,
      element: 'physical', crit: false, weakness: false, resist: false, absorbed: false,
      shielded: false, heal: false, overkill: boss.hp <= 0, index: 0,
    });
    if (boss.hp <= 0) this.killActor(boss);
    this.evaluatePhase();
  }

  debugSetBossHpRatio(ratio: number): void {
    const boss = this.state.actors[this.state.bossId];
    boss.hp = Math.max(1, Math.floor(boss.maxHp * ratio));
    this.evaluatePhase();
  }

  debugGiveAp(): void {
    for (const id of this.state.partyOrder) this.addAp(id, 9, 'debug');
  }

  debugForceMove(moveId: string): void {
    this.state.forcedBossMove = moveId;
  }
}

export function createEngine(opts: EngineOptions): BattleEngine {
  const e = new BattleEngine(opts);
  e.start();
  return e;
}
