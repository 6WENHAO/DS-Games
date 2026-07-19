// ============ UI 系统 ============
const UI = (() => {
  const $ = id => document.getElementById(id);

  // ---------- 通知横幅 ----------
  let notifyTimer = null;
  function notify(title, sub = '', dur = 3200) {
    const banner = $('notify-banner');
    $('notify-text').innerHTML = title + (sub ? `<span class="n-sub">${sub}</span>` : '');
    banner.classList.remove('hidden', 'fading');
    Sfx.notify();
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      banner.classList.add('fading');
      setTimeout(() => banner.classList.add('hidden'), 800);
    }, dur);
  }

  // ---------- 拾取信息流 ----------
  const feedMap = new Map(); // id -> { el, n, timer }
  function pickup(id, n) {
    const def = Items.DEFS[id];
    const feed = $('pickup-feed');
    let entry = feedMap.get(id);
    if (entry) {
      entry.n += n;
      entry.el.querySelector('.p-num').textContent = '+' + entry.n;
      entry.el.classList.remove('fading');
      clearTimeout(entry.timer);
    } else {
      const el = document.createElement('div');
      el.className = 'pickup-item';
      el.innerHTML = `<img class="p-icon" src="${Textures.itemIcon(id)}"><span>${def.name}</span><span class="p-num">+${n}</span>`;
      feed.appendChild(el);
      entry = { el, n };
      feedMap.set(id, entry);
    }
    entry.timer = setTimeout(() => {
      entry.el.classList.add('fading');
      setTimeout(() => { entry.el.remove(); feedMap.delete(id); }, 650);
    }, 2000);
    Sfx.pickup(1 + Math.random() * 0.2);
  }

  // ---------- 状态条 ----------
  function setBar(id, frac) {
    const el = $(id);
    if (el) el.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
  }
  function setBarDanger(rowId, danger) {
    $(rowId).classList.toggle('danger', danger);
  }

  // ---------- 交互提示 ----------
  function interactTip(text) {
    const tip = $('interact-tip');
    if (text) {
      $('interact-text').textContent = text;
      tip.classList.remove('hidden');
    } else tip.classList.add('hidden');
  }

  // ---------- 任务面板 ----------
  function setMission(title, desc) {
    $('mission-title').textContent = title;
    $('mission-desc').innerHTML = desc;
  }

  // ---------- 星球信息 ----------
  function setPlanetInfo(name, sub) {
    $('hud-planet-name').textContent = name;
    $('hud-planet-sub').textContent = sub;
  }
  function setEnvReadout(text) { $('env-readout').textContent = text; }

  // ---------- 世界标记 ----------
  const markers = new Map();
  function addMarker(key, label, icon, color = '') {
    removeMarker(key);
    const el = document.createElement('div');
    el.className = 'world-marker ' + color;
    el.innerHTML = `<div class="m-icon"><span>${icon}</span></div><div class="m-label">${label}</div><div class="m-dist"></div>`;
    $('markers').appendChild(el);
    markers.set(key, el);
    return el;
  }
  function removeMarker(key) {
    const el = markers.get(key);
    if (el) { el.remove(); markers.delete(key); }
  }
  function updateMarker(key, worldPos, camera, playerPos) {
    const el = markers.get(key);
    if (!el) return;
    const v = worldPos.clone().project(camera);
    const behind = v.z > 1;
    if (behind || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) {
      // 屏幕边缘指示
      const ang = Math.atan2(v.y, v.x * (behind ? -1 : 1));
      const x = 0.5 + Math.cos(ang) * 0.45, y = 0.5 - Math.sin(ang) * 0.42;
      el.style.left = x * 100 + '%';
      el.style.top = y * 100 + '%';
      el.style.opacity = 0.5;
    } else {
      el.style.left = (v.x * 0.5 + 0.5) * 100 + '%';
      el.style.top = (-v.y * 0.5 + 0.5) * 100 + '%';
      el.style.opacity = 1;
    }
    const dist = playerPos.distanceTo(worldPos);
    el.querySelector('.m-dist').textContent = dist > 1000 ? (dist / 1000).toFixed(1) + ' ku' : Math.round(dist) + ' u';
  }
  function clearMarkers() { markers.forEach(el => el.remove()); markers.clear(); }

  // ---------- 采矿进度环 ----------
  function setMineProgress(frac) {
    const ret = $('mine-reticle');
    const circ = $('mine-progress');
    if (frac === null) { ret.classList.remove('active'); return; }
    ret.classList.add('active');
    circ.style.strokeDashoffset = 264 * (1 - frac);
  }

  // ---------- 物品栏界面 ----------
  let invOpen = false;
  function renderInventory() {
    const grid = $('inv-grid');
    grid.innerHTML = '';
    for (let i = 0; i < Items.SLOTS; i++) {
      const it = Items.inv[i];
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      if (it) {
        const def = Items.DEFS[it.id];
        const numHtml = Items.creative ? '∞' : it.n;
        const fillW = Items.creative ? 100 : (it.n / def.max) * 100;
        slot.innerHTML = `<img src="${Textures.itemIcon(it.id)}"><span class="slot-num">${numHtml}</span>
          <div class="slot-fill"><i style="width:${fillW}%"></i></div>`;
        slot.addEventListener('mouseenter', () => {
          $('inv-item-info').innerHTML = `<b style="color:${def.color}">${def.name}</b> × ${Items.creative ? '∞' : it.n} — ${def.desc}`;
          Sfx.uiHover();
        });
      }
      grid.appendChild(slot);
    }
    renderCraftList();
    renderRechargeList();
  }

  function renderCraftList() {
    const list = $('craft-list');
    list.innerHTML = '';
    Items.RECIPES.forEach(r => {
      const def = Items.DEFS[r.out];
      const ok = Items.canCraft(r);
      const el = document.createElement('div');
      el.className = 'craft-item' + (ok ? '' : ' locked');
      const reqHtml = r.req.map(([id, n]) => {
        const has = Items.count(id);
        return `<span class="${has >= n ? 'ok' : 'no'}">${Items.DEFS[id].name} ${has}/${n}</span>`;
      }).join(' · ');
      el.innerHTML = `<img src="${Textures.itemIcon(r.out)}">
        <div class="ci-body"><div class="ci-name">${def.name}${r.n > 1 ? ' ×' + r.n : ''}</div><div class="ci-req">${reqHtml}</div></div>
        <div class="ci-action">${ok ? '合成 ▸' : '材料不足'}</div>`;
      el.addEventListener('click', () => {
        if (Items.craft(r)) {
          Sfx.craft();
          pickup(r.out, r.n);
          renderInventory();
          Missions.onCraft(r.out);
        } else Sfx.error();
      });
      el.addEventListener('mouseenter', () => {
        $('inv-item-info').innerHTML = `<b style="color:${def.color}">${def.name}</b> — ${def.desc}`;
      });
      list.appendChild(el);
    });
  }

  const RECHARGES = [
    { key: 'hazard', name: '危险防护', item: 'sodium', n: 20, icon: '☂' },
    { key: 'life', name: '生命维持', item: 'oxygen', n: 15, icon: '✚' },
    { key: 'beam', name: '采矿光束', item: 'carbon', n: 15, icon: '⚒' },
  ];
  function renderRechargeList() {
    const list = $('recharge-list');
    list.innerHTML = '';
    RECHARGES.forEach(r => {
      const has = Items.count(r.item) >= r.n;
      const cur = Player.stats[r.key];
      const full = cur >= 0.99;
      const el = document.createElement('div');
      el.className = 'recharge-item' + (has && !full ? '' : ' locked');
      el.innerHTML = `<img src="${Textures.itemIcon(r.item)}">
        <div class="ci-body"><div class="ci-name">${r.icon} ${r.name} <span style="opacity:.6;font-size:11px">${Math.round(cur * 100)}%</span></div>
        <div class="ci-req"><span class="${has ? 'ok' : 'no'}">${Items.DEFS[r.item].name} ${Items.count(r.item)}/${r.n}</span></div></div>
        <div class="ci-action">${full ? '已充满' : has ? '充能 ▸' : '不足'}</div>`;
      el.addEventListener('click', () => {
        if (full || !has) { Sfx.error(); return; }
        Items.remove(r.item, r.n);
        Player.recharge(r.key);
        Sfx.repair();
        renderInventory();
      });
      list.appendChild(el);
    });
  }

  function toggleInventory(force) {
    invOpen = force !== undefined ? force : !invOpen;
    $('inventory-screen').classList.toggle('hidden', !invOpen);
    if (invOpen) { renderInventory(); Sfx.uiOpen(); document.exitPointerLock(); }
    else { Sfx.uiClose(); Game.requestPointerLock(); }
    return invOpen;
  }

  // ---------- 修复面板 ----------
  let repairOpen = false, repairTarget = null;
  function openRepair(title, parts, onFix) {
    repairOpen = true;
    repairTarget = { parts, onFix };
    $('repair-title').textContent = '// ' + title;
    renderRepairList();
    $('repair-screen').classList.remove('hidden');
    Sfx.uiOpen();
    document.exitPointerLock();
  }
  function renderRepairList() {
    if (!repairTarget) return;
    const list = $('repair-list');
    list.innerHTML = '';
    repairTarget.parts.forEach(p => {
      const el = document.createElement('div');
      if (p.fixed) {
        el.className = 'repair-item locked';
        el.innerHTML = `<img src="${Textures.itemIcon(p.icon)}">
          <div class="ci-body"><div class="ci-name">${p.name}</div>
          <div class="ci-req"><span class="ok">✔ 已修复 · 运转正常</span></div></div>`;
      } else {
        const ok = p.req.every(([id, n]) => Items.count(id) >= n);
        el.className = 'repair-item' + (ok ? '' : ' locked');
        const reqHtml = p.req.map(([id, n]) =>
          `<span class="${Items.count(id) >= n ? 'ok' : 'no'}">${Items.DEFS[id].name} ${Items.count(id)}/${n}</span>`).join(' · ');
        el.innerHTML = `<img src="${Textures.itemIcon(p.icon)}">
          <div class="ci-body"><div class="ci-name">⚠ ${p.name}</div><div class="ci-req">${reqHtml}</div></div>
          <div class="ci-action">${ok ? '修复 ▸' : '材料不足'}</div>`;
        el.addEventListener('click', () => {
          if (!ok) { Sfx.error(); return; }
          p.req.forEach(([id, n]) => Items.remove(id, n));
          p.fixed = true;
          Sfx.repair();
          notify(p.name + ' 修复完成', 'SYSTEM ONLINE');
          renderRepairList();
          repairTarget.onFix(p);
        });
      }
      list.appendChild(el);
    });
  }
  function closeRepair() {
    if (!repairOpen) return;
    repairOpen = false;
    $('repair-screen').classList.add('hidden');
    Sfx.uiClose();
    Game.requestPointerLock();
  }

  // ---------- 过渡 ----------
  function fade(toBlack, dur = 800, white = false) {
    const el = $('fade-overlay');
    el.classList.toggle('white', white);
    el.style.transitionDuration = dur + 'ms';
    el.style.opacity = toBlack ? 1 : 0;
    return new Promise(res => setTimeout(res, dur));
  }
  function warpLines(on) { $('warp-lines').classList.toggle('active', on); }

  function setDamageVignette(v) { $('damage-vignette').style.opacity = v; }
  function setHeatOverlay(v) { $('heat-overlay').style.opacity = v; }

  return {
    $, notify, pickup, setBar, setBarDanger, interactTip, setMission, setPlanetInfo, setEnvReadout,
    addMarker, removeMarker, updateMarker, clearMarkers, setMineProgress,
    toggleInventory, get invOpen() { return invOpen; },
    openRepair, closeRepair, get repairOpen() { return repairOpen; }, renderRepairList,
    fade, warpLines, setDamageVignette, setHeatOverlay, renderInventory,
  };
})();
