'use strict';
const VM = {
root:new THREE.Group(), sway:new THREE.Group(), inner:new THREE.Group(),
gunParts:null, arms:null, nadeM:null, knifeM:null, bandageM:null, grabitemM:null, reloadRocket:null,
key:null, state:'idle', stateT:0, stateDur:0,
recoilP:0, recoilV:0, kickZ:0, kickV:0,
swayX:0, swayY:0, bobT:0, lastStepSide:1,
adsBlend:0, sprintBlend:0, crouchO:0,
muzzleFlash:null, muzzleLight:null,
};
vmScene.add(VM.root); VM.root.add(VM.sway); VM.sway.add(VM.inner);
{
const mat=new THREE.SpriteMaterial({map:PT.flash,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
VM.muzzleFlash=new THREE.Sprite(mat); VM.muzzleFlash.scale.setScalar(0.16);
VM.inner.add(VM.muzzleFlash);
VM.muzzleLight=new THREE.PointLight(0xffc070,0,3);
VM.inner.add(VM.muzzleLight);
}
const HIP={ pos:V3(0.17,-0.185,-0.38), rot:V3(0.02,0.03,0) };
const HIP_PISTOL={ pos:V3(0.15,-0.16,-0.32), rot:V3(0.02,0.02,0) };
const HIP_ROCKET={ pos:V3(0.15,-0.14,-0.56), rot:V3(0.02,0.04,0) };
function adsPoseFor(key){
const d=WPN_DEFS[key];
if(d.rocket) return { pos:V3(0.052,-0.148,-0.3), rot:V3(0,0,0) };
if(d.atRifle) return { pos:V3(0.05,-0.105,-0.28), rot:V3(0,0.05,0) }; // 反坦克枪: 顶部弹匣挡视线, 侧偏机瞄(同火箭筒)
if(d.scoped) return { pos:V3(0,-0.085,-0.22), rot:V3(0,0,0) };
if(d.pistol) return { pos:V3(0,-0.077,-0.24), rot:V3(0,0,0) };
if(key==='mp40') return { pos:V3(0,-0.062,-0.26), rot:V3(0,0,0) };
if(key==='stg44') return { pos:V3(0,-0.076,-0.26), rot:V3(0,0,0) };
if(key==='thompson') return { pos:V3(0,-0.071,-0.26), rot:V3(0,0,0) };
if(key==='bar') return { pos:V3(0,-0.078,-0.26), rot:V3(0,0,0) };
if(key==='kar98'||key==='m1903') return { pos:V3(0,-0.075,-0.3), rot:V3(0,0,0) };
return { pos:V3(0,-0.077,-0.3), rot:V3(0,0,0) };
}
function vmEquip(key,team){
VM.key=key;
VM.inner.clear();
VM.inner.add(VM.muzzleFlash); VM.inner.add(VM.muzzleLight);
VM.gunParts=buildGunModel(key);
VM.inner.add(VM.gunParts.gun);
VM.arms=buildArms(team);
VM.inner.add(VM.arms.L); VM.inner.add(VM.arms.R);
VM.nadeM=buildNadeModel(team); VM.nadeM.visible=false; VM.inner.add(VM.nadeM);
VM.knifeM=buildKnife(); VM.knifeM.visible=false; VM.inner.add(VM.knifeM);
if(!VM.bandageM) VM.bandageM=buildBandage();
VM.bandageM.visible=false; VM.inner.add(VM.bandageM);
if(!VM.grabitemM) VM.grabitemM=buildGrabItem();
VM.grabitemM.visible=false; VM.inner.add(VM.grabitemM);
if(!VM.hammerM) VM.hammerM=buildHammer();
VM.hammerM.visible=false; VM.inner.add(VM.hammerM);
if(VM.gunParts.reloadRocket) VM.reloadRocket=VM.gunParts.reloadRocket; else VM.reloadRocket=null;
VM.ads=(VM.gunParts.anchors&&VM.gunParts.anchors.ads)||adsPoseFor(key);
// 机瞄校准: 准星柱顶与觇孔齐平(=子弹射线), 统一下拉准星于视野中偏低一点
if(!(WPN_DEFS[key]||{}).scoped&&!WPN_DEFS[key]?.mortar){
VM.ads.pos.y+=0.009;
}
VM.state='draw'; VM.stateT=0; VM.stateDur=0.45;
positionHands(key);
AudioSys.metalSlide(0.18,0.1,700,1400);
}
function buildBandage(){
const g=new THREE.Group();
const mat=new THREE.MeshLambertMaterial({color:0xece4d0});
// 绷带卷: 短粗圆柱(轴向z) + 垂下的布条
const roll=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.026,0.05,12),mat);
roll.rotation.z=HPI; g.add(roll);
const core=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.054,8),new THREE.MeshLambertMaterial({color:0xcfc4a8}));
core.rotation.z=HPI; g.add(core);
const tail=bx(mat,0.004,0.07,0.028, 0,-0.055,0.012,g);
tail.rotation.x=0.25;
return g;
}
function buildGrabItem(){
const g=new THREE.Group();
const b=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.06,0.04),new THREE.MeshLambertMaterial({color:0x8a7a5a}));
g.add(b);
bx(vmMats.wood,0.06,0.015,0.03, 0,0.035,0,g);
return g;
}
function buildHammer(){
const g=new THREE.Group();
bx(vmMats.wood,0.022,0.24,0.022, 0,-0.05,0, g);
bx(vmMats.gun,0.045,0.05,0.1, 0,0.075,0, g);
bx(vmMats.gunL,0.024,0.024,0.026, 0,0.075,0.062, g);
return g;
}
function positionHands(key){
// 锚点系统: 每把枪定义了自己的握持位(握把/护木), 手部精确贴合
const A=VM.gunParts&&VM.gunParts.anchors;
if(A&&A.rHand&&A.lHand){
VM.arms.R.position.copy(A.rHand.pos); VM.arms.R.rotation.set(A.rHand.rot.x,A.rHand.rot.y,A.rHand.rot.z);
VM.arms.L.position.copy(A.lHand.pos); VM.arms.L.rotation.set(A.lHand.rot.x,A.lHand.rot.y,A.lHand.rot.z);
return;
}
const d=WPN_DEFS[key];
if(d.rocket){
VM.arms.R.position.set(0.01,-0.09,0.16); VM.arms.R.rotation.set(0.35,0,0);
VM.arms.L.position.set(-0.02,-0.1,-0.12); VM.arms.L.rotation.set(0.3,-0.05,0);
} else if(d.pistol){
VM.arms.R.position.set(0.015,-0.06,0.13); VM.arms.R.rotation.set(0.25,0,0);
VM.arms.L.position.set(-0.03,-0.08,0.1); VM.arms.L.rotation.set(0.3,0.25,0);
} else {
VM.arms.R.position.set(0.02,-0.07,0.2); VM.arms.R.rotation.set(0.32,0,0);
VM.arms.L.position.set(-0.015,-0.075,-0.2); VM.arms.L.rotation.set(0.28,-0.1,0);
}
}
function ss(t,a,b){ const x=clamp((t-a)/(b-a),0,1); return x*x*(3-2*x); }
function pulse(t,a,b,c){ return t<b? ss(t,a,b) : 1-ss(t,b,c); }
let vmSndFlags={};
function vmPlayOnce(id,fn){ if(!vmSndFlags[id]){ vmSndFlags[id]=true; fn(); } }
function updateViewModel(dt,player){
const d=WPN_DEFS[VM.key]||{};
const w=player.curW;
VM.stateT+=dt;
const t=VM.stateT, T=VM.stateDur, nt=T>0?clamp(t/T,0,1):1;
const adsTgt=(player.ads&&(VM.state==='idle'||VM.state==='fire'||VM.state==='bolt'))?1:0;
VM.adsBlend=dampF(VM.adsBlend,adsTgt,14,dt);
const sprTgt=(player.sprinting&&VM.state==='idle')?1:0;
VM.sprintBlend=dampF(VM.sprintBlend,sprTgt,8,dt);
const hip=d.rocket?HIP_ROCKET:(d.pistol?HIP_PISTOL:HIP);
const px=lerp(hip.pos.x,VM.ads.pos.x,VM.adsBlend);
const py=lerp(hip.pos.y,VM.ads.pos.y,VM.adsBlend);
const pz=lerp(hip.pos.z,VM.ads.pos.z,VM.adsBlend);
let rx=lerp(hip.rot.x,VM.ads.rot.x,VM.adsBlend);
let ry=lerp(hip.rot.y,VM.ads.rot.y,VM.adsBlend);
let rz=0;
rx+=VM.sprintBlend*(d.rocket?0.85:0.5); ry+=VM.sprintBlend*(d.rocket?0.15:0.55); rz-=VM.sprintBlend*(d.rocket?0.05:0.25);
let ox=VM.sprintBlend*(d.rocket?-0.02:-0.04), oy=VM.sprintBlend*(d.rocket?-0.1:-0.05), oz=VM.sprintBlend*(d.rocket?0.06:0.06);
// 蹲/趴/腾空/架设 姿态混合
VM.crouchBlend=dampF(VM.crouchBlend||0,player.crouch?1:0,8,dt);
VM.proneBlend=dampF(VM.proneBlend||0,player.prone?1:0,6,dt);
VM.airBlend=dampF(VM.airBlend||0,player.onGround?0:1,9,dt);
VM.braceBlend=dampF(VM.braceBlend||0,player.braced?1:0,10,dt);
const adsC=1-VM.adsBlend, cb=VM.crouchBlend*adsC, pb=VM.proneBlend, ab=VM.airBlend;
oy-=cb*0.014+pb*0.03*adsC; oz+=cb*0.018+pb*0.03*adsC; rz+=cb*0.05+pb*0.1*adsC; ox-=pb*0.015*adsC;
oy+=ab*0.018; rx-=ab*0.09; rz-=ab*0.04; oz+=ab*0.012;
// 架枪: 枪身沉降贴住支点, 略微外压
const bb=VM.braceBlend;
oz-=bb*0.03; oy-=bb*0.014; rz+=bb*0.028; rx+=bb*0.01; ox+=bb*0.006;
rz+=player.leanT*0.07*(1-VM.adsBlend*0.5); ox+=player.leanT*0.012;
const speed2d=Math.hypot(player.vel.x,player.vel.z);
const moving=speed2d>0.5&&player.onGround;
const bobRate=player.sprinting?11:(player.prone?3:player.crouch?5:7.4);
if(moving) VM.bobT+=dt*bobRate*clamp(speed2d/4.2,0.4,1.6);
const bobA=(moving?1:0)*(player.sprinting?1.7:1)*(1-VM.adsBlend*0.82);
ox+=Math.sin(VM.bobT)*0.011*bobA;
oy+=(-Math.abs(Math.cos(VM.bobT))*0.012+Math.sin(VM.bobT*2)*0.003)*bobA;
rz+=Math.sin(VM.bobT)*0.012*bobA;
const brT=performance.now()*0.001;
const breathMul=((player.holdBreath&&player.ads)?0.12:1)*(1-VM.braceBlend*0.75)*(1-VM.proneBlend*0.5);
oy+=Math.sin(brT*1.4)*0.0022*(1-VM.adsBlend*0.5)*breathMul;
rx+=Math.sin(brT*1.4+0.5)*0.0018*breathMul;
VM.swayX=dampF(VM.swayX,clamp(player.mouseDX,-40,40),10,dt);
VM.swayY=dampF(VM.swayY,clamp(player.mouseDY,-40,40),10,dt);
const swAmt=0.0011*(1-VM.adsBlend*0.75)*(1-bb);
// 常态: 枪随视角拖拽; 架枪: 以前端支点为轴摆动(枪口定住, 枪托随视角甩动)
VM.sway.position.x=-VM.swayX*swAmt+VM.swayX*0.00042*bb;
VM.sway.position.y=VM.swayY*swAmt*0.8;
VM.sway.rotation.y=-VM.swayX*0.0012*bb;
VM.sway.rotation.z=-VM.swayX*0.0006*(1-VM.adsBlend*0.6)*(1-bb*0.8);
VM.sway.rotation.x=VM.swayY*0.0007*(1-VM.adsBlend*0.6)*(1-bb*0.5);
oy-=player.landDip*0.05; rx+=player.landDip*0.12;
VM.recoilV+=(-VM.recoilP*260-VM.recoilV*18)*dt;
VM.recoilP+=VM.recoilV*dt;
VM.kickV+=(-VM.kickZ*220-VM.kickV*16)*dt;
VM.kickZ+=VM.kickV*dt;
rx+=VM.recoilP; oz+=VM.kickZ;
const g=VM.gunParts;
let handLOverride=null, handROverride=null;
if(g.bolt&&!g.boltHandle) g.bolt.position.z=g.bolt.userData.z0??(g.bolt.userData.z0=g.bolt.position.z);
if(g.mag){ g.mag.userData.p0??(g.mag.userData.p0=g.mag.position.clone()); }
if(VM.state==='draw'){
const k=1-ss(nt,0,1);
oy-=k*0.25; rx+=k*0.9; rz+=k*0.3;
if(nt>=1) VM.state='idle';
}
else if(VM.state==='melee'){
const k=pulse(nt,0,0.35,1);
VM.knifeM.visible=true; g.gun.visible=false;
VM.arms.L.visible=false;
VM.knifeM.position.set(0.1-k*0.22,-0.12+k*0.06,-0.25-k*0.28);
VM.knifeM.rotation.set(-k*1.1,0.3-k*0.5,k*0.4);
handROverride={pos:V3(0.1-k*0.2,-0.16+k*0.05,-0.1-k*0.2),rot:V3(0.4-k*1.0,0,0)};
if(nt>0.3) vmPlayOnce('meleeHit',()=>player.doMeleeHit());
if(nt>=1){ VM.state='idle'; VM.knifeM.visible=false; g.gun.visible=true; VM.arms.L.visible=true; vmSndFlags={}; }
}
else if(VM.state==='nade'){
VM.nadeM.visible=true; g.gun.visible=false;
if(player.nadeHeld){
const k=ss(Math.min(t,0.3),0,0.3);
VM.nadeM.position.set(0.14,-0.12+k*0.04,-0.3+k*0.05);
VM.nadeM.rotation.set(0,0,0);
handROverride={pos:V3(0.13,-0.15,-0.22),rot:V3(0.5,0,0)};
handLOverride={pos:V3(-0.1,-0.2,-0.2),rot:V3(0.3,0,0)};
} else {
const k=nt;
const back=pulse(k,0,0.3,0.55), fwd=ss(k,0.35,0.6);
VM.nadeM.position.set(0.14+back*0.1,-0.08+back*0.16-fwd*0.1,-0.3+back*0.25-fwd*0.55);
VM.nadeM.visible=k<0.55;
handROverride={pos:V3(0.13+back*0.08,-0.12+back*0.14-fwd*0.18,-0.18+back*0.2-fwd*0.35),rot:V3(0.5+back*1.2-fwd*2.2,0,0)};
if(k>0.5) vmPlayOnce('nadeThrow',()=>player.releaseNade());
if(nt>=1){ VM.state='idle'; g.gun.visible=true; VM.nadeM.visible=false; vmSndFlags={}; }
}
}
  else if(VM.state==='reload'){
    const k=nt;
    const dip=pulse(k,0,0.15,0.92);
    if(!d.rocket){ rx+=dip*0.32; ry+=dip*0.18; oy-=dip*0.05; rz+=dip*0.1; }
    if(d.rocket){
      // 火箭筒装填: 筒身前倾抬起露出尾部开口 -> 右手取弹对准尾口 -> 沿轴线推入 -> 拍筒
      const tip=pulse(k,0.04,0.22,0.8);
      rx+=tip*0.5; ry-=tip*0.06; rz+=tip*0.06; oz-=tip*0.14; oy-=tip*0.02;
      const rr=g.reloadRocket;
      const fetch=ss(k,0.16,0.42);
      const insert=ss(k,0.46,0.68);
      if(rr){
        rr.visible=k>0.14&&k<0.72;
        rr.position.set(
          lerp(0.2,0,fetch),
          lerp(-0.24,0.058,fetch),
          lerp(0.78,0.64,fetch)-insert*0.4
        );
        rr.rotation.set(lerp(0.55,0,fetch),0,lerp(-0.3,0,fetch));
      }
      if(k>0.16) vmPlayOnce('rrk1',()=>AudioSys.metalSlide(0.14,0.12,400,900));
      if(k>0.46) vmPlayOnce('rrk2',()=>AudioSys.metalSlide(0.18,0.16,600,1200));
      if(k>0.66) vmPlayOnce('rrk3',()=>AudioSys.click(1100,0.3,0.05));
      if(k>0.78) vmPlayOnce('rrk4',()=>AudioSys.metalSlide(0.2,0.08,1400,700));
      handLOverride={pos:V3(-0.04,-0.09,-0.24),rot:V3(0.42,0,0)};
      if(k<0.74&&rr){
        handROverride={pos:V3(rr.position.x+0.015,rr.position.y-0.05,rr.position.z+0.13),rot:V3(-0.5+fetch*0.15-insert*0.25,0,0)};
      } else {
        const pat=Math.max(0,Math.sin((k-0.74)*24))*ss(k,0.74,0.78)*(1-ss(k,0.88,0.96));
        handROverride={pos:V3(0.05,-0.04-pat*0.05,-0.1),rot:V3(-0.2-pat*0.5,0,0)};
      }
    } else if(d.enbloc){
if(g.bolt){ g.bolt.position.z=(g.bolt.userData.z0)+pulse(k,0.05,0.2,0.85)*0.08; }
const cs2=(g.anchors&&g.anchors.clipSlot)||V3(0,0.05,-0.04);
vmPlayOnce('r1',()=>{});
if(k>0.1) vmPlayOnce('r2',()=>AudioSys.metalSlide(0.25,0.09,1000,1800));
if(g.clip){
g.clip.visible=k>0.25&&k<0.62;
const ins=ss(k,0.3,0.6);
g.clip.position.set(cs2.x,cs2.y+(1-ins)*0.1,cs2.z);
}
if(k>0.28&&k<0.62) handROverride={pos:V3(cs2.x+0.025,cs2.y-0.03+(1-ss(k,0.3,0.6))*0.1,cs2.z+0.01),rot:V3(-0.5,0,0)};
if(k>0.58) vmPlayOnce('r3',()=>AudioSys.click(1500,0.3,0.04));
if(k>0.8) vmPlayOnce('r4',()=>AudioSys.metalSlide(0.3,0.07,1400,900));
} else if(d.type==='bolt'){
const bo=pulse(k,0.05,0.22,0.78);
const cs2=(g.anchors&&g.anchors.clipSlot)||V3(0,0.05,0);
if(g.boltHandle) g.boltHandle.rotation.z=bo*-1.1;
if(g.bolt) g.bolt.position.z=(g.bolt.userData.z0??0.05)+pulse(k,0.12,0.3,0.72)*0.09;
if(k>0.08) vmPlayOnce('r1',()=>AudioSys.metalSlide(0.22,0.1,800,1500));
if(g.clip){
g.clip.visible=k>0.3&&k<0.62;
const ins=ss(k,0.34,0.58);
g.clip.position.set(cs2.x,cs2.y+(1-ins)*0.09,cs2.z);
}
if(k>0.32&&k<0.64) handROverride={pos:V3(cs2.x+0.025,cs2.y-0.02+(1-ss(k,0.34,0.58))*0.09,cs2.z+0.015),rot:V3(-0.5,0,0)};
if(k>0.56) vmPlayOnce('r2',()=>AudioSys.click(1300,0.28,0.04));
if(k>0.78) vmPlayOnce('r3',()=>AudioSys.metalSlide(0.25,0.09,1500,800));
} else {
const p0=g.mag?g.mag.userData.p0:null;
const mw=(g.anchors&&g.anchors.magWell)||V3(0,-0.1,-0.13);
const out=pulse(k,0.08,0.3,0.34), inn=ss(k,0.42,0.66);
if(g.mag&&p0){
g.mag.position.set(p0.x, p0.y-out*0.18-(1-inn)*(k>0.36?0.18:0), p0.z+out*0.03);
g.mag.visible=!(k>0.34&&k<0.4);
}
if(k>0.1) vmPlayOnce('r1',()=>AudioSys.click(900,0.22,0.04));
if(k>0.3) vmPlayOnce('r2',()=>AudioSys.metalSlide(0.15,0.08,600,300));
if(k>0.62) vmPlayOnce('r3',()=>AudioSys.click(1400,0.3,0.05));
if(k>0.74){
const ch=pulse(k,0.74,0.84,0.96);
if(g.bolt) g.bolt.position.z=(g.bolt.userData.z0??0)+ch*0.07;
if(g.slide) g.slide.position.z=-0.02+ch*0.055;
vmPlayOnce('r4',()=>AudioSys.metalSlide(0.3,0.1,1200,700));
}
// 左手跟随弹匣井: 拔匣下拉 → 插新匣推入
if(k>0.06&&k<0.7) handLOverride={pos:V3(mw.x-0.012,mw.y-0.025-out*0.15-(1-inn)*(k>0.36?0.15:0),mw.z+0.02),rot:V3(0.5,mw.x<-0.03?0.5:0,0)};
else if(k>=0.7&&k<0.97){
const bh2=(g.anchors&&g.anchors.boltHand);
handLOverride=bh2?{pos:V3(bh2.x-0.01,bh2.y-0.015,bh2.z+0.04),rot:V3(0.3,0,0)}:{pos:V3(0.02,-0.02,-0.05),rot:V3(0.3,0,0)};
}
}
if(nt>=1){ VM.state='idle'; vmSndFlags={}; player.finishReload(); }
}
else if(VM.state==='bolt'){
const k=nt;
rx+=pulse(k,0,0.3,1)*0.14; ry+=pulse(k,0,0.3,1)*0.1;
oy-=pulse(k,0,0.3,1)*0.02;
if(g.boltHandle) g.boltHandle.rotation.z=pulse(k,0.02,0.2,0.85)*-1.1;
if(g.bolt) g.bolt.position.z=(g.bolt.userData.z0??0.05)+pulse(k,0.18,0.4,0.72)*0.09;
// 右手真实抓握拉机柄
{
const bh=(g.anchors&&g.anchors.boltHand)||V3(0.05,0.02,0.07);
const pull=pulse(k,0.18,0.4,0.72)*0.09;
handROverride={pos:V3(bh.x+0.012,bh.y-0.025+pulse(k,0.02,0.25,0.9)*0.02,bh.z+0.05+pull),rot:V3(-0.35,0,0.2)};
}
if(k>0.05) vmPlayOnce('b1',()=>AudioSys.click(1100,0.2,0.03));
if(k>0.3) vmPlayOnce('b2',()=>{
AudioSys.metalSlide(0.22,0.08,900,1600);
const cp=camera.position.clone().add(camForward().multiplyScalar(0.4)).add(camRight().multiplyScalar(0.15));
spawnCasing(cp,camRight(),V3(0,1,0));
});
if(k>0.65) vmPlayOnce('b3',()=>AudioSys.metalSlide(0.22,0.08,1600,900));
if(k>0.88) vmPlayOnce('b4',()=>AudioSys.click(1300,0.22,0.03));
      if(nt>=1){ VM.state='idle'; vmSndFlags={}; }
    }
    else if(VM.state==='bandage'){
      VM.bandageM.visible=true; g.gun.visible=false;
      VM.reloadRocket&&(VM.reloadRocket.visible=false);
      const bk=nt;
      // 整体抬高到视野中部, 避免包扎动作太低几乎看不见
      oy+=0.03; rx+=0.05;
      // 左前臂横抬在胸前, 右手持绷带卷绕臂缠绕
      const armPos=V3(-0.125,-0.038,-0.05), armRotY=1.2;
      handLOverride={pos:armPos,rot:V3(0.12,armRotY,0.08)};
      // 前臂轴向与缠绕平面
      const ax=-Math.sin(armRotY), az=-Math.cos(armRotY);
      const raise=ss(bk,0,0.1);
      // 绷带缠在前臂皮肤段上: 白色包扎环随进度变宽
      let wrap=VM.arms.L.userData.wrap;
      if(!wrap){
        wrap=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.1,10),new THREE.MeshLambertMaterial({color:0xece4d0}));
        wrap.rotation.x=HPI; wrap.position.set(0,0,-0.06);
        VM.arms.L.add(wrap); VM.arms.L.userData.wrap=wrap;
      }
      const prog=ss(bk,0.12,0.88);
      wrap.visible=bk>0.14;
      wrap.scale.set(1,0.22+prog*0.78,1);
      // 绷带卷绕手臂做圆周运动(3圈), 同时沿臂向手腕推进
      const phi=prog*TAU*3;
      const along=0.03+prog*0.05;
      const cx=armPos.x+ax*along, cy=armPos.y+0.005, cz=armPos.z+az*along;
      const ux=-az, uz=ax;
      const R=0.055;
      VM.bandageM.position.set(
        cx+(Math.sin(phi)*ux)*R,
        cy+Math.cos(phi)*R*raise,
        cz+(Math.sin(phi)*uz)*R
      );
      VM.bandageM.rotation.order='YXZ';
      VM.bandageM.rotation.set(phi,armRotY+HPI,0);
      // 右手跟随绷带卷
      handROverride={pos:V3(VM.bandageM.position.x+0.035,VM.bandageM.position.y-0.055,VM.bandageM.position.z+0.05),rot:V3(0.3+Math.cos(phi)*0.25,-0.2,0)};
      if(bk>0.12) vmPlayOnce('bd1',()=>AudioSys.metalSlide(0.07,0.14,320,520));
      if(bk>0.4) vmPlayOnce('bd2',()=>AudioSys.metalSlide(0.06,0.13,300,480));
      if(bk>0.66) vmPlayOnce('bd3',()=>AudioSys.metalSlide(0.06,0.13,340,500));
      if(bk>0.9) vmPlayOnce('bd4',()=>AudioSys.click(900,0.2,0.04));
      // 被打断(受击)提前收起
      const interrupted=player.bandaging<=0&&bk<0.9;
      if(nt>=1||interrupted){
        VM.state='idle'; g.gun.visible=true; VM.bandageM.visible=false;
        wrap.visible=false; vmSndFlags={};
      }
    }
    else if(VM.state==='grab'){
      VM.grabitemM.visible=true; g.gun.visible=false;
      VM.reloadRocket&&(VM.reloadRocket.visible=false);
      const gk=nt;
      const reach=pulse(gk,0,0.3,0.55), back=ss(gk,0.35,0.6);
      VM.grabitemM.position.set(0.02,-0.02-reach*0.15+back*0.05,-0.14-reach*0.25+back*0.15);
      VM.grabitemM.rotation.set(0,gk*1.6,0);
      handROverride={pos:V3(0.1+reach*0.1,-0.06-reach*0.14,-0.1-reach*0.28+back*0.2),rot:V3(0.3+reach*0.8,0,0)};
      handLOverride={pos:V3(-0.04,-0.08,-0.22),rot:V3(0.4,0,0)};
      if(gk>0.45) vmPlayOnce('grab',()=>player.doGrabResolve());
      if(nt>=1){ VM.state='idle'; g.gun.visible=true; VM.grabitemM.visible=false; vmSndFlags={}; }
    }
    else if(VM.state==='build'){
      // 工程锤击建造: 右手抡锤反复敲击, 结束后工事落成
      if(!VM.hammerM){ VM.hammerM=buildHammer(); VM.inner.add(VM.hammerM); }
      VM.hammerM.visible=true; g.gun.visible=false;
      VM.reloadRocket&&(VM.reloadRocket.visible=false);
      const cyc=(VM.stateT*2.6)%1;
      const swing=cyc<0.45? ss(cyc,0.05,0.45) : 1-ss(cyc,0.45,0.72);
      VM.hammerM.position.set(0.09,-0.16+swing*0.2,-0.22);
      VM.hammerM.rotation.set(-0.35-swing*1.05,0.3,0.15);
      handROverride={pos:V3(0.09,-0.17+swing*0.18,-0.14),rot:V3(-0.2-swing*0.95,0.15,0)};
      handLOverride={pos:V3(-0.06,-0.13,-0.2),rot:V3(0.35,0,0)};
      rx+=0.12; oy-=0.02;
      const ki=Math.floor(VM.stateT*2.6);
      if(cyc>0.72) vmPlayOnce('bk'+ki,()=>{
        AudioSys.click(rand(420,560),0.4,0.07);
        AudioSys.metalSlide(0.08,0.05,900,400);
        const pb=player.pendingBuild;
        if(pb){
          const gy2=heightAt(pb.tx,pb.tz);
          for(let i2=0;i2<2;i2++) spawnP(PT.dirt,pb.tx+rand(-0.9,0.9),gy2+rand(0.15,0.5),pb.tz+rand(-0.9,0.9),rand(-0.5,0.5),rand(0.5,1.2),rand(-0.5,0.5),rand(0.2,0.35),0.6,rand(0.4,0.7),0.8,2);
        }
      });
      // 被打断或中途取消
      if(!player.pendingBuild&&nt<1){
        VM.state='idle'; g.gun.visible=true; VM.hammerM.visible=false; vmSndFlags={};
      } else if(nt>=1){
        VM.state='idle'; g.gun.visible=true; VM.hammerM.visible=false; vmSndFlags={};
        engBuildExec(player);
      }
    }
    // 架枪锚定: 支点(护木前端)固定在世界中, 枪身始终指向准星方向,
    // 转动视角时枪绕支点平移摆动; 机瞄时偏移消退, 照门准星自然对齐屏幕中心
    if(VM.braceBlend>0.01&&player.braceYaw!==undefined){
      const pin=VM.braceBlend*(1-VM.adsBlend);
      const rel=clamp(angDiff(player.braceYaw,player.yaw),-0.8,0.8);
      ox+=-Math.sin(rel)*0.45*pin;
      oz+=(Math.cos(rel)-1)*0.45*pin;
    }
    VM.root.position.set(px+ox,py+oy,pz+oz);
VM.root.rotation.set(rx,ry,rz);
positionHands(VM.key);
if(handLOverride){ VM.arms.L.position.copy(handLOverride.pos); VM.arms.L.rotation.set(handLOverride.rot.x,handLOverride.rot.y,handLOverride.rot.z); }
if(handROverride){ VM.arms.R.position.copy(handROverride.pos); VM.arms.R.rotation.set(handROverride.rot.x,handROverride.rot.y,handROverride.rot.z); }
VM.muzzleFlash.material.opacity*=Math.pow(0.0001,dt);
VM.muzzleLight.intensity*=Math.pow(0.0001,dt);
if(VM.gunParts.rocketTip&&player.curW) VM.gunParts.rocketTip.visible=player.curW.mag>0;
const scopedHide=d.scoped&&VM.adsBlend>0.85;
VM.inner.visible=!scopedHide;
document.getElementById('scopeOv').style.display=scopedHide?'block':'none';
const tgtFov=lerp(74, d.adsFov||60, VM.adsBlend)+(player.sprinting?4*VM.sprintBlend:0);
camera.fov=dampF(camera.fov,tgtFov,16,dt);
camera.updateProjectionMatrix();
}
function vmFireKick(){
const d=WPN_DEFS[VM.key];
VM.recoilV+=d.recoil*(2.2+rand(-0.3,0.3));
VM.kickV+=d.kick*22;
VM.muzzleFlash.position.copy(VM.gunParts.muzzle);
VM.muzzleFlash.material.opacity=1;
VM.muzzleFlash.material.rotation=rand(0,TAU);
VM.muzzleFlash.scale.setScalar(rand(0.12,0.2)*(d.snd==='sniper'?1.5:1));
VM.muzzleLight.position.copy(VM.gunParts.muzzle);
VM.muzzleLight.intensity=2.2;
}
const _fwd=V3(), _rgt=V3(), _upv=V3(0,1,0);
function camForward(){ camera.getWorldDirection(_fwd); return _fwd.clone(); }
function camRight(){ camera.getWorldDirection(_fwd); _rgt.crossVectors(_fwd,_upv).normalize(); return _rgt.clone(); }
