"use strict";
const UI = {
  win: {}, zTop: 10,
  ovTab: "常规", ovSort: "dist",
  chatTab: "本地",
  localMsgs: [], combatMsgs: [], localNames: [],
  auraTimer: null, spamT: 0,

  init(){
    this.buildNeocom();
    this.buildHUD();
    this.buildOverview();
    this.buildSelected();
    this.buildChat();
    this.updateNeocom();
    this.updateRoute();
    document.addEventListener("mousedown", (ev)=>{
      if (!ev.target.closest("#ctxmenu") && !ev.target.closest(".submenu")) this.closeCtx();
    });
  },

  /* ---------- windows ---------- */
  mkWin(id, title, opts){
    if (this.win[id]) return this.win[id];
    opts = opts || {};
    const el = document.createElement("div");
    el.className = "window hidden";
    el.style.left = (opts.x ?? 120) + "px";
    el.style.top = (opts.y ?? 90) + "px";
    el.style.width = (opts.w ?? 420) + "px";
    if (opts.h) el.style.height = opts.h + "px";
    el.innerHTML = `<div class="win-title"><span>${title}</span><span class="win-x">✕</span></div><div class="win-body"></div>`;
    document.getElementById("windows").appendChild(el);
    const tbar = el.querySelector(".win-title");
    tbar.querySelector(".win-x").onclick = (e)=>{ e.stopPropagation(); this.closeWin(id); };
    let drag = null;
    tbar.addEventListener("mousedown", (e)=>{
      if (e.target.classList.contains("win-x")) return;
      drag = { dx: e.clientX - el.offsetLeft, dy: e.clientY - el.offsetTop };
      const move = (e2)=>{ if (drag){ el.style.left = clamp(e2.clientX-drag.dx, 0, window.innerWidth-80)+"px"; el.style.top = clamp(e2.clientY-drag.dy, 0, window.innerHeight-40)+"px"; } };
      const up = ()=>{ drag = null; document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
    el.addEventListener("mousedown", ()=>{ el.style.zIndex = ++this.zTop; });
    const w = { el, body: el.querySelector(".win-body"), title: tbar.querySelector("span") };
    this.win[id] = w;
    return w;
  },
  openWin(id){ if (this.win[id]){ this.win[id].el.classList.remove("hidden"); this.win[id].el.style.zIndex = ++this.zTop; } },
  closeWin(id){ if (this.win[id]) this.win[id].el.classList.add("hidden"); },
  isOpen(id){ return this.win[id] && !this.win[id].el.classList.contains("hidden"); },
  toggleWin(id, builder){
    if (this.isOpen(id)) this.closeWin(id);
    else { if (builder) builder(); this.openWin(id); }
  },

  /* ---------- neocom ---------- */
  buildNeocom(){
    const nc = document.getElementById("neocom");
    const race = G.state.pilot.race;
    nc.innerHTML = `<div class="portrait" style="background:${DATA.RACES[race].color}" title="${G.state.pilot.name}">${G.state.pilot.name[0]}</div>`;
    const items = [
      ["角","角色表", ()=>this.toggleWin("char", ()=>Panels.charSheet())],
      ["货","货柜舱", ()=>this.toggleWin("cargo", ()=>Panels.cargo())],
      ["配","装配管理", ()=>this.toggleWin("fitting", ()=>Panels.fitting())],
      ["市","地区市场", ()=>{ if (!G.state.loc.docked) return this.toast("需要停靠在空间站才能访问市场","warn"); this.toggleWin("market", ()=>Panels.market()); }],
      ["图","星图 (F10)", ()=>this.toggleWin("map", ()=>Panels.map())],
      ["任","任务日志", ()=>this.toggleWin("missions", ()=>Panels.missions())],
      ["钱","钱包", ()=>this.toggleWin("wallet", ()=>Panels.wallet())],
      ["助","帮助", ()=>this.toggleWin("help", ()=>Panels.help())],
      ["设","设置", ()=>this.toggleWin("settings", ()=>Panels.settings())],
    ];
    for (const [g, tip, fn] of items){
      const b = document.createElement("div");
      b.className = "ncbtn"; b.textContent = g; b.title = tip;
      b.onclick = ()=>{ Sound.play("click"); fn(); };
      nc.appendChild(b);
    }
    const isk = document.createElement("div");
    isk.className = "isk"; isk.id = "neocomIsk";
    nc.appendChild(isk);
    nc.querySelector(".portrait").onclick = ()=>this.toggleWin("char", ()=>Panels.charSheet());
  },
  updateNeocom(){
    const el = document.getElementById("neocomIsk");
    if (el) el.textContent = fmtISK(G.state.pilot.isk);
  },

  /* ---------- sysinfo / route ---------- */
  secColor(sec){
    if (sec >= .9) return "#4fc3f7"; if (sec >= .8) return "#4dd0a1"; if (sec >= .7) return "#74d24d";
    if (sec >= .6) return "#b9d24d"; if (sec >= .5) return "#f2d24b"; if (sec >= .4) return "#f2a53b";
    if (sec >= .3) return "#f27f3b"; if (sec >= .1) return "#e05c4b"; return "#c04868";
  },
  updateSysinfo(){
    const sd = DATA.SYSTEMS[G.state.loc.system];
    const el = document.getElementById("sysinfo");
    el.innerHTML = `<div class="sysname">${sd.cn} <span style="color:${this.secColor(sd.sec)}">${sd.sec.toFixed(1)}</span></div>
      <div class="sysdetail">${sd.region} · ${sd.en}${G.state.loc.docked ? "<br>已停靠：" + G.state.loc.docked : ""}</div>`;
  },
  updateRoute(){
    const el = document.getElementById("routebar");
    const r = G.state.route;
    if (!r.length){ el.innerHTML = ""; return; }
    let html = "";
    for (const s of r){
      const sd = DATA.SYSTEMS[s];
      html += `<div class="rdot" style="background:${this.secColor(sd.sec)}" title="${sd.cn} (${sd.sec.toFixed(1)})"></div>`;
    }
    html += `<span class="dim" style="margin-left:6px">${DATA.SYSTEMS[G.state.dest].cn} · ${r.length} 跳</span>
      <span class="btn sm ap ${G.state.autopilot?"primary":""}" onclick="G.toggleAutopilot()">${G.state.autopilot?"关闭自动导航":"自动导航"}</span>`;
    el.innerHTML = html;
  },

  /* ---------- HUD ---------- */
  buildHUD(){
    const hud = document.getElementById("hud");
    hud.innerHTML = `<div id="modRows"></div>
      <div id="gaugeWrap"><canvas id="hudGauge" width="290" height="120"></canvas>
      <div id="hudBtns">
        <div class="hudCtl" title="停船 (S)" onclick="G.cmdStop()">■</div>
        <div class="hudCtl" title="最大速度" onclick="G.me&&(G.me.speedFrac=1)">▶</div>
      </div></div>`;
    this.rebuildModRows();
  },
  rebuildModRows(){
    const wrap = document.getElementById("modRows");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!G.mods) return;
    let key = 1;
    for (const row of ["hi","mid","low"]){
      const mods = G.mods[row];
      if (!mods.some(m=>m)) continue;
      const rd = document.createElement("div");
      rd.className = "modrow";
      mods.forEach((m, i)=>{
        if (!m) return;
        const md = DATA.MODULES[m.tid];
        const b = document.createElement("div");
        const passive = md.type === "passive";
        b.className = "modbtn" + (passive ? " passive" : "");
        b.title = md.cn + (md.desc||"");
        b.dataset.row = row; b.dataset.i = i;
        b.innerHTML = `<span>${this.modGlyph(md)}</span><span class="cool"></span>` +
          (passive ? "" : `<span class="key">F${key}</span>`);
        if (!passive){
          m.fkey = key; key = Math.min(12, key+1);
          b.onclick = ()=>G.toggleMod(row, i);
        }
        rd.appendChild(b);
        m.btn = b;
      });
      wrap.appendChild(rd);
    }
  },
  modGlyph(md){
    switch(md.type){
      case "turret": return md.wg === "laser" ? "☀" : (md.wg === "proj" ? "⁂" : "≡");
      case "launcher": return "➤";
      case "miner": return "⛏";
      case "prop": return "♨";
      case "shieldBoost": return "◍";
      case "armorRep": return "✚";
      case "web": return "❖";
      default: return "▣";
    }
  },
  updateHUD(){
    if (!G.me || !G.mods) return;
    for (const row of ["hi","mid","low"]){
      for (const m of G.mods[row]){
        if (!m || !m.btn) continue;
        m.btn.classList.toggle("on", m.on);
        const cool = m.btn.querySelector(".cool");
        if (m.on && m.cycle > 0 && m.ct > 0){
          const p = (1 - m.ct/m.cycle) * 360;
          cool.style.background = `conic-gradient(rgba(127,208,160,.0) 0deg ${p}deg, rgba(20,40,30,.55) ${p}deg 360deg)`;
        } else cool.style.background = "none";
      }
    }
    this.drawGauge();
  },
  drawGauge(){
    const cv = document.getElementById("hudGauge");
    if (!cv) return;
    const cx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    cx.clearRect(0,0,W,H);
    const S = G.state.ship, st = G.st;
    const cxm = W/2, cym = H-12;
    const arc = (r, from, to, color, lw)=>{
      cx.strokeStyle = color; cx.lineWidth = lw||5;
      cx.beginPath(); cx.arc(cxm, cym, r, from, to); cx.stroke();
    };
    const layers = [
      [S.sh/Math.max(1,st.shieldMax), "#58a6c8", 52],
      [S.ar/Math.max(1,st.armorMax), "#c8a45a", 45],
      [S.hu/Math.max(1,st.hullMax), "#c86a5a", 38],
    ];
    for (const [p, col, r] of layers){
      arc(r, Math.PI, Math.PI*1.5, "rgba(60,75,88,.5)");
      if (p > 0) arc(r, Math.PI*1.5 - Math.PI*.5*clamp(p,0,1), Math.PI*1.5, col);
    }
    const capP = S.cap/Math.max(1,st.capMax);
    const segs = 18;
    for (let i=0;i<segs;i++){
      const a0 = Math.PI*1.5 + (Math.PI*.5) * i/segs + .015;
      const a1 = Math.PI*1.5 + (Math.PI*.5) * (i+1)/segs - .015;
      arc(48, a0, a1, i/segs < capP ? "#e8d590" : "rgba(70,65,45,.55)", 9);
    }
    cx.fillStyle = "#dfeaf2"; cx.font = "16px Segoe UI"; cx.textAlign = "center";
    const v = G.me ? hypot(G.me.vx,G.me.vy) : 0;
    cx.fillText(fmtNum(v), cxm, cym - 8);
    cx.fillStyle = "#5d7280"; cx.font = "9px Segoe UI";
    cx.fillText("m/s / " + fmtNum(G.getMaxSpeed()), cxm, cym + 3);
    cx.fillText("护盾 " + Math.round(layers[0][0]*100) + "%  装甲 " + Math.round(layers[1][0]*100) + "%  结构 " + Math.round(layers[2][0]*100) + "%", cxm, H-1);
    cx.fillStyle = "#b8a95e"; cx.font = "9px Segoe UI"; cx.textAlign = "right";
    cx.fillText("电容 " + Math.round(capP*100) + "%", W-4, cym-24);
  },

  /* ---------- overview ---------- */
  buildOverview(){
    const w = this.mkWin("overview", "总览", { x: window.innerWidth-330, y: 46, w: 320, h: Math.min(520, window.innerHeight-260) });
    w.el.querySelector(".win-x").remove();
    w.body.innerHTML = `<div class="tabs" id="ovTabs"></div><div id="ovList" style="height:calc(100% - 25px);overflow-y:auto"></div>`;
    const tabs = w.body.querySelector("#ovTabs");
    for (const t of ["常规","采矿","全部"]){
      const b = document.createElement("div");
      b.className = "tab" + (t===this.ovTab ? " on" : "");
      b.textContent = t;
      b.onclick = ()=>{ this.ovTab = t; tabs.querySelectorAll(".tab").forEach(x=>x.classList.remove("on")); b.classList.add("on"); this.refreshOverview(); };
      tabs.appendChild(b);
    }
    this.openWin("overview");
  },
  ovFilter(e){
    if (this.ovTab === "常规") return ["npc","station","gate","beacon","wreck","belt"].includes(e.kind);
    if (this.ovTab === "采矿") return ["roid","belt","station"].includes(e.kind);
    return e.kind !== "sun" || true;
  },
  ovClass(e){
    return { npc:"ov-npc", roid:"ov-roid", wreck:"ov-wreck", station:"ov-station", gate:"ov-cel", beacon:"ov-beacon" }[e.kind] || "ov-cel";
  },
  refreshOverview(){
    const list = document.getElementById("ovList");
    if (!list) return;
    if (!G.space || !G.me){ list.innerHTML = ""; return; }
    const ents = G.space.ents.filter(e=>this.ovFilter(e))
      .map(e=>({ e, d: G.distTo(e) }))
      .sort((a,b)=>a.d-b.d)
      .slice(0, 80);
    let html = `<table class="tbl"><tr><th style="width:78px">距离</th><th>名称</th><th>类型</th></tr>`;
    for (const {e,d} of ents){
      html += `<tr class="row ${G.sel===e.id?"selrow":""}" data-id="${e.id}">
        <td>${fmtDist(d)}</td><td class="${this.ovClass(e)}">${e.name}</td><td class="dim">${e.type}</td></tr>`;
    }
    html += "</table>";
    const sc = list.scrollTop;
    list.innerHTML = html;
    list.scrollTop = sc;
    list.querySelectorAll("tr.row").forEach(tr=>{
      const id = +tr.dataset.id;
      tr.onclick = (ev)=>{
        if (ev.ctrlKey){ G.tryLock(id); return; }
        G.sel = id; this.setSel(id); this.refreshOverview();
      };
      tr.ondblclick = ()=>this.defaultAction(id);
      tr.oncontextmenu = (ev)=>{ ev.preventDefault(); G.sel = id; this.setSel(id); this.ctx(this.entMenu(G.entById(id)), ev.clientX, ev.clientY); };
    });
  },
  defaultAction(id){
    const e = G.entById(id); if (!e) return;
    if (e.kind === "station") return G.cmdDock(id);
    if (e.kind === "gate") return G.cmdJumpGate(id);
    if (e.kind === "wreck") return G.cmdOpenWreck(id);
    if (["belt","planet","beacon"].includes(e.kind) && G.distTo(e) > 150000) return G.cmdWarpEnt(id, 0);
    G.cmdApproach(id);
  },

  /* ---------- selected item ---------- */
  buildSelected(){
    const w = this.mkWin("selected", "选定目标", { x: window.innerWidth-330, y: window.innerHeight-192, w: 320, h: 140 });
    w.el.querySelector(".win-x").remove();
    this.openWin("selected");
    this.setSel(null);
  },
  setSel(id){
    const w = this.win.selected;
    if (!w) return;
    const e = id ? G.entById(id) : null;
    if (!e){ w.body.innerHTML = `<div class="dim" style="padding:14px;text-align:center">未选定目标</div>`; return; }
    const acts = [];
    const A = (label, fn, title)=>acts.push(`<span class="btn sm" title="${title||label}" onclick="${fn}">${label}</span>`);
    A("接近", `G.cmdApproach(${e.id})`);
    A("环绕", `G.cmdOrbit(${e.id},5000)`);
    A("保持距离", `G.cmdKeep(${e.id},10000)`);
    A("跃迁", `G.cmdWarpEnt(${e.id},0)`);
    if (["npc","roid","wreck"].includes(e.kind)) A("锁定", `G.tryLock(${e.id})`);
    if (e.kind === "station") A("停靠", `G.cmdDock(${e.id})`);
    if (e.kind === "gate") A("跳跃", `G.cmdJumpGate(${e.id})`);
    if (e.kind === "wreck") A("打开", `G.cmdOpenWreck(${e.id})`);
    let extra = "";
    if (e.kind === "npc"){
      const bar = (v,m,c)=>`<div class="bar" style="height:4px;background:#1a262f;margin-top:2px"><i style="width:${clamp(v/m*100,0,100)}%;background:${c}"></i></div>`;
      const nd = DATA.NPCS[e.npc];
      extra = bar(e.sh,nd.shield,"#58a6c8") + bar(e.ar,nd.armor,"#c8a45a") + bar(e.hu,nd.hull,"#c86a5a");
    }
    if (e.kind === "roid") extra = `<div class="dim">储量：${fmtNum(e.units)} 单位（${fmtNum(e.units*DATA.ORES[e.ore].vol)} m³）</div>`;
    w.body.innerHTML = `<div style="padding:6px 8px">
      <div style="display:flex;justify-content:space-between"><b class="${this.ovClass(e)}">${e.name}</b><span class="dim" id="selDist">${fmtDist(G.distTo(e))}</span></div>
      <div class="dim">${e.type}</div>${extra}
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${acts.join("")}</div></div>`;
  },

  /* ---------- targets ---------- */
  updateTargets(){
    const wrap = document.getElementById("targets");
    if (!wrap || !G.me){ if (wrap) wrap.innerHTML = ""; return; }
    let html = "";
    for (const l of G.me.locks){
      const e = G.entById(l.id);
      if (!e) continue;
      let bars = "";
      if (e.kind === "npc"){
        const nd = DATA.NPCS[e.npc];
        bars = `<div class="bar"><i style="width:${clamp(e.sh/nd.shield*100,0,100)}%;background:#58a6c8"></i></div>
          <div class="bar"><i style="width:${clamp(e.ar/nd.armor*100,0,100)}%;background:#c8a45a"></i></div>
          <div class="bar"><i style="width:${clamp(e.hu/nd.hull*100,0,100)}%;background:#c86a5a"></i></div>`;
      }
      const locking = !l.done;
      html += `<div class="tgt ${G.me.activeTarget===l.id?"active":""} ${locking?"locking":""}" data-id="${l.id}">
        <div class="tname">${e.name}</div>
        <div class="tdist">${locking ? "锁定中 " + Math.round(l.t/l.need*100) + "%" : fmtDist(G.distTo(e))}</div>
        ${bars}<span class="tx" data-x="${l.id}">✕</span></div>`;
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll(".tgt").forEach(t=>{
      t.onclick = (ev)=>{
        if (ev.target.classList.contains("tx")) return;
        const id = +t.dataset.id;
        const l = G.lockOf(id);
        if (l && l.done){ G.me.activeTarget = id; this.updateTargets(); }
      };
    });
    wrap.querySelectorAll(".tx").forEach(x=>{ x.onclick = ()=>G.unlock(+x.dataset.x); });
  },

  /* ---------- chat ---------- */
  buildChat(){
    const w = this.mkWin("chat", "频道", { x: 52, y: window.innerHeight-236, w: 380, h: 200 });
    w.el.querySelector(".win-x").remove();
    w.body.innerHTML = `<div class="tabs" id="chatTabs"></div>
      <div id="chatBody" class="chatlog" style="height:calc(100% - 52px)"></div>
      <input id="chatInput" style="width:100%;background:#0c1318;border:none;border-top:1px solid #22313c;color:#c9d4da;padding:4px 8px;outline:none;font-family:inherit" placeholder="说点什么…">`;
    const tabs = w.body.querySelector("#chatTabs");
    for (const t of ["本地","战斗记录"]){
      const b = document.createElement("div");
      b.className = "tab" + (t===this.chatTab?" on":"");
      b.textContent = t; b.dataset.t = t;
      b.onclick = ()=>{ this.chatTab = t; tabs.querySelectorAll(".tab").forEach(x=>x.classList.remove("on")); b.classList.add("on"); this.renderChat(); };
      tabs.appendChild(b);
    }
    w.body.querySelector("#chatInput").addEventListener("keydown",(e)=>{
      if (e.key === "Enter" && e.target.value.trim()){
        this.chat(G.state.pilot.name, e.target.value.trim(), true);
        e.target.value = "";
      }
      e.stopPropagation();
    });
    this.openWin("chat");
  },
  ts(){ const d = new Date(); return `[${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}]`; },
  chat(who, msg, self){
    this.localMsgs.push(`<div><span class="t">${this.ts()}</span><span class="who" ${self?'style="color:#e0b95e"':""}>${who} &gt;</span>${msg}</div>`);
    if (this.localMsgs.length > 120) this.localMsgs.shift();
    if (this.chatTab === "本地") this.renderChat();
  },
  combat(msg, cls){
    this.combatMsgs.push(`<div class="${cls||""}"><span class="t">${this.ts()}</span>${msg}</div>`);
    if (this.combatMsgs.length > 150) this.combatMsgs.shift();
    if (this.chatTab === "战斗记录") this.renderChat();
  },
  renderChat(){
    const el = document.getElementById("chatBody");
    if (!el) return;
    el.innerHTML = (this.chatTab === "本地" ? this.localMsgs : this.combatMsgs).join("");
    el.scrollTop = el.scrollHeight;
  },
  systemChanged(){
    const sysId = G.state.loc.system;
    const sd = DATA.SYSTEMS[sysId];
    const rng = mulberry(strSeed(sysId) ^ 77);
    let n;
    if (sysId === "jita") n = 900 + Math.floor(rng()*300);
    else if (sd.sec >= .8) n = 40 + Math.floor(rng()*200);
    else if (sd.sec >= .5) n = 20 + Math.floor(rng()*80);
    else if (sd.sec > 0) n = 5 + Math.floor(rng()*30);
    else n = 1 + Math.floor(rng()*8);
    this.localCount = n;
    this.localNames = [];
    for (let i=0;i<Math.min(n,10);i++) this.localNames.push(pick(DATA.NAMES));
    const w = this.win.chat;
    if (w) w.title.textContent = `本地 [${sd.cn}] — ${n+1} 名舰长`;
    if (this.lastChatSys !== sysId){
      this.lastChatSys = sysId;
      this.localMsgs.push(`<div class="combat-info"><span class="t">${this.ts()}</span>— 已连接至 ${sd.cn} 本地频道（${n+1} 人）—</div>`);
    }
    this.renderChat();
    this.updateSysinfo();
    this.updateRoute();
    this.refreshOverview();
    this.rebuildModRows();
    this.setSel(null);
  },
  chatSim(dt){
    this.spamT -= dt;
    if (this.spamT > 0) return;
    const sysId = G.state.loc.system;
    const sd = DATA.SYSTEMS[sysId];
    if (sysId === "jita"){
      this.spamT = 8 + Math.random()*16;
      this.chat(pick(DATA.NAMES), pick(DATA.JITA_SPAM));
    } else if (sd.sec < .5){
      this.spamT = 40 + Math.random()*80;
      if (Math.random() < .7) this.chat(pick(DATA.NAMES), pick(DATA.SMACK));
    } else {
      this.spamT = 30 + Math.random()*60;
      if (Math.random() < .35) this.chat(pick(DATA.NAMES), pick(DATA.SMACK.concat(["有人收矿吗","顺路带货","刚从吉他回来，堵得很"])));
    }
  },

  /* ---------- toasts / aura ---------- */
  toast(msg, cls){
    const box = document.getElementById("toasts");
    const t = document.createElement("div");
    t.className = "toast " + (cls||"");
    t.innerHTML = msg;
    box.appendChild(t);
    setTimeout(()=>{ t.style.opacity = "0"; t.style.transition = "opacity .5s"; }, 2600);
    setTimeout(()=>t.remove(), 3200);
    while (box.children.length > 5) box.firstChild.remove();
  },
  aura(html){
    const el = document.getElementById("auraBox");
    el.innerHTML = html;
    el.classList.remove("hidden");
    clearTimeout(this.auraTimer);
    this.auraTimer = setTimeout(()=>el.classList.add("hidden"), 14000);
  },

  /* ---------- context menu ---------- */
  ctx(items, x, y){
    this.closeCtx();
    const m = document.getElementById("ctxmenu");
    m.innerHTML = "";
    m.classList.remove("hidden");
    this.fillMenu(m, items);
    m.style.left = Math.min(x, window.innerWidth - m.offsetWidth - 8) + "px";
    m.style.top = Math.min(y, window.innerHeight - m.offsetHeight - 8) + "px";
  },
  fillMenu(el, items){
    for (const it of items){
      if (it.hdr){
        const h = document.createElement("div"); h.className = "chdr"; h.textContent = it.hdr;
        el.appendChild(h); continue;
      }
      const d = document.createElement("div");
      d.className = "ci";
      d.innerHTML = `<span>${it.label}</span>` + (it.sub ? "<span>▸</span>" : "");
      if (it.sub){
        d.onmouseenter = ()=>{
          document.querySelectorAll(".submenu").forEach(s=>s.remove());
          const sm = document.createElement("div");
          sm.className = "submenu";
          this.fillMenu(sm, it.sub);
          document.body.appendChild(sm);
          const r = d.getBoundingClientRect();
          sm.style.left = Math.min(r.right, window.innerWidth - 180) + "px";
          sm.style.top = Math.min(r.top, window.innerHeight - sm.offsetHeight - 8) + "px";
        };
      } else {
        d.onmouseenter = ()=>{ document.querySelectorAll(".submenu").forEach(s=>s.remove()); };
        d.onclick = ()=>{ this.closeCtx(); Sound.play("click"); it.fn && it.fn(); };
      }
      el.appendChild(d);
    }
  },
  closeCtx(){
    document.getElementById("ctxmenu").classList.add("hidden");
    document.querySelectorAll(".submenu").forEach(s=>s.remove());
  },
  warpSub(e){
    return [
      { label:"跃迁至 0 km", fn:()=>G.cmdWarpEnt(e.id, 0) },
      { label:"跃迁至 10 km", fn:()=>G.cmdWarpEnt(e.id, 10000) },
      { label:"跃迁至 50 km", fn:()=>G.cmdWarpEnt(e.id, 50000) },
      { label:"跃迁至 100 km", fn:()=>G.cmdWarpEnt(e.id, 100000) },
    ];
  },
  entMenu(e){
    if (!e) return [];
    const items = [{ hdr: e.name }];
    if (e.kind === "station") items.push({ label:"停靠", fn:()=>G.cmdDock(e.id) });
    if (e.kind === "gate") items.push({ label:"跳跃", fn:()=>G.cmdJumpGate(e.id) });
    if (e.kind === "wreck") items.push({ label:"打开货柜", fn:()=>G.cmdOpenWreck(e.id) });
    if (["npc","roid","wreck"].includes(e.kind)) items.push({ label:"锁定目标 (Ctrl+点击)", fn:()=>G.tryLock(e.id) });
    items.push({ label:"接近", fn:()=>G.cmdApproach(e.id) });
    items.push({ label:"环绕", sub:[
      { label:"500 m", fn:()=>G.cmdOrbit(e.id,500) },
      { label:"1 km", fn:()=>G.cmdOrbit(e.id,1000) },
      { label:"5 km", fn:()=>G.cmdOrbit(e.id,5000) },
      { label:"10 km", fn:()=>G.cmdOrbit(e.id,10000) },
      { label:"20 km", fn:()=>G.cmdOrbit(e.id,20000) },
    ]});
    items.push({ label:"保持距离", sub:[
      { label:"5 km", fn:()=>G.cmdKeep(e.id,5000) },
      { label:"10 km", fn:()=>G.cmdKeep(e.id,10000) },
      { label:"20 km", fn:()=>G.cmdKeep(e.id,20000) },
    ]});
    items.push({ label:"跃迁至", sub: this.warpSub(e) });
    return items;
  },
  spaceMenu(x, y){
    const groups = [
      ["空间站","station"], ["星门","gate"], ["小行星带","belt"], ["信标","beacon"], ["行星","planet"],
    ];
    const items = [{ hdr: DATA.SYSTEMS[G.state.loc.system].cn + " 恒星系" }];
    for (const [label, kind] of groups){
      const ents = G.space.ents.filter(e=>e.kind===kind);
      if (!ents.length) continue;
      items.push({ label, sub: ents.slice(0,12).map(e=>({
        label: e.name, sub: [
          ...(kind==="station" ? [{ label:"停靠", fn:()=>G.cmdDock(e.id) }] : []),
          ...(kind==="gate" ? [{ label:"跳跃", fn:()=>G.cmdJumpGate(e.id) }] : []),
          ...this.warpSub(e),
        ]
      })) });
    }
    items.push({ label:"停船", fn:()=>G.cmdStop() });
    this.ctx(items, x, y);
  },

  /* ---------- session / dock ---------- */
  sessionChange(text, fn){
    const ov = document.getElementById("overlay");
    document.getElementById("overlayText").textContent = text;
    ov.classList.remove("hidden");
    ov.style.opacity = "1";
    setTimeout(()=>{ fn && fn(); }, 450);
    setTimeout(()=>{ ov.style.opacity = "0"; }, 900);
    setTimeout(()=>{ ov.classList.add("hidden"); }, 1300);
  },
  enterDock(){
    this.sessionChange("停靠请求已接受…", ()=>{
      document.getElementById("stationBg").classList.remove("hidden");
      document.getElementById("stationBgName").textContent = G.state.loc.docked;
      document.getElementById("hud").classList.add("hidden");
      document.getElementById("targets").classList.add("hidden");
      this.closeWin("overview"); this.closeWin("selected"); this.closeWin("loot");
      this.updateSysinfo();
      Panels.station();
      this.openWin("station");
      if (!G.state.tut.dock){
        G.state.tut.dock = 1;
        this.aura("欢迎来到空间站。在这里你可以<b>维修</b>舰船、访问<b>市场</b>、管理<b>装配</b>与<b>机库</b>，或接受<b>代理人任务</b>赚取 ISK。");
      }
    });
  },
  exitDock(){
    this.sessionChange("正在离站…", ()=>{
      document.getElementById("stationBg").classList.add("hidden");
      document.getElementById("hud").classList.remove("hidden");
      document.getElementById("targets").classList.remove("hidden");
      ["station","market","hangar","fitting","missions","loot","refine"].forEach(id=>this.closeWin(id));
      this.openWin("overview"); this.openWin("selected");
      this.systemChanged();
    });
  },

  /* ---------- periodic ---------- */
  tick(dt){
    this.chatSim(dt);
    if (!G.state.loc.docked && G.space){
      this.refreshOverview();
      if (G.sel){
        const e = G.entById(G.sel);
        const el = document.getElementById("selDist");
        if (e && el) el.textContent = fmtDist(G.distTo(e));
        else if (!e) this.setSel(null);
      }
      this.updateTargets();
    }
    this.updateNeocom();
  },
};

window.UI = UI;
