// 万世纪元 模拟引擎：时间、经济、科技、外交、战争、叛乱、继承、AI。
import { RNG, clamp, lerp } from './rng.js';
const DEG = Math.PI / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * DEG, dLon = (lon2 - lon1) * DEG;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
import { makeCharacter, chooseHeir, deathChance, spawnFamily, age, govSuccession, traitMod, TRAITS, charsOf, pruneChars } from './chars.js';
import { maleName, dynastyName } from './names.js';

/* ============ 历史科技轨道 ============ */
const TECH_ANCHOR_YEARS = [0, 400, 800, 1000, 1200, 1400, 1600];
export const TECH_CURVES = {
  mediterranean:   [8, 8, 7, 7, 8, 10, 13],
  western:         [3, 4, 5, 7, 10, 14, 22],
  eastern_orthodox:[7, 8, 8, 8, 9, 12, 16],
  muslim:          [4, 5, 8, 9, 11, 14, 18],
  chinese:         [8, 8, 9, 10, 12, 15, 20],
  indian:          [6, 6, 6, 7, 9, 12, 16],
  steppe:          [4, 4, 4, 5, 7, 8, 11],
  african:         [2, 2, 3, 4, 5, 6, 8],
  mesoamerican:    [2, 3, 3, 3, 4, 5, 7],
  andean:          [2, 3, 3, 3, 4, 5, 7],
  north_american:  [1, 1, 2, 2, 2, 3, 4],
  oceanic:         [0, 1, 1, 1, 2, 2, 3],
  siberian:        [1, 1, 2, 2, 3, 3, 4],
};
export function techTarget(year, group) {
  const c = TECH_CURVES[group] || TECH_CURVES.western;
  if (year <= TECH_ANCHOR_YEARS[0]) return c[0];
  for (let i = 1; i < TECH_ANCHOR_YEARS.length; i++) {
    if (year <= TECH_ANCHOR_YEARS[i]) {
      const t = (year - TECH_ANCHOR_YEARS[i - 1]) / (TECH_ANCHOR_YEARS[i] - TECH_ANCHOR_YEARS[i - 1]);
      return lerp(c[i - 1], c[i], t);
    }
  }
  return c[c.length - 1];
}

/* ============ 时间线取值 ============ */
export function timelineAt(tl, year) {
  if (!tl || !tl.length) return null;
  let v = tl[0][1];
  for (const [y, val] of tl) { if (y <= year) v = val; else break; }
  return v;
}
export function devAt(tl, year) {
  if (!tl || !tl.length) return 3;
  if (year <= tl[0][0]) return tl[0][1];
  for (let i = 1; i < tl.length; i++) {
    if (year <= tl[i][0]) {
      const t = (year - tl[i - 1][0]) / Math.max(1, tl[i][0] - tl[i - 1][0]);
      return lerp(tl[i - 1][1], tl[i][1], t);
    }
  }
  return tl[tl.length - 1][1];
}

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
export const RANK_ZH = { 1: '领', 2: '郡', 3: '公国', 4: '王国', 5: '帝国' };

/* ============ World ============ */
export class World {
  constructor(map, vocab) {
    this.map = map;
    this.vocab = vocab;
    this.provIds = Object.keys(map.provinces);
    this.log = [];
    this.wars = [];
    this.chars = new Map();
    this.charsByTag = new Map();
    this.chronicle = [];
    this.pol = new Map();
    this.prov = new Map();
    this.dead = [];
    this.year = 1; this.month = 0;
    this.endYear = 1600;
    this.player = null;
    this.rng = new RNG('imperium');
    this.stats = { polities: 0, wars: 0 };
    this.newPolCount = 0;
    this.mapVersion = 0;
  }

  /* ---- helpers ---- */
  cultureGroup(cid) {
    const c = this.map.cultures?.[cid];
    if (c) return c.group;
    if (this.vocab.cultureGroups[cid]) return cid;
    return 'other';
  }
  cultureName(cid) { return this.map.cultures?.[cid]?.zh || this.vocab.cultureGroups[cid]?.zh || cid; }
  religionName(rid) { return this.vocab.religions[rid]?.zh || rid; }
  religionGroup(rid) { return this.vocab.religions[rid]?.group || 'pagan'; }
  provDef(id) { return this.map.provinces[id]; }
  areaOf(id) { return this.map.provinces[id]?.area; }
  regionOf(id) { const a = this.areaOf(id); return a ? this.map.areas[a]?.region : null; }
  dateStr() { return `${this.year} 年 ${MONTH_NAMES[this.month]}`; }
  ruler(tag) { const p = this.pol.get(tag); return p ? this.chars.get(p.ruler) : null; }

  addLog(text, kind = 'info', tag = null) {
    this.log.push({ y: this.year, m: this.month, text, kind, tag });
    if (this.log.length > 900) this.log.splice(0, 300);
  }

  /* ---- 书签载入 ---- */
  loadBookmark(year, playerTag) {
    const bm = this.map.bookmarks[String(year)];
    if (!bm) throw new Error('no bookmark for year ' + year);
    this.year = year; this.month = 0;
    this.rng = new RNG('imperium.' + year);
    this.pol.clear(); this.chars.clear(); this.prov.clear();
    this.charsByTag.clear(); this.chronicle.length = 0;
    this.wars.length = 0; this.log.length = 0;

    // 省份运行时状态
    for (const id of this.provIds) {
      const d = this.map.provinces[id];
      this.prov.set(id, {
        id, owner: null, controller: null,
        dev: devAt(d.dev, year),
        culture: timelineAt(d.culture, year),
        religion: timelineAt(d.religion, year),
        unrest: 0, autonomy: 0.25, siege: 0, devastation: 0,
      });
    }

    // 政权
    for (const p of bm.polities) {
      const pol = {
        tag: p.tag, zh: p.zh, en: p.en, gov: p.gov, rank: p.rank, cap: p.cap,
        religion: p.religion, culture: p.culture, techGroup: p.tech_group,
        color: p.color || autoColor(p.tag),
        adm: p.adm, dip: p.dip, mil: p.mil,
        admPts: 0, dipPts: 0, milPts: 0,
        provs: new Set(), treasury: 0, income: 0, expense: 0,
        manpower: 0, maxManpower: 0, army: 0, navy: 0,
        stability: 0, legitimacy: 60, prestige: 0, corruption: 0, warExhaustion: 0,
        ruler: null, heir: null, dynasty: null,
        succession: govSuccession(p.gov),
        vassalOf: p.suzerain || null, vassals: new Set(p.vassal || []), tributaries: new Set(p.tributary || []),
        allies: new Set(), truces: new Map(), opinions: new Map(),
        aggression: 0.5, personality: null, desc: p.desc || '',
        alive: true, born: year, capitalLost: false,
      };
      this.pol.set(p.tag, pol);
    }
    // 疆域
    for (const p of bm.polities) {
      const pol = this.pol.get(p.tag);
      const add = id => {
        const st = this.prov.get(id);
        if (!st) return;
        if (st.owner) return; // 先到先得，后者不覆盖（数据应避免重叠）
        st.owner = p.tag; st.controller = p.tag;
        pol.provs.add(id);
      };
      for (const rid of p.own || []) for (const id of this.provIds) if (this.regionOf(id) === rid) add(id);
      for (const aid of p.ownArea || []) for (const id of this.provIds) if (this.areaOf(id) === aid) add(id);
      for (const pid of p.ownProv || []) add(pid);
      for (const pid of p.provs || []) add(pid);   // 构建器预解析的省份列表
    }
    // 角色
    for (const c of bm.characters || []) {
      const pol = this.pol.get(c.tag);
      if (!pol) continue;
      const ch = makeCharacter(this, {
        id: c.id, tag: c.tag, name: c.name, dyn: c.dyn, born: c.born,
        role: c.role, traits: c.traits || [], sex: c.sex || 'm',
        group: this.cultureGroup(pol.culture), rng: this.rng,
      });
      if (c.role === 'ruler') { pol.ruler = ch.id; pol.dynasty = ch.dyn; }
      else if (c.role === 'heir' && !pol.heir) pol.heir = ch.id;
    }
    // 补齐缺失统治者 + 家族 + 派生数值
    for (const pol of this.pol.values()) {
      if (!pol.ruler) {
        const ch = makeCharacter(this, { tag: pol.tag, role: 'ruler', group: this.cultureGroup(pol.culture), sex: 'm' });
        pol.ruler = ch.id; pol.dynasty = ch.dyn;
      }
      const r = this.chars.get(pol.ruler);
      pol.dynasty = pol.dynasty || r.dyn;
      spawnFamily(this, pol, r);
      if (!pol.heir || !this.chars.get(pol.heir)) pol.heir = chooseHeir(this, pol);
      pol.personality = this.rollPersonality(pol);
      pol.aggression = clamp(0.35 + traitMod(r.traits, 'aggr') + (pol.gov === 'nomadic' || pol.gov === 'khanate' ? 0.2 : 0) + this.rng.gauss(0, 0.12), 0.05, 1.1);
      this.recalc(pol);
      pol.treasury = Math.round(pol.income * this.rng.range(6, 24));
      pol.manpower = pol.maxManpower * this.rng.range(0.5, 1);
      pol.army = Math.round(pol.maxManpower * this.rng.range(0.25, 0.55) * 10) / 10;
      pol.navy = Math.round(this.coastalCount(pol) * this.rng.range(0.3, 1.2));
      pol.stability = this.rng.irange(-1, 2);
      pol.prestige = Math.round(this.rng.range(0, 60));
    }
    // 附庸双向
    for (const pol of this.pol.values()) {
      for (const v of pol.vassals) { const vp = this.pol.get(v); if (vp) vp.vassalOf = pol.tag; }
      for (const t of pol.tributaries) { const tp = this.pol.get(t); if (tp) tp.suzerainTribute = pol.tag; }
    }
    // 无主省份 → 无人政权（部落荒地）
    this.player = playerTag && this.pol.has(playerTag) ? playerTag : null;
    this.stats.polities = this.pol.size;
    this.addLog(`【${year} 年】世界共有 ${this.pol.size} 个政权。`, 'era');
    if (this.player) {
      const p = this.pol.get(this.player), r = this.chars.get(p.ruler);
      this.addLog(`你继承了${p.zh}，统治者${r.name}（${r.dyn}），治下 ${p.provs.size} 个省份。`, 'player');
    }
    return this;
  }

  rollPersonality(pol) {
    const kinds = [
      { id: 'conqueror', zh: '征服者', aggr: 0.3, dev: -0.05 },
      { id: 'administrator', zh: '守成者', aggr: -0.15, dev: 0.12 },
      { id: 'merchant', zh: '商贾', aggr: -0.1, income: 0.15 },
      { id: 'zealot', zh: '护教者', aggr: 0.15, convert: 0.2 },
      { id: 'diplomat', zh: '纵横家', aggr: -0.1, ally: 0.25 },
      { id: 'raider', zh: '掠夺者', aggr: 0.25, loot: 0.2 },
    ];
    return this.rng.pick(kinds);
  }

  coastalCount(pol) {
    let n = 0;
    for (const id of pol.provs) if (this.map.provinces[id]?.coast) n++;
    return n;
  }

  /* ---- 派生数值 ---- */
  recalc(pol) {
    const r = this.chars.get(pol.ruler);
    let taxBase = 0, manBase = 0, devSum = 0;
    for (const id of pol.provs) {
      const st = this.prov.get(id); if (!st) continue;
      const d = this.map.provinces[id];
      const terr = this.vocab.terrain[d.terrain]?.dev ?? 1;
      const sameRel = st.religion === pol.religion ? 1 : this.religionGroup(st.religion) === this.religionGroup(pol.religion) ? 0.92 : 0.8;
      const sameCul = st.culture === pol.culture ? 1 : this.cultureGroup(st.culture) === this.cultureGroup(pol.culture) ? 0.94 : 0.85;
      const eff = (1 - st.autonomy) * sameRel * sameCul * (1 - st.devastation * 0.5);
      taxBase += st.dev * terr * eff;
      manBase += st.dev * (0.9 + terr * 0.1) * eff;
      devSum += st.dev;
    }
    pol.devSum = devSum;
    const stw = r ? r.stats.stw : 4, dipS = r ? r.stats.dip : 4, mar = r ? r.stats.mar : 4;
    const admBonus = 1 + pol.adm * 0.02 + stw * 0.01 + traitMod(r?.traits || [], 'income');
    pol.income = Math.round(taxBase * 0.055 * admBonus * (1 - pol.corruption * 0.4) * 100) / 100;
    pol.maxManpower = Math.round(manBase * 0.22 * (1 + pol.mil * 0.015) * 10) / 10;
    pol.forceLimit = Math.round((pol.maxManpower * 1.25 + 1) * 10) / 10;
    pol.expense = Math.round((pol.army * 0.055 + pol.navy * 0.015 + Math.max(0.05, devSum * 0.004) + pol.provs.size * 0.005) * 100) / 100;
    pol.adminCap = Math.round((6 + pol.adm * 1.9 + stw * 1.2) * (pol.gov === 'administrative' || pol.gov === 'imperial' ? 1.6 : pol.gov === 'nomadic' ? 1.2 : 1));
    pol.quality = 1 + pol.mil * 0.045 + mar * 0.02;
    pol.power = pol.army * pol.quality + pol.devSum * 0.05;
  }

  /* ============ 每月推进 ============ */
  tick() {
    if (this.year >= this.endYear && this.month === 11) return false;
    this.month++;
    if (this.month > 11) { this.month = 0; this.year++; this.onNewYear(); }

    const polList = [...this.pol.values()].filter(p => p.alive);
    for (const pol of polList) this.recalc(pol);
    for (const pol of polList) this.economy(pol);
    for (const pol of polList) this.techTick(pol);
    this.provinceTick();
    this.charTick();
    this.warTick();
    // AI：每月只让一部分政权做决策，降低开销
    const slice = polList.filter(p => (hashTag(p.tag) + this.month + this.year * 12) % 4 === 0);
    for (const pol of slice) if (pol.tag !== this.player) this.aiTick(pol);
    this.diploTick(slice);
    return true;
  }

  onNewYear() {
    for (const pol of this.pol.values()) {
      if (!pol.alive) continue;
      pol.prestige = clamp(pol.prestige * 0.97 + (pol.stability > 0 ? 1 : -1), -200, 900);
      pol.legitimacy = clamp(pol.legitimacy + (pol.stability > 0 ? 0.6 : -0.4), 0, 100);
      if (pol.provs.size > pol.adminCap) pol.corruption = clamp(pol.corruption + 0.006 * (pol.provs.size / pol.adminCap - 1), 0, 0.6);
      else pol.corruption = clamp(pol.corruption - 0.004, 0, 0.6);
      pol.warExhaustion = clamp(pol.warExhaustion - (this.atWar(pol.tag) ? 0 : 0.6), 0, 20);
    }
    if (this.year % 100 === 0) this.addLog(`—— ${this.year} 年：世界现存 ${[...this.pol.values()].filter(p => p.alive).length} 个政权 ——`, 'era');
  }

  economy(pol) {
    const net = pol.income - pol.expense;
    pol.treasury = Math.round((pol.treasury + net) * 100) / 100;
    if (pol.treasury < 0) {
      // 破产：裁军 + 稳定下降
      pol.army = Math.max(0, Math.round(pol.army * 0.85 * 10) / 10);
      pol.treasury += 1;
      if (this.rng.chance(0.02)) { pol.stability = clamp(pol.stability - 1, -3, 3); }
    }
    // 人力
    pol.manpower = clamp(pol.manpower + pol.maxManpower * 0.022, 0, pol.maxManpower);
    // 补员
    if (pol.army < pol.forceLimit && pol.manpower > 0.2 && (this.atWar(pol.tag) || this.rng.chance(0.12))) {
      const want = Math.min(pol.forceLimit - pol.army, pol.manpower * 0.25, Math.max(0.2, pol.treasury * 0.5));
      if (want > 0.05) { pol.army += want; pol.manpower -= want; pol.treasury -= want * 0.5; }
    }
  }

  techTick(pol) {
    const r = this.chars.get(pol.ruler);
    const base = Math.sqrt(Math.max(1, pol.devSum)) * 0.05 * (1 - pol.corruption * 0.5);
    const adm = base * (1 + (r?.stats.stw ?? 4) * 0.03 + traitMod(r?.traits || [], 'adm'));
    const dip = base * (1 + (r?.stats.dip ?? 4) * 0.03 + traitMod(r?.traits || [], 'dipTech'));
    const mil = base * (1 + (r?.stats.mar ?? 4) * 0.03 + (this.atWar(pol.tag) ? 0.25 : 0));
    pol.admPts += adm; pol.dipPts += dip; pol.milPts += mil;
    const target = techTarget(this.year, pol.techGroup);
    for (const [k, pts] of [['adm', 'admPts'], ['dip', 'dipPts'], ['mil', 'milPts']]) {
      const lvl = pol[k];
      let cost = 24 + lvl * 16;
      if (lvl < target - 0.5) cost *= Math.max(0.18, 1 - 0.22 * (target - lvl));  // 追赶史实
      else if (lvl > target) cost *= Math.pow(2.3, lvl - target);                  // 超前代价指数上升
      if (pol[pts] >= cost) {
        pol[pts] -= cost; pol[k]++;
        if (pol.tag === this.player) this.addLog(`${pol.zh}的${k === 'adm' ? '行政' : k === 'dip' ? '外交' : '军事'}科技提升至 ${pol[k]} 级。`, 'tech', pol.tag);
      }
    }
  }

  provinceTick() {
    // 每月抽样一部分省份处理（性能）
    const n = this.provIds.length;
    const step = 12;
    const off = (this.year * 12 + this.month) % step;
    for (let i = off; i < n; i += step) {
      const id = this.provIds[i];
      const st = this.prov.get(id), d = this.map.provinces[id];
      if (!st) continue;
      // 历史发展轨道
      const target = devAt(d.dev, this.year);
      const owner = st.owner ? this.pol.get(st.owner) : null;
      let mod = 1;
      if (owner) {
        mod += owner.stability * 0.05 + (owner.adm - techTarget(this.year, owner.techGroup)) * 0.02;
        mod += traitMod(this.chars.get(owner.ruler)?.traits || [], 'devgrow');
        if (owner.personality?.dev) mod += owner.personality.dev;
      } else mod = 0.6;
      const cap = target * (1 + clamp(mod - 1, -0.3, 0.45));
      if (st.dev < cap) st.dev += Math.min(0.08, (cap - st.dev) * 0.02 + 0.002);
      else st.dev -= Math.min(0.05, (st.dev - cap) * 0.01);
      st.dev = clamp(st.dev, 1, 70);
      // 历史文化宗教轨道（未被外力改变时）
      const histCul = timelineAt(d.culture, this.year), histRel = timelineAt(d.religion, this.year);
      if (!st.forcedCulture && st.culture !== histCul) st.culture = histCul;
      if (!st.forcedReligion && st.religion !== histRel) st.religion = histRel;
      // 统治者主动改宗
      if (owner && st.religion !== owner.religion) {
        const zeal = 0.002 + traitMod(this.chars.get(owner.ruler)?.traits || [], 'piety') * 0.004 + (owner.personality?.convert || 0) * 0.01;
        if (this.rng.chance(zeal * (owner.adm / 20 + 0.4))) {
          st.religion = owner.religion; st.forcedReligion = true;
          st.unrest += 2;
          if (owner.tag === this.player) this.addLog(`${d.zh}改信${this.religionName(owner.religion)}。`, 'religion', owner.tag);
        }
      }
      // 动乱
      let unrest = 0;
      if (owner) {
        if (st.religion !== owner.religion) unrest += this.religionGroup(st.religion) === this.religionGroup(owner.religion) ? 0.6 : 1.6;
        if (st.culture !== owner.culture) unrest += this.cultureGroup(st.culture) === this.cultureGroup(owner.culture) ? 0.4 : 1.2;
        unrest += Math.max(0, owner.provs.size / owner.adminCap - 1) * 6;
        // 距离首都越远越难统治（历史上限制帝国规模的核心力量）
        const capD = this.map.provinces[owner.cap];
        if (capD && id !== owner.cap) {
          const km = haversine(d.lat, d.lon, capD.lat, capD.lon);
          const admin = owner.gov === 'administrative' || owner.gov === 'imperial' ? 0.7 : 1;
          unrest += clamp(km / 1400 - 0.4, 0, 4) * clamp(1 - owner.adm * 0.015 - owner.dip * 0.008, 0.5, 1) * admin;
        }
        unrest += owner.warExhaustion * 0.25 - owner.stability * 0.8;
        unrest += traitMod(this.chars.get(owner.ruler)?.traits || [], 'unrest') * 4;
        unrest -= (owner.legitimacy - 50) * 0.02;
        if (id === owner.cap) unrest -= 3;
      }
      st.unrest = clamp(st.unrest * 0.85 + unrest * 0.15, 0, 20);
      st.autonomy = clamp(st.autonomy + (st.unrest > 6 ? 0.004 : -0.002), 0.02, 0.9);
      st.devastation = clamp(st.devastation - 0.01, 0, 1);
      // 叛乱独立
      if (owner && st.unrest > 8 && this.rng.chance(0.02 + st.unrest * 0.004)) this.revolt(id, st, owner);
      // 无主之地：被邻邦拓殖，或自行形成部落政权
      if (!owner) this.frontierTick(id, st, d);
    }
  }

  revolt(id, st, owner) {
    const d = this.map.provinces[id];
    // 小国不因单省动乱而灭亡：只是自治度上升
    if (owner.provs.size <= 2) {
      st.autonomy = clamp(st.autonomy + 0.12, 0.02, 0.9);
      st.unrest = Math.max(0, st.unrest - 5);
      return;
    }
    const neighTags = new Set();
    for (const nb of d.neigh || []) {
      const ns = this.prov.get(nb);
      if (ns?.owner && ns.owner !== owner.tag) {
        const np = this.pol.get(ns.owner);
        if (np?.alive && (np.culture === st.culture || np.religion === st.religion)) neighTags.add(ns.owner);
      }
    }
    if (neighTags.size && this.rng.chance(0.45)) {
      const t = this.rng.pick([...neighTags]);
      this.transferProv(id, t);
      this.addLog(`${d.zh}的居民倒向${this.pol.get(t).zh}，脱离${owner.zh}。`, 'revolt', owner.tag);
    } else {
      const tag = this.newTag(st.culture);
      const zh = `${d.zh}${st.dev > 12 ? '公国' : '侯国'}`;
      const np = this.foundPolity(tag, zh, `${d.en} State`, st, d, owner);
      this.transferProv(id, tag);
      // 邻近同文化省份可能一同起义
      for (const nb of d.neigh || []) {
        const ns = this.prov.get(nb);
        if (ns?.owner === owner.tag && ns.culture === st.culture && this.rng.chance(0.35)) this.transferProv(nb, tag);
      }
      this.addLog(`${d.zh}起义成功，${zh}自${owner.zh}独立！`, 'revolt', owner.tag);
      np.stability = -1;
    }
    owner.stability = clamp(owner.stability - 1, -3, 3);
    st.unrest = 3;
  }

  /** 无主之地：拓殖与部落形成 —— 维持世界政权数量与真实的边疆推进 */
  frontierTick(id, st, d) {
    // 邻邦拓殖
    const claimants = [];
    for (const nb of d.neigh || []) {
      const ns = this.prov.get(nb);
      if (ns?.owner) { const p = this.pol.get(ns.owner); if (p?.alive) claimants.push(p); }
    }
    if (claimants.length) {
      const p = this.rng.pick(claimants);
      const easy = st.dev < 4 ? 1.6 : 1;
      if (p.provs.size < p.adminCap * 1.1 && this.rng.chance(0.006 * easy * (0.4 + p.adm / 24))) {
        this.transferProv(id, p.tag);
        st.autonomy = clamp(st.autonomy + 0.2, 0.05, 0.9);
        if (p.tag === this.player) this.addLog(`${d.zh}并入${p.zh}的疆域。`, 'diplo', p.tag);
        return;
      }
    }
    // 自行形成部落政权
    if (st.dev > 2.2 && this.rng.chance(0.0012)) {
      const tag = this.newTag(st.culture);
      const zh = `${d.zh}${st.dev > 8 ? '王国' : '部落'}`;
      const np = this.foundPolity(tag, zh, `${d.en} Tribe`, st, d, null);
      np.gov = 'tribal'; np.rank = st.dev > 8 ? 4 : 2;
      np.techGroup = this.frontierTechGroup(d);
      this.transferProv(id, tag);
      for (const nb of d.neigh || []) {
        const ns = this.prov.get(nb);
        if (ns && !ns.owner && ns.culture === st.culture && this.rng.chance(0.5)) this.transferProv(nb, tag);
      }
    }
  }

  frontierTechGroup(d) {
    switch (d.cont) {
      case 'america': return d.lat > 15 ? 'north_american' : d.lat > -10 ? 'mesoamerican' : 'andean';
      case 'oceania': return 'oceanic';
      case 'africa': return 'african';
      case 'easia': return d.lat > 50 ? 'siberian' : 'chinese';
      case 'wasia': return 'muslim';
      default: return d.lat > 55 ? 'siberian' : 'steppe';
    }
  }

  newTag(culture) {
    const base = (culture || 'x').slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'X');
    let t;
    do { t = base + (this.newPolCount++ % 10) + String.fromCharCode(65 + this.rng.int(26)); } while (this.pol.has(t));
    return t;
  }

  foundPolity(tag, zh, en, st, d, parent) {
    const pol = {
      tag, zh, en, gov: parent ? (parent.gov === 'imperial' ? 'feudal' : parent.gov) : 'tribal',
      rank: 3, cap: d.id, religion: st.religion, culture: st.culture,
      techGroup: parent ? parent.techGroup : 'western',
      color: autoColor(tag),
      adm: Math.max(0, (parent?.adm ?? 3) - 1), dip: Math.max(0, (parent?.dip ?? 3) - 1), mil: Math.max(0, (parent?.mil ?? 3) - 1),
      admPts: 0, dipPts: 0, milPts: 0,
      provs: new Set(), treasury: 5, income: 0, expense: 0,
      manpower: 0, maxManpower: 0, army: 0, navy: 0,
      stability: 0, legitimacy: 40, prestige: 0, corruption: 0, warExhaustion: 0,
      ruler: null, heir: null, dynasty: null,
      succession: govSuccession(parent?.gov || 'tribal'),
      vassalOf: null, vassals: new Set(), tributaries: new Set(),
      allies: new Set(), truces: new Map(), opinions: new Map(),
      aggression: clamp(0.5 + this.rng.gauss(0, 0.15), 0.1, 1),
      personality: null, desc: '起于动乱之中', alive: true, born: this.year,
    };
    this.pol.set(tag, pol);
    const ch = makeCharacter(this, { tag, role: 'ruler', group: this.cultureGroup(st.culture), sex: 'm' });
    pol.ruler = ch.id; pol.dynasty = ch.dyn;
    spawnFamily(this, pol, ch);
    pol.heir = chooseHeir(this, pol);
    pol.personality = this.rollPersonality(pol);
    this.recalc(pol);
    pol.army = 1 + Math.round(pol.maxManpower * 0.3 * 10) / 10;
    return pol;
  }

  transferProv(id, toTag) {
    this.mapVersion++;
    const st = this.prov.get(id);
    if (!st) return;
    if (st.owner) {
      const old = this.pol.get(st.owner);
      if (old) {
        old.provs.delete(id);
        if (old.provs.size === 0) this.destroyPolity(old);
        else if (old.cap === id) { old.cap = [...old.provs][0]; old.capitalLost = true; old.legitimacy -= 10; }
      }
    }
    st.owner = toTag; st.controller = toTag;
    st.autonomy = clamp(st.autonomy + 0.15, 0.05, 0.9);
    st.unrest += 2;
    const np = this.pol.get(toTag);
    if (np) np.provs.add(id);
  }

  destroyPolity(pol) {
    this.mapVersion++;
    pol.alive = false;
    for (const p of this.pol.values()) {
      p.allies.delete(pol.tag); p.vassals.delete(pol.tag); p.tributaries.delete(pol.tag);
      if (p.vassalOf === pol.tag) p.vassalOf = null;
    }
    // 回收该政权全部角色，避免长期运行时活跃角色无限膨胀
    const idx = this.charsByTag.get(pol.tag);
    if (idx) { for (const id of idx) this.chars.delete(id); this.charsByTag.delete(pol.tag); }
    this.pol.delete(pol.tag);
    this.addLog(`${pol.zh}灭亡。`, 'death', pol.tag);
    if (pol.tag === this.player) this.addLog('你的政权已经覆灭——但历史仍在继续。', 'player');
  }

  /* ---- 角色 ---- */
  charTick() {
    const pruneSlot = (this.year * 12 + this.month) % 12;
    for (const pol of this.pol.values()) {
      if (!pol.alive) continue;
      const r = this.chars.get(pol.ruler);
      if (!r) { pol.ruler = chooseHeir(this, pol) || makeCharacter(this, { tag: pol.tag, role: 'ruler', group: this.cultureGroup(pol.culture) }).id; continue; }
      // 生育
      if (r.spouse && this.rng.chance(0.012 * (1 + traitMod(r.traits, 'fert')))) {
        const kid = makeCharacter(this, { tag: pol.tag, role: 'courtier', parent: r.id, dyn: r.dyn, born: this.year, group: r.group });
        r.children.push(kid.id);
      }
      // 死亡
      if (this.rng.chance(deathChance(r, this.year, this.rng))) this.rulerDeath(pol, r);
      else if (!pol.heir || !this.chars.get(pol.heir) || this.chars.get(pol.heir).died) pol.heir = chooseHeir(this, pol);
      // 角色回收（每年为每个政权做一次，摊到 12 个月）
      if (hashTag(pol.tag) % 12 === pruneSlot) pruneChars(this, pol);
    }
  }

  rulerDeath(pol, r) {
    r.died = this.year;
    this.chronicle.push({ tag: pol.tag, name: r.name, dyn: r.dyn, born: r.born, died: this.year });
    if (this.chronicle.length > 4000) this.chronicle.splice(0, 1500);
    const heirId = pol.heir && this.chars.get(pol.heir) && !this.chars.get(pol.heir).died ? pol.heir : chooseHeir(this, pol);
    let heir = heirId ? this.chars.get(heirId) : null;
    if (!heir) {
      heir = makeCharacter(this, { tag: pol.tag, role: 'ruler', group: this.cultureGroup(pol.culture), sex: 'm' });
      pol.legitimacy = clamp(pol.legitimacy - 25, 0, 100);
      pol.dynasty = heir.dyn;
      this.addLog(`${pol.zh}绝嗣，${heir.name}（${heir.dyn}）夺取权力。`, 'succession', pol.tag);
    } else {
      const dynChange = heir.dyn !== pol.dynasty;
      pol.dynasty = heir.dyn;
      this.addLog(`${pol.zh}的${r.name}逝世（享年${age(r, this.year)}），${heir.name}继位${dynChange ? '（王朝更替）' : ''}。`, 'succession', pol.tag);
      if (dynChange) pol.legitimacy = clamp(pol.legitimacy - 15, 0, 100);
    }
    heir.role = 'ruler';
    pol.ruler = heir.id;
    pol.heir = chooseHeir(this, pol);
    spawnFamily(this, pol, heir);
    pol.aggression = clamp(0.35 + traitMod(heir.traits, 'aggr') + this.rng.gauss(0, 0.12), 0.05, 1.1);
    // 分割继承 → 分裂
    if (pol.succession === 'partition' && pol.provs.size > 6) {
      const sibs = charsOf(this, pol.tag).filter(c => c.parent === r.id && c.id !== heir.id);
      if (sibs.length) {
        const shares = Math.min(sibs.length, 3);
        const list = [...pol.provs];
        for (let i = 0; i < shares; i++) {
          const take = list.slice(Math.floor((i + 1) * list.length / (shares + 1)), Math.floor((i + 2) * list.length / (shares + 1)));
          if (take.length < 2) continue;
          const st = this.prov.get(take[0]);
          const tag = this.newTag(pol.culture);
          const np = this.foundPolity(tag, `${pol.zh}·${this.map.provinces[take[0]].zh}分邦`, pol.en + ' Partition', st, this.map.provinces[take[0]], pol);
          np.ruler = sibs[i].id; sibs[i].role = 'ruler'; sibs[i].tag = tag;
          for (const pid of take) this.transferProv(pid, tag);
          np.vassalOf = pol.tag; pol.vassals.add(tag);
        }
        this.addLog(`${pol.zh}按分割继承法析为数邦。`, 'succession', pol.tag);
      }
    }
    // 大国继承分裂：概率取决于继承法与政体（官僚帝国稳固，部落/游牧/分割继承易崩解）
    const fragBase = pol.succession === 'partition' ? 0.38
      : pol.gov === 'nomadic' || pol.gov === 'khanate' ? 0.30
      : pol.gov === 'tribal' || pol.gov === 'clan' ? 0.24
      : pol.gov === 'administrative' || pol.gov === 'imperial' ? 0.05
      : pol.succession === 'elective' || pol.succession === 'tanistry' ? 0.18
      : 0.10;
    const fragChance = fragBase * (pol.legitimacy < 55 ? 1.5 : 1) * (pol.stability < 0 ? 1.4 : 1);
    if (pol.provs.size > pol.adminCap * 0.9 && pol.provs.size > 8 && this.rng.chance(fragChance)) {
      const list = [...pol.provs].filter(id => id !== pol.cap);
      const capD = this.map.provinces[pol.cap];
      list.sort((a, b) => haversine(this.map.provinces[b].lat, this.map.provinces[b].lon, capD.lat, capD.lon)
                        - haversine(this.map.provinces[a].lat, this.map.provinces[a].lon, capD.lat, capD.lon));
      const take = list.slice(0, Math.max(2, Math.floor(list.length * this.rng.range(0.15, 0.4))));
      const seed = take[0];
      const st0 = this.prov.get(seed);
      const tag = this.newTag(st0.culture);
      const zh = `${this.map.provinces[seed].zh}${pol.rank >= 5 ? '王国' : '公国'}`;
      const np = this.foundPolity(tag, zh, this.map.provinces[seed].en + ' Realm', st0, this.map.provinces[seed], pol);
      for (const pid of take) this.transferProv(pid, tag);
      np.rank = Math.max(3, pol.rank - 1);
      this.addLog(`${pol.zh}君主更替之际，边远诸省拥立${zh}自立。`, 'revolt', pol.tag);
      pol.stability = clamp(pol.stability - 1, -3, 3);
    }
    // 继承危机
    if (this.rng.chance(0.12)) {      pol.stability = clamp(pol.stability - 1, -3, 3);
      const claimant = charsOf(this, pol.tag).find(c => c.id !== heir.id && age(c, this.year) > 16);
      if (claimant && this.rng.chance(0.35) && pol.provs.size > 3) {
        const list = [...pol.provs];
        const pid = list[list.length - 1];
        const tag = this.newTag(pol.culture);
        const np = this.foundPolity(tag, `${pol.zh}僭主政权`, pol.en + ' Pretender', this.prov.get(pid), this.map.provinces[pid], pol);
        np.ruler = claimant.id; claimant.role = 'ruler'; claimant.tag = tag;
        this.transferProv(pid, tag);
        this.declareWar(tag, pol.tag, '王位争夺');
        this.addLog(`${claimant.name}宣称${pol.zh}的王位，内战爆发！`, 'war', pol.tag);
      }
    }
  }

  /* ---- 外交 ---- */
  atWar(tag) { return this.wars.some(w => w.att.has(tag) || w.def.has(tag)); }
  warBetween(a, b) { return this.wars.find(w => (w.att.has(a) && w.def.has(b)) || (w.att.has(b) && w.def.has(a))); }

  neighborsOf(tag) {
    const pol = this.pol.get(tag);
    const out = new Map();
    for (const id of pol.provs) {
      for (const nb of this.map.provinces[id]?.neigh || []) {
        const o = this.prov.get(nb)?.owner;
        if (o && o !== tag) out.set(o, (out.get(o) || 0) + 1);
      }
    }
    return out;
  }

  declareWar(attTag, defTag, cb = '领土争端') {
    if (this.warBetween(attTag, defTag)) return null;
    const att = this.pol.get(attTag), def = this.pol.get(defTag);
    if (!att?.alive || !def?.alive) return null;
    const w = {
      id: 'w' + (this.wars.length + 1) + '_' + this.year,
      att: new Set([attTag]), def: new Set([defTag]),
      leadAtt: attTag, leadDef: defTag,
      score: 0, started: this.year, cb,
      occupied: new Map(), // provId -> occupying side ('att'|'def')
      battles: 0, lastBattle: 0,
    };
    for (const a of att.allies) if (this.pol.get(a)?.alive && this.rng.chance(0.7)) w.att.add(a);
    for (const a of def.allies) if (this.pol.get(a)?.alive && this.rng.chance(0.85)) w.def.add(a);
    for (const v of def.vassals) if (this.pol.get(v)?.alive) w.def.add(v);
    for (const v of att.vassals) if (this.pol.get(v)?.alive) w.att.add(v);
    this.wars.push(w);
    this.stats.wars = (this.stats.wars || 0) + 1;
    this.addLog(`${att.zh}以「${cb}」为由向${def.zh}宣战。`, 'war', attTag);
    return w;
  }

  sidePower(w, side) {
    let p = 0;
    for (const t of w[side]) { const pol = this.pol.get(t); if (pol?.alive) p += pol.army * pol.quality; }
    return p;
  }

  warTick() {
    for (let i = this.wars.length - 1; i >= 0; i--) {
      const w = this.wars[i];
      for (const s of ['att', 'def']) for (const t of [...w[s]]) if (!this.pol.get(t)?.alive) w[s].delete(t);
      if (!w.att.size || !w.def.size) { this.wars.splice(i, 1); continue; }
      const pa = this.sidePower(w, 'att'), pd = this.sidePower(w, 'def');
      // 战斗
      if (pa > 0.5 && pd > 0.5 && this.rng.chance(0.22)) {
        const ratio = pa / (pa + pd);
        const attWins = this.rng.chance(ratio * 0.9 + 0.05);
        const lossA = pa * this.rng.range(0.02, 0.09) * (attWins ? 0.6 : 1.4);
        const lossD = pd * this.rng.range(0.02, 0.09) * (attWins ? 1.4 : 0.6);
        this.applyLoss(w, 'att', lossA); this.applyLoss(w, 'def', lossD);
        w.score += attWins ? this.rng.range(2, 7) : -this.rng.range(2, 7);
        w.battles++;
        for (const t of [...w.att, ...w.def]) { const p = this.pol.get(t); if (p) p.warExhaustion = clamp(p.warExhaustion + 0.15, 0, 20); }
        if (w.att.has(this.player) || w.def.has(this.player)) {
          const me = w.att.has(this.player) ? 'att' : 'def';
          const win = (me === 'att') === attWins;
          this.addLog(`${win ? '我军' : '敌军'}在前线获胜（${this.pol.get(w.leadAtt).zh} vs ${this.pol.get(w.leadDef).zh}）。`, 'war');
        }
      }
      // 围城/占领
      const strong = pa > pd * 1.15 ? 'att' : pd > pa * 1.15 ? 'def' : null;
      if (strong && this.rng.chance(0.30)) {
        const other = strong === 'att' ? 'def' : 'att';
        const target = this.pickSiegeTarget(w, strong, other);
        if (target) {
          w.occupied.set(target, strong);
          const st = this.prov.get(target);
          st.controller = [...w[strong]][0];
          st.devastation = clamp(st.devastation + 0.25, 0, 1);
          w.score += (strong === 'att' ? 1 : -1) * clamp(st.dev * 0.5, 1, 8);
        }
      }
      w.score = clamp(w.score, -100, 100);
      // 和平
      const dur = this.year - w.started;
      const loserSide = w.score > 25 ? 'def' : w.score < -25 ? 'att' : null;
      const exhaust = [...w.att, ...w.def].reduce((a, t) => a + (this.pol.get(t)?.warExhaustion || 0), 0) / Math.max(1, w.att.size + w.def.size);
      if (loserSide && (this.rng.chance(0.04 + Math.abs(w.score) * 0.0015 + dur * 0.004) || exhaust > 12)) {
        this.makePeace(w, loserSide === 'def' ? 'att' : 'def');
        this.wars.splice(i, 1);
      } else if (dur > 12 && this.rng.chance(0.05)) {
        this.makePeace(w, null); // 白和
        this.wars.splice(i, 1);
      }
    }
  }

  applyLoss(w, side, loss) {
    const list = [...w[side]].map(t => this.pol.get(t)).filter(p => p?.alive && p.army > 0);
    const total = list.reduce((a, p) => a + p.army, 0) || 1;
    for (const p of list) p.army = Math.max(0, Math.round((p.army - loss * (p.army / total) / Math.max(0.5, p.quality)) * 10) / 10);
  }

  pickSiegeTarget(w, strongSide, weakSide) {
    const attackers = [...w[strongSide]];
    const defenders = new Set(w[weakSide]);
    const cands = [];
    for (const t of attackers) {
      const pol = this.pol.get(t); if (!pol) continue;
      for (const id of pol.provs) {
        for (const nb of this.map.provinces[id]?.neigh || []) {
          const st = this.prov.get(nb);
          if (st && defenders.has(st.owner) && !w.occupied.has(nb)) cands.push(nb);
        }
      }
    }
    if (!cands.length) {
      // 无接壤：海外远征（低概率）
      for (const t of defenders) {
        const pol = this.pol.get(t); if (!pol) continue;
        for (const id of pol.provs) if (!w.occupied.has(id) && this.map.provinces[id]?.coast && this.rng.chance(0.05)) cands.push(id);
      }
    }
    return cands.length ? this.rng.pick(cands) : null;
  }

  makePeace(w, winnerSide) {
    const attLead = this.pol.get(w.leadAtt), defLead = this.pol.get(w.leadDef);
    if (!winnerSide) {
      this.addLog(`${attLead?.zh ?? '?'}与${defLead?.zh ?? '?'}签订白和。`, 'peace');
    } else {
      const winner = this.pol.get(winnerSide === 'att' ? w.leadAtt : w.leadDef);
      const loserTags = new Set(winnerSide === 'att' ? w.def : w.att);
      let gained = 0;
      // 每个败方最多割让 ~35% 省份，且至少保留 1 省（残存国家继续存在，避免世界被吞并成几个巨块）
      const quota = new Map();
      for (const t of loserTags) {
        const l = this.pol.get(t);
        if (l) quota.set(t, Math.max(0, Math.min(l.provs.size - 1, Math.floor(l.provs.size * 0.35 + Math.abs(w.score) / 60))));
      }
      for (const [pid, side] of w.occupied) {
        if (side !== winnerSide) continue;
        const st = this.prov.get(pid);
        if (!st || !loserTags.has(st.owner) || !winner?.alive) continue;
        const q = quota.get(st.owner) || 0;
        if (q <= 0) continue;
        quota.set(st.owner, q - 1);
        this.transferProv(pid, winner.tag); gained++;
      }
      // 赔款与威望
      for (const t of loserTags) {
        const l = this.pol.get(t); if (!l) continue;
        const tribute = Math.min(l.treasury * 0.4, 50);
        l.treasury -= tribute; if (winner) winner.treasury += tribute;
        l.prestige -= 20; l.stability = clamp(l.stability - 1, -3, 3);
      }
      if (winner) { winner.prestige += 25 + gained * 5; }
      this.addLog(`${winner?.zh ?? '?'}战胜，割取 ${gained} 省。`, 'peace', winner?.tag);
      // 附庸化：大胜且体量差距悬殊
      const loserLead = this.pol.get(winnerSide === 'att' ? w.leadDef : w.leadAtt);
      if (winner && loserLead?.alive && loserLead.provs.size && winner.devSum > loserLead.devSum * 3 && winner.vassals.size < 5 && this.rng.chance(0.25)) {
        loserLead.vassalOf = winner.tag; winner.vassals.add(loserLead.tag);
        this.addLog(`${loserLead.zh}成为${winner.zh}的附庸。`, 'diplo', winner.tag);
      }
    }
    // 恢复控制、停战协议
    for (const [pid] of w.occupied) { const st = this.prov.get(pid); if (st) st.controller = st.owner; }
    const all = [...w.att, ...w.def];
    for (const a of w.att) for (const d of w.def) {
      this.pol.get(a)?.truces.set(d, this.year + 5);
      this.pol.get(d)?.truces.set(a, this.year + 5);
    }
    for (const t of all) { const p = this.pol.get(t); if (p) p.warExhaustion = clamp(p.warExhaustion * 0.5, 0, 20); }
  }

  /* ---- AI ---- */
  aiTick(pol) {
    if (!pol.alive || pol.vassalOf) return;
    const r = this.chars.get(pol.ruler);
    // 战争决策
    if (!this.atWar(pol.tag) && pol.army > pol.forceLimit * 0.5 && pol.stability > -2) {
      const neigh = this.neighborsOf(pol.tag);
      let best = null, bestScore = 0;
      for (const [t, borders] of neigh) {
        const target = this.pol.get(t);
        if (!target?.alive || target.tag === pol.vassalOf || pol.vassals.has(t) || pol.allies.has(t)) continue;
        if ((pol.truces.get(t) || 0) > this.year) continue;
        if (this.atWar(t)) { /* 趁虚而入加分 */ }
        const myP = pol.army * pol.quality, itsP = target.army * target.quality + (this.atWar(t) ? -target.army * 0.3 : 0);
        let s = (myP + 1) / (itsP + 1);
        s *= 1 + borders * 0.04;
        if (target.religion !== pol.religion) s *= 1.25;
        if (this.religionGroup(target.religion) !== this.religionGroup(pol.religion)) s *= 1.2;
        if (target.devSum > pol.devSum * 2) s *= 0.4;
        s *= 0.6 + pol.aggression;
        if (s > bestScore) { bestScore = s; best = t; }
      }
      if (best && bestScore > 1.15 && this.rng.chance(0.09 * pol.aggression)) {
        this.declareWar(pol.tag, best, this.rng.pick(['领土争端', '边境冲突', '宿怨', '宗教战争', '继承权主张', '朝贡纠纷']));
      }
    }
    // 内政
    if (pol.stability < 2 && pol.treasury > 30 && this.rng.chance(0.1)) { pol.treasury -= 25; pol.stability = clamp(pol.stability + 1, -3, 3); }
    // 分封（缓解超额；历史上的封建化）
    if (pol.provs.size > pol.adminCap * 1.05 && pol.rank >= 3 && pol.vassals.size < 10 && this.rng.chance(0.06)) {
      const list = [...pol.provs].filter(id => id !== pol.cap);
      if (list.length > 3) {
        const pid = list[this.rng.int(list.length)];
        const st = this.prov.get(pid);
        const tag = this.newTag(st.culture);
        const np = this.foundPolity(tag, `${this.map.provinces[pid].zh}封国`, this.map.provinces[pid].en + ' Fief', st, this.map.provinces[pid], pol);
        this.transferProv(pid, tag);
        // 相邻同文化省一并封出
        for (const nb of this.map.provinces[pid].neigh || []) {
          const ns = this.prov.get(nb);
          if (ns?.owner === pol.tag && nb !== pol.cap && this.rng.chance(0.4)) this.transferProv(nb, tag);
        }
        np.vassalOf = pol.tag; pol.vassals.add(tag);
      }
    }
    // 削藩：行政能力足够时吞并附庸（历史上的中央集权）
    if (pol.vassals.size && this.rng.chance(0.004 + pol.adm * 0.0004)) {
      const vt = this.rng.pick([...pol.vassals]);
      const v = this.pol.get(vt);
      if (v?.alive && v.provs.size && v.provs.size <= 2 && pol.provs.size + v.provs.size <= pol.adminCap && v.army * v.quality < pol.army * pol.quality * 0.5) {
        for (const pid of [...v.provs]) this.transferProv(pid, pol.tag);
        pol.vassals.delete(vt);
        this.addLog(`${pol.zh}削藩，${v.zh}的领地被并入。`, 'diplo', pol.tag);
      }
    }
  }

  diploTick(slice) {
    for (const pol of slice) {
      if (!pol.alive) continue;
      // 结盟
      if (pol.allies.size < 2 + Math.floor(pol.dip / 6) && this.rng.chance(0.08 + (pol.personality?.ally || 0))) {
        const neigh = [...this.neighborsOf(pol.tag).keys()];
        const cands = [];
        for (const t of neigh) for (const nb of this.neighborsOf(t).keys()) if (nb !== pol.tag) cands.push(nb);
        const pick = this.rng.pick([...neigh, ...cands].filter(t => {
          const o = this.pol.get(t);
          return o?.alive && !pol.allies.has(t) && !this.warBetween(pol.tag, t) && o.religion === pol.religion && !o.vassalOf;
        }) || []);
        if (pick) { pol.allies.add(pick); this.pol.get(pick).allies.add(pol.tag); }
      }
      // 附庸独立倾向
      if (pol.vassalOf) {
        const lord = this.pol.get(pol.vassalOf);
        if (!lord?.alive) pol.vassalOf = null;
        else if (this.rng.chance(0.02) && (pol.army * pol.quality > lord.army * lord.quality * 0.8 || lord.stability < 0 || lord.warExhaustion > 6)) {
          lord.vassals.delete(pol.tag); pol.vassalOf = null;
          this.declareWar(pol.tag, lord.tag, '独立战争');
          this.addLog(`${pol.zh}起兵反抗宗主${lord.zh}。`, 'war', pol.tag);
        }
      }
    }
  }

  /* ---- 查询 ---- */
  aliveCount() { let n = 0; for (const p of this.pol.values()) if (p.alive) n++; return n; }
  ranking() {
    return [...this.pol.values()].filter(p => p.alive)
      .map(p => ({ tag: p.tag, zh: p.zh, dev: Math.round(p.devSum), provs: p.provs.size, army: p.army, tech: p.adm + p.dip + p.mil }))
      .sort((a, b) => b.dev - a.dev);
  }
}

function hashTag(t) { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h); }
export function autoColor(tag) {
  const h = hashTag(tag);
  const hue = h % 360, sat = 45 + (h >> 8) % 35, light = 38 + (h >> 16) % 22;
  return hslToHex(hue, sat, light);
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
}
