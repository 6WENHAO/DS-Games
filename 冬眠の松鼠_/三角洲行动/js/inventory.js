/* ===== 局内库存：网格背包 / 搜索 / 安全箱 ===== */
"use strict";

const Inventory = {
  /* 局内物品：{uid, id} */
  rig: [], bag: [], safe: [],
  rigDef: null, bagDef: null,
  SAFE_COLS: 3, SAFE_ROWS: 3,
  _uid: 1,
  open: false,
  lootTarget: null,   // 当前搜索的容器

  initRaid(snapshot) {
    this.rig = []; this.bag = []; this.safe = [];
    this._uid = 1;
    this.rigDef = snapshot.rig ? DEF(snapshot.rig) : null;
    this.bagDef = snapshot.bag ? DEF(snapshot.bag) : null;
    this.open = false;
    this.lootTarget = null;
    /* 携行物资进胸挂（弹药转为备弹） */
    for (const id of snapshot.pouch) {
      const def = DEF(id);
      if (def.kind === "ammo") Player.addReserve(def.ammo, def.count);
      else this.rig.push(this.mk(id));
    }
  },

  mk(id) { return { uid: this._uid++, id }; },

  capacity(which) {
    if (which === "rig") return this.rigDef ? this.rigDef.cols * this.rigDef.rows : 4;
    if (which === "bag") return this.bagDef ? this.bagDef.cols * this.bagDef.rows : 0;
    return this.SAFE_COLS * this.SAFE_ROWS;
  },
  used(list) {
    return list.reduce((s, it) => { const d = DEF(it.id); return s + d.w * d.h; }, 0);
  },

  /* 尝试放入：优先胸挂 -> 背包；返回实际去向或 null */
  autoStore(id) {
    const def = DEF(id);
    const size = def.w * def.h;
    if (def.kind === "ammo") { Player.addReserve(def.ammo, def.count); return "ammo"; }
    if (this.used(this.rig) + size <= this.capacity("rig")) { this.rig.push(this.mk(id)); return "rig"; }
    if (this.used(this.bag) + size <= this.capacity("bag")) { this.bag.push(this.mk(id)); return "bag"; }
    return null;
  },

  toSafe(uid) {
    const loc = this.findLoc(uid);
    if (!loc) return false;
    const it = loc.list[loc.idx];
    const def = DEF(it.id);
    if (this.used(this.safe) + def.w * def.h > this.capacity("safe")) {
      UI.toast("安全箱空间不足");
      return false;
    }
    loc.list.splice(loc.idx, 1);
    this.safe.push(it);
    return true;
  },

  fromSafe(uid) {
    const idx = this.safe.findIndex(i => i.uid === uid);
    if (idx < 0) return;
    const it = this.safe[idx];
    const def = DEF(it.id);
    const size = def.w * def.h;
    if (this.used(this.rig) + size <= this.capacity("rig")) { this.safe.splice(idx, 1); this.rig.push(it); }
    else if (this.used(this.bag) + size <= this.capacity("bag")) { this.safe.splice(idx, 1); this.bag.push(it); }
    else UI.toast("胸挂与背包已满");
  },

  findLoc(uid) {
    for (const which of ["rig", "bag", "safe"]) {
      const list = this[which];
      const idx = list.findIndex(i => i.uid === uid);
      if (idx >= 0) return { which, list, idx };
    }
    return null;
  },

  discard(uid) {
    const loc = this.findLoc(uid);
    if (loc) loc.list.splice(loc.idx, 1);
  },

  consumeItem(uid) {
    this.discard(uid);
    this.refresh();
  },

  findBestMed() {
    const all = this.rig.concat(this.bag);
    const meds = all.filter(i => DEF(i.id).kind === "med");
    if (!meds.length) return null;
    const missing = Player.maxHp - Player.hp;
    meds.sort((a, b) => {
      const ha = DEF(a.id).heal, hb = DEF(b.id).heal;
      const wasteA = Math.abs(Math.min(ha, 200) - missing);
      const wasteB = Math.abs(Math.min(hb, 200) - missing);
      return wasteA - wasteB;
    });
    return meds[0];
  },

  /* 全部带出物（撤离结算用） */
  allCarried() {
    return this.rig.concat(this.bag, this.safe);
  },

  totalValue(list) {
    return list.reduce((s, it) => s + DEF(it.id).value, 0);
  },

  /* ---- 容器搜索 ---- */
  generateLoot(container) {
    if (container.loot) return;
    let ids = rollLoot(container.type === "corpse" ? "corpse" : container.type);
    if (container.presetLoot) ids = container.presetLoot.concat(ids);
    container.loot = ids.map(id => this.mk(id));
  },

  takeFromLoot(uid) {
    const c = this.lootTarget;
    if (!c || !c.loot) return;
    const idx = c.loot.findIndex(i => i.uid === uid);
    if (idx < 0) return;
    const it = c.loot[idx];
    const dest = this.autoStore(it.id);
    if (!dest) { UI.toast("背包空间不足"); return; }
    c.loot.splice(idx, 1);
    AudioSys.pickup();
    this.refresh();
  },

  takeAll() {
    const c = this.lootTarget;
    if (!c || !c.loot) return;
    for (let i = c.loot.length - 1; i >= 0; i--) {
      const it = c.loot[i];
      if (this.autoStore(it.id)) { c.loot.splice(i, 1); AudioSys.pickup(); }
    }
    this.refresh();
  },

  /* ---- UI 渲染 ---- */
  el(id) { return document.getElementById(id); },

  show(lootContainer) {
    this.open = true;
    this.lootTarget = lootContainer || null;
    this.el("inv-overlay").classList.remove("hidden");
    const lootPanel = this.el("inv-loot-panel");
    if (this.lootTarget) {
      lootPanel.classList.remove("hidden");
      this.el("loot-head").innerHTML = this.lootTarget.name +
        ' <button id="take-all-btn" style="float:right;font-size:11px;background:#1c2b36;border:1px solid #35566d;color:#cfe3ef;cursor:pointer;padding:1px 8px;border-radius:2px;">全部拾取</button>';
      setTimeout(() => {
        const b = document.getElementById("take-all-btn");
        if (b) b.onclick = () => this.takeAll();
      }, 0);
    } else {
      lootPanel.classList.add("hidden");
    }
    this.refresh();
  },

  hide() {
    this.open = false;
    this.lootTarget = null;
    this.el("inv-overlay").classList.add("hidden");
  },

  refresh() {
    if (!this.open) return;
    /* 装备栏 */
    const eqEl = this.el("equip-list");
    const rows = [];
    const wnames = Player.weapons.map((w, i) => {
      if (!w) return '<span style="color:#54707f">空</span>';
      const d = DEF(w.defId);
      return `<span style="color:${RARITY[d.rarity].color}">${d.name}</span> <small>${w.mag}/${d.mag}</small>`;
    });
    rows.push(`<div class="equip-row"><span class="slot-label">主武器</span><span>${wnames[0]}</span></div>`);
    rows.push(`<div class="equip-row"><span class="slot-label">副武器</span><span>${wnames[1]}</span></div>`);
    const armorTxt = Player.armor ?
      `<span style="color:${RARITY[DEF(Player.armor.defId).rarity].color}">${DEF(Player.armor.defId).name}</span> <small>${Math.ceil(Player.armor.dur)}</small>` :
      '<span style="color:#54707f">无</span>';
    const helmTxt = Player.helmet ?
      `<span style="color:${RARITY[DEF(Player.helmet.defId).rarity].color}">${DEF(Player.helmet.defId).name}</span> <small>${Math.ceil(Player.helmet.dur)}</small>` :
      '<span style="color:#54707f">无</span>';
    rows.push(`<div class="equip-row"><span class="slot-label">头盔</span><span>${helmTxt}</span></div>`);
    rows.push(`<div class="equip-row"><span class="slot-label">护甲</span><span>${armorTxt}</span></div>`);
    const ammoTxt = Object.entries(Player.reserve).filter(e => e[1] > 0)
      .map(e => `${AMMO_TYPES[e[0]].name.split(" ")[0]}×${e[1]}`).join("　") || "无备弹";
    rows.push(`<div class="equip-row"><span class="slot-label">弹药袋</span><span style="font-size:11px">${ammoTxt}</span></div>`);
    eqEl.innerHTML = rows.join("");

    this.renderGrid("rig-grid", this.rig, this.rigDef ? this.rigDef.cols : 4, "rig");
    this.renderGrid("bag-grid", this.bag, this.bagDef ? this.bagDef.cols : 4, "bag");
    this.renderGrid("safe-grid", this.safe, this.SAFE_COLS, "safe");
    this.el("rig-cap").textContent = `${this.used(this.rig)}/${this.capacity("rig")}`;
    this.el("bag-cap").textContent = this.bagDef ? `${this.used(this.bag)}/${this.capacity("bag")}` : "未携带背包";
    this.el("safe-cap").textContent = `${this.used(this.safe)}/${this.capacity("safe")}`;

    if (this.lootTarget) {
      this.renderGrid("loot-grid", this.lootTarget.loot || [], 4, "loot");
    }
  },

  renderGrid(elId, list, cols, which) {
    const el = this.el(elId);
    el.style.gridTemplateColumns = `repeat(${cols},1fr)`;
    el.innerHTML = "";
    for (const it of list) {
      const d = DEF(it.id);
      const card = document.createElement("div");
      card.className = "item-card " + RARITY[d.rarity].cls;
      card.style.gridColumn = `span ${Math.min(d.w, cols)}`;
      card.style.gridRow = `span ${d.h}`;
      let sub = fmtCoin(d.value);
      if (d.kind === "med") sub = `恢复${d.heal >= 200 ? "全部" : d.heal}`;
      if (d.kind === "ammo") sub = `${d.count}发`;
      card.innerHTML = `<div class="i-name">${d.name}</div><div class="i-sub">${sub}</div>`;
      const actions = document.createElement("div");
      actions.className = "i-actions";
      if (which === "loot") {
        card.onclick = () => this.takeFromLoot(it.uid);
      } else if (which === "safe") {
        const btn = document.createElement("button");
        btn.textContent = "取出";
        btn.onclick = (e) => { e.stopPropagation(); this.fromSafe(it.uid); this.refresh(); };
        actions.appendChild(btn);
      } else {
        if (d.kind === "med") {
          const useBtn = document.createElement("button");
          useBtn.textContent = "使用";
          useBtn.onclick = (e) => {
            e.stopPropagation();
            if (!Player.usingMed && Player.hp < Player.maxHp) {
              Player.usingMed = it;
              Player.medTimer = d.useTime * (Player.operator.medMul || 1);
              Player.medTotal = Player.medTimer;
              this.hide();
              App.lockPointer();
            } else UI.toast(Player.usingMed ? "正在使用医疗" : "生命值已满");
          };
          actions.appendChild(useBtn);
        }
        const safeBtn = document.createElement("button");
        safeBtn.textContent = "安全箱";
        safeBtn.onclick = (e) => { e.stopPropagation(); if (this.toSafe(it.uid)) AudioSys.ui(); this.refresh(); };
        actions.appendChild(safeBtn);
        const dropBtn = document.createElement("button");
        dropBtn.textContent = "丢弃";
        dropBtn.onclick = (e) => { e.stopPropagation(); this.discard(it.uid); this.refresh(); };
        actions.appendChild(dropBtn);
      }
      if (actions.children.length) card.appendChild(actions);
      el.appendChild(card);
    }
  }
};
