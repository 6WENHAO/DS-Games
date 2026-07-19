'use strict';
const FLATS=[];
{
const addFlat=(x,z,r)=>FLATS.push({x,z,r,h:rawHeight(x,z)*0.55});
for(const b of CAMPAIGN.bases) addFlat(b.x,b.z,20);
for(const f of CAMPAIGN.flags) addFlat(f.x,f.z,f.r+12);
if(CAMPAIGN.terr==='rolling') addFlat(0,0,34);
}
function rawHeight(x,z){
switch(CAMPAIGN.terr){
case 'urban':
return 0.45*Math.sin(x*0.03)*Math.cos(z*0.028)
+ 0.25*Math.sin(x*0.09+1)*Math.sin(z*0.07+0.5);
case 'delta':
return 0.55*Math.sin(x*0.018)*Math.cos(z*0.02)
+ 0.35*Math.sin(x*0.06+2)*Math.sin(z*0.05+1) - 0.15;
case 'loess':
return 3.8*Math.sin(x*0.018+0.5)*Math.cos(z*0.021)
+ 2.0*(1-Math.abs(Math.sin(x*0.03+z*0.012+1)))
+ 0.8*Math.sin(x*0.1+3)*Math.cos(z*0.09+1.2)-0.6;
case 'jungle':
return 2.3*Math.sin(x*0.014)*Math.cos(z*0.017+1)
+ 1.25*Math.sin(x*0.05+1.2)*Math.sin(z*0.043+2)
+ 0.5*Math.sin(x*0.12+3)*Math.cos(z*0.1);
case 'alpine':{
// 雪岭: 山脊线噪声, 真正的山地起伏
const r1=1-Math.abs(Math.sin(x*0.021+z*0.009));
const r2=1-Math.abs(Math.sin(z*0.026-x*0.007+1.3));
const r3=1-Math.abs(Math.sin((x+z)*0.014+2.6));
return r1*r1*6.5+r2*r2*4.2+r3*r3*2.5
+1.3*Math.sin(x*0.05)*Math.cos(z*0.045)-2.6;
}
default:
return 1.4*Math.sin(x*0.021)*Math.cos(z*0.024)
+ 0.9*Math.sin(x*0.052+1.7)*Math.sin(z*0.043+0.6)
+ 0.5*Math.sin(x*0.11+3.1)*Math.cos(z*0.09+1.2);
}
}
function heightAt(x,z){
let h=rawHeight(x,z);
for(const f of FLATS){
const d=Math.hypot(x-f.x,z-f.z);
if(d<f.r){
const t=1-d/f.r;
const s=t*t*(3-2*t);
h=lerp(h,f.h,s);
}
}
// 战壕: 沿线下凹
for(let i=0;i<TRENCHES.length;i++){
const t=TRENCHES[i];
const d=segDist(x,z,t.x1,t.z1,t.x2,t.z2);
if(d<2.4){
const k=1-d/2.4;
h-=1.3*k*k*(3-2*k);
}
}
// 河道: 沿折线下切
if(RIVER){
let rd=1e9;
const P=RIVER.pts;
for(let i=0;i<P.length-1;i++){
const d=segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]);
if(d<rd) rd=d;
}
if(rd<RIVER.w){
const k=1-rd/RIVER.w;
h-=(RIVER.ice?1.2:1.9)*k*k*(3-2*k);
}
}
return h;
}
// 各战役的战壕布局 (需在地形网格生成前注册)
const TRENCHES=[];
for(const t of (CAMPAIGN.trench||[])) TRENCHES.push({x1:t[0],z1:t[1],x2:t[2],z2:t[3]});
function roadDist(x,z){
let d=CAMPAIGN.sineRoad?Math.abs(z - 3*Math.sin(x*0.02)):1e9;
for(const r of CAMPAIGN.roads){
d=Math.min(d,segDist(x,z,r[0],r[1],r[2],r[3]));
}
return d;
}
function segDist(px,pz,ax,az,bx,bz){
const abx=bx-ax,abz=bz-az;
const t=clamp(((px-ax)*abx+(pz-az)*abz)/(abx*abx+abz*abz),0,1);
return Math.hypot(px-(ax+abx*t), pz-(az+abz*t));
}
{
const seg=Math.min(176,Math.round((MAP_SIZE+40)/3.4));
const geo=new THREE.PlaneGeometry(MAP_SIZE+40,MAP_SIZE+40,seg,seg);
geo.rotateX(-HPI);
const pos=geo.attributes.position;
const cols=new Float32Array(pos.count*3);
for(let i=0;i<pos.count;i++){
const x=pos.getX(i),z=pos.getZ(i);
pos.setY(i, heightAt(x,z));
const rd=roadDist(x,z);
let r=1,g=1,b=1;
if(rd<5){ const t=1-rd/5; r=lerp(1,1.16,t); g=lerp(1,0.94,t); b=lerp(1,0.72,t); }
// 战壕土色贴层: 沟底沟沿露出翻掘的泥土色 (雪地战役下与积雪形成强对比)
let td=1e9;
for(const t2 of TRENCHES){ const dd=segDist(x,z,t2.x1,t2.z1,t2.x2,t2.z2); if(dd<td) td=dd; }
if(td<3.2){
const k=1-td/3.2, s=k*k*(3-2*k)*0.92;
const dr=THEME.snow?0.62:0.74, dg=THEME.snow?0.5:0.62, db=THEME.snow?0.36:0.46;
r=lerp(r,dr,s); g=lerp(g,dg,s); b=lerp(b,db,s);
}
const n=Math.sin(x*0.4)*Math.cos(z*0.37);
r*=1+n*0.05; g*=1+n*0.05; b*=1+n*0.04;
cols[i*3]=r; cols[i*3+1]=g; cols[i*3+2]=b;
}
geo.setAttribute('color', new THREE.BufferAttribute(cols,3));
geo.computeVertexNormals();
const ground=new THREE.Mesh(geo, MAT.grass);
ground.receiveShadow=true;
scene.add(ground);
}
