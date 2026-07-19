import*as THREE from"three";
import{EffectComposer}from"three/addons/postprocessing/EffectComposer.js";
import{RenderPass}from"three/addons/postprocessing/RenderPass.js";
import{UnrealBloomPass}from"three/addons/postprocessing/UnrealBloomPass.js";
import{OutputPass}from"three/addons/postprocessing/OutputPass.js";
import{AudioEngine}from"./audio.js";
import{UI}from"./ui.js";
import{World,Environment}from"./world.js";
import{Player}from"./player.js";
import{Ship}from"./ship.js";
import{SpaceScene}from"./space.js";
import{Particles,CreatureSystem}from"./entities.js";
import{MissionManager}from"./missions.js";
import{makeIcons,buildAtlas,ITEMS}from"./blocks.js";
import{mulberry32,genPlanetName,genSystemName,clamp,lerp,fmt}from"./util.js";

const errlog=document.getElementById("errlog");
window.addEventListener("error",e=>{
  errlog.textContent+="[ERR] "+e.message+" @ "+(e.filename||"").split("/").pop()+":"+e.lineno+"\n";
});
window.addEventListener("unhandledrejection",e=>{
  errlog.textContent+="[REJ] "+(e.reason&&e.reason.message||e.reason)+"\n";
});

class Input{
  constructor(canvas){
    this.keys=new Set();
    this.pressed=new Set();
    this.dx=0;this.dy=0;
    this.mouseLeft=false;this.mouseRight=false;
    this.locked=false;
    this.canvas=canvas;
    window.addEventListener("keydown",e=>{
      if(e.code==="Tab"||e.code==="Space"&&e.target===document.body)e.preventDefault();
      if(!e.repeat){this.keys.add(e.code);this.pressed.add(e.code);}
    });
    window.addEventListener("keyup",e=>this.keys.delete(e.code));
    window.addEventListener("blur",()=>this.keys.clear());
    document.addEventListener("mousemove",e=>{
      if(this.locked){this.dx+=e.movementX;this.dy+=e.movementY;}
    });
    document.addEventListener("mousedown",e=>{
      if(!this.locked)return;
      if(e.button===0)this.mouseLeft=true;
      if(e.button===2)this.mouseRight=true;
    });
    document.addEventListener("mouseup",e=>{
      if(e.button===0)this.mouseLeft=false;
      if(e.button===2)this.mouseRight=false;
    });
    document.addEventListener("contextmenu",e=>e.preventDefault());
  }
  requestLock(){
    if(!this.locked)this.canvas.requestPointerLock();
  }
  endFrame(){
    this.pressed.clear();
    this.dx=0;this.dy=0;
  }
}

function makePlanets(sysSeed){
  const rng=mulberry32(sysSeed);
  const defs=[];
  const types=[
    {
      type:"hot",hazard:{day:0.5,night:0.1,label:"灼热",icon:"☀",temp:"58.4°C"},
      palette:{grass:"#c8963e",dirt:"#8a5a34",stone:"#96604a",sand:"#d8a860",wood:"#7a4a30",leaf:"#c87e3a",water:"#3d7a8a",skyTop:"#c87e50",skyBot:"#e8b088",fog:"#dca070",flower:"#e85a3c"},
      topBlock:3,subBlock:2,beachBlock:4,treeTrunk:7,seaLevel:0,mountain:1.1,fauna:1,
      deco:{tree:0.004,cactus:0.012,dihydro:0.02,sodium:0.024,oxygen:0.012,flower:0.01,tuft:0.05},
      floraLabel:"稀疏",faunaLabel:"罕见",resLabel:"钠·铜"
    },
    {
      type:"lush",hazard:{day:0,night:0.12,label:"温和",icon:"❀",temp:"21.2°C"},
      palette:{grass:"#63b04e",dirt:"#7a5638",stone:"#8d8d8d",sand:"#d8cc98",wood:"#6e4a2c",leaf:"#4c9440",water:"#2e6da8",skyTop:"#5a9ad8",skyBot:"#b8d8ee",fog:"#a8cce0",flower:"#e88bd0"},
      topBlock:3,subBlock:2,beachBlock:4,treeTrunk:7,seaLevel:29,mountain:0.85,fauna:2,
      deco:{tree:0.022,cactus:0,dihydro:0.012,sodium:0.012,oxygen:0.014,flower:0.02,tuft:0.09},
      floraLabel:"茂盛",faunaLabel:"丰富",resLabel:"碳·铁"
    },
    {
      type:"frozen",hazard:{day:0.42,night:0.75,label:"极寒",icon:"❄",temp:"-63.7°C"},
      palette:{grass:"#e8f0f4",dirt:"#8a8ea0",stone:"#7e8894",sand:"#cdd8e0",wood:"#5c5450",leaf:"#bcd8e8",water:"#7ea8c8",skyTop:"#8fb4d8",skyBot:"#d8e8f4",fog:"#c4d8e8",flower:"#a8c8f0"},
      topBlock:5,subBlock:2,beachBlock:5,treeTrunk:7,seaLevel:27,mountain:1.25,fauna:1,
      deco:{tree:0.008,cactus:0,dihydro:0.026,sodium:0.014,oxygen:0.01,flower:0.006,tuft:0.02},
      floraLabel:"冻土苔原",faunaLabel:"稀少",resLabel:"二氢·钴"
    },
    {
      type:"desert",hazard:{day:0.38,night:0.05,label:"干旱",icon:"◉",temp:"44.1°C"},
      palette:{grass:"#d0b060",dirt:"#b08048",stone:"#c09060",sand:"#e0c078",wood:"#8a6038",leaf:"#a8a050",water:"#4a8a9a",skyTop:"#d8a878",skyBot:"#f0d8b0",fog:"#e8cfa0",flower:"#e8a83c"},
      topBlock:4,subBlock:4,beachBlock:4,treeTrunk:7,seaLevel:0,mountain:1.5,fauna:1,
      deco:{tree:0,cactus:0.016,dihydro:0.016,sodium:0.018,oxygen:0.008,flower:0.008,tuft:0.03},
      floraLabel:"荒芜",faunaLabel:"罕见",resLabel:"硅·铜"
    },
    {
      type:"toxic",hazard:{day:0.55,night:0.55,label:"剧毒",icon:"☣",temp:"29.8°C"},
      palette:{grass:"#9a68c8",dirt:"#5a4468",stone:"#6a5a7a",sand:"#b09ac0",wood:"#3e3048",leaf:"#c880e0",water:"#4a9a6a",skyTop:"#7a9a58",skyBot:"#c8d8a0",fog:"#a8bc88",flower:"#68e8c8"},
      topBlock:3,subBlock:2,beachBlock:4,treeTrunk:7,seaLevel:24,mountain:0.95,fauna:2,
      deco:{tree:0.016,cactus:0,dihydro:0.014,sodium:0.016,oxygen:0.018,flower:0.024,tuft:0.07},
      floraLabel:"真菌丛生",faunaLabel:"常见",resLabel:"氧·钠"
    }
  ];
  const dists=[1500,2400,3400,4400,5400];
  for(let i=0;i<5;i++){
    const t=types[i];
    const a=rng()*Math.PI*2;
    const nameRng=mulberry32(sysSeed+i*31);
    defs.push({
      id:i,
      name:genPlanetName(nameRng),
      seed:(sysSeed+i*7919)>>>0,
      spacePos:new THREE.Vector3(Math.cos(a)*dists[i],(rng()-0.5)*420,Math.sin(a)*dists[i]),
      spaceR:110+rng()*55,
      rings:i===3,
      hazardLabel:t.hazard.label,
      tempStr:t.hazard.temp,
      presets:[],
      ...t
    });
  }
  return defs;
}

class Game{
  constructor(){
    this.canvas=document.getElementById("c");
    this.autotest=location.search.includes("autotest");
    this.lite=this.autotest&&location.search.includes("lite");
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:"high-performance"});
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.18;
    this.camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,0.12,16000);
    this.composer=new EffectComposer(this.renderer);
    this.renderPass=new RenderPass(new THREE.Scene(),this.camera);
    this.composer.addPass(this.renderPass);
    this.bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.4,0.65,0.83);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    window.addEventListener("beforeunload",()=>{if(this.inGameplay())this.save();});
    window.addEventListener("resize",()=>{
      this.camera.aspect=innerWidth/innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth,innerHeight);
      this.composer.setSize(innerWidth,innerHeight);
    });
    this.settings={vol:80,music:55,sensRaw:100,sens:1,dist:5,bloom:true,voice:true,fps:false};
    this.loadSettings();
    this.audio=new AudioEngine();
    this.input=new Input(this.canvas);
    this.state="title";
    this.paused=false;
    this.uiOpen=false;
    this.units=0;
    this.flags={};
    this.tech={};
    this.discoveries=[];
    this.discovered=new Set();
    this.visitedPlanets=new Set();
    this.planetState={};
    this.edits={};
    this.shipState={launchFuel:0,pulseFuel:30};
    this.sysSeed=1234567;
    this.trans=null;
    this.eHold=0;
    this.interactTarget=null;
    this.hotbar=[{type:"tool",id:"multitool"},{type:"item",id:"stonebrick"},{type:"item",id:"panel"},{type:"item",id:"glass"},{type:"item",id:"light"},{type:"item",id:"planks"}];
    this.hotbarSel=0;
    this.warnedShield=false;this.warnedLife=false;
    this.makeInventory();
    this.makeRecipes();
    this.ui=new UI(this);
    this.missions=new MissionManager(this);
    this.icons={};
    const preAtlas=buildAtlas({grass:"#63b04e",dirt:"#7a5638",stone:"#8d8d8d",sand:"#d8cc98",wood:"#6e4a2c",leaf:"#4c9440",water:"#2e6da8",flower:"#e88bd0"});
    this.icons=makeIcons(preAtlas.canvas);
    preAtlas.tex.dispose();
    document.addEventListener("pointerlockchange",()=>{
      this.input.locked=document.pointerLockElement===this.canvas;
      if(this.input.locked){
        this.ui.hideClickCatch();
      }else if(this.inGameplay()&&!this.uiOpen&&!this.paused&&!this.trans&&!this.autotest){
        this.togglePause(true);
      }
    });
    this.setupTitle();
    this.last=performance.now();
    this.fpsAcc=0;this.fpsN=0;
    requestAnimationFrame(t=>this.loop(t));
    if(this.autotest){
      this.settings.dist=3;
      this.settings.bloom=false;
      this.bloomPass.enabled=false;
      this.renderer.setPixelRatio(1);
      setTimeout(()=>{
        errlog.textContent+="[BOOT OK]\n";
        this.newGame(true);
      },100);
      setTimeout(()=>{
        errlog.textContent+="[TEST DONE] state="+this.state+" frames="+this.frameCount+" chunks="+(this.world?this.world.chunks.size:0)+"\n";
        errlog.hidden=false;
        if(!location.search.includes("scenario"))document.title="TESTDONE";
      },6000);
      const scnMatch=location.search.match(/scenario=(\w+)/);
      if(scnMatch){
        this.scenario=scnMatch[1];
        this.scnStep=0;
        this.scnDone=this.scenario==="interact"?9:4;
        if(this.lite){
          this.liteDrive=true;
          this.liteSteps=0;
          const drive=()=>{
            if(this.scnStep>=this.scnDone||this.liteSteps>14000){
              errlog.textContent+="[DRIVE END] steps="+this.liteSteps+" scn="+this.scnStep+" state="+this.state+"\n";
              document.title="TESTDONE";
              return;
            }
            for(let i=0;i<25&&this.scnStep<this.scnDone;i++){
              this.liteSteps++;
              try{this.step(1/30);}catch(e){
                errlog.textContent+="[STEP ERR] "+e.message+"\n"+(e.stack||"").split("\n").slice(0,3).join("\n")+"\n";
                this.scnStep=99;
              }
            }
            setTimeout(drive,1);
          };
          setTimeout(drive,1500);
        }
      }
    }
    this.frameCount=0;
  }
  inGameplay(){
    return this.state==="surface"||this.state==="ship"||this.state==="space";
  }
  makeInventory(){
    const g=this;
    this.inv={
      items:{},
      count(id){return this.items[id]||0;},
      add(id,n,toast=false){
        const def=ITEMS[id];
        const cur=this.items[id]||0;
        const room=def?def.max-cur:0;
        const real=Math.max(0,Math.min(n,room));
        this.items[id]=cur+real;
        if(toast&&real>0){
          g.ui.showPickup(id,real);
          g.audio.pickup(real);
          g.ui.refreshHotbar();
        }
        if(real<n&&toast)g.ui.notify("物品栏","「"+def.name+"」已达堆叠上限","warn");
      },
      remove(id,n){
        this.items[id]=Math.max(0,(this.items[id]||0)-n);
        g.ui.refreshHotbar();
      }
    };
  }
  makeRecipes(){
    this.recipes=[
      {out:"plating",n:1,req:[["ferrite",50]],desc:"锻压合金装甲板 — 修理与建造必备"},
      {out:"nanotube",n:1,req:[["carbon",50]],desc:"高强度微型管束 — 科技研发原料"},
      {out:"jelly",n:1,req:[["dihydrogen",40]],desc:"高能燃料半成品 — 起飞燃料原料"},
      {out:"launchfuel",n:1,req:[["jelly",1],["plating",1]],desc:"固体火箭燃料 — 为起飞推进器补给"},
      {out:"stonebrick",n:8,req:[["ferrite",30]],desc:"建造方块 — 坚固的基础结构"},
      {out:"planks",n:8,req:[["carbon",40]],desc:"建造方块 — 温暖的木质结构"},
      {out:"panel",n:8,req:[["ferrite",40],["copper",10]],desc:"建造方块 — 科技感合金外墙"},
      {out:"glass",n:4,req:[["silica",40],["carbon",10]],desc:"建造方块 — 全景观察窗"},
      {out:"light",n:4,req:[["sodium",15],["copper",10]],desc:"建造方块 — 驱散黑暗的冷光源"},
      {tech:true,id:"beamAmp",name:"光束谐振器",icon:"⚡",req:[["copper",80],["nanotube",1]],desc:"采矿光束效率 +70%，资源产出 +50%"},
      {tech:true,id:"jetBoost",name:"喷流增压器",icon:"▲",req:[["cobalt",60],["plating",1]],desc:"喷气背包推力 +70%，燃耗降低"},
      {tech:true,id:"shieldFiber",name:"防护纤维",icon:"⛨",req:[["sodium",80],["copper",40]],desc:"危险环境防护消耗 -45%"},
      {tech:true,id:"pulseOverdrive",name:"脉冲超驱",icon:"✦",req:[["tritium",120],["plating",2]],desc:"脉冲飞行速度 +50%，燃耗 -40%"}
    ];
  }
  craft(r){
    for(const[id,n]of r.req){
      if(this.inv.count(id)<n){this.audio.uiError();return;}
    }
    for(const[id,n]of r.req)this.inv.remove(id,n);
    this.inv.add(r.out,r.n,false);
    this.audio.craft();
    this.ui.showPickup(r.out,r.n);
    this.save();
  }
  craftTech(r){
    for(const[id,n]of r.req){
      if(this.inv.count(id)<n){this.audio.uiError();return;}
    }
    for(const[id,n]of r.req)this.inv.remove(id,n);
    this.tech[r.id]=true;
    this.applyTech();
    this.audio.craft();
    this.audio.discovery();
    this.ui.notify("科技已安装",r.name,"");
    this.save();
  }
  applyTech(){
    if(this.player){
      this.player.mineToolPower=this.tech.beamAmp?1.7:1;
      this.player.jetPower=this.tech.jetBoost?1.7:1;
      this.player.shieldEff=this.tech.shieldFiber?0.55:1;
    }
  }
  addUnits(n){
    this.units+=Math.floor(n);
    this.ui.setUnits(this.units);
  }
  addDiscovery(d){
    this.discoveries.push(d);
  }
  selectHotbar(i){
    if(i<0||i>=this.hotbar.length)return;
    this.hotbarSel=i;
    this.ui.refreshHotbar();
    this.audio.uiMove();
  }
  tradeAvailable(){
    if(this.state==="space"&&this.space)return this.space.stationDist(this.ship.pos)<260;
    if((this.state==="surface")&&this.traderPos&&this.player){
      return this.player.pos.distanceTo(this.traderPos)<9;
    }
    return false;
  }
  shipDistance(){
    if(!this.player||!this.ship||this.state!=="surface")return null;
    return Math.floor(this.player.pos.distanceTo(this.ship.pos));
  }
  beaconWorldPos(){
    if(!this.beaconPos)return null;
    return this.beaconPos;
  }
  setupTitle(){
    const hasSave=!!localStorage.getItem("voxelsky_save_v1");
    this.ui.showTitle(hasSave);
    const btnNew=document.getElementById("btn-new");
    const btnCont=document.getElementById("btn-continue");
    const prime=()=>{this.audio.init();this.audio.resume();this.audio.startMusic("title");};
    document.getElementById("title").addEventListener("pointerdown",prime,{once:true});
    btnNew.onclick=()=>{
      prime();
      this.audio.uiConfirm();
      localStorage.removeItem("voxelsky_save_v1");
      this.newGame(false);
    };
    btnCont.onclick=()=>{
      prime();
      this.audio.uiConfirm();
      this.continueGame();
    };
    document.querySelectorAll(".tbtn").forEach(b=>{
      b.addEventListener("mouseenter",()=>this.audio.uiMove());
    });
  }
  async newGame(fast){
    this.ui.hideTitle();
    this.state="boot";
    this.planets=makePlanets(this.sysSeed);
    this.sysName=genSystemName(mulberry32(this.sysSeed));
    this.audio.stopMusic();
    if(!fast){
      await this.ui.runBoot([
        ["◈ VOXELSKY 外骨骼系统 v9.4","",260],
        ["初始化生命维持协议 ................ [OK]","",180],
        ["记忆核心完整性 .................... [数据丢失]","warn",240],
        ["危险防护模块 ...................... [严重受损]","bad",240],
        ["扫描仪 / 分析目镜 ................. [离线]","bad",240],
        ["检测到坠毁信标：拉扎鲁斯号 · 方位 INBOUND","",300],
        ["行星环境：" + this.planets[0].hazardLabel + " · 昼间温度 " + this.planets[0].tempStr,"warn",300],
        ["生存指令：修复飞船，离开这颗星球。","",500]
      ],this.audio);
    }
    const p0=this.planets[0];
    const crashX=24,crashZ=24;
    p0.presets=[
      {x:crashX,z:crashZ,type:"crash"},
      {x:crashX+150,z:crashZ+90,type:"beacon"},
      {x:crashX-190,z:crashZ+160,type:"trader"}
    ];
    this.missionsIdx=0;
    await this.enterPlanet(p0,{mode:"newgame",crashX,crashZ});
    this.missions.setIndex(0);
    this.ui.centerToast("苏 醒","AWAKENINGS");
    this.audio.speak("旅行者，欢迎回来。你的飞船坠毁了。");
    if(!this.autotest){this.input.requestLock();this.watchLock();}
  }
  async continueGame(){
    const raw=localStorage.getItem("voxelsky_save_v1");
    if(!raw){this.newGame(false);return;}
    const s=JSON.parse(raw);
    this.ui.hideTitle();
    this.audio.stopMusic();
    this.planets=makePlanets(this.sysSeed);
    this.sysName=genSystemName(mulberry32(this.sysSeed));
    this.units=s.units||0;
    this.inv.items=s.inv||{};
    this.tech=s.tech||{};
    this.flags=s.flags||{};
    this.discoveries=s.discoveries||[];
    this.discovered=new Set(s.discovered||[]);
    this.visitedPlanets=new Set(s.visited||[]);
    this.edits=s.edits||{};
    this.shipState=s.shipState||{launchFuel:0,pulseFuel:30};
    this.planetState=s.planetState||{};
    const p0=this.planets[0];
    p0.presets=[
      {x:24,z:24,type:"crash"},
      {x:174,z:114,type:"beacon"},
      {x:-166,z:184,type:"trader"}
    ];
    this.ui.setUnits(this.units);
    if(s.mode==="space"){
      this.buildSpace();
      this.ship=this.ship||new Ship(this);
      this.ship.pos.set(s.shipPos[0],s.shipPos[1],s.shipPos[2]);
      this.ship.yaw=s.shipYaw||0;
      this.ship.state="fly";
      this.enterSpaceState(false);
    }else{
      const def=this.planets[s.planet||0];
      await this.enterPlanet(def,{mode:"load",save:s});
    }
    this.missions.setIndex(s.mission||0);
    if(!this.autotest){this.input.requestLock();this.watchLock();}
  }
  save(){
    if(!this.planets)return;
    if(this.world&&this.planet)this.edits[this.planet.id]=this.world.edits;
    const s={
      units:this.units,inv:this.inv.items,tech:this.tech,flags:this.flags,
      discoveries:this.discoveries,discovered:[...this.discovered],visited:[...this.visitedPlanets],
      edits:this.edits,shipState:this.shipState,mission:this.missions.idx,
      planetState:this.planetState,
      mode:this.state==="space"?"space":"surface",
      planet:this.planet?this.planet.id:0,
      playerPos:this.player?[this.player.pos.x,this.player.pos.y,this.player.pos.z]:null,
      shipPos:this.ship?[this.ship.pos.x,this.ship.pos.y,this.ship.pos.z]:null,
      shipYaw:this.ship?this.ship.yaw:0,
      shipMode:this.ship?this.ship.state:"landed",
      inShip:this.state==="ship"||this.state==="space"
    };
    try{localStorage.setItem("voxelsky_save_v1",JSON.stringify(s));}catch(e){}
  }
  saveSettings(){
    try{localStorage.setItem("voxelsky_settings_v1",JSON.stringify(this.settings));}catch(e){}
  }
  loadSettings(){
    try{
      const s=JSON.parse(localStorage.getItem("voxelsky_settings_v1")||"null");
      if(s)Object.assign(this.settings,s);
      this.settings.sens=this.settings.sensRaw/100;
    }catch(e){}
  }
  applyViewDist(v){
    if(this.world)this.world.viewDist=v;
    if(this.env)this.env.setViewDist(v);
  }
  applyBloom(b){
    this.bloomPass.enabled=b;
  }
  disposeSurface(){
    if(this.world){
      this.edits[this.planet.id]=this.world.edits;
      this.world.dispose();
      this.world=null;
    }
    if(this.env){this.env.dispose();this.env=null;}
    if(this.creatures){this.creatures.dispose();this.creatures=null;}
    if(this.surfParticles){this.surfParticles.dispose(this.surfScene);this.surfParticles=null;}
    if(this.player&&this.surfScene)this.player.removeFrom(this.surfScene,this.camera);
    if(this.ship&&this.surfScene)this.ship.removeFrom(this.surfScene);
    this.surfScene=null;
  }
  async enterPlanet(def,opts){
    this.ui.fadeBlack(1,opts.mode==="newgame");
    await new Promise(r=>setTimeout(r,60));
    this.disposeSurface();
    this.planet=def;
    const ps=this.planetState[def.id]||(this.planetState[def.id]={lastX:32,lastZ:-20});
    if(ps.traderX===undefined){ps.traderX=ps.lastX+150;ps.traderZ=ps.lastZ+110;}
    if(def.id!==0&&def.presets.length===0){
      def.presets.push({x:ps.traderX,z:ps.traderZ,type:"trader"});
    }
    this.surfScene=new THREE.Scene();
    this.surfScene.add(this.camera);
    this.world=new World(this.surfScene,def,this.edits[def.id]||{});
    this.world.viewDist=this.settings.dist;
    this.env=new Environment(this.surfScene,def);
    this.env.setViewDist(this.settings.dist);
    this.surfParticles=new Particles(this.surfScene);
    this.particles=this.surfParticles;
    this.audio.startWind();
    this.audio.setWind(0.1+def.hazard.day*0.16);
    this.audio.stopSpaceAmbient();
    this.audio.startMusic("planet");
    if(!this.player)this.player=new Player(this);
    this.applyTech();
    this.player.addTo(this.surfScene,this.camera);
    if(!this.ship)this.ship=new Ship(this);
    this.ship.addTo(this.surfScene);
    this.creatures=new CreatureSystem(this.surfScene,this.world,def,this.audio);
    this.icons=makeIcons(this.world.atlasCanvas);
    this.ui.buildHotbar();
    this.ui.clearMarkers("planet_");
    this.ui.removeMarker("station");
    this.ui.clearMarkers("res");
    this.beaconPos=null;this.traderPos=null;
    for(const pre of def.presets||[]){
      const h=this.world.heightAt(pre.x,pre.z);
      if(pre.type==="beacon")this.beaconPos=new THREE.Vector3(pre.x+0.5,h+2.5,pre.z+0.5);
      if(pre.type==="trader")this.traderPos=new THREE.Vector3(pre.x+0.5,h+1.5,pre.z+0.5);
    }
    if(this.traderPos){
      this.ui.removeMarker("trader");
      this.ui.addMarker({id:"trader",kind:"res",pos:this.traderPos.clone(),icon:"◇",label:"贸易信标"});
    }
    if(opts.mode==="newgame"){
      const px=opts.crashX-60,pz=opts.crashZ+42;
      this.pregen(px,pz);
      const py=this.world.surfaceY(px,pz);
      this.player.pos.set(px+0.5,py+0.5,pz+0.5);
      const sy=this.world.heightAt(opts.crashX,opts.crashZ);
      this.ship.placeLanded(opts.crashX+0.5,sy+2.2,opts.crashZ+0.5,0.8);
      this.ship.mesh.rotation.z=0.22;
      this.ship.mesh.rotation.x=0.1;
      this.shipCrashFx=true;
      this.state="surface";
      this.ui.showHud(true);
      this.ui.setMode("walk");
      this.player.shield=38;
      this.player.life=82;
    }
    else if(opts.mode==="load"){
      const s=opts.save;
      this.pregen(s.playerPos?s.playerPos[0]:32,s.playerPos?s.playerPos[2]:-20);
      if(s.shipPos)this.ship.placeLanded(s.shipPos[0],s.shipPos[1],s.shipPos[2],s.shipYaw||0);
      if(s.playerPos)this.player.pos.set(s.playerPos[0],s.playerPos[1]+0.4,s.playerPos[2]);
      else this.player.pos.set(32,this.world.surfaceY(32,-20)+1,-20);
      this.shipCrashFx=!this.flags.thrusterFixed;
      if(this.shipCrashFx){this.ship.mesh.rotation.z=0.22;this.ship.mesh.rotation.x=0.1;}
      this.state="surface";
      this.ui.showHud(true);
      this.ui.setMode("walk");
    }
    else if(opts.mode==="fromSpace"){
      const px=ps.lastX,pz=ps.lastZ;
      this.pregen(px,pz);
      this.ship.pos.set(px,168,pz);
      this.ship.yaw=opts.yaw||0;
      this.ship.pitch=0.34;
      this.ship.roll=0;
      this.ship.state="fly";
      this.ship.throttle=0.55;
      this.ship.speed=44;
      this.ship.setGear(0);
      this.audio.startShip();
      this.state="ship";
      this.ui.showHud(true);
      this.ui.setMode("ship");
    }
    this.ui.setMission(this.missions.current);
    this.ui.fadeBlack(0);
    this.enteringPlanet=false;
    const firstVisit=!this.visitedPlanets.has(def.id);
    if(firstVisit){
      this.visitedPlanets.add(def.id);
      const units=800;
      this.addUnits(units);
      this.addDiscovery({type:"星球",icon:"◈",name:def.name,value:units});
      this.ui.showBanner(def,{sub:"新发现 · +"+fmt(units)+" 单位"});
      this.audio.discovery();
    }else{
      this.ui.showBanner(def,{kicker:"抵达行星"});
    }
    this.save();
  }
  pregen(px,pz){
    for(let i=0;i<40;i++)this.world.update(px,pz,3);
  }
  buildSpace(){
    if(this.space)return;
    this.space=new SpaceScene(this);
    this.space.build(this.planets,this.sysSeed);
    this.spaceParticles=new Particles(this.space.scene);
  }
  enterSpaceState(withBanner=true){
    this.buildSpace();
    this.state="space";
    this.particles=this.spaceParticles;
    if(this.ship){
      this.ship.removeFrom(this.surfScene||this.space.scene);
      this.ship.addTo(this.space.scene);
      this.ship.setGear(0);
    }
    this.audio.stopWind();
    this.audio.startSpaceAmbient();
    this.audio.startShip();
    this.audio.startMusic("space");
    this.ui.showHud(true);
    this.ui.setMode("ship");
    if(withBanner){
      this.ui.centerToast("外 太 空",this.sysName+" 星系");
    }
  }
  startExitTransition(){
    if(this.trans)return;
    this.trans={type:"exit",t:0};
    this.ui.cinebars(true);
    this.audio.startEntry();
    this.ui.speedLines(true);
  }
  startEnterTransition(def){
    if(this.trans||this.enteringPlanet)return;
    this.enteringPlanet=true;
    this.trans={type:"enter",t:0,def};
    this.ui.cinebars(true);
    this.audio.startEntry();
    this.ship.stopPulse();
    this.ui.speedLines(true);
    const dir=this.ship.pos.clone().sub(def.spacePos).normalize();
    def.lastApproach=dir;
  }
  updateTransition(dt){
    const tr=this.trans;
    tr.t+=dt;
    const t=tr.t;
    if(tr.type==="exit"){
      this.ship.pitch=lerp(this.ship.pitch,-0.68,Math.min(dt*2,1));
      this.ship.speed=lerp(this.ship.speed,120,Math.min(dt*1.5,1));
      this.ship.pos.addScaledVector(this.ship.forward(),this.ship.speed*dt);
      this.ship.updateTransform();
      this.ship.engineFx(dt,1);
      this.ship.chaseCam(dt,this.camera,true);
      this.audio.setEntry(Math.min(t/1.5,1)*0.7);
      this.shake(Math.min(t/2,1)*0.5);
      if(this.env)this.env.update(dt,this.player?this.player.pos:this.ship.pos,1);
      if(t>1.9&&t<2.2)this.ui.whiteFlash((t-1.9)/0.3);
      if(t>=2.2&&!tr.switched){
        tr.switched=true;
        const def=this.planet;
        const ps=this.planetState[def.id];
        if(ps){ps.lastX=Math.floor(this.ship.pos.x);ps.lastZ=Math.floor(this.ship.pos.z);}
        this.disposeSurface();
        this.buildSpace();
        const dir=def.lastApproach||new THREE.Vector3(0,1,0);
        this.ship.pos.copy(def.spacePos).addScaledVector(dir,def.spaceR*1.4);
        const away=dir.clone();
        this.ship.yaw=Math.atan2(-away.x,-away.z)+Math.PI;
        this.ship.pitch=0.15;
        this.ship.speed=60;
        this.enterSpaceState(true);
        this.missions.event("reachSpace");
        this.flags.reachedSpace=true;
      }
      if(t>2.2)this.ui.whiteFlash(Math.max(0,1-(t-2.2)/0.5));
      if(t>2.2&&this.space)this.space.update(dt,this.ship,this.camera);
      if(t>3.4){
        this.endTransition();
      }
    }
    if(tr.type==="enter"){
      const def=tr.def;
      const toP=def.spacePos.clone().sub(this.ship.pos).normalize();
      const wantYaw=Math.atan2(-toP.x,-toP.z);
      this.ship.yaw=lerp(this.ship.yaw,wantYaw,Math.min(dt*1.4,1));
      this.ship.pitch=lerp(this.ship.pitch,Math.asin(clamp(toP.y,-1,1)),Math.min(dt*1.4,1));
      this.ship.speed=lerp(this.ship.speed,180,Math.min(dt,1));
      this.ship.pos.addScaledVector(this.ship.forward(),this.ship.speed*dt);
      this.ship.updateTransform();
      this.ship.engineFx(dt,1);
      this.ship.chaseCam(dt,this.camera,true);
      if(this.space)this.space.update(dt,this.ship,this.camera);
      const heat=clamp((t-0.4)/1.4,0,1);
      this.ui.heatFx(heat*0.95);
      this.audio.setEntry(heat);
      this.shake(heat*1.2);
      if(t>2.3&&t<2.65)this.ui.whiteFlash((t-2.3)/0.35);
      if(t>=2.65&&!tr.switched){
        tr.switched=true;
        const yaw=Math.random()*Math.PI*2;
        this.enterPlanet(def,{mode:"fromSpace",yaw});
      }
      if(t>2.65){
        this.ui.whiteFlash(Math.max(0,1-(t-2.65)/0.5));
        this.ui.heatFx(Math.max(0,0.95-(t-2.65)*0.7));
        if(this.state==="ship"&&this.ship){
          this.ship.updateSurface(dt,{keys:new Set(),pressed:new Set(),dx:0,dy:0},this.camera);
        }
      }
      if(t>4.1&&this.state==="ship"){
        this.endTransition();
      }
    }
  }
  endTransition(){
    this.trans=null;
    this.ui.cinebars(false);
    this.ui.speedLines(false);
    this.ui.whiteFlash(0);
    this.ui.heatFx(0);
    this.audio.stopEntry();
    this.shakeAmt=0;
  }
  shake(amt){
    this.shakeAmt=amt;
  }
  applyShake(){
    if(!this.shakeAmt)return;
    const a=this.shakeAmt*0.01;
    this.camera.rotation.x+=(Math.random()-0.5)*a;
    this.camera.rotation.y+=(Math.random()-0.5)*a;
  }
  togglePause(on){
    if(this.state==="title"||this.state==="boot")return;
    this.paused=on;
    this.ui.showPause(on);
    if(on){
      this.audio.uiOpen();
      if(document.pointerLockElement)document.exitPointerLock();
    }else{
      this.audio.uiClose();
      this.input.requestLock();
      this.watchLock();
    }
  }
  watchLock(){
    if(this.autotest)return;
    setTimeout(()=>{
      if(this.inGameplay()&&!this.paused&&!this.uiOpen&&!this.input.locked){
        this.ui.showClickCatch(()=>{
          this.input.requestLock();
        });
      }
    },400);
  }
  openInventory(tab="inv"){
    if(this.uiOpen)return;
    this.uiOpen=true;
    this.ui.openInventory(tab);
    if(document.pointerLockElement)document.exitPointerLock();
  }
  closeInventory(){
    if(!this.uiOpen)return;
    this.uiOpen=false;
    this.ui.closeInventoryUI();
    this.input.requestLock();
    this.watchLock();
  }
  onPlayerDeath(){
    if(this.state==="dead")return;
    this.state="dead";
    this.audio.stopAllLoops();
    this.audio.explosion(true);
    const loss=Math.floor(this.units*0.05);
    this.units-=loss;
    this.ui.setUnits(this.units);
    this.ui.showDeath(loss>0?"数据链路受损 · 损失 "+fmt(loss)+" 单位":"");
    if(document.pointerLockElement)document.exitPointerLock();
    this.audio.speak("检测到生命体征消失");
  }
  respawn(){
    this.ui.hideDeath();
    const p=this.player;
    p.health=100;p.shield=60;p.life=80;p.jetFuel=100;
    if(this.ship&&this.state!=="space"){
      p.pos.set(this.ship.pos.x+3,this.world.surfaceY(Math.floor(this.ship.pos.x+3),Math.floor(this.ship.pos.z))+1,this.ship.pos.z);
    }
    this.state="surface";
    this.audio.startWind();
    this.input.requestLock();
    this.watchLock();
  }
  updateInteract(dt){
    const g=this;
    let target=null;
    if(this.state==="surface"){
      const pd=this.player.pos.distanceTo(this.ship.pos);
      if(pd<7){
        if(!this.flags.shipChecked)target={text:"检查飞船残骸",action:()=>{
          this.flags.shipChecked=true;
          this.missions.event("checkShip");
          this.ui.notify("拉扎鲁斯号","诊断: 起飞推进器 ✗ · 脉冲引擎 ✗ · 燃料 0%","warn");
        }};
        else if(!this.flags.thrusterFixed){
          const ok=this.inv.count("plating")>=1&&this.inv.count("jelly")>=1;
          target={text:ok?"修复 起飞推进器":"起飞推进器 · 缺少组件",disabled:!ok,
          deniedMsg:"请按 TAB 打开合成菜单制作: 金属镀层(铁尘×50) 与 二氢凝胶(二氢×40)",action:()=>{
            this.inv.remove("plating",1);this.inv.remove("jelly",1);
            this.flags.thrusterFixed=true;
            this.shipCrashFx=false;
            this.ship.mesh.rotation.z=0;this.ship.mesh.rotation.x=0;
            this.missions.event("repairThruster");
            this.particles.burst(this.ship.pos,0x7ce8e8,20,5);
            this.audio.craft();
          }};
        }
        else if(!this.flags.pulseFixed){
          const ok=this.inv.count("plating")>=1&&this.inv.count("seal")>=1;
          target={text:ok?"修复 脉冲引擎":"脉冲引擎 · 缺少组件",disabled:!ok,
          deniedMsg:"需要 金属镀层×1 (合成) 与 密封垫×1 (跟随橙色任务标记去遇险信标回收)",action:()=>{
            this.inv.remove("plating",1);this.inv.remove("seal",1);
            this.flags.pulseFixed=true;
            this.missions.event("repairPulse");
            this.particles.burst(this.ship.pos,0x7ce8e8,20,5);
            this.audio.craft();
          }};
        }
        else if(this.shipState.launchFuel<99&&this.inv.count("launchfuel")>=1){
          target={text:"注入 起飞燃料",action:()=>{
            this.inv.remove("launchfuel",1);
            this.shipState.launchFuel=100;
            this.audio.craft();
          }};
        }
        else{
          target={text:"进入 拉扎鲁斯号",action:()=>{
            this.state="ship";
            this.ui.setMode("ship");
            this.audio.startShip();
            this.audio.uiConfirm();
          }};
        }
      }
      if(!target&&this.beaconPos&&!this.flags.gotSeal&&this.player.pos.distanceTo(this.beaconPos)<6){
        target={text:"回收 密封垫",action:()=>{
          this.flags.gotSeal=true;
          this.inv.add("seal",1,true);
          this.ui.notify("遇险信标","回收成功 — 里面还有一段旧航行日志…","");
          this.audio.discovery();
        }};
      }
      if(!target&&this.traderPos&&this.player.pos.distanceTo(this.traderPos)<7){
        target={text:"接入 贸易网络",action:()=>{
          this.openInventory("trade");
        }};
      }
      if(!target){
        const dir=new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        const hit=this.world.raycast(this.camera.position.clone(),dir,5);
        if(hit&&hit.id===23&&!this.discovered.has("mono_"+this.planet.id+"_"+hit.x+"_"+hit.z)){
          target={text:"解读 远古方尖碑",action:()=>{
            this.discovered.add("mono_"+this.planet.id+"_"+hit.x+"_"+hit.z);
            const u=300;
            this.addUnits(u);
            this.addDiscovery({type:"遗迹",icon:"▣",name:"远古方尖碑",value:u});
            this.ui.notify("远古方尖碑","一段古老的回响掠过意识 · +"+u+" 单位","");
            this.audio.discovery();
          }};
        }
      }
    }
    else if(this.state==="ship"&&this.ship.state==="landed"){
      target={text:"离开飞船",key:"E",action:()=>{
        this.state="surface";
        this.ui.setMode("walk");
        this.audio.stopShip();
        const sx=this.ship.pos.x+3.2,sz=this.ship.pos.z;
        this.player.pos.set(sx,this.world.surfaceY(Math.floor(sx),Math.floor(sz))+1,sz);
        this.player.vel.set(0,0,0);
        this.audio.uiConfirm();
        this.save();
      }};
    }
    else if(this.state==="space"&&this.space&&this.space.stationDist(this.ship.pos)<260){
      target={text:"接入 空间站贸易网络",action:()=>{
        this.openInventory("trade");
      }};
    }
    this.interactTarget=target;
    if(this.eLatch){
      if(!this.input.keys.has("KeyE"))this.eLatch=false;
      this.ui.setInteract(target?target.text:null,0,"E");
      this.eHold=0;
      if(!target)this.ui.setInteract(null);
      return;
    }
    if(target){
      if(this.input.keys.has("KeyE")&&!target.disabled){
        this.eHold+=dt/0.4;
        if(Math.floor(this.eHold*6)!==Math.floor((this.eHold-dt/0.55)*6))this.audio.interactTick();
        if(this.eHold>=1){
          this.eHold=0;
          this.eLatch=true;
          target.action();
        }
      }else{
        if(this.input.keys.has("KeyE")&&target.disabled&&!this._deniedTick){
          this._deniedTick=true;
          this.audio.uiError();
          if(target.deniedMsg)this.ui.notify("无法执行",target.deniedMsg,"warn");
        }
        if(!this.input.keys.has("KeyE"))this._deniedTick=false;
        this.eHold=Math.max(0,this.eHold-dt*3);
      }
      this.ui.setInteract(target.text,this.eHold,"E");
    }else{
      this.eHold=0;
      this.ui.setInteract(null);
    }
  }
  updateHud(dt){
    const p=this.player;
    if(this.state==="surface"&&p){
      this.ui.setVitals(p);
      if(p.shield<25&&!this.warnedShield){
        this.warnedShield=true;
        this.ui.notify("危险防护","电力不足 — 采集 钠 并按 Q 充能","danger");
        this.audio.speak("警告，危险防护电力不足");
      }
      if(p.shield>50)this.warnedShield=false;
      if(p.life<25&&!this.warnedLife){
        this.warnedLife=true;
        this.ui.notify("生命维持","氧气不足 — 按 T 使用 氧/碳 充能","danger");
        this.audio.speak("警告，生命维持系统电量低");
      }
      if(p.life>50)this.warnedLife=false;
    }
    if(this.state!=="space"&&this.planet&&this.env){
      const hz=this.planet.hazard;
      const sev=this.env.dayFactor>0.4?hz.day:hz.night;
      const hours=Math.floor(this.env.t*24);
      const mins=Math.floor((this.env.t*24-hours)*60);
      const cls=sev>0.45?"extreme":sev>0.15?"danger":"";
      this.ui.setEnv(this.planet.name,hz.icon,hz.label+(sev>0?" "+["Ⅰ","Ⅱ","Ⅲ"][Math.min(2,Math.floor(sev*3))]:""),cls,
        String(hours).padStart(2,"0")+":"+String(mins).padStart(2,"0"));
    }else if(this.state==="space"){
      this.ui.setEnv(this.sysName+" 星系","◌","真空",""," --:--");
    }
    let yawDeg;
    if(this.state==="surface")yawDeg=(-(this.player.yaw*180/Math.PI))%360;
    else yawDeg=(-(this.ship.yaw*180/Math.PI))%360;
    while(yawDeg<0)yawDeg+=360;
    const refPos=this.state==="surface"?this.player.pos:this.ship.pos;
    const bearings=this.ui.updateMarkers(dt,this.camera,refPos);
    this.ui.updateCompass(yawDeg,bearings);
  }
  updateSpaceMarkers(){
    for(const p of this.planets){
      this.ui.addMarker({
        id:"planet_"+p.id,
        kind:"planet",
        pos:p.spacePos,
        icon:"◈",
        label:p.name,
        unit:"u"
      });
    }
    if(this.space&&this.space.station){
      this.ui.addMarker({
        id:"station",kind:"ship",pos:this.space.station.position,icon:"◇",label:"空间站",unit:"u"
      });
    }
  }
  updateScenario(){
    if(this.scnStep===undefined)return;
    const log=t=>{errlog.textContent+=t+"\n";};
    if(this.scenario==="interact"){
      const k=this.input.keys;
      if(this.scnStep===0&&this.state==="surface"&&this.frameCount>140){
        const sp=this.ship.pos;
        this.player.pos.set(sp.x+3,sp.y+0.5,sp.z);
        log("[SCN] teleported near ship dist="+this.player.pos.distanceTo(sp).toFixed(1));
        this.scnStep=1;this.scnWait=this.frameCount+10;
      }
      else if(this.scnStep>=1&&this.scnStep<=5){
        if(this.frameCount<this.scnWait){k.delete("KeyE");return;}
        if(this.frameCount===this.scnWait)log("[SCN] step"+this.scnStep+" target="+(this.interactTarget?this.interactTarget.text+(this.interactTarget.disabled?"(禁用)":""):"null"));
        k.add("KeyE");
        const seq=[
          ()=>this.flags.shipChecked,
          ()=>this.flags.thrusterFixed,
          ()=>this.flags.pulseFixed,
          ()=>this.shipState.launchFuel>=99,
          ()=>this.state==="ship"
        ];
        if(seq[this.scnStep-1]()){
          log("[SCN] step"+this.scnStep+" OK");
          if(this.scnStep===1){this.inv.add("plating",1);this.inv.add("jelly",1);}
          if(this.scnStep===2){this.inv.add("plating",1);this.inv.add("seal",1);}
          if(this.scnStep===3){this.inv.add("launchfuel",1);}
          this.scnStep++;
          this.scnWait=this.frameCount+8;
          if(this.scnStep===6){
            k.delete("KeyE");
            log("[SCN] SUCCESS full interact chain, state="+this.state);
            document.title="TESTDONE";
            this.scnStep=9;
          }
        }
        if(this.frameCount>3000&&this.scnStep<9){
          log("[SCN] TIMEOUT at step"+this.scnStep+" flags="+JSON.stringify(this.flags)+" eHold="+this.eHold.toFixed(2)+" latch="+this.eLatch);
          document.title="TESTDONE";
          this.scnStep=9;
        }
      }
      return;
    }
    if(this.scenario==="mine"){
      if(this.scnStep===0&&this.state==="surface"&&this.frameCount>140){
        this.flags.scannerFixed=true;
        this.player.pitch=-1.15;
        this.input.mouseLeft=true;
        this.player.scanPulse();
        log("[SCN] mining start");
        this.scnStep=1;
      }
      else if(this.scnStep===1&&this.frameCount>500){
        const total=Object.values(this.inv.items).reduce((a,b)=>a+b,0);
        log("[SCN] mined total="+total+" items="+JSON.stringify(this.inv.items));
        this.input.mouseLeft=false;
        this.inv.add("ferrite",60,false);
        this.craft(this.recipes[0]);
        log("[SCN] craft plating="+this.inv.count("plating"));
        this.inv.add("stonebrick",10,false);
        this.selectHotbar(1);
        this.player.pitch=-0.7;
        this.input.mouseRight=true;
        this.scnStep=2;
      }
      else if(this.scnStep===2&&this.frameCount>620){
        log("[SCN] placed leftover bricks="+this.inv.count("stonebrick"));
        log((this.inv.count("stonebrick")<10&&this.inv.count("plating")===1&&Object.keys(this.inv.items).length>0)?"[SCN] SUCCESS mine/craft/place":"[SCN] FAIL");
        document.title="TESTDONE";
        this.scnStep=4;
      }
      return;
    }
    if(this.scnStep===0&&this.state==="surface"&&this.frameCount>140){
      Object.assign(this.flags,{scannerFixed:true,shieldRecharged:true,shipChecked:true,thrusterFixed:true,pulseFixed:true,gotSeal:true});
      this.shipCrashFx=false;
      this.ship.mesh.rotation.set(0,0,0);
      this.shipState.launchFuel=100;
      this.shipState.pulseFuel=100;
      this.inv.add("tritium",100,false);
      this.state="ship";
      this.ui.setMode("ship");
      this.ship.startTakeoff();
      log("[SCN] takeoff started");
      this.scnStep=1;
    }
    else if(this.scnStep===1&&this.state==="ship"&&this.ship.state==="fly"){
      this.ship.pos.y=207;
      log("[SCN] forced altitude 207");
      this.scnStep=2;
    }
    else if(this.scnStep===2&&this.state==="space"&&!this.trans){
      log("[SCN] in space ok, warping to planet1");
      const def=this.planets[1];
      this.ship.pos.copy(def.spacePos).add(new THREE.Vector3(0,def.spaceR*1.05,0));
      this.scnStep=3;
    }
    else if(this.scnStep===3&&this.state==="ship"&&this.planet&&this.planet.id===1&&!this.trans){
      log("[SCN] SUCCESS landed-approach planet=1 shipY="+this.ship.pos.y.toFixed(0));
      log("[SCN] markers="+this.ui.markers.size+" missions="+this.missions.idx);
      document.title="TESTDONE";
      this.scnStep=4;
    }
  }
  loop(now){
    requestAnimationFrame(t=>this.loop(t));
    const dt=Math.min((now-this.last)/1000,0.05);
    this.last=now;
    this.fpsAcc+=dt;this.fpsN++;
    if(this.fpsAcc>0.5){
      this.ui.setFps(Math.round(this.fpsN/this.fpsAcc));
      this.fpsAcc=0;this.fpsN=0;
    }
    if(this.liteDrive){
      this.render(dt);
      return;
    }
    this.step(dt);
    this.render(dt);
    this.input.endFrame();
  }
  step(dt){
    this.frameCount++;
    if(this.autotest)this.updateScenario();
    const input=this.input;
    if(this.inGameplay()&&!this.paused&&!this.uiOpen){
      if(input.pressed.has("Tab"))this.openInventory("inv");
      for(let i=0;i<6;i++){
        if(input.pressed.has("Digit"+(i+1)))this.selectHotbar(i);
      }
      if(input.pressed.has("KeyV")&&(this.state==="ship"||this.state==="space")){
        this.ship.camMode=this.ship.camMode==="chase"?"cockpit":"chase";
        this.audio.uiMove();
      }
    }else if(this.uiOpen){
      if(input.pressed.has("Tab")||input.pressed.has("Escape"))this.closeInventory();
    }
    if(!this.paused&&!this.uiOpen&&this.trans){
      this.updateTransition(dt);
      this.applyShake();
      return;
    }
    if(!this.paused&&!this.uiOpen){
      if(this.state==="surface"){
        this.world.update(this.player.pos.x,this.player.pos.z,2);
        this.env.update(dt,this.player.pos);
        this.player.update(dt,input,this.camera);
        this.creatures.update(dt,this.player.pos);
        this.particles.update(dt);
        this.ship.idleFx(dt);
        if(this.shipCrashFx&&Math.random()<dt*14){
          this.particles.spawn(
            {x:this.ship.pos.x+(Math.random()-0.5),y:this.ship.pos.y+0.8,z:this.ship.pos.z+(Math.random()-0.5)*2},
            {x:(Math.random()-0.5)*0.5,y:1.6+Math.random(),z:(Math.random()-0.5)*0.5},
            {color:0x333940,size:0.3,life:1.8,grav:-0.4,drag:0.02}
          );
        }
        this.updateInteract(dt);
        this.missions.update(dt);
        this.audio.setWind(0.08+(this.planet.hazard.day*0.14)+(this.env.dayFactor<0.3?0.06:0));
      }
      else if(this.state==="ship"){
        this.world.update(this.ship.pos.x,this.ship.pos.z,2);
        this.env.update(dt,this.ship.pos);
        this.particles.update(dt);
        this.creatures.update(dt,this.ship.pos);
        this.ship.updateSurface(dt,input,this.camera);
        if(this.ship.state==="landed"){
          if(input.pressed.has("Space")){
            if(this.shipState.launchFuel>=24){
              if(this.ship.startTakeoff()){
                this.shipState.launchFuel-=24;
                this.missions.event("takeoff");
                this.flags.tookOff=true;
              }
            }else{
              this.ui.notify("起飞推进器","燃料不足 — 需要合成并注入 起飞燃料","warn");
              this.audio.uiError();
            }
          }
        }
        if(this.ship.state==="fly"){
          if(input.pressed.has("KeyE")&&this.ship.pos.y-this.world.heightAt(this.ship.pos.x,this.ship.pos.z)<32&&this.ship.speed<42){
            const gy=this.world.surfaceY(Math.floor(this.ship.pos.x),Math.floor(this.ship.pos.z));
            this.ship.startLanding(gy);
          }
          if(this.ship.pos.y>205){
            if(this.flags.pulseFixed){
              this.startExitTransition();
            }else{
              this.ship.pos.y=205;
              this.ship.pitch=Math.min(this.ship.pitch,0);
              this.ui.notify("脉冲引擎","损坏 — 无法冲出大气层","warn");
            }
          }
        }
        if(this.ship.state==="landed"&&this.prevShipState!=="landed"){
          const ps=this.planetState[this.planet.id];
          if(ps){ps.lastX=Math.floor(this.ship.pos.x);ps.lastZ=Math.floor(this.ship.pos.z);}
          if(this.planet.id!==0)this.missions.event("landOther");
          this.save();
        }
        this.prevShipState=this.ship.state;
        this.updateInteract(dt);
        this.missions.update(dt);
      }
      else if(this.state==="space"){
        this.space.update(dt,this.ship,this.camera);
        this.particles.update(dt);
        this.ship.updateSpace(dt,input,this.camera,this.space);
        this.updateSpaceMarkers();
        const entry=this.space.checkEntry(this.ship.pos);
        if(entry)this.startEnterTransition(entry);
        if(this.shipState.pulseFuel<30&&this.inv.count("tritium")>0){
          const use=Math.min(this.inv.count("tritium"),20);
          this.inv.remove("tritium",use);
          this.shipState.pulseFuel=clamp(this.shipState.pulseFuel+use*2.5,0,100);
          this.ui.notify("脉冲引擎","自动装填 氚 ×"+use,"");
        }
        this.updateInteract(dt);
        this.missions.update(dt);
      }
      this.applyShake();
      if(this.inGameplay()&&!this.lite)this.updateHud(dt);
    }
    if(this.paused&&input.pressed.has("Escape"))this.togglePause(false);
  }
  render(dt){
    if(this.lite)return;
    let scene=null;
    if(this.state==="space"&&this.space)scene=this.space.scene;
    else if(this.surfScene)scene=this.surfScene;
    if(!scene){
      this.renderer.clear();
      return;
    }
    this.renderPass.scene=scene;
    this.renderPass.camera=this.camera;
    this.composer.render();
  }
}

const game=new Game();
window.__game=game;
