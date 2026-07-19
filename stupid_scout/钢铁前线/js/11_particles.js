'use strict';
const PT = {
smoke: radialTex(2,30,[[0,'rgba(200,195,185,.85)'],[0.5,'rgba(160,155,145,.4)'],[1,'rgba(150,150,140,0)']]),
dark:  radialTex(2,30,[[0,'rgba(60,55,48,.9)'],[0.5,'rgba(70,64,55,.5)'],[1,'rgba(60,60,55,0)']]),
flash: radialTex(1,30,[[0,'rgba(255,250,220,1)'],[0.25,'rgba(255,190,90,.9)'],[1,'rgba(255,120,30,0)']]),
blood: radialTex(2,26,[[0,'rgba(140,20,12,.95)'],[0.6,'rgba(110,14,8,.5)'],[1,'rgba(90,10,6,0)']]),
dirt:  radialTex(2,28,[[0,'rgba(120,100,70,.95)'],[0.6,'rgba(100,84,58,.5)'],[1,'rgba(90,76,52,0)']]),
spark: radialTex(1,20,[[0,'rgba(255,240,180,1)'],[1,'rgba(255,160,40,0)']]),
};
const particles=[];
const PARTICLE_MAX=280;
const pPools=new Map();
function poolKey(tex,additive){ return tex.uuid+(additive?'A':'N'); }
function recycleP(p){
p.sp.visible=false;
pPools.get(p.key).push(p);
}
function spawnP(tex,x,y,z,vx,vy,vz,size,grow,life,opa=1,grav=0,additive=false,spin=0){
if(particles.length>=PARTICLE_MAX){ recycleP(particles.shift()); }
const key=poolKey(tex,additive);
let pool=pPools.get(key);
if(!pool){ pool=[]; pPools.set(key,pool); }
let p=pool.pop();
if(!p){
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending}));
scene.add(sp);
p={sp,key};
}
p.sp.visible=true;
p.sp.material.opacity=opa;
p.sp.material.rotation=rand(0,TAU);
p.sp.position.set(x,y,z);
p.sp.scale.setScalar(size);
p.vx=vx; p.vy=vy; p.vz=vz; p.grow=grow; p.life=life; p.age=0; p.opa=opa; p.grav=grav; p.spin=spin;
particles.push(p);
}
function updateParticles(dt){
for(let i=particles.length-1;i>=0;i--){
const p=particles[i];
p.age+=dt;
if(p.age>=p.life){ recycleP(p); particles.splice(i,1); continue; }
p.vy-=p.grav*dt;
p.sp.position.x+=p.vx*dt; p.sp.position.y+=p.vy*dt; p.sp.position.z+=p.vz*dt;
const s=p.sp.scale.x+p.grow*dt;
p.sp.scale.setScalar(s);
p.sp.material.rotation+=p.spin*dt;
p.sp.material.opacity=p.opa*(1-p.age/p.life);
}
}
const tracers=[], tracerPool=[];
const tracerGeo=new THREE.BoxGeometry(0.035,0.035,1.6);
const tracerMat=new THREE.MeshBasicMaterial({color:0xffd890,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
function spawnTracer(o,dir,dist){
let m=tracerPool.pop();
if(!m){ m=new THREE.Mesh(tracerGeo,tracerMat); scene.add(m); }
m.visible=true;
m.position.copy(o);
m.lookAt(o.x+dir.x,o.y+dir.y,o.z+dir.z);
tracers.push({m,dir:dir.clone(),traveled:0,max:dist});
}
function updateTracers(dt){
const spd=340;
for(let i=tracers.length-1;i>=0;i--){
const t=tracers[i];
const step=spd*dt;
t.traveled+=step;
if(t.traveled>=t.max){ t.m.visible=false; tracerPool.push(t.m); tracers.splice(i,1); continue; }
t.m.position.addScaledVector(t.dir,step);
}
}
const casings=[];
const BLOOD_POOL_SIZE=36;
const bloodGeos=[];
const bloodMat=new THREE.MeshLambertMaterial({color:0x6a1810,transparent:true,opacity:0.82,depthWrite:false});
for(let i=0;i<BLOOD_POOL_SIZE;i++){
const bg=new THREE.PlaneGeometry(rand(0.16,0.36),rand(0.14,0.32));
bloodGeos.push({g:bg,m:null,age:0,alive:false});
}
const casingGeo=new THREE.CylinderGeometry(0.011,0.011,0.05,5);
const casingMat=new THREE.MeshBasicMaterial({color:0xc8a850});
function spawnCasing(pos,right,up){
if(casings.length>26){ const c=casings.shift(); scene.remove(c.m); }
const m=new THREE.Mesh(casingGeo,casingMat);
m.position.copy(pos);
m.rotation.set(rand(0,3),rand(0,3),rand(0,3));
scene.add(m);
casings.push({m, vx:right.x*rand(1,2.4)+up.x*rand(1.4,2.4), vy:rand(1.6,2.6), vz:right.z*rand(1,2.4)+up.z*rand(1.4,2.4), rx:rand(-12,12), rz:rand(-12,12), life:0, bounced:false});
}
function updateCasings(dt){
for(let i=casings.length-1;i>=0;i--){
const c=casings[i];
c.life+=dt;
if(c.life>4){ scene.remove(c.m); casings.splice(i,1); continue; }
c.vy-=9.8*dt;
c.m.position.x+=c.vx*dt; c.m.position.y+=c.vy*dt; c.m.position.z+=c.vz*dt;
c.m.rotation.x+=c.rx*dt; c.m.rotation.z+=c.rz*dt;
const gh=heightAt(c.m.position.x,c.m.position.z);
if(c.m.position.y<gh+0.02&&c.vy<0){
c.m.position.y=gh+0.02;
c.vy*=-0.3; c.vx*=0.5; c.vz*=0.5; c.rx*=0.4; c.rz*=0.4;
if(!c.bounced){ c.bounced=true; if(c.m.position.distanceTo(camera.position)<8) AudioSys.click(3200,0.08,0.02); }
}
}
}
// ===== 烟雾弹系统: 遮蔽视线(bot同样无法看穿) =====
const SMOKES=[];
function spawnSmokeCloud(p){
const cloud={x:p.x,y:p.y,z:p.z,t:0,dur:16,r:5.5,sprites:[]};
for(let i=0;i<12;i++){
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:PT.smoke,transparent:true,opacity:0,depthWrite:false,color:0xc8c8c2}));
sp.position.set(p.x+rand(-2.4,2.4),p.y+rand(0.4,3),p.z+rand(-2.4,2.4));
sp.scale.setScalar(rand(3,5));
sp.material.rotation=rand(0,TAU);
scene.add(sp);
cloud.sprites.push({sp,vx:rand(-0.16,0.16),vy:rand(0.05,0.16),vz:rand(-0.16,0.16),rs:rand(-0.15,0.15),g:rand(0.22,0.38)});
}
SMOKES.push(cloud);
AudioSys.metalSlide(0.22,0.5,300,140);
}
function updateSmokes(dt){
for(let i=SMOKES.length-1;i>=0;i--){
const c=SMOKES[i];
c.t+=dt;
const op=0.82*Math.min(clamp(c.t/1.2,0,1),clamp((c.dur-c.t)/3,0,1));
for(const s of c.sprites){
s.sp.position.x+=s.vx*dt; s.sp.position.y+=s.vy*dt; s.sp.position.z+=s.vz*dt;
s.sp.scale.addScalar(s.g*dt);
s.sp.material.rotation+=s.rs*dt;
s.sp.material.opacity=op;
}
if(c.t>=c.dur){
for(const s of c.sprites){ scene.remove(s.sp); s.sp.material.dispose(); }
SMOKES.splice(i,1);
}
}
}
function smokeBlocksLOS(ax,ay,az,bx,by,bz){
for(const c of SMOKES){
if(c.t<0.8||c.t>c.dur-1.5) continue;
const dx=bx-ax,dy=by-ay,dz=bz-az;
const L2=dx*dx+dy*dy+dz*dz;
if(L2<1e-6) continue;
let t=((c.x-ax)*dx+(c.y+1.5-ay)*dy+(c.z-az)*dz)/L2;
t=clamp(t,0,1);
const px=ax+dx*t-c.x, py=ay+dy*t-(c.y+1.5), pz=az+dz*t-c.z;
if(px*px+py*py+pz*pz<c.r*c.r) return true;
}
return false;
}
