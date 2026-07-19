'use strict';
const world = new THREE.Group(); scene.add(world);
const NAV_CLEARS=[];
function mesh(geo,mat,x,y,z,ry=0,cast=true,recv=true){
const m=new THREE.Mesh(geo,mat);
m.position.set(x,y,z); m.rotation.y=ry;
m.castShadow=cast; m.receiveShadow=recv;
world.add(m); return m;
}
function solidBox(mat,w,h,d,x,y,z,ry=0){
const m=mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,ry);
const sn=Math.sin(ry), cs=Math.cos(ry);
if(Math.abs(sn)<0.02||Math.abs(cs)<0.02){
const swap=Math.abs(sn)>0.5;
addBoxCollider(x,y,z, swap?d:w, h, swap?w:d);
} else {
const long=Math.max(w,d), short=Math.min(w,d);
const s=clamp(short,0.55,2.2);
const steps=Math.max(1,Math.round(long/s));
const dirX=w>=d?cs:sn, dirZ=w>=d?-sn:cs;
for(let i=0;i<steps;i++){
const t=steps===1?0:-long/2+s/2+i*(long-s)/(steps-1);
addBoxCollider(x+dirX*t,y,z+dirZ*t,s,h,s);
}
}
return m;
}
const coverPoints=[];
// 楼梯段: 视觉台阶(带 stair 标记, 不参与站立吸附) + 平滑行走坡道
// 方向: 从局部 -Z(低端 y0) 走向 +Z(高端 y1), ry 为朝向
function stairFlight(mat,x,z,ry,w,len,y0,y1){
const steps=Math.max(3,Math.round((y1-y0)/0.23));
const sn=Math.sin(ry),cs=Math.cos(ry);
for(let i=0;i<steps;i++){
const lz=-len/2+len*(i+0.5)/steps;
const px=x+sn*lz, pz=z+cs*lz;
const sy=y0+(y1-y0)*(i+1)/steps;
const before=BOXES.length;
solidBox(mat,w,0.14,len/steps+0.06,px,sy-0.07,pz,ry);
for(let bi2=before;bi2<BOXES.length;bi2++) BOXES[bi2].stair=true;
}
addRamp(x,z,ry,w,len,y0,y1);
}
function addCoverAround(x,z,w,d,ry=0){
const cs=Math.cos(ry),sn=Math.sin(ry);
const off=[[0,d/2+0.9],[0,-d/2-0.9],[w/2+0.9,0],[-w/2-0.9,0]];
for(const o of off){
coverPoints.push({x:x+o[0]*cs+o[1]*sn, z:z-o[0]*sn+o[1]*cs});
}
}
const DESTRUCTIBLES=[];
let _dG=null;
function dBegin(){ _dG={meshes:[],bi:[],hp:230,cx:0,cz:0,n:0,dead:false}; }
function dBox(mat,w,h,d,x,y,z,ry){
const before=BOXES.length;
const m=solidBox(mat,w,h,d,x,y,z,ry);
for(let i=before;i<BOXES.length;i++) _dG.bi.push(i);
_dG.meshes.push(m);
_dG.cx+=x; _dG.cz+=z; _dG.n++;
return m;
}
function dEnd(pre){
const g=_dG; _dG=null;
if(!g||!g.n) return null;
g.cx/=g.n; g.cz/=g.n;
DESTRUCTIBLES.push(g);
for(const bi2 of g.bi){ if(BOXES[bi2]) BOXES[bi2].dGroup=g; }
if(pre) destroyStructure(g,true);
return g;
}
function destroyStructure(g,silent){
if(g.dead) return; g.dead=true;
for(const m of g.meshes){
// 墙体拆成物理碎块坍塌 (cannon可用时)
if(!silent) spawnWallDebris(m,g.cx,g.cz);
world.remove(m);
}
for(const i of g.bi){
const b=BOXES[i]; b.dead=true;
if(OCC.data){
const i0=clamp(Math.floor((b.minX-0.7+OCC.off)/OCC.res),0,OCC.N-1),i1=clamp(Math.ceil((b.maxX+0.7+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((b.minZ-0.7+OCC.off)/OCC.res),0,OCC.N-1),j1=clamp(Math.ceil((b.maxZ+0.7+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i2=i0;i2<=i1;i2++) OCC.data[j*OCC.N+i2]=0;
}
b.minX=99999; b.minY=99999; b.minZ=99999; b.maxX=99999.1; b.maxY=99999.1; b.maxZ=99999.1;
}
const gy=heightAt(g.cx,g.cz);
for(let k=0;k<4;k++){
mesh(new THREE.BoxGeometry(rand(0.4,0.9),rand(0.25,0.55),rand(0.4,0.9)),Math.random()<0.5?MAT.rubble:MAT.brick,g.cx+rand(-1.8,1.8),gy+rand(0.1,0.35),g.cz+rand(-1.8,1.8),rand(0,3));
}
if(!silent){
// 崩塌灰尘: 底部滚出的浓尘 + 升腾烟柱 + 飞溅碎屑
for(let k=0;k<10;k++){
const a=rand(0,TAU), rr=rand(0.5,2.2);
spawnP(PT.dirt,g.cx+Math.sin(a)*rr,gy+rand(0.1,0.5),g.cz+Math.cos(a)*rr,Math.sin(a)*rand(1.5,3.5),rand(0.3,1.2),Math.cos(a)*rand(1.5,3.5),rand(0.7,1.2),2.2,rand(1.2,2),0.85,0.6);
}
for(let k=0;k<8;k++) spawnP(PT.smoke,g.cx+rand(-2,2),gy+rand(0.5,2.8),g.cz+rand(-2,2),rand(-0.6,0.6),rand(0.8,2),rand(-0.6,0.6),rand(1,1.6),2.8,rand(1.8,2.8),0.7,0.1);
for(let k=0;k<8;k++) spawnP(PT.dirt,g.cx+rand(-1.5,1.5),gy+rand(1,2.8),g.cz+rand(-1.5,1.5),rand(-4,4),rand(2,6),rand(-4,4),rand(0.3,0.55),0.5,rand(0.6,1),0.9,7);
AudioSys.explosion(Math.hypot(g.cx-camera.position.x,g.cz-camera.position.z)*0.7);
if(player.alive&&Math.hypot(g.cx-player.pos.x,g.cz-player.pos.z)<25) addTrauma(0.4);
}
// 承重墙被毁 → 屋顶随之坍塌
if(g.roofRef&&!g.roofRef.done){
g.roofRef.dead++;
if(g.roofRef.dead>=2){
g.roofRef.done=true;
const rms=Array.isArray(g.roofRef.m)?g.roofRef.m:[g.roofRef.m];
for(const rm of rms){
if(!silent&&rm.parent){
spawnWallDebris(rm,g.cx,g.cz);
for(let k=0;k<3;k++) spawnP(PT.dirt,rm.position.x+rand(-1.5,1.5),rm.position.y,rm.position.z+rand(-1.5,1.5),rand(-2,2),rand(0,2),rand(-2,2),rand(0.5,0.8),1.5,rand(0.8,1.2),0.85,3);
}
world.remove(rm);
}
}
}
}
function damageStructures(p,radius,amt){
for(const g of DESTRUCTIBLES){
if(g.dead) continue;
const d=Math.hypot(g.cx-p.x,g.cz-p.z);
if(d<radius+3){
g.hp-=amt*(1-d/(radius+3)*0.6);
if(g.hp<=0) destroyStructure(g);
}
}
}
function ruinedHouse(x,z,w,d,ry,mat,brokenLevel=0.3){
const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(w+0.5,1.6,d+0.5),MAT.stone,x,g0-0.7,z,ry,false,true);
const wallH=3.2, t=0.34;
const cs=Math.cos(ry),sn=Math.sin(ry);
const sides=[
{dx:0,dz:d/2,w:w,rot:0,door:true},{dx:0,dz:-d/2,w:w,rot:0},
{dx:-w/2,dz:0,w:d,rot:HPI},{dx:w/2,dz:0,w:d,rot:HPI},
];
const wallGs=[];
sides.forEach((s,idx)=>{
const wx=x+s.dx*cs+s.dz*sn, wz=z-s.dx*sn+s.dz*cs;
const wrot=ry+s.rot;
dBegin();
if(s.door){
const doorW=1.2, seg=(s.w-doorW)/2;
NAV_CLEARS.push({x:wx,z:wz,r:1.0});
dBox(mat,seg,wallH,t, wx+Math.cos(wrot)*(-(doorW+seg)/2), g0+wallH/2, wz-Math.sin(wrot)*(-(doorW+seg)/2), wrot);
dBox(mat,seg,1.1,t, wx+Math.cos(wrot)*((doorW+seg)/2), g0+0.55, wz-Math.sin(wrot)*((doorW+seg)/2), wrot);
dBox(mat,seg,0.9,t, wx+Math.cos(wrot)*((doorW+seg)/2), g0+wallH-0.45, wz-Math.sin(wrot)*((doorW+seg)/2), wrot);
dBox(mat,doorW,wallH-2.2,t, wx, g0+wallH-(wallH-2.2)/2, wz, wrot);
} else {
const winW=1.3, seg=(s.w-winW)/2;
dBox(mat,seg,wallH,t, wx+Math.cos(wrot)*(-(winW+seg)/2), g0+wallH/2, wz-Math.sin(wrot)*(-(winW+seg)/2), wrot);
dBox(mat,seg,wallH,t, wx+Math.cos(wrot)*((winW+seg)/2), g0+wallH/2, wz-Math.sin(wrot)*((winW+seg)/2), wrot);
dBox(mat,winW,1.1,t, wx, g0+0.55, wz, wrot);
dBox(mat,winW,0.9,t, wx, g0+wallH-0.45, wz, wrot);
}
wallGs.push(dEnd(idx>0&&Math.random()<brokenLevel*0.55));
});
const preDead=wallGs.filter(g=>g&&g.dead).length;
if(preDead<2&&Math.random()>brokenLevel*0.6){
const roof=mesh(new THREE.BoxGeometry(w*0.55,0.16,d+0.6),MAT.roof, x-w*0.22*cs, g0+wallH+0.5, z+w*0.22*sn, ry);
roof.rotation.z=0.42;
addSnowCap(roof);
const roofRef={m:roof,dead:preDead,done:false};
for(const g of wallGs) if(g&&!g.dead) g.roofRef=roofRef;
}
const cx2=x+rand(-w*0.2,w*0.2), cz2=z+rand(-d*0.2,d*0.2);
solidBox(MAT.woodDark,1.1,0.8,0.7,cx2,g0+0.4,cz2,rand(0,3));
addCoverAround(x,z,w,d,ry);
}
// 中式瓦房: 灰墙+双坡挑檐瓦顶 (墙体可摧毁, 顶随墙塌)
function cnHouse(x,z,ry,w=6,d=5){
const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(w+0.6,1.2,d+0.6),MAT.stone,x,g0-0.5,z,ry,false,true);
const H=2.6,t=0.32;
const cs=Math.cos(ry),sn=Math.sin(ry);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
const wallGs=[];
let p;
dBegin();
const dw=1.1, seg=(w-dw)/2;
p=L(0,d/2); NAV_CLEARS.push({x:p[0],z:p[1],r:1.0});
p=L(-(dw+seg)/2,d/2); dBox(MAT.plaster,seg,H,t,p[0],g0+H/2,p[1],ry);
p=L((dw+seg)/2,d/2); dBox(MAT.plaster,seg,H,t,p[0],g0+H/2,p[1],ry);
p=L(0,d/2); dBox(MAT.plaster,dw,H-1.9,t,p[0],g0+H-(H-1.9)/2,p[1],ry);
wallGs.push(dEnd());
dBegin(); p=L(0,-d/2); dBox(MAT.plaster,w,H,t,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
dBegin(); p=L(-w/2,0); dBox(MAT.plaster,t,H,d,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
dBegin(); p=L(w/2,0); dBox(MAT.plaster,t,H,d,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
// 双坡瓦顶(挑檐)
p=L(0,d*0.27);
const r1=mesh(new THREE.BoxGeometry(w+1.3,0.13,d*0.66),MAT.roof,p[0],g0+H+0.4,p[1],ry);
r1.rotation.x=0.4;
addSnowCap(r1);
p=L(0,-d*0.27);
const r2=mesh(new THREE.BoxGeometry(w+1.3,0.13,d*0.66),MAT.roof,p[0],g0+H+0.4,p[1],ry);
r2.rotation.x=-0.4;
addSnowCap(r2);
p=L(0,0);
const ridge=mesh(new THREE.BoxGeometry(w+1.4,0.14,0.3),MAT.roof,p[0],g0+H+0.72,p[1],ry);
addSnowCap(ridge);
const roofRef={m:[r1,r2,ridge],dead:0,done:false};
for(const g of wallGs) if(g) g.roofRef=roofRef;
// 内饰
p=L(rand(-w*0.2,w*0.2),rand(-d*0.2,d*0.2));
solidBox(MAT.woodDark,1.1,0.7,0.6,p[0],g0+0.35,p[1],rand(0,3));
addCoverAround(x,z,w,d,ry);
}
// 工厂废墟: 砖墙骨架+高烟囱+机器残骸
function factoryRuin(x,z,ry){
ruinedHouse(x,z,10,13,ry,MAT.brick,0.55);
const cs=Math.cos(ry),sn=Math.sin(ry);
const cx2=x+6.8*cs+5*sn, cz2=z-6.8*sn+5*cs;
const g0=heightAt(cx2,cz2);
mesh(new THREE.CylinderGeometry(0.65,0.95,11,10),MAT.brick,cx2,g0+5.5,cz2);
mesh(new THREE.CylinderGeometry(0.72,0.7,0.5,10),MAT.stone,cx2,g0+10.6,cz2);
CYLS.push({x:cx2,z:cz2,r:1.0,y0:g0,y1:g0+11});
solidBox(MAT.metalDark,2.4,1.5,1.3, x+2*cs-2*sn, heightAt(x,z)+0.75, z-2*sn-2*cs, ry);
solidBox(MAT.metalDark,1.6,1.1,1.2, x-2.5*cs+3*sn, heightAt(x,z)+0.55, z+2.5*sn+3*cs, ry+0.4);
rubblePile(x-3*cs,z+3*sn,1.8);
coverPoints.push({x:cx2+2,z:cz2},{x:x,z:z});
}
// 战壕装饰: 沿沟沿沙包胸墙 + 弹药箱 + 掩体点
function decorateTrenches(){
for(const t of TRENCHES){
const len=Math.hypot(t.x2-t.x1,t.z2-t.z1);
if(len<1) continue;
const dx=(t.x2-t.x1)/len, dz=(t.z2-t.z1)/len;
const px=-dz, pz=dx;
const ry=Math.atan2(-dz,dx);
const n=Math.max(1,Math.floor(len/6));
for(let i=0;i<=n;i++){
const tt=i/n;
const cx=t.x1+(t.x2-t.x1)*tt, cz=t.z1+(t.z2-t.z1)*tt;
coverPoints.push({x:cx,z:cz});
if(i<n&&i%2===0) sandbagWall(cx+px*3.0+dx*3,cz+pz*3.0+dz*3,4,ry);
if(i<n&&i%3===1) sandbagWall(cx-px*3.0+dx*3,cz-pz*3.0+dz*3,4,ry);
}
crate(t.x1-dx*2+px*1.2,t.z1-dz*2+pz*1.2,1.1,ry);
barrel(t.x2+dx*2-px*1.2,t.z2+dz*2-pz*1.2);
}
}
function buildChurch(x,z,ry){const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(10.5,1.8,16.5),MAT.stone,x,g0-0.8,z,ry,false,true);
mesh(new THREE.BoxGeometry(4.5,1.8,5),MAT.stone,x,g0-0.8,z-16/2-3,0,false,true);
const w=10,d=16,H=6;
solidBox(MAT.stone,0.5,H,d, x-w/2, g0+H/2, z, ry);
solidBox(MAT.stone,0.5,H,d, x+w/2, g0+H/2, z, ry);
solidBox(MAT.stone,w,H,0.5, x, g0+H/2, z-d/2, ry);
const dw=2.2, seg=(w-dw)/2;
NAV_CLEARS.push({x:x,z:z+d/2,r:1.6});
solidBox(MAT.stone,seg,H,0.5, x-(dw+seg)/2, g0+H/2, z+d/2, ry);
solidBox(MAT.stone,seg,H,0.5, x+(dw+seg)/2, g0+H/2, z+d/2, ry);
solidBox(MAT.stone,dw,H-3,0.5, x, g0+H-(H-3)/2, z+d/2, ry);
const roof=mesh(new THREE.BoxGeometry(w*0.6,0.2,d*0.55),MAT.roof,x-w*0.2,g0+H+0.7,z-d*0.2,ry);
roof.rotation.z=0.5;
addSnowCap(roof);
const tx=x, tz=z-d/2-3;
const th=10;
solidBox(MAT.stone,4,th,0.5,tx,g0+th/2,tz-2,0);
solidBox(MAT.stone,4,th,0.5,tx,g0+th/2,tz+2,0);
solidBox(MAT.stone,0.5,th,3.5,tx-2,g0+th/2,tz,0);
solidBox(MAT.stone,0.5,6,3.5,tx+2,g0+7,tz,0);
NAV_CLEARS.push({x:tx+2,z:tz,r:1.2});
solidBox(MAT.stone,4,0.4,2.6,tx,g0+th-2.5,tz-0.95,0);
solidBox(MAT.stone,1.7,0.4,1.9,tx+1.15,g0+th-2.5,tz+1.3,0);
solidBox(MAT.stone,4,0.9,0.3,tx,g0+th-1.6,tz-2.1,0);
solidBox(MAT.stone,4,0.9,0.3,tx,g0+th-1.6,tz+2.1,0);
solidBox(MAT.stone,0.3,0.9,4.5,tx-2.1,g0+th-1.6,tz,0);
solidBox(MAT.stone,0.3,0.9,4.5,tx+2.1,g0+th-1.6,tz,0);
for(let i=0;i<8;i++){
solidBox(MAT.woodDark,1.0,0.24,0.55, tx+1.2, g0+0.38+i*0.5, tz+1.4-i*0.4, 0);
}
solidBox(MAT.woodDark,2.3,0.24,0.9, tx+0.4, g0+4.13, tz-1.5, 0);
for(let i=0;i<7;i++){
solidBox(MAT.woodDark,1.0,0.24,0.55, tx-1.2, g0+4.63+i*0.5, tz-1.4+i*0.4, 0);
}
const spire=mesh(new THREE.ConeGeometry(2.6,3,4),MAT.woodDark,tx,g0+th+0.6,tz,Math.PI/4);
for(let i=0;i<4;i++){
solidBox(MAT.woodDark,3,0.5,0.5, x+rand(-1.5,1.5), g0+0.25, z-d/2+3+i*2.6, ry+rand(-0.2,0.2));
}
addCoverAround(x,z,w,d,ry);
coverPoints.push({x:tx,z:tz});
}
function buildBarn(x,z,ry){
const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(9.5,1.6,13.5),MAT.stone,x,g0-0.7,z,ry,false,true);
const w=9,d=13,H=4.2;
const cs=Math.cos(ry),sn=Math.sin(ry);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
let p;
p=L(-w/2,0); solidBox(MAT.wood,0.35,H,d, p[0],g0+H/2,p[1], ry);
p=L(w/2,0);  solidBox(MAT.wood,0.35,H,d, p[0],g0+H/2,p[1], ry);
p=L(0,-d/2); solidBox(MAT.wood,w,H,0.35, p[0],g0+H/2,p[1], ry);
const seg=w*0.28;
p=L(-(w-seg)/2,d/2); solidBox(MAT.wood,seg,H,0.35, p[0],g0+H/2,p[1], ry);
p=L((w-seg)/2,d/2);  solidBox(MAT.wood,seg,H,0.35, p[0],g0+H/2,p[1], ry);
p=L(0,d/2); solidBox(MAT.wood,w-seg*2,1.0,0.35, p[0],g0+H-0.5,p[1], ry);
p=L(0,d/2); NAV_CLEARS.push({x:p[0],z:p[1],r:1.8});
for(let i=0;i<3;i++){
const hp=L(rand(-2.5,2.5),rand(-4.2,0.5));
const hx=hp[0], hz=hp[1];
mesh(new THREE.CylinderGeometry(1.1,1.3,1.6,10),MAT.hay,hx,g0+0.8,hz);
CYLS.push({x:hx,z:hz,r:1.2,y0:g0,y1:g0+1.6});
}
p=L(0,-d/2+2.2); solidBox(MAT.woodDark,w-0.8,0.25,4, p[0],g0+2.6,p[1], ry);
for(let i=0;i<5;i++){
p=L(w/2-1.4,-d/2+4.5+i*0.5);
solidBox(MAT.woodDark,1.2,0.2,0.9, p[0],g0+0.5+i*0.55,p[1], ry);
}
const r1=mesh(new THREE.BoxGeometry(w*0.62,0.15,d+0.5),MAT.wood,...(()=>{const q=L(-w*0.23,0);return [q[0],g0+H+0.85,q[1]];})(),ry); r1.rotation.z=0.5; addSnowCap(r1);
const r2=mesh(new THREE.BoxGeometry(w*0.62,0.15,d+0.5),MAT.wood,...(()=>{const q=L(w*0.23,0);return [q[0],g0+H+0.85,q[1]];})(),ry); r2.rotation.z=-0.5; addSnowCap(r2);
addCoverAround(x,z,w,d,ry);
}
function sandbagWall(x,z,len,ry){
const g0=heightAt(x,z);
const m=solidBox(MAT.sandbag,len,1.0,0.75,x,g0+0.5,z,ry);
coverPoints.push({x:x-Math.sin(ry)*1.4, z:z-Math.cos(ry)*1.4});
coverPoints.push({x:x+Math.sin(ry)*1.4, z:z+Math.cos(ry)*1.4});
return m;
}
function hedgehog(x,z){
const g0=heightAt(x,z);
for(let i=0;i<3;i++){
const b=mesh(new THREE.BoxGeometry(0.22,2.4,0.22),MAT.metalDark,x,g0+0.75,z);
b.rotation.set(rand(-0.5,0.5)+ (i*1.1), 0, 0.7+i*0.5);
}
CYLS.push({x,z,r:0.85,y0:g0,y1:g0+1.5});
coverPoints.push({x:x+rand(-1,1),z:z+rand(-1,1)});
}
// 铁丝网 (工程兵建造): 无硬碰撞, 进入者减速+刮伤
const wireMat=new THREE.MeshLambertMaterial({color:0x3c3a34});
function barbedWire(x,z,ry=0,len=3.6,builder=null){
const g0=heightAt(x,z);
const grp=new THREE.Group();
grp.position.set(x,g0,z);
grp.rotation.y=ry;
world.add(grp);
for(const t of [-len/2,0,len/2]){
const st=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,1.15,5),MAT.woodDark);
st.position.set(t,0.55,0);
st.rotation.z=rand(-0.14,0.14); st.rotation.x=rand(-0.1,0.1);
st.castShadow=true;
grp.add(st);
}
for(const hy of [0.3,0.62,0.95]){
const wr=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,len,4),wireMat);
wr.rotation.z=HPI;
wr.position.y=hy;
grp.add(wr);
}
for(let i=0;i<4;i++){
const dg=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,0.95,3),wireMat);
dg.position.set(rand(-len/2+0.4,len/2-0.4),0.6,rand(-0.2,0.2));
dg.rotation.z=HPI+rand(-0.8,0.8);
dg.rotation.y=rand(-0.4,0.4);
grp.add(dg);
}
const w={x,z,r:Math.max(1.5,len*0.5),grp,builder,alive:true};
wires.push(w);
return w;
}
const treeTrunkGeo=new THREE.CylinderGeometry(0.22,0.34,4.4,7);
const treeLeafGeo=new THREE.PlaneGeometry(5,5);
function tree(x,z,s=1){
const g0=heightAt(x,z);
const tr=mesh(treeTrunkGeo,MAT.bark,x,g0+2.2*s,z); tr.scale.setScalar(s);
for(let i=0;i<3;i++){
const lf=mesh(treeLeafGeo,MAT.leaves,x,g0+(3.4+i*0.6)*s,z,rand(0,Math.PI),false,false);
lf.rotation.x=rand(-0.25,0.25);
lf.scale.setScalar(s*rand(0.8,1.15));
}
CYLS.push({x,z,r:0.35*s,y0:g0,y1:g0+4*s});
}
function deadTree(x,z){
const g0=heightAt(x,z);
const t=mesh(new THREE.CylinderGeometry(0.14,0.3,3.6,6),MAT.woodDark,x,g0+1.8,z);
t.rotation.z=rand(-0.15,0.15);
const b1=mesh(new THREE.CylinderGeometry(0.05,0.1,1.6,5),MAT.woodDark,x+0.5,g0+3,z); b1.rotation.z=-0.9;
CYLS.push({x,z,r:0.3,y0:g0,y1:g0+3.4});
}
const craterGeo=new THREE.CircleGeometry(1,20);
const craterMat=new THREE.MeshLambertMaterial({color:0x4a4238,transparent:true,opacity:0.85,depthWrite:false});
const runtimeCraters=[];
function crater(x,z,r,runtime=false){
const m=mesh(craterGeo,craterMat,x,heightAt(x,z)+0.03,z,0,false,true);
m.rotation.x=-HPI; m.scale.setScalar(r);
m.renderOrder=1;
if(runtime){
runtimeCraters.push(m);
if(runtimeCraters.length>36){ const old=runtimeCraters.shift(); world.remove(old); }
return;
}
const rim=mesh(new THREE.TorusGeometry(r*0.8,r*0.14,6,14),MAT.craterRim,x,heightAt(x,z)+0.05,z);
rim.rotation.x=-HPI;
}
function crate(x,z,s=1,ry=0){
const g0=heightAt(x,z);
solidBox(MAT.wood,s,s,s,x,g0+s/2,z,ry);
coverPoints.push({x:x+rand(-1.3,1.3),z:z+rand(-1.3,1.3)});
}
function barrel(x,z){
const g0=heightAt(x,z);
mesh(new THREE.CylinderGeometry(0.42,0.42,1.1,10),MAT.metal,x,g0+0.55,z);
CYLS.push({x,z,r:0.45,y0:g0,y1:g0+1.1});
}
function wreckTruck(x,z,ry){
const g0=heightAt(x,z);
solidBox(MAT.metalDark,2.2,1.5,5.4,x,g0+0.95,z,ry);
const cab=mesh(new THREE.BoxGeometry(2.1,1.1,1.6),MAT.metalDark,x+Math.sin(ry)*1.6,g0+2.0,z+Math.cos(ry)*1.6,ry);
cab.rotation.z=0.12;
for(const s of [-1,1]){
const w1=mesh(new THREE.CylinderGeometry(0.55,0.55,0.35,10),MAT.metalDark, x+Math.cos(ry)*s*1.15, g0+0.55, z-Math.sin(ry)*s*1.15+Math.cos(ry)*1.4, ry);
w1.rotation.z=HPI;
}
addCoverAround(x,z,2.4,5.6,ry);
}
function stoneWall(x1,z1,x2,z2,h=1.15){
const dx=x2-x1,dz=z2-z1;
const len=Math.hypot(dx,dz), ry=Math.atan2(dx,dz)+HPI;
const steps=Math.ceil(len/6);
for(let i=0;i<steps;i++){
const t0=(i+0.5)/steps;
const x=x1+dx*t0, z=z1+dz*t0;
const g0=heightAt(x,z);
solidBox(MAT.stone,Math.min(6.2,len/steps+0.3),h,0.55,x,g0+h/2,z,ry);
}
coverPoints.push({x:(x1+x2)/2+dz/len*1.4,z:(z1+z2)/2-dx/len*1.4});
coverPoints.push({x:(x1+x2)/2-dz/len*1.4,z:(z1+z2)/2+dx/len*1.4});
}
function hedgerow(x1,z1,x2,z2){
const dx=x2-x1,dz=z2-z1;
const len=Math.hypot(dx,dz), ry=Math.atan2(dx,dz)+HPI;
const steps=Math.ceil(len/4);
for(let i=0;i<steps;i++){
const t0=(i+0.5)/steps;
const x=x1+dx*t0+rand(-0.4,0.4), z=z1+dz*t0+rand(-0.4,0.4);
const g0=heightAt(x,z);
const h=rand(2.2,3.0);
const m=mesh(new THREE.BoxGeometry(4.4,h,2.2),MAT.hedge,x,g0+h/2,z,ry);
addBoxCollider(x,g0+h/2,z, Math.abs(Math.sin(ry))>0.5?2.2:4.4, h, Math.abs(Math.sin(ry))>0.5?4.4:2.2);
}
}
function rubblePile(x,z,r){
const g0=heightAt(x,z);
for(let i=0;i<6;i++){
const bx=x+rand(-r,r)*0.7, bz=z+rand(-r,r)*0.7;
const s=rand(0.5,1.4);
const m=mesh(new THREE.BoxGeometry(s,s*0.7,s),Math.random()<0.5?MAT.rubble:MAT.brick,bx,g0+s*0.3,bz,rand(0,3));
m.rotation.x=rand(-0.3,0.3);
}
const mound=mesh(new THREE.SphereGeometry(r*0.8,10,6),MAT.rubble,x,g0-r*0.35,z);
CYLS.push({x,z,r:r*0.65,y0:g0,y1:g0+r*0.5});
coverPoints.push({x:x+r,z}); coverPoints.push({x:x-r,z});
}
function tent(x,z,ry){
const g0=heightAt(x,z);
const m1=mesh(new THREE.BoxGeometry(3.4,0.12,4.4),MAT.tentA,x-0.85,g0+1.1,z,ry); m1.rotation.z=0.72;
const m2=mesh(new THREE.BoxGeometry(3.4,0.12,4.4),MAT.tentB,x+0.85,g0+1.1,z,ry); m2.rotation.z=-0.72;
addBoxCollider(x,g0+0.9,z,1.5,1.8,4);
}
function twoStoryHouse(x,z,ry,mat){
const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(8.5,1.6,9.5),MAT.stone,x,g0-0.7,z,ry,false,true);
const w=8,d=9,fh=2.9;
const cs=Math.cos(ry),sn=Math.sin(ry);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
let p;
// 一层墙(门+窗)
const dw=1.3, seg=(w-dw)/2;
p=L(0,d/2); NAV_CLEARS.push({x:p[0],z:p[1],r:1.4});
p=L(-(dw+seg)/2,d/2); solidBox(mat,seg,fh,0.35,p[0],g0+fh/2,p[1],ry);
p=L((dw+seg)/2,d/2); solidBox(mat,seg,fh,0.35,p[0],g0+fh/2,p[1],ry);
p=L(0,d/2); solidBox(mat,dw,0.7,0.35,p[0],g0+fh-0.35,p[1],ry);
p=L(0,-d/2); solidBox(mat,w,fh,0.35,p[0],g0+fh/2,p[1],ry);
p=L(-w/2,0); solidBox(mat,0.35,fh,d,p[0],g0+fh/2,p[1],ry);
p=L(w/2,0); solidBox(mat,0.35,fh,d,p[0],g0+fh/2,p[1],ry);
// 二层地板(留楼梯口)
p=L(-0.9,0); solidBox(MAT.woodDark,w-1.8-1.6,0.22,d,p[0],g0+fh,p[1],ry);
p=L(w/2-0.85,-d/2+2.6); solidBox(MAT.woodDark,1.7,0.22,d-5.2,p[0],g0+fh,p[1],ry);
// 楼梯(0.48步高)
for(let i=0;i<6;i++){
p=L(w/2-0.85,d/2-0.8-i*0.62);
solidBox(MAT.woodDark,1.5,0.22,0.7,p[0],g0+0.42+i*0.48,p[1],ry);
}
// 二层墙(窗)
const wh=2.6;
for(const side of [d/2,-d/2]){
const winW=1.4, seg2=(w-winW*2)/3;
for(const wx of [-(winW+seg2),0,winW+seg2]){
p=L(wx,side);
solidBox(mat,wx===0?winW:seg2+0.4,0.9,0.35,p[0],g0+fh+0.45,p[1],ry);
solidBox(mat,wx===0?winW:seg2+0.4,0.7,0.35,p[0],g0+fh+wh-0.35,p[1],ry);
}
p=L(-(winW/2+seg2/2)*1.05,side); solidBox(mat,seg2,wh,0.35,p[0],g0+fh+wh/2,p[1],ry);
p=L((winW/2+seg2/2)*1.05,side); solidBox(mat,seg2,wh,0.35,p[0],g0+fh+wh/2,p[1],ry);
}
p=L(-w/2,0); solidBox(mat,0.35,wh,d,p[0],g0+fh+wh/2,p[1],ry);
p=L(w/2,1.8); solidBox(mat,0.35,wh,d-3.6,p[0],g0+fh+wh/2,p[1],ry);
p=L(w/2,-d/2+0.7); solidBox(mat,0.35,wh,1.4,p[0],g0+fh+wh/2,p[1],ry);
// 顶
p=L(0,0); addSnowCap(solidBox(mat,w+0.4,0.25,d+0.4,p[0],g0+fh+wh+0.1,p[1],ry));
addCoverAround(x,z,w,d,ry);
coverPoints.push({x,z});
}
function watchtower(x,z){
const g0=heightAt(x,z);
const h=5.2;
for(const [lx,lz] of [[-1.3,-1.3],[1.3,-1.3],[-1.3,1.3],[1.3,1.3]]){
const leg=mesh(new THREE.BoxGeometry(0.22,h,0.22),MAT.woodDark,x+lx,g0+h/2,z+lz);
leg.rotation.y=0.1;
CYLS.push({x:x+lx,z:z+lz,r:0.18,y0:g0,y1:g0+h});
}
solidBox(MAT.wood,1.4,0.25,3.4,x-1.2,g0+h,z,0);
solidBox(MAT.wood,1.4,0.25,3.4,x+1.2,g0+h,z,0);
solidBox(MAT.wood,1.0,0.25,1.4,x,g0+h,z-1.0,0);
solidBox(MAT.wood,1.0,0.25,2.0,x,g0+h,z+0.75,0);
solidBox(MAT.wood,3.6,0.8,0.18,x,g0+h+0.55,z-1.7,0);
solidBox(MAT.wood,1.2,0.8,0.18,x-1.2,g0+h+0.55,z+1.8,0);
solidBox(MAT.wood,1.2,0.8,0.18,x+1.2,g0+h+0.55,z+1.8,0);
solidBox(MAT.wood,0.18,0.8,3.6,x-1.75,g0+h+0.55,z,0);
solidBox(MAT.wood,0.18,0.8,3.6,x+1.75,g0+h+0.55,z,0);
const roof=mesh(new THREE.BoxGeometry(4,0.12,4),MAT.woodDark,x,g0+h+2.2,z);
roof.rotation.z=0.06;
addSnowCap(roof);
// 攀爬梯(功能性): 两根立轨 + 横档, 靠近按W向上爬
{
const lz2=z+1.92;
mesh(new THREE.BoxGeometry(0.07,h+0.5,0.07),MAT.woodDark,x-0.3,g0+(h+0.5)/2,lz2);
mesh(new THREE.BoxGeometry(0.07,h+0.5,0.07),MAT.woodDark,x+0.3,g0+(h+0.5)/2,lz2);
for(let i=0;i<10;i++){
mesh(new THREE.BoxGeometry(0.64,0.05,0.05),MAT.woodDark,x,g0+0.45+i*0.5,lz2);
}
LADDERS.push({x,z:lz2,y0:g0,y1:g0+h+0.28,face:0});
}
coverPoints.push({x,z});
}
// ===== 各战役独立布局 =====
// 倒木 (丛林)
function fallenLog(x,z,ry){
const g0=heightAt(x,z);
const lg=mesh(new THREE.CylinderGeometry(0.28,0.34,4.5,7),MAT.bark,x,g0+0.32,z);
lg.rotation.z=HPI; lg.rotation.y=ry;
addBoxCollider(x,g0+0.3,z,Math.abs(Math.cos(ry))*4+0.6,0.6,Math.abs(Math.sin(ry))*4+0.6);
coverPoints.push({x:x+Math.sin(ry+HPI)*1.2,z:z+Math.cos(ry+HPI)*1.2});
}
// 木屋 (雪地)
function logCabin(x,z,ry){
const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(6.4,1.0,5.4),MAT.stone,x,g0-0.4,z,ry,false,true);
const w=6,d=5,H=2.5,t=0.3;
const cs=Math.cos(ry),sn=Math.sin(ry);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
const wallGs=[];
let p;
dBegin();
const dw=1.1, seg=(w-dw)/2;
p=L(0,d/2); NAV_CLEARS.push({x:p[0],z:p[1],r:1.0});
p=L(-(dw+seg)/2,d/2); dBox(MAT.woodDark,seg,H,t,p[0],g0+H/2,p[1],ry);
p=L((dw+seg)/2,d/2); dBox(MAT.woodDark,seg,H,t,p[0],g0+H/2,p[1],ry);
p=L(0,d/2); dBox(MAT.woodDark,dw,H-1.8,t,p[0],g0+H-(H-1.8)/2,p[1],ry);
wallGs.push(dEnd());
dBegin(); p=L(0,-d/2); dBox(MAT.woodDark,w,H,t,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
dBegin(); p=L(-w/2,0); dBox(MAT.woodDark,t,H,d,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
dBegin(); p=L(w/2,0); dBox(MAT.woodDark,t,H,d,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
p=L(0,d*0.26);
const r1=mesh(new THREE.BoxGeometry(w+1.1,0.14,d*0.64),MAT.roof,p[0],g0+H+0.36,p[1],ry); r1.rotation.x=0.38; addSnowCap(r1);
p=L(0,-d*0.26);
const r2=mesh(new THREE.BoxGeometry(w+1.1,0.14,d*0.64),MAT.roof,p[0],g0+H+0.36,p[1],ry); r2.rotation.x=-0.38; addSnowCap(r2);
const roofRef={m:[r1,r2],dead:0,done:false};
for(const g of wallGs) if(g) g.roofRef=roofRef;
addCoverAround(x,z,w,d,ry);
}
// 混凝土碉堡 (射击孔朝向 face)
function bunker(x,z,face){
const g0=heightAt(x,z);
const sn=Math.sin(face),cs=Math.cos(face);
addSnowCap(solidBox(MAT.stone,3.6,0.5,3.2, x,g0+2.05,z, face));
solidBox(MAT.stone,3.6,1.9,0.5, x-sn*1.5,g0+0.95,z-cs*1.5, face);
solidBox(MAT.stone,0.5,1.9,3.0, x+cs*1.6-sn*0.1,g0+0.95,z-sn*1.6-cs*0.1, face);
solidBox(MAT.stone,0.5,1.9,3.0, x-cs*1.6-sn*0.1,g0+0.95,z+sn*1.6-cs*0.1, face);
solidBox(MAT.stone,1.2,0.8,0.5, x-cs*1.2+sn*1.4,g0+0.4,z+sn*1.2+cs*1.4, face);
solidBox(MAT.stone,1.2,0.8,0.5, x+cs*1.2+sn*1.4,g0+0.4,z-sn*1.2+cs*1.4, face);
solidBox(MAT.stone,3.6,0.35,0.5, x+sn*1.4,g0+1.65,z+cs*1.4, face);
coverPoints.push({x:x-sn*2.6,z:z-cs*2.6},{x,z});
}
// 补给库 (破袭模式目标, 可被炸毁)
function buildDepot(x,z,ry){
const g0=heightAt(x,z);
dBegin();
dBox(MAT.woodDark,2.6,1.7,1.7, x-1.6,g0+0.85,z+0.8, ry);
dBox(MAT.woodDark,2.2,1.3,1.5, x+1.4,g0+0.65,z-0.9, ry+0.4);
dBox(MAT.wood,1.6,1.1,1.2, x+0.4,g0+0.55,z+1.6, ry+0.9);
dBox(MAT.metalDark,1.4,1.5,1.4, x-0.4,g0+0.75,z-1.6, ry);
const g=dEnd();
if(g) g.hp=720;
for(let i=0;i<3;i++) barrel(x+rand(-3,3),z+rand(-3,3));
sandbagWall(x+3.6,z,4,HPI); sandbagWall(x-3.6,z,4,HPI);
const pole=mesh(new THREE.CylinderGeometry(0.06,0.08,5,6),MAT.metal,x,g0+2.5,z+2.5);
coverPoints.push({x:x+4,z:z+2},{x:x-4,z:z-2});
return g;
}
// -- 诺曼底: 乡村田园 --
