'use strict';
function squadMarkerInit(){
if(SQUAD.marker) return;
const c=document.createElement('canvas'); c.width=64; c.height=64;
const g=c.getContext('2d');
g.fillStyle='rgba(255,215,90,.95)';
g.beginPath(); g.moveTo(32,58); g.lineTo(14,28); g.lineTo(50,28); g.closePath(); g.fill();
g.strokeStyle='rgba(0,0,0,.7)'; g.lineWidth=3; g.stroke();
g.fillStyle='rgba(255,215,90,.9)'; g.font='bold 22px sans-serif'; g.textAlign='center';
g.fillText('攻',32,22);
SQUAD.marker=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
SQUAD.marker.scale.set(2.2,2.2,1);
SQUAD.marker.renderOrder=6;
SQUAD.marker.visible=false;
scene.add(SQUAD.marker);
}
function squadOrderMove(){
if(!player.alive||!SQUAD.members.length) return;
const o=camera.position.clone(), d=camForward();
const hit=raycastWorld(o,d,150);
const pt=hit?o.clone().addScaledVector(d,hit.dist):o.clone().addScaledVector(d,90);
pt.y=heightAt(pt.x,pt.z);
SQUAD.mode='move';
SQUAD.pos.copy(pt);
squadMarkerInit();
SQUAD.marker.visible=true;
SQUAD.marker.position.set(pt.x,pt.y+2.1,pt.z);
for(const s of SQUAD.members){ if(s.alive&&!s.onVehicle){ s.decisionT=0; s.repathT=0; s.path=null; } }
showScorePop('小队: 进攻标记位置!');
AudioSys.click(1500,0.3,0.05); AudioSys.click(1100,0.25,0.06);
}
function squadOrderFollow(){
if(!SQUAD.members.length) return;
SQUAD.mode='follow';
if(SQUAD.marker) SQUAD.marker.visible=false;
for(const s of SQUAD.members){ if(s.alive&&!s.onVehicle){ s.decisionT=0; s.repathT=0; } }
showScorePop('小队: 跟我走!');
AudioSys.click(1300,0.3,0.05);
}
const keys={};
let pointerLocked=false;
// 徒手可用判定: 步行状态 或 运兵车乘客(车斗内可用手中武器)
function handsFreeVeh(){ return !player.onVehicle||(typeof isApcPassenger==='function'&&isApcPassenger()); }
// ===== 输入动作抽象层: 键鼠与触控共用同一套动作逻辑 =====
const InputActions={
toggleCrouch(){ // C: 蹲 / 坦克内切换炮手镜
if(player.onVehicle&&player.onVehicle.kind==='tank'){ player.tankView=!player.tankView; }
else { player.crouch=!player.crouch; player.prone=false; }
},
toggleProne(){ // Z: 趴
if(player.onMG||player.onVehicle||player.onAT||player.onAA||player.onMortar) return;
player.prone=!player.prone;
if(player.prone){ player.crouch=false; player.braced=false; }
},
toggleBrace(){ // X: 架枪
if(player.prone) return;
if(player.braced){ player.braced=false; AudioSys.metalSlide(0.18,0.08,500,900); }
else if(player.canBrace){
player.braced=true; player.braceYaw=player.yaw;
AudioSys.metalSlide(0.3,0.13,320,170); AudioSys.click(700,0.3,0.05);
}
},
melee(){ // V: 近战
if(VM.state==='idle'&&!player.onMG&&handsFreeVeh()&&!player.onAT&&!player.onAA&&!player.onMortar&&player.meleeCd<=0){
VM.state='melee'; VM.stateT=0; VM.stateDur=0.5; player.meleeCd=0.7; vmSndFlags={}; AudioSys.metalSlide(0.15,0.06,1200,2000);
}
},
nadeStart(){ // G按下: 拉环(按住烹饪)
if(player.nadeCount>0&&VM.state==='idle'&&!player.onMG&&handsFreeVeh()&&!player.onAT&&!player.onAA&&!player.onMortar){
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=3.8; player.nadeIsAT=false;
vmSndFlags={};
AudioSys.click(1600,0.25,0.04);
}
},
nadeRelease(){ // G松开: 投出
if(player.nadeHeld){
player.nadeHeld=false;
VM.stateT=0; VM.stateDur=0.55;
}
},
throwAT(){ // 3: AT雷
if(player.atNades>0&&VM.state==='idle'&&!player.onMG&&handsFreeVeh()&&!player.onAT&&!player.onAA&&!player.onMortar){
VM.state='nade'; VM.stateT=0; VM.stateDur=0.6;
player.nadeHeld=false; player.nadeIsAT=true;
vmSndFlags={};
AudioSys.click(1200,0.3,0.05);
}
},
throwSmokeOrRocket(){ // 4: 烟雾弹(反坦克兵为切火箭筒)
if(player.cls===5&&VM.state==='idle'){ switchSlot(player.slots.findIndex(s=>s&&s.def.rocket)); }
else InputActions.throwSmoke();
},
throwSmoke(){
if(player.smokeCount>0&&VM.state==='idle'&&!player.onMG&&handsFreeVeh()&&!player.onAT&&!player.onAA&&!player.onMortar){
VM.state='nade'; VM.stateT=0; VM.stateDur=0.6;
player.nadeHeld=false; player.nadeIsAT=false; player.nadeIsSmoke=true;
vmSndFlags={};
AudioSys.click(1000,0.28,0.05);
}
},
bandage(){ // H: 绷带
if(VM.state==='idle'&&player.bandages>0&&player.hp<100&&player.bandaging<=0&&handsFreeVeh()&&!player.onMG&&!player.onAT&&!player.onAA){
player.bandaging=2.6;
VM.state='bandage'; VM.stateT=0; VM.stateDur=2.6;
vmSndFlags={};
showScorePop('包扎中…');
AudioSys.metalSlide(0.14,0.25,400,700);
}
},
classSkill(){ // B: 兵种技能
if(player.cls===6&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){
if(!player.mortarPlaced){
const fd=camForward();fd.y=0;if(fd.lengthSq()<0.1)return;fd.normalize();
deployMortar(player,player.pos.x+fd.x*1.6,player.pos.z+fd.z*1.6,Math.atan2(fd.x,fd.z));
} else recoverMortar(player);
} else if(player.cls===7&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){
engBuild(player);
} else if(player.cls===4&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){
if((player.medkitT||0)<=nowT){
const fd=camForward();fd.y=0;
const ok=fd.lengthSq()>0.1;
if(ok) fd.normalize();
placeMedkit(player,player.pos.x+(ok?fd.x*1.2:0),player.pos.z+(ok?fd.z*1.2:0));
player.medkitT=nowT+30;
} else showScorePop('医疗箱冷却中 ('+Math.ceil(player.medkitT-nowT)+'s)');
}
},
buildNext(){ // 5: 工程兵切换工事
if(player.cls!==7) return;
player.buildSel=((player.buildSel||0)+1)%BUILD_MENU.length;
const bt=BUILD_MENU[player.buildSel];
const bn=bt==='mg'?mgDefOfTeam(player.team).name:BUILD_NAMES[bt];
showScorePop('建造选择: '+bn+' (消耗'+BUILD_COST[bt]+'点'+(MOBILE?'':' · 按B放置')+')');
},
};
addEventListener('keydown',e=>{
if(e.code==='Tab'){ e.preventDefault(); document.getElementById('scoreboard').style.display='block'; updateScoreboard(); }
if(e.repeat) return;
keys[e.code]=true;
if(!player.alive||!pointerLocked) return;
if(e.code==='KeyR') tryReload();
if(e.code==='KeyC') InputActions.toggleCrouch();
if(e.code==='KeyZ') InputActions.toggleProne();
if(e.code==='KeyX') InputActions.toggleBrace();
if(e.code==='Digit1') switchSlot(0);
if(e.code==='Digit2') switchSlot(1);
if(e.code==='KeyV') InputActions.melee();
if(e.code==='KeyG') InputActions.nadeStart();
if(e.code==='Digit3') InputActions.throwAT();
if(e.code==='Digit4') InputActions.throwSmokeOrRocket();
if(e.code==='KeyH') InputActions.bandage();
if(e.code==='KeyB') InputActions.classSkill();
if(e.code==='Digit5') InputActions.buildNext();
if(e.code==='KeyF') tryInteract();
if(e.code==='KeyT') squadOrderMove();
if(e.code==='KeyY') squadOrderFollow();
});
addEventListener('keyup',e=>{
keys[e.code]=false;
if(e.code==='Tab') document.getElementById('scoreboard').style.display='none';
if(e.code==='KeyG') InputActions.nadeRelease();
});
let mouseDown=false, mouse2Down=false;
addEventListener('mousedown',e=>{
if(!pointerLocked){ return; }
if(e.button===0) mouseDown=true;
if(e.button===2){
mouse2Down=true;
if(player.alive&&!player.onMG&&handsFreeVeh()&&!player.onAT&&!player.onAA&&!player.onMortar){
if(SETTINGS.adsToggle) player.ads=!player.ads;
else player.ads=true;
}
}
});
addEventListener('mouseup',e=>{
if(e.button===0) mouseDown=false;
if(e.button===2){ mouse2Down=false; if(!SETTINGS.adsToggle) player.ads=false; }
});
addEventListener('contextmenu',e=>e.preventDefault());
let lockGraceUntil=0; // 修复: 指针锁定切换后浏览器可能给出一次异常巨大的 movementX 导致视角瞬移
addEventListener('mousemove',e=>{
if(!pointerLocked||!player.alive) return;
if(performance.now()<lockGraceUntil) return;
let mx=e.movementX, my=e.movementY;
if(!isFinite(mx)||!isFinite(my)) return;
if(mx>160)mx=160; else if(mx<-160)mx=-160; // 钳制单事件位移, 消除1帧瞬转尖峰
if(my>160)my=160; else if(my<-160)my=-160;
const d=WPN_DEFS[VM.key]||{};
const zoomFac=player.ads?(d.adsFov||60)/74:1;
const s=0.0022*SETTINGS.sens*zoomFac;
player.yaw-=mx*s;
player.pitch-=my*s;
player.pitch=clamp(player.pitch,-1.45,1.45);
player.mouseDX=mx; player.mouseDY=my;
});
document.addEventListener('pointerlockchange',()=>{
if(MOBILE) return;
pointerLocked=document.pointerLockElement===renderer.domElement;
lockGraceUntil=performance.now()+120;
if(!pointerLocked&&player.alive&&player.deployed&&!matchOver){
showDeploy(false);
}
});
function lockPointer(){
if(MOBILE){ pointerLocked=true; return; }
try{ const r=renderer.domElement.requestPointerLock(); if(r&&r.catch) r.catch(()=>{}); }catch(e){}
}
function tryReload(){
const w=player.curW;
if(!w||player.onMG||!handsFreeVeh()||player.onAT||player.onAA) return;
if(VM.state!=='idle') return;
if(w.mag>=w.def.mag||w.reserve<=0) return;
VM.state='reload'; VM.stateT=0; VM.stateDur=w.def.reload;
vmSndFlags={};
}
function switchSlot(i){
if(i===player.curSlot||!player.slots[i]||player.onMG||!handsFreeVeh()||player.onAT||player.onAA) return;
if(VM.state!=='idle'&&VM.state!=='fire') return;
player.curSlot=i;
player.curW=player.slots[i];
vmEquip(player.curW.key,player.team);
}
// ===== 降落伞模型 (玩家跳伞 / Bot 空降) =====
let playerChuteMesh=null;
function chuteLine(g,from,to,mat){
const d=V3(to.x-from.x,to.y-from.y,to.z-from.z);
const len=d.length();
if(len<0.01) return;
const m=new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,len,3),mat);
m.position.set(from.x+d.x*0.5,from.y+d.y*0.5,from.z+d.z*0.5);
m.quaternion.setFromUnitVectors(V3(0,1,0),d.normalize());
g.add(m);
}
function mkChute(scale=1){
const g=new THREE.Group();
const mat=new THREE.MeshLambertMaterial({color:0x9aa08c,side:THREE.DoubleSide});
const canopy=new THREE.Mesh(new THREE.SphereGeometry(2.3,12,7,0,TAU,0,1.05),mat);
canopy.scale.set(1,0.75,1);
canopy.castShadow=true;
g.add(canopy);
const lm=new THREE.MeshBasicMaterial({color:0x33352c});
const rim=2.3*Math.sin(1.05), rimY=2.3*Math.cos(1.05)*0.75;
for(const a of [0.4,1.97,3.54,5.11]){
chuteLine(g,V3(Math.sin(a)*rim,rimY-0.1,Math.cos(a)*rim),V3(0,-3.3,0),lm);
}
g.scale.setScalar(scale);
return g;
}
function mkChuteForBot(){ return mkChute(0.78); }
