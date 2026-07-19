'use strict';
// ===================== SVG 矢量纹理管线 =====================
// svgTex(): 将手工设计的 SVG 矢量图光栅化为 CanvasTexture。
// 同步返回纹理(先填充底色占位), SVG 光栅化完成后自动刷新, 不阻塞加载流程。
function makeTex(w,h,fn,repX=1,repY=1){
const c=document.createElement('canvas'); c.width=w; c.height=h;
fn(c.getContext('2d'),w,h);
const t=new THREE.CanvasTexture(c);
t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(repX,repY);
t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
return t;
}
function speckle(g,w,h,n,c0,c1,smin,smax){
for(let i=0;i<n;i++){
g.fillStyle=Math.random()<.5?c0:c1;
g.globalAlpha=rand(.08,.4);
const s=rand(smin,smax);
g.fillRect(rand(0,w),rand(0,h),s,s);
}
g.globalAlpha=1;
}
function svgTex(w,h,body,repX=1,repY=1,base='#888'){
const c=document.createElement('canvas'); c.width=w; c.height=h;
const g=c.getContext('2d');
if(base){ g.fillStyle=base; g.fillRect(0,0,w,h); }
const t=new THREE.CanvasTexture(c);
t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(repX,repY);
t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+body+'</svg>';
const img=new Image();
img.onload=()=>{ g.clearRect(0,0,w,h); g.drawImage(img,0,0,w,h); t.needsUpdate=true; };
img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
return t;
}
// 确定性伪随机(纹理每次加载一致)
function texRng(seed){ let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
// 噪声滤镜片段: 叠加在底色上的颗粒/污渍层
function svgGrain(id,freq,oct,seed){
return `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">`+
`<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch" result="t"/>`+
`<feColorMatrix in="t" type="matrix" values="0 0 0 0 0.5, 0 0 0 0 0.5, 0 0 0 0 0.5, 0.8 0.8 0.8 0 0" result="g"/>`+
`</filter>`;
}
const TEX = {};
// ---------- 草地: 斑块底噪 + 草叶簇 ----------
TEX.grass=(function(){
const R=texRng(11); let blades='';
for(let i=0;i<240;i++){
const x=R()*384, y=R()*384, l=3+R()*7, dx=(R()-0.5)*5;
const c=['#7d8c52','#71824c','#657a44','#87965c'][(R()*4)|0];
blades+=`<path d="M${x.toFixed(1)} ${y.toFixed(1)} q ${(dx*0.4).toFixed(1)} ${(-l*0.6).toFixed(1)} ${dx.toFixed(1)} ${(-l).toFixed(1)}" stroke="${c}" stroke-width="${(0.7+R()*0.9).toFixed(1)}" fill="none" opacity="${(0.35+R()*0.4).toFixed(2)}"/>`;
}
let patches='';
for(let i=0;i<26;i++){
const x=R()*384, y=R()*384, r=10+R()*34;
patches+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r*(0.5+R()*0.5)).toFixed(0)}" fill="${R()<0.5?'#5e6e40':'#77874e'}" opacity="${(0.12+R()*0.2).toFixed(2)}"/>`;
}
const body=
`<defs>${svgGrain('gn','0.13','4',7)}${svgGrain('gn2','0.5','2',13)}</defs>`+
`<rect width="384" height="384" fill="#6b7a48"/>`+
`<rect width="384" height="384" filter="url(#gn)" opacity="0.22" style="mix-blend-mode:multiply"/>`+
patches+
`<rect width="384" height="384" filter="url(#gn2)" opacity="0.10" style="mix-blend-mode:overlay"/>`+
blades;
return svgTex(384,384,body,40,40,'#6b7a48');
})();
// ---------- 雪地: 微蓝阴影起伏 + 冰晶闪点 ----------
TEX.snowGround=(function(){
const R=texRng(21); let dots='', drifts='';
for(let i=0;i<60;i++){ dots+=`<circle cx="${(R()*384).toFixed(0)}" cy="${(R()*384).toFixed(0)}" r="${(0.6+R()*1.2).toFixed(1)}" fill="#ffffff" opacity="${(0.5+R()*0.5).toFixed(2)}"/>`; }
for(let i=0;i<20;i++){
const x=R()*384,y=R()*384,r=16+R()*46;
drifts+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r*0.45).toFixed(0)}" fill="${R()<0.5?'#dfe6ee':'#f7fafd'}" opacity="${(0.2+R()*0.25).toFixed(2)}" transform="rotate(${(R()*180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
}
const body=
`<defs>${svgGrain('sn','0.06','4',3)}</defs>`+
`<rect width="384" height="384" fill="#eef1f5"/>`+
`<rect width="384" height="384" filter="url(#sn)" opacity="0.16" style="mix-blend-mode:multiply"/>`+
drifts+dots;
return svgTex(384,384,body,40,40,'#eef1f5');
})();
// ---------- 泥土: 大地色斑块 + 碎石 ----------
TEX.dirt=(function(){
const R=texRng(31); let pebbles='', patches='';
for(let i=0;i<90;i++){
const x=R()*384,y=R()*384,r=1+R()*3;
pebbles+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(1)}" ry="${(r*0.7).toFixed(1)}" fill="${R()<0.5?'#8d7d5d':'#5f5138'}" opacity="${(0.4+R()*0.4).toFixed(2)}"/>`;
}
for(let i=0;i<18;i++){
const x=R()*384,y=R()*384,r=14+R()*44;
patches+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r*0.6).toFixed(0)}" fill="${R()<0.5?'#6d5d42':'#87765a'}" opacity="${(0.18+R()*0.2).toFixed(2)}"/>`;
}
const body=
`<defs>${svgGrain('dn','0.09','4',5)}</defs>`+
`<rect width="384" height="384" fill="#7a6a4e"/>`+
patches+
`<rect width="384" height="384" filter="url(#dn)" opacity="0.28" style="mix-blend-mode:multiply"/>`+
pebbles;
return svgTex(384,384,body,8,8,'#7a6a4e');
})();
// ---------- 砖墙: 错缝砖 + 灰浆槽 + 缺角风化 ----------
TEX.brick=(function(){
const R=texRng(41);
const W=512,H=512,bw=84,bh=40; let rows='';
for(let y=0,ri=0;y<H;y+=bh,ri++){
const off=ri%2? -bw/2:0;
for(let x=off;x<W;x+=bw){
const rr=120+R()*38, gg=72+R()*26, bb=52+R()*20;
const dk=`rgb(${(rr*0.62)|0},${(gg*0.62)|0},${(bb*0.62)|0})`;
const lt=`rgb(${Math.min(255,rr*1.18)|0},${Math.min(255,gg*1.18)|0},${Math.min(255,bb*1.18)|0})`;
rows+=`<g><rect x="${x+2}" y="${y+2}" width="${bw-4}" height="${bh-4}" fill="rgb(${rr|0},${gg|0},${bb|0})"/>`+
`<rect x="${x+2}" y="${y+2}" width="${bw-4}" height="3" fill="${lt}" opacity="0.5"/>`+
`<rect x="${x+2}" y="${y+bh-5}" width="${bw-4}" height="3" fill="${dk}" opacity="0.6"/>`+
`<rect x="${x+2}" y="${y+2}" width="3" height="${bh-4}" fill="${lt}" opacity="0.35"/>`;
if(R()<0.3){ const cx2=x+4+R()*(bw-14), cy2=y+4+R()*(bh-12); rows+=`<circle cx="${cx2.toFixed(0)}" cy="${cy2.toFixed(0)}" r="${(2+R()*4).toFixed(0)}" fill="${dk}" opacity="0.45"/>`; }
if(R()<0.16){ rows+=`<path d="M${x+2} ${y+2} l ${6+R()*9} 0 l ${-(6+R()*9)} ${5+R()*7} z" fill="rgb(58,38,30)" opacity="0.75"/>`; }
rows+=`</g>`;
}
}
let streaks='';
for(let i=0;i<10;i++){
const x=R()*W, l=30+R()*90;
streaks+=`<rect x="${x.toFixed(0)}" y="0" width="${(3+R()*8).toFixed(0)}" height="${l.toFixed(0)}" fill="#2e2018" opacity="${(0.06+R()*0.1).toFixed(2)}"/>`;
}
const body=
`<defs>${svgGrain('bn','0.16','3',9)}</defs>`+
`<rect width="512" height="512" fill="#5c4032"/>`+rows+
`<rect width="512" height="512" filter="url(#bn)" opacity="0.16" style="mix-blend-mode:multiply"/>`+streaks;
return svgTex(512,512,body,2,1.4,'#8a5a44');
})();
// ---------- 灰泥墙: 泛黄底 + 水渍 + 裂纹 + 底部露砖 ----------
TEX.plaster=(function(){
const R=texRng(51); const W=512,H=512;
let stains='';
for(let i=0;i<7;i++){
const x=R()*W, y=H*0.35+R()*H*0.6, r=18+R()*46;
stains+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r*(0.6+R()*0.5)).toFixed(0)}" fill="#7c5f47" opacity="${(0.14+R()*0.22).toFixed(2)}"/>`;
}
for(let i=0;i<5;i++){
const x=R()*W, w2=8+R()*20, l=40+R()*130;
stains+=`<rect x="${x.toFixed(0)}" y="0" width="${w2.toFixed(0)}" height="${l.toFixed(0)}" fill="#6e6250" opacity="${(0.08+R()*0.12).toFixed(2)}"/>`;
}
let cracks='';
for(let i=0;i<6;i++){
let x=R()*W, y=R()*H*0.5, d=`M${x.toFixed(0)} ${y.toFixed(0)}`;
for(let k=0;k<5;k++){ x+=(R()-0.5)*44; y+=14+R()*30; d+=` L${x.toFixed(0)} ${y.toFixed(0)}`; }
cracks+=`<path d="${d}" stroke="#4d4438" stroke-width="${(1+R()*1.2).toFixed(1)}" fill="none" opacity="${(0.4+R()*0.3).toFixed(2)}"/>`;
}
// 底部破损露砖块
let exposed='';
for(let i=0;i<4;i++){
const x=R()*W, y=H*0.72+R()*H*0.22, w2=30+R()*70, h2=20+R()*36;
exposed+=`<g><ellipse cx="${(x+w2/2).toFixed(0)}" cy="${(y+h2/2).toFixed(0)}" rx="${(w2*0.62).toFixed(0)}" ry="${(h2*0.62).toFixed(0)}" fill="#6f5b49"/>`;
for(let yy=0;yy<h2;yy+=12){
for(let xx=((yy/12)|0)%2?-11:0;xx<w2;xx+=22){
exposed+=`<rect x="${(x+xx).toFixed(0)}" y="${(y+yy).toFixed(0)}" width="20" height="10" fill="rgb(${118+R()*30|0},${70+R()*18|0},${52+R()*14|0})"/>`;
}
}
exposed+=`</g>`;
}
const body=
`<defs>${svgGrain('pn','0.045','5',15)}${svgGrain('pn2','0.4','2',8)}</defs>`+
`<rect width="512" height="512" fill="#b0a891"/>`+
`<rect width="512" height="512" filter="url(#pn)" opacity="0.20" style="mix-blend-mode:multiply"/>`+
`<rect width="512" height="512" filter="url(#pn2)" opacity="0.07" style="mix-blend-mode:overlay"/>`+
stains+exposed+cracks;
return svgTex(512,512,body,2,1.5,'#b0a891');
})();
// ---------- 石墙: 乱石砌块 + 凹缝 ----------
TEX.stone=(function(){
const R=texRng(61); const W=512,H=512; let blocks='';
for(let y=0,ri=0;y<H;y+=52,ri++){
let x=ri%2? -30:0;
while(x<W){
const w2=60+R()*70, base=122+R()*36;
const c=`rgb(${base|0},${(base*0.97)|0},${(base*0.9)|0})`;
const dk=`rgb(${(base*0.6)|0},${(base*0.58)|0},${(base*0.54)|0})`;
const lt=`rgb(${Math.min(255,base*1.16)|0},${Math.min(255,base*1.13)|0},${Math.min(255,base*1.08)|0})`;
blocks+=`<g><rect x="${(x+3).toFixed(0)}" y="${y+3}" width="${(w2-6).toFixed(0)}" height="46" rx="4" fill="${c}"/>`+
`<rect x="${(x+3).toFixed(0)}" y="${y+3}" width="${(w2-6).toFixed(0)}" height="4" rx="2" fill="${lt}" opacity="0.55"/>`+
`<rect x="${(x+3).toFixed(0)}" y="${y+45}" width="${(w2-6).toFixed(0)}" height="4" rx="2" fill="${dk}" opacity="0.6"/>`;
if(R()<0.4){ blocks+=`<ellipse cx="${(x+w2*0.5).toFixed(0)}" cy="${y+24}" rx="${(w2*0.24).toFixed(0)}" ry="10" fill="${R()<0.5?dk:lt}" opacity="0.16"/>`; }
blocks+=`</g>`;
x+=w2;
}
}
const body=
`<defs>${svgGrain('stn','0.14','4',22)}</defs>`+
`<rect width="512" height="512" fill="#55534b"/>`+blocks+
`<rect width="512" height="512" filter="url(#stn)" opacity="0.16" style="mix-blend-mode:multiply"/>`;
return svgTex(512,512,body,2,1.5,'#8d8a80');
})();
// ---------- 木板: 竖板 + 木纹 + 节疤 + 钉孔 ----------
TEX.wood=(function(){
const R=texRng(71); const W=512,H=512; let planks='';
for(let x=0;x<W;x+=64){
const rr=95+R()*32, gg=rr*0.74, bb=rr*0.5;
planks+=`<rect x="${x+2}" y="0" width="60" height="${H}" fill="rgb(${rr|0},${gg|0},${bb|0})"/>`;
for(let i=0;i<7;i++){
const yy=R()*H;
planks+=`<path d="M${x+2} ${yy.toFixed(0)} C ${x+18} ${(yy+(R()-0.5)*22).toFixed(0)}, ${x+44} ${(yy+(R()-0.5)*22).toFixed(0)}, ${x+62} ${(yy+(R()-0.5)*30).toFixed(0)}" stroke="rgba(52,36,20,0.5)" stroke-width="${(0.8+R()*1.2).toFixed(1)}" fill="none"/>`;
}
if(R()<0.6){
const ky=R()*H;
planks+=`<ellipse cx="${(x+14+R()*36).toFixed(0)}" cy="${ky.toFixed(0)}" rx="${(3+R()*4).toFixed(0)}" ry="${(4+R()*6).toFixed(0)}" fill="#3f2d1a" opacity="0.8"/>`;
}
planks+=`<circle cx="${x+10}" cy="14" r="1.8" fill="#2c2014"/><circle cx="${x+52}" cy="14" r="1.8" fill="#2c2014"/>`+
`<circle cx="${x+10}" cy="${H-14}" r="1.8" fill="#2c2014"/><circle cx="${x+52}" cy="${H-14}" r="1.8" fill="#2c2014"/>`;
planks+=`<rect x="${x}" y="0" width="2" height="${H}" fill="#33241463"/><rect x="${x+62}" y="0" width="2" height="${H}" fill="#33241463"/>`;
}
const body=
`<defs>${svgGrain('wn','0.02 0.4','4',33)}</defs>`+
`<rect width="512" height="512" fill="#6e5638"/>`+planks+
`<rect width="512" height="512" filter="url(#wn)" opacity="0.18" style="mix-blend-mode:multiply"/>`;
return svgTex(512,512,body,1.5,1.5,'#6e5638');
})();
// ---------- 深色木纹 ----------
TEX.woodDark=(function(){
const R=texRng(81); let grain='';
for(let i=0;i<26;i++){
grain+=`<path d="M0 ${(R()*256).toFixed(0)} C 76 ${(R()*256).toFixed(0)}, 180 ${(R()*256).toFixed(0)}, 256 ${(R()*256).toFixed(0)}" stroke="rgba(${30+R()*30|0},${24+R()*20|0},${12+R()*14|0},0.6)" stroke-width="${(1+R()*2).toFixed(1)}" fill="none"/>`;
}
const body=
`<defs>${svgGrain('wdn','0.3 0.04','3',12)}</defs>`+
`<rect width="256" height="256" fill="#4a3a24"/>`+grain+
`<rect width="256" height="256" filter="url(#wdn)" opacity="0.22" style="mix-blend-mode:multiply"/>`;
return svgTex(256,256,body,1,1,'#4a3a24');
})();
// ---------- 沙袋: 错缝袋体 + 缝线 + 织物噪声 ----------
TEX.sandbag=(function(){
const R=texRng(91); const W=256,H=256; let bags='';
for(let y=0,ri=0;y<H;y+=44,ri++){
const off=ri%2?44:0;
for(let x=-88;x<W;x+=88){
const rr=140+R()*26, gg=125+R()*20, bb=88+R()*16;
const cx2=x+off+44, cy2=y+22;
bags+=`<g><ellipse cx="${cx2}" cy="${cy2+3}" rx="41" ry="18" fill="#4c422c" opacity="0.5"/>`+
`<ellipse cx="${cx2}" cy="${cy2}" rx="40" ry="18" fill="rgb(${rr|0},${gg|0},${bb|0})"/>`+
`<ellipse cx="${cx2}" cy="${cy2-5}" rx="34" ry="10" fill="rgb(${Math.min(255,rr*1.13)|0},${Math.min(255,gg*1.12)|0},${Math.min(255,bb*1.1)|0})" opacity="0.5"/>`+
`<path d="M${cx2-38} ${cy2} a 38 16 0 0 0 76 0" stroke="rgba(80,70,45,0.75)" stroke-width="1.4" fill="none" stroke-dasharray="3 2.4"/>`+
`<line x1="${cx2-40}" y1="${cy2-2}" x2="${cx2-32}" y2="${cy2-8}" stroke="rgba(90,78,50,0.8)" stroke-width="2"/>`+
`</g>`;
}
}
const body=
`<defs>${svgGrain('sbn','0.5','2',18)}</defs>`+
`<rect width="256" height="256" fill="#9a8a62"/>`+bags+
`<rect width="256" height="256" filter="url(#sbn)" opacity="0.10" style="mix-blend-mode:multiply"/>`;
return svgTex(256,256,body,2,2,'#9a8a62');
})();
// ---------- 金属: 拉丝 + 划痕 + 锈斑 ----------
TEX.metal=(function(){
const R=texRng(101); let scr='', rust='';
for(let i=0;i<14;i++){
const y=R()*256;
scr+=`<line x1="${(R()*256).toFixed(0)}" y1="${y.toFixed(0)}" x2="${(R()*256).toFixed(0)}" y2="${(y+(R()-0.5)*30).toFixed(0)}" stroke="${R()<0.5?'#71776a':'#3f443c'}" stroke-width="${(0.6+R()*0.9).toFixed(1)}" opacity="${(0.3+R()*0.4).toFixed(2)}"/>`;
}
for(let i=0;i<8;i++){
const x=R()*256,y=R()*256,r=3+R()*10;
rust+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r*0.7).toFixed(0)}" fill="#6e4a2c" opacity="${(0.2+R()*0.3).toFixed(2)}"/>`+
`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(r*0.5).toFixed(0)}" ry="${(r*0.35).toFixed(0)}" fill="#7d5836" opacity="${(0.3+R()*0.3).toFixed(2)}"/>`;
}
const body=
`<defs>${svgGrain('mn','0.02 0.3','3',6)}${svgGrain('mn2','0.6','2',19)}</defs>`+
`<rect width="256" height="256" fill="#5a5f56"/>`+
`<rect width="256" height="256" filter="url(#mn)" opacity="0.14" style="mix-blend-mode:overlay"/>`+
scr+rust+
`<rect width="256" height="256" filter="url(#mn2)" opacity="0.08" style="mix-blend-mode:multiply"/>`;
return svgTex(256,256,body,1,1,'#5a5f56');
})();
// ---------- 树皮: 纵向沟壑 ----------
TEX.bark=(function(){
const R=texRng(111); let ridges='';
for(let x=0;x<256;x+=10){
const w2=4+R()*6, c=60+R()*30;
ridges+=`<rect x="${x}" y="0" width="${w2.toFixed(0)}" height="256" fill="rgb(${c|0},${(c*0.8)|0},${(c*0.55)|0})" opacity="0.85"/>`;
if(R()<0.5){ ridges+=`<path d="M${x+2} ${(R()*256).toFixed(0)} q ${(R()-0.5)*8} 30 ${(R()-0.5)*6} ${(50+R()*80).toFixed(0)}" stroke="#33261675" stroke-width="2" fill="none"/>`; }
}
const body=
`<defs>${svgGrain('bkn','0.08 0.4','4',25)}</defs>`+
`<rect width="256" height="256" fill="#5d4c36"/>`+ridges+
`<rect width="256" height="256" filter="url(#bkn)" opacity="0.25" style="mix-blend-mode:multiply"/>`;
return svgTex(256,256,body,1,2,'#5d4c36');
})();
// ---------- 树叶: 多层叶簇(带透明) ----------
TEX.leaves=(function(){
const R=texRng(121); let leaves='';
for(let i=0;i<380;i++){
const x=R()*256,y=R()*256;
const d=Math.hypot(x-128,y-128); if(d>118) continue;
const gg=85+R()*38;
leaves+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(5+R()*9).toFixed(0)}" ry="${(3+R()*7).toFixed(0)}" fill="rgb(${(gg*0.72)|0},${gg|0},${(gg*0.5)|0})" opacity="${(0.5+R()*0.5).toFixed(2)}" transform="rotate(${(R()*180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
}
for(let i=0;i<70;i++){
const x=R()*256,y=R()*256;
const d=Math.hypot(x-128,y-128); if(d>110) continue;
const gg=110+R()*30;
leaves+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(3+R()*5).toFixed(0)}" ry="${(2+R()*4).toFixed(0)}" fill="rgb(${(gg*0.75)|0},${gg|0},${(gg*0.48)|0})" opacity="${(0.55+R()*0.45).toFixed(2)}" transform="rotate(${(R()*180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
}
return svgTex(256,256,leaves,1,1,null);
})();
// ---------- 瓦顶: 弧形瓦排 + 行间阴影 + 破损瓦 ----------
TEX.roof=(function(){
const R=texRng(131); const W=512,H=512; let tiles='';
for(let y=0,ri=0;y<H;y+=48,ri++){
tiles+=`<rect x="0" y="${y+40}" width="${W}" height="10" fill="#3a2420" opacity="0.55"/>`;
const off=ri%2?30:0;
for(let x=-60;x<W;x+=60){
const rr=100+R()*30, gg=58+R()*16, bb=46+R()*14;
if(R()<0.05){ tiles+=`<rect x="${x+off+1}" y="${y+1}" width="58" height="44" fill="#241814"/>`; continue; }
const slip=R()<0.12? 4:0;
tiles+=`<g><path d="M${x+off} ${y+slip} h 60 v 40 a 30 9 0 0 1 -60 0 z" fill="rgb(${rr|0},${gg|0},${bb|0})"/>`+
`<path d="M${x+off} ${y+slip} h 60 v 5 h -60 z" fill="rgb(${Math.min(255,rr*1.2)|0},${Math.min(255,gg*1.2)|0},${Math.min(255,bb*1.2)|0})" opacity="0.5"/>`+
`<path d="M${x+off} ${y+slip+36} a 30 9 0 0 0 60 0 v 4 a 30 9 0 0 1 -60 0 z" fill="#241511" opacity="0.5"/>`+
`<line x1="${x+off}" y1="${y+slip}" x2="${x+off}" y2="${y+slip+42}" stroke="#2e1b16" stroke-width="1.6" opacity="0.6"/></g>`;
if(R()<0.18){ tiles+=`<ellipse cx="${(x+off+16+R()*30).toFixed(0)}" cy="${(y+10+R()*24).toFixed(0)}" rx="${(4+R()*8).toFixed(0)}" ry="${(3+R()*5).toFixed(0)}" fill="#5d7350" opacity="${(0.2+R()*0.25).toFixed(2)}"/>`; }
}
}
const body=
`<defs>${svgGrain('rn','0.2','3',17)}</defs>`+
`<rect width="512" height="512" fill="#50302a"/>`+tiles+
`<rect width="512" height="512" filter="url(#rn)" opacity="0.13" style="mix-blend-mode:multiply"/>`;
return svgTex(512,512,body,2,2,'#6e4438');
})();
// ---------- 干草: 定向草秆 ----------
TEX.hay=(function(){
const R=texRng(141); let strands='';
for(let i=0;i<330;i++){
const x=R()*256,y=R()*256,l=8+R()*18,a=(R()-0.5)*0.9;
const rr=150+R()*40, gg=130+R()*30, bb=70+R()*25;
strands+=`<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x+Math.cos(a)*l).toFixed(0)}" y2="${(y+Math.sin(a)*l*0.4).toFixed(0)}" stroke="rgb(${rr|0},${gg|0},${bb|0})" stroke-width="${(0.8+R()*1).toFixed(1)}" opacity="${(0.5+R()*0.4).toFixed(2)}"/>`;
}
const body=
`<defs>${svgGrain('hn','0.3','2',28)}</defs>`+
`<rect width="256" height="256" fill="#a8915a"/>`+strands+
`<rect width="256" height="256" filter="url(#hn)" opacity="0.12" style="mix-blend-mode:multiply"/>`;
return svgTex(256,256,body,2,2,'#b09a58');
})();
// ---------- 履带: 橡胶垫块 + 导齿 ----------
TEX.track=(function(){
let t='';
for(let y=0;y<128;y+=16){
t+=`<rect x="4" y="${y+2}" width="120" height="10" rx="2" fill="#3d3e36"/>`+
`<rect x="4" y="${y+2}" width="120" height="3" rx="1.5" fill="#4c4e44" opacity="0.8"/>`+
`<rect x="12" y="${y+4}" width="104" height="4" fill="#23241f"/>`+
`<rect x="58" y="${y+11}" width="12" height="5" fill="#1c1d18"/>`;
}
const body=`<rect width="128" height="128" fill="#2e2f2a"/>`+t;
return svgTex(128,128,body,1,4,'#2e2f2a');
})();
const MAT = {
grass: new THREE.MeshLambertMaterial({map:TEX.grass, vertexColors:true}),
brick: new THREE.MeshLambertMaterial({map:TEX.brick}),
plaster: new THREE.MeshLambertMaterial({map:TEX.plaster}),
stone: new THREE.MeshLambertMaterial({map:TEX.stone}),
wood: new THREE.MeshLambertMaterial({map:TEX.wood}),
woodDark: new THREE.MeshLambertMaterial({map:TEX.woodDark}),
sandbag: new THREE.MeshLambertMaterial({map:TEX.sandbag}),
metal: new THREE.MeshLambertMaterial({map:TEX.metal}),
metalDark: new THREE.MeshLambertMaterial({color:0x3a3d38}),
bark: new THREE.MeshLambertMaterial({map:TEX.bark}),
leaves: new THREE.MeshLambertMaterial({map:TEX.leaves, transparent:true, alphaTest:0.5, side:THREE.DoubleSide}),
roof: new THREE.MeshLambertMaterial({map:TEX.roof}),
hay: new THREE.MeshLambertMaterial({map:TEX.hay}),
rubble: new THREE.MeshLambertMaterial({color:0x8a8378}),
hedge: new THREE.MeshLambertMaterial({map:TEX.leaves,transparent:true,alphaTest:0.4}),
tentA: new THREE.MeshLambertMaterial({color:0x5e6244}),
tentB: new THREE.MeshLambertMaterial({color:0x565a3e}),
craterRim: new THREE.MeshLambertMaterial({color:0x5d5344}),
};
// 战役环境主题着色: 地面/树叶/屋顶随战场变化 (雪地/废墟/江南/黄土)
MAT.grass.color.set(THEME.ground);
MAT.leaves.color.set(THEME.leaf);
MAT.roof.color.set(THEME.roof);
if(THEME.snow){ MAT.grass.map=TEX.snowGround; MAT.sandbag.color.set(0xd8dade); MAT.hay.color.set(0xcfd2d6); MAT.stone.color.set(0xc8ccd2); }
if(CAMPAIGN.theme==='loess'){ MAT.stone.color.set(0xd8c8a0); MAT.plaster.color.set(0xe0d0a8); }
// 雪檐房顶覆盖: 雪地战役给屋顶叠加一层带出檐的积雪盖板 (作为屋顶子节点, 随屋顶坍塌一并消失)
MAT.snowCap=new THREE.MeshLambertMaterial({color:0xedf2f8});
function addSnowCap(rm){
if(!THEME.snow||!rm||!rm.geometry||!rm.geometry.parameters) return rm;
const gp=rm.geometry.parameters;
if(gp.width===undefined||gp.depth===undefined) return rm;
const cap=new THREE.Mesh(new THREE.BoxGeometry(gp.width+0.16,0.13,gp.depth+0.16),MAT.snowCap);
cap.position.y=(gp.height||0.2)/2+0.065;
cap.castShadow=false; cap.receiveShadow=true;
rm.add(cap);
return rm;
}
// 平整区: 基地+旗点自动生成 (高度自适应当地地形, 避免高原/悬崖)
