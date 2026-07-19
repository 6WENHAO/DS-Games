import*as THREE from"three";
import{mulberry32,clamp}from"./util.js";
import{Simplex}from"./noise.js";

function glowTexture(inner="rgba(255,255,255,1)",mid="rgba(255,220,160,.55)",outer="rgba(255,160,60,0)"){
  const cv=document.createElement("canvas");
  cv.width=128;cv.height=128;
  const c=cv.getContext("2d");
  const g=c.createRadialGradient(64,64,4,64,64,64);
  g.addColorStop(0,inner);
  g.addColorStop(0.3,mid);
  g.addColorStop(1,outer);
  c.fillStyle=g;
  c.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(cv);
}
function nebulaTexture(hue,seed){
  const cv=document.createElement("canvas");
  cv.width=256;cv.height=256;
  const c=cv.getContext("2d");
  const rng=mulberry32(seed);
  for(let i=0;i<46;i++){
    const x=rng()*256,y=rng()*256,r=26+rng()*88;
    const g=c.createRadialGradient(x,y,0,x,y,r);
    const a=0.028+rng()*0.05;
    g.addColorStop(0,`hsla(${hue+rng()*40-20},70%,${52+rng()*22}%,${a})`);
    g.addColorStop(1,"rgba(0,0,0,0)");
    c.fillStyle=g;
    c.fillRect(0,0,256,256);
  }
  return new THREE.CanvasTexture(cv);
}

export class SpaceScene{
  constructor(game){
    this.g=game;
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(0x02030a);
    this.planets=[];
    this.asteroids=[];
    this.time=0;
  }
  build(planetDefs,sysSeed){
    const scene=this.scene;
    const rng=mulberry32(sysSeed);
    const starGeo=new THREE.BufferGeometry();
    const pos=[],col=[];
    const c=new THREE.Color();
    for(let i=0;i<2600;i++){
      const a=rng()*Math.PI*2,b=Math.acos(rng()*2-1),r=7000+rng()*2000;
      pos.push(r*Math.sin(b)*Math.cos(a),r*Math.cos(b),r*Math.sin(b)*Math.sin(a));
      const w=0.7+rng()*0.3;
      c.setHSL(rng()<0.12?0.08:(rng()<0.5?0.58:0.62),rng()*0.4,w);
      col.push(c.r,c.g,c.b);
    }
    starGeo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    starGeo.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
    this.stars=new THREE.Points(starGeo,new THREE.PointsMaterial({size:2.2,sizeAttenuation:false,vertexColors:true,fog:false}));
    scene.add(this.stars);
    const hue=180+rng()*140;
    for(let i=0;i<6;i++){
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({
        map:nebulaTexture(hue,sysSeed+i),transparent:true,opacity:0.5,depthWrite:false
      }));
      const a=rng()*Math.PI*2,b=Math.acos(rng()*2-1),r=6200;
      sp.position.set(r*Math.sin(b)*Math.cos(a),r*Math.cos(b)*0.6,r*Math.sin(b)*Math.sin(a));
      sp.scale.setScalar(5200+rng()*3000);
      scene.add(sp);
    }
    this.sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({
      map:glowTexture(),color:0xfff2d8,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false
    }));
    this.sunGlow.position.set(0,0,0);
    this.sunGlow.scale.setScalar(1500);
    scene.add(this.sunGlow);
    const sunCore=new THREE.Mesh(new THREE.BoxGeometry(190,190,190),new THREE.MeshBasicMaterial({color:0xfff6e0}));
    sunCore.rotation.set(0.6,0.8,0.3);
    scene.add(sunCore);
    this.sunCore=sunCore;
    this.sunLight=new THREE.PointLight(0xfff0d8,2.6,0,0);
    scene.add(this.sunLight);
    scene.add(new THREE.AmbientLight(0x8aa0c0,0.5));
    for(const def of planetDefs){
      this.buildPlanet(def);
    }
    this.buildStation(planetDefs[1]);
    this.buildFreighter();
    this.buildAsteroids();
    this.buildStreaks();
  }
  buildPlanet(def){
    const R=def.spaceR;
    const cube=R/13;
    const n=new Simplex(def.seed);
    const rng=mulberry32(def.seed);
    const positions=[];
    const colors=[];
    const base=new THREE.Color(def.palette.grass);
    const alt1=new THREE.Color(def.palette.stone);
    const alt2=new THREE.Color(def.palette.sand);
    const water=new THREE.Color(def.palette.water||def.palette.stone);
    const snow=new THREE.Color(0xeef4f8);
    const cc=new THREE.Color();
    for(let x=-13;x<=13;x++)for(let y=-13;y<=13;y++)for(let z=-13;z<=13;z++){
      const d=Math.sqrt(x*x+y*y+z*z);
      if(d>13.4||d<11.8)continue;
      const lat=Math.abs(y)/13.4;
      const nv=n.noise3D(x*0.14,y*0.14,z*0.14);
      const nv2=n.noise3D(x*0.4+9,y*0.4+9,z*0.4+9);
      let col;
      if(def.seaLevel>0&&nv<-0.18)col=water;
      else if(lat>0.82&&def.type!=="hot")col=snow;
      else if(nv2>0.42)col=alt1;
      else if(nv>0.3)col=alt2;
      else col=base;
      cc.copy(col).multiplyScalar(0.85+rng()*0.3);
      positions.push([x,y,z]);
      colors.push(cc.clone());
    }
    const geo=new THREE.BoxGeometry(cube,cube,cube);
    const mat=new THREE.MeshLambertMaterial();
    const inst=new THREE.InstancedMesh(geo,mat,positions.length);
    const dummy=new THREE.Object3D();
    for(let i=0;i<positions.length;i++){
      dummy.position.set(positions[i][0]*cube,positions[i][1]*cube,positions[i][2]*cube);
      dummy.updateMatrix();
      inst.setMatrixAt(i,dummy.matrix);
      inst.setColorAt(i,colors[i]);
    }
    const group=new THREE.Group();
    group.add(inst);
    const atmoGeo=new THREE.SphereGeometry(R*1.22,32,24);
    const atmoMat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,
      uniforms:{col:{value:new THREE.Color(def.palette.skyTop)}},
      vertexShader:`varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying vec3 vN;varying vec3 vV;uniform vec3 col;void main(){float f=pow(1.0-abs(dot(vN,vV)),2.4);gl_FragColor=vec4(col,f*0.55);}`
    });
    group.add(new THREE.Mesh(atmoGeo,atmoMat));
    if(def.rings){
      const ringGeo=new THREE.BoxGeometry(1,1,1);
      const ringMat=new THREE.MeshLambertMaterial({color:0xcbb89a});
      const ringInst=new THREE.InstancedMesh(ringGeo,ringMat,240);
      const rr=mulberry32(def.seed+5);
      const rd=new THREE.Object3D();
      for(let i=0;i<240;i++){
        const a=rr()*Math.PI*2,dist=R*1.7+rr()*R*0.75;
        rd.position.set(Math.cos(a)*dist,(rr()-0.5)*R*0.06,Math.sin(a)*dist);
        const s=1.5+rr()*4;
        rd.scale.set(s,s*0.6,s);
        rd.rotation.set(rr()*3,rr()*3,0);
        rd.updateMatrix();
        ringInst.setMatrixAt(i,rd.matrix);
      }
      const ringGroup=new THREE.Group();
      ringGroup.add(ringInst);
      ringGroup.rotation.x=0.35;
      group.add(ringGroup);
    }
    group.position.copy(def.spacePos);
    this.scene.add(group);
    this.planets.push({def,group,spin:0.008+Math.random()*0.01});
  }
  buildStation(nearDef){
    const g=new THREE.Group();
    const hullMat=new THREE.MeshLambertMaterial({color:0x8a94a0});
    const darkMat=new THREE.MeshLambertMaterial({color:0x3a424c});
    const lightMat=new THREE.MeshBasicMaterial({color:0x7ce8e8});
    const core=new THREE.Mesh(new THREE.BoxGeometry(26,34,26),hullMat);
    g.add(core);
    const top=new THREE.Mesh(new THREE.BoxGeometry(14,10,14),darkMat);
    top.position.y=22;
    g.add(top);
    const ring=new THREE.Group();
    for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2;
      const seg=new THREE.Mesh(new THREE.BoxGeometry(16,6,8),i%2?hullMat:darkMat);
      seg.position.set(Math.cos(a)*34,0,Math.sin(a)*34);
      seg.rotation.y=-a;
      ring.add(seg);
      if(i%3===0){
        const spoke=new THREE.Mesh(new THREE.BoxGeometry(22,2.4,2.4),darkMat);
        spoke.position.set(Math.cos(a)*20,0,Math.sin(a)*20);
        spoke.rotation.y=-a;
        ring.add(spoke);
      }
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.6,1.6),lightMat);
      lamp.position.set(Math.cos(a)*34,4.2,Math.sin(a)*34);
      ring.add(lamp);
    }
    g.add(ring);
    this.stationRing=ring;
    const bayGlow=new THREE.Mesh(new THREE.BoxGeometry(10,8,0.8),new THREE.MeshBasicMaterial({color:0x66d9e8}));
    bayGlow.position.set(0,-4,13.4);
    g.add(bayGlow);
    const dir=new THREE.Vector3(0.5,0.22,0.4).normalize();
    g.position.copy(nearDef.spacePos).addScaledVector(dir,nearDef.spaceR*3.2);
    this.scene.add(g);
    this.station=g;
  }
  buildFreighter(){
    const g=new THREE.Group();
    const hull=new THREE.MeshLambertMaterial({color:0x5e6a76});
    const dark=new THREE.MeshLambertMaterial({color:0x2c333c});
    const acc=new THREE.MeshLambertMaterial({color:0x8899aa});
    const glow=new THREE.MeshBasicMaterial({color:0xffb36b});
    const len=180;
    const body=new THREE.Mesh(new THREE.BoxGeometry(34,22,len),hull);
    g.add(body);
    const spine=new THREE.Mesh(new THREE.BoxGeometry(14,30,len*0.8),dark);
    spine.position.y=6;
    g.add(spine);
    const bridge=new THREE.Mesh(new THREE.BoxGeometry(22,14,18),acc);
    bridge.position.set(0,22,len*0.32);
    g.add(bridge);
    const tower=new THREE.Mesh(new THREE.BoxGeometry(8,10,8),dark);
    tower.position.set(0,34,len*0.32);
    g.add(tower);
    for(let i=0;i<5;i++){
      const pod=new THREE.Mesh(new THREE.BoxGeometry(44,8,14),i%2?hull:acc);
      pod.position.set(0,-8,-len*0.4+i*len*0.19);
      g.add(pod);
    }
    for(const s of[-1,1]){
      const eng=new THREE.Mesh(new THREE.BoxGeometry(10,10,16),dark);
      eng.position.set(s*14,0,len/2+6);
      g.add(eng);
      const ej=new THREE.Mesh(new THREE.BoxGeometry(7,7,1.4),glow);
      ej.position.set(s*14,0,len/2+14.4);
      g.add(ej);
    }
    const rng=mulberry32(999);
    const winMat=new THREE.MeshBasicMaterial({color:0xbfe8ff});
    for(let i=0;i<40;i++){
      const w=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.9,2.4),winMat);
      w.position.set(17.2,(rng()-0.5)*16,(rng()-0.5)*len*0.8);
      g.add(w);
    }
    g.position.set(2400,140,-2100);
    g.rotation.y=0.7;
    this.scene.add(g);
    this.freighter=g;
  }
  buildAsteroids(){
    const geo=new THREE.BoxGeometry(1,1,1);
    const mat=new THREE.MeshLambertMaterial({color:0x8d8371});
    this.astMesh=new THREE.InstancedMesh(geo,mat,110);
    this.astMesh.frustumCulled=false;
    this.scene.add(this.astMesh);
    this.astDummy=new THREE.Object3D();
    const rng=mulberry32(777);
    for(let i=0;i<110;i++){
      this.asteroids.push({
        pos:new THREE.Vector3((rng()-0.5)*4000,(rng()-0.5)*800,(rng()-0.5)*4000),
        r:2+rng()*5,
        hp:2,
        rx:rng()*3,ry:rng()*3,
        spin:(rng()-0.5)*0.8,
        alive:true
      });
    }
  }
  buildStreaks(){
    const n=70;
    const pos=new Float32Array(n*6);
    this.streakData=[];
    for(let i=0;i<n;i++){
      this.streakData.push(new THREE.Vector3());
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
    this.streaks=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xbfd8ff,transparent:true,opacity:0}));
    this.streaks.frustumCulled=false;
    this.scene.add(this.streaks);
  }
  respawnAsteroid(a,shipPos,fwd){
    const rng=Math.random;
    const dir=new THREE.Vector3(rng()-0.5,(rng()-0.5)*0.5,rng()-0.5).normalize();
    dir.lerp(fwd,0.55).normalize();
    const d=260+rng()*640;
    a.pos.copy(shipPos).addScaledVector(dir,d);
    a.pos.x+=(rng()-0.5)*220;a.pos.y+=(rng()-0.5)*160;a.pos.z+=(rng()-0.5)*220;
    if(a.pos.length()<800)a.pos.setLength(900);
    for(const p of this.planets){
      if(a.pos.distanceTo(p.def.spacePos)<p.def.spaceR*2)a.pos.addScaledVector(dir,p.def.spaceR*2.4);
    }
    a.hp=2;
    a.r=2+rng()*5;
    a.alive=true;
  }
  update(dt,ship,camera){
    this.time+=dt;
    for(const p of this.planets){
      p.group.rotation.y+=p.spin*dt;
    }
    if(this.stationRing)this.stationRing.rotation.y+=dt*0.06;
    this.sunGlow.scale.setScalar(1500+Math.sin(this.time*0.8)*40);
    this.sunCore.rotation.y+=dt*0.02;
    const fwd=ship?ship.forward():new THREE.Vector3(0,0,-1);
    const spos=ship?ship.pos:new THREE.Vector3();
    let ai=0;
    for(const a of this.asteroids){
      if(!a.alive||a.pos.distanceTo(spos)>1400)this.respawnAsteroid(a,spos,fwd);
      a.rx+=a.spin*dt;
      this.astDummy.position.copy(a.pos);
      this.astDummy.rotation.set(a.rx,a.ry,0);
      this.astDummy.scale.setScalar(a.r*(a.hp===1?0.72:1));
      this.astDummy.updateMatrix();
      this.astMesh.setMatrixAt(ai++,this.astDummy.matrix);
    }
    this.astMesh.instanceMatrix.needsUpdate=true;
    const pulsing=ship&&ship.pulsing;
    const boostT=ship?Math.max(ship.boost-0.55,0)*2:0;
    const streakA=pulsing?0.85:boostT*0.3;
    this.streaks.material.opacity+=(streakA-this.streaks.material.opacity)*Math.min(dt*4,1);
    if(this.streaks.material.opacity>0.02&&ship){
      const posAttr=this.streaks.geometry.attributes.position;
      const speed=ship.speed;
      for(let i=0;i<this.streakData.length;i++){
        const sd=this.streakData[i];
        sd.addScaledVector(fwd,-speed*dt);
        const rel=sd.clone().sub(spos);
        const along=rel.dot(fwd);
        if(along<-60||rel.length()>620){
          const side=new THREE.Vector3((Math.random()-0.5),(Math.random()-0.5),(Math.random()-0.5));
          side.addScaledVector(fwd,-side.dot(fwd));
          side.normalize().multiplyScalar(14+Math.random()*90);
          sd.copy(spos).addScaledVector(fwd,240+Math.random()*380).add(side);
        }
        const lenV=fwd.clone().multiplyScalar(pulsing?26:8);
        posAttr.setXYZ(i*2,sd.x,sd.y,sd.z);
        posAttr.setXYZ(i*2+1,sd.x-lenV.x,sd.y-lenV.y,sd.z-lenV.z);
      }
      posAttr.needsUpdate=true;
    }
  }
  checkAsteroidHit(pos,r){
    for(const a of this.asteroids){
      if(!a.alive)continue;
      if(pos.distanceTo(a.pos)<a.r+r){
        a.hp--;
        if(a.hp<=0){
          a.alive=false;
          return{destroyed:true};
        }
        return{destroyed:false};
      }
    }
    return null;
  }
  nearestPlanet(pos){
    let best=null;
    for(const p of this.planets){
      const d=pos.distanceTo(p.def.spacePos)-p.def.spaceR;
      if(!best||d<best.dist)best={def:p.def,dist:d,planet:p};
    }
    return best;
  }
  inGravityWell(pos){
    const n=this.nearestPlanet(pos);
    if(n&&n.dist<n.def.spaceR*1.7)return n.def;
    return null;
  }
  checkEntry(pos){
    const n=this.nearestPlanet(pos);
    if(n&&n.dist<n.def.spaceR*0.22)return n.def;
    return null;
  }
  stationDist(pos){
    if(!this.station)return 1e9;
    return pos.distanceTo(this.station.position);
  }
  planetMarkers(){
    return this.planets.map(p=>({name:p.def.name,pos:p.def.spacePos,r:p.def.spaceR}));
  }
}
