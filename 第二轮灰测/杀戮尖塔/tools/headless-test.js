/* ============================================================
   tools/headless-test.js —— 用 Node 跑通全流程的自动测试
   用法：node tools/headless-test.js [局数]
   仅用于开发调试，不参与游戏运行。
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['util', 'svg', 'data-powers', 'data-cards', 'data-relics', 'data-potions',
  'data-enemies', 'data-events', 'map', 'combat', 'render-combat', 'screens', 'game'];

/* ---------------- 极简 DOM 桩 ---------------- */
function makeEl(tag) {
  const set = new Set();
  const node = {
    tagName: (tag || 'div').toUpperCase(),
    children: [], parentNode: null, dataset: {}, style: {},
    _html: '', textContent: '', scrollTop: 0, disabled: false,
    offsetWidth: 100, offsetHeight: 100,
    get className() { return Array.from(set).join(' '); },
    set className(v) { set.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => set.add(c)); },
    classList: {
      add: (...c) => c.forEach(x => set.add(x)),
      remove: (...c) => c.forEach(x => set.delete(x)),
      toggle: (c, on) => { if (on === undefined) { set.has(c) ? set.delete(c) : set.add(c); } else { on ? set.add(c) : set.delete(c); } },
      contains: (c) => set.has(c)
    },
    get innerHTML() { return node._html; },
    set innerHTML(v) { node._html = String(v); node.children = []; },
    get firstChild() { return node.children[0] || null; },
    appendChild(c) { node.children.push(c); c.parentNode = node; return c; },
    removeChild(c) { const i = node.children.indexOf(c); if (i >= 0) node.children.splice(i, 1); return c; },
    remove() { if (node.parentNode) node.parentNode.removeChild(node); },
    insertAdjacentHTML() { },
    addEventListener() { }, removeEventListener() { },
    setAttribute() { }, getAttribute() { return '100'; },
    setPointerCapture() { },
    querySelector() { return makeEl('div'); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }; },
    focus() { }, blur() { }, click() { }
  };
  return node;
}
const idCache = {};
const documentStub = {
  readyState: 'complete',
  createElement: (t) => makeEl(t),
  addEventListener() { }, removeEventListener() { },
  querySelector(sel) {
    if (typeof sel === 'string' && sel[0] === '#') {
      if (!idCache[sel]) idCache[sel] = makeEl('div');
      return idCache[sel];
    }
    return makeEl('div');
  },
  querySelectorAll() { return []; },
  body: makeEl('body')
};

global.document = documentStub;
global.addEventListener = () => { };
global.removeEventListener = () => { };
global.window = global;
global.confirm = () => true;
global.alert = () => { };
global.innerWidth = 1600;
global.innerHeight = 900;
global.requestAnimationFrame = (cb) => { cb(0); return 0; };
global.cancelAnimationFrame = () => { };
/* 让所有等待瞬间完成 */
const realSetTimeout = global.setTimeout;
global.setTimeout = (fn) => { Promise.resolve().then(() => { try { fn(); } catch (e) { errors.push('setTimeout: ' + e.stack); } }); return 0; };
global.clearTimeout = () => { };

const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push('console.error: ' + a.map(x => x && x.stack || String(x)).join(' ')); };
console.warn = () => { };

/* ---------------- 加载游戏脚本 ---------------- */
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8');
  try {
    vm.runInThisContext(src, { filename: 'js/' + f + '.js' });
  } catch (e) {
    origError('语法/加载错误 @ js/' + f + '.js\n' + e.stack);
    process.exit(1);
  }
}

/* ---------------- 自动驾驶脚本（同一上下文，可访问 const 声明） ---------------- */
const DRIVER = `
showCardChooser = async (opts) => (opts.cards || []).slice(0, opts.count || 1);
showCardRewardChoice = (cb) => {
  const cards = rollCardRewards();
  if (cards[0]) { S.deck.push(cards[0]); relicHook('onCardAdded'); }
  cb(true);
};
showPileView = () => {};
showHelp = () => {};

const tick = () => new Promise(r => setTimeout(r, 0));
const RESULT = { runs: [], errors: [], checks: [] };
function note(ok, msg) { RESULT.checks.push((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) RESULT.errors.push('检查失败：' + msg); }

/* ---- 自动战斗：能力牌 > 需要格挡时的技能牌 > 攻击牌 ---- */
function incomingDamage() {
  let sum = 0;
  A.aliveEnemies().forEach(e => {
    const mv = e.move; if (!mv) return;
    let base = mv.dmg; if (mv.dmgFn) base = mv.dmgFn(e);
    if (base == null) return;
    sum += calcAttackDamage(e, CB.player, base, {}) * (mv.hits || 1);
  });
  return sum;
}
function chooseCard() {
  const hand = CB.hand.filter(canPlayCard);
  if (!hand.length) return null;
  const need = incomingDamage() - CB.player.block;
  const pw = hand.find(c => CARDS[c.id].type === 'power');
  if (pw) return pw;
  if (need > 0) {
    const blk = hand.find(c => CARDS[c.id].block && CARDS[c.id].type === 'skill');
    if (blk) return blk;
  }
  const atk = hand.find(c => CARDS[c.id].type === 'attack');
  if (atk) return atk;
  return hand[0];
}
async function autoFight(log) {
  let guard = 0;
  while (CB && !CB.over && guard++ < 400) {
    let spin = 0;
    while (CB.busy && spin++ < 5000) await tick();
    if (!CB || CB.over) break;
    /* 偶尔用一次药水，覆盖药水逻辑 */
    if (chance(0.25)) {
      const pi = S.potions.findIndex(p => p && POTIONS[p].combatOnly);
      if (pi >= 0) {
        const pd = POTIONS[S.potions[pi]];
        await usePotion(pi, pd.target === 'enemy' ? A.aliveEnemies()[0] : null);
        continue;
      }
    }
    const c = chooseCard();
    if (c) {
      const d = CARDS[c.id];
      let t = null;
      if (d.target === 'enemy') { t = A.aliveEnemies()[0]; if (!t) break; }
      await playCard(c, t);
      continue;
    }
    if (!CB || CB.over) break;
    if (log) log.turns++;
    await endPlayerTurn();
  }
  if (guard >= 400) RESULT.errors.push('战斗未在 400 步内结束');
}

async function takeRewards() {
  const items = Game.pendingRewards || [];
  for (const it of items) { try { await it.take(); } catch (e) { RESULT.errors.push('领取奖励出错：' + (e.stack || e)); } }
  Game.pendingRewards = null;
}

/* ================= 阶段一：完整通关尝试 ================= */
async function playRun(idx) {
  const log = { idx: idx, floors: 0, turns: 0, win: false, boss: null, rooms: {} };
  Game.newRun();
  log.boss = S.bossId;
  let guard = 0;
  while (guard++ < 900) {
    await tick();
    const scr = Game.screen;
    if (scr === 'end') break;
    if (scr === 'map') {
      const av = availableNodes();
      if (!av.length) { RESULT.errors.push('地图无可用节点 floor=' + S.floor); break; }
      const n = pick(av);
      log.rooms[n.type] = (log.rooms[n.type] || 0) + 1;
      log.floors++;
      await Game.enterNode(n);
    } else if (scr === 'combat') {
      await autoFight(log);
      await tick();
    } else if (scr === 'reward' || scr === 'chest') {
      await takeRewards();
      Game.toMap();
    } else if (scr === 'shop') {
      await shopSpree();
      Game.toMap();
    } else if (scr === 'rest') {
      const c = S.deck.find(canUpgradeCard);
      if (c && chance(0.5)) upgradeCardInstance(c); else healOutOfCombat(Math.floor(S.maxHp * 0.3));
      Game.toMap();
    } else if (scr === 'event') {
      const ev = EVENTS[S.currentEvent];
      const ops = ev.options.filter(o => !o.enabled || o.enabled());
      if (!ops.length) { Game.finishEvent(); continue; }
      await pick(ops).run(S.eventState);
    } else if (scr === 'title') { break; }
    else { RESULT.errors.push('未知界面：' + scr); break; }
  }
  if (guard >= 900) RESULT.errors.push('单局未在 900 步内结束');
  log.win = !!(S && S.hp > 0 && S.floor >= MAP_ROWS + 1);
  log.hp = S ? S.hp + '/' + S.maxHp : '-';
  log.deck = S ? S.deck.length : 0;
  log.relics = S ? S.relics.length : 0;
  log.gold = S ? S.gold : 0;
  RESULT.runs.push(log);
}

async function shopSpree() {
  const sh = S.shop;
  if (!sh) return;
  for (const it of sh.cards) if (!it.sold && S.gold >= it.price) { S.gold -= it.price; it.sold = true; S.deck.push(it.card); relicHook('onCardAdded'); break; }
  for (const it of sh.relics) if (!it.sold && S.gold >= it.price) { S.gold -= it.price; it.sold = true; gainRelic(it.id); break; }
  for (const it of sh.potions) if (!it.sold && S.gold >= it.price) { if (gainPotion(it.id)) { S.gold -= it.price; it.sold = true; } break; }
  if (S.gold >= 100 && S.deck.length > 1) { S.gold -= 75; removeCardFromDeck(S.deck[0]); }
}

/* ================= 阶段二：定向战斗测试 ================= */
function buffPlayer() {
  S.maxHp = 400; S.hp = 400; S.gold = 999;
  S.deck = [];
  ['bash','cleave','uppercut','shrug_it_off','impervious','inflame','demon_form','whirlwind',
   'bludgeon','reaper','armaments','battle_trance','offering','feed','limit_break','barricade',
   'body_slam','entrench','headbutt','warcry','dual_wield','exhume','sentinel','searing_blow',
   'true_grit','burning_pact','havoc','second_wind','fiend_fire','sever_soul','spot_weakness',
   'double_tap','corruption','brutality','berserk','juggernaut','rupture','combust','evolve',
   'dark_embrace','feel_no_pain','fire_breathing','metallicize','flame_barrier','ghostly_armor',
   'infernal_blade','power_through','rage_card','seeing_red','shockwave','disarm','intimidate',
   'bloodletting','hemokinesis','blood_for_blood','carnage','dropkick','pummel','rampage',
   'reckless_charge','clash','anger','clothesline','heavy_blade','iron_wave','perfected_strike',
   'pommel_strike','sword_boomerang','thunderclap','twin_strike','wild_strike','flex','immolate',
   'bloodletting','strike','strike','defend','defend'].forEach(id => S.deck.push(makeCard(id, chance(0.5) ? 1 : 0)));
  S.relics = ['burning_blood','akabeko','anchor','vajra','pen_nib','nunchaku','shuriken','kunai',
    'ornamental_fan','letter_opener','orichalcum','bronze_scales','centennial_puzzle','happy_flower',
    'lantern','horn_cleat','captains_wheel','bird_faced_urn','dead_branch','torii','paper_phrog',
    'sundial','oddly_smooth_stone','bag_of_preparation','blood_vial','bag_of_marbles','mark_of_pain',
    'runic_pyramid','ice_cream','philosophers_stone'];
  S.potions = ['fire_potion','block_potion','explosive_potion','fear_potion','ancient_potion','regen_potion'];
  S.potionSlots = 6;
}

async function fightTest(ids, kind, label, mustWin) {
  Game.newRun();
  buffPlayer();
  Game.show('combat');
  try {
    await startCombat(ids, kind, {});
    const ref = CB;
    await autoFight(null);
    let spin = 0;
    while (Game.screen === 'combat' && spin++ < 200) await tick();
    note(Game.screen !== 'combat', label + ' 战斗可正常结束（界面=' + Game.screen + '）');
    if (mustWin) note(!!ref.victory, label + ' 强力牌组可以取胜');
  } catch (e) {
    RESULT.errors.push(label + ' 战斗崩溃：' + (e.stack || e));
  }
}

/* ================= 阶段三：事件测试 ================= */
async function eventTest() {
  for (const key of Object.keys(EVENTS)) {
    const ev = EVENTS[key];
    for (let i = 0; i < ev.options.length; i++) {
      Game.newRun();
      S.maxHp = 300; S.hp = 300; S.gold = 500;
      S.currentEvent = key; S.eventState = {};
      Game.show('event');
      const op = ev.options[i];
      if (op.enabled && !op.enabled()) continue;
      try {
        await op.run(S.eventState);
        let spin = 0;
        while (Game.screen === 'combat' && spin++ < 300) { await autoFight(null); await tick(); }
        if (Game.screen === 'reward' || Game.screen === 'chest') { await takeRewards(); Game.toMap(); }
        note(true, '事件 ' + ev.name + ' / 选项 ' + (i + 1) + ' 可执行');
      } catch (e) {
        RESULT.errors.push('事件 ' + key + ' 选项 ' + i + ' 出错：' + (e.stack || e));
      }
    }
  }
}

/* ================= 阶段四：卡牌逐张试打 ================= */
async function cardTest() {
  const ids = Object.keys(CARDS);
  for (const id of ids) {
    const d = CARDS[id];
    if (d.unplayable) continue;
    Game.newRun();
    S.maxHp = 500; S.hp = 500;
    S.deck = [];
    for (let k = 0; k < 4; k++) S.deck.push(makeCard('strike'));
    for (let k = 0; k < 4; k++) S.deck.push(makeCard('defend'));
    for (const up of [0, 1]) {
      Game.show('combat');
      try {
        await startCombat(['jaw_worm', 'cultist'], 'monster', {});
        CB.energy = 99;
        CB.player.powers.strength = 3;
        CB.player.powers.dexterity = 2;
        const c = makeCard(id, up);
        CB.hand.push(c);
        const t = CARDS[id].target === 'enemy' ? A.aliveEnemies()[0] : null;
        await playCard(c, t, { free: false });
        note(true, '卡牌 ' + d.name + (up ? '+' : '') + ' 可打出');
      } catch (e) {
        RESULT.errors.push('卡牌 ' + id + (up ? '+' : '') + ' 出错：' + (e.stack || e));
      }
      CB = null;
    }
  }
}

/* ================= 阶段五：遗物钩子全量触发 ================= */
async function relicTest() {
  for (const rid of Object.keys(RELICS)) {
    Game.newRun();
    S.maxHp = 300; S.hp = 200;
    S.relics = ['burning_blood', rid];
    if (RELICS[rid].onPickup) { try { RELICS[rid].onPickup(); } catch (e) { RESULT.errors.push('遗物 onPickup ' + rid + '：' + (e.stack || e)); } }
    Game.show('combat');
    try {
      await startCombat(['louse_red', 'gremlin_shield'], 'elite', {});
      await autoFight(null);
      let spin = 0;
      while (Game.screen === 'combat' && spin++ < 200) await tick();
      note(true, '遗物 ' + RELICS[rid].name + ' 无异常');
    } catch (e) {
      RESULT.errors.push('遗物 ' + rid + ' 战斗出错：' + (e.stack || e));
    }
  }
}

(async () => {
  const N = parseInt(globalThis.__RUNS || '20', 10);
  for (let i = 0; i < N; i++) {
    try { await playRun(i); }
    catch (e) { RESULT.errors.push('第 ' + i + ' 局崩溃：' + (e && e.stack || e)); }
  }
  /* 定向测试 */
  for (const b of ['guardian', 'slime_boss', 'hexaghost']) await fightTest([b], 'boss', 'BOSS·' + ENEMIES[b].name, true);
  for (const e of ENCOUNTERS.elite) await fightTest(e(), 'elite', '精英', true);
  for (let i = 0; i < ENCOUNTERS.weak.length; i++) await fightTest(ENCOUNTERS.weak[i](), 'monster', '弱敌组' + i);
  for (let i = 0; i < ENCOUNTERS.strong.length; i++) await fightTest(ENCOUNTERS.strong[i](), 'monster', '强敌组' + i);
  await fightTest(['looter'], 'monster', '强盗逃跑');
  await fightTest(['acid_slime_L'], 'monster', '大史莱姆分裂');
  await fightTest(['spike_slime_L'], 'monster', '尖刺史莱姆分裂');
  await fightTest(['lagavulin'], 'elite', '拉加维林沉睡');
  await eventTest();
  await cardTest();
  await relicTest();
  globalThis.__RESULT = RESULT;
})();
`;

global.__RUNS = process.argv[2] || '20';
vm.runInThisContext(DRIVER, { filename: 'driver.js' });

/* 等待驱动完成 */
(function wait() {
  if (global.__RESULT) {
    const R = global.__RESULT;
    const wins = R.runs.filter(r => r.win).length;
    origError('');
    origError('=== 无头测试结果 ===');
    origError('完整局数：' + R.runs.length + '　通关：' + wins);
    R.runs.forEach(r => {
      origError(`  #${String(r.idx).padStart(2)} ${r.win ? '通关' : '失败'} 层数=${String(r.floors).padStart(2)} 回合=${String(r.turns).padStart(3)} BOSS=${r.boss} HP=${r.hp} 牌=${r.deck} 遗物=${r.relics} 金币=${r.gold}`);
    });
    const checks = R.checks || [];
    origError('定向检查：' + checks.length + ' 项，失败 ' + checks.filter(c => c.startsWith('FAIL')).length + ' 项');
    checks.filter(c => c.startsWith('FAIL')).forEach(c => origError('  ' + c));
    const allErr = R.errors.concat(errors);
    if (allErr.length) {
      origError('');
      origError('!!! 发现 ' + allErr.length + ' 个问题：');
      const seen = new Set();
      allErr.forEach(e => {
        const key = String(e).slice(0, 220);
        if (seen.has(key)) return;
        seen.add(key);
        origError('---\n' + e);
      });
      process.exitCode = 1;
    } else {
      origError('\n没有发现运行时错误。');
    }
    return;
  }
  realSetTimeout(wait, 30);
})();
