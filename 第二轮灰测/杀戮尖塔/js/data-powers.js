/* ============================================================
   data-powers.js —— 能力 / 状态（Buff & Debuff）定义
   kind: buff | debuff
   turnBased: 回合结束时层数 -1
   ============================================================ */
'use strict';

const POWERS = {
  /* ---------- 通用增益 ---------- */
  strength: { name: '力量', kind: 'buff', desc: n => `攻击造成的伤害增加 ${n} 点。` },
  dexterity: { name: '敏捷', kind: 'buff', desc: n => `卡牌产生的格挡增加 ${n} 点。` },
  artifact: { name: '神器', kind: 'buff', desc: n => `抵消接下来 ${n} 次负面效果。` },
  thorns: { name: '尖刺', kind: 'buff', desc: n => `受到攻击时，对攻击者造成 ${n} 点伤害。` },
  metallicize: { name: '金属化', kind: 'buff', desc: n => `回合结束时获得 ${n} 点格挡。` },
  platedArmor: { name: '镀甲', kind: 'buff', desc: n => `回合结束时获得 ${n} 点格挡。受到未被格挡的攻击伤害时层数 -1。` },
  barricade: { name: '壁垒', kind: 'buff', desc: () => `回合开始时格挡不再消失。` },
  regen: { name: '再生', kind: 'buff', turnBased: true, desc: n => `回合结束时回复 ${n} 点生命，之后层数 -1。` },
  intangible: { name: '无形', kind: 'buff', turnBased: true, desc: n => `接下来 ${n} 回合内，所有受到的伤害降为 1。` },
  buffer: { name: '缓冲', kind: 'buff', desc: n => `抵消接下来 ${n} 次生命值降低。` },
  vigor: { name: '气势', kind: 'buff', desc: n => `下一张攻击牌额外造成 ${n} 点伤害。` },

  /* ---------- 通用减益 ---------- */
  vulnerable: { name: '易伤', kind: 'debuff', turnBased: true, desc: n => `受到的攻击伤害增加 50%，持续 ${n} 回合。` },
  weak: { name: '虚弱', kind: 'debuff', turnBased: true, desc: n => `造成的攻击伤害降低 25%，持续 ${n} 回合。` },
  frail: { name: '脆弱', kind: 'debuff', turnBased: true, desc: n => `获得的格挡降低 25%，持续 ${n} 回合。` },
  poison: { name: '中毒', kind: 'debuff', desc: n => `回合开始时失去 ${n} 点生命，之后层数 -1。` },
  entangled: { name: '缠绕', kind: 'debuff', turnBased: true, desc: () => `本回合无法打出攻击牌。` },
  noDraw: { name: '无法抽牌', kind: 'debuff', turnBased: true, desc: () => `本回合无法抽牌。` },
  strengthDown: { name: '力量流失', kind: 'debuff', turnBased: true, desc: n => `回合结束时失去 ${n} 点力量。` },
  dexterityDown: { name: '敏捷流失', kind: 'debuff', turnBased: true, desc: n => `回合结束时失去 ${n} 点敏捷。` },

  /* ---------- 铁甲战士能力牌 ---------- */
  demonForm: { name: '恶魔形态', kind: 'buff', desc: n => `每回合开始时获得 ${n} 点力量。` },
  inflame: { name: '燃烧', kind: 'buff', desc: n => `力量 +${n}。` },
  combust: { name: '自燃', kind: 'buff', desc: n => `回合结束时失去 1 点生命，并对所有敌人造成 ${n} 点伤害。` },
  darkEmbrace: { name: '黑暗拥抱', kind: 'buff', desc: n => `每当一张卡牌被消耗时，抽 ${n} 张牌。` },
  evolve: { name: '进化', kind: 'buff', desc: n => `每当你抽到一张状态牌时，抽 ${n} 张牌。` },
  feelNoPain: { name: '无痛', kind: 'buff', desc: n => `每当一张卡牌被消耗时，获得 ${n} 点格挡。` },
  fireBreathing: { name: '吐火', kind: 'buff', desc: n => `每当你抽到一张状态牌或诅咒牌时，对所有敌人造成 ${n} 点伤害。` },
  juggernaut: { name: '主宰', kind: 'buff', desc: n => `每当你获得格挡时，对随机敌人造成 ${n} 点伤害。` },
  rupture: { name: '破裂', kind: 'buff', desc: n => `每当你因卡牌失去生命时，获得 ${n} 点力量。` },
  brutality: { name: '残暴', kind: 'buff', desc: n => `回合开始时失去 ${n} 点生命，抽 ${n} 张牌。` },
  berserk: { name: '狂战士', kind: 'buff', desc: n => `每回合开始时额外获得 ${n} 点能量。` },
  corruption: { name: '腐化', kind: 'buff', desc: () => `技能牌的费用变为 0，但打出后被消耗。` },
  doubleTap: { name: '双重叩击', kind: 'buff', desc: n => `接下来的 ${n} 张攻击牌打出两次。` },
  flameBarrier: { name: '烈焰屏障', kind: 'buff', desc: n => `受到攻击时对攻击者造成 ${n} 点伤害，回合结束时消失。` },
  rage: { name: '暴怒', kind: 'buff', desc: n => `本回合每打出一张攻击牌，获得 ${n} 点格挡。` },
  pen_nib_p: { name: '笔尖', kind: 'buff', desc: () => `下一张攻击牌造成双倍伤害。` },

  /* ---------- 敌人专属 ---------- */
  ritual: { name: '仪式', kind: 'buff', desc: n => `回合结束时获得 ${n} 点力量。` },
  curlUp: { name: '卷曲', kind: 'buff', desc: n => `第一次受到攻击伤害时，获得 ${n} 点格挡。` },
  angry: { name: '愤怒', kind: 'buff', desc: n => `每次受到攻击伤害时获得 ${n} 点力量。` },
  sporeCloud: { name: '孢子云', kind: 'buff', desc: n => `死亡时给予你 ${n} 层易伤。` },
  enrage: { name: '激怒', kind: 'buff', desc: n => `每当你打出一张技能牌，获得 ${n} 点力量。` },
  modeShift: { name: '模式切换', kind: 'buff', desc: n => `再受到 ${n} 点伤害后进入防御模式。` },
  sharpHide: { name: '锋利硬皮', kind: 'buff', desc: n => `每当你打出攻击牌，受到 ${n} 点伤害。` },
  asleep: { name: '沉睡', kind: 'buff', desc: () => `处于沉睡状态，受到伤害后会被唤醒。` },
  splitP: { name: '分裂', kind: 'buff', desc: () => `生命值降至一半以下时会分裂。` },
  painfulStabs: { name: '痛苦之刺', kind: 'buff', desc: () => `此敌人造成未格挡伤害时，将一张伤口置入你的弃牌堆。` },
  minion: { name: '仆从', kind: 'buff', desc: () => `此敌人为仆从。` }
};

function powerName(id) { return (POWERS[id] && POWERS[id].name) || id; }
function powerKind(id) { return (POWERS[id] && POWERS[id].kind) || 'buff'; }
function powerDesc(id, n) {
  const p = POWERS[id];
  if (!p) return '';
  try { return p.desc(n); } catch (e) { return ''; }
}
