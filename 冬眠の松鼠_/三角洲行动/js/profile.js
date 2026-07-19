/* ===== 存档 / 仓库 / 哈夫币 ===== */
"use strict";

const Profile = {
  KEY: "df_web_profile_v1",
  data: null,
  _uid: 1,

  defaults() {
    return {
      coins: 260000,
      raids: 0, extracts: 0, kills: 0, deaths: 0,
      stash: [
        "akm", "g17", "smg45",
        "armor2", "armor2", "helm2", "helm2",
        "rig1", "bag1", "bag1",
        "bandage", "bandage", "bandage", "firstaid",
        "ammo_762x39", "ammo_762x39", "ammo_762x39",
        "ammo_9x19", "ammo_9x19", "ammo_45acp", "ammo_45acp"
      ].map(id => ({ uid: 0, id })),
      loadout: {
        operator: "dwolf",
        primary: null, secondary: null,
        armor: null, helmet: null, bag: null, rig: null,
        pouch: []
      },
      settings: { sens: 1.0, fov: 75, volume: 0.8, shadows: true }
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) this.data = JSON.parse(raw);
    } catch (e) { this.data = null; }
    if (!this.data || !this.data.stash) this.data = this.defaults();
    let maxUid = 0;
    for (const it of this.data.stash) {
      if (!it.uid) it.uid = ++maxUid + 1000;
      maxUid = Math.max(maxUid, it.uid);
    }
    const lo = this.data.loadout;
    for (const k of ["primary","secondary","armor","helmet","bag","rig"]) {
      if (lo[k] && !this.findItem(lo[k])) lo[k] = null;
    }
    lo.pouch = (lo.pouch || []).filter(uid => this.findItem(uid));
    this._uid = maxUid + 1;
    this.save();
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {}
  },

  reset() {
    this.data = this.defaults();
    this._uid = 1;
    for (const it of this.data.stash) it.uid = this._uid++;
    this.save();
  },

  newUid() { return this._uid++; },

  addItem(defId) {
    const it = { uid: this.newUid(), id: defId };
    this.data.stash.push(it);
    return it;
  },

  findItem(uid) { return this.data.stash.find(i => i.uid === uid) || null; },

  removeItem(uid) {
    const idx = this.data.stash.findIndex(i => i.uid === uid);
    if (idx >= 0) this.data.stash.splice(idx, 1);
    const lo = this.data.loadout;
    for (const k of ["primary","secondary","armor","helmet","bag","rig"]) {
      if (lo[k] === uid) lo[k] = null;
    }
    lo.pouch = lo.pouch.filter(u => u !== uid);
  },

  sellItem(uid) {
    const it = this.findItem(uid);
    if (!it) return 0;
    const v = DEF(it.id).value;
    this.removeItem(uid);
    this.data.coins += v;
    this.save();
    return v;
  },

  buyItem(defId) {
    const def = DEF(defId);
    const price = shopPrice(def);
    if (this.data.coins < price) return false;
    this.data.coins -= price;
    this.addItem(defId);
    this.save();
    return true;
  },

  /* 装备/卸下：uid 为仓库物品 */
  equip(uid) {
    const it = this.findItem(uid);
    if (!it) return false;
    const def = DEF(it.id);
    const lo = this.data.loadout;
    if (this.isEquipped(uid)) return false;
    if (def.kind === "weapon") {
      const slot = def.slot === "secondary" ? "secondary" : "primary";
      lo[slot] = uid;
    } else if (def.kind === "armor") lo.armor = uid;
    else if (def.kind === "helmet") lo.helmet = uid;
    else if (def.kind === "bag") lo.bag = uid;
    else if (def.kind === "rig") lo.rig = uid;
    else if (def.kind === "med" || def.kind === "ammo") {
      const cap = this.pouchCapacity();
      const used = this.pouchUsed();
      if (used + def.w * def.h > cap) return "full";
      lo.pouch.push(uid);
    } else return false;
    this.save();
    return true;
  },

  unequip(uid) {
    const lo = this.data.loadout;
    for (const k of ["primary","secondary","armor","helmet","bag","rig"]) {
      if (lo[k] === uid) { lo[k] = null; this.save(); return; }
    }
    lo.pouch = lo.pouch.filter(u => u !== uid);
    this.save();
  },

  isEquipped(uid) {
    const lo = this.data.loadout;
    return ["primary","secondary","armor","helmet","bag","rig"].some(k => lo[k] === uid)
      || lo.pouch.includes(uid);
  },

  pouchCapacity() {
    const lo = this.data.loadout;
    const rig = lo.rig ? DEF(this.findItem(lo.rig).id) : null;
    return rig ? rig.cols * rig.rows : 4;
  },
  pouchUsed() {
    return this.data.loadout.pouch.reduce((s, uid) => {
      const it = this.findItem(uid);
      if (!it) return s;
      const d = DEF(it.id);
      return s + d.w * d.h;
    }, 0);
  },

  loadoutValue() {
    const lo = this.data.loadout;
    let v = 0;
    for (const k of ["primary","secondary","armor","helmet","bag","rig"]) {
      if (lo[k]) { const it = this.findItem(lo[k]); if (it) v += DEF(it.id).value; }
    }
    for (const uid of lo.pouch) { const it = this.findItem(uid); if (it) v += DEF(it.id).value; }
    return v;
  },

  /* 出击：从仓库移除已装备物品，返回快照供局内使用 */
  deploySnapshot() {
    const lo = this.data.loadout;
    const take = (uid) => {
      if (!uid) return null;
      const it = this.findItem(uid);
      if (!it) return null;
      const id = it.id;
      this.removeItem(uid);
      return id;
    };
    const pouchUids = lo.pouch.slice();
    const snap = {
      operator: lo.operator,
      primary: take(lo.primary), secondary: take(lo.secondary),
      armor: take(lo.armor), helmet: take(lo.helmet),
      bag: take(lo.bag), rig: take(lo.rig),
      pouch: pouchUids.map(u => take(u)).filter(Boolean)
    };
    this.data.raids++;
    this.save();
    return snap;
  },

  /* 撤离成功：把带出的物品放回仓库 */
  returnLoot(defIds) {
    for (const id of defIds) if (DB[id]) this.addItem(id);
    this.save();
  }
};
