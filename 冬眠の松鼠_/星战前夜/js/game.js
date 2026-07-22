"use strict";

function fmtNum(n){ return Math.round(n).toLocaleString("en-US"); }
function fmtISK(n){ return fmtNum(n) + " ISK"; }
function fmtDist(m){
  m = Math.max(0, m);
  if (m < 10000) return fmtNum(m) + " 米";
  if (m < .1 * DATA.AU) return fmtNum(m/1000) + " 千米";
  return (m / DATA.AU).toFixed(1) + " AU";
}
function fmtTime(s){
  s = Math.max(0, Math.ceil(s));
  const d = Math.floor(s/86400), h = Math.floor(s%86400/3600), m = Math.floor(s%3600/60), ss = s%60;
  if (d) return `${d}天 ${h}小时`;
  if (h) return `${h}小时 ${m}分`;
  if (m) return `${m}分 ${ss}秒`;
  return `${ss}秒`;
}
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function rand(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function hypot(x,y){ return Math.sqrt(x*x+y*y); }
function mulberry(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function strSeed(s){ let h = 2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const G = {
  state: null, space: null, me: null, st: null, mods: null,
  sel: null, eid: 1,
  SAVE_KEY: "eve_web_save_v1",
};

function ui(fn, ...args){
  try { if (window.UI && UI[fn]) UI[fn](...args); } catch(e){ console.error(e); }
}
function panels(fn, ...args){
  try { if (window.Panels && Panels[fn]) Panels[fn](...args); } catch(e){ console.error(e); }
}

/* ================= pilot / persistence ================= */

G.newPilot = function(race, name){
  const skills = {};
  for (const [id,lvl] of Object.entries(DATA.START_SKILLS)) skills[id] = { lvl, sp: DATA.LVL_SP[lvl]*DATA.SKILLS[id].rank };
  const rookie = DATA.RACES[race].rookie;
  const st = {
    v:1,
    pilot: { name, race, isk:25000, kills:0, missionsDone:0, standing:0, skills, queue:[], lastSkillT: Date.now() },
    ship: G.makeShip(rookie),
    assets: {},
    loc: { system:"jita", docked: DATA.SYSTEMS.jita.stations[0].name, x:0, y:0 },
    mission: null, offers: {},
    dest: null, route: [], autopilot: false,
    journal: [{ t: Date.now(), amt: 25000, why: "国家新兵补助金" }],
    tut: {}, created: Date.now(),
  };
  G.state = st;
  G.hangar().items.push({ id:"miner1", qty:1 });
  G.recalc(); G.buildMods();
  G.save();
};

G.makeShip = function(typeId){
  const d = DATA.SHIPS[typeId];
  const fit = { hi:[], mid:[], low:[] };
  for (const r of ["hi","mid","low"]) for (let i=0;i<d.slots[r];i++) fit[r].push(null);
  if (d.cls === "rookie"){ fit.hi[0] = "civ_gun"; fit.hi[1] = "civ_miner"; }
  return { typeId, fit, cargo:[], ore:[], sh:d.shield, ar:d.armor, hu:d.hull, cap:d.cap };
};

G.save = function(){
  if (!G.state) return;
  if (G.space && G.me){ G.state.loc.x = G.me.x; G.state.loc.y = G.me.y; }
  try { localStorage.setItem(G.SAVE_KEY, JSON.stringify(G.state)); } catch(e){}
};
G.hasSave = function(){ try { return !!localStorage.getItem(G.SAVE_KEY); } catch(e){ return false; } };
G.load = function(){
  let raw = null;
  try { raw = localStorage.getItem(G.SAVE_KEY); } catch(e){}
  if (!raw) return false;
  try { G.state = JSON.parse(raw); } catch(e){ return false; }
  G.recalc(); G.buildMods();
  if (!G.state.loc.docked){
    G.loadSystem(G.state.loc.system);
    G.me.x = G.state.loc.x; G.me.y = G.state.loc.y;
  }
  return true;
};
G.reset = function(){ try { localStorage.removeItem(G.SAVE_KEY); } catch(e){} location.reload(); };

G.hangarKey = function(){ return G.state.loc.docked; };
G.hangar = function(key){
  key = key || G.hangarKey();
  if (!key) return { items:[], ships:[] };
  if (!G.state.assets[key]) G.state.assets[key] = { items:[], ships:[] };
  return G.state.assets[key];
};

/* ================= items ================= */

G.addItem = function(list, id, qty){
  const s = list.find(i=>i.id===id);
  if (s) s.qty += qty; else list.push({ id, qty });
};
G.remItem = function(list, id, qty){
  const s = list.find(i=>i.id===id);
  if (!s || s.qty < qty) return false;
  s.qty -= qty;
  if (s.qty <= 0) list.splice(list.indexOf(s),1);
  return true;
};
G.countItem = function(list, id){ const s = list.find(i=>i.id===id); return s ? s.qty : 0; };
G.listVol = function(list){ return list.reduce((a,i)=>a + DATA.item(i.id).vol * i.qty, 0); };
G.cargoUsed = function(){ return G.listVol(G.state.ship.cargo); };
G.oreUsed = function(){ return G.listVol(G.state.ship.ore); };

G.addOre = function(id, units){
  const d = DATA.item(id);
  const sd = DATA.SHIPS[G.state.ship.typeId];
  let rest = units;
  if (sd.oreHold > 0){
    const space = Math.max(0, sd.oreHold - G.oreUsed());
    const fit = Math.min(rest, Math.floor(space / d.vol));
    if (fit > 0){ G.addItem(G.state.ship.ore, id, fit); rest -= fit; }
  }
  const space2 = Math.max(0, G.st.cargoCap - G.cargoUsed());
  const fit2 = Math.min(rest, Math.floor(space2 / d.vol));
  if (fit2 > 0){ G.addItem(G.state.ship.cargo, id, fit2); rest -= fit2; }
  return units - rest;
};

/* ================= skills ================= */

G.skillLvl = function(id){ const s = G.state.pilot.skills[id]; return s ? s.lvl : 0; };
G.skillKnown = function(id){ return !!G.state.pilot.skills[id]; };
G.meetsReq = function(req){ return (req||[]).every(([id,lvl]) => G.skillLvl(id) >= lvl); };

G.injectBook = function(id){
  const sk = DATA.SKILLS[id];
  if (!sk) return;
  if (G.skillKnown(id)) return ui("toast","你已掌握该技能","warn");
  if (!G.meetsReq(sk.req)) return ui("toast","不满足前置技能要求","bad");
  const h = G.state.loc.docked ? G.hangar() : null;
  if (h && G.remItem(h.items, "book_"+id, 1)){}
  else if (G.remItem(G.state.ship.cargo, "book_"+id, 1)){}
  else return ui("toast","没有对应的技能书","bad");
  G.state.pilot.skills[id] = { lvl:0, sp:0 };
  ui("toast","已注入技能：" + sk.cn, "good");
  panels("refreshOpen");
};

G.queueTrain = function(id){
  const sk = DATA.SKILLS[id];
  if (!G.skillKnown(id)) return ui("toast","需要先注入技能书","bad");
  const queued = G.state.pilot.queue.filter(q=>q.id===id).length;
  const target = G.skillLvl(id) + queued + 1;
  if (target > 5) return ui("toast","该技能已达到或排队至 V 级","warn");
  if (!G.meetsReq(sk.req)) return ui("toast","不满足前置技能要求","bad");
  G.state.pilot.queue.push({ id, toLvl: target });
  ui("toast",`已加入训练队列：${sk.cn} ${DATA.ROMAN[target-1]}`);
  panels("refreshOpen");
};

G.updateSkills = function(){
  const p = G.state.pilot;
  const now = Date.now();
  let sp = (now - p.lastSkillT) / 1000 * DATA.SP_RATE;
  p.lastSkillT = now;
  while (sp > 0 && p.queue.length){
    const q = p.queue[0], sk = DATA.SKILLS[q.id], s = p.skills[q.id];
    if (!s){ p.queue.shift(); continue; }
    const target = DATA.LVL_SP[q.toLvl] * sk.rank;
    const need = target - s.sp;
    if (need <= sp){
      s.sp = target; s.lvl = q.toLvl; sp -= need;
      p.queue.shift();
      Sound.play("levelup");
      ui("aura", `技能训练完成：<b class="hl">${sk.cn} ${DATA.ROMAN[q.toLvl-1]}</b>`);
      G.recalc();
      panels("refreshOpen");
    } else { s.sp += sp; sp = 0; }
  }
};
G.queueETA = function(){
  let t = 0;
  const p = G.state.pilot;
  for (const q of p.queue){
    const sk = DATA.SKILLS[q.id], s = p.skills[q.id];
    let base = (q.toLvl - 1 > (s ? s.lvl : 0)) ? DATA.LVL_SP[q.toLvl-1]*sk.rank : (s ? s.sp : 0);
    if (p.queue[0] === q) base = s.sp;
    t += Math.max(0, DATA.LVL_SP[q.toLvl]*sk.rank - Math.max(base, s?s.sp:0)) / DATA.SP_RATE;
  }
  return t;
};
G.totalSP = function(){
  return Object.values(G.state.pilot.skills).reduce((a,s)=>a+Math.floor(s.sp),0);
};

/* ================= stats ================= */

G.shipData = function(){ return DATA.SHIPS[G.state.ship.typeId]; };

G.recalc = function(){
  if (!G.state) return;
  const S = G.state.ship, d = DATA.SHIPS[S.typeId];
  const lv = G.skillLvl;
  const st = {
    maxSpeed: d.speed * (1 + .05*lv("navigation")),
    inertia: d.inertia * (1 - .05*lv("evasive")) * (1 - .02*lv("spaceship")),
    mass: d.mass,
    shieldMax: d.shield, shieldRt: d.shieldRt * (1 - .05*lv("shieldOp")),
    armorMax: d.armor * (1 + .05*lv("hullUpg")),
    hullMax: d.hull * (1 + .05*lv("mechanics")),
    capMax: d.cap * (1 + .05*lv("capMgmt")), capRt: d.capRt * (1 - .05*lv("capOp")),
    sig: d.sig,
    scanRes: d.scanRes * (1 + .05*lv("sigAnalysis")),
    tgtRange: d.tgtRange * (1 + .05*lv("longRange")),
    maxTargets: Math.min(d.maxTargets, 2 + lv("targeting")),
    cargoCap: d.cargo,
    cpuMax: d.cpu * (1 + .05*lv("cpuMgmt")),
    pgMax: d.pg * (1 + .05*lv("pgMgmt")),
    resShield: d.resShield.slice(), resArmor: d.resArmor.slice(), resHull: d.resHull.slice(),
    dmgMult: { laser:1 + .02*lv("gunnery"), hybrid:1 + .02*lv("gunnery"), proj:1 + .02*lv("gunnery"), missile:1 + .02*lv("missiles") },
    miningMult: d.miningMult * (1 + .05*lv("mining")) * (1 + .05*lv("astrogeology")),
    repMult: 1 + .05*lv("repair"),
    boostMult: 1,
  };
  for (const b of (d.bonuses||[])){
    const l = lv(b.skill);
    if (!l) continue;
    if (b.wg === "mining") st.miningMult *= (1 + b.per*l);
    else if (b.wg === "cargo") st.cargoCap *= (1 + b.per*l);
    else if (b.wg === "repair") st.repMult *= (1 + b.per*l);
    else st.dmgMult[b.wg] *= (1 + b.per*l);
  }
  let shieldAdd = 0;
  for (const r of ["hi","mid","low"]) for (const tid of S.fit[r]){
    if (!tid) continue;
    const m = DATA.MODULES[tid];
    if (m.shieldAdd) shieldAdd += m.shieldAdd;
    if (m.sigAdd) st.sig += m.sigAdd;
    if (m.capRtMult) st.capRt *= m.capRtMult;
    if (m.scanResMult) st.scanRes *= m.scanResMult;
    if (m.tgtRangeMult) st.tgtRange *= m.tgtRangeMult;
    if (m.cargoMult) st.cargoCap *= m.cargoMult;
    if (m.miningMult) st.miningMult *= m.miningMult;
    if (m.speedMult && m.type === "passive") st.maxSpeed *= m.speedMult;
    if (m.inertiaMult) st.inertia *= m.inertiaMult;
    if (m.cpuMult) st.cpuMax *= m.cpuMult;
    if (m.pgMult) st.pgMax *= m.pgMult;
    if (m.dmgMult) for (const k in m.dmgMult) st.dmgMult[k] *= m.dmgMult[k];
    if (m.dcBonus){
      st.resShield = st.resShield.map(r2 => 1-(1-r2)*(1-m.dcBonus.sh));
      st.resArmor = st.resArmor.map(r2 => 1-(1-r2)*(1-m.dcBonus.ar));
      st.resHull = st.resHull.map(r2 => 1-(1-r2)*(1-m.dcBonus.hu));
    }
  }
  st.shieldMax = (st.shieldMax + shieldAdd) * (1 + .05*lv("shieldMgmt"));
  G.st = st;
  S.sh = Math.min(S.sh, st.shieldMax);
  S.ar = Math.min(S.ar, st.armorMax);
  S.hu = Math.min(S.hu, st.hullMax);
  S.cap = Math.min(S.cap, st.capMax);
};

G.fitUsage = function(){
  const S = G.state.ship;
  let cpu = 0, pg = 0;
  const wu = 1 - .05*G.skillLvl("weaponUpg");
  for (const r of ["hi","mid","low"]) for (const tid of S.fit[r]){
    if (!tid) continue;
    const m = DATA.MODULES[tid];
    const isWeap = m.type === "turret" || m.type === "launcher";
    cpu += m.cpu * (isWeap ? wu : 1);
    pg += m.pg;
  }
  return { cpu, pg };
};

G.buildMods = function(){
  const S = G.state.ship;
  G.mods = { hi:[], mid:[], low:[] };
  for (const r of ["hi","mid","low"]){
    G.mods[r] = S.fit[r].map(tid => tid ? ({ tid, on:false, ct:0, cycle:(DATA.MODULES[tid].cycle||0) }) : null);
  }
};

G.getMaxSpeed = function(){
  let v = G.st.maxSpeed;
  for (const m of G.mods.mid){ if (m && m.on && DATA.MODULES[m.tid].type==="prop") v *= DATA.MODULES[m.tid].speedMult; }
  return v;
};
G.getSig = function(){
  let s = G.st.sig;
  for (const m of G.mods.mid){ if (m && m.on && DATA.MODULES[m.tid].sigMult) s *= DATA.MODULES[m.tid].sigMult; }
  return s;
};

/* ================= system building ================= */

G.entById = function(id){ return G.space ? G.space.ents.find(e=>e.id===id) : null; };
G.dist = function(a, b){ return hypot(a.x-b.x, a.y-b.y); };
G.distTo = function(e){ return hypot(G.me.x-e.x, G.me.y-e.y); };

function oreTable(sec){
  if (sec >= .5) return [["veldspar",.34],["scordite",.24],["plagioclase",.13],["pyroxeres",.13],["omber",.08],["kernite",.08]];
  if (sec > 0) return [["veldspar",.15],["plagioclase",.12],["omber",.1],["kernite",.15],["jaspet",.18],["hemorphite",.15],["hedbergite",.15]];
  return [["spodumain",.3],["crokite",.25],["bistot",.22],["arkonor",.23]];
}
function weightedPick(rng, table){
  let r = rng(), acc = 0;
  for (const [k,w] of table){ acc += w; if (r <= acc) return k; }
  return table[table.length-1][0];
}

G.spawnNpc = function(nid, x, y, mission){
  const nd = DATA.NPCS[nid];
  const e = {
    id: G.eid++, kind:"npc", npc:nid, name:nd.cn, type:nd.cls + " · " + DATA.FACTION_CN[nd.faction],
    x, y, vx:0, vy:0,
    sh:nd.shield, ar:nd.armor, hu:nd.hull,
    aggro:false, ct:rand(0,2), lockT:0, webbedT:0, mission:!!mission,
  };
  G.space.ents.push(e);
  return e;
};

function beltSpawns(sec){
  const r = Math.random, f = [];
  if (sec >= .9){ if (r()<.5) f.push("g_f1"); }
  else if (sec >= .8){ f.push("g_f1"); if (r()<.5) f.push("g_f1"); }
  else if (sec >= .5){ f.push("g_f1","g_f1"); if (r()<.5) f.push("g_d1"); }
  else if (sec > 0){ f.push("g_f2","g_f2"); if (r()<.6) f.push("g_d1"); if (r()<.4) f.push("g_c1"); }
  else { f.push("s_c1"); if (r()<.7) f.push("s_c1"); if (r()<.5) f.push("s_f2"); if (r()<.55) f.push("s_bs"); }
  return f;
}

G.loadSystem = function(sysId){
  const sd = DATA.SYSTEMS[sysId];
  const rng = mulberry(strSeed(sysId));
  const ents = [];
  G.space = { sysId, ents, fx:[], pending:[], t:0 };
  G.eid = 1;
  ents.push({ id:G.eid++, kind:"sun", name:sd.cn + " - 恒星", type:"恒星", x:0, y:0, r:2e9 });
  const planets = [];
  for (let i=0;i<sd.planets;i++){
    const dist = (0.4 + Math.pow(i+1, 1.55) * 1.5) * DATA.AU * (0.9 + rng()*0.2);
    const ang = rng() * Math.PI * 2;
    const pt = DATA.PLANET_TYPES[Math.floor(rng()*DATA.PLANET_TYPES.length)];
    const p = { id:G.eid++, kind:"planet", name:`${sd.cn} ${DATA.ROMAN[i]}`, type:pt.cn, color:pt.color,
      x: Math.cos(ang)*dist, y: Math.sin(ang)*dist, r: 4e6 + rng()*3e7 };
    planets.push(p); ents.push(p);
  }
  for (let b=0;b<sd.belts;b++){
    const p = planets[b % planets.length];
    const ang = rng()*Math.PI*2;
    const bx = p.x + Math.cos(ang)*2.2e8, by = p.y + Math.sin(ang)*2.2e8;
    const belt = { id:G.eid++, kind:"belt", name:`${p.name} - 小行星带 ${b+1}`, type:"小行星带", x:bx, y:by };
    ents.push(belt);
    const n = 8 + Math.floor(rng()*9);
    const table = oreTable(sd.sec);
    for (let i=0;i<n;i++){
      const ore = weightedPick(rng, table);
      const od = DATA.ORES[ore];
      const m3 = 1500 + rng()*7000;
      const ra = ang + Math.PI/2 + (rng()-.5)*1.2;
      ents.push({ id:G.eid++, kind:"roid", ore, name:`小行星 (${od.cn})`, type:"小行星",
        x: bx + Math.cos(ra)*(rng()*4e4) + (rng()-.5)*3e4,
        y: by + Math.sin(ra)*(rng()*4e4) + (rng()-.5)*3e4,
        units: Math.floor(m3 / od.vol), r: 500 + rng()*1200 });
    }
    for (const nid of beltSpawns(sd.sec)){
      const id2 = sd.npc === "serpentis" ? nid.replace("g_","s_") : nid;
      G.spawnNpc(id2, bx + rand(-2e4,2e4), by + rand(-2e4,2e4));
    }
  }
  sd.stations.forEach((stn, i) => {
    const p = planets[Math.min(planets.length-1, 3+i)] || planets[0];
    ents.push({ id:G.eid++, kind:"station", name:stn.name, type:"空间站", agent:stn.agent||null,
      x: p.x + 3e8, y: p.y - 1.5e8, r: 30000, undockDir: rng()*Math.PI*2 });
  });
  for (const gs of sd.gates){
    const gd = DATA.SYSTEMS[gs];
    const ang = Math.atan2(gd.my - sd.my, gd.mx - sd.mx);
    const dist = (12 + rng()*18) * DATA.AU;
    ents.push({ id:G.eid++, kind:"gate", name:`星门 (${gd.cn})`, type:"星门", dest:gs,
      x: Math.cos(ang)*dist, y: Math.sin(ang)*dist, r: 8000 });
  }
  const M = G.state.mission;
  if (M && M.status==="active" && M.type==="kill" && M.system===sysId && M.ships.length){
    const beacon = { id:G.eid++, kind:"beacon", name:"遭遇战信标：" + M.title, type:"信标",
      x: Math.cos(rng()*6.28)*8*DATA.AU, y: Math.sin(rng()*6.28)*8*DATA.AU };
    ents.push(beacon);
    M.ships.forEach((nid, i) => {
      const e = G.spawnNpc(nid, beacon.x + rand(-3e4,3e4), beacon.y + rand(-3e4,3e4), true);
      e.msIdx = i;
    });
  }
  G.me = { x:0, y:0, vx:0, vy:0, dir:[1,0], speedFrac:1, nav:null, warp:null, locks:[], activeTarget:null };
  G.sel = null;
  G.buildMods();
  ui("systemChanged");
};

/* ================= dock / undock / jump ================= */

G.doDock = function(stEnt){
  Sound.play("dock");
  G.state.loc.docked = stEnt.name;
  G.state.loc.system = G.space.sysId;
  G.space = null; G.me = null; G.sel = null;
  if (G.state.ship.typeId === "capsule"){
    const rookie = DATA.RACES[G.state.pilot.race].rookie;
    G.state.ship = G.makeShip(rookie);
    G.recalc(); G.buildMods();
    ui("aura", "保险公司为你提供了一艘新的新手船。舰船虽小，新伊甸依旧广阔。");
  }
  const S = G.state.ship;
  S.sh = G.st.shieldMax; S.cap = G.st.capMax;
  G.save();
  ui("enterDock");
};

G.undock = function(){
  if (!G.state.loc.docked) return;
  const stName = G.state.loc.docked;
  G.state.loc.docked = null;
  G.loadSystem(G.state.loc.system);
  const stEnt = G.space.ents.find(e=>e.kind==="station" && e.name===stName) || { x:0, y:0, r:30000, undockDir:0 };
  const a = stEnt.undockDir || 0;
  G.me.x = stEnt.x + Math.cos(a)*(stEnt.r + 2000);
  G.me.y = stEnt.y + Math.sin(a)*(stEnt.r + 2000);
  G.me.vx = Math.cos(a) * G.st.maxSpeed * .8;
  G.me.vy = Math.sin(a) * G.st.maxSpeed * .8;
  G.me.dir = [Math.cos(a), Math.sin(a)];
  G.me.nav = { mode:"heading", dir:[Math.cos(a), Math.sin(a)] };
  ui("exitDock");
  ui("toast","正在离站……");
  G.save();
};

G.doJump = function(gate){
  const from = G.space.sysId, dest = gate.dest;
  Sound.play("jump");
  const doIt = () => {
    G.state.loc.system = dest;
    G.loadSystem(dest);
    const back = G.space.ents.find(e=>e.kind==="gate" && e.dest===from);
    if (back){
      const a = rand(0, Math.PI*2);
      G.me.x = back.x + Math.cos(a)*rand(3000,9000);
      G.me.y = back.y + Math.sin(a)*rand(3000,9000);
    }
    const sd = DATA.SYSTEMS[dest];
    ui("toast", `跳跃完成 — ${sd.cn}（安全等级 ${sd.sec.toFixed(1)}）`, sd.sec < .5 ? "warn" : "");
    if (sd.sec < .5 && !G.state.tut.lowsec){
      G.state.tut.lowsec = 1;
      ui("aura","警告：你已进入低安全等级空域。CONCORD 不会在此保护你，海盗火力凶猛，收益与风险并存。");
    }
    if (G.state.route.length && G.state.route[0] === dest) G.state.route.shift();
    if (G.state.dest === dest){ G.state.autopilot = false; G.state.dest = null; ui("toast","已抵达目的地星系","good"); }
    G.save();
  };
  if (window.UI && UI.sessionChange) UI.sessionChange(`正在跳跃至 ${DATA.SYSTEMS[dest].cn} 恒星系……`, doIt);
  else doIt();
};

/* ================= navigation commands ================= */

G.cmdStop = function(){ if (!G.me || G.me.warp) return; G.me.nav = null; ui("toast","停船"); };
G.cmdApproach = function(id){
  const e = G.entById(id); if (!e || G.me.warp) return;
  G.me.nav = { mode:"approach", targetId:id, range:0 };
  ui("toast","接近 " + e.name);
};
G.cmdOrbit = function(id, range){
  const e = G.entById(id); if (!e || G.me.warp) return;
  G.me.nav = { mode:"orbit", targetId:id, range: range||5000 };
  ui("toast",`环绕 ${e.name} — ${fmtDist(range||5000)}`);
};
G.cmdKeep = function(id, range){
  const e = G.entById(id); if (!e || G.me.warp) return;
  G.me.nav = { mode:"keep", targetId:id, range: range||10000 };
  ui("toast",`与 ${e.name} 保持距离 ${fmtDist(range||10000)}`);
};
G.cmdHeading = function(dx, dy){
  if (!G.me || G.me.warp) return;
  const l = hypot(dx,dy) || 1;
  G.me.nav = { mode:"heading", dir:[dx/l, dy/l] };
};

G.warpTo = function(tx, ty, label, offset, then){
  if (!G.me || G.me.warp) return;
  const u = [tx-G.me.x, ty-G.me.y];
  const d = hypot(u[0],u[1]);
  if (d < 150000) { ui("toast","目标太近，无法跃迁（最小 150 km）","warn"); return; }
  const lx = tx - u[0]/d*(offset||0), ly = ty - u[1]/d*(offset||0);
  G.me.warp = { phase:"align", tx:lx, ty:ly, label, v:0, then: then||null };
  G.me.nav = null;
  ui("toast","校准中：跃迁至 " + label);
};

G.cmdWarpEnt = function(id, offset){
  const e = G.entById(id); if (!e) return;
  G.warpTo(e.x, e.y, e.name, (offset||0) + (e.r||0), null);
};

G.cmdDock = function(id){
  const e = G.entById(id); if (!e || e.kind!=="station") return;
  const d = G.distTo(e);
  const range = (e.r||0) + 2500;
  if (d <= range) return G.doDock(e);
  if (d < 150000){ G.me.nav = { mode:"approach", targetId:id, range, act:"dock" }; ui("toast","接近空间站准备停靠"); }
  else G.warpTo(e.x, e.y, e.name, e.r, { act:"dock", targetId:id, range });
};

G.cmdJumpGate = function(id){
  const e = G.entById(id); if (!e || e.kind!=="gate") return;
  const d = G.distTo(e);
  const range = 2500 + (e.r||0);
  if (d <= range) return G.doJump(e);
  if (d < 150000){ G.me.nav = { mode:"approach", targetId:id, range, act:"jump" }; ui("toast","接近星门"); }
  else G.warpTo(e.x, e.y, e.name, e.r, { act:"jump", targetId:id, range });
};

G.cmdOpenWreck = function(id){
  const e = G.entById(id); if (!e || e.kind!=="wreck") return;
  const d = G.distTo(e);
  if (d <= 2500) return panels("loot", e);
  if (d < 150000){ G.me.nav = { mode:"approach", targetId:id, range:2400, act:"loot" }; ui("toast","接近残骸"); }
  else G.warpTo(e.x, e.y, e.name, 0, { act:"loot", targetId:id, range:2400 });
};

/* ================= targeting ================= */

G.lockTimeFor = function(sig){
  return 40000 / (G.st.scanRes * Math.pow(Math.asinh(sig), 2));
};

G.tryLock = function(id){
  const e = G.entById(id);
  if (!e || !G.me || G.me.warp) return;
  if (!["npc","roid","wreck"].includes(e.kind)) return ui("toast","无法锁定该目标","warn");
  if (G.me.locks.find(l=>l.id===id)) return;
  if (G.me.locks.length >= G.st.maxTargets) return ui("toast",`超出最大锁定数量（${G.st.maxTargets}）`,"warn");
  if (G.distTo(e) > G.st.tgtRange) return ui("toast","目标超出最大锁定距离","warn");
  const sig = e.kind==="npc" ? DATA.NPCS[e.npc].sig : 200;
  G.me.locks.push({ id, t:0, need: G.lockTimeFor(sig), done:false });
  Sound.play("locking");
};

G.unlock = function(id){
  G.me.locks = G.me.locks.filter(l=>l.id!==id);
  if (G.me.activeTarget === id) G.me.activeTarget = G.me.locks.find(l=>l.done)?.id || null;
  ui("updateTargets");
};

G.lockOf = function(id){ return G.me ? G.me.locks.find(l=>l.id===id) : null; };

/* ================= modules ================= */

G.toggleMod = function(row, i){
  const m = G.mods[row][i];
  if (!m || !G.me || G.me.warp) return;
  const md = DATA.MODULES[m.tid];
  if (md.type === "passive") return;
  if (m.on){ m.on = false; ui("toast", md.cn + "：关闭"); return; }
  if (["turret","launcher","miner","web"].includes(md.type)){
    const t = G.me.activeTarget ? G.entById(G.me.activeTarget) : null;
    const lock = t ? G.lockOf(t.id) : null;
    if (!t || !lock || !lock.done) return ui("toast","需要一个已锁定的目标","warn");
    if (md.type === "miner" && t.kind !== "roid") return ui("toast","采矿器只能对小行星使用","warn");
    if ((md.type === "turret" || md.type === "launcher" || md.type === "web") && t.kind !== "npc")
      return ui("toast","该武器无法对此目标使用","warn");
  }
  m.on = true; m.ct = 0;
  Sound.play("click");
};

G.deactivateAll = function(){
  for (const r of ["hi","mid","low"]) for (const m of G.mods[r]) if (m) { m.on = false; m.ct = 0; }
};

function moduleTick(dt){
  const S = G.state.ship;
  for (const row of ["hi","mid","low"]){
    G.mods[row].forEach((m) => {
      if (!m || !m.on) return;
      const md = DATA.MODULES[m.tid];
      if (md.type === "prop"){
        const drain = md.drain * dt;
        if (S.cap < drain){ m.on = false; ui("toast", md.cn + "：电容不足","warn"); }
        else S.cap -= drain;
        return;
      }
      if (md.type === "passive") return;
      m.ct -= dt;
      if (m.ct > 0) return;
      let tgt = null;
      if (["turret","launcher","miner","web"].includes(md.type)){
        tgt = G.me.activeTarget ? G.entById(G.me.activeTarget) : null;
        const lock = tgt ? G.lockOf(tgt.id) : null;
        if (!tgt || !lock || !lock.done){ m.on = false; return; }
        if (md.type === "miner" && tgt.kind !== "roid"){ m.on = false; return; }
        if (md.type !== "miner" && tgt.kind !== "npc"){ m.on = false; return; }
      }
      if (md.cap && S.cap < md.cap){ m.on = false; ui("toast", md.cn + "：电容不足","warn"); return; }
      if (fireModule(m, md, tgt)){
        if (md.cap) S.cap -= md.cap;
        m.ct = md.cycle;
      } else m.on = false;
    });
  }
}

function fireModule(m, md, tgt){
  switch(md.type){
    case "turret": return fireTurret(md, tgt);
    case "launcher": return fireLauncher(md, tgt);
    case "miner": return fireMiner(md, tgt);
    case "web": {
      if (G.distTo(tgt) > md.optimal){ ui("combat", `${md.cn}：目标超出作用距离`, "combat-info"); return false; }
      tgt.webbedT = md.cycle + .5;
      G.space.fx.push({ kind:"beam", ax:G.me.x, ay:G.me.y, bx:tgt.x, by:tgt.y, color:"#7fd0ff", t:.4, tid:tgt.id, follow:true });
      return true;
    }
    case "shieldBoost": {
      const S = G.state.ship;
      S.sh = Math.min(G.st.shieldMax, S.sh + md.boost * G.st.repMult * G.st.boostMult);
      Sound.play("shield");
      return true;
    }
    case "armorRep": {
      G.space.pending.push({ t: md.cycle, fn: () => {
        const S = G.state.ship;
        S.ar = Math.min(G.st.armorMax, S.ar + md.rep * G.st.repMult);
        Sound.play("repair");
      }});
      return true;
    }
  }
  return false;
}

function turretChance(w, dist, transversal, tgtSig){
  const ang = dist > 1 ? transversal / dist : 10;
  const a = (ang / w.tracking) * (w.sigRes / tgtSig);
  const b = Math.max(0, dist - w.optimal) / w.falloff;
  return Math.pow(.5, a*a + b*b);
}
function transversalOf(a, b){
  const rx = b.x-a.x, ry = b.y-a.y;
  const d = hypot(rx,ry) || 1;
  const rvx = (b.vx||0)-(a.vx||0), rvy = (b.vy||0)-(a.vy||0);
  const rad = (rvx*rx + rvy*ry)/d;
  const t2 = rvx*rvx + rvy*rvy - rad*rad;
  return Math.sqrt(Math.max(0,t2));
}

const WG_SOUND = { laser:"laser", hybrid:"hybrid", proj:"proj" };
const WG_COLOR = { laser:"#ffcf7d", hybrid:"#7db8ff", proj:"#ffffff" };

function fireTurret(md, tgt){
  const dist = G.distTo(tgt);
  if (dist > md.optimal + md.falloff * 3){ ui("combat", `${md.cn}：目标超出射程`, "combat-info"); return false; }
  Sound.play(WG_SOUND[md.wg]);
  G.space.fx.push({ kind:"beam", ax:G.me.x, ay:G.me.y, bx:tgt.x, by:tgt.y, color:WG_COLOR[md.wg], t:.25 });
  const nd = DATA.NPCS[tgt.npc];
  const chance = turretChance(md, dist, transversalOf(G.me, tgt), nd.sig);
  const roll = Math.random();
  if (roll > chance){ ui("combat", `你的 ${md.cn} 完全没有打中 ${tgt.name}`, "combat-info"); return true; }
  let mult = .5 + Math.random();
  let note = "命中";
  if (roll < chance * .02){ mult = 3; note = "完美命中！"; }
  else if (mult > 1.2) note = "穿透";
  else if (mult < .7) note = "擦过";
  const dmg = {};
  for (const k in md.dmg) dmg[k] = md.dmg[k] * mult * G.st.dmgMult[md.wg];
  const done = G.dealToNpc(tgt, dmg);
  ui("combat", `你的 ${md.cn} ${note} ${tgt.name}，造成 <b>${done.toFixed(1)}</b> 点伤害`, "combat-hit");
  return true;
}

function fireLauncher(md, tgt){
  const dist = G.distTo(tgt);
  if (dist > md.range){ ui("combat", `${md.cn}：目标超出导弹射程`, "combat-info"); return false; }
  Sound.play("missile");
  const eta = dist / md.mvel;
  G.space.fx.push({ kind:"missile", x:G.me.x, y:G.me.y, tid:tgt.id, speed:md.mvel, t:eta+1 });
  const tgtId = tgt.id;
  G.space.pending.push({ t: eta, fn: () => {
    const t2 = G.entById(tgtId);
    if (!t2 || t2.kind !== "npc") return;
    const nd = DATA.NPCS[t2.npc];
    const sigF = Math.min(1, nd.sig / md.exr);
    const dmg = {};
    for (const k in md.dmg) dmg[k] = md.dmg[k] * sigF * G.st.dmgMult.missile;
    G.space.fx.push({ kind:"boom", x:t2.x, y:t2.y, r:800, t:.5 });
    const done = G.dealToNpc(t2, dmg);
    ui("combat", `你的导弹命中 ${t2.name}，造成 <b>${done.toFixed(1)}</b> 点伤害`, "combat-hit");
  }});
  return true;
}

function fireMiner(md, tgt){
  const dist = G.distTo(tgt);
  if (dist > md.optimal){ ui("toast","目标超出采矿器作用距离","warn"); return false; }
  Sound.play("miner");
  G.space.fx.push({ kind:"minebeam", tid:tgt.id, t:md.cycle, color:"#8fe0d8" });
  const tgtId = tgt.id;
  G.space.pending.push({ t: md.cycle - .05, fn: () => {
    const rock = G.entById(tgtId);
    if (!rock) return;
    const od = DATA.ORES[rock.ore];
    const wantUnits = Math.floor(md.yield * G.st.miningMult / od.vol);
    const gotUnits = Math.min(wantUnits, rock.units);
    const added = G.addOre(rock.ore, gotUnits);
    rock.units -= added;
    if (added > 0) ui("combat", `采集了 ${fmtNum(added)} 单位 ${od.cn}（${(added*od.vol).toFixed(1)} m³）`, "combat-info");
    if (added < gotUnits){
      ui("toast","货柜已满","warn");
      G.mods.hi.forEach(m => { if (m && DATA.MODULES[m.tid].type==="miner") m.on = false; });
    }
    if (rock.units <= 0){
      ui("toast","该小行星已被采掘殆尽");
      G.removeEnt(rock);
    }
    panels("refreshCargo");
  }});
  return true;
}

/* ================= damage ================= */

function applyLayer(hp, res, dmg){
  let taken = 0;
  for (let i=0;i<4;i++){
    const k = DATA.DT[i];
    if (!dmg[k]) continue;
    const eff = dmg[k] * (1 - res[i]);
    const use = Math.min(hp - taken, eff);
    if (use > 0){ taken += use; dmg[k] -= use / (1 - res[i]); }
    if (taken >= hp) break;
  }
  return taken;
}

G.dealToNpc = function(e, dmg){
  const d = Object.assign({}, dmg);
  let total = 0;
  let t = applyLayer(e.sh, RES_SHIELD, d); e.sh -= t; total += t;
  if (e.sh <= 1){ t = applyLayer(e.ar, RES_ARMOR, d); e.ar -= t; total += t; }
  if (e.ar <= 1 && e.sh <= 1){ t = applyLayer(e.hu, RES_HULL, d); e.hu -= t; total += t; }
  if (!e.aggro){ e.aggro = true; e.lockT = 1; }
  if (e.hu <= 0) G.npcKilled(e);
  ui("updateTargets");
  return total;
};

G.npcKilled = function(e){
  const nd = DATA.NPCS[e.npc];
  Sound.play(nd.cls === "战列舰" ? "boomBig" : "boom");
  G.space.fx.push({ kind:"boom", x:e.x, y:e.y, r: nd.cls==="战列舰" ? 6000 : 2500, t:1.2 });
  G.pay(nd.bounty, "赏金 — " + nd.cn);
  G.state.pilot.kills++;
  ui("combat", `${e.name} 已被击毁。赏金 <b class="gold">${fmtISK(nd.bounty)}</b> 已入账`, "combat-hit");
  const loot = [];
  if (Math.random() < .8) loot.push({ id:"scraps", qty: 1 + Math.floor(Math.random()*3) });
  if (Math.random() < .3) loot.push({ id: DATA.FACTION_TAG[nd.faction], qty:1 });
  const pool = (nd.cls === "巡洋舰" || nd.cls === "战列舰") ? DATA.LOOT_MED : DATA.LOOT_SMALL;
  if (Math.random() < .15) loot.push({ id: pick(pool), qty:1 });
  G.space.ents.push({ id:G.eid++, kind:"wreck", name: e.name + "的残骸", type:"残骸",
    x:e.x, y:e.y, loot, t:600 });
  if (e.mission && G.state.mission && G.state.mission.type === "kill"){
    const M = G.state.mission;
    M.ships.splice(M.ships.indexOf(e.npc) >= 0 ? M.ships.indexOf(e.npc) : 0, 1);
    if (!M.ships.length){
      M.objectiveDone = true;
      ui("aura", `任务目标已全部消灭。返回 <b class="hl">${DATA.SYSTEMS[M.agentSystem].cn}</b> 的代理人处领取报酬。`);
    } else ui("toast", `任务目标剩余：${M.ships.length}`, "good");
  }
  G.removeEnt(e);
};

G.removeEnt = function(e){
  const i = G.space.ents.indexOf(e);
  if (i >= 0) G.space.ents.splice(i,1);
  if (G.me){
    G.me.locks = G.me.locks.filter(l=>l.id!==e.id);
    if (G.me.activeTarget === e.id) G.me.activeTarget = G.me.locks.find(l=>l.done)?.id || null;
    if (G.me.nav && G.me.nav.targetId === e.id) G.me.nav = null;
  }
  if (G.sel === e.id) G.sel = null;
  ui("updateTargets"); ui("setSel", G.sel);
};

G.dealToPlayer = function(dmg, srcName){
  const S = G.state.ship;
  const d = Object.assign({}, dmg);
  let total = 0;
  let t = applyLayer(S.sh, G.st.resShield, d); S.sh -= t; total += t;
  if (S.sh <= 1){ t = applyLayer(S.ar, G.st.resArmor, d); S.ar -= t; total += t; }
  if (S.ar <= 1 && S.sh <= 1){ t = applyLayer(S.hu, G.st.resHull, d); S.hu -= t; total += t; }
  if (S.hu <= 0) G.playerKilled();
  return total;
};

G.playerKilled = function(){
  const S = G.state.ship;
  const d = G.shipData();
  Sound.play("boomBig");
  G.space.fx.push({ kind:"boom", x:G.me.x, y:G.me.y, r:4000, t:1.5 });
  const insurance = Math.floor(d.price * .4);
  ui("combat", `你的 ${d.cn} 已被击毁`, "combat-taken");
  ui("aura", `你的 <b class="red">${d.cn}</b> 被击毁了。你已进入太空舱。${insurance>0 ? `平台保险赔付 <b class="gold">${fmtISK(insurance)}</b>。` : ""}立即跃迁离开危险区域！`);
  if (insurance > 0) G.pay(insurance, "舰船保险赔付");
  G.state.ship = G.makeShip("capsule");
  G.recalc(); G.buildMods();
  G.me.locks = []; G.me.activeTarget = null; G.me.nav = null;
  G.me.vx = 0; G.me.vy = 0;
  for (const e of G.space.ents) if (e.kind === "npc") e.aggro = false;
  ui("updateTargets");
  G.save();
};

/* ================= NPC AI ================= */

function npcTick(e, dt){
  const nd = DATA.NPCS[e.npc];
  if (e.webbedT > 0) e.webbedT -= dt;
  const dp = G.distTo(e);
  if (!e.aggro){
    if (G.state.ship.typeId !== "capsule" && dp < (e.mission ? 60000 : nd.aggro)){
      e.aggro = true; e.lockT = nd.lockDelay;
      ui("combat", `${e.name} 开始锁定你！`, "combat-taken");
      Sound.play("alert");
    } else {
      e.vx *= .95; e.vy *= .95;
      e.x += e.vx*dt; e.y += e.vy*dt;
      return;
    }
  }
  if (G.state.ship.typeId === "capsule"){ e.aggro = false; return; }
  const spd = nd.speed * (e.webbedT > 0 ? .5 : 1);
  const dx = G.me.x - e.x, dy = G.me.y - e.y;
  const d = hypot(dx,dy) || 1;
  const ux = dx/d, uy = dy/d;
  const err = clamp((d - nd.orbit) / 3000, -1, 1);
  let ddx = -uy + ux*err, ddy = ux + uy*err;
  const dl = hypot(ddx,ddy) || 1;
  const tvx = ddx/dl*spd, tvy = ddy/dl*spd;
  const f = 1 - Math.exp(-dt/1.6);
  e.vx += (tvx - e.vx)*f; e.vy += (tvy - e.vy)*f;
  e.x += e.vx*dt; e.y += e.vy*dt;
  if (e.lockT > 0){ e.lockT -= dt; return; }
  e.ct -= dt;
  if (e.ct > 0) return;
  e.ct = nd.cycle;
  if (d > nd.optimal + nd.falloff*3) return;
  G.space.fx.push({ kind:"beam", ax:e.x, ay:e.y, bx:G.me.x, by:G.me.y, color:"#ff8f6d", t:.22 });
  Sound.play("proj");
  const chance = turretChance({ tracking:nd.tracking, sigRes:nd.sigRes, optimal:nd.optimal, falloff:nd.falloff },
    d, transversalOf(e, G.me), G.getSig());
  const roll = Math.random();
  if (roll > chance){ ui("combat", `${e.name} 的攻击没有打中你`, "combat-info"); return; }
  let mult = .5 + Math.random();
  if (roll < chance*.02) mult = 3;
  const dmg = {};
  for (const k in nd.dmg) dmg[k] = nd.dmg[k]*mult;
  const done = G.dealToPlayer(dmg, e.name);
  ui("combat", `${e.name} 命中了你，造成 <b>${done.toFixed(1)}</b> 点伤害`, "combat-taken");
}

/* ================= main update ================= */

function regen(cur, max, rt, dt){
  if (cur >= max) return max;
  const x = Math.max(cur/max, .01);
  return Math.min(max, cur + 10*max/rt*(Math.sqrt(x)-x)*dt);
}

G.update = function(dt){
  if (!G.state) return;
  G.updateSkills();
  if (G.state.loc.docked || !G.space) return;
  const S = G.state.ship, me = G.me;
  G.space.t += dt;

  if (me.warp && me.warp.phase === "warp"){
    warpTick(dt);
  } else {
    let vdx = 0, vdy = 0;
    const maxV = G.getMaxSpeed();
    let want = null;
    if (me.warp && me.warp.phase === "align"){
      const dx = me.warp.tx-me.x, dy = me.warp.ty-me.y, d = hypot(dx,dy)||1;
      want = [dx/d, dy/d];
      const v = hypot(me.vx,me.vy);
      const dot = v > 1 ? (me.vx*dx/d + me.vy*dy/d)/v : 0;
      if (dot > .985 && v >= .75*maxV) enterWarp();
    } else if (me.nav){
      const n = me.nav;
      if (n.mode === "heading") want = n.dir;
      else {
        const t = G.entById(n.targetId);
        if (!t) me.nav = null;
        else {
          const dx = t.x-me.x, dy = t.y-me.y, d = hypot(dx,dy)||1;
          const ux = dx/d, uy = dy/d;
          if (n.mode === "approach"){
            if (d <= (n.range || 500)){
              if (n.act === "dock") { me.nav=null; G.doDock(t); return; }
              if (n.act === "jump") { me.nav=null; G.doJump(t); return; }
              if (n.act === "loot") { me.nav=null; panels("loot", t); }
              else want = null;
              if (me.nav) me.nav = null;
            } else want = [ux,uy];
          } else if (n.mode === "orbit"){
            const err = clamp((d - n.range)/2000, -1, 1);
            let ox = -uy + ux*err, oy = ux + uy*err;
            const ol = hypot(ox,oy)||1;
            want = [ox/ol, oy/ol];
          } else if (n.mode === "keep"){
            const err = clamp((d - n.range)/1500, -1, 1);
            if (Math.abs(d - n.range) < 200) want = null;
            else want = [ux*err, uy*err];
          }
        }
      }
    }
    if (want){ vdx = want[0]*maxV*me.speedFrac; vdy = want[1]*maxV*me.speedFrac; }
    const tau = Math.max(.3, G.st.inertia * G.st.mass / 1e6);
    const f = 1 - Math.exp(-dt/tau);
    me.vx += (vdx-me.vx)*f; me.vy += (vdy-me.vy)*f;
    me.x += me.vx*dt; me.y += me.vy*dt;
    const v = hypot(me.vx,me.vy);
    if (v > 5){ me.dir = [me.vx/v, me.vy/v]; }
  }

  S.cap = regen(S.cap, G.st.capMax, G.st.capRt, dt);
  S.sh = regen(S.sh, G.st.shieldMax, G.st.shieldRt, dt);

  if (!me.warp || me.warp.phase !== "warp") moduleTick(dt);

  for (const l of me.locks){
    if (l.done) continue;
    l.t += dt;
    if (l.t >= l.need){
      l.done = true;
      Sound.play("lockon");
      const e = G.entById(l.id);
      if (e) ui("combat", `已锁定目标：${e.name}`, "combat-info");
      if (!me.activeTarget) me.activeTarget = l.id;
      ui("updateTargets");
    }
  }
  me.locks = me.locks.filter(l => {
    const e = G.entById(l.id);
    if (!e) return false;
    if (G.distTo(e) > G.st.tgtRange * 1.15){ ui("toast","目标脱离锁定距离","warn"); if (me.activeTarget===l.id) me.activeTarget=null; return false; }
    return true;
  });

  for (const e of G.space.ents){
    if (e.kind === "npc") npcTick(e, dt);
    else if (e.kind === "wreck"){ e.t -= dt; if (e.t <= 0) G.removeEnt(e); }
  }

  for (let i=G.space.pending.length-1;i>=0;i--){
    const p = G.space.pending[i];
    p.t -= dt;
    if (p.t <= 0){ G.space.pending.splice(i,1); try{ p.fn(); }catch(err){ console.error(err); } }
  }
  for (let i=G.space.fx.length-1;i>=0;i--){
    const f = G.space.fx[i];
    f.t -= dt;
    if (f.kind === "missile"){
      const t = G.entById(f.tid);
      if (t){
        const dx=t.x-f.x, dy=t.y-f.y, d=hypot(dx,dy)||1;
        f.x += dx/d*f.speed*dt; f.y += dy/d*f.speed*dt;
      }
    }
    if (f.t <= 0) G.space.fx.splice(i,1);
  }

  if (G.state.autopilot && !me.warp && !me.nav && G.state.route.length){
    const next = G.state.route[0];
    const gate = G.space.ents.find(e=>e.kind==="gate" && e.dest===next);
    if (gate) G.cmdJumpGate(gate.id);
    else G.state.autopilot = false;
  }
};

function enterWarp(){
  const me = G.me;
  me.warp.phase = "warp";
  me.warp.v = hypot(me.vx, me.vy);
  Sound.play("warp");
  ui("toast","跃迁引擎启动");
  G.deactivateAll();
  me.locks = []; me.activeTarget = null;
  ui("updateTargets");
}

function warpTick(dt){
  const me = G.me, w = me.warp;
  const dx = w.tx-me.x, dy = w.ty-me.y;
  const rem = hypot(dx,dy);
  const vmax = (G.shipData().warp || 3) * DATA.AU;
  let vt = Math.min(vmax, Math.max(rem*2, 30000));
  if (vt > w.v) w.v = Math.min(vt, Math.max(w.v, 20000) * Math.pow(6, dt));
  else w.v = vt;
  const step = Math.min(rem, w.v*dt);
  me.x += dx/rem*step; me.y += dy/rem*step;
  me.vx = dx/rem*w.v; me.vy = dy/rem*w.v;
  if (rem - step <= 200){
    const then = w.then;
    me.warp = null;
    me.vx = dx/rem*100; me.vy = dy/rem*100;
    Sound.play("warpOut");
    ui("toast","跃迁结束");
    if (then){
      if (then.act === "dock" || then.act === "jump" || then.act === "loot")
        me.nav = { mode:"approach", targetId: then.targetId, range: then.range, act: then.act };
    }
  }
}

/* ================= economy ================= */

G.pay = function(amt, why){
  G.state.pilot.isk += amt;
  G.state.journal.unshift({ t: Date.now(), amt, why });
  if (G.state.journal.length > 60) G.state.journal.pop();
  if (amt > 0) Sound.play("isk");
  ui("updateNeocom");
  panels("refreshOpen");
};

G.tax = function(){ return Math.max(0, .05 - .005*G.skillLvl("trade")); };

G.buyItem = function(id, qty){
  qty = Math.max(1, Math.floor(qty||1));
  const it = DATA.item(id);
  const cost = it.price * qty;
  if (!G.state.loc.docked) return ui("toast","需要停靠在空间站才能交易","warn");
  if (G.state.pilot.isk < cost) return ui("toast","ISK 不足","bad");
  if (it.cat === "ship"){
    for (let i=0;i<qty;i++) G.hangar().ships.push(G.makeShip(id));
  } else {
    G.addItem(G.hangar().items, id, qty);
  }
  G.pay(-cost, `购买 ${it.cn} ×${qty}`);
  ui("toast", `已购买 ${it.cn} ×${qty}`, "good");
};

G.sellStack = function(src, id, qty){
  const it = DATA.item(id);
  if (it.noTrade) return ui("toast","该物品无法出售","warn");
  const list = src === "hangar" ? G.hangar().items : (src === "ore" ? G.state.ship.ore : G.state.ship.cargo);
  qty = Math.min(qty, G.countItem(list, id));
  if (qty <= 0) return;
  if (!G.remItem(list, id, qty)) return;
  const got = Math.floor(it.price * qty * (1 - G.tax()));
  G.pay(got, `出售 ${it.cn} ×${fmtNum(qty)}`);
  ui("toast", `已出售 ${it.cn} ×${fmtNum(qty)}（${fmtISK(got)}）`, "good");
  panels("refreshOpen");
};

G.sellShipIdx = function(i){
  const h = G.hangar();
  const s = h.ships[i];
  if (!s) return;
  const d = DATA.SHIPS[s.typeId];
  h.ships.splice(i,1);
  const got = Math.floor(d.price * .8);
  G.pay(got, `出售舰船 ${d.cn}`);
  ui("toast", `已出售 ${d.cn}（${fmtISK(got)}）`, "good");
  panels("refreshOpen");
};

G.activateShip = function(i){
  const h = G.hangar();
  const s = h.ships[i];
  if (!s) return;
  h.ships.splice(i,1,G.state.ship);
  G.state.ship = s;
  G.recalc(); G.buildMods();
  ui("toast", `已登舰：${DATA.SHIPS[s.typeId].cn}`, "good");
  panels("refreshOpen");
};

G.repairCost = function(){
  const S = G.state.ship;
  return Math.ceil(((G.st.armorMax - S.ar) + (G.st.hullMax - S.hu)) * 4);
};
G.repairAll = function(){
  const c = G.repairCost();
  if (c <= 0) return ui("toast","舰船完好，无需维修");
  if (G.state.pilot.isk < c) return ui("toast","ISK 不足","bad");
  G.pay(-c, "舰船维修");
  const S = G.state.ship;
  S.ar = G.st.armorMax; S.hu = G.st.hullMax;
  ui("toast","维修完成","good");
  panels("refreshOpen");
};

G.refineYield = function(){ return .5 + .03*G.skillLvl("reprocessing"); };
G.refineOre = function(src, id){
  const list = src === "hangar" ? G.hangar().items : (src === "ore" ? G.state.ship.ore : G.state.ship.cargo);
  const qty = G.countItem(list, id);
  if (qty <= 0) return;
  const od = DATA.ORES[id];
  if (!od) return ui("toast","只能精炼矿石","warn");
  G.remItem(list, id, qty);
  const y = G.refineYield();
  const out = [];
  for (const [mid, per] of Object.entries(od.minerals)){
    const n = Math.floor(per * qty * y);
    if (n > 0){ G.addItem(G.hangar().items, mid, n); out.push(`${DATA.MINERALS[mid].cn} ×${fmtNum(n)}`); }
  }
  ui("toast", `精炼完成：${out.join("，") || "无产出"}`, "good");
  panels("refreshOpen");
};

/* ================= fitting ================= */

G.canFly = function(typeId){
  const d = DATA.SHIPS[typeId];
  return G.meetsReq(d.req);
};

G.fitModule = function(id){
  if (!G.state.loc.docked) return ui("toast","装配需要在空间站进行","warn");
  const md = DATA.MODULES[id];
  if (!md) return;
  const S = G.state.ship, d = G.shipData();
  const row = md.slot;
  const idx = S.fit[row].indexOf(null);
  if (idx < 0) return ui("toast","没有空余的" + ({hi:"高能量",mid:"中能量",low:"低能量"}[row]) + "槽位","warn");
  if (md.size){
    const order = { S:1, M:2, L:3 };
    if (order[md.size] > order[d.size]) return ui("toast","该武器对这艘船来说太大了","warn");
  }
  if (!G.meetsReq(md.req)) return ui("toast","技能不足，无法装配","bad");
  const u = G.fitUsage();
  const wu = (md.type==="turret"||md.type==="launcher") ? 1 - .05*G.skillLvl("weaponUpg") : 1;
  if (u.cpu + md.cpu*wu > G.st.cpuMax) return ui("toast","CPU 输出不足","bad");
  if (u.pg + md.pg > G.st.pgMax) return ui("toast","能量栅格输出不足","bad");
  if (!G.remItem(G.hangar().items, id, 1)) return ui("toast","机库中没有该装备","warn");
  S.fit[row][idx] = id;
  G.recalc(); G.buildMods();
  Sound.play("click");
  panels("refreshOpen");
};

G.unfitModule = function(row, i){
  if (!G.state.loc.docked) return ui("toast","需要在空间站内才能卸载","warn");
  const S = G.state.ship;
  const id = S.fit[row][i];
  if (!id) return;
  S.fit[row][i] = null;
  G.addItem(G.hangar().items, id, 1);
  G.recalc(); G.buildMods();
  panels("refreshOpen");
};

/* ================= route / map ================= */

G.findRoute = function(from, to){
  if (from === to) return [];
  const prev = { [from]: null };
  const q = [from];
  while (q.length){
    const cur = q.shift();
    for (const nb of DATA.SYSTEMS[cur].gates){
      if (nb in prev) continue;
      prev[nb] = cur;
      if (nb === to){
        const path = [to];
        let c = to;
        while (prev[c] !== null){ c = prev[c]; path.unshift(c); }
        path.shift();
        return path;
      }
      q.push(nb);
    }
  }
  return null;
};

G.setDest = function(sysId){
  const cur = G.state.loc.system;
  if (sysId === cur){ G.state.dest = null; G.state.route = []; G.state.autopilot = false; ui("updateRoute"); return; }
  const r = G.findRoute(cur, sysId);
  if (!r) return ui("toast","无法找到航线","bad");
  G.state.dest = sysId; G.state.route = r;
  ui("toast", `目的地设定：${DATA.SYSTEMS[sysId].cn}（${r.length} 跳）`);
  ui("updateRoute");
};

G.toggleAutopilot = function(){
  if (!G.state.route.length) return ui("toast","请先在星图中设定目的地","warn");
  G.state.autopilot = !G.state.autopilot;
  ui("toast", G.state.autopilot ? "自动导航已开启" : "自动导航已关闭");
  ui("updateRoute");
};

/* ================= missions ================= */

const MISSION_KILL = [
  { title:"清剿行动", brief:"一伙海盗在本恒星系设立了前哨。清除信标处的所有敌舰。" },
  { title:"血色黎明", brief:"侦察部门标记了一支海盗突击小队，在他们袭击运输船之前动手。" },
  { title:"蜂巢捣毁", brief:"海盗把老巢安在了我们眼皮底下，是时候给他们上一课了。" },
];
const MISSION_MINE_L = { 1:["veldspar",2500,90000], 2:["kernite",500,300000], 3:["hemorphite",350,700000] };
const MISSION_KILL_SHIPS = {
  1: ["g_f1","g_f1","g_f1","g_f2"],
  2: ["g_f2","g_f2","g_d1","g_d1"],
  3: ["g_c1","g_c1","g_d1","g_c1"],
};
const MISSION_KILL_PAY = { 1:[90000,60000], 2:[280000,180000], 3:[750000,450000] };

G.agentOffers = function(agentId){
  if (!G.state.offers[agentId]) G.state.offers[agentId] = G.genOffers(agentId);
  return G.state.offers[agentId];
};
G.genOffers = function(agentId){
  const ag = DATA.AGENTS[agentId];
  const here = { system: G.state.loc.system, station: G.state.loc.docked };
  return ag.types.map(type => {
    if (type === "kill"){
      const t = pick(MISSION_KILL);
      const ships = MISSION_KILL_SHIPS[ag.level].slice();
      const pay = MISSION_KILL_PAY[ag.level];
      return { type, title:t.title, brief:t.brief, ships, reward:pay[0], bonus:pay[1],
        system: here.system, station: here.station,
        desc:`在本恒星系（${DATA.SYSTEMS[here.system].cn}）消灭 ${ships.length} 艘海盗舰船。` };
    }
    if (type === "mining"){
      const [ore, qty, reward] = MISSION_MINE_L[ag.level];
      return { type, title:"矿务征集", brief:"帝国的工业机器需要原料，采矿员。",
        ore, qty, reward, system: here.system, station: here.station,
        desc:`交付 ${fmtNum(qty)} 单位 ${DATA.ORES[ore].cn} 至本站。` };
    }
    const dests = [];
    for (const [sid, sd] of Object.entries(DATA.SYSTEMS)){
      for (const st of sd.stations) if (st.name !== here.station) dests.push({ sys:sid, name:st.name });
    }
    const dst = pick(dests);
    const jumps = (G.findRoute(here.system, dst.sys)||[]).length;
    const vol = 20 + Math.floor(Math.random()*5)*20;
    const reward = 30000 + jumps*45000*ag.level;
    return { type, title:"加急快递", brief:"时间就是金钱，货物必须准时送达。",
      destSys: dst.sys, destStation: dst.name, vol, reward,
      system: here.system, station: here.station,
      desc:`将 ${vol} m³ 货物运送至 ${DATA.SYSTEMS[dst.sys].cn} — ${dst.name}（${jumps} 跳）。` };
  });
};

G.acceptMission = function(agentId, idx){
  if (G.state.mission) return ui("toast","你已有进行中的任务","warn");
  const offer = G.agentOffers(agentId)[idx];
  if (!offer) return;
  const M = Object.assign({ agentId, agentSystem: G.state.loc.system, agentStation: G.state.loc.docked, status:"active" }, JSON.parse(JSON.stringify(offer)));
  if (M.type === "courier"){
    const space = G.st.cargoCap - G.cargoUsed();
    if (space < M.vol) return ui("toast",`货柜空间不足（需要 ${M.vol} m³）`,"bad");
    G.state.ship.cargo.push({ id:"parcel", qty:1, vol:M.vol });
  }
  G.state.mission = M;
  G.state.offers[agentId].splice(idx,1);
  ui("toast", `已接受任务：${M.title}`, "good");
  if (M.type === "kill") ui("aura","任务舰船已部署在本恒星系。出站后通过总览或右键菜单跃迁至【遭遇战信标】。");
  panels("refreshOpen");
};

G.missionReady = function(){
  const M = G.state.mission;
  if (!M) return false;
  if (M.type === "kill") return !M.ships.length && G.state.loc.docked === M.agentStation;
  if (M.type === "mining"){
    if (G.state.loc.docked !== M.agentStation) return false;
    const have = G.countItem(G.state.ship.cargo, M.ore) + G.countItem(G.state.ship.ore, M.ore) + G.countItem(G.hangar().items, M.ore);
    return have >= M.qty;
  }
  if (M.type === "courier") return G.state.loc.docked === M.destStation;
  return false;
};

G.completeMission = function(){
  const M = G.state.mission;
  if (!M || !G.missionReady()) return ui("toast","任务条件尚未满足","warn");
  if (M.type === "mining"){
    let need = M.qty;
    for (const list of [G.hangar().items, G.state.ship.ore, G.state.ship.cargo]){
      const have = G.countItem(list, M.ore);
      const take = Math.min(have, need);
      if (take > 0){ G.remItem(list, M.ore, take); need -= take; }
    }
  }
  if (M.type === "courier"){
    const i = G.state.ship.cargo.findIndex(c=>c.id==="parcel");
    if (i >= 0) G.state.ship.cargo.splice(i,1);
  }
  const total = M.reward + (M.bonus||0);
  G.pay(total, `任务报酬 — ${M.title}`);
  G.state.pilot.missionsDone++;
  G.state.pilot.standing = Math.round((G.state.pilot.standing + .3*(DATA.AGENTS[M.agentId]?.level||1))*100)/100;
  G.state.mission = null;
  ui("aura", `任务完成！报酬 <b class="gold">${fmtISK(total)}</b> 已入账，代理人声望提升。`);
  G.save();
  panels("refreshOpen");
};

G.abandonMission = function(){
  const M = G.state.mission;
  if (!M) return;
  if (M.type === "courier"){
    const i = G.state.ship.cargo.findIndex(c=>c.id==="parcel");
    if (i >= 0) G.state.ship.cargo.splice(i,1);
  }
  if (G.space) G.space.ents.filter(e=>e.mission || e.kind==="beacon").forEach(e=>G.removeEnt(e));
  G.state.pilot.standing = Math.round((G.state.pilot.standing - .5)*100)/100;
  G.state.mission = null;
  ui("toast","已放弃任务，声望受损","bad");
  panels("refreshOpen");
};

G.lootAll = function(wreck){
  if (!wreck.loot.length){ ui("toast","残骸是空的"); return; }
  for (let i=wreck.loot.length-1;i>=0;i--){
    const l = wreck.loot[i];
    const it = DATA.item(l.id);
    const space = G.st.cargoCap - G.cargoUsed();
    const can = Math.min(l.qty, Math.floor(space / Math.max(.001,it.vol)));
    if (can <= 0){ ui("toast","货柜已满","warn"); break; }
    G.addItem(G.state.ship.cargo, l.id, can);
    l.qty -= can;
    ui("toast", `拾取 ${it.cn} ×${can}`, "good");
    if (l.qty <= 0) wreck.loot.splice(i,1);
  }
  panels("refreshCargo");
};

window.G = G;
