/* =========================================================
   ui.js — HUD / 物品栏 / 合成 / 对话 / 飞船日志 / 翻译器 / 信号镜
   ========================================================= */
const UI = (() => {

  /* ---------- 物品定义 ---------- */
  const ITEMS = {
    dirt: { name: '泥土', block: true }, grass: { name: '草方块', block: true },
    cobble: { name: '圆石', block: true }, stone: { name: '石头', block: true },
    sand: { name: '沙子', block: true }, redsand: { name: '红沙', block: true },
    log: { name: '原木', block: true }, planks: { name: '木板', block: true },
    leaves: { name: '树叶', block: true }, glass: { name: '玻璃', block: true },
    gravel: { name: '沙砾', block: true }, basalt: { name: '玄武岩', block: true },
    glowlamp: { name: '萤光灯', block: true }, table: { name: '工作台', block: true },
    crystal_block: { name: '辉晶块', block: true }, ancient_brick: { name: '古族砖', block: true },
    ice: { name: '冰', block: true }, snow: { name: '雪块', block: true },
    stick: { name: '木棍' }, coal: { name: '煤炭' }, iron_ingot: { name: '铁锭' },
    crystal_shard: { name: '晶体碎片' },
    pickaxe_wood: { name: '木镐', tool: true }, pickaxe_stone: { name: '石镐', tool: true },
    suit: { name: '宇航服', gear: true }, scope: { name: '信号镜', gear: true },
    translator: { name: '古族翻译器', gear: true }, codes: { name: '发射密码', gear: true },
    marshmallow: { name: '棉花糖' }, marshmallow_r: { name: '烤棉花糖(回血)' },
  };

  const BLOCK_ICON_FACES = { // 方块图标用哪些贴图
    dirt: ['dirt', 'dirt'], grass: ['grass_top', 'grass_side'], cobble: ['cobble', 'cobble'],
    stone: ['stone', 'stone'], sand: ['sand', 'sand'], redsand: ['redsand', 'redsand'],
    log: ['log_top', 'log_side'], planks: ['planks', 'planks'], leaves: ['leaves', 'leaves'],
    glass: ['glass', 'glass'], gravel: ['gravel', 'gravel'], basalt: ['basalt', 'basalt'],
    glowlamp: ['glowlamp', 'glowlamp'], table: ['table_top', 'table_side'],
    crystal_block: ['crystal_block', 'crystal_block'], ancient_brick: ['ancient_brick', 'ancient_brick'],
    ice: ['ice', 'ice'], snow: ['snow', 'snow'],
  };
  function iconSVG(id) {
    if (BLOCK_ICON_FACES[id]) return Assets.isoIcon(BLOCK_ICON_FACES[id][0], BLOCK_ICON_FACES[id][1]);
    return Assets.itemIcon(id);
  }

  /* ---------- 合成配方 ---------- */
  const RECIPES = [
    { out: 'planks', n: 4, cost: { log: 1 }, desc: '基础建材' },
    { out: 'stick', n: 4, cost: { planks: 2 }, desc: '工具原料' },
    { out: 'table', n: 1, cost: { planks: 4 }, desc: '解锁更多配方' },
    { out: 'pickaxe_wood', n: 1, cost: { planks: 3, stick: 2 }, table: true, desc: '可挖掘石头/矿物' },
    { out: 'pickaxe_stone', n: 1, cost: { cobble: 3, stick: 2 }, table: true, desc: '更快的挖掘速度' },
    { out: 'glowlamp', n: 2, cost: { crystal_shard: 1, stick: 1 }, desc: '温暖的光源' },
    { out: 'glass', n: 2, cost: { sand: 2, coal: 1 }, table: true, desc: '烧制的透明方块' },
    { out: 'marshmallow_r', n: 1, cost: { marshmallow: 1 }, fire: true, desc: '篝火旁烤制 · 回复生命' },
  ];

  /* ---------- 库存 ---------- */
  const HOT = 9, INVSIZE = 36;
  let slots = new Array(INVSIZE).fill(null); // {id, count}
  let selected = 0;
  let creative = false;
  const CREATIVE_BLOCKS = Object.keys(BLOCK_ICON_FACES);

  function reset(creativeMode) {
    slots = new Array(INVSIZE).fill(null);
    creative = creativeMode;
    selected = 0;
    if (creative) {
      CREATIVE_BLOCKS.slice(0, 9).forEach((b, i) => slots[i] = { id: b, count: Infinity });
    }
    renderHotbar();
  }
  function give(id, n) {
    n = n || 1;
    for (const s of slots) if (s && s.id === id && s.count !== Infinity) { s.count += n; renderHotbar(); return true; }
    for (let i = 0; i < INVSIZE; i++) if (!slots[i]) { slots[i] = { id, count: n }; renderHotbar(); return true; }
    return false;
  }
  function take(id, n) {
    n = n || 1;
    for (let i = 0; i < INVSIZE; i++) {
      const s = slots[i];
      if (s && s.id === id) {
        if (s.count === Infinity) return true;
        s.count -= n;
        if (s.count <= 0) slots[i] = null;
        renderHotbar(); renderInv();
        return true;
      }
    }
    return false;
  }
  function count(id) {
    let c = 0;
    for (const s of slots) if (s && s.id === id) { if (s.count === Infinity) return Infinity; c += s.count; }
    return c;
  }
  function selectedItem() { const s = slots[selected]; return s ? s.id : null; }
  function selectSlot(i) {
    selected = i; renderHotbar();
    const s = slots[i];
    showTooltip(s ? ITEMS[s.id].name : '');
  }

  /* ---------- 渲染快捷栏 ---------- */
  const el = id => document.getElementById(id);
  function slotHTML(s, i, sel) {
    const inner = s ? iconSVG(s.id) + (s.count > 1 && s.count !== Infinity ? `<span class="cnt">${s.count}</span>` : '') : '';
    return `<div class="slot${sel ? ' sel' : ''}" data-i="${i}">${inner}</div>`;
  }
  function renderHotbar() {
    let h = '';
    for (let i = 0; i < HOT; i++) h += slotHTML(slots[i], i, i === selected);
    el('hotbar').innerHTML = h;
  }
  let tooltipTimer = null;
  function showTooltip(text) {
    const t = el('tooltip');
    if (!text) { t.classList.add('hidden'); return; }
    t.textContent = text;
    t.classList.remove('hidden');
    const hb = el('hotbar').getBoundingClientRect();
    t.style.left = (hb.left + hb.width / 2 - t.offsetWidth / 2) + 'px';
    t.style.top = (hb.top - 34) + 'px';
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => t.classList.add('hidden'), 1600);
  }

  /* ---------- 物品栏界面 ---------- */
  let invOpen = false;
  function toggleInv(game) {
    invOpen = !invOpen;
    el('inv').classList.toggle('hidden', !invOpen);
    if (invOpen) { renderInv(); game.releasePointer(); Audio2.SFX.open(); }
    else game.capturePointer();
  }
  function renderInv() {
    // 背包格
    let g = '';
    if (creative) {
      CREATIVE_BLOCKS.forEach((b, i) => {
        g += `<div class="slot" data-cb="${b}">${iconSVG(b)}</div>`;
      });
    } else {
      for (let i = HOT; i < INVSIZE; i++) g += slotHTML(slots[i], i, false);
    }
    el('invgrid').innerHTML = g;
    let hb = '';
    for (let i = 0; i < HOT; i++) hb += slotHTML(slots[i], i, i === selected);
    el('invhotbar').innerHTML = hb;
    renderRecipes();
    // 点击逻辑
    el('invgrid').querySelectorAll('.slot').forEach(s => {
      s.onclick = () => {
        Audio2.SFX.click();
        if (creative) {
          const b = s.dataset.cb;
          slots[selected] = { id: b, count: Infinity };
        } else {
          const i = +s.dataset.i;
          const tmp = slots[i]; slots[i] = slots[selected]; slots[selected] = tmp;
        }
        renderHotbar(); renderInv();
      };
    });
    el('invhotbar').querySelectorAll('.slot').forEach(s => {
      s.onclick = () => { Audio2.SFX.click(); selected = +s.dataset.i; renderHotbar(); renderInv(); };
    });
  }
  function renderRecipes() {
    if (creative) { el('craftlist').innerHTML = '<div style="color:#8a8a95;font-size:12px;padding:8px">创造模式：直接点击左侧方块放入快捷栏</div>'; return; }
    let h = '<div style="color:#ffd85e;font-size:13px;padding:4px 6px;text-shadow:1px 1px 0 #000">合成配方</div>';
    for (let ri = 0; ri < RECIPES.length; ri++) {
      const r = RECIPES[ri];
      const needTable = r.table && !window.Game.nearTable();
      const needFire = r.fire && !window.Game.nearFire();
      let ok = !needTable && !needFire;
      const costs = Object.entries(r.cost).map(([id, n]) => {
        const have = count(id);
        if (have < n) ok = false;
        return `${ITEMS[id].name}×${n}(${have === Infinity ? '∞' : have})`;
      }).join(' ');
      const cond = needTable ? ' <span style="color:#ff8a6a">需要工作台</span>' : (needFire ? ' <span style="color:#ff8a6a">需在篝火旁</span>' : '');
      h += `<div class="recipe${ok ? '' : ' no'}" data-r="${ri}">
        <div class="ric">${iconSVG(r.out)}</div>
        <div><div class="rt">${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''} <span style="color:#8a8a95">${r.desc}</span></div>
        <div class="rc">${costs}${cond}</div></div></div>`;
    }
    el('craftlist').innerHTML = h;
    el('craftlist').querySelectorAll('.recipe').forEach(rw => {
      rw.onclick = () => {
        const r = RECIPES[+rw.dataset.r];
        if (rw.classList.contains('no')) return;
        for (const [id, n] of Object.entries(r.cost)) take(id, n);
        give(r.out, r.n);
        Audio2.SFX.craft();
        renderInv();
        window.Game.onCraft(r.out);
      };
    });
  }

  /* ---------- HUD ---------- */
  function initHUD() {
    el('oxyicon').innerHTML = Assets.ui.oxy;
    el('fuelicon').innerHTML = Assets.ui.fuel;
    el('sunicon').innerHTML = Assets.ui.sunIcon;
    el('cockpit').innerHTML = Assets.ui.cockpit();
  }
  function updateHUD(P, world, loopRemain, creativeMode) {
    // 生命
    let hh = '';
    for (let i = 0; i < 5; i++) {
      const v = P.hp - i * 2;
      hh += Assets.ui.heart(v >= 2 ? 'full' : v >= 1 ? 'half' : 'empty');
    }
    el('hearts').innerHTML = creativeMode ? '' : hh;
    // 氧气 / 燃料
    const needO2 = world && !world.def.oxygen && !creativeMode;
    el('oxyrow').classList.toggle('hidden', !needO2 && P.oxygen >= 100);
    el('oxybar').style.width = P.oxygen + '%';
    el('fuelrow').classList.toggle('hidden', !(P.hasSuit && !creativeMode));
    el('fuelbar').style.width = P.fuel + '%';
    // 循环时钟
    el('loopclock').classList.toggle('hidden', creativeMode || loopRemain === null);
    if (loopRemain !== null) {
      const m = Math.max(0, Math.floor(loopRemain / 60)), s = Math.max(0, Math.floor(loopRemain % 60));
      el('looptime').textContent = m + ':' + String(s).padStart(2, '0');
      el('loopclock').classList.toggle('danger', loopRemain < 120);
    }
  }

  function setQuest(title, html) {
    el('questtitle').textContent = title;
    el('questtext').innerHTML = html;
  }
  function hint(text, ms) {
    const h = el('hint');
    const now = performance.now();
    if (!text) {
      if (h._until && now < h._until) return; // 保留计时提示
      h.classList.add('hidden'); return;
    }
    if (!ms && h._until && now < h._until) return; // 不覆盖计时提示
    if (ms) h._until = now + ms; else h._until = 0;
    h.textContent = text;
    h.classList.remove('hidden');
  }
  function subtitle(text, ms) {
    const s = el('subtitle');
    s.textContent = text;
    s.classList.remove('hidden');
    clearTimeout(s._t);
    s._t = setTimeout(() => s.classList.add('hidden'), ms || 3000);
  }
  function planetTitle(name) {
    const p = el('planetname');
    p.textContent = name;
    p.classList.remove('hidden');
    p.style.opacity = 1;
    setTimeout(() => { p.style.opacity = 0; }, 3200);
  }

  /* ---------- 对话 ---------- */
  let dlgQueue = [], dlgActive = false, dlgDone = null, dlgCharTimer = null, dlgLineFull = '', dlgTyping = false;
  function talk(npcId, lines, onDone) {
    dlgQueue = lines.slice();
    dlgDone = onDone || null;
    dlgActive = true;
    el('dialog').classList.remove('hidden');
    el('dlgportrait').innerHTML = Assets.portraitSVG(npcId);
    el('dlgname').textContent = Assets.NPCS[npcId].name;
    nextLine();
  }
  function nextLine() {
    if (dlgTyping) { // 快进
      clearInterval(dlgCharTimer);
      el('dlgtext').textContent = dlgLineFull;
      dlgTyping = false;
      return;
    }
    if (!dlgQueue.length) { closeDialog(); return; }
    dlgLineFull = dlgQueue.shift();
    let i = 0;
    dlgTyping = true;
    el('dlgtext').textContent = '';
    clearInterval(dlgCharTimer);
    dlgCharTimer = setInterval(() => {
      i++;
      el('dlgtext').textContent = dlgLineFull.slice(0, i);
      if (i % 2 === 0) Audio2.SFX.click();
      if (i >= dlgLineFull.length) { clearInterval(dlgCharTimer); dlgTyping = false; }
    }, 28);
  }
  function closeDialog() {
    dlgActive = false;
    el('dialog').classList.add('hidden');
    clearInterval(dlgCharTimer);
    if (dlgDone) { const f = dlgDone; dlgDone = null; f(); }
  }

  /* ---------- 翻译器 ---------- */
  const TABLET_TEXTS = {
    ember_tablet: {
      title: '古族石板 · 沙之穹顶',
      text: '「我们自远方而来，追寻一个比宇宙更古老的信号——深空之眼。\n它在群星之外低语。我们建起信标，将坐标的第一段刻于此处：\n【坐标片段 α · 已收录进飞船日志】\n愿后来者替我们看到它睁开。」',
      clue: 'alpha',
    },
    brittle_tablet: {
      title: '古族石板 · 晶洞',
      text: '「这颗星球的外壳终将碎裂，如同我们的时代终将结束。\n但知识可以穿越时间。我们把坐标的第二段藏进晶体的光里：\n【坐标片段 β · 已收录进飞船日志】\n记住：眼睛并不危险，它只是……在等待。」',
      clue: 'beta',
    },
    deep_tablet: {
      title: '古族石板 · 风暴之塔',
      text: '「若你读到这里，说明太阳已在燃尽的边缘。\n超新星不是终点——我们造的循环装置会把记忆送回二十二分钟之前。\n坐标的最后一段交给你：【坐标片段 γ · 已收录进飞船日志】\n三段合一，深空之眼将出现在你的星图上。去吧。」',
      clue: 'gamma',
    },
    eye_core: {
      title: '深空之眼 · 中枢',
      text: '「旅行者，欢迎。\n你带着一整个循环宇宙的记忆抵达此地。\n旧的太阳熄灭了，而你所见证的一切将成为新宇宙的种子。\n坐下来吧，篝火已经点好。」',
      clue: 'eye',
    },
  };
  let translatorOpen = false, trTimer = null;
  function showTablet(tid, onClue) {
    const t = TABLET_TEXTS[tid];
    if (!t) return;
    translatorOpen = true;
    el('translator').classList.remove('hidden');
    let gl = '';
    for (let i = 0; i < 14; i++) gl += Assets.ui.glyph(tid.length * 31 + i);
    el('glyphs').innerHTML = gl;
    const target = t.title + '\n\n' + t.text;
    let i = 0;
    el('translated').textContent = '';
    clearInterval(trTimer);
    Audio2.SFX.translate();
    trTimer = setInterval(() => {
      i += 2;
      el('translated').textContent = target.slice(0, i);
      if (i % 12 === 0) Audio2.SFX.translate();
      if (i >= target.length) { clearInterval(trTimer); if (onClue) onClue(t.clue); }
    }, 30);
    window.Game.releasePointer();
  }
  function closeTablet() {
    translatorOpen = false;
    clearInterval(trTimer);
    el('translator').classList.add('hidden');
    window.Game.capturePointer();
  }

  /* ---------- 飞船日志 ---------- */
  const LOG_DEFS = [
    { id: 'codes', title: '发射密码', icon: 'codes', text: '天文台的霍恩告诉了你飞船的发射密码。它跨越循环，永远属于你。' },
    { id: 'loop', title: '时间循环', icon: 'translator', text: '太阳每 22 分钟爆发一次超新星。古族的循环装置会把你的记忆送回起点。' },
    { id: 'alpha', title: '坐标片段 α', icon: 'scope', text: '燧沙星沙下穹顶中的石板。深空之眼坐标的第一段。' },
    { id: 'beta', title: '坐标片段 β', icon: 'scope', text: '碎空星晶洞里的石板。深空之眼坐标的第二段。' },
    { id: 'gamma', title: '坐标片段 γ', icon: 'scope', text: '风暴星古塔顶端的石板。深空之眼坐标的最后一段。' },
    { id: 'eye_unlock', title: '深空之眼 · 已定位', icon: 'codes', text: '三段坐标合一。星图上出现了新的目标——飞向它，结束这个循环。' },
  ];
  let logOpen = false;
  function toggleLog(knowledge) {
    logOpen = !logOpen;
    el('shiplog').classList.toggle('hidden', !logOpen);
    if (logOpen) {
      let h = '';
      for (const d of LOG_DEFS) {
        const has = knowledge.has(d.id);
        h += `<div class="logentry${has ? '' : ' locked'}">
          <div class="lic">${Assets.itemIcon(d.icon)}</div>
          <div><h4>${has ? d.title : '？？？'}</h4><p>${has ? d.text : '尚未发现的知识。'}</p></div></div>`;
      }
      el('logentries').innerHTML = h;
      window.Game.releasePointer();
      Audio2.SFX.open();
    } else window.Game.capturePointer();
  }

  /* ---------- 信号镜 ---------- */
  let scopeEl = null, scopeOn = false;
  function initScope() {
    scopeEl = document.createElement('div');
    scopeEl.id = 'scopeview';
    scopeEl.style.cssText = 'position:absolute;inset:0;z-index:25;pointer-events:none;display:none';
    scopeEl.innerHTML = Assets.ui.scopeOverlay() +
      '<div id="scopename" style="position:absolute;top:9.2%;left:50%;transform:translateX(-50%);color:#8affc1;font-size:15px;text-shadow:1px 1px 0 #000;width:300px;text-align:center"></div>' +
      '<div id="scopearrow" style="position:absolute;top:50%;left:50%;color:#8affc1;font-size:34px;text-shadow:2px 2px 0 #000;transform:translate(-50%,-50%)">◆</div>';
    el('hud').appendChild(scopeEl);
  }
  function toggleScope(on) {
    scopeOn = on;
    scopeEl.style.display = on ? 'block' : 'none';
    if (on) Audio2.SFX.open();
  }
  function updateScope(P, world, signals, eyeUnlocked) {
    if (!scopeOn || !world) return;
    let best = null, bestD = 1e9;
    for (const s of world.signals) {
      if (s.kind === 'eye' && !eyeUnlocked) continue;
      const dx = world.wrapD(s.x - P.x), dz = world.wrapD(s.z - P.z);
      const d = Math.hypot(dx, dz);
      if (d < bestD) { bestD = d; best = { ...s, dx, dz, d }; }
    }
    const nameEl = document.getElementById('scopename');
    const arrow = document.getElementById('scopearrow');
    if (!best) { nameEl.textContent = '（无信号）'; arrow.style.display = 'none'; return; }
    const angTo = Math.atan2(-best.dx, -best.dz);
    let rel = angTo - P.yaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    nameEl.textContent = `${best.name} · ${Math.round(best.d)}m`;
    arrow.style.display = 'block';
    const rx = Math.sin(rel) * 260;
    arrow.style.transform = `translate(${rx - 17}px,-17px) rotate(${rel > 0.2 ? 90 : rel < -0.2 ? -90 : 0}deg)`;
    arrow.textContent = Math.abs(rel) < 0.2 ? '◆' : '➤';
    if (Math.abs(rel) < 0.12 && !best._pinged) { Audio2.SFX.signalFound(); best._pinged = true; }
  }

  return {
    ITEMS, RECIPES, iconSVG,
    reset, give, take, count, selectedItem, selectSlot, renderHotbar,
    toggleInv, get invOpen() { return invOpen; }, closeInv(game) { if (invOpen) toggleInv(game); },
    initHUD, updateHUD, setQuest, hint, subtitle, planetTitle, showTooltip,
    talk, nextLine, get dlgActive() { return dlgActive; },
    showTablet, closeTablet, get translatorOpen() { return translatorOpen; },
    toggleLog, get logOpen() { return logOpen; }, LOG_DEFS,
    initScope, toggleScope, updateScope, get scopeOn() { return scopeOn; },
    TABLET_TEXTS,
  };
})();
