/* ============================================================
   render-combat.js —— 战斗界面渲染 + 手牌交互（拖拽出牌 / 目标箭头）
   ============================================================ */
'use strict';

/* 实体 DOM 索引 */
const EL = { entities: {}, handCards: {} };

/* 关键词提示 */
const KEYWORDS = {
  '消耗': '打出后该牌将被移出本场战斗（进入消耗堆）。',
  '虚无': '若回合结束时该牌还在你手中，它会被消耗。',
  '固有': '战斗开始时，该牌必定在你的起始手牌中。',
  '易伤': '受到的攻击伤害增加 50%。',
  '虚弱': '造成的攻击伤害降低 25%。',
  '脆弱': '获得的格挡降低 25%。',
  '力量': '每层使攻击牌造成的伤害 +1。',
  '敏捷': '每层使卡牌产生的格挡 +1。',
  '格挡': '在回合开始时清零（除非拥有壁垒）。可抵挡伤害。',
  '能量': '每回合的行动资源，回合开始时恢复。',
  '升级': '强化一张卡牌的效果。',
  '伤口': '无法打出的状态牌。',
  '燃烧': '无法打出，回合结束时受到伤害。',
  '眩晕': '无法打出的虚无状态牌。',
  '黏液': '费用为 1 的技能牌，打出后被消耗。',
  '中毒': '回合开始时按层数失去生命，然后层数 -1。',
  '尖刺': '受到攻击时反弹伤害给攻击者。',
  '神器': '抵消一次负面效果。',
  '仪式': '回合结束时获得力量。'
};

/* ============================================================
   顶部信息栏
   ============================================================ */
function renderTopbar() {
  if (!S) return;
  $('#topbar').classList.remove('hidden');
  $('#char-portrait').innerHTML = SVG.portrait();
  const hp = CB && !CB.over ? CB.player.hp : S.hp;
  const maxHp = S.maxHp;
  const bar = $('#hp-bar');
  bar.querySelector('.hp-fill').style.width = clamp(hp / maxHp * 100, 0, 100) + '%';
  bar.querySelector('.hp-text').textContent = hp + ' / ' + maxHp;
  $('#gold-text').textContent = S.gold;
  $('#floor-text').textContent = S.floor;

  /* 遗物 */
  const rb = clear($('#relic-bar'));
  S.relics.forEach(id => {
    const r = RELICS[id];
    if (!r) return;
    const d = el('div', 'relic-slot');
    d.dataset.relic = id;
    d.innerHTML = relicIconHtml(id);
    bindTip(d, () => `<div class="tt-title">${r.name}</div>
      <div class="tt-sub">${r.en || ''} · ${{ starter: '起始', common: '普通', uncommon: '罕见', rare: '稀有', boss: 'BOSS', shop: '商店', special: '特殊' }[r.rarity] || ''}遗物</div>
      <div>${r.desc}</div>${r.flavor ? `<div class="tt-flavor">"${r.flavor}"</div>` : ''}`);
    rb.appendChild(d);
  });

  /* 药水 */
  const pb = clear($('#potion-bar'));
  for (let i = 0; i < S.potionSlots; i++) {
    const id = S.potions[i];
    const d = el('div', 'potion-slot' + (id ? ' filled' : ''));
    if (id) {
      const p = POTIONS[id];
      d.innerHTML = SVG.potionIcon(p.color, p.shape);
      bindTip(d, () => `<div class="tt-title">${p.name}</div>
        <div class="tt-sub">药水</div><div>${p.desc}</div>
        <div class="tt-kw tiny dim">左键使用 / 右键丢弃</div>`);
      d.addEventListener('click', () => usePotion(i));
      d.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        if (confirm('丢弃 ' + p.name + '？')) { S.potions[i] = null; renderTopbar(); }
      });
    } else {
      d.innerHTML = '<span class="tiny dim">空</span>';
    }
    pb.appendChild(d);
  }
}

/* ============================================================
   战斗场景
   ============================================================ */
function renderCombat() {
  if (!CB) return;
  renderTopbar();
  const pslot = $('#player-slot');
  const eslot = $('#enemy-slots');

  /* 玩家 */
  if (!EL.entities[CB.player.uid || 'p']) {
    clear(pslot);
    const n = combatantEl(CB.player, { player: true });
    pslot.appendChild(n);
    EL.entities['p'] = n;
    CB.player.uid = 'p';
  }
  updateCombatant(EL.entities['p'], CB.player, { player: true });

  /* 敌人：按需增删，其余原地更新（避免打断动画） */
  const list = CB.enemies.filter(e => !e.removed);
  const domUids = $$('.combatant', eslot).map(n => n.dataset.uid);
  const wantUids = list.map(e => String(e.uid));
  if (domUids.join(',') !== wantUids.join(',')) {
    clear(eslot);
    list.forEach(e => {
      const n = combatantEl(e, {});
      EL.entities[e.uid] = n;
      eslot.appendChild(n);
    });
  }
  list.forEach(e => {
    const n = EL.entities[e.uid];
    if (n) updateCombatant(n, e, {});
  });

  renderHud();
}

function combatantEl(en, opts) {
  const d = el('div', 'combatant');
  d.dataset.uid = en.uid;

  if (!opts.player) d.appendChild(el('div', 'intent'));

  const body = el('div', 'body');
  let svg, w, h;
  if (opts.player) {
    svg = SVG.ironclad(); w = 210; h = 273;
  } else {
    svg = SVG.enemy(en.art, en.artParam);
    const sc = Math.min(1, 300 / en.h);
    w = Math.round(en.w * sc); h = Math.round(en.h * sc);
  }
  body.innerHTML = svg;
  const sv = body.querySelector('svg');
  sv.setAttribute('width', w); sv.setAttribute('height', h);
  d._artKey = en.art + '|' + en.artParam;
  d.appendChild(body);
  d.appendChild(el('div', 'target-ring'));

  const bars = el('div', 'cmb-bars');
  bars.appendChild(el('div', 'cmb-name', opts.player ? '' : en.name));
  const row = el('div', 'bar-row');
  const bb = el('div', 'block-badge');
  bb.innerHTML = SVG.blockShield() + '<span>0</span>';
  bindTip(bb, () => `<div class="tt-title">格挡 ${en.block}</div><div>可抵挡等量伤害，回合开始时清零。</div>`);
  row.appendChild(bb);
  const hb = el('div', 'hpbar small');
  hb.innerHTML = `<div class="hp-fill"></div><div class="hp-flash"></div><div class="hp-text"></div>`;
  row.appendChild(hb);
  bars.appendChild(row);
  bars.appendChild(el('div', 'power-row'));
  d.appendChild(bars);

  if (!opts.player) {
    d.addEventListener('click', () => { if (en.hp > 0 && !en.escaped) onEnemyClick(en); });
    d.addEventListener('mouseenter', () => { HAND.hoverEnemy = en; });
    d.addEventListener('mouseleave', () => { if (HAND.hoverEnemy === en) HAND.hoverEnemy = null; });
  }
  return d;
}

function updateCombatant(d, en, opts) {
  if (!d) return;
  /* 注意：必须转成真正的布尔值 —— classList.toggle 的第二参数为 undefined 时会退化为“翻转” */
  const dead = !!(en.hp <= 0 || en.escaped);
  d.classList.toggle('dead', dead);
  if (!opts.player) d.classList.toggle('targetable', !dead);

  /* 形象变化（拉加维林苏醒 / 守卫者切换模式） */
  const key = en.art + '|' + en.artParam;
  if (!opts.player && d._artKey !== key) {
    d._artKey = key;
    const body = d.querySelector('.body');
    const old = body.querySelector('svg');
    const w = old.getAttribute('width'), h = old.getAttribute('height');
    body.innerHTML = SVG.enemy(en.art, en.artParam);
    const sv = body.querySelector('svg');
    sv.setAttribute('width', w); sv.setAttribute('height', h);
  }

  /* 血条 / 格挡 */
  const hb = d.querySelector('.hpbar');
  hb.querySelector('.hp-fill').style.width = clamp(en.hp / en.maxHp * 100, 0, 100) + '%';
  hb.querySelector('.hp-text').textContent = en.hp + ' / ' + en.maxHp;
  const bb = d.querySelector('.block-badge');
  bb.classList.toggle('on', en.block > 0);
  bb.querySelector('span').textContent = en.block;

  /* 意图 */
  if (!opts.player) {
    const it = d.querySelector('.intent');
    const sig = dead ? 'dead' : intentSig(en);
    if (it._sig !== sig) {
      it._sig = sig;
      it.innerHTML = dead ? '' : intentHtml(en);
      if (!dead && en.move) {
        const mv = en.move;
        bindTip(it, () => {
          let base = mv.dmg; if (mv.dmgFn) base = mv.dmgFn(en);
          const dmgTxt = base != null
            ? '：造成 ' + calcAttackDamage(en, CB.player, base, {}) + ' 点伤害' + (mv.hits > 1 ? ' ×' + mv.hits : '')
            : '';
          return `<div class="tt-title">${intentName(mv.intent)}</div><div>${mv.name}${dmgTxt}</div>`;
        }, { anchor: 'above' });
      }
    }
  }

  /* 状态图标 */
  const pr = d.querySelector('.power-row');
  const psig = Object.keys(en.powers).map(k => k + ':' + en.powers[k]).join(',');
  if (pr._sig !== psig) {
    pr._sig = psig;
    clear(pr);
    Object.keys(en.powers).forEach(id => {
      const n = en.powers[id];
      if (!n) return;
      const chip = el('div', 'power-chip');
      const showVal = n !== 1 || id === 'strength' || id === 'dexterity';
      chip.innerHTML = SVG.powerIcon(id, powerKind(id)) + (showVal ? `<span class="pv">${n}</span>` : '');
      bindTip(chip, () => `<div class="tt-title">${powerName(id)} ${n}</div><div>${powerDesc(id, n)}</div>`,
        { anchor: 'above' });
      pr.appendChild(chip);
    });
  }
}

function intentSig(e) {
  const mv = e.move;
  if (!mv) return 'none';
  let base = mv.dmg;
  if (mv.dmgFn) base = mv.dmgFn(e);
  const v = base != null ? calcAttackDamage(e, CB.player, base, {}) : '-';
  return mv.intent + '|' + v + '|' + (mv.hits || 1);
}

function intentHtml(e) {
  const mv = e.move;
  if (!mv) return SVG.intent('unknown');
  let base = mv.dmg;
  if (mv.dmgFn) base = mv.dmgFn(e);
  let html = SVG.intent(mv.intent);
  if (base !== undefined && base !== null) {
    const v = calcAttackDamage(e, CB.player, base, {});
    html += `<span class="dmg">${v}</span>`;
    if (mv.hits && mv.hits > 1) html += `<span class="hits">×${mv.hits}</span>`;
  }
  return html;
}
function intentName(t) {
  return {
    attack: '攻击', defend: '防御', buff: '增益', debuff: '减益',
    attackDebuff: '攻击 + 减益', attackBuff: '攻击 + 增益', attackDefend: '攻击 + 防御',
    sleep: '沉睡', stun: '眩晕', escape: '逃跑', unknown: '未知'
  }[t] || '未知';
}

/* ============================================================
   HUD
   ============================================================ */
function renderHud() {
  if (!CB) return;
  $('#energy-orb').innerHTML = SVG.energyOrb();
  $('#energy-text').textContent = CB.energy + '/' + CB.energyMax;
  $('#pile-draw').querySelector('.pile-count').textContent = CB.drawPile.length;
  $('#pile-discard').querySelector('.pile-count').textContent = CB.discardPile.length;
  $('#pile-exhaust').querySelector('.pile-count').textContent = CB.exhaustPile.length;
}
function updateEndTurnButton(enemyTurn) {
  const b = $('#btn-end-turn');
  b.classList.toggle('enemyTurn', !!enemyTurn);
  b.querySelector('.et-sub').textContent = enemyTurn ? '敌人行动中…' : '（E）';
}
function pulseEnergy() {
  const n = $('#energy-panel');
  n.classList.remove('spend'); void n.offsetWidth; n.classList.add('spend');
}
function showTurnBanner(text) {
  const b = $('#turn-banner');
  b.textContent = text;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function showEnemyMoveName(e, name) {
  const node = EL.entities[e.uid];
  if (!node) return;
  const r = stageRect(node);
  floatNum(r.x + r.w / 2, r.y - 10, name, 'buff');
}

/* ============================================================
   动画辅助
   ============================================================ */
function entityRect(en) {
  const node = EL.entities[en.uid];
  if (!node) return { x: 800, y: 400, w: 100, h: 100 };
  const b = node.querySelector('.body') || node;
  return stageRect(b);
}
function floatOn(en, text, kind) {
  if (!en) return;
  const r = entityRect(en);
  floatNum(r.x + r.w / 2 + ri(-16, 16), r.y + r.h * 0.42, text, kind);
}
function shakeOn(en) {
  const node = EL.entities[en.uid];
  if (!node) return;
  node.classList.remove('hurt'); void node.offsetWidth; node.classList.add('hurt');
  const hb = node.querySelector('.hpbar');
  if (hb) { hb.classList.remove('dmg'); void hb.offsetWidth; hb.classList.add('dmg'); }
}
function lungeAt(en, dir) {
  const node = EL.entities[en.uid];
  if (!node) return;
  const cls = dir === 'right' ? 'lungeR' : 'lunge';
  node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
}
function slashOn(en) {
  const r = entityRect(en);
  slashAt(r.x + r.w / 2, r.y + r.h * 0.45, '#ffd9c0');
}
function markDead(en) {
  const node = EL.entities[en.uid];
  if (node) node.classList.add('dead');
}

/* ============================================================
   卡牌 DOM
   ============================================================ */
function cardF(card, target) {
  const d = CARDS[card.id];
  const opts = {};
  if (d.strMult !== undefined) opts.strMult = V(card, 'strMult');
  const inCombat = CB && !CB.over;
  return {
    d: (base) => {
      if (!inCombat) return '<b>' + base + '</b>';
      const t = target || A.aliveEnemies()[0];
      if (!t) return '<b>' + base + '</b>';
      const v = calcAttackDamage(CB.player, t, base, opts);
      const cls = v > base ? 'up' : (v < base ? 'dn' : '');
      return '<b class="' + cls + '">' + v + '</b>';
    },
    b: (base) => {
      if (!inCombat) return '<b>' + base + '</b>';
      const p = CB.player;
      let v = base + (p.powers.dexterity || 0);
      if (p.powers.frail) v = Math.floor(v * 0.75);
      v = Math.max(0, v);
      const cls = v > base ? 'up' : (v < base ? 'dn' : '');
      return '<b class="' + cls + '">' + v + '</b>';
    },
    n: (v) => '<b>' + v + '</b>'
  };
}

function cardHtml(card, opts) {
  opts = opts || {};
  const d = CARDS[card.id];
  const type = d.type;
  const color = SVG.TYPE_COLOR[type] ? SVG.TYPE_COLOR[type][0] : '#888';
  const cost = cardCost(card);
  const F = cardF(card, opts.target);
  let descText = '';
  try { descText = d.desc(card, F); } catch (e) { descText = ''; }
  const extra = [];
  if (cardIsInnate(card)) extra.push('固有');
  if (cardIsEthereal(card)) extra.push('虚无');
  if (cardIsExhaust(card) && !/消耗/.test(descText)) extra.push('消耗');
  const desc = fmt(descText) + (extra.length ? '<br><span class="kw">' + extra.join('。') + '。</span>' : '');

  return `<div class="card-inner">
    <div class="c-frame">${SVG.cardFrame(type, d.rarity, !!card.upgraded)}</div>
    <div class="c-art">${SVG.cardArt(d.art || 'slash', color)}</div>
    ${cost >= -1 ? `<div class="c-cost">${SVG.costOrb(cost === -1 ? 'x' : null)}<span>${cost === -1 ? 'X' : cost}</span></div>` : ''}
    <div class="c-name">${cardName(card)}</div>
    <div class="c-type">${cardTypeName(type)}</div>
    <div class="c-desc"><div class="c-desc-in">${desc}</div></div>
  </div><div class="c-glow"></div>`;
}

/* ---------- 卡面文字自适应：过长的描述自动缩小字号直到放得下 ---------- */
let _fitPending = false;
function scheduleFitCardText() {
  if (_fitPending) return;
  _fitPending = true;
  requestAnimationFrame(() => { _fitPending = false; fitAllCardText(); });
}
function fitAllCardText() {
  $$('.c-desc-in').forEach(inner => {
    if (inner.dataset.fit === '1') return;
    const box = inner.parentNode;
    if (!box || !box.clientHeight) return;
    inner.dataset.fit = '1';
    inner.style.fontSize = '';
    const base = parseFloat(getComputedStyle(inner).fontSize) || 12;
    let size = base, guard = 0;
    while (inner.scrollHeight > box.clientHeight + 0.5 && size > base * 0.6 && guard++ < 16) {
      size -= 0.4;
      inner.style.fontSize = size.toFixed(2) + 'px';
    }
  });
}

function cardTipHtml(card) {
  const d = CARDS[card.id];
  const F = cardF(card, null);
  let descText = '';
  try { descText = d.desc(card, F); } catch (e) { }
  const kws = Object.keys(KEYWORDS).filter(k => descText.indexOf(k) >= 0 || (k === '消耗' && cardIsExhaust(card)) || (k === '虚无' && cardIsEthereal(card)));
  return `<div class="tt-title">${cardName(card)}</div>
    <div class="tt-sub">${cardRarityName(d.rarity)} · ${cardTypeName(d.type)}${d.en ? ' · ' + d.en : ''}</div>
    <div>${fmt(descText)}</div>
    ${kws.length ? '<div class="tt-kw">' + kws.map(k => `<b>${k}</b>：${KEYWORDS[k]}`).join('<br>') + '</div>' : ''}`;
}

/* 生成一个静态展示用卡牌节点 */
function makeCardNode(card, cls) {
  const n = el('div', 'grid-card ' + (cls || ''));
  n.innerHTML = cardHtml(card);
  bindTip(n, () => cardTipHtml(card), { anchor: 'rightside' });
  scheduleFitCardText();
  return n;
}

/* ============================================================
   手牌渲染 + 交互
   ============================================================ */
const HAND = {
  drag: null, selected: null, hoverEnemy: null, potionTarget: null
};

function renderHand() {
  if (!CB) return;
  const hand = $('#hand');
  const existing = {};
  $$('.card', hand).forEach(n => { existing[n.dataset.uid] = n; });

  /* 移除不存在的 */
  Object.keys(existing).forEach(u => {
    if (!CB.hand.some(c => String(c.uid) === u)) existing[u].remove();
  });

  CB.hand.forEach((card) => {
    let node = existing[card.uid];
    if (!node) {
      node = el('div', 'card no-anim');
      node.dataset.uid = card.uid;
      node.innerHTML = cardHtml(card);
      hand.appendChild(node);
      bindCardEvents(node, card);
      requestAnimationFrame(() => node.classList.remove('no-anim'));
    } else {
      node.innerHTML = cardHtml(card);
    }
    node._card = card;
    const playable = canPlayCard(card);
    node.classList.toggle('unplayable', !playable);
    node.classList.toggle('playable', !!(playable && CARDS[card.id].type === 'power'));
  });
  layoutHand();
  scheduleFitCardText();
}

function layoutHand() {
  const cards = $$('.card', $('#hand'));
  const n = cards.length;
  if (!n) return;
  const spacing = n <= 5 ? 168 : Math.max(72, Math.min(168, 850 / n));
  const angStep = Math.min(5.2, 34 / Math.max(1, n));
  cards.forEach((node, i) => {
    if (node === (HAND.drag && HAND.drag.node)) return;
    const off = i - (n - 1) / 2;
    const x = off * spacing;
    const ang = off * angStep;
    const y = Math.abs(off) * Math.abs(off) * 2.6 - 68;
    node.style.zIndex = 10 + i;
    if (node.classList.contains('hovered')) {
      node.style.transform = `translate(${x}px, ${y - 62}px) rotate(0deg) scale(1.16)`;
      node.style.zIndex = 200;
    } else if (node === HAND.selected) {
      node.style.transform = `translate(${x}px, ${y - 40}px) rotate(0deg) scale(1.06)`;
      node.style.zIndex = 190;
    } else {
      node.style.transform = `translate(${x}px, ${y}px) rotate(${ang}deg)`;
    }
  });
}

function bindCardEvents(node, card) {
  node.addEventListener('mouseenter', () => {
    if (HAND.drag) return;
    node.classList.add('hovered');
    layoutHand();
    const r = stageRect(node);
    TIP.show(cardTipHtml(card), r.x + 210, r.y - 30, {});
  });
  node.addEventListener('mouseleave', () => {
    node.classList.remove('hovered');
    layoutHand();
    TIP.hide();
  });
  node.addEventListener('pointerdown', (ev) => {
    if (CB.over || CB.busy) return;
    ev.preventDefault();
    const c = node._card;
    if (!canPlayCard(c)) { flashUnplayable(node, c); return; }
    const p = stagePoint(ev.clientX, ev.clientY);
    HAND.drag = { node: node, card: c, startX: p.x, startY: p.y, moved: false };
    node.classList.add('dragging');
    node.classList.remove('hovered');
    TIP.hide();
    try { node.setPointerCapture(ev.pointerId); } catch (e) { }
  });
  node.addEventListener('pointermove', (ev) => {
    if (!HAND.drag || HAND.drag.node !== node) return;
    const p = stagePoint(ev.clientX, ev.clientY);
    const dx = p.x - HAND.drag.startX, dy = p.y - HAND.drag.startY;
    if (!HAND.drag.moved && Math.hypot(dx, dy) > 8) HAND.drag.moved = true;
    if (!HAND.drag.moved) return;
    const d = CARDS[HAND.drag.card.id];
    const needTarget = d.target === 'enemy';
    const lifted = p.y < 640;
    if (needTarget && lifted) {
      node.style.transform = `translate(0px, -186px) rotate(0deg) scale(.7)`;
      drawTargetArrow(800, 596, p.x, p.y);
      highlightTarget();
    } else {
      hideTargetArrow();
      node.style.transform = `translate(${p.x - 800}px, ${p.y - 768}px) rotate(0deg) scale(1)`;
    }
  });
  const finish = (ev) => {
    if (!HAND.drag || HAND.drag.node !== node) return;
    const p = stagePoint(ev.clientX, ev.clientY);
    const card = HAND.drag.card;
    const d = CARDS[card.id];
    const moved = HAND.drag.moved;
    HAND.drag = null;
    node.classList.remove('dragging');
    hideTargetArrow();
    clearHighlight();

    if (!moved) {
      /* 点击：单个敌人时直接打出，多个敌人则进入选中态 */
      if (d.target === 'enemy') {
        const alive = A.aliveEnemies();
        if (alive.length === 1) { HAND.selected = null; doPlay(card, alive[0]); return; }
        HAND.selected = HAND.selected === node ? null : node;
        layoutHand();
        if (HAND.selected) toast('点击一个敌人作为目标');
      } else {
        HAND.selected = null;
        doPlay(card, null);
      }
      return;
    }
    if (d.target === 'enemy') {
      const t = enemyUnder(p.x, p.y) || HAND.hoverEnemy;
      if (t) doPlay(card, t);
      else layoutHand();
    } else {
      if (p.y < 640) doPlay(card, null);
      else layoutHand();
    }
  };
  node.addEventListener('pointerup', finish);
  node.addEventListener('pointercancel', () => {
    if (HAND.drag && HAND.drag.node === node) {
      HAND.drag = null; node.classList.remove('dragging');
      hideTargetArrow(); clearHighlight(); layoutHand();
    }
  });
}

function flashUnplayable(node, card) {
  const d = CARDS[card.id];
  let msg = '能量不足';
  if (d.unplayable) msg = '这张牌无法打出';
  else if (d.type === 'attack' && CB.player.powers.entangled) msg = '被缠绕：本回合无法打出攻击牌';
  else if (d.canPlay && !d.canPlay()) msg = '不满足打出条件';
  toast(msg);
}

async function doPlay(card, target) {
  HAND.selected = null;
  const node = $$('.card', $('#hand')).find(n => n._card === card);
  if (node) { node.classList.add('playing'); }
  const ok = await playCard(card, target);
  if (!ok && node) { node.classList.remove('playing'); layoutHand(); }
  renderHand();
  layoutHand();
}

function onEnemyClick(en) {
  if (HAND.potionTarget !== null && HAND.potionTarget !== undefined) {
    const idx = HAND.potionTarget;
    HAND.potionTarget = null;
    clearHighlight();
    usePotion(idx, en);
    return;
  }
  if (!HAND.selected) return;
  const card = HAND.selected._card;
  HAND.selected = null;
  doPlay(card, en);
}

function enemyUnder(x, y) {
  let found = null;
  CB.enemies.forEach(e => {
    if (e.hp <= 0 || e.escaped) return;
    const node = EL.entities[e.uid];
    if (!node) return;
    const r = stageRect(node);
    if (x >= r.x - 20 && x <= r.x + r.w + 20 && y >= r.y - 40 && y <= r.y + r.h + 20) found = e;
  });
  return found;
}
function highlightTarget() {
  clearHighlight();
  const p = HAND.lastPointer;
  const e = HAND.hoverEnemy;
  if (e && EL.entities[e.uid]) EL.entities[e.uid].classList.add('hoverTarget');
}
function clearHighlight() {
  $$('.combatant').forEach(n => n.classList.remove('hoverTarget'));
}

/* 目标箭头 */
function drawTargetArrow(x1, y1, x2, y2) {
  const svg = $('#target-arrow');
  svg.classList.add('on');
  const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 120;
  const ang = Math.atan2(y2 - my, x2 - mx) * 180 / Math.PI;
  svg.innerHTML = `
    <defs><linearGradient id="ta" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#ffe08a" stop-opacity=".25"/>
      <stop offset="1" stop-color="#fff3c4" stop-opacity=".95"/></linearGradient></defs>
    <path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" stroke="url(#ta)" stroke-width="13"
      fill="none" stroke-linecap="round"/>
    <g transform="translate(${x2} ${y2}) rotate(${ang})">
      <path d="M0 0 L-30 -15 L-22 0 L-30 15 Z" fill="#fff3c4"/>
    </g>`;
}
function hideTargetArrow() { $('#target-arrow').classList.remove('on'); }

/* 记录指针位置（用于高亮） */
window.addEventListener('pointermove', (ev) => {
  HAND.lastPointer = stagePoint(ev.clientX, ev.clientY);
  if (HAND.drag) {
    const p = HAND.lastPointer;
    const d = CARDS[HAND.drag.card.id];
    if (d.target === 'enemy') {
      const t = enemyUnder(p.x, p.y);
      HAND.hoverEnemy = t;
      highlightTarget();
    }
  }
});
