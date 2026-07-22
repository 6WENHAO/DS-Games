"use strict";
const Bot = {
  enabled: false,
  state: "start", ctx: {}, wait: 0,
  dq: null, activity: null, altFlag: 0, tripN: 0, mineFail: 0,
  idleT: 0, riskBanT: 0, lastSay: "", mapShown: false,

  RACE_GUN: {
    amarr:   { S:"spulse",  M:"mpulse",  L:"lpulse" },
    caldari: { S:"srocket", M:"mhml",    L:"lcruise" },
    gallente:{ S:"sblaster",M:"mblaster",L:"lblaster" },
    minmatar:{ S:"sac",     M:"mac",     L:"lac" },
  },
  FALLBACK_GUN: { S:"srail", M:"mrail", L:"lrail" },
  RACE_SHIP: {
    amarr:   { frig:"punisher", dessie:"coercer",  cruiser:"omen",    bc:"prophecy", bs:"apocalypse" },
    caldari: { frig:"kestrel",  dessie:"cormorant",cruiser:"caracal", bc:"drake",    bs:"raven" },
    gallente:{ frig:"incursus", dessie:"catalyst", cruiser:"thorax",  bc:"myrmidon", bs:"megathron" },
    minmatar:{ frig:"rifter",   dessie:"thrasher", cruiser:"rupture", bc:"hurricane",bs:"tempest" },
  },
  PROP: { S:"ab1", M:"ab10", L:"ab100" },
  SB: { S:"ssb", M:"msb", L:"lsb" },
  SE: { S:"sse", M:"mse", L:"lse" },
  AR: { S:"saar", M:"maar", L:"laar" },
  TIER: { rookie:0, capsule:0, frig:1, dessie:2, cruiser:3, bc:4, bs:5, indy:1 },
  TIER_PRICE: { 1:900000, 2:3500000, 3:17000000, 4:70000000, 5:300000000 },
  KILL_REQ: { 1:1, 2:3, 3:4 },
  SKILL_PLAN: [
    ["mining",3],["frig",3],["gunnery",3],["missiles",2],["navigation",2],["shieldOp",2],["targeting",2],
    ["dessie",1],["astrogeology",2],["dessie",3],["repair",2],["missiles",3],
    ["cruiser",1],["shieldMgmt",2],["hullUpg",2],["cruiser",3],["weaponUpg",2],
    ["capMgmt",2],["reprocessing",3],["trade",2],["evasive",2],["sigAnalysis",3],
    ["bc",1],["gunnery",4],["mining",4],["astrogeology",4],["bc",3],["capOp",3],
    ["missiles",4],["bs",1],["longRange",2],["mechanics",3],["bs",3],["frig",5],["gunnery",5],
  ],

  /* ---------- ui ---------- */
  initUI(){
    if (document.getElementById("autobar")) return;
    const bar = document.createElement("div");
    bar.id = "autobar";
    bar.innerHTML = `<span class="btn primary" id="autoBtn">一键挂机</span><span id="autoStatus" class="dim">点击后 AI 自动驾驶：任务·战斗·采矿·贸易·训练全自动</span>`;
    document.getElementById("ui").appendChild(bar);
    document.getElementById("autoBtn").onclick = ()=>{ Sound.play("click"); this.set(!this.enabled); };
  },
  set(on){
    this.enabled = on;
    G.state.botOn = on;
    const btn = (typeof document !== "undefined") ? document.getElementById("autoBtn") : null;
    if (btn){ btn.textContent = on ? "停止挂机" : "一键挂机"; btn.classList.toggle("danger", on); btn.classList.toggle("primary", !on); }
    if (on){
      this.state = "start"; this.dq = null; this.ctx = {}; this.wait = 0;
      this.say("AI 接管舰船 — 开始自动发展 o7");
      if (window.UI) UI.aura("挂机模式已开启。AI 将自动：接<b>任务</b>、清剿<b>海盗</b>并拾取战利品、<b>采矿</b>、回站<b>精炼/出售</b>、购买<b>技能书</b>与<b>新舰船</b>并升级装配，随实力提升逐步深入低安与 0.0。随时可点「停止挂机」接管。");
    } else {
      this.say("挂机已停止，舰船控制权已交还");
    }
  },
  say(msg){
    if (msg === this.lastSay) return;
    this.lastSay = msg;
    const el = (typeof document !== "undefined") ? document.getElementById("autoStatus") : null;
    if (el){ el.textContent = msg; el.classList.remove("dim"); }
    if (window.UI) UI.combat(`<span class="gold">[AI]</span> ${msg}`, "combat-info");
  },

  /* ---------- helpers ---------- */
  tier(cls){ return this.TIER[cls] ?? 0; },
  shipTier(typeId){ return this.tier(DATA.SHIPS[typeId].cls); },
  allShips(){
    const arr = [{ obj:G.state.ship, where:"active" }];
    for (const [k,h] of Object.entries(G.state.assets)) for (const s of (h.ships||[])) arr.push({ obj:s, where:k });
    return arr;
  },
  bestCombatTier(){
    let best = 0;
    for (const {obj} of this.allShips()){
      const d = DATA.SHIPS[obj.typeId];
      if (obj.typeId === "venture" || d.cls === "capsule" || d.cls === "indy") continue;
      if (G.canFly(obj.typeId)) best = Math.max(best, this.tier(d.cls));
    }
    return best;
  },
  ownType(typeId){ return this.allShips().some(s=>s.obj.typeId===typeId); },
  hasWeapon(ship){ return ship.fit.hi.some(t=>t && ["turret","launcher"].includes(DATA.MODULES[t].type)); },
  hasMiner(ship){ return ship.fit.hi.some(t=>t && DATA.MODULES[t].type==="miner"); },
  freeCargo(){ return G.st.cargoCap - G.cargoUsed(); },
  freeOreSpace(){
    const d = G.shipData();
    return d.oreHold > 0 ? (d.oreHold - G.oreUsed()) + this.freeCargo() : this.freeCargo();
  },
  minSec(){
    const t = this.shipTier(G.state.ship.typeId);
    if (G.state.ship.typeId === "venture") return .5;
    if (t >= 5) return 0;
    if (t >= 3 && Date.now() > this.riskBanT) return .3;
    return .5;
  },
  stationSystems(){ return Object.keys(DATA.SYSTEMS).filter(s=>DATA.SYSTEMS[s].stations.length); },
  nearestStationSys(){
    const cur = G.state.loc.system;
    let best = null, bd = 99;
    for (const s of this.stationSystems()){
      const r = G.findRoute(cur, s);
      if (r && r.length < bd){ bd = r.length; best = s; }
    }
    return best;
  },
  missionOreId(){ const M = G.state.mission; return (M && M.type==="mining") ? M.ore : null; },
  haveMissionOreTotal(){
    const M = G.state.mission;
    if (!M || M.type!=="mining") return 0;
    let n = G.countItem(G.state.ship.cargo, M.ore) + G.countItem(G.state.ship.ore, M.ore);
    const dep = G.state.assets[M.agentStation];
    if (dep) n += G.countItem(dep.items, M.ore);
    return n;
  },
  haveMissionOre(){
    const M = G.state.mission;
    if (!M || M.type!=="mining") return 0;
    let n = G.countItem(G.state.ship.cargo, M.ore) + G.countItem(G.state.ship.ore, M.ore);
    if (G.state.loc.docked === M.agentStation) n += G.countItem(G.hangar().items, M.ore);
    return n;
  },

  /* ---------- main ---------- */
  update(dt){
    if (!this.enabled || !G.state) return;
    try {
      if (!G.state.mission) this.mineFail = 0;
      if (this.wait > 0){ this.wait -= dt; return; }
      if (G.state.loc.docked) this.dockedTick(dt);
      else if (G.space && G.me) this.spaceTick(dt);
    } catch(e){
      console.error("Bot error:", e);
      this.state = "start"; this.dq = null; this.wait = 3;
    }
  },

  /* ================= docked ================= */
  dockedTick(){
    if (this.state !== "docked"){ this.state = "docked"; this.dq = null; this.idleT = 0; }
    if (!this.dq){ this.dq = this.buildDockQueue(); this.altFlag++; }
    while (this.dq.length && !this.dq[0].cond()) this.dq.shift();
    if (!this.dq.length){ this.dq = null; this.wait = 2; return; }
    const step = this.dq.shift();
    this.say(step.msg());
    step.fn();
    this.wait = 1.6;
  },

  buildDockQueue(){
    const q = [];
    const add = (msg, cond, fn)=>q.push({ msg: typeof msg==="function"?msg:()=>msg, cond, fn });
    const p = ()=>G.state.pilot;

    add("维修舰船", ()=>G.repairCost()>0 && p().isk > G.repairCost()+5000, ()=>G.repairAll());

    add("将任务矿石存入代理人空间站机库",
      ()=>{ const M=G.state.mission;
        return M && M.type==="mining" && G.state.loc.docked===M.agentStation &&
          (G.countItem(G.state.ship.cargo, M.ore) + G.countItem(G.state.ship.ore, M.ore)) > 0; },
      ()=>{ const M=G.state.mission;
        for (const list of [G.state.ship.cargo, G.state.ship.ore]){
          const n = G.countItem(list, M.ore);
          if (n > 0){ G.remItem(list, M.ore, n); G.addItem(G.hangar().items, M.ore, n); }
        } });

    add("采矿任务无法安全完成，放弃任务",
      ()=>{ const M=G.state.mission;
        if (!M || M.type!=="mining" || this.mineFail < 2) return false;
        const short = M.qty - this.haveMissionOre();
        return short > 0 && short*DATA.ORES[M.ore].price*3 >= p().isk; },
      ()=>{ G.abandonMission(); this.mineFail = 0; });

    add("任务超出当前实力，放弃并接受声望损失",
      ()=>{ const M=G.state.mission; return M && M.type==="kill" && this.bestCombatTier() < (this.KILL_REQ[DATA.AGENTS[M.agentId].level]||1); },
      ()=>G.abandonMission());

    add(()=>`市场购入矿石补足任务需求`,
      ()=>{ const M=G.state.mission;
        if (!M || M.type!=="mining" || G.state.loc.docked!==M.agentStation) return false;
        const short = M.qty - this.haveMissionOre();
        return short > 0 && short*DATA.ORES[M.ore].price*3 < p().isk; },
      ()=>{ const M=G.state.mission;
        if (window.Panels){ Panels.marketTab="buy"; Panels.market(); UI.openWin("market"); }
        G.buyItem(M.ore, M.qty - this.haveMissionOre()); });

    add(()=>`交付任务【${G.state.mission?G.state.mission.title:""}】领取报酬`,
      ()=>G.state.mission && G.missionReady(),
      ()=>{ if (window.Panels){ Panels.missions(); UI.openWin("missions"); } G.completeMission(); this.mineFail = 0; });

    add(()=>this.altFlag%2 ? "精炼矿石并出售矿物/战利品" : "在市场出售矿石与战利品",
      ()=>this.hasSellables(), ()=>this.sellAll(this.altFlag%2===1));

    add("购买技能书并安排训练队列",
      ()=>p().queue.length < 3 && this.nextSkillMove() !== null,
      ()=>{ if (window.Panels){ Panels.charSheet(); UI.openWin("char"); } for (let i=0;i<3;i++) if (!this.doSkillMove()) break; });

    add("重装新手船为专职采矿配置",
      ()=>G.shipData().cls==="rookie" && p().isk > 180000 && !this.ownType("venture") &&
          (G.state.ship.fit.hi.includes("civ_gun") || G.state.ship.fit.hi.includes("civ_miner")),
      ()=>{ G.buyItem("miner1", 2);
        ["civ_gun","civ_miner"].forEach(id=>{
          const i = G.state.ship.fit.hi.indexOf(id);
          if (i >= 0) G.unfitModule("hi", i);
        });
        G.fitModule("miner1"); G.fitModule("miner1");
        if (window.Panels){ Panels.fitting(); UI.openWin("fitting"); } });

    add("购置采矿舰：冒险级 + 采矿器",
      ()=>!this.ownType("venture") && G.canFly("venture") && p().isk > 1100000,
      ()=>this.buyVentureKit());

    add(()=>`购置升级战舰并装配`,
      ()=>this.nextCombatBuy() !== null,
      ()=>this.buyCombatKit(this.nextCombatBuy()));

    add("向代理人申请新任务",
      ()=>!G.state.mission && this.agentHere() && this.pickOffer() !== null,
      ()=>{ if (window.Panels){ Panels.missions(); UI.openWin("missions"); }
        const pick = this.pickOffer();
        if (pick !== null) G.acceptMission(this.agentHere(), pick); });

    add(()=>`登上适合的舰船`,
      ()=>{ const want = this.wantShipFor(this.planActivity()); return want !== null; },
      ()=>{ const want = this.wantShipFor(this.planActivity()); if (want !== null) G.activateShip(want); });

    add(()=>`离站 — 执行计划：${this.actName(this.planActivity())}`, ()=>true,
      ()=>{ this.activity = this.planActivity();
        if (window.UI){ ["char","market","fitting","missions","wallet","hangar","refine"].forEach(id=>UI.closeWin(id)); }
        this.state = "start"; this.ctx = {}; this.mapShown = false;
        G.undock(); this.wait = 3; });
    return q;
  },

  hasSellables(){
    const mo = this.missionOreId();
    const check = list => list.some(it=>{
      const d = DATA.item(it.id);
      return ["ore","mineral","commodity"].includes(d.cat) && !d.noTrade && it.id !== mo;
    });
    return check(G.state.ship.cargo) || check(G.state.ship.ore) || check(G.hangar().items);
  },
  sellAll(refineFirst){
    const mo = this.missionOreId();
    if (window.Panels){ Panels.marketTab="sell"; Panels.market(); UI.openWin("market"); }
    if (refineFirst){
      if (window.Panels){ Panels.refine(); UI.openWin("refine"); }
      for (const [src, list] of [["cargo",G.state.ship.cargo],["ore",G.state.ship.ore],["hangar",G.hangar().items]])
        for (const it of list.slice())
          if (DATA.ORES[it.id] && it.id !== mo) G.refineOre(src, it.id);
    }
    for (const [src, list] of [["cargo",G.state.ship.cargo],["ore",G.state.ship.ore],["hangar",G.hangar().items]])
      for (const it of list.slice()){
        const d = DATA.item(it.id);
        if (["ore","mineral","commodity"].includes(d.cat) && !d.noTrade && it.id !== mo)
          G.sellStack(src, it.id, it.qty);
      }
  },

  nextSkillMove(){
    for (const [id, lvl] of this.SKILL_PLAN){
      const sk = DATA.SKILLS[id];
      const queued = G.state.pilot.queue.filter(x=>x.id===id).length;
      const eff = G.skillLvl(id) + queued;
      if (eff >= lvl) continue;
      if (!G.skillKnown(id)){
        if (!G.meetsReq(sk.req)) continue;
        if (G.state.pilot.isk < sk.book*1.4) return null;
        return { id, buy:true };
      }
      if (!G.meetsReq(sk.req)) continue;
      return { id, buy:false };
    }
    return null;
  },
  doSkillMove(){
    const mv = this.nextSkillMove();
    if (!mv || G.state.pilot.queue.length >= 3) return false;
    if (mv.buy){
      G.buyItem("book_"+mv.id, 1);
      G.injectBook(mv.id);
    }
    G.queueTrain(mv.id);
    return true;
  },

  buyVentureKit(){
    G.buyItem("venture", 1);
    const h = G.hangar();
    const idx = h.ships.findIndex(s=>s.typeId==="venture");
    if (idx < 0) return;
    G.activateShip(idx);
    G.buyItem("miner1", 2);
    G.fitModule("miner1"); G.fitModule("miner1");
    if (G.skillLvl("mining") >= 3 && G.state.pilot.isk > 400000){ G.buyItem("mlu",1); G.fitModule("mlu"); }
    if (window.Panels){ Panels.fitting(); UI.openWin("fitting"); }
    this.say("已购入冒险级采矿护卫舰并完成装配");
  },
  nextCombatBuy(){
    const cur = this.bestCombatTier();
    const next = cur + 1;
    if (next > 5) return null;
    const names = ["","frig","dessie","cruiser","bc","bs"];
    const cls = names[next];
    if (G.skillLvl(cls) < 1) return null;
    const typeId = this.RACE_SHIP[G.state.pilot.race][cls];
    if (!G.canFly(typeId)) return null;
    if (G.state.pilot.isk < this.TIER_PRICE[next]) return null;
    return typeId;
  },
  buyCombatKit(typeId){
    const d = DATA.SHIPS[typeId];
    G.buyItem(typeId, 1);
    const h = G.hangar();
    const idx = h.ships.findIndex(s=>s.typeId===typeId);
    if (idx < 0) return;
    G.activateShip(idx);
    const race = G.state.pilot.race;
    const gun = this.RACE_GUN[race][d.size];
    const S = G.state.ship;
    for (let i = S.fit.hi.filter(x=>x).length; i < d.slots.hi; i++){
      G.buyItem(gun, 1);
      G.fitModule(gun);
    }
    if (!this.hasWeapon(S)){
      const fb = this.FALLBACK_GUN[d.size];
      for (let i = S.fit.hi.filter(x=>x).length; i < d.slots.hi; i++){
        G.buyItem(fb, 1);
        G.fitModule(fb);
      }
    }
    const buyFit = id => { if (!id) return; G.buyItem(id,1); G.fitModule(id); };
    buyFit(this.PROP[d.size]);
    buyFit("web");
    if (["caldari","minmatar"].includes(race)){
      buyFit(this.SB[d.size]);
      buyFit(this.SE[d.size]);
    } else {
      buyFit(this.AR[d.size]);
      buyFit("dcu");
    }
    if (window.Panels){ Panels.fitting(); UI.openWin("fitting"); }
    this.say(`已购入并装配新战舰：${d.cn}`);
  },

  agentHere(){
    const stn = DATA.SYSTEMS[G.state.loc.system].stations.find(s=>s.name===G.state.loc.docked);
    return stn && stn.agent ? stn.agent : null;
  },
  pickOffer(){
    const ag = this.agentHere();
    if (!ag) return null;
    const level = DATA.AGENTS[ag].level;
    const offers = G.agentOffers(ag);
    const tier = this.bestCombatTier();
    let best = null, bestScore = -1;
    offers.forEach((o,i)=>{
      let score = -1;
      if (o.type === "kill" && tier >= (this.KILL_REQ[level]||1)) score = 3;
      if (o.type === "mining" && (this.ownType("venture") || this.hasMiner(G.state.ship))) score = 2;
      if (o.type === "courier" && o.vol <= G.st.cargoCap * .9) score = 1;
      if (score > bestScore){ bestScore = score; best = i; }
    });
    return bestScore >= 0 ? best : null;
  },

  planActivity(){
    const M = G.state.mission;
    if (M){
      if (M.type === "kill" && this.bestCombatTier() >= (this.KILL_REQ[DATA.AGENTS[M.agentId].level]||1)) return "mission_kill";
      if (M.type === "mining") return "mission_mine";
      if (M.type === "courier") return "courier";
    }
    const canMine = this.mineShipAvailable();
    const canFight = this.bestOwnedCombatHere() !== null;
    if (canFight && canMine) return (this.tripN % 2 === 0) ? "rat" : "mine";
    if (canFight) return "rat";
    if (canMine) return "mine";
    return "mine";
  },
  actName(a){ return { rat:"清剿海盗", mine:"采矿作业", mission_kill:"作战任务", mission_mine:"采矿任务", courier:"运输任务" }[a] || a; },
  mineShipAvailable(){
    if (G.state.ship.typeId === "venture" || this.hasMiner(G.state.ship)) return true;
    if (!G.state.loc.docked) return false;
    return G.hangar().ships.some(s=>G.canFly(s.typeId) && (s.typeId==="venture" || this.hasMiner(s)));
  },
  ownTypeHere(typeId){
    if (G.state.ship.typeId === typeId) return true;
    return G.state.loc.docked && G.hangar().ships.some(s=>s.typeId===typeId && G.canFly(typeId));
  },
  bestOwnedCombatHere(){
    let best = null, bt = 0;
    const consider = (s, idx)=>{
      const d = DATA.SHIPS[s.typeId];
      if (s.typeId==="venture" || ["capsule","indy","rookie"].includes(d.cls) || !G.canFly(s.typeId)) return;
      const t = this.tier(d.cls);
      if (t > bt){ bt = t; best = idx; }
    };
    consider(G.state.ship, "active");
    if (G.state.loc.docked) G.hangar().ships.forEach((s,i)=>consider(s,i));
    return best;
  },
  wantShipFor(activity){
    if (!G.state.loc.docked) return null;
    const h = G.hangar();
    if (activity === "mine" || activity === "mission_mine"){
      if (G.state.ship.typeId === "venture") return null;
      const iV = h.ships.findIndex(s=>s.typeId==="venture");
      if (iV >= 0 && G.canFly("venture")) return iV;
      if (this.hasMiner(G.state.ship)) return null;
      const iM = h.ships.findIndex(s=>G.canFly(s.typeId) && this.hasMiner(s));
      return iM >= 0 ? iM : null;
    }
    if (activity === "rat" || activity === "mission_kill"){
      const best = this.bestOwnedCombatHere();
      if (best === null || best === "active") return null;
      const cand = h.ships[best];
      if (this.tier(DATA.SHIPS[cand.typeId].cls) > this.tier(G.shipData().cls) || G.state.ship.typeId==="venture" || G.shipData().cls==="rookie") return best;
      return null;
    }
    return null;
  },

  /* ================= space ================= */
  spaceTick(dt){
    const me = G.me, S = G.state.ship;
    if (G.state.ship.typeId === "capsule" && this.state !== "godock"){
      this.say("舰船已损毁！逃生舱紧急撤离");
      this.riskBanT = Date.now() + 8*60*1000;
      this.state = "godock"; this.ctx = {};
    } else if (!["godock","flee"].includes(this.state) && this.danger()){
      this.say("火力压制过强，紧急撤离！");
      G.deactivateAll();
      this.state = "godock"; this.ctx = {};
    }
    if (this.ctx.sys !== G.space.sysId){ this.ctx.sys = G.space.sysId; this.ctx.visited = []; }

    if (!me.warp && !me.nav && this.state !== "travel"){
      this.idleT += dt;
      if (this.idleT > 30){ this.idleT = 0; this.say("重新规划行动…"); this.state = "start"; this.ctx = { sys:G.space.sysId, visited:[] }; }
    } else this.idleT = 0;

    switch(this.state){
      case "docked": case "start": this.decideSpace(); break;
      case "travel": this.travelTick(); break;
      case "rat": this.ratTick(); break;
      case "mine": this.mineTick(null); break;
      case "mission_kill": this.missionKillTick(); break;
      case "mission_mine": this.missionMineTick(); break;
      case "courier": this.courierTick(); break;
      case "godock": case "flee": this.dockTick(); break;
      default: this.state = "start";
    }
  },

  danger(){
    const S = G.state.ship, st = G.st;
    if (S.hu < st.hullMax * .92) return true;
    if (S.ar < st.armorMax * .4 && S.sh < st.shieldMax * .35) return true;
    const weak = this.shipTier(G.state.ship.typeId) < 1 || !this.hasWeapon(G.state.ship);
    if (weak && S.ar < st.armorMax * .75 && S.sh < st.shieldMax * .5) return true;
    return false;
  },

  decideSpace(){
    if (!this.activity) this.activity = this.planActivity();
    const M = G.state.mission;
    if (this.activity.startsWith("mission") || this.activity === "courier"){
      if (!M){ this.activity = null; this.state = "start"; this.wait = 1; this.activity = this.planActivity(); }
    }
    this.tripN++;
    switch(this.activity){
      case "mission_kill": this.state = "mission_kill"; break;
      case "mission_mine": this.state = "mission_mine"; break;
      case "courier": this.state = "courier"; break;
      case "mine": this.state = "mine"; this.say("开始采矿作业"); break;
      default: this.state = "rat"; this.say("开始巡猎海盗"); break;
    }
  },

  travel(dest, then){
    this.state = "travel";
    this.ctx.dest = dest; this.ctx.then = then;
    G.setDest(dest);
    G.state.autopilot = true;
    this.say(`启程前往 ${DATA.SYSTEMS[dest].cn}（${(G.state.route||[]).length} 跳，自动导航）`);
    if (!this.mapShown && window.Panels){
      this.mapShown = true;
      Panels.map(); UI.openWin("map");
      setTimeout(()=>{ if (window.UI) UI.closeWin("map"); }, 6000);
    }
  },
  travelTick(){
    if (G.state.loc.system === this.ctx.dest){
      G.state.autopilot = false;
      this.state = this.ctx.then || "start";
      return;
    }
    if (G.me.nav && !G.me.nav.act) G.me.nav = null;
    if (!G.state.autopilot || G.state.dest !== this.ctx.dest){
      G.setDest(this.ctx.dest);
      G.state.autopilot = true;
    }
  },

  dockTick(){
    const me = G.me;
    if (me.warp || me.nav) return;
    let st = null;
    if (this.ctx.stationName) st = G.space.ents.find(e=>e.kind==="station" && e.name===this.ctx.stationName);
    if (!st && this.ctx.stationSys && G.state.loc.system !== this.ctx.stationSys){
      return this.travel(this.ctx.stationSys, "godock");
    }
    if (!st) st = G.space.ents.filter(e=>e.kind==="station").sort((a,b)=>G.distTo(a)-G.distTo(b))[0];
    if (!st){
      const sys = this.nearestStationSys();
      if (sys) return this.travel(sys, "godock");
      return;
    }
    this.say(`返回空间站：${st.name}`);
    G.cmdDock(st.id);
  },
  goDock(stationName, stationSys){
    this.state = "godock";
    this.ctx.stationName = stationName || null;
    this.ctx.stationSys = stationSys || null;
    if (G.me && !G.me.warp){
      if (G.me.nav && !G.me.nav.act) G.me.nav = null;
      G.deactivateAll();
    }
  },

  /* ---------- combat ---------- */
  orbitRangeFor(){
    let ranges = [];
    for (const m of G.mods.hi){
      if (!m) continue;
      const md = DATA.MODULES[m.tid];
      if (md.type === "turret") ranges.push(Math.max(1500, md.optimal * .9));
      if (md.type === "launcher") ranges.push(Math.min(md.range * .4, 12000));
    }
    return ranges.length ? clamp(Math.min(...ranges), 1200, 22000) : 5000;
  },
  engage(t){
    const me = G.me;
    const dist = G.distTo(t);
    if (dist > G.st.tgtRange){
      if (!me.nav || me.nav.targetId !== t.id) G.cmdApproach(t.id);
      this.propMgmt(true);
      return;
    }
    const l = G.lockOf(t.id);
    if (!l){ G.tryLock(t.id); return; }
    if (!l.done){ this.defenseMgmt(); return; }
    me.activeTarget = t.id;
    if (me.locks.length < Math.min(G.st.maxTargets, 3)){
      const extra = G.space.ents.find(e=>e.kind==="npc" && !G.lockOf(e.id) && G.distTo(e) < G.st.tgtRange);
      if (extra) G.tryLock(extra.id);
    }
    const orbit = this.orbitRangeFor();
    if (!me.nav || me.nav.mode !== "orbit" || me.nav.targetId !== t.id) G.cmdOrbit(t.id, orbit);
    for (let i=0;i<G.mods.hi.length;i++){
      const m = G.mods.hi[i];
      if (!m || m.on) continue;
      const md = DATA.MODULES[m.tid];
      const inR = md.type === "launcher" ? dist < md.range*.95
        : md.type === "turret" ? dist < md.optimal + md.falloff : false;
      if (inR) G.toggleMod("hi", i);
    }
    for (let i=0;i<G.mods.mid.length;i++){
      const m = G.mods.mid[i];
      if (!m || m.on) continue;
      const md = DATA.MODULES[m.tid];
      if (md.type === "web" && dist < md.optimal*.95) G.toggleMod("mid", i);
    }
    this.propMgmt(dist > orbit*1.6);
    this.defenseMgmt();
  },
  propMgmt(want){
    const S = G.state.ship;
    for (let i=0;i<G.mods.mid.length;i++){
      const m = G.mods.mid[i];
      if (!m || DATA.MODULES[m.tid].type !== "prop") continue;
      const capF = S.cap / G.st.capMax;
      if (want && !m.on && capF > .4) G.toggleMod("mid", i);
      if (m.on && (!want || capF < .18)) G.toggleMod("mid", i);
    }
  },
  defenseMgmt(){
    const S = G.state.ship;
    const rows = { mid:G.mods.mid, low:G.mods.low };
    for (const [row, mods] of Object.entries(rows)){
      for (let i=0;i<mods.length;i++){
        const m = mods[i];
        if (!m) continue;
        const md = DATA.MODULES[m.tid];
        if (md.type === "shieldBoost"){
          const f = S.sh / G.st.shieldMax, capF = S.cap / G.st.capMax;
          if (!m.on && f < .7 && capF > .3) G.toggleMod(row, i);
          if (m.on && (f > .95 || capF < .15)) G.toggleMod(row, i);
        }
        if (md.type === "armorRep"){
          const f = S.ar / G.st.armorMax, capF = S.cap / G.st.capMax;
          if (!m.on && f < .75 && capF > .3) G.toggleMod(row, i);
          if (m.on && (f > .97 || capF < .15)) G.toggleMod(row, i);
        }
      }
    }
  },
  lootPass(){
    const w = G.space.ents.filter(e=>e.kind==="wreck" && e.loot.length && G.distTo(e) < 200000)
      .sort((a,b)=>G.distTo(a)-G.distTo(b))[0];
    if (!w || this.freeCargo() < 5) return false;
    if (G.distTo(w) > 2300){
      if (!G.me.nav || G.me.nav.targetId !== w.id){ this.say("回收战场残骸"); G.cmdApproach(w.id); }
      this.propMgmt(true);
    } else {
      G.lootAll(w);
    }
    return true;
  },
  warpNextBelt(safeOnly){
    let belts = G.space.ents.filter(e=>e.kind==="belt" && !this.ctx.visited.includes(e.id));
    if (safeOnly){
      belts = belts.filter(b=>!G.space.ents.some(e=>e.kind==="npc" && G.dist(e,b) < 80000));
    }
    if (!belts.length) return false;
    const b = belts[Math.floor(Math.random()*belts.length)];
    this.ctx.visited.push(b.id);
    this.say(`跃迁至 ${b.name}`);
    if (G.distTo(b) > 150000) G.cmdWarpEnt(b.id, 10000);
    return true;
  },
  roam(){
    const gates = G.space.ents.filter(e=>e.kind==="gate" && DATA.SYSTEMS[e.dest].sec >= this.minSec());
    if (!gates.length) return false;
    const g = gates[Math.floor(Math.random()*gates.length)];
    this.say(`巡航至邻近星系：${DATA.SYSTEMS[g.dest].cn}（安等 ${DATA.SYSTEMS[g.dest].sec.toFixed(1)}）`);
    G.cmdJumpGate(g.id);
    return true;
  },

  ratTick(){
    if (G.me.warp) return;
    const t = G.space.ents.filter(e=>e.kind==="npc" && G.distTo(e) < 250000)
      .sort((a,b)=>G.distTo(a)-G.distTo(b))[0];
    if (t){
      if (this.lastSay.indexOf("交战") < 0) this.say(`交战：${t.name}（赏金 ${fmtISK(DATA.NPCS[t.npc].bounty)}）`);
      this.engage(t);
      return;
    }
    if (this.lootPass()) return;
    if (this.freeCargo() < 30 && G.state.ship.cargo.length > 2){ this.say("战利品舱位吃紧，回站变卖"); return this.goDock(); }
    if (this.warpNextBelt()) return;
    if (Math.random() < .6 && this.roam()) return;
    this.say("本星系已肃清，回站整备");
    this.goDock();
  },

  minerRange(){
    let r = 99999999;
    for (const m of G.mods.hi){
      if (m && DATA.MODULES[m.tid].type === "miner") r = Math.min(r, DATA.MODULES[m.tid].optimal);
    }
    return r === 99999999 ? 10000 : r;
  },
  mineTick(oreId){
    if (G.me.warp) return;
    if (this.freeOreSpace() < 5){
      this.say("矿舱满载，返航卸货");
      const M = G.state.mission;
      if (M && M.type==="mining") this.goDock(M.agentStation, M.agentSystem);
      else this.goDock();
      return;
    }
    const combatCapable = this.shipTier(G.state.ship.typeId) >= 1 && this.hasWeapon(G.state.ship);
    let rocks = G.space.ents.filter(e=>e.kind==="roid" && (!oreId || e.ore===oreId));
    if (!combatCapable)
      rocks = rocks.filter(r=>!G.space.ents.some(e=>e.kind==="npc" && G.dist(e,r) < 55000));
    if (!rocks.length){
      if (oreId){
        this.mineFail++;
        this.say(`本星系无法安全采到${DATA.ORES[oreId].cn}，返回代理人处`);
        const M = G.state.mission;
        return this.goDock(M ? M.agentStation : null, M ? M.agentSystem : null);
      }
      if (this.warpNextBelt(!combatCapable)) return;
      if (Math.random() < .6 && this.roam()) return;
      return this.goDock();
    }
    const near = rocks.filter(r=>G.distTo(r) < 300000).sort((a,b)=>{
      const pa = DATA.ORES[a.ore].price*3 - G.distTo(a)/1000, pb = DATA.ORES[b.ore].price*3 - G.distTo(b)/1000;
      return pb - pa;
    })[0];
    if (!near){
      const target = rocks.sort((a,b)=>G.distTo(a)-G.distTo(b))[0];
      const belt = G.space.ents.filter(e=>e.kind==="belt").sort((a,b)=>G.dist(a,target)-G.dist(b,target))[0];
      if (belt && G.distTo(belt) > 150000){ this.say(`跃迁至 ${belt.name}`); G.cmdWarpEnt(belt.id, 10000); }
      else if (!G.me.nav) G.cmdApproach(target.id);
      return;
    }
    const aggressor = G.space.ents.find(e=>e.kind==="npc" && e.aggro && G.distTo(e) < 40000);
    if (aggressor && !combatCapable){
      this.say("采矿点遭海盗袭击，紧急转移！");
      if (!this.warpNextBelt(true)) this.goDock();
      return;
    } else if (aggressor && combatCapable){
      this.say(`击退来袭海盗：${aggressor.name}`);
      this.engage(aggressor);
      return;
    }
    const dist = G.distTo(near);
    const range = this.minerRange();
    if (dist > range - 500){
      if (!G.me.nav || G.me.nav.targetId !== near.id) G.cmdApproach(near.id);
      this.propMgmt(dist > 20000);
      return;
    }
    this.propMgmt(false);
    const l = G.lockOf(near.id);
    if (!l){ G.tryLock(near.id); return; }
    if (!l.done) return;
    G.me.activeTarget = near.id;
    if (!G.me.nav || G.me.nav.mode!=="orbit") G.cmdOrbit(near.id, Math.min(range-2000, 7000));
    let started = false;
    for (let i=0;i<G.mods.hi.length;i++){
      const m = G.mods.hi[i];
      if (m && DATA.MODULES[m.tid].type === "miner" && !m.on){ G.toggleMod("hi", i); started = true; }
    }
    if (started) this.say(`采掘 ${near.name} — 储量 ${fmtNum(near.units)} 单位`);
  },

  missionKillTick(){
    const M = G.state.mission;
    if (!M || M.type !== "kill"){ this.state = "start"; return; }
    if (G.state.loc.system !== M.system) return this.travel(M.system, "mission_kill");
    if (G.me.warp) return;
    if (!M.ships.length){
      if (this.lootPass()) return;
      this.say("任务目标全部消灭，返回代理人处交付");
      return this.goDock(M.agentStation, M.agentSystem);
    }
    const t = G.space.ents.filter(e=>e.kind==="npc" && e.mission).sort((a,b)=>G.distTo(a)-G.distTo(b))[0]
      || G.space.ents.filter(e=>e.kind==="npc" && G.distTo(e)<200000).sort((a,b)=>G.distTo(a)-G.distTo(b))[0];
    const beacon = G.space.ents.find(e=>e.kind==="beacon");
    if (!t){
      if (beacon && G.distTo(beacon) > 100000){ this.say("跃迁至遭遇战信标"); G.cmdWarpEnt(beacon.id, 20000); }
      return;
    }
    if (G.distTo(t) > 200000 && beacon){ this.say("跃迁至遭遇战信标"); G.cmdWarpEnt(beacon.id, 20000); return; }
    if (this.lastSay.indexOf("任务交战") < 0) this.say(`任务交战：${t.name}（剩余 ${M.ships.length} 艘）`);
    this.engage(t);
  },
  missionMineTick(){
    const M = G.state.mission;
    if (!M || M.type !== "mining"){ this.state = "start"; return; }
    if (this.haveMissionOreTotal() >= M.qty){
      this.say(`任务矿石已集齐，返回交付`);
      return this.goDock(M.agentStation, M.agentSystem);
    }
    this.mineTick(M.ore);
  },
  courierTick(){
    const M = G.state.mission;
    if (!M || M.type !== "courier"){ this.state = "start"; return; }
    if (G.state.loc.system !== M.destSys) return this.travel(M.destSys, "courier");
    this.say("抵达目的星系，前往交货空间站");
    this.goDock(M.destStation, M.destSys);
  },
};
window.Bot = Bot;
