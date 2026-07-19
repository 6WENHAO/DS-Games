// ==== 卡牌 / 随从 / 英雄 DOM 构建 ====
import { getCard } from '../data/cards.js';

const FRAMES = 'assets/frames';
const ICONS = 'assets/cards/raw';

export function el(tag, cls, parent) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
}

const RARITY_COLOR = {
  free: null,
  common: '#e8e8e8',
  rare: '#2f7fe8',
  epic: '#a335ee',
};

function gem(cls, src, value, parent) {
  const g = el('div', `gem ${cls}`, parent);
  const img = el('img', null, g);
  img.src = src;
  const s = el('span', null, g);
  s.textContent = value;
  return g;
}

// 完整卡牌（手牌 / 预览 / 展示）
export function cardDOM(cardId) {
  const card = getCard(cardId);
  const root = el('div', `card type-${card.type}`);
  root.dataset.cardId = card.id;

  const art = el('div', 'art', root);
  art.style.background = `radial-gradient(ellipse at 50% 35%, ${card.tint} 0%, #0d0906 92%)`;
  const icon = el('img', null, art);
  icon.src = `${ICONS}/${card.icon}.svg`;

  const name = el('div', 'name', root);
  const ribbon = el('img', 'ribbon-bg', name);
  ribbon.src = `${FRAMES}/ribbon.svg`;
  const nameText = el('span', null, name);
  nameText.textContent = card.name;

  const rarityColor = RARITY_COLOR[card.rarity];
  if (rarityColor) {
    const r = el('div', 'rarity', root);
    r.style.background = `radial-gradient(circle at 35% 30%, #ffffff 8%, ${rarityColor} 46%, #05030a 100%)`;
  }

  const tb = el('div', 'text-box', root);
  const tbs = el('span', null, tb);
  tbs.textContent = card.text || '';

  gem('cost', `${FRAMES}/gem_mana.svg`, card.cost, root);
  if (card.type === 'minion') {
    gem('atk', `${FRAMES}/gem_attack.svg`, card.atk, root);
    gem('hp', `${FRAMES}/gem_health.svg`, card.hp, root);
  }
  return root;
}

// 战场随从
export function minionDOM(snap) {
  const root = el('div', 'minion');
  root.dataset.entityId = snap.id;
  if (snap.cardId) root.dataset.cardId = snap.cardId;

  const body = el('div', 'body', root);
  body.style.background = `radial-gradient(ellipse at 42% 30%, ${snap.tint} 0%, #100b06 95%)`;
  const icon = el('img', null, body);
  icon.src = `${ICONS}/${snap.icon}.svg`;

  const atk = el('div', 'stat atk', root);
  const ai = el('img', null, atk); ai.src = `${FRAMES}/gem_attack.svg`;
  el('span', null, atk).textContent = snap.atk;

  const hp = el('div', 'stat hp', root);
  const hi = el('img', null, hp); hi.src = `${FRAMES}/gem_health.svg`;
  el('span', null, hp).textContent = snap.hp;

  const zzz = el('img', 'zzz', root);
  zzz.src = `${ICONS}/sleep.svg`;

  updateMinionDOM(root, snap);
  return root;
}

export function updateMinionDOM(root, snap) {
  root.classList.toggle('taunt', !!snap.taunt);
  root.classList.toggle('divine-shield', !!snap.divineShield);
  const zzz = root.querySelector('.zzz');
  zzz.style.display = snap.sleeping ? '' : 'none';
  const atkSpan = root.querySelector('.stat.atk span');
  const hpSpan = root.querySelector('.stat.hp span');
  atkSpan.textContent = snap.atk;
  hpSpan.textContent = snap.hp;
  hpSpan.classList.toggle('damaged-stat', snap.hp < snap.maxHp);
}

// 英雄
export function heroDOM(hero, powerDef) {
  const root = el('div', 'hero');
  root.dataset.entityId = hero.id;

  const ring = el('div', 'portrait-ring', root);
  const portrait = el('div', 'portrait', root);
  portrait.style.background = `radial-gradient(ellipse at 45% 32%, ${hero.tint} 0%, #0d0906 95%)`;
  const img = el('img', null, portrait);
  img.src = `${ICONS}/${hero.icon}.svg`;

  const atk = el('div', 'stat atk', root);
  const ai2 = el('img', null, atk); ai2.src = `${FRAMES}/gem_attack.svg`;
  el('b', null, atk).textContent = '0';

  const hp = el('div', 'stat hp', root);
  const hi2 = el('img', null, hp); hi2.src = `${FRAMES}/gem_health.svg`;
  el('b', null, hp).textContent = hero.hp;

  const armor = el('div', 'stat armor', root);
  const ar = el('img', null, armor); ar.src = `${FRAMES}/gem_armor.svg`;
  el('b', null, armor).textContent = '0';

  const plate = el('div', 'hero-name-plate', root);
  plate.textContent = hero.name;

  updateHeroDOM(root, hero);
  return root;
}

export function updateHeroDOM(root, hero) {
  const atkEl = root.querySelector('.stat.atk');
  const totalAtk = hero.atk + hero.tempAtk;
  atkEl.style.display = totalAtk > 0 ? '' : 'none';
  atkEl.querySelector('b').textContent = totalAtk;
  const hpB = root.querySelector('.stat.hp b');
  hpB.textContent = hero.hp;
  hpB.classList.toggle('damaged-stat', hero.hp < hero.maxHp);
  const armorEl = root.querySelector('.stat.armor');
  armorEl.style.display = hero.armor > 0 ? '' : 'none';
  armorEl.querySelector('b').textContent = hero.armor;
}

// 英雄技能按钮
export function heroPowerDOM(powerDef) {
  const root = el('div', 'hero-power');
  root.title = `${powerDef.name}：${powerDef.text}`;
  const ring = el('div', 'ring', root);
  const ri = el('img', null, ring); ri.src = `${FRAMES}/power_ring.svg`;
  const pi = el('div', 'picon', root);
  const pimg = el('img', null, pi); pimg.src = `${ICONS}/${powerDef.icon}.svg`;
  const cost = el('div', 'gem cost', root);
  cost.className = 'cost';
  const ci = el('img', null, cost); ci.src = `${FRAMES}/gem_mana.svg`;
  ci.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  const cs = el('span', null, cost);
  cs.textContent = powerDef.cost;
  cs.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-weight:bold;color:#fff;font-size:15px;text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000;';
  return root;
}

// 卡背
export function cardBackDOM() {
  const root = el('div', 'card-back');
  const img = el('img', null, root);
  img.src = `${ICONS}/card_back.svg`;
  return root;
}
