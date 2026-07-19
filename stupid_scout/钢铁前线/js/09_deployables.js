'use strict';
const MORTARS=[];
const BUILDS=[]; // 工程兵建造的沙袋墙/铁丝网/拒马/额外机枪
function deployMortar(owner,x,z,yaw){
if(!owner.alive||owner.mortarPlaced||owner.onMortar||owner.mortUse||owner.onVehicle||owner.onMG||owner.onAT||owner.onAA) return false;
const gh=heightAt(x,z);
// 模型整体挂在 grp 下, grp.rotation.y=yaw → 炮口对准架设者视线方向(+Z)
const grp=new THREE.Group();
grp.position.set(x,gh,z); grp.rotation.y=yaw;
world.add(grp);
const base=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.34,0.09,10),vmMats.gun);
base.position.set(0,0.05,-0.1); base.rotation.x=0.08; grp.add(base);
const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.056,0.062,0.78,8),vmMats.gun);
tube.position.set(0,0.42,0.06); tube.rotation.x=0.62; grp.add(tube);
const ring=new THREE.Mesh(new THREE.TorusGeometry(0.064,0.012,6,10),vmMats.gunL);
ring.position.set(0,0.42+Math.cos(0.62)*0.39,0.06+Math.sin(0.62)*0.39);
ring.rotation.x=0.62+HPI; grp.add(ring);
const bipL=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.42,5),vmMats.gunL);
bipL.position.set(-0.15,0.28,0.3); bipL.rotation.z=0.4; bipL.rotation.x=-0.22; grp.add(bipL);
const bipR=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.42,5),vmMats.gunL);
bipR.position.set(0.15,0.28,0.3); bipR.rotation.z=-0.4; bipR.rotation.x=-0.22; grp.add(bipR);
const cross=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,0.32,5),vmMats.gunL);
cross.position.set(0,0.34,0.28); cross.rotation.z=HPI; grp.add(cross);
grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
coverPoints.push({x,z});
MORTARS.push({x,z,y:gh,face:yaw,grp,tube,parts:[],user:null,cd:0,owner,alive:true});
if(owner.isPlayer){ showScorePop('迫击炮已架设 (F 上炮 · B 靠近回收)'); AudioSys.click(800,0.3,0.05); }
owner.mortarPlaced=true;
return true;
}
function recoverMortar(pl){
const m=MORTARS.find(mt=>mt.owner===pl&&mt.alive&&!mt.user&&Math.hypot(mt.x-pl.pos.x,mt.z-pl.pos.z)<3.5);
if(!m){ if(pl.isPlayer&&pl.mortarPlaced) showScorePop('需靠近自己的迫击炮才能回收'); return; }
world.remove(m.grp);
for(const pt of (m.parts||[m.tube])) world.remove(pt);
MORTARS.splice(MORTARS.indexOf(m),1);
pl.mortarPlaced=false;
const w=pl.slots.find(s=>s&&s.def.mortar)||pl.slots[0];
if(w){ w.reserve=Math.min(w.reserve+2,w.def.reserve); }
if(pl.isPlayer){ showScorePop('迫击炮已回收'); AudioSys.click(600,0.22,0.05); }
}
// 迫击炮落点指示圈
const mortarMarker=(()=>{
const g2=new THREE.Group();
const mmat=new THREE.MeshBasicMaterial({color:0xffc866,transparent:true,opacity:0.8,depthWrite:false,side:THREE.DoubleSide,fog:false});
const ring=new THREE.Mesh(new THREE.RingGeometry(0.8,1.02,26),mmat);
ring.rotation.x=-HPI; g2.add(ring);
const dot=new THREE.Mesh(new THREE.CircleGeometry(0.13,10),mmat);
dot.rotation.x=-HPI; dot.position.y=0.01; g2.add(dot);
for(const a of [0,HPI,Math.PI,Math.PI+HPI]){
const tick=new THREE.Mesh(new THREE.PlaneGeometry(0.07,0.34),mmat);
tick.rotation.x=-HPI;
tick.position.set(Math.sin(a)*1.22,0.005,Math.cos(a)*1.22);
tick.rotation.z=-a;
g2.add(tick);
}
g2.visible=false;
scene.add(g2);
return g2;
})();
const BUILD_MENU=['sandbag','wire','hedge','mg'];
const BUILD_NAMES={sandbag:'沙袋墙',wire:'铁丝网',hedge:'拒马',mg:'重机枪'};
const BUILD_COST={sandbag:1,wire:1,hedge:1,mg:3};
const BUILD_TIME={sandbag:2.2,wire:2.2,hedge:1.8,mg:3.4};
// 建造升起动画: 新建工事从地里逐渐升起
const RISERS=[];
function riseNewMeshes(ci,dur=0.85){
for(let i=ci;i<world.children.length;i++){
const m2=world.children[i];
if(!m2||(!m2.isMesh&&!m2.isGroup)) continue;
const ty=m2.position.y;
m2.position.y=ty-1.1;
RISERS.push({m:m2,ty,t:0,dur});
}
}
function updateRisers(dt){
for(let i=RISERS.length-1;i>=0;i--){
const r=RISERS[i]; r.t+=dt;
const k=clamp(r.t/r.dur,0,1), s=k*k*(3-2*k);
r.m.position.y=r.ty-1.1*(1-s);
if(k>=1){ r.m.position.y=r.ty; RISERS.splice(i,1); }
}
}
// 工程兵建造: 按B开始锤击建造, 动画结束后工事落成
function engBuild(pl){
if(VM.state!=='idle') return;
const bc=pl.buildCount||0;
const type=BUILD_MENU[pl.buildSel||0];
const cost=BUILD_COST[type]||1;
if(bc<cost){ showScorePop('建造点数不足 ('+bc+'/'+cost+') — 弹药箱旁按F补给可回满'); return; }
const o=pl.pos.clone(); const dir=camForward(); dir.y=0;
if(dir.lengthSq()<0.1) return;
dir.normalize();
const tx=o.x+dir.x*2.4, tz=o.z+dir.z*2.4;
if(occBlocked(tx,tz)){ showScorePop('此处无法建造'); return; }
const lim=MAP_SIZE/2-4;
if(Math.abs(tx)>lim||Math.abs(tz)>lim){ showScorePop('超出战场边界'); return; }
pl.pendingBuild={type,cost,tx,tz,ry:Math.atan2(dir.x,dir.z)};
VM.state='build'; VM.stateT=0; VM.stateDur=BUILD_TIME[type]||2.2; vmSndFlags={};
showScorePop('建造中: '+BUILD_NAMES[type]+' … (移动取消)');
}
function cancelBuild(pl){
if(!pl.pendingBuild) return;
pl.pendingBuild=null;
if(VM.state==='build'){
VM.state='idle';
if(VM.gunParts) VM.gunParts.gun.visible=true;
if(VM.hammerM) VM.hammerM.visible=false;
vmSndFlags={};
}
}
function engBuildExec(pl){
const tk=pl.pendingBuild; pl.pendingBuild=null;
if(!tk||!pl.alive) return;
if(occBlocked(tk.tx,tk.tz)){ showScorePop('位置被占用, 建造取消'); return; }
const ci=world.children.length;
if(tk.type==='sandbag'){ sandbagWall(tk.tx,tk.tz,4,tk.ry); }
else if(tk.type==='wire'){ barbedWire(tk.tx,tk.tz,tk.ry,4.2,pl); }
else if(tk.type==='hedge'){ hedgehog(tk.tx,tk.tz); }
else if(tk.type==='mg'){ mg42(tk.tx,tk.tz,tk.ry,pl.team); }
riseNewMeshes(ci,0.85);
pl.buildCount=(pl.buildCount||0)-tk.cost;
BUILDS.push({type:tk.type,x:tk.tx,z:tk.tz,builder:pl,t:nowT});
const gy=heightAt(tk.tx,tk.tz);
for(let i=0;i<7;i++) spawnP(PT.dirt,tk.tx+rand(-1.6,1.6),gy+rand(0.1,0.4),tk.tz+rand(-1.6,1.6),rand(-1,1),rand(0.5,1.6),rand(-1,1),rand(0.3,0.5),0.8,rand(0.5,0.9),0.85,2);
if(pl.isPlayer){ showScorePop(BUILD_NAMES[tk.type]+' · 建成 (剩余 '+pl.buildCount+' 点)'); AudioSys.metalSlide(0.25,0.2,300,150); }
markNavDirty();
}
// 铁丝网减速/伤害区域: 每帧检测 combatants (WIRES 专门存储)
let wires=[]; function isWire(x,z){for(const w of wires){if(Math.hypot(w.x-x,w.z-z)<w.r) return w;}return null;}
function updateWires(dt){
if(!wires.length) return;
for(const s of combatants){
if(!s.alive||s.onVehicle||s.onMG||s.onAT||s.onAA||s.onMortar||s.mortUse||s.mgUse||s.empUse) continue;
const w=isWire(s.pos.x,s.pos.z);
if(!w) continue;
s.wireT=nowT;
s.wireTick=(s.wireTick||0)-dt;
if(s.wireTick<=0){
s.wireTick=0.8;
const hostile=!w.builder||w.builder.team!==s.team;
if(hostile){
s.damage(4,(w.builder&&w.builder.alive)?w.builder:null,false);
if(s.isPlayer) AudioSys.hurt();
}
}
}
}

// 架设机枪: 每个旗点一挺, 交替面向两侧基地 (通用)
FLAGS.forEach((f,i)=>{
const tgt=BASES[i%2];
const face=Math.atan2(f.x-tgt.x,f.z-tgt.z);
mg42(f.x+rand(-9,9),f.z+rand(-9,9),face);
});
if(FLAGS.length>=3){
const fm=FLAGS[Math.floor(FLAGS.length/2)];
mg42(fm.x+rand(-14,14),fm.z+rand(-14,14),rand(0,TAU));
}
buildOccupancy();
buildSpatialIndex();
