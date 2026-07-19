'use strict';
/* ================= gfx.js — SVG procedural textures + PBR materials ================= */

const Tex={_cache:{},pending:0};
function svgWrap(inner,size,bg){
  size=size||256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256">`+
    (bg?`<rect width="256" height="256" fill="${bg}"/>`:'')+inner+`</svg>`;
}
function svgTex(key,svgStr,opts){
  opts=opts||{};
  if(Tex._cache[key])return Tex._cache[key];
  const size=opts.size||256;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');ctx.fillStyle=opts.bg||'#808080';ctx.fillRect(0,0,size,size);
  const tex=new THREE.CanvasTexture(canvas);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  if(opts.repeat)tex.repeat.set(opts.repeat[0],opts.repeat[1]);
  Tex.pending++;
  const img=new Image();
  const url=URL.createObjectURL(new Blob([svgStr],{type:'image/svg+xml'}));
  img.onload=()=>{ctx.clearRect(0,0,size,size);ctx.drawImage(img,0,0,size,size);tex.needsUpdate=true;URL.revokeObjectURL(url);Tex.pending--};
  img.onerror=()=>{Tex.pending--;console.error('svgTex fail:'+key)};
  img.src=url;
  Tex._cache[key]=tex;return tex;
}
/* speckle helper with tile-wrap duplicates */
function _speck(rng,n,colors,rmin,rmax,op){
  let s='';
  for(let i=0;i<n;i++){
    const x=rng()*256,y=rng()*256,r=rmin+rng()*(rmax-rmin);
    const c=colors[(rng()*colors.length)|0],o=op===undefined?0.5+rng()*0.5:op;
    for(const dx of[-256,0,256])for(const dy of[-256,0,256]){
      if(x+dx>-r&&x+dx<256+r&&y+dy>-r&&y+dy<256+r)
        s+=`<circle cx="${(x+dx).toFixed(1)}" cy="${(y+dy).toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" opacity="${o.toFixed(2)}"/>`;
    }
  }
  return s;
}

/* ---------------- texture generators ---------------- */
Tex.ground=(key,c1,c2,c3,seed)=>svgTex('gnd'+key,(()=>{
  const rng=mulberry32(seed||1);
  let s=_speck(rng,90,[c2,c3],4,26,0.25)+_speck(rng,160,[c2,c1,c3],0.8,3.5,0.6);
  return svgWrap(s,256,c1);
})(),{size:256});

Tex.grass=(key,c1,c2,seed)=>svgTex('grs'+key,(()=>{
  const rng=mulberry32(seed||2);
  let s=_speck(rng,70,[c2],3,18,0.2);
  for(let i=0;i<420;i++){
    const x=rng()*256,y=rng()*256,l=3+rng()*7,dx=(rng()-0.5)*4;
    const c=rng()<0.5?c2:c1;
    s+=`<path d="M ${x} ${y} q ${dx} ${-l} ${dx*1.5} ${-l*1.4}" stroke="${c}" stroke-width="1.1" fill="none" opacity="0.75"/>`;
  }
  return svgWrap(s,256,c1);
})(),{size:256});

Tex.rock=(key,c1,c2,seed)=>svgTex('rck'+key,(()=>{
  const rng=mulberry32(seed||3);
  let s=_speck(rng,50,[c2],6,30,0.3)+_speck(rng,120,[c1,c2,'#00000030'],1,4,0.7);
  for(let i=0;i<26;i++){
    const x=rng()*256,y=rng()*256,l=15+rng()*45,a=rng()*Math.PI;
    s+=`<line x1="${x}" y1="${y}" x2="${x+Math.cos(a)*l}" y2="${y+Math.sin(a)*l}" stroke="#00000055" stroke-width="${1+rng()*1.6}"/>`;
  }
  return svgWrap(s,256,c1);
})(),{size:256});

Tex.metal=(key,base,line)=>svgTex('mtl'+key,(()=>{
  const rng=mulberry32(11);line=line||'#00000040';
  let s='';
  for(let i=0;i<5;i++){const y=12+i*50+rng()*18;s+=`<line x1="0" y1="${y}" x2="256" y2="${y}" stroke="${line}" stroke-width="2"/>`}
  for(let i=0;i<4;i++){const x=20+i*64+rng()*20;s+=`<line x1="${x}" y1="0" x2="${x}" y2="256" stroke="${line}" stroke-width="2"/>`}
  s+=_speck(rng,60,['#ffffff18','#00000022'],1,3,0.8);
  for(let i=0;i<40;i++){const x=rng()*256,y=rng()*256;s+=`<circle cx="${x}" cy="${y}" r="1.4" fill="#00000055"/>`}
  return svgWrap(s,256,base);
})(),{size:256});

Tex.hull=(key,base,accent,decal)=>svgTex('hul'+key,(()=>{
  const rng=mulberry32(21);
  let s='';
  for(let i=0;i<6;i++){const y=8+i*42+rng()*10;s+=`<line x1="0" y1="${y}" x2="256" y2="${y}" stroke="#00000035" stroke-width="1.6"/>`}
  for(let i=0;i<5;i++){const x=10+i*52+rng()*14;s+=`<line x1="${x}" y1="0" x2="${x}" y2="256" stroke="#00000030" stroke-width="1.6"/>`}
  s+=`<rect x="0" y="96" width="256" height="26" fill="${accent}" opacity="0.95"/>`;
  s+=`<rect x="0" y="126" width="256" height="6" fill="#20242a" opacity="0.9"/>`;
  for(let i=0;i<70;i++){const x=rng()*256,y=rng()*256;s+=`<circle cx="${x}" cy="${y}" r="1.1" fill="#00000060"/>`}
  s+=_speck(rng,30,['#ffffff20','#00000018'],2,7,0.6);
  if(decal)s+=`<text x="128" y="88" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="bold" fill="#2a2f36" text-anchor="middle" opacity="0.92">${decal}</text>`;
  return svgWrap(s,256,base);
})(),{size:512});

Tex.tread=()=>svgTex('tread',(()=>{
  let s='';
  for(let i=0;i<16;i++){const x=i*16;
    s+=`<path d="M ${x} 0 l 10 0 l -6 128 l 6 128 l -10 0 l -6 -128 z" fill="#0b0b0b"/>`;
    s+=`<rect x="${x+3}" y="0" width="3" height="256" fill="#222" opacity="0.5"/>`;
  }
  s+=`<rect x="0" y="118" width="256" height="20" fill="#1c1c1c"/>`;
  return svgWrap(s,256,'#161616');
})(),{size:256});

Tex.road=()=>svgTex('road',(()=>{
  const rng=mulberry32(31);
  let s=_speck(rng,220,['#3a3d42','#26282c','#4a4d52'],0.8,3,0.7);
  s+=`<rect x="4" y="0" width="5" height="256" fill="#cfd3d8" opacity="0.85"/>`;
  s+=`<rect x="247" y="0" width="5" height="256" fill="#cfd3d8" opacity="0.85"/>`;
  for(let y=0;y<256;y+=64)s+=`<rect x="124" y="${y}" width="8" height="34" fill="#e8c33a" opacity="0.9"/>`;
  return svgWrap(s,256,'#2e3136');
})(),{size:256});

Tex.pad=()=>svgTex('pad',(()=>{
  const rng=mulberry32(41);
  let s=_speck(rng,150,['#3c4046','#282b30'],1,4,0.6);
  s+=`<circle cx="128" cy="128" r="104" fill="none" stroke="#e8b13a" stroke-width="8"/>`;
  s+=`<circle cx="128" cy="128" r="70" fill="none" stroke="#cfd3d8" stroke-width="4" opacity="0.7"/>`;
  for(let i=0;i<4;i++){const a=i*90*DEG;
    const x=128+Math.cos(a)*118,y=128+Math.sin(a)*118;
    s+=`<path d="M ${x} ${y} l ${Math.cos(a)*14-Math.sin(a)*10} ${Math.sin(a)*14+Math.cos(a)*10} l ${Math.sin(a)*20} ${-Math.cos(a)*20} z" fill="#e8b13a"/>`;
  }
  s+=`<text x="128" y="146" font-family="Arial" font-size="56" font-weight="bold" fill="#dde2e8" text-anchor="middle">S</text>`;
  return svgWrap(s,256,'#33363c');
})(),{size:512});

Tex.facade=(key,wall,seed,night)=>svgTex('fac'+key+(night?'N':'D'),(()=>{
  const rng=mulberry32(seed||51);
  const rows=6,cols=5;let s='';
  if(night)s='';
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x=14+c*48,y=12+r*40,lit=rng()<0.42;
    if(!night){
      s+=`<rect x="${x}" y="${y}" width="34" height="26" fill="#182028" stroke="#0d1216" stroke-width="2"/>`;
      s+=`<rect x="${x+2}" y="${y+2}" width="30" height="10" fill="#2c3d4e" opacity="0.8"/>`;
    }else if(lit){
      const c2=rng()<0.3?'#ffd98a':'#bfe3ff';
      s+=`<rect x="${x}" y="${y}" width="34" height="26" fill="${c2}"/>`;
    }
  }
  if(!night){
    s+=`<rect x="0" y="0" width="256" height="6" fill="#00000040"/>`;
    s+=`<rect x="0" y="250" width="256" height="6" fill="#00000040"/>`;
  }
  return svgWrap(s,256,night?'#000000':wall);
})(),{size:256});

Tex.crate=()=>svgTex('crate',(()=>{
  let s=`<rect x="10" y="10" width="236" height="236" fill="none" stroke="#565b63" stroke-width="14"/>`;
  s+=`<rect x="60" y="60" width="136" height="136" fill="#3d4148" stroke="#565b63" stroke-width="8"/>`;
  s+=`<text x="128" y="140" font-family="Arial" font-size="30" font-weight="bold" fill="#e8b13a" text-anchor="middle">CARGO</text>`;
  for(let i=0;i<4;i++)s+=`<circle cx="${30+i*65}" cy="30" r="5" fill="#23262b"/>`;
  return svgWrap(s,256,'#4a4f57');
})(),{size:256});

Tex.barrel=()=>svgTex('barrel',(()=>{
  let s='';
  for(let i=0;i<4;i++)s+=`<rect x="0" y="${28+i*60}" width="256" height="14" fill="#00000045"/>`;
  s+=`<rect x="0" y="106" width="256" height="44" fill="#e8b13a" opacity="0.9"/>`;
  s+=`<text x="128" y="136" font-family="Arial" font-size="26" font-weight="bold" fill="#23262b" text-anchor="middle">FUEL</text>`;
  return svgWrap(s,256,'#7a3f2a');
})(),{size:256});

Tex.caution=()=>svgTex('caution',(()=>{
  let s='';
  for(let i=-4;i<9;i++)s+=`<path d="M ${i*48} 256 l 48 -256 l 24 0 l -48 256 z" fill="#e8b13a"/>`;
  return svgWrap(s,256,'#23262b');
})(),{size:128});

Tex.solar=()=>svgTex('solar',(()=>{
  let s='';
  for(let r=0;r<4;r++)for(let c=0;c<4;c++)
    s+=`<rect x="${c*64+3}" y="${r*64+3}" width="58" height="58" fill="#1b3a6b" stroke="#4a7ec2" stroke-width="2"/>`+
       `<line x1="${c*64+3}" y1="${r*64+32}" x2="${c*64+61}" y2="${r*64+32}" stroke="#4a7ec2" stroke-width="1"/>`;
  return svgWrap(s,256,'#10121a');
})(),{size:256});

Tex.dash=()=>svgTex('dash',(()=>{
  let s=`<rect x="8" y="8" width="240" height="240" rx="10" fill="#071018"/>`;
  s+=`<circle cx="70" cy="80" r="44" fill="none" stroke="#35e0ff" stroke-width="5"/>`;
  s+=`<path d="M 70 80 L 100 52" stroke="#ffb03a" stroke-width="5"/>`;
  s+=`<circle cx="185" cy="80" r="44" fill="none" stroke="#35e0ff" stroke-width="5"/>`;
  s+=`<path d="M 185 80 L 160 110" stroke="#ff5a5a" stroke-width="5"/>`;
  for(let i=0;i<6;i++)s+=`<rect x="${28+i*36}" y="160" width="24" height="${20+((i*37)%50)}" fill="#35e0ff" opacity="0.85"/>`;
  s+=`<rect x="20" y="228" width="216" height="8" fill="#173040"/>`;
  return svgWrap(s,256,'#04070c');
})(),{size:256});

Tex.neon=(key,text,c)=>svgTex('neon'+key,(()=>{
  let s=`<rect x="6" y="70" width="244" height="116" rx="14" fill="#0a0e14" stroke="${c}" stroke-width="5"/>`;
  s+=`<text x="128" y="148" font-family="Arial" font-size="44" font-weight="bold" fill="${c}" text-anchor="middle">${text}</text>`;
  return svgWrap(s,256,'#05070a');
})(),{size:256});

Tex.glow=(key,c)=>svgTex('glow'+key,svgWrap(
  `<defs><radialGradient id="g"><stop offset="0%" stop-color="${c}" stop-opacity="1"/><stop offset="35%" stop-color="${c}" stop-opacity="0.5"/><stop offset="100%" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><circle cx="128" cy="128" r="128" fill="url(#g)"/>`),
  {size:128});

Tex.star=()=>svgTex('star',svgWrap(
  `<defs><radialGradient id="g"><stop offset="0%" stop-color="#ffffff"/><stop offset="18%" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><circle cx="128" cy="128" r="128" fill="url(#g)"/>`),
  {size:64});

Tex.nebula=(key,c1,c2,seed)=>svgTex('neb'+key,(()=>{
  const rng=mulberry32(seed||61);
  let s=`<defs><filter id="b"><feGaussianBlur stdDeviation="18"/></filter></defs><g filter="url(#b)">`;
  for(let i=0;i<10;i++){
    const x=40+rng()*176,y=40+rng()*176,rx=20+rng()*70,ry=14+rng()*50,rot=rng()*180;
    s+=`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${rng()<0.5?c1:c2}" opacity="${0.12+rng()*0.2}" transform="rotate(${rot} ${x} ${y})"/>`;
  }
  return svgWrap(s+'</g>',256);
})(),{size:256});

Tex.ring=(key,c)=>svgTex('ring'+key,(()=>{
  const rng=mulberry32(71);
  let s='';
  for(let i=0;i<26;i++){
    const r=52+i*2.9,o=(0.12+0.55*vnoise3(i*0.35,0,0,9))*(i%5===0?0.4:1);
    s+=`<circle cx="128" cy="128" r="${r}" fill="none" stroke="${c}" stroke-width="2.6" opacity="${o.toFixed(2)}"/>`;
  }
  return svgWrap(s,256);
})(),{size:256});

Tex.waterBump=()=>svgTex('waterB',(()=>{
  const rng=mulberry32(81);
  let s=`<defs><filter id="b"><feGaussianBlur stdDeviation="3"/></filter></defs><g filter="url(#b)">`;
  s+=_speck(rng,150,['#ffffff','#9a9a9a','#4a4a4a'],3,14,0.5);
  return svgWrap(s+'</g>',256,'#707070');
})(),{size:256});

/* 星球表面贴图（等距圆柱UV，灰度细节层，乘在顶点色调色板之上）。
   横向必须可平铺（u=0/1 接缝在球背面闭合）：波浪用整数周期正弦、斑点用 _speck 环绕副本、坑洞避开边缘 */
function _wavyBand(y0,amp,tone,op,rng){
  const k1=1+((rng()*3)|0),k2=2+((rng()*4)|0),p1=rng()*6.283,p2=rng()*6.283;
  let d='M 0 '+y0.toFixed(1);
  for(let x=8;x<=256;x+=8){
    const y=y0+Math.sin(x/256*6.283*k1+p1)*amp+Math.sin(x/256*6.283*k2+p2)*amp*0.5;
    d+=' L '+x+' '+y.toFixed(1);
  }
  return `<path d="${d} L 256 256 L 0 256 Z" fill="${tone}" opacity="${op}"/>`;
}
Tex.planet=(pl)=>{
  const T=pl.type,key='pln'+T+(pl.seed%8);
  return svgTex(key,(()=>{
    const rng=mulberry32((pl.seed%8)*977+T.length*131+7);
    const g=v=>{const h=Math.round(clamp(v,0,255)).toString(16).padStart(2,'0');return '#'+h+h+h};
    let s='';
    if(T==='gas'){
      const n=9+((rng()*5)|0);
      for(let i=0;i<n;i++){
        const y0=(i+0.3)*(256/n)+rng()*8;
        s+=_wavyBand(y0,3+rng()*9,g(150+rng()*105),0.5+rng()*0.4,rng);
      }
      for(let i=0;i<4;i++){
        const x=30+rng()*196,y=40+rng()*176,rx=10+rng()*22,ry=rx*(0.4+rng()*0.3);
        s+=`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${g(rng()<0.5?120:245)}" opacity="0.5"/>`;
      }
    }else if(T==='rock'||T==='ice'||T==='tundra'||T==='lava'){
      s+=_speck(rng,60,[g(150),g(235)],6,30,0.18)+_speck(rng,150,[g(120),g(200),g(255)],1,4,0.4);
      for(let i=0;i<16;i++){
        const x=26+rng()*204,y=26+rng()*204,r=4+rng()*15;
        s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="#000000" opacity="0.2"/>`+
           `<circle cx="${x}" cy="${(y-r*0.14).toFixed(1)}" r="${(r*0.72).toFixed(1)}" fill="#000000" opacity="0.16"/>`+
           `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.3"/>`;
      }
      if(T==='lava')for(let i=0;i<10;i++){
        const y0=20+rng()*216;
        s+=_wavyBand(y0,2+rng()*4,'#ffffff',0.12,rng);
      }
    }else if(T==='desert'){
      for(let i=0;i<12;i++)s+=_wavyBand(10+i*21+rng()*8,2+rng()*5,g(165+rng()*90),0.35,rng);
      s+=_speck(rng,90,[g(140),g(240)],2,8,0.3);
    }else if(T==='toxic'){
      for(let i=0;i<9;i++){
        const x=rng()*256,y=rng()*256,r=18+rng()*40;
        for(const dx of[-256,0,256])
          s+=`<circle cx="${x+dx}" cy="${y}" r="${r}" fill="none" stroke="${g(140+rng()*110)}" stroke-width="${4+rng()*7}" opacity="0.3"/>`;
      }
      s+=_speck(rng,120,[g(130),g(230)],2,9,0.35);
    }else{ /* temperate / forest / ocean —— 大陆状明暗斑块 */
      for(let i=0;i<8;i++){
        const x=rng()*256,y=30+rng()*196,tone=g(rng()<0.5?150:235);
        let blob='';
        for(let k=0;k<6;k++)blob+=`<circle cx="${(x+(rng()-0.5)*46).toFixed(1)}" cy="${(y+(rng()-0.5)*38).toFixed(1)}" r="${(10+rng()*22).toFixed(1)}" fill="${tone}" opacity="0.24"/>`;
        for(const dx of[-256,0,256])s+=`<g transform="translate(${dx} 0)">`+blob+`</g>`;
      }
      s+=_speck(rng,140,[g(140),g(225),g(255)],1,5,0.35);
    }
    return svgWrap(s,256,g(208));
  })(),{size:512,bg:'#ffffff'});
};


Tex.canopy=(key,c1,c2,seed)=>svgTex('cnp'+key,(()=>{
  const rng=mulberry32(seed||91);
  let s=_speck(rng,240,[c2,c1,'#00000030'],2,9,0.8);
  return svgWrap(s,256,c1);
})(),{size:256});

Tex.frond=(key,c)=>svgTex('frond'+key,(()=>{
  let s=`<path d="M 128 250 L 122 20 L 128 6 L 134 20 Z" fill="#5a4a2a"/>`;
  for(let i=0;i<14;i++){
    const y=30+i*15,w=70-i*4;
    s+=`<path d="M 128 ${y} q ${-w*0.7} ${-6} ${-w} ${14}" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
    s+=`<path d="M 128 ${y} q ${w*0.7} ${-6} ${w} ${14}" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  }
  return svgWrap(s,256);
})(),{size:256});

Tex.tuft=(key,c1,c2)=>svgTex('tuft'+key,(()=>{
  const rng=mulberry32(101);let s='';
  for(let i=0;i<24;i++){
    const x=40+rng()*176,dx=(rng()-0.5)*70,h=90+rng()*130;
    s+=`<path d="M ${x} 256 q ${dx*0.4} ${-h*0.6} ${dx} ${-h}" stroke="${rng()<0.5?c1:c2}" stroke-width="${5+rng()*4}" fill="none" stroke-linecap="round"/>`;
  }
  return svgWrap(s,256);
})(),{size:128});

/* ---------------- environment cubemap + materials ---------------- */
let ENVMAP=null;
function makeEnvMap(){
  const faces=[];
  for(let f=0;f<6;f++){
    const cv=document.createElement('canvas');cv.width=cv.height=64;
    const ctx=cv.getContext('2d');
    const gr=ctx.createLinearGradient(0,0,0,64);
    if(f===2){gr.addColorStop(0,'#cfe4f5');gr.addColorStop(1,'#9fc0dd')}       // +Y sky
    else if(f===3){gr.addColorStop(0,'#4a4640');gr.addColorStop(1,'#33302b')}  // -Y ground
    else{gr.addColorStop(0,'#b8d4ea');gr.addColorStop(0.6,'#8fb4d4');gr.addColorStop(0.62,'#5a564e');gr.addColorStop(1,'#403c36')}
    ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);
    faces.push(cv);
  }
  ENVMAP=new THREE.CubeTexture(faces);ENVMAP.needsUpdate=true;
  return ENVMAP;
}

const M={};
function _std(o){o.envMap=o.envMap!==undefined?o.envMap:ENVMAP;if(o.envMap&&o.envMapIntensity===undefined)o.envMapIntensity=0.6;return new THREE.MeshStandardMaterial(o)}
function _emis(c,i){return new THREE.MeshStandardMaterial({color:0x0a0a0a,emissive:new THREE.Color(c),emissiveIntensity:i||1.6,roughness:0.6,metalness:0})}
function initMaterials(){
  makeEnvMap();
  M.body      =_std({color:0xffffff,map:Tex.hull('A','#e9e5dc','#ff7a2a','R-6'),metalness:0.5,roughness:0.42});
  M.shipHull  =_std({color:0xffffff,map:Tex.hull('B','#dfe3e6','#e8642a','SR·07'),metalness:0.62,roughness:0.34});
  M.shipDark  =_std({color:0xffffff,map:Tex.metal('D','#3a3f46'),metalness:0.7,roughness:0.45});
  M.chassis   =_std({color:0xffffff,map:Tex.metal('C','#4a4f57'),metalness:0.6,roughness:0.55});
  M.darkMetal =_std({color:0x2e3238,metalness:0.75,roughness:0.5});
  M.accent    =_std({color:0xff7a2a,metalness:0.5,roughness:0.4});
  M.white     =_std({color:0xe8e8e2,metalness:0.35,roughness:0.5});
  M.tire      =_std({color:0xffffff,map:Tex.tread(),bumpMap:Tex.tread(),bumpScale:0.02,metalness:0,roughness:0.95,envMap:null});
  M.rim       =_std({color:0xb8bcc2,metalness:0.85,roughness:0.3});
  M.cage      =_std({color:0xc9c5ba,metalness:0.55,roughness:0.45});
  M.seat      =_std({color:0x30343a,metalness:0.05,roughness:0.9,envMap:null});
  M.glass     =_std({color:0x8fc3e8,metalness:0.9,roughness:0.06,transparent:true,opacity:0.4,envMapIntensity:1.2,side:THREE.DoubleSide});
  M.glassDark =_std({color:0x1a2a3a,metalness:0.9,roughness:0.1,transparent:true,opacity:0.85});
  M.solar     =_std({color:0xffffff,map:Tex.solar(),metalness:0.7,roughness:0.3});
  M.crate     =_std({color:0xffffff,map:Tex.crate(),metalness:0.4,roughness:0.6,envMap:null});
  M.barrel    =_std({color:0xffffff,map:Tex.barrel(),metalness:0.5,roughness:0.5,envMap:null});
  M.caution   =_std({color:0xffffff,map:Tex.caution(),metalness:0.3,roughness:0.6,envMap:null});
  M.road      =_std({color:0xffffff,map:Tex.road(),metalness:0.05,roughness:0.95,envMap:null});
  M.pad       =_std({color:0xffffff,map:Tex.pad(),metalness:0.2,roughness:0.85,envMap:null});
  M.concrete  =_std({color:0x9a968c,metalness:0.05,roughness:0.95,envMap:null});
  M.dashE     =new THREE.MeshStandardMaterial({color:0x111111,emissive:0xffffff,emissiveIntensity:0.9,emissiveMap:Tex.dash(),map:Tex.dash(),roughness:0.5});
  M.lightW    =_emis('#fff6d8',2.2); M.lightR=_emis('#ff3b30',2.2); M.lightG=_emis('#35e06a',2.2);
  /* 矿石/草药材质 */
  M.oreFe =new THREE.MeshStandardMaterial({color:0x8a5a3a,roughness:0.9,metalness:0.3});
  M.oreAl =new THREE.MeshStandardMaterial({color:0xc8d0d8,roughness:0.35,metalness:0.85});
  M.oreAg =new THREE.MeshStandardMaterial({color:0xe8ecf2,roughness:0.2,metalness:1.0});
  M.oreAu =new THREE.MeshStandardMaterial({color:0xffc84a,roughness:0.25,metalness:1.0});
  M.oreDia=new THREE.MeshStandardMaterial({color:0xcef2ff,roughness:0.05,metalness:0.1,emissive:0x7ac6ff,emissiveIntensity:0.35});
  M.oreU  =new THREE.MeshStandardMaterial({color:0x3a5a2a,roughness:0.6,emissive:0x64ff3a,emissiveIntensity:0.9});
  M.herbG =new THREE.MeshStandardMaterial({color:0x3a7a3e,roughness:0.9,emissive:0x2aff8a,emissiveIntensity:0.35,side:THREE.DoubleSide});
  M.lightO    =_emis('#ffb03a',2);   M.lightC=_emis('#35e0ff',2);   M.engineE=_emis('#7ac6ff',2.6);
  M.nozzle    =_std({color:0x6a6e76,metalness:0.9,roughness:0.35});
  M.gunmetal  =_std({color:0x3a3d44,metalness:0.85,roughness:0.35});
  M.trunk     =_std({color:0x6a4a30,metalness:0,roughness:0.95,envMap:null});
  M.trunkDark =_std({color:0x3f3327,metalness:0,roughness:0.95,envMap:null});
  M.leafA     =_std({color:0xffffff,map:Tex.canopy('A','#4a7a34','#68984a',91),roughness:0.9,metalness:0,envMap:null});
  M.leafB     =_std({color:0xffffff,map:Tex.canopy('B','#3a6a2c','#548440',92),roughness:0.9,metalness:0,envMap:null});
  M.frond     =new THREE.MeshStandardMaterial({map:Tex.frond('A','#4a8a3a'),transparent:true,alphaTest:0.35,side:THREE.DoubleSide,roughness:0.9,metalness:0});
  M.tuft      =new THREE.MeshStandardMaterial({map:Tex.tuft('A','#5a8a3e','#7aa04a'),transparent:true,alphaTest:0.3,side:THREE.DoubleSide,roughness:1,metalness:0});
  M.cactus    =_std({color:0x4a7a3e,roughness:0.85,metalness:0,envMap:null});
  M.toxicShroom=_std({color:0x7a5a9a,roughness:0.8,metalness:0.1,envMap:null});
  M.crystalE  =new THREE.MeshStandardMaterial({color:0x8a5ae8,emissive:0x6a3ad8,emissiveIntensity:0.7,metalness:0.6,roughness:0.2,transparent:true,opacity:0.85});
  M.iceMat    =_std({color:0xd8ecf8,metalness:0.1,roughness:0.25,transparent:true,opacity:0.92});
  M.rockMat   =_std({color:0xffffff,map:Tex.rock('G','#8a8078','#5a544c',33),roughness:0.95,metalness:0,envMap:null});
  M.obsidian  =_std({color:0x201a18,metalness:0.4,roughness:0.35});
  M.lightLava =_emis('#ff5a1a',2.4);
  M.domeM     =_std({color:0xd8d4ca,metalness:0.45,roughness:0.4});
  M.wallA     =new THREE.MeshStandardMaterial({map:Tex.facade('A','#b0aca2',51),emissiveMap:Tex.facade('A','#b0aca2',51,true),emissive:0xffffff,emissiveIntensity:0,metalness:0.25,roughness:0.7});
  M.wallB     =new THREE.MeshStandardMaterial({map:Tex.facade('B','#8a929a',52),emissiveMap:Tex.facade('B','#8a929a',52,true),emissive:0xffffff,emissiveIntensity:0,metalness:0.25,roughness:0.7});
  M.signNeon  =new THREE.MeshStandardMaterial({color:0x111111,emissive:0xffffff,emissiveIntensity:1.2,emissiveMap:Tex.neon('A','OUTPOST','#35e0ff'),map:Tex.neon('A','OUTPOST','#35e0ff'),roughness:0.5});
  M.lampHead  =_emis('#ffedc0',1.4);
}
