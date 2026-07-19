'use strict';
const WPN_DEFS = {
garand:   { name:'M1 加兰德', mode:'半自动', type:'semi', snd:'rifle', dmg:36, headMul:2.4, rpm:300, mag:8, reserve:80, reload:2.4, spreadHip:2.2, spreadAds:0.14, recoil:1.35, recSide:0.35, adsFov:52, kick:0.075, enbloc:true, tracer:3 },
thompson: { name:'汤普森 M1A1', mode:'全自动', type:'auto', snd:'smg', dmg:21, headMul:1.8, rpm:680, mag:30, reserve:150, reload:2.5, spreadHip:3.4, spreadAds:0.85, recoil:0.55, recSide:0.4, adsFov:56, kick:0.045, tracer:4 },
bar:      { name:'勃朗宁 BAR', mode:'全自动', type:'auto', snd:'mg', dmg:31, headMul:1.9, rpm:480, mag:20, reserve:100, reload:3.0, spreadHip:3.8, spreadAds:0.55, recoil:0.95, recSide:0.55, adsFov:54, kick:0.06, tracer:3 },
springfield:{ name:'春田 M1903A4', mode:'栓动 · 4x', type:'bolt', snd:'sniper', dmg:96, headMul:2.5, rpm:50, mag:5, reserve:40, reload:3.4, spreadHip:5, spreadAds:0.02, recoil:2.6, recSide:0.5, adsFov:20, kick:0.12, scoped:true, boltT:1.05, tracer:1 },
m1911:    { name:'柯尔特 M1911', mode:'半自动', type:'semi', snd:'pistol', dmg:26, headMul:2.0, rpm:420, mag:7, reserve:35, reload:1.9, spreadHip:2.6, spreadAds:0.5, recoil:0.8, recSide:0.4, adsFov:60, kick:0.05, pistol:true, tracer:2 },
kar98:    { name:'毛瑟 Kar98k', mode:'栓动', type:'bolt', snd:'sniper', dmg:88, headMul:2.5, rpm:52, mag:5, reserve:50, reload:3.2, spreadHip:4.5, spreadAds:0.08, recoil:2.4, recSide:0.45, adsFov:48, kick:0.11, boltT:1.0, tracer:1 },
kar98zf:  { name:'Kar98k ZF41', mode:'栓动 · 4x', type:'bolt', snd:'sniper', dmg:96, headMul:2.5, rpm:50, mag:5, reserve:40, reload:3.4, spreadHip:5, spreadAds:0.02, recoil:2.6, recSide:0.5, adsFov:20, kick:0.12, scoped:true, boltT:1.05, tracer:1 },
mp40:     { name:'MP40', mode:'全自动', type:'auto', snd:'smg', dmg:20, headMul:1.8, rpm:560, mag:32, reserve:160, reload:2.6, spreadHip:3.0, spreadAds:0.75, recoil:0.45, recSide:0.35, adsFov:56, kick:0.04, tracer:4 },
stg44:    { name:'STG 44', mode:'全自动', type:'auto', snd:'rifle', dmg:27, headMul:1.9, rpm:550, mag:30, reserve:120, reload:2.8, spreadHip:3.2, spreadAds:0.4, recoil:0.7, recSide:0.45, adsFov:54, kick:0.05, tracer:3 },
p38:      { name:'瓦尔特 P38', mode:'半自动', type:'semi', snd:'pistol', dmg:24, headMul:2.0, rpm:430, mag:8, reserve:40, reload:1.9, spreadHip:2.6, spreadAds:0.5, recoil:0.75, recSide:0.4, adsFov:60, kick:0.05, pistol:true, tracer:2 },
m1903:    { name:'春田 M1903', mode:'栓动', type:'bolt', snd:'sniper', dmg:80, headMul:2.4, rpm:54, mag:5, reserve:50, reload:3.2, spreadHip:4.5, spreadAds:0.1, recoil:2.3, recSide:0.45, adsFov:50, kick:0.1, boltT:0.95, tracer:1 },
bazooka:  { name:'巴祖卡 M9', mode:'单发', type:'atlauncher', snd:'cannon', dmg:24, headMul:1, rpm:10, mag:1, reserve:8, reload:3.6, spreadHip:4.8, spreadAds:1.0, recoil:5.0, recSide:1.5, adsFov:52, kick:0.18, rocket:true, atDmg:360, tracer:1 },
schreck:  { name:'坦克杀手 RPzB54', mode:'单发', type:'atlauncher', snd:'cannon', dmg:24, headMul:1, rpm:10, mag:1, reserve:8, reload:3.8, spreadHip:4.5, spreadAds:0.9, recoil:5.2, recSide:1.6, adsFov:50, kick:0.19, rocket:true, atDmg:380, tracer:1 },
// ---- 苏军 ----
mosin:    { name:'莫辛-纳甘 M91/30', mode:'栓动', type:'bolt', snd:'sniper', dmg:88, headMul:2.5, rpm:50, mag:5, reserve:50, reload:3.3, spreadHip:4.5, spreadAds:0.08, recoil:2.5, recSide:0.45, adsFov:48, kick:0.11, boltT:1.05, tracer:1 },
mosinpu:  { name:'莫辛-纳甘 PU', mode:'栓动 · 3.5x', type:'bolt', snd:'sniper', dmg:96, headMul:2.5, rpm:48, mag:5, reserve:40, reload:3.5, spreadHip:5, spreadAds:0.02, recoil:2.6, recSide:0.5, adsFov:21, kick:0.12, scoped:true, boltT:1.1, tracer:1 },
ppsh:     { name:'波波沙 PPSh-41', mode:'全自动', type:'auto', snd:'smg', dmg:19, headMul:1.8, rpm:900, mag:71, reserve:213, reload:3.4, spreadHip:3.6, spreadAds:0.95, recoil:0.5, recSide:0.42, adsFov:56, kick:0.04, wg:'drum', tracer:5 },
dp28:     { name:'捷格加廖夫 DP-28', mode:'全自动', type:'auto', snd:'mg', dmg:30, headMul:1.9, rpm:520, mag:47, reserve:141, reload:4.2, spreadHip:4.0, spreadAds:0.55, recoil:0.9, recSide:0.5, adsFov:54, kick:0.06, wg:'pan', tracer:3 },
tt33:     { name:'托卡列夫 TT-33', mode:'半自动', type:'semi', snd:'pistol', dmg:25, headMul:2.0, rpm:430, mag:8, reserve:40, reload:1.8, spreadHip:2.6, spreadAds:0.5, recoil:0.78, recSide:0.4, adsFov:60, kick:0.05, pistol:true, tracer:2 },
ptrd:     { name:'PTRD-41 反坦克枪', mode:'栓动 · 14.5mm', type:'bolt', snd:'sniper', dmg:95, headMul:1.6, rpm:22, mag:1, reserve:18, reload:2.8, spreadHip:6, spreadAds:0.06, recoil:4.2, recSide:0.8, adsFov:44, kick:0.22, boltT:1.5, atRifle:true, vehDmg:135, wg:'atr', tracer:1 },
// ---- 日军 ----
arisaka:  { name:'三八式步枪', mode:'栓动', type:'bolt', snd:'sniper', dmg:82, headMul:2.5, rpm:54, mag:5, reserve:50, reload:3.1, spreadHip:4.2, spreadAds:0.07, recoil:2.2, recSide:0.4, adsFov:48, kick:0.1, boltT:0.95, tracer:1 },
type97s:  { name:'九七式狙击枪', mode:'栓动 · 4x', type:'bolt', snd:'sniper', dmg:92, headMul:2.5, rpm:50, mag:5, reserve:40, reload:3.4, spreadHip:5, spreadAds:0.02, recoil:2.4, recSide:0.5, adsFov:20, kick:0.11, scoped:true, boltT:1.05, tracer:1 },
type100:  { name:'一〇〇式冲锋枪', mode:'全自动', type:'auto', snd:'smg', dmg:19, headMul:1.8, rpm:520, mag:30, reserve:150, reload:2.6, spreadHip:3.1, spreadAds:0.8, recoil:0.42, recSide:0.35, adsFov:56, kick:0.04, tracer:4 },
type96:   { name:'九六式轻机枪', mode:'全自动', type:'auto', snd:'mg', dmg:28, headMul:1.9, rpm:540, mag:30, reserve:150, reload:3.2, spreadHip:3.8, spreadAds:0.5, recoil:0.85, recSide:0.5, adsFov:54, kick:0.055, wg:'topmag', tracer:3 },
nambu:    { name:'南部十四年式', mode:'半自动', type:'semi', snd:'pistol', dmg:22, headMul:2.0, rpm:420, mag:8, reserve:40, reload:1.9, spreadHip:2.5, spreadAds:0.5, recoil:0.7, recSide:0.35, adsFov:60, kick:0.045, pistol:true, tracer:2 },
type97at: { name:'九七式自动炮', mode:'半自动 · 20mm', type:'semi', snd:'sniper', dmg:90, headMul:1.5, rpm:60, mag:7, reserve:28, reload:4.2, spreadHip:6, spreadAds:0.1, recoil:3.8, recSide:0.8, adsFov:46, kick:0.2, atRifle:true, vehDmg:110, wg:'atr', tracer:1 },
// ---- 国军 ----
zhongzheng:{ name:'中正式步骑枪', mode:'栓动', type:'bolt', snd:'sniper', dmg:86, headMul:2.5, rpm:52, mag:5, reserve:50, reload:3.2, spreadHip:4.5, spreadAds:0.08, recoil:2.4, recSide:0.45, adsFov:48, kick:0.11, boltT:1.0, tracer:1 },
zhongzhengs:{ name:'中正式(狙击)', mode:'栓动 · 4x', type:'bolt', snd:'sniper', dmg:94, headMul:2.5, rpm:50, mag:5, reserve:40, reload:3.4, spreadHip:5, spreadAds:0.02, recoil:2.5, recSide:0.5, adsFov:20, kick:0.12, scoped:true, boltT:1.05, tracer:1 },
mp18:     { name:'花机关 MP18', mode:'全自动', type:'auto', snd:'smg', dmg:20, headMul:1.8, rpm:500, mag:32, reserve:160, reload:2.9, spreadHip:3.2, spreadAds:0.85, recoil:0.48, recSide:0.4, adsFov:56, kick:0.04, wg:'sidemag', tracer:4 },
zb26:     { name:'捷克式 ZB-26', mode:'全自动', type:'auto', snd:'mg', dmg:31, headMul:1.9, rpm:500, mag:20, reserve:120, reload:3.1, spreadHip:3.8, spreadAds:0.5, recoil:0.92, recSide:0.5, adsFov:54, kick:0.06, wg:'topmag', tracer:3 },
c96:      { name:'驳壳枪 C96', mode:'半自动', type:'semi', snd:'pistol', dmg:24, headMul:2.0, rpm:440, mag:10, reserve:50, reload:2.2, spreadHip:2.7, spreadAds:0.5, recoil:0.7, recSide:0.42, adsFov:58, kick:0.05, pistol:true, tracer:2 },
boys:     { name:'博伊斯反坦克枪', mode:'栓动 · 13.9mm', type:'bolt', snd:'sniper', dmg:92, headMul:1.6, rpm:24, mag:5, reserve:20, reload:3.8, spreadHip:6, spreadAds:0.06, recoil:4.0, recSide:0.8, adsFov:44, kick:0.21, boltT:1.4, atRifle:true, vehDmg:125, wg:'atr', tracer:1 },
// ---- 八路军 ----
hanyang:  { name:'汉阳造八八式', mode:'栓动', type:'bolt', snd:'sniper', dmg:78, headMul:2.4, rpm:50, mag:5, reserve:45, reload:3.4, spreadHip:5.0, spreadAds:0.12, recoil:2.3, recSide:0.5, adsFov:48, kick:0.1, boltT:1.05, tracer:1 },
c96auto:  { name:'快慢机(盒子炮)', mode:'全自动', type:'auto', snd:'smg', dmg:21, headMul:1.9, rpm:620, mag:20, reserve:120, reload:2.4, spreadHip:3.8, spreadAds:0.95, recoil:0.6, recSide:0.55, adsFov:56, kick:0.05, wg:'c96a', tracer:4 },
type11:   { name:'歪把子(缴获)', mode:'全自动', type:'auto', snd:'mg', dmg:27, headMul:1.9, rpm:480, mag:30, reserve:120, reload:3.8, spreadHip:4.2, spreadAds:0.6, recoil:0.9, recSide:0.55, adsFov:54, kick:0.055, wg:'hopper', tracer:3 },
mortar:   { name:'轻型迫击炮', mode:'曲射支援', type:'semi', snd:'cannon', dmg:30, headMul:1, rpm:16, mag:1, reserve:16, reload:3.2, spreadHip:3, spreadAds:2.5, recoil:1.4, recSide:0.4, adsFov:62, kick:0.12, mortar:true, tracer:1 },
// ---- 支援兵种自卫武器 (弱化型) ----
m1carb:   { name:'M1 卡宾枪', mode:'半自动', type:'semi', snd:'smg', dmg:22, headMul:1.9, rpm:340, mag:15, reserve:75, reload:2.2, spreadHip:2.8, spreadAds:0.55, recoil:0.6, recSide:0.35, adsFov:56, kick:0.04, model:'garand', tracer:3 },
g33:      { name:'G33/40 骑枪', mode:'栓动', type:'bolt', snd:'sniper', dmg:60, headMul:2.2, rpm:48, mag:5, reserve:35, reload:3.4, spreadHip:5.2, spreadAds:0.22, recoil:2.2, recSide:0.5, adsFov:50, kick:0.1, boltT:1.15, model:'kar98', tracer:1 },
m38carb:  { name:'莫辛 M38 骑枪', mode:'栓动', type:'bolt', snd:'sniper', dmg:62, headMul:2.2, rpm:46, mag:5, reserve:35, reload:3.5, spreadHip:5.4, spreadAds:0.24, recoil:2.3, recSide:0.5, adsFov:50, kick:0.1, boltT:1.2, model:'mosin', tracer:1 },
type38c:  { name:'三八式骑枪', mode:'栓动', type:'bolt', snd:'sniper', dmg:58, headMul:2.2, rpm:50, mag:5, reserve:35, reload:3.3, spreadHip:5.2, spreadAds:0.22, recoil:2.0, recSide:0.45, adsFov:50, kick:0.09, boltT:1.1, model:'arisaka', tracer:1 },
laotao:   { name:'老套筒(汉阳早期)', mode:'栓动', type:'bolt', snd:'sniper', dmg:54, headMul:2.1, rpm:44, mag:5, reserve:30, reload:3.7, spreadHip:5.8, spreadAds:0.3, recoil:2.2, recSide:0.55, adsFov:50, kick:0.1, boltT:1.25, model:'hanyang', tracer:1 },
};
const CLASSES=[
{ name:'步枪兵', nades:2, smoke:1 },
{ name:'冲锋枪手', nades:3, smoke:1 },
{ name:'突击兵', nades:2, smoke:1 },
{ name:'狙击手', nades:1, smoke:1 },
{ name:'医护兵', nades:2, smoke:2 },
{ name:'反坦克兵', nades:1, atn:3, smoke:0 },
{ name:'迫击炮兵', nades:1, smoke:1, deploy:'mortar' },
{ name:'工程兵', nades:1, smoke:1, deploy:'build' },
];;
const CLS_POOL=[0,0,0,1,1,2,2,3,4,4,5,5,6,7];
// ===== 枪械专用 SVG 纹理: 细腻木纹 / 发蓝钢 / 磷化钢 / 胶木 =====
TEX.gunwood=(function(){
const R=texRng(201); let grain='';
for(let i=0;i<34;i++){
const y=R()*128;
grain+=`<path d="M0 ${y.toFixed(1)} C 32 ${(y+(R()-0.5)*7).toFixed(1)}, 96 ${(y+(R()-0.5)*7).toFixed(1)}, 128 ${(y+(R()-0.5)*10).toFixed(1)}" stroke="rgba(66,44,24,${(0.25+R()*0.3).toFixed(2)})" stroke-width="${(0.5+R()*0.9).toFixed(1)}" fill="none"/>`;
}
grain+=`<ellipse cx="${(30+R()*70).toFixed(0)}" cy="${(R()*128).toFixed(0)}" rx="4" ry="7" fill="rgba(52,32,16,.5)"/>`;
const body=`<defs>${svgGrain('gwn','0.5 0.04','3',7)}</defs>`+
`<rect width="128" height="128" fill="#7a5a34"/>`+grain+
`<rect width="128" height="128" filter="url(#gwn)" opacity="0.22" style="mix-blend-mode:multiply"/>`;
return svgTex(128,128,body,1,1,'#7a5a34');
})();
TEX.gunwoodD=(function(){
const R=texRng(211); let grain='';
for(let i=0;i<30;i++){
const y=R()*128;
grain+=`<path d="M0 ${y.toFixed(1)} C 40 ${(y+(R()-0.5)*8).toFixed(1)}, 90 ${(y+(R()-0.5)*8).toFixed(1)}, 128 ${(y+(R()-0.5)*11).toFixed(1)}" stroke="rgba(38,24,12,${(0.3+R()*0.3).toFixed(2)})" stroke-width="${(0.6+R()*1).toFixed(1)}" fill="none"/>`;
}
const body=`<defs>${svgGrain('gwdn','0.5 0.05','3',9)}</defs>`+
`<rect width="128" height="128" fill="#573e22"/>`+grain+
`<rect width="128" height="128" filter="url(#gwdn)" opacity="0.24" style="mix-blend-mode:multiply"/>`;
return svgTex(128,128,body,1,1,'#573e22');
})();
TEX.blued=(function(){
const R=texRng(221); let wear='';
for(let i=0;i<10;i++){
wear+=`<line x1="${(R()*128).toFixed(0)}" y1="${(R()*128).toFixed(0)}" x2="${(R()*128).toFixed(0)}" y2="${(R()*128).toFixed(0)}" stroke="rgba(150,155,160,${(0.06+R()*0.1).toFixed(2)})" stroke-width="0.7"/>`;
}
const body=`<defs>${svgGrain('bln','0.04 0.5','3',5)}</defs>`+
`<rect width="128" height="128" fill="#25282b"/>`+
`<rect width="128" height="128" filter="url(#bln)" opacity="0.12" style="mix-blend-mode:screen"/>`+wear;
return svgTex(128,128,body,1,1,'#25282b');
})();
TEX.park=(function(){
const R=texRng(231); let wear='';
for(let i=0;i<8;i++){
wear+=`<circle cx="${(R()*128).toFixed(0)}" cy="${(R()*128).toFixed(0)}" r="${(1+R()*2.4).toFixed(1)}" fill="rgba(120,124,116,${(0.1+R()*0.14).toFixed(2)})"/>`;
}
const body=`<defs>${svgGrain('pkn','0.7','2',15)}</defs>`+
`<rect width="128" height="128" fill="#3d423c"/>`+
`<rect width="128" height="128" filter="url(#pkn)" opacity="0.14" style="mix-blend-mode:overlay"/>`+wear;
return svgTex(128,128,body,1,1,'#3d423c');
})();
const vmMats = {
wood: new THREE.MeshLambertMaterial({map:TEX.gunwood}),
woodD: new THREE.MeshLambertMaterial({map:TEX.gunwoodD}),
gun: new THREE.MeshLambertMaterial({map:TEX.blued}),
gunL: new THREE.MeshLambertMaterial({color:0x44484a}),
park: new THREE.MeshLambertMaterial({map:TEX.park}),
bakelite: new THREE.MeshLambertMaterial({color:0x6b3f26}),
brass: new THREE.MeshLambertMaterial({color:0xb89440}),
sleeve0: new THREE.MeshLambertMaterial({color:0x4d5240}),
sleeve1: new THREE.MeshLambertMaterial({color:0x4a4d52}),
skin: new THREE.MeshLambertMaterial({color:0xc09878}),
nade: new THREE.MeshLambertMaterial({color:0x3a4232}),
};
vmMats.sleeve0.color.set(TEAM_FACTION[0].sleeve);
vmMats.sleeve1.color.set(TEAM_FACTION[1].sleeve);
