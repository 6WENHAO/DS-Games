/* ============================================================
   screens.js —— 各界面渲染 + 通用浮层（选牌 / 看牌堆 / 牌组）
   ============================================================ */
'use strict';

/* ============================================================
   通用浮层
   注意：#overlay-layer 永远保持 pointer-events:none，只有 .overlay 自身
   接收事件（CSS 已如此声明）。这样即使有浮层被异常移除，也绝不会
   出现「整屏点不动」的情况。
   ============================================================ */
function openOverlay(opts) {
  const ov = el('div', 'overlay');
  if (opts && opts.escClose) ov.dataset.escclose = '1';
  $('#overlay-layer').appendChild(ov);
  return ov;
}
function closeOverlay(ov) {
  ov.remove();
  TIP.hide();
}
/* 关闭最上层可用 Esc 关闭的浮层，返回是否关掉了一个 */
function closeTopEscOverlay() {
  const list = $$('#overlay-layer .overlay[data-escclose="1"]');
  if (!list.length) return false;
  closeOverlay(list[list.length - 1]);
  return true;
}

/* 选牌浮层：返回 Promise<Card[]> */
function showCardChooser(opts) {
  return new Promise((resolve) => {
    const count = opts.count || 1;
    const ov = openOverlay();
    const chosen = [];
    ov.appendChild(el('div', 'ov-title', opts.prompt || '选择卡牌'));
    ov.appendChild(el('div', 'ov-sub', count > 1 ? `选择 ${count} 张（已选 ${chosen.length}）` : '点击一张卡牌'));
    const grid = el('div', 'card-grid scroll-y');
    ov.appendChild(grid);
    const btns = el('div', 'ov-buttons');
    const ok = el('button', 'btn primary', '确定');
    const cancel = el('button', 'btn', '取消');
    if (count > 1) btns.appendChild(ok);
    if (opts.canCancel) btns.appendChild(cancel);
    ov.appendChild(btns);

    const done = (res) => { closeOverlay(ov); resolve(res); };
    ok.addEventListener('click', () => done(chosen));
    cancel.addEventListener('click', () => done([]));

    opts.cards.forEach(card => {
      const n = makeCardNode(card, 'pick');
      n.addEventListener('click', () => {
        if (count === 1) { done([card]); return; }
        const i = chosen.indexOf(card);
        if (i >= 0) { chosen.splice(i, 1); n.classList.remove('chosen'); }
        else if (chosen.length < count) { chosen.push(card); n.classList.add('chosen'); }
        ov.querySelector('.ov-sub').textContent = `选择 ${count} 张（已选 ${chosen.length}）`;
      });
      grid.appendChild(n);
    });
    if (!opts.cards.length) done([]);
  });
}

/* 查看牌堆 */
function showPileView(title, cards, opts) {
  opts = opts || {};
  const ov = openOverlay({ escClose: true });
  ov.appendChild(el('div', 'ov-title', title));
  ov.appendChild(el('div', 'ov-sub', cards.length + ' 张牌' + (opts.sub ? ' · ' + opts.sub : '')));
  const grid = el('div', 'card-grid scroll-y');
  const list = opts.shuffled ? shuffle(cards.slice()) : sortCards(cards.slice());
  list.forEach(c => grid.appendChild(makeCardNode(c)));
  if (!list.length) grid.appendChild(el('div', 'dim', '（空）'));
  ov.appendChild(grid);
  const btns = el('div', 'ov-buttons');
  const close = el('button', 'btn', '关闭');
  close.addEventListener('click', () => closeOverlay(ov));
  btns.appendChild(close);
  ov.appendChild(btns);
  ov.addEventListener('click', (e) => { if (e.target === ov) closeOverlay(ov); });
}
function sortCards(cards) {
  const order = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 };
  return cards.sort((a, b) => {
    const da = CARDS[a.id], db = CARDS[b.id];
    if (order[da.type] !== order[db.type]) return order[da.type] - order[db.type];
    const ca = cardCost(a), cb = cardCost(b);
    if (ca !== cb) return ca - cb;
    return da.name.localeCompare(db.name);
  });
}

/* 从牌组中选牌（战斗外） */
function pickCardFromDeck(prompt, filter) {
  const cards = filter ? S.deck.filter(filter) : S.deck.slice();
  if (!cards.length) { toast('没有符合条件的卡牌'); return Promise.resolve(null); }
  return showCardChooser({ cards: sortCards(cards), count: 1, prompt: prompt, canCancel: false })
    .then(r => r[0] || null);
}

/* ============================================================
   标题界面
   ============================================================ */
function renderTitle() {
  const scr = $('#screen-title');
  clear(scr);
  $('#topbar').classList.add('hidden');
  const w = el('div', 'title-wrap');
  w.innerHTML = `
    <div class="game-logo">杀戮尖塔</div>
    <div class="game-sub">SLAY THE SPIRE · 网页复刻版</div>
    <div class="title-art">${SVG.titleArt()}</div>
    <div class="title-btns">
      <button class="btn primary" id="btn-new">开始攀爬（铁甲战士）</button>
      <button class="btn" id="btn-help">操作说明</button>
    </div>
    <div class="title-tip">
      <kbd>拖拽卡牌</kbd> 出牌 · <kbd>点击卡牌</kbd> 选中后点击敌人 · <kbd>E</kbd> 结束回合<br>
      <kbd>1~9</kbd> 快速出牌 · <kbd>D</kbd> 抽牌堆 · <kbd>A</kbd> 弃牌堆 · <kbd>X</kbd> 消耗堆 · <kbd>Esc</kbd> 取消
    </div>`;
  scr.appendChild(w);
  $('#btn-new').addEventListener('click', () => Game.newRun());
  $('#btn-help').addEventListener('click', showHelp);
}

function showHelp() {
  const ov = openOverlay({ escClose: true });
  ov.appendChild(el('div', 'ov-title', '操作说明'));
  const p = el('div', 'panel', `
    <div style="padding:22px 28px;width:820px;line-height:2;font-size:13.5px">
      <b style="color:#d4af58">目标</b>：从第 1 层爬到第 16 层，击败本章 BOSS 即为通关。<br>
      <b style="color:#d4af58">战斗</b>：每回合获得 3 点能量，打出手牌消耗能量。回合结束时手牌会被弃掉，格挡会清零。<br>
      <b style="color:#d4af58">敌人意图</b>：敌人头顶的图标表示它下回合要做什么（剑=攻击并显示伤害，盾=防御，箭头=增益/减益）。<br>
      <b style="color:#d4af58">出牌</b>：把卡牌向上拖出即可打出；需要指定目标的牌拖到敌人身上释放；也可以点击卡牌选中，再点击敌人。<br>
      <b style="color:#d4af58">地图</b>：每层可选择路线 —— <span style="color:#d8cdb4">普通敌人 / 精英（掉落遗物）/ 未知事件 / 商店 / 宝箱 / 休息处</span>。<br>
      <b style="color:#d4af58">休息处</b>：休息回复 30% 生命，或打铁升级一张卡牌。<br>
      <b style="color:#d4af58">快捷键</b>：E 结束回合，1~9 打出对应手牌，D/A/X 查看抽牌堆/弃牌堆/消耗堆，Esc 取消选择。
    </div>`);
  ov.appendChild(p);
  const btns = el('div', 'ov-buttons');
  const b = el('button', 'btn', '返回');
  b.addEventListener('click', () => closeOverlay(ov));
  btns.appendChild(b);
  ov.appendChild(btns);
}

/* ============================================================
   战斗奖励界面
   ============================================================ */
function renderReward(items) {
  const scr = $('#screen-reward');
  clear(scr);
  const col = el('div', 'center-col');
  col.appendChild(el('div', 'section-title', '战 利 品'));
  const list = el('div', 'reward-list');
  items.forEach(item => {
    const row = el('div', 'reward-item');
    row.innerHTML = `<div class="ri-icon">${item.icon}</div>
      <div><div class="ri-text">${item.text}</div>${item.sub ? `<div class="ri-sub">${item.sub}</div>` : ''}</div>`;
    row.addEventListener('click', async () => {
      if (row.classList.contains('taken')) return;
      const ok = await item.take();
      if (ok !== false) {
        row.classList.add('taken');
        row.querySelector('.ri-text').textContent = '（已获得）';
      }
    });
    list.appendChild(row);
  });
  col.appendChild(list);
  const btn = el('button', 'btn primary', '继 续');
  btn.style.marginTop = '10px';
  btn.addEventListener('click', () => Game.toMap());
  col.appendChild(btn);
  scr.appendChild(col);
}

/* 生成卡牌奖励选项 */
function rollCardRewards() {
  let n = 3;
  if (hasRelic('busted_crown')) n -= 2;
  n = Math.max(1, n);
  const out = [];
  const usedIds = [];
  for (let i = 0; i < n; i++) {
    const r = rnd();
    let rarity = 'common';
    if (r < 0.04) rarity = 'rare'; else if (r < 0.37) rarity = 'uncommon';
    let pool = cardPool(rarity).filter(k => !usedIds.includes(k));
    if (!pool.length) pool = cardPool('common').filter(k => !usedIds.includes(k));
    const id = pick(pool);
    usedIds.push(id);
    const c = makeCard(id, 0);
    if (chance(0.06)) upgradeCardInstance(c);
    out.push(c);
  }
  return out;
}

function showCardRewardChoice(onDone) {
  const cards = rollCardRewards();
  const ov = openOverlay();
  ov.appendChild(el('div', 'ov-title', '选择一张卡牌'));
  ov.appendChild(el('div', 'ov-sub', '加入你的牌组'));
  const grid = el('div', 'card-grid');
  cards.forEach(c => {
    const n = makeCardNode(c, 'pick');
    n.addEventListener('click', () => {
      closeOverlay(ov);
      S.deck.push(c);
      relicHook('onCardAdded');
      toast('获得卡牌：' + cardName(c));
      onDone(true);
    });
    grid.appendChild(n);
  });
  ov.appendChild(grid);
  const btns = el('div', 'ov-buttons');
  const skip = el('button', 'btn', '跳过');
  skip.addEventListener('click', () => { closeOverlay(ov); onDone(true); });
  btns.appendChild(skip);
  ov.appendChild(btns);
}

/* ============================================================
   商店
   ============================================================ */
function renderShop() {
  const scr = $('#screen-shop');
  clear(scr);
  const disc = hasRelic('the_courier') ? 0.8 : 1;
  if (!S.shop) {
    const cardIds = [];
    const mk = (rarity) => {
      let pool = cardPool(rarity).filter(k => !cardIds.includes(k));
      if (!pool.length) pool = cardPool('common');
      const id = pick(pool); cardIds.push(id);
      const price = { common: ri(45, 55), uncommon: ri(68, 82), rare: ri(135, 165) }[rarity];
      return { card: makeCard(id, 0), price: Math.round(price * disc) };
    };
    S.shop = {
      cards: [mk('common'), mk('common'), mk('uncommon'), mk('uncommon'), mk('rare')],
      relics: sample(relicPool('common').concat(relicPool('uncommon'), relicPool('rare'))
        .filter(id => !hasRelic(id)), 3)
        .map(id => ({
          id: id, price: Math.round(({ common: ri(143, 157), uncommon: ri(235, 265), rare: ri(297, 323) }[RELICS[id].rarity] || 180) * disc)
        })),
      potions: [randomPotion(), randomPotion(), randomPotion()].map(id => ({
        id: id, price: Math.round(({ common: ri(48, 52), uncommon: ri(72, 78), rare: ri(95, 105) }[POTIONS[id].rarity] || 60) * disc)
      })),
      removeUsed: 0
    };
  }
  const sh = S.shop;
  const wrap = el('div');
  wrap.id = 'shop-wrap';
  wrap.innerHTML = `<div class="section-title" style="margin-bottom:8px">商 店</div>`;

  /* 卡牌 */
  const row1 = el('div', 'shop-row');
  row1.appendChild(el('div', 'shop-col-title', '卡牌'));
  const cc = el('div', 'shop-cards');
  sh.cards.forEach((it, i) => {
    const box = el('div', 'shop-item');
    const n = makeCardNode(it.card, it.sold ? '' : 'pick');
    if (it.sold) n.classList.add('shop-sold');
    n.style.marginBottom = '22px';
    box.appendChild(n);
    const tag = el('div', 'price-tag' + (S.gold < it.price ? ' poor' : ''), `${SVG.goldCoin()}${it.price}`);
    tag.querySelector('svg').style.width = '15px';
    box.appendChild(tag);
    if (!it.sold) n.addEventListener('click', () => {
      if (S.gold < it.price) { toast('金币不足'); return; }
      S.gold -= it.price; it.sold = true;
      S.deck.push(it.card);
      relicHook('onCardAdded');
      S.relicFlags.mawBankDead = true;
      toast('购买：' + cardName(it.card));
      renderShop();
    });
    cc.appendChild(box);
  });
  row1.appendChild(cc);
  wrap.appendChild(row1);

  /* 遗物 + 药水 */
  const row2 = el('div', 'shop-row');
  row2.appendChild(el('div', 'shop-col-title', '遗物'));
  const rc = el('div', 'shop-cards');
  sh.relics.forEach(it => {
    const box = el('div', 'shop-item');
    const b = el('div', 'shop-relic' + (it.sold ? ' shop-sold' : ''));
    b.innerHTML = relicIconHtml(it.id);
    const r = RELICS[it.id];
    bindTip(b, () => `<div class="tt-title">${r.name}</div><div>${r.desc}</div>
      ${r.flavor ? `<div class="tt-flavor">"${r.flavor}"</div>` : ''}`);
    if (!it.sold) b.addEventListener('click', () => {
      if (S.gold < it.price) { toast('金币不足'); return; }
      S.gold -= it.price; it.sold = true;
      gainRelic(it.id);
      S.relicFlags.mawBankDead = true;
      renderShop();
    });
    box.appendChild(b);
    const tag = el('div', 'price-tag' + (S.gold < it.price ? ' poor' : ''), `${SVG.goldCoin()}${it.price}`);
    tag.querySelector('svg').style.width = '15px';
    tag.style.bottom = '2px';
    box.appendChild(tag);
    rc.appendChild(box);
  });
  row2.appendChild(rc);
  row2.appendChild(el('div', 'shop-col-title', '药水'));
  const pc = el('div', 'shop-cards');
  sh.potions.forEach(it => {
    const box = el('div', 'shop-item');
    const p = POTIONS[it.id];
    const b = el('div', 'shop-potion' + (it.sold ? ' shop-sold' : ''));
    b.innerHTML = SVG.potionIcon(p.color, p.shape);
    bindTip(b, () => `<div class="tt-title">${p.name}</div><div>${p.desc}</div>`);
    if (!it.sold) b.addEventListener('click', () => {
      if (S.gold < it.price) { toast('金币不足'); return; }
      if (!gainPotion(it.id)) return;
      S.gold -= it.price; it.sold = true;
      S.relicFlags.mawBankDead = true;
      renderShop();
    });
    box.appendChild(b);
    const tag = el('div', 'price-tag' + (S.gold < it.price ? ' poor' : ''), `${SVG.goldCoin()}${it.price}`);
    tag.querySelector('svg').style.width = '15px';
    tag.style.bottom = '2px';
    box.appendChild(tag);
    pc.appendChild(box);
  });
  row2.appendChild(pc);
  wrap.appendChild(row2);

  /* 移除卡牌 + 离开 */
  const row3 = el('div', 'row');
  row3.style.marginTop = '14px';
  const removePrice = hasRelic('smiling_mask') ? 50 : Math.round((75 + sh.removeUsed * 25) * disc);
  const rm = el('button', 'btn', `移除一张卡牌　${removePrice} 金币`);
  rm.disabled = S.gold < removePrice || sh.removeUsed >= 2 || S.deck.length <= 1;
  rm.addEventListener('click', async () => {
    const c = await pickCardFromDeck('选择要移除的卡牌');
    if (!c) return;
    S.gold -= removePrice; sh.removeUsed++;
    removeCardFromDeck(c);
    S.relicFlags.mawBankDead = true;
    renderShop();
  });
  row3.appendChild(rm);
  const leave = el('button', 'btn primary', '离开商店');
  leave.addEventListener('click', () => Game.toMap());
  row3.appendChild(leave);
  wrap.appendChild(row3);
  scr.appendChild(wrap);
}

/* ============================================================
   休息处
   ============================================================ */
function renderRest() {
  const scr = $('#screen-rest');
  clear(scr);
  const col = el('div', 'center-col');
  const art = el('div');
  art.id = 'campfire-art';
  art.innerHTML = SVG.campfire();
  col.appendChild(art);
  col.appendChild(el('div', 'section-title', '休 息 处'));
  col.appendChild(el('div', 'tiny dim', '选择一项，然后继续前进'));

  const opts = el('div', 'rest-options');
  const canRest = !hasRelic('coffee_dripper');
  const canSmith = !hasRelic('fusion_hammer') && S.deck.some(canUpgradeCard);
  const healAmt = Math.floor(S.maxHp * 0.3) + (hasRelic('regal_pillow') ? 15 : 0);

  const rest = el('div', 'rest-opt' + (canRest ? '' : ' dis'));
  rest.innerHTML = `${SVG.heartIcon()}<div class="ro-name">休 息</div>
    <div class="ro-desc">回复 ${healAmt} 点生命<br>（当前 ${S.hp}/${S.maxHp}）</div>`;
  rest.querySelector('svg').style.width = '76px';
  rest.querySelector('svg').style.height = '76px';
  rest.addEventListener('click', () => {
    if (!canRest) return;
    healOutOfCombat(healAmt);
    if (hasRelic('dream_catcher')) {
      showCardRewardChoice(() => Game.toMap());
    } else Game.toMap();
  });
  opts.appendChild(rest);

  const smith = el('div', 'rest-opt' + (canSmith ? '' : ' dis'));
  smith.innerHTML = `${SVG.upgradeIcon()}<div class="ro-name">打 铁</div>
    <div class="ro-desc">升级一张卡牌</div>`;
  smith.querySelector('svg').style.width = '76px';
  smith.querySelector('svg').style.height = '76px';
  smith.addEventListener('click', async () => {
    if (!canSmith) return;
    const c = await pickCardFromDeck('选择要升级的卡牌', canUpgradeCard);
    if (!c) return;
    upgradeCardInstance(c);
    toast(cardName(c) + ' 已升级！');
    Game.toMap();
  });
  opts.appendChild(smith);
  col.appendChild(opts);
  scr.appendChild(col);
}

/* ============================================================
   事件
   ============================================================ */
function renderEvent(key, state) {
  const ev = EVENTS[key];
  const scr = $('#screen-event');
  clear(scr);
  const col = el('div', 'center-col');
  const panel = el('div', 'panel event-panel');
  panel.innerHTML = `
    <div class="event-art">${SVG.cardArt(ev.art || 'orb', '#c9a44a')}</div>
    <div class="event-title">${ev.name}</div>
    <div class="event-body scroll-y">${ev.body}</div>`;
  panel.querySelector('.event-art svg').style.height = '190px';
  const list = el('div', 'event-opts');
  ev.options.forEach(op => {
    const enabled = op.enabled ? op.enabled() : true;
    const b = el('div', 'event-opt' + (enabled ? '' : ' dis'));
    b.innerHTML = `[ ${op.label} ]${op.sub ? `<span class="eo-tag">${op.sub}</span>` : ''}`;
    if (enabled) b.addEventListener('click', () => {
      $$('.event-opt', list).forEach(x => x.classList.add('dis'));
      op.run(state);
    });
    list.appendChild(b);
  });
  panel.appendChild(list);
  col.appendChild(panel);
  scr.appendChild(col);
}

/* ============================================================
   宝箱
   ============================================================ */
function renderChest(size, contents) {
  const scr = $('#screen-chest');
  clear(scr);
  const col = el('div', 'center-col');
  const art = el('div');
  art.style.width = '300px'; art.style.height = '230px';
  art.innerHTML = SVG.chestArt(size);
  col.appendChild(art);
  col.appendChild(el('div', 'section-title', { small: '小', medium: '中', large: '大' }[size] + ' 宝 箱'));
  const list = el('div', 'reward-list');
  contents.forEach(item => {
    const row = el('div', 'reward-item');
    row.innerHTML = `<div class="ri-icon">${item.icon}</div>
      <div><div class="ri-text">${item.text}</div>${item.sub ? `<div class="ri-sub">${item.sub}</div>` : ''}</div>`;
    row.addEventListener('click', async () => {
      if (row.classList.contains('taken')) return;
      const ok = await item.take();
      if (ok !== false) { row.classList.add('taken'); row.querySelector('.ri-text').textContent = '（已获得）'; }
    });
    list.appendChild(row);
  });
  col.appendChild(list);
  const btn = el('button', 'btn primary', '继 续');
  btn.addEventListener('click', () => Game.toMap());
  col.appendChild(btn);
  scr.appendChild(col);
}

/* ============================================================
   结算
   ============================================================ */
function renderEnd(win) {
  const scr = $('#screen-end');
  clear(scr);
  $('#topbar').classList.add('hidden');
  const w = el('div', 'end-wrap');
  w.innerHTML = `
    <div class="end-title ${win ? 'win' : 'lose'}">${win ? '通 关' : '你 死 了'}</div>
    <div class="end-stats">
      ${win ? '你击败了尖塔第一章的守关者，攀爬告一段落。' : '尖塔吞噬了又一个挑战者。'}<br>
      到达层数：<b>${S.floor}</b> 　 击败敌人：<b>${S.stats.kills}</b><br>
      最高单次伤害：<b>${S.stats.maxHit}</b> 　 剩余金币：<b>${S.gold}</b><br>
      牌组：<b>${S.deck.length}</b> 张 　 遗物：<b>${S.relics.length}</b> 个
    </div>`;
  const btns = el('div', 'ov-buttons');
  btns.style.justifyContent = 'center';
  const again = el('button', 'btn primary', '再来一局');
  again.addEventListener('click', () => Game.newRun());
  const deckBtn = el('button', 'btn', '查看牌组');
  deckBtn.addEventListener('click', () => showPileView('最终牌组', S.deck.slice()));
  const title = el('button', 'btn', '返回标题');
  title.addEventListener('click', () => { Game.show('title'); renderTitle(); });
  btns.appendChild(again); btns.appendChild(deckBtn); btns.appendChild(title);
  w.appendChild(btns);
  scr.appendChild(w);
}
