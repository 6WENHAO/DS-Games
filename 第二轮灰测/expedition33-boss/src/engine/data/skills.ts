import type { SkillDef, ActorState, StainId } from '../types';
import type { SkillHooks, SkillRuntime } from '../skillRuntime';

const S = (d: Partial<SkillDef> & Pick<SkillDef, 'id' | 'name' | 'owner' | 'ap' | 'target' | 'desc' | 'longDesc'>): SkillDef => ({
  element: 'physical',
  power: 0,
  hitWeights: [1],
  promptTimes: [],
  hitTimes: [1.0],
  actionDelay: 1.0,
  tags: [],
  breakValue: 0,
  kind: 'attack',
  effects: [],
  ...d,
});

/** 每个角色的基础攻击（3 段 + 2 次连协提示，可追加第 4 段与协同击） */
export const BASIC_ATTACK: SkillDef = S({
  id: 'basic',
  name: '攻击',
  owner: '*',
  ap: 0,
  target: 'enemy',
  element: 'weapon',
  power: 1100,
  hitWeights: [0.3, 0.3, 0.4, 0.35, 0.45],
  promptTimes: [0.72, 1.36],
  hitTimes: [0.8, 1.44, 2.06, 2.6, 3.06],
  actionDelay: 1.0,
  breakValue: 6,
  desc: '3 段武器攻击，赚取行动点',
  longDesc: '3 段武器攻击。0.72s / 1.36s 出现连协提示：第二次 Perfect 追加第 4 段；两次都 Perfect 时再追加一次小型协同击。每段造成生命伤害获得 1 行动点（每次攻击最多 3 点），最后一击的 Perfect 额外 +1。',
});

export const SKILLS: SkillDef[] = [
  // ---------------- 熙艾尔 ----------------
  S({
    id: 'shadow_mark', name: '暗影标记', owner: 'sciel', ap: 3, target: 'enemy', element: 'dark',
    power: 900, hitWeights: [0.45, 0.55], promptTimes: [0.62, 1.16], hitTimes: [0.7, 1.24],
    tags: ['moon'], breakValue: 10,
    desc: '2 段暗影斩，施加 3 层先见与标记',
    longDesc: '对单体造成 2 段暗影伤害，施加 3 层先见与 1 层标记（下一段造成生命伤害的命中 x1.5）。2 次连协提示。属于「月相」标签。',
  }),
  S({
    id: 'phantom_blade', name: '幻影之刃', owner: 'sciel', ap: 6, target: 'enemy', element: 'dark',
    power: 3600, hitWeights: [1], promptTimes: [1.05], hitTimes: [1.15], actionDelay: 1.15,
    tags: ['sun'], breakValue: 25,
    desc: '消耗先见的单体重击',
    longDesc: '消耗目标身上最多 10 层先见，每层使本次伤害 +15%。破防值 +25。连协 Perfect 时追加一段 35% 威力的影刃。属于「旭日」标签，旭日姿态下每消耗 1 层先见返还 1 行动点（最多 4 点）。',
  }),
  S({
    id: 'foretell_gather', name: '先见汇聚', owner: 'sciel', ap: 3, target: 'enemy', element: 'physical',
    power: 700, hitWeights: [1], promptTimes: [0.6], hitTimes: [0.72], tags: ['moon'], breakValue: 8,
    desc: '施加 2 层先见（0 层时改为 5 层）',
    longDesc: '对单体造成物理伤害并施加 2 层先见；若目标当前先见为 0 层，则改为施加 5 层。属于「月相」标签。',
  }),
  S({
    id: 'full_prep', name: '准备万全', owner: 'sciel', ap: 5, target: 'allyAll', element: 'light',
    power: 0, hitWeights: [1], promptTimes: [], hitTimes: [1.0], tags: ['sun'], kind: 'support',
    desc: '全队获得强力、坚壳、迅捷',
    longDesc: '全体友方获得强力（伤害 x1.25）、坚壳（受伤 x0.80）、迅捷（速度 x1.20），各持续 3 个自身回合。属于「旭日」标签。',
  }),
  S({
    id: 'shadow_cleanse', name: '暗影洗涤', owner: 'sciel', ap: 4, target: 'ally', element: 'dark',
    power: 0, hitWeights: [1], promptTimes: [], hitTimes: [0.95], tags: ['moon'], kind: 'support',
    desc: '净化一个负面并扩散增益',
    longDesc: '清除目标身上的倒逆 / 虚弱 / 迟缓 / 着火 之一（按此优先级），并把该目标的正面增益以剩余时间 -1 扩散给全队。属于「月相」标签。',
  }),
  S({
    id: 'fate_intervention', name: '命运干预', owner: 'sciel', ap: 7, target: 'ally', element: 'light',
    power: 0, hitWeights: [1], promptTimes: [], hitTimes: [0.9], tags: ['sun'], kind: 'support',
    desc: '目标立刻插到队首并 +4 AP',
    longDesc: '目标立即被插入行动队列首位，并获得 4 点行动点。同一行动链内同一角色不可再次被命运干预。属于「旭日」标签。',
  }),

  // ---------------- 吕涅 ----------------
  S({
    id: 'immolation', name: '焚身', owner: 'lune', ap: 3, target: 'enemy', element: 'fire',
    power: 800, hitWeights: [1], promptTimes: [0.66], hitTimes: [0.78], breakValue: 8,
    desc: '施加 3 层着火，生成火异色',
    longDesc: '对单体造成火焰伤害并施加 3 层着火；若消费 1 个雷异色，额外施加 2 层。结算后生成 1 个火异色。',
  }),
  S({
    id: 'thermal_conversion', name: '热能转化', owner: 'lune', ap: 3, target: 'enemy', element: 'ice',
    power: 700, hitWeights: [0.5, 0.5], promptTimes: [0.6, 1.1], hitTimes: [0.68, 1.18], breakValue: 8,
    desc: '2 段冰伤，目标着火时返还 4 AP',
    longDesc: '对单体造成 2 段冰霜伤害。若目标处于着火状态，返还 4 点行动点；消费 1 个火异色时伤害 +50%。结算后生成 1 个冰异色。',
  }),
  S({
    id: 'tidal_ice', name: '巨浪成冰', owner: 'lune', ap: 5, target: 'enemyAll', element: 'ice',
    power: 1800, hitWeights: [1], promptTimes: [0.85], hitTimes: [1.0], breakValue: 12,
    desc: '全体冰伤 + 迟缓 2 回合',
    longDesc: '对敌方全体造成冰霜伤害并施加迟缓 2 回合；消费 1 个土异色时伤害 +75%。结算后生成 1 个冰异色。',
  }),
  S({
    id: 'rampage', name: '狂杀', owner: 'lune', ap: 7, target: 'enemy', element: 'dynamic',
    power: 3200, hitWeights: [1], promptTimes: [0.75, 1.23, 1.71, 2.19], hitTimes: [0.85, 1.33, 1.81, 2.29],
    actionDelay: 1.15, breakValue: 15,
    desc: '消耗全部异色，每色一段',
    longDesc: '消耗当前全部异色，每一种异色形成一段对应元素的攻击（1～4 段）。同时消费 4 种不同异色时额外 +45 破防值；最后一次连协 Perfect 额外 +20 破防值。',
  }),
  S({
    id: 'typhoon', name: '台风', owner: 'lune', ap: 7, target: 'field', element: 'ice',
    power: 0, hitWeights: [1], promptTimes: [], hitTimes: [1.2], kind: 'support',
    desc: '延迟光环：每回合冰伤 + 治疗',
    longDesc: '布置台风光环：吕涅每个回合开始时对敌方全体造成 1400 威力冰霜伤害，并治疗全队最大生命 12%，默认持续 3 回合；同时消费火与冰异色时延长至 5 回合。注意：处于倒逆的队员会因治疗受到伤害。',
  }),
  S({
    id: 'rebirth', name: '重生', owner: 'lune', ap: 5, target: 'deadAlly', element: 'light',
    power: 0, hitWeights: [1], promptTimes: [], hitTimes: [1.1], kind: 'revive',
    desc: '复活友方并恢复 50% 生命',
    longDesc: '复活一名已倒下的友方并恢复其最大生命 50%。消费 1 个光异色时行动点消耗降为 3。',
  }),

  // ---------------- 玛埃尔 ----------------
  S({
    id: 'breakthrough', name: '势如破竹', owner: 'maelle', ap: 3, target: 'enemy', element: 'physical',
    power: 800, hitWeights: [0.5, 0.5], promptTimes: [0.6, 1.1], hitTimes: [0.7, 1.2], breakValue: 10,
    desc: '2 段破盾，摧毁护盾返还 AP',
    longDesc: '2 段物理攻击，每段优先移除目标 1 层护盾，每摧毁 1 层返还 1 点行动点。若目标已经破防，玛埃尔额外获得一个回合（每轮最多一次）。',
  }),
  S({
    id: 'stride_wide', name: '大步流星', owner: 'maelle', ap: 3, target: 'enemy', element: 'weapon',
    power: 750, hitWeights: [1], promptTimes: [0.62], hitTimes: [0.74], breakValue: 8,
    desc: '目标着火则进入高手，否则进入攻',
    longDesc: '单体武器元素攻击。若目标处于着火状态则进入「高手」姿态，否则进入「攻」姿态。连协 Miss / Good / Perfect 分别获得 0 / 1 / 2 点行动点。',
  }),
  S({
    id: 'pierce_wind', name: '刺剑如风', owner: 'maelle', ap: 4, target: 'enemyAll', element: 'physical',
    power: 1200, hitWeights: [1], promptTimes: [0.7], hitTimes: [0.85], breakValue: 10,
    desc: '全体物理 + 破绽，结束进入守',
    longDesc: '对敌方全体造成物理伤害并施加破绽 1 回合（防御 x0.75）。动作结束后进入「守」姿态。',
  }),
  S({
    id: 'blooming_slash', name: '剑花怒放', owner: 'maelle', ap: 5, target: 'enemy', element: 'physical',
    power: 2600, hitWeights: [0.32, 0.32, 0.36], promptTimes: [0.68, 1.22], hitTimes: [0.78, 1.32, 1.86],
    actionDelay: 1.15, breakValue: 35,
    desc: '3 段爆发，+35 破防值',
    longDesc: '3 段物理攻击，破防值 +35。第一次连协 Miss 会取消第 3 段；两次提示都 Perfect 时，若原本处于高手姿态则保持高手，否则回到无姿态。',
  }),
  S({
    id: 'sword_dance', name: '剑舞', owner: 'maelle', ap: 9, target: 'enemy', element: 'weapon',
    power: 5200, hitWeights: [0.18, 0.18, 0.2, 0.2, 0.24, 0.28], promptTimes: [0.62, 1.18, 1.86],
    hitTimes: [0.72, 1.28, 1.96, 2.5, 3.0, 3.5], actionDelay: 1.15, breakValue: 20,
    desc: '5 段独立暴击，暴击 x2.0',
    longDesc: '5 段武器元素攻击，每段独立判定暴击且暴击伤害 x2.0。第一次连协 Miss 取消第 4 段，第二次 Miss 取消第 5 段，三次 Perfect 追加第 6 段。结算后离开高手姿态。',
  }),
  S({
    id: 'offensive_shift', name: '进攻转换', owner: 'maelle', ap: 2, target: 'enemy', element: 'weapon',
    power: 650, hitWeights: [1], promptTimes: [0.58], hitTimes: [0.7], breakValue: 6,
    desc: '施加破绽 3 回合并进入攻',
    longDesc: '单体武器元素攻击，施加破绽 3 回合（防御 x0.75）并进入「攻」姿态（造成伤害 x1.50，所受伤害 x1.35）。',
  }),
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(
  [BASIC_ATTACK, ...SKILLS].map((s) => [s.id, s]),
);

export function skillsOf(ownerId: string): SkillDef[] {
  return SKILLS.filter((s) => s.owner === ownerId);
}

/** 动态 AP 消耗（UI 与引擎共用） */
export function effectiveApCost(skill: SkillDef, actor: ActorState): number {
  if (skill.id === 'rebirth' && actor.stains.includes('light')) return 3;
  return skill.ap;
}

const STAIN_ORDER: StainId[] = ['fire', 'ice', 'lightning', 'earth', 'light'];

export const SKILL_HOOKS: Record<string, SkillHooks> = {
  // ---------------- 基础攻击 ----------------
  basic: {
    plan: () => ({ hitCount: 3 }),
    onPrompt: (rt, index, grade) => {
      if (index === 1 && grade === 'perfect') {
        rt.extendHit(0.54, 0.35);
        rt.action.flags.extra4 = true;
        rt.log('连协成功 —— 追加第 4 段', 'perfect');
        if (rt.action.promptResults[0] === 'perfect') {
          rt.extendHit(0.46, 0.45);
          rt.action.flags.coop = true;
          rt.log('全 Perfect —— 队伍协同击', 'perfect');
        }
      }
    },
    onEnd: (rt) => {
      const last = rt.action.promptResults[rt.action.promptResults.length - 1];
      if (last === 'perfect') rt.addAp(rt.actor.id, 1, '基础攻击完美连协');
      const target = rt.primaryTarget;
      if (rt.actor.id === 'sciel' && target) rt.addForetell(target.id, 1);
      if (rt.actor.id === 'lune' && last === 'perfect') rt.addStain('light');
      if (rt.actor.id === 'maelle' && rt.actor.stance === 'none') rt.setStance('defensive');
    },
  },

  // ---------------- 熙艾尔 ----------------
  shadow_mark: {
    onEnd: (rt) => {
      const t = rt.primaryTarget;
      if (!t) return;
      rt.addForetell(t.id, 3);
      rt.applyStatus(t.id, 'mark', 1, 3);
    },
  },
  phantom_blade: {
    plan: (rt) => {
      const t = rt.primaryTarget;
      if (!t) return;
      const cap = rt.actor.phaseTag === 'twilight' ? 20 : 10;
      const used = rt.consumeForetell(t.id, Math.min(10, cap));
      rt.action.consumedForetell = used;
      if (used > 0) rt.log('消耗 ' + used + ' 层先见 —— 伤害 +' + (used * 15) + '%', 'sciel');
      if (rt.actor.phaseTag === 'sun' && used > 0) {
        rt.addAp(rt.actor.id, Math.min(4, used), '旭日：先见返还');
      }
      return { powerMul: 1 + 0.15 * used };
    },
    onPrompt: (rt, index, grade) => {
      if (index === 0 && grade === 'perfect') {
        rt.extendHit(0.5, 0.35);
        rt.action.flags.shadowBlade = true;
        rt.log('影刃追加段！', 'perfect');
      }
    },
  },
  foretell_gather: {
    onEnd: (rt) => {
      const t = rt.primaryTarget;
      if (!t) return;
      const cur = rt.foretellOn(t.id);
      rt.addForetell(t.id, cur === 0 ? 5 : 2);
    },
  },
  full_prep: {
    onHit: (rt) => {
      for (const a of rt.allies()) {
        rt.applyStatus(a.id, 'strong', 1, 3, a.id);
        rt.applyStatus(a.id, 'sturdy', 1, 3, a.id);
        rt.applyStatus(a.id, 'swift', 1, 3, a.id);
      }
      rt.log('准备万全 —— 全队 强力 / 坚壳 / 迅捷', 'buff');
    },
  },
  shadow_cleanse: {
    onHit: (rt) => {
      const t = rt.primaryTarget;
      if (!t) return;
      for (const id of ['inverted', 'weak', 'slow', 'burn'] as const) {
        if (rt.removeStatus(t.id, id)) {
          rt.log('暗影洗涤：清除 ' + id, 'buff');
          break;
        }
      }
      rt.spreadBuffs(t.id);
    },
  },
  fate_intervention: {
    onHit: (rt) => {
      const t = rt.primaryTarget;
      if (!t) return;
      if (rt.insertAtQueueHead(t.id)) {
        rt.addAp(t.id, 4, '命运干预');
        rt.log('命运干预 —— ' + t.name + ' 立刻行动', 'sciel');
      } else {
        rt.log('命运干预无效：该角色本行动链已被干预', 'warn');
      }
    },
  },

  // ---------------- 吕涅 ----------------
  immolation: {
    plan: (rt) => {
      rt.action.flags.boostBurn = rt.consumeStain('lightning');
      return;
    },
    onEnd: (rt) => {
      const t = rt.primaryTarget;
      if (!t) return;
      const stacks = 3 + (rt.action.flags.boostBurn ? 2 : 0);
      rt.applyStatus(t.id, 'burn', stacks, 99);
      rt.addStain('fire');
    },
  },
  thermal_conversion: {
    plan: (rt) => {
      const boosted = rt.consumeStain('fire');
      rt.action.flags.boosted = boosted;
      return { powerMul: boosted ? 1.5 : 1 };
    },
    onStart: (rt) => {
      const t = rt.primaryTarget;
      if (t && rt.hasStatus(t.id, 'burn')) rt.addAp(rt.actor.id, 4, '热能转化：目标着火');
    },
    onEnd: (rt) => rt.addStain('ice'),
  },
  tidal_ice: {
    plan: (rt) => {
      const boosted = rt.consumeStain('earth');
      rt.action.flags.boosted = boosted;
      return { powerMul: boosted ? 1.75 : 1 };
    },
    onEnd: (rt) => {
      for (const e of rt.enemies()) rt.applyStatus(e.id, 'slow', 1, 2, rt.actor.id);
      rt.addStain('ice');
    },
  },
  rampage: {
    plan: (rt) => {
      const stains = [...rt.actor.stains];
      rt.action.consumedStains = stains;
      rt.actor.stains = [];
      const distinct = new Set(stains).size;
      if (distinct >= 4) {
        rt.addBreak(45);
        rt.log('四色狂杀 —— 破防值 +45', 'perfect');
      }
      if (stains.length === 0) {
        rt.log('无异色可消耗 —— 狂杀仅 1 段', 'warn');
        return { hitCount: 1, elements: [rt.actor.weaponElement] };
      }
      const weights = stains.map(() => 1 / stains.length);
      rt.action.weightsOverride = weights;
      return { hitCount: stains.length, elements: stains.map((s) => s as never) };
    },
    onPrompt: (rt, index, grade) => {
      const total = rt.action.consumedStains.length || 1;
      if (index === total - 1 && grade === 'perfect') {
        rt.addBreak(20);
        rt.log('狂杀收招 Perfect —— 破防值 +20', 'perfect');
      }
    },
  },
  typhoon: {
    plan: (rt) => {
      const fire = rt.consumeStain('fire');
      const ice = rt.consumeStain('ice');
      rt.action.flags.longTyphoon = fire && ice;
      return;
    },
    onHit: (rt) => {
      const turns = rt.action.flags.longTyphoon ? 5 : 3;
      rt.applyStatus(rt.actor.id, 'typhoon', 1, turns, rt.actor.id);
      rt.state.typhoonSourceId = rt.actor.id;
      rt.log('台风成形 —— 将在吕涅每个回合开始时触发 ' + turns + ' 次', 'lune');
    },
  },
  rebirth: {
    plan: (rt) => {
      rt.consumeStain('light');
      return;
    },
    onHit: (rt) => {
      const t = rt.primaryTarget;
      if (t) rt.reviveActor(t.id, 0.5);
    },
  },

  // ---------------- 玛埃尔 ----------------
  breakthrough: {
    onHit: (rt, _index, _dealt, absorbed) => {
      if (absorbed) rt.addAp(rt.actor.id, 1, '势如破竹：摧毁护盾');
    },
    onEnd: (rt) => {
      const t = rt.primaryTarget;
      if (t && t.broken && rt.grantExtraTurn(rt.actor.id)) {
        rt.log('势如破竹 —— 玛埃尔额外获得一个回合', 'maelle');
      }
    },
  },
  stride_wide: {
    onPrompt: (rt, _index, grade) => {
      const gain = grade === 'perfect' ? 2 : grade === 'good' ? 1 : 0;
      if (gain > 0) rt.addAp(rt.actor.id, gain, '大步流星连协');
    },
    onEnd: (rt) => {
      const t = rt.primaryTarget;
      if (t && rt.hasStatus(t.id, 'burn')) {
        rt.setStance('virtuose');
        rt.log('目标着火 —— 玛埃尔进入高手姿态', 'maelle');
      } else {
        rt.setStance('offensive');
      }
    },
  },
  pierce_wind: {
    onEnd: (rt) => {
      for (const e of rt.enemies()) rt.applyStatus(e.id, 'vulnerable', 1, 1, rt.actor.id);
      rt.setStance('defensive');
    },
  },
  blooming_slash: {
    onPrompt: (rt, index, grade) => {
      if (index === 0 && grade === 'miss') {
        rt.cancelHit(2);
        rt.log('连协失手 —— 第 3 段取消', 'warn');
      }
    },
    onEnd: (rt) => {
      const [p0, p1] = rt.action.promptResults;
      const bothPerfect = p0 === 'perfect' && p1 === 'perfect';
      if (bothPerfect && rt.actor.stance === 'virtuose') {
        rt.log('剑花怒放全 Perfect —— 保持高手姿态', 'perfect');
      } else {
        rt.setStance('none');
      }
    },
  },
  sword_dance: {
    plan: () => ({ hitCount: 5 }),
    onPrompt: (rt, index, grade) => {
      if (index === 0 && grade === 'miss') {
        rt.cancelHit(3);
        rt.log('剑舞第一次失手 —— 第 4 段取消', 'warn');
      }
      if (index === 1 && grade === 'miss') {
        rt.cancelHit(4);
        rt.log('剑舞第二次失手 —— 第 5 段取消', 'warn');
      }
      if (index === 2) {
        const all = rt.action.promptResults.slice(0, 3).every((g) => g === 'perfect');
        if (all && grade === 'perfect') {
          rt.extendHit(0.5, 0.28);
          rt.action.flags.dance6 = true;
          rt.log('三连 Perfect —— 追加第 6 段！', 'perfect');
        }
      }
    },
    onEnd: (rt) => {
      if (rt.actor.stance === 'virtuose') rt.setStance('none');
    },
  },
  offensive_shift: {
    onEnd: (rt) => {
      const t = rt.primaryTarget;
      if (t) rt.applyStatus(t.id, 'vulnerable', 1, 3, rt.actor.id);
      rt.setStance('offensive');
    },
  },
};

export function stainLabel(s: StainId): string {
  return { fire: '火', ice: '冰', lightning: '雷', earth: '土', light: '光' }[s];
}

export function stainColor(s: StainId): string {
  return { fire: '#ff5a3c', ice: '#6fd9ff', lightning: '#ffd93b', earth: '#7ddb7a', light: '#fff6d8' }[s];
}

export { STAIN_ORDER };
