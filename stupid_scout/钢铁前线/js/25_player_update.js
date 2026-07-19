'use strict';
function tryInteract(){
if(!player.alive) return;
if(player.onVehicle){
const t=player.onVehicle;
if(t.kind==='apc'){
// 下车(司机或乘客)
if(player.playerSeat>=0){ player.playerSeat=-1; t.playerSeat=-1; }
else { t.playerDriven=false; t.vel*=0.4; }
player.onVehicle=null;
for(const off of [[2.8,0],[-2.8,0],[0,3.6],[0,-3.6]]){
const px=t.pos.x+off[0], pz=t.pos.z+off[1];
if(!occBlocked(px,pz)){ player.pos.set(px,0,pz); break; }
player.pos.set(t.pos.x+2.8,0,t.pos.z);
}
player.pos.y=standHeight(player.pos.x,player.pos.z,t.pos.y+2);
player.vel.set(0,0,0);
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
if(t.kind==='plane'){
// 跳伞
t.playerDriven=false;
player.onVehicle=null;
player.pos.set(t.pos.x,t.pos.y-2.5,t.pos.z);
player.vel.set(t.fwdDir().x*6,0,t.fwdDir().z*6);
player.chute=true;
player.onGround=false;
if(!playerChuteMesh){ playerChuteMesh=mkChute(); scene.add(playerChuteMesh); }
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
showScorePop('跳伞!');
return;
}
t.playerDriven=false; t.isAI=true; t.vel=0;
player.onVehicle=null;
for(const off of [[3.2,0],[-3.2,0],[0,4],[0,-4],[4,4]]){
const px=t.pos.x+off[0], pz=t.pos.z+off[1];
if(!occBlocked(px,pz)){ player.pos.set(px,0,pz); break; }
player.pos.set(t.pos.x+3.2,0,t.pos.z);
}
player.pos.y=standHeight(player.pos.x,player.pos.z,t.pos.y+2);
player.vel.set(0,0,0);
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
if(player.onMG){
player.onMG.user=null; player.onMG=null;
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
if(player.onAT){ player.onAT.user=null; player.onAT=null; VM.root.visible=true; document.getElementById('heatWrap').style.display='none'; return; }
if(player.onAA){ player.onAA.user=null; player.onAA=null; VM.root.visible=true; document.getElementById('heatWrap').style.display='none'; return; }
// 迫击炮: 上炮/下炮 (架设后所有人可用, 回收=迫击炮手按B)
if(player.onMortar){
const m3=player.onMortar;
m3.user=null; player.onMortar=null; VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
{
const m2=MORTARS.find(m=>m.alive&&!m.user&&Math.hypot(m.x-player.pos.x,m.z-player.pos.z)<2.8);
if(m2){
player.onMortar=m2; m2.user=player;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
showScorePop('迫击炮瞄准中');
return;
}
}
for(const t of tanks){
if(!t.alive||t.team!==player.team) continue;
if(Math.hypot(t.pos.x-player.pos.x,t.pos.z-player.pos.z)<4.5){
if(t.crewBot){ t.crewBot.dismountVehicle(false); showScorePop('你接管了坦克'); }
t.playerDriven=true; t.isAI=false; t.vel=0;
player.onVehicle=t;
player.ads=false; player.nadeHeld=false;
player.yaw=t.yaw+t.turretYaw+Math.PI; player.pitch=0;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
return;
}
}
// 运兵车: 无司机→驾驶; 有司机→上车斗(乘客可车内开枪)
for(const a of apcs){
if(!a.alive||a.team!==player.team) continue;
if(Math.hypot(a.pos.x-player.pos.x,a.pos.z-player.pos.z)<4.2){
if(!a.crewBot&&!a.playerDriven){
a.playerDriven=true;
player.onVehicle=a;
player.playerSeat=-1; a.playerSeat=-1;
player.ads=false; player.nadeHeld=false;
player.yaw=a.yaw+Math.PI;
VM.root.visible=false;
showScorePop('驾驶 '+a.name+' · 附近步兵会自动上车');
return;
}
const seat=a.freeSeat();
if(seat>=0){
player.onVehicle=a;
player.playerSeat=seat; a.playerSeat=seat;
player.ads=false; player.nadeHeld=false;
VM.root.visible=true;
showScorePop('已上车斗 · 可直接射击 · F 下车');
return;
}
}
}
for(const mg of MG42S){
if(mg.user) continue;
if(Math.hypot(mg.x-player.pos.x,mg.z-player.pos.z)<2.6){
player.onMG=mg; mg.user=player;
player.pos.x=mg.x-Math.sin(mg.face)*0.85;
player.pos.z=mg.z-Math.cos(mg.face)*0.85;
player.yaw=mg.face+Math.PI; player.pitch=0; player.ads=false;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
return;
}
}
for(const g of ATGUNS){
if(g.user) continue;
if(Math.hypot(g.x-player.pos.x,g.z-player.pos.z)<3){
player.onAT=g; g.user=player;
player.pos.x=g.x-Math.sin(g.face)*1.3;
player.pos.z=g.z-Math.cos(g.face)*1.3;
player.yaw=g.face+Math.PI; player.pitch=0; player.ads=false;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
return;
}
}
for(const g of AAGUNS){
if(g.user) continue;
if(Math.hypot(g.x-player.pos.x,g.z-player.pos.z)<3){
player.onAA=g; g.user=player;
player.pos.x=g.x; player.pos.z=g.z-0.9;
player.pitch=0.5; player.ads=false;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
return;
}
}
if(player.resupplyCd<=0){
for(const ac of AMMO_CRATES){
if(Math.hypot(ac.x-player.pos.x,ac.z-player.pos.z)<2.6){
player.grabAction={kind:'ammo',crate:ac};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
document.getElementById('interact').style.display='none';
return;
}
}
}
if(player.bandResupCd<=0&&player.bandages<player.maxBandages){
for(const c of MED_CRATES){
if(c.team!==player.team||c.uses<=0) continue;
if(Math.hypot(c.x-player.pos.x,c.z-player.pos.z)<2.6){
player.grabAction={kind:'medcrate',crate:c};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
document.getElementById('interact').style.display='none';
return;
}
}
}
}
let camTrauma=0, dmgFlash=0;
function addTrauma(x){ camTrauma=Math.min(1.2,camTrauma+x); }
function updatePlayer(dt){
if(!player.alive){ return; }
const p=player;
p.meleeCd-=dt; p.resupplyCd-=dt;
p.bandResupCd=Math.max(0,(p.bandResupCd||0)-dt);
p.suppressV=Math.max(0,p.suppressV-dt*0.8);
// 呼吸回血(削弱): 仅能自然恢复到70, 满血需绷带
if(nowT-p.lastDmgT>6&&p.hp<70) p.hp=Math.min(70,p.hp+4*dt);
// 绷带包扎
if(p.bandaging>0){
p.bandaging-=dt;
if(p.bandaging<=0){
p.bandages--;
p.hp=Math.min(100,p.hp+45);
showScorePop('包扎完成 +45');
AudioSys.click(1200,0.3,0.06);
}
}
p.recoilPitch*=Math.pow(0.0001,dt*0.7);
p.recoilYaw*=Math.pow(0.0001,dt*0.7);
p.recoilPitch=clamp(p.recoilPitch,-0.2,0.2);
// 架枪检测: 胸前有齐腰遮挡且头顶上方无遮挡 (架枪时沿架设方向检测, 避免转头就脱离)
p.canBrace=false;
if(p.onGround&&!p.prone&&!p.onVehicle&&!p.onMG&&!p.onAT&&!p.onAA&&Math.hypot(p.vel.x,p.vel.z)<0.8){
const bd=p.braced?V3(-Math.sin(p.braceYaw),0,-Math.cos(p.braceYaw)):camForward(); bd.y=0;
if(bd.lengthSq()>0.1){
bd.normalize();
const chestY=p.pos.y+(p.crouch?0.72:1.05);
const hit=raycastWorld(V3(p.pos.x,chestY,p.pos.z),bd,1.15);
if(hit&&hit.kind!=='ground'){
const over=raycastWorld(V3(p.pos.x,chestY+0.55,p.pos.z),bd,1.3);
if(!over) p.canBrace=true;
}
}
}
if(p.braced&&(!p.canBrace||!p.onGround||p.prone)) p.braced=false;
// 架枪状态: 以支点为轴, 视角限制在架设方向左右一定范围内
if(p.braced){
const rel=clamp(angDiff(p.braceYaw,p.yaw),-0.72,0.72);
p.yaw=p.braceYaw+rel;
p.pitch=clamp(p.pitch,-0.5,0.42);
}
if(p.onVehicle){
if(p.onVehicle.kind==='plane') updatePlayerPlane(dt);
else if(p.onVehicle.kind==='apc'){
if(p.playerSeat>=0) updatePlayerApcPassenger(dt);
else updatePlayerApcDriver(dt);
}
else updatePlayerTank(dt);
return;
}
if(p.onAT){ updatePlayerAT(dt); return; }
if(p.onAA){ updatePlayerAA(dt); return; }
if(p.onMG){ updatePlayerMG(dt); return; }
if(p.onMortar){ updatePlayerMortar(dt); return; }
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
const str=(keys.KeyD?1:0)-(keys.KeyA?1:0);
if(p.pendingBuild&&VM.state==='build'&&(fwd!==0||str!==0||keys.Space)){ cancelBuild(p); showScorePop('建造已取消'); }
const wantSprint=keys.ShiftLeft&&fwd>0&&!p.ads&&p.stamina>0.05&&!p.crouch&&p.bandaging<=0;
if(wantSprint&&p.prone) p.prone=false;
if(wantSprint) p.braced=false;
p.sprinting=wantSprint;
p.holdBreath=keys.ShiftLeft&&p.ads;
let leanTgt=0;
if(!p.sprinting&&!p.prone&&p.onGround&&!p.braced){ leanTgt=(keys.KeyQ?-1:0)+(keys.KeyE?1:0); }
p.leanT=dampF(p.leanT,leanTgt,10,dt);
if(p.sprinting){ p.stamina=Math.max(0,p.stamina-dt*0.22); p.stamUseT=nowT; }
else if(p.holdBreath){ p.stamina=Math.max(0,p.stamina-dt*0.3); p.stamUseT=nowT; }
else if(nowT-(p.stamUseT||0)>1) p.stamina=Math.min(1,p.stamina+dt*0.16);
if(p.holdBreath&&p.stamina<=0.02) p.holdBreath=false;
let speed=p.prone?1.15:p.crouch?2.2:(p.sprinting?6.4:4.3);
if(p.ads) speed*=0.55;
if(p.bandaging>0) speed*=0.45;
if(VM.state==='reload') speed*=0.8;
if(nowT-(p.wireT||-9)<0.3) speed*=0.42;
const sy=Math.sin(p.yaw), cy=Math.cos(p.yaw);
let mx=(-sy*fwd + cy*str), mz=(-cy*fwd - sy*str);
const ml=Math.hypot(mx,mz);
if(ml>0.01){ mx/=ml; mz/=ml; }
if(p.braced&&(fwd!==0||str!==0)){ p.braced=false; AudioSys.metalSlide(0.16,0.07,500,900); }
if(p.braced){ mx=0; mz=0; }
const accel=p.onGround?38:6;
p.vel.x=dampF(p.vel.x,mx*speed,accel*dt>1?12:accel,dt);
p.vel.z=dampF(p.vel.z,mz*speed,accel*dt>1?12:accel,dt);
if(keys.Space&&p.onGround&&p.stamina>0.1){ p.vel.y=4.6; p.onGround=false; p.stamina-=0.08; p.stamUseT=nowT; p.crouch=false; p.prone=false; p.braced=false; }
// ===== 梯子攀爬 =====
if(p._onLadder){
const L2=p._onLadder;
const dy=(keys.KeyW?1:0)-(keys.KeyS?1:0);
p.vel.y=dy*3.4;
if(keys.Space){ p.vel.y=3.6; p.vel.x=Math.cos(L2.face)*2.2; p.vel.z=Math.sin(L2.face)*2.2; p._onLadder=0; }
const cy=p.pos.y+p.eyeH;
if(cy>=L2.y1&&dy>0){ p._onLadder=0; } // 爬到顶
if(cy<=L2.y0+0.4&&dy<0){ p._onLadder=0; } // 滑到底
p.pos.x=L2.x; p.pos.z=L2.z;
p.vel.x=0; p.vel.z=0; p.onGround=false;
}
if(!p._onLadder&&p.alive&&!p.onVehicle&&!p.onMG&&!p.onAT&&!p.onAA&&!p.onMortar){
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
if(fwd>0&&LADDERS.length){
const cy2=p.pos.y+p.eyeH;
for(const L3 of LADDERS){
const dx2=p.pos.x-L3.x, dz2=p.pos.z-L3.z;
if(dx2*dx2+dz2*dz2<0.9*0.9&&cy2>L3.y0+0.15&&cy2<L3.y1-0.4){
p._onLadder=L3; p.pos.x=L3.x; p.pos.z=L3.z; p.vel.set(0,0,0); p.onGround=false;
break;
}
}
}
}
p.vel.y-=13*dt;
if(p.chute){
if(p.vel.y<-3.2) p.vel.y=-3.2;
if(p.onGround) p.chute=false;
// 降落伞模型: 头上打开圆顶+系绳
if(!playerChuteMesh){ playerChuteMesh=mkChute(); scene.add(playerChuteMesh); }
playerChuteMesh.position.set(p.pos.x,p.pos.y+3.8,p.pos.z);
playerChuteMesh.rotation.set(Math.sin(nowT*0.7)*0.12,0,Math.cos(nowT*0.6)*0.08);
} else if(playerChuteMesh){ scene.remove(playerChuteMesh); playerChuteMesh=null; }
p.pos.x+=p.vel.x*dt; p.pos.y+=p.vel.y*dt; p.pos.z+=p.vel.z*dt;
collideMove(p.pos,0.42);
const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
if(p.pos.y<=gh){
if(!p.onGround&&p.vel.y<-4){ p.landDip=Math.min(1,-p.vel.y*0.1); AudioSys.footstep(true,0); }
p.pos.y=gh; p.vel.y=0; p.onGround=true;
} else if(p.pos.y>gh+0.05) p.onGround=false;
p.landDip=Math.max(0,p.landDip-dt*3);
const sp2=Math.hypot(p.vel.x,p.vel.z);
p.stepT=(p.stepT||0)-dt*sp2*(p.sprinting?1.25:1);
if(p.stepT<=0&&sp2>0.8&&p.onGround){ p.stepT=1.55; AudioSys.footstep(p.sprinting,0); }
const w=p.curW;
p.fireT-=dt;
p.bloom=Math.max(0,p.bloom-dt*4);
if(mouseDown&&w&&VM.state==='idle'&&p.fireT<=0&&!matchOver&&!p.sprinting&&p.bandaging<=0){
if(w.mag>0){
if(w.def.type==='auto'||!p.fireHeld){
playerShoot(w);
}
} else {
if(!p.fireHeld){ AudioSys.click(2600,0.2,0.03); tryReload(); }
}
p.fireHeld=true;
}
if(!mouseDown) p.fireHeld=false;
if(p.nadeHeld){
p.nadeFuse-=dt;
if(p.nadeFuse<=0){
p.nadeHeld=false;
p.nadeCount--;
VM.state='idle'; VM.gunParts.gun.visible=true; VM.nadeM.visible=false;
explodeAt(p.pos.clone().add(V3(0,1,0)),p);
}
}
updateInteractHint();
}
function playerShoot(w){
const p=player;
w.mag--;
p.fireT=60/w.def.rpm;
const dir=camForward();
if(w.def.mortar){
// 迫击炮: 高抛曲射
vmFireKick(); addTrauma(0.3);
AudioSys.mortarThunk(0);
const v=dir.clone().multiplyScalar(27);
v.y=Math.max(v.y+9,13);
v.addScaledVector(p.vel,0.3);
const m=new THREE.Mesh(nadeGeoAT,vmMats.gun);
m.castShadow=true; m.position.copy(camera.position); scene.add(m);
nades.push({m,pos:camera.position.clone().addScaledVector(dir,0.7),vel:v,fuse:9,thrower:p,team:p.team,spin:V3(4,0,1),bounces:0,mortar:true});
spawnP(PT.dark,camera.position.x+dir.x,camera.position.y+dir.y,camera.position.z+dir.z,dir.x,1.5,dir.z,0.6,2,0.7,0.6,0.3);
return;
}
if(w.def.rocket){
const sp=w.def.spreadAds*(Math.PI/180)*0.5;
const rv=camRight(), uv=rv.clone().cross(dir).negate();
dir.addScaledVector(rv,rand(-sp,sp)).addScaledVector(uv,rand(-sp,sp)).normalize();
vmFireKick(); addTrauma(0.4);
fireRocket(p,camera.position.clone(),dir,w.def,V3());
return;
}
const adsB=VM.adsBlend;
let spread=lerp(w.def.spreadHip,w.def.spreadAds,adsB)*(Math.PI/180)*0.5;
spread*=(1+p.bloom*1.4)*(p.prone?0.5:p.crouch?0.8:1)*(p.onGround?1:2.2)*(Math.hypot(p.vel.x,p.vel.z)>1?1.4:1);
if(p.holdBreath) spread*=0.4;
if(p.braced) spread*=0.35;
const rv=camRight(), uv=rv.clone().cross(dir).negate();
dir.addScaledVector(rv,rand(-spread,spread)).addScaledVector(uv,rand(-spread,spread)).normalize();
p.bloom=Math.min(1,p.bloom+0.16);
const rec=w.def.recoil*0.011*(p.prone?0.68:p.crouch?0.85:1)*(adsB>0.5?0.85:1)*(p.braced?0.45:1);
p.recoilPitch+=rec;
p.recoilYaw+=rand(-1,1)*w.def.recSide*0.006;
p.pitch+=rec*0.55;
p.yaw+=rand(-1,1)*w.def.recSide*0.003;
vmFireKick();
addTrauma(w.def.kick*0.9);
AudioSys.gunshot(w.def.snd,0,0);
const o=camera.position.clone();
fireBullet(p,o,dir,w.def,null);
if(!w.def.enbloc||w.mag>0){
const cp=camera.position.clone().add(camForward().multiplyScalar(0.35)).add(camRight().multiplyScalar(0.14)).add(V3(0,-0.05,0));
if(w.def.type!=='bolt') spawnCasing(cp,camRight(),V3(0,1,0));
}
if(w.def.enbloc&&w.mag===0){
setTimeout(()=>AudioSys.ping(),80);
const clipP=camera.position.clone().add(camForward().multiplyScalar(0.4));
spawnCasing(clipP,camRight(),V3(0,1.5,0));
}
if(w.def.type==='bolt'&&w.mag>0){
VM.state='bolt'; VM.stateT=0; VM.stateDur=w.def.boltT||1.0;
vmSndFlags={};
}
if(w.mag===0&&w.def.type!=='bolt'){ setTimeout(tryReload,350); }
else if(w.mag===0){ setTimeout(tryReload,1000); }
}
function updatePlayerTank(dt){
const p=player, t=p.onVehicle;
if(!t.alive){ p.onVehicle=null; return; }
if(t.kind==='plane') return; // 飞机由Plane.update驱动
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
const turn=(keys.KeyD?1:0)-(keys.KeyA?1:0);
const spdMul=(t.engineHitT>0?0.35:1)*(t.crewDown&&t.crewDown('driver')?0:1);
t.vel=dampF(t.vel,(fwd<0?-t.def.rev:fwd*t.def.spd)*spdMul,2.5,dt);
t.yaw-=turn*t.def.turn*dt*(fwd<0?-1:1);
let wantTY=angDiff(t.yaw,p.yaw+Math.PI);
if(t.def.casemate){
// 坦歼: 火炮射界有限, 超界需转动车体
wantTY=clamp(wantTY,-0.21,0.21);
}
t.turretYaw=angleLerpTo(t.turretYaw,wantTY,t.def.tRate*dt);
let wantPitch=clamp(p.pitch,-0.12,0.32);
if(p.tankView){
// 炮手镜: 测距并抬炮补偿弹道下坠
const cd=camForward(), co=camera.position.clone();
let D=320;
const wr2=raycastWorld(co,cd,D);
if(wr2) D=wr2.dist;
for(const t2 of tanks){
if(t2===t||!t2.alive) continue;
const r2=rayCyl(co,cd,{x:t2.pos.x,z:t2.pos.z,r:2.3,y0:t2.pos.y,y1:t2.pos.y+2.6},D);
if(r2) D=r2.t;
}
wantPitch=clamp(p.pitch+3.5*D/(2*130*130),-0.12,0.35);
}
t.turretPitch=dampF(t.turretPitch,wantPitch,6,dt);
p.fireT-=dt;
// 准星汇聚: 主炮朝相机瞄准点开火
if(mouseDown&&t.cannonCd<=0&&!matchOver){ t.fireCannon(); }
// 同轴机枪(右键)
if(mouse2Down&&!matchOver){
const cd=camForward();
const co=camera.position.clone();
let aimD=200;
const wr=raycastWorld(co,cd,aimD);
if(wr) aimD=wr.dist;
const aimP=co.addScaledVector(cd,aimD);
const dir=aimP.sub(t.coaxMuzzle()).normalize();
if(dir.dot(t.aimDir())>0.85){
dir.x+=rand(-0.012,0.012); dir.y+=rand(-0.009,0.009); dir.z+=rand(-0.012,0.012); dir.normalize();
t.firePlayerMG(dir);
}
}
p.pos.copy(t.pos);
p.vel.set(0,0,0);
const pip=document.getElementById('tankPip');
{
// 战雷式炮塔朝向指示圈: 显示炮管当前实际指向(慢速转塔时落后于视角中心)
const dir2=t.aimDir();
const o2=t.muzzle.clone();
let D2=140;
const wr3=raycastWorld(o2,dir2,D2);
if(wr3) D2=wr3.dist;
const hitP=o2.addScaledVector(dir2,Math.max(6,D2));
const v=hitP.project(camera);
if(v.z<1){
pip.style.display='block';
pip.style.left=((v.x*0.5+0.5)*innerWidth)+'px';
pip.style.top=((1-(v.y*0.5+0.5))*innerHeight)+'px';
} else pip.style.display='none';
}
document.getElementById('mgPip').style.display='none';
document.getElementById('tankSight').style.display='block';
document.getElementById('heatFill').style.width=(clamp(1-t.cannonCd/t.def.reload,0,1)*100)+'%';
document.getElementById('heatFill').style.background=t.cannonCd<=0?'#8fd18f':'linear-gradient(90deg,#e8c56a,#e83a1a)';
updateInteractHint();
}
function updatePlayerPlane(dt){
const p=player, pl=p.onVehicle;
if(!pl.alive){ p.onVehicle=null; return; }
document.getElementById('heatFill').style.width=(pl.bombs/pl.def.bombs*100)+'%';
document.getElementById('heatFill').style.background='#9fc0e8';
updateInteractHint();
}
function updatePlayerMortar(dt){
const p=player, m=p.onMortar;
// 允许左右回旋 ±0.6rad, 炮身视觉随动
const rel=clamp(angDiff(m.face+Math.PI,p.yaw),-0.6,0.6);
p.yaw=m.face+Math.PI+rel;
p.pitch=clamp(p.pitch,0.55,1.35);
p.pos.x=m.x-Math.sin(m.face+rel)*0.85;
p.pos.z=m.z-Math.cos(m.face+rel)*0.85;
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1); p.vel.set(0,0,0);
m.grp.rotation.y=m.face+rel;
m.cd-=dt;
const dir=camForward();
const vo=V3(m.x+dir.x*60,m.y+dir.y*60,m.z+dir.z*60);
// 落点指示圈: 实时显示炮弹落点
mortarMarker.visible=true;
mortarMarker.position.set(vo.x,heightAt(vo.x,vo.z)+0.07,vo.z);
mortarMarker.rotation.y+=dt*1.2;
const mscale=0.85+Math.sin(nowT*3.2)*0.08;
mortarMarker.scale.setScalar(mscale);
if(mouseDown&&m.cd<=0&&!matchOver){
m.cd=3.2;
const dH=Math.hypot(vo.x-m.x,vo.z-m.z);
const tof=clamp(dH/42,1.8,4.2);
const v=V3((vo.x-m.x)/tof,0.5*9.8*tof,(vo.z-m.z)/tof);
AudioSys.metalSlide(0.35,0.18,140,50);
const nPos=V3(m.x,m.y+0.25,m.z);
const shell=new THREE.Mesh(nadeGeoAT,vmMats.gun); shell.position.copy(nPos); scene.add(shell);
nades.push({m:shell,pos:nPos.clone(),vel:v,fuse:9,thrower:p,team:p.team,spin:V3(3,0,0.5),bounces:0,mortar:true});
spawnP(PT.dark,m.x,m.y+0.4,m.z,0,1.4,0,0.5,1.6,0.6,0.5,0.2);
addTrauma(0.12);
}
// 炮管俯仰随视角(高抛→炮管更竖直), 开火后阻尼回位
m.tube.rotation.x=dampF(m.tube.rotation.x,0.62-(p.pitch-0.95)*0.3,5,dt);
document.getElementById('heatFill').style.width=(clamp(1-m.cd/3.2,0,1)*100)+'%';
updateInteractHint();
}
function updatePlayerAT(dt){
const p=player, g=p.onAT;
g.cd-=dt;
const rel=clamp(angDiff(g.face+Math.PI,p.yaw),-1.0,1.0);
p.yaw=g.face+Math.PI+rel;
p.pitch=clamp(p.pitch,-0.12,0.3);
g.yaw.rotation.y=rel;
g.pitch.rotation.x=-p.pitch;
p.pos.x=g.x-Math.sin(g.face)*1.3;
p.pos.z=g.z-Math.cos(g.face)*1.3;
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1);
p.vel.set(0,0,0);
if(mouseDown&&g.cd<=0&&!matchOver){
g.cd=4.5;
const dir=camForward();
const o=V3(g.x,g.y+0.25,g.z).addScaledVector(dir,2.7);
AudioSys.cannon(0);
addTrauma(0.45);
spawnP(PT.flash,o.x,o.y,o.z,dir.x*3,dir.y*3,dir.z*3,0.9,9,0.1,1,0,true);
spawnP(PT.dark,o.x,o.y,o.z,dir.x*2,1,dir.z*2,0.9,2.6,0.9,0.7,0.5);
shells.push({pos:o.clone(),vel:dir.clone().multiplyScalar(150),team:p.team,owner:p,life:3,kind:'at',trail:0});
p.lastFiredT=nowT;
}
document.getElementById('heatFill').style.width=(clamp(1-g.cd/4.5,0,1)*100)+'%';
updateInteractHint();
}
function updatePlayerAA(dt){
const p=player, g=p.onAA;
g.cd-=dt;
p.pitch=clamp(p.pitch,0.02,1.35);
g.yaw.rotation.y=p.yaw+Math.PI;
g.pitch.rotation.x=-p.pitch;
p.pos.x=g.x; p.pos.z=g.z-0.9;
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1);
p.vel.set(0,0,0);
// 提前量指示圈
const pip=document.getElementById('leadPip');
let ep=null,bd=1e9;
for(const pl2 of planes){ if(pl2.alive&&pl2.team!==p.team){ const d=pl2.pos.distanceTo(V3(g.x,g.y,g.z)); if(d<bd){ bd=d; ep=pl2; } } }
if(ep&&bd<280){
const tof=bd/150;
const lead=ep.pos.clone().addScaledVector(ep.velVec(),tof);
const v=lead.project(camera);
if(v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1){
pip.style.display='block';
pip.style.left=((v.x*0.5+0.5)*innerWidth)+'px';
pip.style.top=((1-(v.y*0.5+0.5))*innerHeight)+'px';
} else pip.style.display='none';
} else pip.style.display='none';
if(mouseDown&&g.cd<=0&&!matchOver){
g.cd=0.34;
const dir=camForward();
fireFlak(g,p,dir);
addTrauma(0.1);
p.recoilPitch+=0.004;
p.lastFiredT=nowT;
}
document.getElementById('heatFill').style.width=(clamp(1-g.cd/0.34,0,1)*100)+'%';
updateInteractHint();
}
function updatePlayerMG(dt){
const p=player, mg=p.onMG;
const relYaw=angDiff(mg.face+Math.PI,p.yaw);
if(Math.abs(relYaw)>1.05) p.yaw=mg.face+Math.PI+clamp(relYaw,-1.05,1.05);
p.pitch=clamp(p.pitch,-0.5,0.32);
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1);
p.vel.set(0,0,0);
mg.yaw.rotation.y=angDiff(mg.face+Math.PI,p.yaw);
mg.pitch.rotation.x=-p.pitch*0.9;
p.fireT-=dt;
const mdef=mg.def||{rpm:1100,dmg:28,heatPS:0.014};
mg.heat=Math.max(0,mg.heat-dt*(mouseDown?0:0.22));
if(mouseDown&&p.fireT<=0&&mg.heat<1&&!matchOver){
p.fireT=60/mdef.rpm;
mg.heat+=mdef.heatPS;
if(mg.heat>=1){ AudioSys.metalSlide(0.4,0.3,400,200); }
const dir=camForward();
const spread=0.011+mg.heat*0.015;
const rv=camRight(), uv=rv.clone().cross(dir).negate();
dir.addScaledVector(rv,rand(-spread,spread)).addScaledVector(uv,rand(-spread,spread)).normalize();
p.recoilPitch+=0.0022;
p.pitch=clamp(p.pitch+0.0012,-0.5,0.32);
p.yaw+=rand(-1,1)*0.0018;
addTrauma(0.06);
AudioSys.gunshot('mg',0,0);
const o=V3(mg.x,mg.y+0.12,mg.z);
const muzz=o.clone().addScaledVector(dir,1.35);
fireBullet(p,o,dir,{dmg:mdef.dmg,headMul:1.9,snd:'mg',tracer:2,vehDmg:2.5},muzz);
muzzleFXWorld(muzz,dir);
}
document.getElementById('heatFill').style.width=(mg.heat*100)+'%';
updateInteractHint();
}
let INTERACT_INFO=null; // {label} 当前可用的互动动作(供移动端情境按钮/桌面提示共用)
function updateInteractHint(){
// 兵种技能常驻小提示 (右下角)
const tip=document.getElementById('clsTip');
let tt='';
if(player.alive&&player.deployed&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA){
if(player.onMortar) tt='<b>左键</b> 发射 · <b>鼠标</b> 调弹道 · <b>F</b> 离开';
else if(player.cls===4) tt='<b>B</b> 放置医疗箱';
else if(player.cls===6) tt=player.mortarPlaced?'<b>F</b> 上炮 · <b>B</b> 靠近回收':'<b>B</b> 架设迫击炮';
else if(player.cls===7){
const bt2=BUILD_MENU[player.buildSel||0];
const bn2=bt2==='mg'?mgDefOfTeam(player.team).name:BUILD_NAMES[bt2];
tt='<b>5</b> 工事: '+bn2+' ('+BUILD_COST[bt2]+'点) · <b>B</b> 建造 · 剩 '+(player.buildCount||0)+' 点';
}
}
if(tip._last!==tt){ tip._last=tt; tip.innerHTML=tt; tip.style.display=tt?'block':'none'; }
const el=document.getElementById('interact');
const setInter=(html,short)=>{
INTERACT_INFO=short?{label:short}:null;
if(html){ el.style.display='block'; el.innerHTML=html; }
else el.style.display='none';
};
if(player.onVehicle&&player.onVehicle.kind==='plane'){ setInter('<b>F</b> 跳伞 · <b>W/S</b>油门 <b>A/D</b>压坡转向 <b>鼠标</b>拉杆 <b>左键</b>机枪 <b>右键/B</b>炸弹','跳伞'); return; }
if(player.onVehicle&&player.onVehicle.kind==='apc'){
if(player.playerSeat>=0) setInter('<b>F</b> 下车 · 车斗内可直接射击','下车');
else setInter('<b>F</b> 下车 · <b>WASD</b>驾驶 · 附近步兵自动上车','下车');
return;
}
if(player.onVehicle){ setInter('<b>F</b> 离开坦克 · <b>WASD</b>驾驶 <b>左键</b>主炮 <b>右键</b>机枪 <b>C</b>炮手镜','离开坦克'); return; }
if(player.onMG){ setInter('<b>F</b> 离开机枪','离开机枪'); return; }
if(player.onMortar){ setInter('<b>F</b> 离开迫击炮 · <b>左键</b> 发射 · <b>鼠标</b> 调整弹道','离开迫击炮'); return; }
if(player.onAT){ setInter('<b>F</b> 离开反坦克炮','离开火炮'); return; }
if(player.onAA){ setInter('<b>F</b> 离开防空炮','离开火炮'); return; }
if(!player.alive){ setInter(null,null); return; }
for(const t of tanks){
if(t.alive&&t.team===player.team&&Math.hypot(t.pos.x-player.pos.x,t.pos.z-player.pos.z)<4.5){
const vb=(t.crewBot?'接管':'进入');
setInter('<b>F</b> '+vb+' '+t.name, vb+'坦克'); return;
}
}
for(const a of apcs){
if(a.alive&&a.team===player.team&&Math.hypot(a.pos.x-player.pos.x,a.pos.z-player.pos.z)<4.2){
if(!a.crewBot&&!a.playerDriven){ setInter('<b>F</b> 驾驶 '+a.name,'驾驶卡车'); return; }
if(a.freeSeat()>=0){ setInter('<b>F</b> 搭乘 '+a.name+' · 车斗内可射击','上车斗'); return; }
}
}
for(const mg of MG42S){
if(!mg.user&&Math.hypot(mg.x-player.pos.x,mg.z-player.pos.z)<2.6){
setInter('<b>F</b> 使用 '+((mg.def&&mg.def.name)||'重机枪'),'上机枪'); return;
}
}
for(const g of ATGUNS){
if(!g.user&&Math.hypot(g.x-player.pos.x,g.z-player.pos.z)<3){
setInter('<b>F</b> 使用反坦克炮','上反坦克炮'); return;
}
}
for(const g of AAGUNS){
if(!g.user&&Math.hypot(g.x-player.pos.x,g.z-player.pos.z)<3){
setInter('<b>F</b> 使用防空炮','上防空炮'); return;
}
}
for(const m of MORTARS){
if(!m.alive||m.user) continue;
if(Math.hypot(m.x-player.pos.x,m.z-player.pos.z)<2.8){
setInter((m.owner===player)?'<b>F</b> 使用迫击炮 · <b>B</b> 回收':'<b>F</b> 使用迫击炮','上迫击炮');
return;
}
}
if(player.resupplyCd<=0){
for(const ac of AMMO_CRATES){
if(Math.hypot(ac.x-player.pos.x,ac.z-player.pos.z)<2.6){
setInter('<b>F</b> 补充弹药','补充弹药'); return;
}
}
}
if(player.bandResupCd<=0&&player.bandages<player.maxBandages){
for(const c of MED_CRATES){
if(c.team!==player.team||c.uses<=0) continue;
if(Math.hypot(c.x-player.pos.x,c.z-player.pos.z)<2.6){
setInter('<b>F</b> 拿取绷带','拿取绷带'); return;
}
}
}
setInter(null,null);
}
let camBobT=0;
// ===== 玩家可见身体: 低头可见自己的胸/腿, 与移动同步; 死亡时被布娃娃直接接管 =====
function ensurePlayerBody(){
if(player.mesh&&player.meshTeam===player.team) return;
if(player.mesh){
if(player.mesh.tag&&player.mesh.tag.material.map) player.mesh.tag.material.map.dispose();
if(player.mesh.tag) player.mesh.tag.material.dispose();
scene.remove(player.mesh.root);
}
player.mesh=buildSoldierMesh(player.team,'');
player.meshTeam=player.team;
player.mesh.tag.visible=false;
}
function updatePlayerBody(dt){
const m=player.mesh;
if(!m) return;
const hide=!player.alive||!player.deployed||player.onVehicle||player.chute
||player.onMG||player.onAT||player.onAA||player.onMortar;
if(m.root.visible===hide) m.root.visible=!hide;
if(hide) return;
// 第一人称: 头/手臂/背枪隐藏(视模已有手), 只显示躯干与腿
m.headG.visible=false;
m.armL.sh.visible=false; m.armR.sh.visible=false;
m.gunG.visible=false;
m.tag.visible=false;
m.root.position.copy(player.pos);
// 玩家朝向 = (-sin(yaw), -cos(yaw)); 士兵模型面朝局部+Z → 需要 yaw+π
m.root.rotation.set(0,player.yaw+Math.PI,0);
// 身体后置于摄像机之后, 不遮挡前方视野 (趴下时几乎对齐, 胸在镜头正下前方属正常)
const prone=player.prone, crouch=player.crouch&&!prone;
const back=prone?0.05:(crouch?0.14:0.16)+(player.ads?0.05:0);
m.root.position.x+=Math.sin(player.yaw)*back;
m.root.position.z+=Math.cos(player.yaw)*back;
// 侧身探头: 身体同步倾斜(与第三人称一致)
m.torsoG.rotation.z=dampF(m.torsoG.rotation.z||0,-player.leanT*0.55,12,dt);
m.torsoG.rotation.y=0;
const speed=Math.hypot(player.vel.x,player.vel.z);
player._animT=(player._animT||0)+dt*(3+speed*1.9);
const t=player._animT;
const sw=prone?clamp(speed/1.2,0,1)*0.35:clamp(speed/4,0,1.3)*0.62;
const moving=speed>0.4&&player.onGround;
const runB=(!prone&&!crouch&&moving)?sw:0;
m.pelvis.position.y=dampF(m.pelvis.position.y,(prone?0.22:crouch?0.6:0.94)+runB*(Math.abs(Math.cos(t))*0.06-0.036),12,dt);
m.pelvis.rotation.x=dampF(m.pelvis.rotation.x,prone?1.5:crouch?0.14:0.05,8,dt);
const torsoX=m.pelvis.rotation.x;
if(prone){
m.legL.hip.rotation.x=dampF(m.legL.hip.rotation.x,0.04+Math.sin(t)*sw*0.5,10,dt);
m.legR.hip.rotation.x=dampF(m.legR.hip.rotation.x,0.04-Math.sin(t)*sw*0.5,10,dt);
m.legL.knee.rotation.x=dampF(m.legL.knee.rotation.x,0.08,10,dt);
m.legR.knee.rotation.x=dampF(m.legR.knee.rotation.x,0.08,10,dt);
} else if(crouch){
m.legL.hip.rotation.x=dampF(m.legL.hip.rotation.x,-1.05,10,dt);
m.legR.hip.rotation.x=dampF(m.legR.hip.rotation.x,-0.5,10,dt);
m.legL.knee.rotation.x=dampF(m.legL.knee.rotation.x,1.3,10,dt);
m.legR.knee.rotation.x=dampF(m.legR.knee.rotation.x,0.95,10,dt);
} else {
const gait=(ph)=>{
const s2=Math.sin(ph);
const hip=(s2>0?s2*1.0:s2*0.72)*sw*0.85;
const knee=Math.pow(Math.max(0,Math.sin(ph-2.85)),1.15)*1.45*sw+0.07;
return [hip,knee];
};
const [hL,kL]=gait(t),[hR,kR]=gait(t+Math.PI);
m.legL.hip.rotation.x=hL; m.legR.hip.rotation.x=hR;
m.legL.knee.rotation.x=kL; m.legR.knee.rotation.x=kR;
}
}
