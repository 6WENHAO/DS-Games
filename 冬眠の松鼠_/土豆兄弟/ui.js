// ===================== UI 界面 =====================
"use strict";

const UI = {
  el(id) { return document.getElementById(id); },
  show(id) { this.el(id).classList.remove("hidden"); },
  hide(id) { this.el(id).classList.add("hidden"); },
  hideAll() {
    ["mainMenu","charSelect","weaponSelect","levelupPanel","cratePanel","shopPanel","pausePanel","endPanel","statsFloat"]
      .forEach(id => this.hide(id));
    this.show("hudBar");
  },

  selectedChar: null,

  init() {
    this.el("btnStart").onclick = () => { this.hide("mainMenu"); this.renderCharSelect(); };
    this.el("btnBackToMenu").onclick = () => { this.hide("charSelect"); this.show("mainMenu"); };
    this.el("btnBackToChar").onclick = () => { this.hide("weaponSelect"); this.renderCharSelect(); };
    this.el("btnResume").onclick = () => togglePause();
    this.el("btnQuit").onclick = () => location.reload();
    this.el("btnEndRestart").onclick = () => location.reload();
    this.el("btnNextWave").onclick = () => {
      this.hide("shopPanel");
      startWave(game.wave + 1);
    };
    this.el("btnReroll").onclick = () => this.reroll();
    this.show("mainMenu");
    this.hide("hudBar");
  },

  toast(msg) {
    const t = this.el("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add("hidden"), 1500);
  },

  // ---------- 角色选择 ----------
  renderCharSelect() {
    this.show("charSelect");
    const box = this.el("charGrid");
    box.innerHTML = "";
    for (const c of CHARACTERS) {
      const d = document.createElement("div");
      d.className = "card charCard";
      d.innerHTML = `<div class="cardEmoji">${c.emoji}</div>
        <div class="cardName">${c.name}</div>
        <div class="cardDesc">${c.desc}</div>`;
      d.onclick = () => { this.selectedChar = c; this.hide("charSelect"); this.renderWeaponSelect(); };
      box.appendChild(d);
    }
  },

  // ---------- 起始武器选择 ----------
  renderWeaponSelect() {
    this.show("weaponSelect");
    const box = this.el("weaponGrid");
    box.innerHTML = "";
    this.el("weaponSelectTitle").textContent = `${this.selectedChar.emoji} ${this.selectedChar.name} —— 选择起始武器`;
    for (const wid of this.selectedChar.startWeapons) {
      const w = WEAPON_BY_ID[wid];
      const t = w.tiers[0];
      const d = document.createElement("div");
      d.className = "card charCard";
      d.innerHTML = `<div class="cardEmoji">${w.emoji}</div>
        <div class="cardName">${w.name} <span class="tag">${w.type === "melee" ? "近战" : "远程"} · ${w.cls}</span></div>
        <div class="cardDesc">伤害 ${t.dmg} · 冷却 ${t.cd}s · 射程 ${t.range}<br>${this.scalingText(w)}</div>`;
      d.onclick = () => { this.hide("weaponSelect"); startGame(this.selectedChar, w); };
      box.appendChild(d);
    }
  },

  scalingText(w) {
    return Object.entries(w.scaling)
      .map(([k, v]) => `${STAT_DEFS[k].icon}${STAT_DEFS[k].name} ×${Math.round(v * 100)}%`)
      .join(" ");
  },

  // ---------- HUD ----------
  hud() {
    const p = game.player, s = p.stats;
    this.el("hudHpBar").style.width = Math.max(0, p.hp / s.maxHp * 100) + "%";
    this.el("hudHpText").textContent = `${Math.ceil(p.hp)} / ${s.maxHp}`;
    this.el("hudXpBar").style.width = Math.min(100, p.xp / xpNeeded(p.level) * 100) + "%";
    this.el("hudLevel").textContent = "Lv." + p.level;
    this.el("hudMats").textContent = p.materials;
    this.el("hudWave").textContent = "第 " + game.wave + " 波";
    this.el("hudTimer").textContent = Math.ceil(game.timer) + (game.bossAlive && game.timer <= 0 ? " ⚠击杀BOSS" : "");
  },

  waveBanner(n) {
    const b = this.el("waveBanner");
    b.textContent = (n === 10 || n === 20) ? `⚠ 第 ${n} 波 —— BOSS来袭 ⚠` : `第 ${n} 波`;
    b.classList.remove("hidden");
    b.classList.remove("anim"); void b.offsetWidth; b.classList.add("anim");
    setTimeout(() => b.classList.add("hidden"), 2000);
  },

  // ---------- 暂停 ----------
  showPause() { this.show("pausePanel"); this.renderStatsInto("pauseStats"); },
  hidePause() { this.hide("pausePanel"); },
  toggleStats() {
    if (state !== "playing" && state !== "paused") return;
    const f = this.el("statsFloat");
    if (f.classList.contains("hidden")) { this.renderStatsInto("statsFloatBody"); f.classList.remove("hidden"); }
    else f.classList.add("hidden");
  },

  statLine(k, v) {
    const def = STAT_DEFS[k];
    const cls = v > 0 ? "pos" : v < 0 ? "neg" : "";
    const sign = v > 0 ? "+" : "";
    return `<div class="statLine"><span>${def.icon} ${def.name}</span><span class="${cls}">${sign}${v}${def.pct ? "%" : ""}</span></div>`;
  },

  renderStatsInto(id) {
    const s = game.player.stats;
    let html = `<div class="statLine"><span>❤️ 生命</span><span>${Math.ceil(game.player.hp)}/${s.maxHp}</span></div>`;
    for (const k in STAT_DEFS) {
      if (k === "maxHp") continue;
      html += this.statLine(k, Math.round(s[k]));
    }
    this.el(id).innerHTML = html;
  },

  // ---------- 波次结算流程：升级 → 宝箱 → 商店 ----------
  startInterlude(harvest) {
    this._harvestGain = harvest;
    this.hide("statsFloat");
    this.processInterlude();
  },

  processInterlude() {
    if (game.levelQueue > 0) { game.levelQueue--; this.showLevelup(); }
    else if (game.crates > 0) { game.crates--; this.showCrate(); }
    else if (game.wave >= 20) { state = "win"; this.showGameOver(true); }
    else this.showShop();
  },

  // ---------- 升级选择 ----------
  showLevelup() {
    this.show("levelupPanel");
    this.el("levelupTitle").textContent = `升级！Lv.${game.player.level} —— 选择一项强化`;
    const box = this.el("levelupChoices");
    box.innerHTML = "";
    const luck = game.player.stats.luck;
    const picks = [];
    const poolCopy = [...UPGRADES];
    for (let i = 0; i < 4 && poolCopy.length; i++) {
      const idx = Math.floor(Math.random() * poolCopy.length);
      const up = poolCopy.splice(idx, 1)[0];
      picks.push({ ...up, tier: rollUpgradeTier(luck) });
    }
    for (const u of picks) {
      const def = STAT_DEFS[u.stat];
      const val = u.v * u.tier;
      const d = document.createElement("div");
      d.className = "card upCard";
      d.style.borderColor = TIER_COLORS[u.tier];
      d.innerHTML = `<div class="cardEmoji">${def.icon}</div>
        <div class="cardName" style="color:${TIER_COLORS[u.tier]}">${TIER_NAMES[u.tier]}</div>
        <div class="cardDesc big">${def.name} +${val}${def.pct ? "%" : ""}</div>`;
      d.onclick = () => {
        addUpgrade(u.stat, val);
        this.hide("levelupPanel");
        sfx("buy");
        this.processInterlude();
      };
      box.appendChild(d);
    }
  },

  // ---------- 宝箱 ----------
  showCrate() {
    this.show("cratePanel");
    const luck = game.player.stats.luck;
    const rar = rollRarity(game.wave, luck);
    const pool = ITEMS.filter(i => i.rarity === rar);
    const item = pool[Math.floor(Math.random() * pool.length)] || ITEMS[0];
    const recycleVal = Math.round(scaledPrice(item.price, game.wave) * 0.9);
    const box = this.el("crateBody");
    box.innerHTML = `<div class="card itemCard" style="border-color:${TIER_COLORS[item.rarity]}">
        <div class="cardEmoji">${item.emoji}</div>
        <div class="cardName" style="color:${TIER_COLORS[item.rarity]}">${item.name}</div>
        <div class="cardDesc">${this.itemStatsText(item)}</div>
      </div>
      <div class="row">
        <button id="crateTake" class="btn">拿走</button>
        <button id="crateRecycle" class="btn gray">回收 (+${recycleVal} 材料)</button>
      </div>`;
    this.el("crateTake").onclick = () => {
      addItem(item); sfx("buy");
      this.hide("cratePanel"); this.processInterlude();
    };
    this.el("crateRecycle").onclick = () => {
      gainMaterials(recycleVal); sfx("pickup");
      this.hide("cratePanel"); this.processInterlude();
    };
  },

  itemStatsText(item) {
    return Object.entries(item.stats).map(([k, v]) => {
      const def = STAT_DEFS[k];
      const cls = v > 0 ? "pos" : "neg";
      return `<span class="${cls}">${def.icon}${def.name} ${v > 0 ? "+" : ""}${v}${def.pct ? "%" : ""}</span>`;
    }).join("<br>");
  },

  // ---------- 商店 ----------
  showShop() {
    this.show("shopPanel");
    this.el("shopWave").textContent = `第 ${game.wave} 波结束 —— 商店（下一波：第 ${game.wave + 1} 波）`;
    if (this._harvestGain > 0) {
      this.toast(`🌾 收获结算 +${this._harvestGain} 材料`);
      this._harvestGain = 0;
    }
    // 生成商品（保留锁定的）
    const old = game.shopOffers || [];
    game.shopOffers = [];
    for (let i = 0; i < 4; i++) {
      if (old[i] && old[i].locked && !old[i].sold) game.shopOffers.push(old[i]);
      else game.shopOffers.push(this.genOffer());
    }
    game.rerolls = 0;
    this.renderShop();
  },

  genOffer() {
    const wave = game.wave, luck = game.player.stats.luck;
    const rar = rollRarity(wave, luck);
    if (Math.random() < 0.4) {
      const pool = WEAPONS.filter(w => !this.weaponForbidden(w));
      const def = pool[Math.floor(Math.random() * pool.length)];
      const tier = Math.min(rar, 4);
      return { kind: "weapon", def, tier, price: scaledPrice(def.tiers[tier - 1].price, wave), locked: false, sold: false };
    } else {
      const pool = ITEMS.filter(i => i.rarity === rar);
      const def = pool[Math.floor(Math.random() * pool.length)] || ITEMS[0];
      return { kind: "item", def, price: scaledPrice(def.price, wave), locked: false, sold: false };
    }
  },

  weaponForbidden(w) {
    const f = game.player.char.forbid;
    return f && w.type === f;
  },

  rerollCost() { return game.wave + game.rerolls * (2 + Math.floor(game.wave / 2)); },

  reroll() {
    const cost = this.rerollCost();
    if (game.player.materials < cost) { this.toast("材料不足！"); return; }
    game.player.materials -= cost;
    game.rerolls++;
    game.shopOffers = game.shopOffers.map(o => (o.locked && !o.sold) ? o : this.genOffer());
    sfx("shoot");
    this.renderShop();
  },

  renderShop() {
    const p = game.player;
    this.el("shopMats").textContent = p.materials;
    this.el("btnReroll").textContent = `🔄 刷新 (${this.rerollCost()})`;
    // 商品
    const box = this.el("shopOffers");
    box.innerHTML = "";
    game.shopOffers.forEach((o, i) => {
      const d = document.createElement("div");
      if (o.sold) {
        d.className = "card offerCard sold";
        d.innerHTML = `<div class="cardDesc">已售出</div>`;
        box.appendChild(d);
        return;
      }
      const isWeapon = o.kind === "weapon";
      const color = TIER_COLORS[isWeapon ? o.tier : o.def.rarity];
      let body;
      if (isWeapon) {
        const t = o.def.tiers[o.tier - 1];
        body = `<div class="cardEmoji">${o.def.emoji}</div>
          <div class="cardName" style="color:${color}">${o.def.name} ${TIER_NAMES[o.tier]}</div>
          <div class="cardDesc">${o.def.type === "melee" ? "近战" : "远程"} · ${o.def.cls}<br>
          伤害 ${t.dmg} · 冷却 ${t.cd}s<br>射程 ${t.range} · 暴击 ${Math.round(o.def.critC * 100)}%<br>${this.scalingText(o.def)}</div>`;
      } else {
        body = `<div class="cardEmoji">${o.def.emoji}</div>
          <div class="cardName" style="color:${color}">${o.def.name}</div>
          <div class="cardDesc">${this.itemStatsText(o.def)}</div>`;
      }
      const afford = p.materials >= o.price;
      const full = isWeapon && p.weapons.length >= 6;
      d.className = "card offerCard";
      d.style.borderColor = color;
      d.innerHTML = body +
        `<button class="btn buy ${afford && !full ? "" : "disabled"}">💎 ${o.price}${full ? " (武器已满)" : ""}</button>
         <div class="lockBtn ${o.locked ? "locked" : ""}">${o.locked ? "🔒 已锁定" : "🔓 锁定"}</div>`;
      d.querySelector(".buy").onclick = () => {
        if (!afford || full) return;
        p.materials -= o.price;
        o.sold = true;
        if (isWeapon) addWeapon(o.def, o.tier);
        else addItem(o.def);
        sfx("buy");
        this.renderShop();
      };
      d.querySelector(".lockBtn").onclick = () => { o.locked = !o.locked; this.renderShop(); };
      box.appendChild(d);
    });
    // 已有武器
    const wbox = this.el("shopWeapons");
    wbox.innerHTML = "";
    p.weapons.forEach((w, i) => {
      const d = document.createElement("div");
      d.className = "miniCard";
      d.style.borderColor = TIER_COLORS[w.tier];
      const canCombine = w.tier < 4 && p.weapons.some((o, j) => j !== i && o.def === w.def && o.tier === w.tier);
      const sellVal = Math.round(scaledPrice(w.def.tiers[w.tier - 1].price, game.wave) * 0.5);
      d.innerHTML = `<div class="miniEmoji">${w.def.emoji}</div>
        <div class="miniName" style="color:${TIER_COLORS[w.tier]}">${w.def.name} T${w.tier}</div>
        <div class="miniBtns">
          ${canCombine ? `<button class="btn tiny combine">⬆合成</button>` : ""}
          <button class="btn tiny gray sell">卖 ${sellVal}</button>
        </div>`;
      const cb = d.querySelector(".combine");
      if (cb) cb.onclick = () => {
        const j = p.weapons.findIndex((o, k) => k !== i && o.def === w.def && o.tier === w.tier);
        p.weapons.splice(j, 1);
        w.tier++;
        layoutWeapons(); sfx("level");
        this.renderShop();
      };
      d.querySelector(".sell").onclick = () => {
        p.weapons.splice(i, 1);
        p.materials += sellVal;
        layoutWeapons(); sfx("pickup");
        this.renderShop();
      };
      wbox.appendChild(d);
    });
    for (let i = p.weapons.length; i < 6; i++) {
      const d = document.createElement("div");
      d.className = "miniCard empty";
      d.innerHTML = `<div class="miniEmoji">➕</div><div class="miniName">空位</div>`;
      wbox.appendChild(d);
    }
    // 已有道具
    const ibox = this.el("shopItems");
    ibox.innerHTML = p.itemList.length
      ? p.itemList.map(it => `<span class="itemChip" title="${it.name}：${Object.entries(it.stats).map(([k,v])=>STAT_DEFS[k].name+(v>0?"+":"")+v).join(", ")}">${it.emoji}</span>`).join("")
      : `<span class="dim">暂无道具</span>`;
    this.renderStatsInto("shopStats");
  },

  // ---------- 结束 ----------
  showGameOver(win) {
    this.hide("shopPanel"); this.hide("levelupPanel"); this.hide("cratePanel");
    this.show("endPanel");
    const g = game, p = g.player;
    this.el("endTitle").textContent = win ? "🏆 胜利！你活过了20波！" : "💀 你死了";
    this.el("endTitle").style.color = win ? "#ffd75a" : "#ff6a6a";
    this.el("endBody").innerHTML = `
      <div class="statLine"><span>角色</span><span>${p.char.emoji} ${p.char.name}</span></div>
      <div class="statLine"><span>存活至</span><span>第 ${g.wave} 波</span></div>
      <div class="statLine"><span>等级</span><span>Lv.${p.level}</span></div>
      <div class="statLine"><span>击杀数</span><span>${g.kills}</span></div>
      <div class="statLine"><span>累计材料</span><span>${g.totalMats}</span></div>`;
  },
};
