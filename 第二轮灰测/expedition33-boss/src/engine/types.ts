/**
 * 纯逻辑层类型定义。此文件不得 import three 或任何 DOM API。
 */

export type ElementId = 'physical' | 'fire' | 'ice' | 'lightning' | 'earth' | 'light' | 'dark';
export const ELEMENTS: ElementId[] = ['physical', 'fire', 'ice', 'lightning', 'earth', 'light', 'dark'];

export type DifficultyId = 'expedition' | 'standard' | 'expert';

/** 玛埃尔剑术姿态 */
export type StanceId = 'none' | 'offensive' | 'defensive' | 'virtuose';
/** 熙艾尔日月姿态 */
export type PhaseTagId = 'sun' | 'moon' | 'twilight';
/** 吕涅异色（元素印记） */
export type StainId = 'fire' | 'ice' | 'lightning' | 'earth' | 'light';

export type Grade = 'perfect' | 'good' | 'miss';
export type BlockGrade = 'perfect' | 'block' | 'miss';

export type StatusId =
  | 'burn' | 'mark' | 'vulnerable' | 'strong' | 'sturdy' | 'swift' | 'slow'
  | 'weak' | 'inverted' | 'typhoon' | 'broken' | 'noFireInfuse' | 'defenseUp';

export type TickOwner = 'self' | 'applier';

export interface StatusDef {
  id: StatusId;
  name: string;
  kind: 'buff' | 'debuff' | 'neutral';
  stacking: 'stacks' | 'refresh';
  maxStacks: number;
  tickOn: TickOwner;
  icon: string;
  describe: (s: StatusInstance) => string;
}

export interface StatusInstance {
  id: StatusId;
  stacks: number;
  turns: number;
  applierId: string;
  /** 附带数值（台风的治疗量比例等） */
  value?: number;
  /** 施加时的回合序号（同回合施加的状态不在本回合末衰减） */
  appliedTurn: number;
}

export interface WeakPoint {
  id: string;
  name: string;
  durability: number;
  maxDurability: number;
  broken: boolean;
  /** 模型局部坐标，供渲染层定位 */
  anchor: [number, number, number];
  color: string;
}

export interface ActorState {
  id: string;
  name: string;
  kind: 'player' | 'boss';
  role: string;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  attack: number;
  defense: number;
  speed: number;
  critRate: number;
  critResist: number;
  shield: number;
  maxShield: number;
  alive: boolean;
  statuses: StatusInstance[];
  /** 抽象队列时钟 */
  nextActAt: number;
  seq: number;
  weaponElement: ElementId;
  elementMods: Partial<Record<ElementId, number>>;
  /** 熙艾尔：对每个敌人独立的先见层数 */
  foretell: Record<string, number>;
  phaseTag: PhaseTagId;
  twilightTurns: number;
  alternations: number;
  lastTagUsed: 'sun' | 'moon' | null;
  /** 吕涅：异色槽 */
  stains: StainId[];
  maxStains: number;
  /** 玛埃尔：姿态 */
  stance: StanceId;
  /** Boss：破防槽 */
  breakGauge: number;
  breakMax: number;
  broken: boolean;
  brokenSkipPending: boolean;
  weakPoints: WeakPoint[];
  /** 本行动链内是否已被命运干预 */
  fateUsedInChain: boolean;
  /** 势如破竹额外回合：每轮一次 */
  extraTurnUsedInRound: boolean;
  portrait: string;
  color: string;
}

export type TargetKind = 'enemy' | 'enemyAll' | 'ally' | 'allyAll' | 'deadAlly' | 'self' | 'field';

export interface SkillEffectSpec {
  status?: StatusId;
  stacks?: number;
  turns?: number;
  /** 应用于目标还是施法者/全队 */
  to?: 'target' | 'self' | 'allies' | 'targetAll';
  chance?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  owner: string;
  ap: number;
  element: ElementId | 'weapon' | 'dynamic';
  target: TargetKind;
  power: number;
  hitWeights: number[];
  /** 相对动作开始的提示时间（秒） */
  promptTimes: number[];
  /** 相对动作开始的命中时间（秒）；长度可变（追加段动态追加） */
  hitTimes: number[];
  actionDelay: number;
  tags: ('sun' | 'moon')[];
  breakValue: number;
  desc: string;
  longDesc: string;
  professionNote?: string;
  kind: 'attack' | 'support' | 'revive';
  effects: SkillEffectSpec[];
  heal?: { ratio: number; to: 'target' | 'allies' };
}

export interface ItemDef {
  id: string;
  name: string;
  target: TargetKind;
  desc: string;
  longDesc: string;
  actionDelay: number;
}

export interface BossMoveDef {
  id: string;
  name: string;
  warning: string;
  defenseHint: string;
  target: 'single' | 'all' | 'lowest' | 'self';
  impactTimes: number[];
  power: number;
  hitWeights: number[];
  elements: ElementId[];
  /** 需要跳跃语义（地面横扫）的段索引 */
  jumpHits: number[];
  phases: number[];
  actionDelay: number;
  tail: number;
  desc: string;
}

export interface TimelineEvent {
  id: string;
  at: number;
  type: 'prompt' | 'hit' | 'defenseHit' | 'counterWindow' | 'counterHit' | 'end' | 'auraTick';
  index: number;
  resolved: boolean;
  cancelled?: boolean;
  announced?: boolean;
  targetId?: string;
  targetIds?: string[];
  weight?: number;
  element?: ElementId;
  defensible?: boolean;
  jump?: boolean;
  /** 早按输入缓冲 */
  bufferedPressAt?: number;
  grade?: Grade | BlockGrade;
  /** 命中所对应的提示段（-1 = 最近一次已结算提示） */
  promptFor?: number;
  meta?: Record<string, unknown>;
}

export interface ActionInstance {
  id: string;
  actorId: string;
  kind: 'attack' | 'skill' | 'item' | 'aim' | 'boss' | 'counter';
  skillId?: string;
  itemId?: string;
  moveId?: string;
  targetIds: string[];
  startedAt: number;
  events: TimelineEvent[];
  promptResults: Grade[];
  blockResults: BlockGrade[];
  cancelled: boolean;
  apSpent: number;
  breakAccrued: number;
  /** 已解锁的追加段标记 */
  flags: Record<string, boolean>;
  consumedStains: StainId[];
  consumedForetell: number;
  /** 用于视觉层的机位序号 */
  cameraShots: number;
  endsAt: number;
  /** 动态权重（狂杀按异色数量分摊） */
  weightsOverride?: number[];
  /** 整体威力倍率（plan 阶段计算） */
  powerMul: number;
  /** 动态元素（狂杀逐段元素） */
  elementsOverride?: ElementId[];
  /** boss 招式：本套可防御段总数 */
  defensibleTotal: number;
  perfectChain: boolean;
}

export type FsmState =
  | 'BOOT' | 'DIFFICULTY_SELECT' | 'INTRO' | 'TURN_START' | 'COMMAND' | 'TARGET_SELECT'
  | 'PLAYER_ACTION' | 'SKILL_PROMPTS' | 'RESOLVE' | 'ADVANCE_QUEUE' | 'BOSS_TELEGRAPH'
  | 'DEFENSE_SEQUENCE' | 'COUNTER_WINDOW' | 'PHASE_TRANSITION' | 'VICTORY' | 'DEFEAT' | 'AIM';

export interface BattleStats {
  startedAt: number;
  elapsedMs: number;
  totalDamage: number;
  maxHit: number;
  damageTaken: number;
  perfectBlocks: number;
  normalBlocks: number;
  missedBlocks: number;
  dodges: number;
  fullCounters: number;
  promptPerfect: number;
  promptGood: number;
  promptMiss: number;
  bestBlockChain: number;
  turns: number;
  weakPointsBroken: number;
  healing: number;
}

export interface Inventory {
  heal: number;
  energy: number;
  revive: number;
}

export interface QueueEntry {
  actorId: string;
  at: number;
  seq: number;
  kind: 'actor' | 'extra';
  label?: string;
}

export interface BattleState {
  fsm: FsmState;
  difficulty: DifficultyId;
  seed: number;
  now: number;
  paused: boolean;
  actors: Record<string, ActorState>;
  partyOrder: string[];
  bossId: string;
  phase: number;
  pendingPhase: number | null;
  inventory: Inventory;
  stats: BattleStats;
  currentActorId: string | null;
  action: ActionInstance | null;
  /** 待确认的指令（选择目标阶段） */
  pending: { kind: 'attack' | 'skill' | 'item' | 'aim'; skillId?: string; itemId?: string } | null;
  blockChain: number;
  chainDefensibleCount: number;
  chainPerfectCount: number;
  chainResolvedCount: number;
  apFromBlocksThisChain: Record<string, number>;
  defensiveApThisChain: Record<string, number>;
  counterArmed: boolean;
  counterWindow: { opensAt: number; closesAt: number; idealAt: number } | null;
  counterResolved: boolean;
  spamCooldownUntil: number;
  activePrompt: { eventId: string; at: number; index: number; total: number; kind: 'skill' | 'counter' } | null;
  activeDefense: { eventId: string; at: number; jump: boolean; targetId: string; index: number; total: number } | null;
  bossHistory: string[];
  bossActionCount: number;
  bossMoveName: string | null;
  bossMoveVariant: string | null;
  bossMoveHint: string | null;
  extraEntries: QueueEntry[];
  forcedBossMove: string | null;
  lastBloodStormAt: number;
  lastSingleTargetId: string | null;
  typhoonSourceId: string | null;
  outcome: 'none' | 'victory' | 'defeat';
  pendingVictoryAt: number | null;
  pendingDefeatAt: number | null;
  phaseTransitionEndsAt: number | null;
  introEndsAt: number | null;
  roundCounter: number;
  aimShotsFired: number;
  tutorialIndex: number;
  lastPressId: number;
  lastPromptDelta: number | null;
  lastDefenseDelta: number | null;
  message: string | null;
  seqCounter: number;
  /** 当前被消费的队列时间（抽象队列时钟） */
  queueNow: number;
  /** 紫剑核心破坏后：下一次倒逆持续时间 -1 */
  invertedReduction: number;
  /** 腥风血雨全 Perfect 时反击额外倍率 */
  counterBonusMul: number;
}

export interface EngineEventMap {
  log: { text: string; tone?: string };
  stateChange: { from: FsmState; to: FsmState };
  turnStart: { actorId: string; isBoss: boolean };
  actionStart: { action: ActionInstance };
  actionEnd: { actionId: string };
  hit: {
    eventId: string; sourceId: string; targetId: string; damage: number; element: ElementId;
    crit: boolean; weakness: boolean; resist: boolean; absorbed: boolean; shielded: boolean;
    grade?: Grade | BlockGrade; heal: boolean; overkill: boolean; index: number;
  };
  heal: { targetId: string; amount: number; sourceId: string; inverted: boolean };
  statusChange: { targetId: string; statusId: StatusId; stacks: number; turns: number; removed: boolean };
  apChange: { actorId: string; delta: number; reason: string; ap: number };
  shieldChange: { actorId: string; shield: number; delta: number };
  promptOpen: { eventId: string; at: number; index: number; total: number; kind: 'skill' | 'counter' };
  promptJudged: { eventId: string; grade: Grade; deltaMs: number; index: number };
  defenseOpen: { eventId: string; at: number; index: number; total: number; targetId: string; jump: boolean };
  defenseJudged: { eventId: string; grade: BlockGrade; deltaMs: number; index: number; targetId: string };
  counterOpen: { opensAt: number; closesAt: number };
  counterJudged: { grade: BlockGrade; deltaMs: number };
  counterPerformed: { actorIds: string[]; perfect: boolean };
  bossTelegraph: { moveId: string; name: string; warning: string; hint: string; targetIds: string[]; total: number };
  phaseChange: { phase: number };
  breakChange: { value: number; broken: boolean };
  weakPointBroken: { id: string; name: string };
  death: { actorId: string };
  revive: { actorId: string };
  queueChange: { entries: QueueEntry[] };
  victory: { stats: BattleStats };
  defeat: { stats: BattleStats };
  spam: { until: number };
  aimShot: { hit: boolean; weakPointId: string | null; damage: number };
}

export type EngineEvent = {
  [K in keyof EngineEventMap]: { type: K; payload: EngineEventMap[K]; at: number };
}[keyof EngineEventMap];

export interface LogRecord {
  t: number;
  kind: string;
  data: Record<string, unknown>;
}
