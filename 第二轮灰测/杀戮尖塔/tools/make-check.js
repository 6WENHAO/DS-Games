/* ============================================================
   tools/make-check.js —— 由 index.html 生成布局测量页 tools/_check.html
   在真实浏览器中渲染各界面并测量元素几何 / 文字溢出，结果输出到 <pre>
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace('href="css/', 'href="../css/').replace(/src="js\//g, 'src="../js/');

const DRIVER = `
<script>
(function () {
  const REP = { scenes: [] };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function isHtml(n) { return n.namespaceURI !== 'http://www.w3.org/2000/svg'; }
  function measure(name, opts) {
    opts = opts || {};
    const sc = { name: name, overflow: [], outside: [], notes: {} };
    const root = opts.root ? document.querySelector(opts.root) : document.getElementById('stage');
    if (!root) { sc.notes.missing = opts.root; REP.scenes.push(sc); return sc; }
    const nodes = Array.prototype.slice.call(root.querySelectorAll('*')).filter(isHtml);
    sc.notes.htmlNodes = nodes.length;
    nodes.forEach(n => {
      const r = stageRect(n);
      if (r.w < 2 || r.h < 2) return;
      /* 文本溢出（排除可滚动容器） */
      const cs = getComputedStyle(n);
      const scrollable = cs.overflowY === 'auto' || cs.overflowY === 'scroll' || n.classList.contains('scroll-y');
      if (!scrollable && n.children.length === 0 && n.textContent.trim()) {
        const dy = n.scrollHeight - n.clientHeight, dx = n.scrollWidth - n.clientWidth;
        if (dy > 2 || dx > 2) {
          sc.overflow.push(tag(n) + ' +' + dx + 'x' + dy + ' 「' + n.textContent.trim().slice(0, 22) + '」');
        }
      }
      if (!opts.skipOutside && (r.x < -10 || r.y < -10 || r.x + r.w > 1610 || r.y + r.h > 910)) {
        sc.outside.push(tag(n) + ' @' + [r.x | 0, r.y | 0, r.w | 0, r.h | 0].join(','));
      }
    });
    sc.overflow = sc.overflow.slice(0, 25);
    sc.outside = sc.outside.slice(0, 25);
    REP.scenes.push(sc);
    return sc;
  }
  function tag(n) {
    return (n.id ? '#' + n.id : (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : n.tagName.toLowerCase()));
  }
  function rects(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel)).map(n => {
      const r = stageRect(n);
      return [r.x | 0, r.y | 0, r.w | 0, r.h | 0];
    });
  }

  async function run() {
    /* ---------- 标题 ---------- */
    REP.scale = window.__stageScale;
    measure('title');

    /* ---------- 战斗：3 哨卫 + 10 张长文本手牌 ---------- */
    Game.newRun();
    S.deck = [];
    ['perfected_strike', 'blood_for_blood', 'fire_breathing', 'sentinel', 'searing_blow',
      'whirlwind', 'body_slam', 'clash', 'feed', 'rampage'].forEach(id => S.deck.push(makeCard(id, 1)));
    await startCombat(['sentry', 'sentry', 'sentry'], 'elite', {});
    CB.hand = S.deck.map(c => ({ uid: uid(), id: c.id, upgraded: 1 }));
    CB.energy = 3;
    CB.player.block = 12;
    CB.player.powers = { strength: 3, dexterity: 2, vulnerable: 2, thorns: 3, metallicize: 4 };
    CB.enemies.forEach(e => { e.block = 5; e.powers.weak = 2; });
    renderCombat(); renderHand();
    await sleep(80);
    const c1 = measure('combat-3sentry-10hand');
    c1.notes.hand = rects('#hand .card');
    c1.notes.combatants = rects('.combatant');
    c1.notes.energy = document.getElementById('energy-text').textContent;
    c1.notes.hp = document.querySelector('#hp-bar .hp-text').textContent;
    c1.notes.relics = document.querySelectorAll('.relic-slot').length;
    c1.notes.intents = rects('.intent');
    c1.notes.powerChips = document.querySelectorAll('.power-chip').length;
    c1.notes.cardDesc = Array.prototype.slice.call(document.querySelectorAll('#hand .card')).map(n => {
      const d = n.querySelector('.c-desc'), nm = n.querySelector('.c-name');
      return nm.textContent + '|desc+' + (d.scrollHeight - d.clientHeight) + '|name+' + (nm.scrollWidth - nm.clientWidth);
    });

    /* ---------- 悬停 / 拖拽态 ---------- */
    const cardsNow = document.querySelectorAll('#hand .card');
    if (cardsNow.length) {
      cardsNow[0].classList.add('hovered');
      cardsNow[cardsNow.length - 1].classList.add('hovered');
      layoutHand();
      await sleep(40);
      const hv = measure('combat-hover');
      hv.notes.hovered = rects('#hand .card.hovered');
      cardsNow[0].classList.remove('hovered');
      cardsNow[cardsNow.length - 1].classList.remove('hovered');
      layoutHand();
    }

    /* ---------- 7 张手牌（常见情形） ---------- */
    CB.hand = CB.hand.slice(0, 7);
    renderHand();
    await sleep(40);
    const h7 = measure('combat-7hand');
    h7.notes.hand = rects('#hand .card');

    /* ---------- 战斗：BOSS 巨型立绘 ---------- */
    await startCombat(['slime_boss'], 'boss', {});
    renderCombat(); renderHand();
    await sleep(60);
    const c2 = measure('combat-boss');
    c2.notes.combatants = rects('.combatant');
    c2.notes.body = rects('.combatant .body svg');

    /* ---------- 战斗：5 只小史莱姆（横向拥挤） ---------- */
    await startCombat(['spike_slime_S', 'spike_slime_S', 'acid_slime_S', 'acid_slime_S', 'spike_slime_S'], 'monster', {});
    renderCombat();
    await sleep(60);
    const c3 = measure('combat-5enemies');
    c3.notes.combatants = rects('.combatant');

    /* ---------- 战斗：4 小鬼 ---------- */
    await startCombat(['gremlin_mad', 'gremlin_sneaky', 'gremlin_fat', 'gremlin_wizard'], 'monster', {});
    renderCombat();
    await sleep(60);
    measure('combat-4gremlins').notes = { combatants: rects('.combatant') };

    /* ---------- 地图 ---------- */
    CB = null;
    Game.toMap();
    await sleep(80);
    const m = measure('map', { skipOutside: true });
    m.notes.nodes = document.querySelectorAll('.map-node').length;
    m.notes.avail = document.querySelectorAll('.map-node.avail').length;
    m.notes.innerH = document.getElementById('map-inner').style.height;

    /* ---------- 奖励 ---------- */
    Game.show('reward');
    renderReward([
      { icon: SVG.goldCoin(), text: '18 金币', sub: '战斗奖励', take: () => { } },
      { icon: SVG.cardStackIcon(), text: '卡牌奖励', sub: '从 3 张牌中选择 1 张', take: () => { } },
      { icon: relicIconHtml('akabeko'), text: RELICS.akabeko.name, sub: RELICS.akabeko.desc, take: () => { } }
    ]);
    await sleep(60);
    measure('reward');

    /* ---------- 商店 ---------- */
    S.shop = null;
    Game.show('shop'); renderShop();
    await sleep(60);
    const sp = measure('shop');
    sp.notes.cards = rects('#shop-wrap .grid-card').length;
    sp.notes.wrap = rects('#shop-wrap');

    /* ---------- 休息处 ---------- */
    Game.show('rest'); renderRest();
    await sleep(60);
    measure('rest');

    /* ---------- 事件 ---------- */
    S.currentEvent = 'the_cleric'; S.eventState = {};
    Game.show('event'); renderEvent('the_cleric', {});
    await sleep(60);
    measure('event');

    /* ---------- 牌组浮层（大量卡牌网格） ---------- */
    showPileView('牌组', S.deck.concat(S.deck).slice(0, 24));
    await sleep(60);
    const ov = measure('overlay-deck');
    ov.notes.gridCards = document.querySelectorAll('.grid-card').length;

    /* ---------- 结算 ---------- */
    document.querySelectorAll('.overlay').forEach(n => n.remove());
    Game.show('end'); renderEnd(true);
    await sleep(60);
    measure('end');

    /* ---------- 交互端到端：合成指针事件 ---------- */
    const IX = { steps: [] };
    REP.interaction = IX;
    function pt(node) { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    function fire(node, type, x, y) {
      node.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
        clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1
      }));
    }
    async function scenario(name, fn) {
      try { IX.steps.push(name + ' → ' + (await fn())); }
      catch (e) { IX.steps.push(name + ' → 异常 ' + ((e && e.message) || e)); }
    }

    /* 1) 拖拽攻击牌到敌人身上 */
    await scenario('拖拽打击→颚虫', async () => {
      S.deck = [makeCard('strike'), makeCard('defend'), makeCard('bash')];
      await startCombat(['jaw_worm'], 'monster', {});
      CB.hand = [makeCard('strike'), makeCard('defend')];
      renderHand(); renderCombat();
      await sleep(60);
      const card = document.querySelector('#hand .card');
      const enemy = document.querySelector('#enemy-slots .combatant .body');
      const hp0 = CB.enemies[0].hp, e0 = CB.energy, h0 = CB.hand.length;
      const p0 = pt(card), pe = pt(enemy);
      fire(card, 'pointerdown', p0.x, p0.y);
      fire(card, 'pointermove', p0.x, p0.y - 120);
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: pe.x, clientY: pe.y, pointerId: 1 }));
      fire(card, 'pointermove', pe.x, pe.y);
      fire(card, 'pointerup', pe.x, pe.y);
      await sleep(300);
      return 'hp ' + hp0 + '→' + CB.enemies[0].hp + '，能量 ' + e0 + '→' + CB.energy + '，手牌 ' + h0 + '→' + CB.hand.length;
    });

    /* 2) 点击非目标牌（防御）直接打出 */
    await scenario('点击防御', async () => {
      const card = document.querySelector('#hand .card');
      const b0 = CB.player.block, h0 = CB.hand.length;
      const p0 = pt(card);
      fire(card, 'pointerdown', p0.x, p0.y);
      fire(card, 'pointerup', p0.x, p0.y);
      await sleep(300);
      return '格挡 ' + b0 + '→' + CB.player.block + '，手牌 ' + h0 + '→' + CB.hand.length;
    });

    /* 3) 多敌人：点击选中卡牌后点击敌人 */
    await scenario('选中后点敌人（3 敌）', async () => {
      await startCombat(['louse_red', 'louse_green', 'jaw_worm'], 'monster', {});
      CB.hand = [makeCard('strike')];
      CB.energy = 3;
      renderHand(); renderCombat();
      await sleep(60);
      const card = document.querySelector('#hand .card');
      const p0 = pt(card);
      fire(card, 'pointerdown', p0.x, p0.y);
      fire(card, 'pointerup', p0.x, p0.y);
      await sleep(80);
      const selected = !!HAND.selected;
      const target = CB.enemies[1];
      const hp0 = target.hp;
      const node = document.querySelector('#enemy-slots .combatant:nth-child(2)');
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(300);
      return '选中=' + selected + '，第二个敌人 hp ' + hp0 + '→' + target.hp;
    });

    /* 4) 结束回合按钮 */
    await scenario('结束回合按钮', async () => {
      const t0 = CB.turn, hp0 = CB.player.hp;
      document.getElementById('btn-end-turn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(2500);
      return '回合 ' + t0 + '→' + CB.turn + '，玩家 hp ' + hp0 + '→' + CB.player.hp + '，手牌=' + CB.hand.length;
    });

    /* 5) 键盘：E 结束回合 / 数字键出牌 */
    await scenario('键盘 1 出牌', async () => {
      CB.hand = [makeCard('strike')];
      CB.energy = 3;
      renderHand();
      await sleep(60);
      const total0 = CB.enemies.reduce((s, e) => s + e.hp, 0);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      await sleep(300);
      return '敌人总 hp ' + total0 + '→' + CB.enemies.reduce((s, e) => s + e.hp, 0) + '，选中=' + !!HAND.selected;
    });

    /* 6) 地图节点点击 */
    await scenario('点击地图节点', async () => {
      CB = null; Game.toMap();
      await sleep(80);
      const n = document.querySelector('.map-node.avail');
      const before = Game.screen;
      n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(600);
      return before + ' → ' + Game.screen + '，层数=' + S.floor;
    });
  }

  setTimeout(() => {
    run().catch(e => { REP.error = (e && e.stack) || String(e); })
      .then(() => {
        const txt = JSON.stringify(REP, null, 1);
        document.documentElement.innerHTML = '<head><meta charset="utf-8"></head><body><pre id="__report">'
          + txt.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></body>';
      });
  }, 250);
})();
</script>
`;

html = html.replace('</body>', DRIVER + '\n</body>');
fs.writeFileSync(path.join(ROOT, 'tools', '_check.html'), html, 'utf8');
console.log('已生成 tools/_check.html');
