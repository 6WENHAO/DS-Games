import*as THREE from"three";
import{mulberry32,genCreatureName,clamp,pick}from"./util.js";

export class Particles{
  constructor(scene,max=320){
    this.max=max;
    const geo=new THREE.BoxGeometry(1,1,1);
    const mat=new THREE.MeshBasicMaterial({color:0xffffff});
    this.mesh=new THREE.InstancedMesh(geo,mat,max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled=false;
    this.mesh.count=max;
    scene.add(this.mesh);
    this.parts=[];
    this.dummy=new THREE.Object3D();
    this.zero=new THREE.Matrix4().makeScale(0,0,0);
    for(let i=0;i<max;i++)this.mesh.setMatrixAt(i,this.zero);
    this.mesh.instanceMatrix.needsUpdate=true;
    this.col=new THREE.Color();
  }
  spawn(pos,vel,opts={}){
    if(this.parts.length>=this.max)this.parts.shift();
    this.parts.push({
      x:pos.x,y:pos.y,z:pos.z,
      vx:vel.x,vy:vel.y,vz:vel.z,
      life:opts.life||0.8,age:0,
      size:opts.size||0.12,
      grav:opts.grav??14,
      drag:opts.drag??0.02,
      color:opts.color||0xffffff,
      shrink:opts.shrink??true
    });
  }
  burst(pos,color,n=12,speed=4,opts={}){
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2,b=Math.random()*Math.PI-Math.PI/2;
      const s=speed*(0.4+Math.random()*0.8);
      this.spawn(pos,{
        x:Math.cos(a)*Math.cos(b)*s,
        y:Math.sin(b)*s+speed*0.4,
        z:Math.sin(a)*Math.cos(b)*s
      },{color,size:0.09+Math.random()*0.12,life:0.5+Math.random()*0.6,...opts});
    }
  }
  dust(pos,color,n=16,r=2){
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2;
      this.spawn({x:pos.x+Math.cos(a)*r*Math.random(),y:pos.y+0.2,z:pos.z+Math.sin(a)*r*Math.random()},
        {x:Math.cos(a)*3,y:1+Math.random()*2,z:Math.sin(a)*3},
        {color,size:0.18+Math.random()*0.2,life:0.8+Math.random()*0.8,grav:2,shrink:true});
    }
  }
  update(dt){
    let i=0;
    for(let p of this.parts){
      p.age+=dt;
    }
    this.parts=this.parts.filter(p=>p.age<p.life);
    for(const p of this.parts){
      p.vy-=p.grav*dt;
      const dr=1-p.drag;
      p.vx*=dr;p.vy*=dr;p.vz*=dr;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      const t=1-p.age/p.life;
      const s=p.size*(p.shrink?Math.max(t,0.05):1);
      this.dummy.position.set(p.x,p.y,p.z);
      this.dummy.rotation.set(p.age*3,p.age*4,0);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i,this.dummy.matrix);
      this.mesh.setColorAt(i,this.col.set(p.color));
      i++;
    }
    for(let j=i;j<this.max;j++)this.mesh.setMatrixAt(j,this.zero);
    this.mesh.instanceMatrix.needsUpdate=true;
    if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
  }
  dispose(scene){
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

function buildCreatureMesh(sp){
  const g=new THREE.Group();
  const mat1=new THREE.MeshLambertMaterial({color:sp.color1});
  const mat2=new THREE.MeshLambertMaterial({color:sp.color2});
  const dark=new THREE.MeshLambertMaterial({color:0x14161a});
  const body=new THREE.Mesh(new THREE.BoxGeometry(sp.bodyW,sp.bodyH,sp.bodyL),mat1);
  body.position.y=sp.legH+sp.bodyH/2;
  g.add(body);
  const back=new THREE.Mesh(new THREE.BoxGeometry(sp.bodyW*0.7,sp.bodyH*0.5,sp.bodyL*0.5),mat2);
  back.position.set(0,sp.legH+sp.bodyH+sp.bodyH*0.24,-sp.bodyL*0.15);
  g.add(back);
  const head=new THREE.Mesh(new THREE.BoxGeometry(sp.headS,sp.headS,sp.headS),mat2);
  head.position.set(0,sp.legH+sp.bodyH*0.85,sp.bodyL/2+sp.headS/2-0.05);
  g.add(head);
  const eyeS=sp.headS*0.18;
  for(const sx of[-1,1]){
    const eye=new THREE.Mesh(new THREE.BoxGeometry(eyeS,eyeS,eyeS*0.4),dark);
    eye.position.set(sx*sp.headS*0.26,head.position.y+sp.headS*0.1,head.position.z+sp.headS/2);
    g.add(eye);
  }
  if(sp.horn){
    const horn=new THREE.Mesh(new THREE.BoxGeometry(sp.headS*0.16,sp.headS*0.7,sp.headS*0.16),mat1);
    horn.position.set(0,head.position.y+sp.headS*0.8,head.position.z);
    g.add(horn);
  }
  if(sp.ears){
    for(const sx of[-1,1]){
      const ear=new THREE.Mesh(new THREE.BoxGeometry(sp.headS*0.2,sp.headS*0.5,sp.headS*0.14),mat1);
      ear.position.set(sx*sp.headS*0.35,head.position.y+sp.headS*0.68,head.position.z-sp.headS*0.2);
      g.add(ear);
    }
  }
  const tail=new THREE.Mesh(new THREE.BoxGeometry(sp.bodyW*0.25,sp.bodyW*0.25,sp.bodyL*0.6),mat2);
  tail.position.set(0,sp.legH+sp.bodyH*0.7,-sp.bodyL/2-sp.bodyL*0.25);
  g.add(tail);
  const legs=[];
  const lw=sp.bodyW*0.22;
  const positions=sp.legs===2?
    [[0,-sp.bodyL*0.1],[0,sp.bodyL*0.22]]:
    [[-sp.bodyW*0.32,sp.bodyL*0.3],[sp.bodyW*0.32,sp.bodyL*0.3],[-sp.bodyW*0.32,-sp.bodyL*0.3],[sp.bodyW*0.32,-sp.bodyL*0.3]];
  for(const[lx,lz]of positions){
    const pivot=new THREE.Group();
    pivot.position.set(lx,sp.legH,lz);
    const leg=new THREE.Mesh(new THREE.BoxGeometry(lw,sp.legH,lw),mat2);
    leg.position.y=-sp.legH/2;
    pivot.add(leg);
    g.add(pivot);
    legs.push(pivot);
  }
  return{group:g,legs,body,head,tail};
}

export class CreatureSystem{
  constructor(scene,world,planet,audio){
    this.scene=scene;
    this.world=world;
    this.planet=planet;
    this.audio=audio;
    this.creatures=[];
    this.maxCreatures=planet.fauna>0?8:0;
    const rng=mulberry32(planet.seed+404);
    this.species=[];
    for(let i=0;i<planet.fauna;i++){
      const size=0.5+rng()*1.3;
      this.species.push({
        id:i,
        name:genCreatureName(rng)+" "+pick(rng,["行者","啸兽","掠影","足兽","晶角兽","雾行者","跳跃者"]),
        bodyW:size*(0.6+rng()*0.3),
        bodyH:size*(0.5+rng()*0.3),
        bodyL:size*(0.9+rng()*0.5),
        headS:size*(0.4+rng()*0.25),
        legH:size*(0.4+rng()*0.5),
        legs:rng()<0.4?2:4,
        color1:new THREE.Color().setHSL(rng(),0.45+rng()*0.3,0.4+rng()*0.2).getHex(),
        color2:new THREE.Color().setHSL(rng(),0.4+rng()*0.3,0.28+rng()*0.2).getHex(),
        horn:rng()<0.45,
        ears:rng()<0.6,
        speed:1.6+rng()*1.8,
        callSeed:rng(),
        value:180+Math.floor(rng()*220),
        scanned:false
      });
    }
  }
  trySpawn(playerPos){
    if(this.creatures.length>=this.maxCreatures||this.species.length===0)return;
    const a=Math.random()*Math.PI*2;
    const d=34+Math.random()*46;
    const x=Math.floor(playerPos.x+Math.cos(a)*d);
    const z=Math.floor(playerPos.z+Math.sin(a)*d);
    const y=this.world.surfaceY(x,z);
    if(y<=this.planet.seaLevel+1)return;
    const sp=this.species[Math.floor(Math.random()*this.species.length)];
    const{group,legs,head,tail}=buildCreatureMesh(sp);
    group.position.set(x+0.5,y,z+0.5);
    const s=0.85+Math.random()*0.3;
    group.scale.setScalar(s);
    this.scene.add(group);
    this.creatures.push({
      sp,group,legs,head,tail,
      x:x+0.5,y,z:z+0.5,
      yaw:Math.random()*Math.PI*2,
      state:"idle",t:1+Math.random()*3,
      walkPhase:0,callT:4+Math.random()*14
    });
  }
  update(dt,playerPos){
    if(Math.random()<dt*0.5)this.trySpawn(playerPos);
    const remove=[];
    for(const c of this.creatures){
      const dx=c.x-playerPos.x,dz=c.z-playerPos.z;
      const dist=Math.hypot(dx,dz);
      if(dist>110){remove.push(c);continue;}
      c.t-=dt;
      c.callT-=dt;
      if(c.callT<=0){
        c.callT=6+Math.random()*18;
        this.audio.creatureCall(c.sp.callSeed,dist);
      }
      if(dist<5&&c.state!=="flee"){
        c.state="flee";
        c.yaw=Math.atan2(c.x-playerPos.x,c.z-playerPos.z);
        c.t=2.5;
      }
      if(c.t<=0){
        if(c.state==="idle"){
          c.state="walk";
          c.yaw=Math.random()*Math.PI*2;
          c.t=2+Math.random()*4;
        }else{
          c.state="idle";
          c.t=1.5+Math.random()*4;
        }
      }
      if(c.state!=="idle"){
        const sp=c.state==="flee"?c.sp.speed*2.4:c.sp.speed;
        const nx=c.x+Math.sin(c.yaw)*sp*dt;
        const nz=c.z+Math.cos(c.yaw)*sp*dt;
        const gy=this.world.surfaceY(Math.floor(nx),Math.floor(nz));
        if(Math.abs(gy-c.y)<2.2&&gy>this.planet.seaLevel){
          c.x=nx;c.z=nz;
          c.y+=(gy-c.y)*Math.min(dt*10,1);
        }else{
          c.yaw+=Math.PI/2+Math.random();
        }
        c.walkPhase+=dt*sp*3.2;
        let li=0;
        for(const leg of c.legs){
          leg.rotation.x=Math.sin(c.walkPhase+(li%2)*Math.PI)*0.6;
          li++;
        }
        c.tail.rotation.x=Math.sin(c.walkPhase*0.5)*0.2;
      }else{
        for(const leg of c.legs)leg.rotation.x*=0.9;
        c.head.rotation.y=Math.sin(performance.now()*0.001+c.x)*0.4;
      }
      c.group.position.set(c.x,c.y,c.z);
      const targetYaw=c.yaw;
      let dy2=targetYaw-c.group.rotation.y;
      while(dy2>Math.PI)dy2-=Math.PI*2;
      while(dy2<-Math.PI)dy2+=Math.PI*2;
      c.group.rotation.y+=dy2*Math.min(dt*6,1);
    }
    for(const c of remove){
      this.scene.remove(c.group);
      const i=this.creatures.indexOf(c);
      if(i>=0)this.creatures.splice(i,1);
    }
  }
  findTarget(camera,maxDist=48){
    const camPos=camera.position;
    const dir=new THREE.Vector3();
    camera.getWorldDirection(dir);
    let best=null,bestScore=0.94;
    for(const c of this.creatures){
      const to=new THREE.Vector3(c.x-camPos.x,c.y+0.6-camPos.y,c.z-camPos.z);
      const d=to.length();
      if(d>maxDist)continue;
      to.normalize();
      const dot=to.dot(dir);
      if(dot>bestScore){bestScore=dot;best={creature:c,dist:d};}
    }
    return best;
  }
  dispose(){
    for(const c of this.creatures)this.scene.remove(c.group);
    this.creatures=[];
  }
}
