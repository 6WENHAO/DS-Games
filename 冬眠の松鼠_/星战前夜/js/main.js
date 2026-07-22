"use strict";
(function(){
  let last = 0, uiAcc = 0, saveAcc = 0, started = false;

  function boot(){
    Render.init(document.getElementById("space"));
    buildLogin();
  }

  function buildLogin(){
    const login = document.getElementById("login");
    login.classList.remove("hidden");
    const hasSave = G.hasSave();
    let selRace = "caldari";
    const cards = Object.entries(DATA.RACES).map(([id,r]) =>
      `<div class="racecard ${id===selRace?"sel":""}" data-race="${id}">
        <div class="remblem" style="background:${r.color}">${r.cn[0]}</div>
        <div class="rname">${r.cn}</div>
        <div class="dim" style="font-size:10px">${r.en}</div>
        <div class="rdesc">${r.desc}</div>
      </div>`).join("");
    login.innerHTML = `<div class="box">
      <h1>EVE <span>ONLINE</span></h1>
      <div class="sub">新伊甸 · 网页致敬版 — WEB TRIBUTE EDITION</div>
      ${hasSave ? `<div style="margin-bottom:24px"><span class="btn primary bigbtn" id="btnContinue">继 续 游 戏</span></div>
        <div class="dim" style="margin-bottom:18px">— 或者创建新的角色（将覆盖现有存档）—</div>` : ""}
      <div class="racegrid">${cards}</div>
      <div><input id="pilotName" maxlength="20" placeholder="输入飞行员姓名" value="${pick(DATA.NAMES)}"></div>
      <div class="startrow">
        <span class="btn sm" id="btnRandName">随机姓名</span>
        <span class="btn primary bigbtn" id="btnStart">进 入 新 伊 甸</span>
      </div></div>`;
    login.querySelectorAll(".racecard").forEach(c=>{
      c.onclick = ()=>{
        Sound.ensure(); Sound.play("click");
        selRace = c.dataset.race;
        login.querySelectorAll(".racecard").forEach(x=>x.classList.toggle("sel", x===c));
      };
    });
    login.querySelector("#btnRandName").onclick = ()=>{
      login.querySelector("#pilotName").value = pick(DATA.NAMES) + "·" + Math.floor(Math.random()*99);
    };
    if (hasSave) login.querySelector("#btnContinue").onclick = ()=>{
      Sound.ensure();
      if (G.load()) start(false);
      else UI.toast("存档损坏","bad");
    };
    login.querySelector("#btnStart").onclick = ()=>{
      Sound.ensure();
      const name = login.querySelector("#pilotName").value.trim() || "无名飞行员";
      G.newPilot(selRace, name);
      start(true);
    };
  }

  function start(isNew){
    document.getElementById("login").classList.add("hidden");
    UI.init();
    UI.updateSysinfo();
    if (G.state.loc.docked){
      document.getElementById("stationBg").classList.remove("hidden");
      document.getElementById("stationBgName").textContent = G.state.loc.docked;
      document.getElementById("hud").classList.add("hidden");
      document.getElementById("targets").classList.add("hidden");
      UI.closeWin("overview"); UI.closeWin("selected");
      Panels.station(); UI.openWin("station");
      UI.systemChanged();
    } else {
      UI.systemChanged();
    }
    bindInput();
    Bot.initUI();
    if (G.state.botOn) Bot.set(true);
    started = true;
    last = performance.now();
    requestAnimationFrame(frame);
    if (isNew){
      UI.aura(`欢迎来到新伊甸，${G.state.pilot.name}。我是 Aura，你的舰载人工智能。<br>你现在停靠在<b class="hl">吉他 4-4</b> 空间站。建议先打开右侧面板中的<b>装配管理</b>确认武器就位，然后<b>离站</b>开始你的旅程。按「助」查看飞行员手册。`);
      setTimeout(()=>{ Panels.help(); UI.openWin("help"); }, 800);
    }
  }

  function frame(t){
    const dt = Math.min(.1, (t-last)/1000);
    last = t;
    if (started && G.state){
      G.update(dt);
      Bot.update(dt);
      const docked = !!G.state.loc.docked;
      if (!docked && G.space){
        Render.draw(dt);
        UI.updateHUD();
      }
      uiAcc += dt;
      if (uiAcc >= .25){ UI.tick(uiAcc); uiAcc = 0; tutorials(); }
      saveAcc += dt;
      if (saveAcc >= 20){ saveAcc = 0; G.save(); }
    }
    requestAnimationFrame(frame);
  }

  function tutorials(){
    const tut = G.state.tut;
    if (!G.state.loc.docked && !tut.undock){
      tut.undock = 1;
      UI.aura(`你已进入太空。<b>双击太空</b>朝该方向飞行，<b>右键太空</b>打开导航菜单——试着跃迁到一处<b class="hl">小行星带</b>，用 Ctrl+点击总览锁定小行星，然后按 <b>F 键</b>启动采矿器。`);
    }
    if (G.me && G.me.locks.length && !tut.lock){
      tut.lock = 1;
      UI.aura(`目标锁定中。锁定完成后，点击屏幕上方的目标框选择<b>主目标</b>，再启动武器或采矿器（F1–F8 或点击圆形按钮）。`);
    }
    if (G.state.pilot.kills > 0 && !tut.kill){
      tut.kill = 1;
      UI.aura(`首个战果！赏金已入账。敌舰残骸可能包含战利品——接近残骸 2.5km 内<b>打开货柜</b>拾取，金属碎片和徽章都能在市场卖钱。`);
    }
    if ((G.state.ship.ore.length || G.state.ship.cargo.some(c=>DATA.ORES[c.id])) && !tut.ore){
      tut.ore = 1;
      UI.aura(`矿石入舱。装满后回空间站：可以直接在市场<b>出售矿石</b>，或先去<b>精炼厂</b>精炼成矿物（技能越高产出越多）。`);
    }
  }

  function modByFkey(n){
    for (const row of ["hi","mid","low"])
      for (let i=0;i<G.mods[row].length;i++){
        const m = G.mods[row][i];
        if (m && m.fkey === n) return [row,i];
      }
    return null;
  }

  function bindInput(){
    const cv = document.getElementById("space");

    cv.addEventListener("mousedown", (e)=>{
      if (!G.space || !G.me) return;
      if (e.button !== 0) return;
      const ent = Render.pick(e.clientX, e.clientY);
      if (ent){
        if (e.ctrlKey && ["npc","roid","wreck"].includes(ent.kind)){ G.tryLock(ent.id); return; }
        G.sel = ent.id;
      } else if (!e.ctrlKey) G.sel = null;
      UI.setSel(G.sel);
      UI.refreshOverview();
    });

    cv.addEventListener("dblclick", (e)=>{
      if (!G.space || !G.me) return;
      const ent = Render.pick(e.clientX, e.clientY);
      if (ent) UI.defaultAction(ent.id);
      else {
        const [wx,wy] = Render.s2w(e.clientX, e.clientY);
        G.cmdHeading(wx - G.me.x, wy - G.me.y);
        if (G.me) G.me.speedFrac = 1;
      }
    });

    cv.addEventListener("contextmenu", (e)=>{
      e.preventDefault();
      if (!G.space || !G.me) return;
      const ent = Render.pick(e.clientX, e.clientY);
      if (ent){ G.sel = ent.id; UI.setSel(G.sel); UI.ctx(UI.entMenu(ent), e.clientX, e.clientY); }
      else UI.spaceMenu(e.clientX, e.clientY);
    });

    window.addEventListener("wheel", (e)=>{
      if (e.target.closest(".window") || e.target.closest("#neocom")) return;
      Render.zoom = clamp(Render.zoom * Math.pow(1.3, -Math.sign(e.deltaY)), 2e-6, .6);
    }, { passive:true });

    window.addEventListener("keydown", (e)=>{
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const fk = /^F(\d+)$/.exec(e.key);
      if (fk){
        const n = +fk[1];
        if (n === 10){ e.preventDefault(); UI.toggleWin("map", ()=>Panels.map()); return; }
        if (n >= 1 && n <= 8 && G.mods && !G.state.loc.docked){
          e.preventDefault();
          const hit = modByFkey(n);
          if (hit) G.toggleMod(hit[0], hit[1]);
          return;
        }
      }
      if (!G.me || G.state.loc.docked) return;
      const k = e.key.toLowerCase();
      if (k === "s") G.cmdStop();
      if (G.sel){
        const ent = G.entById(G.sel);
        if (!ent) return;
        if (k === "a") G.cmdApproach(G.sel);
        if (k === "w") G.cmdOrbit(G.sel, 5000);
        if (k === "e") G.cmdKeep(G.sel, 10000);
        if (k === "r") G.cmdWarpEnt(G.sel, 0);
        if (k === "d"){
          if (ent.kind === "station") G.cmdDock(G.sel);
          else if (ent.kind === "gate") G.cmdJumpGate(G.sel);
        }
      }
    });

    window.addEventListener("beforeunload", ()=>G.save());
  }

  window.addEventListener("DOMContentLoaded", boot);
})();
