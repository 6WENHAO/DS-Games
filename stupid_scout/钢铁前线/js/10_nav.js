'use strict';
// ===================== 寻路 (2m 细网格 A*) =====================
// 关键改进(根治"出不了屋"):
// 1) 网格 5m → 2m: 1.2m 的门洞在网格上真实存在
// 2) 格子通行性用 5 点采样(中心加权)判定, 而不是单点碰运气
// 3) 对角移动需两侧正交格都通(防切墙角), 路径拉绳平滑步距加密
const NAV = (()=> {
const SP=2, N=Math.floor(MAP_SIZE/SP)+1, OFF=MAP_SIZE/2, NN=N*N;
const open=new Uint8Array(NN);
const idx=(i,j)=>j*N+i;
const toW=(i,j)=>[i*SP-OFF, j*SP-OFF];
const toG=(x,z)=>[clamp(Math.round((x+OFF)/SP),0,N-1), clamp(Math.round((z+OFF)/SP),0,N-1)];
function cellOpen(x,z){
let free=0;
if(!occBlocked(x,z)) free+=2;
if(!occBlocked(x-0.6,z-0.6)) free++;
if(!occBlocked(x+0.6,z-0.6)) free++;
if(!occBlocked(x-0.6,z+0.6)) free++;
if(!occBlocked(x+0.6,z+0.6)) free++;
return free>=3;
}
function rebuildOpen(){
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
const [x,z]=toW(i,j);
open[idx(i,j)]=cellOpen(x,z)?1:0;
}
}
rebuildOpen();
function lineClear(x1,z1,x2,z2){
const d=Math.hypot(x2-x1,z2-z1), steps=Math.ceil(d/0.55);
for(let s=1;s<steps;s++){
const t=s/steps;
if(occBlocked(x1+(x2-x1)*t, z1+(z2-z1)*t)) return false;
}
return true;
}
const gScore=new Float32Array(NN), came=new Int32Array(NN), visitGen=new Int32Array(NN);
const heapIdx=new Int32Array(NN*2), heapKey=new Float32Array(NN*2);
let gen=0;
const DI=[1,-1,0,0,1,1,-1,-1], DJ=[0,0,1,-1,1,-1,1,-1], DC=[1,1,1,1,1.414,1.414,1.414,1.414];
function findPath(sx,sz,tx,tz){
let [si,sj]=toG(sx,sz), [ti,tj]=toG(tx,tz);
const fix=(i,j)=>{
const okAt=(ii,jj)=>{
if(ii<0||jj<0||ii>=N||jj>=N||!open[idx(ii,jj)]) return false;
let nb=0;
if(ii>0&&open[idx(ii-1,jj)])nb++;
if(ii<N-1&&open[idx(ii+1,jj)])nb++;
if(jj>0&&open[idx(ii,jj-1)])nb++;
if(jj<N-1&&open[idx(ii,jj+1)])nb++;
return nb>=2;
};
if(okAt(i,j)) return [i,j];
for(let r2=1;r2<16;r2++)for(let dj=-r2;dj<=r2;dj++)for(let di=-r2;di<=r2;di++){
if(Math.max(Math.abs(di),Math.abs(dj))!==r2) continue;
if(okAt(i+di,j+dj)) return [i+di,j+dj];
}
return [i,j];
};
[si,sj]=fix(si,sj); [ti,tj]=fix(ti,tj);
const startI=idx(si,sj), goalI=idx(ti,tj);
if(startI===goalI) return [[tx,tz]];
gen++;
let hLen=0;
const push=(node,key)=>{
if(hLen>=heapIdx.length-1) return;
let k=hLen++;
heapIdx[k]=node; heapKey[k]=key;
while(k>0){
const par=(k-1)>>1;
if(heapKey[par]<=heapKey[k]) break;
const tI=heapIdx[par],tK=heapKey[par];
heapIdx[par]=heapIdx[k]; heapKey[par]=heapKey[k];
heapIdx[k]=tI; heapKey[k]=tK;
k=par;
}
};
const pop=()=>{
const top=heapIdx[0];
hLen--;
if(hLen>0){
heapIdx[0]=heapIdx[hLen]; heapKey[0]=heapKey[hLen];
let k=0;
for(;;){
const l=k*2+1,r=l+1;
let s=k;
if(l<hLen&&heapKey[l]<heapKey[s])s=l;
if(r<hLen&&heapKey[r]<heapKey[s])s=r;
if(s===k)break;
const tI=heapIdx[s],tK=heapKey[s];
heapIdx[s]=heapIdx[k]; heapKey[s]=heapKey[k];
heapIdx[k]=tI; heapKey[k]=tK;
k=s;
}
}
return top;
};
gScore[startI]=0; visitGen[startI]=gen; came[startI]=-1;
push(startI, Math.hypot(si-ti,sj-tj)*SP);
let found=false, guard=0;
while(hLen>0&&guard++<60000){
const cur=pop();
if(cur===goalI){ found=true; break; }
const cI=cur%N, cJ=(cur/N)|0, cg=gScore[cur];
for(let d=0;d<8;d++){
const ni=cI+DI[d], nj=cJ+DJ[d];
if(ni<0||nj<0||ni>=N||nj>=N) continue;
const nIdx=nj*N+ni;
if(!open[nIdx]) continue;
if(d>=4&&(!open[idx(cI+DI[d],cJ)]||!open[idx(cI,cJ+DJ[d])])) continue;
const ng=cg+DC[d]*SP;
if(visitGen[nIdx]!==gen||ng<gScore[nIdx]){
visitGen[nIdx]=gen; gScore[nIdx]=ng; came[nIdx]=cur;
push(nIdx, ng+Math.hypot(ni-ti,nj-tj)*SP);
}
}
}
if(!found) return null;
const path=[];
let cur=goalI;
while(cur!==startI&&cur>=0){ const i=cur%N,j=(cur/N)|0; const [x,z]=toW(i,j); path.push([x,z]); cur=came[cur]; }
path.reverse();
path.push([tx,tz]);
// 拉绳平滑: 视线可达则跳过中间路点
const sm=[];
let ax=sx, az=sz, k=0;
while(k<path.length){
let far=k;
for(let m2=k;m2<Math.min(path.length,k+14);m2++){
if(lineClear(ax,az,path[m2][0],path[m2][1])) far=m2;
}
sm.push(path[far]);
ax=path[far][0]; az=path[far][1];
k=far+1;
}
return sm;
}
return { findPath, blocked2D:(x,z)=>occBlocked(x,z), lineClear, budget:3,
refresh(){
buildOccupancy(); buildSpatialIndex();
rebuildOpen();
}
};
})();
// 工事建造后延迟刷新导航/占用网格 (合批, 避免连放多件时重复重建)
let _navDirtyT=0;
function markNavDirty(){ _navDirtyT=0.6; }
function updateNavDirty(dt){
if(_navDirtyT>0){
_navDirtyT-=dt;
if(_navDirtyT<=0) NAV.refresh();
}
}
function radialTex(inner,outer,stops){
const c=document.createElement('canvas'); c.width=64; c.height=64;
const g=c.getContext('2d');
const gr=g.createRadialGradient(32,32,inner,32,32,outer);
stops.forEach(s=>gr.addColorStop(s[0],s[1]));
g.fillStyle=gr; g.fillRect(0,0,64,64);
return new THREE.CanvasTexture(c);
}
