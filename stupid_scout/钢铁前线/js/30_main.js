'use strict';
function loop(){
requestAnimationFrame(loop);
if(document.hidden) return;
const now=performance.now();
let dt=Math.min((now-lastT)/1000,0.05);
lastT=now;
nowT=now/1000;
fpsAcc+=1/Math.max(dt,0.001); fpsN++;
if(fpsN>=30){ fpsShow=Math.round(fpsAcc/fpsN); fpsAcc=0; fpsN=0; el('fps').textContent=fpsShow+' FPS'; }
gunEvents=gunEvents.filter(e=>nowT-e.t<0.6);
NAV.budget=2;
updateNavDirty(dt);
updateWires(dt);
updateRisers(dt);
if(MOBILE&&window.updateTouchVis) updateTouchVis();
if(mortarMarker.visible&&!(player.alive&&player.onMortar)) mortarMarker.visible=false;
updatePlayer(dt);
updatePlayerBody(dt);
updateCamera(dt);
updateSunShadow();
// 天空盒跟随相机, 避免远处被远裁剪面切黑
if(SKY) SKY.position.copy(camera.position);
// 小队标记浮动
if(SQUAD.marker&&SQUAD.marker.visible){
SQUAD.marker.position.set(SQUAD.pos.x,heightAt(SQUAD.pos.x,SQUAD.pos.z)+2.1+Math.sin(nowT*2.4)*0.18,SQUAD.pos.z);
}
updateWeather(dt);
updateSmokes(dt);
for(const s of soldiers){
// AI LOD: 远处降低更新频率(隔帧), 但把跳过的时间累积补回, 保证移动速度不变
s.tickAcc+=dt;
s.tickSkip--;
if(!s.alive||s.onVehicle||s.tickSkip<=0){
const useDt=Math.min(s.tickAcc,0.15);
s.update(useDt);
s.tickAcc=0;
const d2p=s.pos.distanceTo(camera.position);
s.tickSkip=d2p>110?3:d2p>60?2:1;
}
}
updateMedCrates(dt);
updateBloodDecals(dt);
for(const t of tanks) t.update(dt);
updateAPCs(dt);
for(const pl of planes) pl.update(dt);
// 树倒动画
for(let i=fTrees.length-1;i>=0;i--){
const ft=fTrees[i];
ft.tilt+=dt*2.6;
if(ft.tilt>=1.45){
ft.tilt=1.45;
for(const m2 of ft.meshes) world.remove(m2);
fTrees.splice(i,1);
continue;
}
const angle=ft.tilt, ax=ft.fallX*angle, az=ft.fallZ*angle;
for(const m2 of ft.meshes){
const dx=m2.position.x-ft.x;
const dz=m2.position.z-ft.z;
const dy=m2.position.y-ft.gy;
const c2=Math.cos(angle), s2=Math.sin(angle);
m2.position.x=ft.x+dx*(c2+ax*ax*(1-c2))+dz*ax*az*(1-c2);
m2.position.z=ft.z+dz*(c2+az*az*(1-c2))+dx*ax*az*(1-c2);
m2.position.y=ft.gy+dy*c2;
m2.rotation.set(0,0,Math.atan2(ft.fallX,ft.fallZ?1:0));
}
}
updatePlaneWrecks(dt);
updateRagdolls(dt);
updateShells(dt);
updateFlak(dt);
updateNades(dt);
updateParticles(dt);
updateTracers(dt);
updateCasings(dt);
updateFlags(dt);
if(flashTimer>0){ flashTimer-=dt; if(flashTimer<=0) flashLight.intensity=0; }
if(player.alive&&player.curW&&!player.onMG&&(!player.onVehicle||isApcPassenger())&&!player.onAT&&!player.onAA&&!player.onMortar){
updateViewModel(dt,player);
} else if(player.alive&&(player.onMG||player.onAT||player.onAA)){
camera.fov=dampF(camera.fov,74,10,dt);
camera.updateProjectionMatrix();
}
player.mouseDX*=Math.pow(0.0001,dt*3);
player.mouseDY*=Math.pow(0.0001,dt*3);
updateHUD(dt);
renderer.clear();
renderer.render(scene,camera);
if(player.alive&&!player.onMG&&VM.root.visible){
renderer.clearDepth();
renderer.render(vmScene,vmCamera);
}
if(!player.alive&&player.deployed&&!matchOver){
respawnCd=Math.max(0,respawnCd-dt);
el('respawnTxt').textContent=respawnCd>0?`(${Math.ceil(respawnCd)})`:'';
const btn=el('deployBtn');
btn.disabled=respawnCd>0;
if(nowT%0.5<0.1) drawDeployMap();
}
}
