'use strict';
const soldiers=[];
const combatants=[];
let gunEvents=[];
function angleLerpTo(cur,tgt,maxStep){
let d=tgt-cur;
while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU;
return cur+clamp(d,-maxStep,maxStep);
}
function angDiff(a,b){ let d=b-a; while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU; return d; }
const uniformMats=[0,1].map(t=>{
const F=TEAM_FACTION[t];
return {
coat:new THREE.MeshLambertMaterial({color:F.coat}), pants:new THREE.MeshLambertMaterial({color:F.pants}),
helm:new THREE.MeshLambertMaterial({color:F.helm}), skin:new THREE.MeshLambertMaterial({color:F.skin}),
};
});
const worldGunGeoCache={};
function worldGunModel(kind,team,key){
const g=new THREE.Group();
const gm=vmMats.gun, wd=vmMats.wood;
const wg=key&&WPN_DEFS[key]?WPN_DEFS[key].wg:null;
if(kind==='smg'){
bx(gm,0.05,0.06,0.5,0,0,-0.1,g);
if(wg==='drum') { const d2=cyl(gm,0.075,0.075,0.05, 0,-0.1,-0.1,g,0); d2.rotation.z=HPI; }
else if(wg==='sidemag') bx(gm,0.16,0.028,0.05, -0.11,0.01,-0.12,g);
else if(wg==='c96a') bx(gm,0.026,0.1,0.05, 0,-0.08,-0.05,g);
else bx(gm,0.024,0.14,0.05,0,-0.09,-0.12,g);
} else if(kind==='mg'){
bx(gm,0.06,0.07,0.8,0,0,-0.15,g);
bx(wd,0.05,0.09,0.18,0,-0.04,0.28,g);
if(wg==='pan'){ cyl(gm,0.085,0.085,0.026, 0,0.075,-0.12,g,0); } // DP弹盘平放
else if(wg==='topmag') bx(gm,0.026,0.15,0.06, 0,0.13,-0.12,g);
else if(wg==='hopper') bx(gm,0.055,0.09,0.08, -0.06,0.06,-0.05,g);
cyl(gm,0.008,0.008,0.22, 0.035,-0.1,-0.42,g,0.3);
cyl(gm,0.008,0.008,0.22, -0.035,-0.1,-0.42,g,0.3);
} else if(kind==='atr'){
// 反坦克枪: 超长枪身
bx(gm,0.055,0.07,0.5, 0,0,0.08,g);
cyl(gm,0.017,0.017,0.85, 0,0.02,-0.6,g);
bx(gm,0.06,0.05,0.07, 0,0.02,-1.0,g);
bx(wd,0.045,0.08,0.18, 0,-0.04,0.32,g);
cyl(gm,0.008,0.008,0.26, 0.04,-0.1,-0.66,g,0.3);
cyl(gm,0.008,0.008,0.26, -0.04,-0.1,-0.66,g,0.3);
} else if(kind==='mortar'){
// 迫击炮: 背负式短管+座钣
const tube=cyl(gm,0.05,0.055,0.7, 0,0.08,-0.1,g);
tube.rotation.x=HPI-0.5;
bx(gm,0.24,0.03,0.28, 0,-0.1,0.1,g);
cyl(gm,0.01,0.01,0.34, 0.1,-0.02,-0.25,g,0.9);
cyl(gm,0.01,0.01,0.34, -0.1,-0.02,-0.25,g,0.9);
} else if(kind==='launcher'){
const tubeMat=new THREE.MeshLambertMaterial({color:team===0?0x4a5238:0x52524a});
const tube=cyl(tubeMat,0.075,0.075,1.5, 0,0.12,-0.15,g);
cyl(gm,0.085,0.078,0.09, 0,0.12,-0.86,g);
cyl(gm,0.085,0.078,0.08, 0,0.12,0.52,g);
bx(wd,0.04,0.08,0.06, 0,-0.02,0.02,g);
if(team===1) bx(vmMats.gunL,0.34,0.3,0.015, 0.02,0.1,-0.4,g);
} else {
bx(wd,0.05,0.07,0.75,0,0,-0.05,g);
cyl(gm,0.012,0.012,0.3,0,0.02,-0.55,g);
bx(wd,0.05,0.09,0.2,0,-0.05,0.32,g);
}
g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
return g;
}
function gunKindOf(key){
let d=WPN_DEFS[key];
if(d.model){ key=d.model; d=WPN_DEFS[key]; }
if(d.rocket) return 'launcher';
if(d.mortar) return 'mortar';
if(d.atRifle) return 'atr';
if(d.pistol) return 'smg';
if(key==='bar'||key==='stg44'||d.wg==='pan'||d.wg==='topmag'||d.wg==='hopper') return 'mg';
if(d.type==='auto') return 'smg';
return 'rifle';
}
// ===== 面部表情系统: SVG 表情图集 (共享一张纹理, 每人克隆偏移, 换状态零开销) =====
// 8 状态: normal blink aim(瞄准眯眼) pain(痛苦) fear(恐惧) sideL/sideR(侧瞟) dead
const FACE_STATES={normal:[0,0],blink:[1,0],aim:[2,0],pain:[3,0],fear:[0,1],sideL:[1,1],sideR:[2,1],dead:[3,1]};
const FACE_TEX=(function(){
const eyeL=17, eyeR=47, eyeY=26, mouthY=48;
const cell=(cx,cy,body)=>`<g transform="translate(${cx*64},${cy*64})">${body}</g>`;
const brow=(x,y,tilt,len=11)=>`<path d="M${x-len/2} ${y+tilt} Q ${x} ${y-2} ${x+len/2} ${y-tilt}" stroke="#3a2a1c" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
const eyeOpen=(x,px)=>`<ellipse cx="${x}" cy="${eyeY}" rx="6.5" ry="4.6" fill="#f2ede2"/><circle cx="${x+px}" cy="${eyeY}" r="2.6" fill="#2c2018"/><circle cx="${x+px+0.9}" cy="${eyeY-0.9}" r="0.8" fill="#fff" opacity="0.8"/>`;
const eyeWide=(x,px)=>`<circle cx="${x}" cy="${eyeY}" r="5.8" fill="#f6f1e6"/><circle cx="${x+px}" cy="${eyeY}" r="2" fill="#2c2018"/>`;
const eyeShut=(x)=>`<path d="M${x-6} ${eyeY+1} Q ${x} ${eyeY+3.5} ${x+6} ${eyeY+1}" stroke="#4a3626" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
const eyeSquint=(x)=>`<path d="M${x-6} ${eyeY} h12" stroke="#4a3626" stroke-width="2.6" stroke-linecap="round"/><rect x="${x-6}" y="${eyeY-3.4}" width="12" height="3" fill="#c8a583" opacity="0.55"/>`;
const eyePainX=(x)=>`<path d="M${x-5} ${eyeY-3.5} L${x+5} ${eyeY+2.5} M${x+5} ${eyeY-3.5} L${x-5} ${eyeY+2.5}" stroke="#4a3626" stroke-width="2.2" stroke-linecap="round"/>`;
const mouthFlat=`<path d="M25 ${mouthY} h14" stroke="#5a3a2c" stroke-width="2.2" stroke-linecap="round"/>`;
const mouthTight=`<path d="M27 ${mouthY} h10" stroke="#5a3a2c" stroke-width="2.6" stroke-linecap="round"/>`;
const mouthGrit=`<rect x="24" y="${mouthY-3.5}" width="16" height="7" rx="2" fill="#402a20"/><rect x="25" y="${mouthY-2}" width="14" height="4" fill="#e8e0d0"/><path d="M28 ${mouthY-3.5} v7 M32 ${mouthY-3.5} v7 M36 ${mouthY-3.5} v7" stroke="#b8ab98" stroke-width="1"/>`;
const mouthO=`<ellipse cx="32" cy="${mouthY}" rx="5" ry="6.5" fill="#402a20"/><ellipse cx="32" cy="${mouthY+1}" rx="3" ry="4" fill="#6a4034"/>`;
const mouthSlack=`<path d="M26 ${mouthY} Q 32 ${mouthY+5} 38 ${mouthY}" stroke="#4a3226" stroke-width="2.2" fill="none"/>`;
const nose=`<path d="M32 ${eyeY+4} l-1.5 8 l3 0.5" stroke="#8a6a50" stroke-width="1.6" fill="none" opacity="0.7"/>`;
let svg='';
svg+=cell(0,0, brow(eyeL,15,1)+brow(eyeR,15,-1)+eyeOpen(eyeL,0)+eyeOpen(eyeR,0)+nose+mouthFlat);
svg+=cell(1,0, brow(eyeL,15,1)+brow(eyeR,15,-1)+eyeShut(eyeL)+eyeShut(eyeR)+nose+mouthFlat);
svg+=cell(2,0, brow(eyeL,13,3)+brow(eyeR,13,-3)+eyeSquint(eyeL)+eyeOpen(eyeR,0)+nose+mouthTight);
svg+=cell(3,0, brow(eyeL,12,5)+brow(eyeR,12,-5)+eyePainX(eyeL)+eyePainX(eyeR)+nose+mouthGrit);
svg+=cell(0,1, brow(eyeL,11,-3)+brow(eyeR,11,3)+eyeWide(eyeL,0)+eyeWide(eyeR,0)+nose+mouthO);
svg+=cell(1,1, brow(eyeL,14,0)+brow(eyeR,14,0)+eyeOpen(eyeL,-2.6)+eyeOpen(eyeR,-2.6)+nose+mouthFlat);
svg+=cell(2,1, brow(eyeL,14,0)+brow(eyeR,14,0)+eyeOpen(eyeL,2.6)+eyeOpen(eyeR,2.6)+nose+mouthFlat);
svg+=cell(3,1, brow(eyeL,17,2)+brow(eyeR,17,-2)+eyeShut(eyeL)+eyeShut(eyeR)+nose+mouthSlack);
const t=svgTex(256,128,svg,1,1,null);
t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
return t;
})();
function addFace(headG){
const tex=FACE_TEX.clone();
tex.needsUpdate=true;
tex.repeat.set(0.25,0.5);
tex.offset.set(0,0.5);
const mat=new THREE.MeshLambertMaterial({map:tex,transparent:true,depthWrite:false});
mat.userData.perSoldier=true;
const m=new THREE.Mesh(new THREE.PlaneGeometry(0.19,0.2),mat);
m.position.set(0,0.1,0.102);
m.castShadow=false; m.receiveShadow=false;
m.renderOrder=1;
headG.add(m);
const face={mesh:m,tex,state:'normal'};
face.set=(st)=>{
if(face.state===st||!FACE_STATES[st]) return;
face.state=st;
const c=FACE_STATES[st];
tex.offset.set(c[0]*0.25,c[1]===0?0.5:0);
};
return face;
}
function buildSoldierMesh(team,name){
const U=uniformMats[team];
const root=new THREE.Group();
const helmParts=[];
const hAdd=(mesh)=>{ helmParts.push(mesh); return mesh; };
const pelvis=new THREE.Group(); pelvis.position.y=0.94; root.add(pelvis);
const torsoG=new THREE.Group(); pelvis.add(torsoG);
bx(U.coat,0.44,0.55,0.26, 0,0.28,0, torsoG);
const headG=new THREE.Group(); headG.position.set(0,0.62,0); torsoG.add(headG);
bx(U.skin,0.2,0.22,0.2, 0,0.1,0, headG);
const face=addFace(headG);
// 阵营特色头盔/军帽 (全部纳入 helmParts, 死亡时整体物理脱落)
let helm;
const hs=TEAM_FACTION[team].helmet;
if(hs==='pot'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.15,10,8,0,TAU,0,HPI*1.2),U.helm);
helm.position.set(0,0.16,0);
headG.add(hAdd(helm));
} else if(hs==='stahl'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.155,10,8,0,TAU,0,HPI*1.35),U.helm);
helm.position.set(0,0.15,0); helm.scale.z=1.15;
headG.add(hAdd(helm));
// 国军M35: 正面青天白日徽
if(TEAM_FACTION[team].sym==='✷'){
headG.add(hAdd(bx(new THREE.MeshLambertMaterial({color:0x2050b0}),0.032,0.032,0.008, 0,0.17,0.148)));
headG.add(hAdd(bx(new THREE.MeshLambertMaterial({color:0xe8e8e8}),0.016,0.016,0.01, 0,0.17,0.15)));
}
} else if(hs==='ssh'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.152,10,8,0,TAU,0,HPI*1.28),U.helm);
helm.position.set(0,0.155,0); helm.scale.y=1.1;
headG.add(hAdd(helm));
} else if(hs==='jp'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.142,10,8,0,TAU,0,HPI*1.22),U.helm);
helm.position.set(0,0.165,0);
headG.add(hAdd(helm));
const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.17,0.025,10),U.helm);
brim.position.set(0,0.1,0); headG.add(hAdd(brim));
headG.add(hAdd(bx(new THREE.MeshLambertMaterial({color:0xd8b840}),0.02,0.024,0.008, 0,0.16,0.135)));
} else {
// 八路军帽: 布帽+短帽檐(朝前)+红星
headG.add(hAdd(bx(U.helm,0.21,0.09,0.21, 0,0.19,0)));
headG.add(hAdd(bx(U.helm,0.18,0.028,0.07, 0,0.155,0.12)));
headG.add(hAdd(bx(new THREE.MeshLambertMaterial({color:0xc03028}),0.024,0.024,0.008, 0,0.19,0.106)));
}
const mkArm=(side)=>{
const sh=new THREE.Group(); sh.position.set(side*0.28,0.5,0); torsoG.add(sh);
bx(U.coat,0.13,0.32,0.13,0,-0.16,0,sh);
const el=new THREE.Group(); el.position.y=-0.32; sh.add(el);
bx(U.coat,0.115,0.28,0.115,0,-0.14,0,el);
const hand=new THREE.Group(); hand.position.y=-0.3; el.add(hand);
bx(U.skin,0.09,0.09,0.09,0,0,0,hand);
sh.userData.swing=0;
return {sh,el,hand};
};
const armL=mkArm(-1), armR=mkArm(1);
const mkLeg=(side)=>{
const hip=new THREE.Group(); hip.position.set(side*0.12,0,0); pelvis.add(hip);
bx(U.pants,0.16,0.46,0.16,0,-0.23,0,hip);
const knee=new THREE.Group(); knee.position.y=-0.46; hip.add(knee);
bx(U.pants,0.14,0.48,0.14,0,-0.24,0,knee);
bx(new THREE.MeshLambertMaterial({color:0x2e2820}),0.15,0.1,0.24,0,-0.46,0.04,knee);
return {hip,knee};
};
const legL=mkLeg(-1), legR=mkLeg(1);
const gunG=new THREE.Group(); gunG.position.set(0.14,0.4,0.1); gunG.rotation.order='YXZ'; torsoG.add(gunG);
bx(team===0?U.pants:U.coat,0.3,0.34,0.14, 0,0.3,-0.18, torsoG);
bx(new THREE.MeshLambertMaterial({color:0x3a3428}),0.4,0.08,0.28, 0,0.02,0, torsoG);
root.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } });
const c=document.createElement('canvas'); c.width=128; c.height=32;
const g2=c.getContext('2d');
g2.font='bold 20px sans-serif'; g2.textAlign='center';
g2.fillStyle=team===0?'#a8ccff':'#ffb3a6';
g2.strokeStyle='rgba(0,0,0,.8)'; g2.lineWidth=4;
g2.strokeText(name,64,22); g2.fillText(name,64,22);
const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
tag.scale.set(0.9,0.22,1); tag.position.y=2.05; tag.renderOrder=5;
root.add(tag);
scene.add(root);
return {root,pelvis,torsoG,headG,armL,armR,legL,legR,gunG,tag,helmParts,face};
}
