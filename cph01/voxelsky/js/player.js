import*as THREE from"three";
import{B,BLOCKS,ITEM_TO_BLOCK}from"./blocks.js";
import{clamp,lerp}from"./util.js";

const PW=0.3,PH=1.8,EYE=1.62;

function makeCrackTextures(){
  const stages=[];
  for(let s=0;s<5;s++){
    const cv=document.createElement("canvas");
    cv.width=16;cv.height=16;
    const c=cv.getContext("2d");
    c.clearRect(0,0,16,16);
    c.strokeStyle="rgba(10,10,10,.85)";
    c.lineWidth=1;
    const rng=(i)=>((Math.sin(i*127.1+s*311.7)*43758.5453)%1+1)%1;
    const n=3+s*3;
    for(let i=0;i<n;i++){
      const x0=rng(i)*16,y0=rng(i+40)*16;
      c.beginPath();
      c.moveTo(x0,y0);
      let x=x0,y=y0;
      for(let j=0;j<3;j++){
        x+=(rng(i*3+j)-0.5)*9;
        y+=(rng(i*7+j+9)-0.5)*9;
        c.lineTo(x,y);
      }
      c.stroke();
    }
    const tex=new THREE.CanvasTexture(cv);
    tex.magFilter=THREE.NearestFilter;
    tex.minFilter=THREE.NearestFilter;
    stages.push(tex);
  }
  return stages;
}

function buildMultitool(){
  const g=new THREE.Group();
  const body=new THREE.MeshLambertMaterial({color:0x3c444e});
  const grip=new THREE.MeshLambertMaterial({color:0x262c33});
  const acc=new THREE.MeshLambertMaterial({color:0x5a646f});
  const glow=new THREE.MeshBasicMaterial({color:0x7ce8e8});
  const parts=[
    [body,[0,0,-0.34],[0.11,0.13,0.5]],
    [acc,[0,0.075,-0.3],[0.08,0.05,0.34]],
    [grip,[0,-0.12,-0.13],[0.075,0.16,0.09]],
    [grip,[0,-0.06,-0.52],[0.06,0.1,0.06]],
    [body,[0,0.01,-0.62],[0.085,0.085,0.12]],
    [glow,[0,0.01,-0.69],[0.05,0.05,0.03]]
  ];
  for(const[mat,pos,scale]of parts){
    const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);
    m.position.set(...pos);
    m.scale.set(...scale);
    g.add(m);
  }
  const tip=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.02,0.02),glow);
  tip.position.set(0,0.01,-0.71);
  g.add(tip);
  g.tip=tip;
  return g;
}

export class Player{
  constructor(game){
    this.g=game;
    this.pos=new THREE.Vector3(8,50,8);
    this.vel=new THREE.Vector3();
    this.yaw=0;this.pitch=0;
    this.onGround=false;
    this.health=100;this.shield=100;this.life=100;
    this.jetFuel=100;
    this.heat=0;this.overheat=0;
    this.mineTarget=null;this.mineProgress=0;
    this.inWater=false;
    this.bob=0;this.bobAmp=0;
    this.fallStart=null;
    this.visor=false;
    this.visorTarget=null;this.visorProgress=0;
    this.baseFov=72;
    this.stepAcc=0;
    this.crackTextures=makeCrackTextures();
    this.crackMat=new THREE.MeshBasicMaterial({map:this.crackTextures[0],transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    this.crackMesh=new THREE.Mesh(new THREE.BoxGeometry(1.002,1.002,1.002),this.crackMat);
    this.crackMesh.visible=false;
    this.viewmodel=buildMultitool();
    this.viewmodel.position.set(0.34,-0.32,-0.55);
    this.beamGeo=new THREE.BoxGeometry(1,1,1);
    this.beamMat=new THREE.MeshBasicMaterial({color:0xff5a3c,transparent:true,opacity:0.85});
    this.beam=new THREE.Mesh(this.beamGeo,this.beamMat);
    this.beam.visible=false;
    this.beam.renderOrder=5;
    this.impact=new THREE.PointLight(0xff7a4a,0,9);
    this.mineToolPower=1;
    this.jetPower=1;
    this.shieldEff=1;
    this.wasFiring=false;
  }
  addTo(scene,camera){
    scene.add(this.crackMesh);
    scene.add(this.beam);
    scene.add(this.impact);
    camera.add(this.viewmodel);
  }
  removeFrom(scene,camera){
    scene.remove(this.crackMesh);
    scene.remove(this.beam);
    scene.remove(this.impact);
    camera.remove(this.viewmodel);
  }
  collides(px,py,pz){
    const w=this.g.world;
    const x0=Math.floor(px-PW),x1=Math.floor(px+PW);
    const y0=Math.floor(py),y1=Math.floor(py+PH);
    const z0=Math.floor(pz-PW),z1=Math.floor(pz+PW);
    for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
      const id=w.getBlock(x,y,z);
      if(id!==B.AIR&&BLOCKS[id].solid)return true;
    }
    return false;
  }
  update(dt,input,camera){
    const g=this.g;
    const w=g.world;
    this.yaw-=input.dx*0.0022*g.settings.sens*(this.visor?0.45:1);
    this.pitch-=input.dy*0.0022*g.settings.sens*(this.visor?0.45:1);
    this.pitch=clamp(this.pitch,-Math.PI/2+0.01,Math.PI/2-0.01);
    const feet=w.getBlock(Math.floor(this.pos.x),Math.floor(this.pos.y+0.3),Math.floor(this.pos.z));
    const headBlock=w.getBlock(Math.floor(this.pos.x),Math.floor(this.pos.y+1.5),Math.floor(this.pos.z));
    this.inWater=BLOCKS[feet]?.water||false;
    this.headUnder=BLOCKS[headBlock]?.water||false;
    let mx=0,mz=0;
    if(input.keys.has("KeyW"))mz-=1;
    if(input.keys.has("KeyS"))mz+=1;
    if(input.keys.has("KeyA"))mx-=1;
    if(input.keys.has("KeyD"))mx+=1;
    const running=input.keys.has("ShiftLeft")&&mz<0;
    const speed=(this.inWater?3.2:running?8.6:5.2);
    const len=Math.hypot(mx,mz)||1;
    mx/=len;mz/=len;
    const sin=Math.sin(this.yaw),cos=Math.cos(this.yaw);
    const wx=(mx*cos+mz*sin)*speed;
    const wz=(-mx*sin+mz*cos)*speed;
    const acc=this.onGround?26:(this.inWater?10:7);
    this.vel.x=lerp(this.vel.x,wx,Math.min(acc*dt,1));
    this.vel.z=lerp(this.vel.z,wz,Math.min(acc*dt,1));
    if(this.inWater){
      this.vel.y-=6*dt;
      this.vel.y*=1-2.4*dt;
      if(input.keys.has("Space"))this.vel.y=lerp(this.vel.y,3.4,Math.min(8*dt,1));
    }else{
      this.vel.y-=24*dt;
      if(input.keys.has("Space")){
        if(this.onGround){
          this.vel.y=8.2;
          this.onGround=false;
          g.audio.jump();
          this.jumpT=0;
        }else if(this.jetFuel>0.5){
          this.vel.y+=42*this.jetPower*dt;
          this.vel.y=Math.min(this.vel.y,7.5);
          this.jetFuel-=30*dt/this.jetPower;
          this.life-=0.4*dt;
          g.audio.startJetpack();
          this.jetting=true;
          if(Math.random()<dt*40){
            g.particles.spawn(
              {x:this.pos.x+sin*0.2,y:this.pos.y+0.6,z:this.pos.z+cos*0.2},
              {x:(Math.random()-0.5)*2,y:-4-Math.random()*2,z:(Math.random()-0.5)*2},
              {color:0x9fdfff,size:0.1,life:0.4,grav:-2}
            );
          }
        }
      }
    }
    if((!input.keys.has("Space")||this.onGround||this.jetFuel<=0.5)&&this.jetting){
      g.audio.stopJetpack();
      this.jetting=false;
    }
    if(this.onGround)this.jetFuel=Math.min(100,this.jetFuel+26*dt);
    if(!this.onGround&&this.vel.y<-3&&this.fallStart===null)this.fallStart=this.pos.y;
    let nx=this.pos.x+this.vel.x*dt;
    if(this.collides(nx,this.pos.y,this.pos.z)){nx=this.pos.x;this.vel.x=0;}
    this.pos.x=nx;
    let nz=this.pos.z+this.vel.z*dt;
    if(this.collides(this.pos.x,this.pos.y,nz)){nz=this.pos.z;this.vel.z=0;}
    this.pos.z=nz;
    let ny=this.pos.y+this.vel.y*dt;
    this.onGround=false;
    if(this.collides(this.pos.x,ny,this.pos.z)){
      if(this.vel.y<0){
        this.onGround=true;
        if(this.fallStart!==null){
          const fall=this.fallStart-this.pos.y;
          if(fall>6){
            const dmg=(fall-6)*4;
            this.hurt(dmg,"坠落伤害");
            g.audio.land(3);
          }else if(fall>1.5)g.audio.land(1);
          this.fallStart=null;
        }
      }else this.vel.y=0;
      ny=this.pos.y;
      this.vel.y=0;
    }
    this.pos.y=ny;
    if(this.pos.y<-10){this.pos.y=90;this.hurt(20,"位面错乱");}
    const hSpeed=Math.hypot(this.vel.x,this.vel.z);
    if(this.onGround&&hSpeed>1){
      this.stepAcc+=hSpeed*dt;
      if(this.stepAcc>2.4){
        this.stepAcc=0;
        const below=w.getBlock(Math.floor(this.pos.x),Math.floor(this.pos.y-0.5),Math.floor(this.pos.z));
        g.audio.footstep(BLOCKS[below]?.mat||"dirt");
      }
      this.bobAmp=lerp(this.bobAmp,running?1.5:1,dt*6);
    }else this.bobAmp=lerp(this.bobAmp,0,dt*8);
    this.bob+=dt*(running?11:8)*(hSpeed>0.5?1:0);
    const hazard=g.planet.hazard;
    const sev=(g.env.dayFactor>0.4?hazard.day:hazard.night)*this.shieldEff;
    if(sev>0){
      this.shield-=sev*1.5*dt;
      if(this.shield<25)g.audio.hazardBeep(this.shield<10?2:1);
    }else{
      this.shield=Math.min(100,this.shield+1.2*dt);
    }
    let lifeDrain=0.35;
    if(running)lifeDrain=0.7;
    if(this.headUnder)lifeDrain=3.2;
    this.life-=lifeDrain*dt;
    if(this.shield<=0){this.shield=0;this.hurt(4.5*dt,null);}
    if(this.life<=0){this.life=0;this.hurt(3.5*dt,null);}
    if(this.shield>40&&this.life>30)this.health=Math.min(100,this.health+0.6*dt);
    if(input.pressed.has("KeyQ")){
      if(this.shield<99){
        if(g.inv.count("sodium")>=20){
          g.inv.remove("sodium",20);
          this.shield=Math.min(100,this.shield+60);
          g.flags.shieldRecharged=true;
          g.missions.event("rechargeShield");
          g.audio.uiConfirm();
          g.ui.notify("危险防护","已使用 钠 ×20 充能","");
        }else{g.ui.notify("危险防护","钠不足 (需要 ×20)","warn");g.audio.uiError();}
      }
    }
    if(input.pressed.has("KeyT")){
      if(this.life<99){
        if(g.inv.count("oxygen")>=15){
          g.inv.remove("oxygen",15);
          this.life=Math.min(100,this.life+70);
          g.audio.uiConfirm();
          g.ui.notify("生命维持","已使用 氧 ×15 充能","");
        }else if(g.inv.count("carbon")>=30){
          g.inv.remove("carbon",30);
          this.life=Math.min(100,this.life+45);
          g.audio.uiConfirm();
          g.ui.notify("生命维持","已使用 碳 ×30 充能","");
        }else{g.ui.notify("生命维持","需要 氧×15 或 碳×30","warn");g.audio.uiError();}
      }
    }
    if(input.pressed.has("KeyC")&&!this.visor)this.scanPulse();
    if(input.pressed.has("KeyF"))this.toggleVisor();
    camera.position.set(
      this.pos.x,
      this.pos.y+EYE+Math.sin(this.bob)*0.05*this.bobAmp,
      this.pos.z
    );
    camera.rotation.set(this.pitch,this.yaw,0,"YXZ");
    const targetFov=this.visor?38:this.baseFov+(running?4:0);
    camera.fov=lerp(camera.fov,targetFov,Math.min(dt*7,1));
    camera.updateProjectionMatrix();
    if(this.visor)this.updateVisor(dt,input,camera);
    else this.updateMining(dt,input,camera);
    this.updateViewmodel(dt);
    if(this.overheat>0)this.overheat-=dt;
    if(!this.firing)this.heat=Math.max(0,this.heat-dt*0.45);
  }
  hurt(dmg,reason){
    if(dmg<=0)return;
    this.health-=dmg;
    if(dmg>1){
      this.g.ui.damageFlash();
      this.g.audio.damage();
      if(reason)this.g.ui.notify("外骨骼警告",reason,"danger");
    }
    if(this.health<=0){
      this.health=0;
      this.g.onPlayerDeath();
    }
  }
  updateMining(dt,input,camera){
    const g=this.g;
    const sel=g.hotbar[g.hotbarSel];
    const dir=new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin=camera.position.clone();
    const hit=g.world.raycast(origin,dir,7);
    this.firing=false;
    if(sel&&sel.type==="item"&&ITEM_TO_BLOCK[sel.id]){
      this.beam.visible=false;
      this.impact.intensity=0;
      this.crackMesh.visible=false;
      g.ui.setMineReticle(false,0,false);
      if(input.mouseRight&&hit&&g.inv.count(sel.id)>0){
        if(!this._placeCd||this._placeCd<=0){
          const px=hit.x+hit.nx,py=hit.y+hit.ny,pz=hit.z+hit.nz;
          const overlap=px+1>this.pos.x-PW&&px<this.pos.x+PW&&pz+1>this.pos.z-PW&&pz<this.pos.z+PW&&py+1>this.pos.y&&py<this.pos.y+PH;
          if(!overlap&&g.world.getBlock(px,py,pz)===B.AIR){
            g.world.setBlock(px,py,pz,ITEM_TO_BLOCK[sel.id]);
            g.inv.remove(sel.id,1);
            g.audio.blockPlace();
          }
          this._placeCd=0.22;
        }
      }
      if(this._placeCd>0)this._placeCd-=dt;
      if(!input.mouseRight)this._placeCd=0;
      return;
    }
    const canMine=hit&&BLOCKS[hit.id].hard>0;
    if(input.mouseLeft&&canMine&&this.overheat<=0){
      this.firing=true;
      g.audio.startBeam();
      const key=hit.x+","+hit.y+","+hit.z;
      if(this.mineTarget!==key){this.mineTarget=key;this.mineProgress=0;}
      const def=BLOCKS[hit.id];
      this.mineProgress+=dt*this.mineToolPower/def.hard;
      this.heat+=dt*0.24;
      const tipPos=this.viewmodel.tip.getWorldPosition(new THREE.Vector3());
      const hitPoint=origin.clone().addScaledVector(dir,hit.dist-0.05);
      const mid=tipPos.clone().lerp(hitPoint,0.5);
      const lenB=tipPos.distanceTo(hitPoint);
      this.beam.visible=true;
      this.beam.position.copy(mid);
      this.beam.scale.set(0.03+Math.random()*0.012,0.03+Math.random()*0.012,lenB);
      this.beam.lookAt(hitPoint);
      this.impact.position.copy(hitPoint);
      this.impact.intensity=2.4+Math.random();
      if(Math.random()<dt*30){
        g.particles.burst(hitPoint,this.blockColor(hit.id),1,2.5,{life:0.35,size:0.06});
      }
      this.crackMesh.visible=true;
      this.crackMesh.position.set(hit.x+0.5,hit.y+0.5,hit.z+0.5);
      const stage=Math.min(4,Math.floor(this.mineProgress*5));
      this.crackMat.map=this.crackTextures[stage];
      if(this.heat>=1){
        this.overheat=2.2;
        this.heat=1;
        g.audio.overheat();
        g.ui.notify("采矿光束","过热！冷却中…","warn");
      }
      if(this.mineProgress>=1){
        this.breakBlock(hit);
        this.mineTarget=null;
        this.mineProgress=0;
      }
    }else{
      if(this.wasFiring)g.audio.stopBeam();
      this.beam.visible=false;
      this.impact.intensity*=0.8;
      this.crackMesh.visible=false;
      this.mineTarget=null;
      this.mineProgress=0;
    }
    this.wasFiring=this.firing;
    g.ui.setMineReticle(canMine&&input.mouseLeft&&this.overheat<=0,this.heat,this.overheat>0);
  }
  blockColor(id){
    const p=this.g.planet.palette;
    const map={
      [B.STONE]:p.stone,[B.DIRT]:p.dirt,[B.GRASS]:p.grass,[B.SAND]:p.sand,
      [B.SNOW]:"#eef4f8",[B.ICE]:"#9cc8e8",[B.WOOD]:p.wood,[B.LEAVES]:p.leaf,
      [B.FERRITE]:"#c8b49a",[B.COPPER]:"#ff9b51",[B.COBALT]:"#5a6cf0",
      [B.SODIUM]:"#f5c542",[B.OXYGEN]:"#e8474d",[B.DIHYDRO]:"#4d8fe8",
      [B.TUFT]:p.grass,[B.FLOWER]:"#e88bd0",[B.BRICK]:"#9a9a9a",[B.PANEL]:"#aeb9c2",
      [B.GLASS]:"#cfe8f0",[B.LIGHT]:"#fff3c4",[B.PLANKS]:"#c49a6c",[B.CACTUS]:"#3d8a4a"
    };
    return new THREE.Color(map[id]||"#999999").getHex();
  }
  breakBlock(hit){
    const g=this.g;
    const def=BLOCKS[hit.id];
    g.world.setBlock(hit.x,hit.y,hit.z,B.AIR);
    g.audio.blockBreak(def.mat);
    g.particles.burst({x:hit.x+0.5,y:hit.y+0.5,z:hit.z+0.5},this.blockColor(hit.id),14,4.5);
    if(def.drop){
      const n=def.drop.n[0]+Math.floor(Math.random()*(def.drop.n[1]-def.drop.n[0]+1));
      const boosted=Math.round(n*(g.tech.beamAmp?1.5:1));
      if(def.drop.res)g.inv.add(def.drop.res,boosted,true);
      else if(def.drop.item)g.inv.add(def.drop.item,n,true);
    }
    if(def.res)g.missions.event("mine",hit.id);
  }
  scanPulse(){
    const g=this.g;
    if(!g.flags.scannerFixed){
      g.ui.notify("扫描仪","已损坏 — 需要 铁尘 修复","warn");
      g.audio.uiError();
      return;
    }
    g.audio.scanPulse();
    g.ui.scanPulseFx();
    const found=[];
    const px=Math.floor(this.pos.x),pz=Math.floor(this.pos.z);
    const R=52;
    const resBlocks=[B.SODIUM,B.OXYGEN,B.DIHYDRO,B.FERRITE,B.COPPER,B.COBALT];
    for(let dz=-R;dz<=R;dz+=2)for(let dx=-R;dx<=R;dx+=2){
      if(dx*dx+dz*dz>R*R)continue;
      const x=px+dx,z=pz+dz;
      const y0=Math.max(1,g.world.heightAt(x,z)-2);
      for(let y=y0;y<y0+8;y++){
        const id=g.world.getBlock(x,y,z);
        if(resBlocks.includes(id)){
          found.push({x:x+0.5,y:y+0.5,z:z+0.5,id});
          break;
        }
      }
    }
    found.sort((a,b)=>{
      const da=(a.x-this.pos.x)**2+(a.z-this.pos.z)**2;
      const db=(b.x-this.pos.x)**2+(b.z-this.pos.z)**2;
      return da-db;
    });
    const names={[B.SODIUM]:["钠","#f5c542","Na"],[B.OXYGEN]:["氧","#e8474d","O"],[B.DIHYDRO]:["二氢","#5aa6f0","H"],[B.FERRITE]:["铁尘","#c8b49a","Fe"],[B.COPPER]:["铜","#ff9b51","Cu"],[B.COBALT]:["钴","#5a6cf0","Co"]};
    const seen={};
    let added=0;
    for(const f of found){
      const info=names[f.id];
      seen[f.id]=(seen[f.id]||0)+1;
      if(seen[f.id]>3)continue;
      g.ui.addMarker({
        id:"res"+f.x+"_"+f.y+"_"+f.z,
        kind:"res",
        pos:new THREE.Vector3(f.x,f.y,f.z),
        icon:info[2],label:info[0],
        ttl:14
      });
      added++;
      if(added>10)break;
    }
    if(added===0)g.ui.notify("扫描仪","附近未发现资源信号","warn");
  }
  toggleVisor(){
    if(!this.g.flags.scannerFixed){
      this.g.ui.notify("分析目镜","已损坏 — 需要修复扫描仪","warn");
      this.g.audio.uiError();
      return;
    }
    this.visor=!this.visor;
    this.g.ui.setVisor(this.visor);
    this.g.audio.uiOpen();
    if(!this.visor){this.visorTarget=null;this.visorProgress=0;}
  }
  updateVisor(dt,input,camera){
    const g=this.g;
    this.beam.visible=false;
    this.crackMesh.visible=false;
    this.impact.intensity=0;
    g.ui.setMineReticle(false,0,false);
    if(this.wasFiring){g.audio.stopBeam();this.wasFiring=false;}
    let target=null;
    const ct=g.creatures?g.creatures.findTarget(camera,60):null;
    if(ct){
      target={kind:"creature",key:"c"+ct.creature.sp.id,name:ct.creature.sp.name,obj:ct.creature,dist:ct.dist,
        scanned:ct.creature.sp.scanned,value:ct.creature.sp.value};
    }else{
      const dir=new THREE.Vector3();
      camera.getWorldDirection(dir);
      const hit=g.world.raycast(camera.position.clone(),dir,44);
      if(hit&&BLOCKS[hit.id].res){
        const key="b"+hit.id;
        target={kind:"flora",key,name:BLOCKS[hit.id].name,dist:hit.dist,
          scanned:g.discovered.has(g.planet.id+key),value:60};
      }
    }
    if(target&&this.visorTarget&&target.key===this.visorTarget.key){
      if(!target.scanned){
        this.visorProgress+=dt/1.3;
        if(Math.floor(this.visorProgress*8)!==Math.floor((this.visorProgress-dt/1.3)*8))g.audio.visorTick();
        if(this.visorProgress>=1){
          this.visorProgress=1;
          this.completeScan(target);
        }
      }else this.visorProgress=1;
    }else{
      this.visorProgress=target&&target.scanned?1:0;
    }
    this.visorTarget=target;
    g.ui.setVisorTarget(target,this.visorProgress);
    g.ui.setVisorReadout(g.planet,this.pos);
  }
  completeScan(target){
    const g=this.g;
    g.audio.scanDone();
    if(target.kind==="creature"){
      target.obj.sp.scanned=true;
      const units=target.obj.sp.value*3;
      g.addUnits(units);
      g.addDiscovery({type:"生物",icon:"⭘",name:target.obj.sp.name,value:units});
      g.ui.notify("发现新物种",target.obj.sp.name+" · +"+units+" 单位","");
      g.audio.discovery();
      g.missions.event("scan","creature");
    }else{
      g.discovered.add(g.planet.id+target.key);
      const units=120;
      g.addUnits(units);
      g.addDiscovery({type:"资源",icon:"◆",name:target.name,value:units});
      g.ui.notify("资源已分析",target.name+" · +"+units+" 单位","");
      g.missions.event("scan","flora");
    }
  }
  updateViewmodel(dt){
    const t=performance.now()*0.001;
    const vm=this.viewmodel;
    vm.visible=!this.visor&&this.g.state==="surface";
    const bobX=Math.sin(this.bob)*0.012*this.bobAmp;
    const bobY=Math.abs(Math.cos(this.bob))*0.014*this.bobAmp;
    const recoil=this.firing?Math.sin(t*60)*0.004:0;
    vm.position.set(0.34+bobX,-0.32-bobY+recoil,-0.55+(this.firing?0.012:0));
    vm.rotation.set(this.firing?0.02:0,0,bobX*2);
    if(vm.tip)vm.tip.material.color.setHex(this.overheat>0?0xff5a3c:0x7ce8e8);
  }
}
