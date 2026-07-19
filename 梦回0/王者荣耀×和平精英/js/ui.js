/* ================================================================
   荣耀精英 — HUD 交互（小地图 / 商店 / 技能盘 / 播报 / 浮动文字）
   ================================================================ */
HE.UI = (function () {
  const U = {};
  const $ = id => document.getElementById(id);
  const G = () => HE.Game.G;
  let hero = null, camera = null;
  let els = {};
  let mmBg = null;             // 小地图底图
  let bannerQueue = [], bannerT = 0;
  let towerWarnCd = 0, soundOn = true;
  const unitBars = new Map();  // unit.id -> element

  /* ---------------- 初始化 ---------------- */
  U.init = function (playerHero, cam) {
    hero = playerHero; camera = cam;
    els = {
      killsBlue: $('kills-blue'), killsRed: $('kills-red'),
      towerBlue: $('tb-tower-blue'), towerRed: $('tb-tower-red'),
      time: $('game-time'), teamGold: $('team-gold'),
      kda: $('hud-kda'), cs: $('hud-cs'), gold: $('hud-gold'),
      barHp: $('bar-hp'), barMp: $('bar-mp'), txtHp: $('txt-hp'),
      level: $('hp-level'), face: $('hp-face'),
      buffRow: $('buff-row'),
      banner: $('banner'), subBanner: $('sub-banner'),
      killfeed: $('killfeed'),
      minimap: $('minimap'),
      floatLayer: $('float-layer'), ubarLayer: $('unitbar-layer'),
      dmgVig: $('dmg-vignette'), lowVig: $('lowhp-vignette'),
      death: $('death-overlay'), deathCount: $('death-count'),
      recall: $('recall-cast'), recallFill: $('rc-fill'),
      inventory: $('inventory'), shopPanel: $('shop-panel'),
      shopGrid: $('shop-grid'), shopGold: $('shop-gold-num'), shopTip: $('shop-tip'),
      qb1: $('qb-item1'), qb2: $('qb-item2'),
      statsPanel: $('stats-panel'), spBlue: $('sp-blue'), spRed: $('sp-red'),
      zoneWarn: $('zone-warning'),
      skillBtns: [...document.querySelectorAll('.skill-btn')],
      flashBtn: $('btn-flash'), healBtn: $('btn-heal'), recallBtn: $('btn-recall'),
    };
    els.face.textContent = hero.heroDef.face;
    // 技能图标
    els.skillBtns.forEach((b, i) => { b.querySelector('i').textContent = hero.heroDef.skills[i].icon; });
    // 装备栏 6 格
    els.inventory.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('div');
      d.className = 'inv-slot';
      d.addEventListener('contextmenu', e => { e.preventDefault(); sellItem(i); });
      els.inventory.appendChild(d);
    }
    buildShop();
    buildMinimapBg();
    unitBars.forEach(el => el.remove());
    unitBars.clear();
    // 控件
    $('btn-shop').onclick = () => U.toggleShop();
    $('shop-close').onclick = () => U.toggleShop(false);
    $('btn-sound').onclick = () => U.toggleSound();
    $('btn-stats').onclick = () => U.showStats(els.statsPanel.classList.contains('hidden'));
    $('sp-close').onclick = () => U.showStats(false);
    els.qb1.onclick = () => quickBuy(0);
    els.qb2.onclick = () => quickBuy(1);
    bannerQueue = []; bannerT = 0;
    els.killfeed.innerHTML = '';
  };

  /* ---------------- 商店 ---------------- */
  function buildShop() {
    els.shopGrid.innerHTML = '';
    HE.ITEMS.forEach(item => {
      const d = document.createElement('div');
      d.className = 'shop-item';
      d.innerHTML = `<span class="si-ico">${item.icon}</span>
        <div class="si-meta"><b>${item.name}</b><em>${item.desc}</em><span class="si-price">◈ ${item.price}</span></div>`;
      d.onmouseenter = () => els.shopTip.textContent = `${item.name} — ${item.desc}`;
      d.onclick = () => {
        if (hero.buyItem(item)) { refreshShop(); U.refreshInventory(); }
        else HE.Audio.sfx('ui_click', { vol: 0.5 });
      };
      d.dataset.id = item.id;
      els.shopGrid.appendChild(d);
    });
  }
  function refreshShop() {
    els.shopGold.textContent = Math.floor(hero.gold);
    [...els.shopGrid.children].forEach(d => {
      const item = HE.ITEMS.find(i => i.id === d.dataset.id);
      d.classList.toggle('owned', hero.items.some(i => i.id === item.id));
      d.classList.toggle('cant', hero.gold < item.price);
    });
  }
  function sellItem(idx) {
    const it = hero.items[idx];
    if (!it) return;
    hero.items.splice(idx, 1);
    hero.gold += Math.floor(it.price * 0.6);
    hero.computeStats();
    HE.Audio.sfx('coin');
    U.refreshInventory(); refreshShop();
  }
  U.refreshInventory = function () {
    [...els.inventory.children].forEach((slot, i) => {
      const it = hero.items[i];
      slot.className = 'inv-slot' + (it ? ' filled' : '');
      slot.textContent = it ? it.icon : '';
      slot.title = it ? `${it.name}（右键出售）` : '';
    });
  };
  function nextBuildItems() {
    const owned = hero.items.map(i => i.id);
    const rest = hero.heroDef.build.filter(id => !owned.includes(id));
    return rest.slice(0, 2).map(id => HE.ITEMS.find(i => i.id === id));
  }
  function quickBuy(n) {
    const items = nextBuildItems();
    if (items[n] && hero.buyItem(items[n])) { U.refreshInventory(); refreshShop(); }
  }
  U.toggleShop = function (force) {
    const show = force !== undefined ? force : els.shopPanel.classList.contains('hidden');
    els.shopPanel.classList.toggle('hidden', !show);
    if (show) refreshShop();
    HE.Audio.sfx('ui_click');
  };

  /* ---------------- 小地图 ---------------- */
  // 与屏幕视角一致：小地图上方 = 世界+x，右方 = 世界+z（蓝方基地左下）
  function w2m(x, z, S) { return [(z + 100) / 200 * S, (1 - (x + 100) / 200) * S]; }
  function buildMinimapBg() {
    mmBg = document.createElement('canvas');
    mmBg.width = mmBg.height = 220;
    const g = mmBg.getContext('2d');
    const S = 220;
    g.fillStyle = '#131a14'; g.fillRect(0, 0, S, S);
    // 河道
    g.save(); g.translate(S / 2, S / 2); g.rotate(Math.PI / 4);
    g.fillStyle = 'rgba(90,140,150,.55)'; g.fillRect(-S, -7, S * 2, 14);
    g.restore();
    // 三路
    g.strokeStyle = 'rgba(160,145,100,.7)'; g.lineWidth = 6; g.lineCap = 'round';
    Object.values(HE.LANES).forEach(pts => {
      g.beginPath();
      pts.forEach((p, i) => { const [x, y] = w2m(p.x, p.z, S); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
    });
    // 基地
    [[HE.CFG.BLUE_BASE, '#3da9fc'], [HE.CFG.RED_BASE, '#ff5c5c']].forEach(([b, c]) => {
      const [x, y] = w2m(b.x, b.z, S);
      g.fillStyle = c; g.globalAlpha = 0.5;
      g.fillRect(x - 9, y - 9, 18, 18);
      g.globalAlpha = 1;
    });
  }
  function drawMinimap() {
    const cv = els.minimap, g = cv.getContext('2d'), S = 220;
    g.clearRect(0, 0, S, S);
    g.drawImage(mmBg, 0, 0);
    const Gm = G();
    // 信号圈
    if (Gm.zone && Gm.zone.active) {
      const [zx, zy] = w2m(Gm.zone.x, Gm.zone.z, S);
      g.strokeStyle = 'rgba(126,200,255,.9)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(zx, zy, Gm.zone.r / 200 * S, 0, 7); g.stroke();
    }
    for (const u of Gm.units) {
      if (!u.alive) continue;
      const [x, y] = w2m(u.x, u.z, S);
      if (u.kind === 'tower') {
        g.fillStyle = u.team === 'blue' ? '#3da9fc' : '#ff5c5c';
        g.fillRect(x - 3, y - 3, 6, 6);
      } else if (u.kind === 'crystal') {
        g.fillStyle = u.team === 'blue' ? '#9fd0ff' : '#ffb3a3';
        g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
      } else if (u.kind === 'minion') {
        g.fillStyle = u.team === 'blue' ? 'rgba(120,180,240,.8)' : 'rgba(240,140,120,.8)';
        g.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      } else if (u.kind === 'monster') {
        g.fillStyle = '#c9a35a';
        g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
      } else if (u.kind === 'airdrop') {
        const blink = Math.sin(Gm.time * 6) > 0;
        g.fillStyle = blink ? '#f5c542' : '#a3842a';
        g.fillRect(x - 4, y - 4, 8, 8);
        g.strokeStyle = '#fff'; g.strokeRect(x - 4, y - 4, 8, 8);
      }
    }
    for (const h of Gm.heroes) {
      if (!h.alive) continue;
      const [x, y] = w2m(h.x, h.z, S);
      if (h.isPlayer) {
        g.fillStyle = '#fff';
        g.save(); g.translate(x, y); g.rotate(Math.PI / 2 - h.facing);
        g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
        g.restore();
        g.strokeStyle = '#f5c542'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, 7, 0, 7); g.stroke();
      } else {
        g.fillStyle = h.team === Gm.playerTeam ? '#4fc3ff' : '#ff6a5a';
        g.beginPath(); g.arc(x, y, 3.6, 0, 7); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.stroke();
      }
    }
  }

  /* ---------------- 浮动文字 / 屏幕反馈 ---------------- */
  function project(pos, yOff = 0) {
    const v = new THREE.Vector3(pos.x, (pos.y || 0) + yOff, pos.z).project(camera);
    if (v.z > 1) return null;
    return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
  }
  U.floatText = function (pos, text, cls) {
    const p = project(pos, 2.8);
    if (!p) return;
    const d = document.createElement('div');
    d.className = `float-txt ${cls}`;
    d.textContent = text;
    d.style.left = p[0] + (Math.random() - 0.5) * 30 + 'px';
    d.style.top = p[1] + 'px';
    els.floatLayer.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  };
  U.floatDmg = function (unit, dmg, isCrit, taken) {
    if (dmg < 1) return;
    U.floatText(unit.pos, (taken ? '-' : '') + Math.round(dmg), taken ? 'float-dmg' : isCrit ? 'float-crit' : 'float-dmg');
  };
  U.damageFlash = function () {
    els.dmgVig.style.opacity = 0.9;
    setTimeout(() => els.dmgVig.style.opacity = 0, 130);
  };
  U.towerWarn = function () {
    if (towerWarnCd > 0) return;
    towerWarnCd = 4;
    U.subBanner('⚠ 防御塔正在攻击你，快撤离！', 1600);
  };
  U.notEnoughMana = function () {
    els.barMp.parentElement.style.boxShadow = '0 0 10px #4aa3ff';
    setTimeout(() => els.barMp.parentElement.style.boxShadow = '', 300);
    HE.Audio.sfx('ui_click', { vol: 0.4 });
  };
  U.skillUpFlash = function (i) {
    const b = els.skillBtns && els.skillBtns[i];
    if (!b) return;
    b.classList.add('ready-flash');
    setTimeout(() => b.classList.remove('ready-flash'), 520);
  };

  /* ---------------- 横幅 / 击杀信息 ---------------- */
  U.banner = function (text, cls = '', dur = 1800) {
    bannerQueue.push({ text, cls, dur });
  };
  U.subBanner = function (text, dur = 2200) {
    els.subBanner.textContent = text;
    els.subBanner.classList.remove('hidden');
    clearTimeout(els.subBanner._t);
    els.subBanner._t = setTimeout(() => els.subBanner.classList.add('hidden'), dur);
  };
  function tickBanner(dt) {
    if (bannerT > 0) {
      bannerT -= dt * 1000;
      if (bannerT <= 0) els.banner.classList.add('hidden');
      return;
    }
    const b = bannerQueue.shift();
    if (!b) return;
    els.banner.textContent = b.text;
    els.banner.className = `banner ${b.cls}`;
    bannerT = b.dur;
  }
  U.killfeed = function (killerName, killerTeam, victimName, victimTeam) {
    const d = document.createElement('div');
    d.className = 'kf-item';
    d.innerHTML = `<span class="${killerTeam === G().playerTeam ? 'k-blue' : 'k-red'}">${killerName}</span>
      <span class="k-x">⚔</span>
      <span class="${victimTeam === G().playerTeam ? 'k-blue' : 'k-red'}">${victimName}</span>`;
    els.killfeed.prepend(d);
    while (els.killfeed.children.length > 5) els.killfeed.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  };
  U.killfeedText = function (text) {
    const d = document.createElement('div');
    d.className = 'kf-item';
    d.innerHTML = `<span style="color:#f5c542">${text}</span>`;
    els.killfeed.prepend(d);
    while (els.killfeed.children.length > 5) els.killfeed.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  };

  /* ---------------- 回城读条 ---------------- */
  U.showRecall = function (pct) {
    els.recall.classList.remove('hidden');
    els.recallFill.style.width = Math.min(100, pct * 100) + '%';
  };
  U.hideRecall = function () { els.recall.classList.add('hidden'); };

  /* ---------------- 单位血条 ---------------- */
  function updateUnitBars() {
    const Gm = G();
    const seen = new Set();
    for (const u of Gm.units) {
      if (!u.alive || u.isPlayer || u.kind === 'airdrop') continue;
      const yOff = u.kind === 'tower' ? 9.6 : u.kind === 'crystal' ? 6 : u.isHero ? 3.4 : (u.kind === 'monster' ? 3 * (u.radius > 2 ? 1.6 : 1) : 2.2);
      const p = project(u.pos, yOff);
      if (!p || p[0] < -50 || p[0] > innerWidth + 50 || p[1] < -20 || p[1] > innerHeight + 20) {
        const el = unitBars.get(u.id);
        if (el) el.style.display = 'none';
        continue;
      }
      seen.add(u.id);
      let el = unitBars.get(u.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'ubar' + (u.isHero ? ' hero' : '');
        el.innerHTML = (u.isHero ? `<span class="uname"></span><span class="ulv"></span>` : '') + '<i></i>';
        els.ubarLayer.appendChild(el);
        unitBars.set(u.id, el);
      }
      el.style.display = 'block';
      const enemy = u.team !== Gm.playerTeam && u.team !== 'neutral';
      el.classList.toggle('enemy', enemy || u.team === 'neutral');
      el.style.left = p[0] + 'px';
      el.style.top = p[1] + 'px';
      el.querySelector('i').style.width = (u.hp / u.maxHp * 100) + '%';
      if (u.isHero) {
        el.querySelector('.uname').textContent = u.name;
        el.querySelector('.ulv').textContent = u.level;
      }
    }
    unitBars.forEach((el, id) => {
      const u = G().units.find(x => x.id === id);
      if (!u || !u.alive) { el.remove(); unitBars.delete(id); }
    });
  }

  /* ---------------- 战绩面板 ---------------- */
  U.showStats = function (show) {
    els.statsPanel.classList.toggle('hidden', !show);
    if (show) refreshStats();
  };
  function refreshStats() {
    const Gm = G();
    const mk = (team, tbl) => {
      let html = `<tr><th>玩家</th><th>英雄</th><th>K/D/A</th><th>补刀</th><th>经济</th></tr>`;
      Gm.heroes.filter(h => h.team === team).forEach(h => {
        html += `<tr class="${h.isPlayer ? 'me' : ''}">
          <td class="n">${h.name}</td><td class="n">${h.heroDef.name}</td>
          <td>${h.kda.k}/${h.kda.d}/${h.kda.a}</td><td>${h.cs}</td><td>${Math.floor(h.gold + h.goldSpent || h.gold)}</td></tr>`;
      });
      tbl.innerHTML = html;
    };
    mk(Gm.playerTeam, els.spBlue);
    mk(Gm.playerTeam === 'blue' ? 'red' : 'blue', els.spRed);
  }

  /* ---------------- 声音开关 ---------------- */
  U.toggleSound = function () {
    soundOn = !soundOn;
    HE.Audio.setMuted(!soundOn);
    $('btn-sound').textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) HE.Audio.sfx('ui_click');
  };

  /* ---------------- 信号圈警告 ---------------- */
  U.zoneWarning = function (show) { els.zoneWarn.classList.toggle('hidden', !show); };

  /* ---------------- 主刷新 ---------------- */
  const BUFF_LABEL = { red: ['灼', 'red'], blue: ['蓝', 'blue'], awm: ['狙', ''], suit3: ['甲', ''], ammo: ['弹', ''], adrenaline: ['速', 'blue'], overlord: ['宰', 'red'], rapidfire: ['射', ''] };
  U.update = function (dt) {
    const Gm = G();
    if (towerWarnCd > 0) towerWarnCd -= dt;
    tickBanner(dt);
    // 顶栏
    els.killsBlue.textContent = Gm.kills[Gm.playerTeam];
    els.killsRed.textContent = Gm.kills[Gm.playerTeam === 'blue' ? 'red' : 'blue'];
    els.towerBlue.textContent = Gm.units.filter(u => u.kind === 'tower' && u.alive && u.team === Gm.playerTeam).length;
    els.towerRed.textContent = Gm.units.filter(u => u.kind === 'tower' && u.alive && u.team !== Gm.playerTeam).length;
    const t = Math.max(0, Math.floor(Gm.time));
    els.time.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    const teamGold = Gm.heroes.filter(h => h.team === Gm.playerTeam).reduce((s, h) => s + h.gold, 0);
    els.teamGold.textContent = '◈ ' + Math.floor(teamGold);
    // 英雄面板
    els.kda.textContent = `${hero.kda.k}/${hero.kda.d}/${hero.kda.a}`;
    els.cs.textContent = `补刀 ${hero.cs}`;
    els.gold.textContent = Math.floor(hero.gold);
    els.level.textContent = hero.level;
    els.barHp.style.width = (hero.hp / hero.maxHp * 100) + '%';
    els.barMp.style.width = (hero.mp / hero.maxMp * 100) + '%';
    els.txtHp.textContent = `${Math.ceil(hero.hp)} / ${Math.ceil(hero.maxHp)}`;
    els.lowVig.classList.toggle('on', hero.alive && hero.hp / hero.maxHp < 0.25);
    // buff 图标
    let buffHtml = '';
    for (const k in hero.buffs) {
      const conf = BUFF_LABEL[k];
      if (!conf) continue;
      buffHtml += `<span class="buff-ico ${conf[1]}" title="${k}">${conf[0]}</span>`;
    }
    els.buffRow.innerHTML = buffHtml;
    // 技能冷却
    hero.heroDef.skills.forEach((conf, i) => {
      const sk = hero.skills[i];
      const btn = els.skillBtns[i];
      const mask = btn.querySelector('.cd-mask');
      const num = btn.querySelector('.cd-num');
      const lvEl = btn.querySelector('.sk-lv');
      lvEl.textContent = '●'.repeat(sk.lv);
      if (sk.lv === 0) { mask.style.setProperty('--cd', '100%'); num.textContent = ''; btn.style.opacity = 0.55; return; }
      btn.style.opacity = 1;
      if (sk.cd > 0) {
        mask.style.setProperty('--cd', (sk.cd / (conf.cd * (1 - (hero.cdr || 0))) * 100) + '%');
        num.textContent = Math.ceil(sk.cd);
      } else {
        mask.style.setProperty('--cd', '0%'); num.textContent = '';
      }
      btn.classList.toggle('no-mp', hero.mp < conf.mana);
    });
    const setCd = (btn, cd, total) => {
      const mask = btn.querySelector('.cd-mask'), num = btn.querySelector('.cd-num');
      if (cd > 0) { mask.style.setProperty('--cd', (cd / total * 100) + '%'); if (num) num.textContent = Math.ceil(cd); }
      else { mask.style.setProperty('--cd', '0%'); if (num) num.textContent = ''; }
    };
    setCd(els.flashBtn, hero.flashCd, HE.CFG.FLASH_CD);
    setCd(els.healBtn, hero.healCd, HE.CFG.HEAL_CD);
    setCd(els.recallBtn, 0, 1);
    // 快捷购买
    const nx = nextBuildItems();
    [els.qb1, els.qb2].forEach((b, i) => {
      const it = nx[i];
      if (!it) { b.innerHTML = '<i>—</i>'; b.disabled = true; return; }
      b.disabled = false;
      b.classList.toggle('cant', hero.gold < it.price);
      b.innerHTML = `<i>${it.icon}</i><em>${it.price}</em>`;
      b.title = `${it.name}：${it.desc}`;
    });
    // 死亡倒计时
    if (!hero.alive) {
      els.death.classList.remove('hidden');
      els.deathCount.textContent = Math.ceil(hero.respawnT);
    } else els.death.classList.add('hidden');
    // 商店经济实时
    if (!els.shopPanel.classList.contains('hidden')) refreshShop();
    if (!els.statsPanel.classList.contains('hidden')) refreshStats();
    drawMinimap();
    updateUnitBars();
  };

  U.cleanup = function () {
    unitBars.forEach(el => el.remove());
    unitBars.clear();
    els.floatLayer && (els.floatLayer.innerHTML = '');
  };

  return U;
})();
