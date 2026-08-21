/* =========================================================================
 * GREENFALL · survival.js —— 背包/装备/负重 + 生存状态机
 *
 * 生存维度：生命 饥饿 口渴 体力 体温 潮湿 感染 流血 疾病 疲劳 疼痛
 * ======================================================================= */
(function (GF) {
  'use strict';

  const U = GF.util;
  const It = () => GF.Items;

  /* ==================================================== 背包 / 装备 */
  const EQUIP_SLOTS = ['head', 'face', 'chest', 'legs', 'feet', 'hands', 'back'];
  const EQUIP_NAME = { head: '头部', face: '面部', chest: '躯干', legs: '腿部', feet: '足部', hands: '手部', back: '背负' };

  class Inventory {
    constructor(baseSlots) {
      this.base = baseSlots || 24;
      this.slots = new Array(this.base).fill(null);      // 前 9 格为快捷栏
      this.equip = {}; for (const s of EQUIP_SLOTS) this.equip[s] = null;
      this.hotbar = 9;
      this.sel = 0;
      this.baseCarry = 24;
    }

    get size() { return this.base + this.bonusSlots(); }
    bonusSlots() {
      let n = 0;
      for (const s of EQUIP_SLOTS) {
        const st = this.equip[s];
        if (st) { const it = It().get(st.item); if (it && it.slots) n += it.slots; }
      }
      return n;
    }
    ensureSize() {
      const want = this.size;
      while (this.slots.length < want) this.slots.push(null);
      while (this.slots.length > want) {
        const last = this.slots.pop();
        if (last) this.overflow = (this.overflow || []).concat([last]);
      }
    }

    /* ---------------------------------------------------- 负重 */
    weight() {
      let w = 0;
      for (const s of this.slots) if (s) w += It().weightOf(s.item) * s.n;
      for (const k of EQUIP_SLOTS) { const s = this.equip[k]; if (s) w += It().weightOf(s.item) * 0.55; }
      return w;
    }
    maxWeight() {
      let m = this.baseCarry;
      for (const k of EQUIP_SLOTS) {
        const s = this.equip[k]; if (!s) continue;
        const it = It().get(s.item); if (it && it.carry) m += it.carry;
      }
      return m;
    }
    overloadRatio() { return Math.max(0, this.weight() / this.maxWeight() - 1); }

    /* ---------------------------------------------------- 存取 */
    add(item, n, dur) {
      const def = It().get(item);
      if (!def) return n;
      let left = n;
      const stack = def.stack || 1;
      if (stack > 1) {
        for (const s of this.slots) {
          if (!s || s.item !== item) continue;
          const room = stack - s.n;
          if (room <= 0) continue;
          const take = Math.min(room, left);
          s.n += take; left -= take;
          if (left <= 0) return 0;
        }
      }
      this.ensureSize();
      for (let i = 0; i < this.slots.length && left > 0; i++) {
        if (this.slots[i]) continue;
        const take = Math.min(stack, left);
        const md = It().maxDur(item);
        this.slots[i] = { item, n: take, dur: dur != null ? dur : (md > 0 ? md : null), fresh: def.food && def.food.spoil ? 1 : undefined };
        left -= take;
      }
      return left;
    }
    count(item) { let n = 0; for (const s of this.slots) if (s && s.item === item) n += s.n; return n; }
    remove(item, n) {
      let left = n;
      for (let i = 0; i < this.slots.length && left > 0; i++) {
        const s = this.slots[i];
        if (!s || s.item !== item) continue;
        const take = Math.min(s.n, left);
        s.n -= take; left -= take;
        if (s.n <= 0) this.slots[i] = null;
      }
      return n - left;
    }
    hasAll(ins) { for (const [k, c] of ins) if (this.count(k) < Math.ceil(c)) return false; return true; }
    removeAll(ins) { for (const [k, c] of ins) this.remove(k, Math.ceil(c)); }

    held() { return this.slots[this.sel] || null; }
    heldDef() { const s = this.held(); return s ? It().get(s.item) : null; }

    /** 找一件符合工具类型的最好工具（返回 {slot, def, tool}） */
    bestTool(type) {
      let best = null;
      for (let i = 0; i < this.slots.length; i++) {
        const s = this.slots[i]; if (!s) continue;
        const d = It().get(s.item); if (!d || !d.tool) continue;
        if (d.tool.type !== type) continue;
        if (s.dur !== null && s.dur <= 0) continue;
        if (!best || d.tool.tier > best.def.tool.tier || (d.tool.tier === best.def.tool.tier && d.tool.speed > best.def.tool.speed)) {
          best = { slot: i, def: d, tool: d.tool };
        }
      }
      return best;
    }
    /** 是否持有某类工具（配方 need 检查） */
    hasToolType(type) { return !!this.bestTool(type); }
    hasItem(key) { return this.count(key) > 0 || EQUIP_SLOTS.some((s) => this.equip[s] && this.equip[s].item === key); }

    damageTool(slotIdx, amount) {
      const s = this.slots[slotIdx]; if (!s || s.dur == null) return false;
      s.dur -= amount;
      if (s.dur <= 0) {
        GF.bus.emit('tool:broke', { item: s.item });
        s.n -= 1;
        if (s.n <= 0) this.slots[slotIdx] = null;
        else s.dur = It().maxDur(s.item);
        return true;
      }
      return false;
    }

    swap(a, b) { const t = this.slots[a]; this.slots[a] = this.slots[b]; this.slots[b] = t; }

    /** 装备/卸下 */
    equipFrom(slotIdx) {
      const s = this.slots[slotIdx]; if (!s) return false;
      const d = It().get(s.item);
      if (!d || !d.armor) return false;
      const k = d.armor.slot;
      const old = this.equip[k];
      this.equip[k] = { item: s.item, n: 1, dur: s.dur };
      s.n -= 1; if (s.n <= 0) this.slots[slotIdx] = null;
      if (old) { if (this.add(old.item, 1, old.dur) > 0) GF.bus.emit('inv:full'); }
      this.ensureSize();
      return true;
    }
    unequip(k) {
      const s = this.equip[k]; if (!s) return false;
      this.equip[k] = null;
      this.ensureSize();
      if (this.add(s.item, 1, s.dur) > 0) { this.equip[k] = s; this.ensureSize(); return false; }
      return true;
    }

    /* -------------------------------------------- 装备综合属性 */
    defense() { let d = 0; for (const k of EQUIP_SLOTS) { const s = this.equip[k]; if (!s) continue; const it = It().get(s.item); if (it && it.armor) d += it.armor.def * (s.dur == null ? 1 : U.clamp(s.dur / Math.max(1, It().maxDur(s.item)), 0.25, 1)); } return d; }
    warmth() { let w = 0; for (const k of EQUIP_SLOTS) { const s = this.equip[k]; if (!s) continue; const it = It().get(s.item); if (it && it.armor) w += it.armor.warm; } return w; }
    rainProof() { let w = 0; for (const k of EQUIP_SLOTS) { const s = this.equip[k]; if (!s) continue; const it = It().get(s.item); if (it && it.armor) w += it.armor.rain; } return w; }
    sporeProof() {
      let p = 0;
      for (const k of EQUIP_SLOTS) {
        const s = this.equip[k]; if (!s) continue;
        const it = It().get(s.item); if (!it) continue;
        if (it.blocksSpore === true) p = Math.max(p, this.hasItem('mask_filter') ? 0.95 : 0.4);
        else if (typeof it.blocksSpore === 'number') p = Math.max(p, it.blocksSpore);
      }
      return p;
    }
    biteResist() { let r = 0; for (const k of EQUIP_SLOTS) { const s = this.equip[k]; if (!s) continue; const it = It().get(s.item); if (it && it.biteResist) r = Math.max(r, it.biteResist); } return r; }
    /** 装备/背包提供的能力（compass / map / gps / zoom / spore / clock / radio） */
    grants(key) {
      for (const s of this.slots) if (s) { const d = It().get(s.item); if (d && d.grants === key) return true; }
      for (const k of EQUIP_SLOTS) { const s = this.equip[k]; if (s) { const d = It().get(s.item); if (d && d.grants === key) return true; } }
      return false;
    }
    quietness() { let q = 0; for (const k of EQUIP_SLOTS) { const s = this.equip[k]; if (!s) continue; const it = It().get(s.item); if (it && it.quiet) q += it.quiet; } return q; }

    /* ---------------------------------------------------- 存档 */
    serialize() { return { base: this.base, slots: this.slots, equip: this.equip, sel: this.sel }; }
    deserialize(s) {
      if (!s) return;
      this.base = s.base || 24;
      this.slots = s.slots || [];
      this.equip = Object.assign({}, this.equip, s.equip || {});
      this.sel = s.sel || 0;
      this.ensureSize();
    }
  }

  /* ==================================================== 生存状态 */
  class Survival {
    constructor(player, inv, world) {
      this.p = player; this.inv = inv; this.world = world;
      this.hunger = 78;
      this.thirst = 74;
      this.stamina = 100;
      this.temp = 37.0;
      this.wet = 0;
      this.infection = 0;
      this.bleed = 0;
      this.sick = 0;
      this.fatigue = 12;
      this.pain = 0;
      this.immune = 0;
      this.boost = 0;
      this.drunk = 0;
      this.env = { temp: 18, wind: 0, indoor: false, nearFire: 0, light: 15, spore: 0, biome: null };
      this.effects = [];             // {key,name,t,dur,icon}
      this.deathCause = null;
      this.alive = true;
      this.timeAlive = 0;
      this.stats = { blocksMined: 0, itemsCrafted: 0, kills: 0, distance: 0, deaths: 0, nightsSurvived: 0 };
      this._regenT = 0;
      this._msgT = 0;
    }

    addEffect(key, name, dur, icon, data) {
      const ex = this.effects.find((e) => e.key === key);
      if (ex) { ex.t = Math.max(ex.t, dur); return ex; }
      const e = { key, name, t: dur, dur, icon: icon || '✦', data: data || null };
      this.effects.push(e);
      return e;
    }
    hasEffect(key) { return this.effects.some((e) => e.key === key); }
    removeEffect(key) { this.effects = this.effects.filter((e) => e.key !== key); }

    /* ------------------------------------------------ 环境评估 */
    sampleEnv() {
      const w = this.world, p = this.p;
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
      const c = w.getChunk(Math.floor(px / GF.CHUNK), Math.floor(pz / GF.CHUNK));
      let biome = null, light = 15, indoor = false;
      if (c && c.ready) {
        const lx = px - c.cx * GF.CHUNK, lz = pz - c.cz * GF.CHUNK;
        biome = GF.Biomes.list[c.biomeMap[lx + lz * GF.CHUNK]];
        const i = GF.blockIndex(lx, U.clamp(py + 1, 0, GF.HEIGHT - 1), lz);
        const sky = c.sky ? c.sky[i] : 15;
        const blk = c.blockLight ? c.blockLight[i] : 0;
        light = Math.max(sky * w.sunLevel(), blk);
        indoor = sky < 12;
      }
      // 附近火源
      let fire = 0;
      for (let dy = -1; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const id = w.getBlock(px + dx, py + dy, pz + dz);
        if (id <= 0) continue;
        const b = GF.Blocks.list[id];
        if (b.station === 'fire' || b.key === 'forge' || b.key === 'campfire') {
          const d = Math.hypot(dx, dy, dz);
          fire = Math.max(fire, U.clamp(1 - d / 5.2, 0, 1));
        }
      }
      // 孢子暴露：孢化生物群系 + 菌毯附近
      let spore = 0;
      if (biome && biome.hazard === 'spore') spore = 0.35;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const id = w.getBlock(px + dx, py, pz + dz);
        if (id > 0) { const k = GF.Blocks.list[id].key; if (k === 'fungal_wall' || k === 'spore_stalk' || k === 'blight_soil') spore += 0.08; }
      }
      const baseT = biome ? biome.temp : 18;
      const night = w.isNight();
      const sunT = w.sunLevel() * 8;
      const rainT = -w.weather.rain * 5 - (w.weather.kind === 'storm' ? 3 : 0);
      const alt = -(p.y - GF.SEA) * 0.09;
      const envTemp = baseT + sunT - (night ? 8 : 0) + rainT + alt + fire * 22 + (indoor ? 2.5 : 0);
      this.env = { temp: envTemp, indoor, nearFire: fire, light, spore: Math.min(1, spore), biome, wind: w.weather.wind };
      return this.env;
    }

    /* -------------------------------------------------- 主循环 */
    tick(dt, opts) {
      if (!this.alive) return;
      this.timeAlive += dt;
      const p = this.p, inv = this.inv, w = this.world;
      // 环境采样较重（扫描附近火源与孢子），每 0.25s 一次即可
      this._envT = (this._envT || 0) - dt;
      if (this._envT <= 0) { this._envT = 0.25; this.sampleEnv(); }
      const env = this.env;
      const moving = opts && opts.moving;
      const sprinting = opts && opts.sprint;
      const inWater = w.isLiquid(Math.floor(p.x), Math.floor(p.y + 0.6), Math.floor(p.z));

      /* ---- 饥饿 / 口渴 ---- */
      const act = 1 + (sprinting ? 1.5 : moving ? 0.4 : 0) + (opts && opts.working ? 0.9 : 0)
        + this.inv.overloadRatio() * 1.4;
      this.hunger -= dt * 0.135 * act;
      this.thirst -= dt * 0.205 * act * (env.temp > 26 ? 1.35 : 1);
      if (this.temp < 35.5) this.hunger -= dt * 0.09;       // 发抖消耗
      this.hunger = U.clamp(this.hunger, 0, 100);
      this.thirst = U.clamp(this.thirst, 0, 100);

      /* ---- 体力 ---- */
      const staminaCap = 100 - this.fatigue * 0.35 - this.sick * 0.3 - (this.hunger < 20 ? 20 : 0);
      if (sprinting && moving) this.stamina -= dt * (13 + inv.overloadRatio() * 22);
      else if (opts && opts.working) this.stamina -= dt * 4.5;
      else this.stamina += dt * (this.boost > 0 ? 26 : 10.5) * (this.hunger > 30 ? 1 : 0.4);
      this.stamina = U.clamp(this.stamina, 0, Math.max(12, staminaCap));

      /* ---- 潮湿 / 体温 ---- */
      const exposed = !env.indoor;
      const rain = w.weather.rain * (exposed ? 1 : 0.1);
      const rp = U.clamp(inv.rainProof() / 12, 0, 0.92);
      if (inWater) this.wet = Math.min(100, this.wet + dt * 42);
      else if (rain > 0.05) this.wet = Math.min(100, this.wet + dt * rain * 12 * (1 - rp));
      else this.wet = Math.max(0, this.wet - dt * (2.2 + env.nearFire * 12 + (env.indoor ? 1.4 : 0)));

      const clo = inv.warmth();
      const comfort = 20 - clo * 0.75 + this.wet * 0.06 + env.wind * 3;
      const dTemp = (env.temp - comfort) * 0.016 + (env.nearFire > 0.2 ? env.nearFire * 0.05 : 0);
      this.temp += (dTemp - (this.temp - 37) * 0.05) * dt;
      this.temp = U.clamp(this.temp, 28, 42.5);

      /* ---- 流血 ---- */
      if (this.bleed > 0) {
        p.hp -= dt * this.bleed * 1.5;
        this.bleed = Math.max(0, this.bleed - dt * 0.012);
        if (Math.random() < dt * this.bleed * 0.5) GF.bus.emit('fx:blood');
      }

      /* ---- 感染（孢子 / 咬伤） ---- */
      const sp = env.spore * (1 - inv.sporeProof());
      if (sp > 0) this.sporeExposure(dt * sp * 0.55);
      if (this.immune > 0) { this.immune -= dt; this.infection = Math.max(0, this.infection - dt * 1.6); }
      else if (this.infection > 0) {
        this.infection += dt * (0.028 + this.infection * 0.0035) * (this.sick > 40 ? 1.5 : 1);
      }
      this.infection = U.clamp(this.infection, 0, 100);

      /* ---- 疾病 / 疲劳 / 疼痛 ---- */
      if (this.sick > 0) {
        this.sick = Math.max(0, this.sick - dt * 0.22);
        if (Math.random() < dt * this.sick * 0.0009) {           // 呕吐
          this.hunger = Math.max(0, this.hunger - 12);
          this.thirst = Math.max(0, this.thirst - 14);
          GF.bus.emit('toast', { text: '你吐了。', kind: 'bad' });
        }
      }
      this.fatigue = U.clamp(this.fatigue + dt * (0.42 + (this.sick > 30 ? 0.3 : 0)) - (this.boost > 0 ? dt * 0.6 : 0), 0, 100);
      this.pain = Math.max(0, this.pain - dt * 1.1);
      this.boost = Math.max(0, this.boost - dt);
      this.drunk = Math.max(0, this.drunk - dt * 1.4);

      /* ---- 生命：自然恢复与各类伤害 ---- */
      let dmg = 0;
      if (this.hunger <= 0) dmg += 0.55;
      if (this.thirst <= 0) dmg += 1.15;
      if (this.temp < 34.5) dmg += (34.5 - this.temp) * 0.85;
      if (this.temp > 39.6) dmg += (this.temp - 39.6) * 1.1;
      if (this.infection > 72) dmg += (this.infection - 72) * 0.045;
      if (this.sick > 70) dmg += (this.sick - 70) * 0.02;
      if (dmg > 0) p.hp -= dmg * dt;
      else {
        this._regenT += dt;
        const canRegen = this.hunger > 42 && this.thirst > 35 && this.infection < 55 && this.sick < 45;
        if (canRegen && this._regenT > 2.4) {
          this._regenT = 0;
          p.hp = Math.min(p.maxHp, p.hp + 1.15 + (this.hasEffect('regen') ? 1.6 : 0));
        }
      }
      p.hp = Math.min(p.hp, p.maxHp);

      /* ---- 效果计时 ---- */
      for (const e of this.effects) e.t -= dt;
      this.effects = this.effects.filter((e) => e.t > 0);

      /* ---- 死亡 ---- */
      if (p.hp <= 0 && this.alive) {
        this.alive = false;
        this.deathCause = this.infection >= 96 ? '绿蚀感染' :
          this.thirst <= 0 ? '脱水' : this.hunger <= 0 ? '饥饿' :
            this.temp < 34.5 ? '失温' : this.temp > 39.6 ? '高热' :
              this.bleed > 0.4 ? '失血过多' : this.sick > 70 ? '重病' : '伤势过重';
        GF.bus.emit('player:death', { cause: this.deathCause });
      }
      if (this.infection >= 100 && this.alive) {
        this.alive = false; this.deathCause = '绿蚀感染';
        GF.bus.emit('player:death', { cause: this.deathCause });
      }

      /* ---- 警告提示 ---- */
      this._msgT -= dt;
      if (this._msgT <= 0) {
        this._msgT = 22;
        if (this.thirst < 14) GF.bus.emit('toast', { text: '喉咙干得发疼 —— 需要喝水。', kind: 'warn' });
        else if (this.hunger < 14) GF.bus.emit('toast', { text: '胃在抽搐 —— 需要进食。', kind: 'warn' });
        else if (this.temp < 35.2) GF.bus.emit('toast', { text: '你在发抖，得取暖或换衣服。', kind: 'warn' });
        else if (this.temp > 39.2) GF.bus.emit('toast', { text: '头晕目眩 —— 体温过高。', kind: 'warn' });
        else if (this.infection > 45) GF.bus.emit('toast', { text: '伤口边缘泛出绿色纹路……', kind: 'bad' });
        else if (this.fatigue > 82) GF.bus.emit('toast', { text: '眼睛快睁不开了，找张床。', kind: 'warn' });
        else this._msgT = 8;
      }
    }

    /* ---------------------------------------------- 外部事件接口 */
    sporeExposure(a) {
      this.infection = U.clamp(this.infection + a * 2.4, 0, 100);
      if (a > 0.02 && Math.random() < 0.02) GF.bus.emit('toast', { text: '空气里有甜腥味 —— 孢子。', kind: 'bad' });
    }

    takeHit(dmg, opts) {
      opts = opts || {};
      const def = this.inv.defense();
      const bite = opts.infect ? (1 - this.inv.biteResist()) : 1;
      const real = Math.max(1, dmg * (1 - U.clamp(def / 42, 0, 0.72)));
      this.p.hp -= real;
      this.pain = Math.min(100, this.pain + real * 0.9);
      if (opts.bleed && Math.random() < opts.bleed) this.bleed = Math.min(3, this.bleed + 0.45);
      if (opts.infect && Math.random() < opts.infect * bite) {
        this.infection = Math.min(100, this.infection + 6 + Math.random() * 9);
        GF.bus.emit('toast', { text: '被咬了！伤口必须马上处理。', kind: 'bad' });
      }
      // 装备损耗
      const slots = ['chest', 'head', 'legs', 'feet'];
      const k = slots[Math.floor(Math.random() * slots.length)];
      const s = this.inv.equip[k];
      if (s && s.dur != null) { s.dur -= Math.max(1, real * 0.35); if (s.dur <= 0) { this.inv.equip[k] = null; GF.bus.emit('toast', { text: GF.Items.nameOf(s.item) + ' 彻底损坏了。', kind: 'bad' }); this.inv.ensureSize(); } }
      GF.bus.emit('fx:hurt', { dmg: real });
      return real;
    }

    /** 吃 / 喝 / 用药，返回提示文本 */
    consume(slotIdx) {
      const s = this.inv.slots[slotIdx];
      if (!s) return null;
      const d = GF.Items.get(s.item);
      if (!d) return null;
      let msg = null;
      const spoiled = s.fresh !== undefined && s.fresh <= 0.25;

      if (d.food) {
        const f = d.food;
        const mul = spoiled ? 0.45 : 1;
        this.hunger = U.clamp(this.hunger + f.cal * mul, 0, 100);
        this.thirst = U.clamp(this.thirst + (f.water || 0) * mul, 0, 100);
        if (f.heal) this.p.hp = Math.min(this.p.maxHp, this.p.hp + f.heal);
        if (f.warm) this.temp = Math.min(41, this.temp + f.warm * 0.06);
        if (f.stam) this.stamina = U.clamp(this.stamina + f.stam, 0, 100);
        let sickP = (f.sick || 0) + (spoiled ? 0.5 : 0);
        if (d.key === 'mushroom_toxic') sickP = 0.9;
        if (Math.random() < sickP) { this.sick = Math.min(100, this.sick + 30 + Math.random() * 30); msg = '味道很不对……'; }
        if (f.infect) this.infection = U.clamp(this.infection + f.infect * 100 * 0.1, 0, 100);
        if (f.noise) GF.bus.emit('noise', { level: f.noise });
        msg = msg || (spoiled ? '已经变质了，但还是吞了下去。' : '吃下去了。');
      } else if (d.drink) {
        const k = d.drink;
        this.thirst = U.clamp(this.thirst + k.water, 0, 100);
        if (k.warm) this.temp = Math.min(41, this.temp + k.warm * 0.06);
        if (k.stam) this.stamina = U.clamp(this.stamina + k.stam, 0, 100);
        if (k.fatigue) this.fatigue = U.clamp(this.fatigue + k.fatigue, 0, 100);
        if (k.pain) this.pain = Math.max(0, this.pain - k.pain);
        if (k.sickCure) this.sick = Math.max(0, this.sick - k.sickCure * 100);
        if (k.drunk) this.drunk = Math.min(100, this.drunk + k.drunk);
        if (Math.random() < (k.sick || 0)) { this.sick = Math.min(100, this.sick + 25 + Math.random() * 25); msg = '这水不干净。'; }
        msg = msg || '喝下去了。';
        // 空容器返还
        if (d.key.indexOf('bottle') >= 0 || d.key === 'rain_water') this.inv.add('bottle_empty', 1);
        else if (d.key === 'can_soup') this.inv.add('can_empty', 1);
      } else if (d.med) {
        const m = d.med;
        if (m.heal) this.p.hp = Math.min(this.p.maxHp, this.p.hp + m.heal);
        if (m.bleed) this.bleed = Math.max(0, this.bleed - m.bleed);
        if (m.infect) this.infection = U.clamp(this.infection + m.infect * 100, 0, 100);
        if (m.sick) this.sick = U.clamp(this.sick + m.sick * 100, 0, 100);
        if (m.pain) this.pain = Math.max(0, this.pain - m.pain);
        if (m.fever) this.temp = Math.max(36.6, this.temp - Math.abs(m.fever) * 1.4);
        if (m.stam) this.stamina = U.clamp(this.stamina + m.stam, 0, 100);
        if (m.boost) { this.boost = Math.max(this.boost, m.boost); this.addEffect('boost', '肾上腺素', m.boost, '⚡'); }
        if (m.regen) this.addEffect('regen', '恢复中', m.regen, '✚');
        if (m.immune) { this.immune = 240; this.addEffect('immune', '免疫应答', 240, '🛡'); }
        if (m.fracture) this.removeEffect('fracture');
        msg = '处理完毕。';
      } else if (d.food === undefined && d.drink === undefined && d.med === undefined) {
        return null;
      }
      s.n -= 1;
      if (s.n <= 0) this.inv.slots[slotIdx] = null;
      GF.bus.emit('sfx', { kind: d.drink ? 'drink' : d.med ? 'med' : 'eat' });
      return msg;
    }

    /** 睡觉：推进时间并恢复疲劳 */
    sleep(hours) {
      const w = this.world;
      const dtGame = hours / 24;
      w.time += dtGame;
      while (w.time >= 1) { w.time -= 1; w.day++; this.stats.nightsSurvived++; }
      this.fatigue = Math.max(0, this.fatigue - hours * 13);
      this.hunger = Math.max(0, this.hunger - hours * 2.6);
      this.thirst = Math.max(0, this.thirst - hours * 3.4);
      if (this.infection > 0 && this.immune <= 0) this.infection = Math.min(100, this.infection + hours * 0.8);
      if (this.sick > 0) this.sick = Math.max(0, this.sick - hours * 4);
      this.p.hp = Math.min(this.p.maxHp, this.p.hp + hours * (this.hunger > 30 ? 3.2 : 0.8));
      this.stamina = 100;
      return true;
    }

    /* ------------------------------------------------ 食物腐败 */
    spoilTick(dt) {
      const rate = dt / 3600;                       // 每游戏小时
      for (const s of this.inv.slots) {
        if (!s || s.fresh === undefined) continue;
        const d = GF.Items.get(s.item);
        if (!d || !d.food || !d.food.spoil) continue;
        s.fresh -= rate / (d.food.spoil / 24) * 0.6;
        if (s.fresh <= 0) { s.fresh = 0; }
      }
    }

    serialize() {
      return {
        hunger: this.hunger, thirst: this.thirst, stamina: this.stamina, temp: this.temp,
        wet: this.wet, infection: this.infection, bleed: this.bleed, sick: this.sick,
        fatigue: this.fatigue, pain: this.pain, immune: this.immune, effects: this.effects,
        stats: this.stats, timeAlive: this.timeAlive,
      };
    }
    deserialize(s) {
      if (!s) return;
      Object.assign(this, {
        hunger: s.hunger, thirst: s.thirst, stamina: s.stamina, temp: s.temp, wet: s.wet,
        infection: s.infection, bleed: s.bleed, sick: s.sick, fatigue: s.fatigue,
        pain: s.pain, immune: s.immune || 0, timeAlive: s.timeAlive || 0,
      });
      this.effects = s.effects || [];
      this.stats = Object.assign(this.stats, s.stats || {});
    }
  }

  GF.Inventory = Inventory;
  GF.Survival = Survival;
  GF.EQUIP_SLOTS = EQUIP_SLOTS;
  GF.EQUIP_NAME = EQUIP_NAME;
})(globalThis.GF = globalThis.GF || {});
