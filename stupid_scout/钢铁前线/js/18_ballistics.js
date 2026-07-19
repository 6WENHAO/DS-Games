'use strict';
function fireBullet(shooter,origin,dir,def,visMuzzle){
const maxD=400;
const wr=raycastWorld(origin,dir,maxD);
let wallD=wr?wr.dist:maxD;
// 子弹命中坦克: OBB 精细碰撞(车体/炮塔分体)
let hitTank=null, tankInfo=null;
for(const t of tanks){
if(!t.alive) continue;
if(Math.hypot(t.pos.x-origin.x,t.pos.z-origin.z)>wallD+8) continue;
const r=rayTankParts(origin,dir,wallD,t);
if(r){ wallD=r.t; hitTank=t; tankInfo=r; }
}
// 暴露乘员(敞篷车全员/封闭车探头车长)按步兵判定直接击杀
const cw=rayTankCrew(origin,dir,wallD+0.35,shooter);
// 运兵车车体(软皮): 挡弹并受伤; 车帮以上的乘员由 raySoldiers 判定
let hitApc=null;
for(const a of apcs){
if(!a.alive) continue;
const r=rayCyl(origin,dir,{x:a.pos.x,z:a.pos.z,r:1.6,y0:a.pos.y+0.25,y1:a.pos.y+1.72},wallD);
if(r){ wallD=r.t; hitApc=a; hitTank=null; tankInfo=null; }
}
const sr=raySoldiers(origin,dir,wallD,shooter);
let endD;
if(cw&&(!sr||cw.t<sr.t)){
endD=cw.t;
const hitP=V3(origin.x+dir.x*cw.t,origin.y+dir.y*cw.t,origin.z+dir.z*cw.t);
bloodFX(hitP);
let dmg=def.dmg*(cw.head?def.headMul:1);
if(!shooter.isPlayer) dmg*=DIFF_TABLE[SETTINGS.diff].dmgMul;
cw.cm.hp-=dmg;
if(cw.cm.hp<=0) cw.tank.crewKilled(cw.cm,shooter,cw.head);
else if(shooter.isPlayer) onPlayerHit({isPlayer:false},cw.head);
} else if(sr){
endD=sr.t;
const hitP=V3(origin.x+dir.x*sr.t,origin.y+dir.y*sr.t,origin.z+dir.z*sr.t);
bloodFX(hitP);
let dmg=def.dmg*(sr.head?def.headMul:1);
if(!shooter.isPlayer) dmg*=DIFF_TABLE[SETTINGS.diff].dmgMul;
dmg*=clamp(1-Math.max(0,sr.t-40)/220,0.45,1);
sr.sol.damage(dmg,shooter,sr.head);
if(shooter.isPlayer) onPlayerHit(sr.sol,sr.head);
} else if(hitApc){
endD=wallD;
const hp2=V3(origin.x+dir.x*endD,origin.y+dir.y*endD,origin.z+dir.z*endD);
spawnP(PT.spark,hp2.x,hp2.y,hp2.z,rand(-2,2),rand(1,3),rand(-2,2),0.14,0,rand(0.1,0.16),1,6,true);
if(hitApc.team!==shooter.team){
hitApc.takeDmg(def.vehDmg?def.vehDmg*1.6:def.dmg*0.3,shooter);
if(shooter.isPlayer&&Math.random()<0.15) AudioSys.hitmarkSnd(false);
}
} else if(hitTank){
endD=wallD;
const hp2=V3(origin.x+dir.x*endD,origin.y+dir.y*endD,origin.z+dir.z*endD);
spawnP(PT.spark,hp2.x,hp2.y,hp2.z,rand(-2,2),rand(1,3),rand(-2,2),0.15,0,rand(0.1,0.18),1,6,true);
if(Math.random()<0.3) AudioSys.ricochet(hp2.distanceTo(camera.position));
if(def.vehDmg&&hitTank.team!==shooter.team){
// 反坦克枪: 真实穿深判定(打薄弱面才有效)
const pen=def.atrPen||(def.vehDmg*0.38);
const res=armorSolve(hitTank,tankInfo,pen);
if(res.pen){
hitTank.takeDmg(def.vehDmg,shooter);
// 小口径击穿也有概率击伤乘员
if(Math.random()<0.3&&hitTank.crewMen){
const alive=hitTank.crewMen.filter(c=>c.alive);
if(alive.length) hitTank.crewKilled(alive[randi(0,alive.length-1)],shooter,false);
}
if(shooter.isPlayer){ showScorePop('穿透! '+res.zone); AudioSys.hitmarkSnd(false); }
} else if(shooter.isPlayer&&Math.random()<0.4) showScorePop('未穿透 ('+res.eff+'mm)');
}
} else if(wr){
endD=wr.dist;
impactFX(wr.point,wr.normal,wr.kind);
} else endD=maxD;
if(Math.random()<1/(def.tracer||3)) spawnTracer(origin.clone().addScaledVector(dir,1.2),dir,Math.max(1,endD-1.5));
if(visMuzzle) muzzleFXWorld(visMuzzle,dir);
const dCam=origin.distanceTo(camera.position);
const rv=camRight();
const pan=clamp(rv.dot(V3(origin.x-camera.position.x,0,origin.z-camera.position.z).normalize()),-1,1);
if(!shooter.isPlayer) AudioSys.gunshot(def.snd,dCam,pan*0.7);
if(!shooter.isPlayer&&shooter.team!==player.team&&player.alive){
const relX=player.pos.x-origin.x, relY=player.pos.y+1.5-origin.y, relZ=player.pos.z-origin.z;
const tp=relX*dir.x+relY*dir.y+relZ*dir.z;
if(tp>2&&tp<endD){
const cx=origin.x+dir.x*tp-player.pos.x, cy=origin.y+dir.y*tp-(player.pos.y+1.5), cz=origin.z+dir.z*tp-player.pos.z;
const d2=cx*cx+cy*cy+cz*cz;
if(d2<4){ AudioSys.whizz(); player.suppress(0.35); }
}
}
for(const s of soldiers){
if(!s.alive||s.team===shooter.team) continue;
const relX=s.pos.x-origin.x, relY=s.pos.y+1.4-origin.y, relZ=s.pos.z-origin.z;
const tp=relX*dir.x+relY*dir.y+relZ*dir.z;
if(tp>2&&tp<endD+1){
const cx=origin.x+dir.x*tp-s.pos.x, cy=origin.y+dir.y*tp-(s.pos.y+1.4), cz=origin.z+dir.z*tp-s.pos.z;
if(cx*cx+cy*cy+cz*cz<6){ s.suppression=Math.min(1.6,s.suppression+0.35); s.noticeThreat(shooter); }
}
}
gunEvents.push({x:origin.x,z:origin.z,team:shooter.team,t:nowT,shooter});
shooter.lastFiredT=nowT;
}
const nades=[];
const nadeGeoUS=new THREE.SphereGeometry(0.06,8,6);
const nadeGeoGER=new THREE.CylinderGeometry(0.035,0.035,0.24,8);
const nadeGeoAT=new THREE.CylinderGeometry(0.06,0.075,0.3,8);
const nadeGeoSmoke=new THREE.CylinderGeometry(0.048,0.048,0.13,8);
const smokeCanMat=new THREE.MeshLambertMaterial({color:0x8a9088});
function throwNade(thrower,origin,vel,fuse,at,smoke){
const m=new THREE.Mesh(smoke?nadeGeoSmoke:(at?nadeGeoAT:(TEAM_FACTION[thrower.team].nade==='egg'?nadeGeoUS:nadeGeoGER)),smoke?smokeCanMat:(at?vmMats.gunL:vmMats.nade));
m.castShadow=true;
m.position.copy(origin);
scene.add(m);
nades.push({m,pos:origin.clone(),vel:vel.clone(),fuse:fuse!==undefined?fuse:3.4,thrower,team:thrower.team,spin:V3(rand(-6,6),rand(-6,6),rand(-6,6)),bounces:0,at:!!at,smokeN:!!smoke});
}
function updateNades(dt){
for(let i=nades.length-1;i>=0;i--){
const n=nades[i];
n.fuse-=dt;
if(n.fuse<=0){
scene.remove(n.m);
nades.splice(i,1);
nadeExplode(n);
continue;
}
n.vel.y-=9.8*dt;
const nx=n.pos.x+n.vel.x*dt, ny=n.pos.y+n.vel.y*dt, nz=n.pos.z+n.vel.z*dt;
let bounced=false;
for(const b of BOXES){
if(nx>b.minX-0.06&&nx<b.maxX+0.06&&ny>b.minY-0.06&&ny<b.maxY+0.06&&nz>b.minZ-0.06&&nz<b.maxZ+0.06){
const dl=Math.min(nx-b.minX,b.maxX-nx), dv=Math.min(ny-b.minY,b.maxY-ny), dd=Math.min(nz-b.minZ,b.maxZ-nz);
if(dv<=dl&&dv<=dd){ n.vel.y*=-0.4; n.vel.x*=0.7; n.vel.z*=0.7; }
else if(dl<=dd){ n.vel.x*=-0.5; } else { n.vel.z*=-0.5; }
bounced=true;
break;
}
}
// 手雷与坦克互动: 可以落在车体上随车滑动, 敞篷车可掉进战斗舱内
let onTank=null;
for(const t of tanks){
if(!t.alive) continue;
const dx2=nx-t.pos.x, dz2=nz-t.pos.z;
if(dx2*dx2+dz2*dz2>16) continue;
const snt=Math.sin(-t.yaw), cst=Math.cos(-t.yaw);
const lx=dx2*cst+dz2*snt, lz=-dx2*snt+dz2*cst;
const hz2=t.def.hullL/2+0.2;
if(Math.abs(lx)<2.1&&Math.abs(lz)<hz2){
const deckY=t.pos.y+(t.def.openTop?1.6:1.75);
// 敞篷: 落入战斗室 → 直接在舱内起爆
if(t.def.openTop&&t.team!==n.team&&Math.abs(lx)<1.1&&ny<t.pos.y+2.4&&Math.abs(lz-(t.def.casemate?-0.3:0))<1.5){
n.fuse=Math.min(n.fuse,0.02);
n.insideTank=t;
onTank=t;
break;
}
if(ny<=deckY+0.1&&n.vel.y<0){
// 停在车体顶面, 跟随坦克移动
n.pos.y=deckY+0.06;
n.vel.y*=-0.25;
n.vel.x=t.vel*Math.sin(t.yaw)*0.9; n.vel.z=t.vel*Math.cos(t.yaw)*0.9;
n.restTank=t;
bounced=true;
onTank=t;
}
}
break;
}
if(n.at||n.bomb||n.mortar){
for(const t of tanks){
if(!t.alive||t.team===n.team) continue;
if(Math.hypot(nx-t.pos.x,nz-t.pos.z)<2.6&&ny<t.pos.y+2.6){ n.fuse=0; bounced=false; break; }
}
}
const gh=heightAt(nx,nz);
if(ny<=gh+0.05){
n.pos.y=gh+0.05;
if(n.vel.y<-0.5) bounced=true;
n.vel.y*=-0.38;
n.vel.x*=0.68; n.vel.z*=0.68;
n.spin.multiplyScalar(0.6);
}
n.pos.set(nx,Math.max(ny,gh+0.05),nz);
if(bounced&&(n.at||n.bomb||n.mortar)){ n.fuse=Math.min(n.fuse,0.02); }
else if(bounced&&n.bounces++<4) AudioSys.nadeBounce(n.pos.distanceTo(camera.position));
n.m.position.copy(n.pos);
n.m.rotation.x+=n.spin.x*dt; n.m.rotation.y+=n.spin.y*dt; n.m.rotation.z+=n.spin.z*dt;
if(n.team!==player.team&&player.alive&&n.pos.distanceTo(player.pos)<7) nadeWarnT=0.2;
}
}
function nadeExplode(n){
if(n.smokeN){
spawnSmokeCloud(n.pos);
return;
}
// 掉进敞篷战斗舱: 舱内爆炸 → 重创车辆并杀伤全部乘员
if(n.insideTank&&n.insideTank.alive){
const t=n.insideTank;
explosionFXSmall(n.pos);
AudioSys.explosion(n.pos.distanceTo(camera.position));
if(t.crewMen) for(const cm of t.crewMen){ if(cm.alive) t.crewKilled(cm,n.thrower,false); }
t.takeDmg(n.at?520:420,n.thrower);
if(n.thrower&&n.thrower.isPlayer) showScorePop('手雷入舱!');
return;
}
// 停在车体顶面起爆: 按顶部装甲判定
if(n.restTank&&n.restTank.alive&&n.restTank.team!==n.team){
const t=n.restTank;
const pen=n.at?90:24;
const top=(t.def.armor&&t.def.armor.top)||14;
explosionFXSmall(n.pos);
AudioSys.explosion(n.pos.distanceTo(camera.position));
if(pen>top){
t.takeDmg(n.at?400:170,n.thrower);
if(n.thrower&&n.thrower.isPlayer) showScorePop('顶部击穿!');
} else {
t.takeDmg(30,n.thrower);
}
splashDamage(n.pos,n.thrower,n.team,4,80,0);
return;
}
if(n.mortar){
explosionFXSmall(n.pos);
AudioSys.explosion(n.pos.distanceTo(camera.position)*0.85);
splashDamage(n.pos,n.thrower,n.team,7.5,135,150);
damageStructures(n.pos,7,210);
crater(n.pos.x,n.pos.z,1.3,true);
return;
}
if(n.at){
spawnP(PT.flash,n.pos.x,n.pos.y+0.4,n.pos.z,0,2,0,2.4,15,0.14,1,0,true);
for(let i=0;i<7;i++) spawnP(PT.dark,n.pos.x,n.pos.y+0.4,n.pos.z,rand(-2,2),rand(1,4),rand(-2,2),1.0,2.4,rand(0.8,1.4),0.85,0.6);
AudioSys.explosion(n.pos.distanceTo(camera.position));
splashDamage(n.pos,n.thrower,n.team,5,95,340);
damageStructures(n.pos,5,130);
crater(n.pos.x,n.pos.z,1.1,true);
} else if(n.bomb){
explosionFX(n.pos);
AudioSys.explosion(n.pos.distanceTo(camera.position)*0.7);
splashDamage(n.pos,n.thrower,n.team,9.5,170,260);
damageStructures(n.pos,9,340);
explodeAt(n.pos,n.thrower);
} else {
explodeAt(n.pos,n.thrower);
}
}
function explodeAt(p,attacker){
explosionFX(p);
AudioSys.explosion(p.distanceTo(camera.position));
damageStructures(p,4.5,45);
for(const s of combatants){
if(!s.alive||s.onVehicle) continue;
const d=Math.hypot(s.pos.x-p.x,(s.pos.y+0.9)-p.y,s.pos.z-p.z);
if(d<9){
const dir=V3(s.pos.x-p.x,s.pos.y+0.9-p.y,s.pos.z-p.z).normalize();
const block=raycastWorld(V3(p.x,p.y+0.25,p.z),dir,d);
let dmg=(1-d/9)*135;
if(block&&block.dist<d-0.5) dmg*=0.25;
if(s.team===attacker.team&&s!==attacker) dmg*=0.0;
if(dmg>2){
s.damage(dmg,attacker,false);
if(s.isPlayer){ addTrauma(clamp(dmg/60,0.3,1)); }
}
}
if(s.isPlayer){
const d2=p.distanceTo(camera.position);
if(d2<20) addTrauma(clamp(1.2-d2/22,0.1,0.9));
}
}
for(const s of soldiers){
if(!s.alive) continue;
if(Math.hypot(s.pos.x-p.x,s.pos.z-p.z)<40&&attacker.team!==s.team) s.noticeThreat(attacker);
}
}
