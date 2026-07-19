import*as THREE from"three";
import{fmt,fmtDist,bearingOf,clamp}from"./util.js";
import{ITEMS}from"./blocks.js";

const $=id=>document.getElementById(id);

export const CONTROLS=[
  ["W A S D","移动 / 飞船推进与横滚"],
  ["鼠标","视角 / 飞船转向"],
  ["空格","跳跃 · 按住喷气背包 / 飞船加速"],
  ["SHIFT","疾跑"],
  ["左键","采矿光束 / 舰载武器"],
  ["右键","放置方块 (选中建造方块时)"],
  ["1 ~ 6","切换快捷栏"],
  ["E","交互 · 进入/离开飞船 (按住)"],
  ["C","环境扫描"],
  ["F","分析目镜 / 太空中按住＝脉冲飞行"],
  ["Q","消耗钠 为危险防护充能"],
  ["T","消耗氧/碳 为生命维持充能"],
  ["V","飞船视角切换"],
  ["TAB","物品栏 / 合成"],
  ["ESC","暂停"]
];

export class UI{
  constructor(game){
    this.g=game;
    this.markers=new Map();
    this.missionMarker=null;
    this.notices=[];
    this.pickupPool=new Map();
    this.compassBuilt=false;
    this.holdTarget=null;
    this.invOpen=false;
    this.activeTab="inv";
    this.buildCompass();
    this.bindStatic();
    this.toastT=0;
  }
  bindStatic(){
    $("inv-close").onclick=()=>this.g.closeInventory();
    document.querySelectorAll(".tabbtn").forEach(b=>{
      b.onclick=()=>{
        if(b.disabled)return;
        this.g.audio.uiMove();
        this.setTab(b.dataset.tab);
      };
    });
    $("btn-resume").onclick=()=>this.g.togglePause(false);
    $("btn-save").onclick=()=>{this.g.save();this.notify("系统","进度已保存","");this.g.audio.uiConfirm();};
    $("btn-quit").onclick=()=>{this.g.save();location.reload();};
    $("btn-respawn").onclick=()=>this.g.respawn();
    $("btn-howto").onclick=()=>{$("howto").classList.remove("hidden");this.g.audio.uiOpen();};
    $("btn-howto-close").onclick=()=>{$("howto").classList.add("hidden");this.g.audio.uiClose();};
    const ctrlHtml=CONTROLS.map(c=>`<div class="ctrl-row"><span>${c[1]}</span><span class="ck">${c[0]}</span></div>`).join("");
    $("controls-list").innerHTML=ctrlHtml;
    $("howto-list").innerHTML=ctrlHtml;
    const S=this.g.settings;
    const bind=(id,key,fn)=>{
      const el=$(id);
      const apply=()=>{
        S[key]=el.type==="checkbox"?el.checked:parseFloat(el.value);
        if(fn)fn(S[key]);
        this.g.saveSettings();
      };
      el.addEventListener("input",apply);
    };
    bind("set-vol","vol",v=>this.g.audio.setSfxVol(v/100));
    bind("set-music","music",v=>this.g.audio.setMusicVol(v/100));
    bind("set-sens","sensRaw",v=>{this.g.settings.sens=v/100;});
    bind("set-dist","dist",v=>this.g.applyViewDist(v));
    bind("set-bloom","bloom",v=>this.g.applyBloom(v));
    bind("set-voice","voice",v=>{this.g.audio.voiceOn=v;});
    bind("set-fps","fps",v=>$("fps-meter").classList.toggle("hidden",!v));
  }
  applySettingsToInputs(){
    const S=this.g.settings;
    $("set-vol").value=S.vol;
    $("set-music").value=S.music;
    $("set-sens").value=S.sensRaw;
    $("set-dist").value=S.dist;
    $("set-bloom").checked=S.bloom;
    $("set-voice").checked=S.voice;
    $("set-fps").checked=S.fps;
  }
  buildCompass(){
    const strip=$("compass-strip");
    strip.innerHTML="";
    this.compassEls=[];
    const cards=[[0,"N"],[90,"E"],[180,"S"],[270,"W"]];
    for(let b=0;b<360;b+=15){
      const isCard=b%90===0;
      const tick=document.createElement("div");
      tick.className="cmp-tick"+(isCard?" major":"");
      strip.appendChild(tick);
      this.compassEls.push({b,el:tick,type:"tick"});
      if(isCard){
        const lab=document.createElement("div");
        lab.className="cmp-lab card";
        lab.textContent=cards.find(c=>c[0]===b)[1];
        strip.appendChild(lab);
        this.compassEls.push({b,el:lab,type:"lab"});
      }else if(b%45===0){
        const lab=document.createElement("div");
        lab.className="cmp-lab";
        lab.textContent=b;
        strip.appendChild(lab);
        this.compassEls.push({b,el:lab,type:"lab"});
      }
    }
  }
  updateCompass(yawDeg,markerBearings){
    const w=$("compass").clientWidth;
    const ppd=w/120;
    for(const t of this.compassEls){
      let d=t.b-yawDeg;
      while(d>180)d-=360;
      while(d<-180)d+=360;
      if(Math.abs(d)>62){t.el.style.display="none";continue;}
      t.el.style.display="block";
      t.el.style.left=(w/2+d*ppd)+"px";
    }
    const strip=$("compass-strip");
    strip.querySelectorAll(".cmp-mark").forEach(e=>e.remove());
    for(const m of markerBearings){
      let d=m.bearing-yawDeg;
      while(d>180)d-=360;
      while(d<-180)d+=360;
      if(Math.abs(d)>62)d=clamp(d,-62,62);
      const el=document.createElement("div");
      el.className="cmp-mark";
      el.style.left=(w/2+d*ppd)+"px";
      el.style.color=m.color||"#ffa14f";
      el.textContent=m.icon||"◆";
      strip.appendChild(el);
    }
  }
  addMarker(m){
    if(this.markers.has(m.id)){
      this.markers.get(m.id).data=m;
      return;
    }
    const el=document.createElement("div");
    el.className="marker "+(m.kind||"");
    el.innerHTML=`<div class="mk-ico"><span>${m.icon||"◆"}</span></div><div class="mk-lab">${m.label||""}</div><div class="mk-dist"></div>`;
    $("markers").appendChild(el);
    this.markers.set(m.id,{data:m,el,age:0});
  }
  removeMarker(id){
    const m=this.markers.get(id);
    if(m){m.el.remove();this.markers.delete(id);}
  }
  clearMarkers(prefix){
    for(const[id]of[...this.markers]){
      if(!prefix||id.startsWith(prefix))this.removeMarker(id);
    }
  }
  setMissionMarker(mk){
    if(!mk){this.removeMarker("__mission");return;}
    this.addMarker({id:"__mission",kind:"mission",pos:mk.pos.clone?mk.pos.clone():new THREE.Vector3(mk.pos.x,mk.pos.y,mk.pos.z),icon:mk.icon,label:mk.label});
  }
  updateMarkers(dt,camera,playerPos){
    const bearings=[];
    const w=window.innerWidth,h=window.innerHeight;
    const v=new THREE.Vector3();
    for(const[id,m]of[...this.markers]){
      m.age+=dt;
      if(m.data.ttl&&m.age>m.data.ttl){this.removeMarker(id);continue;}
      const pos=m.data.pos;
      v.set(pos.x,pos.y,pos.z).project(camera);
      const behind=v.z>1;
      let x=(v.x*0.5+0.5)*w,y=(-v.y*0.5+0.5)*h;
      let edge=false;
      if(behind||x<40||x>w-40||y<40||y>h-40){
        edge=true;
        if(behind){x=w-x;y=h;}
        x=clamp(x,44,w-44);
        y=clamp(y,60,h-60);
      }
      m.el.classList.toggle("edge",edge);
      m.el.style.left=x+"px";
      m.el.style.top=y+"px";
      const dist=Math.hypot(pos.x-playerPos.x,pos.y-playerPos.y,pos.z-playerPos.z);
      m.el.querySelector(".mk-dist").textContent=m.data.unit==="u"?fmt(Math.floor(dist))+" u":fmtDist(dist);
      const dx=pos.x-playerPos.x,dz=pos.z-playerPos.z;
      bearings.push({bearing:bearingOf(dx,dz),icon:m.data.icon,color:m.data.kind==="mission"?"#ffa14f":"#7ce8e8"});
    }
    return bearings;
  }
  notify(title,text,cls=""){
    const el=document.createElement("div");
    el.className="notice "+cls;
    el.innerHTML=`<div class="n-title">${title}</div><div>${text}</div>`;
    $("notices").appendChild(el);
    this.g.audio.notify();
    setTimeout(()=>{el.classList.add("fade");setTimeout(()=>el.remove(),520);},4600);
    const all=$("notices").children;
    if(all.length>4)all[0].remove();
  }
  showPickup(itemId,n){
    const def=ITEMS[itemId];
    if(!def)return;
    const key=itemId;
    const exist=this.pickupPool.get(key);
    if(exist&&exist.el.isConnected){
      exist.n+=n;
      exist.el.querySelector(".pk-n").textContent="+"+exist.n;
      clearTimeout(exist.t);
      exist.t=setTimeout(()=>{exist.el.classList.add("fade");setTimeout(()=>exist.el.remove(),420);this.pickupPool.delete(key);},1800);
      return;
    }
    const el=document.createElement("div");
    el.className="pickup"+(def.cat==="制造组件"||def.cat==="稀有组件"?" special":"");
    const icon=this.g.icons[itemId];
    el.innerHTML=`${icon?`<img src="${icon}">`:""}<span class="pk-n">+${n}</span><span class="pk-l">${def.name}</span>`;
    $("pickups").appendChild(el);
    const rec={el,n,t:setTimeout(()=>{el.classList.add("fade");setTimeout(()=>el.remove(),420);this.pickupPool.delete(key);},1800)};
    this.pickupPool.set(key,rec);
    if($("pickups").children.length>6)$("pickups").children[0].remove();
  }
  setVitals(p){
    $("fill-shield").style.width=p.shield+"%";
    $("fill-life").style.width=p.life+"%";
    $("fill-health").style.width=p.health+"%";
    const setCls=(id,v)=>{
      const el=$(id);
      el.classList.toggle("low",v<35&&v>=15);
      el.classList.toggle("crit",v<15);
    };
    setCls("v-shield",p.shield);
    setCls("v-life",p.life);
    setCls("v-health",p.health);
    $("jetbar").classList.toggle("on",p.jetFuel<99.5);
    $("jetfill").style.height=p.jetFuel+"%";
    $("lowvin").style.opacity=p.health<40?(1-p.health/40)*0.9:0;
  }
  setUnits(n){
    $("units-val").textContent=fmt(n);
    $("units-inv").textContent=fmt(n);
    const el=$("units-hud");
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }
  setEnv(planetName,hazardIco,hazardTxt,hazardCls,timeTxt){
    $("env-planet-name").textContent=planetName;
    $("env-hazard-ico").textContent=hazardIco;
    $("env-hazard-txt").textContent=hazardTxt;
    $("env-hazard").className="env-cell "+hazardCls;
    $("env-time-txt").textContent=timeTxt;
  }
  setMineReticle(on,heat,overheat){
    const el=$("minereticle");
    el.classList.toggle("on",on||heat>0.02);
    el.classList.toggle("hot",heat>0.6&&!overheat);
    el.classList.toggle("overheat",overheat);
    $("heatarc").style.strokeDashoffset=163.4*(1-clamp(heat,0,1));
  }
  setInteract(text,progress=0,key="E"){
    const el=$("interact");
    if(!text){el.classList.remove("on");return;}
    el.classList.add("on");
    $("interact-text").textContent=text;
    $("interact-key").textContent=key;
    $("interact-arc").style.strokeDashoffset=125.6*(1-clamp(progress,0,1));
  }
  scanPulseFx(){
    const el=$("scanfx");
    el.classList.remove("go");
    void el.offsetWidth;
    el.classList.add("go");
  }
  setVisor(on){
    $("visor").classList.toggle("hidden",!on);
  }
  setVisorTarget(target,progress){
    const el=$("visor-target");
    if(!target){el.classList.add("hidden");return;}
    el.classList.remove("hidden");
    el.classList.toggle("done",!!target.scanned||progress>=1);
    $("vt-name").textContent=target.name;
    $("vt-sub").textContent=(target.scanned||progress>=1)?"已完成分析 · 数据已上传":"保持对准以分析 "+Math.floor(progress*100)+"%";
    $("visor-arc").style.strokeDashoffset=194.8*(1-clamp(progress,0,1));
  }
  setVisorReadout(planet,pos){
    $("visor-temp").textContent=`${planet.hazardLabel} ${planet.tempStr}`;
    $("visor-coord").textContent=`坐标 ${Math.floor(pos.x)} : ${Math.floor(pos.z)}`;
  }
  setMission(m){
    $("mission-title").textContent=m.title;
    $("mission-desc").textContent=m.desc;
    $("mission-prog").textContent=m.prog?m.prog():"";
    const el=$("mission");
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }
  updateMissionProg(str){
    $("mission-prog").textContent=str;
  }
  missionComplete(title){
    this.centerToast("任务完成",title);
  }
  centerToast(big,sub){
    const el=document.createElement("div");
    el.className="ctoast";
    el.innerHTML=`<div class="ct-big">${big}</div>${sub?`<div class="ct-sub">${sub}</div>`:""}`;
    $("toast-center").appendChild(el);
    setTimeout(()=>{el.classList.add("fade");setTimeout(()=>el.remove(),720);},2600);
  }
  setFlight(d){
    $("fh-speed").textContent=d.speed;
    document.querySelector("#fh-left .fh-unit").textContent=d.speedUnit||"u/s";
    if(d.alt==null){
      $("fh-right").style.opacity=0.25;
      $("fh-alt").textContent="—";
    }else{
      $("fh-right").style.opacity=1;
      $("fh-alt").textContent=d.alt;
    }
    $("fh-thr-fill").style.width=(d.thr*100)+"%";
    $("fh-pulse-fill").style.width=(clamp(d.pulseFill,0,1)*100)+"%";
    $("fh-pulse-txt").textContent=d.pulseTxt||"";
    $("fh-fuel-fill").style.width=(clamp(d.fuel,0,1)*100)+"%";
    const tg=$("fh-target");
    if(d.target){
      tg.classList.remove("hidden");
      $("fh-target-name").textContent=d.target.name;
      $("fh-target-dist").textContent=fmt(Math.max(0,Math.floor(d.target.dist)))+" u";
    }else tg.classList.add("hidden");
    const wn=$("fh-warn");
    if(d.warn){wn.classList.remove("hidden");wn.textContent=d.warn;}
    else wn.classList.add("hidden");
  }
  setMode(mode){
    const fly=mode==="ship";
    $("flighthud").classList.toggle("hidden",!fly);
    $("vitals").style.display=fly?"none":"flex";
    $("hotbar").style.display=fly?"none":"flex";
    $("crosshair").style.display=fly?"none":"block";
    $("jetbar").style.display=fly?"none":"block";
  }
  showHud(on){
    $("hud").classList.toggle("hidden",!on);
  }
  buildHotbar(){
    const hb=$("hotbar");
    hb.innerHTML="";
    this.hotbarEls=[];
    this.g.hotbar.forEach((slot,i)=>{
      const el=document.createElement("div");
      el.className="hb-slot";
      el.innerHTML=`<span class="hb-num">${i+1}</span><img><span class="hb-cnt"></span><span class="hb-name"></span>`;
      hb.appendChild(el);
      el.onclick=()=>this.g.selectHotbar(i);
      this.hotbarEls.push(el);
    });
    this.refreshHotbar();
  }
  refreshHotbar(){
    const g=this.g;
    g.hotbar.forEach((slot,i)=>{
      const el=this.hotbarEls[i];
      if(!el)return;
      const img=el.querySelector("img");
      const cnt=el.querySelector(".hb-cnt");
      const name=el.querySelector(".hb-name");
      el.classList.toggle("sel",g.hotbarSel===i);
      if(slot.type==="tool"){
        img.src=g.icons.multitool;
        img.style.display="block";
        cnt.textContent="";
        name.textContent="采矿光束";
        el.classList.remove("empty");
      }else{
        const c=g.inv.count(slot.id);
        img.src=g.icons[slot.id]||"";
        img.style.display="block";
        cnt.textContent=c>0?c:"";
        name.textContent=ITEMS[slot.id].name;
        el.classList.toggle("empty",c<=0);
      }
    });
  }
  openInventory(tab="inv"){
    this.invOpen=true;
    $("inv").classList.remove("hidden");
    this.setTab(tab);
    this.g.audio.uiOpen();
  }
  closeInventoryUI(){
    this.invOpen=false;
    $("inv").classList.add("hidden");
    this.g.audio.uiClose();
  }
  setTab(tab){
    this.activeTab=tab;
    document.querySelectorAll(".tabbtn").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
    document.querySelectorAll(".pane").forEach(p=>p.classList.remove("active"));
    $("pane-"+tab).classList.add("active");
    if(tab==="inv")this.renderInventory();
    if(tab==="craft")this.renderCraft();
    if(tab==="tech")this.renderTech();
    if(tab==="disc")this.renderDiscoveries();
    if(tab==="trade")this.renderTrade();
  }
  renderInventory(){
    const g=this.g;
    const grid=$("inv-grid");
    grid.innerHTML="";
    const entries=Object.entries(g.inv.items).filter(([,n])=>n>0);
    const totalSlots=32;
    entries.forEach(([id,n])=>{
      const def=ITEMS[id];
      const el=document.createElement("div");
      el.className="slot";
      el.innerHTML=`<img src="${g.icons[id]}"><span class="s-cnt">${n}</span><div class="s-bar" style="width:${clamp(n/def.max,0,1)*100}%"></div>`;
      el.onmouseenter=()=>{
        g.audio.uiMove();
        $("inv-info").innerHTML=`<div class="ii-name">${def.name}</div><div class="ii-cat">${def.cat} · ${def.en}</div><div class="ii-desc">${def.desc}</div><div class="ii-val">◈ ${fmt(def.val)} / 单位</div>`;
      };
      grid.appendChild(el);
    });
    for(let i=entries.length;i<totalSlots;i++){
      const el=document.createElement("div");
      el.className="slot empty";
      grid.appendChild(el);
    }
  }
  holdButton(btn,fill,onDone){
    let raf=null,start=null;
    const cancel=()=>{
      if(raf)cancelAnimationFrame(raf);
      raf=null;start=null;
      fill.style.width="0";
    };
    const step=ts=>{
      if(!start)start=ts;
      const t=(ts-start)/450;
      fill.style.width=clamp(t,0,1)*100+"%";
      if(t>=1){
        cancel();
        onDone();
        return;
      }
      raf=requestAnimationFrame(step);
    };
    btn.onmousedown=()=>{
      if(btn.disabled)return;
      this.g.audio.interactTick();
      raf=requestAnimationFrame(step);
    };
    btn.onmouseup=cancel;
    btn.onmouseleave=cancel;
  }
  renderCraft(){
    const g=this.g;
    const list=$("craft-list");
    list.innerHTML="";
    for(const r of g.recipes){
      if(r.tech)continue;
      const can=r.req.every(([id,n])=>g.inv.count(id)>=n);
      const el=document.createElement("div");
      el.className="recipe";
      const reqHtml=r.req.map(([id,n])=>{
        const ok=g.inv.count(id)>=n;
        return`<span class="req-chip ${ok?"ok":""}"><img src="${g.icons[id]}">${ITEMS[id].name} ${Math.min(g.inv.count(id),n)}/${n}</span>`;
      }).join("");
      el.innerHTML=`
        <div class="rc-icon"><img src="${g.icons[r.out]}"></div>
        <div class="rc-mid">
          <div class="rc-name">${ITEMS[r.out].name}<span class="rn-amt">×${r.n}</span></div>
          <div class="rc-desc">${r.desc||ITEMS[r.out].desc.slice(0,42)+"…"}</div>
          <div class="rc-req">${reqHtml}</div>
        </div>
        <button class="craftbtn" ${can?"":"disabled"}><div class="cb-fill"></div><span>按住合成</span></button>`;
      const btn=el.querySelector(".craftbtn");
      this.holdButton(btn,el.querySelector(".cb-fill"),()=>{
        g.craft(r);
        this.renderCraft();
        this.refreshHotbar();
      });
      list.appendChild(el);
    }
  }
  renderTech(){
    const g=this.g;
    const list=$("tech-list");
    list.innerHTML="";
    for(const r of g.recipes){
      if(!r.tech)continue;
      const owned=g.tech[r.id];
      const can=!owned&&r.req.every(([id,n])=>g.inv.count(id)>=n);
      const el=document.createElement("div");
      el.className="recipe techcard"+(owned?" owned":"");
      const reqHtml=r.req.map(([id,n])=>{
        const ok=g.inv.count(id)>=n;
        return`<span class="req-chip ${ok||owned?"ok":""}"><img src="${g.icons[id]}">${ITEMS[id].name} ${n}</span>`;
      }).join("");
      el.innerHTML=`
        <div class="rc-icon" style="font-size:22px;color:var(--cy)">${r.icon}</div>
        <div class="rc-mid">
          <div class="rc-name">${r.name}</div>
          <div class="rc-desc">${r.desc}</div>
          <div class="rc-req">${reqHtml}</div>
        </div>
        <button class="craftbtn ${owned?"owned":""}" ${can?"":"disabled"}><div class="cb-fill"></div><span>${owned?"已安装":"按住研发"}</span></button>`;
      const btn=el.querySelector(".craftbtn");
      if(!owned)this.holdButton(btn,el.querySelector(".cb-fill"),()=>{
        g.craftTech(r);
        this.renderTech();
      });
      list.appendChild(el);
    }
  }
  renderDiscoveries(){
    const g=this.g;
    const head=$("disc-head");
    const totalVal=g.discoveries.reduce((s,d)=>s+d.value,0);
    head.innerHTML=`
      <div class="dh"><b>${g.discoveries.length}</b><span>发现总数</span></div>
      <div class="dh"><b>${g.discoveries.filter(d=>d.type==="生物").length}</b><span>物种</span></div>
      <div class="dh"><b>${g.discoveries.filter(d=>d.type==="星球").length}</b><span>星球</span></div>
      <div class="dh"><b>◈ ${fmt(totalVal)}</b><span>累计收益</span></div>`;
    const list=$("disc-list");
    list.innerHTML="";
    [...g.discoveries].reverse().forEach(d=>{
      const el=document.createElement("div");
      el.className="disc-row";
      el.innerHTML=`<span class="dc-ico">${d.icon}</span><span class="dc-name">${d.name}</span><span class="dc-type">${d.type}</span><span class="dc-val">+${fmt(d.value)}</span>`;
      list.appendChild(el);
    });
    if(g.discoveries.length===0)list.innerHTML=`<div style="opacity:.5;letter-spacing:.2em;padding:20px">尚无发现 — 使用分析目镜 (F) 扫描生物与资源</div>`;
  }
  renderTrade(){
    const g=this.g;
    const list=$("trade-list");
    const canTrade=g.tradeAvailable();
    $("tabbtn-trade").disabled=!canTrade;
    $("trade-hint").textContent=canTrade?"星系贸易网络已连接 — 汇率实时结算":"需要靠近 空间站 或 贸易信标 才能交易";
    list.innerHTML="";
    if(!canTrade)return;
    const sellables=Object.entries(g.inv.items).filter(([,n])=>n>0);
    for(const[id,n]of sellables){
      const def=ITEMS[id];
      const el=document.createElement("div");
      el.className="trade-row";
      el.innerHTML=`<img src="${g.icons[id]}"><span class="tr-name">${def.name}</span><span class="tr-have">持有 ${n}</span><span class="tr-price">◈ ${fmt(def.val)}</span>
        <button class="tradebtn" data-a="10">卖 10</button><button class="tradebtn" data-a="all">全卖</button>`;
      el.querySelectorAll(".tradebtn").forEach(b=>{
        b.onclick=()=>{
          const amt=b.dataset.a==="all"?g.inv.count(id):Math.min(10,g.inv.count(id));
          if(amt<=0)return;
          g.inv.remove(id,amt);
          g.addUnits(amt*def.val);
          g.audio.units();
          this.renderTrade();
          this.refreshHotbar();
        };
      });
      list.appendChild(el);
    }
    const buys=[["tritium",30],["sodium",55],["oxygen",46],["dihydrogen",46]];
    for(const[id,price]of buys){
      const def=ITEMS[id];
      const el=document.createElement("div");
      el.className="trade-row";
      el.innerHTML=`<img src="${g.icons[id]}"><span class="tr-name">${def.name} <span style="opacity:.5;font-size:12px">(购入)</span></span><span class="tr-have">持有 ${g.inv.count(id)}</span><span class="tr-price">◈ ${fmt(price)}</span>
        <button class="tradebtn buy" data-a="10">买 10</button><button class="tradebtn buy" data-a="50">买 50</button>`;
      el.querySelectorAll(".tradebtn").forEach(b=>{
        b.onclick=()=>{
          const amt=parseInt(b.dataset.a);
          const cost=amt*price;
          if(g.units<cost){this.notify("交易终端","单位不足","warn");g.audio.uiError();return;}
          g.units-=cost;
          this.setUnits(g.units);
          g.inv.add(id,amt,false);
          g.audio.units();
          this.renderTrade();
        };
      });
      list.appendChild(el);
    }
  }
  showBanner(planet,extra){
    const b=$("banner");
    b.classList.remove("hidden","out");
    $("banner-kicker").textContent=extra?.kicker||"行星探测记录";
    $("banner-name").textContent=planet.name;
    $("banner-stats").innerHTML=`
      <span class="bs">气候 <b>${planet.hazardLabel}</b></span>
      <span class="bs">植被 <b>${planet.floraLabel}</b></span>
      <span class="bs">动物 <b>${planet.faunaLabel}</b></span>
      <span class="bs">资源 <b>${planet.resLabel}</b></span>`;
    $("banner-sub").textContent=extra?.sub||"";
    clearTimeout(this._bannerT);
    this._bannerT=setTimeout(()=>{
      b.classList.add("out");
      setTimeout(()=>b.classList.add("hidden"),820);
    },5200);
  }
  damageFlash(){
    const el=$("dmgvin");
    el.classList.add("hit");
    clearTimeout(this._dmgT);
    this._dmgT=setTimeout(()=>el.classList.remove("hit"),260);
  }
  speedLines(on){
    $("speedlines").style.opacity=on?1:0;
  }
  heatFx(t){
    $("heatfx").style.opacity=clamp(t,0,1);
  }
  whiteFlash(t){
    $("whiteflash").style.opacity=clamp(t,0,1);
  }
  fadeBlack(t,instant=false){
    const el=$("fadeblack");
    el.style.transition=instant?"none":"opacity .5s";
    el.style.opacity=clamp(t,0,1);
  }
  cinebars(on){
    $("cinebars").classList.toggle("on",on);
  }
  showClickCatch(cb){
    const el=$("clickcatch");
    el.classList.remove("hidden");
    el.onclick=()=>{
      el.classList.add("hidden");
      cb();
    };
  }
  hideClickCatch(){
    $("clickcatch").classList.add("hidden");
  }
  showPause(on){
    $("pause").classList.toggle("hidden",!on);
    if(on)this.applySettingsToInputs();
  }
  showDeath(lossTxt){
    $("death").classList.remove("hidden");
    $("death-loss").textContent=lossTxt;
  }
  hideDeath(){
    $("death").classList.add("hidden");
  }
  showTitle(hasSave){
    $("title").classList.remove("hidden");
    $("btn-continue").classList.toggle("hidden",!hasSave);
  }
  hideTitle(){
    $("title").classList.add("hidden");
  }
  async runBoot(lines,audio){
    const boot=$("boot");
    const txt=$("boot-text");
    boot.classList.remove("hidden");
    txt.innerHTML="";
    let skip=false;
    const onKey=e=>{if(e.code==="Space")skip=true;};
    window.addEventListener("keydown",onKey);
    for(const[line,cls,delay]of lines){
      if(skip)break;
      const span=document.createElement("span");
      if(cls)span.className=cls;
      txt.appendChild(span);
      for(let i=0;i<line.length;i++){
        if(skip)break;
        span.textContent+=line[i];
        if(line[i]!==" "&&i%2===0)audio.uiMove();
        await new Promise(r=>setTimeout(r,line[i]==="."?60:22));
      }
      txt.appendChild(document.createTextNode("\n"));
      if(!skip)await new Promise(r=>setTimeout(r,delay||300));
    }
    window.removeEventListener("keydown",onKey);
    boot.classList.add("hidden");
  }
  setFps(v){
    $("fps-meter").textContent=v;
  }
}
