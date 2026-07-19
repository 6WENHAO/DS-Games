/* ============================================================
 * BLOCKROOMS - ui.js
 * HUD / 背包 / 合成 / 菜单 / 任务 / 过渡动画
 * ============================================================ */
(function () {
  'use strict';
  const U = {};
  window.BRUI = U;
  const B = () => window.BRBlocks;
  const $ = id => document.getElementById(id);

  let game = null;
  U.invOpen = false;
  U.paused = false;
  let cursorItem = null;   // {id, n}
  let nearTable = false;

  /* ================= 初始化 ================= */
  U.init = function (g) {
    game = g;
    buildHearts();
    buildSanity();
    buildHotbar();
    buildInventoryGrid();
    bindInventoryEvents();
    // 全局鼠标跟踪（光标物品）
    document.addEventListener('mousemove', e => {
      const c = $('cursor-item');
      if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }
      moveTooltip(e);
    });
  };

  /* ================= HUD：生命 / 理智 ================= */
  const HEART_SVG = (fill, half) =>
    '<svg viewBox="0 0 9 9" width="18" height="18" shape-rendering="crispEdges">' +
    '<path d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3h-1v1h-1v1h-1v1h-1V7H4V6H3V5H2V4H1V3H0V2h1z" fill="#1a0000"/>' +
    (fill ? '<path d="M2 2h1v1h1v1h1V3h1V2h1v1h1v2h-1v1h-1v1h-1V6H4V5H3V4H2z" fill="' + (half ? '#5a1010' : '#e8352b') + '"/>' : '') +
    (fill && !half ? '<path d="M2 2h1v1H2z" fill="#ff8a7a"/>' : '') +
    '</svg>';
  const EYE_SVG = (fill) =>
    '<svg viewBox="0 0 9 9" width="18" height="18" shape-rendering="crispEdges">' +
    '<path d="M1 3h1V2h1V1h3v1h1v1h1v3H8v1H7v1H6v1H3V8H2V7H1V6H0V4h1z" fill="#0d0518"/>' +
    (fill ? '<path d="M2 3h1V2h3v1h1v3H6v1H3V6H2z" fill="#9550e8"/><path d="M4 3h1v2H4z" fill="#e0ccff"/>' : '') +
    '</svg>';

  function buildHearts() {
    const el = $('hearts');
    el.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('div');
      s.className = 'stat-icon';
      el.appendChild(s);
    }
  }
  function buildSanity() {
    const el = $('sanity');
    el.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('div');
      s.className = 'stat-icon';
      el.appendChild(s);
    }
  }
  let lastHp = -1, lastSan = -1;
  U.updateStats = function () {
    if (game.hp !== lastHp) {
      lastHp = game.hp;
      const el = $('hearts');
      for (let i = 0; i < 10; i++) {
        const v = game.hp - i * 2;
        el.children[i].innerHTML = HEART_SVG(v > 0, v === 1);
        el.children[i].classList.toggle('shake', game.hp <= 6);
      }
    }
    const sanInt = Math.ceil(game.sanity / 10);
    if (sanInt !== lastSan) {
      lastSan = sanInt;
      const el = $('sanity');
      for (let i = 0; i < 10; i++)
        el.children[9 - i].innerHTML = EYE_SVG(i < sanInt);
    }
  };

  /* ================= 快捷栏 ================= */
  function buildHotbar() {
    const hb = $('hotbar');
    hb.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'hb-slot';
      slot.dataset.idx = i;
      slot.innerHTML = '<div class="slot-inner"></div><span class="slot-count"></span>';
      hb.appendChild(slot);
    }
  }
  function renderSlotContent(el, item) {
    const inner = el.querySelector('.slot-inner');
    const cnt = el.querySelector('.slot-count');
    if (!item) { inner.style.backgroundImage = ''; cnt.textContent = ''; return; }
    const url = BRAssets.iconURL[item.id];
    inner.style.backgroundImage = url ? 'url("' + url + '")' : '';
    cnt.textContent = item.n > 1 ? item.n : '';
  }
  U.updateHotbar = function () {
    const hb = $('hotbar');
    for (let i = 0; i < 9; i++) {
      const el = hb.children[i];
      el.classList.toggle('selected', i === game.hotbarSel);
      renderSlotContent(el, game.inv[i]);
    }
  };
  let nameTimer = null;
  U.showItemName = function (text) {
    const el = $('item-name');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => el.classList.remove('show'), 1600);
  };

  /* ================= 背包 ================= */
  function buildInventoryGrid() {
    const grid = $('inv-grid');
    grid.innerHTML = '';
    for (let i = 9; i < 36; i++) grid.appendChild(makeSlot(i));
    const hb = $('inv-hotbar');
    hb.innerHTML = '';
    for (let i = 0; i < 9; i++) hb.appendChild(makeSlot(i));
  }
  function makeSlot(idx) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    slot.dataset.idx = idx;
    slot.innerHTML = '<div class="slot-inner"></div><span class="slot-count"></span>';
    return slot;
  }
  function bindInventoryEvents() {
    $('inventory-screen').addEventListener('mousedown', e => {
      const slot = e.target.closest('.inv-slot');
      if (!slot) return;
      e.preventDefault();
      const idx = +slot.dataset.idx;
      if (e.shiftKey && e.button === 0) { quickMove(idx); }
      else if (e.button === 0) slotLeftClick(idx);
      else if (e.button === 2) slotRightClick(idx);
      U.renderInventory();
      BRAudio.uiClick();
    });
    $('inventory-screen').addEventListener('contextmenu', e => e.preventDefault());
    $('inventory-screen').addEventListener('mouseover', e => {
      const slot = e.target.closest('.inv-slot');
      if (slot) {
        const item = game.inv[+slot.dataset.idx];
        if (item) { showTooltipItem(item.id); return; }
      }
      hideTooltip();
    });
  }
  function slotLeftClick(idx) {
    const inv = game.inv;
    const s = inv[idx];
    if (!cursorItem) {
      if (s) { cursorItem = s; inv[idx] = null; }
    } else if (!s) {
      inv[idx] = cursorItem; cursorItem = null;
    } else if (s.id === cursorItem.id) {
      const max = (B().items[s.id].stack || 64);
      const move = Math.min(cursorItem.n, max - s.n);
      s.n += move; cursorItem.n -= move;
      if (cursorItem.n <= 0) cursorItem = null;
    } else {
      const t = inv[idx]; inv[idx] = cursorItem; cursorItem = t;
    }
  }
  function slotRightClick(idx) {
    const inv = game.inv;
    const s = inv[idx];
    if (!cursorItem) {
      if (s) {
        const half = Math.ceil(s.n / 2);
        cursorItem = { id: s.id, n: half };
        s.n -= half;
        if (s.n <= 0) inv[idx] = null;
      }
    } else {
      const max = (B().items[cursorItem.id].stack || 64);
      if (!s) {
        inv[idx] = { id: cursorItem.id, n: 1 };
        cursorItem.n--;
      } else if (s.id === cursorItem.id && s.n < max) {
        s.n++; cursorItem.n--;
      }
      if (cursorItem.n <= 0) cursorItem = null;
    }
  }
  function quickMove(idx) {
    const inv = game.inv;
    const s = inv[idx];
    if (!s) return;
    const targetRange = idx < 9 ? [9, 36] : [0, 9];
    // 先叠加
    for (let i = targetRange[0]; i < targetRange[1] && s.n > 0; i++) {
      const t = inv[i];
      if (t && t.id === s.id) {
        const max = (B().items[s.id].stack || 64);
        const mv = Math.min(s.n, max - t.n);
        t.n += mv; s.n -= mv;
      }
    }
    if (s.n > 0) {
      for (let i = targetRange[0]; i < targetRange[1]; i++) {
        if (!inv[i]) { inv[i] = { id: s.id, n: s.n }; s.n = 0; break; }
      }
    }
    if (s.n <= 0) inv[idx] = null;
  }

  U.renderInventory = function () {
    const screen = $('inventory-screen');
    screen.querySelectorAll('.inv-slot').forEach(el => {
      renderSlotContent(el, game.inv[+el.dataset.idx]);
    });
    const c = $('cursor-item');
    if (cursorItem) {
      c.style.display = 'block';
      c.querySelector('.slot-inner').style.backgroundImage = 'url("' + BRAssets.iconURL[cursorItem.id] + '")';
      c.querySelector('.slot-count').textContent = cursorItem.n > 1 ? cursorItem.n : '';
    } else c.style.display = 'none';
    renderRecipes();
    U.updateHotbar();
  };

  U.openInventory = function (tableMode) {
    U.invOpen = true;
    nearTable = !!tableMode;
    $('inventory-screen').classList.add('open');
    $('inv-title').textContent = nearTable ? '工作台' : '背包';
    document.exitPointerLock && document.exitPointerLock();
    U.renderInventory();
    BRAudio.uiOpen();
  };
  U.closeInventory = function () {
    U.invOpen = false;
    $('inventory-screen').classList.remove('open');
    // 光标物品掉回背包
    if (cursorItem) { game.giveOrDrop(cursorItem.id, cursorItem.n); cursorItem = null; }
    hideTooltip();
    BRAudio.uiClose();
  };

  /* ================= 合成 ================= */
  function countItem(id) {
    let n = 0;
    for (const s of game.inv) if (s && s.id === id) n += s.n;
    return n;
  }
  function consume(id, n) {
    for (let i = 0; i < 36 && n > 0; i++) {
      const s = game.inv[i];
      if (s && s.id === id) {
        const take = Math.min(n, s.n);
        s.n -= take; n -= take;
        if (s.n <= 0) game.inv[i] = null;
      }
    }
  }
  function renderRecipes() {
    const list = $('recipe-list');
    list.innerHTML = '';
    for (const r of B().recipes) {
      const locked = r.table && !nearTable;
      let canCraft = !locked;
      let costHtml = '';
      for (const [id, n] of r.cost) {
        const have = countItem(id);
        if (have < n) canCraft = false;
        costHtml += '<span class="cost' + (have >= n ? ' ok' : '') + '">' +
          '<img src="' + BRAssets.iconURL[id] + '" alt="">' + have + '/' + n + '</span>';
      }
      const div = document.createElement('div');
      div.className = 'recipe' + (canCraft ? ' can' : '') + (locked ? ' locked' : '');
      div.innerHTML =
        '<img class="r-icon" src="' + BRAssets.iconURL[r.out.id] + '" alt="">' +
        '<div class="r-info"><div class="r-name">' + B().items[r.out.id].name +
        (r.out.n > 1 ? ' ×' + r.out.n : '') + (locked ? ' <em>需要工作台</em>' : '') + '</div>' +
        '<div class="r-cost">' + costHtml + '</div></div>' +
        '<button class="r-btn"' + (canCraft ? '' : ' disabled') + '>合成</button>';
      div.querySelector('.r-btn').addEventListener('click', e => {
        e.stopPropagation();
        const times = e.shiftKey ? 5 : 1;
        for (let t = 0; t < times; t++) {
          let ok = !(r.table && !nearTable);
          for (const [id, n] of r.cost) if (countItem(id) < n) ok = false;
          if (!ok) break;
          for (const [id, n] of r.cost) consume(id, n);
          game.giveOrDrop(r.out.id, r.out.n);
          game.onCraft(r.id);
        }
        BRAudio.craft();
        U.renderInventory();
      });
      div.addEventListener('mouseover', e => { e.stopPropagation(); showTooltipText(B().items[r.out.id].name, r.tip || ''); });
      list.appendChild(div);
    }
  }

  /* ================= 提示框 ================= */
  let ttEl = null;
  function showTooltipItem(id) {
    const it = B().items[id];
    showTooltipText(it.name, it.desc || (it.block !== undefined ? '可放置' : ''));
  }
  function showTooltipText(title, desc) {
    ttEl = $('tooltip');
    ttEl.innerHTML = '<b>' + title + '</b>' + (desc ? '<span>' + desc + '</span>' : '');
    ttEl.style.display = 'block';
  }
  function hideTooltip() {
    if (ttEl) ttEl.style.display = 'none';
  }
  function moveTooltip(e) {
    const t = $('tooltip');
    if (t && t.style.display === 'block') {
      t.style.left = Math.min(window.innerWidth - 240, e.clientX + 16) + 'px';
      t.style.top = Math.max(8, e.clientY - 40) + 'px';
    }
  }

  /* ================= 通知 / 任务 ================= */
  U.toast = function (html, cls) {
    const box = $('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (cls || '');
    t.innerHTML = html;
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      setTimeout(() => t.remove(), 400);
    }, 3200);
  };
  U.pickupToast = function (id, n) {
    const it = B().items[id];
    U.toast('<img src="' + BRAssets.iconURL[id] + '" alt=""> 获得 ' + it.name + ' ×' + n, 'pickup');
  };

  U.setObjective = function (title, desc) {
    const el = $('objective');
    if (!title) { el.classList.remove('show'); return; }
    el.classList.add('show');
    el.innerHTML = '<div class="obj-tag">◆ 当前目标</div><div class="obj-title">' + title + '</div>' +
      (desc ? '<div class="obj-desc">' + desc + '</div>' : '');
  };
  U.questComplete = function (text) {
    BRAudio.questDone();
    U.toast('✔ ' + text, 'quest');
  };

  U.showLevelTitle = function (name, sub) {
    const el = $('level-title');
    el.innerHTML = '<div class="lt-name">' + name + '</div><div class="lt-sub">' + sub + '</div>';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  };

  U.setHint = function (text) {
    const el = $('hint');
    if (el.textContent !== text) el.textContent = text;
  };

  /* ================= 覆盖层特效 ================= */
  U.damageFlash = function () {
    const el = $('flash-red');
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  };
  U.setSanityVignette = function (v) {
    $('vignette-sanity').style.opacity = Math.min(1, v).toFixed(2);
  };
  U.setHealthVignette = function (v) {
    $('vignette-damage').style.opacity = Math.min(1, v).toFixed(2);
  };
  U.setGlitch = function (v) {
    const el = $('glitch-overlay');
    if (v <= 0.02) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.opacity = Math.min(1, v);
  };
  U.fade = function (toBlack, duration, cb) {
    const el = $('fade-overlay');
    el.style.transitionDuration = (duration || 600) + 'ms';
    el.style.opacity = toBlack ? 1 : 0;
    el.style.pointerEvents = toBlack ? 'all' : 'none';
    if (cb) setTimeout(cb, (duration || 600) + 30);
  };

  /* ---- noclip 穿模转场动画 ---- */
  U.noclipTransition = function (midCb, endCb) {
    const el = $('noclip-overlay');
    el.classList.add('active');
    BRAudio.noclip();
    setTimeout(() => { if (midCb) midCb(); }, 1400);
    setTimeout(() => {
      el.classList.remove('active');
      if (endCb) endCb();
    }, 2600);
  };

  /* ================= 屏幕切换 ================= */
  U.showScreen = function (id) {
    ['menu-main', 'menu-settings', 'menu-pause', 'screen-death', 'screen-win', 'screen-intro', 'hud'].forEach(s => {
      const el = $(s);
      if (el) el.classList.toggle('active', s === id);
    });
    if (id === 'hud') hideTooltip();
  };
  U.showPause = function (show) {
    U.paused = show;
    $('menu-pause').classList.toggle('active', show);
    if (show) document.exitPointerLock && document.exitPointerLock();
  };

  /* ---- 死亡画面 ---- */
  U.showDeath = function (reason) {
    $('death-reason').textContent = reason;
    U.showScreen('screen-death');
    $('screen-death').classList.add('active');
  };
  /* ---- 胜利画面 ---- */
  U.showWin = function (stats) {
    $('win-stats').innerHTML =
      '<div><span>存活时间</span><b>' + stats.time + '</b></div>' +
      '<div><span>破坏方块</span><b>' + stats.mined + '</b></div>' +
      '<div><span>击杀猎犬</span><b>' + stats.hounds + '</b></div>' +
      '<div><span>驱散微笑者</span><b>' + stats.smilers + '</b></div>' +
      '<div><span>喝下杏仁水</span><b>' + stats.almond + '</b></div>';
    U.showScreen('screen-win');
  };

  /* ---- 开场字幕 ---- */
  U.playIntro = function (lines, done) {
    U.showScreen('screen-intro');
    const el = $('intro-text');
    const skipEl = $('intro-skip');
    let li = 0, ci = 0, alive = true, timer = null;
    function finish() {
      if (!alive) return;
      alive = false;
      clearTimeout(timer);
      skipEl.removeEventListener('click', finish);
      window.removeEventListener('keydown', keySkip);
      done();
    }
    function keySkip(e) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') finish(); }
    skipEl.addEventListener('click', finish);
    window.addEventListener('keydown', keySkip);
    el.innerHTML = '';
    function typeNext() {
      if (!alive) return;
      if (li >= lines.length) { timer = setTimeout(finish, 1400); return; }
      const line = lines[li];
      if (ci === 0) {
        const p = document.createElement('p');
        p.className = 'intro-line';
        el.appendChild(p);
      }
      const p = el.lastChild;
      if (ci < line.length) {
        p.textContent += line[ci];
        ci++;
        timer = setTimeout(typeNext, line[ci - 1] === '…' ? 300 : 55);
      } else {
        li++; ci = 0;
        timer = setTimeout(typeNext, 700);
      }
    }
    typeNext();
  };
})();
