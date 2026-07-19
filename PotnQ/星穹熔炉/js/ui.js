/* ============================================================
   STARFORGE - ui.js
   HUD / 背包 / 合成 / 机器面板 / 科技树 / 贸易 / 提示
   ============================================================ */
'use strict';

const UI = (() => {
  const $ = id => document.getElementById(id);
  let cursorStack = null;        // 鼠标携带的物品
  let openMachine = null;
  let craftCat = 'all';
  let craftQueue = [];           // {recipe, t}

  // ---------- 通用 ----------
  function anyPanelOpen(){
    return ['invPanel','machinePanel','techPanel','tradePanel','pausePanel','helpPanel','creativePanel','savePanel','galaxyPanel','settingsPanel','netPanel','mapPanel']
      .some(id => !$(id).classList.contains('hidden'));
  }
  function closeAll(){
    ['invPanel','machinePanel','techPanel','tradePanel','pausePanel','helpPanel','creativePanel','savePanel','galaxyPanel','settingsPanel','netPanel','mapPanel']
      .forEach(id => $(id).classList.add('hidden'));
    openMachine = null;
    hideTooltip();
    dropCursor();
  }
  function toggle(id){
    const el = $(id);
    const willOpen = el.classList.contains('hidden');
    closeAll();
    if (willOpen){
      el.classList.remove('hidden');
      Sound.play('uiOpen');
      if (id === 'invPanel') refreshInv();
      if (id === 'techPanel') refreshTech();
      document.exitPointerLock && document.exitPointerLock();
    } else {
      Sound.play('uiClose');
      Game.lockPointer();
    }
    return willOpen;
  }
  function dropCursor(){
    if (cursorStack){ Player.addItem(cursorStack.item, cursorStack.n, true); cursorStack = null; updateGhost(); }
  }

  // ---------- Tooltip ----------
  const tooltip = () => $('tooltip');
  function showTooltip(e, itemId, extra){
    const it = ITEMS[itemId];
    if (!it) return;
    const t = tooltip();
    t.innerHTML = `<div class="tt-name">${it.name}</div><div class="tt-cat">${{res:'资源',mat:'材料',blk:'方块',mach:'机器'}[it.cat]||''} · 基准价 ₪${it.price}</div><div class="tt-desc">${it.desc || ''}${extra ? '<br>' + extra : ''}</div>`;
    t.classList.remove('hidden');
    moveTooltip(e);
  }
  function moveTooltip(e){
    const t = tooltip();
    t.style.left = Math.min(window.innerWidth - 260, e.clientX + 16) + 'px';
    t.style.top = Math.min(window.innerHeight - 120, e.clientY + 12) + 'px';
  }
  function hideTooltip(){ tooltip().classList.add('hidden'); }

  // ---------- 拾取通知 ----------
  function pickupToast(item, n){
    const box = $('pickups');
    // 合并最近同类
    const last = box.firstChild;
    if (last && last.dataset.item === item){
      last.dataset.n = +last.dataset.n + n;
      last.querySelector('.pn').textContent = '+' + last.dataset.n;
      clearTimeout(+last.dataset.tm);
      last.dataset.tm = setTimeout(() => last.remove(), 2600);
      return;
    }
    const el = document.createElement('div');
    el.className = 'pickup';
    el.dataset.item = item; el.dataset.n = n;
    el.appendChild(Icons.img(item));
    const span = document.createElement('span');
    span.textContent = ITEMS[item].name;
    el.appendChild(span);
    const pn = document.createElement('span'); pn.className = 'pn'; pn.textContent = '+' + n;
    el.appendChild(pn);
    box.prepend(el);
    while (box.children.length > 5) box.lastChild.remove();
    el.dataset.tm = setTimeout(() => el.remove(), 2600);
  }
  function bigMessage(title, sub, dur = 3200){
    const el = $('bigMsg');
    el.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    el.classList.remove('hidden');
    clearTimeout(el._tm);
    el._tm = setTimeout(() => el.classList.add('hidden'), dur);
  }

  // ---------- 槽位渲染 ----------
  function fillSlot(el, stack){
    el.innerHTML = el.querySelector('.num') ? el.querySelector('.num').outerHTML : '';
    if (stack){
      el.appendChild(Icons.img(stack.item));
      const c = document.createElement('span');
      c.className = 'cnt';
      c.textContent = stack.n > 1 ? stack.n : '';
      el.appendChild(c);
    }
  }
  function bindSlotEvents(el, getStack, setStack, idx){
    el.onmouseenter = e => { const s = getStack(); if (s) { showTooltip(e, s.item); Sound.play('hover'); } };
    el.onmousemove = moveTooltip;
    el.onmouseleave = hideTooltip;
    el.oncontextmenu = e => e.preventDefault();
    el.onmousedown = e => {
      e.preventDefault();
      const s = getStack();
      Sound.play('uiClick');
      if (e.shiftKey && s && idx !== undefined){
        // 快捷移动：热栏<->背包
        const target = idx < 9 ? 9 : 0;
        const inv = Player.inv;
        for (let i = target; i < (target === 0 ? 9 : 36); i++){
          if (inv[i] && inv[i].item === s.item && inv[i].n < ITEMS[s.item].stack){
            const add = Math.min(s.n, ITEMS[s.item].stack - inv[i].n);
            inv[i].n += add; s.n -= add;
            if (!s.n){ setStack(null); break; }
          }
        }
        if (getStack()){
          for (let i = target; i < (target === 0 ? 9 : 36); i++){
            if (!inv[i]){ inv[i] = { ...getStack() }; setStack(null); break; }
          }
        }
        refreshAll(); return;
      }
      if (e.button === 0){
        if (!cursorStack && s){ cursorStack = { ...s }; setStack(null); }
        else if (cursorStack && !s){ setStack({ ...cursorStack }); cursorStack = null; }
        else if (cursorStack && s){
          if (s.item === cursorStack.item){
            const add = Math.min(cursorStack.n, ITEMS[s.item].stack - s.n);
            s.n += add; cursorStack.n -= add;
            if (!cursorStack.n) cursorStack = null;
          } else {
            const tmp = { ...s }; setStack({ ...cursorStack }); cursorStack = tmp;
          }
        }
      } else if (e.button === 2){
        if (!cursorStack && s){
          const half = Math.ceil(s.n / 2);
          cursorStack = { item: s.item, n: half };
          s.n -= half;
          if (!s.n) setStack(null);
        } else if (cursorStack){
          if (!s){ setStack({ item: cursorStack.item, n: 1 }); cursorStack.n--; }
          else if (s.item === cursorStack.item && s.n < ITEMS[s.item].stack){ s.n++; cursorStack.n--; }
          if (cursorStack && !cursorStack.n) cursorStack = null;
        }
      }
      updateGhost();
      refreshAll();
    };
  }
  function updateGhost(){
    const g = $('dragGhost');
    if (cursorStack){
      g.innerHTML = '';
      g.appendChild(Icons.img(cursorStack.item));
      if (cursorStack.n > 1){
        const c = document.createElement('span');
        c.className = 'cnt'; c.style.cssText = 'position:absolute;right:0;bottom:0;color:#fff;font:bold 12px Consolas;text-shadow:1px 1px 2px #000';
        c.textContent = cursorStack.n;
        g.appendChild(c);
      }
      g.classList.remove('hidden');
    } else g.classList.add('hidden');
  }
  document.addEventListener('mousemove', e => {
    const g = $('dragGhost');
    if (!g.classList.contains('hidden')){ g.style.left = (e.clientX - 22) + 'px'; g.style.top = (e.clientY - 22) + 'px'; }
  });

  // ---------- 快捷栏 ----------
  function laserIcon(){
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const x = c.getContext('2d');
    const px = (a, b, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    px(6, 14, '#4e5a63', 16, 6);            // 机身
    px(8, 12, '#68747d', 12, 2);            // 上盖
    px(20, 15, '#333d44', 8, 4);            // 枪管
    px(27, 14, '#c9641a', 2, 6);            // 枪口环
    px(9, 20, '#333d44', 3, 6);             // 握把
    px(10, 15, '#35e0e8', 5, 3);            // 能量屏
    px(5, 15, '#c9641a', 2, 4);             // 尾饰
    return c;
  }
  function buildHotbar(){
    const hb = $('hotbar');
    hb.innerHTML = '';
    for (let i = 0; i < 9; i++){
      const el = document.createElement('div');
      el.className = 'hslot';
      el.innerHTML = `<span class="num">${i + 1}</span>`;
      el.onclick = () => { Player.hotIdx = i; refreshHotbar(); showItemName(); Sound.play('uiClick'); };
      hb.appendChild(el);
    }
    // 固定栏位 0：采矿激光（排在 9 号之后，滚轮循环顺手）
    const laser = document.createElement('div');
    laser.className = 'hslot laser';
    laser.innerHTML = `<span class="num">0</span>`;
    laser.appendChild(laserIcon());
    laser.title = '采矿激光（固定栏位·按 0）';
    laser.onclick = () => { Player.hotIdx = -1; refreshHotbar(); showItemName(); Sound.play('uiClick'); };
    hb.appendChild(laser);
  }
  function refreshHotbar(){
    const hb = $('hotbar');
    if (!hb.children.length) buildHotbar();
    hb.children[9].classList.toggle('sel', Player.hotIdx === -1);
    for (let i = 0; i < 9; i++){
      const el = hb.children[i];
      el.classList.toggle('sel', i === Player.hotIdx);
      fillSlot(el, Player.inv[i]);
    }
  }
  // 切换物品名称标签（MC 风格短暂显示）
  let itemLabelTm = null;
  function showItemName(){
    const el = $('itemLabel');
    if (!el) return;
    let name;
    if (Player.hotIdx === -1) name = '⚒ 采矿激光';
    else {
      const s = Player.inv[Player.hotIdx];
      name = s ? ITEMS[s.item].name + (ITEMS[s.item].block ? '' : '') : '';
    }
    if (!name){ el.classList.remove('show'); return; }
    el.textContent = name;
    el.classList.add('show');
    clearTimeout(itemLabelTm);
    itemLabelTm = setTimeout(() => el.classList.remove('show'), 900);
  }

  // ---------- 背包 ----------
  function buildInv(){
    const hot = $('invHotRow'), grid = $('invGrid');
    hot.innerHTML = ''; grid.innerHTML = '';
    for (let i = 0; i < 36; i++){
      const el = document.createElement('div');
      el.className = 'slot';
      const idx = i;
      bindSlotEvents(el, () => Player.inv[idx], v => Player.inv[idx] = v, idx);
      (i < 9 ? hot : grid).appendChild(el);
    }
    // 充能面板（生存模式）
    buildChargeList();
    // 合成分类
    const cats = [['all','全部'],['mat','材料'],['mach','机器'],['blk','方块']];
    const tabs = $('craftTabs');
    tabs.innerHTML = '';
    for (const [k, name] of cats){
      const b = document.createElement('button');
      b.className = 'ctab' + (k === craftCat ? ' on' : '');
      b.textContent = name;
      b.onclick = () => { craftCat = k; Sound.play('uiClick'); buildInv(); refreshInv(); };
      tabs.appendChild(b);
    }
    // 合成列表
    const list = $('craftList');
    list.innerHTML = '';
    for (const r of RECIPES){
      if (r.where !== 'hand' && r.where !== 'both') continue;
      if (r.hidden) continue;
      const outItem = Object.keys(r.out)[0];
      if (craftCat !== 'all' && ITEMS[outItem].cat !== craftCat) continue;
      const el = document.createElement('div');
      el.className = 'recipe';
      el.dataset.rid = r.id;
      const icon = document.createElement('div'); icon.className = 'ricon';
      icon.appendChild(Icons.img(outItem));
      el.appendChild(icon);
      const info = document.createElement('div'); info.className = 'rinfo';
      info.innerHTML = `<div class="rname">${ITEMS[outItem].name}${r.out[outItem] > 1 ? ' ×' + r.out[outItem] : ''}</div><div class="rcost"></div>`;
      el.appendChild(info);
      const btn = document.createElement('div'); btn.className = 'rbtn'; btn.textContent = '合成';
      el.appendChild(btn);
      el.onmouseenter = e => showTooltip(e, outItem, r.tech && !Game.techDone(r.tech) ? `<span style="color:#ff5555">需要科技：${TECH[r.tech].name}</span>` : '');
      el.onmousemove = moveTooltip;
      el.onmouseleave = hideTooltip;
      el.onclick = e => {
        const n = e.shiftKey ? 5 : 1;
        let made = 0;
        for (let i = 0; i < n; i++){ if (tryCraft(r)) made++; else break; }
        if (made) Sound.play('craft'); else Sound.play('uiError');
        refreshAll();
      };
      list.appendChild(el);
    }
  }
  function tryCraft(r){
    if (r.tech && !Game.techDone(r.tech)) return false;
    if (!Player.hasItems(r.in)) return false;
    Player.payItems(r.in);
    // 难度产出倍率：合成产物整体按倍率放大
    for (const k in r.out) Player.addItem(k, r.out[k] * Game.dropMult, true);
    const outItem = Object.keys(r.out)[0];
    pickupToast(outItem, r.out[outItem] * Game.dropMult);
    return true;
  }
  function buildChargeList(){
    const box = $('chargeList');
    const sec = $('chargeSec');
    box.innerHTML = '';
    if (window.Game && Game.creative){
      sec.style.display = 'none'; box.style.display = 'none';
      return;
    }
    sec.style.display = ''; box.style.display = '';
    for (const kind in Player.CHARGE_DEFS){
      const d = Player.CHARGE_DEFS[kind];
      const row = document.createElement('div');
      row.className = 'charge-row';
      row.dataset.kind = kind;
      row.appendChild(Icons.img(d.item));
      const nm = document.createElement('span'); nm.className = 'ch-name'; nm.textContent = d.name;
      row.appendChild(nm);
      const bar = document.createElement('div'); bar.className = 'ch-bar';
      bar.appendChild(document.createElement('div'));
      row.appendChild(bar);
      const btn = document.createElement('button'); btn.className = 'ch-btn';
      btn.textContent = `充能 ${ITEMS[d.item].name}×${d.cost}`;
      btn.onclick = () => {
        if (Player.chargeStat(kind)){ Sound.play('uiClick'); refreshAll(); }
        else Sound.play('uiError');
      };
      row.appendChild(btn);
      box.appendChild(row);
    }
  }
  function refreshChargeList(){
    const box = $('chargeList');
    for (const row of box.children){
      const kind = row.dataset.kind;
      const d = Player.CHARGE_DEFS[kind];
      const v = Player.stats[d.stat] / Player.stats[d.max];
      row.querySelector('.ch-bar div').style.width = (v * 100).toFixed(0) + '%';
      row.querySelector('.ch-btn').disabled = !Player.canCharge(kind);
    }
  }
  function refreshInv(){
    const hot = $('invHotRow'), grid = $('invGrid');
    if (!hot.children.length) buildInv();
    for (let i = 0; i < 9; i++) fillSlot(hot.children[i], Player.inv[i]);
    for (let i = 9; i < 36; i++) fillSlot(grid.children[i - 9], Player.inv[i]);
    refreshChargeList();
    // 配方可用性
    for (const el of $('craftList').children){
      const r = RECIPE_BY_ID[el.dataset.rid];
      const locked = r.tech && !Game.techDone(r.tech);
      el.classList.toggle('locked', locked || !Player.hasItems(r.in));
      const cost = el.querySelector('.rcost');
      cost.innerHTML = locked
        ? `<span class="no">🔒 ${TECH[r.tech].name}</span>`
        : Object.keys(r.in).map(k => `<span class="${Player.countItem(k) >= r.in[k] ? 'ok' : 'no'}">${ITEMS[k].name}×${r.in[k]}</span>`).join(' ');
    }
  }

  // ---------- 机器面板 ----------
  // 面板通用槽位绑定（支持 Shift 快速转移动作）
  function bindPanelSlot(el, getStack, setStack, shiftAction){
    el.onmouseenter = e => { const s = getStack(); if (s) showTooltip(e, s.item); };
    el.onmousemove = moveTooltip;
    el.onmouseleave = hideTooltip;
    el.oncontextmenu = e => e.preventDefault();
    el.onmousedown = e => {
      e.preventDefault();
      Sound.play('uiClick');
      const s = getStack();
      if (e.shiftKey && s && shiftAction){
        shiftAction(s, setStack);
      } else if (e.button === 0){
        if (!cursorStack && s){ cursorStack = { ...s }; setStack(null); }
        else if (cursorStack && !s){ setStack({ ...cursorStack }); cursorStack = null; }
        else if (cursorStack && s){
          if (s.item === cursorStack.item){
            const add = Math.min(cursorStack.n, ITEMS[s.item].stack - s.n);
            setStack({ item: s.item, n: s.n + add });
            cursorStack.n -= add;
            if (!cursorStack.n) cursorStack = null;
          } else { const tmp = { ...s }; setStack({ ...cursorStack }); cursorStack = tmp; }
        }
      } else if (e.button === 2){
        if (!cursorStack && s){
          const half = Math.ceil(s.n / 2);
          cursorStack = { item: s.item, n: half };
          setStack(s.n - half > 0 ? { item: s.item, n: s.n - half } : null);
        } else if (cursorStack){
          if (!s){ setStack({ item: cursorStack.item, n: 1 }); cursorStack.n--; }
          else if (s.item === cursorStack.item && s.n < ITEMS[s.item].stack){ setStack({ item: s.item, n: s.n + 1 }); cursorStack.n--; }
          if (cursorStack && !cursorStack.n) cursorStack = null;
        }
      }
      updateGhost();
      buildMachineBody();
      refreshHotbar();
    };
  }
  function openMachinePanel(m){
    closeAll();
    openMachine = m;          // 必须在 closeAll 之后（closeAll 会清空 openMachine）
    $('machinePanel').classList.remove('hidden');
    Sound.play(m.type === 'chest' || m.type === 'collector' ? 'openChest' : 'uiOpen');
    document.exitPointerLock && document.exitPointerLock();
    buildMachineBody();
  }
  function mslot(labelText, getStack, setStack, acceptFilter){
    const el = document.createElement('div');
    el.className = 'mslot';
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = labelText;
    el.appendChild(lbl);
    el.onmouseenter = e => { const s = getStack(); if (s) showTooltip(e, s.item); };
    el.onmousemove = moveTooltip;
    el.onmouseleave = hideTooltip;
    el.oncontextmenu = e => e.preventDefault();
    el.onmousedown = e => {
      e.preventDefault();
      Sound.play('uiClick');
      const s = getStack();
      // Shift+左键：整组取回背包
      if (e.shiftKey && s){
        Player.addItem(s.item, s.n, true);
        setStack(null);
        Sound.play('insert');
        updateGhost();
        buildMachineBody();
        refreshHotbar();
        return;
      }
      if (e.button === 0){
        if (!cursorStack && s){ cursorStack = { ...s }; setStack(null); }
        else if (cursorStack && (!acceptFilter || acceptFilter(cursorStack.item))){
          if (!s){ setStack({ ...cursorStack }); cursorStack = null; }
          else if (s.item === cursorStack.item){ setStack({ item: s.item, n: s.n + cursorStack.n }); cursorStack = null; }
          else { const tmp = { ...s }; setStack({ ...cursorStack }); cursorStack = tmp; }
        } else if (cursorStack) Sound.play('uiError');
      }
      updateGhost();
      buildMachineBody();
      refreshHotbar();
    };
    const s = getStack();
    if (s){
      el.appendChild(Icons.img(s.item));
      const c = document.createElement('span'); c.className = 'cnt'; c.textContent = s.n > 1 ? s.n : '';
      el.appendChild(c);
    }
    return el;
  }
  function stackRef(obj, key){
    return [() => obj[key], v => obj[key] = v];
  }
  function buildMachineBody(){
    const m = openMachine;
    if (!m) return;
    const body = $('machineBody');
    const titles = { furnace: '熔炉', miner: '自动采矿机', assembler: '装配机', refinery: '精炼厂', chest: '储物箱', reactor: '核子反应堆', belt: '传送带', solar: '太阳能板', launchpad: '发射平台', wind: '风力涡轮机', burner: '火力发电机', beacon: '信标', lumberbot: '伐木机器人', collector: '收集点' };
    $('machineTitle').textContent = '◈ ' + (titles[m.type] || m.type);
    body.innerHTML = '';
    const d = m.data;

    if (m.type === 'furnace'){
      const flow = document.createElement('div'); flow.className = 'mach-flow';
      flow.appendChild(mslot('原料', ...stackRef(d, 'in')));
      const fireCol = document.createElement('div');
      fireCol.style.textAlign = 'center';
      fireCol.innerHTML = `<div style="font-size:22px">${m.active ? '🔥' : '🧯'}</div>`;
      fireCol.appendChild(mslot('燃料', ...stackRef(d, 'fuel'), it => !!FUEL_VALUE[it]));
      flow.appendChild(fireCol);
      const arrow = document.createElement('div'); arrow.className = 'marrow'; arrow.textContent = '➤'; flow.appendChild(arrow);
      flow.appendChild(mslot('产出', ...stackRef(d, 'out')));
      body.appendChild(flow);
      const prog = document.createElement('div'); prog.className = 'mprog';
      prog.innerHTML = `<div style="width:${(d.prog * 100).toFixed(0)}%"></div>`;
      body.appendChild(prog);
      const stat = document.createElement('div'); stat.className = 'mstat';
      stat.innerHTML = `燃烧余量 ${Math.max(0, d.burn).toFixed(1)}s · 燃料：碳(4s) 煤(16s)`;
      body.appendChild(stat);
    }
    else if (m.type === 'miner'){
      const flow = document.createElement('div'); flow.className = 'mach-flow';
      flow.appendChild(mslot('缓存', ...stackRef(d, 'out')));
      body.appendChild(flow);
      const below = World.getDef(m.x, m.y - 1, m.z);
      const stat = document.createElement('div'); stat.className = 'mstat';
      stat.innerHTML = below.ore
        ? `正在开采：<b style="color:#7dff8a">${below.name}</b> · 矿脉余量 ${300 - d.deposit}<br>耗电 8kW · 电力满足率 ${(Factory.power.sat * 100).toFixed(0)}%`
        : `<span class="warn">⚠ 下方没有矿脉！请放置在矿石方块上</span>`;
      body.appendChild(stat);
    }
    else if (m.type === 'assembler' || m.type === 'refinery'){
      // 配方选择
      const pick = document.createElement('div'); pick.className = 'mrecipe-pick';
      const where = m.type === 'assembler' ? ['both', 'assembler'] : ['refinery'];
      for (const r of RECIPES){
        if (!where.includes(r.where)) continue;
        if (r.tech && !Game.techDone(r.tech)) continue;
        const outItem = Object.keys(r.out)[0];
        const el = document.createElement('div');
        el.className = 'mrp' + (d.recipe === r.id ? ' on' : '');
        el.appendChild(Icons.img(outItem));
        el.onmouseenter = e => showTooltip(e, outItem, Object.keys(r.in).map(k => `${ITEMS[k].name}×${r.in[k]}`).join(' '));
        el.onmousemove = moveTooltip;
        el.onmouseleave = hideTooltip;
        el.onclick = () => {
          // 切换/取消配方：退还格内材料（含制作中已扣除的一组），背包放不下就掉在机器旁
          const refund = (item, n) => {
            if (n <= 0) return;
            const added = Player.addItem(item, n, true);
            if (added < n) Player.spawnDrop(m.x + 0.5, m.y + 1.2, m.z + 0.5, item, n - added);
          };
          const old = d.recipe ? RECIPE_BY_ID[d.recipe] : null;
          if (old){
            for (const k in d.in) refund(k, d.in[k] || 0);
            if (d.prog > 0) for (const k in old.in) refund(k, old.in[k]);
          }
          d.in = {};
          d.recipe = d.recipe === r.id ? null : r.id;
          d.prog = 0;
          Sound.play('uiClick');
          buildMachineBody();
        };
        pick.appendChild(el);
      }
      body.appendChild(pick);
      if (d.recipe){
        const r = RECIPE_BY_ID[d.recipe];
        const flow = document.createElement('div'); flow.className = 'mach-flow';
        for (const k of Object.keys(r.in)){
          flow.appendChild(mslot(`${ITEMS[k].name} ${d.in[k] || 0}/${r.in[k]}`,
            () => (d.in[k] ? { item: k, n: d.in[k] } : null),
            v => { d.in[k] = v ? v.n : 0; },
            it => it === k));
        }
        const arrow = document.createElement('div'); arrow.className = 'marrow'; arrow.textContent = '➤'; flow.appendChild(arrow);
        flow.appendChild(mslot('产出', ...stackRef(d, 'out')));
        body.appendChild(flow);
        const prog = document.createElement('div'); prog.className = 'mprog';
        prog.innerHTML = `<div style="width:${(d.prog * 100).toFixed(0)}%"></div>`;
        body.appendChild(prog);
      }
      const stat = document.createElement('div'); stat.className = 'mstat';
      stat.innerHTML = `耗电 ${m.type === 'assembler' ? 12 : 20}kW · 电力满足率 ${(Factory.power.sat * 100).toFixed(0)}%${Factory.power.sat < 1 ? ' <span class="warn">(电力不足，减速运行)</span>' : ''}`;
      body.appendChild(stat);
    }
    else if (m.type === 'chest' || m.type === 'collector'){
      const grid = document.createElement('div');
      grid.className = 'slot-grid';
      grid.style.margin = '10px';
      for (let i = 0; i < d.slots.length; i++){
        const idx = i;
        const el = document.createElement('div');
        el.className = 'slot';
        bindPanelSlot(el,
          () => d.slots[idx],
          v => d.slots[idx] = v,
          (s, setStack) => {           // Shift：取回背包
            Player.addItem(s.item, s.n, true);
            setStack(null);
            Sound.play('insert');
          });
        fillSlot(el, d.slots[idx]);
        grid.appendChild(el);
      }
      body.appendChild(grid);
      if (m.type === 'collector'){
        const stat = document.createElement('div'); stat.className = 'mstat';
        stat.innerHTML = '伐木机器人自动送货至此 · 库存自动输出到<b>面前</b>的传送带/机器（放置朝向）';
        body.appendChild(stat);
      }
    }
    else if (m.type === 'lumberbot'){
      const stateName = { scan: '巡林搜索中', move: '前往目标树', chop: '伐木中 🪚', deliver: '前往收集点卸货', wait: '待机' };
      const bs = m.bot ? (stateName[m.bot.state] || m.bot.state) : '初始化…';
      const hasCol = (() => { for (const c of Factory.machines.values()) if (c.type === 'collector') return true; return false; })();
      const stat = document.createElement('div'); stat.className = 'mstat';
      stat.style.padding = '16px';
      stat.innerHTML = `<div style="font-size:26px;margin-bottom:8px">🤖</div>` +
        `状态：<b style="color:#7dff8a">${bs}</b><br>` +
        `携带碳素：<b style="color:#ffd94d">${m.data.cargo || 0}</b> / 40（满载自动卸货）<br>` +
        `工作半径 32 格 · 锯倒树干与树冠 · 树干每段碳×4 · 整树完成 +6` +
        (hasCol ? '' : '<br><span class="warn">⚠ 附近没有收集点！请放置收集点方块接收木料</span>');
      body.appendChild(stat);
    }
    else if (m.type === 'reactor'){
      const stat = document.createElement('div'); stat.className = 'mstat';
      stat.style.padding = '18px';
      stat.innerHTML = `<div style="font-size:30px;margin-bottom:8px">☢</div>核燃料余量：<b style="color:#7dff8a">${Math.max(0, d.fuel).toFixed(0)}s</b><br>输出 100kW`;
      body.appendChild(stat);
      const btn = document.createElement('button');
      btn.className = 'boot-btn small';
      btn.style.margin = '0 auto 14px'; btn.style.display = 'block';
      btn.textContent = '投入铀-235（+60s）';
      btn.onclick = () => {
        if (Player.removeItem('uranium', 1)){ d.fuel += 60; Sound.play('insert'); buildMachineBody(); }
        else Sound.play('uiError');
      };
      body.appendChild(btn);
    }
    else if (m.type === 'burner'){
      const flow = document.createElement('div'); flow.className = 'mach-flow';
      const fireCol = document.createElement('div');
      fireCol.style.textAlign = 'center';
      fireCol.innerHTML = `<div style="font-size:22px">${m.active ? '🔥' : '🧯'}</div>`;
      fireCol.appendChild(mslot('燃料', ...stackRef(d, 'fuel'), it => !!FUEL_VALUE[it]));
      flow.appendChild(fireCol);
      body.appendChild(flow);
      const prog = document.createElement('div'); prog.className = 'mprog';
      prog.innerHTML = `<div style="width:${d.burnMax ? Math.max(0, d.burn / d.burnMax * 100).toFixed(0) : 0}%"></div>`;
      body.appendChild(prog);
      const stat = document.createElement('div'); stat.className = 'mstat';
      stat.innerHTML = m.active
        ? `正在发电：<b style="color:#7dff8a">25kW</b> · 燃烧余量 ${Math.max(0, d.burn).toFixed(1)}s`
        : `<span class="warn">待机 — 投入煤/碳开始发电</span>`;
      body.appendChild(stat);
    }
    else if (m.type === 'wind'){
      const stat = document.createElement('div'); stat.className = 'mstat'; stat.style.padding = '20px';
      stat.innerHTML = `<div style="font-size:26px;margin-bottom:6px">🌀</div>当前输出：<b style="color:#7dff8a">${(d.out || 0).toFixed(1)}kW</b><br><span style="color:#5f7d8c">海拔越高风力越强 · 输出随阵风波动</span>`;
      body.appendChild(stat);
    }
    else if (m.type === 'beacon'){
      const wrap = document.createElement('div'); wrap.className = 'mstat'; wrap.style.padding = '16px'; wrap.style.textAlign = 'center';
      const flag = document.createElement('div');
      flag.style.cssText = 'font-size:26px;margin-bottom:10px;color:#ffd94d';
      flag.textContent = '⚑';
      wrap.appendChild(flag);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;margin-bottom:12px';
      const lbl = document.createElement('span'); lbl.textContent = '名称';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.maxLength = 12; inp.value = d.label || '标记点';
      inp.style.cssText = 'background:#0d1626;border:1px solid #2a4a6a;color:#dfe9f2;padding:6px 10px;border-radius:6px;width:150px;font:inherit;outline:none';
      inp.onchange = () => {
        d.label = inp.value.trim().slice(0, 12) || '标记点';
        Game.saveBeaconState();
        Sound.play('uiClick');
      };
      inp.onkeydown = e => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') inp.blur();
      };
      row.appendChild(lbl); row.appendChild(inp);
      wrap.appendChild(row);
      const btn = document.createElement('button');
      btn.className = 'boot-btn small';
      btn.style.cssText = 'display:block;margin:0 auto 10px';
      btn.textContent = d.perm ? '★ 全星系显示：开' : '☆ 全星系显示：关';
      btn.onclick = () => {
        d.perm = !d.perm;
        Game.saveBeaconState();
        Sound.play('uiClick');
        buildMachineBody();
      };
      wrap.appendChild(btn);
      const tip = document.createElement('div');
      tip.style.cssText = 'color:#5f7d8c;font-size:12px;line-height:1.7;text-align:left';
      tip.textContent = '开启全星系显示后，无论身处太空还是其他星球地表，此信标都会精确标注在其所在星球上（抬头即见）。跃迁到其他星系后不再显示。';
      wrap.appendChild(tip);
      body.appendChild(wrap);
    }
    else {
      const stat = document.createElement('div'); stat.className = 'mstat'; stat.style.padding = '20px';
      stat.textContent = m.type === 'solar' ? '白天输出 10kW，夜间休眠。' :
        m.type === 'launchpad' ? '将飞船降落于此平台，起飞不消耗发射燃料。' : '物品将沿传送方向移动，靠近其他传送带会自动转弯/爬坡。';
      body.appendChild(stat);
    }

    // ---- 内嵌背包（与机器互动）----
    if (m.type !== 'solar' && m.type !== 'wind' && m.type !== 'launchpad'){
      const sec = document.createElement('div');
      sec.className = 'inv-sec';
      sec.style.margin = '12px 12px 8px';
      sec.innerHTML = '外骨骼背包 · <span style="color:#5f7d8c;text-transform:none">Shift+左键快速存入 / 取出</span>';
      body.appendChild(sec);
      const grid = document.createElement('div');
      grid.className = 'slot-grid';
      grid.style.margin = '0 12px 12px';
      for (let i = 0; i < 36; i++){
        const idx = i;
        const el = document.createElement('div');
        el.className = 'slot';
        bindPanelSlot(el,
          () => Player.inv[idx],
          v => Player.inv[idx] = v,
          (s, setStack) => {
            // Shift：尽可能塞入机器
            let moved = 0;
            while (s.n > 0 && Factory.canMachineAccept(m, s.item)){
              if (!Factory.machineInsert(m, s.item)) break;
              s.n--; moved++;
              if (m.type === 'belt') break;
            }
            setStack(s.n > 0 ? { item: s.item, n: s.n } : null);
            Sound.play(moved ? 'insert' : 'uiError');
          });
        fillSlot(el, Player.inv[idx]);
        grid.appendChild(el);
      }
      body.appendChild(grid);
    }
  }

  // ---------- 科技树 ----------
  let researching = null;   // {id, t}
  function refreshTech(){
    const nodesBox = $('techNodes'), svg = $('techLines');
    nodesBox.innerHTML = '';
    svg.innerHTML = '';
    $('dataCount').textContent = `⬡ 研究数据 ×${Player.countItem('data')}`;
    for (const id in TECH){
      const t = TECH[id];
      const done = Game.techDone(id);
      const reqOk = t.req.every(r => Game.techDone(r));
      const el = document.createElement('div');
      el.className = 'tnode ' + (done ? 'done' : reqOk ? 'avail' : 'locked');
      el.style.left = t.pos[0] + 'px';
      el.style.top = t.pos[1] + 'px';
      const icon = document.createElement('div'); icon.className = 'ticon';
      icon.appendChild(Icons.img(t.icon));
      el.appendChild(icon);
      const nm = document.createElement('div'); nm.className = 'tname'; nm.textContent = t.name;
      el.appendChild(nm);
      const cost = document.createElement('div'); cost.className = 'tcost';
      if (done) cost.innerHTML = '<span class="tdone">✔ 已解锁</span>';
      else if (researching && researching.id === id) cost.textContent = `研究中 ${(researching.t / t.time * 100).toFixed(0)}%`;
      else cost.textContent = Object.keys(t.cost).map(k => `${ITEMS[k].name}×${t.cost[k]}`).join(' ') || '免费';
      el.appendChild(cost);
      el.onmouseenter = e => {
        const tt = tooltip();
        tt.innerHTML = `<div class="tt-name">${t.name}</div><div class="tt-desc">${t.desc}</div>` +
          (t.req.length ? `<div style="color:#5f7d8c;font-size:11px;margin-top:4px">前置：${t.req.map(r => TECH[r].name).join('、')}</div>` : '');
        tt.classList.remove('hidden');
        moveTooltip(e);
      };
      el.onmousemove = moveTooltip;
      el.onmouseleave = hideTooltip;
      el.onclick = () => {
        if (done || !reqOk || researching) { Sound.play('uiError'); return; }
        if (!Player.hasItems(t.cost)){ Sound.play('uiError'); bigMessage('材料不足', '需要 ' + Object.keys(t.cost).map(k => `${ITEMS[k].name}×${t.cost[k]}`).join(' ')); return; }
        Player.payItems(t.cost);
        researching = { id, t: 0 };
        Sound.play('uiClick');
        refreshTech();
      };
      nodesBox.appendChild(el);
      // 连线
      for (const r of t.req){
        const p = TECH[r];
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', p.pos[0] + 59); line.setAttribute('y1', p.pos[1] + 45);
        line.setAttribute('x2', t.pos[0] + 59); line.setAttribute('y2', t.pos[1] + 45);
        line.setAttribute('stroke', done ? '#7dff8a66' : Game.techDone(r) ? '#ffb34766' : '#24405a');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', done ? '' : '6 4');
        svg.appendChild(line);
      }
    }
  }
  function updateResearch(dt){
    if (!researching) return;
    const t = TECH[researching.id];
    researching.t += dt;
    if (researching.t >= t.time){
      Game.completeTech(researching.id);
      researching = null;
      Sound.play('research');
      bigMessage('科技解锁', TECH[Game.lastTech].name + ' — ' + TECH[Game.lastTech].desc);
      if (!$('techPanel').classList.contains('hidden')) refreshTech();
    } else if (!$('techPanel').classList.contains('hidden') && Math.random() < 0.1) refreshTech();
  }

  // ---------- 贸易 ----------
  function openTrade(){
    closeAll();
    $('tradePanel').classList.remove('hidden');
    Sound.play('uiOpen');
    document.exitPointerLock && document.exitPointerLock();
    refreshTrade();
    const talks = [
      '「欢迎，旅行者。这里的氚可比外面便宜多了。」',
      '「听说熔核星的矿藏翻了倍……当然，高温也是。」',
      '「货船又在小行星带遇袭了。要是你有多余的电路板，我出好价钱。」',
      '「曲率电池？造得出那玩意的人，可以去任何地方。」',
    ];
    $('stationTalk').textContent = talks[(Math.random() * talks.length) | 0];
  }
  function refreshTrade(){
    $('tradeCredits').textContent = Player.credits;
    const list = $('tradeList');
    list.innerHTML = '';
    const discount = Game.techDone('trade_ai') ? 0.85 : 1;
    for (const id of TRADE_GOODS){
      const it = ITEMS[id];
      const mod = Game.market[id] || 1;
      const buyP = Math.max(1, Math.round(it.price * mod * 1.25 * discount));
      const sellP = Math.max(1, Math.round(it.price * mod * 0.8));
      const row = document.createElement('div');
      row.className = 'trade-row';
      const ic = document.createElement('div'); ic.className = 'ricon'; ic.appendChild(Icons.img(id));
      row.appendChild(ic);
      const nm = document.createElement('div'); nm.className = 'tnm';
      nm.innerHTML = `${it.name}<br><span style="color:${mod > 1.05 ? '#ff5555' : mod < 0.95 ? '#7dff8a' : '#5f7d8c'};font-size:10px">${mod > 1.05 ? '▲ 紧缺' : mod < 0.95 ? '▼ 过剩' : '— 平稳'}</span>`;
      row.appendChild(nm);
      const qty = document.createElement('div'); qty.className = 'tqty'; qty.textContent = '持有' + Player.countItem(id);
      row.appendChild(qty);
      const bBuy = document.createElement('button'); bBuy.className = 'tbtn'; bBuy.textContent = `买 ₪${buyP}`;
      bBuy.onclick = e => {
        const n = e.shiftKey ? 10 : 1;
        let bought = 0;
        for (let i = 0; i < n; i++){
          if (Player.credits >= buyP){ Player.credits -= buyP; Player.addItem(id, 1, true); bought++; }
        }
        if (bought){ Sound.play('buy'); Game.market[id] = Math.min(1.6, (Game.market[id] || 1) + 0.01 * bought); Game.flags.traded = true; }
        else Sound.play('uiError');
        refreshTrade(); refreshHUD();
      };
      row.appendChild(bBuy);
      const bSell = document.createElement('button'); bSell.className = 'tbtn sell'; bSell.textContent = `卖 ₪${sellP}`;
      bSell.onclick = e => {
        const n = e.shiftKey ? 10 : 1;
        let sold = 0;
        for (let i = 0; i < n; i++){
          if (Player.removeItem(id, 1)){ Player.credits += sellP; sold++; }
        }
        if (sold){ Sound.play('coin'); Game.market[id] = Math.max(0.5, (Game.market[id] || 1) - 0.012 * sold); Game.flags.traded = true; }
        else Sound.play('uiError');
        refreshTrade(); refreshHUD();
      };
      row.appendChild(bSell);
      list.appendChild(row);
    }
    // 蓝图
    const bp = $('bpList');
    bp.innerHTML = '';
    for (const b of STATION_BLUEPRINTS){
      const row = document.createElement('div');
      row.className = 'trade-row';
      const ic = document.createElement('div'); ic.className = 'ricon'; ic.appendChild(Icons.img(TECH[b.tech].icon));
      row.appendChild(ic);
      const nm = document.createElement('div'); nm.className = 'tnm'; nm.textContent = b.name;
      row.appendChild(nm);
      const done = Game.techDone(b.tech);
      const btn = document.createElement('button'); btn.className = 'tbtn';
      btn.textContent = done ? '已掌握' : `₪${b.price}`;
      btn.disabled = done;
      if (done) btn.style.opacity = 0.4;
      btn.onclick = () => {
        if (done) return;
        if (Player.credits >= b.price){
          Player.credits -= b.price;
          Game.completeTech(b.tech);
          Sound.play('research');
          bigMessage('蓝图解析完成', TECH[b.tech].name);
          refreshTrade(); refreshHUD();
        } else Sound.play('uiError');
      };
      row.appendChild(btn);
      bp.appendChild(row);
    }
  }

  // ---------- 任务 ----------
  const QUEST_GUIDES = {
    q_wake:    '走到冒烟的飞船旁按 <b>E</b>',
    q_carbon:  '按 <b>0</b> 选中激光枪，瞄准树干/蕨类<b>长按左键</b>采集',
    q_sodium:  '寻找黄色小花采集（按 <b>C</b> 可扫描定位）',
    q_stone:   '瞄准灰色岩石长按左键开采',
    q_furnace: '按 <b>Tab</b> → 右侧合成熔炉 → 选中快捷栏 → <b>右键</b>放置（<b>R</b> 可旋转朝向）',
    q_iron:    '对熔炉按 <b>E</b>：放入铁矿石 + 燃料(碳/煤)',
    q_repair:  '带够材料走到飞船旁按 <b>E</b>',
    q_tech:    '合成研究数据×2 → 按 <b>T</b> 点击「冶金学」',
    q_auto:    '采矿机<b>右键放在矿脉方块正上方</b>；无电也能低速运行，建火力发电机(烧煤)可全速',
    q_belt:    '放传送带时按 <b>R</b> 调整方向；侧向衔接自动转弯，上下衔接自动坡道；末端对准熔炉/储物箱即自动送入',
    q_power:   '研究「清洁能源」后合成太阳能板放置即可',
    q_refinery:'精炼厂按 <b>E</b> 选择配方，用传送带或手动投料',
    q_fuel:    '按 <b>Tab</b> 直接合成（碳×25+氧×10），或让精炼厂生产',
    q_launch:  '飞船旁按 <b>E</b> 登船入座 → 按 <b>W</b> 加注燃料并点火起飞；空中按 E 可随处降落',
    q_station: '起飞后按住拉升（鼠标向下）冲出大气层，飞进空间站机库的发光入口自动泊入',
    q_trade:   '在站内大厅的贸易终端旁按 <b>E</b> 买卖任意商品',
    q_explore: '太空中直接朝任意星球飞过去——穿过大气层无缝进入，再按 E 择地降落',
    q_nuclear: '核反应堆需要铀矿（深层/熔火星球较多）',
    q_antimatter: '反物质=铀×20+氚×100+电路×10+金锭×5（精炼厂）；氚靠太空射小行星/晶簇星挖晶簇',
    q_warp:    '曲率电池=反物质×3+金锭×20+钛锭×30+研究数据×20（精炼厂）；或空间站 ₪240000 购买',
    q_leave:   '太空中按 <b>M</b> 打开星系地图 → 锁定星系 → 出图对准方框，<b>J</b> 脉冲冲刺达速自动跃迁，完成第一章！',
  };
  function refreshQuests(){
    const list = $('questList');
    list.innerHTML = '';
    const cur = Game.currentQuests();
    for (const q of cur){
      const el = document.createElement('div');
      el.className = 'q-item' + (q.done ? ' done' : '');
      el.innerHTML = `<span class="qbox">${q.done ? '☑' : '☐'}</span><span>${q.desc}${q.progress ? ` <span class="qp">${q.progress}</span>` : ''}</span>`;
      list.appendChild(el);
    }
    const tip = $('questTip');
    if (tip){
      const gid = Game.currentQuestId && Game.currentQuestId();
      tip.innerHTML = (gid && QUEST_GUIDES[gid])
        ? '💡 ' + QUEST_GUIDES[gid]
        : '💡 <b>左键</b>采集 · <b>右键</b>放置 · <b>R</b>转向 · <b>Tab</b>合成 · <b>T</b>科技 · <b>C</b>扫描';
    }
  }

  // ---------- HUD ----------
  function buildSegBar(el, n){
    el.innerHTML = '';
    for (let i = 0; i < n; i++) el.appendChild(document.createElement('i'));
  }
  function refreshHUD(){
    const s = Player.stats;
    const sb = $('barShield'), hb = $('barHP');
    if (sb.children.length !== s.shieldMax) buildSegBar(sb, s.shieldMax);
    if (hb.children.length !== s.hpMax) buildSegBar(hb, s.hpMax);
    [...sb.children].forEach((el, i) => el.classList.toggle('on', i < Math.ceil(s.shield)));
    [...hb.children].forEach((el, i) => el.classList.toggle('on', i < s.hp));
    $('barO2').style.width = (s.o2 / s.o2Max * 100) + '%';
    $('barHaz').style.width = (s.haz / s.hazMax * 100) + '%';
    $('barLaser').style.width = (s.laser / s.laserMax * 100) + '%';
    $('creditVal').textContent = Player.credits;
    const jf = $('jetFill');
    jf.style.width = (s.jet / s.jetMax * 100) + '%';
    $('jetpackBar').classList.toggle('show', s.jet < s.jetMax - 1);
    const p = Factory.power;
    $('powerText').textContent = `${p.gen}/${p.use} kW`;
    $('powerText').style.color = p.sat < 1 ? '#ff5555' : '#ffb347';
  }
  function refreshAll(){
    refreshHotbar();
    if (!$('invPanel').classList.contains('hidden')) refreshInv();
    if (openMachine && !$('machinePanel').classList.contains('hidden')) buildMachineBody();
    refreshQuests();
    refreshHUD();
  }

  function setInteractHint(text){
    const el = $('interactHint');
    if (!text){ el.classList.add('hidden'); return; }
    el.innerHTML = text;
    el.classList.remove('hidden');
  }

  // ---------- 创造物品库 ----------
  let creativeBuilt = false;
  function buildCreative(){
    if (creativeBuilt) return;
    creativeBuilt = true;
    const grid = $('creativeGrid');
    grid.innerHTML = '';
    for (const id in ITEMS){
      const el = document.createElement('div');
      el.className = 'slot';
      el.appendChild(Icons.img(id));
      el.onmouseenter = e => { showTooltip(e, id); Sound.play('hover'); };
      el.onmousemove = moveTooltip;
      el.onmouseleave = hideTooltip;
      el.oncontextmenu = e => e.preventDefault();
      el.onmousedown = e => {
        e.preventDefault();
        const n = e.button === 2 ? 1 : Math.min(64, ITEMS[id].stack);
        Player.addItem(id, n);
        Sound.play('uiClick');
      };
      grid.appendChild(el);
    }
  }
  function toggleCreative(){
    if (!(window.Game && Game.creative)) return;
    const el = $('creativePanel');
    const willOpen = el.classList.contains('hidden');
    closeAll();
    if (willOpen){
      buildCreative();
      el.classList.remove('hidden');
      Sound.play('uiOpen');
      document.exitPointerLock && document.exitPointerLock();
    } else {
      Sound.play('uiClose');
      Game.lockPointer();
    }
  }

  // ---------- 星系地图（NMS 高级星图：全屏星海 · 光谱分级 · 侦测滤镜 · 航线规划 · 飞跃镜头）----------
  let galSelected = null;
  let g3d = null;
  const STAR_CLASSES = [
    { k: 'G', name: 'G 级黄星', col: '#ffd97a', desc: '常规恒星系' },
    { k: 'M', name: 'M 级红星', col: '#ff8a6a', desc: '富矿异常' },
    { k: 'E', name: 'E 级绿星', col: '#7dffa8', desc: '异象频发' },
    { k: 'B', name: 'B 级蓝星', col: '#7fb8ff', desc: '古老富饶' },
  ];
  function starClassFor(seed){
    const rnd = mulberry32((seed ^ 0x51A77E57) >>> 0);
    const r = rnd();
    const cls = seed === HOME_GALAXY_SEED ? STAR_CLASSES[0]
      : r < 0.55 ? STAR_CLASSES[0] : r < 0.75 ? STAR_CLASSES[1] : r < 0.9 ? STAR_CLASSES[2] : STAR_CLASSES[3];
    return { ...cls, code: cls.k + ((rnd() * 10) | 0) + 'pfvk'[(rnd() * 4) | 0] };
  }
  function galaxyMeta(seed, gal){
    const meta = { cls: starClassFor(seed) };
    const market = gal.market || {};
    let avg = 0, n = 0, best = null, bestV = 0;
    for (const k in market){ avg += market[k]; n++; if (market[k] > bestV){ bestV = market[k]; best = k; } }
    avg = n ? avg / n : 1;
    meta.eco = avg > 1.04 ? '富饶' : avg < 0.96 ? '衰退' : '平稳';
    meta.ecoBest = best ? `${(typeof ITEMS !== 'undefined' && ITEMS[best] && ITEMS[best].name) || best} ×${bestV.toFixed(2)}` : null;
    const haz = gal.planets.filter(p => BIOMES[p.biome] && BIOMES[p.biome].haz).length;
    meta.conflict = haz >= 3 ? '⚠ 高危' : haz === 2 ? '紧张' : '平静';
    meta.ly = ((seed % 9000) / 100 + 4.2).toFixed(1);
    meta.visited = !!(Game.isGalaxyVisited && Game.isGalaxyVisited(seed));
    return meta;
  }
  const _galTexCache = {};
  function starTexture(color, spikes){
    const key = color + (spikes ? '+s' : '');
    if (_galTexCache[key]) return _galTexCache[key];
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.2, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    if (spikes){
      x.globalCompositeOperation = 'lighter';
      const sg = x.createLinearGradient(6, 0, 122, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = sg;
      x.fillRect(6, 63, 116, 2);
      x.save(); x.translate(64, 64); x.rotate(Math.PI / 2); x.translate(-64, -64);
      x.fillRect(6, 63, 116, 2);
      x.restore();
    }
    return _galTexCache[key] = new THREE.CanvasTexture(c);
  }
  function reticleTexture(color){
    const key = 'ret' + color;
    if (_galTexCache[key]) return _galTexCache[key];
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    x.strokeStyle = color; x.lineWidth = 5; x.lineCap = 'round';
    x.shadowColor = color; x.shadowBlur = 8;
    x.beginPath(); x.arc(64, 64, 50, -0.35, 1.25); x.stroke();
    x.beginPath(); x.arc(64, 64, 50, Math.PI - 0.35, Math.PI + 1.25); x.stroke();
    return _galTexCache[key] = new THREE.CanvasTexture(c);
  }
  const GAL_MODES = [
    { id: 'all', tx: '自由探索' },
    { id: 'G', tx: '黄星' }, { id: 'M', tx: '红星' }, { id: 'E', tx: '绿星' }, { id: 'B', tx: '蓝星' },
    { id: 'visited', tx: '已到访' },
  ];
  function ensureGalaxyOverlays(){
    const box = $('galMap');
    if (document.getElementById('galRegion')) return;
    const hud = document.createElement('div');
    hud.id = 'galTopHud';
    hud.innerHTML = '<div id="galRegion"></div><div id="galModes"></div>';
    box.appendChild(hud);
    const modes = hud.querySelector('#galModes');
    for (const m of GAL_MODES){
      const b = document.createElement('button');
      b.className = 'gal-mode' + (m.id === 'all' ? ' on' : '');
      b.textContent = m.tx;
      b.dataset.mode = m.id;
      b.onclick = () => {
        Sound.play('uiClick');
        g3d.mode = m.id;
        modes.querySelectorAll('.gal-mode').forEach(x => x.classList.toggle('on', x === b));
        applyGalaxyFilter();
      };
      modes.appendChild(b);
    }
    const lg = document.createElement('div');
    lg.id = 'galLegend';
    lg.innerHTML = STAR_CLASSES.map(c =>
      `<i style="background:${c.col};box-shadow:0 0 6px ${c.col}"></i>${c.name} · ${c.desc}<br>`).join('') +
      `<i style="background:#7ff5fa;box-shadow:0 0 6px #7ff5fa"></i>当前星系　<i style="background:#b48cff;box-shadow:0 0 6px #b48cff"></i>起源星系`;
    box.appendChild(lg);
    const ct = document.createElement('div');
    ct.id = 'galCtrl';
    ct.textContent = '拖动 旋转 · 滚轮 缩放 · 悬停 侦测 · 单击 选定 · 锁定后出图对准方框 → 脉冲冲刺自动跃迁';
    box.appendChild(ct);
    const tip = document.createElement('div');
    tip.id = 'galTip';
    tip.style.display = 'none';
    box.appendChild(tip);
  }
  function applyGalaxyFilter(){
    if (!g3d) return;
    for (const spr of g3d.stars){
      const ent = spr.userData.ent;
      const match = g3d.mode === 'all' || ent.current
        || (g3d.mode === 'visited' ? ent.meta.visited : ent.meta.cls.k === g3d.mode);
      ent.dim = !match;
      spr.material.opacity = match ? 1 : 0.1;
    }
  }
  function openGalaxyMap(){
    closeAll();
    $('galaxyPanel').classList.remove('hidden');
    Sound.play('uiOpen');
    document.exitPointerLock && document.exitPointerLock();
    galSelected = null;
    buildGalaxyMap();
  }
  function buildGalaxyMap(){
    const box = $('galMap');
    ensureGalaxyOverlays();
    const wc = Player.countItem('warpcell');
    $('galWarpInfo').textContent = `曲率电池 ×${wc}`;
    $('galInfo').innerHTML = '<div class="save-empty">— 悬停侦测 · 点击星系查看详情 —</div>';
    const cur = Space.getCurrentGalaxySeed();
    $('galRegion').innerHTML =
      `<b>✦ ${galaxyName(cur)}</b> · 星域坐标 #${cur}<br>距银核 ${((cur % 70000) / 1000 + 3.7).toFixed(1)} 千光年 · 曲率电池 ×${wc}`;
    const entries = [{ seed: cur, current: true, pos: new THREE.Vector3(0, 0, 0) }];
    if (cur !== HOME_GALAXY_SEED)
      entries.push({ seed: HOME_GALAXY_SEED, home: true, pos: new THREE.Vector3(-55, -12, 40) });
    // 无限邻域：从当前种子扩散 12 个近邻 + 48 个远邻（4 层波纹，每层 12 星）
    const rnd = mulberry32((cur ^ 0x9E3779B9) >>> 0);
    const allSeeds = new Set();
    for (let i = 0; i < 60; i++) allSeeds.add((rnd() * 1e9) | 0);
    const seedList = [...allSeeds];
    for (let i = 0; i < 12; i++){
      const s = seedList[i];
      const jr = mulberry32((s ^ 0xC2B2) >>> 0);
      const a = i / 12 * Math.PI * 2 + (jr() - 0.5) * 0.5, r = 24 + (i % 4) * 10 + jr() * 6, y = Math.sin(i * 2.3) * 16 + (jr() - 0.5) * 6;
      entries.push({ seed: s, pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r) });
    }
    for (let ring = 0; ring < 4; ring++){
      for (let i = 0; i < 12; i++){
        const s = seedList[12 + ring * 12 + i]; if (!s) continue;
        const jr = mulberry32((s ^ 0xC2B2) >>> 0);
        const a = (i / 12 + ring * 0.07) * Math.PI * 2 + (jr() - 0.5) * 0.4;
        const r = 44 + ring * 16 + (i % 4) * 6 + jr() * 8;
        const y = (ring - 1.5) * 18 + Math.sin(i * 1.7) * 8 + (jr() - 0.5) * 8;
        entries.push({ seed: s, pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r) });
      }
    }
    // 每个星系：布局/元数据一次生成（详情卡与滤镜直接复用）
    for (const ent of entries){
      ent.gal = ent.seed === HOME_GALAXY_SEED
        ? { name: '起源星系', planets: DEFAULT_PLANETS, market: null, seed: ent.seed }
        : generateGalaxy(ent.seed);
      ent.meta = galaxyMeta(ent.seed, ent.gal);
    }
    if (!g3d){
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      box.appendChild(renderer.domElement);
      g3d = { renderer, yaw: 0.6, pitch: 0.33, dist: 135, distT: 135, drag: null, labels: [], raf: 0, stars: [], entries: [],
        mode: 'all', focus: new THREE.Vector3(), focusCur: new THREE.Vector3(), hover: null, lockSeed: undefined, t: 0 };
      bindGalaxyControls();
      window.addEventListener('resize', () => { if (g3d && !$('galaxyPanel').classList.contains('hidden')) resizeGalaxy(); });
    }
    g3d.labels.forEach(l => l.remove());
    g3d.labels = [];
    g3d.hover = null;
    g3d.focus.set(0, 0, 0);
    g3d.focusCur.set(0, 0, 0);
    g3d.distT = g3d.dist = 135;
    const scene = new THREE.Scene();
    g3d.scene = scene;
    g3d.cam = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
    scene.fog = new THREE.Fog(0x04060c, 400, 1400);
    // 背景星海（双层视差：远层暗蓝微尘 + 近层亮星）
    {
      const rnd2 = mulberry32(20261);
      const mk = (count, rMin, rSpan, size, color, op) => {
        const pos = [];
        for (let i = 0; i < count; i++){
          const v = new THREE.Vector3(rnd2() * 2 - 1, (rnd2() * 2 - 1) * 0.55, rnd2() * 2 - 1).normalize().multiplyScalar(rMin + rnd2() * rSpan);
          pos.push(v.x, v.y, v.z);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: op, fog: false })));
      };
      mk(900, 260, 500, 1.2, 0x5a6f9a, 0.55);
      mk(500, 170, 340, 1.8, 0x9fb4d8, 0.8);
    }
    // 星云尘带 + 远景银核（NMS 式纵深）
    const nebCols = ['rgba(53,224,232,0.20)', 'rgba(180,140,255,0.18)', 'rgba(255,140,90,0.14)', 'rgba(90,160,255,0.16)', 'rgba(255,90,140,0.10)', 'rgba(120,255,180,0.10)'];
    for (let i = 0; i < nebCols.length; i++){
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(nebCols[i]), transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
      const rr = mulberry32(999 + i * 77);
      sp.position.set((rr() - 0.5) * 260, (rr() - 0.5) * 100, (rr() - 0.5) * 260);
      sp.scale.setScalar(180 + rr() * 200);
      scene.add(sp);
    }
    {
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture('#ffdfae'), transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
      core.position.set(-380, 46, -420);
      core.scale.setScalar(300);
      scene.add(core);
      const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture('rgba(255,200,130,0.5)'), transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
      haze.position.copy(core.position);
      haze.scale.set(760, 300, 1);
      scene.add(haze);
    }
    // 星系恒星（光谱分级配色 + 衍射十字）+ 邻域航线 + 标签
    g3d.stars = [];
    const linePos = [];
    for (const ent of entries){
      const col = ent.current ? '#7ff5fa' : ent.home ? '#b48cff' : ent.meta.cls.col;
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: starTexture(col, true), transparent: true, depthWrite: false, fog: false }));
      spr.position.copy(ent.pos);
      const base = ent.current ? 12 : ent.home ? 9.5 : ent.meta.cls.k === 'B' ? 9 : 8;
      spr.scale.setScalar(base);
      spr.userData.ent = ent;
      spr.userData.base = base;
      scene.add(spr);
      g3d.stars.push(spr);
      ent.spr = spr;
      if (!ent.current) linePos.push(0, 0, 0, ent.pos.x, ent.pos.y, ent.pos.z);
      const el = document.createElement('div');
      el.className = 'g3d-label' + (ent.current ? ' cur' : '') + (ent.home ? ' home' : '');
      el.textContent = (ent.current ? '⬤ ' : '') + ent.gal.name + (ent.meta.visited && !ent.current ? ' ·✓' : '');
      box.appendChild(el);
      g3d.labels.push(el);
      ent.label = el;
    }
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    scene.add(new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ color: 0x35e0e8, transparent: true, opacity: 0.10, fog: false })));
    // 选中标记：双层反向旋转卡爪环
    g3d.retA = new THREE.Sprite(new THREE.SpriteMaterial({ map: reticleTexture('#ffb347'), transparent: true, depthWrite: false, fog: false }));
    g3d.retA.scale.setScalar(16);
    g3d.retA.visible = false;
    scene.add(g3d.retA);
    g3d.retB = new THREE.Sprite(new THREE.SpriteMaterial({ map: reticleTexture('#35e0e8'), transparent: true, depthWrite: false, fog: false, opacity: 0.8 }));
    g3d.retB.scale.setScalar(21);
    g3d.retB.visible = false;
    scene.add(g3d.retB);
    g3d.routeLine = null;
    g3d.routePulse = null;
    g3d.routeEnt = null;
    g3d.lockSeed = undefined;   // 触发 tick 内航线重建
    g3d.entries = entries;
    applyGalaxyFilter();
    resizeGalaxy();
    if (!g3d.raf) galaxyTick();
  }
  // 曲速航线：当前星系 → 锁定目标（紫色虚线 + 流动能量脉冲）
  function rebuildGalaxyRoute(){
    if (g3d.routeLine){ g3d.scene.remove(g3d.routeLine); g3d.routeLine.geometry.dispose(); g3d.routeLine = null; }
    if (g3d.routePulse){ g3d.scene.remove(g3d.routePulse); g3d.routePulse = null; }
    g3d.routeEnt = null;
    g3d.lockSeed = Game.warpLockSeed;
    if (g3d.lockSeed == null) return;
    const ent = g3d.entries.find(e => e.seed === g3d.lockSeed && !e.current);
    if (!ent) return;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), ent.pos]);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0xb48cff, transparent: true, opacity: 0.9, dashSize: 3, gapSize: 2.2 }));
    line.computeLineDistances();
    g3d.scene.add(line);
    g3d.routeLine = line;
    g3d.routePulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture('#e6d8ff'), transparent: true, depthWrite: false, fog: false }));
    g3d.routePulse.scale.setScalar(5);
    g3d.scene.add(g3d.routePulse);
    g3d.routeEnt = ent;
  }
  function resizeGalaxy(){
    const box = $('galMap');
    const w = box.clientWidth || 640, h = box.clientHeight || 420;
    g3d.renderer.setSize(w, h);
    g3d.cam.aspect = w / h;
    g3d.cam.updateProjectionMatrix();
  }
  function bindGalaxyControls(){
    const el = g3d.renderer.domElement;
    el.style.cursor = 'grab';
    el.addEventListener('mousedown', e => { g3d.drag = { x: e.clientX, y: e.clientY, moved: 0 }; el.style.cursor = 'grabbing'; });
    window.addEventListener('mousemove', e => {
      if (!g3d) return;
      if (g3d.drag){
        const dx = e.clientX - g3d.drag.x, dy = e.clientY - g3d.drag.y;
        g3d.drag.x = e.clientX; g3d.drag.y = e.clientY;
        g3d.drag.moved += Math.abs(dx) + Math.abs(dy);
        g3d.yaw -= dx * 0.006;
        g3d.pitch = THREE.MathUtils.clamp(g3d.pitch + dy * 0.006, -1.35, 1.35);
        return;
      }
      hoverGalaxy(e);
    });
    window.addEventListener('mouseup', e => {
      if (!g3d || !g3d.drag) return;
      const clicked = g3d.drag.moved < 5;
      g3d.drag = null;
      el.style.cursor = g3d.hover ? 'pointer' : 'grab';
      if (clicked) pickGalaxy(e);
    });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      g3d.distT = THREE.MathUtils.clamp(g3d.distT * (e.deltaY > 0 ? 1.14 : 0.87), 40, 420);
    }, { passive: false });
  }
  const _galRay = new THREE.Raycaster(), _galM = new THREE.Vector2();
  function galaxyHit(e){
    const rect = g3d.renderer.domElement.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return null;
    _galM.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    _galRay.setFromCamera(_galM, g3d.cam);
    const hits = _galRay.intersectObjects(g3d.stars).filter(h => !h.object.userData.ent.dim);
    return hits.length ? { ent: hits[0].object.userData.ent, rect } : null;
  }
  // 悬停侦测：星体增辉 + 光标随行情报条（名称/光谱/距离）
  function hoverGalaxy(e){
    if ($('galaxyPanel').classList.contains('hidden')) return;
    const tip = document.getElementById('galTip');
    const hit = galaxyHit(e);
    const ent = hit && hit.ent;
    if (g3d.hover && g3d.hover !== ent) g3d.hover.spr.scale.setScalar(g3d.hover.spr.userData.base);
    g3d.hover = ent || null;
    g3d.renderer.domElement.style.cursor = g3d.drag ? 'grabbing' : ent ? 'pointer' : 'grab';
    if (!ent){ if (tip) tip.style.display = 'none'; return; }
    ent.spr.scale.setScalar(ent.spr.userData.base * 1.35);
    if (tip){
      tip.innerHTML = `<b style="color:${ent.meta.cls.col}">${ent.gal.name}</b> · <span class="tclass">${ent.meta.cls.code}</span>` +
        ` · ${ent.current ? '当前所在' : ent.meta.ly + ' 光年'}${ent.meta.visited && !ent.current ? ' · ✓已到访' : ''}`;
      tip.style.display = '';
      tip.style.left = (e.clientX - hit.rect.left) + 'px';
      tip.style.top = (e.clientY - hit.rect.top) + 'px';
    }
  }
  function pickGalaxy(e){
    const hit = galaxyHit(e);
    if (!hit) return;
    const ent = hit.ent;
    Sound.play('uiClick');
    galSelected = ent;
    // 飞跃镜头：焦点滑向选中恒星并推近
    g3d.focus.copy(ent.pos);
    g3d.distT = Math.min(g3d.distT, 85);
    g3d.retA.visible = g3d.retB.visible = true;
    g3d.retA.position.copy(ent.pos);
    g3d.retB.position.copy(ent.pos);
    g3d.labels.forEach(l => l.classList.remove('sel'));
    if (ent.label) ent.label.classList.add('sel');
    showGalaxyDetail(ent);
  }
  const _gV = new THREE.Vector3();
  function galaxyTick(){
    if (!g3d) return;
    if ($('galaxyPanel').classList.contains('hidden')){ g3d.raf = 0; return; }
    g3d.raf = requestAnimationFrame(galaxyTick);
    g3d.t += 1 / 60;
    if (!g3d.drag) g3d.yaw += 0.0012;   // 待机缓转
    // 飞跃镜头：焦点/距离缓动（NMS 式滑向选中恒星）
    g3d.focusCur.lerp(g3d.focus, 0.07);
    g3d.dist += (g3d.distT - g3d.dist) * 0.08;
    g3d.cam.position.set(
      g3d.focusCur.x + Math.cos(g3d.pitch) * Math.sin(g3d.yaw) * g3d.dist,
      g3d.focusCur.y + Math.sin(g3d.pitch) * g3d.dist,
      g3d.focusCur.z + Math.cos(g3d.pitch) * Math.cos(g3d.yaw) * g3d.dist);
    g3d.cam.lookAt(g3d.focusCur);
    // 当前星系呼吸脉冲
    const curSpr = g3d.stars[0];
    if (curSpr) curSpr.scale.setScalar(curSpr.userData.base * (1 + Math.sin(g3d.t * 3.2) * 0.09));
    // 选中卡爪环：双层反向旋转
    if (galSelected && g3d.retA.visible){
      g3d.retA.material.rotation += 0.022;
      g3d.retB.material.rotation -= 0.014;
      const k = 1 + Math.sin(g3d.t * 4) * 0.05;
      g3d.retA.scale.setScalar(16 * k);
      g3d.retB.scale.setScalar(21 * k);
    }
    // 曲速航线：锁定变化即重建；能量脉冲沿航线流动
    if (g3d.lockSeed !== Game.warpLockSeed) rebuildGalaxyRoute();
    if (g3d.routePulse && g3d.routeEnt){
      const f = (g3d.t % 1.6) / 1.6;
      g3d.routePulse.position.copy(g3d.routeEnt.pos).multiplyScalar(f);
      g3d.routePulse.material.opacity = Math.sin(f * Math.PI) * 0.95;
    }
    g3d.renderer.render(g3d.scene, g3d.cam);
    // 标签投影（滤镜淡出的星隐藏名牌）
    const w = g3d.renderer.domElement.clientWidth, h = g3d.renderer.domElement.clientHeight;
    for (const ent of g3d.entries){
      _gV.copy(ent.pos).project(g3d.cam);
      if (_gV.z > 1 || ent.dim){ ent.label.style.display = 'none'; continue; }
      ent.label.style.display = '';
      ent.label.style.left = ((_gV.x + 1) / 2 * w) + 'px';
      ent.label.style.top = ((1 - _gV.y) / 2 * h + 8) + 'px';
    }
  }
  function showGalaxyDetail(ent){
    const info = $('galInfo');
    const gal = ent.gal, meta = ent.meta;
    const wc = Player.countItem('warpcell');
    const cur = ent.current;
    let html = `<div class="gal-detail"><h3>✦ ${gal.name}${meta.visited && !cur ? '<span class="gd-visited">✓ 已到访</span>' : ''}</h3>
      <div class="gd-seed">星图坐标 #${ent.seed}</div>
      <div class="gd-meta">
        <div class="gd-row"><span class="lb">恒星等级</span><b style="color:${meta.cls.col}">${meta.cls.code} · ${meta.cls.name}</b></div>
        <div class="gd-row"><span class="lb">星系特征</span><b>${meta.cls.desc}</b></div>
        <div class="gd-row"><span class="lb">行星</span><b>${gal.planets.length} 颗</b></div>
        <div class="gd-row"><span class="lb">经济</span><b>${gal.market ? meta.eco + (meta.ecoBest ? ' · 主营 ' + meta.ecoBest : '') : '母星贸易网'}</b></div>
        <div class="gd-row"><span class="lb">冲突</span><b${meta.conflict.startsWith('⚠') ? ' style="color:#ffb347"' : ''}>${meta.conflict}</b></div>
        <div class="gd-row"><span class="lb">距离</span><b>${cur ? '— 当前所在' : meta.ly + ' 光年 · 曲率电池 ×1'}</b></div>
      </div>`;
    for (const p of gal.planets){
      const b = BIOMES[p.biome];
      const col = '#' + new THREE.Color(b.tint).getHexString();
      html += `<div class="gal-planet"><span class="gp-dot" style="background:${col};color:${col}"></span>${p.name}<span class="gp-biome">${b.name}${b.haz ? ' ⚠' : ''}</span></div>`;
    }
    html += `</div>`;
    info.innerHTML = html;
    const btn = document.createElement('button');
    btn.className = 'gal-warp-btn';
    const locked = Game.warpLockSeed === ent.seed;
    if (cur){ btn.textContent = '当前所在星系'; btn.disabled = true; }
    else if (!locked && wc < 1){ btn.textContent = '⚠ 需要曲率电池 ×1（仍可锁定导航）'; btn.disabled = false; }
    if (!cur){
      btn.textContent = locked ? '◉ 解除锁定' : (wc >= 1 ? '◎ 锁定星系（出图后对准方框脉冲冲刺跃迁）' : '◎ 锁定导航方向（需要 1 枚曲率电池才可跃迁）');
      btn.onclick = () => {
        Game.setWarpLock(locked ? null : ent.seed, gal.name);
        showGalaxyDetail(ent);   // 刷新按钮态（航线由 tick 检测锁定变化自动重绘）
      };
    }
    info.querySelector('.gal-detail').appendChild(btn);
  }

  // ---------- 存档管理 ----------
  // mode: 'load'（主菜单读档）| 'save'（游戏内存档）
  function openSavePanel(mode){
    const el = $('savePanel');
    ['invPanel','machinePanel','techPanel','tradePanel','helpPanel','creativePanel','pausePanel','settingsPanel'].forEach(id => $(id).classList.add('hidden'));
    el.classList.remove('hidden');
    $('saveTitle').textContent = mode === 'save' ? '◈ 存档 — 覆盖或新建' : '◈ 继续档案 — 选择存档';
    $('btnNewSave').style.display = mode === 'save' ? '' : 'none';
    Sound.play('uiOpen');
    refreshSaveList(mode);
  }
  function refreshSaveList(mode){
    const list = $('saveList');
    list.innerHTML = '';
    const saves = Game.listSaves();
    if (!saves.length){
      list.innerHTML = '<div class="save-empty">— 暂无档案 —</div>';
    }
    for (const s of saves){
      const row = document.createElement('div');
      row.className = 'save-row';
      const date = new Date(s.time);
      const pad = n => String(n).padStart(2, '0');
      row.innerHTML = `
        <span class="sv-icon">${s.creative ? '✦' : '⛏'}</span>
        <div class="sv-info">
          <div class="sv-name">${s.name}</div>
          <div class="sv-meta">${s.creative ? '<span class="cr">创造</span>' : '生存'} · ${s.planetName} · ₪${s.credits} · 游玩${s.playMin}分钟<br>${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}</div>
        </div>`;
      const act = document.createElement('button');
      act.className = 'sv-btn';
      act.textContent = mode === 'save' ? '覆盖' : '读取';
      act.onclick = () => {
        Sound.play('uiClick');
        if (mode === 'save'){
          if (!confirm(`覆盖存档「${s.name}」？`)) return;
          Game.saveTo(s.key);
          bigMessage('已存档', s.name, 1500);
          $('savePanel').classList.add('hidden');
          if (!anyPanelOpen()) Game.lockPointer();
        } else {
          $('savePanel').classList.add('hidden');
          Game.loadFrom(s.key);
        }
      };
      row.appendChild(act);
      const del = document.createElement('button');
      del.className = 'sv-btn danger';
      del.textContent = '✕';
      del.title = '删除存档';
      del.onclick = () => {
        if (!confirm(`删除存档「${s.name}」？不可恢复！`)) return;
        Game.deleteSave(s.key);
        Sound.play('breakBlk');
        refreshSaveList(mode);
      };
      row.appendChild(del);
      list.appendChild(row);
    }
  }
  $('btnNewSave').onclick = () => {
    const name = prompt('新存档名称：', '档案 ' + (Game.listSaves().length + 1));
    if (name === null) return;
    Game.saveTo(null, name.trim() || '未命名档案');
    Sound.play('craft');
    bigMessage('已创建存档', name, 1500);
    refreshSaveList('save');
  };

  document.querySelectorAll('.pclose').forEach(b => {
    b.onclick = () => {
      Sound.play('uiClose');
      if (b.dataset.close === 'tradePanel' && Game.state === 'docked'){ $('btnUndock').click(); return; }
      $(b.dataset.close).classList.add('hidden');
      if (b.dataset.close === 'machinePanel') openMachine = null;
      if (Game.state !== 'menu' && !anyPanelOpen()) Game.lockPointer();
    };
  });

  // 机器面板实时刷新（进度/状态）
  let machTickT = 0;
  function tickMachinePanel(dt){
    if (!openMachine || $('machinePanel').classList.contains('hidden')) return;
    if (openMachine.type === 'beacon') return;   // 静态面板：自动重建会打断输入框输入
    machTickT += dt;
    if (machTickT < 0.4) return;
    machTickT = 0;
    buildMachineBody();
  }

  // 回收站：手持物品点击销毁（右键销毁1个）
  $('trashSlot').onclick = () => {
    if (!cursorStack) return;
    Sound.play('breakBlk', 1.4);
    cursorStack = null;
    updateGhost();
    refreshAll();
    flashTrash();
  };
  $('trashSlot').oncontextmenu = e => {
    e.preventDefault();
    if (!cursorStack) return;
    Sound.play('uiClick');
    cursorStack.n--;
    if (cursorStack.n <= 0) cursorStack = null;
    updateGhost();
    refreshAll();
    flashTrash();
  };
  function flashTrash(){
    const el = $('trashSlot');
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 200);
  }

  return {
    anyPanelOpen, closeAll, toggle, buildHotbar, refreshHotbar, refreshInv, refreshAll, showItemName,
    openMachinePanel, openTrade, refreshTrade, refreshTech, updateResearch, tickMachinePanel,
    toggleCreative, openSavePanel, openGalaxyMap,
    pickupToast, bigMessage, refreshQuests, refreshHUD, setInteractHint,
    get openMachine(){ return openMachine; },
    get researching(){ return researching; },
    set researching(v){ researching = v; },
    // 光标物品存取（飞船货仓等外部格子接入拖放体系）
    getCursor(){ return cursorStack; },
    setCursor(s){ cursorStack = (s && s.n > 0) ? s : null; updateGhost(); },
  };
})();
window.UI = UI;
