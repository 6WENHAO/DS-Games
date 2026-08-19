/* ==========================================================================
   RAFT SURVIVAL · ui.js
   HUD / 背包·合成·建造·图鉴 / 工作站界面 / 建造预览 / 通知 / 钓鱼面板
   ========================================================================== */
RS.UI = function (game) {
  const U = RS.U, DB = RS.DB;
  const self = this;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const el = {
    loader: $('#loader'), lfill: $('#loader-fill'), ltext: $('#loader-text'), ltip: $('#loader-tip'),
    menu: $('#menu'), howto: $('#howto'), hud: $('#hud'),
    crosshair: $('#crosshair'), prompt: $('#prompt'),
    vitals: $('#vitals'), day: $('#day'), time: $('#time'),
    wIco: $('#weather-icon'), wTxt: $('#weather-text'),
    needle: $('#compass .needle'), cdir: $('#compass .cdir'),
    rBlocks: $('#raft-blocks'), rSpeed: $('#raft-speed'),
    hotbar: $('#hotbar'), handname: $('#handname'),
    questList: $('#quest-list'), toasts: $('#toasts'), pickups: $('#pickups'),
    sharkWarn: $('#shark-warn'), fishing: $('#fishing'),
    fSafe: $('#fishing .fish-safe'), fMark: $('#fishing .fish-marker'),
    fTens: $('#fishing .fish-tension i'), fHint: $('#fishing .fish-hint'),
    buildbar: $('#buildbar'), bbName: $('#buildbar .bb-name'), bbCost: $('#buildbar .bb-cost'),
    panelInv: $('#panel-inv'), invGrid: $('#inv-grid'), itemDetail: $('#item-detail'),
    craftCats: $('#craft-cats'), craftGrid: $('#craft-grid'), craftDetail: $('#craft-detail'),
    buildGrid: $('#build-grid'), notes: $('#notes'),
    panelStation: $('#panel-station'), stTitle: $('#panel-station .st-title'), stBody: $('#station-body'),
    panelPause: $('#panel-pause'), pauseStats: $('#pause-stats'),
    panelDead: $('#panel-dead'), deadTitle: $('#dead-title'), deadDesc: $('#dead-desc'), deadStats: $('#dead-stats'),
    tint: $('#underwater-tint'), drops: $('#water-drops'), dmg: $('#damage-flash')
  };
  this.el = el;

  const ghost = document.createElement('div');
  ghost.id = 'drag-ghost'; ghost.style.display = 'none';
  document.body.appendChild(ghost);

  this.shake = 0;
  this.buildMode = false;
  this.buildId = 'foundation';
  this.buildRotOverride = null;
  let selSlot = -1, dragFrom = -1;
  let craftSel = null, craftCat = 'all';
  let curStation = null;
  let deathCause = '力竭';

  /* ==================================================== 通知 / 提示 */
  this.toast = function (text, kind) {
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    const m = text.match(/^(\S{1,2})\s(.*)$/u);
    if (m && /[^\w\u4e00-\u9fa5]/.test(m[1])) d.innerHTML = '<span class="t-ico">' + m[1] + '</span><span>' + m[2] + '</span>';
    else d.textContent = text;
    el.toasts.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 320); }, 3400);
    while (el.toasts.children.length > 6) el.toasts.firstChild.remove();
  };
  const pickQueue = {};
  this.pickupFeed = function (id, n) {
    if (pickQueue[id]) {
      pickQueue[id].n += n;
      pickQueue[id].node.querySelector('b').textContent = '+' + pickQueue[id].n;
      clearTimeout(pickQueue[id].timer);
    } else {
      const d = document.createElement('div');
      d.className = 'pick';
      d.innerHTML = '<span>' + DB.ico(id) + '</span><span>' + DB.name(id) + '</span><b>+' + n + '</b>';
      el.pickups.appendChild(d);
      pickQueue[id] = { n, node: d };
    }
    pickQueue[id].timer = setTimeout(() => {
      const q = pickQueue[id]; delete pickQueue[id];
      if (q) { q.node.style.transition = 'opacity .4s'; q.node.style.opacity = 0; setTimeout(() => q.node.remove(), 420); }
    }, 2200);
    while (el.pickups.children.length > 7) el.pickups.firstChild.remove();
  };
  this.damageFlash = function (n) {
    el.dmg.classList.add('on');
    setTimeout(() => el.dmg.classList.remove('on'), 60);
    self.shake = Math.min(1.4, self.shake + U.clamp(n / 40, .1, .8));
  };
  this.flashVitals = function () { el.vitals.style.filter = 'brightness(1.5)'; setTimeout(() => el.vitals.style.filter = '', 160); };
  this.shakeCam = function (a) { self.shake = Math.min(1.6, self.shake + a); };
  this.setCause = function (w) { deathCause = w; };
  this.setUnderwater = function (on) {
    el.tint.classList.toggle('on', on);
    if (!on) { el.drops.classList.add('on'); setTimeout(() => el.drops.classList.remove('on'), 2600); }
  };
  this.setSharkWarn = function (level) {
    el.sharkWarn.classList.toggle('hidden', !level);
    if (level) el.sharkWarn.querySelector('span').textContent = level > 1 ? '⚠ 布鲁斯正在冲过来！' : '⚠ 布鲁斯就在附近';
  };

  /* ==================================================== 交互提示 */
  const PT = el.prompt.querySelector('.prompt-title');
  const PD = el.prompt.querySelector('.prompt-desc');
  const PK = el.prompt.querySelector('.key');
  const PP = el.prompt.querySelector('.prompt-progress i');
  this.updatePrompt = function (t) {
    let title = null, desc = '', key = 'E', prog = -1;
    if (t) {
      const ud = t.ud;
      if (ud.type === 'object' && ud.cell.obj) {
        const o = ud.cell.obj, def = DB.BUILD_MAP[o.id];
        title = def.name;
        if (o.station === 'sail') desc = o.data.up ? '按 E 收起船帆' : '按 E 升起船帆';
        else if (o.station === 'anchor') desc = o.data.down ? '按 E 收锚' : '按 E 抛锚（停船）';
        else if (o.station === 'wheel') desc = '按 E 掌舵';
        else if (o.station === 'net') desc = '按 E 取出物资（' + (o.data.count || 0) + ' 件）';
        else if (o.station === 'lamp') desc = '按 E 开关';
        else if (o.station === 'crop') desc = o.data.ready ? '按 E 收获' : o.data.seed ? '按 E 查看（生长中）' : '按 E 播种';
        else if (o.station) desc = '按 E 打开';
        else desc = '（装饰）';
      } else if (ud.type === 'base') {
        const b = ud.cell.base;
        title = DB.BUILD_MAP[b.id].name;
        desc = b.hp < b.maxHp ? '受损 ' + Math.round(b.hp) + '/' + b.maxHp + ' — 用锤子左键修复' : '结构完好';
        prog = b.hp / b.maxHp;
        key = '🔨';
      } else if (ud.type === 'node') {
        const n = ud.node, def = DB.NODES[n.type];
        if (n.hp <= 0) { title = null; }
        else {
          title = def.name;
          desc = def.tool === 'axe' ? '需要斧头 · 左键采集' : '左键采集';
          prog = n.hp / n.max;
          key = '⛏';
        }
      } else if (ud.type === 'pickup') {
        title = DB.name(ud.item.id) + ' ×' + ud.item.n; desc = '按 E 拾取';
      } else if (ud.type === 'debris') {
        title = '漂流物'; desc = t.dist < 4 ? '按 E 捞起' : '用打捞钩（按住左键蓄力）';
      } else if (ud.type === 'shark') {
        title = '布鲁斯'; desc = '用矛攻击它！'; key = '🔱';
      } else if (ud.type === 'fish') {
        title = '鱼'; desc = '用矛可以直接刺鱼'; key = '🔱';
      }
    }
    if (!title) { el.prompt.classList.add('hidden'); el.crosshair.classList.remove('act', 'hit'); return; }
    el.prompt.classList.remove('hidden');
    el.crosshair.classList.add('act');
    PT.textContent = title; PD.textContent = desc; PK.textContent = key;
    if (prog >= 0) { el.prompt.classList.add('holding'); PP.style.width = (prog * 100) + '%'; }
    else el.prompt.classList.remove('holding');
  };

  /* ==================================================== HUD 刷新 */
  const vbars = {};
  $$('#vitals .vital').forEach(v => {
    vbars[v.dataset.k] = { root: v, fill: v.querySelector('.v-bar i'), num: v.querySelector('.v-num') };
  });
  let hudT = 0;
  this.update = function (dt) {
    hudT += dt;
    const p = game.player, W = game.world;
    /* 数值条 */
    const map = { health: p.v.hp, hunger: p.v.hunger, thirst: p.v.thirst, oxygen: p.v.oxy };
    for (const k in vbars) {
      const b = vbars[k], v = map[k];
      b.fill.style.width = U.clamp(v, 0, 100) + '%';
      b.num.textContent = Math.round(v);
      b.root.classList.toggle('low', v < 22);
      if (k === 'oxygen') b.root.classList.toggle('show', p.underwater || v < 99.5);
    }
    if (hudT < .12) return;
    hudT = 0;
    /* 时钟 天气 */
    el.day.textContent = '第 ' + W.day + ' 天';
    el.time.textContent = U.fmtTime(W.timeOfDay);
    const wm = { clear: ['☀', '晴'], cloudy: ['⛅', '多云'], rain: ['🌧', '下雨'], storm: ['⛈', '暴风雨'] }[W.weather] || ['☀', '晴'];
    el.wIco.textContent = W.isNight() ? '🌙' : wm[0];
    el.wTxt.textContent = (W.isNight() ? '夜间 · ' : '') + wm[1];
    /* 罗盘 */
    const deg = -p.yaw * 180 / Math.PI;
    el.needle.style.transform = 'rotate(' + deg + 'deg)';
    el.cdir.textContent = U.dirName(-p.yaw + Math.PI);
    /* 木筏信息 */
    el.rBlocks.textContent = game.raft.countFoundations();
    el.rSpeed.textContent = (game.raft.vel.length() * 1.94).toFixed(1);
    /* 快捷栏 */
    refreshHotbar();
    refreshQuests();
    if (self.buildMode) updateBuildBar();
    if (curStation) renderStation(curStation);
  };

  /* ==================================================== 快捷栏 */
  let lastHeld = '__';
  function slotHTML(s, i, hot) {
    let h = '<div class="ico">' + (s ? DB.ico(s.id) : '') + '</div>';
    if (s && s.n > 1) h += '<div class="cnt">' + s.n + '</div>';
    if (hot) h += '<div class="key">' + (i + 1) + '</div>';
    return h;
  }
  function refreshHotbar() {
    const inv = game.inv;
    if (el.hotbar.children.length !== inv.hotbarN) {
      el.hotbar.innerHTML = '';
      for (let i = 0; i < inv.hotbarN; i++) {
        const d = document.createElement('div');
        d.className = 'slot'; d.dataset.i = i;
        d.addEventListener('click', () => { inv.sel = i; game.bus.emit('inv'); RS.Audio.play('ui_hover'); });
        el.hotbar.appendChild(d);
      }
    }
    for (let i = 0; i < inv.hotbarN; i++) {
      const d = el.hotbar.children[i], s = inv.slots[i];
      d.classList.toggle('sel', i === inv.sel);
      const want = slotHTML(s, i, true);
      if (d.dataset.h !== want) { d.innerHTML = want; d.dataset.h = want; }
    }
    const held = inv.heldId();
    if (held !== lastHeld) {
      lastHeld = held;
      if (held) {
        el.handname.textContent = DB.name(held);
        el.handname.classList.add('show');
        clearTimeout(el.handname._t);
        el.handname._t = setTimeout(() => el.handname.classList.remove('show'), 1600);
      } else el.handname.classList.remove('show');
    }
  }

  /* ==================================================== 任务 */
  function refreshQuests() {
    const list = game.quests.filter(q => !q.done).slice(0, 4);
    const done = game.quests.filter(q => q.done).slice(-1);
    const show = done.concat(list);
    const sig = show.map(q => q.def.id + q.prog + q.done).join('|');
    if (el.questList.dataset.sig === sig) return;
    el.questList.dataset.sig = sig;
    el.questList.innerHTML = show.map(q =>
      '<div class="q-item' + (q.done ? ' done' : '') + '"><div class="q-box"></div>' +
      '<div class="q-text">' + q.def.text +
      (q.def.goal > 1 ? '<span class="q-prog">' + Math.min(q.prog, q.def.goal) + '/' + q.def.goal + '</span>' : '') +
      '</div></div>').join('');
  }

  /* ==================================================== 建造模式 */
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x5fbf5f, transparent: true, opacity: .5, depthWrite: false });
  const ghostBadMat = new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: .45, depthWrite: false });
  let ghostMesh = null, ghostTarget = null;
  function ensureGhost(kind, half) {
    const key = kind + (half ? 'h' : '');
    if (ghostMesh && ghostMesh.userData.key === key) return ghostMesh;
    if (ghostMesh) { game.raft.root.remove(ghostMesh); ghostMesh.geometry.dispose(); }
    let g;
    const C = game.raft.CELL;
    if (kind === 'base') g = new THREE.BoxGeometry(C, .24, C);
    else if (kind === 'upper') g = new THREE.BoxGeometry(C, .2, C);
    else if (kind === 'roof') g = new THREE.BoxGeometry(C + .1, .12, C + .1);
    else if (kind === 'edge') g = new THREE.BoxGeometry(C, half ? 1.0 : 2.3, .16);
    else g = new THREE.BoxGeometry(1.0, 1.1, 1.0);
    ghostMesh = new THREE.Mesh(g, ghostMat);
    ghostMesh.userData.key = key;
    ghostMesh.renderOrder = 5;
    // 描边：让半透明预览在木纹背景上也清晰可辨
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g),
      new THREE.LineBasicMaterial({ color: 0xe8fff0 }));
    edges.renderOrder = 6;
    ghostMesh.add(edges);
    ghostMesh.userData.edges = edges;
    game.raft.root.add(ghostMesh);
    return ghostMesh;
  }
  /* 调试/自检用：返回建造预览的真实状态 */
  this.debugGhost = function () {
    if (!ghostMesh) return null;
    return {
      visible: ghostMesh.visible,
      pos: ghostMesh.position.toArray().map(v => Math.round(v * 100) / 100),
      ok: ghostTarget ? ghostTarget.ok : null,
      color: ghostMesh.material.color.getHexString()
    };
  };
  this.setBuild = function (id) {
    self.buildId = id;
    self.buildRotOverride = null;
    if (!self.buildMode) self.toggleBuild(true);
    updateBuildBar();
    $$('#build-grid .bitem').forEach(b => b.classList.toggle('sel', b.dataset.id === id));
  };
  this.toggleBuild = function (on) {
    const want = on === undefined ? !self.buildMode : on;
    if (want && game.inv.heldId() !== 'hammer') {
      // 自动切到锤子
      const i = game.inv.slots.findIndex(s => s && s.id === 'hammer');
      if (i < 0) { self.toast('需要先合成建造锤', 'bad'); RS.Audio.play('ui_deny'); return; }
      if (i < game.inv.hotbarN) game.inv.sel = i; else { game.inv.swap(i, game.inv.sel); }
      game.bus.emit('inv');
    }
    self.buildMode = want;
    el.buildbar.classList.toggle('hidden', !want);
    if (ghostMesh) ghostMesh.visible = want;
    RS.Audio.play(want ? 'ui_open' : 'ui_close');
    if (want) updateBuildBar();
  };
  this.rotateBuild = function () {
    const def = DB.BUILD_MAP[self.buildId];
    if (!def || def.kind !== 'edge') { self.toast('这个建筑不需要旋转', ''); return; }
    self.buildRotOverride = ((self.buildRotOverride == null ? 0 : self.buildRotOverride) + 1) % 4;
    RS.Audio.play('ui_hover');
  };
  const BUILD_ORDER = DB.BUILD.map(b => b.id);
  this.cycleBuild = function (dir) {
    let i = BUILD_ORDER.indexOf(self.buildId);
    for (let k = 0; k < BUILD_ORDER.length; k++) {
      i = (i + dir + BUILD_ORDER.length) % BUILD_ORDER.length;
      const def = DB.BUILD_MAP[BUILD_ORDER[i]];
      if (def.lock && !game.unlocked[def.lock]) continue;
      self.setBuild(BUILD_ORDER[i]); return;
    }
  };
  function updateBuildBar() {
    const def = DB.BUILD_MAP[self.buildId];
    if (!def) return;
    el.bbName.textContent = def.ico + ' ' + def.name;
    let lack = false;
    const parts = [];
    for (const k in def.cost) {
      const have = game.inv.count(k), need = def.cost[k];
      if (have < need) lack = true;
      parts.push(DB.ico(k) + DB.name(k) + ' ' + have + '/' + need);
    }
    el.bbCost.textContent = parts.join('  ');
    el.bbCost.classList.toggle('lack', lack);
  }
  /* 计算瞄准的格子 */
  function aimCell() {
    const raft = game.raft;
    const cam = game.camera;
    const o = cam.getWorldPosition(new THREE.Vector3());
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    const inv = new THREE.Matrix4().copy(raft.root.matrixWorld).invert();
    const lo = o.clone().applyMatrix4(inv);
    const ld = d.clone().transformDirection(inv);
    const def = DB.BUILD_MAP[self.buildId];
    const planeY = def.kind === 'upper' ? 2.55 : def.kind === 'roof' ? 2.42 : 0.14;
    if (Math.abs(ld.y) < 1e-4) return null;
    const t = (planeY - lo.y) / ld.y;
    if (t < .3 || t > 9) return null;
    const hit = lo.clone().addScaledVector(ld, t);
    const C = raft.CELL;
    const i = Math.round(hit.x / C), j = Math.round(hit.z / C);
    let dir = raft.edgeFromLocal(hit.x, hit.z, i, j);
    if (self.buildRotOverride != null) dir = self.buildRotOverride;
    return { i, j, dir, hit };
  }
  this.updateBuildGhost = function () {
    if (!self.buildMode) { if (ghostMesh) ghostMesh.visible = false; ghostTarget = null; return; }
    const def = DB.BUILD_MAP[self.buildId];
    const a = aimCell();
    if (!a) { if (ghostMesh) ghostMesh.visible = false; ghostTarget = null; return; }
    const g = ensureGhost(def.kind, def.half);
    g.visible = true;
    const C = game.raft.CELL;
    const chk = game.raft.canPlace(self.buildId, a.i, a.j, a.dir);
    const afford = game.inv.canAfford(def.cost);
    g.material = (chk.ok && afford) ? ghostMat : ghostBadMat;
    if (g.userData.edges) g.userData.edges.material.color.setHex((chk.ok && afford) ? 0xe8fff0 : 0xffd8de);
    if (def.kind === 'edge') {
      const o = [[0, -1], [1, 0], [0, 1], [-1, 0]][a.dir];
      g.position.set(a.i * C + o[0] * C / 2, .14 + (def.half ? .5 : 1.15), a.j * C + o[1] * C / 2);
      g.rotation.y = (a.dir === 1 || a.dir === 3) ? Math.PI / 2 : 0;
    } else if (def.kind === 'roof') {
      g.position.set(a.i * C, 2.48, a.j * C); g.rotation.y = 0;
    } else if (def.kind === 'upper') {
      g.position.set(a.i * C, 2.55, a.j * C); g.rotation.y = 0;
    } else if (def.kind === 'base') {
      g.position.set(a.i * C, 0, a.j * C); g.rotation.y = 0;
    } else {
      g.position.set(a.i * C, .14 + .55, a.j * C); g.rotation.y = 0;
    }
    ghostTarget = { a, ok: chk.ok && afford, why: chk.why };
  };
  this.tryBuildPlace = function () {
    if (!ghostTarget) return;
    const a = ghostTarget.a;
    const r = game.raft.place(self.buildId, a.i, a.j, a.dir);
    if (!r.ok) { self.toast(r.why, 'bad'); RS.Audio.play('ui_deny'); }
    else { updateBuildBar(); if (DB.BUILD_MAP[self.buildId].station) self.toggleBuild(false); }
  };

  /* ==================================================== 面板通用 */
  function anyPanel() {
    return !el.panelInv.classList.contains('hidden') || !el.panelStation.classList.contains('hidden') ||
      !el.panelPause.classList.contains('hidden') || !el.panelDead.classList.contains('hidden');
  }
  this.anyPanel = anyPanel;
  this.closeAll = function (silent) {
    el.panelInv.classList.add('hidden');
    el.panelStation.classList.add('hidden');
    curStation = null;
    if (!silent) RS.Audio.play('ui_close');
    if (!game.paused && !game.player.dead) game.player.setActive(true);
  };
  function openPanel(p) {
    game.player.setActive(false);
    p.classList.remove('hidden');
    RS.Audio.play('ui_open');
  }

  /* ==================================================== 背包 */
  function itemStats(it) {
    const s = [];
    if (it.food) s.push('🍗 饱腹 +' + it.food);
    if (it.water) s.push('💧 水分 +' + it.water);
    if (it.heal) s.push('❤ 治疗 +' + it.heal);
    if (it.fuel) s.push('🔥 燃料 ' + it.fuel + 's');
    if (it.tool) s.push('🛠 ' + { hammer: '建造', hook: '打捞', axe: '砍伐', spear: '武器', rod: '钓鱼', cup: '取水', bucket: '取水', torch: '照明' }[it.tool]);
    if (it.dmg) s.push('⚔ 伤害 ' + it.dmg);
    if (it.cookTo) s.push('♨ 可烤成 ' + DB.name(it.cookTo));
    if (it.seedOf) s.push('🌱 可种植');
    if (it.badWater) s.push('⚠ 不可直接饮用');
    return s;
  }
  function renderDetail(i) {
    const s = game.inv.slots[i];
    if (!s) { el.itemDetail.innerHTML = '<div class="d-empty">选择一件物品查看详情</div>'; return; }
    const it = DB.item(s.id);
    let acts = '';
    if (it.food || it.water || it.heal || it.badWater) acts += '<button class="btn small" data-act="use">使用</button>';
    if (it.cookTo) acts += '<button class="btn small" data-act="cook">放入烤架</button>';
    if (it.seedOf) acts += '<button class="btn small" data-act="plant">种到种植槽</button>';
    if (i >= game.inv.hotbarN) acts += '<button class="btn small" data-act="hot">移到快捷栏</button>';
    acts += '<button class="btn small" data-act="drop">丢弃</button>';
    el.itemDetail.innerHTML =
      '<div class="d-head"><div class="d-ico">' + it.ico + '</div><div><div class="d-name">' + it.name +
      '</div><div class="d-cat">' + ({ res: '材料', food: '食物 / 药品', drink: '饮水', tool: '工具' }[it.cat] || '物品') +
      ' · ×' + s.n + '</div></div></div>' +
      '<div class="d-desc">' + (it.desc || '') + '</div>' +
      '<div class="d-stats">' + itemStats(it).map(x => '<span class="d-stat">' + x + '</span>').join('') + '</div>' +
      '<div class="d-acts">' + acts + '</div>';
    el.itemDetail.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'use') {
        const old = game.inv.sel; game.inv.sel = i;
        game.player.useHeldConsumable();
        game.inv.sel = old;
        renderDetail(i); refreshInv();
      } else if (a === 'drop') { game.inv.dropSlot(i); refreshInv(); renderDetail(i); }
      else if (a === 'hot') {
        let t = game.inv.slots.findIndex((x, k) => k < game.inv.hotbarN && !x);
        if (t < 0) t = game.inv.sel;
        game.inv.swap(i, t); refreshInv(); selSlot = t; renderDetail(t);
      } else if (a === 'cook') {
        const grill = game.raft.stations.find(o => o.station === 'grill');
        if (!grill) { self.toast('还没有烤架', 'bad'); return; }
        if (addToGrill(grill, s.id)) { self.toast('♨ 已放入烤架', 'good'); refreshInv(); renderDetail(i); }
      } else if (a === 'plant') {
        const plot = game.raft.stations.find(o => o.station === 'crop' && !o.data.seed);
        if (!plot) { self.toast('没有空的种植槽', 'bad'); return; }
        plantSeed(plot, s.id); refreshInv(); renderDetail(i);
      }
      RS.Audio.play('ui_click');
    }));
  }
  function refreshInv() {
    const inv = game.inv;
    if (el.invGrid.children.length !== inv.slots.length) {
      el.invGrid.innerHTML = '';
      for (let i = 0; i < inv.slots.length; i++) {
        const c = document.createElement('div');
        c.className = 'icell' + (i < inv.hotbarN ? ' hot' : '');
        c.dataset.i = i;
        c.addEventListener('mousedown', (e) => { dragFrom = i; startDrag(e, i); });
        c.addEventListener('mouseup', () => { if (dragFrom >= 0 && dragFrom !== i) { inv.swap(dragFrom, i); refreshInv(); } dragFrom = -1; endDrag(); });
        c.addEventListener('mouseenter', () => { if (dragFrom >= 0) c.classList.add('dragover'); });
        c.addEventListener('mouseleave', () => c.classList.remove('dragover'));
        c.addEventListener('click', () => { selSlot = i; renderDetail(i); RS.Audio.play('ui_hover'); });
        el.invGrid.appendChild(c);
      }
    }
    for (let i = 0; i < inv.slots.length; i++) {
      const c = el.invGrid.children[i], s = inv.slots[i];
      const want = slotHTML(s, i, false);
      if (c.dataset.h !== want) { c.innerHTML = want; c.dataset.h = want; }
      c.classList.remove('dragover');
    }
    if (selSlot >= 0) renderDetail(selSlot);
    if (!el.panelInv.classList.contains('hidden')) { refreshCraft(); refreshBuildList(); }
  }
  this.refreshInv = refreshInv;
  function startDrag(e, i) {
    const s = game.inv.slots[i]; if (!s) return;
    ghost.textContent = DB.ico(s.id);
    ghost.style.display = 'grid';
    moveGhost(e);
  }
  function moveGhost(e) { ghost.style.left = (e.clientX - 26) + 'px'; ghost.style.top = (e.clientY - 26) + 'px'; }
  function endDrag() { ghost.style.display = 'none'; }
  window.addEventListener('mousemove', e => { if (dragFrom >= 0) moveGhost(e); });
  window.addEventListener('mouseup', () => { dragFrom = -1; endDrag(); });

  /* ==================================================== 合成 */
  function refreshCraft() {
    if (!el.craftCats.children.length) {
      const cats = [['all', '全部'], ['res', '材料'], ['tool', '工具'], ['food', '药品与食物']];
      el.craftCats.innerHTML = cats.map(c => '<button class="ccat' + (c[0] === 'all' ? ' active' : '') + '" data-cat="' + c[0] + '">' + c[1] + '</button>').join('');
      el.craftCats.querySelectorAll('.ccat').forEach(b => b.addEventListener('click', () => {
        craftCat = b.dataset.cat;
        el.craftCats.querySelectorAll('.ccat').forEach(x => x.classList.toggle('active', x === b));
        refreshCraft(); RS.Audio.play('ui_hover');
      }));
    }
    const list = DB.RECIPES.filter(r => craftCat === 'all' || r.cat === craftCat);
    el.craftGrid.innerHTML = list.map(r => {
      const it = DB.item(r.out);
      const locked = r.lock && !game.unlocked[r.lock];
      const can = !locked && game.inv.canAfford(r.cost);
      const reqs = Object.keys(r.cost).map(k => {
        const ok = game.inv.count(k) >= r.cost[k];
        return '<span class="rq ' + (ok ? 'ok' : 'no') + '">' + DB.ico(k) + r.cost[k] + '</span>';
      }).join('');
      return '<div class="crecipe' + (can ? ' can' : '') + (locked ? ' locked' : '') + '" data-id="' + r.id + '">' +
        (locked ? '<span class="lk">🔒</span>' : '') +
        '<div class="ico">' + it.ico + '</div><div class="nm">' + it.name + (r.n > 1 ? ' ×' + r.n : '') + '</div>' +
        '<div class="reqs">' + reqs + '</div></div>';
    }).join('');
    el.craftGrid.querySelectorAll('.crecipe').forEach(c => c.addEventListener('click', () => {
      craftSel = c.dataset.id; renderCraftDetail(); RS.Audio.play('ui_hover');
    }));
    if (craftSel) renderCraftDetail();
  }
  function renderCraftDetail() {
    const r = DB.RECIPES.find(x => x.id === craftSel);
    if (!r) { el.craftDetail.classList.remove('on'); return; }
    const it = DB.item(r.out);
    const locked = r.lock && !game.unlocked[r.lock];
    const can = !locked && game.inv.canAfford(r.cost);
    el.craftDetail.classList.add('on');
    el.craftDetail.innerHTML =
      '<div class="cd-top"><div class="d-ico">' + it.ico + '</div><div><div class="cd-name">' + it.name +
      (r.n > 1 ? ' ×' + r.n : '') + '</div><div class="cd-desc">' + (it.desc || '') + '</div></div></div>' +
      '<div class="cd-row">' + Object.keys(r.cost).map(k => {
        const ok = game.inv.count(k) >= r.cost[k];
        return '<div class="cd-mat' + (ok ? '' : ' no') + '">' + DB.ico(k) + ' ' + DB.name(k) +
          ' <b>' + game.inv.count(k) + '/' + r.cost[k] + '</b></div>';
      }).join('') + '</div>' +
      (locked ? '<div class="st-note">🔒 需要研究：' + (DB.RESEARCH_MAP[r.lock] ? DB.RESEARCH_MAP[r.lock].name : r.lock) + '</div>' : '') +
      '<div class="cd-row"><button class="btn' + (can ? ' primary' : '') + '" id="do-craft"' + (can ? '' : ' disabled') + '>制 作</button></div>';
    const b = el.craftDetail.querySelector('#do-craft');
    if (b) b.addEventListener('click', () => {
      if (!game.inv.canAfford(r.cost)) return;
      game.inv.pay(r.cost);
      game.inv.add(r.out, r.n);
      RS.Audio.play('craft');
      self.toast('🔧 制作了 ' + DB.name(r.out), 'good');
      refreshInv();
    });
  }

  /* ==================================================== 建造列表 */
  function refreshBuildList() {
    el.buildGrid.innerHTML = DB.BUILD.map(b => {
      const locked = b.lock && !game.unlocked[b.lock];
      const cost = Object.keys(b.cost).map(k => DB.ico(k) + b.cost[k]).join(' ');
      return '<div class="bitem' + (locked ? ' locked' : '') + (b.id === self.buildId ? ' sel' : '') + '" data-id="' + b.id + '">' +
        '<div class="ico">' + b.ico + '</div><div class="nm">' + b.name + '</div><div class="cost">' + cost + '</div></div>';
    }).join('');
    el.buildGrid.querySelectorAll('.bitem').forEach(d => d.addEventListener('click', () => {
      const b = DB.BUILD_MAP[d.dataset.id];
      if (b.lock && !game.unlocked[b.lock]) {
        self.toast('🔒 需要研究：' + (DB.RESEARCH_MAP[b.lock] ? DB.RESEARCH_MAP[b.lock].name : b.lock), 'bad');
        RS.Audio.play('ui_deny'); return;
      }
      self.setBuild(d.dataset.id);
      self.closeAll(true);
      self.toast('🏗 ' + b.name + '：左键放置，B 退出建造', '');
    }));
  }

  /* ==================================================== 图鉴 */
  function refreshNotes() {
    el.notes.innerHTML = DB.NOTES.map(n => '<div class="note"><h4>' + n.t + '</h4><p>' + n.p + '</p></div>').join('') +
      '<div class="note"><h4>已解锁研究</h4><p>' + (Object.keys(game.unlocked).length
        ? Object.keys(game.unlocked).map(k => DB.RESEARCH_MAP[k] ? DB.RESEARCH_MAP[k].name : k).join('、')
        : '还没有任何研究成果。造一张研究台开始吧。') + '</p></div>';
  }

  /* ==================================================== 工作站 */
  this.openStation = function (o) {
    curStation = o;
    el.stTitle.textContent = DB.BUILD_MAP[o.id].name;
    renderStation(o);
    openPanel(el.panelStation);
  };
  this.openBed = function (o) { self.openStation(o); };

  function invCellHTML(id, n, extra) {
    if (!id) return '<div class="st-cell empty">' + (extra || '空') + '</div>';
    return '<div class="st-cell">' + DB.ico(id) + (n > 1 ? '<span class="cnt">' + n + '</span>' : '') + '</div>';
  }
  function addToGrill(o, id) {
    const it = DB.item(id);
    if (!it || !it.cookTo) return false;
    const i = o.data.slots.findIndex(x => !x);
    if (i < 0) { self.toast('烤架满了', 'bad'); return false; }
    if (game.inv.count(id) < 1) return false;
    game.inv.remove(id, 1);
    o.data.slots[i] = { id, out: it.cookTo, prog: 0, time: it.cookTime || 12, done: false };
    RS.Audio.play('place');
    return true;
  }
  function addSmelt(o, id) {
    const sm = DB.SMELT[id];
    if (!sm) return false;
    if (sm.lock && !game.unlocked[sm.lock]) { self.toast('需要研究才能熔炼', 'bad'); return false; }
    const i = o.data.slots.findIndex(x => !x);
    if (i < 0) { self.toast('烤架满了', 'bad'); return false; }
    game.inv.remove(id, 1);
    o.data.slots[i] = { id, out: sm.out, prog: 0, time: sm.time, done: false, n: sm.n };
    RS.Audio.play('place');
    return true;
  }
  function plantSeed(o, id) {
    const it = DB.item(id);
    if (!it || !it.seedOf) return;
    game.inv.remove(id, 1);
    o.data.seed = it.seedOf; o.data.t = 0; o.data.ready = false;
    game.raft.updateCropMesh(o);
    RS.Audio.play('place');
    self.toast('🌱 种下了 ' + DB.CROPS[it.seedOf].name, 'good');
  }

  function renderStation(o) {
    if (el.panelStation.classList.contains('hidden')) return;
    const d = o.data;
    let h = '';
    const st = o.station;
    if (st === 'purifier') {
      h += '<div class="st-row">' +
        invCellHTML(d.salt > 0 ? 'salt_water' : null, d.salt, '放入<br>咸水') +
        '<div class="st-arrow">➜</div>' +
        '<div class="st-prog water"><i style="width:' + ((d.prog / 12) * 100) + '%"></i></div>' +
        '<div class="st-arrow">➜</div>' +
        invCellHTML(d.out > 0 ? 'fresh_water' : null, d.out, '淡水') +
        '</div>';
      h += '<div class="st-fuel">🔥 燃料 <div class="fbar"><i style="width:' + U.clamp(d.burn / 22 * 100, 0, 100) + '%"></i></div>' +
        '<b>' + d.fuel + ' 份</b></div>';
      h += '<div class="st-row" style="margin-top:12px">' +
        '<button class="btn small" data-a="salt">＋ 咸水（' + game.inv.count('salt_water') + '）</button>' +
        '<button class="btn small" data-a="fuel">＋ 木板燃料（' + game.inv.count('plank') + '）</button>' +
        (d.out > 0 ? '<button class="btn small primary" data-a="take">取出淡水 ×' + d.out + '</button>' : '') +
        '</div>';
      h += '<div class="st-note">用杯子对着海面舀咸水，加入木板作燃料，每 12 秒蒸馏出一杯淡水。</div>';
    } else if (st === 'grill') {
      h += '<div class="st-grid">';
      for (let i = 0; i < 4; i++) {
        const s = d.slots[i];
        if (!s) h += '<div class="st-cell empty" data-slot="' + i + '">空位</div>';
        else h += '<div class="st-cell" data-slot="' + i + '" title="' + DB.name(s.out) + '">' + DB.ico(s.done ? s.out : s.id) +
          '<span class="cnt">' + (s.done ? '✔' : Math.round(s.prog / s.time * 100) + '%') + '</span></div>';
      }
      h += '</div>';
      h += '<div class="st-fuel">🔥 燃料 <div class="fbar"><i style="width:' + U.clamp(d.burn / 26 * 100, 0, 100) + '%"></i></div>' +
        '<b>' + d.fuel + ' 份</b><button class="btn small" data-a="fuel">＋ 木板（' + game.inv.count('plank') + '）</button></div>';
      const cook = [];
      game.inv.slots.forEach(s => { if (s && (DB.item(s.id).cookTo || DB.SMELT[s.id]) && cook.indexOf(s.id) < 0) cook.push(s.id); });
      h += '<div class="st-note">可加工的材料（点击放入）：</div><div class="st-grid">' +
        (cook.length ? cook.map(id => '<div class="st-cell" data-put="' + id + '">' + DB.ico(id) +
          '<span class="cnt">' + game.inv.count(id) + '</span></div>').join('') : '<div class="st-cell empty">背包里<br>没有生食</div>') + '</div>';
      h += '<div class="st-row" style="margin-top:10px"><button class="btn small primary" data-a="takeall">取出全部成品</button></div>';
      h += '<div class="st-note">烤架也能熔炼：沙子→玻璃，铜矿→铜锭，黏土→螺栓（需研究）。</div>';
    } else if (st === 'storage') {
      h += '<div class="st-note">储物箱（点击移动物品）</div><div class="st-grid">';
      d.items.forEach((s, i) => {
        h += s ? '<div class="st-cell" data-box="' + i + '">' + DB.ico(s.id) + '<span class="cnt">' + s.n + '</span></div>'
          : '<div class="st-cell empty" data-box="' + i + '">·</div>';
      });
      h += '</div><div class="st-note">背包</div><div class="st-grid">';
      game.inv.slots.forEach((s, i) => {
        if (!s) return;
        h += '<div class="st-cell" data-bag="' + i + '">' + DB.ico(s.id) + '<span class="cnt">' + s.n + '</span></div>';
      });
      h += '</div>';
    } else if (st === 'research') {
      h += '<div class="st-note">把材料交给研究台，解锁新的配方与建筑。</div><div class="research-list">';
      DB.RESEARCH.forEach(r => {
        const done = !!game.unlocked[r.id];
        const can = game.inv.canAfford(r.need);
        h += '<div class="rItem' + (done ? ' done' : '') + '" data-res="' + r.id + '">' +
          '<span class="ico">' + r.ico + '</span><b>' + r.name + '</b>' +
          '<div>' + Object.keys(r.need).map(k => {
            const ok = game.inv.count(k) >= r.need[k];
            return '<span class="rq ' + (ok ? 'ok' : 'no') + '">' + DB.ico(k) + r.need[k] + '</span>';
          }).join(' ') + '</div>' +
          '<div class="unlocks">' + (done ? '✔ 已完成' : (can ? '可研究' : '材料不足')) + '</div>' +
          '<div class="st-note" style="font-size:10.5px">' + r.desc + '</div></div>';
      });
      h += '</div>';
    } else if (st === 'crop') {
      const seeds = [];
      game.inv.slots.forEach(s => { if (s && DB.item(s.id).seedOf && seeds.indexOf(s.id) < 0) seeds.push(s.id); });
      if (!d.seed) {
        h += '<div class="st-note">选择要种下的作物：</div><div class="st-grid">' +
          (seeds.length ? seeds.map(id => '<div class="st-cell" data-seed="' + id + '">' + DB.ico(id) +
            '<span class="cnt">' + game.inv.count(id) + '</span></div>').join('') :
            '<div class="st-cell empty">没有可<br>种植物</div>') + '</div>';
      } else {
        const def = DB.CROPS[d.seed];
        h += '<div class="st-row">' + invCellHTML(d.seed === 'palm' ? 'coconut' : d.seed, 1) +
          '<div class="st-prog"><i style="width:' + U.clamp(d.t / def.grow * 100, 0, 100) + '%"></i></div></div>';
        h += '<div class="st-fuel">💧 水分 <div class="fbar"><i style="width:' + U.clamp(d.water * 100 / 3, 0, 100) + '%"></i></div></div>';
        h += '<div class="st-row" style="margin-top:12px">' +
          '<button class="btn small" data-a="water">浇水（需要水）</button>' +
          (d.ready ? '<button class="btn small primary" data-a="harvest">收获</button>' : '') +
          '<button class="btn small" data-a="uproot">拔掉</button></div>';
        h += '<div class="st-note">' + def.name + '：浇过水会长得快 4 倍。成熟后可反复收获。</div>';
      }
    } else if (st === 'collector') {
      h += '<div class="st-row">' + invCellHTML(d.water > 0 ? 'fresh_water' : null, d.water, '空') +
        '<div class="st-prog water"><i style="width:' + (d.water / d.max * 100) + '%"></i></div></div>';
      h += '<div class="st-row"><button class="btn small primary" data-a="takewater"' + (d.water ? '' : ' disabled') + '>取出淡水 ×' + d.water + '</button></div>';
      h += '<div class="st-note">下雨时自动积水（当前天气：' + game.world.weather + '）。</div>';
    } else if (st === 'bed') {
      h += '<div class="st-note">躺下休息到清晨，或把这里设为重生点。</div>' +
        '<div class="st-row" style="margin-top:14px">' +
        '<button class="btn small primary" data-a="sleep">😴 睡到天亮</button>' +
        '<button class="btn small" data-a="spawn">📍 设为重生点</button></div>' +
        '<div class="st-note">' + (game.spawnBed === o ? '✔ 这里已是你的重生点' : '') + '</div>';
    }
    if (el.stBody.dataset.h !== h) { el.stBody.innerHTML = h; el.stBody.dataset.h = h; bindStation(o); }
  }
  function bindStation(o) {
    const d = o.data;
    el.stBody.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.a;
      RS.Audio.play('ui_click');
      if (a === 'salt') { const n = Math.min(game.inv.count('salt_water'), 4 - d.salt); if (n > 0) { game.inv.remove('salt_water', n); d.salt += n; } else self.toast('没有咸水，或槽位已满', 'bad'); }
      if (a === 'fuel') { const n = Math.min(game.inv.count('plank'), 6 - d.fuel); if (n > 0) { game.inv.remove('plank', n); d.fuel += n; } else self.toast('没有木板，或燃料已满', 'bad'); }
      if (a === 'take') { const n = game.inv.add('fresh_water', d.out); d.out -= n; }
      if (a === 'takeall') {
        let got = 0;
        d.slots.forEach((s, i) => { if (s && s.done) { game.inv.add(s.out, s.n || 1); d.slots[i] = null; got++; } });
        if (!got) self.toast('还没有做好的东西', ''); else RS.Audio.play('pickup');
      }
      if (a === 'water') {
        if (game.inv.count('fresh_water') > 0) { game.inv.remove('fresh_water', 1); d.water += 3; }
        else if (game.inv.count('salt_water') > 0) { game.inv.remove('salt_water', 1); d.water += 1.2; self.toast('咸水浇灌效果较差', ''); }
        else self.toast('需要一杯水', 'bad');
      }
      if (a === 'harvest') {
        const def = DB.CROPS[d.seed];
        for (const k in def.yield) game.inv.add(k, def.yield[k]);
        d.t = def.grow * .25; d.ready = false;
        game.raft.updateCropMesh(o);
        RS.Audio.play('pickup');
      }
      if (a === 'uproot') { d.seed = null; d.t = 0; d.ready = false; game.raft.updateCropMesh(o); }
      if (a === 'takewater') { const n = game.inv.add('fresh_water', d.water); d.water -= n; }
      if (a === 'sleep') { game.sleep(o); self.closeAll(true); }
      if (a === 'spawn') { game.spawnBed = o; self.toast('📍 重生点已设置', 'good'); }
      el.stBody.dataset.h = ''; renderStation(o); refreshInv();
    }));
    el.stBody.querySelectorAll('[data-put]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.put;
      if (DB.item(id).cookTo) addToGrill(o, id); else addSmelt(o, id);
      el.stBody.dataset.h = ''; renderStation(o); refreshInv();
    }));
    el.stBody.querySelectorAll('[data-slot]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.slot, s = d.slots[i];
      if (s && s.done) { game.inv.add(s.out, s.n || 1); d.slots[i] = null; RS.Audio.play('pickup'); }
      else if (s) { game.inv.add(s.id, 1); d.slots[i] = null; }
      el.stBody.dataset.h = ''; renderStation(o); refreshInv();
    }));
    el.stBody.querySelectorAll('[data-seed]').forEach(b => b.addEventListener('click', () => {
      plantSeed(o, b.dataset.seed);
      el.stBody.dataset.h = ''; renderStation(o); refreshInv();
    }));
    el.stBody.querySelectorAll('[data-res]').forEach(b => b.addEventListener('click', () => {
      const r = DB.RESEARCH_MAP[b.dataset.res];
      if (game.unlocked[r.id]) return;
      if (!game.inv.canAfford(r.need)) { self.toast('材料不足', 'bad'); RS.Audio.play('ui_deny'); return; }
      game.inv.pay(r.need);
      game.unlocked[r.id] = true;
      RS.Audio.play('unlock');
      self.toast('🔬 解锁研究：' + r.name, 'good');
      game.bus.emit('research');
      el.stBody.dataset.h = ''; renderStation(o); refreshInv();
    }));
    el.stBody.querySelectorAll('[data-box]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.box, s = d.items[i];
      if (!s) return;
      const n = game.inv.add(s.id, s.n);
      s.n -= n; if (s.n <= 0) d.items[i] = null;
      el.stBody.dataset.h = ''; renderStation(o); refreshInv();
      RS.Audio.play('ui_hover');
    }));
    el.stBody.querySelectorAll('[data-bag]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.bag, s = game.inv.slots[i];
      if (!s) return;
      let left = s.n;
      const max = DB.item(s.id).stack || 1;
      for (let k = 0; k < d.items.length && left > 0; k++) {
        const t = d.items[k];
        if (t && t.id === s.id && t.n < max) { const put = Math.min(max - t.n, left); t.n += put; left -= put; }
      }
      for (let k = 0; k < d.items.length && left > 0; k++) {
        if (!d.items[k]) { const put = Math.min(max, left); d.items[k] = { id: s.id, n: put }; left -= put; }
      }
      if (left === s.n) { self.toast('储物箱满了', 'bad'); return; }
      game.inv.remove(s.id, s.n - left);
      el.stBody.dataset.h = ''; renderStation(o); refreshInv();
      RS.Audio.play('ui_hover');
    }));
  }

  /* ==================================================== 钓鱼面板 */
  this.updateFishing = function (rod) {
    if (!rod || rod.state === 'idle') { el.fishing.classList.add('hidden'); return; }
    el.fishing.classList.remove('hidden');
    if (rod.state === 'fight') {
      el.fSafe.style.left = ((rod.safe - .13) * 100) + '%';
      el.fSafe.style.width = '26%';
      el.fMark.style.left = (rod.tension * 100) + '%';
      el.fTens.style.width = (rod.prog * 100) + '%';
      el.fHint.innerHTML = '按住 <b>左键</b> 收线，让指针停在绿区 —— 张力冲到最右会断线';
    } else {
      el.fSafe.style.left = '37%'; el.fSafe.style.width = '26%';
      el.fMark.style.left = '0%'; el.fTens.style.width = '0%';
      el.fHint.innerHTML = rod.state === 'bite' ? '<b>咬钩了！立刻点击左键</b>' :
        rod.state === 'wait' ? '静静等待…（鱼群多的地方咬钩更快）' : '抛竿中…';
    }
  };

  /* ==================================================== 面板开关 */
  this.openInv = function (tab) {
    selSlot = -1;
    refreshInv(); refreshCraft(); refreshBuildList(); refreshNotes();
    switchTab(tab || 'inv');
    openPanel(el.panelInv);
  };
  function switchTab(t) {
    $$('#panel-inv .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    $$('#panel-inv .page').forEach(p => p.classList.toggle('active', p.dataset.page === t));
  }
  $$('#panel-inv .tab').forEach(b => b.addEventListener('click', () => { switchTab(b.dataset.tab); RS.Audio.play('ui_hover'); }));
  $$('[data-close]').forEach(b => b.addEventListener('click', () => self.closeAll()));

  /* 装备卡改为状态卡 */
  (function () {
    const card = document.querySelector('.equip-card');
    if (card) card.innerHTML = '<div class="eq-title">状态</div><div id="status-card" class="st-note"></div>';
  })();
  this.refreshStatus = function () {
    const c = document.getElementById('status-card');
    if (!c) return;
    const p = game.player, W = game.world;
    const eff = [];
    if (p.effects.poison > 0) eff.push('🤢 中毒');
    if (p.effects.bleed > 0) eff.push('🩸 流血');
    if (p.inWater) eff.push('💧 在水中');
    if (W.weather === 'storm') eff.push('⛈ 暴风雨');
    c.innerHTML = '第 ' + W.day + ' 天 ' + U.fmtTime(W.timeOfDay) + '<br>' +
      '地基 ' + game.raft.countFoundations() + ' 块 · 航速 ' + (game.raft.vel.length() * 1.94).toFixed(1) + ' kn<br>' +
      '钓到 ' + p.stats.caught + ' 条鱼 · 击退鲨鱼 ' + p.stats.sharkRepel + ' 次<br>' +
      (eff.length ? '状态：' + eff.join('、') : '状态正常');
  };

  /* ==================================================== 暂停 / 死亡 */
  this.showPause = function (on) {
    el.panelPause.classList.toggle('hidden', !on);
    if (on) {
      const p = game.player;
      el.pauseStats.innerHTML =
        '<div>存活天数 <b>' + game.world.day + '</b></div>' +
        '<div>地基数量 <b>' + game.raft.countFoundations() + '</b></div>' +
        '<div>钓到的鱼 <b>' + p.stats.caught + '</b></div>' +
        '<div>击退鲨鱼 <b>' + p.stats.sharkRepel + '</b></div>' +
        '<div>已解锁研究 <b>' + Object.keys(game.unlocked).length + '/' + DB.RESEARCH.length + '</b></div>' +
        '<div>完成目标 <b>' + game.quests.filter(q => q.done).length + '/' + game.quests.length + '</b></div>';
    }
  };
  this.showDeath = function (why) {
    el.deadDesc.textContent = '死因：' + (why || deathCause);
    const p = game.player;
    el.deadStats.innerHTML =
      '<div>存活天数 <b>' + game.world.day + '</b></div>' +
      '<div>地基数量 <b>' + game.raft.countFoundations() + '</b></div>' +
      '<div>钓到的鱼 <b>' + p.stats.caught + '</b></div>' +
      '<div>击退鲨鱼 <b>' + p.stats.sharkRepel + '</b></div>';
    el.panelDead.classList.remove('hidden');
  };
  this.hideDeath = function () { el.panelDead.classList.add('hidden'); };

  /* ==================================================== 键盘面板控制 */
  window.addEventListener('keydown', e => {
    if (game.state !== 'play') return;
    const k = e.code;
    if (k === 'Escape') {
      if (anyPanel()) { if (!el.panelDead.classList.contains('hidden')) return; self.closeAll(); }
      else game.pause(!game.paused);
      return;
    }
    if (!el.panelDead.classList.contains('hidden')) return;
    if (k === 'Tab' || k === 'KeyI') { e.preventDefault(); anyPanel() ? self.closeAll() : self.openInv('inv'); }
    if (k === 'KeyC') { anyPanel() ? self.closeAll() : self.openInv('craft'); }
    if (k === 'KeyB') {
      if (anyPanel()) { self.closeAll(true); }
      self.toggleBuild();
    }
    if (k === 'KeyR' && self.buildMode) self.rotateBuild();
    if (k === 'F5') { e.preventDefault(); game.save(); }
  });
  window.addEventListener('wheel', e => {
    if (self.buildMode && !anyPanel()) self.cycleBuild(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  /* 背包变化时刷新 */
  game.bus.on('inv', () => {
    refreshHotbar();
    if (!el.panelInv.classList.contains('hidden')) { refreshInv(); refreshCraft(); }
    if (self.buildMode) updateBuildBar();
  });
  game.bus.on('research', () => { refreshBuildList(); refreshCraft(); refreshNotes(); });

  /* ==================================================== 载入进度 */
  const TIPS = [
    '别喝海水。你会更渴，而且会掉血。',
    '布鲁斯每隔一会儿就会来啃地基 —— 用矛捅它两三下就能赶走。',
    '收集网能自动捞走从前方漂来的物资，非常省事。',
    '把材料放进研究台，能解锁钉子、螺栓、锚和二层地板。',
    '椰子和西瓜同时提供饱腹与水分，是长途航行的好补给。',
    '潜水前看一眼氧气条；离水面越远，回去的路越长。',
    '暴风雨里浪会变大，木筏晃得厉害，但集水器会装满淡水。',
    '升起帆之后记得造舵轮，否则你只能随风漂。'
  ];
  this.setLoading = function (pct, text) {
    el.lfill.style.width = U.clamp(pct, 0, 100) + '%';
    if (text) el.ltext.textContent = text;
  };
  el.ltip.textContent = '提示：' + U.choice(TIPS);
  this.hideLoader = function () {
    el.loader.classList.add('out');
    setTimeout(() => el.loader.classList.add('hidden'), 800);
  };
  this.showMenu = function (on) { el.menu.classList.toggle('hidden', !on); };
  this.showHud = function (on) { el.hud.classList.toggle('hidden', !on); };
};
