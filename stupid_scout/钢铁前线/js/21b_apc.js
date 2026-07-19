'use strict';
// ===================== 运兵车 (APC / 军用卡车) =====================
// - 每阵营不同型号(半履带/卡车/民用改装), 司机(bot或玩家) + 多名乘客
// - 乘客(玩家与bot)可在车斗内直接开枪; 敞开车斗乘员可被直接击杀
// - AI 上车规则: 玩家车附近的小队优先上车; 远处 AI 自行决定
const apcs=[];
function isApcPassenger(){ const v=player.onVehicle; return !!(v&&v.kind==='apc'&&player.playerSeat>=0); }
class APC{
constructor(team){
this.kind='apc';
this.team=team;
this.def=(TEAM_FACTION[team].trucks&&TEAM_FACTION[team].trucks[0])||{name:'卡车',hp:300,spd:8.6,rev:4,turn:1.1,seats:6,open:true,col:0x5a5f50};
this.name=this.def.name;
this.hp=this.def.hp; this.maxHp=this.def.hp; this.alive=true;
this.pos=V3(); this.yaw=0; this.vel=0;
this.playerDriven=false;
this.crewBot=null;
this.passengers=[];
this.crew={ name:this.name, team, kills:0, deaths:0, score:0, isPlayer:false, isCrew:true, pos:this.pos, alive:true, lastFiredT:-99, damage(){}, vel:V3() };
this.claimBot=null; this.noEnterT=0;
this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0; this.lastVel=0;
this.path=null; this.pathI=0; this.repathT=0; this.thinkCD=0; this.stuckT=0; this.progT=0; this.lastPos=V3(); this.reverseT=0; this.revTurn=0;
this.respawnT=0; this.wreckBs=null; this.smokeT=0;
this.wheels=[];
this.buildMesh();
this.engine=AudioSys.createEngine('tank');
apcs.push(this);
this.respawn();
}
buildMesh(){
const D=this.def;
this.matBody=new THREE.MeshLambertMaterial({color:D.col});
const matB=new THREE.MeshLambertMaterial({color:0x30322c});
const matW=new THREE.MeshLambertMaterial({map:TEX.gunwoodD||TEX.woodDark});
this.grp=new THREE.Group();
// 发动机罩 + 驾驶室
const hood=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.85,1.6),this.matBody); hood.position.set(0,1.15,2.45); this.grp.add(hood);
const cab=new THREE.Mesh(new THREE.BoxGeometry(2.0,1.15,1.2),this.matBody); cab.position.set(0,1.55,1.3); this.grp.add(cab);
const winShield=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.55,0.06),new THREE.MeshLambertMaterial({color:0x2c3438})); winShield.position.set(0,1.8,1.95); winShield.rotation.x=-0.2; this.grp.add(winShield);
// 载员车斗(敞开): 底板 + 侧帮 + 两排板凳
const bed=new THREE.Mesh(new THREE.BoxGeometry(2.1,0.14,3.6),D.civ?matW:this.matBody); bed.position.set(0,1.05,-1.15); this.grp.add(bed);
const rail=D.civ?matW:this.matBody;
const sideL=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.6,3.6),rail); sideL.position.set(-1.02,1.42,-1.15); this.grp.add(sideL);
const sideR=sideL.clone(); sideR.position.x=1.02; this.grp.add(sideR);
const back=new THREE.Mesh(new THREE.BoxGeometry(2.1,0.6,0.1),rail); back.position.set(0,1.42,-2.9); this.grp.add(back);
const benchL=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.08,3.3),matW); benchL.position.set(-0.7,1.35,-1.15); this.grp.add(benchL);
const benchR=benchL.clone(); benchR.position.x=0.7; this.grp.add(benchR);
if(D.civ){
// 民用改装: 木条棚架
for(let i=0;i<3;i++){
const hoop=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.07,0.07),matW); hoop.position.set(0,2.15,-0.2-i*1.0); this.grp.add(hoop);
const legL=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.75,0.06),matW); legL.position.set(-1.05,1.8,-0.2-i*1.0); this.grp.add(legL);
const legR=legL.clone(); legR.position.x=1.05; this.grp.add(legR);
}
}
if(D.mg){
// 车斗机枪(视觉)
const mgp=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.9,6),matB); mgp.rotation.x=HPI; mgp.position.set(0,2.0,0.5); this.grp.add(mgp);
const mgm=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.5,0.1),matB); mgm.position.set(0,1.72,0.55); this.grp.add(mgm);
}
// 轮子/半履带
if(D.half){
const trackMat=new THREE.MeshLambertMaterial({map:TEX.track});
for(const sx of [-0.92,0.92]){
const tr=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.7,3.4),trackMat); tr.position.set(sx,0.6,-1.2); this.grp.add(tr);
}
for(const sx of [-0.95,0.95]){
const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.46,0.3,10),matB);
wh.rotation.z=HPI; wh.position.set(sx,0.5,2.35);
this.grp.add(wh); this.wheels.push(wh);
}
} else {
for(const [sx,sz] of [[-0.95,2.35],[0.95,2.35],[-0.95,-0.4],[0.95,-0.4],[-0.95,-2.1],[0.95,-2.1]]){
const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.44,0.44,0.28,10),matB);
wh.rotation.z=HPI; wh.position.set(sx,0.46,sz);
this.grp.add(wh); this.wheels.push(wh);
}
}
// 座位局部坐标: 0=司机, 1..N=车斗(两排相对而坐)
this.seatLocal=[V3(-0.5,1.9,1.3)];
const N=this.def.seats||6;
for(let i=0;i<N;i++){
const side=i%2===0?-0.7:0.7;
const row=Math.floor(i/2);
this.seatLocal.push(V3(side,1.75,-0.2-row*0.95));
}
this.grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
world.add(this.grp);
}
seatWorld(i,out){
const l=this.seatLocal[Math.min(i+1,this.seatLocal.length-1)]||this.seatLocal[0];
const sn=Math.sin(this.yaw),cs=Math.cos(this.yaw);
out=out||V3();
out.set(this.pos.x+cs*l.x+sn*l.z, this.pos.y+1.12, this.pos.z-sn*l.x+cs*l.z);
return out;
}
freeSeat(){
const N=this.def.seats||6;
for(let i=0;i<N;i++){
if(this.playerSeat===i) continue;
if(!this.passengers.some(b=>b.seatIdx===i)) return i;
}
return -1;
}
boardPassenger(bot){
const i=this.freeSeat();
if(i<0) return false;
bot.seatIdx=i;
bot.onVehicle=this;
this.passengers.push(bot);
bot.path=null; bot.targetVeh=null; bot.state='idle';
if(bot.mgUse){ bot.mgUse.user=null; bot.mgUse=null; }
return true;
}
removePassenger(bot,bail){
const i=this.passengers.indexOf(bot);
if(i>=0) this.passengers.splice(i,1);
bot.onVehicle=null;
if(bot.mesh) bot.mesh.root.visible=true;
let px=this.pos.x+Math.cos(this.yaw)*2.6, pz=this.pos.z-Math.sin(this.yaw)*2.6;
if(occBlocked(px,pz)){ px=this.pos.x-Math.cos(this.yaw)*2.6; pz=this.pos.z+Math.sin(this.yaw)*2.6; }
bot.pos.set(px,0,pz);
bot.pos.y=standHeight(px,pz,this.pos.y+2);
bot.path=null; bot.state='idle'; bot.decisionT=0;
if(bail) bot.suppression=0.8;
}
update(dt){
if(!this.alive){
this.respawnT-=dt;
this.engine.update(0,0);
if(this.respawnT<=0&&!matchOver) this.respawn();
return;
}
const dCam=this.pos.distanceTo(camera.position);
this.engine.update(70+Math.abs(this.vel)*6, clamp(0.26-dCam/100,0,0.26)*(0.5+Math.abs(this.vel)*0.06));
if(this.crewBot&&!this.playerDriven&&this.hp<this.maxHp*0.3){
this.crewBot.dismountVehicle(true);
for(const b of [...this.passengers]) this.removePassenger(b,true);
}
if(this.playerDriven){ /* 玩家驾驶输入在 updatePlayerApcDriver */ }
else if(this.crewBot&&this.crewBot.alive){ this.driveAI(dt); }
else { this.vel=dampF(this.vel,0,4,dt); }
const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
this.pos.x+=sn*this.vel*dt; this.pos.z+=cs*this.vel*dt;
// 碰撞(简化圆探针)
let hitObstacle=false;
for(const off of [-1.6,0,2.2]){
const cxp=this.pos.x+sn*off, czp=this.pos.z+cs*off;
for(const b of BOXES){
if(b.dead||this.pos.y+2<b.minY||this.pos.y>b.maxY) continue;
if(b.maxY-b.gh<0.7) continue;
const cx=clamp(cxp,b.minX,b.maxX), cz=clamp(czp,b.minZ,b.maxZ);
const dx=cxp-cx, dz=czp-cz;
const d2=dx*dx+dz*dz;
if(d2<1.3*1.3){
if(d2>1e-8){
const d=Math.sqrt(d2), push=(1.3-d)/d;
this.pos.x+=dx*push; this.pos.z+=dz*push;
}
this.vel*=0.45;
hitObstacle=true;
}
}
for(const c of CYLS){
if(c.r<0.3) continue;
const dx=cxp-c.x, dz=czp-c.z;
const rr=c.r+1.25, d2=dx*dx+dz*dz;
if(d2<rr*rr&&d2>1e-8){
const d=Math.sqrt(d2), push=(rr-d)/d;
this.pos.x+=dx*push*0.6; this.pos.z+=dz*push*0.6;
this.vel*=0.55;
hitObstacle=true;
}
}
}
if(hitObstacle&&!this.playerDriven) this.stuckT+=dt*2;
for(const t2 of [...tanks,...apcs]){
if(t2===this||!t2.alive) continue;
const dx=this.pos.x-t2.pos.x, dz=this.pos.z-t2.pos.z;
const d2=dx*dx+dz*dz;
if(d2<4.2*4.2&&d2>1e-6){
const d=Math.sqrt(d2), push=(4.2-d)/d*0.5;
this.pos.x+=dx*push; this.pos.z+=dz*push;
}
}
const lim=MAP_SIZE/2+6;
this.pos.x=clamp(this.pos.x,-lim,lim); this.pos.z=clamp(this.pos.z,-lim,lim);
this.pos.y=dampF(this.pos.y,heightAt(this.pos.x,this.pos.z),8,dt);
// 悬挂姿态
const hF=heightAt(this.pos.x+sn*2.2,this.pos.z+cs*2.2), hB=heightAt(this.pos.x-sn*2.2,this.pos.z-cs*2.2);
const hL=heightAt(this.pos.x-cs*1.1,this.pos.z+sn*1.1), hR=heightAt(this.pos.x+cs*1.1,this.pos.z-sn*1.1);
const accel=(this.vel-this.lastVel)/Math.max(dt,0.001); this.lastVel=this.vel;
const tgtP=-Math.atan2(hF-hB,4.4)-clamp(accel*0.014,-0.11,0.11);
const tgtR=Math.atan2(hR-hL,2.2);
this.suspPV+=((tgtP-this.suspP)*40-this.suspPV*7)*dt;
this.suspP+=this.suspPV*dt;
this.suspRV+=((tgtR-this.suspR)*40-this.suspRV*7)*dt;
this.suspR+=this.suspRV*dt;
for(const wh of this.wheels) wh.rotation.x+=this.vel*dt/0.45;
this.grp.position.copy(this.pos);
this.grp.rotation.order='YXZ';
this.grp.rotation.set(this.suspP,this.yaw,this.suspR);
if(this.hp<this.maxHp*0.4){
this.smokeT-=dt;
if(this.smokeT<=0){ this.smokeT=0.15;
spawnP(PT.dark,this.pos.x,this.pos.y+1.6,this.pos.z+2.0,rand(-0.3,0.3),rand(1,2),rand(-0.3,0.3),0.6,1.2,rand(0.7,1.2),0.7,0.2);
}
}
// 同步乘客位置(乘客自身逻辑在 Bot.update 分支处理)
for(const b of this.passengers){
if(!b.alive) continue;
this.seatWorld(b.seatIdx,b.pos);
}
}
driveAI(dt){
// ===== 运输任务循环: 后方装载 → 运往前线卸载 → 折返继续接人 =====
this.thinkCD-=dt; this.repathT-=dt; this.dropT-=dt;
if(this.reverseT>0){
this.reverseT-=dt;
this.vel=dampF(this.vel,-this.def.rev,3,dt);
this.yaw+=this.revTurn*dt;
if(this.reverseT<=0){ this.repathT=0; this.stuckT=0; }
return;
}
if(!this.mission) this.mission='pickup';
// 接客点: 己方基地前方
if(!this.pickupPt){
this.pickupPt={x:BASES[this.team].x*0.8, z:BASES[this.team].z*0.8+(this.team===0?12:-12)};
}
// 前线目标与卸载点(旗点后撤26m, 避免把车直接开进火线)
if(this.thinkCD<=0){
this.thinkCD=rand(0.8,1.2);
let best=null,bs=-1e9;
for(const f of FLAGS){
let sc=-Math.hypot(f.x-this.pos.x,f.z-this.pos.z)*0.4;
if(GAMEMODE==='assault'){ if(f!==FLAGS[Math.min(assaultIdx,FLAGS.length-1)]) sc-=500; }
else if(f.owner!==this.team) sc+=140;
sc+=rand(0,20);
if(sc>bs){ bs=sc; best=f; }
}
if(best&&this.objective!==best){ this.objective=best; this.repathT=0; }
if(this.objective){
const f=this.objective;
const bx2=BASES[this.team].x-f.x, bz2=BASES[this.team].z-f.z;
const bl=Math.hypot(bx2,bz2)||1;
this.dropPt={x:f.x+bx2/bl*26, z:f.z+bz2/bl*26};
}
}
let goal=null;
if(this.mission==='pickup'){
goal=this.pickupPt;
const dG=Math.hypot(goal.x-this.pos.x,goal.z-this.pos.z);
if(dG<9){
// 停车装载: 等步兵上车
this.vel=dampF(this.vel,0,4,dt);
this.path=null;
this.waitT=(this.waitT||0)+dt;
const full=this.passengers.length>=Math.min(4,this.def.seats||6);
if(full||(this.passengers.length>0&&this.waitT>13)||this.waitT>28){
this.mission='transit'; this.waitT=0; this.repathT=0;
}
return;
}
} else if(this.mission==='transit'){
goal=this.dropPt||this.pickupPt;
const dG=Math.hypot(goal.x-this.pos.x,goal.z-this.pos.z);
if(dG<11){ this.mission='unload'; this.waitT=0; }
} else if(this.mission==='unload'){
this.vel=dampF(this.vel,0,4,dt);
this.path=null;
this.waitT=(this.waitT||0)+dt;
if(this.passengers.length&&Math.abs(this.vel)<1&&this.dropT<=0){
this.dropT=0.35;
this.removePassenger(this.passengers[this.passengers.length-1],false);
}
if(!this.passengers.length||this.waitT>8){
this.mission='return'; this.waitT=0; this.repathT=0;
}
return;
} else { // return
goal=this.pickupPt;
const dG=Math.hypot(goal.x-this.pos.x,goal.z-this.pos.z);
if(dG<9){ this.mission='pickup'; this.waitT=0; }
}
if(!goal) return;
if(!this.path||this.repathT<=0){
NAV.budget=Math.max(NAV.budget,1);
this.path=NAV.findPath(this.pos.x,this.pos.z,goal.x+rand(-4,4),goal.z+rand(-4,4));
this.pathI=0; this.repathT=rand(5,7); this.progT=0;
}
let steer=null;
if(this.path&&this.pathI<this.path.length){
const wp=this.path[this.pathI];
const dx=wp[0]-this.pos.x, dz=wp[1]-this.pos.z;
if(dx*dx+dz*dz<16){ this.pathI++; }
else steer=Math.atan2(dx,dz);
}
if(steer===null){ steer=Math.atan2(goal.x-this.pos.x,goal.z-this.pos.z); }
const diff=angDiff(this.yaw,steer);
this.yaw=angleLerpTo(this.yaw,steer,this.def.turn*dt);
this.vel=dampF(this.vel,Math.abs(diff)>0.8?2.2:this.def.spd,2.6,dt);
this.progT+=dt;
if(this.progT>1.2){
if(this.pos.distanceTo(this.lastPos)<1.0){
this.reverseT=rand(1.2,1.8);
this.revTurn=(Math.random()<0.5?1:-1)*0.6;
}
this.lastPos.copy(this.pos);
this.progT=0;
}
}
takeDmg(amt,attacker){
if(!this.alive) return;
this.hp-=amt;
this.lastDmgT=nowT;
if(this.playerDriven||this.playerSeat>=0){ dmgFlash=Math.min(1,dmgFlash+0.3); }
if(this.hp<=0) this.die(attacker);
}
die(attacker){
this.alive=false;
this.respawnT=rand(30,40);
this.vel=0;
// 乘员/乘客伤亡
if(this.playerDriven){ this.playerDriven=false; player.onVehicle=null; player.damage(999,attacker,false); }
if(this.playerSeat>=0){ this.playerSeat=-1; player.onVehicle=null; player.playerSeat=-1; player.damage(rand(60,120),attacker,false); }
if(this.crewBot){
const cb=this.crewBot; this.crewBot=null; cb.onVehicle=null;
cb.mesh&&(cb.mesh.root.visible=true);
cb.pos.set(this.pos.x,this.pos.y,this.pos.z+2);
cb.damage(999,attacker,false);
}
for(const b of [...this.passengers]){
this.removePassenger(b,true);
if(Math.random()<0.6) b.damage(rand(70,150),attacker,false);
}
this.passengers=[];
if(attacker&&attacker.team!==this.team){
attacker.kills=(attacker.kills||0)+1;
attacker.score=(attacker.score||0)+200;
addKillfeed(attacker,{name:this.name,team:this.team,isPlayer:false},false);
if(attacker.isPlayer) showScorePop('+200 摧毁运兵车');
}
tickets[this.team]=Math.max(0,tickets[this.team]-3);
explosionFX(this.pos.clone().add(V3(0,1.2,0)));
AudioSys.explosion(this.pos.distanceTo(camera.position));
this.grp.traverse(o=>{ if(o.isMesh){ if(!o.userData.mat0) o.userData.mat0=o.material; o.material=wreckMat; } });
this.wreckBs=[registerDynCollider(this.pos.x,this.pos.y+0.9,this.pos.z,2.2,1.8,2.2)];
}
respawn(){
this.pos.set(BASES[this.team].x+(this.team===0?15:-15),0,BASES[this.team].z+22);
this.pos.y=heightAt(this.pos.x,this.pos.z);
this.yaw=this.team===0?HPI:-HPI;
this.hp=this.maxHp; this.alive=true; this.playerDriven=false;
this.crewBot=null; this.claimBot=null; this.noEnterT=0;
this.playerSeat=-1;
this.passengers=[];
this.stuckT=0; this.vel=0; this.path=null; this.reverseT=0;
this.mission='pickup'; this.waitT=0; this.pickupPt=null; this.dropPt=null; this.objective=null;
this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0;
if(this.wreckBs){ for(const b of this.wreckBs) killDynCollider(b); this.wreckBs=null; }
this.grp.rotation.set(0,this.yaw,0);
this.grp.traverse(o=>{ if(o.isMesh&&o.userData.mat0) o.material=o.userData.mat0; });
}
}
function updateAPCs(dt){ for(const a of apcs) a.update(dt); }
// 玩家驾驶运兵车
function updatePlayerApcDriver(dt){
const p=player, a=p.onVehicle;
if(!a.alive){ p.onVehicle=null; return; }
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
const turn=(keys.KeyD?1:0)-(keys.KeyA?1:0);
a.vel=dampF(a.vel,fwd<0?-a.def.rev:fwd*a.def.spd,2.2,dt);
a.yaw-=turn*a.def.turn*dt*(fwd<0?-1:1)*clamp(Math.abs(a.vel)/2.5,0.15,1);
p.pos.copy(a.pos);
p.vel.set(0,0,0);
updateInteractHint();
}
// 玩家乘客: 坐在车斗里, 可正常使用手中武器射击
function updatePlayerApcPassenger(dt){
const p=player, a=p.onVehicle;
if(!a||!a.alive){ p.onVehicle=null; p.playerSeat=-1; return; }
a.seatWorld(p.playerSeat,p.pos);
p.vel.set(a.vel*Math.sin(a.yaw),0,a.vel*Math.cos(a.yaw));
p.onGround=true;
p.fireT-=dt;
p.bloom=Math.max(0,p.bloom-dt*1.6);
const w=p.curW;
if(mouseDown&&w&&VM.state==='idle'&&p.fireT<=0&&!matchOver){
if(w.mag>0){
if(w.def.type==='auto'||!p.fireHeld){
playerShoot(w);
p.fireHeld=true;
// 车上射击额外散布
p.bloom=Math.min(1,p.bloom+0.15);
}
} else if(!p.fireHeld){ tryReload(); p.fireHeld=true; }
}
if(!mouseDown) p.fireHeld=false;
updateInteractHint();
}
