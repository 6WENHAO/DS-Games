'use strict';
const player = {
isPlayer:true, name:'你', team:0, cls:0,
pos:V3(-118,1,0), vel:V3(), yaw:HPI, pitch:0,
hp:100, alive:false, deployed:false, crouch:false, onGround:true,
stamina:1, sprinting:false, ads:false, holdBreath:false,
mouseDX:0, mouseDY:0, landDip:0, airT:0,
slots:[], curSlot:0, curW:null, nadeCount:2,
fireT:0, bloom:0, lastDmgT:-99, deathT:0,
recoilPitch:0, recoilYaw:0,
kills:0, deaths:0, score:0,
nadeHeld:false, nadeFuse:0, nadeIsSmoke:false, smokeCount:1, onMG:null, resupplyCd:0,
onVehicle:null, onAT:null, onAA:null, atNades:0, nadeIsAT:false,
suppressV:0, meleeCd:0,
bandages:2, maxBandages:2, bandaging:0, bandResupCd:0, medkitUsed:false, grabAction:null,
eyeH:1.62,
lastFiredT:-99, killerName:'',
suppress(a){ this.suppressV=Math.min(1,this.suppressV+a); },
leanT:0,
damage(amt,attacker,isHead){
if(!this.alive||matchOver) return;
this.hp-=amt;
this.lastDmgT=nowT;
if(this.bandaging>0){ this.bandaging=0; showScorePop('包扎被打断!'); }
AudioSys.hurt();
dmgFlash=Math.min(1,dmgFlash+0.5);
addTrauma(0.25);
if(attacker){
const a=Math.atan2(attacker.pos.x-this.pos.x,attacker.pos.z-this.pos.z);
addDirHit(a);
}
if(this.hp<=0){
this.hp=0;
this.die(attacker,isHead);
}
},
die(attacker,isHead){
this.alive=false;
this.deaths++;
this.deathT=nowT;
tickets[this.team]=Math.max(0,tickets[this.team]-1);
this.killerName=attacker?(attacker.name||'敌军'):'';
if(attacker&&attacker!==this){ attacker.kills=(attacker.kills||0)+1; attacker.score=(attacker.score||0)+100; addKillfeed(attacker,this,false); }
if(this.onMG){ this.onMG.user=null; this.onMG=null; }
if(this.onAT){ this.onAT.user=null; this.onAT=null; }
if(this.onAA){ this.onAA.user=null; this.onAA=null; }
if(this.onMortar){ this.onMortar.user=null; this.onMortar=null; }
this.onVehicle=null;
this.nadeHeld=false;
// 修复: 开镜状态阵亡后残留(镜遮罩/ADS/屏息/架枪一并复位)
this.ads=false; this.holdBreath=false; this.braced=false;
if(typeof VM!=='undefined'){ VM.adsBlend=0; }
document.getElementById('scopeOv').style.display='none';
document.exitPointerLock&&document.exitPointerLock();
noteDeath(this.pos.x,this.pos.z);
// 死亡视角: 摄像机绑进布娃娃头部眼位(约4秒), 期间部署冷却并行计时(不额外占用)
this.deathRag=window.CANNON?spawnRagdoll(this,attacker,isHead):null;
if(this.deathRag&&this.mesh){
// 模型部件已被布娃娃接管, 移除空壳, 下次部署重建
if(this.mesh.tag&&this.mesh.tag.material.map) this.mesh.tag.material.map.dispose();
if(this.mesh.tag) this.mesh.tag.material.dispose();
scene.remove(this.mesh.root);
this.mesh=null; this.meshTeam=undefined;
}
this.deathCamDur=this.deathRag?4.0:1.6;
this.deathCamT=this.deathCamDur;
this._deployShown=false;
this.deathCamYaw=this.yaw+Math.PI;
this.deathPos=this.pos.clone();
this.deathPos.y+=0.4;
respawnCd=8;
pickDeathQuote();
},
doMeleeHit(){
const dir=camForward();
const o=camera.position.clone();
const sr=raySoldiers(o,dir,2.6,player);
if(sr){
sr.sol.damage(110,player,false);
AudioSys.click(500,0.5,0.09);
addTrauma(0.15);
} else {
const wr=raycastWorld(o,dir,2.4);
if(wr){ impactFX(wr.point,wr.normal,wr.kind); AudioSys.click(1800,0.3,0.05); }
}
},
releaseNade(){
const dir=camForward();
const o=camera.position.clone().add(dir.clone().multiplyScalar(0.3));
if(this.nadeIsSmoke){
const v=dir.multiplyScalar(12).add(V3(0,2.4,0)).add(this.vel.clone().multiplyScalar(0.4));
throwNade(this,o,v,1.8,false,true);
this.smokeCount--;
this.nadeIsSmoke=false;
} else if(this.nadeIsAT){
const v=dir.multiplyScalar(12).add(V3(0,2.2,0)).add(this.vel.clone().multiplyScalar(0.4));
throwNade(this,o,v,1.6,true);
this.atNades--;
this.nadeIsAT=false;
} else {
const v=dir.multiplyScalar(15).add(V3(0,2.4,0)).add(this.vel.clone().multiplyScalar(0.4));
throwNade(this,o,v,this.nadeFuse);
this.nadeCount--;
}
AudioSys.metalSlide(0.2,0.08,600,300);
},
finishReload(){
const w=this.curW;
if(!w) return;
const need=w.def.mag-w.mag;
const take=Math.min(need,w.reserve);
w.mag+=take; w.reserve-=take;
},
doGrabResolve(){
if(!this.grabAction) return;
const ga=this.grabAction;
if(ga.kind==='ammo'){
const ac=ga.crate;
for(const s of this.slots){ s.reserve=s.def.reserve; }
this.nadeCount=CLASSES[this.cls].nades;
this.smokeCount=CLASSES[this.cls].smoke||0;
this.atNades=this.cls===5?(TEAM_FACTION[this.team].atn5||3):(this.cls===2?2:0);
this.resupplyCd=6;
AudioSys.metalSlide(0.3,0.15,500,900);
showScorePop('弹药已补充');
} else if(ga.kind==='medcrate'){
const c=ga.crate;
this.bandages=this.maxBandages;
c.uses--;
this.bandResupCd=4;
AudioSys.click(900,0.3,0.05);
showScorePop('绷带已补充');
if(c.owner&&c.owner!==this){ c.owner.score=(c.owner.score||0)+10; }
}
this.grabAction=null;
},
};
combatants.push(player);
// ===== 小队指挥系统 =====
const SQUAD={ mode:'follow', pos:V3(), members:[], marker:null };
