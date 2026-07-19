/* ui.js - HUD、创造物品栏、设置、FPS 面板 */
const UI = (function () {
  'use strict';
  let G, canvas, shotMode = false;
  const hotbar = new Array(9).fill(null);
  let sel = 0;
  let invOpen = false, setOpen = false;
  let els = {};
  let errCount = 0, lastErr = '';

  function el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    (parent || document.body).appendChild(e);
    return e;
  }

  /* ---------- MC 皮肤：全部界面纹理由 SVG 程序化绘制（与 textures.js 思路一致，零外部图片） ---------- */
  function skinRand(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function svgURI(inner, w, h) {
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" shape-rendering="crispEdges">' + inner + '</svg>') + '")';
  }
  function hex(c) {
    return '#' + ((1 << 24) + (Math.max(0, Math.min(255, c[0] | 0)) << 16) +
      (Math.max(0, Math.min(255, c[1] | 0)) << 8) + Math.max(0, Math.min(255, c[2] | 0))).toString(16).slice(1);
  }
  // 16×16 噪点像素块（MC 泥土/石面质感）
  function noiseTile(base, vary, seed, speckDark, speckLite) {
    const r = skinRand(seed);
    let s = '';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = (r() - 0.5) * vary;
      let c = [base[0] + k, base[1] + k, base[2] + k];
      const rv = r();
      if (rv < 0.06 && speckDark) c = speckDark;
      else if (rv > 0.955 && speckLite) c = speckLite;
      s += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + hex(c) + '"/>';
    }
    return svgURI(s, 16, 16);
  }
  // 槽位：内凹浮雕（上左暗、下右亮，MC 经典 slot）
  function slotTile(px) {
    const n = px || 18;
    let s = '<rect width="' + n + '" height="' + n + '" fill="#8b8b8b"/>';
    s += '<rect width="' + n + '" height="1" fill="#373737"/><rect width="1" height="' + n + '" fill="#373737"/>';
    s += '<rect y="' + (n - 1) + '" width="' + n + '" height="1" fill="#ffffff"/><rect x="' + (n - 1) + '" width="1" height="' + n + '" fill="#ffffff"/>';
    s += '<rect x="' + (n - 1) + '" y="0" width="1" height="1" fill="#8b8b8b"/><rect x="0" y="' + (n - 1) + '" width="1" height="1" fill="#8b8b8b"/>';
    return svgURI(s, n, n);
  }
  // 石质按钮面（带上亮下暗浮雕 + 噪点）
  function buttonTile(base, seed) {
    const r = skinRand(seed);
    let s = '';
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const k = (r() - 0.5) * 14;
      s += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + hex([base[0] + k, base[1] + k, base[2] + k]) + '"/>';
    }
    s += '<rect width="20" height="1" fill="' + hex([base[0] + 40, base[1] + 40, base[2] + 40]) + '"/>';
    s += '<rect width="1" height="20" fill="' + hex([base[0] + 28, base[1] + 28, base[2] + 28]) + '"/>';
    s += '<rect y="18" width="20" height="2" fill="' + hex([base[0] - 42, base[1] - 42, base[2] - 42]) + '"/>';
    s += '<rect x="19" width="1" height="20" fill="' + hex([base[0] - 30, base[1] - 30, base[2] - 30]) + '"/>';
    return svgURI(s, 20, 20);
  }
  function injectMcSkin() {
    const root = document.documentElement.style;
    root.setProperty('--mc-dirt', noiseTile([58, 41, 29], 22, 11, [40, 27, 18], [78, 57, 40]));       // 暗泥土（菜单底）
    root.setProperty('--mc-stonepanel', noiseTile([198, 198, 198], 10, 23, null, [214, 214, 214]));   // 浅石面板
    root.setProperty('--mc-stone', noiseTile([139, 139, 139], 16, 37, [116, 116, 116], [158, 158, 158])); // 石面
    root.setProperty('--mc-slot', slotTile(18));
    root.setProperty('--mc-btn', buttonTile([112, 112, 112], 53));
    root.setProperty('--mc-btnhover', buttonTile([126, 136, 180], 53));
    root.setProperty('--mc-btngreen', buttonTile([94, 124, 66], 67));
  }
  const CROSS_SVG =
    '<svg width="22" height="22" viewBox="0 0 22 22" shape-rendering="crispEdges">' +
    '<path d="M10 2h2v8h8v2h-8v8h-2v-8H2v-2h8z" fill="#ffffff"/></svg>';

  function buildHud() {
    els.cross = el('div', 'crosshair', null, CROSS_SVG);
    els.fps = el('div', 'fpspanel');
    els.hotbar = el('div', 'hotbar');
    els.slots = [];
    for (let i = 0; i < 9; i++) {
      const s = el('div', 'slot', els.hotbar);
      s.dataset.i = i;
      s.addEventListener('click', function () { selectSlot(+s.dataset.i); });
      els.slots.push(s);
    }
    els.water = el('div', 'waterfx');
    els.hint = el('div', 'hint', null,
      'WASD 移动 · 空格跳/双击空格飞行 · Ctrl 加速 · 左键破坏 · 右键放置 · E 物品栏 · 滚轮换物品');
    setTimeout(function () { if (els.hint) els.hint.style.opacity = '0'; }, 9000);
  }

  function refreshHotbar() {
    for (let i = 0; i < 9; i++) {
      const s = els.slots[i];
      s.classList.toggle('sel', i === sel);
      s.innerHTML = '';
      const it = hotbar[i];
      if (it) {
        const img = document.createElement('img');
        img.src = it.icon();
        s.appendChild(img);
        s.title = it.name;
      }
    }
  }
  function selectSlot(i) { sel = i; refreshHotbar(); }

  function buildOverlay() {
    els.overlay = el('div', 'overlay');
    const box = el('div', 'menubox', els.overlay);
    el('h1', null, box, '方块旷野 <span style="font-size:14px;color:#9db">VoxelCraft</span>');
    el('p', null, box, '原创体素沙盒 · 7 大群系 · Voxy 式 LOD 远景 · ' + (typeof ITEMS !== 'undefined' ? ITEMS.kindCount() : '?') + ' 种物品');
    const btn = el('button', 'bigbtn', box, '点击进入世界');
    btn.addEventListener('click', function () {
      hideModals();
      canvas.requestPointerLock();
    });
    const btn2 = el('button', 'smallbtn', box, '设置');
    btn2.addEventListener('click', function () { openSettings(); });
    el('p', 'tips', box, '视距设置里可开启最高 8192 格远景');
  }

  function buildInventory() {
    els.inv = el('div', 'inv');
    const head = el('div', 'invhead', els.inv);
    el('span', null, head, '创造模式物品栏 · 共 <b>' + ITEMS.kindCount() + '</b> 种（染色系列合一）');
    const search = el('input', 'invsearch', head);
    search.placeholder = '搜索…';
    search.addEventListener('input', function () { fillGrid(curCat, search.value.trim()); });
    els.tabs = el('div', 'invtabs', els.inv);
    els.grid = el('div', 'invgrid', els.inv);
    let curCat = ITEMS.categories()[0];
    ITEMS.categories().forEach(function (cat) {
      const t = el('button', 'invtab', els.tabs, cat);
      t.addEventListener('click', function () {
        curCat = cat;
        els.tabs.querySelectorAll('.invtab').forEach(function (b) { b.classList.remove('on'); });
        t.classList.add('on');
        fillGrid(cat, search.value.trim());
      });
    });
    els.tabs.firstChild.classList.add('on');
    function fillGrid(cat, q) {
      els.grid.innerHTML = '';
      ITEMS.all().forEach(function (it) {
        if (it.cat !== cat) return;
        if (q && it.name.indexOf(q) < 0) return;
        const cell = el('div', 'invcell', els.grid);
        cell.title = it.name;
        const img = document.createElement('img');
        img.src = it.icon();
        cell.appendChild(img);
        cell.addEventListener('click', function () {
          hotbar[sel] = it;
          refreshHotbar();
          cell.classList.add('flash');
          setTimeout(function () { cell.classList.remove('flash'); }, 200);
        });
      });
    }
    fillGrid(curCat, '');
    els.invGridFill = fillGrid;
  }

  function buildSettings() {
    els.set = el('div', 'settings');
    el('h2', null, els.set, '设置');
    const rows = el('div', null, els.set);
    // 远景视距
    const vdRow = el('div', 'setrow', rows);
    el('label', null, vdRow, '远景视距');
    const vdVal = el('span', 'setval', vdRow, '');
    const vd = document.createElement('input');
    vd.type = 'range'; vd.min = 9; vd.max = 13; vd.step = 1;
    vd.value = Math.round(Math.log(World.getViewDist()) / Math.LN2);
    vdRow.appendChild(vd);
    function updVd() {
      const v = 1 << +vd.value;
      vdVal.textContent = v + ' 格';
      World.setViewDist(v);
    }
    vd.addEventListener('input', updVd);
    vdVal.textContent = World.getViewDist() + ' 格';
    // 近景半径
    const nrRow = el('div', 'setrow', rows);
    el('label', null, nrRow, '近景区块半径');
    const nrVal = el('span', 'setval', nrRow, '');
    const nr = document.createElement('input');
    nr.type = 'range'; nr.min = 3; nr.max = 12; nr.step = 1;
    nr.value = World.getNearRadius();
    nrRow.appendChild(nr);
    nr.addEventListener('input', function () {
      nrVal.textContent = nr.value + ' 区块';
      World.setNearRadius(+nr.value);
    });
    nrVal.textContent = nr.value + ' 区块';
    // 移动速度
    const spRow = el('div', 'setrow', rows);
    el('label', null, spRow, '移动速度（含上升/下降）');
    const spVal = el('span', 'setval', spRow, '');
    const sp = document.createElement('input');
    sp.type = 'range'; sp.min = 1; sp.max = 10; sp.step = 0.5;
    sp.value = Player.getSpeedMult();
    spRow.appendChild(sp);
    sp.addEventListener('input', function () {
      spVal.textContent = '×' + sp.value;
      Player.setSpeedMult(+sp.value);
    });
    spVal.textContent = '×' + sp.value;
    // 渲染分辨率
    const prRow = el('div', 'setrow', rows);
    el('label', null, prRow, '渲染分辨率（画质）');
    const prVal = el('span', 'setval', prRow, '');
    const pr = document.createElement('input');
    pr.type = 'range'; pr.min = 0.5; pr.max = 2; pr.step = 0.25;
    pr.value = Math.min(window.devicePixelRatio || 1, 2);
    prRow.appendChild(pr);
    pr.addEventListener('input', function () {
      prVal.textContent = '×' + pr.value;
      if (UI.onPixelRatio) UI.onPixelRatio(+pr.value);
    });
    prVal.textContent = '×' + pr.value;
    // FOV
    const fovRow = el('div', 'setrow', rows);
    el('label', null, fovRow, '视野 FOV');
    const fovVal = el('span', 'setval', fovRow, '');
    const fov = document.createElement('input');
    fov.type = 'range'; fov.min = 55; fov.max = 110; fov.step = 1;
    fov.value = 75;
    fovRow.appendChild(fov);
    fov.addEventListener('input', function () {
      fovVal.textContent = fov.value + '°';
      if (UI.onFov) UI.onFov(+fov.value);
    });
    fovVal.textContent = '75°';
    const closeBtn = el('button', 'bigbtn', els.set, '返回');
    closeBtn.addEventListener('click', function () { closeSettings(); });
  }

  function openInv() {
    invOpen = true;
    els.inv.style.display = 'flex';
    document.exitPointerLock();
  }
  function closeInv() { invOpen = false; els.inv.style.display = 'none'; }
  function openSettings() { setOpen = true; els.set.style.display = 'block'; els.overlay.style.display = 'none'; }
  function closeSettings() { setOpen = false; els.set.style.display = 'none'; syncOverlay(); }
  function hideModals() {
    closeInv(); if (setOpen) closeSettings();
    els.overlay.style.display = 'none';
  }
  function syncOverlay() {
    if (shotMode) { els.overlay.style.display = 'none'; return; }
    const locked = document.pointerLockElement === canvas;
    els.overlay.style.display = (!locked && !invOpen && !setOpen) ? 'flex' : 'none';
  }

  return {
    onFov: null,
    init: function (opts) {
      G = opts.G; canvas = opts.canvas; shotMode = !!opts.shot;
      injectMcSkin();
      buildHud();
      buildInventory();
      buildOverlay();
      buildSettings();
      closeInv();
      els.set.style.display = 'none';
      // 默认物品
      const def = ['b1', 'b3', 'b31', 'b63', 'b48', 'b5', 'b25', 'b35', 'b53'];
      for (let i = 0; i < 9; i++) hotbar[i] = ITEMS.get(def[i]) || null;
      refreshHotbar();
      syncOverlay();

      window.addEventListener('error', function (e) {
        errCount++;
        lastErr = (e.message || 'err') + '';
      });
      window.addEventListener('unhandledrejection', function (e) {
        errCount++;
        lastErr = 'promise: ' + (e.reason && e.reason.message || e.reason);
      });

      if (shotMode) return;
      document.addEventListener('pointerlockchange', syncOverlay);
      document.addEventListener('keydown', function (e) {
        if (e.code === 'KeyE') {
          if (invOpen) { closeInv(); canvas.requestPointerLock(); }
          else if (document.pointerLockElement === canvas || els.overlay.style.display === 'none') openInv();
          else openInv();
          e.preventDefault();
        }
        if (e.code === 'Escape' && invOpen) closeInv();
        if (e.code >= 'Digit1' && e.code <= 'Digit9') selectSlot(+e.code.slice(5) - 1);
      });
      window.addEventListener('wheel', function (e) {
        if (document.pointerLockElement !== canvas) return;
        sel = (sel + (e.deltaY > 0 ? 1 : 8)) % 9;
        refreshHotbar();
      }, { passive: true });
    },
    selectedItem: function () { return hotbar[sel]; },
    setWaterFx: function (on) { els.water.style.display = on ? 'block' : 'none'; },
    errors: function () { return { n: errCount, last: lastErr }; },
    updateStats: function (s) {
      els.fps.innerHTML =
        'FPS <b>' + s.fps + '</b> · ' + s.ms.toFixed(1) + 'ms<br>' +
        'DrawCalls ' + s.calls + ' · Tris ' + (s.tris / 1000 | 0) + 'k<br>' +
        '近景区块 ' + s.chunks + ' (队列 ' + s.chunkQueue + ')<br>' +
        'LOD瓦片 ' + s.tiles + ' (队列 ' + s.tileQueue + ' · 缓存 ' + (s.tileCache || 0) + ') · L' + s.maxLevel + '<br>' +
        '视距 ' + s.vd + ' 格 · ' + (s.mem ? (s.mem / 1048576 | 0) + 'MB' : '') + '<br>' +
        'XYZ ' + s.x + ' / ' + s.y + ' / ' + s.z + '<br>' +
        '群系 <b>' + s.biome + '</b>' + (s.fly ? ' · 飞行' : '') + (s.npc ? ' · NPC ×' + s.npc : '') + '<br>' +
        (errCount > 0
          ? '<span style="color:#f66">ERR ' + errCount + ': ' + lastErr.slice(0, 60) + '</span>'
          : '<span style="color:#8f8">ERR 0</span>');
    }
  };
})();
