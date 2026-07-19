'use strict';
class Bot {
constructor(team,cls,name){
this.team=team; this.name=name;
this.isPlayer=false;
this.pos=V3(); this.vel=V3();
this.yaw=0; this.pitch=0; this.visYaw=0;
this.hp=100; this.alive=false; this.crouch=false;
this.mesh=buildSoldierMesh(team,name);
this.gun=null; this.gunKind=null;
this.setClass(cls);
this.state='idle';
this.path=null; this.pathI=0; this.repathT=0;
this.objective=null; this.defendPt=null;
this.target=null; this.lastSeenPos=V3(); this.lastSeenT=-99;
this.aimSettle=0; this.reactT=0;
this.reloadT=0; this.boltT=0;
this.fireT=0; this.burstLeft=0; this.burstPause=0;
this.nadeCd=rand(4,10); this.nadeAnimT=0; this.pendingNade=null;
this.suppression=0; this.coverPt=null; this.coverT=0; this.peekT=0;
this.smokeCd=rand(18,28);
this.prone=false; this.flinchT=0;
this.aimErrX=0; this.aimErrY=0; this.wanderSeed=rand(0,9);
this.strafeDir=1; this.strafeT=0;
this.decisionT=rand(0,0.4); this.perceptT=rand(0,0.15);
this.tickSkip=0; this.tickAcc=0;
this.kills=0; this.deaths=0; this.score=0;
this.respawnT=0; this.deathAnimT=0;
this.stuckT=0; this.lastPos=V3(); this.moveIntent=false;
this.unstickT=0; this.unstickDir=1;
this.empUse=null; this.empT=0;
this.lastFiredT=-99; this.animT=rand(0,9);
this.mgUse=null; this.mgT=0;
this.mortUse=null; this.mortT=0;
this.meleeT=0;
this.onVehicle=null; this.targetVeh=null; this.chuting=false;
this.pilotOf=null;
this.bandageT=0; this.medkitT=0;
this.speedMul=rand(0.92,1.08);
combatants.push(this); soldiers.push(this);
}
setClass(cls){
this.cls=cls;
const wset=TEAM_FACTION[this.team].cls[cls];
this.wpnKey=wset[0];
this.def=WPN_DEFS[this.wpnKey];
this.slots=wset.map(k=>({key:k,def:WPN_DEFS[k],mag:WPN_DEFS[k].mag,reserve:WPN_DEFS[k].reserve}));
this.mag=this.def.mag;
this.pMag=this.slots[1]?this.slots[1].def.mag:0;
this.pReloadT=0;
this.nades=CLASSES[cls].nades;
this.smokes=CLASSES[cls].smoke||0;
this.atn=cls===2?2:(cls===5?(TEAM_FACTION[this.team].atn5||3):0);
this.maxBandages=cls===4?6:2;
this.bandages=this.maxBandages;
const kind=gunKindOf(this.wpnKey);
if(kind!==this.gunKind||this.wgKey!==this.wpnKey){
if(this.gun) this.mesh.gunG.remove(this.gun);
this.gunKind=kind; this.wgKey=this.wpnKey;
this.gun=worldGunModel(kind,this.team,this.wpnKey);
this.mesh.gunG.add(this.gun);
// 枪口朝向角色正前方(+z), 枪托收在肩前
this.gun.position.set(0,-0.02,kind==='launcher'?0.2:kind==='atr'?0.24:0.3);
this.gun.rotation.order='YXZ';
this.gun.rotation.y=Math.PI;
}
}
spawn(){
// 布娃娃系统会"接管"尸体模型部件, 因此重生时需要重建全新模型
if(!this.mesh){
this.mesh=buildSoldierMesh(this.team,this.name);
if(this.inSquad) this.mesh.tag.material.color.set(0x86ffa6);
}
this.setClass(CLS_POOL[randi(0,CLS_POOL.length-1)]);
const sp=pickSpawnFor(this.team);
const fp=findFreeSpawn(sp.x,sp.z);
this.pos.set(fp[0], 0, fp[1]);
this.pos.y=standHeight(this.pos.x,this.pos.z,10);
this.hp=100; this.alive=true; this.crouch=false; this.prone=false;
this.ragdolled=false;
this.mag=this.def.mag; this.reloadT=0; this.suppression=0;
this.target=null; this.lastSeenT=-99; this.path=null;
this.state='idle'; this.mgUse=null; this.empUse=null; this.mortUse=null; this.unstickT=0;
this.onVehicle=null; this.targetVeh=null; this.chuting=false;
this.bandageT=0;
this.mesh.root.visible=true;
this.mesh.root.rotation.set(0,0,0);
this.mesh.pelvis.position.y=0.94;
this.pickObjective();
}
spawnInVehicle(v){
// 布娃娃系统会接管尸体模型, 复活进载具时同样需要重建模型
if(!this.mesh){
this.mesh=buildSoldierMesh(this.team,this.name);
if(this.inSquad) this.mesh.tag.material.color.set(0x86ffa6);
this.setClass(this.cls);
}
this.hp=100; this.alive=true; this.crouch=false; this.prone=false;
this.ragdolled=false;
this.mag=this.def.mag; this.reloadT=0; this.suppression=0;
this.target=null; this.lastSeenT=-99; this.path=null;
this.state='idle'; this.mgUse=null; this.empUse=null; this.mortUse=null; this.unstickT=0;
this.chuting=false; this.bandageT=0; this.deathDir=0;
this.respawnT=0;
if(this.mesh){
this.mesh.root.visible=false;
this.mesh.root.rotation.set(0,0,0);
this.mesh.pelvis.position.y=0.94;
}
this.onVehicle=v; v.crewBot=this;
this.pos.copy(v.pos);
}
enterVehicle(v){
if(v.crewBot||v.playerDriven) return;
v.crewBot=this; v.claimBot=null;
this.onVehicle=v;
this.targetVeh=null; this.path=null;
this.state='idle';
this.crouch=false; this.prone=false; this.bandageT=0;
if(this.mgUse){ this.mgUse.user=null; this.mgUse=null; }
if(this.empUse){ this.empUse.user=null; this.empUse=null; }
if(this.mortUse){ this.mortUse.user=null; this.mortUse=null; }
if(this.mesh) this.mesh.root.visible=false;
}
dismountVehicle(bailing){
const v=this.onVehicle;
this.onVehicle=null; this.chuting=false;
if(v){
if(v.crewBot===this) v.crewBot=null;
v.noEnterT=nowT+(bailing?12:6);
let px=v.pos.x+3.2, pz=v.pos.z;
for(const off of [[3.2,0],[-3.2,0],[0,4],[0,-4],[4,4]]){
const qx=v.pos.x+off[0], qz=v.pos.z+off[1];
if(!occBlocked(qx,qz)){ px=qx; pz=qz; break; }
}
this.pos.set(px,0,pz);
this.pos.y=standHeight(px,pz,v.pos.y+2);
}
if(this.mesh) this.mesh.root.visible=true;
this.path=null; this.state='idle'; this.decisionT=0; this.targetVeh=null;
if(bailing){ this.suppression=0.9; }
}
eyePos(){
const off=(this.leanT||0)*0.32;
return V3(this.pos.x+Math.cos(this.yaw)*off,this.pos.y+(this.prone?0.5:this.crouch?1.15:1.62),this.pos.z-Math.sin(this.yaw)*off);
}
noticeThreat(enemy){
if(!enemy||!enemy.alive) return;
if(!this.target||nowT-this.lastSeenT>2.5){
this.lastSeenPos.copy(enemy.pos);
if(nowT-this.lastSeenT>4) this.lastSeenT=nowT-2.8;
}
}
damage(amt,attacker,isHead){
if(!this.alive) return;
this.hp-=amt;
this.lastDmgT=nowT;
this.suppression=Math.min(1.6,this.suppression+0.45);
this.aimSettle=Math.max(0.1,this.aimSettle-0.4);
if(attacker&&attacker.team!==this.team){
this.noticeThreat(attacker);
if(!this.target&&!attacker.isCrew&&!attacker.onVehicle&&Math.random()<0.8){
this.target=attacker;
this.lastSeenPos.copy(attacker.pos);
this.lastSeenT=nowT-1.2;
this.reactT=DIFF_TABLE[SETTINGS.diff].react*rand(0.5,1);
}
}
if(this.hp<=0) this.die(attacker,isHead);
}
die(attacker,isHead){
this.alive=false; this.deaths++;
this.deathAnimT=0.6;
this.respawnT=rand(7,11);
this.bandageT=0; this.chuting=false;
noteDeath(this.pos.x,this.pos.z);
// 布娃娃尸体: 直接接管本体模型部件, 从当前姿态开始物理模拟
this.ragdolled=window.CANNON?spawnRagdoll(this,attacker,isHead):false;
if(this.ragdolled){
// 残余空壳(名牌等)移除, 重生时重建
if(this.mesh){
if(this.mesh.tag){
if(this.mesh.tag.material.map) this.mesh.tag.material.map.dispose();
this.mesh.tag.material.dispose();
}
scene.remove(this.mesh.root);
this.mesh=null;
}
} else if(this.mesh) this.mesh.root.visible=false;
if(this.targetVeh){ if(this.targetVeh.claimBot===this) this.targetVeh.claimBot=null; this.targetVeh=null; }
if(this.onVehicle){ if(this.onVehicle.crewBot===this) this.onVehicle.crewBot=null; this.onVehicle=null; }
if(this.mgUse){ this.mgUse.user=null; this.mgUse=null; }
if(this.empUse){ this.empUse.user=null; this.empUse=null; }
if(this.mortUse){ this.mortUse.user=null; this.mortUse=null; }
tickets[this.team]=Math.max(0,tickets[this.team]-1);
if(attacker){
attacker.kills=(attacker.kills||0)+1;
attacker.score=(attacker.score||0)+100;
addKillfeed(attacker,this,isHead);
if(attacker.isPlayer){ onPlayerKill(this,isHead); }
}
if(this.pos.distanceTo(camera.position)<30&&Math.random()<0.5) AudioSys.hurt();
}
pickObjective(){
// 攻防模式: 双方都围绕当前目标点作战
if(GAMEMODE==='assault'){
this.objective=FLAGS[Math.min(assaultIdx,FLAGS.length-1)];
this.defendPt=null;
this.repathT=Math.min(this.repathT,0.5);
return;
}
// 破袭模式: 进攻方扑向最近未毁补给库, 防守方前往驻守
if(GAMEMODE==='demolition'){
const d=nearestDepot(this.pos.x,this.pos.z);
this.objective=d?{id:d.id,x:d.x,z:d.z,r:14,owner:this.team===ATK?DEF:this.team,cap:0,capTeam:-1,gy:heightAt(d.x,d.z)}:FLAGS[0];
this.defendPt=null;
this.repathT=Math.min(this.repathT,0.5);
return;
}
let best=null,bestScore=-1e9;
for(const f of FLAGS){
let sc=0;
const d=Math.hypot(this.pos.x-f.x,this.pos.z-f.z);
sc-=d*0.6;
if(f.owner!==this.team) sc+=90;
if(f.owner===this.team&&f.capTeam!==-1&&f.capTeam!==this.team) sc+=140;
if(f.capTeam===this.team&&f.cap>0.05&&d<55) sc+=130;
let cnt=0;
for(const s of soldiers) if(s.alive&&s.team===this.team&&s.objective===f) cnt++;
sc-=cnt*26;
sc+=rand(0,30);
if(sc>bestScore){ bestScore=sc; best=f; }
}
this.objective=best;
this.defendPt=null;
this.repathT=0;
}
perceive(){
const diff=DIFF_TABLE[SETTINGS.diff];
const viewD=95*diff.visMul;
let best=null,bestD=1e9;
const eye=this.eyePos();
for(const e of combatants){
if(!e.alive||e.team===this.team) continue;
// 载具内目标: 运兵车车斗乘员是暴露的可以被看到; 封闭车厢(canvas盖)只在尾部扇区可见
if(e.onVehicle){
if(e.onVehicle.kind!=='apc') continue;
const av=e.onVehicle;
if(av.def.enclosed){
const rearA=av.yaw+Math.PI;
const angTo=Math.atan2(this.pos.x-av.pos.x,this.pos.z-av.pos.z);
if(Math.abs(angDiff(rearA,angTo))>0.95) continue; // 帆布遮挡, 视为不可见
}
}
const dx=e.pos.x-this.pos.x, dz=e.pos.z-this.pos.z;
const d=Math.hypot(dx,dz);
if(d>viewD) continue;
const ang=Math.atan2(dx,dz);
const isCur=(e===this.target&&nowT-this.lastSeenT<3);
if(!isCur&&Math.abs(angDiff(this.yaw,ang))>1.15) continue;
const heard=d<9||(e.lastFiredT&&nowT-e.lastFiredT<1.5&&d<70);
if(!isCur&&!heard&&d>viewD*0.85&&e.crouch) continue;
const tp=V3(e.pos.x,e.pos.y+(e.crouch?1.0:1.4),e.pos.z);
const dir=tp.clone().sub(eye); const dist=dir.length(); dir.normalize();
const blockHit=raycastWorld(eye,dir,dist);
if(blockHit&&blockHit.dist<dist-0.6) continue;
// 烟雾遮蔽: bot 无法看穿烟墙
if(SMOKES.length&&smokeBlocksLOS(eye.x,eye.y,eye.z,tp.x,tp.y,tp.z)) continue;
if(d<bestD){ best=e; bestD=d; }
}
// 坦克裸露乘员(敞篷全员/探头车长): 一并纳入目标感知
if(typeof TANK_CREW_PROXIES!=='undefined'){
for(const e of TANK_CREW_PROXIES){
if(!e.alive||e.team===this.team) continue;
const dx=e.pos.x-this.pos.x, dz=e.pos.z-this.pos.z;
const d=Math.hypot(dx,dz);
if(d>viewD) continue;
const ang=Math.atan2(dx,dz);
const isCur=(e===this.target&&nowT-this.lastSeenT<3);
if(!isCur&&Math.abs(angDiff(this.yaw,ang))>1.15) continue;
const tp=V3(e.pos.x,e.pos.y+1.3,e.pos.z);
const dir=tp.clone().sub(eye); const dist=dir.length(); dir.normalize();
const blockHit=raycastWorld(eye,dir,dist);
if(blockHit&&blockHit.dist<dist-0.6) continue;
if(SMOKES.length&&smokeBlocksLOS(eye.x,eye.y,eye.z,tp.x,tp.y,tp.z)) continue;
// 稍微优先打乘员(压制载具)
const dEff=d*0.85;
if(dEff<bestD){ best=e; bestD=dEff; }
}
}
if(best){
if(this.target!==best||nowT-this.lastSeenT>2){
if(this.target!==best){
this.reactT=DIFF_TABLE[SETTINGS.diff].react*rand(0.7,1.4);
// 拟人"甩枪": 换目标瞬间带初始偏差, 随后收敛
this.aimErrX=rand(-1,1)*0.055*DIFF_TABLE[SETTINGS.diff].spreadMul;
this.aimErrY=rand(-0.6,0.6)*0.04*DIFF_TABLE[SETTINGS.diff].spreadMul;
}
this.target=best;
}
this.lastSeenPos.copy(best.pos);
this.lastSeenT=nowT;
this.aimSettle=Math.min(1,this.aimSettle+0.16);
} else {
this.aimSettle=Math.max(0.2,this.aimSettle-0.1);
if(this.target&&(!this.target.alive||nowT-this.lastSeenT>8)) this.target=null;
}
if(!this.target){
for(const ev of gunEvents){
if(ev.team===this.team) continue;
const d=Math.hypot(ev.x-this.pos.x,ev.z-this.pos.z);
if(d<65&&nowT-ev.t<0.4&&ev.shooter&&ev.shooter.alive){
this.lastSeenPos.set(ev.x,0,ev.z);
if(nowT-this.lastSeenT>4) this.lastSeenT=nowT-3.5;
}
}
}
}
decide(){
const engaged=this.target&&nowT-this.lastSeenT<4;
const distT=engaged?Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z):0;
if(this.empUse){
const g=this.empUse;
let done=false;
if(g.kind==='at'){ const t=enemyTankNear(this,150); if(!t) done=true; }
else { if(!enemyPlaneAlive(this.team)) done=true; }
this.empT-=0.5;
if(done||this.empT<=0||(engaged&&distT<8)){ g.user=null; this.empUse=null; }
else return;
}
if(this.mgUse){
this.mgT-=0.5;
const stillThreat=engaged&&distT>6&&Math.abs(angDiff(this.mgUse.face+Math.PI,Math.atan2(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z)))<1.0;
if(this.mgT<=0||(engaged&&distT<7)||(!stillThreat&&this.mgT<12)){ this.mgUse.user=null; this.mgUse=null; }
else return;
}
// 小队指令: 最高优先级, 只有敌人近身(20m内)才暂缓执行
if(this.inSquad&&!(engaged&&distT<20)){
if(SQUAD.mode==='move'){
const d=Math.hypot(SQUAD.pos.x-this.pos.x,SQUAD.pos.z-this.pos.z);
if(d>7){
this.state='advance';
if(!this.path||this.repathT<=0){ this.setPathTo(SQUAD.pos.x+rand(-4,4),SQUAD.pos.z+rand(-4,4)); this.repathT=rand(2,3); }
return;
}
if(!engaged){
this.state='defend';
if(Math.random()<0.12) this.setPathTo(SQUAD.pos.x+rand(-5,5),SQUAD.pos.z+rand(-5,5));
return;
}
}
else if(SQUAD.mode==='follow'&&player.alive&&!player.onVehicle){
const d=Math.hypot(player.pos.x-this.pos.x,player.pos.z-this.pos.z);
if(d>10){
this.state='advance';
if(!this.path||this.repathT<=0){ this.setPathTo(player.pos.x+rand(-3,3),player.pos.z+rand(-3,3)); this.repathT=rand(1.2,2); }
return;
}
if(!engaged){
this.state='defend';
this.crouch=player.crouch&&d<6;
return;
}
}
}
const eTank=enemyTankNear(this,120);
// 筒子自动打坦克
if(this.cls===5&&eTank&&eTank.alive&&this.slots&&this.slots[0]&&this.slots[0].def.rocket){
const w2=this.slots[0];
if(w2.mag>0&&this.fireT<=0&&this.reloadT<=0&&Math.hypot(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z)<65){
const eye2=this.eyePos();
const dir2=V3(eTank.pos.x-eye2.x,eTank.pos.y+1.2-eye2.y,eTank.pos.z-eye2.z).normalize();
const chk=raycastWorld(eye2,dir2,65);
if(!chk||chk.dist>50){
this.lastFiredT=nowT;
fireRocket(this,eye2,dir2,w2.def,V3(eTank.pos.x,eTank.pos.y,eTank.pos.z));
w2.mag=0; this.mag=0; this.fireT=3.6;
}}}
// 反坦克枪手打坦克 (PTRD/博伊斯/九七式自动炮)
if(this.cls===5&&eTank&&eTank.alive&&this.def.atRifle&&this.mag>0&&this.fireT<=0&&this.reloadT<=0&&this.boltT<=0){
const dTk=Math.hypot(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z);
if(dTk<95){
const eye2=this.eyePos();
const dir2=V3(eTank.pos.x-eye2.x,eTank.pos.y+1.3-eye2.y,eTank.pos.z-eye2.z).normalize();
const chk=raycastWorld(eye2,dir2,dTk);
if(!chk||chk.dist>dTk-3){
this.yaw=Math.atan2(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z);
const er2=0.012*DIFF_TABLE[SETTINGS.diff].spreadMul;
dir2.x+=rand(-er2,er2); dir2.y+=rand(-er2,er2)*0.5; dir2.z+=rand(-er2,er2); dir2.normalize();
const muzz=eye2.clone().addScaledVector(dir2,0.9);
fireBullet(this,eye2,dir2,this.def,muzz);
this.mag--;
if(this.mesh) this.mesh.armR.sh.userData.swing=0.15;
this.fireT=60/this.def.rpm*rand(1.2,1.8);
if(this.def.type==='bolt') this.boltT=this.def.boltT||1.2;
if(this.mag<=0) this.reloadT=this.def.reload;
this.prone=dTk>30;
}
}
}

if(eTank){
const dTank=Math.hypot(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z);
if(this.atn>0&&this.nadeCd<=0&&dTank<26){
this.state='atnade'; this.nadeAnimT=0.8; this.atTankTarget=eTank;
return;
}
if(dTank<130){
for(const g of ATGUNS){
if(g.user) continue;
if(Math.hypot(g.x-this.pos.x,g.z-this.pos.z)<16){
const angToTank=Math.atan2(eTank.pos.x-g.x,eTank.pos.z-g.z);
if(Math.abs(angDiff(g.face,angToTank))<1.05){
this.empUse=g; g.user=this; this.empT=rand(18,30);
this.pos.x=g.x-Math.sin(g.face)*1.2;
this.pos.z=g.z-Math.cos(g.face)*1.2;
this.path=null;
return;
}
}
}
}
if(this.cls===2&&this.atn>0&&dTank<55&&!engaged){
this.state='hunt';
if(!this.path||this.repathT<=0){
this.setPathTo(eTank.pos.x+rand(-8,8),eTank.pos.z+rand(-8,8));
this.repathT=2.5;
}
return;
}
if(dTank<32&&this.cls!==2&&this.state!=='cover'&&Math.random()<0.5){
const cp=this.findCoverFrom(eTank.pos);
if(cp){ this.state='cover'; this.coverPt=cp; this.coverT=rand(2.5,5); this.setPathTo(cp.x,cp.z); return; }
}
}
const ePlane=enemyPlaneAlive(this.team);
if(ePlane&&!engaged&&!this.inSquad&&Math.random()<0.4){
for(const g of AAGUNS){
if(g.user) continue;
if(Math.hypot(g.x-this.pos.x,g.z-this.pos.z)<15){
this.empUse=g; g.user=this; this.empT=rand(14,24);
this.pos.x=g.x; this.pos.z=g.z-0.9;
this.path=null;
return;
}
}
}
if(engaged){
if(distT<2.6){ this.state='melee'; return; }
// 受压制时丢烟雾遮蔽后撤
if(this.smokes>0&&this.smokeCd<=0&&this.suppression>1.0&&Math.random()<0.55){
const eye=this.eyePos();
const dir=V3(this.lastSeenPos.x-this.pos.x,0,this.lastSeenPos.z-this.pos.z).normalize();
throwNade(this,eye,dir.multiplyScalar(7).add(V3(0,3,0)),1.6,false,true);
this.smokes--; this.smokeCd=rand(20,32);
if(this.mesh) this.mesh.armR.sh.userData.swing=0.4;
}
if((this.reloadT>0.3||this.suppression>1.0||this.hp<32)&&Math.random()<0.75){
if(this.state!=='cover'||!this.coverPt){
const cp=this.findCover();
if(cp){ this.state='cover'; this.coverPt=cp; this.coverT=rand(1.2,2.6)+(this.reloadT>0?this.def.reload:0); this.setPathTo(cp.x,cp.z); return; }
} else return;
}
if(this.nades>0&&this.nadeCd<=0&&distT>9&&distT<30){
const hidden=nowT-this.lastSeenT>1.2;
let cluster=0;
for(const e of combatants) if(e.alive&&e.team!==this.team&&e.pos.distanceTo(this.target.pos)<7) cluster++;
if((hidden&&Math.random()<0.5)||(cluster>=2&&Math.random()<0.4)){
this.state='nade'; this.nadeAnimT=0.8;
return;
}
}
this.state='combat';
if(distT>34){ this.combatMove=(this.cls===3||Math.random()<0.28)?'prone':(Math.random()<0.5?'crouch':'stand'); }
else if(distT<14){ this.combatMove=Math.random()<0.6?'strafe':'stand'; }
else if(this.suppression>1.0&&Math.random()<0.55){ this.combatMove='prone'; }
else { this.combatMove=['stand','crouch','strafe'][randi(0,2)]; }
this.strafeT=rand(0.5,1.3); this.strafeDir=Math.random()<0.5?1:-1;
return;
}
if(this.target&&nowT-this.lastSeenT<9){
this.state='hunt';
if(!this.path||this.repathT<=0){ this.setPathTo(this.lastSeenPos.x+rand(-3,3),this.lastSeenPos.z+rand(-3,3)); this.repathT=3; }
return;
}
this.target=null;
// 脱战后打绷带
if(this.hp<=60&&this.bandages>0&&this.bandageT<=0&&nowT-this.lastSeenT>4){
this.bandageT=2.6; this.path=null;
return;
}
// 破袭: 进攻方接近补给库时用手雷炸毁
if(GAMEMODE==='demolition'&&this.team===ATK){
const dp=nearestDepot(this.pos.x,this.pos.z);
if(dp&&this.nades>0&&this.nadeCd<=0){
const dd=Math.hypot(dp.x-this.pos.x,dp.z-this.pos.z);
if(dd<26){
this.state='nade'; this.nadeAnimT=0.8;
this.lastSeenPos.set(dp.x,0,dp.z);
return;
}
}
}
// 附近有空载具时上车 (专属飞行员除外; 小队成员只上玩家的车)
// 规则1: 玩家所在运兵车有空位且距离较近 → 小队成员优先上车, 其余步兵就近搭车
if(!this.pilotOf&&player.alive&&player.onVehicle&&player.onVehicle.kind==='apc'&&this.team===player.team){
const pv=player.onVehicle;
const dv=Math.hypot(pv.pos.x-this.pos.x,pv.pos.z-this.pos.z);
const near=this.inSquad?40:16;
if(pv.alive&&pv.freeSeat()>=0&&dv<near&&Math.abs(pv.vel)<3){
this.targetVeh=pv;
this.state='toVehicle';
if(!this.path||this.repathT<=0){ this.setPathTo(pv.pos.x,pv.pos.z); this.repathT=1.6; }
return;
}
}
if(!this.pilotOf&&!this.inSquad){
for(const tv of tanks){
if(!tv.alive||tv.team!==this.team||tv.crewBot||tv.playerDriven) continue;
if((tv.noEnterT||0)>nowT) continue;
if(tv.hp<tv.maxHp*0.4) continue;
if(tv.claimBot&&tv.claimBot.alive&&tv.claimBot!==this&&tv.claimBot.targetVeh===tv&&nowT-(tv.claimT||0)<8) continue;
const dv=Math.hypot(tv.pos.x-this.pos.x,tv.pos.z-this.pos.z);
if(dv<85){
tv.claimBot=this;
tv.claimT=nowT;
this.targetVeh=tv;
this.state='toVehicle';
if(!this.path||this.repathT<=0){ this.setPathTo(tv.pos.x,tv.pos.z); this.repathT=2.2; }
return;
}
}
// 规则2: 无司机的运兵车 → 开车; 有司机有空位且目标很远 → 搭车
for(const av of apcs){
if(!av.alive||av.team!==this.team||av.playerDriven) continue;
if((av.noEnterT||0)>nowT) continue;
const dv=Math.hypot(av.pos.x-this.pos.x,av.pos.z-this.pos.z);
if(dv>60) continue;
if(!av.crewBot){
if(av.claimBot&&av.claimBot.alive&&av.claimBot!==this&&nowT-(av.claimT||0)<8) continue;
av.claimBot=this; av.claimT=nowT;
this.targetVeh=av;
this.state='toVehicle';
if(!this.path||this.repathT<=0){ this.setPathTo(av.pos.x,av.pos.z); this.repathT=2.2; }
return;
} else if(av.freeSeat()>=0&&((av.mission==='pickup'&&Math.abs(av.vel)<1.5&&dv<42&&this.objective&&Math.hypot(this.objective.x-this.pos.x,this.objective.z-this.pos.z)>50)||(this.objective&&Math.hypot(this.objective.x-this.pos.x,this.objective.z-this.pos.z)>80&&dv<22&&Math.abs(av.vel)<3))){
this.targetVeh=av;
this.state='toVehicle';
if(!this.path||this.repathT<=0){ this.setPathTo(av.pos.x,av.pos.z); this.repathT=1.6; }
return;
}
}
}
// 医护兵放置医疗箱
if(this.cls===4&&(this.medkitT||0)<=nowT){
let allies=0;
for(const s of soldiers){
if(s!==this&&s.alive&&s.team===this.team&&!s.onVehicle&&Math.hypot(s.pos.x-this.pos.x,s.pos.z-this.pos.z)<14) allies++;
}
let hasOwn=false;
for(const c of MED_CRATES){ if(c.owner===this){ hasOwn=true; break; } }
if(allies>=1&&!hasOwn){
placeMedkit(this,this.pos.x+Math.sin(this.yaw)*0.9,this.pos.z+Math.cos(this.yaw)*0.9);
this.medkitT=nowT+35;
}
}
if(!this.objective||Math.random()<0.06) this.pickObjective();
const f=this.objective;
const dObj=Math.hypot(this.pos.x-f.x,this.pos.z-f.z);
if(dObj<f.r*0.85){
this.state='defend';
// 迫击炮兵: 防守时架设迫击炮 (炮口朝敌方基地)
if(this.cls===6&&!this.mortarPlaced&&!this.mortUse&&!this.mgUse&&!this.empUse&&Math.random()<0.35){
const eb=BASES[1-this.team];
const dyaw=Math.atan2(eb.x-this.pos.x,eb.z-this.pos.z);
if(deployMortar(this,this.pos.x+Math.sin(dyaw)*1.3,this.pos.z+Math.cos(dyaw)*1.3,dyaw)){
this.decisionT=rand(0.5,1);
}
}
// 空闲迫击炮: 防守Bot就近上炮 (迫击炮兵优先)
if(!this.mortUse&&!this.mgUse&&!this.empUse&&Math.random()<(this.cls===6?0.5:0.12)){
for(const mo of MORTARS){
if(!mo.alive||mo.user) continue;
if(Math.hypot(mo.x-this.pos.x,mo.z-this.pos.z)<(this.cls===6?18:11)){
this.mortUse=mo; mo.user=this; this.mortT=rand(14,24);
this.pos.x=mo.x-Math.sin(mo.face)*0.8;
this.pos.z=mo.z-Math.cos(mo.face)*0.8;
this.path=null;
return;
}
}
}
if(!this.mgUse&&Math.random()<0.25){
for(const mg of MG42S){
if(mg.user) continue;
if(Math.hypot(mg.x-this.pos.x,mg.z-this.pos.z)<14){
this.mgUse=mg; mg.user=this; this.mgT=rand(14,24);
this.pos.x=mg.x-Math.sin(mg.face)*0.8;
this.pos.z=mg.z-Math.cos(mg.face)*0.8;
this.path=null;
return;
}
}
}
if(!this.defendPt||Math.random()<0.3){
let best=null,bd=1e9;
for(const cp of coverPoints){
const d=Math.hypot(cp.x-f.x,cp.z-f.z);
if(d<f.r*1.3){
const dd=d+rand(0,14);
if(dd<bd){ bd=dd; best=cp; }
}
}
this.defendPt=best||{x:f.x+rand(-6,6),z:f.z+rand(-6,6)};
this.setPathTo(this.defendPt.x,this.defendPt.z);
}
} else {
this.state='advance';
if(!this.path||this.repathT<=0){
this.setPathTo(f.x+rand(-6,6),f.z+rand(-6,6));
this.repathT=rand(4,7);
}
}
}
findCover(){
const threat=this.target?this.target.pos:this.lastSeenPos;
return this.findCoverFrom(threat);
}
findCoverFrom(threat){
let best=null,bd=1e9;
for(const cp of coverPoints){
const d=Math.hypot(cp.x-this.pos.x,cp.z-this.pos.z);
if(d>26) continue;
const dir=V3(cp.x-threat.x,1.15,cp.z-threat.z);
const dist=Math.hypot(dir.x,dir.z);
const org=V3(threat.x,heightAt(threat.x,threat.z)+1.5,threat.z);
dir.y=(heightAt(cp.x,cp.z)+0.9)-org.y; dir.normalize();
const hit=raycastWorld(org,dir,dist);
if(!hit||hit.dist>dist-0.8) continue;
const sc=d-rand(0,6);
if(sc<bd){ bd=sc; best=cp; }
}
return best;
}
setPathTo(x,z){
if(NAV.budget<=0){ this.repathT=Math.min(this.repathT>0?this.repathT:0.3,0.3); return; }
NAV.budget--;
this.path=NAV.findPath(this.pos.x,this.pos.z,x,z);
this.pathI=0;
this.moveIntent=!!this.path;
}
update(dt){
if(!this.alive){
this.deathAnimT-=dt;
if(!this.ragdolled&&this.mesh){
const k=clamp(1-Math.max(this.deathAnimT,0)/0.6,0,1);
if(k<=1){
if(!this.deathDir) this.deathDir=Math.random()<0.5?1:-1;
this.mesh.root.rotation.x=-HPI*k*this.deathDir;
this.mesh.pelvis.position.y=lerp(0.94,0.2,k);
this.mesh.tag.visible=false;
}
}
this.respawnT-=dt;
if(this.respawnT<2.5&&this.mesh&&this.mesh.root.visible) this.mesh.root.visible=false;
if(this.respawnT<=0&&!matchOver){
if(this.pilotOf){ /* 专属飞行员: 等待战机复活后随机载入 */ }
else { this.deathDir=0; this.spawn(); }
}
return;
}
// 乘员: 藏在载具里, 位置同步; 运兵车乘客: 坐车斗内, 可探身射击
if(this.onVehicle){
const v=this.onVehicle;
const isPass=v.kind==='apc'&&v.passengers&&v.passengers.includes(this);
if(!v.alive||(!isPass&&v.crewBot!==this)){ this.onVehicle=null; if(this.mesh) this.mesh.root.visible=true; }
else if(isPass){
v.seatWorld(this.seatIdx,this.pos);
this.vel.set(0,0,0);
this.suppression=Math.max(0,this.suppression-dt*0.4);
// 到达目标附近时自行跳车
if(this.objective&&Math.hypot(this.objective.x-this.pos.x,this.objective.z-this.pos.z)<24&&Math.abs(v.vel)<4){
v.removePassenger(this,false);
return;
}
// 车斗射击: 感知照常(敞开车斗), 封闭车厢只有尾部视野
this.perceptT-=dt;
if(this.perceptT<=0){ this.perceptT=0.35; this.perceive(); }
this.fireT-=dt; this.reloadT-=dt; this.boltT-=dt;
if(this.mag<=0&&this.reloadT<=-0.5){ this.reloadT=this.def.reload; }
if(this.reloadT>0&&this.mag<=0){ if(this.reloadT<dt*2) this.mag=this.def.mag; }
if(this.target&&this.target.alive&&nowT-this.lastSeenT<2.2&&this.mag>0){
const dx=this.target.pos.x-this.pos.x,dz=this.target.pos.z-this.pos.z;
this.yaw=Math.atan2(dx,dz);
const dh=Math.hypot(dx,dz);
this.pitch=clamp(Math.atan2((this.target.pos.y+1.1)-(this.pos.y+1.45),Math.max(dh,2)),-0.5,0.5);
if(this.fireT<=0&&this.reloadT<=0&&this.boltT<=0){
this.aimSettle=Math.min(this.aimSettle+dt*2,1.1);
this.shootAt(this.target,null);
}
}
this.updateMeshSeated(dt,v);
return;
}
else {
this.pos.copy(v.pos); this.vel.set(0,0,0);
this.suppression=Math.max(0,this.suppression-dt*0.5);
this.target=null;
return;
}
}
// 跳伞下落 (bot)
if(this.chuting){
this.vel.set(0,0,0);
this.pos.y-=7*dt;
if(!this.chuteMesh&&this.mesh){ this.chuteMesh=mkChuteForBot(); this.mesh.root.add(this.chuteMesh); this.chuteMesh.position.set(0,2.5,0); }
const gh=standHeight(this.pos.x,this.pos.z,this.pos.y);
if(this.pos.y<=gh){
this.pos.y=gh; this.chuting=false; this.decisionT=0;
if(this.chuteMesh){ if(this.mesh) this.mesh.root.remove(this.chuteMesh); this.chuteMesh=null; }
}
this.updateMesh(dt,0);
return;
}
// 包扎中
if(this.bandageT>0&&!this.mgUse&&!this.empUse){
this.bandageT-=dt;
this.vel.set(0,0,0);
this.crouch=true;
if(this.bandageT<=0){
this.bandages=Math.max(0,this.bandages-1);
this.hp=Math.min(100,this.hp+45);
this.crouch=false;
}
this.updateMesh(dt,0);
return;
}
this.perceptT-=dt;
if(this.perceptT<=0){ this.perceptT=0.16; this.perceive(); }
// 分心去做别的事时释放坦克占用, 避免空车被永久锁定
if(this.targetVeh&&this.state!=='toVehicle'){ if(this.targetVeh.claimBot===this) this.targetVeh.claimBot=null; this.targetVeh=null; }
this.decisionT-=dt;
if(this.decisionT<=0&&!(this.state==='nade'&&this.nadeAnimT>0)){ this.decisionT=rand(0.35,0.6); this.decide(); }
this.suppression=Math.max(0,this.suppression-dt*0.35);
this.nadeCd-=dt; this.repathT-=dt; this.reactT-=dt;
this.smokeCd-=dt;
// 甩枪偏差随时间收敛(命中修正)
this.aimErrX*=Math.pow(0.18,dt); this.aimErrY*=Math.pow(0.18,dt);
if(this.reloadT>0){
this.reloadT-=dt;
if(this.reloadT<=0){
this.mag=this.def.mag;
if(this.slots&&this.slots[0]) this.slots[0].mag=this.slots[0].def.mag;
}
}
if(this.pReloadT>0){
this.pReloadT-=dt;
if(this.pReloadT<=0&&this.slots[1]) this.pMag=this.slots[1].def.mag;
}
if(this.boltT>0) this.boltT-=dt;
if(this.fireT>0) this.fireT-=dt;
if(this.burstPause>0) this.burstPause-=dt;
if(this.target&&this.target.onVehicle) this.target=null;
const engaged=this.target&&this.target.alive&&nowT-this.lastSeenT<4;
if(this.empUse){ this.updateEmplacement(dt); return; }
if(this.mgUse){
const mg=this.mgUse;
this.crouch=false; this.prone=false;
this.vel.set(0,0,0);
this.pos.x=mg.x-Math.sin(mg.face)*0.85;
this.pos.z=mg.z-Math.cos(mg.face)*0.85;
this.pos.y=standHeight(this.pos.x,this.pos.z,this.pos.y+1);
if(engaged){
const tp=this.target.pos;
const wantYaw=Math.atan2(tp.x-mg.x,tp.z-mg.z);
if(Math.abs(angDiff(mg.face,wantYaw))<1.05){
this.yaw=angleLerpTo(this.yaw,wantYaw,4*dt);
mg.yaw.rotation.y=angDiff(mg.face,this.yaw);
const dy=(tp.y+1.2)-(mg.y);
const dh=Math.hypot(tp.x-mg.x,tp.z-mg.z);
mg.pitch.rotation.x=-clamp(Math.atan2(dy,dh),-0.3,0.35);
if(this.reactT<=0&&this.fireT<=0&&mg.heat<1){
const mdef2=mg.def||{rpm:1100,dmg:26,heatPS:0.012};
this.fireT=60/mdef2.rpm;
mg.heat+=mdef2.heatPS;
const eye=V3(mg.x,mg.y+0.1,mg.z);
const dir=V3(tp.x-eye.x,tp.y+1.1+rand(-0.4,0.4)-eye.y,tp.z-eye.z).normalize();
const spread=0.02*(this.suppression+0.7);
dir.x+=rand(-spread,spread); dir.y+=rand(-spread,spread); dir.z+=rand(-spread,spread); dir.normalize();
const muzzle=V3(mg.x+dir.x*1.3,mg.y+0.1+dir.y*1.3,mg.z+dir.z*1.3);
const mgDef={dmg:mdef2.dmg,headMul:1.8,snd:'mg',tracer:2,vehDmg:2.5};
fireBullet(this,eye,dir,mgDef,muzzle);
}
}
}
mg.heat=Math.max(0,mg.heat-dt*0.15);
this.updateMesh(dt,0);
return;
}
if(this.mortUse){
const mo=this.mortUse;
this.mortT-=dt; mo.cd-=dt;
this.crouch=true; this.prone=false;
this.vel.set(0,0,0);
this.pos.x=mo.x-Math.sin(mo.face)*0.85;
this.pos.z=mo.z-Math.cos(mo.face)*0.85;
this.pos.y=standHeight(this.pos.x,this.pos.z,this.pos.y+1);
this.yaw=angleLerpTo(this.yaw,mo.face,4*dt);
if(mo.cd<=0){
// 选target: 已知敌人暴露点 > 敌占/被夺旗点(附近无友军)
let tx=null,tz=null;
if(this.target&&this.target.alive&&nowT-this.lastSeenT<6){
const d=Math.hypot(this.lastSeenPos.x-mo.x,this.lastSeenPos.z-mo.z);
if(d>26&&d<130){ tx=this.lastSeenPos.x; tz=this.lastSeenPos.z; }
}
if(tx===null){
let bd=1e9;
for(const f2 of FLAGS){
if(f2.owner===this.team&&!(f2.capTeam!==-1&&f2.capTeam!==this.team)) continue;
const d=Math.hypot(f2.x-mo.x,f2.z-mo.z);
if(d<26||d>130||d>=bd) continue;
let allyNear=false;
for(const s2 of soldiers){ if(s2.alive&&s2.team===this.team&&Math.hypot(s2.pos.x-f2.x,s2.pos.z-f2.z)<12){ allyNear=true; break; } }
if(allyNear) continue;
bd=d; tx=f2.x; tz=f2.z;
}
}
if(tx!==null){
mo.cd=rand(4.2,6.5);
const sx=tx+rand(-7,7), sz=tz+rand(-7,7);
const dH=Math.hypot(sx-mo.x,sz-mo.z);
const tof=clamp(dH/42,1.8,4.2);
const v=V3((sx-mo.x)/tof,0.5*9.8*tof,(sz-mo.z)/tof);
const nPos=V3(mo.x,mo.y+0.25,mo.z);
const shell=new THREE.Mesh(nadeGeoAT,vmMats.gun); shell.position.copy(nPos); scene.add(shell);
nades.push({m:shell,pos:nPos.clone(),vel:v,fuse:9,thrower:this,team:this.team,spin:V3(3,0,0.5),bounces:0,mortar:true});
AudioSys.mortarThunk(this.pos.distanceTo(camera.position));
spawnP(PT.dark,mo.x,mo.y+0.4,mo.z,0,1.4,0,0.5,1.6,0.6,0.5,0.2);
mo.tube.rotation.x=0.5;
} else mo.cd=1.4;
}
mo.tube.rotation.x=dampF(mo.tube.rotation.x,0.62,5,dt);
// 敌人逼近/压制/时间到: 离炮
const engagedClose=this.target&&this.target.alive&&nowT-this.lastSeenT<3&&Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z)<14;
if(this.mortT<=0||engagedClose||this.suppression>1.2){
mo.user=null; this.mortUse=null;
}
this.updateMesh(dt,0);
return;
}
if(this.state==='melee'&&engaged){
const d=Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z);
this.faceTo(this.target.pos,dt,7);
if(d>1.6){ this.moveDir(Math.atan2(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z),4.4,dt); }
this.meleeT-=dt;
if(d<2.3&&this.meleeT<=0){
this.meleeT=1.1;
setTimeout(()=>{
if(this.alive&&this.target&&this.target.alive){
const dd=Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z);
if(dd<2.6){ this.target.damage(70,this,false); AudioSys.click(500,0.4,0.08); }
}
},380);
if(this.mesh) this.mesh.armR.sh.userData.swing=0.4;
}
this.updateMesh(dt,Math.hypot(this.vel.x,this.vel.z));
return;
}
if(this.state==='atnade'){
const tk=this.atTankTarget;
if(!tk||!tk.alive){ this.state='idle'; this.nadeAnimT=0; }
else {
this.faceTo(tk.pos,dt,6);
this.vel.set(0,0,0);
this.nadeAnimT-=dt;
if(this.mesh) this.mesh.armR.sh.userData.swing=0.6;
if(this.nadeAnimT<=0){
this.atn--; this.nadeCd=rand(8,14);
if(this.cls===5&&this.def.rocket&&this.slots[0]&&this.mag<=0){ this.reloadT=this.def.reload; }
const eye=this.eyePos();
const lead=V3(tk.pos.x+Math.sin(tk.yaw)*tk.vel*0.5,tk.pos.y+0.8,tk.pos.z+Math.cos(tk.yaw)*tk.vel*0.5);
const dist=eye.distanceTo(lead);
const tof=clamp(dist/12,0.7,1.8);
const vel=lead.sub(eye).multiplyScalar(1/tof);
vel.y+=0.5*9.8*tof;
throwNade(this,eye,vel,1.6,true);
this.state='combat';
}
this.updateMesh(dt,0);
return;
}
}
if(this.state==='nade'){
this.faceTo(this.lastSeenPos,dt,5);
this.vel.set(0,0,0);
this.nadeAnimT-=dt;
if(this.mesh) this.mesh.armR.sh.userData.swing=0.6;
if(this.nadeAnimT<=0){
this.nades--; this.nadeCd=rand(13,22);
const eye=this.eyePos();
const tgt=V3(this.lastSeenPos.x+rand(-2,2),heightAt(this.lastSeenPos.x,this.lastSeenPos.z),this.lastSeenPos.z+rand(-2,2));
const dist=eye.distanceTo(tgt);
const tof=clamp(dist/13,0.75,1.9);
const vel=tgt.sub(eye).multiplyScalar(1/tof);
vel.y+=0.5*9.8*tof;
throwNade(this,eye,vel);
this.state='combat';
}
this.updateMesh(dt,0);
return;
}
let speed=0, moveYaw=this.yaw;
let wantMove=false;
if(this.state==='cover'&&this.coverPt){
const d=Math.hypot(this.coverPt.x-this.pos.x,this.coverPt.z-this.pos.z);
if(d>1.2){
wantMove=true; speed=4.6;
moveYaw=this.followPath(dt)??Math.atan2(this.coverPt.x-this.pos.x,this.coverPt.z-this.pos.z);
} else {
this.crouch=true;
this.coverT-=dt;
if(this.mag<this.def.mag*0.4&&this.reloadT<=0){ this.reloadT=this.def.reload; }
if(this.hp<50&&this.bandages>0&&this.bandageT<=0&&this.reloadT<=0&&this.coverT>1.2){ this.bandageT=2.2; }
if(this.coverT<=0){ this.state='combat'; this.crouch=false; this.peekT=rand(1.4,2.8); }
}
}
else if(this.state==='combat'&&engaged){
const d=Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z);
this.crouch=this.combatMove==='crouch';
this.prone=this.combatMove==='prone';
if(this.combatMove==='strafe'){
this.strafeT-=dt;
if(this.strafeT<=0){ this.strafeT=rand(0.5,1.2); this.strafeDir*=-1; }
const toT=Math.atan2(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z);
moveYaw=toT+HPI*this.strafeDir;
wantMove=true; speed=3.0;
if(d>40){ moveYaw=toT+0.5*this.strafeDir; speed=3.6; }
}
}
else if(this.state==='hunt'){
const my=this.followPath(dt);
if(my!==null){ moveYaw=my; wantMove=true; speed=this.suppression>0.5?2.4:3.4;
// 受压制时蛇形接近
if(this.suppression>0.25) moveYaw+=Math.sin(nowT*2.2+this.wanderSeed*4)*0.4;
}
this.crouch=this.suppression>0.8; this.prone=false;
}
else if(this.state==='advance'){
const my=this.followPath(dt);
if(my!==null){ moveYaw=my; wantMove=true; speed=this.suppression>0.6?3.0:5.0;
if(this.suppression>0.25) moveYaw+=Math.sin(nowT*2.0+this.wanderSeed*4)*0.35;
}
this.crouch=false; this.prone=false;
}
else if(this.state==='toVehicle'){
const tv=this.targetVeh;
const apcSeat=tv&&tv.kind==='apc'&&tv.crewBot; // 目标是搭乘车斗
if(!tv||!tv.alive||tv.playerDriven&&tv.kind!=='apc'||(!apcSeat&&tv.crewBot)||(!apcSeat&&tv.hp<tv.maxHp*0.4)){ this.state='idle'; this.targetVeh=null; if(tv&&tv.claimBot===this) tv.claimBot=null; }
else if(apcSeat&&tv.freeSeat()<0){ this.state='idle'; this.targetVeh=null; }
else {
const d=Math.hypot(tv.pos.x-this.pos.x,tv.pos.z-this.pos.z);
if(d<3.8){
if(apcSeat){ tv.boardPassenger(this); }
else this.enterVehicle(tv);
return;
}
const my=this.followPath(dt);
moveYaw=my!==null?my:Math.atan2(tv.pos.x-this.pos.x,tv.pos.z-this.pos.z);
wantMove=true; speed=5.2;
this.crouch=false; this.prone=false;
}
}
else if(this.state==='defend'){
const my=this.followPath(dt);
if(my!==null){ moveYaw=my; wantMove=true; speed=2.6; }
else {
this.crouch=Math.random()<0.002?!this.crouch:this.crouch;
if(!engaged){
this.scanT=(this.scanT||0)-dt;
if(this.scanT<=0){ this.scanT=rand(2,4); this.scanYaw=this.yaw+rand(-1.6,1.6); }
this.yaw=angleLerpTo(this.yaw,this.scanYaw??this.yaw,1.2*dt);
}
}
}
if(wantMove){ this.moveDir(moveYaw,speed*this.speedMul,dt); } else { this.vel.x*=0.7; this.vel.z*=0.7; }
if(wantMove&&this.unstickT<=0){
this.stuckT+=dt;
if(this.stuckT>0.9){
if(this.pos.distanceTo(this.lastPos)<0.8){
this.unstickT=rand(0.35,0.6);
this.unstickDir=Math.random()<0.5?1:-1;
this.path=null; this.repathT=0;
}
this.lastPos.copy(this.pos);
this.stuckT=0;
}
} else if(!wantMove) this.stuckT=0;
if(engaged){
// 拟人转身: 刚发现目标转得慢, 瞄稳后跟枪快
this.faceTo(this.target.pos,dt,4+this.aimSettle*3.5);
} else if(this.target&&nowT-this.lastSeenT<8){
this.faceTo(this.lastSeenPos,dt,4);
} else if(wantMove){
this.yaw=angleLerpTo(this.yaw,moveYaw,5*dt);
}
if(engaged&&this.reactT<=0&&this.reloadT<=0&&this.boltT<=0&&this.state!=='cover'){
const tp=this.target.pos;
const dT=Math.hypot(tp.x-this.pos.x,tp.z-this.pos.z);
const wantYaw=Math.atan2(tp.x-this.pos.x,tp.z-this.pos.z);
// 远距离要求瞄得更正才开枪
const aimGate=dT>50?0.08:(dT>25?0.11:0.16);
if(Math.abs(angDiff(this.yaw,wantYaw))<aimGate){
if(this.def.rocket||(this.def.mortar&&dT<22)){
// 反坦克兵/迫击炮兵近距离改用手枪自卫
if(this.pReloadT<=0&&this.fireT<=0){
if(this.pMag<=0){ this.pReloadT=this.slots[1]?this.slots[1].def.reload:2; }
else {
this.shootAt(this.target,this.slots[1].def);
this.fireT=(60/this.slots[1].def.rpm)*rand(1.4,2.4);
}
}
}
else if(this.def.mortar){
// 迫击炮曲射: 朝最后目击位吊射, 无需直瞄
if(this.mag>0&&this.fireT<=0&&dT>22&&dT<100){
const eye=this.eyePos();
const tx=this.lastSeenPos.x+rand(-7,7), tz=this.lastSeenPos.z+rand(-7,7);
const dist2=Math.hypot(tx-this.pos.x,tz-this.pos.z);
const tof=clamp(dist2/15,1.7,3.4);
const v=V3((tx-eye.x)/tof,0,(tz-eye.z)/tof);
v.y=0.5*9.8*tof;
const m=new THREE.Mesh(nadeGeoAT,vmMats.gun);
m.position.copy(eye); scene.add(m);
nades.push({m,pos:eye.clone(),vel:v,fuse:9,thrower:this,team:this.team,spin:V3(4,0,1),bounces:0,mortar:true});
AudioSys.mortarThunk(this.pos.distanceTo(camera.position));
this.mag--;
this.fireT=rand(4.5,6.5);
if(this.mag<=0) this.reloadT=this.def.reload;
if(this.mesh) this.mesh.armR.sh.userData.swing=0.3;
this.crouch=true;
}
}
else if(this.def.type==='auto'){
if(this.mag>0&&this.burstPause<=0){
// 距离化点射节奏: 近距离长点射泼弹, 远距离两三发短点
if(this.burstLeft<=0){ this.burstLeft=dT>45?randi(2,3):(dT>18?randi(3,5):randi(5,9)); }
if(this.fireT<=0){
this.shootAt(this.target);
this.fireT=60/this.def.rpm;
if(--this.burstLeft<=0) this.burstPause=dT>45?rand(0.8,1.6):(dT>18?rand(0.5,1.0):rand(0.25,0.55));
}
}
} else {
if(this.mag>0&&this.fireT<=0){
this.shootAt(this.target);
this.fireT=this.def.type==='bolt'?0.1:(dT>40?rand(0.6,1.1):rand(0.4,0.75));
if(this.def.type==='bolt') this.boltT=this.def.boltT||1.0;
}
}
}
}
if(this.mag<=0&&this.reloadT<=0){ this.reloadT=this.def.reload*rand(1,1.25); }
this.updateMesh(dt,Math.hypot(this.vel.x,this.vel.z));
}
updateEmplacement(dt){
const g=this.empUse;
this.crouch=false; this.prone=false;
this.vel.set(0,0,0);
this.pos.y=standHeight(this.pos.x,this.pos.z,this.pos.y+1);
g.cd-=dt;
if(g.kind==='at'){
this.pos.x=g.x-Math.sin(g.face)*1.2;
this.pos.z=g.z-Math.cos(g.face)*1.2;
const tk=enemyTankNear(this,160);
if(tk){
const wantYaw=Math.atan2(tk.pos.x-g.x,tk.pos.z-g.z);
const rel=clamp(angDiff(g.face,wantYaw),-1.0,1.0);
g.yaw.rotation.y=dampF(g.yaw.rotation.y,rel,4,dt);
this.yaw=g.face+g.yaw.rotation.y;
const dh=Math.hypot(tk.pos.x-g.x,tk.pos.z-g.z);
const pit=clamp(Math.atan2((tk.pos.y+1.2)-g.y,dh),-0.1,0.25);
g.pitch.rotation.x=dampF(g.pitch.rotation.x,-pit,4,dt);
if(Math.abs(angDiff(g.face+g.yaw.rotation.y,wantYaw))<0.05&&g.cd<=0&&this.reactT<=0){
g.cd=5.2+rand(0,1.4);
const dir=V3(Math.sin(this.yaw)*Math.cos(pit),Math.sin(pit),Math.cos(this.yaw)*Math.cos(pit));
const er=0.02*DIFF_TABLE[SETTINGS.diff].spreadMul;
dir.x+=rand(-er,er); dir.y+=rand(-er,er)*0.6; dir.z+=rand(-er,er); dir.normalize();
const o=V3(g.x,g.y+0.25,g.z).addScaledVector(dir,2.6);
const chk=raycastWorld(o,dir,dh);
if(!chk||chk.dist>dh-4){
AudioSys.cannon(o.distanceTo(camera.position)*1.3);
spawnP(PT.flash,o.x,o.y,o.z,dir.x*3,dir.y*3,dir.z*3,0.8,8,0.1,1,0,true);
spawnP(PT.dark,o.x,o.y,o.z,dir.x*2,1,dir.z*2,0.8,2.5,0.8,0.7,0.5);
shells.push({pos:o.clone(),vel:dir.clone().multiplyScalar(150),team:this.team,owner:this,life:3,kind:'at',trail:0});
this.lastFiredT=nowT;
} else g.cd=0.8;
}
}
} else {
this.pos.x=g.x; this.pos.z=g.z-0.9;
const pl=enemyPlaneAlive(this.team);
if(pl){
const lead=pl.pos.clone();
const dist=lead.distanceTo(V3(g.x,g.y,g.z));
const tof=dist/150;
lead.x+=Math.sin(pl.yaw)*Math.cos(pl.pitch)*pl.speed*tof*0.5+rand(-25,25);
lead.z+=Math.cos(pl.yaw)*Math.cos(pl.pitch)*pl.speed*tof*0.5+rand(-25,25);
lead.y+=Math.sin(pl.pitch)*pl.speed*tof*0.5+rand(-8,8);
const wantYaw=Math.atan2(lead.x-g.x,lead.z-g.z);
g.yaw.rotation.y=angleLerpTo(g.yaw.rotation.y,wantYaw,3*dt);
this.yaw=g.yaw.rotation.y;
const dh=Math.hypot(lead.x-g.x,lead.z-g.z);
const pit=clamp(Math.atan2(lead.y-g.y,Math.max(dh,3)),0.05,1.35);
g.pitch.rotation.x=dampF(g.pitch.rotation.x,-pit,5,dt);
if(g.cd<=0&&dist<220){
g.cd=0.62;
const dir=V3(Math.sin(wantYaw)*Math.cos(pit),Math.sin(pit),Math.cos(wantYaw)*Math.cos(pit));
const er=0.05*DIFF_TABLE[SETTINGS.diff].spreadMul;
dir.x+=rand(-er,er); dir.y+=rand(-er,er)*0.7; dir.z+=rand(-er,er); dir.normalize();
fireFlak(g,this,dir);
this.lastFiredT=nowT;
}
}
}
this.updateMesh(dt,0);
}
followPath(dt){
if(!this.path||this.pathI>=this.path.length){ this.path=null; return null; }
const wp=this.path[this.pathI];
const dx=wp[0]-this.pos.x, dz=wp[1]-this.pos.z;
if(dx*dx+dz*dz<1.44){ this.pathI++; return this.followPath(dt); }
return Math.atan2(dx,dz);
}
moveDir(yaw,speed,dt){
if(this.unstickT>0){
this.unstickT-=dt;
yaw+=HPI*this.unstickDir;
} else {
const probe=(a)=>!occBlocked(this.pos.x+Math.sin(a)*1.4,this.pos.z+Math.cos(a)*1.4);
if(!probe(yaw)){
let found=false;
for(const da of [0.55,-0.55,1.1,-1.1,1.65,-1.65]){
if(probe(yaw+da)){ yaw+=da; found=true; break; }
}
if(!found) yaw+=Math.PI*(Math.random()<0.5?0.5:-0.5);
}
}
const cr=this.prone?0.28:this.crouch?0.5:1;
const wf=nowT-(this.wireT||-9)<0.3?0.42:1;
this.vel.x=Math.sin(yaw)*speed*cr*wf;
this.vel.z=Math.cos(yaw)*speed*cr*wf;
this.pos.x+=this.vel.x*dt;
this.pos.z+=this.vel.z*dt;
collideMove(this.pos,0.4);
const gh=standHeight(this.pos.x,this.pos.z,this.pos.y+0.6);
this.pos.y=dampF(this.pos.y,gh,20,dt);
}
faceTo(p,dt,rate){
const wantYaw=Math.atan2(p.x-this.pos.x,p.z-this.pos.z);
this.yaw=angleLerpTo(this.yaw,wantYaw,rate*dt);
const dy=(p.y+1.3)-(this.pos.y+1.5);
const dh=Math.hypot(p.x-this.pos.x,p.z-this.pos.z);
this.pitch=dampF(this.pitch,Math.atan2(dy,Math.max(dh,0.1)),8,dt);
}
shootAt(tgt,def2){
if(def2) this.pMag--;
else this.mag--;
const useDef=def2||this.def;
const diff=DIFF_TABLE[SETTINGS.diff];
const eye=this.eyePos();
const aimP=V3(tgt.pos.x,tgt.pos.y+(tgt.prone?0.32:tgt.crouch?0.9:1.25)+rand(-0.12,0.2),tgt.pos.z);
if(tgt.vel){ aimP.x+=tgt.vel.x*rand(0,0.12); aimP.z+=tgt.vel.z*rand(0,0.12); }
const dir=aimP.sub(eye).normalize();
const dHor=Math.hypot(tgt.pos.x-this.pos.x,tgt.pos.z-this.pos.z);
const tSpd=tgt.vel?Math.hypot(tgt.vel.x,tgt.vel.z):0;
let err=(1.7-this.aimSettle)*diff.spreadMul*(1+this.suppression*1.0)*(this.crouch?0.75:1)*0.016;
err*=1+clamp(tSpd/5,0,1.2)*0.85;
if(def2) err*=1.3;
if(this.prone) err*=0.55;
else if(Math.hypot(this.vel.x,this.vel.z)<0.4&&this.crouch&&(this.state==='defend'||this.state==='cover')) err*=0.6;
if(dHor<15) err*=1.4;
else if(dHor<28) err*=1.15;
if(tgt.isPlayer&&tgt.sprinting) err*=1.2;
dir.x+=rand(-err,err); dir.y+=rand(-err,err)*0.7; dir.z+=rand(-err,err);
// 拟人瞄准: 甩枪初始偏差 + 缓慢呼吸漂移 (沿视线的横向/纵向)
const sideX=dir.z, sideZ=-dir.x;
const wob=(Math.sin(nowT*1.5+this.wanderSeed*3)+Math.sin(nowT*2.7+this.wanderSeed)*0.5)*0.011*(1.4-this.aimSettle);
dir.x+=sideX*(this.aimErrX+wob); dir.z+=sideZ*(this.aimErrX+wob);
dir.y+=this.aimErrY+Math.sin(nowT*1.1+this.wanderSeed*2)*0.007*(1.4-this.aimSettle);
dir.normalize();
const muzzleP=eye.clone().addScaledVector(V3(Math.sin(this.yaw),this.pitch*0.5,Math.cos(this.yaw)).normalize(),0.7);
muzzleP.y-=0.12;
fireBullet(this,eye,dir,useDef,muzzleP);
if(this.mesh) this.mesh.armR.sh.userData.swing=0.12;
}
updateMeshSeated(dt,v){
const m=this.mesh; if(!m) return;
if(!m.root.visible) m.root.visible=true;
m.root.position.copy(this.pos);
const side=(this.seatIdx||0)%2===0?-1:1;
const aim=this.target&&nowT-this.lastSeenT<2.5;
const face=aim?this.yaw:(v.yaw+side*HPI*0.85);
m.root.rotation.set(0,face,0);
m.pelvis.position.y=dampF(m.pelvis.position.y,0.5,10,dt);
m.pelvis.position.x=0;
m.pelvis.rotation.x=0.08; m.pelvis.rotation.y=0;
m.torsoG.rotation.y=0; m.torsoG.rotation.z=0;
m.legL.hip.rotation.x=-1.5; m.legR.hip.rotation.x=-1.5;
m.legL.knee.rotation.x=1.45; m.legR.knee.rotation.x=1.45;
m.armR.sh.rotation.set(aim?-0.6:-0.35,0,-0.25);
m.armR.el.rotation.x=aim?-1.5:-1.2;
m.armL.sh.rotation.set(aim?-1.3:-0.9,0,0.45);
m.armL.el.rotation.x=aim?-0.2:-0.5;
m.gunG.position.set(0.14,0.4,0.1);
m.gunG.rotation.y=0; m.gunG.rotation.z=0;
m.gunG.rotation.x=aim?-clamp(this.pitch,-0.55,0.55):0.25;
if(this.gun) this.gun.rotation.y=Math.PI;
m.headG.rotation.x=aim?-clamp(this.pitch,-0.4,0.4)*0.7:0;
m.headG.rotation.y=0;
m.tag.visible=this.team===player.team&&this.pos.distanceTo(camera.position)<60;
if(m.face) m.face.set(aim?'aim':'normal');
}
updateMesh(dt,speed){
const m=this.mesh;
if(!m) return;
m.root.position.copy(this.pos);
m.root.rotation.set(0,this.yaw,0);
const engaged=(this.target&&nowT-this.lastSeenT<4.5)||this.mgUse||this.empUse;
const prone=this.prone, crouch=this.crouch&&!prone;
const sprint=speed>4.4&&!engaged&&!prone;
const moving=speed>0.4;
this.animT+=dt*(3+speed*1.9);
const t=this.animT, S=Math.sin(t);
const sw=prone?clamp(speed/1.2,0,1)*0.35:clamp(speed/4,0,1.3)*0.62;
// ---- 重心: 上下双频浮动 + 左右重心转移(踩在支撑腿上方) ----
const runB=(!prone&&!crouch&&moving)?sw:0;
const pelY=(prone?0.22:crouch?0.6:0.94)
+runB*(Math.abs(Math.cos(t))*0.075-0.045)
+(sprint?-0.03:0);
m.pelvis.position.y=dampF(m.pelvis.position.y,pelY,12,dt);
m.pelvis.position.x=dampF(m.pelvis.position.x||0,Math.sin(t)*0.034*runB,10,dt);
const torsoX=prone?1.5:crouch?0.14:(sprint?0.34:0.05);
m.pelvis.rotation.x=dampF(m.pelvis.rotation.x,torsoX,8,dt);
const pp=m.pelvis.rotation.x;
// 躯干侧倾 + 肩部反向扭转(与骨盆相位相反, 自然对侧摆臂感)
m.torsoG.rotation.y=dampF(m.torsoG.rotation.y||0,-Math.sin(t)*0.1*runB,9,dt);
// 侧身探头: 交战中低速平移时向平移方向探身(与玩家探头一致的姿态)
const leanTgt2=(engaged&&!prone&&!crouch&&speed>0.3&&speed<2.4&&this.strafeDir)?clamp(this.strafeDir,-1,1)*0.4:0;
this.leanT=dampF(this.leanT||0,leanTgt2,6,dt);
const rollTgt=Math.sin(t)*0.055*runB-this.leanT*0.5;
// 侧身站姿(枪手姿态)
const blade=prone?0.08:sprint?0:(engaged?0.5:0.3);
m.pelvis.rotation.y=dampF(m.pelvis.rotation.y,-blade,7,dt);
m.headG.rotation.y=-m.pelvis.rotation.y*0.85;
if(prone){
// 匍匐: 双腿伸直贴地拖在身后, 爬行时交替蹬腿
m.legL.hip.rotation.x=dampF(m.legL.hip.rotation.x,0.04+S*sw*0.5,10,dt);
m.legR.hip.rotation.x=dampF(m.legR.hip.rotation.x,0.04-S*sw*0.5,10,dt);
m.legL.knee.rotation.x=dampF(m.legL.knee.rotation.x,0.08+Math.max(0,S)*sw*0.9,10,dt);
m.legR.knee.rotation.x=dampF(m.legR.knee.rotation.x,0.08+Math.max(0,-S)*sw*0.9,10,dt);
} else if(crouch){
m.legL.hip.rotation.x=dampF(m.legL.hip.rotation.x,-1.05+S*sw*0.5,10,dt);
m.legR.hip.rotation.x=dampF(m.legR.hip.rotation.x,-0.5-S*sw*0.5,10,dt);
m.legL.knee.rotation.x=dampF(m.legL.knee.rotation.x,1.3,10,dt);
m.legR.knee.rotation.x=dampF(m.legR.knee.rotation.x,0.95,10,dt);
} else {
// ---- 四相步态: 抬大腿(前摆大后摆小) → 收小腿折叠 → 触地伸直 → 支撑蹬伸 ----
const gait=(ph)=>{
const s2=Math.sin(ph);
const hip=(s2>0?s2*1.0:s2*0.72)*sw*0.85;
const fold=Math.max(0,Math.sin(ph-2.85));
const knee=Math.pow(fold,1.15)*1.45*sw+Math.max(0,Math.sin(ph+2.6))*0.12*sw+0.07;
return [hip,knee];
};
const [hL,kL]=gait(t), [hR,kR]=gait(t+Math.PI);
m.legL.hip.rotation.x=hL-torsoX*0.6;
m.legR.hip.rotation.x=hR-torsoX*0.6;
m.legL.knee.rotation.x=kL;
m.legR.knee.rotation.x=kR;
}
const rl=this.reloadT>0;
// 持枪姿态: shX=肩前后摆, shY=肩水平转, shZ=肩外展(横向), el=肘弯
let shR,elR,shL,elL,shRy=0,shLy=0,shRz=0,shLz=0;
if(prone){
// 匍匐: 双肘撑地, 小臂抬起托枪在面前, 手不插入地面, 爬行时交替前伸
shR=-1.42+S*sw*0.32; elR=-1.15; shRz=-0.2;
shL=-1.3-S*sw*0.32; elL=-1.25; shLz=0.42;
if(rl){ shL=-1.1+Math.sin(nowT*7)*0.1; elL=-1.0; }
}
else if(engaged){
// 据枪瞄准: 右手扳机位, 左手横伸托护木
const ap=clamp(this.pitch,-0.7,0.7);
shR=-0.55-ap*0.85; elR=-1.6; shRz=-0.28;
shL=-1.35-ap*0.85; elL=-0.14; shLz=0.55;
} else if(sprint){
// 疾跑: 枪斜抱胸前, 双手都在枪上(左手护木/右手握把), 随步幅小幅起伏
shR=-0.88+S*0.08; elR=-1.42; shRy=0.42; shRz=-0.34;
shL=-1.12-S*0.08; elL=-0.85; shLy=0.72; shLz=0.46;
} else {
// 低持枪警戒: 枪口斜向下, 双手仍在枪上
shR=-0.42; elR=-1.3; shRz=-0.24;
shL=-1.08; elL=-0.28; shLz=0.5;
}
if(rl&&!sprint&&!prone){ shL=-0.8+Math.sin(nowT*7)*0.13; elL=-1.45; shLz=0.18; }
// 侧身补偿: 躯干扭转后手臂仍指向枪身
shRy+=-m.pelvis.rotation.y*0.85;
shLy+=-m.pelvis.rotation.y*0.85;
if(m.armR.sh.userData.swing>0){
m.armR.sh.userData.swing-=dt;
shR+=Math.sin(m.armR.sh.userData.swing*16)*0.6;
}
m.armR.sh.rotation.x=dampF(m.armR.sh.rotation.x,shR,11,dt);
m.armR.el.rotation.x=dampF(m.armR.el.rotation.x,elR,11,dt);
m.armL.sh.rotation.x=dampF(m.armL.sh.rotation.x,shL,11,dt);
m.armL.el.rotation.x=dampF(m.armL.el.rotation.x,elL,11,dt);
m.armL.sh.rotation.y=dampF(m.armL.sh.rotation.y,shLy,8,dt);
m.armR.sh.rotation.y=dampF(m.armR.sh.rotation.y,shRy,8,dt);
m.armL.sh.rotation.z=dampF(m.armL.sh.rotation.z,shLz,9,dt);
m.armR.sh.rotation.z=dampF(m.armR.sh.rotation.z,shRz,9,dt);
// 疾跑: 枪横抱在胸前中央(位置+角度), 平时枪在肩前
const gp=m.gunG.position;
gp.x=dampF(gp.x,sprint?0.03:0.14,8,dt);
gp.y=dampF(gp.y,sprint?0.5:0.4,8,dt);
gp.z=dampF(gp.z,sprint?0.17:0.1,8,dt);
m.gunG.rotation.y=dampF(m.gunG.rotation.y,-m.pelvis.rotation.y+(sprint?0.92:0),9,dt);
m.gunG.rotation.z=dampF(m.gunG.rotation.z,sprint?0.22:0,8,dt);
this.gun.rotation.y=Math.PI;
// 匍匐时枪身反向补偿躯干俯角, 保持枪口朝前
const gunPitch=(engaged||this.mgUse||this.empUse)?-clamp(this.pitch,-0.7,0.7):(sprint?0.35:0.25);
m.gunG.rotation.x=prone?gunPitch-pp+0.1:gunPitch;
const headTgt=(engaged?-clamp(this.pitch,-0.6,0.6)*0.7:0)+(prone?-0.08-pp:-torsoX*0.5);
m.headG.rotation.x=dampF(m.headG.rotation.x,headTgt,9,dt);
if(this.flinchT>0){ this.flinchT-=dt; m.torsoG.rotation.z=rollTgt+Math.sin(this.flinchT*40)*0.07; }
else m.torsoG.rotation.z=dampF(m.torsoG.rotation.z,rollTgt,10,dt);
m.tag.visible=this.team===player.team&&this.pos.distanceTo(camera.position)<60;
// ---- 面部表情状态机 (近距离才更新逻辑, 换状态零渲染开销) ----
if(m.face){
this._faceT=(this._faceT||0)-dt;
if(this._faceT<=0){
this._faceT=0.12;
if(this.pos.distanceTo(camera.position)<28){
let st='normal';
if(nowT-(this.lastDmgT||-99)<1.1) st='pain';
else if(this.suppression>0.75) st='fear';
else if(nowT<(this._blinkEnd||0)) st='blink';
else if(engaged||rl) st='aim';
else if(!moving&&nowT<(this._glanceEnd||0)) st=this._glanceSide||'sideL';
if(st==='normal'||st==='aim'){
if(nowT>=(this._blinkNext||0)){ this._blinkEnd=nowT+0.13; this._blinkNext=nowT+rand(2,5.5); if(st==='normal') st='blink'; }
}
if(st==='normal'&&!moving&&nowT>=(this._glanceNext||0)){
this._glanceEnd=nowT+rand(0.8,1.6);
this._glanceSide=Math.random()<0.5?'sideL':'sideR';
this._glanceNext=nowT+rand(4,9);
}
m.face.set(st);
}
}
}
}
}
