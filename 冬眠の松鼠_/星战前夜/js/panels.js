"use strict";
const Panels = {

  refreshOpen(){
    const map = {
      station: ()=>this.station(), market: ()=>this.market(), fitting: ()=>this.fitting(),
      cargo: ()=>this.cargo(), hangar: ()=>this.hangar(), char: ()=>this.charSheet(),
      wallet: ()=>this.wallet(), missions: ()=>this.missions(), refine: ()=>this.refine(),
    };
    for (const [id, fn] of Object.entries(map)) if (UI.isOpen(id)) fn();
    if (!G.state.loc.docked) UI.rebuildModRows();
  },
  refreshCargo(){
    if (UI.isOpen("cargo")) this.cargo();
    if (UI.isOpen("hangar")) this.hangar();
  },

  /* ================= station ================= */
  station(){
    const w = UI.mkWin("station", "空间站服务", { x: window.innerWidth-400, y: 60, w: 380 });
    const S = G.state.ship, d = G.shipData();
    const stn = DATA.SYSTEMS[G.state.loc.system].stations.find(s=>s.name===G.state.loc.docked);
    const hasAgent = stn && stn.agent;
    const repC = G.repairCost();
    const missionNote = G.state.mission && G.missionReady()
      ? `<div style="padding:6px 10px" class="green">✔ 任务【${G.state.mission.title}】目标已达成，可在任务日志中交付。</div>` : "";
    w.body.innerHTML = `
      <div style="padding:8px 10px;border-bottom:1px solid #1c2932">
        <div class="hl" style="font-size:13px">${G.state.loc.docked}</div>
        <div class="dim">当前舰船：${d.cn} <span class="dim">(${d.clsCN})</span></div>
      </div>
      ${missionNote}
      <div class="svcgrid">
        <div class="svcbtn" onclick="G.undock()"><span class="ico">⇧</span><span class="lbl">离站</span></div>
        <div class="svcbtn" onclick="G.repairAll()"><span class="ico">✚</span><span class="lbl">维修${repC>0 ? "<br>"+fmtISK(repC) : ""}</span></div>
        <div class="svcbtn" onclick="UI.toggleWin('market',()=>Panels.market());"><span class="ico">⚖</span><span class="lbl">地区市场</span></div>
        <div class="svcbtn" onclick="UI.toggleWin('fitting',()=>Panels.fitting());"><span class="ico">⚙</span><span class="lbl">装配管理</span></div>
        <div class="svcbtn" onclick="UI.toggleWin('hangar',()=>Panels.hangar());"><span class="ico">▤</span><span class="lbl">物品机库</span></div>
        <div class="svcbtn" onclick="UI.toggleWin('refine',()=>Panels.refine());"><span class="ico">◭</span><span class="lbl">精炼厂</span></div>
        ${hasAgent ? `<div class="svcbtn" onclick="UI.toggleWin('missions',()=>Panels.missions());"><span class="ico">✉</span><span class="lbl">代理人</span></div>` : ""}
      </div>`;
    return w;
  },

  /* ================= cargo ================= */
  itemRow(it, actions){
    const d = DATA.item(it.id);
    return `<tr class="row"><td>${d.cn}</td><td class="dim">×${fmtNum(it.qty)}</td>
      <td class="dim">${Math.round(d.vol*it.qty*10)/10} m³</td><td style="text-align:right">${actions}</td></tr>`;
  },
  cargo(){
    const w = UI.mkWin("cargo", "货柜舱", { x: 120, y: 120, w: 430, h: 340 });
    const S = G.state.ship, d = G.shipData();
    const docked = !!G.state.loc.docked;
    let html = `<div class="kv"><span>货柜舱</span><b>${Math.round(G.cargoUsed()*10)/10} / ${fmtNum(G.st.cargoCap)} m³</b></div>
      <div class="qbar" style="margin:0 8px"><i style="width:${clamp(G.cargoUsed()/G.st.cargoCap*100,0,100)}%"></i></div>
      <table class="tbl">`;
    if (!S.cargo.length) html += `<tr><td class="dim" style="padding:10px">— 空 —</td></tr>`;
    for (const it of S.cargo){
      const acts = [];
      if (docked) acts.push(`<span class="btn sm" onclick="Panels.moveToHangar('cargo','${it.id}')">存入机库</span>`);
      if (it.id.startsWith("book_")) acts.push(`<span class="btn sm" onclick="G.injectBook('${it.id.slice(5)}')">注入</span>`);
      html += this.itemRow(it, acts.join(" "));
    }
    html += `</table>`;
    if (d.oreHold > 0){
      html += `<div class="kv" style="margin-top:6px"><span>矿石舱</span><b>${Math.round(G.oreUsed()*10)/10} / ${fmtNum(d.oreHold)} m³</b></div>
        <div class="qbar" style="margin:0 8px"><i style="width:${clamp(G.oreUsed()/d.oreHold*100,0,100)}%"></i></div><table class="tbl">`;
      if (!S.ore.length) html += `<tr><td class="dim" style="padding:10px">— 空 —</td></tr>`;
      for (const it of S.ore){
        const acts = docked ? `<span class="btn sm" onclick="Panels.moveToHangar('ore','${it.id}')">存入机库</span>` : "";
        html += this.itemRow(it, acts);
      }
      html += "</table>";
    }
    w.body.innerHTML = html;
    return w;
  },
  moveToHangar(src, id){
    const list = src === "ore" ? G.state.ship.ore : G.state.ship.cargo;
    const qty = G.countItem(list, id);
    if (qty <= 0) return;
    G.remItem(list, id, qty);
    G.addItem(G.hangar().items, id, qty);
    UI.toast("已存入机库");
    this.refreshOpen();
  },
  moveToCargo(id){
    const h = G.hangar();
    const qty = G.countItem(h.items, id);
    if (qty <= 0) return;
    const d = DATA.item(id);
    const space = G.st.cargoCap - G.cargoUsed();
    const can = Math.min(qty, Math.floor(space / Math.max(.001, d.vol)));
    if (can <= 0) return UI.toast("货柜空间不足","warn");
    G.remItem(h.items, id, can);
    G.addItem(G.state.ship.cargo, id, can);
    UI.toast(`已移至货柜 ×${fmtNum(can)}`);
    this.refreshOpen();
  },

  /* ================= hangar ================= */
  hangar(){
    const w = UI.mkWin("hangar", "物品机库", { x: 170, y: 110, w: 480, h: 400 });
    const h = G.hangar();
    let html = `<div class="sect">舰船（${h.ships.length}）</div><table class="tbl">`;
    if (!h.ships.length) html += `<tr><td class="dim" style="padding:8px">机库中没有其他舰船</td></tr>`;
    h.ships.forEach((s,i)=>{
      const d = DATA.SHIPS[s.typeId];
      const can = G.canFly(s.typeId);
      html += `<tr class="row"><td>${d.cn} <span class="dim">${d.clsCN}</span></td>
        <td style="text-align:right">
        <span class="btn sm ${can?"":"disabled"}" onclick="G.activateShip(${i})" title="${can?"":"技能不足"}">登舰</span>
        <span class="btn sm danger" onclick="G.sellShipIdx(${i})">出售 (${fmtISK(Math.floor(d.price*.8))})</span></td></tr>`;
    });
    html += `</table><div class="sect">物品（${h.items.length} 种）</div><table class="tbl">`;
    if (!h.items.length) html += `<tr><td class="dim" style="padding:8px">— 空 —</td></tr>`;
    for (const it of h.items){
      const d = DATA.item(it.id);
      const acts = [];
      if (d.cat === "module") acts.push(`<span class="btn sm" onclick="G.fitModule('${it.id}')">装配</span>`);
      if (d.cat === "book") acts.push(`<span class="btn sm" onclick="G.injectBook('${d.skill}')">注入</span>`);
      acts.push(`<span class="btn sm" onclick="Panels.moveToCargo('${it.id}')">移至货柜</span>`);
      html += this.itemRow(it, acts.join(" "));
    }
    html += "</table>";
    w.body.innerHTML = html;
    return w;
  },

  /* ================= refine ================= */
  refine(){
    const w = UI.mkWin("refine", "精炼厂", { x: 250, y: 150, w: 430, h: 320 });
    const y = Math.round(G.refineYield()*100);
    let html = `<div class="kv"><span>精炼产出率（再处理技能 ${DATA.ROMAN[G.skillLvl("reprocessing")-1]||0} 级）</span><b class="hl">${y}%</b></div><table class="tbl">`;
    let any = false;
    const srcs = [["hangar","机库", G.hangar().items], ["cargo","货柜", G.state.ship.cargo], ["ore","矿石舱", G.state.ship.ore]];
    for (const [src, label, list] of srcs){
      for (const it of list){
        if (!DATA.ORES[it.id]) continue;
        any = true;
        const od = DATA.ORES[it.id];
        const out = Object.entries(od.minerals).map(([m,per])=>`${DATA.MINERALS[m].cn}×${fmtNum(Math.floor(per*it.qty*G.refineYield()))}`).join(" ");
        html += `<tr class="row"><td>${od.cn} <span class="dim">×${fmtNum(it.qty)}（${label}）</span><br><span class="dim" style="font-size:10px">→ ${out}</span></td>
          <td style="text-align:right"><span class="btn sm" onclick="G.refineOre('${src}','${it.id}')">精炼</span></td></tr>`;
      }
    }
    if (!any) html += `<tr><td class="dim" style="padding:10px">没有可精炼的矿石</td></tr>`;
    html += "</table>";
    w.body.innerHTML = html;
    return w;
  },

  /* ================= market ================= */
  marketTab: "buy",
  market(){
    const w = UI.mkWin("market", "地区市场", { x: 200, y: 70, w: 560, h: 480 });
    const tab = this.marketTab;
    let html = `<div class="tabs">
      <div class="tab ${tab==="buy"?"on":""}" onclick="Panels.marketTab='buy';Panels.market()">购买</div>
      <div class="tab ${tab==="sell"?"on":""}" onclick="Panels.marketTab='sell';Panels.market()">出售</div>
      <div style="margin-left:auto;padding:4px 10px" class="dim">钱包：<span class="gold">${fmtISK(G.state.pilot.isk)}</span> · 交易税 ${(G.tax()*100).toFixed(1)}%</div>
    </div><div style="height:calc(100% - 26px);overflow-y:auto">`;
    html += tab === "buy" ? this.marketBuy() : this.marketSell();
    html += "</div>";
    w.body.innerHTML = html;
    return w;
  },
  marketBuy(){
    const cls = [["frig","护卫舰"],["dessie","驱逐舰"],["cruiser","巡洋舰"],["bc","战列巡洋舰"],["bs","战列舰"],["indy","工业舰"],["rookie","新手船"]];
    let html = "";
    const shipRow = (id)=>{
      const d = DATA.SHIPS[id];
      const can = G.canFly(id);
      return `<tr class="row" title="${d.desc||""}"><td>${d.cn} <span class="dim">${d.en}</span>${can?"":' <span class="red" title="技能不足">✖技能</span>'}</td>
        <td class="r gold">${fmtISK(d.price)}</td>
        <td style="text-align:right"><span class="btn sm" onclick="G.buyItem('${id}',1)">买入</span></td></tr>`;
    };
    for (const [c, label] of cls){
      const ships = Object.keys(DATA.SHIPS).filter(k=>DATA.SHIPS[k].cls===c);
      if (!ships.length) continue;
      html += `<div class="sect">舰船 — ${label}</div><table class="tbl pricegrid">` + ships.map(shipRow).join("") + "</table>";
    }
    const modGroups = [
      ["武器 — 小型", m=>["turret","launcher"].includes(m.type) && m.size==="S" && !m.cn.startsWith("民用")],
      ["武器 — 中型", m=>["turret","launcher"].includes(m.type) && m.size==="M"],
      ["武器 — 大型", m=>["turret","launcher"].includes(m.type) && m.size==="L"],
      ["采矿装备", m=>m.type==="miner" || m.miningMult],
      ["推进装备", m=>m.type==="prop" || m.speedMult],
      ["护盾装备", m=>m.type==="shieldBoost" || m.shieldAdd || m.capRtMult],
      ["装甲与船体", m=>m.type==="armorRep" || m.dcBonus || m.cargoMult || m.pgMult || m.cpuMult],
      ["电子与火控", m=>m.type==="web" || m.scanResMult || m.dmgMult],
    ];
    const used = new Set();
    for (const [label, filter] of modGroups){
      const mods = Object.entries(DATA.MODULES).filter(([id,m])=>!used.has(id) && filter(m) && m.price > 1000);
      if (!mods.length) continue;
      mods.forEach(([id])=>used.add(id));
      html += `<div class="sect">装备 — ${label}</div><table class="tbl pricegrid">`;
      for (const [id, m] of mods){
        const req = (m.req||[]).map(([s,l])=>DATA.SKILLS[s].cn+" "+DATA.ROMAN[l-1]).join("，");
        html += `<tr class="row" title="${req?"需要技能："+req:""}"><td>${m.cn}${G.meetsReq(m.req)?"":' <span class="red">✖技能</span>'}</td>
          <td class="r gold">${fmtISK(m.price)}</td>
          <td style="text-align:right"><span class="btn sm" onclick="G.buyItem('${id}',1)">买1</span> <span class="btn sm" onclick="G.buyItem('${id}',5)">买5</span></td></tr>`;
      }
      html += "</table>";
    }
    html += `<div class="sect">技能书</div><table class="tbl pricegrid">`;
    for (const [id, sk] of Object.entries(DATA.SKILLS)){
      const known = G.skillKnown(id);
      html += `<tr class="row" title="${sk.desc}"><td>技能书：${sk.cn} <span class="dim">等级${sk.rank}</span>${known?' <span class="green">已掌握</span>':""}</td>
        <td class="r gold">${fmtISK(sk.book)}</td>
        <td style="text-align:right">${known?"":`<span class="btn sm" onclick="G.buyItem('book_${id}',1)">买入</span>`}</td></tr>`;
    }
    html += `</table><div class="sect">矿物与商品</div><table class="tbl pricegrid">`;
    for (const [id, m] of Object.entries(DATA.MINERALS)){
      html += `<tr class="row"><td>${m.cn}</td><td class="r gold">${fmtISK(m.price)}</td>
        <td style="text-align:right"><span class="btn sm" onclick="G.buyItem('${id}',100)">买100</span> <span class="btn sm" onclick="G.buyItem('${id}',1000)">买1000</span></td></tr>`;
    }
    for (const [id, o] of Object.entries(DATA.ORES)){
      html += `<tr class="row"><td>${o.cn} <span class="dim">矿石</span></td><td class="r gold">${fmtISK(o.price)}</td>
        <td style="text-align:right"><span class="btn sm" onclick="G.buyItem('${id}',100)">买100</span> <span class="btn sm" onclick="G.buyItem('${id}',1000)">买1000</span></td></tr>`;
    }
    html += "</table>";
    return html;
  },
  marketSell(){
    let html = `<div class="sect">可出售物品（税率 ${(G.tax()*100).toFixed(1)}%）</div><table class="tbl pricegrid">`;
    const srcs = [["hangar","机库", G.hangar().items], ["cargo","货柜", G.state.ship.cargo], ["ore","矿石舱", G.state.ship.ore]];
    let any = false;
    for (const [src, label, list] of srcs){
      for (const it of list){
        const d = DATA.item(it.id);
        if (d.noTrade) continue;
        any = true;
        const unit = Math.floor(d.price * (1-G.tax()));
        html += `<tr class="row"><td>${d.cn} <span class="dim">×${fmtNum(it.qty)}（${label}）</span></td>
          <td class="r gold">${fmtISK(unit)}/个</td>
          <td style="text-align:right"><span class="btn sm" onclick="G.sellStack('${src}','${it.id}',${it.qty})">全部出售 (${fmtISK(unit*it.qty)})</span></td></tr>`;
      }
    }
    if (!any) html += `<tr><td class="dim" style="padding:10px">没有可出售的物品。去采矿或打击海盗吧。</td></tr>`;
    html += "</table>";
    return html;
  },

  /* ================= fitting ================= */
  fitting(){
    const w = UI.mkWin("fitting", "装配管理", { x: 240, y: 60, w: 520, h: 520 });
    const S = G.state.ship, d = G.shipData();
    const docked = !!G.state.loc.docked;
    const u = G.fitUsage();
    const slotHtml = (row, label)=>{
      let h = `<div class="sect">${label}（${S.fit[row].filter(x=>x).length}/${d.slots[row]}）</div><div class="fitslotrow">`;
      S.fit[row].forEach((tid,i)=>{
        if (tid){
          const m = DATA.MODULES[tid];
          h += `<div class="fitslot filled" title="${m.cn}${docked?"（点击卸载）":""}" onclick="${docked?`G.unfitModule('${row}',${i})`:""}">
            ${UI.modGlyph(m)}<span class="sz">${m.size||""}</span></div>`;
        } else h += `<div class="fitslot dim" title="空槽位">·</div>`;
      });
      return h + "</div>";
    };
    let dps = 0, volley = 0, miningPerMin = 0;
    for (const tid of S.fit.hi){
      if (!tid) continue;
      const m = DATA.MODULES[tid];
      if (m.type === "turret" || m.type === "launcher"){
        const raw = Object.values(m.dmg).reduce((a,b)=>a+b,0) * G.st.dmgMult[m.wg];
        dps += raw / m.cycle; volley += raw;
      }
      if (m.type === "miner") miningPerMin += m.yield * G.st.miningMult;
    }
    const ehp = S.sh/(1-avg(G.st.resShield)) + S.ar/(1-avg(G.st.resArmor)) + S.hu/(1-avg(G.st.resHull));
    function avg(r){ return (r[0]+r[1]+r[2]+r[3])/4; }
    let drain = 0;
    for (const row of ["hi","mid","low"]) for (const tid of S.fit[row]){
      if (!tid) continue;
      const m = DATA.MODULES[tid];
      if (m.cap && m.cycle) drain += m.cap/m.cycle;
      if (m.drain) drain += m.drain;
    }
    const peak = 2.5 * G.st.capMax / G.st.capRt;
    const capStable = peak >= drain;
    const alignT = 1.386 * G.st.inertia * G.st.mass / 1e6;
    const bar = (used, max)=>`<div class="qbar"><i style="width:${clamp(used/max*100,0,100)}%;background:${used>max?"#c85a5a":""}"></i></div>`;
    w.body.innerHTML = `
      <div style="padding:8px 10px;border-bottom:1px solid #1c2932">
        <b class="hl" style="font-size:13px">${d.cn}</b> <span class="dim">${d.en} · ${d.clsCN}</span><br>
        <span class="dim" style="font-size:11px">${d.desc||""}</span>
      </div>
      ${slotHtml("hi","高能量槽")}${slotHtml("mid","中能量槽")}${slotHtml("low","低能量槽")}
      <div class="sect">资源</div>
      <div class="kv"><span>CPU</span><b>${u.cpu.toFixed(1)} / ${G.st.cpuMax.toFixed(1)} tf</b></div>${bar(u.cpu, G.st.cpuMax)}
      <div class="kv"><span>能量栅格</span><b>${u.pg.toFixed(1)} / ${G.st.pgMax.toFixed(1)} MW</b></div>${bar(u.pg, G.st.pgMax)}
      <div class="sect">性能</div>
      <div style="display:grid;grid-template-columns:1fr 1fr">
        <div class="kv"><span>DPS</span><b class="red">${dps.toFixed(1)}</b></div>
        <div class="kv"><span>齐射伤害</span><b>${volley.toFixed(0)}</b></div>
        <div class="kv"><span>有效生命值 (EHP)</span><b>${fmtNum(ehp)}</b></div>
        <div class="kv"><span>采矿量</span><b>${miningPerMin.toFixed(0)} m³/分</b></div>
        <div class="kv"><span>最大速度</span><b>${fmtNum(G.st.maxSpeed)} m/s</b></div>
        <div class="kv"><span>校准时间</span><b>${alignT.toFixed(1)} 秒</b></div>
        <div class="kv"><span>电容</span><b class="${capStable?"green":"gold"}">${capStable?"稳定":"峰值不足"}</b></div>
        <div class="kv"><span>锁定距离</span><b>${fmtDist(G.st.tgtRange)}</b></div>
        <div class="kv"><span>扫描分辨率</span><b>${fmtNum(G.st.scanRes)} mm</b></div>
        <div class="kv"><span>货柜容量</span><b>${fmtNum(G.st.cargoCap)} m³</b></div>
        <div class="kv"><span>护盾/装甲/结构</span><b>${fmtNum(G.st.shieldMax)}/${fmtNum(G.st.armorMax)}/${fmtNum(G.st.hullMax)}</b></div>
        <div class="kv"><span>信号半径</span><b>${fmtNum(G.st.sig)} m</b></div>
      </div>
      ${docked ? this.fitQuick() : `<div class="dim" style="padding:8px 10px">提示：装配与卸载需要停靠在空间站。</div>`}`;
    return w;
  },
  fitQuick(){
    const mods = G.hangar().items.filter(it=>DATA.item(it.id).cat==="module");
    if (!mods.length) return `<div class="dim" style="padding:8px 10px">机库中没有可装配的模块（可在市场购买）。</div>`;
    let h = `<div class="sect">机库模块（点击装配）</div><table class="tbl">`;
    for (const it of mods){
      const m = DATA.MODULES[it.id];
      h += `<tr class="row"><td>${m.cn} <span class="dim">×${it.qty}</span></td>
        <td class="dim">${{hi:"高槽",mid:"中槽",low:"低槽"}[m.slot]}</td>
        <td style="text-align:right"><span class="btn sm" onclick="G.fitModule('${it.id}')">装配</span></td></tr>`;
    }
    return h + "</table>";
  },

  /* ================= character ================= */
  charSheet(){
    const w = UI.mkWin("char", "角色表", { x: 90, y: 60, w: 460, h: 520 });
    const p = G.state.pilot;
    const race = DATA.RACES[p.race];
    let skillsHtml = "";
    const known = Object.keys(p.skills).sort((a,b)=>DATA.SKILLS[a].cn.localeCompare(DATA.SKILLS[b].cn));
    for (const id of known){
      const sk = DATA.SKILLS[id], s = p.skills[id];
      const sq = Array.from({length:5},(_,i)=>`<span style="display:inline-block;width:8px;height:8px;margin-right:1px;background:${i<s.lvl?"#58a6c8":"#1a262f"};border:1px solid #2a3b47"></span>`).join("");
      const queued = p.queue.filter(q=>q.id===id).length;
      skillsHtml += `<tr class="row" title="${sk.desc}"><td>${sk.cn} <span class="dim">×${sk.rank}</span></td>
        <td>${sq}</td><td class="dim">${fmtNum(s.sp)} SP</td>
        <td style="text-align:right">${s.lvl + queued < 5 ? `<span class="btn sm" onclick="G.queueTrain('${id}')">训练</span>` : ""}</td></tr>`;
    }
    let queueHtml = "";
    if (!p.queue.length) queueHtml = `<div class="dim" style="padding:8px 10px">训练队列为空。选择技能开始训练（加速训练：约为 EVE 的 90 倍速）。</div>`;
    else {
      p.queue.forEach((q,i)=>{
        const sk = DATA.SKILLS[q.id], s = p.skills[q.id];
        let prog = 0;
        if (i === 0){
          const from = DATA.LVL_SP[q.toLvl-1]*sk.rank, to = DATA.LVL_SP[q.toLvl]*sk.rank;
          prog = clamp((s.sp-from)/(to-from)*100, 0, 100);
        }
        queueHtml += `<div style="padding:3px 10px">
          <div style="display:flex;justify-content:space-between"><span>${i+1}. ${sk.cn} <b class="hl">${DATA.ROMAN[q.toLvl-1]}</b></span>
          <span class="win-x" style="cursor:pointer" onclick="Panels.dropQueue(${i})">✕</span></div>
          ${i===0?`<div class="qbar"><i style="width:${prog}%"></i></div>`:""}</div>`;
      });
      queueHtml += `<div class="kv"><span>队列总时长</span><b>${fmtTime(G.queueETA())}</b></div>`;
    }
    w.body.innerHTML = `
      <div style="display:flex;gap:10px;padding:10px;border-bottom:1px solid #1c2932">
        <div style="width:56px;height:56px;background:${race.color};display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;border:1px solid rgba(255,255,255,.3)">${p.name[0]}</div>
        <div>
          <div style="font-size:15px;color:#e8f4fb">${p.name}</div>
          <div class="dim">${race.cn} · 国立新兵学院</div>
          <div class="dim">安全等级 0.0 · 代理人声望 <b class="${p.standing>=0?"green":"red"}">${p.standing.toFixed(2)}</b></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr">
        <div class="kv"><span>总技能点</span><b>${fmtNum(G.totalSP())} SP</b></div>
        <div class="kv"><span>击毁数</span><b>${p.kills}</b></div>
        <div class="kv"><span>完成任务</span><b>${p.missionsDone}</b></div>
      </div>
      <div class="sect">训练队列</div>${queueHtml}
      <div class="sect">已掌握技能（${known.length}）</div>
      <table class="tbl">${skillsHtml}</table>
      <div class="dim" style="padding:8px 10px">提示：更多技能可在市场购买技能书后注入。</div>`;
    return w;
  },
  dropQueue(i){
    const q = G.state.pilot.queue;
    const id = q[i].id;
    G.state.pilot.queue = q.filter((e,j)=>j<i || e.id!==id);
    this.charSheet();
  },

  /* ================= wallet ================= */
  wallet(){
    const w = UI.mkWin("wallet", "钱包", { x: 300, y: 120, w: 420, h: 360 });
    let rows = "";
    for (const j of G.state.journal){
      const d = new Date(j.t);
      rows += `<tr><td class="dim">${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}</td>
        <td>${j.why}</td><td class="r ${j.amt>=0?"green":"red"}">${j.amt>=0?"+":""}${fmtISK(j.amt)}</td></tr>`;
    }
    w.body.innerHTML = `<div style="padding:12px;text-align:center;border-bottom:1px solid #1c2932">
      <span class="dim">账户余额</span><div class="gold" style="font-size:20px">${fmtISK(G.state.pilot.isk)}</div></div>
      <table class="tbl pricegrid">${rows}</table>`;
    return w;
  },

  /* ================= map ================= */
  map(){
    const w = UI.mkWin("map", "星图 — 新伊甸（局部）", { x: 200, y: 80, w: 560, h: 480 });
    w.body.innerHTML = `<canvas class="mapcanvas" id="mapCv" width="558" height="420"></canvas>
      <div class="dim" style="padding:4px 10px">点击星系设定目的地 · 黄色=当前位置 · 白框=目的地</div>`;
    const cv = w.body.querySelector("#mapCv");
    const cx = cv.getContext("2d");
    const pos = {};
    for (const [id, s] of Object.entries(DATA.SYSTEMS)) pos[id] = [ s.mx/100*480 + 40, (s.my-20)/80*360 + 20 ];
    const draw = ()=>{
      cx.clearRect(0,0,cv.width,cv.height);
      cx.strokeStyle = "#22313c";
      for (const [id, s] of Object.entries(DATA.SYSTEMS)){
        for (const g of s.gates){
          const [x1,y1] = pos[id], [x2,y2] = pos[g];
          cx.beginPath(); cx.moveTo(x1,y1); cx.lineTo(x2,y2); cx.stroke();
        }
      }
      if (G.state.route.length){
        cx.strokeStyle = "#e0b95e"; cx.lineWidth = 2;
        let prev = G.state.loc.system;
        for (const s of G.state.route){
          const [x1,y1] = pos[prev], [x2,y2] = pos[s];
          cx.beginPath(); cx.moveTo(x1,y1); cx.lineTo(x2,y2); cx.stroke();
          prev = s;
        }
        cx.lineWidth = 1;
      }
      for (const [id, s] of Object.entries(DATA.SYSTEMS)){
        const [x,y] = pos[id];
        cx.fillStyle = UI.secColor(s.sec);
        cx.beginPath(); cx.arc(x,y,5,0,7); cx.fill();
        if (id === G.state.loc.system){
          cx.strokeStyle = "#ffd76a"; cx.beginPath(); cx.arc(x,y,9,0,7); cx.stroke();
        }
        if (id === G.state.dest){
          cx.strokeStyle = "#fff"; cx.strokeRect(x-8,y-8,16,16);
        }
        cx.fillStyle = "#9fc3d8"; cx.font = "10px Segoe UI"; cx.textAlign = "center";
        cx.fillText(`${s.cn} ${s.sec.toFixed(1)}`, x, y-10);
      }
    };
    draw();
    cv.onclick = (e)=>{
      const r = cv.getBoundingClientRect();
      const mx = e.clientX-r.left, my = e.clientY-r.top;
      for (const [id] of Object.entries(DATA.SYSTEMS)){
        const [x,y] = pos[id];
        if (hypot(mx-x,my-y) < 12){
          G.setDest(id);
          draw();
          break;
        }
      }
    };
    return w;
  },

  /* ================= missions ================= */
  missions(){
    const w = UI.mkWin("missions", "任务日志 / 代理人", { x: 260, y: 100, w: 470, h: 420 });
    const M = G.state.mission;
    let html = "";
    if (M){
      const ready = G.missionReady();
      let status = "";
      if (M.type === "kill") status = M.ships.length ? `剩余目标：<b class="red">${M.ships.length}</b> 艘（前往 ${DATA.SYSTEMS[M.system].cn} 的遭遇战信标）` : `<span class="green">目标已消灭 — 返回代理人空间站</span>`;
      if (M.type === "mining"){
        const have = G.countItem(G.state.ship.cargo, M.ore) + G.countItem(G.state.ship.ore, M.ore) + (G.state.loc.docked===M.agentStation ? G.countItem(G.hangar().items, M.ore) : 0);
        status = `已收集 ${DATA.ORES[M.ore].cn}：<b>${fmtNum(have)}</b> / ${fmtNum(M.qty)}`;
      }
      if (M.type === "courier") status = `目的地：${DATA.SYSTEMS[M.destSys].cn} — ${M.destStation}`;
      html += `<div class="sect">进行中的任务</div>
        <div style="padding:8px 10px">
          <b class="gold">${M.title}</b> <span class="dim">（${DATA.AGENTS[M.agentId].cn}）</span><br>
          <span class="dim">${M.desc}</span><br><br>${status}<br><br>
          <span class="dim">报酬：</span><b class="gold">${fmtISK(M.reward + (M.bonus||0))}</b><br><br>
          ${ready?`<span class="btn primary" onclick="G.completeMission()">交付任务</span> `:""}
          <span class="btn sm danger" onclick="G.abandonMission()">放弃任务</span>
        </div>`;
    } else html += `<div class="dim" style="padding:10px">当前没有进行中的任务。</div>`;
    const stn = G.state.loc.docked ? DATA.SYSTEMS[G.state.loc.system].stations.find(s=>s.name===G.state.loc.docked) : null;
    if (stn && stn.agent){
      const ag = DATA.AGENTS[stn.agent];
      html += `<div class="sect">代理人 — ${ag.cn}</div>
        <div style="padding:4px 10px" class="dim">${ag.corp} · ${ag.div} · ${ag.level} 级代理人</div>`;
      if (M) html += `<div class="dim" style="padding:4px 10px">完成当前任务后才能接受新任务。</div>`;
      else {
        const offers = G.agentOffers(stn.agent);
        if (!offers.length){ G.state.offers[stn.agent] = null; }
        (offers.length ? offers : G.agentOffers(stn.agent)).forEach((o,i)=>{
          html += `<div style="padding:6px 10px;border-bottom:1px solid #16222b">
            <b>${o.title}</b> <span class="dim">（${{kill:"作战",mining:"采矿",courier:"运输"}[o.type]}）</span><br>
            <span class="dim">${o.brief}</span><br><span style="font-size:11px">${o.desc}</span><br>
            <span class="dim">报酬：</span><span class="gold">${fmtISK(o.reward + (o.bonus||0))}</span>
            <span class="btn sm" style="float:right" onclick="G.acceptMission('${stn.agent}',${i})">接受</span></div>`;
        });
      }
    } else if (!M){
      html += `<div class="dim" style="padding:10px">停靠在有代理人的空间站可接取任务（吉他、毛拉西、新加达里、诺福凯肯、塔玛）。</div>`;
    }
    w.body.innerHTML = html;
    return w;
  },

  /* ================= loot ================= */
  loot(wreck){
    if (!wreck){ UI.closeWin("loot"); return; }
    const w = UI.mkWin("loot", "残骸货柜", { x: window.innerWidth/2-160, y: window.innerHeight/2-140, w: 320 });
    let html = `<div class="dim" style="padding:4px 10px">${wreck.name}</div><table class="tbl">`;
    if (!wreck.loot.length) html += `<tr><td class="dim" style="padding:10px">— 空 —</td></tr>`;
    for (const l of wreck.loot){
      const d = DATA.item(l.id);
      html += `<tr class="row"><td>${d.cn}</td><td class="dim">×${l.qty}</td></tr>`;
    }
    html += `</table><div style="padding:8px;text-align:center">
      <span class="btn primary" onclick="G.lootAll(G.entById(${wreck.id})); Panels.loot(G.entById(${wreck.id}))">全部拾取</span></div>`;
    w.body.innerHTML = html;
    UI.openWin("loot");
    return w;
  },

  /* ================= settings / help ================= */
  settings(){
    const w = UI.mkWin("settings", "设置", { x: 340, y: 160, w: 320 });
    w.body.innerHTML = `<div style="padding:10px;display:flex;flex-direction:column;gap:8px">
      <label style="cursor:pointer"><input type="checkbox" ${Sound.enabled?"checked":""} onchange="Sound.enabled=this.checked"> 启用音效</label>
      <span class="btn" onclick="G.save();UI.toast('已保存','good')">立即保存</span>
      <span class="btn danger" onclick="if(confirm('确定要删除角色并重新开始吗？此操作不可恢复。'))G.reset()">删除角色（重置游戏）</span>
      <div class="dim" style="font-size:10px;line-height:1.6">星战前夜 网页致敬版 · 灵感来自 CCP Games 的 EVE Online。<br>本作品为粉丝习作，与 CCP Games 无关。</div>
    </div>`;
    return w;
  },
  help(){
    const w = UI.mkWin("help", "帮助 — 飞行员手册", { x: 280, y: 70, w: 480, h: 480 });
    w.body.innerHTML = `<div style="padding:10px;line-height:1.8;font-size:12px">
      <b class="hl">■ 基本操作</b><br>
      · <b>双击太空</b>：朝该方向飞行 · <b>滚轮</b>：缩放视野<br>
      · <b>左键</b>：选择目标 · <b>右键</b>：打开操作菜单（太空/物体均可）<br>
      · <b>Ctrl+左键 / 总览Ctrl点击</b>：锁定目标<br>
      · <b>F1–F8</b>：启动/关闭对应装备 · <b>S</b>：停船<br>
      · <b>A</b> 接近 / <b>W</b> 环绕 / <b>E</b> 保持距离 / <b>R</b> 跃迁 / <b>D</b> 停靠·跳跃（对选定目标）<br>
      · <b>F10</b>：星图<br><br>
      <b class="hl">■ 新手之路</b><br>
      1. 在空间站购买/装配<b>采矿器</b>，出站后右键太空 → 小行星带 → 跃迁。<br>
      2. 锁定小行星（Ctrl+点击总览），启动采矿器（F键），矿石装满后返回空间站。<br>
      3. 在市场<b>出售矿石</b>，或先在<b>精炼厂</b>精炼成矿物再卖。<br>
      4. 找<b>代理人</b>接任务：作战 / 采矿 / 运输，报酬丰厚。<br>
      5. 攒钱买新船（冒险级采矿效率翻倍；护卫舰适合战斗），购买<b>技能书</b>并训练技能。<br><br>
      <b class="hl">■ 战斗</b><br>
      · 锁定敌人后启动武器。炮塔受<b>追踪速度/径向速度/优化射程</b>影响，导弹永远命中但受爆炸半径影响。<br>
      · 小口径炮打小目标，大口径炮打大目标。近轨快速环绕战列舰可以躲开它的巨炮。<br>
      · 护盾会自动回充，装甲和结构需要维修器或回站维修。<br>
      · 船毁后进入太空舱：保险会赔付部分损失，停靠后可获得免费新手船。<br><br>
      <b class="hl">■ 宇宙</b><br>
      · 安全等级越低的星系（黄色→红色），海盗越强、矿石越贵、赏金越高。<br>
      · <b>吉他 (Jita)</b> 是贸易中心；<b>塔玛 (Tama)</b> 以南为低安，<b>PF-346</b> 为 0.0 无法地带。<br>
      · 星图（F10）中点击星系设置目的地，然后开启自动导航。<br><br>
      <span class="dim">「飞得安全。」 o7</span>
    </div>`;
    return w;
  },
};

window.Panels = Panels;
