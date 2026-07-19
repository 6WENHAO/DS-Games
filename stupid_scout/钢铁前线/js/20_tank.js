'use strict';
const tanks=[], shells=[];
const wreckMat=new THREE.MeshLambertMaterial({color:0x1e1c18});
const CREW_ROLE_CN={driver:'驾驶员',gunner:'炮手',commander:'车长',loader:'装填手'};
// ---- 坦克 OBB 命中检测: 车体/炮塔分体, 返回命中部位与局部法线 ----
const _obbO=new THREE.Vector3(), _obbD=new THREE.Vector3();
function slabHit(o,d,hx,hy,hz,cy){
// AABB centered (0,cy,0), half (hx,hy,hz); 返回 {t,n:[x,y,z]} 或 null
let tmin=0.0001, tmax=1e9, nAxis=-1, nSign=1;
const oo=[o.x,o.y-cy,o.z], dd=[d.x,d.y,d.z], hh=[hx,hy,hz];
for(let a=0;a<3;a++){
if(Math.abs(dd[a])<1e-9){
if(Math.abs(oo[a])>hh[a]) return null;
continue;
}
let t1=(-hh[a]-oo[a])/dd[a], t2=(hh[a]-oo[a])/dd[a];
let sgn=-Math.sign(dd[a]);
if(t1>t2){ const tt=t1; t1=t2; t2=tt; }
if(t1>tmin){ tmin=t1; nAxis=a; nSign=sgn; }
if(t2<tmax) tmax=t2;
if(tmin>tmax) return null;
}
if(nAxis<0) return null;
const n=[0,0,0]; n[nAxis]=nSign;
return {t:tmin,n};
}
function rayTankParts(o,dir,maxD,tk){
const D=tk.def;
const sn=Math.sin(-tk.yaw), cs=Math.cos(-tk.yaw);
// 世界→车体局部(仅yaw)
const rx=o.x-tk.pos.x, rz=o.z-tk.pos.z;
_obbO.set(rx*cs+rz*sn, o.y-tk.pos.y, -rx*sn+rz*cs);
_obbD.set(dir.x*cs+dir.z*sn, dir.y, -dir.x*sn+dir.z*cs);
let best=null;
// 车体(含履带宽度)
const hull=slabHit(_obbO,_obbD,2.02,0.72,D.hullL/2+0.15,0.95);
if(hull&&hull.t<maxD) best={t:hull.t,part:'hull',n:hull.n};
// 炮塔/战斗室
const ty=D.casemate?1.95:2.1;
const q=tk.turretYaw, qs=Math.sin(-q), qc=Math.cos(-q);
const tox=_obbO.x, toz=_obbO.z-(D.casemate?-0.3:0);
const to2=new THREE.Vector3(tox*qc+toz*qs,_obbO.y,-tox*qs+toz*qc);
const td2=new THREE.Vector3(_obbD.x*qc+_obbD.z*qs,_obbD.y,-_obbD.x*qs+_obbD.z*qc);
const th=D.casemate?[1.15,0.62,1.6]:(D.heavy?[1.15,0.42,1.35]:[1.2,0.42,1.25]);
const tur=slabHit(to2,td2,th[0],th[1],th[2],ty);
if(tur&&tur.t<(best?best.t:maxD)){
// 炮塔局部法线转回车体局部
const n=[tur.n[0]*qc-tur.n[2]*qs,tur.n[1],tur.n[0]*qs+tur.n[2]*qc];
best={t:tur.t,part:'turret',n};
}
return best;
}
// 装甲区判定 + 击穿解算: 返回 {pen:bool, eff, zone}
function armorSolve(tk,hit,penMM){
const D=tk.def, A=D.armor||{f:60,s:30,r:25,t:50,top:12};
const n=hit.n;
let zone,base;
if(Math.abs(n[1])>0.7){ zone='top'; base=A.top; }
else if(hit.part==='turret'){ zone='turret'; base=A.t; }
else if(Math.abs(n[2])>=Math.abs(n[0])){ zone=n[2]>0?'front':'rear'; base=n[2]>0?A.f:A.r; }
else { zone='side'; base=A.s; }
// 入射角等效: eff=base/cosθ
const cosI=Math.max(0.34,Math.abs(_obbD.x*n[0]+_obbD.y*n[1]+_obbD.z*n[2]));
const eff=base/cosI;
const roll=penMM*rand(0.88,1.12);
return {pen:(zone==='top'&&(A.top===0))?true:roll>eff, eff:Math.round(eff), zone};
}
const TANK_DEFS=[];
// 暴露乘员的AI目标代理: 让bot能"看到"并主动射击坦克上的裸露乘员
const TANK_CREW_PROXIES=[];
// ---- 暴露乘员命中检测(供 fireBullet 调用): 敞篷全身/封闭车车长探头 ----
const _cwPos=new THREE.Vector3();
function rayTankCrew(o,dir,maxD,shooter){
let best=null;
for(const t of tanks){
if(!t.alive||!t.crewMen) continue;
if(shooter&&t.team===shooter.team) continue;
const dx=t.pos.x-o.x,dz=t.pos.z-o.z;
const dd=Math.hypot(dx,dz);
if(dd>maxD+6) continue;
for(const cm of t.crewMen){
if(!cm.alive||!cm.fig||!cm.fig.visible) continue;
const exposedNow=cm.exposed||cm.role==='commander';
if(!exposedNow) continue;
cm.fig.getWorldPosition(_cwPos);
const hy=_cwPos.y+(cm.exposed?0.36:0.2);
let tp=(_cwPos.x-o.x)*dir.x+(hy-o.y)*dir.y+(_cwPos.z-o.z)*dir.z;
if(tp>0.3&&tp<maxD){
const px=o.x+dir.x*tp-_cwPos.x, py=o.y+dir.y*tp-hy, pz=o.z+dir.z*tp-_cwPos.z;
if(px*px+py*py+pz*pz<0.16*0.16){ if(!best||tp<best.t) best={t:tp,cm,head:true,tank:t}; continue; }
}
if(cm.exposed){
tp=(_cwPos.x-o.x)*dir.x+(_cwPos.y-o.y)*dir.y+(_cwPos.z-o.z)*dir.z;
if(tp>0.3&&tp<maxD){
const px=o.x+dir.x*tp-_cwPos.x, py=o.y+dir.y*tp-_cwPos.y, pz=o.z+dir.z*tp-_cwPos.z;
if(px*px+py*py+pz*pz<0.26*0.26){ if(!best||tp<best.t) best={t:tp,cm,head:false,tank:t}; }
}
}
}
}
return best;
}
class Tank {
constructor(team,variant){
this.kind='tank';
this.team=team; this.variant=variant||0;
this.def=TEAM_FACTION[team].tanks[this.variant];
this.name=this.def.name;
this.hp=this.def.hp; this.maxHp=this.def.hp; this.alive=true;
this.pos=V3(); this.yaw=0; this.turretYaw=0; this.turretPitch=0; this.vel=0;
this.playerDriven=false; this.isAI=true;
this.crew={ name:this.name, team, kills:0, deaths:0, score:0, isPlayer:false, isCrew:true, pos:this.pos, alive:true, lastFiredT:-99, damage(){}, vel:V3() };
this.cannonCd=0; this.mgT=0; this.mgBurst=0; this.mgPause=0;
this.objective=null; this.thinkCD=0; this.stuckT=0; this.lastPos=V3(); this.smokeT=0;
this.path=null; this.pathI=0; this.repathT=0; this.reverseT=0; this.progT=0;
this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0; this.lastVel=0; this.wreckBs=null;
this.tTarget=null; this.tMemT=0; this.threatYaw=null;
this.respawnT=0; this.wheels=[];
this.buildMesh();
this.initCrew();
this.muzzle=V3();
this.engine=AudioSys.createEngine('tank');
tanks.push(this);
this.respawn();
}
// ===== 乘员系统: 真实成员入座, 暴露部位可被步枪击杀 =====
initCrew(){
this.crewMen=[];
const D=this.def;
const roles=D.crew||['driver','gunner'];
for(const role of roles){
const cm={role,alive:true,tank:this,inTurret:false,exposed:false,local:V3(),fig:null,respT:0};
if(role==='driver'){ cm.local.set(-0.55,1.5,D.hullL/2-1.0); cm.exposed=!!D.openTop; }
else if(role==='gunner'){ cm.inTurret=true; cm.local.set(0.4,D.casemate?0.35:0.32,-0.2); cm.exposed=!!D.openTop; }
else if(role==='loader'){ cm.inTurret=true; cm.local.set(-0.45,D.casemate?0.35:0.32,-0.35); cm.exposed=!!D.openTop; }
else { cm.inTurret=true; cm.local.set(D.heavy?-0.55:-0.4,0.72,-(D.heavy?0.5:0.3)); cm.exposed=true; } // 车长探头
cm.hp=65;
// AI 可感知的代理实体
cm.proxy={alive:false,team:this.team,name:this.name+'乘员',pos:V3(),vel:V3(),crouch:false,prone:false,onVehicle:null,
isCrewProxy:cm,lastFiredT:-99,kills:0,deaths:0,score:0,
damage:(a,att,h)=>{ cm.hp-=a; if(cm.hp<=0) this.crewKilled(cm,att,h); },
noticeThreat(){}, suppress(){}};
TANK_CREW_PROXIES.push(cm.proxy);
this.buildCrewFig(cm);
this.crewMen.push(cm);
}
}
buildCrewFig(cm){
const U=uniformMats[this.team];
const g=new THREE.Group();
const D=this.def;
const showBody=cm.exposed;
if(showBody){
bx(U.coat,0.36,0.44,0.22,0,0,0,g);
bx(U.coat,0.11,0.3,0.11,-0.24,-0.02,0,g).rotation.z=0.25;
bx(U.coat,0.11,0.3,0.11,0.24,-0.02,0,g).rotation.z=-0.25;
}
bx(U.skin,0.18,0.2,0.18,0,showBody?0.33:0.12,0,g);
const helm=new THREE.Mesh(new THREE.SphereGeometry(0.135,8,6,0,TAU,0,HPI*1.25),U.helm);
helm.position.set(0,showBody?0.43:0.22,0); g.add(helm);
if(cm.role==='driver'&&!D.openTop) g.visible=false; // 封闭车驾驶员不可见
g.position.copy(cm.local);
g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
(cm.inTurret?this.turretG:this.grp).add(g);
cm.fig=g;
}
crewByRole(r){ return this.crewMen&&this.crewMen.find(c=>c.role===r); }
crewKilled(cm,attacker,isHead){
if(!cm.alive) return;
cm.alive=false; cm.respT=9;
if(cm.fig) cm.fig.visible=false;
const wp=new THREE.Vector3(); if(cm.fig) cm.fig.getWorldPosition(wp);
bloodFX(wp);
if(attacker){
attacker.kills=(attacker.kills||0)+1;
attacker.score=(attacker.score||0)+60;
addKillfeed(attacker,{name:this.name+'·'+CREW_ROLE_CN[cm.role],team:this.team,isPlayer:false},isHead);
if(attacker.isPlayer){ showScorePop('+60 击毙坦克'+CREW_ROLE_CN[cm.role]); AudioSys.hitmarkSnd(true); }
}
if(this.playerDriven&&cm.role!=='driver'&&cm.role!=='gunner'){ showScorePop('乘员阵亡: '+CREW_ROLE_CN[cm.role]+'!'); }
}
crewUpdate(dt){
if(!this.crewMen) return;
if(this.engineHitT>0) this.engineHitT-=dt;
for(const cm of this.crewMen){
if(!cm.alive){
cm.respT-=dt;
if(cm.respT<=0&&this.alive){ cm.alive=true; cm.hp=65; if(cm.fig&&(cm.role!=='driver'||this.def.openTop)) cm.fig.visible=true; }
}
// 同步AI目标代理
if(cm.proxy){
const exposedNow=cm.exposed||cm.role==='commander';
cm.proxy.alive=this.alive&&cm.alive&&exposedNow&&!!cm.fig&&cm.fig.visible;
if(cm.proxy.alive){
cm.fig.getWorldPosition(cm.proxy.pos);
cm.proxy.pos.y-=1.15; // 与步兵瞄准约定一致(瞄 pos.y+1.0~1.4)
cm.proxy.vel.set(this.vel*Math.sin(this.yaw),0,this.vel*Math.cos(this.yaw));
}
}
}
}
crewDown(role){ const cm=this.crewByRole(role); return cm&&!cm.alive; }
buildMesh(){
const D=this.def;
this.matBody=new THREE.MeshLambertMaterial({color:D.col});
const matT=new THREE.MeshLambertMaterial({color:D.colT});
const matB=new THREE.MeshLambertMaterial({color:0x363830});
const L=D.hullL;
this.grp=new THREE.Group();
const h=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.95,L),this.matBody); h.position.y=1.0; this.grp.add(h);
const gl=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.24,1.15),this.matBody);
gl.position.set(0,1.12,L/2-0.18); gl.rotation.x=-0.62; this.grp.add(gl);
const gr=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.22,0.9),this.matBody);
gr.position.set(0,1.05,-L/2+0.15); gr.rotation.x=0.55; this.grp.add(gr);
const fenderL=new THREE.Mesh(new THREE.BoxGeometry(0.75,0.08,L+0.3),this.matBody);
fenderL.position.set(-1.62,1.32,0); this.grp.add(fenderL);
const fenderR=fenderL.clone(); fenderR.position.x=1.62; this.grp.add(fenderR);
this.trackTex=TEX.track.clone(); this.trackTex.needsUpdate=true;
this.trackTex.wrapS=this.trackTex.wrapT=THREE.RepeatWrapping;
this.trackTex.repeat.set(1,4);
const trackMat=new THREE.MeshLambertMaterial({map:this.trackTex});
for(const sx of [-1.62,1.62]){
const tr=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.92,L+0.25),trackMat);
tr.position.set(sx,0.68,0); this.grp.add(tr);
for(let i=0;i<5;i++){
const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,0.66,10),matB);
wh.rotation.z=HPI;
wh.position.set(sx,0.42,-L/2+0.75+i*(L-1.5)/4);
wh.userData={sx,lz:-L/2+0.75+i*(L-1.5)/4,vy:0,baseY:0.42};
this.grp.add(wh); this.wheels.push(wh);
}
}
this.turretG=new THREE.Group(); this.turretG.position.y=1.78; this.grp.add(this.turretG);
if(D.casemate){
// 敞篷战斗室(坦歼): 固定舱壁, 顶部敞开, 火炮限位
const fw=new THREE.Mesh(new THREE.BoxGeometry(2.3,1.15,0.22),this.matBody); fw.position.set(0,0.28,1.15); fw.rotation.x=-0.18; this.turretG.add(fw);
const swL=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.85,2.6),this.matBody); swL.position.set(-1.08,0.18,-0.1); this.turretG.add(swL);
const swR=swL.clone(); swR.position.x=1.08; this.turretG.add(swR);
const bw=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.6,0.16),this.matBody); bw.position.set(0,0.05,-1.35); this.turretG.add(bw);
// 战斗室内部: 地板+炮闩
const flr=new THREE.Mesh(new THREE.BoxGeometry(2.1,0.08,2.5),matB); flr.position.set(0,-0.28,-0.1); this.turretG.add(flr);
const breech=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.4,0.9),matB); breech.position.set(0,0.35,0.2); this.turretG.add(breech);
} else if(D.openTop){
// 敞篷炮塔(M36类): 环形装甲板无顶
const tw=new THREE.Mesh(new THREE.CylinderGeometry(1.14,1.22,0.78,12,1,true),this.matBody);
tw.position.y=0.18; this.turretG.add(tw);
const tf=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.7,0.3),this.matBody); tf.position.set(0,0.16,1.05); tf.rotation.x=-0.2; this.turretG.add(tf);
const flr=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,0.06,12),matB); flr.position.y=-0.18; this.turretG.add(flr);
} else if(D.heavy){
const tb=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.72,2.6),this.matBody); tb.position.y=0.12; this.turretG.add(tb);
const tf=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.6,0.5),this.matBody); tf.position.set(0,0.1,1.4); tf.rotation.x=-0.35; this.turretG.add(tf);
// 炮塔尾舱与舱盖
const bus=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.5,0.6),this.matBody); bus.position.set(0,0.1,-1.5); this.turretG.add(bus);
const hat=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.06,10),matB); hat.position.set(0.5,0.52,-0.4); this.turretG.add(hat);
} else {
const tc=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.28,0.72,12),this.matBody); tc.position.y=0.12; this.turretG.add(tc);
const hat=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.06,10),matB); hat.position.set(0.45,0.52,-0.35); this.turretG.add(hat);
}
if(!D.casemate&&!D.openTop){
const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.38,0.28,10),this.matBody);
cup.position.set(D.heavy?-0.55:-0.4,0.56,-(D.heavy?0.5:0.3)); this.turretG.add(cup);
}
// 天线
const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.014,1.6,4),matB);
ant.position.set(-0.9,0.9,-0.6); ant.rotation.z=0.12; this.turretG.add(ant);
this.pitchG=new THREE.Group(); this.pitchG.position.set(0,D.casemate?0.3:0.15,D.casemate?1.0:(D.heavy?1.5:1.05)); this.turretG.add(this.pitchG);
const mant=new THREE.Mesh(new THREE.BoxGeometry(D.casemate?1.0:0.85,0.6,0.4),this.matBody); this.pitchG.add(mant);
const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,D.barrelL,8),matB);
bar.position.set(0,0.02,D.barrelL/2); bar.rotation.x=HPI; this.pitchG.add(bar);
if(D.heavy||D.cls==='td'){
const mb=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.42,8),matB);
mb.position.set(0,0.02,D.barrelL-0.1); mb.rotation.x=HPI; this.pitchG.add(mb);
}
if(!D.casemate){
const coax=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.05,0.9,6),matB);
coax.position.set(0.42,-0.05,0.7); coax.rotation.x=HPI; this.pitchG.add(coax);
}
// ---- 车体细节: 工具箱/备用履带/油桶/排气管/拖钩 ----
const tool=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.24,0.34),matB); tool.position.set(-1.0,1.42,-L/2+1.0); this.grp.add(tool);
const spare=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.1,1.2),new THREE.MeshLambertMaterial({map:TEX.track})); spare.position.set(0,1.28,L/2-0.05); spare.rotation.x=-0.62; this.grp.add(spare);
const jerry=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.42,0.2),this.matBody); jerry.position.set(1.05,1.44,-L/2+0.8); this.grp.add(jerry);
for(const ex of [-0.5,0.5]){
const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.7,6),matB);
pipe.position.set(ex,1.2,-L/2-0.12); pipe.rotation.x=0.9; this.grp.add(pipe);
}
this.barrelTip=D.barrelL+(D.heavy?1.6:1.15);
this.grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
world.add(this.grp);
}
aimDir(){
const a=this.yaw+this.turretYaw, p=this.turretPitch;
return V3(Math.sin(a)*Math.cos(p),Math.sin(p),Math.cos(a)*Math.cos(p));
}
coaxMuzzle(){
const a=this.yaw+this.turretYaw;
const sn=Math.sin(a),cs=Math.cos(a);
return V3(this.pos.x+cs*0.42+sn*1.25,this.pos.y+1.88,this.pos.z-sn*0.42+cs*1.25);
}
update(dt){
if(!this.alive){
this.respawnT-=dt;
this.engine.update(0,0);
if(this.respawnT<=0&&!matchOver) this.respawn();
return;
}
this.cannonCd-=dt; this.mgT-=dt; this.mgPause-=dt;
this.crewUpdate(dt);
// 驾驶员阵亡: 车辆瘫痪直至替补入座
if(this.crewDown('driver')){ this.vel=dampF(this.vel,0,6,dt); }
// 火炮方向盘限位(坦歼固定战斗室 ±12°)
if(this.def.casemate) this.turretYaw=clamp(this.turretYaw,-0.21,0.21);
// 无人闲置的坦克脱战后缓慢检修回血, 修到40%以上AI步兵才会重新接管
if(!this.playerDriven&&!this.crewBot&&this.hp<this.maxHp&&nowT-(this.lastDmgT||-99)>10){
this.hp=Math.min(this.maxHp,this.hp+this.maxHp*0.025*dt);
}
const dCam=this.pos.distanceTo(camera.position);
this.engine.update(58+Math.abs(this.vel)*7, clamp(0.3-dCam/110,0,0.3)*(0.55+Math.abs(this.vel)*0.08));
// 乘员严重受损时弃车逃生
if(this.crewBot&&!this.playerDriven&&this.hp<this.maxHp*0.25){
this.crewBot.dismountVehicle(true);
}
if(this.crewBot&&this.crewBot.alive&&!this.playerDriven){ this.driveAI(dt); this.turretAI(dt); }
else if(!this.playerDriven){ this.vel=dampF(this.vel,0,4,dt); }
const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
this.pos.x+=sn*this.vel*dt; this.pos.z+=cs*this.vel*dt;
// 底盘对齐碰撞: 沿车体轴线三个圆
let hitObstacle=false;
for(const off of [-1.95,0,1.95]){
const cxp=this.pos.x+sn*off, czp=this.pos.z+cs*off;
for(const b of BOXES){
if(b.dead||this.pos.y+2<b.minY||this.pos.y>b.maxY) continue;
if(b.maxY-b.gh<0.7) continue;
const cx=clamp(cxp,b.minX,b.maxX), cz=clamp(czp,b.minZ,b.maxZ);
const dx=cxp-cx, dz=czp-cz;
const d2=dx*dx+dz*dz;
if(d2<1.55*1.55){
// 坦克冲撞可毁墙体: 车速足够时直接撞塌整段结构
if(b.dGroup&&!b.dGroup.dead&&Math.abs(this.vel)>1.9){
destroyStructure(b.dGroup);
this.vel*=0.58;
this.suspPV-=Math.sign(this.vel)*0.9;
if(this.playerDriven) addTrauma(0.28);
continue;
}
if(d2>1e-8){
const d=Math.sqrt(d2), push=(1.55-d)/d;
this.pos.x+=dx*push; this.pos.z+=dz*push;
}
this.vel*=0.5;
hitObstacle=true;
}
}
for(const c of CYLS){
if(c.r<0.3) continue;
const dx=cxp-c.x, dz=czp-c.z;
const rr=c.r+1.5, d2=dx*dx+dz*dz;
if(d2<rr*rr&&d2>1e-8){
const d=Math.sqrt(d2), push=(rr-d)/d;
this.pos.x+=dx*push*0.6; this.pos.z+=dz*push*0.6;
this.vel*=0.6;
hitObstacle=true;
}
}
}
if(hitObstacle&&this.isAI) this.stuckT+=dt*2.2;
for(const t2 of tanks){
if(t2===this||!t2.alive) continue;
const dx=this.pos.x-t2.pos.x, dz=this.pos.z-t2.pos.z;
const d2=dx*dx+dz*dz;
if(d2<4.6*4.6&&d2>1e-6){
const d=Math.sqrt(d2), push=(4.6-d)/d*0.5;
this.pos.x+=dx*push; this.pos.z+=dz*push;
}
}
const lim=MAP_SIZE/2+6;
this.pos.x=clamp(this.pos.x,-lim,lim); this.pos.z=clamp(this.pos.z,-lim,lim);
// 碾平铁丝网
if(Math.abs(this.vel)>0.8&&wires.length){
for(let wi=wires.length-1;wi>=0;wi--){
const w=wires[wi];
const dxw=w.x-this.pos.x, dzw=w.z-this.pos.z;
if(dxw*dxw+dzw*dzw<2.8*2.8){
if(w.grp) world.remove(w.grp);
wires.splice(wi,1);
for(let k=0;k<3;k++) spawnP(PT.dirt,w.x+rand(-1,1),heightAt(w.x,w.z)+0.3,w.z+rand(-1,1),rand(-1,1),rand(0.5,1.2),rand(-1,1),rand(0.25,0.4),0.6,rand(0.4,0.7),0.8,2);
markNavDirty();
}
}
}
this.pos.y=dampF(this.pos.y,heightAt(this.pos.x,this.pos.z),8,dt);
// 实体碰撞: 步兵无法穿入车体; 友军挤开, 敌军按行进方向与车速判定碾压
{
const hx=2.05, hz=this.def.hullL/2+0.45;
const csb=Math.cos(this.yaw), snb=Math.sin(this.yaw);
const crusher=this.playerDriven?player:(this.crewBot||this.crew);
const moving=Math.abs(this.vel)>1.2;
for(const s of combatants){
if(!s.alive||s.onVehicle) continue;
if(s.pos.y>this.pos.y+1.9) continue;
const relx=s.pos.x-this.pos.x, relz=s.pos.z-this.pos.z;
const lx=relx*csb-relz*snb;
const lz=relx*snb+relz*csb;
if(Math.abs(lx)>=hx+0.38||Math.abs(lz)>=hz+0.38) continue;
// 碾压: 车在动 且 目标处于行进方向的前沿区域 且 是敌军
const frontal=this.vel>0?(lz>hz-1.5):(lz<-(hz-1.5));
if(moving&&frontal&&s.team!==this.team){
s.damage(320,crusher,false);
if(!s.alive) continue;
}
// 推出: 沿穿透较浅的轴推离; 行进正面的存活者向侧面挤出
const penX=hx+0.38-Math.abs(lx);
const penZ=hz+0.38-Math.abs(lz);
let lateral=penX<penZ;
if(moving&&frontal) lateral=true;
if(lateral){
const sgn=lx>=0?1:-1;
const amt=penX<0.5?penX:Math.min(penX,(3+Math.abs(this.vel))*dt*2.2);
s.pos.x+=csb*sgn*amt; s.pos.z+=-snb*sgn*amt;
} else {
const sgn=lz>0?1:-1;
s.pos.x+=snb*sgn*penZ; s.pos.z+=csb*sgn*penZ;
}
if(s.isPlayer) collideMove(s.pos,0.42);
}
}
// 履带滚动与路轮
this.trackTex.offset.y-=this.vel*dt*0.55;
for(const wh of this.wheels) wh.rotation.x+=this.vel*dt/0.36;
// 悬挂: 地形姿态 + 加减速俯仰弹簧
const sn2=Math.sin(this.yaw), cs2=Math.cos(this.yaw);
const hF=heightAt(this.pos.x+sn2*2.4,this.pos.z+cs2*2.4), hB=heightAt(this.pos.x-sn2*2.4,this.pos.z-cs2*2.4);
// 左侧采样: (-cs,+sn) 垂直于行进方向
const hL=heightAt(this.pos.x-cs2*1.6,this.pos.z+sn2*1.6), hR=heightAt(this.pos.x+cs2*1.6,this.pos.z-sn2*1.6);
const accel=(this.vel-this.lastVel)/Math.max(dt,0.001); this.lastVel=this.vel;
const tgtP=-Math.atan2(hF-hB,4.8)-clamp(accel*0.011,-0.09,0.09);
const tgtR=Math.atan2(hR-hL,3.2);
this.suspPV+=((tgtP-this.suspP)*46-this.suspPV*7.5)*dt;
this.suspP+=this.suspPV*dt;
this.suspRV+=((tgtR-this.suspR)*46-this.suspRV*7.5)*dt;
this.suspR+=this.suspRV*dt;
// 每个路轮独立行程: 采样各自地面高度, 弹簧上下浮动
for(const wh of this.wheels){
const ud=wh.userData;
const wx=this.pos.x+sn2*ud.lz+cs2*ud.sx;
const wz=this.pos.z+cs2*ud.lz-sn2*ud.sx;
const wgh=heightAt(wx,wz);
const hullY=this.pos.y-this.suspP*ud.lz+this.suspR*ud.sx;
const tgtY=ud.baseY+clamp(wgh-hullY,-0.17,0.17);
ud.vy+=((tgtY-wh.position.y)*70-ud.vy*9)*dt;
wh.position.y+=ud.vy*dt;
}
this.grp.position.copy(this.pos);
this.grp.rotation.order='YXZ';
this.grp.rotation.set(this.suspP,this.yaw,this.suspR);
this.turretG.rotation.y=this.turretYaw;
this.pitchG.rotation.x=-this.turretPitch;
const dir=this.aimDir();
this.muzzle.set(this.pos.x+dir.x*this.barrelTip,this.pos.y+1.93+dir.y*this.barrelTip,this.pos.z+dir.z*this.barrelTip);
if(this.hp<this.maxHp*0.45){
this.smokeT-=dt;
if(this.smokeT<=0){ this.smokeT=0.12;
spawnP(PT.dark,this.pos.x+rand(-0.8,0.8),this.pos.y+1.8,this.pos.z+rand(-0.8,0.8),rand(-0.3,0.3),rand(1,2),rand(-0.3,0.3),0.7,1.4,rand(0.8,1.4),0.7,0.2);
}
}
}
driveAI(dt){
// 驾驶员阵亡: 原地瘫痪等待替补
if(this.crewDown('driver')){ this.vel=dampF(this.vel,0,6,dt); return; }
this.thinkCD-=dt; this.repathT-=dt;
if(this.thinkCD<=0){
this.thinkCD=rand(0.6,0.9);
if(GAMEMODE==='assault'){
const bf=FLAGS[Math.min(assaultIdx,FLAGS.length-1)];
if(this.objective!==bf){ this.objective=bf; this.repathT=0; }
} else if(GAMEMODE==='demolition'){
const dp=nearestDepot(this.pos.x,this.pos.z);
const bf=dp?{x:dp.x,z:dp.z}:FLAGS[0];
if(!this.objective||this.objective.x!==bf.x){ this.objective=bf; this.repathT=0; }
} else {
const retreat=this.hp<this.maxHp*0.26;
let best=null,bs=-1e9;
for(const f of FLAGS){
let sc=-Math.hypot(f.x-this.pos.x,f.z-this.pos.z)*0.8;
if(retreat){ if(f.owner===this.team) sc+=200; }
else {
if(f.owner!==this.team) sc+=130;
if(f.owner===this.team&&f.capTeam!==-1&&f.capTeam!==this.team) sc+=220;
// 与友方坦克分散
for(const t2 of tanks){ if(t2!==this&&t2.alive&&t2.team===this.team&&t2.objective===f) sc-=90; }
}
sc+=rand(0,30);
if(sc>bs){ bs=sc; best=f; }
}
if(this.objective!==best){ this.objective=best; this.repathT=0; }
}
}
const f=this.objective;
if(!f) return;
// 倒车脱困
if(this.reverseT>0){
this.reverseT-=dt;
this.vel=dampF(this.vel,-this.def.rev,3,dt);
this.yaw+=this.revTurn*dt;
if(this.reverseT<=0){ this.repathT=0; this.stuckT=0; }
return;
}
const dObj=Math.hypot(f.x-this.pos.x,f.z-this.pos.z);
const engagedStop=this.tTarget&&this.tTarget.kind==='tank'&&this.tMemT>0&&this.losOK&&this.tDist<110;
if(dObj<20||engagedStop){
this.vel=dampF(this.vel,0,4,dt);
this.path=null;
return;
}
// A*寻路
if(!this.path||this.repathT<=0){
NAV.budget=Math.max(NAV.budget,1);
this.path=NAV.findPath(this.pos.x,this.pos.z,f.x+rand(-6,6),f.z+rand(-6,6));
this.pathI=0; this.repathT=rand(5,7); this.progT=0;
}
let steer=null;
if(this.path&&this.pathI<this.path.length){
const wp=this.path[this.pathI];
const dx=wp[0]-this.pos.x, dz=wp[1]-this.pos.z;
if(dx*dx+dz*dz<20){ this.pathI++; }
else steer=Math.atan2(dx,dz);
}
if(steer===null){ steer=Math.atan2(f.x-this.pos.x,f.z-this.pos.z); }
// 宽车体触须微调
let bestAng=0,found=false;
for(const a of [0,0.3,-0.3,0.6,-0.6]){
const px=this.pos.x+Math.sin(steer+a)*6.5, pz=this.pos.z+Math.cos(steer+a)*6.5;
const lx=Math.cos(steer+a)*1.3, lz=-Math.sin(steer+a)*1.3;
if(!occBlocked(px,pz)&&!occBlocked(px+lx,pz+lz)&&!occBlocked(px-lx,pz-lz)){ bestAng=a; found=true; break; }
}
if(found) steer+=bestAng;
const diff=angDiff(this.yaw,steer);
this.yaw=angleLerpTo(this.yaw,steer,this.def.turn*dt);
this.vel=dampF(this.vel,(Math.abs(diff)>0.75?2.0:this.def.spd)*(this.engineHitT>0?0.35:1),3,dt);
// 进度式卡住检测
this.progT+=dt;
if(this.progT>1.1){
if(this.pos.distanceTo(this.lastPos)<1.0){
this.stuckT+=1;
this.reverseT=rand(1.2,1.8);
this.revTurn=(Math.random()<0.5?1:-1)*0.5;
if(this.stuckT>=4&&this.crewBot){ this.crewBot.dismountVehicle(false); this.stuckT=0; }
} else this.stuckT=Math.max(0,this.stuckT-1);
this.lastPos.copy(this.pos);
this.progT=0;
}
}
turretAI(dt){
// 目标选择: 贴近步兵/反坦克威胁 > 敌坦克 > 远处步兵
if(this.tMemT>0) this.tMemT-=dt;
this.retargetT=(this.retargetT||0)-dt;
if(this.retargetT<=0){
this.retargetT=0.4;
let best=null,bs=-1e9,bd=0;
for(const t of tanks){
if(!t.alive||t.team===this.team) continue;
const d=t.pos.distanceTo(this.pos);
if(d<260){ const sc=170-d*0.45; if(sc>bs){ bs=sc; best=t; bd=d; } }
}
for(const s of combatants){
if(!s.alive||s.team===this.team||s.onVehicle) continue;
const d=Math.hypot(s.pos.x-this.pos.x,s.pos.z-this.pos.z);
if(d>140) continue;
if(SMOKES.length&&smokeBlocksLOS(this.pos.x,this.pos.y+1.9,this.pos.z,s.pos.x,s.pos.y+1,s.pos.z)) continue;
let sc=90-d*0.9;
if(d<30) sc+=110;
const atThreat=s.cls===5||(s.atn||0)>0||(s.atNades||0)>0;
if(atThreat) sc+=(d<70?150:60);
if(s.empUse&&s.empUse.kind==='at') sc+=260;
else if(s.mgUse||s.empUse) sc+=70;
if(sc>bs){ bs=sc; best=s; bd=d; }
}
if(best){
if(best!==this.tTarget){ this.aimReact=rand(0.7,1.3)*DIFF_TABLE[SETTINGS.diff].react*2+0.35; this.losOK=false; }
this.tTarget=best; this.tMemT=4; this.tDist=bd;
}
else if(this.tMemT<=0){ this.tTarget=null; this.losOK=false; }
}
let aimYaw=null, aimPitch=0;
const tgt=this.tTarget&&(this.tTarget.alive!==false)?this.tTarget:null;
if(tgt){
const isTank=tgt.kind==='tank';
const lead=isTank?clamp(this.tDist/130,0,1.2):0;
const tx=tgt.pos.x+(isTank?Math.sin(tgt.yaw)*tgt.vel*lead:0);
const tz=tgt.pos.z+(isTank?Math.cos(tgt.yaw)*tgt.vel*lead:0);
aimYaw=Math.atan2(tx-this.pos.x,tz-this.pos.z);
const dh=Math.hypot(tx-this.pos.x,tz-this.pos.z);
aimPitch=clamp(Math.atan2((tgt.pos.y+(isTank?1.3:1.0))-(this.pos.y+1.93),Math.max(dh,2)),-0.15,0.3);
} else if(this.threatYaw!==null){
aimYaw=this.threatYaw;
}
this.aimReact=(this.aimReact||0)-dt;
if(aimYaw!==null&&!this.crewDown('gunner')){
let wantTY=angDiff(this.yaw,aimYaw);
// 坦歼: 超出射界时车体转向对准
if(this.def.casemate){
if(Math.abs(wantTY)>0.2&&Math.abs(this.vel)<1.5){
this.yaw=angleLerpTo(this.yaw,aimYaw,this.def.turn*0.7*dt);
wantTY=angDiff(this.yaw,aimYaw);
}
wantTY=clamp(wantTY,-0.21,0.21);
}
// 拟人反应: 未反应时炮塔转速减半且不开火; 车长阵亡观察变慢
const rate=this.def.tRate*(this.aimReact>0?0.45:1)*(this.crewDown('commander')?0.75:1);
this.turretYaw=angleLerpTo(this.turretYaw,wantTY,rate*dt);
this.turretPitch=dampF(this.turretPitch,aimPitch,3,dt);
if(tgt&&this.aimReact<=0&&Math.abs(angDiff(this.turretYaw,angDiff(this.yaw,aimYaw)))<0.05){
const dir=this.aimDir();
const o=this.muzzle.clone();
const dh=Math.hypot(tgt.pos.x-this.pos.x,tgt.pos.z-this.pos.z);
const isTank=tgt.kind==='tank';
if(this.cannonCd<=0&&(isTank||dh>10)){
const chk=raycastWorld(o,dir,dh);
this.losOK=(!chk||chk.dist>dh-3.5);
if(this.losOK&&SMOKES.length&&smokeBlocksLOS(o.x,o.y,o.z,tgt.pos.x,tgt.pos.y+1.2,tgt.pos.z)) this.losOK=false;
if(this.losOK){ this.fireCannon(); }
else this.cannonCd=0.6;
}
// 同轴机枪打步兵
if(!isTank&&dh<95&&this.mgT<=0&&this.mgPause<=0){
if(this.mgBurst<=0) this.mgBurst=randi(5,9);
this.mgT=0.115;
const mdir=dir.clone();
mdir.x+=rand(-0.022,0.022); mdir.y+=rand(-0.015,0.015); mdir.z+=rand(-0.022,0.022); mdir.normalize();
const mo=this.coaxMuzzle();
fireBullet(this.crewBot||this.crew,mo,mdir,{dmg:16,headMul:1.6,snd:'smg',tracer:2,vehDmg:2},mo);
if(--this.mgBurst<=0) this.mgPause=rand(0.6,1.2);
}
}
}
}
fireCannon(customDir){
if(this.cannonCd>0) return;
if(this.crewDown('gunner')&&!this.playerDriven) return;
this.cannonCd=this.def.reload*(this.crewDown('loader')?1.6:1);
let dir=this.aimDir();
if(customDir) dir=customDir;
else if(this.isAI){
const err=0.011;
dir.x+=rand(-err,err); dir.y+=rand(-err,err)*0.6; dir.z+=rand(-err,err); dir.normalize();
}
const origin=this.muzzle.clone();
const shooter=this.playerDriven?player:(this.crewBot||this.crew);
AudioSys.cannon(this.pos.distanceTo(camera.position));
spawnP(PT.flash,origin.x,origin.y,origin.z, dir.x*3,dir.y*3,dir.z*3, 1.0,10,0.12,1,0,true);
spawnP(PT.dark,origin.x,origin.y,origin.z, dir.x*3+rand(-1,1),1.5,dir.z*3+rand(-1,1), 1.0,3,0.9,0.7,0.5);
if(this.playerDriven) addTrauma(0.5);
this.suspPV-=0.55*Math.cos(this.turretYaw);
this.suspRV+=0.4*Math.sin(this.turretYaw);
shells.push({pos:origin.clone(),vel:dir.clone().multiplyScalar(130),team:this.team,owner:shooter,life:3.5,kind:this.def.heavy?'heavy':'tank',dmgV:this.def.dmg,pen:this.def.pen||110,trail:0});
shooter.lastFiredT=nowT;
gunEvents.push({x:origin.x,z:origin.z,team:this.team,t:nowT,shooter});
}
firePlayerMG(dir){
if(this.mgT>0) return;
this.mgT=0.105;
const o=this.coaxMuzzle();
fireBullet(player,o,dir,{dmg:18,headMul:1.7,snd:'smg',tracer:2,vehDmg:2},o);
AudioSys.gunshot('smg',0,0);
addTrauma(0.02);
}
takeDmg(amt,attacker){
if(!this.alive) return;
this.hp-=amt;
this.lastDmgT=nowT;
if(this.playerDriven){ dmgFlash=Math.min(1,dmgFlash+0.35); addTrauma(0.3); }
else if(attacker&&attacker.pos){
this.threatYaw=Math.atan2(attacker.pos.x-this.pos.x,attacker.pos.z-this.pos.z);
setTimeout(()=>{ if(this.threatYaw!==null) this.threatYaw=null; },6000);
}
if(this.hp<=0) this.die(attacker);
}
die(attacker){
this.alive=false;
this.respawnT=rand(40,52);
this.vel=0; this.crew.alive=false;
if(this.playerDriven){
this.playerDriven=false;
player.onVehicle=null;
player.damage(999,attacker,false);
}
if(this.crewBot){
const cb=this.crewBot;
this.crewBot=null;
cb.onVehicle=null;
if(cb.mesh) cb.mesh.root.visible=true;
cb.pos.set(this.pos.x,this.pos.y,this.pos.z+1.5);
cb.damage(999,attacker,false);
}
if(attacker&&attacker.team!==this.team){
attacker.kills=(attacker.kills||0)+1;
attacker.score=(attacker.score||0)+300;
addKillfeed(attacker,{name:this.name,team:this.team,isPlayer:false},false);
if(attacker.isPlayer) showScorePop('+300 摧毁坦克');
}
tickets[this.team]=Math.max(0,tickets[this.team]-(this.def.heavy?6:5));
explosionFX(this.pos.clone().add(V3(0,1.4,0)));
AudioSys.explosion(this.pos.distanceTo(camera.position));
this.grp.traverse(o=>{ if(o.isMesh){ if(!o.userData.mat0) o.userData.mat0=o.material; o.material=wreckMat; } });
this.grp.rotation.x=this.suspP+rand(-0.1,0.1);
const wsn=Math.sin(this.yaw), wcs=Math.cos(this.yaw);
this.wreckBs=[];
for(const off of [-1.9,0,1.9]){
this.wreckBs.push(registerDynCollider(this.pos.x+wsn*off,this.pos.y+0.95,this.pos.z+wcs*off,2.5,1.9,2.5));
}
}
respawn(){
// 出生在基地前方开阔地, 避免卡基地围墙; 空车等待步兵上车
this.pos.set(BASES[this.team].x+(this.team===0?15:-15),0,BASES[this.team].z+(this.variant===0?10:(this.variant===1?-10:20)));
this.pos.y=heightAt(this.pos.x,this.pos.z);
this.yaw=this.team===0?HPI:-HPI;
this.turretYaw=0; this.turretPitch=0;
this.hp=this.maxHp; this.alive=true; this.isAI=true; this.playerDriven=false;
this.crew.alive=true;
this.crewBot=null; this.claimBot=null; this.noEnterT=0;
this.stuckT=0; this.vel=0; this.path=null; this.reverseT=0; this.tTarget=null; this.threatYaw=null;
this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0;
if(this.crewMen) for(const cm of this.crewMen){ cm.alive=true; cm.respT=0; if(cm.fig&&(cm.role!=='driver'||this.def.openTop)) cm.fig.visible=true; }
if(this.wreckBs){ for(const b of this.wreckBs) killDynCollider(b); this.wreckBs=null; }
this.grp.rotation.set(0,this.yaw,0);
this.grp.traverse(o=>{ if(o.isMesh&&o.userData.mat0) o.material=o.userData.mat0; });
}
}
function enemyTankNear(sol,dist){
for(const t of tanks) if(t.alive&&t.team!==sol.team&&Math.hypot(t.pos.x-sol.pos.x,t.pos.z-sol.pos.z)<dist) return t;
return null;
}
function nearestDepot(x,z){
let best=null,bd=1e9;
for(const d of DEPOTS){
if(d.destroyed) continue;
const dd=Math.hypot(d.x-x,d.z-z);
if(dd<bd){ bd=dd; best=d; }
}
return best;
}
function updateShells(dt){
for(let i=shells.length-1;i>=0;i--){
const s=shells[i];
s.life-=dt;
if(s.life<=0){ shells.splice(i,1); continue; }
const step=s.vel.length()*dt;
const dir=s.vel.clone().normalize();
s.vel.y-=3.5*dt;
s.trail-=dt;
if(s.trail<=0){ s.trail=0.05; spawnP(PT.spark,s.pos.x,s.pos.y,s.pos.z,0,0,0,0.16,-0.1,0.09,1,0,true); }
let hitD=step+0.5, hit=null, hitTank=null, hitSol=null, tankHitInfo=null;
const wr=raycastWorld(s.pos,dir,hitD);
if(wr){ hitD=wr.dist; hit=wr; }
for(const t of tanks){
if(!t.alive||t.team===s.team) continue;
if(Math.hypot(t.pos.x-s.pos.x,t.pos.z-s.pos.z)>step+8) continue;
const r=rayTankParts(s.pos,dir,hitD,t);
if(r){ hitD=r.t; hit=r; hitTank=t; tankHitInfo=r; hitSol=null; }
}
const sr=raySoldiers(s.pos,dir,hitD,{team:s.team,isPlayer:false});
if(sr){ hitD=sr.t; hitSol=sr.sol; hitTank=null; hit=sr; }
let hitApc=null;
for(const a of (typeof apcs!=='undefined'?apcs:[])){
if(!a.alive||a.team===s.team) continue;
const r=rayCyl(s.pos,dir,{x:a.pos.x,z:a.pos.z,r:1.8,y0:a.pos.y,y1:a.pos.y+2.3},hitD);
if(r){ hitD=r.t; hit=r; hitApc=a; hitTank=null; hitSol=null; }
}
if(hit){
const p=V3(s.pos.x+dir.x*hitD,s.pos.y+dir.y*hitD,s.pos.z+dir.z*hitD);
if(hitApc){
hitApc.takeDmg((s.dmgV||300)*1.2,s.owner);
explosionFXSmall(p);
AudioSys.explosion(p.distanceTo(camera.position)*1.4);
shells.splice(i,1);
continue;
}
if(hitTank){
// ===== 击穿模拟 =====
const pen=s.pen||(s.kind==='at'?150:110);
const res=armorSolve(hitTank,tankHitInfo,pen);
const shooterIsP=s.owner&&s.owner.isPlayer;
const victimIsP=hitTank.playerDriven;
if(res.pen){
// 击穿: 主伤害 + 模块/乘员殉伤
let dmg=(s.dmgV||300)*(0.8+rand(0,0.45));
const roll=Math.random();
let extra='';
if(roll<0.38&&hitTank.crewMen&&hitTank.crewMen.length){
const alive=hitTank.crewMen.filter(c=>c.alive);
if(alive.length){ const cm=alive[randi(0,alive.length-1)]; hitTank.crewKilled(cm,s.owner,false); extra=CREW_ROLE_CN[cm.role]+'阵亡'; }
} else if(roll<0.56&&(res.zone==='rear'||res.zone==='side')){
hitTank.engineHitT=12; extra='发动机损毁';
} else if(roll<0.68&&(res.zone==='side'||res.zone==='rear'||res.zone==='turret')){
dmg+=280; extra='弹药殉爆';
if(Math.random()<0.3) dmg+=hitTank.hp;
}
hitTank.takeDmg(dmg,s.owner);
if(shooterIsP) showScorePop('击穿! '+(extra||res.zone==='turret'?'炮塔':'车体')+(extra?(' · '+extra):''));
if(victimIsP) showScorePop('被击穿! '+(extra||''));
explosionFXSmall(p);
for(let k=0;k<5;k++) spawnP(PT.spark,p.x,p.y,p.z,rand(-4,4),rand(1,5),rand(-4,4),0.2,0,rand(0.15,0.3),1,5,true);
AudioSys.explosion(p.distanceTo(camera.position)*1.4);
} else {
// 跳弹/未击穿
hitTank.takeDmg((s.dmgV||300)*0.05,s.owner);
if(shooterIsP) showScorePop(Math.random()<0.5?'跳弹!':'未击穿 ('+res.eff+'mm)');
if(victimIsP&&Math.random()<0.6) showScorePop('装甲弹开了炮弹!');
for(let k=0;k<8;k++) spawnP(PT.spark,p.x,p.y,p.z,rand(-6,6),rand(1,6),rand(-6,6),0.16,0,rand(0.12,0.25),1,4,true);
AudioSys.ricochet(p.distanceTo(camera.position)*0.5);
AudioSys.click(300,0.5,0.1);
}
shells.splice(i,1);
continue;
}
if(hitSol){ hitSol.damage(200,s.owner,false); }
explosionFXSmall(p);
AudioSys.explosion(p.distanceTo(camera.position)*1.6);
splashDamage(p,s.owner,s.team,5,s.kind==='at'?70:95,60);
damageStructures(p,6,s.kind==='at'?140:190);
shells.splice(i,1);
continue;
}
s.pos.addScaledVector(dir,step);
}
}
function explosionFXSmall(p){
spawnP(PT.flash,p.x,p.y+0.3,p.z,0,1,0, 1.6,10,0.12,1,0,true);
for(let i=0;i<6;i++) spawnP(PT.dark,p.x+rand(-0.5,0.5),p.y+rand(0.2,1),p.z+rand(-0.5,0.5), rand(-1.5,1.5),rand(1,3),rand(-1.5,1.5), rand(0.6,1),1.8,rand(0.7,1.3),0.8,0.6);
for(let i=0;i<6;i++) spawnP(PT.dirt,p.x,p.y+0.2,p.z, rand(-4,4),rand(2,6),rand(-4,4), rand(0.25,0.5),0.5,rand(0.5,0.9),0.9,8);
}
function splashDamage(p,attacker,team,radius,dmgMax,dmgVeh){
for(const s of combatants){
if(!s.alive||s.onVehicle) continue;
if(s.team===team&&s!==attacker) continue; // 不误伤队友, 但炸自己会受伤
const d=Math.hypot(s.pos.x-p.x,(s.pos.y+0.9)-p.y,s.pos.z-p.z);
if(d<radius) s.damage(lerp(dmgMax,10,d/radius),attacker,false);
}
for(const t of tanks){
if(!t.alive||t.team===team) continue;
const d=t.pos.distanceTo(p);
if(d<radius+2.5) t.takeDmg(lerp(dmgVeh,10,d/(radius+2.5)),attacker);
}
for(const a of (typeof apcs!=='undefined'?apcs:[])){
if(!a.alive||a.team===team) continue;
const d=a.pos.distanceTo(p);
if(d<radius+2.5) a.takeDmg(lerp(dmgVeh*1.3,12,d/(radius+2.5)),attacker);
}
if(player.alive&&p.distanceTo(camera.position)<18) addTrauma(0.5);
}
