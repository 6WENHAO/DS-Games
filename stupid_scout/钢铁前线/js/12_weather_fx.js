'use strict';
// ===== 天气系统: 雨/雪/阴天/雷暴 =====
let precipObj=null, lightningT=rand(6,14), stormFlash=0;
function initWeather(){
if(WEATHER==='rain'||WEATHER==='storm'){
const n=WEATHER==='storm'?720:460;
const geo=new THREE.BufferGeometry();
const pos=new Float32Array(n*6);
for(let i=0;i<n;i++){
const x=rand(-24,24),y=rand(0,26),z=rand(-24,24);
pos[i*6]=x; pos[i*6+1]=y; pos[i*6+2]=z;
pos[i*6+3]=x; pos[i*6+4]=y-0.7; pos[i*6+5]=z;
}
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
precipObj=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x9db4c8,transparent:true,opacity:0.38,fog:false}));
precipObj.frustumCulled=false;
scene.add(precipObj);
} else if(WEATHER==='snow'){
const n=620;
const geo=new THREE.BufferGeometry();
const pos=new Float32Array(n*3);
for(let i=0;i<n;i++){ pos[i*3]=rand(-26,26); pos[i*3+1]=rand(0,24); pos[i*3+2]=rand(-26,26); }
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
precipObj=new THREE.Points(geo,new THREE.PointsMaterial({color:0xf2f5f8,size:0.16,transparent:true,opacity:0.9,fog:false,sizeAttenuation:true}));
precipObj.frustumCulled=false;
scene.add(precipObj);
}
if(WEATHER==='overcast'||WEATHER==='storm'){ sun.intensity=THEME.sunI*0.55; hemi.intensity=THEME.hemi[2]*1.15; }
else if(WEATHER==='rain') sun.intensity=THEME.sunI*0.7;
}
function updateWeather(dt){
if(precipObj){
precipObj.position.set(camera.position.x,camera.position.y-8,camera.position.z);
const pos=precipObj.geometry.attributes.position;
if(WEATHER==='snow'){
for(let i=0;i<pos.count;i++){
let y=pos.getY(i)-dt*3.2;
let x=pos.getX(i)+Math.sin(nowT*1.4+i*0.7)*dt*0.9;
if(y<0){ y+=24; x=rand(-26,26); pos.setZ(i,rand(-26,26)); }
pos.setY(i,y); pos.setX(i,x);
}
} else {
const sp=WEATHER==='storm'?36:27;
for(let i=0;i<pos.count;i+=2){
let y=pos.getY(i)-dt*sp;
if(y<0){
y+=26;
const nx=rand(-24,24),nz=rand(-24,24);
pos.setX(i,nx); pos.setZ(i,nz);
pos.setX(i+1,nx); pos.setZ(i+1,nz);
}
pos.setY(i,y); pos.setY(i+1,y-0.7);
}
}
pos.needsUpdate=true;
}
// 雷暴闪电
if(WEATHER==='storm'){
lightningT-=dt;
if(lightningT<=0){
lightningT=rand(7,17);
stormFlash=1;
const base=THEME.sunI*0.55;
sun.intensity=THEME.sunI*2.6;
setTimeout(()=>{ sun.intensity=THEME.sunI*1.6; },70);
setTimeout(()=>{ sun.intensity=base; },160);
const dd=rand(90,320);
setTimeout(()=>AudioSys.explosion(dd*0.8),dd*2.6);
}
}
if(stormFlash>0){
stormFlash=Math.max(0,stormFlash-dt*3.2);
const ov=el('stormOv');
if(ov) ov.style.opacity=stormFlash*0.5;
}
}
initWeather();

function impactFX(point,normal,kind){
const n=normal, p=point;
if(kind==='ground'||kind==='cyl'){
for(let i=0;i<4;i++) spawnP(PT.dirt,p.x,p.y+0.05,p.z, n.x*rand(0.5,1.5)+rand(-0.8,0.8), rand(0.8,2.2), n.z*rand(0.5,1.5)+rand(-0.8,0.8), rand(0.2,0.45),0.9,rand(0.4,0.7),0.9,3);
} else {
for(let i=0;i<3;i++) spawnP(PT.smoke,p.x+n.x*0.06,p.y+n.y*0.06,p.z+n.z*0.06, n.x*rand(0.4,1.2)+rand(-0.5,0.5), rand(0.3,1.2), n.z*rand(0.4,1.2)+rand(-0.5,0.5), rand(0.15,0.3),0.8,rand(0.3,0.55),0.8,1.5);
for(let i=0;i<3;i++) spawnP(PT.spark,p.x+n.x*0.05,p.y+n.y*0.05,p.z+n.z*0.05, n.x*rand(1,4)+rand(-2,2), rand(0.5,3), n.z*rand(1,4)+rand(-2,2), rand(0.05,0.12),-0.05,rand(0.15,0.3),1,6,true);
if(Math.random()<0.25) AudioSys.ricochet(p.distanceTo(camera.position));
}
}
function bloodFX(p){
for(let i=0;i<5;i++) spawnP(PT.blood,p.x,p.y,p.z, rand(-1.4,1.4), rand(-0.5,1.4), rand(-1.4,1.4), rand(0.14,0.3),0.5,rand(0.25,0.5),0.95,4);
bloodDecal(p.x,p.z);
}
function bloodDecal(x,z){
let best=null;
for(const b of bloodGeos) if(!b.alive&&(!best||b.age<best.age)) best=b;
if(!best) return;
if(!best.m){
best.m=new THREE.Mesh(best.g,bloodMat);
best.m.rotation.x=-HPI;
best.m.renderOrder=0;
}
best.m.visible=true;
best.m.position.set(x,heightAt(x,z)+0.02,z);
best.m.rotation.z=rand(0,TAU);
scene.add(best.m);
best.alive=true; best.age=0;
}
function updateBloodDecals(dt){
for(const b of bloodGeos){
if(!b.alive) continue;
b.age+=dt;
if(b.age>20){
b.alive=false;
b.m.visible=false;
}
const op=0.85*(1-clamp(b.age/18,0,1));
b.m.material.opacity=op;
}
}
function muzzleFXWorld(pos,dir){
spawnP(PT.flash,pos.x,pos.y,pos.z, dir.x*2,dir.y*2,dir.z*2, rand(0.3,0.5),1.2,0.06,1,0,true);
spawnP(PT.smoke,pos.x,pos.y,pos.z, dir.x*1.2+rand(-0.2,0.2),0.6,dir.z*1.2+rand(-0.2,0.2), 0.22,1.1,rand(0.5,0.9),0.4,0.3);
}
const flashLight=new THREE.PointLight(0xffb060,0,26);
scene.add(flashLight);
let flashTimer=0;
function explosionFX(p){
spawnP(PT.flash,p.x,p.y+0.6,p.z,0,1.5,0, 2.6,14,0.16,1,0,true);
spawnP(PT.flash,p.x,p.y+0.9,p.z,0,2,0, 1.6,10,0.22,1,0,true);
for(let i=0;i<10;i++) spawnP(PT.dark,p.x+rand(-1,1),p.y+rand(0.2,1.6),p.z+rand(-1,1), rand(-2,2),rand(1.5,4.5),rand(-2,2), rand(0.8,1.6),2.2,rand(1.2,2.4),0.85,0.8,false,rand(-1,1));
for(let i=0;i<12;i++) spawnP(PT.dirt,p.x,p.y+0.3,p.z, rand(-5,5),rand(3,9),rand(-5,5), rand(0.3,0.7),0.6,rand(0.6,1.2),0.95,9);
for(let i=0;i<8;i++) spawnP(PT.spark,p.x,p.y+0.5,p.z, rand(-8,8),rand(2,9),rand(-8,8), rand(0.1,0.2),-0.05,rand(0.2,0.5),1,10,true);
// 高画质: 余烬火星弧线 + 冲击波环 + 滞留浓烟
if(SETTINGS.quality>=1){
const n=SETTINGS.quality===2?14:7;
for(let i=0;i<n;i++) spawnP(PT.spark,p.x,p.y+0.7,p.z, rand(-7,7),rand(3,11),rand(-7,7), rand(0.07,0.15),-0.03,rand(0.6,1.3),1,8,true,rand(-8,8));
spawnP(PT.flash,p.x,p.y+0.4,p.z,0,0,0, 2.0,30,0.16,0.65,0,true);
if(SETTINGS.quality===2){
for(let i=0;i<4;i++) spawnP(PT.smoke,p.x+rand(-1.5,1.5),p.y+rand(1,3),p.z+rand(-1.5,1.5), rand(-0.4,0.4),rand(0.6,1.4),rand(-0.4,0.4), rand(1.4,2),2.4,rand(2.5,3.8),0.55,0.05);
}
}
flashLight.position.set(p.x,p.y+1.2,p.z);
flashLight.intensity=60; flashTimer=0.14;
crater(p.x,p.z,rand(1.2,1.7),true);
}
