/* ============================================================================
 * ai.js — 双方战役指挥 AI (Operational-Level AI)
 * ----------------------------------------------------------------------------
 * PLA 侧遵循"联合火力突击 → 夺取制空权 → 夺取制海权 → 扫雷破障 →
 *   两栖/垂直登陆 → 夺港 → 纵深进攻"的战役流程。
 * ROC 侧遵循"战力保存 → 滨海决胜、滩岸歼敌 → 纵深防御 → 持久"的防卫构想。
 * 美日侧遵循"域外拒止 + 潜艇猎杀 + 远程打击"的介入模式。
 * ==========================================================================*/
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};
  var G;   // geo helpers (延迟绑定)

  var ISLAND_C = { lat: 23.7, lon: 120.98 };

  function d(a, b) { return G.dist(a, b); }
  function clamp(v, a, b) { return G.clamp(v, a, b); }

  /* 从目标向"来袭方向"外推的待战/发射阵位 */
  function standoff(from, target, km) {
    var brg = G.bearing(target, from);
    return G.moveTo(target, brg, km);
  }
  function seaward(pt, km) {
    var brg = G.bearing(ISLAND_C, pt);
    return G.moveTo(pt, brg, km);
  }

  /* =====================  固定目标注入航迹  ============================ */
  function facilityTracks(E, side) {
    var enemies = side === 'PLA' ? ['ROC'] : side === 'ROC' ? ['PLA'] : ['PLA'];
    if (side === 'PLA' && E.usArrived) { enemies.push('US'); enemies.push('JP'); }
    if (side === 'ROC' && E.usArrived) { /* 台方不打美日 */ }
    var T = E.sides[side].tracks, sc = E.scenario;
    var pri1 = sc.strike1 || [], pri2 = sc.strike2 || [];
    var roe = E.rulesOfEngagement || {};
    Object.keys(E.bases).forEach(function (k) {
      var b = E.bases[k];
      if (enemies.indexOf(b.side) < 0 || !b.active) return;
      if (side === 'PLA' && roe.noMainIsland && E.t < roe.noMainIsland &&
        b.lat > 21.8 && b.lat < 25.4 && b.lon > 119.9 && b.lon < 122.1) return;
      if (side === 'PLA' && roe.strikeLand && E.t < roe.strikeLand) return;
      var i1 = pri1.indexOf(k), i2 = pri2.indexOf(k);
      T['B' + k] = { uid: 'B' + k, siteId: k, side: b.side, dom: 'base', cls: null, role: 'airbase',
        lat: b.lat, lon: b.lon, alt: 0, spd: 0, seen: E.t, age: 0, err: 0.5, q: 0.9,
        name: b.name, prio: i1 >= 0 ? 160 - i1 * 4 : i2 >= 0 ? 80 - i2 * 2 : 20,
        fixed: 1, ops: b.ops };
    });
    Object.keys(E.sites).forEach(function (k) {
      var s = E.sites[k];
      if (enemies.indexOf(s.owner) < 0) return;
      if (s.destroyed && s.hp <= 0) return;
      if (side === 'PLA' && roe.noMainIsland && E.t < roe.noMainIsland &&
        s.lat > 21.8 && s.lat < 25.4 && s.lon > 119.9 && s.lon < 122.1) return;
      if (side === 'PLA' && roe.strikeLand && E.t < roe.strikeLand) return;
      var j1 = pri1.indexOf(k), j2 = pri2.indexOf(k);
      T['S' + k] = { uid: 'S' + k, siteId: k, side: s.owner, dom: 'site', cls: null, role: s.kind,
        lat: s.lat, lon: s.lon, alt: 0, spd: 0, seen: E.t, age: 0, err: 0.5, q: 0.9,
        name: s.name, prio: j1 >= 0 ? 170 - j1 * 4 : j2 >= 0 ? 85 - j2 * 2 : (s.value || 3) * 4,
        fixed: 1 };
    });
  }

  /* =====================  出动管理  ==================================== */
  function countMission(E, side, type) {
    var n = 0;
    for (var i = 0; i < E.units.length; i++) {
      var u = E.units[i];
      if (u.dead || u.side !== side || u.domain !== 'air') continue;
      if (u.mission && u.mission.type === type) n++;
    }
    return n;
  }
  function basesWith(E, side, cls) {
    var r = [];
    Object.keys(E.bases).forEach(function (k) {
      var b = E.bases[k];
      if (b.side !== side || !b.active || b.ops <= 0.08) return;
      if ((b.inv[cls] || 0) > 0) r.push(b);
    });
    return r;
  }
  function tryLaunch(E, side, clsList, count, mission, sortBy) {
    for (var c = 0; c < clsList.length; c++) {
      var cls = clsList[c];
      var bs = basesWith(E, side, cls);
      if (!bs.length) continue;
      if (sortBy) bs.sort(sortBy);
      else bs.sort(function (a, b) { return b.ops - a.ops; });
      for (var i = 0; i < bs.length; i++) {
        var u = E.launchFlight(bs[i].id, cls, Math.min(count, bs[i].inv[cls]), mission);
        if (u) return u;
      }
    }
    return null;
  }

  /* 找到威胁最大的敌方航迹（按类型） */
  function bestTrack(E, side, filter, refPos) {
    var T = E.sides[side].tracks, best = null, bs = -1;
    Object.keys(T).forEach(function (k) {
      var tr = T[k];
      if (!filter(tr)) return;
      var s = (tr.prio || 0) + tr.q * 40;
      if (refPos) s -= d(refPos, tr) / 15;
      if (tr.role === 'cv' || tr.role === 'lhd' || tr.role === 'lha') s += 90;
      if (tr.role === 'lpd' || tr.role === 'lst' || tr.role === 'sealift' || tr.role === 'barge') s += 60;
      if (s > bs) { bs = s; best = tr; }
    });
    return best;
  }

  /* =====================  解放军  ====================================== */
  function pla(E) {
    var sc = E.scenario, ph = E.phase, hrs = E.t / 3600;
    facilityTracks(E, 'PLA');

    /* ---------- 1. 空中战役 ---------- */
    // 预警机 (2 架常态)
    if (countMission(E, 'PLA', 'aew') < 2) {
      var aewPos = [{ lat: 25.1, lon: 119.3 }, { lat: 23.3, lon: 118.6 }][countMission(E, 'PLA', 'aew')] || { lat: 24.2, lon: 118.9 };
      tryLaunch(E, 'PLA', ['KJ-500A', 'KJ-2000'], 1, { type: 'aew', orbit: aewPos, orbitR: 55, wp: [aewPos] });
    }
    // 电子战/侦察
    if (countMission(E, 'PLA', 'elint') < 2)
      tryLaunch(E, 'PLA', ['Y-9JB'], 1, { type: 'elint', orbit: { lat: 24.6, lon: 119.1 }, orbitR: 50, wp: [{ lat: 24.6, lon: 119.1 }] });
    if (countMission(E, 'PLA', 'isr') < 4) {
      var isrP = { lat: 22.6 + (countMission(E, 'PLA', 'isr') * 1.1), lon: 119.0 };
      tryLaunch(E, 'PLA', ['WZ-7', 'GJ-2'], 1, { type: 'isr', orbit: isrP, orbitR: 60, wp: [isrP] });
    }
    // 反潜巡逻
    if (countMission(E, 'PLA', 'asw') < 2)
      tryLaunch(E, 'PLA', ['Y-8Q'], 1, { type: 'asw', orbit: { lat: 23.0, lon: 120.3 }, orbitR: 70, wp: [{ lat: 23.0, lon: 120.3 }] });

    // 战斗空中巡逻（沿海峡中线布防，护卫火力打击与船团）
    var capWant = ph >= 1 ? 8 : 4;
    var capStations = [
      { lat: 26.2, lon: 120.4 }, { lat: 25.4, lon: 120.3 }, { lat: 24.6, lon: 119.9 },
      { lat: 23.8, lon: 119.6 }, { lat: 23.0, lon: 119.4 }, { lat: 22.2, lon: 119.8 },
      { lat: 25.0, lon: 121.0 }, { lat: 23.6, lon: 120.6 }
    ];
    var capN = countMission(E, 'PLA', 'cap');
    if (capN < capWant) {
      var st = capStations[capN % capStations.length];
      tryLaunch(E, 'PLA', ['J-11B', 'J-10C', 'Su-35S', 'J-16'], 4,
        { type: 'cap', orbit: st, orbitR: 40, wp: [st] });
    }
    // 制空扫荡（进入台岛空域）
    var sweepWant = ph >= 1 ? 6 : 2;
    if (countMission(E, 'PLA', 'sweep') < sweepWant) {
      var tgtAir = bestTrack(E, 'PLA', function (t) { return t.dom === 'air'; }, { lat: 24.5, lon: 119.5 });
      var sp = tgtAir ? { lat: tgtAir.lat, lon: tgtAir.lon } :
        [{ lat: 24.9, lon: 121.2 }, { lat: 23.9, lon: 120.6 }, { lat: 22.9, lon: 120.5 }][countMission(E, 'PLA', 'sweep') % 3];
      tryLaunch(E, 'PLA', ['J-20A', 'J-16', 'Su-35S', 'J-10C'], 4,
        { type: 'sweep', orbit: sp, orbitR: 35, wp: [sp] });
    }
    // 压制防空 SEAD/DEAD
    if (ph >= 1 && countMission(E, 'PLA', 'sead') < 3) {
      var samT = bestTrack(E, 'PLA', function (t) { return t.dom === 'sam' || t.dom === 'radar'; });
      if (samT) {
        var sp2 = standoff({ lat: 24.5, lon: 119.0 }, samT, 95);
        tryLaunch(E, 'PLA', ['J-16D', 'J-16'], 2, { type: 'sead', wp: [sp2], orbit: sp2, orbitR: 28, target: samT.uid });
      }
    }
    // 对陆打击（机场/节点）
    var strikeWant = ph >= 1 ? 6 : 3;
    if (countMission(E, 'PLA', 'strike') < strikeWant) {
      var gt = bestTrack(E, 'PLA', function (t) { return t.dom === 'base' || t.dom === 'site'; });
      if (gt) {
        var sp3 = standoff({ lat: 24.4, lon: 118.9 }, gt, 130);
        tryLaunch(E, 'PLA', ['JH-7A', 'J-16', 'H-6K'], 2, { type: 'strike', wp: [sp3], orbit: sp3, orbitR: 25, target: gt.uid });
      }
    }
    // 反舰突击
    var shipT = bestTrack(E, 'PLA', function (t) { return t.dom === 'surface' && (t.side === 'ROC' || t.side === 'US' || t.side === 'JP'); });
    if (shipT && countMission(E, 'PLA', 'asuw') < 4) {
      var sp4 = standoff({ lat: 24.0, lon: 118.6 }, shipT, 260);
      tryLaunch(E, 'PLA', ['H-6J', 'H-6K', 'JH-7A', 'J-16'], 4, { type: 'asuw', wp: [sp4], orbit: sp4, orbitR: 30, target: shipT.uid });
    }
    // 舰载航空兵
    E.alive('PLA', 'surface').forEach(function (cv) {
      if (cv.role !== 'cv' || !cv.airWing) return;
      var aloft = 0;
      for (var i = 0; i < E.units.length; i++) if (!E.units[i].dead && E.units[i].carrierUid === cv.uid) aloft++;
      if (aloft >= 4) return;
      var st = { lat: cv.lat + 0.6, lon: cv.lon - 0.5 };
      ['J-35', 'J-15'].forEach(function (c) {
        if (aloft < 4) { if (E.launchCarrier(cv, c, 2, { type: 'cap', orbit: st, orbitR: 45, wp: [st] })) aloft++; }
      });
    });

    /* ---------- 2. 海上战役 ---------- */
    var stations = {
      'CSG-1': { lat: 24.8, lon: 123.6 },   // 台湾东北，封锁与对美拒止
      'CSG-2': { lat: 22.2, lon: 122.6 },   // 台湾东南，巴士海峡北口
      'SAG-东': { lat: 24.0, lon: 123.0 },
      'SAG-峡': { lat: 24.3, lon: 119.6 },
      'SAG-南': { lat: 21.9, lon: 120.2 },
      'CCG': { lat: 24.6, lon: 120.0 }
    };
    E.alive('PLA', 'surface').forEach(function (u) {
      if (u.reserved) return;
      if (u.P.lift) return;                       // 两栖单独处理
      if (u.state === 'inport') {
        if (ph >= 0) { u.state = 'enroute'; }
        else return;
      }
      var stn = stations[u.group];
      if (!stn) return;
      // 封锁剧本：分散到封控区
      if (E.blockade && u.group === 'SAG-峡') {
        var zs = TWG.THEATER.CLOSURE_ZONES;
        var z = zs[u.uid % zs.length];
        var cx = 0, cy = 0; z.pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
        stn = { lat: cy / z.pts.length, lon: cx / z.pts.length };
      }
      if (!u.wp.length || !u.stnSet || d(u, stn) > 260) {
        var jitter = { lat: stn.lat + ((u.uid % 11) - 5) * 0.09, lon: stn.lon + ((u.uid % 7) - 3) * 0.11 };
        u.wp = [jitter]; u.stnSet = 1; u.mission = { type: 'sea_control' };
      }
      // 受重创舰艇返港
      if (u.hp / u.hp0 < 0.35 && !u.retiring) {
        u.retiring = 1;
        var hp = E.sites[u.home];
        if (hp) { u.wp = [{ lat: hp.lat, lon: hp.lon }]; u.mission = { type: 'retire' }; }
      }
    });
    // 潜艇: 深水阵位/海峡出口
    var subBoxes = [
      { lat: 23.3, lon: 122.9 }, { lat: 24.6, lon: 123.3 }, { lat: 21.6, lon: 121.4 },
      { lat: 25.6, lon: 122.6 }, { lat: 22.6, lon: 122.4 }, { lat: 24.0, lon: 122.6 },
      { lat: 23.9, lon: 119.8 }, { lat: 22.8, lon: 119.6 }
    ];
    var si = 0;
    E.alive('PLA', 'sub').forEach(function (u) {
      if (u.state === 'inport') { u.state = 'enroute'; }
      var box = subBoxes[u.uid % subBoxes.length];
      if (!u.wp.length && d(u, box) > 40) { u.wp = [box]; u.emcon = 0; u.mission = { type: 'sub_patrol' }; }
      si++;
    });

    /* ---------- 3. 两栖战役 ---------- */
    amphibious(E);

    /* ---------- 4. 空降/机降 ---------- */
    airborneOps(E);

    /* ---------- 5. 火箭军/远火机动 ---------- */
    E.alive('PLA', 'ground').forEach(function (u) {
      if (u.role === 'mlrs_bde' && u.P.rangeMax && u.P.rangeMax < 200) {
        // 短程远火前推至海岸线
        if (!u.pushed) { u.pushed = 1; }
      }
      // 打了就跑：发射后转移阵地
      if (u.lastFire > 0 && E.t - u.lastFire < 200 && !u.moveTo && (u.role === 'srbm_bde' || u.role === 'mlrs_bde' || u.role === 'lacm_bde')) {
        u.moveTo = { lat: u.lat + E.rng.range(-0.06, 0.06), lon: u.lon + E.rng.range(-0.06, 0.06) };
        u.emcon = 1;
      }
    });
    hazards(E);
  }

  /* -----------------  两栖投送流程  ----------------- */
  function amphibHour(sc) {
    if (sc.amphibHour != null) return sc.amphibHour;
    if (!sc.landingPlan || !sc.landingPlan.length) return null;
    for (var i = 0; i < sc.phases.length; i++) {
      if (/两栖|抢滩|登陆|突击/.test(sc.phases[i].name)) return sc.phases[i].at;
    }
    return 30;
  }
  function registerBeach(entry) {
    var idx = TWG.THEATER.idx.beach;
    if (entry.lat != null && !idx[entry.beach]) {
      idx[entry.beach] = { id: entry.beach, name: entry.name || entry.beach, lat: entry.lat, lon: entry.lon,
        width: entry.width || 6, grade: entry.grade || 0.6, flat: entry.flat || 0.5,
        obj: entry.obj || '', region: entry.region || '外岛', custom: 1 };
    }
    return idx[entry.beach];
  }
  function ensureBeachhead(E, key, beach) {
    return E.ensureBeachhead(key, beach);
  }
  function amphibious(E) {
    var sc = E.scenario;
    if (!sc.landingPlan || !sc.landingPlan.length) return;
    var ah = amphibHour(sc);
    if (ah == null) return;
    var seaCtl = E.seaControlIndex();
    var canGo = E.t >= ah * 3600 && (seaCtl > 0.42 || E.limitedWar || E.surprise);
    if (!canGo) return;
    if (E.env.typhoon > 0) return;             // 台风中止航渡
    if (E.env.amphib < 0.35) return;           // 海况超限

    // 注册滩头
    sc.landingPlan.forEach(function (p) { registerBeach(p); });

    // 1) 装载: 港内两栖舰 ← 集结区地面部队
    var groundPool = E.alive('PLA', 'ground').filter(function (g) {
      return g.troops > 200 && !g.afloat && !g.landed && g.role !== 'beachhead' &&
        (g.role === 'amph_bde' || g.role === 'marine_bde' || g.role === 'heavy_bde' || g.role === 'sof');
    });
    E.alive('PLA', 'surface').forEach(function (s) {
      if (!s.lift || s.reserved || s.embarked || s.beachId) return;
      if (s.state !== 'inport' && s.state !== 'ready' && s.state !== 'onstation') return;
      // 就近装载
      var best = null, bd = 1e9;
      for (var i = 0; i < groundPool.length; i++) {
        var g = groundPool[i];
        var dd = d(s, g);
        if (dd < bd && dd < 180) { bd = dd; best = g; }
      }
      if (!best) return;
      // 梯队控制：第一梯队优先
      var echWant = E.t < (ah + 20) * 3600 ? 1 : 9;
      if (best.echelon && best.echelon > echWant && E.t < (ah + 20) * 3600) return;
      E.embark(s, best);
    });

    // 2) 航渡: 已装载船只驶向分配滩头
    var plan = sc.landingPlan.slice();
    var loaded = E.alive('PLA', 'surface').filter(function (s) { return s.embarked && !s.beachId; });
    loaded.sort(function (a, b) { return (b.lift.bn || 0) - (a.lift.bn || 0); });
    var wsum = plan.reduce(function (a, p) { return a + (p.weight || 0.5); }, 0);
    loaded.forEach(function (s, i) {
      // 第二梯队滩头待第一梯队突破后才启用
      var avail = plan.filter(function (p) {
        if ((p.echelon || 1) <= 1) return true;
        var anyBreak = Object.keys(E.beachheads).some(function (k) { return E.beachheads[k].breakout; });
        return anyBreak || E.t > (ah + 24) * 3600;
      });
      if (!avail.length) return;
      // 按权重轮转分配
      var r = ((s.uid * 7919) % 1000) / 1000 * avail.reduce(function (a, p) { return a + (p.weight || 0.5); }, 0);
      var pick = avail[0], acc = 0;
      for (var k = 0; k < avail.length; k++) { acc += (avail[k].weight || 0.5); if (r <= acc) { pick = avail[k]; break; } }
      var beach = TWG.THEATER.idx.beach[pick.beach];
      if (!beach) return;
      s.beachId = pick.beach;
      s.mission = { type: 'amphib_transit', beach: pick.beach };
      s.state = 'enroute';
      // 航渡路线: 集结海域 → 换乘区 → 滩头外锚地
      var rv = seaward(beach, 55);
      var anchor = seaward(beach, beach.flat > 1.5 ? 9 : 5);
      s.wp = [rv, anchor];
      s.escortNeeded = 1;
    });

    // 3) 护航: 峡区编队随船团移动
    var convoyC = null, cn = 0;
    E.alive('PLA', 'surface').forEach(function (s) {
      if (s.beachId && s.embarked) { convoyC = convoyC || { lat: 0, lon: 0 }; convoyC.lat += s.lat; convoyC.lon += s.lon; cn++; }
    });
    if (cn > 2) {
      convoyC.lat /= cn; convoyC.lon /= cn;
      E.alive('PLA', 'surface').forEach(function (u) {
        if (u.P.lift || u.group !== 'SAG-峡') return;
        if (d(u, convoyC) > 90) {
          u.wp = [{ lat: convoyC.lat + ((u.uid % 9) - 4) * 0.07, lon: convoyC.lon + ((u.uid % 5) - 2) * 0.09 }];
          u.mission = { type: 'escort' };
        }
      });
    }
    // 4) 直升机火力支援登陆场
    var activeBh = Object.keys(E.beachheads).filter(function (k) { return E.beachheads[k].active; });
    if (activeBh.length && countMission(E, 'PLA', 'helo_strike') < 3) {
      var bk = activeBh[0], bb = TWG.THEATER.idx.beach[bk];
      tryLaunch(E, 'PLA', ['Z-10ME'], 4, { type: 'helo_strike', wp: [{ lat: bb.lat, lon: bb.lon }],
        orbit: { lat: bb.lat, lon: bb.lon }, orbitR: 14 });
    }
  }

  /* -----------------  空降/机降  ----------------- */
  function airborneOps(E) {
    var sc = E.scenario;
    if (!sc.airborne) return;
    sc.airborne.forEach(function (a, i) {
      if (a.done) return;
      if (E.t < a.at * 3600) return;
      // 需要目标区域上空基本制空
      if (E.airControlIndex() < 0.55) return;
      var b = E.bases[a.target];
      if (!b) { a.done = 1; return; }
      var abn = E.alive('PLA', 'ground').filter(function (g) { return g.role === 'airborne_bde' && !g.afloat && !g.landed && g.troops > 500; })[0];
      if (!abn) return;
      var f = tryLaunch(E, 'PLA', ['Y-20A', 'Y-9'], 6, { type: 'airdrop', wp: [{ lat: b.lat, lon: b.lon }], target: a.target, abnUid: abn.uid });
      if (!f) return;
      a.done = 1;
      abn.afloat = 1; abn.state = 'airborne_enroute'; abn.dropTarget = a.target; abn.dropAt = E.t + 3600;
      E.event('critical', 'PLA', '★★ ' + a.name + '：空降兵旅登机起飞，运输机群 ' + f.n + ' 架编队突入', b);
    });
    // 空降着陆结算
    E.alive('PLA', 'ground').forEach(function (g) {
      if (g.state !== 'airborne_enroute' || E.t < g.dropAt) return;
      var b = E.bases[g.dropTarget];
      if (!b) { g.state = 'ready'; g.afloat = 0; return; }
      var key = 'AIR:' + g.dropTarget;
      TWG.THEATER.idx.beach[key] = { id: key, name: b.name + '(空降场)', lat: b.lat, lon: b.lon,
        width: 4, grade: 0.9, flat: 0, obj: b.name, region: '空降', custom: 1 };
      var bh = ensureBeachhead(E, key, TWG.THEATER.idx.beach[key]);
      // 空降损失: 防空与散落
      var loss = clamp(0.15 + (1 - E.airControlIndex()) * 0.5, 0.1, 0.7);
      var landedTroops = g.troops * (1 - loss);
      bh.troops += landedTroops; bh.cp += g.cp * (1 - loss) * 0.85; bh.bn += 2;
      g.troops = 0; g.cp = 0; g.landed = 1; g.state = 'landed'; g.lat = b.lat; g.lon = b.lon;
      E.event('critical', 'PLA', '★★★ 空降突击：' + Math.round(landedTroops) + ' 名空降兵在 ' + b.name +
        ' 着陸（空投损失 ' + (loss * 100).toFixed(0) + '%），开始夺控跑道', b);
    });
  }

  /* =====================  台军  ======================================== */
  function roc(E) {
    var ph = E.phase, hrs = E.t / 3600;
    facilityTracks(E, 'ROC');

    /* ---------- 战力保存 ---------- */
    // 洞库/战备道疏散：把受威胁机场的飞机转场到花莲/台东洞库与公路跑道
    if (!E._disperseDone && (E.t > 600 || E.surprise === undefined)) {
      E._disperseDone = 1;
      var caves = ['AB-HUALIEN', 'AB-ZHIHANG'];
      var hwys = Object.keys(E.bases).filter(function (k) { return E.bases[k].side === 'ROC' && E.bases[k].hwy; });
      ['AB-TAOYUAN', 'AB-SONGSHAN', 'AB-MAKUNG', 'AB-HSINCHU', 'AB-CCK'].forEach(function (bid) {
        var b = E.bases[bid]; if (!b) return;
        Object.keys(b.inv).forEach(function (cls) {
          var pp = TWG.PLATFORMS[cls]; if (!pp || pp.helo || pp.uav) return;
          var mv = Math.floor(b.inv[cls] * 0.45);
          if (mv <= 0) return;
          var to = E.bases[caves[(mv + bid.length) % 2]];
          var cap = to.cave + to.has;
          var cur = 0; Object.keys(to.inv).forEach(function (c) { cur += to.inv[c]; });
          if (cur + mv > cap && hwys.length) to = E.bases[hwys[mv % hwys.length]];
          b.inv[cls] -= mv; to.inv[cls] = (to.inv[cls] || 0) + mv;
        });
      });
      E.event('sys', 'ROC', '◆ 台军执行战力保存：主战机疏散至花莲佳山/台东石子山洞库与战备道，防空阵地机动转移');
      E.alive('ROC', 'sam').forEach(function (u) {
        if (u.P.mobility > 0.34) { u.moveTo = { lat: u.lat + E.rng.range(-0.09, 0.09), lon: u.lon + E.rng.range(-0.09, 0.09) }; }
      });
    }

    /* ---------- 空中 ---------- */
    if (countMission(E, 'ROC', 'aew') < 1) {
      var p = { lat: 23.4, lon: 122.6 };   // 东部外海，尽量拉开与PL-17距离
      tryLaunch(E, 'ROC', ['E-2K'], 1, { type: 'aew', orbit: p, orbitR: 60, wp: [p] });
    }
    var ac = E.airControlIndex();
    var anyLanding = Object.keys(E.beachheads).some(function (k) { return E.beachheads[k].active && E.beachheads[k].bn > 0.2; });
    // 剩余战机比例 → 战力保存强度（台军「存活优先」原则）
    var fInv = 0, fInv0 = 0;
    Object.keys(E.bases).forEach(function (k) {
      var b = E.bases[k]; if (b.side !== 'ROC') return;
      Object.keys(b.inv0 || {}).forEach(function (c) {
        var pp = TWG.PLATFORMS[c];
        if (!pp || pp.helo || pp.uav || pp.role === 'aew' || pp.role === 'asw') return;
        fInv0 += b.inv0[c]; fInv += (b.inv[c] || 0);
      });
    });
    var surv = fInv0 ? fInv / fInv0 : 1;
    var capWant;
    if (anyLanding) capWant = surv < 0.2 ? 3 : 5;              // 本土遭登陆：拼死出动
    else if (surv < 0.35) capWant = 1;                          // 战机剩余不足 35%：严格保存
    else capWant = ac > 0.88 ? 2 : ac > 0.72 ? 3 : 4;
    var flightSize = surv > 0.5 ? 4 : 2;                        // 有余力则以 4 机编队提高生存率
    if (countMission(E, 'ROC', 'cap') < capWant) {
      var sts = [{ lat: 24.4, lon: 121.9 }, { lat: 23.2, lon: 121.6 }, { lat: 25.2, lon: 121.9 }, { lat: 22.4, lon: 121.0 }];
      var st = sts[countMission(E, 'ROC', 'cap') % sts.length];
      tryLaunch(E, 'ROC', ['F-16V', 'F-16C70', 'IDF', 'Mirage-2000'], flightSize, { type: 'cap', orbit: st, orbitR: 35, wp: [st] });
    }
    // 反舰突击 (对已探测的两栖船团/水面编队)
    var shipT = bestTrack(E, 'ROC', function (t) { return t.dom === 'surface' && t.side === 'PLA'; });
    if (shipT && countMission(E, 'ROC', 'asuw') < (anyLanding ? 5 : 3)) {
      var sp = standoff({ lat: 23.9, lon: 121.4 }, shipT, 110);
      tryLaunch(E, 'ROC', ['F-16V', 'F-16C70', 'IDF'], 2, { type: 'asuw', wp: [sp], orbit: sp, orbitR: 20, target: shipT.uid });
    }
    // 对陆反击 (万剑弹打大陆沿海机场)
    if (hrs > 6 && countMission(E, 'ROC', 'strike') < 2) {
      var gt = bestTrack(E, 'ROC', function (t) { return t.dom === 'base' && t.side === 'PLA'; });
      if (gt) {
        var sp2 = standoff({ lat: 24.2, lon: 120.6 }, gt, 190);
        tryLaunch(E, 'ROC', ['IDF', 'F-16V'], 2, { type: 'strike', wp: [sp2], orbit: sp2, orbitR: 18, target: gt.uid });
      }
    }
    // 反潜
    if (countMission(E, 'ROC', 'asw') < 1)
      tryLaunch(E, 'ROC', ['P-3C'], 1, { type: 'asw', orbit: { lat: 23.6, lon: 121.9 }, orbitR: 70, wp: [{ lat: 23.6, lon: 121.9 }] });
    // 攻击直升机 → 登陆场
    var actBh = Object.keys(E.beachheads).filter(function (k) { return E.beachheads[k].active; });
    if (actBh.length && countMission(E, 'ROC', 'helo_strike') < 3) {
      var bb = TWG.THEATER.idx.beach[actBh[0]];
      tryLaunch(E, 'ROC', ['AH-64E', 'AH-1W'], 4, { type: 'helo_strike', wp: [{ lat: bb.lat, lon: bb.lon }],
        orbit: { lat: bb.lat + 0.12, lon: bb.lon + 0.14 }, orbitR: 12 });
    }

    /* ---------- 海上：分散 + 打了就跑 ---------- */
    var refuges = [{ lat: 24.60, lon: 121.88 }, { lat: 23.98, lon: 121.63 }, { lat: 22.75, lon: 121.15 },
      { lat: 25.16, lon: 121.76 }, { lat: 22.60, lon: 120.26 }];
    E.alive('ROC', 'surface').forEach(function (u) {
      if (u.state === 'inport') u.state = 'enroute';
      if (!u.dashing) u.emcon = 0;                 // 雷达静默、依靠岸基与E-2K目标指示
      var atk = bestTrack(E, 'ROC', function (t) { return t.dom === 'surface' && t.side === 'PLA'; }, u);
      var maxR = 0;
      Object.keys(u.ammo).forEach(function (k) {
        var w = TWG.WEAPONS[k];
        if (w && (w.type === 'ashm') && u.ammo[k] > 0) maxR = Math.max(maxR, w.range);
      });
      if (atk && maxR > 0 && !u.dashing) {
        var dd = d(u, atk);
        // 只有高价值目标(两栖/大舰)才值得暴露位置出击
        var worth = (atk.role === 'lst' || atk.role === 'lpd' || atk.role === 'lhd' || atk.role === 'lha' ||
          atk.role === 'sealift' || atk.role === 'barge' || atk.role === 'cv' || atk.role === 'ddg');
        if (worth && dd > maxR * 0.85 && dd < maxR * 2.6 && (u.role === 'corvette' || u.role === 'fac')) {
          u.dashing = 1; u.emcon = 1; u.wp = [standoff(u, atk, maxR * 0.8)]; u.mission = { type: 'hit_and_run' };
          return;
        }
      }
      if (u.dashing && (maxR === 0 || !atk)) {
        u.dashing = 0;
        u.wp = [refuges[u.uid % refuges.length]]; u.mission = { type: 'refuge' };
      }
      // 小型飞弹艇/巡逻舰：分散疏泊于渔港，不主动暴露
      u.hidden = (!u.dashing && (u.role === 'fac' || u.role === 'patrol' || u.role === 'minelayer' || u.role === 'corvette')) ? 1 : 0;
      if (!u.wp.length && !u.dashing) {
        // 大型舰艇东岸生存机动
        var r = refuges[u.uid % refuges.length];
        if (d(u, r) > 25) { u.wp = [r]; u.mission = { type: 'survive' }; }
      }
      if (u.hp / u.hp0 < 0.4 && !u.retiring) { u.retiring = 1; u.dashing = 0; u.wp = [refuges[(u.uid + 2) % refuges.length]]; }
    });
    // 布雷
    E.alive('ROC', 'surface').forEach(function (u) {
      if (u.role !== 'minelayer' || (u.P.mines || 0) <= 0) return;
      if (u.minesLaid >= 3) return;
      var sc = E.scenario;
      var plan = (sc.landingPlan || []).slice(0, 4);
      if (!plan.length) return;
      var pick = plan[(u.minesLaid || 0) % plan.length];
      var beach = TWG.THEATER.idx.beach[pick.beach] || registerBeach(pick);
      if (!beach) return;
      var target = seaward(beach, 12);
      if (d(u, target) > 8) { u.wp = [target]; u.mission = { type: 'minelay', beach: pick.beach }; return; }
      E.mines = E.mines || [];
      E.mines.push({ lat: target.lat, lon: target.lon, r: 11, density: 0.5, side: 'ROC', beach: pick.beach });
      u.minesLaid = (u.minesLaid || 0) + 1;
      E.event('mine', 'ROC', '⚑ ' + u.name + ' 在 ' + beach.name + ' 外海布设水雷障碍区（第 ' + u.minesLaid + ' 场）', target);
      u.wp = [];
    });
    // 潜艇伏击
    var ambush = [{ lat: 23.9, lon: 119.7 }, { lat: 24.6, lon: 120.0 }, { lat: 22.8, lon: 119.5 }];
    E.alive('ROC', 'sub').forEach(function (u) {
      if (u.state === 'inport') u.state = 'enroute';
      var box = ambush[u.uid % ambush.length];
      if (!u.wp.length && d(u, box) > 30) { u.wp = [box]; u.emcon = 0; u.mission = { type: 'ambush' }; }
    });

    /* ---------- 地面：向受威胁登陆场机动 ---------- */
    var threats = Object.keys(E.beachheads).filter(function (k) { return E.beachheads[k].active; })
      .map(function (k) { return { k: k, b: TWG.THEATER.idx.beach[k], bh: E.beachheads[k] }; })
      .filter(function (o) { return o.b; })
      .sort(function (a, b) { return b.bh.cp - a.bh.cp; });
    if (threats.length) {
      E.alive('ROC', 'ground').forEach(function (u) {
        if (u.state === 'mobilizing') return;
        if (u.role === 'ashm_bn' || u.role === 'lacm_bn') return;
        // 遭重创的部队后撤重整，而非原地被歼
        if (u.broken || u.cp < u.cp0 * 0.3) {
          if (!u.pullback) {
            u.pullback = 1;
            var away = G.moveTo(u, G.bearing(threats[0].b, u), 45);
            u.moveTo = away;
          }
          return;
        }
        var t = threats[u.uid % Math.min(threats.length, 3)];
        var dd = d(u, t.b);
        if (dd < 22) { u.moveTo = null; return; }
        if (u.role === 'armor_bde' || u.role === 'mech_bde' || u.role === 'reserve_bde' || u.role === 'marine_bde' || u.role === 'sof') {
          if (!u.moveTo || d(u.moveTo, t.b) > 40) u.moveTo = { lat: t.b.lat + E.rng.range(-0.08, 0.08), lon: t.b.lon + E.rng.range(-0.08, 0.08) };
        }
      });
      // HIMARS / 炮兵 进入射程
      E.alive('ROC', 'ground').forEach(function (u) {
        if (u.role !== 'mlrs_bn' && u.role !== 'arty_bn') return;
        var t = threats[0];
        var rng = u.role === 'mlrs_bn' ? 70 : 26;
        if (d(u, t.b) > rng) u.moveTo = standoff({ lat: t.b.lat + 0.35, lon: t.b.lon + 0.35 }, t.b, rng * 0.7);
        else if (u.lastFire > 0 && E.t - u.lastFire < 240) {
          u.moveTo = { lat: u.lat + E.rng.range(-0.05, 0.05), lon: u.lon + E.rng.range(-0.05, 0.05) };  // 打了就跑
        }
      });
    }
    // 岸置反舰连机动隐蔽
    E.alive('ROC', 'ground').forEach(function (u) {
      if (u.role !== 'ashm_bn') return;
      if (u.lastFire > 0 && E.t - u.lastFire < 300 && !u.moveTo)
        u.moveTo = { lat: u.lat + E.rng.range(-0.05, 0.05), lon: u.lon + E.rng.range(-0.05, 0.05) };
    });
  }

  /* =====================  美 / 日  ==================================== */
  function us(E) {
    facilityTracks(E, 'US');
    // 航母打击群保持 1200km 外
    E.alive('US', 'surface').forEach(function (u) {
      if (!u.wp.length) {
        var stn = u.group === 'CSG-US1' ? { lat: 20.0, lon: 127.5 } : { lat: 25.4, lon: 128.2 };
        u.wp = [{ lat: stn.lat + ((u.uid % 7) - 3) * 0.12, lon: stn.lon + ((u.uid % 5) - 2) * 0.14 }];
        u.mission = { type: 'sea_control' };
      }
      // DF-21D/DF-26 威胁下的规避机动
      if (u.hitsTaken > 0 && !u.evading) { u.evading = 1; u.wp = [{ lat: u.lat - 1.5, lon: u.lon + 2.2 }]; }
    });
    // 核潜艇进入海峡东口与两栖轴线
    var boxes = [{ lat: 24.2, lon: 122.4 }, { lat: 22.6, lon: 120.9 }, { lat: 25.3, lon: 122.2 },
      { lat: 23.4, lon: 121.9 }, { lat: 21.8, lon: 120.6 }];
    E.alive('US', 'sub').forEach(function (u) {
      var t = bestTrack(E, 'US', function (tr) {
        return tr.dom === 'surface' && tr.side === 'PLA' &&
          (tr.role === 'lst' || tr.role === 'lpd' || tr.role === 'lhd' || tr.role === 'lha' || tr.role === 'sealift' || tr.role === 'barge' || tr.role === 'cv');
      }, u);
      if (t && d(u, t) < 420) { u.wp = [standoff(u, t, 45)]; u.emcon = 0; u.mission = { type: 'sub_hunt' }; return; }
      if (!u.wp.length) { u.wp = [boxes[u.uid % boxes.length]]; u.emcon = 0; u.mission = { type: 'sub_patrol' }; }
    });
    // 航空兵
    if (countMission(E, 'US', 'sweep') < 4) {
      var sp = [{ lat: 24.6, lon: 123.4 }, { lat: 23.4, lon: 122.8 }, { lat: 25.6, lon: 123.2 }, { lat: 22.4, lon: 122.0 }][countMission(E, 'US', 'sweep') % 4];
      tryLaunch(E, 'US', ['F-22A', 'F-35A'], 4, { type: 'sweep', orbit: sp, orbitR: 40, wp: [sp] });
    }
    var shipT = bestTrack(E, 'US', function (t) { return t.dom === 'surface' && t.side === 'PLA'; });
    if (shipT && countMission(E, 'US', 'asuw') < 2) {
      var sp2 = standoff({ lat: 20.0, lon: 128.0 }, shipT, 480);
      tryLaunch(E, 'US', ['B-1B'], 2, { type: 'asuw', wp: [sp2], orbit: sp2, orbitR: 40, target: shipT.uid });
    }
  }
  function jp(E) {
    facilityTracks(E, 'JP');
    E.alive('JP', 'surface').forEach(function (u) {
      if (!u.wp.length) u.wp = [{ lat: 26.0 + ((u.uid % 5) - 2) * 0.2, lon: 127.4 + ((u.uid % 3) - 1) * 0.25 }];
    });
    if (countMission(E, 'JP', 'cap') < 2)
      tryLaunch(E, 'JP', ['F-35A'], 2, { type: 'cap', orbit: { lat: 25.6, lon: 125.6 }, orbitR: 50, wp: [{ lat: 25.6, lon: 125.6 }] });
  }

  /* =====================  战场危险源 (水雷/浅滩)  ====================== */
  function hazards(E) {
    if (!E.mines || !E.mines.length) return;
    for (var i = 0; i < E.units.length; i++) {
      var u = E.units[i];
      if (u.dead || u.side !== 'PLA' || u.domain !== 'surface') continue;
      if (u.spd <= 0) continue;
      for (var m = 0; m < E.mines.length; m++) {
        var f = E.mines[m];
        if (f.density <= 0) continue;
        if (!G.nearBox(u, f, f.r)) continue;
        if (d(u, f) > f.r) continue;
        var p = f.density * 0.055 * (u.P.lift ? 1.4 : 1) * (u.role === 'barge' || u.role === 'sealift' ? 1.6 : 1);
        if (E.rng.chance(p)) {
          f.density = Math.max(0, f.density - 0.06);
          var W = { name: '水雷', warhead: 300, pk: 1, type: 'mine' };
          E.event('mine', 'ROC', '💣 ' + u.name + ' 触雷！（' + (TWG.THEATER.idx.beach[f.beach] || {}).name + ' 外海雷区）', u);
          E.applyDamage(u, W, 1, { side: 'ROC', from: -1, n: 1 });
        }
      }
    }
    // 扫雷: PLA 056A/扫雷力量随时间清除
    for (var k = 0; k < E.mines.length; k++) {
      var fz = E.mines[k];
      var sweepers = 0;
      for (var j = 0; j < E.units.length; j++) {
        var s = E.units[j];
        if (s.dead || s.side !== 'PLA' || s.domain !== 'surface') continue;
        if (s.role !== 'corvette' && s.role !== 'fac') continue;
        if (G.nearBox(s, fz, fz.r + 6) && d(s, fz) < fz.r + 6) sweepers++;
      }
      if (sweepers > 0) fz.density = Math.max(0, fz.density - 0.006 * sweepers);
    }
  }

  TWG.AI = {
    think: function (E, side) {
      G = TWG.geo;
      if (side === 'PLA') pla(E);
      else if (side === 'ROC') roc(E);
      else if (side === 'US') us(E);
      else if (side === 'JP') jp(E);
    },
    facilityTracks: facilityTracks,
    amphibHour: amphibHour
  };
})(typeof window !== 'undefined' ? window : globalThis);
