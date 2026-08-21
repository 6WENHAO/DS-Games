/* ============================================================================
 * engine.js —— 「抵抗之弧 2026」推演内核（纯逻辑，可在 Node 中批量对局测试）
 *   回合 = 7 天；阶段：情报 → 下达指令 → 结算 → 政治 → 判定
 *   核心机制：饱和齐射消耗拦截弹、深埋目标需钻地弹、政治红线锁死谈判上限
 * ==========================================================================*/
(function (root, factory) {
  const S = (typeof module !== 'undefined' && typeof require === 'function')
    ? require('./scenario.js') : root.SCENARIO;
  const api = factory(S);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ENGINE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (S) {
  'use strict';

  /* ------------------------------------------------------------ 随机数 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ------------------------------------------------------------ 六角地图 */
  function parseMap() {
    const hexes = [], byKey = new Map();
    S.MAP_ROWS.forEach((row, r) => {
      row.trim().split(/\s+/).forEach((cell, c) => {
        if (cell === '--') return;
        const t = cell[0], n = cell[1];
        const h = { c, r, t, n, key: c + ',' + r, terrain: S.TERRAIN[t], nation: S.NATION[n] };
        hexes.push(h); byKey.set(h.key, h);
      });
    });
    return { hexes, byKey };
  }
  const MAP = parseMap();
  function cube(c, r) { const x = c - ((r - (r & 1)) >> 1); return { x, z: r, y: -x - r }; }
  function hexDist(a, b) {
    const A = cube(a.c, a.r), B = cube(b.c, b.r);
    return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y), Math.abs(A.z - B.z));
  }

  /* ------------------------------------------------------------ 建立对局 */
  function createGame(opts) {
    opts = opts || {};
    const seed = opts.seed === undefined ? (Math.random() * 1e9) | 0 : opts.seed;
    const st = {
      seed, rng: mulberry32(seed),
      turn: 1, phase: 'orders', playerSide: opts.playerSide || 'blue',
      meters: Object.assign({}, S.METERS),
      flags: {},                       // {blueHalt:2, blueSurge:1, redHeuDeal:99}
      units: S.UNITS.map(u => Object.assign({
        status: 'ready', readiness: 88, dead: false, order: null, maxHp: u.hp, hp: u.hp,
        maxAmmo: u.ammo, hidden: false
      }, u)),
      sites: S.SITES.map(s => Object.assign({ dmg: 0 }, s)),
      log: [], timeline: [], over: null, escP: 0, escQ: 0,
      stat: { turnsPlayed: 0, blueStrikes: 0, redStrikes: 0, interceptsUsed: 0, sitesHit: 0 }
    };
    st.byId = id => st.units.find(u => u.id === id);
    st.siteById = id => st.sites.find(s => s.id === id);
    pushLog(st, `推演开始：${S.meta.dateISO}（战争第 ${S.meta.warDay} 天）。回合 = ${S.meta.turnDays} 天，共 ${S.meta.maxTurns} 回合。`, 'sys');
    return st;
  }
  function pushLog(st, text, tone) {
    st.log.push({ turn: st.turn, text, tone: tone || 'info' });
    if (st.log.length > 400) st.log.shift();
  }

  /* ------------------------------------------------------------ 指标读写 */
  const RANGE = {
    esc: [0, 9], heu: [0, 100], hormuz: [0, 100], mandab: [0, 100], oil: [55, 220],
    intercept: [0, 100], usWill: [0, 100], irCohesion: [0, 100], arabTilt: [-100, 100],
    talks: [0, 100], civ: [0, 100], ilMorale: [0, 100], redMissiles: [0, 100]
  };
  function addMeter(st, key, d) {
    if (!d) return;
    const [lo, hi] = RANGE[key] || [0, 100];
    let v = st.meters[key] + d;
    if (key === 'talks') v = Math.min(v, talksCap(st));
    st.meters[key] = clamp(Math.round(v * 10) / 10, lo, hi);
    st.timeline.push({ t: 'meter', key, delta: d, value: st.meters[key] });
  }
  // 结构性僵局：谈判上限被双方红线锁死（公开报道的"高浓铀接收机制 vs 彻底终战"）
  function talksCap(st) {
    let cap = 45;
    if (st.flags.blueHalt) cap += 20;      // 蓝方承诺停止深度打击 → 满足伊朗"停止侵略"要求
    if (st.flags.redHeuDeal) cap += 20;    // 红方接受高浓铀移交机制 → 满足美方核心要求
    if (st.meters.arabTilt > 20) cap += 8;
    if (st.meters.esc >= 9) cap -= 15;
    return clamp(cap, 10, 100);
  }

  /* ------------------------------------------------------------ 指令合法性 */
  const ORDER_DEF = {
    strike: { name: '精确打击', for: ['air', 'bmb', 'msl', 'uav', 'nav'], needTarget: 1, esc: 0 },
    salvo: { name: '饱和齐射', for: ['msl', 'uav'], needTarget: 1, esc: 1, desc: '弹量×1.7、精度下降，重点消耗对方拦截弹' },
    sead: { name: '压制防空(SEAD)', for: ['air', 'bmb'], needTarget: 1, esc: 0, desc: '本回合削弱目标区域防空 40%' },
    mine: { name: '布雷/海上封锁', for: ['nav'], needTarget: 1, esc: 1, desc: '降低海峡通航率' },
    escort: { name: '护航/扫雷', for: ['nav'], needTarget: 1, esc: 0, desc: '提高海峡通航率' },
    raid: { name: '地面突袭', for: ['grd'], needTarget: 1, esc: 0 },
    cyber: { name: '网络攻击', for: ['cyb'], needTarget: 1, esc: 0, desc: '削弱目标单位战备与防空' },
    sabotage: { name: '破袭/暗杀', for: ['cyb'], needTarget: 1, esc: 1, desc: '直接破坏要点，无视部分防空' },
    defend: { name: '强化防空', for: ['ad', 'nav', 'air'], needTarget: 0, esc: 0, desc: '本回合本方防空 +35%' },
    repair: { name: '抢修/加固', for: ['grd'], needTarget: 1, esc: 0, desc: '修复要点损伤（工程部队）' },
    rearm: { name: '补给整备', for: ['air', 'bmb', 'msl', 'uav', 'nav', 'grd', 'cyb'], needTarget: 0, esc: 0 },
    move: { name: '转场/机动', for: ['air', 'bmb', 'msl', 'uav', 'nav', 'grd', 'cyb', 'ad'], needTarget: 1, esc: 0, desc: '移动到射程更好的位置（海军只能走海域）' },
    hold: { name: '待机隐蔽', for: ['air', 'bmb', 'msl', 'uav', 'nav', 'grd', 'cyb', 'ad'], needTarget: 0, esc: 0 }
  };
  function unitActive(u) { return !u.dead && u.hp > 0; }
  function orderTypesFor(st, u) {
    if (!unitActive(u)) return [];
    const out = [];
    for (const k in ORDER_DEF) {
      const d = ORDER_DEF[k];
      if (d.for.indexOf(u.type) < 0) continue;
      if (k === 'repair' && !u.repair) continue;
      if (k === 'mine' && !u.mine) continue;
      if (k === 'escort' && u.side !== 'blue') continue;
      if (k === 'move' && u.type === 'bmb') continue;
      if ((k === 'strike' || k === 'salvo' || k === 'sead' || k === 'sabotage' || k === 'raid') && u.ammo <= 0) continue;
      if (u.side === 'blue' && st.flags.blueHalt && (k === 'strike' || k === 'salvo' || k === 'sabotage') && u.type === 'bmb') continue;
      out.push(Object.assign({ key: k }, d));
    }
    return out;
  }
  // 可打击目标（返回 {kind:'unit'|'site', id, c, r, dist, label}）
  function targetsFor(st, u, orderKey) {
    if (!unitActive(u)) return [];
    const out = [], foe = u.side === 'blue' ? 'red' : 'blue';
    const rng = u.rng + (orderKey === 'salvo' ? 1 : 0);
    const push = (kind, o, label) => {
      const d = hexDist(u, o);
      if (d > rng) return;
      out.push({ kind, id: o.id, c: o.c, r: o.r, dist: d, label, value: o.value || 0 });
    };
    if (orderKey === 'strike' || orderKey === 'salvo' || orderKey === 'sabotage') {
      st.units.forEach(t => { if (t.side === foe && unitActive(t) && !t.hidden) push('unit', t, t.name); });
      st.sites.forEach(t => { if (t.side === foe || t.kind === 'oil' || t.kind === 'strait') push('site', t, t.name); });
    } else if (orderKey === 'sead' || orderKey === 'cyber') {
      st.units.forEach(t => { if (t.side === foe && unitActive(t) && (orderKey === 'cyber' || t.ad > 0)) push('unit', t, t.name); });
    } else if (orderKey === 'raid') {
      st.units.forEach(t => { if (t.side === foe && unitActive(t)) push('unit', t, t.name); });
      st.sites.forEach(t => { if (t.side === foe) push('site', t, t.name); });
    } else if (orderKey === 'mine' || orderKey === 'escort') {
      st.sites.forEach(t => { if (t.kind === 'strait' || t.kind === 'port') push('site', t, t.name); });
    } else if (orderKey === 'move') {
      const mr = u.type === 'air' ? 4 : u.type === 'nav' ? 3 : 1;
      MAP.hexes.forEach(h => {
        const d = hexDist(u, h);
        if (d === 0 || d > mr) return;
        const isSea = h.terrain.id === 'sea' || h.terrain.id === 'strait';
        if (u.type === 'nav' ? !isSea : isSea) return;
        out.push({ kind: 'hex', id: h.key, c: h.c, r: h.r, dist: d, label: `${h.nation.name}·${h.terrain.name}`, value: 0 });
      });
      return out.sort((a, b) => a.dist - b.dist);
    } else if (orderKey === 'repair') {
      st.sites.forEach(t => { if (t.side === u.side && t.dmg > 0) push('site', t, t.name + `（损伤 ${Math.round(t.dmg)}）`); });
    }
    return out.sort((a, b) => b.value - a.value || a.dist - b.dist);
  }
  function setOrder(st, unitId, orderKey, target) {
    const u = st.byId(unitId);
    if (!u || !unitActive(u)) return false;
    if (orderKey === null) { u.order = null; return true; }
    const def = ORDER_DEF[orderKey];
    if (!def || def.for.indexOf(u.type) < 0) return false;
    if (def.needTarget && !target) return false;
    u.order = { key: orderKey, target: target || null };
    return true;
  }

  /* ------------------------------------------------------------ 战斗计算 */
  function adAgainst(st, side, hex, seadMod, cyberMod) {
    // 防守方 side 在 hex 处的防空强度
    let ad = 0;
    st.units.forEach(u => {
      if (u.side !== side || !unitActive(u) || u.ad <= 0) return;
      const d = hexDist(u, hex);
      if (d > u.rng) return;
      let w = u.ad * (u.readiness / 100) * (1 - 0.12 * Math.max(0, d - 1));
      if (u.order && u.order.key === 'defend') w *= 1.35;
      ad += w;
    });
    if (side === 'blue') ad *= 0.45 + 0.55 * (st.meters.intercept / 100);   // 拦截弹库存决定可持续性
    ad *= (1 - (seadMod || 0)) * (1 - (cyberMod || 0));
    return ad;
  }
  const HARD_MOD = { 0: 1.0, 1: 0.78, 2: 0.5, 3: 0.18 };
  function hardnessFactor(target, attacker) {
    const hard = target.hard || 0;
    let f = HARD_MOD[hard];
    if (attacker.bunker) f = hard >= 3 ? 0.8 : hard >= 2 ? 1.0 : Math.min(1, f * 1.4);
    return f;
  }

  function resolveStrike(st, u, ord, mods) {
    const tgt = ord.target.kind === 'unit' ? st.byId(ord.target.id) : st.siteById(ord.target.id);
    if (!tgt || (ord.target.kind === 'unit' && !unitActive(tgt))) return null;
    const salvo = ord.key === 'salvo';
    const sabotage = ord.key === 'sabotage';
    let stockF = 1;
    if (u.side === 'red' && (u.type === 'msl' || u.type === 'uav')) stockF = 0.55 + 0.45 * clamp(st.meters.redMissiles / 70, 0, 1.2);
    let shots = Math.max(1, Math.round(u.shots * (salvo ? 1.7 : 1) * stockF));
    shots = Math.min(shots, Math.max(1, u.ammo * 3));
    let acc = u.acc * (salvo ? 0.78 : 1) * (0.75 + 0.25 * u.readiness / 100);
    if (u.side === 'blue' && st.flags.blueSurge) acc *= 1.12;
    const foe = u.side === 'blue' ? 'red' : 'blue';
    const seadMod = mods.sead[foe] && mods.sead[foe][tgt.c + ',' + tgt.r] ? 0.4 : 0;
    const cyberMod = mods.cyber[foe] || 0;
    let ad = sabotage ? 0 : adAgainst(st, foe, tgt, seadMod, cyberMod);
    // 弹种/平台对拦截难度的影响
    let kType = 1;
    if (u.hyper) kType = 0.55;
    if (u.type === 'uav') kType = 1.2;
    if (u.type === 'air' || u.type === 'bmb') kType = 0.8 * (1 - (u.stealth || 0));
    let interceptP = clamp((ad / 62) * kType, 0.03, 0.92);

    let intercepted = 0, hits = 0, dmg = 0;
    for (let i = 0; i < shots; i++) {
      if (st.rng() < interceptP) {
        intercepted++;
        if (foe === 'blue') { addMeter(st, 'intercept', -0.42); st.stat.interceptsUsed++; }
        continue;
      }
      if (st.rng() < acc) {
        hits++;
        const hf = ord.target.kind === 'site' ? hardnessFactor(tgt, u) : 0.9;
        dmg += u.atk * hf * (0.8 + 0.4 * st.rng()) * 0.5 * (st.flags.blueSurge && u.side === 'blue' ? 1.25 : 1);
      }
    }
    dmg = Math.round(dmg);
    u.ammo = Math.max(0, u.ammo - (salvo ? 2 : 1));
    if (u.side === 'red' && (u.type === 'msl' || u.type === 'uav')) addMeter(st, 'redMissiles', salvo ? -2.2 : -1.1);
    if (u.side === 'blue') st.stat.blueStrikes++; else st.stat.redStrikes++;
    applyDamage(st, u, tgt, ord.target.kind, dmg);
    st.timeline.push({
      t: 'strike', unit: u.id, unitName: u.name, side: u.side, from: [u.c, u.r], to: [tgt.c, tgt.r],
      targetName: tgt.name, kind: ord.target.kind, shots, intercepted, hits, dmg, salvo, sabotage
    });
    pushLog(st, `${u.name} → ${tgt.name}：发射 ${shots}，被拦 ${intercepted}，命中 ${hits}，损伤 ${dmg}` +
      (salvo ? '（饱和齐射）' : '') + (sabotage ? '（破袭）' : ''), u.side);
    return { shots, intercepted, hits, dmg };
  }

  function applyDamage(st, attacker, tgt, kind, dmg) {
    if (dmg <= 0) return;
    const M = st.meters;
    if (kind === 'unit') {
      tgt.hp = Math.max(0, tgt.hp - dmg);
      if (tgt.side === 'red' && (tgt.type === 'msl' || tgt.type === 'uav')) addMeter(st, 'redMissiles', -dmg * 0.035);
      tgt.readiness = clamp(tgt.readiness - dmg * 0.5, 15, 100);
      if (tgt.hp <= 0) {
        tgt.dead = true;
        pushLog(st, `${tgt.name} 已丧失作战能力。`, attacker.side);
        st.timeline.push({ t: 'kill', unit: tgt.id, name: tgt.name, side: tgt.side });
        if (tgt.side === 'red' && (tgt.type === 'msl' || tgt.type === 'uav')) addMeter(st, 'redMissiles', -4);
      }
      return;
    }
    // 要点
    tgt.dmg = clamp(tgt.dmg + dmg, 0, 100);
    st.stat.sitesHit++;
    // 质变性升级动作计数（回合末折算升级阶梯）；dmg 小的骚扰性命中不计入
    const esc = (w, need) => { if (dmg >= (need === undefined ? 8 : need)) st.escQ += (w || 1); };
    if (tgt.kind === 'nuke') {
      addMeter(st, 'heu', -dmg * 0.5);
      addMeter(st, 'irCohesion', -dmg * 0.03);
      if (tgt.id === 'bushehr') { addMeter(st, 'arabTilt', -dmg * 0.25); addMeter(st, 'civ', +dmg * 0.2); st.escQ += 3; }
      esc(2, 10);
    } else if (tgt.kind === 'capital') {
      if (tgt.side === 'red') { addMeter(st, 'irCohesion', -dmg * 0.08); addMeter(st, 'arabTilt', -dmg * 0.09); addMeter(st, 'civ', +dmg * 0.12); addMeter(st, 'usWill', -dmg * 0.04); esc(2, 8); }
      else { addMeter(st, 'arabTilt', -dmg * 0.1); addMeter(st, 'civ', +dmg * 0.12); }
    } else if (tgt.kind === 'city') {
      addMeter(st, 'civ', +dmg * 0.16);
      if (tgt.side === 'blue') { addMeter(st, 'ilMorale', -dmg * 0.20); esc(1, 16); }
      else { addMeter(st, 'irCohesion', -dmg * 0.05); addMeter(st, 'arabTilt', -dmg * 0.08); addMeter(st, 'usWill', -dmg * 0.03); }
    } else if (tgt.kind === 'base') {
      if (tgt.side === 'blue') { addMeter(st, 'usWill', -dmg * 0.07); esc(2, 14); }
      else { addMeter(st, 'irCohesion', -dmg * 0.05); }
    } else if (tgt.kind === 'port') {
      addMeter(st, tgt.id === 'hodeidah' ? 'mandab' : 'hormuz', -dmg * 0.2);
      addMeter(st, 'oil', +dmg * 0.12);
    } else if (tgt.kind === 'oil') {
      addMeter(st, 'oil', +dmg * 0.45);
      addMeter(st, 'arabTilt', tgt.side === 'red' ? -dmg * 0.05 : -dmg * 0.2);
      esc(1, 10);
    } else if (tgt.kind === 'strait') {
      addMeter(st, tgt.id === 'mandab' ? 'mandab' : 'hormuz', -dmg * 0.5);
      esc(1, 6);
    }
  }

  /* ------------------------------------------------------------ 回合结算 */
  const WILL_KEYS = ['irCohesion', 'usWill', 'ilMorale'];
  const WILL_CAP = 6;          // 单回合最大侵蚀（避免三回合崩盘，但 16 回合仍可压垮）

  function resolveTurn(st) {
    if (st.over) return st.timeline;
    st.timeline = [];
    const willStart = {}; WILL_KEYS.forEach(k => willStart[k] = st.meters[k]);
    const mods = { sead: { blue: {}, red: {} }, cyber: { blue: 0, red: 0 } };

    // ---- 0 政治状态检查：代理人参战的政治代价
    st.units.forEach(u => {
      const o = u.order;
      if (!o || !unitActive(u)) return;
      const offensive = ['strike', 'salvo', 'sead', 'mine', 'raid', 'sabotage'].indexOf(o.key) >= 0;
      if (!offensive) return;
      if (u.status === 'ceasefire') {
        pushLog(st, `${u.name} 打破停火投入作战：人道压力与谈判受重挫。`, 'red');
        addMeter(st, 'civ', +8); addMeter(st, 'talks', -10); st.escQ += 2;
        u.status = 'ready';
      } else if (u.status === 'pressure') {
        pushLog(st, `${u.name} 在解武框架下开火：黎巴嫩政治进程受损。`, 'red');
        addMeter(st, 'talks', -6); addMeter(st, 'arabTilt', +5); st.escQ += 1;
      } else if (u.status === 'integrating' && st.rng() < 0.4) {
        pushLog(st, `${u.name} 因整合进程拒绝执行任务。`, 'sys');
        addMeter(st, 'arabTilt', +2);
        u.order = null;
      }
    });

    // ---- 1 网络战与 SEAD（先行修正）
    st.units.forEach(u => {
      const o = u.order;
      if (!o || !unitActive(u)) return;
      if (o.key === 'cyber' && o.target) {
        const t = st.byId(o.target.id);
        if (t && unitActive(t)) {
          const eff = 8 + Math.round(st.rng() * 14);
          t.readiness = clamp(t.readiness - eff, 15, 100);
          mods.cyber[t.side] = Math.max(mods.cyber[t.side], 0.22);
          u.ammo = Math.max(0, u.ammo - 1);
          pushLog(st, `${u.name} 对 ${t.name} 实施网络攻击：战备 -${eff}。`, u.side);
          st.timeline.push({ t: 'cyber', from: [u.c, u.r], to: [t.c, t.r], side: u.side, name: t.name, eff });
        }
      } else if (o.key === 'sead' && o.target) {
        const t = o.target.kind === 'unit' ? st.byId(o.target.id) : st.siteById(o.target.id);
        if (t) {
          mods.sead[u.side === 'blue' ? 'red' : 'blue'][t.c + ',' + t.r] = 1;
          u.ammo = Math.max(0, u.ammo - 1);
          pushLog(st, `${u.name} 实施 SEAD：${t.name} 区域防空被压制。`, u.side);
          st.timeline.push({ t: 'sead', from: [u.c, u.r], to: [t.c, t.r], side: u.side, name: t.name });
        }
      }
    });

    // ---- 2 打击（双方同时；顺序随机化避免先手优势）
    const strikers = st.units.filter(u => unitActive(u) && u.order &&
      ['strike', 'salvo', 'sabotage'].indexOf(u.order.key) >= 0 && u.order.target);
    for (let i = strikers.length - 1; i > 0; i--) { const j = (st.rng() * (i + 1)) | 0; const t = strikers[i]; strikers[i] = strikers[j]; strikers[j] = t; }
    strikers.forEach(u => resolveStrike(st, u, u.order, mods));

    // ---- 3 海上：布雷 / 护航
    st.units.forEach(u => {
      const o = u.order;
      if (!o || !unitActive(u)) return;
      if (o.key === 'mine' && o.target) {
        const t = st.siteById(o.target.id);
        const key = (t && t.id === 'mandab') ? 'mandab' : 'hormuz';
        const eff = 8 + Math.round(st.rng() * 10);
        addMeter(st, key, -eff); addMeter(st, 'oil', +eff * 0.5); st.escQ += 2;
        addMeter(st, 'arabTilt', -3);
        u.ammo = Math.max(0, u.ammo - 1);
        pushLog(st, `${u.name} 在${t ? t.name : '海峡'}布雷/袭船：通航率 -${eff}%。`, 'red');
        st.timeline.push({ t: 'mine', from: [u.c, u.r], to: [t.c, t.r], side: u.side, name: t.name, eff });
      } else if (o.key === 'escort' && o.target) {
        const t = st.siteById(o.target.id);
        const key = (t && t.id === 'mandab') ? 'mandab' : 'hormuz';
        const eff = 7 + Math.round(st.rng() * 8);
        addMeter(st, key, +eff);
        pushLog(st, `${u.name} 组织护航/扫雷：${t ? t.name : '海峡'}通航率 +${eff}%。`, 'blue');
        st.timeline.push({ t: 'escort', from: [u.c, u.r], to: [t.c, t.r], side: u.side, name: t ? t.name : '', eff });
      }
    });

    // ---- 4 地面突袭
    st.units.forEach(u => {
      const o = u.order;
      if (!o || !unitActive(u) || o.key !== 'raid' || !o.target) return;
      const t = o.target.kind === 'unit' ? st.byId(o.target.id) : st.siteById(o.target.id);
      if (!t) return;
      const power = u.atk * u.shots * (0.6 + 0.5 * st.rng()) * (u.readiness / 100);
      const dmg = Math.round(power * 0.5);
      u.ammo = Math.max(0, u.ammo - 1);
      applyDamage(st, u, t, o.target.kind, dmg);
      // 反击损失
      u.hp = Math.max(1, u.hp - Math.round(dmg * 0.35));
      pushLog(st, `${u.name} 突袭 ${t.name}：造成 ${dmg} 损伤，自身受损。`, u.side);
      st.timeline.push({ t: 'raid', from: [u.c, u.r], to: [t.c, t.r], side: u.side, name: t.name, dmg });
    });

    // ---- 5 抢修 / 补给 / 待机
    st.units.forEach(u => {
      const o = u.order;
      if (!o || !unitActive(u)) return;
      if (o.key === 'repair' && o.target) {
        const t = st.siteById(o.target.id);
        if (t) {
          const eff = 10 + Math.round(st.rng() * 12);
          t.dmg = clamp(t.dmg - eff, 0, 100);
          if (t.kind === 'nuke' && !st.flags.redHeuDeal) addMeter(st, 'heu', +eff * 0.10);
          pushLog(st, `${u.name} 抢修 ${t.name}：损伤 -${eff}。`, u.side);
          st.timeline.push({ t: 'repair', from: [u.c, u.r], to: [t.c, t.r], side: u.side, name: t.name, eff });
        }
      } else if (o.key === 'rearm') {
        u.ammo = Math.min(u.maxAmmo, u.ammo + 2);
        u.readiness = clamp(u.readiness + 16, 15, 100);
        u.hp = Math.min(u.maxHp, u.hp + 6);
      } else if (o.key === 'hold') {
        u.readiness = clamp(u.readiness + 9, 15, 100);
        u.hp = Math.min(u.maxHp, u.hp + 3);
      } else if (o.key === 'defend') {
        u.readiness = clamp(u.readiness + 5, 15, 100);
      }
    });

    // ---- 5b 机动（本回合打击按原位置结算，机动在回合末生效）
    st.units.forEach(u => {
      const o = u.order;
      if (!o || !unitActive(u) || o.key !== 'move' || !o.target) return;
      const from = [u.c, u.r];
      u.c = o.target.c; u.r = o.target.r;
      u.readiness = clamp(u.readiness - 6, 15, 100);
      pushLog(st, `${u.name} 转场至 (${u.c},${u.r})。`, u.side);
      st.timeline.push({ t: 'move', unit: u.id, side: u.side, from, to: [u.c, u.r], name: u.name });
    });

    // ---- 6 派生指标
    const M = st.meters;
    const noStrike = st.stat.blueStrikes + st.stat.redStrikes === 0;
    M.oil = clamp(Math.round(72 + (100 - M.hormuz) * 0.62 + (100 - M.mandab) * 0.22), 55, 220);
    if (!st.flags.redHeuDeal) {
      const nukeDmg = st.sites.filter(s => s.kind === 'nuke').reduce((a, s) => a + s.dmg, 0) / 4;
      addMeter(st, 'heu', clamp(2.4 - nukeDmg * 0.04, 0, 2.4));
    }
    if (M.oil > 120) { addMeter(st, 'usWill', -1.5); addMeter(st, 'arabTilt', -1.5); addMeter(st, 'irCohesion', -0.8); }
    if (M.civ > 60) { addMeter(st, 'arabTilt', -1.2); addMeter(st, 'usWill', -1.0); }
    addMeter(st, 'intercept', +2.6);                 // 生产/紧急补给的自然补充
    addMeter(st, 'redMissiles', +1.5);               // 伊朗本土导弹产能
    // 防御战果反馈：本回合拦截比例高 → 国内民意与社会承受力回升
    const shotsAll = st.timeline.filter(e => e.t === 'strike' && e.side === 'red').reduce((a, e) => a + e.shots, 0);
    const intAll = st.timeline.filter(e => e.t === 'strike' && e.side === 'red').reduce((a, e) => a + e.intercepted, 0);
    if (shotsAll >= 6) {
      const rate = intAll / shotsAll;
      if (rate > 0.6) { addMeter(st, 'usWill', +0.8); addMeter(st, 'ilMorale', +0.9); }
      else if (rate < 0.3) { addMeter(st, 'ilMorale', -1.4); }
    }
    if (M.intercept < 30) { addMeter(st, 'ilMorale', -2.5); addMeter(st, 'usWill', -1.2); }
    if (M.oil > 130) addMeter(st, 'usWill', -1.4);
    /* 升级阶梯 = "溢出为全面战争"的风险，衡量的是相对现状(高强度互射已是常态)的质变：
     *   斩首/首都、民用核电站、驻军基地重创、以色列城市重创、封锁海峡、油气终端
     * 常规的军事目标互射不会推高阶梯；无质变动作则回落。第 10 级需要极端"痉挛式"齐射。*/
    const qual = st.escQ;
    let dEsc = 0;
    if (qual >= 3) dEsc = +1;
    else if (qual === 0) dEsc = -1;
    // 阶梯 9 = 全面战争边缘；跨过门槛只能由"授权全面战争"这一显式决策完成
    addMeter(st, 'esc', dEsc);
    st.timeline.push({ t: 'escalation', qual, esc: M.esc });
    st.escP = 0; st.escQ = 0;
    addMeter(st, 'talks', st.meters.esc >= 9 ? -3 : (noStrike ? +2 : -1));
    // 战备自然恢复
    st.units.forEach(u => { if (unitActive(u) && (!u.order || u.order.key === 'hold')) u.readiness = clamp(u.readiness + 4, 15, 100); });

    // 自然回复：动员、宣传与国内政治修复
    addMeter(st, 'irCohesion', +1.0); addMeter(st, 'usWill', +0.55); addMeter(st, 'ilMorale', +0.7);
    // 团结效应：本方城市/首都被击中，短期内反而凝聚（随后由累计侵蚀体现代价）
    const hitOn = side => st.timeline.some(e => e.t === 'strike' && e.side !== side && e.kind === 'site' && e.dmg > 6);
    if (hitOn('red')) addMeter(st, 'irCohesion', +1.6);
    if (hitOn('blue')) { addMeter(st, 'ilMorale', +1.2); addMeter(st, 'usWill', +0.6); }
    // 单回合侵蚀上限
    WILL_KEYS.forEach(k => {
      const drop = willStart[k] - st.meters[k];
      if (drop > WILL_CAP) st.meters[k] = Math.round((willStart[k] - WILL_CAP) * 10) / 10;
    });

    // ---- 7 事件牌
    drawEvent(st);

    // ---- 8 标记消耗
    Object.keys(st.flags).forEach(k => {
      if (k === 'redHeuDeal') return;
      st.flags[k] -= 1;
      if (st.flags[k] <= 0) delete st.flags[k];
    });
    st.units.forEach(u => { u.order = null; });
    st.stat.turnsPlayed++;
    st.phase = 'politics';
    return st.timeline;
  }

  function drawEvent(st) {
    const pool = [];
    S.EVENTS.forEach(e => { if (!e.when || e.when(st)) for (let i = 0; i < (e.weight || 1); i++) pool.push(e); });
    if (!pool.length) return;
    const ev = pool[(st.rng() * pool.length) | 0];
    const helper = {
      meter: (k, d) => addMeter(st, k, d),
      status: (id, s) => { const u = st.byId(id); if (u) u.status = s; },
      damageUnit: (id, d) => { const u = st.byId(id); if (u) { u.hp = Math.max(0, u.hp - d); if (u.hp <= 0) u.dead = true; } },
      healUnit: (id, d) => { const u = st.byId(id); if (u) u.hp = Math.min(u.maxHp, u.hp + d); },
      ammo: (id, d) => { const u = st.byId(id); if (u) u.ammo = clamp(u.ammo + d, 0, u.maxAmmo + 2); },
      flag: (k, v) => { st.flags[k] = v; }
    };
    const text = ev.apply(st, helper);
    pushLog(st, `【态势事件】${ev.title}：${text}`, 'event');
    st.timeline.push({ t: 'event', id: ev.id, title: ev.title, text, src: ev.src });
  }

  /* ------------------------------------------------------------ 政治阶段 */
  function politicalOptions(st, side) {
    return S.POLITICS[side].filter(p => {
      if (p.id === 'r-heu' && st.flags.redHeuDeal) return false;
      if (p.id === 'b-halt' && st.flags.blueHalt) return false;
      if (p.need && !p.need(st)) return false;
      return true;
    });
  }
  function applyPolitical(st, side, id) {
    const opt = S.POLITICS[side].find(p => p.id === id);
    if (!opt) return false;
    const helper = {
      meter: (k, d) => addMeter(st, k, d),
      status: (uid, s) => { const u = st.byId(uid); if (u) u.status = s; },
      flag: (k, v) => { st.flags[k] = v; }
    };
    opt.apply(st, helper);
    pushLog(st, `【${side === 'blue' ? '蓝方' : '红方'}政治行动】${opt.name}`, side);
    st.timeline.push({ t: 'politics', side, name: opt.name });
    return true;
  }

  /* ------------------------------------------------------------ 胜负判定 */
  function checkVictory(st) {
    const M = st.meters, V = S.VICTORY_TEXT;
    if (st.flags.totalWar) return { winner: 'none', reason: V.doom, code: 'doom' };
    const dealDone = M.talks >= 80 && st.flags.redHeuDeal && st.flags.blueHalt;
    if (dealDone) return { winner: 'draw', reason: V.draw, code: 'deal' };
    if (M.heu <= 15 && M.redMissiles <= 30) return { winner: 'blue', reason: V.blueMil, code: 'blueMil' };
    if (M.irCohesion <= 15 && M.heu <= 40) return { winner: 'blue', reason: '施压战略达成：核计划被压制且伊朗政权控制力崩塌，被迫接受限制', code: 'blueCohesion' };
    if (M.talks >= 80 && st.flags.redHeuDeal && M.heu <= 45) return { winner: 'blue', reason: V.bluePol, code: 'bluePol' };
    if (M.heu >= 95) return { winner: 'red', reason: V.redMil + '（核门槛突破）', code: 'redNuke' };
    if (M.ilMorale <= 25) return { winner: 'red', reason: V.redMil + '（以色列社会承受力崩塌）', code: 'redMorale' };
    if (M.usWill <= 30) return { winner: 'red', reason: V.redPol + '（美国国内支持崩塌）', code: 'redWill' };
    if (M.oil >= 135 && M.arabTilt <= -25) return { winner: 'red', reason: V.redPol + '（能源与外交双重反噬）', code: 'redOil' };
    return null;
  }
  function scoreSides(st) {
    const M = st.meters;
    const blue = (100 - M.heu) * 0.9 + (100 - M.redMissiles) * 0.5 + M.arabTilt * 0.2 + M.talks * 0.25 + M.intercept * 0.2;
    const red = M.heu * 0.9 + M.redMissiles * 0.5 + (100 - M.usWill) * 0.5 + (100 - M.ilMorale) * 0.5 + (M.oil - 80) * 0.6 - M.arabTilt * 0.2;
    return { blue: Math.round(blue), red: Math.round(red) };
  }
  function endTurn(st) {
    const v = checkVictory(st);
    if (v) { st.over = v; st.phase = 'over'; pushLog(st, `推演结束：${v.winner === 'blue' ? '蓝方达成目标' : v.winner === 'red' ? '红方达成目标' : v.winner === 'draw' ? '达成停战协议' : '灾难结局'} —— ${v.reason}`, 'sys'); return st.over; }
    if (st.turn >= S.meta.maxTurns) {
      const sc = scoreSides(st);
      const w = sc.blue > sc.red + 8 ? 'blue' : sc.red > sc.blue + 8 ? 'red' : 'draw';
      st.over = { winner: w, reason: `回合用尽，按指标计分（蓝 ${sc.blue} : 红 ${sc.red}）`, code: 'points', score: sc };
      st.phase = 'over';
      pushLog(st, `推演结束（回合用尽）：蓝 ${sc.blue} : 红 ${sc.red}`, 'sys');
      return st.over;
    }
    st.turn++;
    st.phase = 'orders';
    return null;
  }

  /* ------------------------------------------------------------ AI 规划 */
  function aiPosture(st, side) {
    const M = st.meters;
    if (side === 'blue') {
      if (M.intercept < 26) return 'defend';
      if (M.usWill < 42 || M.ilMorale < 40) return 'negotiate';
      const winning = M.heu <= 30 || M.irCohesion <= 30;
      if (!winning && st.turn >= 7 && (M.talks > 30 || st.rng() < 0.3)) return 'negotiate';
      return M.heu > 60 || M.redMissiles > 55 ? 'press' : 'attrit';
    }
    if (M.irCohesion < 40 || M.redMissiles < 28 || (M.oil > 140 && M.arabTilt < -20)) return 'negotiate';
    const winningR = M.usWill <= 40 || M.ilMorale <= 38 || M.heu >= 85;
    if (!winningR && st.turn >= 7 && (M.talks > 30 || st.rng() < 0.3)) return 'negotiate';
    return M.intercept < 40 ? 'press' : 'attrit';
  }
  function aiPlan(st, side) {
    const posture = aiPosture(st, side);
    const foe = side === 'blue' ? 'red' : 'blue';
    const plans = [];
    st.units.forEach(u => {
      if (u.side !== side || !unitActive(u)) return;
      const opts = orderTypesFor(st, u);
      if (!opts.length) return;
      let best = null;
      opts.forEach(o => {
        if (o.key === 'move') {
          const tl = targetsFor(st, u, 'move');
          if (tl.length && (u.ammo <= 0 ? false : st.rng() < 0.18)) {
            const t = tl[(st.rng() * Math.min(4, tl.length)) | 0];
            const v = 12 + st.rng() * 10;
            if (!best || v > best.v) best = { v, order: 'move', target: t };
          }
          return;
        }
        if (o.key === 'hold' || o.key === 'rearm' || o.key === 'defend') {
          let v = o.key === 'rearm' ? (u.ammo <= 1 ? 60 : 6) + (u.readiness < 45 ? 25 : 0)
            : o.key === 'defend' ? (u.ad > 0 ? 34 : 8) + (posture === 'defend' ? 30 : 0) : 5;
          if (posture === 'negotiate') v += 12;
          if (!best || v > best.v) best = { v, order: o.key, target: null };
          return;
        }
        const tl = targetsFor(st, u, o.key);
        tl.slice(0, 6).forEach(t => {
          let v = 0;
          const tu = t.kind === 'unit' ? st.byId(t.id) : null;
          const ts = t.kind === 'site' ? st.siteById(t.id) : null;
          if (ts) {
            v = ts.value * 6 - ts.dmg * 0.5;
            if (side === 'blue' && ts.kind === 'nuke') v += u.bunker ? 70 : (ts.hard >= 3 ? -30 : 18);
            if (side === 'blue' && ts.id === 'bushehr') v -= 60;
            if (side === 'red' && ts.kind === 'city') v += 24 + (st.meters.intercept < 45 ? 20 : 0);
            if (side === 'blue' && (ts.kind === 'city' || ts.kind === 'capital')) v -= 22 + (st.meters.arabTilt < 0 ? 20 : 0);
            if (side === 'red' && ts.kind === 'base') v += 20;
            if (ts.kind === 'oil') v += side === 'red' ? 16 : -25;
            if (ts.kind === 'strait') v += o.key === 'mine' ? 30 : -10;
          } else if (tu) {
            v = tu.ad > 0 ? 40 : 26;
            v += (tu.maxHp - tu.hp) * 0.2 + tu.atk * 1.6;
            if (o.key === 'sead' && tu.ad > 0) v += 28;
            if (o.key === 'cyber') v += 14;
            if (side === 'blue' && (tu.type === 'msl' || tu.type === 'uav')) v += 26;
            if (side === 'red' && tu.type === 'ad') v += 18;
            if (side === 'red' && tu.type === 'nav') v += 20;
          }
          if (o.key === 'salvo') v += st.meters.intercept > 20 ? 26 : 6;      // 拼消耗
          if (o.key === 'mine') v += st.meters.hormuz > 35 ? 26 : -10;
          if (o.key === 'escort') v += st.meters.hormuz < 65 ? 34 : 4;
          if (o.key === 'repair') v += (ts ? ts.dmg : 0) * 1.4;
          if (posture === 'negotiate') v -= 34;
          if (posture === 'defend' && o.key !== 'escort') v -= 18;
          if (u.status === 'ceasefire') v -= 70;
          if (u.status === 'pressure') v -= 26;
          if (u.status === 'integrating') v -= 16;
          if (u.type === 'bmb' && u.ammo <= 1) v -= 40;                       // 钻地弹稀缺
          v += st.rng() * 14;
          if (!best || v > best.v) best = { v, order: o.key, target: t };
        });
      });
      if (best) plans.push({ unitId: u.id, order: best.order, target: best.target });
    });
    return { posture, plans };
  }
  function aiApply(st, side) {
    const p = aiPlan(st, side);
    p.plans.forEach(x => setOrder(st, x.unitId, x.order, x.target));
    return p;
  }
  function aiPolitics(st, side) {
    const posture = aiPosture(st, side);
    const opts = politicalOptions(st, side);
    const M = st.meters;
    const score = o => {
      let v = st.rng() * 8;
      if (side === 'blue') {
        if (o.id === 'b-reinforce') v += M.intercept < 45 ? 60 : 8;
        if (o.id === 'b-escort') v += M.hormuz < 55 ? 45 : 6;
        if (o.id === 'b-halt') v += posture === 'negotiate' ? 85 : 4;
        if (o.id === 'b-offer') v += posture === 'negotiate' ? (st.flags.blueHalt ? 70 : 40) : 12;
        if (o.id === 'b-deep') v += (posture === 'press' ? 42 : 4) - (M.esc >= 8 ? 60 : 0);
        if (o.id === 'b-pressure') v += M.irCohesion > 45 ? 24 : 6;
        if (o.id === 'b-lebanon') v += 16;
      } else {
        if (o.id === 'r-heu') v += posture === 'negotiate' ? 85 : 2;
        if (o.id === 'r-hormuz') v += (M.hormuz > 45 ? 40 : 8) - (M.esc >= 9 ? 40 : 0);
        if (o.id === 'r-mandab') v += M.mandab > 40 ? 30 : 6;
        if (o.id === 'r-resupply') v += M.redMissiles < 50 ? 50 : 10;
        if (o.id === 'r-iraq') v += M.esc < 8 ? 26 : -20;
        if (o.id === 'r-endwar') v += 18;
        if (o.id === 'r-iaea') v += posture === 'negotiate' ? (st.flags.redHeuDeal ? 65 : 36) : 4;
      }
      return v;
    };
    let best = null;
    opts.forEach(o => {
      if (o.id === 'b-total' || o.id === 'r-total') return;   // AI 不主动跨过全面战争门槛
      const v = score(o); if (!best || v > best.v) best = { v, o };
    });
    if (best) applyPolitical(st, side, best.o.id);
    return best ? best.o : null;
  }

  /* ------------------------------------------------------------ 无人对局 */
  function autoPlay(seed, maxTurns) {
    const st = createGame({ seed });
    const limit = maxTurns || S.meta.maxTurns + 2;
    while (!st.over && st.turn <= limit) {
      aiApply(st, 'blue'); aiApply(st, 'red');
      resolveTurn(st);
      aiPolitics(st, 'blue'); aiPolitics(st, 'red');
      endTurn(st);
    }
    return st;
  }

  return {
    S, MAP, hexDist, createGame, orderTypesFor, targetsFor, setOrder, ORDER_DEF,
    resolveTurn, politicalOptions, applyPolitical, checkVictory, endTurn, scoreSides,
    aiPlan, aiApply, aiPolitics, aiPosture, talksCap, autoPlay, addMeter, pushLog, unitActive
  };
});
