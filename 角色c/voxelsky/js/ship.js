import*as THREE from"three";
import{clamp,lerp,easeInOut,easeOut}from"./util.js";

function box(mat,x,y,z,sx,sy,sz,parent){
  const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);
  m.position.set(x,y,z);
  m.scale.set(sx,sy,sz);
  parent.add(m);
  return m;
}
function makeGlowTex(){
  const cv=document.createElement("canvas");
  cv.width=64;cv.height=64;
  const c=cv.getContext("2d");
  const g=c.createRadialGradient(32,32,2,32,32,32);
  g.addColorStop(0,"rgba(255,255,255,1)");
  g.addColorStop(0.25,"rgba(140,230,255,.9)");
  g.addColorStop(0.6,"rgba(70,150,255,.35)");
  g.addColorStop(1,"rgba(40,90,255,0)");
  c.fillStyle=g;
  c.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(cv);
}

export function buildShip(){
  const group=new THREE.Group();
  const hull=new THREE.MeshLambertMaterial({color:0xdfe6ea});
  const hull2=new THREE.MeshLambertMaterial({color:0x9aa7b0});
  const dark=new THREE.MeshLambertMaterial({color:0x2c343c});
  const accent=new THREE.MeshLambertMaterial({color:0xff8f3c});
  const glass=new THREE.MeshLambertMaterial({color:0x9fdcec,transparent:true,opacity:0.55,emissive:0x1c3844});
  const engineMat=new THREE.MeshBasicMaterial({color:0x8ce6ff});
  box(hull,0,0.1,0.3,1.15,0.75,3.4,group);
  box(hull2,0,-0.18,0.2,1.5,0.42,2.6,group);
  box(hull,0,0.16,-1.9,0.9,0.55,1.4,group);
  box(dark,0,0.18,-2.72,0.6,0.34,0.5,group);
  box(accent,0,0.02,-2.35,0.98,0.12,0.8,group);
  box(glass,0,0.62,-0.65,0.72,0.5,1.15,group);
  box(dark,0,0.62,-1.28,0.76,0.42,0.12,group);
  box(hull,0,0.58,0.65,0.9,0.5,1.6,group);
  box(accent,0,0.86,0.85,0.4,0.14,1.2,group);
  box(dark,0,0.25,1.98,1.0,0.62,0.5,group);
  for(const s of[-1,1]){
    box(hull,s*1.55,0.02,0.5,2.0,0.14,1.5,group).rotation.z=s*-0.1;
    box(hull2,s*2.6,0.14,0.75,0.9,0.1,1.05,group).rotation.z=s*-0.22;
    box(accent,s*2.98,0.22,0.75,0.16,0.3,1.1,group).rotation.z=s*-0.22;
    box(dark,s*1.5,-0.02,1.5,0.55,0.4,1.15,group);
    box(hull2,s*0.72,0.34,1.6,0.5,0.45,1.15,group);
    box(dark,s*0.72,0.34,2.2,0.42,0.36,0.24,group);
  }
  const engines=[];
  const e1=box(engineMat,0,0.25,2.26,0.72,0.4,0.1,group);
  engines.push(e1);
  for(const s of[-1,1]){
    engines.push(box(engineMat,s*1.5,-0.02,2.1,0.4,0.28,0.1,group));
    engines.push(box(engineMat,s*0.72,0.34,2.34,0.3,0.26,0.08,group));
  }
  const glowTex=makeGlowTex();
  const glows=[];
  for(const e of engines){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0x9fe6ff,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));
    sp.position.copy(e.position);
    sp.position.z+=0.35;
    sp.scale.setScalar(0.9);
    group.add(sp);
    glows.push(sp);
  }
  const gear=[];
  for(const[gx,gz]of[[-0.85,0.9],[0.85,0.9],[0,-1.6]]){
    const leg=new THREE.Group();
    leg.position.set(gx,-0.4,gz);
    box(dark,0,-0.35,0,0.14,0.7,0.14,leg);
    box(hull2,0,-0.75,0,0.4,0.12,0.55,leg);
    group.add(leg);
    gear.push(leg);
  }
  const lightL=new THREE.PointLight(0x8ce6ff,0,18);
  lightL.position.set(0,0.2,2.4);
  group.add(lightL);
  group.traverse(o=>{if(o.isMesh)o.castShadow=false;});
  return{group,engines,glows,gear,engineLight:lightL,glowTex};
}

export class Ship{
  constructor(game){
    this.g=game;
    const built=buildShip();
    this.mesh=built.group;
    this.engines=built.engines;
    this.glows=built.glows;
    this.gear=built.gear;
    this.engineLight=built.engineLight;
    this.pos=new THREE.Vector3();
    this.quat=new THREE.Quaternion();
    this.yaw=0;this.pitch=0;this.roll=0;
    this.speed=0;
    this.throttle=0;
    this.boost=0;
    this.state="landed";
    this.animT=0;
    this.camMode="chase";
    this.pulse=0;
    this.pulseCharge=0;
    this.pulsing=false;
    this.trailT=0;
    this.projectiles=[];
    const pgeo=new THREE.BoxGeometry(0.14,0.14,2.4);
    const pmat=new THREE.MeshBasicMaterial({color:0xffd27a});
    this.projMesh=new THREE.InstancedMesh(pgeo,pmat,24);
    this.projMesh.frustumCulled=false;
    this.projDummy=new THREE.Object3D();
    this.zeroMat=new THREE.Matrix4().makeScale(0,0,0);
    for(let i=0;i<24;i++)this.projMesh.setMatrixAt(i,this.zeroMat);
    this.shootCd=0;
    this.camPos=new THREE.Vector3();
    this.camInit=false;
  }
  addTo(scene){
    scene.add(this.mesh);
    scene.add(this.projMesh);
  }
  removeFrom(scene){
    scene.remove(this.mesh);
    scene.remove(this.projMesh);
  }
  placeLanded(x,y,z,yaw){
    this.pos.set(x,y,z);
    this.yaw=yaw;this.pitch=0;this.roll=0;
    this.speed=0;this.throttle=0;
    this.state="landed";
    this.setGear(1);
    this.updateTransform();
  }
  setGear(t){
    for(const leg of this.gear){
      leg.scale.y=Math.max(t,0.01);
      leg.visible=t>0.05;
    }
  }
  updateTransform(){
    const e=new THREE.Euler(this.pitch,this.yaw,this.roll,"YXZ");
    this.quat.setFromEuler(e);
    this.mesh.position.copy(this.pos);
    this.mesh.quaternion.copy(this.quat);
  }
  forward(){
    return new THREE.Vector3(0,0,-1).applyQuaternion(this.quat);
  }
  engineFx(dt,power){
    const s=0.5+power*1.6+this.boost*0.9+(Math.random()*0.12);
    for(const gl of this.glows){
      gl.scale.setScalar(s*(0.7+Math.random()*0.25));
      gl.material.opacity=clamp(0.25+power*0.75,0,1);
    }
    this.engineLight.intensity=power*3+this.boost*3;
    this.g.audio.setShip(this.throttle,this.boost);
    this.trailT+=dt;
    if(power>0.25&&this.trailT>0.028){
      this.trailT=0;
      const back=this.forward().multiplyScalar(-1);
      const base=this.pos.clone().addScaledVector(back,2.6);
      this.g.particles.spawn(
        {x:base.x+(Math.random()-0.5)*0.8,y:base.y+(Math.random()-0.5)*0.5,z:base.z+(Math.random()-0.5)*0.8},
        {x:back.x*6,y:back.y*6,z:back.z*6},
        {color:this.pulsing?0xd0b8ff:0x8ce6ff,size:0.16,life:0.5,grav:0,drag:0.04}
      );
    }
  }
  startTakeoff(){
    if(this.state!=="landed")return false;
    this.state="takeoff";
    this.animT=0;
    this.baseY=this.pos.y;
    this.g.audio.takeoff();
    this.g.audio.startShip();
    const p=this.pos;
    this.g.particles.dust({x:p.x,y:p.y-1.5,z:p.z},0xccbbaa,30,3.5);
    return true;
  }
  startLanding(groundY){
    if(this.state!=="fly")return false;
    this.state="landing";
    this.animT=0;
    this.landFrom=this.pos.clone();
    this.landTo=new THREE.Vector3(Math.round(this.pos.x)+0.5,groundY+1.15,Math.round(this.pos.z)+0.5);
    this.landYawFrom=this.yaw;
    this.g.audio.landingGear();
    return true;
  }
  updateSurface(dt,input,camera){
    const g=this.g;
    if(this.state==="landed"){
      this.setGear(1);
      this.idleFx(dt);
      this.updateTransform();
      this.chaseCam(dt,camera,true);
      g.ui.setFlight({
        speed:0,alt:0,thr:0,
        pulseTxt:g.flags.pulseFixed?"就绪":"损坏",
        pulseFill:g.shipState.pulseFuel/100,
        fuel:g.shipState.launchFuel/100,
        warn:"空格 点火起飞 · 按住 E 离开飞船"
      });
      return;
    }
    if(this.state==="takeoff"){
      this.animT+=dt;
      const t=clamp(this.animT/1.7,0,1);
      this.pos.y=this.baseY+easeOut(t)*13;
      this.setGear(1-clamp(t*1.6,0,1));
      this.pitch=lerp(this.pitch,-0.12,t*0.4);
      this.engineFx(dt,1);
      if(t>=1){
        this.state="fly";
        this.throttle=0.35;
        this.speed=14;
      }
      this.updateTransform();
      this.chaseCam(dt,camera,true);
      return;
    }
    if(this.state==="landing"){
      this.animT+=dt;
      const t=clamp(this.animT/1.9,0,1);
      const e=easeInOut(t);
      this.pos.lerpVectors(this.landFrom,this.landTo,e);
      this.pitch=lerp(this.pitch,0,Math.min(dt*4,1));
      this.roll=lerp(this.roll,0,Math.min(dt*4,1));
      this.setGear(clamp((t-0.3)*2.2,0,1));
      this.engineFx(dt,0.5*(1-t));
      if(t>=1){
        this.state="landed";
        this.throttle=0;this.speed=0;
        g.audio.touchdown();
        g.audio.stopShip();
        g.particles.dust({x:this.pos.x,y:this.pos.y-1.1,z:this.pos.z},0xccbbaa,26,3);
        g.ui.notify("飞船","着陆完成","");
      }
      this.updateTransform();
      this.chaseCam(dt,camera,true);
      return;
    }
    const sens=g.settings.sens;
    this.yaw-=input.dx*0.0011*sens;
    this.pitch=clamp(this.pitch+input.dy*0.0011*sens,-0.9,0.9);
    const targetRoll=clamp(input.dx*0.02,-0.85,0.85);
    this.roll=lerp(this.roll,targetRoll,Math.min(dt*3.5,1));
    if(input.keys.has("KeyA"))this.roll=lerp(this.roll,0.9,Math.min(dt*2,1));
    if(input.keys.has("KeyD"))this.roll=lerp(this.roll,-0.9,Math.min(dt*2,1));
    this.yaw+=this.roll*0.55*dt;
    if(input.keys.has("KeyW"))this.throttle=clamp(this.throttle+dt*0.7,0,1);
    if(input.keys.has("KeyS"))this.throttle=clamp(this.throttle-dt*0.9,0,1);
    this.boost=lerp(this.boost,input.keys.has("Space")&&this.throttle>0.2?1:0,Math.min(dt*3,1));
    if(input.pressed.has("Space")&&this.throttle>0.2)g.audio.boost();
    const targetSpeed=this.throttle*46+this.boost*52;
    this.speed=lerp(this.speed,Math.max(targetSpeed,10),Math.min(dt*1.6,1));
    const fwd=this.forward();
    this.pos.addScaledVector(fwd,this.speed*dt);
    const groundH=g.world.heightAt(this.pos.x,this.pos.z);
    const minY=groundH+3;
    if(this.pos.y<minY){
      this.pos.y=lerp(this.pos.y,minY,Math.min(dt*6,1));
      if(this.pitch>0.15)this.pitch=lerp(this.pitch,0.1,Math.min(dt*5,1));
    }
    this.engineFx(dt,Math.max(this.throttle,0.3));
    this.updateTransform();
    this.chaseCam(dt,camera,false);
    const alt=this.pos.y-groundH;
    const canLand=alt<30&&this.speed<40;
    let warn=null;
    if(this.pos.y>185)warn=g.flags.pulseFixed?"高度警戒 — 即将脱离大气层":"脉冲引擎损坏 — 无法离开大气层";
    else if(canLand)warn="按 E 着陆";
    g.ui.setFlight({
      speed:Math.round(this.speed*3.6),
      alt:Math.max(0,Math.round(alt)),
      thr:this.throttle,
      pulseTxt:"大气层内不可用",
      pulseFill:g.shipState.pulseFuel/100,
      fuel:g.shipState.launchFuel/100,
      warn
    });
  }
  updateSpace(dt,input,camera,space){
    const g=this.g;
    const sens=g.settings.sens;
    this.yaw-=input.dx*0.0009*sens;
    this.pitch=clamp(this.pitch+input.dy*0.0009*sens,-Math.PI*0.49,Math.PI*0.49);
    const targetRoll=clamp(input.dx*0.018,-0.7,0.7);
    let rollTarget=targetRoll;
    if(input.keys.has("KeyA"))rollTarget=1.1;
    if(input.keys.has("KeyD"))rollTarget=-1.1;
    this.roll=lerp(this.roll,rollTarget,Math.min(dt*2.6,1));
    this.yaw+=this.roll*0.5*dt;
    if(input.keys.has("KeyW"))this.throttle=clamp(this.throttle+dt*0.6,0,1);
    if(input.keys.has("KeyS"))this.throttle=clamp(this.throttle-dt*0.8,0.05,1);
    this.boost=lerp(this.boost,input.keys.has("Space")?1:0,Math.min(dt*3,1));
    if(input.pressed.has("Space"))g.audio.boost();
    if(input.keys.has("KeyF")&&g.shipState.pulseFuel>0.5&&!this.pulsing){
      this.pulseCharge+=dt;
      if(this.pulseCharge>0.9){
        this.pulsing=true;
        this.pulseCharge=0;
        g.audio.startPulse();
        g.ui.speedLines(true);
      }
      if(this.pulseCharge>0.05&&this.pulseCharge<0.1)g.audio.pulseCharge();
    }else if(!input.keys.has("KeyF")){
      this.pulseCharge=0;
    }
    if(this.pulsing){
      if(!input.keys.has("KeyF")||g.shipState.pulseFuel<=0){
        this.stopPulse();
      }else{
        g.shipState.pulseFuel-=dt*3.2;
        const wellPlanet=space.inGravityWell(this.pos);
        if(wellPlanet){
          this.stopPulse();
          g.ui.notify("脉冲引擎","检测到行星引力井 — 自动脱离脉冲","warn");
        }
      }
    }
    const baseSpeed=8+this.throttle*54+this.boost*70;
    const speedTarget=this.pulsing?2300:baseSpeed;
    this.speed=lerp(this.speed,speedTarget,Math.min(dt*(this.pulsing?1.1:1.8),1));
    const fwd=this.forward();
    this.pos.addScaledVector(fwd,this.speed*dt);
    this.engineFx(dt,Math.max(this.throttle,0.25)+(this.pulsing?0.8:0));
    this.updateTransform();
    this.chaseCam(dt,camera,false,this.pulsing);
    if(this.shootCd>0)this.shootCd-=dt;
    if(input.mouseLeft&&this.shootCd<=0&&!this.pulsing){
      this.shootCd=0.16;
      g.audio.shoot();
      for(const s of[-1,1]){
        const side=new THREE.Vector3(s*2.6,0.2,0).applyQuaternion(this.quat);
        this.projectiles.push({
          pos:this.pos.clone().add(side),
          vel:fwd.clone().multiplyScalar(320+this.speed),
          life:1.6
        });
      }
      if(this.projectiles.length>24)this.projectiles.splice(0,2);
    }
    let pi=0;
    for(const p of this.projectiles){
      p.life-=dt;
      p.pos.addScaledVector(p.vel,dt);
      if(p.life>0&&space){
        const hit=space.checkAsteroidHit(p.pos,3);
        if(hit){
          p.life=0;
          g.audio.asteroidCrack();
          g.particles.burst(p.pos,0xbfae94,16,10,{grav:0});
          const n=2+Math.floor(Math.random()*4);
          g.inv.add("tritium",n,true);
          if(hit.destroyed){
            g.audio.explosion();
            g.particles.burst(p.pos,0x8a7f6a,26,16,{grav:0});
            g.missions.event("asteroid");
          }
        }
      }
    }
    this.projectiles=this.projectiles.filter(p=>p.life>0);
    for(const p of this.projectiles){
      this.projDummy.position.copy(p.pos);
      this.projDummy.quaternion.copy(this.quat);
      this.projDummy.updateMatrix();
      this.projMesh.setMatrixAt(pi++,this.projDummy.matrix);
    }
    for(let i=pi;i<24;i++)this.projMesh.setMatrixAt(i,this.zeroMat);
    this.projMesh.instanceMatrix.needsUpdate=true;
    const tgt=space.nearestPlanet(this.pos);
    g.ui.setFlight({
      speed:Math.round(this.speed*(this.pulsing?1:3.6)),
      speedUnit:this.pulsing?"ku/s":"u/s",
      alt:null,
      thr:this.throttle,
      pulseTxt:this.pulsing?"脉冲飞行中":(this.pulseCharge>0?"充能中…":"按住 F 脉冲飞行"),
      pulseFill:g.shipState.pulseFuel/100,
      fuel:g.shipState.launchFuel/100,
      target:tgt?{name:tgt.def.name,dist:tgt.dist}:null,
      warn:this.pulseCharge>0.05?"— 脉冲引擎充能 —":null
    });
  }
  stopPulse(){
    if(!this.pulsing)return;
    this.pulsing=false;
    this.g.audio.stopPulse();
    this.g.audio.pulseDrop();
    this.g.ui.speedLines(false);
  }
  chaseCam(dt,camera,slow=false,pulsing=false){
    if(this.camMode==="cockpit"){
      const eye=this.pos.clone()
        .add(new THREE.Vector3(0,0.78,-0.5).applyQuaternion(this.quat));
      camera.position.copy(eye);
      camera.quaternion.copy(this.quat);
      this.mesh.visible=false;
      camera.fov=lerp(camera.fov,pulsing?96:78,Math.min(dt*4,1));
      camera.updateProjectionMatrix();
      return;
    }
    this.mesh.visible=true;
    const back=new THREE.Vector3(0,2.4,9.5).applyQuaternion(this.quat);
    const want=this.pos.clone().add(back);
    if(!this.camInit){this.camPos.copy(want);this.camInit=true;}
    this.camPos.lerp(want,Math.min(dt*(slow?3:6),1));
    camera.position.copy(this.camPos);
    const look=this.pos.clone().addScaledVector(this.forward(),8);
    camera.lookAt(look);
    camera.fov=lerp(camera.fov,pulsing?100:(72+this.boost*10),Math.min(dt*4,1));
    camera.updateProjectionMatrix();
  }
  idleFx(dt){
    for(const gl of this.glows){
      gl.scale.setScalar(0.35+Math.sin(performance.now()*0.004)*0.06);
      gl.material.opacity=0.25;
    }
    this.engineLight.intensity=0.4;
  }
}
