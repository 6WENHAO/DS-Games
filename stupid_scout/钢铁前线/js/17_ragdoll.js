'use strict';
// ===== 布娃娃尸体 (cannon.js 物理, 加载失败则回退旧倒地动画) =====
const RAG={world:null,list:[],geo:null};
function ragInit(){
if(!window.CANNON||RAG.world) return;
RAG.world=new CANNON.World();
RAG.world.gravity.set(0,-11,0);
RAG.world.broadphase=new CANNON.NaiveBroadphase();
RAG.world.solver.iterations=5;
RAG.geo={
pelvis:new THREE.BoxGeometry(0.4,0.26,0.24),
torso:new THREE.BoxGeometry(0.44,0.5,0.26),
head:new THREE.BoxGeometry(0.2,0.22,0.2),
arm:new THREE.BoxGeometry(0.12,0.56,0.12),
leg:new THREE.BoxGeometry(0.15,0.9,0.15),
};
}
function spawnRagdoll(bot,attacker,isHead){
ragInit();
if(!RAG.world) return false;
if(RAG.list.length>=8) removeRagdoll(RAG.list[0]);
const M=bot.mesh;
if(!M||!M.root) return false;
// 布娃娃直接接管原模型部件: 外观100%一致, 且从死亡瞬间的真实姿态开始物理模拟
if(!M.root.visible){
// 模型此前被隐藏(载具乘员等): 姿态过期, 先对齐到当前位置
M.root.visible=true;
M.root.position.copy(bot.pos);
M.root.rotation.set(0,bot.yaw,0);
}
if(M.tag) M.tag.visible=false;
if(M.headG) M.headG.visible=true;
if(M.armL) M.armL.sh.visible=true;
if(M.armR) M.armR.sh.visible=true;
M.root.updateWorldMatrix(true,true);
const parts=[], cons=[];
const _q=new THREE.Quaternion(), _p=new THREE.Vector3(), _s=new THREE.Vector3();
const UP=new THREE.Vector3(0,1,0);
function adopt(node,centerW,quatW,hx,hy2,hz,mass){
const wrap=new THREE.Object3D();
wrap.position.copy(centerW);
wrap.quaternion.copy(quatW);
scene.add(wrap);
if(node){ node.visible=true; wrap.attach(node); }
const body=new CANNON.Body({mass});
body.addShape(new CANNON.Box(new CANNON.Vec3(hx,hy2,hz)));
body.position.set(centerW.x,centerW.y,centerW.z);
body.quaternion.set(quatW.x,quatW.y,quatW.z,quatW.w);
body.angularDamping=0.4; body.linearDamping=0.08;
RAG.world.addBody(body);
const pe={mesh:wrap,body,hy:Math.min(hy2,hz),stolen:!!node};
parts.push(pe);
return {body,pe};
}
const wq=(node)=>{ node.updateWorldMatrix(true,false); node.matrixWorld.decompose(_p,_q,_s); return _q.clone(); };
const wpos=(node,lx,ly,lz)=>node.localToWorld(new THREE.Vector3(lx,ly,lz));
// 肢体胶囊: 由两端点决定朝向与长度
function limbAdopt(node,aW,bW,r,mass){
const center=aW.clone().add(bW).multiplyScalar(0.5);
const dir=aW.clone().sub(bW);
const len=Math.max(dir.length(),0.3);
const q=new THREE.Quaternion().setFromUnitVectors(UP,dir.normalize());
return adopt(node,center,q,r,len/2,r,mass);
}
// ---- 先摘头盔(独立刚体, 可脱落滚动) ----
let helmRes=null;
if(M.helmParts&&M.helmParts.length){
const hc=wpos(M.headG,0,0.17,0);
const hq=wq(M.headG);
const wrapH=new THREE.Object3D();
wrapH.position.copy(hc); wrapH.quaternion.copy(hq);
scene.add(wrapH);
for(const hp2 of M.helmParts){ if(hp2.parent) wrapH.attach(hp2); }
const hb=new CANNON.Body({mass:1.5});
hb.addShape(new CANNON.Sphere(0.13));
hb.position.set(hc.x,hc.y,hc.z);
hb.quaternion.set(hq.x,hq.y,hq.z,hq.w);
hb.angularDamping=0.25; hb.linearDamping=0.05;
RAG.world.addBody(hb);
const pe={mesh:wrapH,body:hb,hy:0.11,stolen:true,isHelm:true};
parts.push(pe);
helmRes={body:hb,pe};
}
// ---- 头(接管 headG, 保留面部当前表情) ----
const headC=wpos(M.headG,0,0.1,0);
const headRes=adopt(M.headG,headC,wq(M.headG),0.1,0.11,0.1,2.5);
// ---- 手臂(整条含肘部弯曲姿态) ----
const shLW=wpos(M.armL.sh,0,0,0), haLW=wpos(M.armL.hand,0,-0.04,0);
const shRW=wpos(M.armR.sh,0,0,0), haRW=wpos(M.armR.hand,0,-0.04,0);
const armLRes=limbAdopt(M.armL.sh,shLW,haLW,0.07,2);
const armRRes=limbAdopt(M.armR.sh,shRW,haRW,0.07,2);
// ---- 躯干(含大衣/装具/背枪, 摘掉头和手臂之后) ----
const torsoC=wpos(M.torsoG,0,0.28,0);
const torsoRes=adopt(M.torsoG,torsoC,wq(M.torsoG),0.22,0.28,0.13,9);
// ---- 双腿(整条含膝弯姿态) ----
const hipLW=wpos(M.legL.hip,0,0,0), ftLW=wpos(M.legL.knee,0,-0.46,0.02);
const hipRW=wpos(M.legR.hip,0,0,0), ftRW=wpos(M.legR.knee,0,-0.46,0.02);
const legLRes=limbAdopt(M.legL.hip,hipLW,ftLW,0.085,4);
const legRRes=limbAdopt(M.legR.hip,hipRW,ftRW,0.085,4);
// ---- 骨盆枢纽(无可见网格, 纯物理) ----
const pelC=wpos(M.pelvis,0,0,0);
const pelvisRes=adopt(null,pelC,wq(M.pelvis),0.2,0.13,0.12,6);
const pelvis=pelvisRes.body, torso=torsoRes.body, head=headRes.body;
const armL=armLRes.body, armR=armRRes.body, legL=legLRes.body, legR=legRRes.body;
const P2P=(A,pa,B,pb)=>{
const c=new CANNON.PointToPointConstraint(A,new CANNON.Vec3(pa[0],pa[1],pa[2]),B,new CANNON.Vec3(pb[0],pb[1],pb[2]));
RAG.world.addConstraint(c);
cons.push(c);
return c;
};
const aHL=0;
P2P(torso,[0,-0.26,0],pelvis,[0,0.13,0]);
P2P(head,[0,-0.13,0],torso,[0,0.27,0]);
P2P(armL,[0,(shLW.distanceTo(haLW)/2),0],torso,[-0.27,0.2,0]);
P2P(armR,[0,(shRW.distanceTo(haRW)/2),0],torso,[0.27,0.2,0]);
P2P(legL,[0,(hipLW.distanceTo(ftLW)/2),0],pelvis,[-0.12,-0.11,0]);
P2P(legR,[0,(hipRW.distanceTo(ftRW)/2),0],pelvis,[0.12,-0.11,0]);
// 头盔: 爆头/爆炸直接飞脱; 否则松弛挂扣, 落地撞击时脱落
let helmCon=null;
const blastT0=window._lastExplosion||0;
const blastDist0=window._lastExplosionPos?Math.hypot(bot.pos.x-window._lastExplosionPos.x,bot.pos.z-window._lastExplosionPos.z):1e9;
const blasted=(nowT-blastT0<0.3&&blastDist0<8);
if(helmRes&&!isHead&&!blasted){
helmCon=new CANNON.PointToPointConstraint(head,new CANNON.Vec3(0,0.12,0),helmRes.body,new CANNON.Vec3(0,-0.06,0));
RAG.world.addConstraint(helmCon);
cons.push(helmCon);
}
{
const p=bot.pos;
const ptarr=[pelvis,torso,head,armL,armR,legL,legR,helmRes&&helmRes.body].filter(Boolean);
for(const pt2 of ptarr){
let ix=rand(-1,1),iz=rand(-1,1),imp=rand(2.2,3.5);
if(attacker&&attacker.pos){
const dx=p.x-attacker.pos.x,dz=p.z-attacker.pos.z;
const dl=Math.hypot(dx,dz)||1;
ix=dx/dl; iz=dz/dl; imp=rand(2.8,5.5);
}
if(blasted){ imp*=1.8+rand(1,2.2); }
if(isHead) imp*=1.4;
pt2.velocity.set(bot.vel.x*0.6+ix*imp*rand(0.7,1.3),rand(0.5,3.5),bot.vel.z*0.6+iz*imp*rand(0.7,1.3));
pt2.angularVelocity.set(rand(-5,5),rand(-4,4),rand(-5,5));
if(blastDist0<8){ pt2.velocity.y+=rand(1.5,5); pt2.angularVelocity.set(rand(-9,9),rand(-9,9),rand(-9,9)); }
}
if(isHead){ head.velocity.y+=2.2; head.angularVelocity.set(rand(-9,9),rand(-9,9),rand(-9,9)); }
if(helmRes&&(isHead||blasted)){ helmRes.body.velocity.y+=rand(1.5,3.5); helmRes.body.angularVelocity.set(rand(-8,8),rand(-8,8),rand(-8,8)); }
}
const entry={parts,cons,t:9,head:headRes.pe,helmCon,stolenFrom:bot};
RAG.list.push(entry);
return entry;
}
function removeRagdoll(r){
const i=RAG.list.indexOf(r);
if(i<0) return;
for(const c of r.cons) RAG.world.removeConstraint(c);
for(const p of r.parts){
if(RAG.world.removeBody) RAG.world.removeBody(p.body); else RAG.world.remove(p.body);
if(p.stolen&&p.mesh){
// 接管来的模型部件: 释放几何与专属材质(共享制服材质不释放)
p.mesh.traverse(o=>{
if(o.isMesh){
if(o.geometry) o.geometry.dispose();
if(o.material&&o.material.userData&&o.material.userData.perSoldier){
if(o.material.map) o.material.map.dispose();
o.material.dispose();
}
}
});
}
scene.remove(p.mesh);
}
RAG.list.splice(i,1);
}
// ===== 建筑碎块物理 (墙体倒塌) =====
const DEBRIS={list:[]};
function spawnDebris(mat,px,py,pz,ry,w,h,d,cx,cz){
if(!window.CANNON) return;
ragInit();
if(!RAG.world) return;
if(DEBRIS.list.length>=26){ removeDebrisEntry(DEBRIS.list.shift()); }
const mesh2=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
mesh2.castShadow=true;
scene.add(mesh2);
const body=new CANNON.Body({mass:Math.max(2,w*h*d*2.5)});
body.addShape(new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2)));
body.position.set(px,py,pz);
body.quaternion.setFromEuler(0,ry,0);
body.angularDamping=0.32; body.linearDamping=0.1;
if(RAG.world.addBody) RAG.world.addBody(body); else RAG.world.add(body);
// 从爆心向外倒塌
const dx=px-cx, dz=pz-cz; const dl=Math.hypot(dx,dz)||1;
body.velocity.set(dx/dl*rand(1.2,3.2)+rand(-0.8,0.8), rand(0.3,2), dz/dl*rand(1.2,3.2)+rand(-0.8,0.8));
body.angularVelocity.set(rand(-3,3),rand(-1.5,1.5),rand(-3,3));
DEBRIS.list.push({mesh:mesh2,body,hy:Math.min(h,Math.min(w,d))/2,t:rand(7,9),landed:false});
}
function removeDebrisEntry(e){
if(RAG.world.removeBody) RAG.world.removeBody(e.body); else RAG.world.remove(e.body);
scene.remove(e.mesh);
e.mesh.geometry.dispose();
}
function spawnWallDebris(m,cx,cz){
if(!window.CANNON) return;
const P=m.geometry&&m.geometry.parameters;
if(!P) return;
const ry=m.rotation.y||0;
const w=P.width,h=P.height,d=P.depth;
if(w*h*d<0.04) return;
const nx=w>2.4?2:1, ny=h>1.7?2:1;
const cs=Math.cos(ry),sn=Math.sin(ry);
for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++){
const cw=(w/nx)*rand(0.72,0.94), ch=(h/ny)*rand(0.72,0.94), cd2=Math.max(0.22,d*rand(0.85,1));
const lx=-w/2+(w/nx)*(ix+0.5);
const ly=-h/2+(h/ny)*(iy+0.5);
spawnDebris(m.material,m.position.x+cs*lx,m.position.y+ly,m.position.z-sn*lx,ry,cw,ch,cd2,cx,cz);
}
}
// 刚体碎块/尸块与建筑的碰撞: 用射线格网就近查询AABB并推出
function ragCollide(b,r){
if(!RGRID.boxCells) return;
const vx=b.velocity.x, vy=b.velocity.y, vz=b.velocity.z;
if(vx*vx+vz*vz<0.15&&Math.abs(vy)<0.8) return;
const {cell,N,off}=RGRID;
const ci=clamp(Math.floor((b.position.x+off)/cell),0,N-1);
const cj=clamp(Math.floor((b.position.z+off)/cell),0,N-1);
const list=RGRID.boxCells[cj*N+ci];
for(let k=0;k<list.length;k++){
const bx2=BOXES[list[k]];
if(bx2.dead) continue;
const px=b.position.x, py=b.position.y, pz=b.position.z;
if(py<bx2.minY-0.05||py>bx2.maxY+0.4) continue;
const cx=clamp(px,bx2.minX,bx2.maxX), cz=clamp(pz,bx2.minZ,bx2.maxZ);
const dx=px-cx, dz=pz-cz;
const d2=dx*dx+dz*dz;
if(d2>=r*r) continue;
// 从上方落到箱顶: 支撑住
if(py>bx2.maxY-0.3&&vy<0){
b.position.y=bx2.maxY+r*0.85;
b.velocity.y*=-0.2; b.velocity.x*=0.8; b.velocity.z*=0.8;
continue;
}
if(d2<1e-8){
const l=Math.min(px-bx2.minX,bx2.maxX-px), rg=Math.min(pz-bx2.minZ,bx2.maxZ-pz);
if(l<rg) b.position.x=(px-bx2.minX<bx2.maxX-px)?bx2.minX-r:bx2.maxX+r;
else b.position.z=(pz-bx2.minZ<bx2.maxZ-pz)?bx2.minZ-r:bx2.maxZ+r;
b.velocity.x*=0.5; b.velocity.z*=0.5;
} else {
const d=Math.sqrt(d2), push=(r-d)/d;
b.position.x+=dx*push; b.position.z+=dz*push;
const vn=(b.velocity.x*dx+b.velocity.z*dz)/Math.max(d2,1e-6);
if(vn<0){ b.velocity.x-=vn*dx*1.35; b.velocity.z-=vn*dz*1.35; }
}
}
}
function updateDebris(dt){
for(let i=DEBRIS.list.length-1;i>=0;i--){
const e=DEBRIS.list[i];
e.t-=dt;
const b=e.body;
const gh=heightAt(b.position.x,b.position.z);
if(b.position.y<gh+e.hy){
b.position.y=gh+e.hy;
const impact=-b.velocity.y;
if(b.velocity.y<0) b.velocity.y*=-0.18;
b.velocity.x*=0.8; b.velocity.z*=0.8;
b.angularVelocity.x*=0.68; b.angularVelocity.y*=0.68; b.angularVelocity.z*=0.68;
if(!e.landed&&impact>2.2){
e.landed=true;
// 落地扬尘
for(let k=0;k<3;k++) spawnP(PT.dirt,b.position.x+rand(-0.4,0.4),gh+0.15,b.position.z+rand(-0.4,0.4),rand(-1.2,1.2),rand(0.4,1.4),rand(-1.2,1.2),rand(0.5,0.8),1.5,rand(0.6,1),0.75,1);
}
}
e.mesh.position.copy(b.position);
e.mesh.quaternion.copy(b.quaternion);
ragCollide(b,Math.max(0.18,e.hy));
if(e.t<=0){ removeDebrisEntry(e); DEBRIS.list.splice(i,1); }
}
}
function updateRagdolls(dt){
if(!RAG.world) return;
if(!RAG.list.length&&!DEBRIS.list.length) return;
RAG.world.step(1/60,Math.min(dt,0.05),2);
for(let i=RAG.list.length-1;i>=0;i--){
const r=RAG.list[i];
r.t-=dt;
for(const p of r.parts){
const b=p.body;
const gh=heightAt(b.position.x,b.position.z);
if(b.position.y<gh+p.hy){
b.position.y=gh+p.hy;
const impact=-b.velocity.y;
if(b.velocity.y<0) b.velocity.y*=-0.25;
b.velocity.x*=0.85; b.velocity.z*=0.85;
b.angularVelocity.x*=0.78; b.angularVelocity.y*=0.78; b.angularVelocity.z*=0.78;
// 头/盔落地撞击 → 头盔脱扣, 物理滚落
if(r.helmCon&&impact>2.0&&(p.isHelm||p===r.head)){
RAG.world.removeConstraint(r.helmCon);
const ci=r.cons.indexOf(r.helmCon);
if(ci>=0) r.cons.splice(ci,1);
r.helmCon=null;
for(const hp3 of r.parts){ if(hp3.isHelm){ hp3.body.velocity.y+=rand(0.8,1.8); hp3.body.velocity.x+=rand(-1.2,1.2); hp3.body.velocity.z+=rand(-1.2,1.2); hp3.body.angularVelocity.set(rand(-7,7),rand(-7,7),rand(-7,7)); } }
}
}
ragCollide(b,0.16);
p.mesh.position.copy(b.position);
p.mesh.quaternion.copy(b.quaternion);
}
if(r.t<=0) removeRagdoll(r);
}
updateDebris(dt);
}
function raySoldiers(o,dir,maxD,shooter){
let best=null,bestT=maxD;
for(const s of combatants){
if(!s.alive||s===shooter) continue;
// 载具乘员: 运兵车车斗乘客暴露可被命中, 其余载具乘员受装甲保护
if(s.onVehicle&&s.onVehicle.kind!=='apc') continue;
if(shooter&&s.team===shooter.team) continue;
const seated=s.onVehicle&&s.onVehicle.kind==='apc';
const eyeY=s.pos.y+(seated?1.35:(s.prone?0.5:s.crouch?1.15:1.62));
const hx=s.pos.x-o.x, hy=eyeY+0.06-o.y, hz=s.pos.z-o.z;
const tProj=hx*dir.x+hy*dir.y+hz*dir.z;
if(tProj>0.2&&tProj<bestT){
const px=o.x+dir.x*tProj-s.pos.x, py=o.y+dir.y*tProj-(eyeY+0.06), pz=o.z+dir.z*tProj-s.pos.z;
if(px*px+py*py+pz*pz<0.26*0.26){ best={sol:s,t:tProj,head:true}; bestT=tProj; continue; }
}
const c={x:s.pos.x,z:s.pos.z,r:seated?0.34:(s.prone?0.5:0.38),y0:s.pos.y+(seated?0.5:0),y1:s.pos.y+(seated?1.5:(s.prone?0.6:s.crouch?1.25:1.55))};
const r=rayCyl(o,dir,c,bestT);
if(r){ best={sol:s,t:r.t,head:false}; bestT=r.t; }
}
return best;
}
const rockets=[];
function fireRocket(shooter,origin,dir,def,vis){
const vel=dir.clone().multiplyScalar(85);
shells.push({pos:origin.clone(),vel,team:shooter.team,owner:shooter,life:3.6,kind:'at',dmgV:def.atDmg||320,pen:(def.atDmg||320)>360?170:150,trail:0,rocket:true});
spawnP(PT.flash,origin.x,origin.y,origin.z, dir.x*2,dir.y*2,dir.z*2, 0.6,6,0.1,1,0,true);
spawnP(PT.dark,origin.x,origin.y,origin.z, dir.x*2+rand(-1,1),1.5,dir.z*2+rand(-1,1), 0.9,2.5,0.8,0.7,0.5);
AudioSys.cannon(origin.distanceTo(camera.position));
shooter.lastFiredT=nowT;
}
