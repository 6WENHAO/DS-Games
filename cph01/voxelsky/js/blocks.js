import*as THREE from"three";
import{mulberry32}from"./util.js";

export const TILE={STONE:0,DIRT:1,GRASS_TOP:2,GRASS_SIDE:3,SAND:4,SNOW:5,ICE:6,WOOD_SIDE:7,WOOD_TOP:8,LEAVES:9,WATER:10,FERRITE:11,COPPER:12,COBALT:13,DIHYDRO:14,SODIUM:15,OXYGEN:16,TUFT:17,FLOWER:18,BRICK:19,PANEL:20,GLASS:21,LIGHT:22,PLANKS:23,MONOLITH:24,BEACON:25,CACTUS_SIDE:26,CACTUS_TOP:27};

export const B={AIR:0,STONE:1,DIRT:2,GRASS:3,SAND:4,SNOW:5,ICE:6,WOOD:7,LEAVES:8,WATER:9,FERRITE:10,COPPER:11,COBALT:12,SODIUM:13,OXYGEN:14,DIHYDRO:15,TUFT:16,FLOWER:17,BRICK:18,PANEL:19,GLASS:20,LIGHT:21,PLANKS:22,MONOLITH:23,BEACON:24,CACTUS:25};

export const BLOCKS=[
  {name:"空气",solid:false},
  {name:"岩石",tiles:{all:TILE.STONE},hard:1.15,drop:{res:"ferrite",n:[2,4]},mat:"stone"},
  {name:"泥土",tiles:{all:TILE.DIRT},hard:0.5,drop:{res:"ferrite",n:[1,2]},mat:"dirt"},
  {name:"草皮",tiles:{top:TILE.GRASS_TOP,bottom:TILE.DIRT,side:TILE.GRASS_SIDE},hard:0.55,drop:{res:"carbon",n:[1,2]},mat:"grass"},
  {name:"沙",tiles:{all:TILE.SAND},hard:0.45,drop:{res:"silica",n:[2,4]},mat:"sand"},
  {name:"积雪",tiles:{all:TILE.SNOW},hard:0.4,drop:{res:"silica",n:[1,2]},mat:"snow"},
  {name:"寒冰",tiles:{all:TILE.ICE},hard:0.8,drop:{res:"dihydrogen",n:[1,3]},mat:"ice",cutout:false},
  {name:"枝干",tiles:{side:TILE.WOOD_SIDE,top:TILE.WOOD_TOP,bottom:TILE.WOOD_TOP},hard:0.9,drop:{res:"carbon",n:[4,6]},mat:"wood"},
  {name:"叶簇",tiles:{all:TILE.LEAVES},hard:0.25,drop:{res:"carbon",n:[1,2]},mat:"plant",cutout:true},
  {name:"液态水",tiles:{all:TILE.WATER},hard:-1,water:true,solid:false},
  {name:"铁氧矿脉",tiles:{all:TILE.FERRITE},hard:1.6,drop:{res:"ferrite",n:[8,13]},mat:"stone",res:true},
  {name:"铜矿沉积",tiles:{all:TILE.COPPER},hard:1.8,drop:{res:"copper",n:[6,10]},mat:"metal",res:true,glow:0.25},
  {name:"钴晶簇",tiles:{all:TILE.COBALT},hard:1.7,drop:{res:"cobalt",n:[6,10]},mat:"crystal",res:true,glow:0.3},
  {name:"钠花",tiles:{all:TILE.SODIUM},hard:0.2,drop:{res:"sodium",n:[8,12]},mat:"plant",cross:true,res:true,glow:0.5},
  {name:"氧合植株",tiles:{all:TILE.OXYGEN},hard:0.2,drop:{res:"oxygen",n:[8,12]},mat:"plant",cross:true,res:true,glow:0.35},
  {name:"二氢晶体",tiles:{all:TILE.DIHYDRO},hard:1.1,drop:{res:"dihydrogen",n:[10,16]},mat:"crystal",cutout:true,res:true,glow:0.55},
  {name:"草叶",tiles:{all:TILE.TUFT},hard:0.15,drop:{res:"carbon",n:[1,1]},mat:"plant",cross:true},
  {name:"异星花",tiles:{all:TILE.FLOWER},hard:0.15,drop:{res:"carbon",n:[1,2]},mat:"plant",cross:true},
  {name:"石砖",tiles:{all:TILE.BRICK},hard:0.9,drop:{item:"stonebrick",n:[1,1]},mat:"stone",place:true},
  {name:"合金面板",tiles:{all:TILE.PANEL},hard:0.9,drop:{item:"panel",n:[1,1]},mat:"metal",place:true},
  {name:"玻璃",tiles:{all:TILE.GLASS},hard:0.5,drop:{item:"glass",n:[1,1]},mat:"crystal",cutout:true,place:true},
  {name:"光源方块",tiles:{all:TILE.LIGHT},hard:0.6,drop:{item:"light",n:[1,1]},mat:"metal",place:true,glow:1},
  {name:"木板",tiles:{all:TILE.PLANKS},hard:0.8,drop:{item:"planks",n:[1,1]},mat:"wood",place:true},
  {name:"远古方尖碑",tiles:{all:TILE.MONOLITH},hard:-1,mat:"stone",glow:0.4},
  {name:"信标核心",tiles:{all:TILE.BEACON},hard:-1,mat:"metal",glow:0.8},
  {name:"棘柱",tiles:{side:TILE.CACTUS_SIDE,top:TILE.CACTUS_TOP,bottom:TILE.CACTUS_TOP},hard:0.5,drop:{res:"carbon",n:[3,5]},mat:"plant"}
];
for(const b of BLOCKS){if(b.solid===undefined)b.solid=!b.cross&&!b.water;}

export const ITEMS={
  carbon:{name:"碳",en:"C",cat:"基础元素",color:"#e05252",desc:"一切有机生命的基础构件。可从植物与树木中开采获得，用于为便携设备与生命维持系统供能。",val:7,max:500,icon:"chip"},
  oxygen:{name:"氧",en:"O₂",cat:"基础元素",color:"#e8474d",desc:"维持生命所必需的气体元素。可从红色氧合植株中收集，用于为生命维持系统充能。",val:34,max:500,icon:"chip"},
  ferrite:{name:"铁尘",en:"Fe",cat:"金属元素",color:"#b7a99a",desc:"由行星岩石研磨产生的金属粉末。基础的建造与修理材料，可从任何岩石中开采。",val:14,max:500,icon:"chip"},
  silica:{name:"硅砂",en:"Si",cat:"基础元素",color:"#e8d5a8",desc:"细腻的晶体砂粒，在高温下可熔炼为玻璃。可从沙地与雪原中收集。",val:8,max:500,icon:"chip"},
  sodium:{name:"钠",en:"Na",cat:"催化元素",color:"#f5c542",desc:"高活性的黄色矿物元素，闪耀于异星植株之上。用于为危险防护装置充能。",val:41,max:500,icon:"chip"},
  dihydrogen:{name:"二氢",en:"H",cat:"能源元素",color:"#5aa6f0",desc:"宇宙中最丰富的能源元素，以蓝色晶体形式存在于行星表面。是起飞燃料的关键原料。",val:34,max:500,icon:"chip"},
  copper:{name:"铜",en:"Cu",cat:"恒星金属",color:"#ff9b51",desc:"由恒星辐射激活的发光金属，蕴藏于地表矿石沉积中。用于制造高级科技组件。",val:121,max:500,icon:"chip"},
  cobalt:{name:"钴",en:"Co",cat:"地底矿物",color:"#5a6cf0",desc:"深埋于洞穴之中的蓝色矿物。离子化后可为各类科技升级提供动力。",val:198,max:500,icon:"chip"},
  tritium:{name:"氚",en:"H₃",cat:"太空元素",color:"#7ce8e8",desc:"氢的放射性同位素，漂浮于小行星带之中。是脉冲引擎的专用燃料。",val:24,max:500,icon:"chip"},
  plating:{name:"金属镀层",en:"ALLOY",cat:"制造组件",color:"#c9d4dc",desc:"经过锻压的多层合金装甲板。飞船修理与高级建造的必备组件。",val:402,max:10,icon:"plating"},
  nanotube:{name:"碳纳米管",en:"NANO",cat:"制造组件",color:"#8a8f96",desc:"以单层碳原子卷曲而成的微型管束，强度是钢铁的百倍。",val:287,max:10,icon:"nanotube"},
  jelly:{name:"二氢凝胶",en:"GEL",cat:"能源物质",color:"#4d8fe8",desc:"高度压缩的二氢半流体。不稳定，但蕴含惊人的能量密度。",val:340,max:10,icon:"jelly"},
  seal:{name:"密封垫",en:"SEAL",cat:"稀有组件",color:"#ffb36b",desc:"用于隔绝真空的高分子密封环。可从遇险信标或废弃设施中回收。",val:800,max:5,icon:"seal"},
  launchfuel:{name:"起飞燃料",en:"FUEL",cat:"能源物质",color:"#ff8f3c",desc:"固态火箭推进剂。为起飞推进器提供逃离行星引力所需的爆发推力。",val:1200,max:5,icon:"fuel"},
  stonebrick:{name:"石砖",en:"BLOCK",cat:"建造方块",color:"#9a9a9a",desc:"切割整齐的岩石砖块，基地建造的基础材料。选中后可放置于世界之中。",val:12,max:200,icon:"block:18"},
  panel:{name:"合金面板",en:"BLOCK",cat:"建造方块",color:"#b8c4cc",desc:"轻质合金建造面板，带有防滑纹理。选中后可放置于世界之中。",val:60,max:200,icon:"block:19"},
  glass:{name:"玻璃",en:"BLOCK",cat:"建造方块",color:"#bfe8f0",desc:"高强度透明硅酸盐板材。选中后可放置于世界之中。",val:45,max:200,icon:"block:20"},
  light:{name:"光源方块",en:"BLOCK",cat:"建造方块",color:"#fff3c4",desc:"自供能的冷光照明单元，可驱散最深的黑暗。选中后可放置。",val:90,max:200,icon:"block:21"},
  planks:{name:"木板",en:"BLOCK",cat:"建造方块",color:"#c49a6c",desc:"加工过的植物纤维板材。选中后可放置于世界之中。",val:20,max:200,icon:"block:22"}
};

export const ITEM_TO_BLOCK={stonebrick:B.BRICK,panel:B.PANEL,glass:B.GLASS,light:B.LIGHT,planks:B.PLANKS};

function hex2rgb(h){
  const n=parseInt(h.slice(1),16);
  return[(n>>16)&255,(n>>8)&255,n&255];
}
function shade(h,f){
  const[r,g,b]=hex2rgb(h);
  const m=v=>Math.max(0,Math.min(255,Math.round(v*f)));
  return`rgb(${m(r)},${m(g)},${m(b)})`;
}
function mix(h1,h2,t){
  const a=hex2rgb(h1),b=hex2rgb(h2);
  return`rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`;
}

const S=16;
function drawNoisy(ctx,x0,y0,base,vary,rng,skip=0){
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    if(skip&&rng()<skip)continue;
    const f=1+(rng()-0.5)*vary;
    ctx.fillStyle=shade(base,f);
    ctx.fillRect(x0+x,y0+y,1,1);
  }
}
function speckle(ctx,x0,y0,color,count,rng,size=1){
  ctx.fillStyle=color;
  for(let i=0;i<count;i++){
    ctx.fillRect(x0+Math.floor(rng()*(S-size)),y0+Math.floor(rng()*(S-size)),size,size);
  }
}

const TILE_PAINTERS={
  [TILE.STONE]:(c,x,y,p,r)=>{drawNoisy(c,x,y,p.stone,0.18,r);speckle(c,x,y,shade(p.stone,0.7),9,r);speckle(c,x,y,shade(p.stone,1.25),7,r);},
  [TILE.DIRT]:(c,x,y,p,r)=>{drawNoisy(c,x,y,p.dirt,0.22,r);speckle(c,x,y,shade(p.dirt,0.65),8,r);},
  [TILE.GRASS_TOP]:(c,x,y,p,r)=>{drawNoisy(c,x,y,p.grass,0.2,r);speckle(c,x,y,shade(p.grass,1.3),10,r);speckle(c,x,y,shade(p.grass,0.72),8,r);},
  [TILE.GRASS_SIDE]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,p.dirt,0.22,r);
    for(let i=0;i<S;i++){
      const h=3+Math.floor(r()*3);
      for(let j=0;j<h;j++){c.fillStyle=shade(p.grass,1-(j*0.09)+(r()-0.5)*0.15);c.fillRect(x+i,y+j,1,1);}
    }
  },
  [TILE.SAND]:(c,x,y,p,r)=>{drawNoisy(c,x,y,p.sand,0.13,r);speckle(c,x,y,shade(p.sand,0.82),7,r);},
  [TILE.SNOW]:(c,x,y,p,r)=>{drawNoisy(c,x,y,"#eef4f8",0.06,r);speckle(c,x,y,"#ffffff",9,r);},
  [TILE.ICE]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,"#9cc8e8",0.1,r);
    c.strokeStyle="rgba(255,255,255,.55)";
    c.beginPath();c.moveTo(x+3,y+12);c.lineTo(x+8,y+6);c.lineTo(x+13,y+9);c.stroke();
  },
  [TILE.WOOD_SIDE]:(c,x,y,p,r)=>{
    for(let i=0;i<S;i++){
      const f=0.82+((i*2654435761)%7)*0.045;
      for(let j=0;j<S;j++){c.fillStyle=shade(p.wood,f*(1+(r()-0.5)*0.12));c.fillRect(x+i,y+j,1,1);}
    }
  },
  [TILE.WOOD_TOP]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,shade(p.wood,1.12),0.1,r);
    c.strokeStyle=shade(p.wood,0.6);
    for(let q=2;q<8;q+=2){c.strokeRect(x+q+0.5,y+q+0.5,S-q*2-1,S-q*2-1);}
  },
  [TILE.LEAVES]:(c,x,y,p,r)=>{
    c.clearRect(x,y,S,S);
    for(let j=0;j<S;j++)for(let i=0;i<S;i++){
      if(r()<0.16)continue;
      c.fillStyle=shade(p.leaf,1+(r()-0.5)*0.3);
      c.fillRect(x+i,y+j,1,1);
    }
  },
  [TILE.WATER]:(c,x,y,p,r)=>{
    const[wr,wg,wb]=hex2rgb(p.water);
    for(let j=0;j<S;j++)for(let i=0;i<S;i++){
      const f=1+(r()-0.5)*0.12;
      c.fillStyle=`rgba(${Math.round(wr*f)},${Math.round(wg*f)},${Math.round(wb*f)},0.62)`;
      c.fillRect(x+i,y+j,1,1);
    }
    c.fillStyle="rgba(255,255,255,.16)";
    for(let i=0;i<4;i++)c.fillRect(x+Math.floor(r()*13),y+Math.floor(r()*13),3,1);
  },
  [TILE.FERRITE]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,p.stone,0.16,r);
    for(let i=0;i<5;i++){
      const px=x+1+Math.floor(r()*12),py=y+1+Math.floor(r()*12);
      c.fillStyle="#c8b49a";c.fillRect(px,py,2,2);
      c.fillStyle="#8a7a64";c.fillRect(px+1,py+1,1,1);
    }
  },
  [TILE.COPPER]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,p.stone,0.16,r);
    for(let i=0;i<5;i++){
      const px=x+1+Math.floor(r()*12),py=y+1+Math.floor(r()*12);
      c.fillStyle="#ff9b51";c.fillRect(px,py,2,2);
      c.fillStyle="#ffd0a8";c.fillRect(px,py,1,1);
    }
  },
  [TILE.COBALT]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,shade(p.stone,0.8),0.16,r);
    for(let i=0;i<5;i++){
      const px=x+1+Math.floor(r()*12),py=y+1+Math.floor(r()*12);
      c.fillStyle="#5a6cf0";c.fillRect(px,py,2,2);
      c.fillStyle="#aab4ff";c.fillRect(px+1,py,1,1);
    }
  },
  [TILE.DIHYDRO]:(c,x,y,p,r)=>{
    c.clearRect(x,y,S,S);
    const spikes=[[8,1,3,14],[3,5,3,10],[12,6,2,9]];
    for(const[sx,sy,w,h]of spikes){
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){
        c.fillStyle=j<2?"#cfe6ff":shade("#4d8fe8",1+(r()-0.5)*0.35);
        c.fillRect(x+sx+i,y+sy+j,1,1);
      }
      c.fillStyle="#a8d0ff";c.fillRect(x+sx,y+sy,1,h);
    }
  },
  [TILE.SODIUM]:(c,x,y,p,r)=>{
    c.clearRect(x,y,S,S);
    c.fillStyle="#3d7a35";c.fillRect(x+7,y+9,2,7);
    c.fillStyle="#f5c542";
    c.fillRect(x+5,y+3,6,6);
    c.fillStyle="#fff0b8";c.fillRect(x+6,y+4,2,2);
    c.fillStyle="#c79a1e";c.fillRect(x+9,y+7,2,2);
    c.fillStyle="#f5c542";c.fillRect(x+3,y+5,2,2);c.fillRect(x+11,y+4,2,2);
  },
  [TILE.OXYGEN]:(c,x,y,p,r)=>{
    c.clearRect(x,y,S,S);
    c.fillStyle="#5a3d2e";c.fillRect(x+7,y+10,2,6);
    c.fillStyle="#e8474d";
    c.fillRect(x+4,y+2,8,8);
    c.fillStyle="#ff9da1";c.fillRect(x+5,y+3,3,2);
    c.fillStyle="#a82e33";c.fillRect(x+9,y+7,3,3);
    c.fillStyle="#e8474d";c.fillRect(x+2,y+6,2,3);c.fillRect(x+12,y+5,2,3);
  },
  [TILE.TUFT]:(c,x,y,p,r)=>{
    c.clearRect(x,y,S,S);
    for(let i=0;i<7;i++){
      const bx=x+1+i*2,h=4+Math.floor(r()*8);
      c.fillStyle=shade(p.grass,0.85+r()*0.5);
      c.fillRect(bx,y+S-h,1,h);
    }
  },
  [TILE.FLOWER]:(c,x,y,p,r)=>{
    c.clearRect(x,y,S,S);
    c.fillStyle=shade(p.grass,0.75);c.fillRect(x+7,y+8,2,8);
    c.fillStyle=p.flower||"#e88bd0";
    c.fillRect(x+5,y+3,6,5);
    c.fillStyle="#fff";c.fillRect(x+7,y+5,2,2);
    c.fillStyle=p.flower||"#e88bd0";c.fillRect(x+3,y+4,2,2);c.fillRect(x+11,y+4,2,2);
  },
  [TILE.BRICK]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,"#9a9a9a",0.1,r);
    c.fillStyle="#6e6e6e";
    c.fillRect(x,y+7,S,1);c.fillRect(x,y+15,S,1);
    c.fillRect(x+7,y,1,7);c.fillRect(x+3,y+8,1,7);c.fillRect(x+11,y+8,1,7);
  },
  [TILE.PANEL]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,"#aeb9c2",0.07,r);
    c.fillStyle="#7f8b95";c.fillRect(x,y,S,1);c.fillRect(x,y,1,S);
    c.fillStyle="#d8e2ea";c.fillRect(x,y+15,S,1);c.fillRect(x+15,y,1,S);
    c.fillStyle="#6a7680";
    c.fillRect(x+2,y+2,1,1);c.fillRect(x+13,y+2,1,1);c.fillRect(x+2,y+13,1,1);c.fillRect(x+13,y+13,1,1);
  },
  [TILE.GLASS]:(c,x,y,p,r)=>{
    c.clearRect(x,y,S,S);
    c.fillStyle="rgba(200,235,245,.28)";c.fillRect(x,y,S,S);
    c.fillStyle="rgba(255,255,255,.85)";
    c.fillRect(x,y,S,1);c.fillRect(x,y+15,S,1);c.fillRect(x,y,1,S);c.fillRect(x+15,y,1,S);
    c.fillStyle="rgba(255,255,255,.5)";
    c.fillRect(x+3,y+9,1,4);c.fillRect(x+4,y+8,1,1);c.fillRect(x+10,y+3,1,4);c.fillRect(x+11,y+2,1,1);
  },
  [TILE.LIGHT]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,"#fff3c4",0.05,r);
    c.fillStyle="#c8a84a";
    c.fillRect(x,y,S,1);c.fillRect(x,y+15,S,1);c.fillRect(x,y,1,S);c.fillRect(x+15,y,1,S);
    c.fillStyle="#fffdf0";c.fillRect(x+4,y+4,8,8);
  },
  [TILE.PLANKS]:(c,x,y,p,r)=>{
    const base=mix(p.wood,"#c49a6c",0.5);
    drawNoisy(c,x,y,base,0.12,r);
    c.fillStyle=shade(base,0.6);
    c.fillRect(x,y+3,S,1);c.fillRect(x,y+7,S,1);c.fillRect(x,y+11,S,1);c.fillRect(x,y+15,S,1);
  },
  [TILE.MONOLITH]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,"#20242e",0.15,r);
    c.fillStyle="#7ce8e8";
    const gl=[[4,3],[7,3],[10,3],[5,6],[9,6],[7,9],[4,12],[10,12]];
    for(const[gx,gy]of gl)if(r()<0.7)c.fillRect(x+gx,y+gy,2,1);
  },
  [TILE.BEACON]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,"#3a4048",0.1,r);
    c.fillStyle="#ffb36b";c.fillRect(x+3,y+3,10,10);
    c.fillStyle="#ffe4c4";c.fillRect(x+5,y+5,6,6);
    c.fillStyle="#2a2e34";c.fillRect(x+7,y+7,2,2);
  },
  [TILE.CACTUS_SIDE]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,mix(p.grass,"#3d8a4a",0.55),0.16,r);
    c.fillStyle="#0f3d1e";
    c.fillRect(x+3,y+2,1,2);c.fillRect(x+11,y+5,1,2);c.fillRect(x+6,y+10,1,2);c.fillRect(x+13,y+12,1,2);
  },
  [TILE.CACTUS_TOP]:(c,x,y,p,r)=>{
    drawNoisy(c,x,y,mix(p.grass,"#2e7a3d",0.6),0.12,r);
  }
};

export const ATLAS_COLS=8;
export function buildAtlas(palette){
  const canvas=document.createElement("canvas");
  canvas.width=ATLAS_COLS*S;canvas.height=ATLAS_COLS*S;
  const ctx=canvas.getContext("2d");
  ctx.imageSmoothingEnabled=false;
  for(let t=0;t<=27;t++){
    const painter=TILE_PAINTERS[t];
    if(!painter)continue;
    const rng=mulberry32(t*7919+31);
    const tx=(t%ATLAS_COLS)*S,ty=Math.floor(t/ATLAS_COLS)*S;
    painter(ctx,tx,ty,palette,rng);
  }
  const tex=new THREE.CanvasTexture(canvas);
  tex.magFilter=THREE.NearestFilter;
  tex.minFilter=THREE.NearestFilter;
  tex.generateMipmaps=false;
  tex.colorSpace=THREE.SRGBColorSpace;
  return{canvas,tex};
}
export function tileUV(t){
  const u0=(t%ATLAS_COLS)/ATLAS_COLS,v0=1-(Math.floor(t/ATLAS_COLS)+1)/ATLAS_COLS;
  const e=0.35/(ATLAS_COLS*S);
  return[u0+e,v0+e,u0+1/ATLAS_COLS-e,v0+1/ATLAS_COLS-e];
}

function drawChip(ctx,sz,color,label){
  const c=sz/2;
  ctx.clearRect(0,0,sz,sz);
  ctx.save();
  ctx.translate(c,c);
  ctx.rotate(Math.PI/4);
  const d=sz*0.32;
  ctx.fillStyle=color;
  ctx.fillRect(-d,-d,d*2,d*2);
  ctx.strokeStyle="rgba(255,255,255,.85)";
  ctx.lineWidth=sz*0.045;
  ctx.strokeRect(-d,-d,d*2,d*2);
  ctx.fillStyle="rgba(0,0,0,.25)";
  ctx.fillRect(-d,d*0.3,d*2,d*0.7);
  ctx.restore();
  ctx.fillStyle="#fff";
  ctx.font=`700 ${label.length>2?sz*0.3:sz*0.38}px Rajdhani,sans-serif`;
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.shadowColor="rgba(0,0,0,.6)";ctx.shadowBlur=3;
  ctx.fillText(label,c,c+sz*0.02);
  ctx.shadowBlur=0;
}
function drawCubeIcon(ctx,sz,atlasCanvas,tileTop,tileSide){
  ctx.clearRect(0,0,sz,sz);
  ctx.imageSmoothingEnabled=false;
  const w=sz*0.42,h=sz*0.24,cx=sz/2,cy=sz*0.3;
  const sxT=(tileTop%ATLAS_COLS)*S,syT=Math.floor(tileTop/ATLAS_COLS)*S;
  const sxS=(tileSide%ATLAS_COLS)*S,syS=Math.floor(tileSide/ATLAS_COLS)*S;
  ctx.save();
  ctx.setTransform(1,0.5,-1,0.5,cx,cy);
  ctx.drawImage(atlasCanvas,sxT,syT,S,S,0,0,w,w);
  ctx.restore();
  ctx.save();
  ctx.setTransform(1,0.5,0,1.16,cx-w,cy+w*0.5);
  ctx.drawImage(atlasCanvas,sxS,syS,S,S,0,0,w,w*0.86);
  ctx.globalAlpha=0.28;ctx.fillStyle="#000";ctx.fillRect(0,0,w,w*0.86);
  ctx.restore();
  ctx.save();
  ctx.setTransform(1,-0.5,0,1.16,cx,cy+w);
  ctx.drawImage(atlasCanvas,sxS,syS,S,S,0,0,w,w*0.86);
  ctx.globalAlpha=0.14;ctx.fillStyle="#000";ctx.fillRect(0,0,w,w*0.86);
  ctx.restore();
}
const PRODUCT_PAINTERS={
  plating(ctx,sz){
    const u=sz/16;
    ctx.fillStyle="#8f9ba5";ctx.fillRect(2*u,4*u,12*u,9*u);
    ctx.fillStyle="#c9d4dc";ctx.fillRect(2*u,3*u,12*u,2*u);
    ctx.fillStyle="#5f6b75";ctx.fillRect(2*u,12*u,12*u,u);
    ctx.fillStyle="#e8f0f6";
    [[4,6],[11,6],[4,10],[11,10]].forEach(([x,y])=>ctx.fillRect(x*u,y*u,u,u));
  },
  nanotube(ctx,sz){
    const u=sz/16;
    ctx.fillStyle="#5a6069";
    ctx.fillRect(3*u,5*u,10*u,6*u);
    ctx.fillStyle="#8a8f96";ctx.fillRect(3*u,5*u,10*u,2*u);
    ctx.fillStyle="#2e3238";ctx.beginPath();ctx.arc(13*u,8*u,3*u,0,7);ctx.fill();
    ctx.fillStyle="#7ce8e8";ctx.beginPath();ctx.arc(13*u,8*u,1.6*u,0,7);ctx.fill();
  },
  jelly(ctx,sz){
    const u=sz/16;
    ctx.fillStyle="rgba(77,143,232,.9)";
    ctx.fillRect(4*u,6*u,8*u,7*u);
    ctx.fillRect(5*u,4*u,6*u,2*u);
    ctx.fillStyle="rgba(170,210,255,.95)";ctx.fillRect(5*u,6*u,2*u,2*u);
    ctx.fillStyle="rgba(30,80,160,.9)";ctx.fillRect(9*u,10*u,2*u,2*u);
  },
  seal(ctx,sz){
    const u=sz/16;
    ctx.strokeStyle="#ffb36b";ctx.lineWidth=2.6*u;
    ctx.beginPath();ctx.arc(8*u,8*u,4.6*u,0,7);ctx.stroke();
    ctx.strokeStyle="#8a5a2e";ctx.lineWidth=u*0.9;
    ctx.beginPath();ctx.arc(8*u,8*u,4.6*u,0,7);ctx.stroke();
  },
  fuel(ctx,sz){
    const u=sz/16;
    ctx.fillStyle="#c9502e";ctx.fillRect(5*u,3*u,6*u,11*u);
    ctx.fillStyle="#ff8f3c";ctx.fillRect(5*u,3*u,6*u,3*u);
    ctx.fillStyle="#2e2e2e";ctx.fillRect(6*u,1*u,4*u,2*u);
    ctx.fillStyle="#ffd9ae";ctx.fillRect(6*u,8*u,4*u,3*u);
    ctx.fillStyle="#c9502e";ctx.font=`700 ${3.4*u}px sans-serif`;
  }
};
export function makeIcons(atlasCanvas){
  const out={};
  const sz=48;
  for(const[id,def]of Object.entries(ITEMS)){
    const cv=document.createElement("canvas");
    cv.width=sz;cv.height=sz;
    const ctx=cv.getContext("2d");
    if(def.icon==="chip")drawChip(ctx,sz,def.color,def.en.replace("₂","2").replace("₃","3"));
    else if(def.icon.startsWith("block:")){
      const bid=parseInt(def.icon.slice(6));
      const bd=BLOCKS[bid];
      const tTop=bd.tiles.top??bd.tiles.all,tSide=bd.tiles.side??bd.tiles.all;
      drawCubeIcon(ctx,sz,atlasCanvas,tTop,tSide);
    }
    else if(PRODUCT_PAINTERS[def.icon])PRODUCT_PAINTERS[def.icon](ctx,sz);
    out[id]=cv.toDataURL();
  }
  const beam=document.createElement("canvas");
  beam.width=sz;beam.height=sz;
  const bc=beam.getContext("2d");
  const u=sz/16;
  bc.fillStyle="#4a525c";bc.fillRect(3*u,7*u,9*u,4*u);
  bc.fillStyle="#68727e";bc.fillRect(3*u,7*u,9*u,1.6*u);
  bc.fillStyle="#30363e";bc.fillRect(5*u,11*u,3*u,3*u);
  bc.fillStyle="#7ce8e8";bc.fillRect(12*u,8*u,2*u,2*u);
  bc.fillStyle="#d8f6f6";bc.fillRect(12.6*u,8.6*u,0.8*u,0.8*u);
  out.multitool=beam.toDataURL();
  const terr=document.createElement("canvas");
  terr.width=sz;terr.height=sz;
  const tc=terr.getContext("2d");
  tc.fillStyle="#4a525c";tc.fillRect(3*u,7*u,9*u,4*u);
  tc.fillStyle="#ffb36b";tc.fillRect(12*u,7.6*u,2.6*u,2.6*u);
  tc.fillStyle="#30363e";tc.fillRect(5*u,11*u,3*u,3*u);
  out.terrain=terr.toDataURL();
  return out;
}
