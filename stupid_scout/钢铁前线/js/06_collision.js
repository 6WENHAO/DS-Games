'use strict';
const BOXES=[];
const CYLS=[];
const SHOOTABLES=[];
function addBoxCollider(cx,cy,cz,w,h,d){
const b={minX:cx-w/2,minY:cy-h/2,minZ:cz-d/2,maxX:cx+w/2,maxY:cy+h/2,maxZ:cz+d/2,gh:heightAt(cx,cz)};
BOXES.push(b); return b;
}
function rayBox(o,dir,b,maxD){
let tmin=0,tmax=maxD, n=[0,0,0];
const oo=[o.x,o.y,o.z], dd=[dir.x,dir.y,dir.z];
const mn=[b.minX,b.minY,b.minZ], mx=[b.maxX,b.maxY,b.maxZ];
let axis=-1, sign=0;
for(let i=0;i<3;i++){
if(Math.abs(dd[i])<1e-9){
if(oo[i]<mn[i]||oo[i]>mx[i]) return null;
} else {
const inv=1/dd[i];
let t1=(mn[i]-oo[i])*inv, t2=(mx[i]-oo[i])*inv;
let s=-1;
if(t1>t2){ const tmp=t1; t1=t2; t2=tmp; s=1; }
if(t1>tmin){ tmin=t1; axis=i; sign=s; }
if(t2<tmax) tmax=t2;
if(tmin>tmax) return null;
}
}
if(tmin<=0.0001) return null;
n[axis]=sign;
return { t:tmin, nx:n[0], ny:n[1], nz:n[2] };
}
function rayCyl(o,dir,c,maxD){
const ox=o.x-c.x, oz=o.z-c.z;
const a=dir.x*dir.x+dir.z*dir.z;
if(a<1e-9) return null;
const b2=2*(ox*dir.x+oz*dir.z);
const cc=ox*ox+oz*oz-c.r*c.r;
const disc=b2*b2-4*a*cc;
if(disc<0) return null;
const t=(-b2-Math.sqrt(disc))/(2*a);
if(t<0.0001||t>maxD) return null;
const y=o.y+dir.y*t;
if(y<c.y0||y>c.y1) return null;
const px=o.x+dir.x*t, pz=o.z+dir.z*t;
const nx=(px-c.x)/c.r, nz=(pz-c.z)/c.r;
return { t, nx, ny:0, nz };
}
const OCC={ res:1, N:0, off:(MAP_SIZE+40)/2, data:null };
function buildOccupancy(){
OCC.N=Math.ceil((MAP_SIZE+40)/OCC.res)+1;
const {res,N,off}=OCC;
const d=new Uint8Array(N*N);
const pad=0.6;
const mark=(x0,z0,x1,z1,test)=>{
const i0=clamp(Math.floor((x0+off)/res),0,N-1), i1=clamp(Math.ceil((x1+off)/res),0,N-1);
const j0=clamp(Math.floor((z0+off)/res),0,N-1), j1=clamp(Math.ceil((z1+off)/res),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
if(test){ const x=i*res-off, z=j*res-off; if(!test(x,z)) continue; }
d[j*N+i]=1;
}
};
for(const b of BOXES){
if(b.dead) continue;
const gh=b.gh;
if(b.maxY<gh+0.5||b.minY>gh+1.75) continue;
mark(b.minX-pad,b.minZ-pad,b.maxX+pad,b.maxZ+pad,null);
}
// 门口/通道强制通行区: 只清除墙体外扩溢出, 在圆柱障碍标记之前应用
for(const cl of NAV_CLEARS){
const i0=clamp(Math.floor((cl.x-cl.r+off)/res),0,N-1), i1=clamp(Math.ceil((cl.x+cl.r+off)/res),0,N-1);
const j0=clamp(Math.floor((cl.z-cl.r+off)/res),0,N-1), j1=clamp(Math.ceil((cl.z+cl.r+off)/res),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
const x=i*res-off, z=j*res-off;
if((x-cl.x)*(x-cl.x)+(z-cl.z)*(z-cl.z)<=cl.r*cl.r) d[j*N+i]=0;
}
}
// 圆柱障碍(草垛/拒马等)最后标记, 保证寻路不会穿过实体
for(const c of CYLS){
if(c.r<0.28) continue;
const rr=c.r+pad;
mark(c.x-rr,c.z-rr,c.x+rr,c.z+rr,(x,z)=>((x-c.x)*(x-c.x)+(z-c.z)*(z-c.z))<=rr*rr);
}
// 铁丝网: 标记为占用格, 让Bot寻路尽量绕开 (物理上仍可通行, 误入会减速受伤)
for(const w of wires){
const rr=Math.max(0.6,w.r*0.85);
mark(w.x-rr,w.z-rr,w.x+rr,w.z+rr,(x,z)=>((x-w.x)*(x-w.x)+(z-w.z)*(z-w.z))<=rr*rr);
}
OCC.data=d;
}
function registerDynCollider(cx,cy,cz,w,h,d){
const b=addBoxCollider(cx,cy,cz,w,h,d);
const bi=BOXES.length-1;
if(RGRID.boxCells){
const {cell,N,off}=RGRID;
const i0=clamp(Math.floor((b.minX+off)/cell),0,N-1),i1=clamp(Math.floor((b.maxX+off)/cell),0,N-1);
const j0=clamp(Math.floor((b.minZ+off)/cell),0,N-1),j1=clamp(Math.floor((b.maxZ+off)/cell),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) RGRID.boxCells[j*N+i].push(bi);
}
if(OCC.data){
const i0=clamp(Math.floor((b.minX-0.6+OCC.off)/OCC.res),0,OCC.N-1),i1=clamp(Math.ceil((b.maxX+0.6+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((b.minZ-0.6+OCC.off)/OCC.res),0,OCC.N-1),j1=clamp(Math.ceil((b.maxZ+0.6+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) OCC.data[j*OCC.N+i]=1;
}
return b;
}
function killDynCollider(b){
b.dead=true;
if(OCC.data){
const i0=clamp(Math.floor((b.minX-0.7+OCC.off)/OCC.res),0,OCC.N-1),i1=clamp(Math.ceil((b.maxX+0.7+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((b.minZ-0.7+OCC.off)/OCC.res),0,OCC.N-1),j1=clamp(Math.ceil((b.maxZ+0.7+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) OCC.data[j*OCC.N+i]=0;
}
b.minX=99999; b.minY=99999; b.minZ=99999; b.maxX=99999.1; b.maxY=99999.1; b.maxZ=99999.1;
}
function occBlocked(x,z){
const i=Math.round((x+OCC.off)/OCC.res), j=Math.round((z+OCC.off)/OCC.res);
if(i<0||j<0||i>=OCC.N||j>=OCC.N) return true;
return OCC.data[j*OCC.N+i]===1;
}
const RGRID={ cell:13, N:0, off:(MAP_SIZE+60)/2, boxCells:null, cylCells:null, stampB:null, stampC:null, gen:0 };
function buildSpatialIndex(){
RGRID.N=Math.ceil((MAP_SIZE+60)/RGRID.cell);
const {cell,N,off}=RGRID;
RGRID.boxCells=Array.from({length:N*N},()=>[]);
RGRID.cylCells=Array.from({length:N*N},()=>[]);
BOXES.forEach((b,bi)=>{
const i0=clamp(Math.floor((b.minX+off)/cell),0,N-1), i1=clamp(Math.floor((b.maxX+off)/cell),0,N-1);
const j0=clamp(Math.floor((b.minZ+off)/cell),0,N-1), j1=clamp(Math.floor((b.maxZ+off)/cell),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) RGRID.boxCells[j*N+i].push(bi);
});
CYLS.forEach((c,ci)=>{
const i0=clamp(Math.floor((c.x-c.r+off)/cell),0,N-1), i1=clamp(Math.floor((c.x+c.r+off)/cell),0,N-1);
const j0=clamp(Math.floor((c.z-c.r+off)/cell),0,N-1), j1=clamp(Math.floor((c.z+c.r+off)/cell),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) RGRID.cylCells[j*N+i].push(ci);
});
RGRID.stampB=new Int32Array(BOXES.length+96);
RGRID.stampC=new Int32Array(CYLS.length+16);
}
const _rcP=V3(), _rcN=V3();
function raycastWorld(o,dir,maxD){
let best=maxD, bn=null, kind=null;
if(RGRID.boxCells){
const {cell,N,off,boxCells,cylCells,stampB,stampC}=RGRID;
const gen=++RGRID.gen;
let ci=Math.floor((o.x+off)/cell), cj=Math.floor((o.z+off)/cell);
const dx=dir.x, dz=dir.z;
const stepI=dx>0?1:-1, stepJ=dz>0?1:-1;
const tDX=Math.abs(dx)<1e-9?Infinity:cell/Math.abs(dx);
const tDZ=Math.abs(dz)<1e-9?Infinity:cell/Math.abs(dz);
let tMaxX=Math.abs(dx)<1e-9?Infinity:(dx>0?((ci+1)*cell-off-o.x):(o.x-(ci*cell-off)))/Math.abs(dx);
let tMaxZ=Math.abs(dz)<1e-9?Infinity:(dz>0?((cj+1)*cell-off-o.z):(o.z-(cj*cell-off)))/Math.abs(dz);
let t=0, guard=0;
while(t<=best&&guard++<70){
if(ci>=0&&cj>=0&&ci<N&&cj<N){
const idx=cj*N+ci;
const bl=boxCells[idx];
for(let k=0;k<bl.length;k++){
const bi=bl[k];
if(stampB[bi]===gen) continue;
stampB[bi]=gen;
const r=rayBox(o,dir,BOXES[bi],best);
if(r){ best=r.t; bn=r; kind='box'; }
}
const cl=cylCells[idx];
for(let k=0;k<cl.length;k++){
const cy2=cl[k];
if(stampC[cy2]===gen) continue;
stampC[cy2]=gen;
const r=rayCyl(o,dir,CYLS[cy2],best);
if(r){ best=r.t; bn=r; kind='cyl'; }
}
} else if(ci<-1||cj<-1||ci>N||cj>N) break;
if(tMaxX<tMaxZ){ t=tMaxX; tMaxX+=tDX; ci+=stepI; }
else { t=tMaxZ; tMaxZ+=tDZ; cj+=stepJ; }
}
} else {
for(const b of BOXES){ const r=rayBox(o,dir,b,best); if(r){ best=r.t; bn=r; kind='box'; } }
for(const c of CYLS){ const r=rayCyl(o,dir,c,best); if(r){ best=r.t; bn=r; kind='cyl'; } }
}
if(dir.y<0.35){
let t=0.5;
const step=1.8;
while(t<best){
const x=o.x+dir.x*t, y=o.y+dir.y*t, z=o.z+dir.z*t;
const gh=heightAt(x,z);
if(y<=gh){
let lo=t-step, hi=t;
for(let i=0;i<6;i++){
const m=(lo+hi)/2;
(o.y+dir.y*m<=heightAt(o.x+dir.x*m,o.z+dir.z*m))?hi=m:lo=m;
}
best=hi; bn={nx:0,ny:1,nz:0}; kind='ground';
break;
}
t+=step;
}
}
if(!bn) return null;
_rcP.set(o.x+dir.x*best,o.y+dir.y*best,o.z+dir.z*best);
_rcN.set(bn.nx,bn.ny,bn.nz);
return { dist:best, point:_rcP, normal:_rcN, kind };
}
function collideMove(pos, radius){
if(RGRID.boxCells){
// 空间网格加速: 只检查周边格的碰撞体
const {cell,N,off}=RGRID;
const ci=clamp(Math.floor((pos.x+off)/cell),0,N-1), cj=clamp(Math.floor((pos.z+off)/cell),0,N-1);
RGRID.gen++;
const g=RGRID.gen, stamp=RGRID.stampB, stampC=RGRID.stampC;
for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
const ni=ci+di,nj=cj+dj;
if(ni<0||nj<0||ni>=N||nj>=N) continue;
const list=RGRID.boxCells[nj*N+ni];
for(let k=0;k<list.length;k++){
const bi=list[k];
if(stamp[bi]===g) continue; stamp[bi]=g;
const b=BOXES[bi];
if(pos.y+1.7<b.minY||pos.y+0.25>b.maxY) continue;
if(b.maxY-pos.y<=0.56) continue;
const cx=clamp(pos.x,b.minX,b.maxX), cz=clamp(pos.z,b.minZ,b.maxZ);
let dx=pos.x-cx, dz=pos.z-cz;
const d2=dx*dx+dz*dz;
if(d2<radius*radius){
if(d2<1e-8){
const l=Math.min(pos.x-b.minX,b.maxX-pos.x), rgt=Math.min(pos.z-b.minZ,b.maxZ-pos.z);
if(l<rgt) pos.x = (pos.x-b.minX<b.maxX-pos.x)? b.minX-radius : b.maxX+radius;
else pos.z = (pos.z-b.minZ<b.maxZ-pos.z)? b.minZ-radius : b.maxZ+radius;
} else {
const d=Math.sqrt(d2), push=(radius-d)/d;
pos.x+=dx*push; pos.z+=dz*push;
}
}
}
const listC=RGRID.cylCells[nj*N+ni];
for(let k=0;k<listC.length;k++){
const ciX=listC[k];
if(stampC[ciX]===g) continue; stampC[ciX]=g;
const c=CYLS[ciX];
if(pos.y+1.7<c.y0||pos.y+0.2>c.y1) continue;
let dx=pos.x-c.x, dz=pos.z-c.z;
const rr=c.r+radius, d2=dx*dx+dz*dz;
if(d2<rr*rr&&d2>1e-8){
const d=Math.sqrt(d2), push=(rr-d)/d;
pos.x+=dx*push; pos.z+=dz*push;
}
}
}
const lim=MAP_SIZE/2+8;
pos.x=clamp(pos.x,-lim,lim); pos.z=clamp(pos.z,-lim,lim);
return;
}
for(const b of BOXES){
if(pos.y+1.7<b.minY||pos.y+0.25>b.maxY) continue;
if(b.maxY-pos.y<=0.56) continue;
const cx=clamp(pos.x,b.minX,b.maxX), cz=clamp(pos.z,b.minZ,b.maxZ);
let dx=pos.x-cx, dz=pos.z-cz;
const d2=dx*dx+dz*dz;
if(d2<radius*radius){
if(d2<1e-8){
const l=Math.min(pos.x-b.minX,b.maxX-pos.x), rgt=Math.min(pos.z-b.minZ,b.maxZ-pos.z);
if(l<rgt) pos.x = (pos.x-b.minX<b.maxX-pos.x)? b.minX-radius : b.maxX+radius;
else pos.z = (pos.z-b.minZ<b.maxZ-pos.z)? b.minZ-radius : b.maxZ+radius;
} else {
const d=Math.sqrt(d2), push=(radius-d)/d;
pos.x+=dx*push; pos.z+=dz*push;
}
}
}
for(const c of CYLS){
if(pos.y+1.7<c.y0||pos.y+0.2>c.y1) continue;
let dx=pos.x-c.x, dz=pos.z-c.z;
const rr=c.r+radius, d2=dx*dx+dz*dz;
if(d2<rr*rr&&d2>1e-8){
const d=Math.sqrt(d2), push=(rr-d)/d;
pos.x+=dx*push; pos.z+=dz*push;
}
}
const lim=MAP_SIZE/2+8;
pos.x=clamp(pos.x,-lim,lim); pos.z=clamp(pos.z,-lim,lim);
}
// 平滑坡道(楼梯行走面): 台阶只做视觉/子弹碰撞, 行走高度由坡道插值 → 上楼不再一顿一顿
const RAMPS=[];
function addRamp(x,z,ry,w,len,y0,y1){ RAMPS.push({x,z,ry,w,len,y0,y1,sn:Math.sin(ry),cs:Math.cos(ry)}); }
function rampHeightAt(x,z,curY){
let best=-1e9;
for(let i=0;i<RAMPS.length;i++){
const r=RAMPS[i];
const dx=x-r.x, dz=z-r.z;
const lx=dx*r.cs-dz*r.sn;
const lz=dx*r.sn+dz*r.cs;
if(Math.abs(lx)>r.w/2+0.12||lz<-r.len/2-0.25||lz>r.len/2+0.25) continue;
const t=clamp((lz+r.len/2)/r.len,0,1);
const hy=r.y0+(r.y1-r.y0)*t;
if(hy<=curY+0.55&&hy>best) best=hy;
}
return best;
}
function standHeight(x,z,curY){
let h=heightAt(x,z);
const rh=RAMPS.length?rampHeightAt(x,z,curY):-1e9;
if(rh>h) h=rh;
if(RGRID.boxCells){
const {cell,N,off}=RGRID;
const ci=clamp(Math.floor((x+off)/cell),0,N-1), cj=clamp(Math.floor((z+off)/cell),0,N-1);
const list=RGRID.boxCells[cj*N+ci];
for(let k=0;k<list.length;k++){
const b=BOXES[list[k]];
if(b.stair) continue;
if(x>b.minX-0.05&&x<b.maxX+0.05&&z>b.minZ-0.05&&z<b.maxZ+0.05){
if(b.maxY<=curY+0.55&&b.maxY>h) h=b.maxY;
}
}
return h;
}
for(const b of BOXES){
if(b.stair) continue;
if(x>b.minX-0.05&&x<b.maxX+0.05&&z>b.minZ-0.05&&z<b.maxZ+0.05){
if(b.maxY<=curY+0.55&&b.maxY>h) h=b.maxY;
}
}
return h;
}
// 梯子: 玩家贴近后按W向上攀爬(瞭望塔等)
const LADDERS=[];
