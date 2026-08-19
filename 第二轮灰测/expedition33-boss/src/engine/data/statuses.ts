import type { StatusDef, StatusId, StatusInstance } from '../types';

const def = (d: StatusDef): StatusDef => d;

export const STATUS_DEFS: Record<StatusId, StatusDef> = {
  burn: def({
    id: 'burn', name: '着火', kind: 'debuff', stacking: 'stacks', maxStacks: 10, tickOn: 'self', icon: '火',
    describe: (s) => '自身回合结束时受到 最大生命 1.2% x ' + s.stacks + ' 的火焰伤害，然后减少 1 层。',
  }),
  mark: def({
    id: 'mark', name: '标记', kind: 'debuff', stacking: 'refresh', maxStacks: 1, tickOn: 'applier', icon: '标',
    describe: () => '下一段造成生命伤害的命中伤害 x1.5，随后移除。被护盾完全吸收时不消耗。',
  }),
  vulnerable: def({
    id: 'vulnerable', name: '破绽', kind: 'debuff', stacking: 'refresh', maxStacks: 1, tickOn: 'applier', icon: '绽',
    describe: () => '防御 x0.75（按施加者回合计时）。',
  }),
  strong: def({
    id: 'strong', name: '强力', kind: 'buff', stacking: 'refresh', maxStacks: 1, tickOn: 'self', icon: '强',
    describe: () => '造成伤害 x1.25。',
  }),
  sturdy: def({
    id: 'sturdy', name: '坚壳', kind: 'buff', stacking: 'refresh', maxStacks: 1, tickOn: 'self', icon: '壳',
    describe: () => '所受伤害 x0.80。',
  }),
  swift: def({
    id: 'swift', name: '迅捷', kind: 'buff', stacking: 'refresh', maxStacks: 1, tickOn: 'self', icon: '迅',
    describe: () => '速度 x1.20，并立即重算尚未执行的下一次行动时间。',
  }),
  slow: def({
    id: 'slow', name: '迟缓', kind: 'debuff', stacking: 'refresh', maxStacks: 1, tickOn: 'self', icon: '迟',
    describe: () => '速度 x0.80。',
  }),
  weak: def({
    id: 'weak', name: '虚弱', kind: 'debuff', stacking: 'refresh', maxStacks: 1, tickOn: 'self', icon: '弱',
    describe: () => '造成伤害 x0.75。',
  }),
  inverted: def({
    id: 'inverted', name: '倒逆', kind: 'debuff', stacking: 'refresh', maxStacks: 1, tickOn: 'self', icon: '逆',
    describe: () => '所有正数治疗转为等量无元素伤害，可以致死。慎用治疗与台风！',
  }),
  typhoon: def({
    id: 'typhoon', name: '台风', kind: 'buff', stacking: 'refresh', maxStacks: 1, tickOn: 'self', icon: '台',
    describe: (s) => '吕涅回合开始时对敌方全体造成冰伤并治疗全队最大生命 12%，剩余 ' + s.turns + ' 次。',
  }),
  broken: def({
    id: 'broken', name: '破防', kind: 'debuff', stacking: 'refresh', maxStacks: 1, tickOn: 'self', icon: '破',
    describe: () => '所受伤害 x1.25，并失去下一次排定行动。',
  }),
  noFireInfuse: def({
    id: 'noFireInfuse', name: '金剑核心破损', kind: 'debuff', stacking: 'refresh', maxStacks: 1, tickOn: 'self', icon: '金',
    describe: (s) => '着火附加能力失效，剩余 ' + s.turns + ' 个 Boss 回合。',
  }),
  defenseUp: def({
    id: 'defenseUp', name: '守势', kind: 'buff', stacking: 'refresh', maxStacks: 1, tickOn: 'self', icon: '守',
    describe: () => '防御 x1.25。',
  }),
};

export function statusName(id: StatusId): string {
  return STATUS_DEFS[id].name;
}

export function describeStatus(s: StatusInstance): string {
  return STATUS_DEFS[s.id].describe(s);
}
