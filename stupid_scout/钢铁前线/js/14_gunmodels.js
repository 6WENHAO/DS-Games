'use strict';
// ===================== 枪械模型库 (全部独立建模) =====================
// 每把枪独立设计: 独特机匣/枪托/护木/弹匣/机瞄样式, 并输出锚点系统:
// parts.anchors = {
//   ads:{pos,rot}   开镜姿态(照门-准星线精确对准屏幕中心)
//   rHand/lHand     双手常态握持位(握把/护木)
//   magWell         弹匣井(换弹时左手目标)
//   boltHand        拉机柄(拉栓时右手目标)
//   clipSlot        漏夹/桥夹装填口
// }
function bx(mat,w,h,d,x,y,z,g){
const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
m.position.set(x,y,z); if(g) g.add(m); return m;
}
function cyl(mat,r1,r2,h,x,y,z,g,rx=HPI){
const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,10),mat);
m.position.set(x,y,z); m.rotation.x=rx; if(g) g.add(m); return m;
}
function ringM(mat,r,t,x,y,z,g){
const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,6,12),mat);
m.position.set(x,y,z); if(g) g.add(m); return m;
}
// ---------- 机瞄部件族 ----------
// 片状准星 (手枪/冲锋枪)
function sFront_blade(G,m,x,y,z){ bx(m,0.006,0.022,0.006, x,y+0.011,z,G); return y+0.020; }
// 麦粒+斜护翼 (毛瑟/中正/三八)
function sFront_wings(G,m,x,y,z){
bx(m,0.005,0.02,0.006, x,y+0.010,z,G);
const l=bx(m,0.004,0.02,0.008, x-0.014,y+0.008,z,G); l.rotation.z=0.42;
const r=bx(m,0.004,0.02,0.008, x+0.014,y+0.008,z,G); r.rotation.z=-0.42;
return y+0.018;
}
// 带全护罩准星 (M1/91-30/PPSh)
function sFront_hood(G,m,x,y,z){
bx(m,0.005,0.02,0.006, x,y+0.010,z,G);
ringM(m,0.013,0.0022, x,y+0.013,z,G);
return y+0.018;
}
// 觇孔照门+护耳 (M1系/汤普森)
function sRear_peep(G,m,x,y,z){
ringM(m,0.0075,0.0028, x,y+0.014,z,G);
bx(m,0.0055,0.026,0.014, x-0.0135,y+0.010,z,G);
bx(m,0.0055,0.026,0.014, x+0.0135,y+0.010,z,G);
return y+0.014;
}
// V型缺口照门片 (毛瑟/莫辛表尺后座)
function sRear_notch(G,m,x,y,z){
bx(m,0.013,0.010,0.005, x-0.0115,y+0.008,z,G);
bx(m,0.013,0.010,0.005, x+0.0115,y+0.008,z,G);
bx(m,0.034,0.004,0.005, x,y+0.002,z,G);
return y+0.012;
}
// 弧形表尺底座 (栓动步枪中段)
function sTangent(G,m,x,y,z){
bx(m,0.030,0.006,0.05, x,y,z,G);
const leaf=bx(m,0.026,0.003,0.044, x,y+0.006,z,G); leaf.rotation.x=-0.12;
bx(m,0.028,0.005,0.008, x,y+0.004,z+0.018,G);
}
// 瞄准镜: 返回镜心高度
function scopeTube(G,x,y,z,len=0.13,r=0.019){
const gl=vmMats.gunL, gm=vmMats.gun;
cyl(gl,r,r,len, x,y,z,G);
cyl(gl,r+0.005,r,0.028, x,y,z-len/2-0.008,G);
cyl(gl,r+0.005,r,0.028, x,y,z+len/2+0.008,G);
cyl(gm,0.006,0.006,0.014, x,y+r+0.005,z,G,0);
cyl(gm,0.006,0.006,0.014, x+r+0.005,y,z,G,Math.PI/2).rotation.z=HPI;
bx(gm,0.010,0.024,0.024, x,y-r-0.008,z-len*0.28,G);
bx(gm,0.010,0.024,0.024, x,y-r-0.008,z+len*0.28,G);
return y;
}
// 栓动拉栓组: 返回 {bolt, handle, knobPos}
function boltAssembly(G,x,y,z,bent){
const gl=vmMats.gunL;
const boltG=new THREE.Group(); boltG.position.set(x,y,z); G.add(boltG);
cyl(gl,0.011,0.011,0.1, 0,0,0,boltG);
const handle=new THREE.Group(); boltG.add(handle);
const hh=cyl(gl,0.007,0.007,0.05, 0.024,bent?-0.012:0,0.02,handle,0);
hh.rotation.z=bent?1.15:HPI;
const knob=new THREE.Mesh(new THREE.SphereGeometry(0.0125,8,6),gl);
knob.position.set(bent?0.044:0.048,bent?-0.024:0,0.02); handle.add(knob);
return {bolt:boltG,handle,knob:V3(x+(bent?0.044:0.048),y+(bent?-0.024:0),z+0.02)};
}
function mkAnchors(parts,o){
parts.anchors=Object.assign({
ads:{pos:V3(0,-0.07,-0.3),rot:V3(0,0,0)},
rHand:{pos:V3(0.02,-0.07,0.2),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.015,-0.075,-0.2),rot:V3(0.28,-0.1,0)},
magWell:null, boltHand:null, clipSlot:null,
},o);
return parts;
}
const ADSROT0=V3(0,0,0);
function adsFromSight(sx,sy,zoff){ return {pos:V3(-sx,-sy,zoff),rot:ADSROT0}; }
function buildGunModel(key){
const G=new THREE.Group();
const parts={gun:G, muzzle:V3(0,0.032,-0.62)};
const wd=vmMats.wood, wdD=vmMats.woodD, gm=vmMats.gun, gl=vmMats.gunL, pk=vmMats.park, bs=vmMats.brass;
// ============ 美军 ============
if(key==='garand'){
// M1 加兰德: 整体木托+上护木, 导气管, 觇孔照门, 漏夹
bx(wd,0.052,0.075,0.60, 0,-0.012,-0.10,G);
bx(wd,0.048,0.035,0.34, 0,0.043,-0.26,G);
bx(wd,0.05,0.1,0.24, 0,-0.06,0.20,G).rotation.x=-0.22;
cyl(pk,0.011,0.011,0.30, 0,0.032,-0.55,G);
cyl(pk,0.009,0.009,0.34, 0,-0.002,-0.52,G);
bx(pk,0.05,0.048,0.24, 0,0.035,0.02,G);
bx(pk,0.024,0.02,0.05, 0,0.03,0.15,G);
const fy=sFront_hood(G,pk,0,0.052,-0.685);
const ry2=sRear_peep(G,pk,0,0.048,0.10);
parts.bolt=bx(gl,0.022,0.02,0.09, 0.03,0.045,0.0,G);
parts.clip=bx(bs,0.022,0.05,0.055, 0,0.05,0.0);
parts.clip.visible=false; G.add(parts.clip);
parts.muzzle.set(0,0.032,-0.71);
mkAnchors(parts,{
ads:adsFromSight(0,0.0605,-0.27),
rHand:{pos:V3(0.02,-0.065,0.19),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.07,-0.30),rot:V3(0.28,-0.1,0)},
magWell:V3(0,0.05,0.0), clipSlot:V3(0,0.05,0.0), boltHand:V3(0.045,0.045,0.0),
});
} else if(key==='m1carb'){
// M1 卡宾枪: 短小轻便, 15发直弹匣, 觇孔
bx(wd,0.046,0.065,0.46, 0,-0.012,-0.02,G);
bx(wd,0.044,0.03,0.24, 0,0.036,-0.15,G);
bx(wd,0.046,0.09,0.2, 0,-0.055,0.18,G).rotation.x=-0.2;
cyl(pk,0.009,0.009,0.26, 0,0.03,-0.38,G);
bx(pk,0.044,0.04,0.16, 0,0.032,0.05,G);
bx(pk,0.02,0.014,0.05, 0,0.028,0.13,G);
parts.mag=bx(pk,0.022,0.11,0.045, 0,-0.075,-0.05,G);
const fy=sFront_wings(G,pk,0,0.048,-0.49);
sRear_peep(G,pk,0,0.045,0.08);
parts.bolt=bx(gl,0.018,0.016,0.06, 0.028,0.04,0.02,G);
parts.muzzle.set(0,0.03,-0.52);
mkAnchors(parts,{
ads:adsFromSight(0,0.058,-0.26),
rHand:{pos:V3(0.02,-0.06,0.17),rot:V3(0.3,0,0)},
lHand:{pos:V3(-0.012,-0.062,-0.2),rot:V3(0.26,-0.08,0)},
magWell:V3(0,-0.075,-0.05), boltHand:V3(0.04,0.04,0.02),
});
} else if(key==='thompson'){
// 汤普森 M1A1: 方正机匣, 平置护木, 库茨制退器, 觇孔护耳
bx(pk,0.05,0.062,0.32, 0,0.012,-0.06,G);
bx(pk,0.046,0.03,0.06, 0,-0.028,-0.2,G);
cyl(pk,0.0125,0.0125,0.30, 0,0.026,-0.36,G);
cyl(gl,0.019,0.019,0.07, 0,0.026,-0.50,G);
for(let i=0;i<3;i++) bx(gl,0.042,0.004,0.008, 0,0.038,-0.48-i*0.016,G);
bx(wd,0.045,0.09,0.2, 0,-0.058,0.20,G).rotation.x=-0.2;
bx(wd,0.038,0.075,0.055, 0,-0.062,0.045,G);
bx(wd,0.042,0.05,0.14, 0,-0.055,-0.30,G);
parts.mag=bx(pk,0.025,0.15,0.055, 0,-0.10,-0.10,G);
sFront_blade(G,pk,0,0.05,-0.52);
sRear_peep(G,pk,0,0.046,0.06);
parts.bolt=bx(gl,0.016,0.016,0.05, 0.033,0.045,-0.04,G);
parts.muzzle.set(0,0.026,-0.55);
mkAnchors(parts,{
ads:adsFromSight(0,0.058,-0.25),
rHand:{pos:V3(0.02,-0.075,0.12),rot:V3(0.34,0,0)},
lHand:{pos:V3(-0.01,-0.085,-0.28),rot:V3(0.3,-0.08,0)},
magWell:V3(0,-0.10,-0.10), boltHand:V3(0.045,0.045,-0.04),
});
} else if(key==='bar'){
// BAR M1918A2: 厚重机匣, 长枪管+消焰器, 两脚架, 表尺照门
bx(wd,0.055,0.075,0.28, 0,-0.008,0.10,G);
bx(pk,0.055,0.062,0.36, 0,0.014,-0.20,G);
bx(pk,0.05,0.03,0.08, 0,-0.03,-0.10,G);
cyl(pk,0.013,0.013,0.42, 0,0.03,-0.56,G);
cyl(gl,0.017,0.014,0.06, 0,0.03,-0.78,G);
bx(wd,0.05,0.1,0.2, 0,-0.055,0.26,G).rotation.x=-0.2;
bx(wd,0.048,0.045,0.12, 0,-0.02,-0.36,G);
parts.mag=bx(pk,0.028,0.13,0.065, 0,-0.095,-0.14,G);
sFront_wings(G,pk,0,0.052,-0.79);
sRear_notch(G,pk,0,0.052,-0.02);
sTangent(G,pk,0,0.048,-0.05);
cyl(gl,0.007,0.007,0.24, 0.032,-0.05,-0.70,G,0.32);
cyl(gl,0.007,0.007,0.24, -0.032,-0.05,-0.70,G,0.32);
cyl(gl,0.006,0.006,0.03, 0.032,-0.145,-0.795,G,0);
cyl(gl,0.006,0.006,0.03, -0.032,-0.145,-0.795,G,0);
parts.bolt=bx(gl,0.02,0.02,0.06, 0.038,0.028,-0.14,G);
parts.muzzle.set(0,0.03,-0.82);
mkAnchors(parts,{
ads:adsFromSight(0,0.064,-0.26),
rHand:{pos:V3(0.02,-0.06,0.22),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.06,-0.34),rot:V3(0.26,-0.08,0)},
magWell:V3(0,-0.095,-0.14), boltHand:V3(0.05,0.028,-0.14),
});
} else if(key==='springfield'||key==='m1903'){
// 春田 M1903(A4): 细长毛瑟系, A4型装 M73B1 瞄准镜
bx(wd,0.048,0.068,0.68, 0,-0.012,-0.12,G);
bx(wd,0.046,0.028,0.3, 0,0.036,-0.30,G);
bx(wd,0.05,0.098,0.24, 0,-0.056,0.24,G).rotation.x=-0.2;
cyl(gm,0.010,0.010,0.36, 0,0.03,-0.60,G);
bx(gm,0.045,0.04,0.2, 0,0.032,0.02,G);
bx(gm,0.05,0.018,0.04, 0,0.006,-0.44,G);
const ba=boltAssembly(G,0.024,0.038,0.06,false);
parts.bolt=ba.bolt; parts.boltHandle=ba.handle;
parts.clip=bx(bs,0.02,0.055,0.05, 0,0.05,0.0);
parts.clip.visible=false; G.add(parts.clip);
let adsA;
if(key==='springfield'){
const sy=scopeTube(G,0,0.088,0.0,0.15,0.017);
adsA=adsFromSight(0,sy,-0.22);
} else {
sFront_blade(G,gm,0,0.052,-0.765);
sRear_peep(G,gm,0,0.05,0.10);
sTangent(G,gm,0,0.044,-0.12);
adsA=adsFromSight(0,0.062,-0.29);
}
parts.muzzle.set(0,0.03,-0.79);
mkAnchors(parts,{
ads:adsA,
rHand:{pos:V3(0.02,-0.06,0.20),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.068,-0.3),rot:V3(0.26,-0.08,0)},
boltHand:ba.knob, clipSlot:V3(0,0.05,0.0), magWell:V3(0,0.05,0.0),
});
} else if(key==='m1911'){
// 柯尔特 M1911: 平直套筒+外露击锤+斜握把
bx(gm,0.03,0.045,0.17, 0,0.014,-0.01,G);
parts.slide=bx(gl,0.032,0.03,0.185, 0,0.048,-0.015,G);
for(let i=0;i<4;i++) bx(gm,0.034,0.014,0.003, 0,0.044,0.062+i*0.007,G);
bx(gm,0.008,0.016,0.012, 0,0.052,0.085,G).rotation.x=0.5;
bx(wdD,0.034,0.085,0.048, 0,-0.038,0.052,G).rotation.x=-0.28;
parts.mag=bx(gm,0.022,0.07,0.034, 0,-0.05,0.045,G);
parts.mag.rotation.x=-0.28;
bx(gm,0.012,0.008,0.03, 0,-0.012,-0.045,G);
cyl(gm,0.007,0.007,0.02, 0,0.032,-0.105,G);
sFront_blade(G,gl,0,0.063,-0.095);
sRear_notch(G,gl,0,0.062,0.07);
parts.muzzle.set(0,0.045,-0.13);
mkAnchors(parts,{
ads:adsFromSight(0,0.072,-0.24),
rHand:{pos:V3(0.012,-0.055,0.115),rot:V3(0.25,0,0)},
lHand:{pos:V3(-0.028,-0.075,0.09),rot:V3(0.3,0.25,0)},
magWell:V3(0,-0.05,0.045),
});
} else if(key==='bazooka'||key==='schreck'){
// 反坦克火箭筒 (巴祖卡M9 / 坦克杀手RPzB54)
const isBz=key==='bazooka';
const tubeMat=new THREE.MeshLambertMaterial({color:isBz?0x4a5238:0x52524a});
const tubeR=isBz?0.046:0.056;
cyl(tubeMat,tubeR,tubeR,1.35, 0,0.06,-0.22,G);
cyl(gm,tubeR+0.008,tubeR+0.004,0.07, 0,0.06,-0.86,G);
cyl(gm,tubeR+0.008,tubeR+0.004,0.07, 0,0.06,0.4,G);
if(isBz){
cyl(gm,tubeR+0.014,tubeR+0.002,0.05, 0,0.06,-0.885,G);
bx(gm,0.02,0.012,0.5, 0,-0.0,-0.2,G);
} else {
cyl(gm,tubeR+0.024,tubeR+0.004,0.09, 0,0.06,-0.89,G);
const shield=bx(gl,0.26,0.2,0.012, 0.06,0.01,-0.4,G);
shield.rotation.y=0.06;
}
const sx=-0.052;
bx(gm,0.008,0.034,0.01, sx,0.093,-0.6,G);
bx(gm,0.005,0.028,0.005, sx,0.134,-0.6,G);
bx(gm,0.004,0.04,0.005, sx-0.02,0.135,-0.605,G);
bx(gm,0.004,0.04,0.005, sx+0.02,0.135,-0.605,G);
bx(gm,0.044,0.004,0.005, sx,0.157,-0.605,G);
bx(gm,0.01,0.045,0.012, sx,0.098,0.08,G);
bx(gm,0.004,0.034,0.006, sx-0.017,0.148,0.08,G);
bx(gm,0.004,0.034,0.006, sx+0.017,0.148,0.08,G);
bx(gm,0.038,0.004,0.006, sx,0.167,0.08,G);
bx(gm,0.038,0.004,0.006, sx,0.129,0.08,G);
bx(wd,0.036,0.09,0.05, 0,-0.035,0.1,G).rotation.x=-0.18;
bx(wd,0.036,0.08,0.05, 0,-0.03,-0.18,G).rotation.x=-0.1;
bx(gm,0.028,0.04,0.1, 0,0.005,0.1,G);
bx(gm,0.01,0.03,0.014, 0,-0.015,0.16,G);
const rkt=cyl(vmMats.gunL,0.03,0.014,0.16, 0,0.06,-0.92,G);
parts.rocketTip=rkt;
const rr=new THREE.Group();
const rktMat=new THREE.MeshLambertMaterial({color:0x55603e});
cyl(rktMat,0.026,0.026,0.2, 0,0,0.02,rr);
cyl(vmMats.gunL,0.026,0.003,0.09, 0,0,-0.12,rr);
bx(gm,0.003,0.055,0.05, 0,0,0.13,rr);
bx(gm,0.055,0.003,0.05, 0,0,0.13,rr);
rr.visible=false;
G.add(rr);
parts.reloadRocket=rr;
parts.muzzle.set(0,0.06,-0.95);
mkAnchors(parts,{
ads:{pos:V3(0.052,-0.148,-0.3),rot:ADSROT0},
rHand:{pos:V3(0.01,-0.09,0.16),rot:V3(0.35,0,0)},
lHand:{pos:V3(-0.02,-0.1,-0.12),rot:V3(0.3,-0.05,0)},
});
}
// ============ 德军 ============
else if(key==='kar98'||key==='kar98zf'){
// 毛瑟 Kar98k: 短步枪, 下弯拉机柄, 麦粒护翼准星, 表尺; ZF41 低倍镜
bx(wd,0.05,0.07,0.66, 0,-0.012,-0.10,G);
bx(wd,0.048,0.028,0.26, 0,0.036,-0.24,G);
bx(wd,0.05,0.1,0.24, 0,-0.056,0.24,G).rotation.x=-0.2;
cyl(gm,0.010,0.010,0.34, 0,0.03,-0.57,G);
bx(gm,0.046,0.042,0.2, 0,0.03,0.0,G);
bx(gm,0.05,0.02,0.035, 0,0.004,-0.42,G);
cyl(gm,0.005,0.005,0.16, 0,-0.014,-0.63,G);
bx(gm,0.03,0.03,0.02, 0,-0.02,0.36,G);
const ba=boltAssembly(G,0.024,0.038,0.05,true);
parts.bolt=ba.bolt; parts.boltHandle=ba.handle;
parts.clip=bx(bs,0.02,0.055,0.05, 0,0.05,0.0);
parts.clip.visible=false; G.add(parts.clip);
sFront_wings(G,gm,0,0.05,-0.72);
let adsA;
if(key==='kar98zf'){
const sy=scopeTube(G,0,0.086,0.02,0.11,0.015);
adsA=adsFromSight(0,sy,-0.22);
} else {
sRear_notch(G,gm,0,0.048,-0.14);
sTangent(G,gm,0,0.043,-0.17);
adsA=adsFromSight(0,0.059,-0.30);
}
parts.muzzle.set(0,0.03,-0.75);
mkAnchors(parts,{
ads:adsA,
rHand:{pos:V3(0.02,-0.06,0.20),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.068,-0.28),rot:V3(0.26,-0.08,0)},
boltHand:ba.knob, clipSlot:V3(0,0.05,0.0), magWell:V3(0,0.05,0.0),
});
} else if(key==='g33'){
// G33/40 山地骑枪: 更短的毛瑟, 大孔背带槽
bx(wd,0.05,0.07,0.54, 0,-0.012,-0.05,G);
bx(wd,0.048,0.026,0.2, 0,0.035,-0.17,G);
bx(wd,0.05,0.098,0.22, 0,-0.055,0.22,G).rotation.x=-0.2;
cyl(gm,0.010,0.010,0.28, 0,0.03,-0.44,G);
bx(gm,0.046,0.042,0.18, 0,0.03,0.02,G);
bx(gm,0.05,0.018,0.03, 0,0.004,-0.32,G);
const ba=boltAssembly(G,0.024,0.038,0.06,true);
parts.bolt=ba.bolt; parts.boltHandle=ba.handle;
parts.clip=bx(bs,0.02,0.055,0.05, 0,0.05,0.01);
parts.clip.visible=false; G.add(parts.clip);
sFront_wings(G,gm,0,0.048,-0.56);
sRear_notch(G,gm,0,0.047,-0.10);
sTangent(G,gm,0,0.042,-0.13);
parts.muzzle.set(0,0.03,-0.59);
mkAnchors(parts,{
ads:adsFromSight(0,0.057,-0.29),
rHand:{pos:V3(0.02,-0.06,0.19),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.066,-0.24),rot:V3(0.26,-0.08,0)},
boltHand:ba.knob, clipSlot:V3(0,0.05,0.01), magWell:V3(0,0.05,0.01),
});
} else if(key==='mp40'){
// MP40: 冲压机匣, 胶木护木, 折叠托, 树脂托座, 前伸弹匣井
bx(gm,0.042,0.052,0.26, 0,0.012,-0.05,G);
cyl(gm,0.011,0.011,0.26, 0,0.024,-0.32,G);
cyl(gm,0.0145,0.013,0.03, 0,0.024,-0.455,G);
bx(vmMats.bakelite,0.044,0.055,0.1, 0,-0.008,0.075,G);
bx(vmMats.bakelite,0.036,0.07,0.05, 0,-0.058,0.10,G).rotation.x=-0.15;
// 折叠托(展开): 两根杆+肩板
cyl(gl,0.006,0.006,0.22, 0.018,0.006,0.24,G);
cyl(gl,0.006,0.006,0.22, -0.018,0.006,0.24,G);
bx(gl,0.05,0.06,0.014, 0,-0.01,0.355,G);
// 弹匣井+长弹匣
bx(gm,0.028,0.05,0.06, 0,-0.045,-0.13,G);
parts.mag=bx(gm,0.021,0.15,0.05, 0,-0.125,-0.13,G);
bx(gm,0.02,0.014,0.03, 0,-0.006,-0.44,G); // 枪管下挂钩
sFront_hood(G,gm,0,0.043,-0.45);
sRear_notch(G,gm,0,0.042,-0.02);
parts.bolt=bx(gl,0.014,0.014,0.045, -0.028,0.026,-0.10,G);
parts.muzzle.set(0,0.024,-0.48);
mkAnchors(parts,{
ads:adsFromSight(0,0.052,-0.25),
rHand:{pos:V3(0.018,-0.075,0.13),rot:V3(0.34,0,0)},
lHand:{pos:V3(-0.012,-0.10,-0.125),rot:V3(0.4,0,0)},
magWell:V3(0,-0.125,-0.13), boltHand:V3(-0.04,0.026,-0.10),
});
} else if(key==='stg44'){
// STG44: 冲压长机匣, 高耸准星座, 弯弹匣, 木托
bx(gm,0.048,0.06,0.34, 0,0.008,-0.10,G);
bx(gm,0.05,0.028,0.12, 0,-0.032,-0.02,G);
cyl(gm,0.012,0.012,0.24, 0,0.028,-0.39,G);
cyl(gm,0.010,0.008,0.03, 0,0.028,-0.525,G);
bx(wd,0.045,0.085,0.2, 0,-0.045,0.24,G).rotation.x=-0.12;
bx(vmMats.bakelite,0.038,0.075,0.055, 0,-0.068,0.06,G).rotation.x=-0.1;
bx(gm,0.03,0.032,0.09, 0,-0.03,-0.155,G);
parts.mag=bx(gm,0.024,0.17,0.06, 0,-0.115,-0.17,G);
parts.mag.rotation.x=0.3;
// 高耸三角准星座 + 护罩
bx(gm,0.014,0.03,0.02, 0,0.048,-0.50,G);
sFront_hood(G,gm,0,0.066,-0.50);
sTangent(G,gm,0,0.052,-0.10);
sRear_notch(G,gm,0,0.058,-0.06);
parts.bolt=bx(gl,0.016,0.016,0.05, 0.032,0.02,-0.18,G);
parts.muzzle.set(0,0.028,-0.545);
mkAnchors(parts,{
ads:adsFromSight(0,0.070,-0.26),
rHand:{pos:V3(0.018,-0.08,0.10),rot:V3(0.35,0,0)},
lHand:{pos:V3(-0.012,-0.075,-0.24),rot:V3(0.3,-0.05,0)},
magWell:V3(0,-0.115,-0.17), boltHand:V3(0.04,0.02,-0.18),
});
} else if(key==='p38'){
// 瓦尔特 P38: 外露枪管+短套筒+击锤
cyl(gm,0.0105,0.0105,0.10, 0,0.042,-0.115,G);
bx(gm,0.03,0.042,0.14, 0,0.016,0.0,G);
parts.slide=bx(gl,0.033,0.028,0.13, 0,0.048,0.01,G);
bx(gm,0.008,0.014,0.01, 0,0.05,0.078,G).rotation.x=0.4;
bx(wdD,0.032,0.08,0.046, 0,-0.036,0.05,G).rotation.x=-0.25;
parts.mag=bx(gm,0.02,0.065,0.032, 0,-0.048,0.045,G);
parts.mag.rotation.x=-0.25;
bx(gm,0.014,0.01,0.04, 0,-0.008,-0.04,G);
sFront_blade(G,gl,0,0.055,-0.155);
sRear_notch(G,gl,0,0.060,0.062);
parts.muzzle.set(0,0.042,-0.17);
mkAnchors(parts,{
ads:adsFromSight(0,0.068,-0.24),
rHand:{pos:V3(0.012,-0.052,0.11),rot:V3(0.25,0,0)},
lHand:{pos:V3(-0.028,-0.072,0.085),rot:V3(0.3,0.25,0)},
magWell:V3(0,-0.048,0.045),
});
}
// ============ 苏军 ============
else if(key==='mosin'||key==='mosinpu'){
// 莫辛-纳甘 91/30: 极长枪身, 直拉机柄, 通条, 护罩准星; PU 短镜+下弯柄
const pu=key==='mosinpu';
bx(wd,0.046,0.065,0.78, 0,-0.012,-0.15,G);
bx(wd,0.044,0.026,0.42, 0,0.034,-0.33,G);
bx(wd,0.048,0.095,0.24, 0,-0.055,0.26,G).rotation.x=-0.18;
cyl(gm,0.0095,0.0095,0.30, 0,0.028,-0.66,G);
cyl(gl,0.005,0.005,0.5, 0,-0.018,-0.52,G);
bx(gl,0.05,0.018,0.04, 0,0.004,-0.54,G);
bx(gl,0.05,0.018,0.04, 0,0.004,-0.26,G);
bx(gm,0.044,0.04,0.18, 0,0.028,0.0,G);
bx(gm,0.028,0.05,0.1, 0,-0.045,0.02,G); // 突出弹仓
const ba=boltAssembly(G,0.022,0.036,0.06,pu);
parts.bolt=ba.bolt; parts.boltHandle=ba.handle;
parts.clip=bx(bs,0.02,0.055,0.05, 0,0.05,0.02);
parts.clip.visible=false; G.add(parts.clip);
sFront_hood(G,gm,0,0.048,-0.795);
let adsA;
if(pu){
const sy=scopeTube(G,0,0.085,0.03,0.115,0.016);
adsA=adsFromSight(0,sy,-0.22);
} else {
sRear_notch(G,gm,0,0.046,-0.20);
sTangent(G,gm,0,0.041,-0.23);
adsA=adsFromSight(0,0.056,-0.30);
}
parts.muzzle.set(0,0.028,-0.83);
mkAnchors(parts,{
ads:adsA,
rHand:{pos:V3(0.02,-0.06,0.22),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.066,-0.32),rot:V3(0.26,-0.08,0)},
boltHand:ba.knob, clipSlot:V3(0,0.05,0.02), magWell:V3(0,0.05,0.02),
});
} else if(key==='m38carb'){
// 莫辛 M38 骑枪: 短款, 无刺刀
bx(wd,0.046,0.065,0.56, 0,-0.012,-0.06,G);
bx(wd,0.044,0.024,0.3, 0,0.033,-0.2,G);
bx(wd,0.048,0.093,0.22, 0,-0.054,0.24,G).rotation.x=-0.18;
cyl(gm,0.0095,0.0095,0.24, 0,0.028,-0.44,G);
bx(gm,0.044,0.04,0.16, 0,0.028,0.02,G);
bx(gm,0.028,0.05,0.09, 0,-0.043,0.04,G);
const ba=boltAssembly(G,0.022,0.036,0.07,false);
parts.bolt=ba.bolt; parts.boltHandle=ba.handle;
parts.clip=bx(bs,0.02,0.055,0.05, 0,0.05,0.03);
parts.clip.visible=false; G.add(parts.clip);
sFront_hood(G,gm,0,0.046,-0.55);
sRear_notch(G,gm,0,0.044,-0.12);
parts.muzzle.set(0,0.028,-0.58);
mkAnchors(parts,{
ads:adsFromSight(0,0.054,-0.29),
rHand:{pos:V3(0.02,-0.058,0.21),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.064,-0.24),rot:V3(0.26,-0.08,0)},
boltHand:ba.knob, clipSlot:V3(0,0.05,0.03), magWell:V3(0,0.05,0.03),
});
} else if(key==='ppsh'){
// 波波沙 PPSh-41: 斜切散热护筒, 71发弹鼓, 木托
bx(wd,0.05,0.075,0.3, 0,-0.02,0.16,G);
bx(gm,0.046,0.06,0.24, 0,0.015,-0.05,G);
// 护筒(斜切口制退)
cyl(gm,0.019,0.019,0.36, 0,0.028,-0.30,G);
for(let i=0;i<6;i++){ bx(gm,0.042,0.008,0.02, 0,0.028,-0.16-i*0.055,G); }
const cut=bx(gm,0.04,0.026,0.03, 0,0.036,-0.475,G); cut.rotation.x=0.6;
parts.mag=cyl(gm,0.062,0.062,0.05, 0,-0.068,-0.06,G,0); // 弹鼓(圆面朝左右)
parts.mag.rotation.z=HPI;
bx(gm,0.02,0.02,0.05, 0,-0.02,-0.06,G);
sFront_hood(G,gm,0,0.049,-0.455);
sRear_notch(G,gm,0,0.048,0.03);
parts.bolt=bx(gl,0.015,0.015,0.05, 0.028,0.032,-0.02,G);
parts.muzzle.set(0,0.028,-0.49);
mkAnchors(parts,{
ads:adsFromSight(0,0.058,-0.25),
rHand:{pos:V3(0.02,-0.075,0.14),rot:V3(0.34,0,0)},
lHand:{pos:V3(-0.03,-0.09,-0.06),rot:V3(0.35,0.15,0)},
magWell:V3(0,-0.068,-0.06), boltHand:V3(0.04,0.032,-0.02),
});
} else if(key==='dp28'){
// DP-28: 平放弹盘, 长导气管, 锥形消焰器, 两脚架
bx(wd,0.045,0.07,0.24, 0,-0.015,0.24,G);
bx(gm,0.05,0.06,0.3, 0,0.008,0.0,G);
cyl(gm,0.013,0.013,0.4, 0,0.024,-0.40,G);
cyl(gm,0.008,0.008,0.36, 0,-0.006,-0.38,G);
cyl(gm,0.024,0.015,0.07, 0,0.024,-0.625,G);
parts.mag=cyl(gm,0.075,0.075,0.02, 0,0.049,-0.02,G,0); // 弹盘平放
cyl(gm,0.012,0.012,0.008, 0,0.061,-0.02,G,0); // 弹盘中心盖
cyl(gl,0.007,0.007,0.22, 0.03,-0.06,-0.56,G,0.35);
cyl(gl,0.007,0.007,0.22, -0.03,-0.06,-0.56,G,0.35);
bx(wdD,0.036,0.07,0.05, 0,-0.062,0.10,G);
sFront_hood(G,gm,0,0.055,-0.60);
sRear_notch(G,gm,0,0.062,0.10);
parts.muzzle.set(0,0.024,-0.66);
mkAnchors(parts,{
ads:adsFromSight(0,0.070,-0.27),
rHand:{pos:V3(0.018,-0.075,0.13),rot:V3(0.34,0,0)},
lHand:{pos:V3(-0.012,-0.055,-0.30),rot:V3(0.28,-0.08,0)},
magWell:V3(0,0.049,-0.02), boltHand:V3(0.04,0.0,0.04),
});
} else if(key==='tt33'){
// 托卡列夫 TT-33: 细长圆滑套筒, 后座槽纹
bx(gm,0.028,0.04,0.15, 0,0.016,0.0,G);
parts.slide=bx(gl,0.03,0.028,0.165, 0,0.046,-0.005,G);
for(let i=0;i<5;i++) bx(gm,0.032,0.016,0.0025, 0,0.044,0.055+i*0.006,G);
cyl(gm,0.009,0.009,0.03, 0,0.042,-0.095,G);
bx(wdD,0.03,0.075,0.042, 0,-0.035,0.048,G).rotation.x=-0.22;
parts.mag=bx(gm,0.019,0.062,0.03, 0,-0.046,0.042,G);
parts.mag.rotation.x=-0.22;
sFront_blade(G,gl,0,0.06,-0.09);
sRear_notch(G,gl,0,0.058,0.058);
parts.muzzle.set(0,0.042,-0.12);
mkAnchors(parts,{
ads:adsFromSight(0,0.068,-0.24),
rHand:{pos:V3(0.012,-0.05,0.105),rot:V3(0.25,0,0)},
lHand:{pos:V3(-0.028,-0.07,0.08),rot:V3(0.3,0.25,0)},
magWell:V3(0,-0.046,0.042),
});
} else if(key==='ptrd'){
// PTRD-41: 单发超长, 方形制退器, 管状托+缓冲垫, 提把
bx(gm,0.05,0.065,0.3, 0,0.005,0.08,G);
cyl(gm,0.015,0.015,0.72, 0,0.03,-0.60,G);
bx(gm,0.065,0.048,0.075, 0,0.03,-0.985,G);
bx(gm,0.02,0.058,0.06, 0,0.03,-1.01,G);
cyl(gl,0.012,0.012,0.3, 0,0.012,0.24,G);
bx(gl,0.05,0.09,0.03, 0,0.0,0.40,G); // 肩垫
bx(wdD,0.034,0.07,0.05, 0,-0.06,0.10,G);
bx(gl,0.012,0.05,0.012, 0.0,0.075,-0.32,G); // 提把立柱
bx(gl,0.012,0.014,0.1, 0,0.105,-0.32,G);
cyl(gl,0.008,0.008,0.3, 0.04,-0.075,-0.62,G,0.3);
cyl(gl,0.008,0.008,0.3, -0.04,-0.075,-0.62,G,0.3);
const ba=boltAssembly(G,0.026,0.048,0.0,false);
parts.bolt=ba.bolt; parts.boltHandle=ba.handle;
// 机瞄偏左置
sFront_blade(G,gm,-0.035,0.055,-0.86);
sRear_notch(G,gm,-0.035,0.052,-0.14);
parts.muzzle.set(0,0.03,-1.05);
mkAnchors(parts,{
ads:adsFromSight(-0.035,0.063,-0.28),
rHand:{pos:V3(0.02,-0.055,0.14),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.05,-0.30),rot:V3(0.26,-0.08,0)},
boltHand:ba.knob,
});
}
// ============ 日军 ============
else if(key==='arisaka'||key==='type97s'||key==='type38c'){
// 三八式: 防尘盖拉栓, 菊纹机匣, 翼形准星; 九七式狙击型镜偏左; 骑枪短款
const snip=key==='type97s', carb=key==='type38c';
const L=carb?0.60:0.78;
bx(wd,0.046,0.066,L, 0,-0.01,-(L*0.5-0.26),G);
bx(wd,0.044,0.026,L*0.42, 0,0.034,-(L*0.42),G);
bx(wd,0.048,0.095,0.24, 0,-0.055,0.26,G).rotation.x=-0.18;
cyl(gm,0.0095,0.0095,carb?0.2:0.3, 0,0.028,carb?-0.5:-0.62,G);
bx(gl,0.036,0.032,0.14, 0,0.04,0.03,G); // 防尘盖
cyl(gl,0.012,0.012,0.02, 0,0.048,-0.03,G,0); // 菊纹圆盘
bx(gm,0.044,0.038,0.16, 0,0.026,0.02,G);
const ba=boltAssembly(G,0.02,0.042,0.06,false);
parts.bolt=ba.bolt; parts.boltHandle=ba.handle;
parts.clip=bx(bs,0.02,0.05,0.05, 0,0.05,0.03);
parts.clip.visible=false; G.add(parts.clip);
const fz=carb?-0.61:-0.77;
sFront_wings(G,gm,0,0.048,fz);
let adsA;
if(snip){
const sy=scopeTube(G,-0.036,0.075,0.02,0.12,0.016);
adsA=adsFromSight(-0.036,sy,-0.22);
} else {
sRear_notch(G,gm,0,0.047,-0.13);
sTangent(G,gm,0,0.042,-0.16);
adsA=adsFromSight(0,0.056,-0.30);
}
parts.muzzle.set(0,0.028,fz-0.03);
mkAnchors(parts,{
ads:adsA,
rHand:{pos:V3(0.02,-0.058,0.22),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.064,carb?-0.22:-0.30),rot:V3(0.26,-0.08,0)},
boltHand:ba.knob, clipSlot:V3(0,0.05,0.03), magWell:V3(0,0.05,0.03),
});
} else if(key==='type100'){
// 一〇〇式: 左侧横插弯弹匣, 穿孔护筒, 直木托
bx(wd,0.046,0.07,0.4, 0,-0.016,0.14,G);
bx(gm,0.042,0.052,0.26, 0,0.014,-0.10,G);
cyl(gm,0.017,0.017,0.32, 0,0.026,-0.34,G);
for(let i=0;i<10;i++){ cyl(gl,0.004,0.004,0.006, 0.017*Math.cos(i*0.63),0.026+0.017*Math.sin(i*0.63),-0.26-((i%5)*0.05),G,0); }
// 左侧横插弯匣
const mg2=new THREE.Group(); mg2.position.set(-0.055,0.016,-0.10); mg2.rotation.z=-0.12; G.add(mg2);
bx(gm,0.11,0.024,0.045, -0.05,0,0,mg2);
bx(gm,0.06,0.024,0.045, -0.125,-0.015,0,mg2).rotation.z=0.5;
parts.mag=mg2;
bx(gm,0.024,0.036,0.05, -0.033,0.014,-0.10,G);
sFront_wings(G,gm,0,0.046,-0.47);
sRear_peep(G,gm,0,0.044,0.0);
parts.bolt=bx(gl,0.014,0.014,0.045, 0.028,0.026,-0.08,G);
parts.muzzle.set(0,0.026,-0.51);
mkAnchors(parts,{
ads:adsFromSight(0,0.056,-0.25),
rHand:{pos:V3(0.018,-0.07,0.15),rot:V3(0.34,0,0)},
lHand:{pos:V3(-0.012,-0.06,-0.24),rot:V3(0.3,-0.06,0)},
magWell:V3(-0.11,0.01,-0.10), boltHand:V3(0.04,0.026,-0.08),
});
} else if(key==='type96'){
// 九六式轻机枪: 顶置弯弹匣, 提把, 机瞄偏右
bx(wd,0.045,0.07,0.26, 0,-0.012,0.24,G);
bx(gm,0.05,0.062,0.34, 0,0.008,-0.02,G);
cyl(gm,0.014,0.014,0.4, 0,0.026,-0.38,G);
for(let i=0;i<8;i++) cyl(gl,0.0165,0.0165,0.012, 0,0.026,-0.24-i*0.04,G);
cyl(gm,0.02,0.013,0.05, 0,0.026,-0.60,G);
// 顶置弯匣
const mg2=new THREE.Group(); mg2.position.set(0,0.115,-0.08); G.add(mg2);
bx(gm,0.023,0.15,0.05, 0,0.0,0,mg2); mg2.rotation.x=-0.3; mg2.rotation.z=0.05;
parts.mag=mg2;
// 提把(可倒)
bx(wdD,0.012,0.016,0.09, -0.045,0.075,0.06,G);
bx(gl,0.01,0.05,0.012, -0.045,0.045,0.02,G).rotation.x=0.4;
cyl(gl,0.007,0.007,0.2, 0.03,-0.055,-0.52,G,0.35);
cyl(gl,0.007,0.007,0.2, -0.03,-0.055,-0.52,G,0.35);
bx(wdD,0.036,0.07,0.05, 0,-0.06,0.12,G);
// 机瞄偏右(避开顶匣)
sFront_wings(G,gm,0.032,0.044,-0.60);
sRear_peep(G,gm,0.032,0.042,0.04);
parts.bolt=bx(gl,0.015,0.015,0.05, 0.034,0.018,-0.12,G);
parts.muzzle.set(0,0.026,-0.63);
mkAnchors(parts,{
ads:adsFromSight(0.032,0.054,-0.26),
rHand:{pos:V3(0.02,-0.062,0.20),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.02,-0.075,-0.02),rot:V3(0.34,0.1,0)},
magWell:V3(0,0.115,-0.08), boltHand:V3(0.045,0.018,-0.12),
});
} else if(key==='nambu'){
// 南部十四年式: 细长枪管, 圆形后拉机钮, 大扳机护圈
bx(gm,0.026,0.042,0.13, 0,0.018,0.01,G);
cyl(gm,0.009,0.009,0.13, 0,0.04,-0.115,G);
cyl(gl,0.015,0.015,0.02, 0,0.036,0.075,G,0);
cyl(gl,0.017,0.017,0.012, 0,0.036,0.088,G,0); // 圆拉机钮
ringM(gm,0.017,0.004, 0,-0.005,-0.015,G); // 大护圈(冬手套用)
bx(wdD,0.026,0.08,0.046, 0,-0.042,0.045,G).rotation.x=-0.38;
parts.mag=bx(gm,0.018,0.058,0.03, 0,-0.048,0.038,G);
parts.mag.rotation.x=-0.38;
sFront_blade(G,gl,0,0.052,-0.17);
sRear_notch(G,gl,0,0.052,0.055);
parts.muzzle.set(0,0.04,-0.185);
mkAnchors(parts,{
ads:adsFromSight(0,0.062,-0.24),
rHand:{pos:V3(0.012,-0.052,0.10),rot:V3(0.28,0,0)},
lHand:{pos:V3(-0.026,-0.07,0.075),rot:V3(0.3,0.25,0)},
magWell:V3(0,-0.048,0.038),
});
} else if(key==='type97at'){
// 九七式自动炮: 20mm半自动, 顶匣, 双脚架+肩托架
bx(gm,0.055,0.075,0.42, 0,0.0,0.06,G);
cyl(gm,0.017,0.017,0.7, 0,0.03,-0.58,G);
cyl(gm,0.028,0.045,0.09, 0,0.03,-0.95,G);
bx(gm,0.05,0.06,0.14, 0,0.0,0.3,G);
bx(gl,0.06,0.09,0.02, 0,-0.01,0.38,G);
const mg2=bx(gm,0.026,0.12,0.06, 0,0.115,-0.04,G); mg2.rotation.x=-0.1;
parts.mag=mg2;
bx(wdD,0.034,0.07,0.05, 0.02,-0.062,0.12,G);
bx(wdD,0.034,0.07,0.05, -0.05,-0.05,0.3,G); // 副握把
cyl(gl,0.009,0.009,0.32, 0.05,-0.08,-0.55,G,0.3);
cyl(gl,0.009,0.009,0.32, -0.05,-0.08,-0.55,G,0.3);
sFront_blade(G,gm,-0.04,0.055,-0.80);
sRear_peep(G,gm,-0.04,0.05,-0.10);
parts.bolt=bx(gl,0.02,0.02,0.06, 0.04,0.03,-0.02,G);
parts.muzzle.set(0,0.03,-1.0);
mkAnchors(parts,{
ads:adsFromSight(-0.04,0.062,-0.28),
rHand:{pos:V3(0.025,-0.06,0.14),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.05,-0.048,0.28),rot:V3(0.3,0.1,0)},
magWell:V3(0,0.115,-0.04), boltHand:V3(0.05,0.03,-0.02),
});
}
// ============ 国军 ============
else if(key==='zhongzheng'||key==='zhongzhengs'){
// 中正式: 标准毛瑟短步枪, 直托, 表尺
const snip=key==='zhongzhengs';
bx(wd,0.05,0.068,0.62, 0,-0.012,-0.08,G);
bx(wd,0.048,0.026,0.24, 0,0.035,-0.22,G);
bx(wd,0.05,0.098,0.24, 0,-0.056,0.24,G).rotation.x=-0.2;
cyl(gm,0.010,0.010,0.32, 0,0.03,-0.52,G);
bx(gm,0.046,0.042,0.18, 0,0.03,0.0,G);
bx(gm,0.052,0.022,0.04, 0,0.002,-0.38,G);
const ba=boltAssembly(G,0.024,0.038,0.05,false);
parts.bolt=ba.bolt; parts.boltHandle=ba.handle;
parts.clip=bx(bs,0.02,0.055,0.05, 0,0.05,0.0);
parts.clip.visible=false; G.add(parts.clip);
sFront_wings(G,gm,0,0.05,-0.665);
let adsA;
if(snip){
const sy=scopeTube(G,0,0.086,0.01,0.12,0.016);
adsA=adsFromSight(0,sy,-0.22);
} else {
sRear_notch(G,gm,0,0.048,-0.10);
sTangent(G,gm,0,0.043,-0.13);
adsA=adsFromSight(0,0.059,-0.30);
}
parts.muzzle.set(0,0.03,-0.70);
mkAnchors(parts,{
ads:adsA,
rHand:{pos:V3(0.02,-0.06,0.20),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.068,-0.26),rot:V3(0.26,-0.08,0)},
boltHand:ba.knob, clipSlot:V3(0,0.05,0.0), magWell:V3(0,0.05,0.0),
});
} else if(key==='mp18'){
// MP18 花机关: 大直径穿孔护筒, 左置弹匣
bx(wd,0.05,0.078,0.38, 0,-0.02,0.15,G);
cyl(gm,0.021,0.021,0.4, 0,0.03,-0.24,G);
for(let i=0;i<12;i++){ cyl(gl,0.005,0.005,0.006, 0.021*Math.cos(i*0.52),0.03+0.021*Math.sin(i*0.52),-0.1-((i%6)*0.055),G,0); }
bx(gm,0.044,0.055,0.16, 0,0.004,0.02,G);
parts.mag=bx(gm,0.12,0.026,0.05, -0.095,0.028,-0.05,G);
cyl(gm,0.014,0.014,0.05, -0.03,0.028,-0.05,G,0).rotation.z=HPI;
sFront_blade(G,gm,0,0.055,-0.42);
sRear_notch(G,gm,0,0.055,0.05);
parts.bolt=bx(gl,0.014,0.014,0.05, 0.032,0.03,-0.04,G);
parts.muzzle.set(0,0.03,-0.46);
mkAnchors(parts,{
ads:adsFromSight(0,0.065,-0.25),
rHand:{pos:V3(0.02,-0.08,0.16),rot:V3(0.34,0,0)},
lHand:{pos:V3(-0.02,-0.075,-0.12),rot:V3(0.32,0.05,0)},
magWell:V3(-0.12,0.028,-0.05), boltHand:V3(0.045,0.03,-0.04),
});
} else if(key==='zb26'){
// 捷克式 ZB-26: 顶置直弹匣, 长导气管, 快拆枪管环
bx(wd,0.045,0.07,0.26, 0,-0.012,0.24,G);
bx(gm,0.05,0.065,0.32, 0,0.006,-0.02,G);
cyl(gm,0.0145,0.0145,0.42, 0,0.028,-0.38,G);
cyl(gm,0.010,0.010,0.34, 0,-0.004,-0.36,G);
ringM(gl,0.02,0.005, 0,0.028,-0.19,G);
cyl(gm,0.019,0.014,0.04, 0,0.028,-0.585,G);
const mg2=bx(gm,0.023,0.14,0.05, 0,0.115,-0.06,G); mg2.rotation.x=-0.06;
parts.mag=mg2;
bx(wdD,0.012,0.016,0.08, -0.04,0.07,0.04,G);
cyl(gl,0.007,0.007,0.2, 0.03,-0.055,-0.5,G,0.35);
cyl(gl,0.007,0.007,0.2, -0.03,-0.055,-0.5,G,0.35);
bx(wdD,0.036,0.07,0.05, 0,-0.06,0.12,G);
sFront_wings(G,gm,0.03,0.046,-0.59);
sRear_notch(G,gm,0.03,0.046,0.02);
parts.bolt=bx(gl,0.015,0.015,0.05, 0.034,0.016,-0.10,G);
parts.muzzle.set(0,0.028,-0.61);
mkAnchors(parts,{
ads:adsFromSight(0.03,0.056,-0.26),
rHand:{pos:V3(0.02,-0.062,0.20),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.02,-0.072,-0.02),rot:V3(0.34,0.1,0)},
magWell:V3(0,0.115,-0.06), boltHand:V3(0.045,0.016,-0.10),
});
} else if(key==='c96'||key==='c96auto'){
// 驳壳枪 C96 / 快慢机: 前置弹仓, 扫帚柄, 木盒枪托(快慢机)
const au=key==='c96auto';
bx(gm,0.03,0.052,0.15, 0,0.022,-0.01,G);
bx(gm,0.032,0.034,0.09, 0,0.062,0.015,G); // 机匣上部
cyl(gm,0.011,0.011,0.13, 0,0.052,-0.155,G);
parts.mag=bx(gm,0.026,au?0.115:0.062,0.05, 0,au?-0.055:-0.028,-0.045,G);
cyl(wdD,0.016,0.02,0.075, 0,-0.052,0.055,G,0.25);
bx(gm,0.01,0.02,0.02, 0,0.078,0.05,G).rotation.x=0.35; // 击锤
if(au) bx(wd,0.028,0.055,0.15, 0,-0.015,0.16,G).rotation.x=-0.3; // 木盒托
sFront_blade(G,gm,0,0.062,-0.205);
sTangent(G,gm,0,0.076,0.01);
sRear_notch(G,gm,0,0.078,0.028);
parts.slide=bx(gl,0.026,0.02,0.09, 0,0.083,-0.02,G);
parts.muzzle.set(0,0.052,-0.23);
mkAnchors(parts,{
ads:adsFromSight(0,0.088,-0.25),
rHand:{pos:V3(0.012,-0.05,0.105),rot:V3(0.3,0,0)},
lHand:{pos:V3(-0.028,-0.068,0.08),rot:V3(0.3,0.25,0)},
magWell:V3(0,-0.06,-0.045), boltHand:V3(0.03,0.083,-0.02),
});
} else if(key==='boys'){
// 博伊斯反坦克枪: 顶匣, 大圆制退器, 单脚架, 机瞄偏左
bx(gm,0.05,0.07,0.4, 0,0.0,0.08,G);
cyl(gm,0.016,0.016,0.68, 0,0.03,-0.56,G);
cyl(gm,0.038,0.038,0.06, 0,0.03,-0.92,G);
for(let i=0;i<3;i++) bx(gl,0.082,0.01,0.012, 0,0.03,-0.90-i*0.02,G);
const mg2=bx(gm,0.026,0.12,0.06, 0,0.11,-0.06,G); mg2.rotation.x=-0.1;
parts.mag=mg2;
bx(gl,0.012,0.012,0.3, 0,0.012,0.26,G);
bx(gl,0.05,0.08,0.025, 0,0.0,0.40,G);
bx(wdD,0.034,0.07,0.05, 0,-0.062,0.10,G);
cyl(gl,0.01,0.01,0.3, 0,-0.09,-0.46,G,0.15); // 单脚架
const ba=boltAssembly(G,0.028,0.045,0.02,true);
parts.bolt=ba.bolt; parts.boltHandle=ba.handle;
sFront_blade(G,gm,-0.04,0.052,-0.78);
sRear_peep(G,gm,-0.04,0.048,-0.12);
parts.muzzle.set(0,0.03,-0.96);
mkAnchors(parts,{
ads:adsFromSight(-0.04,0.062,-0.28),
rHand:{pos:V3(0.02,-0.058,0.14),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.05,-0.26),rot:V3(0.26,-0.08,0)},
boltHand:ba.knob, magWell:V3(0,0.11,-0.06),
});
}
// ============ 八路军 ============
else if(key==='hanyang'||key==='laotao'){
// 汉阳造八八式: 枪管外露套筒; 老套筒: 更旧, 木色更深, 套筒锈蚀
const old2=key==='laotao';
const wm=old2?wdD:wd;
bx(wm,0.05,0.066,0.64, 0,-0.014,-0.08,G);
bx(wm,0.05,0.096,0.24, 0,-0.058,0.24,G).rotation.x=-0.2;
cyl(old2?gl:gm,0.0165,0.0165,0.36, 0,0.03,-0.48,G); // 套筒
cyl(gm,0.009,0.009,0.12, 0,0.03,-0.71,G);
bx(gm,0.044,0.04,0.16, 0,0.028,0.02,G);
if(old2){ ringM(gl,0.017,0.003, 0,0.03,-0.31,G); ringM(gl,0.017,0.003, 0,0.03,-0.62,G); }
const ba=boltAssembly(G,0.022,0.036,0.06,false);
parts.bolt=ba.bolt; parts.boltHandle=ba.handle;
parts.clip=bx(bs,0.02,0.05,0.05, 0,0.05,0.02);
parts.clip.visible=false; G.add(parts.clip);
sFront_blade(G,gm,0,0.045,-0.755);
sRear_notch(G,gm,0,0.046,-0.14);
parts.muzzle.set(0,0.03,-0.78);
mkAnchors(parts,{
ads:adsFromSight(0,0.055,-0.30),
rHand:{pos:V3(0.02,-0.06,0.20),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.012,-0.066,-0.26),rot:V3(0.26,-0.08,0)},
boltHand:ba.knob, clipSlot:V3(0,0.05,0.02), magWell:V3(0,0.05,0.02),
});
} else if(key==='type11'){
// 歪把子: 右弯枪托, 左侧漏斗供弹, 细长导气管
const st=bx(wd,0.042,0.062,0.3, 0.035,-0.024,0.2,G);
st.rotation.y=-0.14;
bx(gm,0.046,0.055,0.3, 0,0.006,-0.06,G);
cyl(gm,0.0125,0.0125,0.36, 0,0.024,-0.38,G);
cyl(gm,0.008,0.008,0.3, 0,-0.004,-0.36,G);
for(let i=0;i<6;i++) cyl(gl,0.0145,0.0145,0.012, 0,0.024,-0.24-i*0.045,G);
// 左侧漏斗弹仓(装桥夹)
const hop=new THREE.Group(); hop.position.set(-0.052,0.045,0.0); G.add(hop);
bx(gm,0.05,0.075,0.065, 0,0,0,hop);
bx(gl,0.044,0.012,0.055, 0,0.043,0,hop);
parts.mag=hop;
cyl(gl,0.007,0.007,0.2, 0.028,-0.055,-0.46,G,0.35);
cyl(gl,0.007,0.007,0.2, -0.028,-0.055,-0.46,G,0.35);
sFront_wings(G,gm,0.024,0.042,-0.54);
sRear_notch(G,gm,0.024,0.042,0.02);
parts.muzzle.set(0,0.024,-0.57);
mkAnchors(parts,{
ads:adsFromSight(0.024,0.052,-0.26),
rHand:{pos:V3(0.035,-0.065,0.18),rot:V3(0.32,0,0)},
lHand:{pos:V3(-0.014,-0.07,-0.12),rot:V3(0.32,0,0)},
magWell:V3(-0.052,0.045,0.0), boltHand:V3(0.04,0.01,-0.06),
});
} else if(key==='mortar'){
// 轻型迫击炮
const tube=cyl(gm,0.045,0.05,0.62, 0,0.02,-0.18,G);
tube.rotation.x=HPI-0.62;
cyl(gl,0.052,0.048,0.05, 0,0.24,-0.4,G).rotation.x=HPI-0.62;
bx(gm,0.16,0.02,0.2, 0,-0.16,-0.02,G);
cyl(gl,0.008,0.008,0.3, 0.09,-0.02,-0.3,G,0.9);
cyl(gl,0.008,0.008,0.3, -0.09,-0.02,-0.3,G,0.9);
bx(gm,0.05,0.014,0.02, 0,0.05,-0.12,G);
bx(gl,0.014,0.05,0.014, -0.07,0.1,-0.2,G);
parts.muzzle.set(0,0.3,-0.45);
mkAnchors(parts,{
ads:{pos:V3(0.15,-0.14,-0.5),rot:ADSROT0},
rHand:{pos:V3(0.01,-0.09,0.16),rot:V3(0.35,0,0)},
lHand:{pos:V3(-0.06,0.02,-0.3),rot:V3(0.3,0,0)},
});
}
// ============ 兜底: 通用手枪 ============
else {
bx(gm,0.032,0.05,0.19, 0,0.02,-0.02,G);
parts.slide=bx(gl,0.034,0.032,0.2, 0,0.045,-0.02,G);
bx(wdD,0.03,0.09,0.05, 0,-0.04,0.05,G).rotation.x=-0.25;
parts.mag=bx(gm,0.024,0.07,0.036, 0,-0.055,0.048,G);
parts.mag.rotation.x=-0.25;
sFront_blade(G,gl,0,0.061,-0.115);
sRear_notch(G,gl,0,0.06,0.07);
cyl(gm,0.006,0.01,0.03, 0,-0.005,-0.065,G,0.5);
parts.muzzle.set(0,0.045,-0.14);
mkAnchors(parts,{
ads:adsFromSight(0,0.07,-0.24),
rHand:{pos:V3(0.015,-0.06,0.13),rot:V3(0.25,0,0)},
lHand:{pos:V3(-0.03,-0.08,0.1),rot:V3(0.3,0.25,0)},
magWell:V3(0,-0.055,0.048),
});
}
G.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } });
return parts;
}
function buildArms(team){
const sleeve=team===0?vmMats.sleeve0:vmMats.sleeve1;
const mk=()=>{
const g=new THREE.Group();
bx(sleeve,0.07,0.07,0.3, 0,0,0.1,g);
bx(vmMats.skin,0.055,0.05,0.1, 0,0,-0.09,g);
return g;
};
return { L:mk(), R:mk() };
}
function buildNadeModel(team){
const g=new THREE.Group();
if(TEAM_FACTION[team].nade==='egg'){
const b=new THREE.Mesh(new THREE.SphereGeometry(0.032,10,8),vmMats.nade);
b.scale.y=1.25; g.add(b);
bx(vmMats.gunL,0.012,0.03,0.012, 0.012,0.04,0,g);
} else {
cyl(vmMats.nade,0.02,0.02,0.07, 0,0.01,0,g,0);
cyl(vmMats.woodD,0.011,0.011,0.11, 0,-0.07,0,g,0);
}
return g;
}
function buildKnife(){
const g=new THREE.Group();
bx(vmMats.woodD,0.02,0.025,0.09, 0,0,0.045,g);
const blade=bx(new THREE.MeshLambertMaterial({color:0x9aa2a8}),0.006,0.028,0.15, 0,0.004,-0.075,g);
return g;
}
