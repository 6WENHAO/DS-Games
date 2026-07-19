'use strict';
// ===== 死亡视角支持: 眼位缓存 / 名言库 / 渐黑与名言时间线 =====
const _dcEye=new THREE.Vector3(), _dcQ=new THREE.Quaternion();
const _dcFlip=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
const DEATH_QUOTES=[
'"战争没有胜利者，只有不同程度的失败者。" —— 张伯伦',
'"在战争中，无论哪一方自称胜利者，都没有赢家，全是输家。" —— 内维尔·张伯伦',
'"老兵永远不死，只是慢慢凋零。" —— 麦克阿瑟',
'"战争是死神的盛宴。" —— 欧洲谚语',
'"你可能不关心战争，但战争关心你。" —— 托洛茨基',
'"一个人的死是悲剧，一百万人的死是统计数字。" —— 佚名',
'"没有人为祖国而死，都是为了明天而死。" —— 前线士兵日记',
'"子弹是不长眼睛的，但开枪的人长着眼睛。" —— 无名步兵',
'"战场上没有无神论者。" —— 战地记者威廉·卡明斯',
'"当富人们发动战争时，死去的却是穷人。" —— 萨特',
'"勇气不是不恐惧，而是明知恐惧仍然前进。" —— 巴顿',
'"和平时期儿子埋葬父亲，战争时期父亲埋葬儿子。" —— 希罗多德',
'"我不知道第三次世界大战用什么武器，但第四次一定用石头和木棍。" —— 爱因斯坦',
'"死亡不是最可怕的，可怕的是被遗忘。" —— 前线家书',
'"每一颗子弹都有它的归宿。" —— 战壕俗语',
'"士兵的墓碑，是和平最沉重的基石。" —— 佚名',
'"战争结束的方式，从来不是有人赢了，而是有人不打了。" —— 无名军官',
'"雪会盖住弹坑，春天会盖住雪，但没有什么能盖住母亲的眼泪。" —— 东线士兵日记',
'"我们冲锋时喊着口号，倒下时喊着妈妈。" —— 老兵回忆录',
'"活下来的人，替死去的人看完了这场战争。" —— 战地护士手记',
'"钢铁会生锈，土地会愈合，人心的弹孔不会。" —— 佚名',
'"将军们在地图上移动的每一寸，都是士兵用身体丈量的。" —— 前线通讯员',
];
function pickDeathQuote(){
const el2=document.getElementById('deathQuote');
if(!el2) return;
el2.textContent=DEATH_QUOTES[randi(0,DEATH_QUOTES.length-1)];
el2.style.opacity='0';
}
function deathOverlayUpdate(t,dur){
// 视野渐黑
const black=document.getElementById('blackOv');
const k1=clamp((t-(dur-1.7))/1.3,0,1);
black.style.opacity=(k1*k1*0.96).toFixed(3);
// 名言: 1s后淡入, 结尾前淡出
const q=document.getElementById('deathQuote');
if(q){
const fadeIn=clamp((t-1.0)/0.6,0,1);
const fadeOut=1-clamp((t-(dur-0.35))/0.35,0,1);
q.style.opacity=(fadeIn*fadeOut).toFixed(2);
}
// 时间线结束 → 部署界面(与部署冷却并行, 不额外占用冷却时间)
if(t>=dur+0.2&&!player._deployShown&&!player.alive&&!matchOver){
player._deployShown=true;
showDeploy(true);
}
}
function updateCamera(dt){
const p=player;
if(p.chute){
// 跳伞第三人称: 镜头后拉并微微下视, 能看到降落伞和周围环境
const trg=V3(p.pos.x,p.pos.y+0.8,p.pos.z);
const behind=V3(-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch)+0.3,-Math.cos(p.yaw)*Math.cos(p.pitch));
const hit=raycastWorld(trg,behind.clone().negate().normalize(),7.5);
const dd=hit?Math.max(2.8,hit.dist-0.5):6.5;
camera.position.set(trg.x+behind.x*dd, trg.y+behind.y*dd, trg.z+behind.z*dd);
camera.lookAt(trg.x,trg.y,trg.z);
camera.fov=dampF(camera.fov,68,8,dt);
camera.updateProjectionMatrix();
return;
}
if(!p.alive){
// ===== 死亡视角: 摄像机绑进布娃娃头部眼位, 随物理翻滚, 渐黑 + 名言 =====
p.deathCamT-=dt;
const ragOk=p.deathRag&&RAG.list.indexOf(p.deathRag)>=0&&p.deathRag.head&&p.deathRag.head.mesh;
if(ragOk&&p.deathCamDur){
const tSince=p.deathCamDur-p.deathCamT;
const hw=p.deathRag.head.mesh;
hw.updateWorldMatrix(true,false);
// 眼位: 头盒中心偏上偏前(+z为面部朝向)
_dcEye.set(0,0.05,0.1);
hw.localToWorld(_dcEye);
const gmin=heightAt(_dcEye.x,_dcEye.z)+0.06;
if(_dcEye.y<gmin) _dcEye.y=gmin;
camera.position.copy(_dcEye);
// 面部朝向 → 相机朝向(-z), 平滑滤除高频抖动
_dcQ.setFromRotationMatrix(hw.matrixWorld);
_dcQ.multiply(_dcFlip);
camera.quaternion.slerp(_dcQ,1-Math.exp(-9*dt));
camera.fov=dampF(camera.fov,72,8,dt);
camera.updateProjectionMatrix();
deathOverlayUpdate(tSince,p.deathCamDur);
return;
}
// 兜底(无布娃娃): 上帝视角
const t=nowT*0.05;
camera.position.set(Math.sin(t)*80,42,Math.cos(t)*80);
camera.lookAt(0,2,0);
if(p.deathCamDur) deathOverlayUpdate(p.deathCamDur-p.deathCamT,p.deathCamDur);
return;
}
if(p.onVehicle&&p.onVehicle.kind==='apc'){
if(p.playerSeat<0){
// 运兵车司机: 追尾第三人称
const t=p.onVehicle;
camTrauma=Math.max(0,camTrauma-dt*2.2);
const sh=camTrauma*camTrauma*0.04;
const anchor=V3(t.pos.x,t.pos.y+2.4,t.pos.z);
camera.rotation.order='YXZ';
camera.rotation.set(p.pitch+Math.sin(nowT*53)*sh, p.yaw+Math.sin(nowT*67)*sh, 0);
const fwdV=V3(-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch));
const back=fwdV.clone().negate(); back.y+=0.32; back.normalize();
let camD=9;
const hit=raycastWorld(anchor,back,camD);
if(hit) camD=Math.max(2.4,hit.dist-0.5);
camera.position.copy(anchor).addScaledVector(back,camD);
camera.fov=dampF(camera.fov,70,10,dt);
camera.updateProjectionMatrix();
return;
}
// 乘客: 落到常规第一人称(可低头看到车斗)
}
if(p.onVehicle&&p.onVehicle.kind!=='apc'){
const t=p.onVehicle;
camTrauma=Math.max(0,camTrauma-dt*2.2);
const sh=camTrauma*camTrauma*0.04;
if(t.kind==='plane'){
// 飞机追尾视角
const fd=t.fwdDir();
const anchor=V3(t.pos.x,t.pos.y,t.pos.z);
const back=fd.clone().negate(); back.y+=0.34; back.normalize();
camera.position.copy(anchor).addScaledVector(back,13).add(V3(Math.sin(nowT*53)*sh,Math.sin(nowT*67)*sh,0));
camera.lookAt(anchor.x+fd.x*22,anchor.y+fd.y*22,anchor.z+fd.z*22);
camera.fov=dampF(camera.fov,72+t.speed*0.2,6,dt);
camera.updateProjectionMatrix();
return;
}
if(p.tankView){
// 舱内(车长)视角: 隐藏炮管防止穿模
t.pitchG.visible=false;
const a=t.yaw+t.turretYaw;
camera.rotation.order='YXZ';
camera.rotation.set(p.pitch+Math.sin(nowT*53)*sh*0.5, p.yaw+Math.sin(nowT*67)*sh*0.5, 0);
camera.position.set(t.pos.x+Math.sin(a)*1.8, t.pos.y+1.95, t.pos.z+Math.cos(a)*1.8);
camera.fov=dampF(camera.fov,30,10,dt);
camera.updateProjectionMatrix();
document.getElementById('scopeOv').style.display='block';
return;
}
document.getElementById('scopeOv').style.display='none';
if(t.pitchG) t.pitchG.visible=true;
const anchor=V3(t.pos.x,t.pos.y+2.6,t.pos.z);
camera.rotation.order='YXZ';
camera.rotation.set(p.pitch+Math.sin(nowT*53)*sh, p.yaw+Math.sin(nowT*67)*sh, 0);
const fwdV=V3(-Math.sin(p.yaw)*Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw)*Math.cos(p.pitch));
const back=fwdV.clone().negate(); back.y+=0.35; back.normalize();
let camD=10.5;
const hit=raycastWorld(anchor,back,camD);
if(hit) camD=Math.max(2.5,hit.dist-0.5);
camera.position.copy(anchor).addScaledVector(back,camD);
camera.fov=dampF(camera.fov,68,10,dt);
camera.updateProjectionMatrix();
return;
}
const eyeTgt=p.prone?0.48:p.crouch?1.12:1.62;
p.eyeH=dampF(p.eyeH,eyeTgt,12,dt);
let ex=p.pos.x, ey=p.pos.y+p.eyeH, ez=p.pos.z;
const sp2=Math.hypot(p.vel.x,p.vel.z);
if(sp2>0.5&&p.onGround) camBobT+=dt*(p.sprinting?11:7.4)*clamp(sp2/4.2,0.4,1.5);
const bobA=clamp(sp2/4.2,0,1)*(p.ads?0.3:1)*(p.onMG?0:1);
ey+=Math.sin(camBobT*2)*0.021*bobA;
ex+=Math.cos(camBobT)*0.011*bobA*Math.cos(p.yaw);
ez+=Math.cos(camBobT)*0.011*bobA*-Math.sin(p.yaw);
ey-=p.landDip*0.16;
camera.position.set(ex,ey,ez);
camTrauma=Math.max(0,camTrauma-dt*2.2);
const sh=camTrauma*camTrauma*0.05;
const shX=(Math.sin(nowT*67)+Math.sin(nowT*41))*sh;
const shY=(Math.sin(nowT*53)+Math.sin(nowT*31))*sh;
const rollBob=Math.sin(camBobT)*0.006*bobA;
camera.rotation.set(0,0,0);
camera.rotation.order='YXZ';
camera.rotation.y=p.yaw+shY*0.5+p.recoilYaw;
camera.rotation.x=p.pitch+shX*0.5+p.recoilPitch;
camera.rotation.z=rollBob+shX*0.3-p.leanT*0.2;
// 侧身探头(防穿墙)
if(Math.abs(p.leanT)>0.02){
const rx2=Math.cos(p.yaw), rz2=-Math.sin(p.yaw);
const sgn=Math.sign(p.leanT);
let off=Math.abs(p.leanT)*0.45;
const lr=raycastWorld(V3(camera.position.x,camera.position.y,camera.position.z),V3(rx2*sgn,0,rz2*sgn),off+0.25);
if(lr) off=Math.max(0,lr.dist-0.25);
camera.position.x+=rx2*off*sgn;
camera.position.z+=rz2*off*sgn;
camera.position.y-=Math.abs(p.leanT)*0.05;
}
}
